// Trà đá với AI, "Tèo vào GTA 6" part 3 (gta6p3, 20/11): the 2-D pieces of the sea episode, in the style of gta_hud.js (factories returning a ready `kind: 'draw'` overlay with `reads` declared from the real visible windows).
//   meter(...)       the pink hand-drawn ĐỘ MÊ heart meter: Tèo draws it with a finger, it floats above a head and FOLLOWS it through the real camera, hearts fill 0-5 (ting pop), break one by one with a crack
//                    and turn into coins, it can drift on the water and stick to another head
//   goldCard(...)    the card GÓI TÌNH YÊU VÀNG · 3.000.000đ with a QR and the red rubber stamp ĐA CẤP
//   photoFrame(...)  a traffic-camera photo: white flash, frozen picture look with the red box "BIỂN SỐ: ???" (pair it with engine `hits`)
// Everything is a pure function of t (no state, no randomness). Never additive, never reads the canvas: it goes through `pngseq --overlays-only` into the Blender composite unchanged.
import { hudText as T, hudMeasure as M, hudFit as FIT, hudPanel, C } from './gta_hud.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k, sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const backOut = (x, c = 1.7) => { x = clamp(x); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const PINK = '#ff4f9a', PINK_D = '#c2185b', PINK_L = '#ffd1e6', INK = '#3a0f2a';
const overlay = (o, fn, decl) => ({ kind: 'draw', t0: o.t0 - 0.02, t1: o.t1 + 0.02, fade: 0.01, ...decl, text: decl.reads ? decl.reads.map((r) => r.text).join(' | ') : 'gta sea', fn: (ctx, t, env) => fn(ctx, t, o, env) });

// ---- screen position of a world point / of a cast member's head top through the real camera (window.stage.camera) ----
function headPx(env, who, up = 1.25) { const c = env?.cast?.[who], cam = globalThis.stage?.camera; if (!c || !cam) return null; const h = c.headWorld(), top = h.clone().add(cam.up.clone().multiplyScalar((c.R ?? 0.17) * up)), side = h.clone().add(cam.up.clone().multiplyScalar(c.R ?? 0.17));
  const a = top.clone().project(cam), b = h.clone().project(cam), s = side.clone().project(cam); if (a.z > 1 || b.z > 1) return null; /* behind the camera: nothing */ const x = (a.x * 0.5 + 0.5) * 1080, y = (-a.y * 0.5 + 0.5) * 1920, pr = Math.abs(((-s.y * 0.5 + 0.5) - (-b.y * 0.5 + 0.5)) * 1920); return { x, y, pr: Math.max(20, pr), z: a.z }; }
function worldPx(env, p) { const cam = globalThis.stage?.camera; if (!cam) return null; const v = { x: p[0], y: p[1], z: p[2] }, q = new (cam.position.constructor)(v.x, v.y, v.z).project(cam); return { x: (q.x * 0.5 + 0.5) * 1080, y: (-q.y * 0.5 + 0.5) * 1920, pr: 60, z: q.z }; }

