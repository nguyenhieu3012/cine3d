#!/usr/bin/env python3
"""cine3d silent animatic (Master Blueprint v2.0 for "Trà đá với AI"): the FULL build of a v2 episode (character motion, acting, camera moves, on-screen text) WITHOUT the voice, so the owner can approve it
before any ElevenLabs credit is spent (pipeline steps `build` + `animatic` + `animatic_owner`). 24/11/2026: this replaced the old still-per-shot animatic (kept as --stills).

  ~/tdvai/.venv/bin/python tools/animatic.py episodes/<id>.beats.json --times-only      # step 1: write episodes/<id>.times.js from ESTIMATES (needed before the builder can write the episode)
  ~/tdvai/.venv/bin/python tools/animatic.py episodes/<id>.beats.json [--fps N] [--timecode] [--wide] [--estimate] [--force] [--rules N]     # step 2: render episodes/<id>.js at full motion -> out/<id>/animatic.mp4   (--timecode / --wide burn a label strip: review copies only, a delivered Final never has one)
  ~/tdvai/.venv/bin/python tools/animatic.py episodes/<id>.beats.json --stills            # the old mode: one still per shot held with ffmpeg, 12 fps (no motion)

--times-only: writes episodes/<id>.times.js with the scriptlint fit (0.79 s + 0.21 s per Vietnamese syllable, 0.64 s + 0.29 s per English word; / tempo; gap 0.22; pause beats as written; + pre + tail), marked
`estimated: true` and a header comment. Never overwrites a REAL times file (one `voice.py build` wrote); `voice.py build` overwrites the estimated one. scriptlint ignores an estimated file (it prints TIMING ESTIMATED as before).
Default mode: needs episodes/<id>.js (exit 2 with a message if it is not there: the builder must build the episode first). No _lips.json is needed: mouths stay closed (when an estimated-times render finds a
lips file anyway, a work copy of the episode with `lipsFile: null` is rendered). Music and effects are in the animatic only if out/<id>/audio/stem_music.wav / stem_effects.wav already exist; the voice never is.
Renders through tools/render.cjs mp4 at --fps (default 30 = the final film's frame rate since 23/11/2026; v2demo renders at about 34 frames/s, so 30 fps costs about 0.9 s of render per second of film; encoded at CRF 17), burns the timecode + shot id in at x 60 / y 160 ONLY with --timecode (default off: clean film), writes out/<id>/animatic.mp4, out/<id>/animatic_sheet.jpg
(+ _2, _3 ... when more than 24 stills; frames taken from the rendered film) and out/<id>/animatic_work/. Never calls ElevenLabs. Refuses (exit 2) a rules 1 episode and pack goat unless --force.
--wide: the cheap 16:9 version for the Sunday long video: the 9:16 picture scaled to 608x1080 and padded to 1920x1080 (a true 16:9 picture needs a new canvas, camera aspect and overlay layout: not built).
--stills (old mode): the real episodes/<id>.times.js when it covers every beat, otherwise estimated times in out/<id>/animatic_work/; one still per shot at 60 % of its length plus one where an overlay appears or changes."""
import argparse, glob, json, math, os, re, shutil, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); import rules2
ROOT = rules2.ROOT; FPS = 12; MOTION_FPS = 30   # FPS = the old stills mode; MOTION_FPS = default frame rate of the full-motion animatic
VI_BASE, VI_PER, EN_BASE, EN_PER = 0.79, 0.21, 0.64, 0.29   # same constants as tools/scriptlint.py (that file runs on import, so they are repeated here)

