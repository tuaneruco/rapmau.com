function initRapmauPrivacy() {
  const note = document.createElement('div');
  note.className = 'rapmau-local-note';
  note.append('Ảnh và bản nháp được xử lý/lưu trên trình duyệt này, không đồng bộ tài khoản. Nếu dùng máy chung, hãy xóa dữ liệu sau khi làm xong. ');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Xóa dữ liệu Studio trên thiết bị';
  const status = document.createElement('span');
  status.className = 'rapmau-status';
  status.setAttribute('role', 'status');
  clear.onclick = async () => {
    if (!confirm('Xóa toàn bộ bản nháp và bộ thương hiệu của RAPMAU Studio trên trình duyệt này? Ảnh đã tải xuống không bị xóa. Đóng các tab RAPMAU Studio khác trước khi tiếp tục.')) return;
    clear.disabled = true;
    try {
      if (!window.StudioFlow?.clearLocal) throw Error('Bộ lưu nháp chưa sẵn sàng. Hãy tải lại trang.');
      await window.StudioFlow.clearLocal();
      for (const key of ['rapmau.studio.brand-kits.v1', 'rapmau.studio.brand-active.v1']) localStorage.removeItem(key);
      location.reload();
    } catch (error) {
      status.textContent = 'Chưa xóa hoàn tất: ' + error.message;
      clear.disabled = false;
    }
  };
  note.append(clear, status);
  (document.querySelector('aside') || document.body).append(note);
}
if (document.readyState === 'complete') initRapmauPrivacy();
else window.addEventListener('load', initRapmauPrivacy, {once:true});
