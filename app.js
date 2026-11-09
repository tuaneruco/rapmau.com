const state = {
  catalog: null,
  products: [],
  accessories: [],
  freeBooks: [],
  categories: [],
  selectedCategory: 'all',
  selectedVariantMode: 'pdf_dxf',
  cardVariantOverrides: {},
  paperSizeFilter: 'all',
  specialFilter: 'all',
  sortFilter: 'featured',
  searchQuery: '',
  visibleCount: 24,
  selectedToolCat: 'all',
  selectedBookFolder: 'all',
  zaloBooksUnlocked: localStorage.getItem('rapmau_zalo_books_unlocked') === '1',
  cart: JSON.parse(localStorage.getItem('rapmau_cart') || '[]'),
  lastCompletedOrder: null
};

const VARIANT_LABELS = {
  pdf_dxf: 'File PDF / DXF (Tải ngay 1:1)',
  rap_giay: 'Rập Giấy Cứng 350gsm (Cắt máy sẵn)',
  rap_mica: 'Rập Mica Trong 2mm (Cắt Laser CNC)',
  khuon_be: 'Khuôn Bế Thép (Đặt theo mẫu)'
};

function formatVND(amount) {
  if (amount === 0) return 'Miễn phí (0đ)';
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function saveCart() {
  localStorage.setItem('rapmau_cart', JSON.stringify(state.cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cartCountBadge');
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  if (badge) badge.textContent = String(count);
}

function getEffectiveVariant(product, variantId) {
  const targetId = variantId || state.cardVariantOverrides[product.id] || state.selectedVariantMode;
  return product.variants.find((v) => v.id === targetId) || product.variants[0];
}

async function initApp() {
  try {
    let res = await fetch('/api/catalog');
    if (!res.ok) {
      res = await fetch('/data/catalog.json');
    }
    const data = await res.json();
    state.catalog = data;
    state.products = data.products || [];
    state.accessories = data.accessories || [];
    state.freeBooks = data.freeBooks || [];
    state.categories = data.categories || [];

    hydrateSiteMetadata();
    renderCategoryPills();
    renderProducts();
    renderFreeBooks();
    renderTools();
    updateCartBadge();
    bindEvents();
  } catch (err) {
    console.error('Lỗi tải catalog:', err);
  }
}

function hydrateSiteMetadata() {
  const { site, stats } = state.catalog;
  if (stats) {
    document.getElementById('navTotalPatterns').textContent = stats.totalPatterns;
    document.getElementById('navFreeCount').textContent = stats.freePatternsCount;
    document.getElementById('navToolsCount').textContent = stats.totalToolsAndAccessories;
    const fbCountEl = document.getElementById('navFreeBooksCount');
    if (fbCountEl) fbCountEl.textContent = stats.freeBooksCount || state.freeBooks.length;
    document.getElementById('statPatterns').textContent = `${stats.totalPatterns}+`;
    document.getElementById('statCategories').textContent = stats.totalCategories;
  }
  if (site) {
    document.getElementById('contactHotlineDisplay').textContent = site.hotline || '0971.463.768 (Mr.Tuan)';
    document.getElementById('contactEmailDisplay').textContent = site.email || 'info@rapmau.com';
    document.getElementById('contactAddressDisplay').textContent = site.address || '';
    document.getElementById('topbarHotline').textContent = `📞 Hotline/Zalo: ${site.hotline || '0971.463.768 (Mr.Tuan)'}`;
    const zaloClean = (site.zalo || site.hotline || '0971463768').replace(/[^0-9]/g, '');
    document.getElementById('directZaloLink').href = `https://zalo.me/${zaloClean}`;
    const groupBtn = document.getElementById('joinZaloGroupPrimaryBtn');
    if (groupBtn) {
      groupBtn.href = site.zaloGroupUrl || `https://zalo.me/${zaloClean}`;
    }
  }
}

function renderCategoryPills() {
  const container = document.getElementById('categoryPillsContainer');
  const total = state.products.length;
  let html = `
    <button type="button" class="cat-pill ${state.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
      <span>Tất cả 21 danh mục</span>
      <span class="cat-pill-count">${total}</span>
    </button>
  `;

  for (const cat of state.categories) {
    const active = state.selectedCategory === cat.key ? 'active' : '';
    html += `
      <button type="button" class="cat-pill ${active}" data-cat="${cat.key}">
        <span>${cat.shortName}</span>
        <span class="cat-pill-count">${cat.count}</span>
      </button>
    `;
  }
  container.innerHTML = html;

  const headingEl = document.getElementById('activeCategoryHeading');
  if (headingEl) {
    if (state.selectedCategory === 'all') {
      headingEl.textContent = 'Tất cả mẫu rập đồ da';
    } else {
      const found = state.categories.find((c) => c.key === state.selectedCategory);
      headingEl.textContent = found ? found.name : state.selectedCategory;
    }
  }

  container.querySelectorAll('.cat-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedCategory = btn.dataset.cat;
      state.visibleCount = 24;
      renderCategoryPills();
      renderProducts();
    });
  });
}

