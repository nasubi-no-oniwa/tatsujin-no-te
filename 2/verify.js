// ランキングの記録を、線から点を計算しなおして確かめる（画面が止まらないように別の働き手で）
import * as S from './sim.js?v=1';
onmessage = e => { const { id, ev, p, s } = e.data; let ok = false; try { ok = !!S.verify(ev, p, s); } catch (_) {} postMessage({ id, ok }); };
