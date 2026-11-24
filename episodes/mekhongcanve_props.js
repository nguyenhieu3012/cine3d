// cine3d episode mekhongcanve ("Mẹ bảo không cần về?"), BẢN 3 (16/11 night): the 2-D layer. ONE big chat card in the top half (mẹ's chat), Bíp's blue translate strips under mẹ's bubbles,
// and warm drawn PHOTOS that mẹ sent (pomelo tree in bloom / heavy with fruit / fruit on the ground; the ending: a live fish in an aluminium basin, the bare tree with ONE bagged fruit). No board, no background swap.
// Everything is a pure function of t and of the times file (times come in through makeCard(T); nothing is typed by hand).
//
// How the card works: the chat is a list of SCENES (what the window shows) and the items in them. Between two scenes the content scrolls (shared items slide to their new
// place, the others leave / arrive from the edge: a scroll). Inside a scene the card grows when an item arrives. An item pops in at its own time ("one new message at a time").

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = (x, c = 1.7) => { x = clamp(x); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const UIF = (w, s) => `${w} ${s}px UI, sans-serif`;
let CLIP_TOP = -1e9, CLIP_BOT = 1e9;   // visible window of the card this frame: a text fully outside it is not drawn at all (it would be clipped anyway, but it must not exist for the checks)
const txt = (ctx, str, x, y, fs) => { if (y + fs * 0.6 < CLIP_TOP + 4 || y - fs * 0.6 > CLIP_BOT - 4) return; ctx.fillText(str, x, y); };
const rng = (seed) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

// ------------------------------------------------------------------ geometry (1080 x 1920 frame)
export const GEO = { X: 60, W: 960, TOP: 150, TOP_HOOK: 346, HEAD: 76, PADT: 18, PADB: 22, GAP: 14, MAXC: 520 };   // card x 60..1020; header 76; content window at most 540 px
const PAD_X = 26, PAD_Y = 14;
const BLUE = '#3f8cff', BLUE_D = '#2468d8';   // Bíp's blue (body of the character), a little deeper at the foot of the strip
const GOLD = '#ffc94a';                       // Tèo's own message (his hoodie yellow)

// ------------------------------------------------------------------ the four photos (simple, warm, flat; no text)
function frame(ctx, w, h, fn) { ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, w, h, 20); ctx.clip(); fn(); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 20); ctx.stroke(); }
function sky(ctx, w, h, c0, c1) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
function hills(ctx, w, h, col, y) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, y); ctx.quadraticCurveTo(w * 0.28, y - 34, w * 0.52, y - 6); ctx.quadraticCurveTo(w * 0.78, y - 40, w, y - 10); ctx.lineTo(w, h); ctx.fill(); }
function fruit(ctx, x, y, r, tilt = 0) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#e0a31c'; ctx.beginPath(); ctx.arc(1.5, 2.5, r, 0, 7); ctx.fill(); ctx.fillStyle = '#f6d241'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,248,190,0.75)'; ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.34, r * 0.34, r * 0.2, -0.6, 0, 7); ctx.fill(); ctx.fillStyle = '#7a9a2c'; ctx.beginPath(); ctx.arc(tilt * 2, -r * 0.92, r * 0.17, 0, 7); ctx.fill(); ctx.restore(); }
function blossom(ctx, x, y, r) { ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { const a = i * 1.2566; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, 0, 7); ctx.fill(); } ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, 7); ctx.fill(); }
function tree(ctx, cx, base, o) {   // trunk + canopy of overlapping circles; o.dark = darker leaves
  ctx.fillStyle = '#6b4a2e'; ctx.beginPath(); ctx.moveTo(cx - 17, base); ctx.lineTo(cx - 9, base - 78); ctx.lineTo(cx + 9, base - 78); ctx.lineTo(cx + 17, base); ctx.fill();
  ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, base - 70); ctx.lineTo(cx - 46, base - 100); ctx.moveTo(cx, base - 70); ctx.lineTo(cx + 48, base - 98); ctx.stroke();
  const L = o.dark ? ['#4f8a35', '#5d9a3c', '#3f7a2f'] : ['#3d9440', '#4fae4a', '#2f8039'], C = [[0, -118, 64], [-56, -96, 48], [58, -98, 50], [-26, -150, 46], [34, -150, 44], [0, -86, 52]];
  C.forEach(([dx, dy, r], i) => { ctx.fillStyle = L[i % 3]; ctx.beginPath(); ctx.arc(cx + dx, base + dy, r, 0, 7); ctx.fill(); });
  ctx.fillStyle = 'rgba(255,255,200,0.14)'; ctx.beginPath(); ctx.arc(cx - 20, base - 150, 34, 0, 7); ctx.fill();
}
const PHOTOS = {
  hoa(ctx, w, h) { frame(ctx, w, h, () => { sky(ctx, w, h, '#a9dcf5', '#f7ecd0'); hills(ctx, w, h, '#9ccf7a', 132); ctx.fillStyle = '#7fbd5a'; ctx.fillRect(0, 158, w, h - 158); tree(ctx, 170, 188, {}); const r = rng(7);
    for (let i = 0; i < 46; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 96; blossom(ctx, 170 + Math.cos(a) * d * 1.05, 188 - 118 + Math.sin(a) * d * 0.85, 5.5 + r() * 3); }
    for (let i = 0; i < 9; i++) blossom(ctx, 70 + r() * 200, 192 + r() * 22, 3.5);   // petals in the grass
    ctx.fillStyle = '#b8864f'; ctx.fillRect(0, 150, 40, 5); ctx.fillRect(w - 52, 148, 52, 5); [[6, 140], [26, 140], [w - 40, 138], [w - 18, 138]].forEach(([x, y]) => ctx.fillRect(x, y, 5, 30)); }); },
  chin(ctx, w, h) { frame(ctx, w, h, () => { sky(ctx, w, h, '#ffd9a0', '#fff1d2'); hills(ctx, w, h, '#b8c97a', 134); ctx.fillStyle = '#8fb85a'; ctx.fillRect(0, 160, w, h - 160); tree(ctx, 170, 190, { dark: true });
    [[-52, -88, 19], [-18, -124, 20], [24, -98, 21], [58, -122, 19], [-70, -128, 17], [0, -160, 18], [48, -158, 17], [-34, -168, 16], [-4, -66, 19], [-60, -62, 15], [66, -76, 17]].forEach(([dx, dy, r], i) => fruit(ctx, 170 + dx, 190 + dy, r, i % 3 - 1));
    fruit(ctx, 96, 206, 14); fruit(ctx, 250, 204, 15); }); },
  rung(ctx, w, h) { frame(ctx, w, h, () => { sky(ctx, w, h, '#e7c6a0', '#f4e1c6'); hills(ctx, w, h, '#b9b779', 136); ctx.fillStyle = '#9aa860'; ctx.fillRect(0, 164, w, h - 164); tree(ctx, 142, 184, { dark: true });
    fruit(ctx, 142 + 4, 184 - 110, 15); fruit(ctx, 142 - 40, 184 - 80, 14);
    const r = rng(11); const G = [[212, 190, 18], [246, 176, 16], [188, 210, 17], [268, 206, 18], [226, 160, 15], [160, 202, 16], [292, 184, 15], [110, 206, 15], [74, 190, 14], [244, 210, 14], [204, 176, 14], [60, 168, 12]];
    G.forEach(([x, y, rr], i) => fruit(ctx, x, y, rr, i % 3 - 1)); ctx.fillStyle = 'rgba(120,80,40,0.7)'; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.ellipse(40 + r() * 270, 168 + r() * 50, 7, 3.4, r() * 3, 0, 7); ctx.fill(); } }); },
  noi(ctx, w, h) { frame(ctx, w, h, () => {
    ctx.fillStyle = '#efe0c4'; ctx.fillRect(0, 0, w, h); const wg = ctx.createLinearGradient(0, 0, 90, 90); wg.addColorStop(0, '#fff3c8'); wg.addColorStop(1, 'rgba(255,243,200,0)'); ctx.fillStyle = wg; ctx.fillRect(0, 0, 200, 170);
    ctx.fillStyle = '#fff6df'; ctx.fillRect(14, 12, 64, 58); ctx.strokeStyle = '#b08a56'; ctx.lineWidth = 5; ctx.strokeRect(14, 12, 64, 58); ctx.beginPath(); ctx.moveTo(46, 12); ctx.lineTo(46, 70); ctx.moveTo(14, 41); ctx.lineTo(78, 41); ctx.stroke();   // window
    ctx.fillStyle = '#9b6a3a'; ctx.fillRect(0, 176, w, h - 176); ctx.fillStyle = '#c0905a'; ctx.fillRect(0, 168, w, 12); ctx.fillStyle = '#85582e'; ctx.fillRect(w / 2 - 2, 180, 4, h); ctx.fillStyle = '#d6a45f'; ctx.beginPath(); ctx.arc(w / 2 - 14, 200, 4, 0, 7); ctx.arc(w / 2 + 14, 200, 4, 0, 7); ctx.fill();   // cupboard top and doors
    const bx = 64, by = 52, bw = 190, bh = 118;   // the box, big
    ctx.fillStyle = 'rgba(70,40,20,0.25)'; ctx.beginPath(); ctx.ellipse(bx + bw / 2 + 14, 171, bw * 0.68, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#cf9d5c'; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = '#b3814a'; ctx.beginPath(); ctx.moveTo(bx + bw, by); ctx.lineTo(bx + bw + 28, by - 10); ctx.lineTo(bx + bw + 28, by + bh - 12); ctx.lineTo(bx + bw, by + bh); ctx.fill();
    ctx.fillStyle = '#e8c88e'; ctx.fillRect(bx + bw * 0.5, by - 2, 16, bh + 2);   // tape
    ctx.fillStyle = '#2a2a33'; ctx.beginPath(); ctx.roundRect(bx + bw - 78, by + 40, 62, 56, 14); ctx.fill(); ctx.fillStyle = '#9ad0e8'; ctx.beginPath(); ctx.arc(bx + bw - 47, by + 66, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#e2493c'; ctx.beginPath(); ctx.arc(bx + bw - 24, by + 22, 13, 0, 7); ctx.fill();   // printed air fryer, sale sticker
    // the lace cloth: over the left and the top of the box, hanging down with a scalloped hem
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.moveTo(bx - 26, by + 84); ctx.lineTo(bx - 20, by - 4); ctx.quadraticCurveTo(bx + 80, by - 30, bx + bw * 0.62, by - 8); ctx.lineTo(bx + bw * 0.62, by + 84); ctx.closePath(); ctx.fill();
    const n = 9, x0 = bx - 26, x1 = bx + bw * 0.62, dx = (x1 - x0) / n; ctx.fillStyle = '#fffaf0'; for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x0 + dx * (i + 0.5), by + 84, dx / 2, 0, Math.PI); ctx.fill(); }
    ctx.strokeStyle = 'rgba(180,150,100,0.7)'; ctx.lineWidth = 2; for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x0 + dx * (i + 0.5), by + 84, dx / 2, 0, Math.PI); ctx.stroke(); }
    ctx.fillStyle = '#e9d8b8'; const rr = rng(5); for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(x0 + 14 + rr() * (x1 - x0 - 28), by + 8 + rr() * 62, 3.6, 0, 7); ctx.fill(); }   // lace holes
    ctx.strokeStyle = 'rgba(180,150,100,0.6)'; ctx.beginPath(); ctx.moveTo(bx - 20, by - 4); ctx.quadraticCurveTo(bx + 80, by - 30, bx + bw * 0.62, by - 8); ctx.stroke(); }); },
};


