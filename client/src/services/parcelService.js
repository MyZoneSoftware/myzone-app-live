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
 * ✅ Map click → parcel (SOURCE OF TRUTH)
 */
export async function getParcelByLatLng(lat, lng) {
  return fetchJson(`${API_BASE}/geo/parcel-by-point?lat=${lat}&lng=${lng}`);
}

/**
 * ✅ SEARCH ADAPTER (FIX)
 * Supports PCN or Address
 * Normalizes output to match getParcelByLatLng()
 */
export async function getParcelBySearch(query) {
  const q = String(query || "").trim();
  if (!q) throw new Error("Search query is required.");

  // 1️⃣ Attempt backend search endpoint
  let data;
  try {
    data = await fetchJson(`${API_BASE}/search/parcel?q=${encodeURIComponent(q)}`);
  } catch {
    data = null;
  }

  // 2️⃣ Normalize result
  const parcel =
    data?.parcel ||
    (Array.isArray(data?.results) ? data.results[0] : null) ||
    data;

  if (
    !parcel ||
    typeof parcel.lat !== "number" ||
    typeof parcel.lng !== "number"
  ) {
    throw new Error("No parcel found for that search.");
  }

  return parcel;
}

/**
 * ✅ Radius buffer (unchanged)
 */
export async function getBufferReport(lat, lng, radiusFeet = 300) {
  return fetchJson(
    `${API_BASE}/geo/buffer?lat=${lat}&lng=${lng}&radiusFeet=${radiusFeet}`
  );
}

/**
 * 🛑 Base layers — SAFE NO-OPS (do NOT remove)
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
 * ✅ SmartCode (payload-based, App.jsx compatible)
 */
export async function getSmartCodeAnswer(question, context) {
  return fetchJson(`${API_BASE}/search/smart-code`, {
    method: "POST",
    body: JSON.stringify({ question, context }),
  });
}

/**
 * ✅ Jurisdiction profile (stub-safe)
 */
export async function getJurisdictionProfile(jurisdiction, zoning, flu) {
  return {
    jurisdiction,
    zoning,
    flu,
    summary:
      "Local zoning profiles are being rolled out. This is a placeholder profile.",
    disclaimer:
      "Always verify against the adopted code and official zoning maps.",
  };
}
