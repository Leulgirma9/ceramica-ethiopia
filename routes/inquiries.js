const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const auth = require('../middleware/auth');

// Ensure inquiries table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    message TEXT,
    products TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// POST /api/inquiries — public, submit an inquiry
router.post('/', (req, res) => {
  const { name, phone, email, message, products } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO inquiries (id, name, phone, email, message, products)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, phone || '', email || '', message || '', products || '[]');

  res.status(201).json({ id, message: 'Inquiry submitted successfully' });
});

// GET /api/inquiries — admin only
router.get('/', auth, (req, res) => {
  const inquiries = db.prepare(
    'SELECT * FROM inquiries ORDER BY created_at DESC'
  ).all();
  res.json(inquiries);
});

// DELETE /api/inquiries/:id — admin only
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
