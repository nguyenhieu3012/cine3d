// cine3d core: Blueprint v2.0 floating overlay widgets (24/11/2026).
// Pure functions of t; zero scene dim/blur unless `backdrop: true`; sized & positioned inside 9:16 v2 safe zones (x 54..890, y 220..1536, above captions) and responsive for 16:9.
import { clamp, easeOut, lerp, overshoot } from './util.js';
import { fitText, wrapLines, backdrop, drawMumAvatar } from './overlay.js';
import { gptMark } from './overlay_zb.js';

const DISP = 'Display, sans-serif', UI = 'UI, sans-serif', INK = '#231a3d', TAU = Math.PI * 2;

function frameMetrics(ctx) {
  const CW = ctx.canvas.width || 1080, CH = ctx.canvas.height || 1920, wide = CW > CH;
  // In 9:16 Shorts rules 2, x > 900 (y 800..1550) is reserved for platform UI, and safe margins are 54..1026; centering widgets around x=472 keeps them safely inside 54..890.
  const cxDefault = wide ? CW * 0.5 : 472;
  return { CW, CH, wide, cxDefault };
}

function drawWidgetAvatar(ctx, kind, cx, cy, r, accent, fallbackChar) {
  if (kind === 'mum' || kind === 'me') return drawMumAvatar(ctx, cx, cy, r);
  if (kind === 'gpt' || kind === 'bip') return gptMark(ctx, cx, cy, r * 1.05);
  ctx.save();
  ctx.fillStyle = accent || '#2f7cf6';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(r * 0.95)}px ${UI}`;
  ctx.fillText(kind === 'bank' ? '₫' : (fallbackChar || '?'), cx, cy + 2);
  ctx.restore();
}

function speechEnv(ep, who, t) {
  let amp = 0;
  (ep?.lines || []).forEach((l, i) => {
    if (l.who !== who || l.think || t < l.t0 || t > l.t1) return;
    const env = ep.lips?.[i];
    if (env) { const x = (t - l.t0) * 60, j = Math.floor(x); amp = clamp(lerp(env[j] ?? 0, env[j + 1] ?? env[j] ?? 0, x - j)); }
    else amp = 0.35 + 0.55 * Math.abs(Math.sin(t * 11.5)) * (0.6 + 0.4 * Math.sin(t * 4.3));
  });
  return amp;
}

// ---------------------------------------------------------------- chatStrip
// Floating chat message strip over the 3-D scene (NO backdrop blur by default).
// o: { sender, sub?, avatar: 'mum'|'gpt'|'bank'|'letter', letter?, accent, x, y (center), w, maxShow (2), msgs: [{ t, from: 'them'|'me', text }], backdrop?: false }
export function chatStrip(ctx, o, t) {
  const k = easeOut((t - o.t0) / 0.22) * clamp((o.t1 - t) / 0.16);
  if (k <= 0) return;
  if (o.backdrop) backdrop(ctx, { t0: o.t0, t1: o.t1, blur: 12, dim: 0.42 }, t);
  const { wide, cxDefault } = frameMetrics(ctx);
  const W = o.w ?? (wide ? 820 : 760), cx = o.x ?? cxDefault, acc = o.accent || '#2f7cf6';
  const FS = o.size ?? (wide ? 42 : 44), LH = FS * 1.24, PAD_X = 28, PAD_Y = 20, MAXW = W - 120;

  ctx.save();
  ctx.font = `800 ${FS}px ${UI}`;
  const vis = (o.msgs || []).filter((m) => t >= (m.t ?? -1)).slice(-(o.maxShow ?? 2));
  const items = vis.map((m) => {
    const lines = wrapLines(ctx, m.text, MAXW);
    let mw = 0; for (const l of lines) mw = Math.max(mw, ctx.measureText(l).width);
    return { m, lines, bw: Math.max(220, mw + PAD_X * 2), bh: lines.length * LH + PAD_Y * 1.6, pop: easeOut((t - (m.t ?? o.t0)) / 0.18) };
  });

  const headH = 88, gap = 14, bodyH = items.length ? items.reduce((s, it) => s + it.bh + gap, 18) : 34;
  const H = headH + bodyH + 14;
  // Clamp top >= 224 in 9:16 V2 unless wide or explicitly requested
  const targetY = o.y ?? (wide ? 260 : 410);
  const cy = wide ? targetY : Math.max(224 + H / 2, targetY);

  ctx.globalAlpha = clamp(k * 1.4);
  ctx.translate(cx, cy + (1 - k) * 24);
  ctx.scale(lerp(0.9, 1, k), lerp(0.9, 1, k));

  // Soft floating container (semi-transparent frost card so 3D behind stays visible)
  ctx.shadowColor = 'rgba(10,8,24,0.42)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
  ctx.fillStyle = 'rgba(247,246,255,0.96)';
  ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 34); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = acc; ctx.lineWidth = 5; ctx.stroke();

  // Header strip
  const hx = -W / 2 + 24, hy = -H / 2 + 44;
  drawWidgetAvatar(ctx, o.avatar || 'letter', hx + 30, hy + 4, 28, acc, o.letter || (o.sender || '?')[0]);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const sender = o.sender || o.name || 'Tin nhắn';
  fitText(ctx, sender, W - 240, 36, 900, 24, UI);
  ctx.fillStyle = '#181430'; ctx.fillText(sender, hx + 74, o.sub ? hy - 10 : hy + 4);
  if (o.sub) {
    ctx.font = `700 24px ${UI}`; ctx.fillStyle = '#6b6684';
    ctx.fillText(o.sub, hx + 74, hy + 18);
  }
  ctx.fillStyle = 'rgba(20,16,42,0.08)'; ctx.fillRect(-W / 2 + 20, -H / 2 + headH, W - 40, 2);

  // Messages
  let yy = -H / 2 + headH + 16;
  for (const it of items) {
    const me = it.m.from === 'me', bx = me ? W / 2 - 22 - it.bw : -W / 2 + 22;
    const sc = lerp(0.82, 1, it.pop);
    ctx.save();
    ctx.translate(me ? bx + it.bw : bx, yy + it.bh / 2); ctx.scale(sc, sc); ctx.translate(-(me ? bx + it.bw : bx), -(yy + it.bh / 2));
    ctx.fillStyle = me ? acc : '#ffffff';
    ctx.strokeStyle = me ? acc : 'rgba(20,16,42,0.12)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(bx, yy, it.bw, it.bh, 26); ctx.fill(); if (!me) ctx.stroke();
    ctx.fillStyle = me ? '#ffffff' : '#181430'; ctx.font = `800 ${FS}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    it.lines.forEach((l, li) => ctx.fillText(l, bx + PAD_X, yy + PAD_Y * 0.8 + LH * (li + 0.5) + 2));
    ctx.restore();
    yy += it.bh + gap;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- voiceNote
