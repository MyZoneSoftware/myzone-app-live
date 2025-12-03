/**
 * Lightweight Nominatim search for address/place lookups (Florida focus by default).
 * Usage: searchPlaces('123 Main St, Miami FL')
 */
export async function searchPlaces(q, { countrycodes = 'us', viewbox = null, bounded = 0, signal } = {}) {
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes,
    'accept-language': 'en',
    limit: '8',
  });
  if (viewbox) params.set('viewbox', viewbox);
  if (bounded) params.set('bounded', String(bounded));

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal
  });
  if (!res.ok) throw new Error(`Geocoder HTTP_${res.status}`);
  return res.json();
}
