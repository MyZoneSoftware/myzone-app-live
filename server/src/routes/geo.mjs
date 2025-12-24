import express from "express";
import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

const router = express.Router();

/**
 * Local GeoJSON-backed GEO routes (NO ArcGIS calls)
 * Source of truth: server/data/parcels_enriched.geojson
 *
 * Endpoints used by the UI:
 *  - GET  /api/geo/parcel-by-point?lat=&lng=
 *  - GET  /api/geo/search?parcel=ID
 *  - GET  /api/geo/search?address=TEXT
 *  - GET  /api/geo/buffer?lat=&lng=&radiusFeet=
 */

/* ----------------------------- helpers ----------------------------- */

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeStr(v) {
  return String(v ?? "").trim();
}

function normalizeKey(s) {
  return normalizeStr(s).toLowerCase();
}

function safeJsonParse(raw, where = "GeoJSON") {
  try {
    return JSON.parse(raw);
  } catch (e) {
    const msg = e?.message || String(e);
    throw new Error(`Failed to parse ${where}: ${msg}`);
  }
}

function resolveDataPath() {
  // Try common run locations:
  // 1) repo root:   server/data/parcels_enriched.geojson
  // 2) server dir:  data/parcels_enriched.geojson
  // 3) explicit env: MYZONE_PARCELS_PATH
  const candidates = [];

  if (process.env.MYZONE_PARCELS_PATH) {
    candidates.push(process.env.MYZONE_PARCELS_PATH);
  }

  candidates.push(
    path.resolve(process.cwd(), "server", "data", "parcels_enriched.geojson"),
    path.resolve(process.cwd(), "data", "parcels_enriched.geojson"),
    path.resolve(process.cwd(), "server", "data", "parcels_enriched.json"),
    path.resolve(process.cwd(), "data", "parcels_enriched.json"),
  );

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }

  // Provide a helpful error message
  throw new Error(
    `parcels_enriched.geojson not found. Tried:\n- ${candidates.join("\n- ")}\n\n` +
    `Fix: ensure the file exists at server/data/parcels_enriched.geojson (repo root), ` +
    `or set MYZONE_PARCELS_PATH=/full/path/to/parcels_enriched.geojson`
  );
}

function getProp(props, keys) {
  for (const k of keys) {
    if (props && props[k] != null && String(props[k]).trim() !== "") return props[k];
  }
  return null;
}

function normalizeParcelFeature(feature) {
  const props = feature?.properties || {};
  const id =
    getProp(props, ["id", "parcel_id", "PARID", "PARCEL_ID", "PCN", "PIN", "PID"]) ??
    "";

  const address =
    getProp(props, ["address", "ADDRESS", "SITE_ADDR", "SITUS", "SITUS_ADDR", "FULL_ADD"]) ??
    "";

  const owner =
    getProp(props, ["owner", "OWNER", "OWNER_NAME", "OWN_NAME", "OWNERNME"]) ??
    "";

  const jurisdiction =
    getProp(props, ["jurisdiction", "JURIS", "MUNICIPALITY", "CITY", "JURISDICTION"]) ??
    "Palm Beach County";

  const zoning =
    getProp(props, ["zoning", "ZONING", "ZONING_DESC", "ZONING_DIST", "DISTRICT", "ZONE"]) ??
    "";

  const flu =
    getProp(props, ["flu", "FLU", "FUTURE_LAND_USE", "FLU_DESC", "FLU_CATEGORY"]) ??
    "";

  let areaAcres =
    getProp(props, ["areaAcres", "AREA_ACRES", "ACRES", "GIS_ACRES", "Calc_Acres"]) ??
    null;

  if (areaAcres != null) {
    const n = Number(areaAcres);
    areaAcres = Number.isFinite(n) ? n : null;
  }

  // Derive a point for label/map center
  let lat = getProp(props, ["lat", "LAT", "Y", "y"]) ?? null;
  let lng = getProp(props, ["lng", "LNG", "lon", "LON", "X", "x"]) ?? null;
  lat = lat != null ? Number(lat) : null;
  lng = lng != null ? Number(lng) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    try {
      const c = turf.centroid(feature);
      const coords = c?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        lng = coords[0];
        lat = coords[1];
      }
    } catch {
      lat = null;
      lng = null;
    }
  }

  return {
    id: String(id),
    address: String(address),
    owner: String(owner),
    jurisdiction: String(jurisdiction),
    zoning: String(zoning),
    flu: String(flu),
    areaAcres: areaAcres,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    // Keep geometry for highlighting
    geometry: feature?.geometry || null,
    // Keep original props for debugging/compat
    _raw: props,
  };
}

