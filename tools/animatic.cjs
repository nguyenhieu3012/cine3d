// cine3d silent animatic, browser side (called by tools/animatic.py; not meant to be run by hand).
//   node tools/animatic.cjs plan <ep.js> <out.json>     reads window.ep: dur, shots, overlays (with the times where their text appears or changes), lines
//   node tools/animatic.cjs compose <spec.json>          draws (1) the running timecode + shot id labels (RGBA PNG per frame) and (2) the contact sheets (jpg), in Chromium
//                                                         (this machine's ffmpeg has no drawtext and the venv has no PIL, so the text is drawn here, with the page canvas)
const fs = require('fs'), path = require('path'), { chromium } = require('playwright'), { start, serve, ROOT } = require('./_page.cjs');
const [mode, a, b] = process.argv.slice(2);
(async () => {
  if (mode === 'plan') {
    const S = await start(), p = await S.open(a, '');
    const d = await p.evaluate(() => { const e = window.ep, n = (x) => (typeof x === 'number' ? x : null); return {
      dur: e.dur, fps: e.fps, lips: !!e.lips,
      shots: (e.shots || []).map((s) => ({ t0: s.t0, t1: s.t1, cam: s.cam })),
      lines: (e.lines || []).map((l) => ({ id: l.id, t0: l.t0, t1: l.t1, text: l.text })),
      overlays: (e.overlays || []).map((o) => ({ kind: o.kind, t0: o.t0, t1: o.t1, text: o.text || null, msgs: (o.msgs || []).map((m) => n(m.t)).filter((x) => x !== null), reads: (o.reads || []).map((r) => [n(r.t0), n(r.t1)]) })) }; });
    fs.writeFileSync(b, JSON.stringify(d)); await S.close(); console.log(`plan: ${d.shots.length} shots, ${d.overlays.length} overlays, dur ${d.dur}`);
  } else if (mode === 'compose') {
    const spec = JSON.parse(fs.readFileSync(a, 'utf8')), srv = await serve(), port = srv.address().port, br = await chromium.launch();
    const pg = await br.newPage({ viewport: { width: 400, height: 300 } }); fs.mkdirSync(path.join(ROOT, spec.work), { recursive: true });
    fs.writeFileSync(path.join(ROOT, spec.work, 'blank.html'), '<!doctype html><meta charset="utf-8"><body></body>');
    await pg.goto(`http://localhost:${port}/${spec.work}/blank.html`);
    // 1. frame labels, 200 per call
    if (spec.labels) {
      const L = spec.labels; fs.mkdirSync(path.join(ROOT, L.dir), { recursive: true });
      for (let i = 0; i < L.text.length; i += 200) {
        const res = await pg.evaluate(({ texts, w, h, font }) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), out = [];
          for (const t of texts) { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,0.62)'; x.beginPath(); x.roundRect(0, 0, w, h, 14); x.fill(); x.fillStyle = '#fff'; x.font = font; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText(t, 16, h / 2 + 2); out.push(c.toDataURL('image/png').slice(22)); } return out; },
          { texts: L.text.slice(i, i + 200), w: L.w, h: L.h, font: L.font });
        res.forEach((s, k) => fs.writeFileSync(path.join(ROOT, L.dir, `lab_${String(i + k).padStart(5, '0')}.png`), Buffer.from(s, 'base64')));
      }
    }
    // 2. contact sheets: the stills are loaded from the same server (same origin, so the canvas is not tainted)
    for (const sh of spec.sheets || []) {
      const d = await pg.evaluate(async ({ items, cols, cw, ch, strip, port }) => {
        const load = (src) => new Promise((r, j) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => j(new Error('cannot load ' + src)); im.src = src; });
        const rows = Math.ceil(items.length / cols), pad = 8, W = cols * (cw + pad) + pad, H = rows * (ch + strip + pad) + pad, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        x.fillStyle = '#15151c'; x.fillRect(0, 0, W, H);
        for (let i = 0; i < items.length; i++) { const it = items[i], im = await load(`http://localhost:${port}/${it.src}`), cx = pad + (i % cols) * (cw + pad), cy = pad + Math.floor(i / cols) * (ch + strip + pad);
          x.drawImage(im, cx, cy, cw, ch); x.fillStyle = '#23232e'; x.fillRect(cx, cy + ch, cw, strip); x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.textAlign = 'left';
          x.font = 'bold 21px Menlo, monospace'; x.fillText(it.l1, cx + 8, cy + ch + strip * 0.3); x.fillStyle = '#b9bccb'; x.font = '19px Menlo, monospace'; x.fillText(it.l2, cx + 8, cy + ch + strip * 0.74); }
        return c.toDataURL('image/jpeg', 0.92).slice(23); }, { items: sh.items, cols: sh.cols, cw: sh.cw, ch: sh.ch, strip: sh.strip, port });
      fs.writeFileSync(path.join(ROOT, sh.out), Buffer.from(d, 'base64')); console.log('sheet', sh.out, sh.items.length, 'stills');
    }
    await br.close(); srv.close();
  } else { console.error('usage: animatic.cjs plan <ep.js> <out.json> | compose <spec.json>'); process.exit(2); }
})();
