const API_BASE = "/api";

async function handleJsonResponse(res, defaultErrorMessage) {
  if (!res.ok) {
    let msg = defaultErrorMessage;
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch (_e) {}
    throw new Error(msg);
  }
  return res.json();
}

export async function getMunicipalBoundaries() {
  const res = await fetch(`${API_BASE}/municipal-boundaries`);
  return handleJsonResponse(res, "Unable to load municipal boundaries");
}

export async function getParcelsGeoJSON() {
  const res = await fetch(`${API_BASE}/parcels-geojson`);
  return handleJsonResponse(res, "Unable to load parcels layer");
}

export async function getZoningGeoJSON() {
  const res = await fetch(`${API_BASE}/zoning-geojson`);
  return handleJsonResponse(res, "Unable to load zoning layer");
}

export async function getParcelByLatLng(lat, lng) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const res = await fetch(`${API_BASE}/parcel-by-point?${params.toString()}`);
  return handleJsonResponse(res, "Unable to identify parcel at that location");
}

export async function getParcelBySearch(query, fallbackCenter) {
  const params = new URLSearchParams({ q: query });
  if (fallbackCenter && fallbackCenter.length === 2) {
    params.set("nearLat", String(fallbackCenter[0]));
    params.set("nearLng", String(fallbackCenter[1]));
  }
  const res = await fetch(`${API_BASE}/parcel-search?${params.toString()}`);
  return handleJsonResponse(res, "Unable to find a parcel for that search");
}

export async function getBufferReport(lat, lng, radiusFeet) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusFeet: String(radiusFeet),
  });
  const res = await fetch(`${API_BASE}/buffer-parcels?${params.toString()}`);
  return handleJsonResponse(res, "Unable to generate buffer / notice-radius report");
}

// --- NEW: autocomplete suggestions ---
export async function getParcelSuggestions(query, limit = 10) {
  if (!query || query.trim().length < 2) return [];
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE}/parcel-suggest?${params.toString()}`);
  if (!res.ok) {
    return [];
  }
  try {
    const data = await res.json();
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}
