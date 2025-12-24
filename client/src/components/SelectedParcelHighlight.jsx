import { GeoJSON } from "react-leaflet";

/**
 * SelectedParcelHighlight
 * - Forces GeoJSON re-mount when selected parcel changes
 * - Fixes stale geometry without UI or backend changes
 */
export default function SelectedParcelHighlight({ selectedParcel }) {
  if (!selectedParcel || !selectedParcel.geometry) return null;

  // Stable, change-sensitive key to force remount
  const featureKey =
    selectedParcel.id ||
    selectedParcel.parcel_id ||
    selectedParcel.PCN ||
    JSON.stringify(selectedParcel.geometry).slice(0, 64);

  return (
    <GeoJSON
      key={featureKey}
      data={{
        type: "Feature",
        properties: {},
        geometry: selectedParcel.geometry,
      }}
      style={{
        color: "#ff0000",
        weight: 3,
        fillOpacity: 0.15,
      }}
    />
  );
}
