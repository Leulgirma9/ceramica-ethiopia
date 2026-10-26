const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'ceramica.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    category_id TEXT,
    description TEXT,
    price REAL NOT NULL,
    price_currency TEXT DEFAULT 'ETB',
    unit TEXT DEFAULT 'm²',
    size TEXT,
    material TEXT,
    finish TEXT,
    color TEXT,
    thickness TEXT,
    origin TEXT,
    is_published INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    image_url TEXT,
    images TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed admin user
const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get(process.env.ADMIN_USERNAME || 'admin');
if (!adminUser) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ceramica2024', 12);
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(uuidv4(), 'admin', hash);
  console.log('✅ Admin user created');
}

// Seed default settings
const defaultSettings = [
  ['company_name', 'Ceramica Ethiopia'],
  ['company_tagline', 'Premium Ceramic & Porcelain Solutions'],
  ['company_description', 'Ethiopia\'s leading supplier of premium ceramic tiles, porcelain, sanitary ware, faucets, and bathroom appliances. Trusted by architects, designers, and procurement officers across the nation.'],
  ['company_address', 'Bole Road, Addis Ababa, Ethiopia'],
  ['company_phone', '+251 11 123 4567'],
  ['company_email', 'info@ceramicaethiopia.com'],
  ['company_whatsapp', '+251 91 123 4567'],
  ['working_hours', 'Mon – Sat: 8:00 AM – 6:00 PM'],
  ['logo_url', ''],
  ['hero_title', 'Elevate Every Space'],
  ['hero_subtitle', 'Premium ceramics and porcelain for exceptional interiors. Discover our curated collection of tiles, sanitary ware, and bathroom solutions.'],
  ['hero_image_url', ''],
];

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of defaultSettings) {
  insertSetting.run(key, value);
}

// Seed categories
const categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (categoriesCount.count === 0) {
  const cats = [
    { name: 'Ceramic Tiles', slug: 'ceramic-tiles', description: 'Classic and versatile ceramic tiles for floors and walls', order: 1 },
    { name: 'Porcelain Tiles', slug: 'porcelain-tiles', description: 'Premium porcelain tiles with superior durability', order: 2 },
    { name: 'Sanitary Ware', slug: 'sanitary-ware', description: 'High-quality toilets, basins, and bathroom fixtures', order: 3 },
    { name: 'Faucets & Mixers', slug: 'faucets-mixers', description: 'Modern faucets and mixer taps for every style', order: 4 },
    { name: 'Bathroom Appliances', slug: 'bathroom-appliances', description: 'Complete bathroom solutions and accessories', order: 5 },
    { name: 'Outdoor Tiles', slug: 'outdoor-tiles', description: 'Weather-resistant tiles for outdoor spaces', order: 6 },
  ];
  const insertCat = db.prepare('INSERT INTO categories (id, name, slug, description, display_order) VALUES (?, ?, ?, ?, ?)');
  cats.forEach(c => insertCat.run(uuidv4(), c.name, c.slug, c.description, c.order));
  console.log('✅ Default categories seeded');
}

// Seed sample products
const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (productsCount.count === 0) {
  const categories = db.prepare('SELECT id, slug FROM categories').all();
  const catMap = {};
  categories.forEach(c => { catMap[c.slug] = c.id; });

  const products = [
    { name: 'Bianco Marble Effect', code: 'CTL-001', cat: 'ceramic-tiles', price: 850, unit: 'm²', size: '60×60 cm', material: 'Ceramic', finish: 'Glossy', color: 'White', featured: 1 },
    { name: 'Grigio Industrial', code: 'CTL-002', cat: 'ceramic-tiles', price: 780, unit: 'm²', size: '30×60 cm', material: 'Ceramic', finish: 'Matte', color: 'Grey', featured: 0 },
    { name: 'Terra Naturale', code: 'CTL-003', cat: 'ceramic-tiles', price: 920, unit: 'm²', size: '45×45 cm', material: 'Ceramic', finish: 'Natural', color: 'Beige', featured: 1 },
    { name: 'Pietra Grande', code: 'PTL-001', cat: 'porcelain-tiles', price: 1250, unit: 'm²', size: '80×80 cm', material: 'Porcelain', finish: 'Polished', color: 'Ivory', featured: 1 },
    { name: 'Cemento Urbano', code: 'PTL-002', cat: 'porcelain-tiles', price: 1100, unit: 'm²', size: '60×120 cm', material: 'Porcelain', finish: 'Structured', color: 'Anthracite', featured: 0 },
    { name: 'Luna Bianca', code: 'PTL-003', cat: 'porcelain-tiles', price: 1380, unit: 'm²', size: '100×100 cm', material: 'Porcelain', finish: 'Satin', color: 'Pearl White', featured: 1 },
    { name: 'Elegante WC Suite', code: 'SAN-001', cat: 'sanitary-ware', price: 4500, unit: 'piece', size: '67×36 cm', material: 'Vitreous China', finish: 'Glazed', color: 'White', featured: 1 },
    { name: 'Minima Wall-Hung Basin', code: 'SAN-002', cat: 'sanitary-ware', price: 2800, unit: 'piece', size: '50×35 cm', material: 'Ceramic', finish: 'Glazed', color: 'White', featured: 0 },
    { name: 'Alto Single Lever Mixer', code: 'FAU-001', cat: 'faucets-mixers', price: 1800, unit: 'piece', size: 'Standard', material: 'Brass', finish: 'Chrome', color: 'Chrome', featured: 1 },
    { name: 'Nero Matte Faucet', code: 'FAU-002', cat: 'faucets-mixers', price: 2200, unit: 'piece', size: 'Standard', material: 'Brass', finish: 'Matte', color: 'Black', featured: 0 },
    { name: 'Shower System Pro', code: 'BTH-001', cat: 'bathroom-appliances', price: 8500, unit: 'set', size: '80×80 cm', material: 'Stainless Steel', finish: 'Chrome', color: 'Chrome', featured: 1 },
    { name: 'Rustico Outdoor', code: 'OUT-001', cat: 'outdoor-tiles', price: 650, unit: 'm²', size: '40×40 cm', material: 'Porcelain', finish: 'Anti-slip', color: 'Stone Grey', featured: 0 },
  ];

  const insert = db.prepare(`
    INSERT INTO products (id, name, code, category_id, price, price_currency, unit, size, material, finish, color, is_featured, description)
    VALUES (?, ?, ?, ?, ?, 'ETB', ?, ?, ?, ?, ?, ?, ?)
  `);
  products.forEach(p => {
    insert.run(
      uuidv4(), p.name, p.code, catMap[p.cat] || null,
      p.price, p.unit, p.size, p.material, p.finish, p.color, p.featured,
      `Premium ${p.material.toLowerCase()} ${p.name.toLowerCase()} with ${p.finish.toLowerCase()} finish. Available in ${p.size} format.`
    );
  });
  console.log('✅ Sample products seeded');
}

module.exports = db;
