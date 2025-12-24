import express from "express";
import cors from "cors";
import dotenv from "dotenv";

/* import route modules */
import * as searchMod from "./routes/search.mjs";
import * as projectsMod from "./routes/projects.mjs";
import * as authMod from "./routes/auth.mjs";
import * as districtsMod from "./routes/districts.mjs";
import * as regulationsMod from "./routes/regulations.mjs";
import * as aiMod from "./routes/ai.mjs";
import geoRoutes from "./routes/geo.mjs"; // existing, confirmed

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5050;

/**
 * Normalize ANY route export into an Express router function
 */
function resolveRouter(mod, name) {
  let candidate = null;

  // Case 1: export default router
  if (typeof mod?.default === "function") {
    candidate = mod.default;
  }

  // Case 2: export const router = Router()
  if (!candidate && typeof mod?.router === "function") {
    candidate = mod.router;
  }

  // Case 3: export default { router, ... }
  if (!candidate && typeof mod?.default === "object" && typeof mod.default.router === "function") {
    candidate = mod.default.router;
  }

  if (typeof candidate !== "function") {
    console.error(`❌ Route "${name}" does not export an Express router function.`);
    console.error("Available module keys:", Object.keys(mod || {}));
    if (mod?.default && typeof mod.default === "object") {
      console.error("Default export keys:", Object.keys(mod.default));
    }
    process.exit(1);
  }

  return candidate;
}

/* API routes */
app.use("/api/search", resolveRouter(searchMod, "search"));
app.use("/api/projects", resolveRouter(projectsMod, "projects"));
app.use("/api/auth", resolveRouter(authMod, "auth"));
app.use("/api/districts", resolveRouter(districtsMod, "districts"));
app.use("/api/regulations", resolveRouter(regulationsMod, "regulations"));
app.use("/api/ai", resolveRouter(aiMod, "ai"));
app.use("/api/geo", geoRoutes); // geo.mjs already exports router correctly

/* health */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/* start server */
app.listen(PORT, () => {
  console.log(`✅ Backend API listening on http://localhost:${PORT}`);
});
