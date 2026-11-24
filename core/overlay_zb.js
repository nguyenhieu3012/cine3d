// cine3d core: screen-layer pieces for the two-part Zombie special (13/11): iris, freeze_rewind, title, phone-screen insets
// (calling / balance / transfer (real and AI-fake) / blank / qr), white_flash, cold. All pure functions of t, everything ramped.
// Signature of every overlay: (ctx, o, t, ep, cast, camera). Registered in drawOverlays (core/overlay.js).
import * as THREE from 'three';
import { clamp, easeOut, lerp } from './util.js';
import { project } from './camera.js';
import { fitText, SAFE, backdrop, ONLY } from './overlay.js';
const DISP = 'Display, sans-serif', UI = 'UI, sans-serif', TAU = Math.PI * 2;
const sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// copy of the picture drawn so far (for filters / strips); one scratch canvas reused
const snap = (ctx) => { const c = snap._c ||= Object.assign(document.createElement('canvas'), { width: 1080, height: 1920 }); const g = c.getContext('2d'); g.clearRect(0, 0, 1080, 1920); if (ONLY.on) { ONLY.flags.push({ kind: ONLY.cur, sample: 'picture' }); return c; } g.drawImage(ctx.canvas, 0, 0); return c; };   // ONLY.on (overlay-only export): there is no picture to copy, the sampled part stays empty
// ChatGPT mark (black disc, six white interlocking bars), same drawing as the old engine's gptLogo
export function gptMark(ctx, x, y, r = 52) {
  ctx.save(); ctx.translate(x, y); ctx.scale(r / 55, r / 55); ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 55, 0, TAU); ctx.fillStyle = '#111'; ctx.fill();
  ctx.scale(1.375, 1.375); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4.2; ctx.lineJoin = 'round';
  for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.translate(0, -23); ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.roundRect(-18, -8, 36, 16, 8); ctx.stroke(); ctx.restore(); }
  ctx.restore();
}

