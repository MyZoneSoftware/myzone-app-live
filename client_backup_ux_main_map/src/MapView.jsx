import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { searchPlaces } from './lib/nominatim.js';

const FL_CENTER = [27.6648, -81.5158];

function MapController({ cmd }) {
  const map = useMap();
  useEffect(() => {
    if (!cmd || !cmd.type) return;
    try { map.stop?.(); } catch {}
    try { map.invalidateSize(true); } catch {}
    if (cmd.type === 'bounds') {
      const b = cmd.payload;
      if (b && b.isValid && b.isValid()) {
        const pad = b.pad(0.2);
        map.flyToBounds(pad, { padding: [40, 40], maxZoom: 16, duration: 0.8 });
        setTimeout(() => {
          const c = pad.getCenter();
          try { map.setView(c, Math.min(16, map.getZoom() || 16), { animate: true }); } catch {}
        }, 850);
      }
    } else if (cmd.type === 'center') {
      const { latlng, zoom = 16 } = cmd.payload || {};
      map.setView(latlng, zoom, { animate: true });
    }
  }, [cmd?.seq]);
  return null;
}

export default function MapView() {
  const [myPos, setMyPos] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [searchOpen, setSearchOpen] = useState(true);

  const [parcels, setParcels] = useState(null);
  const [showParcels, setShowParcels] = useState(true);

  const [zoning, setZoning] = useState(null);
  const [showZoning, setShowZoning] = useState(false);

  const abortRef = useRef(null);
  const hoverLayerRef = useRef(null);
  const debugLayerRef = useRef(L.layerGroup());

  // View commands for controller
  const [viewCmd, setViewCmd] = useState({ type: null, payload: null, seq: 0 });
  const issueBounds = (b) => setViewCmd({ type: 'bounds', payload: b, seq: Date.now() });
  const issueCenter = (latlng, zoom=16) => setViewCmd({ type: 'center', payload: { latlng, zoom }, seq: Date.now() });

  // Load sample layers
  useEffect(() => {
    (async () => {
      try {
        const gj = await fetch('/data/parcels-sample.geojson').then(r=>r.json());
        setParcels(gj);
        drawDebug(gj);
        try {
          const tmp = L.geoJSON(gj);
          const b = tmp.getBounds();
          console.log('[Map] parcels bounds:', b && b.toBBoxString && b.toBBoxString());
          if (b && b.isValid()) issueBounds(b);
        } catch {}
        console.log('[Map] parcels loaded:', gj?.features?.length ?? 0);
      } catch (e) { console.warn('parcels sample missing', e); }
      try {
        const gj2 = await fetch('/data/zoning-sample.geojson').then(r=>r.json());
        setZoning(gj2);
      } catch {}
    })();
  }, []);

  // Address search (debounced)
  useEffect(() => {
    if (!searchText || searchText.trim().length < 3) { setSearchHits([]); return; }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const results = await searchPlaces(searchText.trim(), { signal: ctrl.signal });
        setSearchHits(results);
      } catch (e) {
        if ((e.name||'').includes('Abort')) return;
        console.error('geocoder', e);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [searchText]);

  const onPickHit = (hit) => {
    setSearchHits([]);
    setSearchText(hit.display_name);
    const lat = parseFloat(hit.lat), lon = parseFloat(hit.lon);
    issueBounds(L.latLngBounds([lat, lon], [lat, lon]).pad(0.005));
  };

  // Styles
  const parcelStyle = useMemo(() => ({
    color: '#1d4ed8', weight: 2, fillColor: '#93c5fd', fillOpacity: 0.55
  }), []);
  const parcelHoverStyle = { color: '#4f46e5', weight: 2, fillColor: '#c7d2fe', fillOpacity: 0.6 };
  const zoningStyle = { color: '#10b981', weight: 1, fillColor: '#d1fae5', fillOpacity: 0.35 };

  // Debug helpers
  function drawDebug(gj) {
    try {
      debugLayerRef.current.clearLayers();
      const tmp = L.geoJSON(gj);
      const b = tmp.getBounds();
      if (b && b.isValid()) {
        const r = L.rectangle(b, { color:'#ef4444', weight: 2, fillOpacity: 0 });
        debugLayerRef.current.addLayer(r);
        (gj.features||[]).forEach(ft => {
          try {
            const lyr = L.geoJSON(ft);
            const bb = lyr.getBounds();
            const c = bb.getCenter();
            const m = L.circleMarker(c, { radius: 6, color:'#111827', fillColor:'#f59e0b', fillOpacity: 0.9, weight: 2 });
            m.bindTooltip(ft.properties?.parcel_id || ft.properties?.id || 'parcel', {permanent:false});
            debugLayerRef.current.addLayer(m);
          } catch {}
        });
      }
    } catch (e) { console.warn('debug layer failed', e); }
  }

  // Buttons actions
  function zoomToParcels() {
    try {
      if (parcels) {
        const tmp = L.geoJSON(parcels);
        const b = tmp.getBounds();
        console.log('[Map] zoomToParcels bounds:', b && b.toBBoxString && b.toBBoxString());
        if (b && b.isValid()) issueBounds(b);
      } else {
        fetch('/data/parcels-sample.geojson').then(r=>r.json()).then(gj=>{
          drawDebug(gj);
          const tmp = L.geoJSON(gj);
          const b = tmp.getBounds();
          if (b && b.isValid()) issueBounds(b);
        });
      }
    } catch (e) { console.warn('zoomToParcels error', e); }
  }
  function jumpMiami()   { issueCenter(L.latLng(25.7742, -80.1924), 16); }
  function jumpOrlando() { issueCenter(L.latLng(28.5409, -81.3842), 16); }

  // Parcel click → new application
  const onEachParcel = (feature, layer) => {
    layer.on({
      mouseover: () => {
        if (hoverLayerRef.current && hoverLayerRef.current !== layer) {
          hoverLayerRef.current.setStyle(parcelStyle);
        }
        layer.setStyle(parcelHoverStyle);
        hoverLayerRef.current = layer;
        try { layer.bringToFront(); } catch {}
      },
      mouseout: () => {
        layer.setStyle(parcelStyle);
        hoverLayerRef.current = null;
      },
      click: () => {
        try { layer.bringToFront(); } catch {}
        const props = feature.properties || {};
        const payload = {
          source: 'map',
          parcelId: props.parcel_id || props.PARCEL_ID || props.id || '',
          address: props.addr || props.ADDRESS || props.situs || '',
          acres: props.acres || props.ACRES || '',
          owner: props.owner || props.OWNER || '',
          geomHint: true
        };
        try {
          window.dispatchEvent(new CustomEvent('myzone:new-application', { detail: payload }));
        } catch (e) {
          console.warn('dispatch myzone:new-application failed', e);
        }
        const html = [
          '<div style="font-size:12px;">',
          '<div><strong>Parcel</strong></div>',
          payload.parcelId ? `<div>ID: ${payload.parcelId}</div>` : '',
          payload.owner ? `<div>Owner: ${payload.owner}</div>` : '',
          payload.address ? `<div>Addr: ${payload.address}</div>` : '',
          payload.acres ? `<div>Acres: ${payload.acres}</div>` : '',
          '<div style="margin-top:6px; color:#444;">Opening Applications…</div>',
          '</div>'
        ].join('');
        layer.bindPopup(html).openPopup();
      }
    });
  };

  return (
    <div className="map-card">
      {/* Standard toolbar (search + toggles) */}
      <div className="map-toolbar toolbar-v2">
        <div className="toolbar-row">
          <div className="map-search">
            <input
              placeholder="Search address / place in Florida…"
              value={searchText}
              onChange={(e)=>setSearchText(e.target.value)}
              onFocus={()=>setSearchOpen(true)}
            />
            {searchOpen && searchHits.length > 0 && (
              <div className="map-search-results">
                {searchHits.map(hit => (
                  <div key={hit.place_id} className="map-search-item" onClick={()=>onPickHit(hit)}>
                    {hit.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="toolbar-row controls-row">
          <label className="toggle">
            <input type="checkbox" checked={showParcels} onChange={(e)=>setShowParcels(e.target.checked)} />
            <span>Parcels</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={showZoning} onChange={(e)=>setShowZoning(e.target.checked)} />
            <span>Zoning (sample)</span>
          </label>
        </div>
      </div>

      {/* Floating controls: ALWAYS visible, bottom-left, stacked */}
      <div className="floating-controls" role="group" aria-label="Map actions">
        <button className="mapctl-btn" id="btn-zoom-samples" onClick={zoomToParcels}>Zoom to samples</button>
        <button className="mapctl-btn" id="btn-jump-miami" onClick={jumpMiami}>Jump Miami</button>
        <button className="mapctl-btn" id="btn-jump-orlando" onClick={jumpOrlando}>Jump Orlando</button>
      </div>

      <MapContainer
        className="map-root"
        center={FL_CENTER}
        zoom={7}
        scrollWheelZoom
        whenCreated={(map)=>{
          debugLayerRef.current.addTo(map);
        }}>
        <MapController cmd={viewCmd} />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {myPos && (
          <Marker position={myPos}>
            <Popup>Your location</Popup>
          </Marker>
        )}

        <LayersControl position="topright">
          {showParcels && parcels && (
            <LayersControl.Overlay checked name="Parcels (sample)">
              <GeoJSON
                data={parcels}
                style={() => parcelStyle}
                onEachFeature={onEachParcel}
              />
            </LayersControl.Overlay>
          )}
          {showZoning && zoning && (
            <LayersControl.Overlay checked name="Zoning (sample)">
              <GeoJSON data={zoning} style={() => zoningStyle} />
            </LayersControl.Overlay>
          )}
        </LayersControl>
      </MapContainer>
    </div>
  );
}