def die(msg, code=1): print(msg, file=sys.stderr); sys.exit(code)
def estimate(beats, pre, tail):
    txt = ' '.join(b['text'] for b in beats if 'text' in b).lower()
    vi = bool(re.search('[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', txt)); base, per = (VI_BASE, VI_PER) if vi else (EN_BASE, EN_PER)
    t = float(pre); lines = {}
    for b in beats:
        if 'pause' in b: lines[b['id']] = dict(t0=round(t, 3), t1=round(t + b['pause'], 3)); t += b['pause']; continue
        n = len(re.findall(r'[\wÀ-ỹ]+', b['text'])); t0 = t + b.get('gap', 0.22); t = t0 + (base + per * n) / (b.get('tempo') or 1); lines[b['id']] = dict(t0=round(t0, 3), t1=round(t, 3))
    d = dict(dur=round(t + float(tail), 3), lines=lines)
    tension = [[lines[b['id']]['t0'], b['tension']] for b in beats if 'tension' in b and b['id'] in lines]
    impacts = [round(lines[b['id']]['t0'] + b.get('impactOff', 0), 3) for b in beats if b.get('impact') and b['id'] in lines]
    if tension: d['tension'] = tension
    if impacts: d['impacts'] = impacts
    return d

IMPORT = re.compile(r"""((?:from|import)\s*\(?\s*)(['"])(\.{1,2}/[^'"]+)\2""")
def work_copy(id, src, work, seen):
    """copy an episode module into the work folder with every relative import re-pointed (the folder is out/<id>/animatic_work, three levels below the engine root).
    ./<id>.times.js stays local (the estimated one); modules named <id>_*.js / <id>.*.js (props files that import the times) are copied the same way."""
    text = open(src, encoding='utf-8').read(); sdir = os.path.dirname(src)
    def fix(m):
        spec = m.group(3); tgt = os.path.normpath(os.path.join(sdir, spec)); base = os.path.basename(tgt)
        if spec == f'./{id}.times.js': return m.group(0)
        if os.path.dirname(tgt) == os.path.join(ROOT, 'episodes') and re.fullmatch(re.escape(id) + r'[._].*\.js', base) and base != f'{id}.times.js':
            if tgt not in seen: seen.add(tgt); open(os.path.join(work, base), 'w', encoding='utf-8').write(work_copy(id, tgt, work, seen))
            return m.group(0)
        rel = os.path.relpath(tgt, work); rel = rel if rel.startswith('.') else './' + rel
        return f'{m.group(1)}{m.group(2)}{rel}{m.group(2)}'
    return IMPORT.sub(fix, text)

def intervals(plan):
    dur = plan['dur']; shots = plan['shots']; must = {0.0} | {round(s['t0'], 3) for s in shots if 0 < s['t0'] < dur}
    ev = set()
    for o in plan['overlays']:
        pts = [o['t0'], o['t1']] + list(o.get('msgs') or []) + [x for r in (o.get('reads') or []) for x in r if x is not None]
        ev |= {round(x, 3) for x in pts if x is not None and 0.05 < x < dur - 0.2}
    keep = sorted(must)
    for x in sorted(ev):
        if all(abs(x - k) >= 0.4 for k in keep): keep.append(x)
        keep.sort()
    keep = [k for i, k in enumerate(keep) if i == 0 or keep[i] - keep[i - 1] > 1e-6]
    out = []
    for i, a in enumerate(keep):
        b = keep[i + 1] if i + 1 < len(keep) else dur; ln = b - a
        out.append(dict(a=a, b=b, still=round(a + max(0.6 * ln, min(0.35, 0.9 * ln)), 2)))   # 60 % of the span; at least 0.35 s after the thing that appeared (fade-in done)
    return out
def shot_at(shots, t):
    k = 0
    for i, s in enumerate(shots):
        if s['t0'] <= t + 1e-6: k = i
    return k

EST_HEADER = '// ESTIMATED by tools/animatic.py --times-only (24/11): NOT a voice times file. tools/voice.py build overwrites this file with the real times.\n'
def write_estimated_times(id, B):
    """-> ('written'|'refreshed'|'real', times dict). Never overwrites a real times file."""
    st = rules2.times_estimated(id)
    if st is False: return 'real', rules2.read_times_js(id)
    T = estimate(B['beats'], B.get('pre', 0), B.get('tail', 1.8)); T['estimated'] = True
    open(rules2.times_js_path(id), 'w', encoding='utf-8').write(EST_HEADER + 'export default ' + json.dumps(T) + ';\n')
    return ('written' if st is None else 'refreshed'), T

