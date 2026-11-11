// ランキングのルールの試験（GitHub の上で Firebase の試し用データベースを立てて試す。本番のデータには触らない）
const NS='ft-red-default-rtdb',PROJ='ft-red',BASE='http://127.0.0.1:9000';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const tok=uid=>b64({alg:'none',typ:'JWT'})+'.'+b64({uid,sub:uid,user_id:uid,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,aud:PROJ,iss:'https://securetoken.google.com/'+PROJ,provider_id:'anonymous',firebase:{sign_in_provider:'anonymous'}})+'.';
async function req(method,path,uid,body,q=''){const r=await fetch(BASE+'/'+path+'.json?ns='+NS+q+(uid?'&auth='+tok(uid):''),{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {ok:r.ok,status:r.status,j:await r.json().catch(()=>null)};}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0;const ex=(name,res,want)=>{const ok=res.ok===want;console.log((ok?'OK  ':'NG  ')+name+' → '+res.status);if(!ok){fail++;console.log(JSON.stringify(res.j));}};
const TS={'.sv':'timestamp'};const P='tatsujin';
const U='user1aaaaaaaaaaaaaaaaaaa',U2='user2bbbbbbbbbbbbbbbbbbb';
const PP='Ab0_-'.repeat(57)+'AAA';
const tick=async uid=>{const r=await req('PUT',P+'/last/'+uid,uid,{t:TS});return r.j&&r.j.t;};
const rec=(st,s,p=PP,n='テスト')=>({n,p,s,k:s,d:2000,st,v:1,t:TS});
let st=await tick(U);
ex('チケットのすぐあとは記録できない（0.5秒たっていない）',await req('PUT',P+'/r/maru/'+U,U,rec(st,97000)),false);
await sleep(700);
ex('記録できる',await req('PUT',P+'/r/maru/'+U,U,rec(st,97000)),true);
ex('低い記録では上書きできない',await req('PUT',P+'/r/maru/'+U,U,rec(st,96000)),false);
ex('高い記録なら上書きできる',await req('PUT',P+'/r/maru/'+U,U,rec(st,98123)),true);
ex('同じチケットでほかの種目も記録できる',await req('PUT',P+'/r/batsu/'+U,U,rec(st,91000)),true);
ex('k をごまかせない',await req('PUT',P+'/r/sankaku/'+U,U,{...rec(st,90000),k:99999}),false);
ex('100%より上は書けない',await req('PUT',P+'/r/sankaku/'+U,U,rec(st,100001)),false);
ex('小数の点は書けない',await req('PUT',P+'/r/sankaku/'+U,U,rec(st,90000.5)),false);
ex('時計をごまかせない',await req('PUT',P+'/r/sankaku/'+U,U,rec(st-5000,90000)),false);
ex('ほかの人の場所には書けない',await req('PUT',P+'/r/sankaku/'+U2,U,rec(st,90000)),false);
ex('ない種目には書けない',await req('PUT',P+'/r/hoshi/'+U,U,rec(st,90000)),false);
ex('線の文字が短いと書けない',await req('PUT',P+'/r/sankaku/'+U,U,rec(st,90000,PP.slice(0,287))),false);
ex('線の文字に変な字があると書けない',await req('PUT',P+'/r/sankaku/'+U,U,rec(st,90000,PP.slice(0,287)+'!')),false);
ex('名前が長すぎると書けない',await req('PUT',P+'/r/sankaku/'+U,U,rec(st,90000,PP,'あ'.repeat(17))),false);
ex('時間が7秒をこえると書けない',await req('PUT',P+'/r/sankaku/'+U,U,{...rec(st,90000),d:7001}),false);
ex('よけいな項目は書けない',await req('PUT',P+'/r/sankaku/'+U,U,{...rec(st,90000),x:1}),false);
ex('100%でないと100%の名簿に入れない',await req('PUT',P+'/p/maru/'+U,U,true),false);
ex('100%の記録',await req('PUT',P+'/r/shikaku/'+U,U,rec(st,100000)),true);
ex('100%の名簿に入れる',await req('PUT',P+'/p/shikaku/'+U,U,true),true);
ex('ほかの人を100%の名簿に入れられない',await req('PUT',P+'/p/shikaku/'+U2,U,true),false);
ex('ランキングは読める',await req('GET',P+'/r/maru'),true);
const q=await req('GET',P+'/r/maru',null,undefined,'&orderBy=%22k%22&endAt=99999&limitToLast=30');ex('点の順に読める',q,true);if(!(q.j&&q.j[U]&&q.j[U].s===98123)){fail++;console.log('NG  順に読んだ中身がちがう',JSON.stringify(q.j));}
const q2=await req('GET',P+'/r/shikaku',null,undefined,'&orderBy=%22k%22&equalTo=100000&limitToFirst=30');ex('100%の人を読める',q2,true);if(!(q2.j&&q2.j[U])){fail++;console.log('NG  100%の中身がちがう');}
const q3=await req('GET',P+'/p/shikaku',null,undefined,'&shallow=true');ex('100%の人数を読める',q3,true);if(!(q3.j&&q3.j[U]===true)){fail++;console.log('NG  人数の中身がちがう',JSON.stringify(q3.j));}
ex('ほかの人のチケットは読めない',await req('GET',P+'/last/'+U,U2),false);
await sleep(1700);
ex('チケットは1.5秒に1回まで',await req('PUT',P+'/last/'+U,U,{t:TS}),true);
ex('すぐ次のチケットは取れない',await req('PUT',P+'/last/'+U,U,{t:TS}),false);
console.log(fail?('失敗 '+fail+' 件'):'すべて OK');process.exit(fail?1:0);
