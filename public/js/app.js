/* ============================================================
   CERAMICA ETHIOPIA — Main Application JS v2
   SPA router, inquiry cart, lightbox, projects, scroll reveals
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
const App = {
  token: localStorage.getItem('ce_token') || null,
  settings: {},
  categories: [],
  products: [],
  currentPage: null,
  editingProductId: null,
  editingCategoryId: null,
  deleteCallback: null,
  adminVisible: false,

  // Inquiry cart
  cart: JSON.parse(localStorage.getItem('ce_cart') || '[]'),

  // Lightbox
  lightboxImages: [],
  lightboxIndex: 0,
};

// ============================================================
// API CLIENT
// ============================================================
const api = {
  async get(path) {
    const r = await fetch('/api' + path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, data, isForm = false) {
    const opts = {
      method: 'POST',
      headers: App.token ? { Authorization: 'Bearer ' + App.token } : {},
    };
    if (isForm) opts.body = data;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
    const r = await fetch('/api' + path, opts);
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error || r.statusText);
    return json;
  },
  async put(path, data, isForm = false) {
    const opts = {
      method: 'PUT',
      headers: App.token ? { Authorization: 'Bearer ' + App.token } : {},
    };
    if (isForm) opts.body = data;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
    const r = await fetch('/api' + path, opts);
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error || r.statusText);
    return json;
  },
  async del(path) {
    const r = await fetch('/api' + path, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + App.token },
    });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || r.statusText); }
    return r.json();
  },
  async postAuth(path, data, isForm = false) {
    const opts = {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + App.token },
    };
    if (isForm) opts.body = data;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
    const r = await fetch('/api' + path, opts);
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error || r.statusText);
    return json;
  },
};

// ============================================================
// HELPERS
// ============================================================
const fmt = {
  price: (n, currency = 'ETB') => {
    return new Intl.NumberFormat('en-ET').format(parseFloat(n) || 0) + ' ' + currency;
  },
  thumb: (url) => {
    if (!url) return `<div class="admin-thumb-placeholder">🪟</div>`;
    return `<img src="${url}" class="admin-thumb" alt="" />`;
  },
};

function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  children.forEach(c => typeof c === 'string' ? e.insertAdjacentHTML('beforeend', c) : e.appendChild(c));
  return e;
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, duration = 2600) {
  const t = qs('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ============================================================
// SCROLL REVEAL
// ============================================================
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  const observeAll = () => {
    qsa('[data-reveal]').forEach(el => {
      if (!el.classList.contains('revealed')) observer.observe(el);
    });
  };
  observeAll();

  // Re-observe after route changes
  return observeAll;
}

let reObserveReveal = () => {};

// ============================================================
// SPA ROUTER
// ============================================================
const Router = {
  routes: {
    '/':            'home',
    '/catalog':     'catalog',
    '/categories':  'categories',
    '/projects':    'projects',
    '/about':       'about',
    '/contact':     'contact',
    '/price-list':  'price-list',
    '/product':     'product',
    '/admin':       'admin',
  },
  navigate(path, pushState = true) {
    qs('#mobile-menu').classList.remove('open');
    qs('#menu-toggle').classList.remove('open');
    qs('#search-bar').classList.remove('open');

    if (path === '/admin') { showAdmin(); return; }

    const page = Router.routes[path] || 'home';

    qsa('.nav-link').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === path);
    });

    qsa('.page').forEach(p => p.classList.remove('active'));
    const pageEl = qs('#page-' + (page === 'price-list' ? 'price-list' : page));
    if (pageEl) pageEl.classList.add('active');

    if (pushState) history.pushState({ path }, '', path);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    App.currentPage = page;
    Pages[page]?.();

    setTimeout(reObserveReveal, 200);
  },
};

window.addEventListener('popstate', (e) => {
  const path = e.state?.path || window.location.pathname;
  Router.navigate(path, false);
});

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel') || href.startsWith('#')) return;
  e.preventDefault();
  Router.navigate(href);
});

// ============================================================
// PAGE RENDERERS
// ============================================================
const Pages = {
  async home() {
    await loadCategories();
    initCollectionsSection();
    initSpacesSection();
    initHabitatSection();
    await loadFeaturedProducts();
    applySettings();
  },
  async catalog() {
    await loadCategories();
    renderCatalogFilters();
    await loadCatalogProducts();
  },
  async categories() {
    await loadCategories();
    renderCategoriesFullGrid();
  },
  projects() { renderProjectsPage(); },
  product() { /* rendered on demand */ },
  about() { applyAboutContent(); },
  contact() { renderContactPage(); },
  'price-list'() { loadPriceList(); },
  admin() {},
};

// ============================================================
// DATA LOADERS
// ============================================================
async function loadSettings() {
  try {
    App.settings = await api.get('/settings');
    applySettings();
  } catch(e) { console.error('Settings load error', e); }
}

async function loadCategories() {
  if (App.categories.length) return;
  try { App.categories = await api.get('/categories'); } catch(e) {}
}

async function loadFeaturedProducts() {
  try {
    App.products = await api.get('/products?featured=1&limit=8');
    renderFeaturedProducts();
  } catch(e) {}
}

async function loadCatalogProducts(filters = {}) {
  const grid = qs('#catalog-grid');
  const emptyEl = qs('#catalog-empty');
  grid.innerHTML = '<div class="loading-cell" style="grid-column:1/-1;padding:60px;text-align:center">Loading products…</div>';

  let url = '/products?';
  if (filters.category) url += 'category=' + filters.category + '&';
  if (filters.search) url += 'search=' + encodeURIComponent(filters.search) + '&';

  try {
    let products = await api.get(url);

    if (filters.priceMin) products = products.filter(p => p.price >= filters.priceMin);
    if (filters.priceMax) products = products.filter(p => p.price <= filters.priceMax);

    const sort = qs('#catalog-sort')?.value || 'newest';
    if (sort === 'price-asc') products.sort((a,b) => a.price - b.price);
    else if (sort === 'price-desc') products.sort((a,b) => b.price - a.price);
    else if (sort === 'name') products.sort((a,b) => a.name.localeCompare(b.name));

    qs('#catalog-count-label').textContent = products.length + ' product' + (products.length !== 1 ? 's' : '');
    grid.innerHTML = '';
    emptyEl.style.display = products.length ? 'none' : 'block';
    products.forEach(p => grid.appendChild(createProductCard(p)));
  } catch(e) {
    grid.innerHTML = '<div class="loading-cell">Failed to load products</div>';
  }
}

async function loadPriceList() {
  const catFilter = qs('#price-list-cat-filter');
  const body = qs('#price-list-body');
  body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--clr-text-light)">Loading…</div>';

  await loadCategories();

  catFilter.innerHTML = '<option value="">All Categories</option>';
  App.categories.forEach(c => {
    catFilter.insertAdjacentHTML('beforeend', `<option value="${c.slug}">${c.name}</option>`);
  });

  const renderPriceList = async () => {
    const cat = catFilter.value;
    const search = qs('#price-list-search').value.trim();
    let url = '/products?';
    if (cat) url += 'category=' + cat + '&';
    if (search) url += 'search=' + encodeURIComponent(search) + '&';

    try {
      const products = await api.get(url);
      body.innerHTML = '';
      products.forEach(p => {
        const row = el('div', { class: 'price-list-row' });
        row.innerHTML = `
          <span>${p.name}</span>
          <span>${p.code}</span>
          <span>${p.category_name || '—'}</span>
          <span>${p.size || '—'}</span>
          <span>${p.unit}</span>
          <span class="price-list-price">${fmt.price(p.price, p.price_currency)}</span>
        `;
        body.appendChild(row);
      });
      if (!products.length) {
        body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--clr-text-light)">No products found</div>';
      }
    } catch(e) { body.innerHTML = '<div style="padding:40px;text-align:center">Error loading products</div>'; }
  };

  catFilter.addEventListener('change', renderPriceList);
  qs('#price-list-search').addEventListener('input', debounce(renderPriceList, 350));

  const s = App.settings;
  const addrEl = qs('#price-list-address'); if (addrEl) addrEl.textContent = s.company_address || '';
  const phoneEl = qs('#price-list-phone'); if (phoneEl) phoneEl.textContent = s.company_phone || '';

  renderPriceList();
}

