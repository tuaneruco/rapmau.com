const CMS_OVERRIDE_KEY = 'rapmau_cms_catalog_override_v4';
const ADMIN_SESSION_KEY = 'rapmau_admin_auth_session_v2';
const ADMIN_CUSTOM_CRED_KEY = 'rapmau_admin_custom_cred';
const DEFAULT_ADMIN_USERS = ['admin', 'tuaneruco'];
const DEFAULT_ADMIN_PASS_PLAIN = 'Rapmau@2026';

const DEFAULT_VENDORS_FALLBACK = [
  {
    id: 'vendor-admin',
    vendorId: 'all',
    vendorName: 'Quản Trị Tổng RAPMAU.COM (Mr.Tuan)',
    username: 'admin',
    plainPassDefault: 'Rapmau@2026',
    role: 'super_admin',
    skuPrefix: 'RM',
    phone: '0971.463.768',
    website: 'https://www.rapmau.com',
    allowPatterns: true,
    allowTools: true,
    active: true
  },
  {
    id: 'vendor-phukien',
    vendorId: 'phukienlamdoda',
    vendorName: 'Phụ Kiện Làm Đồ Da',
    username: 'phukienlamdoda',
    plainPassDefault: 'Phukien@2026',
    role: 'vendor',
    skuPrefix: 'PK',
    phone: '0938.369.234',
    website: 'https://phukienlamdoda.com',
    allowPatterns: false,
    allowTools: true,
    active: true
  },
  {
    id: 'vendor-dathung',
    vendorId: 'dathungleather',
    vendorName: 'Đạt Hưng Leather',
    username: 'dathungleather',
    plainPassDefault: 'Dathung@2026',
    role: 'vendor',
    skuPrefix: 'DH',
    phone: '0936.298.765',
    website: 'https://shopee.vn/dathungleather',
    allowPatterns: false,
    allowTools: true,
    active: true
  },
  {
    id: 'vendor-rapmau',
    vendorId: 'rapmau',
    vendorName: 'Xưởng RAPMAU.COM',
    username: 'xuongrapmau',
    plainPassDefault: 'Xuong@2026',
    role: 'vendor',
    skuPrefix: 'DC',
    phone: '0971.463.768',
    website: 'https://www.rapmau.com',
    allowPatterns: true,
    allowTools: true,
    active: true
  }
];

const adminState = {
  catalog: null,
  products: [],
  categories: [],
  accessories: [],
  freeBooks: [],
  articles: [],
  vendors: [],
  orders: [],
  consultations: [],
  selectedCat: 'all',
  searchQuery: '',
  selectedToolVendor: 'all',
  selectedToolCat: 'all',
  toolSearchQuery: '',
  selectedPatternSkus: new Set(),
  selectedToolIds: new Set(),
  isLocalBackend: false
};

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(Number(amount) || 0) + 'đ';
}

function showToast(msg, isError = false) {
  const el = document.getElementById('adminToast');
  if (!el) return;
  el.textContent = msg || '✅ Đã lưu thay đổi thành công!';
  el.style.background = isError ? '#b91c1c' : '#15803d';
  el.classList.remove('hidden');
  clearTimeout(window.__adminToastTimer);
  window.__adminToastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

async function sha256HexBrowser(text) {
  if (window.crypto && window.crypto.subtle) {
    const buf = new TextEncoder().encode(String(text));
    const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return String(text);
}

function getAuthSession() {
  try {
    const raw =
      localStorage.getItem(ADMIN_SESSION_KEY) ||
      sessionStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAuthSession(sessionData, remember = true) {
  const payload = JSON.stringify({
    ...sessionData,
    loggedAt: new Date().toISOString()
  });
  if (remember) {
    localStorage.setItem(ADMIN_SESSION_KEY, payload);
  } else {
    sessionStorage.setItem(ADMIN_SESSION_KEY, payload);
  }
}

function clearAuthSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function isVendorSession() {
  const sess = getAuthSession();
  return Boolean(sess && sess.role === 'vendor' && sess.vendorId && sess.vendorId !== 'all');
}

function getActiveVendorId() {
  const sess = getAuthSession();
  if (sess && sess.role === 'vendor' && sess.vendorId && sess.vendorId !== 'all') {
    return sess.vendorId;
  }
  return null;
}

function getAuthHeaders() {
  const sess = getAuthSession();
  return {
    'Content-Type': 'application/json',
    ...(sess?.token ? { 'x-admin-token': sess.token } : {})
  };
}

function inferItemVendorId(item) {
  if (item.vendorId) return item.vendorId;
  const sku = String(item.sku || '').toUpperCase();
  const id = String(item.id || '').toLowerCase();
  if (sku.startsWith('DH-') || id.startsWith('dh-')) return 'dathungleather';
  if (sku.startsWith('PK-') || id.startsWith('pk-')) return 'phukienlamdoda';
  return 'rapmau';
}

function inferItemVendorName(item) {
  if (item.vendorName) return item.vendorName;
  const vid = inferItemVendorId(item);
  const found = adminState.vendors.find((v) => v.vendorId === vid);
  if (found) return found.vendorName;
  if (vid === 'dathungleather') return 'Đạt Hưng Leather';
  if (vid === 'phukienlamdoda') return 'Phụ Kiện Làm Đồ Da';
  return 'Xưởng RAPMAU.COM';
}

function safeMediaUrl(rawUrl, fallback = '/assets/tools/pattern-placeholder.svg') {
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed) return fallback;
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  const nfc = typeof trimmed.normalize === 'function' ? trimmed.normalize('NFC') : trimmed;
  try {
    return encodeURI(decodeURI(nfc));
  } catch {
    return encodeURI(nfc);
  }
}

function openRapmauIdb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      resolve(null);
      return;
    }
    const req = window.indexedDB.open('rapmau_cms_db', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cms_state')) {
        db.createObjectStore('cms_state');
      }
      if (!db.objectStoreNames.contains('uploaded_files')) {
        db.createObjectStore('uploaded_files');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(storeName, key) {
  try {
    const db = await openRapmauIdb();
    if (!db) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(storeName, key, value) {
  try {
    const db = await openRapmauIdb();
    if (!db) return false;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB save warning:', err);
    return false;
  }
}

function syncCatalogStatsAndPersistLocal() {
  if (!adminState.catalog) return;
  adminState.catalog.products = adminState.products;
  adminState.catalog.accessories = adminState.accessories;
  adminState.catalog.freeBooks = adminState.freeBooks;
  adminState.catalog.vendors = adminState.vendors;
  adminState.catalog._localUpdatedAt = Date.now();

  const counts = {};
  for (const p of adminState.products) {
    counts[p.categoryKey] = (counts[p.categoryKey] || 0) + 1;
  }
  for (const c of adminState.categories) {
    c.count = counts[c.key] || 0;
  }
  adminState.catalog.categories = adminState.categories;

  if (adminState.catalog.stats) {
    adminState.catalog.stats.totalPatterns = adminState.products.length;
    adminState.catalog.stats.freePatternsCount = adminState.products.filter((p) => p.isFreePdf).length;
    adminState.catalog.stats.totalToolsAndAccessories = adminState.accessories.length;
    adminState.catalog.stats.freeBooksCount = adminState.freeBooks.length;
  }

  // 1. Lưu không giới hạn dung lượng vào IndexedDB
  idbSet('cms_state', 'catalog_override', adminState.catalog);

  // 2. Lưu đồng thời vào localStorage để đồng bộ tức thì
  try {
    localStorage.setItem(CMS_OVERRIDE_KEY, JSON.stringify(adminState.catalog));
  } catch (e) {
    console.warn('LocalStorage đạt ngưỡng 5MB, dữ liệu đã được lưu an toàn vào IndexedDB:', e);
  }
}

async function verifyAdminCredentials(username, password) {
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  // 1. Thử xác thực qua API Server (nếu đang chạy server.mjs)
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUser, password: cleanPass })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        adminState.isLocalBackend = true;
        return {
          ok: true,
          username: data.username || cleanUser,
          role: data.role || 'super_admin',
          vendorId: data.vendorId || 'all',
          vendorName: data.vendorName || 'Quản Trị Tổng RAPMAU.COM',
          allowPatterns: data.allowPatterns !== false,
          allowTools: data.allowTools !== false,
          token: data.token
        };
      }
    } else if (res.status === 401) {
      const errData = await res.json().catch(() => ({}));
      return { ok: false, error: errData.error || 'Sai tài khoản hoặc mật khẩu đăng nhập!' };
    }
  } catch {
    // Offline / Cloudflare static mode
  }

  // 2. Xác thực trực tiếp trên trình duyệt (Cloudflare Pages static mode)
  const inputHash = await sha256HexBrowser(cleanPass);

  // Kiểm tra danh sách Nhà cung cấp & Admin trong adminState.vendors
  const vendorList =
    adminState.vendors && adminState.vendors.length
      ? adminState.vendors
      : DEFAULT_VENDORS_FALLBACK;

  for (const v of vendorList) {
    if (v.active === false) continue;
    if (String(v.username || '').toLowerCase() === cleanUser) {
      const expectedHash =
        v.passwordHash ||
        (v.plainPassDefault ? await sha256HexBrowser(v.plainPassDefault) : '');
      if (inputHash === expectedHash || cleanPass === v.plainPassDefault) {
        return {
          ok: true,
          username: v.username,
          role: v.role || 'vendor',
          vendorId: v.vendorId || 'rapmau',
          vendorName: v.vendorName || v.username,
          allowPatterns: Boolean(v.allowPatterns),
          allowTools: v.allowTools !== false,
          token: inputHash
        };
      }
      return { ok: false, error: 'Sai mật khẩu của tài khoản Nhà cung cấp / Quản trị!' };
    }
  }

  // Kiểm tra tài khoản Super Admin dự phòng
  const customCredRaw = localStorage.getItem(ADMIN_CUSTOM_CRED_KEY);
  if (customCredRaw) {
    try {
      const customCred = JSON.parse(customCredRaw);
      const validUser =
        cleanUser === String(customCred.username || 'admin').toLowerCase() ||
        DEFAULT_ADMIN_USERS.includes(cleanUser);
      if (validUser && inputHash === customCred.passwordHash) {
        return {
          ok: true,
          username: customCred.username || cleanUser,
          role: 'super_admin',
          vendorId: 'all',
          vendorName: 'Quản Trị Tổng RAPMAU.COM',
          allowPatterns: true,
          allowTools: true,
          token: inputHash
        };
      }
    } catch {
      // ignore
    }
  }

  const defaultHash = await sha256HexBrowser(DEFAULT_ADMIN_PASS_PLAIN);
  if (DEFAULT_ADMIN_USERS.includes(cleanUser) && inputHash === defaultHash) {
    return {
      ok: true,
      username: cleanUser,
      role: 'super_admin',
      vendorId: 'all',
      vendorName: 'Quản Trị Tổng RAPMAU.COM',
      allowPatterns: true,
      allowTools: true,
      token: defaultHash
    };
  }

  return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu!' };
}

function activateTab(tabId) {
  document.querySelectorAll('#adminTabNav .admin-nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.admin-tab-panel').forEach((p) => {
    p.classList.toggle('hidden', p.id !== tabId);
  });
}

function applyRolePermissionsToUI() {
  const sess = getAuthSession();
  if (!sess) return;

  const isVendor = isVendorSession();
  const userBadge = document.getElementById('adminUserBadge');
  const modeIndicator = document.getElementById('localModeIndicator');
  const navBtnPatterns = document.getElementById('navBtnPatterns');
  const navBtnTools = document.getElementById('navBtnTools');
  const navBtnVendors = document.getElementById('navBtnVendors');
  const navBtnBooks = document.getElementById('navBtnBooks');
  const navBtnArticles = document.getElementById('navBtnArticles');
  const navBtnB2b = document.getElementById('navBtnB2b');
  const fullSiteSettingsForm = document.getElementById('fullSiteSettingsForm');
  const adminLeadsCard = document.getElementById('adminLeadsCard');
  const vendorFilterSel = document.getElementById('adminToolVendorFilter');
  const toolFormVendorRow = document.getElementById('toolFormVendorRow');
  const pwdNewUsername = document.getElementById('pwdNewUsername');

  if (userBadge) {
    userBadge.textContent = isVendor ? `${sess.vendorName}` : `${sess.username} (Admin Tổng)`;
  }
  if (modeIndicator) {
    modeIndicator.textContent = isVendor
      ? `🏢 Nhà Cung Cấp: ${sess.vendorName}`
      : `👑 Quản Trị Tổng (${sess.username})`;
    modeIndicator.style.background = isVendor ? '#fef3c7' : '#dcfce7';
    modeIndicator.style.color = isVendor ? '#92400e' : '#166534';
  }
  if (pwdNewUsername) {
    pwdNewUsername.value = sess.username || 'admin';
    pwdNewUsername.readOnly = isVendor;
  }

  if (isVendor) {
    // Khoá bộ lọc Nhà cung cấp đúng vào vendorId của tài khoản đang đăng nhập
    adminState.selectedToolVendor = sess.vendorId;
    if (vendorFilterSel) {
      vendorFilterSel.value = sess.vendorId;
      vendorFilterSel.disabled = true;
    }
    if (toolFormVendorRow) toolFormVendorRow.classList.add('hidden');
    if (navBtnVendors) navBtnVendors.classList.add('hidden');
    if (navBtnBooks) navBtnBooks.classList.add('hidden');
    if (navBtnArticles) navBtnArticles.classList.add('hidden');
    if (navBtnB2b) navBtnB2b.classList.add('hidden');
    if (fullSiteSettingsForm) fullSiteSettingsForm.classList.add('hidden');
    if (adminLeadsCard) adminLeadsCard.classList.add('hidden');

    const navToolsLabel = document.getElementById('navToolsLabel');
    if (navToolsLabel) navToolsLabel.textContent = `🛠️ Sản Phẩm Của ${sess.vendorName}`;
    const navOrdersLabel = document.getElementById('navOrdersLabel');
    if (navOrdersLabel) navOrdersLabel.textContent = `📦 Đơn Hàng Của ${sess.vendorName}`;
    const navSettingsLabel = document.getElementById('navSettingsLabel');
    if (navSettingsLabel) navSettingsLabel.textContent = '🔑 Đổi Mật Khẩu Nhà Cung Cấp';

    if (!sess.allowPatterns) {
      if (navBtnPatterns) navBtnPatterns.classList.add('hidden');
      activateTab('tab-tools');
    } else {
      if (navBtnPatterns) navBtnPatterns.classList.remove('hidden');
      activateTab('tab-patterns');
    }
  } else {
    // Super Admin
    adminState.selectedToolVendor = 'all';
    if (vendorFilterSel) {
      vendorFilterSel.disabled = false;
      vendorFilterSel.value = 'all';
    }
    if (toolFormVendorRow) toolFormVendorRow.classList.remove('hidden');
    if (navBtnPatterns) navBtnPatterns.classList.remove('hidden');
    if (navBtnTools) navBtnTools.classList.remove('hidden');
    if (navBtnVendors) navBtnVendors.classList.remove('hidden');
    if (navBtnBooks) navBtnBooks.classList.remove('hidden');
    if (navBtnArticles) navBtnArticles.classList.remove('hidden');
    if (navBtnB2b) navBtnB2b.classList.remove('hidden');
    if (fullSiteSettingsForm) fullSiteSettingsForm.classList.remove('hidden');
    if (adminLeadsCard) adminLeadsCard.classList.remove('hidden');

    const navToolsLabel = document.getElementById('navToolsLabel');
    if (navToolsLabel) navToolsLabel.textContent = '🛠️ Quản Lý Dụng Cụ & Phụ Kiện';
    const navOrdersLabel = document.getElementById('navOrdersLabel');
    if (navOrdersLabel) navOrdersLabel.textContent = '📦 Đơn Hàng & Zalo Leads';
    const navSettingsLabel = document.getElementById('navSettingsLabel');
    if (navSettingsLabel) navSettingsLabel.textContent = '⚙️ Nội Dung, VietQR & Mật Khẩu';
  }

  renderKPIs();
  populateVendorSelects();
  renderPatternsTable();
  renderToolsTable();
  renderOrdersAndLeads();
  renderVendorsTable();
}

