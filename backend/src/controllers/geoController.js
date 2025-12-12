import Parcel from "../models/Parcel.js";

export const getParcels = async (req, res) => {
  try {
    const { jurisdiction, parcelId, q, limit = 50 } = req.query;

    const filter = {};
    if (jurisdiction) filter.jurisdiction = jurisdiction;
    if (parcelId) filter.parcelId = parcelId;

    if (q) {
      filter.$or = [
        { parcelId: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
        { districtCode: { $regex: q, $options: "i" } }
      ];
    }

    const parcels = await Parcel.find(filter)
      .sort({ updatedAt: -1 })
      .limit(Math.min(Number(limit), 500));

    res.json({ parcels });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load parcels" });
  }
};

export const createParcel = async (req, res) => {
  try {
    const created = await Parcel.create(req.body);
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    if (e.code === 11000) {
      return res.status(409).json({ error: "Parcel already exists for this jurisdiction/parcelId" });
    }
    res.status(400).json({ error: "Invalid parcel payload", details: e.message });
  }
};
