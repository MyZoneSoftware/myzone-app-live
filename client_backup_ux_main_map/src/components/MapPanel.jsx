import React from 'react';
export default function MapPanel({ municipality }) {
  return (
    <section className="mz-panel">
      <header className="mz-panel-head">
        <h2 className="mz-panel-title">Map</h2>
        <div className="mz-panel-actions">
          <span className="mz-chip">{municipality || 'No municipality selected'}</span>
          <label className="mz-field"><span className="mz-label">Basemap</span>
            <select className="mz-select" defaultValue="light"><option value="light">Light</option><option value="satellite">Satellite</option><option value="streets">Streets</option></select>
          </label>
          <button className="mz-btn" onClick={()=>alert('Fullscreen placeholder')}>Fullscreen</button>
        </div>
      </header>
      <div className="mz-panel-body">
        <div className="mz-map-stage" role="region" aria-label="Map canvas">
          <div className="mz-map-placeholder" style={{display:'grid',placeItems:'center',background:'#fafafa',height:360,border:'1px solid #eee',borderRadius:12}}>
            <div className="mz-map-note">Map canvas placeholder</div>
          </div>
        </div>
      </div>
    </section>
  );
}
