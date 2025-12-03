const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");
const turf = require("@turf/turf");

const app = express();
const PORT = 5003; // main map API port your client is using

app.use(cors());
app.use(express.json());

// ---------- FILE PATHS ----------
const boundariesPath = path.join(__dirname, "data", "municipal_boundaries.geojson");
const parcelsPath = path.join(__dirname, "data", "parcels.geojson");
const zoningPath = path.join(__dirname, "data", "zoning.geojson");

// ---------- EXTERNAL ARCGIS PROPERTY SERVICE ----------
const PROPERTY_SERVICE_BASE =
  "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Property_Information_Table/FeatureServer/0/query";

// ---------- LOAD GEOJSON DATA ----------
let municipalBoundaries = null;
let parcels = null;
let zoningLayer = null;

try {
  const raw = fs.readFileSync(boundariesPath, "utf8");
  municipalBoundaries = JSON.parse(raw);
  console.log(
    `Loaded municipal boundaries: ${
      municipalBoundaries.features ? municipalBoundaries.features.length : 0
    } features.`,
  );
  if (municipalBoundaries.features && municipalBoundaries.features.length > 0) {
    console.log(
      "Sample municipal boundary property keys:",
      Object.keys(municipalBoundaries.features[0].properties || {}),
    );
  }
} catch (err) {
  console.error("Error loading municipal boundaries:", err.message);
}

try {
  const raw = fs.readFileSync(parcelsPath, "utf8");
  parcels = JSON.parse(raw);
  console.log(
    `Loaded parcels: ${parcels.features ? parcels.features.length : 0} features.`,
  );
  if (parcels.features && parcels.features.length > 0) {
    console.log(
      "Sample parcel property keys:",
      Object.keys(parcels.features[0].properties || {}),
    );
  }
} catch (err) {
  console.error("Error loading parcels:", err.message);
}

try {
  const raw = fs.readFileSync(zoningPath, "utf8");
  zoningLayer = JSON.parse(raw);
  console.log(
    `Loaded zoning: ${zoningLayer.features ? zoningLayer.features.length : 0} features.`,
  );
  if (zoningLayer.features && zoningLayer.features.length > 0) {
    console.log(
      "Sample zoning property keys:",
      Object.keys(zoningLayer.features[0].properties || {}),
    );
  }
} catch (err) {
  console.error("Error loading zoning:", err.message);
}

// ---------- BASIC HELPERS ----------
function pickParcelId(props = {}) {
  const candidateKeys = [
    "PARID",          // from your local parcels
    "PCN",
    "PARCEL_NUMBER",  // from property table
    "PARCEL_ID",
    "PARCELID",
    "PARCEL",
    "FOLIO",
    "PROP_ID",
    "PIN",
    "STRAP",
    "OBJECTID",
    "ID",
  ];
  for (const key of candidateKeys) {
    if (props[key] !== undefined && props[key] !== null) {
      return String(props[key]);
    }
  }
  const parcelKey = Object.keys(props).find((k) =>
    k.toLowerCase().includes("parcel"),
  );
  if (parcelKey && props[parcelKey]) return String(props[parcelKey]);
  return "UNKNOWN";
}

function pickParcelJurisdiction(props = {}) {
  const candidateKeys = [
    "MUNI",
    "MUNI_NAME",
    "CITY",
    "MUNICIPALITY",
    "JURISD",
    "JURISDICTION",
    "LOCALGOV",
    "TOWN",
  ];
  for (const key of candidateKeys) {
    if (props[key]) return props[key];
  }
  return null;
}

function pickMunicipalityName(props = {}) {
  const candidateKeys = [
    "MUNINAME",
    "NAME",
    "Name",
    "MUNI_NAME",
    "MUNICIPALITY",
    "CITY",
    "TOWN",
    "JURISDICTION",
    "MUNICIPAL",
  ];

  for (const key of candidateKeys) {
    if (props[key]) return props[key];
  }

  const nameKey = Object.keys(props).find((k) =>
    k.toLowerCase().includes("name"),
  );
  if (nameKey && props[nameKey]) return props[nameKey];

  return "Unknown municipality";
}

