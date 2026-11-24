// Labelled check image (Blender left, cine3d right) from crop pairs: node blender/checksheet.cjs <dir with items.json + *_bl.png/_c3.png> <out.jpg> [title]
// (this machine's ffmpeg has no drawtext, so the labels are drawn by the headless Chromium cine3d already uses)
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), title = process.argv[4] || '';
const items = JSON.parse(fs.readFileSync(path.join(dir, 'items.json'), 'utf8'));
const img = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
const cell = ([n, lab]) => `<div class="pair"><div class="lab">${lab}</div><div class="row"><figure><img src="${img(n + '_bl.png')}"><figcaption>Blender</figcaption></figure><figure><img src="${img(n + '_c3.png')}"><figcaption>cine3d</figcaption></figure></div></div>`;
const html = `<html><body style="margin:0;background:#16161c;color:#eee;font:600 22px Helvetica,Arial,sans-serif"><style>
.grid{display:flex;flex-wrap:wrap;gap:18px;padding:18px;width:3300px}.pair{background:#22222a;padding:10px;border-radius:8px}.lab{font-size:26px;margin:0 0 8px 4px;color:#ffd45a}
.row{display:flex;gap:8px}figure{margin:0}img{display:block;max-height:620px}figcaption{text-align:center;font-size:20px;color:#bbb;margin-top:4px}</style>
<div style="padding:18px 18px 0;font-size:30px">${title}</div><div class="grid">${items.map(cell).join('')}</div></body></html>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 3340, height: 800 } }); await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 90 }); await b.close(); console.log('->', out); })();
