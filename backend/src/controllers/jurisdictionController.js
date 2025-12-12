import District from "../models/District.js";

/**
 * GET /api/jurisdictions/:jurisdiction/profile
 * Returns a lightweight profile for the jurisdiction + optional district code.
 *
 * Optional query params:
 *   - code: district code (e.g., RS, RM)
 */
export const getJurisdictionProfile = async (req, res) => {
  try {
    const { jurisdiction } = req.params;
    const { code } = req.query;

    const filter = { jurisdiction };
    if (code) filter.code = code;

    const districts = await District.find(filter).sort({ code: 1 });

    const profile = {
      jurisdiction,
      districtCount: districts.length,
      districts: districts.map((d) => ({
        code: d.code,
        name: d.name,
        summary: d.summary,
        standards: d.standards,
        source: d.source,
        tags: d.tags
      }))
    };

    res.json(profile);
  } catch (e) {
    console.error("getJurisdictionProfile error:", e);
    res.status(500).json({ error: "Failed to load jurisdiction profile", details: e.message });
  }
};
