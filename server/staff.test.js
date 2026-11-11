// Staff login and role checks. The database is replaced by a mock, so MySQL is not needed.
process.env.AUTH_SECRET = 'unit-test-secret-unit-test-secret-1234';
process.env.API_KEYS = 'test-key-123';

jest.mock('./db', () => ({ query: jest.fn(), getConnection: jest.fn() }));

const crypto = require('crypto');
const request = require('supertest');
const db = require('./db');
const { hashPassword, signToken } = require('./auth');
const app = require('./index');

const ADMIN = { id: 1, username: 'ada', name: 'Ada Admin', role: 'admin' };
const FUNDI = { id: 2, username: 'james', name: 'James Otieno', role: 'fundi' };
const PASSWORD = 'correct-horse-battery';
let PASSWORD_HASH;

beforeAll(() => {
  PASSWORD_HASH = hashPassword(PASSWORD);
});

beforeEach(() => {
  db.query.mockReset();
  db.query.mockImplementation(async (sql, params) => {
    if (sql.includes('FROM staff_users WHERE id')) {
      const user = [ADMIN, FUNDI].find((u) => u.id === params[0]);
      return [user ? [user] : []];
    }
    if (sql.includes('FROM staff_users WHERE username')) {
      return [params[0] === 'james' ? [{ id: 2, display_name: 'James Otieno', role: 'fundi', password_hash: PASSWORD_HASH }] : []];
    }
    if (sql.includes('FROM material_log l')) return [[{ id: 1, product_id: 18, product_name: 'Laptop', quantity: 2, who: 'James Otieno', created_at: '2026-11-09T10:00:00Z' }]];
    if (sql.startsWith('INSERT INTO staff_users')) return [{}];
    throw new Error(`unexpected query: ${sql}`);
  });
});

const bearer = (user) => ({ Authorization: `Bearer ${signToken(user)}` });

describe('who can see materials', () => {
  test('a customer (no token) gets 401', async () => {
    const res = await request(app).get('/provider-inventory/15');
    expect(res.status).toBe(401);
  });

  test('a garbage token gets 401', async () => {
    const res = await request(app).get('/provider-inventory/15').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });

  test('a token signed with the wrong secret gets 401', async () => {
    const payload = Buffer.from(JSON.stringify({ id: 1, exp: Date.now() + 3600000 })).toString('base64url');
    const sig = crypto.createHmac('sha256', 'some-other-secret-some-other-secret-00').update(payload).digest('base64url');
    const res = await request(app).get('/provider-inventory/15').set('Authorization', `Bearer ${payload}.${sig}`);
    expect(res.status).toBe(401);
  });

  test('a valid API key alone does not unlock staff routes', async () => {
    const res = await request(app).get('/provider-inventory/15').set('X-API-Key', 'test-key-123');
    expect(res.status).toBe(401);
  });

  test('a token for a deleted account gets 401', async () => {
    const res = await request(app).get('/provider-inventory/15').set(bearer({ id: 99 }));
    expect(res.status).toBe(401);
  });
});

describe('roles', () => {
  test('a fundi cannot create staff accounts (403)', async () => {
    const res = await request(app).post('/staff').set(bearer(FUNDI)).send({ username: 'new', displayName: 'New', role: 'fundi', password: 'longenough1' });
    expect(res.status).toBe(403);
  });

  test('a fundi cannot read the activity log (403)', async () => {
    const res = await request(app).get('/staff/activity').set(bearer(FUNDI));
    expect(res.status).toBe(403);
  });

  test('an admin can read the activity log', async () => {
    const res = await request(app).get('/staff/activity').set(bearer(ADMIN));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('an admin can create a fundi, and the password is stored hashed', async () => {
    const res = await request(app).post('/staff').set(bearer(ADMIN)).send({ username: 'grace', displayName: 'Grace M', role: 'fundi', password: 'longenough1' });
    expect(res.status).toBe(201);
    const insert = db.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO staff_users'));
    const stored = insert[1];
    expect(stored).not.toContain('longenough1');
    expect(stored.some((v) => typeof v === 'string' && v.includes(':') && v.length > 60)).toBe(true);
  });

  test('a password shorter than 8 characters is rejected (400)', async () => {
    const res = await request(app).post('/staff').set(bearer(ADMIN)).send({ username: 'grace', displayName: 'Grace M', role: 'fundi', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  test('wrong password gets 401', async () => {
    const res = await request(app).post('/staff/login').send({ username: 'james', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid username or password');
  });

  test('unknown username gets the same 401', async () => {
    const res = await request(app).post('/staff/login').send({ username: 'nobody', password: 'whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid username or password');
  });

  test('right password returns a token and the role', async () => {
    const res = await request(app).post('/staff/login').send({ username: 'james', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('fundi');
    expect(typeof res.body.token).toBe('string');
  });
});