function getFilteredProducts() {
  const q = state.searchQuery.trim().toLowerCase();

  let list = state.products.filter((p) => {
    if (state.selectedCategory !== 'all' && p.categoryKey !== state.selectedCategory) {
      return false;
    }

    if (state.paperSizeFilter !== 'all') {
      if (state.paperSizeFilter === 'LARGE') {
        if (!p.paperSizes.some((s) => ['A2', 'A1', 'A0'].includes(s))) return false;
      } else if (!p.paperSizes.includes(state.paperSizeFilter)) {
        return false;
      }
    }

    if (state.specialFilter === 'free' && !p.isFreePdf) return false;
    if (state.specialFilter === 'with_photo' && p.images[0]?.startsWith('/previews/')) return false;
    if (state.specialFilter === 'cad' && p.cadCount === 0) return false;
    if (state.specialFilter === 'beginner' && !p.difficulty.toLowerCase().includes('cơ bản')) return false;

    if (q) {
      const hay = `${p.sku} ${p.title} ${p.categoryName} ${p.folderPath} ${p.pdfFileNames.join(' ')} ${p.paperSizes.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (state.sortFilter === 'sku_asc') {
    list.sort((a, b) => a.sku.localeCompare(b.sku));
  } else if (state.sortFilter === 'price_asc') {
    list.sort((a, b) => getEffectiveVariant(a).price - getEffectiveVariant(b).price);
  } else if (state.sortFilter === 'price_desc') {
    list.sort((a, b) => getEffectiveVariant(b).price - getEffectiveVariant(a).price);
  } else {
    list.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  }

  return list;
}

function renderProducts() {
  const filtered = getFilteredProducts();
  const grid = document.getElementById('productGrid');
  const countEl = document.getElementById('filteredCountText');
  const resetBtn = document.getElementById('resetFiltersBtn');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  countEl.textContent = String(filtered.length);

  const hasFilter =
    state.selectedCategory !== 'all' ||
    state.paperSizeFilter !== 'all' ||
    state.specialFilter !== 'all' ||
    state.searchQuery.trim() !== '';
  resetBtn.classList.toggle('hidden', !hasFilter);

  const slice = filtered.slice(0, state.visibleCount);

  if (slice.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 48px 20px; background:#fff; border-radius:14px; border:1px dashed var(--border-stitch);">
        <h3 style="margin-bottom:8px; color:var(--bg-saddle);">Không tìm thấy mẫu rập khớp bộ lọc</h3>
        <p style="color:var(--text-muted); margin-bottom:16px;">Bạn có thể xoá bộ lọc hoặc gửi yêu cầu để chúng tôi tìm mẫu từ kho lưu trữ riêng.</p>
        <button type="button" class="btn btn-secondary" id="emptyResetBtn">Xem lại toàn bộ 258+ mẫu</button>
      </div>
    `;
    const emptyBtn = document.getElementById('emptyResetBtn');
    if (emptyBtn) emptyBtn.onclick = resetAllFilters;
    loadMoreWrap.classList.add('hidden');
    return;
  }

  grid.innerHTML = slice
    .map((p) => {
      const activeVar = getEffectiveVariant(p);
      const isFree = activeVar.id === 'pdf_dxf' && activeVar.price === 0;
      const thumb = encodeURI(p.images[0] || '/assets/tools/pattern-placeholder.svg');
      const sizeText = p.paperSizes.join('/');

      return `
        <article class="product-card" data-sku="${p.sku}">
          <div class="card-thumb-wrap" data-action="detail" data-sku="${p.sku}">
            <img src="${thumb}" alt="${p.title}" loading="lazy" onerror="this.src='/assets/tools/pattern-placeholder.svg'" />
            <div class="card-badges-top">
              <span class="sku-badge">${p.sku}</span>
              ${p.isFreePdf ? '<span class="free-badge">🎁 FREE PDF</span>' : `<span class="size-badge">Khổ ${sizeText}</span>`}
            </div>
            <div class="card-meta-bottom">
              <span class="meta-chip">📄 ${p.pdfCount} PDF${p.cadCount ? ` + ${p.cadCount} CAD` : ''}</span>
              <span class="meta-chip">📸 ${p.imageCount} ảnh</span>
            </div>
          </div>

          <div class="card-body">
            <div class="card-cat-row">
              <span>${p.categoryShort}</span>
              <span>Đục ${p.chiselPitch.split(' ')[0]} • Da ${p.leatherThickness.split(' ')[0]}</span>
            </div>

            <h3 class="card-title" data-action="detail" data-sku="${p.sku}" title="${p.title}">
              ${p.title}
            </h3>

            <!-- Bộ chọn 4 biến thể trực tiếp trên từng mẫu -->
            <div class="card-variant-pills" role="group" aria-label="Chọn biến thể rập">
              ${p.variants
                .map(
                  (v) => `
                <button
                  type="button"
                  class="cv-pill ${v.id === activeVar.id ? 'active' : ''}"
                  data-action="switch-card-var"
                  data-sku="${p.sku}"
                  data-var="${v.id}"
                  title="${v.name}"
                >
                  ${v.id === 'pdf_dxf' ? 'PDF/DXF' : v.id === 'rap_giay' ? 'Rập Giấy' : v.id === 'rap_mica' ? 'Rập Mica' : 'Khuôn Bế'}
                </button>
              `
                )
                .join('')}
            </div>

            <div class="card-footer">
              <div class="price-block">
                <span class="price-current ${isFree ? 'is-free' : ''}">${formatVND(activeVar.price)}</span>
                <span class="price-variant-label">${activeVar.shortLabel} • ${activeVar.badge}</span>
              </div>
              <div class="card-actions">
                <button type="button" class="btn-sm btn-detail" data-action="detail" data-sku="${p.sku}">
                  Chi tiết
                </button>
                <button type="button" class="btn-sm btn-add" data-action="add-cart" data-sku="${p.sku}" data-var="${activeVar.id}">
                  ${isFree ? '⬇ Tải Free' : '+ Chọn mua'}
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  if (filtered.length > state.visibleCount) {
    loadMoreWrap.classList.remove('hidden');
    const remain = filtered.length - state.visibleCount;
    loadMoreBtn.textContent = `Xem thêm mẫu rập (còn ${remain} mẫu)`;
  } else {
    loadMoreWrap.classList.add('hidden');
  }
}

function renderFreeBooks() {
  const grid = document.getElementById('freeBooksGrid');
  if (!grid) return;

  const statusText = document.getElementById('zaloUnlockStatusText');
  const unlockBtn = document.getElementById('openBookUnlockModalBtn');
  if (state.zaloBooksUnlocked) {
    if (statusText) {
      statusText.innerHTML = `<strong style="color:var(--accent-green);">✅ Đã mở khoá thành viên Nhóm Zalo!</strong> Bạn có thể tải trực tiếp toàn bộ 26 đầu sách PDF bên dưới:`;
    }
    if (unlockBtn) {
      unlockBtn.textContent = '📂 Xem Danh Sách Tải Nhanh Toàn Bộ 26 Sách';
    }
  }

  const list = state.freeBooks.filter((b) => {
    if (state.selectedBookFolder === 'all') return true;
    return b.folderKey === state.selectedBookFolder;
  });

  grid.innerHTML = list
    .map((b) => {
      const cover = encodeURI(b.cover || '/assets/tools/pattern-placeholder.svg');
      const dlUrl = encodeURI(b.downloadUrl);
      return `
        <article class="book-card">
          <div class="book-cover-wrap" data-book-action="open" data-book-id="${b.id}">
            <img src="${cover}" alt="${b.title}" loading="lazy" onerror="this.src='/assets/tools/pattern-placeholder.svg'" />
            <div class="card-badges-top">
              <span class="book-folder-badge">📁 ${b.folderKey}</span>
              <span class="free-badge">🎁 FREE ZALO</span>
            </div>
            <div class="card-meta-bottom">
              <span class="meta-chip">📄 ${b.format} • ${b.sizeMB} MB</span>
              <span class="meta-chip">${b.id}</span>
            </div>
          </div>

          <div class="card-body">
            <div class="card-cat-row">
              <span>Thư mục: ${b.folderKey}</span>
              <span>File: ${b.fileName}</span>
            </div>
            <h3 class="card-title" data-book-action="open" data-book-id="${b.id}" title="${b.title}">
              ${b.title}
            </h3>
            <div class="card-footer" style="margin-top:auto;">
              ${
                state.zaloBooksUnlocked
                  ? `<a href="${dlUrl}?download=1" class="btn-sm btn-add" style="width:100%; text-align:center; text-decoration:none; background:var(--accent-green);" download>
                       ⬇ Tải Sách Ngay (${b.sizeMB} MB)
                     </a>`
                  : `<button type="button" class="btn-sm btn-add" style="width:100%; background:var(--accent-zalo);" data-book-action="open" data-book-id="${b.id}">
                       💬 Tham Gia Nhóm Zalo Nhận Sách
                     </button>`
              }
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function openZaloBookModal(bookId) {
  const book = state.freeBooks.find((b) => b.id === bookId) || state.freeBooks[0];
  const backdrop = document.getElementById('cartModalBackdrop');
  const content = document.getElementById('cartModalContent');
  const site = state.catalog?.site || {};
  const zaloGroupUrl = site.zaloGroupUrl || 'https://zalo.me/0971463768';

  content.innerHTML = `
    <div style="text-align:center; margin-bottom:16px;">
      <span class="free-badge" style="background:var(--accent-zalo); font-size:12.5px; padding:5px 12px;">
        🎁 QUÀ TẶNG THÀNH VIÊN NHÓM ZALO: CHIA SẺ MẪU VÀ SÁCH MIỄN PHÍ
      </span>
      <h2 style="margin:10px 0 6px; color:var(--bg-saddle);">
        ${book ? book.title : 'Trọn Bộ 26 Sách & Giáo Trình Đồ Da Miễn Phí'}
      </h2>
      <p style="font-size:13.5px; color:var(--text-muted);">
        Tham gia <strong>Nhóm Zalo Chia sẻ mẫu và sách miễn phí</strong> của <strong>Mr.Tuan (0971.463.768)</strong> để mở khoá tải toàn bộ 3 thư mục: <code>Ebook</code>, <code>Bộ sách nhật</code> và <code>Ebook China</code>.
      </p>
    </div>

    ${
      book
        ? `<div style="display:flex; gap:16px; align-items:center; background:var(--bg-parchment); padding:14px; border-radius:12px; border:1px solid var(--border-soft); margin-bottom:16px;">
            <img src="${encodeURI(book.cover)}" alt="${book.title}" style="width:84px; height:110px; object-fit:cover; border-radius:8px; border:1px solid var(--border-stitch);" />
            <div style="flex:1;">
              <span class="sku-badge">📁 Thư mục: ${book.folderKey}</span>
              <h4 style="margin:6px 0 4px; color:var(--bg-saddle);">${book.title}</h4>
              <div style="font-size:12.5px; color:var(--text-muted);">Tên file gốc: <strong>${book.fileName}</strong> • Dung lượng: <strong>${book.sizeMB} MB</strong></div>
            </div>
           </div>`
        : ''
    }

    <div style="background:#eff6ff; border:1.5px dashed #0068ff; border-radius:12px; padding:16px; margin-bottom:16px;">
      <strong style="color:#1e40af; display:block; margin-bottom:8px;">
        👉 Bước 1: Bấm tham gia Nhóm Zalo Chia Sẻ Mẫu &amp; Sách Miễn Phí
      </strong>
      <a
        href="${zaloGroupUrl}"
        target="_blank"
        rel="noopener"
        class="btn btn-zalo btn-full"
        id="modalClickZaloGroupBtn"
      >
        💬 Mở Zalo Tham Gia Nhóm "Chia Sẻ Mẫu Và Sách Miễn Phí"
      </a>
    </div>

    ${
      !state.zaloBooksUnlocked
        ? `
      <form id="unlockBooksForm" style="background:var(--bg-warm); padding:16px; border-radius:12px;">
        <strong style="color:var(--bg-saddle); display:block; margin-bottom:10px;">
          👉 Bước 2: Nhập SĐT Zalo của bạn để mở khoá link tải 26 đầu sách ngay lập tức
        </strong>
        <div class="form-row">
          <div class="form-field">
            <label>Tên Zalo của bạn *</label>
            <input type="text" id="zaloMemberName" required placeholder="VD: Anh Tuấn / Chị Lan..." />
          </div>
          <div class="form-field">
            <label>Số điện thoại Zalo đã tham gia nhóm *</label>
            <input type="tel" id="zaloMemberPhone" required placeholder="Nhập SĐT Zalo..." />
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-full">
          🔓 Xác Nhận &amp; Mở Khoá Tải Toàn Bộ 26 Sách Miễn Phí
        </button>
      </form>
    `
        : `
      <div style="background:#f0fdf4; border:1.5px solid #16a34a; border-radius:12px; padding:16px;">
        <strong style="color:#166534; display:block; margin-bottom:10px;">
          ✅ Bạn đã mở khoá thư viện! Bấm tải trực tiếp sách bên dưới:
        </strong>
        ${
          book
            ? `<a href="${encodeURI(book.downloadUrl)}?download=1" class="btn btn-primary btn-full" download style="margin-bottom:12px;">
                 ⬇ Tải Ngay: ${book.title} (${book.sizeMB} MB)
               </a>`
            : ''
        }
        <div style="max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; border-top:1px dashed #86efac; padding-top:10px;">
          ${state.freeBooks
            .map(
              (fb) => `
            <a href="${encodeURI(fb.downloadUrl)}?download=1" download style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; background:#fff; border-radius:8px; border:1px solid #bbf7d0; text-decoration:none; color:var(--text-main); font-size:13px;">
              <span><strong>[${fb.folderKey}]</strong> ${fb.title}</span>
              <span style="color:var(--accent-green); font-weight:800; white-space:nowrap; margin-left:8px;">⬇ ${fb.sizeMB} MB</span>
            </a>
          `
            )
            .join('')}
        </div>
      </div>
    `
    }
  `;

  backdrop.classList.remove('hidden');

  const unlockForm = document.getElementById('unlockBooksForm');
  if (unlockForm) {
    unlockForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('zaloMemberName').value.trim();
      const phone = document.getElementById('zaloMemberPhone').value.trim();
      try {
        await fetch('/api/consultations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone,
            needType: '🎁 Tham gia Nhóm Zalo Chia sẻ mẫu & nhận sách miễn phí',
            skuRef: book ? book.id : 'ALL-26-BOOKS',
            message: `Đăng ký thành viên Nhóm Zalo Chia sẻ mẫu & sách miễn phí (Mở khoá tải ${book ? book.fileName : '26 đầu sách'})`
          })
        });
      } catch {
        // Fallback trên bản Cloud Static
      }
      state.zaloBooksUnlocked = true;
      localStorage.setItem('rapmau_zalo_books_unlocked', '1');
      renderFreeBooks();
      openZaloBookModal(book ? book.id : null);
    };
  }
}

function renderTools() {
  const grid = document.getElementById('toolsGrid');
  const list = state.accessories.filter((item) => {
    if (state.selectedToolCat === 'all') return true;
    if (state.selectedToolCat === 'Dụng Cụ & Máy Móc') {
      return item.category.includes('Máy Móc') || item.category.includes('Cắt Rập');
    }
    if (state.selectedToolCat === 'Dụng Cụ Đục & Khâu') {
      return item.category.includes('Đục') || item.category.includes('Kim Chỉ') || item.category.includes('Hoá Chất');
    }
    return item.category === state.selectedToolCat;
  });

  grid.innerHTML = list
    .map((item) => {
      const thumb = encodeURI(item.images[0] || '/assets/tools/starter-kit.svg');
      return `
        <article class="tool-card">
          <div class="card-thumb-wrap" data-action="tool-detail" data-id="${item.id}">
            <img src="${thumb}" alt="${item.title}" loading="lazy" />
            <div class="card-badges-top">
              <span class="sku-badge">${item.sku}</span>
              <span class="free-badge" style="background:var(--accent-leather);">${item.badge}</span>
            </div>
            ${item.images.length > 1 ? `<div class="card-meta-bottom"><span class="meta-chip">📸 ${item.images.length} ảnh thực tế</span></div>` : ''}
          </div>
          <div class="card-body">
            <div class="card-cat-row">
              <span>${item.category}</span>
              <span>Sẵn hàng giao ngay</span>
            </div>
            <h3 class="card-title" data-action="tool-detail" data-id="${item.id}">${item.title}</h3>
            <ul class="tool-specs-list">
              ${item.specs.map((s) => `<li>${s}</li>`).join('')}
            </ul>
            <div class="card-footer">
              <div class="price-block">
                <span class="price-current">${formatVND(item.price)}</span>
                <span class="price-variant-label">Giá gốc: <del>${formatVND(item.originalPrice)}</del></span>
              </div>
              <div class="card-actions">
                ${item.images.length > 1 ? `<button type="button" class="btn-sm btn-detail" data-action="tool-detail" data-id="${item.id}">Xem ${item.images.length} ảnh</button>` : ''}
                <button type="button" class="btn-sm btn-add" data-action="add-tool" data-id="${item.id}">
                  + Thêm vào giỏ
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function openProductModal(sku, preferredVariantId) {
  const product = state.products.find((p) => p.sku === sku);
  if (!product) return;

  const activeVar = getEffectiveVariant(product, preferredVariantId);
  const backdrop = document.getElementById('productModalBackdrop');
  const content = document.getElementById('productModalContent');

  // Danh sách ảnh + ảnh bản vẽ CAD trích xuất từ PDF (nếu có)
  const galleryImages = [...product.images];
  if (product.cadPreview && !galleryImages.includes(product.cadPreview)) {
    galleryImages.push(product.cadPreview);
  }

  const matchingTools = state.accessories.filter((a) => product.recommendedTools.includes(a.id));
  const firstPdfUrl = product.pdfFiles[0] ? encodeURI(product.pdfFiles[0]) : '';
  const isFreePdf = activeVar.id === 'pdf_dxf' && activeVar.price === 0;

  content.innerHTML = `
    <div class="detail-grid">
      <div>
        <div id="detailMediaDisplay">
          <img
            src="${encodeURI(galleryImages[0])}"
            alt="${product.title}"
            class="detail-main-img"
            id="detailMainImage"
            onerror="this.src='/assets/tools/pattern-placeholder.svg'"
          />
        </div>

        <div class="detail-thumbs">
          ${galleryImages
            .map(
              (img, idx) => `
            <button type="button" class="detail-thumb-btn ${idx === 0 ? 'active' : ''}" data-img="${encodeURI(img)}">
              <img src="${encodeURI(img)}" alt="Thumb ${idx + 1}" />
            </button>
          `
            )
            .join('')}
          ${
            firstPdfUrl
              ? `<button type="button" class="btn-sm btn-detail" id="togglePdfPreviewBtn" data-pdf="${firstPdfUrl}" style="height:68px; flex-shrink:0;">
                  📐 Xem Bản Vẽ PDF 1:1
                 </button>`
              : ''
          }
        </div>

        <div class="cross-sell-box">
          <strong style="font-size:14px; color:var(--bg-saddle); display:block; margin-bottom:8px;">
            🛠️ Phụ Kiện &amp; Dụng Cụ Cơ Bản Khuyên Dùng Cho Mẫu ${product.sku}:
          </strong>
          ${matchingTools
            .map(
              (t) => `
            <div class="cross-sell-item">
              <div>
                <strong>${t.title}</strong>
                <div style="font-size:12px; color:var(--accent-leather); font-weight:700;">${formatVND(t.price)}</div>
              </div>
              <button type="button" class="btn-sm btn-detail" data-action="add-tool" data-id="${t.id}">
                + Mua kèm
              </button>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <span class="sku-badge">${product.sku}</span>
          <span class="size-badge">${product.categoryName}</span>
          <span class="size-badge">Khổ ${product.paperSizes.join('/')}</span>
        </div>

        <h2 style="font-size:22px; color:var(--bg-saddle); margin-bottom:10px;">${product.title}</h2>

        <div style="background:var(--bg-warm); padding:14px; border-radius:12px; margin-bottom:14px;">
          <div style="font-size:12px; color:var(--text-muted); font-weight:700;">GIÁ BIẾN THỂ ĐANG CHỌN (${activeVar.shortLabel.toUpperCase()}):</div>
          <div style="display:flex; align-items:baseline; gap:12px; margin-top:4px;">
            <span style="font-size:28px; font-weight:900; color:${isFreePdf ? 'var(--accent-green)' : 'var(--accent-leather)'};">
              ${formatVND(activeVar.price)}
            </span>
            <del style="color:var(--text-muted); font-size:14px;">${formatVND(activeVar.originalPrice)}</del>
            <span class="vm-badge" style="background:var(--bg-saddle); color:#fde68a;">${activeVar.badge}</span>
          </div>
          <p style="font-size:13px; color:var(--text-main); margin-top:6px;">${activeVar.description}</p>
        </div>

        <div>
          <label style="font-size:13px; font-weight:800; color:var(--bg-saddle);">
            CHỌN HÌNH THỨC RẬP (PDF/DXF • RẬP GIẤY • RẬP MICA • KHUÔN BẾ):
          </label>
          <div class="detail-variant-list">
            ${product.variants
              .map(
                (v) => `
              <button
                type="button"
                class="detail-variant-option ${v.id === activeVar.id ? 'active' : ''}"
                data-modal-sku="${product.sku}"
                data-modal-var="${v.id}"
              >
                <div class="dvo-top">
                  <span>${v.shortLabel}</span>
                  <span class="dvo-price">${formatVND(v.price)}</span>
                </div>
                <div class="dvo-lead">${v.leadTime}</div>
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <div style="display:flex; gap:10px; margin:16px 0;">
          <button
            type="button"
            class="btn btn-primary"
            style="flex:1; font-size:15px;"
            data-action="add-cart-modal"
            data-sku="${product.sku}"
            data-var="${activeVar.id}"
          >
            ${isFreePdf ? '⬇ Tải File PDF Miễn Phí Ngay' : `🛒 Đặt Mua ${activeVar.shortLabel} Ngay`}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            id="modalAskThisSkuBtn"
            data-sku="${product.sku}"
          >
            💬 Hỏi mẫu / Đặt riêng
          </button>
        </div>

        <table class="specs-table">
          <tbody>
            <tr>
              <td>Mã định danh (SKU)</td>
              <td><strong>${product.sku}</strong> (Thư mục gốc: <code>${product.folderPath}</code>)</td>
            </tr>
            <tr>
              <td>Định dạng &amp; Khổ giấy</td>
              <td>${product.formats.join(', ')} • Khổ chuẩn 1:1: <strong>${product.paperSizes.join(', ')}</strong> (${product.fileSizeMB} MB)</td>
            </tr>
            <tr>
              <td>Độ dày da khuyên dùng</td>
              <td>${product.leatherThickness}</td>
            </tr>
            <tr>
              <td>Bước đục lỗ khuyến nghị</td>
              <td>${product.chiselPitch}</td>
            </tr>
            <tr>
              <td>Định mức tiêu hao da</td>
              <td>${product.leatherEstimate} • Độ khó: <strong>${product.difficulty}</strong></td>
            </tr>
            <tr>
              <td>File trong bộ rập (${product.pdfCount})</td>
              <td>${product.pdfFileNames.join(', ') || 'Bản vẽ tiêu chuẩn'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  backdrop.classList.remove('hidden');

  // Gắn sự kiện đổi ảnh thumbnail trong modal
  content.querySelectorAll('.detail-thumb-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.detail-thumb-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const display = document.getElementById('detailMediaDisplay');
      display.innerHTML = `<img src="${btn.dataset.img}" class="detail-main-img" alt="${product.title}" />`;
    });
  });

  // Xem trực tiếp file PDF bản vẽ 1:1 ngay trong modal
  const pdfBtn = document.getElementById('togglePdfPreviewBtn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      const display = document.getElementById('detailMediaDisplay');
      display.innerHTML = `<iframe src="${pdfBtn.dataset.pdf}" class="pdf-preview-frame" title="Bản vẽ PDF ${product.sku}"></iframe>`;
    });
  }

  // Đổi biến thể trong modal
  content.querySelectorAll('.detail-variant-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      state.cardVariantOverrides[product.id] = opt.dataset.modalVar;
      openProductModal(product.sku, opt.dataset.modalVar);
      renderProducts();
    });
  });

  // Nút hỏi mẫu riêng cho SKU này
  const askSkuBtn = document.getElementById('modalAskThisSkuBtn');
  if (askSkuBtn) {
    askSkuBtn.addEventListener('click', () => {
      backdrop.classList.add('hidden');
      const skuInput = document.getElementById('consultSkuRef');
      if (skuInput) skuInput.value = `${product.sku} - ${product.title}`;
      document.getElementById('tu-van-dat-mau').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('consultName').focus();
    });
  }
}

