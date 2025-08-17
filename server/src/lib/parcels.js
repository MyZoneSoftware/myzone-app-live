const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");

const DATA_PATH = path.join(__dirname, "../../data/parcels.geojson");

let _geo = null;
function load() {
  if (!_geo) {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    _geo = JSON.parse(raw);
  }
  return _geo;
}

function allFeatures() {
  const geo = load();
  return Array.isArray(geo.features) ? geo.features : [];
}

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

function findByParcelId(id) {
  const target = normalize(id);
  return allFeatures().filter(f => normalize(f.properties?.parcel_id) === target);
}

function searchByAddress(q) {
  const needle = normalize(q);
  return allFeatures().filter(f => normalize(f.properties?.address).includes(needle));
}

function findByPoint(lon, lat) {
  const pt = turf.point([lon, lat]);
  return allFeatures().filter(f => {
    try {
      const poly = turf.feature(f.geometry);
      return turf.booleanPointInPolygon(pt, poly);
    } catch {
      return false;
    }
  });
}

function findByPolygon(polygonGeoJSON) {
  const poly = turf.feature(polygonGeoJSON);
  return allFeatures().filter(f => {
    try {
      const parcel = turf.feature(f.geometry);
      return turf.booleanIntersects(parcel, poly);
    } catch {
      return false;
    }
  });
}

// Map feature -> API response object(s)
function toSearchCards(features) {
  return features.map(f => ({
    type: "parcel",
    title: `${f.properties?.parcel_id} — ${f.properties?.address || ""}`,
    snippet: `Zoning: ${f.properties?.zoning || "N/A"}`
  }));
}

function toParcelTable(features) {
  return features.map(f => ({
    parcel_id: f.properties?.parcel_id || "",
    address: f.properties?.address || "",
    zoning: f.properties?.zoning || "",
    ldc: f.properties?.ldc || ""
  }));
}

module.exports = {
  load,
  allFeatures,
  findByParcelId,
  searchByAddress,
  findByPoint,
  findByPolygon,
  toSearchCards,
  toParcelTable
};

function toSearchCards(features) {
  return features.map(f => {
    const pid = String(f.properties?.parcel_id || "");
    const addr = String(f.properties?.address || "");
    const zoning = String(f.properties?.zoning || "N/A");
    return {
      type: "parcel",
      id: pid,
      title: pid + " — " + addr,
      snippet: "Zoning: " + zoning
    };
  });
}
