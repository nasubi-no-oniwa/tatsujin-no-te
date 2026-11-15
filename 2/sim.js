// 達人の手２：描いた線から点（精度）を計算する。
// ゲームの画面とランキングの確かめで同じものを使う。同じ線なら、点は必ず同じ。
export const VER = 2;
export const EVENTS = ['hoshi', 'heart', 'uzu', 'sen', 'hana'];
export const MARK = { hoshi: '☆', heart: '♡', uzu: '🌀', sen: '／', hana: '✿' };
export const N = 120;         // 1つの記録に入れる点の数
export const QM = 4095;       // 紙の一辺を 0〜4095 に分ける
export const MAXMS = 7000;    // 制限時間
export const MINSIZE = 0.5;   // 紙の一辺に対する、形の最小の大きさ
export const FULL = 100000;   // 100.000%
export const PLEN = N * 4;    // 記録の文字の長さ
const EPS = 0.0015;           // これより小さいずれは 0 とみなす
const K = { hoshi: 3, heart: 3, uzu: 3, sen: 4, hana: 3 };  // 平均のずれ 1% で何点引くか
const TAU = Math.PI * 2;
const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const P_RE = new RegExp('^[A-Za-z0-9_-]{' + PLEN + '}$');
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

// ===== 指の動き → 記録用の点（時間で等間隔） =====
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
export function pack(ev, strokes) { if (strokes.length < 1) return null; return resample(strokes[0], N); }

// ===== 共通 =====
function weights(P) {
  const w = new Array(P.length).fill(0); let L = 0;
  for (let i = 0; i < P.length - 1; i++) { const d = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); w[i] += d / 2; w[i + 1] += d / 2; L += d; }
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
function finish(o) { const E = Math.max(0, o.E); o.E = E; o.s = Math.round(FULL * cl(1 - K[o.ev] * E, 0, 1)); return o; }
function closeTerm(th) {
  const a = Math.abs(th) / TAU;
  const gap = Math.max(0, 1 - a - 0.002), over = Math.max(0, a - 1.1);
  return { gap, over, E: 0.5 * gap + 0.5 * over };
}
// 点と線分の距離（と、その線分上のいちばん近い点）
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
  let k = L2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / L2 : 0; k = k < 0 ? 0 : k > 1 ? 1 : k;
  const qx = ax + vx * k, qy = ay + vy * k;
  return [Math.hypot(px - qx, py - qy), qx, qy];
}

