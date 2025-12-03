// scripts/patch_reports_bridge.mjs
import fs from 'node:fs';

const file = 'src/components/ReportsPanel.jsx';
let s = fs.readFileSync(file, 'utf8');

// 1) Ensure action handlers exist (showOnMap, sendToInsights)
if (!s.includes('function showOnMap()')) {
  s = s.replace(
    /const pickGeocode =.*?;\n/s,
    (m) => m + `
  // Bridge actions
  function showOnMap() {
    if (!geoChosen) { alert('Pick an address/place first.'); return; }
    const lat = Number(geoChosen.lat), lon = Number(geoChosen.lon);
    window.dispatchEvent(new CustomEvent('myzone:draw-buffer', {
      detail: { lat, lon, radiusFeet: Number(distanceFt) }
    }));
    window.dispatchEvent(new CustomEvent('myzone:open-map'));
  }

  function sendToInsights() {
    const lines = [];
    lines.push('Summarize compliance considerations and typical standards for this scenario; note jurisdiction-specific checks.');
    lines.push(\`Jurisdiction: \${activeCity?.name || '—'}\`);
    lines.push(\`Use Type: \${useType}\`);
    lines.push(\`Site Area: \${Number(siteArea).toLocaleString()} sf\`);
    lines.push(\`Units: \${units}\`);
    lines.push(\`Gross Floor Area: \${Number(grossFloorArea).toLocaleString()} sf (FAR \${far})\`);
    lines.push(\`Parking: \${parkingReq} spaces (\${/multi|apart|res/i.test(useType) ? \`\${parkingRate}/unit\` : \`\${parkingRateAlt}/1,000 sf\`}); Bikes \${bikeReq}; EV-ready \${evReq}\`);
    lines.push(\`Landscape: \${landscapeSf.toLocaleString()} sf (\${landscapePct}%)\`);
    if (geoChosen) {
      lines.push(\`Buffer: \${Number(distanceFt).toLocaleString()} ft around \${geoChosen.display_name}\`);
    }
    const prompt = lines.join(' | ');
    window.dispatchEvent(new CustomEvent('myzone:insight', { detail: { prompt } }));
  }
`
  );
}

// 2) Inject buttons into Buffer Report <Section ... actions={...}>
if (!/title="Buffer Report"[\s\S]*actions=/.test(s)) {
  // Replace the Buffer Section opening with one that includes actions
  s = s.replace(
`      <Section
        title="Buffer Report"
        actions={null}
      >`,
`      <Section
        title="Buffer Report"
        actions={<div className="rep-action-inline">
          <button className="mz-btn" onClick={showOnMap}>Show on Map</button>
          <button className="mz-btn ghost" onClick={sendToInsights}>Send to Insights</button>
        </div>}
      >`
  );
}

fs.writeFileSync(file, s);
console.log('✅ Patched', file);