function setupLoginGate() {
  const overlay = document.getElementById('adminLoginOverlay');
  const form = document.getElementById('adminLoginForm');
  const errBox = document.getElementById('loginErrorBox');
  const userInput = document.getElementById('loginUsernameInput');
  const pwdInput = document.getElementById('loginPasswordInput');
  const toggleBtn = document.getElementById('toggleShowPwdBtn');

  if (toggleBtn && pwdInput) {
    toggleBtn.addEventListener('click', () => {
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      toggleBtn.textContent = isPwd ? '🙈 Ẩn' : '👁️ Hiện';
    });
  }

  // Nút chọn nhanh tên tài khoản mẫu
  document.querySelectorAll('[data-quick-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      userInput.value = btn.dataset.quickUser;
      pwdInput.focus();
    });
  });

  const existing = getAuthSession();
  if (existing && existing.token) {
    overlay.classList.add('hidden');
  } else {
    overlay.classList.remove('hidden');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    const username = userInput.value.trim();
    const password = pwdInput.value;
    const remember = document.getElementById('loginRememberChk').checked;

    const result = await verifyAdminCredentials(username, password);
    if (!result.ok) {
      errBox.textContent = `❌ ${result.error}`;
      errBox.classList.remove('hidden');
      return;
    }

    setAuthSession(result, remember);
    overlay.classList.add('hidden');
    applyRolePermissionsToUI();
    showToast(
      result.role === 'vendor'
        ? `🏢 Xin chào Nhà cung cấp: ${result.vendorName}!`
        : `👑 Xin chào Quản trị viên tổng: ${result.username}!`
    );
  });

  const logoutBtn = document.getElementById('btnAdminLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuthSession();
      pwdInput.value = '';
      overlay.classList.remove('hidden');
      showToast('🔒 Đã đăng xuất tài khoản');
    });
  }
}

function normalizeCatalogTreeNFC(obj) {
  if (!obj) return obj;
  try {
    const raw = JSON.stringify(obj);
    return JSON.parse(typeof raw.normalize === 'function' ? raw.normalize('NFC') : raw);
  } catch {
    return obj;
  }
}

async function initAdmin() {
  let catData = null;
  let admData = { orders: [], consultations: [] };
  const isLocalHost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isLocalHost) {
    try {
      const [catRes, admRes] = await Promise.all([
        fetch('/api/catalog'),
        fetch('/api/admin-data')
      ]);
      if (catRes.ok && admRes.ok) {
        const admContentType = admRes.headers.get('content-type') || '';
        if (admContentType.includes('application/json')) {
          catData = await catRes.json();
          admData = await admRes.json();
          adminState.isLocalBackend = true;
        }
      }
    } catch {
      // fallback to static
    }
  }

  if (!catData) {
    const staticRes = await fetch('/data/catalog.json');
    catData = await staticRes.json();
  }

  catData = normalizeCatalogTreeNFC(catData);

  // Đọc dữ liệu đã lưu từ IndexedDB (ưu tiên vì không giới hạn 5MB) hoặc LocalStorage
  let savedOverride = await idbGet('cms_state', 'catalog_override');
  if (!savedOverride) {
    const rawLocal = localStorage.getItem(CMS_OVERRIDE_KEY);
    if (rawLocal) {
      try {
        savedOverride = JSON.parse(rawLocal);
      } catch {
        // ignore
      }
    }
  }

  if (savedOverride && !adminState.isLocalBackend) {
    savedOverride = normalizeCatalogTreeNFC(savedOverride);
    // Giữ nguyên các sản phẩm/danh mục mới từ bản build tĩnh nhưng ưu tiên toàn bộ chỉnh sửa của Admin
    const overrideProdMap = new Map(
      (savedOverride.products || []).map((p) => [p.sku, p])
    );
    const mergedProducts = [];
    const seenSkus = new Set();

    // Giữ thứ tự và các mẫu mới thêm trong savedOverride
    for (const p of savedOverride.products || []) {
      if (p && p.sku) {
        mergedProducts.push(p);
        seenSkus.add(p.sku);
      }
    }
    // Nếu có sản phẩm nào trong static chưa có và chưa bị xoá chủ đích
    const deletedSkus = new Set(savedOverride._deletedPatternSkus || []);
    for (const staticProd of catData.products || []) {
      if (staticProd && staticProd.sku && !seenSkus.has(staticProd.sku) && !deletedSkus.has(staticProd.sku)) {
        mergedProducts.push(staticProd);
      } else if (staticProd && staticProd.sku && overrideProdMap.has(staticProd.sku)) {
        // Nếu bản lưu cũ bị lỗi đường dẫn NFD hoặc thiếu ảnh gốc, tự động đồng bộ đường dẫn NFC chuẩn nếu chưa sửa ảnh
        const cur = overrideProdMap.get(staticProd.sku);
        if (!cur._editedAt) {
          cur.images = staticProd.images;
          cur.pdfFiles = staticProd.pdfFiles;
          cur.pdfFileNames = staticProd.pdfFileNames;
        }
      }
    }

    catData = {
      ...catData,
      ...savedOverride,
      products: mergedProducts
    };
  } else if (adminState.isLocalBackend) {
    idbSet('cms_state', 'catalog_override', catData);
    try {
      localStorage.setItem(CMS_OVERRIDE_KEY, JSON.stringify(catData));
    } catch {
      // ignore
    }
  }

  // Gộp thêm đơn hàng lưu trên trình duyệt (nếu có)
  const localOrders = JSON.parse(localStorage.getItem('rapmau_local_orders') || '[]');
  const orderMap = new Map();
  for (const o of [...(admData.orders || []), ...localOrders]) {
    if (o && o.orderCode && !orderMap.has(o.orderCode)) {
      orderMap.set(o.orderCode, o);
    }
  }

  adminState.catalog = catData;
  adminState.products = catData.products || [];
  adminState.categories = catData.categories || [];
  adminState.accessories = catData.accessories || [];
  adminState.freeBooks = catData.freeBooks || [];
  adminState.articles = catData.articles || [];
  adminState.b2b = catData.b2b || {};
  adminState.vendors =
    catData.vendors && catData.vendors.length ? catData.vendors : DEFAULT_VENDORS_FALLBACK;
  adminState.orders = Array.from(orderMap.values());
  adminState.consultations = admData.consultations || [];

  setupLoginGate();
  populateCategorySelects();
  populateVendorSelects();
  renderKPIs();
  renderPatternsTable();
  renderToolsTable();
  renderBooksTable();
  renderArticlesTable();
  renderB2bArticlesTable();
  populateB2bSectionsForm();
  renderOrdersAndLeads();
  renderVendorsTable();
  populateSiteSettings();
  applyRolePermissionsToUI();
  bindAdminEvents();

  // Deep link ?tab=tab-b2b hoặc #tab-b2b
  const urlTab = new URLSearchParams(window.location.search).get('tab') || (window.location.hash || '').replace(/^#/, '');
  if (urlTab && document.getElementById(urlTab)) {
    activateTab(urlTab);
  }
}

function getOrdersForCurrentRole() {
  const vendorId = getActiveVendorId();
  if (!vendorId) return adminState.orders;
  return adminState.orders.filter((o) =>
    (o.items || []).some((it) => inferItemVendorId(it) === vendorId)
  );
}

function renderKPIs() {
  const vendorId = getActiveVendorId();
  const visiblePatterns = vendorId
    ? adminState.products.filter((p) => (p.vendorId || 'rapmau') === vendorId)
    : adminState.products;
  const visibleTools = vendorId
    ? adminState.accessories.filter((a) => inferItemVendorId(a) === vendorId)
    : adminState.accessories;
  const visibleOrders = getOrdersForCurrentRole();

  const freeCount = visiblePatterns.filter((p) => p.isFreePdf).length;
  document.getElementById('kpiTotalPatterns').textContent = visiblePatterns.length;
  document.getElementById('kpiFreePatterns').textContent = freeCount;
  const kpiTools = document.getElementById('kpiToolsCount');
  if (kpiTools) kpiTools.textContent = `${visibleTools.length} món`;
  document.getElementById('kpiBooks').textContent = `${adminState.freeBooks.length} cuốn`;
  document.getElementById('kpiOrders').textContent = vendorId
    ? visibleOrders.length
    : visibleOrders.length + adminState.consultations.length;

  document.getElementById('sideCountPatterns').textContent = visiblePatterns.length;
  document.getElementById('sideCountOrders').textContent = vendorId
    ? visibleOrders.length
    : visibleOrders.length + adminState.consultations.length;
  document.getElementById('sideCountTools').textContent = visibleTools.length;
  document.getElementById('sideCountBooks').textContent = adminState.freeBooks.length;
  const sideVendors = document.getElementById('sideCountVendors');
  if (sideVendors) sideVendors.textContent = adminState.vendors.filter((v) => v.role === 'vendor').length;
  const sideArticles = document.getElementById('sideCountArticles');
  if (sideArticles) sideArticles.textContent = (adminState.articles || []).length;
  const sideB2b = document.getElementById('sideCountB2bArticles');
  if (sideB2b) sideB2b.textContent = ((adminState.catalog?.b2b?.articles) || []).length;

  const site = adminState.catalog.site || {};
  document.getElementById('topHotlineText').textContent =
    site.hotline || '0971.463.768 (Mr.Tuan)';
  document.getElementById('topEmailText').textContent = site.email || 'info@rapmau.com';
}

function populateVendorSelects() {
  const vendorFilter = document.getElementById('adminToolVendorFilter');
  const formVendorSel = document.getElementById('toolFormVendorSelect');
  const lockedVendorId = getActiveVendorId();

  const vendorCounts = {};
  for (const a of adminState.accessories) {
    const vid = inferItemVendorId(a);
    vendorCounts[vid] = (vendorCounts[vid] || 0) + 1;
  }

  const vendorEntries = adminState.vendors.filter((v) => v.vendorId && v.vendorId !== 'all');

  if (vendorFilter) {
    let html = `<option value="all">🏢 Tất cả Nhà Cung Cấp (${adminState.accessories.length} SP)</option>`;
    for (const v of vendorEntries) {
      const cnt = vendorCounts[v.vendorId] || 0;
      html += `<option value="${v.vendorId}">🏢 ${v.vendorName} (${cnt} SP)</option>`;
    }
    vendorFilter.innerHTML = html;
    vendorFilter.value = lockedVendorId || adminState.selectedToolVendor || 'all';
    vendorFilter.disabled = Boolean(lockedVendorId);
  }

  if (formVendorSel) {
    formVendorSel.innerHTML = vendorEntries
      .map((v) => `<option value="${v.vendorId}">${v.vendorName} (${v.vendorId})</option>`)
      .join('');
    if (lockedVendorId) {
      formVendorSel.value = lockedVendorId;
    }
  }
}

function populateCategorySelects() {
  const filterSel = document.getElementById('adminCatFilter');
  const bulkSel = document.getElementById('bulkCategorySelect');
  const newPatSel = document.getElementById('newPatCategory');

  let opts = `<option value="all">Tất cả ${adminState.categories.length} danh mục (${adminState.products.length} mẫu)</option>`;
  let singleOpts = '';
  for (const c of adminState.categories) {
    opts += `<option value="${c.key}">${c.shortName} (${c.count} mẫu)</option>`;
    singleOpts += `<option value="${c.key}">${c.shortName}</option>`;
  }
  const prevFilter = filterSel.value || 'all';
  filterSel.innerHTML = opts;
  filterSel.value = prevFilter;
  bulkSel.innerHTML = opts;
  if (newPatSel) newPatSel.innerHTML = singleOpts;

  bulkSel.onchange = () => {
    const cat = adminState.categories.find((x) => x.key === bulkSel.value);
    if (cat && cat.basePrices) {
      document.getElementById('bulkPdfPrice').value = cat.basePrices.pdf ?? 0;
      document.getElementById('bulkPaperPrice').value = cat.basePrices.paper ?? 55000;
      document.getElementById('bulkMicaPrice').value = cat.basePrices.mica ?? 135000;
      document.getElementById('bulkDiePrice').value = cat.basePrices.die ?? 450000;
    }
  };
}

function updateSelectedPatternsCounter() {
  const el = document.getElementById('selectedPatternsCount');
  if (el) el.textContent = adminState.selectedPatternSkus.size;
}

function updateSelectedToolsCounter() {
  const el = document.getElementById('selectedToolsCount');
  if (el) el.textContent = adminState.selectedToolIds.size;
}

