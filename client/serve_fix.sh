#!/bin/bash
set -euo pipefail

# 1) Find the client folder
if [ -d "client" ] && [ -f "client/package.json" ]; then
  APP_DIR="client"
elif [ -f "package.json" ] && [ -d "src" ]; then
  APP_DIR="."
else
  echo "❌ Could not find the client app. Run from project root (containing ./client) or inside the client folder."
  exit 1
fi
echo "📁 Using app dir: $APP_DIR"

cd "$APP_DIR"

# 2) Ensure dependencies
if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# 3) Ensure a Vite config that binds to 127.0.0.1:5177 (strict) so URL is predictable
#    This will create or update vite.config.mjs safely.
echo "🛠  Writing vite.config.mjs (port 5177, strictPort)..."
cat > vite.config.mjs <<'VCONF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',   // bind to loopback
    port: 5177,          // fixed port you can bookmark
    strictPort: true,    // fail if already in use (so we know to free it)
    open: false
  }
})
VCONF

# 4) Ensure package.json has a "dev" script that runs vite
if ! node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.dev ? 0 : 1)"; then
  echo "🔧 Adding \"dev\" script to package.json"
  node - <<'JS'
const fs=require('fs');
const p=require('./package.json');
p.scripts=p.scripts||{};
p.scripts.dev=p.scripts.dev||"vite";
fs.writeFileSync('./package.json', JSON.stringify(p,null,2));
console.log('✅ package.json updated');
JS
fi

# 5) Free the port if something is blocking 5177 (macOS & Linux)
echo "🧹 Freeing port 5177 if busy..."
if command -v lsof >/dev/null 2>&1; then
  PID=$(lsof -ti tcp:5177 || true)
  if [ -n "$PID" ]; then
    echo "🔪 Killing process on :5177 (PID=$PID)"
    kill -9 $PID || true
  fi
fi

# 6) Start the dev server
echo "▶️  Starting Vite on http://127.0.0.1:5177 ..."
npm run dev
