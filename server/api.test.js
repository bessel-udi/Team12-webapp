// Two modes:
//  - default: tests the app in-process and talks to MySQL through server/.env
//  - API_URL set (e.g. the Railway URL): tests the live API over HTTP, no database
//    connection needed. Also set TEST_API_KEY to a real key from API_KEYS.
const LIVE_URL = process.env.API_URL;
if (!LIVE_URL) process.env.API_KEYS = 'test-key-123'; // set before the app loads
const request = require('supertest');
const app = LIVE_URL ? null : require('./index');
const db = LIVE_URL ? null : require('./db');
const target = LIVE_URL || app;

const KEY = process.env.TEST_API_KEY || 'test-key-123';
const get = (path) => request(target).get(path).set('X-API-Key', KEY);
const post = (path, body) => request(target).post(path).set('X-API-Key', KEY).send(body);
const patch = (path, body) => request(target).patch(path).set('X-API-Key', KEY).send(body);
const del = (path) => request(target).delete(path).set('X-API-Key', KEY);

const validBooking = {
  workerId: 'wk_1042',
  jobType: 'electrician',
  location: 'Nairobi Hospital, Ward 4',
  scheduledFor: '2026-11-20T09:00:00Z',
  requestedBy: 'Jest automated test',
};

// Bookings created by these tests are removed again at the end (direct mode).
// Against a live URL there is no database access, so they are cancelled instead.
const createdIds = [];
const createBooking = async (overrides = {}) => {
  const res = await post('/bookings', { ...validBooking, ...overrides });
  if (res.body && res.body.id) createdIds.push(res.body.id);
  return res;
};

afterAll(async () => {
  if (LIVE_URL) {
    await Promise.all(createdIds.map((id) => del(`/bookings/${id}`)));
    return;
  }
  if (createdIds.length) {
    await db.query('DELETE FROM bookings WHERE id IN (?)', [createdIds]);
  }
  await db.end(); // close the MySQL pool so Jest can exit
});

describe('GET /workers', () => {
  test('returns the list of workers with the documented fields', async () => {
    const res = await get('/workers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        jobType: expect.any(String),
        location: expect.any(String),
        rating: expect.any(Number), // a number, not the string "4.8"
        ratePerHour: expect.any(Number),
      })
    );
  });

  test('filters by jobType', async () => {
    const res = await get('/workers?jobType=electrician');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((w) => expect(w.jobType).toBe('electrician'));
  });

  test('filters by jobType and location together', async () => {
    const res = await get('/workers?jobType=electrician&location=Upper%20Hill');
    expect(res.status).toBe(200);
    res.body.forEach((w) => {
      expect(w.jobType).toBe('electrician');
      expect(w.location).toMatch(/Upper Hill/);
    });
  });
});

describe('GET /workers/:id', () => {
  test('returns the profile with reviews', async () => {
    const res = await get('/workers/wk_1042');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('wk_1042');
    expect(res.body.experienceYears).toEqual(expect.any(Number));
    expect(Array.isArray(res.body.reviews)).toBe(true);
  });

  test('unknown id returns 404 WORKER_NOT_FOUND', async () => {
    const res = await get('/workers/wk_9999');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('WORKER_NOT_FOUND');
  });
});

describe('POST /bookings', () => {
  test('creates a pending booking and returns 201', async () => {
    const res = await createBooking();
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^bk_/);
    expect(res.body.status).toBe('pending');
    expect(res.body.workerId).toBe('wk_1042');
  });

  test('keeps the exact UTC time (no timezone drift)', async () => {
    const res = await createBooking({ scheduledFor: '2026-11-20T09:00:00Z' });
    expect(res.status).toBe(201);
    expect(new Date(res.body.scheduledFor).toISOString()).toBe('2026-11-20T09:00:00.000Z');
  });

  test.each(['workerId', 'jobType', 'location', 'scheduledFor', 'requestedBy'])(
    'missing %s returns 400 INVALID_BOOKING',
    async (field) => {
      const body = { ...validBooking };
      delete body[field];
      const res = await post('/bookings', body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_BOOKING');
    }
  );

  test('invalid jobType returns 400', async () => {
    const res = await post('/bookings', { ...validBooking, jobType: 'carpenter' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BOOKING');
  });

  test('invalid scheduledFor returns 400', async () => {
    const res = await post('/bookings', { ...validBooking, scheduledFor: 'tomorrow' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BOOKING');
  });

  test('non-string field returns 400', async () => {
    const res = await post('/bookings', { ...validBooking, location: 123 });
    expect(res.status).toBe(400);
  });

  test('no API key returns 401', async () => {
    const res = await request(target).post('/bookings').send(validBooking);
    expect(res.status).toBe(401);
  });
});

describe('GET /bookings/:id', () => {
  test('returns a booking that was just created', async () => {
    const created = await createBooking();
    const res = await get(`/bookings/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.status).toBe('pending');
  });

  test('unknown id returns 404 BOOKING_NOT_FOUND', async () => {
    const res = await get('/bookings/bk_doesnotexist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOOKING_NOT_FOUND');
  });
});

describe('PATCH /bookings/:id', () => {
  test('reschedules a booking', async () => {
    const created = await createBooking();
    const res = await patch(`/bookings/${created.body.id}`, { scheduledFor: '2026-11-21T10:00:00Z' });
    expect(res.status).toBe(200);
    expect(new Date(res.body.scheduledFor).toISOString()).toBe('2026-11-21T10:00:00.000Z');
  });

  test('is idempotent: the same request twice gives the same result', async () => {
    const created = await createBooking();
    const body = { scheduledFor: '2026-11-22T08:30:00Z' };
    const first = await patch(`/bookings/${created.body.id}`, body);
    const second = await patch(`/bookings/${created.body.id}`, body);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  test('missing scheduledFor returns 400', async () => {
    const created = await createBooking();
    const res = await patch(`/bookings/${created.body.id}`, {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_RESCHEDULE');
  });

  test('invalid scheduledFor returns 400', async () => {
    const created = await createBooking();
    const res = await patch(`/bookings/${created.body.id}`, { scheduledFor: 'nope' });
    expect(res.status).toBe(400);
  });

  test('unknown id returns 404', async () => {
    const res = await patch('/bookings/bk_doesnotexist', { scheduledFor: '2026-11-21T10:00:00Z' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOOKING_NOT_FOUND');
  });

  test('a completed booking returns 409 (seed booking bk_5004)', async () => {
    const res = await patch('/bookings/bk_5004', { scheduledFor: '2026-11-21T10:00:00Z' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BOOKING_NOT_RESCHEDULABLE');
  });
});

describe('DELETE /bookings/:id', () => {
  test('cancels a booking: 204, and the booking is kept as cancelled', async () => {
    const created = await createBooking();
    const res = await del(`/bookings/${created.body.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const after = await get(`/bookings/${created.body.id}`);
    expect(after.status).toBe(200);
    expect(after.body.status).toBe('cancelled');
  });

  test('unknown id returns 404', async () => {
    const res = await del('/bookings/bk_doesnotexist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOOKING_NOT_FOUND');
  });

  test('a completed booking returns 409 (seed booking bk_5004)', async () => {
    const res = await del('/bookings/bk_5004');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BOOKING_NOT_CANCELLABLE');
  });
});