function getFilteredPatterns() {
  const q = adminState.searchQuery.trim().toLowerCase();
  const lockedVendorId = getActiveVendorId();
  return adminState.products.filter((p) => {
    if (lockedVendorId && (p.vendorId || 'rapmau') !== lockedVendorId) return false;
    if (adminState.selectedCat !== 'all' && p.categoryKey !== adminState.selectedCat) return false;
    if (q) {
      const hay = `${p.sku} ${p.title} ${p.categoryShort} ${p.folderPath || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderPatternsTable() {
  const tbody = document.getElementById('adminProductsTableBody');
  const filtered = getFilteredPatterns();
  document.getElementById('adminFilteredCount').textContent = filtered.length;

  tbody.innerHTML = filtered
    .map((p) => {
      const vMap = {};
      for (const v of p.variants || []) vMap[v.id] = v.price;
      const thumb = safeMediaUrl((p.images && p.images[0]) || p.primaryImage || '/assets/tools/pattern-placeholder.svg');
      const checked = adminState.selectedPatternSkus.has(p.sku) ? 'checked' : '';

      return `
        <tr data-row-sku="${p.sku}">
          <td style="text-align:center;">
            <input type="checkbox" class="chk-row pat-row-chk" data-check-sku="${p.sku}" ${checked} />
          </td>
          <td>
            <img src="${thumb}" alt="${p.sku}" onerror="this.onerror=null;this.src='/assets/tools/pattern-placeholder.svg';" style="width:50px; height:50px; object-fit:cover; border-radius:6px; border:1px solid var(--border-soft);" />
          </td>
          <td>
            <strong style="color:var(--bg-saddle);">${p.sku}</strong>
            <div style="font-size:11.5px; color:var(--text-muted);">${p.categoryShort || ''} • Khổ ${(p.paperSizes || ['A4']).join('/')}</div>
          </td>
          <td>
            <input type="text" class="cms-input-title" data-field="title" value="${String(p.title || '').replace(/"/g, '&quot;')}" />
          </td>
          <td>
            <input type="number" class="cms-input-sm" data-field="pdf_dxf" value="${vMap.pdf_dxf ?? 0}" />
          </td>
          <td>
            <input type="number" class="cms-input-sm" data-field="rap_giay" value="${vMap.rap_giay ?? 0}" />
          </td>
          <td>
            <input type="number" class="cms-input-sm" data-field="rap_mica" value="${vMap.rap_mica ?? 0}" />
          </td>
          <td>
            <input type="number" class="cms-input-sm" data-field="khuon_be" value="${vMap.khuon_be ?? 0}" />
          </td>
          <td>
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:nowrap;">
              <button type="button" class="btn-sm btn-add" data-save-sku="${p.sku}" title="Lưu nhanh giá & tiêu đề">💾 Lưu</button>
              <button type="button" class="btn-edit-sm" data-edit-sku="${p.sku}" title="Chỉnh sửa chi tiết, ảnh đại diện, file PDF/CAD & mô tả">✏️ Sửa</button>
              <a href="/studio?sku=${encodeURIComponent(p.sku)}" class="btn-sm btn-detail" style="text-decoration:none; white-space:nowrap;" title="Đóng dấu Logo">
                🏷️ Logo
              </a>
              <button type="button" class="btn-danger-sm" data-delete-sku="${p.sku}" title="Xoá mẫu rập này">
                🗑️ Xoá
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  updateSelectedPatternsCounter();
}

function getFilteredTools() {
  const q = adminState.toolSearchQuery.trim().toLowerCase();
  const lockedVendorId = getActiveVendorId();
  const effectiveVendorFilter = lockedVendorId || adminState.selectedToolVendor;

  return adminState.accessories.filter((a) => {
    const itemVendorId = inferItemVendorId(a);
    if (effectiveVendorFilter !== 'all' && itemVendorId !== effectiveVendorFilter) {
      return false;
    }
    if (adminState.selectedToolCat !== 'all' && a.category !== adminState.selectedToolCat) {
      return false;
    }
    if (q) {
      const hay = `${a.sku} ${a.title} ${a.category} ${a.badge || ''} ${inferItemVendorName(a)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderToolsTable() {
  const tbody = document.getElementById('adminToolsTableBody');
  const filtered = getFilteredTools();
  const countEl = document.getElementById('adminToolsFilteredCount');
  if (countEl) countEl.textContent = filtered.length;

  tbody.innerHTML = filtered
    .map((a) => {
      const thumb = safeMediaUrl((a.images && a.images[0]) || '/assets/tools/tool-1.svg', '/assets/tools/tool-1.svg');
      const checked = adminState.selectedToolIds.has(a.id) ? 'checked' : '';
      const vName = inferItemVendorName(a);
      return `
      <tr data-tool-id="${a.id}">
        <td style="text-align:center;">
          <input type="checkbox" class="chk-row tool-row-chk" data-check-tool="${a.id}" ${checked} />
        </td>
        <td>
          <img src="${thumb}" alt="${a.sku}" onerror="this.onerror=null;this.src='/assets/tools/tool-1.svg';" style="width:52px; height:52px; object-fit:cover; border-radius:6px; border:1px solid var(--border-soft);" />
        </td>
        <td>
          <strong>${a.sku}</strong>
          <div style="font-size:11px; color:var(--text-muted);">${a.category || ''}</div>
          <span style="display:inline-block; margin-top:2px; padding:1px 6px; border-radius:4px; background:#fef3c7; color:#92400e; font-size:10.5px; font-weight:800;">🏢 ${vName}</span>
          <a href="${a.shopeeUrl || 'https://shopee.vn/dathungleather'}" target="_blank" rel="noopener" style="display:inline-block; margin-top:2px; padding:1px 6px; border-radius:4px; background:#fee2e2; color:#b91c1c; font-size:10.5px; font-weight:700; text-decoration:none;" title="Xem sản phẩm trên Shopee">🛒 Shopee ↗</a>
        </td>
        <td><input type="text" class="cms-input-title" data-tfield="title" value="${String(a.title || '').replace(/"/g, '&quot;')}" /></td>
        <td><input type="text" class="cms-input-sm" style="width:135px;" data-tfield="badge" value="${String(a.badge || '').replace(/"/g, '&quot;')}" /></td>
        <td><input type="number" class="cms-input-sm" data-tfield="price" value="${a.price || 0}" /></td>
        <td><input type="number" class="cms-input-sm" data-tfield="originalPrice" value="${a.originalPrice || 0}" /></td>
        <td>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:nowrap;">
            <button type="button" class="btn-sm btn-add" data-save-tool="${a.id}">💾 Lưu</button>
            <button type="button" class="btn-edit-sm" data-edit-tool="${a.id}">✏️ Sửa</button>
            <button type="button" class="btn-danger-sm" data-delete-tool="${a.id}">🗑️ Xoá</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  updateSelectedToolsCounter();
}

