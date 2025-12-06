// Frontend service to call the Feasibility API (port 5100)
//
// Usage (example):
//   import { runPreliminaryFeasibility } from "../services/feasibilityService";
//   const result = await runPreliminaryFeasibility({ parcel, useType: "single-family" });

const FEASIBILITY_API_BASE =
  import.meta.env.VITE_FEASIBILITY_API_BASE || "http://localhost:5100";

function getParcelAreaSqFt(parcel) {
  if (!parcel) return null;

  // 1) Direct square-foot field, if you add this later
  if (typeof parcel.areaSqFt === "number") return parcel.areaSqFt;

  // 2) Acres field used in your App.jsx (areaAcres * 43,560)
  if (typeof parcel.areaAcres === "number") {
    return parcel.areaAcres * 43560;
  }

  // 3) Common GIS area fields (sq ft)
  if (typeof parcel.AREA === "number") return parcel.AREA;
  if (typeof parcel.AREA_1 === "number") return parcel.AREA_1;

  // 4) Acres field in GIS (ACRES * 43,560)
  if (typeof parcel.ACRES === "number") {
    return parcel.ACRES * 43560;
  }

  return null;
}

export async function runPreliminaryFeasibility({
  parcel,
  useType = "single-family",
  assumptions = {},
}) {
  if (!parcel) {
    throw new Error("No parcel provided for feasibility.");
  }

  const parcelAreaSqFt = getParcelAreaSqFt(parcel);
  if (!parcelAreaSqFt) {
    throw new Error("Unable to determine parcel area (sq ft).");
  }

  const payload = {
    parcelAreaSqFt,
    zoningDistrict: parcel.zoning || parcel.ZONING_DESC || parcel.zoningDistrict || "",
    flu:
      parcel.flu ||
      parcel.fluCategory ||
      parcel.FLU ||
      parcel.FLU_DESC ||
      "",
    useType,
    assumptions,
  };

  const res = await fetch(`${FEASIBILITY_API_BASE}/api/feasibility/preliminary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message =
      errorBody?.errors?.join("; ") ||
      errorBody?.error ||
      `Feasibility API error (${res.status})`;
    throw new Error(message);
  }

  const data = await res.json();
  return data;
}
