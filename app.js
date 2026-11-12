const state = {
  catalog: null,
  products: [],
  accessories: [],
  freeBooks: [],
  articles: [],
  categories: [],
  selectedCategory: 'all',
  selectedVariantMode: 'pdf_dxf',
  cardVariantOverrides: {},
  paperSizeFilter: 'all',
  specialFilter: 'all',
  sortFilter: 'featured',
  searchQuery: '',
  visibleCount: 24,
  visibleToolsCount: 8,
  visibleBooksCount: 4,
  visibleArticlesCount: 4,
  showAllFaqs: false,
  selectedToolCat: 'all',
  selectedArticleCat: 'all',
  selectedBookFolder: 'all',
  zaloBooksUnlocked: true,
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

function resolveDownloadAction({ url, externalUrl, sizeMB, itemLabel }) {
  if (externalUrl) {
    return {
      mode: 'external',
      href: externalUrl,
      isDirect: false,
      sizeLabel: sizeMB ? `${sizeMB} MB` : 'Google Drive'
    };
  }
  const host = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.');

  const oversizedMap = (state.catalog && state.catalog.oversizedMedia) || {};
  const hasManifest = Object.keys(oversizedMap).length > 0;
  const nfcUrl = String(url || '').normalize('NFC');
  const inOversized = Object.prototype.hasOwnProperty.call(oversizedMap, nfcUrl);
  const effectiveSize =
    typeof oversizedMap[nfcUrl] === 'number' && oversizedMap[nfcUrl] > 0
      ? oversizedMap[nfcUrl]
      : Number(sizeMB) || 0;

  if (!isLocal && (inOversized || (!hasManifest && effectiveSize > 24))) {
    const label = itemLabel || 'Tài liệu / Bản vẽ PDF';
    const sizeText = effectiveSize > 0 ? `${effectiveSize} MB` : '>24 MB';
    const subject = encodeURIComponent(`[NHẬN LINK DRIVE] ${label}`);
    const body = encodeURIComponent(
      `Xin chào Ban Quản Trị RAPMAU.COM,\nNhờ gửi giúp mình link tải Google Drive cho tài liệu dung lượng lớn:\n- Tên tài liệu: ${label}\n- Dung lượng: ${sizeText}\n- Đường dẫn tham khảo: ${nfcUrl}\n\nXin cảm ơn!`
    );
    return {
      mode: 'mailto',
      href: `mailto:info@rapmau.com?subject=${subject}&body=${body}`,
      isDirect: false,
      sizeLabel: sizeText
    };
  }

  return {
    mode: 'direct',
    href: encodeURI(url || '#'),
    isDirect: true,
    sizeLabel: effectiveSize > 0 ? `${effectiveSize} MB` : ''
  };
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
    let fromApi = false;
    let res = await fetch('/api/catalog').catch(() => null);
    if (res && res.ok) {
      fromApi = true;
    } else {
      res = await fetch('/data/catalog.json');
    }
    let data = await res.json();
    if (!fromApi) {
      const localOverride = localStorage.getItem('rapmau_cms_catalog_override_v4');
      if (localOverride) {
        try {
          data = JSON.parse(localOverride);
        } catch {
          // ignore
        }
      }
    }
    state.catalog = data;
    state.products = data.products || [];
    state.accessories = data.accessories || [];
    state.freeBooks = data.freeBooks || [];
    state.articles = data.articles || [];
    state.categories = data.categories || [];

    hydrateSiteMetadata();
    applyRouteFromLocation({ initial: true });
    renderCategoryPills();
    renderProducts();
    renderFreeBooks();
    renderTools();
    renderArticles();
    renderGlobalFaqs();
    updateCartBadge();
    bindEvents();
  } catch (err) {
    console.error('Lỗi tải catalog:', err);
  }
}

const DEFAULT_SEO = {
  title: 'RAPMAU.COM — Rập Mẫu Đồ Da PDF/DXF, Rập Giấy, Rập Mica, Khuôn Bế & Dụng Cụ Làm Đồ Da',
  description:
    'Kho kiến thức nghề da, rập PDF/DXF tỷ lệ 1:1 miễn phí, công cụ chế tác và diễn đàn kỹ thuật đồ da. Kết nối xưởng gia công, nhà cung cấp & khách hàng B2B qua Email: info@rapmau.com.',
  canonical: 'https://www.rapmau.com/',
  h1Html:
    'Chọn <span class="text-accent">rập PDF/DXF</span>, <span class="text-accent">rập giấy</span>, <span class="text-accent">rập mica</span> hoặc <span class="text-accent">khuôn theo mẫu</span>'
};

function setDocumentMeta({ title, description, canonical, h1Text, jsonLd }) {
  if (title) document.title = title;
  const descEl = document.querySelector('meta[name="description"]');
  if (descEl && description) descEl.setAttribute('content', description);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && title) ogTitle.setAttribute('content', title);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc && description) ogDesc.setAttribute('content', description);
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl && canonical) ogUrl.setAttribute('content', canonical);
  const canonEl = document.querySelector('link[rel="canonical"]');
  if (canonEl && canonical) canonEl.setAttribute('href', canonical);
  const h1El = document.querySelector('.ch-title');
  if (h1El) {
    if (h1Text) h1El.textContent = h1Text;
    else h1El.innerHTML = DEFAULT_SEO.h1Html;
  }

  let ldScript = document.getElementById('dynamicJsonLd');
  if (jsonLd) {
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.id = 'dynamicJsonLd';
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(jsonLd);
  } else if (ldScript) {
    ldScript.remove();
  }
}

function buildProductJsonLd(product) {
  const prices = product.variants.map((v) => v.price).filter((p) => p >= 0);
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);
  const prodUrl = `https://www.rapmau.com/rap-mau/${product.slug}`;
  const imgUrl = product.images[0]?.startsWith('http')
    ? product.images[0]
    : `https://www.rapmau.com${encodeURI(product.images[0] || '/assets/brand/hero-workbench.jpg')}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    sku: product.sku,
    mpn: product.sku,
    image: [imgUrl],
    description: `${product.title} chuẩn tỷ lệ 1:1 (Khổ ${product.paperSizes.join('/')}). Độ dày da khuyên dùng: ${product.leatherThickness}, bước đục: ${product.chiselPitch}. Cung cấp đủ 4 phiên bản: File PDF/DXF, Rập Giấy 350gsm, Rập Mica 2mm và Khuôn Bế Thép tại www.rapmau.com.`,
    brand: {
      '@type': 'Brand',
      name: 'RAPMAU.COM'
    },
    category: product.categoryName,
    offers: {
      '@type': 'AggregateOffer',
      url: prodUrl,
      priceCurrency: 'VND',
      lowPrice,
      highPrice,
      offerCount: product.variants.length,
      availability: 'https://schema.org/InStock',
      offers: product.variants.map((v) => ({
        '@type': 'Offer',
        name: v.name,
        sku: `${product.sku}-${v.id.toUpperCase()}`,
        price: v.price,
        priceCurrency: 'VND',
        availability: 'https://schema.org/InStock',
        url: prodUrl
      }))
    }
  };
}

function buildCategoryJsonLd(catObj, catProducts) {
  const catUrl = `https://www.rapmau.com/danh-muc/${catObj.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${catObj.name} (${catObj.count} mẫu chuẩn 1:1)`,
    url: catUrl,
    description: `Tuyển tập ${catObj.count} mẫu ${catObj.name.toLowerCase()} chuẩn tỷ lệ 1:1 tại www.rapmau.com: tải file PDF/DXF hoặc đặt cắt Rập Giấy 350gsm, Rập Mica 2mm và Khuôn Bế Thép.`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: catProducts.length,
      itemListElement: catProducts.slice(0, 20).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://www.rapmau.com/rap-mau/${p.slug}`,
        name: p.title
      }))
    }
  };
}

