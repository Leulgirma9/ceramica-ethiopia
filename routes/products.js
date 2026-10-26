const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const auth = require('../middleware/auth');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product-${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// GET /api/products - public
router.get('/', (req, res) => {
  const { category, search, featured, limit, offset } = req.query;
  let query = `
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_published = 1
  `;
  const params = [];

  if (category) {
    query += ' AND c.slug = ?';
    params.push(category);
  }
  if (search) {
    query += ' AND (p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (featured === '1') {
    query += ' AND p.is_featured = 1';
  }
  query += ' ORDER BY p.created_at DESC';
  if (limit) {
    query += ' LIMIT ?';
    params.push(parseInt(limit));
    if (offset) {
      query += ' OFFSET ?';
      params.push(parseInt(offset));
    }
  }

  const products = db.prepare(query).all(...params);
  res.json(products);
});

// GET /api/products/:id - public
router.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/products - admin only
router.post('/', auth, upload.array('images', 5), (req, res) => {
  const { name, code, category_id, description, price, price_currency, unit, size, material, finish, color, thickness, origin, is_published, is_featured } = req.body;

  if (!name || !code || !price) {
    return res.status(400).json({ error: 'Name, code, and price are required' });
  }

  // Check duplicate code
  const existing = db.prepare('SELECT id FROM products WHERE code = ?').get(code);
  if (existing) return res.status(409).json({ error: 'Product code already exists' });

  const id = uuidv4();
  const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
  const image_url = images[0] || '';

  db.prepare(`
    INSERT INTO products (id, name, code, category_id, description, price, price_currency, unit, size, material, finish, color, thickness, origin, is_published, is_featured, image_url, images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, code, category_id || null, description || '', parseFloat(price), price_currency || 'ETB', unit || 'm²', size || '', material || '', finish || '', color || '', thickness || '', origin || '', parseInt(is_published ?? 1), parseInt(is_featured ?? 0), image_url, JSON.stringify(images));

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.status(201).json(product);
});

// PUT /api/products/:id - admin only
router.put('/:id', auth, upload.array('images', 5), (req, res) => {
  const { name, code, category_id, description, price, price_currency, unit, size, material, finish, color, thickness, origin, is_published, is_featured } = req.body;

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  // Check code uniqueness if changed
  if (code && code !== existing.code) {
    const codeExists = db.prepare('SELECT id FROM products WHERE code = ? AND id != ?').get(code, req.params.id);
    if (codeExists) return res.status(409).json({ error: 'Product code already exists' });
  }

  let images = JSON.parse(existing.images || '[]');
  let image_url = existing.image_url;

  if (req.files && req.files.length > 0) {
    const newImages = req.files.map(f => `/uploads/${f.filename}`);
    images = [...images, ...newImages];
    image_url = images[0] || '';
  }

  // Remove images if requested
  if (req.body.remove_images) {
    const toRemove = JSON.parse(req.body.remove_images);
    images = images.filter(img => !toRemove.includes(img));
    image_url = images[0] || '';
  }

  db.prepare(`
    UPDATE products SET
      name = ?, code = ?, category_id = ?, description = ?, price = ?, price_currency = ?,
      unit = ?, size = ?, material = ?, finish = ?, color = ?, thickness = ?, origin = ?,
      is_published = ?, is_featured = ?, image_url = ?, images = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name || existing.name,
    code || existing.code,
    category_id !== undefined ? (category_id || null) : existing.category_id,
    description !== undefined ? description : existing.description,
    price !== undefined ? parseFloat(price) : existing.price,
    price_currency || existing.price_currency,
    unit || existing.unit,
    size !== undefined ? size : existing.size,
    material !== undefined ? material : existing.material,
    finish !== undefined ? finish : existing.finish,
    color !== undefined ? color : existing.color,
    thickness !== undefined ? thickness : existing.thickness,
    origin !== undefined ? origin : existing.origin,
    is_published !== undefined ? parseInt(is_published) : existing.is_published,
    is_featured !== undefined ? parseInt(is_featured) : existing.is_featured,
    image_url,
    JSON.stringify(images),
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/products/:id - admin only
router.delete('/:id', auth, (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ message: 'Product deleted' });
});

// GET /api/products/admin/all - admin: all products including hidden
router.get('/admin/all', auth, (req, res) => {
  const { search, category } = req.query;
  let query = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ' AND (p.name LIKE ? OR p.code LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }
  if (category) {
    query += ' AND c.slug = ?';
    params.push(category);
  }
  query += ' ORDER BY p.created_at DESC';

  const products = db.prepare(query).all(...params);
  res.json(products);
});

module.exports = router;
