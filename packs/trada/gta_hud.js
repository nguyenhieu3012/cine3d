// cine3d / packs/trada/gta_hud.js  (19/11, "Tèo vào GTA 6?")  the 2-D SCREEN LAYER of the gta6 special: an open-world-game HUD and its story cards.
// OUR OWN design in the genre's common language (round minimap, money counter, wanted stars, mission line, "mission passed", fine notice): rounded dark
// panels with a thin gold edge and gold corner ticks, the engine's rounded sans (`Display`, 900), white + one warm gold + one alert red, dark outline on every text.
// It copies nothing of the real game: no typeface, no logo, no star shape / colour scheme, no mission-passed lettering, no map art.
//
// Every element is a PURE FUNCTION of (ctx, t, options): nothing is kept between frames, no randomness (only hash of coordinates), every roll / slide / shake is eased.
// Two ways to use each element:
//   1. the episode FACTORY (one call per element, times in seconds, returns a ready `{ kind: 'draw', ..., reads | noText, fn }` overlay): put it in `overlays: [...]`.
//   2. the raw draw function `drawXxx(ctx, t, o)` (same options), e.g. to call it from your own draw overlay.
// All factories take `t0` / `t1` (seconds of the film). The `reads` list is built from the REAL visible windows, so `qa.cjs` (read_time / read_long / draw_undeclared)
// judges the text honestly; nothing here is declared `noText` except where noted (decoration only).
//
// FRAME RULES (1080 x 1920): caption band y 1260-1450 stays empty; nothing below y 1536; the lower "slot" of the big texts is y 1060-1245, centred on x 500 (nothing in
// x > 950 below y 960); the persistent HUD lives in the top 300 px (minimap x 80-236, money x 572-1010, stars under it). It never uses 'lighter' (additive) and never reads
// the canvas, so it goes through `render.cjs pngseq --overlays-only` into the Blender composite unchanged (see ENGINE.md "Added 19/11, GTA HUD").
const DISP = 'Display, sans-serif', UI = 'UI, sans-serif', TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ez5 = (u) => { u = clamp(u); return u * u * u * (u * (6 * u - 15) + 10); };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const backOut = (x, c = 1.7) => { x = clamp(x); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(',')})`; };

export const C = { ink: '#0d1322', panel: 'rgba(13,19,34,0.88)', white: '#ffffff', gold: '#ffc43a', goldDeep: '#e08a0a', goldEdge: 'rgba(255,196,58,0.75)', red: '#ff4d4d', green: '#42e8a0', grey: '#d9dde6' };
// where the big texts live: between the faces (y < 1050) and the caption band (y 1260); x kept left of the platform buttons (x > 950)
export const SLOT = { cx: 500, y: 1150, maxW: 880 };

const fmt = (n) => (n < 0 ? '-' : '') + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';

// ---------------------------------------------------------------- small drawing helpers
function T(ctx, s, x, y, size, o = {}) {   // outlined text; baseline middle
  ctx.save(); ctx.font = `${o.weight ?? 900} ${size}px ${o.fam ?? DISP}`; ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.letterSpacing = (o.ls ?? 0) + 'px';
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const ow = o.outline ?? size * 0.13; if (ow > 0) { ctx.strokeStyle = o.outlineColor ?? C.ink; ctx.lineWidth = ow; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.fill ?? '#fff'; ctx.fillText(s, x, y); ctx.restore();
}
function M(ctx, s, size, o = {}) { ctx.save(); ctx.font = `${o.weight ?? 900} ${size}px ${o.fam ?? DISP}`; ctx.letterSpacing = (o.ls ?? 0) + 'px'; const w = ctx.measureText(s).width; ctx.restore(); return w; }
function fit(ctx, s, maxW, size, min = 24, o = {}) { let z = size; while (z > min && M(ctx, s, z, o) > maxW) z -= 2; return z; }
function panel(ctx, x, y, w, h, o = {}) {
  ctx.save(); const r = o.r ?? 22;
  ctx.shadowColor = 'rgba(8,10,24,0.5)'; ctx.shadowBlur = o.shadow ?? 22; ctx.shadowOffsetY = 7; ctx.fillStyle = o.fill ?? C.panel; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineWidth = o.edgeW ?? 3; ctx.strokeStyle = o.edge ?? C.goldEdge; ctx.stroke();
  if (o.ticks !== false) { ctx.strokeStyle = o.tick ?? C.gold; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - 5, y + 30); ctx.lineTo(x - 5, y - 5); ctx.lineTo(x + 30, y - 5); ctx.moveTo(x + w + 5, y + h - 30); ctx.lineTo(x + w + 5, y + h + 5); ctx.lineTo(x + w - 30, y + h + 5); ctx.stroke(); }
  ctx.restore();
}
// factory helper: a `draw` overlay that is fully on from t0 to t1 (each element does its own fades; k = 1 inside the window)
// `text` (what the element says) is only a label for the tools: qa.cjs runs its text checks (text_fit, text_occlusion, subject_visible) at a moment only when an overlay has a `text` field, so every factory sets one
const overlay = (o, fn, decl) => ({ kind: 'draw', t0: o.t0 - 0.02, t1: o.t1 + 0.02, fade: 0.01, ...decl, text: decl.reads ? decl.reads.map((r) => r.text).join(' | ') : 'gta hud', fn: (ctx, t) => fn(ctx, t, o) });

// ================================================================ 1. HUD
// keys:  money [[0, 0], [t, value, { roll: 0.8, tick: true|false }], ...]   first key = start value (its t is ignored); at t the number rolls to value over `roll` s
//        (keep keys >= roll apart). Gains get a green "+N" tick by default (tick: false to hide; tick: true on a loss gives a red one). The first value that is NEGATIVE
//        turns the digits and the edge red and gives one eased shake (eased wave, 0.7 s) when the roll lands.
//        stars [[0, 0], [t, level, stagger], ...]  level 0..starMax (starMax: 5 default, 6 for the GTA 6 episodes from gta6p2: the real game has SIX stars); going up pops star after star (stagger s apart, default 0.14); going down fades them out one by one from the last
//        (stagger default 0.14; use e.g. 0.3 for a slow fade-out).
//        dim   [[0, 0], [t, 0..1], ...]  ramps (0.5 s) the minimap + stars down to 18 % (1 = dimmed) so a card stack and the money counter are the only strong things.
//        map { scroll: [[t0, t1, speedPxPerS], ...] (the map slides under the player: use over the chase; eased in / out over 0.6 s), bank: [t0, t1] (bank icon + route shown) }
//        boot: time the HUD starts to boot in (default t0); it is complete 0.5 s later.
export function moneyV(keys, t) { let v = keys[0][1]; for (let i = 1; i < keys.length; i++) { const [tk, val, op] = keys[i]; if (t < tk) break; v = keys[i - 1][1] + (val - keys[i - 1][1]) * ez5((t - tk) / (op?.roll ?? 0.8)); } return v; }
export function moneyEvents(keys) { const ev = []; for (let i = 1; i < keys.length; i++) { const [tk, val, op] = keys[i], from = keys[i - 1][1], roll = op?.roll ?? 0.8; ev.push({ t0: tk, t1: tk + roll, from, to: val, tick: op?.tick ?? val > from }); } return ev; }
const dimAt = (keys, t) => { if (!keys) return 0; let v = keys[0][1]; for (let i = 1; i < keys.length; i++) { const [tk, val] = keys[i]; if (t < tk) break; v = keys[i - 1][1] + (val - keys[i - 1][1]) * sm((t - tk) / 0.5); } return v; };

// wanted stars: lit[i] 0..1 and age[i] seconds since star i started to light
export function starState(keys, t, n = 5) {
  const ev = Array.from({ length: n }, () => []); let prev = keys[0][1];
  for (let k = 1; k < keys.length; k++) { const [tk, lv, st] = keys[k], stag = st ?? 0.14;
    if (lv > prev) for (let i = prev; i < lv; i++) ev[i].push({ t: tk + (i - prev) * stag, to: 1, d: 0.24 });
    else if (lv < prev) for (let i = prev - 1; i >= lv; i--) ev[i].push({ t: tk + (prev - 1 - i) * stag, to: 0, d: 0.45 });
    prev = lv; }
  const lit = [], age = [];
  for (let i = 0; i < n; i++) { let base = i < keys[0][1] ? 1 : 0, v = base, a = 99;
    for (const e of ev[i]) { if (t < e.t) break; const k = clamp((t - e.t) / e.d); v = lerp(base, e.to, sm(k)); if (e.to === 1) a = t - e.t; else a = 99; if (k >= 1) base = e.to; }
    lit.push(v); age.push(a); }
  return { lit, age, level: lit.reduce((a, b) => a + b, 0) };
}
const scrollF = (x) => (x <= 0 ? 0 : x < 0.6 ? x * x / 1.2 : x - 0.3);
function scrollDist(t, segs) { let d = 0; for (const [a, b, sp] of segs) d += sp * (scrollF(t - a) - scrollF(t - b)); return d; }

function minimap(ctx, t, o, k, fade, S) {
  const mp = o.map || {}, cx = 158, cy = 230, R = 70, G = 40, dist = scrollDist(t, mp.scroll || []);
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.5) * fade; ctx.translate(cx, cy); const sc = lerp(0.6, 1, backOut(k)); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(8,10,24,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, TAU); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#1b2a45'; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.translate(0, dist);   // world: the player sits at (0, -dist); screen y = world y + dist
  const wy0 = -dist - R - G, wy1 = -dist + R + G, i0 = -3, i1 = 3, j0 = Math.floor(wy0 / G), j1 = Math.ceil(wy1 / G);
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (hash(i * 7.3 + j * 3.1) > 0.86) { ctx.fillStyle = '#1f4a45'; ctx.fillRect(i * G + 6, j * G + 6, G - 12, G - 12); }   // parks
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) for (let j = j0; j <= j1; j++) for (let i = i0; i < i1; i++) {
    const hx = (j === -1 && i === 0) || hash(i * 13.7 + j * 5.3) > 0.2, vx = i === 0 || hash(i * 3.9 + j * 11.1 + 50) > 0.2, mainH = ((j % 3) + 3) % 3 === 0, mainV = ((i % 3) + 3) % 3 === 0;
    if (hx) { ctx.strokeStyle = pass ? (mainH ? '#7488b8' : '#3d5078') : C.ink; ctx.lineWidth = (mainH ? 8 : 5) + (pass ? 0 : 3); ctx.beginPath(); ctx.moveTo(i * G, j * G); ctx.lineTo((i + 1) * G, j * G); ctx.stroke(); }
    if (vx) { ctx.strokeStyle = pass ? (mainV ? '#7488b8' : '#3d5078') : C.ink; ctx.lineWidth = (mainV ? 8 : 5) + (pass ? 0 : 3); ctx.beginPath(); ctx.moveTo(i * G, j * G); ctx.lineTo(i * G, (j + 1) * G); ctx.stroke(); } }
  // the sea to the west (drawn over the streets)
  ctx.fillStyle = '#0e5870'; ctx.beginPath(); const yA = Math.floor(wy0 / 10) * 10; ctx.moveTo(-R - 12, yA); for (let y = yA; y <= wy1 + 10; y += 10) ctx.lineTo(-52 + 12 * Math.sin(y * 0.045) + 6 * Math.sin(y * 0.11 + 1), y); ctx.lineTo(-R - 12, wy1 + 10); ctx.closePath(); ctx.fill();
  // route to the bank
  const bk = mp.bank ? sm((t - mp.bank[0]) / 0.3) * sm((mp.bank[1] - t) / 0.3) : 0;
  if (bk > 0.01) { ctx.globalAlpha *= bk; ctx.lineJoin = 'round'; for (const [w, c] of [[10, C.ink], [5, C.gold]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -G); ctx.lineTo(G, -G); ctx.stroke(); } }
  ctx.restore();
  // view cone + player arrow (heading north)
  const cone = ctx.createRadialGradient(0, 0, 4, 0, 0, 44); cone.addColorStop(0, 'rgba(255,255,255,0.34)'); cone.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 44, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.closePath(); ctx.fill();
  // police blips behind the player, one per lit star
  for (let i = 0; i < S.lit.length; i++) { const a = S.lit[i]; if (a < 0.02) continue; const bx = (i - 2) * 19 + 7 * Math.sin(t * 1.6 + i * 1.9), by = 30 + 6 * i + 5 * Math.sin(t * 2.1 + i * 1.1), ph = (t * 0.9 + i * 0.23) % 1;
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = C.red; ctx.lineWidth = 3; ctx.globalAlpha *= 0.6 * Math.sin(Math.PI * ph); ctx.beginPath(); ctx.arc(bx, by, 6 + 8 * ph, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = C.red; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, 6, 0, TAU); ctx.stroke(); ctx.fill(); ctx.restore(); }
  ctx.lineJoin = 'round'; ctx.fillStyle = C.gold; ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 11); ctx.lineTo(0, 5); ctx.lineTo(-10, 11); ctx.closePath(); ctx.stroke(); ctx.fill();
  // bank marker (clamped to the rim, radar style, when the bank is outside the circle)
  if (bk > 0.01) { let bx = G, by = -G + dist; const d = Math.hypot(bx, by), lim = R - 15, out = d > lim; if (out) { bx *= lim / d; by *= lim / d; }
    ctx.save(); ctx.globalAlpha *= bk; ctx.translate(bx, by); ctx.fillStyle = C.gold; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-12, -12, 24, 24, 6); ctx.stroke(); ctx.fill();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(8, -3); ctx.lineTo(-8, -3); ctx.closePath(); ctx.fill(); for (const x of [-5, 0, 5]) ctx.fillRect(x - 1.5, -1, 3, 8); ctx.fillRect(-8, 8, 16, 2.5); ctx.restore(); }
  // rim: ink ring, thin gold ring, a north notch
  ctx.lineWidth = 6; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.arc(0, 0, R + 2, 0, TAU); ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = C.goldEdge; ctx.beginPath(); ctx.arc(0, 0, R - 0.5, 0, TAU); ctx.stroke();
  ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(0, -R - 10); ctx.lineTo(7, -R + 2); ctx.lineTo(-7, -R + 2); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// money capsule with odometer wheels
function money(ctx, t, o, k) {
  const keys = o.money || [[0, 0]], X0 = 572, Y0 = 162, W = 438, H = 88, cy = Y0 + H / 2 + 2, right = 956, cw = 35, size = 60, ev = moneyEvents(keys);
  const v = moneyV(keys, t), a = Math.abs(v), redK = sm(-v / 2e6);
  // shake: one eased wave when a roll that ends NEGATIVE lands (0.7 s, decays)
  let shx = 0, glow = 0; for (const e of ev) if (e.to < 0 && t >= e.t1) { const u = t - e.t1; shx += 10 * Math.exp(-u / 0.28) * Math.sin(u * TAU * 6.5); glow = Math.max(glow, sm(u / 0.08) * Math.exp(-u / 0.7)); }
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.5); ctx.translate(lerp(70, 0, easeOut(k)) + shx, 0);
  if (glow > 0.01) { ctx.save(); ctx.globalAlpha *= 0.55 * glow; ctx.fillStyle = C.red; ctx.shadowColor = C.red; ctx.shadowBlur = 36; ctx.beginPath(); ctx.roundRect(X0 - 4, Y0 - 4, W + 8, H + 8, 26); ctx.fill(); ctx.restore(); }
  panel(ctx, X0, Y0, W, H, { edge: mix('#ffc43a', '#ff4d4d', redK), tick: mix('#ffc43a', '#ff4d4d', redK), edgeW: 3 + 2 * redK });
  ctx.save(); ctx.beginPath(); ctx.roundRect(X0 + 4, Y0 + 4, W - 8, H - 8, 20); ctx.clip();   // the rolling digits never leave the capsule
  const col = mix('#ffffff', '#ff5a5a', redK), h = 1 / 120;
  T(ctx, 'đ', 988, cy + 2, 44, { align: 'right', fill: mix('#ffc43a', '#ff5a5a', redK), outline: 5 });
  const aP = Math.abs(moneyV(keys, t + h)), aM = Math.abs(moneyV(keys, t - h));
  const cT = o.exactCarry ? 0.985 : 0.85;   // exactCarry (20/11): a wheel only starts to roll in the last 1.5 % before its carry (an odometer showed -19.660.000 for -9.660.000 with the old 15 %)
  const pos = (aa, kk) => { const p = Math.pow(10, kk), xk = aa / p, f = xk - Math.floor(xk); return kk === 0 ? xk : Math.floor(xk) + sm((f - cT) / (1 - cT)); };
  for (let kk = 0; kk < 8; kk++) {
    const p = Math.pow(10, kk), xc = right - cw / 2 - kk * cw - Math.floor(kk / 3) * 20, al = kk === 0 ? 1 : o.exactCarry ? (Math.floor(a / p) > 0 ? 1 : sm((a / p - cT) / (1 - cT))) : sm((a / p - 0.55) / 0.3); if (al < 0.02) continue;   // exactCarry: no leading 0 (9.660.000 has no 10^7 wheel)
    let s = pos(a, kk); for (const e of ev) if (t >= e.t1 && Math.floor(e.to / p) !== Math.floor(e.from / p) && Math.floor(Math.abs(e.to) / p) !== Math.floor(Math.abs(e.from) / p)) { const u = t - e.t1; s += Math.sign(Math.abs(e.to) - Math.abs(e.from)) * 0.14 * Math.exp(-u / 0.11) * Math.sin(u * 26); }
    const spread = Math.min(Math.abs(pos(aP, kk) - pos(aM, kk)) / (2 * h) / 60, 5), ns = spread > 0.12 ? Math.min(9, 3 + 2 * Math.floor(spread * 4)) : 1;
    for (let g = 0; g < ns; g++) { const sg = s + (ns === 1 ? 0 : (g / (ns - 1) - 0.5) * spread), ga = ns === 1 ? 1 : Math.min(1, 1.6 / ns), base = Math.floor(sg);
      for (let j = -1; j <= 2; j++) { const n = base + j, d = ((n % 10) + 10) % 10, dy = n - sg, ia = clamp(1 - Math.abs(dy) * 1.15) * al * ga; if (ia < 0.02) continue;
        ctx.save(); ctx.globalAlpha *= ia; T(ctx, String(d), xc, cy + dy * size * 0.9, size, { align: 'center', fill: col, outline: 6 }); ctx.restore(); } }
    if (kk % 3 === 2 && kk < 7) { const nal = sm((a / Math.pow(10, kk + 1) - 0.55) / 0.3); if (nal > 0.02) { ctx.save(); ctx.globalAlpha *= nal; ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(xc - cw / 2 - 10, cy + size * 0.3, 5, 0, TAU); ctx.stroke(); ctx.fill(); ctx.restore(); } } }
  const sa = sm(-v / 1.5e6); if (sa > 0.02) { ctx.save(); ctx.globalAlpha *= sa; ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(right - 8 * cw - 40 - 30, cy - 1, 24, 9, 4); ctx.stroke(); ctx.fill(); ctx.restore(); }
  ctx.restore(); ctx.restore();
  // "+N" tick next to the capsule (green for a gain, red for a loss), 2.4 s, rises a little
  for (const e of ev) { if (!e.tick) continue; const s0 = e.t0 + 0.1, e0 = e.t0 + 2.5, al = sm((t - s0) / 0.15) * sm((e0 - t) / 0.2); if (al < 0.01) continue; const d = e.to - e.from, txt = (d > 0 ? '+' : '-') + fmt(Math.abs(d)), sz = 34, w = M(ctx, txt, sz) + 40, x1 = X0 - 24, y = Y0 + H / 2 - 12 * easeOut((t - s0) / 0.6);
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(-(1 - easeOut((t - s0) / 0.25)) * 24, 0); panel(ctx, x1 - w, y - 31, w, 62, { r: 31, fill: d > 0 ? C.green : C.red, edge: C.ink, edgeW: 3, ticks: false, shadow: 14 });
    T(ctx, txt, x1 - w / 2, y + 2, sz, { align: 'center', fill: C.ink, outline: 0 }); ctx.restore(); }
}

// ---- starFocus (20/11, option, OFF by default): o.starFocus = [[t0, t1], ...]. In a window the wanted row (and the loading star / new stars) scales up to 1.6x about its top-right corner (1010, 256), a pulsing gold halo
// sits behind it, minimap + money dim a little, a new star's ring is bigger. In / out 0.2 s. A pure function of t.
const FOC = 0.6, focusAt = (o, t) => { let f = 0; for (const w of o.starFocus || []) f = Math.max(f, sm((t - w[0]) / 0.2) * sm((w[1] - t) / 0.2)); return f; };
const focT = (ctx, f, dy = 0) => { if (f <= 0) return; const k = 1 + FOC * f; ctx.translate(1010, 256 + dy * f); ctx.scale(k, k); ctx.translate(-1010, -256); };
function focusGlow(ctx, t, o, f) {
  if (f <= 0.01) return; const n = o.starMax ?? 5, W = 68 + (n - 1) * 50, k = 1 + FOC * f, cx = 1010 - W * k / 2, cy = 256 + 22 * k, a = f * (0.5 + 0.22 * Math.sin(t * 8));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.3); const g = ctx.createRadialGradient(0, 0, 10, 0, 0, W * k * 0.85); g.addColorStop(0, `rgba(255,205,70,${(0.85 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(255,205,70,0)'); ctx.fillStyle = g; ctx.fillRect(-W * k, -W * k, 2 * W * k, 2 * W * k); ctx.restore(); }
const starPath = (ctx, R) => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.52 : R; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
function stars(ctx, t, o, k, fade, S) {
  const n = o.starMax ?? 5, W = 68 + (n - 1) * 50, X0 = 1010 - W, Y0 = 256, H = 44, cy = Y0 + H / 2, R = 19;   // starMax (20/11): 6 = the row grows to the LEFT (x 692-1010); default 5 keeps x 742-1010
  ctx.save(); focT(ctx, o._f || 0); ctx.globalAlpha *= clamp(k * 1.5) * fade; ctx.translate(lerp(70, 0, easeOut(k)), 0);
  const pulse = sm((S.level - 3.2) / 1.5) * (0.5 + 0.5 * Math.sin(t * 4.2));   // 4-5 stars: a slow red alert pulse under the row
  panel(ctx, X0, Y0, W, H, { r: 22, fill: 'rgba(13,19,34,0.62)', edge: mix('#ffc43a', '#ff4d4d', pulse * 0.8), edgeW: 2.5, ticks: false, shadow: 12 });
  if (pulse > 0.02) { ctx.save(); ctx.globalAlpha *= 0.3 * pulse; ctx.fillStyle = C.red; ctx.beginPath(); ctx.roundRect(X0, Y0, W, H, 22); ctx.fill(); ctx.restore(); }
  for (let i = 0; i < n; i++) { const x = X0 + 34 + i * 50, lit = S.lit[i], pop = S.age[i] < 0.4 ? backOut(S.age[i] / 0.3, 2.4) : 1, sc = lit > 0.01 ? lerp(0.6, 1, Math.min(1, lit)) * (S.age[i] < 0.4 ? lerp(0.55, 1, pop) : 1) : 1;
    ctx.save(); ctx.translate(x, cy + 1); ctx.scale(sc, sc); ctx.lineJoin = 'round';
    starPath(ctx, R); ctx.fillStyle = 'rgba(13,19,34,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 3; ctx.stroke();
    if (lit > 0.01) { ctx.globalAlpha *= clamp(lit * 1.3); starPath(ctx, R + 2); ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.stroke(); const g = ctx.createLinearGradient(0, -R, 0, R); g.addColorStop(0, '#ffe38a'); g.addColorStop(1, C.goldDeep); starPath(ctx, R); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.stroke();
      if (S.age[i] < 0.45) { ctx.globalAlpha = (1 - S.age[i] / 0.45) * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 + 3 * (o._f || 0); starPath(ctx, R + (20 + 30 * (o._f || 0)) * easeOut(S.age[i] / 0.45)); ctx.stroke(); } }
    ctx.restore(); }
  ctx.restore();
}

// ---------------------------------------------------------------- loading star (20/11, gta6p2): o.loadStar = { t0, t1, label: 'MẸ ĐÃ XEM', idx: 0, until }
// One hollow star of the wanted row FILLS like a loading bar from the bottom (t0..t1, a bright edge climbs with it), pops when full (a ring, a gold flash) and a label capsule drops under the row
// (x 742-1010, y 308-362) that stays until `until` (default the HUD's end). The label is a message: 1.0 + n / 12 s (MẸ ĐÃ XEM = 9 characters = 1.75 s). Off unless the HUD gets `loadStar`.
function loadStar(ctx, t, o, k, fade) {
  const L = o.loadStar, nS = o.starMax ?? 5, X0 = 1010 - (68 + (nS - 1) * 50), Y0 = 256, H = 44, R = 19, i = L.idx ?? 0, x = X0 + 34 + i * 50, cy = Y0 + H / 2 + 1, p = clamp((t - L.t0) / Math.max(1e-3, L.t1 - L.t0)), end = L.until ?? o.t1; if (t < L.t0 - 0.2 || k <= 0) return;
  const done = t >= L.t1, age = t - L.t1, pop = done ? backOut(age / 0.3, 2.4) : 1;
  ctx.save(); focT(ctx, o._f || 0); ctx.globalAlpha *= clamp(k * 1.5) * fade; ctx.translate(x + lerp(70, 0, easeOut(k)) * 0, cy); ctx.scale(lerp(1, 1.18, done ? Math.min(1, pop) : 0) * (done && age < 0.3 ? 1 + 0.2 * Math.sin(Math.PI * age / 0.3) : 1), lerp(1, 1.18, done ? Math.min(1, pop) : 0) * (done && age < 0.3 ? 1 + 0.2 * Math.sin(Math.PI * age / 0.3) : 1)); ctx.lineJoin = 'round';
  starPath(ctx, R + 2); ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.stroke();
  ctx.save(); starPath(ctx, R); ctx.clip(); const fy = (R + 2) - (2 * R + 4) * p; ctx.fillStyle = 'rgba(13,19,34,0.55)'; ctx.fillRect(-R - 2, -R - 2, 2 * R + 4, 2 * R + 4);
  const g = ctx.createLinearGradient(0, -R, 0, R); g.addColorStop(0, '#ffe38a'); g.addColorStop(1, C.goldDeep); ctx.fillStyle = g; ctx.fillRect(-R - 2, fy, 2 * R + 4, (R + 2) - fy); if (p > 0 && p < 1) { ctx.fillStyle = '#fff'; ctx.fillRect(-R - 2, fy - 1.5, 2 * R + 4, 3); } ctx.restore();
  starPath(ctx, R); ctx.strokeStyle = done ? C.gold : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.stroke();
  if (done && age < 0.5) { ctx.globalAlpha *= (1 - age / 0.5) * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; starPath(ctx, R + (24 + 34 * (o._f || 0)) * easeOut(age / 0.5)); ctx.stroke(); }
  ctx.restore();
  if (done && t < end + 0.001) { const lab = L.label ?? 'MẸ ĐÃ XEM', tk = backOut((t - L.t1 - 0.05) / 0.25, 2.0), outk = sm((end - t) / 0.2), sz = fit(ctx, lab, 268 - 110, 34, 20, { ls: 2 }), w = Math.min(268, M(ctx, lab, sz, { ls: 2 }) + 110), x1 = 1010, y = 308 + 27;
    ctx.save(); ctx.translate(0, 30 * (o._f || 0)); ctx.globalAlpha *= clamp(tk * 1.5) * outk; ctx.translate(x1 - w / 2, y); ctx.scale(lerp(0.7, 1, clamp(tk)), lerp(0.7, 1, clamp(tk))); panel(ctx, -w / 2, -27, w, 54, { r: 16, edge: C.gold, edgeW: 3, ticks: false, shadow: 14 });
    ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.lineCap = 'round'; const ex = -w / 2 + 36; ctx.beginPath(); ctx.moveTo(ex - 18, 1); ctx.quadraticCurveTo(ex, -15, ex + 18, 1); ctx.quadraticCurveTo(ex, 17, ex - 18, 1); ctx.stroke(); ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(ex, 1, 5.5, 0, TAU); ctx.fill();   // an eye = "seen"
    T(ctx, lab, -w / 2 + 68, 2, sz, { ls: 2, fill: '#fff', outline: 4 }); ctx.restore(); }
  // o.loadStar.then = 2: that many more stars pop on (from `thenAt`, default right after the loaded one; 0.16 s apart), the same lit star as the wanted row
  for (let j = 1; j <= (L.then || 0) && i + j < nS; j++) { const ag = t - ((L.thenAt ?? L.t1 + 0.14) + (j - 1) * 0.16); if (ag < 0 || k <= 0) continue; ctx.save(); focT(ctx, o._f || 0); ctx.globalAlpha *= clamp(k * 1.5) * fade; ctx.translate(X0 + 34 + (i + j) * 50, cy); const pp = ag < 0.4 ? lerp(0.55, 1, backOut(ag / 0.3, 2.4)) : 1; ctx.scale(pp, pp); ctx.lineJoin = 'round';
    starPath(ctx, R + 2); ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.stroke(); const g2 = ctx.createLinearGradient(0, -R, 0, R); g2.addColorStop(0, '#ffe38a'); g2.addColorStop(1, C.goldDeep); starPath(ctx, R); ctx.fillStyle = g2; ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.stroke();
    if (ag < 0.45) { ctx.globalAlpha *= (1 - ag / 0.45) * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 + 3 * (o._f || 0); starPath(ctx, R + (20 + 30 * (o._f || 0)) * easeOut(ag / 0.45)); ctx.stroke(); } ctx.restore(); }
}

export function drawHud(ctx, t, o) {
  const b0 = o.boot ?? o.t0, kb = clamp((t - b0) / 0.5), out = clamp((o.t1 - t) / 0.25); if (kb <= 0 || out <= 0) return;
  const f = focusAt(o, t); if (f > 0) o = Object.assign({}, o, { _f: f });
  const fade = 1 - 0.82 * dimAt(o.dim, t), S = starState(o.stars || [[0, 0]], t, o.starMax ?? 5);
  ctx.save(); ctx.globalAlpha *= out;
  minimap(ctx, t, o, sm(kb / 0.7), fade * (1 - 0.6 * f), S); ctx.save(); ctx.globalAlpha *= 1 - 0.35 * f; money(ctx, t, o, sm((kb - 0.15) / 0.6)); ctx.restore(); focusGlow(ctx, t, o, f); stars(ctx, t, o, sm((kb - 0.35) / 0.65), fade, S); if (o.loadStar) loadStar(ctx, t, o, sm((kb - 0.35) / 0.65), fade);
  ctx.restore();
}
// reads: every money value that stays at least 1.0 s (a value that is only passed through while rolling is not a message), every tick, from the keys
export function hudReads(o) {
  const keys = o.money || [[0, 0]], ev = moneyEvents(keys), out = []; let from = (o.boot ?? o.t0) + 0.5, val = keys[0][1];
  for (const e of ev) { if (e.t0 - from >= 1.0) out.push({ text: fmt(val), t0: +from.toFixed(3), t1: +e.t0.toFixed(3) }); from = e.t1; val = e.to; if (e.tick) out.push({ text: (e.to > e.from ? '+' : '-') + fmt(Math.abs(e.to - e.from)), t0: +(e.t0 + 0.2).toFixed(3), t1: +(e.t0 + 2.4).toFixed(3) }); }
  if (o.t1 - from >= 1.0) out.push({ text: fmt(val), t0: +from.toFixed(3), t1: o.t1 });
  if (o.loadStar) out.push({ text: o.loadStar.label ?? 'MẸ ĐÃ XEM', t0: +(o.loadStar.t1 + 0.15).toFixed(3), t1: o.loadStar.until ?? o.t1 });
  return out;
}
export const hud = (o) => overlay(o, drawHud, { reads: hudReads(o) });

// ================================================================ 2. hookPlate (frame 0 .. gone during p2)
// o: { t0 (<= 0: on from frame 0), t1, y (title centre, 300), title: 'TÈO VÀO GTA 6?', accent: 'GTA 6?' (gold part), sub: 'bản Việt hoá' }
export function drawHookPlate(ctx, t, o) {
  const y = o.y ?? 300, title = o.title ?? 'TÈO VÀO GTA 6?', accent = o.accent ?? 'GTA 6?', sub = o.sub ?? 'bản Việt hoá', out = sm((o.t1 - t) / 0.3), inK = o.t0 <= 0 ? 1 : sm((t - o.t0) / 0.2), k = out * inK; if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= k; ctx.translate(540, y - (1 - out) * 26);
  const size = fit(ctx, title, 900, 112, 60), w = M(ctx, title, size, { ls: 2 }), x0 = -w / 2, pre = title.slice(0, title.length - accent.length), pw = M(ctx, pre, size, { ls: 2 });
  const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 540); g.addColorStop(0, 'rgba(13,19,34,0.42)'); g.addColorStop(1, 'rgba(13,19,34,0)'); ctx.save(); ctx.translate(0, 44); ctx.scale(1, 0.4); ctx.fillStyle = g; ctx.fillRect(-560, -560, 1120, 1120); ctx.restore();   // soft dark pool behind the title (no hard edge)
  ctx.save(); ctx.shadowColor = 'rgba(8,10,24,0.55)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; T(ctx, title, x0, 0, size, { ls: 2, outline: size * 0.17, fill: 'rgba(0,0,0,0)' }); ctx.restore();
  T(ctx, pre, x0, 0, size, { ls: 2, outline: 0, fill: '#fff' }); T(ctx, accent, x0 + pw, 0, size, { ls: 2, outline: 0, fill: C.gold });
  const ss = 48, sw = M(ctx, sub, ss, { ls: 1 }) + 64, sh = ss + 28; ctx.save(); ctx.translate(0, 88); ctx.rotate(-0.035);
  panel(ctx, -sw / 2, -sh / 2, sw, sh, { r: 18, fill: C.gold, edge: C.ink, edgeW: 4, ticks: false, shadow: 16 }); T(ctx, sub, 0, 2, ss, { align: 'center', ls: 1, fill: C.ink, outline: 0 }); ctx.restore();
  ctx.restore();
}
export const hookPlate = (o) => overlay({ ...o, t0: o.t0 ?? 0 }, drawHookPlate, { reads: [{ text: (o.title ?? 'TÈO VÀO GTA 6?') + ' ' + (o.sub ?? 'bản Việt hoá'), t0: Math.max(0, o.t0 ?? 0), t1: o.t1 }] });

// ================================================================ 3 + 7. missionLine / endCard (typed on, then held)
// o: { t0, t1, label: 'NHIỆM VỤ:', text: 'CƯỚP NGÂN HÀNG', type: 0.6 (typing seconds, eased), icon: 'target' | 'plus', y (slot centre, 1150) }
// Holds until t1 (a text of n characters needs 1.0 + n/12 s: 'NHIỆM VỤ: CƯỚP NGÂN HÀNG' = 24 characters = 3.0 s).
export function drawMissionLine(ctx, t, o) {
  const label = o.label ?? 'NHIỆM VỤ:', main = o.text ?? 'CƯỚP NGÂN HÀNG', y = o.y ?? SLOT.y, hasL = label !== '', ty = o.type ?? 0.6, inK = backOut((t - o.t0) / 0.2), out = sm((o.t1 - t) / 0.18), k = clamp(inK) * out; if (k <= 0) return;
  const IC = 92, PAD = 36, maxMain = SLOT.maxW - IC - PAD * 2, size = fit(ctx, main, maxMain, hasL ? 78 : 84, 40), mw = M(ctx, main, size, { ls: 1 }), lw = hasL ? M(ctx, label, 34, { ls: 4 }) : 0;
  const w = Math.min(SLOT.maxW, IC + PAD * 2 + Math.max(mw, lw)), h = hasL ? 176 : 112, x = SLOT.cx - w / 2, yy = y - h / 2;
  const n = label.length + (hasL ? 1 : 0) + main.length, c = n * sm((t - o.t0 - 0.12) / ty);
  ctx.save(); ctx.globalAlpha *= k; ctx.translate(SLOT.cx, y); ctx.scale(lerp(0.94, 1, clamp(inK)), lerp(0.94, 1, clamp(inK))); ctx.translate(-SLOT.cx, -y);
  panel(ctx, x, yy, w, h);
  // icon block: gold disc with a target (mission) or a plus (follow)
  const ix = x + 14 + IC / 2 - 4, iy = y; ctx.fillStyle = C.gold; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ix, iy, 33, 0, TAU); ctx.stroke(); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 5; ctx.lineCap = 'round';
  if ((o.icon ?? 'target') === 'target') { ctx.beginPath(); ctx.arc(ix, iy, 17, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(ix, iy, 6, 0, TAU); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(ix - 15, iy); ctx.lineTo(ix + 15, iy); ctx.moveTo(ix, iy - 15); ctx.lineTo(ix, iy + 15); ctx.stroke(); }
  const tx = x + IC + PAD - 10, typed = (s, cnt, X, Y, sz, fill, ls) => { const whole = Math.floor(cnt), fr = cnt - whole; if (whole > 0) T(ctx, s.slice(0, Math.min(whole, s.length)), X, Y, sz, { ls, fill }); if (whole < s.length && fr > 0.02) T(ctx, s[whole], X + M(ctx, s.slice(0, whole), sz, { ls }), Y, sz, { ls, fill, alpha: fr }); return X + M(ctx, s.slice(0, Math.min(Math.ceil(cnt), s.length)), sz, { ls }); };
  let cx2 = tx;
  if (hasL) { cx2 = typed(label, Math.min(c, label.length), tx, y - 62, 34, C.gold, 4); cx2 = typed(main, clamp(c - label.length - 1, 0, main.length), tx, y + 30, size, '#fff', 1) }
  else cx2 = typed(main, Math.min(c, main.length), tx, y, size, '#fff', 1);
  const cur = sm((n - c) / 2 + 0.0) * (0.55 + 0.45 * Math.sin(t * 9)), cyy = hasL ? (c <= label.length ? y - 62 : y + 30) : y; if (c < n) { ctx.fillStyle = C.gold; ctx.globalAlpha *= clamp(cur); ctx.fillRect(cx2 + 6, cyy - size * 0.38, 6, size * 0.76); }
  ctx.restore();
}
export const missionLine = (o) => overlay(o, drawMissionLine, { reads: [{ text: (o.label ?? 'NHIỆM VỤ:') + ' ' + (o.text ?? 'CƯỚP NGÂN HÀNG'), t0: +(o.t0 + 0.1).toFixed(3), t1: o.t1 }] });
// the last card of the film (p25): ONE word in the mission-line style. o: { t0, t1, text: 'THEO DÕI', type: 0.4, y }
export const drawEndCard = (ctx, t, o) => drawMissionLine(ctx, t, { label: '', text: 'THEO DÕI', type: 0.4, icon: 'plus', ...o });
export const endCard = (o) => overlay(o, drawEndCard, { reads: [{ text: o.text ?? 'THEO DÕI', t0: +(o.t0 + 0.05).toFixed(3), t1: o.t1 }] });

// ================================================================ 4. passedBanner
// gold text with a soft sweep of light. o: { t0, t1 (about 1.4 s is the look; the reading rule wants 1.0 + 19/12 = 2.6 s for this text), text: 'NHIỆM VỤ HOÀN THÀNH', y }
export function drawPassedBanner(ctx, t, o) {
  const text = o.text ?? 'NHIỆM VỤ HOÀN THÀNH', y = o.y ?? SLOT.y, inK = backOut((t - o.t0) / 0.26), out = sm((o.t1 - t) / 0.3), k = clamp(inK) * out; if (k <= 0) return;
  const size = fit(ctx, text, 810, 86, 44), w = M(ctx, text, size, { ls: 2 }), cx = SLOT.cx;
  ctx.save(); ctx.globalAlpha *= k; ctx.translate(cx, y); ctx.scale(lerp(1.1, 1, clamp(inK)), lerp(1.1, 1, clamp(inK)));
  const bg = ctx.createLinearGradient(-450, 0, 450, 0); bg.addColorStop(0, 'rgba(13,19,34,0)'); bg.addColorStop(0.18, 'rgba(13,19,34,0.78)'); bg.addColorStop(0.82, 'rgba(13,19,34,0.78)'); bg.addColorStop(1, 'rgba(13,19,34,0)'); ctx.fillStyle = bg; ctx.fillRect(-450, -70, 900, 140);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-w / 2 - 30, s * 66); ctx.lineTo(w / 2 + 30, s * 66); ctx.stroke(); ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(0, s * 66 - 9); ctx.lineTo(9, s * 66); ctx.lineTo(0, s * 66 + 9); ctx.lineTo(-9, s * 66); ctx.closePath(); ctx.fill(); }
  ctx.save(); ctx.shadowColor = 'rgba(8,10,24,0.6)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; T(ctx, text, 0, 2, size, { align: 'center', ls: 2, outline: size * 0.17, fill: 'rgba(0,0,0,0)' }); ctx.restore();
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#fff0b0'); g.addColorStop(0.5, C.gold); g.addColorStop(1, C.goldDeep); T(ctx, text, 0, 2, size, { align: 'center', ls: 2, outline: 0, fill: g });
  // sweep of light: a slanted soft band crossing the plate once (over 0.9 s), brightening the letters it passes
  const sw = (o.t0 + 0.3 <= t) ? (t - o.t0 - 0.3) / 0.9 : -1; if (sw >= 0 && sw <= 1) { const bx = lerp(-w / 2 - 120, w / 2 + 120, ez5(sw)); ctx.save(); ctx.beginPath(); ctx.moveTo(bx - 40, -70); ctx.lineTo(bx + 40, -70); ctx.lineTo(bx + 4, 70); ctx.lineTo(bx - 76, 70); ctx.closePath(); ctx.clip();
    const sg = ctx.createLinearGradient(bx - 60, 0, bx + 40, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.4)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(-450, -70, 900, 140); T(ctx, text, 0, 2, size, { align: 'center', ls: 2, outline: 0, fill: '#fffbe6' }); ctx.restore(); }
  ctx.restore();
}
export const passedBanner = (o) => overlay(o, drawPassedBanner, { reads: [{ text: o.text ?? 'NHIỆM VỤ HOÀN THÀNH', t0: +(o.t0 + 0.15).toFixed(3), t1: o.t1 }] });

