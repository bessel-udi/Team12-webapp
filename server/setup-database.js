// One-off: creates your local database (named by DB_NAME in server/.env) and loads schema.sql + seed.sql from the repo root.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');

(async () => {
  const name = process.env.DB_NAME;
  if (!/^[A-Za-z0-9_]+$/.test(name || '')) throw new Error('DB_NAME is missing or has unusual characters');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);
  await conn.query(`USE \`${name}\``);

  const [existing] = await conn.query("SHOW TABLES LIKE 'workers'");
  if (existing.length) {
    console.log(`A workers table already exists in ${name}, so nothing was changed.`);
    await conn.end();
    return;
  }

  for (const file of ['schema.sql', 'seed.sql']) {
    const p = path.join(__dirname, '..', file);
    if (!fs.existsSync(p)) {
      console.error(`${file} not found at ${p}`);
      process.exit(1);
    }
    await conn.query(fs.readFileSync(p, 'utf8'));
    console.log('Ran', file);
  }

  const [[db]] = await conn.query('SELECT DATABASE() AS name');
  const [[count]] = await conn.query('SELECT COUNT(*) AS n FROM workers');
  console.log(`Done. Database "${db.name}" now has ${count.n} workers.`);
  if (db.name !== name) {
    console.log(`WARNING: your SQL files switched to "${db.name}", but DB_NAME is "${name}". Set DB_NAME=${db.name} in server/.env.`);
  }
  await conn.end();
})().catch((err) => {
  console.error('Failed:', err.code || err.message);
  process.exit(1);
});
