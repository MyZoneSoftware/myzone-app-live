import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import Tiles from '../components/Tiles';
import CitySelector from '../components/CitySelector';
import PancakeMenu from '../components/PancakeMenu';
import ResultsList from '../components/ResultsList';
import MapPanel from '../components/MapPanel';
import ApplicationsPanel from '../components/ApplicationsPanel';
import LoginRequired from '../components/LoginRequired';
import '../styles/landing.css';
import '../styles/panels.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5051';

export default function Landing() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('mz_auth') === '1');
  const [municipality, setMunicipality] = useState(localStorage.getItem('mz_muni') || '');
  const [cityOpen, setCityOpen] = useState(false);
  const [tabs, setTabs] = useState([{ id: 'home', title: 'Home', active: true }]);

  function setActive(id) { setTabs(prev => prev.map(t => ({ ...t, active: t.id === id }))); }
  function ensureTab(tab) {
    setTabs(prev => {
      const exists = prev.some(t => t.id === tab.id);
      return exists
        ? prev.map(t => (t.id === tab.id ? { ...t, ...tab } : { ...t, active: false }))
        : prev.map(t => ({ ...t, active: false })).concat({ ...tab, active: true });
    });
  }

  function toggleLogin() {
    const next = !isLoggedIn; setIsLoggedIn(next); localStorage.setItem('mz_auth', next ? '1' : '0');
  }
  function handleCitySelect(name) { setMunicipality(name); localStorage.setItem('mz_muni', name); ensureTab({ id: 'municipality', title: name, active: true }); }

  async function doSearch(query) {
    setBusy(true); setError(''); setResults([]);
    try {
      const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      const list = Array.isArray(data?.results) ? data.results : [];
      setResults(list);
      ensureTab({ id: 'results', title: 'Results', active: true });
    } catch (e) { setError(e.message || 'Search failed'); }
    finally { setBusy(false); }
  }

  function openMap(){ ensureTab({ id: 'map', title: 'Map', active: true }); }
  function openApplications(){ ensureTab({ id: 'applications', title: 'Applications', active: true }); }
  function openSelectCities(){ setCityOpen(true); }

  useEffect(() => {
    document.querySelector('.mz-tab.active')?.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
  }, [tabs]);

  const active = tabs.find(t => t.active)?.id || 'home';

  return (
    <div className="mz-landing">
      <Header isLoggedIn={isLoggedIn} onLoginToggle={toggleLogin} onToggleInfo={() => setDrawerOpen(true)} municipality={municipality} tabs={tabs} onTabClick={setActive} />
      <div className="mz-landing-box">
        <div className="mz-brand-hero" aria-label="Welcome to MyZone">Welcome to MyZone</div>
        <SearchBar onSubmit={doSearch} />
        <Tiles onOpenMap={openMap} onOpenApplications={openApplications} onOpenSelectCities={openSelectCities} />
        {busy && <div className="mz-hint">Searching…</div>}
        {error && <div className="mz-error" role="alert">{error}</div>}
        {active === 'results' && <ResultsList items={results} />}
        {active === 'applications' && (isLoggedIn ? <ApplicationsPanel /> : <LoginRequired onLogin={() => { localStorage.setItem('mz_auth','1'); setIsLoggedIn(true); }} />)}
        {active === 'map' && <MapPanel municipality={municipality} />}
        {active === 'municipality' && (<div style={{width:'min(900px, 94vw)'}}><h2 style={{fontSize:16, margin:'10px 0'}}>Municipality</h2><div className="mz-hint">Active: {municipality || 'None selected yet'}</div></div>)}
      </div>
      <footer className="mz-footer"><span>Search simplified.</span></footer>
      <CitySelector open={cityOpen} onClose={() => setCityOpen(false)} onSelect={handleCitySelect} />
      <PancakeMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} onOpenMap={openMap} onOpenApplications={openApplications} onOpenZoningTools={() => {}} onOpenReports={() => {}} onOpenFeasibility={() => {}} onOpenSelectCities={openSelectCities} />
    </div>
  );
}
