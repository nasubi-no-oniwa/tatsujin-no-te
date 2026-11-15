import * as S from '../sim.js';
const TAU=Math.PI*2;
// 形の見本を描く（u:0..1 → 紙の上の場所）。amp：手のふるえ
export function shapeFn(ev){
  if(ev==='sen')return u=>[.15+.7*u,.75-.5*u];
  if(ev==='uzu')return u=>{const a=u*TAU*3,r=.04+.36*u;return [.5+r*Math.cos(a),.5+r*Math.sin(a)];};
  const T=ev==='hana'?S.TEMPLATES.hana:S.TEMPLATES[ev];
  return u=>{const q=(u*1.005*T.length)%T.length,k=Math.floor(q),f=q-k,A=T[k],B=T[(k+1)%T.length];return [.5+.4*(A[0]+(B[0]-A[0])*f),.52+.4*(A[1]+(B[1]-A[1])*f)];};
}
function draw(ev,amp,seed,rot=0){let sd=seed;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};const ph=[rnd()*6,rnd()*6,rnd()*6];
 const wob=u=>amp*(Math.sin(u*TAU+ph[0])+.6*Math.sin(2*u*TAU+ph[1])+.4*Math.sin(5*u*TAU+ph[2]));
 const f=shapeFn(ev),M=400,o=[];for(let i=0;i<M;i++){const u=i/(M-1);let [x,y]=f(u);const d=wob(u);
  // ふるえ：真ん中からの向きにずらす（線は横にずらす）
  if(ev==='sen'){x+=d*.5;y+=d*.5;}else{x=.5+(x-.5)*(1+d);y=.5+(y-.5)*(1+d);}
  const c=Math.cos(rot),s=Math.sin(rot);const X=.5+(x-.5)*c-(y-.5)*s,Y=.5+(x-.5)*s+(y-.5)*c;o.push({x:X,y:Y,t:u*3000});}
 return [o];}
let ok=true;
for(const ev of S.EVENTS){const row=[];for(const amp of [0,.005,.012,.03]){const t0=Date.now();const pts=S.pack(ev,draw(ev,amp,5,ev==='uzu'||ev==='sen'?0:.3));const r=S.score(ev,pts);
  row.push(amp+':'+(r.err||S.pct(r.s)+'% '+r.note)+' '+(Date.now()-t0)+'ms');
  if(!r.err){const v=S.verify(ev,S.encode(pts),r.s);if(!v){ok=false;row.push('VERIFY NG');}}}
 console.log(ev.padEnd(6),row.join(' | '));}
// 別の形を描いたら低い点になるか
for(const [a,b] of [['heart','hoshi'],['hoshi','hana'],['hana','heart']]){const pts=S.pack(a,draw(b,0,1));const r=S.score(a,pts);console.log(a,'に',b,'→',r.err||S.pct(r.s));}
// 円を描いたら
const circ=[[]];for(let i=0;i<300;i++){const a=i/299*TAU;circ[0].push({x:.5+.4*Math.cos(a),y:.5+.4*Math.sin(a),t:i*10});}
for(const ev of ['hoshi','heart','hana'])console.log(ev,'に〇→',S.pct(S.score(ev,S.pack(ev,circ)).s));
const short=S.score('uzu',S.pack('uzu',[Array.from({length:200},(_,i)=>{const a=i/199*TAU*1.2,r=.1+.3*i/199;return {x:.5+r*Math.cos(a),y:.5+r*Math.sin(a),t:i*10};})]));console.log('渦1.2周→',short.err);
console.log(ok?'OK':'NG');
