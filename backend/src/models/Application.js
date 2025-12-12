import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema(
  {
    jurisdiction: { type: String, required: true, trim: true },
    applicationType: { type: String, required: true, trim: true }, // e.g., "Site Plan", "Variance"
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Draft", "Submitted", "In Review", "Revisions Required", "Approved", "Denied", "Withdrawn"],
      default: "Draft",
    },
    parcel: {
      parcelId: { type: String, default: "", trim: true },
      address: { type: String, default: "", trim: true },
      districtCode: { type: String, default: "", trim: true },
    },
    applicant: {
      name: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true },
      phone: { type: String, default: "", trim: true },
      company: { type: String, default: "", trim: true },
    },
    notes: { type: String, default: "" },
    files: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    timeline: [
      {
        label: { type: String, required: true },
        date: { type: Date, required: true },
        note: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

ApplicationSchema.index({ jurisdiction: 1, createdAt: -1 });

export default mongoose.model("Application", ApplicationSchema);
