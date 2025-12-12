import express from "express";
import { getDistricts, getDistrictByCode, createDistrict } from "../controllers/districtController.js";

const router = express.Router();

// GET /api/districts?jurisdiction=Royal%20Palm%20Beach&q=RS
router.get("/", getDistricts);

// GET /api/districts/:jurisdiction/:code
router.get("/:jurisdiction/:code", getDistrictByCode);

// POST /api/districts
router.post("/", createDistrict);

export default router;
