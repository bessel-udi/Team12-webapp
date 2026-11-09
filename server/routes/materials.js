const express = require('express');
const { changeTaken } = require('../inventoryService');

const router = express.Router();

// The :id (provider) is accepted for URL consistency; the partner returns one shared
// inventory, so the ledger is keyed by product_id.
async function handle(action, req, res) {
  const { productId, quantity, takenBy } = req.body || {};

  const ok =
    Number.isInteger(productId) && productId > 0 &&
    Number.isInteger(quantity) && quantity >= 1 && quantity <= 100 &&
    typeof takenBy === 'string' && takenBy.trim().length >= 1 && takenBy.trim().length <= 60;

  if (!ok) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      message: 'productId and quantity (1-100) must be whole numbers, and takenBy (max 60 characters) is required',
    });
  }

  try {
    res.json(await changeTaken({ action, productId, quantity, takenBy: takenBy.trim() }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: err.code || 'REQUEST_FAILED', message: err.message });
    console.error(err);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error' });
  }
}

router.post('/:id/take', (req, res) => handle('take', req, res));
router.post('/:id/return', (req, res) => handle('return', req, res));

module.exports = router;
