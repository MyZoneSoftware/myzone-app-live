const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5051';

function buildUrl(path) {
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

export async function apiGet(path, params = {}) {
  const url = new URL(buildUrl(path));
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiPost(path, data, opts = {}) {
  const headers = opts.headers || { 'Content-Type': 'application/json' };
  const body = headers['Content-Type']?.includes('json') ? JSON.stringify(data) : data;
  const res = await fetch(buildUrl(path), { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiPatch(path, data) {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Upload files via multipart/form-data. Returns JSON. */
export async function apiUpload(path, files = [], extra = {}) {
  const fd = new FormData();
  files.forEach((f, i) => fd.append('files', f, f.name || `file-${i}`));
  Object.entries(extra).forEach(([k, v]) => fd.append(k, String(v)));
  const res = await fetch(buildUrl(path), { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
