import React, { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Circle,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./leaflet-fix.css";

import {
  getParcelByLatLng,
  getParcelBySearch,
  getBufferReport,
  getMunicipalBoundaries,
  getParcelsGeoJSON,
  getZoningGeoJSON,
  getSmartCodeAnswer,
  getJurisdictionProfile,   // ⬅️ NEW IMPORT
} from "./services/parcelService";

import FeasibilityModal from "./components/FeasibilityModal";

const DEFAULT_CENTER = { lat: 26.64, lng: -80.09 };
const DEFAULT_ZOOM = 13;
const BRAND_BLUE = "#0f172a";
const BRAND_LIGHT_BLUE = "#2563eb";

const FL_REGIONS = [
  { value: "Palm Beach County, FL", label: "Palm Beach County", type: "County" },
  {
    value: "Palm Beach County, FL · Village of Palm Springs",
    label: "Village of Palm Springs",
    type: "Municipality",
  },
  { value: "Broward County, FL", label: "Broward County", type: "County" },
  { value: "Miami-Dade County, FL", label: "Miami-Dade County", type: "County" },
  { value: "Orange County, FL · Orlando", label: "City of Orlando", type: "Municipality" },
  { value: "Hillsborough County, FL · Tampa", label: "City of Tampa", type: "Municipality" },
  {
    value: "Duval County, FL · Jacksonville",
    label: "City of Jacksonville",
    type: "Municipality",
  },
  {
    value: "Other Florida jurisdictions (coming soon)",
    label: "Other Florida jurisdictions",
    type: "Coming soon",
  },
];

function InteractiveMap({
  center,
  zoom,
  onMapClick,
  boundaries,
  parcels,
  zoning,
  selectedParcel,
  bufferReport,
}) {
  const map = useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);
    },
  });

  useEffect(() => {
    if (center && typeof center.lat === "number" && typeof center.lng === "number") {
      map.flyTo([center.lat, center.lng], zoom, {
        duration: 0.8,
      });
    }
  }, [center, zoom, map]);

  // Ensure Leaflet recalculates layout when the map is mounted or becomes visible
  useEffect(() => {
    const resize = () => {
      try {
        map.invalidateSize();
      } catch (e) {
        // ignore
      }
    };

    // Run once when the map is ready
    resize();

    // Also respond to window resizes (and layout shifts)
    window.addEventListener("resize", resize);

    // Extra nudge shortly after mount to handle hidden-then-shown transitions
    const t = setTimeout(resize, 300);

    return () => {
      window.removeEventListener("resize", resize);
      clearTimeout(t);
    };
  }, [map]);

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
    color: "#0ea5e9",
    weight: 0.6,
    fillOpacity: 0.08,
  };

  const bufferCenter =
    bufferReport && bufferReport.center
      ? [bufferReport.center.lat, bufferReport.center.lng]
      : null;

  const selectedFeatureCollection =
    selectedParcel && selectedParcel.geometry
      ? {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: selectedParcel.geometry,
            },
          ],
        }
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

      {selectedFeatureCollection && (
        <GeoJSON
          data={selectedFeatureCollection}
          style={{
            color: "#ef4444",
            weight: 2,
            fillOpacity: 0,
          }}
        />
      )}

      {bufferReport && bufferCenter && bufferReport.radiusFeet && (
        <Circle
          center={bufferCenter}
          radius={bufferReport.radiusFeet * 0.3048}
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
      style={{
        width: "100%",
        height: "100%",
        minHeight: "calc(100vh - 140px)",
      }}
      scrollWheelZoom={true}
    >
      <InteractiveMap {...props} />
    </MapContainer>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "#9ca3af",
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: "#111827" }}>{value}</div>
    </div>
  );
}

