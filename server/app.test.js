process.env.API_KEYS = 'test-key-123'; // set before the app loads
const request = require('supertest');
const app = require('./index');

describe('API key auth', () => {
  test('request without a key gets 401', async () => {
    const res = await request(app).get('/workers');
    expect(res.status).toBe(401);
  });

  test('request with a wrong key gets 401', async () => {
    const res = await request(app).get('/workers').set('X-API-Key', 'wrong');
    expect(res.status).toBe(401);
  });

  test('request with a valid key gets 200', async () => {
    const res = await request(app).get('/workers').set('X-API-Key', 'test-key-123');
    expect(res.status).toBe(200);
  });
});

afterAll(async () => {
  await require('./db').end(); // close the MySQL pool so Jest can exit
});