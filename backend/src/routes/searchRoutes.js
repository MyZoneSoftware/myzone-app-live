import express from "express";
import { searchDistricts } from "../controllers/searchController.js";

const router = express.Router();

router.get("/", searchDistricts);

export default router;
