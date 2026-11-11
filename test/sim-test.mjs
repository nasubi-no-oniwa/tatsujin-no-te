// 採点の試験：きれいな形は 100%、ゆがめるほど点が下がる、記録の文字にしても点が変わらない
import * as S from '../sim.js';
let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const gauss=()=>{let u=0;for(let i=0;i<6;i++)u+=rnd();return (u-3)/Math.sqrt(0.5);};
// なめらかなゆれ（人の手のふるえに近い）
function wob(n,amp){const a=[];const k=[1,2,3,5,8],ph=k.map(()=>rnd()*6.28),am=k.map(x=>gauss()*amp/Math.sqrt(x));for(let i=0;i<n;i++){let v=0;for(let j=0;j<k.length;j++)v+=am[j]*Math.sin(k[j]*i/n*6.283+ph[j]);a.push(v);}return a;}
function circleRaw(r,amp,gap=0,M=240){const w=wob(M,amp),o=[];for(let i=0;i<M;i++){const a=(i/(M-1))*(6.2832*(1-gap))-1.57,rr=r*(1+w[i]);o.push({x:.5+rr*Math.cos(a),y:.5+rr*Math.sin(a),t:i*10});}return o;}
function polyRaw(n,R,amp,rot=0,M=240){const V=[];for(let k=0;k<=n;k++){const a=rot+k*6.2832/n;V.push([.5+R*Math.cos(a),.5+R*Math.sin(a)]);}const w=wob(M,amp),o=[];for(let i=0;i<M;i++){const u=i/(M-1)*n,k=Math.min(n-1,Math.floor(u)),f=u-k;const x=V[k][0]+(V[k+1][0]-V[k][0])*f,y=V[k][1]+(V[k+1][1]-V[k][1])*f;const nx=(x-.5),ny=(y-.5),d=Math.hypot(nx,ny)||1;o.push({x:x+nx/d*w[i]*R,y:y+ny/d*w[i]*R,t:i*10});}return o;}
function lineRaw(x0,y0,x1,y1,amp,M=100){const w=wob(M,amp),L=Math.hypot(x1-x0,y1-y0),nx=-(y1-y0)/L,ny=(x1-x0)/L,o=[];for(let i=0;i<M;i++){const f=i/(M-1);o.push({x:x0+(x1-x0)*f+nx*w[i]*L/2,y:y0+(y1-y0)*f+ny*w[i]*L/2,t:i*10});}return o;}
const sc=(ev,st)=>{const p=S.pack(ev,st);const o=S.score(ev,p);return o;};
let fail=0;const ok=(name,c,extra='')=>{console.log((c?'OK  ':'NG  ')+name+' '+extra);if(!c)fail++;};
// 1. きれいな形は 100.000%
let o=sc('maru',[circleRaw(.35,0)]);ok('きれいな〇は100%',o.s===S.FULL,S.pct(o.s)+' '+o.note);
o=sc('sankaku',[polyRaw(3,.4,0,-1.5708)]);ok('きれいな△は100%',o.s===S.FULL,S.pct(o.s)+' '+o.note);
o=sc('sankaku',[polyRaw(3,.4,0,0.3)]);ok('傾いた△も100%',o.s===S.FULL,S.pct(o.s));
o=sc('shikaku',[polyRaw(4,.42,0,.7854)]);ok('きれいな■は100%',o.s===S.FULL,S.pct(o.s)+' '+o.note);
o=sc('shikaku',[polyRaw(4,.42,0,.2)]);ok('傾いた■も100%',o.s===S.FULL,S.pct(o.s));
o=sc('batsu',[lineRaw(.2,.2,.8,.8,0),lineRaw(.8,.2,.2,.8,0)]);ok('きれいな✖は100%',o.s===S.FULL,S.pct(o.s)+' '+o.note);
o=sc('batsu',[lineRaw(.5,.15,.5,.85,0),lineRaw(.15,.5,.85,.5,0)]);ok('＋の向きの✖も100%',o.s===S.FULL,S.pct(o.s));
// 2. 小さい形はやり直し
o=sc('maru',[circleRaw(.2,0)]);ok('小さい〇はやり直し',o.err==='small');
// 3. ゆがめるほど下がる
for(const ev of S.EVENTS){let prev=101,line=ev+': ';let mono=true;
 for(const amp of [.005,.01,.02,.04,.08]){let sum=0;const T=30;for(let k=0;k<T;k++){const st=ev==='maru'?[circleRaw(.35,amp)]:ev==='sankaku'?[polyRaw(3,.4,amp,-1.5708)]:ev==='shikaku'?[polyRaw(4,.42,amp,.7854)]:[lineRaw(.2,.2,.8,.8,amp),lineRaw(.8,.2,.2,.8,amp)];sum+=sc(ev,st).s;}
  const m=sum/T/1000;line+=amp+'→'+m.toFixed(2)+'  ';if(m>=prev)mono=false;prev=m;}
 ok('ゆがめるほど下がる',mono,line);}
