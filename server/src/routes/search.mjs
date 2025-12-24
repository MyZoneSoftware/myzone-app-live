import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/**
 * POST /api/search/smart-code
 * (unchanged – UI-safe stub)
 */
router.post("/smart-code", async (req, res) => {
  const question = String(req.body?.question || "").trim();
  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  const context = req.body?.context || {};

  res.json({
    answer:
      `SmartCode (stub)\n\n` +
      `Jurisdiction: ${context?.region || "—"}\n` +
      `Parcel: ${context?.parcel?.id || "—"}\n\n` +
      `Question: ${question}\n\n` +
      `Next: OpenAI + jurisdiction grounding.`,
  });
});

/**
 * GET /api/search/parcel?q=...
 * Robust adapter for PCN + Address
 */
router.get("/parcel", async (req, res) => {
  try {
    const qRaw = String(req.query.q || "").trim();
    if (!qRaw) {
      return res.status(400).json({ error: "q is required" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Normalize PCN variants
    const looksLikeParcelId = /^[0-9\-]+$/.test(qRaw);
    const qNormalized = qRaw.replace(/-/g, "");

    let urls = [];

    if (looksLikeParcelId) {
      urls.push(`${baseUrl}/api/geo/search?parcel=${encodeURIComponent(qRaw)}`);
      urls.push(`${baseUrl}/api/geo/search?parcel=${encodeURIComponent(qNormalized)}`);
    } else {
      urls.push(`${baseUrl}/api/geo/search?address=${encodeURIComponent(qRaw)}`);
    }

    for (const url of urls) {
      const r = await fetch(url);
      if (!r.ok) continue;

      const data = await r.json();
      const results = Array.isArray(data?.results) ? data.results : [];

      if (results.length > 0) {
        return res.json({ parcel: results[0] });
      }
    }

    return res.status(404).json({ error: "Parcel not found" });
  } catch (err) {
    console.error("search/parcel error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

export default router;