// ---- the two photos of the ending (16/11 night, "BẢN 3"): drawn in the 330 x 222 space of the old photos and scaled up to PHB; both take t (a pure function of time: the fish swims, the bagged fruit sways a hair)
const PHB = { w: 440, h: 296 };   // 440 x 296 + 24: the bare-tree photo (320) + 14 + the two-line text (172) = 506 of the 520 px window, the most that fits
function bagged(ctx, x, y, r, sway) {   // ONE pomelo wrapped in a clear plastic bag tied at the neck with string (mẹ keeps it)
  ctx.save(); ctx.translate(x, y - r * 1.5); ctx.rotate(sway); ctx.translate(0, r * 1.5);
  ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -r * 1.55); ctx.lineTo(0, -r * 1.12); ctx.stroke();           // stalk
  fruit(ctx, 0, 0, r, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.46)'; ctx.beginPath(); ctx.moveTo(-r * 0.30, -r * 1.12); ctx.bezierCurveTo(-r * 1.38, -r * 0.9, -r * 1.5, r * 0.9, -r * 0.55, r * 1.28); ctx.quadraticCurveTo(0, r * 1.42, r * 0.55, r * 1.28); ctx.bezierCurveTo(r * 1.5, r * 0.9, r * 1.38, -r * 0.9, r * 0.30, -r * 1.12); ctx.closePath(); ctx.fill();   // the bag
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-r * 0.82, -r * 0.18, r * 0.12, r * 0.5, 0.12, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(r * 0.84, r * 0.34, r * 0.08, r * 0.3, -0.1, 0, 7); ctx.fill();   // glints on the plastic
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); [[-0.5, 1.0, -0.3, 0.6], [0.45, 1.05, 0.6, 0.62], [0.05, 1.2, 0, 0.82]].forEach(([a, b, c, d]) => { ctx.moveTo(r * a, r * b); ctx.lineTo(r * c, r * d); }); ctx.stroke();   // creases
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 1.12); ctx.lineTo(-r * 0.62, -r * 1.5); ctx.lineTo(-r * 0.12, -r * 1.2); ctx.lineTo(r * 0.12, -r * 1.58); ctx.lineTo(r * 0.4, -r * 1.12); ctx.closePath(); ctx.fill();   // the gathered neck of the bag
  ctx.strokeStyle = '#a2542e'; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(-r * 0.44, -r * 1.12); ctx.lineTo(r * 0.44, -r * 1.1); ctx.stroke();   // string round the neck
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 1.1); ctx.quadraticCurveTo(r * 0.8, -r * 0.95, r * 0.7, -r * 0.62); ctx.moveTo(r * 0.3, -r * 1.1); ctx.quadraticCurveTo(r * 0.58, -r * 1.3, r * 0.92, -r * 1.14); ctx.stroke();   // two loose ends
  ctx.restore();
}
PHOTOS.co = function (ctx, w, h, t = 0) {   // BARE pomelo tree with exactly one fruit left, in a plastic bag tied with string
  ctx.save(); ctx.scale(w / 330, h / 222); w = 330; h = 222;
  frame(ctx, w, h, () => { sky(ctx, w, h, '#dfcdb0', '#f3e6cf'); hills(ctx, w, h, '#b7b07c', 138); ctx.fillStyle = '#a99a60'; ctx.fillRect(0, 166, w, h - 166);
    const r = rng(23); ctx.fillStyle = 'rgba(122,84,44,0.75)'; for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.ellipse(30 + r() * 270, 176 + r() * 38, 6, 3, r() * 3, 0, 7); ctx.fill(); }   // dry leaves on the ground (no fruit)
    const cx = 150, base = 196; ctx.fillStyle = '#6b4a2e'; ctx.beginPath(); ctx.moveTo(cx - 17, base); ctx.lineTo(cx - 9, base - 86); ctx.lineTo(cx + 9, base - 86); ctx.lineTo(cx + 17, base); ctx.fill();
    ctx.strokeStyle = '#6b4a2e'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const br = (w0, pts) => { ctx.lineWidth = w0; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x, base + y) : ctx.moveTo(cx + x, base + y))); ctx.stroke(); };
    br(8, [[0, -84], [-22, -112], [-58, -134]]); br(8, [[0, -84], [26, -116], [66, -128]]); br(7, [[0, -86], [-4, -128], [-16, -168]]); br(6, [[2, -90], [18, -140], [44, -170]]);
    br(4, [[-22, -112], [-32, -150]]); br(4, [[-58, -134], [-92, -140]]); br(4, [[-58, -134], [-78, -166]]); br(4, [[26, -116], [48, -92]]); br(4, [[66, -128], [100, -150]]); br(3, [[66, -128], [92, -112]]); br(3, [[-16, -168], [-34, -190]]); br(3, [[44, -170], [70, -192]]);
    ctx.fillStyle = '#7d9a3e'; [[-92, -141, 5], [-78, -167, 4.5], [-34, -190, 5], [70, -193, 5], [100, -151, 4.5], [-32, -151, 4]].forEach(([dx, dy, rr]) => { ctx.beginPath(); ctx.ellipse(cx + dx, base + dy, rr * 1.3, rr, 0.5, 0, 7); ctx.fill(); });   // the last few leaves
    ctx.fillStyle = 'rgba(80,50,20,0.22)'; ctx.beginPath(); ctx.ellipse(cx + 2, base + 3, 62, 8, 0, 0, 7); ctx.fill();
    bagged(ctx, cx + 60, base - 80, 30, 0.045 * Math.sin(t * 1.2)); });   // hangs from the branch end (the stalk top touches the branch at about (cx+60, base-126))
  ctx.restore();
};
PHOTOS.ca = function (ctx, w, h, t = 0) {   // the fish still alive, swimming in an aluminium basin of water
  ctx.save(); ctx.scale(w / 330, h / 222); w = 330; h = 222;
  frame(ctx, w, h, () => { ctx.fillStyle = '#efe0c4'; ctx.fillRect(0, 0, w, h); const wg = ctx.createLinearGradient(0, 0, 130, 100); wg.addColorStop(0, '#fff3c8'); wg.addColorStop(1, 'rgba(255,243,200,0)'); ctx.fillStyle = wg; ctx.fillRect(0, 0, 220, 170);
    ctx.fillStyle = '#b9804f'; ctx.fillRect(0, 150, w, h - 150); ctx.fillStyle = '#d4a16a'; ctx.fillRect(0, 142, w, 10);                         // wall foot and a brick floor
    ctx.strokeStyle = 'rgba(110,64,30,0.45)'; ctx.lineWidth = 2; for (let y = 168; y < h; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } for (let k = 0; k < 7; k++) { const x0 = 30 + k * 52; ctx.beginPath(); ctx.moveTo(x0, 168); ctx.lineTo(x0 - 10, 190); ctx.moveTo(x0 + 20, 190); ctx.lineTo(x0 + 10, 212); ctx.stroke(); }
    const cx = 165, cy = 128;
    ctx.fillStyle = 'rgba(60,30,10,0.32)'; ctx.beginPath(); ctx.ellipse(cx + 8, cy + 38, 128, 28, 0, 0, 7); ctx.fill();                                // shadow on the floor
    const rg = ctx.createLinearGradient(cx - 120, 0, cx + 120, 0); rg.addColorStop(0, '#9aa1a9'); rg.addColorStop(0.35, '#eef1f4'); rg.addColorStop(0.7, '#c4cad0'); rg.addColorStop(1, '#8c939b');
    ctx.fillStyle = '#7e858d'; ctx.beginPath(); ctx.ellipse(cx, cy + 12, 118, 56, 0, 0, 7); ctx.fill();                                              // body of the basin (seen from slightly above)
    ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(cx, cy, 118, 58, 0, 0, 7); ctx.fill();                                                          // the rim, bright aluminium
    ctx.fillStyle = '#868d95'; ctx.beginPath(); ctx.ellipse(cx, cy + 3, 105, 48, 0, 0, 7); ctx.fill();                                              // inner wall
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy + 7, 98, 43, 0, 0, 7); ctx.clip();
    const wgr = ctx.createLinearGradient(0, cy - 36, 0, cy + 50); wgr.addColorStop(0, '#5f9fb2'); wgr.addColorStop(1, '#93cfda'); ctx.fillStyle = wgr; ctx.fillRect(cx - 100, cy - 40, 200, 100);   // the water
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.4; for (let i = 0; i < 3; i++) { const u = (t * 0.45 + i / 3) % 1; ctx.globalAlpha = 0.65 * (1 - u); ctx.beginPath(); ctx.ellipse(fx(t), fy(t) + 4, 14 + 56 * u, 5 + 20 * u, 0, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1;   // ripples round the fish
    fishDraw(ctx, fx(t), fy(t), t);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(cx - 40, cy - 14, 34, 6, -0.12, 0, 7); ctx.fill();                       // sheen on the water
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, 116, 56, 0, Math.PI * 1.08, Math.PI * 1.45); ctx.stroke(); });   // a shine on the rim
  ctx.restore();
};
const fx = (t) => 160 + 15 * Math.sin(t * 0.5), fy = (t) => 133 + 4 * Math.sin(t * 0.8 + 1);   // it swims on the spot (always facing left, never a turn): a slow drift, the tail wags
function fishDraw(ctx, x, y, t) {   // a big carp, heading the way it swims (to the left when fx falls); the tail wags
  const dir = 1, wag = Math.sin(t * 5.2) * 0.32;
  ctx.save(); ctx.translate(x, y); ctx.scale(-dir, 1);   // dir +1 = swimming left (mirrored), -1 = right; through 0 it narrows like a fish turning
  ctx.rotate(0.06 * Math.sin(t * 0.8));
  ctx.fillStyle = '#d9692b'; ctx.save(); ctx.translate(-50, 0); ctx.rotate(wag); ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(-16, -22, -34, -26); ctx.quadraticCurveTo(-24, 0, -34, 26); ctx.quadraticCurveTo(-16, 22, 6, 0); ctx.fill(); ctx.restore();   // tail
  ctx.fillStyle = '#c85a22'; ctx.beginPath(); ctx.moveTo(-18, -14); ctx.quadraticCurveTo(0, -34, 22, -16); ctx.closePath(); ctx.fill();           // back fin
  const bg = ctx.createLinearGradient(0, -20, 0, 20); bg.addColorStop(0, '#d9692b'); bg.addColorStop(0.55, '#f0a04a'); bg.addColorStop(1, '#fbe3b0'); ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, 58, 20, 0, 0, 7); ctx.fill();   // body
  ctx.strokeStyle = 'rgba(150,60,20,0.35)'; ctx.lineWidth = 1.6; for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(-34 + j * 14 + (i % 2) * 7, -10 + i * 7, 6, 0.2, 2.9); ctx.stroke(); }   // scales
  ctx.fillStyle = '#c85a22'; ctx.beginPath(); ctx.moveTo(8, 10); ctx.quadraticCurveTo(0, 28, -14, 22); ctx.quadraticCurveTo(-4, 14, 8, 10); ctx.fill();    // side fin
  ctx.strokeStyle = 'rgba(120,50,15,0.6)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(34, 0, 17, -0.9, 0.9); ctx.stroke();                         // gill
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(46, -5, 6.2, 0, 7); ctx.fill(); ctx.fillStyle = '#1b130d'; ctx.beginPath(); ctx.arc(47.5, -5, 3.4, 0, 7); ctx.fill();   // eye
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(57, 4); ctx.quadraticCurveTo(52, 7, 48, 6); ctx.stroke();   // mouth
  ctx.restore();
}

