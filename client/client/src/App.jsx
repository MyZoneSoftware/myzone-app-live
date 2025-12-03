import React, { useState } from "react";
import { MapContainer, TileLayer, useMapEvents, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Simple component to handle map clicks and update selected "parcel"
 * (for now we simulate parcel selection; later we will connect real parcel data)
 */
function ClickableMap({ onSelect }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      // Simulate a "parcel" selection from the click
      const fakeParcel = {
        id: "00-00-00-00-000-0000",
        address: "Sample Parcel, Palm Beach County",
        zoning: "MXD",
        flu: "Commercial",
        jurisdiction: "Palm Beach County",
        areaAcres: 1.25,
        lat,
        lng,
      };
      onSelect(fakeParcel);
    },
  });

  return null;
}

/**
 * Top navigation bar
 */
function TopNav() {
  return (
    <header className="top-nav">
      <div className="top-nav-left">
        <div className="brand-mark">MZ</div>
        <div>
          <div className="brand-name">MyZone</div>
          <div className="brand-subtle">Zoning &amp; Land Use Intelligence</div>
        </div>
      </div>

      <div className="top-nav-center">
        <select className="jurisdiction-select">
          <option>Select jurisdiction</option>
          <option>Palm Beach County</option>
          <option>City of Greenacres</option>
          <option>City of Delray Beach</option>
          <option>City of Boynton Beach</option>
        </select>
      </div>

      <div className="top-nav-right">
        <button className="nav-ghost-button">
          <span className="icon">📊</span>
          Dashboard
        </button>
        <button className="nav-ghost-button">
          <span className="icon">🔐</span>
          Login
        </button>
        <div className="avatar-pill">JL</div>
      </div>
    </header>
  );
}

/**
 * Left panel: search + tools + layers + quick insights
 */
