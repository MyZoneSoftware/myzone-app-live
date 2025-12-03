import React, { useState } from 'react';

export default function HeroSearch({ onSearch }) {
  const [q, setQ] = useState('');
  const run = () => {
    const query = q.trim();
    if (!query) return;
    try { onSearch?.(query); } catch {}
  };
  const onKey = (e) => { if (e.key === 'Enter') run(); };

  return (
    <section className="hero-shell">
      <div className="hero-card">
        <div className="hero-title">Search zoning, land use & development</div>
        <div className="hero-search">
          <input
            placeholder="Try: setback for corner lot in Orlando…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <button onClick={run}>Search</button>
        </div>
        <div className="hero-hint">Fast, minimalist answers. Works across municipalities & counties.</div>
      </div>
    </section>
  );
}