function TileCard({
  onClick,
  title,
  icon,
  description,
  footer,
  muted,
  interactive,
  children,
}) {
  const [hovered, setHovered] = useState(false);

  const baseStyle = {
    textAlign: "left",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: "12px 12px",
    border: "1px solid #e5e7eb",
    cursor: interactive ? "pointer" : "default",
    outline: "none",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 130,
    transition:
      "box-shadow 0.16s ease, transform 0.16s ease, border-left-color 0.16s ease",
    borderLeft: hovered ? `3px solid ${BRAND_BLUE}` : "3px solid transparent",
    opacity: muted ? 0.72 : 1,
  };

  if (interactive && hovered) {
    baseStyle.boxShadow = "0 8px 24px rgba(15,23,42,0.09)";
    baseStyle.transform = "translateY(-1px)";
  }

  const content = (
    <div
      style={baseStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>

      {children ? (
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginBottom: footer ? 6 : 0,
          }}
        >
          {children}
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginBottom: footer ? 6 : 0,
          }}
        >
          {description}
        </div>
      )}

      {footer && (
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            fontStyle: "italic",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: 0,
          border: "none",
          background: "transparent",
          width: "100%",
        }}
      >
        {content}
      </button>
    );
  }

  return content;
}

function LoginModal({ onClose, onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onLogin({ name: name.trim(), email: email.trim() || null });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 16,
          padding: "18px 18px 16px",
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 20px 45px rgba(15,23,42,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600 }}>Sign in to MyZ🌎NE</div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
          Save applications, feasibility runs, and parcel notes across sessions.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#374151" }}>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                marginTop: 4,
                width: "100%",
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ fontSize: 12, color: "#374151" }}>
            Email (optional)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 13,
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              marginTop: 8,
              border: "none",
              borderRadius: 999,
              padding: "8px 12px",
              backgroundColor: BRAND_BLUE,
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

