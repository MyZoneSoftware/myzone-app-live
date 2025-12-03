import fs from 'node:fs';

const file = 'src/MapView.jsx';
let s = fs.readFileSync(file, 'utf8');
let changed = false;

// Ensure popup has a CTA button that dispatches a custom event with parcel data
const marker = 'const content = `';
if (s.includes(marker) && !s.includes('data-newapp="1"')) {
  s = s.replace(
    /const content = `([\s\S]*?)`;\s*layer\.bindPopup/,
    (m, inner) => {
      const injected = inner.replace(
        /<\/div>\s*`;\s*layer\.bindPopup/s,
        `
            <div style="margin-top:8px;">
              <button data-newapp="1" style="border:1px solid #ddd;border-radius:8px;padding:6px 10px;background:#fff;cursor:pointer;">Create Application</button>
            </div>
          </div>\`
        ; layer.bindPopup`
      );
      return `const content = \`${injected}`;
    }
  );
  changed = true;
}

// Add click handler on popup to dispatch event with properties
if (!s.includes('myzone:new-application')) {
  s = s.replace(
    /layer\.on\(\{\s*mouseover:[\s\S]*?click:\s*\(\)\s*=>\s*\{\s*const props = feature\.properties \|\| \{\};\s*const content =/m,
    match => {
      return match.replace(
        'const content =',
        `// wire "Create Application" button
        setTimeout(() => {
          try {
            const el = document.querySelector('.leaflet-popup-content [data-newapp="1"]');
            if (el) {
              el.onclick = () => {
                const payload = {
                  source: 'map',
                  parcelId: props.parcel_id || props.PARCEL_ID || props.id || '',
                  address: props.addr || props.ADDRESS || props.situs || '',
                  acres: props.acres || props.ACRES || '',
                  owner: props.owner || props.OWNER || '',
                  geomHint: true
                };
                window.dispatchEvent(new CustomEvent('myzone:new-application', { detail: payload }));
              };
            }
          } catch {}
        }, 0);
        const content =`
      );
    }
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, s);
  console.log('✅ MapView patched: parcel popup now has "Create Application"');
} else {
  console.log('↷ MapView already patched or pattern not found.');
}