function renderVendorsTable() {
  const tbody = document.getElementById('adminVendorsTableBody');
  if (!tbody) return;

  tbody.innerHTML = adminState.vendors
    .map((v) => {
      const isSuper = v.role === 'super_admin' || v.vendorId === 'all';
      const toolCount = isSuper
        ? adminState.accessories.length
        : adminState.accessories.filter((a) => inferItemVendorId(a) === v.vendorId).length;
      const patCount = isSuper
        ? adminState.products.length
        : adminState.products.filter((p) => (p.vendorId || 'rapmau') === v.vendorId).length;
      const orderCount = isSuper
        ? adminState.orders.length
        : adminState.orders.filter((o) =>
            (o.items || []).some((it) => inferItemVendorId(it) === v.vendorId)
          ).length;

      return `
        <tr>
          <td>
            <strong style="color:var(--bg-saddle);">${v.vendorName}</strong>
            <div style="font-size:11.5px; color:var(--text-muted);">Mã: <code>${v.vendorId}</code> • SKU: <strong>${v.skuPrefix || 'NCC'}</strong></div>
            ${v.website ? `<a href="${v.website}" target="_blank" style="font-size:11px; color:var(--accent-leather);">${v.website}</a>` : ''}
          </td>
          <td>
            <code style="font-weight:800; font-size:13px; color:#1e40af;">${v.username}</code>
            <div style="font-size:11px; color:var(--text-muted);">${v.phone || ''}</div>
          </td>
          <td>
            ${
              isSuper
                ? '<span class="size-badge" style="background:#dcfce7; color:#166534;">👑 Toàn quyền Admin Tổng</span>'
                : `
                  <div style="font-size:12px;">
                    ${v.allowTools !== false ? '✅ Quản lý Dụng cụ/SP riêng' : '❌ Không QL Dụng cụ'}<br/>
                    ${v.allowPatterns ? '✅ Quản lý Mẫu rập riêng' : '🔒 Chỉ xem SP & Đơn hàng riêng'}
                  </div>
                `
            }
          </td>
          <td>
            <strong>${toolCount}</strong> SP dụng cụ
            ${patCount > 0 ? `<div style="font-size:11px; color:var(--text-muted);">+ ${patCount} mẫu rập</div>` : ''}
          </td>
          <td><strong>${orderCount}</strong> đơn</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-edit-sm" data-edit-vendor="${v.vendorId}">✏️ Sửa / Đổi MK</button>
              ${
                !isSuper
                  ? `<button type="button" class="btn-danger-sm" data-delete-vendor="${v.vendorId}">🗑️ Xoá</button>`
                  : ''
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderBooksTable() {
  const site = adminState.catalog.site || {};
  document.getElementById('quickZaloGroupInput').value =
    site.zaloGroupUrl || 'https://zalo.me/0971463768';

  const tbody = document.getElementById('adminBooksTableBody');
  tbody.innerHTML = adminState.freeBooks
    .map(
      (b) => `
      <tr data-book-id="${b.id}">
        <td><img src="${encodeURI(b.cover)}" alt="${b.id}" style="width:44px; height:58px; object-fit:cover; border-radius:4px;" /></td>
        <td><strong>${b.id}</strong></td>
        <td><span class="book-folder-badge">📁 ${b.folderKey}</span></td>
        <td>
          <input type="text" class="cms-input-title" data-bfield="title" value="${String(b.title || '').replace(/"/g, '&quot;')}" />
        </td>
        <td>${b.sizeMB} MB</td>
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="btn-sm btn-add" data-save-book="${b.id}">💾 Lưu</button>
            <a href="${encodeURI(b.downloadUrl)}" target="_blank" class="btn-sm btn-detail" style="text-decoration:none;">
              👁️ Xem
            </a>
            <button type="button" class="btn-danger-sm" data-delete-book="${b.id}">🗑️ Xoá</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderArticlesTable() {
  const tbody = document.getElementById('adminArticlesTableBody');
  if (!tbody) return;
  const articles = adminState.articles || [];
  tbody.innerHTML = articles
    .map(
      (a) => `
      <tr>
        <td><strong>${a.id}</strong></td>
        <td>
          <strong style="color:var(--bg-saddle);">${a.title}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">
            URL: <a href="/bai-viet/${a.slug}" target="_blank" style="color:var(--accent-leather);">/bai-viet/${a.slug}</a>
          </div>
        </td>
        <td><span class="size-badge">${a.category || 'Cẩm Nang'}</span></td>
        <td style="max-width:310px; font-size:12px; color:#334155;">
          ${(a.aeoAnswer || a.excerpt || '').slice(0, 140)}...
        </td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn-edit-sm" data-edit-art="${a.id}">✏️ Sửa</button>
            <a href="/bai-viet/${a.slug}" target="_blank" class="btn-sm btn-detail" style="text-decoration:none;">👁️ Xem</a>
            <button type="button" class="btn-danger-sm" data-del-art="${a.id}">🗑️ Xoá</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

function getB2bState() {
  if (!adminState.catalog) adminState.catalog = {};
  if (!adminState.catalog.b2b) adminState.catalog.b2b = {};
  return adminState.catalog.b2b;
}

function renderB2bArticlesTable() {
  const tbody = document.getElementById('adminB2bArticlesTableBody');
  if (!tbody) return;
  const b2b = getB2bState();
  const list = Array.isArray(b2b.articles) ? b2b.articles : [];
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:18px;">Chưa có bài viết B2B nào. Hãy thêm bài viết mới ở biểu mẫu bên phải!</td></tr>';
    return;
  }
  tbody.innerHTML = list
    .map(
      (a) => `
      <tr>
        <td style="width:68px;">
          <img src="${a.image || '/assets/brand/hero-workbench.jpg'}" alt="${a.title}" style="width:56px; height:42px; object-fit:cover; border-radius:6px; border:1px solid var(--border-soft);" />
        </td>
        <td>
          <strong style="color:var(--bg-saddle);">${a.title}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">
            [${a.id}] • Cập nhật: ${a.updatedAt || '2026-11-11'} • ${a.readTime || '5 phút đọc'}
          </div>
        </td>
        <td><span class="size-badge">${a.category || 'B2B'}</span></td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn-edit-sm" data-edit-b2b-art="${a.id}">✏️ Sửa</button>
            <a href="/b2b/#bai-viet-b2b" target="_blank" class="btn-sm btn-detail" style="text-decoration:none;">👁️ Xem</a>
            <button type="button" class="btn-danger-sm" data-del-b2b-art="${a.id}">🗑️ Xoá</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');
}

function populateB2bSectionsForm() {
  const b2b = getB2bState();
  const hero = b2b.hero || {};
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || '';
  };

  setVal('b2bHeroTag', hero.tag || '🏭 XƯỞNG SẢN XUẤT ĐỒ DA & CHẾ TÁC THEO YÊU CẦU');
  setVal('b2bHeroTitleHtml', hero.titleHtml || 'Gia Công Đồ Da B2B, <span class="text-gold">Quà Tặng Doanh Nghiệp</span> & Sản Xuất OEM/ODM');
  setVal('b2bHeroDescHtml', hero.descHtml || '');
  setVal('b2bHeroImage', hero.image || '/assets/brand/hero-workbench.jpg');
  setVal('b2bHeroBadgeHtml', hero.badgeHtml || '');
  const stats = Array.isArray(hero.stats) ? hero.stats : [];
  setVal('b2bHeroStatsLines', stats.map((s) => `${s.num || ''} | ${s.label || ''}`).join('\n'));

  const artSec = b2b.articlesSection || {};
  setVal('b2bArticlesSecTag', artSec.tag || 'TIN TỨC & CASE STUDY B2B');
  setVal('b2bArticlesSecTitle', artSec.title || 'Bài Viết Năng Lực Xưởng & Cẩm Nang Đặt Gia Công');
  setVal('b2bArticlesSecDesc', artSec.desc || '');

  const svcSec = b2b.servicesSection || {};
  setVal('b2bServicesTitle', svcSec.title || '4 Hạng Mục Gia Công & Sản Xuất Thế Mạnh');
  setVal('b2bServicesDesc', svcSec.desc || '');
  const svcBox = document.getElementById('b2bServicesEditorList');
  if (svcBox) {
    const items = Array.isArray(svcSec.items) ? svcSec.items : [];
    svcBox.innerHTML = items
      .map(
        (it, idx) => `
        <div style="border:1px solid var(--border-soft); border-radius:8px; padding:10px; background:#fff;" data-b2b-svc-idx="${idx}">
          <div style="font-size:12px; font-weight:800; color:var(--accent-leather); margin-bottom:6px;">Hạng mục #${idx + 1}</div>
          <div class="form-row">
            <div class="form-field"><label>Nhãn góc</label><input type="text" class="b2b-svc-badge" value="${(it.badge || '').replace(/"/g, '&quot;')}" /></div>
            <div class="form-field"><label>Icon</label><input type="text" class="b2b-svc-icon" value="${(it.icon || '').replace(/"/g, '&quot;')}" /></div>
          </div>
          <div class="form-field" style="margin-bottom:6px;"><label>Tiêu đề dịch vụ</label><input type="text" class="b2b-svc-title" value="${(it.title || '').replace(/"/g, '&quot;')}" /></div>
          <div class="form-field" style="margin-bottom:6px;"><label>Mô tả ngắn</label><textarea class="b2b-svc-body" rows="2">${it.body || ''}</textarea></div>
          <div class="form-field" style="margin-bottom:6px;"><label>4 Điểm nổi bật (mỗi dòng 1 ý)</label><textarea class="b2b-svc-features" rows="3">${(it.features || []).join('\n')}</textarea></div>
          <div class="form-field"><label>Chữ nút bấm</label><input type="text" class="b2b-svc-cta" value="${(it.ctaText || '').replace(/"/g, '&quot;')}" /></div>
        </div>
      `
      )
      .join('');
  }

  const netSec = b2b.networkSection || {};
  setVal('b2bNetworkTitle', netSec.title || '');
  setVal('b2bNetworkDesc', netSec.desc || '');
  const netBox = document.getElementById('b2bWorkshopsEditorList');
  if (netBox) {
    const wks = Array.isArray(netSec.workshops) ? netSec.workshops : [];
    netBox.innerHTML = wks
      .map(
        (w, idx) => `
        <div style="border:1px solid var(--border-soft); border-radius:8px; padding:10px; background:#fff;" data-b2b-wk-idx="${idx}">
          <div class="form-row">
            <div class="form-field"><label>Tên xưởng #${idx + 1}</label><input type="text" class="b2b-wk-title" value="${(w.title || '').replace(/"/g, '&quot;')}" /></div>
            <div class="form-field"><label>Công suất / tháng</label><input type="text" class="b2b-wk-cap" value="${(w.cap || '').replace(/"/g, '&quot;')}" /></div>
          </div>
          <div class="form-field"><label>Mô tả mặt hàng, thiết bị &amp; ưu thế (HTML)</label><textarea class="b2b-wk-spec" rows="3">${w.specHtml || ''}</textarea></div>
        </div>
      `
      )
      .join('');
  }

  const stdSec = b2b.standardsSection || {};
  setVal('b2bStandardsTitle', stdSec.title || '');
  setVal('b2bStandardsDesc', stdSec.desc || '');
  setVal('b2bMaterialPillsCsv', (stdSec.materialPills || []).join(', '));
  const mktBox = document.getElementById('b2bMarketsEditorList');
  if (mktBox) {
    const mkts = Array.isArray(stdSec.markets) ? stdSec.markets : [];
    mktBox.innerHTML = mkts
      .map(
        (m, idx) => `
        <div style="border:1px solid var(--border-soft); border-radius:8px; padding:10px; background:#fff;" data-b2b-mkt-idx="${idx}">
          <div class="form-row">
            <div class="form-field"><label>Thị trường #${idx + 1}</label><input type="text" class="b2b-mkt-title" value="${(m.title || '').replace(/"/g, '&quot;')}" /></div>
            <div class="form-field"><label>Chuẩn phụ đề</label><input type="text" class="b2b-mkt-sub" value="${(m.sub || '').replace(/"/g, '&quot;')}" /></div>
          </div>
          <div class="form-field"><label>Các dòng tiêu chuẩn (mỗi dòng 1 ý)</label><textarea class="b2b-mkt-items" rows="3">${(m.itemsHtml || []).join('\n')}</textarea></div>
        </div>
      `
      )
      .join('');
  }
}

function renderOrdersAndLeads() {
  const ordBox = document.getElementById('adminOrdersContainer');
  const leadBox = document.getElementById('adminLeadsContainer');
  const titleEl = document.getElementById('ordersSectionTitle');
  const activeVendorId = getActiveVendorId();
  const sess = getAuthSession();

  if (titleEl) {
    titleEl.textContent = activeVendorId
      ? `📦 Đơn Đặt Hàng Có Sản Phẩm Của Nhà Cung Cấp: ${sess?.vendorName || activeVendorId}`
      : '📦 Toàn Bộ Đơn Đặt Hàng Từ Website (Tất Cả Nhà Cung Cấp)';
  }

  const visibleOrders = getOrdersForCurrentRole();

  if (visibleOrders.length === 0) {
    ordBox.innerHTML = `<p style="color:var(--text-muted); font-size:13.5px;">Chưa có đơn đặt hàng nào${activeVendorId ? ' cho sản phẩm của bạn' : ''}.</p>`;
  } else {
    ordBox.innerHTML = `
      <table class="cms-table">
        <thead>
          <tr>
            <th>Mã Đơn</th>
            <th>Thời Gian</th>
            <th>Khách Hàng &amp; SĐT Zalo</th>
            <th>${activeVendorId ? 'Sản Phẩm Của Nhà Cung Cấp Trong Đơn' : 'Sản Phẩm Đặt Mua (Kèm NCC)'}</th>
            <th>${activeVendorId ? 'Doanh Thu Của NCC' : 'Tổng Tiền Đơn'}</th>
            <th>Thanh Toán</th>
          </tr>
        </thead>
        <tbody>
          ${visibleOrders
            .map((o) => {
              const relevantItems = activeVendorId
                ? (o.items || []).filter((i) => inferItemVendorId(i) === activeVendorId)
                : o.items || [];
              const displayTotal = activeVendorId
                ? relevantItems.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 1), 0)
                : o.totalAmount;

              return `
            <tr>
              <td><strong style="color:var(--accent-leather);">#${o.orderCode}</strong></td>
              <td>${new Date(o.createdAt).toLocaleString('vi-VN')}</td>
              <td>
                <strong>${o.customer?.name || ''}</strong> — <a href="https://zalo.me/${(o.customer?.phone || '').replace(/[^0-9]/g, '')}" target="_blank">${o.customer?.phone || ''}</a>
                <div style="font-size:12px; color:var(--text-muted);">${o.customer?.address || ''}</div>
              </td>
              <td>
                ${relevantItems
                  .map(
                    (i) =>
                      `<div>• <strong>[${i.sku}]</strong> ${i.title} (<em>${i.variantName || 'Sản phẩm'}</em> × ${i.qty}) <span style="font-size:11px; color:#92400e; font-weight:700;">[${inferItemVendorName(i)}]</span></div>`
                  )
                  .join('')}
              </td>
              <td><strong style="color:var(--accent-leather); font-size:15px;">${formatVND(displayTotal)}</strong></td>
              <td><span class="size-badge">${(o.paymentMethod || 'vietqr').toUpperCase()}</span></td>
            </tr>
          `;
            })
            .join('')}
        </tbody>
      </table>
    `;
  }

  if (adminState.consultations.length === 0) {
    leadBox.innerHTML = `<p style="color:var(--text-muted); font-size:13.5px;">Chưa có khách đăng ký nhận sách hoặc gửi yêu cầu tư vấn.</p>`;
  } else {
    leadBox.innerHTML = `
      <table class="cms-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Thời Gian</th>
            <th>Tên Khách Hàng</th>
            <th>Số Điện Thoại Zalo</th>
            <th>Loại Yêu Cầu / Nhóm Zalo</th>
            <th>Ghi Chú Chi Tiết</th>
          </tr>
        </thead>
        <tbody>
          ${adminState.consultations
            .map(
              (c) => `
            <tr>
              <td><strong>#${c.id}</strong></td>
              <td>${new Date(c.createdAt).toLocaleString('vi-VN')}</td>
              <td><strong>${c.name}</strong></td>
              <td>
                <a href="https://zalo.me/${(c.phone || '').replace(/[^0-9]/g, '')}" target="_blank" style="font-weight:800; color:var(--accent-zalo);">
                  💬 ${c.phone}
                </a>
              </td>
              <td><span class="size-badge">${c.needType}</span></td>
              <td>${c.skuRef ? `<strong>[${c.skuRef}]</strong> ` : ''}${c.message || ''}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }
}

function populateSiteSettings() {
  const site = adminState.catalog.site || {};
  const bank = site.bankInfo || {};

  const tagEl = document.getElementById('cfgTagline');
  const noteEl = document.getElementById('cfgCtaNote');
  if (tagEl) tagEl.value = site.tagline || 'Chọn rập PDF/DXF, rập giấy, rập mica hoặc khuôn theo mẫu';
  if (noteEl) {
    noteEl.value =
      site.ctaNote ||
      'Tìm phụ kiện và dụng cụ cơ bản để tự làm đồ da. Cần hỏi mẫu phù hợp, hãy liên hệ Hotline/Zalo: 0971.463.768 (Mr.Tuan) - Email: info@rapmau.com.';
  }

  document.getElementById('cfgHotline').value = site.hotline || '0971.463.768 (Mr.Tuan)';
  document.getElementById('cfgZalo').value = site.zalo || '0971463768';
  document.getElementById('cfgEmail').value = site.email || 'info@rapmau.com';
  document.getElementById('cfgZaloGroupUrl').value =
    site.zaloGroupUrl || 'https://zalo.me/0971463768';
  document.getElementById('cfgAddress').value = site.address || '';
  document.getElementById('cfgBankId').value = bank.bankId || 'MB';
  document.getElementById('cfgAccountNo').value = bank.accountNo || '0971463768';
  document.getElementById('cfgAccountName').value = bank.accountName || 'MR TUAN RAPMAU';

  updateVietQrPreview();
}

function updateVietQrPreview() {
  const bankId = document.getElementById('cfgBankId').value.trim() || 'MB';
  const accountNo = document.getElementById('cfgAccountNo').value.trim() || '0971463768';
  const accountName =
    document.getElementById('cfgAccountName').value.trim() || 'MR TUAN RAPMAU';
  const url = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=55000&addInfo=RM123456&accountName=${encodeURIComponent(accountName)}`;
  document.getElementById('previewVietQrImg').src = url;
  document.getElementById('previewVietQrText').textContent = `${bankId} • STK: ${accountNo} (${accountName})`;
}

function compressImageDataUrl(rawDataUrl, maxDim = 1280, quality = 0.84) {
  return new Promise((resolve) => {
    if (!rawDataUrl || !rawDataUrl.startsWith('data:image/')) {
      resolve(rawDataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed && compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

async function handleImageFileUpload(fileInputEl, targetUrlInputEl, onSuccess) {
  const file = fileInputEl.files && fileInputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const rawDataUrl = reader.result;
    const optimizedDataUrl = await compressImageDataUrl(rawDataUrl, 1280, 0.84);

    if (adminState.isLocalBackend) {
      try {
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ fileName: file.name, dataUrl: optimizedDataUrl })
        });
        if (res.ok) {
          const data = await res.json();
          const uploaded = data.url || data.imageUrl;
          if (data.ok && uploaded) {
            const cleanUrl = typeof uploaded.normalize === 'function' ? uploaded.normalize('NFC') : uploaded;
            targetUrlInputEl.value = cleanUrl;
            if (onSuccess) onSuccess(cleanUrl, file.name);
            showToast('📷 Đã tải & lưu ảnh lên máy chủ thành công!');
            return;
          }
        }
      } catch {
        // fallback to IndexedDB + DataURL
      }
    }

    const cleanName = (typeof file.name.normalize === 'function' ? file.name.normalize('NFC') : file.name).replace(/\s+/g, '-');
    const virtualPath = `/media/uploads/${Date.now()}-${cleanName}`;
    await idbSet('uploaded_files', virtualPath, {
      url: virtualPath,
      fileName: file.name,
      mimeType: 'image/jpeg',
      sizeMB: Math.max(0.01, Math.round((optimizedDataUrl.length * 0.75) / 10485.76) / 100),
      dataUrl: optimizedDataUrl,
      updatedAt: Date.now()
    });

    targetUrlInputEl.value = optimizedDataUrl;
    if (onSuccess) onSuccess(optimizedDataUrl, file.name);
    showToast(`📷 Đã nạp & lưu ảnh "${file.name}" thành công!`);
  };
  reader.readAsDataURL(file);
}

async function handleGenericFileUpload(fileInputEl, targetUrlInputEl, label = 'file', onSuccess) {
  const file = fileInputEl.files && fileInputEl.files[0];
  if (!file) return;
  const sizeMB = Math.max(0.01, Math.round((file.size / (1024 * 1024)) * 100) / 100);
  showToast(`⏳ Đang xử lý & lưu ${label} "${file.name}" (${sizeMB} MB)...`);

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    const cleanFileName = typeof file.name.normalize === 'function' ? file.name.normalize('NFC') : file.name;

    if (adminState.isLocalBackend) {
      try {
        const res = await fetch('/api/upload-file', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ fileName: cleanFileName, dataUrl })
        });
        if (res.ok) {
          const data = await res.json();
          const uploaded = data.fileUrl || data.url;
          if (data.ok && uploaded) {
            const cleanUrl = typeof uploaded.normalize === 'function' ? uploaded.normalize('NFC') : uploaded;
            targetUrlInputEl.value = cleanUrl;
            await idbSet('uploaded_files', cleanUrl, {
              url: cleanUrl,
              fileName: cleanFileName,
              mimeType: file.type || 'application/pdf',
              sizeMB,
              dataUrl,
              updatedAt: Date.now()
            });
            if (onSuccess) onSuccess(cleanUrl, cleanFileName, sizeMB);
            showToast(`📁 Đã tải & lưu ${label} "${cleanFileName}" (${sizeMB} MB) thành công!`);
            return;
          }
        }
      } catch {
        // fallback to IndexedDB
      }
    }

    const safeSlugName = cleanFileName.replace(/[^a-zA-Z0-9._\-\u00C0-\u1EF9 ]/g, '_');
    const virtualUrl = `/media/uploads/${safeSlugName}`;
    await idbSet('uploaded_files', virtualUrl, {
      url: virtualUrl,
      fileName: cleanFileName,
      mimeType: file.type || 'application/pdf',
      sizeMB,
      dataUrl,
      updatedAt: Date.now()
    });

    targetUrlInputEl.value = virtualUrl;
    if (onSuccess) onSuccess(virtualUrl, cleanFileName, sizeMB);
    showToast(`✅ Đã lưu ${label} "${cleanFileName}" (${sizeMB} MB) vào hệ thống!`);
  };
  reader.readAsDataURL(file);
}

async function publishWebsiteChanges() {
  showToast('⏳ Đang đóng gói và xuất bản lên WWW.RAPMAU.COM...');
  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({})
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        showToast('🚀 Đã xuất bản thành công lên WWW.RAPMAU.COM!');
        return;
      }
    }
  } catch {
    // fallback message for static hosting
  }
  syncCatalogStatsAndPersistLocal();
  showToast('✅ Đã lưu thay đổi trên trình duyệt! Bạn có thể bấm "Tải Bản Sao JSON" để lưu trữ.');
}

function bindAdminEvents() {
  // Chuyển Tab Sidebar
  document.querySelectorAll('#adminTabNav .admin-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
    });
  });

  // Nút Xuất bản lên web
  ['btnPublishToWeb', 'btnTopPublish'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', publishWebsiteChanges);
  });

  // Nút Xuất & Nhập file JSON dự phòng
  const exportBtn = document.getElementById('btnExportCatalogJson');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      syncCatalogStatsAndPersistLocal();
      const blob = new Blob([JSON.stringify(adminState.catalog, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapmau-catalog-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📥 Đã tải file sao lưu dữ liệu JSON!');
    });
  }

  // Quản trị viên mở khóa bản vẽ & tạo mã bản quyền
  const adminUnlockAllBpBtn = document.getElementById('btnAdminUnlockAllBp');
  if (adminUnlockAllBpBtn) {
    adminUnlockAllBpBtn.addEventListener('click', () => {
      try {
        const key = 'rapmau_unlocked_blueprints_v2';
        const current = JSON.parse(localStorage.getItem(key) || '{}');
        current['ALL'] = true;
        current['MASTER_ADMIN'] = true;
        localStorage.setItem(key, JSON.stringify(current));
        showToast('🔓 Đã mở khóa toàn bộ 369 bản vẽ có phí trên thiết bị này!');
      } catch (err) {
        showToast('❌ Không thể lưu vào LocalStorage!');
      }
    });
  }

  const genKeyBtn = document.getElementById('btnGenLicenseKey');
  const genKeyInput = document.getElementById('adminGeneratedKey');
  if (genKeyBtn && genKeyInput) {
    genKeyBtn.addEventListener('click', () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let part1 = '';
      let part2 = '';
      for (let i = 0; i < 4; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      for (let i = 0; i < 4; i++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
      const code = `RMVIP-${part1}-${part2}`;
      genKeyInput.value = code;
      showToast(`🎟️ Đã tạo mã kích hoạt: ${code}`);
    });
  }

  const importInput = document.getElementById('inputImportCatalogJson');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed.products || !parsed.accessories) {
            showToast('❌ File JSON không đúng cấu trúc catalog!', true);
            return;
          }
          adminState.catalog = parsed;
          adminState.products = parsed.products || [];
          adminState.categories = parsed.categories || [];
          adminState.accessories = parsed.accessories || [];
          adminState.freeBooks = parsed.freeBooks || [];
          adminState.articles = parsed.articles || adminState.articles || [];
          if (parsed.b2b) adminState.b2b = parsed.b2b;
          if (parsed.vendors && parsed.vendors.length) {
            adminState.vendors = parsed.vendors;
          }
          syncCatalogStatsAndPersistLocal();
          renderKPIs();
          populateCategorySelects();
          populateVendorSelects();
          renderPatternsTable();
          renderToolsTable();
          renderBooksTable();
          renderArticlesTable();
          renderB2bArticlesTable();
          populateB2bSectionsForm();
          renderVendorsTable();
          populateSiteSettings();
          showToast('📤 Đã khôi phục dữ liệu từ file JSON thành công!');
        } catch {
          showToast('❌ Không thể đọc file JSON!', true);
        }
      };
      reader.readAsText(file);
    });
  }

  // Lọc và tìm kiếm mẫu rập
  document.getElementById('adminCatFilter').addEventListener('change', (e) => {
    adminState.selectedCat = e.target.value;
    renderPatternsTable();
  });
  document.getElementById('adminSearchInput').addEventListener('input', (e) => {
    adminState.searchQuery = e.target.value;
    renderPatternsTable();
  });

  // Chọn tất cả mẫu rập đang lọc
  const selectAllPatChk = document.getElementById('selectAllPatternsChk');
  if (selectAllPatChk) {
    selectAllPatChk.addEventListener('change', (e) => {
      const filtered = getFilteredPatterns();
      for (const p of filtered) {
        if (e.target.checked) adminState.selectedPatternSkus.add(p.sku);
        else adminState.selectedPatternSkus.delete(p.sku);
      }
      renderPatternsTable();
    });
  }

  // Sự kiện trong bảng Mẫu Rập (Checkbox, Lưu, Xoá)
  document.getElementById('adminProductsTableBody').addEventListener('change', (e) => {
    const chk = e.target.closest('[data-check-sku]');
    if (!chk) return;
    const sku = chk.dataset.checkSku;
    if (chk.checked) adminState.selectedPatternSkus.add(sku);
    else adminState.selectedPatternSkus.delete(sku);
    updateSelectedPatternsCounter();
  });

  document.getElementById('adminProductsTableBody').addEventListener('click', async (e) => {
    const saveBtn = e.target.closest('[data-save-sku]');
    if (saveBtn) {
      const sku = saveBtn.dataset.saveSku;
      const row = saveBtn.closest('tr');
      const title = row.querySelector('[data-field="title"]').value.trim();
      const variantPrices = {
        pdf_dxf: Number(row.querySelector('[data-field="pdf_dxf"]').value) || 0,
        rap_giay: Number(row.querySelector('[data-field="rap_giay"]').value) || 0,
        rap_mica: Number(row.querySelector('[data-field="rap_mica"]').value) || 0,
        khuon_be: Number(row.querySelector('[data-field="khuon_be"]').value) || 0
      };

      const idx = adminState.products.findIndex((p) => p.sku === sku);
      if (idx !== -1) {
        adminState.products[idx].title = title;
        for (const v of adminState.products[idx].variants || []) {
          if (variantPrices[v.id] !== undefined) v.price = variantPrices[v.id];
        }
        const pdfVar = (adminState.products[idx].variants || []).find((v) => v.id === 'pdf_dxf');
        adminState.products[idx].isFreePdf = Boolean(pdfVar && pdfVar.price === 0);
        adminState.products[idx]._editedAt = Date.now();
      }

      if (adminState.isLocalBackend) {
        try {
          await fetch(`/api/product/${encodeURIComponent(sku)}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ title, variantPrices })
          });
        } catch {
          // offline fallback
        }
      }

      syncCatalogStatsAndPersistLocal();
      renderKPIs();
      showToast(`✅ Đã lưu mẫu ${sku} thành công!`);
      return;
    }

    const editBtn = e.target.closest('[data-edit-sku]');
    if (editBtn) {
      const sku = editBtn.dataset.editSku;
      const prod = adminState.products.find((p) => p.sku === sku);
      if (!prod) return;
      openEditPatternModal(prod);
      return;
    }

    const delBtn = e.target.closest('[data-delete-sku]');
    if (delBtn) {
      const sku = delBtn.dataset.deleteSku;
      const prod = adminState.products.find((p) => p.sku === sku);
      if (!window.confirm(`Bạn có chắc chắn muốn XOÁ mẫu rập [${sku}] "${prod?.title || ''}" không?`)) {
        return;
      }

      adminState.products = adminState.products.filter((p) => p.sku !== sku);
      adminState.selectedPatternSkus.delete(sku);
      if (adminState.catalog) {
        if (!Array.isArray(adminState.catalog._deletedPatternSkus)) adminState.catalog._deletedPatternSkus = [];
        if (!adminState.catalog._deletedPatternSkus.includes(sku)) adminState.catalog._deletedPatternSkus.push(sku);
      }

      if (adminState.isLocalBackend) {
        try {
          await fetch(`/api/product/${encodeURIComponent(sku)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
        } catch {
          // offline fallback
        }
      }

      syncCatalogStatsAndPersistLocal();
      renderKPIs();
      populateCategorySelects();
      renderPatternsTable();
      showToast(`🗑️ Đã xoá mẫu rập ${sku}!`);
    }
  });

  // Xoá hàng loạt mẫu rập đã chọn
  document.getElementById('btnBulkDeletePatterns').addEventListener('click', async () => {
    const skus = Array.from(adminState.selectedPatternSkus);
    if (skus.length === 0) {
      showToast('⚠️ Vui lòng tích chọn ít nhất 1 mẫu rập để xoá!', true);
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn XOÁ VĨNH VIỄN ${skus.length} mẫu rập đã chọn không?`)) {
      return;
    }

    const skuSet = new Set(skus);
    adminState.products = adminState.products.filter((p) => !skuSet.has(p.sku));
    adminState.selectedPatternSkus.clear();
    if (adminState.catalog) {
      if (!Array.isArray(adminState.catalog._deletedPatternSkus)) adminState.catalog._deletedPatternSkus = [];
      for (const s of skus) {
        if (!adminState.catalog._deletedPatternSkus.includes(s)) adminState.catalog._deletedPatternSkus.push(s);
      }
    }

    if (adminState.isLocalBackend) {
      try {
        await fetch('/api/products/bulk-delete', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ skus })
        });
      } catch {
        // offline fallback
      }
    }

    syncCatalogStatsAndPersistLocal();
    renderKPIs();
    populateCategorySelects();
    renderPatternsTable();
    showToast(`🗑️ Đã xoá ${skus.length} mẫu rập không cần thiết!`);
  });

  // Mở / Đóng Modal Thêm / Chỉnh Sửa Mẫu Rập
  const addPatModal = document.getElementById('addPatternModal');

  function clearPatternUploadStatuses() {
    for (const id of ['newPatImgStatus', 'newPatPdfStatus', 'newPatCadStatus']) {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.textContent = '';
      }
    }
  }

  function showPatternUploadStatus(id, msg) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  function autoSaveOpenPatternMedia(statusId, statusLabel) {
    const editSku = (document.getElementById('editPatternSku')?.value || '').trim();
    if (!editSku) return;
    const p = adminState.products.find((prod) => prod.sku === editSku);
    if (!p) return;

    const primaryImg = (document.getElementById('newPatImageUrl')?.value || '').trim() || '/assets/tools/pattern-placeholder.svg';
    const moreImgs = (document.getElementById('newPatMoreImages')?.value || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const images = [primaryImg, ...moreImgs].filter(Boolean);

    const pdfInputEl = document.getElementById('newPatPdfUrl');
    const cadInputEl = document.getElementById('newPatCadUrl');
    const pdfDownloadUrl = (pdfInputEl?.value || '').trim();
    const cadDownloadUrl = (cadInputEl?.value || '').trim();
    const pdfFiles = pdfDownloadUrl ? [pdfDownloadUrl] : [];
    const cadFiles = cadDownloadUrl ? [cadDownloadUrl] : [];

    p.images = images;
    p.primaryImage = images[0] || '/assets/tools/pattern-placeholder.svg';
    p.imageCount = images.length;
    p.pdfFiles = pdfFiles;
    p.pdfFileNames = pdfFiles.map((f) => String(f).split('/').pop() || 'ban-ve.pdf');
    p.pdfCount = pdfFiles.length;
    if (pdfInputEl && pdfInputEl.dataset.uploadedSizeMb) {
      const sz = Number(pdfInputEl.dataset.uploadedSizeMb);
      if (sz > 0) p.fileSizeMB = sz;
    }
    p.cadFiles = cadFiles;
    p.cadCount = cadFiles.length;
    p._editedAt = Date.now();

    syncCatalogStatsAndPersistLocal();
    renderPatternsTable();
    if (statusId && statusLabel) {
      showPatternUploadStatus(statusId, `✅ Đã tự động lưu ${statusLabel} cho mẫu [${editSku}]! Bạn có thể đóng cửa sổ hoặc bấm Lưu.`);
    }
  }

  function openEditPatternModal(p) {
    clearPatternUploadStatuses();
    document.getElementById('patternModalHeading').textContent = `✏️ Chỉnh Sửa Chi Tiết Mẫu Rập [${p.sku}]`;
    document.getElementById('editPatternSku').value = p.sku;
    document.getElementById('newPatTitle').value = p.title || '';

    const catSel = document.getElementById('newPatCategory');
    if (catSel) catSel.value = p.categoryKey || '';

    const skuInput = document.getElementById('newPatSku');
    skuInput.value = p.sku || '';
    skuInput.readOnly = true;
    skuInput.style.backgroundColor = '#f1f5f9';

    document.getElementById('newPatPaperSizes').value = (p.paperSizes || ['A4']).join(', ');
    document.getElementById('newPatLeatherThickness').value = p.leatherThickness || '';
    document.getElementById('newPatChiselPitch').value = p.chiselPitch || '';
    document.getElementById('newPatLeatherEstimate').value = p.leatherEstimate || '';
    document.getElementById('newPatDifficulty').value = p.difficulty || 'Cơ bản';

    const vMap = {};
    for (const v of p.variants || []) vMap[v.id] = v.price;
    document.getElementById('newPatPricePdf').value = vMap.pdf_dxf ?? 0;
    document.getElementById('newPatPricePaper').value = vMap.rap_giay ?? 55000;
    document.getElementById('newPatPriceMica').value = vMap.rap_mica ?? 135000;
    document.getElementById('newPatPriceDie').value = vMap.khuon_be ?? 450000;

    const firstImg = (p.images && p.images[0]) || p.primaryImage || '';
    document.getElementById('newPatImageUrl').value = firstImg;
    const preview = document.getElementById('newPatImgPreview');
    if (preview) preview.src = safeMediaUrl(firstImg);

    const moreImages = (p.images || []).slice(1);
    document.getElementById('newPatMoreImages').value = moreImages.join('\n');

    const pdfUrlInput = document.getElementById('newPatPdfUrl');
    if (pdfUrlInput) {
      pdfUrlInput.value = (p.pdfFiles && p.pdfFiles[0]) || '';
      delete pdfUrlInput.dataset.uploadedSizeMb;
    }
    const cadUrlInput = document.getElementById('newPatCadUrl');
    if (cadUrlInput) {
      cadUrlInput.value = (p.cadFiles && p.cadFiles[0]) || '';
      delete cadUrlInput.dataset.uploadedSizeMb;
    }
    document.getElementById('newPatDescription').value = p.description || '';

    const submitBtn = document.getElementById('submitPatternBtn');
    if (submitBtn) submitBtn.textContent = `💾 Lưu Thay Đổi Mẫu Rập [${p.sku}]`;
    const topSubmitBtn = document.getElementById('topSubmitPatternBtn');
    if (topSubmitBtn) topSubmitBtn.textContent = `💾 Lưu Ngay [${p.sku}]`;

    addPatModal.classList.remove('hidden');
  }

  document.getElementById('btnOpenAddPatternModal').addEventListener('click', () => {
    clearPatternUploadStatuses();
    document.getElementById('patternModalHeading').textContent = '➕ Thêm Mẫu Rập Đồ Da Mới';
    document.getElementById('editPatternSku').value = '';
    document.getElementById('addPatternForm').reset();
    const skuInput = document.getElementById('newPatSku');
    skuInput.readOnly = false;
    skuInput.style.backgroundColor = '#fff';
    const preview = document.getElementById('newPatImgPreview');
    if (preview) preview.src = '/assets/tools/pattern-placeholder.svg';
    const submitBtn = document.getElementById('submitPatternBtn');
    if (submitBtn) submitBtn.textContent = '💾 Tạo Mẫu Rập Mới';
    const topSubmitBtn = document.getElementById('topSubmitPatternBtn');
    if (topSubmitBtn) topSubmitBtn.textContent = '💾 Tạo Ngay';
    addPatModal.classList.remove('hidden');
  });

  document.getElementById('closeAddPatternModalBtn').addEventListener('click', () => {
    addPatModal.classList.add('hidden');
  });

  document.getElementById('newPatImageFile').addEventListener('change', (e) => {
    handleImageFileUpload(e.target, document.getElementById('newPatImageUrl'), (uploaded) => {
      const prev = document.getElementById('newPatImgPreview');
      if (prev) prev.src = safeMediaUrl(uploaded);
      autoSaveOpenPatternMedia('newPatImgStatus', 'ảnh đại diện mới');
    });
  });

  const moreImgFileInput = document.getElementById('newPatMoreImageFile');
  if (moreImgFileInput) {
    moreImgFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const textarea = document.getElementById('newPatMoreImages');
      const existing = (textarea.value || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const file of files) {
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const compressed = await compressImageDataUrl(ev.target.result);
            existing.push(compressed);
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(file);
        });
      }
      textarea.value = existing.join('\n');
      e.target.value = '';
      autoSaveOpenPatternMedia('newPatImgStatus', `${files.length} ảnh phụ thư viện`);
      showToast(`📷 Đã thêm và lưu ${files.length} ảnh phụ vào thư viện!`);
    });
  }

  document.getElementById('newPatImageUrl').addEventListener('input', (e) => {
    const prev = document.getElementById('newPatImgPreview');
    if (prev) prev.src = safeMediaUrl(e.target.value.trim());
    autoSaveOpenPatternMedia('newPatImgStatus', 'đường dẫn ảnh đại diện');
  });

  document.getElementById('newPatMoreImages').addEventListener('change', () => {
    autoSaveOpenPatternMedia('newPatImgStatus', 'thư viện ảnh phụ');
  });

  const pdfFileInput = document.getElementById('newPatPdfFile');
  if (pdfFileInput) {
    pdfFileInput.addEventListener('change', (e) => {
      handleGenericFileUpload(e.target, document.getElementById('newPatPdfUrl'), 'file PDF', () => {
        autoSaveOpenPatternMedia('newPatPdfStatus', 'file PDF rập mới');
      });
    });
  }

  document.getElementById('newPatPdfUrl').addEventListener('change', () => {
    autoSaveOpenPatternMedia('newPatPdfStatus', 'đường dẫn file PDF');
  });

  const cadFileInput = document.getElementById('newPatCadFile');
  if (cadFileInput) {
    cadFileInput.addEventListener('change', (e) => {
      handleGenericFileUpload(e.target, document.getElementById('newPatCadUrl'), 'file CAD/DXF', () => {
        autoSaveOpenPatternMedia('newPatCadStatus', 'file CAD/DXF mới');
      });
    });
  }

  document.getElementById('newPatCadUrl').addEventListener('change', () => {
    autoSaveOpenPatternMedia('newPatCadStatus', 'đường dẫn file CAD/DXF');
  });

  document.getElementById('addPatternForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editSku = document.getElementById('editPatternSku').value.trim();
    const sess = getAuthSession();
    const vendorId = getActiveVendorId() || 'rapmau';
    const vendorName = isVendorSession() ? sess.vendorName : 'Xưởng RAPMAU.COM';

    const title = document.getElementById('newPatTitle').value.trim();
    const categoryKey = document.getElementById('newPatCategory').value;
    const skuInput = document.getElementById('newPatSku').value.trim();
    const paperSizes = document
      .getElementById('newPatPaperSizes')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const leatherThickness = document.getElementById('newPatLeatherThickness').value.trim();
    const chiselPitch = document.getElementById('newPatChiselPitch').value.trim();
    const leatherEstimate = document.getElementById('newPatLeatherEstimate').value.trim();
    const difficulty = document.getElementById('newPatDifficulty').value;
    const description = document.getElementById('newPatDescription').value.trim();

    const primaryImg = document.getElementById('newPatImageUrl').value.trim() || '/assets/tools/pattern-placeholder.svg';
    const moreImgs = document
      .getElementById('newPatMoreImages')
      .value.split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const images = [primaryImg, ...moreImgs].filter(Boolean);

    const pdfInputEl = document.getElementById('newPatPdfUrl');
    const pdfDownloadUrl = pdfInputEl.value.trim();
    const cadDownloadUrl = document.getElementById('newPatCadUrl').value.trim();
    const pdfFiles = pdfDownloadUrl ? [pdfDownloadUrl] : [];
    const cadFiles = cadDownloadUrl ? [cadDownloadUrl] : [];

    const variantPrices = {
      pdf_dxf: Number(document.getElementById('newPatPricePdf').value) || 0,
      rap_giay: Number(document.getElementById('newPatPricePaper').value) || 55000,
      rap_mica: Number(document.getElementById('newPatPriceMica').value) || 135000,
      khuon_be: Number(document.getElementById('newPatPriceDie').value) || 450000
    };

    if (editSku) {
      const p = adminState.products.find((prod) => prod.sku === editSku);
      if (p) {
        p.title = title;
        p.paperSizes = paperSizes.length ? paperSizes : ['A4'];
        p.leatherThickness = leatherThickness;
        p.chiselPitch = chiselPitch;
        p.leatherEstimate = leatherEstimate;
        p.difficulty = difficulty;
        p.description = description;
        p.images = images;
        p.primaryImage = images[0] || '/assets/tools/pattern-placeholder.svg';
        p.imageCount = images.length;
        p.pdfFiles = pdfFiles;
        p.pdfFileNames = pdfFiles.map((f) => String(f).split('/').pop() || 'ban-ve.pdf');
        p.pdfCount = pdfFiles.length;
        if (pdfInputEl && pdfInputEl.dataset.uploadedSizeMb) {
          const sz = Number(pdfInputEl.dataset.uploadedSizeMb);
          if (sz > 0) p.fileSizeMB = sz;
        }
        p.cadFiles = cadFiles;
        p.cadCount = cadFiles.length;
        p._editedAt = Date.now();

        const catObj = adminState.categories.find((c) => c.key === categoryKey);
        if (catObj) {
          p.categoryKey = catObj.key;
          p.categoryName = catObj.name;
          p.categoryShort = catObj.shortName;
          p.categorySlug = catObj.slug;
        }

        for (const v of p.variants || []) {
          if (variantPrices[v.id] !== undefined) v.price = variantPrices[v.id];
          if (v.id === 'pdf_dxf') {
            v.badge = variantPrices.pdf_dxf === 0 ? 'Miễn phí tải ngay' : 'Tải tự động 24/7';
          }
        }
        p.isFreePdf = variantPrices.pdf_dxf === 0;
      }

      if (adminState.isLocalBackend) {
        try {
          await fetch(`/api/product/${encodeURIComponent(editSku)}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              title,
              categoryKey,
              paperSizes,
              leatherThickness,
              chiselPitch,
              leatherEstimate,
              difficulty,
              description,
              images,
              pdfFiles,
              cadFiles,
              variantPrices
            })
          });
        } catch {
          // offline fallback
        }
      }

      syncCatalogStatsAndPersistLocal();
      renderKPIs();
      populateCategorySelects();
      renderPatternsTable();
      addPatModal.classList.add('hidden');
      showToast(`✅ Đã cập nhật chi tiết mẫu rập [${editSku}] thành công!`);
      return;
    }

    let createdProduct = null;
    try {
      const res = await fetch('/api/product', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title,
          categoryKey,
          sku: skuInput,
          paperSizes,
          leatherThickness,
          chiselPitch,
          leatherEstimate,
          difficulty,
          description,
          images,
          pdfFiles,
          cadFiles,
          pdfPrice: variantPrices.pdf_dxf,
          paperPrice: variantPrices.rap_giay,
          micaPrice: variantPrices.rap_mica,
          diePrice: variantPrices.khuon_be,
          vendorId,
          vendorName
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) createdProduct = data.product;
      }
    } catch {
      // fallback local creation
    }

    if (!createdProduct) {
      const catObj =
        adminState.categories.find((c) => c.key === categoryKey) || adminState.categories[0];
      const sku = skuInput || `RM-NEW-${String(adminState.products.length + 1).padStart(3, '0')}`;
      createdProduct = {
        id: sku.toLowerCase(),
        sku,
        slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sku.toLowerCase()}`,
        title,
        vendorId,
        vendorName,
        categoryKey: catObj ? catObj.key : 'vi-da',
        categoryName: catObj ? catObj.name : 'Rập Ví Da',
        categoryShort: catObj ? catObj.shortName : 'Ví Da',
        folderPath: 'Mẫu mới',
        images,
        imageCount: images.length,
        paperSizes: paperSizes.length ? paperSizes : ['A4'],
        leatherThickness,
        chiselPitch,
        leatherEstimate,
        difficulty,
        description,
        isFreePdf: variantPrices.pdf_dxf === 0,
        pdfFiles,
        pdfCount: pdfFiles.length,
        cadFiles,
        cadCount: cadFiles.length,
        variants: [
          { id: 'pdf_dxf', name: 'File PDF / DXF (Tải ngay 1:1)', price: variantPrices.pdf_dxf },
          { id: 'rap_giay', name: 'Rập Giấy Cứng 350gsm (Cắt máy sẵn)', price: variantPrices.rap_giay },
          { id: 'rap_mica', name: 'Rập Mica Trong 2mm (Cắt Laser CNC)', price: variantPrices.rap_mica },
          { id: 'khuon_be', name: 'Khuôn Bế Thép (Đặt theo mẫu)', price: variantPrices.khuon_be }
        ]
      };
    }

    adminState.products.unshift(createdProduct);
    syncCatalogStatsAndPersistLocal();
    renderKPIs();
    populateCategorySelects();
    renderPatternsTable();
    addPatModal.classList.add('hidden');
    e.target.reset();
    showToast(`✅ Đã thêm mẫu rập mới [${createdProduct.sku}]!`);
  });

  // Cập nhật giá hàng loạt theo Danh mục
  document.getElementById('bulkPriceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const categoryKey = document.getElementById('bulkCategorySelect').value;
    const prices = {
      pdf_dxf: Number(document.getElementById('bulkPdfPrice').value) || 0,
      rap_giay: Number(document.getElementById('bulkPaperPrice').value) || 0,
      rap_mica: Number(document.getElementById('bulkMicaPrice').value) || 0,
      khuon_be: Number(document.getElementById('bulkDiePrice').value) || 0
    };

    let updatedCount = 0;
    for (const p of adminState.products) {
      if (categoryKey === 'all' || p.categoryKey === categoryKey) {
        for (const v of p.variants || []) {
          if (prices[v.id] !== undefined) v.price = prices[v.id];
        }
        p.isFreePdf = prices.pdf_dxf === 0;
        updatedCount++;
      }
    }

    try {
      await fetch('/api/category-bulk-price', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ categoryKey, prices })
      });
    } catch {
      // offline fallback
    }

    syncCatalogStatsAndPersistLocal();
    renderKPIs();
    renderPatternsTable();
    showToast(`⚡ Đã cập nhật giá hàng loạt cho ${updatedCount} mẫu rập!`);
  });

  // ==================== TAB 2: QUẢN LÝ DỤNG CỤ & PHỤ KIỆN ====================
  const vendorFilterEl = document.getElementById('adminToolVendorFilter');
  if (vendorFilterEl) {
    vendorFilterEl.addEventListener('change', (e) => {
      if (isVendorSession()) return;
      adminState.selectedToolVendor = e.target.value;
      renderToolsTable();
    });
  }

  document.getElementById('adminToolCatFilter').addEventListener('change', (e) => {
    adminState.selectedToolCat = e.target.value;
    renderToolsTable();
  });
  document.getElementById('adminToolSearchInput').addEventListener('input', (e) => {
    adminState.toolSearchQuery = e.target.value;
    renderToolsTable();
  });

  const selectAllToolsChk = document.getElementById('selectAllToolsChk');
  if (selectAllToolsChk) {
    selectAllToolsChk.addEventListener('change', (e) => {
      const filtered = getFilteredTools();
      for (const a of filtered) {
        if (e.target.checked) adminState.selectedToolIds.add(a.id);
        else adminState.selectedToolIds.delete(a.id);
      }
      renderToolsTable();
    });
  }

  document.getElementById('adminToolsTableBody').addEventListener('change', (e) => {
    const chk = e.target.closest('[data-check-tool]');
    if (!chk) return;
    const id = chk.dataset.checkTool;
    if (chk.checked) adminState.selectedToolIds.add(id);
    else adminState.selectedToolIds.delete(id);
    updateSelectedToolsCounter();
  });

  const toolModal = document.getElementById('toolFormModal');
  document.getElementById('btnOpenAddToolModal').addEventListener('click', () => {
    const sess = getAuthSession();
    document.getElementById('toolModalHeading').textContent = isVendorSession()
      ? `➕ Thêm Sản Phẩm Mới (${sess.vendorName})`
      : '➕ Thêm Dụng Cụ / Phụ Kiện Mới';
    document.getElementById('editToolId').value = '';
    document.getElementById('toolModalForm').reset();
    document.getElementById('toolFormShopeeUrl').value = 'https://shopee.vn/dathungleather';
    document.getElementById('toolFormTiktokUrl').value = 'https://www.tiktok.com/@rapmau.com';
    const vSel = document.getElementById('toolFormVendorSelect');
    if (vSel) {
      vSel.value = getActiveVendorId() || 'dathungleather';
    }
    toolModal.classList.remove('hidden');
  });
  document.getElementById('closeToolModalBtn').addEventListener('click', () => {
    toolModal.classList.add('hidden');
  });
  document.getElementById('toolFormImageFile').addEventListener('change', (e) => {
    handleImageFileUpload(e.target, document.getElementById('toolFormImageUrl'));
  });

  document.getElementById('adminToolsTableBody').addEventListener('click', async (e) => {
    const saveBtn = e.target.closest('[data-save-tool]');
    if (saveBtn) {
      const id = saveBtn.dataset.saveTool;
      const row = saveBtn.closest('tr');
      const payload = {
        title: row.querySelector('[data-tfield="title"]').value.trim(),
        badge: row.querySelector('[data-tfield="badge"]').value.trim(),
        price: Number(row.querySelector('[data-tfield="price"]').value) || 0,
        originalPrice: Number(row.querySelector('[data-tfield="originalPrice"]').value) || 0
      };

      const item = adminState.accessories.find((a) => a.id === id);
      if (item) {
        Object.assign(item, payload);
      }

      try {
        await fetch(`/api/accessory/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
      } catch {
        // offline
      }

      syncCatalogStatsAndPersistLocal();
      showToast(`✅ Đã lưu sản phẩm ${item?.sku || id}!`);
      return;
    }

    const editBtn = e.target.closest('[data-edit-tool]');
    if (editBtn) {
      const id = editBtn.dataset.editTool;
      const item = adminState.accessories.find((a) => a.id === id);
      if (!item) return;
      document.getElementById('toolModalHeading').textContent = `✏️ Chỉnh Sửa Chi Tiết [${item.sku}]`;
      document.getElementById('editToolId').value = item.id;
      document.getElementById('toolFormTitle').value = item.title || '';
      document.getElementById('toolFormSku').value = item.sku || '';
      document.getElementById('toolFormCategory').value = item.category || '';
      document.getElementById('toolFormBadge').value = item.badge || '';
      document.getElementById('toolFormPrice').value = item.price || 0;
      document.getElementById('toolFormOriginalPrice').value = item.originalPrice || 0;
      document.getElementById('toolFormImageUrl').value = (item.images && item.images[0]) || '';
      document.getElementById('toolFormDesc').value = item.description || '';
      document.getElementById('toolFormSpecs').value = (item.specs || []).join('\n');
      document.getElementById('toolFormShopeeUrl').value = item.shopeeUrl || 'https://shopee.vn/dathungleather';
      document.getElementById('toolFormTiktokUrl').value = item.tiktokUrl || 'https://www.tiktok.com/@rapmau.com';
      const vSel = document.getElementById('toolFormVendorSelect');
      if (vSel) vSel.value = inferItemVendorId(item);
      toolModal.classList.remove('hidden');
      return;
    }

    const delBtn = e.target.closest('[data-delete-tool]');
    if (delBtn) {
      const id = delBtn.dataset.deleteTool;
      const item = adminState.accessories.find((a) => a.id === id);
      if (!window.confirm(`Bạn có chắc chắn muốn XOÁ sản phẩm [${item?.sku || id}] "${item?.title || ''}" không?`)) {
        return;
      }

      adminState.accessories = adminState.accessories.filter((a) => a.id !== id);
      adminState.selectedToolIds.delete(id);

      try {
        await fetch(`/api/accessory/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
      } catch {
        // offline
      }

      syncCatalogStatsAndPersistLocal();
      renderKPIs();
      populateVendorSelects();
      renderToolsTable();
      renderVendorsTable();
      showToast(`🗑️ Đã xoá sản phẩm [${item?.sku || id}]!`);
    }
  });

  // Xoá hàng loạt dụng cụ đã chọn
  document.getElementById('btnBulkDeleteTools').addEventListener('click', async () => {
    const ids = Array.from(adminState.selectedToolIds);
    if (ids.length === 0) {
      showToast('⚠️ Vui lòng tích chọn ít nhất 1 sản phẩm để xoá!', true);
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn XOÁ ${ids.length} sản phẩm đã chọn không?`)) {
      return;
    }

    const idSet = new Set(ids);
    adminState.accessories = adminState.accessories.filter((a) => !idSet.has(a.id));
    adminState.selectedToolIds.clear();

    try {
      await fetch('/api/accessories/bulk-delete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids })
      });
    } catch {
      // offline
    }

    syncCatalogStatsAndPersistLocal();
    renderKPIs();
    populateVendorSelects();
    renderToolsTable();
    renderVendorsTable();
    showToast(`🗑️ Đã xoá ${ids.length} sản phẩm không cần thiết!`);
  });

  // Lưu form Thêm / Sửa chi tiết dụng cụ
  document.getElementById('toolModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editToolId').value.trim();
    const sess = getAuthSession();
    const chosenVendorId = isVendorSession()
      ? sess.vendorId
      : document.getElementById('toolFormVendorSelect')?.value || 'rapmau';
    const vendorObj = adminState.vendors.find((v) => v.vendorId === chosenVendorId);
    const chosenVendorName = isVendorSession()
      ? sess.vendorName
      : vendorObj?.vendorName || 'Xưởng RAPMAU.COM';

    const payload = {
      title: document.getElementById('toolFormTitle').value.trim(),
      sku: document.getElementById('toolFormSku').value.trim(),
      category: document.getElementById('toolFormCategory').value.trim() || 'Dụng Cụ Đục & Khâu',
      badge: document.getElementById('toolFormBadge').value.trim() || `Sẵn hàng • ${chosenVendorName}`,
      price: Number(document.getElementById('toolFormPrice').value) || 0,
      originalPrice: Number(document.getElementById('toolFormOriginalPrice').value) || 0,
      imageUrl: document.getElementById('toolFormImageUrl').value.trim() || '/assets/tools/tool-1.svg',
      description: document.getElementById('toolFormDesc').value.trim(),
      shopeeUrl: document.getElementById('toolFormShopeeUrl').value.trim() || 'https://shopee.vn/dathungleather',
      tiktokUrl: document.getElementById('toolFormTiktokUrl').value.trim() || 'https://www.tiktok.com/@rapmau.com',
      vendorId: chosenVendorId,
      vendorName: chosenVendorName,
      specs: document
        .getElementById('toolFormSpecs')
        .value.split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    };

    if (editId) {
      const item = adminState.accessories.find((a) => a.id === editId);
      if (item) {
        Object.assign(item, payload, { images: [payload.imageUrl] });
      }
      try {
        await fetch(`/api/accessory/${encodeURIComponent(editId)}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...payload, images: [payload.imageUrl] })
        });
      } catch {
        // offline
      }
      showToast(`✅ Đã cập nhật chi tiết [${payload.sku}]!`);
    } else {
      let createdItem = null;
      const prefix = vendorObj?.skuPrefix || 'NCC';
      const skuFinal =
        payload.sku || `${prefix}-${String(adminState.accessories.length + 1).padStart(3, '0')}`;
      try {
        const res = await fetch('/api/accessory', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...payload,
            sku: skuFinal,
            images: [payload.imageUrl]
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok) createdItem = data.item;
        }
      } catch {
        // offline
      }
      if (!createdItem) {
        createdItem = {
          id: `${chosenVendorId}-tool-${Date.now()}`,
          sku: skuFinal,
          title: payload.title,
          category: payload.category,
          vendorId: chosenVendorId,
          vendorName: chosenVendorName,
          price: payload.price,
          originalPrice: payload.originalPrice || Math.round(payload.price * 1.25),
          unit: 'Bộ / Sản phẩm',
          badge: payload.badge,
          images: [payload.imageUrl],
          specs: payload.specs.length ? payload.specs : [`Cung cấp bởi ${chosenVendorName}`],
          description: payload.description || payload.title
        };
      }
      adminState.accessories.unshift(createdItem);
      showToast(`✅ Đã thêm sản phẩm mới [${createdItem.sku}] cho ${chosenVendorName}!`);
    }

    syncCatalogStatsAndPersistLocal();
    renderKPIs();
    populateVendorSelects();
    renderToolsTable();
    renderVendorsTable();
    toolModal.classList.add('hidden');
  });

  // ==================== TAB 4B: QUẢN LÝ & PHÂN QUYỀN NHÀ CUNG CẤP ====================
  const vendorForm = document.getElementById('vendorAccountForm');
  const resetVendorBtn = document.getElementById('btnResetVendorForm');
  if (resetVendorBtn && vendorForm) {
    resetVendorBtn.addEventListener('click', () => {
      vendorForm.reset();
      document.getElementById('vendorFormHeading').textContent =
        '➕ Cấp Tài Khoản Mới Cho Nhà Cung Cấp';
    });
  }

  if (vendorForm) {
    vendorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const vendorName = document.getElementById('vFormName').value.trim();
      const vendorId = document
        .getElementById('vFormVendorId')
        .value.trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-');
      const username = document.getElementById('vFormUsername').value.trim().toLowerCase();
      const password = document.getElementById('vFormPassword').value.trim();
      const skuPrefix = document.getElementById('vFormSkuPrefix').value.trim().toUpperCase() || 'NCC';
      const phone = document.getElementById('vFormPhone').value.trim();
      const website = document.getElementById('vFormWebsite').value.trim();
      const allowTools = document.getElementById('vFormAllowTools').checked;
      const allowPatterns = document.getElementById('vFormAllowPatterns').checked;

      const pwdHash = await sha256HexBrowser(password);
      const existingIdx = adminState.vendors.findIndex(
        (v) => v.vendorId === vendorId || String(v.username).toLowerCase() === username
      );
      const newVendorObj = {
        id: existingIdx !== -1 ? adminState.vendors[existingIdx].id : `vendor-${Date.now()}`,
        vendorId,
        vendorName,
        username,
        passwordHash: pwdHash,
        role: vendorId === 'all' ? 'super_admin' : 'vendor',
        skuPrefix,
        phone,
        website,
        allowTools,
        allowPatterns,
        active: true
      };

      if (existingIdx !== -1) {
        adminState.vendors[existingIdx] = newVendorObj;
      } else {
        adminState.vendors.push(newVendorObj);
      }

      try {
        await fetch('/api/vendors', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            vendorId,
            vendorName,
            username,
            password,
            skuPrefix,
            phone,
            website,
            allowTools,
            allowPatterns
          })
        });
      } catch {
        // offline fallback
      }

      syncCatalogStatsAndPersistLocal();
      renderKPIs();
      populateVendorSelects();
      renderVendorsTable();
      vendorForm.reset();
      showToast(`✅ Đã lưu tài khoản Nhà cung cấp [${vendorName}] (User: ${username})!`);
    });
  }

  const vendorsTbody = document.getElementById('adminVendorsTableBody');
  if (vendorsTbody) {
    vendorsTbody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-vendor]');
      if (editBtn) {
        const vid = editBtn.dataset.editVendor;
        const v = adminState.vendors.find((x) => x.vendorId === vid);
        if (!v) return;
        document.getElementById('vendorFormHeading').textContent = `✏️ Cập Nhật / Đổi MK: ${v.vendorName}`;
        document.getElementById('vFormName').value = v.vendorName || '';
        document.getElementById('vFormVendorId').value = v.vendorId || '';
        document.getElementById('vFormUsername').value = v.username || '';
        document.getElementById('vFormPassword').value = '';
        document.getElementById('vFormPassword').placeholder = 'Nhập mật khẩu mới cho NCC...';
        document.getElementById('vFormSkuPrefix').value = v.skuPrefix || 'NCC';
        document.getElementById('vFormPhone').value = v.phone || '';
        document.getElementById('vFormWebsite').value = v.website || '';
        document.getElementById('vFormAllowTools').checked = v.allowTools !== false;
        document.getElementById('vFormAllowPatterns').checked = Boolean(v.allowPatterns);
        document.getElementById('vFormPassword').focus();
        return;
      }

      const delBtn = e.target.closest('[data-delete-vendor]');
      if (delBtn) {
        const vid = delBtn.dataset.deleteVendor;
        const v = adminState.vendors.find((x) => x.vendorId === vid);
        if (!window.confirm(`Bạn có chắc muốn xoá tài khoản Nhà cung cấp "${v?.vendorName || vid}" không?`)) {
          return;
        }
        adminState.vendors = adminState.vendors.filter((x) => x.vendorId !== vid);
        try {
          await fetch(`/api/vendors/${encodeURIComponent(vid)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
        } catch {
          // offline
        }
        syncCatalogStatsAndPersistLocal();
        renderKPIs();
        populateVendorSelects();
        renderVendorsTable();
        showToast(`🗑️ Đã xoá tài khoản Nhà cung cấp [${v?.vendorName || vid}]!`);
      }
    });
  }

  // ==================== TAB 3: TỦ SÁCH & NHÓM ZALO ====================
  document.getElementById('quickZaloGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('quickZaloGroupInput').value.trim();
    const site = { ...(adminState.catalog.site || {}), zaloGroupUrl: url };
    adminState.catalog.site = site;
    try {
      await fetch('/api/site-config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ site })
      });
    } catch {
      // offline
    }
    syncCatalogStatsAndPersistLocal();
    document.getElementById('cfgZaloGroupUrl').value = url;
    showToast('✅ Đã cập nhật Link Nhóm Zalo nhận sách miễn phí!');
  });

  document.getElementById('adminBooksTableBody').addEventListener('click', async (e) => {
    const saveBtn = e.target.closest('[data-save-book]');
    if (saveBtn) {
      const id = saveBtn.dataset.saveBook;
      const row = saveBtn.closest('tr');
      const title = row.querySelector('[data-bfield="title"]').value.trim();
      const book = adminState.freeBooks.find((b) => b.id === id);
      if (book) book.title = title;
      try {
        await fetch(`/api/book/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ title })
        });
      } catch {
        // offline
      }
      syncCatalogStatsAndPersistLocal();
      showToast(`✅ Đã lưu tên sách [${id}]!`);
      return;
    }

    const delBtn = e.target.closest('[data-delete-book]');
    if (delBtn) {
      const id = delBtn.dataset.deleteBook;
      const book = adminState.freeBooks.find((b) => b.id === id);
      if (!window.confirm(`Bạn có chắc muốn xoá sách [${id}] "${book?.title || ''}" không?`)) {
        return;
      }
      adminState.freeBooks = adminState.freeBooks.filter((b) => b.id !== id);
      try {
        await fetch(`/api/book/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
      } catch {
        // offline
      }
      syncCatalogStatsAndPersistLocal();
      renderKPIs();
      renderBooksTable();
      showToast(`🗑️ Đã xoá sách [${id}]!`);
    }
  });

  // ==================== TAB 4C: QUẢN LÝ BÀI VIẾT SEO & AEO ====================
  const articlesTbody = document.getElementById('adminArticlesTableBody');
  const articleForm = document.getElementById('articleCmsForm');
  const resetArtBtn = document.getElementById('btnResetArticleForm');

  const artImgFile = document.getElementById('artFormImageFile');
  const artImgUrl = document.getElementById('artFormImage');
  if (artImgFile && artImgUrl) {
    artImgFile.addEventListener('change', () => handleImageUpload(artImgFile, artImgUrl, 'article'));
  }

  // Công cụ chèn nhanh thẻ HTML & ảnh cho trình soạn thảo bài viết
  const insertSnippetAtCursor = (textarea, beforeText, afterText = '') => {
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const selected = textarea.value.slice(start, end) || 'Nội dung';
    const inserted = beforeText + selected + afterText;
    textarea.value = textarea.value.slice(0, start) + inserted + textarea.value.slice(end);
    textarea.focus();
    textarea.selectionStart = start + beforeText.length;
    textarea.selectionEnd = start + beforeText.length + selected.length;
  };

  document.querySelectorAll('.html-quick-bar [data-ins]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bar = btn.closest('.html-quick-bar');
      const targetId = bar?.dataset.target;
      const ta = targetId ? document.getElementById(targetId) : null;
      const parts = String(btn.dataset.ins || '|').split('|');
      insertSnippetAtCursor(ta, parts[0] || '', parts[1] || '');
    });
  });

  document.querySelectorAll('.html-insert-img-file').forEach((fileEl) => {
    fileEl.addEventListener('change', () => {
      const targetId = fileEl.dataset.target;
      const ta = targetId ? document.getElementById(targetId) : null;
      if (!ta || !fileEl.files?.[0]) return;
      const fakeInput = { value: '' };
      handleImageUpload(fileEl, fakeInput, 'article-inline', (uploadedUrl) => {
        const imgTag = `\n<p><img src="${uploadedUrl}" alt="Hình minh họa" style="max-width:100%; border-radius:10px;" /></p>\n`;
        const pos = ta.selectionStart ?? ta.value.length;
        ta.value = ta.value.slice(0, pos) + imgTag + ta.value.slice(pos);
        ta.focus();
      });
    });
  });

  if (resetArtBtn && articleForm) {
    resetArtBtn.addEventListener('click', () => {
      articleForm.reset();
      document.getElementById('artFormId').value = '';
      if (artImgUrl) artImgUrl.value = '/assets/brand/hero-workbench.jpg';
      document.getElementById('articleFormHeading').textContent = '➕ Thêm / Chỉnh Sửa Bài Viết SEO & AEO';
    });
  }

  if (articlesTbody) {
    articlesTbody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-art]');
      if (editBtn) {
        const art = (adminState.articles || []).find((a) => a.id === editBtn.dataset.editArt);
        if (!art) return;
        document.getElementById('artFormId').value = art.id;
        document.getElementById('artFormTitle').value = art.title || '';
        document.getElementById('artFormCategory').value = art.category || 'Kỹ Thuật Rập & Bản Vẽ';
        if (document.getElementById('artFormImage')) document.getElementById('artFormImage').value = art.image || '/assets/brand/hero-workbench.jpg';
        if (document.getElementById('artFormAuthor')) document.getElementById('artFormAuthor').value = art.author || 'Kỹ Sư Thiết Kế Rập RAPMAU.COM';
        if (document.getElementById('artFormReadTime')) document.getElementById('artFormReadTime').value = art.readTime || '6 phút đọc';
        document.getElementById('artFormAeoQuestion').value = art.aeoQuestion || '';
        document.getElementById('artFormAeoAnswer').value = art.aeoAnswer || '';
        document.getElementById('artFormExcerpt').value = art.excerpt || '';
        document.getElementById('artFormContentHtml').value = art.contentHtml || '';
        document.getElementById('articleFormHeading').textContent = `✏️ Đang sửa bài viết [${art.id}]`;
        articleForm?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      const delBtn = e.target.closest('[data-del-art]');
      if (delBtn) {
        const id = delBtn.dataset.delArt;
        const art = (adminState.articles || []).find((a) => a.id === id);
        if (!window.confirm(`Bạn có chắc muốn XOÁ bài viết [${id}] "${art?.title || ''}"?`)) return;
        adminState.articles = (adminState.articles || []).filter((a) => a.id !== id);
        adminState.catalog.articles = adminState.articles;
        try {
          await fetch(`/api/article/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
        } catch {
          // offline
        }
        syncCatalogStatsAndPersistLocal();
        renderKPIs();
        renderArticlesTable();
        showToast(`🗑️ Đã xoá bài viết [${id}]!`);
      }
    });
  }

  if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const existingId = document.getElementById('artFormId').value.trim();
      const payload = {
        id: existingId || `ART-${String((adminState.articles?.length || 0) + 1).padStart(2, '0')}`,
        title: document.getElementById('artFormTitle').value.trim(),
        category: document.getElementById('artFormCategory').value,
        image: (document.getElementById('artFormImage')?.value || '').trim() || '/assets/brand/hero-workbench.jpg',
        author: (document.getElementById('artFormAuthor')?.value || '').trim() || 'Kỹ Sư Thiết Kế Rập RAPMAU.COM',
        readTime: (document.getElementById('artFormReadTime')?.value || '').trim() || '6 phút đọc',
        aeoQuestion: document.getElementById('artFormAeoQuestion').value.trim(),
        aeoAnswer: document.getElementById('artFormAeoAnswer').value.trim(),
        excerpt: document.getElementById('artFormExcerpt').value.trim(),
        contentHtml: document.getElementById('artFormContentHtml').value
      };

      if (existingId) {
        const idx = adminState.articles.findIndex((a) => a.id === existingId);
        if (idx !== -1) {
          adminState.articles[idx] = {
            ...adminState.articles[idx],
            ...payload,
            updatedAt: new Date().toISOString().slice(0, 10)
          };
        }
        try {
          await fetch(`/api/article/${encodeURIComponent(existingId)}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
          });
        } catch {
          // offline
        }
      } else {
        const slug = payload.title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const newArt = {
          ...payload,
          slug,
          publishedAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
          keyTakeaways: [],
          faqs: []
        };
        try {
          const res = await fetch('/api/article', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(newArt)
          });
          if (res.ok) {
            const json = await res.json();
            if (json.article) Object.assign(newArt, json.article);
          }
        } catch {
          // offline
        }
        adminState.articles.unshift(newArt);
      }

      adminState.catalog.articles = adminState.articles;
      syncCatalogStatsAndPersistLocal();
      renderKPIs();
      renderArticlesTable();
      articleForm.reset();
      document.getElementById('artFormId').value = '';
      if (artImgUrl) artImgUrl.value = '/assets/brand/hero-workbench.jpg';
      document.getElementById('articleFormHeading').textContent = '➕ Thêm / Chỉnh Sửa Bài Viết SEO & AEO';
      showToast(`✅ Đã lưu bài viết [${payload.id}] thành công!`);
    });
  }

  // ==================== TAB 4D: QUẢN LÝ BÀI VIẾT & NỘI DUNG TRANG B2B (/b2b/) ====================
  const b2bArticlesTbody = document.getElementById('adminB2bArticlesTableBody');
  const b2bArticleForm = document.getElementById('b2bArticleCmsForm');
  const b2bSectionsForm = document.getElementById('b2bSectionsForm');
  const b2bResetArtBtn = document.getElementById('btnResetB2bArticleForm');
  const b2bArtImgFile = document.getElementById('b2bArtImageFile');
  const b2bArtImgInput = document.getElementById('b2bArtImage');
  const b2bArtImgPreview = document.getElementById('b2bArtImagePreview');
  const b2bHeroImgFile = document.getElementById('b2bHeroImageFile');
  const b2bHeroImgInput = document.getElementById('b2bHeroImage');

  if (b2bArtImgInput && b2bArtImgPreview) {
    b2bArtImgInput.addEventListener('input', () => {
      b2bArtImgPreview.src = b2bArtImgInput.value.trim() || '/assets/brand/hero-workbench.jpg';
    });
  }
  if (b2bArtImgFile && b2bArtImgInput) {
    b2bArtImgFile.addEventListener('change', () =>
      handleImageUpload(b2bArtImgFile, b2bArtImgInput, 'b2b-art', (url) => {
        if (b2bArtImgPreview) b2bArtImgPreview.src = url;
      })
    );
  }
  if (b2bHeroImgFile && b2bHeroImgInput) {
    b2bHeroImgFile.addEventListener('change', () => handleImageUpload(b2bHeroImgFile, b2bHeroImgInput, 'b2b-hero'));
  }

  if (b2bResetArtBtn && b2bArticleForm) {
    b2bResetArtBtn.addEventListener('click', () => {
      b2bArticleForm.reset();
      document.getElementById('b2bArtId').value = '';
      if (b2bArtImgInput) b2bArtImgInput.value = '/assets/brand/hero-workbench.jpg';
      if (b2bArtImgPreview) b2bArtImgPreview.src = '/assets/brand/hero-workbench.jpg';
      document.getElementById('b2bArticleFormHeading').textContent = '➕ Thêm / Chỉnh Sửa Bài Viết Trang B2B';
    });
  }

  if (b2bArticlesTbody) {
    b2bArticlesTbody.addEventListener('click', async (e) => {
      const b2b = getB2bState();
      b2b.articles = Array.isArray(b2b.articles) ? b2b.articles : [];

      const editBtn = e.target.closest('[data-edit-b2b-art]');
      if (editBtn) {
        const art = b2b.articles.find((a) => a.id === editBtn.dataset.editB2bArt);
        if (!art) return;
        document.getElementById('b2bArtId').value = art.id;
        document.getElementById('b2bArtTitle').value = art.title || '';
        document.getElementById('b2bArtCategory').value = art.category || 'Quà Tặng Doanh Nghiệp';
        document.getElementById('b2bArtAuthor').value = art.author || 'Mr.Tuân - Xưởng RAPMAU.COM';
        document.getElementById('b2bArtReadTime').value = art.readTime || '5 phút đọc';
        document.getElementById('b2bArtImage').value = art.image || '/assets/brand/hero-workbench.jpg';
        if (b2bArtImgPreview) b2bArtImgPreview.src = art.image || '/assets/brand/hero-workbench.jpg';
        document.getElementById('b2bArtExcerpt').value = art.excerpt || '';
        document.getElementById('b2bArtContentHtml').value = art.contentHtml || '';
        document.getElementById('b2bArticleFormHeading').textContent = `✏️ Đang sửa bài viết B2B [${art.id}]`;
        b2bArticleForm?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      const delBtn = e.target.closest('[data-del-b2b-art]');
      if (delBtn) {
        const id = delBtn.dataset.delB2bArt;
        const art = b2b.articles.find((a) => a.id === id);
        if (!window.confirm(`Bạn có chắc muốn XOÁ bài viết B2B [${id}] "${art?.title || ''}"?`)) return;
        b2b.articles = b2b.articles.filter((a) => a.id !== id);
        try {
          await fetch(`/api/b2b-article/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
        } catch {
          // offline
        }
        syncCatalogStatsAndPersistLocal();
        renderKPIs();
        renderB2bArticlesTable();
        showToast(`🗑️ Đã xoá bài viết B2B [${id}]!`);
      }
    });
  }

  if (b2bArticleForm) {
    b2bArticleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b2b = getB2bState();
      b2b.articles = Array.isArray(b2b.articles) ? b2b.articles : [];

      const existingId = document.getElementById('b2bArtId').value.trim();
      const payload = {
        id: existingId || `B2B-ART-${String(b2b.articles.length + 1).padStart(2, '0')}`,
        title: document.getElementById('b2bArtTitle').value.trim(),
        category: document.getElementById('b2bArtCategory').value,
        author: document.getElementById('b2bArtAuthor').value.trim() || 'Mr.Tuân - Xưởng RAPMAU.COM',
        readTime: document.getElementById('b2bArtReadTime').value.trim() || '5 phút đọc',
        image: document.getElementById('b2bArtImage').value.trim() || '/assets/brand/hero-workbench.jpg',
        excerpt: document.getElementById('b2bArtExcerpt').value.trim(),
        contentHtml: document.getElementById('b2bArtContentHtml').value
      };

      if (existingId) {
        const idx = b2b.articles.findIndex((a) => a.id === existingId);
        if (idx !== -1) {
          b2b.articles[idx] = {
            ...b2b.articles[idx],
            ...payload,
            updatedAt: new Date().toISOString().slice(0, 10)
          };
        }
        try {
          await fetch(`/api/b2b-article/${encodeURIComponent(existingId)}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
          });
        } catch {
          // offline
        }
      } else {
        const slug = payload.title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const newArt = {
          ...payload,
          slug,
          updatedAt: new Date().toISOString().slice(0, 10)
        };
        try {
          const res = await fetch('/api/b2b-article', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(newArt)
          });
          if (res.ok) {
            const json = await res.json();
            if (json.article) Object.assign(newArt, json.article);
          }
        } catch {
          // offline
        }
        b2b.articles.unshift(newArt);
      }

      syncCatalogStatsAndPersistLocal();
      renderKPIs();
      renderB2bArticlesTable();
      b2bArticleForm.reset();
      document.getElementById('b2bArtId').value = '';
      if (b2bArtImgInput) b2bArtImgInput.value = '/assets/brand/hero-workbench.jpg';
      if (b2bArtImgPreview) b2bArtImgPreview.src = '/assets/brand/hero-workbench.jpg';
      document.getElementById('b2bArticleFormHeading').textContent = '➕ Thêm / Chỉnh Sửa Bài Viết Trang B2B';
      showToast(`✅ Đã lưu bài viết B2B [${payload.id}] thành công!`);
    });
  }

  const saveB2bSections = async (shouldPublish = false) => {
    const b2b = getB2bState();
    const statsLines = (document.getElementById('b2bHeroStatsLines')?.value || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [num, ...rest] = line.split('|');
        return { num: (num || '').trim(), label: rest.join('|').trim() };
      });

    b2b.hero = {
      ...(b2b.hero || {}),
      tag: document.getElementById('b2bHeroTag')?.value.trim() || '',
      titleHtml: document.getElementById('b2bHeroTitleHtml')?.value.trim() || '',
      descHtml: document.getElementById('b2bHeroDescHtml')?.value.trim() || '',
      image: document.getElementById('b2bHeroImage')?.value.trim() || '/assets/brand/hero-workbench.jpg',
      badgeHtml: document.getElementById('b2bHeroBadgeHtml')?.value.trim() || '',
      stats: statsLines
    };

    b2b.articlesSection = {
      tag: document.getElementById('b2bArticlesSecTag')?.value.trim() || 'TIN TỨC & CASE STUDY B2B',
      title: document.getElementById('b2bArticlesSecTitle')?.value.trim() || '',
      desc: document.getElementById('b2bArticlesSecDesc')?.value.trim() || ''
    };

    const existingSvcItems = b2b.servicesSection?.items || [];
    const editedSvcItems = Array.from(document.querySelectorAll('#b2bServicesEditorList [data-b2b-svc-idx]')).map((el, idx) => ({
      ...(existingSvcItems[idx] || {}),
      badge: el.querySelector('.b2b-svc-badge')?.value.trim() || '',
      icon: el.querySelector('.b2b-svc-icon')?.value.trim() || '🎁',
      title: el.querySelector('.b2b-svc-title')?.value.trim() || '',
      body: el.querySelector('.b2b-svc-body')?.value.trim() || '',
      features: (el.querySelector('.b2b-svc-features')?.value || '').split('\n').map((s) => s.trim()).filter(Boolean),
      ctaText: el.querySelector('.b2b-svc-cta')?.value.trim() || 'Nhận báo giá →'
    }));
    b2b.servicesSection = {
      ...(b2b.servicesSection || { tag: 'NĂNG LỰC SẢN XUẤT' }),
      title: document.getElementById('b2bServicesTitle')?.value.trim() || '',
      desc: document.getElementById('b2bServicesDesc')?.value.trim() || '',
      items: editedSvcItems.length ? editedSvcItems : existingSvcItems
    };

    const existingWks = b2b.networkSection?.workshops || [];
    const editedWks = Array.from(document.querySelectorAll('#b2bWorkshopsEditorList [data-b2b-wk-idx]')).map((el, idx) => ({
      ...(existingWks[idx] || {}),
      title: el.querySelector('.b2b-wk-title')?.value.trim() || '',
      cap: el.querySelector('.b2b-wk-cap')?.value.trim() || '',
      specHtml: el.querySelector('.b2b-wk-spec')?.value.trim() || ''
    }));
    b2b.networkSection = {
      ...(b2b.networkSection || { tag: 'LIÊN MINH XƯỞNG CHUYÊN BIỆT' }),
      title: document.getElementById('b2bNetworkTitle')?.value.trim() || '',
      desc: document.getElementById('b2bNetworkDesc')?.value.trim() || '',
      workshops: editedWks.length ? editedWks : existingWks
    };

    const existingMkts = b2b.standardsSection?.markets || [];
    const editedMkts = Array.from(document.querySelectorAll('#b2bMarketsEditorList [data-b2b-mkt-idx]')).map((el, idx) => ({
      ...(existingMkts[idx] || {}),
      title: el.querySelector('.b2b-mkt-title')?.value.trim() || '',
      sub: el.querySelector('.b2b-mkt-sub')?.value.trim() || '',
      itemsHtml: (el.querySelector('.b2b-mkt-items')?.value || '').split('\n').map((s) => s.trim()).filter(Boolean)
    }));
    const pillsCsv = document.getElementById('b2bMaterialPillsCsv')?.value || '';
    b2b.standardsSection = {
      ...(b2b.standardsSection || { tag: 'EXPORT COMPLIANCE READY' }),
      title: document.getElementById('b2bStandardsTitle')?.value.trim() || '',
      desc: document.getElementById('b2bStandardsDesc')?.value.trim() || '',
      markets: editedMkts.length ? editedMkts : existingMkts,
      materialPills: pillsCsv.split(',').map((s) => s.trim()).filter(Boolean)
    };

    try {
      await fetch('/api/b2b-config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ b2b })
      });
    } catch {
      // offline
    }
    syncCatalogStatsAndPersistLocal();
    showToast('✅ Đã lưu toàn bộ nội dung trang /b2b/ thành công!');
    if (shouldPublish) {
      await publishWebsiteChanges();
    }
  };

  if (b2bSectionsForm) {
    b2bSectionsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveB2bSections(false);
    });
  }

  const btnTopSavePublishB2b = document.getElementById('btnTopSavePublishB2b');
  if (btnTopSavePublishB2b) {
    btnTopSavePublishB2b.addEventListener('click', () => saveB2bSections(true));
  }

  // ==================== TAB 5: CẤU HÌNH NỘI DUNG, VIETQR & MẬT KHẨU ====================
  document.getElementById('fullSiteSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedSite = {
      ...(adminState.catalog.site || {}),
      tagline: document.getElementById('cfgTagline').value.trim(),
      ctaNote: document.getElementById('cfgCtaNote').value.trim(),
      hotline: document.getElementById('cfgHotline').value.trim(),
      zalo: document.getElementById('cfgZalo').value.trim(),
      email: document.getElementById('cfgEmail').value.trim(),
      zaloGroupUrl: document.getElementById('cfgZaloGroupUrl').value.trim(),
      address: document.getElementById('cfgAddress').value.trim(),
      bankInfo: {
        bankId: document.getElementById('cfgBankId').value.trim(),
        bankName: document.getElementById('cfgBankId').value.trim(),
        accountNo: document.getElementById('cfgAccountNo').value.trim(),
        accountName: document.getElementById('cfgAccountName').value.trim()
      }
    };
    adminState.catalog.site = updatedSite;
    try {
      await fetch('/api/site-config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ site: updatedSite })
      });
    } catch {
      // offline
    }
    syncCatalogStatsAndPersistLocal();
    renderKPIs();
    updateVietQrPreview();
    showToast('✅ Đã lưu nội dung Website & cấu hình VietQR thành công!');
  });

  // Đổi mật khẩu (hỗ trợ cả Super Admin và từng Nhà Cung Cấp tự đổi mật khẩu riêng)
  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sess = getAuthSession();
    const targetUsername = isVendorSession()
      ? sess.username
      : document.getElementById('pwdNewUsername').value.trim() || 'admin';
    const currentPassword = document.getElementById('pwdCurrentInput').value;
    const newPassword = document.getElementById('pwdNewInput').value;
    const confirmPassword = document.getElementById('pwdConfirmInput').value;

    if (newPassword.length < 4) {
      showToast('❌ Mật khẩu mới phải có ít nhất 4 ký tự!', true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('❌ Mật khẩu xác nhận không khớp!', true);
      return;
    }

    const check = await verifyAdminCredentials(targetUsername, currentPassword);
    if (!check.ok) {
      showToast('❌ Mật khẩu hiện tại không đúng!', true);
      return;
    }

    try {
      await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newUsername: targetUsername, newPassword })
      });
    } catch {
      // offline fallback
    }

    const newHash = await sha256HexBrowser(newPassword);
    const vIdx = adminState.vendors.findIndex(
      (v) => String(v.username || '').toLowerCase() === targetUsername.toLowerCase()
    );
    if (vIdx !== -1) {
      adminState.vendors[vIdx].passwordHash = newHash;
    }
    if (!isVendorSession()) {
      localStorage.setItem(
        ADMIN_CUSTOM_CRED_KEY,
        JSON.stringify({ username: targetUsername, passwordHash: newHash })
      );
    }
    syncCatalogStatsAndPersistLocal();
    setAuthSession({ ...(sess || check), username: targetUsername, token: newHash }, true);
    e.target.reset();
    document.getElementById('pwdNewUsername').value = targetUsername;
    showToast(`🔑 Đã cập nhật mật khẩu cho tài khoản [${targetUsername}] thành công!`);
  });

  ['cfgBankId', 'cfgAccountNo', 'cfgAccountName'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateVietQrPreview);
  });
}

initAdmin();
