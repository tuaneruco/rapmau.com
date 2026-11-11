'use strict';
(function(root){
 const k=4*(Math.sqrt(2)-1)/3;
 const zero=()=>({x:0,y:0});
 function geometry(type,width,height,radii={}){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw Error('Nhập chiều rộng và chiều cao lớn hơn 1 mm.');
  if(type==='circle'){height=width}
  if(type==='ellipse'||type==='circle'){
   const rx=width/2,ry=height/2;
   const points=[{x:rx,y:0},{x:width,y:ry},{x:rx,y:height},{x:0,y:ry}];
   const handles=[{in:{x:-k*rx,y:0},out:{x:k*rx,y:0}},{in:{x:0,y:-k*ry},out:{x:0,y:k*ry}},{in:{x:k*rx,y:0},out:{x:-k*rx,y:0}},{in:{x:0,y:k*ry},out:{x:0,y:-k*ry}}].map(h=>({...h,linked:true}));
   return {points,handles,width,height};
  }
  if(type==='triangle'){
   const points=[{x:width/2,y:0},{x:width,y:height},{x:0,y:height}];
   return {points,handles:points.map(()=>({in:zero(),out:zero(),linked:false})),width,height};
  }
  if(type==='pentagon'||type==='star'||type==='heart'){
   let points;
   if(type==='heart'){
    const samples=48,curve=Array.from({length:samples},(_,i)=>{const t=i*2*Math.PI/samples;return {x:16*Math.sin(t)**3,y:13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)}}),bounds={minX:Math.min(...curve.map(p=>p.x)),maxX:Math.max(...curve.map(p=>p.x)),minY:Math.min(...curve.map(p=>p.y)),maxY:Math.max(...curve.map(p=>p.y))};points=curve.map(p=>({x:(p.x-bounds.minX)/(bounds.maxX-bounds.minX)*width,y:(bounds.maxY-p.y)/(bounds.maxY-bounds.minY)*height}));
   }else{const count=type==='star'?10:5,unit=Array.from({length:count},(_,i)=>{const angle=-Math.PI/2+i*2*Math.PI/count,r=type==='star'&&i%2?.42:1;return {x:r*Math.cos(angle),y:r*Math.sin(angle)}}),minX=Math.min(...unit.map(p=>p.x)),maxX=Math.max(...unit.map(p=>p.x)),minY=Math.min(...unit.map(p=>p.y)),maxY=Math.max(...unit.map(p=>p.y));points=unit.map(p=>({x:(p.x-minX)/(maxX-minX)*width,y:(p.y-minY)/(maxY-minY)*height}))}
   return {points,handles:points.map(()=>({in:zero(),out:zero(),linked:false})),width,height};
  }
  if(type==='diamond'||type==='trapezoid'||type==='hexagon'){
   const points=type==='diamond'?[{x:width/2,y:0},{x:width,y:height/2},{x:width/2,y:height},{x:0,y:height/2}]:type==='trapezoid'?[{x:width/4,y:0},{x:width*3/4,y:0},{x:width,y:height},{x:0,y:height}]:[{x:width/4,y:0},{x:width*3/4,y:0},{x:width,y:height/2},{x:width*3/4,y:height},{x:width/4,y:height},{x:0,y:height/2}];
   return {points,handles:points.map(()=>({in:zero(),out:zero(),linked:false})),width,height};
  }
  if(type!=='rectangle')throw Error('Hình học không hợp lệ.');
  const [tl,tr,br,bl]=['tl','tr','br','bl'].map(key=>Number(radii[key]||0));
  if([tl,tr,br,bl].some(r=>!Number.isFinite(r)||r<0))throw Error('Bán kính bo góc phải lớn hơn hoặc bằng 0 mm.');
  if(tl+tr>width||bl+br>width||tl+bl>height||tr+br>height)throw Error('Hai góc kề nhau vượt chiều dài cạnh. Hãy giảm bán kính bo góc.');
  const list=[
   [{x:tl,y:0},{x:-k*tl,y:0},zero()],
   [{x:width-tr,y:0},zero(),{x:k*tr,y:0}],
   [{x:width,y:tr},{x:0,y:-k*tr},zero()],
   [{x:width,y:height-br},zero(),{x:0,y:k*br}],
   [{x:width-br,y:height},{x:k*br,y:0},zero()],
   [{x:bl,y:height},zero(),{x:-k*bl,y:0}],
   [{x:0,y:height-bl},{x:0,y:k*bl},zero()],
   [{x:0,y:tl},zero(),{x:0,y:-k*tl}]
  ];
  const points=[],handles=[];
  for(const [point,input,output] of list){const last=points.at(-1);if(last&&Math.hypot(last.x-point.x,last.y-point.y)<1e-7){handles.at(-1).out=output;continue}points.push(point);handles.push({in:input,out:output,linked:false})}
  if(points.length>1&&Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)<1e-7){handles[0].in=handles.at(-1).in;points.pop();handles.pop()}
  return {points,handles,width,height};
 }
 root.patternGeometry={geometry};
})(globalThis);
