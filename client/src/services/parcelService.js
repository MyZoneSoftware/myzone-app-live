const MAP_API_BASE = "http://localhost:5003";

// ---- Helper: basic JSON fetch with friendly error ----
async function fetchJson(url, errorMessage) {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch (_e) {}

    console.error("Fetch error for", url, "status", res.status, detail);
    throw new Error(errorMessage || "Request failed.");
  }
  return res.json();
}

// ---- Helper: centroid from GeoJSON geometry (Polygon / MultiPolygon) ----
function computeCentroidFromGeometry(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) return null;

  const coords = [];

  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach((ring) => {
      (ring || []).forEach((pt) => {
        if (Array.isArray(pt) && pt.length >= 2) {
          coords.push([pt[0], pt[1]]);
        }
      });
    });
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((poly) => {
      (poly || []).forEach((ring) => {
        (ring || []).forEach((pt) => {
          if (Array.isArray(pt) && pt.length >= 2) {
            coords.push([pt[0], pt[1]]);
          }
        });
      });
    });
  }

  if (!coords.length) return null;

  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of coords) {
    sumX += x;
    sumY += y;
  }

  const lng = sumX / coords.length;
  const lat = sumY / coords.length;

  return { lat, lng };
}

// ---------------------------------------------------------------------
//  PARCEL IDENTIFICATION
// ---------------------------------------------------------------------

// Map click → parcel-by-point
export async function getParcelByLatLng(lat, lng) {
  const url = `${MAP_API_BASE}/api/parcel-by-point?lat=${encodeURIComponent(
    lat,
  )}&lng=${encodeURIComponent(lng)}`;

  const data = await fetchJson(
    url,
    "Unable to identify a parcel at that location.",
  );

  // Ensure lat/lng exist on the object for map centering & buffer
  if (typeof data.lat !== "number" || typeof data.lng !== "number") {
    const centroid = computeCentroidFromGeometry(data.geometry);
    if (centroid) {
      data.lat = centroid.lat;
      data.lng = centroid.lng;
    } else {
      data.lat = lat;
      data.lng = lng;
    }
  }

  return data;
}

// Search bar → search by PCN / PARID
export async function getParcelBySearch(query, fallbackCenter) {
  const trimmed = String(query || "").trim();
  if (!trimmed) {
    throw new Error("Please enter a PCN / parcel ID.");
  }

  const params = new URLSearchParams({
    parid: trimmed,
  });

  const url = `${MAP_API_BASE}/api/parcel-by-id?${params.toString()}`;

  const data = await fetchJson(
    url,
    "Unable to find a parcel for that search.",
  );

  if (typeof data.lat !== "number" || typeof data.lng !== "number") {
    const centroid = computeCentroidFromGeometry(data.geometry);
    if (centroid) {
      data.lat = centroid.lat;
      data.lng = centroid.lng;
    } else if (
      Array.isArray(fallbackCenter) &&
      fallbackCenter.length === 2 &&
      typeof fallbackCenter[0] === "number" &&
      typeof fallbackCenter[1] === "number"
    ) {
      data.lat = fallbackCenter[0];
      data.lng = fallbackCenter[1];
    }
  }

  return data;
}

// ---------------------------------------------------------------------
//  BUFFER / NOTICE RADIUS
// ---------------------------------------------------------------------
export async function getBufferReport(lat, lng, radiusFeet) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusFeet: String(radiusFeet),
  });

  const url = `${MAP_API_BASE}/api/buffer-parcels?${params.toString()}`;

  const res = await fetch(url);
  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    console.error("Buffer report: invalid JSON response");
    throw new Error("Unable to generate buffer / notice-radius report.");
  }

  if (!res.ok) {
    const msg = data && data.error
      ? data.error
      : "Unable to generate buffer / notice-radius report.";
    throw new Error(msg);
  }

  return data;
}

// ---------------------------------------------------------------------
//  BASE MAP LAYERS
// ---------------------------------------------------------------------
export async function getMunicipalBoundaries() {
  const url = `${MAP_API_BASE}/api/municipal-boundaries`;
  return fetchJson(url, "Unable to load municipal boundaries.");
}

export async function getParcelsGeoJSON() {
  const url = `${MAP_API_BASE}/api/parcels-geojson`;
  return fetchJson(url, "Unable to load parcels layer.");
}

export async function getZoningGeoJSON() {
  const url = `${MAP_API_BASE}/api/zoning-geojson`;
  return fetchJson(url, "Unable to load zoning layer.");
}

// ---------------------------------------------------------------------
//  SMART CODE / GPT-ASSISTED ANSWERS
// ---------------------------------------------------------------------
export async function getSmartCodeAnswer(question, context) {
  const url = `${MAP_API_BASE}/api/smart-code`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch (_e) {}
    console.error("Smart code error:", res.status, detail);
    throw new Error("Smart code service unavailable.");
  }

  return res.json();
}

// (Optional future helper, not yet wired to UI)
export async function getJurisdictionProfile(jurisdiction, zoning, flu) {
  const url = `${MAP_API_BASE}/api/jurisdiction-profile`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jurisdiction, zoning, flu }),
  });

  if (!res.ok) {
    throw new Error("Jurisdiction profile service unavailable.");
  }

  return res.json();
}