// Floating voice message card with animated waveform driven by `ep.lips` (or speech-like wave if silent).
// o: { sender: 'Mẹ', who: 'me', avatar: 'mum', durLabel: '0:04', text?, accent: '#2f7cf6', x, y, w, backdrop?: false }
export function voiceNote(ctx, o, t, ep) {
  const k = easeOut((t - o.t0) / 0.22) * clamp((o.t1 - t) / 0.16);
  if (k <= 0) return;
  if (o.backdrop) backdrop(ctx, { t0: o.t0, t1: o.t1, blur: 12, dim: 0.42 }, t);
  const { wide, cxDefault } = frameMetrics(ctx);
  const W = o.w ?? (wide ? 780 : 750), cx = o.x ?? cxDefault, acc = o.accent || '#2f7cf6';
  const FS = o.size ?? 38;
  ctx.save();
  ctx.font = `700 ${FS}px ${UI}`;
  const tLines = o.text ? wrapLines(ctx, o.text, W - 96) : [];
  const H = 166 + (tLines.length ? tLines.length * (FS * 1.24) + 28 : 0);
  const cy = wide ? (o.y ?? 250) : Math.max(224 + H / 2, o.y ?? 340);

  ctx.globalAlpha = clamp(k * 1.45);
  ctx.translate(cx, cy - (1 - k) * 20);
  ctx.scale(lerp(0.88, 1, k), lerp(0.88, 1, k));

  ctx.shadowColor = 'rgba(10,8,24,0.45)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
  ctx.fillStyle = 'rgba(24,21,46,0.95)';
  ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 36); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = acc; ctx.lineWidth = 5; ctx.stroke();

  const topY = -H / 2 + 54;
  drawWidgetAvatar(ctx, o.avatar || 'mum', -W / 2 + 56, topY, 32, acc, (o.sender || 'M')[0]);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const title = o.sender || 'Mẹ · Tin thoại';
  fitText(ctx, title, W - 260, 34, 900, 24, UI);
  ctx.fillStyle = '#ffffff'; ctx.fillText(title, -W / 2 + 106, topY);

  // Duration tag at right
  const durTxt = o.durLabel || '0:04';
  ctx.font = `800 30px ${UI}`; ctx.textAlign = 'right'; ctx.fillStyle = '#9fd0ff';
  ctx.fillText(durTxt, W / 2 - 30, topY);

  // Play circle + 20 waveform bars
  const rowY = -H / 2 + 120, px = -W / 2 + 56;
  ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(px, rowY, 26, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath();
  ctx.moveTo(px - 7, rowY - 11); ctx.lineTo(px + 13, rowY); ctx.lineTo(px - 7, rowY + 11); ctx.closePath(); ctx.fill();

  const amp = Math.max(0.18, speechEnv(ep, o.who, t));
  const bars = 20, bx0 = px + 46, bwArea = W - 146, step = bwArea / bars, prog = clamp((t - o.t0) / Math.max(0.2, o.t1 - o.t0));
  for (let i = 0; i < bars; i++) {
    const active = i / bars <= prog + 0.08;
    const h0 = 12 + amp * (26 + 24 * Math.abs(Math.sin(t * (7.5 + (i % 5) * 1.9) + i * 0.85)));
    const bh = clamp(h0, 10, 56);
    ctx.fillStyle = active ? '#79d8ff' : 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.roundRect(bx0 + i * step, rowY - bh / 2, Math.max(8, step * 0.56), bh, 5); ctx.fill();
  }

  // Optional transcript preview line inside same card
  if (tLines.length) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `700 ${FS}px ${UI}`;
    ctx.fillStyle = '#e9f2ff';
    tLines.forEach((l, i) => ctx.fillText(l, -W / 2 + 34, -H / 2 + 178 + i * (FS * 1.24)));
  }
  ctx.restore();
}

