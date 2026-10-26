# Ceramica Ethiopia — Project Overview & AI Assistant Instructions

This document provides complete architecture, design rules, and roadmap context for any AI assistant or developer continuing work on this project.

## 🏛️ Project Summary & Design Philosophy
A luxury product catalog and management platform for ceramic tiles, porcelain tiles, sanitary ware, bathroom appliances, and architectural materials.

### Visual Reference: Atlas Concorde ([atlasconcorde.com](https://www.atlasconcorde.com/en))
- **Aesthetic**: Minimal, editorial, high-end Italian architectural showcase.
- **Typography**: Editorial serif headings (`Cormorant Garamond`), clean sans-serif body/UI (`Montserrat`, `Inter`).
- **Color Palette**: Neutral stone tones, off-white backgrounds (`#FAF9F6`), charcoal/deep black text (`#111111`), subtle borders (`#E5E5E5`), warm gold/bronze accents.
- **Imagery**: Large photography with generous white space and clean grids.

---

## 🛠️ Tech Stack & Architecture
- **Backend**: Node.js, Express (Express 5 wildcard routing: `/{*path}` for SPA catch-all)
- **Database**: SQLite via `better-sqlite3` (`ceramica.db`), automatically created and seeded on initialization (`database.js`)
- **Authentication**: JWT token-based auth for admin operations (`middleware/auth.js`)
- **Frontend**: Vanilla JavaScript SPA (`public/js/app.js`), Vanilla CSS design system (`public/css/main.css`), HTML shell (`public/index.html`)
- **File Uploads**: `multer` handling image uploads to `uploads/`

---

## 📁 Key File Structure
- [`server.js`](file:///home/leul/.gemini/antigravity-ide/scratch/ceramica-ethiopia/server.js): Server entry point, API middleware, and SPA routing.
- [`database.js`](file:///home/leul/.gemini/antigravity-ide/scratch/ceramica-ethiopia/database.js): SQLite database initialization and seeding (admin user, categories, products, settings).
- [`public/index.html`](file:///home/leul/.gemini/antigravity-ide/scratch/ceramica-ethiopia/public/index.html): SPA layout shell, navigation, modals, and templates.
- [`public/css/main.css`](file:///home/leul/.gemini/antigravity-ide/scratch/ceramica-ethiopia/public/css/main.css): Design system, responsive typography, luxury layouts, admin panels.
- [`public/js/app.js`](file:///home/leul/.gemini/antigravity-ide/scratch/ceramica-ethiopia/public/js/app.js): SPA router (`#home`, `#catalog`, `#product-detail`, `#about`, `#contact`, `#admin`), API client, filter state, admin CRUD.
- [`routes/`](file:///home/leul/.gemini/antigravity-ide/scratch/ceramica-ethiopia/routes/):
  - `products.js`: Product search, filters, CRUD
  - `categories.js`: Category endpoints
  - `settings.js`: Site metadata & company details
  - `auth.js`: Admin login & verification

---

## 🚀 How to Run
```bash
npm install
cp .env.example .env # if .env does not exist
npm run dev # or npm start
# App runs on http://localhost:3000
```

### Admin Credentials (Local/Dev)
- **Username**: `admin`
- **Password**: `ceramica2024`

---

## 📋 What Has Been Built
1. Express 5 backend with SQLite database and auto-seed data.
2. Complete SPA routing: Homepage, Categories showcase, Product catalog with dynamic filtering (category, surface finish, application type), Product detail view, About, Contact, and Admin dashboard.
3. Admin dashboard with JWT authentication: create/edit/delete products, manage categories, edit site settings.
4. Curated imagery and luxury visual hierarchy adhering to the Atlas Concorde design direction.

---

## 🎯 Next Priorities & Roadmap
When continuing development, pick from these recommended next steps:
1. **Interactive Sample / Inquiry Cart**:
   - Allow users to click "Request Sample" or "Add to Spec Sheet" on products.
   - Drawer/modal listing selected items and a unified inquiry submission form.
2. **Enhanced Product Gallery / Lightbox**:
   - Multiple interior scene images per product with high-resolution zoom/pan modal.
3. **Architectural Projects / Inspiration Gallery**:
   - Showcase real-world architectural applications (residential, commercial, hotels) tagged with products used.
4. **Downloadable Spec Sheets / PDF Generation**:
   - Provide architects and designers with one-click technical spec sheet downloads for each tile/fixture.
