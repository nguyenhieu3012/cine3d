// cine3d core: Reusable Visual Presentation & 2-D Diagram Engine (v3.0, 26/11/2026).
// Incorporates proven YouTube 2026 visual storytelling patterns:
//   - Vox / Johnny Harris: 12fps "on twos" stutter (`stutter: 12`), paper-cutout sticker rim (`cutout: true`),
//     subtle tactile paper grain, animated highlighter sweep, red-string detective corkboard.
//   - Kurzgesagt / Mayer-Fiorella: semantic fixed color palette, temporal contiguity (each step pops on beat),
//     non-redundancy (1-3 word crisp labels + big numbers, never duplicating spoken sentences).
//   - Tifo Football / ESPN Broadcast: tactical pitch diagram (`layout: 'tactics'`) + broadcast `statCard`.
//   - Responsive 9:16 (floats cleanly at y=186..786 above cast heads, x=54..890 clear of right platform UI)
//     and 16:9 (wide presentation panel).
// Pure functions of `t` (Law 1: deterministic, stateless, zero per-frame DOM allocations).
import { clamp, easeOut, lerp, overshoot, hash } from './util.js';
import { getMedia } from './media.js';

const DISP = 'Display, sans-serif';
const UI = 'UI, sans-serif';
const TAU = Math.PI * 2;

function fitText(ctx, text, maxW, size, weight = 900, min = 14, fam = DISP) {
  let s = size;
  const str = String(text ?? '');
  for (; s > min; s -= 2) {
    ctx.font = `${weight} ${s}px ${fam}`;
    if (ctx.measureText(str).width <= maxW) break;
  }
  ctx.font = `${weight} ${s}px ${fam}`;
  return s;
}

function wrapLines(ctx, text, maxW) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = cur + ' ' + words[i];
    if (ctx.measureText(test).width <= maxW) cur = test;
    else { lines.push(cur); cur = words[i]; }
  }
  lines.push(cur);
  return lines;
}

const PAL = {
  ink: '#231a3d',
  cream: '#fff9ee',
  dark: '#141129',
  red: '#e63946',
  crimson: '#d62828',
  gold: '#ffb703',
  goldD: '#d98a00',
  yellow: '#ffe45a',
  blue: '#3a86ff',
  cyan: '#6ecbff',
  teal: '#22a699',
  green: '#22c55e',
  cork: '#d7ae7e',
  pitch: '#1b6e3c',
};

