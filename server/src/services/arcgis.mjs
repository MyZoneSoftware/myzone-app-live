const BASE =
  "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_Local_Prj/FeatureServer/0/query";

function buildUrl(params) {
  const q = new URLSearchParams({
    f: "json",
    returnGeometry: "true",
    outFields: "*",
    ...params,
  });
  return `${BASE}?${q.toString()}`;
}

export async function queryArcGIS(where, limit = 10) {
  const url = buildUrl({
    where,
    resultRecordCount: String(limit),
  });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ArcGIS request failed: ${res.status}`);
  }

  const json = await res.json();
  if (!json.features) return [];

  return json.features.map((f) => {
    const a = f.attributes || {};
    return {
      id: a.PARCELID || a.PARCEL_ID || null,
      address: a.SITUSADDRESS || null,
      city: a.SITUSCITY || null,
      owner: a.OWNER_NAME || null,
      jurisdiction: a.SITUSCITY || a.MUNICIPALITY || null,
      zoning: a.ZONING || null,
      flu: a.FLU || null,
      geometry: f.geometry
        ? {
            type: "Polygon",
            coordinates: [f.geometry.rings],
          }
        : null,
    };
  });
}
