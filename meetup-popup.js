(function () {
  if (typeof window === 'undefined' || window.__rapmauMeetupInit) return;
  window.__rapmauMeetupInit = true;

  const DWELL_TARGET_MS = 20000;
  const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const SUBMIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const LS_DISMISSED_UNTIL = 'rapmau_meetup_dismissed_until_v1';
  const SS_ELAPSED_MS = 'rapmau_meetup_dwell_ms_v1';
  const SS_SHOWN = 'rapmau_meetup_shown_session_v1';

  const STYLES = `
    .rm-meetup-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(20, 12, 7, 0.72);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.25s ease, visibility 0.25s ease;
    }
    .rm-meetup-backdrop.is-open {
      opacity: 1;
      visibility: visible;
    }
    .rm-meetup-dialog {
      position: relative;
      width: 100%;
      max-width: 580px;
      max-height: 92vh;
      overflow-y: auto;
      background: #fffcf7;
      border-radius: 18px;
      border: 1.5px solid #e6d5bf;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #2b1d12;
      transform: translateY(14px) scale(0.98);
      transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .rm-meetup-backdrop.is-open .rm-meetup-dialog {
      transform: translateY(0) scale(1);
    }
    .rm-meetup-header {
      background: linear-gradient(135deg, #2d1b10 0%, #4b2d1a 100%);
      color: #fff;
      padding: 20px 22px 18px;
      border-bottom: 2px dashed #c8945c;
      position: relative;
    }
    .rm-meetup-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.28);
      background: rgba(0, 0, 0, 0.28);
      color: #fff;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
    }
    .rm-meetup-close:hover {
      background: rgba(255, 255, 255, 0.22);
    }
    .rm-meetup-pill {
      display: inline-block;
      background: #f59e0b;
      color: #241409;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.4px;
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .rm-meetup-title {
      margin: 0 32px 6px 0;
      font-size: 19px;
      line-height: 1.32;
      font-weight: 800;
      color: #fff;
    }
    .rm-meetup-sub {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #f3e5d5;
    }
    .rm-meetup-body {
      padding: 18px 22px 20px;
    }
    .rm-meetup-perks {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }
    .rm-meetup-perk {
      background: #f8f1e6;
      border: 1px solid #ead8c0;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 11.8px;
      line-height: 1.38;
      color: #4a2e1b;
      font-weight: 600;
    }
    .rm-meetup-label {
      display: block;
      font-size: 12.5px;
      font-weight: 700;
      color: #3d2616;
      margin-bottom: 5px;
    }
    .rm-meetup-roles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
      margin-bottom: 12px;
    }
    .rm-meetup-role-opt {
      position: relative;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px 10px;
      background: #fff;
      border: 1.5px solid #e2d3bf;
      border-radius: 9px;
      cursor: pointer;
      font-size: 12.3px;
      font-weight: 600;
      color: #3d2616;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .rm-meetup-role-opt input {
      accent-color: #9a4a16;
      margin: 0;
      flex-shrink: 0;
    }
    .rm-meetup-role-opt.is-selected {
      border-color: #9a4a16;
      background: #fff7ed;
    }
    .rm-meetup-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .rm-meetup-field {
      margin-bottom: 11px;
    }
    .rm-meetup-input,
    .rm-meetup-select,
    .rm-meetup-textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 9px 11px;
      border: 1.5px solid #decbb3;
      border-radius: 9px;
      background: #fff;
      color: #2b1d12;
      font-size: 13.5px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .rm-meetup-input:focus,
    .rm-meetup-select:focus,
    .rm-meetup-textarea:focus {
      border-color: #9a4a16;
    }
    .rm-meetup-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 6px;
    }
    .rm-meetup-submit {
      flex: 1 1 220px;
      background: linear-gradient(135deg, #9a4a16 0%, #c2591b 100%);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 11px 16px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(154, 74, 22, 0.28);
      transition: filter 0.15s ease, transform 0.12s ease;
    }
    .rm-meetup-submit:hover {
      filter: brightness(1.06);
    }
    .rm-meetup-later {
      background: transparent;
      border: 1px solid #d9c6af;
      color: #6b523e;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .rm-meetup-later:hover {
      background: #f3eadf;
    }
    .rm-meetup-note {
      margin: 10px 0 0;
      font-size: 11.5px;
      color: #7c6450;
      text-align: center;
      line-height: 1.45;
    }
    .rm-meetup-success {
      text-align: center;
      padding: 12px 6px 6px;
    }
    .rm-meetup-success h4 {
      margin: 8px 0 6px;
      font-size: 18px;
      color: #166534;
    }
    .rm-meetup-success p {
      font-size: 13.5px;
      line-height: 1.55;
      color: #374151;
      margin: 0 0 14px;
    }
    .rm-meetup-mailto {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #1d4ed8;
      color: #fff;
      text-decoration: none;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    @media (max-width: 560px) {
      .rm-meetup-perks {
        grid-template-columns: 1fr;
      }
      .rm-meetup-roles,
      .rm-meetup-grid-2 {
        grid-template-columns: 1fr;
      }
      .rm-meetup-header {
        padding: 16px 16px 14px;
      }
      .rm-meetup-body {
        padding: 14px 16px 16px;
      }
      .rm-meetup-title {
        font-size: 17px;
      }
    }
  `;

  let styleInjected = false;
  let backdropEl = null;

  function ensureStyles() {
    if (styleInjected) return;
    const style = document.createElement('style');
    style.id = 'rapmauMeetupPopupStyles';
    style.textContent = STYLES;
    document.head.appendChild(style);
    styleInjected = true;
  }

  function hasOtherOpenModal() {
    const knownBackdrops = [
      'productModalBackdrop',
      'cartModalBackdrop',
      'adminModalBackdrop',
      'articleModalBackdrop',
      'postModal'
    ];
    for (const id of knownBackdrops) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) return true;
    }
    const b2bModal = document.getElementById('b2bArticleModal');
    if (b2bModal && b2bModal.classList.contains('active')) return true;
    return false;
  }

  function buildModal() {
    if (backdropEl) return backdropEl;
    ensureStyles();

    const wrap = document.createElement('div');
    wrap.className = 'rm-meetup-backdrop';
    wrap.id = 'rapmauMeetupBackdrop';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'rmMeetupHeading');

    wrap.innerHTML = `
      <div class="rm-meetup-dialog">
        <div class="rm-meetup-header">
          <button type="button" class="rm-meetup-close" id="rmMeetupCloseBtn" aria-label="Đóng thông báo">✕</button>
          <span class="rm-meetup-pill">☕ BÀN TRÒN NGHỀ DA OFFLINE • GIỚI HẠN 6–8 NGƯỜI / BUỔI</span>
          <h3 class="rm-meetup-title" id="rmMeetupHeading">
            Đăng Ký Cafe Giao Lưu Xưởng Nghề Da, Nhà Cung Cấp Nguyên Vật Liệu &amp; Máy Móc
          </h3>
          <p class="rm-meetup-sub">
            Gặp mặt trực tiếp nhóm nhỏ <strong>6–8 thành viên bổ trợ công đoạn</strong>: chia sẻ đơn hàng khi quá tải, ghép xưởng gia công, test nguồn da/hóa chất/máy móc và hỗ trợ kỹ thuật thực tế.
          </p>
        </div>

        <div class="rm-meetup-body" id="rmMeetupBody">
          <div class="rm-meetup-perks">
            <div class="rm-meetup-perk">🤝 Ghép 6–8 xưởng/NCC không giẫm chân phân khúc</div>
            <div class="rm-meetup-perk">🪵 Mang sản phẩm thật lên bàn trao đổi công việc</div>
            <div class="rm-meetup-perk">☕ Phi thương mại • Chia đều nước (~50k–100k/buổi)</div>
          </div>

          <form id="rmMeetupForm">
            <div class="rm-meetup-field">
              <span class="rm-meetup-label">1. Vai trò của bạn trong chuỗi nghề da (*)</span>
              <div class="rm-meetup-roles" id="rmMeetupRoles">
                <label class="rm-meetup-role-opt is-selected">
                  <input type="radio" name="rmRole" value="Xưởng gia công / Thợ làm đồ da" checked />
                  <span>🏭 Xưởng Gia Công / Thợ Da</span>
                </label>
                <label class="rm-meetup-role-opt">
                  <input type="radio" name="rmRole" value="Nhà cung cấp Nguyên Vật Liệu (Da, Keo, Sơn, Phụ kiện)" />
                  <span>🐄 NCC Nguyên Vật Liệu</span>
                </label>
                <label class="rm-meetup-role-opt">
                  <input type="radio" name="rmRole" value="Đơn vị Máy Móc / Khuôn Bế / Kỹ Thuật Xưởng" />
                  <span>⚙️ NCC Máy Móc / Khuôn Bế</span>
                </label>
                <label class="rm-meetup-role-opt">
                  <input type="radio" name="rmRole" value="Thương hiệu / Đặt hàng tìm Xưởng gia công" />
                  <span>🏷️ Brand / Tìm Xưởng Đặt Hàng</span>
                </label>
              </div>
            </div>

            <div class="rm-meetup-grid-2">
              <div class="rm-meetup-field">
                <label class="rm-meetup-label" for="rmMeetupName">2. Tên bạn / Tên Xưởng hoặc Công ty (*)</label>
                <input
                  type="text"
                  id="rmMeetupName"
                  class="rm-meetup-input"
                  placeholder="VD: Minh Thành - Xưởng Ví Q.12"
                  required
                  maxlength="80"
                />
              </div>

              <div class="rm-meetup-field">
                <label class="rm-meetup-label" for="rmMeetupArea">3. Khu vực tiện gặp trực tiếp (*)</label>
                <select id="rmMeetupArea" class="rm-meetup-select" required>
                  <option value="TP.HCM (Thứ 7 / Chủ Nhật)">TP.HCM (Cuối tuần)</option>
                  <option value="Bình Dương / Đồng Nai">Bình Dương / Đồng Nai</option>
                  <option value="Hà Nội &amp; lân cận">Hà Nội &amp; lân cận</option>
                  <option value="Khu vực khác (Đề xuất nhóm riêng)">Khu vực khác (Đề xuất ghép nhóm)</option>
                </select>
              </div>
            </div>

            <div class="rm-meetup-field">
              <label class="rm-meetup-label" for="rmMeetupEmail">4. Email nhận thư mời &amp; địa điểm buổi 6–8 người (*)</label>
              <input
                type="email"
                id="rmMeetupEmail"
                class="rm-meetup-input"
                placeholder="VD: xuongda@gmail.com (không công khai ra ngoài)"
                required
              />
            </div>

            <div class="rm-meetup-field">
              <label class="rm-meetup-label" for="rmMeetupNotes">5. Thế mạnh hiện tại &amp; Công việc muốn hỗ trợ / kết nối thêm (*)</label>
              <textarea
                id="rmMeetupNotes"
                class="rm-meetup-textarea"
                rows="2"
                required
                placeholder="VD: Xưởng đang chạy máy trụ Sunstar & máy lạng Nippy, mạnh về ví/cardholder; muốn nhận thêm gia công hoặc tìm NCC sơn cạnh/khuôn bế uy tín..."
              ></textarea>
            </div>

            <div class="rm-meetup-actions">
              <button type="submit" class="rm-meetup-submit" id="rmMeetupSubmitBtn">
                ☕ Đăng Ký Ghép Nhóm 6–8 Người
              </button>
              <button type="button" class="rm-meetup-later" id="rmMeetupLaterBtn">
                Để sau
              </button>
            </div>

            <p class="rm-meetup-note">
              Chỉ điều phối lịch gặp kín theo từng nhóm 6–8 người qua Email duy nhất <strong>info@rapmau.com</strong> • Không spam, không bán hàng chèo kéo.
            </p>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);
    backdropEl = wrap;

    wrap.querySelectorAll('input[name="rmRole"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        wrap.querySelectorAll('.rm-meetup-role-opt').forEach((lbl) => {
          lbl.classList.toggle('is-selected', lbl.querySelector('input').checked);
        });
      });
    });

    const closeBtn = document.getElementById('rmMeetupCloseBtn');
    const laterBtn = document.getElementById('rmMeetupLaterBtn');
    closeBtn.addEventListener('click', () => closePopup(true));
    laterBtn.addEventListener('click', () => closePopup(true));

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) closePopup(true);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wrap.classList.contains('is-open')) {
        closePopup(true);
      }
    });

    const form = document.getElementById('rmMeetupForm');
    form.addEventListener('submit', handleFormSubmit);

    return wrap;
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('rmMeetupSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Đang ghi nhận đăng ký...';

    const roleRadio = document.querySelector('input[name="rmRole"]:checked');
    const role = roleRadio ? roleRadio.value : 'Xưởng gia công';
    const name = document.getElementById('rmMeetupName').value.trim();
    const area = document.getElementById('rmMeetupArea').value;
    const email = document.getElementById('rmMeetupEmail').value.trim();
    const notes = document.getElementById('rmMeetupNotes').value.trim();

    let regId = `CF${Date.now().toString().slice(-6)}`;
    let savedToServer = false;
    try {
      const resp = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${name} (${area})`,
          phone: email,
          needType: '☕ Cafe Giao Lưu Xưởng Da (6–8 người/buổi)',
          skuRef: 'MEETUP-6-8',
          message: `[CAFE GIAO LƯU 6-8 NGƯỜI] Vai trò: ${role} | Khu vực: ${area} | Email: ${email} | Thế mạnh & Nhu cầu: ${notes}`
        })
      });
      if (resp && resp.ok) {
        const json = await resp.json();
        if (json?.ok && json?.entry?.id) {
          regId = json.entry.id;
          savedToServer = true;
        }
      }
    } catch {
      // Bản tĩnh Cloud vẫn hiển thị bước xác nhận Email
    }

    try {
      localStorage.setItem(LS_DISMISSED_UNTIL, String(Date.now() + SUBMIT_TTL_MS));
    } catch {
      // ignore storage errors
    }

    const mailSubject = encodeURIComponent(`[CAFE GIAO LƯU 6-8 NGƯỜI #${regId}] ${name} - ${area}`);
    const mailBody = encodeURIComponent(
      `Xin chào Ban Điều Phối Cộng Đồng RAPMAU,\nTôi đăng ký tham gia buổi Cafe Giao Lưu Xưởng Nghề Da (6-8 người/buổi):\n- Mã đăng ký: #${regId}\n- Tên / Xưởng / NCC: ${name}\n- Vai trò: ${role}\n- Khu vực: ${area}\n- Email nhận lịch: ${email}\n- Thế mạnh & nhu cầu chia sẻ công việc: ${notes}\n\n(Có thể đính kèm 1-2 ảnh sản phẩm/máy móc/vật liệu mẫu của xưởng tại đây).`
    );

    const bodyEl = document.getElementById('rmMeetupBody');
    const titleText = savedToServer
      ? `Đã Ghi Nhận Đăng Ký #${regId}!`
      : `Đã Soạn Sẵn Đơn Đăng Ký #${regId} — Bấm Gửi Email!`;
    const descHtml = savedToServer
      ? `Cảm ơn <strong>${escapeHtml(name)}</strong>! Ban điều phối sẽ sàng lọc và ghép nhóm <strong>6–8 thành viên bổ trợ lẫn nhau</strong> tại khu vực <strong>${escapeHtml(area)}</strong>, sau đó gửi lịch &amp; địa điểm cụ thể về Email <strong>${escapeHtml(email)}</strong> từ <strong>info@rapmau.com</strong>.`
      : `Cảm ơn <strong>${escapeHtml(name)}</strong>! Hãy bấm nút bên dưới để gửi thông tin đăng ký (khu vực <strong>${escapeHtml(area)}</strong>) thẳng về Email <strong>info@rapmau.com</strong> giúp Ban điều phối ghép đúng nhóm 6–8 thành viên phù hợp.`;
    const mailBtnLabel = savedToServer
      ? '✉️ Gửi Kèm Ảnh Mẫu / Hồ Sơ Về info@rapmau.com'
      : '✉️ Hoàn Tất Gửi Đăng Ký Về info@rapmau.com →';

    bodyEl.innerHTML = `
      <div class="rm-meetup-success">
        <div style="font-size:38px; line-height:1;">${savedToServer ? '☕✅' : '☕📩'}</div>
        <h4>${titleText}</h4>
        <p>${descHtml}</p>
        <div>
          <a href="mailto:info@rapmau.com?subject=${mailSubject}&body=${mailBody}" class="rm-meetup-mailto">
            ${mailBtnLabel}
          </a>
        </div>
        <button type="button" class="rm-meetup-later" id="rmMeetupDoneCloseBtn">Đóng cửa sổ</button>
      </div>
    `;

    const doneBtn = document.getElementById('rmMeetupDoneCloseBtn');
    if (doneBtn) doneBtn.addEventListener('click', () => closePopup(true));
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openPopup() {
    const el = buildModal();
    el.classList.add('is-open');
    try {
      sessionStorage.setItem(SS_SHOWN, '1');
    } catch {
      // ignore
    }
  }

  function closePopup(rememberDismiss) {
    if (backdropEl) {
      backdropEl.classList.remove('is-open');
    }
    if (rememberDismiss) {
      try {
        localStorage.setItem(LS_DISMISSED_UNTIL, String(Date.now() + DISMISS_TTL_MS));
        sessionStorage.setItem(SS_SHOWN, '1');
      } catch {
        // ignore
      }
    }
  }

  window.openRapmauMeetupPopup = openPopup;

  function shouldSkipAutoShow() {
    if (window.location.pathname.startsWith('/admin')) return true;
    try {
      if (sessionStorage.getItem(SS_SHOWN) === '1') return true;
      const until = Number(localStorage.getItem(LS_DISMISSED_UNTIL) || 0);
      if (until > Date.now()) return true;
    } catch {
      // ignore
    }
    return false;
  }

  function startDwellTracker() {
    if (shouldSkipAutoShow()) return;

    let elapsed = 0;
    try {
      elapsed = Number(sessionStorage.getItem(SS_ELAPSED_MS) || 0) || 0;
    } catch {
      elapsed = 0;
    }

    let lastTick = Date.now();
    const interval = setInterval(() => {
      if (shouldSkipAutoShow()) {
        clearInterval(interval);
        return;
      }
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      if (document.visibilityState === 'visible') {
        elapsed += Math.min(delta, 2000);
        try {
          sessionStorage.setItem(SS_ELAPSED_MS, String(elapsed));
        } catch {
          // ignore
        }
      }

      if (elapsed >= DWELL_TARGET_MS) {
        if (!hasOtherOpenModal()) {
          clearInterval(interval);
          openPopup();
        }
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDwellTracker);
  } else {
    startDwellTracker();
  }
})();
