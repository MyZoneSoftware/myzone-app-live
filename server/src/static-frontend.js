import path from "path";
import { fileURLToPath } from "url";
import express from "express";

/**
 * Mounts the built Vite frontend (client/dist) on the Express app.
 * Safe to call only in production; does not modify any API routes.
 */
export default function installStaticFrontend(app) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Path to client/dist relative to this file (server/src/* -> ../../client/dist)
  const distDir = path.resolve(__dirname, "../../client/dist");

  // Serve static files
  app.use(express.static(distDir));

  // Single-page app fallback for React Router
  app.get("*", (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}
