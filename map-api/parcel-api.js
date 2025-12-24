/**
 * MyZone – ArcGIS Unified Parcel API
 * Palm Beach County
 */

const express = require("express");
const cors = require("cors");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const turf = require("@turf/turf");

const app = express();
const PORT = 5003;

app.use(cors());
app.use(express.json());

// ---------------- CONFIG ----------------
const ARCGIS_BASE =
  "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_Local_Prj/FeatureServer/0/query";

// ---------------- HELPERS ----------------
function arcgisQuery(params) {
  const qs = new URLSearchParams({
    f: "json",
    outFields: "*",
    outSR: 4326,
    returnGeometry: true,
    ...params,
  });
  return `${ARCGIS_BASE}?${qs.toString()}`;
}

function normalizeParcel(feature) {
  const p = feature.attributes || {};
  const geom = feature.geometry;

  let centroid = null;
  try {
    const g = turf.centroid(feature);
    centroid = { lat: g.geometry.coordinates[1], lng: g.geometry.coordinates[0] };
  } catch {}

  return {
    id: p.PARID || p.PARCEL_NUMBER || p.OBJECTID,
    address: p.SITE_ADDR_STR || "—",
    jurisdiction: p.MUNICIPALITY || p.CITYNAME || "Palm Beach County",
    zoning: p.ZONING || "TBD",
    flu: "TBD",
    owner: p.OWNER_NAME1 || "",
    areaAcres: p.ACRES || null,
    geometry: geom,
    lat: centroid?.lat,
    lng: centroid?.lng,
    properties: p,
  };
}

// ---------------- ROUTES ----------------

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "arcgis-parcel-api" });
});

// ---------- SEARCH (PCN / ADDRESS / CITY) ----------
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Missing search query" });

  const where = `
    PARID LIKE '%${q}%'
    OR PARCEL_NUMBER LIKE '%${q}%'
    OR SITE_ADDR_STR LIKE '%${q}%'
    OR MUNICIPALITY LIKE '%${q}%'
    OR CITYNAME LIKE '%${q}%'
  `;

  const url = arcgisQuery({ where });

  const r = await fetch(url);
  const j = await r.json();

  if (!j.features || j.features.length === 0) {
    return res.status(404).json({ error: "No parcels found" });
  }

  const parcels = j.features.map(normalizeParcel);
  res.json(parcels);
});

// ---------- PARCEL BY ID ----------
app.get("/api/parcel-by-id", async (req, res) => {
  const id = String(req.query.parid || "").trim();
  if (!id) return res.status(400).json({ error: "Missing parid" });

  const where = `PARID='${id}' OR PARCEL_NUMBER='${id}'`;
  const url = arcgisQuery({ where });

  const r = await fetch(url);
  const j = await r.json();

  if (!j.features || !j.features.length) {
    return res.status(404).json({ error: "Parcel not found" });
  }

  res.json(normalizeParcel(j.features[0]));
});

// ---------- PARCEL BY MAP CLICK ----------
app.get("/api/parcel-by-point", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Invalid lat/lng" });
  }

  const geometry = {
    x: lng,
    y: lat,
    spatialReference: { wkid: 4326 },
  };

  const url = arcgisQuery({
    geometry: JSON.stringify(geometry),
    geometryType: "esriGeometryPoint",
    spatialRel: "esriSpatialRelIntersects",
  });

  const r = await fetch(url);
  const j = await r.json();

  if (!j.features || !j.features.length) {
    return res.status(404).json({ error: "No parcel found at location" });
  }

  res.json(normalizeParcel(j.features[0]));
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`[arcgis-api] running on http://localhost:${PORT}`);
});
