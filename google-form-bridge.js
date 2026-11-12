/**
 * Cầu nối gửi trực tiếp các form đăng ký trên www.rapmau.com về Google Form / Google Sheet.
 * Dùng POST mode: 'no-cors' tới Google Forms formResponse để hoạt động 100% trên hosting tĩnh Cloudflare Pages
 * mà không cần rời khỏi trang hay mở app Email trên điện thoại.
 */
(function () {
  const FORM_BASE =
    'https://docs.google.com/forms/d/e/1FAIpQLSc2eQWfzgVk6BYuCrj4JQ-nFMQ39LF67j9b6jcsv2j5NrFK5w';

  const GFORM_CONFIG = {
    viewUrl: `${FORM_BASE}/viewform`,
    responseUrl: `${FORM_BASE}/formResponse`,
    entries: {
      name: 'entry.1513256242',
      contact: 'entry.999407723',
      type: 'entry.709075460',
      roleArea: 'entry.1404719928',
      details: 'entry.2073124870'
    }
  };

  async function submitRapmauGoogleForm({ name, contact, type, roleArea, details }) {
    const params = new URLSearchParams();
    params.append(GFORM_CONFIG.entries.name, String(name || '').trim() || '-');
    params.append(GFORM_CONFIG.entries.contact, String(contact || '').trim() || '-');
    params.append(GFORM_CONFIG.entries.type, String(type || '').trim() || 'Đăng ký từ website');
    params.append(GFORM_CONFIG.entries.roleArea, String(roleArea || '').trim() || '-');
    params.append(GFORM_CONFIG.entries.details, String(details || '').trim() || '-');

    try {
      await fetch(GFORM_CONFIG.responseUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: params.toString()
      });
      return true;
    } catch {
      return false;
    }
  }

  window.RAPMAU_GFORM = GFORM_CONFIG;
  window.submitRapmauGoogleForm = submitRapmauGoogleForm;
})();
