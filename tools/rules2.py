#!/usr/bin/env python3
"""cine3d rules version (23/11/2026, stage 1 of Master Blueprint v2.0 for "Trà đá với AI"). Shared by pipeline.py, scriptlint.py and voice.py. Python 3 standard library only.
RULES 2 = the v2 rule set. It applies ONLY to pack trada; goat is always 1, and an episode with no `rules` field is 1 (so every old episode and every GOAT episode checks exactly as before).
Where it is set (first hit wins): --rules N on the command line > `"rules": 2` in the beats header > `"rules": 2` in out/<id>/pipeline.json (`pipeline.py new <id> --channel trada` writes it) > 1.
v2 adds, between script_gate and voice, the steps `animatic` (a silent animatic exists: stills + on-screen text + timing, no voice; proof = out/<id>/animatic.mp4, animatic_sheet.jpg or images in out/<id>/animatic/)
and `animatic_owner` (the owner approved it: pipeline.py record <id> animatic_owner OK --by <who> --quote "<his words>"). voice.py refuses `record` (even the dry run) while animatic_owner is not done.
Rules-2 thresholds (23/11/2026 unified Blueprint): scriptlint.py (script numbers) and qa.cjs (picture checks) read this switch; see the vault note 'Bo kiem may v2.0 - thay doi (23-11)'.
  python3 tools/rules2.py <id>      prints: rules version, animatic proof, animatic_owner state (exit 0 = voice may be recorded)"""
import glob, hashlib, json, os, re, sys

ROOT = os.path.abspath(os.path.expanduser(os.environ.get('CINE3D_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def is_goat(B=None, state=None):
    if state and state.get('channel') == 'goat': return True
    if not isinstance(B, dict): return False
    v = B.get('voices')
    return B.get('pack') == 'goat' or B.get('channel') == 'goat' or (isinstance(v, dict) and 'ron' in v)
def cli_rules(argv=None):
    a = list(sys.argv if argv is None else argv)
    for i, x in enumerate(a):
        if x == '--rules' and i + 1 < len(a): return a[i + 1]
        if x.startswith('--rules='): return x.split('=', 1)[1]
    return None
def rules_version(B=None, state=None, cli=None):
    """1 or 2. goat is always 1."""
    if is_goat(B, state): return 1
    for v in (cli, (B or {}).get('rules') if isinstance(B, dict) else None, (state or {}).get('rules')):
        if v is None: continue
        try: return 2 if int(v) >= 2 else 1
        except (TypeError, ValueError): continue
    return 1
def read_state(id):
    try: return json.load(open(f'{ROOT}/out/{id}/pipeline.json', encoding='utf-8'))
    except Exception: return None
def times_js_path(id): return f'{ROOT}/episodes/{id}.times.js'
def read_times_js(id):
    """episodes/<id>.times.js as a dict (None if missing or unreadable). 24/11: tools/animatic.py --times-only writes an ESTIMATED one (`estimated: true` + a header comment) before any voice exists; voice.py build overwrites it with the real times."""
    try: s = open(times_js_path(id), encoding='utf-8').read(); return json.loads(s[s.index('{'):s.rindex('}') + 1])
    except Exception: return None
def times_estimated(id):
    """True = the times file is an estimate, False = real (voice.py wrote it), None = no times file"""
    d = read_times_js(id)
    if d is None: return None if not os.path.exists(times_js_path(id)) else False
    return bool(d.get('estimated'))
def animatic_files(id):
    o = f'{ROOT}/out/{id}'; fs = [f'{o}/animatic.mp4', f'{o}/animatic_sheet.jpg']
    fs += sorted(glob.glob(f'{o}/animatic_sheet_*.jpg')) + sorted(glob.glob(f'{o}/animatic/*.jpg') + glob.glob(f'{o}/animatic/*.png') + glob.glob(f'{o}/animatic/*.mp4'))
    return [f for f in fs if os.path.exists(f)]
def _sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()
def animatic_hash(id):
    """hash of the animatic proof (None if there is none): a re-made animatic invalidates the owner's approval"""
    fs = animatic_files(id)
    return hashlib.sha256('|'.join(f'{os.path.basename(f)}:{_sha(f)}' for f in fs).encode()).hexdigest() if fs else None
def animatic_owner_ok(id):
    """(ok, why). ok only when the owner's OK is recorded with his words, the animatic proof exists, it is the one he approved, and the script text is the one he approved."""
    st = read_state(id)
    if not st: return False, f'no out/{id}/pipeline.json (no record of any approval)'
    rec = (st.get('records') or {}).get('animatic_owner')
    if not rec: return False, 'animatic_owner is not recorded'
    if rec.get('verdict') != 'OK': return False, f'animatic_owner is {rec.get("verdict")}, not OK'
    if not (rec.get('quote') or '').strip(): return False, 'the approval has no quote of the owner\'s words'
    h = animatic_hash(id)
    if h is None: return False, 'the animatic proof is missing (out/<id>/animatic.mp4, animatic_sheet.jpg or animatic/*.jpg)'
    if rec.get('hash') != h: return False, 'the animatic changed after the owner approved it'
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import pipeline as P
        cur = P.judged_hash(P.Ep(id).beats)
        if rec.get('jhash') and cur and rec['jhash'] != cur: return False, 'the script text changed after the owner approved the animatic'
    except Exception: pass
    return True, 'ok'

def credit_owner_ok(id):
    """(ok, why). Gemini Studio 1A credit lock: owner approved voice credit spend after script_gate PASS (with --quote), and script text has not changed since."""
    st = read_state(id)
    if not st: return False, f'no out/{id}/pipeline.json (no record of any approval)'
    rec = (st.get('records') or {}).get('credit_owner')
    if not rec: return False, 'credit_owner is not recorded'
    if rec.get('verdict') != 'OK': return False, f'credit_owner is {rec.get("verdict")}, not OK'
    if not (rec.get('quote') or '').strip(): return False, 'the approval has no quote of the owner\'s words'
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import pipeline as P
        cur = P.judged_hash(P.Ep(id).beats)
        if not cur: return False, f'episodes/{id}.beats.json missing or invalid'
        if rec.get('jhash') and rec['jhash'] != cur: return False, 'the script text changed after the owner approved voice credit'
    except Exception: pass
    return True, 'ok'

def voice_unlocked(id):
    """(ok, mode, why). Voice recording is unlocked if EITHER animatic_owner (Claude v2) OR credit_owner (Gemini 1A) is recorded with owner's words and matching script hash."""
    ok_a, why_a = animatic_owner_ok(id)
    if ok_a: return True, 'animatic_owner', 'ok'
    ok_c, why_c = credit_owner_ok(id)
    if ok_c: return True, 'credit_owner', 'ok'
    st = read_state(id) or {}
    if st.get('workflow') == 'gemini':
        return False, 'credit_owner', why_c
    return False, 'animatic_owner', why_a

if __name__ == '__main__':
    if len(sys.argv) < 2: print(__doc__); sys.exit(2)
    i = sys.argv[1]; st = read_state(i); bp = f'{ROOT}/episodes/{i}.beats.json'
    try: B = json.load(open(bp, encoding='utf-8'))
    except Exception: B = None
    v = rules_version(B, st, cli_rules()); ok, mode, why = voice_unlocked(i); wf = (st or {}).get('workflow') or 'claude'
    print(f'{i}: rules {v} (workflow {wf}); animatic proof: {", ".join(os.path.relpath(f, ROOT) for f in animatic_files(i)) or "none"}; {mode}: {"DONE" if ok else why}')
    sys.exit(0 if ((v == 1 and wf != 'gemini') or ok) else 1)
