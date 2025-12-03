import fs from 'node:fs';

const file = 'src/App.jsx';
if (!fs.existsSync(file)) {
  console.error('❌ src/App.jsx not found');
  process.exit(1);
}
let s = fs.readFileSync(file, 'utf8');
let changed = false;

// 1) Replace React.useEffect(...) → useEffect(...)
if (/React\.useEffect\s*\(/.test(s)) {
  s = s.replace(/React\.useEffect\s*\(/g, 'useEffect(');
  changed = true;
}

// 2) Ensure we import useEffect from react.
// Find the first import from 'react'
const reactImportRe = /import\s+([^;]*?)\s+from\s+['"]react['"]\s*;/m;
const m = s.match(reactImportRe);

if (m) {
  const full = m[0];
  const spec = m[1];

  // Cases:
  // - import React from 'react'
  // - import React, { useState } from 'react'
  // - import { useState } from 'react'
  let newFull = full;

  // If it's default-only: "import React from 'react'"
  if (/^\s*React\s*$/.test(spec)) {
    newFull = `import React, { useEffect } from 'react';`;
  }
  // If it already has braces: add useEffect if missing
  else if (/\{[^}]*\}/.test(spec)) {
    // Get names inside braces
    const braceMatch = spec.match(/\{([^}]*)\}/);
    const inside = braceMatch ? braceMatch[1] : '';
    const names = inside.split(',').map(x=>x.trim()).filter(Boolean);
    if (!names.includes('useEffect')) names.push('useEffect');

    // Preserve default import (e.g., "React," before the braces) if present
    const defaultPart = spec.replace(/\{[^}]*\}/, '').replace(',', '').trim(); // e.g., "React" or ""
    const rebuilt =
      defaultPart
        ? `import ${defaultPart}, { ${Array.from(new Set(names)).join(', ')} } from 'react';`
        : `import { ${Array.from(new Set(names)).join(', ')} } from 'react';`;

    newFull = rebuilt;
  }
  // If it's default without braces but extra tokens: normalize to include useEffect
  else {
    // e.g., "import React ,  from 'react'"
    newFull = `import React, { useEffect } from 'react';`;
  }

  if (newFull !== full) {
    s = s.replace(full, newFull);
    changed = true;
  }
} else {
  // No react import found at all → add one at the very top
  s = `import { useEffect } from 'react';\n` + s;
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, s);
  console.log('✅ App.jsx patched: useEffect import fixed and React.useEffect() normalized');
} else {
  console.log('↷ App.jsx already OK (no changes)');
}
