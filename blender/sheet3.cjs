// Three-row contact sheet, one column per shot (mid-shot frame), rows = the three videos, labelled:
//   node blender/sheet3.cjs <dump.json> <out.jpg> <a.mp4> "<label a>" <b.mp4> "<label b>" <c.mp4> "<label c>" [--w 300] [--from 0] [--to 15.6]
// Frames are pulled with ffmpeg at the shot's middle time (each video is read at its own fps); labels drawn in headless Chromium (no drawtext here).
const { chromium } = require('playwright'), { execFileSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [dumpF, out, A, la, B, lb, C, lc] = argv;
const W = +opt('--w', 300), T0 = +opt('--from', 0), T1 = +opt('--to', 1e9);
const shots = JSON.parse(fs.readFileSync(dumpF, 'utf8')).header.shots.filter(s => s.t1 > T0 + 1e-3 && s.t0 < T1 - 1e-3);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet3_'));
const grab = (v, t, f) => { execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', v, '-frames:v', '1', '-vf', `scale=${W}:-2`, '-q:v', '3', f]); return 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64'); };
const rows = [[A, la, '#fff'], [B, lb, '#9fd3ff'], [C, lc, '#ffc531']];
const cols = shots.map(s => { const t = (Math.max(s.t0, T0) + Math.min(s.t1, T1)) / 2; return { s, t, im: rows.map(([v], r) => grab(v, t, path.join(tmp, `s${s.i}_${r}.jpg`))) }; });
const head = cols.map(c => `<div class="h">#${c.s.i} ${c.s.cam}<br><span>${c.t.toFixed(2)} s</span></div>`).join('');
const body = rows.map(([, l, col], r) => `<div class="lab" style="color:${col}">${l}</div>` + cols.map(c => `<img src="${c.im[r]}">`).join('')).join('');
const html = `<html><body style="margin:0;background:#0c0a18;color:#eee;font:700 20px Helvetica,Arial,sans-serif"><style>
.g{display:grid;grid-template-columns:150px repeat(${cols.length},${W}px);gap:6px;padding:12px}.h{text-align:center;font-size:18px;color:#ddd}.h span{color:#999;font-weight:500}
.lab{display:flex;align-items:center;font-size:22px;padding-right:6px}img{display:block;width:${W}px}</style><div class="g"><div></div>${head}${body}</div></body></html>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 180 + cols.length * (W + 6), height: 600 } }); await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 88 }); await b.close(); fs.rmSync(tmp, { recursive: true }); console.log('->', out, cols.length, 'shots'); })();
