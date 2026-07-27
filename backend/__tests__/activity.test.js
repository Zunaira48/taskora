jest.mock('../db', () => ({
  sql: {
    NVarChar: jest.fn(() => 'NVarChar'),
    Date: 'Date',
    UniqueIdentifier: 'UniqueIdentifier',
    MAX: 'MAX'
  },
  getPool: jest.fn()
}));

const request = require('supertest');
const app = require('../server');
const { getPool } = require('../db');
const { makeRequestMock, makeToken } = require('./testHelpers');

const authCookie = [`token=${makeToken('user-1', 'jane@example.com')}`];

describe('GET /api/activity', () => {
  test('rejects requests with no session cookie', async () => {
    const res = await request(app).get('/api/activity');
    expect(res.status).toBe(401);
  });

  test('returns recent activity for the logged-in user', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(
      makeRequestMock({ recordset: [{ Id: 'a1', Message: 'Added task "Buy milk"' }] })
    );
    getPool.mockResolvedValue(pool);

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
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(
      makeRequestMock({ recordset: [{ Id: 'a1', Message: 'Deleted task "Old"' }] })
    );
    getPool.mockResolvedValue(pool);

    const res = await request(app).post('/api/activity').set('Cookie', authCookie).send({ message: 'Deleted task "Old"' });
    expect(res.status).toBe(201);
  });
});