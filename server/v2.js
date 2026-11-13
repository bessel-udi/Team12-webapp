// v2: same data, one new shape. GET /v2/workers returns { data: [...], count: N } instead of a bare list.
// Everything else (single worker, bookings, errors, filters) is the same code as v1.
const express = require('express');
const workerRoutes = require('./routes/workers');
const bookingRoutes = require('./routes/bookings');

const router = express.Router();

// The ONE place where v2 differs from v1: a list response gets wrapped.
function wrapList(req, res, next) {
  if (req.method === 'GET' && req.path === '/') {
    const send = res.json.bind(res);
    res.json = (body) => send(Array.isArray(body) ? { data: body, count: body.length } : body);
  }
  next();
}

router.use('/workers', wrapList, workerRoutes);
router.use('/bookings', bookingRoutes);

module.exports = router;
