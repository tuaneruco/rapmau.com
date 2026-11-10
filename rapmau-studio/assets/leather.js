/* Material profiles are artistic starting points, not measured press specifications. */
(function(root){
const profiles={
 nappa:{name:'Nappa',note:'Da mềm, vân mịn · mép dập mềm và bóng nhẹ.',bevel:1.5,compression:.42,shadow:.62,shine:.40,burn:.075,micro:.12,depth:60},
 saffiano:{name:'Saffiano',note:'Vân chéo · nén vân trong lòng dấu, giữ mép rõ.',bevel:.85,compression:.72,shadow:.72,shine:.34,burn:.06,micro:.28,depth:64},
 pullup:{name:'Pull-up',note:'Da dầu · lòng dấu sẫm, chuyển sắc nhẹ.',bevel:1.25,compression:.38,shadow:.66,shine:.36,burn:.12,micro:.16,depth:60},
 epsom:{name:'Epsom',note:'Vân dập đều · mép gọn, nén hạt da trong dấu.',bevel:1,compression:.68,shadow:.72,shine:.36,burn:.065,micro:.3,depth:64},
 waxed:{name:'Da sáp',note:'Bề mặt sáp · tương phản dịu, mép ít bóng.',bevel:1.35,compression:.4,shadow:.60,shine:.24,burn:.10,micro:.22,depth:60},
 veg:{name:'Veg-tan',note:'Da thuộc thực vật · lòng dấu nén rõ, sẫm nhẹ.',bevel:.9,compression:.7,shadow:.75,shine:.30,burn:.13,micro:.15,depth:65}
};
function blur(src,w,h,r){r=Math.max(1,Math.round(r));const temp=new Float32Array(src.length),out=new Float32Array(src.length);for(let y=0;y<h;y++){let sum=0;for(let j=-r;j<=r;j++)sum+=src[y*w+Math.max(0,Math.min(w-1,j))];for(let x=0;x<w;x++){temp[y*w+x]=sum/(2*r+1);sum+=src[y*w+Math.min(w-1,x+r+1)]-src[y*w+Math.max(0,x-r)]}}for(let x=0;x<w;x++){let sum=0;for(let j=-r;j<=r;j++)sum+=temp[Math.max(0,Math.min(h-1,j))*w+x];for(let y=0;y<h;y++){out[y*w+x]=sum/(2*r+1);sum+=temp[Math.min(h-1,y+r+1)*w+x]-temp[Math.max(0,y-r)*w+x]}}return out}
function localMax(src,w,h,r){const tmp=new Float32Array(src.length),out=new Float32Array(src.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=0;for(let k=Math.max(0,x-r);k<=Math.min(w-1,x+r);k++)m=Math.max(m,src[y*w+k]);tmp[y*w+x]=m}for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=0;for(let k=Math.max(0,y-r);k<=Math.min(h-1,y+r);k++)m=Math.max(m,tmp[k*w+x]);out[y*w+x]=m}return out}
// Distance to the stamped outline. Subpixel coverage retains thin strokes.
function insideDistance(alpha,w,h){const d=new Float32Array(w*h),diag=Math.SQRT2;for(let i=0;i<d.length;i++)d[i]=alpha[i]<.5?0:1e6;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;d[i]=Math.min(d[i],x?d[i-1]+1:1,y?d[i-w]+1:1,x&&y?d[i-w-1]+diag:1e6,x<w-1&&y?d[i-w+1]+diag:1e6)}for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;d[i]=Math.min(d[i],x<w-1?d[i+1]+1:1,y<h-1?d[i+w]+1:1,x<w-1&&y<h-1?d[i+w+1]+diag:1e6,x&&y<h-1?d[i+w-1]+diag:1e6)}for(let i=0;i<d.length;i++)d[i]=Math.max(0,d[i]-.5+Math.min(.5,alpha[i]-.5));return d}
function shade(src,alpha,w,h,settings){const out=new Uint8ClampedArray(src),dep=Math.max(0,Math.min(1,settings.depth/100));if(!dep)return out;const p=profiles[settings.material]||profiles.nappa,n=w*h,res=Math.max(.3,settings.resolution),lum=new Float32Array(n);for(let i=0;i<n;i++)lum[i]=src[i*4]*.2126+src[i*4+1]*.7152+src[i*4+2]*.0722;
const low=blur(lum,w,h,Math.max(1,res*1.7)),dist=insideDistance(alpha,w,h),height=new Float32Array(n),bevel=Math.max(.9,(2+p.bevel)*res*settings.softness),retain=settings.grain/100;
const stroke=localMax(dist,w,h,Math.min(12,Math.ceil(bevel*1.5)));
for(let i=0;i<n;i++){const width=Math.max(.6,Math.min(bevel,stroke[i]+.2)),q=Math.min(1,dist[i]/width),ramp=q*q*(3-2*q);height[i]=-ramp*dep*Math.min(bevel*1.25,.8+stroke[i])}
const smoothHeight=blur(height,w,h,Math.max(1,res*.7));const halo=blur(alpha,w,h,Math.max(1,res*1.2));
const read=(a,x,y)=>{const ix=Math.max(0,Math.min(w-1,x)),iy=Math.max(0,Math.min(h-1,y));return a[iy*w+ix]};
const rad=settings.light*Math.PI/180,lx=Math.cos(rad)*.65,ly=-Math.sin(rad)*.65,lz=Math.sqrt(1-.65*.65),halfLen=Math.hypot(lx,ly,lz+1),hx=lx/halfLen,hy=ly/halfLen,hz=(lz+1)/halfLen,flatSpec=Math.pow(hz,22);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,k=i*4,a=alpha[i];if(a<.001&&halo[i]<.005)continue;const dx=(read(smoothHeight,x+1,y)-read(smoothHeight,x-1,y))*.5,dy=(read(smoothHeight,x,y+1)-read(smoothHeight,x,y-1))*.5,norm=Math.hypot(dx,dy,1),nx=-dx/norm,ny=-dy/norm,nz=1/norm;
const diffuse=nx*lx+ny*ly+nz*lz-lz,spec=Math.max(0,Math.pow(Math.max(0,nx*hx+ny*hy+nz*hz),22)-flatSpec),wall=Math.exp(-dist[i]/Math.max(.5,bevel*.8));
const texture=Math.max(-1,Math.min(1,(lum[i]-low[i])/25)),contact=(.10+.1*wall)*dep,textureResponse=1+texture*p.micro*.25,compression=Math.min(.94,p.compression+.25)*(1-retain*.6)*dep*Math.min(1,dist[i]/bevel);
const shadow=Math.min(.8,Math.max(0,-diffuse)*p.shadow*1.8*textureResponse+contact+p.burn*dep*.32),bounce=Math.max(0,diffuse)*.65+spec*p.shine*3.3*((settings.gloss??50)/50);
for(let c=0;c<3;c++){const base=src[k+c]-(lum[i]-low[i])*compression;const reflection=Math.min(105,18+Math.sqrt(Math.max(0,base)/255)*105);const support=Math.max(a,Math.min(1,halo[i]*1.6)),stamped=base*(1-shadow*a)+reflection*bounce;out[k+c]=src[k+c]*(1-support)+stamped*support}}
return out}
const api={profiles,shade,blur};if(typeof module!=='undefined')module.exports=api;else root.Leather=api;
})(typeof window!=='undefined'?window:this);
