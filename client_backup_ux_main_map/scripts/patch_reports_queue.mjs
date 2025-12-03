// scripts/patch_reports_queue.mjs
import fs from 'node:fs';

const file = 'src/components/ReportsPanel.jsx';
let s = fs.readFileSync(file, 'utf8');

// Replace the showOnMap() body: store request globally, then open map
s = s.replace(
/function showOnMap\(\)\s*\{[\s\S]*?\}\n/,
`function showOnMap() {
  if (!geoChosen) { alert('Pick an address/place first.'); return; }
  const lat = Number(geoChosen.lat), lon = Number(geoChosen.lon);
  // Queue for MapView to consume after it mounts
  window.__myzonePendingBuffer = { lat, lon, radiusFeet: Number(distanceFt) };
  // Open the map; MapView will draw when ready
  window.dispatchEvent(new CustomEvent('myzone:open-map'));
}
`
);

fs.writeFileSync(file, s);
console.log('✅ Queuing buffer in ReportsPanel (showOnMap)');
