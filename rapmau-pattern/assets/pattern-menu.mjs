import {identifyPatternFile} from './pattern-open.mjs';
import {validatePatternFile} from './pattern-file.mjs';
function init(){
 const byId=id=>document.getElementById(id),header=document.querySelector('body>header'),workspace=document.querySelector('.workspace');
 const make=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n};
 const menus=[],bar=make('nav','','pattern-menubar');bar.setAttribute('aria-label','Menu rập mẫu');header.prepend(bar);document.body.classList.add('pattern-compact-menu');
 function menu(title){const d=make('details','','pattern-menu'),summary=make('summary',title),body=make('div','','pattern-menu-body');d.append(summary,body);bar.append(d);menus.push(d);d.addEventListener('toggle',()=>{if(!d.open)return;for(const other of menus)if(other!==d)other.open=false;const r=summary.getBoundingClientRect();body.style.left=Math.max(8,Math.min(r.left,innerWidth-288))+'px';body.style.top=r.bottom+5+'px';body.style.maxHeight=Math.max(120,innerHeight-r.bottom-16)+'px'});return {d,body,summary}}
 function action(m,label,fn){const b=make('button',label);b.type='button';b.onclick=()=>{m.d.open=false;fn()};m.body.append(b);return b}
 const shortcutTable=document.querySelector('.pattern-shortcut-dialog table');for(const [key,label] of [['Ctrl/⌘ + O','Mở ảnh / PDF / bản rập từ máy'],['Ctrl/⌘ + S','Lưu bản rập về máy']]){const row=make('tr');row.append(make('td',key),make('td',label));shortcutTable?.append(row)}
 const file=menu('Tệp'),viewMenu=menu('Xem'),help=menu('Trợ giúp');
 const fileInput=make('input');fileInput.type='file';fileInput.accept='.jpg,.jpeg,.png,.webp,.pdf,.rapmaupattern.json,.json';fileInput.hidden=true;document.body.append(fileInput);
 action(file,'Mở file… · Ctrl/⌘ + O',()=>fileInput.click());
 const saveButton=action(file,'Lưu bản rập về máy…',saveFile);
 action(file,'Tạo chi tiết theo số đo…',()=>byId('railGeometry').click());
 file.body.append(make('p','Bản rập .json giữ đường vẽ, lớp kỹ thuật, thông tin sản xuất và ảnh tham chiếu. Bản độc lập không kết nối Kho rập nội bộ; hãy lưu file trước khi đóng trang.','hint'));
 const sideButtons=[...document.querySelectorAll('.pattern-steps button')].slice(3);for(const b of sideButtons){viewMenu.body.append(b);b.addEventListener('click',()=>viewMenu.d.open=false)}
 for(const [id,label] of [['focusDraft','Chỉ vùng vẽ'],['splitView','Vẽ và giấy cạnh nhau'],['focusPaper','Chỉ giấy & xuất'],['quickFullscreen','Toàn màn hình · F'],['draftFit','Vừa khung · Ctrl/⌘ + 0'],['draftFitPiece','Vừa chi tiết · Shift + F']]){const b=action(viewMenu,label,()=>byId(id).click());if(['splitView','focusPaper'].includes(id)){const sync=()=>b.disabled=byId('paperTab').disabled;new MutationObserver(sync).observe(byId('paperTab'),{attributes:true,attributeFilter:['disabled']});sync()}}
 const splitSettings=byId('viewControls').querySelector('label');if(splitSettings)viewMenu.body.append(splitSettings);
 action(help,'Bảng phím tắt · ?',()=>document.dispatchEvent(new CustomEvent('pattern-show-shortcuts')));
 action(help,'Thiết lập nhập file / công cụ',()=>byId('railTools').click());action(help,'Thiết lập khổ giấy',()=>byId('railPaper').click());
 const title=make('span','','pattern-document-name');header.append(title);function updateTitle(){title.textContent=byId('photoName').textContent.startsWith('JPG,')?'Phác thảo rập':byId('photoName').textContent||'Phác thảo rập';title.title=title.textContent}new MutationObserver(updateTitle).observe(byId('photoName'),{childList:true,subtree:true,characterData:true});updateTitle();
 for(const id of ['railPhoto','railPdf','railGeometry','railTools','railPaper']){const node=byId(id);node.classList.add('pattern-source-command');}
 // Keep the existing handlers; only shorten the persistent document navigation.
 const steps=document.querySelectorAll('.pattern-steps>button');['Tư liệu','Vẽ & chỉnh','Giấy & xuất'].forEach((name,i)=>steps[i].textContent=name);
 const resize=make('button','Đổi kích thước');resize.className='pattern-header-action';resize.type='button';resize.onclick=()=>{window.dispatchEvent(new Event('pattern-open-dimensions'));byId('status').textContent='Chọn từng chi tiết, nhập rộng/cao mm rồi áp dụng. Kiểm tra đường may, lỗ và phụ kiện trước khi in.';};header.append(resize);
 const topActions=make('div','','pattern-file-actions');const open=make('button','Mở file'),save=make('button','Lưu bản rập');open.type=save.type='button';open.onclick=()=>fileInput.click();save.onclick=saveFile;topActions.append(open,save);header.append(topActions);
 const sources=document.querySelector('.app-rail');const importButton=make('button','＋\nMở file');importButton.type='button';importButton.title='Mở ảnh, PDF hoặc bản rập';importButton.onclick=open.onclick;sources.prepend(importButton);
 async function saveFile(){save.disabled=saveButton.disabled=true;try{const doc=globalThis.patternProject.capture();const reference=await globalThis.patternProject.reference();if(reference){doc.referenceDataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(reference)});doc.referenceKey=null}const blob=new Blob([JSON.stringify(doc)],{type:'application/json'});if(blob.size>40*1024*1024)throw Error('Bản rập vượt 40 MB. Hãy giảm kích thước ảnh tham chiếu trước khi lưu.');const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download='RAPMAU-ban-rap.rapmaupattern.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);byId('status').textContent='Đã tạo bản rập tải về máy. Giữ file này để mở và chỉnh sửa tiếp.'}catch(e){byId('status').textContent='Chưa lưu được bản rập: '+e.message}finally{save.disabled=saveButton.disabled=false}}
 let opening=false;
 async function openFile(f){if(opening)return;opening=true;open.disabled=true;try{const kind=await identifyPatternFile(f);let doc;if(kind==='pattern')doc=validatePatternFile(JSON.parse((await f.text()).replace(/^\uFEFF/,'')));const current=globalThis.patternProject.capture();if((current.state.pieces.some(p=>p.points.length)||!current.imageInfo?.blank&&current.imageInfo)&&!confirm('Mở file mới sẽ thay bản đang làm. Hãy lưu bản hiện tại trước nếu cần. Tiếp tục?'))return;
 if(kind==='pattern'){await globalThis.patternProject.restore(doc);window.dispatchEvent(new CustomEvent('pattern-file-opened',{detail:{kind}}));byId('status').textContent='Đã mở bản rập RAPMAU · giữ đường vẽ, số đo và lớp kỹ thuật.';}
 else if(kind==='pdf'){byId('railPdf').click();await globalThis.patternOpenPdf(f);window.dispatchEvent(new CustomEvent('pattern-file-opened',{detail:{kind}}));}
 else{byId('railPhoto').click();await byId('photo').onchange({target:{files:[f]}});window.dispatchEvent(new CustomEvent('pattern-file-opened',{detail:{kind}}));}
 }catch(error){byId('status').textContent='Không mở được file: '+error.message;}finally{opening=false;open.disabled=false;fileInput.value='';}}
 fileInput.onchange=()=>{const f=fileInput.files?.[0];if(f)openFile(f);};
 globalThis.patternOpenFilePicker=()=>fileInput.click();
 // Existing upload labels now use the same picker without replacing their parsers.
 for(const id of ['photo','pdfFile']){const input=byId(id);input.addEventListener('click',event=>{event.preventDefault();fileInput.click();});}
 const welcome=make('div','','pattern-open-card');const upload=make('button','＋ Mở file','primary');upload.type='button';upload.onclick=()=>fileInput.click();welcome.append(upload,make('p','Ảnh sản phẩm · PDF · Bản rập RAPMAU'),make('small','Kéo thả một file vào vùng làm việc. Hệ thống tự nhận diện định dạng.'));
 const fold=document.querySelector('.pattern-input-fold');fold.querySelector('summary').textContent='Tệp & thiết lập nhập';fold.querySelector('summary').after(welcome);
 workspace.addEventListener('dragover',event=>{if([...event.dataTransfer.types].includes('Files')){event.preventDefault();workspace.classList.add('pattern-drop-active');}});
 workspace.addEventListener('dragleave',event=>{if(!workspace.contains(event.relatedTarget))workspace.classList.remove('pattern-drop-active');});
 workspace.addEventListener('drop',event=>{if(!event.dataTransfer.files.length)return;event.preventDefault();workspace.classList.remove('pattern-drop-active');if(event.dataTransfer.files.length!==1){byId('status').textContent='Mở một file mỗi lần. Với PDF nhiều trang, chọn trang sau khi mở.';return;}openFile(event.dataTransfer.files[0]);});

 document.addEventListener('click',e=>{for(const d of menus)if(!d.contains(e.target)&&e.target!==open&&e.target!==importButton)d.open=false});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const d of menus)if(d.open){d.open=false;d.querySelector('summary').focus()}});
 // Browser shortcuts are scoped to the editor, not text fields or modal forms.
 window.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||e.isComposing||e.target?.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||'')||document.querySelector('dialog[open]'))return;const k=e.key.toLowerCase();if(!['o','s'].includes(k))return;e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;k==='s'?saveFile():fileInput.click()},{capture:true});
}
if(document.readyState==='complete')init();else window.addEventListener('DOMContentLoaded',init,{once:true});
