// three-way comparison video with labels: node tools/sbs3.cjs <a.mp4> <b.mp4> <c.mp4> <out.mp4> "<label a>" "<label b>" "<label c>" [frames] [fps]
// Each input is resampled to [fps] (default 30) and scaled to 720x1280; sound from the RIGHT-hand video. [frames] = exact output frame count
// (default: the right-hand video's). Labels are drawn in a headless page (this ffmpeg build has no drawtext).
const { chromium } = require('playwright'), { execFileSync } = require('child_process'), os = require('os'), path = require('path');
const [A, B, C, out, la, lb, lc, nfrArg, fpsArg] = process.argv.slice(2);
const fps = String(fpsArg || 30);
const nfr = nfrArg || execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', C]).toString().trim();
(async () => {
  const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 2160, height: 110 } });
  const cell = (t, col) => `<div style="width:720px;height:110px;line-height:110px;text-align:center;color:${col}">${t}</div>`;
  await p.setContent(`<body style="margin:0;display:flex;font:800 52px -apple-system,Helvetica,sans-serif;background:#0c0a18">${cell(la, '#fff')}${cell(lb, '#9fd3ff')}${cell(lc, '#ffc531')}</body>`);
  const lab = path.join(os.tmpdir(), `sbs3_label_${process.pid}.png`); await p.screenshot({ path: lab }); await br.close();
  const fc = `[0:v]fps=${fps},scale=720:1280,setsar=1[a];[1:v]fps=${fps},scale=720:1280,setsar=1[b];[2:v]fps=${fps},scale=720:1280,setsar=1[c];[a][b][c]hstack=3[v];[3:v][v]vstack=2:shortest=1[o]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', A, '-i', B, '-i', C, '-loop', '1', '-framerate', fps, '-i', lab, '-filter_complex', fc, '-map', '[o]', '-map', '2:a?',
    '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', fps, '-c:a', 'aac', '-b:a', '192k', '-frames:v', nfr, '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('->', out, nfr, 'frames');
})();
