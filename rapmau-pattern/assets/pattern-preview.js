'use strict';
(()=>{
 const el=id=>document.getElementById(id),canvas=el('geometryPreview'),ctx=canvas.getContext('2d');
 function preview(){
  ctx.clearRect(0,0,320,180);
  try{
   const type=el('geometryType').value,w=Number(el('geometryWidth').value),h=type==='circle'?w:Number(el('geometryHeight').value);
   if(w>2000||h>2000)throw Error('Kích thước tối đa 2000 mm.');
   const radii=Object.fromEntries(['tl','tr','bl','br'].map(k=>[k,Number(el('radius'+k.toUpperCase()).value)]));
   const g=globalThis.patternGeometry.geometry(type,w,h,radii),s=Math.min(260/w,120/h),x=(320-w*s)/2,y=(150-h*s)/2;
   ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.beginPath();ctx.moveTo(g.points[0].x,g.points[0].y);
   g.points.forEach((p,i)=>{const j=(i+1)%g.points.length,q=g.points[j],a=g.handles[i].out,b=g.handles[j].in;ctx.bezierCurveTo(p.x+a.x,p.y+a.y,q.x+b.x,q.y+b.y,q.x,q.y)});
   ctx.closePath();ctx.fillStyle='#c5dfce';ctx.fill();ctx.lineWidth=1.5/s;ctx.strokeStyle='#145335';ctx.stroke();ctx.restore();
   ctx.fillStyle='#145335';ctx.font='13px Arial';ctx.textAlign='center';ctx.fillText(`${w} × ${h} mm`,160,169);
   el('geometryPreviewInfo').textContent='Xem trước theo tỷ lệ · nhập mm thực tế. Cập nhật sẽ dựng lại hình theo thông số, thay các điểm đã sửa tay.';
  }catch(e){el('geometryPreviewInfo').textContent=e.message}
 }
 el('geometryPanel').addEventListener('input',preview);
 el('geometryPanel').addEventListener('change',preview);
 new MutationObserver(preview).observe(el('geometryPanel'),{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('pointerup',()=>{if(!el('geometryPanel').hidden)preview()});
 preview();
})();
