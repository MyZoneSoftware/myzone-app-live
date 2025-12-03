import fs from 'node:fs';

const file = 'src/App.jsx';
let s = fs.readFileSync(file, 'utf8');

// 1) Remove old injected block (if present)
s = s.replace(/\/\/ MYZONE_BRIDGE_START[\s\S]*?\/\/ MYZONE_BRIDGE_END\n?/g, '');

// 2) Ensure we import the hook
if (!/useMyzoneBridge/.test(s)) {
  // Add after other imports
  s = s.replace(/(^import[\s\S]*?from\s+['"][^'"]+['"];\s*\n)+/m, (m) => {
    return m + `import useMyzoneBridge from './hooks/useMyzoneBridge.js';\n`;
  });
}

// 3) Insert a call to the hook right after the start of App() function
const appStart = /export default function App\s*\([^)]*\)\s*\{\s*/m;
if (appStart.test(s) && !/useMyzoneBridge\(\{/.test(s)) {
  s = s.replace(appStart, (m) => {
    return m + `
  // Call the bridge hook (must be unconditional)
  useMyzoneBridge({
    setShowMap,
    setShowReports,
    setShowApplications,
    setShowZoningTools,
    setShowFeasibility,
    setDrawerOpen,
    setMode,
    setQuery,
  });
`;
  });
}

fs.writeFileSync(file, s);
console.log('✅ App.jsx cleaned and wired to use useMyzoneBridge()');