// ---------------------------------------------------------------- iris
// The picture is black (or o.color) except a soft circle. o: { at: [fx, fy] (frame fractions) | who (+ side: -1 / 0 / +1 = left eye / between / right eye as seen on screen, eyeUp: extra rise in head radii, dx, dy px: the eye line of that character), r: [[t, px], ...] radius keyframes (smoothstep between them; r <= 0 = all black; > 1400 = all open),
// soft (edge softness, 0.18 = 18 % of r), color ('#000'), breathe (px amplitude of a slow 0.45 Hz swell, 0), inner ('#fff': the disc itself is this colour instead of the picture), innerFade: [t0, t1] (the inner colour fades out and shows the picture) }
export function iris(ctx, o, t, ep, cast, camera) {
  const keys = o.r || [[o.t0, 0], [o.t1, 1500]]; let r = keys[0][1]; if (t >= keys[keys.length - 1][0]) r = keys[keys.length - 1][1]; else for (let i = 0; i < keys.length - 1; i++) { const [a, ra] = keys[i], [b, rb] = keys[i + 1]; if (t >= a && t < b) { r = lerp(ra, rb, sm((t - a) / (b - a))); break; } }
  if (o.breathe && r > 20 && r < 1400) r += o.breathe * Math.sin((t - o.t0) * 2.8);
  const col = o.color || '#000'; let cx = 540, cy = 960;
  if (o.at) { cx = o.at[0] * 1080; cy = o.at[1] * 1920; }
  else if (o.who && cast[o.who] && camera) { const c = cast[o.who], h = c.headWorld().clone().add(camera.up.clone().multiplyScalar((c.eyeUp || 0) + (o.eyeUp ?? 0) * c.R)).add(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar((o.side ?? 0) * c.R * 0.32)), p = project(camera, h, 1080, 1920); cx = p[0] + (o.dx ?? 0); cy = p[1] + (o.dy ?? 0); }
  const inner = o.inner ? 1 - (o.innerFade ? sm((t - o.innerFade[0]) / (o.innerFade[1] - o.innerFade[0])) : 0) : 0;
  if (r >= 1400 && inner <= 0) return;
  ctx.save();
  if (r <= 1) { ctx.fillStyle = col; ctx.fillRect(0, 0, 1080, 1920); ctx.restore(); return; }
  const soft = Math.max(2, r * (o.soft ?? 0.18)), g = ctx.createRadialGradient(cx, cy, Math.max(0, r - soft), cx, cy, r + soft);
  // gradient colours: transparent inside, solid outside (the colour is parsed once through a 1 px canvas so any CSS colour works)
  const rgb = (iris._p ||= {})[col] ||= (() => { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; })();
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},1)`); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  if (inner > 0) { const rr = o.inner, gi = ctx.createRadialGradient(cx, cy, Math.max(0, r - soft), cx, cy, r + soft); gi.addColorStop(0, rr); gi.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = inner; ctx.fillStyle = gi; ctx.fillRect(cx - r - soft, cy - r - soft, 2 * (r + soft), 2 * (r + soft)); }
  ctx.restore();
}

// ---------------------------------------------------------------- freeze_rewind
// Tape-rewind look over a held pose: colour drains, slow horizontal tear bands slide, a clock hand turns backwards, a big card.
// o: { text: '24 GIỜ TRƯỚC', sub, y (card centre, 1010), clockY (520), clock: true, bands (7), drain (0.85), tint ('#7aa0ff') }
export function freeze_rewind(ctx, o, t) {
  const k = easeOut((t - o.t0) / 0.35) * clamp((o.t1 - t) / 0.25); if (k <= 0) return; const u = t - o.t0;
  const src = snap(ctx);
  ctx.save(); ctx.filter = `grayscale(${(o.drain ?? 0.85) * k}) contrast(${1 + 0.08 * k}) brightness(${1 - 0.1 * k})`; ctx.drawImage(src, 0, 0); ctx.restore();
  // cold wash + scan lines (static texture, only the bands move)
  ctx.save(); ctx.globalAlpha = 0.16 * k; ctx.fillStyle = o.tint || '#7aa0ff'; ctx.fillRect(0, 0, 1080, 1920); ctx.globalAlpha = 0.07 * k; ctx.fillStyle = '#000'; for (let y = 0; y < 1920; y += 6) ctx.fillRect(0, y, 1080, 2); ctx.restore();
  // tear bands: each slides slowly downwards (a tape rewinding), shifted sideways by a slow wave, with a faint bright edge
  const N = o.bands ?? 7;
  for (let i = 0; i < N; i++) {
    const ph = ((i / N + u * (0.11 + 0.03 * hash(i)) + hash(i + 9)) % 1 + 1) % 1, y = ph * 2100 - 100, h = 26 + 70 * hash(i + 3), dx = Math.sin(u * 1.1 + i * 2.3) * (26 + 36 * hash(i + 5)) * k;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, 1080, h); ctx.clip(); ctx.filter = `grayscale(1) brightness(1.15)`; ctx.drawImage(src, dx, 0); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.22 * k; ctx.fillStyle = '#e8f0ff'; ctx.fillRect(0, y, 1080, 3); ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = k;
  // clock face, hand running backwards (the long hand a full turn in about 2.2 s, the short one 12 times slower)
  if (o.clock !== false) {
    const cy = o.clockY ?? 520, R = 190; ctx.translate(540, cy); ctx.globalAlpha = k * 0.95;
    ctx.fillStyle = 'rgba(14,16,30,0.78)'; ctx.beginPath(); ctx.arc(0, 0, R + 18, 0, TAU); ctx.fill(); ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1a1d33'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke(); ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.lineWidth = i % 3 ? 7 : 12; ctx.beginPath(); ctx.moveTo(Math.sin(a) * (R - 18), -Math.cos(a) * (R - 18)); ctx.lineTo(Math.sin(a) * (R - (i % 3 ? 34 : 44)), -Math.cos(a) * (R - (i % 3 ? 34 : 44))); ctx.stroke(); }
    const ma = -u * (TAU / 2.2), ha = ma / 12; ctx.strokeStyle = '#1a1d33'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(ha) * R * 0.5, -Math.cos(ha) * R * 0.5); ctx.stroke();
    ctx.strokeStyle = '#e0453a'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(-Math.sin(ma) * 24, Math.cos(ma) * 24); ctx.lineTo(Math.sin(ma) * R * 0.8, -Math.cos(ma) * R * 0.8); ctx.stroke();
    ctx.fillStyle = '#e0453a'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
    // curved arrow showing the direction (anticlockwise)
    ctx.strokeStyle = '#e0453a'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, R + 44, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); const ea = Math.PI * 1.15; ctx.fillStyle = '#e0453a'; ctx.beginPath(); const ex = Math.cos(ea) * (R + 44), ey = Math.sin(ea) * (R + 44); ctx.moveTo(ex + 6, ey - 34); ctx.lineTo(ex - 8, ey + 22); ctx.lineTo(ex + 36, ey + 8); ctx.closePath(); ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();
  if (o.text) { // card
    const kk = easeOut((t - o.t0 - 0.1) / 0.28) * clamp((o.t1 - t) / 0.2); if (kk > 0) {
      ctx.save(); ctx.translate(540, (o.y ?? 1010) + (1 - kk) * 30); ctx.scale(lerp(0.9, 1, kk), lerp(0.9, 1, kk)); ctx.globalAlpha = clamp(kk * 1.4); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const size = fitText(ctx, o.text, 860, 118, 900, 60), w = Math.min(960, ctx.measureText(o.text).width + 110), h = size + 96 + (o.sub ? 70 : 0);
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; ctx.fillStyle = 'rgba(12,14,32,0.93)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 36); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = o.color || '#ffc531'; ctx.lineWidth = 8; ctx.stroke();
      ctx.fillStyle = o.color || '#ffc531'; ctx.fillText(o.text, 0, o.sub ? -34 : 4); if (o.sub) { ctx.font = `800 52px ${UI}`; ctx.fillStyle = '#e8ecff'; ctx.fillText(o.sub, 0, 54); } ctx.restore(); } }
}

// ---------------------------------------------------------------- title
// Full-black card, large text. o: { text: 'TO BE CONTINUED' | [lines], sub, style: 'cont' (default: big white, yellow rule) | 'end' (quiet end card: soft cream, thin rule, no plate, no icon), y (centre 900), size, fade (0.35), color }
export function title(ctx, o, t) {
  const kin = sm((t - o.t0) / (o.fade ?? 0.35)), kout = clamp((o.t1 - t) / 0.2); if (kin <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(kin * kout); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1920);
  const end = o.style === 'end', lines = [].concat(o.text), size0 = o.size ?? (end ? 84 : 124), y = o.y ?? (end ? 930 : 900);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = end ? '6px' : '4px';
  const tx = (1 - kin) * 14 * 0; let sz = size0; for (const l of lines) sz = Math.min(sz, fitText(ctx, l, SAFE.r - SAFE.l - 20, size0, end ? 700 : 900, 44)); const lh = sz * 1.2;
  lines.forEach((l, i) => { ctx.font = `${end ? 700 : 900} ${sz}px ${DISP}`; ctx.fillStyle = o.color || (end ? '#f3e9d2' : '#ffffff'); ctx.fillText(l, 540 + tx, y + (i - (lines.length - 1) / 2) * lh); });
  const bot = y + (lines.length - 1) / 2 * lh + sz * 0.78, rw = (end ? 220 : 520) * easeOut((t - o.t0 - 0.15) / 0.5); ctx.fillStyle = end ? 'rgba(243,233,210,0.55)' : '#ffc531'; ctx.fillRect(540 - rw / 2, bot, rw, end ? 3 : 8);
  if (o.sub) { ctx.letterSpacing = '2px'; ctx.font = `700 ${o.subSize ?? 52}px ${UI}`; ctx.fillStyle = end ? 'rgba(243,233,210,0.8)' : '#ffd96b'; ctx.fillText(o.sub, 540, bot + 74); }
  ctx.restore();
}

// ---------------------------------------------------------------- white_flash
// Ramps to a solid colour and back. o: { peak (time of full white, default the middle), hold (seconds fully white, 0), color ('#fff'), max (1), up/down (ramp seconds, default fill t0..peak and peak..t1) }
export function white_flash(ctx, o, t) {
  const pk = o.peak ?? (o.t0 + o.t1) / 2, h = o.hold ?? 0, a = sm((t - o.t0) / Math.max(0.02, (pk - o.t0))), b = sm((o.t1 - t) / Math.max(0.02, (o.t1 - pk - h))), k = t < pk ? a : t < pk + h ? 1 : b;
  if (k <= 0) return; ctx.save(); ctx.globalAlpha = k * (o.max ?? 1); ctx.fillStyle = o.color || '#fff'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
}

// ---------------------------------------------------------------- cold
// Time-ramped cold dream grade (the episode's `look.grade` is one fixed grade for the whole film, so a warm-to-cold change at one moment has to be a layer).
// o: { amount (0.8 = how far: colours drain and go blue), in (ramp seconds, 0.8), out (0.4), tint ('#4f7fd0'), dark (0.18) }
export function cold(ctx, o, t) {
  const k = sm((t - o.t0) / (o.in ?? 0.8)) * sm((o.t1 - t) / (o.out ?? 0.4)) * (o.amount ?? 0.8); if (k <= 0) return;
  const src = snap(ctx); ctx.save(); ctx.filter = `saturate(${1 - 0.6 * k}) brightness(${1 - (o.dark ?? 0.18) * k}) contrast(${1 + 0.1 * k})`; ctx.drawImage(src, 0, 0); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.85 * k; ctx.fillStyle = o.tint || '#7fa4e6'; ctx.fillRect(0, 0, 1080, 1920);
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.1 * k; ctx.fillStyle = '#1a3a7a'; ctx.fillRect(0, 0, 1080, 1920);
  const v = ctx.createRadialGradient(540, 900, 380, 540, 960, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,10,40,0.5)'); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = k; ctx.fillStyle = v; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
}

// ---------------------------------------------------------------- phone-screen insets
// shared frame: a big phone seen straight on, over the dimmed picture. draw(ctx, W, H, u) paints the screen in local coords (x -W/2..W/2, y -H/2..H/2), u = seconds since it appeared.
function inset(ctx, o, t, draw, extra = {}) {
  const k = easeOut((t - o.t0) / 0.26) * clamp((o.t1 - t) / 0.16); if (k <= 0) return; const W = o.w ?? 740, H = o.h ?? 1120, cy = o.y ?? 800, u = t - o.t0;
  if (o.backdrop !== false) backdrop(ctx, { t0: o.t0, t1: o.t1, blur: 14, dim: 0.5 }, t);
  ctx.save(); ctx.globalAlpha = clamp(k * 1.5); ctx.translate(540, cy); ctx.rotate((o.tilt ?? -0.01) + (1 - k) * 0.04); ctx.scale(lerp(0.86, 1, k), lerp(0.86, 1, k));
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 22; ctx.fillStyle = '#14141c'; ctx.beginPath(); ctx.roundRect(-W / 2 - 18, -H / 2 - 18, W + 36, H + 36, 78); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 60); ctx.save(); ctx.clip(); draw(ctx, W, H, u, extra); ctx.restore();
  ctx.fillStyle = '#05050a'; ctx.beginPath(); ctx.roundRect(-70, -H / 2 + 20, 140, 38, 19); ctx.fill(); // camera pill
  ctx.restore();
}
const handset = (c, x, y, rot, col = '#fff') => { c.save(); c.translate(x, y); c.rotate(rot); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 17; c.lineCap = 'round'; c.beginPath(); c.arc(0, 18, 38, Math.PI * 1.17, Math.PI * 1.83); c.stroke(); for (const sx of [-1, 1]) { c.beginPath(); c.roundRect(sx * 36 - 17, -12, 34, 30, 9); c.fill(); } c.restore(); };
const mum = (ctx, ax, ay, s) => { ctx.save(); ctx.translate(ax, ay); ctx.scale(s / 68, s / 68); ctx.fillStyle = '#ffd7c2'; ctx.beginPath(); ctx.arc(0, 0, 68, 0, TAU); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 68, 0, TAU); ctx.clip();
  ctx.fillStyle = '#3a2a3a'; ctx.beginPath(); ctx.arc(0, -34, 52, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(0, -74, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#f6c3a8'; ctx.beginPath(); ctx.arc(0, 4, 40, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a2a3a'; ctx.beginPath(); ctx.arc(0, -12, 42, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.fillStyle = '#231a3d'; ctx.beginPath(); ctx.arc(-14, 4, 4.5, 0, TAU); ctx.arc(14, 4, 4.5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#231a3d'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 14, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#e8506a'; ctx.fillRect(-70, 46, 140, 40); ctx.restore(); ctx.restore(); };

// calling: o: { name: 'MẸ', sub: 'Đang gọi…' }  (incoming / outgoing call screen with pulsing accept ring)
export function calling(ctx, o, t) {
  inset(ctx, o, t, (c, W, H, u) => {
    const g = c.createLinearGradient(0, -H / 2, 0, H / 2); g.addColorStop(0, '#2a2650'); g.addColorStop(1, '#0f0d22'); c.fillStyle = g; c.fillRect(-W / 2, -H / 2, W, H);
    // slow rings round the avatar
    for (let i = 0; i < 3; i++) { const p = ((t * 0.55 + i / 3) % 1), rr = 150 + p * 200; c.strokeStyle = `rgba(190,180,255,${0.35 * (1 - p)})`; c.lineWidth = 6; c.beginPath(); c.arc(0, -190, rr, 0, TAU); c.stroke(); }
    mum(c, 0, -190, 150); c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, o.name || 'MẸ', W - 140, 170, 900, 80); c.fillStyle = '#fff'; c.fillText(o.name || 'MẸ', 0, 40);
    const sub = (o.sub || 'Đang gọi…').replace(/[….]+$/, ''); c.font = `700 70px ${UI}`; c.fillStyle = '#d6d0f5'; const sw = c.measureText(sub).width; c.textAlign = 'left'; c.fillText(sub, -sw / 2 - 30, 195);
    for (let i = 0; i < 3; i++) { c.globalAlpha = 0.25 + 0.75 * Math.max(0, Math.sin(t * 4.2 - i * 0.9)); c.beginPath(); c.arc(sw / 2 - 12 + i * 28, 211, 8, 0, TAU); c.fill(); } c.globalAlpha = 1;
    const by = H / 2 - 190; c.fillStyle = '#e5453f'; c.beginPath(); c.arc(-190, by, 76, 0, TAU); c.fill(); handset(c, -190, by - 8, Math.PI);
    const pu = (t * 1.6) % 1; c.strokeStyle = `rgba(61,220,132,${1 - pu})`; c.lineWidth = 7; c.beginPath(); c.arc(190, by, 76 + pu * 34, 0, TAU); c.stroke(); c.fillStyle = '#3ddc84'; c.beginPath(); c.arc(190, by, 76, 0, TAU); c.fill();
    handset(c, 190 + Math.sin(t * 5.5) * 3, by - 8, -0.35);
  });
}

// balance: red alarm screen on the device. o: { amount: '2.000đ', label: 'KHÔNG ĐỦ', balance: true (show the SỐ DƯ line) }
export function balance(ctx, o, t) {
  inset(ctx, o, t, (c, W, H, u) => {
    const pulse = 0.88 + 0.12 * Math.sin(t * 3.4), g = c.createRadialGradient(0, -80, 80, 0, 0, H * 0.7); g.addColorStop(0, `rgb(${Math.round(235 * pulse)},38,44)`); g.addColorStop(1, '#5a0710'); c.fillStyle = g; c.fillRect(-W / 2, -H / 2, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // warning disc with a cross
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -300, 120, 0, TAU); c.fill(); c.strokeStyle = '#c4121e'; c.lineWidth = 30; c.lineCap = 'round'; c.beginPath(); c.moveTo(-52, -352); c.lineTo(52, -248); c.moveTo(52, -352); c.lineTo(-52, -248); c.stroke();
    const lab = o.label || 'KHÔNG ĐỦ'; fitText(c, lab, W - 90, 150, 900, 70); c.fillStyle = '#fff'; c.fillText(lab, 0, -60);
    if (o.balance !== false) { c.fillStyle = 'rgba(0,0,0,0.38)'; c.beginPath(); c.roundRect(-W / 2 + 50, 70, W - 100, 280, 40); c.fill(); c.font = `800 62px ${UI}`; c.fillStyle = '#ffd1d1'; c.fillText('SỐ DƯ', 0, 130); fitText(c, o.amount || '2.000đ', W - 150, 160, 900, 80); c.fillStyle = '#fff'; c.fillText(o.amount || '2.000đ', 0, 255); }
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.roundRect(-W / 2 + 90, H / 2 - 150, W - 180, 80, 40); c.fill();
  });
}

// transfer: "ĐÃ CHUYỂN 1.000.000đ" success screen (generic: no real bank name or logo). o: { amount: '1.000.000đ', to: 'Chủ nợ', fake: 0..1 (1 = visibly AI-made: warped letters, melted check, a six-fingered hand), fakeAt: t (ramps fake 0 -> 1 over 0.6 s), card: true (a flat screenshot card instead of a phone) }
export function transfer(ctx, o, t) {
  const fk = o.fakeAt != null ? sm((t - o.fakeAt) / 0.6) : clamp(o.fake ?? 0);
  inset(ctx, o, t, (c, W, H, u) => {
    const g = c.createLinearGradient(0, -H / 2, 0, H / 2); g.addColorStop(0, lerpCol([236, 250, 241], [250, 244, 226], fk)); g.addColorStop(1, lerpCol([214, 240, 224], [232, 226, 242], fk)); c.fillStyle = g; c.fillRect(-W / 2, -H / 2, W, H);
    c.fillStyle = '#1f9d5b'; c.fillRect(-W / 2, -H / 2, W, 150); c.fillStyle = '#fff'; c.font = `800 50px ${UI}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CHUYỂN TIỀN', 0, -H / 2 + 92);
    // check disc (melts when fake: two offset ellipses, uneven stroke)
    c.save(); c.translate(0, -230); c.fillStyle = '#1f9d5b'; c.beginPath(); c.ellipse(0, 0, 108 + 16 * fk, 108 - 20 * fk, 0.25 * fk, 0, TAU); c.fill(); if (fk > 0) { c.globalAlpha = 0.5 * fk; c.strokeStyle = '#1f9d5b'; c.lineWidth = 8; c.beginPath(); c.ellipse(26, 14, 130, 120, -0.2, 0, TAU); c.stroke(); c.globalAlpha = 1; }
    c.strokeStyle = '#fff'; c.lineWidth = 24; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-48, 4); c.lineTo(-12, 42 + 12 * fk); c.lineTo(52 + 20 * fk, -38 - 10 * fk); c.stroke(); c.restore();
    const warp = (text, y, size, col, strength) => { // per-letter wobble: slow sine, fixed hash, never random per frame
      c.font = `900 ${size}px ${DISP}`; c.fillStyle = col; c.textAlign = 'left'; const chars = [...text]; let w = 0; const ws = chars.map((ch, i) => { const sc = 1 + strength * (hash(i + size) * 0.5 - 0.15); c.font = `900 ${size * sc}px ${DISP}`; const m = c.measureText(ch).width; w += m; return [ch, sc, m]; }); let x = -w / 2;
      ws.forEach(([ch, sc, m], i) => { c.save(); c.translate(x + m / 2, y + strength * (Math.sin(t * 1.3 + i * 1.7) * 14 + (hash(i + 4) - 0.5) * 30)); c.rotate(strength * ((hash(i + 8) - 0.5) * 0.5 + Math.sin(t * 1.1 + i) * 0.08)); c.scale(1, 1 + strength * (hash(i + 2) - 0.4) * 0.5); c.font = `900 ${size * sc}px ${DISP}`; c.textAlign = 'center'; c.fillText(ch, 0, 0); c.restore(); x += m; }); };
    c.textBaseline = 'middle'; const amt = o.amount || '1.000.000đ'; warp('ĐÃ CHUYỂN', -50, 92, '#16794a', fk);
    let sz = 150; c.font = `900 ${sz}px ${DISP}`; while (c.measureText(amt).width > W - 80 && sz > 70) { sz -= 4; c.font = `900 ${sz}px ${DISP}`; } warp(amt, 90, sz, '#0c1f16', fk);
    c.textAlign = 'center'; c.font = `700 46px ${UI}`; c.fillStyle = '#4f6b5c'; c.fillText(fk > 0.5 ? 'Đến: Ch@ nợ  ·  Lúc: 0?:1Ä' : `Đến: ${o.to || 'Chủ nợ'}  ·  Lúc: 02:14`, 0, 205); c.fillText(fk > 0.5 ? 'Mã GD: 78Q1Ø394Ʒ' : 'Mã GD: 78120394', 0, 265);
    if (fk > 0) { // the AI tell: a hand with SIX fingers rising from the bottom edge (grows in with fk)
      c.save(); c.globalAlpha = clamp(fk * 1.6); c.translate(40, lerp(H / 2 + 330, 470, fk)); c.fillStyle = '#f0c2a2'; c.strokeStyle = '#4a2c24'; c.lineWidth = 7; c.lineJoin = 'round';
      c.beginPath(); c.ellipse(0, 150, 150, 120, 0, 0, TAU); c.fill(); c.stroke();
      for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.27, L = 200 + (i === 2 || i === 3 ? 36 : 0) - (i === 5 ? 44 : 0) - (i === 0 ? 30 : 0), w = 50; c.save(); c.translate((i - 2.5) * 46, 90 - Math.abs(i - 2.5) * 12); c.rotate(a); c.beginPath(); c.roundRect(-w / 2, -L, w, L + 20, 23); c.fill(); c.stroke(); c.restore(); }
      c.restore(); }
  }, {});
}
const lerpCol = (a, b, k) => `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;

// blank: a dead phone screen with a big red X (no text). o: { x: true }
export function blank(ctx, o, t) {
  inset(ctx, o, t, (c, W, H, u) => {
    const g = c.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2); g.addColorStop(0, '#2a2c34'); g.addColorStop(1, '#14151a'); c.fillStyle = g; c.fillRect(-W / 2, -H / 2, W, H);
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.moveTo(-W / 2, -H / 2); c.lineTo(W * 0.1, -H / 2); c.lineTo(-W / 2, H * 0.12); c.closePath(); c.fill();
    const s = 1 + 0.035 * Math.sin(t * 2.6), R = 230 * s; c.save(); c.translate(0, 0); c.shadowColor = 'rgba(255,40,40,0.7)'; c.shadowBlur = 40; c.strokeStyle = '#ff2d2d'; c.lineWidth = 44; c.lineCap = 'round'; c.beginPath(); c.moveTo(-R * 0.62, -R * 0.62); c.lineTo(R * 0.62, R * 0.62); c.moveTo(R * 0.62, -R * 0.62); c.lineTo(-R * 0.62, R * 0.62); c.stroke(); c.shadowBlur = 0; c.lineWidth = 18; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke(); c.restore();
  });
}

// qr: a QR standee: card on a stand. The pattern is made up and cannot scan (wrong finder squares, no quiet zone, a hole in the middle). o: { label: 'QUÉT MÃ', y, sway (0.02 rad) }
export function qr(ctx, o, t) {
  const k = easeOut((t - o.t0) / 0.26) * clamp((o.t1 - t) / 0.16); if (k <= 0) return;
  if (o.backdrop !== false) backdrop(ctx, { t0: o.t0, t1: o.t1, blur: 14, dim: 0.5 }, t);
  const S = o.size ?? 640, N = 21, cell = (S - 100) / N;
  ctx.save(); ctx.globalAlpha = clamp(k * 1.5); ctx.translate(540, (o.y ?? 820)); ctx.rotate((o.sway ?? 0.02) * Math.sin(t * 1.5) + (1 - k) * 0.06); ctx.scale(lerp(0.86, 1, k), lerp(0.86, 1, k));
  // stand: an angled foot and a base
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20; ctx.fillStyle = '#2b2d36'; ctx.beginPath(); ctx.moveTo(-90, S * 0.52); ctx.lineTo(90, S * 0.52); ctx.lineTo(160, S * 0.52 + 120); ctx.lineTo(-160, S * 0.52 + 120); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-S / 2, -S * 0.62, S, S * 1.2, 36); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#d33a2c'; ctx.lineWidth = 12; ctx.stroke();
  ctx.fillStyle = '#d33a2c'; ctx.beginPath(); ctx.roundRect(-S / 2 + 30, -S * 0.62 + 24, S - 60, 96, 24); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitText(ctx, o.label || 'QUÉT MÃ', S - 100, 66, 900, 44); ctx.fillText(o.label || 'QUÉT MÃ', 0, -S * 0.62 + 74);
  const x0 = -S / 2 + 50, y0 = -S * 0.62 + 150; ctx.fillStyle = '#12131a';
  const inFinder = (i, j) => (i < 7 && j < 7) || (i > 13 && j < 7) || (i < 7 && j > 13);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { if (inFinder(i, j)) continue; const cx = i - 10, cy = j - 10; if (cx * cx + cy * cy < 8) continue; if (hash(i * 31 + j * 17 + 5) > 0.5) { ctx.beginPath(); ctx.roundRect(x0 + i * cell + 1, y0 + j * cell + 1, cell - 2, cell - 2, cell * 0.3); ctx.fill(); } }
  const sq = (i, j, n, ring) => { ctx.fillStyle = '#12131a'; ctx.beginPath(); ctx.roundRect(x0 + i * cell, y0 + j * cell, n * cell, n * cell, ring ? n * cell / 2 : 6); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x0 + (i + 1) * cell, y0 + (j + 1) * cell, (n - 2) * cell, (n - 2) * cell, ring ? (n - 2) * cell / 2 : 4); ctx.fill(); ctx.fillStyle = '#12131a'; ctx.beginPath(); ctx.roundRect(x0 + (i + 2) * cell, y0 + (j + 2) * cell, (n - 4) * cell, (n - 4) * cell, ring ? (n - 4) * cell / 2 : 4); ctx.fill(); };
  sq(0, 0, 7, false); sq(14, 0, 7, true); sq(0, 14, 6, true); // wrong on purpose: round finder, short finder
  ctx.restore();
}

// big message card (phone option `big: true`): sender row with the ChatGPT mark (r 64) + name at 2x, the newest message in a bubble sized to ~70 % of the card width, card height fits the content, centred on o.y (800).
export function msgcard(ctx, o, t) {
  const k = easeOut((t - o.t0) / 0.28) * clamp((o.t1 - t) / 0.18); if (k <= 0) return;
  if (o.backdrop !== false) backdrop(ctx, { t0: o.t0, t1: o.t1, blur: 14, dim: 0.5 }, t);
  const msgs = (o.msgs || []).filter((m) => t >= m.t), m = msgs[msgs.length - 1], W = o.w ?? 880, txt = m ? m.text : '', R = 64, tw = W * 0.7;
  ctx.save(); ctx.font = `900 100px ${UI}`; let sz = Math.min(150, 100 * tw / Math.max(1, ctx.measureText(txt || 'X').width)); ctx.font = `900 ${sz}px ${UI}`; const bw = Math.min(W - 80, ctx.measureText(txt).width + 90), bh = sz + 80;
  const H = 40 + R * 2 + 40 + (m ? bh : 120) + 50, cy = o.y ?? 800, pop = m ? easeOut((t - m.t) / 0.18) : 0;
  ctx.globalAlpha = clamp(k * 1.5); ctx.translate(540, cy); ctx.rotate((o.tilt ?? -0.01) + (1 - k) * 0.04); ctx.scale(lerp(0.86, 1, k), lerp(0.86, 1, k));
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 22; ctx.fillStyle = '#f3f2f8'; ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 60); ctx.fill(); ctx.shadowColor = 'transparent';
  const ty = -H / 2 + 40 + R; gptMark(ctx, -W / 2 + 60 + R, ty, R); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; fitText(ctx, o.name || 'Chíp', W - 300, 104, 900, 60, UI); ctx.fillStyle = '#16122e'; ctx.fillText(o.name || 'Chíp', -W / 2 + 60 + R * 2 + 30, ty - (o.sub ? 30 : 0));
  if (o.sub) { ctx.font = `700 44px ${UI}`; ctx.fillStyle = '#7a7690'; ctx.fillText(o.sub, -W / 2 + 60 + R * 2 + 30, ty + 66); }
  if (m) { const by = H / 2 - 50 - bh; ctx.save(); ctx.translate(-W / 2 + 40, by + bh); ctx.scale(lerp(0.8, 1, pop), lerp(0.8, 1, pop)); ctx.translate(W / 2 - 40, -(by + bh)); ctx.globalAlpha *= clamp(pop * 1.4);
    ctx.fillStyle = o.accent || '#10a37f'; ctx.beginPath(); ctx.roundRect(-bw / 2, by, bw, bh, 48); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `900 ${sz}px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(txt, 0, by + bh / 2 + 4); ctx.restore(); }
  ctx.restore();
}

