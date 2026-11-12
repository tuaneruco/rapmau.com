function initStandalone(){
 const note=document.createElement('div');note.className='standalone-note';note.setAttribute('role','note');
 note.textContent='Xử lý trực tiếp trên trình duyệt · Lưu bản rập (.json) về máy trước khi đóng trang. Số đo cần được in thử ở tỷ lệ 100% và đo đối chiếu trước khi sản xuất.';
 const back=document.createElement('a');back.href='/rapmau-studio/';back.textContent='← Về RAPMAU Studio (4 Công Cụ)';back.style.cssText='margin-left:12px;font-weight:700;color:#9a4412;text-decoration:underline;white-space:nowrap;';
 note.append(' ',back);
 document.querySelector('header').after(note);
}
if(document.readyState==='complete')initStandalone();else window.addEventListener('load',initStandalone,{once:true});
