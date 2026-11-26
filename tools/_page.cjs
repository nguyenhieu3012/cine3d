// cine3d tools: the headless page every tool shares (static server for the folder, Chromium with the GPU flags, the film page of an episode).
// Used by render.cjs, dump.cjs, qa.cjs, clipcheck.cjs, events.cjs, cover.cjs.
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GPU = process.env.CINE3D_GPU_ARGS
  ? process.env.CINE3D_GPU_ARGS.split(/\s+/).filter(Boolean)
  : (process.platform === 'darwin'
    ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync']
    : ['--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync']);
const READY_TIMEOUT = Number(process.env.CINE3D_READY_TIMEOUT_MS || (process.platform === 'darwin' ? 60000 : 120000));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.otf': 'font/otf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const stripQuery = (epf) => String(epf || '').split('&')[0].split('?')[0];
const serve = () => new Promise((res) => { const srv = http.createServer((req, rsp) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, d) => { if (e) { rsp.writeHead(404); return rsp.end('404'); } rsp.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); rsp.end(d); }); }); srv.listen(0, () => res(srv)); });
// flag(name, default) reads `--name value` from the argument list
const flagOf = (args) => (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
// starts the server and the browser; returns { srv, b, open(epf, Q) -> page waiting for window.filmReady, close() }
async function start() {
  const srv = await serve(), port = srv.address().port, b = await chromium.launch({ args: GPU });
  const open = async (epf, Q = '') => { const p = await b.newPage({ viewport: { width: 540, height: 960 } }); p.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); }); p.on('pageerror', (e) => console.log('PAGEERR', e.message)); await p.goto(`http://localhost:${port}/index.html?render=1&ep=${epf}${Q ? '&' + Q : ''}`); await p.waitForFunction(() => window.filmReady, null, { timeout: READY_TIMEOUT }); return p; };
  return { srv, b, port, open, close: async () => { await b.close(); srv.close(); } };
}
module.exports = { ROOT, GPU, MIME, READY_TIMEOUT, stripQuery, serve, flagOf, start };

