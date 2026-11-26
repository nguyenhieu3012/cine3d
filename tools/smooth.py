#!/usr/bin/env python3
"""cine3d: is the rendered video smooth? Measures how much each frame differs from the one before (ffmpeg signalstats YDIF) and how much that change JUMPS
from frame to frame. A smooth film (30 fps standard since 23/11, 60 fps still accepted) has a low, even series; popping heads, on/off flicker or dropped frames show as spikes.
  ~/tdvai/.venv/bin/python tools/smooth.py out/<id>/<id>.mp4 [seconds] [--ep episodes/<id>.js | --cuts t1,t2,...] [--out dir] [--ignore t0-t1,...]
v4 (13/11): the cuts are taken BY TIME from the episode's shot list (--ep; found by itself for out/<id>/<id>*.mp4 when episodes/<id>.js exists; --cuts = a list of seconds),
not by the old `d < 12` mask, so a large pop INSIDE a shot now counts. Without a cut list the old mask comes back, loudly, and says so.
Verdict: FAIL when the worst 1-second window's mean jump or any single non-cut jump is over its limit (limits below, from Ngày 12 and Ngày 13 renders; the window limit and the mean rule scale with 60/fps because a frame at 30 fps covers twice the motion of one at 60 fps; the single-jump limit does not, a pop is a pop at any rate), or when the old
mean / duplicate-frame rule trips. For the 3 worst non-cut jumps it writes out/<id>/smooth_worst_N.jpg = frame before | frame after | difference (red box = what moved).
Waivers: the episode's `waive: [{ check: 'smooth', t0, t1, reason }]` (and --ignore t0-t1) remove a time window from the jump tests; each is printed. Hit-stop (`hits`) windows and the +-2 frames around every overlay start / end (a plate or cloud switching on or off is a designed 2-D change) are removed too.
Reference (Ngày 12, 13/11): the cut the owner called "giật" scored mean 0.21 / 53 spikes in the first 18 s; the fixed cut 0.10 / 18. Aim for mean <= 0.12 at 60 fps (0.24 at 30 fps) and no duplicate frames. Recalibrated at 30 fps on 23/11: same footage measures about 2.4x the per-frame jump at 30 fps as at 60 fps.
Last line: `SMOOTH PASS (SMOOTH OK)` (exit 0) or `SMOOTH FAIL` (exit 1). Arguments: <mp4> [seconds] [--ep episodes/<id>.js | --cuts ..] [--out dir] [--ignore ..]; there is no positional episode argument."""
import subprocess, sys, os, json, math
from fractions import Fraction
import numpy as np

WINDOW_MAX_60 = 0.60   # mean jump of any 1 s window AT 60 FPS (units of YDIF, 270x480). Ngày 12 / gb04: see docs/v4-qa.md. Scaled by 60/fps below (1.20 at 30 fps)
JUMP_MAX = 6.0         # one non-cut frame-to-frame jump; NOT scaled with fps (a pop is a pop; the real footage's worst single jump was 1.95 at 30 fps, 2.46 at 60 fps)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv[1:]
def opt(name, default=None):
    if name in argv:
        i = argv.index(name); v = argv[i + 1]; del argv[i:i + 2]; return v
    return default
epf, cuts_arg, outdir, ignore = opt('--ep'), opt('--cuts'), opt('--out'), opt('--ignore')
f = argv[0]; secs = float(argv[1]) if len(argv) > 1 else None
t = ['-t', str(secs)] if secs else []
stem = os.path.splitext(os.path.basename(f))[0]; vid = os.path.basename(os.path.dirname(os.path.abspath(f)))   # out/<id>/<name>.mp4
if not epf and not cuts_arg:
    for cand in (vid, stem, stem.split('_')[0]):
        if os.path.exists(f'{ROOT}/episodes/{cand}.js'): epf = f'episodes/{cand}.js'; break

probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', f], capture_output=True, text=True)
st0 = (json.loads(probe.stdout).get('streams') or [{}])[0] if probe.returncode == 0 and probe.stdout.strip() else {}
vw, vh = int(st0.get('width') or 1080), int(st0.get('height') or 1920)
def parse_fps(s):
    try:
        v = float(Fraction(str(s or '30/1').strip()))
        return v if v > 0 else 30.0
    except Exception:
        return 30.0
fps = parse_fps(st0.get('r_frame_rate'))
wide = vw > vh
sc_ydif = '480:270' if wide else '270:480'
fw, fh = (960, 540) if wide else (540, 960)

