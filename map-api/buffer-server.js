const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");

const app = express();
const PORT = 5002;

app.use(cors());
app.use(express.json());

// ---------- FILE PATHS ----------
const boundariesPath = path.join(__dirname, "data", "municipal_boundaries.geojson");
const parcelsPath = path.join(__dirname, "data", "parcels.geojson");

// ---------- LOAD DATA ----------
let municipalBoundaries = null;
let parcels = null;

try {
  const raw = fs.readFileSync(boundariesPath, "utf8");
  municipalBoundaries = JSON.parse(raw);
  console.log(
    `Buffer API: loaded municipal boundaries: ${
      municipalBoundaries.features ? municipalBoundaries.features.length : 0
    } features.`,
  );
} catch (err) {
  console.error("Buffer API: error loading municipal boundaries:", err.message);
}

try {
  const raw = fs.readFileSync(parcelsPath, "utf8");
  parcels = JSON.parse(raw);
  console.log(
    `Buffer API: loaded parcels: ${parcels.features ? parcels.features.length : 0} features.`,
  );
} catch (err) {
  console.error("Buffer API: error loading parcels:", err.message);
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

// ---------- ROUTES ----------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    parcelsLoaded: !!parcels,
    boundariesLoaded: !!municipalBoundaries,
  });
});

// Buffer / notice-radius endpoint
app.get("/api/buffer-parcels", (req, res) => {
  console.log("Buffer API: /api/buffer-parcels hit with", req.query);

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
      center: { lat, lng },
      radiusFeet,
      buffer: bufferPolygon,
      count: results.length,
      parcels: results,
      error: null,
    });
  } catch (err) {
    console.error("Buffer API error:", err);
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

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`Buffer API listening on http://localhost:${PORT}`);
});
