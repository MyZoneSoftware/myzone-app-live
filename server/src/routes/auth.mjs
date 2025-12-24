import express from 'express';
const router = express.Router();

const DEV_TOKEN = process.env.AUTH_DEV_TOKEN || "myzone-dev-token";

router.post("/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "Missing email or password" });
  return res.json({ token: DEV_TOKEN, user: { email } });
});

router.get("/me", (req, res) => {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== DEV_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ ok: true, user: { email: "user@myzone.dev" } });
});

function authRequired(req, res, next) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== DEV_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export default { router, authRequired };
