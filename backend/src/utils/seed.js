import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import connectDB from "../config/db.js";
import District from "../models/District.js";
import Parcel from "../models/Parcel.js";

const seed = async () => {
  const ok = await connectDB();
  if (!ok || mongoose.connection.readyState !== 1) {
    console.error("❌ Seed aborted: MongoDB is not connected. Fix MONGO_URI credentials and try again.");
    process.exit(1);
  }

  // Idempotent seeds (upsert)
  const districts = [
    {
      jurisdiction: "Royal Palm Beach",
      code: "RS",
      name: "Residential Single-Family",
      summary: "Low-density residential district intended for detached single-family homes.",
      standards: {
        minLotSizeSqFt: 6000,
        setbacks: { frontFt: 25, sideFt: 7.5, rearFt: 20 }
      },
      tags: ["residential", "single-family"]
    },
    {
      jurisdiction: "Royal Palm Beach",
      code: "RM",
      name: "Residential Multi-Family",
      summary: "Medium-to-high density residential district intended for multi-family housing.",
      tags: ["residential", "multifamily"]
    }
  ];

  for (const d of districts) {
    await District.updateOne(
      { jurisdiction: d.jurisdiction, code: d.code },
      { $set: d },
      { upsert: true }
    );
  }

  const parcels = [
    {
      jurisdiction: "Royal Palm Beach",
      parcelId: "00-42-44-01-01-000-1010",
      address: "Sample Address 1",
      districtCode: "RS",
      acres: 0.25
    },
    {
      jurisdiction: "Royal Palm Beach",
      parcelId: "00-42-44-01-01-000-1020",
      address: "Sample Address 2",
      districtCode: "RM",
      acres: 0.50
    }
  ];

  for (const p of parcels) {
    await Parcel.updateOne(
      { jurisdiction: p.jurisdiction, parcelId: p.parcelId },
      { $set: p },
      { upsert: true }
    );
  }

  console.log("✅ Seed complete");
  process.exit(0);
};

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
