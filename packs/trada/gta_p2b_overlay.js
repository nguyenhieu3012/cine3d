// Trà đá với AI, "Tèo vào GTA 6" part 2 NEW (gta6p2b, 20/11): the 2-D pieces, factories in the style of gta_hud.js (ready `kind: 'draw'` overlays; `reads` / `noText` declared from the real windows).
//   statBars({ t0, t1, who, bars: [{ icon: 'arm' | 'weight', color, fill: [[t, v], ...] }, ...] })   two (or more) bars floating above `who`'s head, ICONS ONLY (no words), following the head through the real camera
//   wantedLabel({ t0, t1, target: 'car_silver', text })     the red tag XE ĐANG BỊ TRUY NÃ floating above a 3-D object (follows it through the real camera)
//   endTag({ t0, t1, who, text, stars: 4 })                  ONE card [CÒN TIẾP · TẬP 3 · THEO DÕI] at the bottom, four small stars that blink above `who`'s head
// Pure functions of t; never additive; never reads the canvas (goes through pngseq --overlays-only unchanged).
import { hudText as T, hudMeasure as M, hudFit as FIT, hudPanel, C } from './gta_hud.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k, sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const backOut = (x, c = 1.7) => { x = clamp(x); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const overlay = (o, fn, decl) => ({ kind: 'draw', t0: o.t0 - 0.02, t1: o.t1 + 0.02, fade: 0.01, ...decl, ...(decl.reads ? { text: decl.reads.map((r) => r.text).join(' | ') } : {}), fn: (ctx, t, env) => fn(ctx, t, o, env) });

function headPx(env, who, up = 1.25) { const c = env?.cast?.[who], cam = globalThis.stage?.camera; if (!c || !cam) return null; const h = c.headWorld(), top = h.clone().add(cam.up.clone().multiplyScalar((c.R ?? 0.17) * up)), side = h.clone().add(cam.up.clone().multiplyScalar(c.R ?? 0.17));
  const a = top.clone().project(cam), b = h.clone().project(cam), s = side.clone().project(cam); if (a.z > 1 || b.z > 1) return null; const x = (a.x * 0.5 + 0.5) * 1080, y = (-a.y * 0.5 + 0.5) * 1920, pr = Math.abs(((-s.y * 0.5 + 0.5) - (-b.y * 0.5 + 0.5)) * 1920); return { x, y, pr: Math.max(20, pr), z: a.z }; }
function objPx(name, dy = 1.9) { const cam = globalThis.stage?.camera, sc = globalThis.stage?.scene; if (!cam || !sc) return null; const o = sc.getObjectByName(name); if (!o) return null; const v = o.getWorldPosition(new (cam.position.constructor)()); v.y += dy; v.project(cam); if (v.z > 1) return null; return { x: (v.x * 0.5 + 0.5) * 1080, y: (-v.y * 0.5 + 0.5) * 1920 }; }

// ---- icons (drawn in a 60 x 60 box centred on 0,0) ----
function iconArm(ctx, r) {   // a flexed arm: the forearm up, the upper arm across, a big bicep bump
  ctx.save(); ctx.scale(r / 30, r / 30); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#2a1a05'; ctx.fillStyle = '#fff6e2'; ctx.lineWidth = 6.5;
  ctx.beginPath(); ctx.moveTo(-17, 15); ctx.lineTo(-17, -2); ctx.quadraticCurveTo(-17, -17, -4, -19); ctx.lineTo(3, -19); ctx.quadraticCurveTo(6, -27, 14, -24); ctx.quadraticCurveTo(21, -20, 17, -9); ctx.quadraticCurveTo(24, -2, 19, 8); ctx.quadraticCurveTo(15, 17, 2, 16); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(1, -9); ctx.quadraticCurveTo(10, -6, 9, 4); ctx.stroke(); ctx.restore();
}
function iconWeight(ctx, r) {   // a kettlebell
  ctx.save(); ctx.scale(r / 30, r / 30); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#2a0a1c'; ctx.fillStyle = '#fff1f7'; ctx.lineWidth = 6.5;
  ctx.beginPath(); ctx.arc(0, 6, 16, 0, TAU); ctx.stroke(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-11, -6); ctx.bezierCurveTo(-11, -25, 11, -25, 11, -6); ctx.stroke();
  ctx.fillStyle = '#2a0a1c'; ctx.beginPath(); ctx.ellipse(0, 7, 6, 3.5, 0, 0, TAU); ctx.fill(); ctx.restore();
}
const fillAt = (keys, t) => { if (!keys?.length) return 0; if (t <= keys[0][0]) return keys[0][1]; for (let i = 0; i < keys.length - 1; i++) { const [a, va, o] = [keys[i][0], keys[i][1]], [b, vb] = keys[i + 1]; if (t < b) { const d = keys[i + 1][2]?.d ?? (b - a); const u = clamp((t - (b - d)) / Math.max(1e-3, d)); return lerp(va, vb, sm(u)); } } return keys[keys.length - 1][1]; };