const stepTime = (t, fps) => (fps && fps > 0 ? Math.floor(t * fps) / fps : t);
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const popBack = (x, c = 1.55) => { x = clamp(x); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

function metrics(ctx) {
  const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920, wide = CW > CH;
  // In 9:16, keep center x around 472 (54..890) so right UI zone x > 900 stays clean!
  const cx = wide ? CW * 0.5 : 472;
  const maxW = wide ? 1560 : 832;
  return { CW, CH, wide, cx, maxW };
}

function pill(ctx, x, y, w, h, bg, stroke = null, lw = 3, r = 14) {
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// Deterministic subtle paper-grain dots (Vox handmade editorial feel, zero texture allocation)
function drawPaperDots(ctx, x, y, w, h, alpha = 0.045, dark = false) {
  ctx.save();
  ctx.fillStyle = dark ? `rgba(255,255,255,${alpha})` : `rgba(35,26,61,${alpha})`;
  for (let i = 0; i < 42; i++) {
    const px = x + hash(i * 17.3 + 1.1) * w;
    const py = y + hash(i * 29.7 + 4.3) * h;
    const r = 1.1 + hash(i * 7.9) * 1.6;
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Draw a preloaded sticker image with optional Vox white paper-cutout rim + drop shadow + 12fps micro-wobble
const _rimCache = new WeakMap();
function getCutoutCanvas(im) {
  if (!im || typeof document === 'undefined') return null;
  if (_rimCache.has(im)) return _rimCache.get(im);
  const pad = 16, w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
  if (!w || !h) return null;
  const cv = document.createElement('canvas');
  cv.width = w + pad * 2; cv.height = h + pad * 2;
  const c = cv.getContext('2d');
  // Build crisp white paper cutout rim using 12-direction radial stamp of alpha silhouette
  const sil = document.createElement('canvas');
  sil.width = w; sil.height = h;
  const sc = sil.getContext('2d');
  sc.drawImage(im, 0, 0);
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = '#ffffff';
  sc.fillRect(0, 0, w, h);
  const rad = Math.max(6, Math.round(Math.min(w, h) * 0.024));
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    c.drawImage(sil, pad + Math.cos(a) * rad, pad + Math.sin(a) * rad);
  }
  c.drawImage(im, pad, pad);
  _rimCache.set(im, cv);
  return cv;
}

export function drawStickerImg(ctx, ref, cx, cy, maxSize, t, opts = {}) {
  const im = getMedia(ref, 'sticker');
  if (!im) return false;
  const ts = stepTime(t, opts.stutter ?? 12);
  const wob = opts.wobble !== false ? Math.sin(ts * 3.8 + (opts.seed || 0)) * (opts.wobbleAmp ?? 0.032) : 0;
  const src = opts.cutout !== false ? (getCutoutCanvas(im) || im) : im;
  const iw = src.width || src.naturalWidth, ih = src.height || src.naturalHeight;
  const sc = maxSize / Math.max(1, Math.max(iw, ih));
  const dw = iw * sc, dh = ih * sc;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((opts.rot || 0) + wob);
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(16,12,34,0.34)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
  }
  ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  return true;
}

// Animated highlighter sweep (Vox Technique #4)
function drawHighlighterBar(ctx, x, y, w, h, progress, color = 'rgba(255,228,90,0.85)') {
  const p = easeOut(clamp(progress));
  if (p <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(8, w * p), h, 8);
  ctx.fill();
  ctx.restore();
}

function drawArrow(ctx, x1, y1, x2, y2, progress, color = PAL.ink, lw = 6, dashed = false, t = 0) {
  const p = smooth(progress);
  if (p <= 0.01) return;
  const ex = lerp(x1, x2, p), ey = lerp(y1, y2, p);
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  if (dashed) { ctx.setLineDash([12, 9]); ctx.lineDashOffset = -t * 55; }
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.setLineDash([]);
  if (p > 0.65) {
    const ang = Math.atan2(y2 - y1, x2 - x1), hl = lw * 2.2;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(ang - 0.55) * hl, ey - Math.sin(ang - 0.55) * hl);
    ctx.lineTo(ex - Math.cos(ang + 0.55) * hl, ey - Math.sin(ang + 0.55) * hl);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawStampSeal(ctx, cx, cy, text, sub, progress, color = PAL.crimson) {
  const p = clamp(progress);
  if (p <= 0) return;
  const sc = lerp(1.85, 1, popBack(p, 1.9));
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-0.16); ctx.scale(sc, sc);
  ctx.globalAlpha = clamp(p * 2.2);
  const w = Math.max(114, text.length * 19 + 34), h = sub ? 62 : 44;
  pill(ctx, -w / 2, -h / 2, w, h, 'rgba(255,255,255,0.96)', color, 5, 12);
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitText(ctx, text, w - 18, 28, 900, 16, UI);
  ctx.fillText(text, 0, sub ? -9 : 1);
  if (sub) {
    fitText(ctx, sub, w - 18, 14, 900, 11, UI);
    ctx.fillText(sub, 0, 15);
  }
  ctx.restore();
}

// Shared editorial board container (floating thought-cloud / broadcast card)
function beginBoardShell(ctx, o, t) {
  const { wide, cx, maxW } = metrics(ctx);
  const kIn = easeOut((t - o.t0) / 0.28), kOut = clamp((o.t1 - t) / 0.22), k = kIn * kOut;
  if (k <= 0) return null;
  const W = Math.min(o.w ?? maxW, maxW);
  const H = o.h ?? (wide ? 540 : 540);
  const topY = o.y != null ? o.y - H / 2 : (wide ? 110 : 216);
  const bx = (o.x ?? cx) - W / 2, by = topY;
  const style = o.style || (o.layout === 'corkboard' ? 'cork' : o.layout === 'tactics' ? 'pitch' : 'cream');
  const dark = style === 'dark' || style === 'pitch';

  ctx.save();
  ctx.globalAlpha = clamp(k * 1.4);
  const sc = lerp(0.92, 1, kIn);
  ctx.translate(bx + W / 2, by + H / 2 + (1 - kIn) * 20);
  ctx.scale(sc, sc);
  ctx.translate(-(bx + W / 2), -(by + H / 2));

  // Optional thought-bubble trail dots pointing down to speaking cast
  if (o.thoughtDots && !wide) {
    const dotX = bx + W * 0.38;
    [[14, 15], [34, 11], [52, 7]].forEach(([dy, r], idx) => {
      const dk = clamp((t - o.t0 - idx * 0.06) / 0.16);
      if (dk <= 0) return;
      ctx.fillStyle = dark ? '#1f1b3a' : PAL.cream;
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(dotX - idx * 14, by + H + dy, r * dk, 0, TAU); ctx.fill(); ctx.stroke();
    });
  }

  // Board shell
  ctx.shadowColor = 'rgba(10,8,24,0.44)'; ctx.shadowBlur = 32; ctx.shadowOffsetY = 12;
  const bg = style === 'dark' ? 'rgba(18,15,38,0.96)'
    : style === 'cork' ? '#d7ae7e'
    : style === 'pitch' ? '#175e33'
    : 'rgba(255,249,238,0.97)';
  const rim = o.accent || (style === 'dark' ? PAL.yellow : style === 'cork' ? '#6d4423' : style === 'pitch' ? '#ffffff' : PAL.ink);
  pill(ctx, bx, by, W, H, bg, rim, 5, 30);
  ctx.shadowColor = 'transparent';
  if (o.paper !== false && style !== 'pitch') drawPaperDots(ctx, bx + 12, by + 12, W - 24, H - 24, dark ? 0.04 : 0.05, dark);

  // Header strip
  let bodyY = by + 22;
  if (o.title) {
    const hh = 56;
    const hBg = o.headerColor || (dark ? 'rgba(255,255,255,0.08)' : PAL.ink);
    pill(ctx, bx + 20, by + 16, W - 40, hh, hBg, null, 0, 18);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, o.title, W - 96, 30, 900, 18, DISP);
    ctx.fillStyle = o.titleColor || (dark ? PAL.yellow : '#ffffff');
    ctx.fillText(o.title, bx + W / 2, by + 16 + hh / 2 + 1);
    bodyY = by + 16 + hh + 16;
  }

  return { bx, by, W, H, bodyY, bodyH: by + H - bodyY - 18, style, dark, k };
}

// =========================================================================
// LAYOUT 1: FLOW / CYCLE DIAGRAM (upgraded from thaylamgiau, 10x less code!)
// =========================================================================
function renderFlow(ctx, o, t, B) {
  const ts = stepTime(t, o.stutter ?? 12);
  const steps = (o.steps || []).slice(0, 4);
  if (!steps.length) return;
  const hasLoop = !!o.loop && t >= (o.loop.at ?? 1e9);
  const pad = 22, innerW = B.W - pad * 2;
  const n = steps.length;
  const gap = n >= 4 ? 14 : 22;
  const cardW = (innerW - gap * (n - 1)) / n;
  const loopH = o.loop ? 96 : 0;
  const cardH = Math.min(340, B.bodyH - loopH - (o.loop ? 18 : 0));
  const topY = B.bodyY + (B.bodyH - (cardH + (hasLoop ? loopH + 16 : 0))) * 0.5;

  // Dynamic focus zoom toward active step if autoZoom !== false and <= 3 steps active
  const visible = steps.filter((s) => t >= (s.t ?? o.t0));
  const visCount = Math.max(1, visible.length);

  ctx.save();
  ctx.beginPath(); ctx.roundRect(B.bx + 6, B.bodyY - 6, B.W - 12, B.bodyH + 12, 22); ctx.clip();

  steps.forEach((st, i) => {
    const tPop = st.t ?? o.t0;
    if (t < tPop) return;
    const kp = popBack((t - tPop) / 0.28);
    // Center currently revealed cards cleanly so there's zero awkward empty right void!
    const totalVisW = visCount * cardW + (visCount - 1) * gap;
    const startX = B.bx + (B.W - totalVisW) / 2;
    const x = startX + i * (cardW + gap);
    const cx = x + cardW / 2, cy = topY + cardH / 2;

    if (i > 0) {
      const ak = (t - tPop) / 0.22;
      drawArrow(ctx, x - gap + 2, cy, x - 3, cy, ak, st.accent || (B.dark ? PAL.yellow : PAL.ink), 5.5, false, ts);
    }

    ctx.save();
    ctx.translate(cx, cy); ctx.scale(kp, kp); ctx.translate(-cx, -cy);
    const acc = st.accent || [PAL.red, PAL.blue, PAL.goldD, PAL.crimson][i % 4];
    const cardBg = B.dark ? 'rgba(255,255,255,0.08)' : '#ffffff';
    pill(ctx, x, topY, cardW, cardH, cardBg, acc, 4, 22);

    // Step badge
    const badgeTxt = st.badge || `${i + 1}. ${st.title || ''}`.trim();
    pill(ctx, x + 12, topY + 12, cardW - 24, 38, acc, PAL.ink, 2.5, 11);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, badgeTxt, cardW - 38, 19, 900, 13, UI);
    ctx.fillStyle = acc === PAL.gold || acc === PAL.yellow ? PAL.ink : '#ffffff';
    ctx.fillText(badgeTxt, cx, topY + 32);

    // Center visual: Gemini sticker image (preferred!) or bold icon/number hero
    const artY = topY + 56 + (cardH - 126) / 2;
    const artMax = Math.min(cardW - 34, cardH - 128, 180);
    const drewImg = st.sticker ? drawStickerImg(ctx, st.sticker, cx, artY, artMax, t, { stutter: o.stutter ?? 12, cutout: o.cutout !== false, seed: i * 3.1 }) : false;
    if (!drewImg && st.hero) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fitText(ctx, st.hero, cardW - 28, 56, 900, 26, DISP);
      ctx.fillStyle = B.dark ? '#ffffff' : PAL.ink;
      ctx.fillText(st.hero, cx, artY);
    }

    // Bottom short caption pill (with optional Vox highlighter sweep)
    if (st.caption) {
      const capY = topY + cardH - 54;
      if (st.highlightAt != null && t >= st.highlightAt) {
        drawHighlighterBar(ctx, x + 12, capY, cardW - 24, 40, (t - st.highlightAt) / 0.24, 'rgba(255,228,90,0.92)');
      } else {
        pill(ctx, x + 12, capY, cardW - 24, 40, st.darkCaption ? PAL.ink : (B.dark ? 'rgba(255,255,255,0.12)' : '#f4f0ff'), PAL.ink, 2.5, 11);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fitText(ctx, st.caption, cardW - 36, 20, 900, 13, UI);
      ctx.fillStyle = st.darkCaption && !(st.highlightAt != null && t >= st.highlightAt) ? PAL.yellow : (B.dark && !(st.highlightAt != null && t >= st.highlightAt) ? '#ffffff' : PAL.ink);
      ctx.fillText(st.caption, cx, capY + 21);
    }

    // Optional crimson stamp slam on this step
    if (st.stamp && t >= (st.stamp.at ?? 1e9)) {
      drawStampSeal(ctx, x + cardW - 62, topY + 66, st.stamp.text, st.stamp.sub, (t - st.stamp.at) / 0.22, st.stamp.color || PAL.crimson);
    }
    ctx.restore();
  });

  // Animated Loop-back arrow & badge (Step N -> Step 1)
  if (hasLoop) {
    const lk = smooth((t - o.loop.at) / 0.35);
    const ly = topY + cardH + 54;
    const totalVisW = visCount * cardW + (visCount - 1) * gap;
    const startX = B.bx + (B.W - totalVisW) / 2;
    const xR = startX + totalVisW - cardW / 2, xL = startX + cardW / 2;
    ctx.save();
    ctx.strokeStyle = o.loop.color || PAL.crimson; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.setLineDash([15, 10]); ctx.lineDashOffset = -ts * 68;
    ctx.beginPath();
    ctx.moveTo(xR, topY + cardH + 6);
    ctx.lineTo(xR, ly);
    ctx.lineTo(lerp(xR, xL, lk), ly);
    if (lk > 0.85) ctx.lineTo(xL, lerp(ly, topY + cardH + 14, (lk - 0.85) / 0.15));
    ctx.stroke();
    ctx.setLineDash([]);
    const lp = popBack((t - o.loop.at - 0.1) / 0.25);
    const bw = Math.min(B.W - 120, Math.max(280, (o.loop.label || '').length * 16 + 56));
    ctx.translate(B.bx + B.W / 2, ly); ctx.scale(lp, lp);
    pill(ctx, -bw / 2, -26, bw, 52, o.loop.color || PAL.crimson, PAL.ink, 3.5, 22);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, o.loop.label || '↺ VÒNG LẶP', bw - 28, 24, 900, 15, UI);
    ctx.fillStyle = PAL.yellow;
    ctx.fillText(o.loop.label || '↺ VÒNG LẶP', 0, 1);
    ctx.restore();
  }
  ctx.restore();
}

