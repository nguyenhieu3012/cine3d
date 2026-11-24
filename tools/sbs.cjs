// side-by-side comparison video with labels: node tools/sbs.cjs <left.mp4> <right.mp4> <out.mp4> "<left label>" "<right label>" [seconds] [frames]
// [frames] (optional): exactly this many output frames (no -shortest cut by the audio packets); pass '' as seconds to skip it
// the sound comes from the right-hand video. Labels are drawn in a headless page (this ffmpeg build has no drawtext).
const { chromium } = require('playwright'), { execFileSync } = require('child_process'), os = require('os'), path = require('path');
const [L, R, out, a, b, dur, nfr] = process.argv.slice(2);
(async () => {
  const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 2160, height: 120 } });
  await p.setContent(`<body style="margin:0;display:flex;font:800 60px -apple-system,Helvetica,sans-serif;background:#0c0a18"><div style="width:1080px;height:120px;line-height:120px;text-align:center;color:#fff">${a}</div><div style="width:1080px;height:120px;line-height:120px;text-align:center;color:#ffc531">${b}</div></body>`);
  const lab = path.join(os.tmpdir(), `sbs_label_${process.pid}.png`); await p.screenshot({ path: lab }); await br.close();
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...(dur ? ['-t', dur] : []), '-i', L, ...(dur ? ['-t', dur] : []), '-i', R, '-loop', '1', '-framerate', '30', '-i', lab, '-filter_complex', '[0:v]fps=30,scale=1080:1920,setsar=1[l];[1:v]fps=30,scale=1080:1920,setsar=1[r];[l][r]hstack=2[v];[2:v][v]vstack=2:shortest=1' + (nfr ? '[o]' : ',fps=30[o]'), '-map', '[o]', '-map', '1:a?', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', ...(nfr ? ['-frames:v', nfr] : ['-shortest']), '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('->', out);
})();