// ================================================================ 5. camPhoto (red-light camera)
// o: { t0, t1, cam: 1|2|3, rect: [x, y, w, h] (the number plate on screen, px), stamp: '21:07:44', flash: 0.25 }
// HOW THE PICTURE IS HELD (engine, core/player.js): `hits: [{ t, frames }]` freezes the 3-D picture AND every overlay at t = hit.t. So the hit must start when the photo look is
// COMPLETE, at t0 + 0.25 (flash gone, border / brackets / box / label drawn), and last the rest of the photo: hits: [{ t: t0 + 0.25, frames: 15 }] at 30 fps (0.5 s;
// frames count in the episode's fps, 30 frames at 60). During the freeze the 2-D layer is the finished photo look. Put a shot CUT at the end of the freeze (t0 + 0.75): after
// a hit-stop the picture jumps forward by the frozen time. The flash happens on the live picture: it covers the moment the picture stops.
// Texts (CAM 01, the time) are decoration, not a message: declared noText (the plate itself is read in the 3-D picture).
export function drawCamPhoto(ctx, t, o) {
  const tau = t - o.t0, fl = o.flash ?? 0.25, out = clamp((o.t1 - t) / 0.12); if (tau < 0 || out <= 0) return;
  const kB = sm((tau - 0.04) / 0.12) * out, kBox = easeOut((tau - 0.08) / 0.14), kL = sm((tau - 0.10) / 0.12) * out, cam = o.cam ?? 1, stamp = o.stamp ?? ['21:07:44', '21:07:51', '21:08:02'][cam - 1] ?? '21:07:44';
  ctx.save();
  if (kB > 0.01) {   // photo border (white with a dark edge on both sides, so it shows on a bright sky too) and viewfinder corner brackets
    ctx.globalAlpha = kB; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, c] of [[15, 'rgba(13,19,34,0.55)'], [7, '#fff']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.strokeRect(24, 24, 1032, 1872); }
    const L = 72, bx0 = 90, bx1 = 940, by0 = 400, by1 = 1245; for (const [w, c] of [[11, C.ink], [6, '#fff']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      for (const [px, py, sx, sy] of [[bx0, by0, 1, 1], [bx1, by0, -1, 1], [bx0, by1, 1, -1], [bx1, by1, -1, -1]]) { ctx.moveTo(px, py + sy * L); ctx.lineTo(px, py); ctx.lineTo(px + sx * L, py); } ctx.stroke(); } }
  if (o.rect && kBox > 0.01) {   // the plate box: red, snaps in from a bigger box
    const [rx, ry, rw, rh] = o.rect, e = (1 - kBox) * 46, x = rx - 8 - e, y = ry - 8 - e, w = rw + 16 + 2 * e, h = rh + 16 + 2 * e; ctx.globalAlpha = kBox * out; ctx.lineJoin = 'round';
    for (const [lw, c] of [[11, C.ink], [5, C.red]]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.stroke(); }
    ctx.strokeStyle = C.red; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 10, y + h / 2); ctx.lineTo(x + 12, y + h / 2); ctx.moveTo(x + w - 12, y + h / 2); ctx.lineTo(x + w + 10, y + h / 2); ctx.moveTo(x + w / 2, y - 10); ctx.lineTo(x + w / 2, y + 12); ctx.moveTo(x + w / 2, y + h - 12); ctx.lineTo(x + w / 2, y + h + 10); ctx.stroke(); }
  if (kL > 0.01) {   // label: CAM 0n chip, time, a small red-light icon
    ctx.globalAlpha = kL; const cy = 350, label = 'CAM 0' + cam, cw = M(ctx, label, 34, { ls: 3 }) + 40; panel(ctx, 90, cy - 28, cw, 56, { r: 14, fill: '#fff', edge: C.ink, edgeW: 4, ticks: false, shadow: 10 }); T(ctx, label, 90 + cw / 2, cy + 2, 34, { align: 'center', ls: 3, fill: C.ink, outline: 0 });
    T(ctx, stamp, 90 + cw + 18, cy + 2, 36, { fill: '#fff', ls: 2, outline: 6 });
    const lx = 90 + cw + 18 + M(ctx, stamp, 36, { ls: 2 }) + 36; panel(ctx, lx, cy - 30, 32, 60, { r: 10, fill: C.ink, edge: 'rgba(255,255,255,0.7)', edgeW: 2.5, ticks: false, shadow: 8 });
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 0 ? C.red : 'rgba(255,255,255,0.18)'; if (i === 0) { ctx.shadowColor = C.red; ctx.shadowBlur = 14; } ctx.beginPath(); ctx.arc(lx + 16, cy - 19 + i * 19, 6.5, 0, TAU); ctx.fill(); ctx.shadowColor = 'transparent'; } }
  const fa = 0.94 * Math.pow(1 - clamp(tau / fl), 2); if (fa > 0.005) { ctx.globalAlpha = fa; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1080, 1920); }
  ctx.restore();
}
export const camPhoto = (o) => overlay(o, drawCamPhoto, { noText: true });

