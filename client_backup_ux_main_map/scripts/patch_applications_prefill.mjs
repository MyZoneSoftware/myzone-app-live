import fs from 'node:fs';

const file = 'src/components/ApplicationsPanel.jsx';
let s = fs.readFileSync(file, 'utf8');
let changed = false;

// Ensure component signature accepts the prop
if (s.includes('export default function ApplicationsPanel(') && !s.includes('{ newAppInit')) {
  s = s.replace(
    /export default function ApplicationsPanel\(([^)]*)\)\s*\{/,
    (m, args) => {
      const argsTrim = args.trim();
      if (argsTrim.startsWith('{') && argsTrim.endsWith('}')) {
        // has props object
        if (!argsTrim.includes('newAppInit')) {
          const injected = argsTrim.replace(/\}$/, ', newAppInit }');
          changed = true;
          return `export default function ApplicationsPanel(${injected}) {`;
        }
      } else {
        changed = true;
        return `export default function ApplicationsPanel(${args ? args + ', ' : ''}{ newAppInit }) {`;
      }
      return m;
    }
  );
}

// Prefill effect: only once per newAppInit change
if (!s.includes('useEffect(() => { // prefill from newAppInit')) {
  s = s.replace(
    /(\n\s*const\s*\[\w+,\s*set\w+\]\s*=\s*useState\([^\)]*\);\s*)+/m, // after some state lines
    (m) => m + `
  // Prefill from newAppInit (map → application)
  useEffect(() => { // prefill from newAppInit
    if (!newAppInit) return;
    try {
      // Safely set common fields if your panel has them; adjust names as needed.
      if (typeof setParcelId === 'function' && newAppInit.parcelId) setParcelId(newAppInit.parcelId);
      if (typeof setAddress === 'function' && newAppInit.address) setAddress(newAppInit.address);
      if (typeof setOwner === 'function' && newAppInit.owner) setOwner(newAppInit.owner);
      if (typeof setSiteAcres === 'function' && newAppInit.acres) setSiteAcres(newAppInit.acres);
      if (typeof setSource === 'function') setSource('map');
    } catch (e) { console.warn('prefill error', e); }
  }, [newAppInit]);
`
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, s);
  console.log('✅ ApplicationsPanel patched: accepts newAppInit & prefills fields');
} else {
  console.log('↷ ApplicationsPanel already patched or patterns not found.');
}
