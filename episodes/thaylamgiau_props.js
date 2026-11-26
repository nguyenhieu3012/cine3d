// cine3d episode thaylamgiau ("Thầy Dạy Làm Giàu 4.0") — 2-D Illustrated "Imagine Diagram" overlay (v2 polished)
// Style: 2 characters talking below (stall, sharp, never dimmed), vivid animated thought-bubble diagram floating above.
// Zero empty whitespace: board dynamically zooms/pans across Steps 1 -> 2 -> 3 and expands downward for Step 4 Loop!
// Minimal text (1-3 short words per icon), zero overlapping icons, strict rules 2 safe-zone (y=186..786, all text y >= 228).

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = (x, c = 1.65) => { x = clamp(x); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const UIF = (w, s) => `${w} ${s}px UI, sans-serif`;

const INK = '#231a3d';
const CREAM = '#fff9ee';
const RED = '#e63946';
const CRIMSON = '#d62828';
const GOLD = '#ffb703';
const GOLD_D = '#e08e00';
const BLUE = '#3a86ff';
const TEAL = '#22a699';

function pill(ctx, x, y, w, h, bg, stroke, lw = 3, r = 14) {
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function sparkle(ctx, x, y, r, col = '#ffe45a') {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, d = i % 2 ? r * 0.28 : r;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

// Sleek cartoon red sports car (Porsche silhouette) + license plate + optional "THUÊ" windshield tag
function drawPorsche(ctx, cx, cy, sc, t, { plate = '30K-888', tag = false, glow = 0 } = {}) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(35,26,61,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 38, 108, 14, 0, 0, 7); ctx.fill();
  if (glow > 0) {
    ctx.fillStyle = `rgba(255,183,3,${0.25 * glow})`;
    ctx.beginPath(); ctx.ellipse(0, 6, 118, 52, 0, 0, 7); ctx.fill();
  }
  const bg = ctx.createLinearGradient(0, -34, 0, 34);
  bg.addColorStop(0, '#ff5964'); bg.addColorStop(0.55, RED); bg.addColorStop(1, '#b81d29');
  ctx.fillStyle = bg; ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-98, 22);
  ctx.quadraticCurveTo(-102, 2, -82, -2);
  ctx.lineTo(-48, -6);
  ctx.quadraticCurveTo(-24, -36, 16, -34);
  ctx.quadraticCurveTo(50, -32, 68, -6);
  ctx.quadraticCurveTo(98, -2, 100, 18);
  ctx.lineTo(96, 28); ctx.lineTo(-96, 28); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // cabin windshield
  const wg = ctx.createLinearGradient(-34, -30, 56, -4);
  wg.addColorStop(0, '#a8e6ff'); wg.addColorStop(1, '#4f86c6');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(-40, -6); ctx.quadraticCurveTo(-18, -29, 14, -28); ctx.quadraticCurveTo(42, -27, 56, -6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(6, -22); ctx.stroke();
  ctx.fillStyle = '#fff5b8'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.ellipse(-86, 6, 10, 6, -0.2, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9f1c';
  ctx.beginPath(); ctx.roundRect(84, 5, 13, 8, 3); ctx.fill(); ctx.stroke();
  for (const wx of [-56, 56]) {
    ctx.fillStyle = '#1f2430'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(wx, 26, 20, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e5e9f0';
    ctx.beginPath(); ctx.arc(wx, 26, 10, 0, 7); ctx.fill();
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(wx, 26, 3.5, 0, 7); ctx.fill();
  }
  if (tag) {
    ctx.save(); ctx.translate(-10, -16); ctx.rotate(-0.12);
    pill(ctx, -28, -12, 56, 24, GOLD, INK, 2.2, 5);
    ctx.fillStyle = INK; ctx.font = UIF(900, 12); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('THUÊ', 0, 1);
    ctx.restore();
  }
  if (plate) {
    pill(ctx, -56, 34, 112, 26, '#ffffff', INK, 2.6, 6);
    ctx.fillStyle = INK; ctx.font = UIF(900, 14); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(plate, 0, 48);
  }
  ctx.restore();
}

function drawGuru(ctx, x, y, sc, t, { flash = false, phone = true, hair = '#262133', phase = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.translate(0, Math.sin(t * 4.5 + phase) * 2);
  ctx.fillStyle = '#1e2230'; ctx.strokeStyle = INK; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.roundRect(-22, 12, 44, 38, [14, 14, 6, 6]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(-7, 13); ctx.lineTo(7, 13); ctx.lineTo(0, 32); ctx.closePath(); ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.beginPath(); ctx.moveTo(-3, 15); ctx.lineTo(3, 15); ctx.lineTo(0, 32); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd7ba'; ctx.strokeStyle = INK; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.arc(0, -4, 18, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(0, -10, 18, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(8, -28, -14, -18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#151822';
  ctx.beginPath(); ctx.roundRect(-14, -10, 12, 8, 2.5); ctx.roundRect(2, -10, 12, 8, 2.5); ctx.fill();
  ctx.strokeStyle = '#151822'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(2, -6); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 1, 6, 0.2, 2.5); ctx.stroke();
  if (phone) {
    ctx.fillStyle = '#2d3748'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(18, -4, 12, 20, 3); ctx.fill(); ctx.stroke();
    if (flash) {
      const f = Math.pow(Math.max(0, Math.sin(t * 7 + phase * 2.1)), 6);
      if (f > 0.15) sparkle(ctx, 24, -8, 12 + 12 * f, '#fff3a0');
    }
  }
  ctx.restore();
}

function drawMiniTeo(ctx, x, y, r, { shades = false, blazer = false } = {}) {
  ctx.save(); ctx.translate(x, y);
  if (blazer) {
    ctx.fillStyle = '#1d2233'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.roundRect(-r * 1.15, r * 0.65, r * 2.3, r * 1.15, [10, 10, 4, 4]); ctx.fill(); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(-3, r * 0.7); ctx.lineTo(3, r * 0.7); ctx.lineTo(0, r * 1.5); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#3f2e24'; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.75, r * 0.45, 0, 7); ctx.arc(r * 0.15, -r * 0.85, r * 0.5, 0, 7); ctx.arc(r * 0.52, -r * 0.68, r * 0.38, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff5eb'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
  if (shades) {
    ctx.fillStyle = '#141724';
    ctx.beginPath(); ctx.roundRect(-r * 0.72, -r * 0.25, r * 0.62, r * 0.42, 4); ctx.roundRect(r * 0.1, -r * 0.25, r * 0.62, r * 0.42, 4); ctx.fill();
    ctx.strokeStyle = '#ff595e'; ctx.lineWidth = 2.4;
    ctx.strokeRect(-r * 0.72, -r * 0.25, r * 0.62, r * 0.42); ctx.strokeRect(r * 0.1, -r * 0.25, r * 0.62, r * 0.42);
  } else {
    ctx.strokeStyle = '#ff595e'; ctx.lineWidth = Math.max(2.2, r * 0.14);
    ctx.beginPath(); ctx.arc(-r * 0.36, -r * 0.04, r * 0.31, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.36, -r * 0.04, r * 0.31, 0, 7); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(-r * 0.36, -r * 0.04, r * 0.11, 0, 7); ctx.arc(r * 0.36, -r * 0.04, r * 0.11, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, r * 0.3, r * 0.26, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

function drawVilla(ctx, cx, cy, sc, t) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
  ctx.fillStyle = '#4cc9f0'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-54, 24, 108, 22, 10); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-34, 34); ctx.lineTo(-10, 34); ctx.moveTo(8, 38); ctx.lineTo(36, 38); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.roundRect(-48, -26, 96, 54, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = BLUE;
  ctx.beginPath(); ctx.moveTo(-56, -24); ctx.lineTo(0, -52); ctx.lineTo(56, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#90e0ef';
  ctx.beginPath(); ctx.roundRect(-36, -14, 30, 26, 4); ctx.roundRect(6, -14, 30, 26, 4); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(44, -36);
  ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, 7); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  const a = t * 3.8;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// Open Book with ringing 05:00 Alarm Clock (drawn with crisp hands + generous padding) + steaming Warm Water Mug
function drawOpenBook(ctx, cx, cy, sc, t) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
  ctx.fillStyle = '#3a506b'; ctx.strokeStyle = INK; ctx.lineWidth = 3.8;
  ctx.beginPath(); ctx.roundRect(-108, -54, 216, 118, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(-98, -46, 96, 102, [8, 4, 4, 8]); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(2, -46, 96, 102, [4, 8, 8, 4]); ctx.fill(); ctx.stroke();
  // LEFT PAGE: vibrating red alarm clock showing 5:00 hands (pure visual icon — zero cramped tiny text!)
  ctx.save(); ctx.translate(-50, 2);
  ctx.rotate(Math.sin(t * 28) * 0.09);
  ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.arc(-20, -25, 10, 0, 7); ctx.arc(20, -25, 10, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.arc(0, 0, 29, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill();
  // clock ticks + hands pointing to 5:00
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -15); ctx.moveTo(0, 0); ctx.lineTo(8, 10); ctx.stroke();
  ctx.fillStyle = CRIMSON; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, 7); ctx.fill();
  ctx.restore();
  // RIGHT PAGE: warm water cup with rising steam
  ctx.save(); ctx.translate(50, 12);
  ctx.strokeStyle = '#6ec6ff'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const sx = i * 11, ph = t * 4 + i * 1.4;
    ctx.beginPath(); ctx.moveTo(sx, -24); ctx.quadraticCurveTo(sx + Math.sin(ph) * 6, -34, sx, -44); ctx.stroke();
  }
  ctx.strokeStyle = TEAL; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(20, -2, 10, -1.3, 1.3); ctx.stroke();
  ctx.fillStyle = '#48cae4'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-22, -20, 42, 38, [4, 4, 12, 12]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.roundRect(-16, -14, 8, 22, 4); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawMoneySack(ctx, cx, cy, sc, t) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
  const pulse = 1 + 0.03 * Math.sin(t * 5.2);
  ctx.scale(pulse, 1 / Math.sqrt(pulse));
  ctx.fillStyle = 'rgba(35,26,61,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 56, 56, 11, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4a261'; ctx.strokeStyle = INK; ctx.lineWidth = 3.8;
  ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(-30, -60); ctx.lineTo(0, -52); ctx.lineTo(30, -60); ctx.lineTo(20, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
  const sg = ctx.createRadialGradient(-16, -8, 6, 0, 10, 68);
  sg.addColorStop(0, '#ffe66d'); sg.addColorStop(0.55, GOLD); sg.addColorStop(1, GOLD_D);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(-22, -38);
  ctx.bezierCurveTo(-64, -14, -68, 48, -22, 54);
  ctx.lineTo(22, 54);
  ctx.bezierCurveTo(68, 48, 64, -14, 22, -38);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.roundRect(-24, -44, 48, 12, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = UIF(900, 26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('1,98 TỶ', 0, 12);
  sparkle(ctx, -46, -42, 9 + 3 * Math.sin(t * 6), '#ffe45a');
  sparkle(ctx, 48, -32, 8 + 3 * Math.cos(t * 5), '#ffe45a');
  ctx.restore();
}

function drawZoomGrid(ctx, cx, cy, sc, t, focusK) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
  pill(ctx, -78, -54, 156, 108, '#1b2236', INK, 3.6, 12);
  const cols = ['#74c0fc', '#b197fc', '#63e6be', '#ffa8a8', '#ffd43b', '#a9e34b'];
  const gw = 34, gh = 28, gx0 = -68, gy0 = -44;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = gx0 + c * (gw + 4), y = gy0 + r * (gh + 4);
      const isTeo = (r === 2 && c === 3);
      ctx.fillStyle = isTeo ? '#3d2c1e' : '#2a3450';
      ctx.beginPath(); ctx.roundRect(x, y, gw, gh, 5); ctx.fill();
      if (isTeo) {
        drawMiniTeo(ctx, x + gw / 2, y + gh / 2 + 1, 10.5, {});
      } else {
        ctx.fillStyle = cols[(r * 4 + c) % cols.length];
        ctx.beginPath(); ctx.arc(x + gw / 2, y + gh / 2 - 2, 6.2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.roundRect(x + gw / 2 - 9, y + gh / 2 + 5, 18, 8, 4); ctx.fill();
      }
    }
  }
  pill(ctx, -84, -66, 86, 28, BLUE, INK, 2.6, 8);
  ctx.fillStyle = '#ffffff'; ctx.font = UIF(900, 15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('×200', -41, -52);
  if (focusK > 0) {
    const tx = gx0 + 3 * (gw + 4) + gw / 2, ty = gy0 + 2 * (gh + 4) + gh / 2;
    const pr = 19 + 4 * Math.sin(t * 9);
    ctx.strokeStyle = CRIMSON; ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.arc(tx, ty, pr * back(focusK), 0, 7); ctx.stroke();
    if (focusK > 0.35) {
      const k2 = back((focusK - 0.35) / 0.65);
      ctx.save(); ctx.translate(tx + 12, ty + 6); ctx.scale(k2, k2);
      ctx.fillStyle = '#fff5eb'; ctx.strokeStyle = CRIMSON; ctx.lineWidth = 4.2;
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill(); ctx.stroke();
      drawMiniTeo(ctx, 0, 2, 16, {});
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawFlyingBill(ctx, x0, y0, cx, cy, x1, y1, u) {
  const m = 1 - u;
  const x = m * m * x0 + 2 * m * u * cx + u * u * x1;
  const y = m * m * y0 + 2 * m * u * cy + u * u * y1;
  const dx = 2 * m * (cx - x0) + 2 * u * (x1 - cx);
  const dy = 2 * m * (cy - y0) + 2 * u * (y1 - cy);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx));
  ctx.globalAlpha = Math.sin(Math.PI * u);
  pill(ctx, -16, -9, 32, 18, '#52b788', INK, 2.2, 3);
  ctx.fillStyle = '#d8f3dc'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
  ctx.restore();
}

function drawArrow(ctx, x0, y0, x1, y1, k, col = INK, lw = 5.5) {
  if (k <= 0.01) return;
  const u = ease(k), xe = x0 + (x1 - x0) * u, ye = y0 + (y1 - y0) * u;
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xe, ye); ctx.stroke();
  if (u > 0.7) {
    const ang = Math.atan2(y1 - y0, x1 - x0), hs = 14 * clamp((u - 0.7) / 0.3);
    ctx.beginPath();
    ctx.moveTo(xe, ye);
    ctx.lineTo(xe - hs * Math.cos(ang - 0.5), ye - hs * Math.sin(ang - 0.5));
    ctx.lineTo(xe - hs * Math.cos(ang + 0.5), ye - hs * Math.sin(ang + 0.5));
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawBulb(ctx, x, y, sc, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(255,214,10,0.35)';
  ctx.beginPath(); ctx.arc(0, -4, 24 + 3 * Math.sin(t * 10), 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe45a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.arc(0, -6, 14, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#adb5bd';
  ctx.beginPath(); ctx.roundRect(-7, 6, 14, 9, 3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.9 + (i * Math.PI * 0.8) / 4;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 18, -6 + Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 24, -6 + Math.sin(a) * 24); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ main Imagine Diagram controller
export function makeDiagram(T) {
  const s = (id) => T.lines[id].t0;
  const DUR = T.dur;
  const T_BOARD = 2.15;                  // board rises right after hook clears (2.10 s)
  const T_PLATE = s('p_plate');          // 6.27 s  — Node 1: 4 gurus / 1 Porsche
  const T_VILLA = s('p_villa');          // 11.07 s — Node 1+: Villa 350k/h
  const T_BOOK  = s('p_pdf');            // 16.31 s — Node 2: Open book 05:00 + water
  const T_STAMP = s('b8') + 0.12;        // 17.58 s — Crimson "0Đ" stamp slam!
  const T_ZOOM  = s('p_dip');            // 21.43 s — Node 3: 200 Zoom -> 1,98 TỶ sack
  const T_FOCUS = s('b10');              // 22.34 s — Red target zooms Tèo's face!
  const T_IDEA  = s('b12');              // 27.42 s — Lightbulb + Tèo F2 blazer
  const T_LOOP  = s('p_note');           // 29.47 s — Red return loop -> Porsche 30 phút!

  // Outer panel geometry: dynamically grows height (424 -> 596) so there is NEVER dead white space below!
  const BX = 64, BY = 186, BW = 952;

  function boardHeight(t) {
    const k4 = ease((t - (T_IDEA - 0.15)) / 0.45);
    return lerp(424, 598, k4);
  }

  // Dynamic inner camera inside the board: zooms tightly onto Step 1 -> Steps 1+2 -> Steps 1+2+3 -> Full 4-Step Loop!
  function innerCam(t, bh) {
    const k1 = ease((t - T_PLATE) / 0.4);
    const k2 = ease((t - T_BOOK)  / 0.45);
    const k3 = ease((t - T_ZOOM)  / 0.45);
    const k4 = ease((t - (T_IDEA - 0.15)) / 0.45);
    let sc = 1.0, cx = BW / 2, cy = 245;
    if (k1 > 0) {
      const sc1 = lerp(1.0, 1.06, k1), cx1 = lerp(BW / 2, 161, k1);
      const sc2 = lerp(sc1, 1.04, k2), cx2 = lerp(cx1, 319, k2);
      const sc3 = lerp(sc2, 1.0,  k3), cx3 = lerp(cx2, BW / 2, k3);
      sc = sc3; cx = cx3;
      cy = lerp(245, bh / 2 + 24, k4);
    }
    return { sc, cx, cy };
  }

  function drawCloudFrame(ctx, t, yTop, h) {
    const bt = Math.sin(t * 2.5) * 3;
    const dots = [[470, yTop + h + 22 + bt, 15], [442, yTop + h + 50 + bt * 0.7, 10], [424, yTop + h + 70, 6.5]];
    for (const [dx, dy, dr] of dots) {
      ctx.fillStyle = CREAM; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(dx, dy, dr, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = 'rgba(18,12,36,0.52)'; ctx.shadowBlur = 32; ctx.shadowOffsetY = 14;
    pill(ctx, BX, yTop, BW, h, CREAM, INK, 6, 44);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(BX + 4, yTop + 4, BW - 8, h - 8, 40); ctx.clip();
    ctx.fillStyle = 'rgba(120,96,64,0.11)';
    for (let gx = BX + 28; gx < BX + BW - 20; gx += 30) {
      for (let gy = yTop + 28; gy < yTop + h - 18; gy += 30) ctx.fillRect(gx, gy, 3.2, 3.2);
    }
    ctx.restore();
  }

  function draw(ctx, t) {
    ctx.save();

    // ---- PHASE 0 (0.0 .. 2.15 s): Dream bubble cleanly BELOW hook (hook y=342 -> ends ~418; bubble sits y=444..774)
    if (t < T_BOARD + 0.32) {
      const aIn = clamp(t / 0.22), aOut = t > T_BOARD ? 1 - ease((t - T_BOARD) / 0.32) : 1;
      const al = aIn * aOut;
      if (al > 0.01) {
        ctx.save(); ctx.globalAlpha = al;
        const cy = 620 + Math.sin(t * 2.6) * 5;
        ctx.save();
        ctx.shadowColor = 'rgba(18,12,36,0.45)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
        pill(ctx, 140, 446, 800, 326, 'rgba(255,249,238,0.97)', INK, 6, 46);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,214,10,0.17)';
        ctx.beginPath(); ctx.arc(540, cy - 6, 132 + 7 * Math.sin(t * 4), 0, 7); ctx.fill();
        drawPorsche(ctx, 470, cy + 8, 1.32, t, { plate: '30K-888', tag: true, glow: 0.7 });
        drawGuru(ctx, 745, cy - 8, 1.56, t, { flash: true, phase: 0.5 });
        sparkle(ctx, 240, 502, 15 + 4 * Math.sin(t * 7), GOLD);
        sparkle(ctx, 845, 496, 13 + 4 * Math.cos(t * 6), GOLD);
        pill(ctx, 336, 464, 408, 52, GOLD, INK, 4, 24);
        ctx.fillStyle = INK; ctx.font = UIF(900, 26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('KHÓA TƯ DUY · 9,9TR', 540, 491);
        ctx.restore();
      }
    }

    // ---- MAIN IMAGINE DIAGRAM (2.15 s .. DUR)
    if (t >= T_BOARD) {
      const kBoard = ease((t - T_BOARD) / 0.38);
      const bh = boardHeight(t);
      ctx.save();
      ctx.globalAlpha = kBoard;
      ctx.translate(BX + BW / 2, BY + bh / 2);
      const sb = 0.93 + 0.07 * back(kBoard);
      ctx.scale(sb, sb);
      ctx.translate(-(BX + BW / 2), -(BY + bh / 2));

      drawCloudFrame(ctx, t, BY, bh);

      // Header pill (text strictly y >= 230)
      pill(ctx, BX + 240, BY + 34, 472, 46, INK, null, 0, 23);
      ctx.fillStyle = '#ffe45a'; ctx.font = UIF(900, 24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SƠ ĐỒ THẦY LÀM GIÀU 4.0', BX + BW / 2, BY + 58);

      // Clip interior viewport below header so dynamic zoom/pan stays razor clean inside the cloud!
      const winTop = BY + 90, winH = bh - 104;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(BX + 8, winTop, BW - 16, winH, 30); ctx.clip();

      const kPlate = clamp((t - T_PLATE) / 0.42);
      const kVilla = clamp((t - T_VILLA) / 0.42);
      const kBook  = clamp((t - T_BOOK)  / 0.42);
      const kStamp = clamp((t - T_STAMP) / 0.28);
      const kZoom  = clamp((t - T_ZOOM)  / 0.45);
      const kFocus = clamp((t - T_FOCUS) / 0.42);
      const kIdea  = clamp((t - T_IDEA)  / 0.38);
      const kLoop  = clamp((t - T_LOOP)  / 0.55);

      const cam = innerCam(t, bh);
      // Center of visible content window
      const viewCX = BX + BW / 2, viewCY = winTop + winH / 2;
      ctx.translate(viewCX, viewCY);
      ctx.scale(cam.sc, cam.sc);
      ctx.translate(-(BX + cam.cx), -(BY + cam.cy));

      const col1X = BX + 161, col2X = BX + 476, col3X = BX + 791, rowY = BY + 226;

      // ===== STEP 1: RED PORSCHE + 4 CLONE GURUS + VILLA (ZERO OVERLAP!) =====
      if (kPlate <= 0) {
        drawPorsche(ctx, BX + BW / 2 - 70, rowY + 10, 1.24, t, { plate: '30K-888', tag: true, glow: 0.5 });
        drawGuru(ctx, BX + BW / 2 + 135, rowY - 8, 1.44, t, { flash: true, phase: 1.2 });
        pill(ctx, BX + BW / 2 - 150, rowY + 96, 300, 44, GOLD, INK, 3.5, 16);
        ctx.fillStyle = INK; ctx.font = UIF(900, 22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('XE THẦY ĐẤY?', BX + BW / 2, rowY + 119);
      } else {
        ctx.save();
        const pk = back(kPlate);
        pill(ctx, BX + 24, BY + 102, 274, 286, '#fff1f2', RED, 3.5, 24);
        pill(ctx, BX + 40, BY + 114, 146, 34, RED, INK, 2.8, 12);
        ctx.fillStyle = '#ffffff'; ctx.font = UIF(900, 17); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('1. THUÊ MỒI', BX + 113, BY + 132);

        // If Villa is active, shift the 4 clone Gurus smoothly left so Villa sits cleanly top-right with ZERO overlap!
        const kv = ease(kVilla);
        const gBaseX = col1X - 42 * kv;
        const gStep  = lerp(46, 35, kv);
        const gScale = lerp(0.68, 0.54, kv);
        for (let i = 0; i < 4; i++) {
          const gi = clamp((t - (T_PLATE + i * 0.08)) / 0.28);
          if (gi <= 0) continue;
          const gx = gBaseX + (i - 1.5) * gStep;
          const gy = rowY - 30 + (i === 1 || i === 2 ? -6 : 2);
          drawGuru(ctx, gx, gy, gScale * back(gi), t, { flash: true, phase: i * 1.4 });
        }

        // Villa pops cleanly in upper-right pocket beside the 4 Gurus!
        if (kVilla > 0) {
          const vk = back(kVilla);
          ctx.save(); ctx.translate(BX + 246, BY + 162); ctx.scale(vk, vk);
          pill(ctx, -44, -44, 88, 86, '#e0f2fe', BLUE, 2.8, 14);
          drawVilla(ctx, 0, -8, 0.52, t);
          pill(ctx, -42, 18, 84, 24, GOLD, INK, 2.2, 7);
          ctx.fillStyle = INK; ctx.font = UIF(900, 13.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('350K/H', 0, 31);
          ctx.restore();
        }

        drawPorsche(ctx, col1X, rowY + 38, 0.90 * pk, t, { plate: '30K-888', tag: true });
        pill(ctx, col1X - 110, rowY + 106, 220, 38, '#ffffff', INK, 3, 12);
        ctx.fillStyle = CRIMSON; ctx.font = UIF(900, 20); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('4 THẦY · 1 XE', col1X, rowY + 126);
        ctx.restore();
      }

      // ===== ARROW 1 -> 2 =====
      if (kBook > 0) drawArrow(ctx, BX + 302, BY + 244, BX + 334, BY + 244, kBook, INK, 6);

      // ===== STEP 2: OPEN BOOK (5:00 CLOCK + WATER MUG) + NON-OVERLAPPING "0Đ" SEAL =====
      if (kBook > 0) {
        const bk = back(kBook);
        ctx.save();
        ctx.translate(col2X, BY + 245); ctx.scale(bk, bk); ctx.translate(-col2X, -(BY + 245));
        pill(ctx, BX + 338, BY + 102, 276, 286, '#eff6ff', BLUE, 3.5, 24);
        pill(ctx, BX + 354, BY + 114, 152, 34, BLUE, INK, 2.8, 12);
        ctx.fillStyle = '#ffffff'; ctx.font = UIF(900, 17); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('2. SÁCH 9,9TR', BX + 430, BY + 132);

        drawOpenBook(ctx, col2X, rowY + 26, 0.98, t);

        // Spacious bottom badge
        pill(ctx, col2X - 118, rowY + 106, 236, 38, '#ffffff', INK, 3, 12);
        ctx.fillStyle = INK; ctx.font = UIF(900, 19); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('DẬY 5H · NƯỚC ẤM', col2X, rowY + 126);

        // Crisp crimson "0Đ" stamp lands neatly in TOP-RIGHT corner so Clock + Water Cup remain 100% visible!
        if (kStamp > 0) {
          const sk = 1.75 - 0.75 * back(kStamp, 2.0);
          ctx.save(); ctx.translate(BX + 556, BY + 152); ctx.rotate(-0.18); ctx.scale(sk, sk);
          ctx.globalAlpha = clamp(kStamp * 2);
          pill(ctx, -56, -28, 112, 56, 'rgba(255,255,255,0.96)', CRIMSON, 5, 12);
          ctx.fillStyle = CRIMSON; ctx.font = UIF(900, 26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('0Đ', 0, -8);
          ctx.font = UIF(900, 13);
          ctx.fillText('MẸ DẶN', 0, 15);
          ctx.restore();
        }
        ctx.restore();
      }

      // ===== ARROW 2 -> 3 =====
      if (kZoom > 0) drawArrow(ctx, BX + 618, BY + 244, BX + 650, BY + 244, kZoom, GOLD_D, 7);

      // ===== STEP 3 (TWIST): 200 ZOOM GRID (TÈO CIRCLED RED) -> FLYING CASH -> 1,98 TỶ SACK =====
      if (kZoom > 0) {
        const zk = back(kZoom);
        ctx.save();
        ctx.translate(col3X, BY + 245); ctx.scale(zk, zk); ctx.translate(-col3X, -(BY + 245));
        pill(ctx, BX + 654, BY + 102, 274, 286, '#fffbeb', GOLD_D, 4, 24);
        pill(ctx, BX + 670, BY + 114, 166, 34, GOLD, INK, 2.8, 12);
        ctx.fillStyle = INK; ctx.font = UIF(900, 17); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('3. TIỀN TỶ ĐÂY!', BX + 753, BY + 132);

        drawZoomGrid(ctx, col3X - 42, rowY - 12, 0.80, t, kFocus);
        drawMoneySack(ctx, col3X + 68, rowY + 34, 0.86, t);

        for (let i = 0; i < 4; i++) {
          const u = ((t - T_ZOOM) * 0.95 + i * 0.25) % 1;
          if (u >= 0) drawFlyingBill(ctx, col3X - 18, rowY - 10, col3X + 34, rowY - 58, col3X + 62, rowY - 6, u);
        }

        // Spacious dark equation chip
        pill(ctx, col3X - 122, rowY + 106, 244, 38, INK, null, 0, 12);
        ctx.fillStyle = '#ffe45a'; ctx.font = UIF(900, 19); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('200 × 9,9TR = 1,98 TỶ', col3X, rowY + 126);
        ctx.restore();
      }

      // ===== STEP 4 (PAYOFF): MINIMAL-TEXT F2 CARD + RED ANIMATED LOOP BACK TO PORSCHE! =====
      if (kIdea > 0) {
        const ik = back(kIdea);
        const f2X = BX + 668, f2Y = BY + 492;
        ctx.save();
        drawArrow(ctx, col3X, BY + 392, col3X, BY + 426, kIdea, CRIMSON, 6);

        ctx.save(); ctx.translate(f2X, f2Y); ctx.scale(ik, ik); ctx.translate(-f2X, -f2Y);
        pill(ctx, BX + 412, BY + 430, 516, 128, '#ffe5ec', CRIMSON, 4.2, 26);
        drawBulb(ctx, BX + 478, BY + 448, 0.88, t);
        drawMiniTeo(ctx, BX + 478, BY + 496, 28, { shades: true, blazer: true });
        pill(ctx, BX + 536, BY + 448, 174, 34, CRIMSON, INK, 2.6, 11);
        ctx.fillStyle = '#ffffff'; ctx.font = UIF(900, 17); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('4. VÒNG LẶP F2', BX + 623, BY + 466);
        pill(ctx, BX + 728, BY + 446, 174, 38, GOLD, INK, 3, 12);
        ctx.fillStyle = INK; ctx.font = UIF(900, 22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('499K!', BX + 815, BY + 466);
        ctx.fillStyle = INK; ctx.font = UIF(900, 31); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('CHỐNG LÙA GÀ', BX + 536, BY + 518);
        ctx.restore();

        if (kLoop > 0) {
          const lu = ease(kLoop);
          ctx.save();
          ctx.strokeStyle = CRIMSON; ctx.lineWidth = 7.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 70;
          ctx.beginPath();
          ctx.moveTo(BX + 408, BY + 496);
          ctx.lineTo(BX + 178, BY + 496);
          ctx.quadraticCurveTo(BX + 152, BY + 496, BX + 152, BY + 470);
          ctx.lineTo(BX + 152, BY + 470 - 74 * lu);
          ctx.stroke();
          ctx.setLineDash([]);
          if (lu > 0.7) {
            const ay = BY + 470 - 74 * lu;
            ctx.fillStyle = CRIMSON;
            ctx.beginPath(); ctx.moveTo(BX + 152, ay - 8); ctx.lineTo(BX + 138, ay + 14); ctx.lineTo(BX + 166, ay + 14); ctx.closePath(); ctx.fill();
          }
          const lk = back(clamp((kLoop - 0.2) / 0.8));
          ctx.save(); ctx.translate(BX + 266, BY + 496); ctx.scale(lk, lk);
          pill(ctx, -132, -26, 264, 52, CRIMSON, INK, 3.8, 22);
          ctx.fillStyle = '#ffe45a'; ctx.font = UIF(900, 21); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('↺ THUÊ XE 30 PHÚT', 0, 1);
          ctx.restore();
          ctx.restore();
        }
        ctx.restore();
      }

      ctx.restore(); // end inner viewport clip
      ctx.restore(); // end board transform
    }
    ctx.restore();
  }

  const reads = [
    { text: 'KHÓA TƯ DUY · 9,9TR', t0: 0.1, t1: T_BOARD },
    { text: 'SƠ ĐỒ THẦY LÀM GIÀU 4.0', t0: T_BOARD + 0.2, t1: DUR },
    { text: '4 THẦY · 1 XE', t0: T_PLATE + 0.2, t1: DUR },
    { text: '350K/H', t0: T_VILLA + 0.2, t1: DUR },
    { text: '0Đ', t0: T_STAMP + 0.15, t1: DUR },
    { text: '200 × 9,9TR = 1,98 TỶ', t0: T_ZOOM + 0.2, t1: DUR },
    { text: '499K!', t0: T_IDEA + 0.2, t1: DUR },
    { text: '↺ THUÊ XE 30 PHÚT', t0: T_LOOP + 0.2, t1: DUR },
  ];

  return { draw, reads };
}
