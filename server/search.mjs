import express from "express";
const router = express.Router();

/**
 * POST /api/search/smart-code
 * Temporary stub – UI-safe
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

export default router;
