#!/usr/bin/env bash
set -e

echo "📌 Starting full ESM backend patch..."

############################################
# 1) Detect backend path
############################################
if [ -d "./server" ]; then
  BACKEND="server"
elif [ -d "./myzone-server" ]; then
  BACKEND="myzone-server"
else
  echo "❌ No backend folder found!"
  exit 1
fi

echo "✔ Backend folder: $BACKEND"
cd "$BACKEND"

############################################
# 2) Set package.json to ESM
############################################
echo "📦 Updating backend package.json to use ESM"
jq '. + {"type":"module"}' package.json > package.temp.json
mv package.temp.json package.json

############################################
# 3) Convert all .cjs / .js files to .mjs
############################################

echo "📄 Renaming CommonJS files to .mjs for ESM compatibility"
if [ -f src/index.cjs ]; then
  mv src/index.cjs src/index.cjs.bak
  mv src/index.cjs.bak src/index.mjs
fi

if [ -f src/index.js ]; then
  # Backup original but don't delete
  mv src/index.js src/index.js.bak
fi

############################################
# 4) Create unified ESM entrypoint
############################################
echo "📄 Writing unified ESM backend entrypoint: src/index.js"
cat << 'EOF2' > src/index.js
// Auto‐generated ESM entrypoint
// Load the true app implementation (must be ESM now)

import expressApp from './index.mjs';
import http from 'http';

const PORT = process.env.PORT || 5003;
const server = http.createServer(expressApp);

server.listen(PORT, () => {
  console.log(\`✅ Backend API (ESM) listening on http://localhost:\${PORT}\`);
});

export default server;
EOF2

############################################
# 5) Patch backend source imports everywhere
############################################
echo "🔁 Updating dynamic imports in backend code"

# Replace require(...) with import where possible
# Sed replacements:
#   require("x") → import x from "x"
#   require('x') → import x from 'x'
# (Simple case)
grep -rl "require(" src | xargs sed -i '' -E "s/const (.+) = require\(['\"](.+)['\"]\);/import \1 from '\2';/g"

# Static frontend import already ESM: OK
# Other imports using import ... should just work under ESM mode

############################################
# 6) Reinstall dependencies
############################################
echo "📦 Reinstalling backend dependencies..."
rm -rf node_modules
npm install

cd ..

############################################
# 7) Reinstall frontend
############################################
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

############################################
# 8) Stop existing servers
############################################
echo "🛑 Killing any running Node/Vite processes..."
pkill -f "node" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

############################################
# 9) Start backend
############################################
echo "🚀 Starting patched backend (ESM)..."
(cd "$BACKEND" && node src/index.js) &

sleep 3

############################################
# 10) Start frontend
############################################
echo "🚀 Starting frontend..."
if [ -d "./client" ]; then
  (cd client && npm run dev) &
elif [ -d "./myzone-client" ]; then
  (cd myzone-client && npm run dev) &
fi

echo "✨ Backend & frontend restart complete."
echo "➡️ Backend should now be listening on http://localhost:5003"
echo "➡️ Frontend at the Vite URL printed above (e.g. http://localhost:5173)"