/* --------------------------- in-memory index --------------------------- */
/**
 * We can’t scan 479k polygons per click. Build a simple grid index:
 * - Compute bbox per feature
 * - Assign bbox to grid cells (e.g., 0.002° ~ ~700ft N-S; varies E-W)
 * - Query cell candidates on click/buffer bbox
 */

const GRID = {
  sizeDeg: Number(process.env.MYZONE_GRID_DEG || 0.002), // tweak if needed
  map: new Map(), // key -> array of feature indices
  bboxes: [],     // index -> [minX,minY,maxX,maxY]
  features: [],   // index -> Feature
  loaded: false,
  dataPath: null,
};

function cellKey(ix, iy) {
  return `${ix}:${iy}`;
}

function bboxToCellRange(bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  const s = GRID.sizeDeg;
  const ix0 = Math.floor(minX / s);
  const ix1 = Math.floor(maxX / s);
  const iy0 = Math.floor(minY / s);
  const iy1 = Math.floor(maxY / s);
  return [ix0, iy0, ix1, iy1];
}

function addToGrid(i, bbox) {
  const [ix0, iy0, ix1, iy1] = bboxToCellRange(bbox);
  for (let ix = ix0; ix <= ix1; ix++) {
    for (let iy = iy0; iy <= iy1; iy++) {
      const k = cellKey(ix, iy);
      const arr = GRID.map.get(k);
      if (arr) arr.push(i);
      else GRID.map.set(k, [i]);
    }
  }
}

function bboxIntersects(a, b) {
  // a,b are [minX,minY,maxX,maxY]
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function candidateIndicesForPoint(lng, lat) {
  const s = GRID.sizeDeg;
  const ix = Math.floor(lng / s);
  const iy = Math.floor(lat / s);
  const k = cellKey(ix, iy);
  return GRID.map.get(k) || [];
}

function candidateIndicesForBBox(bbox) {
  const [ix0, iy0, ix1, iy1] = bboxToCellRange(bbox);
  const out = [];
  const seen = new Set();
  for (let ix = ix0; ix <= ix1; ix++) {
    for (let iy = iy0; iy <= iy1; iy++) {
      const k = cellKey(ix, iy);
      const arr = GRID.map.get(k);
      if (!arr) continue;
      for (const idx of arr) {
        if (!seen.has(idx)) {
          seen.add(idx);
          out.push(idx);
        }
      }
    }
  }
  return out;
}

function loadParcelsOnce() {
  if (GRID.loaded) return;

  const dataPath = resolveDataPath();
  GRID.dataPath = dataPath;

  const raw = fs.readFileSync(dataPath, "utf8");
  const geo = safeJsonParse(raw, dataPath);
  const features = Array.isArray(geo?.features) ? geo.features : [];

  GRID.features = features;
  GRID.bboxes = new Array(features.length);

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    let bbox = f?.bbox;
    if (!Array.isArray(bbox) || bbox.length !== 4) {
      try {
        bbox = turf.bbox(f);
      } catch {
        // skip broken geometries
        bbox = null;
      }
    }
    if (!bbox) {
      GRID.bboxes[i] = null;
      continue;
    }
    GRID.bboxes[i] = bbox;
    addToGrid(i, bbox);
  }

  GRID.loaded = true;

  // eslint-disable-next-line no-console
  console.log(
    `[geo] Loaded ${features.length} parcels from ${dataPath}\n` +
    `[geo] Grid sizeDeg=${GRID.sizeDeg}, cells=${GRID.map.size}`
  );
}

/* ------------------------------ routes ------------------------------ */

