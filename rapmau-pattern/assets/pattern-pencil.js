'use strict';
globalThis.patternPencil={fit(input,tolerance,closed=false){
 const raw=input.filter((p,i)=>!i||Math.hypot(p.x-input[i-1].x,p.y-input[i-1].y)>1e-6).map(p=>({...p}));
 if(closed&&raw.length>3)raw.pop();
 if(raw.length<2)return {points:raw,handles:raw.map(()=>({in:{x:0,y:0},out:{x:0,y:0},linked:true}))};
 const keep=new Set([0,raw.length-1]),stack=[[0,raw.length-1]];
 while(stack.length){const [a,b]=stack.pop();let max=tolerance,index=-1;for(let i=a+1;i<b;i++){const d=globalThis.patternCore.distancePointToSegment(raw[i],raw[a],raw[b]);if(d>max){max=d;index=i}}if(index>=0){keep.add(index);stack.push([a,index],[index,b])}}
 let points=[...keep].sort((a,b)=>a-b).map(i=>raw[i]);
 if(closed&&points.length<3)points=raw;
 const handles=points.map((p,i)=>{const prev=points[(i-1+points.length)%points.length],next=points[(i+1)%points.length];if(!closed&&(i===0||i===points.length-1))return {in:{x:0,y:0},out:{x:0,y:0},linked:true};const dx=(next.x-prev.x)/6,dy=(next.y-prev.y)/6,len=Math.hypot(dx,dy),limit=Math.min(Math.hypot(p.x-prev.x,p.y-prev.y),Math.hypot(next.x-p.x,next.y-p.y))/3,f=len?Math.min(1,limit/len):0;return {in:{x:-dx*f,y:-dy*f},out:{x:dx*f,y:dy*f},linked:true}});
 return {points,handles};
}};
