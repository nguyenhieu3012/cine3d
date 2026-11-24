#!/usr/bin/env python3
"""Contact sheet: one still per time, Blender (top row) over cine3d (bottom row), labelled. System python3 + ffmpeg.
  python3 blender/sheet.py <blender_stills_dir> <cine3d_stills_dir> <out.jpg> t1,t2,... [--w 360]
Stills are named t<t:.2f>.jpg (Blender, render_ep.py --at) and t<t:.2f>.png (cine3d, render.cjs stills)."""
import os, subprocess, sys


def main():
    a = sys.argv[1:]
    bdir, cdir, out, ts = a[0], a[1], a[2], [float(x) for x in a[3].split(',')]
    w = int(a[a.index('--w') + 1]) if '--w' in a else 360
    h = w * 16 // 9
    ins, fl = [], []
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import compose
    GRADE = compose.DISPLAY_GRADE + ',vignette=angle=' + compose.GRADE['vignette']   # Blender stills get the same display grade as the film
    def lab(i, src, row):
        ins.extend(['-i', src])
        fl.append(f"[{i}]scale={w}:{h},{GRADE if row == 0 else 'null'},pad={w + 4}:{h + 4}:2:2:color=black[v{i}]")   # this ffmpeg has no drawtext: rows are fixed (top Blender, bottom cine3d), times left to right
    n = 0
    for row, (d, ext, name) in enumerate(((bdir, '.jpg', 'Blender'), (cdir, '.png', 'cine3d'))):
        for t in ts:
            p = os.path.join(d, f't{t:.2f}{ext}')
            lab(n, p, row); n += 1
    k = len(ts)
    fl.append(''.join(f'[v{i}]' for i in range(k)) + f'hstack={k}[r0]')
    fl.append(''.join(f'[v{i}]' for i in range(k, 2 * k)) + f'hstack={k}[r1]')
    fl.append('[r0][r1]vstack[o]')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *ins, '-filter_complex', ';'.join(fl), '-map', '[o]', '-frames:v', '1', '-q:v', '3', out], check=True)
    print('->', out)


if __name__ == '__main__':
    main()
