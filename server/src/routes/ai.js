const express = require("express");
const router = express.Router();

router.post("/ask", async (req, res) => {
  const q = String(req.body?.q || "").toLowerCase();
  if (q.includes("rear setback") && (q.includes("rm") || q.includes("residential medium"))) {
    return res.json({ answer: "Rear setback in RM (Residential Medium) is 20 ft; may be reduced to 15 ft if served by an alley, subject to site conditions." });
  }
  if (q.includes("height") && q.includes("rm")) {
    return res.json({ answer: "Maximum height in RM is typically 35 ft (≈ 2–3 stories). Verify overlays or special districts." });
  }
  if (q.includes("cn")) {
    return res.json({ answer: "CN (Neighborhood Commercial) allows small-scale retail/services oriented to nearby residential areas. Check buffered setbacks next to residential zones." });
  }
  return res.json({ answer: "Here’s the relevant zoning context. Use the map or parcel search to get parcel-specific details (setbacks, height, use)." });
});

module.exports = router;
