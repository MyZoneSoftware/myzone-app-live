import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

import healthRoutes from "./routes/healthRoutes.js";
import districtRoutes from "./routes/districtRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import geoRoutes from "./routes/geoRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";

// Silence dotenv tips/logs
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

// ---- START SERVER ----
const PORT = process.env.PORT || 5003;

// Keep server reference + log lifecycle so we can see WHY it exits
const server = app.listen(PORT, () => {
  console.log(`MyZone Backend running on port ${PORT}`);
});

// Try to connect DB AFTER server starts (so API stays up even if DB fails)
await connectDB();

server.on("error", (err) => {
  console.error("HTTP Server error:", err?.message || err);
});

server.on("close", () => {
  console.log("HTTP Server closed");
});

process.on("beforeExit", (code) => {
  console.log("Process beforeExit:", code);
});

process.on("exit", (code) => {
  console.log("Process exit:", code);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
});

// Extra safety: keep stdin open so Node doesn't exit unexpectedly
process.stdin.resume();
