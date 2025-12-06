// Preliminary Land Use & Development Feasibility Engine (MVP)
//
// This module takes a parcel context and a few optional overrides,
// and returns a conservative, planner-style capacity summary.
// It does NOT talk to the database or Express — it's pure calculation logic.

function buildDefaults(input) {
  const zoning = (input.zoningDistrict || "").toUpperCase();
  const flu = (input.flu || "").toLowerCase();
  const useType = (input.useType || "residential").toLowerCase();

  // Generic baseline assumptions
  let defaults = {
    useType,
    maxLotCoverage: 0.35,   // 35% coverage
    maxFAR: 0.35,           // 0.35 FAR
    minLotSize: 10000,      // sq ft per lot (residential)
    avgUnitSize: 2000,      // sq ft per dwelling unit
    parkingRatioPerUnit: 2, // spaces per unit
    parkingRatioPerKsf: 3,  // spaces per 1,000 sq ft (non-residential)
  };

  // Low-density single-family feel (RS, Low Residential)
  if (
    useType === "single-family" ||
    zoning.startsWith("RS") ||
    flu.includes("low")
  ) {
    defaults = {
      ...defaults,
      useType: "single-family",
      maxLotCoverage: 0.35,
      maxFAR: 0.35,
      minLotSize: 10000,
      avgUnitSize: 2200,
      parkingRatioPerUnit: 2,
    };
  }

  // Medium / multifamily
  if (
    useType === "multifamily" ||
    zoning.startsWith("RM") ||
    flu.includes("medium")
  ) {
    defaults = {
      ...defaults,
      useType: "multifamily",
      maxLotCoverage: 0.5,
      maxFAR: 1.0,
      minLotSize: 2000,
      avgUnitSize: 1000,
      parkingRatioPerUnit: 1.5,
    };
  }

  // Commercial / non-residential
  if (
    useType === "commercial" ||
    zoning.startsWith("C") ||
    flu.includes("commercial")
  ) {
    defaults = {
      ...defaults,
      useType: "commercial",
      maxLotCoverage: 0.5,
      maxFAR: 0.5,
      minLotSize: null,
      avgUnitSize: null,
      parkingRatioPerUnit: null,
      parkingRatioPerKsf: 3.5,
    };
  }

  // Apply user overrides if provided
  return {
    ...defaults,
    ...(input.assumptions || {}),
  };
}

function safeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * computePreliminaryFeasibility
 *
 * @param {Object} input
 * @param {number} input.parcelAreaSqFt - REQUIRED site area in square feet.
 * @param {string} [input.zoningDistrict]
 * @param {string} [input.flu]
 * @param {string} [input.useType] - "single-family" | "multifamily" | "commercial" (etc).
 * @param {Object} [input.assumptions] - Optional overrides for coverage, FAR, etc.
 */