function heartIcon(ctx, x, y, r) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#ff4b6e'; ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.7, -r * 1.2, 0, -r * 0.4); ctx.bezierCurveTo(r * 0.7, -r * 1.2, r * 1.5, -r * 0.1, 0, r * 0.9); ctx.fill(); ctx.restore(); }
function sparkIcon(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); [[0, -r], [r * 0.25, -r * 0.25], [r, 0], [r * 0.25, r * 0.25], [0, r], [-r * 0.25, r * 0.25], [-r, 0], [-r * 0.25, -r * 0.25]].forEach(([a, b], i) => (i ? ctx.lineTo(x + a, y + b) : ctx.moveTo(x + a, y + b))); ctx.closePath(); ctx.fill(); }

// ------------------------------------------------------------------ the card
// BẢN 3: the thread is ONE long list (ORDER) shown through a window. A "view" = which item sits at the top of the window + a scale. Between views the content scrolls (0.5 s) or, for the
// overview of the three identical replies, zooms out (scale 0.6) so the three right-aligned "Dạ, tuần sau con về ạ." are visibly lined up. The card is as tall as what the view needs.
// Returns { draw(ctx, t), reads, glowWins, ... }. All times from the times file T (nothing typed by hand).
export function makeCard(T) {
  const s = (id) => T.lines[id].t0, e = (id) => T.lines[id].t1;
  const PH = { w: 330, h: 222 };   // photo size
  const FS = 58, LH = (fs) => Math.round(fs * 1.2);
  const msgH = (lines, fs) => lines.length * LH(fs) + PAD_Y * 2 + 4;
  const REPLY = ['Dạ, tuần sau con về ạ.'];
  const A1 = s('p4'), A2 = s('p5'), A3 = s('p6'), OV = e('p6'), ZI = Math.max(s('p7') + 1.1, OV + 2.55);
  const IT = {
    b1: { k: 'msg', lines: ['Bận thì thôi,', 'không cần về đâu con.'], fs: 68, t: -1 },
    s1: { k: 'strip', t: e('l2'), type: [s('p2') + 0.1, s('p2') + 0.55], text: 'Mẹ nhớ.' },
    hoa: { k: 'photo', photo: 'hoa', lines: ['Bưởi ra hoa', 'rồi con.'], t: A1 + 0.2 },
    T1: { k: 'me', lines: REPLY, fs: FS, t: A1 + 0.85, rep: true },
    chin: { k: 'photo', photo: 'chin', lines: ['Bưởi chín', 'rồi con.'], t: A2 + 0.15 },
    T2: { k: 'me', lines: REPLY, fs: FS, t: A2 + 0.8, rep: true },
    rung: { k: 'photo', photo: 'rung', lines: ['Rụng gần hết', 'rồi con.'], t: A3 + 0.15 },
    T3: { k: 'me', lines: REPLY, fs: FS, t: A3 + 0.6, rep: true },
    Q: { k: 'me', lines: ['Mẹ khoẻ không ạ?'], fs: FS, t: s('m7') - 0.05 },
    A: { k: 'msg', lines: ['Mẹ khoẻ. Mẹ mua', 'con cá ngon.'], fs: FS, t: e('p8') - 0.1 },
    B: { k: 'msg', lines: ['Mà thôi. Mẹ kho', 'mặn, ăn dần.'], fs: FS, t: s('p9') + 0.75 },
    s10: { k: 'strip', t: s('p10') + 0.05, type: null, text: '' },
    teo: { k: 'me', lines: ['Mẹ đừng kho ạ.', 'Tối nay con về.'], fs: FS, t: e('p11') - 0.05 },
    D: { k: 'msg', lines: ['Ừ. Tuần sau cũng', 'được con ạ.'], fs: FS, t: s('p12') + 0.5 },
    T13: { k: 'me', lines: ['Tối nay ạ. Con ra', 'bến xe luôn đây.'], fs: FS, t: e('p13') - 0.05 },
    // mẹ types and deletes ("..." 1.2 on / 0.8 off / 1.2 on / 0.6 off / 0.8 on), then the message
    E: { k: 'msg', lines: ['Thế thì mẹ chưa kho.'], fs: FS, t: e('p14'), dots: [s('p14'), e('p14')], dw: [[0, 1.2], [2.0, 3.2], [3.8, 4.6]].map(([a, b]) => [s('p14') + a, s('p14') + b]) },
    ca: { k: 'photo', photo: 'ca', solo: true, t: s('p15') + 0.3 },
    co: { k: 'photo', photo: 'co', solo: true, t: e('p15') + 0.05 },
    G: { k: 'msg', lines: ['Bưởi còn một quả.', 'Mẹ để phần con.'], fs: FS, t: e('p15') + 0.4 },
  };
  const WORD = { b1: 'Bận thì thôi, không cần về đâu con.', hoa: 'Bưởi ra hoa rồi con.', T1: 'Dạ, tuần sau con về ạ.', chin: 'Bưởi chín rồi con.', T2: 'Dạ, tuần sau con về ạ.', rung: 'Rụng gần hết rồi con.', T3: 'Dạ, tuần sau con về ạ.', Q: 'Mẹ khoẻ không ạ?', A: 'Mẹ khoẻ. Mẹ mua con cá ngon.', B: 'Mà thôi. Mẹ kho mặn, ăn dần.', teo: 'Mẹ đừng kho ạ. Tối nay con về.', D: 'Ừ. Tuần sau cũng được con ạ.', T13: 'Tối nay ạ. Con ra bến xe luôn đây.', E: 'Thế thì mẹ chưa kho.', G: 'Bưởi còn một quả. Mẹ để phần con.', s1: 'Mẹ nhớ.' };
  const LABEL = 'DỊCH TIẾNG MẸ';
  const height = (it) => it.k === 'strip' ? 116 : it.k === 'photo' ? (it.solo ? PHB.h + 24 : PH.h + 24) : msgH(it.lines, it.fs);
  for (const it of Object.values(IT)) it.h = height(it);
  const ORDER = ['hoa', 'T1', 'chin', 'T2', 'rung', 'T3', 'Q', 'A', 'B', 's10', 'teo', 'D', 'T13', 'E', 'ca', 'co', 'G'];
  const POS = {}; { let y = 0; for (const id of ORDER) { POS[id] = y; y += IT[id].h + GEO.GAP; } }
  const arr = (id) => IT[id].dots ? IT[id].dots[0] : IT[id].t;
  // ---- views: when the window changes (top item, scale, duration of the move). Every gap between two views is >= 2.5 s.
  const VIEWS = [
    { t: A1, top: 'hoa', sc: 1, d: 0.5 }, { t: A2, top: 'T1', sc: 1, d: 0.5 }, { t: A3, top: 'T2', sc: 1, d: 0.5 },
    { t: OV, top: 'T1', sc: 0.6, d: 0.6 },                       // zoom out: the three replies lined up
    { t: ZI, top: 'rung', sc: 1, d: 0.6 },                       // zoom back in
    { t: IT.A.t, top: 'T3', sc: 1, d: 0.5 }, { t: IT.B.t, top: 'Q', sc: 1, d: 0.5 }, { t: IT.s10.t, top: 'A', sc: 1, d: 0.5 }, { t: IT.teo.t, top: 'B', sc: 1, d: 0.5 },
    { t: IT.D.t, top: 's10', sc: 1, d: 0.5 }, { t: IT.T13.t, top: 'D', sc: 1, d: 0.5 }, { t: IT.ca.t - 0.05, top: 'E', sc: 1, d: 0.5 }, { t: e('p15') - 0.1, top: 'co', sc: 1, d: 0.9 },
  ];
  const keyVal = (keys, t) => { let v = keys[0][1]; for (let i = 1; i < keys.length; i++) { const [ti, vi, di] = keys[i]; if (t < ti) break; v = t >= ti + di ? vi : lerp(v, vi, ease((t - ti) / di)); } return v; };
  const OFFK = [[-9, 0, 0.01], ...VIEWS.map((v) => [v.t, POS[v.top], v.d])], SCK = [[-9, 1, 0.01], ...VIEWS.map((v) => [v.t, v.sc, v.d])];
  // heights of the window (screen px): at each view start what the view will hold, and a small growth at every arrival inside a view
  const hNeed = (vi, t) => { const V = VIEWS[vi], top = POS[V.top]; let b = 0; for (const id of ORDER) if (arr(id) <= t + 0.3 && POS[id] >= top - 1 && POS[id] < top + GEO.MAXC / V.sc) b = Math.max(b, POS[id] + IT[id].h); return Math.min(GEO.MAXC, Math.max(0, (b - top) * V.sc)); };
  const HK = [[-9, IT.b1.h, 0.01], [IT.s1.t, IT.b1.h + GEO.GAP + IT.s1.h, 0.35]];
  { const ev = []; VIEWS.forEach((v, i) => ev.push({ t: v.t, i, d: v.d, view: true })); for (const id of ORDER) { const ta = arr(id); let vi = -1; VIEWS.forEach((v, i) => { if (ta >= v.t) vi = i; }); if (vi < 0 || VIEWS.some((v) => Math.abs(v.t - ta) < 0.32)) continue; ev.push({ t: ta, i: vi, d: 0.35, view: false }); }
    ev.sort((a, b) => a.t - b.t); for (const x of ev) HK.push([x.t, hNeed(x.i, x.t), x.d]); }
  const offAt = (t) => keyVal(OFFK, t), scAt = (t) => keyVal(SCK, t), hcAt = (t) => keyVal(HK, t);
  // the first move (from the opening two items to the thread) is a scroll of the whole content
  const SC1_GO = A1, SC1_D = 0.5, MAXC = GEO.MAXC;
  const appearK = (it, t) => clamp((t - it.t) / 0.22);
  const box = (t) => { const topK = ease((t - 2.95) / 0.42), top = lerp(GEO.TOP_HOOK, GEO.TOP, topK); return { top, H: GEO.HEAD + GEO.PADT + Math.max(70, hcAt(t)) + GEO.PADB }; };
  // ---- drawing (coordinates: x, y relative to the content window's top-left; the whole content may be scaled by sc about that corner)
  function bubble(ctx, it, id, x, y, t, o = {}) {   // x = left edge (mẹ) or right edge (me)
    const fs = it.fs ?? FS, k = it.dw && t < it.t ? Math.max(0, ...it.dw.map(([a, b]) => clamp((t - a) / 0.2) * clamp((b - t) / 0.15))) : it.dots && t < it.t ? clamp((t - it.dots[0]) / 0.2) : appearK(it, t), pk = back(k);
    if (k <= 0) return; const dots = it.dots && t < it.t;
    const lines = it.lines, wMax = Math.max(...lines.map((l) => { ctx.font = UIF(800, fs); return ctx.measureText(l).width; })), me = it.k === 'me';
    const w = dots ? fs * 3.1 : wMax + PAD_X * 2 + 6, h = dots ? fs * 1.55 : it.h, bx = me ? x - w : x;
    ctx.save(); ctx.globalAlpha *= clamp(k * 1.6) * (o.alpha ?? 1); const ax = x, ay = y + h; ctx.translate(ax, ay); ctx.scale(0.8 + 0.2 * pk, 0.8 + 0.2 * pk); ctx.translate(-ax, -ay);
    ctx.shadowColor = 'rgba(40,20,0,0.22)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = me ? GOLD : '#ffffff'; ctx.beginPath(); ctx.roundRect(bx, y, w, h, Math.min(38, h / 2)); ctx.fill(); ctx.shadowColor = 'transparent';
    if (o.pulse > 0) { ctx.strokeStyle = `rgba(255,120,30,${o.pulse})`; ctx.lineWidth = 9; ctx.beginPath(); ctx.roundRect(bx - 5, y - 5, w + 10, h + 10, Math.min(42, h / 2 + 5)); ctx.stroke(); }
    if (dots) { for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(110,100,90,${0.35 + 0.65 * Math.max(0, Math.sin(t * 7 - i * 0.9))})`; ctx.beginPath(); ctx.arc(bx + w / 2 + (i - 1) * fs * 0.62, y + h / 2, fs * 0.17, 0, 7); ctx.fill(); } }
    else { ctx.font = UIF(800, fs); ctx.fillStyle = me ? '#3a2600' : '#2a1d12'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; lines.forEach((l, i) => txt(ctx, l, bx + PAD_X + 3, y + PAD_Y + 2 + LH(fs) * (i + 0.5) + 2, fs)); }
    ctx.restore();
  }
  function photoBubble(ctx, it, x, y, t, o = {}) {
    const k = appearK(it, t); if (k <= 0) return; const pk = back(k), w = it.solo ? PHB.w + 24 : PH.w + 18 + 392 + 16, h = it.h;
    ctx.save(); ctx.globalAlpha *= clamp(k * 1.6) * (o.alpha ?? 1); ctx.translate(x, y + h); ctx.scale(0.8 + 0.2 * pk, 0.8 + 0.2 * pk); ctx.translate(-x, -(y + h));
    ctx.shadowColor = 'rgba(40,20,0,0.22)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 34); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.save(); ctx.translate(x + 12, y + 12); if (it.solo) PHOTOS[it.photo](ctx, PHB.w, PHB.h, t); else PHOTOS[it.photo](ctx, PH.w, PH.h); ctx.restore();
    if (it.solo) { ctx.restore(); return; }
    ctx.font = UIF(800, 52); ctx.fillStyle = '#2a1d12'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; const cx = x + 12 + PH.w + 22, n = it.lines.length; it.lines.forEach((l, i) => txt(ctx, l, cx, y + h / 2 + (i - (n - 1) / 2) * 62 + 2, 52));
    ctx.restore();
  }
  function strip(ctx, it, id, x, y, t) {
    const k = appearK(it, t); if (k <= 0) return; const pk = back(k), w = 760, h = it.h;
    ctx.save(); ctx.globalAlpha *= clamp(k * 1.6); ctx.translate(x, y + h); ctx.scale(0.85 + 0.15 * pk, 0.85 + 0.15 * pk); ctx.translate(-x, -(y + h));
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, BLUE); g.addColorStop(1, BLUE_D); ctx.shadowColor = 'rgba(20,50,130,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 30); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 29); ctx.stroke();
    const ty = it.type, typing = ty && t >= ty[0] && t < ty[1];
    sparkIcon(ctx, x + 40, y + 31, 15 + 3 * (typing ? 1 : 0), '#ff8a66'); ctx.font = UIF(900, 34); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; txt(ctx, LABEL, x + 70, y + 31, 34);
    const n = ty ? clamp((t - ty[0]) / (ty[1] - ty[0])) : 0, full = it.text, shown = full.slice(0, Math.round(n * full.length)); ctx.font = UIF(900, 64); ctx.fillStyle = '#ffffff';
    const tx = x + 30, tyy = y + 82; txt(ctx, shown, tx, tyy, 64); const cw = ctx.measureText(shown).width, blink = typing || (Math.floor(t / 0.45) % 2 === 0);
    if (blink) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(tx + cw + 6, tyy - 28, 9, 56, 3); ctx.fill(); }
    ctx.restore();
  }
  // positions (relative, logical px) of every item at time t; the opening pair (b1, s1) scrolls up and out as the thread scrolls in
  function place(t) {
    const out = {}, off = offAt(t), u = ease((t - SC1_GO) / SC1_D);
    out.b1 = 0 - MAXC * u; out.s1 = IT.b1.h + GEO.GAP - MAXC * u;
    for (const id of ORDER) out[id] = POS[id] - off + (u < 1 ? MAXC * (1 - u) : 0);
    return out;
  }
  // the three identical replies, lit one after the other while Bíp says "Ba cái tuần sau." (OV = the zoom-out)
  const pulseAt = (id, t) => { const t0 = OV + 0.7 + ['T1', 'T2', 'T3'].indexOf(id) * 0.32, u = (t - t0) / 0.45; return u > 0 && u < 1 ? Math.sin(Math.PI * u) * 0.9 : 0; };
  function draw(ctx, t) {
    const bx = box(t), H = bx.H, X = GEO.X, W = GEO.W, Y = bx.top, sc = scAt(t), hc = Math.max(70, hcAt(t));
    ctx.save(); ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; ctx.fillStyle = '#1b130d'; ctx.beginPath(); ctx.roundRect(X - 12, Y - 12, W + 24, H + 24, 62); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.roundRect(X, Y, W, H, 52); ctx.fillStyle = '#f6efe2'; ctx.fill(); ctx.save(); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(X, Y, W, GEO.HEAD); ctx.fillStyle = 'rgba(60,40,20,0.12)'; ctx.fillRect(X, Y + GEO.HEAD, W, 3);
    const ar = 28, ax = X + 36 + ar, ay = Y + GEO.HEAD / 2; ctx.fillStyle = '#e8506a'; ctx.beginPath(); ctx.arc(ax, ay, ar, 0, 7); ctx.fill(); ctx.fillStyle = '#3a2a3a'; ctx.beginPath(); ctx.arc(ax, ay - 5, 21, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#f6c3a8'; ctx.beginPath(); ctx.arc(ax, ay + 3, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a1d12'; ctx.textAlign = 'left'; ctx.font = UIF(900, 46); ctx.fillText('MẸ', ax + ar + 18, ay + 3); ctx.fillStyle = '#3ddc84'; ctx.beginPath(); ctx.arc(X + W - 52, ay, 9, 0, 7); ctx.fill();
    // content window (the clip is in screen px; the content is drawn in logical px about its top-left corner)
    const cy0 = Y + GEO.HEAD + GEO.PADT, winTop = Y + GEO.HEAD + 4; ctx.save(); ctx.beginPath(); ctx.rect(X, winTop, W, H); ctx.clip();
    ctx.translate(X, cy0); ctx.scale(sc, sc); CLIP_TOP = (winTop - cy0) / sc; CLIP_BOT = (Y + H - cy0) / sc;
    const Pl = place(t), xl = 26, xr = W / sc - 26, dim = clamp((1 - sc) / 0.4) * 0.55;
    for (const id of ['b1', 's1', ...ORDER]) { const it = IT[id], y = Pl[id]; if (y + it.h < CLIP_TOP || y > CLIP_BOT) continue; const al = it.rep ? 1 : 1 - dim;
      if (it.k === 'msg' || it.k === 'me') bubble(ctx, it, id, it.k === 'me' ? xr : xl, y, t, { alpha: al, pulse: it.rep ? pulseAt(id, t) : 0 }); else if (it.k === 'photo') photoBubble(ctx, it, xl, y, t, { alpha: al }); else if (it.k === 'strip') strip(ctx, it, id, xl, y, t); }
    ctx.restore();
    // soft fade where an older item leaves through the top edge
    const fg = ctx.createLinearGradient(0, winTop, 0, winTop + 34); fg.addColorStop(0, 'rgba(246,239,226,0.95)'); fg.addColorStop(1, 'rgba(246,239,226,0)'); ctx.fillStyle = fg; ctx.fillRect(X, winTop, W, 34);
    ctx.restore(); ctx.restore();
  }
  // ---- what the viewer must read: [arrival, the first view that moves it out of the window or shrinks the thread]
  const reads = [], R = (text, t0, t1) => reads.push({ text, t0, t1 });
  const END = T.dur;
  const leave = (id, ta) => { for (const v of VIEWS) { if (v.t <= ta) continue; if (id === 'b1' || id === 's1') return A1 + 0.25; if (POS[id] + IT[id].h <= POS[v.top] + 1) return v.t + 0.25; if (v.sc < 1) return v.t; } return END; };
  R('MẸ', 0, END);
  R(WORD.b1, 0.05, A1 + 0.25);
  for (const id of ORDER) { const it = IT[id]; if (it.solo || it.k === 'strip') continue; const t0 = it.t + 0.05; R(WORD[id], t0, leave(id, it.t)); }
  R(LABEL, IT.s1.t + 0.1, A1 + 0.25); R(WORD.s1, IT.s1.type[1], A1 + 0.25);
  R(LABEL, IT.s10.t + 0.1, leave('s10', IT.s10.t));
  // Bíp's spark glows while the one typing strip types (the glow follows the real spark through the camera)
  const glowWins = [[IT.s1.type[0] - 0.12, IT.s1.type[1] + 0.12]];
  return { draw, reads, glowWins, IT, POS, VIEWS, OV, ZI, A1, A2, A3, place, box, hcAt, offAt, scAt, HK };
}
