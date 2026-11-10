(()=>{
function init(){
 const $=id=>document.getElementById(id),main=document.querySelector('main'),aside=main.querySelector('aside'),article=main.querySelector('article'),header=document.querySelector('body>header');
 main.classList.add('design-layout');aside.className='design-properties';aside.id='designProperties';article.classList.add('workspace');
 const title=aside.querySelector('h1');title.className='design-name';title.textContent='Xóa nền';header.append(title);
 const sections=[...$('editPanel').querySelectorAll(':scope>section')],repair=document.createElement('section'),details=sections[1].querySelector('details');
 repair.innerHTML='<h2>Tinh chỉnh vùng tách</h2>';details.querySelector('summary').remove();repair.append(...details.childNodes);details.remove();
 sections[0].insertAdjacentHTML('afterbegin','<h2>Ảnh sản phẩm</h2>');sections[1].querySelector('h2').textContent='Tách sản phẩm';sections[2].querySelector('h2').textContent='Thay nền & bố cục';sections[3].querySelector('h2').textContent='Định dạng ảnh';
 const brand=$('brandPanel'),openBrand=$('brandOpen').onclick,groups=[sections[0],sections[1],repair,sections[2],brand,sections[3]],names=['Ảnh','Xóa nền','Tinh chỉnh','Nền ảnh','Logo & chữ','Xuất ảnh'],icons=['▧','◒','✎','▨','T','↓'];
 const oldTabs=aside.querySelector('.editor-tabs'),oldEdit=$('editPanel');oldTabs.hidden=true;
 const heading=document.createElement('div');heading.className='properties-title';const panels=document.createElement('div');panels.className='design-panels';aside.append(heading,panels);groups.forEach(g=>panels.append(g));oldEdit.hidden=true;
 const rail=document.createElement('nav');rail.className='design-rail';rail.setAttribute('aria-label','Công cụ xóa nền');const tabs=document.createElement('div');tabs.className='design-tabs';tabs.setAttribute('role','tablist');rail.append(tabs);main.prepend(rail);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='panel-toggle';toggle.setAttribute('aria-controls',aside.id);rail.append(toggle);
 function collapse(value){main.classList.toggle('panel-collapsed',value);aside.inert=value;toggle.textContent=value?'›':'‹';toggle.title=value?'Mở bảng công cụ':'Thu gọn bảng công cụ';toggle.setAttribute('aria-label',toggle.title);toggle.setAttribute('aria-expanded',String(!value))}
 function select(n,focus=false){collapse(false);if(n===4)openBrand();oldEdit.hidden=true;groups.forEach((g,i)=>{g.hidden=i!==n;tabs.children[i].setAttribute('aria-selected',String(i===n));tabs.children[i].tabIndex=i===n?0:-1});heading.textContent=names[n];if(focus)tabs.children[n].focus()}
 groups.forEach((g,i)=>{g.id||='background-panel-'+i;g.setAttribute('role','tabpanel');g.setAttribute('aria-labelledby','background-tab-'+i);const b=document.createElement('button');b.type='button';b.id='background-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls',g.id);b.innerHTML='<span class="tool-icon" aria-hidden="true">'+icons[i]+'</span><span>'+names[i]+'</span>';b.onclick=()=>select(i);b.onkeydown=e=>{let n;if(['ArrowDown','ArrowRight'].includes(e.key))n=(i+1)%groups.length;if(['ArrowUp','ArrowLeft'].includes(e.key))n=(i+groups.length-1)%groups.length;if(e.key==='Home')n=0;if(e.key==='End')n=groups.length-1;if(n!==undefined){e.preventDefault();select(n,true)}};tabs.append(b)});
 $('brandOpen').onclick=$('brandTab').onclick=()=>select(4);$('editTab').onclick=()=>select(1);toggle.onclick=()=>collapse(!main.classList.contains('panel-collapsed'));select(0);
 const toolbar=document.querySelector('.toolbar');toolbar.className='design-context';toolbar.setAttribute('aria-label','Thao tác ảnh');const replace=document.createElement('button');replace.textContent='Tải / thay ảnh';replace.onclick=()=>$('file').click();toolbar.prepend(replace);
 const quick=document.createElement('button');quick.className='primary';quick.textContent='Xóa nền tự động';quick.onclick=()=>{select(1);$('removeBg').click()};toolbar.append(quick);const undo=document.createElement('button');undo.textContent='↶ Hoàn tác cọ';undo.onclick=()=>$('undo').click();toolbar.append(undo);
 function sync(){quick.disabled=$('removeBg').disabled;undo.disabled=$('undo').disabled}for(const id of ['removeBg','undo'])new MutationObserver(sync).observe($(id),{attributes:true,attributeFilter:['disabled']});sync();
 document.querySelector('.canvas-footer').classList.add('design-bottom');const media=matchMedia('(max-width:760px)'),orient=()=>tabs.setAttribute('aria-orientation',media.matches?'horizontal':'vertical');media.addEventListener('change',orient);orient();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