raw = subprocess.run(['ffmpeg', '-v', 'error', *t, '-i', f, '-vf', f'scale={sc_ydif},signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-', '-f', 'null', '-'], capture_output=True, text=True).stdout
d = np.array([float(l.split('=')[1]) for l in raw.splitlines() if 'YDIF' in l]); n = len(d)
WINDOW_MAX = WINDOW_MAX_60 * (60 / fps)   # 0.60 at 60 fps (unchanged), 1.20 at 30 fps
med = np.array([np.median(d[max(0, i - 2):i + 3]) for i in range(n)]); j = np.abs(d - med)

# ---- cuts, hit-stops and waivers, by time ----
cuts, hits, waive, edges, src = [], [], [], [], ''
if cuts_arg:
    cuts = [float(x) for x in cuts_arg.split(',') if x]; src = 'cut list given'
elif epf:
    js = "const m=await import('./%s');const e=m.default;console.log(JSON.stringify({cuts:e.shots.map(s=>s.t0).filter(x=>x>0),hits:(e.hits||[]).map(h=>({t:h.t,d:(h.frames??3)/(e.fps||30)})),edges:(e.overlays||[]).flatMap(o=>[o.t0,o.t1]).filter(x=>typeof x==='number'),waive:(e.waive||[]),fps:e.fps}))" % epf.lstrip('./')
    r = subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT, capture_output=True, text=True)
    try:
        E = json.loads(r.stdout.strip().splitlines()[-1]); cuts, hits, waive, edges = E['cuts'], E['hits'], E['waive'], E.get('edges', []); src = f'{len(cuts)} cuts from {epf}'
    except Exception:
        print(f'WARNING: could not read {epf} ({r.stderr.strip()[:120]}); falling back to the old d < 12 cut mask')
if ignore:
    for w in ignore.split(','):
        a, b = w.split('-'); waive.append({'check': 'smooth', 't0': float(a), 't1': float(b), 'reason': '--ignore'})
mask = np.zeros(n, bool)   # True = not a glitch candidate
if cuts:
    for c in cuts:
        i = math.ceil(c * fps - 0.5)   # first frame whose centre time is at or after the cut (render.cjs samples (f + 0.5) / fps)
        mask[max(0, i - 1):i + 2] = True
else:
    mask = d >= 12; src = 'NO CUT LIST: cuts guessed by d >= 12 (large pops can hide; give --ep or --cuts)'
for e in edges:
    if e <= 0: continue   # an overlay that starts before the film (t0 < 0) has no visible edge; a negative index used to mask almost the whole film (found on camon3, 17/11)
    mask[max(0, int(e * fps) - 2):int(e * fps) + 4] = True   # an overlay (text plate, thought cloud, card) switching on or off is a designed 2-D change, not a 3-D pop
for h in hits: mask[max(0, int((h['t'] - 0.05) * fps)):int((h['t'] + h['d'] + 0.05) * fps) + 2] = True
waived = []
for w in waive:
    if w.get('check') != 'smooth': continue
    a, b = int(max(0, w.get('t0', 0) * fps)), int(min(n, w.get('t1', 1e9) * fps) + 1); mask[a:b] = True; waived.append(w)
ok = ~mask
if n > 0: ok[0] = False
dup_ok = ok.copy()   # duplicate frames count outside cuts, hit-stops and waivers only
dups = int(((d < 0.005) & dup_ok).sum()) if n > 0 else 0

# ---- the old summary line (now without the d < 12 mask when the cuts are known) ----
if n == 0 or int(ok.sum()) == 0:
    print(f'{n} frames at {fps:.2f} fps | no unmasked frames to measure (cuts: {src})')
    print('SMOOTH FAIL' if n == 0 else 'SMOOTH PASS (SMOOTH OK)')
    sys.exit(1 if n == 0 else 0)
mean_j = float(j[ok].mean())
p95_j = float(np.percentile(j[ok], 95))
print(f'{n} frames at {fps:.2f} fps | jump between frames: mean {mean_j:.3f}, p95 {p95_j:.3f}, spikes > 1.0: {int((j[ok] > 1.0).sum())} | duplicate frames: {dups}')
worst = sorted([(j[i], i) for i in range(n) if ok[i]], reverse=True)[:8]
print('worst moments (s): ' + ', '.join(f'{i / fps:.2f}' for _, i in sorted(worst, key=lambda x: x[1])))
print(f'cuts: {src}' + (f' | hit-stops {len(hits)}' if hits else '') + (f' | overlay edges {len(edges)} (+-2 frames excluded)' if edges else '') + (f' | waived {len(waived)}' if waived else ''))
for w in waived: print(f"  WAIVED smooth {w.get('t0', 0)}..{w.get('t1', '')} s: {w.get('reason', '(no reason)')}")

