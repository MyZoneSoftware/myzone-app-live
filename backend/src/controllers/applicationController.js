import Application from "../models/Application.js";

export const listApplications = async (req, res) => {
  try {
    const { jurisdiction, status, limit = 50 } = req.query;

    const filter = {};
    if (jurisdiction) filter.jurisdiction = jurisdiction;
    if (status) filter.status = status;

    const apps = await Application.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 500));

    res.json(apps);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load applications" });
  }
};

export const createApplication = async (req, res) => {
  try {
    const created = await Application.create(req.body);
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Invalid application payload", details: e.message });
  }
};

export const getApplicationById = async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found" });
    res.json(app);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Invalid application id" });
  }
};
