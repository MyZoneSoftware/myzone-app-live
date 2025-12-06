// FeasibilityModal.jsx
// Modal to run preliminary feasibility for a selected parcel.
// Includes a simple "Print / Save as PDF" button that uses the browser's print dialog.

import React, { useState } from "react";
import { runPreliminaryFeasibility } from "../services/feasibilityService";

export default function FeasibilityModal({ open, onClose, parcel }) {
  const [useType, setUseType] = useState("single-family");
  const [customLotCoverage, setCustomLotCoverage] = useState("");
  const [customFAR, setCustomFAR] = useState("");
  const [customAvgUnitSize, setCustomAvgUnitSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  if (!open) return null;

  const zoningLabel =
    parcel?.zoning || parcel?.ZONING_DESC || parcel?.zoningDistrict || "—";
  const fluLabel =
    parcel?.flu || parcel?.fluCategory || parcel?.FLU || parcel?.FLU_DESC || "—";

  function handlePrint() {
    // Browser print dialog – user can choose "Save as PDF"
    window.print();
  }

  async function handleRunFeasibility(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    const assumptions = {};

    if (customLotCoverage) {
      const v = parseFloat(customLotCoverage);
      if (!isNaN(v) && v > 0 && v <= 1) assumptions.maxLotCoverage = v;
    }
    if (customFAR) {
      const v = parseFloat(customFAR);
      if (!isNaN(v) && v > 0) assumptions.maxFAR = v;
    }
    if (customAvgUnitSize) {
      const v = parseFloat(customAvgUnitSize);
      if (!isNaN(v) && v > 0) assumptions.avgUnitSize = v;
    }

    try {
      setLoading(true);
      const data = await runPreliminaryFeasibility({
        parcel,
        useType,
        assumptions,
      });
      setResult(data);
    } catch (err) {
      console.error("Feasibility error:", err);
      setError(err.message || "Error computing feasibility.");
    } finally {
      setLoading(false);
    }
  }

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
        zIndex: 9999, // ⬅️ make sure we sit ABOVE the Leaflet map panes
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
              Preliminary Feasibility
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                marginTop: 2,
                maxWidth: 420,
              }}
            >
              High-level, advisory estimate based on generalized assumptions. Always
              confirm with detailed site planning, zoning review, and engineering.
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

        {/* Parcel context */}
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
              {parcel?.jurisdiction || "—"}
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

        {/* Main layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.6fr)",
            gap: 12,
            alignItems: "stretch",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* LEFT: Inputs */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
              padding: 10,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
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
              Inputs &amp; Assumptions
            </div>

            <form
              onSubmit={handleRunFeasibility}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: 2,
                    display: "block",
                  }}
                >
                  Primary use type
                </label>
                <select
                  value={useType}
                  onChange={(e) => setUseType(e.target.value)}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    padding: "6px 8px",
                    fontSize: 12,
                    backgroundColor: "#ffffff",
                  }}
                >
                  <option value="single-family">Single-family residential</option>
                  <option value="multifamily">Multifamily residential</option>
                  <option value="commercial">Commercial / non-residential</option>
                </select>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                    marginBottom: 4,
                  }}
                >
                  Optional overrides (leave blank to use standard zoning defaults)
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: 6,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 2,
                        display: "block",
                      }}
                    >
                      Max lot coverage (0–1)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={customLotCoverage}
                      onChange={(e) => setCustomLotCoverage(e.target.value)}
                      placeholder="e.g. 0.35"
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        padding: "6px 8px",
                        fontSize: 12,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 2,
                        display: "block",
                      }}
                    >
                      Max FAR
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={customFAR}
                      onChange={(e) => setCustomFAR(e.target.value)}
                      placeholder="e.g. 0.5"
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        padding: "6px 8px",
                        fontSize: 12,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 2,
                        display: "block",
                      }}
                    >
                      Avg unit size (sq ft)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={customAvgUnitSize}
                      onChange={(e) => setCustomAvgUnitSize(e.target.value)}
                      placeholder="e.g. 2000"
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        padding: "6px 8px",
                        fontSize: 12,
                      }}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#b91c1c",
                    backgroundColor: "#fef2f2",
                    borderRadius: 8,
                    border: "1px solid #fecaca",
                    padding: "6px 8px",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !parcel}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "none",
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  cursor: loading || !parcel ? "default" : "pointer",
                  opacity: loading || !parcel ? 0.6 : 1,
                }}
              >
                {loading ? "Calculating…" : "Run feasibility"}
              </button>

              <div
                style={{
                  fontSize: 10,
                  color: "#6b7280",
                  marginTop: 2,
                }}
              >
                This tool does not account for access, stormwater, open space, utilities,
                or detailed engineering. Treat all results as a planning-level screen.
              </div>
            </form>
          </div>

          {/* RIGHT: Results */}
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
              Capacity Summary
            </div>

            {!result && !error && !loading && (
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                Run feasibility to see an estimated maximum yield based on parcel area,
                zoning, and your assumptions. Results are rounded and represent a
                capacity envelope, not a guaranteed approval.
              </div>
            )}

            {loading && (
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                Calculating capacity envelope for the selected parcel…
              </div>
            )}

            {result && result.ok && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginTop: 4,
                  overflowY: "auto",
                }}
              >
                {/* Key figures */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                  }}
                >
                  {typeof result.capacity?.maxUnits === "number" && (
                    <div
                      style={{
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#f9fafb",
                        padding: "8px 10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#111827",
                          marginBottom: 2,
                        }}
                      >
                        Estimated max units
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {result.capacity.maxUnits}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#6b7280",
                          marginTop: 2,
                        }}
                      >
                        Lower of minimum lot size–based yield vs. coverage-based yield.
                      </div>
                    </div>
                  )}

                  {typeof result.capacity?.maxBuildingAreaSqFt === "number" && (
                    <div
                      style={{
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#f9fafb",
                        padding: "8px 10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#111827",
                          marginBottom: 2,
                        }}
                      >
                        Max building area
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {Math.round(
                          result.capacity.maxBuildingAreaSqFt,
                        ).toLocaleString()}{" "}
                        sq ft
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#6b7280",
                          marginTop: 2,
                        }}
                      >
                        Based on lot coverage, FAR, and generalized building assumptions.
                      </div>
                    </div>
                  )}

                  {typeof result.capacity?.parkingSpacesRequired === "number" && (
                    <div
                      style={{
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#f9fafb",
                        padding: "8px 10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#111827",
                          marginBottom: 2,
                        }}
                      >
                        Estimated parking demand
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {result.capacity.parkingSpacesRequired.toLocaleString()} spaces
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#6b7280",
                          marginTop: 2,
                        }}
                      >
                        Generic parking ratios for {result.inputs.useType} use. Always
                        confirm with local code.
                      </div>
                    </div>
                  )}
                </div>

                {/* Constraints */}
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#111827",
                      marginBottom: 4,
                    }}
                  >
                    Key constraints
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 11,
                      color: "#4b5563",
                      lineHeight: 1.5,
                    }}
                  >
                    {result.constraints?.byMinLotSize && (
                      <li>
                        Minimum lot size allows up to{" "}
                        <strong>
                          {result.constraints.byMinLotSize.maxUnits} lots / units
                        </strong>{" "}
                        if only minimum lot size is applied.
                      </li>
                    )}
                    {result.constraints?.byCoverage && (
                      <li>
                        Coverage + average unit size supports approximately{" "}
                        <strong>
                          {result.constraints.byCoverage.maxUnits} units
                        </strong>{" "}
                        at the assumed unit size.
                      </li>
                    )}
                    {result.constraints?.byFAR && (
                      <li>
                        FAR limit yields a total building area of{" "}
                        <strong>
                          {Math.round(
                            result.constraints.byFAR.maxBuildingAreaSqFt,
                          ).toLocaleString()}{" "}
                          sq ft
                        </strong>{" "}
                        if fully utilized.
                      </li>
                    )}
                    {result.constraints?.byCoverageBuilding && (
                      <li>
                        Coverage-only envelope (ignoring FAR) yields about{" "}
                        <strong>
                          {Math.round(
                            result.constraints.byCoverageBuilding
                              .maxBuildingAreaSqFt,
                          ).toLocaleString()}{" "}
                          sq ft
                        </strong>{" "}
                        footprint area.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Notes */}
                {Array.isArray(result.notes) && result.notes.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#111827",
                        marginBottom: 4,
                      }}
                    >
                      Notes &amp; caveats
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 11,
                        color: "#6b7280",
                        lineHeight: 1.5,
                      }}
                    >
                      {result.notes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Light watermark / footer */}
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: "1px dashed #e5e7eb",
                    fontSize: 9,
                    color: "#9ca3af",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>
                    MyZ🌎NE – Planning support tool (beta). Not an official zoning or
                    development approval.
                  </span>
                  <span>© MyZone</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
