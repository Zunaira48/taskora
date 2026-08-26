const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { pool } = require('./db');
const { hashPassword, comparePassword, signToken, COOKIE_OPTIONS } = require('./auth');
const requireAuth = require('./middleware/requireAuth');
const { generalLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiters');
const aiService = require('./services/ai/aiService');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL, // must be an exact origin (not '*') when credentials are used
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api/', generalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ===== AUTH =====

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim() || !password || password.length < 6) {
      return res.status(400).json({ error: 'A valid email and a password of at least 6 characters are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id AS "Id", email AS "Email"`,
      [email.toLowerCase().trim(), passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user.Id, user.Email);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ email: user.Email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id AS "Id", email AS "Email", password_hash AS "PasswordHash" FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await comparePassword(password, user.PasswordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user.Id, user.Email);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ email: user.Email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.status(204).send();
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ email: req.userEmail || null, userId: req.userId });
});

// ===== TASKS (all protected, all scoped to the logged-in user) =====

app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id AS "Id", title AS "Title", category AS "Category", priority AS "Priority",
              status AS "Status", due_date AS "DueDate", labels AS "Labels", notes AS "Notes",
              created_at AS "CreatedAt", updated_at AS "UpdatedAt"
       FROM tasks WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

const VALID_PRIORITIES = ['low', 'medium', 'high'];

app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { title, category, priority, dueDate, labels } = req.body;
    if (!title || !title.trim() || title.length > 255) {
      return res.status(400).json({ error: 'Title is required and must be under 255 characters' });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Priority must be low, medium, or high' });
    }
    if (category && category.length > 100) {
      return res.status(400).json({ error: 'Category must be under 100 characters' });
    }

    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, category, priority, status, due_date, labels)
       VALUES ($1, $2, $3, $4, 'todo', $5, $6)
       RETURNING id AS "Id", title AS "Title", category AS "Category", priority AS "Priority",
                 status AS "Status", due_date AS "DueDate", labels AS "Labels", notes AS "Notes",
                 created_at AS "CreatedAt", updated_at AS "UpdatedAt"`,
      [req.userId, title, category || 'General', priority || 'medium', dueDate || null, labels || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = { title: 'title', category: 'category', priority: 'priority', status: 'status', dueDate: 'due_date', labels: 'labels', notes: 'notes' };
    const updates = req.body;

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, column] of Object.entries(allowedFields)) {
      if (key in updates) {
        setClauses.push(`${column} = $${paramIndex}`);
        values.push(updates[key] === '' ? null : updates[key]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push('updated_at = NOW()');
    values.push(id, req.userId);

    // WHERE clause still includes user_id — this is what stops one user editing another's task by guessing an id
    const result = await pool.query(
      `UPDATE tasks
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING id AS "Id", title AS "Title", category AS "Category", priority AS "Priority",
                 status AS "Status", due_date AS "DueDate", labels AS "Labels", notes AS "Notes",
                 created_at AS "CreatedAt", updated_at AS "UpdatedAt"`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ===== ACTIVITY (also scoped per-user) =====

app.get('/api/activity', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id AS "Id", message AS "Message", timestamp AS "Timestamp"
       FROM activity WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 10`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

app.post('/api/activity', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const result = await pool.query(
      `INSERT INTO activity (user_id, message)
       VALUES ($1, $2)
       RETURNING id AS "Id", message AS "Message", timestamp AS "Timestamp"`,
      [req.userId, message]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});
app.post('/api/ai/breakdown', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim() || title.length > 255) {
      return res.status(400).json({ error: 'A task title is required' });
    }

    const subtasks = await aiService.breakdownTask(title.trim());
    res.json({ subtasks });
  } catch (err) {
    console.error('AI breakdown failed:', err.message);
    res.status(503).json({ error: 'AI is temporarily unavailable. Your Taskora data is safe.' });
  }
});

app.post('/api/ai/smart-task', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || !input.trim() || input.length > 500) {
      return res.status(400).json({ error: 'A description is required (max 500 characters)' });
    }

    const extracted = await aiService.extractSmartTask(input.trim());
    res.json(extracted);
  } catch (err) {
    console.error('AI smart task extraction failed:', err.message);
    res.status(503).json({ error: 'AI is temporarily unavailable. Your Taskora data is safe.' });
  }
});
// ===== AI (foundation only — real features come in Phase 8) =====


app.post('/api/ai/ping', requireAuth, aiLimiter, async (req, res) => {

  try {
    const reply = await aiService.ping('Reply with exactly the word: pong');
    res.json({ reply });
  } catch (err) {
    console.error('AI request failed:', err.message);
    res.status(503).json({ error: 'AI is temporarily unavailable. Your Taskora data is safe.' });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Taskora backend running on http://localhost:${PORT}`));
}

module.exports = app;