// ===== お手本の形（真ん中が 0,0、いちばん外が 1、上向き。画面は下がプラス） =====
const TM = 240;   // お手本の点の数
const coarse = T => T.filter((_, i) => i % 4 === 0);
function polar(f) { const o = []; for (let i = 0; i < TM; i++) { const a = -Math.PI / 2 + TAU * i / TM, r = f(a); o.push([r * Math.cos(a), r * Math.sin(a)]); } return o; }
// ☆のふち：外の角と内の角（正五芒星の比 0.382）を直線でつなぐ
const STAR_IN = (3 - Math.sqrt(5)) / 2;
const T_HOSHI = (() => {
  const v = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + Math.PI * k / 5, r = k % 2 ? STAR_IN : 1; v.push([r * Math.cos(a), r * Math.sin(a)]); }
  const o = [], per = TM / 10;
  for (let k = 0; k < 10; k++) { const A = v[k], B = v[(k + 1) % 10]; for (let j = 0; j < per; j++) { const u = j / per; o.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u]); } }
  return o;
})();
// ハート：よく知られた式。真ん中を形の重心に合わせ、いちばん外を 1 にする
const T_HEART = (() => {
  let o = []; for (let i = 0; i < TM; i++) { const t = TAU * i / TM, s = Math.sin(t); o.push([16 * s * s * s, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
  let mx = 0, my = 0; for (const p of o) { mx += p[0]; my += p[1]; } mx /= o.length; my /= o.length;
  let R = 0; for (const p of o) R = Math.max(R, Math.hypot(p[0] - mx, p[1] - my));
  return o.map(p => [(p[0] - mx) / R, (p[1] - my) / R]);
})();
// 花びら5枚：5つの円をつないだ形。くびれの深さ q（くびれの半径／外の半径）は描いた人に合わせる
const HANA_Q = [0.4, 0.48, 0.56, 0.64, 0.72, 0.8];
function hanaTpl(q) {
  const h = Math.PI / 5; let lo = 0.01, hi = 0.99;   // 花びらの円の中心までの距離 d を、くびれが q になるように決める
  for (let it = 0; it < 60; it++) { const d = (lo + hi) / 2, p = 1 - d, s = p * p - d * d * Math.sin(h) ** 2, rn = s >= 0 ? d * Math.cos(h) + Math.sqrt(s) : 0; if (rn > q) lo = d; else hi = d; }
  const d = (lo + hi) / 2, p = 1 - d;
  return polar(a => { const k = Math.round((a + Math.PI / 2) / (TAU / 5)), D = wrap(a + Math.PI / 2 - k * TAU / 5), s = p * p - d * d * Math.sin(D) ** 2; return s >= 0 ? d * Math.cos(D) + Math.sqrt(s) : d * Math.cos(D); });
}
const T_HANA = HANA_Q.map(hanaTpl);
const C_HOSHI = coarse(T_HOSHI), C_HEART = coarse(T_HEART), C_HANA = T_HANA.map(coarse);

// お手本を、場所・大きさ・傾きを合わせて重ねる
const EPSC = 0.01;  // 描いていないところの判定は、角が少し丸くなるぶんを見のがす
const HW = 14;
function tplCost(P, w, sw, T, cx, cy, sc, ph, full, cstep, hint) {
  const co = Math.cos(ph) * sc, si = Math.sin(ph) * sc, M = T.length, X = new Array(M), Y = new Array(M);
  for (let j = 0; j < M; j++) { X[j] = cx + T[j][0] * co - T[j][1] * si; Y[j] = cy + T[j][0] * si + T[j][1] * co; }
  let c = 0; const d = full ? new Array(P.length) : null, nq = full ? new Array(P.length) : null, hi = new Array(P.length);
  for (let i = 0; i < P.length; i++) {
    let b = Infinity, bx = 0, by = 0, bj = 0;
    // hint があるときは、前にいちばん近かった場所のまわりだけ探す
    const j0 = hint ? hint[i] - HW : 0, j1 = hint ? hint[i] + HW : M - 1;
    for (let jj = j0; jj <= j1; jj++) { const j = ((jj % M) + M) % M, k = (j + 1) % M, r = segDist(P[i][0], P[i][1], X[j], Y[j], X[k], Y[k]); if (r[0] < b) { b = r[0]; bx = r[1]; by = r[2]; bj = j; } }
    c += w[i] * b * b; hi[i] = bj; if (full) { d[i] = b; nq[i] = [bx, by]; }
  }
  c /= sw;
  // 描いていないところがないか（お手本の側から、描いた線までの距離）
  let cv = 0, cvA = 0; const step = cstep || 2;
  for (let j = 0; j < M; j += step) {
    let b = Infinity; for (let i = 0; i < P.length - 1; i++) { const r = segDist(X[j], Y[j], P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]); if (r[0] < b) b = r[0]; }
    cv += b * b; cvA += Math.max(0, b / sc - EPSC);
  }
  const nT = Math.ceil(M / step); cv /= nT; cvA /= nT;
  return { c: c + 0.5 * cv, d, nq, cvA, X, Y, hi };
}
function fitTpl(P, ev, T, sym, Tc, start) {
  const { w, L } = weights(P);
  if (!(L > 0)) return null;
  let sw = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { sw += w[i]; cx += w[i] * P[i][0]; cy += w[i] * P[i][1]; }
  cx /= sw; cy /= sw;
  let mr = 0; for (let i = 0; i < P.length; i++) mr += w[i] * Math.hypot(P[i][0] - cx, P[i][1] - cy); mr /= sw;
  let tr = 0; for (const p of T) tr += Math.hypot(p[0], p[1]); tr /= T.length;
  let sc = mr / tr;
  const per = TAU / sym, NS = sym === 1 ? 48 : 24;
  let ph = 0, best = Infinity;
  const search = (TT, cs, dc, dp, ds, minDc) => {
    best = tplCost(P, w, sw, TT, cx, cy, sc, ph, false, cs).c;
    for (let it = 0; it < 40; it++) {
      let moved = false;
      for (const [ax, ay, ap, as] of [[dc, 0, 0, 0], [-dc, 0, 0, 0], [0, dc, 0, 0], [0, -dc, 0, 0], [0, 0, dp, 0], [0, 0, -dp, 0], [0, 0, 0, ds], [0, 0, 0, -ds]]) {
        const c = tplCost(P, w, sw, TT, cx + ax, cy + ay, sc * (1 + as), ph + ap, false, cs).c;
        if (c < best - 1e-9) { best = c; cx += ax; cy += ay; ph += ap; sc *= 1 + as; moved = true; }
      }
      if (!moved) { dc /= 2; dp /= 2; ds /= 2; if (dc < minDc) break; }
    }
  };
  if (start) { cx = start.cx; cy = start.cy; sc = start.sc; ph = start.ph; if (P.fast) search(Tc, 3, sc * 0.01, 0.01, 0.01, sc * 0.004); }
  else {
    for (let k = 0; k < NS; k++) { const a = per * k / NS, c = tplCost(P, w, sw, Tc, cx, cy, sc, a, false, 3).c; if (c < best) { best = c; ph = a; } }
    search(Tc, 3, sc * 0.06, per / NS / 2, 0.04, sc * 0.004);
  }
  if (P.fast) return { cost: best, cx, cy, sc, ph };
  // 細かいお手本で仕上げる（近い場所の見当をつけてから、そのまわりだけ探す）
  const h0 = tplCost(P, w, sw, T, cx, cy, sc, ph, false, 4).hi;
  const hs = (TT, cs) => { let b2 = tplCost(P, w, sw, TT, cx, cy, sc, ph, false, cs, h0).c, dc = sc * 0.004, dp = 0.004, ds = 0.003;
    for (let it = 0; it < 30; it++) { let moved = false;
      for (const [ax, ay, ap, as] of [[dc, 0, 0, 0], [-dc, 0, 0, 0], [0, dc, 0, 0], [0, -dc, 0, 0], [0, 0, dp, 0], [0, 0, -dp, 0], [0, 0, 0, ds], [0, 0, 0, -ds]]) {
        const c = tplCost(P, w, sw, TT, cx + ax, cy + ay, sc * (1 + as), ph + ap, false, cs, h0).c;
        if (c < b2 - 1e-9) { b2 = c; cx += ax; cy += ay; ph += ap; sc *= 1 + as; moved = true; } }
      if (!moved) { dc /= 2; dp /= 2; ds /= 2; if (dc < 0.3) break; } }
    best = b2; };
  hs(T, 6);
  const f = tplCost(P, w, sw, T, cx, cy, sc, ph, true, 2);
  if (!(sc > 1)) return null;
  const dev = []; let Er = 0;
  for (let i = 0; i < P.length; i++) {
    const out = Math.hypot(P[i][0] - cx, P[i][1] - cy) >= Math.hypot(f.nq[i][0] - cx, f.nq[i][1] - cy);
    const e = (out ? 1 : -1) * f.d[i] / sc; dev.push(e); Er += w[i] * Math.max(0, Math.abs(e) - EPS);
  }
  Er /= sw;
  const th = winding(P, cx, cy), ct = closeTerm(th);
  const ideal = []; for (let j = 0; j < f.X.length; j++) ideal.push([f.X[j], f.Y[j]]);
  const o = { ev, cx, cy, sc, ph, req: sc * 0.62, dev, th, gap: ct.gap, over: ct.over, Eshape: Er, Ecov: f.cvA, E: Er + 0.5 * f.cvA + ct.E, ideal, closed: true, cost: best, w };
  return o;
}
function noteTpl(o, P) {
  if (o.E <= 0) { o.note = 'perfect'; o.wi = 0; return; }
  const ctE = 0.5 * o.gap + 0.5 * o.over;
  if (ctE > o.Eshape && ctE > 0.5 * o.Ecov) { o.note = o.gap > 0 ? 'gap' : 'over'; o.wi = P.length - 1; return; }
  let bi = 0, bv = -1; for (let i = 0; i < P.length; i++) { const v = Math.abs(o.dev[i]); if (v > bv && o.w[i] > 0) { bv = v; bi = i; } }
  o.wi = bi; o.note = o.dev[bi] >= 0 ? 'bulge' : 'dent'; o.dir = dir8(P[bi][0] - o.cx, P[bi][1] - o.cy);
}

// ===== ☆・ハート・花 =====
function scoreTpl(P, ev) {
  let o;
  if (ev === 'hoshi') o = fitTpl(P, ev, T_HOSHI, 5, C_HOSHI);
  else if (ev === 'heart') o = fitTpl(P, ev, T_HEART, 1, C_HEART);
  else {
    // くびれの深さを1つずつ粗く試して、いちばん合うものだけ細かく合わせる
    let bq = -1, bs = null; const Pf = P.slice(); Pf.fast = true;
    const mid = fitTpl(Pf, ev, T_HANA[2], 5, C_HANA[2]);
    if (mid) for (let qi = 0; qi < T_HANA.length; qi++) { const r = qi === 2 ? mid : fitTpl(Pf, ev, T_HANA[qi], 5, C_HANA[qi], mid); if (r && (!bs || r.cost < bs.cost)) { bs = r; bq = qi; } }
    if (bs) { o = fitTpl(P, ev, T_HANA[bq], 5, C_HANA[bq], bs); if (o) o.q = HANA_Q[bq]; }
  }
  if (!o) return { err: 'short' };
  noteTpl(o, P); delete o.w; delete o.cost;
  return finish(o);
}

// ===== 直線 =====
function scoreSen(P) {
  const { w, L } = weights(P);
  if (!(L > 0)) return { err: 'short' };
  let sw = 0, mx = 0, my = 0; for (let i = 0; i < P.length; i++) { sw += w[i]; mx += w[i] * P[i][0]; my += w[i] * P[i][1]; } mx /= sw; my /= sw;
  let xx = 0, xy = 0, yy = 0; for (let i = 0; i < P.length; i++) { const u = P[i][0] - mx, v = P[i][1] - my; xx += w[i] * u * u; xy += w[i] * u * v; yy += w[i] * v * v; }
  let ph = 0.5 * Math.atan2(2 * xy, xx - yy);
  const co = Math.cos(ph), si = Math.sin(ph);
  const u = [], v = []; let u0 = 1e9, u1 = -1e9;
  for (let i = 0; i < P.length; i++) { const dx = P[i][0] - mx, dy = P[i][1] - my; u.push(dx * co + dy * si); v.push(-dx * si + dy * co); u0 = Math.min(u0, u[i]); u1 = Math.max(u1, u[i]); }
  const hl = (u1 - u0) / 2;
  if (!(hl > 1)) return { err: 'short' };
  // 行ったり来たり：進む向きと逆に動いた長さ
  const fwd = u[P.length - 1] >= u[0] ? 1 : -1; let back = 0;
  for (let i = 0; i < P.length - 1; i++) { const d = (u[i + 1] - u[i]) * fwd; if (d < 0) back -= d; }
  const dev = []; let Er = 0, sgn = 0, pos = 0, neg = 0;
  for (let i = 0; i < P.length; i++) { const e = v[i] / hl; dev.push(e); Er += w[i] * Math.max(0, Math.abs(e) - EPS); if (e > EPS) pos += w[i]; if (e < -EPS) neg += w[i]; }
  Er /= sw; const Eb = Math.max(0, back / (2 * hl) - 0.002);
  const cu = (u0 + u1) / 2;
  const ideal = [[mx + (u0) * co, my + (u0) * si], [mx + (u1) * co, my + (u1) * si]];
  const o = { ev: 'sen', cx: mx + cu * co, cy: my + cu * si, ph, hl, req: hl, dev, Eshape: Er, Eback: Eb, E: Er + Eb, ideal, closed: false };
  let wi = 0, bv = -1; for (let i = 0; i < P.length; i++) if (Math.abs(dev[i]) > bv) { bv = Math.abs(dev[i]); wi = i; } o.wi = wi;
  if (o.E <= 0) o.note = 'perfect';
  else if (Eb > Er) o.note = 'back';
  else { let ch = 0; for (let i = 1; i < P.length; i++) if (Math.sign(dev[i]) !== Math.sign(dev[i - 1]) && Math.abs(dev[i]) > EPS) ch++; o.note = ch >= 4 && Math.min(pos, neg) > 0.2 * sw ? 'wave' : 'bend'; }
  return finish(o);
}

// ===== 渦巻き（線と線の間が同じ幅のアルキメデスの渦巻き） =====
function uzuFit(P, cx, cy) {
  const n = P.length, th = new Array(n), r = new Array(n); let acc = 0, prev = Math.atan2(P[0][1] - cy, P[0][0] - cx);
  for (let i = 0; i < n; i++) { const a = Math.atan2(P[i][1] - cy, P[i][0] - cx); if (i) acc += wrap(a - prev); prev = a; th[i] = acc; r[i] = Math.hypot(P[i][0] - cx, P[i][1] - cy); }
  let st = 0, sr = 0, stt = 0, str = 0; for (let i = 0; i < n; i++) { st += th[i]; sr += r[i]; stt += th[i] * th[i]; str += th[i] * r[i]; }
  const det = n * stt - st * st; const b = det > 1e-9 ? (n * str - st * sr) / det : 0, a = (sr - b * st) / n;
  let c = 0, R = 0; const res = new Array(n); for (let i = 0; i < n; i++) { res[i] = r[i] - (a + b * th[i]); c += res[i] * res[i]; R = Math.max(R, Math.abs(a + b * th[i])); }
  return { c: c / n, a, b, th, r, res, R, turns: Math.abs(acc) / TAU };
}
function scoreUzu(P) {
  const { w, L } = weights(P);
  if (!(L > 0)) return { err: 'short' };
  // 真ん中は、描きはじめか描きおわりの近く（内側のはし）
  let mx = 0, my = 0; for (const p of P) { mx += p[0]; my += p[1]; } mx /= P.length; my /= P.length;
  const k = Math.max(3, Math.round(P.length * 0.08));
  const endC = (a, b) => { let x = 0, y = 0; for (let i = a; i < b; i++) { x += P[i][0]; y += P[i][1]; } return [x / (b - a), y / (b - a)]; };
  const A = endC(0, k), B = endC(P.length - k, P.length);
  const inner = Math.hypot(A[0] - mx, A[1] - my) < Math.hypot(B[0] - mx, B[1] - my) ? A : B;
  let best = null, cx = 0, cy = 0;
  const bb = bbox(P), span = Math.max(bb.w, bb.h);
  for (let gx = -3; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) {
    const x = (inner[0] + mx) / 2 + gx * span * 0.04, y = (inner[1] + my) / 2 + gy * span * 0.04, f = uzuFit(P, x, y);
    if (!best || f.c < best.c) { best = f; cx = x; cy = y; }
  }
  let dc = span * 0.02;
  for (let it = 0; it < 40; it++) {
    let moved = false;
    for (const [ax, ay] of [[dc, 0], [-dc, 0], [0, dc], [0, -dc]]) { const f = uzuFit(P, cx + ax, cy + ay); if (f.c < best.c - 1e-9) { best = f; cx += ax; cy += ay; moved = true; } }
    if (!moved) { dc /= 2; if (dc < 0.2) break; }
  }
  const f = best;
  if (f.turns < 1.9) return { err: 'turns' };
  const R = f.R; if (!(R > 1)) return { err: 'short' };
  const dev = []; let Er = 0, sw = 0, c2 = 0, s2 = 0;
  for (let i = 0; i < P.length; i++) { const e = f.res[i] / R; dev.push(e); Er += w[i] * Math.max(0, Math.abs(e) - EPS); sw += w[i]; const a = Math.atan2(P[i][1] - cy, P[i][0] - cx); c2 += w[i] * e * Math.cos(2 * a); s2 += w[i] * e * Math.sin(2 * a); }
  Er /= sw;
  const ideal = []; const t0 = f.th[0], t1 = f.th[P.length - 1], a0 = Math.atan2(P[0][1] - cy, P[0][0] - cx);
  for (let j = 0; j <= 200; j++) { const t = t0 + (t1 - t0) * j / 200, rr = f.a + f.b * t; ideal.push([cx + rr * Math.cos(a0 + t), cy + rr * Math.sin(a0 + t)]); }
  const o = { ev: 'uzu', cx, cy, R, req: R, turns: f.turns, gapW: Math.abs(f.b) * TAU, dev, Eshape: Er, E: Er, ideal, closed: false };
  let wi = 0, bv = -1; for (let i = 0; i < P.length; i++) if (Math.abs(dev[i]) > bv) { bv = Math.abs(dev[i]); wi = i; } o.wi = wi;
  if (o.E <= 0) o.note = 'perfect';
  else { const A2 = 2 * Math.hypot(c2, s2) / sw; if (A2 > Er * 0.9) { const ph = Math.atan2(s2, c2) / 2; const q = ((Math.round(ph / (Math.PI / 4)) % 4) + 4) % 4; o.note = q === 0 ? 'wide' : q === 2 ? 'tall' : 'slant'; } else o.note = 'uneven'; }
  return finish(o);
}

// ===== 点を出す =====
// pts: N 点（0〜4095）。{s:0〜100000, ...} か {err:'small'|'short'|'turns'} を返す
export function score(ev, pts) {
  if (!pts || pts.length !== N) return { err: 'short' };
  if (sizeOf(pts) < MINSIZE) return { err: 'small' };
  if (ev === 'hoshi' || ev === 'heart' || ev === 'hana') return scoreTpl(pts, ev);
  if (ev === 'sen') return scoreSen(pts);
  if (ev === 'uzu') return scoreUzu(pts);
  return { err: 'short' };
}
// ランキングの確かめ：記録の文字から点を計算しなおす（合わなければ null）
export function verify(ev, p, s) {
  const pts = decode(p); if (!pts) return null;
  const o = score(ev, pts); if (!o || o.err) return null;
  return Math.abs(o.s - s) <= 3 ? o : null;
}
export const pct = s => (s / 1000).toFixed(3);
export const TEMPLATES = { hoshi: T_HOSHI, heart: T_HEART, hana: T_HANA[3] };
