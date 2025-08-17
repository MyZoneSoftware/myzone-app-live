import { useEffect, useState } from "react";

export default function SelectionPanel() {
  const [ids, setIds] = useState([]);
  const [rows, setRows] = useState([]);

  // listen for selection changes coming from the map
  useEffect(() => {
    function onSel(e) { setIds(e.detail?.ids || []); }
    window.addEventListener("myzone:selectionChanged", onSel);
    return () => window.removeEventListener("myzone:selectionChanged", onSel);
  }, []);

  // fetch parcel attributes for selected ids
  useEffect(() => {
    (async () => {
      if (!ids.length) { setRows([]); return; }
      const res = await fetch("/data/parcels.geojson");
      const geo = await res.json();
      const selected = new Set(ids.map(String));
      const matches = (geo.features || []).filter(f => selected.has(String(f.properties?.parcel_id || "")));
      setRows(matches.map(f => ({
        parcel_id: f.properties?.parcel_id,
        address: f.properties?.address,
        zoning: f.properties?.zoning,
        ldc: f.properties?.ldc
      })));
    })();
  }, [ids]);

  function exportCSV(){
    if (!rows.length) return;
    const header = ["parcel_id","address","zoning","ldc"];
    const lines = [header.join(",")].concat(
      rows.map(r => header
        .map(h => String(r[h] ?? "").replaceAll('"','""'))
        .map(v => `"${v}"`)
        .join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "myzone-selection.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);

    // show toast confirmation
    window.dispatchEvent(new CustomEvent("myzone:toast", {
      detail: { message: "CSV exported: myzone-selection.csv" }
    }));
  }

  return (
    <section className="card">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h3 style={{ marginTop: 0 }}>Selected Properties ({rows.length})</h3>
        <button onClick={exportCSV} disabled={!rows.length} className="btn-primary" style={{ padding:"8px 12px" }}>
          Export CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 14 }}>Tap a parcel, search by address/ID, or use Box Select.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Parcel ID</th>
                <th>Address</th>
                <th>Zoning</th>
                <th>Land Dev. Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.parcel_id}</td>
                  <td>{r.address}</td>
                  <td>{r.zoning}</td>
                  <td>{r.ldc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
