#!/usr/bin/env python3
"""Hybrid stills with every layer (same filter chain as compose.py): python3 blender/hybrid_still.py <hybrid dir> <t,t,...> <out dir> [--fps 60] [--freeze-from-frame N]
Needs <dir>/bl/stills/t<t>.jpg (render_ep --nocast --at), <dir>/cast_stills/f_<frame>.png (castpass --at), <dir>/overlay/ (+ add/). Writes <out>/t<t>.png."""
import sys, os, subprocess
d, ts, out = sys.argv[1], sys.argv[2].split(','), sys.argv[3]
fps = int(sys.argv[sys.argv.index('--fps') + 1]) if '--fps' in sys.argv else 60
os.makedirs(out, exist_ok=True)
for t in ts:
    f = int(float(t) * fps); bg = os.path.join(d, 'bl/stills', f't{float(t):.2f}.jpg'); ca = os.path.join(d, 'cast_stills', f'f_{f:05d}.png')
    if '--from-frames' in sys.argv: bg = os.path.join(d, 'bl/frames', f'f_{f:05d}.jpg'); ca = os.path.join(d, 'cast', f'f_{f:05d}.png')   # stills cut from a finished / running full render
    ov = os.path.join(d, 'overlay', f'f_{f:05d}.png'); ad = os.path.join(d, 'overlay/add', f'f_{f:05d}.png')
    fc = ("[0]format=gbrp,eq=contrast=1.06:saturation=0.92,vignette=angle=PI/12,format=rgba[b];[1]format=rgba[c];[b][c]overlay=format=auto,format=gbrp[pg];"
          "[3]format=rgba,premultiply=inplace=1,format=gbrp[g];[pg][g]blend=all_mode=addition,noise=alls=2:all_seed=7,format=rgba[p];[2]format=rgba[o];[p][o]overlay=format=auto")
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', bg, '-i', ca, '-i', ov, '-i', ad, '-filter_complex', fc, '-frames:v', '1', '-update', '1', os.path.join(out, f't{float(t):.2f}.png')], check=True)
print('ok', out)
