const KEY = "mz_token";

export function getToken(){
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}

export function setToken(t){
  try { localStorage.setItem(KEY, t || ""); } catch {}
}

export function clearToken(){
  try { localStorage.removeItem(KEY); } catch {}
}

export function isAuthed(){
  return !!getToken();
}

export async function apiFetch(url, opts = {}){
  const token = getToken();
  const headers = Object.assign({ "Content-Type":"application/json" }, opts.headers || {});
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) { clearToken(); throw new Error("Unauthorized"); }
  return res;
}
