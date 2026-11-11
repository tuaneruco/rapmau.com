'use strict';
// One active pointer per canvas prevents a palm from moving or ending a pen stroke.
for(const id of ['draft','paperPreview']){
 const surface=document.getElementById(id);let pointer=null;
 const block=e=>{e.preventDefault();e.stopImmediatePropagation()};
 surface.style.touchAction='none';surface.style.userSelect='none';surface.style.webkitUserSelect='none';
 surface.addEventListener('pointerdown',e=>{
  if((document.getElementById('stylusOnly').checked&&e.pointerType==='touch')||pointer!==null){block(e);return}
  pointer=e.pointerId;
  if(e.pointerType==='pen')document.getElementById('stylusStatus').textContent='Đã nhận bút · vẽ nét mảnh để làm rập';
 },{capture:true,passive:false});
 surface.addEventListener('pointermove',e=>{if((pointer!==null&&e.pointerId!==pointer)||(document.getElementById('stylusOnly').checked&&e.pointerType==='touch'))block(e)},{capture:true,passive:false});
 for(const name of ['pointerup','pointercancel'])surface.addEventListener(name,e=>{if(e.pointerId!==pointer){block(e);return}pointer=null},{capture:true,passive:false});
 surface.addEventListener('lostpointercapture',e=>{if(pointer===e.pointerId){surface.dispatchEvent(new PointerEvent('pointercancel',{pointerId:e.pointerId,pointerType:e.pointerType,bubbles:true}));pointer=null}});
 // A click on the ruler does not capture; release outside must not leave a lock.
 window.addEventListener('pointerup',e=>{if(pointer===e.pointerId&&!surface.hasPointerCapture(e.pointerId)&&e.target!==surface)pointer=null});
}
