import express from "express";
import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

// Use global fetch when available (Node 18+). Fallback to node-fetch if needed.
async function httpFetch(...args) {
  if (typeof fetch !== "undefined") return fetch(...args);
  const mod = await import("node-fetch");
  return mod.default(...args);
}

const router = express.Router();

// --- Palm Beach County Property Information (Owner/Mailing) enrichment ---
const PBC_URL =
  "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Property_Information_Table/FeatureServer/0/query";
const PBC_OUTFIELDS = "PARCEL_NUMBER,OWNER_NAME1,OWNER_NAME2,PADDR1,CITYNAME";
const pbcCache = new Map(); // parcelNumber -> attributes|null

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchPbcAttributes(parcelNumbers) {
  const unique = Array.from(new Set((parcelNumbers || []).filter(Boolean).map(String)));
  const missing = unique.filter((n) => !pbcCache.has(n));
  if (missing.length === 0) return;

  // ArcGIS supports IN (...) queries. Chunk to keep URL size reasonable.
  for (const group of chunk(missing, 75)) {
    const inList = group.map((n) => `'${n.replace(/'/g, "''")}'`).join(",");
    const where = `PARCEL_NUMBER IN (${inList})`;
    const url =
      `${PBC_URL}?f=json&outFields=${encodeURIComponent(PBC_OUTFIELDS)}` +
      `&where=${encodeURIComponent(where)}&returnGeometry=false`;

    try {
      const resp = await httpFetch(url);
      const json = await resp.json();
      const feats = json?.features || [];
      const found = new Map();
      for (const ft of feats) {
        const a = ft?.attributes || {};
        if (a.PARCEL_NUMBER != null) found.set(String(a.PARCEL_NUMBER), a);
      }
      for (const n of group) pbcCache.set(String(n), found.get(String(n)) || null);
    } catch (e) {
      console.error("PBC enrichment batch failed:", e?.message || String(e));
      // Mark as null to avoid hammering the service on repeated requests
      for (const n of group) pbcCache.set(String(n), null);
    }
  }
}

function applyPbcToParcel(parcel, attrs) {
  if (!parcel) return parcel;
  const ownerName = attrs ? [attrs.OWNER_NAME1, attrs.OWNER_NAME2].filter(Boolean).join(" ").trim() : "";
  const mailingAddress = attrs?.PADDR1 ? String(attrs.PADDR1).trim() : "";
  const mailingCity = attrs?.CITYNAME ? String(attrs.CITYNAME).trim() : "";
  return {
    ...parcel,
    ownerName,
    mailingAddress,
    mailingCity,
  };
}

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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bboxIntersects(a, b) {
  // [minX, minY, maxX, maxY]
  return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
}

// ---- parcel loading + spatial grid ----
let LOADED = false;
let RAW = null;
let FEATURES = [];
let GRID = null;

// One-to-one feature grid (simple index for fast candidate selection)
function buildGrid(features) {
  const bboxes = [];
  const feats = [];
  const centers = [];
  for (const f of features) {
    try {
      const bbox = turf.bbox(f);
      bboxes.push(bbox);
      feats.push(f);
      const c = turf.center(f);
      centers.push(c.geometry.coordinates);
    } catch {
      // skip invalid
      bboxes.push(null);
      feats.push(null);
      centers.push(null);
    }
  }
  return { bboxes, features: feats, centers };
}

function resolveGeoJsonPath() {
  const candidates = [
    // 1) repo root:   server/data/parcels_enriched.geojson
    // 2) server dir:  data/parcels_enriched.geojson
    process.env.MYZONE_PARCELS_PATH,
    path.resolve(process.cwd(), "server", "data", "parcels_enriched.geojson"),
    path.resolve(process.cwd(), "data", "parcels_enriched.geojson"),
    path.resolve(process.cwd(), "server", "data", "parcels_enriched.json"),
    path.resolve(process.cwd(), "data", "parcels_enriched.json"),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    `parcels_enriched.geojson not found. Tried:\n- ${candidates.join("\n- ")}\n\n` +
      `Fix: ensure the file exists at server/data/parcels_enriched.geojson (repo root), ` +
      `or set MYZONE_PARCELS_PATH=/full/path/to/parcels_enriched.geojson`
  );
}

function loadParcelsOnce() {
  if (LOADED) return;
  const p = resolveGeoJsonPath();
  const raw = fs.readFileSync(p, "utf8");
  RAW = safeJsonParse(raw, p);
  FEATURES = RAW?.features || [];
  GRID = buildGrid(FEATURES);
  LOADED = true;
}

