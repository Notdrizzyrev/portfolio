import express from 'express';
import pg from 'pg';
import cors from 'cors';

const { Pool } = pg;
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ─── Init Tables ────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(100) NOT NULL,
      reward VARCHAR(200) NOT NULL,
      location VARCHAR(100) NOT NULL DEFAULT 'In-Game',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS classes (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(100),
      description TEXT,
      details TEXT,
      image VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      details TEXT,
      image VARCHAR(500),
      status VARCHAR(50) DEFAULT 'UPCOMING',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS guides (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      content TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed default codes if table is empty
  const { rows } = await pool.query('SELECT COUNT(*) FROM codes');
  if (parseInt(rows[0].count) === 0) {
    const seeds = [
      ['SXSPARTNER', 'Partner Rewards', 'In-Game'],
      ['CARBOTANIMATIONS', 'Creator Rewards', 'In-Game'],
      ['SXSAMBASSADOR', 'Ambassador Rewards', 'In-Game'],
      ['SXSCREATOR', 'Creator Rewards', 'In-Game'],
      ['SXSREDDIT', 'Community Rewards', 'In-Game'],
      ['SS000', 'In-Game Rewards', 'In-Game'],
      ['SS888', 'In-Game Rewards', 'In-Game'],
      ['ZJ888', 'In-Game Rewards', 'In-Game'],
      ['ZJ999', 'In-Game Rewards', 'In-Game'],
      ['SS999', 'In-Game Rewards', 'In-Game'],
      ['ZJ777', 'In-Game Rewards', 'In-Game'],
      ['SS777', 'In-Game Rewards', 'In-Game'],
    ];
    for (const [code, reward, location] of seeds) {
      await pool.query(
        'INSERT INTO codes (code, reward, location) VALUES ($1, $2, $3)',
        [code, reward, location]
      );
    }
    console.log('✅ Seeded default codes');
  }
}

// ─── CODES ──────────────────────────────────────────────────────────────────
app.get('/api/codes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM codes ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/codes', async (req, res) => {
  try {
    const { code, reward, location } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO codes (code, reward, location) VALUES ($1, $2, $3) RETURNING *',
      [code, reward, location]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/codes/:id', async (req, res) => {
  try {
    const { code, reward, location } = req.body;
    const { rows } = await pool.query(
      'UPDATE codes SET code=$1, reward=$2, location=$3 WHERE id=$4 RETURNING *',
      [code, reward, location, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/codes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM codes WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CLASSES ────────────────────────────────────────────────────────────────
app.get('/api/classes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM classes ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/classes', async (req, res) => {
  try {
    const { name, role, description, details, image } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO classes (name, role, description, details, image) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, role, description, details, image]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/classes/:id', async (req, res) => {
  try {
    const { name, role, description, details, image } = req.body;
    const { rows } = await pool.query(
      'UPDATE classes SET name=$1, role=$2, description=$3, details=$4, image=$5 WHERE id=$6 RETURNING *',
      [name, role, description, details, image, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/classes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM classes WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EVENTS ─────────────────────────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM events ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const { title, description, details, image, status } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO events (title, description, details, image, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [title, description, details, image, status]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { title, description, details, image, status } = req.body;
    const { rows } = await pool.query(
      'UPDATE events SET title=$1, description=$2, details=$3, image=$4, status=$5 WHERE id=$6 RETURNING *',
      [title, description, details, image, status, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GUIDES ─────────────────────────────────────────────────────────────────
app.get('/api/guides', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM guides ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guides', async (req, res) => {
  try {
    const { title, content } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO guides (title, content) VALUES ($1,$2) RETURNING *',
      [title, content]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/guides/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    const { rows } = await pool.query(
      'UPDATE guides SET title=$1, content=$2 WHERE id=$3 RETURNING *',
      [title, content, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/guides/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM guides WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'Sword X Staff API running' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('DB init failed:', err);
    process.exit(1);
  });
