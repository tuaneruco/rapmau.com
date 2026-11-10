const CMS_OVERRIDE_KEY = 'rapmau_cms_catalog_override_v2';
const ADMIN_SESSION_KEY = 'rapmau_admin_auth_session';
const ADMIN_CUSTOM_CRED_KEY = 'rapmau_admin_custom_cred';
// SHA-256("Rapmau@2026")
const DEFAULT_ADMIN_USERS = ['admin', 'tuaneruco'];
const DEFAULT_ADMIN_PASS_PLAIN = 'Rapmau@2026';

const adminState = {
  catalog: null,
  products: [],
  categories: [],
  accessories: [],
  freeBooks: [],
  orders: [],
  consultations: [],
  selectedCat: 'all',
  searchQuery: '',
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

function setAuthSession(username, token, remember = true) {
  const payload = JSON.stringify({
    username,
    token,
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

function getAuthHeaders() {
  const sess = getAuthSession();
  return {
    'Content-Type': 'application/json',
    ...(sess?.token ? { 'x-admin-token': sess.token } : {})
  };
}

function syncCatalogStatsAndPersistLocal() {
  if (!adminState.catalog) return;
  adminState.catalog.products = adminState.products;
  adminState.catalog.accessories = adminState.accessories;
  adminState.catalog.freeBooks = adminState.freeBooks;

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

  try {
    localStorage.setItem(CMS_OVERRIDE_KEY, JSON.stringify(adminState.catalog));
  } catch (e) {
    console.warn('Lưu bộ nhớ trình duyệt đầy:', e);
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
        return { ok: true, username: data.username || cleanUser, token: data.token };
      }
    } else if (res.status === 401) {
      const errData = await res.json().catch(() => ({}));
      return { ok: false, error: errData.error || 'Sai tài khoản hoặc mật khẩu quản trị!' };
    }
  } catch {
    // Offline / Cloudflare static mode
  }

  // 2. Fallback xác thực trực tiếp trên trình duyệt (khi mở trên www.rapmau.com)
  const inputHash = await sha256HexBrowser(cleanPass);
  const customCredRaw = localStorage.getItem(ADMIN_CUSTOM_CRED_KEY);
  if (customCredRaw) {
    try {
      const customCred = JSON.parse(customCredRaw);
      const validUser =
        cleanUser === String(customCred.username || 'admin').toLowerCase() ||
        DEFAULT_ADMIN_USERS.includes(cleanUser);
      if (validUser && inputHash === customCred.passwordHash) {
        return { ok: true, username: customCred.username || cleanUser, token: inputHash };
      }
      return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu quản trị!' };
    } catch {
      // ignore
    }
  }

  const defaultHash = await sha256HexBrowser(DEFAULT_ADMIN_PASS_PLAIN);
  if (DEFAULT_ADMIN_USERS.includes(cleanUser) && inputHash === defaultHash) {
    return { ok: true, username: cleanUser, token: defaultHash };
  }

  return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu quản trị!' };
}

function setupLoginGate() {
  const overlay = document.getElementById('adminLoginOverlay');
  const form = document.getElementById('adminLoginForm');
  const errBox = document.getElementById('loginErrorBox');
  const pwdInput = document.getElementById('loginPasswordInput');
  const toggleBtn = document.getElementById('toggleShowPwdBtn');
  const userBadge = document.getElementById('adminUserBadge');

  if (toggleBtn && pwdInput) {
    toggleBtn.addEventListener('click', () => {
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      toggleBtn.textContent = isPwd ? '🙈 Ẩn' : '👁️ Hiện';
    });
  }

  const existing = getAuthSession();
  if (existing && existing.token) {
    overlay.classList.add('hidden');
    if (userBadge) userBadge.textContent = existing.username || 'admin';
  } else {
    overlay.classList.remove('hidden');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    const username = document.getElementById('loginUsernameInput').value.trim();
    const password = pwdInput.value;
    const remember = document.getElementById('loginRememberChk').checked;

    const result = await verifyAdminCredentials(username, password);
    if (!result.ok) {
      errBox.textContent = `❌ ${result.error}`;
      errBox.classList.remove('hidden');
      return;
    }

    setAuthSession(result.username, result.token, remember);
    if (userBadge) userBadge.textContent = result.username;
    overlay.classList.add('hidden');
    showToast(`🔐 Xin chào Quản trị viên ${result.username}!`);
  });

  const logoutBtn = document.getElementById('btnAdminLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuthSession();
      pwdInput.value = '';
      overlay.classList.remove('hidden');
      showToast('🔒 Đã đăng xuất tài khoản quản trị');
    });
  }
}