function openToolDetailModal(toolId) {
  const tool = state.accessories.find((a) => a.id === toolId);
  if (!tool) return;
  const backdrop = document.getElementById('productModalBackdrop');
  const content = document.getElementById('productModalContent');

  content.innerHTML = `
    <div class="detail-grid">
      <div>
        <img src="${encodeURI(tool.images[0])}" alt="${tool.title}" class="detail-main-img" id="toolMainImg" />
        ${
          tool.images.length > 1
            ? `<div class="detail-thumbs">
                ${tool.images
                  .map(
                    (img, i) => `
                  <button type="button" class="detail-thumb-btn ${i === 0 ? 'active' : ''}" data-img="${encodeURI(img)}">
                    <img src="${encodeURI(img)}" alt="Ảnh ${i + 1}" />
                  </button>
                `
                  )
                  .join('')}
               </div>`
            : ''
        }
      </div>
      <div>
        <span class="sku-badge">${tool.sku}</span>
        <span class="size-badge">${tool.category}</span>
        <h2 style="font-size:22px; color:var(--bg-saddle); margin:10px 0;">${tool.title}</h2>
        <div style="font-size:28px; font-weight:900; color:var(--accent-leather); margin-bottom:12px;">
          ${formatVND(tool.price)}
          <del style="font-size:14px; color:var(--text-muted); font-weight:500; margin-left:8px;">${formatVND(tool.originalPrice)}</del>
        </div>
        <p style="font-size:14px; margin-bottom:14px;">${tool.description}</p>
        <ul class="tool-specs-list" style="margin-bottom:20px;">
          ${tool.specs.map((s) => `<li>${s}</li>`).join('')}
        </ul>
        <button type="button" class="btn btn-primary btn-full" data-action="add-tool" data-id="${tool.id}">
          🛒 Thêm Dụng Cụ Này Vào Giỏ Hàng
        </button>
      </div>
    </div>
  `;

  backdrop.classList.remove('hidden');
  content.querySelectorAll('.detail-thumb-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('toolMainImg').src = btn.dataset.img;
    });
  });
}

