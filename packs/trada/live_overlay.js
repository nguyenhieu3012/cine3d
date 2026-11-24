// cine3d / packs/trada/live_overlay.js  (20/11, "Tèo cướp tiệm tạp hoá?" = gta6p2)  the 2-D LIVESTREAM layer drawn over the picture: a red LIVE badge + a viewer counter that rolls, up to three chat lines
// that scroll up (hearts, "+1", "chốt"), hearts that float up the right side, ONE large readable comment card (account + text, alone on screen), a small "<name> · đang xem" chip, and a THEO DÕI button.
// OUR OWN design in the same language as gta_hud.js (dark rounded panels, thin edge, outlined `Display` 900 text): no real app UI, logo, icon set or typeface.
// Every element is a PURE FUNCTION of (ctx, t, options): nothing is kept between frames, no randomness (hash of an index), every move / pop / fade is eased.
// Each one exists as a FACTORY (times in seconds, returns a ready `kind: 'draw'` overlay with `reads` declared from the REAL visible windows, so qa.cjs read_time / read_long / draw_undeclared judge it honestly)
// and as a raw `drawXxx(ctx, t, o)`. Frame rules (1080 x 1920): nothing below y 1536; the caption band y 1260-1450 stays empty; nothing over a face in the usual shots (faces are above y 1050).
//   top row (free of the HUD): LIVE badge + viewers x 252-566, y 168-222; the chip y 232-282 (the HUD owns x 80-236 minimap and x 572-1010 money / stars)
//   chat lines: x 54-640, y 1030-1240 (the three newest, the newest at the bottom)    hearts: x 760-1000 rising from y 1240    comment card / THEO DÕI: the big-text slot, centre y 1140
//   Chat items that are texts count as messages (qa read_time: 1.0 + characters / 12 s each), so keep a chat line alive >= 1.4 s (`life`, default 2.4 s); hearts are pictures, not messages.
import { C, SLOT, hudText as T, hudMeasure as M, hudFit as fit, hudPanel as panel } from './gta_hud.js';
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ez5 = (u) => { u = clamp(u); return u * u * u * (u * (6 * u - 15) + 10); };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const backOut = (x, c = 1.7) => { x = clamp(x); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const LIVE_RED = '#ff2a4a', PINKS = ['#ff4f8a', '#ff7aa8', '#ff3a6a', '#ffa0c0', '#ffffff'], AVC = ['#ff8ab4', '#8ae0d4', '#ffd36a', '#b49af0', '#7ac8ff'];
const overlay = (o, fn, decl) => ({ kind: 'draw', t0: o.t0 - 0.02, t1: o.t1 + 0.02, fade: 0.01, ...decl, text: decl.reads ? decl.reads.map((r) => r.text).join(' | ') : 'live', fn: (ctx, t) => fn(ctx, t, o) });

// the viewer count as text: 3, 847, 1,2K, 2,4K (a rolling number shows the in-between values)
export const fmtViews = (n) => { n = Math.max(0, Math.round(n)); return n < 1000 ? String(n) : n < 10000 ? (n / 1000).toFixed(1).replace('.', ',') + 'K' : Math.round(n / 1000) + 'K'; };
export function viewersV(keys, t) { let v = keys[0][1]; for (let i = 1; i < keys.length; i++) { const [tk, val, op] = keys[i]; if (t < tk) break; v = keys[i - 1][1] + (val - keys[i - 1][1]) * ez5((t - tk) / (op?.roll ?? 0.7)); } return v; }
const heartPath = (c, x, y, s) => { c.beginPath(); c.moveTo(x, y + s * 0.62); c.bezierCurveTo(x - s * 1.25, y - s * 0.05, x - s * 0.7, y - s * 0.95, x, y - s * 0.4); c.bezierCurveTo(x + s * 0.7, y - s * 0.95, x + s * 1.25, y - s * 0.05, x, y + s * 0.62); c.closePath(); };
const quietK = (q, t) => { let k = 1; for (const [a, b] of q || []) k = Math.min(k, 1 - sm((t - a) / 0.2) * sm((b + 0.2 - t) / 0.2) * 1); return clamp(k); };   // 1 = shown, 0 = hidden (fades over 0.2 s at both ends of a quiet window)

// ================================================================ 1. liveFrame: badge + counter + chat + hearts
// o: { t0, t1, viewers: [[0, 3], [t, 1200, { roll: 0.7 }], ..., [t, 10000, { roll: 1 }]] (first key = the start value; 10000 shows as 10K),
//      chat: [{ t, name: 'minh_anh', text: '+1' | 'chốt' | 'ha ha' | null (= a heart), life: 2.4 }],
//      flood: [{ t0, t1, text: 'BÁO CÔNG AN RỒI', perSec: 6 }]   ONE sentence repeated, fast, in bigger letters, never more than three lines on screen (the flood counts as ONE message for 1.0 + n / 12 s: t1 - t0 >= 2.4 s for 15 characters),
//      freeze: [{ at, until }]   the chat layer (lines + hearts) STOPS from `at` to `until`: what is on screen stays, nothing new comes, then it fades over 0.25 s (reads are extended: a frozen line is still a message on screen),
//      hearts: [[t0, t1, perSecond], ...]   floating hearts on the right (births spread evenly),
//      quiet: [[a, b], ...]   windows where the chat and the hearts are hidden (the counter and the badge stay): the comment card needs this }
export function drawLiveFrame(ctx, t, o) {
  const inK = backOut((t - o.t0) / 0.3), out = sm((o.t1 - t) / 0.2), k = clamp(inK) * out; if (k <= 0) return; const q = quietK(o.quiet, t);
  const keys = o.viewers || [[0, 3]], v = viewersV(keys, t);
  ctx.save(); ctx.globalAlpha *= k;
  // ---- LIVE badge: red pill with a pulsing white dot, then the viewers (eye + count) in a dark pill
  { const x0 = 252, y0 = 168, h = 54, dot = 0.55 + 0.45 * Math.sin(t * 5.4); ctx.save(); ctx.translate(0, (1 - clamp(inK)) * -30);
    panel(ctx, x0, y0, 124, h, { r: 16, fill: LIVE_RED, edge: C.ink, edgeW: 3.5, ticks: false, shadow: 14 }); ctx.save(); ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.55 + 0.45 * dot; ctx.beginPath(); ctx.arc(x0 + 26, y0 + h / 2, 7.5, 0, TAU); ctx.fill(); ctx.restore();
    T(ctx, 'LIVE', x0 + 42, y0 + h / 2 + 2, 32, { ls: 2, fill: '#fff', outline: 4 });
    const bump = 1 + 0.06 * (keys.slice(1).reduce((a, [tk]) => a + Math.exp(-Math.max(0, t - tk) / 0.25) * (t >= tk ? 1 : 0), 0));
    const txt = fmtViews(v), vs = 34, tw = M(ctx, txt, vs, { ls: 1 }), pw = 62 + tw + 20; ctx.save(); ctx.translate(x0 + 134 + pw / 2, y0 + h / 2); ctx.scale(Math.min(1.12, bump), Math.min(1.12, bump)); ctx.translate(-(x0 + 134 + pw / 2), -(y0 + h / 2));
    panel(ctx, x0 + 134, y0, pw, h, { r: 16, fill: 'rgba(13,19,34,0.9)', edge: 'rgba(255,255,255,0.45)', edgeW: 2.5, ticks: false, shadow: 14 });
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; const ex = x0 + 134 + 32, ey = y0 + h / 2; ctx.beginPath(); ctx.moveTo(ex - 16, ey); ctx.quadraticCurveTo(ex, ey - 15, ex + 16, ey); ctx.quadraticCurveTo(ex, ey + 15, ex - 16, ey); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, TAU); ctx.fill();
    T(ctx, txt, x0 + 134 + 56, y0 + h / 2 + 2, vs, { ls: 1, fill: '#fff', outline: 4 }); ctx.restore(); ctx.restore(); }
  // ---- chat lines + hearts. `freeze: [{ at, until }]`: from `at` to `until` the chat layer STOPS (the lines on screen stay where they are, nothing new arrives: the police loudspeaker speaks); 0.25 s after `until` it fades
  let tc = t, fzA = 1; for (const f of o.freeze || []) if (t >= f.at && t < f.until + 0.25) { tc = f.at; fzA = 1 - sm((t - f.until) / 0.25); }
  const layer = (t, q) => {
  if (q > 0.01) { const FL = []; for (const f of o.flood || []) { const per = f.perSec ?? 6, n = Math.max(0, Math.floor((f.t1 - f.t0) * per)); for (let i = 0; i < n; i++) FL.push({ t: f.t0 + i / per, text: f.text, life: 3 / per + 0.12, big: true, name: ['bao.tran', 'minh_anh', 'ngoc94', 'tuan_hn', 'linh.le', 'hoang_99', 'thu.ha'][Math.floor(hash(i * 5.3 + f.t0) * 7)] }); }
    const items = [...(o.chat || []), ...FL].map((c, i) => ({ ...c, i, life: c.life ?? 2.4 })).filter((c) => t >= c.t && t < c.t + c.life + 0.3).sort((a, b) => a.t - b.t); const ROW = 90, BASE = 1205;
    for (const c of items) { const age = t - c.t, newer = items.filter((d) => d.t > c.t); let shift = 0, cnt = 0; for (const d of newer) { const e = sm((t - d.t) / 0.25); shift += e; cnt += e; }
      const al = sm(age / 0.18) * sm((c.life - age + 0.1) / 0.3) * (1 - sm(cnt - 2)) * q; if (al < 0.02) continue; const y = BASE - shift * ROW + (1 - easeOut(age / 0.25)) * 26, nm = c.name ?? ['minh_anh', 'bao.tran', 'ngoc94', 'tuan_hn', 'linh.le'][c.i % 5], col = AVC[Math.floor(hash(c.i * 3.1 + 7) * AVC.length)];
      ctx.save(); ctx.globalAlpha *= al;
      if (c.text) { const ts = c.big ? 42 : 34, nz = 24, tw = M(ctx, c.text, ts, { ls: 1 }), nw = M(ctx, nm, nz, { ls: 0.5 }), w = Math.min(c.big ? 680 : 600, 74 + Math.max(tw, nw) + 36);
        panel(ctx, 54, y - 39, w, 78, { r: 30, fill: 'rgba(13,19,34,0.82)', edge: 'rgba(255,255,255,0.3)', edgeW: 2, ticks: false, shadow: 10 });
        ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(54 + 38, y, 22, 0, TAU); ctx.stroke(); ctx.fill();
        T(ctx, nm, 54 + 74, y - 20, nz, { fill: 'rgba(255,255,255,0.7)', outline: 0, weight: 700, ls: 0.5 }); T(ctx, c.text, 54 + 74, y + 14, ts, { ls: 1, fill: '#fff', outline: 4 }); }
      else { const w = 74 + 70 + 24; panel(ctx, 54, y - 39, w, 78, { r: 30, fill: 'rgba(13,19,34,0.82)', edge: 'rgba(255,255,255,0.3)', edgeW: 2, ticks: false, shadow: 10 });
        ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(54 + 38, y, 22, 0, TAU); ctx.stroke(); ctx.fill(); ctx.fillStyle = PINKS[c.i % 4]; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; heartPath(ctx, 54 + 74 + 40, y - 2, 19); ctx.stroke(); ctx.fill(); }
      ctx.restore(); } }
  // ---- floating hearts, right side
  if (q > 0.01) for (const [h0, h1, per] of o.hearts || []) { const n = Math.max(0, Math.floor((h1 - h0) * per)), LIFE = 2.8;
    for (let i = 0; i < n; i++) { const tb = h0 + i / per, age = t - tb; if (age < 0 || age > LIFE) continue; const u = age / LIFE, id = i * 7.31 + h0 * 3.7, x = 910 + 60 * (hash(id) - 0.5) + 26 * Math.sin(age * 2.6 + hash(id + 3) * TAU), y = 1235 - 360 * easeOut(u * 0.9 + 0.1 * u), s = 20 + 22 * hash(id + 9), al = sm(age / 0.15) * (1 - sm((u - 0.7) / 0.3)) * q;
      ctx.save(); ctx.globalAlpha *= al * 0.95; ctx.translate(x, y); const pop = backOut(age / 0.35, 2.2); ctx.scale(pop, pop); ctx.rotate(0.35 * Math.sin(age * 2 + id)); ctx.fillStyle = PINKS[i % 5]; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineJoin = 'round'; heartPath(ctx, 0, 0, s); ctx.stroke(); ctx.fill(); ctx.restore(); } }
  };
  ctx.save(); ctx.globalAlpha *= fzA; layer(tc, q); ctx.restore();
  ctx.restore();
}
export function liveReads(o) {
  const keys = o.viewers || [[0, 3]], out = [{ text: 'LIVE', t0: +(o.t0 + 0.3).toFixed(3), t1: o.t1 }]; let from = o.t0 + 0.3, val = keys[0][1];
  for (let i = 1; i <= keys.length; i++) { const nxt = keys[i], to = nxt ? nxt[0] : o.t1; if (to - from >= 1.4) out.push({ text: fmtViews(val), t0: +from.toFixed(3), t1: +to.toFixed(3) }); if (nxt) { from = nxt[0] + (nxt[2]?.roll ?? 0.7); val = nxt[1]; } }
  const q = o.quiet || [];
  const frz = (a, b) => { for (const f of o.freeze || []) if (f.at >= a && f.at <= b) return Math.max(b, f.until); return b; };
  for (const f of o.flood || []) out.push({ text: f.text, t0: +(f.t0 + 0.25).toFixed(3), t1: +frz(f.t0, f.t1 + 0.3).toFixed(3) });
  for (const c of o.chat || []) { if (!c.text) continue; const life = c.life ?? 2.4; let end = c.t + life; for (const [a] of q) if (a > c.t && a < end) end = a; out.push({ text: c.text, t0: +(c.t + 0.18).toFixed(3), t1: +frz(c.t, end).toFixed(3) }); }
  return out;
}
export const liveFrame = (o) => overlay(o, drawLiveFrame, { reads: liveReads(o) });

