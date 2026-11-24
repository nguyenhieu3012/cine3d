// cine3d core: the 2-D text layer drawn over the finished 3-D picture (captions, hook plate, chips, message bubbles, end card).
// One type system for both channels. All sizes are for a 1080 x 1920 frame.
import * as THREE from 'three';
import { clamp, easeOut, lerp, overshoot } from './util.js';
import { project } from './camera.js';
import { ZB, gptMark, msgcard } from './overlay_zb.js';
import { V2_OVERLAYS } from './overlay_v2.js';

// Overlay-only export (tools/render.cjs pngseq --overlays-only): the layer is drawn on a transparent canvas with NO 3-D picture under it. Overlays that need to SAMPLE the picture
// (backdrop blur + dim, the freeze_rewind / cold grades) cannot run; they write what they would have done into ONLY.flags and draw nothing of the sampled part.
export const ONLY = { on: false, cur: '', flags: [] };
export const SAFE = { l: 54, r: 1026, t: 150, b: 1536 };
const DISP = 'Display, sans-serif', UI = 'UI, sans-serif';

// shrink a text until it fits maxW (never under min), returns the size used
export function fitText(ctx, text, maxW, size, weight = 900, min = 40, fam = DISP) { let s = size; for (; s > min; s -= 2) { ctx.font = `${weight} ${s}px ${fam}`; if (ctx.measureText(text).width <= maxW) break; } ctx.font = `${weight} ${s}px ${fam}`; return s; }

// split a line into caption chunks of at most `max` characters / 3 words, timed by length (or by real word times when given)
export function chunks(line, max = 14) {
  if (line._chunks) return line._chunks;
  const words = line.words ? line.words.map((w) => ({ w: w[0], t0: w[1], t1: w[2] })) : (() => { const ws = line.text.split(/\s+/).filter(Boolean), tot = ws.reduce((a, w) => a + w.length + 1.5, 0), d = line.t1 - line.t0 - 0.08; let t = line.t0; return ws.map((w) => { const dt = d * (w.length + 1.5) / tot, o = { w, t0: t, t1: t + dt }; t += dt; return o; }); })();
  const out = []; let cur = null;
  for (const w of words) { const ends = cur && /[.!?…,:]$/.test(cur.ws[cur.ws.length - 1]); if (!cur || ends || cur.ws.length >= 3 || (cur.text + ' ' + w.w).length > max) { cur = { ws: [], text: '', t0: w.t0, t1: w.t1 }; out.push(cur); } cur.ws.push(w.w); cur.text = cur.ws.join(' '); cur.t1 = w.t1; }
  out.forEach((c, i) => { c.end = out[i + 1] ? out[i + 1].t0 : line.t1 + 0.12; });
  return (line._chunks = out);
}

export function caption(ctx, ep, t, cast) {
  const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920, wide = CW > CH, v2Safe = !wide && (ep.rules >= 2);
  const CX = ep.captions?.x ?? (v2Safe ? 472 : CW / 2);
  const y = ep.captions?.y ?? (wide ? 940 : 1385), size = ep.captions?.size ?? (wide ? 68 : 76), maxW = ep.captions?.maxW ?? (wide ? 1560 : v2Safe ? 820 : 900);
  // one caption at a time: the newest line that has started wins, so two close lines never overlap
  const live = (ep.lines || []).filter((l) => !l.noCap && t >= l.t0 - 0.02 && t <= l.t1 + 0.2); const ln = live[live.length - 1]; if (!ln) return;
  {
    const c = chunks(ln, ep.captions?.max ?? (wide ? 28 : 14)).find((k) => t >= k.t0 - 0.02 && t < k.end); if (!c) return;
    const pop = easeOut((t - c.t0 + 0.02) / 0.09), col = ep.captions?.accent || cast[ln.who]?.color || '#fff';
    ctx.save(); ctx.translate(CX, y); ctx.scale(lerp(0.86, 1, pop), lerp(0.86, 1, pop)); ctx.globalAlpha = clamp(pop * 1.4);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const txt = c.text.replace(/\*/g, ''); fitText(ctx, txt, maxW, size);
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; ctx.strokeStyle = '#14102a'; ctx.lineWidth = 16; ctx.strokeText(txt, 0, 0);
    // only the stressed words (CAPITALS, *starred*, numbers) take the accent colour
    ctx.shadowColor = 'transparent'; ctx.textAlign = 'left'; let x = -ctx.measureText(txt).width / 2;
    for (const raw of c.text.split(' ')) { const w = raw.replace(/\*/g, ''), hot = raw.includes('*') || /[0-9]/.test(w) || (/\p{L}{2,}/u.test(w) && w === w.toUpperCase()); ctx.fillStyle = hot ? col : '#ffffff'; ctx.fillText(w, x, 0); x += ctx.measureText(w + ' ').width; }
    ctx.restore();
  }
}

