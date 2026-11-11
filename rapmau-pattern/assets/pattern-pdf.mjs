import * as pdfjs from './vendor/pdfjs/pdf.mjs';
import {extractVectorContours} from './pattern-pdf-paths.mjs';

pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
const byId=id=>document.getElementById(id),core=globalThis.patternCore;
let documentRef=null,loadingTask=null,fileName='',loading=false,openGeneration=0,scanGeneration=0;
const say=message=>{byId('pdfStatus').textContent=message};

globalThis.patternOpenPdf=async file=>{
 if(!file)return;
 const generation=++openGeneration;++scanGeneration;loading=false;
 const previousTask=loadingTask;loadingTask=null;documentRef=null;fileName='';
 byId('pdfOptions').hidden=true;byId('scanPdf').disabled=true;
 say('Đang mở PDF mới…');
 try{
  try{await previousTask?.destroy()}catch(error){console.warn('Không thể đóng PDF cũ; tiếp tục mở bản mới.',error)}
  if(file.size>25*1024*1024)throw Error('PDF vượt quá 25 MB. Hãy giảm dung lượng file rồi thử lại.');
  const data=new Uint8Array(await file.arrayBuffer());if(generation!==openGeneration)return;
  const task=pdfjs.getDocument({data,isEvalSupported:false,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href});loadingTask=task;
  const next=await task.promise;if(generation!==openGeneration){await task.destroy();return}
  if(next.numPages>100)throw Error('PDF có hơn 100 trang. Hãy tách trang bản vẽ cần dùng.');
  globalThis.patternHost.resetPdfImport(file.name);
  documentRef=next;fileName=file.name;
  byId('pdfPage').replaceChildren(...Array.from({length:next.numPages},(_,i)=>{const option=document.createElement('option');option.value=String(i+1);option.textContent=`Trang ${i+1}`;return option}));
  byId('pdfOptions').hidden=false;byId('scanPdf').disabled=false;
  say(next.numPages===1?`Đã mở ${file.name}. Đang tự nhận diện trang 1…`:`Đã mở ${file.name} · ${next.numPages} trang. Chọn trang rồi bấm “Nhận diện đường vẽ PDF”.`);
  if(next.numPages===1)queueMicrotask(()=>{if(generation===openGeneration)byId('scanPdf').click()})
 }catch(error){if(generation===openGeneration){documentRef=null;await loadingTask?.destroy().catch(()=>{});loadingTask=null;say(`Không đọc được PDF: ${error?.message||'file không hợp lệ'}`)}}finally{byId('pdfFile').value=''}
};
byId('pdfFile').addEventListener('change',event=>globalThis.patternOpenPdf(event.target.files?.[0]));

function rasterContours(canvas){
 const context=canvas.getContext('2d',{willReadFrequently:true}),pixels=context.getImageData(0,0,canvas.width,canvas.height),threshold=Number(byId('threshold').value),loops=core.traceAllPixels(pixels.data,canvas.width,canvas.height,threshold),accepted=[];
 for(const loop of loops){const b=core.bounds(loop),w=b.maxX-b.minX,h=b.maxY-b.minY,a=Math.abs(core.area(loop));if(w<20||h<20||a<canvas.width*canvas.height*.00025||w>canvas.width*.98&&h>canvas.height*.98)continue;
  const duplicate=accepted.some(entry=>{const q=entry.bounds,intersection=Math.max(0,Math.min(b.maxX,q.maxX)-Math.max(b.minX,q.minX))*Math.max(0,Math.min(b.maxY,q.maxY)-Math.max(b.minY,q.minY)),union=w*h+(q.maxX-q.minX)*(q.maxY-q.minY)-intersection;return intersection/union>.82});if(duplicate)continue;
  let points=core.simplify(loop,Math.max(1.5,Math.min(w,h)/350));if(points.length>80)points=core.adjustCount(points,80);accepted.push({points,handles:[],rawContour:loop,bounds:b});if(accepted.length>=20)break
 }
 return accepted.map(({points,handles,rawContour})=>({points,handles,rawContour}));
}

