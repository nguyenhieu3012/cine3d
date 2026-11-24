#!/usr/bin/env python3
"""HYBRID episode render (20/11): Blender draws the SET (neon bloom, glass, glossy wet floor, set pieces moved by set fx), cine3d draws the CAST
(characters + what they hold, the engine's own models / faces / lights) on a transparent film with the set as an invisible occluder, the 2-D layer
(HUD, livestream, comments, stamp) is cine3d's overlay path, compose.py lays them: Blender -> display grade -> cast -> grain -> 2-D layer.
  python3 blender/hybrid.py <ep.js | id> [--tag name] [--from s --to s] [--fps 60] [--workers 3] [--cast-workers 2] [--samples 24] [--chunk 200]
        [--freeze-from s] [--only dump,set,overlay,cast,render,compose,check] [--keep] [--set <set_cache.blend>]
Output: out/<id>/hybrid/<tag>/ (dump.json, overlay/, cast/, bl/frames/, <id>_hybrid_<tag>.mp4, report.json).
--freeze-from t: the engine's hit-stop (ep.hits): frames from t on repeat the held picture, so neither the cast nor Blender renders them (compose holds the frame)."""
import argparse, json, os, re, subprocess, sys, time

ROOT = os.path.realpath(os.path.expanduser('~/cine3d'))
BL = os.path.expanduser('~/Applications/Blender.app/Contents/MacOS/Blender')
PY_SMOOTH = os.path.expanduser('~/tdvai/.venv/bin/python')


def sh(cmd, **kw):
    print('$', ' '.join(str(c) for c in cmd)[:240], flush=True)
    r = subprocess.run(cmd, cwd=ROOT, **kw)
    if r.returncode: raise SystemExit(f'step failed ({r.returncode}): {cmd[:3]}')
    return r


