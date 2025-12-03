import React, { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Circle,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import {
  getParcelByLatLng,
  getParcelBySearch,
  getBufferReport,
  getMunicipalBoundaries,
  getParcelsGeoJSON,
  getZoningGeoJSON,
} from "./services/parcelService";

import FeasibilityModal from "./components/FeasibilityModal";
import ZoningReportPanel from "./components/ZoningReportPanel";

const DEFAULT_CENTER = { lat: 26.64, lng: -80.09 };
const DEFAULT_ZOOM = 13;

// ----------------- Inner Map Component -----------------
function InteractiveMap({
  center,
  zoom,
  onParcelClick,
  boundaries,
  parcels,
  zoning,
  bufferReport,
}) {
  const map = useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      onParcelClick(lat, lng);
    },
  });

  useEffect(() => {
    if (center && typeof center.lat === "number" && typeof center.lng === "number") {
      map.flyTo([center.lat, center.lng], zoom, {
        duration: 0.8,
      });
    }
  }, [center, zoom, map]);

  const boundaryStyle = {
    color: "#d4d4d8",
    weight: 1,
    fillOpacity: 0,
  };

  const parcelStyle = {
    color: "#9ca3af",
    weight: 0.4,
    fillOpacity: 0,
  };

  const zoningStyle = {
    color: "#6366f1",
    weight: 0.6,
    fillOpacity: 0.08,
  };

  const bufferCenter =
    bufferReport && bufferReport.center
      ? [bufferReport.center.lat, bufferReport.center.lng]
      : null;

  return (
    <>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {boundaries && <GeoJSON data={boundaries} style={boundaryStyle} />}

      {zoning && <GeoJSON data={zoning} style={zoningStyle} />}

      {parcels && <GeoJSON data={parcels} style={parcelStyle} />}

      {bufferReport && bufferCenter && bufferReport.radiusFeet && (
        <Circle
          center={bufferCenter}
          radius={bufferReport.radiusFeet * 0.3048} // feet → meters
          pathOptions={{ color: "#f97316", weight: 1 }}
        />
      )}
    </>
  );
}

function MapWrapper(props) {
  return (
    <MapContainer
      center={[props.center.lat, props.center.lng]}
      zoom={props.zoom}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom={true}
    >
      <InteractiveMap {...props} />
    </MapContainer>
  );
}

