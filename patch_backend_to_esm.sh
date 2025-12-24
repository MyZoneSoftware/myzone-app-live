#!/usr/bin/env bash
set -e

echo "🔁 Starting backend patch (convert to ESM)..."

# Detect backend path
if [ -d "./server" ]; then
  BACKEND="server"
elif [ -d "./myzone-server" ]; then
  BACKEND="myzone-server"
else
  echo "❌ Backend folder not found!"
  exit 1
fi

echo "✔ Backend folder: $BACKEND"
cd "$BACKEND"

# 1) Update package.json to use ESM
echo "📦 Setting backend package.json to ESM"
jq '. + {type:"module"}' package.json > package.temp.json
mv package.temp.json package.json

echo "✔ package.json updated to ESM"

# 2) Convert `src/index.js` to `src/index.mjs` with import syntax
echo "📄 Rewriting backend entry to ESM import syntax"

# Backup original
cp src/index.js src/index.js.bak

cat << 'EOF2' > src/index.mjs
import http from 'http';
import expressApp from './index.js';  // reexport default expected

const PORT = process.env.PORT || 5003;

http.createServer(expressApp).listen(PORT, () => {
  console.log(\`✅ Backend API running (ESM) at http://localhost:\${PORT}\`);
});
EOF2

echo "✔ Created src/index.mjs"

# 3) Ensure the version in package.json points to index.mjs
echo "📌 Adjusting package.json main field"
jq '.main = "src/index.mjs"' package.json > package.main.temp.json
mv package.main.temp.json package.json

echo "✔ package.json main updated"

echo "📦 Reinstalling backend dependencies..."
rm -rf node_modules
npm install

cd ..

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
else
  echo "⚠️ Frontend folder not found"
fi

echo "🛑 Killing any running backend/frontend servers..."
pkill -f "node" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "🚀 Starting backend (ESM)..."
(cd "$BACKEND" && node src/index.mjs) &

sleep 3

echo "🚀 Starting frontend..."
if [ -d "./client" ]; then
  (cd client && npm run dev) &
elif [ -d "./myzone-client" ]; then
  (cd myzone-client && npm run dev) &
fi

echo "🎉 Backend & frontend restarted (with ESM backend)."
echo "➡️ Backend should now respond on http://localhost:5003"
