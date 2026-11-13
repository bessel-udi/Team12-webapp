const express = require('express');
const router = express.Router();

router.use('/workers', require('../routes/workers'));
router.use('/bookings', require('../routes/bookings'));

module.exports = router;