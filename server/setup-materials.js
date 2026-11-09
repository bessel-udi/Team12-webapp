// One-off: creates the material_stock and material_log tables using your server/.env database settings.
const fs = require('fs');
const path = require('path');
const db = require('./db');

(async () => {
  const statements = fs
    .readFileSync(path.join(__dirname, 'materials.sql'), 'utf8')
    .replace(/--.*$/gm, '') // strip SQL comments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) await db.query(stmt);

  const [rows] = await db.query("SHOW TABLES LIKE 'material%'");
  console.log('Done. Tables found:', rows.map((r) => Object.values(r)[0]).join(', '));
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.code || err.message);
  process.exit(1);
});
