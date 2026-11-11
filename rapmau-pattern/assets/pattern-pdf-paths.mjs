// Extract closed paths from PDF.js operator lists. Coordinates are returned in the
// same pixel space as the page viewport, so they can be edited on the draft canvas.
export function extractVectorContours(operatorList, OPS, viewport, limit=24){
 const contours=[],fragments=[],stack=[];let matrix=[1,0,0,1,0,0];
 const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 const point=(x,y)=>{const tx=matrix[0]*x+matrix[2]*y+matrix[4],ty=matrix[1]*x+matrix[3]*y+matrix[5],mapped=viewport.convertToViewportPoint(tx,ty);return {x:mapped[0],y:mapped[1]}};
 const blank=()=>({in:{x:0,y:0},out:{x:0,y:0},linked:false});
 for(let index=0;index<operatorList.fnArray.length;index++){
  const fn=operatorList.fnArray[index],args=operatorList.argsArray[index];
  if(fn===OPS.save){stack.push(matrix.slice());continue}
  if(fn===OPS.restore){matrix=stack.pop()||[1,0,0,1,0,0];continue}
  if(fn===OPS.transform){matrix=multiply(matrix,args);continue}
  if(fn!==OPS.constructPath||!args||args[0]===OPS.endPath)continue;
  for(const data of args[1]||[]){if(!data?.length)continue;let points=[],handles=[],offset=0;
   const finish=forceClosed=>{const repeatsStart=points.length>2&&Math.hypot(points.at(-1).x-points[0].x,points.at(-1).y-points[0].y)<.5;if(repeatsStart){handles[0].in=handles.at(-1).in;points.pop();handles.pop()}if(!forceClosed&&!repeatsStart){if(points.length>=2)fragments.push({points,handles});points=[];handles=[];return}if(points.length<3){points=[];handles=[];return}const xs=points.map(p=>p.x),ys=points.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);if(w>=8&&h>=8&&w<viewport.width*.99&&h<viewport.height*.99&&contours.length<limit*3)contours.push({points,handles});points=[];handles=[]};
   while(offset<data.length){const op=data[offset++];
    if(op===0){if(points.length)finish(false);points.push(point(data[offset++],data[offset++]));handles.push(blank())}
    else if(op===1){points.push(point(data[offset++],data[offset++]));handles.push(blank())}
    else if(op===2){const c1=point(data[offset++],data[offset++]),c2=point(data[offset++],data[offset++]),end=point(data[offset++],data[offset++]);if(!points.length)continue;const prev=points.at(-1);handles.at(-1).out={x:c1.x-prev.x,y:c1.y-prev.y};const first=points[0];if(Math.hypot(end.x-first.x,end.y-first.y)<.5&&points.length>=3){handles[0].in={x:c2.x-first.x,y:c2.y-first.y}}else{points.push(end);const h=blank();h.in={x:c2.x-end.x,y:c2.y-end.y};handles.push(h)}}
    else if(op===4){finish(true)}
    else if(op===3){const x=data[offset++],y=data[offset++],w=data[offset++],h=data[offset++];if(points.length)finish(false);points=[point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)];handles=points.map(blank);finish(true)}
    else break;
   }
   // Filled paths may close implicitly. Open strokes remain an image reference.
   if(points.length>=2)finish([OPS.fill,OPS.eoFill,OPS.fillStroke,OPS.eoFillStroke].includes(args[0]));
  }
 }
 // CAD exporters often paint every edge separately. Join only matching endpoints;
 // never close arbitrary open lines across the product.
 const tolerance=.75,near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;
 const reverse=path=>({points:path.points.slice().reverse(),handles:path.handles.slice().reverse().map(h=>({...h,in:h.out,out:h.in}))});
 while(fragments.length){let chain=fragments.pop(),changed=true;
  while(changed&&!near(chain.points[0],chain.points.at(-1))){changed=false;
   for(let i=0;i<fragments.length;i++){let candidate=fragments[i];
    if(near(chain.points.at(-1),candidate.points.at(-1)))candidate=reverse(candidate);
    if(near(chain.points.at(-1),candidate.points[0])){chain.handles.at(-1).out=candidate.handles[0].out;chain.points.push(...candidate.points.slice(1));chain.handles.push(...candidate.handles.slice(1));fragments.splice(i,1);changed=true;break}
    if(near(chain.points[0],candidate.points[0]))candidate=reverse(candidate);
    if(near(candidate.points.at(-1),chain.points[0])){candidate.handles.at(-1).out=chain.handles[0].out;chain={points:[...candidate.points,...chain.points.slice(1)],handles:[...candidate.handles,...chain.handles.slice(1)]};fragments.splice(i,1);changed=true;break}
   }
  }
  if(chain.points.length>=4&&near(chain.points[0],chain.points.at(-1))){chain.handles[0].in=chain.handles.at(-1).in;chain.points.pop();chain.handles.pop();const xs=chain.points.map(p=>p.x),ys=chain.points.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);if(w>=8&&h>=8&&!(w>viewport.width*.98&&h>viewport.height*.98))contours.push(chain)}
 }
 return contours.sort((a,b)=>{const area=p=>Math.abs(p.points.reduce((v,q,i)=>{const r=p.points[(i+1)%p.points.length];return v+q.x*r.y-r.x*q.y},0));return area(b)-area(a)}).slice(0,limit);
}