byId('scanPdf').addEventListener('click',async()=>{
 if(!documentRef||loading)return;const generation=openGeneration,token=++scanGeneration,documentToScan=documentRef,nameToScan=fileName;loading=true;byId('scanPdf').disabled=true;say('Đang đọc đường vẽ và tạo ảnh tham chiếu…');
 try{
  const pageNumber=Number(byId('pdfPage').value),page=await documentToScan.getPage(pageNumber),base=page.getViewport({scale:1}),scale=Math.min(3,2000/Math.max(base.width,base.height)),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);if(canvas.width*canvas.height>16e6)throw Error('Trang PDF quá lớn để xử lý. Hãy xuất riêng trang ở độ phân giải thấp hơn.');
  const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:context,viewport,canvas}).promise;
  let contours=[];try{const operators=await page.getOperatorList();contours=extractVectorContours(operators,pdfjs.OPS,viewport).filter(p=>p.points.length>=3)}catch(error){console.warn('Không đọc được đường vector; dùng nhận diện ảnh trang PDF.',error)}
  const source=contours.length?'vector':'scan';
  // Supplement even when a few small vector paths exist. Keep exact vector
  // geometry when the scan finds the same outline.
  for(const candidate of rasterContours(canvas)){
   const b=core.bounds(candidate.points),area=(b.maxX-b.minX)*(b.maxY-b.minY);
   const duplicate=contours.some(existing=>{const q=core.bounds(existing.points),qa=(q.maxX-q.minX)*(q.maxY-q.minY),intersection=Math.max(0,Math.min(b.maxX,q.maxX)-Math.max(b.minX,q.minX))*Math.max(0,Math.min(b.maxY,q.maxY)-Math.max(b.minY,q.minY));return intersection/(area+qa-intersection)>.8});
   if(!duplicate)contours.push(candidate);
  }
  contours.sort((a,b)=>Math.abs(core.area(b.points))-Math.abs(core.area(a.points)));
  const content=await page.getTextContent(),counts=new Map();
  for(const item of content.items)if(item.str?.trim())counts.set(item.str.trim(),(counts.get(item.str.trim())||0)+1);
  const texts=content.items.filter(item=>item.str?.trim()&&item.transform).slice(0,500).map(item=>{
   const [a,b,c,d,x,y]=item.transform,origin=viewport.convertToViewportPoint(x,y),height=Math.max(4,Math.hypot(a,b)*scale),angle=-Math.atan2(b,a)*180/Math.PI;
   const width=Math.max(4,Math.abs(item.width||item.str.length*height/scale*.5)*scale),font=content.styles[item.fontName]?.fontFamily||'Arial',horizontal=Math.hypot(a,b)||1,vertical=Math.hypot(c,d)||horizontal;
   const advance=Math.abs(item.width||width/scale),rise=Math.abs(item.height||horizontal),ux=a/horizontal,uy=b/horizontal,vx=vertical?c/vertical:-uy,vy=vertical?d/vertical:ux;
   const quad=[[x,y],[x+ux*advance,y+uy*advance],[x+ux*advance+vx*rise,y+uy*advance+vy*rise],[x+vx*rise,y+vy*rise]].map(([px,py])=>{const [qx,qy]=viewport.convertToViewportPoint(px,py);return {x:qx,y:qy}});
   const left=Math.min(...quad.map(q=>q.x)),top=Math.min(...quad.map(q=>q.y)),right=Math.max(...quad.map(q=>q.x)),bottom=Math.max(...quad.map(q=>q.y));
   return {text:item.str.trim(),x:left,y:top,width:Math.max(4,right-left),height:Math.max(4,bottom-top),quad,angle,font,watermark:Math.abs(angle)>12||height>canvas.height*.055||(counts.get(item.str.trim())||0)>=3||/www\.|https?:\/\/|[a-z0-9-]+\.(?:com|vn|net|org)\b/i.test(item.str)};
  });
  if(generation!==openGeneration||token!==scanGeneration)return;
  const pixelsPerMm=canvas.width/(base.width*25.4/72),message=globalThis.patternHost.importPdfPage({canvas,fileName:nameToScan,pageNumber,pageCount:documentToScan.numPages,pixelsPerMm,contours,source,texts});
  say(`${message} Đã tách ${texts.length} đoạn chữ PDF; các mục nghi watermark cần xem lại. PDF scan dạng ảnh chưa tự đọc chữ. Đối chiếu số đo thật trước khi xuất.`)
 }catch(error){if(generation===openGeneration&&token===scanGeneration)say(`Không nhận diện được trang PDF: ${error?.message||'hãy thử trang khác hoặc PDF rõ hơn'}`)}finally{if(token===scanGeneration){loading=false;byId('scanPdf').disabled=!documentRef}}
});