export function drawStatBars(ctx, t, o, env) {
  const inK = backOut((t - o.t0) / 0.3, 1.9), out = sm((o.t1 - t) / 0.2), k = clamp(inK) * out; if (k <= 0) return;
  let h = headPx(env, o.who ?? 'teo', 1.15); if (!h) return;
  const bars = o.bars, W = 320, BH = 54, GAP = 12, total = bars.length * BH + (bars.length - 1) * GAP, cx = clamp(h.x, 54 + W / 2 + 30, 1026 - W / 2), top = Math.max(330, h.y - 26 - total) + 4 * Math.sin(t * 2.4);
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.4); ctx.translate(cx, top + total / 2); ctx.scale(lerp(0.7, 1, clamp(inK)), lerp(0.7, 1, clamp(inK))); ctx.translate(-cx, -(top + total / 2));
  bars.forEach((b, i) => {
    const y = top + i * (BH + GAP), x = cx - W / 2, v = clamp(fillAt(b.fill, t)), vp = clamp(fillAt(b.fill, t - 0.12)), moving = Math.abs(v - vp) > 0.004, col = b.color ?? (b.icon === 'arm' ? '#ffb02e' : '#ff5fa8'), col2 = b.icon === 'arm' ? '#ff6a1a' : '#c2185b';
    hudPanel(ctx, x, y, W, BH, { r: BH / 2, edge: C.gold, edgeW: 3, ticks: false, shadow: 12 });
    // the track and the fill
    const tx = x + BH + 6, tw = W - BH - 18, ty = y + 14, th = BH - 28; ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, th / 2); ctx.fill();
    if (v > 0.004) { const g = ctx.createLinearGradient(tx, 0, tx + tw, 0); g.addColorStop(0, col2); g.addColorStop(1, col); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(tx, ty, Math.max(th, tw * v), th, th / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.roundRect(tx + 6, ty + 3, Math.max(th - 10, tw * v - 12), th * 0.3, th * 0.15); ctx.fill();
      if (moving) { const sx = tx + Math.max(th, tw * v), sh = 0.5 + 0.5 * Math.sin(t * 30); ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * sh})`; ctx.beginPath(); ctx.arc(sx - 6, ty + th / 2, th * 0.45, 0, TAU); ctx.fill(); } }
    // the icon medallion
    ctx.save(); ctx.translate(x + BH / 2 + 2, y + BH / 2); ctx.fillStyle = col2; ctx.strokeStyle = C.gold; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, BH / 2 - 1, 0, TAU); ctx.fill(); ctx.stroke();
    const pk = moving ? 1.12 : 1; ctx.scale(pk, pk); (b.icon === 'arm' ? iconArm : iconWeight)(ctx, 22); ctx.restore();
  });
  ctx.restore();
}
export const statBars = (o) => overlay(o, drawStatBars, { noText: true });

export function drawWantedLabel(ctx, t, o) {
  const inK = backOut((t - o.t0) / 0.26, 2.0), out = sm((o.t1 - t) / 0.2), k = clamp(inK) * out; if (k <= 0) return;
  const P = objPx(o.target ?? 'car_silver', o.dy ?? 2.0); if (!P) return; const text = o.text ?? 'XE ĐANG BỊ TRUY NÃ', size = 40, tw = M(ctx, text, size, { ls: 2 }), w = tw + 130, h = 80, pulse = 0.5 + 0.5 * Math.sin((t - o.t0) * 9);
  const cx = clamp(P.x, 360 + w / 2, 1040 - w / 2), cy = clamp(P.y, 540 + h / 2, 1020) + 5 * Math.sin(t * 2.6);
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.4); ctx.translate(cx, cy); ctx.scale(lerp(0.7, 1, clamp(inK)), lerp(0.7, 1, clamp(inK)));
  hudPanel(ctx, -w / 2, -h / 2, w, h, { r: 18, fill: `rgb(${Math.round(120 + 40 * pulse)},14,28)`, edge: '#ff4d4d', edgeW: 4.5, ticks: false, shadow: 16 });
  ctx.fillStyle = C.panel; ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(-15, h / 2 - 1); ctx.lineTo(0, h / 2 + 20); ctx.lineTo(15, h / 2 - 1); ctx.stroke(); ctx.fillStyle = `rgb(${Math.round(120 + 40 * pulse)},14,28)`; ctx.fill();
  ctx.fillRect(-14, h / 2 - 6, 28, 8);
  // warning triangle (red, white !)
  ctx.save(); ctx.translate(-w / 2 + 48, 2); ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#2a1a05'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(26, 20); ctx.lineTo(-26, 20); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.fillStyle = '#2a1a05'; ctx.fillRect(-3.5, -9, 7, 16); ctx.beginPath(); ctx.arc(0, 14, 3.8, 0, TAU); ctx.fill(); ctx.restore();
  T(ctx, text, 30, 3, size, { align: 'center', ls: 2, fill: '#fff', outline: 5 }); ctx.restore();
}
export const wantedLabel = (o) => overlay(o, drawWantedLabel, { reads: [{ text: o.text ?? 'XE ĐANG BỊ TRUY NÃ', t0: +(o.t0 + 0.1).toFixed(3), t1: o.t1 }] });

export function drawEndTag(ctx, t, o, env) {
  const u = t - o.t0, out = sm((o.t1 - t) / 0.15), k = backOut(u / 0.22, 1.8); if (u < 0 || out <= 0) return;
  const text = o.text ?? 'CÒN TIẾP · TẬP 3 · THEO DÕI', y = o.y ?? 1130, size = FIT(ctx, text, 900, 56, 30, { ls: 3 }), w = M(ctx, text, size, { ls: 3 }) + 110, h = size + 64, RED = '#e0282e';
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.5) * out; ctx.translate(540, y); ctx.scale(lerp(0.8, 1, clamp(k)), lerp(0.8, 1, clamp(k)));
  ctx.shadowColor = 'rgba(8,10,24,0.5)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8; ctx.fillStyle = 'rgba(255,244,232,0.96)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 24); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = RED; ctx.lineWidth = 9; ctx.beginPath(); ctx.roundRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 17); ctx.stroke();
  T(ctx, text, 0, 3, size, { align: 'center', ls: 3, fill: RED, outline: 0 }); ctx.restore();
  // four small stars above the head, blinking one after the other (0.18 s apart), gold
  const hp = headPx(env, o.who ?? 'teo', 1.15); if (hp) { const n = o.stars ?? 4, gap = 64, x0 = hp.x - (n - 1) * gap / 2, sy = Math.max(300, hp.y - 56);
    for (let i = 0; i < n; i++) { const ph = 0.5 + 0.5 * Math.sin((t - o.t0) * 9 - i * 0.9), pop = backOut((u - 0.05 - i * 0.08) / 0.2, 2.2), r = (22 + 5 * ph) * clamp(pop); if (r <= 0.5) continue;
      ctx.save(); ctx.globalAlpha *= out * (0.55 + 0.45 * ph); ctx.translate(x0 + i * gap, sy + 3 * Math.sin(t * 5 + i)); ctx.fillStyle = '#ffc43a'; ctx.strokeStyle = '#2a1a05'; ctx.lineWidth = 4; ctx.beginPath();
      for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * TAU / 10, rr = j % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); } }
}
export const endTag = (o) => overlay(o, drawEndTag, { reads: [{ text: o.text ?? 'CÒN TIẾP · TẬP 3 · THEO DÕI', t0: +(o.t0 + 0.2).toFixed(3), t1: o.t1 }] });

// ---------------------------------------------------------------------------------------------------------------------------------
// FULL-FRAME 2-D INSERTS (do not depend on the Blender background): they cover 100 % of the picture and sit UNDER the HUD and the captions.
//   plateInsert({ t0, t1 })    the mud-covered licence plate "51K 86 / 888.88" filling the frame, on the silver car's tail (still, bright)
//   mirrorInsert({ t0, t1 })   the rear-view mirror filling 80 % of the width: a police car with flashing red / blue lights coming up behind
// The plate digits are drawn on an offscreen canvas (cached), so no text is registered by the text checks (they are a picture, declared noText).
let _plate = null;
function plateCanvas() {
  if (_plate) return _plate; const W = 900, H = 430, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  c.fillStyle = '#f4f2e8'; c.beginPath(); c.roundRect(0, 0, W, H, 44); c.fill(); c.strokeStyle = '#1e2c52'; c.lineWidth = 22; c.beginPath(); c.roundRect(22, 22, W - 44, H - 44, 30); c.stroke();
  c.fillStyle = '#1e2c52'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 210px Display, sans-serif'; c.fillText('51K 86', W / 2, H / 2 - 58); c.font = '900 125px Display, sans-serif'; c.fillText('888.88', W / 2, H / 2 + 98);
  const hh = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < 40; i++) { const x = hh(i * 3.1) * W, y = (0.25 + 0.75 * hh(i * 5.7)) * H, r = 14 + 50 * hh(i * 9.3) * (x > W * 0.5 ? 1.3 : 0.6); c.fillStyle = `rgba(${86 + 30 * hh(i)},${58 + 20 * hh(i + 1)},34,${0.78 + 0.2 * hh(i + 2)})`; c.beginPath(); c.ellipse(x, y, r, r * (0.6 + 0.5 * hh(i * 2.2)), hh(i) * 3, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(92,62,36,0.93)'; c.beginPath(); c.moveTo(W * 0.52, H * 0.1); for (let k = 0; k <= 12; k++) c.lineTo(W * (0.52 + 0.48 * k / 12), H * (0.1 + 0.07 * Math.sin(k * 2.1))); c.lineTo(W, H); c.lineTo(W * 0.42, H); c.closePath(); c.fill();   // the mud hides the right half: "51K" and "88" still read
  return (_plate = cv);
}
export function drawPlateInsert(ctx, t, o) {
  const k = clamp((t - o.t0) / 0.06) * clamp((o.t1 - t) / 0.06); if (k <= 0) return; ctx.save(); ctx.globalAlpha *= k;
  const u0 = clamp((t - o.t0) / (o.t1 - o.t0)), zs = 1 + 0.05 * u0; ctx.translate(540, 960); ctx.scale(zs, zs); ctx.translate(-540, -960);   // a slow push-in 1.00 -> 1.05: every frame differs
  // the silver tail: a brushed-metal gradient, a chrome bumper bar, two red tail lamps
  const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#9aa2b4'); g.addColorStop(0.35, '#dfe3ec'); g.addColorStop(0.62, '#c3c9d6'); g.addColorStop(0.64, '#eef0f6'); g.addColorStop(0.7, '#8a90a0'); g.addColorStop(1, '#4a4e5c'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  const hl = ctx.createLinearGradient(0, 0, 1080, 0); hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.3, 'rgba(255,255,255,0.35)'); hl.addColorStop(0.6, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.fillRect(0, 0, 1080, 1250);
  for (const x of [20, 880]) { ctx.fillStyle = '#e2312c'; ctx.beginPath(); ctx.roundRect(x, 640, 180, 150, 30); ctx.fill(); ctx.fillStyle = 'rgba(255,190,170,0.55)'; ctx.beginPath(); ctx.roundRect(x + 14, 654, 152, 40, 20); ctx.fill(); }
  ctx.fillStyle = '#20222c'; ctx.beginPath(); ctx.roundRect(70, 500, 940, 560, 36); ctx.fill();   // the plate's dark mount
  ctx.drawImage(plateCanvas(), 90, 565, 900, 430);
  for (const [x, y] of [[112, 588], [968, 588], [112, 976], [968, 976]]) { ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#d6dae4'; ctx.fillRect(0, 1180, 1080, 70); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 1250, 1080, 8);
  // a glare streak that slides slowly across the plate
  { const gx = -300 + 1700 * u0; ctx.save(); ctx.beginPath(); ctx.roundRect(90, 565, 900, 430, 44); ctx.clip(); const gg = ctx.createLinearGradient(gx - 140, 0, gx + 140, 0); gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.transform(1, 0, -0.35, 1, 0, 0); ctx.fillStyle = gg; ctx.fillRect(gx - 140, 565, 280, 430); ctx.restore(); }
  ctx.restore();
}
export const plateInsert = (o) => ({ kind: 'draw', t0: o.t0, t1: o.t1, fade: 0.01, noText: true, fn: (ctx, t) => drawPlateInsert(ctx, t, o) });

export function drawMirrorInsert(ctx, t, o) {
  const k = clamp((t - o.t0) / 0.06) * clamp((o.t1 - t) / 0.06); if (k <= 0) return; ctx.save(); ctx.globalAlpha *= k;
  { const u1 = clamp((t - o.t0) / (o.t1 - o.t0)), zs = 1 + 0.05 * u1; ctx.translate(540, 960); ctx.scale(zs, zs); ctx.translate(-540, -960); }   // slow push-in, every frame differs; the police car also grows smoothly
  // behind the mirror: the blurred cabin (a warm glare above, the dark dashboard below), a chrome stalk
  const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#fff2e2'); g.addColorStop(0.45, '#e8c8b4'); g.addColorStop(0.62, '#6a5448'); g.addColorStop(1, '#2a2430'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  const MW = 880, MH = 300, mx = 100, my = 760; ctx.fillStyle = '#c7ccd6'; ctx.fillRect(520, 330, 40, my - 320);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14; ctx.fillStyle = '#1b1c24'; ctx.beginPath(); ctx.roundRect(mx - 22, my - 22, MW + 44, MH + 44, 44); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#d6dae4'; ctx.beginPath(); ctx.roundRect(mx - 8, my - 8, MW + 16, MH + 16, 36); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(mx, my, MW, MH, 30); ctx.clip();
  const sg = ctx.createLinearGradient(0, my, 0, my + MH); sg.addColorStop(0, '#6a3a8a'); sg.addColorStop(0.5, '#ffa070'); sg.addColorStop(0.53, '#4a4458'); sg.addColorStop(1, '#2a2634'); ctx.fillStyle = sg; ctx.fillRect(mx, my, MW, MH);
  const hy = my + MH * 0.53; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 6; for (const x of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(mx + MW / 2 + x * 14, hy); ctx.lineTo(mx + MW / 2 + x * 380, my + MH); ctx.stroke(); }
  const u = clamp((t - o.t0) / (o.t1 - o.t0)), kk = 0.6 + 0.4 * u, cx = mx + MW / 2, cy = my + MH * 0.9, w = 440 * kk, h = 150 * kk, a = 0.5 + 0.5 * Math.sin(t * 6.1), b = 1 - a;
  ctx.fillStyle = '#1d2331'; ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h, w, h, 18); ctx.fill(); ctx.fillStyle = '#f3f4f2'; ctx.fillRect(cx - w / 2 + 8, cy - h * 0.6, w - 16, h * 0.18); ctx.fillStyle = '#2a3a4e'; ctx.fillRect(cx - w * 0.36, cy - h * 0.98, w * 0.72, h * 0.36);
  const bw = w * 0.24; ctx.fillStyle = `rgb(${Math.round(150 + 105 * a)},30,30)`; ctx.fillRect(cx - w * 0.32, cy - h * 1.2, bw, h * 0.2); ctx.fillStyle = `rgb(30,70,${Math.round(150 + 105 * b)})`; ctx.fillRect(cx + w * 0.32 - bw, cy - h * 1.2, bw, h * 0.2);
  for (const s2 of [-1, 1]) { ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(cx + s2 * w * 0.34, cy - h * 0.3, 16 * kk, 0, TAU); ctx.fill(); }
  for (const [col, sx] of [[`rgba(255,40,40,${0.7 * a})`, -0.32], [`rgba(50,90,255,${0.7 * b})`, 0.32]]) { const g2 = ctx.createRadialGradient(cx + sx * w, cy - h * 1.1, 4, cx + sx * w, cy - h * 1.1, 260 * kk); g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(mx, my, MW, MH); }
  ctx.restore(); ctx.restore();
}
export const mirrorInsert = (o) => ({ kind: 'draw', t0: o.t0, t1: o.t1, fade: 0.01, noText: true, fn: (ctx, t) => drawMirrorInsert(ctx, t, o) });
