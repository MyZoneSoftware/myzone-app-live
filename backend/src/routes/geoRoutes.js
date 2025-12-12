import express from "express";
import { getParcels, createParcel } from "../controllers/geoController.js";

const router = express.Router();

// GET /api/geo?jurisdiction=Royal%20Palm%20Beach&q=00-42
router.get("/", getParcels);

// POST /api/geo
router.post("/", createParcel);

export default router;
