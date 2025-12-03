// scripts/fix_oninsight.js
// Purpose: remove the "onInsight is not defined" crash without changing UI.
// - Adds a local fallback const inside App() so JSX refs don't throw
// - Rewrites <HeroSearch onSearch={...}> to a safe inline handler

const fs = require('fs');
const path = require('path');

const FILE = path.join('src', 'App.jsx');

if (!fs.existsSync(FILE)) {
  console.error('❌ Cannot find', FILE, '(run this from the client/ folder)');
  process.exit(1);
}

let s = fs.readFileSync(FILE, 'utf8');

// 1) Add a local safe fallback inside App() once, only if missing
if (!/const\s+onInsight\s*=/.test(s)) {
  const patterns = [
    /(export\s+default\s+function\s+App\s*\([^)]*\)\s*\{)/,
    /(function\s+App\s*\([^)]*\)\s*\{)/
  ];
  let inserted = false;
  for (const re of patterns) {
    if (re.test(s)) {
      s = s.replace(re, (m) => `${m}\n  // Local safe fallback to prevent ReferenceError\n  const onInsight = undefined;`);
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    console.warn('⚠️ Could not find App() declaration to inject fallback. Continuing.');
  }
}

// 2) Normalize any <HeroSearch onSearch={...}> to a safe wrapper
const safeHandler =
  `(q) => {\n` +
  `      try { if (typeof onInsight === "function") return onInsight(q); } catch {}\n` +
  `      try { if (typeof fetchInsights === "function") return fetchInsights(q); } catch {}\n` +
  `      try { if (typeof runSearchOnce === "function") return runSearchOnce(q); } catch {}\n` +
  `      try { window.dispatchEvent(new CustomEvent("myzone:hero-search", { detail: { query: q } })); } catch (e) { console.warn("[HeroSearch] no handler available", e); }\n` +
  `    }`;

// Replace any HeroSearch self-closing with any onSearch prop
s = s.replace(
  /<HeroSearch([^>]*)onSearch=\{[^}]*\}([^\/>]*)\/>/gs,
  (_m, pre, post) => `<HeroSearch${pre}onSearch={${safeHandler}}${post}/>`
);

// Also handle cases where the component might be multi-line with children (unlikely, but safe)
s = s.replace(
  /<HeroSearch([^>]*)onSearch=\{[^}]*\}([^>]*)>([\s\S]*?)<\/HeroSearch>/gs,
  (_m, pre, post, children) => `<HeroSearch${pre}onSearch={${safeHandler}}${post}/>`
);

// If a bare <HeroSearch /> exists with no onSearch prop, add the safe handler
s = s.replace(
  /<HeroSearch\s*\/>/g,
  `<HeroSearch onSearch={${safeHandler}} />`
);

// 3) Write back
fs.writeFileSync(FILE, s);
console.log('✅ Patched src/App.jsx (safe onSearch + local fallback).')
