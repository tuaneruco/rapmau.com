export const SERVICES={paper:'In rập giấy',rigid:'Cắt rập cứng',die:'Khuôn bế',brass:'Khuôn đồng',mold3d:'In khuôn 3D'};
export const ORDER_STATUS={draft:'Phiếu nháp',confirmed:'Đã xác nhận với đối tác',production:'Đang sản xuất',shipped:'Đang giao',delivered:'Đã nhận',cancelled:'Đã hủy'};
export const VERSION_STATUS={draft:'Bản nháp',submitted:'Chờ duyệt',approved:'Đã duyệt',rejected:'Cần chỉnh sửa'};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function checkPattern(doc){
 const issues=[],add=(severity,code,message,index=null)=>issues.push({severity,code,message,index});
 const paper=doc?.paper,source=doc?.state?.pieces||[],staged=doc?.state?.staged;
 if(!paper||!Array.isArray(paper.pieces)||!paper.pieces.length){add('error','empty','Chưa có chi tiết trên giấy.');return {issues,errors:1,warnings:0,total:0}}
 const formats={A0:[1189,841],A1:[841,594],A2:[594,420],A3:[420,297],A4:[297,210]},size=formats[paper.paperSize];
 if(!finite(paper.width)||!finite(paper.height)||!size||!((Math.abs(paper.width-size[0])<.1&&Math.abs(paper.height-size[1])<.1)||(Math.abs(paper.width-size[1])<.1&&Math.abs(paper.height-size[0])<.1)))add('error','paper','Kích thước trang không khớp khổ giấy đã chọn.');
 if(!(staged?.scale>0)||doc.units!=='mm')add('error','scale','Chưa xác nhận tỷ lệ mm của bản vẽ.');
 for(let index=0;index<source.length;index++){const p=source[index];if(p.points?.length>=2&&!p.closed&&(!p.lineRole||p.lineRole==='cut')&&!staged?.pieces?.some(s=>s.sourceIndex===index))add('warning','source-open','Có đường cắt hở ở vùng vẽ chưa đưa lên giấy.',index)}
 const edges=new Map(),roles={cut:0,sew:0,fold:0};let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of paper.pieces){const original=staged?.pieces?.find(s=>s.sourceIndex===p.sourceIndex)||source[p.sourceIndex],role=original?.lineRole||'cut';roles[role]=(roles[role]||0)+1;const name=original?.name||p.name,points=p.main;
 if(!Array.isArray(points)||points.length<2||points.length>20000||points.some(q=>!finite(q.x)||!finite(q.y))){add('error','geometry','Đường vẽ không hợp lệ.',p.sourceIndex);continue}
 if(role==='cut'&&!original?.closed)add('error','open','Đường cắt chưa khép kín.',p.sourceIndex);
 if(!name?.trim()||/^(Ảnh\s*[·-]?\s*chi tiết|PDF trang|Chi tiết bổ sung)/i.test(name))add('warning','name','Cần đặt tên sản xuất cho chi tiết.',p.sourceIndex);
 if(!Number.isInteger(original?.quantity)||original.quantity<1)add('error','quantity','Thiếu số lượng cắt hợp lệ.',p.sourceIndex);
 const xs=points.map(q=>q.x),ys=points.map(q=>q.y),x=Math.min(...xs),y=Math.min(...ys),r=Math.max(...xs),b=Math.max(...ys);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,r);maxY=Math.max(maxY,b);
 if(x<0||y<0||r>paper.width||b>paper.height)add('error','overflow','Chi tiết vượt khổ giấy.',p.sourceIndex);
 if(!p.dimensions||Math.abs((r-x)-p.dimensions.width)>.5||Math.abs((b-y)-p.dimensions.height)>.5)add('error','dimensions','Số đo tổng không khớp đường viền.',p.sourceIndex);
 const seen=new Set();for(let i=0;i<points.length-(original?.closed?0:1);i++){const a=points[i],b=points[(i+1)%points.length];if(Math.hypot(a.x-b.x,a.y-b.y)<.01)continue;const key=[`${a.x.toFixed(2)},${a.y.toFixed(2)}`,`${b.x.toFixed(2)},${b.y.toFixed(2)}`].sort().join('|');if(edges.has(key)&&!seen.has(key)){add('warning','duplicate','Có nét trùng hoặc đi ngược trên cùng một đoạn.',p.sourceIndex);seen.add(key)}edges.set(key,true)}
 roles.fold+=(p.folds||[]).length;roles.sew+=(p.stitches||[]).length;
 if(!original?.roleConfirmed)add('warning','role','Kiểm tra phân loại đường cắt / may / gấp.',p.sourceIndex);
 }
 const test=doc.calibration;if(!test||test.size!==50||!finite(test.x)||!finite(test.y))add('error','test-square','Chưa tạo ô kiểm tra tỷ lệ 50 × 50 mm.');else if(test.x<0||test.y<0||test.x+50>paper.width||test.y+50>paper.height)add('error','test-square','Ô kiểm tra tỷ lệ vượt trang.');else if(paper.pieces.some(p=>p.dimensions&&test.x<p.dimensions.x+p.dimensions.width&&test.x+50>p.dimensions.x&&test.y<p.dimensions.y+p.dimensions.height&&test.y+50>p.dimensions.y))add('error','test-square','Ô kiểm tra tỷ lệ đang đè lên chi tiết.');
 return {issues,errors:issues.filter(i=>i.severity==='error').length,warnings:issues.filter(i=>i.severity==='warning').length,total:paper.pieces.length,bounds:{width:maxX-minX,height:maxY-minY},roles};
}
export function findCalibration(paper){for(let y=10;y+60<=paper.height;y+=10)for(let x=10;x+60<=paper.width;x+=10)if(!paper.pieces.some(p=>{const d=p.dimensions;return x<d.x+d.width+5&&x+55>d.x&&y<d.y+d.height+5&&y+55>d.y}))return {x,y,size:50};return null}
export function canOrder(version,admin){return !!admin&&version?.status==='approved'}
