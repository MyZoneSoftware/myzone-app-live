const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");

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
    `[parcel-api] Loaded municipal boundaries: ${
      municipalBoundaries.features ? municipalBoundaries.features.length : 0
    } features.`,
  );
  if (municipalBoundaries.features && municipalBoundaries.features.length > 0) {
    console.log(
      "[parcel-api] Sample municipal boundary property keys:",
      Object.keys(municipalBoundaries.features[0].properties || {}),
    );
  }
} catch (err) {
  console.error("[parcel-api] Error loading municipal boundaries:", err.message);
}

try {
  const raw = fs.readFileSync(parcelsPath, "utf8");
  parcels = JSON.parse(raw);
  console.log(
    `[parcel-api] Loaded parcels: ${parcels.features ? parcels.features.length : 0} features.`,
  );
  if (parcels.features && parcels.features.length > 0) {
    console.log(
      "[parcel-api] Sample parcel property keys:",
      Object.keys(parcels.features[0].properties || {}),
    );
  }
} catch (err) {
  console.error("[parcel-api] Error loading parcels:", err.message);
}

try {
  const raw = fs.readFileSync(zoningPath, "utf8");
  zoningLayer = JSON.parse(raw);
  console.log(
    `[parcel-api] Loaded zoning: ${zoningLayer.features ? zoningLayer.features.length : 0} features.`,
  );
  if (zoningLayer.features && zoningLayer.features.length > 0) {
    console.log(
      "[parcel-api] Sample zoning property keys:",
      Object.keys(zoningLayer.features[0].properties || {}),
    );
  }
} catch (err) {
  console.error("[parcel-api] Error loading zoning:", err.message);
}

// ---------- HELPERS (TIED TO YOUR DATA) ----------

function getParcelId(props = {}) {
  if (props.PARID) return String(props.PARID);
  if (props.PCN) return String(props.PCN);
  if (props.OBJECTID != null) return String(props.OBJECTID);
  return "UNKNOWN";
}

function getParcelLabel(props = {}) {
  const id = getParcelId(props);
  if (id && id !== "UNKNOWN") return `Parcel ${id}`;
  return "Parcel";
}

function getMunicipalityNameFromProps(props = {}) {
  if (props.MUNINAME) return props.MUNINAME;
  if (props.NAME) return props.NAME;
  return "Unknown municipality";
}

function getZoningCodeFromProps(props = {}) {
  if (props.FCODE) return props.FCODE;
  if (props.ZONING_DESC) return props.ZONING_DESC;
  return "TBD";
}

function getZoningNameFromProps(props = {}) {
  if (props.ZONING_DESC) return props.ZONING_DESC;
  return "";
}