function pickMunicipalityId(props = {}) {
  const candidateKeys = ["ID", "OBJECTID", "GEOID", "FID", "OID_"];
  for (const key of candidateKeys) {
    if (props[key] !== undefined && props[key] !== null) {
      return String(props[key]);
    }
  }
  return "MUNICIPAL-AREA";
}

// ---- ZONING HELPERS ----
function pickZoningCode(props = {}) {
  if (props.FCODE) return props.FCODE;
  if (props.ZONING_DESC) return props.ZONING_DESC;

  const candidateKeys = [
    "ZONING",
    "ZONE",
    "DISTRICT",
    "ZONING_CODE",
    "ZONE_CODE",
    "ZONECODE",
    "ZONING_CD",
    "ZONINGC",
  ];
  for (const key of candidateKeys) {
    if (props[key]) return props[key];
  }
  const zoneKey = Object.keys(props).find((k) =>
    k.toLowerCase().includes("zone"),
  );
  if (zoneKey && props[zoneKey]) return props[zoneKey];
  return "TBD";
}

function pickZoningName(props = {}) {
  if (props.ZONING_DESC) return props.ZONING_DESC;

  const candidateKeys = [
    "ZONING_NAME",
    "DIST_NAME",
    "DISTRICT_NAME",
    "DESCRIPTION",
    "DESCRIPT",
    "ZONE_DESC",
    "ZONEDESC",
  ];
  for (const key of candidateKeys) {
    if (props[key]) return props[key];
  }
  return "";
}

function pickZoningFLU(props = {}) {
  const candidateKeys = [
    "FLU",
    "FUTURE_LAND_USE",
    "FUTURE_LU",
    "FLU_CODE",
    "FLU_DESIG",
    "LANDUSE",
  ];
  for (const key of candidateKeys) {
    if (props[key]) return props[key];
  }
  return "TBD";
}

// ---------- ARCGIS PROPERTY HELPERS ----------
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

// Extract situs / address from ArcGIS attributes (Property_Information_Table)
function extractSitusFromProps(props = {}) {
  // From your sample: SITE_ADDR_STR is the full site address
  if (props.SITE_ADDR_STR && String(props.SITE_ADDR_STR).trim() !== "") {
    return String(props.SITE_ADDR_STR).trim();
  }

  // Fallbacks / composite build
  const primary = [
    "SITUS",
    "SITUS_ADDR",
    "SITE_ADDR",
    "SITEADD",
    "ADDRESS",
    "ADDR",
    "LOCATION",
    "PROP_ADDR",
    "PROPERTY_ADDR",
  ];

  for (const key of primary) {
    if (
      props[key] &&
      typeof props[key] === "string" &&
      props[key].trim() !== ""
    ) {
      return props[key].trim();
    }
  }

  const numKeys = ["STREET_NUMBER", "ADDR_NO", "HOUSE_NO", "ST_NO", "NUMBER"];
  const streetKeys = ["STREET_NAME", "STREET", "ST_NAME", "ROAD", "RD_NAME"];
  const suffixKeys = ["STREET_SUFFIX_ABBR"];

  let num = null;
  let street = null;
  let suffix = null;

  for (const nk of numKeys) {
    if (props[nk]) {
      num = String(props[nk]).trim();
      break;
    }
  }

  for (const sk of streetKeys) {
    if (props[sk]) {
      street = String(props[sk]).trim();
      break;
    }
  }

  for (const sx of suffixKeys) {
    if (props[sx]) {
      suffix = String(props[sx]).trim();
      break;
    }
  }

  if (num && street && suffix) {
    return `${num} ${street} ${suffix}`;
  }
  if (num && street) {
    return `${num} ${street}`;
  }

  return null;
}

// Extract owner name from ArcGIS attributes
function pickOwnerName(attrs = {}) {
  const candidates = [
    "OWNER_NAME1",
    "OWNER_NAME2",
    "OWNER",
    "OWNER1",
    "OWNER2",
    "OWNERNME1",
    "OWNERNME2",
    "OWNER_NAME",
    "OWNER_NA",
  ];
  for (const key of candidates) {
    if (attrs[key] && String(attrs[key]).trim() !== "") {
      return String(attrs[key]).trim();
    }
  }
  return null;
}