function computePreliminaryFeasibility(input) {
  const errors = [];

  const parcelAreaSqFt = safeNumber(input.parcelAreaSqFt);
  if (!parcelAreaSqFt) {
    errors.push("parcelAreaSqFt (site area) is required and must be a positive number.");
  }

  const zoningDistrict = input.zoningDistrict || null;
  const flu = input.flu || null;
  const useType = (input.useType || "residential").toLowerCase();

  const assumptions = buildDefaults({
    zoningDistrict,
    flu,
    useType,
    assumptions: input.assumptions,
  });

  if (errors.length) {
    return {
      ok: false,
      errors,
      inputs: {
        parcelAreaSqFt,
        zoningDistrict,
        flu,
        useType,
      },
    };
  }

  const notes = [];
  const constraints = {};

  const maxLotCoverage = safeNumber(assumptions.maxLotCoverage) || 0.35;
  const maxFAR = safeNumber(assumptions.maxFAR) || null;
  const minLotSize = safeNumber(assumptions.minLotSize);
  const avgUnitSize = safeNumber(assumptions.avgUnitSize);
  const parkingRatioPerUnit = safeNumber(assumptions.parkingRatioPerUnit);
  const parkingRatioPerKsf = safeNumber(assumptions.parkingRatioPerKsf);

  // -------- Residential capacity (units) --------
  let maxUnitsByCoverage = null;
  let maxUnitsByMinLot = null;
  let selectedMaxUnits = null;

  if (useType === "single-family" || useType === "multifamily" || useType === "residential") {
    if (avgUnitSize) {
      maxUnitsByCoverage = Math.floor((parcelAreaSqFt * maxLotCoverage) / avgUnitSize);
      if (maxUnitsByCoverage < 0) maxUnitsByCoverage = 0;
      constraints.byCoverage = {
        maxUnits: maxUnitsByCoverage,
        description: "Max units based on lot coverage and average unit size.",
      };
    }

    if (minLotSize) {
      maxUnitsByMinLot = Math.floor(parcelAreaSqFt / minLotSize);
      if (maxUnitsByMinLot < 0) maxUnitsByMinLot = 0;
      constraints.byMinLotSize = {
        maxUnits: maxUnitsByMinLot,
        description: "Max units based solely on minimum lot size.",
      };
    }

    const candidates = [maxUnitsByCoverage, maxUnitsByMinLot].filter(
      (n) => typeof n === "number" && n > 0
    );

    if (candidates.length) {
      selectedMaxUnits = Math.min(...candidates);
    } else {
      selectedMaxUnits = null;
    }
  }

  // -------- Building area capacity (sq ft) --------
  let maxBuildingAreaByFAR = null;
  let maxBuildingAreaByCoverage = null;

  if (maxFAR) {
    maxBuildingAreaByFAR = parcelAreaSqFt * maxFAR;
    constraints.byFAR = {
      maxBuildingAreaSqFt: maxBuildingAreaByFAR,
      description: "Max building area based on FAR.",
    };
  }

  maxBuildingAreaByCoverage = parcelAreaSqFt * maxLotCoverage;
  constraints.byCoverageBuilding = {
    maxBuildingAreaSqFt: maxBuildingAreaByCoverage,
    description: "Max building area based on lot coverage only.",
  };

  let selectedBuildingAreaSqFt = null;

  if (useType === "single-family" || useType === "multifamily" || useType === "residential") {
    // For residential, if we computed units, derive building area from units.
    if (selectedMaxUnits && avgUnitSize) {
      selectedBuildingAreaSqFt = selectedMaxUnits * avgUnitSize;
    } else if (maxBuildingAreaByFAR) {
      selectedBuildingAreaSqFt = maxBuildingAreaByFAR;
    } else {
      selectedBuildingAreaSqFt = maxBuildingAreaByCoverage;
    }
  } else {
    // Non-residential: pick the more conservative of FAR vs coverage
    const candidates = [maxBuildingAreaByFAR, maxBuildingAreaByCoverage].filter(
      (n) => typeof n === "number" && n > 0
    );
    selectedBuildingAreaSqFt = candidates.length
      ? Math.min(...candidates)
      : maxBuildingAreaByCoverage;
  }

  // -------- Parking demand (spaces) --------
  let parkingSpacesRequired = null;

  if (useType === "single-family" || useType === "multifamily" || useType === "residential") {
    if (selectedMaxUnits && parkingRatioPerUnit) {
      parkingSpacesRequired = Math.ceil(selectedMaxUnits * parkingRatioPerUnit);
    }
  } else {
    if (selectedBuildingAreaSqFt && parkingRatioPerKsf) {
      const ksf = selectedBuildingAreaSqFt / 1000;
      parkingSpacesRequired = Math.ceil(ksf * parkingRatioPerKsf);
    }
  }

  // -------- Notes / caveats --------
  notes.push(
    "Preliminary only — based on generalized assumptions, not a zoning verification."
  );
  if (useType === "single-family") {
    notes.push(
      "Assumes conventional single-family subdivision. Actual yield may be lower after roads, lakes, and easements."
    );
  }
  if (useType === "multifamily") {
    notes.push(
      "Assumes typical multifamily configuration; site planning, amenities, and access may further reduce yield."
    );
  }
  if (useType === "commercial") {
    notes.push(
      "Assumes typical commercial parking ratios; shared parking or mixed-use may allow adjustments."
    );
  }

  return {
    ok: true,
    inputs: {
      parcelAreaSqFt,
      zoningDistrict,
      flu,
      useType,
    },
    assumptions: {
      maxLotCoverage,
      maxFAR,
      minLotSize,
      avgUnitSize,
      parkingRatioPerUnit,
      parkingRatioPerKsf,
      raw: assumptions,
    },
    capacity: {
      maxUnits: selectedMaxUnits,
      maxBuildingAreaSqFt: selectedBuildingAreaSqFt,
      parkingSpacesRequired,
    },
    constraints,
    notes,
  };
}

module.exports = {
  computePreliminaryFeasibility,
};
