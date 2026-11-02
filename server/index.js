
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { fetchWithRetry } = require('./resilientFetch');

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

app.use(express.json());

// ---------- Partner configuration ----------
const PARTNER_URL = process.env.PARTNER_URL;
const lastGood = new Map();

// Origins allowed to call the open inventory route
const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGINS || 'http://localhost:5173'
)
  .split(',')
  .filter(Boolean);

// ---------- Public provider inventory route ----------
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
      const r = await fetchWithRetry(
        `${PARTNER_URL}/api/inventory`,
        {},
        {
          timeoutMs: 1500,
          retries: 2,
          delayMs: 200,
        }
      );

      if (r.status === 404) {
        return res.status(404).json({
          message: 'Provider not found in LiteStock',
        });
      }

      if (!r.ok) {
        console.error('Partner returned:', r.status);
        throw new Error(`Partner returned ${r.status}`);
      }

      const data = await r.json();

      if (!Array.isArray(data.inventory)) {
        console.error(
          'Unexpected partner response shape, keys:',
          Object.keys(data)
        );

        throw new Error('Invalid partner response format');
      }

      // Map Team 11's actual JSON fields
      const inventory = data.inventory.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        category: i.category,
        quantity: i.stock_quantity,
        status: i.status,
      }));

      // Save the latest successful response
      const asOf = new Date().toISOString();

      lastGood.set(id, {
        data: inventory,
        asOf,
      });

      // Return fresh inventory
      return res.json({
        data: inventory,
        stale: false,
        asOf,
      });

    } catch (err) {
      const reason = err.name === 'TimeoutError'
        ? 'timeout'
        : (err.cause?.code || err.message);

      console.error('Partner call failed:', reason);

      // Try the last successful response
      const cached = lastGood.get(id);

      if (cached) {
        return res.json({
          data: cached.data,
          stale: true,
          asOf: cached.asOf,
        });
      }

      return res.status(502).json({
        message: 'Partner data unavailable',
      });
    }
  }
);

// ---------- Everything below requires an API key ----------
app.use(cors());
app.use(requireApiKey);

app.use(rateLimit({
  windowMs: 60000,
  max: 100,
}));

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
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
