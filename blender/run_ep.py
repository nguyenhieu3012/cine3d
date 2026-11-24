#!/usr/bin/env python3
"""One command, one episode: cine3d staging -> Blender picture -> mp4 -> QA report. Resumable: every step skips what is already done.
  python3 blender/run_ep.py <id> [--from s --to s] [--fps 30] [--chunk 10] [--set <set.blend> [--set-collections a,b]] [--only steps] [--keep]
Steps (in order; --only dump,render,... runs a subset):
  dump     node tools/dump.cjs (scene per frame) + --faces (the drawn face of every frame)          -> out/<id>/blender/<tag>/dump.json, faces/
  faces2x  Lanczos 2x faces for crisp close-ups (blender/faces_hires.py)                              -> faces2x/
  chars    node tools/export_chars.cjs <pack> <cast> for any cast member missing in out/chars/
  set      the set: --set <blend> (a hand-built .blend), else out/<id>/blender/set_cache.blend built from the engine's own set
           (node tools/export_set.cjs + blender/set_build.py)
  overlay  the text layer, additive glows split out (render.cjs pngseq --overlays-only --split-additive) -> overlay/, overlay/add/
  board    set-swap boards (only if the dump has swap > 0)                                             -> board/
  render   Blender, in --chunk second pieces, --resume (frames already on disk are kept)              -> bl/frames/, bl/frames_cast/
  qa       framing QA on every frame (blender/qa.py via render_ep --qaonly)                           -> bl/qa.json
  compose  composite + encode (blender/compose.py; frame folders deleted unless --keep)               -> <id>_blender_<tag>.mp4
  check    cut frames, frozen-frame scan, tools/smooth.py, frame count, audio length                 -> report.json
<tag> = full (no range) or r<from>-<to>."""
import argparse, json, math, os, re, subprocess, sys, time

ROOT = os.path.realpath(os.path.expanduser('~/cine3d'))
BL = os.path.expanduser('~/Applications/Blender.app/Contents/MacOS/Blender')
PY_SMOOTH = os.path.expanduser('~/tdvai/.venv/bin/python')
STEPS = ['dump', 'faces2x', 'chars', 'set', 'overlay', 'board', 'render', 'qa', 'compose', 'check']


def sh(cmd, **kw):
    print('$', ' '.join(str(c) for c in cmd)[:220], flush=True)
    r = subprocess.run(cmd, cwd=ROOT, **kw)
    if r.returncode: raise SystemExit(f'step failed ({r.returncode}): {cmd[:3]}')
    return r


