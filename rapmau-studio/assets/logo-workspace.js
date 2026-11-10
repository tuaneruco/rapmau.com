(()=>{
 function init(){
  const main=document.querySelector('main'),aside=document.querySelector('main>aside'),preview=document.querySelector('main>article'),header=document.querySelector('body>header');
  main.classList.add('design-layout');aside.className='design-properties';aside.id='designProperties';preview.classList.add('workspace');
  const sections=[...aside.querySelectorAll(':scope>section')],source=sections[0],material=sections[1],placement=sections[2];
  const photo=document.createElement('section');photo.innerHTML='<h2>Ảnh sản phẩm</h2><p class="hint">Tải ảnh da rõ nét để mô phỏng dấu dập trực tiếp trên sản phẩm.</p>';photo.append(source.querySelector('.upload'),document.getElementById('photoName'));
  const logo=document.createElement('section');logo.innerHTML='<h2>Logo & thương hiệu</h2>';logo.append(source.querySelector('.logo-row'),source.querySelector('.check'));
  const brand=header.querySelector('[data-brand-manager-open]');if(brand)logo.append(brand);
  const text=document.createElement('section');text.innerHTML='<h2>Chữ dập chìm</h2>';text.append(source.querySelector('.text-editor'));
  material.querySelector('h2').textContent='Chất liệu & hiệu ứng';placement.querySelector('h2').textContent='Vị trí & phối cảnh';
  const reset=document.getElementById('reset');placement.append(reset);
  const visibility=document.getElementById('toggleLogoPreview'),deleteButton=document.getElementById('deleteLogo');
  const heading=document.createElement('div');heading.className='properties-title';const panels=document.createElement('div');panels.className='design-panels';aside.replaceChildren(heading,panels);
  const rail=document.createElement('nav');rail.className='design-rail';rail.setAttribute('aria-label','Công cụ in chìm logo');const tabs=document.createElement('div');tabs.className='design-tabs';tabs.setAttribute('role','tablist');rail.append(tabs);main.prepend(rail);
  const groups=[['Ảnh','▧',photo],['Logo','◇',logo],['Chữ','T',text],['Chất liệu','▦',material],['Vị trí','⌖',placement]];
  const toggle=document.createElement('button');toggle.type='button';toggle.className='panel-toggle';toggle.setAttribute('aria-controls',aside.id);rail.append(toggle);
  function collapse(value){main.classList.toggle('panel-collapsed',value);aside.inert=value;toggle.textContent=value?'›':'‹';toggle.title=value?'Mở bảng công cụ':'Thu gọn bảng công cụ';toggle.setAttribute('aria-label',toggle.title);toggle.setAttribute('aria-expanded',String(!value))}
  function select(index,focus=false){collapse(false);groups.forEach(([name,icon,section],i)=>{section.hidden=i!==index;tabs.children[i].setAttribute('aria-selected',String(i===index));tabs.children[i].tabIndex=i===index?0:-1});heading.textContent=groups[index][0];if(focus)tabs.children[index].focus()}
  groups.forEach(([name,icon,section],i)=>{section.id='logo-panel-'+i;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','logo-tab-'+i);panels.append(section);const button=document.createElement('button');button.type='button';button.id='logo-tab-'+i;button.setAttribute('role','tab');button.setAttribute('aria-controls',section.id);button.innerHTML='<span class="tool-icon" aria-hidden="true">'+icon+'</span><span>'+name+'</span>';button.onclick=()=>select(i);button.onkeydown=e=>{let n;if(['ArrowDown','ArrowRight'].includes(e.key))n=(i+1)%5;if(['ArrowUp','ArrowLeft'].includes(e.key))n=(i+4)%5;if(e.key==='Home')n=0;if(e.key==='End')n=4;if(n!==undefined){e.preventDefault();select(n,true)}};tabs.append(button)});
  toggle.onclick=()=>collapse(!main.classList.contains('panel-collapsed'));select(0);
  const name=document.createElement('h1');name.className='design-name';name.textContent='In chìm logo';header.append(name);
  const toolbar=preview.querySelector('.toolbar'),context=document.createElement('div');context.className='design-context';context.setAttribute('role','toolbar');context.setAttribute('aria-label','Thao tác ảnh');
  const caption=document.createElement('span');caption.className='selection-label';caption.append(document.getElementById('title'));context.append(caption,document.getElementById('compare'),visibility,deleteButton);
  const position=document.createElement('button');position.type='button';position.textContent='Vị trí & phối cảnh';position.onclick=()=>select(4);context.append(position);
  const footer=document.querySelector('.canvas-footer');footer.classList.add('design-bottom');const zoom=document.createElement('div');zoom.className='logo-zoom';const label=document.createElement('label');label.htmlFor='zoom';label.textContent='Thu phóng';zoom.append(label,document.getElementById('zoom'));
  footer.append(document.getElementById('size'),zoom);toolbar.replaceWith(context);
  const media=matchMedia('(max-width:760px)'),orient=()=>tabs.setAttribute('aria-orientation',media.matches?'horizontal':'vertical');media.addEventListener('change',orient);orient();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
