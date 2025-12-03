import React from 'react'
import './landing_bootstrap_myz.jsx';
import CenteredSearchPortal from './components/CenteredSearchPortal.jsx';
import './styles.css';
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Leaflet CSS
import 'leaflet/dist/leaflet.css'

// Fix default marker icons path under Vite
import L from 'leaflet'
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl,
  shadowUrl
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
// Optional: bridge hero search to any available handler you already have
window.addEventListener('myzone:hero-search', (e) => {
  const q = e?.detail?.query;
  try { if (typeof window.onInsight === 'function') return window.onInsight(q); } catch {}
  try { if (typeof window.fetchInsights === 'function') return window.fetchInsights(q); } catch {}
  try { if (typeof window.runSearchOnce === 'function') return window.runSearchOnce(q); } catch {}
  // No-op fallback keeps it safe.
});

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
