import MapView from "./MapView.jsx";
import SelectionPanel from "./SelectionPanel.jsx";

export default function Explore() {
  return (
    <div className="grid grid-cols">
      <div>
        <MapView />
      </div>
      <div className="grid">
        <SelectionPanel />
      </div>
    </div>
  );
}
