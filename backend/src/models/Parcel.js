import mongoose from "mongoose";

const ParcelSchema = new mongoose.Schema(
  {
    jurisdiction: { type: String, required: true, trim: true },
    parcelId: { type: String, required: true, trim: true }, // e.g., folio / parcel number
    address: { type: String, default: "", trim: true },
    districtCode: { type: String, default: "", trim: true }, // e.g., "RS"
    zoningLabel: { type: String, default: "", trim: true },  // friendly label
    acres: { type: Number, default: null },
    geometry: {
      // GeoJSON-ish (optional for now)
      type: { type: String, enum: ["Point", "Polygon", "MultiPolygon"], default: null },
      coordinates: { type: Array, default: null },
    },
    centroid: {
      lat: { type: Number, default: null },
      lon: { type: Number, default: null },
    },
    attributes: { type: Object, default: {} }, // anything from ArcGIS, county appraiser, etc.
  },
  { timestamps: true }
);

ParcelSchema.index({ jurisdiction: 1, parcelId: 1 }, { unique: true });

export default mongoose.model("Parcel", ParcelSchema);