// ---------------------------------------------------------------- follower counter (thank-you special, 13/11)
// A simple profile card (NOT a real app's layout or logo): avatar + name, the label NGƯỜI THEO DÕI and a big odometer that rolls between values.
//   keys: [[t, value, 'pull'?], ...]  the first key is the starting value (its t is ignored); at every later key's t the number starts rolling to `value`
//   over `roll` seconds (0.6). 'pull' = the pull-to-refresh spinner hangs down during the 0.5 s before t (pair it with the swipe of Tèo's hand: fx swipe 0 -> 1
//   over 0.6 s starting at t - 0.55). Each jump: a small flash (peak as the wheels land), a "+N" tick floating up, the wheels overshoot their stop a little and settle.
// Everything is a pure function of t: the value, the wheels, the flash, the ticks, the list scroll.
const dotNum = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ez5 = (u) => { u = clamp(u); return u * u * u * (u * (6 * u - 15) + 10); };
export function counterState(keys, t, o = {}) {
  const roll = o.roll ?? 0.6; let v = keys[0][1], flash = 0, pull = 0, spinT = 0, spinK = 0; const ticks = [], bounce = [];
  for (let i = 1; i < keys.length; i++) {
    const [tk, val, flag] = keys[i], prev = keys[i - 1][1];
    if (t >= tk) { v = prev + (val - prev) * ez5((t - tk) / roll);
      const f = t - (tk + roll * 0.55); if (f > -0.06) flash = Math.max(flash, sm((f + 0.06) / 0.06) * Math.exp(-Math.max(0, f) / 0.28));   // flash: up in 0.06 s as the wheels land, then fades
      const age = t - tk - 0.05; if (age > 0 && age < 1.35) ticks.push({ age, n: val - prev });
      if (t > tk + roll) bounce.push({ u: t - tk - roll, from: prev, to: val }); }
    if (flag === 'pull') { const s = tk - 0.5;
      if (t >= s) { pull = Math.max(pull, sm((t - s) / 0.34) * (1 - sm((t - (tk - 0.04)) / 0.2))); spinT = Math.max(spinT, t - s); spinK = Math.max(spinK, sm((t - (tk - 0.2)) / 0.1) * (1 - sm((t - (tk + roll)) / 0.3))); } }
  }
  return { v, flash: clamp(flash), pull: clamp(pull), spinT, spinK, ticks, bounce };
}
const FIRST = ['Linh', 'Minh', 'Hà', 'Trang', 'Nam', 'Phương', 'Quân', 'Thảo', 'Hùng', 'Mai', 'Đức', 'Lan', 'Tuấn', 'Hương', 'Bảo', 'Ngọc', 'Khoa', 'Vy', 'Sơn', 'Thu', 'Dũng', 'Yến', 'Long', 'Nhung', 'Huy', 'Chi', 'Việt', 'Hạnh', 'Khánh', 'Oanh', 'Thành', 'Diệp', 'Phúc', 'Trâm', 'Hải', 'Uyên', 'Tâm', 'Giang', 'Kiên', 'Loan'];
const LAST = 'ABCDĐGHKLMNPQSTUVX';
// generic avatar: pastel disc with a head-and-shoulders silhouette
function avatar(c, x, y, r, i) { const h = Math.floor(hash(i * 3.1) * 360); c.save(); c.translate(x, y); c.fillStyle = `hsl(${h},62%,${64 + 10 * hash(i)}%)`; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip(); c.fillStyle = `hsl(${h},45%,38%)`; c.beginPath(); c.arc(0, -r * 0.18, r * 0.34, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, r * 0.78, r * 0.7, r * 0.5, 0, 0, TAU); c.fill(); c.restore(); }
// the profile avatar: a tiny cartoon of Tèo (round pale face, black quiff, round red glasses)
function teoAvatar(c, x, y, r) { c.save(); c.translate(x, y); c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip(); c.fillStyle = '#efe9de'; c.beginPath(); c.arc(0, r * 0.08, r * 0.72, 0, TAU); c.fill(); c.fillStyle = '#17141f'; c.beginPath(); c.arc(0, -r * 0.08, r * 0.74, Math.PI * 1.04, Math.PI * 1.96); c.fill(); c.beginPath(); c.ellipse(r * 0.22, -r * 0.62, r * 0.3, r * 0.16, -0.3, 0, TAU); c.fill();
  c.strokeStyle = '#e0303c'; c.lineWidth = r * 0.07; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * 0.28, r * 0.1, r * 0.19, 0, TAU); c.stroke(); } c.fillStyle = '#231a3d'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * 0.28, r * 0.1, r * 0.06, 0, TAU); c.fill(); } c.strokeStyle = '#231a3d'; c.lineWidth = r * 0.06; c.lineCap = 'round'; c.beginPath(); c.arc(0, r * 0.3, r * 0.17, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); c.restore(); }
