'use strict';
// Render the vector drawing at a chosen print resolution, independent of UI zoom.
(function(){
 const encoder=new TextEncoder();
 function pagePixels(widthMm,heightMm,dpi){
  const width=Math.round(widthMm/25.4*dpi),height=Math.round(heightMm/25.4*dpi);
  if(width*height>150e6||width>16000||height>16000)throw Error('Độ nét vượt giới hạn xử lý của khổ giấy này. Hãy chọn DPI thấp hơn.');
  return {width,height};
 }
 async function renderSvg(svg,widthMm,heightMm,dpi){
  const {width,height}=pagePixels(widthMm,heightMm,dpi),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Không thể dựng bản vẽ để xuất ảnh.'));image.src=url});const context=canvas.getContext('2d');if(!context)throw Error('Không tạo được vùng xuất ảnh.');context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);return canvas}finally{URL.revokeObjectURL(url)}
 }
 function toBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Không xuất được ảnh ở độ phân giải này.')),type,quality))}
 function jpegPdf(jpeg,widthPx,heightPx,widthMm,heightMm){
  const w=(widthMm*72/25.4).toFixed(4),h=(heightMm*72/25.4).toFixed(4),draw=`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`,drawBytes=encoder.encode(draw),parts=[],offsets=[0];let size=0;
  const push=part=>{const bytes=typeof part==='string'?encoder.encode(part):part;parts.push(bytes);size+=bytes.length};
  const object=(id,body)=>{offsets[id]=size;push(`${id} 0 obj\n`);if(Array.isArray(body))body.forEach(push);else push(body);push('\nendobj\n')};
  push('%PDF-1.4\n%RAPMAU\n');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  object(4,[`<< /Length ${drawBytes.length} >>\nstream\n`,drawBytes,'endstream']);
  object(5,[`<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg,'\nendstream']);
  const xref=size;push('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts,{type:'application/pdf'});
 }
 async function withDpi(blob,dpi){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(blob.type==='image/jpeg'){// Insert JFIF density immediately after SOI.
   const segment=new Uint8Array([255,224,0,16,74,70,73,70,0,1,2,1,(dpi>>8)&255,dpi&255,(dpi>>8)&255,dpi&255,0,0]);
   // Browsers normally emit JFIF; update it instead of adding a duplicate.
   if(bytes[2]===255&&bytes[3]===224&&bytes[6]===74&&bytes[7]===70){bytes[13]=1;bytes[14]=(dpi>>8)&255;bytes[15]=dpi&255;bytes[16]=(dpi>>8)&255;bytes[17]=dpi&255;return new Blob([bytes],{type:blob.type})}
   return new Blob([bytes.slice(0,2),segment,bytes.slice(2)],{type:blob.type});
  }
  const chunk=new Uint8Array(21),view=new DataView(chunk.buffer);view.setUint32(0,9);chunk.set([112,72,89,115],4);const ppm=Math.round(dpi/0.0254);view.setUint32(8,ppm);view.setUint32(12,ppm);chunk[16]=1;let crc=0xffffffff;for(const b of chunk.slice(4,17)){crc^=b;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}view.setUint32(17,(crc^0xffffffff)>>>0);
  const parts=[bytes.slice(0,33),chunk];let offset=33;while(offset<bytes.length){const length=new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0)+12;const type=String.fromCharCode(...bytes.slice(offset+4,offset+8));if(type!=='pHYs')parts.push(bytes.slice(offset,offset+length));offset+=length}return new Blob(parts,{type:blob.type});
 }
 function cutDxf(pieces,height){const lines=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','4','9','$MEASUREMENT','70','1','0','ENDSEC','0','SECTION','2','ENTITIES'];for(const p of pieces){lines.push('0','LWPOLYLINE','8','CUT_OUTLINE','90',String(p.main.length),'70','1');for(const q of p.main)lines.push('10',q.x.toFixed(4),'20',(height-q.y).toFixed(4));for(const q of p.holes)lines.push('0','CIRCLE','8','CUT_HOLES','10',q.x.toFixed(4),'20',(height-q.y).toFixed(4),'40',(q.diameter/2).toFixed(4))}lines.push('0','ENDSEC','0','EOF');return lines.join('\n')+'\n'}
 globalThis.patternExport={pagePixels,renderSvg,toBlob,jpegPdf,withDpi,cutDxf};
})();
