import React from "react";

function ZoningReportPanel({ isOpen, parcel, onClose }) {
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
          width: "520px",
          maxWidth: "92vw",
          maxHeight: "90vh",
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
              Zoning &amp; Land Use Report
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              Snapshot of zoning and future land use for the selected parcel.
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

        {/* Parcel header */}
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
                {parcel.jurisdiction || "Unknown jurisdiction"}
              </div>
            </>
          ) : (
            <div style={{ color: "#6b7280" }}>
              No parcel selected. Click a parcel on the map or search by PARID.
            </div>
          )}
        </div>

        {/* Zoning details */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          <div style={{ fontSize: "13px", marginBottom: "8px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                textTransform: "uppercase",
                marginBottom: "3px",
              }}
            >
              Zoning District
            </div>
            <div>
              {parcel?.zoning || "TBD"}{" "}
              <span style={{ color: "#6b7280", fontSize: "12px" }}>
                (detailed district standards coming soon)
              </span>
            </div>
          </div>

          <div style={{ fontSize: "13px", marginBottom: "8px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                textTransform: "uppercase",
                marginBottom: "3px",
              }}
            >
              Future Land Use (FLU)
            </div>
            <div>{parcel?.flu || "TBD"}</div>
          </div>

          <div style={{ fontSize: "13px", marginBottom: "8px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                textTransform: "uppercase",
                marginBottom: "3px",
              }}
            >
              Notes
            </div>
            <div style={{ color: "#4b5563" }}>
              This section will summarize key development standards, including
              permitted uses, density / intensity limits, height, setbacks, and
              special overlays or conditions.
            </div>
          </div>

          <div style={{ fontSize: "13px", marginTop: "10px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                textTransform: "uppercase",
                marginBottom: "3px",
              }}
            >
              Export
            </div>
            <div style={{ color: "#4b5563" }}>
              In a future version, you’ll be able to export this zoning summary
              as a PDF or attach it directly to a development application.
            </div>
          </div>
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
            Export report (soon)
          </button>
        </div>
      </div>
    </div>
  );
}

export default ZoningReportPanel;