async function initAdmin() {
  setupLoginGate();

  let catData = null;
  let admData = { orders: [], consultations: [] };

  try {
    const catRes = await fetch('/api/catalog');
    if (catRes.ok) {
      catData = await catRes.json();
      adminState.isLocalBackend = true;
    }
  } catch {
    // fallback
  }

  if (!catData) {
    const staticRes = await fetch('/data/catalog.json');
    catData = await staticRes.json();
  }

  // Nếu không chạy qua server local mà có bản lưu cục bộ trên trình duyệt thì ưu tiên nạp
  if (!adminState.isLocalBackend) {
    const savedOverride = localStorage.getItem(CMS_OVERRIDE_KEY);
    if (savedOverride) {
      try {
        catData = JSON.parse(savedOverride);
      } catch {
        // ignore
      }
    }
  } else {
    // Đồng bộ bản mới nhất từ server vào localStorage
    try {
      localStorage.setItem(CMS_OVERRIDE_KEY, JSON.stringify(catData));
    } catch {
      // ignore
    }
  }

  try {
    const admRes = await fetch('/api/admin-data');
    if (admRes.ok) {
      admData = await admRes.json();
    }
  } catch {
    // ignore on static host
  }

  adminState.catalog = catData;
  adminState.products = catData.products || [];
  adminState.categories = catData.categories || [];
  adminState.accessories = catData.accessories || [];
  adminState.freeBooks = catData.freeBooks || [];
  adminState.orders = admData.orders || [];
  adminState.consultations = admData.consultations || [];

  renderKPIs();
  populateCategorySelects();
  renderPatternsTable();
  renderToolsTable();
  renderBooksTable();
  renderOrdersAndLeads();
  populateSiteSettings();
  bindAdminEvents();
}

