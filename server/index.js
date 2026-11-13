const express = require('express');
const cors = require('cors');
const { monitor, statsHandler } = require('./monitoring');
require('dotenv').config();

const { ensureTables } = require('./inventoryService');
const { requireStaff, ensureStaffTable } = require('./auth');
const materialsRoutes = require('./routes/materials');
const staffRoutes = require('./routes/staff');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

// ---------- API key auth (for partners and other programs) ----------
const VALID_KEYS = (process.env.API_KEYS || '').split(',').filter(Boolean);
console.log(`Loaded ${VALID_KEYS.length} API keys`);

function requireApiKey(req, res, next) {
  const key = req.get('X-API-Key');

  if (!key || !VALID_KEYS.includes(key)) {
    return res.status(401).json({ message: 'Missing or invalid API key' });
  }

  req.apiKey = key;
  next();
}

// ---------- Rate limiting ----------
function rateLimit({ windowMs, max }) {
  const hits = new Map();

  return (req, res, next) => {
    const id = req.user ? `user:${req.user.id}` : req.apiKey || req.ip;
    const now = Date.now();

    let entry = hits.get(id);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));

      return res.status(429).json({
        message: 'Too many requests',
        retryAfter,
      });
    }

    next();
  };
}

app.use(monitor); // FIRST, so rejected requests are logged too
app.use(express.json());

// Origins allowed to call the staff routes from a browser
const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGINS || 'http://localhost:5173'
)
  .split(',')
  .filter(Boolean);
const staffCors = cors({ origin: FRONTEND_ORIGINS });

// ---------- Staff area: sign-in, then role checks (admin / fundi) ----------
// Customers never see these. Only a signed-in admin or fundi gets stock data.
app.use('/staff/login', staffCors, rateLimit({ windowMs: 60000, max: 8 })); // slows password guessing
app.use('/staff', staffCors, rateLimit({ windowMs: 60000, max: 60 }), staffRoutes);

app.use(
  '/provider-inventory',
  staffCors,
  requireStaff(['admin', 'fundi']),
  rateLimit({ windowMs: 60000, max: 60 }),
  materialsRoutes
);

// ---------- Everything below requires an API key ----------
app.use(cors());
app.use(requireApiKey);

app.use(rateLimit({
  windowMs: 60000,
  max: 100,
}));

app.get('/stats', statsHandler);

// ---------- Root ----------
app.get('/', (req, res) => {
  res.send('QuickFundi API is running');
});

// ---------- Versioned API ----------
// Order matters: specific versions first, the catch-all '/' last.
const v1 = require('./v1');
const v2 = require('./v2');

app.use('/v2', v2);   // the new version
app.use('/v1', v1);   // the old version, still running
app.use('/', v1);     // old URLs with no version keep working

app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'Route not found',
  });
});

// ---------- Error handling ----------
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      code: 'INVALID_JSON',
      message: 'Request body is not valid JSON',
    });
  }

  console.error(err);

  res.status(500).json({
    code: 'SERVER_ERROR',
    message: 'Server error',
  });
});

if (require.main === module) {
  // Create the tables (and the first admin, if ADMIN_* is set). The server still starts if the DB is briefly down.
  ensureTables().catch((err) => console.error('Could not create materials tables:', err.code || err.message));
  ensureStaffTable().catch((err) => console.error('Could not create staff table:', err.code || err.message));

  app.listen(PORT, (err) => {
    if (err) {
      console.error('Could not start server:', err.code || err.message);
      process.exit(1);
    }
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