# ---- per-second windows ----
W = max(1, int(round(fps))); wins = []
for k in range(0, n, W):
    sel = ok[k:k + W]
    if sel.sum() >= max(1, W // 2): wins.append((float(j[k:k + W][sel].mean()), k / fps, float(j[k:k + W][sel].max())))
bw = max(wins) if wins else (0, 0, 0)
print(f'worst 1 s window: {bw[0]:.3f} mean jump at {bw[1]:.0f}..{bw[1] + 1:.0f} s (limit {WINDOW_MAX:.2f}); worst single jump {worst[0][0]:.2f} at {worst[0][1] / fps:.2f} s (limit {JUMP_MAX})' if worst else 'no frames')
fails = []
for m, s0, mx in sorted(wins, reverse=True):
    if m > WINDOW_MAX: fails.append(f'window {s0:.0f}..{s0 + 1:.0f} s: mean jump {m:.3f} (limit {WINDOW_MAX:.2f})')
for v, i in worst:
    if v > JUMP_MAX: fails.append(f'jump at {i / fps:.2f} s: {v:.2f} (limit {JUMP_MAX})')
if mean_j > 0.12 * (60 / fps): fails.append(f'mean jump {mean_j:.3f} > {0.12 * (60 / fps):.3f}')
if dups > 2: fails.append(f'{dups} duplicate frames (> 2)')

# ---- what moved: before | after | difference with its box, for the 3 worst non-cut jumps ----
def frames(i):   # frames i-1 and i as RGB at fw x fh (a seek, not a decode from 0)
    r = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, (i - 1.25) / fps):.4f}', '-i', f, '-vf', f'scale={fw}:{fh}', '-frames:v', '2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True)
    k = fw * fh * 3
    return (np.frombuffer(r.stdout[:k], np.uint8).reshape(fh, fw, 3), np.frombuffer(r.stdout[k:2 * k], np.uint8).reshape(fh, fw, 3)) if len(r.stdout) >= 2 * k else (None, None)
def jpg(arr, path):
    h, w, _ = arr.shape
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-i', '-', '-frames:v', '1', '-q:v', '3', path], input=arr.tobytes())
def box_on(img, b, col=(255, 40, 40), th=3):
    x0, y0, x1, y1 = b; img[y0:y0 + th, x0:x1] = col; img[y1 - th:y1, x0:x1] = col; img[y0:y1, x0:x0 + th] = col; img[y0:y1, x1 - th:x1] = col
od = outdir or f'{ROOT}/out/{vid}'; os.makedirs(od, exist_ok=True); shown = []
for rank, (v, i) in enumerate(worst[:3], 1):
    a, b = frames(i)
    if a is None or b is None: continue
    diff = np.abs(a.astype(int) - b.astype(int)).max(axis=2); hot = diff > max(20, 0.25 * diff.max())
    if hot.sum() < 4: box = (0, 0, fw, fh); where = 'spread thinly over the whole frame'
    else:
        ys, xs = np.where(hot); x0, x1 = int(np.percentile(xs, 0.5)), int(np.percentile(xs, 99.5)); y0, y1 = int(np.percentile(ys, 0.5)), int(np.percentile(ys, 99.5))
        box = (x0, y0, max(x1, x0 + 4), max(y1, y0 + 4)); cx, cy = (x0 + x1) / 2 / fw, (y0 + y1) / 2 / fh
        where = f"{'top' if cy < 0.33 else 'middle' if cy < 0.66 else 'bottom'} {'left' if cx < 0.33 else 'centre' if cx < 0.66 else 'right'}, {100 * (x1 - x0) / fw:.0f} % wide x {100 * (y1 - y0) / fh:.0f} % tall, {100 * hot.mean():.2f} % of the frame changed"
    A, B2, D = a.copy(), b.copy(), np.clip(np.stack([diff * 4] * 3, axis=2), 0, 255).astype(np.uint8)
    for im in (A, B2, D): box_on(im, box)
    strip = np.concatenate([np.array(im[::2, ::2]) for im in (A, B2, D)], axis=1)
    path = f'{od}/smooth_worst_{rank}.jpg'; jpg(strip, path); shown.append(path)
    print(f'  worst {rank}: t {i / fps:.3f} s (frame {i}), jump {v:.2f}, changed box x {box[0] * 2}-{box[2] * 2}, y {box[1] * 2}-{box[3] * 2} of {vw}x{vh} ({where}) -> {path}')
for x in fails: print('FAIL ' + x)
print('SMOOTH PASS (SMOOTH OK)' if not fails else 'SMOOTH FAIL')   # 14/11: PASS is the word the manuals and the skill use; `SMOOTH OK` stays in the same line for older scripts
sys.exit(1 if fails else 0)
