const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

/* -----------------------------
   Load parcels_enriched.geojson
----------------------------- */
const DATA_PATH = path.join(__dirname, "..", "..", "data", "parcels_enriched.geojson");

let parcels = [];
try {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const json = JSON.parse(raw);
  parcels = json.features || [];
  console.log(`[search] Loaded ${parcels.length} parcels`);
} catch (err) {
  console.error("[search] Failed to load parcels_enriched.geojson", err);
}

/* -----------------------------
   GET /api/search/parcel?q=ID
   Canonical Parcel ID = properties.id
----------------------------- */
router.get("/parcel", (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.status(400).json({ error: "Missing query" });
  }

  const match = parcels.find(
    (f) => String(f?.properties?.id) === q
  );

  if (!match) {
    return res.status(404).json({ error: "No parcel found for that search" });
  }

  res.json({ feature: match });
});

/* -----------------------------
   GET /api/search?q=...
----------------------------- */
router.get("/", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json({ results: [] });

  res.json({
    results: [
      {
        type: "info",
        title: "Search endpoint active",
        snippet: `Query: ${q}`
      }
    ]
  });
});

module.exports = router;
