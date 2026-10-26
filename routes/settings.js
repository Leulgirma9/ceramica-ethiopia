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
    cb(null, `logo-${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/settings - public (returns all settings as key-value object)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

// PUT /api/settings - admin
router.put('/', auth, upload.single('logo'), (req, res) => {
  const allowed = ['company_name', 'company_tagline', 'company_description', 'company_address', 'company_phone', 'company_email', 'company_whatsapp', 'working_hours', 'hero_title', 'hero_subtitle'];

  const updates = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push({ key, value: req.body[key] });
    }
  }

  if (req.file) {
    updates.push({ key: 'logo_url', value: `/uploads/${req.file.filename}` });
  }

  if (req.body.hero_image_url !== undefined) {
    updates.push({ key: 'hero_image_url', value: req.body.hero_image_url });
  }

  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  const updateAll = db.transaction((updates) => {
    for (const { key, value } of updates) upsert.run(key, value);
  });
  updateAll(updates);

  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

// POST /api/settings/hero-image - upload hero image
router.post('/hero-image', auth, multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `hero-${uuidv4()}${ext}`);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
}).single('hero_image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  const url = `/uploads/${req.file.filename}`;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('hero_image_url', url);
  res.json({ url });
});

module.exports = router;
