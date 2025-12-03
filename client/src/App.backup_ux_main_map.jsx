import React, { useEffect, useRef, useState } from 'react';

import HeroSearch from './components/HeroSearch.jsx';
import MapView from './MapView.jsx';
import ApplicationsPanel from './components/ApplicationsPanel.jsx';
import ZoningTools from './components/ZoningTools.jsx';
import ReportsPanel from './components/ReportsPanel.jsx';
import { getSearchInsights } from './lib/openaiClient.js';
import './styles.css';

// --- helpers ---
function extractZoningDistrict(q='') {
  const m = (q || '').toUpperCase().match(/\b([RTMUCDI]-?\d+|RS-?\d+|RM-?\d+|C-?\d+|CBD|MU|UC|TC)\b/);
  return m ? m[1] : '';
}
function isAbort(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('abort') || msg.includes('aborted') || msg.includes('signal is aborted');
}

export default function App() {
  // --- mode & search ---
  const [mode, setMode] = useState('search'); // 'search' | 'dictionary'
  const [query, setQuery] = useState('');
  const [insights, setInsights] = useState('');
  const [status, setStatus] = useState('idle'); // idle|typing|loading|done|error
  const [errorMsg, setErrorMsg] = useState('');

  // --- panels ---
  const [showApplications, setShowApplications] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showZoningTools, setShowZoningTools] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showFeasibility, setShowFeasibility] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  
  const [newAppInit, setNewAppInit] = useState(null);
// --- city/county ---
  const [activeCity, setActiveCity] = useState({ id: 'FL-000', name: 'Florida (statewide)' });
  const [cityOpen, setCityOpen] = useState(false);

  // --- derived ---
  const [detectedZone, setDetectedZone] = useState('');
  useEffect(() => { setDetectedZone(extractZoningDistrict(query)); }, [query]);

  // --- lifecycle / debounce ---
  const mountedRef = useRef(true);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  useEffect(() => () => { mountedRef.current = false; abortRef.current?.abort(); }, []);

  
  useEffect(() => {
    function onNewApp(e) {
      const init = e?.detail || {};
      setNewAppInit(init);
      setShowMap(false);
      setShowZoningTools(false);
      setShowReports(false);
      setShowFeasibility(false);
      setShowApplications(true);
      setDrawerOpen(false);
    }
    window.addEventListener('myzone:new-application', onNewApp);
    return () => window.removeEventListener('myzone:new-application', onNewApp);
  }, []);