// =========================================================================
// LAYOUT 2: COMPARE / VS BOARD (Vertical-first stack OR Side-by-side)
// =========================================================================
function renderCompare(ctx, o, t, B) {
  const left = o.left || { title: 'A', accent: PAL.red, rows: [] };
  const right = o.right || { title: 'B', accent: PAL.blue, rows: [] };
  const stack = o.stack === true;
  const pad = 20, gap = 18;
  const cols = [
    stack
      ? { data: left, x: B.bx + pad, y: B.bodyY, w: B.W - pad * 2, h: (B.bodyH - gap) / 2 }
      : { data: left, x: B.bx + pad, y: B.bodyY, w: (B.W - pad * 2 - gap) / 2, h: B.bodyH },
    stack
      ? { data: right, x: B.bx + pad, y: B.bodyY + (B.bodyH - gap) / 2 + gap, w: B.W - pad * 2, h: (B.bodyH - gap) / 2 }
      : { data: right, x: B.bx + pad + (B.W - pad * 2 - gap) / 2 + gap, y: B.bodyY, w: (B.W - pad * 2 - gap) / 2, h: B.bodyH },
  ];

  cols.forEach(({ data, x, y, w, h }, ci) => {
    const tCol = data.t ?? o.t0;
    if (t < tCol) return;
    const k = popBack((t - tCol) / 0.25);
    const acc = data.accent || (ci === 0 ? PAL.red : PAL.blue);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.translate(-(x + w / 2), -(y + h / 2));
    pill(ctx, x, y, w, h, B.dark ? 'rgba(255,255,255,0.07)' : '#ffffff', acc, 4, 22);
    // Header bar
    pill(ctx, x + 12, y + 12, w - 24, 48, acc, PAL.ink, 2.5, 13);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, data.title || '', w - 42, 26, 900, 16, DISP);
    ctx.fillStyle = acc === PAL.gold || acc === PAL.yellow ? PAL.ink : '#ffffff';
    ctx.fillText(data.title || '', x + w / 2, y + 37);

    // Optional sticker inside column
    let ry = y + 72;
    if (data.sticker) {
      const sz = stack ? Math.min(100, h - 84) : Math.min(130, w * 0.42);
      drawStickerImg(ctx, data.sticker, stack ? x + 76 : x + w / 2, stack ? y + 66 + (h - 72) / 2 : ry + sz / 2, sz, t, { stutter: o.stutter ?? 12, cutout: o.cutout !== false, seed: ci * 5 });
      if (!stack) ry += sz + 14;
    }

    const rowX = stack && data.sticker ? x + 146 : x + 16;
    const rowW = stack && data.sticker ? w - 162 : w - 32;
    const rows = data.rows || [];
    const rowH = Math.min(62, Math.max(40, (y + h - ry - 14) / Math.max(1, rows.length) - 8));
    rows.forEach((r, ri) => {
      const tr = r.t ?? tCol + ri * 0.15;
      if (t < tr) return;
      const rk = easeOut((t - tr) / 0.2);
      const yy = ry + ri * (rowH + 8);
      ctx.save();
      ctx.globalAlpha *= rk;
      ctx.translate(0, (1 - rk) * 12);
      if (r.highlight) drawHighlighterBar(ctx, rowX, yy, rowW, rowH, (t - tr) / 0.25, 'rgba(255,228,90,0.88)');
      else pill(ctx, rowX, yy, rowW, rowH, B.dark ? 'rgba(255,255,255,0.1)' : '#f7f5ff', 'rgba(35,26,61,0.14)', 2, 12);

      // Status badge (✓ / ✗)
      let tx = rowX + 14;
      if (r.ok === true || r.ok === false) {
        const sc = r.ok ? PAL.green : PAL.crimson;
        pill(ctx, rowX + 10, yy + rowH / 2 - 15, 30, 30, sc, null, 0, 15);
        ctx.fillStyle = '#ffffff'; ctx.font = `900 20px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(r.ok ? '✓' : '✗', rowX + 25, yy + rowH / 2 + 1);
        tx = rowX + 48;
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const valSpace = r.val != null ? 92 : 8;
      fitText(ctx, r.text || '', rowW - (tx - rowX) - valSpace, 24, 800, 14, UI);
      ctx.fillStyle = r.highlight ? PAL.ink : (B.dark ? '#ffffff' : PAL.ink);
      ctx.fillText(r.text || '', tx, yy + rowH / 2 + 1);
      if (r.val != null) {
        ctx.textAlign = 'right';
        fitText(ctx, String(r.val), 88, 26, 900, 16, DISP);
        ctx.fillStyle = r.highlight ? PAL.crimson : acc;
        ctx.fillText(String(r.val), rowX + rowW - 12, yy + rowH / 2 + 1);
      }
      ctx.restore();
    });
    ctx.restore();
  });

  // Center VS badge
  if (o.vs !== false) {
    const vk = popBack((t - o.t0 - 0.1) / 0.26);
    ctx.save();
    ctx.translate(B.bx + B.W / 2, B.bodyY + B.bodyH / 2); ctx.scale(vk, vk);
    pill(ctx, -34, -34, 68, 68, PAL.yellow, PAL.ink, 4.5, 34);
    ctx.fillStyle = PAL.ink; ctx.font = `900 28px ${DISP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.vsLabel || 'VS', 0, 2);
    ctx.restore();
  }
  if (o.verdict && t >= (o.verdict.at ?? 1e9)) {
    drawStampSeal(ctx, B.bx + B.W * 0.72, B.bodyY + B.bodyH - 58, o.verdict.text, o.verdict.sub, (t - o.verdict.at) / 0.22, o.verdict.color || PAL.crimson);
  }
}

// =========================================================================
// LAYOUT 3: ANIMATED BAR / MONEY WATERFALL CHART
// =========================================================================
function renderChart(ctx, o, t, B) {
  const bars = o.bars || [];
  if (!bars.length) return;
  const pad = 26, rowAreaH = B.bodyH - (o.summary ? 66 : 12);
  const rowH = Math.min(84, Math.max(46, rowAreaH / bars.length - 12));
  const maxVal = o.max || Math.max(1, ...bars.map((b) => Math.abs(Number(b.value) || 0)));
  const labelW = Math.min(240, B.W * 0.3);
  const trackX = B.bx + pad + labelW + 14;
  const trackW = B.W - pad * 2 - labelW - 134;

  bars.forEach((b, i) => {
    const tb = b.t ?? o.t0 + i * 0.2;
    if (t < tb) return;
    const grow = easeOut((t - tb) / (b.dur ?? 0.45));
    const y = B.bodyY + 8 + i * (rowH + 12);
    const col = b.color || [PAL.blue, PAL.red, PAL.gold, PAL.teal, PAL.crimson][i % 5];

    // Label + optional mini sticker
    if (b.sticker) {
      drawStickerImg(ctx, b.sticker, B.bx + pad + 26, y + rowH / 2, Math.min(54, rowH - 4), t, { stutter: o.stutter ?? 12, cutout: false, seed: i });
    }
    const lx = B.bx + pad + (b.sticker ? 58 : 4);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    fitText(ctx, b.label || '', labelW - (b.sticker ? 58 : 4), 24, 900, 15, UI);
    ctx.fillStyle = B.dark ? '#ffffff' : PAL.ink;
    ctx.fillText(b.label || '', lx, y + rowH / 2 + 1);

    // Track & animated bar
    pill(ctx, trackX, y + 6, trackW, rowH - 12, B.dark ? 'rgba(255,255,255,0.1)' : 'rgba(35,26,61,0.08)', null, 0, 14);
    const frac = clamp(Math.abs(Number(b.value) || 0) / maxVal) * grow;
    const bw = Math.max(16, trackW * frac);
    pill(ctx, trackX, y + 6, bw, rowH - 12, col, PAL.ink, 3, 14);

    // Live animated numeric readout
    const curVal = Math.round((Number(b.value) || 0) * grow);
    const disp = b.display && grow > 0.92 ? b.display : `${b.prefix || ''}${curVal}${b.unit || ''}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    fitText(ctx, disp, 114, 28, 900, 16, DISP);
    ctx.fillStyle = b.highlight ? PAL.crimson : (B.dark ? PAL.yellow : PAL.ink);
    ctx.fillText(disp, trackX + trackW + 14, y + rowH / 2 + 1);
  });

  if (o.summary && t >= (o.summary.t ?? o.t0)) {
    const sk = popBack((t - (o.summary.t ?? o.t0)) / 0.25);
    const sy = B.by + B.H - 42;
    ctx.save();
    ctx.translate(B.bx + B.W / 2, sy); ctx.scale(sk, sk);
    pill(ctx, -(B.W - 80) / 2, -26, B.W - 80, 52, o.summary.bg || PAL.ink, PAL.yellow, 3.5, 16);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, o.summary.text || '', B.W - 120, 26, 900, 16, DISP);
    ctx.fillStyle = o.summary.color || PAL.yellow;
    ctx.fillText(o.summary.text || '', 0, 1);
    ctx.restore();
  }
}

// =========================================================================
// LAYOUT 4: DETECTIVE CORKBOARD (Pins + Red String + Magnifying Lens)
// =========================================================================
function renderCorkboard(ctx, o, t, B) {
  const ts = stepTime(t, o.stutter ?? 12);
  const pins = o.pins || [];
  const pos = {};
  const pad = 30;
  pins.forEach((p, i) => {
    const px = B.bx + pad + clamp(p.x ?? (0.2 + (i % 3) * 0.3), 0.08, 0.92) * (B.W - pad * 2);
    const py = B.bodyY + 26 + clamp(p.y ?? (i < 3 ? 0.28 : 0.76), 0.14, 0.86) * (B.bodyH - 52);
    pos[p.id || String(i)] = { x: px, y: py, p };
  });

  // Draw red connecting strings FIRST so pins sit cleanly on top
  for (const lk of o.links || []) {
    const a = pos[lk.from], b = pos[lk.to];
    if (!a || !b || t < (lk.t ?? o.t0)) continue;
    const prog = easeOut((t - (lk.t ?? o.t0)) / 0.35);
    const ex = lerp(a.x, b.x, prog), ey = lerp(a.y, b.y, prog);
    const mx = (a.x + ex) / 2, my = (a.y + ey) / 2 + 18;
    ctx.save();
    ctx.strokeStyle = lk.color || PAL.crimson; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 36); ctx.quadraticCurveTo(mx, my - 36, ex, ey - 36); ctx.stroke();
    ctx.shadowColor = 'transparent';
    if (lk.label && prog > 0.75) {
      const lw = Math.max(90, lk.label.length * 13 + 26);
      pill(ctx, mx - lw / 2, my - 52, lw, 30, PAL.yellow, PAL.ink, 2.5, 10);
      ctx.fillStyle = PAL.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fitText(ctx, lk.label, lw - 14, 16, 900, 12, UI);
      ctx.fillText(lk.label, mx, my - 36);
    }
    ctx.restore();
  }

  // Draw pinned evidence cards
  pins.forEach((p, i) => {
    const tp = p.t ?? o.t0;
    if (t < tp) return;
    const { x, y } = pos[p.id || String(i)];
    const pk = popBack((t - tp) / 0.25);
    const cw = p.w ?? 226, ch = p.h ?? (p.sticker ? 168 : 112);
    const tilt = (p.tilt ?? ((i % 2 ? 1 : -1) * 0.045)) + Math.sin(ts * 3 + i) * 0.008;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(pk, pk);
    ctx.shadowColor = 'rgba(25,14,5,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
    pill(ctx, -cw / 2, -ch / 2, cw, ch, p.bg || '#fffdf7', PAL.ink, 3.2, 12);
    ctx.shadowColor = 'transparent';
    // Pushpin head
    ctx.fillStyle = p.pinColor || PAL.crimson; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -ch / 2 + 4, 10, 0, TAU); ctx.fill(); ctx.stroke();

    if (p.sticker) {
      drawStickerImg(ctx, p.sticker, 0, -14, Math.min(cw - 40, ch - 68, 92), t, { stutter: o.stutter ?? 12, cutout: false, shadow: false, seed: i });
    }
    const ty = p.sticker ? ch / 2 - 28 : (p.text ? -12 : 4);
    if (p.highlight && t >= (p.highlightAt ?? tp + 0.2)) {
      drawHighlighterBar(ctx, -cw / 2 + 12, ty - 16, cw - 24, 32, (t - (p.highlightAt ?? tp + 0.2)) / 0.22);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, p.title || '', cw - 24, 22, 900, 14, UI);
    ctx.fillStyle = PAL.ink;
    ctx.fillText(p.title || '', 0, ty);
    if (p.text && !p.sticker) {
      fitText(ctx, p.text, cw - 24, 17, 700, 12, UI);
      ctx.fillStyle = '#4e4568';
      ctx.fillText(p.text, 0, 22);
    }
    if (p.stamp && t >= (p.stamp.at ?? 1e9)) {
      drawStampSeal(ctx, 36, 0, p.stamp.text, p.stamp.sub, (t - p.stamp.at) / 0.2, p.stamp.color || PAL.crimson);
    }
    ctx.restore();
  });

  // Optional magnifying glass ring on twist clue
  if (o.magnify && t >= (o.magnify.at ?? 1e9)) {
    const tgt = pos[o.magnify.targetId];
    if (tgt) {
      const mk = popBack((t - o.magnify.at) / 0.28);
      const r = o.magnify.r || 78;
      ctx.save();
      ctx.translate(tgt.x, tgt.y); ctx.scale(mk, mk);
      ctx.strokeStyle = PAL.crimson; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r * 0.72, r * 0.72); ctx.lineTo(r * 1.25, r * 1.25); ctx.stroke();
      ctx.restore();
    }
  }
}

// =========================================================================
// LAYOUT 5: TIFO FOOTBALL / ESPN TACTICAL PITCH BOARD (GOAT Beef!)
// =========================================================================
function renderTactics(ctx, o, t, B) {
  const ts = stepTime(t, o.stutter ?? 12);
  const pad = 22, px = B.bx + pad, py = B.bodyY + 4, pw = B.W - pad * 2, ph = B.bodyH - 10;
  // Crisp grass stripes
  ctx.save();
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.clip();
  const stripes = 8, sw = pw / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#1e7b44' : '#186a3a';
    ctx.fillRect(px + i * sw, py, sw + 1, ph);
  }
  // Pitch markings
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'; ctx.lineWidth = 3.5;
  ctx.strokeRect(px + 14, py + 14, pw - 28, ph - 28);
  ctx.beginPath(); ctx.moveTo(px + pw / 2, py + 14); ctx.lineTo(px + pw / 2, py + ph - 14); ctx.stroke();
  ctx.beginPath(); ctx.arc(px + pw / 2, py + ph / 2, Math.min(pw, ph) * 0.18, 0, TAU); ctx.stroke();
  // Penalty boxes
  const bxW = pw * 0.16, bxH = ph * 0.56;
  ctx.strokeRect(px + 14, py + (ph - bxH) / 2, bxW, bxH);
  ctx.strokeRect(px + pw - 14 - bxW, py + (ph - bxH) / 2, bxW, bxH);

  const pt = (u, v) => [px + 20 + u * (pw - 40), py + 20 + v * (ph - 40)];

  // Heat / pressure zones
  for (const z of o.zones || []) {
    if (t < (z.t ?? o.t0)) continue;
    const zk = easeOut((t - (z.t ?? o.t0)) / 0.3);
    const [zx, zy] = pt(z.x, z.y), zr = (z.r || 68) * zk;
    const g = ctx.createRadialGradient(zx, zy, 6, zx, zy, Math.max(8, zr));
    g.addColorStop(0, z.color || 'rgba(255,228,90,0.62)');
    g.addColorStop(1, 'rgba(255,228,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(zx, zy, zr, 0, TAU); ctx.fill();
    if (z.label && zk > 0.7) {
      ctx.fillStyle = '#ffffff'; ctx.font = `900 18px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(z.label, zx, zy);
    }
  }

  // Player positions (interpolating if moveTo / moveAt defined)
  const pMap = {};
  for (const pl of o.players || []) {
    let u = pl.x, v = pl.y;
    if (pl.moveTo && t >= (pl.moveAt ?? 1e9)) {
      const mk = smooth((t - pl.moveAt) / (pl.moveDur ?? 0.65));
      u = lerp(pl.x, pl.moveTo[0], mk);
      v = lerp(pl.y, pl.moveTo[1], mk);
    }
    pMap[pl.id] = { ...pl, pos: pt(u, v) };
  }

  // Pass / run arrows + moving soccer ball
  for (const ps of o.passes || []) {
    if (t < (ps.t ?? o.t0)) continue;
    const a = pMap[ps.from]?.pos || (Array.isArray(ps.from) ? pt(ps.from[0], ps.from[1]) : null);
    const b = pMap[ps.to]?.pos || (Array.isArray(ps.to) ? pt(ps.to[0], ps.to[1]) : null);
    if (!a || !b) continue;
    const pk = (t - (ps.t ?? o.t0)) / (ps.dur ?? 0.45);
    drawArrow(ctx, a[0], a[1], b[0], b[1], pk, ps.color || PAL.yellow, 6, true, ts);
    if (ps.ball) {
      const bp = smooth(pk);
      const bx2 = lerp(a[0], b[0], bp), by2 = lerp(a[1], b[1], bp);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx2, by2, 11, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }

  // Draw player tokens
  for (const pl of Object.values(pMap)) {
    const [x, y] = pl.pos;
    const pk = popBack((t - (pl.t ?? o.t0)) / 0.25);
    ctx.save();
    ctx.translate(x, y); ctx.scale(pk, pk);
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.fillStyle = pl.color || PAL.red; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff'; ctx.font = `900 24px ${DISP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(pl.num ?? ''), 0, 1);
    if (pl.label) {
      pill(ctx, -46, 30, 92, 24, 'rgba(16,12,34,0.88)', null, 0, 8);
      ctx.fillStyle = PAL.yellow; ctx.font = `800 14px ${UI}`;
      ctx.fillText(pl.label, 0, 43);
    }
    ctx.restore();
  }

  // Optional sticker trophy / whistle badge inside corner
  if (o.sticker) {
    drawStickerImg(ctx, o.sticker, px + pw - 74, py + 72, 108, t, { stutter: o.stutter ?? 12, cutout: true });
  }
  if (o.badge && t >= (o.badge.t ?? o.t0)) {
    const bk = popBack((t - (o.badge.t ?? o.t0)) / 0.24);
    ctx.save();
    ctx.translate(px + pw / 2, py + ph - 38); ctx.scale(bk, bk);
    const bw = Math.min(pw - 40, Math.max(280, (o.badge.text || '').length * 16 + 48));
    pill(ctx, -bw / 2, -24, bw, 48, 'rgba(16,12,34,0.94)', PAL.yellow, 3.5, 14);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, o.badge.text || '', bw - 26, 24, 900, 15, DISP);
    ctx.fillStyle = PAL.yellow;
    ctx.fillText(o.badge.text || '', 0, 1);
    ctx.restore();
  }
  ctx.restore();
}

// =========================================================================
// OVERLAY HANDLER: `board` (dispatches to flow / compare / chart / corkboard / tactics)
// =========================================================================
export function board(ctx, o, t) {
  const B = beginBoardShell(ctx, o, t);
  if (!B) return;
  const lay = o.layout || 'flow';
  if (lay === 'compare') renderCompare(ctx, o, t, B);
  else if (lay === 'chart') renderChart(ctx, o, t, B);
  else if (lay === 'corkboard') renderCorkboard(ctx, o, t, B);
  else if (lay === 'tactics') renderTactics(ctx, o, t, B);
  else renderFlow(ctx, o, t, B);
  ctx.restore();
}

// =========================================================================
// OVERLAY HANDLER: `statCard` (ESPN / StatMuse Broadcast Card for GOAT & Facts)
// =========================================================================
export function statCard(ctx, o, t) {
  const { wide, cx } = metrics(ctx);
  const kIn = easeOut((t - o.t0) / 0.2), kOut = clamp((o.t1 - t) / 0.16), k = kIn * kOut;
  if (k <= 0) return;
  const teamCols = { ron: PAL.red, leo: PAL.cyan, gold: PAL.yellow, red: PAL.crimson, teal: PAL.teal };
  const acc = o.accent || teamCols[o.team] || PAL.yellow;
  const W = o.w ?? (wide ? 860 : 790), H = o.sub ? 196 : 162;
  const y = o.y ?? (wide ? 150 : 330);

  ctx.save();
  ctx.globalAlpha = clamp(k * 1.4);
  ctx.translate(o.x ?? cx, y - (1 - kIn) * 26);
  ctx.scale(lerp(0.9, 1, kIn), lerp(0.9, 1, kIn));

  ctx.shadowColor = 'rgba(0,0,0,0.52)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
  pill(ctx, -W / 2, -H / 2, W, H, 'rgba(14,12,32,0.95)', acc, 5, 26);
  ctx.shadowColor = 'transparent';
  // Left bold accent stripe
  pill(ctx, -W / 2 + 10, -H / 2 + 12, 14, H - 24, acc, null, 0, 7);

  // Optional Gemini cutout sticker on left side
  const hasSticker = !!o.sticker && drawStickerImg(ctx, o.sticker, -W / 2 + 106, 0, H - 36, t, { stutter: o.stutter ?? 12, cutout: true });
  const textL = hasSticker ? -W / 2 + 190 : -W / 2 + 44;
  const textW = W / 2 - textL - 28;

  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  if (o.title) {
    fitText(ctx, o.title, textW, 30, 800, 18, UI);
    ctx.fillStyle = '#c8c4e8';
    ctx.fillText(o.title, textL, -H / 2 + 44);
  }
  // Animated big stat / headline with optional Vox highlighter sweep
  let bigTxt = o.big || '';
  if (o.countTo != null) {
    const p = easeOut((t - o.t0) / (o.countDur ?? 0.55));
    const v = Math.round(lerp(o.countFrom ?? 0, o.countTo, p));
    bigTxt = `${o.prefix || ''}${v}${o.suffix || ''}`;
  }
  const bigY = o.sub ? 6 : 18;
  if (o.highlightAt != null && t >= o.highlightAt) {
    drawHighlighterBar(ctx, textL - 6, bigY - 30, Math.min(textW, bigTxt.length * 36 + 24), 58, (t - o.highlightAt) / 0.22, 'rgba(255,228,90,0.28)');
  }
  fitText(ctx, bigTxt, textW, 60, 900, 30, DISP);
  ctx.fillStyle = acc;
  ctx.fillText(bigTxt, textL, bigY);

  if (o.sub) {
    fitText(ctx, o.sub, textW, 28, 800, 18, UI);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(o.sub, textL, H / 2 - 34);
  }
  ctx.restore();
}

// =========================================================================
// OVERLAY HANDLER: `sticker` (alias `image`) — Standalone Cutout Sticker
// =========================================================================
export function sticker(ctx, o, t) {
  const { cx } = metrics(ctx);
  const kIn = popBack((t - o.t0) / 0.24), kOut = clamp((o.t1 - t) / 0.16);
  if (kOut <= 0 || t < o.t0) return;
  const x = o.x ?? cx, y = o.y ?? 420, sz = o.size ?? 240;
  let dx = 0, dy = 0;
  const eIn = 1 - easeOut((t - o.t0) / 0.22);
  if (o.enter === 'slideL') dx = -120 * eIn;
  else if (o.enter === 'slideR') dx = 120 * eIn;
  else if (o.enter === 'drop') dy = -120 * eIn;

  ctx.save();
  ctx.globalAlpha = clamp(kOut * 1.4);
  ctx.translate(x + dx, y + dy);
  ctx.scale(kIn, kIn);
  drawStickerImg(ctx, o.sticker || o.src || o.img, 0, 0, sz, t, {
    stutter: o.stutter ?? 12,
    cutout: o.cutout !== false,
    wobble: o.wobble !== false,
    rot: o.rot || 0,
  });
  if (o.label) {
    const bw = Math.max(150, o.label.length * 16 + 44);
    pill(ctx, -bw / 2, sz * 0.48, bw, 46, o.labelBg || PAL.ink, o.accent || PAL.yellow, 3.5, 16);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, o.label, bw - 24, 24, 900, 15, UI);
    ctx.fillStyle = o.labelColor || PAL.yellow;
    ctx.fillText(o.label, 0, sz * 0.48 + 24);
  }
  if (o.stamp && t >= (o.stamp.at ?? 1e9)) {
    drawStampSeal(ctx, sz * 0.26, -sz * 0.24, o.stamp.text, o.stamp.sub, (t - o.stamp.at) / 0.2, o.stamp.color || PAL.crimson);
  }
  ctx.restore();
}

// =========================================================================
// OVERLAY HANDLER: `highlighter` — Vox Text Highlight Callout
// =========================================================================
export function highlighter(ctx, o, t) {
  const { wide, cx, maxW } = metrics(ctx);
  const kIn = easeOut((t - o.t0) / 0.2), kOut = clamp((o.t1 - t) / 0.16), k = kIn * kOut;
  if (k <= 0) return;
  const W = Math.min(o.w ?? (wide ? 920 : 780), maxW);
  const y = o.y ?? (wide ? 180 : 340);
  const ts = stepTime(t, o.stutter ?? 12);
  ctx.save();
  ctx.globalAlpha = clamp(k * 1.4);
  ctx.translate(o.x ?? cx, y - (1 - kIn) * 18);
  ctx.rotate(Math.sin(ts * 3.1) * 0.008);
  ctx.font = `900 ${o.size ?? 44}px ${UI}`;
  const lines = wrapLines(ctx, o.text || '', W - 76);
  const lh = (o.size ?? 44) * 1.28, H = lines.length * lh + 52;
  ctx.shadowColor = 'rgba(10,8,24,0.42)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  pill(ctx, -W / 2, -H / 2, W, H, '#fffdf5', PAL.ink, 4.5, 22);
  ctx.shadowColor = 'transparent';
  const hp = t >= (o.highlightAt ?? o.t0 + 0.12) ? (t - (o.highlightAt ?? o.t0 + 0.12)) / 0.28 : 0;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    const ly = -H / 2 + 26 + lh * (i + 0.5);
    const tw = ctx.measureText(ln).width;
    if (hp > 0) drawHighlighterBar(ctx, -tw / 2 - 10, ly - (o.size ?? 44) * 0.52, tw + 20, (o.size ?? 44) * 1.04, hp - i * 0.2, o.color || 'rgba(255,228,90,0.88)');
    ctx.fillStyle = PAL.ink;
    ctx.fillText(ln, 0, ly + 1);
  });
  ctx.restore();
}