def run_motion(a, B, id, epj):
    """full-motion silent animatic: render the real episode through render.cjs, burn in timecode + shot id, make the contact sheet from the rendered film"""
    O = f'{ROOT}/out/{id}'; W = f'{O}/animatic_work'; shutil.rmtree(W, ignore_errors=True); os.makedirs(W)
    for f in glob.glob(f'{O}/animatic_sheet*.jpg') + [f'{O}/animatic.mp4']:
        if os.path.exists(f): os.remove(f)
    run = lambda cmd, **k: subprocess.run(cmd, cwd=ROOT, check=True, **k)
    fps = a.fps or MOTION_FPS; t_start = time.time()
    # 1. times: real file if it covers every beat; else an estimated file in episodes/ (the episode imports it); --estimate or a stale real file: a work copy with its own estimated times
    st = rules2.times_estimated(id); real = rules2.read_times_js(id) if st is False else None
    if real is not None and (a.estimate or not all(b['id'] in real['lines'] for b in B['beats'])): real = None; own = True   # a real file that does not fit the beats stays untouched
    else: own = False
    if real: T = real; src = f'real times file (episodes/{id}.times.js)'; copy = False
    elif own or a.estimate and st is False:
        T = estimate(B['beats'], B.get('pre', 0), B.get('tail', 1.8)); src = 'ESTIMATED in a work copy (the real times file was left alone)'; copy = True
    else:
        how, T = write_estimated_times(id, B); src = f'ESTIMATED from the script text (0.79 s + 0.21 s per syllable), {how} episodes/{id}.times.js'
        copy = os.path.exists(f'{ROOT}/episodes/{id}_lips.json')   # old lips would not fit estimated times: closed mouths
    if copy:
        open(f'{W}/{id}.times.js', 'w', encoding='utf-8').write(EST_HEADER + 'export default ' + json.dumps(T) + ';\n')
        text = re.sub(r"lipsFile\s*:\s*'[^']*'", 'lipsFile: null', work_copy(id, epj, W, {epj})); open(f'{W}/{id}.js', 'w', encoding='utf-8').write(text); ep = f'out/{id}/animatic_work/{id}.js'
    else: ep = f'episodes/{id}.js'
    # 2. plan (shots, overlays) from the engine page
    try: run(['node', 'tools/animatic.cjs', 'plan', ep, f'out/{id}/animatic_work/plan.json'])
    except subprocess.CalledProcessError: die('the episode did not load in the engine page (see the ERR / PAGEERR lines above)', 1)
    plan = json.load(open(f'{W}/plan.json')); plan['dur'] = round(float(T['dur']), 3)
    if not plan['shots']: die('the episode has no shots', 1)
    # 3. music / effects stems if the build already made them (never the voice)
    stems = [f for f in (f'{O}/audio/stem_music.wav', f'{O}/audio/stem_effects.wav') if os.path.exists(f)]; audio = []
    if stems:
        bed = f'{W}/bed.wav'
        run(['ffmpeg', '-y', '-loglevel', 'error'] + sum([['-i', f] for f in stems], []) + (['-filter_complex', f'amix=inputs={len(stems)}:normalize=0:duration=longest'] if len(stems) > 1 else []) + [bed]); audio = ['--audio', f'out/{id}/animatic_work/bed.wav']
    # 4. the full-motion render, no voice
    t_r = time.time()
    with open(f'{W}/render.log', 'w') as lg: run(['node', 'tools/render.cjs', 'mp4', ep, f'out/{id}/animatic_work/raw.mp4', '--fps', str(fps), '--crf', '17'] + audio, stdout=lg)
    t_render = time.time() - t_r
    # 5. stills of the rendered film for the contact sheet (one per shot at ~60 %, plus one where text appears or changes)
    iv = intervals(plan)
    for x in iv: x['shot'] = shot_at(plan['shots'], x['a'])
    os.makedirs(f'{W}/stills', exist_ok=True)
    for x in iv:
        x['file'] = f'out/{id}/animatic_work/stills/t{x["still"]:.2f}.png'
        run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{x["still"]:.3f}', '-i', f'{W}/raw.mp4', '-frames:v', '1', f'{ROOT}/{x["file"]}'])
    # 6. labels (10 per second: timecode + shot id, ONLY when --timecode or --wide is requested) and sheets, drawn in Chromium
    need_labels = bool(a.timecode or a.wide)
    labels_spec = None
    if need_labels:
        LN = int(math.ceil(plan['dur'] * 10)) + 10; texts = []
        for k in range(LN):
            t = k / 10; i = shot_at(plan['shots'], t + 0.05); texts.append(f'{int(t // 60):02d}:{t % 60:04.1f}  S{i + 1:02d} {plan["shots"][i]["cam"]}')
        labels_spec = dict(dir=f'out/{id}/animatic_work/labels', text=texts, w=560, h=56, font='bold 30px Menlo, monospace')
    sheets = []
    for n, i in enumerate(range(0, len(iv), 24)):
        items = [dict(src=x['file'], l1=f'#{i + j + 1:02d}  t {x["still"]:.2f}s  shot {x["shot"] + 1}', l2=f'{plan["shots"][x["shot"]]["cam"]}  {x["a"]:.2f}-{x["b"]:.2f}') for j, x in enumerate(iv[i:i + 24])]
        sheets.append(dict(out=f'out/{id}/animatic_sheet{"" if n == 0 else "_" + str(n + 1)}.jpg', cols=6, cw=300, ch=533, strip=60, items=items))
    spec = dict(work=f'out/{id}/animatic_work', labels=labels_spec, sheets=sheets)
    json.dump(spec, open(f'{W}/compose.json', 'w')); run(['node', 'tools/animatic.cjs', 'compose', f'out/{id}/animatic_work/compose.json'])
    # 7. burn the label in (label box 560x56 at x 60, y 160: inside the safe area x 54-1026, y 150-1536, above the hook zone y 260+)
    fc = ('[0:v]scale=608:1080,pad=1920:1080:656:0:color=black,setsar=1[a];[a][1:v]overlay=24:24:shortest=1[v]' if a.wide else '[0:v][1:v]overlay=60:160:shortest=1[v]')
    if a.timecode or a.wide:   # --timecode: the review copy with the timecode + shot id strip burned in (default OFF since 23/11: the delivered film is clean)
        run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{W}/raw.mp4', '-framerate', '10', '-i', f'{W}/labels/lab_%05d.png', '-filter_complex', fc, '-map', '[v]'] + (['-map', '0:a'] if audio else []) +
            ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', str(fps)] + (['-c:a', 'copy'] if audio else ['-an']) + ['-movflags', '+faststart', f'{O}/animatic.mp4'])
    else:
        run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{W}/raw.mp4', '-c', 'copy', '-movflags', '+faststart', f'{O}/animatic.mp4'])
    shutil.rmtree(f'{W}/labels', ignore_errors=True)
    json.dump(dict(id=id, mode='motion', times=src, dur=plan['dur'], fps=fps, wide=a.wide, music_effects=[os.path.basename(f) for f in stems], shots=plan['shots'], stills=iv, render_s=round(t_render, 1), total_s=round(time.time() - t_start, 1)), open(f'{W}/animatic.json', 'w'), indent=1)
    print(f'{id}: animatic done (FULL MOTION, no voice). times: {src}; running time {plan["dur"]} s at {fps} fps; {len(plan["shots"])} shots; render {t_render:.0f} s, total {time.time() - t_start:.0f} s; sound: {", ".join(os.path.basename(f) for f in stems) or "none (silent)"}{" (16:9 wide, 608x1080 padded to 1920x1080)" if a.wide else ""}')
    print(f'  video: out/{id}/animatic.mp4\n  sheet: ' + ', '.join(s['out'] for s in sheets) + f'\n  work:  out/{id}/animatic_work/ (raw render, plan, stills, animatic.json)')
    print(f'next: pipeline.py status {id}   (the owner then watches the animatic; record: pipeline.py record {id} animatic_owner OK --by <who> --quote "<his words>")')

