const http = require('http');
const net = require('net');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- your existing routes can stay; here's a harmless health check ---
app.get('/health', (req, res) => res.json({ ok: true }));

const FIRST_CHOICE = Number(process.env.PORT || 5050);

function checkPort(port) {
  return new Promise((resolve) => {
    const tester = net.connect({ port, host: '127.0.0.1' }, () => {
      tester.end();
      resolve(false); // in use
    });
    tester.on('error', () => resolve(true)); // free
  });
}

async function findOpenPort(start) {
  let port = start;
  for (let i = 0; i < 20; i++) {
    if (await checkPort(port)) return port;
    console.log(`Port ${port} in use, trying ${port + 1}...`);
    port++;
  }
  throw new Error('No available port found.');
}

(async () => {
  try {
    const port = await findOpenPort(FIRST_CHOICE);
    const server = http.createServer(app);
    server.listen(port, '0.0.0.0', () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

// ----- Static frontend (production only) -----
import installStaticFrontend from "./static-frontend.js";
if (process.env.NODE_ENV === "production") {
  installStaticFrontend(app);
}
