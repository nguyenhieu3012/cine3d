#!/usr/bin/env python3
"""HYBRID: soften the cast layer over a short window with a fading shutter: python3 blender/castmix.py <cast dir> <out dir> <t0> <t1> [--fps 60] [--ramp 0.15] [--top 0.5]
Frames inside [t0, t1] are mixed with the frame before (weight 0 -> top -> 0, premultiplied alpha, no step at the window edges); every other frame is copied.
Used for the door-glass burst + Tèo's leap (57.3-57.85 s of gta6p2): the hybrid's sharper layers made the last second's frame-to-frame jump 6.1 (smooth.py limit 6.0; the engine's own 4.0)."""
import sys, os, shutil, subprocess
a = [x for x in sys.argv[1:] if not x.startswith('--')]; src, dst, t0, t1 = a[0], a[1], float(a[2]), float(a[3])
opt = lambda n, d: float(sys.argv[sys.argv.index(n) + 1]) if n in sys.argv else d
fps, ramp, top = opt('--fps', 60), opt('--ramp', 0.15), opt('--top', 0.5)
os.makedirs(dst, exist_ok=True)
for n in sorted(os.listdir(src)):
    if not (n.startswith('f_') and n.endswith('.png')): continue
    f = int(n[2:7]); t = (f + 0.5) / fps; w = top * max(0, min(1, min((t - t0) / ramp, (t1 - t) / ramp)))
    d = os.path.join(dst, n)
    if os.path.exists(d): continue
    if w <= 0.001: os.symlink(os.path.abspath(os.path.join(src, n)), d); continue
    prev = os.path.join(src, f'f_{f - 1:05d}.png')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(src, n), '-i', prev, '-filter_complex', f"[0]format=rgba,premultiply=inplace=1[a];[1]format=rgba,premultiply=inplace=1[b];[a][b]blend=all_expr='A*(1-{w:.4f})+B*{w:.4f}',unpremultiply=inplace=1,format=rgba", '-frames:v', '1', '-update', '1', d], check=True)
print('castmix ->', dst)
