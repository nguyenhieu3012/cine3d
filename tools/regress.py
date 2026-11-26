#!/usr/bin/env python3
"""cine3d: did a change to the engine break or restyle anything that was already approved?
  python3 tools/regress.py --save [word]   # after the owner approves a look: store reference stills (ref/<name>/t*.png); a word (ngay, trada, goat) limits it to the episodes whose path contains it
  python3 tools/regress.py            # after ANY edit in core/ or packs/: machine QA of every listed episode + each still against its reference
A still passes when it is within 38 dB PSNR of the reference (a different picture is far below 30). FAIL = you changed an approved look: either undo it,
or, if the change is the point and the owner has approved the new look, run --save again and say so in ENGINE.md."""
import os, subprocess, sys, shutil, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPS = {'episodes/ngay12.js': [0.6, 1.8, 10.4, 16.9, 25.5, 41.0, 52.0, 70.0], 'demo/trada_ep55.js': [0.5, 4.0, 8.0], 'demo/trada_people.js': [3.0, 9.5], 'demo/trada_phone.js': [3.0], 'demo/goat_ep03.js': [1.0, 4.0],
       'episodes/gb04.js': [0.6, 6.0, 19.3, 30.0, 46.5, 52.0, 63.0]}   # gb04 added 13/11 (the owner approved it before the v4 checks; references saved once with `--save gb04`)
# Faults the v4 machine checks (qa.cjs, 13/11) found in episodes the owner had already approved: they are KNOWN, listed here so this script still answers its own
# question (did my change to core/ or packs/ break something?) instead of failing on debts that were there before. {check: how many findings}.
# A check that fails MORE often than listed, or a check not listed, makes the QA part FAIL. Fix the episode and shrink the list; never grow it to make a regression pass.
QA_KNOWN = {'episodes/ngay12.js': {'subject_cut': 1, 'hold_on_action': 3, 'same_framing': 1, 'draw_undeclared': 1}, 'episodes/gb04.js': {'text_fit': 1, 'hold_on_action': 2, 'draw_undeclared': 3},
            'demo/trada_ep55.js': {'text_on_speech': 1}, 'demo/trada_people.js': {'no_lips': 8}, 'demo/trada_phone.js': {'no_lips': 2, 'read_time': 3}, 'demo/goat_ep03.js': {'speaker_off': 1}}   # the demos are look tests with no recorded voice; 14/11 read checks: draw_undeclared = old draw inserts without `reads`/`noText` (ngay12, gb04), read_time = demo chat messages on screen too briefly
# Public-clone extras (`--available`): skips missing private episodes (e.g. ngay12, gb04) and adds available repo samples so clean clones can verify 0 regressions.
AVAIL_EXTRA = {'demo/trada_v2_widgets.js': [0.5, 5.8, 13.0], 'episodes/gb11.js': [0.6, 15.0, 52.0]}
save = '--save' in sys.argv; avail = '--available' in sys.argv; bad = 0
only = [x for x in sys.argv[1:] if not x.startswith('--')]   # `--save trada` or `regress.py goat`: only the episodes whose path contains one of these words (two agents, two packs: save only your own)
if avail:
    EPS = {k: v for k, v in {**EPS, **AVAIL_EXTRA}.items() if os.path.exists(os.path.join(ROOT, k))}
if only: EPS = {k: v for k, v in EPS.items() if any(o in k for o in only)}
for ep, ts in EPS.items():
    name = os.path.basename(ep)[:-3]; ref = f'{ROOT}/ref/{name}'; tmp = f'{ROOT}/out/_regress_{os.getpid()}/{name}'; shutil.rmtree(tmp, ignore_errors=True)
    q = subprocess.run(['node', 'tools/qa.cjs', ep], cwd=ROOT, capture_output=True, text=True).stdout.splitlines()
    fails = {}
    for l in q:
        m = re.match(r'  FAIL (\w+):', l)
        if m: fails[m.group(1)] = fails.get(m.group(1), 0) + 1
    known = QA_KNOWN.get(ep, {}); new = {k: v for k, v in fails.items() if v > known.get(k, 0)}
    print(f'{ep}: QA ' + (q[0].split('  ')[0] if q else 'no output') + (f'  (known, not new: {sum(fails.values()) - sum(new.values())})' if fails and not new else '') + (f'  NEW: {new}' if new else ''))
    bad += 0 if q and (q[0].startswith('ALL PASS') or (fails and not new)) else 1
    subprocess.run(['node', 'tools/render.cjs', 'stills', ep, tmp if not save else ref, ','.join(f'{t:.2f}' for t in ts)], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    if save: print('  saved', len(ts), 'reference stills'); continue
    for t in ts:
        a, b = f'{tmp}/t{t:.2f}.png', f'{ref}/t{t:.2f}.png'
        if not os.path.exists(b): print(f'  t{t:.2f}: no reference (run --save once the look is approved)'); continue
        r = subprocess.run(['ffmpeg', '-v', 'info', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], capture_output=True, text=True)
        m = re.search(r'average:([0-9.inf]+)', r.stderr)
        if r.returncode != 0 or not m:
            p, ok = -1.0, False
            bad += 1
            print(f'  t{t:.2f}: ERROR (ffmpeg psnr failed, rc={r.returncode})')
            continue
        p = float('inf') if m.group(1) == 'inf' else float(m.group(1)); ok = p >= 38
        if not ok: bad += 1
        print(f'  t{t:.2f}: {"same" if ok else "CHANGED"} ({p:.1f} dB)')
shutil.rmtree(f'{ROOT}/out/_regress_{os.getpid()}', ignore_errors=True)
print('REGRESS ' + ('SAVED' if save else 'PASS' if not bad else f'FAIL ({bad})')); sys.exit(1 if bad and not save else 0)
