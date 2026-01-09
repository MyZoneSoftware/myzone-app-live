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
import MapAutoFit from "./components/MapAutoFit";
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
      if (typeof onMapClick === "function") {
        const { lat, lng } = e.latlng;
        onMapClick(lat, lng);
      }
    },
  });

  useEffect(() => {
    if (center && typeof center.lat === "number" && typeof center.lng === "number") {
      // No animation to avoid interaction lockups
      try {
        map.setView([center.lat, center.lng], zoom, { animate: false });
        map.dragging?.enable();
        map.scrollWheelZoom?.enable();
        map.doubleClickZoom?.enable();
      } catch (_e) {}
    }
  }, [center, zoom, map]);

  useEffect(() => {
    const resize = () => {
      try {
        map.invalidateSize();
      } catch (_e) {}
    };
    resize();
    window.addEventListener("resize", resize);
    const t = setTimeout(resize, 300);
    return () => {
      window.removeEventListener("resize", resize);
      clearTimeout(t);
    };
  }, [map]);

  const boundaryStyle = { color: "#d4d4d8", weight: 1, fillOpacity: 0 };
  const parcelStyle = { color: "#9ca3af", weight: 0.4, fillOpacity: 0 };
  const zoningStyle = { color: "#0ea5e9", weight: 0.6, fillOpacity: 0.08 };

  const bufferCenter =
    bufferReport && bufferReport.center
      ? [bufferReport.center.lat, bufferReport.center.lng]
      : null;

  function countCoords(geom) {
    try {
      const c = geom?.coordinates;
      if (!c) return 0;
      let n = 0;
      const walk = (x) => {
        if (!Array.isArray(x)) return;
        if (x.length === 2 && typeof x[0] === "number" && typeof x[1] === "number") {
          n += 1;
          return;
        }
        for (const item of x) walk(item);
      };
      walk(c);
      return n;
    } catch {
      return 0;
    }
  }

  function geometryLooksLikeLatLng(geom) {
    try {
      const c = geom?.coordinates;
      if (!c) return false;

      let checked = 0;
      let ok = 0;

      const walk = (x) => {
        if (!Array.isArray(x) || checked >= 50) return;
        if (x.length === 2 && typeof x[0] === "number" && typeof x[1] === "number") {
          checked += 1;
          const [lon, lat] = x;
          if (lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) ok += 1;
          return;
        }
        for (const item of x) walk(item);
      };

      walk(c);
      return checked > 0 && (ok / checked) >= 0.9;
    } catch {
      return false;
    }
  }

  // fix Python "and" to JS
    const selectedFeatureCollection =
    selectedParcel &&
    selectedParcel.geometry &&
    geometryLooksLikeLatLng(selectedParcel.geometry) &&
    countCoords(selectedParcel.geometry) <= 4000
      ? {
          type: "FeatureCollection",
          features: [
            { type: "Feature", properties: {}, geometry: selectedParcel.geometry },
          ],
        }
      : null;

  // ✅ Critical: forward clicks from GeoJSON layers (Leaflet eats map clicks on vector layers)
  const forwardClick = (e) => {
    if (typeof onMapClick === "function") {
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);
    }
  };

  return (
    <>
      <MapAutoFit selectedParcel={selectedParcel} />

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {boundaries && (
        <GeoJSON data={boundaries} style={boundaryStyle} eventHandlers={{ click: forwardClick }} />
      )}

      {zoning && (
        <GeoJSON data={zoning} style={zoningStyle} eventHandlers={{ click: forwardClick }} />
      )}

      {parcels && (
        <GeoJSON data={parcels} style={parcelStyle} eventHandlers={{ click: forwardClick }} />
      )}

      {selectedFeatureCollection && (
        <GeoJSON
          data={selectedFeatureCollection}
          style={{ color: "#ef4444", weight: 2, fillOpacity: 0 }}
          eventHandlers={{ click: forwardClick }}
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
      scrollWheelZoom
    >
      <InteractiveMap
        center={props.center}
        zoom={props.zoom}
        boundaries={props.boundaries}
        parcels={props.parcels}
        zoning={props.zoning}
        selectedParcel={props.selectedParcel}
        bufferReport={props.bufferReport}
        onMapClick={props.onMapClick}
      />
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
        zIndex: 9999,
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

  // Local profile (Royal Palm Beach RS, etc.)
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

  const parcel = context?.parcel || null;
  const zoningLabel =
    parcel?.zoning || parcel?.ZONING_DESC || parcel?.zoningDistrict || "—";
  const fluLabel =
    parcel?.flu || parcel?.fluCategory || parcel?.FLU || parcel?.FLU_DESC || "—";

  if (!context) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 12,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 18,
          padding: "16px 16px 14px",
          width: "100%",
          maxWidth: 900,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(15,23,42,0.3)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 8,
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#111827",
                letterSpacing: "-0.01em",
              }}
            >
              Smart code search
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                marginTop: 2,
                maxWidth: 480,
              }}
            >
              Ask zoning, future land use, or entitlement questions. MyZ🌎NE will use the
              selected parcel&apos;s zoning + FLU context, local profiles (where available),
              plus general planning knowledge.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              padding: "5px 10px",
              fontSize: 11,
              backgroundColor: "#ffffff",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {/* Parcel context strip */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 11,
            color: "#4b5563",
            marginBottom: 10,
          }}
        >
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Parcel
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>
              {parcel?.address || "—"}
            </div>
          </div>
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Parcel ID
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>
              {parcel?.id || "—"}
            </div>
          </div>
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Jurisdiction
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>
              {jurisdictionLabel}
            </div>
          </div>
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Zoning
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>{zoningLabel}</div>
          </div>
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Future Land Use
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>{fluLabel}</div>
          </div>
        </div>

        {/* Main layout: left = local profile, right = Q&A */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.7fr)",
            gap: 12,
            alignItems: "stretch",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* LEFT: Local zoning profile */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
              padding: 10,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#111827",
                marginBottom: 2,
              }}
            >
              Local zoning profile
            </div>

            {profileLoading && (
              <p
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  marginBottom: 4,
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
                  marginBottom: 4,
                  backgroundColor: "#fef2f2",
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  padding: "6px 8px",
                }}
              >
                {profileError}
              </div>
            )}

            {profile && !profileLoading && (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#eff6ff",
                  padding: "8px 9px",
                  fontSize: 12,
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
                  {profile.jurisdiction || "Jurisdiction"} ·{" "}
                  {profile.zoning || "Zoning district"}
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
                          margin: 0,
                          paddingLeft: 18,
                          fontSize: 12,
                          color: "#374151",
                          lineHeight: 1.5,
                        }}
                      >
                        {profile.typicalUses.map((u, idx) => (
                          <li key={idx}>{u}</li>
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

            {!profile && !profileLoading && !profileError && (
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  lineHeight: 1.4,
                }}
              >
                Localized zoning profiles are being rolled out jurisdiction by
                jurisdiction. For now, answers will rely on the parcel&apos;s zoning,
                FLU, and general planning practice.
              </div>
            )}
          </div>

          {/* RIGHT: Ask Smart code */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              padding: 10,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#111827",
                marginBottom: 6,
              }}
            >
              Ask Smart code
            </div>

            {/* Question box + button */}
            <div
              style={{
                marginBottom: 8,
              }}
            >
              <textarea
                placeholder="Example: What are the minimum lot size and setbacks for RS zoning in this jurisdiction?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 80,
                  maxHeight: 140,
                  resize: "vertical",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  fontFamily:
                    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                  marginBottom: 6,
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={loading || !question.trim()}
                  style={{
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
            </div>

            {/* Answer / helper area */}
            <div
              style={{
                flex: 1,
                borderRadius: 10,
                border: "1px dashed #e5e7eb",
                padding: "8px 9px",
                fontSize: 12,
                color: "#374151",
                backgroundColor: "#f9fafb",
                overflowY: "auto",
              }}
            >
              {error && (
                <div
                  style={{
                    color: "#b91c1c",
                    marginBottom: 6,
                    fontSize: 11,
                  }}
                >
                  {error}
                </div>
              )}

              {!error && !answer && !loading && (
                <>
                  <div
                    style={{
                      marginBottom: 4,
                      fontWeight: 500,
                      fontSize: 12,
                    }}
                  >
                    How this works
                  </div>
                  <p
                    style={{
                      marginBottom: 6,
                      fontSize: 11,
                      lineHeight: 1.5,
                      textAlign: "justify",
                    }}
                  >
                    Type a question about zoning, future land use, or development
                    potential. The assistant will ground its answer in the selected
                    parcel&apos;s context (jurisdiction, zoning code, FLU, and area),
                    plus any available local profile and general planning practice.
                  </p>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 11,
                      color: "#6b7280",
                      marginBottom: 6,
                      lineHeight: 1.4,
                    }}
                  >
                    <li>Use plain language or code citations.</li>
                    <li>Ask about setbacks, lot size, density, or typical uses.</li>
                    <li>Run multiple questions for the same parcel.</li>
                  </ul>
                  <p
                    style={{
                      color: "#9ca3af",
                      fontSize: 10,
                      textAlign: "justify",
                    }}
                  >
                    Always verify results against the adopted zoning code and contact the
                    local jurisdiction for an official determination. This is a planning
                    support tool, not legal advice or a formal interpretation.
                  </p>
                </>
              )}

              {loading && !answer && (
                <p
                  style={{
                    color: "#6b7280",
                    fontSize: 11,
                  }}
                >
                  Generating a zoning summary and entitlement overview…
                </p>
              )}

              {answer && !error && (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 12,
                    color: "#111827",
                    textAlign: "justify",
                  }}
                >
                  {answer}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function NoticeReportModal({ onClose, selectedParcel, bufferReport }) {
  if (
    !bufferReport ||
    !Array.isArray(bufferReport.parcels) ||
    bufferReport.parcels.length === 0
  ) {
    return null;
  }

  const subject = selectedParcel || {};
  const neighbors = bufferReport.parcels;
  const radiusFeet = bufferReport.radiusFeet;
  const center = bufferReport.center;

  function handlePrint() {
    window.print();
  }

  const formatMailing = (p) => {
    const owner =
      p.owner || p.ownerName || p.OWNER || p.OWNER_NAME || "";
    const mail1 =
      p.mailAddress1 ||
      p.mailingAddress1 ||
      p.MAILADDR1 ||
      p.MAILADD1 ||
      "";
    const mail2 =
      p.mailAddress2 ||
      p.mailingAddress2 ||
      p.MAILADDR2 ||
      p.MAILADD2 ||
      "";
    const mailCity =
      p.mailCity || p.mailingCity || p.MAILCITY || "";
    const mailState =
      p.mailState || p.mailingState || p.MAILSTATE || "";
    const mailZip =
      p.mailZip || p.mailingZip || p.MAILZIP || p.ZIP || "";

    const line1 = mail1 || mail2 ? [mail1, mail2].filter(Boolean).join(" ") : "";
    const cityLine =
      mailCity || mailState || mailZip
        ? [mailCity, mailState, mailZip].filter(Boolean).join(", ")
        : "";

    return {
      owner,
      line1,
      cityLine,
    };
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 12,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 18,
          padding: "16px 16px 14px",
          width: "100%",
          maxWidth: 900,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(15,23,42,0.3)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 8,
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#111827",
                letterSpacing: "-0.01em",
              }}
            >
              Notice report (beta)
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                marginTop: 2,
                maxWidth: 480,
              }}
            >
              Neighbor list generated from the selected radius around the subject parcel.
              Use this as a starting point for public notice mailings; always verify with
              your adopted notice requirements.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={handlePrint}
              style={{
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                padding: "5px 10px",
                fontSize: 11,
                backgroundColor: "#f9fafb",
                cursor: "pointer",
              }}
            >
              Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              style={{
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                padding: "5px 10px",
                fontSize: 11,
                backgroundColor: "#ffffff",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Subject parcel + buffer summary */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 11,
            color: "#4b5563",
            marginBottom: 10,
          }}
        >
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Subject Parcel
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>
              {subject.address || "—"}
            </div>
          </div>
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Subject PCN
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>
              {subject.id || "—"}
            </div>
          </div>
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Jurisdiction
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>
              {subject.jurisdiction || "—"}
            </div>
          </div>
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Radius
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>
              {radiusFeet} ft
            </div>
          </div>
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Center
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>
              {center
                ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
                : "—"}
            </div>
          </div>
          <div>
            <span style={{ textTransform: "uppercase", color: "#9ca3af" }}>
              Parcels in buffer
            </span>
            <div style={{ fontSize: 12, color: "#111827" }}>
              {neighbors.length}
            </div>
          </div>
        </div>

        {/* Neighbor list table */}
        <div
          style={{
            flex: 1,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            padding: 10,
            fontSize: 12,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#111827",
              marginBottom: 6,
            }}
          >
            Neighbor parcels
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 11,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "4px 4px",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  Owner
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "4px 4px",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  Mailing address
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "4px 4px",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  Parcel ID
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "4px 4px",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  Site address
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "4px 4px",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  Jurisdiction
                </th>
              </tr>
            </thead>
            <tbody>
              {neighbors.map((p) => {
                const mail = formatMailing(p);
                return (
                  <tr key={p.id || p.address}>
                    <td
                      style={{
                        padding: "4px 4px",
                        borderBottom: "1px solid #f3f4f6",
                        verticalAlign: "top",
                      }}
                    >
                      {mail.owner || "—"}
                    </td>
                    <td
                      style={{
                        padding: "4px 4px",
                        borderBottom: "1px solid #f3f4f6",
                        verticalAlign: "top",
                      }}
                    >
                      <div>{mail.line1 || "—"}</div>
                      {mail.cityLine && (
                        <div
                          style={{
                            color: "#6b7280",
                          }}
                        >
                          {mail.cityLine}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "4px 4px",
                        borderBottom: "1px solid #f3f4f6",
                        verticalAlign: "top",
                      }}
                    >
                      {p.id || "—"}
                    </td>
                    <td
                      style={{
                        padding: "4px 4px",
                        borderBottom: "1px solid #f3f4f6",
                        verticalAlign: "top",
                      }}
                    >
                      {p.address || "—"}
                    </td>
                    <td
                      style={{
                        padding: "4px 4px",
                        borderBottom: "1px solid #f3f4f6",
                        verticalAlign: "top",
                      }}
                    >
                      {p.jurisdiction || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            style={{
              marginTop: 6,
              paddingTop: 6,
              borderTop: "1px dashed #e5e7eb",
              fontSize: 9,
              color: "#9ca3af",
            }}
          >
            This list is generated for planning support and public notice preparation.
            Always verify parcel ownership, mailing addresses, and noticing radius
            requirements with the applicable jurisdiction before sending notices.
          </div>
        </div>

        {/* Footer / watermark */}
        <div
          style={{
            marginTop: 6,
            paddingTop: 4,
            borderTop: "1px solid #f3f4f6",
            fontSize: 9,
            color: "#9ca3af",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>MyZ🌎NE – Notice mailers support (beta).</span>
          <span>© MyZone</span>
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
        zIndex: 9999,
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
  const [showNoticeReport, setShowNoticeReport] = useState(false);
  const [showFeasibilityModal, setShowFeasibilityModal] = useState(false);

  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [zoom] = useState(DEFAULT_ZOOM);

  const [boundaries, setBoundaries] = useState(null);
  const [parcelsGeoJSON, setParcelsGeoJSON] = useState(null);
  const [zoningGeoJSON, setZoningGeoJSON] = useState(null);
  const [layersLoading, setLayersLoading] = useState(true);
  const [layersError, setLayersError] = useState(null);

  const [selectedParcel, setSelectedParcel] = useState(null);
// 🔑 Canonical parcel selector (GeoJSON + ArcGIS → UI-safe shape)
function selectParcel(input) {
  if (!input) return;

  // If backend returns { feature: { type:"Feature", properties:{...}, geometry:{...} } }
  if (input.feature) input = input.feature;

  // Case 1: GeoJSON Feature
  if (input.type === "Feature") {
    const props = input.properties || {};
    const geom = input.geometry || null;

    const parcel = {
      ...props,
      id: props.id || props.PCN || props.PARID || props.PARCEL_ID || props.PARCEL_NUMBER || null,
      address: props.address || props.SITE_ADDR || props.SITE_ADDRESS || "",
      owner: props.owner || props.OWNER || props.OWNER_NAME || "",
      jurisdiction: props.jurisdiction || props.JURISDICTION || "",
      zoning: props.zoning || props.ZONING || props.ZONING_DESC || "",
      flu: props.flu || props.FLU || props.FLU_DESC || "",
      areaAcres: props.areaAcres ?? props.AREA_ACRES ?? props.GIS_ACRES ?? null,
      lat: typeof props.lat === "number" ? props.lat : null,
      lng: typeof props.lng === "number" ? props.lng : null,
      geometry: geom,
      raw: input,
    };

    setSelectedParcel(parcel);

    if (parcel.lat != null && parcel.lng != null) {
      setMapCenter({ lat: parcel.lat, lng: parcel.lng });
    }

    setViewMode("map");
    return;
  }

  // Case 2: already normalized parcel object
  if (input.id) {
    setSelectedParcel(input);
    if (typeof input.lat === "number" && typeof input.lng === "number") {
      setMapCenter({ lat: input.lat, lng: input.lng });
    }
    setViewMode("map");
    return;
  }

  // Case 3: ArcGIS feature shape (attributes/geometry)
  const attrs = input.attributes || {};
  const geom = input.geometry || {};

  const ring =
    geom?.rings?.[0]?.[0] ||
    geom?.coordinates?.[0]?.[0] ||
    null;

  const lat = ring ? ring[1] : null;
  const lng = ring ? ring[0] : null;

  const parcel = {
    id: attrs.PARID || attrs.PARCEL_ID || attrs.PARCEL_NUMBER || attrs.id || null,
    address: attrs.SITE_ADDR || attrs.ADDRESS || "",
    owner: attrs.OWNER || attrs.OWNER_NAME || "",
    jurisdiction: attrs.JURISDICTION || attrs.CTY || "",
    zoning: attrs.ZONING || attrs.ZONING_DESC || "",
    flu: attrs.FLU || attrs.FLU_DESC || "",
    lat,
    lng,
    geometry: geom,
    raw: input,
  };

  setSelectedParcel(parcel);
  if (lat != null && lng != null) setMapCenter({ lat, lng });
  setViewMode("map");
}

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

  /*
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
      console.warn("Base layers failed to load — continuing without them.");
      setLayersError(null);
    } finally {
      setLayersLoading(false);
    }
  }

  loadLayers();
}, []);
*/
// ✅ Heavy auto-load disabled for stability
useEffect(() => {
  setLayersLoading(false);
  setLayersError(null);
}, []);

  const handleMapClick = async (lat, lng) => {
    setBanner(null);
    setBufferError(null);
    setBufferReport(null);

    try {
      const parcel = await getParcelByLatLng(lat, lng);
      selectParcel(parcel);
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
const normalized = trimmed.replace(/[^0-9]/g, ""); // remove dashes/spaces
    if (!trimmed) return;

    setBanner(null);
    setSearchLoading(true);
    setBufferReport(null);
    setBufferError(null);

    try {
      const parcel = await getParcelBySearch(normalized, [mapCenter.lat, mapCenter.lng]);

      if (parcel && typeof parcel.lat === "number" && typeof parcel.lng === "number") {
        setMapCenter({ lat: parcel.lat, lng: parcel.lng });
      }
      selectParcel(parcel);
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

  const handleExportBufferCsv = () => {
    if (
      !bufferReport ||
      !Array.isArray(bufferReport.parcels) ||
      bufferReport.parcels.length === 0
    ) {
      return;
    }

    const rows = [];

    // Header for subject parcel
    rows.push([
      "Subject Parcel ID",
      "Subject Address",
      "Radius (feet)",
      "Center Lat",
      "Center Lng",
    ]);

    rows.push([
      selectedParcel?.id || "",
      selectedParcel?.address || "",
      bufferReport.radiusFeet ?? "",
      bufferReport.center?.lat ?? "",
      bufferReport.center?.lng ?? "",
    ]);

    rows.push([]);
    rows.push([
      "Neighbor Parcel ID",
      "Neighbor Address",
      "Owner",
      "Mailing Address 1",
      "Mailing Address 2",
      "Mailing City",
      "Mailing State",
      "Mailing ZIP",
      "Jurisdiction",
    ]);

    bufferReport.parcels.forEach((p) => {
      const owner =
        p.owner || p.ownerName || p.OWNER || p.OWNER_NAME || "";
      const mail1 =
        p.mailAddress1 ||
        p.mailingAddress1 ||
        p.MAILADDR1 ||
        p.MAILADD1 ||
        "";
      const mail2 =
        p.mailAddress2 ||
        p.mailingAddress2 ||
        p.MAILADDR2 ||
        p.MAILADD2 ||
        "";
      const mailCity =
        p.mailCity || p.mailingCity || p.MAILCITY || "";
      const mailState =
        p.mailState || p.mailingState || p.MAILSTATE || "";
      const mailZip =
        p.mailZip || p.mailingZip || p.MAILZIP || p.ZIP || "";

      rows.push([
        p.id || "",
        p.address || "",
        owner,
        mail1,
        mail2,
        mailCity,
        mailState,
        mailZip,
        p.jurisdiction || "",
      ]);
    });

    const csvContent = rows
      .map((row) =>
        row
          .map((value) => {
            const v = value == null ? "" : String(value);
            if (v.includes('"') || v.includes(",") || v.includes("\n")) {
              return `"${v.replace(/"/g, '""')}"`;
            }
            return v;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const pcnSafe = (selectedParcel?.id || "subject-parcel").replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );
    link.download = `myzone_notice_recipients_${pcnSafe}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
                        <InfoField label="Address" value={selectedParcel.address || "—"} />
                        <InfoField label="Parcel ID" value={selectedParcel.id || selectedParcel.parcel_id || "—"} />
                        <InfoField label="Owner" value={selectedParcel.owner || selectedParcel.ownerName || selectedParcel.OWNER || "—"} />
                        <InfoField
                          label="Jurisdiction"
                          value={selectedParcel.jurisdiction || selectedParcel.JURISDICTION || "—"}
                        />
                        <InfoField label="Zoning" value={selectedParcel.zoning || selectedParcel.ZONING_DESC || selectedParcel.ZONING || "—"} />
                        <InfoField
                          label="Future Land Use"
                          value={selectedParcel.flu || selectedParcel.FLU_DESC || selectedParcel.FLU || "TBD"}
                        />
                        <InfoField
                          label="Area (acres)"
                          value={
                            (() => {
                              const n = Number(selectedParcel.areaAcres);
                              return Number.isFinite(n) ? n.toFixed(3) : "—";
                            })()
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
                    <button
                      type="button"
                      onClick={handleExportBufferCsv}
                      disabled={
                        bufferLoading ||
                        !bufferReport ||
                        !Array.isArray(bufferReport.parcels) ||
                        bufferReport.parcels.length === 0
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        fontSize: 12,
                        backgroundColor: "#ffffff",
                        color: "#374151",
                        cursor:
                          bufferLoading ||
                          !bufferReport ||
                          !Array.isArray(bufferReport.parcels) ||
                          bufferReport.parcels.length === 0
                            ? "default"
                            : "pointer",
                        opacity:
                          bufferLoading ||
                          !bufferReport ||
                          !Array.isArray(bufferReport.parcels) ||
                          bufferReport.parcels.length === 0
                            ? 0.5
                            : 1,
                      }}
                    >
                      Export CSV (beta)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNoticeReport(true)}
                      disabled={
                        bufferLoading ||
                        !bufferReport ||
                        !Array.isArray(bufferReport.parcels) ||
                        bufferReport.parcels.length === 0
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        fontSize: 12,
                        backgroundColor: "#ffffff",
                        color: "#111827",
                        cursor:
                          bufferLoading ||
                          !bufferReport ||
                          !Array.isArray(bufferReport.parcels) ||
                          bufferReport.parcels.length === 0
                            ? "default"
                            : "pointer",
                        opacity:
                          bufferLoading ||
                          !bufferReport ||
                          !Array.isArray(bufferReport.parcels) ||
                          bufferReport.parcels.length === 0
                            ? 0.5
                            : 1,
                      }}
                    >
                      Notice report (PDF)
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

      {showNoticeReport &&
        bufferReport &&
        Array.isArray(bufferReport.parcels) &&
        bufferReport.parcels.length > 0 && (
          <NoticeReportModal
            onClose={() => setShowNoticeReport(false)}
            selectedParcel={selectedParcel}
            bufferReport={bufferReport}
          />
        )}
    </>
  );
}

