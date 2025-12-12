import District from "../models/District.js";

export const getDistricts = async (req, res) => {
  try {
    const { jurisdiction, q, limit = 100 } = req.query;

    const filter = {};
    if (jurisdiction) filter.jurisdiction = jurisdiction;

    if (q) {
      filter.$or = [
        { code: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { summary: { $regex: q, $options: "i" } },
        { tags: { $in: [new RegExp(q, "i")] } }
      ];
    }

    const districts = await District.find(filter)
      .sort({ jurisdiction: 1, code: 1 })
      .limit(Math.min(Number(limit), 500));

    res.json(districts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load districts" });
  }
};

export const getDistrictByCode = async (req, res) => {
  try {
    const { jurisdiction, code } = req.params;

    const district = await District.findOne({
      jurisdiction,
      code,
    });

    if (!district) return res.status(404).json({ error: "District not found" });

    res.json(district);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load district" });
  }
};

export const createDistrict = async (req, res) => {
  try {
    const created = await District.create(req.body);
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    // handle duplicate index cleanly
    if (e.code === 11000) {
      return res.status(409).json({ error: "District already exists for this jurisdiction/code" });
    }
    res.status(400).json({ error: "Invalid district payload", details: e.message });
  }
};
