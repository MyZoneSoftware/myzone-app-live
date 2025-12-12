import express from "express";
import { listApplications, createApplication, getApplicationById } from "../controllers/applicationController.js";

const router = express.Router();

// GET /api/applications?jurisdiction=Royal%20Palm%20Beach&status=Submitted
router.get("/", listApplications);

// GET /api/applications/:id
router.get("/:id", getApplicationById);

// POST /api/applications
router.post("/", createApplication);

export default router;
