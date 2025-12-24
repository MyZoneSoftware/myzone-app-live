import express from "express";

// Uses Node 18+ global fetch (works on Azure & local). If you're on older Node, install node-fetch.
const router = express.Router();

const ARCGIS_QUERY_URL = "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_Local_Prj/FeatureServer/0/query";

// ---------- helpers ----------
function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function sqMetersToAcres(m2) {
  if (!Number.isFinite(m2)) return null;
  return m2 * 0.000247105381;
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

function normalizeFeature(feature) {
  const a = feature?.attributes || {};
  const g = feature?.geometry || null;

  // Best-effort: ArcGIS returns rings in Web Mercator or StatePlane sometimes.
  // For UI highlight we keep geometry as GeoJSON if possible, but we always include lat/lng.
  const id = pickFirst(a, ["PARID","PARCEL_NUMBER","PCN","PARCELID","PARCEL_ID","PIN","FOLIO","FOLIO_NUMBER"]) || "";
  const address = pickFirst(a, ["SITE_ADDR_STR","SITE_ADDRESS","ADDRESS","ADDR","SITUS","SITUS_ADDRESS"]) || "";
  const owner = pickFirst(a, ["OWNER","OWNER_NAME","OWNER1","OWNNAME"]) || "";
  const jurisdiction = pickFirst(a, ["MUNICIPALITY","JURIS","JURISDICTION","CITY","MUNI"]) || "";
  const zoning = pickFirst(a, ["ZONING","ZONING_DESC","ZONING_DIST","ZONINGDIST","ZONEDESC"]) || "";
  const flu = pickFirst(a, ["FLU","FLU_DESC","FUTURE_LAND_USE","FUTURE_LAND_USE_DESC","FLU_CAT"]) || "";

  // Area fields vary; prefer square meters or square feet if present
  const areaM2 = num(pickFirst(a, ["SHAPE__Area","Shape__Area","AREA_SQM","AREA_M2","AREA_METER","AREA"])) ;
  const areaAcresRaw = num(pickFirst(a, ["ACRES","AREA_ACRES","ACREAGE"])) ;
  const areaAcres = areaAcresRaw ?? (areaM2 != null ? sqMetersToAcres(areaM2) : null);

  // Centerpoint: ArcGIS often provides X/Y. If not, we'll compute later in /parcel-by-point.
  const lon = num(pickFirst(a, ["X","LONGITUDE","LON","CENTER_LON","CENTROID_X"]));
  const lat = num(pickFirst(a, ["Y","LATITUDE","LAT","CENTER_LAT","CENTROID_Y"]));

  // If geometry is rings/paths, keep raw; /geo routes will convert to GeoJSON when possible.
  return {
    id,
    address,
    owner,
    jurisdiction,
    zoning,
    flu,
    areaAcres,
    lat,
    lng: lon,
    geometry: g,
    raw: a,
  };
}

async function arcgisQuery(params) {
  const usp = new URLSearchParams({
    f: "json",
    outFields: "*",
    returnGeometry: "true",
    ...params,
  });

  const url = ARCGIS_QUERY_URL + "?" + usp.toString();
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`ArcGIS HTTP ${r.status}: ${t.slice(0,200)}`);
  }
  const data = await r.json();
  if (data.error) {
    throw new Error(`ArcGIS error: ${data.error?.message || "unknown"}`);
  }
  return data;
}

// ---------- routes ----------

// GET /api/arcgis/search?q=...
// Returns: { results: [normalizedParcel...] }
router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ results: [] });

    // If user typed a PCN/folio, try exact-ish match first, else address-ish fields.
    const v = q.replace(/'/g, "''");
    const where = `
      PARID LIKE '%${v}%'
      OR PARCEL_NUMBER LIKE '%${v}%'
      OR SITE_ADDR_STR LIKE '%${v}%'
      OR STREET_NAME LIKE '%${v}%'
      OR OWNER LIKE '%${v}%'
    `;

    const data = await arcgisQuery({
      where,
      resultRecordCount: "10",
      outSR: "4326",
    });

    const feats = Array.isArray(data.features) ? data.features : [];
    const results = feats.map(normalizeFeature);
    return res.json({ results });
  } catch (err) {
    console.error("ArcGIS search error:", err);
    res.status(500).json({ error: "ArcGIS search failed" });
  }
});

export default router;
