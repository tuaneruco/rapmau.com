const adminState = {
  catalog: null,
  products: [],
  categories: [],
  accessories: [],
  freeBooks: [],
  orders: [],
  consultations: [],
  selectedCat: 'all',
  searchQuery: ''
};

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(Number(amount) || 0) + 'đ';
}

function showToast(msg) {
  const el = document.getElementById('adminToast');
  el.textContent = msg || '✅ Đã lưu thay đổi thành công!';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2600);
}

async function initAdmin() {
  const [catRes, admRes] = await Promise.all([
    fetch('/api/catalog'),
    fetch('/api/admin-data')
  ]);
  const catData = await catRes.json();
  const admData = await admRes.json();

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
  renderOrdersAndLeads();
  renderToolsTable();
  renderBooksTable();
  populateSiteSettings();
  bindAdminEvents();
}

function renderKPIs() {
  const freeCount = adminState.products.filter((p) => p.isFreePdf).length;
  document.getElementById('kpiTotalPatterns').textContent = adminState.products.length;
  document.getElementById('kpiFreePatterns').textContent = freeCount;
  document.getElementById('kpiBooks').textContent = `${adminState.freeBooks.length} cuốn`;
  document.getElementById('kpiOrders').textContent = adminState.orders.length;
  document.getElementById('kpiLeads').textContent = adminState.consultations.length;

  document.getElementById('sideCountPatterns').textContent = adminState.products.length;
  document.getElementById('sideCountOrders').textContent = adminState.orders.length + adminState.consultations.length;
  document.getElementById('sideCountTools').textContent = adminState.accessories.length;
  document.getElementById('sideCountBooks').textContent = adminState.freeBooks.length;

  const site = adminState.catalog.site || {};
  document.getElementById('topHotlineText').textContent = site.hotline || '0971.463.768 (Mr.Tuan)';
  document.getElementById('topEmailText').textContent = site.email || 'info@rapmau.com';
}

function populateCategorySelects() {
  const filterSel = document.getElementById('adminCatFilter');
  const bulkSel = document.getElementById('bulkCategorySelect');

  let opts = `<option value="all">Tất cả 21 danh mục (${adminState.products.length} mẫu)</option>`;
  for (const c of adminState.categories) {
    opts += `<option value="${c.key}">${c.shortName} (${c.count} mẫu)</option>`;
  }
  filterSel.innerHTML = opts;
  bulkSel.innerHTML = opts;

  bulkSel.onchange = () => {
    const cat = adminState.categories.find((x) => x.key === bulkSel.value);
    if (cat && cat.basePrices) {
      document.getElementById('bulkPdfPrice').value = cat.basePrices.pdf ?? 29000;
      document.getElementById('bulkPaperPrice').value = cat.basePrices.paper ?? 55000;
      document.getElementById('bulkMicaPrice').value = cat.basePrices.mica ?? 135000;
      document.getElementById('bulkDiePrice').value = cat.basePrices.die ?? 450000;
    }
  };
}

