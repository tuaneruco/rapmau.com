importScripts('/rapmau-studio/assets/vendor/ort.wasm.min.js');
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths='/rapmau-studio/assets/vendor/';
let session;

function preserveBorderDetails(mask,rgb,width=320,height=320){
  if(rgb instanceof ArrayBuffer)rgb=new Uint8ClampedArray(rgb);
  if(!rgb||rgb.length<width*height*4)return mask;
  const samples=[];const patch=12;
  for(const [ox,oy] of [[0,0],[width-patch,0],[0,height-patch],[width-patch,height-patch]])for(let y=oy;y<oy+patch;y+=2)for(let x=ox;x<ox+patch;x+=2){const i=(y*width+x)*4;samples.push([rgb[i],rgb[i+1],rgb[i+2]])}
  const avg=[0,0,0];for(const c of samples)for(let k=0;k<3;k++)avg[k]+=c[k]/samples.length;
  let variance=0;for(const c of samples)for(let k=0;k<3;k++)variance+=(c[k]-avg[k])**2/samples.length;
  // Restrict this recovery to even, near-uniform backdrops such as the white logo sheet in the reference.
  if(Math.sqrt(variance/3)>17)return mask;
  const size=width*height,seen=new Uint8Array(size),queue=new Int32Array(size);let head=0,tail=0;
  const bg=(at)=>{const i=at*4,dr=rgb[i]-avg[0],dg=rgb[i+1]-avg[1],db=rgb[i+2]-avg[2];return Math.sqrt(dr*dr+dg*dg+db*db)<=48};
  const push=(at)=>{if(!seen[at]&&bg(at)){seen[at]=1;queue[tail++]=at}};
  for(let x=0;x<width;x++){push(x);push((height-1)*width+x)}
  for(let y=1;y<height-1;y++){push(y*width);push(y*width+width-1)}
  while(head<tail){const at=queue[head++],x=at%width,y=(at/width)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx>=0&&nx<width&&ny>=0&&ny<height)push(ny*width+nx)}}
  // Restore dark/colorful lettering the salient-object model may ignore, while keeping enclosed white counters transparent.
  for(let at=0;at<size;at++){if(seen[at]){mask[at]=0;continue}const i=at*4,dr=rgb[i]-avg[0],dg=rgb[i+1]-avg[1],db=rgb[i+2]-avg[2],distance=Math.sqrt(dr*dr+dg*dg+db*db);if(distance>18){const extra=Math.max(0,Math.min(255,Math.round((distance-18)*255/34)));if(extra>mask[at])mask[at]=extra}}
  return mask;
}
// Photo cleanup samples the actual letterboxed image, never the model padding.
function cleanProductBorder(mask,rgb,rect){
  if(rgb instanceof ArrayBuffer)rgb=new Uint8ClampedArray(rgb);
  if(!rgb||rgb.length!==320*320*4||!rect)return mask;
  const {left,top,width,height}=rect,right=left+width,bottom=top+height;
  if(left<0||top<0||right>320||bottom>320||width<2||height<2)return mask;
  const patch=Math.max(1,Math.min(6,Math.floor(width/8),Math.floor(height/8))),samples=[];
  for(const [ox,oy] of [[left,top],[right-patch,top],[left,bottom-patch],[right-patch,bottom-patch]])for(let y=oy;y<oy+patch;y++)for(let x=ox;x<ox+patch;x++)samples.push((y*320+x)*4);
  const color=[0,0,0];for(const i of samples)for(let c=0;c<3;c++)color[c]+=rgb[i+c]/samples.length;
  let variance=0;for(const i of samples)for(let c=0;c<3;c++)variance+=(rgb[i+c]-color[c])**2/(samples.length*3);
  // Never add opacity back to a product mask. White product highlights remain protected.
  if(Math.sqrt(variance)>12)return mask;
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let head=0,tail=0;
  function push(x,y){const at=y*320+x;if(seen[at]||mask[at]>=245)return;const i=at*4,d=Math.hypot(rgb[i]-color[0],rgb[i+1]-color[1],rgb[i+2]-color[2]);if(d>32)return;seen[at]=1;queue[tail++]=at;}
  for(let x=left;x<right;x++){push(x,top);push(x,bottom-1)}for(let y=top;y<bottom;y++){push(left,y);push(right-1,y)}
  while(head<tail){const at=queue[head++],x=at%320,y=Math.floor(at/320);mask[at]=0;if(x>left)push(x-1,y);if(x+1<right)push(x+1,y);if(y>top)push(x,y-1);if(y+1<bottom)push(x,y+1)}
  return mask;
}
function refineSaliency(values,rgb,rect){
  const size=values.length,hist=new Uint32Array(256),finite=new Float32Array(size);let maxValue=0;
  for(let i=0;i<size;i++){
    const v=Number.isFinite(values[i])?Math.max(0,Math.min(1,values[i])):0;
    finite[i]=v;maxValue=Math.max(maxValue,v);hist[Math.round(v*255)]++;
  }
  // Otsu gives a per-image cutoff so pale backgrounds do not inherit a faint AI halo.
  let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
  let sumB=0,wB=0,best=-1,otsu=48;
  for(let i=0;i<256;i++){
    wB+=hist[i];if(!wB)continue;const wF=size-wB;if(!wF)break;
    sumB+=i*hist[i];const delta=sumB/wB-(sum-sumB)/wF,score=wB*wF*delta*delta;
    if(score>best){best=score;otsu=i;}
  }
  const high=Math.max(.06,Math.min(.58,Math.max(otsu/255*1.18,maxValue*.38),maxValue*.75));
  const low=Math.max(.06,Math.min(.24,high*.31));
  const seen=new Uint8Array(size),keep=new Uint8Array(size),queue=new Int32Array(size),minArea=Math.max(8,Math.floor(size*.00015));
  // Hysteresis: retain low-confidence edge pixels only when connected to a confident foreground seed.
  for(let start=0;start<size;start++){
    if(seen[start]||finite[start]<low)continue;
    let head=0,tail=0,hasSeed=false;queue[tail++]=start;seen[start]=1;
    while(head<tail){
      const at=queue[head++];if(finite[at]>=high)hasSeed=true;
      const x=at%320,y=(at/320)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||nx>=320||ny<0||ny>=320)continue;
        const next=ny*320+nx;if(!seen[next]&&finite[next]>=low){seen[next]=1;queue[tail++]=next;}
      }
    }
    if(hasSeed&&tail>=minArea)for(let i=0;i<tail;i++)keep[queue[i]]=1;
  }
  const mask=new Uint8ClampedArray(size),range=high-low;
  for(let i=0;i<size;i++){
    if(!keep[i])continue;
    const x=Math.max(0,Math.min(1,(finite[i]-low)/range));
    const smooth=x*x*(3-2*x);mask[i]=Math.round(smooth*255);
  }
  return rect?cleanProductBorder(mask,rgb,rect):preserveBorderDetails(mask,rgb);
}
onmessage=async({data})=>{
  let tensor,output;
  try{
    postMessage({stage:'Đang tải bộ nhận diện…'});
    session ||= await ort.InferenceSession.create('/rapmau-studio/assets/models/u2netp.onnx',{executionProviders:['wasm']});
    postMessage({stage:'Đang tách sản phẩm…'});
    tensor=new ort.Tensor('float32',data.input,[1,3,320,320]);
    output=await session.run({[session.inputNames[0]]:tensor});
    const p=output[session.outputNames[0]].data;
    postMessage({stage:'Đang làm sạch mép và vùng nền còn sót…'});
    const mask=refineSaliency(p,data.rgb,data.imageRect);
    postMessage({mask},[mask.buffer]);
  }catch(e){postMessage({error:'Không thể chạy bộ tách nền. Hãy thử lại hoặc dùng cọ sửa ảnh. '+(e?.message||'Lỗi không xác định')});}
  finally{tensor?.dispose();if(output)for(const t of Object.values(output))t.dispose();}
};