// Build the parcel response object (shared by point + ID endpoints)
function buildParcelResponse(feature) {
  const props = feature.properties || {};
  const parcelId = getParcelId(props);
  const address = getParcelLabel(props);

  // Centroid (for map zoom)
  let parcelCentroid = null;
  try {
    parcelCentroid = turf.centerOfMass(feature);
  } catch (e) {
    parcelCentroid = turf.centroid(feature);
  }
  let cLat = null;
  let cLng = null;
  if (
    parcelCentroid &&
    parcelCentroid.geometry &&
    Array.isArray(parcelCentroid.geometry.coordinates)
  ) {
    const coords = parcelCentroid.geometry.coordinates;
    cLng = coords[0];
    cLat = coords[1];
  }

  // Jurisdiction
  let jurisdiction = null;
  if (parcelCentroid && municipalBoundaries && municipalBoundaries.features) {
    for (const muniFeature of municipalBoundaries.features) {
      try {
        if (
          muniFeature &&
          muniFeature.geometry &&
          turf.booleanPointInPolygon(parcelCentroid, muniFeature)
        ) {
          jurisdiction = getMunicipalityNameFromProps(
            muniFeature.properties || {},
          );
          break;
        }
      } catch (_e) {
        continue;
      }
    }
  }
  if (
    !jurisdiction ||
    jurisdiction === "Unknown municipality" ||
    jurisdiction === "Unknown Municipality"
  ) {
    jurisdiction = "Palm Beach County (unincorporated)";
  }

  // Area
  let areaAcres = null;
  if (props.ACRES != null) {
    areaAcres = Number(props.ACRES);
  } else {
    const areaSqMeters = turf.area(feature);
    areaAcres = areaSqMeters / 4046.8564224;
  }

  // Zoning
  let zoningCode = "TBD";
  let fluCode = "TBD"; // FLU layer not wired yet

  if (zoningLayer && zoningLayer.features) {
    try {
      if (parcelCentroid) {
        for (const zFeature of zoningLayer.features) {
          if (!zFeature || !zFeature.geometry) continue;
          try {
            if (turf.booleanPointInPolygon(parcelCentroid, zFeature)) {
              const zProps = zFeature.properties || {};
              zoningCode = getZoningCodeFromProps(zProps);
              break;
            }
          } catch (_e) {
            continue;
          }
        }
      }

      if (zoningCode === "TBD") {
        for (const zFeature of zoningLayer.features) {
          if (!zFeature || !zFeature.geometry) continue;
          try {
            if (turf.booleanIntersects(feature, zFeature)) {
              const zProps = zFeature.properties || {};
              zoningCode = getZoningCodeFromProps(zProps);
              break;
            }
          } catch (_e) {
            continue;
          }
        }
      }
    } catch (err) {
      console.error("[parcel-api] Error computing zoning for parcel:", err);
    }
  }

  console.log(
    "[parcel-api] parcel",
    "id:", parcelId,
    "| jurisdiction:", jurisdiction,
    "| zoning:", zoningCode,
    "| acres:", areaAcres,
  );

  return {
    id: parcelId,
    address,
    jurisdiction,
    zoning: zoningCode,
    flu: fluCode,
    areaAcres: Number.isFinite(areaAcres) ? areaAcres : null,
    properties: props,
    geometry: feature.geometry,
    centroid:
      cLat != null && cLng != null ? { lat: cLat, lng: cLng } : null,
  };
}

// ---------- ROUTES ----------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    boundariesLoaded: !!municipalBoundaries,
    parcelsLoaded: !!parcels,
    zoningLoaded: !!zoningLayer,
  });
});

app.get("/api/municipal-boundaries", (req, res) => {
  if (!municipalBoundaries) {
    return res.status(500).json({ error: "Municipal boundaries not loaded" });
  }
  res.json(municipalBoundaries);
});

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
      if (
        feature &&
        feature.geometry &&
        turf.booleanPointInPolygon(point, feature)
      ) {
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

  const response = buildParcelResponse(foundParcel);
  res.json(response);
});

// ---------- PARCEL-BY-ID ----------
app.get("/api/parcel-by-id", (req, res) => {
  if (!parcels || !parcels.features) {
    return res.status(500).json({ error: "Parcels dataset not loaded" });
  }

  const paridRaw = (req.query.parid || "").trim();
  if (!paridRaw) {
    return res.status(400).json({ error: "parid query parameter is required" });
  }

  const paridNorm = paridRaw.replace(/\s+/g, "");

  let foundParcel = null;
  for (const feature of parcels.features) {
    const props = feature.properties || {};
    const featureParid = props.PARID ? String(props.PARID).replace(/\s+/g, "") : null;

    if (featureParid && featureParid === paridNorm) {
      foundParcel = feature;
      break;
    }
  }

  if (!foundParcel) {
    return res.status(404).json({ error: "No parcel found with that PARID" });
  }

  const response = buildParcelResponse(foundParcel);
  res.json(response);
});

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
      if (
        feature &&
        feature.geometry &&
        turf.booleanPointInPolygon(point, feature)
      ) {
        foundFeature = feature;
        break;
      }
    } catch (_e) {
      continue;
    }
  }

  if (!foundFeature) {
    return res.status(404).json({ error: "No zoning polygon found at this location" });
  }

  const zProps = foundFeature.properties || {};
  const zoningCode = getZoningCodeFromProps(zProps);
  const zoningName = getZoningNameFromProps(zProps);

  res.json({
    zoningCode,
    zoningName,
    properties: zProps,
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`[parcel-api] listening on http://localhost:${PORT}`);
});
