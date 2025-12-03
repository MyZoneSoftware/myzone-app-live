import React, { useEffect, useState } from 'react';

/**
 * Minimal debug overlay to confirm AI responses are arriving.
 * - Listens to 'myzone:ai-debug'
 * - Toggle with the floating pill; close/hide when you want
 */
export default function AIDebugPane() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    function onDebug(e) {
      setPayload(e.detail || null);
      setOpen(true);
    }
    window.addEventListener('myzone:ai-debug', onDebug);
    return () => window.removeEventListener('myzone:ai-debug', onDebug);
  }, []);

  if (!open || !payload) return (
    <button
      className="ai-debug-pill"
      title="Show AI debug"
      onClick={()=>setOpen(true)}
    >AI</button>
  );

  return (
    <>
      <button
        className="ai-debug-pill"
        title="Hide AI debug"
        onClick={()=>setOpen(false)}
      >AI</button>
      <div className="ai-debug">
        <div className="ai-debug-head">
          <div className="ai-debug-title">AI Debug</div>
          <button onClick={()=>setOpen(false)} aria-label="Close">✕</button>
        </div>
        <div className="ai-debug-body">
          {!payload.ok ? (
            <pre className="ai-debug-pre">ERROR: {payload.error}</pre>
          ) : (
            <>
              <div className="ai-debug-meta">model: {payload.model} • endpoint: {payload.endpoint}</div>
              <pre className="ai-debug-pre">{payload.content}</pre>
            </>
          )}
        </div>
      </div>
    </>
  );
}
