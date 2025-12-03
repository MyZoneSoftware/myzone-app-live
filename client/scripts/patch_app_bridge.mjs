// scripts/patch_app_bridge.mjs
import fs from 'node:fs';

const file = 'src/App.jsx';
let s = fs.readFileSync(file, 'utf8');

const hook =
`
  // Event bridge: open Map, push prompt to Insights (search)
  useEffect(() => {
    function openMap() {
      setShowApplications(false);
      setShowZoningTools(false);
      setShowReports(false);
      setShowFeasibility(false);
      setShowMap(true);
      setDrawerOpen(false);
    }
    function onInsight(e) {
      const p = e?.detail?.prompt || '';
      if (!p) return;
      setMode('search');
      setQuery(p);
      // existing debounce will run the fetch
    }
    window.addEventListener('myzone:open-map', openMap);
    window.addEventListener('myzone:insight', onInsight);
    return () => {
      window.removeEventListener('myzone:open-map', openMap);
      window.removeEventListener('myzone:insight', onInsight);
    };
  }, []);
`;

if (!s.includes('myzone:open-map') && !s.includes('myzone:insight')) {
  // insert right after the first effect that cleans up on unmount
  s = s.replace(
    /useEffect\(\(\) => \{\s*return \(\) => \{.*?}\);\n\s*\}, \[\]\);\n/s,
    (m) => m + hook
  );
}

fs.writeFileSync(file, s);
console.log('✅ Patched', file);