def count(d, ext='.png'):
    return len([n for n in os.listdir(d) if n.startswith('f_') and n.endswith(ext)]) if os.path.isdir(d) else 0


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('ep'); ap.add_argument('--tag', default='full')
    ap.add_argument('--from', dest='t0', type=float); ap.add_argument('--to', dest='t1', type=float); ap.add_argument('--fps', type=int, default=60)
    ap.add_argument('--workers', type=int, default=3); ap.add_argument('--cast-workers', type=int, default=2); ap.add_argument('--samples', type=int, default=24)
    ap.add_argument('--chunk', type=int, default=240, help='frames per Blender process (setup ~25-60 s each)')
    ap.add_argument('--freeze-from', type=float); ap.add_argument('--only'); ap.add_argument('--keep', action='store_true'); ap.add_argument('--set'); ap.add_argument('--set-collections', default='SET')
    ap.add_argument('--audio'); ap.add_argument('--res', type=int, default=100)
    ap.add_argument('--cast-mix', help='t0-t1 seconds: blender/castmix.py softens the cast over this window (the glass burst of gta6p2: 57.3-57.85)'); ap.add_argument('--cast-dof', action='store_true')
    a = ap.parse_args()
    ep = a.ep if a.ep.endswith('.js') else f'episodes/{a.ep}.js'; assert os.path.exists(os.path.join(ROOT, ep)), ep
    eid = os.path.splitext(os.path.basename(ep))[0]
    base = os.path.join(ROOT, 'out', eid, 'hybrid', a.tag); os.makedirs(base, exist_ok=True)
    rel = lambda p: os.path.relpath(p, ROOT)
    steps = a.only.split(',') if a.only else ['dump', 'set', 'overlay', 'cast', 'render', 'compose', 'check']
    rng = (['--from', str(a.t0)] if a.t0 is not None else []) + (['--to', str(a.t1)] if a.t1 is not None else [])
    dump = os.path.join(base, 'dump.json'); T0 = time.time(); rep = {'ep': ep, 'tag': a.tag}
    if 'dump' in steps and (not os.path.exists(dump) or os.path.getmtime(dump) < os.path.getmtime(os.path.join(ROOT, ep))):
        sh(['node', 'tools/dump.cjs', ep, rel(dump), '--fps', str(a.fps), *rng, '--set-dyn'])
    D = json.load(open(dump)); H = D['header']; frames = D['frames']; F = H['frame_count']; f0 = H['frame_from']
    # hit-stop: the first frame of the freeze and the last one to render
    ff = int(round(a.freeze_from * a.fps)) if a.freeze_from is not None else None
    last = f0 + F - 1 if ff is None else min(f0 + F - 1, ff)
    rep['frames_total'] = F; rep['frames_rendered'] = last - f0 + 1
    setf = a.set or os.path.join(ROOT, 'out', eid, 'blender', 'set_cache.blend')
    if 'set' in steps and not os.path.exists(setf):
        glb = os.path.join(ROOT, 'out', eid, 'blender', 'set', 'set.glb')
        sh(['node', 'tools/export_set.cjs', ep, rel(glb)]); sh([BL, '-b', '--factory-startup', '-P', 'blender/set_build.py', '--', rel(glb), rel(setf)])
    ovd = os.path.join(base, 'overlay')
    if 'overlay' in steps and count(ovd) < F:
        sh(['node', 'tools/render.cjs', 'pngseq', ep, rel(ovd), '--overlays-only', '--split-additive', '--fps', str(a.fps), *rng])
    castd = os.path.join(base, 'cast')
    if 'cast' in steps and count(castd) < last - f0 + 1:
        t_a = H['from']; t_b = (last + 1) / a.fps
        sh(['node', 'blender/castpass.cjs', ep, rel(castd), '--fps', str(a.fps), '--from', f'{t_a:.4f}', '--to', f'{t_b:.4f}', '--workers', str(a.cast_workers)] + (['--dof'] if a.cast_dof else []))
        rep['cast_s'] = round(time.time() - T0)
    if a.cast_mix and ('compose' in steps):
        m0, m1 = a.cast_mix.split('-'); mixd = castd + '_mix'; sh([sys.executable, 'blender/castmix.py', rel(castd), rel(mixd), m0, m1, '--fps', str(a.fps)]); castd = mixd
    bl = os.path.join(base, 'bl'); frd = os.path.join(bl, 'frames')
    if 'render' in steps:
        os.makedirs(frd, exist_ok=True); tr = time.time()
        todo = [f for f in range(f0, last + 1) if not os.path.exists(os.path.join(frd, f'f_{f:05d}.jpg'))]
        chunks = [todo[i:i + a.chunk] for i in range(0, len(todo), a.chunk)]
        blargs = ['--dump', rel(dump), '--set', rel(setf), '--set-collections', a.set_collections, '--out', rel(bl), '--samples', str(a.samples), '--nocast', '--noqa'] + (['--res', str(a.res)] if a.res != 100 else [])
        run = lambda ch: [BL, '-b', '--factory-startup', '-P', 'blender/render_ep.py', '--', *blargs, '--from', f'{ch[0] / a.fps:.5f}', '--to', f'{(ch[-1] + 1) / a.fps:.5f}', '--resume']
        live = []; q = list(chunks)
        while q or live:
            while q and len(live) < a.workers:
                ch = q.pop(0); print('$ chunk', ch[0], ch[-1], flush=True); live.append(subprocess.Popen(run(ch), cwd=ROOT, stdout=subprocess.DEVNULL))
            time.sleep(2)
            for p_ in list(live):
                if p_.poll() is not None:
                    live.remove(p_)
                    if p_.returncode: raise SystemExit(f'chunk failed ({p_.returncode})')
        rep['render_s'] = round(time.time() - tr); rep['s_per_frame_wall'] = round(rep['render_s'] / max(1, len(todo)), 3)
    mp4 = os.path.join(base, f'{eid}_hybrid_{a.tag}.mp4')
    if 'compose' in steps:
        c = [sys.executable, 'blender/compose.py', '--frames', rel(frd), '--overlay', rel(ovd), '--cast', rel(castd), '--out', rel(mp4), '--from', str(H['from']), '--to', str(H['to']), '--fps', str(a.fps), '--keep']
        if ff is not None: c += ['--freeze-from', str(ff)]
        mix = a.audio or os.path.join(ROOT, 'out', eid, 'audio', 'mix.wav')
        if os.path.exists(mix): c += ['--audio', rel(mix)]
        tc = time.time(); sh(c); rep['compose_s'] = round(time.time() - tc)
    if 'check' in steps and os.path.exists(mp4):
        sm = subprocess.run([PY_SMOOTH, 'tools/smooth.py', mp4, '--ep', ep, '--out', os.path.join(base, 'smooth')], cwd=ROOT, capture_output=True, text=True).stdout
        rep['smooth'] = [l for l in sm.splitlines() if re.search(r'jump between|worst 1 s|SMOOTH', l)]
        pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,nb_frames,duration,r_frame_rate', '-of', 'json', mp4], capture_output=True, text=True).stdout)
        rep['streams'] = pr['streams']
    rep['wall_s'] = round(time.time() - T0)
    old = json.load(open(os.path.join(base, 'report.json'))) if os.path.exists(os.path.join(base, 'report.json')) else {}
    old.update(rep); json.dump(old, open(os.path.join(base, 'report.json'), 'w'), indent=1, ensure_ascii=False); print(json.dumps(old, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    main()