function normalizeParcelFeature(feature) {
  const props = feature?.properties || {};
  const id =
    normalizeStr(props.id || props.parcel_id || props.PARID || props.PARCEL_ID || props.PCN || props.PIN || props.PID) ||
    "";

  const address =
    normalizeStr(props.address || props.ADDRESS || props.SITE_ADDR || props.SITUS || props.SITUS_ADDR || props.FULL_ADD) ||
    "";

  const owner =
    normalizeStr(props.owner || props.OWNER || props.OWNER_NAME || props.OWN_NAME || props.OWNERNME || "") || "";

  const jurisdiction =
    normalizeStr(props.jurisdiction || props.JURIS || props.MUNICIPALITY || props.CITY || props.JURISDICTION || "") || "";

  const zoning =
    normalizeStr(props.zoning || props.ZONING || props.ZONING_DESC || props.ZONING_DIST || props.DISTRICT || props.ZONE || "") ||
    "";

  const flu = normalizeStr(props.flu || props.FLU || props.FUTURE_LU || props.FUTURE_LAND_USE || "") || "";

  let areaAcres = null;
  try {
    const sqm = turf.area(feature);
    areaAcres = sqm / 4046.8564224;
  } catch {
    areaAcres = null;
  }

  // centroid lat/lng
  let lat = null,
    lng = null;
  try {
    const c = turf.center(feature);
    lng = c.geometry.coordinates[0];
    lat = c.geometry.coordinates[1];
  } catch {
    lat = null;
    lng = null;
  }

  return {
    id,
    address,
    owner,
    jurisdiction,
    zoning,
    flu,
    areaAcres: areaAcres == null ? null : Number(areaAcres.toFixed(4)),
    lat,
    lng,
    geometry: feature?.geometry || null,
    _raw: props,
  };
}

// Candidate indices by bbox (simple scan over grid bbox list)
function candidateIndicesForBBox(bbox) {
  // With this grid structure, we just scan all bboxes (still fast enough for local dev)
  // and keep only intersecting indices.
  const out = [];
  for (let i = 0; i < GRID.bboxes.length; i++) {
    const b = GRID.bboxes[i];
    if (!b) continue;
    if (bboxIntersects(b, bbox)) out.push(i);
  }
  return out;
}

// ---- routes ----
router.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * GET /api/geo/parcel-by-point?lat=&lng=
 */
router.get("/parcel-by-point", (req, res) => {
  try {
    loadParcelsOnce();

    const lat = num(req.query.lat);
    const lng = num(req.query.lng);
    if (lat == null || lng == null) return res.status(400).json({ error: "Invalid lat/lng" });

    const pt = turf.point([lng, lat]);

    // linear scan for now (sufficient locally)
    for (const f of FEATURES) {
      try {
        if (turf.booleanPointInPolygon(pt, f)) {
          return res.json({ parcel: normalizeParcelFeature(f) });
        }
      } catch {
        // ignore geometry errors
      }
    }

    return res.status(404).json({ error: "No parcel found" });
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

    const parcel = normalizeStr(req.query.parcel);
    const address = normalizeStr(req.query.address);

    if (!parcel && !address) return res.status(400).json({ error: "Provide parcel or address" });

    const results = [];
    const needleParcel = normalizeKey(parcel);
    const needleAddr = normalizeKey(address);

    for (const f of FEATURES) {
      const p = f?.properties || {};
      const pid = normalizeKey(p.id || p.parcel_id || p.PARID || p.PARCEL_ID || p.PCN || p.PIN || p.PID);
      const addr = normalizeKey(p.address || p.ADDRESS || p.SITE_ADDR || p.SITUS || p.SITUS_ADDR || p.FULL_ADD);

      if (needleParcel && pid && pid.includes(needleParcel)) results.push(normalizeParcelFeature(f));
      else if (needleAddr && addr && addr.includes(needleAddr)) results.push(normalizeParcelFeature(f));

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
 *   parcels:[{...normalized, geometry, ownerName, mailingAddress, mailingCity}, ...]
 * }
 */
router.get("/buffer", async (req, res) => {
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

    const candidateIdx = candidateIndicesForBBox(bufferBbox);

    const parcels = [];
    for (const idx of candidateIdx) {
      const bbox = GRID.bboxes[idx];
      if (!bbox) continue;
      if (!bboxIntersects(bbox, bufferBbox)) continue;

      const f = GRID.features[idx];
      if (!f) continue;
      try {
        if (turf.booleanIntersects(f, bufferPoly)) {
          parcels.push(normalizeParcelFeature(f)); // includes geometry
        }
      } catch {
        // ignore geometry errors
      }
    }

    // Enrich with PBC owner/mailing (join on PARCEL_NUMBER = parcel.id)
    const parcelNumbers = parcels.map((p) => p?.id).filter(Boolean);
    await fetchPbcAttributes(parcelNumbers);
    const enrichedParcels = parcels.map((p) => applyPbcToParcel(p, pbcCache.get(String(p.id))));

    res.json({
      center: { lat, lng },
      radiusFeet,
      parcels: enrichedParcels,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;
