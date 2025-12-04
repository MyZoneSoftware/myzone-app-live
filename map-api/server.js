const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");
const turf = require("@turf/turf");

const app = express();
const PORT = 5003;

// ---------- FILE PATHS ----------
const boundariesPath = path.join(__dirname, "data", "Municipal_Boundaries.geojson");
const parcelsPath = path.join(__dirname, "data", "Parcels.geojson");
const zoningPath = path.join(__dirname, "data", "Zoning.geojson");

// ---------- EXTERNAL ARCGIS PARCEL + PROPERTY SERVICE ----------
const PROPERTY_SERVICE_BASE =
  "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Property_Information_Table/FeatureServer/0/query";

app.use(cors());
app.use(express.json());

// ---------- LOAD GEOJSON DATA ----------
let municipalBoundaries = null;
let parcels = null;
let zoningLayer = null;

function safeLoadGeoJSON(label, filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(raw);
    console.log(
      `Loaded ${label}: ${json.features ? json.features.length : 0} features.`
    );
    if (json.features && json.features.length > 0) {
      console.log(
        `Sample ${label} property keys:`,
        Object.keys(json.features[0].properties || {})
      );
    }
    return json;
  } catch (err) {
    console.error(`Error loading ${label}:`, err.message);
    return null;
  }
}

municipalBoundaries = safeLoadGeoJSON("municipal boundaries", boundariesPath);
parcels = safeLoadGeoJSON("parcels", parcelsPath);
zoningLayer = safeLoadGeoJSON("zoning", zoningPath);

// ---------- BASIC HELPERS ----------
function pickParcelId(props = {}) {
  const candidateKeys = [
    "PARID",          // local parcels
    "PARCEL_NUMBER",  // remote property table
    "PCN",
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
    k.toLowerCase().includes("parcel")
  );
  if (parcelKey && props[parcelKey]) return String(props[parcelKey]);
  return "UNKNOWN";
}

function pickParcelJurisdiction(props = {}) {
  const candidateKeys = [
    "MUNI",
    "MUNINAME",
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
    k.toLowerCase().includes("name")
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
    k.toLowerCase().includes("zone")
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

// ---------- ARCGIS HELPERS ----------
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
            if (json.error) {
              console.error("ArcGIS service error:", json.error);
            }
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

function extractSitusFromAttrs(attrs = {}) {
  if (attrs.SITE_ADDR_STR && String(attrs.SITE_ADDR_STR).trim() !== "") {
    return String(attrs.SITE_ADDR_STR).trim();
  }

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
      attrs[key] &&
      typeof attrs[key] === "string" &&
      attrs[key].trim() !== ""
    ) {
      return attrs[key].trim();
    }
  }

  const numKeys = ["STREET_NUMBER", "ADDR_NO", "HOUSE_NO", "ST_NO", "NUMBER"];
  const streetKeys = ["STREET_NAME", "STREET", "ST_NAME", "ROAD", "RD_NAME"];
  const suffixKeys = ["STREET_SUFFIX_ABBR"];

  let num = null;
  let street = null;
  let suffix = null;

  for (const nk of numKeys) {
    if (attrs[nk]) {
      num = String(attrs[nk]).trim();
      break;
    }
  }

  for (const sk of streetKeys) {
    if (attrs[sk]) {
      street = String(attrs[sk]).trim();
      break;
    }
  }

  for (const sx of suffixKeys) {
    if (attrs[sx]) {
      suffix = String(attrs[sx]).trim();
      break;
    }
  }

  if (num && street && suffix) return `${num} ${street} ${suffix}`;
  if (num && street) return `${num} ${street}`;
  return null;
}

function fallbackLocalAddress(props = {}) {
  const id = pickParcelId(props);
  return id && id !== "UNKNOWN" ? `Parcel ${id}` : "Parcel";
}

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

async function fetchPropertyAttributesByParcelNumber(parcelNumber) {
  if (!parcelNumber) return null;
  const whereClause = encodeURIComponent(`PARCEL_NUMBER='${parcelNumber}'`);
  const url =
    `${PROPERTY_SERVICE_BASE}?` +
    `f=json&outFields=*` +
    `&where=${whereClause}`;

  console.log("ArcGIS lookup by PARCEL_NUMBER URL:", url);

  const json = await fetchJson(url);
  if (!json || !Array.isArray(json.features) || json.features.length === 0) {
    return null;
  }
  return json.features[0].attributes || null;
}