// =========================================================================
// HELPER: `makeBackdropSwap` — 2-D Gemini Illustrated Backdrop behind live 3-D Cast!
// Uses core/player.js's built-in `kind: 'setswap'` compositor (zero core render changes!).
// =========================================================================
export function makeBackdropSwap({ t0, t1, backdrop, fade = 0.45, kenBurns = 0.06, dim = 0.12, vignette = 0.35, keep } = {}) {
  return {
    kind: 'setswap',
    t0,
    t1,
    fade,
    backdrop,
    ...(keep ? { keep } : {}),
    fn(ctx, t) {
      const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920;
      const im = getMedia(backdrop, 'backdrop');
      ctx.fillStyle = '#0d0c1c';
      ctx.fillRect(0, 0, CW, CH);
      if (im) {
        const u = clamp((t - t0) / Math.max(0.1, t1 - t0));
        const sc = 1 + kenBurns * u;
        const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
        const fit = Math.max(CW / Math.max(1, iw), CH / Math.max(1, ih)) * sc;
        const dw = iw * fit, dh = ih * fit;
        const driftX = Math.sin(u * Math.PI) * CW * 0.015;
        ctx.drawImage(im, (CW - dw) / 2 + driftX, (CH - dh) / 2, dw, dh);
      }
      if (dim > 0) {
        ctx.fillStyle = `rgba(10,8,24,${clamp(dim)})`;
        ctx.fillRect(0, 0, CW, CH);
      }
      if (vignette > 0) {
        const g = ctx.createRadialGradient(CW / 2, CH * 0.45, CW * 0.25, CW / 2, CH * 0.5, CH * 0.68);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(8,6,20,${clamp(vignette)})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CW, CH);
      }
    },
  };
}

