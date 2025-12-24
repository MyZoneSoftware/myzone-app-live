import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Load routes
import municipalRoutes from "./routes/municipal-boundaries.mjs";
import parcelsRoutes from "./routes/parcels-geojson.mjs";
import zoningRoutes from "./routes/zoning-geojson.mjs";
import parcelByIDRoutes from "./routes/parcel-by-id.mjs";
import smartCodeRoutes from "./routes/smart-code.mjs";

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Routes
app.use("/api/municipal-boundaries", municipalRoutes);
app.use("/api/parcels-geojson", parcelsRoutes);
app.use("/api/zoning-geojson", zoningRoutes);
app.use("/api/parcel-by-id", parcelByIDRoutes);
app.use("/api/smart-code", smartCodeRoutes);

// Fallback
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
