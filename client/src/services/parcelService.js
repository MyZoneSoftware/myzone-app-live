const MAP_API_BASE = "http://localhost:5003";

async function handleJsonResponse(resp, defaultErrorMessage) {
  if (!resp.ok) {
    let message = defaultErrorMessage;
    try {
      const data = await resp.json();
      if (data && data.error) {
        message = data.error;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return resp.json();
}

// Municipal boundaries
export async function getMunicipalBoundaries() {
  const resp = await fetch(`${MAP_API_BASE}/api/municipal-boundaries`);
  return handleJsonResponse(resp, "Failed to load municipal boundaries.");
}

// Parcels layer (for display)
export async function getParcelsGeoJSON() {
  const resp = await fetch(`${MAP_API_BASE}/api/parcels-geojson`);
  return handleJsonResponse(resp, "Failed to load parcels layer.");
}

// Zoning layer (for display)
export async function getZoningGeoJSON() {
  const resp = await fetch(`${MAP_API_BASE}/api/zoning-geojson`);
  return handleJsonResponse(resp, "Failed to load zoning layer.");
}

// Identify parcel by clicking on the map
export async function getParcelByLatLng(lat, lng) {
  const url = `${MAP_API_BASE}/api/parcel-by-point?lat=${encodeURIComponent(
    lat,
  )}&lng=${encodeURIComponent(lng)}`;
  const resp = await fetch(url);
  return handleJsonResponse(resp, "Unable to identify a parcel at that location.");
}

// Powerful search: PARID, address, or owner
export async function getParcelBySearch(query, fallbackCenter = null) {
  const params = new URLSearchParams();
  params.set("q", query);

  if (
    fallbackCenter &&
    Array.isArray(fallbackCenter) &&
    fallbackCenter.length === 2
  ) {
    const [lat, lng] = fallbackCenter;
    if (typeof lat === "number" && typeof lng === "number") {
      params.set("nearLat", String(lat));
      params.set("nearLng", String(lng));
    }
  }

  const url = `${MAP_API_BASE}/api/parcel-search?${params.toString()}`;
  const resp = await fetch(url);

  if (resp.status === 404) {
    // Clean "no match" message for the UI
    throw new Error("No parcel found for that search.");
  }

  return handleJsonResponse(resp, "Unable to find a parcel for that search.");
}

// Buffer / notice-radius report
export async function getBufferReport(lat, lng, radiusFeet) {
  const params = new URLSearchParams();
  params.set("lat", String(lat));
  params.set("lng", String(lng));
  params.set("radiusFeet", String(radiusFeet));

  const url = `${MAP_API_BASE}/api/buffer-parcels?${params.toString()}`;
  const resp = await fetch(url);
  return handleJsonResponse(resp, "Unable to generate buffer / notice-radius report.");
}
