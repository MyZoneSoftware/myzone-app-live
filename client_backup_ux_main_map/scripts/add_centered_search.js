const fs = require('fs');
const path = require('path');

const FILE = path.join('src', 'App.jsx');
if (!fs.existsSync(FILE)) {
  console.error('❌ Cannot find', FILE, '(run from client/)');
  process.exit(1);
}
let s = fs.readFileSync(FILE, 'utf8');

if (!s.includes("from './components/CenteredSearch.jsx'")) {
  // Insert import after the first import line
  s = s.replace(/(^\s*import .+?;\s*)/m, (m) => m + `import CenteredSearch from './components/CenteredSearch.jsx';\n`);
}

// Add the component once, right after <main ...> opening tag if present, else after top-level return <div>
if (!/CenteredSearch\s*\/>/.test(s)) {
  let inserted = false;
  s = s.replace(/<main([^>]*)>/, (m, g1) => {
    inserted = true;
    return `<main${g1}>\n  {/* Centered minimalist search */}\n  <CenteredSearch />`;
  });
  if (!inserted) {
    s = s.replace(/return\s*\(\s*<div([^>]*)>/, (m, g1) => {
      inserted = true;
      return `return (\n  <div${g1}>\n    {/* Centered minimalist search */}\n    <CenteredSearch />`;
    });
  }
  if (!inserted) {
    // Fallback: append before the last closing tag
    s = s.replace(/<\/\s*main\s*>|<\/\s*div\s*>/i, (m) => `  {/* Centered minimalist search */}\n  <CenteredSearch />\n${m}`);
  }
}

fs.writeFileSync(FILE, s);
console.log('✅ CenteredSearch added to App.jsx (import + render).');