// ================================================================ 6. fineCard (the penalty notice, then the stack)
// o: { t0 (the first card starts to slide in), stamps: [t2, t3] (the two extra cards stamp down), t1 (all gone: they fall away over 0.25 s before t1), y (centre, 1150),
//      title: 'PHẠT NGUỘI · VƯỢT ĐÈN ĐỎ', amount: '-20.000.000đ', plate: 'TÈO 01' }
// The first card can be held as long as wanted before the stamps (p20 -> p21, about 4.5 s). The stack counts as ONE text item (the top card shows the same words).
export function drawFineCard(ctx, t, o) {
  const y = o.y ?? SLOT.y, W = 880, H = 206, x0 = SLOT.cx - W / 2, st = o.stamps ?? [], title = o.title ?? 'PHẠT NGUỘI · VƯỢT ĐÈN ĐỎ', amount = o.amount ?? '-20.000.000đ', plate = o.plate ?? 'TÈO 01';
  const out = sm((t - (o.t1 - 0.25)) / 0.25); if (t < o.t0 || out >= 1) return;
  const starts = [o.t0, ...st], rest = [[-0.017, 0, 0], [0.04, 10, -8], [-0.032, -8, -15]];
  for (let i = 0; i < starts.length && i < 3; i++) {
    const s = t - starts[i]; if (s < 0) continue; let sc = 1, dx = 0, dy = 0, al = 1, rot = rest[i][0], ox = rest[i][1], oy = rest[i][2];
    if (i === 0) { const u = clamp(s / 0.4), e = backOut(u, 1.1); dx = -(1 - e) * 60; dy = (1 - e) * 150; al = sm(u * 3.5); rot = rest[0][0] + (1 - e) * -0.06; sc = lerp(0.94, 1, clamp(e)); }   // slides up and in, always inside the side margins
    else { const u = clamp(s / 0.16); sc = 1 + 0.16 * (1 - u * u); al = clamp(s / 0.05); const w = Math.max(0, s - 0.16); sc *= 1 + 0.035 * Math.exp(-w / 0.1) * Math.sin(clamp(w * 30, 0, 99)); rot = rest[i][0] + (1 - u) * (i === 1 ? 0.06 : -0.06); }
    ctx.save(); ctx.globalAlpha *= al * (1 - out); ctx.translate(SLOT.cx + dx + ox, y + oy + dy + 70 * out); ctx.rotate(rot); ctx.scale(sc, sc);
    if (i > 0 && s > 0.14 && s < 0.5) { const u = (s - 0.14) / 0.36; ctx.save(); ctx.globalAlpha *= 0.5 * (1 - u); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(-W / 2 - 22 * u, -H / 2 - 22 * u, W + 44 * u, H + 44 * u, 22 + 18 * u); ctx.stroke(); ctx.restore(); }
    panel(ctx, -W / 2, -H / 2, W, H, { fill: '#0d1322', edge: 'rgba(255,196,58,0.85)', edgeW: 3, shadow: 26 });
    finePhoto(ctx, -W / 2 + 18, -H / 2 + 18, 226, 170, i, plate);
    const cx = -W / 2 + 18 + 226 + 26, cw = W - (cx + W / 2) - 24, tz = fit(ctx, title, cw, 40, 28, { ls: 1 });
    T(ctx, title, cx, -H / 2 + 50, tz, { ls: 1, fill: '#fff', outline: 5 });
    ctx.strokeStyle = 'rgba(255,196,58,0.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, -H / 2 + 84); ctx.lineTo(cx + cw, -H / 2 + 84); ctx.stroke();
    const az = fit(ctx, amount, cw, 92, 40, {}); T(ctx, amount, cx, -H / 2 + 146, az, { fill: C.red, outline: az * 0.1, outlineColor: C.ink });
    if (i > 0) { const bk = backOut((s - 0.1) / 0.2, 2.2), bx = W / 2 - 40, by = -H / 2 - 16; ctx.save(); ctx.translate(bx, by); ctx.scale(lerp(0.3, 1, clamp(bk)), lerp(0.3, 1, clamp(bk))); ctx.globalAlpha *= clamp((s - 0.1) / 0.1); ctx.fillStyle = C.red; ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.stroke(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.stroke(); T(ctx, 'x' + (i + 1), 0, 2, 40, { align: 'center', fill: '#fff', outline: 0 }); ctx.restore(); }
    ctx.restore(); }
}
// our own drawing of the camera photo: the rear of a small convertible under a red light, flash marks. i = which photo (1st, 2nd, 3rd red light)
function finePhoto(ctx, x, y, w, h, i, plate) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h * 0.62); sky.addColorStop(0, '#5b3a8c'); sky.addColorStop(1, '#f27ca0'); ctx.fillStyle = sky; ctx.fillRect(x, y, w, h * 0.62);
  ctx.fillStyle = '#272c42'; ctx.fillRect(x, y + h * 0.62, w, h * 0.38); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w * 0.5, y + h * 0.62); ctx.lineTo(x + w * 0.38, y + h); ctx.moveTo(x + w * 0.5, y + h * 0.62); ctx.lineTo(x + w * 0.64, y + h); ctx.stroke();
  const lx = x + 36 + [0, 20, 8][i], ly = y + 14;   // red traffic light on a pole
  ctx.fillStyle = '#4b516b'; ctx.fillRect(lx - 3, ly + 44, 6, h * 0.62 - 44 - 14 + 14); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.roundRect(lx - 13, ly, 26, 52, 7); ctx.fill();
  const rg = ctx.createRadialGradient(lx, ly + 12, 2, lx, ly + 12, 34); rg.addColorStop(0, 'rgba(255,77,77,0.9)'); rg.addColorStop(1, 'rgba(255,77,77,0)'); ctx.fillStyle = rg; ctx.fillRect(lx - 36, ly - 22, 72, 68);
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(lx, ly + 12, 7.5, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (const dy of [26, 41]) { ctx.beginPath(); ctx.arc(lx, ly + dy, 6.5, 0, TAU); ctx.fill(); }
  const cx = x + w * (0.6 + [0, -0.03, 0.03][i]), cy = y + h * 0.77;   // the car, seen from behind
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + 30, 78, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.ink; for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(cx + s * 58 - 12, cy + 12, 24, 22, 6); ctx.fill(); }
  ctx.fillStyle = '#ff7a59'; ctx.beginPath(); ctx.roundRect(cx - 74, cy - 14, 148, 44, 14); ctx.fill(); ctx.fillStyle = '#d9583b'; ctx.beginPath(); ctx.roundRect(cx - 74, cy + 16, 148, 12, 6); ctx.fill();
  ctx.fillStyle = '#34395a'; ctx.beginPath(); ctx.moveTo(cx - 46, cy - 14); ctx.lineTo(cx - 34, cy - 40); ctx.lineTo(cx + 34, cy - 40); ctx.lineTo(cx + 46, cy - 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.red; for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(cx + s * 60 - 11, cy - 8, 22, 12, 4); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(cx - 31, cy + 1, 62, 24, 5); ctx.stroke(); ctx.fill(); T(ctx, plate, cx, cy + 14, 17, { align: 'center', fill: C.ink, outline: 0 });
  const fx = x + w * 0.84, fy = y + h * 0.18, fg = ctx.createRadialGradient(fx, fy, 2, fx, fy, 54); fg.addColorStop(0, 'rgba(255,255,255,0.95)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = fg; ctx.fillRect(fx - 56, fy - 56, 112, 112);   // flash marks
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let r = 0; r < 8; r++) { const a = r * TAU / 8 + i * 0.2, l0 = 14, l1 = r % 2 ? 26 : 38; ctx.beginPath(); ctx.moveTo(fx + Math.cos(a) * l0, fy + Math.sin(a) * l0); ctx.lineTo(fx + Math.cos(a) * l1, fy + Math.sin(a) * l1); ctx.stroke(); }
  ctx.restore(); ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.stroke(); ctx.restore();
}
export const fineCard = (o) => {
  const e = o.t1 - 0.25, st = o.stamps ?? [], title = o.title ?? 'PHẠT NGUỘI · VƯỢT ĐÈN ĐỎ', amount = o.amount ?? '-20.000.000đ', r = [{ text: title, t0: +(o.t0 + 0.45).toFixed(3), t1: e }, { text: amount, t0: +(o.t0 + 0.45).toFixed(3), t1: e }];
  st.forEach((s, i) => r.push({ text: 'x' + (i + 2), t0: +(s + 0.3).toFixed(3), t1: e })); return overlay(o, drawFineCard, { reads: r });
};

