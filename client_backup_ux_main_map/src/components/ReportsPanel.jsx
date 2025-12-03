import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchPlaces } from '../lib/nominatim.js';
import { getSearchInsights } from '../lib/openaiClient.js';

/**
 * ReportsPanel
 * - Use Summary + Buffer Report
 * - Actions:
 *    • Show on Map  → queues a buffer for MapView
 *    • Send to Insights → directly calls OpenAI and surfaces output via AIDebug overlay
 *    • Print / Save PDF  • Copy as Markdown
 */

function num(v, d=0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function round(n, p=2){ return Math.round(n * 10**p) / 10**p; }

function Section({ title, children, actions }) {
  return (
    <div className="rep-box">
      <div className="rep-box-head">
        <div className="rep-box-title">{title}</div>
        <div className="rep-box-actions">{actions}</div>
      </div>
      {children}
    </div>
  );
}

export default function ReportsPanel({ activeCity }) {
  // ---------- Use Summary ----------
  const [useType, setUseType] = useState('Multifamily (apartment)');
  const [siteArea, setSiteArea] = useState(20000); // sf
  const [units, setUnits] = useState(24);
  const [grossFloorArea, setGrossFloorArea] = useState(30000); // sf
  const [parkingRate, setParkingRate] = useState(1.5); // spaces per unit
  const [parkingRateAlt, setParkingRateAlt] = useState(3.0); // spaces / 1000 sf
  const [landscapePct, setLandscapePct] = useState(10);
  const [bikePctOfAuto, setBikePctOfAuto] = useState(10);
  const [evPctOfAuto, setEvPctOfAuto] = useState(5);

  const isResidential = /multi|apart|res/i.test(useType);

  const parkingReq = useMemo(() => {
    if (isResidential) return round(num(units) * num(parkingRate), 2);
    return round((num(grossFloorArea) / 1000) * num(parkingRateAlt), 2);
  }, [isResidential, units, parkingRate, grossFloorArea, parkingRateAlt]);

  const bikeReq = useMemo(() => round(parkingReq * (num(bikePctOfAuto)/100), 2), [parkingReq, bikePctOfAuto]);
  const evReq   = useMemo(() => round(parkingReq * (num(evPctOfAuto)/100), 2), [parkingReq, evPctOfAuto]);
  const landscapeSf = useMemo(() => round(num(siteArea) * (num(landscapePct)/100), 2), [siteArea, landscapePct]);

  const densityUnitsPerAcre = useMemo(() => {
    const ac = num(siteArea) / 43560;
    return ac > 0 ? round(num(units)/ac,2) : 0;
  }, [siteArea, units]);

  const far = useMemo(() => {
    const sa = num(siteArea);
    return sa > 0 ? round(num(grossFloorArea)/sa, 2) : 0;
  }, [siteArea, grossFloorArea]);

  // ---------- Buffer Report ----------
  const [addr, setAddr] = useState('');
  const [distanceFt, setDistanceFt] = useState(300); // feet
  const [geocodeHits, setGeocodeHits] = useState([]);
  const [geoChosen, setGeoChosen] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!addr || addr.trim().length < 3) { setGeocodeHits([]); return; }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const results = await searchPlaces(addr.trim(), { signal: ctrl.signal });
        setGeocodeHits(results);
      } catch (e) {
        if ((e.name||'').includes('Abort')) return;
        console.error('geocoder', e);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [addr]);

  const pickGeocode = (hit) => {
    setGeoChosen(hit);
    setAddr(hit.display_name);
    setGeocodeHits([]);
  };

  // Show buffer on map (queue for MapView)
  function showOnMap() {
    if (!geoChosen) { alert('Pick an address/place first.'); return; }
    const lat = Number(geoChosen.lat), lon = Number(geoChosen.lon);
    window.__myzonePendingBuffer = { lat, lon, radiusFeet: Number(distanceFt) };
    window.dispatchEvent(new CustomEvent('myzone:open-map'));
  }

  // Build prompt for Insights
  function buildInsightsPrompt() {
    const lines = [];
    lines.push('Summarize compliance considerations and typical standards for this scenario; note jurisdiction-specific checks.');
    lines.push(`Jurisdiction: ${activeCity?.name || '—'}`);
    lines.push(`Use Type: ${useType}`);
    lines.push(`Site Area: ${Number(siteArea).toLocaleString()} sf`);
    lines.push(`Units: ${units}`);
    lines.push(`Gross Floor Area: ${Number(grossFloorArea).toLocaleString()} sf (FAR ${far})`);
    lines.push(`Parking: ${parkingReq} spaces (${isResidential ? `${parkingRate}/unit` : `${parkingRateAlt}/1,000 sf`}); Bikes ${bikeReq}; EV-ready ${evReq}`);
    lines.push(`Landscape: ${landscapeSf.toLocaleString()} sf (${landscapePct}%)`);
    if (geoChosen) {
      lines.push(`Buffer: ${Number(distanceFt).toLocaleString()} ft around ${geoChosen.display_name}`);
    }
    return lines.join(' | ');
  }

  // Direct OpenAI call from here
  const [sending, setSending] = useState(false);
  async function sendToInsights() {
    try {
      setSending(true);
      const prompt = buildInsightsPrompt();
      // Emit so other parts (if listening) can also react
      try { window.dispatchEvent(new CustomEvent('myzone:insight', { detail: { prompt } })); } catch {}

      // Call OpenAI directly; result will appear in AI Debug overlay via openaiClient's event
      await getSearchInsights(
        prompt,
        { mode: 'search', cityName: activeCity?.name || '—', cityId: activeCity?.id || '—', zoningDistrict: '' },
        { timeoutMs: 15000 }
      );
    } catch (e) {
      console.error('sendToInsights error', e);
      try {
        window.dispatchEvent(new CustomEvent('myzone:ai-debug', {
          detail: { ok: false, error: String(e?.message || e) }
        }));
      } catch {}
      alert('AI request failed. See console for details.');
    } finally {
      setSending(false);
    }
  }

  const bufferSummary = useMemo(() => {
    if (!geoChosen) return null;
    const lat = Number(geoChosen.lat), lon = Number(geoChosen.lon);
    const ft = Number(distanceFt);
    const meters = round(ft * 0.3048, 2);
    return {
      title: 'Buffer Summary',
      rows: [
        ['Address / Place', geoChosen.display_name],
        ['Latitude, Longitude', `${lat.toFixed(6)}, ${lon.toFixed(6)}`],
        ['Radius', `${ft.toLocaleString()} ft (${meters.toLocaleString()} m)`],
        ['Jurisdiction (UI)', activeCity?.name || '—'],
        ['Notes', 'This is a visual/textual buffer summary. For intersecting features, connect a parcels/POI layer.']
      ]
    };
  }, [geoChosen, distanceFt, activeCity]);

  // ---------- Export helpers ----------
  const mdRef = useRef(null);
  const buildMarkdown = () => {
    const lines = [];
    lines.push(`# Use Summary`);
    lines.push(`Jurisdiction: ${activeCity?.name || '—'}`);
    lines.push(`Use Type: ${useType}`);
    lines.push(``);
    lines.push(`- Site Area: ${Number(siteArea).toLocaleString()} sf`);
    lines.push(`- Units: ${units}`);
    lines.push(`- Gross Floor Area: ${Number(grossFloorArea).toLocaleString()} sf`);
    lines.push(`- FAR: ${far}`);
    lines.push(`- Parking Required: ${parkingReq} spaces`);
    lines.push(`  - Bicycle: ${bikeReq} spaces (≈ ${bikePctOfAuto}% of auto)`);
    lines.push(`  - EV-ready: ${evReq} spaces (≈ ${evPctOfAuto}% of auto)`);
    lines.push(`- Landscape Area: ${landscapeSf.toLocaleString()} sf (${landscapePct}%)`);
    lines.push(`- Density: ${densityUnitsPerAcre} du/ac`);
    lines.push(``);
    lines.push(`# Buffer Report`);
    if (bufferSummary) {
      bufferSummary.rows.forEach(([k,v]) => lines.push(`- ${k}: ${v}`));
    } else {
      lines.push(`- Address / Place: —`);
      lines.push(`- Radius: ${Number(distanceFt).toLocaleString()} ft`);
    }
    lines.push(``);
    lines.push(`_Typical values shown; local code controls._`);
    return lines.join('\n');
  };
  const [md, setMd] = useState('');
  useEffect(()=>{ setMd(buildMarkdown()); /* eslint-disable-next-line */ }, [
    useType, siteArea, units, grossFloorArea,
    parkingRate, parkingRateAlt, landscapePct, bikePctOfAuto, evPctOfAuto,
    densityUnitsPerAcre, far, bufferSummary, distanceFt, activeCity
  ]);

  function copyMarkdown() {
    navigator.clipboard.writeText(md).then(()=> {
      alert('Markdown copied.');
    }).catch(()=> alert('Copy failed.'));
  }
  function printReport() {
    window.print();
  }

  return (
    <section className="reports-card" id="reports-root">
      <div className="reports-head">
        <div className="reports-title">Reports</div>
        <div className="reports-actions">
          <button className="mz-btn" onClick={printReport}>Print / Save PDF</button>
          <button className="mz-btn ghost" onClick={copyMarkdown}>Copy as Markdown</button>
        </div>
      </div>

      {/* Use Summary */}
      <Section title="Use Summary" actions={null}>
        <div className="rep-grid">
          <label>
            <div className="lab">Jurisdiction</div>
            <input value={activeCity?.name || ''} readOnly placeholder="Select City / County" />
          </label>
          <label className="col2">
            <div className="lab">Use Type</div>
            <select value={useType} onChange={e=>setUseType(e.target.value)}>
              <option>Multifamily (apartment)</option>
              <option>Townhomes</option>
              <option>Single-family</option>
              <option>Retail</option>
              <option>Restaurant</option>
              <option>Office</option>
              <option>Warehouse</option>
              <option>Hotel</option>
              <option>School</option>
            </select>
          </label>

          <label>
            <div className="lab">Site Area (sf)</div>
            <input type="number" value={siteArea} onChange={e=>setSiteArea(e.target.value)} />
          </label>
          <label>
            <div className="lab">Units</div>
            <input type="number" value={units} onChange={e=>setUnits(e.target.value)} />
          </label>
          <label>
            <div className="lab">Gross Floor Area (sf)</div>
            <input type="number" value={grossFloorArea} onChange={e=>setGrossFloorArea(e.target.value)} />
          </label>

          {isResidential ? (
            <label>
              <div className="lab">Parking Rate (spaces / unit)</div>
              <input type="number" step="0.01" value={parkingRate} onChange={e=>setParkingRate(e.target.value)} />
            </label>
          ) : (
            <label>
              <div className="lab">Parking Rate (spaces / 1,000 sf)</div>
              <input type="number" step="0.1" value={parkingRateAlt} onChange={e=>setParkingRateAlt(e.target.value)} />
            </label>
          )}
          <label>
            <div className="lab">Landscape % of Site</div>
            <input type="number" step="0.1" value={landscapePct} onChange={e=>setLandscapePct(e.target.value)} />
          </label>
          <label>
            <div className="lab">Bicycle Spaces (% of auto)</div>
            <input type="number" step="1" value={bikePctOfAuto} onChange={e=>setBikePctOfAuto(e.target.value)} />
          </label>
          <label>
            <div className="lab">EV-Ready Spaces (% of auto)</div>
            <input type="number" step="1" value={evPctOfAuto} onChange={e=>setEvPctOfAuto(e.target.value)} />
          </label>
        </div>

        <div className="rep-out">
          <div className="rep-out-title">Outputs</div>
          <ul>
            <li><strong>Parking required:</strong> {parkingReq} spaces ({isResidential ? `${parkingRate} / unit` : `${parkingRateAlt} / 1,000 sf`})</li>
            <li><strong>Bicycle spaces:</strong> {bikeReq} (≈ {bikePctOfAuto}% of auto)</li>
            <li><strong>EV-ready spaces:</strong> {evReq} (≈ {evPctOfAuto}% of auto)</li>
            <li><strong>Landscape area:</strong> {landscapeSf.toLocaleString()} sf ({landscapePct}%)</li>
            <li><strong>FAR:</strong> {far}</li>
            <li><strong>Density:</strong> {densityUnitsPerAcre} du/ac</li>
            <li className="muted">Typical ranges shown; local code controls.</li>
          </ul>
        </div>
      </Section>

      {/* Buffer Report */}
      <Section
        title="Buffer Report"
        actions={<div className="rep-action-inline">
          <button className="mz-btn" onClick={showOnMap}>Show on Map</button>
          <button className="mz-btn ghost" onClick={sendToInsights} disabled={sending}>
            {sending ? 'Sending…' : 'Send to Insights'}
          </button>
        </div>}
      >
        <div className="rep-grid">
          <label className="col2">
            <div className="lab">Address / Place</div>
            <input
              value={addr}
              onChange={e=>setAddr(e.target.value)}
              placeholder="e.g., 100 S Biscayne Blvd, Miami FL"
            />
            {geocodeHits.length > 0 && (
              <div className="map-search-results" style={{position:'relative', inset:'auto', maxHeight:160}}>
                {geocodeHits.map(hit => (
                  <div key={hit.place_id} className="map-search-item" onClick={()=>pickGeocode(hit)}>
                    {hit.display_name}
                  </div>
                ))}
              </div>
            )}
          </label>
          <label>
            <div className="lab">Radius (feet)</div>
            <input type="number" value={distanceFt} onChange={e=>setDistanceFt(e.target.value)} />
          </label>
          <label>
            <div className="lab">Jurisdiction (UI)</div>
            <input value={activeCity?.name || ''} readOnly placeholder="Select City / County" />
          </label>
        </div>

        <div className="rep-out">
          <div className="rep-out-title">Summary</div>
          {!bufferSummary ? (
            <div className="mz-empty">Pick an address/place to generate a buffer summary.</div>
          ) : (
            <table className="rep-table">
              <tbody>
                {bufferSummary.rows.map(([k,v]) => (
                  <tr key={k}><th>{k}</th><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      {/* Hidden Markdown source for copy */}
      <textarea ref={mdRef} value={md} readOnly style={{position:'absolute', left:-9999, width:1, height:1, opacity:0}} aria-hidden />
    </section>
  );
}
