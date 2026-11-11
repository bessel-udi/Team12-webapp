// Staff accounts and roles (admin, fundi). No extra packages: uses Node's built-in crypto.
const crypto = require('crypto');
const db = require('./db');

const ROLES = ['admin', 'fundi'];
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // sessions last 8 hours

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw httpError(503, 'Staff login is not configured');
  return s;
}

// ---- Passwords (scrypt, salted) ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored || '').split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---- Signed session tokens ----
function signToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

// ---- Middleware: who is calling, and are they allowed? ----
function requireStaff(allowed = ROLES) {
  return async (req, res, next) => {
    try {
      const header = req.get('Authorization') || '';
      const data = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
      if (!data) return res.status(401).json({ message: 'Please sign in' });

      // Look the account up on every request, so removing someone or changing their role takes effect at once.
      const [rows] = await db.query(
        'SELECT id, username, display_name AS name, role FROM staff_users WHERE id = ?',
        [data.id]
      );
      if (rows.length === 0) return res.status(401).json({ message: 'Please sign in' });
      if (!allowed.includes(rows[0].role)) {
        return res.status(403).json({ message: 'You do not have access to this' });
      }
      req.user = rows[0];
      next();
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      next(err);
    }
  };
}

// ---- Table + first admin (created at startup) ----
async function ensureStaffTable() {
  await db.query(
    `CREATE TABLE IF NOT EXISTS staff_users (
       id INT AUTO_INCREMENT PRIMARY KEY,
       username VARCHAR(50) NOT NULL UNIQUE,
       display_name VARCHAR(60) NOT NULL,
       role ENUM('admin','fundi') NOT NULL,
       password_hash VARCHAR(255) NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`
  );

  const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return;
  if (ADMIN_PASSWORD.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters; skipping first-admin setup');
    return;
  }
  const username = ADMIN_USERNAME.trim().toLowerCase();
  const [rows] = await db.query('SELECT id FROM staff_users WHERE username = ?', [username]);
  if (rows.length === 0) {
    await db.query(
      'INSERT INTO staff_users (username, display_name, role, password_hash) VALUES (?, ?, ?, ?)',
      [username, (ADMIN_NAME || 'Admin').slice(0, 60), 'admin', hashPassword(ADMIN_PASSWORD)]
    );
    console.log('Created first admin account');
  }
}

module.exports = { ROLES, hashPassword, verifyPassword, signToken, verifyToken, requireStaff, ensureStaffTable };
