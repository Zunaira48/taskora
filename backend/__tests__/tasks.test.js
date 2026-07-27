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

describe('GET /api/tasks', () => {
  test('rejects requests with no session cookie', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  test('returns tasks for the logged-in user', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(
      makeRequestMock({ recordset: [{ Id: 't1', Title: 'Test task', UserId: 'user-1' }] })
    );
    getPool.mockResolvedValue(pool);

    const res = await request(app).get('/api/tasks').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].Title).toBe('Test task');
  });
});

describe('POST /api/tasks', () => {
  test('rejects a missing title with 400', async () => {
    const res = await request(app).post('/api/tasks').set('Cookie', authCookie).send({});
    expect(res.status).toBe(400);
  });

  test('creates a task with defaults applied', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(
      makeRequestMock({ recordset: [{ Id: 't1', Title: 'Buy milk', Category: 'General', Priority: 'medium', Status: 'todo' }] })
    );
    getPool.mockResolvedValue(pool);

    const res = await request(app).post('/api/tasks').set('Cookie', authCookie).send({ title: 'Buy milk' });

    expect(res.status).toBe(201);
    expect(res.body.Status).toBe('todo');
    expect(res.body.Category).toBe('General');
  });
});

describe('PUT /api/tasks/:id', () => {
  test('rejects an empty update body with 400', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(makeRequestMock({ recordset: [] }));
    getPool.mockResolvedValue(pool);

    const res = await request(app).put('/api/tasks/t1').set('Cookie', authCookie).send({});
    expect(res.status).toBe(400);
  });

  test('updates a task successfully', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(
      makeRequestMock({ recordset: [{ Id: 't1', Status: 'done' }] })
    );
    getPool.mockResolvedValue(pool);

    const res = await request(app).put('/api/tasks/t1').set('Cookie', authCookie).send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.Status).toBe('done');
  });

  test('returns 404 when the task does not belong to this user (or does not exist)', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(makeRequestMock({ recordset: [] }));
    getPool.mockResolvedValue(pool);

    const res = await request(app).put('/api/tasks/not-mine').set('Cookie', authCookie).send({ status: 'done' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tasks/:id', () => {
  test('deletes a task successfully', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(makeRequestMock({ rowsAffected: [1] }));
    getPool.mockResolvedValue(pool);

    const res = await request(app).delete('/api/tasks/t1').set('Cookie', authCookie);
    expect(res.status).toBe(204);
  });

  test('returns 404 when nothing was deleted', async () => {
    const pool = { request: jest.fn() };
    pool.request.mockReturnValueOnce(makeRequestMock({ rowsAffected: [0] }));
    getPool.mockResolvedValue(pool);

    const res = await request(app).delete('/api/tasks/not-mine').set('Cookie', authCookie);
    expect(res.status).toBe(404);
  });
});