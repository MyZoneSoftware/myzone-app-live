const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5003/api";

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed ${res.status}`);
  }
  return res.json();
}

/**
 * Map click → parcel
 */
export async function getParcelByLatLng(lat, lng) {
  return fetchJson(`${API_BASE}/geo/parcel-by-point?lat=${lat}&lng=${lng}`);
}

/**
 * Parcel search (BACK-COMPAT – UI expects this)
 */
export async function getParcelBySearch(q) {
  const params = new URLSearchParams({ q });
  return fetchJson(`${API_BASE}/search/parcel?${params}`);
}

/**
 * Radius buffer
 */
export async function getBufferReport(lat, lng, radiusFeet = 300) {
  return fetchJson(
    `${API_BASE}/geo/buffer?lat=${lat}&lng=${lng}&radiusFeet=${radiusFeet}`
  );
}

/**
 * GeoJSON helpers — SAFE NO-OPS (do NOT remove)
 */
export async function getMunicipalBoundaries() {
  return null;
}
export async function getParcelsGeoJSON() {
  return null;
}
export async function getZoningGeoJSON() {
  return null;
}

/**
 * SmartCode answer
 */
export async function getSmartCodeAnswer(payload) {
  return fetchJson(`${API_BASE}/search/smart-code`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Jurisdiction profile — SAFE STUB
 */
export async function getJurisdictionProfile() {
  return {
    name: "Local Jurisdiction",
    status: "ok",
  };
}
