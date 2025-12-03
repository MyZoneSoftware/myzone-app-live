#!/bin/bash
set -euo pipefail

echo "── MyZone Safe Boot ─────────────────────────────────────────────"

# 0) Locate app dir
if [ -d "client" ] && [ -f "client/package.json" ]; then
  APP="client"
elif [ -f "package.json" ] && [ -d "src" ]; then
  APP="."
else
  echo "❌ Could not find the app. Run this from the project root (that has ./client) or from the client folder."
  exit 1
fi
echo "📁 APP dir: $APP"

cd "$APP"

# 1) Show basics (helps us diagnose environment)
echo "── Environment ─────────────────────────────────────────────"
node -v || echo "⚠️ Node not found"
npm -v || echo "⚠️ NPM not found"
npx vite --version || true

# 2) Ensure deps
if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies (first run)..."
  npm install
fi

# 3) Fix/Write Vite config to bind 127.0.0.1:5177 (predictable URL)
if [ -f vite.config.mjs ]; then
  cp -p vite.config.mjs "vite.config.mjs.bak.$(date +%s)"
fi
cat > vite.config.mjs <<'VCONF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5177,
    strictPort: true,
    open: false,
  }
})
VCONF
echo "🛠  Vite configured: http://127.0.0.1:5177 (strict)"

# 4) Sanity check entry files EXIST (do NOT overwrite if present)
mkdir -p src

if [ ! -f index.html ]; then
  cp -p index.html "index.html.bak.$(date +%s)" 2>/dev/null || true
  cat > index.html <<'HTML'
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>MyZone Dev</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
HTML
  echo "🧩 Wrote minimal index.html (no app logic changed)."
fi

if [ ! -f src/main.jsx ]; then
  cp -p src/main.jsx "src/main.jsx.bak.$(date +%s)" 2>/dev/null || true
  cat > src/main.jsx <<'JS'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
JS
  echo "🧩 Wrote minimal src/main.jsx (imports your App.jsx)."
fi

if [ ! -f src/styles.css ]; then
  touch src/styles.css
  echo "🎨 Created src/styles.css (empty placeholder)."
fi

if [ ! -f src/App.jsx ]; then
  # Only create a placeholder if truly missing; keeps your app intact otherwise.
  cat > src/App.jsx <<'JSX'
export default function App(){
  return (
    <div style={{padding:'24px',fontFamily:'ui-sans-serif,system-ui'}}>
      <h1>MyZone Dev is running</h1>
      <p>If you see this, your Vite server works. Your real App.jsx was missing.</p>
    </div>
  );
}
JSX
  echo "🧩 Created placeholder src/App.jsx (your original was missing)."
fi

# 5) Ensure package.json has a dev script
if ! node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.dev ? 0 : 1)"; then
  node - <<'JS'
const fs=require('fs');
const p=require('./package.json');
p.scripts=p.scripts||{};
p.scripts.dev=p.scripts.dev||"vite";
fs.writeFileSync('./package.json', JSON.stringify(p,null,2));
console.log('🔧 Added \"dev\" script to package.json');
JS
fi

# 6) Free port 5177 (macOS/Linux)
echo "🧹 Freeing :5177 if busy..."
if command -v lsof >/dev/null 2>&1; then
  PID=$(lsof -ti tcp:5177 || true)
  [ -n "$PID" ] && { echo "🔪 Killing PID $PID"; kill -9 $PID || true; }
fi

# 7) Start Vite and tee logs (so we can see errors)
echo "▶️  Starting Vite at http://127.0.0.1:5177 …"
echo "──────────────── Vite Logs ────────────────"
npm run dev 2>&1 | tee .safe_boot.vite.log
