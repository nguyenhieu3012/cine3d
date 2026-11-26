// Mouth envelopes from the real voice. For each line of an episode: 60 values per second, 0..1, cut from that speaker's voice stem.
//   node tools/lips.cjs <ep.js> --stem teo=/path/vo_teo.wav --stem bip=/path/vo_bip.wav [--stem '*=/path/mix.wav'] --out demo/x_lips.json
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2), stems = {}; let out = null;
for (let i = 1; i < args.length; i++) { if (args[i] === '--stem') { const [k, v] = args[++i].split('='); stems[k] = v; } else if (args[i] === '--out') out = args[++i]; }
(async () => {
  const ep = (await import('file://' + path.resolve(args[0]))).default, SR = 16000, HZ = 60, cache = {};
  const load = (f) => cache[f] ||= (() => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }); const aligned = (b.byteOffset % 4 === 0) ? b : Buffer.from(b); const a = new Float32Array(aligned.buffer, aligned.byteOffset, Math.floor(aligned.byteLength / 4)), n = Math.ceil(a.length / SR * HZ), e = new Float32Array(n);
    for (let i = 0; i < n; i++) { const j0 = Math.floor(i * SR / HZ), j1 = Math.min(a.length, Math.floor((i + 1) * SR / HZ)); let s = 0; for (let j = j0; j < j1; j++) s += a[j] * a[j]; e[i] = Math.sqrt(s / Math.max(1, j1 - j0)); }
    const sorted = [...e].filter((x) => x > 1e-4).sort((x, y) => x - y), p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
    let prev = 0; for (let i = 0; i < n; i++) { let v = Math.min(1, Math.pow(e[i] / p95, 0.65)); if (v < 0.08) v = 0; prev = v > prev ? prev + (v - prev) * 0.75 : prev + (v - prev) * 0.4; e[i] = Math.round(prev * 1000) / 1000; } return e; })();
  const res = {}; let n = 0;
  ep.lines.forEach((l, i) => { const f = stems[l.who] || stems['*']; if (!f) return; const e = load(f), a = Math.max(0, Math.round((l.t0 + (ep.audioOffset || 0)) * HZ)), b = Math.max(a, Math.round((l.t1 + (ep.audioOffset || 0)) * HZ)); res[i] = Array.from(e.slice(a, b + 1)); n++; });
  fs.writeFileSync(out, JSON.stringify(res)); console.log(`${n} / ${ep.lines.length} lines -> ${out}`);
})();
