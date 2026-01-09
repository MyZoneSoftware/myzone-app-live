const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

/* =============================
   SEARCH
============================= */
export async function getParcelBySearch(q) {
  const data = await fetchJson(
    `${API_BASE}/api/search/parcel?q=${encodeURIComponent(q)}`
  );

  if (data?.feature) return data.feature;
  if (data?.parcel) return data.parcel;
  if (data?.type === "Feature") return data;

  throw new Error("No parcel found for that search.");
}

/* =============================
   MAP CLICK
============================= */
export async function getParcelByLatLng(lat, lng) {
  const data = await fetchJson(
    `${API_BASE}/api/geo/parcel-by-point?lat=${lat}&lng=${lng}`
  );

  if (data?.feature) return data.feature;
  if (data?.parcel) return data.parcel;
  if (data?.type === "Feature") return data;

  throw new Error("No parcel found for that location.");
}

/* =============================
   BASE LAYERS
============================= */
export async function getParcelsGeoJSON() {
  return fetchJson(`${API_BASE}/api/geo/parcels`);
}

export async function getZoningGeoJSON() {
  return fetchJson(`${API_BASE}/api/geo/zoning`);
}

export async function getMunicipalBoundaries() {
  return fetchJson(`${API_BASE}/api/geo/municipal-boundaries`);
}

/* =============================
   SAFE STUBS (prevent blank UI)
============================= */
export async function getBufferReport() {
  return null;
}

export async function getJurisdictionProfile() {
  return null;
}

export async function getSmartCodeAnswer() {
  return null;
}
