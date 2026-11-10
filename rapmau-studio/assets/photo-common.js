window.Photo={
 $:id=>document.getElementById(id),
 canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c},
 bytes(n){return n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB'},
 async load(file){if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Vui lòng chọn JPG, PNG hoặc WebP.');if(file.size>25*1048576)throw Error('Ảnh vượt quá 25 MB.');const im=await createImageBitmap(file);if(im.width*im.height>25000000){im.close();throw Error('Ảnh vượt quá 25 triệu điểm ảnh.')}return im},
 blob(c,type,q=.92){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Không thể xuất ảnh.')),type,q))},
 download(b,name){const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)},
 fit(c){const s=document.getElementById('stage'),r=Math.min((s.clientWidth-24)/c.width,(s.clientHeight-24)/c.height,1);c.style.width=Math.max(1,c.width*r)+'px';c.style.height=Math.max(1,c.height*r)+'px'},
 status(t,error=false){const s=document.getElementById('status');s.textContent=t;s.classList.toggle('error',error)}
};
document.getElementById('start').onclick=()=>document.getElementById('file').click();
new ResizeObserver(()=>Photo.fit(document.getElementById('preview'))).observe(document.getElementById('stage'));
