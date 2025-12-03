#!/bin/bash
set -euo pipefail

# 0) Detect client dir
if [ -f "client/package.json" ] && [ -d "client/src" ]; then
  CLIENT="client"
elif [ -f "package.json" ] && [ -d "src" ]; then
  CLIENT="."
else
  echo "❌ Could not find client folder. Run from project root or client/."
  exit 1
fi
echo "📁 CLIENT=$CLIENT"

SRC="$CLIENT/src"
COMP="$SRC/components"
MAIN="$SRC/main.jsx"
APP="$SRC/App.jsx"
CSS="$SRC/styles.css"
PORTAL="$COMP/CenteredSearchPortal.jsx"

mkdir -p "$COMP"

# 1) Ensure styles.css exists and is imported in main.jsx
if [ ! -f "$CSS" ]; then
  mkdir -p "$SRC"
  touch "$CSS"
fi
if ! grep -q "import './styles.css';" "$MAIN" 2>/dev/null; then
  # Insert styles import after the first import line
  awk 'NR==1{print; print "import \x27./styles.css\x27;"; next}1' "$MAIN" > "$MAIN.tmp" && mv "$MAIN.tmp" "$MAIN"
  echo "🎨 Added import './styles.css' to main.jsx"
fi

# 2) Write/overwrite CenteredSearchPortal (modern overlay with centered search)
cat > "$PORTAL" <<'JS'
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

function CenteredSearchCard() {
  const [q, setQ] = useState('');
  const run = () => {
    const query = (q || '').trim();
    if (!query) return;
    try {
      window.dispatchEvent(new CustomEvent('myzone:hero-search', { detail: { query } }));
      window.dispatchEvent(new CustomEvent('myzone:hide-landing'));
    } catch (e) { console.warn('[Landing] dispatch failed', e); }
  };
  const onKey = (e) => { if (e.key === 'Enter') run(); };
  return (
    <div className="landing-card">
      <h1 className="landing-title">Plan with clarity</h1>
      <p className="landing-subtitle">Zoning • Land Use • Development • Architecture</p>
      <div className="landing-row">
        <input
          className="landing-input"
          placeholder='e.g., "Orlando corner-lot setback"'
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={onKey}
          aria-label="Search"
        />
        <button className="landing-btn" onClick={run}>Search</button>
      </div>
      <div className="landing-hint">Minimalist, professional answers.</div>
    </div>
  );
}

export default function CenteredSearchPortal() {
  const host = useMemo(() => {
    let el = document.getElementById('landing-portal-root');
    if (!el) { el = document.createElement('div'); el.id = 'landing-portal-root'; document.body.appendChild(el); }
    return el;
  }, []);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const hide = () => setVisible(false);
    window.addEventListener('myzone:hide-landing', hide);
    return () => window.removeEventListener('myzone:hide-landing', hide);
  }, []);
  if (!visible) return null;
  return createPortal(
    <div className="landing-portal">
      <div className="landing">
        <CenteredSearchCard />
      </div>
    </div>,
    host
  );
}
JS

# 3) Mount the portal via main.jsx (safe augment)
if ! grep -q "CenteredSearchPortal" "$MAIN"; then
  # Add import
  awk 'NR==1{print; print "import CenteredSearchPortal from \x27./components/CenteredSearchPortal.jsx\x27;"; next}1' "$MAIN" > "$MAIN.tmp" && mv "$MAIN.tmp" "$MAIN"
  # Add bootstrap
  cat >> "$MAIN" <<'BOOT'

// ---- Landing portal bootstrap (independent of App layout) ----
import React from 'react';
import ReactDOM from 'react-dom/client';
(function mountLanding(){
  try {
    let host = document.getElementById('landing-portal-root');
    if (!host) { host = document.createElement('div'); host.id = 'landing-portal-root'; document.body.appendChild(host); }
    const root = ReactDOM.createRoot(host);
    root.render(<React.StrictMode><CenteredSearchPortal /></React.StrictMode>);
    // Hide on app ready if your app signals it
    window.addEventListener('myzone:app-ready', () => {
      try { window.dispatchEvent(new CustomEvent('myzone:hide-landing')); } catch {}
    });
  } catch (e) { console.warn('[mountLanding] failed', e); }
})();
BOOT
  echo "🧩 Mounted CenteredSearchPortal from main.jsx"
