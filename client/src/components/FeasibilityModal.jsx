import React from "react";

function FeasibilityModal({ isOpen, parcel, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: "480px",
          maxWidth: "90vw",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          boxShadow:
            "0 22px 45px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.05)",
          padding: "16px 18px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "4px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "15px", fontWeight: 600 }}>
              Feasibility Snapshot
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              Quick context for the currently selected parcel.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
              padding: "0 4px",
              color: "#6b7280",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Parcel info */}
        <div
          style={{
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            padding: "10px 12px",
            fontSize: "13px",
            backgroundColor: "#f9fafb",
          }}
        >
          {parcel ? (
            <>
              <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                Parcel {parcel.id || "—"}
              </div>
              <div style={{ color: "#4b5563" }}>
                {parcel.address || "No address on file"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "#6b7280" }}>
                {parcel.jurisdiction || "Unknown jurisdiction"} · Zoning:{" "}
                {parcel.zoning || "TBD"} · FLU: {parcel.flu || "TBD"}
              </div>
              {parcel.areaAcres != null && (
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  Area: {parcel.areaAcres.toFixed(3)} acres
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "#6b7280" }}>
              No parcel selected. Click a parcel on the map or search by PARID.
            </div>
          )}
        </div>

        {/* Placeholder feasibility bullets */}
        <div
          style={{
            fontSize: "13px",
            color: "#4b5563",
            lineHeight: 1.45,
          }}
        >
          <div style={{ marginBottom: "6px", fontWeight: 500 }}>Checks (coming soon):</div>
          <ul style={{ paddingLeft: "18px", margin: 0 }}>
            <li>Allowed uses based on zoning &amp; FLU</li>
            <li>Maximum units / floor area</li>
            <li>Height limits and setbacks</li>
            <li>Parking and open space requirements</li>
          </ul>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "4px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            fontSize: "12px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              color: "#111827",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            disabled
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: "none",
              backgroundColor: "#111827",
              color: "#ffffff",
              cursor: "not-allowed",
              opacity: 0.7,
            }}
          >
            Full feasibility (soon)
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeasibilityModal;
