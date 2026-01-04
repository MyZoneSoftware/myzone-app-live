const MAP_API_BASE = import.meta.env.VITE_MAP_API_BASE || "http://localhost:5050";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

/* =========================
   CORE (USED)
========================= */
export async function getParcelBySearch(query) {
  const url = `${MAP_API_BASE}/api/search/parcel?q=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  if (!data || !data.parcel) throw new Error("No parcel found for that search.");
  return data.parcel;
}

export async function getParcelByLatLng(lat, lng) {
  const url = `${MAP_API_BASE}/api/geo/parcel-by-point?lat=${encodeURIComponent(
    lat
  )}&lng=${encodeURIComponent(lng)}`;
  return fetchJson(url);
}

/* =========================
   SMART CODE (STUB)
========================= */
export async function getSmartCodeAnswer() {
  // Stub to satisfy App.jsx import
  return null;
}

/* =========================
   OTHER STUBS — SATISFY App.jsx
========================= */
export async function getBufferReport() { return null; }
export async function getJurisdictionProfile() { return null; }
export async function getParcelsGeoJSON() { return null; }
export async function getZoningGeoJSON() { return null; }
export async function getMunicipalBoundaries() { return null; }
export async function getFutureLandUseGeoJSON() { return null; }
export async function getOverlayLayers() { return null; }
export async function getNoticeReport() { return null; }
export async function getBufferGeoJSON() { return null; }
