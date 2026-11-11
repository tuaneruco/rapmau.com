'use strict';
(function(root){
 function layout(pieces,pxPerMm,allowance,orientation,placements={},paperSize='A0'){
  if(!(pxPerMm>0))throw Error('Cần đặt tỷ lệ mm trước khi xuất.');
  const sheets={A4:[297,210],A3:[420,297],A2:[594,420],A1:[841,594],A0:[1189,841]},dimensions=sheets[paperSize];
  if(!dimensions)throw Error('Khổ giấy không hợp lệ.');
  const width=orientation==='landscape'?dimensions[0]:dimensions[1],height=orientation==='landscape'?dimensions[1]:dimensions[0];
  const margin=paperSize==='A0'?20:10,gap=paperSize==='A0'?16:8,out=[];let x=margin,y=margin,rowHeight=0;
  for(const item of pieces.filter(p=>p.points.length>=3).slice().sort((a,b)=>{const ha=Math.max(...a.points.map(p=>p.y))-Math.min(...a.points.map(p=>p.y)),hb=Math.max(...b.points.map(p=>p.y))-Math.min(...b.points.map(p=>p.y));return hb-ha||String(a.name).localeCompare(String(b.name))})){
   const contour=root.patternCore.sampleCurve(item.points,item.handles,Math.max(1,pxPerMm*.35)),minX=Math.min(...contour.map(p=>p.x)),maxX=Math.max(...contour.map(p=>p.x)),minY=Math.min(...contour.map(p=>p.y)),maxY=Math.max(...contour.map(p=>p.y));
   const bodyW=(maxX-minX)/pxPerMm,bodyH=(maxY-minY)/pxPerMm,pad=allowance+5,boxW=bodyW+pad*2,boxH=bodyH+pad*2+12;
   if(boxW>width-margin*2||boxH>height-margin*2)throw Error(`“${item.name}” vượt khổ ${paperSize} ${width} × ${height} mm. Hãy đổi chiều giấy hoặc tách chi tiết.`);
   if(x+boxW>width-margin){x=margin;y+=rowHeight+gap;rowHeight=0}
   if(y+boxH>height-margin)throw Error(`Các chi tiết chưa xếp đủ trong một tờ ${paperSize}. Hãy chọn khổ lớn hơn, đổi chiều giấy hoặc chia bản vẽ.`);
   const local=p=>({x:(p.x-minX)/pxPerMm+x+pad,y:(p.y-minY)/pxPerMm+y+pad});
   out.push({production:item.production,lineRole:item.lineRole,sourceIndex:item.sourceIndex,name:item.name,quantity:item.quantity,main:contour.map(local),curve:{points:item.points.map(local),handles:item.handles||[]},seam:allowance?root.patternCore.offset(contour,allowance*pxPerMm).map(local):[],notches:item.notches.map(local),holes:item.holes.map(p=>({...local(p),diameter:p.diameter})),folds:item.folds.filter(l=>l.points.length>=2).map(l=>l.points.map(local)),stitches:item.stitches.filter(l=>l.points.length>=2).map(l=>l.points.map(local)),label:{x:x+pad,y:y+boxH-5},dimensions:{x:x+pad,y:y+pad,width:bodyW,height:bodyH}});
   x+=boxW+gap;rowHeight=Math.max(rowHeight,boxH);
  }
  for(const item of out){const move=placements[item.sourceIndex]||{x:0,y:0},dx=Number(move.x)||0,dy=Number(move.y)||0;if(!dx&&!dy)continue;const shift=p=>{p.x+=dx;p.y+=dy};for(const list of [item.main,item.curve.points,item.seam,item.notches,item.holes,...item.folds,...item.stitches])list.forEach(shift);shift(item.label);shift(item.dimensions)}
  if(!out.length)throw Error('Cần ít nhất 3 điểm cho một chi tiết.');
  return {width,height,paperSize,pieces:out};
 }
 function appendPlacements(base,previous){
  const placements={},occupied=[],box=(p,dx=0,dy=0)=>({x:p.dimensions.x+dx,y:p.dimensions.y+dy,w:p.dimensions.width,h:p.dimensions.height});
  const intersects=(a,b)=>a.x<b.x+b.w+8&&a.x+a.w+8>b.x&&a.y<b.y+b.h+8&&a.y+a.h+8>b.y;
  for(const old of previous.pieces){const next=base.pieces.find(p=>p.sourceIndex===old.sourceIndex);if(!next)continue;const move={x:old.dimensions.x-next.dimensions.x,y:old.dimensions.y-next.dimensions.y};placements[next.sourceIndex]=move;occupied.push(box(next,move.x,move.y))}
  for(const next of base.pieces){if(placements[next.sourceIndex])continue;let target=box(next),found=false;
   if(!occupied.some(b=>intersects(target,b)))found=true;
   else for(let y=15;y+target.h+15<=base.height&&!found;y+=5)for(let x=15;x+target.w+15<=base.width;x+=5){const candidate={...target,x,y};if(!occupied.some(b=>intersects(candidate,b))){target=candidate;found=true;break}}
   if(!found)throw Error('Không còn vùng trống đủ lớn. Di chuyển các chi tiết cũ hoặc chọn khổ giấy lớn hơn; trang hiện tại được giữ nguyên.');
   placements[next.sourceIndex]={x:target.x-next.dimensions.x,y:target.y-next.dimensions.y};occupied.push(target)
  }return placements
 }
 function mergeStaged(staged,updates,scale){const selected=new Set(updates.map(p=>p.sourceIndex)),retained=JSON.parse(JSON.stringify(staged?.pieces||[])).filter(p=>!selected.has(p.sourceIndex));const factor=scale/(staged?.scale||scale);for(const p of retained){const point=q=>{q.x*=factor;q.y*=factor};p.points.forEach(point);for(const h of p.handles||[]){point(h.in);point(h.out)}for(const q of [...(p.notches||[]),...(p.holes||[]),...(p.folds||[]).flatMap(l=>l.points),...(p.stitches||[]).flatMap(l=>l.points)])point(q)}return [...retained,...updates]}
 function sameBounds(a,b){const intersection=Math.max(0,Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX))*Math.max(0,Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY));return intersection/((a.maxX-a.minX)*(a.maxY-a.minY)+(b.maxX-b.minX)*(b.maxY-b.minY)-intersection)>.85}
 function moveVertex(staged,index,vertex,next,originalSheet,originalBounds){const copy=JSON.parse(JSON.stringify(staged)),item=copy.pieces.find(p=>p.sourceIndex===index);if(!item||!item.points[vertex]||![next.x,next.y].every(Number.isFinite))throw Error('Điểm chỉnh sửa không hợp lệ.');item.points[vertex]={...next};const bounds=root.patternCore.bounds(root.patternCore.sampleCurve(item.points,item.handles));const target=JSON.parse(JSON.stringify(originalSheet)),edited=target.pieces.find(p=>p.sourceIndex===index);edited.dimensions.x+=(bounds.minX-originalBounds.minX)/copy.scale;edited.dimensions.y+=(bounds.minY-originalBounds.minY)/copy.scale;const base=layout(copy.pieces,copy.scale,copy.allowance,copy.layoutOrientation||copy.orientation,{},copy.layoutSize||copy.paperSize);copy.placements=appendPlacements(base,target);return copy}
 root.patternLayout={layout,appendPlacements,mergeStaged,sameBounds,moveVertex};
})(globalThis);