function syncCategorySeoAndUrl(catKey, { pushUrl = true } = {}) {
  if (catKey === 'all') {
    if (pushUrl && window.location.pathname !== '/') {
      window.history.pushState({ type: 'home' }, '', '/');
    }
    setDocumentMeta({
      title: DEFAULT_SEO.title,
      description: DEFAULT_SEO.description,
      canonical: DEFAULT_SEO.canonical,
      h1Text: null,
      jsonLd: null
    });
    return;
  }

  const catObj = state.categories.find((c) => c.key === catKey || c.slug === catKey);
  if (!catObj) return;
  const targetPath = `/danh-muc/${catObj.slug}`;
  if (pushUrl && window.location.pathname !== targetPath) {
    window.history.pushState({ type: 'category', catKey: catObj.key }, '', targetPath);
  }
  const catProducts = state.products.filter((p) => p.categoryKey === catObj.key);
  setDocumentMeta({
    title: `${catObj.name} — ${catObj.count} Mẫu Rập PDF/DXF, Rập Giấy, Rập Mica 1:1 | RAPMAU.COM`,
    description: `Chọn ngay ${catObj.count} mẫu ${catObj.name} chuẩn tỷ lệ 1:1: tải file PDF/DXF miễn phí 24/7, đặt cắt CNC Rập Giấy 350gsm, Rập Mica 2mm hoặc Khuôn Bế Thép. Kết nối xưởng & nhà cung cấp qua Email: info@rapmau.com.`,
    canonical: `https://www.rapmau.com${targetPath}`,
    h1Text: `${catObj.name} (${catObj.count} Mẫu Chuẩn 1:1)`,
    jsonLd: buildCategoryJsonLd(catObj, catProducts)
  });
}

function buildArticleJsonLd(article) {
  const artUrl = `https://www.rapmau.com/bai-viet/${article.slug}`;
  const imgUrl = article.image?.startsWith('http')
    ? article.image
    : `https://www.rapmau.com${encodeURI(article.image || '/assets/brand/hero-workbench.jpg')}`;

  const graph = [
    {
      '@type': 'Article',
      '@id': `${artUrl}#article`,
      headline: article.title,
      description: article.excerpt || article.aeoAnswer,
      image: [imgUrl],
      datePublished: article.publishedAt || '2026-11-01',
      dateModified: article.updatedAt || '2026-11-10',
      author: {
        '@type': 'Organization',
        name: article.author || 'Xưởng Rập Mẫu Đồ Da RAPMAU.COM',
        url: 'https://www.rapmau.com/'
      },
      publisher: {
        '@type': 'Organization',
        name: 'RAPMAU.COM',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.rapmau.com/assets/brand/logo-header.png'
        }
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': artUrl
      }
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ RAPMAU.COM', item: 'https://www.rapmau.com/' },
        { '@type': 'ListItem', position: 2, name: 'Cẩm Nang Kỹ Thuật Đồ Da', item: 'https://www.rapmau.com/bai-viet' },
        { '@type': 'ListItem', position: 3, name: article.title, item: artUrl }
      ]
    }
  ];

  const faqEntities = [];
  if (article.aeoQuestion && article.aeoAnswer) {
    faqEntities.push({
      '@type': 'Question',
      name: article.aeoQuestion,
      acceptedAnswer: { '@type': 'Answer', text: article.aeoAnswer }
    });
  }
  if (Array.isArray(article.faqs)) {
    for (const f of article.faqs) {
      faqEntities.push({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      });
    }
  }
  if (faqEntities.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${artUrl}#faq`,
      mainEntity: faqEntities
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph
  };
}