// ---------------------------------------------------------------- callCard
// Unified floating phone call strip supporting outgoing / busy / incoming / live without blocking 3-D scene by default.
// o: { mode: 'outgoing'|'busy'|'incoming'|'live', name: 'Mẹ', who?: 'me', status?, busyAt?, busyText?: 'Máy bận!', answer?, avatar?: 'mum', y, w, x, backdrop?: false }
export function callCard(ctx, o, t, ep) {
  const k = easeOut((t - o.t0) / 0.24) * clamp((o.t1 - t) / 0.16);
  if (k <= 0) return;
  if (o.backdrop) backdrop(ctx, { t0: o.t0, t1: o.t1, blur: 12, dim: 0.42 }, t);
  const { wide, cxDefault } = frameMetrics(ctx);
  const W = o.w ?? (wide ? 820 : 780), H = 176, cx = o.x ?? cxDefault;
  const cy = wide ? (o.y ?? 200) : Math.max(224 + H / 2, o.y ?? 320);

  const busy = o.mode === 'busy' || (o.busyAt != null && t >= o.busyAt);
  const live = !busy && (o.mode === 'live' || (o.answer != null && t >= o.answer));
  const incoming = !busy && !live && o.mode === 'incoming';
  const col = busy ? '#ff5252' : live ? '#3ddc84' : 'rgba(255,255,255,0.28)';

  ctx.save();
  ctx.globalAlpha = clamp(k * 1.45);
  ctx.translate(cx, cy - (1 - k) * 40);

  ctx.shadowColor = 'rgba(0,0,0,0.48)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
  ctx.fillStyle = 'rgba(22,19,42,0.95)';
  ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 46); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke();

  drawWidgetAvatar(ctx, o.avatar || 'mum', -W / 2 + 94, 0, 58, '#4a6cf7', (o.name || 'M')[0]);

  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const nm = o.name || 'Mẹ';
  fitText(ctx, nm, W - 380, 56, 900, 34, DISP);
  ctx.fillStyle = '#ffffff'; ctx.fillText(nm, -W / 2 + 178, -22);

  let stTxt = o.status || 'Đang gọi…';
  if (busy) stTxt = o.busyText || 'Máy bận!';
  else if (live) {
    const sec = Math.max(0, Math.floor(t - (o.answer ?? o.t0)));
    stTxt = `Loa ngoài · 00:${String(sec).padStart(2, '0')}`;
  } else if (incoming && !o.status) stTxt = 'Cuộc gọi đến…';
  fitText(ctx, stTxt, W - 380, 34, 800, 24, UI);
  ctx.fillStyle = busy ? '#ff8b8b' : live ? '#7df0a8' : '#c9c4e6';
  ctx.fillText(stTxt, -W / 2 + 178, 32);

  const bx = W / 2 - 96;
  const drawHangup = (x, shake) => {
    ctx.fillStyle = '#e5453f'; ctx.beginPath(); ctx.arc(x, 0, 38, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x + shake, 0);
    // Downward-facing hang-up handset arch + twin earpieces (never inverted)
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 14, 21, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(-22, -2, 11, 9, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(11, -2, 11, 9, 4); ctx.fill();
    ctx.restore();
  };

  if (live) {
    const amp = Math.max(0.2, speechEnv(ep, o.who, t));
    for (let i = 0; i < 6; i++) {
      const bh = 12 + amp * (34 + 32 * Math.abs(Math.sin(t * (9 + i * 2.3) + i * 1.7)));
      ctx.fillStyle = '#3ddc84';
      ctx.beginPath(); ctx.roundRect(bx - 56 + i * 22, -bh / 2, 12, bh, 6); ctx.fill();
    }
  } else if (incoming) {
    drawHangup(bx - 96, 0);
    const pu = (t * 1.6) % 1;
    ctx.strokeStyle = `rgba(61,220,132,${1 - pu})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(bx, 0, 38 + pu * 22, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#3ddc84'; ctx.beginPath(); ctx.arc(bx, 0, 38, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(bx + Math.sin(t * 42) * 2.5, 0); ctx.rotate(-0.55);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 8, 17, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.restore();
  } else {
    // Outgoing / busy: single red button ONLY (never an incoming green answer button)
    const pu = (t * 1.4) % 1;
    if (!busy) {
      ctx.strokeStyle = `rgba(229,69,63,${0.65 * (1 - pu)})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(bx, 0, 38 + pu * 20, 0, TAU); ctx.stroke();
    }
    drawHangup(bx, busy ? Math.sin(t * 50) * 2 : 0);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- receipt
// Generic bank / bill receipt card (no real bank logo or name).
// o: { title: 'CHUYỂN KHOẢN', amount: '5.000.000đ', rows: [['Đến', 'Chủ TK lạ'], ['Nội dung', 'Vay gấp']], status: 'pending'|'ok'|'fail', accent, y, w, x, backdrop?: false }
export function receipt(ctx, o, t) {
  const k = easeOut((t - o.t0) / 0.24) * clamp((o.t1 - t) / 0.16);
  if (k <= 0) return;
  if (o.backdrop) backdrop(ctx, { t0: o.t0, t1: o.t1, blur: 14, dim: 0.45 }, t);
  const { wide, cxDefault } = frameMetrics(ctx);
  const W = o.w ?? (wide ? 760 : 720), cx = o.x ?? cxDefault;
  const st = o.status || 'ok', acc = o.accent || (st === 'fail' ? '#e53935' : st === 'pending' ? '#f59e0b' : '#1fb866');
  const rows = o.rows || [], H = 192 + rows.length * 48;
  const cy = wide ? (o.y ?? 380) : Math.max(224 + H / 2, o.y ?? 365);

  ctx.save();
  ctx.globalAlpha = clamp(k * 1.45);
  ctx.translate(cx, cy + (1 - k) * 28);
  ctx.scale(lerp(0.88, 1, k), lerp(0.88, 1, k));

  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#fbfaf6';
  ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 32); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = acc; ctx.lineWidth = 6; ctx.stroke();

  // Top bar
  ctx.fillStyle = acc;
  ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, 68, [32, 32, 0, 0]); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitText(ctx, o.title || 'BIÊN LAI', W - 72, 34, 900, 24, UI);
  ctx.fillText(o.title || 'BIÊN LAI', 0, -H / 2 + 36);

  // Amount
  const amt = o.amount || '';
  if (amt) {
    fitText(ctx, amt, W - 72, 66, 900, 40, DISP);
    ctx.fillStyle = '#16122e'; ctx.fillText(amt, 0, -H / 2 + 122);
  }

  // Rows
  let ry = -H / 2 + 184;
  ctx.textBaseline = 'middle';
  for (const [kLabel, vLabel] of rows) {
    ctx.fillStyle = 'rgba(20,16,42,0.08)'; ctx.fillRect(-W / 2 + 32, ry - 24, W - 64, 2);
    ctx.textAlign = 'left'; fitText(ctx, String(kLabel), W * 0.36, 28, 700, 22, UI);
    ctx.fillStyle = '#6f6a86'; ctx.fillText(String(kLabel), -W / 2 + 32, ry);
    ctx.textAlign = 'right'; fitText(ctx, String(vLabel), W * 0.52, 30, 800, 22, UI);
    ctx.fillStyle = '#16122e'; ctx.fillText(String(vLabel), W / 2 - 32, ry);
    ry += 48;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- stamp
// Rubber stamp slam ("ĐÃ KHÓA", "LỪA ĐẢO!", "KHÁCH QUÁN ĐỒNG Ý").
// o: { text: 'ĐÃ KHÓA', color: '#e53935', rot: -0.18, x, y, size }
export function stamp(ctx, o, t) {
  const tin = clamp((t - o.t0) / 0.14), kout = clamp((o.t1 - t) / 0.14);
  if (tin <= 0 || kout <= 0) return;
  const { wide, cxDefault } = frameMetrics(ctx);
  const cx = o.x ?? cxDefault, cy = wide ? (o.y ?? 420) : clamp(o.y ?? 580, 280, 1180);
  const col = o.color || '#e53935', sc = lerp(1.9, 1.0, overshoot(tin, 0.35));

  ctx.save();
  ctx.globalAlpha = clamp(tin * 2.2) * kout * 0.94;
  ctx.translate(cx, cy);
  ctx.rotate(o.rot ?? -0.16);
  ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = fitText(ctx, o.text || 'CẢNH BÁO', wide ? 680 : 580, o.size ?? 68, 900, 38, DISP);
  const w = ctx.measureText(o.text || 'CẢNH BÁO').width + 80, h = sz + 44;

  ctx.fillStyle = 'rgba(255,250,248,0.92)';
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 18); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 9; ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 11); ctx.stroke();
  ctx.fillStyle = col; ctx.fillText(o.text || 'CẢNH BÁO', 0, 3);
  ctx.restore();
}

