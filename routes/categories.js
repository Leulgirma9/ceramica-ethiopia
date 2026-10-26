const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `category-${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/categories - public
router.get('/', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_published = 1
    GROUP BY c.id
    ORDER BY c.display_order ASC, c.name ASC
  `).all();
  res.json(categories);
});

// GET /api/categories/:id - public
router.get('/:id', (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  res.json(cat);
});

// POST /api/categories - admin
router.post('/', auth, upload.single('image'), (req, res) => {
  const { name, description, display_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
  if (existing) return res.status(409).json({ error: 'Category with this name already exists' });

  const id = uuidv4();
  const image_url = req.file ? `/uploads/${req.file.filename}` : '';

  db.prepare('INSERT INTO categories (id, name, slug, description, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, slug, description || '', image_url, parseInt(display_order || 0));

  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.status(201).json(cat);
});

// PUT /api/categories/:id - admin
router.put('/:id', auth, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  const { name, description, display_order } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : existing.image_url;

  db.prepare('UPDATE categories SET name = ?, description = ?, image_url = ?, display_order = ? WHERE id = ?').run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    image_url,
    display_order !== undefined ? parseInt(display_order) : existing.display_order,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/categories/:id - admin
router.delete('/:id', auth, (req, res) => {
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  // Nullify category_id on products
  db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ message: 'Category deleted' });
});

module.exports = router;