// st: { keys, roll, names: 0..1 (the list of new followers takes the lower half), name, sub, t (scroll clock, default t) }. Drawn in local coordinates, origin at the centre of the W x H screen.
export function followerScreen(c, W, H, t, st) {
  const S = counterState(st.keys, t, st), nm = clamp(st.names || 0), top = -H / 2, v = S.v;
  const g = c.createLinearGradient(0, top, 0, H / 2); g.addColorStop(0, '#223a7a'); g.addColorStop(0.55, '#14224f'); g.addColorStop(1, '#0a1030'); c.fillStyle = g; c.fillRect(-W / 2, top, W, H);
  { const k = Math.max(S.pull, S.spinK); if (k > 0.02) { const r = W * 0.04; c.save(); c.globalAlpha = clamp(k * 1.4); c.translate(0, top + H * (0.085 + 0.012 * k)); c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.arc(0, 0, r * 1.8, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = r * 0.3; c.lineCap = 'round'; const a0 = S.spinT * TAU * 1.4; c.beginPath(); c.arc(0, 0, r, a0, a0 + Math.PI * 1.45); c.stroke(); c.restore(); } }
  c.save(); c.translate(0, S.pull * H * 0.06);   // the screen is pulled down while refreshing
  // header: avatar + name
  const ar = W * lerp(0.078, 0.07, nm), ay = top + H * lerp(0.095, 0.07, nm), tx = -W / 2 + W * 0.07 + ar * 2 + W * 0.035, hk = 1 - 0.9 * Math.max(S.pull, S.spinK);
  c.save(); c.globalAlpha = hk; teoAvatar(c, -W / 2 + W * 0.07 + ar, ay, ar);
  c.textAlign = 'left'; c.textBaseline = 'middle'; fitText(c, st.name || 'TÈO & BÍP', W * 0.55, ar * 0.62, 900, 20, UI); c.fillStyle = '#fff'; c.fillText(st.name || 'TÈO & BÍP', tx, ay - ar * 0.22);
  c.font = `700 ${ar * 0.36}px ${UI}`; c.fillStyle = '#9fb4e8'; c.fillText(st.sub || 'Trà đá với AI', tx, ay + ar * 0.45); c.restore();
  // number block: label over the wheels
  const nd = Math.max(4, String(Math.round(Math.max(v, st.keys[0][1]))).length), dots = Math.floor((nd - 1) / 3), cw = Math.min(W * 0.2, (W * 0.9 - dots * W * 0.05) / nd), ch = cw * 1.5, tw = nd * cw + dots * W * 0.05;
  c.save(); c.translate(0, top + H * lerp(0.47, 0.37, nm)); const sc = lerp(1, 0.78, nm); c.scale(sc, sc); c.textAlign = 'center'; c.textBaseline = 'middle';
  const lab = 'NGƯỜI THEO DÕI'; fitText(c, lab, W * 0.86, W * 0.082, 900, 20, UI); c.fillStyle = '#c8d6ff'; c.fillText(lab, 0, -ch / 2 - W * 0.255);
  if (S.flash > 0.01) { const gl = c.createRadialGradient(0, 0, 10, 0, 0, W * 0.62); gl.addColorStop(0, `rgba(255,224,120,${0.6 * S.flash})`); gl.addColorStop(1, 'rgba(255,200,80,0)'); c.fillStyle = gl; c.fillRect(-W / 2, -W * 0.5, W, W); }
  const vp = counterState(st.keys, t + 1 / 60, st).v, vm = counterState(st.keys, t - 1 / 60, st).v;
  let x = -tw / 2;
  for (let k = nd - 1; k >= 0; k--) {
    // wheel position: units continuous; a higher wheel turns only in the last 15 % before the carry; + a damped overshoot on every wheel that changed digit
    const p10 = Math.pow(10, k), xk = v / p10, f = xk - Math.floor(xk); let s = k === 0 ? xk : Math.floor(xk) + sm((f - 0.85) / 0.15);
    for (const b of S.bounce) if (Math.floor(b.to / p10) !== Math.floor(b.from / p10)) s += 0.16 * Math.exp(-b.u / 0.11) * Math.sin(b.u * 26) * (k === 0 ? 0.6 : 1);
    const dv = Math.abs(vp - vm) / p10 * 30;   // wheel steps per frame at 60 fps: fast wheels get a vertical streak
    c.save(); c.beginPath(); c.roundRect(x, -ch / 2, cw * 0.94, ch, cw * 0.14); c.fillStyle = '#070b1d'; c.fill(); c.clip();
    const ghosts = dv > 0.25 ? [-1, -0.5, 0, 0.5, 1] : [0]; c.font = `900 ${ch * 0.66}px ${DISP}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const gk of ghosts) { c.globalAlpha = ghosts.length > 1 ? (gk === 0 ? 0.55 : 0.2) : 1; const so = s + gk * Math.min(1.2, dv * 0.5);
      for (let j = -1; j <= 2; j++) { const n = Math.floor(so) + j, d = ((n % 10) + 10) % 10; c.fillStyle = `rgb(255,${Math.round(255 - 30 * S.flash)},${Math.round(255 - 125 * S.flash)})`; c.fillText(String(d), x + cw * 0.47, (n - so) * ch + ch * 0.04); } }
    c.globalAlpha = 1; const sh = c.createLinearGradient(0, -ch / 2, 0, ch / 2); sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(0.28, 'rgba(0,0,0,0)'); sh.addColorStop(0.72, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = sh; c.fillRect(x, -ch / 2, cw, ch); c.restore();
    x += cw; if (k % 3 === 0 && k > 0) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x - cw * 0.03 + W * 0.0225, ch * 0.4, cw * 0.075, 0, TAU); c.fill(); x += W * 0.05; }
  }
  for (const tk of S.ticks) { const u = tk.age / 1.35, a = sm(u / 0.1) * (1 - sm((u - 0.5) / 0.4)), txt = '+' + dotNum(Math.abs(tk.n)); c.save(); c.globalAlpha = a; c.font = `900 ${cw * 0.62}px ${UI}`; const tw2 = c.measureText(txt).width, px = tw / 2 - tw2 / 2 - cw * 0.3, py = -ch / 2 - W * 0.075 - u * W * 0.05;
    c.fillStyle = 'rgba(20,205,165,0.96)'; c.beginPath(); c.roundRect(px - tw2 / 2 - cw * 0.22, py - cw * 0.36, tw2 + cw * 0.44, cw * 0.72, cw * 0.36); c.fill(); c.fillStyle = '#04261e'; c.textAlign = 'center'; c.fillText(txt, px, py + cw * 0.03); c.restore(); }
  c.restore();
  // lower half: a small trend chart while the number is alone, the fast list of new followers when names > 0
  if (nm < 0.99) { c.save(); c.globalAlpha = 1 - nm; const gy = top + H * 0.66, gh = H * 0.27, bars = 12, k0 = st.keys[0][1], k1 = st.keys[st.keys.length - 1][1], prog = clamp((v - k0) / Math.max(1, k1 - k0));
    { const py = top + H * 0.595, pw = W * 0.5, ph = W * 0.1, bump = S.flash * ph * 0.1; c.fillStyle = 'rgba(53,224,194,0.16)'; c.beginPath(); c.roundRect(-pw / 2, py - ph / 2, pw, ph, ph / 2); c.fill(); c.fillStyle = '#35e0c2'; c.beginPath(); c.moveTo(-pw / 2 + ph * 0.55, py - ph * 0.2 - bump); c.lineTo(-pw / 2 + ph * 0.9, py + ph * 0.18 - bump); c.lineTo(-pw / 2 + ph * 0.2, py + ph * 0.18 - bump); c.closePath(); c.fill(); c.textAlign = 'left'; c.textBaseline = 'middle'; fitText(c, 'ĐANG TĂNG', pw - ph * 1.3, ph * 0.5, 900, 14, UI); c.fillStyle = '#35e0c2'; c.fillText('ĐANG TĂNG', -pw / 2 + ph * 1.15, py + 1); }
    for (let i = 0; i < bars; i++) { const last = i === bars - 1, hh = gh * (0.1 + 0.42 * (i / bars) * (i / bars) * hash(i + 2) + 0.1 * hash(i + 7)) + (last ? gh * 0.4 * (0.25 + 0.75 * prog) : 0), bw = W * 0.062; c.fillStyle = last ? '#35e0c2' : 'rgba(150,175,255,0.4)'; c.beginPath(); c.roundRect(-W * 0.44 + i * (W * 0.88 / bars), gy + gh - hh, bw, hh, bw * 0.3); c.fill(); } c.restore(); }
  if (nm > 0.01) { const ly = top + H * 0.48, rh = W * 0.19, off = (st.t ?? t) * W * 1.7, n = Math.ceil((H / 2 - ly) / rh) + 2; c.save(); c.beginPath(); c.rect(-W / 2, ly, W, H / 2 - ly); c.clip();
    for (const gk of [-1.5, -0.75, 0, 0.75, 1.5]) { c.globalAlpha = sm(nm * 1.4) * (gk === 0 ? 0.62 : 0.15); const o2 = off + gk * rh * 0.24, base = Math.floor(o2 / rh);
      for (let j = 0; j < n; j++) { const i2 = base + j, y = ly + i2 * rh - o2, name = FIRST[Math.floor(hash(i2 * 1.9) * FIRST.length)] + ' ' + LAST[Math.floor(hash(i2 * 4.3) * LAST.length)] + '.';
        c.fillStyle = 'rgba(255,255,255,0.1)'; c.beginPath(); c.roundRect(-W * 0.45, y + rh * 0.08, W * 0.9, rh * 0.84, rh * 0.3); c.fill(); avatar(c, -W * 0.45 + rh * 0.5, y + rh * 0.5, rh * 0.32, i2); c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `800 ${rh * 0.36}px ${UI}`; c.fillText(name, -W * 0.45 + rh * 0.98, y + rh * 0.5);
        c.fillStyle = '#35e0c2'; c.beginPath(); c.roundRect(W * 0.45 - rh * 1.6, y + rh * 0.3, rh * 1.35, rh * 0.4, rh * 0.2); c.fill(); } }
    c.restore(); }
  c.restore();
}
// counter: the big close-up inset (a phone seen straight on over the dimmed picture). o: { keys, names: [[t0, t1], ...] (windows where the list of new followers takes the lower half),
// roll (0.6), name, sub, y (800), w, h, tilt, backdrop }
export function counter(ctx, o, t) {
  const nm = (o.names || []).reduce((m, [a, b]) => Math.max(m, sm((t - a) / 0.25) * sm((b - t) / 0.25)), 0);
  inset(ctx, o, t, (c, W, H) => followerScreen(c, W, H, t, { ...o, names: nm }));
}
export const ZB = { iris, freeze_rewind, title, white_flash, cold, calling, balance, transfer, blank, qr, counter };