function applyRouteFromLocation({ initial = false } = {}) {
  const rawPath = decodeURIComponent(window.location.pathname).replace(/\/+$/, '') || '/';
  const preRoute = window.__INITIAL_ROUTE__;

  if (preRoute?.type === 'article' || rawPath.startsWith('/bai-viet/')) {
    const slug = preRoute?.slug || rawPath.replace('/bai-viet/', '').split('/')[0];
    const foundArt = state.articles.find((a) => a.slug === slug || a.id === slug);
    if (foundArt) {
      if (initial) {
        setTimeout(() => {
          openArticleModal(foundArt.slug, { pushUrl: false });
        }, 0);
      } else {
        openArticleModal(foundArt.slug, { pushUrl: false });
      }
      return;
    }
  }

  if (preRoute?.type === 'articles_hub' || rawPath === '/bai-viet') {
    state.visibleArticlesCount = 999;
    state.showAllFaqs = true;
    document.getElementById('articleModalBackdrop')?.classList.add('hidden');
    setDocumentMeta({
      title: 'Cẩm Nang Kỹ Thuật Làm Đồ Da Handmade, In Rập 1:1 & Bảng Quy Đổi Thông Số | RAPMAU.COM',
      description: 'Hệ thống bài viết chuyên sâu và hỏi đáp trực tiếp (AEO/FAQ) về cách in rập PDF tỷ lệ 1:1, chọn đục lỗ & cỡ chỉ sáp, định mức Pia da thuộc và quy trình làm đồ da.',
      canonical: 'https://www.rapmau.com/bai-viet',
      h1Text: 'Cẩm Nang Kỹ Thuật Làm Đồ Da & Hỏi Đáp Chuẩn Xưởng'
    });
    if (initial) {
      setTimeout(() => {
        document.getElementById('cam-nang-bai-viet')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
    return;
  }

  if (preRoute?.type === 'category' || rawPath.startsWith('/danh-muc/')) {
    const slug = preRoute?.slug || rawPath.replace('/danh-muc/', '').split('/')[0];
    const foundCat = state.categories.find((c) => c.slug === slug || c.key === slug);
    if (foundCat) {
      state.selectedCategory = foundCat.key;
      syncCategorySeoAndUrl(foundCat.key, { pushUrl: false });
      document.getElementById('productModalBackdrop')?.classList.add('hidden');
      return;
    }
  }

  if (preRoute?.type === 'product' || rawPath.startsWith('/rap-mau/')) {
    const slug = preRoute?.slug || rawPath.replace('/rap-mau/', '').split('/')[0];
    const foundProd = state.products.find(
      (p) => p.slug === slug || p.sku.toLowerCase() === slug.toLowerCase()
    );
    if (foundProd) {
      state.selectedCategory = foundProd.categoryKey;
      if (initial) {
        setTimeout(() => {
          openProductModal(foundProd.sku, null, { pushUrl: false });
        }, 0);
      } else {
        openProductModal(foundProd.sku, null, { pushUrl: false });
      }
      return;
    }
  }

  state.selectedCategory = 'all';
  document.getElementById('productModalBackdrop')?.classList.add('hidden');
  syncCategorySeoAndUrl('all', { pushUrl: false });
}

function hydrateSiteMetadata() {
  const { site, stats } = state.catalog;
  if (stats) {
    document.getElementById('navTotalPatterns').textContent = stats.totalPatterns;
    document.getElementById('navFreeCount').textContent = stats.freePatternsCount;
    document.getElementById('navToolsCount').textContent = stats.totalToolsAndAccessories;
    const fbCountEl = document.getElementById('navFreeBooksCount');
    if (fbCountEl) fbCountEl.textContent = stats.freeBooksCount || state.freeBooks.length;
    const artCountEl = document.getElementById('navArticlesCount');
    if (artCountEl) artCountEl.textContent = state.articles.length || 8;
    document.getElementById('statPatterns').textContent = `${stats.totalPatterns}+`;
    document.getElementById('statCategories').textContent = stats.totalCategories;
  }
  if (site) {
    const emailStr = site.email || 'info@rapmau.com';
    const hotlineDisplay = document.getElementById('contactHotlineDisplay');
    if (hotlineDisplay) hotlineDisplay.textContent = emailStr;
    const emailDisplay = document.getElementById('contactEmailDisplay');
    if (emailDisplay) emailDisplay.textContent = emailStr;
    const addressDisplay = document.getElementById('contactAddressDisplay');
    if (addressDisplay) addressDisplay.textContent = site.address || '';
    const topbarEl = document.getElementById('topbarHotline');
    if (topbarEl) {
      topbarEl.textContent = `✉️ Email kết nối: ${emailStr}`;
      topbarEl.href = `mailto:${emailStr}`;
    }
    const directLink = document.getElementById('directZaloLink');
    if (directLink) directLink.href = `mailto:${emailStr}`;
    if (site.ctaNote) {
      const subEl = document.querySelector('.ch-sub');
      if (subEl) subEl.textContent = site.ctaNote;
    }
  }
}

function normalizeSearchText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function renderCategoryPills() {
  const container = document.getElementById('categoryPillsContainer');
  const searchInput = document.getElementById('sidebarCatSearchInput');
  const query = normalizeSearchText(searchInput ? searchInput.value : '');
  const total = state.products.length;
  let html = '';

  if (!query) {
    html += `
      <button type="button" class="cat-pill ${state.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
        <span>Tất cả 21 danh mục</span>
        <span class="cat-pill-count">${total}</span>
      </button>
    `;
  }

  let matchedCount = 0;
  for (const cat of state.categories) {
    if (query) {
      const hay = normalizeSearchText(`${cat.shortName} ${cat.name} ${cat.key}`);
      if (!hay.includes(query)) continue;
    }
    matchedCount++;
    const active = state.selectedCategory === cat.key ? 'active' : '';
    html += `
      <button type="button" class="cat-pill ${active}" data-cat="${cat.key}" title="${cat.name} (${cat.count} mẫu)">
        <span>${cat.shortName}</span>
        <span class="cat-pill-count">${cat.count}</span>
      </button>
    `;
  }

  if (query && matchedCount === 0) {
    html += '<div class="ws-cat-empty">Không tìm thấy danh mục phù hợp.</div>';
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
      syncCategorySeoAndUrl(state.selectedCategory, { pushUrl: true });
      renderCategoryPills();
      renderProducts();
      const activeBtn = container.querySelector('.cat-pill.active');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
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
      statusText.innerHTML = `<strong style="color:var(--accent-green);">✅ Thư viện 26 sách &amp; giáo trình mở tự do 100%!</strong> Bấm tải trực tiếp bên dưới (file nặng &gt;24 MB nhận link Google Drive qua Email <strong>info@rapmau.com</strong>):`;
    }
    if (unlockBtn) {
      unlockBtn.textContent = '📂 Xem Danh Sách Tải Nhanh Toàn Bộ 26 Sách';
    }
  }

  const list = state.freeBooks.filter((b) => {
    if (state.selectedBookFolder === 'all') return true;
    return b.folderKey === state.selectedBookFolder;
  });

  const visibleBooks = list.slice(0, state.visibleBooksCount);
  const loadMoreBooksWrap = document.getElementById('loadMoreBooksWrap');
  const loadMoreBooksBtn = document.getElementById('loadMoreBooksBtn');
  if (loadMoreBooksWrap && loadMoreBooksBtn) {
    if (list.length > state.visibleBooksCount) {
      loadMoreBooksWrap.classList.remove('hidden');
      loadMoreBooksBtn.textContent = `📚 Xem trọn bộ ${list.length} đầu sách đồ da miễn phí (+${list.length - state.visibleBooksCount} cuốn)`;
    } else if (list.length > 4) {
      loadMoreBooksWrap.classList.remove('hidden');
      loadMoreBooksBtn.textContent = '📚 Thu gọn danh sách sách (hiện 4 cuốn tiêu biểu)';
    } else {
      loadMoreBooksWrap.classList.add('hidden');
    }
  }

  grid.innerHTML = visibleBooks
    .map((b) => {
      const cover = encodeURI(b.cover || '/assets/tools/pattern-placeholder.svg');
      const dl = resolveDownloadAction({
        url: b.downloadUrl,
        externalUrl: b.externalUrl,
        sizeMB: b.sizeMB,
        itemLabel: `${b.id} - ${b.title}`
      });
      const btnHref = dl.mode === 'direct' ? `${dl.href}?download=1` : dl.href;
      const btnAttrs = dl.mode === 'direct' ? 'download' : 'target="_blank" rel="noopener"';
      const btnBg = dl.mode === 'mailto' ? '#0284c7' : 'var(--accent-green)';
      const btnLabel =
        dl.mode === 'mailto'
          ? `📩 Nhận Link Drive (${b.sizeMB} MB)`
          : dl.mode === 'external'
            ? `☁️ Tải Qua Drive (${b.sizeMB} MB)`
            : `⬇ Tải Sách Miễn Phí (${b.sizeMB} MB)`;
      return `
        <article class="book-card">
          <div class="book-cover-wrap" data-book-action="open" data-book-id="${b.id}">
            <img src="${cover}" alt="${b.title}" loading="lazy" onerror="this.src='/assets/tools/pattern-placeholder.svg'" />
            <div class="card-badges-top">
              <span class="book-folder-badge">📁 ${b.folderKey}</span>
              <span class="free-badge">${dl.mode === 'mailto' ? '☁️ DRIVE FREE' : '🎁 FREE ' + (b.format || 'PDF')}</span>
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
              <a href="${btnHref}" class="btn-sm btn-add" style="width:100%; text-align:center; text-decoration:none; background:${btnBg};" ${btnAttrs}>
                ${btnLabel}
              </a>
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
  const activeBookDl = book
    ? resolveDownloadAction({
        url: book.downloadUrl,
        externalUrl: book.externalUrl,
        sizeMB: book.sizeMB,
        itemLabel: `${book.id} - ${book.title}`
      })
    : null;

  content.innerHTML = `
    <div style="text-align:center; margin-bottom:16px;">
      <span class="free-badge" style="background:var(--accent-green); font-size:12.5px; padding:5px 12px;">
        🎁 THƯ VIỆN SÁCH &amp; GIÁO TRÌNH ĐỒ DA CỘNG ĐỒNG MIỄN PHÍ
      </span>
      <h2 style="margin:10px 0 6px; color:var(--bg-saddle);">
        ${book ? book.title : 'Trọn Bộ 26 Sách & Giáo Trình Đồ Da Miễn Phí'}
      </h2>
      <p style="font-size:13.5px; color:var(--text-muted);">
        Tải trực tiếp miễn phí 100% toàn bộ 3 thư mục tài liệu: <code>Ebook</code>, <code>Bộ sách nhật</code> và <code>Ebook China</code> dành cho cộng đồng thợ da Việt Nam.
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

    <div style="background:#f0fdf4; border:1.5px solid #16a34a; border-radius:12px; padding:16px;">
      <strong style="color:#166534; display:block; margin-bottom:10px;">
        ✅ Thư viện mở 100% — Các file &le; 24 MB tải ngay; file dung lượng lớn nhận link Google Drive qua Email info@rapmau.com:
      </strong>
      ${
        book && activeBookDl
          ? `<a href="${activeBookDl.mode === 'direct' ? activeBookDl.href + '?download=1' : activeBookDl.href}" class="btn btn-primary btn-full" ${activeBookDl.mode === 'direct' ? 'download' : 'target="_blank" rel="noopener"'} style="margin-bottom:12px; ${activeBookDl.mode === 'mailto' ? 'background:#0284c7; border-color:#0284c7;' : ''}">
               ${activeBookDl.mode === 'mailto' ? `📩 Nhận Link Google Drive (${book.sizeMB} MB): ${book.title}` : `⬇ Tải Ngay: ${book.title} (${book.sizeMB} MB)`}
             </a>`
          : ''
      }
      <div style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; border-top:1px dashed #86efac; padding-top:10px;">
        ${state.freeBooks
          .map((fb) => {
            const fbDl = resolveDownloadAction({
              url: fb.downloadUrl,
              externalUrl: fb.externalUrl,
              sizeMB: fb.sizeMB,
              itemLabel: `${fb.id} - ${fb.title}`
            });
            const fbHref = fbDl.mode === 'direct' ? `${fbDl.href}?download=1` : fbDl.href;
            const fbAttrs = fbDl.mode === 'direct' ? 'download' : 'target="_blank" rel="noopener"';
            const fbColor = fbDl.mode === 'mailto' ? '#0284c7' : 'var(--accent-green)';
            const fbIcon = fbDl.mode === 'mailto' ? '📩 Drive' : '⬇';
            return `
          <a href="${fbHref}" ${fbAttrs} style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; background:#fff; border-radius:8px; border:1px solid #bbf7d0; text-decoration:none; color:var(--text-main); font-size:13px;">
            <span><strong>[${fb.folderKey}]</strong> ${fb.title}</span>
            <span style="color:${fbColor}; font-weight:800; white-space:nowrap; margin-left:8px;">${fbIcon} ${fb.sizeMB} MB</span>
          </a>
        `;
          })
          .join('')}
      </div>
    </div>
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
  const allTab = document.querySelector('#toolsFilterTabs .tool-tab[data-toolcat="all"]');
  if (allTab) {
    allTab.textContent = `Tất cả (${state.accessories.length})`;
  }
  const list = state.accessories.filter((item) => {
    if (state.selectedToolCat === 'all') return true;
    if (state.selectedToolCat === 'Da Thuộc & Hoá Chất') {
      return item.category.includes('Da Thuộc') || item.category.includes('Hoá Chất');
    }
    if (state.selectedToolCat === 'Dụng Cụ & Máy Móc') {
      return item.category.includes('Máy Móc') || item.category.includes('Cắt Rập');
    }
    if (state.selectedToolCat === 'Dụng Cụ Đục & Khâu') {
      return item.category.includes('Đục') || item.category.includes('Kim Chỉ');
    }
    if (state.selectedToolCat === 'Phụ Kiện Kim Loại') {
      return item.category.includes('Phụ Kiện');
    }
    return item.category === state.selectedToolCat;
  });

  const visibleTools = list.slice(0, state.visibleToolsCount);
  const loadMoreToolsWrap = document.getElementById('loadMoreToolsWrap');
  const loadMoreToolsBtn = document.getElementById('loadMoreToolsBtn');
  if (loadMoreToolsWrap && loadMoreToolsBtn) {
    if (list.length > state.visibleToolsCount) {
      loadMoreToolsWrap.classList.remove('hidden');
      loadMoreToolsBtn.textContent = `🛠️ Xem tất cả ${list.length} Dụng cụ, Da thuộc & Phụ kiện (+${list.length - state.visibleToolsCount} món)`;
    } else if (list.length > 8) {
      loadMoreToolsWrap.classList.remove('hidden');
      loadMoreToolsBtn.textContent = '🛠️ Thu gọn danh sách dụng cụ (hiện 8 món tiêu biểu)';
    } else {
      loadMoreToolsWrap.classList.add('hidden');
    }
  }

  grid.innerHTML = visibleTools
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
            <div class="tool-affiliate-links" style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-soft); display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Mua qua sàn TMĐT:</span>
              <div style="display: flex; gap: 6px; align-items: center;">
                <a
                  href="${item.shopeeUrl || 'https://shopee.vn/dathungleather'}"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Mua ${item.title} trên Shopee"
                  style="display:inline-flex; align-items:center; gap:4px; background:#ee4d2d; color:#fff; font-size:11px; font-weight:700; padding:4px 8px; border-radius:4px; text-decoration:none; transition:opacity .15s;"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z"/></svg>
                  <span>Shopee</span>
                </a>
                <a
                  href="${item.tiktokUrl || 'https://www.tiktok.com/@rapmau.com'}"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Xem video và mua trên TikTok Shop"
                  style="display:inline-flex; align-items:center; gap:4px; background:#000000; color:#fff; font-size:11px; font-weight:700; padding:4px 8px; border-radius:4px; text-decoration:none; transition:opacity .15s;"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.34 0 .66.06.96.17v-3.55a6.37 6.37 0 00-.96-.08A6.34 6.34 0 003 15.28a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.06a8.16 8.16 0 004.91 1.63v-3.5a4.86 4.86 0 01-1-.5z"/></svg>
                  <span>TikTok</span>
                </a>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function closeProductModal({ restoreUrl = true } = {}) {
  const backdrop = document.getElementById('productModalBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
  if (restoreUrl) {
    syncCategorySeoAndUrl(state.selectedCategory, { pushUrl: true });
  }
}

function openProductModal(sku, preferredVariantId, { pushUrl = true, showAllThumbs = false } = {}) {
  const product = state.products.find((p) => p.sku === sku);
  if (!product) return;

  const activeVar = getEffectiveVariant(product, preferredVariantId);
  const backdrop = document.getElementById('productModalBackdrop');
  const content = document.getElementById('productModalContent');

  // Cập nhật URL & SEO + Schema.org Product/Offer cho sản phẩm đang mở
  const targetProdPath = `/rap-mau/${product.slug}`;
  if (pushUrl && window.location.pathname !== targetProdPath) {
    window.history.pushState({ type: 'product', sku: product.sku }, '', targetProdPath);
  }
  setDocumentMeta({
    title: `${product.title} — PDF/DXF, Rập Giấy, Rập Mica, Khuôn Bế | RAPMAU.COM`,
    description: `Mua hoặc tải ${product.title} chuẩn tỷ lệ 1:1 (Khổ ${product.paperSizes.join('/')}, Đục ${product.chiselPitch}, Da ${product.leatherThickness}). Đủ 4 biến thể: File PDF/DXF, Rập Giấy 350gsm, Rập Mica 2mm & Khuôn Bế Thép.`,
    canonical: `https://www.rapmau.com${targetProdPath}`,
    h1Text: product.title,
    jsonLd: buildProductJsonLd(product)
  });

  // Danh sách ảnh + ảnh bản vẽ CAD trích xuất từ PDF (nếu có)
  const galleryImages = [...product.images];
  if (product.cadPreview && !galleryImages.includes(product.cadPreview)) {
    galleryImages.push(product.cadPreview);
  }

  const MAX_VISIBLE_THUMBS = 6;
  const hasMoreThumbs = !showAllThumbs && galleryImages.length > MAX_VISIBLE_THUMBS;
  const visibleThumbs = hasMoreThumbs ? galleryImages.slice(0, MAX_VISIBLE_THUMBS - 1) : galleryImages;
  const hiddenCount = galleryImages.length - visibleThumbs.length;

  const matchingTools = state.accessories.filter((a) => product.recommendedTools.includes(a.id));
  const firstPdfUrl = product.pdfFiles[0] ? encodeURI(product.pdfFiles[0]) : '';
  const isFreePdf = activeVar.id === 'pdf_dxf' && activeVar.price === 0;
  let currentImgIdx = 0;

  content.innerHTML = `
    <div class="detail-grid">
      <!-- CỘT 1 (TRÊN MOBILE LÀ PHẦN ĐẦU TIÊN): 1. KHUNG ẢNH CHÍNH & THUMBNAIL GỌN GÀNG -->
      <div class="detail-media-col">
        <div class="detail-media-stage" id="detailMediaDisplay">
          <img
            src="${encodeURI(galleryImages[0])}"
            alt="${product.title}"
            class="detail-main-img"
            id="detailMainImage"
            onerror="this.src='/assets/tools/pattern-placeholder.svg'"
          />
          ${
            galleryImages.length > 1
              ? `
            <button type="button" class="stage-nav-btn stage-prev" id="stagePrevBtn" aria-label="Ảnh trước">‹</button>
            <button type="button" class="stage-nav-btn stage-next" id="stageNextBtn" aria-label="Ảnh tiếp">›</button>
            <span class="stage-counter" id="stageCounterBadge">1 / ${galleryImages.length}</span>
          `
              : ''
          }
          ${
            firstPdfUrl
              ? `<button type="button" class="stage-pdf-btn" id="togglePdfPreviewBtn" data-pdf="${firstPdfUrl}">
                  📐 Xem Bản Vẽ PDF 1:1
                 </button>`
              : ''
          }
        </div>

        <div class="detail-thumbs-grid">
          ${visibleThumbs
            .map(
              (img, idx) => `
            <button type="button" class="detail-thumb-btn ${idx === 0 ? 'active' : ''}" data-idx="${idx}" data-img="${encodeURI(img)}">
              <img src="${encodeURI(img)}" alt="${product.sku} - Ảnh ${idx + 1}" loading="lazy" />
            </button>
          `
            )
            .join('')}
          ${
            hasMoreThumbs
              ? `<button type="button" class="detail-thumb-more" id="expandAllThumbsBtn" title="Xem toàn bộ ${galleryImages.length} ảnh">
                  +${hiddenCount} ảnh
                 </button>`
              : ''
          }
        </div>
      </div>

      <!-- CỘT 2 (NGAY DƯỚI ẢNH TRÊN MOBILE): 2. TÊN -> 3. GIÁ -> 4. BIẾN THỂ -> 5. NÚT MUA -> 6. THÔNG SỐ -->
      <div class="detail-info-col">
        <div class="detail-meta-badges">
          <span class="sku-badge">${product.sku}</span>
          <a href="/danh-muc/${product.categorySlug}" class="size-badge detail-cat-link" data-cat-link="${product.categoryKey}">${product.categoryName}</a>
          <span class="size-badge">Khổ ${product.paperSizes.join('/')}</span>
        </div>

        <h2 class="detail-title">${product.title}</h2>

        <div class="detail-price-box">
          <div style="font-size:12px; color:var(--text-muted); font-weight:700;">GIÁ BIẾN THỂ ĐANG CHỌN (${activeVar.shortLabel.toUpperCase()}):</div>
          <div style="display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin-top:4px;">
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

        <div class="detail-cta-row">
          <button
            type="button"
            class="btn btn-primary detail-buy-btn"
            data-action="add-cart-modal"
            data-sku="${product.sku}"
            data-var="${activeVar.id}"
          >
            ${isFreePdf ? '⬇ Tải File PDF Miễn Phí Ngay' : `🛒 Đặt Mua ${activeVar.shortLabel} Ngay`}
          </button>
          <button
            type="button"
            class="btn btn-secondary detail-ask-btn"
            id="modalAskThisSkuBtn"
            data-sku="${product.sku}"
          >
            💬 Hỏi mẫu / Đặt riêng
          </button>
        </div>

        <!-- Khung cam kết niềm tin & quyền thương mại ngay dưới nút mua -->
        <div class="detail-trust-box">
          <div>✅ <strong>Quyền thương mại:</strong> Được phép sản xuất &amp; bán thương mại sản phẩm đồ da hoàn thiện.</div>
          <div>🔄 <strong>Bảo hành chuẩn 1:1:</strong> Hỗ trợ kiểm tra, gửi lại file chuẩn 1:1 qua Email info@rapmau.com nếu có sai lệch tỷ lệ.</div>
          <div>🚚 <strong>Giao hàng toàn quốc:</strong> Được kiểm tra Rập Giấy 350gsm / Rập Mica 2mm trước khi thanh toán.</div>
        </div>

        <table class="specs-table">
          <tbody>
            <tr>
              <td>Mã sản phẩm (SKU)</td>
              <td><strong>${product.sku}</strong> — Danh mục: <strong>${product.categoryShort}</strong></td>
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
              <td>Bản vẽ trong bộ (${product.pdfCount})</td>
              <td><code>${product.pdfFileNames.join('</code>, <code>') || `${product.sku}-Ban-Ve-Rap-1-1.pdf`}</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 7. PHỤ KIỆN & DỤNG CỤ BÁN KÈM (ĐẶT Ở CUỐI CÙNG ĐỂ KHÔNG ĐẨY NÚT MUA XUỐNG DƯỚI) -->
      <div class="detail-cross-sell-bottom">
        <div class="cross-sell-box">
          <strong style="font-size:14px; color:var(--bg-saddle); display:block; margin-bottom:8px;">
            🛠️ Phụ Kiện &amp; Dụng Cụ Cơ Bản Khuyên Dùng Cho Mẫu ${product.sku}:
          </strong>
          <div class="cross-sell-grid">
            ${matchingTools
              .map(
                (t) => `
              <div class="cross-sell-item">
                <div style="flex:1; min-width:0;">
                  <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.title}</strong>
                  <div style="font-size:12px; color:var(--accent-leather); font-weight:700;">${formatVND(t.price)}</div>
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                  <a href="${t.shopeeUrl || 'https://shopee.vn/dathungleather'}" target="_blank" rel="noopener noreferrer" style="background:#ee4d2d; color:#fff; font-size:11px; font-weight:700; padding:4px 8px; border-radius:4px; text-decoration:none; display:inline-flex; align-items:center; gap:2px;" title="Mua trên Shopee">Shopee</a>
                  <button type="button" class="btn-sm btn-detail" data-action="add-tool" data-id="${t.id}">
                    + Mua kèm
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  backdrop.classList.remove('hidden');

  const updateStageImage = (newIdx) => {
    currentImgIdx = (newIdx + galleryImages.length) % galleryImages.length;
    const mainImg = document.getElementById('detailMainImage');
    if (mainImg) {
      mainImg.src = encodeURI(galleryImages[currentImgIdx]);
    }
    const counter = document.getElementById('stageCounterBadge');
    if (counter) {
      counter.textContent = `${currentImgIdx + 1} / ${galleryImages.length}`;
    }
    content.querySelectorAll('.detail-thumb-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.idx) === currentImgIdx);
    });
  };

  // Gắn sự kiện đổi ảnh thumbnail trong modal
  content.querySelectorAll('.detail-thumb-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateStageImage(Number(btn.dataset.idx));
    });
  });

  const prevBtn = document.getElementById('stagePrevBtn');
  if (prevBtn) prevBtn.onclick = () => updateStageImage(currentImgIdx - 1);
  const nextBtn = document.getElementById('stageNextBtn');
  if (nextBtn) nextBtn.onclick = () => updateStageImage(currentImgIdx + 1);

  const expandBtn = document.getElementById('expandAllThumbsBtn');
  if (expandBtn) {
    expandBtn.onclick = () => openProductModal(product.sku, activeVar.id, { pushUrl: false, showAllThumbs: true });
  }

  // Xem trực tiếp file PDF bản vẽ 1:1 ngay trong modal
  const pdfBtn = document.getElementById('togglePdfPreviewBtn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      const display = document.getElementById('detailMediaDisplay');
      display.innerHTML = `<iframe src="${pdfBtn.dataset.pdf}" class="pdf-preview-frame" title="Bản vẽ PDF ${product.sku}"></iframe>`;
    });
  }

  // Bấm vào huy hiệu danh mục trong modal
  content.querySelectorAll('[data-cat-link]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      state.selectedCategory = link.dataset.catLink;
      closeProductModal({ restoreUrl: true });
      renderCategoryPills();
      renderProducts();
    });
  });

  // Đổi biến thể trong modal
  content.querySelectorAll('.detail-variant-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      state.cardVariantOverrides[product.id] = opt.dataset.modalVar;
      openProductModal(product.sku, opt.dataset.modalVar, { pushUrl: false, showAllThumbs });
      renderProducts();
    });
  });

  // Nút hỏi mẫu riêng cho SKU này
  const askSkuBtn = document.getElementById('modalAskThisSkuBtn');
  if (askSkuBtn) {
    askSkuBtn.addEventListener('click', () => {
      closeProductModal({ restoreUrl: true });
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
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:16px;">
          <button type="button" class="btn btn-primary btn-full" data-action="add-tool" data-id="${tool.id}">
            🛒 Đặt Mua Trực Tiếp Tại Xưởng RAPMAU (${formatVND(tool.price)})
          </button>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <a
              href="${tool.shopeeUrl || 'https://shopee.vn/dathungleather'}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn"
              style="background:#ee4d2d; color:#fff; font-weight:700; text-align:center; padding:10px; border-radius:8px; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:6px; font-size:13.5px;"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z"/></svg>
              <span>Mua trên Shopee</span>
            </a>
            <a
              href="${tool.tiktokUrl || 'https://www.tiktok.com/@rapmau.com'}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn"
              style="background:#000000; color:#fff; font-weight:700; text-align:center; padding:10px; border-radius:8px; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:6px; font-size:13.5px;"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.34 0 .66.06.96.17v-3.55a6.37 6.37 0 00-.96-.08A6.34 6.34 0 003 15.28a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.06a8.16 8.16 0 004.91 1.63v-3.5a4.86 4.86 0 01-1-.5z"/></svg>
              <span>Mua trên TikTok</span>
            </a>
          </div>
          <p style="font-size:12px; color:var(--text-muted); text-align:center; margin:0;">
            ✓ Miễn phí vận chuyển khi áp mã Shopee/TikTok &bull; Hỗ trợ đổi trả 7 ngày
          </p>
        </div>
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
  if (variant.id === 'pdf_dxf' && variant.price === 0) {
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
      vendorId: product.vendorId || 'rapmau',
      vendorName: product.vendorName || 'Xưởng RAPMAU.COM',
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
      vendorId: tool.vendorId || 'rapmau',
      vendorName: tool.vendorName || 'Xưởng RAPMAU.COM',
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

  const pdfList = product.pdfFiles || [];
  const cadList = product.cadFiles || [];
  const fallbackImages = pdfList.length === 0 && cadList.length === 0 ? product.images || [] : [];

  content.innerHTML = `
    <div style="text-align:center; padding: 12px;">
      <span class="free-badge" style="font-size:13px; padding:5px 12px;">🎁 RẬP PDF MIỄN PHÍ 0Đ TỪ WWW.RAPMAU.COM</span>
      <h2 style="margin:12px 0 6px; color:var(--bg-saddle);">${product.title}</h2>
      <p style="font-size:14px; color:var(--text-muted); margin-bottom:18px;">
        Bản vẽ chuẩn tỷ lệ 1:1 (Khổ ${product.paperSizes.join('/')}). Hãy chọn chế độ in <strong>Actual Size / 100%</strong> khi in ra giấy.
      </p>

      <div style="background:var(--bg-parchment); padding:16px; border-radius:12px; border:1px dashed var(--border-stitch); margin-bottom:20px;">
        <strong style="display:block; margin-bottom:10px;">Danh sách file tải xuống trực tiếp (Miễn phí 0đ):</strong>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${pdfList
            .map(
              (url, idx) => {
                const cleanName = product.pdfFileNames[idx] || `${product.sku}-Ban-Ve-Rap-1-1-${idx + 1}.pdf`;
                const dl = resolveDownloadAction({
                  url,
                  externalUrl: product.externalUrl,
                  sizeMB: product.fileSizeMB,
                  itemLabel: `${product.sku} - ${cleanName}`
                });
                const labelSize = dl.sizeLabel ? ` (${dl.sizeLabel})` : '';
                if (dl.mode === 'mailto') {
                  return `
            <a
              href="${dl.href}"
              class="btn btn-primary"
              style="background:#0284c7; border-color:#0284c7;"
              target="_blank"
              rel="noopener"
            >
              📩 Nhận Link Google Drive: ${cleanName}${labelSize}
            </a>
          `;
                }
                return `
            <a
              href="${dl.href}"
              class="btn btn-primary"
              ${dl.mode === 'direct' ? `download="${cleanName}"` : ''}
              target="_blank"
              rel="noopener"
            >
              ${dl.mode === 'external' ? '☁️ Tải Qua Drive' : '⬇ Tải File PDF'}: ${cleanName}${labelSize}
            </a>
          `;
              }
            )
            .join('')}
          ${cadList
            .map(
              (url, idx) => {
                const ext = url.split('.').pop() || 'dxf';
                const cleanCadName = `${product.sku}-Vector-CAD-${idx + 1}.${ext}`;
                const dl = resolveDownloadAction({
                  url,
                  externalUrl: product.externalUrl,
                  sizeMB: 0,
                  itemLabel: `${product.sku} - ${cleanCadName}`
                });
                return `
            <a
              href="${dl.href}"
              class="btn btn-secondary"
              ${dl.mode === 'direct' ? `download="${cleanCadName}"` : ''}
              target="_blank"
              rel="noopener"
            >
              ${dl.mode === 'mailto' ? `📩 Nhận Link Drive CAD: ${cleanCadName}` : `📐 Tải File CAD/Vector: ${cleanCadName}`}
            </a>
          `;
              }
            )
            .join('')}
          ${fallbackImages
            .map(
              (url, idx) => {
                const ext = url.split('.').pop() || 'jpg';
                const cleanImgName = `${product.sku}-Ban-Rap-1-1-Trang-${idx + 1}.${ext}`;
                return `
            <a
              href="${encodeURI(url)}"
              class="btn btn-primary"
              download="${cleanImgName}"
              target="_blank"
              rel="noopener"
            >
              ⬇ Tải Bản Rập Chuẩn: ${cleanImgName}
            </a>
          `;
              }
            )
            .join('')}
        </div>
      </div>

      <div style="background:var(--bg-warm); padding:14px; border-radius:10px; text-align:left; font-size:13.5px; margin-bottom:18px;">
        <strong>💡 Bạn không tiện in hoặc muốn rập cắt sẵn bền đẹp?</strong>
        <p style="margin:4px 0 10px; color:var(--text-muted);">
          Đặt ngay <strong>Rập Giấy Cứng 350gsm</strong> hoặc <strong>Rập Mica 2mm Cắt Laser</strong> của mẫu ${product.sku} để áp lên da cắt ngay không cần dán ghép giấy:
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn-sm btn-add" id="upsellPaperBtn">+ Đặt Rập Giấy (${formatVND(product.variants[1]?.price || 55000)})</button>
          ${product.variants[2] ? `<button type="button" class="btn-sm btn-add" id="upsellMicaBtn">+ Đặt Rập Mica 2mm (${formatVND(product.variants[2].price)})</button>` : ''}
        </div>
      </div>

      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:12px 14px; font-size:12.5px; color:#475569; text-align:left;">
        💬 Trải nghiệm cắt may xong mẫu rập này, bạn có thể chia sẻ ảnh thành phẩm tại <a href="/cong-dong/" style="color:var(--accent-leather); font-weight:700;">Diễn Đàn Nghề Da</a> hoặc gửi Email <a href="mailto:info@rapmau.com" style="color:var(--accent-leather); font-weight:700;">info@rapmau.com</a> nếu cần tìm xưởng gia công / khuôn bế theo mẫu.
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
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding:8px 0; border-bottom:1px dashed var(--border-soft);">
          <div style="flex:1 1 180px;">
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
          <label>Email hoặc thông tin liên hệ lại *</label>
          <input type="text" id="chkPhone" required placeholder="Nhập Email hoặc thông tin liên hệ..." />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Email nhận link tải dự phòng (Nếu tải PDF/DXF)</label>
          <input type="email" id="chkEmail" placeholder="email@domain.com" />
        </div>
        <div class="form-field">
          <label>Phương thức xử lý</label>
          <select id="chkMethod">
            <option value="email_b2b">Kết nối qua Email info@rapmau.com (Tải file ngay &amp; nhận báo giá gia công)</option>
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
  const digitalItems = orderedItems.filter((i) => i.deliveryType === 'digital' && i.pdfFiles?.length > 0);
  const mailSubject = encodeURIComponent(`[ĐƠN ĐẶT GIA CÔNG #${order.orderCode}] ${order.customer.name}`);
  const mailBody = encodeURIComponent(
    `Mã yêu cầu: ${order.orderCode}\nKhách hàng: ${order.customer.name}\nLiên hệ: ${order.customer.phone}\nTổng dự kiến: ${formatVND(order.totalAmount)}\nSản phẩm:\n${orderedItems.map((i) => `- [${i.sku}] ${i.title} (${i.variantName}) x${i.qty}`).join('\n')}`
  );

  content.innerHTML = `
    <div style="text-align:center;">
      <span class="free-badge" style="font-size:13px; padding:5px 12px;">🎉 ĐÃ GHI NHẬN YÊU CẦU • MÃ: ${order.orderCode}</span>
      <h2 style="margin:10px 0 6px; color:var(--bg-saddle);">Cảm ơn ${order.customer.name} đã gửi yêu cầu tại www.rapmau.com!</h2>
      <p style="font-size:13.5px; color:var(--text-muted);">
        Thông tin đã được lưu. Các bản vẽ PDF/DXF (nếu có) sẵn sàng tải ngay bên dưới; yêu cầu gia công vật lý vui lòng xác nhận qua Email <strong>info@rapmau.com</strong>.
      </p>
    </div>

    ${
      order.totalAmount > 0
        ? `
      <div class="vietqr-box" style="justify-content:center; text-align:center; padding:16px;">
        <div>
          <span class="sku-badge">KẾT NỐI XỬ LÝ QUA EMAIL</span>
          <h4 style="margin:8px 0 6px; color:var(--bg-saddle);">Xác Nhận Báo Giá Gia Công / Dụng Cụ</h4>
          <p style="font-size:13.5px; margin-bottom:10px;">
            Tổng giá trị dự kiến: <strong style="color:var(--accent-leather); font-size:17px;">${formatVND(order.totalAmount)}</strong> • Mã tham chiếu: <strong style="background:#fef3c7; padding:2px 6px; border-radius:4px;">${order.orderCode}</strong>
          </p>
          <a href="mailto:info@rapmau.com?subject=${mailSubject}&body=${mailBody}" class="btn btn-primary btn-sm">
            ✉️ Gửi Chi Tiết Mã #${order.orderCode} Về info@rapmau.com
          </a>
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
          <label>Link Cộng Đồng / Ghi chú nhóm (Không bắt buộc)</label>
          <input type="text" id="admZaloGroupUrl" value="${site.zaloGroupUrl || 'mailto:info@rapmau.com'}" />
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
      zaloGroupUrl: document.getElementById('admZaloGroupUrl')?.value.trim() || 'mailto:info@rapmau.com',
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

function renderArticles() {
  const grid = document.getElementById('articlesGrid');
  if (!grid) return;

  const list = state.articles.filter((art) => {
    if (state.selectedArticleCat === 'all') return true;
    if (state.selectedArticleCat === 'Hướng Dẫn Thực Hành') {
      return art.category === 'Hướng Dẫn Thực Hành' || art.category === 'Hoàn Thiện & Bảo Dưỡng';
    }
    return art.category === state.selectedArticleCat;
  });

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; padding:24px; text-align:center; color:#64748b;">Chưa có bài viết trong chuyên mục này.</div>`;
    return;
  }

  const visibleArts = list.slice(0, state.visibleArticlesCount);
  const loadMoreArtWrap = document.getElementById('loadMoreArticlesWrap');
  const loadMoreArtBtn = document.getElementById('loadMoreArticlesBtn');
  if (loadMoreArtWrap && loadMoreArtBtn) {
    if (list.length > state.visibleArticlesCount) {
      loadMoreArtWrap.classList.remove('hidden');
      loadMoreArtBtn.textContent = `📰 Xem tất cả ${list.length} bài viết kỹ thuật & bảng thông số (+${list.length - state.visibleArticlesCount} bài)`;
    } else if (list.length > 4) {
      loadMoreArtWrap.classList.remove('hidden');
      loadMoreArtBtn.textContent = '📰 Thu gọn bài viết (hiện 4 bài nổi bật)';
    } else {
      loadMoreArtWrap.classList.add('hidden');
    }
  }

  grid.innerHTML = visibleArts
    .map((art) => {
      const faqCount = (art.faqs?.length || 0) + (art.aeoQuestion ? 1 : 0);
      return `
        <article class="article-card" itemscope itemtype="https://schema.org/Article">
          <div>
            <div class="art-card-top">
              <span class="art-cat-badge" itemprop="articleSection">${art.category || 'Cẩm Nang Đồ Da'}</span>
              <span class="art-read-time">⏱️ ${art.readTime || '6 phút đọc'}</span>
            </div>
            <h3 class="art-card-title" itemprop="headline">
              <a href="/bai-viet/${art.slug}" data-art-slug="${art.slug}" onclick="event.preventDefault();">${art.title}</a>
            </h3>
            <div class="art-aeo-snippet" itemprop="abstract">
              <strong>💡 Tóm tắt nhanh (AEO):</strong>
              ${art.aeoAnswer || art.excerpt || ''}
            </div>
          </div>
          <div class="art-card-footer">
            <span class="art-faq-count">✅ ${faqCount} câu hỏi giải đáp</span>
            <a href="/bai-viet/${art.slug}" class="btn btn-primary btn-sm" data-art-slug="${art.slug}" onclick="event.preventDefault();">
              Đọc chi tiết →
            </a>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderGlobalFaqs() {
  const container = document.getElementById('globalFaqList');
  if (!container) return;

  const allFaqs = [];
  for (const art of state.articles) {
    if (art.aeoQuestion && art.aeoAnswer) {
      allFaqs.push({
        q: art.aeoQuestion,
        a: art.aeoAnswer,
        slug: art.slug,
        title: art.title
      });
    }
    if (Array.isArray(art.faqs)) {
      for (const f of art.faqs.slice(0, 1)) {
        allFaqs.push({
          q: f.q,
          a: f.a,
          slug: art.slug,
          title: art.title
        });
      }
    }
  }

  const toggleFaqsBtn = document.getElementById('toggleAllFaqsBtn');
  if (toggleFaqsBtn) {
    toggleFaqsBtn.textContent = state.showAllFaqs
      ? 'Thu gọn câu hỏi (hiện 4 câu)'
      : `Xem tất cả ${allFaqs.length} câu hỏi thường gặp`;
  }

  container.innerHTML = allFaqs
    .slice(0, state.showAllFaqs ? 20 : 4)
    .map(
      (item, idx) => `
      <details class="aeo-faq-item" ${idx === 0 ? 'open' : ''} itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
        <summary itemprop="name">${item.q}</summary>
        <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
          <p itemprop="text">
            ${item.a}
            <br />
            <a href="/bai-viet/${item.slug}" data-art-slug="${item.slug}" onclick="event.preventDefault();" style="display:inline-block; margin-top:6px; font-weight:800; color:var(--accent-leather); font-size:12px;">
              📖 Xem bài phân tích &amp; bảng thông số đầy đủ →
            </a>
          </p>
        </div>
      </details>
    `
    )
    .join('');
}

function openArticleModal(slug, { pushUrl = true } = {}) {
  const art = state.articles.find((a) => a.slug === slug || a.id === slug);
  if (!art) return;

  const targetPath = `/bai-viet/${art.slug}`;
  if (pushUrl && window.location.pathname !== targetPath) {
    window.history.pushState({ type: 'article', slug: art.slug }, '', targetPath);
  }

  setDocumentMeta({
    title: `${art.title} | Cẩm Nang Đồ Da RAPMAU.COM`,
    description: art.excerpt || art.aeoAnswer,
    canonical: `https://www.rapmau.com${targetPath}`,
    h1Text: art.title,
    jsonLd: buildArticleJsonLd(art)
  });

  const relatedTools = (art.relatedToolSkus || [])
    .map((sku) => state.accessories.find((t) => t.id === sku))
    .filter(Boolean);

  const takeawaysHtml =
    Array.isArray(art.keyTakeaways) && art.keyTakeaways.length > 0
      ? `
        <div class="article-takeaways-box">
          <h4>📌 Điểm Cốt Lõi Cần Nhớ (Key Takeaways)</h4>
          <ul>
            ${art.keyTakeaways.map((k) => `<li>${k}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

  const faqsHtml =
    Array.isArray(art.faqs) && art.faqs.length > 0
      ? `
        <div style="margin-top:22px; padding-top:16px; border-top:2px solid var(--border-soft);">
          <h2 style="font-size:18px; color:var(--bg-saddle); margin-bottom:12px;">❓ Câu Hỏi Thường Gặp Về Chủ Đề Này (FAQ)</h2>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${art.faqs
              .map(
                (f) => `
              <details class="aeo-faq-item" open>
                <summary>${f.q}</summary>
                <p>${f.a}</p>
              </details>
            `
              )
              .join('')}
          </div>
        </div>
      `
      : '';

  const relatedToolsHtml =
    relatedTools.length > 0
      ? `
        <div class="detail-cross-sell-bottom" style="margin-top:22px;">
          <div class="cross-sell-header">
            <strong>🛠️ Dụng Cụ &amp; Nguyên Liệu Liên Quan Trong Bài Viết</strong>
            <span>Đặt kèm để thực hành ngay tại nhà</span>
          </div>
          <div class="cross-sell-grid">
            ${relatedTools
              .map(
                (t) => `
              <div class="cross-sell-card">
                <div class="csc-info">
                  <strong>${t.name}</strong>
                  <span>${formatVND(t.price)} / ${t.unit || 'bộ'}</span>
                </div>
                <button type="button" class="btn btn-primary btn-sm" data-art-add-tool="${t.id}">+ Thêm giỏ</button>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
      : '';

  const contentEl = document.getElementById('articleModalContent');
  contentEl.innerHTML = `
    <article class="article-reader-wrap">
      <div class="article-reader-meta">
        <span class="art-cat-badge">${art.category || 'Cẩm Nang Đồ Da'}</span>
        <span>✍️ ${art.author || 'Kỹ Sư RAPMAU.COM'}</span>
        <span>📅 Cập nhật: ${art.updatedAt || '2026-11-10'}</span>
        <span>⏱️ ${art.readTime || '6 phút đọc'}</span>
      </div>

      <h1 class="article-reader-title">${art.title}</h1>

      ${
        art.aeoAnswer
          ? `
        <div class="aeo-direct-answer-box">
          <span class="aeo-label">⚡ Câu Trả Lời Trực Diện (Chuẩn Kỹ Thuật Xưởng)</span>
          ${art.aeoQuestion ? `<div class="aeo-q">Hỏi: ${art.aeoQuestion}</div>` : ''}
          <div class="aeo-a">${art.aeoAnswer}</div>
        </div>
      `
          : ''
      }

      ${takeawaysHtml}

      <div class="article-body-content">
        ${art.contentHtml || ''}
      </div>

      ${faqsHtml}
      ${relatedToolsHtml}

      <div style="margin-top:20px; display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center; background:#f8f4ec; padding:14px 16px; border-radius:12px; border:1px solid var(--border-soft);">
        <div>
          <strong style="color:var(--bg-saddle);">Cần kết nối xưởng gia công hoặc tải 258+ Rập PDF Miễn Phí?</strong>
          <div style="font-size:12.5px; color:var(--text-muted);">Gửi Email về info@rapmau.com hoặc trao đổi trực tiếp trên Diễn Đàn Nghề Da.</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a href="/danh-muc/${art.relatedCategorySlug || 'rap-vi-da'}" class="btn btn-primary btn-sm">📐 Xem Kho Rập Liên Quan</a>
          <a href="mailto:info@rapmau.com?subject=%5BH%E1%BB%8EI%20K%E1%BB%B8%20THU%E1%BA%ACT%5D%20Trao%20%C4%91%E1%BB%95i%20b%C3%A0i%20vi%E1%BA%BFt" class="btn btn-zalo btn-sm">✉️ Email: info@rapmau.com</a>
        </div>
      </div>
    </article>
  `;

  contentEl.querySelectorAll('[data-art-add-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      addToolToCart(btn.dataset.artAddTool);
    });
  });

  document.getElementById('articleModalBackdrop').classList.remove('hidden');
}

function closeArticleModal({ restoreUrl = true } = {}) {
  document.getElementById('articleModalBackdrop')?.classList.add('hidden');
  if (restoreUrl && window.location.pathname.startsWith('/bai-viet')) {
    syncCategorySeoAndUrl(state.selectedCategory, { pushUrl: true });
  }
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
  syncCategorySeoAndUrl('all', { pushUrl: true });
}

function setGlobalVariantMode(variantKey) {
  if (!VARIANT_LABELS[variantKey]) return;
  document.querySelectorAll('#globalVariantSelector .variant-mode-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.variant === variantKey);
  });
  document.querySelectorAll('#sidebarQuickCatalogHub .ws-hub-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.sidebarVariant === variantKey);
  });
  state.selectedVariantMode = variantKey;
  state.cardVariantOverrides = {};
  const labelEl = document.getElementById('currentVariantModeLabel');
  if (labelEl) labelEl.textContent = VARIANT_LABELS[state.selectedVariantMode];
  renderProducts();
}