// 4. 形ちがい・すき間
o=sc('sankaku',[circleRaw(.35,0)]);ok('△の種目で〇を描くと低い',o.s<80000,S.pct(o.s));
o=sc('shikaku',[circleRaw(.35,0)]);ok('■の種目で〇を描くと低い',o.s<90000,S.pct(o.s));
o=sc('maru',[polyRaw(4,.42,0,.7854)]);ok('〇の種目で■を描くと低い',o.s<85000,S.pct(o.s));
o=sc('maru',[circleRaw(.35,0,.1)]);ok('閉じていない〇は下がる',o.s<90000&&o.note==='gap',S.pct(o.s)+' '+o.note);
o=sc('batsu',[lineRaw(.2,.2,.8,.8,0),lineRaw(.8,.3,.3,.8,0)]);ok('長さがちがう✖は下がる',o.s<97000,S.pct(o.s)+' '+o.note);
o=sc('batsu',[lineRaw(.2,.2,.8,.8,0),lineRaw(.8,.35,.2,.65,0)]);ok('直角でない✖は下がる',o.s<95000,S.pct(o.s)+' '+o.note);
const el=[];for(let i=0;i<240;i++){const a=i/239*6.2832;el.push({x:.5+.3*Math.cos(a),y:.5+.4*Math.sin(a),t:i*10});}
o=sc('maru',[el]);ok('たて長の〇',o.note==='tall',S.pct(o.s)+' '+o.note);
// 5. 記録の文字にしても点が同じ
let same=true;for(let k=0;k<200;k++){const ev=S.EVENTS[k%4];const amp=.03*rnd();const st=ev==='maru'?[circleRaw(.3+.1*rnd(),amp,.05*rnd())]:ev==='sankaku'?[polyRaw(3,.4,amp,rnd()*6)]:ev==='shikaku'?[polyRaw(4,.42,amp,rnd()*6)]:[lineRaw(.2,.2,.8,.8,amp),lineRaw(.8,.2,.2,.8,amp)];const p=S.pack(ev,st),a=S.score(ev,p);const str=S.encode(p);if(str.length!==288||!S.P_RE.test(str)){same=false;break;}const v=S.verify(ev,str,a.s);if(!v||v.s!==a.s)same=false;if(a.err){same=false;console.log('err',ev,a.err);}if(a.s<S.FULL-600&&S.verify(ev,str,a.s+500))same=false;}
ok('記録の文字にしても点が同じ・点だけ書きかえた記録ははじく',same);
const t0=Date.now();for(let k=0;k<400;k++)sc(S.EVENTS[k%4],k%4===3?[lineRaw(.2,.2,.8,.8,.02),lineRaw(.8,.2,.2,.8,.02)]:[circleRaw(.35,.02)]);console.log('1回の採点',((Date.now()-t0)/400).toFixed(2),'ms');
console.log(fail?('失敗 '+fail+' 件'):'すべて OK');process.exit(fail?1:0);