// ---------------------------------------------------------------- homThuSlip
// Combo 1 ("Hòm Thư Quán Trà"): yellow question/story paper slip without hiding the cast.
// o: { header?: 'HÒM THƯ QUÁN TRÀ', text: '...', sub?: '...', x, y, w, tilt, backdrop?: false }
export function homThuSlip(ctx, o, t) {
  const k = easeOut((t - o.t0) / 0.24) * clamp((o.t1 - t) / 0.16);
  if (k <= 0) return;
  if (o.backdrop) backdrop(ctx, { t0: o.t0, t1: o.t1, blur: 10, dim: 0.35 }, t);
  const { wide, cxDefault } = frameMetrics(ctx);
  const W = o.w ?? (wide ? 760 : 720), cx = o.x ?? cxDefault;
  const FS = o.size ?? 44;
  ctx.save();
  ctx.font = `900 ${FS}px ${DISP}`;
  const lines = wrapLines(ctx, o.text || '', W - 80);
  const H = 104 + Math.max(1, lines.length) * (FS * 1.24) + (o.sub ? 52 : 20);
  const cy = wide ? (o.y ?? 290) : Math.max(240 + H / 2, o.y ?? 420);

  ctx.globalAlpha = clamp(k * 1.45);
  ctx.translate(cx, cy - (1 - k) * 24);
  ctx.rotate(o.tilt ?? -0.024);
  ctx.scale(lerp(0.86, 1, k), lerp(0.86, 1, k));

  ctx.shadowColor = 'rgba(10,8,20,0.42)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 24); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();

  // Small red pin/tape badge at top
  ctx.fillStyle = '#d4252f';
  ctx.beginPath(); ctx.roundRect(-86, -H / 2 - 8, 172, 22, 11); ctx.fill();

  const hdr = o.header || 'HÒM THƯ QUÁN TRÀ';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitText(ctx, hdr, W - 72, 30, 900, 22, UI);
  ctx.fillStyle = '#b3202a'; ctx.fillText(hdr, 0, -H / 2 + 46);

  ctx.fillStyle = INK; ctx.font = `900 ${FS}px ${DISP}`;
  lines.forEach((l, i) => ctx.fillText(l, 0, -H / 2 + 98 + (i + 0.5) * (FS * 1.22)));

  if (o.sub) {
    fitText(ctx, o.sub, W - 72, 32, 800, 22, UI);
    ctx.fillStyle = '#6a4b18';
    ctx.fillText(o.sub, 0, H / 2 - 28);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- questBadge
// Combo 2 ("Bậc Thang Kèo Cả Quán"): percentage-only milestone progress bar (no raw single-platform follower count).
// o: { label: 'KHÁCH QUÁN → MỐC 1', pct: 82 | [78, 82], goalText?: 'LÀM TẬP ĐẶC BIỆT', accent: '#ffc531', x, y, w }
export function questBadge(ctx, o, t) {
  const k = easeOut((t - o.t0) / 0.24) * clamp((o.t1 - t) / 0.16);
  if (k <= 0) return;
  const { wide, cxDefault } = frameMetrics(ctx);
  const W = o.w ?? (wide ? 780 : 750), H = o.goalText ? 114 : 94, cx = o.x ?? cxDefault;
  const cy = wide ? (o.y ?? 140) : Math.max(226 + H / 2, o.y ?? 282);
  const acc = o.accent || '#ffc531';
  const p0 = Array.isArray(o.pct) ? o.pct[0] : (o.pct ?? 80);
  const p1 = Array.isArray(o.pct) ? o.pct[1] : p0;
  const pctVal = clamp(lerp(p0, p1, easeOut((t - o.t0 - 0.15) / 0.7)) / 100, 0, 1);

  ctx.save();
  ctx.globalAlpha = clamp(k * 1.45);
  ctx.translate(cx, cy - (1 - k) * 20);
  ctx.scale(lerp(0.9, 1, k), lerp(0.9, 1, k));

  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.fillStyle = 'rgba(16,13,34,0.94)';
  ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, 28); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = acc; ctx.lineWidth = 5; ctx.stroke();

  const lab = o.label || 'KHÁCH QUÁN → MỐC 1';
  const pctStr = `${Math.round(pctVal * 100)}%`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; fitText(ctx, lab, W - 180, 30, 900, 22, UI);
  ctx.fillStyle = '#ffffff'; ctx.fillText(lab, -W / 2 + 28, -H / 2 + 28);

  ctx.textAlign = 'right'; ctx.font = `900 34px ${DISP}`; ctx.fillStyle = acc;
  ctx.fillText(pctStr, W / 2 - 28, -H / 2 + 28);

  // Progress bar track + fill
  const bw = W - 56, bx = -W / 2 + 28, by = -H / 2 + 52, bh = 20;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
  ctx.fillStyle = acc;
  ctx.beginPath(); ctx.roundRect(bx, by, Math.max(20, bw * pctVal), bh, 10); ctx.fill();

  if (o.goalText) {
    ctx.textAlign = 'center';
    fitText(ctx, o.goalText, W - 56, 24, 800, 18, UI);
    ctx.fillStyle = '#ffe7a8'; ctx.fillText(o.goalText, 0, H / 2 - 20);
  }
  ctx.restore();
}

export const V2_OVERLAYS = { chatStrip, voiceNote, callCard, receipt, stamp, homThuSlip, questBadge };
