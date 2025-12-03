import MapView from "./MapView.jsx";
import SelectionPanel from "./SelectionPanel.jsx";

export default function Home() {
  return (
    <div className="grid grid-cols">
      <div>
        <MapView />
      </div>
      <div className="grid">
        <SelectionPanel />
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Recent Regulations</h3>
          <div style={{ color: "#6b7280", fontSize: 14 }}>No items yet.</div>
        </section>
      </div>
    </div>
  );
}