def main():
    ap = argparse.ArgumentParser(description='silent animatic of a Blueprint v2.0 episode'); ap.add_argument('beats'); ap.add_argument('--wide', action='store_true'); ap.add_argument('--timecode', action='store_true', help='burn the timecode + shot id strip into animatic.mp4 (default off: clean film)'); ap.add_argument('--estimate', action='store_true', help='ignore a real times file')
    ap.add_argument('--force', action='store_true', help='allow a rules 1 episode or pack goat'); ap.add_argument('--rules')
    ap.add_argument('--stills', action='store_true', help='the old animatic: one still per shot, no motion'); ap.add_argument('--times-only', action='store_true', help='only write the ESTIMATED episodes/<id>.times.js'); ap.add_argument('--fps', type=int, help=f'frame rate of the full-motion render (default {MOTION_FPS})'); a = ap.parse_args()
    bp = os.path.abspath(a.beats)
    if not os.path.exists(bp): die(f'{a.beats}: no such beats file')
    B = json.load(open(bp, encoding='utf-8')); id = B.get('id') or os.path.basename(bp).split('.')[0]
    if os.path.dirname(bp) != os.path.join(ROOT, 'episodes') or os.path.basename(bp) != f'{id}.beats.json': die(f'expected {ROOT}/episodes/{id}.beats.json, got {bp}')
    st = rules2.read_state(id); v = rules2.rules_version(B, st, a.rules or rules2.cli_rules())
    if not a.force and (rules2.is_goat(B, st) or v != 2):
        die(f'REFUSED: {id} is {"a GOAT Beef episode" if rules2.is_goat(B, st) else "a rules 1 episode"}; the silent animatic belongs to Blueprint v2.0 (Trà đá, rules 2). Nothing was written. Use --force to build it anyway.', 2)
    if a.times_only:
        how, T = write_estimated_times(id, B)
        print(f'{id}: episodes/{id}.times.js {"is a REAL times file (voice.py wrote it): left alone" if how == "real" else how + " from ESTIMATES (estimated: true); voice.py build will overwrite it"}; running time {T["dur"]} s, {len(T["lines"])} beats'); return
    epj = f'{ROOT}/episodes/{id}.js'
    if not os.path.exists(epj): die(f'{os.path.relpath(epj, ROOT)} does not exist: the builder must build the episode first (episodes/{id}.js: shots, acting, camera, overlays; run `tools/animatic.py {os.path.relpath(bp, ROOT)} --times-only` first for the times it imports). The animatic renders that file.', 2)
    if not a.stills: return run_motion(a, B, id, epj)
    O = f'{ROOT}/out/{id}'; W = f'{O}/animatic_work'; shutil.rmtree(W, ignore_errors=True); os.makedirs(W)
    for f in glob.glob(f'{O}/animatic_sheet*.jpg') + [f'{O}/animatic.mp4']:
        if os.path.exists(f): os.remove(f)
    # 1. times
    realp = f'{ROOT}/episodes/{id}.times.js'; real = None
    if os.path.exists(realp) and not a.estimate:
        try:
            s = open(realp, encoding='utf-8').read(); real = json.loads(s[s.index('{'):s.rindex('}') + 1])
            if real.get('estimated') or not all(b['id'] in real['lines'] for b in B['beats']): real = None   # an estimated file is not a real one
        except Exception: real = None
    T = real or estimate(B['beats'], B.get('pre', 0), B.get('tail', 1.8)); src = 'real times file (episodes/%s.times.js)' % id if real else 'ESTIMATED from the script text (0.79 s + 0.21 s per syllable)'
    open(f'{W}/{id}.times.js', 'w', encoding='utf-8').write('// estimated by tools/animatic.py: do not edit, not a voice times file\nexport default ' + json.dumps(T) + ';\n'); json.dump(T, open(f'{W}/times_estimated.json', 'w'), indent=1)
    # 2. episode copy
    text = work_copy(id, epj, W, {epj})
    if not real: text = re.sub(r"lipsFile\s*:\s*'[^']*'", 'lipsFile: null', text)   # no mouth envelopes: closed mouths
    open(f'{W}/{id}.js', 'w', encoding='utf-8').write(text); ep = f'out/{id}/animatic_work/{id}.js'
    run = lambda cmd, **k: subprocess.run(cmd, cwd=ROOT, check=True, **k)
    # 3. plan -> the times of the stills
    try: run(['node', 'tools/animatic.cjs', 'plan', ep, f'out/{id}/animatic_work/plan.json'])
    except subprocess.CalledProcessError: die('the episode did not load in the engine page (see the ERR / PAGEERR lines above)')
    plan = json.load(open(f'{W}/plan.json')); plan['dur'] = round(float(T['dur']), 3)
    if not plan['shots']: die('the episode has no shots')
    iv = intervals(plan)
    for x in iv: x['shot'] = shot_at(plan['shots'], x['a'])
    times = sorted({x['still'] for x in iv})
    run(['node', 'tools/render.cjs', 'stills', ep, f'out/{id}/animatic_work/stills', ','.join(f'{t:.2f}' for t in times)], stdout=subprocess.DEVNULL)
    for x in iv: x['file'] = f'out/{id}/animatic_work/stills/t{x["still"]:.2f}.png'
    # 4. labels + sheets (drawn in Chromium)
    N = int(round(plan['dur'] * FPS)); texts = []
    for k in range(N):
        t = k / FPS; i = shot_at(plan['shots'], t); sh = plan['shots'][i]; texts.append(f'{int(t // 60):02d}:{t % 60:04.1f}  S{i + 1:02d} {sh["cam"]}')
    sheets = []
    for n, i in enumerate(range(0, len(iv), 24)):
        items = [dict(src=x['file'], l1=f'#{i + j + 1:02d}  t {x["still"]:.2f}s  shot {x["shot"] + 1}', l2=f'{plan["shots"][x["shot"]]["cam"]}  {x["a"]:.2f}-{x["b"]:.2f}') for j, x in enumerate(iv[i:i + 24])]
        sheets.append(dict(out=f'out/{id}/animatic_sheet{"" if n == 0 else "_" + str(n + 1)}.jpg', cols=6, cw=300, ch=533, strip=60, items=items))
    spec = dict(work=f'out/{id}/animatic_work', labels=dict(dir=f'out/{id}/animatic_work/labels', text=texts, w=560, h=56, font='bold 30px Menlo, monospace'), sheets=sheets)
    json.dump(spec, open(f'{W}/compose.json', 'w')); run(['node', 'tools/animatic.cjs', 'compose', f'out/{id}/animatic_work/compose.json'])
    # 5. the video: each still held for its real span, 12 fps, no audio
    with open(f'{W}/stills.txt', 'w') as f:
        for x in iv: f.write(f"file '{ROOT}/{x['file']}'\nduration {x['b'] - x['a']:.4f}\n")
        f.write(f"file '{ROOT}/{iv[-1]['file']}'\n")
    fc = ('[0:v]fps=12,scale=608:1080,pad=1920:1080:656:0:color=black,setsar=1[a];[a][1:v]overlay=24:24:shortest=1[v]' if a.wide
          else '[0:v]fps=12,scale=1080:1920:flags=lanczos,setsar=1[a];[a][1:v]overlay=60:160:shortest=1[v]')   # label box 560x56 at x 60, y 160: inside the safe area (x 54-1026, y 150-1536), above the hook zone (y 260+)
    run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{W}/stills.txt', '-framerate', str(FPS), '-i', f'{W}/labels/lab_%05d.png', '-filter_complex', fc, '-map', '[v]', '-frames:v', str(N), '-r', str(FPS),
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', f'{O}/animatic.mp4'])
    shutil.rmtree(f'{W}/labels', ignore_errors=True)
    json.dump(dict(id=id, times=src, dur=plan['dur'], fps=FPS, wide=a.wide, shots=plan['shots'], stills=iv), open(f'{W}/animatic.json', 'w'), indent=1)
    print(f'{id}: animatic done. times: {src}; running time {plan["dur"]} s; {len(plan["shots"])} shots, {len(iv)} stills, {N} frames at {FPS} fps{" (16:9 wide, 608x1080 padded to 1920x1080)" if a.wide else ""}')
    print(f'  video: out/{id}/animatic.mp4\n  sheet: ' + ', '.join(s['out'] for s in sheets) + f'\n  work:  out/{id}/animatic_work/ (estimated times, episode copy, stills, animatic.json)')
    print(f'next: pipeline.py status {id}   (the owner then watches the animatic; record: pipeline.py record {id} animatic_owner OK --by <who> --quote "<his words>")')
if __name__ == '__main__': main()
