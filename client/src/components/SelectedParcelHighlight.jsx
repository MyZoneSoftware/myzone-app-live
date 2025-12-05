import React from "react";
import { GeoJSON } from "react-leaflet";

/**
 * Draws the currently selected parcel as a highlighted polygon on top
 * of the base parcel layer.
 *
 * Expects selectedParcel in the shape returned by your API:
 * {
 *   id,
 *   geometry: { type: "Polygon" | "MultiPolygon", coordinates: ... },
 *   ...
 * }
 */
export default function SelectedParcelHighlight({ selectedParcel }) {
  if (!selectedParcel || !selectedParcel.geometry) {
    return null;
  }

  const feature = {
    type: "Feature",
    geometry: selectedParcel.geometry,
    properties: {
      id: selectedParcel.id || "selected-parcel",
    },
  };

  const fc = {
    type: "FeatureCollection",
    features: [feature],
  };

  const highlightStyle = {
    color: "#111827",
    weight: 3,
    fillColor: "#ffffff",
    fillOpacity: 0.2,
  };

  return <GeoJSON data={fc} style={highlightStyle} />;
}