function SmartCodeModal({ onClose, context }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // NEW: local profile (Royal Palm Beach RS, etc.)
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  // Load jurisdiction profile when parcel context is available
  useEffect(() => {
    const j = context?.parcel?.jurisdiction;
    const z = context?.parcel?.zoning;
    const f = context?.parcel?.flu;

    if (!j || !z) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const data = await getJurisdictionProfile(j, z, f);
        if (!cancelled) {
          setProfile(data);
        }
      } catch (err) {
        console.error("Jurisdiction profile error:", err);
        if (!cancelled) {
          setProfileError(
            err.message || "Unable to load local jurisdiction profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [context?.parcel?.jurisdiction, context?.parcel?.zoning, context?.parcel?.flu]);

  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setAnswer("");

    try {
      const data = await getSmartCodeAnswer(q, context);
      setAnswer(data.answer || "No answer was generated.");
    } catch (err) {
      console.error("Smart code error:", err);
      setError(
        err.message || "Unable to generate a smart code answer right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  const jurisdictionLabel =
    context?.parcel?.jurisdiction || context?.region || "Selected jurisdiction";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 18,
          padding: "18px 18px 14px",
          width: "100%",
          maxWidth: 520,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(15,23,42,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Smart code search</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              Context: {jurisdictionLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
          Ask zoning, future land use, or entitlement questions. MyZ🌎NE will use the
          selected parcel&apos;s zoning + FLU context, local profiles (where available),
          plus general planning knowledge.
        </p>

        <textarea
          placeholder="Example: What are the minimum lot size and setbacks for RS zoning in Royal Palm Beach, FL?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{
            flexShrink: 0,
            minHeight: 90,
            maxHeight: 140,
            resize: "vertical",
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            fontSize: 13,
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            marginBottom: 8,
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            style={{
              alignSelf: "flex-start",
              borderRadius: 999,
              border: "none",
              padding: "6px 12px",
              fontSize: 12,
              backgroundColor: BRAND_BLUE,
              color: "#ffffff",
              cursor: loading || !question.trim() ? "default" : "pointer",
              opacity: loading || !question.trim() ? 0.7 : 1,
            }}
          >
            {loading ? "Thinking…" : "Ask"}
          </button>

          <span
            style={{
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            Local profile + live answers powered by OpenAI &amp; MyZ🌎NE.
          </span>
        </div>

        <div
          style={{
            flex: 1,
            borderRadius: 10,
            border: "1px dashed #e5e7eb",
            padding: "10px 10px",
            fontSize: 12,
            color: "#374151",
            backgroundColor: "#f9fafb",
            overflowY: "auto",
          }}
        >
          {/* Local jurisdiction profile (Royal Palm Beach RS, etc.) */}
          {profileLoading && (
            <p
              style={{
                fontSize: 11,
                color: "#6b7280",
                marginBottom: 6,
              }}
            >
              Loading local zoning profile…
            </p>
          )}

          {profileError && (
            <div
              style={{
                color: "#b91c1c",
                fontSize: 11,
                marginBottom: 6,
              }}
            >
              {profileError}
            </div>
          )}

          {profile && !profileLoading && (
            <div
              style={{
                marginBottom: 10,
                padding: "8px 8px",
                borderRadius: 8,
                backgroundColor: "#eef2ff",
                border: "1px solid #e0e7ff",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#111827",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Local profile –{" "}
                {profile.jurisdiction || "Jurisdiction"} ·{" "}
                {profile.zoning || "Zoning"}
              </div>

              {profile.summary && (
                <p
                  style={{
                    fontSize: 12,
                    color: "#1f2937",
                    marginBottom: 4,
                  }}
                >
                  {profile.summary}
                </p>
              )}

              {Array.isArray(profile.typicalUses) &&
                profile.typicalUses.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 2,
                      }}
                    >
                      Typical uses
                    </div>
                    <ul
                      style={{
                        paddingLeft: 18,
                        margin: 0,
                        fontSize: 12,
                        color: "#374151",
                      }}
                    >
                      {profile.typicalUses.map((u, idx) => (
                        <li key={idx} style={{ marginBottom: 2 }}>
                          {u}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {profile.dimensionalSummary && (
                <p
                  style={{
                    fontSize: 11,
                    color: "#4b5563",
                    marginBottom: 4,
                  }}
                >
                  {profile.dimensionalSummary}
                </p>
              )}

              {profile.notes && (
                <p
                  style={{
                    fontSize: 11,
                    color: "#4b5563",
                    marginBottom: 4,
                  }}
                >
                  {profile.notes}
                </p>
              )}

              {profile.disclaimer && (
                <p
                  style={{
                    fontSize: 10,
                    color: "#6b7280",
                  }}
                >
                  {profile.disclaimer}
                </p>
              )}
            </div>
          )}

          {/* Existing Smart Code answer / helper text */}
          {error && (
            <div style={{ color: "#b91c1c", marginBottom: 6 }}>{error}</div>
          )}

          {!error && !answer && !loading && (
            <>
              <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 12 }}>
                How this works
              </div>
              <p style={{ marginBottom: 6 }}>
                Type a question about zoning, future land use, or development potential.
                The assistant will ground its answer in the selected parcel&apos;s
                context (jurisdiction, zoning code, FLU, and area), plus any available
                local profile and general planning practice.
              </p>
              <p style={{ color: "#9ca3af" }}>
                Always verify results against the adopted zoning code and contact the
                local jurisdiction for an official determination.
              </p>
            </>
          )}

          {loading && !answer && (
            <p style={{ color: "#6b7280" }}>
              Generating a zoning summary and entitlement overview…
            </p>
          )}

          {answer && !error && (
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                color: "#111827",
              }}
            >
              {answer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JurisdictionModal({ selectedRegion, onSelect, onClose }) {
  const [query, setQuery] = useState("");

  const filtered = FL_REGIONS.filter((r) =>
    r.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 18,
          padding: "18px 18px 16px",
          width: "100%",
          maxWidth: 720,
          maxHeight: "80vh",
          boxShadow: "0 24px 60px rgba(15,23,42,0.3)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Select jurisdiction</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              Florida counties &amp; municipalities. More regions coming soon.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <input
            type="text"
            placeholder="Filter by County or Municipality name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              outline: "none",
              backgroundColor: "#f9fafb",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "#6b7280",
              whiteSpace: "nowrap",
            }}
          >
            {filtered.length} shown
          </span>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            paddingTop: 4,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            {filtered.map((region) => {
              const isActive = region.value === selectedRegion;
              return (
                <button
                  key={region.value}
                  type="button"
                  onClick={() => {
                    onSelect(region.value);
                    onClose();
                  }}
                  style={{
                    borderRadius: 14,
                    border: isActive
                      ? `1px solid ${BRAND_LIGHT_BLUE}`
                      : "1px solid #e5e7eb",
                    padding: "8px 10px",
                    backgroundColor: isActive ? "#eff6ff" : "#ffffff",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {region.label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                    }}
                  >
                    {region.type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState("home");
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showSmartCodeModal, setShowSmartCodeModal] = useState(false);
  const [showJurisdictionModal, setShowJurisdictionModal] = useState(false);
  const [showFeasibilityModal, setShowFeasibilityModal] = useState(false);

  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [zoom] = useState(DEFAULT_ZOOM);

  const [boundaries, setBoundaries] = useState(null);
  const [parcelsGeoJSON, setParcelsGeoJSON] = useState(null);
  const [zoningGeoJSON, setZoningGeoJSON] = useState(null);
  const [layersLoading, setLayersLoading] = useState(true);
  const [layersError, setLayersError] = useState(null);

  const [selectedParcel, setSelectedParcel] = useState(null);
  const [bufferReport, setBufferReport] = useState(null);
  const [bufferRadiusFeet, setBufferRadiusFeet] = useState(300);
  const [bufferLoading, setBufferLoading] = useState(false);
  const [bufferError, setBufferError] = useState(null);

  const [parcelPanelOpen, setParcelPanelOpen] = useState(true);
  const [bufferPanelOpen, setBufferPanelOpen] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const [banner, setBanner] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("Palm Beach County, FL");

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

  const handleMapClick = async (lat, lng) => {
    setBanner(null);
    setBufferError(null);
    setBufferReport(null);

    try {
      const parcel = await getParcelByLatLng(lat, lng);
      setSelectedParcel(parcel);
      if (parcel && typeof parcel.lat === "number" && typeof parcel.lng === "number") {
        setMapCenter({ lat: parcel.lat, lng: parcel.lng });
      }
      setViewMode("map");
    } catch (err) {
      console.error("Parcel click error:", err);
      setBanner(err.message || "Unable to identify a parcel at that location.");
    }
  };

  const performSearch = async () => {
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
      setViewMode("map");
    } catch (err) {
      console.error("Search error:", err);
      setBanner(err.message || "Unable to find a parcel for that search.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    await performSearch();
  };

  const handleGenerateBuffer = async () => {
    if (
      !selectedParcel ||
      typeof selectedParcel.lat !== "number" ||
      typeof selectedParcel.lng !== "number"
    ) {
      setBufferError("Select a parcel first (click the map or search by PCN).");
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
      } else {
        setBufferReport(report);
      }
    } catch (err) {
      console.error("Buffer error:", err);
      setBufferError("Unable to generate buffer / notice-radius report.");
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

  const headerJurisdiction = selectedParcel?.jurisdiction
    ? `${selectedRegion} · ${selectedParcel.jurisdiction}`
    : `${selectedRegion} (Beta – Palm Beach data)`;

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null;

  const closeMenu = () => setMenuOpen(false);

  const renderMainMenu = () =>
    menuOpen && (
      <div
        style={{
          position: "absolute",
          top: "100%",
          right: 16,
          marginTop: 8,
          backgroundColor: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(15,23,42,0.25)",
          padding: "8px 10px",
          width: 220,
          zIndex: 40,
          fontSize: 13,
        }}
      >
        <div style={{ marginBottom: 6 }}>
          {user ? (
            <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 4 }}>
              Signed in as <strong>{user.name}</strong>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              You’re browsing as guest
            </div>
          )}
        </div>

        {!user ? (
          <button
            type="button"
            onClick={() => {
              closeMenu();
              setShowLogin(true);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              background: "transparent",
              padding: "6px 4px",
              cursor: "pointer",
              fontSize: 13,
              color: BRAND_BLUE,
            }}
          >
            • Sign in
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setUser(null);
              closeMenu();
            }}
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              background: "transparent",
              padding: "6px 4px",
              cursor: "pointer",
              fontSize: 13,
              color: "#b91c1c",
            }}
          >
            • Sign out
          </button>
        )}

        <div
          style={{
            borderTop: "1px solid #f3f4f6",
            margin: "6px 0",
          }}
        />

        <button
          type="button"
          onClick={() => {
            setViewMode("map");
            closeMenu();
          }}
          style={{
            width: "100%",
            textAlign: "left",
            border: "none",
            background: "transparent",
            padding: "6px 4px",
            cursor: "pointer",
            fontSize: 13,
            color: "#111827",
          }}
        >
          • Map &amp; parcel explorer
        </button>

        <button
          type="button"
          onClick={() => {
            closeMenu();
          }}
          style={{
            width: "100%",
            textAlign: "left",
            border: "none",
            background: "transparent",
            padding: "6px 4px",
            cursor: "pointer",
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          • Feasibility analysis (coming soon)
        </button>

        <button
          type="button"
          onClick={() => {
            closeMenu();
          }}
          style={{
            width: "100%",
            textAlign: "left",
            border: "none",
            background: "transparent",
            padding: "6px 4px",
            cursor: "pointer",
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          • Land use &amp; zoning comparison (coming soon)
        </button>

        <button
          type="button"
          onClick={() => {
            setShowSmartCodeModal(true);
            closeMenu();
          }}
          style={{
            width: "100%",
            textAlign: "left",
            border: "none",
            background: "transparent",
            padding: "6px 4px",
            cursor: "pointer",
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          • Smart code search
        </button>
      </div>
    );

  const renderHome = () => (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f7",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          gap: 12,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 1,
              letterSpacing: "-0.01em",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 18,
                color: BRAND_LIGHT_BLUE,
              }}
            >
              My
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 18,
                fontStyle: "italic",
                color: BRAND_LIGHT_BLUE,
              }}
            >
              Z
            </span>
            <span
              style={{
                fontSize: 18,
                transform: "translateY(1px)",
              }}
            >
              🌎
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 18,
                fontStyle: "italic",
                color: BRAND_LIGHT_BLUE,
              }}
            >
              NE
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            flex: 1,
            textAlign: "center",
          }}
        >
          {headerJurisdiction}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {user && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "#4b5563",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "999px",
                  backgroundColor: BRAND_BLUE,
                  color: "#f9fafb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {userInitials}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              padding: "4px 7px",
              backgroundColor: "#f9fafb",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 16,
                lineHeight: 1,
                color: "#4b5563",
              }}
            >
              ☰
            </span>
          </button>

          {renderMainMenu()}
        </div>
      </header>

      {banner && (
        <div
          style={{
            padding: "8px 16px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            fontSize: 13,
            borderBottom: "1px solid #fecaca",
          }}
        >
          {banner}
        </div>
      )}

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "24px 16px 32px",
          paddingTop: "14vh",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            width: "100%",
            textAlign: "center",
            marginBottom: 22,
          }}
        >
          <h1
            style={{
              fontSize: 24,
              fontWeight: 500,
              marginBottom: 6,
              color: "#111827",
              letterSpacing: "-0.01em",
            }}
          >
            Smart Land Use Development Planning and Management
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            Start with a parcel control number (PCN). Address, owner, and AI-assisted code
            search are being rolled out jurisdiction by jurisdiction.
          </p>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          style={{
            width: "100%",
            maxWidth: 720,
            backgroundColor: "#ffffff",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: "#9ca3af",
              paddingLeft: 8,
            }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by Parcel Control Number (e.g. 70434418010000090)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 14,
              padding: "6px 4px",
              background: "transparent",
            }}
          />
          <button
            type="submit"
            disabled={searchLoading}
            style={{
              borderRadius: 999,
              border: "none",
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: BRAND_BLUE,
              color: "#ffffff",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {searchLoading ? "Searching…" : "Search"}
          </button>
        </form>

        <div
          style={{
            width: "100%",
            maxWidth: 960,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
          }}
        >
          <TileCard
            interactive
            onClick={() => setViewMode("map")}
            title="Map & parcel explorer"
            icon="🗺️"
            description="Click a parcel to see zoning, FLU, jurisdiction, and buffers."
          />

          <TileCard
            interactive
            onClick={() => setShowSmartCodeModal(true)}
            title="Smart code search"
            icon="🤖"
            description="Ask about zoning standards and entitlements using AI."
            footer="Powered by MyZ🌎NE + OpenAI."
          />

          <TileCard
            title="Jurisdiction context"
            icon="🏛️"
            interactive
            onClick={() => setShowJurisdictionModal(true)}
            description=""
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Currently viewing</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#111827",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {selectedRegion}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "#3b82f6",
                }}
              >
                Tap to choose Florida County / Municipality
              </span>
            </div>
          </TileCard>

          <TileCard
            muted
            title="Applications workspace"
            icon="📂"
            description="Track rezonings, site plans, and special exceptions."
            footer="Coming soon."
          />

          <TileCard
            muted
            title="Noticing & mail merge"
            icon="✉️"
            description="Generate neighbor lists and export labels from buffers."
            footer="Coming soon."
          />
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 11,
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          Data sources: Palm Beach County GIS · This is a planning support tool, not an
          official zoning verification.
        </div>
      </main>
    </div>
  );

  const renderMapView = () => (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f7",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "relative",
        }}
      >
        <button
          onClick={() => setViewMode("home")}
          style={{
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            padding: "6px 10px",
            fontSize: 12,
            backgroundColor: "#f9fafb",
            cursor: "pointer",
            color: BRAND_BLUE,
          }}
        >
          ← Back to search
        </button>

        <div style={{ fontWeight: 600, fontSize: 14, color: BRAND_BLUE }}>
          Map &amp; parcel explorer
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            marginLeft: 12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {headerJurisdiction}
        </div>

        <form
          onSubmit={handleSearchSubmit}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#f9fafb",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            padding: "4px 8px",
            maxWidth: 280,
            flex: 1,
          }}
        >
          <input
            type="text"
            placeholder="PCN search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 12,
            }}
          />
          <button
            type="submit"
            disabled={searchLoading}
            style={{
              borderRadius: 999,
              border: "none",
              padding: "4px 10px",
              fontSize: 12,
              backgroundColor: BRAND_BLUE,
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            {searchLoading ? "…" : "Go"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            marginLeft: 8,
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            padding: "4px 7px",
            backgroundColor: "#f9fafb",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 16,
              lineHeight: 1,
              color: "#4b5563",
            }}
          >
            ☰
          </span>
        </button>

        {renderMainMenu()}
      </header>

      {banner && (
        <div
          style={{
            padding: "8px 16px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            fontSize: 13,
            borderBottom: "1px solid #fecaca",
          }}
        >
          {banner}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div style={{ flex: 1, minHeight: "50vh" }}>
          {layersLoading ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
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
                fontSize: 14,
                color: "#b91c1c",
              }}
            >
              {layersError}
            </div>
          ) : (
            <MapWrapper
              center={mapCenter}
              zoom={zoom}
              onMapClick={handleMapClick}
              boundaries={boundaries}
              parcels={parcelsGeoJSON}
              zoning={zoningGeoJSON}
              selectedParcel={selectedParcel}
              bufferReport={bufferReport}
            />
          )}
        </div>

        <aside
          style={{
            backgroundColor: "#ffffff",
            borderTop: "1px solid #e5e7eb",
            padding: "12px 16px 16px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr)",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 13 }}>
              <button
                type="button"
                onClick={() => setParcelPanelOpen((v) => !v)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  marginBottom: parcelPanelOpen ? 8 : 4,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Selected parcel
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    transform: parcelPanelOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  ❯
                </span>
              </button>

              {parcelPanelOpen && (
                <>
                  {selectedParcel ? (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(130px, 1fr))",
                          gap: 8,
                        }}
                      >
                        <InfoField label="Label" value={selectedParcel.address} />
                        <InfoField label="Parcel ID" value={selectedParcel.id} />
                        <InfoField label="Owner" value={selectedParcel.owner || "—"} />
                        <InfoField
                          label="Jurisdiction"
                          value={selectedParcel.jurisdiction}
                        />
                        <InfoField label="Zoning" value={selectedParcel.zoning} />
                        <InfoField
                          label="Future Land Use"
                          value={selectedParcel.flu || "TBD"}
                        />
                        <InfoField
                          label="Area (acres)"
                          value={
                            selectedParcel.areaAcres != null
                              ? selectedParcel.areaAcres.toFixed(3)
                              : "—"
                          }
                        />
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setShowSmartCodeModal(true)}
                          style={{
                            borderRadius: 999,
                            border: "1px solid #e5e7eb",
                            padding: "6px 10px",
                            fontSize: 12,
                            backgroundColor: "#f9fafb",
                            cursor: "pointer",
                          }}
                        >
                          Smart code search
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowFeasibilityModal(true)}
                          style={{
                            borderRadius: 999,
                            border: "1px solid #e5e7eb",
                            padding: "6px 10px",
                            fontSize: 12,
                            backgroundColor: "#f9fafb",
                            cursor: "pointer",
                          }}
                        >
                          Feasibility
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>
                      Click a parcel on the map or search by PCN to view zoning details.
                    </div>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                fontSize: 13,
                borderLeft: "1px solid #f3f4f6",
                paddingLeft: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setBufferPanelOpen((v) => !v)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  marginBottom: bufferPanelOpen ? 8 : 4,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Notice radius / buffer
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    transform: bufferPanelOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  ❯
                </span>
              </button>

              {bufferPanelOpen && (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <label
                      style={{
                        fontSize: 12,
                        color: "#4b5563",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      Radius (feet)
                      <input
                        type="number"
                        value={bufferRadiusFeet}
                        onChange={(e) =>
                          setBufferRadiusFeet(Number(e.target.value) || 0)
                        }
                        min={50}
                        max={5280}
                        style={{
                          width: 90,
                          padding: "4px 6px",
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                        }}
                      />
                    </label>
                    <button
                      onClick={handleGenerateBuffer}
                      disabled={bufferLoading}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "none",
                        fontSize: 12,
                        backgroundColor: BRAND_BLUE,
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      {bufferLoading ? "Generating…" : "Generate"}
                    </button>
                  </div>

                  {bufferError && (
                    <div
                      style={{
                        color: "#b91c1c",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      {bufferError}
                    </div>
                  )}

                  {bufferReport && !bufferError && (
                    <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>
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

                  {bufferReport &&
                    Array.isArray(bufferReport.parcels) &&
                    bufferReport.parcels.length > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          maxHeight: 140,
                          overflowY: "auto",
                          borderTop: "1px solid #f3f4f6",
                          paddingTop: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            textTransform: "uppercase",
                            color: "#9ca3af",
                            marginBottom: 4,
                          }}
                        >
                          Parcels ({bufferReport.parcels.length})
                        </div>
                        {bufferReport.parcels.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              fontSize: 12,
                              padding: "4px 0",
                              borderBottom: "1px dashed #f3f4f6",
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>{p.address}</div>
                            <div style={{ color: "#6b7280" }}>{p.id}</div>
                            <div style={{ color: "#9ca3af" }}>{p.jurisdiction}</div>
                          </div>
                        ))}
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );

  return (
    <>
      {viewMode === "home" ? renderHome() : renderMapView()}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={(u) => {
            setUser(u);
            setShowLogin(false);
          }}
        />
      )}
      {showSmartCodeModal && (
        <SmartCodeModal
          onClose={() => setShowSmartCodeModal(false)}
          context={{
            region: selectedRegion,
            parcel: selectedParcel,
          }}
        />
      )}
      {showJurisdictionModal && (
        <JurisdictionModal
          selectedRegion={selectedRegion}
          onSelect={(value) => setSelectedRegion(value)}
          onClose={() => setShowJurisdictionModal(false)}
        />
      )}
      <FeasibilityModal
        open={showFeasibilityModal}
        onClose={() => setShowFeasibilityModal(false)}
        parcel={selectedParcel}
      />
    </>
  );
}
