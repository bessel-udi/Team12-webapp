// v1 stays frozen, v2 has the new shape, v1 announces its sunset. The database is mocked.
process.env.API_KEYS = 'test-key';
process.env.AUTH_SECRET = 'unit-test-secret-unit-test-secret-1234';

jest.mock('./db', () => ({ query: jest.fn(), getConnection: jest.fn() }));

const request = require('supertest');
const db = require('./db');
const { SUNSET_V1 } = require('./deprecate');
const app = require('./index');

const KEY = { 'X-API-Key': 'test-key' };
const WORKER_KEYS = ['id', 'name', 'jobType', 'location', 'rating', 'ratePerHour'];
const WORKERS = [
  { id: 'wk_1042', name: 'James Otieno', jobType: 'electrician', location: 'Nairobi, Upper Hill', rating: '4.8', ratePerHour: '800' },
  { id: 'wk_1043', name: 'Peter Kamau', jobType: 'plumber', location: 'Nairobi, Westlands', rating: '4.5', ratePerHour: '700' },
];
const sorted = (o) => Object.keys(o).sort();

beforeEach(() => {
  db.query.mockReset();
  db.query.mockImplementation(async (sql) => {
    if (sql.includes('FROM workers WHERE 1=1')) return [WORKERS];
    if (sql.includes('FROM workers WHERE id')) return [[]];
    if (sql.includes('FROM bookings WHERE id')) return [[]];
    throw new Error(`unexpected query: ${sql}`);
  });
});

describe('v1 is frozen', () => {
  test('GET /v1/workers keeps its original shape: a bare list', async () => {
    const res = await request(app).get('/v1/workers').set(KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(sorted(res.body[0])).toEqual([...WORKER_KEYS].sort());
  });

  test('old unversioned /workers answers exactly like /v1/workers', async () => {
    const a = await request(app).get('/workers').set(KEY);
    const b = await request(app).get('/v1/workers').set(KEY);
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
  });

  test('v1 error shape is unchanged', async () => {
    const res = await request(app).get('/v1/workers/wk_nope').set(KEY);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'WORKER_NOT_FOUND', message: 'No worker found with id wk_nope' });
  });

  test('old unversioned /bookings still answers', async () => {
    const res = await request(app).get('/bookings/bk_nope').set(KEY);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOOKING_NOT_FOUND');
  });
});

describe('v2 has the new shape', () => {
  test('the list is wrapped as { data, count }', async () => {
    const res = await request(app).get('/v2/workers').set(KEY);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(sorted(res.body.data[0])).toEqual([...WORKER_KEYS].sort());
  });

  test('filters still reach the database', async () => {
    await request(app).get('/v2/workers?jobType=electrician').set(KEY);
    const [, params] = db.query.mock.calls[db.query.mock.calls.length - 1];
    expect(params).toContain('electrician');
  });

  test('errors and bookings behave exactly like v1', async () => {
    const w = await request(app).get('/v2/workers/wk_nope').set(KEY);
    expect(w.status).toBe(404);
    expect(w.body).toEqual({ code: 'WORKER_NOT_FOUND', message: 'No worker found with id wk_nope' });
    const b = await request(app).get('/v2/bookings/bk_nope').set(KEY);
    expect(b.status).toBe(404);
    expect(b.body.code).toBe('BOOKING_NOT_FOUND');
  });

  test('v2 needs an API key like everything else', async () => {
    const res = await request(app).get('/v2/workers');
    expect(res.status).toBe(401);
  });
});

describe('deprecation headers', () => {
  test('v1 and the old URLs announce the sunset and point to v2', async () => {
    const cases = [
      ['/v1/workers', '</v2/workers>; rel="successor-version"'],
      ['/workers', '</v2/workers>; rel="successor-version"'],
      ['/v1/workers/wk_nope', '</v2/workers/wk_nope>; rel="successor-version"'],
      ['/bookings/bk_nope', '</v2/bookings/bk_nope>; rel="successor-version"'],
    ];
    for (const [path, link] of cases) {
      const res = await request(app).get(path).set(KEY);
      expect(res.headers.deprecation).toBe('true');
      expect(res.headers.sunset).toBe(new Date(SUNSET_V1).toUTCString());
      expect(res.headers.link).toBe(link);
    }
  });

  test('v2 and unknown paths do not carry them', async () => {
    for (const path of ['/v2/workers', '/nope']) {
      const res = await request(app).get(path).set(KEY);
      expect(res.headers.deprecation).toBeUndefined();
      expect(res.headers.sunset).toBeUndefined();
    }
  });
});
