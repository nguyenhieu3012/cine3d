// Trà đá với AI, "Tèo vào GTA 6" part 3 NEW (gta6p3b, 21/11): the 2-D pieces, factories in the style of gta_hud.js (ready `kind: 'draw'` overlays; `reads` / `noText` declared from the real windows).
//   groupChat({ t0, t1, tings: [t, t, t], text: 'NÓ ĐÂY RỒI' })   a phone card of the neighbours' group chat [KHU PHỐ 7]: three bubbles pop in on the three tings (the first carries the one line of text, the other two are picture bubbles:
//                                                                  a wanted-poster thumbnail and the green trail), the card buzzes on every ting. Declares reads: the group name and the line.
//   blackout({ t0, t1, fade })                                    a plain black screen (the sack POV: the screen goes dark); fades in over `fade` s. Declared noText.
// Pure functions of t; never additive; never reads the canvas.
import { hudText as T, hudMeasure as M, hudPanel, C } from './gta_hud.js';
import { ledWave } from './gta_p2b_props.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k, sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const backOut = (x, c = 1.7) => { x = clamp(x); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const overlay = (o, fn, decl) => ({ kind: 'draw', t0: o.t0 - 0.02, t1: o.t1 + 0.02, fade: 0.01, ...decl, ...(decl.reads ? { text: decl.reads.map((r) => r.text).join(' | ') } : {}), fn: (ctx, t, env) => fn(ctx, t, o, env) });

