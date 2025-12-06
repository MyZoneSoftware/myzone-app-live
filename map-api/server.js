const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");
const OpenAI = require("openai");

try {
  require("dotenv").config();
} catch (_) {}

const app = express();
const PORT = 5003;

app.use(cors());
app.use(express.json());

// ---------- FILE PATHS ----------
const boundariesPath = path.join(__dirname, "data", "municipal_boundaries.geojson");
const parcelsPath = path.join(__dirname, "data", "parcels.geojson");
const zoningPath = path.join(__dirname, "data", "zoning.geojson");

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
      "Sample municipal boundaries property keys:",
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
      "Sample parcels property keys:",
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

// ---------- HELPERS ----------

function pickParcelId(props = {}) {
  const candidateKeys = [
    "PCN",
    "PARID",
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

function pickParcelAddress(props = {}) {
  const candidateKeys = [
    "SITE_ADDR",
    "SITE_ADDR_STR",
    "SITEADD",
    "SITUS",
    "ADDRESS",
    "ADDR",
    "PROP_ADDR",
    "LOCATION",
  ];
  for (const key of candidateKeys) {
    if (props[key]) return props[key];
  }
  const addrKey = Object.keys(props).find((k) =>
    k.toLowerCase().includes("addr"),
  );
  if (addrKey && props[addrKey]) return props[addrKey];

  const id = pickParcelId(props);
  if (id && id !== "UNKNOWN") return `Parcel ${id}`;

  return "Parcel";
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

// Zoning helpers
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

// ---------- ROUTES ----------

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    boundariesLoaded: !!municipalBoundaries,
    parcelsLoaded: !!parcels,
    zoningLoaded: !!zoningLayer,
  });
});

// Municipal boundaries GeoJSON
app.get("/api/municipal-boundaries", (req, res) => {
  if (!municipalBoundaries) {
    return res.status(500).json({ error: "Municipal boundaries not loaded" });
  }
  res.json(municipalBoundaries);
});

// Parcels GeoJSON – limited sample for display
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

// Zoning GeoJSON – limited sample for display
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

