// 達人の手：描いた線から点（精度）を計算する。
// ゲームの画面とランキングの確かめで同じものを使う。同じ線なら、点は必ず同じ。
export const VER = 1;
export const EVENTS = ['maru', 'sankaku', 'shikaku', 'batsu'];
export const MARK = { maru: '〇', sankaku: '△', shikaku: '■', batsu: '✖' };
export const N = 72;          // 1つの記録に入れる点の数（✖は36＋36）
export const QM = 4095;       // 紙の一辺を 0〜4095 に分ける
export const MAXMS = 7000;    // 制限時間
export const MINSIZE = 0.5;   // 紙の一辺に対する、形の最小の大きさ
export const FULL = 100000;   // 100.000%
const EPS = 0.0015;           // これより小さいずれは 0 とみなす（画面の1点より細かい）
const K = 3;                  // 平均のずれ 1% で 3 点引く
const TAU = Math.PI * 2;
const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const P_RE = /^[A-Za-z0-9_-]{288}$/;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;

// ===== 記録の文字 ⇔ 点 =====
export function encode(pts) {
  let s = '';
  for (let i = 0; i < N; i++) {
    const x = cl(Math.round(pts[i][0]), 0, QM), y = cl(Math.round(pts[i][1]), 0, QM);
    s += AB[x >> 6] + AB[x & 63] + AB[y >> 6] + AB[y & 63];
  }
  return s;
}
export function decode(s) {
  if (typeof s !== 'string' || !P_RE.test(s)) return null;
  const o = [];
  for (let i = 0; i < N; i++) {
    const a = AB.indexOf(s[i * 4]), b = AB.indexOf(s[i * 4 + 1]), c = AB.indexOf(s[i * 4 + 2]), d = AB.indexOf(s[i * 4 + 3]);
    o.push([a * 64 + b, c * 64 + d]);
  }
  return o;
}

// ===== 指の動き → 記録用の点 =====
// raw: [{x,y,t}]（x,y は紙の一辺を 1 とした場所、t はミリ秒）を、時間で等間隔の n 点にする
export function resample(raw, n) {
  const o = [];
  if (!raw || !raw.length) return o;
  const t0 = raw[0].t, t1 = raw[raw.length - 1].t, span = Math.max(1, t1 - t0);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + span * i / (n - 1);
    while (j < raw.length - 2 && raw[j + 1].t < t) j++;
    const a = raw[j], b = raw[Math.min(j + 1, raw.length - 1)];
    const k = b.t > a.t ? cl((t - a.t) / (b.t - a.t), 0, 1) : 0;
    o.push([cl(Math.round((a.x + (b.x - a.x) * k) * QM), 0, QM), cl(Math.round((a.y + (b.y - a.y) * k) * QM), 0, QM)]);
  }
  return o;
}
// strokes: 1本（〇△■）か2本（✖）の raw。記録用の N 点にまとめる
export function pack(ev, strokes) {
  if (ev === 'batsu') { if (strokes.length < 2) return null; return resample(strokes[0], N / 2).concat(resample(strokes[1], N / 2)); }
  if (strokes.length < 1) return null; return resample(strokes[0], N);
}

