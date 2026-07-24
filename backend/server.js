const express = require('express');
const cors = require('cors');
const { sql, getPool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/tasks', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Tasks');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Taskora backend running on http://localhost:${PORT}`));