// mock-partner.js: stand-in for the LiteStock API, built from their openapi.yaml.
// Run:  npm install express  &&  node mock-partner.js
const express = require('express');
const app = express();

const PORT = process.env.MOCK_PORT || 4000;

// The contract does not define an auth header. Check their README and change these two.
const HEADER_NAME = process.env.MOCK_HEADER || 'X-API-Key';
const VALID_KEY = process.env.MOCK_KEY || 'test-key';

// ---- Sample data (field names exactly as in the contract) ----
const providers = {
  15: {
    provider_id: 15,
    name: 'John Mwangi',
    location: 'Nairobi',
    phone: '0712345678',
    description: 'Plumbing and general maintenance services',
    status: 'active',
  },
  16: {
    provider_id: 16,
    name: 'Sarah Wanjiku',
    location: 'Mombasa',
    phone: '0723456789',
    description: 'Electrical installation and repairs',
    status: 'inactive',
  },
};

const products = {
  15: [{ product_id: 101, name: 'Pipe Repair', description: 'Repair of leaking or damaged pipes', price: 1500 }],
  16: [{ product_id: 102, name: 'Socket Installation', description: 'Install a wall socket', price: 800 }],
};

const sales = {
  15: [{ sale_id: 501, date: '2026-09-25', service: 'Pipe Repair', quantity: 1, amount: 1500 }],
  16: [],
};

const inventory = {
  15: [
    { product_id: 201, name: 'PVC Pipe', quantity: 25, unit: 'pieces', status: 'in_stock' },
    { product_id: 202, name: 'Pipe Sealant', quantity: 0, unit: 'tubes', status: 'out_of_stock' },
  ],
  16: [{ product_id: 203, name: 'Copper Wire', quantity: 40, unit: 'metres', status: 'in_stock' }],
};

let nextId = 17;

// Positive integer only, matching "type: integer, minimum: 1"
function parseId(raw) {
  return /^[1-9]\d*$/.test(String(raw)) ? Number(raw) : null;
}

// ---- Key check (runs first; the contract does not list a 401, so log that as a contract gap) ----
app.use((req, res, next) => {
  if (req.get(HEADER_NAME) !== VALID_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
});

app.use(express.json());

// ---- GET /api/providers/{provider_id} ----
app.get('/api/providers/:provider_id', (req, res) => {
  const id = parseId(req.params.provider_id);
  if (id === null) return res.status(400).json({ error: 'Invalid provider ID' });
  const provider = providers[id];
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  res.json(provider);
});

// ---- GET /api/products | /api/sales | /api/inventory  (?provider_id=) ----
function listRoute(key, data) {
  return (req, res) => {
    const id = parseId(req.query.provider_id);
    if (id === null) return res.status(400).json({ error: 'Invalid provider_id' });
    if (!providers[id]) return res.status(404).json({ error: 'Provider not found' });
    res.json({ provider_id: id, [key]: data[id] || [] });
  };
}
app.get('/api/products', listRoute('products', products));
app.get('/api/sales', listRoute('sales', sales));
app.get('/api/inventory', listRoute('inventory', inventory));

// ---- POST /api/providers ----
app.post('/api/providers', (req, res) => {
  const b = req.body || {};
  const bad = ['name', 'location', 'phone', 'description'].filter(
    (f) => typeof b[f] !== 'string' || !b[f].trim()
  );
  if (bad.length) {
    return res.status(400).json({ error: `Missing or invalid fields: ${bad.join(', ')}` });
  }
  const provider = {
    provider_id: nextId++,
    name: b.name,
    location: b.location,
    phone: b.phone,
    description: b.description,
    status: 'active',
  };
  providers[provider.provider_id] = provider;
  res.status(201).json({ message: 'Provider registered successfully', provider });
});

// ---- Fallbacks ----
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => console.log(`Stand-in LiteStock API on http://localhost:${PORT}`));
