#!/usr/bin/env bash
set -e

echo "🔧 Fixing backend route imports and restarting..."

# 1) Confirm backend directory
if [ -d "./server" ]; then
  BACKEND="server"
elif [ -d "./myzone-server" ]; then
  BACKEND="myzone-server"
else
  echo "❌ No backend folder found!"
  exit 1
fi

cd "$BACKEND"

# 2) Rewrite server/src/index.mjs
echo "📄 Writing updated server/src/index.mjs with correct imports..."

cat << 'EOF2' > src/index.mjs
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Import actual existing route modules
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

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/districts", districtsRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/regulations", regulationsRoutes);
app.use("/api/search", searchRoutes);

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Catch-all for undefined APIs
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
const PORT = process.env.PORT || 5003;
http.createServer(app).listen(PORT, () => {
  console.log(\`✅ Backend API listening on http://localhost:\${PORT}\`);
});

export default app;
EOF2

echo "✔ server/src/index.mjs patched!"

# 3) Reinstall backend dependencies (clean)
echo "📦 Reinstalling backend dependencies..."
rm -rf node_modules
npm install

cd ..

# 4) Reinstall frontend dependencies
echo "📦 Reinstalling frontend dependencies..."
if [ -d "./client" ]; then
  cd client
  rm -rf node_modules
  npm install
  cd ..
elif [ -d "./myzone-client" ]; then
  cd myzone-client
  rm -rf node_modules
  npm install
  cd ..
fi

# 5) Kill any existing servers
echo "🛑 Killing old Node/Vite processes..."
pkill -f "node" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# 6) Restart backend
echo "🚀 Starting backend..."
(cd "$BACKEND" && node src/index.mjs) &

sleep 3

# 7) Restart frontend
echo "🚀 Starting frontend..."
if [ -d "./client" ]; then
  (cd client && npm run dev) &
elif [ -d "./myzone-client" ]; then
  (cd myzone-client && npm run dev) &
fi

echo "🎉 Backend and frontend restarted!"
echo "➡️ Backend should now respond at http://localhost:5003"
echo "➡️ Frontend at the Vite URL shown above (likely http://localhost:5173/)."
