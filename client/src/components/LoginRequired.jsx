import React from 'react';
export default function LoginRequired({ onLogin }) {
  return (
    <section className="mz-panel">
      <header className="mz-panel-head"><h2 className="mz-panel-title">Applications</h2></header>
      <div className="mz-panel-body">
        <div className="mz-empty-panel">
          <div className="mz-empty-title">Login required</div>
          <div className="mz-empty-note">You must be logged in to view, create, or review applications.</div>
          <div style={{marginTop:10}}><button className="mz-btn" onClick={onLogin}>Login</button></div>
        </div>
      </div>
    </section>
  );
}
