(()=>{
 function init(){
 const main=document.querySelector('main'),aside=main.querySelector('aside'),preview=main.querySelector('article'),header=document.querySelector('body>header');
 main.classList.add('design-layout');aside.className='design-properties';aside.id='designProperties';preview.classList.add('workspace');
 const title=aside.querySelector('h1');title.className='design-name';header.append(title);
 const groups=[...aside.querySelectorAll(':scope>section')];groups[0].insertAdjacentHTML('afterbegin','<h2>Ảnh sản phẩm</h2>');groups[1].querySelector('h2').textContent='Chất lượng & kích thước';groups[2].querySelector('h2').textContent='Kết quả nén';
 const compress=document.getElementById('compress');compress.remove();compress.classList.remove('full-button');
 const heading=document.createElement('div');heading.className='properties-title';const panels=document.createElement('div');panels.className='design-panels';aside.replaceChildren(heading,panels);
 const rail=document.createElement('nav');rail.className='design-rail';rail.setAttribute('aria-label','Công cụ nén ảnh');const tabs=document.createElement('div');tabs.className='design-tabs';tabs.setAttribute('role','tablist');rail.append(tabs);main.prepend(rail);
 const names=['Ảnh','Thiết lập','Kết quả'],icons=['▧','☷','▥'];const toggle=document.createElement('button');toggle.type='button';toggle.className='panel-toggle';toggle.setAttribute('aria-controls',aside.id);rail.append(toggle);
 function collapse(value){main.classList.toggle('panel-collapsed',value);aside.inert=value;toggle.textContent=value?'›':'‹';toggle.title=value?'Mở bảng công cụ':'Thu gọn bảng công cụ';toggle.setAttribute('aria-label',toggle.title);toggle.setAttribute('aria-expanded',String(!value))}
 function select(index,focus=false){collapse(false);groups.forEach((section,i)=>{section.hidden=i!==index;tabs.children[i].setAttribute('aria-selected',String(i===index));tabs.children[i].tabIndex=i===index?0:-1});heading.textContent=names[index];if(focus)tabs.children[index].focus()}
 groups.forEach((section,i)=>{section.id='compress-panel-'+i;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','compress-tab-'+i);panels.append(section);const button=document.createElement('button');button.type='button';button.id='compress-tab-'+i;button.setAttribute('role','tab');button.setAttribute('aria-controls',section.id);button.innerHTML='<span class="tool-icon" aria-hidden="true">'+icons[i]+'</span><span>'+names[i]+'</span>';button.onclick=()=>select(i);button.onkeydown=e=>{let n;if(['ArrowDown','ArrowRight'].includes(e.key))n=(i+1)%3;if(['ArrowUp','ArrowLeft'].includes(e.key))n=(i+2)%3;if(e.key==='Home')n=0;if(e.key==='End')n=2;if(n!==undefined){e.preventDefault();select(n,true)}};tabs.append(button)});
 toggle.onclick=()=>collapse(!main.classList.contains('panel-collapsed'));select(0);
 const toolbar=document.querySelector('.toolbar');toolbar.className='design-context';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Thao tác nén ảnh');toolbar.append(compress);
 const replace=document.createElement('button');replace.type='button';replace.textContent='Tải / thay ảnh';replace.onclick=()=>document.getElementById('file').click();toolbar.append(replace);
 const result=document.createElement('button');result.type='button';result.textContent='Xem dung lượng';result.onclick=()=>select(2);toolbar.append(result);
 const footer=document.querySelector('.canvas-footer');footer.classList.add('design-bottom');footer.append(document.getElementById('dimensions'));
 // Download the exact compressed result, without an additional encoding step.
 const download=document.getElementById('download');download.style.display='';header.querySelector('.studio-export')?.remove();header.append(download);
 const summary=document.createElement('p');summary.className='compression-summary';summary.setAttribute('aria-live','polite');preview.insertBefore(summary,document.getElementById('stage'));
 const metrics=document.getElementById('metrics');function sync(){summary.textContent=metrics.textContent;result.disabled=document.getElementById('compress').disabled;}
 new MutationObserver(sync).observe(metrics,{childList:true,subtree:true,characterData:true});sync();
 const media=matchMedia('(max-width:760px)'),orient=()=>tabs.setAttribute('aria-orientation',media.matches?'horizontal':'vertical');media.addEventListener('change',orient);orient();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
