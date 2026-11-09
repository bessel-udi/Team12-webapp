const db = require('./db');
const { fetchWithRetry } = require('./resilientFetch');

const LOW_STOCK_AT = 10;
let lastGood = null; // { items, asOf } from the last successful partner call

function httpError(status, message, code) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

// ---- Create the two tables if they don't exist (runs once at server start) ----
async function ensureTables() {
  await db.query(
    `CREATE TABLE IF NOT EXISTS material_stock (
       product_id INT PRIMARY KEY,
       taken INT NOT NULL DEFAULT 0
     )`
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS material_log (
       id INT AUTO_INCREMENT PRIMARY KEY,
       product_id INT NOT NULL,
       quantity INT NOT NULL,
       taken_by VARCHAR(60) NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`
  );
  console.log('Materials tables ready');
}

// ---- Partner (Team 11) stock: read-only ----
async function fetchPartnerItems() {
  try {
    const r = await fetchWithRetry(
      `${process.env.PARTNER_URL}/api/inventory`,
      { headers: { 'X-API-Key': process.env.PARTNER_API_KEY } },
      { timeoutMs: 5000, retries: 2, delayMs: 200 }
    );

    if (r.status === 404) throw httpError(404, 'Provider not found in LiteStock');
    if (!r.ok) throw new Error(`Partner returned ${r.status}`);

    const data = await r.json();
    const valid =
      Array.isArray(data.inventory) &&
      data.inventory.every(
        (i) =>
          typeof i.name === 'string' &&
          Number.isFinite(i.stock_quantity) &&
          typeof i.status === 'string'
      );
    if (!valid) {
      console.error('unexpected partner response shape, keys:', Object.keys(data));
      throw httpError(502, 'Partner data unavailable');
    }

    const items = data.inventory.map((i) => ({
      product_id: i.product_id,
      name: i.name,
      category: i.category,
      quantity: i.stock_quantity,
      status: i.status,
    }));
    lastGood = { items, asOf: new Date().toISOString() };
    return { items, asOf: lastGood.asOf, stale: false };
  } catch (err) {
    if (err.status) throw err;
    const reason = err.name === 'TimeoutError' ? 'timeout' : err.cause?.code || err.message;
    console.error('Partner call failed:', reason);
    if (lastGood) return { ...lastGood, stale: true };
    throw httpError(502, 'Partner data unavailable');
  }
}

// ---- Our own ledger of what fundis have taken ----
async function getTakenMap() {
  try {
    const [rows] = await db.query('SELECT product_id, taken FROM material_stock');
    return new Map(rows.map((r) => [Number(r.product_id), Number(r.taken)]));
  } catch (err) {
    // Table missing (materials.sql not run yet): keep the read-only card working.
    console.error('material_stock unavailable:', err.code || err.message);
    return new Map();
  }
}

function deriveStatus(partnerStatus, available) {
  if (available <= 0 || partnerStatus === 'out_of_stock') return 'out_of_stock';
  if (partnerStatus === 'low_stock' || available <= LOW_STOCK_AT) return 'low_stock';
  return 'in_stock';
}

function buildInventory(items, takenMap) {
  return items.map((i) => {
    const taken = takenMap.get(Number(i.product_id)) || 0;
    const available = Math.max(i.quantity - taken, 0);
    return {
      product_id: i.product_id,
      name: i.name,
      category: i.category,
      quantity: available, // what is left to take
      taken, // how many our fundis currently hold
      status: deriveStatus(i.status, available),
    };
  });
}

async function getInventory() {
  const partner = await fetchPartnerItems();
  const takenMap = await getTakenMap();
  return { data: buildInventory(partner.items, takenMap), stale: partner.stale, asOf: partner.asOf };
}

// ---- Take / return ----
async function changeTaken({ action, productId, quantity, takenBy }) {
  const partner = await fetchPartnerItems();
  if (partner.stale) {
    throw httpError(503, 'Live stock is unavailable right now, so items cannot be taken. Try again shortly.', 'STOCK_UNAVAILABLE');
  }

  const item = partner.items.find((i) => Number(i.product_id) === productId);
  if (!item) throw httpError(404, `No inventory item with id ${productId}`, 'ITEM_NOT_FOUND');

  const delta = action === 'take' ? quantity : -quantity;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT IGNORE INTO material_stock (product_id, taken) VALUES (?, 0)', [productId]);
    const [[row]] = await conn.query('SELECT taken FROM material_stock WHERE product_id = ? FOR UPDATE', [productId]);

    const newTaken = Number(row.taken) + delta;
    if (delta > 0 && newTaken > item.quantity) {
      throw httpError(409, `Only ${Math.max(item.quantity - Number(row.taken), 0)} of "${item.name}" left to take`, 'NOT_ENOUGH_STOCK');
    }
    if (newTaken < 0) {
      throw httpError(409, `Only ${Number(row.taken)} of "${item.name}" can be returned`, 'RETURN_TOO_MANY');
    }

    await conn.query('UPDATE material_stock SET taken = ? WHERE product_id = ?', [newTaken, productId]);
    await conn.query('INSERT INTO material_log (product_id, quantity, taken_by) VALUES (?, ?, ?)', [productId, delta, takenBy]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const takenMap = await getTakenMap();
  return { data: buildInventory(partner.items, takenMap), stale: false, asOf: partner.asOf };
}

module.exports = { getInventory, changeTaken, ensureTables };
