import fs from 'node:fs';

const file = 'src/App.jsx';
let s = fs.readFileSync(file, 'utf8');

// 1) Remove any existing bridge call block
const callRe = /useMyzoneBridge\(\{[\s\S]*?\}\);\s*/m;
s = s.replace(callRe, ''); // strip it so we can re-insert

// 2) Find the LAST occurrence of useState( ... ) and insert after that line
const lines = s.split('\n');
let insertAt = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('useState(')) insertAt = i;
}
// If not found, fall back to just before 'return ('
if (insertAt === -1) {
  insertAt = lines.findIndex(l => l.includes('return (')) - 1;
  if (insertAt < 0) insertAt = 0;
}

const bridgeCall = `
  // Bridge: wire custom events to App state (must run after useState declarations)
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

lines.splice(insertAt + 1, 0, bridgeCall.trim());
fs.writeFileSync(file, lines.join('\n'));
console.log('✅ Repositioned useMyzoneBridge() after state hooks in App.jsx');