function addPatternToCart(sku, variantId) {
  const product = state.products.find((p) => p.sku === sku);
  if (!product) return;
  const variant = getEffectiveVariant(product, variantId);

  // Nếu là File PDF Miễn Phí (0đ) -> mở thẳng cửa sổ tải file ngay lập tức!
  if (variant.id === 'pdf_dxf' && variant.price === 0 && product.pdfFiles.length > 0) {
    openInstantFreeDownloadModal(product);
    return;
  }

  const cartKey = `${product.sku}__${variant.id}`;
  const existing = state.cart.find((c) => c.cartKey === cartKey);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      cartKey,
      itemType: 'pattern',
      sku: product.sku,
      title: product.title,
      variantId: variant.id,
      variantName: variant.name,
      deliveryType: variant.deliveryType,
      price: variant.price,
      qty: 1,
      thumb: product.images[0],
      pdfFiles: product.pdfFiles,
      pdfFileNames: product.pdfFileNames
    });
  }
  saveCart();
  openCartModal();
}

function addToolToCart(toolId) {
  const tool = state.accessories.find((a) => a.id === toolId);
  if (!tool) return;
  const cartKey = `TOOL__${tool.id}`;
  const existing = state.cart.find((c) => c.cartKey === cartKey);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      cartKey,
      itemType: 'tool',
      sku: tool.sku,
      title: tool.title,
      variantId: 'physical_tool',
      variantName: 'Phụ kiện / Dụng cụ làm đồ da',
      deliveryType: 'physical',
      price: tool.price,
      qty: 1,
      thumb: tool.images[0],
      pdfFiles: [],
      pdfFileNames: []
    });
  }
  saveCart();
  openCartModal();
}