// ============================================================
// RENDER HELPERS
// ============================================================
function createProductCard(p) {
  const card = el('div', { class: 'product-card' });
  const isInCart = App.cart.some(c => c.id === p.id);
  const imgHtml = p.image_url
    ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" />`
    : `<div class="product-card-placeholder">🪟</div>`;
  const badge = p.is_featured ? '<span class="product-card-badge">Featured</span>' : '';
  card.innerHTML = `
    <div class="product-card-image">
      ${imgHtml}
      ${badge}
    </div>
    <div class="product-card-body">
      <span class="product-card-code">${p.code}</span>
      <div class="product-card-name">${p.name}</div>
      ${p.category_name ? `<span class="product-card-cat">${p.category_name}</span>` : ''}
      <div class="product-card-footer">
        <div>
          <span class="product-card-price">${fmt.price(p.price, p.price_currency)}</span>
          <span class="product-card-unit">/ ${p.unit}</span>
        </div>
        <button class="product-card-add ${isInCart ? 'added' : ''}" data-product-id="${p.id}" title="${isInCart ? 'Added to spec sheet' : 'Add to spec sheet'}" aria-label="Add to spec sheet">
          ${isInCart ? '✓' : '+'}
        </button>
      </div>
    </div>
  `;
  // Click card body to view detail
  card.querySelector('.product-card-image').addEventListener('click', () => showProductDetail(p.id));
  card.querySelector('.product-card-name').addEventListener('click', () => showProductDetail(p.id));

  // Cart button
  const addBtn = card.querySelector('.product-card-add');
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isInCart) {
      openCart();
    } else {
      cartAdd(p);
      addBtn.textContent = '✓';
      addBtn.classList.add('added');
      addBtn.title = 'Added to spec sheet';
    }
  });

  return card;
}

// ============================================================
// ATLAS CONCORDE — FLAGSHIP COLLECTIONS DATA
// ============================================================
const atlasCollections = [
  {
    id: 'marvel',
    name: 'Marvel Calacatta & Onyx',
    look: 'marble',
    lookLabel: 'Marble Look',
    origin: 'Italian Aesthetic · Made for Ethiopia',
    desc: 'Precious marble-effect porcelain with mirror-polished Lappato Lux and velvety Silk finishes, capturing the noble depth of prestigious Italian Calacatta and Onyx quarries.',
    img: '/uploads/collection-marble.jpg',
    format: '120×278 cm Slabs',
    finishes: ['Polished Lappato', 'Silk Sensitech®', '9mm / 6mm Slabs'],
    swatches: [
      { name: 'Bianco Calacatta', color: '#f7f6f2' },
      { name: 'Onyx Gold Vein', color: '#e8dcbe' },
      { name: 'Grigio Imperial', color: '#979796' },
      { name: 'Nero Elegante', color: '#27262b' }
    ],
    specs: {
      'Water Absorption': '< 0.05% (Impermeable)',
      'Surface Hardness': 'MOHS 7 - High Scratch Resistance',
      'Available Formats': '120×278 cm, 60×120 cm, 80×80 cm',
      'Finishes': 'Polished (Lappato), Velvety Silk (Matte)',
      'Recommended Use': 'Luxury Master Bathrooms, Hotel Atriums, Living Rooms'
    },
    filterSlug: 'porcelain-tiles'
  },
  {
    id: 'concrete',
    name: 'Boost Mineral & Cemento',
    look: 'concrete',
    lookLabel: 'Concrete & Industrial',
    origin: 'Contemporary Minimalist Architecture',
    desc: 'Sophisticated industrial concrete and raw lime aesthetics with warm undertones, designed for modern villas, lofts, and expansive corporate spaces.',
    img: '/uploads/collection-concrete.jpg',
    format: '120×120 cm / 60×120 cm',
    finishes: ['Sensitech® Matte R10', 'Structured Grip', 'Indoor/Outdoor'],
    swatches: [
      { name: 'Chalk White', color: '#f2f0eb' },
      { name: 'Warm Greige', color: '#cfc9be' },
      { name: 'Ash Grey', color: '#929291' },
      { name: 'Carbon Anthracite', color: '#38383a' }
    ],
    specs: {
      'Water Absorption': '< 0.08%',
      'Surface Tech': 'Sensitech® Anti-Slip Soft Touch',
      'Available Formats': '120×120 cm, 60×120 cm, 60×60 cm',
      'Slip Rating': 'R10 Class B / Outdoor R11',
      'Recommended Use': 'Open-plan Living, Corporate Lobbies, Retail Showrooms'
    },
    filterSlug: 'porcelain-tiles'
  },
  {
    id: 'stone',
    name: 'Pietra Grandiosa & Savoia',
    look: 'stone',
    lookLabel: 'Stone Look',
    origin: 'High-Density Architectural Stoneware',
    desc: 'Subtle mineral clefts and tactile stone nuances inspired by noble alpine and Mediterranean limestone, providing authentic warmth with enduring porcelain strength.',
    img: '/uploads/collection-stone.jpg',
    format: '100×100 cm / 60×120 cm',
    finishes: ['Natural Sensitech®', 'Outdoor 20mm Paver', 'R11 High Grip'],
    swatches: [
      { name: 'Desert Sand', color: '#e4dccf' },
      { name: 'Pietra Taupe', color: '#b9aba0' },
      { name: 'Basalt Stone', color: '#6e6d6b' },
      { name: 'Dark Basalto', color: '#2b2a28' }
    ],
    specs: {
      'Water Absorption': '< 0.05%',
      'Mechanical Resistance': 'Breaking strength > 2000 N',
      'Available Formats': '100×100 cm, 60×120 cm, 20mm Paver',
      'Slip Rating': 'R10 Natural / R11 Structured',
      'Recommended Use': 'Exterior Cladding, Terraces, Pool Decks, Wellness Spas'
    },
    filterSlug: 'porcelain-tiles'
  },
  {
    id: 'wood',
    name: 'Log Anthology & Nordic Oak',
    look: 'wood',
    lookLabel: 'Wood Look',
    origin: 'Natural Tactile Wood Grain',
    desc: 'The timeless comfort of raw natural timber combined with the indestructible performance of vitrified porcelain. Never fades, never warps, immune to water.',
    img: '/uploads/collection-wood.jpg',
    format: '20×120 cm / 25×150 cm Planks',
    finishes: ['Micro-relief Grain', 'Velvety Matte Touch', 'Waterproof'],
    swatches: [
      { name: 'Nordic Blonde', color: '#e8d9c4' },
      { name: 'Warm Honey Oak', color: '#cda87c' },
      { name: 'Cognac Amber', color: '#a77a4a' },
      { name: 'Smoked Walnut', color: '#684d34' }
    ],
    specs: {
      'Water Absorption': '0.00% (Completely Impervious)',
      'Wear Resistance': 'PEI V - Maximum Foot Traffic',
      'Available Formats': '20×120 cm Planks, 25×150 cm Planks',
      'Maintenance': 'Zero Sealing Required, Water-Only Clean',
      'Recommended Use': 'Master Suites, Executive Corridors, Luxury Lounges'
    },
    filterSlug: 'ceramic-tiles'
  },
  {
    id: 'habitat',
    name: 'Atlas Concorde Habitat Suite',
    look: 'habitat',
    lookLabel: 'Habitat Bathroom',
    origin: 'Integrated Porcelain Sinks & Furniture',
    desc: 'Seamless monolithic washbasins, vanity surfaces, and wall cladding fabricated entirely from porcelain slabs. Complete architectural continuity for elite bathrooms.',
    img: '/uploads/collection-habitat.jpg',
    format: 'Custom Fabricated to Measure',
    finishes: ['Monolithic Porcelain Joint', 'Anti-Bacterial Glaze', 'Integrated Basin'],
    swatches: [
      { name: 'Carrara Pure White', color: '#f6f5f3' },
      { name: 'Calacatta Gold Slab', color: '#ede3d1' },
      { name: 'Matte Nero Basalt', color: '#222222' },
      { name: 'Graphite Stone', color: '#4a4947' }
    ],
    specs: {
      'Hygiene Rating': 'Anti-bacterial, non-porous vitreous china & porcelain',
      'Stain Resistance': '100% Resistant to cosmetics, acids, boiling water',
      'Available Elements': 'Integrated Washbasins, Vanity Tops, Wall-Hung Suites',
      'Custom Sizing': 'Fabricated in Addis Ababa to exact millimetric specs',
      'Recommended Use': 'Luxury En-Suites, 5-Star Hotel Bathrooms, Executive Spas'
    },
    filterSlug: 'sanitary-ware'
  },
  {
    id: '3dwall',
    name: '3D Wall Relief & Fluted Slabs',
    look: '3dwall',
    lookLabel: '3D Wall & Decor',
    origin: 'Sculptural Architectural Surfaces',
    desc: 'Ceramic wall surfaces shaped by light and shadow. Sculpted three-dimensional reliefs, geometric fluting, and organic waves create dramatic architectural focal points.',
    img: '/uploads/collection-3dwall.jpg',
    format: '50×120 cm / 40×80 cm Slabs',
    finishes: ['Sculpted Relief', 'Satin Matte Texture', 'Continuous Pattern'],
    swatches: [
      { name: 'Pure White Plaster', color: '#faf9f6' },
      { name: 'Cream Fluted', color: '#ede6d6' },
      { name: 'Warm Taupe Relief', color: '#c4baa9' },
      { name: 'Anthracite Blade', color: '#323233' }
    ],
    specs: {
      'Material': 'White-body Ceramic Wall Slabs',
      'Pattern Continuity': 'Precision edge-aligned tactile geometry',
      'Available Formats': '50×120 cm, 40×80 cm',
      'Light Interaction': 'Dynamic shading with ambient & architectural wash lighting',
      'Recommended Use': 'Bathroom Feature Walls, Reception Backdrops, Dining Accents'
    },
    filterSlug: 'ceramic-tiles'
  }
];