// Fallback local label if we can't reach property service
function fallbackLocalAddress(props = {}) {
  const addr = extractSitusFromProps(props);
  if (addr) return addr;

  const id = pickParcelId(props);
  return id && id !== "UNKNOWN" ? `Parcel ${id}` : "Parcel";
}

// Fetch property attributes from PBC ArcGIS by parcel number
// NOTE: Using PARCEL_NUMBER from your sample, not PCN.
async function fetchPropertyAttributesByParcelNumber(parcelNumber) {
  if (!parcelNumber) return null;

  const whereClause = encodeURIComponent(`PARCEL_NUMBER='${parcelNumber}'`);
  const url =
    `${PROPERTY_SERVICE_BASE}?` +
    `f=json&outFields=*` +
    `&where=${whereClause}`;

  const json = await fetchJson(url);
  if (!json || !Array.isArray(json.features) || json.features.length === 0) {
    return null;
  }

  const feat = json.features[0];
  const attrs = feat.attributes || {};
  return attrs;
}

// ---------- ROUTES ----------

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    boundariesLoaded: !!municipalBoundaries,
    parcelsLoaded: !!parcels,
    zoningLoaded: !!zoningLayer,
    propertyServiceBase: PROPERTY_SERVICE_BASE,
  });
});

// Municipal boundaries GeoJSON
app.get("/api/municipal-boundaries", (req, res) => {
  if (!municipalBoundaries) {
    return res.status(500).json({ error: "Municipal boundaries not loaded" });
  }
  res.json(municipalBoundaries);
});

// Parcels GeoJSON (limited for display)
app.get("/api/parcels-geojson", (req, res) => {
  if (!parcels) {
    return res.status(500).json({ error: "Parcels dataset not loaded" });
  }

  const features = parcels.features || [];
  const maxFeatures = 5000;
  const limited = {
    type: "FeatureCollection",
    features: features.slice(0, maxFeatures),
  };

  res.json(limited);
});

// Zoning GeoJSON (limited for display)
app.get("/api/zoning-geojson", (req, res) => {
  if (!zoningLayer) {
    return res.status(500).json({ error: "Zoning dataset not loaded" });
  }

  const features = zoningLayer.features || [];
  const maxFeatures = 3000;
  const limited = {
    type: "FeatureCollection",
    features: features.slice(0, maxFeatures),
  };

  res.json(limited);
});