function openInstantFreeDownloadModal(product) {
  const backdrop = document.getElementById('cartModalBackdrop');
  const content = document.getElementById('cartModalContent');

  content.innerHTML = `
    <div style="text-align:center; padding: 12px;">
      <span class="free-badge" style="font-size:13px; padding:5px 12px;">🎁 RẬP PDF MIỄN PHÍ TỪ WWW.RAPMAU.COM</span>
      <h2 style="margin:12px 0 6px; color:var(--bg-saddle);">${product.title}</h2>
      <p style="font-size:14px; color:var(--text-muted); margin-bottom:18px;">
        Bản vẽ chuẩn tỷ lệ 1:1 (Khổ ${product.paperSizes.join('/')}). Hãy chọn chế độ in <strong>Actual Size / 100%</strong> khi in ra giấy.
      </p>

      <div style="background:var(--bg-parchment); padding:16px; border-radius:12px; border:1px dashed var(--border-stitch); margin-bottom:20px;">
        <strong style="display:block; margin-bottom:10px;">Danh sách file tải xuống trực tiếp:</strong>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${product.pdfFiles
            .map(
              (url, idx) => `
            <a
              href="${encodeURI(url)}?download=1"
              class="btn btn-primary"
              download
            >
              ⬇ Tải File: ${product.pdfFileNames[idx] || `Ban-ve-${idx + 1}.pdf`} (${product.fileSizeMB} MB)
            </a>
          `
            )
            .join('')}
        </div>
      </div>

      <div style="background:var(--bg-warm); padding:14px; border-radius:10px; text-align:left; font-size:13.5px;">
        <strong>💡 Bạn không tiện in hoặc muốn rập cắt sẵn bền đẹp?</strong>
        <p style="margin:4px 0 10px; color:var(--text-muted);">
          Đặt ngay <strong>Rập Giấy Cứng 350gsm</strong> hoặc <strong>Rập Mica 2mm Cắt Laser</strong> của mẫu ${product.sku} để áp lên da cắt ngay không cần dán ghép giấy:
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn-sm btn-add" id="upsellPaperBtn">+ Đặt Rập Giấy (${formatVND(product.variants[1]?.price || 55000)})</button>
          <button type="button" class="btn-sm btn-add" id="upsellMicaBtn">+ Đặt Rập Mica 2mm (${formatVND(product.variants[2]?.price || 135000)})</button>
        </div>
      </div>
    </div>
  `;

  backdrop.classList.remove('hidden');
  const pBtn = document.getElementById('upsellPaperBtn');
  if (pBtn) pBtn.onclick = () => addPatternToCart(product.sku, 'rap_giay');
  const mBtn = document.getElementById('upsellMicaBtn');
  if (mBtn) mBtn.onclick = () => addPatternToCart(product.sku, 'rap_mica');
}

