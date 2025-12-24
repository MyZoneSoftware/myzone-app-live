const http = require("http");

// Attempt to require the existing Express app
let app;
try {
  app = require("./src/index.js");
} catch (err) {
  console.error("❌ Failed to require backend app module:", err);
  process.exit(1);
}

const PORT = process.env.PORT || 5003;
http.createServer(app).listen(PORT, () => {
  console.log("✅ Backend API running (CommonJS) at http://localhost:" + PORT);
});
