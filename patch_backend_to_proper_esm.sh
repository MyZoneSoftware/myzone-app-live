#!/usr/bin/env bash
set -e

echo "=== Backend ESM Patch & Restart Script ==="

# 1) Determine backend directory
if [ -d "./server" ]; then
  BACKEND="server"
elif [ -d "./myzone-server" ]; then
  BACKEND="myzone-server"
else
  echo "❌ No backend folder found!"
  exit 1
fi

echo "✔ Backend directory: $BACKEND"
cd "$BACKEND"

# 2) Ensure package.json uses ESM
echo "📦 Setting backend package.json to use ESM..."
jq '. + {"type":"module"}' package.json > package.tmp.json
mv package.tmp.json package.json

# 3) Patch src/index.mjs and other files to use ESM imports
echo "📄 Patching ESM imports in src files..."

# Patch index.mjs
cat << 'EOF2' > src/index.mjs
import dotenv from "dotenv";
dotenv.config();

import http from "http";
import expressApp from "./app.mjs"; 

const PORT = process.env.PORT || 5003;
const server = http.createServer(expressApp);

server.listen(PORT, () => {
  console.log(\`✅ Backend API listening on http://localhost:\${PORT}\`);
});
EOF2

# If old entry src/index.js exists, rename backup
if [ -f src/index.js ]; then
  mv src/index.js src/index.js.bak
fi

# 4) Create patched app file that imports original logic
echo "📄 Creating src/app.mjs to hold Express app..."

cat << 'EOF2' > src/app.mjs
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Load routes
import municipalRoutes from "./routes/municipal-boundaries.mjs";
import parcelsRoutes from "./routes/parcels-geojson.mjs";
import zoningRoutes from "./routes/zoning-geojson.mjs";
import parcelByIDRoutes from "./routes/parcel-by-id.mjs";
import smartCodeRoutes from "./routes/smart-code.mjs";

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Routes
app.use("/api/municipal-boundaries", municipalRoutes);
app.use("/api/parcels-geojson", parcelsRoutes);
app.use("/api/zoning-geojson", zoningRoutes);
app.use("/api/parcel-by-id", parcelByIDRoutes);
app.use("/api/smart-code", smartCodeRoutes);

// Fallback
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
EOF2

# 5) Patch route files to use ESM imports
echo "📄 Patching routes to use import syntax..."

for f in src/routes/*.js; do
  base=$(basename "$f" .js)
  mv src/routes/"$base".js src/routes/"$base".mjs
done

# Replace require/module.exports in each route file with ESM import/exports
for f in src/routes/*.mjs; do
  sed -i '' "s/require(/import /g" "$f"
  sed -i '' "s/module.exports = /export default /g" "$f"
done

# 6) Reinstall backend dependencies
echo "📦 Reinstalling backend dependencies..."
rm -rf node_modules
npm install

cd ..

# 7) Reinstall frontend dependencies
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

# 8) Stop old servers
echo "🛑 Killing old backend/frontend servers..."
pkill -f "node" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# 9) Start backend
echo "🚀 Starting patched backend..."
(cd "$BACKEND" && node src/index.mjs) &

sleep 3

# 10) Start frontend
echo "🚀 Starting frontend..."
if [ -d "./client" ]; then
  (cd client && npm run dev) &
elif [ -d "./myzone-client" ]; then
  (cd myzone-client && npm run dev) &
fi

echo "✨ Backend & frontend restarted!"
echo "➡️ Backend should be active at http://localhost:5003"
echo "➡️ Frontend at http://localhost:5173/ (or whatever Vite shows)"
