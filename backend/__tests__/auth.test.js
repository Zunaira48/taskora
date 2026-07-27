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
const bcrypt = require('bcryptjs');
const app = require('../server');
const { getPool } = require('../db');
const { makeRequestMock, makeToken } = require('./testHelpers');

describe('POST /api/auth/register', () => {
  test('registers a new user and sets a session cookie', async () => {
    const pool = { request: jest.fn() };
    pool.request
      .mockReturnValueOnce(makeRequestMock({ recordset: [] })) // existing-email check
      .mockReturnValueOnce(makeRequestMock({ recordset: [{ Id: 'user-1', Email: 'jane@example.com' }] })); // insert
    getPool.mockResolvedValue(pool);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'jane@example.com', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('jane@example.com');
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  test('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'jane@example.com', password: '123' });

    expect(res.status).toBe(400);
  });

  test('rejects a duplicate email with 409', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(makeRequestMock({ recordset: [{ Id: 'existing' }] }));
    getPool.mockResolvedValue(pool);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'jane@example.com', password: 'secret123' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('logs in with correct credentials', async () => {
    const hash = bcrypt.hashSync('secret123', 10);
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(
      makeRequestMock({ recordset: [{ Id: 'user-1', Email: 'jane@example.com', PasswordHash: hash }] })
    );
    getPool.mockResolvedValue(pool);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('jane@example.com');
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  test('rejects a wrong password with 401', async () => {
    const hash = bcrypt.hashSync('secret123', 10);
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(
      makeRequestMock({ recordset: [{ Id: 'user-1', Email: 'jane@example.com', PasswordHash: hash }] })
    );
    getPool.mockResolvedValue(pool);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  test('rejects an unknown email with the same generic 401', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(makeRequestMock({ recordset: [] }));
    getPool.mockResolvedValue(pool);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'secret123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });
});

describe('GET /api/auth/me', () => {
  test('returns 401 with no session cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns the current user with a valid cookie', async () => {
    const token = makeToken('user-1', 'jane@example.com');
    const res = await request(app).get('/api/auth/me').set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('jane@example.com');
    expect(res.body.userId).toBe('user-1');
  });
});

describe('POST /api/auth/logout', () => {
  test('clears the session cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });
});