function bindEvents() {
  // Chuyển đổi chế độ hiển thị giá 4 biến thể toàn cục ở Hero
  document.querySelectorAll('#globalVariantSelector .variant-mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      setGlobalVariantMode(card.dataset.variant);
    });
  });

  // Thanh công cụ chọn nhanh đầy đủ (Mẫu • Rập • Khuôn • Dụng cụ • Nguyên liệu • Sách) ở Sidebar
  const sidebarHub = document.getElementById('sidebarQuickCatalogHub');
  if (sidebarHub) {
    sidebarHub.addEventListener('click', (e) => {
      const btn = e.target.closest('button.ws-hub-btn');
      if (!btn) return;
      sidebarHub.querySelectorAll('.ws-hub-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (btn.dataset.sidebarVariant) {
        setGlobalVariantMode(btn.dataset.sidebarVariant);
        const ws = document.getElementById('ban-lam-viec');
        if (ws) ws.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (btn.dataset.sidebarTool) {
        const targetTab = document.querySelector(
          `#toolsFilterTabs .tool-tab[data-toolcat="${CSS.escape(btn.dataset.sidebarTool)}"]`
        );
        if (targetTab) {
          targetTab.click();
        }
        const toolsSec = document.getElementById('phu-kien-dung-cu');
        if (toolsSec) toolsSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (btn.dataset.sidebarSection) {
        const secId = btn.dataset.sidebarSection;
        if (secId === 'nhan-sach-mien-phi' && state.visibleBooksCount <= 4) {
          state.visibleBooksCount = 999;
          renderFreeBooks();
        }
        const targetSec = document.getElementById(secId);
        if (targetSec) targetSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Ô tìm nhanh ngay trong hộp 21 danh mục đồ da ở Sidebar
  const sidebarCatSearchInput = document.getElementById('sidebarCatSearchInput');
  if (sidebarCatSearchInput) {
    sidebarCatSearchInput.addEventListener('input', () => {
      renderCategoryPills();
    });
  }

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

  // Nút xem thêm / thu gọn Dụng cụ, Sách & Bài viết
  const loadMoreToolsBtn = document.getElementById('loadMoreToolsBtn');
  if (loadMoreToolsBtn) {
    loadMoreToolsBtn.addEventListener('click', () => {
      state.visibleToolsCount = state.visibleToolsCount <= 8 ? 999 : 8;
      renderTools();
    });
  }

  const loadMoreBooksBtn = document.getElementById('loadMoreBooksBtn');
  if (loadMoreBooksBtn) {
    loadMoreBooksBtn.addEventListener('click', () => {
      state.visibleBooksCount = state.visibleBooksCount <= 4 ? 999 : 4;
      renderFreeBooks();
    });
  }

  const loadMoreArticlesBtn = document.getElementById('loadMoreArticlesBtn');
  if (loadMoreArticlesBtn) {
    loadMoreArticlesBtn.addEventListener('click', () => {
      state.visibleArticlesCount = state.visibleArticlesCount <= 4 ? 999 : 4;
      renderArticles();
    });
  }

  const toggleAllFaqsBtn = document.getElementById('toggleAllFaqsBtn');
  if (toggleAllFaqsBtn) {
    toggleAllFaqsBtn.addEventListener('click', () => {
      state.showAllFaqs = !state.showAllFaqs;
      renderGlobalFaqs();
    });
  }

  // Tự động mở Accordion Chính sách khi người dùng bấm link neo (#thong-tin-xuong, #chinh-sach-...)
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', () => {
      const targetId = anchor.getAttribute('href').slice(1);
      if (!targetId) return;
      const targetEl = document.getElementById(targetId);
      if (targetEl && targetEl.tagName === 'DETAILS') {
        targetEl.open = true;
      }
    });
  });

  // Tab lọc Dụng cụ & Phụ kiện
  document.querySelectorAll('#toolsFilterTabs .tool-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#toolsFilterTabs .tool-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.selectedToolCat = tab.dataset.toolcat;
      state.visibleToolsCount = state.selectedToolCat === 'all' ? 8 : 999;
      renderTools();
    });
  });

  // Tab lọc Bài viết Cẩm nang SEO & AEO
  document.querySelectorAll('#articlesFilterTabs .tool-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#articlesFilterTabs .tool-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.selectedArticleCat = tab.dataset.artcat;
      state.visibleArticlesCount = state.selectedArticleCat === 'all' ? 4 : 999;
      renderArticles();
    });
  });

  const articlesGrid = document.getElementById('articlesGrid');
  if (articlesGrid) {
    articlesGrid.addEventListener('click', (e) => {
      const link = e.target.closest('[data-art-slug]');
      if (!link) return;
      e.preventDefault();
      openArticleModal(link.dataset.artSlug, { pushUrl: true });
    });
  }

  const globalFaqList = document.getElementById('globalFaqList');
  if (globalFaqList) {
    globalFaqList.addEventListener('click', (e) => {
      const link = e.target.closest('[data-art-slug]');
      if (!link) return;
      e.preventDefault();
      openArticleModal(link.dataset.artSlug, { pushUrl: true });
    });
  }

  // Tab lọc 3 thư mục Sách Miễn Phí (Ebook / Bộ sách nhật / Ebook China)
  document.querySelectorAll('#booksFolderTabs .book-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#booksFolderTabs .book-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.selectedBookFolder = tab.dataset.folder;
      state.visibleBooksCount = state.selectedBookFolder === 'all' ? 4 : 999;
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
  document.getElementById('closeProductModalBtn').onclick = () => closeProductModal({ restoreUrl: true });
  document.getElementById('productModalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'productModalBackdrop') closeProductModal({ restoreUrl: true });
  });
  document.getElementById('closeCartModalBtn').onclick = () =>
    document.getElementById('cartModalBackdrop').classList.add('hidden');
  document.getElementById('closeAdminModalBtn').onclick = () =>
    document.getElementById('adminModalBackdrop').classList.add('hidden');
  const closeArtBtn = document.getElementById('closeArticleModalBtn');
  if (closeArtBtn) closeArtBtn.onclick = () => closeArticleModal({ restoreUrl: true });
  const artBackdrop = document.getElementById('articleModalBackdrop');
  if (artBackdrop) {
    artBackdrop.addEventListener('click', (e) => {
      if (e.target.id === 'articleModalBackdrop') closeArticleModal({ restoreUrl: true });
    });
  }

  document.getElementById('openCartBtn').onclick = openCartModal;
  const openAdminBtn = document.getElementById('openAdminBtn');
  if (openAdminBtn) openAdminBtn.onclick = openAdminModal;

  const logoHomeLink = document.getElementById('logoHomeLink');
  if (logoHomeLink) {
    logoHomeLink.addEventListener('click', (e) => {
      e.preventDefault();
      resetAllFilters();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.addEventListener('popstate', () => {
    applyRouteFromLocation({ initial: false });
    renderCategoryPills();
    renderProducts();
  });

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
      syncCategorySeoAndUrl(state.selectedCategory, { pushUrl: true });
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
    let savedToServer = false;
    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.entry?.id) entryId = data.entry.id;
        savedToServer = true;
      }
    } catch {
      // Fallback trên bản Cloud Static
    }
    const mailHref = `mailto:info@rapmau.com?subject=${encodeURIComponent(`[YÊU CẦU #${entryId}] ${payload.needType}`)}&body=${encodeURIComponent(`Người gửi: ${payload.name}\nLiên hệ lại: ${payload.phone}\nMã tham khảo: ${payload.skuRef || '-'}\nNội dung: ${payload.message}`)}`;
    const fb = document.getElementById('consultFeedback');
    fb.innerHTML = savedToServer
      ? `✅ Đã ghi nhận yêu cầu <strong>#${entryId}</strong>! Hệ thống kết nối sẽ phản hồi qua Email <strong>info@rapmau.com</strong>. <a href="${mailHref}" style="color:#0369a1; font-weight:700; text-decoration:underline; margin-left:6px;">Bấm để gửi kèm ảnh qua Email →</a>`
      : `📩 Đã soạn sẵn yêu cầu <strong>#${entryId}</strong>! Bấm nút bên phải để hoàn tất gửi về Email <strong>info@rapmau.com</strong>: <a href="${mailHref}" style="display:inline-block; margin-left:8px; padding:4px 10px; background:#0284c7; color:#fff; border-radius:6px; font-weight:700; text-decoration:none;">✉️ Gửi Email Ngay →</a>`;
    fb.classList.remove('hidden');
    if (savedToServer) e.target.reset();
  });
}

initApp();
