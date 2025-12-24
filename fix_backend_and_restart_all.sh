#!/usr/bin/env bash
set -e

echo "🔁 Starting CommonJS backend fix..."

# 1) Detect the backend directory
if [ -d "./server" ]; then
  BACKEND_DIR="server"
elif [ -d "./myzone-server" ]; then
  BACKEND_DIR="myzone-server"
else
  BACKEND_DIR=""
fi

if [ -z "$BACKEND_DIR" ]; then
  echo "❌ ERROR: No backend folder found (expected 'server' or 'myzone-server')."
  exit 1
fi

echo "✔ Backend folder: $BACKEND_DIR"

cd "$BACKEND_DIR"

# 2) Remove "type":"module" so Node treats files as CommonJS
echo "📦 Ensuring backend package.json does not force ESM"
if grep -q '"type"\s*:\s*"module"' package.json; then
  echo " - Removing 'type: module'"
  jq 'del(.type)' package.json > package.temp.json
  mv package.temp.json package.json
else
  echo " - No ESM type found in package.json"
fi

# 3) Reinstall backend dependencies
echo "📍 Cleaning and reinstalling backend node_modules"
rm -rf node_modules
npm install

# 4) Create a proper CommonJS start script
echo "📄 Writing start.cjs for proper CommonJS startup"
cat << 'EOF2' > start.cjs
const http = require("http");

// Attempt to require the existing Express app
let app;
try {
  app = require("./src/index.js");
} catch (err) {
  console.error("❌ Failed to require backend app module:", err);
  process.exit(1);
}

const PORT = process.env.PORT || 5003;
http.createServer(app).listen(PORT, () => {
  console.log("✅ Backend API running (CommonJS) at http://localhost:" + PORT);
});
EOF2

echo " - start.cjs created"

# 5) Go back to root
cd ..

# 6) Reinstall frontend dependencies so environment is clean
echo "📦 Reinstalling frontend dependencies (clean install)"
if [ -d "./client" ]; then
  cd client
  rm -rf node_modules
  npm install
  cd ..
fi
if [ -d "./myzone-client" ]; then
  cd myzone-client
  rm -rf node_modules
  npm install
  cd ..
fi

# 7) Kill any leftover dev servers
echo "🛑 Killing any lingering Node / Vite servers..."
pkill -f "node" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# 8) Start backend
echo "🚀 Starting backend..."
(cd "$BACKEND_DIR" && node start.cjs) &

sleep 3

# 9) Start frontend
echo "🚀 Starting frontend..."
if [ -d "./client" ]; then
  (cd client && npm run dev) &
elif [ -d "./myzone-client" ]; then
  (cd myzone-client && npm run dev) &
fi

echo "🎉 Backend & frontend restart initiated!"
echo "💡 Backend should be responding at http://localhost:5003"
echo "💡 Frontend should be live at the Vite URL shown (often http://localhost:5173/)."