// ----------------- Main App -----------------
function App() {
  // View mode
  const [viewMode, setViewMode] = useState("map"); // "map" | "applications" | "reports"

  // Map state
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [zoom] = useState(DEFAULT_ZOOM);

  // Layers
  const [boundaries, setBoundaries] = useState(null);
  const [parcelsGeoJSON, setParcelsGeoJSON] = useState(null);
  const [zoningGeoJSON, setZoningGeoJSON] = useState(null);
  const [layersLoading, setLayersLoading] = useState(true);
  const [layersError, setLayersError] = useState(null);

  // Parcel selection
  const [selectedParcel, setSelectedParcel] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // Buffer / notice radius
  const [isBufferOpen, setIsBufferOpen] = useState(true);
  const [bufferRadiusFeet, setBufferRadiusFeet] = useState(300);
  const [bufferReport, setBufferReport] = useState(null);
  const [bufferLoading, setBufferLoading] = useState(false);
  const [bufferError, setBufferError] = useState(null);

  // Modals
  const [isFeasibilityOpen, setIsFeasibilityOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Global banner
  const [banner, setBanner] = useState(null);

  // ---------- Load base layers ----------
  useEffect(() => {
    async function loadLayers() {
      setLayersLoading(true);
      setLayersError(null);
      try {
        const [b, p, z] = await Promise.all([
          getMunicipalBoundaries(),
          getParcelsGeoJSON(),
          getZoningGeoJSON(),
        ]);
        setBoundaries(b);
        setParcelsGeoJSON(p);
        setZoningGeoJSON(z);
      } catch (err) {
        console.error("Error loading base layers:", err);
        setLayersError("Unable to load map layers. Please try again later.");
      } finally {
        setLayersLoading(false);
      }
    }
    loadLayers();
  }, []);

  // ---------- Handlers ----------

  const handleParcelClick = async (lat, lng) => {
    if (viewMode !== "map") return;
    setBanner(null);
    setBufferError(null);
    setBufferReport(null);

    try {
      const parcel = await getParcelByLatLng(lat, lng);

      if (parcel && typeof parcel.lat === "number" && typeof parcel.lng === "number") {
        setMapCenter({ lat: parcel.lat, lng: parcel.lng });
      }
      setSelectedParcel(parcel);
    } catch (err) {
      console.error("Parcel click error:", err);
      setBanner(err.message || "Unable to identify a parcel at that location.");
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setBanner(null);
    setSearchLoading(true);
    setBufferReport(null);
    setBufferError(null);

    try {
      const parcel = await getParcelBySearch(trimmed, [mapCenter.lat, mapCenter.lng]);
      if (parcel && typeof parcel.lat === "number" && typeof parcel.lng === "number") {
        setMapCenter({ lat: parcel.lat, lng: parcel.lng });
      }
      setSelectedParcel(parcel);
    } catch (err) {
      console.error("Search error:", err);
      setBanner(err.message || "Unable to find a parcel for that search.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleGenerateBuffer = async () => {
    if (
      !selectedParcel ||
      typeof selectedParcel.lat !== "number" ||
      typeof selectedParcel.lng !== "number"
    ) {
      setBufferError("Select a parcel first (click the map or search by ID).");
      return;
    }

    setBufferLoading(true);
    setBufferError(null);
    setBanner(null);

    try {
      const report = await getBufferReport(
        selectedParcel.lat,
        selectedParcel.lng,
        bufferRadiusFeet,
      );
      if (report.error) {
        setBufferError(report.error);
        setBufferReport(null);
      } else {
        setBufferReport(report);
      }
    } catch (err) {
      console.error("Buffer error:", err);
      setBufferError("Unable to generate buffer / notice-radius report.");
      setBufferReport(null);
    } finally {
      setBufferLoading(false);
    }
  };

  const bufferCount = useMemo(
    () =>
      bufferReport && Array.isArray(bufferReport.parcels)
        ? bufferReport.parcels.length
        : 0,
    [bufferReport],
  );

  // When you click a parcel row in the buffer table
  const handleBufferParcelClick = (row) => {
    // Recenter map to this parcel's centroid if present
    if (row.centroid && typeof row.centroid.lat === "number" && typeof row.centroid.lng === "number") {
      setMapCenter({ lat: row.centroid.lat, lng: row.centroid.lng });
    }

    // Update selected parcel with what we know from the buffer row.
    // Keep existing zoning/flu if we already have them; otherwise default to "TBD".
    setSelectedParcel((prev) => {
      return {
        id: row.id || prev?.id || "UNKNOWN",
        address: row.address || prev?.address || "Parcel",
        jurisdiction: row.jurisdiction || prev?.jurisdiction || "Unknown jurisdiction",
        zoning: prev?.zoning || "TBD",
        flu: prev?.flu || "TBD",
        areaAcres:
          typeof row.areaAcres === "number"
            ? row.areaAcres
            : prev?.areaAcres ?? null,
        lat:
          row.centroid && typeof row.centroid.lat === "number"
            ? row.centroid.lat
            : prev?.lat ?? DEFAULT_CENTER.lat,
        lng:
          row.centroid && typeof row.centroid.lng === "number"
            ? row.centroid.lng
            : prev?.lng ?? DEFAULT_CENTER.lng,
        raw: prev?.raw || null,
        geometry: prev?.geometry || null,
      };
    });
  };

  const handleStartApplication = () => {
    // Hook up to your Applications module later.
    setBanner(
      "Application flow is coming soon. This will create a project for the selected parcel.",
    );
  };

  // ---------- Render helpers ----------

  const renderRightPanelContent = () => {
    if (!selectedParcel) {
      return (
        <div style={{ color: "#6b7280", fontSize: "13px" }}>
          Click a parcel on the map or search by PARID to view details.
        </div>
      );
    }

    return (
      <>
        {/* Summary header */}
        <div style={{ marginBottom: "10px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600 }}>
            Parcel {selectedParcel.id}
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            {selectedParcel.jurisdiction}
          </div>
          <div
            style={{
              marginTop: "6px",
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "999px",
                backgroundColor: "#eef2ff",
                color: "#4f46e5",
              }}
            >
              Zoning: {selectedParcel.zoning || "TBD"}
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "999px",
                backgroundColor: "#ecfdf3",
                color: "#15803d",
              }}
            >
              FLU: {selectedParcel.flu || "TBD"}
            </span>
            {selectedParcel.areaAcres != null && (
              <span
                style={{
                  fontSize: "11px",
                  padding: "3px 8px",
                  borderRadius: "999px",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                }}
              >
                {selectedParcel.areaAcres.toFixed(3)} ac
              </span>
            )}
          </div>
        </div>

        {/* Basic info */}
        <div style={{ marginBottom: "10px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "#6b7280",
              textTransform: "uppercase",
            }}
          >
            Label
          </div>
          <div style={{ fontSize: "13px" }}>{selectedParcel.address}</div>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "#6b7280",
              textTransform: "uppercase",
            }}
          >
            Parcel ID
          </div>
          <div style={{ fontSize: "13px" }}>{selectedParcel.id}</div>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "#6b7280",
              textTransform: "uppercase",
            }}
          >
            Jurisdiction
          </div>
          <div style={{ fontSize: "13px" }}>{selectedParcel.jurisdiction}</div>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "#6b7280",
              textTransform: "uppercase",
            }}
          >
            Zoning
          </div>
          <div style={{ fontSize: "13px" }}>{selectedParcel.zoning || "TBD"}</div>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "#6b7280",
              textTransform: "uppercase",
            }}
          >
            Future Land Use (FLU)
          </div>
          <div style={{ fontSize: "13px" }}>{selectedParcel.flu || "TBD"}</div>
        </div>

        {/* Actions */}
        <div
          style={{
            marginTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <button
            onClick={() => setIsFeasibilityOpen(true)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "999px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Open Feasibility
          </button>
          <button
            onClick={() => setIsReportOpen(true)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "999px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              color: "#111827",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Generate Zoning Report
          </button>
          <button
            onClick={handleStartApplication}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "999px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              color: "#111827",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Start Application (coming soon)
          </button>
        </div>
      </>
    );
  };

  const renderMainContent = () => {
    if (viewMode === "map") {
      return (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Map area */}
          <div style={{ flex: 2, borderRight: "1px solid #e5e5e5" }}>
            {layersLoading ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  color: "#6b7280",
                }}
              >
                Loading map layers…
              </div>
            ) : layersError ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  color: "#b91c1c",
                }}
              >
                {layersError}
              </div>
            ) : (
              <div style={{ width: "100%", height: "100%", position: "relative" }}>
                <MapWrapper
                  center={mapCenter}
                  zoom={zoom}
                  onParcelClick={handleParcelClick}
                  boundaries={boundaries}
                  parcels={parcelsGeoJSON}
                  zoning={zoningGeoJSON}
                  bufferReport={bufferReport}
                />

                {/* Small status chip top-left */}
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    padding: "4px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    backgroundColor: "rgba(255,255,255,0.9)",
                    border: "1px solid #e5e7eb",
                    color: "#4b5563",
                  }}
                >
                  Palm Beach County · Parcels · Zoning · Municipalities
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <aside
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#ffffff",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #f3f4f6",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              Selected Parcel
            </div>
            <div
              style={{
                padding: "12px 16px",
                fontSize: "13px",
                flex: 1,
                overflowY: "auto",
              }}
            >
              {renderRightPanelContent()}
            </div>
          </aside>
        </div>
      );
    }

    if (viewMode === "applications") {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          Applications workspace is coming soon. It will list all development
          applications, their stages, and link them to selected parcels.
        </div>
      );
    }

    // reports
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: "14px",
        }}
      >
        Reports workspace is coming soon. It will provide zoning, FLU, and
        notice-radius reports for export.
      </div>
    );
  };

  // ----------------- Render -----------------
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        backgroundColor: "#f5f5f7",
        color: "#111",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #e5e5e5",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600, fontSize: "17px" }}>MyZone</span>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>
            Palm Beach County · Parcel & Zoning Explorer
          </span>
        </div>

        {/* Global search */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            flex: 1,
            maxWidth: 480,
            marginLeft: "32px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: "999px",
              border: "1px solid #d1d5db",
              backgroundColor: "#f9fafb",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                color: "#9ca3af",
                marginRight: "6px",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by PARID (e.g. 70434418010000090)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "13px",
                color: "#111827",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={searchLoading}
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: "none",
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: "12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {searchLoading ? "Searching…" : "Search"}
          </button>
        </form>

        {/* View toggles */}
        <div
          style={{
            display: "flex",
            borderRadius: "999px",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            fontSize: "12px",
          }}
        >
          {["map", "applications", "reports"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "5px 10px",
                border: "none",
                cursor: "pointer",
                backgroundColor: viewMode === mode ? "#111827" : "transparent",
                color: viewMode === mode ? "#ffffff" : "#4b5563",
              }}
            >
              {mode === "map"
                ? "Map"
                : mode === "applications"
                ? "Applications"
                : "Reports"}
            </button>
          ))}
        </div>

        {/* Profile placeholder */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "999px",
            backgroundColor: "#111827",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            marginLeft: "8px",
          }}
        >
          JL
        </div>
      </header>

      {/* Banner */}
      {banner && (
        <div
          style={{
            padding: "8px 16px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            fontSize: "13px",
            borderBottom: "1px solid #fecaca",
          }}
        >
          {banner}
        </div>
      )}

      {/* Main row: left rail + content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
        }}
      >
        {/* Left rail */}
        <nav
          style={{
            width: 72,
            backgroundColor: "#f9fafb",
            borderRight: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 12,
            gap: 12,
          }}
        >
          {/* Home / dashboard */}
          <button
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "none",
              backgroundColor: "#ffffff",
              boxShadow: "0 0 0 1px #e5e7eb",
              fontSize: "14px",
              cursor: "pointer",
            }}
            title="Dashboard"
          >
            ⌂
          </button>

          {/* Layers (placeholder) */}
          <button
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "none",
              backgroundColor: "#ffffff",
              boxShadow: "0 0 0 1px #e5e7eb",
              fontSize: "16px",
              cursor: "pointer",
            }}
            title="Layers (coming soon)"
          >
            🗺
          </button>

          {/* Buffer tool toggle */}
          <button
            onClick={() => setIsBufferOpen((prev) => !prev)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "none",
              backgroundColor: isBufferOpen ? "#111827" : "#ffffff",
              color: isBufferOpen ? "#ffffff" : "#111827",
              boxShadow: "0 0 0 1px #e5e7eb",
              fontSize: "15px",
              cursor: "pointer",
            }}
            title="Notice radius / buffer"
          >
            ◯
          </button>

          {/* Applications shortcut */}
          <button
            onClick={() => setViewMode("applications")}
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "none",
              backgroundColor:
                viewMode === "applications" ? "#111827" : "#ffffff",
              color: viewMode === "applications" ? "#ffffff" : "#111827",
              boxShadow: "0 0 0 1px #e5e7eb",
              fontSize: "15px",
              cursor: "pointer",
            }}
            title="Applications"
          >
            📄
          </button>

          {/* Reports shortcut */}
          <button
            onClick={() => setViewMode("reports")}
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "none",
              backgroundColor: viewMode === "reports" ? "#111827" : "#ffffff",
              color: viewMode === "reports" ? "#ffffff" : "#111827",
              boxShadow: "0 0 0 1px #e5e7eb",
              fontSize: "15px",
              cursor: "pointer",
            }}
            title="Reports"
          >
            📊
          </button>
        </nav>

        {/* Main content */}
        {renderMainContent()}
      </div>

      {/* Bottom drawer: buffer / notice radius (only in map view) */}
      {viewMode === "map" && (
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            transition: "height 0.2s ease",
            height: isBufferOpen ? 260 : 40,
            overflow: "hidden",
          }}
        >
          {/* Drawer header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 16px",
              fontSize: "13px",
            }}
          >
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 500 }}>Notice Radius / Buffer Tool</span>
              <span
                style={{
                  marginLeft: 8,
                  color: "#6b7280",
                  fontSize: "12px",
                }}
              >
                Select a parcel and choose a radius to find affected parcels.
              </span>
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#4b5563",
                marginRight: 16,
                whiteSpace: "nowrap",
              }}
            >
              Parcels: {bufferCount} in {bufferRadiusFeet} ft
            </div>
            <button
              onClick={() => setIsBufferOpen((prev) => !prev)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              {isBufferOpen ? "▾" : "▴"}
            </button>
          </div>

          {/* Drawer body */}
          {isBufferOpen && (
            <div
              style={{
                padding: "8px 16px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: "13px",
                borderTop: "1px solid #f3f4f6",
                height: "100%",
              }}
            >
              {/* Controls row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <label style={{ fontSize: "12px", color: "#4b5563" }}>
                  Radius (feet):
                  <input
                    type="number"
                    value={bufferRadiusFeet}
                    onChange={(e) =>
                      setBufferRadiusFeet(Number(e.target.value) || 0)
                    }
                    min={50}
                    max={5280}
                    style={{
                      marginLeft: 6,
                      width: 90,
                      padding: "4px 6px",
                      fontSize: "12px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </label>

                <div style={{ display: "flex", gap: 6 }}>
                  {[150, 300, 500, 1000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setBufferRadiusFeet(val)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: "999px",
                        border: "1px solid #e5e7eb",
                        backgroundColor:
                          bufferRadiusFeet === val ? "#111827" : "#ffffff",
                        color:
                          bufferRadiusFeet === val ? "#ffffff" : "#4b5563",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      {val} ft
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGenerateBuffer}
                  disabled={bufferLoading}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "999px",
                    border: "none",
                    backgroundColor: "#111827",
                    color: "#ffffff",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  {bufferLoading ? "Generating…" : "Generate buffer"}
                </button>

                <button
                  disabled={!bufferReport || bufferCount === 0}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "999px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                    color:
                      bufferReport && bufferCount > 0 ? "#111827" : "#9ca3af",
                    fontSize: "12px",
                    cursor:
                      bufferReport && bufferCount > 0 ? "pointer" : "default",
                  }}
                  title="Export buffer parcels as CSV (coming soon)"
                >
                  Export CSV (coming soon)
                </button>
              </div>

              {/* Error / info */}
              {bufferError && (
                <div style={{ color: "#b91c1c", fontSize: "12px" }}>
                  {bufferError}
                </div>
              )}

              {bufferReport && !bufferError && (
                <div style={{ fontSize: "12px", color: "#374151" }}>
                  <div>
                    <strong>Center:</strong>{" "}
                    {bufferReport.center
                      ? `${bufferReport.center.lat.toFixed(
                          5,
                        )}, ${bufferReport.center.lng.toFixed(5)}`
                      : "—"}
                  </div>
                  <div>
                    <strong>Radius:</strong> {bufferReport.radiusFeet} ft
                  </div>
                  <div>
                    <strong>Parcels in buffer:</strong> {bufferCount}
                  </div>
                </div>
              )}

              {/* Buffer table */}
              {bufferReport &&
                !bufferError &&
                Array.isArray(bufferReport.parcels) &&
                bufferReport.parcels.length > 0 && (
                  <div
                    style={{
                      marginTop: 4,
                      flex: 1,
                      overflowY: "auto",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12px",
                      }}
                    >
                      <thead
                        style={{
                          backgroundColor: "#f9fafb",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <tr>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "6px 8px",
                              borderBottom: "1px solid #e5e7eb",
                              fontWeight: 500,
                              color: "#4b5563",
                            }}
                          >
                            Parcel ID
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "6px 8px",
                              borderBottom: "1px solid #e5e7eb",
                              fontWeight: 500,
                              color: "#4b5563",
                            }}
                          >
                            Jurisdiction
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid #e5e7eb",
                              fontWeight: 500,
                              color: "#4b5563",
                            }}
                          >
                            Acres
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bufferReport.parcels.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() => handleBufferParcelClick(row)}
                            style={{
                              cursor: "pointer",
                              backgroundColor: "#ffffff",
                            }}
                          >
                            <td
                              style={{
                                padding: "5px 8px",
                                borderBottom: "1px solid #f3f4f6",
                                color: "#111827",
                              }}
                            >
                              {row.id}
                            </td>
                            <td
                              style={{
                                padding: "5px 8px",
                                borderBottom: "1px solid #f3f4f6",
                                color: "#4b5563",
                              }}
                            >
                              {row.jurisdiction}
                            </td>
                            <td
                              style={{
                                padding: "5px 8px",
                                borderBottom: "1px solid #f3f4f6",
                                textAlign: "right",
                                color: "#4b5563",
                              }}
                            >
                              {typeof row.areaAcres === "number"
                                ? row.areaAcres.toFixed(3)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
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
  );
}

export default App;