function renderKPIs() {
  const freeCount = adminState.products.filter((p) => p.isFreePdf).length;
  document.getElementById('kpiTotalPatterns').textContent = adminState.products.length;
  document.getElementById('kpiFreePatterns').textContent = freeCount;
  const kpiTools = document.getElementById('kpiToolsCount');
  if (kpiTools) kpiTools.textContent = `${adminState.accessories.length} món`;
  document.getElementById('kpiBooks').textContent = `${adminState.freeBooks.length} cuốn`;
  document.getElementById('kpiOrders').textContent =
    adminState.orders.length + adminState.consultations.length;

  document.getElementById('sideCountPatterns').textContent = adminState.products.length;
  document.getElementById('sideCountOrders').textContent =
    adminState.orders.length + adminState.consultations.length;
  document.getElementById('sideCountTools').textContent = adminState.accessories.length;
  document.getElementById('sideCountBooks').textContent = adminState.freeBooks.length;

  const site = adminState.catalog.site || {};
  document.getElementById('topHotlineText').textContent =
    site.hotline || '0971.463.768 (Mr.Tuan)';
  document.getElementById('topEmailText').textContent = site.email || 'info@rapmau.com';
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
  return adminState.products.filter((p) => {
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
      const thumb = encodeURI((p.images && p.images[0]) || '/assets/tools/pattern-placeholder.svg');
      const checked = adminState.selectedPatternSkus.has(p.sku) ? 'checked' : '';

      return `
        <tr data-row-sku="${p.sku}">
          <td style="text-align:center;">
            <input type="checkbox" class="chk-row pat-row-chk" data-check-sku="${p.sku}" ${checked} />
          </td>
          <td>
            <img src="${thumb}" alt="${p.sku}" style="width:50px; height:50px; object-fit:cover; border-radius:6px; border:1px solid var(--border-soft);" />
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
              <button type="button" class="btn-sm btn-add" data-save-sku="${p.sku}">💾 Lưu</button>
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
  return adminState.accessories.filter((a) => {
    if (adminState.selectedToolCat !== 'all' && a.category !== adminState.selectedToolCat) {
      return false;
    }
    if (q) {
      const hay = `${a.sku} ${a.title} ${a.category} ${a.badge || ''}`.toLowerCase();
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
      const thumb = encodeURI((a.images && a.images[0]) || '/assets/tools/tool-1.svg');
      const checked = adminState.selectedToolIds.has(a.id) ? 'checked' : '';
      return `
      <tr data-tool-id="${a.id}">
        <td style="text-align:center;">
          <input type="checkbox" class="chk-row tool-row-chk" data-check-tool="${a.id}" ${checked} />
        </td>
        <td>
          <img src="${thumb}" alt="${a.sku}" style="width:52px; height:52px; object-fit:cover; border-radius:6px; border:1px solid var(--border-soft);" />
        </td>
        <td>
          <strong>${a.sku}</strong>
          <div style="font-size:11px; color:var(--text-muted);">${a.category || ''}</div>
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

function renderOrdersAndLeads() {
  const ordBox = document.getElementById('adminOrdersContainer');
  const leadBox = document.getElementById('adminLeadsContainer');

  if (adminState.orders.length === 0) {
    ordBox.innerHTML = `<p style="color:var(--text-muted); font-size:13.5px;">Chưa có đơn đặt hàng nào.</p>`;
  } else {
    ordBox.innerHTML = `
      <table class="cms-table">
        <thead>
          <tr>
            <th>Mã Đơn</th>
            <th>Thời Gian</th>
            <th>Khách Hàng &amp; SĐT Zalo</th>
            <th>Sản Phẩm Đặt Mua</th>
            <th>Tổng Tiền</th>
            <th>Thanh Toán</th>
          </tr>
        </thead>
        <tbody>
          ${adminState.orders
            .map(
              (o) => `
            <tr>
              <td><strong style="color:var(--accent-leather);">#${o.orderCode}</strong></td>
              <td>${new Date(o.createdAt).toLocaleString('vi-VN')}</td>
              <td>
                <strong>${o.customer?.name || ''}</strong> — <a href="https://zalo.me/${(o.customer?.phone || '').replace(/[^0-9]/g, '')}" target="_blank">${o.customer?.phone || ''}</a>
                <div style="font-size:12px; color:var(--text-muted);">${o.customer?.address || ''}</div>
              </td>
              <td>
                ${(o.items || [])
                  .map((i) => `<div>• [${i.sku}] ${i.title} (<em>${i.variantName}</em> × ${i.qty})</div>`)
                  .join('')}
              </td>
              <td><strong style="color:var(--accent-leather); font-size:15px;">${formatVND(o.totalAmount)}</strong></td>
              <td><span class="size-badge">${(o.paymentMethod || 'vietqr').toUpperCase()}</span></td>
            </tr>
          `
            )
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

async function handleImageFileUpload(fileInputEl, targetUrlInputEl) {
  const file = fileInputEl.files && fileInputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileName: file.name, dataUrl })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.url) {
          targetUrlInputEl.value = data.url;
          showToast('📷 Đã tải ảnh lên máy chủ thành công!');
          return;
        }
      }
    } catch {
      // fallback dataUrl
    }
    targetUrlInputEl.value = dataUrl;
    showToast('📷 Đã nạp ảnh vào biểu mẫu!');
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
      document.querySelectorAll('#adminTabNav .admin-nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-tab-panel').forEach((p) => p.classList.add('hidden'));
      document.getElementById(btn.dataset.tab).classList.remove('hidden');
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
          syncCatalogStatsAndPersistLocal();
          renderKPIs();
          populateCategorySelects();
          renderPatternsTable();
          renderToolsTable();
          renderBooksTable();
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
    // 1. Lưu mẫu rập
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
      }

      try {
        await fetch(`/api/product/${encodeURIComponent(sku)}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ title, variantPrices })
        });
      } catch {
        // offline fallback
      }

      syncCatalogStatsAndPersistLocal();
      renderKPIs();
      showToast(`✅ Đã lưu mẫu ${sku} thành công!`);
      return;
    }

    // 2. Xoá 1 mẫu rập
    const delBtn = e.target.closest('[data-delete-sku]');
    if (delBtn) {
      const sku = delBtn.dataset.deleteSku;
      const prod = adminState.products.find((p) => p.sku === sku);
      if (!window.confirm(`Bạn có chắc chắn muốn XOÁ mẫu rập [${sku}] "${prod?.title || ''}" không?`)) {
        return;
      }

      adminState.products = adminState.products.filter((p) => p.sku !== sku);
      adminState.selectedPatternSkus.delete(sku);

      try {
        await fetch(`/api/product/${encodeURIComponent(sku)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
      } catch {
        // offline fallback
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

    try {
      await fetch('/api/products/bulk-delete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ skus })
      });
    } catch {
      // offline fallback
    }

    syncCatalogStatsAndPersistLocal();
    renderKPIs();
    populateCategorySelects();
    renderPatternsTable();
    showToast(`🗑️ Đã xoá ${skus.length} mẫu rập không cần thiết!`);
  });

  // Mở / Đóng Modal Thêm Mẫu Rập Mới
  const addPatModal = document.getElementById('addPatternModal');
  document.getElementById('btnOpenAddPatternModal').addEventListener('click', () => {
    addPatModal.classList.remove('hidden');
  });
  document.getElementById('closeAddPatternModalBtn').addEventListener('click', () => {
    addPatModal.classList.add('hidden');
  });
  document.getElementById('newPatImageFile').addEventListener('change', (e) => {
    handleImageFileUpload(e.target, document.getElementById('newPatImageUrl'));
  });

  document.getElementById('addPatternForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('newPatTitle').value.trim();
    const categoryKey = document.getElementById('newPatCategory').value;
    const skuInput = document.getElementById('newPatSku').value.trim();
    const paperSizes = document
      .getElementById('newPatPaperSizes')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const imageUrl =
      document.getElementById('newPatImageUrl').value.trim() ||
      '/assets/tools/pattern-placeholder.svg';
    const pdfDownloadUrl = document.getElementById('newPatPdfUrl').value.trim();
    const variantPrices = {
      pdf_dxf: Number(document.getElementById('newPatPricePdf').value) || 0,
      rap_giay: Number(document.getElementById('newPatPricePaper').value) || 55000,
      rap_mica: Number(document.getElementById('newPatPriceMica').value) || 135000,
      khuon_be: Number(document.getElementById('newPatPriceDie').value) || 450000
    };

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
          imageUrl,
          pdfDownloadUrl,
          variantPrices
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
        categoryKey: catObj ? catObj.key : 'vi-da',
        categoryName: catObj ? catObj.name : 'Rập Ví Da',
        categoryShort: catObj ? catObj.shortName : 'Ví Da',
        folderPath: 'Mẫu mới',
        images: [imageUrl],
        paperSizes: paperSizes.length ? paperSizes : ['A4'],
        isFreePdf: variantPrices.pdf_dxf === 0,
        pdfDownloadUrl,
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
    document.getElementById('toolModalHeading').textContent = '➕ Thêm Dụng Cụ / Phụ Kiện Mới';
    document.getElementById('editToolId').value = '';
    document.getElementById('toolModalForm').reset();
    toolModal.classList.remove('hidden');
  });
  document.getElementById('closeToolModalBtn').addEventListener('click', () => {
    toolModal.classList.add('hidden');
  });
  document.getElementById('toolFormImageFile').addEventListener('change', (e) => {
    handleImageFileUpload(e.target, document.getElementById('toolFormImageUrl'));
  });

  document.getElementById('adminToolsTableBody').addEventListener('click', async (e) => {
    // 1. Lưu nhanh trên dòng
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
      showToast(`✅ Đã lưu dụng cụ ${item?.sku || id}!`);
      return;
    }

    // 2. Mở form sửa chi tiết dụng cụ
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
      toolModal.classList.remove('hidden');
      return;
    }

    // 3. Xoá 1 dụng cụ / phụ kiện không cần thiết
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
      renderToolsTable();
      showToast(`🗑️ Đã xoá dụng cụ [${item?.sku || id}]!`);
    }
  });

  // Xoá hàng loạt dụng cụ đã chọn
  document.getElementById('btnBulkDeleteTools').addEventListener('click', async () => {
    const ids = Array.from(adminState.selectedToolIds);
    if (ids.length === 0) {
      showToast('⚠️ Vui lòng tích chọn ít nhất 1 dụng cụ để xoá!', true);
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn XOÁ ${ids.length} dụng cụ / phụ kiện đã chọn không?`)) {
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
    renderToolsTable();
    showToast(`🗑️ Đã xoá ${ids.length} dụng cụ không cần thiết!`);
  });

  // Lưu form Thêm / Sửa chi tiết dụng cụ
  document.getElementById('toolModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editToolId').value.trim();
    const payload = {
      title: document.getElementById('toolFormTitle').value.trim(),
      sku: document.getElementById('toolFormSku').value.trim(),
      category: document.getElementById('toolFormCategory').value.trim() || 'Dụng cụ làm đồ da',
      badge: document.getElementById('toolFormBadge').value.trim() || 'Sẵn hàng giao ngay',
      price: Number(document.getElementById('toolFormPrice').value) || 0,
      originalPrice: Number(document.getElementById('toolFormOriginalPrice').value) || 0,
      imageUrl: document.getElementById('toolFormImageUrl').value.trim() || '/assets/tools/tool-1.svg',
      description: document.getElementById('toolFormDesc').value.trim(),
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
      try {
        const res = await fetch('/api/accessory', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok) createdItem = data.item;
        }
      } catch {
        // offline
      }
      if (!createdItem) {
        const nextNum = adminState.accessories.length + 1;
        createdItem = {
          id: `tool-custom-${Date.now()}`,
          sku: payload.sku || `PK-NEW-${String(nextNum).padStart(3, '0')}`,
          title: payload.title,
          category: payload.category,
          price: payload.price,
          originalPrice: payload.originalPrice || Math.round(payload.price * 1.25),
          unit: 'Bộ / Sản phẩm',
          badge: payload.badge,
          images: [payload.imageUrl],
          specs: payload.specs.length ? payload.specs : ['Dụng cụ làm đồ da thủ công chọn lọc'],
          description: payload.description || payload.title
        };
      }
      adminState.accessories.unshift(createdItem);
      showToast(`✅ Đã thêm dụng cụ mới [${createdItem.sku}]!`);
    }

    syncCatalogStatsAndPersistLocal();
    renderKPIs();
    renderToolsTable();
    toolModal.classList.add('hidden');
  });

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

  // Đổi mật khẩu quản trị
  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = document.getElementById('pwdNewUsername').value.trim() || 'admin';
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

    const check = await verifyAdminCredentials(newUsername, currentPassword);
    if (!check.ok) {
      showToast('❌ Mật khẩu hiện tại không đúng!', true);
      return;
    }

    try {
      await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newUsername, newPassword })
      });
    } catch {
      // offline fallback
    }

    const newHash = await sha256HexBrowser(newPassword);
    localStorage.setItem(
      ADMIN_CUSTOM_CRED_KEY,
      JSON.stringify({ username: newUsername, passwordHash: newHash })
    );
    setAuthSession(newUsername, newHash, true);
    document.getElementById('adminUserBadge').textContent = newUsername;
    e.target.reset();
    document.getElementById('pwdNewUsername').value = newUsername;
    showToast('🔑 Đã cập nhật mật khẩu quản trị thành công!');
  });

  ['cfgBankId', 'cfgAccountNo', 'cfgAccountName'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateVietQrPreview);
  });
}

initAdmin();
