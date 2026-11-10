/* Projective mapping from a unit square to a convex surface patch. */
(function(root){
function homography(p){const [a,b,c,d]=p,dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x,dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y;const det=dx1*dy2-dx2*dy1;if(Math.abs(det)<1e-9)return null;const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;return [b.x-a.x+g*b.x,d.x-a.x+h*d.x,a.x,b.y-a.y+g*b.y,d.y-a.y+h*d.y,a.y,g,h,1]}
function invert(m){if(!m)return null;const[a,b,c,d,e,f,g,h,i]=m;const out=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d];const det=a*out[0]+b*out[3]+c*out[6];return Math.abs(det)<1e-10?null:out.map(v=>v/det)}
function map(m,x,y){const z=m[6]*x+m[7]*y+m[8];return {x:(m[0]*x+m[1]*y+m[2])/z,y:(m[3]*x+m[4]*y+m[5])/z}}
function valid(p){let sign=0;for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4],c=p[(i+2)%4];const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(cross)<.0001)return false;if(sign&&Math.sign(cross)!==sign)return false;sign=Math.sign(cross)}return sign>0}
const api={homography,invert,map,valid};if(typeof module!=='undefined')module.exports=api;else root.Surface=api;
})(typeof window!=='undefined'?window:this);
