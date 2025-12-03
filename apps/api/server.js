import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import chatRoute from './src/routes/chat.js';

const app = express();
app.use(express.json());
app.use(morgan('dev'));

const allowed = process.env.ALLOWED_ORIGIN?.split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || !allowed) return cb(null, true);
    return cb(null, allowed.includes(origin));
  }
}));

app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/chat', chatRoute);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on :${port}`));