def count(d, pat=r'^f_\d{5}\.png$'):
    return len([n for n in os.listdir(d) if re.match(pat, n)]) if os.path.isdir(d) else 0


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('--from', dest='t0', type=float); ap.add_argument('--to', dest='t1', type=float)
    ap.add_argument('--fps', type=int, default=30); ap.add_argument('--chunk', type=float, default=10.0); ap.add_argument('--set'); ap.add_argument('--set-collections', default='SET')
    ap.add_argument('--only'); ap.add_argument('--keep', action='store_true'); ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--plus', default='', help='showcase upgrades: motion,props,toon,camera,mblur,faces,atmos (see blender/plus.py); empty = the baseline')
    ap.add_argument('--workers', type=int, default=1, help='render chunks in N parallel Blender processes (17/11, 60 fps film)'); ap.add_argument('--res', type=int, default=100, help='3-D render size in percent (overlays stay full size; compose upscales)')
    ap.add_argument('--tag', help='output folder name under out/<id>/blender/ (default full or r<from>-<to>)')
    ap.add_argument('--dump', help='use this dump (in the tag folder) instead of <tag>/dump.json, e.g. the FACES agent dump + set_dyn')
    a = ap.parse_args()
    ep = f'episodes/{a.id}.js'; assert os.path.exists(os.path.join(ROOT, ep)), ep
    tag = a.tag or ('full' if a.t0 is None and a.t1 is None else f'r{a.t0 or 0:g}-{a.t1:g}')
    base = os.path.join(ROOT, 'out', a.id, 'blender', tag); os.makedirs(base, exist_ok=True)
    rel = lambda p: os.path.relpath(p, ROOT)
    rng = (['--from', str(a.t0 or 0)] if a.t0 is not None else []) + (['--to', str(a.t1)] if a.t1 is not None else [])
    steps = a.only.split(',') if a.only else STEPS
    dump = os.path.join(ROOT, a.dump) if a.dump else os.path.join(base, 'dump.json'); T0 = time.time(); report = {'id': a.id, 'tag': tag}

    if 'dump' in steps and not a.dump and (not os.path.exists(dump) or os.path.getmtime(dump) < os.path.getmtime(os.path.join(ROOT, ep))):
        sh(['node', 'tools/dump.cjs', ep, rel(dump), '--fps', str(a.fps), *rng, '--faces', rel(os.path.join(base, 'faces')), '--set-dyn'])
    H = json.load(open(dump))['header']; F = H['frame_count']; f0 = H['frame_from']
    if 'faces2x' in steps:
        if any(count(os.path.join(base, 'faces2x', w)) != count(os.path.join(base, 'faces', w)) for w in H['cast']):
            sh([sys.executable, 'blender/faces_hires.py', rel(os.path.join(base, 'faces'))])
    if 'chars' in steps:
        miss = [w for w in H['cast'] if not os.path.exists(os.path.join(ROOT, 'out', 'chars', f'{w}.joints.json'))]
        if miss: sh(['node', 'tools/export_chars.cjs', H['pack'], *miss])
    setf = a.set or os.path.join(ROOT, 'out', a.id, 'blender', 'set_cache.blend')
    if 'set' in steps and not os.path.exists(setf):
        glb = os.path.join(ROOT, 'out', a.id, 'blender', 'set', 'set.glb')
        sh(['node', 'tools/export_set.cjs', ep, rel(glb)])
        sh([BL, '-b', '--factory-startup', '-P', 'blender/set_build.py', '--', rel(glb), rel(setf)])
    ovd = os.path.join(base, 'overlay')
    if 'overlay' in steps and (count(ovd) < F or count(os.path.join(ovd, 'add')) < F):
        sh(['node', 'tools/render.cjs', 'pngseq', ep, rel(ovd), '--overlays-only', '--split-additive', '--fps', str(a.fps), *rng])
    frames = json.load(open(dump))['frames']
    has_swap = any(fr.get('swap', 0) > 0 for fr in frames)
    brd = os.path.join(base, 'board')
    if 'board' in steps and has_swap and not os.path.exists(os.path.join(brd, 'board_meta.json')):
        sh(['node', 'tools/render.cjs', 'pngseq', ep, rel(brd), '--board-only', '--fps', str(a.fps), *rng])
    bl = os.path.join(base, 'bl')
    blargs = ['--dump', rel(dump), '--set', rel(setf), '--set-collections', a.set_collections, '--out', rel(bl), '--samples', str(a.samples)] + (['--plus', a.plus] if a.plus else []) + (['--res', str(a.res)] if a.res != 100 else [])
    if 'render' in steps:
        t_start = H['from']; t_end = H['to']; t = t_start; tr = time.time()
        jobs = []
        while t < t_end - 1e-6:
            u = min(t_end, t + a.chunk); jobs.append((t, u)); t = u
        run = lambda t, u: [BL, '-b', '--factory-startup', '-P', 'blender/render_ep.py', '--', *blargs, '--from', f'{t:.4f}', '--to', f'{u:.4f}', '--resume', '--noqa']
        if a.workers <= 1:
            for t, u in jobs: sh(run(t, u), stdout=subprocess.DEVNULL)
        else:   # N processes, a new chunk starts as soon as one ends
            live = []; todo = list(jobs)
            while todo or live:
                while todo and len(live) < a.workers:
                    t, u = todo.pop(0); print('$ chunk', f'{t:.2f}-{u:.2f}', flush=True); live.append(subprocess.Popen(run(t, u), cwd=ROOT, stdout=subprocess.DEVNULL))
                time.sleep(2)
                for p_ in list(live):
                    if p_.poll() is not None:
                        live.remove(p_)
                        if p_.returncode: raise SystemExit(f'chunk failed ({p_.returncode})')
        report['render_s'] = round(time.time() - tr)
    if 'qa' in steps:
        sh([BL, '-b', '--factory-startup', '-P', 'blender/render_ep.py', '--', *blargs, '--qaonly'], stdout=subprocess.DEVNULL)
    mp4 = os.path.join(base, f'{a.id}_blender_{tag}.mp4')
    if 'compose' in steps and (os.path.isdir(os.path.join(bl, 'frames')) or os.path.isdir(os.path.join(bl, 'frames_cast'))):
        if not os.path.isdir(os.path.join(bl, 'frames')): os.makedirs(os.path.join(bl, 'frames'))
        c = [sys.executable, 'blender/compose.py', '--frames', rel(os.path.join(bl, 'frames')), '--overlay', rel(ovd), '--out', rel(mp4), '--from', str(H['from']), '--to', str(H['to']), '--fps', str(a.fps)]
        mix = os.path.join(ROOT, 'out', a.id, 'audio', 'mix.wav')
        if os.path.exists(mix): c += ['--audio', rel(mix)]
        if has_swap: c += ['--board', rel(brd), '--dump', rel(dump)]
        if a.keep: c += ['--keep']
        sh(c)
    if 'check' in steps and os.path.exists(mp4):
        report.update(check(mp4, dump, frames, H, a.fps, base, ep))
    qaf = os.path.join(bl, 'qa.json')
    if os.path.exists(qaf): report['qa'] = json.load(open(qaf))['summary']
    report['wall_s'] = round(time.time() - T0)
    old = json.load(open(os.path.join(base, 'report.json'))) if os.path.exists(os.path.join(base, 'report.json')) else {}
    old.update(report); json.dump(old, open(os.path.join(base, 'report.json'), 'w'), indent=1, ensure_ascii=False)
    print(json.dumps(old, indent=1, ensure_ascii=False))


