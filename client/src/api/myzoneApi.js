const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5003";

async function httpJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-json response
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function getJurisdictionProfile(jurisdiction, districtCode) {
  const j = encodeURIComponent(jurisdiction);
  const qs = districtCode ? `?code=${encodeURIComponent(districtCode)}` : "";
  return httpJson(`${API_BASE}/api/jurisdictions/${j}/profile${qs}`);
}

export async function smartSearch({ question, jurisdiction, parcelId, districtCode }) {
  const params = new URLSearchParams();
  params.set("q", question);

  if (jurisdiction) params.set("jurisdiction", jurisdiction);
  if (parcelId) params.set("parcelId", parcelId);
  if (districtCode) params.set("districtCode", districtCode);

  return httpJson(`${API_BASE}/api/search?${params.toString()}`);
}
