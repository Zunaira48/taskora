const rateLimit = require('express-rate-limit');

// Generous limit for normal API usage (tasks, activity)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                 // 300 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' }
});

// Stricter limit for auth routes — this is where brute-force attempts happen
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,                  // 20 login/register attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' }
});

module.exports = { generalLimiter, authLimiter };

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // AI calls are more expensive than a normal CRUD request — keep this tighter
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request limit reached, please try again later' }
});

module.exports = { generalLimiter, authLimiter, aiLimiter };

const copilotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40, // conversational — allow more turns than the single-shot AI features
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Copilot request limit reached, please try again later' }
});

module.exports = { generalLimiter, authLimiter, aiLimiter, copilotLimiter };