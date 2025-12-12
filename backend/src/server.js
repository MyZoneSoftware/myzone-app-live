import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

import healthRoutes from "./routes/healthRoutes.js";
import districtRoutes from "./routes/districtRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import geoRoutes from "./routes/geoRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import jurisdictionRoutes from "./routes/jurisdictionRoutes.js";

dotenv.config({ quiet: true });

const app = express();
app.use(cors());
app.use(express.json());

// ---- ROUTES ----
app.use("/api/health", healthRoutes);
app.use("/api/districts", districtRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/jurisdictions", jurisdictionRoutes);

// ---- START SERVER ----
const PORT = process.env.PORT || 5003;

const server = app.listen(PORT, () => {
  console.log(`MyZone Backend running on port ${PORT}`);
});

// DB connect after server starts (API stays up even if DB fails)
await connectDB();

server.on("error", (err) => console.error("HTTP Server error:", err?.message || err));
process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.stdin.resume();