// ================================================================ 8. exitButton (p24-l25): the game menu's THOÁT, grey and locked
// o: { t0, t1, slamAt (Tèo's slam), x (60), y (344) }  appears at t0; at slamAt: a press dip, one eased shake (0.7 s wave) and a small red blink of the padlock; the tag CÒN NỢ
// pops under it at slamAt + 0.05 and stays to t1. Lives under the minimap (x 60-322, y 344-428; the tag to y 502 where faces start), never in the caption band.
export function drawExitButton(ctx, t, o) {
  const x0 = o.x ?? 60, y0 = o.y ?? 344, w = 262, h = 84, inK = easeOut((t - o.t0) / 0.22), out = sm((o.t1 - t) / 0.2), k = inK * out; if (k <= 0) return;
  const u = o.slamAt == null ? -1 : t - o.slamAt; let dx = 0, sc = 1, red = 0;
  if (u >= 0) { dx = 13 * Math.exp(-u / 0.22) * Math.sin(u * TAU * 7.5); sc = 1 - 0.1 * Math.sin(Math.PI * clamp(u / 0.14)) + 0.035 * Math.exp(-Math.max(0, u - 0.14) / 0.1) * Math.sin(clamp((u - 0.14) * 30, 0, 99)); red = sm(u / 0.07) * (1 - sm((u - 0.1) / 0.4)); }
  ctx.save(); ctx.globalAlpha *= k; ctx.translate(x0 + w / 2 + dx - (1 - inK) * 40, y0 + h / 2); ctx.scale(sc, sc);
  panel(ctx, -w / 2, -h / 2, w, h, { fill: 'rgba(96,104,122,0.96)', edge: 'rgba(222,227,238,0.9)', edgeW: 3, tick: '#c3cadb' });
  const lx = -w / 2 + 40, ly = 3, lc = mix('#dfe3ec', '#ff4d4d', red);   // padlock
  ctx.lineWidth = 7; ctx.strokeStyle = lc; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(lx, ly - 6, 11, Math.PI, 0); ctx.lineTo(lx + 11, ly + 2); ctx.moveTo(lx - 11, ly - 6); ctx.lineTo(lx - 11, ly + 2); ctx.stroke();
  if (red > 0.02) { ctx.save(); ctx.globalAlpha *= 0.7 * red; ctx.shadowColor = C.red; ctx.shadowBlur = 22; ctx.fillStyle = C.red; ctx.beginPath(); ctx.roundRect(lx - 17, ly - 1, 34, 27, 6); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = lc; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(lx - 17, ly - 1, 34, 27, 6); ctx.stroke(); ctx.fill(); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(lx, ly + 12, 4, 0, TAU); ctx.fill();
  T(ctx, 'THOÁT', lx + 34, 3, 44, { ls: 2, fill: '#eef0f6', outline: 5 });
  ctx.restore();
  // flash (20/11, gta6p2): o.flash = [{ t0, t1, text: 'MẸ GỌI: ƯU TIÊN' }] swaps the tag under the button for that text (a pop, gold-edged, a red pulse) from t0 to t1, then CÒN NỢ pops back. Without o.flash nothing below differs.
  const fl = (o.flash || []).find((f) => t >= f.t0 && t < f.t1 + 0.0001), fb = (o.flash || []).find((f) => t >= f.t1 && t < f.t1 + 0.25);
  if (u >= 0.05 || fl) { const lab = fl ? fl.text : 'CÒN NỢ', tk = fl ? backOut((t - fl.t0) / 0.22, 2.0) : fb ? backOut((t - fb.t1) / 0.2) : backOut((u - 0.05) / 0.2), pulse = fl ? 0.5 + 0.5 * Math.sin((t - fl.t0) * 11) : 0, maxTw = 560 - 74, tz = fl ? Math.min(36, fit(ctx, lab, maxTw, 36, 20, { ls: 3 })) : 36, tw = M(ctx, lab, tz, { ls: 3 }) + 74, ty = y0 + h + 16 + 31; ctx.save(); ctx.globalAlpha *= out * clamp(tk * 1.5); ctx.translate(x0 + tw / 2, ty); ctx.scale(lerp(0.6, 1, clamp(tk)), lerp(0.6, 1, clamp(tk))); panel(ctx, -tw / 2, -31, tw, 62, { r: 16, fill: fl ? mix('#0d1322', '#7a1020', pulse * 0.8) : undefined, edge: fl ? C.gold : 'rgba(255,255,255,0.55)', edgeW: fl ? 3.5 : 2.5, ticks: false, shadow: 14 });
    ctx.fillStyle = C.red; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-tw / 2 + 30, 1, 9, 0, TAU); ctx.stroke(); ctx.fill(); T(ctx, lab, -tw / 2 + 52, 3, tz, { ls: 3, fill: fl ? C.gold : '#fff', outline: 4 }); ctx.restore(); }
}
export const exitButton = (o) => { const fl = o.flash || [], reads = [{ text: 'THOÁT', t0: +(o.t0 + 0.2).toFixed(3), t1: o.t1 }]; fl.forEach((f) => reads.push({ text: f.text, t0: +(f.t0 + 0.2).toFixed(3), t1: f.t1 }));
  if (o.slamAt != null) { let a = o.slamAt + 0.25; for (const f of [...fl].sort((x, y) => x.t0 - y.t0)) { if (f.t0 - a >= 0.05) reads.push({ text: 'CÒN NỢ', t0: +a.toFixed(3), t1: +f.t0.toFixed(3) }); a = Math.max(a, f.t1 + 0.2); } reads.push({ text: 'CÒN NỢ', t0: +a.toFixed(3), t1: o.t1 }); }
  return overlay(o, drawExitButton, { reads }); };

