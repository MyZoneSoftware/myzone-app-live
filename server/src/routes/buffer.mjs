import express from "express";

const router = express.Router();

/**
 * 🔵 Notice buffer (stub – unblocks UI)
 */
router.get("/", async (req, res) => {
  const { lat, lng, radiusFeet } = req.query;

  if (!lat || !lng || !radiusFeet) {
    return res.status(400).json({ error: "lat, lng, radiusFeet required" });
  }

  res.json({
    center: {
      lat: Number(lat),
      lng: Number(lng),
    },
    radiusFeet: Number(radiusFeet),
    parcels: [], // real neighbors come later
  });
});

export default router;
