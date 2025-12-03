const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");

const app = express();
const PORT = 5004;

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
    `[id-api] Loaded municipal boundaries: ${
      municipalBoundaries.features ? municipalBoundaries.features.length : 0
    } features.`,
  );
} catch (err) {
  console.error("[id-api] Error loading municipal boundaries:", err.message);
}

try {
  const raw = fs.readFileSync(parcelsPath, "utf8");
  parcels = JSON.parse(raw);
  console.log(
    `[id-api] Loaded parcels: ${parcels.features ? parcels.features.length : 0} features.`,
  );
} catch (err) {
  console.error("[id-api] Error loading parcels:", err.message);
}

try {
  const raw = fs.readFileSync(zoningPath, "utf8");
  zoningLayer = JSON.parse(raw);
  console.log(
    `[id-api] Loaded zoning: ${zoningLayer.features ? zoningLayer.features.length : 0} features.`,
  );
} catch (err) {
  console.error("[id-api] Error loading zoning:", err.message);
}

// ---------- HELPERS ----------
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

function buildParcelResponse(feature) {
  const props = feature.properties || {};
  const parcelId = getParcelId(props);
  const address = getParcelLabel(props);

  // Centroid
  let centroidFeature;
  try {
    centroidFeature = turf.centerOfMass(feature);
  } catch (e) {
    centroidFeature = turf.centroid(feature);
  }

  let cLat = null;
  let cLng = null;
  if (
    centroidFeature &&
    centroidFeature.geometry &&
    Array.isArray(centroidFeature.geometry.coordinates)
  ) {
    const coords = centroidFeature.geometry.coordinates;
    cLng = coords[0];
    cLat = coords[1];
  }

  // Jurisdiction
  let jurisdiction = null;
  if (centroidFeature && municipalBoundaries && municipalBoundaries.features) {
    for (const muniFeature of municipalBoundaries.features) {
      try {
        if (
          muniFeature &&
          muniFeature.geometry &&
          turf.booleanPointInPolygon(centroidFeature, muniFeature)
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
  if (zoningLayer && zoningLayer.features && centroidFeature) {
    try {
      for (const zFeature of zoningLayer.features) {
        if (!zFeature || !zFeature.geometry) continue;
        try {
          if (turf.booleanPointInPolygon(centroidFeature, zFeature)) {
            const zProps = zFeature.properties || {};
            zoningCode = getZoningCodeFromProps(zProps);
            break;
          }
        } catch (_e) {
          continue;
        }
      }
    } catch (err) {
      console.error("[id-api] Error computing zoning for parcel:", err);
    }
  }

  console.log(
    "[id-api] parcel",
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
    flu: "TBD", // FLU not wired yet
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

// PARCEL-BY-ID: ?parid=70434418010000090
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

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`[id-api] listening on http://localhost:${PORT}`);
});
