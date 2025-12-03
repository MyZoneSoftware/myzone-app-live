
// Bridge centered search → existing logic when available (safe no-op if absent)
window.addEventListener('myzone:hero-search', (e) => {
  const q = e?.detail?.query;
  try { if (typeof window.onInsight === 'function') return window.onInsight(q); } catch {}
  try { if (typeof window.fetchInsights === 'function') return window.fetchInsights(q); } catch {}
  try { if (typeof window.runSearchOnce === 'function') return window.runSearchOnce(q); } catch {}
});
