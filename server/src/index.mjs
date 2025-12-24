import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Route imports
import authRoutes from "./routes/auth.mjs";
import districtsRoutes from "./routes/districts.mjs";
import geoRoutes from "./routes/geo.mjs";
import projectsRoutes from "./routes/projects.mjs";
import regulationsRoutes from "./routes/regulations.mjs";
import searchRoutes from "./routes/search.mjs";
import arcgisRoutes from "./routes/arcgis.mjs";

// ✅ Buffer routes (Notice radius / neighbor list stub)
import bufferRoutes from "./routes/buffer.mjs";

const app = express();

/**
 * Normalize route exports into Express middleware
 */
function asRouter(mod, name = "route") {
  if (typeof mod === "function") return mod;

  if (mod && typeof mod === "object") {
    if (typeof mod.default === "function") return mod.default;
    if (typeof mod.router === "function") return mod.router;
    if (mod.default && typeof mod.default === "function") return mod.default;
    if (mod.default && typeof mod.default.router === "function") return mod.default.router;
  }

  const keys = mod && typeof mod === "object" ? Object.keys(mod) : [];
  throw new TypeError(
    `Invalid middleware for ${name}. Got ${typeof mod}. Keys: [${keys.join(", ")}]`
  );
}

// Middleware
app.use(express.json({ limit: "2mb" }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// API routes
app.use("/api/auth", asRouter(authRoutes, "authRoutes"));
app.use("/api/districts", asRouter(districtsRoutes, "districtsRoutes"));
app.use("/api/geo", asRouter(geoRoutes, "geoRoutes"));

// ✅ Buffer endpoint expected by the UI:
// GET /api/geo/buffer?lat=..&lng=..&radiusFeet=..
app.use("/api/geo/buffer", asRouter(bufferRoutes, "bufferRoutes"));

app.use("/api/projects", asRouter(projectsRoutes, "projectsRoutes"));
app.use("/api/regulations", asRouter(regulationsRoutes, "regulationsRoutes"));
app.use("/api/search", asRouter(searchRoutes, "searchRoutes"));

// ✅ ArcGIS routes
app.use("/api/arcgis", asRouter(arcgisRoutes, "arcgisRoutes"));

/**
 * ✅ Back-compat alias for UI parcel search
 * UI calls: GET /api/search/parcel?q=...
 * We forward it to geo search:
 *  - /api/geo/search?parcel=...  (PCN)
 *  - /api/geo/search?address=... (address)
 */
app.get("/api/search/parcel", (req, res) => {
  const q = String(req.query?.q || "").trim();
  if (!q) return res.status(400).json({ error: "q is required" });

  // Heuristic: PCNs are usually digits + dashes (no letters)
  const normalized = q.replace(/\s+/g, "");
  const looksLikeParcelId = /^[0-9-]+$/.test(normalized) && normalized.length >= 6;

  const target = looksLikeParcelId
    ? `/api/geo/search?parcel=${encodeURIComponent(q)}`
    : `/api/geo/search?address=${encodeURIComponent(q)}`;

  // 302 redirect is followed by fetch() by default
  return res.redirect(302, target);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Start server
const PORT = Number(process.env.PORT) || 5003;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log("Backend API listening on http://localhost:" + PORT);
});

export default app;