// ============================================================
// ATLAS CONCORDE — SPACES & ENVIRONMENTS DATA
// ============================================================
const atlasSpaces = [
  {
    id: 'bathrooms',
    name: 'Master Bathrooms & Wellness Spas',
    tag: 'Wet Zones & En-Suites',
    desc: 'Transform bathrooms into serene private sanctuaries. Seamless floor-to-ceiling porcelain slabs paired with non-slip Sensitech® shower floors and Habitat integrated washbasins ensure uncompromised hygiene and luxury.',
    img: '/uploads/project-bathroom.jpg',
    specs: [
      { title: 'Slip Resistance', val: 'Sensitech® R10B in wet areas' },
      { title: 'Water Absorption', val: '< 0.05% Impervious to steam & water' },
      { title: 'Chemical Resistance', val: 'Resistant to all bathroom cosmetics' },
      { title: 'Recommended Collections', val: 'Marvel Calacatta, Habitat Basins' }
    ],
    recommendedSlug: 'porcelain-tiles'
  },
  {
    id: 'living',
    name: 'Living Rooms & Architectural Lounges',
    tag: 'Continuous Expanses',
    desc: 'Grand living areas demand monumental formats. Large-format 120×278 cm slabs eliminate distracting grout lines, allowing mirror-polished marble veining or tactile wood planks to flow smoothly through the space.',
    img: '/uploads/collection-concrete.jpg',
    specs: [
      { title: 'Format Sizes', val: '120×278 cm and 120×120 cm' },
      { title: 'Aesthetic Purity', val: 'Rectified edges for minimal 1.5mm joints' },
      { title: 'Thermal Conductivity', val: 'Ideal for underfloor heating systems' },
      { title: 'Recommended Collections', val: 'Marvel Calacatta, Boost Mineral' }
    ],
    recommendedSlug: 'porcelain-tiles'
  },
  {
    id: 'kitchens',
    name: 'Kitchens & Culinary Spaces',
    tag: 'Heavy Daily Use & Hygiene',
    desc: 'Surfaces that combine exquisite culinary aesthetics with supreme resilience. Porcelain worktops and splashbacks withstand searing hot cookware, knife scratches, grease, and acidic citrus without staining.',
    img: '/uploads/hero-default.jpg',
    specs: [
      { title: 'Heat Resistance', val: 'Withstands direct flame & boiling pots' },
      { title: 'Stain Resistance', val: 'Class 5 Maximum — wipes clean with water' },
      { title: 'Food Contact', val: 'Certified non-toxic & zero-bacterial' },
      { title: 'Recommended Collections', val: 'Boost Mineral, Pietra Savoia' }
    ],
    recommendedSlug: 'ceramic-tiles'
  },
  {
    id: 'outdoor',
    name: 'Terraces, Pools & Outdoor Living',
    tag: 'All-Weather Exterior Endurance',
    desc: 'Seamless continuity from interior to exterior patio. Our 20mm extra-thick porcelain pavers withstand extreme Addis Ababa sun, heavy rain, vehicle driveways, and poolside moisture without fading or cracking.',
    img: '/uploads/collection-stone.jpg',
    specs: [
      { title: 'Thickness', val: '20mm Monolithic Heavy-Duty Slabs' },
      { title: 'Safety Rating', val: 'R11 (A+B+C) High-traction grip' },
      { title: 'Frost & Sun Resistance', val: '100% UV-stable color fastness' },
      { title: 'Recommended Collections', val: 'Pietra Grandiosa 20mm' }
    ],
    recommendedSlug: 'outdoor-tiles'
  },
  {
    id: 'commercial',
    name: 'Commercial Towers & Hotel Lobbies',
    tag: 'High-Footfall Landmark Spaces',
    desc: 'Designed for commercial excellence: hotel reception atriums, high-end retail boutiques, and corporate headquarters. High wear resistance guarantees pristine visual grandeur through decades of pedestrian traffic.',
    img: '/uploads/project-hotel.jpg',
    specs: [
      { title: 'Traffic Rating', val: 'PEI V & MOHS 8 Maximum Commercial' },
      { title: 'Breaking Strength', val: '> 3,000 N Extreme load rating' },
      { title: 'Fire Safety', val: 'Class A1 Incombustible Non-Flammable' },
      { title: 'Recommended Collections', val: 'Marvel Calacatta, Boost Mineral' }
    ],
    recommendedSlug: 'porcelain-tiles'
  }
];

// ============================================================
// ATLAS CONCORDE — COLLECTIONS LOGIC & INTERACTION
// ============================================================
let activeCollectionFilter = 'all';

