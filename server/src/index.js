require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

const { connect } = require('./db');

// Optional routers (present in your project)
let authRouter, authRequired;
try {
  ({ router: authRouter, authRequired } = require('./routes/auth'));
} catch {}
let aiRouter; try { aiRouter = require('./routes/ai'); } catch {}
let districtsRouter; try { districtsRouter = require('./routes/districts'); } catch {}
let regsRouter; try { regsRouter = require('./routes/regulations'); } catch {}
let searchRouter; try { searchRouter = require('./routes/search'); } catch {}
let geoRouter; try { geoRouter = require('./routes/geo'); } catch {}
let projectsRouter; try { projectsRouter = require('./routes/projects'); } catch {}

const app = express();
const PORT = process.env.PORT || 5050;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Core middleware
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'myzone-api', ts: new Date().toISOString() });
});

// Routes
if (authRouter) app.use('/api/auth', authRouter);
if (aiRouter) app.use('/api/ai', aiRouter);
if (districtsRouter) app.use('/api/districts', districtsRouter);
if (regsRouter) app.use('/api/regulations', regsRouter);
if (searchRouter) app.use('/api/search', searchRouter);
if (geoRouter) app.use('/api/geo', geoRouter);
if (projectsRouter && authRequired) app.use('/api/projects', authRequired, projectsRouter);

// 404 fallback for /api
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not Found' }));

// Start after DB (if MONGODB_URI provided)
(async () => {
  try {
    if (process.env.MONGODB_URI) {
      await connect(process.env.MONGODB_URI);
    } else {
      console.log('⚠️  No MONGODB_URI provided. Running without DB.');
    }
    app.listen(PORT, () => {
      console.log(`✅ MyZone API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();
