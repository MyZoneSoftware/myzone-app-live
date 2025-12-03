const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");

const app = express();
const PORT = 5001;

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

console.log("USING CLEAN NEW server.js");

// ---------- HELPERS (TIED TO YOUR DATA) ----------

// Parcel ID: strongly prefer PARID
function getParcelId(props = {}) {
  if (props.PARID) return String(props.PARID);
  if (props.PCN) return String(props.PCN);
  if (props.OBJECTID != null) return String(props.OBJECTID);
  return "UNKNOWN";
}

// Label: your parcels have no address fields, so use Parcel + PARID
function getParcelLabel(props = {}) {
  const id = getParcelId(props);
  if (id && id !== "UNKNOWN") return `Parcel ${id}`;
  return "Parcel";
}

// Municipality name from boundaries (MUNINAME is key in your data)
function getMunicipalityNameFromProps(props = {}) {
  if (props.MUNINAME) return props.MUNINAME;
  if (props.NAME) return props.NAME;
  return "Unknown municipality";
}

// Zoning: FCODE + ZONING_DESC in your zoning layer
function getZoningCodeFromProps(props = {}) {
  if (props.FCODE) return props.FCODE;
  if (props.ZONING_DESC) return props.ZONING_DESC;
  return "TBD";
}

function getZoningNameFromProps(props = {}) {
  if (props.ZONING_DESC) return props.ZONING_DESC;
  return "";
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

// ---------- PARCEL-BY-POINT (MAIN CLICK ENDPOINT) ----------
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

  // 1) Find the parcel polygon containing the point
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

  const props = foundParcel.properties || {};
  const parcelId = getParcelId(props);
  const address = getParcelLabel(props);

  // 2) Jurisdiction from municipal boundaries using parcel centroid
  let jurisdiction = null;
  let parcelCentroid = null;

  try {
    parcelCentroid = turf.centerOfMass(foundParcel);
  } catch (e) {
    parcelCentroid = turf.centroid(foundParcel);
  }

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

  // Clean fallback: never send "Unknown municipality" to the UI
  if (
    !jurisdiction ||
    jurisdiction === "Unknown municipality" ||
    jurisdiction === "Unknown Municipality"
  ) {
    jurisdiction = "Palm Beach County (unincorporated)";
  }

  // 3) Area – use ACRES field if present, else turf.area
  let areaAcres = null;
  if (props.ACRES != null) {
    areaAcres = Number(props.ACRES);
  } else {
    const areaSqMeters = turf.area(foundParcel);
    areaAcres = areaSqMeters / 4046.8564224;
  }

  // 4) Zoning: zoning polygons intersecting the parcel polygon
  let zoningCode = "TBD";
  let fluCode = "TBD"; // FLU layer not wired yet

  if (zoningLayer && zoningLayer.features) {
    try {
      // First pass: centroid inside zoning polygon
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

      // Second pass: intersects parcel polygon (catch slivers/edges)
      if (zoningCode === "TBD") {
        for (const zFeature of zoningLayer.features) {
          if (!zFeature || !zFeature.geometry) continue;
          try {
            if (turf.booleanIntersects(foundParcel, zFeature)) {
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
      console.error("Error computing zoning for parcel:", err);
    }
  }

  // Debug log for you in the terminal
  console.log(
    "parcel-by-point",
    "id:", parcelId,
    "| jurisdiction:", jurisdiction,
    "| zoning:", zoningCode,
    "| acres:", areaAcres,
  );

  res.json({
    id: parcelId,
    address,
    jurisdiction,
    zoning: zoningCode,
    flu: fluCode,
    areaAcres: Number.isFinite(areaAcres) ? areaAcres : null,
    properties: props,
    geometry: foundParcel.geometry,
  });
});

// ---------- OPTIONAL: ZONING-BY-POINT FOR DEBUGGING ----------
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
  console.log(`Map API listening on http://localhost:${PORT}`);
});

// ---------- PARCEL-BY-POINT (MAIN CLICK ENDPOINT) ----------
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

  // 1) Find the parcel polygon containing the point
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

  const props = foundParcel.properties || {};

  // --- PARCEL ID + LABEL ---
  const parcelId = props.PARID
    ? String(props.PARID)
    : props.PCN
    ? String(props.PCN)
    : props.OBJECTID != null
    ? String(props.OBJECTID)
    : "UNKNOWN";

  const address =
    parcelId !== "UNKNOWN" ? `Parcel ${parcelId}` : "Parcel";

  // --- JURISDICTION (from municipal boundaries) ---
  let jurisdiction = null;
  let parcelCentroid = null;

  try {
    parcelCentroid = turf.centerOfMass(foundParcel);
  } catch (e) {
    parcelCentroid = turf.centroid(foundParcel);
  }

  if (parcelCentroid && municipalBoundaries && municipalBoundaries.features) {
    for (const muniFeature of municipalBoundaries.features) {
      try {
        if (
          muniFeature &&
          muniFeature.geometry &&
          turf.booleanPointInPolygon(parcelCentroid, muniFeature)
        ) {
          const mProps = muniFeature.properties || {};
          jurisdiction =
            mProps.MUNINAME ||
            mProps.NAME ||
            "Unknown municipality";
          break;
        }
      } catch (_e) {
        continue;
      }
    }
  }

  // Clean fallback: never send "Unknown municipality" to the UI
  if (
    !jurisdiction ||
    jurisdiction === "Unknown municipality" ||
    jurisdiction === "Unknown Municipality"
  ) {
    jurisdiction = "Palm Beach County (unincorporated)";
  }

  // --- AREA ---
  let areaAcres = null;
  if (props.ACRES != null) {
    areaAcres = Number(props.ACRES);
  } else {
    const areaSqMeters = turf.area(foundParcel);
    areaAcres = areaSqMeters / 4046.8564224;
  }

  // --- ZONING (from zoning polygons) ---
  let zoningCode = "TBD";
  let fluCode = "TBD"; // we don't have FLU wired yet

  if (zoningLayer && zoningLayer.features) {
    try {
      // Pass 1: centroid inside zoning polygon
      if (parcelCentroid) {
        for (const zFeature of zoningLayer.features) {
          if (!zFeature || !zFeature.geometry) continue;
          try {
            if (turf.booleanPointInPolygon(parcelCentroid, zFeature)) {
              const zProps = zFeature.properties || {};
              zoningCode =
                zProps.FCODE ||
                zProps.ZONING_DESC ||
                "TBD";
              break;
            }
          } catch (_e) {
            continue;
          }
        }
      }

      // Pass 2: intersects parcel polygon (fallback)
      if (zoningCode === "TBD") {
        for (const zFeature of zoningLayer.features) {
          if (!zFeature || !zFeature.geometry) continue;
          try {
            if (turf.booleanIntersects(foundParcel, zFeature)) {
              const zProps = zFeature.properties || {};
              zoningCode =
                zProps.FCODE ||
                zProps.ZONING_DESC ||
                "TBD";
              break;
            }
          } catch (_e) {
            continue;
          }
        }
      }
    } catch (err) {
      console.error("Error computing zoning for parcel:", err);
    }
  }

  console.log(
    "parcel-by-point",
    "id:", parcelId,
    "| jurisdiction:", jurisdiction,
    "| zoning:", zoningCode,
    "| acres:", areaAcres
  );

  res.json({
    id: parcelId,
    address,
    jurisdiction,
    zoning: zoningCode,
    flu: fluCode,
    areaAcres: Number.isFinite(areaAcres) ? areaAcres : null,
    properties: props,
    geometry: foundParcel.geometry,
  });
});
