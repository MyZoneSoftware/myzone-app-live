import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

function CenteredSearchCard() {
  const [q, setQ] = useState('');
  const run = () => {
    const query = (q || '').trim();
    if (!query) return;
    try {
      window.dispatchEvent(new CustomEvent('myzone:hero-search', { detail: { query } }));
      window.dispatchEvent(new CustomEvent('myzone:hide-landing'));
    } catch (e) { console.warn('[Landing] dispatch failed', e); }
  };
  const onKey = (e) => { if (e.key === 'Enter') run(); };
  return (
    <div className="landing-card">
      <h1 className="landing-title">Plan with clarity</h1>
      <p className="landing-subtitle">Zoning • Land Use • Development • Architecture</p>
      <div className="landing-row">
        <input
          className="landing-input"
          placeholder='e.g., "Orlando corner-lot setback"'
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={onKey}
          aria-label="Search"
        />
        <button className="landing-btn" onClick={run}>Search</button>
      </div>
      <div className="landing-hint">Minimalist, professional answers.</div>
    </div>
  );
}

export default function CenteredSearchPortal() {
  const host = useMemo(() => {
    let el = document.getElementById('landing-portal-root');
    if (!el) { el = document.createElement('div'); el.id = 'landing-portal-root'; document.body.appendChild(el); }
    return el;
  }, []);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const hide = () => setVisible(false);
    window.addEventListener('myzone:hide-landing', hide);
    return () => window.removeEventListener('myzone:hide-landing', hide);
  }, []);
  if (!visible) return null;
  return createPortal(
    <div className="landing-portal">
      <div className="landing">
        <CenteredSearchCard />
      </div>
    </div>,
    host
  );
}