// ---- a hand-drawn wobbly closed outline (marker style): points of a rounded rectangle jittered by a slow, fixed noise ----
function wobbleRect(w, h, r, seed, amp = 3.2) { const pts = [], n = 64; for (let i = 0; i < n; i++) { const a = i / n * TAU, cx = Math.cos(a), cy = Math.sin(a), e = 6, px = Math.sign(cx) * Math.pow(Math.abs(cx), 2 / e), py = Math.sign(cy) * Math.pow(Math.abs(cy), 2 / e); pts.push([px * (w / 2) + amp * Math.sin(i * 1.7 + seed) * 0.8, py * (h / 2) + amp * Math.cos(i * 2.3 + seed * 1.3) * 0.8]); } return pts; }
function heartPath(ctx, s) { ctx.beginPath(); ctx.moveTo(0, s * 0.35); ctx.bezierCurveTo(-s * 0.1, s * 0.2, -s * 0.62, s * 0.1, -s * 0.55, -s * 0.28); ctx.bezierCurveTo(-s * 0.5, -s * 0.62, -s * 0.12, -s * 0.66, 0, -s * 0.34); ctx.bezierCurveTo(s * 0.12, -s * 0.66, s * 0.5, -s * 0.62, s * 0.55, -s * 0.28); ctx.bezierCurveTo(s * 0.62, s * 0.1, s * 0.1, s * 0.2, 0, s * 0.35); ctx.closePath(); }
function coin(ctx, x, y, r, rot) { ctx.save(); ctx.translate(x, y); ctx.scale(Math.abs(Math.cos(rot)) * 0.8 + 0.2, 1); ctx.fillStyle = '#ffc43a'; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill(); ctx.fillStyle = '#8a5a00'; ctx.font = `900 ${r * 1.1}px Display, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('đ', 0, r * 0.05); ctx.restore(); }

// ---------------------------------------------------------------------------------------------------------------------------------
// 1. ĐỘ MÊ
// o: { t0 (the finger starts to draw), draw: 1.1 (seconds of drawing), t1,
//      anchors: [{ t, who: 'linh' | at: [px, py] | world: [x, y, z], move: 0.7, dy, dx }]   the meter is at the first anchor from t0; it flies to each next anchor, ARRIVING at its t (starting t - move)
//      fill: [[t, n], ...]    hearts filled (0..5), eased over 0.3 s; a heart that fills pops with a ting
//      breaks: [t, t, ...]    each break removes the highest filled heart: crack, two halves fall, a coin pops up
//      empty: [[t, 1]]        the rim greys when empty (optional)  size: 1, tilt }
// ---------------------------------------------------------------------------------------------------------------------------------
export function drawMeter(ctx, t, o, env) {
  const u0 = t - o.t0; if (u0 < 0 || t > o.t1) return; const drawT = o.draw ?? 1.1, out = sm((o.t1 - t) / 0.2); const dk = clamp(u0 / drawT), prog = dk * dk * (3 - 2 * dk);
  // where: segment between anchors
  const A = o.anchors; let pos = null; const at = (a) => { if (a.who) { const h = headPx(env, a.who); if (h) return { x: h.x + (a.dx || 0), y: h.y - (a.dy ?? 118) - 0.9 * h.pr * 0, pr: h.pr }; return null; } if (a.world) { const w = worldPx(env, a.world); if (w) return { x: w.x + (a.dx || 0), y: w.y + (a.dy || 0), pr: w.pr }; return null; } return { x: a.at[0] + (a.dx || 0), y: a.at[1] + (a.dy || 0), pr: a.pr || 90 }; };
  let i = 0; while (i + 1 < A.length && A[i + 1].t <= t) i++; const cur = at(A[i]); let P = cur; if (i + 1 < A.length) { const nx = A[i + 1], mv = nx.move ?? 0.7, k = sm((t - (nx.t - mv)) / mv); if (k > 0) { const b = at(nx); if (cur && b) { const arc = Math.sin(Math.PI * k) * (nx.arc ?? 90); P = { x: lerp(cur.x, b.x, k), y: lerp(cur.y, b.y, k) - arc, pr: lerp(cur.pr, b.pr, k) }; } } }
  if (!P) return; const pr = P.pr, W0 = clamp(pr * 4.2 + 250, 330, 560) * (o.size ?? 1), s = W0 / 520, H = 150 * s * 1.0;
  let cx = clamp(P.x, W0 / 2 + 64, 1016 - W0 / 2), cy = clamp(P.y - H / 2, 190 + H / 2, 1500); const bob = 5 * Math.sin(t * 2.6), tilt = (o.tilt ?? -0.045) + 0.02 * Math.sin(t * 1.7);
  // fill state per heart: a key [tk, nk] = from tk the value rises to nk over 0.3 s
  const F = o.fill || [[0, 0]]; let n = F[0][1]; const tf = [-9, -9, -9, -9, -9];
  for (let k = 1; k < F.length; k++) { const [tk, nk] = F[k], pv = F[k - 1][1]; if (nk > pv) for (let h = 0; h < 5; h++) if (h + 1 > pv + 1e-6 && h + 1 <= nk + 1e-6) tf[h] = tk + 0.3 * ((h + 1 - pv) / (nk - pv)); if (t >= tk) n = lerp(pv, nk, sm((t - tk) / 0.3)); }
  const fillAt = (tt) => { let v = F[0][1]; for (let k = 1; k < F.length; k++) if (tt >= F[k][0] + 0.3) v = F[k][1]; else if (tt >= F[k][0]) v = lerp(F[k - 1][1], F[k][1], sm((tt - F[k][0]) / 0.3)); return v; };
  const brs = o.breaks || [], top = brs.length ? Math.round(fillAt(brs[0] - 0.01)) - 1 : -1, broken = brs.map((tb, k) => ({ idx: top - k, tb }));
  ctx.save(); ctx.globalAlpha *= out; ctx.translate(cx, cy + bob); ctx.rotate(tilt); ctx.scale(s * lerp(0.6, 1, backOut(u0 / 0.25)), s * lerp(0.6, 1, backOut(u0 / 0.25)));
  const w = 520, h = 150;
  // body: soft pink fill under the marker outline; the outline is DRAWN (revealed by length)
  const pts = wobbleRect(w, h, 40, o.seed ?? 3); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const fillK = sm((prog - 0.55) / 0.45); ctx.save(); ctx.globalAlpha *= fillK; ctx.fillStyle = 'rgba(255,214,232,0.94)'; ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.restore();
  let total = 0; for (let k = 1; k <= pts.length; k++) { const a = pts[k - 1], b = pts[k % pts.length]; total += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  ctx.save(); ctx.strokeStyle = PINK_D; ctx.lineWidth = 9; ctx.beginPath(); { let acc = 0; const want = total * clamp(prog / 0.6); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k <= pts.length; k++) { const a = pts[k - 1], b = pts[k % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc + d > want) { const q = (want - acc) / d; ctx.lineTo(lerp(a[0], b[0], q), lerp(a[1], b[1], q)); break; } ctx.lineTo(b[0], b[1]); acc += d; } } ctx.stroke(); ctx.restore();
  // a tail towards the head
  if (prog > 0.5) { ctx.save(); ctx.globalAlpha *= sm((prog - 0.5) / 0.3); ctx.fillStyle = 'rgba(255,214,232,0.94)'; ctx.strokeStyle = PINK_D; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-26, h / 2 - 4); ctx.lineTo(4, h / 2 + 34); ctx.lineTo(30, h / 2 - 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,214,232,0.98)'; ctx.fillRect(-22, h / 2 - 10, 48, 12); ctx.restore(); }
  // the label (marker lettering) and the five hearts
  const lk = sm((prog - 0.65) / 0.3); ctx.save(); ctx.globalAlpha *= lk; T(ctx, 'ĐỘ MÊ', -w / 2 + 40, -h / 2 + 42, 50, { ls: 3, fill: PINK_D, outline: 0 }); ctx.restore();
  const hs = 62, hx0 = -w / 2 + 70, gap = (w - 140) / 4;
  for (let k = 0; k < 5; k++) { const x = hx0 + k * gap, y = 24, hk = sm((prog - 0.7 - k * 0.04) / 0.22); if (hk <= 0) continue; const fil = clamp(n - k), bk = broken.find((b) => b.idx === k && t >= b.tb), uu = bk ? t - bk.tb : -1;
    ctx.save(); ctx.translate(x, y); ctx.scale(hk, hk);
    // an empty heart (outline), a filled one (solid pink with a white shine), the pop when it just filled
    const pop = tf[k] > -8 ? Math.max(0, 1 - (t - tf[k]) / 0.3) * Math.sin(clamp((t - tf[k]) / 0.3) * Math.PI) : 0; if (pop > 0) ctx.scale(1 + 0.4 * pop, 1 + 0.4 * pop);
    if (uu >= 0) {   // broken: two halves fall apart with a crack, a coin pops up
      if (uu > 0.3) { heartPath(ctx, hs); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(194,24,91,0.55)'; ctx.lineWidth = 6; ctx.setLineDash([10, 9]); ctx.stroke(); ctx.setLineDash([]); }
      const fall = uu * uu * 520, spread = clamp(uu / 0.25), fade = 1 - sm((uu - 0.6) / 0.5);
      ctx.save(); ctx.globalAlpha *= fade; for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 9 * spread, fall * 0.4 * (sd > 0 ? 1.2 : 1)); ctx.rotate(sd * (0.15 + uu * 1.3) * spread); ctx.beginPath(); ctx.rect(sd > 0 ? 0 : -80, -80, 80, 160); ctx.clip(); heartPath(ctx, hs); ctx.fillStyle = PINK; ctx.fill(); ctx.strokeStyle = PINK_D; ctx.lineWidth = 7; ctx.stroke(); ctx.restore(); } ctx.restore();
      if (uu < 0.5) { ctx.save(); ctx.globalAlpha *= 1 - sm((uu - 0.1) / 0.4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(2, -hs * 0.5); ctx.lineTo(-9, -hs * 0.2); ctx.lineTo(8, 0); ctx.lineTo(-6, hs * 0.22); ctx.lineTo(3, hs * 0.38); ctx.stroke(); ctx.restore(); }
      const cu = uu - 0.12; if (cu > 0) { const cy2 = -cu * 260 + cu * cu * 520, ca = 1 - sm((cu - 0.8) / 0.4); ctx.save(); ctx.globalAlpha *= ca; coin(ctx, 6 * Math.sin(cu * 9) + (k - 2) * 8 * cu, cy2 - 20, 17, cu * 11); ctx.restore(); }
    } else {
      heartPath(ctx, hs); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); ctx.strokeStyle = PINK_D; ctx.lineWidth = 7; ctx.stroke();
      if (fil > 0.01) { ctx.save(); heartPath(ctx, hs); ctx.clip(); ctx.fillStyle = PINK; ctx.fillRect(-hs, hs * 0.4 - fil * hs * 1.1, 2 * hs, hs * 1.2); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-hs * 0.28, -hs * 0.2, hs * 0.12, hs * 0.2, -0.5, 0, TAU); ctx.fill(); ctx.restore(); heartPath(ctx, hs); ctx.strokeStyle = PINK_D; ctx.lineWidth = 7; ctx.stroke(); }
    }
    ctx.restore(); }
  ctx.restore();
}
export const meter = (o) => overlay(o, drawMeter, { reads: [{ text: 'ĐỘ MÊ', t0: +(o.t0 + (o.draw ?? 1.1) * 0.7).toFixed(3), t1: o.t1 }] });

// ---------------------------------------------------------------------------------------------------------------------------------
// 2. goldCard: GÓI TÌNH YÊU VÀNG · 3.000.000đ + QR, then the red stamp ĐA CẤP
// o: { t0, t1, stampAt, y (centre, 1100) }
// ---------------------------------------------------------------------------------------------------------------------------------
export function drawGoldCard(ctx, t, o) {
  const u = t - o.t0, inK = backOut(u / 0.28, 1.9), out = sm((o.t1 - t) / 0.2), k = clamp(inK) * out; if (k <= 0) return; const y = o.y ?? 1110, W = 900, H = 300, x0 = 540 - W / 2;
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.4); ctx.translate(540, y); const sc = lerp(0.8, 1, clamp(inK)); ctx.scale(sc, sc); ctx.translate(-540, -y);
  hudPanel(ctx, x0, y - H / 2, W, H, { r: 28, fill: 'rgba(255,244,214,0.97)', edge: '#c88a0c', edgeW: 6, tick: '#ffc43a' });
  const g = ctx.createLinearGradient(x0, y - H / 2, x0 + W, y + H / 2); g.addColorStop(0, 'rgba(255,214,90,0.0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,214,90,0.0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0, y - H / 2, W, H, 28); ctx.fill();
  // QR (made-up pattern, cannot scan): finder squares + noise
  const qx = x0 + 36, qy = y - 112, q = 224, cell = q / 21; ctx.fillStyle = '#fff'; ctx.fillRect(qx - 8, qy - 8, q + 16, q + 16); ctx.fillStyle = '#10131c';
  for (let i = 0; i < 21; i++) for (let j = 0; j < 21; j++) { const fin = (i < 7 && j < 7) || (i > 13 && j < 7) || (i < 7 && j > 13); if (fin) continue; if (hash(i * 31 + j * 17 + 5) > 0.52) ctx.fillRect(qx + i * cell, qy + j * cell, cell + 0.5, cell + 0.5); }
  for (const [fx, fy] of [[0, 0], [14, 0], [0, 14]]) { ctx.fillStyle = '#10131c'; ctx.beginPath(); ctx.roundRect(qx + fx * cell, qy + fy * cell, 7 * cell, 7 * cell, 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(qx + (fx + 1) * cell, qy + (fy + 1) * cell, 5 * cell, 5 * cell); ctx.fillStyle = '#10131c'; ctx.beginPath(); ctx.roundRect(qx + (fx + 2) * cell, qy + (fy + 2) * cell, 3 * cell, 3 * cell, 6); ctx.fill(); }
  const tx = qx + q + 44, tw = W - (tx - x0) - 36;
  const s1 = FIT(ctx, 'GÓI TÌNH YÊU VÀNG', tw, 62, 30, { ls: 1 }); T(ctx, 'GÓI TÌNH YÊU VÀNG', tx, y - 70, s1, { ls: 1, fill: '#7a4a00', outline: 0 });
  ctx.fillStyle = '#e0a010'; ctx.fillRect(tx, y - 36, tw, 6);
  const s2 = FIT(ctx, '3.000.000đ', tw, 100, 40, { ls: 1 }); T(ctx, '3.000.000đ', tx, y + 28, s2, { ls: 1, fill: '#c2185b', outline: 0 }); T(ctx, '◆ KIM CƯƠNG ◆', tx, y + 98, 34, { ls: 3, fill: '#7a4a00', outline: 0 });
  // the stamp ĐA CẤP (red rubber, slams at stampAt)
  if (o.stampAt != null && t >= o.stampAt) { const su = t - o.stampAt, land = 0.12, kk = clamp(su / land), scl = kk < 1 ? lerp(1.9, 1, kk * kk) : 1 + 0.05 * Math.exp(-(su - land) / 0.12) * Math.sin(clamp((su - land) * 38, 0, 99)), RED = '#e0282e';
    ctx.save(); ctx.globalAlpha *= sm(su / 0.08); ctx.translate(x0 + W * 0.66, y + 6); ctx.rotate(-0.16 + (kk < 1 ? 0.12 * (1 - kk) : 0)); ctx.scale(scl, scl);
    const sz = 112, tw2 = M(ctx, 'ĐA CẤP', sz, { ls: 6 }), pw = tw2 + 70, ph = sz + 50; ctx.shadowColor = 'rgba(40,0,0,0.35)'; ctx.shadowBlur = 14; ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.beginPath(); ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 14); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = RED; ctx.lineWidth = 12; ctx.beginPath(); ctx.roundRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph - 8, 12); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-pw / 2 + 20, -ph / 2 + 20, pw - 40, ph - 40, 6); ctx.stroke();
    T(ctx, 'ĐA CẤP', 0, 5, sz, { align: 'center', ls: 6, fill: RED, outline: 0 }); ctx.restore(); }
  ctx.restore();
}
export const goldCard = (o) => overlay(o, drawGoldCard, { reads: [{ text: 'GÓI TÌNH YÊU VÀNG · 3.000.000đ', t0: +(o.t0 + 0.25).toFixed(3), t1: o.t1 }].concat(o.stampAt != null ? [{ text: 'ĐA CẤP', t0: +(o.stampAt + 0.1).toFixed(3), t1: o.t1 }] : []) });

// ---------------------------------------------------------------------------------------------------------------------------------
// 3. photoFrame: a camera snap. o: { t0 (the flash starts), hold: t at which the picture freezes (pair with engine hits: [{ t: hold, frames }]), t1, rect: [x, y, w, h] (the red "plate" box, screen px), text: 'BIỂN SỐ: ???', y (label centre) }
// ---------------------------------------------------------------------------------------------------------------------------------
export function drawPhotoFrame(ctx, t, o) {
  const u = t - o.t0, out = sm((o.t1 - t) / 0.12); if (u < 0 || out <= 0) return; const fl = Math.sin(Math.PI * clamp(u / 0.28)); ctx.save(); ctx.globalAlpha *= out;
  const ink = clamp((u - 0.12) / 0.2); if (ink > 0) {   // the photo look: vignette corners, white frame edge, a red camera bar
    ctx.save(); ctx.globalAlpha *= ink; const g = ctx.createRadialGradient(540, 900, 380, 540, 900, 1250); g.addColorStop(0, 'rgba(10,6,30,0)'); g.addColorStop(1, 'rgba(10,6,30,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 16; ctx.strokeRect(24, 160, 1032, 1100);
    ctx.fillStyle = '#e0282e'; ctx.beginPath(); ctx.roundRect(60, 190, 250, 56, 12); ctx.fill(); T(ctx, 'CAMERA 03', 76, 219, 32, { ls: 2, fill: '#fff', outline: 0 });
    const [rx, ry, rw, rh] = o.rect || [380, 760, 320, 150]; ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 8; ctx.setLineDash([22, 14]); ctx.strokeRect(rx, ry, rw, rh); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,59,59,0.16)'; ctx.fillRect(rx, ry, rw, rh);
    T(ctx, '???', rx + rw / 2, ry + rh / 2 + 4, Math.min(120, rh * 0.8), { align: 'center', ls: 8, fill: '#ff3b3b', outline: 6 });
    const y = o.y ?? 1110, sz = 76, tw = M(ctx, o.text ?? 'BIỂN SỐ: ???', sz, { ls: 3 }) + 80; hudPanel(ctx, 540 - tw / 2, y - 62, tw, 124, { r: 26, edge: '#e0282e', edgeW: 5, tick: '#e0282e' }); T(ctx, o.text ?? 'BIỂN SỐ: ???', 540, y + 4, sz, { align: 'center', ls: 3, fill: '#fff', outline: 5 });
    ctx.restore(); }
  if (fl > 0.001) { ctx.fillStyle = `rgba(255,255,255,${(0.92 * fl).toFixed(3)})`; ctx.fillRect(0, 0, 1080, 1920); }
  ctx.restore();
}
export const photoFrame = (o) => overlay(o, drawPhotoFrame, { reads: [{ text: o.text ?? 'BIỂN SỐ: ???', t0: +(o.t0 + 0.25).toFixed(3), t1: o.t1 }] });