// ================================================================ 2. liveComment: ONE big comment card, alone
// o: { t0, t1, name: 'Mẹ Tèo', text: 'Đi chân chữ bát thế kia… chỉ có con tao.' (<= 60 characters), type: 0.6 (typing dots first), y: 1140, tag: 'bình luận' }
// A text of n characters needs 1.0 + n / 12 s on screen from the moment the words show (41 characters = 4.4 s). The card is the only text while it is up: the factory declares nothing else.
export function drawLiveComment(ctx, t, o) {
  const inK = backOut((t - o.t0) / 0.28, 1.9), out = sm((o.t1 - t) / 0.2), k = clamp(inK) * out; if (k <= 0) return;
  const y = o.y ?? 1140, W = 900, x0 = 540 - W / 2, ty = o.type ?? 0.6, shown = sm((t - o.t0 - ty) / 0.18), name = o.name ?? 'Mẹ Tèo', size = 50, AV = 52;
  const maxW = W - 36 - AV * 2 - 28 - 36, words = String(o.text).split(' '), lines = []; { let cur = ''; for (const w of words) { const n = cur ? cur + ' ' + w : w; if (M(ctx, n, size, { ls: 0.5 }) > maxW && cur) { lines.push(cur); cur = w; } else cur = n; } if (cur) lines.push(cur); }
  const LH = 60, H = 24 + 44 + 10 + lines.length * LH + 22;
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.4); ctx.translate(540, y); ctx.scale(lerp(0.92, 1, clamp(inK)), lerp(0.92, 1, clamp(inK))); ctx.translate(-540, -y - (1 - clamp(inK)) * -30);
  panel(ctx, x0, y - H / 2, W, H, { r: 30, fill: 'rgba(14,16,34,0.95)', edge: 'rgba(255,196,58,0.9)', edgeW: 3.5, tick: C.gold, shadow: 30 });
  const ax = x0 + 36 + AV, ay = y - H / 2 + 24 + AV; ctx.fillStyle = '#ff8ab4'; ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(ax, ay, AV, 0, TAU); ctx.stroke(); ctx.fill();
  ctx.fillStyle = '#fff4e8'; ctx.beginPath(); ctx.arc(ax, ay - 8, 19, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(ax, ay + 38, 32, 24, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#3a2438'; ctx.beginPath(); ctx.arc(ax, ay - 14, 20, Math.PI, TAU); ctx.fill();   // a tiny mum avatar (our own drawing)
  const nx = ax + AV + 28; T(ctx, name, nx, y - H / 2 + 24 + 22, 40, { fill: C.gold, ls: 1, outline: 5 }); if (o.tag !== '') { const tg = o.tag ?? 'bình luận', tw = M(ctx, name, 40, { ls: 1 }); T(ctx, tg, nx + tw + 18, y - H / 2 + 24 + 25, 26, { fill: 'rgba(255,255,255,0.55)', weight: 700, outline: 0 }); }
  if (shown < 0.99) { for (let i = 0; i < 3; i++) { ctx.save(); ctx.globalAlpha *= (1 - shown) * (0.35 + 0.65 * Math.max(0, Math.sin(t * 9 - i * 0.9))); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(nx + 20 + i * 36, y - H / 2 + 24 + 44 + 10 + 28, 10, 0, TAU); ctx.fill(); ctx.restore(); } }
  if (shown > 0.01) { ctx.save(); ctx.globalAlpha *= shown; ctx.translate(0, (1 - shown) * 10); lines.forEach((l, i) => T(ctx, l, nx, y - H / 2 + 24 + 44 + 10 + LH * (i + 0.5) + 2, size, { fill: '#fff', ls: 0.5, outline: 6 })); ctx.restore(); }
  ctx.restore();
}
export const liveComment = (o) => overlay(o, drawLiveComment, { reads: [{ text: o.text, t0: +(o.t0 + (o.type ?? 0.6) + 0.1).toFixed(3), t1: o.t1 }, { text: o.name ?? 'Mẹ Tèo', t0: +(o.t0 + 0.2).toFixed(3), t1: o.t1 }] });

// ================================================================ 3. liveChip: the small "<name> · đang xem" chip under the LIVE row
// o: { t0, t1, name: 'Mẹ Tèo', text: 'đang xem' }   reads: the whole chip text (needs 1.0 + n / 12 s)
export function drawLiveChip(ctx, t, o) {
  const inK = backOut((t - o.t0) / 0.26), out = sm((o.t1 - t) / 0.2), k = clamp(inK) * out; if (k <= 0) return;
  const s = (o.name ?? 'Mẹ Tèo') + ' · ' + (o.text ?? 'đang xem'), x0 = 252, y0 = 234, h = 50, maxW = 314 - 58 - 28, sz = fit(ctx, s, maxW, 26, 16, { ls: 0.5 }), tw = M(ctx, s, sz, { ls: 0.5 }), w = 58 + tw + 28;
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.4); ctx.translate(x0, y0 + h / 2); ctx.scale(lerp(0.8, 1, clamp(inK)), lerp(0.8, 1, clamp(inK))); ctx.translate(-x0, -(y0 + h / 2));
  panel(ctx, x0, y0, w, h, { r: 25, fill: 'rgba(13,19,34,0.9)', edge: 'rgba(255,196,58,0.85)', edgeW: 2.5, ticks: false, shadow: 14 });
  ctx.fillStyle = '#ff8ab4'; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x0 + 30, y0 + h / 2, 16, 0, TAU); ctx.stroke(); ctx.fill(); ctx.fillStyle = C.green; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x0 + 42, y0 + h / 2 + 11, 6, 0, TAU); ctx.stroke(); ctx.fill();
  T(ctx, s, x0 + 56, y0 + h / 2 + 2, sz, { fill: '#fff', ls: 0.5, outline: 4 }); ctx.restore();
}
export const liveChip = (o) => overlay(o, drawLiveChip, { reads: [{ text: (o.name ?? 'Mẹ Tèo') + ' · ' + (o.text ?? 'đang xem'), t0: +(o.t0 + 0.15).toFixed(3), t1: o.t1 }] });

