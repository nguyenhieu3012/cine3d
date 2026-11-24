"""Framing QA of the Blender camera, every frame: project each character's head centre / top / eyes / mouth to pixels (1080 x 1920, y down)
and check the house rules for the shot's subject(s): head never cut, eye line 28-44 % from the top (singles), mouth above the caption band
(y 1260), both heads in frame on a two-shot. Writes qa.json {summary, per_shot, frames}."""
import bpy, json, re
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
import c3d

W, H = 1080, 1920
CAP_Y = 1260
EYE_BAND = (0.28, 0.44)
# points on the head in the ENGINE's local frame (+Y up, +Z forward), metres
PTS = {'teo': {'eyes': (0, 0.0, 0.16), 'mouth': (0, -0.085, 0.155)}, 'bip': {'eyes': (0, 0.022, 0.18), 'mouth': (0, -0.07, 0.18)}}


def subjects(token, cast):
    if token.startswith(('two', 'wide', 'all')):
        return list(cast), 'two'
    m = re.match(r'(ms|cu|ecu|ots)_([a-z]+)', token)
    if m and m.group(2) in cast:
        return [m.group(2)], m.group(1)
    return [], 'free'


def load_points(header):
    """eye / mouth points from the exported joint maps (head frame), when present"""
    import os
    d = os.path.join(c3d.CINE, 'out', 'chars')
    for n in header['cast']:
        p = os.path.join(d, f'{n}.joints.json')
        if os.path.exists(p):
            F = json.load(open(p))['poses']['seated']['face']
            e = [(a + b) / 2 for a, b in zip(F['eye_in_head_L'], F['eye_in_head_R'])]
            PTS[n] = {'eyes': tuple(e), 'mouth': tuple(F['mouth_in_head'])}


def run(header, frames, fids, heads, path):
    load_points(header)
    sc = bpy.context.scene; cam = sc.camera
    cast = [c for c in header['cast'] if c in heads]
    sizes = header['units']['character_size']
    recs = []; fails = {}; per_shot = {}
    for f, fr in zip(fids, frames):
        sc.frame_set(f)
        subj, kind = subjects(fr['cam_token'], cast)
        row = {'f': f, 'shot': fr['shot'], 'cam': fr['cam_token'], 'chars': {}}
        for n in cast:
            h = heads[n]; M = h.matrix_world; R = sizes[n]['head_radius']
            def px(local):
                p = world_to_camera_view(sc, cam, M @ Vector(local))
                return [round(p.x * W, 1), round((1 - p.y) * H, 1), round(p.z, 3)]
            c = px((0, 0, 0)); top = px((0, R, 0)); bot = px((0, -R, 0))
            r_px = abs(bot[1] - top[1]) / 2
            row['chars'][n] = {'head': c, 'top': top, 'eyes': px(PTS[n]['eyes']), 'mouth': px(PTS[n]['mouth']), 'r_px': round(r_px, 1)}
        bad = []
        for n in subj:
            d = row['chars'][n]; x, y, z = d['head']; r = d['r_px']
            if z <= 0 or y - r < 0 or x - r * 0.8 < 0 or x + r * 0.8 > W or y + r > H: bad.append(f'{n}:head_cut')
            if kind != 'two':
                ey = d['eyes'][1] / H
                if not (EYE_BAND[0] <= ey <= EYE_BAND[1]): bad.append(f'{n}:eye_line {ey:.3f}')
            if d['mouth'][1] > CAP_Y: bad.append(f'{n}:mouth_in_caption {d["mouth"][1]:.0f}')
        row['fail'] = bad; recs.append(row)
        s = per_shot.setdefault(fr['shot'], {'cam': fr['cam_token'], 'frames': 0, 'fails': 0, 'eye_y': [], 'first_fail': None})
        s['frames'] += 1
        if bad:
            s['fails'] += 1; s['first_fail'] = s['first_fail'] or [f] + bad
            for b in bad: fails[b.split(' ')[0]] = fails.get(b.split(' ')[0], 0) + 1
        for n in subj:
            s['eye_y'].append(row['chars'][n]['eyes'][1] / H)
    for s in per_shot.values():
        e = s.pop('eye_y'); s['eye_y_range'] = [round(min(e), 3), round(max(e), 3)] if e else None
    summary = {'frames': len(recs), 'frames_failing': sum(1 for r in recs if r['fail']), 'fails_by_check': fails,
               'verdict': 'PASS' if not any(r['fail'] for r in recs) else 'FAIL'}
    json.dump({'summary': summary, 'per_shot': per_shot, 'rules': {'eye_band': EYE_BAND, 'caption_band_top': CAP_Y}, 'frames': recs}, open(path, 'w'))
    print('QA', json.dumps(summary))
    return summary
