import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * Keeps Leaflet interactive after React state updates.
 * (No auto-fit here — we only center using lat/lng in App.jsx to avoid lockups.)
 */
export default function MapAutoFit({ selectedParcel }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Re-enable interactions
    try {
      map.dragging?.enable();
      map.scrollWheelZoom?.enable();
      map.doubleClickZoom?.enable();
      map.boxZoom?.enable();
      map.keyboard?.enable();
      map.touchZoom?.enable();
      map.tap?.enable?.();
    } catch (_e) {}

    // Invalidate size to prevent frozen map after layout changes
    const t = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (_e) {}
    }, 60);

    return () => clearTimeout(t);
  }, [map, selectedParcel]);

  return null;
}
