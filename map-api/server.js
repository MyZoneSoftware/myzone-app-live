const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");
const turf = require("@turf/turf");

// Load environment + OpenAI
require("dotenv").config();
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = 5003;

// ---------- FILE PATHS ----------
const boundariesPath = path.join(__dirname, "data", "Municipal_Boundaries.geojson");
const parcelsPath = path.join(__dirname, "data", "Parcels.geojson");
const zoningPath = path.join(__dirname, "data", "Zoning.geojson");

// ---------- EXTERNAL ARCGIS PROPERTY SERVICE ----------
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

  const json = await fetchJson(url);
  if (!json || !Array.isArray(json.features) || json.features.length === 0) {
    return null;
  }
  return json.features[0].attributes || null;
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

// Parcel-by-point
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

// Powerful search: PARID / owner / partial
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

// Autocomplete suggestions
app.get("/api/parcel-suggest", (req, res) => {
  if (!parcels || !parcels.features) {
    return res.json([]);
  }

  const qRaw = (req.query.q || "").trim();
  if (!qRaw || qRaw.length < 2) {
    return res.json([]);
  }

  const q = qRaw.toLowerCase();
  const qDigits = qRaw.replace(/\D/g, "");
  const looksNumeric = /^[0-9]{4,}$/.test(qDigits);

  const suggestions = [];

  for (const feature of parcels.features) {
    if (!feature || !feature.properties) continue;
    const props = feature.properties;
    const id = pickParcelId(props);
    if (!id || id === "UNKNOWN") continue;

    let score = 0;
    const idLower = id.toLowerCase();
    const idDigits = id.replace(/\D/g, "");

    if (looksNumeric && idDigits.startsWith(qDigits)) {
      score = 3;
    } else if (looksNumeric && idDigits.includes(qDigits)) {
      score = 2;
    } else if (idLower.includes(q)) {
      score = 1;
    }

    if (score > 0) {
      const jurisdiction = pickParcelJurisdiction(props) || "Palm Beach County";
      const label = `${id} · ${jurisdiction}`;
      suggestions.push({ id, label, score });
    }

    if (suggestions.length >= 200) {
      break;
    }
  }

  suggestions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const trimmed = suggestions.slice(0, 10).map((s) => ({
    id: s.id,
    label: s.label,
  }));

  return res.json(trimmed);
});

// ---------- SMART CODE AI ENDPOINT ----------
app.post("/api/smart-code", async (req, res) => {
  try {
    const { question, context } = req.body || {};

    if (!question || typeof question !== "string") {
      return res
        .status(400)
        .json({ error: "Missing 'question' string in request body" });
    }

    const ctx = context || {};
    const region = ctx.region || "Palm Beach County, FL";
    const parcel = ctx.parcel || {};
    const jurisdiction = parcel.jurisdiction || "Unknown jurisdiction";
    const zoning = parcel.zoning || "Unknown zoning";
    const flu = parcel.flu || "Unknown FLU";

    const userPrompt = `
You are a professional Florida land-use planner and zoning analyst.
Answer clearly, conservatively, and do NOT give legal advice.

Context:
- Region: ${region}
- Jurisdiction: ${jurisdiction}
- Zoning: ${zoning}
- Future Land Use (FLU): ${flu}

Question:
${question}

Guidelines:
- If you don't know the exact adopted dimensional standards for this jurisdiction, say that clearly.
- You may describe *typical* RS (single-family residential) dimensional standards used in South Florida (lot size, width, setbacks, height, FAR) but label them as "typical" or "example", not official.
- Do not fabricate code section numbers or ordinance references.
- Keep the answer concise and practical, geared to a planner / applicant doing feasibility research.
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a cautious, professional Florida land-use planner AI that helps interpret zoning and development standards. You never give legal advice.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const answer =
      completion.choices?.[0]?.message?.content ||
      "No answer was generated by the smart code service.";

    return res.json({
      answer,
      meta: {
        model: "gpt-4.1-mini",
        region,
        jurisdiction,
        zoning,
        flu,
      },
    });
  } catch (err) {
    console.error("Error in /api/smart-code:", err);
    return res.status(500).json({
      error: "Smart code service failed. Please try again.",
    });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Map API listening on http://localhost:${PORT}`);
});
