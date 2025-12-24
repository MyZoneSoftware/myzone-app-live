#!/usr/bin/env bash
set -e

echo "🚧 Rewriting server/src/index.mjs with clean Node-compatible ESM code..."

# Detect backend directory
if [ -d "./server" ]; then
  BACKEND="server"
elif [ -d "./myzone-server" ]; then
  BACKEND="myzone-server"
else
  echo "No backend folder found!"
  exit 1
fi

cd "$BACKEND"

# Overwrite server/src/index.mjs with clean ASCII ESM
cat << 'EOF2' > src/index.mjs
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Route imports — adjust as needed
import authRoutes from "./routes/auth.mjs";
import districtsRoutes from "./routes/districts.mjs";
import geoRoutes from "./routes/geo.mjs";
import projectsRoutes from "./routes/projects.mjs";
import regulationsRoutes from "./routes/regulations.mjs";
import searchRoutes from "./routes/search.mjs";

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// API endpoints
app.use("/api/auth", authRoutes);
app.use("/api/districts", districtsRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/regulations", regulationsRoutes);
app.use("/api/search", searchRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Start HTTP server
const PORT = process.env.PORT || 5003;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log("Backend API listening on http://localhost:" + PORT);
});

export default app;
EOF2

echo "✔ server/src/index.mjs rewritten cleanly."

# Reinstall backend dependencies
echo "Installing backend dependencies..."
rm -rf node_modules
npm install

cd ..

# Kill old servers
echo "Stopping old Node/Vite processes..."
pkill -f "node" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Start backend
echo "Starting backend..."
(cd "$BACKEND" && node src/index.mjs) &

sleep 3

# Start frontend
echo "Starting frontend..."
if [ -d "./client" ]; then
  (cd client && npm run dev) &
elif [ -d "./myzone-client" ]; then
  (cd myzone-client && npm run dev) &
fi

echo "Done. Backend should be listening on http://localhost:5003"
