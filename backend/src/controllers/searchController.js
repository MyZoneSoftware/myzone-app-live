import dotenv from "dotenv";
dotenv.config({ quiet: true });

import OpenAI from "openai";
import Parcel from "../models/Parcel.js";
import District from "../models/District.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const formatStandards = (standards = {}) => {
  const s = standards || {};
  const set = s.setbacks || {};
  const parts = [];

  if (s.minLotSizeSqFt != null) parts.push(`Min lot size: ${s.minLotSizeSqFt} sq ft`);
  if (s.minLotWidthFt != null) parts.push(`Min lot width: ${s.minLotWidthFt} ft`);
  if (s.maxDensityDuAc != null) parts.push(`Max density: ${s.maxDensityDuAc} du/ac`);
  if (s.maxHeightFt != null) parts.push(`Max height: ${s.maxHeightFt} ft`);
  if (set.frontFt != null) parts.push(`Front setback: ${set.frontFt} ft`);
  if (set.sideFt != null) parts.push(`Side setback: ${set.sideFt} ft`);
  if (set.rearFt != null) parts.push(`Rear setback: ${set.rearFt} ft`);
  if (s.lotCoveragePct != null) parts.push(`Lot coverage: ${s.lotCoveragePct}%`);
  if (s.far != null) parts.push(`FAR: ${s.far}`);
  if (s.parkingNotes) parts.push(`Parking notes: ${s.parkingNotes}`);

  return parts.length ? parts.join("; ") : "No standards on file.";
};

const buildGrounding = ({ jurisdiction, parcel, district }) => {
  const lines = [];

  if (jurisdiction) lines.push(`Jurisdiction: ${jurisdiction}`);

  if (parcel) {
    lines.push(
      `Parcel: ${parcel.parcelId}` +
        (parcel.address ? ` (${parcel.address})` : "") +
        (parcel.acres != null ? `, ${parcel.acres} acres` : "") +
        (parcel.districtCode ? `, Zoning district: ${parcel.districtCode}` : "")
    );
  }

  if (district) {
    lines.push(`District: ${district.code} — ${district.name}`);
    if (district.summary) lines.push(`District summary: ${district.summary}`);
    lines.push(`Standards: ${formatStandards(district.standards)}`);
    if (district.source?.ordinanceUrl) lines.push(`Source: ${district.source.ordinanceUrl}`);
  }

  return lines.length ? lines.join("\n") : "";
};

export const searchDistricts = async (req, res) => {
  const question = req.query.q;
  const jurisdiction = req.query.jurisdiction || "";
  const parcelId = req.query.parcelId || "";
  const districtCodeOverride = req.query.districtCode || "";

  if (!question) return res.status(400).json({ error: "Missing query parameter ?q=" });

  try {
    let parcel = null;
    let district = null;

    // 1) Fetch parcel if provided
    if (jurisdiction && parcelId) {
      parcel = await Parcel.findOne({ jurisdiction, parcelId });
    }

    // 2) Determine district code (override > parcel)
    const districtCode = (districtCodeOverride || parcel?.districtCode || "").trim();

    // 3) Fetch district if possible
    if (jurisdiction && districtCode) {
      district = await District.findOne({ jurisdiction, code: districtCode });
    }

    // 4) Build grounding block
    const grounding = buildGrounding({ jurisdiction, parcel, district });

    // 5) OpenAI call grounded in Mongo context
    const messages = [
      {
        role: "system",
        content:
          "You are a land use and zoning assistant. Use ONLY the provided Local Context when answering. " +
          "If the Local Context is missing information, say what is missing and provide general guidance without inventing specifics. " +
          "Keep answers practical and organized."
      }
    ];

    if (grounding) {
      messages.push({
        role: "system",
        content: `Local Context (authoritative for this answer):\n${grounding}`
      });
    } else {
      messages.push({
        role: "system",
        content:
          "Local Context is not available. Do not guess jurisdiction-specific numbers. Provide general zoning guidance and ask for missing details."
      });
    }

    messages.push({ role: "user", content: question });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });

    const aiInsight = completion.choices?.[0]?.message?.content ?? "";

    // Return both the context we used + the AI answer (for SmartCodeModal UI)
    res.json({
      query: question,
      context: {
        jurisdiction: jurisdiction || null,
        parcel: parcel
          ? {
              parcelId: parcel.parcelId,
              address: parcel.address,
              acres: parcel.acres,
              districtCode: parcel.districtCode
            }
          : null,
        district: district
          ? {
              code: district.code,
              name: district.name,
              summary: district.summary,
              standards: district.standards,
              source: district.source
            }
          : null,
        groundingText: grounding || null
      },
      aiInsight
    });
  } catch (err) {
    console.error("searchDistricts error:", err);
    res.status(500).json({ error: "Search AI failed", details: err.message });
  }
};
