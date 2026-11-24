// cine3d render tool.
//   stills: node tools/render.cjs stills <ep.js> <outDir> <t1,t2,...> [--q "dof=0.5&ss=2"] [--raw]   (--raw = no text layer)
//   pngseq: node tools/render.cjs pngseq <ep.js> <outDir> [--overlays-only | --board-only] [--fps 30] [--from s] [--to s]   (--overlays-only = RGBA PNGs of the 2-D text/overlay layer alone on a transparent background; + --split-additive = what is drawn with 'lighter' (additive glows) goes to <outDir>/add/ instead, to be ADDED by the compositor; --board-only = the setswap board alone, written only for frames where a swap is active, fade in board_meta.json)
//   any mode: --look2 = the opt-in look2 picture chain (core/look2.js; same as --q "look2=1")
//   video:  node tools/render.cjs mp4 <ep.js> <out.mp4> [--from s] [--to s] [--fps 30] [--audio file] [--crf 17] [--abr 192k] [--ar 48000] [--q ...]   (standard since 23/11/2026: 30 fps CFR, libx264 yuv420p CRF 17, AAC 192k 48 kHz) [--workers 2]
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), { start, flagOf } = require('./_page.cjs');   // the server / browser / page start-up is shared with tools/dump.cjs
const args = process.argv.slice(2), mode = args[0], epf = args[1], out = args[2], flag = flagOf(args);
(async () => {
  const S = await start(), Q = [flag('q', ''), args.includes('--look2') ? 'look2=1' : ''].filter(Boolean).join('&'), open = () => S.open(epf, Q);
  if (mode === 'stills') {
    const p = await open(), raw = args.includes('--raw'); fs.mkdirSync(out, { recursive: true });
    for (const t of args[3].split(',').map(Number)) { const d = await p.evaluate(({ t, raw }) => { window.seek(t, { overlays: !raw }); return document.getElementById('film').toDataURL('image/png').slice(22); }, { t, raw }); const f = path.join(out, `t${t.toFixed(2)}.png`); fs.writeFileSync(f, Buffer.from(d, 'base64')); console.log(f); }
  } else if (mode === 'mp4') {
    const FPS = Number(flag('fps', 30)), W = Number(flag('workers', 2)), BATCH = 6, pages = []; for (let i = 0; i < W; i++) pages.push(await open());
    const dur = await pages[0].evaluate(() => window.ep.dur), f0 = Math.round(Number(flag('from', 0)) * FPS), f1 = Math.round(Number(flag('to', dur)) * FPS), audio = flag('audio', null);
    const enc = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...(audio ? ['-ss', String(f0 / FPS), '-i', audio, '-c:a', 'aac', '-b:a', flag('abr', '192k'), '-ar', flag('ar', '48000'), '-shortest'] : []), '-c:v', 'libx264', '-profile:v', 'high', '-preset', flag('preset', 'slow'), '-crf', flag('crf', '17'), '-tune', 'animation', '-maxrate', '20M', '-bufsize', '40M',
      '-x264-params', `keyint=${FPS * 2}:min-keyint=${FPS}:aq-mode=3:colorprim=bt709:transfer=bt709:colormatrix=bt709`, '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', out];
    const ff = spawn('ffmpeg', enc, { stdio: ['pipe', 'inherit', 'inherit'] }), write = (buf) => new Promise((r) => { if (!ff.stdin.write(buf)) ff.stdin.once('drain', r); else r(); });
    const grab = (p, frames) => p.evaluate(({ frames, FPS }) => { const c = document.getElementById('film'), o = []; for (const f of frames) { window.seek((f + 0.5) / FPS); o.push(c.toDataURL('image/jpeg', 0.97).slice(23)); } return o; }, { frames, FPS });
    const t0 = Date.now(); let next = f0;
    while (next < f1) { const res = await Promise.all(pages.map((p, i) => { const s = next + i * BATCH, fr = []; for (let k = s; k < Math.min(f1, s + BATCH); k++) fr.push(k); return fr.length ? grab(p, fr) : []; })); for (const arr of res) for (const b64 of arr) await write(Buffer.from(b64, 'base64')); next += W * BATCH; const done = Math.min(next, f1) - f0; process.stdout.write(`\r${done}/${f1 - f0}  ${(done / ((Date.now() - t0) / 1000)).toFixed(1)} fps`); }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r)); console.log(`\n-> ${out}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } else if (mode === 'pngseq') {
    // PNG sequence f_00000.png ... (absolute frame numbers, t = (f + 0.5) / fps). --overlays-only = RGBA PNGs of the 2-D layer alone on a transparent background (no 3-D picture;
    // overlays that sample the picture are skipped and listed in <outDir>/overlay_meta.json); without it, the full RGB frames.
    const FPS = Number(flag('fps', 30)), W = Number(flag('workers', 2)), BATCH = 6, only = args.includes('--overlays-only'), boardOnly = args.includes('--board-only'), split = args.includes('--split-additive'), pages = []; for (let i = 0; i < W; i++) pages.push(await open());
    const dur = await pages[0].evaluate(() => window.ep.dur), f0 = Math.round(Number(flag('from', 0)) * FPS), f1 = Math.round(Number(flag('to', dur)) * FPS); fs.mkdirSync(out, { recursive: true });
    const grab = (p, frames) => p.evaluate(({ frames, FPS, only, boardOnly, split }) => { const c = document.getElementById('film'), o = []; for (const f of frames) { const t = (f + 0.5) / FPS; if (boardOnly) { const r = window.seekBoard(t); o.push({ f, png: r.a > 0 ? r.png : null, skipped: [], a: r.a }); } else if (only && split) { const r = window.seekOverlay(t, true, 'normal'), q = window.seekOverlay(t, true, 'add'); o.push({ f, png: r.png, add: q.png, skipped: r.skipped }); } else if (only) { const r = window.seekOverlay(t); o.push({ f, png: r.png, skipped: r.skipped }); } else { window.seek(t); o.push({ f, png: c.toDataURL('image/png').slice(22), skipped: [] }); } } return o; }, { frames, FPS, only, boardOnly, split });
    const t0 = Date.now(), skipped = {}, fades = {}; let next = f0;
    while (next < f1) { const res = await Promise.all(pages.map((p, i) => { const s2 = next + i * BATCH, fr = []; for (let k = s2; k < Math.min(f1, s2 + BATCH); k++) fr.push(k); return fr.length ? grab(p, fr) : []; }));
      for (const arr of res) for (const r of arr) { if (boardOnly) { if (r.png) { fs.writeFileSync(path.join(out, `f_${String(r.f).padStart(5, '0')}.png`), Buffer.from(r.png, 'base64')); fades[r.f] = Math.round(r.a * 1e4) / 1e4; } continue; } fs.writeFileSync(path.join(out, `f_${String(r.f).padStart(5, '0')}.png`), Buffer.from(r.png, 'base64')); if (r.add) { fs.mkdirSync(path.join(out, 'add'), { recursive: true }); fs.writeFileSync(path.join(out, 'add', `f_${String(r.f).padStart(5, '0')}.png`), Buffer.from(r.add, 'base64')); } if (r.skipped.length) skipped[r.f] = r.skipped; }
      next += W * BATCH; const done = Math.min(next, f1) - f0; process.stdout.write(`\r${done}/${f1 - f0}  ${(done / ((Date.now() - t0) / 1000)).toFixed(1)} fps`); }
    if (boardOnly) fs.writeFileSync(path.join(out, 'board_meta.json'), JSON.stringify({ ep: epf, fps: FPS, from_frame: f0, to_frame: f1, file_pattern: 'f_%05d.png (absolute frame numbers; written only where a setswap is active)', size: [1080, 1920], format: 'RGBA PNG, straight alpha; the board at full strength, the fade is in `fade` (also the dump frames[].swap)', frames: Object.keys(fades).length, fade: fades }));
    if (only) { const kinds = {}; for (const [f, l] of Object.entries(skipped)) for (const x of l) (kinds[`${x.kind}:${x.sample}`] ??= []).push(+f);
      fs.writeFileSync(path.join(out, 'overlay_meta.json'), JSON.stringify({ ep: epf, fps: FPS, first_frame: f0, frame_count: f1 - f0, file_pattern: 'f_%05d.png (absolute frame numbers, t = (f + 0.5) / fps)', size: [1080, 1920], format: 'RGBA PNG, straight (non-premultiplied) alpha',
        note: 'Overlays that sample the 3-D picture cannot run alone: they are skipped (backdrop: blur + dim, give the numbers per frame; cold / freeze_rewind: the grade of the picture below). skipped_frames lists, per skipped overlay, the first/last frame and count; skipped[f] has the numbers.',
        skipped_frames: Object.fromEntries(Object.entries(kinds).map(([k, fr]) => [k, { count: fr.length, first: fr[0], last: fr[fr.length - 1] }])), skipped }));
      console.log(`\nskipped (sample the picture): ${Object.keys(kinds).join(', ') || 'none'}`); }
    console.log(`\n-> ${out}  ${f1 - f0} frames (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  await S.close();
})();
