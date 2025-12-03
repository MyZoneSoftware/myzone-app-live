import React from 'react';
import HeroSearch from './HeroSearch.jsx';

/**
 * Safe wrapper that never references undefined identifiers in JSX.
 * It tries known handlers if they exist; otherwise, emits a window event.
 */
export default function HeroProxy() {
  const handle = (q) => {
    try { if (typeof window.onInsight === 'function') return window.onInsight(q); } catch {}
    try { if (typeof window.fetchInsights === 'function') return window.fetchInsights(q); } catch {}
    try { if (typeof window.runSearchOnce === 'function') return window.runSearchOnce(q); } catch {}
    try { window.dispatchEvent(new CustomEvent('myzone:hero-search', { detail: { query: q } })); } catch (e) {
      console.warn('[HeroProxy] no handler available', e);
    }
  };
  return <HeroSearch onSearch={handle} />;
}