function LeftPanel({ searchQuery, onChangeSearch, onSearchClick, selectedParcel }) {
  return (
    <aside className="left-panel">
      <div className="left-panel-header">
        <div className="section-title">Search</div>
        <div className="search-pill">
          <div className="search-icon">🔍</div>
          <input
            className="search-input"
            placeholder="Address, parcel ID, or owner"
            value={searchQuery}
            onChange={(e) => onChangeSearch(e.target.value)}
          />
          <button className="search-button" onClick={onSearchClick}>
            Go
          </button>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-card-header">
          <div className="panel-card-title">Parcel tools</div>
          <div className="panel-card-subtitle">Select or draw an area</div>
        </div>
        <div className="panel-chip-row">
          <button className="chip icon-chip">
            <span className="icon">🧭</span> Select on map
          </button>
          <button className="chip icon-chip">
            <span className="icon">📐</span> Draw polygon
          </button>
          <button className="chip icon-chip">
            <span className="icon">⭕</span> Draw radius
          </button>
          <button className="chip icon-chip">
            <span className="icon">✖️</span> Clear selection
          </button>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-card-header">
          <div className="panel-card-title">Layers</div>
          <div className="panel-card-subtitle">Toggle map overlays</div>
        </div>
        <div className="layer-list">
          <label className="layer-item">
            <input type="checkbox" defaultChecked />
            Parcels
          </label>
          <label className="layer-item">
            <input type="checkbox" defaultChecked />
            Zoning districts
          </label>
          <label className="layer-item">
            <input type="checkbox" defaultChecked />
            Future Land Use (FLU)
          </label>
          <label className="layer-item">
            <input type="checkbox" />
            Overlays &amp; special districts
          </label>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-card-header">
          <div className="panel-card-title">Quick insights</div>
          <div className="panel-card-subtitle">For selected parcel</div>
        </div>
        <div className="quick-insights-list">
          <div className="quick-insight-row">
            <div className="quick-insight-label">Zoning</div>
            <div className="quick-insight-value">
              {selectedParcel?.zoning || "—"}
            </div>
          </div>
          <div className="quick-insight-row">
            <div className="quick-insight-label">Future Land Use</div>
            <div className="quick-insight-value">
              {selectedParcel?.flu || "—"}
            </div>
          </div>
          <div className="quick-insight-row">
            <div className="quick-insight-label">Parcel area</div>
            <div className="quick-insight-value">
              {selectedParcel?.areaAcres
                ? `${selectedParcel.areaAcres.toFixed(2)} ac`
                : "—"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Right-side info panel for the selected parcel
 */
function ParcelPanel({
  parcel,
  onClose,
  onRunFeasibility,
  onGenerateReport,
  onStartApplication,
}) {
  if (!parcel) return null;

  return (
    <aside className="parcel-panel">
      <div className="parcel-panel-header">
        <div>
          <div className="parcel-panel-title">Selected parcel</div>
          <div className="parcel-panel-badge">Prototype · UX</div>
        </div>
        <button className="parcel-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div>
        <div className="parcel-section-label">Location</div>
        <div className="parcel-detail-grid">
          <div className="parcel-detail-label">Address</div>
          <div className="parcel-detail-value">{parcel.address}</div>
          <div className="parcel-detail-label">Jurisdiction</div>
          <div className="parcel-detail-value">{parcel.jurisdiction}</div>
          <div className="parcel-detail-label">Parcel ID</div>
          <div className="parcel-detail-value">{parcel.id}</div>
          <div className="parcel-detail-label">Area</div>
          <div className="parcel-detail-value">
            {parcel.areaAcres ? `${parcel.areaAcres.toFixed(2)} acres` : "—"}
          </div>
        </div>
      </div>

      <div>
        <div className="parcel-section-label">Regulatory</div>
        <div className="parcel-detail-grid">
          <div className="parcel-detail-label">Zoning</div>
          <div className="parcel-detail-value">{parcel.zoning}</div>
          <div className="parcel-detail-label">Future Land Use</div>
          <div className="parcel-detail-value">{parcel.flu}</div>
          <div className="parcel-detail-label">Height limit</div>
          <div className="parcel-detail-value">TBD</div>
          <div className="parcel-detail-label">FAR / Density</div>
          <div className="parcel-detail-value">TBD</div>
        </div>
      </div>

      <div className="parcel-actions">
        <button
          className="parcel-action-primary"
          onClick={onRunFeasibility}
        >
          Run feasibility for this parcel
        </button>
        <button
          className="parcel-action-secondary"
          onClick={onGenerateReport}
        >
          Generate zoning &amp; FLU report
        </button>
        <button
          className="parcel-action-secondary"
          onClick={onStartApplication}
        >
          Start development application
        </button>
      </div>
    </aside>
  );
}

/**
 * Floating action buttons on top of the map
 */
function FloatingActions({
  onNewApplication,
  onGenerateReport,
  onRunFeasibility,
  onBufferTool,
}) {
  return (
    <div className="fab-column">
      <button className="fab-button" onClick={onNewApplication}>
        <span className="fab-icon">➕</span>
        <span className="fab-label">New application</span>
      </button>
      <button className="fab-button" onClick={onGenerateReport}>
        <span className="fab-icon">📄</span>
        <span className="fab-label">Generate report</span>
      </button>
      <button className="fab-button" onClick={onRunFeasibility}>
        <span className="fab-icon">📐</span>
        <span className="fab-label">Run feasibility</span>
      </button>
      <button className="fab-button" onClick={onBufferTool}>
        <span className="fab-icon">📏</span>
        <span className="fab-label">Buffer tool</span>
      </button>
    </div>
  );
}

/**
 * Feasibility modal (prototype only)
 */
function FeasibilityModal({ isOpen, parcel, onClose }) {
  const [useType, setUseType] = useState("Multifamily residential");
  const [units, setUnits] = useState("20");
  const [parkingType, setParkingType] = useState("Surface");

  if (!isOpen || !parcel) return null;

  const simulatedResult =
    "Preliminary check only · Full feasibility will verify height, FAR, parking, and special districts.";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="modal-title">Feasibility – {parcel.zoning}</div>
            <div className="modal-subtitle">
              {parcel.address || "Selected parcel"}
            </div>
          </div>
          <button
            className="parcel-panel-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-field-group">
            <label className="modal-field-label">Proposed use</label>
            <select
              className="modal-field-input"
              value={useType}
              onChange={(e) => setUseType(e.target.value)}
            >
              <option>Multifamily residential</option>
              <option>Townhomes</option>
              <option>Retail / Commercial</option>
              <option>Office</option>
              <option>Mixed-use</option>
            </select>
          </div>

          <div className="modal-two-col">
            <div className="modal-field-group">
              <label className="modal-field-label">Proposed units / GFA</label>
              <input
                className="modal-field-input"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
            </div>
            <div className="modal-field-group">
              <label className="modal-field-label">Parking configuration</label>
              <select
                className="modal-field-input"
                value={parkingType}
                onChange={(e) => setParkingType(e.target.value)}
              >
                <option>Surface</option>
                <option>Structured</option>
                <option>Surface + structured</option>
              </select>
            </div>
          </div>

          <div className="modal-summary-card">
            <div className="modal-summary-label">Preliminary result</div>
            <div className="modal-summary-main">
              No blocking conflicts detected at this high level.
            </div>
            <div className="modal-summary-sub">
              {simulatedResult}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="parcel-action-secondary" onClick={onClose}>
            Close
          </button>
          <button className="parcel-action-primary">
            Save scenario (prototype)
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Zoning & FLU report panel (prototype)
 */
function ZoningReportPanel({ isOpen, parcel, onClose }) {
  if (!isOpen || !parcel) return null;

  return (
    <div className="report-panel">
      <div className="report-panel-inner">
        <div className="report-header">
          <div>
            <div className="report-title">Zoning &amp; FLU summary</div>
            <div className="report-subtitle">
              {parcel.address || "Selected parcel"} · {parcel.jurisdiction}
            </div>
          </div>
          <button
            className="parcel-panel-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="report-grid">
          <div className="report-section">
            <div className="report-section-label">Zoning</div>
            <div className="report-row">
              <span className="report-label">District</span>
              <span className="report-value">{parcel.zoning}</span>
            </div>
            <div className="report-row">
              <span className="report-label">Allowed uses</span>
              <span className="report-value">
                Placeholder: Residential, office, and limited commercial.
              </span>
            </div>
            <div className="report-row">
              <span className="report-label">Height</span>
              <span className="report-value">
                Placeholder: 65' or 5 stories (verify per code).
              </span>
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-label">Future Land Use</div>
            <div className="report-row">
              <span className="report-label">FLU category</span>
              <span className="report-value">{parcel.flu}</span>
            </div>
            <div className="report-row">
              <span className="report-label">Intensity</span>
              <span className="report-value">
                Placeholder: Up to 2.0 FAR, subject to compatibility.
              </span>
            </div>
            <div className="report-row">
              <span className="report-label">Density</span>
              <span className="report-value">
                Placeholder: 12–30 du/ac depending on policy area.
              </span>
            </div>
          </div>
        </div>

        <div className="report-footer">
          <button className="parcel-action-secondary" onClick={onClose}>
            Close
          </button>
          <button className="parcel-action-primary">
            Export (prototype)
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main App component: assembles layout
 */
function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [isFeasibilityOpen, setIsFeasibilityOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Default map center somewhere in Palm Beach County
  const center = [26.64, -80.09];
  const zoom = 11;

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    // For now, we simulate a parcel from search until backend is connected
    const fakeParcel = {
      id: "00-42-43-27-05-092-0010",
      address: searchQuery,
      zoning: "MXD",
      flu: "Commercial",
      jurisdiction: "Palm Beach County",
      areaAcres: 1.2,
      lat: center[0],
      lng: center[1],
    };
    setSelectedParcel(fakeParcel);
  };

  // Simple "parcel geometry" placeholder if we have a selected parcel
  const parcelPolygon = selectedParcel
    ? [
        [selectedParcel.lat + 0.002, selectedParcel.lng - 0.002],
        [selectedParcel.lat + 0.002, selectedParcel.lng + 0.002],
        [selectedParcel.lat - 0.002, selectedParcel.lng + 0.002],
        [selectedParcel.lat - 0.002, selectedParcel.lng - 0.002],
      ]
    : null;

  const openFeasibility = () => {
    if (selectedParcel) {
      setIsFeasibilityOpen(true);
    }
  };

  const openReport = () => {
    if (selectedParcel) {
      setIsReportOpen(true);
    }
  };

  const startApplication = () => {
    if (!selectedParcel) return;
    // Placeholder behaviour; later this will route to your Applications module
    alert(
      `Prototype only: this would start a new application for parcel ${selectedParcel.id}.`
    );
  };

  const openBufferTool = () => {
    alert("Prototype only: buffer tool UI coming next.");
  };

  return (
    <div className="app-root">
      <TopNav />
      <main className="app-main">
        <LeftPanel
          searchQuery={searchQuery}
          onChangeSearch={setSearchQuery}
          onSearchClick={handleSearch}
          selectedParcel={selectedParcel}
        />
        <div className="map-area">
          <div className="map-wrapper">
            <MapContainer center={center} zoom={zoom} scrollWheelZoom>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickableMap
                onSelect={(parcel) => {
                  setSelectedParcel(parcel);
                }}
              />
              {parcelPolygon && (
                <Polygon
                  positions={parcelPolygon}
                  pathOptions={{ color: "#2563eb" }}
                />
              )}
            </MapContainer>
          </div>

          <FloatingActions
            onNewApplication={startApplication}
            onGenerateReport={openReport}
            onRunFeasibility={openFeasibility}
            onBufferTool={openBufferTool}
          />

          <ParcelPanel
            parcel={selectedParcel}
            onClose={() => setSelectedParcel(null)}
            onRunFeasibility={openFeasibility}
            onGenerateReport={openReport}
            onStartApplication={startApplication}
          />

          <FeasibilityModal
            isOpen={isFeasibilityOpen}
            parcel={selectedParcel}
            onClose={() => setIsFeasibilityOpen(false)}
          />

          <ZoningReportPanel
            isOpen={isReportOpen}
            parcel={selectedParcel}
            onClose={() => setIsReportOpen(false)}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
