const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
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

app.use(cors());
app.use(express.json());
app.use(requireApiKey); // Apply API key middleware to all routes
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