// =========================================================================
// QA HELPER: Auto-extract readable text items from v3.0 declarative overlays
// =========================================================================
export function extractBoardReads(o) {
  if (!o) return [];
  const out = [];
  const add = (text, t0, t1) => {
    const s = String(text || '').trim();
    if (s) out.push({ text: s, t0: Math.max(o.t0, t0 ?? o.t0), t1: Math.min(o.t1, t1 ?? o.t1) });
  };
  if (o.kind === 'statCard') {
    add([o.title, o.big || (o.countTo != null ? `${o.prefix || ''}${o.countTo}${o.suffix || ''}` : ''), o.sub].filter(Boolean).join(' · '), o.t0, o.t1);
  } else if (o.kind === 'sticker' || o.kind === 'image') {
    if (o.label) add(o.label, o.t0, o.t1);
    if (o.stamp?.text) add(o.stamp.text, o.stamp.at ?? o.t0, o.t1);
  } else if (o.kind === 'highlighter') {
    add(o.text, o.t0, o.t1);
  } else if (o.kind === 'board') {
    if (o.title) add(o.title, o.t0, o.t1);
    for (const st of o.steps || []) {
      if (st.caption) add(st.caption, st.t ?? o.t0, o.t1);
      if (st.stamp?.text) add(st.stamp.text, st.stamp.at ?? o.t0, o.t1);
    }
    if (o.loop?.label) add(o.loop.label, o.loop.at ?? o.t0, o.t1);
    for (const side of [o.left, o.right]) {
      for (const r of side?.rows || []) add(r.text, r.t ?? o.t0, o.t1);
    }
    if (o.verdict?.text) add(o.verdict.text, o.verdict.at ?? o.t0, o.t1);
    for (const b of o.bars || []) add(b.label, b.t ?? o.t0, o.t1);
    if (o.summary?.text) add(o.summary.text, o.summary.t ?? o.t0, o.t1);
    for (const p of o.pins || []) add(p.title, p.t ?? o.t0, o.t1);
    if (o.badge?.text) add(o.badge.text, o.badge.t ?? o.t0, o.t1);
  }
  return out;
}

export const BOARD_OVERLAYS = {
  board,
  statCard,
  sticker,
  image: sticker,
  highlighter,
};
