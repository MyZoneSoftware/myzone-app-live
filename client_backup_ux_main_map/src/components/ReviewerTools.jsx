import React, { useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../utils/api';

function toCSV(rows) {
  const head = ['ID','Address','Type','Status','Submitted'];
  const lines = [head.join(',')];
  rows.forEach(r => {
    const cols = [r.id, r.address, r.type, r.status, r.submitted ? new Date(r.submitted).toLocaleDateString() : ''];
    lines.push(cols.map(c => String(c ?? '').replace(/,/g,';')).join(','));
  });
  return lines.join('\n');
}

export default function ReviewerTools({ selectedId, onRefresh }) {
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState('under review');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    async function load() {
      if (!selectedId) { setRecord(null); return; }
      setErr(''); setOk('');
      try {
        // GET /api/applications/:id
        const data = await apiGet(`/api/applications/${encodeURIComponent(selectedId)}`);
        setRecord(data);
        setStatus((data.status || 'under review').toLowerCase());
        setNotes(data.reviewerNotes || '');
      } catch (e) {
        setErr(e?.message || 'Failed to load record');
        setRecord(null);
      }
    }
    load();
  }, [selectedId]);

  async function save() {
    if (!record) return;
    setBusy(true); setErr(''); setOk('');
    try {
      // PATCH /api/applications/:id
      await apiPatch(`/api/applications/${encodeURIComponent(record.id || selectedId)}`, {
        status,
        reviewerNotes: notes
      });
      setOk('Saved.');
      onRefresh?.();
    } catch (e) {
      setErr(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!record) return;
    const blob = new Blob([toCSV([record])], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `application-${record.id || 'record'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!selectedId) {
    return <div className="mz-empty-panel"><div className="mz-empty-title">No application selected</div><div className="mz-empty-note">Select one from the Browse table.</div></div>;
  }

  return (
    <div className="mz-reviewer">
      {err && <div className="mz-error-box">Error: {err}</div>}
      {record ? (
        <>
          <div className="mz-review-head">
            <div className="mz-review-id"><strong>ID:</strong> {record.id}</div>
            <div><strong>Address:</strong> {record.address || '-'}</div>
            <div><strong>Type:</strong> {record.type || '-'}</div>
            <div><strong>Submitted:</strong> {record.submitted ? new Date(record.submitted).toLocaleDateString() : '-'}</div>
          </div>

          <div className="mz-review-controls">
            <label className="mz-field">
              <span className="mz-label">Status</span>
              <select className="mz-select" value={status} onChange={e=>setStatus(e.target.value)}>
                <option value="under review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="incomplete">Incomplete</option>
                <option value="denied">Denied</option>
              </select>
            </label>

            <label className="mz-field" style={{flex:1}}>
              <span className="mz-label">Reviewer notes</span>
              <textarea className="mz-textarea" rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Enter comments, conditions, deficiencies…" />
            </label>
          </div>

          <div className="mz-form-actions">
            <button className="mz-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="mz-btn" onClick={exportCsv}>Export CSV</button>
            {ok && <div className="mz-ok-box">{ok}</div>}
          </div>
        </>
      ) : (
        <div className="mz-hint">Loading…</div>
      )}
    </div>
  );
}
