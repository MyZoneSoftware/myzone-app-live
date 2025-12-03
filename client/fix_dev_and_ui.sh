#!/bin/bash
set -euo pipefail

echo "🔎 Detecting client directory..."
CLIENT_DIR=""
if [ -f "client/package.json" ]; then
  CLIENT_DIR="client"
elif [ -f "package.json" ] && grep -qi '"vite"' package.json 2>/dev/null; then
  CLIENT_DIR="."
else
  echo "❌ Could not find client folder. Run this from your project root or from the client folder."
  exit 1
fi

APP="$CLIENT_DIR/src/App.jsx"
CSS="$CLIENT_DIR/src/styles.css"

echo "📁 Using CLIENT_DIR=$CLIENT_DIR"
[ -f "$APP" ] || { echo "❌ Missing $APP"; exit 1; }
[ -f "$CSS" ] || { echo "⚠️  $CSS not found; continuing without CSS edits."; }

ts="$(date +%Y%m%d_%H%M%S)"
cp "$APP" "$APP.bak.$ts"
[ -f "$CSS" ] && cp "$CSS" "$CSS.bak.$ts" || true
echo "🗂  Backed up App.jsx (and styles.css if present)."

echo "🧹 Reverting Hero inserts and undefined identifiers..."
# Remove HeroProxy/HeroSearch imports
perl -0777 -i -pe 's/^\s*import\s+HeroProxy\s+from\s+.\.\/components\/HeroProxy\.jsx.\s*\n//mg' "$APP"
perl -0777 -i -pe 's/^\s*import\s+HeroSearch\s+from\s+.\.\/components\/HeroSearch\.jsx.\s*\n//mg' "$APP"

# Remove any <HeroProxy /> or <HeroSearch .../>
perl -0777 -i -pe 's/<HeroProxy\s*\/>\s*//gs' "$APP"
perl -0777 -i -pe 's/<HeroSearch\b[^>]*\/>\s*//gs' "$APP"
perl -0777 -i -pe 's/<HeroSearch\b[^>]*>[\s\S]*?<\/HeroSearch>\s*//gs' "$APP"

# Ensure JSX can’t reference an undefined onInsight identifier
# Insert a harmless fallback right after App() opens (only if not present)
perl -0777 -i -pe 'BEGIN{$i=0} s/(export\s+default\s+function\s+App\s*\([^)]*\)\s*\{)(?![^]*?const\s+onInsight\s*=)/$1\n  const onInsight = undefined; \/\/ fallback to prevent ReferenceError\n/ and $i++ if !$i;' "$APP"
perl -0777 -i -pe 'BEGIN{$i=0} s/(function\s+App\s*\([^)]*\)\s*\{)(?![^]*?const\s+onInsight\s*=)/$1\n  const onInsight = undefined; \/\/ fallback to prevent ReferenceError\n/ and $i++ if !$i;' "$APP"

# If there is an onSearch prop still referencing onInsight || fetchInsights || runSearchOnce, normalize to safe wrapper
perl -0777 -i -pe 's|<HeroSearch([^>]*)onSearch=\{[^}]*\}([^\/>]*)\/>|<HeroSearch\1onSearch={(q)=>{try{if(typeof onInsight==="function")return onInsight(q);}catch(e){} try{if(typeof fetchInsights==="function")return fetchInsights(q);}catch(e){} try{if(typeof runSearchOnce==="function")return runSearchOnce(q);}catch(e){} try{window.dispatchEvent(new CustomEvent("myzone:hero-search",{detail:{query:q}}));}catch(e){console.warn("[HeroSearch] no handler available",e);} }}\2/>|gs' "$APP" || true

echo "🧽 CSS: ensure map controls don’t overlap (scoped, no global UI changes)..."
if [ -f "$CSS" ]; then
  awk '1' "$CSS" > "$CSS.tmp.$ts"
  cat >> "$CSS.tmp.$ts" <<'CSSPATCH'

/* === Scoped map toolbar fixes (no global impact) === */
.map-card .toolbar-v2{ position:relative; z-index:10; background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:10px 12px; }
.map-card .toolbar-v2 .controls-row{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; width:100%; }
.map-card .mapctl-btn, .map-card .toggle{ flex:0 0 auto; white-space:nowrap; }
.map-card .map-root{ position:relative; z-index:1; }
.map-card .leaflet-container, .map-card .leaflet-pane, .map-card .leaflet-control-container{ z-index:1; }
@media (max-width:900px){
  .map-card .toolbar-v2 .controls-row{ display:grid; grid-template-columns:1fr; }
  .map-card .mapctl-btn, .map-card .toggle{ width:100%; justify-content:flex-start; }
}
CSSPATCH
  mv "$CSS.tmp.$ts" "$CSS"
else
  echo "ⓘ Skipped CSS: $CSS not found."
fi

echo "🧯 Killing any previous Vite dev server..."
pkill -f vite 2>/dev/null || true

echo "▶️  Starting dev server..."
cd "$CLIENT_DIR"
# Install deps if node_modules missing
[ -d node_modules ] || npm install
npm run dev
