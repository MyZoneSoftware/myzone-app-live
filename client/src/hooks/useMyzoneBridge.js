// src/hooks/useMyzoneBridge.js
import { useEffect } from 'react';

/**
 * useMyzoneBridge
 * Wires custom window events to your App's state setters safely.
 * Call this at the top of App() after your useState hooks.
 */
export default function useMyzoneBridge({
  setShowMap,
  setShowReports,
  setShowApplications,
  setShowZoningTools,
  setShowFeasibility,
  setDrawerOpen,
  setMode,
  setQuery,
}) {
  useEffect(() => {
    function openMap() {
      try {
        setShowMap?.(true);
        setShowReports?.(false);
        setShowApplications?.(false);
        setShowZoningTools?.(false);
        setShowFeasibility?.(false);
        setDrawerOpen?.(false);
      } catch (e) {
        console.warn('openMap bridge error', e);
      }
    }

    function onInsight(e) {
      try {
        const p = e?.detail?.prompt || '';
        if (!p) return;
        setMode?.('search');
        setQuery?.(p);
        // If you expose a runner, call it:
        if (typeof window !== 'undefined' && typeof window.myzoneRunSearch === 'function') {
          window.myzoneRunSearch(p);
        }
      } catch (e2) {
        console.warn('insight bridge error', e2);
      }
    }

    window.addEventListener('myzone:open-map', openMap);
    window.addEventListener('myzone:insight', onInsight);
    return () => {
      window.removeEventListener('myzone:open-map', openMap);
      window.removeEventListener('myzone:insight', onInsight);
    };
  }, [setShowMap, setShowReports, setShowApplications, setShowZoningTools, setShowFeasibility, setDrawerOpen, setMode, setQuery]);
}
