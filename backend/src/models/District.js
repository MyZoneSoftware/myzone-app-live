import mongoose from "mongoose";

const DistrictSchema = new mongoose.Schema(
  {
    jurisdiction: { type: String, required: true, trim: true }, // e.g., "Royal Palm Beach"
    code: { type: String, required: true, trim: true },         // e.g., "RS", "RM", "CG"
    name: { type: String, required: true, trim: true },         // e.g., "Residential Single-Family"
    summary: { type: String, default: "" },                     // short overview
    standards: {
      minLotSizeSqFt: { type: Number, default: null },
      minLotWidthFt: { type: Number, default: null },
      maxDensityDuAc: { type: Number, default: null },
      maxHeightFt: { type: Number, default: null },
      setbacks: {
        frontFt: { type: Number, default: null },
        sideFt: { type: Number, default: null },
        rearFt: { type: Number, default: null },
      },
      lotCoveragePct: { type: Number, default: null },
      far: { type: Number, default: null },
      parkingNotes: { type: String, default: "" },
    },
    source: {
      ordinanceUrl: { type: String, default: "" },
      lastUpdated: { type: Date, default: null },
    },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

// Prevent duplicates per jurisdiction/code
DistrictSchema.index({ jurisdiction: 1, code: 1 }, { unique: true });

export default mongoose.model("District", DistrictSchema);
