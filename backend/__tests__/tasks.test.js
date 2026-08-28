jest.mock('../db', () => ({
  pool: { query: jest.fn() }
}));

const request = require('supertest');
const app = require('../server');
const { pool } = require('../db');
const { makeToken } = require('./testHelpers');

const authCookie = [`token=${makeToken('user-1', 'jane@example.com')}`];

describe('GET /api/tasks', () => {
  test('rejects requests with no session cookie', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  test('returns tasks for the logged-in user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ Id: 't1', Title: 'Test task' }] });

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
    pool.query.mockResolvedValueOnce({
      rows: [{ Id: 't1', Title: 'Buy milk', Category: 'General', Priority: 'medium', Status: 'todo' }]
    });

    const res = await request(app).post('/api/tasks').set('Cookie', authCookie).send({ title: 'Buy milk' });

    expect(res.status).toBe(201);
    expect(res.body.Status).toBe('todo');
    expect(res.body.Category).toBe('General');
  });
});

describe('PUT /api/tasks/:id', () => {
  test('rejects an empty update body with 400', async () => {
    const res = await request(app).put('/api/tasks/t1').set('Cookie', authCookie).send({});
    expect(res.status).toBe(400);
  });

  test('updates a task successfully', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ Id: 't1', Status: 'done' }] });

    const res = await request(app).put('/api/tasks/t1').set('Cookie', authCookie).send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.Status).toBe('done');
  });

  test('returns 404 when the task does not belong to this user (or does not exist)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).put('/api/tasks/not-mine').set('Cookie', authCookie).send({ status: 'done' });

    expect(res.status).toBe(404);
  });
    test('handles a malformed (non-UUID) id without leaking a stack trace', async () => {
    pool.query.mockRejectedValueOnce(new Error('invalid input syntax for type uuid: "not-a-uuid"'));

    const res = await request(app).put('/api/tasks/not-a-uuid').set('Cookie', authCookie).send({ status: 'done' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to update task');
    expect(res.body.error).not.toMatch(/uuid/i); // the raw Postgres error text must never reach the client
  });
});

describe('DELETE /api/tasks/:id', () => {
  test('deletes a task successfully', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/api/tasks/t1').set('Cookie', authCookie);
    expect(res.status).toBe(204);
  });

  test('returns 404 when nothing was deleted', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(app).delete('/api/tasks/not-mine').set('Cookie', authCookie);
    expect(res.status).toBe(404);
  });
});

describe('User isolation', () => {
  test('GET /api/tasks scopes the query to the logged-in user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await request(app).get('/api/tasks').set('Cookie', authCookie);

    const [queryText, params] = pool.query.mock.calls[0];
    expect(queryText).toMatch(/WHERE user_id = \$1/);
    expect(params).toEqual(['user-1']);
  });

  test('PUT /api/tasks/:id includes user_id in the WHERE clause, not just the task id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ Id: 't1', Status: 'done' }] });

    await request(app).put('/api/tasks/t1').set('Cookie', authCookie).send({ status: 'done' });

    const [queryText, params] = pool.query.mock.calls[0];
    expect(queryText).toMatch(/WHERE id = \$\d+ AND user_id = \$\d+/);
    expect(params).toContain('user-1');
  });

  test('DELETE /api/tasks/:id includes user_id in the WHERE clause, not just the task id', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    await request(app).delete('/api/tasks/t1').set('Cookie', authCookie);

    const [queryText, params] = pool.query.mock.calls[0];
    expect(queryText).toMatch(/user_id/);
    expect(params).toContain('user-1');
  });
});