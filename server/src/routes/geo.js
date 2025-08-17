const express = require("express");
const {
  findByParcelId,
  searchByAddress,
  findByPoint,
  findByPolygon,
  toSearchCards,
  toParcelTable
} = require("../lib/parcels");

const router = express.Router();

/**
 * GET /api/geo/search?parcel=ID
 * GET /api/geo/search?address=TEXT
 * Returns: { results: [cards...] }
 */
router.get("/search", (req, res) => {
  const { parcel, address } = req.query;

  let matches = [];
  if (parcel) {
    matches = findByParcelId(parcel);
  } else if (address) {
    matches = searchByAddress(address);
  } else {
    return res.json({ results: [] });
  }

  return res.json({ results: toSearchCards(matches).slice(0, 20) });
});

/**
 * POST /api/geo/by-coordinates
 * body: { lon: number, lat: number }
 * Returns: { parcels: [{ parcel_id, address, zoning, ldc }, ...] }
 */
router.post("/by-coordinates", (req, res) => {
  const lon = Number(req.body?.lon);
  const lat = Number(req.body?.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return res.status(400).json({ error: "Invalid lon/lat" });
  }
  const matches = findByPoint(lon, lat);
  return res.json({ parcels: toParcelTable(matches) });
});

/**
 * POST /api/geo/by-polygon
 * body: { polygon: GeoJSON Polygon }  // e.g., {"type":"Polygon","coordinates":[[...]]}
 * Returns: { parcels: [{...}] }
 */
router.post("/by-polygon", (req, res) => {
  const polygon = req.body?.polygon;
  if (!polygon || polygon.type !== "Polygon") {
    return res.status(400).json({ error: "polygon (GeoJSON Polygon) required" });
  }
  const matches = findByPolygon(polygon);
  return res.json({ parcels: toParcelTable(matches) });
});

module.exports = router;
