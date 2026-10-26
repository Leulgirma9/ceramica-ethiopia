/* ============================================================
   CERAMICA ETHIOPIA — Main Application JS
   SPA router, API client, admin dashboard
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
  img: (url, fallbackEmoji = '🪟') => {
    if (!url) return `<div class="product-card-placeholder">${fallbackEmoji}</div>`;
    return `<img src="${url}" alt="" loading="lazy" />`;
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

// ============================================================
// SPA ROUTER
// ============================================================
const Router = {
  routes: {
    '/':            'home',
    '/catalog':     'catalog',
    '/categories':  'categories',
    '/about':       'about',
    '/contact':     'contact',
    '/price-list':  'price-list',
    '/product':     'product',
    '/admin':       'admin',
  },
  navigate(path, pushState = true) {
    // Close menus
    qs('#mobile-menu').classList.remove('open');
    qs('#menu-toggle').classList.remove('open');
    qs('#search-bar').classList.remove('open');

    if (path === '/admin') { showAdmin(); return; }

    const page = Router.routes[path] || 'home';

    // Update nav active states
    qsa('.nav-link').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === path);
    });

    // Show page
    qsa('.page').forEach(p => p.classList.remove('active'));
    const pageEl = qs('#page-' + (page === 'price-list' ? 'price-list' : page));
    if (pageEl) pageEl.classList.add('active');

    if (pushState) history.pushState({ path }, '', path);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    App.currentPage = page;
    Pages[page]?.();
  },
};

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
  const path = e.state?.path || window.location.pathname;
  Router.navigate(path, false);
});

// Intercept all internal links
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
    renderHomeCategories();
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

    // Price filter
    if (filters.priceMin) products = products.filter(p => p.price >= filters.priceMin);
    if (filters.priceMax) products = products.filter(p => p.price <= filters.priceMax);

    // Sort
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

  // Populate category filter
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

  // Contact info in footer
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
        <span class="product-card-price">${fmt.price(p.price, p.price_currency)}</span>
        <span class="product-card-unit">/ ${p.unit}</span>
      </div>
    </div>
  `;
  card.addEventListener('click', () => showProductDetail(p.id));
  return card;
}

function renderHomeCategories() {
  const grid = qs('#home-categories-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const toShow = App.categories.slice(0, 6);
  toShow.forEach(c => {
    const card = el('div', { class: 'category-card' });
    const imgPart = c.image_url
      ? `<img src="${c.image_url}" alt="${c.name}" loading="lazy" />`
      : `<div class="category-card-placeholder">${getCatEmoji(c.slug)}</div>`;
    card.innerHTML = `
      ${imgPart}
      <div class="category-card-overlay">
        <div class="category-card-name">${c.name}</div>
        <div class="category-card-count">${c.product_count} product${c.product_count !== 1 ? 's' : ''}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      Router.navigate('/catalog');
      setTimeout(() => filterCatalogBySlug(c.slug), 100);
    });
    grid.appendChild(card);
  });
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
  // Remove old dynamic buttons
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

  // Admin product category filter
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

async function showProductDetail(id) {
  try {
    const p = await api.get('/products/' + id);
    const container = qs('#product-detail-content');
    const images = JSON.parse(p.images || '[]');
    const mainImg = p.image_url || (images[0] || '');

    const specs = [
      ['Size', p.size], ['Material', p.material], ['Finish', p.finish],
      ['Color', p.color], ['Thickness', p.thickness], ['Origin', p.origin],
      ['Unit', p.unit],
    ].filter(([, v]) => v);

    container.innerHTML = `
      <div class="product-images-col">
        ${mainImg
          ? `<img src="${mainImg}" alt="${p.name}" class="product-main-img" id="product-main-img" />`
          : `<div class="product-img-placeholder">🪟</div>`}
        ${images.length > 1 ? `
          <div class="product-thumb-row">
            ${images.map((img, i) => `<img src="${img}" class="product-thumb${i===0?' active':''}" alt="" data-full="${img}" />`).join('')}
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
          <a href="/contact" class="btn-primary" id="product-inquire-btn">Inquire About This Product</a>
          <a href="/price-list" class="btn-secondary" id="product-pricelist-btn">View Price List</a>
        </div>
      </div>
    `;

    // Thumbnail click handler
    qsa('.product-thumb', container).forEach(thumb => {
      thumb.addEventListener('click', () => {
        const main = qs('#product-main-img');
        if (main) main.src = thumb.dataset.full;
        qsa('.product-thumb', container).forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });

    // Breadcrumb clicks
    container.querySelectorAll('a[href]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        Router.navigate(a.getAttribute('href'));
      });
    });

    Router.navigate('/product', false);
    history.pushState({ path: '/product', id }, p.name, '/product/' + id);
    qs('#page-product').classList.add('active');
    qsa('.page').forEach(p2 => { if (p2.id !== 'page-product') p2.classList.remove('active'); });
    window.scrollTo({ top: 0 });
  } catch(e) { console.error('Product load error', e); }
}

function applySettings() {
  const s = App.settings;
  if (!s || !Object.keys(s).length) return;

  // Logo
  const logoEls = qsa('#logo-display, #footer-logo-text, #footer-company-name');
  logoEls.forEach(el => { if (el) el.textContent = s.company_name || 'Ceramica Ethiopia'; });

  // If logo image set
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

  // Hero
  const htEl = qs('#hero-title-el'); if (htEl) htEl.textContent = s.hero_title || 'Elevate Every Space';
  const hsEl = qs('#hero-subtitle-el'); if (hsEl) hsEl.innerHTML = (s.hero_subtitle || '').replace('\n', '<br>');
  if (s.hero_image_url) {
    const hImg = qs('#hero-img'); if (hImg) hImg.src = s.hero_image_url;
  }

  // Tagline
  const tl = qs('#footer-tagline'); if (tl) tl.textContent = s.company_tagline || '';

  // Contact
  const addr = s.company_address || '';
  const phone = s.company_phone || '';
  const email = s.company_email || '';
  const hours = s.working_hours || '';

  const addrEls = qsa('#contact-address-el'); addrEls.forEach(e => { if(e) e.childNodes[e.childNodes.length-1].textContent = ' ' + addr; });
  const phoneEls = qsa('#contact-phone-el'); phoneEls.forEach(e => { if(e) e.childNodes[e.childNodes.length-1].textContent = ' ' + phone; });
  const hoursEls = qsa('#contact-hours-el'); hoursEls.forEach(e => { if(e) e.childNodes[e.childNodes.length-1].textContent = ' ' + hours; });

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
    const el = qs('#about-desc-el'); if (el) el.textContent = s.company_description;
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

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ============================================================
// HEADER BEHAVIOR
// ============================================================
function initHeader() {
  // Scroll shadow
  window.addEventListener('scroll', () => {
    qs('#site-header').classList.toggle('scrolled', window.scrollY > 20);
  });

  // Mobile menu
  qs('#menu-toggle').addEventListener('click', () => {
    const open = !qs('#mobile-menu').classList.contains('open');
    qs('#mobile-menu').classList.toggle('open', open);
    qs('#menu-toggle').classList.toggle('open', open);
  });

  // Search
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
    // Simulate send (no backend email in this demo)
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

    // Wire edit/delete
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

// Product search/filter in admin
qs('#admin-product-search')?.addEventListener('input', debounce(loadAdminProducts, 400));
qs('#admin-product-cat-filter')?.addEventListener('change', loadAdminProducts);

// ============================================================
// ADMIN — PRODUCT FORM MODAL
// ============================================================
function openProductModal(title) {
  qs('#product-modal-title').textContent = title;
  qs('#product-modal-backdrop').style.display = 'flex';
  qs('#product-form-error').textContent = '';
  // Populate category select
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

    // Show existing images
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
    // Refresh public data
    App.products = [];
    App.categories = [];
  } catch(err) {
    errEl.textContent = err.message || 'Save failed';
  } finally {
    saveBtn.textContent = 'Save Product';
    saveBtn.disabled = false;
  }
});

// Image preview
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
    // Main settings
    const fd = new FormData(qs('#settings-form'));
    const logoFile = qs('#s-logo')?.files[0];
    if (logoFile) fd.set('logo', logoFile);
    await api.put('/settings', fd, true);

    // Hero image separately if set
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

// Close modals on backdrop click
qsa('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', (e) => { if (e.target === bd) { bd.style.display = 'none'; App.deleteCallback = null; } });
});

// ============================================================
// INITIALIZE
// ============================================================
async function init() {
  initHeader();
  initCatalog();
  initContactForm();
  await loadSettings();

  // Determine initial route
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