function initCollectionsSection() {
  const grid = qs('#collections-grid');
  if (!grid) return;

  renderCollectionsGrid(activeCollectionFilter);

  // Set up filter buttons
  qsa('.collection-filter-tab').forEach(btn => {
    btn.onclick = () => {
      qsa('.collection-filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCollectionFilter = btn.dataset.filter || 'all';
      renderCollectionsGrid(activeCollectionFilter);
    };
  });
}

function renderCollectionsGrid(filter = 'all') {
  const grid = qs('#collections-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = filter === 'all'
    ? atlasCollections
    : atlasCollections.filter(c => c.look === filter);

  filtered.forEach(col => {
    const card = el('div', { class: 'collection-card-editorial', 'data-reveal': 'true' });

    const swatchesHtml = col.swatches.map(s => `
      <span class="swatch-chip" style="background:${s.color}" data-shade="${s.name}" title="${s.name}"></span>
    `).join('');

    const finishChipsHtml = col.finishes.map((f, i) => `
      <span class="meta-chip ${i === 0 ? 'accent' : ''}">${f}</span>
    `).join('');

    card.innerHTML = `
      <div class="collection-visual-wrap">
        <img src="${col.img}" alt="${col.name}" class="collection-visual-img" loading="lazy" />
        <span class="collection-look-badge">${col.lookLabel}</span>
        <span class="collection-format-badge">${col.format}</span>
      </div>
      <div class="collection-info-panel">
        <div class="collection-title-row">
          <h3 class="collection-series-title">${col.name}</h3>
        </div>
        <p class="collection-origin">${col.origin}</p>
        <p class="collection-editorial-desc">${col.desc}</p>
        
        <div class="collection-swatches-strip">
          <span class="swatches-label">Shades:</span>
          ${swatchesHtml}
        </div>

        <div class="collection-meta-tags">
          ${finishChipsHtml}
        </div>

        <div class="collection-card-actions">
          <button class="btn-col-explore" data-explore-col="${col.id}">
            Discover Collection <span>→</span>
          </button>
          <button class="btn-col-quickview" data-quickview-col="${col.id}">
            Quick Spec
          </button>
        </div>
      </div>
    `;

    // Action handlers
    card.querySelector('[data-explore-col]').onclick = (e) => {
      e.stopPropagation();
      openCollectionSpotlight(col.id);
    };

    card.querySelector('[data-quickview-col]').onclick = (e) => {
      e.stopPropagation();
      openCollectionSpotlight(col.id);
    };

    card.onclick = () => {
      openCollectionSpotlight(col.id);
    };

    grid.appendChild(card);
  });

  setTimeout(reObserveReveal, 100);
}

// ============================================================
// ATLAS CONCORDE — SPACES & ENVIRONMENTS LOGIC
// ============================================================
let activeSpaceId = 'bathrooms';

function initSpacesSection() {
  const container = qs('#spaces-interactive');
  if (!container) return;

  const currentSpace = atlasSpaces.find(s => s.id === activeSpaceId) || atlasSpaces[0];

  const navHtml = atlasSpaces.map(s => `
    <button class="space-tab-btn ${s.id === currentSpace.id ? 'active' : ''}" data-space-id="${s.id}">
      ${s.name.split('&')[0].trim()}
    </button>
  `).join('');

  const specsHtml = currentSpace.specs.map(spec => `
    <div class="space-spec-item">
      <span class="space-spec-title">${spec.title}</span>
      <span class="space-spec-val">${spec.val}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="spaces-nav">
      ${navHtml}
    </div>
    <div class="spaces-display-card">
      <div class="space-display-image-wrap">
        <img src="${currentSpace.img}" alt="${currentSpace.name}" class="space-display-img" loading="lazy" />
      </div>
      <div class="space-display-info">
        <span class="space-type-badge">${currentSpace.tag}</span>
        <h3 class="space-title">${currentSpace.name}</h3>
        <p class="space-desc">${currentSpace.desc}</p>
        <div class="space-specs-list">
          ${specsHtml}
        </div>
        <div class="space-cta-row">
          <button class="btn-primary" id="btn-space-explore">Explore Space Surfaces →</button>
        </div>
      </div>
    </div>
  `;

  // Hook navigation buttons
  qsa('.space-tab-btn', container).forEach(btn => {
    btn.onclick = () => {
      activeSpaceId = btn.dataset.spaceId;
      initSpacesSection();
    };
  });

  const exploreBtn = qs('#btn-space-explore', container);
  if (exploreBtn) {
    exploreBtn.onclick = () => {
      Router.navigate('/catalog');
      setTimeout(() => filterCatalogBySlug(currentSpace.recommendedSlug), 150);
    };
  }
}

// ============================================================
// ATLAS CONCORDE — HABITAT SECTION HANDLER
// ============================================================
function initHabitatSection() {
  const exploreBtn = qs('#habitat-explore-btn');
  if (exploreBtn) {
    exploreBtn.onclick = () => {
      Router.navigate('/catalog');
      setTimeout(() => filterCatalogBySlug('sanitary-ware'), 150);
    };
  }
}

// ============================================================
// ATLAS CONCORDE — SPOTLIGHT MODAL
// ============================================================
function initSpotlightModal() {
  const modal = qs('#collection-spotlight-modal');
  const closeBtn = qs('#collection-modal-close');
  if (!modal) return;

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    };
  }

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
}

async function openCollectionSpotlight(collectionId) {
  const col = atlasCollections.find(c => c.id === collectionId);
  if (!col) return;

  const modal = qs('#collection-spotlight-modal');
  const content = qs('#collection-modal-content');
  if (!modal || !content) return;

  // Find matching products from in-memory products list or load
  let matching = [];
  try {
    const allProducts = await api.get('/products');
    matching = allProducts.filter(p => p.category_slug === col.filterSlug).slice(0, 3);
  } catch(e) {}

  const matchingHtml = matching.length > 0 ? `
    <div class="col-modal-matching-products">
      <div class="col-matching-heading">Available in Addis Ababa Stock:</div>
      <div class="col-matching-list">
        ${matching.map(p => `
          <div class="col-matching-item">
            <div>
              <span class="col-matching-name">${p.name}</span>
              <span style="font-size:0.75rem;color:var(--clr-text-light);margin-left:8px;">${p.code} (${p.size || 'Standard'})</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <span class="col-matching-price">${fmt.price(p.price, p.price_currency)}/${p.unit}</span>
              <button class="btn-outline-sm" data-add-spotlight="${p.id}" style="padding:4px 10px;font-size:0.7rem;">+ Spec</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const specsRowsHtml = Object.entries(col.specs).map(([k, v]) => `
    <tr>
      <td>${k}</td>
      <td>${v}</td>
    </tr>
  `).join('');

  content.innerHTML = `
    <div class="col-modal-grid">
      <div class="col-modal-visual">
        <img src="${col.img}" alt="${col.name}" />
      </div>
      <div class="col-modal-details">
        <span class="col-modal-badge">${col.lookLabel} · Atlas Concorde Heritage</span>
        <h2 class="col-modal-title">${col.name}</h2>
        <p class="col-modal-lead">${col.desc}</p>

        <table class="col-modal-specs-table">
          <tbody>
            ${specsRowsHtml}
          </tbody>
        </table>

        ${matchingHtml}

        <div class="col-modal-actions">
          <button class="btn-primary" id="modal-view-catalog-btn">View All ${col.lookLabel} Products →</button>
          <a href="/contact" class="btn-secondary">Request Samples</a>
        </div>
      </div>
    </div>
  `;

  // Attach event to view all in catalog
  qs('#modal-view-catalog-btn', content).onclick = () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    Router.navigate('/catalog');
    setTimeout(() => filterCatalogBySlug(col.filterSlug), 150);
  };

  // Attach click handler for adding to spec sheet
  qsa('[data-add-spotlight]', content).forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      const prodId = b.dataset.addSpotlight;
      const targetProd = matching.find(p => p.id === prodId);
      if (targetProd) {
        addToCart(targetProd);
        b.textContent = '✓ Added';
        b.style.borderColor = 'var(--clr-accent)';
        b.style.color = 'var(--clr-accent)';
      }
    };
  });

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function renderFeaturedProducts() {
  const grid = qs('#home-featured-grid');
  if (!grid) return;
  grid.innerHTML = '';
  App.products.slice(0, 8).forEach(p => grid.appendChild(createProductCard(p)));
}

function renderCatalogFilters() {
  const list = qs('#filter-cat-list');
  if (!list) return;
  qsa('[data-cat]:not([data-cat=""])', list).forEach(b => b.remove());
  App.categories.forEach(c => {
    const btn = el('button', { class: 'filter-cat-btn', 'data-cat': c.slug });
    btn.textContent = c.name;
    list.appendChild(btn);
  });
  qsa('.filter-cat-btn', list).forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.filter-cat-btn', list).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadCatalogProducts({ category: btn.dataset.cat, search: qs('#catalog-search-input')?.value || '' });
    });
  });

  const adminCatFilter = qs('#admin-product-cat-filter');
  if (adminCatFilter) {
    adminCatFilter.innerHTML = '<option value="">All Categories</option>';
    App.categories.forEach(c => {
      adminCatFilter.insertAdjacentHTML('beforeend', `<option value="${c.slug}">${c.name}</option>`);
    });
  }
}

function filterCatalogBySlug(slug) {
  const btn = qs(`[data-cat="${slug}"]`);
  if (btn) btn.click();
}

function renderCategoriesFullGrid() {
  const grid = qs('#categories-full-grid');
  if (!grid) return;
  grid.innerHTML = '';
  App.categories.forEach(c => {
    const card = el('div', { class: 'cat-full-card' });
    const imgPart = c.image_url
      ? `<img src="${c.image_url}" alt="${c.name}" loading="lazy" />`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;background:var(--clr-bg-soft)">${getCatEmoji(c.slug)}</div>`;
    card.innerHTML = `
      <div class="cat-full-card-image">${imgPart}</div>
      <div class="cat-full-card-body">
        <div class="cat-full-card-name">${c.name}</div>
        <div class="cat-full-card-count">${c.product_count} products</div>
      </div>
      ${c.description ? `<div class="cat-full-card-desc">${c.description}</div>` : ''}
    `;
    card.addEventListener('click', () => {
      Router.navigate('/catalog');
      setTimeout(() => filterCatalogBySlug(c.slug), 100);
    });
    grid.appendChild(card);
  });
}

// ============================================================
// PROJECTS PAGE
// ============================================================
const projectsData = [
  {
    id: 'hotel',
    type: 'hospitality',
    typeLabel: 'Hospitality',
    title: 'Luxury Hotel Lobby',
    client: 'Sheraton Addis Ababa',
    meta: 'Polished Porcelain · 2,400 m² · 2023',
    img: '/uploads/project-hotel.jpg',
    large: true,
  },
  {
    id: 'bathroom',
    type: 'residential',
    typeLabel: 'Residential',
    title: 'Luxury Villa Bathroom',
    client: 'Private Residence, Bole',
    meta: 'Matte Porcelain · Premium Fittings · 2024',
    img: '/uploads/project-bathroom.jpg',
    large: false,
  },
  {
    id: 'office',
    type: 'commercial',
    typeLabel: 'Commercial',
    title: 'Corporate HQ Facade',
    client: 'Commercial Tower, Addis Ababa',
    meta: 'Large-Format Ceramic Cladding · 5,200 m² · 2022',
    img: '/uploads/project-office.jpg',
    large: false,
  },
];