// ================================================================ 4. liveFollow: the THEO DÕI button inside the live frame (the end card)
// o: { t0, t1, text: 'THEO DÕI', y: 1140, pressAt: t0 + 0.6 (a finger-press dip + a ripple) }   needs 1.0 + 8 / 12 = 1.7 s
export function drawLiveFollow(ctx, t, o) {
  const inK = backOut((t - o.t0) / 0.3, 2.0), out = sm((o.t1 - t) / 0.2), k = clamp(inK) * out; if (k <= 0) return;
  const text = o.text ?? 'THEO DÕI', y = o.y ?? SLOT.y, size = 66, tw = M(ctx, text, size, { ls: 2 }), w = Math.min(860, 150 + tw + 60), h = 124, pa = o.pressAt ?? o.t0 + 0.6, u = t - pa, dip = u >= 0 ? Math.exp(-u / 0.25) * Math.sin(clamp(u / 0.12) * Math.PI) * 0.09 : 0;
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.4); ctx.translate(SLOT.cx, y); ctx.scale(lerp(0.85, 1, clamp(inK)) * (1 - dip), lerp(0.85, 1, clamp(inK)) * (1 - dip));
  if (u >= 0 && u < 0.7) { ctx.save(); ctx.globalAlpha *= 0.6 * (1 - u / 0.7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-w / 2 - 60 * easeOut(u / 0.7), -h / 2 - 40 * easeOut(u / 0.7), w + 120 * easeOut(u / 0.7), h + 80 * easeOut(u / 0.7), 62 + 40 * easeOut(u / 0.7)); ctx.stroke(); ctx.restore(); }
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#ff6a8a'); g.addColorStop(1, '#ff2a5a'); panel(ctx, -w / 2, -h / 2, w, h, { r: 62, fill: g, edge: C.ink, edgeW: 5, ticks: false, shadow: 26 });
  const ix = -w / 2 + 68; ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ix, 0, 36, 0, TAU); ctx.stroke(); ctx.fill(); ctx.strokeStyle = '#ff2a5a'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ix - 16, 0); ctx.lineTo(ix + 16, 0); ctx.moveTo(ix, -16); ctx.lineTo(ix, 16); ctx.stroke();
  T(ctx, text, ix + 56, 3, size, { ls: 2, fill: '#fff', outline: 8 }); ctx.restore();
}
export const liveFollow = (o) => overlay(o, drawLiveFollow, { reads: [{ text: o.text ?? 'THEO DÕI', t0: +(o.t0 + 0.2).toFixed(3), t1: o.t1 }] });