function openCartModal() {
  const backdrop = document.getElementById('cartModalBackdrop');
  const content = document.getElementById('cartModalContent');

  if (state.cart.length === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:36px 16px;">
        <h3 style="color:var(--bg-saddle); margin-bottom:8px;">Giỏ hàng của bạn đang trống</h3>
        <p style="color:var(--text-muted); margin-bottom:18px;">Hãy chọn mẫu rập PDF/DXF, Rập Giấy, Rập Mica hoặc Dụng cụ làm đồ da để bắt đầu.</p>
        <button type="button" class="btn btn-primary" id="closeEmptyCartBtn">Tiếp tục chọn mẫu rập</button>
      </div>
    `;
    backdrop.classList.remove('hidden');
    document.getElementById('closeEmptyCartBtn').onclick = () => backdrop.classList.add('hidden');
    return;
  }

  const totalAmount = state.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const hasPhysical = state.cart.some((i) => i.deliveryType !== 'digital');
  const hasDigital = state.cart.some((i) => i.deliveryType === 'digital');

  content.innerHTML = `
    <h2 style="color:var(--bg-saddle); margin-bottom:14px;">🛒 Giỏ Hàng &amp; Thanh Toán Nhanh</h2>
    <div style="max-height:260px; overflow-y:auto; border:1px solid var(--border-soft); border-radius:10px; padding:10px; margin-bottom:16px;">
      ${state.cart
        .map(
          (item, idx) => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px dashed var(--border-soft);">
          <div style="flex:1;">
            <strong style="font-size:14px;">[${item.sku}] ${item.title}</strong>
            <div style="font-size:12px; color:var(--text-muted);">${item.variantName}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn-sm btn-detail" data-cart-dec="${idx}">-</button>
            <strong>${item.qty}</strong>
            <button type="button" class="btn-sm btn-detail" data-cart-inc="${idx}">+</button>
          </div>
          <div style="min-width:95px; text-align:right; font-weight:800; color:var(--accent-leather);">
            ${formatVND(item.price * item.qty)}
          </div>
          <button type="button" class="btn-sm" style="background:#fee2e2; color:#b91c1c;" data-cart-del="${idx}">✕</button>
        </div>
      `
        )
        .join('')}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-warm); padding:12px 16px; border-radius:10px; margin-bottom:16px;">
      <span style="font-weight:700;">Tổng thanh toán (${state.cart.reduce((s, i) => s + i.qty, 0)} sản phẩm):</span>
      <strong style="font-size:24px; color:var(--accent-leather);">${formatVND(totalAmount)}</strong>
    </div>

    <form id="checkoutForm">
      <div class="form-row">
        <div class="form-field">
          <label>Họ và tên người nhận *</label>
          <input type="text" id="chkName" required placeholder="Nhập họ tên..." />
        </div>
        <div class="form-field">
          <label>Số điện thoại / Zalo nhận file &amp; đơn hàng *</label>
          <input type="tel" id="chkPhone" required placeholder="Nhập SĐT Zalo..." />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Email nhận link tải dự phòng (Nếu mua PDF/DXF)</label>
          <input type="email" id="chkEmail" placeholder="email@domain.com" />
        </div>
        <div class="form-field">
          <label>Phương thức thanh toán</label>
          <select id="chkMethod">
            <option value="vietqr">Quét mã VietQR (Mở khoá tải file PDF ngay &amp; ưu tiên gia công)</option>
            ${hasPhysical ? '<option value="cod">Thanh toán khi nhận hàng (COD cho Rập Giấy / Mica / Dụng cụ)</option>' : ''}
          </select>
        </div>
      </div>
      ${
        hasPhysical
          ? `<div class="form-field">
              <label>Địa chỉ nhận hàng (Dành cho Rập Giấy / Rập Mica / Khuôn / Dụng cụ) *</label>
              <input type="text" id="chkAddress" required placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..." />
             </div>`
          : ''
      }
      <button type="submit" class="btn btn-primary btn-full" style="font-size:15px;">
        ✅ Xác Nhận Đơn Hàng ${hasDigital ? '&amp; Nhận Link Tải File 1:1' : ''}
      </button>
    </form>
  `;

  backdrop.classList.remove('hidden');

  content.querySelectorAll('[data-cart-inc]').forEach((b) => {
    b.onclick = () => {
      state.cart[Number(b.dataset.cartInc)].qty += 1;
      saveCart();
      openCartModal();
    };
  });
  content.querySelectorAll('[data-cart-dec]').forEach((b) => {
    b.onclick = () => {
      const idx = Number(b.dataset.cartDec);
      if (state.cart[idx].qty > 1) state.cart[idx].qty -= 1;
      else state.cart.splice(idx, 1);
      saveCart();
      openCartModal();
    };
  });
  content.querySelectorAll('[data-cart-del]').forEach((b) => {
    b.onclick = () => {
      state.cart.splice(Number(b.dataset.cartDel), 1);
      saveCart();
      openCartModal();
    };
  });

  document.getElementById('checkoutForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      customer: {
        name: document.getElementById('chkName').value,
        phone: document.getElementById('chkPhone').value,
        email: document.getElementById('chkEmail').value,
        address: document.getElementById('chkAddress')?.value || 'Nhận file trực tuyến'
      },
      items: state.cart,
      totalAmount,
      paymentMethod: document.getElementById('chkMethod').value
    };

    let orderObj = {
      orderCode: `RM${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      ...payload
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json();
        if (result.ok && result.order) orderObj = result.order;
      }
    } catch {
      // Fallback lưu local khi chạy bản Cloud Static
    }

    const localOrders = JSON.parse(localStorage.getItem('rapmau_local_orders') || '[]');
    localOrders.unshift(orderObj);
    localStorage.setItem('rapmau_local_orders', JSON.stringify(localOrders));

    const orderedItems = [...state.cart];
    state.cart = [];
    saveCart();
    renderOrderSuccessView(orderObj, orderedItems);
  };
}

function renderOrderSuccessView(order, orderedItems) {
  const content = document.getElementById('cartModalContent');
  const bank = state.catalog?.site?.bankInfo || {
    bankId: 'MB',
    bankName: 'MBBank',
    accountNo: '0971463768',
    accountName: 'MR TUAN RAPMAU'
  };
  const qrUrl = `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNo}-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(order.orderCode)}&accountName=${encodeURIComponent(bank.accountName)}`;
  const digitalItems = orderedItems.filter((i) => i.deliveryType === 'digital' && i.pdfFiles?.length > 0);

  content.innerHTML = `
    <div style="text-align:center;">
      <span class="free-badge" style="font-size:13px; padding:5px 12px;">🎉 ĐẶT HÀNG THÀNH CÔNG • MÃ ĐƠN: ${order.orderCode}</span>
      <h2 style="margin:10px 0 6px; color:var(--bg-saddle);">Cảm ơn ${order.customer.name} đã đặt hàng tại www.rapmau.com!</h2>
      <p style="font-size:13.5px; color:var(--text-muted);">
        Thông tin đơn hàng đã được lưu vào hệ thống quản trị.
      </p>
    </div>

    ${
      order.totalAmount > 0
        ? `
      <div class="vietqr-box">
        <img src="${qrUrl}" alt="Mã thanh toán VietQR ${order.orderCode}" />
        <div>
          <span class="sku-badge">THANH TOÁN VIETQR TỰ ĐỘNG</span>
          <h4 style="margin:8px 0 4px; color:var(--bg-saddle);">${bank.bankName}</h4>
          <p style="font-size:13.5px;">Số tài khoản: <strong>${bank.accountNo}</strong> (${bank.accountName})</p>
          <p style="font-size:13.5px;">Số tiền: <strong style="color:var(--accent-leather); font-size:17px;">${formatVND(order.totalAmount)}</strong></p>
          <p style="font-size:13.5px;">Nội dung CK: <strong style="background:#fef3c7; padding:2px 6px; border-radius:4px;">${order.orderCode}</strong></p>
        </div>
      </div>
    `
        : ''
    }

    ${
      digitalItems.length > 0
        ? `
      <div style="margin-top:18px; background:#f0fdf4; border:1.5px solid #16a34a; border-radius:12px; padding:16px;">
        <strong style="color:#166534; display:block; margin-bottom:10px;">
          📂 KHO FILE PDF/DXF TRONG ĐƠN HÀNG CỦA BẠN (SẴN SÀNG TẢI XUỐNG):
        </strong>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${digitalItems
            .map((item) =>
              item.pdfFiles
                .map(
                  (fUrl, idx) => `
              <a href="${encodeURI(fUrl)}?download=1" class="btn btn-secondary" download style="justify-content:space-between;">
                <span>⬇ [${item.sku}] ${item.pdfFileNames[idx] || 'Ban-ve.pdf'}</span>
                <span>Tải File Gốc 1:1</span>
              </a>
            `
                )
                .join('')
            )
            .join('')}
        </div>
      </div>
    `
        : ''
    }
  `;
}

async function openAdminModal() {
  const backdrop = document.getElementById('adminModalBackdrop');
  const content = document.getElementById('adminModalContent');
  backdrop.classList.remove('hidden');

  const res = await fetch('/api/admin-data');
  const adminData = await res.json();
  const site = state.catalog.site || {};
  const bank = site.bankInfo || {};

  content.innerHTML = `
    <h2 style="color:var(--bg-saddle); margin-bottom:6px;">⚙️ Quản Trị Hệ Thống &amp; Thiết Lập Tên Miền www.rapmau.com</h2>
    <p style="font-size:13.5px; color:var(--text-muted); margin-bottom:20px;">
      Quản lý thông tin liên hệ, tài khoản nhận tiền VietQR, danh sách đơn hàng và hướng dẫn trỏ tên miền <strong>www.rapmau.com</strong>.
    </p>

    <div class="detail-grid">
      <!-- Form cấu hình thông tin Shop & VietQR -->
      <form id="adminSiteConfigForm" style="background:var(--bg-parchment); padding:18px; border-radius:12px; border:1px solid var(--border-soft);">
        <h3 style="margin-bottom:12px; color:var(--bg-saddle);">1. Cấu Hình Liên Hệ &amp; Tài Khoản VietQR</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Số Hotline hiển thị</label>
            <input type="text" id="admHotline" value="${site.hotline || ''}" />
          </div>
          <div class="form-field">
            <label>Số Zalo nhận tư vấn</label>
            <input type="text" id="admZalo" value="${site.zalo || ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Email liên hệ</label>
            <input type="email" id="admEmail" value="${site.email || ''}" />
          </div>
          <div class="form-field">
            <label>Mã Ngân Hàng VietQR (VD: MB, VCB, TCB, ACB)</label>
            <input type="text" id="admBankId" value="${bank.bankId || 'MB'}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Số tài khoản nhận tiền</label>
            <input type="text" id="admAccountNo" value="${bank.accountNo || ''}" />
          </div>
          <div class="form-field">
            <label>Chủ tài khoản (Không dấu)</label>
            <input type="text" id="admAccountName" value="${bank.accountName || ''}" />
          </div>
        </div>
        <div class="form-field">
          <label>Link Nhóm Zalo "Chia Sẻ Mẫu &amp; Sách Miễn Phí" (VD: https://zalo.me/g/...)</label>
          <input type="text" id="admZaloGroupUrl" value="${site.zaloGroupUrl || 'https://zalo.me/0971463768'}" />
        </div>
        <div class="form-field">
          <label>Địa chỉ xưởng / Ghi chú giao hàng</label>
          <input type="text" id="admAddress" value="${site.address || ''}" />
        </div>
        <button type="submit" class="btn btn-primary btn-full">💾 Lưu Cấu Hình Website www.rapmau.com</button>
        <p id="admSaveFeedback" class="form-feedback hidden"></p>
      </form>

      <!-- Hướng dẫn kết nối tên miền www.rapmau.com -->
      <div style="background:#fff; padding:18px; border-radius:12px; border:1px solid var(--border-soft);">
        <h3 style="margin-bottom:10px; color:var(--bg-saddle);">2. Hướng Dẫn Trỏ Tên Miền www.rapmau.com</h3>
        <ol class="guide-steps" style="font-size:13px;">
          <li>
            <strong>Bước 1: Đưa DNS rapmau.com lên Cloudflare (Miễn phí SSL + CDN)</strong>
            <p>Đăng nhập trang quản lý tên miền bạn đã mua, đổi Nameservers về 2 NS của Cloudflare để có chứng chỉ bảo mật HTTPS tự động.</p>
          </li>
          <li>
            <strong>Bước 2: Triển khai mã nguồn (VPS / Cloudflare Tunnel / Render / Railway)</strong>
            <p>Chạy lệnh <code>npm start</code> (cổng <code>3080</code>). Cấu hình bản ghi DNS:<br/>
            • <code>A Record</code>: <code>@</code> → IP Server (hoặc <code>CNAME www</code> → địa chỉ host).</p>
          </li>
          <li>
            <strong>Bước 3: Khai báo Google Search Console</strong>
            <p>Gửi đường dẫn <code>https://www.rapmau.com/sitemap.xml</code> (đã tạo sẵn 283 URL chuẩn SEO cho toàn bộ 258 mẫu rập và 21 danh mục).</p>
          </li>
        </ol>
      </div>
    </div>

    <!-- Danh sách đơn hàng & Yêu cầu tư vấn -->
    <div style="margin-top:22px; display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div style="background:#fff; border:1px solid var(--border-soft); border-radius:12px; padding:16px;">
        <h4>📦 Đơn Hàng Mới Nhất (${adminData.orders.length})</h4>
        <div style="max-height:200px; overflow-y:auto; margin-top:8px; font-size:13px;">
          ${
            adminData.orders.length === 0
              ? '<p style="color:var(--text-muted);">Chưa có đơn hàng nào.</p>'
              : adminData.orders
                  .map(
                    (o) => `
                  <div style="padding:8px 0; border-bottom:1px dashed var(--border-soft);">
                    <strong>#${o.orderCode}</strong> — ${o.customer?.name} (${o.customer?.phone}) — <strong style="color:var(--accent-leather);">${formatVND(o.totalAmount)}</strong>
                  </div>
                `
                  )
                  .join('')
          }
        </div>
      </div>

      <div style="background:#fff; border:1px solid var(--border-soft); border-radius:12px; padding:16px;">
        <h4>💬 Yêu Cầu Hỏi Mẫu &amp; Đặt Khuôn (${adminData.consultations.length})</h4>
        <div style="max-height:200px; overflow-y:auto; margin-top:8px; font-size:13px;">
          ${
            adminData.consultations.length === 0
              ? '<p style="color:var(--text-muted);">Chưa có yêu cầu tư vấn nào.</p>'
              : adminData.consultations
                  .map(
                    (c) => `
                  <div style="padding:8px 0; border-bottom:1px dashed var(--border-soft);">
                    <strong>${c.name} (${c.phone})</strong>: ${c.needType} ${c.skuRef ? `[Mã: ${c.skuRef}]` : ''}
                    <div style="color:var(--text-muted); font-size:12px;">${c.message}</div>
                  </div>
                `
                  )
                  .join('')
          }
        </div>
      </div>
    </div>
  `;

  document.getElementById('adminSiteConfigForm').onsubmit = async (e) => {
    e.preventDefault();
    const updatedSite = {
      ...site,
      hotline: document.getElementById('admHotline').value.trim(),
      zalo: document.getElementById('admZalo').value.trim(),
      zaloGroupUrl: document.getElementById('admZaloGroupUrl')?.value.trim() || 'https://zalo.me/0971463768',
      email: document.getElementById('admEmail').value.trim(),
      address: document.getElementById('admAddress').value.trim(),
      bankInfo: {
        bankId: document.getElementById('admBankId').value.trim(),
        bankName: document.getElementById('admBankId').value.trim(),
        accountNo: document.getElementById('admAccountNo').value.trim(),
        accountName: document.getElementById('admAccountName').value.trim()
      }
    };
    const resp = await fetch('/api/site-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: updatedSite })
    });
    const resJson = await resp.json();
    if (resJson.ok) {
      state.catalog.site = resJson.site;
      hydrateSiteMetadata();
      const fb = document.getElementById('admSaveFeedback');
      fb.textContent = '✅ Đã lưu cấu hình thành công!';
      fb.classList.remove('hidden');
    }
  };
}

function resetAllFilters() {
  state.selectedCategory = 'all';
  state.paperSizeFilter = 'all';
  state.specialFilter = 'all';
  state.sortFilter = 'featured';
  state.searchQuery = '';
  state.visibleCount = 24;

  document.getElementById('globalSearchInput').value = '';
  document.getElementById('clearSearchBtn').classList.add('hidden');
  document.getElementById('paperSizeFilter').value = 'all';
  document.getElementById('specialFilter').value = 'all';
  document.getElementById('sortFilter').value = 'featured';

  document.querySelectorAll('.ws-quick-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.quick === 'all');
  });

  renderCategoryPills();
  renderProducts();
}

function bindEvents() {
  // Chuyển đổi chế độ hiển thị giá 4 biến thể toàn cục ở Hero
  document.querySelectorAll('#globalVariantSelector .variant-mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#globalVariantSelector .variant-mode-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      state.selectedVariantMode = card.dataset.variant;
      state.cardVariantOverrides = {};
      document.getElementById('currentVariantModeLabel').textContent = VARIANT_LABELS[state.selectedVariantMode];
      renderProducts();
    });
  });

  // Sự kiện uỷ quyền trên lưới sản phẩm Rập Mẫu
  document.getElementById('productGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const sku = btn.dataset.sku;

    if (action === 'detail') {
      openProductModal(sku);
    } else if (action === 'switch-card-var') {
      const p = state.products.find((item) => item.sku === sku);
      if (p) {
        state.cardVariantOverrides[p.id] = btn.dataset.var;
        renderProducts();
      }
    } else if (action === 'add-cart') {
      addPatternToCart(sku, btn.dataset.var);
    }
  });

  // Sự kiện uỷ quyền trên lưới Dụng cụ & Phụ kiện
  document.getElementById('toolsGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'add-tool') {
      addToolToCart(btn.dataset.id);
    } else if (btn.dataset.action === 'tool-detail') {
      openToolDetailModal(btn.dataset.id);
    }
  });

  // Sự kiện trong Modal chi tiết sản phẩm
  document.getElementById('productModalContent').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'add-cart-modal') {
      document.getElementById('productModalBackdrop').classList.add('hidden');
      addPatternToCart(btn.dataset.sku, btn.dataset.var);
    } else if (btn.dataset.action === 'add-tool') {
      addToolToCart(btn.dataset.id);
    }
  });

  // Tìm kiếm tức thì
  const searchInput = document.getElementById('globalSearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    state.visibleCount = 24;
    clearBtn.classList.toggle('hidden', !state.searchQuery);
    renderProducts();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearBtn.classList.add('hidden');
    renderProducts();
  });

  // Bộ lọc kỹ thuật
  document.getElementById('paperSizeFilter').addEventListener('change', (e) => {
    state.paperSizeFilter = e.target.value;
    state.visibleCount = 24;
    renderProducts();
  });
  document.getElementById('specialFilter').addEventListener('change', (e) => {
    state.specialFilter = e.target.value;
    state.visibleCount = 24;
    renderProducts();
  });
  document.getElementById('sortFilter').addEventListener('change', (e) => {
    state.sortFilter = e.target.value;
    renderProducts();
  });
  document.getElementById('resetFiltersBtn').addEventListener('click', resetAllFilters);

  // Nút xem thêm
  document.getElementById('loadMoreBtn').addEventListener('click', () => {
    state.visibleCount += 24;
    renderProducts();
  });

  // Menu Rập PDF Miễn Phí & Bộ lọc nhanh ở Sidebar trái
  document.querySelectorAll('.ws-quick-btn').forEach((qBtn) => {
    qBtn.addEventListener('click', () => {
      document.querySelectorAll('.ws-quick-btn').forEach((b) => b.classList.remove('active'));
      qBtn.classList.add('active');
      state.specialFilter = qBtn.dataset.quick || 'all';
      document.getElementById('specialFilter').value = state.specialFilter;
      state.visibleCount = 24;
      renderProducts();
    });
  });

  // Đổi mật độ hiển thị 3 cột / 4 cột
  document.querySelectorAll('.density-btn').forEach((dBtn) => {
    dBtn.addEventListener('click', () => {
      document.querySelectorAll('.density-btn').forEach((b) => b.classList.remove('active'));
      dBtn.classList.add('active');
      const grid = document.getElementById('productGrid');
      grid.classList.toggle('cols-4', dBtn.dataset.cols === '4');
      grid.classList.toggle('cols-3', dBtn.dataset.cols !== '4');
    });
  });

  // Tab lọc Dụng cụ & Phụ kiện
  document.querySelectorAll('#toolsFilterTabs .tool-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#toolsFilterTabs .tool-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.selectedToolCat = tab.dataset.toolcat;
      renderTools();
    });
  });

  // Tab lọc 3 thư mục Sách Miễn Phí (Ebook / Bộ sách nhật / Ebook China)
  document.querySelectorAll('#booksFolderTabs .book-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#booksFolderTabs .book-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.selectedBookFolder = tab.dataset.folder;
      renderFreeBooks();
    });
  });

  // Sự kiện mở modal nhận sách miễn phí qua Nhóm Zalo
  const freeBooksGrid = document.getElementById('freeBooksGrid');
  if (freeBooksGrid) {
    freeBooksGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-book-action]');
      if (!btn) return;
      openZaloBookModal(btn.dataset.bookId);
    });
  }

  const unlockModalBtn = document.getElementById('openBookUnlockModalBtn');
  if (unlockModalBtn) {
    unlockModalBtn.onclick = () => openZaloBookModal(null);
  }

  // Mở/đóng các Modal
  document.getElementById('closeProductModalBtn').onclick = () =>
    document.getElementById('productModalBackdrop').classList.add('hidden');
  document.getElementById('closeCartModalBtn').onclick = () =>
    document.getElementById('cartModalBackdrop').classList.add('hidden');
  document.getElementById('closeAdminModalBtn').onclick = () =>
    document.getElementById('adminModalBackdrop').classList.add('hidden');

  document.getElementById('openCartBtn').onclick = openCartModal;
  const openAdminBtn = document.getElementById('openAdminBtn');
  if (openAdminBtn) openAdminBtn.onclick = openAdminModal;

  const scrollToConsult = () => {
    document.getElementById('tu-van-dat-mau').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('consultName').focus();
  };
  const openConsultBtn = document.getElementById('openConsultModalBtn');
  if (openConsultBtn) openConsultBtn.onclick = scrollToConsult;
  document.getElementById('heroAskBtn').onclick = scrollToConsult;
  document.getElementById('floatingAskBtn').onclick = scrollToConsult;

  // Footer link chọn danh mục
  document.querySelectorAll('#footerCategoryLinks a[data-cat]').forEach((a) => {
    a.addEventListener('click', () => {
      state.selectedCategory = a.dataset.cat;
      renderCategoryPills();
      renderProducts();
    });
  });

  // Form gửi yêu cầu tư vấn "Cần hỏi mẫu phù hợp, hãy liên hệ"
  document.getElementById('consultForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('consultName').value.trim(),
      phone: document.getElementById('consultPhone').value.trim(),
      needType: document.getElementById('consultNeedType').value,
      skuRef: document.getElementById('consultSkuRef').value.trim(),
      message: document.getElementById('consultMessage').value.trim()
    };
    let entryId = `TV${Date.now().toString().slice(-6)}`;
    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.entry?.id) entryId = data.entry.id;
      }
    } catch {
      // Fallback trên bản Cloud Static
    }
    const fb = document.getElementById('consultFeedback');
    fb.textContent = `✅ Đã nhận yêu cầu #${entryId}! Mr.Tuan (0971.463.768) sẽ liên hệ Zalo/SĐT ${payload.phone} trong ít phút.`;
    fb.classList.remove('hidden');
    e.target.reset();
  });
}

initApp();