function renderPatternsTable() {
  const tbody = document.getElementById('adminProductsTableBody');
  const q = adminState.searchQuery.trim().toLowerCase();

  const filtered = adminState.products.filter((p) => {
    if (adminState.selectedCat !== 'all' && p.categoryKey !== adminState.selectedCat) return false;
    if (q) {
      const hay = `${p.sku} ${p.title} ${p.categoryShort} ${p.folderPath}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  document.getElementById('adminFilteredCount').textContent = filtered.length;

  tbody.innerHTML = filtered
    .map((p) => {
      const vMap = {};
      for (const v of p.variants || []) vMap[v.id] = v.price;
      const thumb = encodeURI(p.images[0] || '/assets/tools/pattern-placeholder.svg');

      return `
        <tr data-row-sku="${p.sku}">
          <td>
            <img src="${thumb}" alt="${p.sku}" style="width:52px; height:52px; object-fit:cover; border-radius:6px; border:1px solid var(--border-soft);" />
          </td>
          <td>
            <strong style="color:var(--bg-saddle);">${p.sku}</strong>
            <div style="font-size:11.5px; color:var(--text-muted);">${p.categoryShort} • Khổ ${p.paperSizes.join('/')}</div>
            <div style="font-size:11px; color:var(--text-muted);"><code>${p.folderPath}</code></div>
          </td>
          <td>
            <input type="text" class="cms-input-title" data-field="title" value="${p.title.replace(/"/g, '&quot;')}" />
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
            <div style="display:flex; gap:6px; align-items:center;">
              <button type="button" class="btn-sm btn-add" data-save-sku="${p.sku}">💾 Lưu</button>
              <a href="/studio?sku=${encodeURIComponent(p.sku)}" class="btn-sm btn-detail" style="text-decoration:none; white-space:nowrap;" title="Mở ảnh mẫu này trong Studio để đóng dấu Logo RAPMAU.COM">
                🏷️ Đóng dấu Logo
              </a>
            </div>
          </td>
        </tr>
      `;
    })
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

function renderToolsTable() {
  const tbody = document.getElementById('adminToolsTableBody');
  tbody.innerHTML = adminState.accessories
    .map(
      (a) => `
      <tr data-tool-id="${a.id}">
        <td>
          <img src="${encodeURI(a.images[0])}" alt="${a.sku}" style="width:52px; height:52px; object-fit:cover; border-radius:6px;" />
        </td>
        <td><strong>${a.sku}</strong><div style="font-size:11px; color:var(--text-muted);">${a.category}</div></td>
        <td><input type="text" class="cms-input-title" data-tfield="title" value="${a.title.replace(/"/g, '&quot;')}" /></td>
        <td><input type="text" class="cms-input-sm" style="width:140px;" data-tfield="badge" value="${a.badge}" /></td>
        <td><input type="number" class="cms-input-sm" data-tfield="price" value="${a.price}" /></td>
        <td><input type="number" class="cms-input-sm" data-tfield="originalPrice" value="${a.originalPrice}" /></td>
        <td><button type="button" class="btn-sm btn-add" data-save-tool="${a.id}">💾 Lưu</button></td>
      </tr>
    `
    )
    .join('');
}

function renderBooksTable() {
  const site = adminState.catalog.site || {};
  document.getElementById('quickZaloGroupInput').value = site.zaloGroupUrl || 'https://zalo.me/0971463768';

  const tbody = document.getElementById('adminBooksTableBody');
  tbody.innerHTML = adminState.freeBooks
    .map(
      (b) => `
      <tr>
        <td><img src="${encodeURI(b.cover)}" alt="${b.id}" style="width:46px; height:60px; object-fit:cover; border-radius:4px;" /></td>
        <td><strong>${b.id}</strong></td>
        <td><span class="book-folder-badge">📁 ${b.folderKey}</span></td>
        <td><strong>${b.title}</strong></td>
        <td><code>${b.fileName}</code></td>
        <td>${b.sizeMB} MB</td>
        <td>
          <a href="${encodeURI(b.downloadUrl)}" target="_blank" class="btn-sm btn-detail" style="text-decoration:none;">
            👁️ Xem File
          </a>
        </td>
      </tr>
    `
    )
    .join('');
}

function populateSiteSettings() {
  const site = adminState.catalog.site || {};
  const bank = site.bankInfo || {};

  document.getElementById('cfgHotline').value = site.hotline || '0971.463.768 (Mr.Tuan)';
  document.getElementById('cfgZalo').value = site.zalo || '0971463768';
  document.getElementById('cfgEmail').value = site.email || 'info@rapmau.com';
  document.getElementById('cfgZaloGroupUrl').value = site.zaloGroupUrl || 'https://zalo.me/0971463768';
  document.getElementById('cfgAddress').value = site.address || '';
  document.getElementById('cfgBankId').value = bank.bankId || 'MB';
  document.getElementById('cfgAccountNo').value = bank.accountNo || '0971463768';
  document.getElementById('cfgAccountName').value = bank.accountName || 'MR TUAN RAPMAU';

  updateVietQrPreview();
}

function updateVietQrPreview() {
  const bankId = document.getElementById('cfgBankId').value.trim() || 'MB';
  const accountNo = document.getElementById('cfgAccountNo').value.trim() || '0971463768';
  const accountName = document.getElementById('cfgAccountName').value.trim() || 'MR TUAN RAPMAU';
  const url = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=55000&addInfo=RM123456&accountName=${encodeURIComponent(accountName)}`;
  document.getElementById('previewVietQrImg').src = url;
  document.getElementById('previewVietQrText').textContent = `${bankId} • STK: ${accountNo} (${accountName})`;
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

  // Lọc và tìm kiếm mẫu rập
  document.getElementById('adminCatFilter').addEventListener('change', (e) => {
    adminState.selectedCat = e.target.value;
    renderPatternsTable();
  });
  document.getElementById('adminSearchInput').addEventListener('input', (e) => {
    adminState.searchQuery = e.target.value;
    renderPatternsTable();
  });

  // Lưu từng mẫu rập
  document.getElementById('adminProductsTableBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-save-sku]');
    if (!btn) return;
    const sku = btn.dataset.saveSku;
    const row = btn.closest('tr');
    const title = row.querySelector('[data-field="title"]').value;
    const variantPrices = {
      pdf_dxf: Number(row.querySelector('[data-field="pdf_dxf"]').value) || 0,
      rap_giay: Number(row.querySelector('[data-field="rap_giay"]').value) || 0,
      rap_mica: Number(row.querySelector('[data-field="rap_mica"]').value) || 0,
      khuon_be: Number(row.querySelector('[data-field="khuon_be"]').value) || 0
    };

    const res = await fetch(`/api/product/${encodeURIComponent(sku)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, variantPrices })
    });
    const data = await res.json();
    if (data.ok) {
      const idx = adminState.products.findIndex((p) => p.sku === sku);
      if (idx !== -1) adminState.products[idx] = data.product;
      renderKPIs();
      showToast(`✅ Đã lưu mẫu ${sku} thành công!`);
    }
  });

  // Cập nhật giá hàng loạt theo Danh mục
  document.getElementById('bulkPriceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const categoryKey = document.getElementById('bulkCategorySelect').value;
    const prices = {
      pdf_dxf: document.getElementById('bulkPdfPrice').value,
      rap_giay: document.getElementById('bulkPaperPrice').value,
      rap_mica: document.getElementById('bulkMicaPrice').value,
      khuon_be: document.getElementById('bulkDiePrice').value
    };
    const res = await fetch('/api/category-bulk-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryKey, prices })
    });
    const data = await res.json();
    if (data.ok) {
      const catRes = await fetch('/api/catalog');
      const catData = await catRes.json();
      adminState.products = catData.products || [];
      renderKPIs();
      renderPatternsTable();
      showToast(`⚡ Đã cập nhật giá hàng loạt cho ${data.updatedCount} mẫu rập!`);
    }
  });

  // Lưu Dụng cụ & Phụ kiện
  document.getElementById('adminToolsTableBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-save-tool]');
    if (!btn) return;
    const id = btn.dataset.saveTool;
    const row = btn.closest('tr');
    const payload = {
      title: row.querySelector('[data-tfield="title"]').value,
      badge: row.querySelector('[data-tfield="badge"]').value,
      price: Number(row.querySelector('[data-tfield="price"]').value) || 0,
      originalPrice: Number(row.querySelector('[data-tfield="originalPrice"]').value) || 0
    };
    const res = await fetch(`/api/accessory/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      showToast(`✅ Đã cập nhật dụng cụ ${data.item.sku}!`);
    }
  });

  // Lưu nhanh Link Nhóm Zalo ở Tab Sách
  document.getElementById('quickZaloGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('quickZaloGroupInput').value.trim();
    const site = { ...(adminState.catalog.site || {}), zaloGroupUrl: url };
    const res = await fetch('/api/site-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site })
    });
    const data = await res.json();
    if (data.ok) {
      adminState.catalog.site = data.site;
      document.getElementById('cfgZaloGroupUrl').value = url;
      showToast('✅ Đã cập nhật Link Nhóm Zalo nhận sách miễn phí!');
    }
  });

  // Lưu toàn bộ cấu hình Website & VietQR
  document.getElementById('fullSiteSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedSite = {
      ...(adminState.catalog.site || {}),
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
    const res = await fetch('/api/site-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: updatedSite })
    });
    const data = await res.json();
    if (data.ok) {
      adminState.catalog.site = data.site;
      renderKPIs();
      updateVietQrPreview();
      showToast('✅ Đã lưu cấu hình Website & VietQR thành công!');
    }
  });

  ['cfgBankId', 'cfgAccountNo', 'cfgAccountName'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateVietQrPreview);
  });
}

initAdmin();
