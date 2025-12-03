// scripts/add_app_bridge.mjs
import fs from 'node:fs';

const file = 'src/App.jsx';
let s = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
if (!s) { console.error('src/App.jsx not found'); process.exit(1); }

if (s.includes('// MYZONE_BRIDGE_START')) {
  console.log('↷ Bridge already present in App.jsx');
  process.exit(0);
}

// Try to inject before the final "return (" of the component
const exportFn = /export default function App\s*\([^)]*\)\s*\{/m;
if (!exportFn.test(s)) {
  console.error('Could not find App() component in App.jsx');
  process.exit(1);
}

// Find a good place to insert: just before the first "return ("
const retIdx = s.indexOf('return (');
if (retIdx === -1) {
  console.error('Could not locate return ( in App.jsx');
  process.exit(1);
}

const bridge = `
  // MYZONE_BRIDGE_START: open map & push insights
  React.useEffect(() => {
    function openMap() {
      try {
        // turn on Map view; turn off others
        typeof setShowMap === 'function' && setShowMap(true);
        typeof setShowReports === 'function' && setShowReports(false);
        typeof setShowApplications === 'function' && setShowApplications(false);
        typeof setShowZoningTools === 'function' && setShowZoningTools(false);
        typeof setShowFeasibility === 'function' && setShowFeasibility(false);
        typeof setDrawerOpen === 'function' && setDrawerOpen(false);
      } catch (e) { console.warn('openMap bridge error', e); }
    }
    function onInsight(e) {
      try {
        const p = e?.detail?.prompt || '';
        if (!p) return;
        // best-effort: set mode + query
        typeof setMode === 'function' && setMode('search');
        typeof setQuery === 'function' && setQuery(p);
        // if your code exposes a runner, call it
        if (typeof window !== 'undefined' && typeof window.myzoneRunSearch === 'function') {
          window.myzoneRunSearch(p);
        }
      } catch (e2) { console.warn('insight bridge error', e2); }
    }
    window.addEventListener('myzone:open-map', openMap);
    window.addEventListener('myzone:insight', onInsight);
    return () => {
      window.removeEventListener('myzone:open-map', openMap);
      window.removeEventListener('myzone:insight', onInsight);
    };
  }, []);
  // MYZONE_BRIDGE_END
`;

const patched = s.slice(0, retIdx) + bridge + s.slice(retIdx);
fs.writeFileSync(file, patched);
console.log('✅ Injected bridge into App.jsx');