function miniPoster(ctx, x, y, w, h) {   // a tiny TRUY NÃ poster: red top, a gold blob torso on two thin legs (picture only)
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#f2e6c8'; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill(); ctx.fillStyle = '#c4202a'; ctx.fillRect(0, 0, w, h * 0.2); ctx.strokeStyle = '#c4202a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 8); ctx.stroke();
  ctx.strokeStyle = '#1b1620'; ctx.lineWidth = 3; ctx.fillStyle = '#f1c7a3'; ctx.beginPath(); ctx.arc(w / 2, h * 0.37, w * 0.11, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f0b12e'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * 0.34, h * 0.15, 0, 0, TAU); ctx.fill(); ctx.stroke(); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(w / 2 + s * w * 0.1, h * 0.74); ctx.lineTo(w / 2 + s * w * 0.11, h * 0.92); ctx.stroke(); } ctx.restore();
}
function miniTrail(ctx, x, y, w, h) {   // a picture of the green car and its trail on the road
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#3a3448'; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill(); ctx.strokeStyle = '#1fd45a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.8); ctx.bezierCurveTo(w * 0.3, h * 0.9, w * 0.4, h * 0.4, w * 0.62, h * 0.55); ctx.stroke();
  ctx.fillStyle = '#12c25a'; ctx.strokeStyle = '#06301a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(w * 0.6, h * 0.34, w * 0.3, h * 0.3, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#0a2a1a'; ctx.beginPath(); ctx.arc(w * 0.66, h * 0.66, 7, 0, TAU); ctx.arc(w * 0.84, h * 0.66, 7, 0, TAU); ctx.fill(); ctx.restore();
}
export function drawGroupChat(ctx, t, o) {
  const tg = o.tings || [o.t0 + 0.3, o.t0 + 0.7, o.t0 + 1.1], inK = backOut((t - o.t0) / 0.28, 1.5), out = sm((o.t1 - t) / 0.16), k = clamp(inK) * out; if (k <= 0) return;
  let buzz = 0; for (const a of tg) { const u = t - a; if (u >= 0 && u < 0.3) buzz += Math.sin(u * 90) * (1 - u / 0.3) * 6; }
  const W = 800, H = 640, cx = 540, cy = o.y ?? 760;
  ctx.save(); ctx.globalAlpha *= k; ctx.translate(cx + buzz, cy); ctx.scale(lerp(0.85, 1, clamp(inK)), lerp(0.85, 1, clamp(inK)));
  hudPanel(ctx, -W / 2, -H / 2, W, H, { r: 44, fill: 'rgba(20,22,40,0.94)', edge: '#ffc43a', edgeW: 5, ticks: true, shadow: 30 });
  // header: a round avatar + the group name + three tiny member dots
  ctx.fillStyle = '#ff6fb0'; ctx.beginPath(); ctx.arc(-W / 2 + 80, -H / 2 + 76, 38, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-W / 2 + 80, -H / 2 + 66, 12, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(-W / 2 + 80, -H / 2 + 100, 22, 14, 0, Math.PI, TAU); ctx.fill();
  T(ctx, 'KHU PHỐ 7', -W / 2 + 140, -H / 2 + 76, 58, { align: 'left', ls: 2, fill: '#fff', outline: 5 });
  for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#35c8a0', '#ffd23a', '#ff6fb0'][i]; ctx.beginPath(); ctx.arc(W / 2 - 150 + i * 44, -H / 2 + 76, 17, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-W / 2 + 30, -H / 2 + 140); ctx.lineTo(W / 2 - 30, -H / 2 + 140); ctx.stroke();
  const bub = [
    { y: -H / 2 + 175, h: 140, draw: (x, y, w, h, p) => { ctx.fillStyle = '#c4202a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(x, y, w, h, 30); ctx.fill(); ctx.stroke(); T(ctx, o.text ?? 'NÓ ĐÂY RỒI', x + w / 2, y + h / 2 + 3, 74, { align: 'center', ls: 3, fill: '#fff', outline: 5 }); }, w: 560 },
    { y: -H / 2 + 335, h: 120, draw: (x, y, w, h) => { ctx.fillStyle = '#2c3050'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.fill(); miniPoster(ctx, x + 22, y + 10, 70, 100); miniPoster(ctx, x + 110, y + 10, 70, 100); }, w: 220 },
    { y: -H / 2 + 475, h: 130, draw: (x, y, w, h) => { ctx.fillStyle = '#2c3050'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.fill(); miniTrail(ctx, x + 16, y + 12, 240, 106); }, w: 272 },
  ];
  bub.forEach((b, i) => { const u = backOut((t - tg[i]) / 0.22, 2.0); if (t < tg[i]) return; const x = -W / 2 + 56, side = i === 0 ? 0 : 0; ctx.save(); ctx.globalAlpha *= clamp(u * 1.5); ctx.translate(x, b.y + b.h / 2); ctx.scale(lerp(0.6, 1, clamp(u)), lerp(0.6, 1, clamp(u))); ctx.translate(0, -b.h / 2); ctx.fillStyle = ['#35c8a0', '#ffd23a', '#ff6fb0'][i]; ctx.beginPath(); ctx.arc(-6, b.h / 2, 0, 0, TAU); ctx.fill(); b.draw(side, 0, b.w, b.h); ctx.restore(); });
  ctx.restore();
}
export const groupChat = (o) => overlay(o, drawGroupChat, { reads: [{ text: 'KHU PHỐ 7', t0: o.t0 + 0.3, t1: o.t1 }, { text: o.text ?? 'NÓ ĐÂY RỒI', t0: (o.tings || [o.t0 + 0.3])[0] + 0.1, t1: o.t1 }] });

export function drawBlackout(ctx, t, o) { const k = sm((t - o.t0) / (o.fade ?? 0.05)); if (k <= 0) return; ctx.save(); ctx.globalAlpha *= k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore(); }
export const blackout = (o) => overlay(o, drawBlackout, { noText: true });

// the tracker on Linh's phone: a dark map with a coast, a grid and a RED DOT whose ring blinks in step with the key fob's LED (ledWave); her hand holds the phone (a thumb and fingers at the edges). Picture only: noText.
export function drawTrackerPhone(ctx, t, o) {
  const k = sm((t - o.t0) / 0.1) * sm((o.t1 - t) / 0.1); if (k <= 0) return; const w = ledWave(t), W = 600, H = 1040, cx = 540, cy = o.y ?? 900;
  ctx.save(); ctx.globalAlpha *= k; ctx.translate(cx, cy);
  ctx.fillStyle = '#e8b896'; for (const [x, y, rx, ry, a] of [[-W / 2 - 6, 140, 52, 150, -0.1], [-W / 2 - 6, 330, 46, 90, -0.05], [W / 2 + 40, 360, 70, 190, 0.12], [W / 2 + 14, 150, 44, 80, 0.1]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, a, 0, TAU); ctx.fill(); }   // the hand
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.fillStyle = '#0c0d14'; ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 70); ctx.fill(); ctx.shadowColor = 'transparent';
  const x0 = -W / 2 + 26, y0 = -H / 2 + 60, sw = W - 52, sh = H - 120; ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, sw, sh, 40); ctx.clip();
  ctx.fillStyle = '#0b2c4a'; ctx.fillRect(x0, y0, sw, sh); ctx.strokeStyle = 'rgba(80,170,230,0.2)'; ctx.lineWidth = 2; for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(x0 + i * sw / 8, y0); ctx.lineTo(x0 + i * sw / 8, y0 + sh); ctx.stroke(); } for (let i = 0; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(x0, y0 + i * sh / 14); ctx.lineTo(x0 + sw, y0 + i * sh / 14); ctx.stroke(); }
  ctx.fillStyle = '#134468'; ctx.beginPath(); ctx.moveTo(x0, y0 + sh * 0.5); ctx.quadraticCurveTo(x0 + sw * 0.4, y0 + sh * 0.42, x0 + sw * 0.62, y0 + sh * 0.2); ctx.quadraticCurveTo(x0 + sw * 0.8, y0 + sh * 0.05, x0 + sw, y0); ctx.lineTo(x0 + sw, y0 + sh); ctx.lineTo(x0, y0 + sh); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(95,200,255,0.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0, y0 + sh * 0.5); ctx.quadraticCurveTo(x0 + sw * 0.4, y0 + sh * 0.42, x0 + sw * 0.62, y0 + sh * 0.2); ctx.quadraticCurveTo(x0 + sw * 0.8, y0 + sh * 0.05, x0 + sw, y0); ctx.stroke();
  const px = x0 + sw * 0.42, py = y0 + sh * 0.62, ph = (t / 0.5) % 1;
  ctx.strokeStyle = `rgba(255,70,70,${0.85 * (1 - ph)})`; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(px, py, 26 + 150 * ph, 0, TAU); ctx.stroke();
  const gg = ctx.createRadialGradient(px, py, 2, px, py, 110); gg.addColorStop(0, `rgba(255,40,40,${0.35 + 0.6 * w})`); gg.addColorStop(1, 'rgba(255,60,60,0)'); ctx.fillStyle = gg; ctx.fillRect(px - 120, py - 120, 240, 240);
  ctx.fillStyle = `rgb(255,${Math.round(36 + 40 * w)},${Math.round(36 + 30 * w)})`; ctx.beginPath(); ctx.arc(px, py, 22 + 10 * w, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(140,230,255,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px - 60, py); ctx.lineTo(px - 34, py); ctx.moveTo(px + 34, py); ctx.lineTo(px + 60, py); ctx.moveTo(px, py - 60); ctx.lineTo(px, py - 34); ctx.moveTo(px, py + 34); ctx.lineTo(px, py + 60); ctx.stroke();
  ctx.restore(); ctx.restore();
}
export const trackerPhone = (o) => overlay(o, drawTrackerPhone, { noText: true });
