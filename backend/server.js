const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { sql, getPool } = require('./db');
const { hashPassword, comparePassword, signToken, COOKIE_OPTIONS } = require('./auth');
const requireAuth = require('./middleware/requireAuth');

const app = express();

app.use(cors({
  origin: 'http://127.0.0.1:5500', // must be an exact origin (not '*') when credentials are used
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ===== AUTH =====

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim() || !password || password.length < 6) {
      return res.status(400).json({ error: 'A valid email and a password of at least 6 characters are required' });
    }

    const pool = await getPool();

    const existing = await pool.request()
      .input('Email', sql.NVarChar, email.toLowerCase().trim())
      .query('SELECT Id FROM Users WHERE Email = @Email');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.request()
      .input('Email', sql.NVarChar, email.toLowerCase().trim())
      .input('PasswordHash', sql.NVarChar, passwordHash)
      .query(`
        INSERT INTO Users (Id, Email, PasswordHash, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.Email
        VALUES (NEWID(), @Email, @PasswordHash, GETUTCDATE())
      `);

    const user = result.recordset[0];
    const token = signToken(user.Id, user.Email);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ email: user.Email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('Email', sql.NVarChar, email.toLowerCase().trim())
      .query('SELECT Id, Email, PasswordHash FROM Users WHERE Email = @Email');

    const user = result.recordset[0];
    // Deliberately vague error message below — don't reveal whether the email exists or the password was wrong
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
    const pool = await getPool();
    const result = await pool.request()
      .input('UserId', sql.UniqueIdentifier, req.userId)
      .query('SELECT * FROM Tasks WHERE UserId = @UserId ORDER BY CreatedAt DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { title, category, priority, dueDate, labels } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('UserId', sql.UniqueIdentifier, req.userId)
      .input('Title', sql.NVarChar, title)
      .input('Category', sql.NVarChar, category || 'General')
      .input('Priority', sql.NVarChar, priority || 'medium')
      .input('DueDate', sql.Date, dueDate || null)
      .input('Labels', sql.NVarChar, labels || null)
      .query(`
        INSERT INTO Tasks (Id, UserId, Title, Category, Priority, Status, DueDate, Labels, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES (NEWID(), @UserId, @Title, @Category, @Priority, 'todo', @DueDate, @Labels, GETUTCDATE(), GETUTCDATE())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = { title: 'Title', category: 'Category', priority: 'Priority', status: 'Status', dueDate: 'DueDate', labels: 'Labels', notes: 'Notes' };
    const updates = req.body;

    const pool = await getPool();
    const request = pool.request()
      .input('Id', sql.UniqueIdentifier, id)
      .input('UserId', sql.UniqueIdentifier, req.userId);

    const setClauses = [];
    for (const [key, column] of Object.entries(allowedFields)) {
      if (key in updates) {
        if (key === 'dueDate') {
          request.input(column, sql.Date, updates[key] || null);
        } else if (key === 'notes') {
          request.input(column, sql.NVarChar(sql.MAX), updates[key] || null);
        } else {
          request.input(column, sql.NVarChar, updates[key]);
        }
        setClauses.push(`${column} = @${column}`);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push('UpdatedAt = GETUTCDATE()');

    // WHERE clause includes UserId — this is what stops one user editing another's task by guessing an Id
    const result = await request.query(`
      UPDATE Tasks
      SET ${setClauses.join(', ')}
      OUTPUT INSERTED.*
      WHERE Id = @Id AND UserId = @UserId
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.UniqueIdentifier, id)
      .input('UserId', sql.UniqueIdentifier, req.userId)
      .query('DELETE FROM Tasks WHERE Id = @Id AND UserId = @UserId');

    if (result.rowsAffected[0] === 0) {
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
    const pool = await getPool();
    const result = await pool.request()
      .input('UserId', sql.UniqueIdentifier, req.userId)
      .query('SELECT TOP 10 * FROM Activity WHERE UserId = @UserId ORDER BY Timestamp DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

app.post('/api/activity', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const pool = await getPool();
    const result = await pool.request()
      .input('UserId', sql.UniqueIdentifier, req.userId)
      .input('Message', sql.NVarChar, message)
      .query(`
        INSERT INTO Activity (Id, UserId, Message, Timestamp)
        OUTPUT INSERTED.*
        VALUES (NEWID(), @UserId, @Message, GETUTCDATE())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Taskora backend running on http://localhost:${PORT}`));
}

module.exports = app;