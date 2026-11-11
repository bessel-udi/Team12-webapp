const express = require('express');
const db = require('../db');
const { ROLES, hashPassword, verifyPassword, signToken, requireStaff } = require('../auth');

const router = express.Router();
const DUMMY_HASH = hashPassword('timing-equaliser-not-a-real-password'); // so unknown usernames take as long as real ones

// POST /staff/login  -> { token, user }
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || password.length > 200) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  try {
    const [rows] = await db.query(
      'SELECT id, display_name, role, password_hash FROM staff_users WHERE username = ?',
      [username.trim().toLowerCase()]
    );
    const user = rows[0];
    const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ message: 'Invalid username or password' });
    res.json({ token: signToken(user), user: { name: user.display_name, role: user.role } });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /staff  (admin only) -> create a fundi or another admin
router.post('/', requireStaff(['admin']), async (req, res) => {
  const { username, displayName, role, password } = req.body || {};
  const valid =
    typeof username === 'string' && /^[a-z0-9._-]{3,50}$/i.test(username.trim()) &&
    typeof displayName === 'string' && displayName.trim().length >= 1 && displayName.trim().length <= 60 &&
    ROLES.includes(role) &&
    typeof password === 'string' && password.length >= 8 && password.length <= 100;
  if (!valid) {
    return res.status(400).json({
      message: 'Username (3-50 letters, numbers, . _ -), name, role (admin or fundi) and a password of at least 8 characters are required',
    });
  }
  try {
    const clean = username.trim().toLowerCase();
    await db.query(
      'INSERT INTO staff_users (username, display_name, role, password_hash) VALUES (?, ?, ?, ?)',
      [clean, displayName.trim(), role, hashPassword(password)]
    );
    res.status(201).json({ user: { username: clean, name: displayName.trim(), role } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That username is already taken' });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /staff/activity  (admin only) -> latest takes and returns
router.get('/activity', requireStaff(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.id, l.product_id, l.product_name, l.quantity, l.created_at,
              COALESCE(s.display_name, l.taken_by) AS who
         FROM material_log l
         LEFT JOIN staff_users s ON s.id = l.staff_id
        ORDER BY l.id DESC
        LIMIT 30`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