// ================================================================ 10. stampCard (20/11, the gta6p2 cliffhanger): a red rubber STAMP slams into the middle of the frame: CÒN TIẾP / TẬP 3: RƯỢT ĐUỔI
// o: { t0 (the slam lands at t0 + 0.14), t1, text: 'CÒN TIẾP', sub: 'TẬP 3: RƯỢT ĐUỔI', y: 960 }. Pair it with the freeze (engine `hits`, see camPhoto above): hits: [{ t: t0 + 0.32, frames: 60 }] freezes the picture AND this overlay
// at the moment the stamp is complete (flash gone at 0.30 s, bounce settled); the stamp then stays to t1. A text of n characters needs 1.0 + n / 12 s: 'CÒN TIẾP · TẬP 3: RƯỢT ĐUỔI' = 27 characters = 3.25 s of film time after the slam (t1 - t0 >= 3.4).
// Cream plate + red double border + red / ink lettering, so it reads over any picture at phone size; faces stay clear only if y is chosen for the shot (default centre y 960 = over the picture's middle).
export function drawStampCard(ctx, t, o) {
  const u = t - o.t0, out = sm((o.t1 - t) / 0.2); if (u < 0 || out <= 0) return;
  const land = 0.14, y = o.y ?? 960, text = o.text ?? 'CÒN TIẾP', sub = o.sub ?? 'TẬP 3: RƯỢT ĐUỔI', k = clamp(u / land), sc = k < 1 ? lerp(1.12, 1, k * k) : 1 + 0.05 * Math.exp(-(u - land) / 0.12) * Math.sin(clamp((u - land) * 38, 0, 99)), al = sm(u / 0.1), rot = -0.07 + (k < 1 ? 0.09 * (1 - k) : 0);
  const ts = fit(ctx, text, 700, 150, 70, { ls: 4 }), ss = fit(ctx, sub, 700, 64, 36, { ls: 3 }), W = Math.max(M(ctx, text, ts, { ls: 4 }), M(ctx, sub, ss, { ls: 3 })) + 120, H = ts + ss + 130, RED = '#e0282e';
  ctx.save(); ctx.globalAlpha *= al * out; ctx.translate(SLOT.cx + 40 + (k >= 1 ? 9 * Math.exp(-(u - land) / 0.18) * Math.sin((u - land) * 52) : 0), y); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(8,10,24,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; ctx.fillStyle = 'rgba(255,244,232,0.95)'; ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 26); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = RED; ctx.lineWidth = 14; ctx.beginPath(); ctx.roundRect(-W / 2 + 12, -H / 2 + 12, W - 24, H - 24, 20); ctx.stroke(); ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-W / 2 + 36, -H / 2 + 36, W - 72, H - 72, 12); ctx.stroke();
  T(ctx, text, 0, -ss * 0.55 - 6, ts, { align: 'center', ls: 4, fill: RED, outline: 0 }); ctx.fillStyle = RED; ctx.fillRect(-W / 2 + 60, ts * 0.5 - ss * 0.55 + 14, W - 120, 5); T(ctx, sub, 0, ts * 0.5 + ss * 0.5 - ss * 0.55 + 36, ss, { align: 'center', ls: 3, fill: C.ink, outline: 0 });
  ctx.restore();
  { const fb = Math.sin(Math.PI * clamp((u - 0.08) / 0.22)); if (fb > 0.001) { ctx.save(); ctx.globalAlpha = 0.45 * fb * fb * out; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1080, 1920); ctx.restore(); } }   // the white flash of the impact: a soft bump (0.08 .. 0.30 s), never a hard edge
}
export const stampCard = (o) => overlay(o, drawStampCard, { reads: [{ text: (o.text ?? 'CÒN TIẾP') + ' · ' + (o.sub ?? 'TẬP 3: RƯỢT ĐUỔI'), t0: +(o.t0 + 0.2).toFixed(3), t1: o.t1 }] });