// --- event bridge (must be after state hooks are defined) ---
  useEffect(() => {
    function openMap() {
      setShowApplications(false);
      setShowZoningTools(false);
      setShowReports(false);
      setShowFeasibility(false);
      setShowMap(true);
      setDrawerOpen(false);
    }
    function onInsight(e) {
      const p = e?.detail?.prompt || '';
      if (!p) return;
      setMode('search');
      setQuery(p);
      // optional: immediate run
      runSearchOnce(p);
    }
    window.addEventListener('myzone:open-map', openMap);
    window.addEventListener('myzone:insight', onInsight);
    return () => {
      window.removeEventListener('myzone:open-map', openMap);
      window.removeEventListener('myzone:insight', onInsight);
    };
  }, []);

  // --- search runner ---
  async function fetchInsights(currQuery, ctrl) {
    return getSearchInsights(
      currQuery,
      mode === 'dictionary'
        ? { mode: 'dictionary' }
        : { mode: 'search', cityName: activeCity.name, cityId: activeCity.id, zoningDistrict: detectedZone },
      { signal: ctrl.signal, timeoutMs: 15000 }
    );
  }

  const runSearchOnce = async (forced) => {
    const q = (forced ?? query).trim();
    if (!q) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus('loading');
    setErrorMsg('');
    try {
      const text = await fetchInsights(q, ctrl);
      if (!mountedRef.current) return;
      setInsights(text);
      setStatus('done');
    } catch (e) {
      if (isAbort(e)) return;
      if (!mountedRef.current) return;
      setErrorMsg(e.message || 'Search failed');
      setStatus('error');
      console.error('[MyZone AI] fetch error:', e);
    }
  };

  // live debounce
  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setStatus(query ? 'typing' : 'idle');
      if (!query) setInsights('');
      return;
    }
    setStatus('typing');

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setStatus('loading');
      setErrorMsg('');
      try {
        const text = await fetchInsights(query.trim(), ctrl);
        if (!mountedRef.current) return;
        setInsights(text);
        setStatus('done');
      } catch (e) {
        if (isAbort(e)) return;
        if (!mountedRef.current) return;
        setErrorMsg(e.message || 'Search failed');
        setStatus('error');
        console.error('[MyZone AI] live fetch error:', e);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode, activeCity, detectedZone]);

  const onKeyDown = (e) => { if (e.key === 'Enter') runSearchOnce(); };

  // open one panel at a time
  const openOnly = (fn) => {
    setShowApplications(false);
    setShowMap(false);
    setShowZoningTools(false);
    setShowReports(false);
    setShowFeasibility(false);
    fn(true);
    setDrawerOpen(false);
  };

  // simple Insights pane
  function InsightsPane({ content, status, error }) {
    if (status === 'error') return <section className="mz-card"><h3>AI Insights</h3><p className="err">{error}</p></section>;
    if (status === 'loading') return <section className="mz-card"><h3>AI Insights</h3><p>Analyzing your query…</p></section>;
    if (status === 'done') return <section className="mz-card"><h3>AI Insights</h3><div className="insights" dangerouslySetInnerHTML={{__html: content.replace(/\n/g,'<br/>')}} /></section>;
    return null;
  }

  return (
    <div className="mz-app">
      <header className="mz-topbar">
        <button className="mz-icon-btn" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>☰</button>
        <div className="mz-brand">
          <div className="mz-title">MyZone</div>
          <div className="mz-subtitle">
            {mode === 'search' ? `${activeCity?.name} • SEARCH` : `Definitions / Dictionary`}
          </div>
        </div>
        <button className="mz-btn ghost" onClick={() => setCityOpen(true)}>Select City</button>
      </header>

      <section className="mz-hero">
        <h1 className="mz-hero-title">
          {mode === 'search' ? 'Zoning & development insights' : 'Definitions & glossary'}
        </h1>

        <div className="mz-mode-toggle" role="tablist" aria-label="Mode">
          <button className={`mode-chip ${mode==='search'?'active':''}`} onClick={() => setMode('search')} role="tab" aria-selected={mode==='search'}>Search</button>
          <button className={`mode-chip ${mode==='dictionary'?'active':''}`} onClick={() => setMode('dictionary')} role="tab" aria-selected={mode==='dictionary'}>Dictionary</button>
        </div>

        <div className="mz-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              mode === 'dictionary'
                ? "Define a term: FAR, lot coverage, transect zone, TOD…"
                : "Search: address, parcel, district (e.g., RS-2), parking, setbacks…"
            }
            aria-label="Search"
          />
          <button className="mz-btn" onClick={() => runSearchOnce()} disabled={status==='loading'}>
            {status==='loading' ? 'Thinking…' : 'Search'}
          </button>
        </div>

        <div className="mz-context-row">
          {mode === 'search' && (
            <>
              <span className="badge">City/County: {activeCity?.name}</span>
              {detectedZone && <span className="badge accent">Zone: {detectedZone}</span>}
            </>
          )}
          <div className="mz-live-indicator" aria-live="polite">
            {status === 'loading' ? 'Live AI: analyzing…' :
             status === 'done' ? 'Live AI: updated' :
             status === 'typing' ? 'Live AI: waiting for pause…' :
             status === 'error' ? 'Live AI: error' : ''}
          </div>
        </div>

        <div className="mz-tiles">
          <button className="tile" onClick={() => openOnly(setShowApplications)}>
            <div className="tile-title">Applications</div>
            <div className="tile-sub">Create, upload, review</div>
          </button>
          <button className="tile" onClick={() => openOnly(setShowMap)}>
            <div className="tile-title">Map</div>
            <div className="tile-sub">Parcels, layers, queries</div>
          </button>
          <button className="tile" onClick={() => openOnly(setShowZoningTools)}>
            <div className="tile-title">Zoning Tools</div>
            <div className="tile-sub">Lookups &amp; calculators</div>
          </button>
          <button className="tile" onClick={() => openOnly(setShowReports)}>
            <div className="tile-title">Reports</div>
            <div className="tile-sub">Use summary, parking, buffers</div>
          </button>
          <button className="tile" onClick={() => openOnly(setShowFeasibility)}>
            <div className="tile-title">Feasibility</div>
            <div className="tile-sub">Capacity &amp; pathways</div>
          </button>
          <button className="tile" onClick={() => { setMode('dictionary'); setInsights(''); }}>
            <div className="tile-title">Definitions / Dictionary</div>
            <div className="tile-sub">Live terms & concepts</div>
          </button>
        </div>
      </section>

      <main className="mz-main">
  {/* Minimalist centered search */}
  {(status==='done' || status==='loading' || status==='error') && (
          <InsightsPane content={insights} status={status} error={errorMsg} />
        )}

        {showApplications && <ApplicationsPanel activeCity={activeCity}  newAppInit={newAppInit} />}
        {showMap && <MapView />}
        {showZoningTools && <ZoningTools activeCity={activeCity} detectedZone={detectedZone} />}
        {showReports && <ReportsPanel activeCity={activeCity} />}
        {showFeasibility && (
          <div className="mz-card">
            <h3>Feasibility</h3>
            <p>Early capacity checks and entitlement pathways — coming soon.</p>
          </div>
        )}
      </main>
    </div>
  );
}