fi

# 4) Append elegant styles (idempotent)
if ! grep -q ".landing-portal" "$CSS"; then
cat >> "$CSS" <<'CSS'
:root{
  --text:#0f172a; --muted:#6b7280; --bd:#e5e7eb; --bg:#ffffff; --primary:#2563eb; --ring:0 0 0 3px rgba(37,99,235,.15);
}
.landing-portal{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:10000;
  background:
    radial-gradient(1200px 600px at 20% 0%, rgba(37,99,235,.06), transparent 55%),
    radial-gradient(1200px 600px at 80% 0%, rgba(16,185,129,.06), transparent 55%); }
.landing{ width:min(960px,92%); padding:0 16px; }
.landing-card{ background:var(--bg); border:1px solid var(--bd); border-radius:18px; padding:26px; box-shadow:0 26px 60px rgba(0,0,0,.08); }
.landing-title{ margin:0 0 4px 0; font-size:30px; font-weight:800; letter-spacing:-0.01em; color:var(--text); }
.landing-subtitle{ margin:0 0 18px 0; font-size:14px; color:var(--muted); }
.landing-row{ display:flex; gap:10px; align-items:center; }
.landing-input{ flex:1 1 auto; padding:14px 16px; font-size:16px; line-height:1.25; background:#fff; border:1px solid var(--bd); border-radius:14px; outline:none; transition:border-color .12s, box-shadow .12s; }
.landing-input:focus{ border-color:var(--primary); box-shadow:var(--ring); }
.landing-btn{ flex:0 0 auto; padding:12px 16px; font-size:15px; font-weight:600; background:#fff; border:1px solid var(--bd); border-radius:14px; cursor:pointer; transition:border-color .12s, box-shadow .12s, transform .08s; }
.landing-btn:hover{ border-color:var(--primary); box-shadow:var(--ring); }
.landing-btn:active{ transform: translateY(1px); }
.landing-hint{ margin-top:10px; font-size:12px; color:var(--muted); }

/* Tiles: left-edge highlight only on hover */
.tile,.card-tile,.panel-tile,.feature-tile,.app-tile,.grid-tile{ position:relative; background:#fff; border:1px solid var(--bd); border-radius:14px; transition:transform .12s, box-shadow .12s, border-color .12s; }
.tile::before,.card-tile::before,.panel-tile::before,.feature-tile::before,.app-tile::before,.grid-tile::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:0; background:var(--primary); border-top-left-radius:14px; border-bottom-left-radius:14px; transition:width .12s; }
.tile:hover::before,.card-tile:hover::before,.panel-tile:hover::before,.feature-tile:hover::before,.app-tile:hover::before,.grid-tile:hover::before{ width:6px; }
.tile:hover,.card-tile:hover,.panel-tile:hover,.feature-tile:hover,.app-tile:hover,.grid-tile:hover{ transform:translateY(-1px); box-shadow:0 14px 30px rgba(0,0,0,.08); border-color:#dbe1ea; }

/* Map containment (scoped) */
.map-card .toolbar-v2{ position:relative; z-index:10; background:#fff; border:1px solid var(--bd); border-radius:12px; padding:10px 12px; }
.map-card .toolbar-v2 .controls-row{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; width:100%; }
.map-card .mapctl-btn, .map-card .toggle{ flex:0 0 auto; white-space:nowrap; }
.map-card .map-root{ position:relative; z-index:1; }
.map-card .leaflet-container, .map-card .leaflet-pane, .map-card .leaflet-control-container{ z-index:1; }

@media (max-width:900px){
  .landing-row{ flex-direction:column; align-items:stretch; }
  .landing-btn{ width:100%; }
}
CSS
  echo "✨ Added elegant landing + tile styles"
fi

# 5) Restart dev server and show URL
echo "🧯 Stopping any Vite dev server..."
pkill -f vite 2>/dev/null || true

echo "▶️  Starting dev server..."
cd "$CLIENT"
[ -d node_modules ] || npm install
npm run dev
