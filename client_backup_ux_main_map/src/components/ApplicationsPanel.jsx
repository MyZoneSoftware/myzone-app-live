import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * ApplicationsPanel (MVP)
 * - Local persistence via localStorage (key: mz_apps_v1)
 * - Create, edit, duplicate, delete
 * - Status: Draft, Submitted, Approved, Denied
 * - Filter/search by name/address/APN/status
 * - Attach files: stored as object URLs (session-only; metadata persisted)
 * - Export JSON / Import JSON
 * - Optionally shows active city/county (via prop)
 */

const STORAGE_KEY = 'mz_apps_v1';
const STATUSES = ['Draft','Submitted','Approved','Denied'];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadApps() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveApps(apps) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

function emptyApp(activeCity) {
  return {
    id: uid(),
    name: '',
    status: 'Draft',
    address: '',
    apn: '',
    jurisdiction: activeCity?.name || '',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [] // { id, name, type, size, url? (session-only) }
  };
}

export default function ApplicationsPanel({ activeCity , newAppInit }) {
  const [apps, setApps] = useState(loadApps());
  const [query, setQuery] = useState('');
  
  // Prefill from newAppInit (map → application)
  useEffect(() => { // prefill from newAppInit
    if (!newAppInit) return;
    try {
      // Safely set common fields if your panel has them; adjust names as needed.
      if (typeof setParcelId === 'function' && newAppInit.parcelId) setParcelId(newAppInit.parcelId);
      if (typeof setAddress === 'function' && newAppInit.address) setAddress(newAppInit.address);
      if (typeof setOwner === 'function' && newAppInit.owner) setOwner(newAppInit.owner);
      if (typeof setSiteAcres === 'function' && newAppInit.acres) setSiteAcres(newAppInit.acres);
      if (typeof setSource === 'function') setSource('map');
    } catch (e) { console.warn('prefill error', e); }
  }, [newAppInit]);
const [editing, setEditing] = useState(null); // app object being edited
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { saveApps(apps); }, [apps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps.slice().sort(sortByUpdated);
    return apps.filter(a => {
      return (
        a.name.toLowerCase().includes(q) ||
        (a.address||'').toLowerCase().includes(q) ||
        (a.apn||'').toLowerCase().includes(q) ||
        (a.status||'').toLowerCase().includes(q) ||
        (a.jurisdiction||'').toLowerCase().includes(q)
      );
    }).sort(sortByUpdated);
  }, [apps, query]);

  function sortByUpdated(a,b) {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  }

  function createNew() {
    const draft = emptyApp(activeCity);
    setEditing(draft);
    setShowForm(true);
  }

  function editApp(app) {
    setEditing(JSON.parse(JSON.stringify(app))); // clone
    setShowForm(true);
  }

  function saveApp() {
    if (!editing) return;
    const now = new Date().toISOString();
    const updated = { ...editing, updatedAt: now };
    setApps(prev => {
      const i = prev.findIndex(x => x.id === updated.id);
      if (i >= 0) {
        const copy = prev.slice();
        copy[i] = updated;
        return copy;
      } else {
        return [updated, ...prev];
      }
    });
    setShowForm(false);
    setEditing(null);
  }

  function duplicateApp(app) {
    const copy = { ...app, id: uid(), name: app.name + ' (copy)', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setApps(prev => [copy, ...prev]);
  }

  function deleteApp(app) {
    if (!confirm(`Delete "${app.name || 'Untitled'}"?`)) return;
    setApps(prev => prev.filter(x => x.id !== app.id));
    if (editing?.id === app.id) { setShowForm(false); setEditing(null); }
  }

  function importJSON(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('Invalid format (expected array)');
        // De-dupe by id, prefer imported
        const map = new Map(apps.map(a => [a.id, a]));
        data.forEach(item => { if (item && item.id) map.set(item.id, item); });
        const merged = Array.from(map.values());
        setApps(merged);
        alert(`Imported ${data.length} records.`);
      } catch (e) {
        alert('Failed to import: ' + e.message);
      } finally {
        ev.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(apps, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.href = url;
    a.download = `myzone-applications-${stamp}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleAttach(e) {
    const files = Array.from(e.target.files || []);
    if (!editing || !files.length) return;
    const newItems = files.map(f => ({
      id: uid(),
      name: f.name,
      type: f.type,
      size: f.size,
      url: URL.createObjectURL(f) // session-only; do not persist cross-session
    }));
    setEditing(prev => ({ ...prev, attachments: [...prev.attachments, ...newItems] }));
    e.target.value = '';
  }

  function removeAttachment(id) {
    setEditing(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) }));
  }

  return (
    <section className="apps-card">
      <div className="apps-head">
        <div className="apps-title">Applications</div>
        <div className="apps-actions">
          <button className="mz-btn" onClick={createNew}>New</button>
          <button className="mz-btn ghost" onClick={exportJSON}>Export JSON</button>
          <label className="mz-btn ghost">
            Import JSON
            <input type="file" accept="application/json" onChange={importJSON} style={{display:'none'}} />
          </label>
        </div>
      </div>

      <div className="apps-toolbar">
        <input
          className="apps-filter"
          placeholder="Filter by name, address, APN, status, jurisdiction…"
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
        />
        {activeCity?.name && (
          <span className="badge">Active: {activeCity.name}</span>
        )}
      </div>

      {/* List */}
      <div className="apps-list">
        {filtered.length === 0 && (
          <div className="mz-empty">No applications yet. Click <strong>New</strong> to create one.</div>
        )}
        {filtered.map(app => (
          <div key={app.id} className="apps-row">
            <div className="apps-main">
              <div className="apps-name">{app.name || 'Untitled'}</div>
              <div className="apps-meta">
                <span className={`status-pill s-${(app.status||'draft').toLowerCase()}`}>{app.status}</span>
                {app.address && <span>• {app.address}</span>}
                {app.apn && <span>• APN {app.apn}</span>}
                {app.jurisdiction && <span>• {app.jurisdiction}</span>}
              </div>
            </div>
            <div className="apps-row-actions">
              <button className="mini" onClick={()=>editApp(app)}>Edit</button>
              <button className="mini" onClick={()=>duplicateApp(app)}>Duplicate</button>
              <button className="mini danger" onClick={()=>deleteApp(app)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Drawer form */}
      {showForm && editing && (
        <div className="apps-drawer" role="dialog" aria-modal="true">
          <div className="mz-dim" onClick={()=>{setShowForm(false); setEditing(null);}} />
          <aside className="apps-panel">
            <div className="apps-panel-head">
              <div className="apps-panel-title">{editing.id ? 'Edit Application' : 'New Application'}</div>
              <button className="mz-icon-btn" onClick={()=>{setShowForm(false); setEditing(null);}} aria-label="Close">✕</button>
            </div>

            <div className="apps-grid">
              <label>
                <div className="lab">Name</div>
                <input value={editing.name} onChange={e=>setEditing({...editing, name:e.target.value})} />
              </label>
              <label>
                <div className="lab">Status</div>
                <select value={editing.status} onChange={e=>setEditing({...editing, status:e.target.value})}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                <div className="lab">Address</div>
                <input value={editing.address} onChange={e=>setEditing({...editing, address:e.target.value})} />
              </label>
              <label>
                <div className="lab">APN / Parcel ID</div>
                <input value={editing.apn} onChange={e=>setEditing({...editing, apn:e.target.value})} />
              </label>
              <label>
                <div className="lab">City / County</div>
                <input value={editing.jurisdiction} onChange={e=>setEditing({...editing, jurisdiction:e.target.value})} placeholder={activeCity?.name || ''} />
              </label>
              <label className="col-span">
                <div className="lab">Notes</div>
                <textarea rows={5} value={editing.notes} onChange={e=>setEditing({...editing, notes:e.target.value})} />
              </label>
            </div>

            <div className="apps-attach">
              <div className="lab">Attachments <span className="muted">(session-only previews)</span></div>
              <div className="attach-row">
                <button className="mz-btn" onClick={()=>fileInputRef.current?.click()}>Add files</button>
                <input ref={fileInputRef} type="file" multiple onChange={handleAttach} style={{display:'none'}} />
              </div>
              {editing.attachments?.length > 0 && (
                <ul className="attach-list">
                  {editing.attachments.map(a => (
                    <li key={a.id}>
                      <div className="afile">
                        <div className="fname">
                          {a.url
                            ? <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a>
                            : a.name}
                        </div>
                        <div className="fmeta">{a.type || 'file'} • {(a.size/1024).toFixed(1)} KB</div>
                      </div>
                      <button className="mini danger" onClick={()=>removeAttachment(a.id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="apps-panel-actions">
              <button className="mz-btn" onClick={saveApp}>Save</button>
              <button className="mz-btn ghost" onClick={()=>{setShowForm(false); setEditing(null);}}>Cancel</button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