// Parcel-by-point – compute jurisdiction + zoning for the parcel
app.get("/api/parcel-by-point", (req, res) => {
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
  const parcelId = pickParcelId(props);
  const address = pickParcelAddress(props);

  let jurisdiction = pickParcelJurisdiction(props);

  if (!jurisdiction && municipalBoundaries && municipalBoundaries.features) {
    const centroid = turf.centerOfMass(foundParcel);
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

  const centroid = turf.centerOfMass(foundParcel);
  const [cLng, cLat] = centroid.geometry.coordinates;

  res.json({
    id: parcelId,
    address,
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

// Zoning-by-point (debug)
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

// Municipality-by-point
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
// Now buffers from the parcel polygon, not just the click point.
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

    const clickPoint = turf.point([lng, lat]);
    let targetParcel = null;

    // First: find the parcel at the click/selected point
    for (const feature of parcels.features) {
      if (!feature || !feature.geometry) continue;
      try {
        if (turf.booleanPointInPolygon(clickPoint, feature)) {
          targetParcel = feature;
          break;
        }
      } catch {
        continue;
      }
    }

    let bufferPolygon = null;
    let bufferCenter = { lat, lng };

    if (targetParcel) {
      // Buffer the entire parcel polygon (property line)
      bufferPolygon = turf.buffer(targetParcel, radiusMiles, { units: "miles" });
      const cen = turf.centerOfMass(targetParcel);
      const [cLng, cLat] = cen.geometry.coordinates;
      bufferCenter = { lat: cLat, lng: cLng };
    } else {
      // Fallback: buffer around the click point
      bufferPolygon = turf.buffer(clickPoint, radiusMiles, { units: "miles" });
    }

    const results = [];
    const maxParcels = 500;

    for (const feature of parcels.features) {
      if (!feature || !feature.geometry) continue;

      try {
        if (turf.booleanIntersects(feature, bufferPolygon)) {
          const props = feature.properties || {};
          const id = pickParcelId(props);
          const address = pickParcelAddress(props);

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
      center: bufferCenter,
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

// ---------- SMART CODE (OpenAI zoning helper) ----------
const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

app.post("/api/smart-code", async (req, res) => {
  if (!openai) {
    return res.status(503).json({
      error: "Smart code service is not configured. Missing OPENAI_API_KEY.",
    });
  }

  const { question, context } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Missing 'question' in request body." });
  }

  try {
    const messages = [
      {
        role: "system",
        content:
          "You are MyZone's planning assistant. Provide clear, concise explanations of zoning, " +
          "future land use, dimensional standards, and entitlement considerations for Florida jurisdictions. " +
          "You are NOT an official source. Always remind the user to verify with the adopted code and " +
          "local government. Do not make up specific numeric standards if you are not certain — instead describe " +
          "typical ranges and advise checking the code.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            question,
            context: context || null,
          },
          null,
          2,
        ),
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.4,
    });

    const answer =
      completion.choices?.[0]?.message?.content ||
      "I was unable to generate an answer. Please verify your question and try again.";

    res.json({ answer });
  } catch (err) {
    console.error("Error in /api/smart-code:", err);
    res.status(500).json({
      error: "Error while generating smart code answer.",
      detail: err.message || String(err),
    });
  }
});

// ---------- JURISDICTION PROFILE (STATIC SMART-EXPLAIN HELP) ----------
/**
 * POST /api/jurisdiction-profile
 * Body: { jurisdiction, zoning, flu }
 *
 * Returns a general, non-official summary of zoning / FLU context for a few
 * supported jurisdictions, starting with Village of Royal Palm Beach (RS).
 */
app.post("/api/jurisdiction-profile", (req, res) => {
  const { jurisdiction, zoning, flu } = req.body || {};

  const j = (jurisdiction || "").toLowerCase();
  const z = (zoning || "").toLowerCase();
  const f = (flu || "").toLowerCase();

  let profile = null;

  // Village of Royal Palm Beach · RS-type zoning (generalized)
  if (j.includes("royal palm beach") && z.startsWith("rs")) {
    profile = {
      jurisdiction: jurisdiction || "Village of Royal Palm Beach",
      zoning: zoning || "RS",
      flu: flu || null,
      summary:
        "RS in the Village of Royal Palm Beach generally functions as a low-density single-family residential district. " +
        "It is intended to maintain a stable, predominantly detached single-family neighborhood pattern with supporting civic and recreation uses.",
      typicalUses: [
        "Detached single-family dwellings",
        "Customary residential accessory uses (pools, sheds, patios) subject to standards",
        "Public and civic uses compatible with neighborhoods (parks, schools, places of worship) – often by special approval",
        "Limited home occupations subject to performance standards",
      ],
      dimensionalSummary:
        "Dimensional standards in RS districts typically include minimum lot sizes, minimum lot widths, and front/side/rear setbacks, " +
        "with maximum building heights intended to maintain a neighborhood scale (often one- to two-story structures). " +
        "Exact numeric standards must be taken from the adopted zoning code.",
      notes:
        "For a specific parcel in Royal Palm Beach, confirm whether there are any PUDs, overlays, special exceptions, or variances that modify the base RS standards. " +
        "Check future land use (FLU), subdivision approvals, and any recorded development orders.",
      disclaimer:
        "This profile is for general planning orientation only and is not a substitute for the adopted zoning ordinance, " +
        "land development regulations, or an official zoning verification from the Village of Royal Palm Beach or Palm Beach County.",
    };
  }

  if (!profile) {
    return res.json({
      jurisdiction: jurisdiction || null,
      zoning: zoning || null,
      flu: flu || null,
      summary:
        "MyZone does not yet have a detailed profile for this jurisdiction / zoning combination. " +
        "Use this as a prompt to consult the adopted zoning and land development regulations.",
      typicalUses: [],
      dimensionalSummary: "",
      notes:
        "As MyZone grows, more Florida jurisdictions and zoning districts will receive curated profiles to assist with feasibility and entitlement questions.",
      disclaimer:
        "All information is for general planning orientation only and must be verified against the adopted zoning and land development regulations.",
    });
  }

  return res.json(profile);
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Map API listening on http://localhost:${PORT}`);
});

// ---------- JURISDICTION PROFILE (SAFE FALLBACK, GET+POST) ----------
/**
 * Handles both POST and GET:
 *  - POST body: { jurisdiction, zoning, flu }
 *  - GET  query: ?jurisdiction=...&zoning=...&flu=...
 *
 * Starts with a curated profile for:
 *   • Village of Royal Palm Beach – RS (single-family residential)
 * and falls back to a generic message for anything else.
 */
app.all("/api/jurisdiction-profile", (req, res) => {
  const body = req.body || {};
  const q = req.query || {};

  const jurisdictionRaw = body.jurisdiction || q.jurisdiction || "";
  const zoningRaw = body.zoning || q.zoning || "";
  const fluRaw = body.flu || q.flu || "";

  const jurisdiction = String(jurisdictionRaw || "").trim();
  const zoning = String(zoningRaw || "").trim();
  const flu = String(fluRaw || "").trim();

  const j = jurisdiction.toLowerCase();
  const z = zoning.toLowerCase();

  let profile = null;

  // Village of Royal Palm Beach · RS-type zoning (generalized, not official)
  if (j.includes("royal palm beach") && z.startsWith("rs")) {
    profile = {
      jurisdiction: jurisdiction || "Village of Royal Palm Beach",
      zoning: zoning || "RS",
      flu: flu || null,
      summary:
        "RS in the Village of Royal Palm Beach generally functions as a low-density single-family residential district. " +
        "It is intended to maintain a stable, predominantly detached single-family neighborhood pattern with supporting civic and recreation uses.",
      typicalUses: [
        "Detached single-family dwellings",
        "Customary residential accessory uses (pools, sheds, patios) subject to standards",
        "Public and civic uses compatible with neighborhoods (parks, schools, places of worship) – often by special approval",
        "Limited home occupations subject to performance standards"
      ],
      dimensionalSummary:
        "Dimensional standards in RS districts typically include minimum lot sizes, minimum lot widths, and front/side/rear setbacks, " +
        "with maximum building heights intended to maintain a neighborhood scale (often one- to two-story structures). " +
        "Exact numeric standards must be taken from the adopted zoning code.",
      notes:
        "For a specific parcel in Royal Palm Beach, confirm whether there are any PUDs, overlays, special exceptions, or variances that modify the base RS standards. " +
        "Check future land use (FLU), subdivision approvals, and any recorded development orders.",
      disclaimer:
        "This profile is for general planning orientation only and is not a substitute for the adopted zoning ordinance, " +
        "land development regulations, or an official zoning verification from the Village of Royal Palm Beach or Palm Beach County."
    };
  }

  // Generic fallback if we don't have a curated profile yet
  if (!profile) {
    profile = {
      jurisdiction: jurisdiction || null,
      zoning: zoning || null,
      flu: flu || null,
      summary:
        "MyZone does not yet have a detailed profile for this jurisdiction / zoning combination. " +
        "Use this as a prompt to consult the adopted zoning and land development regulations.",
      typicalUses: [],
      dimensionalSummary: "",
      notes:
        "As MyZone grows, more Florida jurisdictions and zoning districts will receive curated profiles to assist with feasibility and entitlement questions.",
      disclaimer:
        "All information is for general planning orientation only and must be verified against the adopted zoning and land development regulations."
    };
  }

  return res.json(profile);
});

// ---------- DEBUG: confirm server.js being used ----------
app.get("/api/__jp-debug", (req, res) => {
  res.json({
    ok: true,
    message: "jurisdiction-profile debug route is active from server.js",
    timestamp: new Date().toISOString()
  });
});

// ---------- PARCEL BY ID (PCN / PARID) ----------
/**
 * GET /api/parcel-by-id?parid=70434418010000090
 *
 * Looks up a parcel from the loaded parcels dataset using common PCN / parcel
 * fields, enriches it with jurisdiction + zoning + FLU, and returns a shape
 * compatible with the parcel-by-point response, plus lat/lng centroid.
 */
app.get("/api/parcel-by-id", (req, res) => {
  if (!parcels || !parcels.features) {
    return res
      .status(500)
      .json({ error: "Parcels dataset not loaded" });
  }

  const rawInput =
    (req.query.parid || req.query.id || "").toString().trim();

  if (!rawInput) {
    return res
      .status(400)
      .json({ error: "Missing parid query parameter" });
  }

  // Normalize: strip non-digits so "70-4344-..." still matches
  const cleanInput = rawInput.replace(/\D/g, "");
  let foundParcel = null;

  for (const feature of parcels.features) {
    if (!feature || !feature.properties) continue;
    const props = feature.properties;

    const candidates = [
      props.PARID,
      props.PARCEL_NUMBER,
      props.PARCELID,
      props.PARCEL_ID,
    ];

    let matched = false;
    for (const val of candidates) {
      if (val == null) continue;
      const clean = String(val).replace(/\D/g, "");
      if (clean && clean === cleanInput) {
        matched = true;
        break;
      }
    }

    if (matched) {
      foundParcel = feature;
      break;
    }
  }

  if (!foundParcel) {
    return res
      .status(404)
      .json({ error: "No parcel found for that id" });
  }

  const props = foundParcel.properties || {};
  const parcelId = pickParcelId(props);
  const address = pickParcelAddress(props);

  // Jurisdiction: from parcel props first
  let jurisdiction = pickParcelJurisdiction(props);

  // If missing, intersect municipal boundaries using parcel centroid
  if (!jurisdiction && municipalBoundaries && municipalBoundaries.features) {
    try {
      const centroid = turf.centerOfMass(foundParcel);
      for (const muniFeature of municipalBoundaries.features) {
        if (
          !muniFeature ||
          !muniFeature.geometry
        ) {
          continue;
        }
        try {
          if (turf.booleanPointInPolygon(centroid, muniFeature)) {
            jurisdiction = pickMunicipalityName(
              muniFeature.properties || {},
            );
            break;
          }
        } catch (_e) {
          // ignore bad geometries
        }
      }
    } catch (err) {
      console.error("Error computing jurisdiction for parcel-by-id:", err);
    }
  }

  if (!jurisdiction) {
    jurisdiction = "Palm Beach County (unincorporated)";
  }

  // Area
  let areaAcres = null;
  try {
    const areaSqMeters = turf.area(foundParcel);
    areaAcres = areaSqMeters / 4046.8564224;
  } catch (_e) {
    areaAcres = null;
  }

  // Zoning + FLU by intersecting parcel geometry with zoning layer
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
        } catch (_innerErr) {
          continue;
        }
      }
    } catch (err) {
      console.error("Error computing zoning for /api/parcel-by-id:", err);
    }
  }

  // Centroid for map centering
  let lat = null;
  let lng = null;
  try {
    const centroid = turf.centerOfMass(foundParcel);
    if (
      centroid &&
      centroid.geometry &&
      Array.isArray(centroid.geometry.coordinates)
    ) {
      lng = centroid.geometry.coordinates[0];
      lat = centroid.geometry.coordinates[1];
    }
  } catch (err) {
    console.error("Error computing centroid for /api/parcel-by-id:", err);
  }

  return res.json({
    id: parcelId,
    address,
    jurisdiction,
    zoning: zoningCode,
    flu: fluCode,
    areaAcres: Number.isFinite(areaAcres) ? areaAcres : null,
    lat,
    lng,
    properties: props,
    geometry: foundParcel.geometry,
  });
});
