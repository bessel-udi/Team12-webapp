const express = require('express');
const { getInventory, changeTaken } = require('../inventoryService');

const router = express.Router(); // mounted behind requireStaff(): req.user is always set here

function fail(res, err) {
  if (err.status) return res.status(err.status).json({ code: err.code || 'REQUEST_FAILED', message: err.message });
  console.error(err);
  res.status(500).json({ code: 'SERVER_ERROR', message: 'Server error' });
}

// GET /provider-inventory/:id   (admin and fundi)
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid provider ID' });
  try {
    res.json(await getInventory(req.user));
  } catch (err) {
    fail(res, err);
  }
});

// The :id (provider) is accepted for URL consistency; the partner returns one shared inventory,
// so the ledger is keyed by product_id. WHO is taking comes from the sign-in, never from the request body.
async function handle(action, req, res) {
  const { productId, quantity } = req.body || {};
  const ok =
    Number.isInteger(productId) && productId > 0 &&
    Number.isInteger(quantity) && quantity >= 1 && quantity <= 100;
  if (!ok) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      message: 'productId and quantity (1-100) must be whole numbers',
    });
  }
  try {
    res.json(await changeTaken({ action, productId, quantity, user: req.user }));
  } catch (err) {
    fail(res, err);
  }
}

router.post('/:id/take', (req, res) => handle('take', req, res));
router.post('/:id/return', (req, res) => handle('return', req, res));

module.exports = router;
