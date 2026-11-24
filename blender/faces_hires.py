#!/usr/bin/env python3
"""Face drawings at 2x for close-ups: the engine paints Tèo's / Bíp's face at 512 px; a close-up magnifies it ~3x, and Blender's
bilinear filtering then softens the lines. A Lanczos 2x copy (alpha kept, exact frame numbers) keeps them crisp.
  python3 blender/faces_hires.py out/<id>/blender/faces      -> out/<id>/blender/faces2x/<who>/f_%05d.png (+ faces_meta.json copied)"""
import json, os, shutil, subprocess, sys

src = os.path.abspath(sys.argv[1]); dst = src.rstrip('/') + '2x'
meta = json.load(open(os.path.join(src, 'faces_meta.json')))
os.makedirs(dst, exist_ok=True); shutil.copy(os.path.join(src, 'faces_meta.json'), dst)
f0 = meta['first_frame']
for who in meta['who']:
    os.makedirs(os.path.join(dst, who), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-start_number', str(f0), '-i', os.path.join(src, who, 'f_%05d.png'),
                    '-vf', 'format=rgba,scale=iw*2:ih*2:flags=lanczos', '-start_number', str(f0), os.path.join(dst, who, 'f_%05d.png')], check=True)
    print(who, len(os.listdir(os.path.join(dst, who))), 'frames ->', os.path.join(dst, who))
