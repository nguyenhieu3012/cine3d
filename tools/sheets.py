#!/usr/bin/env python3
"""cine3d: one still per shot (at 60 % of the shot), tiled 5 x 3 at 360 px into contact sheets, so a whole episode can be checked by eye for a few thousand tokens.
  python3 tools/sheets.py episodes/<id>.js            -> out/<id>/cs1.jpg, cs2.jpg, ...   (prints the times on each sheet)
  python3 tools/sheets.py episodes/<id>.js 18.2 20.2 [n]   -> out/<id>/strip_18.20.jpg: n frames (default 8) spread over that stretch, to read ONE action in motion"""
import json, os, subprocess, sys, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ep = sys.argv[1]
info = json.loads(subprocess.run(['node', '-e', f"import('file://{os.path.join(ROOT, ep)}').then(m=>console.log(JSON.stringify({{id:m.default.id||'{os.path.basename(ep)[:-3]}',shots:m.default.shots.map(s=>[s.t0,s.t1])}})))"], capture_output=True, text=True, check=True, cwd=ROOT).stdout)
out = f"{ROOT}/out/{info['id']}"; tmp = f'{out}/_st'; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp, exist_ok=True)
strip = len(sys.argv) > 3
if strip: a, b, n = float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 8; ts = [a + (b - a) * i / (n - 1) for i in range(n)]
else: ts = [t0 + (t1 - t0) * 0.6 for t0, t1 in info['shots']]
subprocess.run(['node', 'tools/render.cjs', 'stills', ep, tmp, ','.join(f'{t:.2f}' for t in ts)], check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
names = [f'{t:.2f}' for t in ts]; per, cols = (len(names), len(names)) if strip else (15, 5)
for g in range(0, len(names), per):
    grp = names[g:g + per]; args = []
    for t in grp: args += ['-i', f'{tmp}/t{t}.png']
    w, h = (216, 384) if strip else (360, 640)
    fc = ''.join(f'[{k}]scale={w}:{h}[v{k}];' for k in range(len(grp))) + ''.join(f'[v{k}]' for k in range(len(grp))) + f'xstack=inputs={len(grp)}:layout=' + '|'.join(f'{(k % cols) * w}_{(k // cols) * h}' for k in range(len(grp))) + ':fill=black'
    f = f'{out}/strip_{names[0]}.jpg' if strip else f'{out}/cs{g // per + 1}.jpg'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args, '-filter_complex', fc if len(grp) > 1 else f'[0]scale={w}:{h}', '-q:v', '3', f], check=True); print(f, ' '.join(grp))
shutil.rmtree(tmp, ignore_errors=True)