// ================================================================ 9. nameTag (20/11, gta6p2): a floating name over a character's head (CHỊ LAN)
// o: { t0, t1, who: 'lan', text: 'CHỊ LAN', dy: 30 (px above the top of the head) }. Follows the head through the real camera (it reads window.stage.camera), so it is right in any shot and moves with a camera move.
// A message: 1.0 + n / 12 s (CHỊ LAN = 7 characters = 1.6 s). End it BEFORE the line it must not interrupt (the script wants the tag gone before the cut / the next speaker).
export function drawNameTag(ctx, t, o, env) {
  const inK = backOut((t - o.t0) / 0.24, 2.0), out = sm((o.t1 - t) / 0.18), k = clamp(inK) * out; if (k <= 0) return;
  let ax = o.ax ?? 540, ay = o.ay ?? 600; const c = env?.cast?.[o.who], cam = globalThis.stage?.camera;
  if (c && cam) { const h = c.headWorld(), top = h.clone().add(cam.up.clone().multiplyScalar((c.R ?? 0.17) * 1.25)); top.project(cam); if (top.z > 1) return; ax = (top.x * 0.5 + 0.5) * 1080; ay = (-top.y * 0.5 + 0.5) * 1920; if (ay > 2300 || ay < -400) return; }   // 20/11: behind the camera or far outside the frame (gta6p3, Linh under the water): draw nothing
  const text = o.text ?? 'CHỊ LAN', size = 42, tw = M(ctx, text, size, { ls: 3 }), w = tw + 70, h = 74, bob = 5 * Math.sin(t * 2.4), cx = clamp(ax, 54 + w / 2, 1026 - w / 2), cy = Math.max(190 + h / 2, ay - (o.dy ?? 30) - 18 - h / 2) + bob;
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.4); ctx.translate(cx, cy + h / 2); ctx.scale(lerp(0.7, 1, clamp(inK)), lerp(0.7, 1, clamp(inK))); ctx.translate(-cx, -(cy + h / 2));
  panel(ctx, cx - w / 2, cy - h / 2, w, h, { r: 22, edge: C.gold, edgeW: 3.5, ticks: false, shadow: 16 }); ctx.fillStyle = C.panel; ctx.strokeStyle = C.gold; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(cx - 14, cy + h / 2 - 1); ctx.lineTo(cx, cy + h / 2 + 18); ctx.lineTo(cx + 14, cy + h / 2 - 1); ctx.stroke(); ctx.fill();
  ctx.fillStyle = C.panel; ctx.fillRect(cx - 13, cy + h / 2 - 5, 26, 7);   // joins the pointer to the plate
  T(ctx, text, cx, cy + 3, size, { align: 'center', ls: 3, fill: '#fff', outline: 5 }); ctx.restore();
}
export const nameTag = (o) => ({ kind: 'draw', t0: o.t0 - 0.02, t1: o.t1 + 0.02, fade: 0.01, reads: [{ text: o.text ?? 'CHỊ LAN', t0: +(o.t0 + 0.1).toFixed(3), t1: o.t1 }], text: o.text ?? 'CHỊ LAN', fn: (ctx, t, env) => drawNameTag(ctx, t, o, env) });

// small drawing helpers for the live overlay (live_overlay.js): outlined text, measure, fit, panel
export { T as hudText, M as hudMeasure, fit as hudFit, panel as hudPanel };
