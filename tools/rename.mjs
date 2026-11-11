// ランキングの名前を直す（tools/rename.json に書いたものだけ）。
// 種目・いまの名前・点がすべて合う記録が1件だけのときに、名前だけを書きかえる（点や線はさわらない）
import fs from 'fs';
import { token, api } from './fb.mjs';
const list = JSON.parse(fs.readFileSync('tools/rename.json', 'utf8'));
const tk = await token();
let bad = 0;
for (const x of list) {
  if (!/^(maru|sankaku|shikaku|batsu)$/.test(x.board) || typeof x.to !== 'string' || x.to.length < 1 || x.to.length > 16) { console.log('書き方がちがう', JSON.stringify(x)); bad++; continue; }
  const all = JSON.parse(await api('GET', '/tatsujin/r/' + x.board + '.json', undefined, tk)) || {};
  const hit = Object.entries(all).filter(([, v]) => v && v.n === x.from && (x.s == null || v.s === x.s));
  const done = Object.entries(all).filter(([, v]) => v && v.n === x.to && (x.s == null || v.s === x.s));
  if (!hit.length && done.length === 1) { console.log('もう直っている：', x.board, x.to, x.s); continue; }
  if (hit.length !== 1) { console.log('見つかった数が1件ではないので直さない：', x.board, x.from, x.s, '→', hit.length, '件'); bad++; continue; }
  const [uid] = hit[0];
  await api('PUT', '/tatsujin/r/' + x.board + '/' + uid + '/n.json', JSON.stringify(x.to), tk);
  const after = JSON.parse(await api('GET', '/tatsujin/r/' + x.board + '/' + uid + '.json', undefined, tk));
  if (after && after.n === x.to && after.s === hit[0][1].s) console.log('直しました：', x.board, x.from, '→', x.to, '（' + (after.s / 1000).toFixed(3) + '%）');
  else { console.log('直したあとの確認が合いません'); bad++; }
}
if (bad) process.exit(1);
