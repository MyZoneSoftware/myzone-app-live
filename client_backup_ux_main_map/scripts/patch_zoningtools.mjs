// scripts/patch_zoningtools.mjs
import fs from 'node:fs';

const file = 'src/App.jsx';
let s = fs.readFileSync(file, 'utf8');

if (!/import ZoningTools from ['"]\.\/components\/ZoningTools\.jsx['"];/m.test(s)) {
  // insert after MapView import
  s = s.replace(
    /(import MapView.*?;\s*\n)/s,
    `$1import ZoningTools from './components/ZoningTools.jsx';\n`
  );
  console.log('✔ Inserted import ZoningTools');
} else {
  console.log('↷ Import already present');
}

// replace the placeholder Zoning Tools card with <ZoningTools .../>
const placeholderRe = new RegExp(
  String.raw`{showZoningTools && $begin:math:text$\\s*<div className="mz-card">\\s*<h3>Zoning Tools<\\/h3>\\s*<p>Quick calculators and lookups will appear here\\.<\\/p>\\s*<\\/div>\\s*$end:math:text$\}`,
  'm'
);

if (placeholderRe.test(s)) {
  s = s.replace(
    placeholderRe,
    `{showZoningTools && (\n          <ZoningTools activeCity={activeCity} detectedZone={detectedZone} />\n        )}`
  );
  console.log('✔ Replaced placeholder Zoning Tools block');
} else if (!/ZoningTools activeCity=\{activeCity\} detectedZone=\{detectedZone\}/.test(s)) {
  console.warn('⚠ Could not find placeholder; ZoningTools usage not detected either. No change to block.');
} else {
  console.log('↷ ZoningTools usage already present');
}

fs.writeFileSync(file, s);
console.log('✅ Patched', file);
