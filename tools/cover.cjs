// cine3d covers: a frame of the episode (no captions, no cards) + the channel's title style: a white line on top, a tilted colour plate under it.
//   node tools/cover.cjs <ep.js> <time> "<top line>" "<plate line>" <out base>  [--color #ffc531] [--y 150]
// writes <out base>_cover_doc.jpg (1080 x 1920, TikTok / Shorts / Reels) and <out base>_cover_ngang.jpg (1280 x 720, cut around the subject's head; YouTube limit 2 MB).
// Rules of the channels: a face and one funny thing in the picture, at most ~6 words, the words of the plate differ from the first spoken line, no "NNN" on a cover.
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), a = process.argv.slice(2), flag = (n, d) => { const i = a.indexOf('--' + n); return i < 0 ? d : a[i + 1]; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.otf': 'font/otf' };
(async () => {
  const srv = await new Promise((res) => { const s = http.createServer((req, rsp) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { rsp.writeHead(404); return rsp.end(); } rsp.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); rsp.end(d); }); }); s.listen(0, () => res(s)); });
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }), p = await b.newPage({ viewport: { width: 540, height: 960 } });
  await p.goto(`http://localhost:${srv.address().port}/index.html?render=1&ep=${a[0]}`); await p.waitForFunction(() => window.filmReady, null, { timeout: 60000 });
  const out = await p.evaluate(({ t, top, plate, color, y0 }) => {
    const pr = window.probe(t); window.seek(t, { overlays: false }); const film = document.getElementById('film'), head = pr.heads[pr.who];
    const title = (ctx, W, x, y, size, align) => { ctx.save(); ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      let s = size; for (; s > 40; s -= 2) { ctx.font = `900 ${s}px Display, sans-serif`; if (ctx.measureText(top).width <= W) break; }
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.strokeStyle = '#14102a'; ctx.lineWidth = s * 0.22; ctx.strokeText(top, x, y); ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff'; ctx.fillText(top, x, y);
      let q = size * 1.25; for (; q > 44; q -= 2) { ctx.font = `900 ${q}px Display, sans-serif`; if (ctx.measureText(plate).width <= W - 70) break; }
      const pw = ctx.measureText(plate).width + 70, ph = q * 1.42, px = align === 'center' ? x : x + pw / 2, py = y + s * 0.7 + ph / 2 + 18;
      ctx.translate(px, py); ctx.rotate(-0.03); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10; ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-pw / 2, -ph / 2, pw, ph, ph * 0.2); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.textAlign = 'center'; ctx.fillStyle = '#14102a'; ctx.fillText(plate, 0, q * 0.04); ctx.restore(); };
    const doc = document.createElement('canvas'); doc.width = 1080; doc.height = 1920; let c = doc.getContext('2d'); c.drawImage(film, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, 'rgba(10,6,24,0.55)'); g.addColorStop(1, 'rgba(10,6,24,0)'); c.fillStyle = g; c.fillRect(0, 0, 1080, 520); title(c, 980, 540, y0, 92, 'center');
    const wide = document.createElement('canvas'); wide.width = 1280; wide.height = 720; c = wide.getContext('2d');
    // landscape: a blurred, darkened fill of the same frame, the square around the subject's head on the right, the words on the left
    const sq = Math.max(0, Math.min(1920 - 1080, head.y - 470)); c.filter = 'blur(26px) brightness(0.5)'; c.drawImage(film, 0, sq + 200, 1080, 608, -40, -40, 1360, 800); c.filter = 'none';
    c.drawImage(film, 0, sq, 1080, 1080, 560, 0, 720, 720); const gx = c.createLinearGradient(540, 0, 760, 0); gx.addColorStop(0, 'rgba(14,10,30,1)'); gx.addColorStop(1, 'rgba(14,10,30,0)'); c.fillStyle = gx; c.fillRect(540, 0, 220, 720);
    c.fillStyle = 'rgba(14,10,30,0.55)'; c.fillRect(0, 0, 540, 720); title(c, 560, 44, 270, 80, 'left');
    return [doc.toDataURL('image/jpeg', 0.92).slice(23), wide.toDataURL('image/jpeg', 0.9).slice(23)];
  }, { t: Number(a[1]), top: a[2], plate: a[3], color: flag('color', '#ffc531'), y0: Number(flag('y', 150)) });
  fs.writeFileSync(a[4] + '_cover_doc.jpg', Buffer.from(out[0], 'base64')); fs.writeFileSync(a[4] + '_cover_ngang.jpg', Buffer.from(out[1], 'base64')); console.log(a[4] + '_cover_doc.jpg', a[4] + '_cover_ngang.jpg');
  await b.close(); srv.close();
})();
