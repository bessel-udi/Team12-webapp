const express = require('express');
const router = express.Router();

router.use('/workers', require('../routes/workers'));   // swap for your v2 files later
router.use('/bookings', require('../routes/bookings'));

module.exports = router;