import React from 'react';
import ReactDOM from 'react-dom/client';
import CenteredSearchPortal from './components/CenteredSearchPortal.jsx';

(function mountLanding(){
  try {
    let host = document.getElementById('landing-portal-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'landing-portal-root';
      document.body.appendChild(host);
    }
    const root = ReactDOM.createRoot(host);
    root.render(
      <React.StrictMode>
        <CenteredSearchPortal />
      </React.StrictMode>
    );

    // Optional: hide when your app signals ready
    window.addEventListener('myzone:app-ready', () => {
      try { window.dispatchEvent(new CustomEvent('myzone:hide-landing')); } catch {}
    });
  } catch (e) {
    console.warn('[landing_bootstrap] failed', e);
  }
})();