// ===== 点の重み（線の長さ） =====
function weights(P, a, b) {
  const w = new Array(b - a).fill(0);
  let L = 0;
  for (let i = a; i < b - 1; i++) { const d = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); w[i - a] += d / 2; w[i + 1 - a] += d / 2; L += d; }
  return { w, L };
}
function bbox(P) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
export function sizeOf(P) { const b = bbox(P); return Math.max(b.w, b.h) / QM; }
function wrap(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function winding(P, cx, cy) {
  let th = 0;
  for (let i = 0; i < P.length - 1; i++) th += wrap(Math.atan2(P[i + 1][1] - cy, P[i + 1][0] - cx) - Math.atan2(P[i][1] - cy, P[i][0] - cx));
  return th;
}
// 8方向（0=右, 1=右下, 2=下, 3=左下, 4=左, 5=左上, 6=上, 7=右上）※画面は下がプラス
function dir8(dx, dy) { return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8; }
function finish(o) {
  const E = Math.max(0, o.E);
  o.E = E; o.s = Math.round(FULL * cl(1 - K * E, 0, 1));
  return o;
}
// つなぎ目のずれ（閉じていない・回りすぎ）
function closeTerm(th) {
  const a = Math.abs(th) / TAU;
  const gap = Math.max(0, 1 - a - 0.002), over = Math.max(0, a - 1.1);
  return { gap, over, E: 0.5 * gap + 0.5 * over };
}
function worstNote(P, w, dev, cx, cy) {
  let bi = 0, bv = -1;
  for (let i = 0; i < P.length; i++) { const v = Math.abs(dev[i]); if (v > bv && w[i] > 0) { bv = v; bi = i; } }
  return { note: dev[bi] >= 0 ? 'bulge' : 'dent', dir: dir8(P[bi][0] - cx, P[bi][1] - cy), wi: bi };
}

// ===== 〇 =====
function scoreMaru(P) {
  const { w, L } = weights(P, 0, P.length);
  if (!(L > 0)) return { err: 'short' };
  // 重みつきの最小二乗で円を合わせる
  let sw = 0, mx = 0, my = 0;
  for (let i = 0; i < P.length; i++) { sw += w[i]; mx += w[i] * P[i][0]; my += w[i] * P[i][1]; }
  mx /= sw; my /= sw;
  let suu = 0, suv = 0, svv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (let i = 0; i < P.length; i++) { const u = P[i][0] - mx, v = P[i][1] - my, q = w[i]; suu += q * u * u; suv += q * u * v; svv += q * v * v; suuu += q * u * u * u; svvv += q * v * v * v; suvv += q * u * v * v; svuu += q * v * u * u; }
  const det = suu * svv - suv * suv;
  let cx = mx, cy = my;
  if (Math.abs(det) > 1e-9) { const a = (suuu + suvv) / 2, b = (svvv + svuu) / 2; cx = mx + (a * svv - b * suv) / det; cy = my + (b * suu - a * suv) / det; }
  let r = 0; const d = [];
  for (let i = 0; i < P.length; i++) { const x = Math.hypot(P[i][0] - cx, P[i][1] - cy); d.push(x); r += w[i] * x; }
  r /= sw;
  if (!(r > 1)) return { err: 'short' };
  const dev = []; let Er = 0, c2 = 0, s2 = 0;
  for (let i = 0; i < P.length; i++) { const e = (d[i] - r) / r; dev.push(e); Er += w[i] * Math.max(0, Math.abs(e) - EPS); const a = Math.atan2(P[i][1] - cy, P[i][0] - cx); c2 += w[i] * e * Math.cos(2 * a); s2 += w[i] * e * Math.sin(2 * a); }
  Er /= sw;
  const th = winding(P, cx, cy), ct = closeTerm(th);
  const o = { ev: 'maru', cx, cy, r, req: r, dev, th, gap: ct.gap, over: ct.over, Eshape: Er, E: Er + ct.E };
  if (o.E <= 0) o.note = 'perfect';
  else if (ct.E > Er) o.note = ct.gap > 0 ? 'gap' : 'over';
  else {
    const A2 = 2 * Math.hypot(c2, s2) / sw;
    if (A2 > Er * 0.9) { const ph = Math.atan2(s2, c2) / 2; const k = ((Math.round(ph / (Math.PI / 4)) % 4) + 4) % 4; o.note = k === 0 ? 'wide' : k === 2 ? 'tall' : 'slant'; }
    else Object.assign(o, worstNote(P, w, dev, cx, cy));
  }
  if (o.wi == null) { let bi = 0, bv = -1; for (let i = 0; i < P.length; i++) if (Math.abs(dev[i]) > bv) { bv = Math.abs(dev[i]); bi = i; } o.wi = bi; }
  return finish(o);
}

// ===== △ ■（正三角形・正方形を、場所・大きさ・傾きを合わせて重ねる） =====
function polyCost(P, w, sw, n, cx, cy, ph) {
  const sec = TAU / n; let su = 0; const u = new Array(P.length);
  for (let i = 0; i < P.length; i++) {
    const dx = P[i][0] - cx, dy = P[i][1] - cy, d = Math.hypot(dx, dy);
    let a = (Math.atan2(dy, dx) - ph) % sec; if (a < 0) a += sec; a -= sec / 2;
    u[i] = d * Math.cos(a); su += w[i] * u[i];
  }
  const h = su / sw; let c = 0;
  for (let i = 0; i < P.length; i++) { const e = u[i] - h; c += w[i] * e * e; }
  return { c: c / sw, h, u };
}
function scorePoly(P, n, ev) {
  const { w, L } = weights(P, 0, P.length);
  if (!(L > 0)) return { err: 'short' };
  let sw = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { sw += w[i]; cx += w[i] * P[i][0]; cy += w[i] * P[i][1]; }
  cx /= sw; cy /= sw;
  const sec = TAU / n; let ph = 0, best = Infinity;
  for (let k = 0; k < 90; k++) { const a = sec * k / 90, c = polyCost(P, w, sw, n, cx, cy, a).c; if (c < best) { best = c; ph = a; } }
  const b = bbox(P); let dc = Math.max(b.w, b.h) * 0.05, dp = sec / 90;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (const [ax, ay, ap] of [[dc, 0, 0], [-dc, 0, 0], [0, dc, 0], [0, -dc, 0], [0, 0, dp], [0, 0, -dp]]) {
      const c = polyCost(P, w, sw, n, cx + ax, cy + ay, ph + ap).c;
      if (c < best - 1e-12) { best = c; cx += ax; cy += ay; ph += ap; moved = true; }
    }
    if (!moved) { dc /= 2; dp /= 2; }
  }
  const f = polyCost(P, w, sw, n, cx, cy, ph), h = f.h;
  if (!(h > 1)) return { err: 'short' };
  const req = n * h * Math.tan(Math.PI / n) / Math.PI;
  const dev = []; let Er = 0;
  for (let i = 0; i < P.length; i++) { const e = (f.u[i] - h) / req; dev.push(e); Er += w[i] * Math.max(0, Math.abs(e) - EPS); }
  Er /= sw;
  const th = winding(P, cx, cy), ct = closeTerm(th);
  const o = { ev, n, cx, cy, h, ph, R: h / Math.cos(Math.PI / n), req, dev, th, gap: ct.gap, over: ct.over, Eshape: Er, E: Er + ct.E };
  if (o.E <= 0) { o.note = 'perfect'; o.wi = 0; }
  else if (ct.E > Er) { o.note = ct.gap > 0 ? 'gap' : 'over'; o.wi = P.length - 1; }
  else Object.assign(o, worstNote(P, w, dev, cx, cy));
  return finish(o);
}
// 重ねる正多角形の角の場所
export function polyVerts(fit) {
  const v = [], sec = TAU / fit.n;
  for (let k = 0; k < fit.n; k++) { const a = fit.ph + sec * k; v.push([fit.cx + fit.R * Math.cos(a), fit.cy + fit.R * Math.sin(a)]); }
  return v;
}

