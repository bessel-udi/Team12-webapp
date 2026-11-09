const express = require('express');
const cors = require('cors');
const { monitor, statsHandler } = require('./monitoring');
require('dotenv').config();

const { getInventory, ensureTables } = require('./inventoryService');
const materialsRoutes = require('./routes/materials');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

// ---------- Auth ----------
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
    const id = req.apiKey || req.ip;
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

// Origins allowed to call the inventory routes from a browser
const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGINS || 'http://localhost:5173'
)
  .split(',')
  .filter(Boolean);

// ---------- Public, read-only provider inventory ----------
const inventoryLimiter = rateLimit({
  windowMs: 60000,
  max: 30,
});

app.get(
  '/provider-inventory/:id',
  cors({ origin: FRONTEND_ORIGINS }),
  inventoryLimiter,
  async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        message: 'Invalid provider ID',
      });
    }

    try {
      // Partner stock minus what our fundis have taken (see inventoryService.js)
      res.json(await getInventory());
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      console.error(err);
      res.status(502).json({ message: 'Partner data unavailable' });
    }
  }
);

// ---------- Take / return materials (WRITES: API key required) ----------
const takeLimiter = rateLimit({
  windowMs: 60000,
  max: 20,
});

app.use(
  '/provider-inventory',
  cors({ origin: FRONTEND_ORIGINS }),
  requireApiKey,
  takeLimiter,
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

const workerRoutes = require('./routes/workers');
const bookingRoutes = require('./routes/bookings');

app.use('/workers', workerRoutes);
app.use('/bookings', bookingRoutes);

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
  // Create the materials tables if missing; the server still starts if the DB is briefly unavailable.
  ensureTables().catch((err) => {
    console.error('Could not create materials tables:', err.code || err.message);
  });

  app.listen(PORT, (err) => {
    if (err) {
      console.error('Could not start server:', err.code || err.message);
      process.exit(1);
    }
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