// Parcel-by-point – compute jurisdiction + zoning for the parcel + remote situs/owner
app.get("/api/parcel-by-point", async (req, res) => {
  if (!parcels || !parcels.features) {
    return res.status(500).json({ error: "Parcels dataset not loaded" });
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "Invalid lat/lng parameters" });
  }

  const point = turf.point([lng, lat]);

  let foundParcel = null;
  for (const feature of parcels.features) {
    try {
      if (feature && feature.geometry && turf.booleanPointInPolygon(point, feature)) {
        foundParcel = feature;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!foundParcel) {
    return res.status(404).json({ error: "No parcel found at this location" });
  }

  const props = foundParcel.properties || {};

  // Your local parcel ID (e.g., PARID / PCN) – this is what we pass as PARCEL_NUMBER to the property service
  const parcelId = pickParcelId(props);

  let jurisdiction = pickParcelJurisdiction(props);

  const parcelCentroid = turf.centerOfMass(foundParcel);
  const [cLng, cLat] = parcelCentroid.geometry.coordinates;

  if (!jurisdiction && municipalBoundaries && municipalBoundaries.features) {
    for (const muniFeature of municipalBoundaries.features) {
      try {
        if (
          muniFeature &&
          muniFeature.geometry &&
          turf.booleanPointInPolygon(parcelCentroid, muniFeature)
        ) {
          jurisdiction = pickMunicipalityName(muniFeature.properties || {});
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }

  if (!jurisdiction) {
    jurisdiction = "Palm Beach County (unincorporated)";
  }

  const areaSqMeters = turf.area(foundParcel);
  const areaAcres = areaSqMeters / 4046.8564224;

  let zoningCode = "TBD";
  let fluCode = "TBD";
  if (zoningLayer && zoningLayer.features) {
    try {
      for (const zFeature of zoningLayer.features) {
        if (!zFeature || !zFeature.geometry) continue;
        try {
          if (turf.booleanIntersects(foundParcel, zFeature)) {
            const zProps = zFeature.properties || {};
            zoningCode = pickZoningCode(zProps);
            fluCode = pickZoningFLU(zProps);
            break;
          }
        } catch (_e) {
          continue;
        }
      }
    } catch (err) {
      console.error("Error computing zoning for parcel:", err);
    }
  }

  // Remote property lookup (address + owner) using PARCEL_NUMBER
  let address = null;
  let owner = null;
  try {
    const attrs = await fetchPropertyAttributesByParcelNumber(parcelId);
    if (attrs) {
      address = extractSitusFromProps(attrs) || fallbackLocalAddress(props);
      owner = pickOwnerName(attrs);
    }
  } catch (err) {
    console.error("Error fetching remote property info:", err.message);
  }

  if (!address) {
    address = fallbackLocalAddress(props);
  }

  res.json({
    id: parcelId,
    address,
    owner,
    jurisdiction,
    zoning: zoningCode,
    flu: fluCode,
    areaAcres: Number.isFinite(areaAcres) ? areaAcres : null,
    lat: cLat,
    lng: cLng,
    properties: props,
    geometry: foundParcel.geometry,
  });
});

// Zoning-by-point (still available for debugging)
app.get("/api/zoning-by-point", (req, res) => {
  if (!zoningLayer || !zoningLayer.features) {
    return res.status(500).json({ error: "Zoning dataset not loaded" });
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "Invalid lat/lng parameters" });
  }

  const point = turf.point([lng, lat]);

  let foundFeature = null;
  for (const feature of zoningLayer.features) {
    try {
      if (feature && feature.geometry && turf.booleanPointInPolygon(point, feature)) {
        foundFeature = feature;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!foundFeature) {
    return res.status(404).json({ error: "No zoning polygon found at this location" });
  }

  const props = foundFeature.properties || {};
  const zoningCode = pickZoningCode(props);
  const zoningName = pickZoningName(props);
  const fluCode = pickZoningFLU(props);

  res.json({
    zoningCode,
    zoningName,
    fluCode,
    properties: props,
  });
});

// Municipality-by-point (standalone)
app.get("/api/municipality-by-point", (req, res) => {
  if (!municipalBoundaries || !municipalBoundaries.features) {
    return res.status(500).json({ error: "Municipal boundaries not loaded" });
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "Invalid lat/lng parameters" });
  }

  const point = turf.point([lng, lat]);

  let foundFeature = null;
  for (const feature of municipalBoundaries.features) {
    try {
      if (feature && feature.geometry && turf.booleanPointInPolygon(point, feature)) {
        foundFeature = feature;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!foundFeature) {
    return res.status(404).json({ error: "No municipality found at this location" });
  }

  const props = foundFeature.properties || {};
  const displayName = pickMunicipalityName(props);
  const id = pickMunicipalityId(props);

  const areaSqMeters = turf.area(foundFeature);
  const areaAcres = areaSqMeters / 4046.8564224;

  res.json({
    id,
    name: displayName,
    zoning: "TBD",
    flu: "TBD",
    jurisdiction: displayName,
    areaAcres: Number.isFinite(areaAcres) ? areaAcres : null,
    properties: props,
  });
});

// ---------- BUFFER / NOTICE-RADIUS TOOL ----------
app.get("/api/buffer-parcels", (req, res) => {
  console.log("Buffer route hit with query:", req.query);

  if (!parcels || !parcels.features) {
    console.error("Buffer route: parcels dataset not loaded.");
    return res.json({
      center: null,
      radiusFeet: null,
      buffer: null,
      count: 0,
      parcels: [],
      error: "Parcels dataset not loaded",
    });
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusFeet = parseFloat(req.query.radiusFeet || "500");

  if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radiusFeet)) {
    console.warn("Buffer route: invalid parameters", req.query);
    return res.json({
      center: null,
      radiusFeet: null,
      buffer: null,
      count: 0,
      parcels: [],
      error: "Invalid lat/lng/radiusFeet parameters",
    });
  }

  try {
    const radiusMiles = radiusFeet / 5280;
    const centerPoint = turf.point([lng, lat]);
    const bufferPolygon = turf.buffer(centerPoint, radiusMiles, { units: "miles" });

    const results = [];
    const maxParcels = 500;

    for (const feature of parcels.features) {
      if (!feature || !feature.geometry) continue;

      try {
        if (turf.booleanIntersects(feature, bufferPolygon)) {
          const props = feature.properties || {};
          const id = pickParcelId(props);
          const address = fallbackLocalAddress(props);

          let jurisdiction = pickParcelJurisdiction(props);
          if (!jurisdiction && municipalBoundaries && municipalBoundaries.features) {
            const centroid = turf.centerOfMass(feature);
            for (const muniFeature of municipalBoundaries.features) {
              try {
                if (
                  muniFeature &&
                  muniFeature.geometry &&
                  turf.booleanPointInPolygon(centroid, muniFeature)
                ) {
                  jurisdiction = pickMunicipalityName(
                    muniFeature.properties || {},
                  );
                  break;
                }
              } catch (e) {
                continue;
              }
            }
          }
          if (!jurisdiction) {
            jurisdiction = "Palm Beach County (unincorporated)";
          }

          const areaSqMeters = turf.area(feature);
          const areaAcres = areaSqMeters / 4046.8564224;
          const centroid = turf.centerOfMass(feature);
          const [cLng, cLat] = centroid.geometry.coordinates;

          results.push({
            id,
            address,
            jurisdiction,
            areaAcres: Number.isFinite(areaAcres) ? areaAcres : null,
            centroid: { lat: cLat, lng: cLng },
          });

          if (results.length >= maxParcels) break;
        }
      } catch (_innerErr) {
        continue;
      }
    }

    return res.json({
      center: { lat, lng },
      radiusFeet,
      buffer: bufferPolygon,
      count: results.length,
      parcels: results,
      error: null,
    });
  } catch (err) {
    console.error("Error in /api/buffer-parcels:", err);
    return res.json({
      center: { lat, lng },
      radiusFeet,
      buffer: null,
      count: 0,
      parcels: [],
      error: "Internal error while generating buffer",
    });
  }
});

// ---------- POWERFUL SEARCH: PARID / OWNER ----------
app.get("/api/parcel-search", async (req, res) => {
  if (!parcels || !parcels.features) {
    return res.status(500).json({ error: "Parcels dataset not loaded" });
  }

  const qRaw = (req.query.q || "").trim();
  if (!qRaw) {
    return res.status(400).json({ error: "Missing q parameter" });
  }

  const nearLat = parseFloat(req.query.nearLat);
  const nearLng = parseFloat(req.query.nearLng);
  const hasNear = Number.isFinite(nearLat) && Number.isFinite(nearLng);

  const q = qRaw.toLowerCase();
  const qDigits = qRaw.replace(/\D/g, "");
  const looksLikeParid = /^[0-9]{8,20}$/.test(qDigits);

  const paridKeys = [
    "PARID",
    "PARCEL_NUMBER",
    "PCN",
    "PARCEL_ID",
    "PARCELID",
    "PARCEL",
    "FOLIO",
    "PROP_ID",
    "PIN",
    "STRAP",
  ];
  const ownerKeys = [
    "OWNER_NAME1",
    "OWNER_NAME2",
    "OWNER",
    "OWNER1",
    "OWNER2",
    "OWNERNME1",
    "OWNERNME2",
    "OWNER_NAME",
    "OWNER_NA",
  ];

  let candidates = [];

  for (const feature of parcels.features) {
    if (!feature || !feature.properties) continue;
    const props = feature.properties;

    // 1) Exact PARID-style match
    if (looksLikeParid) {
      let paridMatch = false;
      for (const key of paridKeys) {
        if (props[key] != null) {
          const vDigits = String(props[key]).replace(/\D/g, "");
          if (vDigits === qDigits) {
            paridMatch = true;
            break;
          }
        }
      }
      if (paridMatch) {
        candidates.push({ feature, score: 10 });
        continue;
      }
    }

    // 2) Simple fuzzy on local props (if they exist on your parcels)
    let score = 0;

    for (const key of ownerKeys) {
      if (props[key]) {
        const v = String(props[key]).toLowerCase();
        if (v.includes(q)) {
          score = Math.max(score, 2);
        }
      }
    }

    for (const key of paridKeys) {
      if (props[key]) {
        const v = String(props[key]).toLowerCase();
        if (v.includes(q)) {
          score = Math.max(score, 1);
        }
      }
    }

    if (score > 0) {
      candidates.push({ feature, score });
    }
  }

  if (candidates.length === 0) {
    return res.status(404).json({ error: "No parcel found for that search" });
  }

  let best = null;
  if (hasNear) {
    const centerPoint = turf.point([nearLng, nearLat]);

    const maxScore = Math.max(...candidates.map((c) => c.score));
    const topCandidates = candidates.filter((c) => c.score === maxScore);

    let bestDist = Infinity;
    for (const c of topCandidates) {
      try {
        const centroid = turf.centerOfMass(c.feature);
        const dist = turf.distance(centerPoint, centroid, { units: "miles" });
        if (dist < bestDist) {
          bestDist = dist;
          best = c.feature;
        }
      } catch (_e) {
        continue;
      }
    }

    if (!best) {
      best = topCandidates[0].feature;
    }
  } else {
    candidates.sort((a, b) => b.score - a.score);
    best = candidates[0].feature;
  }

  const props = best.properties || {};
  const parcelId = pickParcelId(props);

  let jurisdiction = pickParcelJurisdiction(props);

  const centroid = turf.centerOfMass(best);
  const [cLng, cLat] = centroid.geometry.coordinates;

  if (!jurisdiction && municipalBoundaries && municipalBoundaries.features) {
    for (const muniFeature of municipalBoundaries.features) {
      try {
        if (
          muniFeature &&
          muniFeature.geometry &&
          turf.booleanPointInPolygon(centroid, muniFeature)
        ) {
          jurisdiction = pickMunicipalityName(muniFeature.properties || {});
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }
  if (!jurisdiction) {
    jurisdiction = "Palm Beach County (unincorporated)";
  }

  const areaSqMeters = turf.area(best);
  const areaAcres = areaSqMeters / 4046.8564224;

  let zoningCode = "TBD";
  let fluCode = "TBD";
  if (zoningLayer && zoningLayer.features) {
    try {
      for (const zFeature of zoningLayer.features) {
        if (!zFeature || !zFeature.geometry) continue;
        try {
          if (turf.booleanIntersects(best, zFeature)) {
            const zProps = zFeature.properties || {};
            zoningCode = pickZoningCode(zProps);
            fluCode = pickZoningFLU(zProps);
            break;
          }
        } catch (_e) {
          continue;
        }
      }
    } catch (err) {
      console.error("Error computing zoning for parcel-search:", err);
    }
  }

  // Remote property lookup (address + owner) for the search result
  let address = null;
  let owner = null;
  try {
    const attrs = await fetchPropertyAttributesByParcelNumber(parcelId);
    if (attrs) {
      address = extractSitusFromProps(attrs) || fallbackLocalAddress(props);
      owner = pickOwnerName(attrs);
    }
  } catch (err) {
    console.error("Error fetching remote property info (search):", err.message);
  }

  if (!address) {
    address = fallbackLocalAddress(props);
  }

  return res.json({
    id: parcelId,
    address,
    owner,
    jurisdiction,
    zoning: zoningCode,
    flu: fluCode,
    areaAcres: Number.isFinite(areaAcres) ? areaAcres : null,
    lat: cLat,
    lng: cLng,
    properties: props,
    geometry: best.geometry,
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Map API listening on http://localhost:${PORT}`);
});