// ===== ✖（同じ長さの2本が、真ん中で直角に交わる形を重ねる） =====
function batsuCost(P, wA, wB, sw, cx, cy, ph) {
  const co = Math.cos(ph), si = Math.sin(ph), h = N / 2; let c = 0;
  const al = [0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    const dx = P[i][0] - cx, dy = P[i][1] - cy, along1 = dx * co + dy * si, along2 = -dx * si + dy * co;
    const A = i < h, perp = A ? along2 : along1, al0 = A ? along1 : along2, q = A ? wA[i] : wB[i - h];
    c += q * perp * perp;
    if (i === 0) al[0] = al0; else if (i === h - 1) al[1] = al0; else if (i === h) al[2] = al0; else if (i === N - 1) al[3] = al0;
  }
  const a = [-Math.min(al[0], al[1]), Math.max(al[0], al[1]), -Math.min(al[2], al[3]), Math.max(al[2], al[3])];
  const R = (a[0] + a[1] + a[2] + a[3]) / 4; let e = 0;
  for (let j = 0; j < 4; j++) e += (a[j] - R) * (a[j] - R);
  return { c: c / sw + 0.25 * e / 4, R, a };
}
function lineDir(P, a, b) {
  let mx = 0, my = 0; for (let i = a; i < b; i++) { mx += P[i][0]; my += P[i][1]; } mx /= (b - a); my /= (b - a);
  let xx = 0, xy = 0, yy = 0; for (let i = a; i < b; i++) { const u = P[i][0] - mx, v = P[i][1] - my; xx += u * u; xy += u * v; yy += v * v; }
  return 0.5 * Math.atan2(2 * xy, xx - yy);
}
function scoreBatsu(P) {
  const h = N / 2, A = weights(P, 0, h), B = weights(P, h, N);
  if (!(A.L > 0) || !(B.L > 0)) return { err: 'short' };
  const sw = A.L + B.L; let cx = 0, cy = 0;
  for (let i = 0; i < N; i++) { const q = i < h ? A.w[i] : B.w[i - h]; cx += q * P[i][0]; cy += q * P[i][1]; }
  cx /= sw; cy /= sw;
  let ph = 0, best = Infinity;
  for (let k = 0; k < 180; k++) { const a = Math.PI * k / 180, c = batsuCost(P, A.w, B.w, sw, cx, cy, a).c; if (c < best) { best = c; ph = a; } }
  const bb = bbox(P); let dc = Math.max(bb.w, bb.h) * 0.05, dp = Math.PI / 180;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (const [ax, ay, ap] of [[dc, 0, 0], [-dc, 0, 0], [0, dc, 0], [0, -dc, 0], [0, 0, dp], [0, 0, -dp]]) {
      const c = batsuCost(P, A.w, B.w, sw, cx + ax, cy + ay, ph + ap).c;
      if (c < best - 1e-12) { best = c; cx += ax; cy += ay; ph += ap; moved = true; }
    }
    if (!moved) { dc /= 2; dp /= 2; }
  }
  const f = batsuCost(P, A.w, B.w, sw, cx, cy, ph), R = f.R;
  if (!(R > 1)) return { err: 'short' };
  const co = Math.cos(ph), si = Math.sin(ph), dev = []; let Ep = 0, EA = 0, EB = 0;
  for (let i = 0; i < N; i++) {
    const dx = P[i][0] - cx, dy = P[i][1] - cy, isA = i < h, perp = (isA ? (-dx * si + dy * co) : (dx * co + dy * si)) / R, q = isA ? A.w[i] : B.w[i - h];
    dev.push(perp); const e = q * Math.max(0, Math.abs(perp) - EPS); Ep += e; if (isA) EA += e; else EB += e;
  }
  Ep /= sw;
  let Ee = 0; for (let j = 0; j < 4; j++) Ee += Math.max(0, Math.abs(f.a[j] - R) / R - EPS * 2); Ee /= 4;
  const o = { ev: 'batsu', cx, cy, R, ph, req: R, dev, ends: f.a, Eshape: Ep, Eend: Ee, E: Ep + 0.5 * Ee };
  let wi = 0, bv = -1; for (let i = 0; i < N; i++) if (Math.abs(dev[i]) > bv) { bv = Math.abs(dev[i]); wi = i; } o.wi = wi;
  if (o.E <= 0) o.note = 'perfect';
  else if (0.5 * Ee > Ep) {
    const offA = Math.abs(f.a[0] - f.a[1]), offB = Math.abs(f.a[2] - f.a[3]), lenD = Math.abs((f.a[0] + f.a[1]) - (f.a[2] + f.a[3]));
    o.note = lenD > Math.max(offA, offB) ? 'len' : 'center';
  } else {
    let ang = Math.abs(wrap(lineDir(P, 0, h) - lineDir(P, h, N)));
    if (ang > Math.PI / 2) ang = Math.PI - ang;
    const off = Math.abs(Math.PI / 2 - ang);
    // 2本がそれぞれまっすぐなら、ずれの原因は「直角でない」
    if (off > 0.05 && Math.sin(off) * 0.45 > Ep * 0.6) o.note = 'angle'; else o.note = EA >= EB ? 'bend1' : 'bend2';
  }
  return finish(o);
}

// ===== 点を出す =====
// pts: N 点（0〜4095）。{s:0〜100000, ...} か {err:'small'|'short'} を返す
export function score(ev, pts) {
  if (!pts || pts.length !== N) return { err: 'short' };
  if (sizeOf(pts) < MINSIZE) return { err: 'small' };
  let o;
  if (ev === 'maru') o = scoreMaru(pts);
  else if (ev === 'sankaku') o = scorePoly(pts, 3, ev);
  else if (ev === 'shikaku') o = scorePoly(pts, 4, ev);
  else if (ev === 'batsu') o = scoreBatsu(pts);
  else return { err: 'short' };
  return o;
}
// ランキングの確かめ：記録の文字から点を計算しなおす（合わなければ null）
export function verify(ev, p, s) {
  const pts = decode(p); if (!pts) return null;
  const o = score(ev, pts); if (!o || o.err) return null;
  return Math.abs(o.s - s) <= 3 ? o : null;
}
export const pct = s => (s / 1000).toFixed(3);
