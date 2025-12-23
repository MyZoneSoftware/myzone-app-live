import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";

export default function MapViewComponent({ onParcelSelect }) {
  const mapDiv = useRef(null);
  const viewRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mapDiv.current) return;

    const map = new Map({
      basemap: "streets-navigation-vector"
    });

    const view = new MapView({
      container: mapDiv.current,
      map,
      center: [-80.12, 26.65],
      zoom: 13,
      constraints: { snapToZoom: false }
    });

    viewRef.current = view;

    const parcelsLayer = new FeatureLayer({
      url: "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels_and_Property_Details_Local_Prj/FeatureServer/0",
      outFields: ["*"],
      popupEnabled: false
    });

    map.add(parcelsLayer);

    view.on("click", async (event) => {
      setError(null);

      try {
        const { latitude, longitude } = event.mapPoint;
        const res = await fetch(
          `http://localhost:5003/api/parcel-by-point?lat=${latitude}&lng=${longitude}`
        );

        if (!res.ok) {
          setError("No parcel found at that location");
          return;
        }

        const parcel = await res.json();

        if (typeof onParcelSelect === "function") {
          onParcelSelect(parcel);
        }
      } catch (err) {
        console.error("[MapView] click error:", err);
        setError("Parcel lookup failed");
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [onParcelSelect]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {error && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#c62828",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 4,
            zIndex: 99,
            fontSize: 13
          }}
        >
          {error}
        </div>
      )}
      <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
