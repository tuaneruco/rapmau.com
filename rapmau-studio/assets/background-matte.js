/* Full-resolution monochrome logo matte; independent of saliency downsampling. */
(function(root){
function logoMatte(data,width,height,force=false){
 const rgb=data instanceof ArrayBuffer?new Uint8ClampedArray(data):data;
 let count=0,white=0,neutral=0,dark=0,corner=0,cornerWhite=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;if(rgb[i+3]<128)continue;
  const lo=Math.min(rgb[i],rgb[i+1],rgb[i+2]),hi=Math.max(rgb[i],rgb[i+1],rgb[i+2]);
  count++;if(lo>235)white++;if(hi-lo<15)neutral++;if(hi<80)dark++;
  if((x<width*.06||x>=width*.94)&&(y<height*.06||y>=height*.94)){corner++;if(lo>235)cornerWhite++;}
 }
 if(!force&&(!count||cornerWhite/Math.max(corner,1)<.98||white/count<.55||neutral/count<.995||dark/count<.005))return null;
 const mask=new Uint8ClampedArray(width*height),clean=new Uint8ClampedArray(rgb);
 for(let at=0;at<mask.length;at++){
  const i=at*4,lo=Math.min(rgb[i],rgb[i+1],rgb[i+2]),hi=Math.max(rgb[i],rgb[i+1],rgb[i+2]);
  // Neutral anti-alias pixels are black ink mixed with white, not white borders.
  const a=hi-lo<20?Math.max(0,Math.min(1,(250-(rgb[i]+rgb[i+1]+rgb[i+2])/3)/230)):(lo>248?0:1);
  mask[at]=Math.round(a*255);
  if(a>0&&a<1)for(let c=0;c<3;c++)clean[i+c]=Math.max(0,Math.min(255,(rgb[i+c]-255*(1-a))/a));
 }
 return {mask,clean};
}
root.BackgroundMatte={logoMatte};
})(globalThis);
