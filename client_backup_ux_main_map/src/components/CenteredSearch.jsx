import React, { useState } from 'react';

/**
 * Minimalist centered search card.
 * Safe handler: never references undefined identifiers — it only emits window events.
 * Your existing app can listen to:
 *   - "myzone:hero-search" (detail.query)
 *   - "myzone:global-search" (detail.query)
 */
export default function CenteredSearch() {
  const [q, setQ] = useState('');

  const run = () => {
    const query = (q || '').trim();
    if (!query) return;
    try {
      window.dispatchEvent(new CustomEvent('myzone:hero-search', { detail: { query } }));
      window.dispatchEvent(new CustomEvent('myzone:global-search', { detail: { query } }));
    } catch (e) {
      console.warn('[CenteredSearch] dispatch failed', e);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') run();
  };

  return (
    <section className="landing">
      <div className="landing-card">
        <div className="landing-title">Search zoning, land use & development</div>
        <div className="landing-row">
          <input
            placeholder="Try: setback for a corner lot in Orlando…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <button onClick={run} aria-label="Search">Search</button>
        </div>
        <div className="landing-hint">Minimal answers. Works across municipalities & counties.</div>
      </div>
    </section>
  );
}
