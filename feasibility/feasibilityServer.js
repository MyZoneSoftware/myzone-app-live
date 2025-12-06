// Feasibility Micro-API Server (standalone)
// Run with:
//   node feasibility/feasibilityServer.js
//
// Endpoints:
//   GET  /api/feasibility/health
//   POST /api/feasibility/preliminary

const express = require("express");
const cors = require("cors");
const { computePreliminaryFeasibility } = require("./feasibilityEngine");

const app = express();
const PORT = process.env.FEASIBILITY_PORT || 5100;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/feasibility/health", (req, res) => {
  res.json({ ok: true, service: "feasibility", status: "running", port: PORT });
});

// Main feasibility route
app.post("/api/feasibility/preliminary", (req, res) => {
  try {
    const input = req.body || {};
    const result = computePreliminaryFeasibility(input);

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("Feasibility API error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error while computing feasibility.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Feasibility API listening on http://localhost:${PORT}`);
});
