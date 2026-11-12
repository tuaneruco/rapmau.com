(() => {
  'use strict';

  const STORAGE_KEY_THREADS = 'rapmau_community_custom_threads_v1';
  const STORAGE_KEY_COMMENTS = 'rapmau_community_custom_comments_v1';
  const STORAGE_KEY_LIKES = 'rapmau_community_likes_v1';
  const STORAGE_KEY_AUTHOR = 'rapmau_community_saved_author_v1';

  let categories = [];
  let threads = [];
  let activeCategory = 'all';
  let activeStage = 'all';
  let searchQuery = '';
  let likedThreadIds = new Set();

  const STAGE_FILTERS = [
    { id: 'all', name: 'Tất cả công đoạn' },
    { id: 'cat-dap', name: '1. Cắt & Dập Da' },
    { id: 'lang-keo-gap', name: '2. Lạng, Keo & Gấp Mép' },
    { id: 'in-ep-logo', name: '3. In, Khắc & Ép Logo' },
    { id: 'may-da', name: '4. Các Dòng Máy May Da' },
    { id: 'hoan-thien', name: '5. Sơn Cạnh & Hoàn Thiện' }
  ];

  try {
    const savedLikes = JSON.parse(localStorage.getItem(STORAGE_KEY_LIKES) || '[]');
    likedThreadIds = new Set(savedLikes);
  } catch {}

  const catFilterStrip = document.getElementById('catFilterStrip');
  const stageFilterStrip = document.getElementById('stageFilterStrip');
  const threadsListContainer = document.getElementById('threadsListContainer');
  const resultCountLabel = document.getElementById('resultCountLabel');
  const threadSearchInput = document.getElementById('threadSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  // Modal elements
  const postModal = document.getElementById('postModal');
  const openNewPostModalBtn = document.getElementById('openNewPostModalBtn');
  const heroOpenModalBtn = document.getElementById('heroOpenModalBtn');
  const floatingAskBtn = document.getElementById('floatingAskBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelPostBtn = document.getElementById('cancelPostBtn');
  const newPostForm = document.getElementById('newPostForm');
  const postTitle = document.getElementById('postTitle');
  const postAuthor = document.getElementById('postAuthor');
  const postCategory = document.getElementById('postCategory');
  const postContent = document.getElementById('postContent');

  // Pre-fill saved author name
  const savedAuthor = localStorage.getItem(STORAGE_KEY_AUTHOR);
  if (savedAuthor && postAuthor) postAuthor.value = savedAuthor;

  // Initialize
  async function init() {
    setupEventListeners();
    await loadData();
    renderCategories();
    renderStageFilters();
    renderThreads();
  }

  async function loadData() {
    let remoteData = null;
    try {
      const res = await fetch('/api/community/threads');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          remoteData = json.data;
        }
      }
    } catch {}

    if (!remoteData) {
      try {
        const res = await fetch('/data/community.json');
        if (res.ok) {
          remoteData = await res.json();
        }
      } catch {}
    }

    if (remoteData) {
      categories = remoteData.categories || [];
      threads = remoteData.threads || [];
    } else {
      categories = [
        { id: 'all', name: 'Tất Cả Thảo Luận', icon: '💬', count: 0 },
        { id: 'nhap-mon', name: 'Người Mới Nhập Môn', icon: '🔨', count: 0 },
        { id: 'setup-xuong', name: 'Setup & Bố Trí Xưởng', icon: '🏗️', count: 0 },
        { id: 'ky-thuat-may', name: 'Kỹ Thuật May & Đục', icon: '🧵', count: 0 },
        { id: 'may-moc-xuong', name: 'Máy Móc & Sửa Chữa Xưởng', icon: '⚙️', count: 0 },
        { id: 'son-canh', name: 'Sơn Viền & Xử Lý Cạnh', icon: '🎨', count: 0 },
        { id: 'rap-mau', name: 'Xin & Góp Ý Rập Mẫu', icon: '📐', count: 0 },
        { id: 'da-keo', name: 'Da Thuộc & Phụ Liệu', icon: '🐂', count: 0 },
        { id: 'khoe-tac-pham', name: 'Khoe Tác Phẩm & Bắt Bệnh', icon: '🏆', count: 0 },
        { id: 'cho-do-da', name: 'Chợ Dụng Cụ & Da Vụn', icon: '🏷️', count: 0 }
      ];
      threads = [];
    }

    // Merge any client-local stored threads
    try {
      const localThreads = JSON.parse(localStorage.getItem(STORAGE_KEY_THREADS) || '[]');
      if (Array.isArray(localThreads) && localThreads.length) {
        for (const lt of localThreads) {
          if (!threads.some((t) => t.id === lt.id)) {
            threads.unshift(lt);
          }
        }
      }
    } catch {}

    // Merge any client-local stored comments
    try {
      const localCommentsMap = JSON.parse(localStorage.getItem(STORAGE_KEY_COMMENTS) || '{}');
      for (const [threadId, coms] of Object.entries(localCommentsMap)) {
        const found = threads.find((t) => t.id === threadId);
        if (found && Array.isArray(coms)) {
          found.comments = found.comments || [];
          for (const c of coms) {
            if (!found.comments.some((ex) => ex.id === c.id)) {
              found.comments.push(c);
            }
          }
        }
      }
    } catch {}

    recalculateCounts();
  }

  function recalculateCounts() {
    const counts = { all: threads.length };
    for (const t of threads) {
      counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
    }
    for (const c of categories) {
      c.count = counts[c.id] || 0;
    }
  }

  function renderCategories() {
    if (!catFilterStrip) return;
    catFilterStrip.innerHTML = categories
      .map(
        (c) => `
        <button type="button" class="cat-btn ${c.id === activeCategory ? 'active' : ''}" data-cat="${c.id}">
          <span>${c.icon}</span>
          <span>${c.name}</span>
          <span class="cat-count">${c.count || 0}</span>
        </button>
      `
      )
      .join('');
  }

  function renderStageFilters() {
    if (!stageFilterStrip) return;
    const stageCounts = {};
    for (const t of threads) {
      if (t.stage) stageCounts[t.stage] = (stageCounts[t.stage] || 0) + 1;
    }
    const totalStage = Object.values(stageCounts).reduce((a, b) => a + b, 0);

    stageFilterStrip.innerHTML = STAGE_FILTERS.map((s) => {
      const cnt = s.id === 'all' ? totalStage : stageCounts[s.id] || 0;
      return `
        <button type="button" class="stage-pill ${s.id === activeStage ? 'active' : ''}" data-stage="${s.id}">
          <span>${s.name}</span>
          <span>(${cnt})</span>
        </button>
      `;
    }).join('');
  }

  function renderThreads() {
    if (!threadsListContainer) return;

    let filtered = threads.slice();

    if (activeCategory !== 'all') {
      filtered = filtered.filter((t) => t.categoryId === activeCategory);
    }

    if (activeStage !== 'all') {
      filtered = filtered.filter((t) => t.stage === activeStage);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.content || '').toLowerCase().includes(q) ||
          (t.author || '').toLowerCase().includes(q) ||
          (t.categoryName || '').toLowerCase().includes(q)
      );
    }

    if (resultCountLabel) {
      resultCountLabel.textContent = `Hiển thị ${filtered.length} trên tổng số ${threads.length} chủ đề`;
    }

    if (!filtered.length) {
      threadsListContainer.innerHTML = `
        <div style="background:#ffffff; border:1px solid var(--border-soft); border-radius:var(--radius-md); padding:40px 20px; text-align:center;">
          <p style="font-size:32px; margin-bottom:8px;">🔍</p>
          <h3 style="color:var(--bg-saddle); font-size:18px; font-weight:800; margin-bottom:6px;">Chưa tìm thấy chủ đề phù hợp</h3>
          <p style="color:var(--text-muted); font-size:13.5px; margin-bottom:18px;">Bạn có câu hỏi hoặc thắc mắc về kỹ thuật làm đồ da này? Hãy là người đầu tiên đặt câu hỏi!</p>
          <button type="button" class="btn-new-post" onclick="document.getElementById('openNewPostModalBtn').click()">
            <span>＋ Đặt Câu Hỏi Ngay</span>
          </button>
        </div>
      `;
      return;
    }

    threadsListContainer.innerHTML = filtered.map((thread) => renderThreadCardHtml(thread)).join('');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getBadgeClass(type) {
    if (type === 'solved') return 'badge-solved';
    if (type === 'featured') return 'badge-featured';
    if (type === 'info') return 'badge-info';
    if (type === 'showcase') return 'badge-showcase';
    if (type === 'market') return 'badge-market';
    return 'badge-info';
  }

  function renderThreadCardHtml(thread) {
    const isLiked = likedThreadIds.has(thread.id);
    const commentCount = (thread.comments || []).length;
    const badgeHtml = thread.badge
      ? `<span class="thread-badge-pill ${getBadgeClass(thread.badgeType)}">${escapeHtml(thread.badge)}</span>`
      : '';

    return `
      <article class="thread-card" id="card-${thread.id}">
        <div class="thread-head">
          <div class="author-info">
            <div class="author-avatar">${thread.authorAvatar || '👤'}</div>
            <div class="author-meta">
              <div class="author-name-row">
                <span>${escapeHtml(thread.author)}</span>
                ${thread.authorRole ? `<span class="author-role">• ${escapeHtml(thread.authorRole)}</span>` : ''}
              </div>
              <span class="thread-time">Đăng lúc ${escapeHtml(thread.formattedDate || 'Gần đây')}</span>
            </div>
          </div>
          <div>${badgeHtml}</div>
        </div>

        ${thread.stageLabel ? `<div class="thread-stage-tag">🏭 Công đoạn: ${escapeHtml(thread.stageLabel)}</div>` : ''}
        <h2 class="thread-title" onclick="window.__toggleThreadComments('${thread.id}')">${escapeHtml(thread.title)}</h2>
        <div class="thread-excerpt">${escapeHtml(thread.content)}</div>

        <div class="thread-footer">
          <div class="thread-actions">
            <button type="button" class="action-btn ${isLiked ? 'liked' : ''}" onclick="window.__likeThread('${thread.id}')">
              <span>${isLiked ? '❤️ Đã thích' : '🤍 Thích'}</span>
              <strong id="like-count-${thread.id}">${thread.likes || 0}</strong>
            </button>
            <button type="button" class="action-btn" onclick="window.__toggleThreadComments('${thread.id}')">
              <span>💬 Bình luận</span>
              <strong>${commentCount}</strong>
            </button>
            <span style="font-size:11.5px; color:var(--text-muted);">👁️ ${thread.views || 1} xem</span>
          </div>

          <span class="thread-cat-tag">📂 ${escapeHtml(thread.categoryName || 'Thảo luận')}</span>
        </div>

        <!-- Comments Accordion Section -->
        <div class="comments-wrapper ${commentCount > 0 ? '' : 'hidden'}" id="comments-${thread.id}">
          <div id="comment-list-${thread.id}">
            ${renderCommentsListHtml(thread.comments || [])}
          </div>

          <!-- Add Comment Input Box -->
          <div class="add-comment-box">
            <div class="comment-inputs-row">
              <input
                type="text"
                class="comment-name-input"
                id="comment-author-${thread.id}"
                placeholder="Tên của bạn..."
                value="${escapeHtml(savedAuthor || '')}"
              />
              <textarea
                class="comment-text-input"
                id="comment-content-${thread.id}"
                placeholder="Viết câu trả lời, góp ý hoặc chia sẻ mẹo xử lý của bạn..."
              ></textarea>
            </div>
            <button
              type="button"
              class="comment-submit-btn"
              onclick="window.__submitComment('${thread.id}')"
            >
              Gửi Câu Trả Lời
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderCommentsListHtml(comments) {
    if (!comments || !comments.length) {
      return `<p style="font-size:12.5px; color:var(--text-muted); font-style:italic;">Chưa có bình luận nào. Hãy là người đầu tiên trả lời!</p>`;
    }
    return comments
      .map(
        (c) => `
        <div class="comment-item ${c.isStaff ? 'staff-comment' : ''}">
          <div class="comment-head">
            <div class="comment-author-name">
              <span>${c.authorAvatar || '💬'}</span>
              <span>${escapeHtml(c.author)}</span>
              ${c.isStaff ? `<span class="staff-badge">★ Kỹ thuật RAPMAU</span>` : ''}
              ${c.authorRole && !c.isStaff ? `<span style="font-size:11px; color:var(--text-muted); font-weight:normal;">(${escapeHtml(c.authorRole)})</span>` : ''}
            </div>
            <span class="comment-time">${escapeHtml(c.formattedDate || 'Vừa xong')}</span>
          </div>
          <div class="comment-text">${escapeHtml(c.content)}</div>
        </div>
      `
      )
      .join('');
  }

  // Window helper for toggling comments
  window.__toggleThreadComments = function (threadId) {
    const box = document.getElementById(`comments-${threadId}`);
    if (box) {
      box.classList.toggle('hidden');
    }
  };

  // Window helper for like button
  window.__likeThread = async function (threadId) {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    if (likedThreadIds.has(threadId)) {
      likedThreadIds.delete(threadId);
      thread.likes = Math.max(0, (thread.likes || 1) - 1);
    } else {
      likedThreadIds.add(threadId);
      thread.likes = (thread.likes || 0) + 1;

      // Call API
      try {
        fetch(`/api/community/threads/${threadId}/like`, { method: 'POST' }).catch(() => {});
      } catch {}
    }

    try {
      localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(Array.from(likedThreadIds)));
    } catch {}

    const counter = document.getElementById(`like-count-${threadId}`);
    if (counter) counter.textContent = thread.likes;
    const card = document.getElementById(`card-${threadId}`);
    if (card) {
      const btn = card.querySelector('.action-btn');
      if (btn) {
        if (likedThreadIds.has(threadId)) {
          btn.classList.add('liked');
          btn.innerHTML = `<span>❤️ Đã thích</span><strong id="like-count-${threadId}">${thread.likes}</strong>`;
        } else {
          btn.classList.remove('liked');
          btn.innerHTML = `<span>🤍 Thích</span><strong id="like-count-${threadId}">${thread.likes}</strong>`;
        }
      }
    }
  };

  // Window helper for comment submission
  window.__submitComment = async function (threadId) {
    const authorInput = document.getElementById(`comment-author-${threadId}`);
    const contentInput = document.getElementById(`comment-content-${threadId}`);
    if (!authorInput || !contentInput) return;

    const author = authorInput.value.trim() || 'Thợ da ẩn danh';
    const content = contentInput.value.trim();

    if (!content) {
      alert('Vui lòng nhập nội dung bình luận!');
      contentInput.focus();
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY_AUTHOR, author);
    } catch {}

    const newComment = {
      id: `c-${Date.now()}`,
      author,
      authorRole: 'Thành viên',
      authorAvatar: '💬',
      isStaff: false,
      createdAt: new Date().toISOString(),
      formattedDate: 'Vừa xong',
      content,
      likes: 0
    };

    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
      thread.comments = thread.comments || [];
      thread.comments.push(newComment);

      // Save to localStorage map
      try {
        const localCommentsMap = JSON.parse(localStorage.getItem(STORAGE_KEY_COMMENTS) || '{}');
        localCommentsMap[threadId] = localCommentsMap[threadId] || [];
        localCommentsMap[threadId].push(newComment);
        localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(localCommentsMap));
      } catch {}

      // Call API
      try {
        fetch(`/api/community/threads/${threadId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, content })
        }).catch(() => {});
      } catch {}

      // Update UI
      const listEl = document.getElementById(`comment-list-${threadId}`);
      if (listEl) {
        listEl.innerHTML = renderCommentsListHtml(thread.comments);
      }
      contentInput.value = '';

      // Update comment count button
      const card = document.getElementById(`card-${threadId}`);
      if (card) {
        const comBtn = card.querySelectorAll('.action-btn')[1];
        if (comBtn) {
          comBtn.innerHTML = `<span>💬 Bình luận</span><strong>${thread.comments.length}</strong>`;
        }
      }
    }
  };

  function setupEventListeners() {
    // Category strip click
    if (catFilterStrip) {
      catFilterStrip.addEventListener('click', (e) => {
        const btn = e.target.closest('.cat-btn');
        if (!btn) return;
        const catId = btn.getAttribute('data-cat');
        if (catId) {
          activeCategory = catId;
          if (catId !== 'all' && catId !== 'may-moc-xuong') {
            activeStage = 'all';
          }
          renderCategories();
          renderStageFilters();
          renderThreads();
        }
      });
    }

    // Production stage quick-filter click
    if (stageFilterStrip) {
      stageFilterStrip.addEventListener('click', (e) => {
        const btn = e.target.closest('.stage-pill');
        if (!btn) return;
        const stageId = btn.getAttribute('data-stage');
        if (stageId) {
          activeStage = stageId;
          if (stageId !== 'all' && activeCategory !== 'all' && activeCategory !== 'may-moc-xuong') {
            activeCategory = 'may-moc-xuong';
          }
          renderCategories();
          renderStageFilters();
          renderThreads();
        }
      });
    }

    // Search input
    if (threadSearchInput) {
      threadSearchInput.addEventListener('input', () => {
        searchQuery = threadSearchInput.value;
        if (clearSearchBtn) {
          clearSearchBtn.classList.toggle('hidden', !searchQuery);
        }
        renderThreads();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        threadSearchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderThreads();
      });
    }

    // Open Modal
    function openModal() {
      if (postModal) postModal.classList.remove('hidden');
      if (postTitle) postTitle.focus();
    }

    function closeModal() {
      if (postModal) postModal.classList.add('hidden');
    }

    if (openNewPostModalBtn) openNewPostModalBtn.addEventListener('click', openModal);
    if (heroOpenModalBtn) heroOpenModalBtn.addEventListener('click', openModal);
    if (floatingAskBtn) floatingAskBtn.addEventListener('click', openModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelPostBtn) cancelPostBtn.addEventListener('click', closeModal);

    if (postModal) {
      postModal.addEventListener('click', (e) => {
        if (e.target === postModal) closeModal();
      });
    }

    // New Post Form submit
    if (newPostForm) {
      newPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = postTitle.value.trim();
        const author = postAuthor.value.trim() || 'Thợ da ẩn danh';
        const categoryId = postCategory.value;
        const content = postContent.value.trim();

        if (!title || !content) {
          alert('Vui lòng điền tiêu đề và nội dung thắc mắc!');
          return;
        }

        try {
          localStorage.setItem(STORAGE_KEY_AUTHOR, author);
        } catch {}

        const catObj = categories.find((c) => c.id === categoryId);
        const categoryName = catObj ? catObj.name : 'Người Mới Nhập Môn';

        const newThread = {
          id: `thread-${Date.now()}`,
          categoryId,
          categoryName,
          title,
          author,
          authorRole: 'Thành viên diễn đàn',
          authorAvatar: '👨‍🎨',
          createdAt: new Date().toISOString(),
          formattedDate: 'Vừa xong',
          badge: 'Chủ đề mới',
          badgeType: 'info',
          likes: 1,
          views: 1,
          content,
          images: [],
          comments: []
        };

        // Prepend to list
        threads.unshift(newThread);

        // Save to local storage
        try {
          const localThreads = JSON.parse(localStorage.getItem(STORAGE_KEY_THREADS) || '[]');
          localThreads.unshift(newThread);
          localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(localThreads));
        } catch {}

        // Call backend API if running
        try {
          fetch('/api/community/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author, categoryId, content })
          }).catch(() => {});
        } catch {}

        // Reset form & close
        newPostForm.reset();
        closeModal();

        recalculateCounts();
        renderCategories();
        renderThreads();

        // Scroll to top of list
        const firstCard = document.getElementById(`card-${newThread.id}`);
        if (firstCard) {
          firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
