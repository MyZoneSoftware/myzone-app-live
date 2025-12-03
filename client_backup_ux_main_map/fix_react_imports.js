const fs = require('fs');
const path = require('path');

const candidates = [
  path.join('client','src','main.jsx'),
  path.join('src','main.jsx'),
];

const file = candidates.find(f => fs.existsSync(f));
if (!file) {
  console.error('❌ Could not find src/main.jsx (looked in client/src and src).');
  process.exit(1);
}

let s = fs.readFileSync(file, 'utf8');

// Ensure exactly one "import React from 'react'" (keep the first)
{
  const re = /(^|\n)\s*import\s+React\s+from\s+['"]react['"]\s*;\s*/g;
  let m, idxs = [];
  while ((m = re.exec(s)) !== null) idxs.push({start:m.index + (m[1] ? m[1].length : 0), end: re.lastIndex});
  if (idxs.length > 1) {
    // keep the first, remove the rest
    const keep = idxs.shift();
    let out = s.slice(0, keep.end);
    let last = keep.end;
    for (const seg of idxs) {
      out += s.slice(last, seg.start);
      last = seg.end;
    }
    out += s.slice(last);
    s = out;
  }
}

// Ensure exactly one "import ReactDOM from 'react-dom/client'"
{
  const re = /(^|\n)\s*import\s+ReactDOM\s+from\s+['"]react-dom\/client['"]\s*;\s*/g;
  let m, idxs = [];
  while ((m = re.exec(s)) !== null) idxs.push({start:m.index + (m[1] ? m[1].length : 0), end: re.lastIndex});
  if (idxs.length > 1) {
    const keep = idxs.shift();
    let out = s.slice(0, keep.end);
    let last = keep.end;
    for (const seg of idxs) {
      out += s.slice(last, seg.start);
      last = seg.end;
    }
    out += s.slice(last);
    s = out;
  }
}

// Also handle the specific bootstrap block that might have inline imports after a comment marker
s = s.replace(
  /(\/\/\s*----\s*Landing portal bootstrap[\s\S]*?\n)\s*import\s+React\s+from\s+['"]react['"]\s*;\s*/,
  '$1'
);
s = s.replace(
  /(\/\/\s*----\s*Landing portal bootstrap[\s\S]*?\n)\s*import\s+ReactDOM\s+from\s+['"]react-dom\/client['"]\s*;\s*/,
  '$1'
);

fs.writeFileSync(file, s, 'utf8');
console.log('✅ Fixed duplicate React/ReactDOM imports in:', file);
