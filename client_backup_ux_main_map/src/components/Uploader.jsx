import React, { useRef, useState } from 'react';

export default function Uploader({ label = 'Upload files', onUpload, accept = '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.dwg,.dxf,.zip' }) {
  const inputRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function onPick(e) {
    const files = Array.from(e.target.files || []);
    setQueue(prev => prev.concat(files));
  }

  function removeAt(idx) {
    setQueue(q => q.filter((_, i) => i !== idx));
  }

  async function doUpload() {
    if (!onUpload || queue.length === 0) return;
    try {
      setBusy(true); setErr('');
      await onUpload(queue);
      setQueue([]);
    } catch (e) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="mz-uploader">
      <div className="mz-field">
        <span className="mz-label">{label}</span>
        <input ref={inputRef} className="mz-input" type="file" accept={accept} multiple onChange={onPick} />
      </div>

      {queue.length > 0 && (
        <div className="mz-upload-list">
          {queue.map((f, i) => (
            <div className="mz-upload-row" key={`${f.name}-${i}`}>
              <div className="mz-upload-name" title={f.name}>{f.name}</div>
              <div className="mz-upload-size">{Math.ceil((f.size || 0) / 1024)} KB</div>
              <button className="mz-btn" onClick={() => removeAt(i)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <div className="mz-upload-actions">
        <button className="mz-btn" disabled={!queue.length || busy} onClick={doUpload}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        {err && <div className="mz-error-box" style={{marginLeft:8}}>Error: {err}</div>}
      </div>
    </div>
  );
}
