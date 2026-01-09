const express = require("express");
const cors = require("cors");
require("dotenv").config();

const geoRoutes = require("./routes/geo");
const searchRoutes = require("./routes/search");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/geo", geoRoutes);
app.use("/api/search", searchRoutes);

const PORT = Number(process.env.PORT || 5050);
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});