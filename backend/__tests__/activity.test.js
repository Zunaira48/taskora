jest.mock('../db', () => ({
  pool: { query: jest.fn() }
}));

const request = require('supertest');
const app = require('../server');
const { pool } = require('../db');
const { makeToken } = require('./testHelpers');

const authCookie = [`token=${makeToken('user-1', 'jane@example.com')}`];

describe('GET /api/activity', () => {
  test('rejects requests with no session cookie', async () => {
    const res = await request(app).get('/api/activity');
    expect(res.status).toBe(401);
  });

  test('returns recent activity for the logged-in user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ Id: 'a1', Message: 'Added task "Buy milk"' }] });

    const res = await request(app).get('/api/activity').set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body[0].Message).toBe('Added task "Buy milk"');
  });
});

describe('POST /api/activity', () => {
  test('rejects a missing message with 400', async () => {
    const res = await request(app).post('/api/activity').set('Cookie', authCookie).send({});
    expect(res.status).toBe(400);
  });

  test('logs a new activity entry', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ Id: 'a1', Message: 'Deleted task "Old"' }] });

    const res = await request(app).post('/api/activity').set('Cookie', authCookie).send({ message: 'Deleted task "Old"' });
    expect(res.status).toBe(201);
  });
});

describe('User isolation', () => {
  test('GET /api/activity scopes the query to the logged-in user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await request(app).get('/api/activity').set('Cookie', authCookie);

    const [queryText, params] = pool.query.mock.calls[0];
    expect(queryText).toMatch(/WHERE user_id = \$1/);
    expect(params).toEqual(['user-1']);
  });
});