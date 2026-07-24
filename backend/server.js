const express = require('express');
const cors = require('cors');
const { sql, getPool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// GET all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Tasks ORDER BY CreatedAt DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST create a new task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, category, priority, dueDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('Title', sql.NVarChar, title)
      .input('Category', sql.NVarChar, category || 'General')
      .input('Priority', sql.NVarChar, priority || 'medium')
      .input('DueDate', sql.Date, dueDate || null)
      .query(`
        INSERT INTO Tasks (Id, Title, Category, Priority, Status, DueDate, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES (NEWID(), @Title, @Category, @Priority, 'todo', @DueDate, GETUTCDATE(), GETUTCDATE())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT update an existing task (partial updates supported)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = { title: 'Title', category: 'Category', priority: 'Priority', status: 'Status', dueDate: 'DueDate' };
    const updates = req.body;

    const pool = await getPool();
    const request = pool.request().input('Id', sql.UniqueIdentifier, id);

    const setClauses = [];
    for (const [key, column] of Object.entries(allowedFields)) {
      if (key in updates) {
        if (key === 'dueDate') {
          request.input(column, sql.Date, updates[key] || null);
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

    const result = await request.query(`
      UPDATE Tasks
      SET ${setClauses.join(', ')}
      OUTPUT INSERTED.*
      WHERE Id = @Id
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

// DELETE a task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.UniqueIdentifier, id)
      .query('DELETE FROM Tasks WHERE Id = @Id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Taskora backend running on http://localhost:${PORT}`));