def ydif(mp4):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', 'scale=270:480,signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-', '-f', 'null', '-'], capture_output=True, text=True).stdout
    return [float(x) for x in re.findall(r'YDIF=([0-9.]+)', r)]


def check(mp4, dump, frames, H, fps, base, ep):
    out = {}
    pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,nb_frames,duration,r_frame_rate', '-of', 'json', mp4], capture_output=True, text=True).stdout)
    v = next(s for s in pr['streams'] if s['codec_type'] == 'video'); au = next((s for s in pr['streams'] if s['codec_type'] == 'audio'), None)
    out['frames'] = int(v['nb_frames']); out['frames_expected'] = H['frame_count']; out['fps'] = v['r_frame_rate']
    out['video_s'] = float(v['duration']); out['audio_s'] = float(au['duration']) if au else None
    d = ydif(mp4); f0 = H['frame_from']
    cuts = [frames[i]['f'] for i in range(1, len(frames)) if frames[i]['shot'] != frames[i - 1]['shot']]
    bad = []
    for c in cuts:
        i = c - f0
        if 0 < i < len(d) - 1:
            # the cut frame must be the largest change in a +-2 window (a backdrop / swap fade can sit next to it)
            win = d[max(1, i - 2):i + 3]
            if d[i] < max(win) - 1e-6 or d[i] < 4.0: bad.append({'cut': c, 'ydif': round(d[i], 2), 'window': [round(x, 2) for x in win]})
    out['cuts'] = len(cuts); out['cuts_off'] = bad
    # frozen frames: no picture change while the engine says the camera or a character moved
    def moved(a, b):
        ca, cb = a['camera'], b['camera']
        if max(abs(x - y) for x, y in zip(ca['p'] + ca['q'], cb['p'] + cb['q'])) > 1e-4: return True
        for n in a['chars']:
            p, q = a['chars'][n], b['chars'].get(n)
            if not q: continue
            if max(abs(x - y) for x, y in zip(p['head'] + p['head_q'], q['head'] + q['head_q'])) > 1e-4 or abs((p.get('mouth') or 0) - (q.get('mouth') or 0)) > 0.02: return True
        return False
    hits = set((h['t'] for h in H.get('hits') or []))
    frozen = [frames[i]['f'] for i in range(1, min(len(d), len(frames))) if d[i] < 0.03 and moved(frames[i - 1], frames[i])]
    out['frozen_frames'] = frozen[:50]; out['frozen_count'] = len(frozen)
    sm = subprocess.run([PY_SMOOTH, 'tools/smooth.py', mp4, '--ep', ep, '--out', os.path.join(base, 'smooth')], cwd=ROOT, capture_output=True, text=True).stdout
    out['smooth'] = [l for l in sm.splitlines() if re.search(r'jump between|worst 1 s|SMOOTH', l)]
    return out


if __name__ == '__main__':
    main()