// ================================================================ 5. policeSweep (20/11, the gta6p2 cliffhanger): red and blue police light SWEEPS over the whole picture, a 2-D layer (no 3-D light, so it goes through the overlay path of any renderer)
// o: { t0, t1, period: 1.4, max: 0.34 }. Red and blue take turns (cos squared, never a hard switch) as slanted soft bands that glide across the frame, plus a tint at the red (left) and blue (right) edges.
// Plain alpha (no additive blend). Draw it FIRST in the overlay list: it sits under every text. noText: nothing to read.
export function drawPoliceSweep(ctx, t, o) {
  const inK = sm((t - o.t0) / 0.5), out = sm((o.t1 - t) / 0.3), k = inK * out; if (k <= 0) return; const per = o.period ?? 1.4, mx = o.max ?? 0.34, ph = (t - o.t0) * TAU / per;
  const beam = (col, I, x, w) => { if (I < 0.01) return; const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${(mx * I * k).toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.save(); ctx.translate(540, 960); ctx.rotate(0.28); ctx.translate(-540, -960); ctx.fillStyle = g; ctx.fillRect(x - w, -400, 2 * w, 2800); ctx.restore(); };
  const rI = Math.pow(Math.max(0, Math.sin(ph)), 2), bI = Math.pow(Math.max(0, -Math.sin(ph)), 2);
  beam('255,32,52', rI, 540 - 520 * Math.cos(ph * 0.5 + 0.3), 460); beam('40,90,255', bI, 540 + 520 * Math.cos(ph * 0.5 + 0.3), 460);
  const edge = (col, I, left) => { if (I < 0.01) return; const g = ctx.createLinearGradient(left ? 0 : 1080, 0, left ? 380 : 700, 0); g.addColorStop(0, `rgba(${col},${(0.5 * mx * I * k).toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); };
  edge('255,32,52', rI, true); edge('40,90,255', bI, false);
}
export const policeSweep = (o) => ({ kind: 'draw', t0: o.t0 - 0.02, t1: o.t1 + 0.02, fade: 0.01, noText: true, fn: (ctx, t) => drawPoliceSweep(ctx, t, o) });
