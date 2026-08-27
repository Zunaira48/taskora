jest.mock('../db', () => ({
  pool: { query: jest.fn() }
}));

jest.mock('../services/ai/aiService', () => ({
  breakdownTask: jest.fn(),
  extractSmartTask: jest.fn(),
  recommendPriority: jest.fn(),
  planMyDay: jest.fn()
}));

const request = require('supertest');
const app = require('../server');
const { pool } = require('../db');
const aiService = require('../services/ai/aiService');
const { makeToken } = require('./testHelpers');

const authCookie = [`token=${makeToken('user-1', 'jane@example.com')}`];

describe('POST /api/ai/breakdown', () => {
  test('rejects requests with no session cookie', async () => {
    const res = await request(app).post('/api/ai/breakdown').send({ title: 'Plan a trip' });
    expect(res.status).toBe(401);
  });

  test('rejects a missing title with 400', async () => {
    const res = await request(app).post('/api/ai/breakdown').set('Cookie', authCookie).send({});
    expect(res.status).toBe(400);
    expect(aiService.breakdownTask).not.toHaveBeenCalled();
  });

  test('returns subtasks on success', async () => {
    aiService.breakdownTask.mockResolvedValueOnce(['Step one', 'Step two']);

    const res = await request(app)
      .post('/api/ai/breakdown')
      .set('Cookie', authCookie)
      .send({ title: 'Plan a trip' });

    expect(res.status).toBe(200);
    expect(res.body.subtasks).toEqual(['Step one', 'Step two']);
  });

  test('returns 503 with a safe fallback message when the AI call fails', async () => {
    aiService.breakdownTask.mockRejectedValueOnce(new Error('Gemini timeout'));

    const res = await request(app)
      .post('/api/ai/breakdown')
      .set('Cookie', authCookie)
      .send({ title: 'Plan a trip' });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/temporarily unavailable/i);
  });
});

describe('POST /api/ai/smart-task', () => {
  test('rejects a missing input with 400', async () => {
    const res = await request(app).post('/api/ai/smart-task').set('Cookie', authCookie).send({});
    expect(res.status).toBe(400);
  });

  test('rejects input over 500 characters with 400', async () => {
    const res = await request(app)
      .post('/api/ai/smart-task')
      .set('Cookie', authCookie)
      .send({ input: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(aiService.extractSmartTask).not.toHaveBeenCalled();
  });

  test('returns extracted fields on success', async () => {
    aiService.extractSmartTask.mockResolvedValueOnce({
      title: 'Finish migration', category: 'Work', priority: 'high', dueDate: '2026-08-28', labels: ['database']
    });

    const res = await request(app)
      .post('/api/ai/smart-task')
      .set('Cookie', authCookie)
      .send({ input: 'Finish the migration by Friday, urgent' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Finish migration');
    expect(res.body.priority).toBe('high');
  });
});

describe('POST /api/ai/priority-recommendation/:id', () => {
  test('returns 404 when the task does not belong to this user (or does not exist)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/ai/priority-recommendation/not-mine')
      .set('Cookie', authCookie);

    expect(res.status).toBe(404);
    expect(aiService.recommendPriority).not.toHaveBeenCalled();
  });

  test('scopes the task lookup to the logged-in user', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ Id: 't1', Title: 'Test', Category: 'Work', Priority: 'medium', Status: 'todo', DueDate: null }]
    });
    aiService.recommendPriority.mockResolvedValueOnce({ recommendedPriority: 'high', reason: 'Due soon' });

    await request(app).post('/api/ai/priority-recommendation/t1').set('Cookie', authCookie);

    const [queryText, params] = pool.query.mock.calls[0];
    expect(queryText).toMatch(/WHERE id = \$1 AND user_id = \$2/);
    expect(params).toEqual(['t1', 'user-1']);
  });

  test('returns the recommendation on success', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ Id: 't1', Title: 'Test', Category: 'Work', Priority: 'medium', Status: 'todo', DueDate: null }]
    });
    aiService.recommendPriority.mockResolvedValueOnce({ recommendedPriority: 'high', reason: 'Due soon' });

    const res = await request(app).post('/api/ai/priority-recommendation/t1').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.recommendedPriority).toBe('high');
  });
});

describe('POST /api/ai/plan-my-day', () => {
  test('returns an all-caught-up message when there are no open tasks, without calling the AI', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/ai/plan-my-day').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.plan).toEqual([]);
    expect(aiService.planMyDay).not.toHaveBeenCalled();
  });

  test('enriches the AI plan with real task data', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ Id: 't1', Title: 'Finish docs', Priority: 'high', Status: 'todo', DueDate: '2026-08-28' }]
    });
    aiService.planMyDay.mockResolvedValueOnce({
      summary: 'Focus on the API docs today.',
      plan: [{ taskId: 't1', reason: 'Due tomorrow' }]
    });

    const res = await request(app).post('/api/ai/plan-my-day').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.plan[0].title).toBe('Finish docs');
    expect(res.body.plan[0].reason).toBe('Due tomorrow');
  });
});