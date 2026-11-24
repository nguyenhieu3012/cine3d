// Mouth envelopes from the real voice. For each line of an episode: 60 values per second, 0..1, cut from that speaker's voice stem.
//   node tools/lips.cjs <ep.js> --stem teo=/path/vo_teo.wav --stem bip=/path/vo_bip.wav [--stem '*=/path/mix.wav'] --out demo/x_lips.json
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2), stems = {}; let out = null;
for (let i = 1; i < args.length; i++) { if (args[i] === '--stem') { const [k, v] = args[++i].split('='); stems[k] = v; } else if (args[i] === '--out') out = args[++i]; }
(async () => {
  const ep = (await import('file://' + path.resolve(args[0]))).default, SR = 16000, HZ = 60, cache = {};
  const load = (f) => cache[f] ||= (() => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }); const a = new Float32Array(b.buffer, b.byteOffset, b.length / 4), n = Math.ceil(a.length / SR * HZ), e = new Float32Array(n), w = Math.round(SR / HZ);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = i * w; j < Math.min(a.length, (i + 1) * w); j++) s += a[j] * a[j]; e[i] = Math.sqrt(s / w); }
    const sorted = [...e].filter((x) => x > 1e-4).sort((x, y) => x - y), p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
    let prev = 0; for (let i = 0; i < n; i++) { let v = Math.min(1, Math.pow(e[i] / p95, 0.65)); if (v < 0.08) v = 0; prev = v > prev ? prev + (v - prev) * 0.75 : prev + (v - prev) * 0.4; e[i] = Math.round(prev * 1000) / 1000; } return e; })();
  const res = {}; let n = 0;
  ep.lines.forEach((l, i) => { const f = stems[l.who] || stems['*']; if (!f) return; const e = load(f), a = Math.round((l.t0 + (ep.audioOffset || 0)) * HZ), b = Math.round((l.t1 + (ep.audioOffset || 0)) * HZ); res[i] = Array.from(e.slice(a, b + 1)); n++; });
  fs.writeFileSync(out, JSON.stringify(res)); console.log(`${n} / ${ep.lines.length} lines -> ${out}`);
})();