// Search remote layer by PCN / address / owner (NO UPPER(), plain LIKE)
async function searchRemoteParcels(qRaw, limit = 10) {
  const q = (qRaw || "").trim();
  if (!q) return [];

  const safeQ = q.replace(/'/g, "''");
  const digits = q.replace(/\D/g, "");
  const looksNumeric = digits.length >= 6;

  let where;
  if (looksNumeric) {
    // PCN-like search
    where = `PARCEL_NUMBER LIKE '${digits}%'`;
  } else {
    // Address / owner search – match against SITE_ADDR_STR, STREET_NAME, OWNER_NAME1, OWNER_NAME2
    where =
      "1=1 AND (" +
      `SITE_ADDR_STR LIKE '%${safeQ}%'` +
      ` OR STREET_NAME LIKE '%${safeQ}%'` +
      ` OR OWNER_NAME1 LIKE '%${safeQ}%'` +
      ` OR OWNER_NAME2 LIKE '%${safeQ}%'` +
      ")";
  }

  const url =
    `${PROPERTY_SERVICE_BASE}?` +
    `f=json&outFields=*` +
    `&where=${encodeURIComponent(where)}` +
    `&resultRecordCount=${limit}`;

  console.log("ArcGIS search URL:", url);

  const json = await fetchJson(url);
  if (!json || !Array.isArray(json.features)) {
    return [];
  }
  return json.features;
}

// Match remote PARCEL_NUMBER to local parcels geometry
function findLocalParcelByParcelNumber(parcelNumber) {
  if (!parcels || !parcels.features || !parcelNumber) return null;
  const targetDigits = String(parcelNumber).replace(/\D/g, "");
  for (const feature of parcels.features) {
    if (!feature || !feature.properties) continue;
    const props = feature.properties;
    const id = pickParcelId(props);
    const idDigits = String(id).replace(/\D/g, "");
    if (idDigits === targetDigits) {
      return feature;
    }
  }
  return null;
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

// Municipal boundaries
app.get("/api/municipal-boundaries", (req, res) => {
  if (!municipalBoundaries) {
    return res.status(500).json({ error: "Municipal boundaries not loaded" });
  }
  res.json(municipalBoundaries);
});

// Parcels subset for display
app.get("/api/parcels-geojson", (req, res) => {
  if (!parcels) {
    return res.status(500).json({ error: "Parcels dataset not loaded" });
  }
  const features = parcels.features || [];
  const maxFeatures = 5000;
  res.json({
    type: "FeatureCollection",
    features: features.slice(0, maxFeatures),
  });
});

// Zoning subset for display
app.get("/api/zoning-geojson", (req, res) => {
  if (!zoningLayer) {
    return res.status(500).json({ error: "Zoning dataset not loaded" });
  }
  const features = zoningLayer.features || [];
  const maxFeatures = 3000;
  res.json({
    type: "FeatureCollection",
    features: features.slice(0, maxFeatures),
  });
});

// Parcel-by-point (click on map)
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
    } catch (_e) {
      continue;
    }
  }

  if (!foundParcel) {
    return res.status(404).json({ error: "No parcel found at this location" });
  }

  const props = foundParcel.properties || {};
  const parcelId = pickParcelId(props);

  const centroid = turf.centerOfMass(foundParcel);
  const [cLng, cLat] = centroid.geometry.coordinates;

  let jurisdiction = pickParcelJurisdiction(props);
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
      } catch (_e) {
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
  }

  let address = null;
  let owner = null;
  try {
    const attrs = await fetchPropertyAttributesByParcelNumber(parcelId);
    if (attrs) {
      address = extractSitusFromAttrs(attrs) || fallbackLocalAddress(props);
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

// Buffer / notice-radius
app.get("/api/buffer-parcels", (req, res) => {
  if (!parcels || !parcels.features) {
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
                    muniFeature.properties || {}
                  );
                  break;
                }
              } catch (_e) {
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

// Powerful search: PCN / address / owner, via remote service + local geometry
app.get("/api/parcel-search", async (req, res) => {
  if (!parcels || !parcels.features) {
    return res.status(500).json({ error: "Parcels dataset not loaded" });
  }

  const qRaw = (req.query.q || "").trim();
  if (!qRaw) {
    return res.status(400).json({ error: "Missing q parameter" });
  }

  let remoteFeatures = [];
  try {
    remoteFeatures = await searchRemoteParcels(qRaw, 10);
  } catch (err) {
    console.error("Remote parcel search error:", err.message);
  }

  if (remoteFeatures && remoteFeatures.length > 0) {
    const bestRemote = remoteFeatures[0];
    const attrs = bestRemote.attributes || {};
    const parcelNumber = attrs.PARCEL_NUMBER || attrs.PARID || null;

    const localParcel =
      parcelNumber ? findLocalParcelByParcelNumber(parcelNumber) : null;

    if (localParcel && localParcel.geometry) {
      const props = localParcel.properties || {};
      const parcelId = parcelNumber || pickParcelId(props);

      const centroid = turf.centerOfMass(localParcel);
      const [cLng, cLat] = centroid.geometry.coordinates;

      let jurisdiction = pickParcelJurisdiction(props);
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
          } catch (_e) {
            continue;
          }
        }
      }
      if (!jurisdiction) {
        jurisdiction = "Palm Beach County (unincorporated)";
      }

      const areaSqMeters = turf.area(localParcel);
      const areaAcres = areaSqMeters / 4046.8564224;

      let zoningCode = "TBD";
      let fluCode = "TBD";
      if (zoningLayer && zoningLayer.features) {
        for (const zFeature of zoningLayer.features) {
          if (!zFeature || !zFeature.geometry) continue;
          try {
            if (turf.booleanIntersects(localParcel, zFeature)) {
              const zProps = zFeature.properties || {};
              zoningCode = pickZoningCode(zProps);
              fluCode = pickZoningFLU(zProps);
              break;
            }
          } catch (_e) {
            continue;
          }
        }
      }

      const address = extractSitusFromAttrs(attrs) || fallbackLocalAddress(props);
      const owner = pickOwnerName(attrs);

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
        geometry: localParcel.geometry,
      });
    }
  }

  // Fallback: local-only search
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

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0].feature;

  const props = best.properties || {};
  const parcelId = pickParcelId(props);

  const centroid = turf.centerOfMass(best);
  const [cLng, cLat] = centroid.geometry.coordinates;

  let jurisdiction = pickParcelJurisdiction(props);
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
      } catch (_e) {
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
  }

  let address = null;
  let owner = null;
  try {
    const attrs = await fetchPropertyAttributesByParcelNumber(parcelId);
    if (attrs) {
      address = extractSitusFromAttrs(attrs) || fallbackLocalAddress(props);
      owner = pickOwnerName(attrs);
    }
  } catch (err) {
    console.error("Error fetching remote property info (fallback search):", err.message);
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

// Autocomplete suggestions using remote Property_Information_Table layer
app.get("/api/parcel-suggest", async (req, res) => {
  const qRaw = (req.query.q || "").trim();
  if (!qRaw || qRaw.length < 2) {
    return res.json([]);
  }

  try {
    const features = await searchRemoteParcels(qRaw, 10);
    const suggestions = (features || []).map((f) => {
      const attrs = f.attributes || {};
      const id = attrs.PARCEL_NUMBER
        ? String(attrs.PARCEL_NUMBER)
        : attrs.PARID
        ? String(attrs.PARID)
        : "UNKNOWN";

      const addr = extractSitusFromAttrs(attrs);
      const owner = pickOwnerName(attrs);

      const parts = [];
      if (addr) parts.push(addr);
      if (owner) parts.push(owner);

      const label = parts.length > 0 ? parts.join(" · ") : id;
      return { id, label };
    });
    return res.json(suggestions);
  } catch (err) {
    console.error("parcel-suggest error:", err.message);
    return res.json([]);
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Map API listening on http://localhost:${PORT}`);
});
