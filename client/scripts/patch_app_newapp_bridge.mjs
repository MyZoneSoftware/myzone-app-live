import fs from 'node:fs';
const file = 'src/App.jsx';
let s = fs.readFileSync(file, 'utf8');
let changed = false;

// Add state to hold initial application data
if (!s.includes('const [newAppInit')) {
  s = s.replace(
    /const \[drawerOpen, setDrawerOpen\] = useState\(false\);\s*/,
    `$&
  const [newAppInit, setNewAppInit] = useState(null);
`
  );
  changed = true;
}

// Listen for myzone:new-application
if (!s.includes('myzone:new-application')) {
  s = s.replace(
    /useEffect\(\(\) => \(\) => \{ mountedRef\.current = false; abortRef\.current\?\.abort\(\); \}, \[\]\);\s*/,
    `$&
  useEffect(() => {
    function onNewApp(e) {
      const init = e?.detail || {};
      setNewAppInit(init);
      setShowMap(false);
      setShowZoningTools(false);
      setShowReports(false);
      setShowFeasibility(false);
      setShowApplications(true);
      setDrawerOpen(false);
    }
    window.addEventListener('myzone:new-application', onNewApp);
    return () => window.removeEventListener('myzone:new-application', onNewApp);
  }, []);
`
  );
  changed = true;
}

// Pass the newAppInit prop to ApplicationsPanel
if (s.includes('<ApplicationsPanel') && !s.includes('newAppInit={newAppInit}')) {
  s = s.replace(
    /<ApplicationsPanel([^>]*)\/>/,
    `<ApplicationsPanel$1 newAppInit={newAppInit} />`
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, s);
  console.log('✅ App.jsx patched: listens for myzone:new-application & forwards newAppInit');
} else {
  console.log('↷ App.jsx already patched or patterns not found.');
}
