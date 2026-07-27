process.env.JWT_SECRET = 'test-secret-key-not-used-in-production';
const requireAuth = require('../middleware/requireAuth');
const { makeToken } = require('./testHelpers');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

test('blocks a request with no cookie', () => {
  const req = { cookies: {} };
  const res = mockRes();
  const next = jest.fn();

  requireAuth(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('blocks a request with an invalid token', () => {
  const req = { cookies: { token: 'not-a-real-token' } };
  const res = mockRes();
  const next = jest.fn();

  requireAuth(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('allows a request with a valid token and attaches userId', () => {
  const token = makeToken('user-1', 'jane@example.com');
  const req = { cookies: { token } };
  const res = mockRes();
  const next = jest.fn();

  requireAuth(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.userId).toBe('user-1');
  expect(req.userEmail).toBe('jane@example.com');
});