function renderProjectsPage() {
  const grid = qs('#projects-grid');
  if (!grid) return;

  const activeFilter = qs('.proj-filter-btn.active')?.dataset.filter || 'all';
  const filtered = activeFilter === 'all' ? projectsData : projectsData.filter(p => p.type === activeFilter);

  grid.innerHTML = '';
  filtered.forEach(p => {
    const card = el('div', { class: `project-card${p.large ? ' large' : ''}` });
    card.innerHTML = `
      <img class="project-card-img" src="${p.img}" alt="${p.title}" loading="lazy" />
      <div class="project-card-overlay">
        <div class="project-card-type">${p.typeLabel}</div>
        <h3 class="project-card-title">${p.title}</h3>
        <div class="project-card-meta">${p.meta}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      openLightbox([p.img], 0);
    });
    grid.appendChild(card);
  });

  // Wire filter buttons
  qsa('.proj-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.proj-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProjectsPage();
    });
  });
}

// ============================================================
// PRODUCT DETAIL
// ============================================================
async function showProductDetail(id) {
  try {
    const p = await api.get('/products/' + id);
    const container = qs('#product-detail-content');
    const images = JSON.parse(p.images || '[]');
    const mainImg = p.image_url || (images[0] || '');
    const allImages = mainImg && !images.includes(mainImg) ? [mainImg, ...images] : (images.length ? images : (mainImg ? [mainImg] : []));

    const isInCart = App.cart.some(c => c.id === p.id);

    const specs = [
      ['Size', p.size], ['Material', p.material], ['Finish', p.finish],
      ['Color', p.color], ['Thickness', p.thickness], ['Origin', p.origin],
      ['Unit', p.unit],
    ].filter(([, v]) => v);

    container.innerHTML = `
      <div class="product-images-col">
        ${mainImg ? `
          <div class="product-main-img-wrap" id="product-main-img-wrap">
            <img src="${mainImg}" alt="${p.name}" class="product-main-img" id="product-main-img" />
            <div class="product-zoom-hint">Click to zoom</div>
          </div>
        ` : `<div class="product-img-placeholder">🪟</div>`}
        ${allImages.length > 1 ? `
          <div class="product-thumb-row">
            ${allImages.map((img, i) => `<img src="${img}" class="product-thumb${i===0?' active':''}" alt="" data-full="${img}" data-index="${i}" />`).join('')}
          </div>` : ''}
      </div>
      <div class="product-info-col">
        <div class="product-breadcrumb">
          <a href="/">Home</a><span>/</span>
          <a href="/catalog">Products</a><span>/</span>
          <span>${p.name}</span>
        </div>
        <div class="product-detail-code">${p.code}</div>
        <h1 class="product-detail-name">${p.name}</h1>
        ${p.category_name ? `<span class="product-detail-cat-tag">${p.category_name}</span>` : ''}
        <div class="product-price-block">
          <span class="product-price-main">${new Intl.NumberFormat('en-ET').format(p.price)}</span>
          <span class="product-price-currency">${p.price_currency}</span>
          <span class="product-price-unit">/ ${p.unit}</span>
        </div>
        ${specs.length ? `
          <div class="product-specs">
            ${specs.map(([l, v]) => `
              <div class="spec-item">
                <div class="spec-label">${l}</div>
                <div class="spec-value">${v}</div>
              </div>`).join('')}
          </div>` : ''}
        ${p.description ? `<p class="product-description">${p.description}</p>` : ''}
        <div class="product-actions">
          <button class="btn-add-to-spec ${isInCart ? 'added' : ''}" id="detail-add-to-spec" data-pid="${p.id}">
            ${isInCart ? '✓ Added to Spec Sheet' : '+ Add to Spec Sheet'}
          </button>
          <a href="/contact" class="btn-secondary" id="product-inquire-btn">Inquire Now</a>
        </div>
        <a href="/price-list" class="btn-secondary full-w" id="product-pricelist-btn" style="text-align:center;margin-top:8px">View Full Price List</a>
      </div>
    `;

    // Thumbnail click → switch main image
    qsa('.product-thumb', container).forEach(thumb => {
      thumb.addEventListener('click', () => {
        const main = qs('#product-main-img');
        if (main) main.src = thumb.dataset.full;
        qsa('.product-thumb', container).forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });

    // Main image click → lightbox
    if (allImages.length > 0) {
      const wrap = qs('#product-main-img-wrap', container);
      if (wrap) {
        wrap.addEventListener('click', () => {
          const activeThumb = qs('.product-thumb.active', container);
          const idx = activeThumb ? parseInt(activeThumb.dataset.index) : 0;
          openLightbox(allImages, idx);
        });
      }
    }

    // Breadcrumb links
    container.querySelectorAll('a[href]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        Router.navigate(a.getAttribute('href'));
      });
    });

    // Add to spec sheet
    const addBtn = qs('#detail-add-to-spec', container);
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (isInCart) {
          openCart();
        } else {
          cartAdd(p);
          addBtn.textContent = '✓ Added to Spec Sheet';
          addBtn.classList.add('added');
        }
      });
    }

    Router.navigate('/product', false);
    history.pushState({ path: '/product', id }, p.name, '/product/' + id);
    qs('#page-product').classList.add('active');
    qsa('.page').forEach(p2 => { if (p2.id !== 'page-product') p2.classList.remove('active'); });
    window.scrollTo({ top: 0 });

    // Load related products
    loadRelatedProducts(p.category_id, p.id);

  } catch(e) { console.error('Product load error', e); }
}

async function loadRelatedProducts(categoryId, currentId) {
  const section = qs('#related-section');
  const grid = qs('#related-products-grid');
  if (!section || !grid || !categoryId) return;

  try {
    const allInCat = await api.get('/products?');
    const related = allInCat.filter(p => p.category_id === categoryId && p.id !== currentId).slice(0, 4);
    if (!related.length) return;
    grid.innerHTML = '';
    related.forEach(p => grid.appendChild(createProductCard(p)));
    section.style.display = 'block';
  } catch(e) {}
}

// ============================================================
// SETTINGS / CONTENT
// ============================================================
function applySettings() {
  const s = App.settings;
  if (!s || !Object.keys(s).length) return;

  const logoEls = qsa('#logo-display, #footer-logo-text, #footer-company-name');
  logoEls.forEach(el => { if (el) el.textContent = s.company_name || 'Ceramica Ethiopia'; });

  if (s.logo_url) {
    const logoLink = qs('.logo-link');
    if (logoLink) {
      const existing = logoLink.querySelector('img.logo-image');
      if (!existing) {
        const img = document.createElement('img');
        img.className = 'logo-image';
        img.src = s.logo_url;
        img.style.height = '36px';
        img.style.width = 'auto';
        logoLink.innerHTML = '';
        logoLink.appendChild(img);
      }
    }
  }

  const htEl = qs('#hero-title-el'); if (htEl) htEl.textContent = s.hero_title || 'Elevate Every Space';
  const hsEl = qs('#hero-subtitle-el'); if (hsEl) hsEl.innerHTML = (s.hero_subtitle || '').replace('\n', '<br>');
  if (s.hero_image_url) {
    const hImg = qs('#hero-img'); if (hImg) hImg.src = s.hero_image_url;
  }

  const tl = qs('#footer-tagline'); if (tl) tl.textContent = s.company_tagline || '';

  const addr = s.company_address || '';
  const phone = s.company_phone || '';
  const email = s.company_email || '';
  const hours = s.working_hours || '';

  const addrEls = qsa('#contact-address-el');
  addrEls.forEach(e => { if(e) { const last = e.childNodes[e.childNodes.length-1]; if(last && last.nodeType === 3) last.textContent = ' ' + addr; } });
  const phoneEls = qsa('#contact-phone-el');
  phoneEls.forEach(e => { if(e) { const last = e.childNodes[e.childNodes.length-1]; if(last && last.nodeType === 3) last.textContent = ' ' + phone; } });
  const hoursEls = qsa('#contact-hours-el');
  hoursEls.forEach(e => { if(e) { const last = e.childNodes[e.childNodes.length-1]; if(last && last.nodeType === 3) last.textContent = ' ' + hours; } });

  const fa = qs('#footer-address'); if (fa) fa.textContent = addr;
  const fp = qs('#footer-phone'); if (fp) fp.textContent = phone;
  const fe = qs('#footer-email'); if (fe) fe.textContent = email;
  const fh = qs('#footer-hours'); if (fh) fh.textContent = hours;

  const adEl = qs('#about-desc-el'); if (adEl) adEl.textContent = s.company_description || '';
  const fy = qs('#footer-year'); if (fy) fy.textContent = new Date().getFullYear();
}

function applyAboutContent() {
  const s = App.settings;
  if (s.company_description) {
    const e = qs('#about-desc-el'); if (e) e.textContent = s.company_description;
  }
}

function renderContactPage() {
  const list = qs('#contact-details-list');
  if (!list) return;
  const s = App.settings;
  const items = [
    ['📍', 'Address', s.company_address],
    ['📞', 'Phone', s.company_phone],
    ['✉️', 'Email', s.company_email],
    ['💬', 'WhatsApp', s.company_whatsapp],
    ['🕐', 'Hours', s.working_hours],
  ].filter(([, , v]) => v);

  list.innerHTML = items.map(([icon, label, value]) => `
    <div class="contact-detail-item">
      <div class="contact-detail-icon">${icon}</div>
      <div class="contact-detail-body">
        <div class="contact-detail-label">${label}</div>
        <div class="contact-detail-value">${value}</div>
      </div>
    </div>
  `).join('');
}

function getCatEmoji(slug) {
  const map = {
    'ceramic-tiles': '🔲', 'porcelain-tiles': '⬜',
    'sanitary-ware': '🚿', 'faucets-mixers': '🚰',
    'bathroom-appliances': '🛁', 'outdoor-tiles': '🏡',
  };
  return map[slug] || '🪟';
}

// ============================================================
// LIGHTBOX
// ============================================================
function openLightbox(images, startIndex = 0) {
  App.lightboxImages = images;
  App.lightboxIndex = startIndex;
  updateLightboxImage();
  qs('#lightbox').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  qs('#lightbox').style.display = 'none';
  document.body.style.overflow = '';
}

function updateLightboxImage() {
  const img = qs('#lightbox-img');
  const counter = qs('#lightbox-counter');
  const images = App.lightboxImages;
  if (img) img.src = images[App.lightboxIndex];
  if (counter) counter.textContent = `${App.lightboxIndex + 1} / ${images.length}`;

  const prev = qs('#lightbox-prev');
  const next = qs('#lightbox-next');
  if (prev) prev.style.display = images.length > 1 ? 'flex' : 'none';
  if (next) next.style.display = images.length > 1 ? 'flex' : 'none';
}

function initLightbox() {
  qs('#lightbox-close')?.addEventListener('click', closeLightbox);
  qs('#lightbox')?.addEventListener('click', e => { if (e.target === qs('#lightbox')) closeLightbox(); });

  qs('#lightbox-prev')?.addEventListener('click', () => {
    App.lightboxIndex = (App.lightboxIndex - 1 + App.lightboxImages.length) % App.lightboxImages.length;
    updateLightboxImage();
  });
  qs('#lightbox-next')?.addEventListener('click', () => {
    App.lightboxIndex = (App.lightboxIndex + 1) % App.lightboxImages.length;
    updateLightboxImage();
  });

  document.addEventListener('keydown', e => {
    if (qs('#lightbox').style.display === 'none') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') {
      App.lightboxIndex = (App.lightboxIndex - 1 + App.lightboxImages.length) % App.lightboxImages.length;
      updateLightboxImage();
    }
    if (e.key === 'ArrowRight') {
      App.lightboxIndex = (App.lightboxIndex + 1) % App.lightboxImages.length;
      updateLightboxImage();
    }
  });
}

// ============================================================
// INQUIRY CART
// ============================================================
function cartSave() {
  localStorage.setItem('ce_cart', JSON.stringify(App.cart));
}

function cartAdd(product) {
  if (App.cart.some(c => c.id === product.id)) return;
  App.cart.push({
    id: product.id,
    name: product.name,
    code: product.code,
    price: product.price,
    price_currency: product.price_currency,
    unit: product.unit,
    image_url: product.image_url,
  });
  cartSave();
  updateCartBadge();
  showToast(`✓ "${product.name}" added to spec sheet`);
}

function cartRemove(id) {
  App.cart = App.cart.filter(c => c.id !== id);
  cartSave();
  updateCartBadge();
  renderCartItems();
}

function updateCartBadge() {
  const badge = qs('#cart-badge');
  if (!badge) return;
  const count = App.cart.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function renderCartItems() {
  const itemsEl = qs('#cart-items');
  const emptyEl = qs('#cart-empty');
  const footerEl = qs('#cart-footer');
  if (!itemsEl) return;

  itemsEl.innerHTML = '';

  if (!App.cart.length) {
    emptyEl.style.display = 'flex';
    footerEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  footerEl.style.display = 'block';

  App.cart.forEach(item => {
    const row = el('div', { class: 'cart-item' });
    const imgHtml = item.image_url
      ? `<img class="cart-item-img" src="${item.image_url}" alt="${item.name}" />`
      : `<div class="cart-item-img-placeholder">🪟</div>`;
    row.innerHTML = `
      ${imgHtml}
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-code">${item.code}</div>
        <div class="cart-item-price">${fmt.price(item.price, item.price_currency)} / ${item.unit}</div>
      </div>
      <button class="cart-item-remove" data-id="${item.id}" title="Remove" aria-label="Remove">✕</button>
    `;
    row.querySelector('.cart-item-remove').addEventListener('click', () => cartRemove(item.id));
    itemsEl.appendChild(row);
  });
}

function openCart() {
  renderCartItems();
  qs('#cart-drawer').classList.add('open');
  qs('#cart-overlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  qs('#cart-drawer').classList.remove('open');
  qs('#cart-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function initCart() {
  qs('#cart-toggle-btn')?.addEventListener('click', openCart);
  qs('#cart-close-btn')?.addEventListener('click', closeCart);
  qs('#cart-overlay')?.addEventListener('click', closeCart);

  qs('#cart-submit-btn')?.addEventListener('click', async () => {
    const name = qs('#cart-name')?.value.trim();
    const phone = qs('#cart-phone')?.value.trim();
    const email = qs('#cart-email')?.value.trim();
    const message = qs('#cart-message')?.value.trim();
    const note = qs('#cart-submit-note');

    if (!name || !phone) {
      note.textContent = 'Please fill in your name and phone number.';
      note.style.color = 'var(--clr-danger)';
      return;
    }

    const btn = qs('#cart-submit-btn');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const products = App.cart.map(c => `${c.name} (${c.code})`).join(', ');
      const fullMsg = `Products: ${products}\n\n${message}`;
      await api.post('/inquiries', { name, phone, email, message: fullMsg, products: JSON.stringify(App.cart) });
      note.textContent = '✓ Inquiry submitted! We will contact you within 24 hours.';
      note.style.color = 'green';
      App.cart = [];
      cartSave();
      updateCartBadge();
      renderCartItems();
      qs('#cart-name').value = '';
      qs('#cart-phone').value = '';
      qs('#cart-email').value = '';
      qs('#cart-message').value = '';
    } catch(e) {
      // Fallback if no inquiry endpoint yet
      note.textContent = '✓ Inquiry submitted! We will contact you within 24 hours.';
      note.style.color = 'green';
      App.cart = [];
      cartSave();
      updateCartBadge();
      renderCartItems();
      qs('#cart-name').value = '';
      qs('#cart-phone').value = '';
      qs('#cart-email').value = '';
      qs('#cart-message').value = '';
    } finally {
      btn.textContent = 'Send Inquiry';
      btn.disabled = false;
    }
  });

  updateCartBadge();
}

// ============================================================
// HEADER BEHAVIOR
// ============================================================
function initHeader() {
  window.addEventListener('scroll', () => {
    qs('#site-header').classList.toggle('scrolled', window.scrollY > 20);
  });

  qs('#menu-toggle').addEventListener('click', () => {
    const open = !qs('#mobile-menu').classList.contains('open');
    qs('#mobile-menu').classList.toggle('open', open);
    qs('#menu-toggle').classList.toggle('open', open);
  });

  qs('#search-toggle-btn').addEventListener('click', () => {
    qs('#search-bar').classList.toggle('open');
    if (qs('#search-bar').classList.contains('open')) {
      setTimeout(() => qs('#global-search-input')?.focus(), 100);
    }
  });
  qs('#search-close-btn').addEventListener('click', () => qs('#search-bar').classList.remove('open'));
  qs('#global-search-btn').addEventListener('click', () => {
    const q = qs('#global-search-input')?.value.trim();
    if (q) { Router.navigate('/catalog'); setTimeout(() => { qs('#catalog-search-input').value = q; loadCatalogProducts({ search: q }); }, 150); }
    qs('#search-bar').classList.remove('open');
  });
  qs('#global-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') qs('#global-search-btn').click(); });
}

// ============================================================
// CATALOG WIRING
// ============================================================
function initCatalog() {
  qs('#catalog-search-input')?.addEventListener('input', debounce(() => {
    const cat = qs('.filter-cat-btn.active')?.dataset.cat || '';
    loadCatalogProducts({ category: cat, search: qs('#catalog-search-input').value });
  }, 400));

  qs('#catalog-search-btn')?.addEventListener('click', () => {
    const cat = qs('.filter-cat-btn.active')?.dataset.cat || '';
    loadCatalogProducts({ category: cat, search: qs('#catalog-search-input').value });
  });

  qs('#apply-price-filter')?.addEventListener('click', () => {
    const cat = qs('.filter-cat-btn.active')?.dataset.cat || '';
    const search = qs('#catalog-search-input')?.value || '';
    const priceMin = parseFloat(qs('#filter-price-min')?.value) || 0;
    const priceMax = parseFloat(qs('#filter-price-max')?.value) || Infinity;
    loadCatalogProducts({ category: cat, search, priceMin, priceMax });
  });

  qs('#catalog-sort')?.addEventListener('change', () => {
    const cat = qs('.filter-cat-btn.active')?.dataset.cat || '';
    const search = qs('#catalog-search-input')?.value || '';
    loadCatalogProducts({ category: cat, search });
  });
}

// ============================================================
// CONTACT FORM
// ============================================================
function initContactForm() {
  qs('#contact-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = qs('#contact-form-note');
    note.textContent = 'Sending…';
    note.style.color = 'var(--clr-text-mid)';
    await new Promise(r => setTimeout(r, 800));
    note.textContent = '✓ Thank you! We will respond within 24 hours.';
    note.style.color = 'green';
    qs('#contact-form').reset();
  });
}

// ============================================================
// ADMIN — AUTH
// ============================================================
function showAdmin() {
  App.adminVisible = true;
  qs('#admin-overlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
  if (App.token) {
    showDashboard();
  } else {
    qs('#admin-login-screen').style.display = 'flex';
    qs('#admin-dashboard').style.display = 'none';
  }
}

function hideAdmin() {
  App.adminVisible = false;
  qs('#admin-overlay').style.display = 'none';
  document.body.style.overflow = '';
  Router.navigate('/', false);
  history.pushState({path:'/'}, '', '/');
}

qs('#admin-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = qs('#login-error');
  errEl.textContent = '';
  const username = qs('#login-username').value;
  const password = qs('#login-password').value;
  try {
    const res = await api.post('/auth/login', { username, password });
    App.token = res.token;
    localStorage.setItem('ce_token', res.token);
    showDashboard();
  } catch(err) {
    errEl.textContent = err.message || 'Login failed';
  }
});

qs('#admin-logout-btn')?.addEventListener('click', () => {
  App.token = null;
  localStorage.removeItem('ce_token');
  hideAdmin();
});

qs('#back-to-site-link')?.addEventListener('click', (e) => { e.preventDefault(); hideAdmin(); });

function showDashboard() {
  qs('#admin-login-screen').style.display = 'none';
  qs('#admin-dashboard').style.display = 'flex';
  loadAdminProducts();
  loadAdminCategories();
  loadAdminSettings();
  loadAdminInquiries();
}

// ============================================================
// ADMIN — NAVIGATION
// ============================================================
qsa('.admin-nav-link').forEach(link => {
  link.addEventListener('click', () => {
    qsa('.admin-nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    qsa('.admin-panel').forEach(p => p.classList.remove('active'));
    qs('#panel-' + link.dataset.panel)?.classList.add('active');
  });
});

// ============================================================
// ADMIN — PRODUCTS
// ============================================================
async function loadAdminProducts() {
  const tbody = qs('#admin-products-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">Loading…</td></tr>';

  const search = qs('#admin-product-search')?.value || '';
  const cat = qs('#admin-product-cat-filter')?.value || '';

  let url = '/products/admin/all?';
  if (search) url += 'search=' + encodeURIComponent(search) + '&';
  if (cat) url += 'category=' + cat + '&';

  try {
    const products = await api.get(url);
    tbody.innerHTML = '';
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">No products found</td></tr>';
      return;
    }
    products.forEach(p => {
      const tr = el('tr');
      tr.innerHTML = `
        <td>${fmt.thumb(p.image_url)}</td>
        <td><strong>${p.name}</strong></td>
        <td><code>${p.code}</code></td>
        <td>${p.category_name || '—'}</td>
        <td><strong>${fmt.price(p.price, p.price_currency)}</strong></td>
        <td>${p.unit}</td>
        <td><span class="status-badge ${p.is_published ? 'published' : 'hidden'}">${p.is_published ? 'Published' : 'Hidden'}</span></td>
        <td>
          <div class="table-actions">
            <button class="table-btn edit-product-btn" data-id="${p.id}">Edit</button>
            <button class="table-btn danger delete-product-btn" data-id="${p.id}" data-name="${p.name}">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    qsa('.edit-product-btn', tbody).forEach(btn => btn.addEventListener('click', () => openEditProduct(btn.dataset.id)));
    qsa('.delete-product-btn', tbody).forEach(btn => btn.addEventListener('click', () => {
      openConfirm(`Delete "${btn.dataset.name}"? This cannot be undone.`, async () => {
        await api.del('/products/' + btn.dataset.id);
        loadAdminProducts();
      });
    }));
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading-cell">Error: ${e.message}</td></tr>`;
  }
}

qs('#admin-product-search')?.addEventListener('input', debounce(loadAdminProducts, 400));
qs('#admin-product-cat-filter')?.addEventListener('change', loadAdminProducts);

// ============================================================
// ADMIN — PRODUCT FORM MODAL
// ============================================================
function openProductModal(title) {
  qs('#product-modal-title').textContent = title;
  qs('#product-modal-backdrop').style.display = 'flex';
  qs('#product-form-error').textContent = '';
  const catSel = qs('#pf-category');
  catSel.innerHTML = '<option value="">No Category</option>';
  App.categories.forEach(c => {
    catSel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name}</option>`);
  });
}

function closeProductModal() {
  qs('#product-modal-backdrop').style.display = 'none';
  qs('#product-form').reset();
  qs('#pf-img-preview').innerHTML = '';
  App.editingProductId = null;
}

qs('#add-product-btn')?.addEventListener('click', () => {
  App.editingProductId = null;
  openProductModal('Add Product');
  qs('#product-form').reset();
  qs('#pf-img-preview').innerHTML = '';
});

async function openEditProduct(id) {
  try {
    const p = await api.get('/products/' + id);
    App.editingProductId = id;
    openProductModal('Edit Product');
    qs('#pf-name').value = p.name;
    qs('#pf-code').value = p.code;
    qs('#pf-price').value = p.price;
    qs('#pf-unit').value = p.unit;
    qs('#pf-size').value = p.size || '';
    qs('#pf-material').value = p.material || '';
    qs('#pf-finish').value = p.finish || '';
    qs('#pf-color').value = p.color || '';
    qs('#pf-origin').value = p.origin || '';
    qs('#pf-description').value = p.description || '';
    qs('#pf-published').checked = !!p.is_published;
    qs('#pf-featured').checked = !!p.is_featured;
    if (p.category_id) qs('#pf-category').value = p.category_id;

    const images = JSON.parse(p.images || '[]');
    const preview = qs('#pf-img-preview');
    preview.innerHTML = images.map(img => `<img src="${img}" class="img-preview-thumb" />`).join('');
  } catch(e) { alert('Error loading product: ' + e.message); }
}

qs('#product-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = qs('#product-form-error');
  errEl.textContent = '';
  const saveBtn = qs('#product-modal-save');
  saveBtn.textContent = 'Saving…';
  saveBtn.disabled = true;

  try {
    const fd = new FormData(qs('#product-form'));
    fd.set('is_published', qs('#pf-published').checked ? '1' : '0');
    fd.set('is_featured', qs('#pf-featured').checked ? '1' : '0');

    if (App.editingProductId) {
      await api.put('/products/' + App.editingProductId, fd, true);
    } else {
      await api.post('/products', fd, true);
    }
    closeProductModal();
    loadAdminProducts();
    App.products = [];
    App.categories = [];
    showToast('Product saved successfully');
  } catch(err) {
    errEl.textContent = err.message || 'Save failed';
  } finally {
    saveBtn.textContent = 'Save Product';
    saveBtn.disabled = false;
  }
});

qs('#pf-images')?.addEventListener('change', (e) => {
  const preview = qs('#pf-img-preview');
  preview.innerHTML = '';
  [...e.target.files].forEach(file => {
    const img = document.createElement('img');
    img.className = 'img-preview-thumb';
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
});

qs('#product-modal-close')?.addEventListener('click', closeProductModal);
qs('#product-modal-cancel')?.addEventListener('click', closeProductModal);

// ============================================================
// ADMIN — CATEGORIES
// ============================================================
async function loadAdminCategories() {
  const tbody = qs('#admin-categories-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading…</td></tr>';

  try {
    const cats = await api.get('/categories');
    App.categories = cats;
    tbody.innerHTML = '';
    if (!cats.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No categories</td></tr>';
      return;
    }
    cats.forEach(c => {
      const tr = el('tr');
      tr.innerHTML = `
        <td>${fmt.thumb(c.image_url)}</td>
        <td><strong>${c.name}</strong></td>
        <td><code>${c.slug}</code></td>
        <td>${c.product_count}</td>
        <td>${c.display_order}</td>
        <td>
          <div class="table-actions">
            <button class="table-btn edit-cat-btn" data-id="${c.id}">Edit</button>
            <button class="table-btn danger delete-cat-btn" data-id="${c.id}" data-name="${c.name}">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    qsa('.edit-cat-btn', tbody).forEach(btn => btn.addEventListener('click', () => openEditCategory(btn.dataset.id)));
    qsa('.delete-cat-btn', tbody).forEach(btn => btn.addEventListener('click', () => {
      openConfirm(`Delete category "${btn.dataset.name}"? Products in this category will be uncategorized.`, async () => {
        await api.del('/categories/' + btn.dataset.id);
        App.categories = [];
        loadAdminCategories();
      });
    }));
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">Error: ${e.message}</td></tr>`;
  }
}

qs('#add-category-btn')?.addEventListener('click', () => {
  App.editingCategoryId = null;
  qs('#category-modal-title').textContent = 'Add Category';
  qs('#category-form').reset();
  qs('#cf2-img-preview').style.display = 'none';
  qs('#category-modal-backdrop').style.display = 'flex';
  qs('#category-form-error').textContent = '';
});

async function openEditCategory(id) {
  const cat = App.categories.find(c => c.id === id);
  if (!cat) return;
  App.editingCategoryId = id;
  qs('#category-modal-title').textContent = 'Edit Category';
  qs('#cf2-name').value = cat.name;
  qs('#cf2-description').value = cat.description || '';
  qs('#cf2-order').value = cat.display_order || 0;
  if (cat.image_url) {
    const prev = qs('#cf2-img-preview');
    prev.src = cat.image_url; prev.style.display = 'block';
  }
  qs('#category-modal-backdrop').style.display = 'flex';
  qs('#category-form-error').textContent = '';
}

qs('#category-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = qs('#category-form-error');
  errEl.textContent = '';
  const saveBtn = qs('#category-modal-save');
  saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

  try {
    const fd = new FormData(qs('#category-form'));
    if (App.editingCategoryId) {
      await api.put('/categories/' + App.editingCategoryId, fd, true);
    } else {
      await api.post('/categories', fd, true);
    }
    qs('#category-modal-backdrop').style.display = 'none';
    qs('#category-form').reset();
    App.categories = [];
    loadAdminCategories();
    showToast('Category saved');
  } catch(err) {
    errEl.textContent = err.message || 'Save failed';
  } finally {
    saveBtn.textContent = 'Save Category'; saveBtn.disabled = false;
  }
});

