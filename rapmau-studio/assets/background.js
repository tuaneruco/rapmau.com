(()=>{
  const {$,canvas,load,blob,download,fit,status,bytes}=Photo;
  let source,processedSource,mask,aiMask,background,worker,file,undo=[],tool='move',offset={x:0,y:0},showOriginal=false,revision=0,bgRevision=0,drag,magicSelection,selectionOverlay,magicSelectedPixels=0;
  const INPUT_SIZE=320,MEAN=[.485,.456,.406],STD=[.229,.224,.225];
  const copy=c=>{const a=canvas(c.width,c.height);a.getContext('2d').drawImage(c,0,0);return a};
  function busy(on){$('removeBg').disabled=on||!source;$('cancel').hidden=!on;$('progress').hidden=!on;}
  function stop(){worker?.terminate();worker=null;busy(false);}
  function composite(jpg=false){
    const c=canvas(source.width,source.height),ctx=c.getContext('2d'),type=$('bgType').value;
    if(jpg||type==='white'||type==='color'){ctx.fillStyle=type==='color'?$('bgColor').value:'#fff';ctx.fillRect(0,0,c.width,c.height);}
    if(type==='image'&&background){const s=Math.max(c.width/background.width,c.height/background.height);ctx.drawImage(background,(c.width-background.width*s)/2,(c.height-background.height*s)/2,background.width*s,background.height*s);}
    const fg=copy(processedSource||source),f=fg.getContext('2d');f.globalCompositeOperation='destination-in';f.drawImage(mask,0,0);
    const s=+$('fgScale').value/100;ctx.drawImage(fg,(c.width-fg.width*s)/2+offset.x,(c.height-fg.height*s)/2+offset.y,fg.width*s,fg.height*s);window.BrandKit?.draw(ctx,c.width,c.height);return c;
  }
  window.addEventListener('brand-change',draw);
  window.BackgroundObjects={ready:()=>!!source&&!worker,dimensions:()=>source?{w:source.width,h:source.height}:null,canMove:()=>tool==='move',bounds(){if(!source)return null;const s=+$('fgScale').value/100;return {x:source.width*(1-s)/2+offset.x,y:source.height*(1-s)/2+offset.y,w:source.width*s,h:source.height*s}},move(x,y){if(!source)return;const s=+$('fgScale').value/100;offset={x:x-source.width*(1-s)/2,y:y-source.height*(1-s)/2};draw()},resize(width){if(!source)return;const b=this.bounds();$('fgScale').value=Math.max(30,Math.min(150,width/source.width*100));$('scaleValue').textContent=$('fgScale').value+'%';this.move(b.x,b.y)}};

  function ensureTransparentErase(){
    let changed=false;
    if($('bgType').value!=='transparent'){$('bgType').value='transparent';$('colorField').hidden=true;$('bgUpload').hidden=true;$('notice').textContent='';changed=true;}
    if($('format').value==='image/jpeg'){$('format').value='image/png';changed=true;}
    if(changed)status('Đã chuyển nền sang trong suốt và chọn PNG để giữ vùng xóa rỗng.');
  }
  function draw(){if(!source)return;const c=$('preview'),out=showOriginal?source:composite();c.width=out.width;c.height=out.height;const ctx=c.getContext('2d');ctx.drawImage(out,0,0);if(selectionOverlay&&!showOriginal){const s=+$('fgScale').value/100,ox=source.width*(1-s)/2+offset.x,oy=source.height*(1-s)/2+offset.y;ctx.drawImage(selectionOverlay,ox,oy,source.width*s,source.height*s);}c.hidden=false;$('empty').hidden=true;$('dimensions').textContent=`${c.width} × ${c.height} px`;fit(c);window.dispatchEvent(new Event('background-render'));$('undo').disabled=!undo.length;$('resetMask').disabled=!aiMask;$('deleteMagic').disabled=!magicSelectedPixels;$('deleteMagicQuick').hidden=!magicSelectedPixels;}
  function rememberMask(){undo.push(copy(mask));if(undo.length>8)undo.shift();}
  $('file').onchange=async e=>{
    const f=e.target.files?.[0];if(!f)return;const n=++revision;stop();
    try{const im=await load(f);if(n!==revision){im.close();return;}const s=Math.min(1,2048/Math.max(im.width,im.height));source=canvas(Math.max(1,Math.round(im.width*s)),Math.max(1,Math.round(im.height*s)));source.getContext('2d').drawImage(im,0,0,source.width,source.height);im.close();mask=canvas(source.width,source.height);const ctx=mask.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,mask.width,mask.height);file=f;processedSource=null;aiMask=null;undo=[];magicSelection=selectionOverlay=null;magicSelectedPixels=0;offset={x:0,y:0};$('fgScale').value=100;$('scaleValue').textContent='100%';showOriginal=false;$('original').setAttribute('aria-pressed','false');$('fileName').textContent=f.name;$('removeBg').disabled=false;$('download').disabled=false;$('original').disabled=false;status('Ảnh đã sẵn sàng · nhấn Xóa nền tự động');draw();}
    catch(err){status(err instanceof Error?err.message:'Không thể mở ảnh này.',true);}
  };
  $('removeBg').onclick=()=>{
    if(!source)return;magicSelection=selectionOverlay=null;magicSelectedPixels=0;stop();processedSource=null;const full=source.getContext('2d').getImageData(0,0,source.width,source.height),mode=$('removeMode').value,logo=mode==='product'?null:BackgroundMatte.logoMatte(full.data,source.width,source.height,mode==='logo');if(logo){mask=canvas(source.width,source.height);const d=mask.getContext('2d').createImageData(mask.width,mask.height);for(let i=0;i<logo.mask.length;i++){d.data[i*4]=d.data[i*4+1]=d.data[i*4+2]=255;d.data[i*4+3]=logo.mask[i]}mask.getContext('2d').putImageData(d,0,0);processedSource=copy(source);full.data.set(logo.clean);processedSource.getContext('2d').putImageData(full,0,0);aiMask=copy(mask);undo=[];draw();status('Đã xóa nền trắng trong và ngoài logo, giữ chữ ở độ phân giải gốc.');return}busy(true);draw();const n=revision,scale=Math.min(INPUT_SIZE/source.width,INPUT_SIZE/source.height),scaledW=Math.max(1,Math.round(source.width*scale)),scaledH=Math.max(1,Math.round(source.height*scale)),left=Math.floor((INPUT_SIZE-scaledW)/2),top=Math.floor((INPUT_SIZE-scaledH)/2);
    const c=canvas(INPUT_SIZE,INPUT_SIZE),ctx=c.getContext('2d'),pad=ctx.createImageData(INPUT_SIZE,INPUT_SIZE);
    for(let i=0;i<pad.data.length;i+=4){pad.data[i]=Math.round(MEAN[0]*255);pad.data[i+1]=Math.round(MEAN[1]*255);pad.data[i+2]=Math.round(MEAN[2]*255);pad.data[i+3]=255;}
    ctx.putImageData(pad,0,0);ctx.drawImage(source,left,top,scaledW,scaledH);const pixels=ctx.getImageData(0,0,INPUT_SIZE,INPUT_SIZE).data,input=new Float32Array(3*INPUT_SIZE*INPUT_SIZE);
    for(let i=0;i<INPUT_SIZE*INPUT_SIZE;i++)for(let ch=0;ch<3;ch++)input[ch*INPUT_SIZE*INPUT_SIZE+i]=(pixels[i*4+ch]/255-MEAN[ch])/STD[ch];
    try{
      worker=new Worker('/rapmau-studio/assets/segment-worker.js?v=10');const job=worker;
      job.onmessage=({data})=>{
        if(job!==worker||n!==revision)return;if(data.stage){status(data.stage);return;}if(data.error){status(data.error,true);stop();return;}
        try{const small=canvas(INPUT_SIZE,INPUT_SIZE),mctx=small.getContext('2d'),image=mctx.createImageData(INPUT_SIZE,INPUT_SIZE);for(let i=0;i<data.mask.length;i++){image.data[i*4]=image.data[i*4+1]=image.data[i*4+2]=255;image.data[i*4+3]=data.mask[i];}mctx.putImageData(image,0,0);mask=canvas(source.width,source.height);mask.getContext('2d').drawImage(small,left,top,scaledW,scaledH,0,0,mask.width,mask.height);aiMask=copy(mask);undo=[];showOriginal=false;$('original').setAttribute('aria-pressed','false');stop();draw();StudioFlow.mark();status('Đã tách nền và tự làm sạch mép · có thể dùng cọ để tinh chỉnh thêm');}
        catch(err){stop();status(err instanceof Error?`Không thể dựng mặt nạ ảnh: ${err.message}`:'Không thể dựng mặt nạ ảnh.',true);}
      };
      job.onerror=()=>{if(job!==worker||n!==revision)return;stop();status('Không tải được bộ nhận diện. Hãy tải lại trang và thử lại.',true);};
      job.onmessageerror=()=>{if(job!==worker||n!==revision)return;stop();status('Bộ nhận diện trả về dữ liệu không hợp lệ. Hãy thử lại.',true);};
      job.postMessage({input,rgb:pixels.buffer,imageRect:{left,top,width:scaledW,height:scaledH}},[input.buffer,pixels.buffer]);
    }catch(err){stop();status(err instanceof Error?`Không khởi động được bộ nhận diện: ${err.message}`:'Không khởi động được bộ nhận diện.',true);}
  };
  $('cancel').onclick=()=>{++revision;stop();status('Đã hủy xử lý');};
  for(const t of ['move','erase','restore','magic'])$(t+'Tool').onclick=()=>{if(t==='erase'&&magicSelectedPixels){deleteMagicSelection();return;}tool=t;for(const v of ['move','erase','restore','magic'])$(v+'Tool').setAttribute('aria-pressed',t===v);$('preview').style.cursor=t==='move'?'move':'crosshair';$('brushField').hidden=t==='magic';$('magicField').hidden=t!=='magic';if(t!=='magic'){magicSelection=selectionOverlay=null;magicSelectedPixels=0;draw();}};
  $('brush').oninput=()=>$('brushValue').textContent=$('brush').value+' px';
  $('magicTolerance').oninput=()=>$('magicValue').textContent=$('magicTolerance').value;
  function point(e){const r=$('preview').getBoundingClientRect();return{x:(e.clientX-r.left)*source.width/r.width,y:(e.clientY-r.top)*source.height/r.height};}
  function paint(p,last){const s=+$('fgScale').value/100,ox=source.width*(1-s)/2+offset.x,oy=source.height*(1-s)/2+offset.y,ctx=mask.getContext('2d');ctx.globalCompositeOperation=tool==='erase'?'destination-out':'source-over';ctx.strokeStyle='white';ctx.fillStyle='white';ctx.lineWidth=+$('brush').value/s;ctx.lineCap='round';ctx.beginPath();ctx.moveTo((last.x-ox)/s,(last.y-oy)/s);ctx.lineTo((p.x-ox)/s,(p.y-oy)/s);ctx.stroke();ctx.beginPath();ctx.arc((p.x-ox)/s,(p.y-oy)/s,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';}
  function magicSelect(p){
    magicSelection=selectionOverlay=null;magicSelectedPixels=0;
    const s=+$('fgScale').value/100,ox=source.width*(1-s)/2+offset.x,oy=source.height*(1-s)/2+offset.y,x=Math.floor((p.x-ox)/s),y=Math.floor((p.y-oy)/s);
    if(x<0||y<0||x>=source.width||y>=source.height)return;
    const w=source.width,h=source.height,total=w*h,start=y*w+x,sourcePixels=source.getContext('2d').getImageData(0,0,w,h).data,maskCtx=mask.getContext('2d'),maskPixels=maskCtx.getImageData(0,0,w,h),pixels=maskPixels.data,seed=start*4,tolerance=+$('magicTolerance').value,limit=tolerance*tolerance;
    if(pixels[seed+3]<3){draw();status('Vùng này đã trong suốt. Hãy bấm vào phần nền còn nhìn thấy.',true);return;}
    const red=sourcePixels[seed],green=sourcePixels[seed+1],blue=sourcePixels[seed+2],visited=new Uint8Array(total),queue=new Int32Array(total);let head=0,tail=0;
    const matches=i=>{const at=i*4,dr=sourcePixels[at]-red,dg=sourcePixels[at+1]-green,db=sourcePixels[at+2]-blue;return .299*dr*dr+.587*dg*dg+.114*db*db<=limit;};
    if(!matches(start))return;visited[start]=1;queue[tail++]=start;
    while(head<tail){
      const i=queue[head++],cx=i%w,cy=(i/w)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;
        const next=ny*w+nx,na=next*4;if(visited[next]||pixels[na+3]<3||!matches(next))continue;visited[next]=1;queue[tail++]=next;
      }
    }
    magicSelection=new Uint8Array(total);for(let i=0;i<tail;i++)magicSelection[queue[i]]=1;selectionOverlay=canvas(w,h);const overlayCtx=selectionOverlay.getContext('2d'),overlayData=overlayCtx.createImageData(w,h);for(let i=0;i<total;i++)if(magicSelection[i]){const at=i*4;overlayData.data[at]=35;overlayData.data[at+1]=125;overlayData.data[at+2]=255;overlayData.data[at+3]=105;}overlayCtx.putImageData(overlayData,0,0);magicSelectedPixels=tail;draw();status(`Đã chọn vùng màu tương tự (${tail.toLocaleString('vi-VN')} điểm ảnh). Nhấn “Xóa vùng chọn” hoặc nút “Xóa” để tạo nền rỗng.`);
  }
  function deleteMagicSelection(){if(!magicSelection||!magicSelectedPixels)return;ensureTransparentErase();rememberMask();const ctx=mask.getContext('2d'),data=ctx.getImageData(0,0,mask.width,mask.height).data;for(let i=0;i<magicSelection.length;i++)if(magicSelection[i])data[i*4+3]=0;const image=ctx.createImageData(mask.width,mask.height);image.data.set(data);ctx.putImageData(image,0,0);const count=magicSelectedPixels;magicSelection=selectionOverlay=null;magicSelectedPixels=0;draw();status(`Đã xóa ${count.toLocaleString('vi-VN')} điểm ảnh thành trong suốt. Có thể hoàn tác nếu cần.`);}
  $('deleteMagic').onclick=$('deleteMagicQuick').onclick=deleteMagicSelection;
  document.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&magicSelectedPixels){const tag=document.activeElement?.tagName;if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;e.preventDefault();deleteMagicSelection();}else if(e.key==='Escape'&&magicSelectedPixels){magicSelection=selectionOverlay=null;magicSelectedPixels=0;draw();status('Đã bỏ vùng chọn.');}});
  $('preview').style.touchAction='none';$('preview').onpointerdown=e=>{if(!source||showOriginal||worker)return;const p=point(e);if(tool==='magic'){magicSelect(p);return;}drag={p,offset:{...offset}};e.target.setPointerCapture(e.pointerId);if(tool!=='move'){if(tool==='erase')ensureTransparentErase();rememberMask();paint(p,p);draw();}};
  $('preview').onpointermove=e=>{if(!drag)return;const p=point(e);if(tool==='move')offset={x:drag.offset.x+p.x-drag.p.x,y:drag.offset.y+p.y-drag.p.y};else{paint(p,drag.p);drag.p=p;}draw();};$('preview').onpointerup=$('preview').onpointercancel=()=>drag=null;
  $('undo').onclick=()=>{if(undo.length){mask=undo.pop();magicSelection=selectionOverlay=null;magicSelectedPixels=0;draw();}};$('resetMask').onclick=()=>{if(aiMask){rememberMask();mask=copy(aiMask);magicSelection=selectionOverlay=null;magicSelectedPixels=0;draw();}};
  $('bgType').onchange=()=>{$('colorField').hidden=$('bgType').value!=='color';$('bgUpload').hidden=$('bgType').value!=='image';$('notice').textContent=$('bgType').value==='image'&&!background?'Chọn ảnh nền để hoàn thiện kết quả.':'';draw();};$('bgColor').oninput=draw;$('fgScale').oninput=()=>{$('scaleValue').textContent=$('fgScale').value+'%';draw();};$('centerFg').onclick=()=>{offset={x:0,y:0};draw();};
  $('bgFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const n=++bgRevision;try{const im=await load(f);if(n!==bgRevision){im.close();return;}background?.close?.();background=im;$('bgName').textContent=f.name;$('notice').textContent='';draw();}catch(err){status(err instanceof Error?err.message:'Không thể mở ảnh nền.',true);}};
function compare(){if(!source)return;const dialog=$('compareDialog'),before=$('beforeCompare'),after=$('afterCompare'),result=composite();for(const [target,image] of [[before,source],[after,result]]){target.width=image.width;target.height=image.height;target.getContext('2d').drawImage(image,0,0)}if(!dialog.open)dialog.showModal()}
$('original').onclick=compare;$('closeCompare').onclick=()=>$('compareDialog').close();$('compareDialog').onclick=e=>{if(e.target===$('compareDialog'))$('compareDialog').close()};
  $('download').onclick=async()=>{if(!source)return;if($('bgType').value==='image'&&!background){status('Vui lòng chọn ảnh nền trước khi xuất.',true);return;}const type=$('format').value,n=revision;try{const b=await blob(composite(type==='image/jpeg'),type);if(n!==revision)return;download(b,file.name.replace(/\.[^.]+$/,'')+'-eruco.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[b.type]||'png'));$('outputInfo').textContent=bytes(b.size);status('Đã xuất ảnh');}catch(err){status(err instanceof Error?err.message:'Không thể xuất ảnh.',true);}};

async function flowReady(){file=new File([],'anh-studio.png');$('fileName').textContent='Ảnh Studio';$('removeBg').disabled=false;$('download').disabled=false;$('original').disabled=false;showOriginal=false;draw()}
StudioFlow.register('background',{
 ready:()=>!!source,
 snapshot:async()=>({source:await StudioFlow.blob(source),mask:await StudioFlow.blob(mask),processed:await StudioFlow.blob(processedSource),background:await StudioFlow.blob(background),offset,brand:await window.BrandKit?.snapshot?.()}),
 restore:async d=>{source=await StudioFlow.bitmap(d.source);mask=await StudioFlow.bitmap(d.mask);aiMask=copy(mask);processedSource=await StudioFlow.bitmap(d.processed);background=await StudioFlow.bitmap(d.background);offset=d.offset;await window.BrandKit?.restore?.(d.brand);await flowReady()},
 import:async b=>{source=await StudioFlow.bitmap(b);mask=canvas(source.width,source.height);const c=mask.getContext('2d');c.fillStyle='white';c.fillRect(0,0,mask.width,mask.height);await flowReady()},
 export:()=>StudioFlow.blob(composite())
});
})();
