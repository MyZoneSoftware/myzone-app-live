import { MapContainer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function MapWrapper({
  center,
  zoom,
  children,
}) {
  return (
    <MapContainer key={selectedParcelKey || "none"}
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "50vh",
      }}
      scrollWheelZoom
    >
      {children}
    </MapContainer>
  );
}