// hook plate: dark pill, speaker-colour border
export function hook(ctx, o, t) {
  const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920, CX = CW / 2, wide = CW > CH;
  const k = easeOut((t - o.t0) / 0.18) * clamp((o.t1 - t) / 0.15), y = o.y ?? (wide ? 130 : 300); if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(k); ctx.translate(CX, y - (1 - k) * 30); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = [].concat(o.text), size = o.size ?? (wide ? 54 : 64), maxW = wide ? 1560 : 880; let w = 0; for (const l of lines) { fitText(ctx, l, maxW, size); w = Math.max(w, ctx.measureText(l).width); }
  const lh = size * 1.18, h = lines.length * lh + 44, pw = w + 84;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; ctx.fillStyle = 'rgba(16,12,34,0.92)'; ctx.beginPath(); ctx.roundRect(-pw / 2, -h / 2, pw, h, 30); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = o.color || '#ffc531'; ctx.lineWidth = 6; ctx.stroke();
  lines.forEach((l, i) => { fitText(ctx, l, maxW, size); ctx.fillStyle = i === lines.length - 1 && lines.length > 1 ? (o.color || '#ffc531') : '#fff'; ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh + 3); });
  ctx.restore();
}
// small label chip (series tag, place, time)
export function chip(ctx, o, t) {
  const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920, CX = CW / 2, wide = CW > CH;
  const k = easeOut((t - o.t0) / 0.2) * clamp((o.t1 - t) / 0.2); if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(k); ctx.font = `800 34px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const w = ctx.measureText(o.text).width + 48, x = o.x ?? CX, y = o.y ?? (wide ? 80 : 190);
  ctx.fillStyle = 'rgba(16,12,34,0.8)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 30, w, 60, 30); ctx.fill(); ctx.fillStyle = o.color || '#ffe7a8'; ctx.fillText(o.text, x, y + 2); ctx.restore();
}
// a phone message bubble (pops, then holds). o: { from, text, x, y, color }
export function bubble(ctx, o, t) {
  const k = easeOut((t - o.t0) / 0.22) * clamp((o.t1 - t) / 0.15); if (k <= 0) return;
  const x = o.x ?? 560, y = o.y ?? 420; ctx.save(); ctx.translate(x, y); ctx.scale(lerp(0.7, 1, k), lerp(0.7, 1, k)); ctx.globalAlpha = clamp(k * 1.3);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; const size = fitText(ctx, o.text, 560, o.size ?? 62, 800, 40, UI), w = ctx.measureText(o.text).width + 72, h = size + 54 + (o.from ? 44 : 0);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; ctx.fillStyle = '#f7f5ff'; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 34); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = o.color || '#7a6cf0'; ctx.lineWidth = 5; ctx.stroke();
  if (o.from) { ctx.font = `800 30px ${UI}`; ctx.fillStyle = o.color || '#7a6cf0'; ctx.fillText(o.from, 36, 36); }
  ctx.font = `800 ${size}px ${UI}`; ctx.fillStyle = '#1a1433'; ctx.fillText(o.text, 36, h - 27 - size / 2 + 2); ctx.restore();
}
// end card: one line + follow plate (<= 2 s)
export function endCard(ctx, o, t) {
  const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920, CX = CW / 2, wide = CW > CH;
  const k = easeOut((t - o.t0) / 0.25); if (t < o.t0 || t > o.t1) return;
  ctx.save(); ctx.globalAlpha = clamp(k); ctx.fillStyle = `rgba(8,6,20,${0.55 * k})`; ctx.fillRect(0, 0, CW, CH); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitText(ctx, o.text, wide ? 1560 : 900, 84); ctx.fillStyle = '#fff'; ctx.fillText(o.text, CX, (wide ? 450 : 820) - (1 - k) * 20);
  if (o.sub) { ctx.font = `800 46px ${UI}`; const w = ctx.measureText(o.sub).width + 80, sy = wide ? 560 : 930; ctx.fillStyle = o.color || '#ffc531'; ctx.beginPath(); ctx.roundRect(CX - w / 2, sy, w, 92, 46); ctx.fill(); ctx.fillStyle = '#14102a'; ctx.fillText(o.sub, CX, sy + 48); }
  ctx.restore();
}
// GOAT Beef season / round scoreboard. o: { left: 'RONALDO', right: 'MESSI', a: 4, b: 5, tick: 'b', tickAt, banner, y }
export function score(ctx, o, t) {
  const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920, CX = CW / 2, wide = CW > CH;
  const k = easeOut((t - o.t0) / 0.25) * clamp((o.t1 - t) / 0.2); if (k <= 0) return; const y = o.y ?? (wide ? 140 : 250), W = 860, H = 190;
  ctx.save(); ctx.globalAlpha = clamp(k); ctx.translate(CX, y - (1 - k) * 40); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; ctx.fillStyle = 'rgba(12,14,30,0.94)'; ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 28); ctx.fill(); ctx.shadowColor = 'transparent';
  [[-1, o.left, o.a, o.colorA || '#ff4d4d', 'a'], [1, o.right, o.b, o.colorB || '#6ecbff', 'b']].forEach(([s, name, n, col, id]) => {
    const ticked = o.tick === id && o.tickAt != null && t >= o.tickAt, pop = ticked ? 1 + 0.35 * Math.max(0, 1 - (t - o.tickAt) / 0.35) : 1, val = o.tick === id && o.tickAt != null && !ticked ? n - 1 : n;
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(s < 0 ? -W / 2 + 14 : 14, -H / 2 + 14, W / 2 - 28, 60, 16); ctx.fill();
    fitText(ctx, name, W / 2 - 60, 40, 900, 26); ctx.fillStyle = '#0c0e1e'; ctx.fillText(name, s * W / 4, -H / 2 + 46);
    ctx.save(); ctx.translate(s * W / 4, 36); ctx.scale(pop, pop); ctx.font = `900 96px ${DISP}`; ctx.fillStyle = ticked ? '#ffe45a' : '#fff'; ctx.fillText(String(val), 0, 0); ctx.restore(); });
  if (o.banner && (o.tickAt == null || t >= o.tickAt + 0.3)) { fitText(ctx, o.banner, W - 80, 46, 900, 30); const bw = ctx.measureText(o.banner).width + 60; ctx.fillStyle = '#ffe45a'; ctx.beginPath(); ctx.roundRect(-bw / 2, H / 2 + 14, bw, 70, 20); ctx.fill(); ctx.fillStyle = '#0c0e1e'; ctx.fillText(o.banner, 0, H / 2 + 51); }
  ctx.restore();
}
// backdrop: blur and darken the finished 3-D picture (behind a phone screen, a card). o: { blur: 14, dim: 0.5 }
export function backdrop(ctx, o, t) {
  const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920;
  const k = easeOut((t - o.t0) / 0.2) * clamp((o.t1 - t) / 0.2); if (k <= 0) return; if (ONLY.on) { ONLY.flags.push({ kind: ONLY.cur, sample: 'backdrop', blur: +((o.blur ?? 14) * k).toFixed(2), dim: +(1 - (1 - (o.dim ?? 0.5)) * k).toFixed(3) }); return; } if (!backdrop._c || backdrop._c.width !== CW || backdrop._c.height !== CH) backdrop._c = Object.assign(document.createElement('canvas'), { width: CW, height: CH }); const c = backdrop._c;
  c.getContext('2d').drawImage(ctx.canvas, 0, 0); ctx.save(); ctx.filter = `blur(${(o.blur ?? 14) * k}px) brightness(${1 - (1 - (o.dim ?? 0.5)) * k})`; ctx.drawImage(c, 0, 0); ctx.restore();
}
// draw: any 2-D drawing as a function of time, for inserts the engine has no component for yet (phone screens, receipts, a custom card).
// o.fn(ctx, t, { ep, cast, k }) with k = 0..1 fade. The old Trà đá 2-D helpers can be reused this way: import * as T from '../legacy_trada/teo.js'.
export function draw(ctx, o, t, ep, cast) { const k = easeOut((t - o.t0) / (o.fade ?? 0.2)) * clamp((o.t1 - t) / (o.fade ?? 0.2)); if (k <= 0) return; ctx.save(); o.fn(ctx, t, { ep, cast, k: clamp(k) }); ctx.restore(); }
// a phone with a chat thread, over the blurred picture. o: { name, sub, accent, avatar: 'M', msgs: [{ t, from: 'them' | 'me', text }], typing: [{ t0, t1, from }] }
export function wrapLines(ctx, text, maxW) { const out = []; let cur = ''; for (const w of String(text).split(/\s+/)) { const n = cur ? cur + ' ' + w : w; if (ctx.measureText(n).width > maxW && cur) { out.push(cur); cur = w; } else cur = n; } if (cur) out.push(cur); return out; }
export function phone(ctx, o, t) {
  if (o.big) return msgcard(ctx, o, t);
  const k = easeOut((t - o.t0) / 0.3) * clamp((o.t1 - t) / 0.2); if (k <= 0) return;
  if (o.backdrop !== false) backdrop(ctx, { t0: o.t0, t1: o.t1, blur: 16, dim: 0.42 }, t);
  const W = 800, H = 1300, X = 540 - W / 2, Y = (o.y ?? 190) + (1 - k) * 260, acc = o.accent || '#2f7cf6', FS = o.size ?? 46, LH = FS * 1.24, PAD = 26, MAXW = 500;
  ctx.save(); ctx.globalAlpha = clamp(k * 1.5); ctx.translate(540, Y + H / 2); ctx.rotate((1 - k) * 0.05 + (o.tilt ?? -0.012)); ctx.translate(-540, -(Y + H / 2));
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26; ctx.fillStyle = '#14141c'; ctx.beginPath(); ctx.roundRect(X - 18, Y - 18, W + 36, H + 36, 78); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.roundRect(X, Y, W, H, 62); ctx.fillStyle = o.bg || '#f3f2f8'; ctx.fill(); ctx.save(); ctx.clip();
  // header
  ctx.fillStyle = '#ffffff'; ctx.fillRect(X, Y, W, 150); ctx.fillStyle = 'rgba(20,16,42,0.08)'; ctx.fillRect(X, Y + 150, W, 3);
  if (o.logo === 'gpt') gptMark(ctx, X + 92, Y + 80, 52); else { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(X + 92, Y + 80, 44, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `900 46px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.avatar || (o.name || '?')[0], X + 92, Y + 83); } ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ctx.fillStyle = '#16122e'; fitText(ctx, o.name || '', W - 220, 48, 900, 34, UI); ctx.fillText(o.name || '', X + 156, Y + 64); if (o.sub) { ctx.font = `600 30px ${UI}`; ctx.fillStyle = '#7a7690'; ctx.fillText(o.sub, X + 156, Y + 112); }
  // thread: lay out everything that has appeared, keep the newest message above the input bar
  ctx.font = `800 ${FS}px ${UI}`; const items = [];
  for (const m of o.msgs || []) if (t >= m.t) { const lines = wrapLines(ctx, m.text, MAXW), w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + PAD * 2; items.push({ m, lines, w, h: lines.length * LH + PAD * 1.5, pop: easeOut((t - m.t) / 0.18) }); }
  for (const ty of o.typing || []) if (t >= ty.t0 && t < ty.t1) items.push({ typing: true, m: ty, w: 150, h: 84, pop: easeOut((t - ty.t0) / 0.15) });
  const GAP = 20, top = Y + 180, bottom = Y + H - 150, total = items.reduce((a, it) => a + it.h + GAP, 0); let y = Math.min(top, bottom - total);
  for (const it of items) { const me = it.m.from === 'me', bx = me ? X + W - 34 - it.w : X + 34, sc = lerp(0.7, 1, it.pop);
    ctx.save(); ctx.translate(me ? bx + it.w : bx, y + it.h); ctx.scale(sc, sc); ctx.translate(-(me ? bx + it.w : bx), -(y + it.h)); ctx.globalAlpha *= clamp(it.pop * 1.4);
    ctx.fillStyle = me ? acc : '#ffffff'; ctx.shadowColor = 'rgba(20,16,42,0.12)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.beginPath(); ctx.roundRect(bx, y, it.w, it.h, 34); ctx.fill(); ctx.shadowColor = 'transparent';
    if (it.typing) { for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(110,106,134,${0.4 + 0.6 * Math.max(0, Math.sin(t * 7 - i * 0.9))})`; ctx.beginPath(); ctx.arc(bx + 45 + i * 30, y + 42, 10, 0, 7); ctx.fill(); } }
    else { ctx.fillStyle = me ? '#ffffff' : '#16122e'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; it.lines.forEach((l, i) => ctx.fillText(l, bx + PAD, y + PAD * 0.75 + LH * (i + 0.5) + 2)); }
    ctx.restore(); y += it.h + GAP; }
  // input bar
  ctx.fillStyle = '#ffffff'; ctx.fillRect(X, Y + H - 126, W, 126); ctx.fillStyle = '#ecebf3'; ctx.beginPath(); ctx.roundRect(X + 34, Y + H - 100, W - 190, 70, 35); ctx.fill(); ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(X + W - 86, Y + H - 65, 36, 0, 7); ctx.fill();
  ctx.restore(); ctx.restore();
}
const INK = '#231a3d';
// thought cloud over a character's head: white puffs, a trail of small bubbles down to the head, words appear as the echo voice says them.
// o: { who (or ax, ay = a fixed anchor), text ('' = an empty cloud), r0, r1 = when the words start / finish appearing, pop: false = no pop-in (it continues the cloud before it) }
export function thought(ctx, o, t, ep, cast, camera) {
  if (t < o.t0 || t > o.t1) return;
  const kin = o.pop === false ? 1 : easeOut((t - o.t0) / 0.3), kout = o.hold ? 1 : clamp((o.t1 - t) / 0.14), k = kin * kout; if (k <= 0) return;
  let ax = o.ax ?? 540, ay = o.ay ?? 700; const c = cast[o.who];
  if (c && camera) { const h = c.headWorld(), p = project(camera, h, 1080, 1920), top = project(camera, h.clone().add(camera.up.clone().multiplyScalar(c.R * 1.2)), 1080, 1920); ax = p[0]; ay = top[1]; }
  ctx.save(); ctx.textBaseline = 'middle'; const size = o.size ?? 58; ctx.font = `900 ${size}px ${DISP}`;
  const lines = o.text ? wrapLines(ctx, o.text, o.maxW ?? 620) : []; let tw = 170; for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width);
  const w = tw + 150, h = Math.max(1, lines.length) * size * 1.22 + 110;
  const cx = clamp(o.x ?? (ax + (o.dx ?? 0)), SAFE.l + w / 2 + 14, SAFE.r - w / 2 - 14), cy = Math.max(o.y ?? (ay - 120 - h / 2), (o.minY ?? 200) + h / 2) + Math.sin(t * 1.7 + cx) * 5;
  // trail: three bubbles from the head up to the cloud, the nearest one first
  const bx = cx + clamp(ax - cx, -w * 0.3, w * 0.3), by = cy + h * 0.5;
  [[0.84, 10], [0.56, 16], [0.26, 23]].forEach(([u, r], i) => { const kk = clamp(kin * 3 - i * 0.6) * kout; if (kk <= 0) return; const x = lerp(bx, ax, u), y = lerp(by, ay, u) + Math.sin(t * 2.1 + i) * 3; ctx.globalAlpha = kk; ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r * kk, 0, 7); ctx.fill(); ctx.stroke(); });
  ctx.translate(cx, cy); ctx.scale(lerp(0.55, 1, k), lerp(0.55, 1, k)); ctx.globalAlpha = clamp(k * 1.5);
  const puffs = [[-0.36, -0.2, 0.34], [-0.13, -0.36, 0.4], [0.16, -0.34, 0.38], [0.38, -0.14, 0.33], [0.33, 0.24, 0.33], [0.04, 0.35, 0.37], [-0.27, 0.29, 0.35], [-0.42, 0.08, 0.28], [0.44, 0.06, 0.26]];
  const shape = (grow) => { ctx.beginPath(); ctx.roundRect(-w * 0.43 - grow, -h * 0.36 - grow, w * 0.86 + grow * 2, h * 0.72 + grow * 2, h * 0.36); for (const [x, y, r] of puffs) { ctx.moveTo(x * w + r * h + grow, y * h); ctx.arc(x * w, y * h, r * h + grow, 0, 7); } };
  ctx.shadowColor = 'rgba(10,6,30,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; ctx.fillStyle = INK; shape(7); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#ffffff'; shape(0); ctx.fill();
  // words, revealed in time with the voice
  const all = lines.join(' ').split(' ').filter(Boolean), r0 = o.r0 ?? o.t0 + 0.08, r1 = o.r1 ?? o.t1 - 0.4, shown = Math.ceil(all.length * clamp((t - r0) / Math.max(0.05, r1 - r0)) + 1e-6);
  ctx.fillStyle = o.color || INK; ctx.textAlign = 'left'; let n = 0;
  lines.forEach((l, i) => { let x = -ctx.measureText(l).width / 2; const y = (i - (lines.length - 1) / 2) * size * 1.22 + 2; for (const wd of l.split(' ')) { if (n < shown) ctx.fillText(wd, x, y); x += ctx.measureText(wd + ' ').width; n++; } });
  ctx.restore();
}
export function drawMumAvatar(ctx, ax, ay, r = 68) {
  ctx.save(); ctx.translate(ax, ay); ctx.scale(r / 68, r / 68);
  ctx.fillStyle = '#ffd7c2'; ctx.beginPath(); ctx.arc(0, 0, 68, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 68, 0, 7); ctx.clip();
  ctx.fillStyle = '#3a2a3a'; ctx.beginPath(); ctx.arc(0, -34, 52, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(0, -74, 22, 0, 7); ctx.fill();
  ctx.fillStyle = '#f6c3a8'; ctx.beginPath(); ctx.arc(0, 4, 40, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a2a3a'; ctx.beginPath(); ctx.arc(0, -12, 42, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-14, 4, 4.5, 0, 7); ctx.arc(14, 4, 4.5, 0, 7); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 14, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#e8506a'; ctx.fillRect(-70, 46, 140, 40); ctx.restore(); ctx.restore();
}
// incoming / live phone call card at the top of the frame. o: { name: 'Mẹ', who: 'me' (the lines of this speaker move the sound bars), answer: time the call is picked up, y }
export function call(ctx, o, t, ep) {
  const k = easeOut((t - o.t0) / 0.3) * clamp((o.t1 - t) / 0.2); if (k <= 0) return;
  const w = 880, h = 196, x = 540 - w / 2, y = (o.y ?? 176) - (1 - k) * 90, live = t >= (o.answer ?? 1e9);
  ctx.save(); ctx.globalAlpha = clamp(k * 1.4); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; ctx.fillStyle = 'rgba(24,20,44,0.96)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 52); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = live ? '#3ddc84' : 'rgba(255,255,255,0.22)'; ctx.lineWidth = 5; ctx.stroke();
  // avatar: mum (hair bun, warm face)
  drawMumAvatar(ctx, x + 104, y + h / 2, 68);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `900 70px ${DISP}`; ctx.fillStyle = '#fff'; ctx.fillText(o.name || 'Mẹ', x + 204, y + 76);
  ctx.font = `700 36px ${UI}`; ctx.fillStyle = live ? '#7df0a8' : '#c9c4e6'; const sec = Math.max(0, Math.floor(t - (o.answer ?? t)));
  ctx.fillText(live ? `Loa ngoài · 00:${String(sec).padStart(2, '0')}` : 'Cuộc gọi đến…', x + 206, y + 140);
  const rx = x + w - 150, ry = y + h / 2;
  if (!live) { const pu = (t * 1.6) % 1; ctx.strokeStyle = `rgba(61,220,132,${1 - pu})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(rx + 40, ry, 44 + pu * 26, 0, 7); ctx.stroke(); ctx.fillStyle = '#3ddc84'; ctx.beginPath(); ctx.arc(rx + 40, ry, 44, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(rx + 40 + Math.sin(t * 46) * 3, ry); ctx.rotate(-0.6); ctx.strokeStyle = '#fff'; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 12, 22, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.restore(); }
  else { let amp = 0; (ep.lines || []).forEach((l, i) => { if (l.who !== o.who || l.think || t < l.t0 || t > l.t1) return; const env = ep.lips?.[i]; amp = env ? clamp(env[Math.floor((t - l.t0) * 60)] ?? 0) : 0.5 + 0.5 * Math.abs(Math.sin(t * 13)); });
    for (let i = 0; i < 6; i++) { const bh = 12 + amp * (38 + 34 * Math.abs(Math.sin(t * (9 + i * 2.3) + i * 1.7))); ctx.fillStyle = '#3ddc84'; ctx.beginPath(); ctx.roundRect(rx - 30 + i * 24, ry - bh / 2, 13, bh, 6.5); ctx.fill(); } }
  ctx.restore();
}
// a bank / app notification that drops in from the top. o: { app: 'NGÂN HÀNG', text: '+500.000đ', color, y }
export function notify(ctx, o, t) {
  const k = easeOut((t - o.t0) / 0.26) * clamp((o.t1 - t) / 0.18); if (k <= 0) return;
  const w = 800, h = 190, x = 540 - w / 2, y = (o.y ?? 190) - (1 - k) * 100, col = o.color || '#1fb866';
  ctx.save(); ctx.globalAlpha = clamp(k * 1.4); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; ctx.fillStyle = '#f8f7ff'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 46); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x + 34, y + 39, 112, 112, 30); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 76px ${DISP}`; ctx.fillText(o.icon || '₫', x + 90, y + 98);
  ctx.textAlign = 'left'; ctx.font = `800 32px ${UI}`; ctx.fillStyle = '#6a6488'; ctx.fillText(o.app || 'NGÂN HÀNG', x + 178, y + 56);
  fitText(ctx, o.text, w - 220, 84, 900, 50); ctx.fillStyle = col; ctx.fillText(o.text, x + 176, y + 122); ctx.restore();
}
// series end plate: "unlocked" (a), then at swapAt the locked teaser of the next episode (b) + a follow pill. o: { a, b, swapAt, follow, y }
export function unlock(ctx, o, t) {
  if (t < o.t0 || t > o.t1) return; const sw = o.swapAt ?? (o.t0 + o.t1) / 2, locked = t >= sw, k = easeOut((t - (locked ? sw : o.t0)) / 0.24), y = o.y ?? 300, txt = locked ? o.b : o.a, col = locked ? '#ffc531' : '#3ddc84';
  ctx.save(); ctx.translate(540, y); ctx.scale(lerp(0.8, 1, k), lerp(0.8, 1, k)); ctx.globalAlpha = clamp(k * 1.5); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const size = fitText(ctx, txt, 760, 60), tw = ctx.measureText(txt).width, w = tw + 180, h = 132;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; ctx.fillStyle = 'rgba(16,12,34,0.94)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 40); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.stroke();
  // padlock
  const lx = -w / 2 + 74; ctx.strokeStyle = col; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); if (locked) ctx.arc(lx, -12, 17, Math.PI, 0); else ctx.arc(lx + 12, -22, 17, Math.PI * 1.05, Math.PI * 0.05); ctx.stroke();
  if (locked) { ctx.beginPath(); ctx.moveTo(lx - 17, -12); ctx.lineTo(lx - 17, 0); ctx.moveTo(lx + 17, -12); ctx.lineTo(lx + 17, 0); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(lx - 5, -20); ctx.lineTo(lx - 5, 0); ctx.stroke(); }
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(lx - 27, -4, 54, 42, 10); ctx.fill(); ctx.fillStyle = '#14102a'; ctx.beginPath(); ctx.arc(lx, 14, 6, 0, 7); ctx.fill();
  ctx.font = `900 ${size}px ${DISP}`; ctx.fillStyle = '#fff'; ctx.fillText(txt, -w / 2 + 126, 3); ctx.restore();
  if (locked && o.follow) { const k2 = easeOut((t - sw - 0.15) / 0.25); if (k2 > 0) { ctx.save(); ctx.globalAlpha = clamp(k2 * 1.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 44px ${UI}`; const fw = ctx.measureText(o.follow).width + 84; ctx.fillStyle = '#ffc531'; ctx.beginPath(); ctx.roundRect(540 - fw / 2, y + 96 + (1 - k2) * 20, fw, 88, 44); ctx.fill(); ctx.fillStyle = '#14102a'; ctx.fillText(o.follow, 540, y + 142 + (1 - k2) * 20); ctx.restore(); } }
}
// a gold call-to-action pill (follow line, <= 2 s). o: { text, y }
export function pill(ctx, o, t) {
  const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920, CX = CW / 2, wide = CW > CH;
  const k = easeOut((t - o.t0) / 0.22) * clamp((o.t1 - t) / 0.15); if (k <= 0) return; const y = o.y ?? (wide ? 140 : 300);
  ctx.save(); ctx.translate(CX, y); ctx.scale(lerp(0.8, 1, k), lerp(0.8, 1, k)); ctx.globalAlpha = clamp(k * 1.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const size = fitText(ctx, o.text, wide ? 1400 : 820, o.size ?? 56, 900, 40), w = ctx.measureText(o.text).width + 96, h = size + 62;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; ctx.fillStyle = o.color || '#ffc531'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#14102a'; ctx.fillText(o.text, 0, 3); ctx.restore();
}
// a window into someone's chest (series "Tèo nhịn hạt", Ngày 13: "nhìn thấu tâm can"): a round porthole tied by a short tail to `who`'s chest,
// it irises open with a pulse of light, and inside the episode draws a tiny lit room: o.room(ctx, t, { r, u, k }) in a frame centred on the window
// (x and y from -r to r; u = seconds since the window is fully open; k = 0..1 open). o: { who, room, r (radius, px, default 175), dx, dy (offset from the chest),
// x, y (fixed centre instead), rim ('#b56cff'), open (iris seconds, 0.3), close (0.18; slam: 0.07), at: [x, y, z] chest point in the body frame (default [0, headY - 0.4, 0.14]),
// maxY (lowest centre, default 1236 - r: the window stays above the caption band) }. A 2-D inset: a hand in front of the chest does not hide it, so close the window instead.
export function chest(ctx, o, t, ep, cast, camera) {
  if (t < o.t0 || t > o.t1) return;
  const c = cast[o.who], r = o.r ?? 175, op = o.open ?? 0.3, kin = clamp((t - o.t0) / op), kout = clamp((o.t1 - t) / (o.slam ? 0.07 : (o.close ?? 0.18))), k = Math.min(overshoot(kin, 0.1), 1.08) * kout; if (k <= 0) return;
  let ax = o.ax ?? 540, ay = o.ay ?? 1000;
  if (c && camera) { const a = o.at || [0, (c.headY ?? 0.95) - 0.4, 0.14], p = project(camera, c.body.localToWorld(new THREE.Vector3(a[0], a[1], a[2])), 1080, 1920); ax = p[0]; ay = p[1]; }
  const cx = clamp(o.x ?? ax + (o.dx ?? 0), SAFE.l + r + 16, SAFE.r - r - 16), cy = clamp(o.y ?? ay + (o.dy ?? 0), SAFE.t + r + 40, o.maxY ?? 1236 - r) + Math.sin(t * 1.7 + 0.6) * 4;
  const rim = o.rim || '#b56cff', u = t - o.t0 - op, pulse = u > 0 ? Math.exp(-u / 0.22) : kin;
  ctx.save();
  // tail: three beads from the window down to the chest point (only when the chest is outside the window)
  const d = Math.hypot(ax - cx, ay - cy); if (d > r * 1.05) { const ex = cx + (ax - cx) / d * r, ey = cy + (ay - cy) / d * r; [[0.3, 15], [0.58, 11], [0.84, 8]].forEach(([f, br], i) => { const kk = clamp(kin * 3 - i * 0.5) * kout; if (kk <= 0) return; ctx.globalAlpha = kk; ctx.fillStyle = rim; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(lerp(ex, ax, f), lerp(ey, ay, f), br * kk, 0, 7); ctx.fill(); ctx.stroke(); }); }
  ctx.globalAlpha = clamp(k * 1.6); ctx.translate(cx, cy); ctx.scale(k, k);
  // glow behind the rim, then the room through an iris that opens from the centre
  ctx.shadowColor = rim; ctx.shadowBlur = 40 + 50 * pulse; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, r + 16, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  const bg = ctx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r * 1.1); bg.addColorStop(0, '#fff1d2'); bg.addColorStop(1, '#e7b67a'); ctx.fillStyle = bg; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  if (o.room) { ctx.save(); o.room(ctx, t, { r, u: Math.max(0, u), k }); ctx.restore(); }
  const iris = easeOut(kin); if (iris < 1) { ctx.fillStyle = INK; ctx.beginPath(); ctx.rect(-r - 2, -r - 2, 2 * r + 4, 2 * r + 4); ctx.moveTo(r * iris, 0); ctx.arc(0, 0, r * iris, 0, Math.PI * 2, true); ctx.closePath(); ctx.fill('evenodd'); }
  const vg = ctx.createRadialGradient(0, 0, r * 0.62, 0, 0, r); vg.addColorStop(0, 'rgba(40,10,70,0)'); vg.addColorStop(1, 'rgba(40,10,70,0.45)'); ctx.fillStyle = vg; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  if (pulse > 0.02) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rim; ctx.globalAlpha = clamp(k * 1.6) * 0.55 * pulse; ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  // the rim: thick ink ring, a coloured ring, a thin highlight
  ctx.globalAlpha = clamp(k * 1.6); ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, 7); ctx.stroke(); ctx.lineWidth = 10; ctx.strokeStyle = rim; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, 7); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(0, 0, r - 4, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}
export function drawOverlays(ctx, ep, t, cast, camera) {
  for (const o of ep.overlays || []) { if (t < o.t0 - 0.01 || t > o.t1 + 0.01) continue; ONLY.cur = o.kind; ({ hook, chip, bubble, end: endCard, score, backdrop, draw, phone, thought, call, notify, unlock, pill, chest, ...ZB, ...V2_OVERLAYS }[o.kind] || (() => {}))(ctx, o, t, ep, cast, camera); }
  caption(ctx, ep, t, cast);
}
