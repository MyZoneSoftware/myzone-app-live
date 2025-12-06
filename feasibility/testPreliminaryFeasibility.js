// Quick test harness for the preliminary feasibility engine.
// Run with: node feasibility/testPreliminaryFeasibility.js

const { computePreliminaryFeasibility } = require("./feasibilityEngine");

// Example: 1-acre (43,560 sq ft) single-family parcel in RS / Low Residential
const input = {
  parcelAreaSqFt: 43560,
  zoningDistrict: "RS",
  flu: "Low Residential",
  useType: "single-family",
  assumptions: {
    // You can override defaults here if desired, e.g.:
    // maxLotCoverage: 0.30,
    // avgUnitSize: 2100,
  },
};

const result = computePreliminaryFeasibility(input);

console.log("=== Preliminary Feasibility Result ===");
console.log(JSON.stringify(result, null, 2));
