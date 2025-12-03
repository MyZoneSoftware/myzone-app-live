import React, { useEffect, useMemo, useState } from 'react';

/**
 * ZoningTools
 * - Quick calculators for Setbacks, Lot Coverage, FAR.
 * - Neutral defaults with ability to override.
 * - Shows buildable area estimate and compact summary.
 *
 * Props:
 *   activeCity?: { id, name, type }
 *   detectedZone?: string
 */

function num(v, d=0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function round(n, p=2){ return Math.round(n * 10**p) / 10**p; }

export default function ZoningTools({ activeCity, detectedZone }) {
  // Lot inputs
  const [lotWidth, setLotWidth]   = useState(75);   // feet
  const [lotDepth, setLotDepth]   = useState(120);  // feet
  const lotArea = useMemo(() => round(num(lotWidth)*num(lotDepth), 2), [lotWidth, lotDepth]);

  // Typical neutral defaults (overrideable)
  const [frontSet, setFrontSet]   = useState(25);
  const [sideSet, setSideSet]     = useState(7.5);
  const [rearSet, setRearSet]     = useState(25);

  // FAR & coverage
  const [maxFAR, setMaxFAR]       = useState(0.5);  // typical low-density default
  const [maxCoverage, setMaxCoverage] = useState(40); // %

  // Height (informative only for now)
  const [maxStories, setMaxStories] = useState(2);
  const [maxHeightFt, setMaxHeightFt] = useState(35);

  // Buildable area (simple rectangle: subtract front/rear from depth, two sides from width)
  const buildableDims = useMemo(() => {
    const bw = Math.max(0, num(lotWidth) - 2*num(sideSet));
    const bd = Math.max(0, num(lotDepth) - num(frontSet) - num(rearSet));
    return { bw: round(bw,2), bd: round(bd,2) };
  }, [lotWidth, lotDepth, frontSet, sideSet, rearSet]);

  const buildableArea = useMemo(() => round(buildableDims.bw * buildableDims.bd, 2), [buildableDims]);

  // Coverage & FAR outputs
  const coverageMaxSf = useMemo(() => round(lotArea * (num(maxCoverage)/100), 2), [lotArea, maxCoverage]);
  const farMaxSf = useMemo(() => round(lotArea * num(maxFAR), 2), [lotArea, maxFAR]);

  // Heuristic nudge from detected zone (if present)
  useEffect(() => {
    if (!detectedZone) return;
    const z = detectedZone.toUpperCase();
    // Gentle presets; user can still edit
    if (/^RS|^R-?1$|^R-?2$/.test(z)) {
      setFrontSet(25); setSideSet(7.5); setRearSet(25);
      setMaxCoverage(35); setMaxFAR(0.45); setMaxStories(2); setMaxHeightFt(35);
    } else if (/^R-?3|RM/.test(z)) {
      setFrontSet(20); setSideSet(10); setRearSet(20);
      setMaxCoverage(50); setMaxFAR(1.0); setMaxStories(3); setMaxHeightFt(45);
    } else if (/^C|^NC|^UC|^TC|CBD|DC|DG/.test(z)) {
      setFrontSet(0); setSideSet(5); setRearSet(10);
      setMaxCoverage(70); setMaxFAR(2.0); setMaxStories(5); setMaxHeightFt(65);
    }
  }, [detectedZone]);

  return (
    <section className="ztools-card">
      <div className="ztools-head">
        <div className="ztools-title">Zoning Tools</div>
        <div className="ztools-context">
          {activeCity?.name && <span className="badge">Jurisdiction: {activeCity.name}</span>}
          {detectedZone && <span className="badge accent">Zone: {detectedZone}</span>}
        </div>
      </div>

      <div className="ztools-grid">
        {/* Lot */}
        <div className="zbox">
          <div className="zbox-title">Lot</div>
          <div className="zrow">
            <label>Width (ft)<input type="number" value={lotWidth} onChange={e=>setLotWidth(e.target.value)} /></label>
            <label>Depth (ft)<input type="number" value={lotDepth} onChange={e=>setLotDepth(e.target.value)} /></label>
          </div>
          <div className="zmeta">Lot Area: <strong>{lotArea.toLocaleString()} sf</strong></div>
        </div>

        {/* Setbacks */}
        <div className="zbox">
          <div className="zbox-title">Setbacks</div>
          <div className="zrow">
            <label>Front (ft)<input type="number" value={frontSet} onChange={e=>setFrontSet(e.target.value)} /></label>
            <label>Side (ft)<input type="number" value={sideSet} onChange={e=>setSideSet(e.target.value)} /></label>
            <label>Rear (ft)<input type="number" value={rearSet} onChange={e=>setRearSet(e.target.value)} /></label>
          </div>
          <div className="zmeta">
            Buildable Footprint: <strong>{buildableDims.bw}’ × {buildableDims.bd}’</strong> = <strong>{buildableArea.toLocaleString()} sf</strong>
          </div>
        </div>

        {/* Coverage */}
        <div className="zbox">
          <div className="zbox-title">Lot Coverage</div>
          <div className="zrow">
            <label>Max Coverage (%)<input type="number" value={maxCoverage} onChange={e=>setMaxCoverage(e.target.value)} /></label>
          </div>
          <div className="zmeta">
            Max Building Footprint: <strong>{coverageMaxSf.toLocaleString()} sf</strong>
            {buildableArea > 0 && (
              <> • Envelope limit: <strong>{Math.min(coverageMaxSf, buildableArea).toLocaleString()} sf</strong></>
            )}
          </div>
        </div>

        {/* FAR */}
        <div className="zbox">
          <div className="zbox-title">Floor Area Ratio (FAR)</div>
          <div className="zrow">
            <label>Max FAR<input type="number" step="0.01" value={maxFAR} onChange={e=>setMaxFAR(e.target.value)} /></label>
            <label>Max Stories<input type="number" value={maxStories} onChange={e=>setMaxStories(e.target.value)} /></label>
            <label>Max Height (ft)<input type="number" value={maxHeightFt} onChange={e=>setMaxHeightFt(e.target.value)} /></label>
          </div>
          <div className="zmeta">
            Max Total Floor Area: <strong>{farMaxSf.toLocaleString()} sf</strong>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="zsummary">
        <div className="zsummary-title">Quick Summary</div>
        <ul>
          <li><strong>Lot</strong>: {lotWidth}’ × {lotDepth}’ ({lotArea.toLocaleString()} sf)</li>
          <li><strong>Setbacks</strong>: Front {frontSet}’, Side {sideSet}’, Rear {rearSet}’ → Buildable {buildableArea.toLocaleString()} sf</li>
          <li><strong>Coverage</strong>: {maxCoverage}% → Max footprint {coverageMaxSf.toLocaleString()} sf (practical limit {Math.min(coverageMaxSf, buildableArea).toLocaleString()} sf)</li>
          <li><strong>FAR</strong>: {maxFAR} → Max total floor area {farMaxSf.toLocaleString()} sf; {maxStories} stories / {maxHeightFt}’ (if applicable)</li>
          <li className="muted">Typical ranges shown; local code controls.</li>
        </ul>
      </div>
    </section>
  );
}
