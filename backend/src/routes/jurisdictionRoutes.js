import express from "express";
import { getJurisdictionProfile } from "../controllers/jurisdictionController.js";

const router = express.Router();

// GET /api/jurisdictions/Royal%20Palm%20Beach/profile?code=RS
router.get("/:jurisdiction/profile", getJurisdictionProfile);

export default router;
