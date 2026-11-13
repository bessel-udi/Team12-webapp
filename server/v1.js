// v1: FROZEN. Do not change the shape of anything it serves.
// The handlers still live, unedited, in routes/workers.js and routes/bookings.js.
const express = require('express');
const workerRoutes = require('./routes/workers');
const bookingRoutes = require('./routes/bookings');
const { deprecated, SUNSET_V1 } = require('./deprecate');

const router = express.Router();
const old = deprecated({ sunset: SUNSET_V1, successor: (path) => `/v2${path}` });

router.use('/workers', old, workerRoutes);
router.use('/bookings', old, bookingRoutes);

module.exports = router;
