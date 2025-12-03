import React, { useState } from 'react';
import Uploader from './Uploader';
import { apiPost, apiUpload } from '../utils/api';

export default function ApplicationForm({ onCreated }) {
  const [form, setForm] = useState({
    applicantName: '',
    email: '',
    phone: '',
    address: '',
    type: 'site plan',
    description: ''
  });
  const [attachments, setAttachments] = useState([]); // server-returned file IDs/URLs
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleUpload(files) {
    // POST /api/files (multipart) -> { files: [{id,url,name}, ...] }
    const res = await apiUpload('/api/files', files, { folder: 'applications' });
    const list = res.files || res.items || [];
    setAttachments(prev => prev.concat(list));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setOk('');
    try {
      const payload = {
        applicantName: form.applicantName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        type: form.type,
        description: form.description,
        attachments // send the server-returned file refs
      };
      // POST /api/applications -> { id, ...payload }
      const created = await apiPost('/api/applications', payload);
      setOk(`Application ${created.id || ''} submitted successfully.`);
      setForm({ applicantName:'', email:'', phone:'', address:'', type:'site plan', description:'' });
      setAttachments([]);
      onCreated?.(created);
    } catch (e2) {
      setErr(e2?.message || 'Failed to create application');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mz-form" onSubmit={submit}>
      <div className="mz-form-grid">
        <label className="mz-field">
          <span className="mz-label">Applicant name</span>
          <input className="mz-input" value={form.applicantName} onChange={e=>setField('applicantName', e.target.value)} required />
        </label>

        <label className="mz-field">
          <span className="mz-label">Email</span>
          <input type="email" className="mz-input" value={form.email} onChange={e=>setField('email', e.target.value)} />
        </label>

        <label className="mz-field">
          <span className="mz-label">Phone</span>
          <input className="mz-input" value={form.phone} onChange={e=>setField('phone', e.target.value)} />
        </label>

        <label className="mz-field">
          <span className="mz-label">Project address / site</span>
          <input className="mz-input" value={form.address} onChange={e=>setField('address', e.target.value)} required />
        </label>

        <label className="mz-field">
          <span className="mz-label">Application type</span>
          <select className="mz-select" value={form.type} onChange={e=>setField('type', e.target.value)}>
            <option value="site plan">Site Plan</option>
            <option value="variance">Variance</option>
            <option value="rezoning">Rezoning</option>
          </select>
        </label>

        <label className="mz-field" style={{gridColumn:'1 / -1'}}>
          <span className="mz-label">Description</span>
          <textarea className="mz-textarea" rows={4} value={form.description} onChange={e=>setField('description', e.target.value)} />
        </label>

        <div style={{gridColumn:'1 / -1'}}>
          <Uploader label="Upload attachments (site plan, architectural plans, consent forms, etc.)" onUpload={handleUpload} />
          {attachments.length > 0 && (
            <div className="mz-attach-list">
              {attachments.map((f, i) => (
                <div key={f.id || f.url || i} className="mz-attach-row">
                  <span className="mz-attach-name" title={f.name || f.url}>{f.name || f.url}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mz-form-actions">
        <button className="mz-btn" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
        {ok && <div className="mz-ok-box">{ok}</div>}
        {err && <div className="mz-error-box">Error: {err}</div>}
      </div>
    </form>
  );
}
