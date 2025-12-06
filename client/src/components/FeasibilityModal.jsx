// FeasibilityModal.jsx
// A standalone modal to run preliminary feasibility for a selected parcel.
// It does NOT wire itself into App.jsx yet — that will be a separate, safe step.

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
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-4 md:p-6 overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-start gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">
              Preliminary Feasibility
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              High-level, advisory estimate based on generalized assumptions. Always
              verify with detailed site planning, zoning, and engineering.
            </p>
          </div>
          <button
            onClick={onClose}
            className="border rounded-full px-3 py-1 text-xs hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        {/* Parcel context */}
        <div className="mb-4 text-xs text-gray-700 space-y-1">
          {parcel ? (
            <>
              <p>
                <span className="font-semibold">Jurisdiction:</span>{" "}
                {parcel.jurisdiction || "—"}
              </p>
              <p>
                <span className="font-semibold">Zoning District:</span>{" "}
                {zoningLabel}
              </p>
              <p>
                <span className="font-semibold">Future Land Use:</span>{" "}
                {fluLabel}
              </p>
            </>
          ) : (
            <p className="text-gray-500">
              No parcel selected. Select a parcel on the map first.
            </p>
          )}
        </div>

        {/* Form + Result layout */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* LEFT: Input form */}
          <div className="border rounded-md bg-gray-50 p-3 space-y-2 text-xs md:text-sm">
            <h3 className="font-semibold text-sm mb-1 border-b pb-1">
              Input &amp; Assumptions
            </h3>

            <form onSubmit={handleRunFeasibility} className="space-y-3">
              {/* Use type */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  Primary Use Type
                </label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={useType}
                  onChange={(e) => setUseType(e.target.value)}
                >
                  <option value="single-family">Single-Family Residential</option>
                  <option value="multifamily">Multifamily Residential</option>
                  <option value="commercial">Commercial / Non-Residential</option>
                </select>
              </div>

              {/* Optional assumptions */}
              <div className="space-y-2">
                <p className="text-[11px] text-gray-600">
                  Optional overrides (leave blank to use standard zoning defaults).
                </p>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Max Lot Coverage (0–1)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={customLotCoverage}
                    onChange={(e) => setCustomLotCoverage(e.target.value)}
                    placeholder="e.g., 0.35"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Max FAR (Floor Area Ratio)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={customFAR}
                    onChange={(e) => setCustomFAR(e.target.value)}
                    placeholder="e.g., 0.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Average Unit Size (sq ft)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={customAvgUnitSize}
                    onChange={(e) => setCustomAvgUnitSize(e.target.value)}
                    placeholder="e.g., 2000 (for single-family)"
                  />
                </div>
              </div>

              {error && (
                <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !parcel}
                className="border rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-100 disabled:opacity-60"
              >
                {loading ? "Calculating…" : "Run Feasibility"}
              </button>

              <p className="text-[10px] text-gray-500">
                This tool does not account for access, stormwater, open space, or
                detailed engineering. Treat results as an initial capacity envelope.
              </p>
            </form>
          </div>

          {/* RIGHT: Results */}
          <div className="border rounded-md bg-white p-3 text-xs md:text-sm">
            <h3 className="font-semibold text-sm mb-1 border-b pb-1">
              Capacity Summary
            </h3>

            {!result && !error && (
              <p className="text-[11px] text-gray-500 mt-2">
                Run feasibility to see an estimated maximum yield based on site area,
                zoning, and your assumptions.
              </p>
            )}

            {result && result.ok && (
              <div className="space-y-3 mt-2">
                {/* Core capacity numbers */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {typeof result.capacity?.maxUnits === "number" && (
                    <div className="border rounded-md p-2 bg-gray-50">
                      <p className="text-[11px] font-semibold mb-1">
                        Estimated Max Units
                      </p>
                      <p className="text-lg font-bold">
                        {result.capacity.maxUnits}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Lower of min lot size vs. coverage-based yield.
                      </p>
                    </div>
                  )}

                  {typeof result.capacity?.maxBuildingAreaSqFt === "number" && (
                    <div className="border rounded-md p-2 bg-gray-50">
                      <p className="text-[11px] font-semibold mb-1">
                        Estimated Max Building Area
                      </p>
                      <p className="text-lg font-bold">
                        {Math.round(result.capacity.maxBuildingAreaSqFt).toLocaleString()}{" "}
                        sq ft
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Based on coverage, FAR, and use assumptions.
                      </p>
                    </div>
                  )}

                  {typeof result.capacity?.parkingSpacesRequired === "number" && (
                    <div className="border rounded-md p-2 bg-gray-50 col-span-2">
                      <p className="text-[11px] font-semibold mb-1">
                        Estimated Parking Demand
                      </p>
                      <p className="text-lg font-bold">
                        {result.capacity.parkingSpacesRequired.toLocaleString()}{" "}
                        spaces
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Based on generic ratios for {result.inputs.useType} use.
                      </p>
                    </div>
                  )}
                </div>

                {/* Constraints explanation */}
                <div>
                  <p className="font-semibold text-xs mb-1">Key Constraints</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-gray-700">
                    {result.constraints?.byMinLotSize && (
                      <li>
                        Min lot size: up to{" "}
                        <strong>
                          {result.constraints.byMinLotSize.maxUnits} lots/units
                        </strong>{" "}
                        based solely on minimum lot size.
                      </li>
                    )}
                    {result.constraints?.byCoverage && (
                      <li>
                        Lot coverage: up to{" "}
                        <strong>
                          {result.constraints.byCoverage.maxUnits} units
                        </strong>{" "}
                        based on coverage and average unit size.
                      </li>
                    )}
                    {result.constraints?.byFAR && (
                      <li>
                        FAR limit: max building area of{" "}
                        <strong>
                          {Math.round(
                            result.constraints.byFAR.maxBuildingAreaSqFt
                          ).toLocaleString()}{" "}
                          sq ft
                        </strong>{" "}
                        based on FAR.
                      </li>
                    )}
                    {result.constraints?.byCoverageBuilding && (
                      <li>
                        Coverage-only envelope: approx{" "}
                        <strong>
                          {Math.round(
                            result.constraints.byCoverageBuilding
                              .maxBuildingAreaSqFt
                          ).toLocaleString()}{" "}
                          sq ft
                        </strong>{" "}
                        based on lot coverage alone.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Notes */}
                {Array.isArray(result.notes) && result.notes.length > 0 && (
                  <div>
                    <p className="font-semibold text-xs mb-1">Notes &amp; Caveats</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-gray-600">
                      {result.notes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