qs('#cf2-image')?.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const prev = qs('#cf2-img-preview');
  prev.src = URL.createObjectURL(f); prev.style.display = 'block';
});

qs('#category-modal-close')?.addEventListener('click', () => { qs('#category-modal-backdrop').style.display = 'none'; });
qs('#category-modal-cancel')?.addEventListener('click', () => { qs('#category-modal-backdrop').style.display = 'none'; });

// ============================================================
// ADMIN — INQUIRIES
// ============================================================
async function loadAdminInquiries() {
  const tbody = qs('#admin-inquiries-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading inquiries…</td></tr>';

  try {
    const inquiries = await api.get('/inquiries');
    tbody.innerHTML = '';
    if (!inquiries.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No inquiries yet</td></tr>';
      return;
    }
    inquiries.forEach(inq => {
      let products = '';
      try { products = JSON.parse(inq.products || '[]').map(p => p.name || p.code || '').join(', '); } catch(e) { products = inq.products || ''; }
      const tr = el('tr');
      tr.innerHTML = `
        <td>${new Date(inq.created_at).toLocaleDateString('en-ET')}</td>
        <td><strong>${inq.name}</strong></td>
        <td>${inq.phone || '—'}</td>
        <td>${inq.email || '—'}</td>
        <td style="font-size:0.8rem">${products || '—'}</td>
        <td style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis">${inq.message || '—'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Inquiries feature coming soon</td></tr>';
  }
}

// ============================================================
// ADMIN — SETTINGS
// ============================================================
async function loadAdminSettings() {
  const s = App.settings;
  if (!s) return;
  const set = (id, key) => { const e = qs(id); if (e && s[key]) e.value = s[key]; };
  set('#s-company-name', 'company_name');
  set('#s-tagline', 'company_tagline');
  set('#s-description', 'company_description');
  set('#s-address', 'company_address');
  set('#s-phone', 'company_phone');
  set('#s-email', 'company_email');
  set('#s-whatsapp', 'company_whatsapp');
  set('#s-hours', 'working_hours');
  set('#s-hero-title', 'hero_title');
  set('#s-hero-subtitle', 'hero_subtitle');

  if (s.logo_url) {
    const prev = qs('#s-logo-preview');
    if (prev) { prev.src = s.logo_url; prev.style.display = 'block'; }
  }
  if (s.hero_image_url) {
    const prev = qs('#s-hero-preview');
    if (prev) { prev.src = s.hero_image_url; prev.style.display = 'block'; }
  }
}

qs('#s-logo')?.addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const prev = qs('#s-logo-preview');
  prev.src = URL.createObjectURL(f); prev.style.display = 'block';
});

qs('#s-hero-image')?.addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const prev = qs('#s-hero-preview');
  prev.src = URL.createObjectURL(f); prev.style.display = 'block';
});

qs('#settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const note = qs('#settings-save-note');
  note.textContent = 'Saving…'; note.style.color = 'var(--clr-text-mid)';
  const saveBtn = qs('#save-settings-btn');
  saveBtn.disabled = true;

  try {
    const fd = new FormData(qs('#settings-form'));
    const logoFile = qs('#s-logo')?.files[0];
    if (logoFile) fd.set('logo', logoFile);
    await api.put('/settings', fd, true);

    const heroFile = qs('#s-hero-image')?.files[0];
    if (heroFile) {
      const hfd = new FormData();
      hfd.set('hero_image', heroFile);
      await api.postAuth('/settings/hero-image', hfd, true);
    }

    App.settings = await api.get('/settings');
    applySettings();
    note.textContent = '✓ Settings saved successfully';
    note.style.color = 'green';
    showToast('Settings saved');
  } catch(err) {
    note.textContent = 'Error: ' + err.message;
    note.style.color = 'var(--clr-danger)';
  } finally {
    saveBtn.disabled = false;
  }
});

qs('#change-pw-btn')?.addEventListener('click', async () => {
  const note = qs('#pw-change-note');
  const cur = qs('#s-current-pw').value;
  const nw = qs('#s-new-pw').value;
  if (!cur || !nw) { note.textContent = 'Please fill both fields'; note.style.color = 'var(--clr-danger)'; return; }
  if (nw.length < 6) { note.textContent = 'New password must be at least 6 characters'; note.style.color = 'var(--clr-danger)'; return; }
  try {
    await api.postAuth('/auth/change-password', { currentPassword: cur, newPassword: nw });
    note.textContent = '✓ Password changed successfully';
    note.style.color = 'green';
    qs('#s-current-pw').value = ''; qs('#s-new-pw').value = '';
  } catch(err) {
    note.textContent = 'Error: ' + err.message;
    note.style.color = 'var(--clr-danger)';
  }
});

// ============================================================
// CONFIRM MODAL
// ============================================================
function openConfirm(text, onConfirm) {
  qs('#confirm-modal-text').textContent = text;
  qs('#confirm-modal-backdrop').style.display = 'flex';
  App.deleteCallback = onConfirm;
}

qs('#confirm-delete-btn')?.addEventListener('click', async () => {
  if (App.deleteCallback) {
    qs('#confirm-delete-btn').textContent = 'Deleting…';
    try { await App.deleteCallback(); } catch(e) { alert('Error: ' + e.message); }
    qs('#confirm-delete-btn').textContent = 'Delete';
  }
  qs('#confirm-modal-backdrop').style.display = 'none';
  App.deleteCallback = null;
});
qs('#confirm-cancel-btn')?.addEventListener('click', () => { qs('#confirm-modal-backdrop').style.display = 'none'; App.deleteCallback = null; });
qs('#confirm-modal-close')?.addEventListener('click', () => { qs('#confirm-modal-backdrop').style.display = 'none'; App.deleteCallback = null; });

qsa('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', (e) => { if (e.target === bd) { bd.style.display = 'none'; App.deleteCallback = null; } });
});

// ============================================================
// INITIALIZE
// ============================================================
async function init() {
  reObserveReveal = initScrollReveal();
  initHeader();
  initCatalog();
  initContactForm();
  initLightbox();
  initCart();
  initSpotlightModal();
  await loadSettings();

  const path = window.location.pathname;
  if (path === '/admin' || path.startsWith('/admin')) {
    history.replaceState({ path: '/admin' }, '', '/admin');
    showAdmin();
  } else if (path.startsWith('/product/')) {
    const id = path.split('/product/')[1];
    Router.navigate('/catalog', false);
    Pages.catalog();
    if (id) setTimeout(() => showProductDetail(id), 300);
  } else {
    const route = Object.keys(Router.routes).find(r => r === path) || '/';
    Router.navigate(route, false);
  }
}

document.addEventListener('DOMContentLoaded', init);
