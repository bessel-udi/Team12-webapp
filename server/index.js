const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Railway's proxy: use the real client IP, not the proxy's
const PORT = process.env.PORT || 5000;

// ---------- Auth ----------
const VALID_KEYS = (process.env.API_KEYS || '').split(',').filter(Boolean);
console.log(`Loaded ${VALID_KEYS.length} API keys`); // count only, never the keys

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
  const hits = new Map(); // key -> { count, resetAt }
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
      return res.status(429).json({ message: 'Too many requests', retryAfter });
    }
    next();
  };
}

app.use(express.json());

const PARTNER_URL = process.env.PARTNER_URL;     // set in .env, never hardcoded
const PARTNER_KEY = process.env.PARTNER_API_KEY; // never hardcode, never log
const HEADER_NAME = 'X-API-Key';                 // change to the header name in their README

// Origins allowed to call the open route from a browser (our own frontend only)
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
  .split(',')
  .filter(Boolean);

// ---------- The ONE route open without an API key ----------
// Our own page calls this so the partner key never reaches the browser.
// It is limited per IP (no API key, so the limiter falls back to req.ip)
// and only returns four fields per item.
const inventoryLimiter = rateLimit({ windowMs: 60000, max: 30 });

app.get(
  '/provider-inventory/:id',
  cors({ origin: FRONTEND_ORIGINS }),
  inventoryLimiter,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'Invalid provider ID' });
    }

    try {
      const r = await fetch(`${PARTNER_URL}/api/inventory?provider_id=${id}`, {
        headers: { [HEADER_NAME]: PARTNER_KEY },
      });

      if (r.status === 404) {
        return res.status(404).json({ message: 'Provider not found in LiteStock' });
      }
      if (!r.ok) {
        console.error('partner returned', r.status); // log the status, never the key
        return res.status(502).json({ message: 'Partner data unavailable' });
      }

      const data = await r.json();

      // Shape check: a renamed field would otherwise silently come back empty
      if (!Array.isArray(data.inventory)) {
        console.error('unexpected partner response shape, keys:', Object.keys(data));
        return res.status(502).json({ message: 'Partner data unavailable' });
      }

      res.json(
        data.inventory.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          status: i.status,
        }))
      );
    } catch (err) {
      // ECONNREFUSED = nothing listening; ENOTFOUND = wrong hostname
      console.error('partner call failed:', err.cause?.code || err.message);
      res.status(502).json({ message: 'Partner data unavailable' });
    }
  }
);

// ---------- Everything below requires a key ----------
app.use(cors()); // open CORS for the keyed API, unchanged
app.use(requireApiKey);
app.use(rateLimit({ windowMs: 60000, max: 100 }));

app.get('/', (req, res) => {
  res.send('QuickFundi API is running');
});

const workerRoutes = require('./routes/workers');
const bookingRoutes = require('./routes/bookings');

app.use('/workers', workerRoutes);
app.use('/bookings', bookingRoutes);
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 'INVALID_JSON', message: 'Request body is not valid JSON' });
  }
  console.error(err); // full detail stays in your server terminal only
  res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;