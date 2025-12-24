#!/usr/bin/env bash
set -e

echo "🔧 Starting CommonJS backend patch and restart..."

# Identify backend folder
if [ -d "./server" ]; then
  BACKEND="server"
elif [ -d "./myzone-server" ]; then
  BACKEND="myzone-server"
else
  echo "❌ No backend directory found!"
  exit 1
fi

echo "✔ Backend folder: $BACKEND"
cd "$BACKEND"

# 1) Remove `"type":"module"` from package.json so Node uses CommonJS
echo "📦 Removing ESM mode from package.json"
if grep -q '"type"' package.json; then
  jq 'del(.type)' package.json > package.tmp.json
  mv package.tmp.json package.json
  echo "✔ Removed ESM type field"
else
  echo "✔ No ESM type field present"
fi

# 2) Rename existing entry file to .cjs if needed
#    We assume original entry is src/index.js using CommonJS `require`
if [ -f src/index.js ]; then
  echo "📄 Renaming src/index.js → src/index.cjs"
  mv src/index.js src/index.cjs
else
  echo "⚠️ src/index.js not found — skipping rename"
fi

# 3) Create a new CommonJS entry that requires index.cjs
echo "📄 Creating CommonJS entry at src/index.js"
cat << 'EOF2' > src/index.js
// Auto-generated CommonJS entry for backend
const http = require("http");

// Load the existing app from index.cjs
let app;
try {
  app = require("./index.cjs");
} catch (err) {
  console.error("❌ Failed to require backend app from index.cjs:", err);
  process.exit(1);
}

const PORT = process.env.PORT || 5003;
http.createServer(app).listen(PORT, () => {
  console.log("✅ Backend API running (CommonJS) at http://localhost:" + PORT);
});
EOF2

echo "✔ CommonJS bootstrap entry created"

# 4) Reinstall backend dependencies
echo "📦 Cleaning and installing backend dependencies"
rm -rf node_modules
npm install

cd ..

# 5) Reinstall frontend dependencies
echo "📦 Cleaning and installing frontend dependencies"
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
else
  echo "⚠️ Frontend folder not found (client/myzone-client)"
fi

# 6) Stop any running servers
echo "🛑 Killing existing backend/frontend servers..."
pkill -f "node" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# 7) Restart backend
echo "🚀 Starting backend (CommonJS)..."
(cd "$BACKEND" && node src/index.js) &

sleep 3

# 8) Restart frontend
echo "🚀 Starting frontend..."
if [ -d "./client" ]; then
  (cd client && npm run dev) &
elif [ -d "./myzone-client" ]; then
  (cd myzone-client && npm run dev) &
fi

echo "🎉 Backend & frontend restart complete."
echo "➡️ Backend should respond at http://localhost:5003"
echo "➡️ Frontend at Vite URL e.g., http://localhost:5173/"