router.get("/health", (req, res) => {
  try {
    loadParcelsOnce();
    res.json({ ok: true, source: "local_geojson", path: GRID.dataPath, count: GRID.features.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/**
 * GET /api/geo/parcel-by-point?lat=..&lng=..
 */
router.get("/parcel-by-point", (req, res) => {
  try {
    loadParcelsOnce();

    const lat = num(req.query.lat);
    const lng = num(req.query.lng);
    if (lat == null || lng == null) return res.status(400).json({ error: "Invalid lat/lng" });

    const pt = turf.point([lng, lat]);

    // Candidate polygons from grid
    const candidates = candidateIndicesForPoint(lng, lat);

    let hitIndex = -1;

    for (const idx of candidates) {
      const bbox = GRID.bboxes[idx];
      if (!bbox) continue;
      // quick bbox check
      if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;

      const f = GRID.features[idx];
      try {
        if (turf.booleanPointInPolygon(pt, f)) {
          hitIndex = idx;
          break;
        }
      } catch {
        // ignore geometry errors
      }
    }

    if (hitIndex === -1) return res.status(404).json({ error: "No parcel found" });

    const feature = GRID.features[hitIndex];
    const parcel = normalizeParcelFeature(feature);
    res.json(parcel);
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

/**
 * GET /api/geo/search?parcel=ID
 * GET /api/geo/search?address=TEXT
 */
router.get("/search", (req, res) => {
  try {
    loadParcelsOnce();

    const parcelQ = normalizeStr(req.query.parcel);
    const addrQ = normalizeStr(req.query.address);

    if (!parcelQ && !addrQ) return res.json({ results: [] });

    const needleParcel = normalizeKey(parcelQ);
    const needleAddr = normalizeKey(addrQ);

    const results = [];
    // Light scan: stop early (UI only needs top hits)
    for (let i = 0; i < GRID.features.length; i++) {
      const f = GRID.features[i];
      const p = f?.properties || {};

      const id = normalizeKey(getProp(p, ["id", "parcel_id", "PARID", "PARCEL_ID", "PCN", "PIN", "PID"]) || "");
      const address = normalizeKey(getProp(p, ["address", "ADDRESS", "SITE_ADDR", "SITUS", "SITUS_ADDR", "FULL_ADD"]) || "");

      if (needleParcel) {
        if (id && id === needleParcel) {
          results.push(normalizeParcelFeature(f));
        }
      } else if (needleAddr) {
        if (address && address.includes(needleAddr)) {
          results.push(normalizeParcelFeature(f));
        }
      }

      if (results.length >= 20) break;
    }

    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

/**
 * GET /api/geo/buffer?lat=..&lng=..&radiusFeet=..
 * Returns:
 * {
 *   center:{lat,lng},
 *   radiusFeet,
 *   parcels:[{...normalized, geometry}, ...]  // ✅ metadata + geometry
 * }
 */
router.get("/buffer", (req, res) => {
  try {
    loadParcelsOnce();

    const lat = num(req.query.lat);
    const lng = num(req.query.lng);
    const radiusFeet = num(req.query.radiusFeet) ?? 300;

    if (lat == null || lng == null) return res.status(400).json({ error: "Invalid lat/lng" });
    if (radiusFeet == null || radiusFeet <= 0) return res.status(400).json({ error: "Invalid radiusFeet" });

    const center = turf.point([lng, lat]);
    const radiusMeters = radiusFeet * 0.3048;

    // Build a buffer polygon (turf expects km by default)
    const bufferPoly = turf.buffer(center, radiusMeters / 1000, { units: "kilometers", steps: 24 });

    const bufferBbox = turf.bbox(bufferPoly);

    // Candidate polygons by bbox grid
    const candidateIdx = candidateIndicesForBBox(bufferBbox);

    const parcels = [];
    for (const idx of candidateIdx) {
      const bbox = GRID.bboxes[idx];
      if (!bbox) continue;
      if (!bboxIntersects(bbox, bufferBbox)) continue;

      const f = GRID.features[idx];
      try {
        if (turf.booleanIntersects(f, bufferPoly)) {
          parcels.push(normalizeParcelFeature(f)); // ✅ includes geometry
        }
      } catch {
        // ignore geometry errors
      }
    }

    res.json({
      center: { lat, lng },
      radiusFeet,
      parcels,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;
