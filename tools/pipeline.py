#!/usr/bin/env python3
"""cine3d PIPELINE: where is this episode, what is the next step, who does it, with which brief, and which gate cannot be skipped.
  python3 tools/pipeline.py new <id> --channel trada|goat      # card skeleton + out/<id>/pipeline.json
  python3 tools/pipeline.py copy <src-id> <new-id> [--channel X]   # copy card, treatment, beats, episode + side files under a new id (ids rewritten, voice takes reused), then adopt
  python3 tools/pipeline.py adopt <id> --channel X             # an episode already on disk gets a pipeline.json (nothing is forced)
  python3 tools/pipeline.py status <id> [--run] [--json]       # one line per step, then NEXT. --run re-runs the machine checks of the current step (and, if it passes, the next one...)
  python3 tools/pipeline.py next <id> [--json]                 # the next step only: who, model, effort, commands, proof files, brief
  python3 tools/pipeline.py brief <id> <template>              # pipeline/briefs/<template>.md with {id} {channel} ... filled
  python3 tools/pipeline.py record <id> <step> <verdict> --by who [--note ..] [--quote ..] [--mp4 f] [--platform p --video-id v] [--at ISO] [--force "reason"]
  python3 tools/pipeline.py can-post <id> [--allow-forced]     # exit 0 + CAN POST only when steps 1-11 (v2: 1-15) are done, nothing stale
  python3 tools/pipeline.py list [--channel X] [--json]
Exit codes: 0 ok/allowed, 1 not allowed/failed, 2 usage error. Docs: docs/v4-pipeline.md. Config: pipeline/channels.json. Python 3 standard library only.
State = files on disk + out/<id>/pipeline.json (verdicts no file can prove: who, when, hash of what was judged). Nothing is ever deleted by this tool."""
import argparse, unicodedata, csv, datetime, hashlib, importlib.util, json, os, re, signal, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import rules2   # 23/11: rules version 2 (Master Blueprint v2.0, trada only)

HOME = os.path.expanduser('~')
ROOT = os.path.abspath(os.path.expanduser(os.environ.get('CINE3D_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if os.path.realpath(ROOT) == os.path.realpath(f'{HOME}/cine3d'): ROOT = f'{HOME}/cine3d'   # ~/cine3d may be a symlink: keep the name the owner uses
STEPS = ['card', 'treatment', 'script', 'script_gate', 'voice', 'audio', 'picture', 'driver_review', 'render', 'episode_gate', 'owner', 'posted', 'ledger']
STEPS_V2 = STEPS[:4] + ['build', 'animatic', 'animatic_owner', 'voice', 'audio', 'retime'] + STEPS[6:]   # rules 2 (trada): the credit lock. 24/11: `build` = the whole episode picture, silent, on ESTIMATED times; `animatic` = that build rendered at full motion without the voice; no ElevenLabs credit before the owner approved it; `retime` = after the voice: real times + mouth envelopes
STEPS_GEMINI = ['card', 'treatment', 'script', 'script_gate', 'credit_owner', 'voice', 'audio', 'picture', 'render', 'episode_gate', 'driver_review', 'owner', 'posted', 'ledger']   # Gemini Studio workflow: single 3D build on real times, strict ElevenLabs credit lock via `credit_owner`, multimodal review via review_proxy.mp4
EXTRA_META = {'build': dict(who='cine3d builder (silent build on estimated times)', agent='cine3d-builder', model='sonnet', effort='medium (high if the episode has action shots)', brief='build'),
              'animatic': dict(who='driver (main session; renders the silent build at full motion, no voice)'), 'animatic_owner': dict(who='owner (record only with his own words)'),
              'credit_owner': dict(who='owner (Gemini Studio 1A credit lock after script_gate PASS + voice.py need quote; record only with his own words)'),
              'retime': dict(who='cine3d builder (real times + mouth envelopes after the voice)', agent='cine3d-builder', model='sonnet', effort='medium', brief='build')}
RECORDABLE = ['script_gate', 'facts', 'animatic_owner', 'credit_owner', 'driver_review', 'render', 'episode_gate', 'owner', 'posted']
ALLOWED = {'script_gate': ('PASS', 'FAIL'), 'facts': ('GO', 'NOGO'), 'driver_review': ('OK', 'FIX'), 'render': ('OK', 'DONE'),
           'episode_gate': ('PASS', 'FAIL'), 'owner': ('OK', 'NO'), 'posted': ('OK',), 'animatic_owner': ('OK', 'NO'), 'credit_owner': ('OK', 'NO')}
# 14/11: every step takes the same verdict words, any case. pass / ok / done / go = positive, fail / fix / no / nogo = negative; the stored word is the step's own (first / second of ALLOWED)
POS_WORDS = {'PASS', 'OK', 'DONE', 'GO'}; NEG_WORDS = {'FAIL', 'FIX', 'NO', 'NOGO', 'NO-GO'}
STALE_SCRIPT = 'STALE (a line, its speaker, its `say`, the order of the lines or the header meta changed since the verdict: re-ask only the changed points; sound and timing edits do not count)'
STALE_OLD = 'STALE (this verdict was recorded with the old whole-file hash and beats.json changed since: if only sound or timing fields changed, record it again with a note; if a line changed, re-ask only the changed points)'
JV = 2   # version of the judged-content hash of the script gate
OKV = {'script_gate': 'PASS', 'facts': 'GO', 'driver_review': 'OK', 'render': ('OK', 'DONE'), 'episode_gate': 'PASS', 'owner': 'OK', 'animatic_owner': 'OK', 'credit_owner': 'OK'}
TREATMENT_HEADINGS = ['About', 'Feelings', 'Cause chain', 'Tension curve', '0-3 s', '4-10 s', 'Last 15 s', 'Sound plan']
CARD_REQ = {'trada': ['title', 'person', 'sum', 'recipient', 'first_frame', 'kind'],
            'goat': ['title', 'claim', 'side', 'comment_ron', 'comment_leo', 'facts', 'kind']}
ESTIMATED = re.compile(r'timing (was |is )?estimated|estimated (the )?timing|timing estimate|estimated from (the )?text', re.I)
STALE_MSG = 'STALE (file changed since the verdict: re-ask only the changed points)'
NUMBER = {s: i + 1 for i, s in enumerate(STEPS)}
def rules_of(st):
    """1 or 2 for this episode (rules2.py: beats header `rules`, then pipeline.json `rules`, else 1; goat is always 1)"""
    try: B = json.load(open(f'{ROOT}/episodes/{st["id"]}.beats.json', encoding='utf-8'))
    except Exception: B = None
    return rules2.rules_version(B, st, None)
def steps_of(st):
    if (st or {}).get('workflow') == 'gemini': return STEPS_GEMINI
    return STEPS_V2 if rules_of(st) == 2 else STEPS
def num(st, s): return steps_of(st).index(s) + 1
def r2args(st): return ['--rules', '2'] if rules_of(st) == 2 else []   # added to the lint and qa commands only for v2, so a v1 command and cache key stay exactly as before


def ex(p): return os.path.expanduser(p) if isinstance(p, str) else p
def now_iso(): return datetime.datetime.now().astimezone().isoformat(timespec='seconds')
def rel(p):
    for r in (ROOT, os.path.realpath(ROOT)):
        if os.path.abspath(p).startswith(r + os.sep): return os.path.relpath(os.path.abspath(p), r)
    return p
def die(msg, code=2): print(msg, file=sys.stderr if code == 2 else sys.stdout); sys.exit(code)


_cfg = None
def cfg():
    global _cfg
    if _cfg is None:
        f = os.path.join(ROOT, 'pipeline', 'channels.json')
        if not os.path.exists(f): die(f'missing {f}')
        _cfg = json.load(open(f, encoding='utf-8'))
    return _cfg
def channel(name):
    c = cfg()['channels'].get(name)
    if not c: die(f'unknown channel {name!r}; known: {", ".join(cfg()["channels"])}')
    return c


_memo = {}
def sha(path):
    """sha256 of a file (None if missing); memoised by size + mtime for this run."""
    try: s = os.stat(path)
    except OSError: return None
    k = (path, s.st_size, s.st_mtime_ns)
    if k not in _memo:
        h = hashlib.sha256()
        with open(path, 'rb') as f:
            for blk in iter(lambda: f.read(1 << 20), b''): h.update(blk)
        _memo[k] = h.hexdigest()
    return _memo[k]
def fstat(path):
    try: s = os.stat(path); return f'{s.st_size}:{s.st_mtime_ns}'
    except OSError: return '-'
def mtime(path):
    try: return os.stat(path).st_mtime_ns
    except OSError: return None
def keyof(*parts): return hashlib.sha256(json.dumps(parts, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
def judged_hash(path):
    """Hash of what a script reviewer judges (14/11): the header `meta`, and per SPOKEN beat in order its id, who, spk, text, say. Tension, gap, gain, sfx, music, duck, impact, tempo, pauses
    (a silent beat has no words) and every other sound or timing field are not in it. None if the file is missing or not JSON."""
    try: B = json.load(open(path, encoding='utf-8'))
    except Exception: return None
    if not isinstance(B, dict) or not isinstance(B.get('beats'), list): return None
    rows = [[b.get('id'), b.get('who'), b.get('spk'), b.get('text'), b.get('say')] for b in B['beats'] if isinstance(b, dict) and 'text' in b]
    return keyof(dict(v=JV, meta=B.get('meta'), beats=rows))
DIRTY = set()   # episode ids whose state got an in-memory upgrade (old whole-file hash -> judged hash) that status / next / record then save
def beats_match(st, e):
    """verdict_check matcher for the script gate / facts records: None = still valid, else the STALE text."""
    def m(rec):
        cur = judged_hash(e.beats)
        if rec.get('jhash'): return None if rec['jhash'] == cur else STALE_SCRIPT
        if rec.get('hash') == sha(e.beats):   # old record, file untouched since: valid; remember the judged hash so later sound edits no longer stale it
            if cur: rec['jhash'] = cur; rec['jv'] = JV; DIRTY.add(st['id'])
            return None
        return STALE_OLD
    return m


# ---------------------------------------------------------------- paths and state
class Ep:
    def __init__(self, id):
        self.id = id
        self.card = f'{ROOT}/episodes/{id}.card.json'; self.treatment = f'{ROOT}/episodes/{id}.treatment.md'
        self.beats = f'{ROOT}/episodes/{id}.beats.json'; self.episode = f'{ROOT}/episodes/{id}.js'
        self.out = f'{ROOT}/out/{id}'; self.audio = f'{self.out}/audio'; self.state_path = f'{self.out}/pipeline.json'
        self.mp4_default = f'{self.out}/{id}.mp4'; self.times_json = f'{self.audio}/times.json'; self.times_js = f'{ROOT}/episodes/{id}.times.js'
    def related(self):
        import glob
        fs = glob.glob(f'{ROOT}/episodes/{self.id}.*') + glob.glob(f'{ROOT}/episodes/{self.id}_*')
        return sorted(f for f in fs if not f.endswith(('.card.json', '.treatment.md')))


def valid_id(id):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', id): die(f'bad episode id {id!r} (letters, digits, _ and - only)')


def load_state(id, must=True):
    p = Ep(id).state_path
    if not os.path.exists(p):
        if must: die(f'{id}: no pipeline.json ({rel(p)}). Use `pipeline.py new {id} --channel X` or `adopt`.')
        return None
    return json.load(open(p, encoding='utf-8'))
def save_state(st):
    e = Ep(st['id']); os.makedirs(e.out, exist_ok=True); tmp = e.state_path + '.tmp'
    json.dump(st, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); os.replace(tmp, e.state_path)
def new_state(id, ch): return dict(id=id, channel=ch, created=now_iso(), records={}, posted=[], cache={}, log=[])


# ---------------------------------------------------------------- results
class R:
    def __init__(self, state, reason='', repro=None, files=None, cached=False, missing=None):
        self.state, self.reason, self.repro, self.files, self.cached, self.missing = state, reason, repro, files or [], cached, missing or []
        self.forced = None
    def done(self): return self.state == 'DONE'
    def d(self): return dict(state=self.state, reason=self.reason, repro=self.repro, files=[rel(f) for f in self.files], cached=self.cached, forced=self.forced)


# ---------------------------------------------------------------- step 1: card
def read_json(path):
    try: return json.load(open(path, encoding='utf-8')), None
    except Exception as e: return None, f'{type(e).__name__}: {e}'
def check_card(e, ch, st=None):
    if not os.path.exists(e.card): return R('TODO', f'{rel(e.card)} does not exist', f'pipeline.py new {e.id} --channel {ch}  (or write the file with these fields: {", ".join(CARD_REQ[ch])})', [e.card])
    c, err = read_json(e.card)
    if err or not isinstance(c, dict): return R('FAIL', f'{rel(e.card)} is not valid JSON object ({err})', f'python3 -m json.tool {rel(e.card)}', [e.card])
    bad = []
    for k in CARD_REQ[ch]:
        v = c.get(k)
        if k == 'facts':
            if not isinstance(v, list): bad.append('facts (must be a list, may be empty)')
        elif not isinstance(v, str) or not v.strip(): bad.append(k)
    if ch == 'goat':
        if isinstance(c.get('side'), str) and c['side'].strip() and c['side'].strip() not in ('ron', 'leo'): bad.append('side (must be ron or leo)')
        if isinstance(c.get('kind'), str) and c['kind'].strip() and c['kind'].strip() not in ('fullbeef', 'quickie'): bad.append('kind (must be fullbeef or quickie)')
    else:
        k = c.get('kind')
        if isinstance(k, str) and k.strip() and not re.fullmatch(r'standalone|special|series:\S.*', k.strip()): bad.append('kind (must be standalone, special or series:<name>)')
        if st is not None and rules_of(st) == 2:   # the owner 23/11 evening: every Blueprint-v2 card names its pillar (1 Bíp Cứu Nhà Tèo, 2 Từ Điển Tiếng Mẹ & Chuyện Nhà, 3 Tèo & Đồng Lương)
            pl = c.get('pillar')
            if not isinstance(pl, str) or not re.match(r'\s*[123]\b', pl): bad.append('pillar (must start with 1, 2 or 3: 1 Bíp Cứu Nhà Tèo, 2 Từ Điển Tiếng Mẹ & Chuyện Nhà, 3 Tèo & Đồng Lương)')
            b10 = c.get('bar10k')
            if b10 not in (None, '', 'yes', 'no'): bad.append('bar10k (yes or no; the 10K bar runs one episode in three)')
    of = c.get('owner_fixed')
    if of is not None and not (isinstance(of, list) and all(isinstance(x, str) and x.strip() for x in of)): bad.append('owner_fixed (optional; must be a list of non-empty strings)')
    if bad: return R('FAIL', f'{rel(e.card)}: empty or invalid fields: {", ".join(bad)}', f'edit {rel(e.card)}', [e.card])
    return R('DONE', f'title: {c["title"].strip()[:60]}', files=[e.card])


# ---------------------------------------------------------------- step 2: treatment
def hnorm(s):
    s = s.lower().replace('–', '-').replace('—', '-').replace('*', '').replace('`', '').strip().rstrip(':').strip()
    return re.sub(r'\s+', '', s)
def check_treatment(e):
    if not os.path.exists(e.treatment): return R('TODO', f'{rel(e.treatment)} does not exist', f'write it with these headings: {", ".join(TREATMENT_HEADINGS)}', [e.treatment])
    secs = []; cur = None
    for line in open(e.treatment, encoding='utf-8').read().splitlines():
        m = re.match(r'^\s{0,3}#{1,6}\s*(.+?)\s*#*\s*$', line) or re.match(r'^\s*\*\*(.+?)\*\*:?\s*$', line)
        if m: cur = [hnorm(m.group(1)), []]; secs.append(cur); continue
        t = line.strip()
        if cur is not None and re.search(r'\w', t) and not re.fullmatch(r'(?i)(todo|tbd|n/a)\W*', t): cur[1].append(t)
    miss, empty = [], []
    for h in TREATMENT_HEADINGS:
        hn = hnorm(h); found = [s for s in secs if s[0] == hn or (s[0].startswith(hn) and not s[0][len(hn)].isalnum())]
        if not found: miss.append(h)
        elif not any(s[1] for s in found): empty.append(h)
    if miss or empty:
        return R('FAIL', f'{rel(e.treatment)}: ' + '; '.join(x for x in ((f'missing headings: {", ".join(miss)}' if miss else ''), (f'no text under: {", ".join(empty)}' if empty else '')) if x), f'edit {rel(e.treatment)} (each heading needs one non-empty line)', [e.treatment])
    return R('DONE', f'{len(TREATMENT_HEADINGS)} headings filled', files=[e.treatment])


# ---------------------------------------------------------------- machine checks
def run_cmd(args, timeout):
    """-> (kind, output): kind 'ok' | 'timeout'. Own process group so a time-out also stops the browser the check started."""
    p = subprocess.Popen(args, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, text=True, errors='replace', start_new_session=True)
    try:
        out, _ = p.communicate(timeout=timeout); return p.returncode, out
    except subprocess.TimeoutExpired:
        try: os.killpg(p.pid, signal.SIGTERM)
        except OSError: pass
        try: out, _ = p.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            try: os.killpg(p.pid, signal.SIGKILL)
            except OSError: pass
            out, _ = p.communicate()
        return 'timeout', out or ''


def tail(out, n=5): return ' | '.join(l.strip() for l in out.strip().splitlines()[-n:])
def judge(name, rc, out, pass_re, fail_re, timeout):
    """-> (state, reason). PASS needs rc 0 AND the pass line; a crash, an unknown output or a time-out is ERROR, never PASS."""
    if rc == 'timeout': return 'ERROR', f'{name}: timed out after {timeout} s; last lines: {tail(out)}'
    if rc == 0 and re.search(pass_re, out, re.M): return 'DONE', f'{name}: ' + (re.search(pass_re, out, re.M).group(0).strip()[:100])
    if rc == 1 and re.search(fail_re, out, re.M):
        head = re.search(fail_re, out, re.M).group(0).strip()
        det = next((l.strip() for l in out.splitlines() if re.match(r'^\s+FAIL\b', l)), '')
        return 'FAIL', f'{name}: {head[:60]}' + (f' -- {det[:200]}' if det else '')
    return 'ERROR', f'{name}: crashed or printed no verdict (exit {rc}); last 5 lines: {tail(out)}'


def machine(st, step, key, checks, run, files, timeout=None):
    """checks: [dict(name, args, pass_re, fail_re, repro)]. Uses the cached result if the input key is unchanged; with run=True re-runs it when it is not DONE."""
    timeout = timeout or cfg().get('check_timeout_s', 300)
    repro = ' ; '.join(c['repro'] for c in checks)
    ca = st['cache'].get(step)
    if ca and ca.get('key') == key:
        r = R(ca['state'], ca['reason'], repro, files, cached=True); r.reason += f'  [cached {ca["at"][5:16].replace("T", " ")}]'
        if not (run and r.state != 'DONE'): return r
    elif not run:
        why = 'inputs changed since the last run' if ca else 'not run yet'
        return R('TODO', f'machine check {why}: run `pipeline.py status {st["id"]} --run`', repro, files)
    res = []
    for c in checks:
        rc, out = run_cmd(c['args'], timeout)
        if c.get('custom'): res.append(c['custom'](rc, out))
        else: res.append(judge(c['name'], rc, out, c['pass_re'], c['fail_re'], timeout))
    state = 'ERROR' if any(s == 'ERROR' for s, _ in res) else 'FAIL' if any(s == 'FAIL' for s, _ in res) else 'DONE'
    reason = '; '.join(r for s, r in res if s != 'DONE') if state != 'DONE' else '; '.join(r for _, r in res)
    st['cache'][step] = dict(key=key, state=state, reason=reason, at=now_iso()); save_state(st)
    return R(state, reason, repro, files)


def tool_sig(*names): return [sha(f'{ROOT}/tools/{n}') for n in names]
def engine_sig():
    out = []
    for base in ('core', 'packs'):
        for dp, dn, fn in os.walk(f'{ROOT}/{base}'):
            dn.sort()
            for f in sorted(fn): out.append(fstat(os.path.join(dp, f)))
    return keyof(out, fstat(f'{ROOT}/main.js'), fstat(f'{ROOT}/index.html'))


def py(name): return ex(cfg()['venv_python']) if name == 'venv' else cfg().get('python3', 'python3')


# ---------------------------------------------------------------- step 3: script
def check_script(st, e, run):
    if not os.path.exists(e.beats): return R('TODO', f'{rel(e.beats)} does not exist', f'write the beats file (see docs/v4-sound-and-tension.md for tension/mood/land fields)', [e.beats])
    r2 = r2args(st); cmd = f'python3 tools/scriptlint.py {rel(e.beats)} --strict' + ''.join(' ' + x for x in r2)
    def lint(rc, out):
        s, r = judge('scriptlint', rc, out, r'^LINT PASS', r'^LINT FAIL.*', cfg().get('check_timeout_s', 300))
        if s == 'DONE' and ESTIMATED.search(out): r = '(timing estimated; re-checked at the audio step) ' + r
        return s, r
    chk = [dict(name='scriptlint', args=[py('p'), 'tools/scriptlint.py', rel(e.beats), '--strict'] + r2, custom=lint, repro=cmd)]
    return machine(st, 'script', keyof(sha(e.beats), tool_sig('scriptlint.py'), *(['rules2', tool_sig('rules2.py')] if r2 else [])), chk, run, [e.beats])


# ---------------------------------------------------------------- recorded verdict steps
def short_hash(h): return (h or '-')[:8]
def rec_line(rec): return f'{rec["verdict"]} by {rec["by"]} {rec["at"][:16].replace("T", " ")} (hash {short_hash(rec.get("jhash") or rec.get("hash"))})' + (f' note: {rec["note"]}' if rec.get('note') else '')
def verdict_check(st, rec_key, cur_hash, label, files, record_cmd, match=None):
    rec = st['records'].get(rec_key)
    if not rec: return R('TODO', f'no {label} verdict recorded', record_cmd, files)
    if cur_hash is None: return R('FAIL', f'{label}: the judged file is missing', None, files)
    bad = match(rec) if match else (None if rec.get('hash') == cur_hash else STALE_MSG)
    if bad: return R('STALE', f'{label}: {bad}  [was: {rec_line(rec)}]', record_cmd, files)
    ok = OKV[rec_key]
    if rec['verdict'] in (ok if isinstance(ok, tuple) else (ok,)): return R('DONE', rec_line(rec), files=files)
    return R('FAIL', f'{label}: recorded {rec_line(rec)}', record_cmd, files)

def check_script_gate(st, e, ch):
    h = sha(e.beats); bm = beats_match(st, e)
    r = verdict_check(st, 'script_gate', h, 'script gate', [e.beats], f'pipeline.py record {e.id} script_gate PASS --by <agent> [--note ...]', bm)
    if ch != 'goat': return r
    c, _ = read_json(e.card)
    if isinstance(c, dict) and isinstance(c.get('facts'), list) and not c['facts']:
        return r   # fact-free script: nothing to check
    f = verdict_check(st, 'facts', h, 'facts check', [e.beats], f'pipeline.py record {e.id} facts GO --by <agent>', bm)
    if r.done() and f.done(): return R('DONE', f'{r.reason}; facts {f.reason}', files=[e.beats])
    first = r if not r.done() else f
    out = R(first.state if first.state != 'DONE' else 'TODO', '; '.join(x for x in (f'script_gate: {r.reason}' if not r.done() else '', f'facts: {f.reason}' if not f.done() else '') if x), first.repro, [e.beats])
    out.missing = [k for k, x in (('script_gate', r), ('facts', f)) if not x.done()]
    return out


# ---------------------------------------------------------------- rules 2: silent animatic + owner approval (the credit lock, before any voice)
def check_build(st, e):
    """24/11: the whole picture exists before any voice: episodes/<id>.js + episodes/<id>.times.js (ESTIMATED until voice.py build writes the real one)"""
    tj = rules2.times_js_path(e.id); est = rules2.times_estimated(e.id)
    cmd = f'~/tdvai/.venv/bin/python tools/animatic.py {rel(e.beats)} --times-only'
    if est is None: return R('TODO', f'{rel(tj)} does not exist: write the estimated times first (the episode imports them)', cmd, [tj])
    if not os.path.exists(e.episode): return R('TODO', f'{rel(e.episode)} does not exist: the builder builds the silent picture (shots, acting, camera, overlays) before any voice', f'agent: cine3d-builder (brief: pipeline.py brief {e.id} build)', [e.episode])
    return R('DONE', f'{rel(e.episode)} + {"ESTIMATED" if est else "real"} times ({rel(tj)})', files=[e.episode, tj])
def check_retime(st, e):
    """24/11: after the voice: the times are the real ones (voice.py build) and the mouth envelopes were cut from that voice"""
    tj = rules2.times_js_path(e.id); lips = f'{ROOT}/episodes/{e.id}_lips.json'; est = rules2.times_estimated(e.id)
    if est is not False: return R('TODO', f'{rel(tj)} is still the ESTIMATE: voice.py build writes the real times', f'~/tdvai/.venv/bin/python tools/voice.py build {rel(e.beats)}', [tj])
    if not os.path.exists(lips): return R('TODO', f'{rel(lips)} does not exist: cut the mouth envelopes from the recorded voice and check the shots still fit the real times', f'agent: cine3d-builder (retime; node tools/lips.cjs episodes/{e.id}.js --stem ... --out {rel(lips)})', [lips])
    if mtime(lips) < mtime(e.times_json): return R('FAIL', f'{rel(lips)} is older than the real times ({rel(e.times_json)}): it was cut from an earlier voice', f'agent: cine3d-builder (retime)', [lips])
    return R('DONE', f'real times + mouth envelopes ({rel(lips)})', files=[tj, lips])
def check_animatic(st, e):
    fs = rules2.animatic_files(e.id)
    if fs: return R('DONE', 'silent animatic: ' + ', '.join(rel(f) for f in fs[:3]) + (f' (+{len(fs) - 3} more)' if len(fs) > 3 else ''), files=fs)
    return R('TODO', f'no silent animatic yet (the built episode rendered at full motion, no voice): out/{e.id}/animatic.mp4, animatic_sheet.jpg', f'~/tdvai/.venv/bin/python tools/animatic.py {rel(e.beats)}', [])
def check_animatic_owner(st, e):
    h = rules2.animatic_hash(e.id); fs = rules2.animatic_files(e.id)
    def m(rec):
        if rec.get('hash') != h: return 'the animatic changed after the owner approved it'
        cur = judged_hash(e.beats)
        return 'the script text changed after the owner approved the animatic' if rec.get('jhash') and cur and rec['jhash'] != cur else None
    r = verdict_check(st, 'animatic_owner', h, 'animatic owner', fs, f'pipeline.py record {e.id} animatic_owner OK --by <who> --quote "<the owner\'s own words>"', m)
    rec = st['records'].get('animatic_owner')
    if r.done() and rec: r.reason += f' quote: "{rec.get("quote", "")[:80]}"'
    return r
def check_credit_owner(st, e):
    h = judged_hash(e.beats)
    def m(rec):
        cur = judged_hash(e.beats)
        return 'the script text changed after the owner approved voice credit' if rec.get('jhash') and cur and rec['jhash'] != cur else None
    r = verdict_check(st, 'credit_owner', h, 'credit owner', [e.beats], f'pipeline.py record {e.id} credit_owner OK --by <who> --quote "<the owner\'s own words>"', m)
    rec = st['records'].get('credit_owner')
    if r.done() and rec: r.reason += f' quote: "{rec.get("quote", "")[:80]}"'
    return r


# ---------------------------------------------------------------- step 5, 6: voice, audio
def check_voice(st, e, run):
    if not os.path.exists(e.beats): return R('TODO', f'{rel(e.beats)} does not exist', None, [e.beats])
    cmd = f'~/tdvai/.venv/bin/python tools/voice.py need {rel(e.beats)}'
    def judge_need(rc, out):
        if rc == 'timeout': return 'ERROR', f'voice need: timed out; last lines: {tail(out)}'
        m = re.search(r'missing (\d+)', out)
        if rc != 0 or not m: return 'ERROR', f'voice need: crashed or printed no count (exit {rc}); last 5 lines: {tail(out)}'
        n = int(m.group(1))
        if n == 0: return 'DONE', 'voice need: no line missing'
        first = next((l.strip() for l in out.splitlines() if l.strip().startswith('NEED')), '')
        return 'FAIL', f'{n} lines have no voice take, first: {first[:150]}  ({out.strip().splitlines()[-1][:120]})'
    own = f'{ROOT}/voice/index.json'; lib = f'{HOME}/tdvai/vo/lib/index.json'; vd = f'{ROOT}/voice/{e.id}'
    vf = sorted(os.listdir(vd)) if os.path.isdir(vd) else []
    key = keyof(sha(e.beats), fstat(own), fstat(lib), [(f, sha(f'{vd}/{f}') if f == 'takes.json' else fstat(f'{vd}/{f}')) for f in vf], tool_sig('voice.py'))  # takes.json keyed by content, not mtime: voice.py need rewrites it unchanged every run (16/11 loop fix)
    return machine(st, 'voice', key, [dict(name='voice need', args=[py('venv'), 'tools/voice.py', 'need', rel(e.beats)], custom=judge_need, repro=cmd)], run, [e.beats])

def check_audio(st, e, run):
    outs = [f'{e.audio}/mix.wav', f'{e.audio}/times.json', f'{e.audio}/vo_all.wav', f'{ROOT}/episodes/{e.id}.times.js']
    build = f'~/tdvai/.venv/bin/python tools/voice.py build {rel(e.beats)}'
    miss = [rel(f) for f in outs if not os.path.exists(f)]
    if miss: return R('TODO', f'build outputs missing: {", ".join(miss)}', build, outs)
    b = mtime(e.beats); old = [rel(f) for f in outs if mtime(f) < b]
    if old: return R('FAIL', f'build outputs older than {rel(e.beats)}: {", ".join(old)} (the sound was built from an earlier script)', build, outs)
    cmd = f'~/tdvai/.venv/bin/python tools/audiogate.py {rel(e.beats)}'
    r2 = r2args(st); lcmd = f'python3 tools/scriptlint.py {rel(e.beats)} --strict' + ''.join(' ' + x for x in r2)
    def lint_real(rc, out):
        s, r = judge('scriptlint with the real times', rc, out, r'^LINT PASS', r'^LINT FAIL.*', cfg().get('check_timeout_s', 300))
        if s == 'DONE' and ESTIMATED.search(out): return 'FAIL', f'scriptlint still estimated the timing although {rel(e.times_json)} exists: {tail(out)}'
        return s, r
    chk = [dict(name='audiogate', args=[py('venv'), 'tools/audiogate.py', rel(e.beats)], pass_re=r'^AUDIO PASS.*', fail_re=r'^AUDIO FAIL.*', repro=cmd),
           dict(name='scriptlint with the real times', args=[py('p'), 'tools/scriptlint.py', rel(e.beats), '--strict'] + r2, custom=lint_real, repro=lcmd)]
    # 14/11: the episode .js is part of the key (audiogate's check f reads the cut list from it), so a result cached before the episode file existed re-runs once it appears or changes
    key = keyof(sha(e.beats), [fstat(f) for f in outs], sha(e.times_json), fstat(f'{e.audio}/mix_raw.wav'), sha(e.episode), tool_sig('audiogate.py', 'cuts.cjs', 'scriptlint.py'), *(['rules2', tool_sig('rules2.py')] if r2 else []))
    r = machine(st, 'audio', key, chk, run, outs)
    m = re.search(r'(\d+) SKIPPED: ([^;]*?)(?:;|$)', r.reason or '')
    if r.state == 'DONE' and m:   # a skipped check is never shown as plain DONE
        names = re.sub(r'\s*\(.*$', '', m.group(2)).strip(); n = int(m.group(1))
        r.reason = f'({n} check{"" if n == 1 else "s"} skipped: {names}; re-run with --run' + (' once the episode file exists)' if not os.path.exists(e.episode) else ': the episode file exists, so read the audiogate output)') + f'  [was: {r.reason}]'
    return r


# ---------------------------------------------------------------- step 7: picture
def check_picture(st, e, run):
    if not os.path.exists(e.episode): return R('TODO', f'{rel(e.episode)} does not exist', None, [e.episode])
    r2 = r2args(st); chk = [dict(name='qa', args=['node', 'tools/qa.cjs', rel(e.episode), '--beats', rel(e.beats)] + r2, pass_re=r'^ALL PASS.*', fail_re=r'^FAIL \(.*', repro=f'node tools/qa.cjs {rel(e.episode)} --beats {rel(e.beats)}' + ''.join(' ' + x for x in r2)),
           dict(name='clipcheck', args=['node', 'tools/clipcheck.cjs', rel(e.episode)], pass_re=r'^CLIP PASS.*', fail_re=r'^CLIP FAIL.*', repro=f'node tools/clipcheck.cjs {rel(e.episode)}')]
    key = keyof([(rel(f), sha(f)) for f in e.related()], sha(e.beats), tool_sig('qa.cjs', 'clipcheck.cjs'), engine_sig(), *(['rules2'] if r2 else []))
    return machine(st, 'picture', key, chk, run, [e.episode])


# ---------------------------------------------------------------- step 8: driver review
def sheets(e):
    import glob
    return sorted(glob.glob(f'{e.out}/cs*.jpg')), sorted(glob.glob(f'{e.out}/strip_*.jpg'))
def review_proxy(e):
    p = f'{e.out}/review_proxy.mp4'
    return p if os.path.exists(p) else None
def check_driver_review(st, e):
    h = sha(e.episode); cs, strips = sheets(e)
    is_gem = st.get('workflow') == 'gemini'
    proxy = review_proxy(e) if is_gem else None
    cmd = f'python3 tools/build_check.py {rel(e.episode)} --final  (or --proxy-only)' if is_gem else f'python3 tools/sheets.py {rel(e.episode)}  (contact sheets), then  python3 tools/sheets.py {rel(e.episode)} <t0> <t1>  (motion strip of one action)'
    rec_cmd = f'pipeline.py record {e.id} driver_review OK --by driver --note "..."'
    if not cs and not proxy:
        why = f'no review proxy {rel(e.out)}/review_proxy.mp4 (nor cs*.jpg): the driver cannot review what does not exist' if is_gem else f'no contact sheets {rel(e.out)}/cs*.jpg: the driver cannot have read what does not exist'
        return R('FAIL' if st['records'].get('driver_review') else 'TODO', why, cmd, [e.episode])
    latest = max(mtime(x) for x in ([cs[-1]] if cs else []) + ([proxy] if proxy else []))
    ep_m = mtime(e.episode) or 0
    proof_old = f'review proof older than {rel(e.episode)} (made before the last edit): re-make it' if latest < ep_m else None
    proof_files = [e.episode] + ([proxy] if proxy else []) + cs[:1]
    r = verdict_check(st, 'driver_review', h, 'driver review', proof_files, rec_cmd)
    if r.state == 'DONE' and proof_old: return R('FAIL', proof_old, cmd, [e.episode])
    if r.state == 'TODO':
        desc = f'review_proxy.mp4' + (f' + {len(cs)} contact sheets' if cs else '') if proxy else f'{len(cs)} contact sheets, {len(strips)} motion strips'
        r.reason += f'  ({desc} in {rel(e.out)})' + (f'; WARNING {proof_old}' if proof_old else '')
    return r


# ---------------------------------------------------------------- step 9: render
def fps_of(mp4):
    rc, out = run_cmd(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate,r_frame_rate', '-of', 'json', mp4], 30)
    try:
        s = json.loads(out)['streams'][0]; vals = []
        for k in ('avg_frame_rate', 'r_frame_rate'):
            a, b = s[k].split('/'); vals.append(float(a) / float(b) if float(b) else 0.0)
        return vals, None
    except Exception: return None, f'ffprobe failed (exit {rc}): {tail(out)}'
def render_mp4(st):
    rec = st['records'].get('render'); return rec.get('mp4') if rec else None
def check_render(st, e, run):
    rec = st['records'].get('render'); render_cmd = f'node tools/render.cjs mp4 {rel(e.episode)} out/{e.id}/{e.id}.mp4 --fps 30 --audio out/{e.id}/audio/mix.wav'
    rec_cmd = f'pipeline.py record {e.id} render OK --by <who> --mp4 out/{e.id}/{e.id}.mp4'
    if not rec: return R('TODO', 'no final mp4 recorded' + (f' ({rel(e.mp4_default)} exists)' if os.path.exists(e.mp4_default) else ''), f'{render_cmd}  then  {rec_cmd}', [e.episode])
    mp4 = rec['mp4']
    if not os.path.exists(mp4): return R('FAIL', f'recorded mp4 is missing: {mp4}', render_cmd, [mp4])
    if sha(mp4) != rec.get('hash') or sha(e.episode) != rec.get('episode_hash'): return R('STALE', f'render: {STALE_MSG}  [mp4 {rel(mp4)}]', f'{render_cmd}  then  {rec_cmd}', [mp4])
    if mtime(mp4) < mtime(e.episode): return R('FAIL', f'{rel(mp4)} is older than {rel(e.episode)}: render again', render_cmd, [mp4])
    fps, err = fps_of(mp4)
    if err: return R('ERROR', err, f'ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate {mp4}', [mp4])
    # standard since 23/11/2026 (owner): 30 fps CFR. 60 fps is still accepted so renders finished and posted before the switch keep their DONE state; new renders are made at 30.
    if any(min(abs(v - 30.0), abs(v - 60.0)) > 0.01 for v in fps): return R('FAIL', f'{rel(mp4)} is not 30 fps CFR (avg {fps[0]:.3f}, r {fps[1]:.3f}; 60 fps accepted only for renders made before 23/11)', render_cmd, [mp4])
    cmd = f'~/tdvai/.venv/bin/python tools/smooth.py {rel(mp4)} --ep {rel(e.episode)}'
    chk = [dict(name='smooth', args=[py('venv'), 'tools/smooth.py', rel(mp4), '--ep', rel(e.episode)], pass_re=r'^SMOOTH (PASS|OK).*', fail_re=r'^SMOOTH FAIL.*', repro=cmd)]
    return machine(st, 'render', keyof(sha(mp4), sha(e.episode), tool_sig('smooth.py')), chk, run, [mp4])


# ---------------------------------------------------------------- steps 10-13
def check_episode_gate(st, e):
    mp4 = render_mp4(st); h = sha(mp4) if mp4 else None
    return verdict_check(st, 'episode_gate', h, 'episode gate', [mp4] if mp4 else [], f'pipeline.py record {e.id} episode_gate PASS --by <agent> [--note ...]')
def check_owner(st, e):
    mp4 = render_mp4(st); h = sha(mp4) if mp4 else None
    r = verdict_check(st, 'owner', h, 'owner', [mp4] if mp4 else [], f'pipeline.py record {e.id} owner OK --by <who> --quote "<the owner\'s own words>"')
    rec = st['records'].get('owner')
    if r.done() and rec: r.reason += f' quote: "{rec.get("quote", "")[:80]}"'
    return r
def check_posted(st, e, ch):
    if st['posted']: return R('DONE', ', '.join(f'{p["platform"]}:{p["video_id"]}' for p in st['posted']))
    return R('TODO', 'no platform id recorded', f'pipeline.py record {e.id} posted OK --by <agent> --platform {channel(ch)["platforms"][0]} --video-id <id>')

def ledger_path():
    p = ex(cfg()['ledger_script'])
    try:
        spec = importlib.util.spec_from_file_location('ledger_mod', p); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m.CSV
    except Exception:
        t = open(p, encoding='utf-8').read(); d = re.search(r'^D\s*=\s*"([^"]+)"', t, re.M)
        return os.path.join(d.group(1), 'ledger.csv') if d else None
def parse_ts(s):
    d = datetime.datetime.fromisoformat(s)
    return d if d.tzinfo else d.astimezone()
def check_ledger(st, e, ch):
    c = channel(ch); posts = st['posted']
    if not posts: return R('TODO', 'nothing posted yet')
    first = min(parse_ts(p['at']) for p in posts); due = first + datetime.timedelta(hours=cfg().get('ledger_wait_hours', 72))
    if datetime.datetime.now().astimezone() < due: return R('WAITING', f'falls due {due.strftime("%Y-%m-%d %H:%M %z")} (72 h after posting {first.strftime("%Y-%m-%d %H:%M")}); then ledger.py update + tags')
    csvp = ledger_path(); lp = ex(cfg()['ledger_script']); upd = f'{ex(cfg()["ledger_update_python"])} {lp} update'
    if not csvp or not os.path.exists(csvp): return R('FAIL', f'ledger CSV not found (from {lp}): {csvp}', upd, [csvp] if csvp else [])
    rows = {r['video_id']: r for r in csv.DictReader(open(csvp, encoding='utf-8', newline=''))}
    ids = [p['video_id'] for p in sorted(posts, key=lambda p: p['platform'] != 'youtube')]
    vid = next((i for i in ids if i in rows), None)
    if not vid: return R('FAIL', f'no row in {csvp} for video id(s) {", ".join(ids)} (ledger rows come from YouTube)', upd, [csvp])
    row = rows[vid]; empty = [t for t in c['ledger_tags_required'] if not (row.get(t) or '').strip()]
    if row.get('channel') != c.get('ledger_channel'): return R('FAIL', f'ledger row {vid} belongs to channel {row.get("channel")!r}, expected {c.get("ledger_channel")!r}', None, [csvp])
    if empty: return R('FAIL', f'ledger row {vid}: tag cells empty: {", ".join(empty)}', f'{ex(cfg()["ledger_update_python"])} {lp} set {vid} ' + ' '.join(f'{t}=<..>' for t in empty), [csvp])
    return R('DONE', f'ledger row {vid} has all tags', files=[csvp])


# ---------------------------------------------------------------- evaluation
def evaluate(st, run=False, upto=None):
    """Evaluate steps in order; a step is evaluated only if every earlier step is DONE. -> list of (step, R or None)."""
    e = Ep(st['id']); ch = st['channel']; out = []; stop = False
    steps = steps_of(st); last = len(steps) if upto is None else upto
    for i, s in enumerate(steps[:last]):
        if stop: out.append((s, None)); continue
        r = {'card': lambda: check_card(e, ch, st), 'treatment': lambda: check_treatment(e), 'script': lambda: check_script(st, e, run),
             'script_gate': lambda: check_script_gate(st, e, ch), 'voice': lambda: check_voice(st, e, run), 'audio': lambda: check_audio(st, e, run),
             'picture': lambda: check_picture(st, e, run), 'driver_review': lambda: check_driver_review(st, e), 'render': lambda: check_render(st, e, run),
             'episode_gate': lambda: check_episode_gate(st, e), 'owner': lambda: check_owner(st, e), 'posted': lambda: check_posted(st, e, ch),
             'ledger': lambda: check_ledger(st, e, ch), 'build': lambda: check_build(st, e), 'retime': lambda: check_retime(st, e), 'animatic': lambda: check_animatic(st, e), 'animatic_owner': lambda: check_animatic_owner(st, e), 'credit_owner': lambda: check_credit_owner(st, e)}[s]()
        rec = st['records'].get(s) or (st['records'].get('facts') if s == 'script_gate' and not st['records'].get('script_gate') else None)
        for k in ((s, 'facts') if s == 'script_gate' else (s,)):
            if st['records'].get(k, {}).get('forced') and r.state != 'TODO': r.forced = st['records'][k]['forced']
        out.append((s, r))
        if not r.done(): stop = True
    return out
def stale_notes(st):
    """Recorded verdicts whose judged file changed, whatever the evaluation order says (an earlier machine step may hide them)."""
    e = Ep(st['id']); R_ = st['records']; out = []
    def chk(k, cur):
        if k in R_ and R_[k].get('hash') is not None and cur is not None and R_[k]['hash'] != cur: out.append(k)
    bm = beats_match(dict(id=st['id']), e)
    for k in ('script_gate', 'facts', 'credit_owner'):
        if k in R_ and sha(e.beats) is not None and bm(dict(R_[k])): out.append(k)
    if 'animatic_owner' in R_: chk('animatic_owner', rules2.animatic_hash(st['id']))
    chk('driver_review', sha(e.episode))
    mp4 = render_mp4(st)
    if 'render' in R_ and (sha(e.episode) != R_['render'].get('episode_hash') or (mp4 and sha(mp4) != R_['render'].get('hash'))): out.append('render')
    if mp4: chk('episode_gate', sha(mp4)); chk('owner', sha(mp4))
    return out
def current(ev):
    for s, r in ev:
        if r is None: return None, None
        if not r.done(): return s, r
    return None, None
def forced_list(st):
    """FORCED records that are live now (they count for can-post)."""
    return [dict(step=k, reason=v['forced'], by=v['by'], at=v['at'], blocked_by=v.get('blocked_by')) for k, v in st['records'].items() if v.get('forced')]
def forced_history(st):
    """Every forced record ever made (the log is append-only), with whether a later record replaced it: shown forever."""
    out = []
    for x in st['log']:
        if x.get('forced'):
            live = st['records'].get(x['step'])
            out.append(dict(step=x['step'], reason=x['forced'], by=x['by'], at=x['at'], blocked_by=x.get('blocked_by'), live=bool(live and live.get('at') == x['at'])))
    return out


# ---------------------------------------------------------------- guidance (next)
def meta(ch, step):
    return channel(ch)['steps'].get(step) or EXTRA_META.get(step, {})
def guide(st, e, step, r):
    ch = st['channel']; c = channel(ch); i = e.id; m = meta(ch, step); T = lambda s: f'python3 tools/{s}'
    V = '~/tdvai/.venv/bin/python'; b = rel(e.beats); ep = rel(e.episode)
    g = dict(what='', cmds=[], proof=[], then=[], briefs=[m.get('brief')] if m.get('brief') else [])
    if step == 'card':
        g.update(what=f'Choose the idea and fill the card (required: {", ".join(CARD_REQ[ch])}).', proof=[rel(e.card)], cmds=[f'edit {rel(e.card)}'] if os.path.exists(e.card) else [f'pipeline.py new {i} --channel {ch}   (writes ONLY the missing card skeleton, overwrites nothing, then edit it)'])
    elif step == 'treatment':
        g.update(what='One-page director treatment. Required headings, each with at least one non-empty line: ' + ', '.join(TREATMENT_HEADINGS) + '.', proof=[rel(e.treatment)], cmds=[f'write {rel(e.treatment)}'])
    elif step == 'script':
        g.update(what='Write beats.json with tension, mood, land per beat, then lint it.', proof=[b], cmds=[f'{T("scriptlint.py")} {b} --strict', f'pipeline.py status {i} --run'])
    elif step == 'script_gate':
        need = r.missing or ['script_gate']
        g['proof'] = [f'recorded verdict in {rel(e.state_path)}']
        if 'script_gate' in need: g['cmds'].append(f'agent: {c["script_gate_agent"]}   then   pipeline.py record {i} script_gate PASS|FAIL --by {c["script_gate_agent"]} --note "<score / retold>"')
        if 'facts' in need: g['cmds'].append(f'agent: {c["facts_agent"]}   then   pipeline.py record {i} facts GO|NOGO --by {c["facts_agent"]}'); g['briefs'].append(meta(ch, 'facts').get('brief'))
        g['what'] = 'Independent script gate, one round, BEFORE any voice credit or build.' + (' GOAT also needs the facts verdict (GO) unless the card facts list is empty.' if ch == 'goat' else '')
    elif step == 'build':
        g.update(what='Rules 2: build the WHOLE picture before any voice: episode file with shots, acting, camera moves, overlays, on ESTIMATED times (0.79 s + 0.21 s per Vietnamese syllable). Mouths stay closed (no lips file yet). voice.py build overwrites the estimated times later.', proof=[ep, f'episodes/{i}.times.js (estimated: true)'], cmds=[f'{V} tools/animatic.py {b} --times-only', f'agent: {c["builder_agent"]}   (brief: pipeline.py brief {i} build)', f'pipeline.py status {i}'])
    elif step == 'animatic':
        g.update(what='Rules 2: render the built episode at full motion WITHOUT the voice (30 fps, 1080x1920; music/SFX only if their stems exist; clean picture, no timecode strip: add --timecode only for a review copy, a delivered Final never has it) = the owner watches the real film minus the voice. Never calls ElevenLabs. --stills = the old one-still-per-shot version; --fps 15 for a quicker look; --wide for the Sunday 16:9 long video (9:16 picture padded, not a true 16:9 layout).', proof=[f'out/{i}/animatic.mp4', f'out/{i}/animatic_sheet.jpg'], cmds=[f'{V} tools/animatic.py {b}', f'pipeline.py status {i}'])
    elif step == 'animatic_owner':
        g.update(what='Rules 2 credit lock: the owner watches the silent animatic and approves it. Record his OK with his own words. voice.py refuses to call ElevenLabs until this is DONE. Never record it for him.', proof=[f'recorded verdict in {rel(e.state_path)}', 'animatic proof unchanged since the verdict'], cmds=[f'pipeline.py record {i} animatic_owner OK|NO --by <who> --quote "<owner words>"'])
    elif step == 'credit_owner':
        g.update(what='Gemini Studio credit lock (1A): show the owner script_gate PASS + voice.py need credit quote and get explicit OK before calling ElevenLabs. voice.py refuses `record` until this is DONE. Never record it for him.', proof=[f'recorded verdict in {rel(e.state_path)}', 'beats judged text unchanged since the verdict'], cmds=[f'{V} tools/voice.py need {b}', f'pipeline.py record {i} credit_owner OK|NO --by <who> --quote "<owner words>"'])
    elif step == 'voice':
        g.update(what='Record every missing line (credit ceiling set by the driver; never above it), then re-check.', proof=[f'voice/{i}/<beat id>.mp3|wav'], cmds=[f'agent: {c["voice_agent"]}', f'{V} tools/voice.py need {b}', f'pipeline.py status {i} --run'])
    elif step == 'audio':
        g.update(what='Build times + stems + music + mix (the real times overwrite the estimated times file), then the sound gate. This step also re-runs scriptlint --strict with the real times (land / cliff_4_10 rules on measured timing).', proof=[f'out/{i}/audio/mix.wav', f'episodes/{i}.times.js', f'out/{i}/audio_report.md'], cmds=[f'agent: {c["voice_agent"]}', f'{V} tools/voice.py build {b}', f'{V} tools/audiogate.py {b}', f'{T("scriptlint.py")} {b} --strict', f'pipeline.py status {i} --run'])
    elif step == 'retime':
        g.update(what='Rules 2, after the voice: the real times are in (voice.py build), cut the mouth envelopes from the voice, fit the shots and acting to the real line times (the episode imports the times file, so most of it follows), set lipsFile.', proof=[f'episodes/{i}.times.js (real)', f'episodes/{i}_lips.json'], cmds=[f'agent: {c["builder_agent"]}   (brief: pipeline.py brief {i} build, part 2)', f'node tools/lips.cjs {ep} --stem <who>=<stem.wav> ... --out episodes/{i}_lips.json', f'pipeline.py status {i}'])
    elif step == 'picture':
        g.update(what='Rules 1: write the episode file, make the mouth envelopes; rules 2: it is already built, so re-run qa + clipcheck on the retimed picture, to PASS (waivers need a reason and one named object; walks, ep.touch and reads declared; read dense strips >= 8 fps, tiles >= 540 px of every move / contact passage).', proof=[ep, f'episodes/{i}_lips.json'], cmds=[f'agent: {c["builder_agent"]}', f'node tools/qa.cjs {ep} --beats {b}', f'node tools/clipcheck.cjs {ep}', f'pipeline.py status {i} --run'])
    elif step == 'driver_review':
        cs, strips = sheets(e); proxy = review_proxy(e)
        if st.get('workflow') == 'gemini':
            g.update(what='Main (Gemini 4 Neon High) watches + listens to review_proxy.mp4 (6-door check) via read_file, writes ONE fix list or records OK.', proof=[f'out/{i}/review_proxy.mp4 ({"found" if proxy else "missing"})'], cmds=[f'python3 tools/build_check.py {ep} --final', f'pipeline.py record {i} driver_review OK|FIX --by driver --note "..."'])
        else:
            g.update(what='Driver reads the contact sheets and the motion strip of every action against the treatment, writes ONE fix list or records OK.', proof=[f'out/{i}/cs*.jpg ({len(cs)} found)', f'out/{i}/strip_*.jpg ({len(strips)} found)'], cmds=[f'{T("sheets.py")} {ep}', f'pipeline.py record {i} driver_review OK|FIX --by driver --note "..."'])
    elif step == 'render':
        g.update(what='30 fps render of the final cut (the standard since 23/11/2026: CRF 17, AAC 192k 48 kHz), then record the mp4 (smooth.py must pass).', proof=[f'out/{i}/{i}.mp4'], cmds=[f'node tools/render.cjs mp4 {ep} out/{i}/{i}.mp4 --fps 30 --audio out/{i}/audio/mix.wav', f'{V} tools/smooth.py out/{i}/{i}.mp4 --ep {ep}   (prints SMOOTH PASS)', f'pipeline.py record {i} render OK --by <who> --mp4 out/{i}/{i}.mp4', f'pipeline.py status {i} --run'])
    elif step == 'episode_gate':
        g.update(what='Blind watch of the final mp4 BEFORE the owner sees it; reads the machine reports; every fix as an exact value, one round.', proof=[f'recorded verdict in {rel(e.state_path)}'], cmds=[f'agent: {c["episode_gate_agent"]}', f'pipeline.py record {i} episode_gate PASS|FAIL --by {c["episode_gate_agent"]} --note "..."'])
    elif step == 'owner':
        g.update(what="The owner watches the final mp4. Record his OK with his own words quoted. Never record it for him.", proof=[f'recorded verdict in {rel(e.state_path)}'], cmds=[f'pipeline.py record {i} owner OK|NO --by <who> --quote "<owner words>"'])
    elif step == 'posted':
        g.update(what='Run can-post first; then post on: ' + ', '.join(c['platforms']) + ' (paused: ' + ', '.join(f'{k} ({v})' for k, v in c['paused_platforms'].items()) + '). Record every platform id.', proof=[f'posted ids in {rel(e.state_path)}'], cmds=[f'pipeline.py can-post {i}', f'agent: {c["posting_agent"]}', f'pipeline.py record {i} posted OK --by {c["posting_agent"]} --platform <p> --video-id <id> [--at <ISO time of posting>]'])
    elif step == 'ledger':
        lp = ex(cfg()['ledger_script']); lu = ex(cfg()['ledger_update_python'])
        g.update(what=f'72 h after posting: ledger update, fill the tag cells ({", ".join(c["ledger_tags_required"])}), driver writes one line "learned".', proof=[ledger_path() or lp], cmds=[f'{lu} {lp} update', f'{lu} {lp} set <video_id> ' + ' '.join(f'{t}=<..>' for t in c['ledger_tags_required'])])
    return g
def brief_file(ch, name):
    if not name: return None
    for n in (f'{name}-{ch}', name):
        p = f'{ROOT}/pipeline/briefs/{n}.md'
        if os.path.exists(p): return p
    return None


# ---------------------------------------------------------------- output helpers
def fmt_status(st, ev, note_cache=True):
    ch = channel(st['channel']); e = Ep(st['id']); c, _ = read_json(e.card) if os.path.exists(e.card) else (None, None)
    title = c.get('title') if isinstance(c, dict) and c.get('title') else '(no card title yet)'
    L = [f'{st["id"]}  [{st["channel"]}] {ch["name"]}  title: {title}', f'root {ROOT}  (repro commands run from there; machine checks use the cache unless --run)']
    for k, (s, r) in enumerate(ev, 1):
        if r is None: L.append(f'{k:2d} {s:14s} --     not evaluated (an earlier step is not done)'); continue
        L.append(f'{k:2d} {s:14s} {r.state:7s}{" FORCED(" + r.forced + ")" if r.forced else ""} {r.reason}')
        if not r.done() and r.repro: L.append(f'   {"":14s} repro/next: {r.repro}')
    fl = forced_history(st)
    if fl:
        L.append('FORCED records (kept forever):')
        for f in fl: L.append(f'   FORCED {f["step"]} by {f["by"]} {f["at"][:16].replace("T", " ")}: {f["reason"]}' + (f'  (earlier step open at the time: {f["blocked_by"]})' if f.get('blocked_by') else '') + ('' if f['live'] else '  [since replaced by a later record]'))
    sn = stale_notes(st)
    if sn and not any(r is not None and r.state == 'STALE' for _, r in ev): L.append(f'STALE verdicts (the judged file changed; shown as STALE once the earlier steps are done again): {", ".join(sn)}')
    s, r = current(ev)
    L.append(f'NEXT: step {num(st, s)} {s}' + (f' ({r.state})' if r else '') + f'  -> pipeline.py next {st["id"]}' if s else ('NEXT: none, every step is DONE' if all(x is not None and x.done() for _, x in ev) else 'NEXT: none'))
    return '\n'.join(L)


def cmd_new(a):
    valid_id(a.id); ch = a.channel; channel(ch); e = Ep(a.id)
    if os.path.exists(e.card) and os.path.exists(e.state_path): die(f'refused: {rel(e.card)} and {rel(e.state_path)} already exist (nothing is overwritten; use `status {a.id}`)', 1)
    if os.path.exists(e.state_path) and load_state(a.id)['channel'] != ch: die(f'refused: {a.id} is already in channel {load_state(a.id)["channel"]}, not {ch}', 1)
    made = []
    card = {k: ('' if k != 'facts' else []) for k in CARD_REQ[ch]}; card['script_doc'] = ''; card['owner_fixed'] = []
    if ch == 'trada': card.update(pillar='', bar10k='no', thread='')
    os.makedirs(os.path.dirname(e.card), exist_ok=True); os.makedirs(e.out, exist_ok=True)
    if not os.path.exists(e.card): json.dump(card, open(e.card, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); made.append(rel(e.card))
    if not os.path.exists(e.state_path):
        ns = new_state(a.id, ch)
        if ch == 'trada': ns['rules'] = 2   # 23/11: a new Trà đá episode follows Master Blueprint v2.0 (goat and every old episode stay on rules 1)
        if getattr(a, 'workflow', None) == 'gemini': ns['workflow'] = 'gemini'
        save_state(ns); made.append(rel(e.state_path))
    print(f'created only the missing files: {", ".join(made)} (existing files are never overwritten); fill every required card field: {", ".join(CARD_REQ[ch])}\nnext: pipeline.py next {a.id}')
def cmd_mix(a):
    """Share of the three Trà đá pillars over the rules-2 cards, against the Blueprint target 40/35/25."""
    import glob
    names = {'1': 'Bíp Cứu Nhà Tèo', '2': 'Từ Điển Tiếng Mẹ & Chuyện Nhà', '3': 'Tèo & Đồng Lương'}; want = {'1': 40, '2': 35, '3': 25}; n = {k: [] for k in names}; none = []
    for q in sorted(glob.glob(f'{ROOT}/out/*/pipeline.json')):
        try: st = json.load(open(q, encoding='utf-8'))
        except Exception: continue
        if st.get('channel') != 'trada' or rules_of(st) != 2: continue
        c, _ = read_json(Ep(st['id']).card); m = re.match(r'\s*([123])\b', (c or {}).get('pillar') or '') if isinstance(c, dict) else None
        (n[m.group(1)] if m else none).append(st['id'])
    tot = sum(len(v) for v in n.values())
    for k in '123': print(f'pillar {k} {names[k]:32s} {len(n[k]):2d}  {(100 * len(n[k]) / tot if tot else 0):3.0f} %  (target {want[k]} %)  {" ".join(n[k])}')
    if none: print('no pillar on the card: ' + ' '.join(none))
def cmd_adopt(a):
    valid_id(a.id); channel(a.channel); e = Ep(a.id)
    if os.path.exists(e.state_path): print(f'{a.id} already has {rel(e.state_path)} (channel {load_state(a.id)["channel"]}); showing status'); return cmd_status(argparse.Namespace(id=a.id, run=False, json=False))
    if not e.related(): die(f'nothing on disk for {a.id} (no episodes/{a.id}.*): use `new {a.id} --channel {a.channel}`', 1)
    ns = new_state(a.id, a.channel)
    if getattr(a, 'workflow', None) == 'gemini': ns['workflow'] = 'gemini'
    save_state(ns); print(f'adopted {a.id} into {a.channel}: {rel(e.state_path)} written; no force applied, missing early artefacts are TODO'); cmd_status(argparse.Namespace(id=a.id, run=False, json=False))

def tkey(spk, text):
    s = re.sub(r'\s+', ' ', unicodedata.normalize('NFC', text).replace('…', '...').strip().lower())
    return f'{spk}|{s}'
def cmd_copy(a):
    import glob, shutil
    valid_id(a.new_id); src, new = Ep(a.id), Ep(a.new_id); s0 = load_state(a.id, must=False)
    ch = a.channel or (s0 or {}).get('channel')
    if not ch: die(f'{a.id} has no pipeline.json: pass --channel trada|goat')
    channel(ch)
    files = sorted(set(glob.glob(f'{ROOT}/episodes/{a.id}.*') + glob.glob(f'{ROOT}/episodes/{a.id}_*')))
    if not files: die(f'nothing to copy: no episodes/{a.id}.* files', 1)
    taken = glob.glob(f'{ROOT}/episodes/{a.new_id}.*') + glob.glob(f'{ROOT}/episodes/{a.new_id}_*') + [p for p in (new.state_path, f'{ROOT}/voice/{a.new_id}') if os.path.exists(p)]
    if taken: die(f'refused: {a.new_id} already exists: {", ".join(rel(x) for x in taken[:4])}', 1)
    pat = re.compile(r'(?<![A-Za-z0-9])(?<!voice/)' + re.escape(a.id) + r'(?![A-Za-z0-9])'); L = []
    for f in files:
        name = os.path.basename(f); nn = a.new_id + name[len(a.id):]; dst = f'{ROOT}/episodes/{nn}'
        if f.endswith(('.js', '.json', '.cjs')):
            txt = open(f, encoding='utf-8').read(); out, n = pat.subn(a.new_id, txt); open(dst, 'w', encoding='utf-8').write(out); L.append(f'  {nn}: {n} id reference(s) rewritten')
        else: shutil.copyfile(f, dst); L.append(f'  {nn}: copied as is')
    # voice takes: the library index is keyed by speaker|text, so identical lines already find their takes; takes that exist only as voice/<src>/<beat>.* are copied to voice/<new>/
    beats, _ = read_json(new.beats); copied = 0; known = 0; missing = 0
    if isinstance(beats, dict):
        own = json.load(open(f'{ROOT}/voice/index.json', encoding='utf-8')) if os.path.exists(f'{ROOT}/voice/index.json') else {}
        lib = json.load(open(f'{HOME}/tdvai/vo/lib/index.json', encoding='utf-8')) if os.path.exists(f'{HOME}/tdvai/vo/lib/index.json') else {}
        for b in beats.get('beats', []):
            if 'text' not in b: continue
            k = tkey(b.get('spk', b['who'].upper()), b['text'])
            if (k in own and os.path.exists(f'{ROOT}/{own[k]}')) or k in lib: known += 1; continue
            hit = next((f'{ROOT}/voice/{a.id}/{b["id"]}.{x}' for x in ('wav', 'mp3', 'flac') if os.path.exists(f'{ROOT}/voice/{a.id}/{b["id"]}.{x}')), None)
            if hit: os.makedirs(f'{ROOT}/voice/{a.new_id}', exist_ok=True); shutil.copyfile(hit, f'{ROOT}/voice/{a.new_id}/{os.path.basename(hit)}'); copied += 1
            else: missing += 1
    print(f'copied {a.id} -> {a.new_id} (channel {ch}); the source is untouched:\n' + '\n'.join(L) + f'\nvoice: {known} lines already found in the take index, {copied} takes copied to voice/{a.new_id}/, {missing} lines without any take (`voice.py need` lists them)')
    if os.path.exists(new.state_path): return
    ns = new_state(a.new_id, ch)
    if s0 and 'rules' in s0 and ch != 'goat': ns['rules'] = s0['rules']
    elif ch == 'trada' and isinstance(beats, dict) and beats.get('rules'): ns['rules'] = beats['rules']
    if s0 and s0.get('workflow'): ns['workflow'] = s0['workflow']
    save_state(ns); cmd_status(argparse.Namespace(id=a.new_id, run=False, json=False))

def flush(st):
    if st['id'] in DIRTY: save_state(st); DIRTY.discard(st['id'])
def cmd_status(a):
    st = load_state(a.id); ev = evaluate(st, run=a.run); flush(st)
    if a.json:
        s, r = current(ev); print(json.dumps(dict(id=st['id'], channel=st['channel'], steps=[dict(n=num(st, x), step=x, **(y.d() if y else dict(state='NOT_EVALUATED'))) for x, y in ev], next=s, forced=forced_history(st)), ensure_ascii=False, indent=1))
    else: print(fmt_status(st, ev))
def cmd_next(a):
    st = load_state(a.id); e = Ep(a.id); ev = evaluate(st); flush(st); s, r = current(ev)
    if not s:
        print('ALL DONE' if all(x is not None and x.done() for _, x in ev) else 'nothing to do'); return
    m = meta(st['channel'], s); g = guide(st, e, s, r)
    if a.json:
        print(json.dumps(dict(step=s, number=num(st, s), state=r.state, reason=r.reason, who=m.get('who'), agent=m.get('agent'), model=m.get('model'), effort=m.get('effort'), what=g['what'], commands=g['cmds'], proof=g['proof'],
                              briefs=[dict(name=n, path=brief_file(st['channel'], n)) for n in g['briefs'] if n]), ensure_ascii=False, indent=1)); return
    who = m.get('who', '?') + (f'  [agent: {m["agent"]}]' if m.get('agent') else '') + (f'  model {m["model"]}, effort {m["effort"]}' if m.get('model') else '  (main session, no sub-agent)')
    L = [f'NEXT: step {num(st, s)} {s}   state {r.state}: {r.reason}', f'Who:    {who}', f'What:   {g["what"]}']
    L += ['Run:    ' + (g['cmds'][0] if g['cmds'] else '-')] + [f'        {x}' for x in g['cmds'][1:]]
    L.append('Proof:  ' + '; '.join(g['proof']))
    for n in g['briefs']:
        p = brief_file(st['channel'], n)
        L.append(f'Brief:  {rel(p)}  (print filled: pipeline.py brief {a.id} {os.path.basename(p)[:-3]})' if p else f'Brief:  none yet (expected pipeline/briefs/{n}-{st["channel"]}.md or {n}.md)')
    L.append(f'Rules:  {channel(st["channel"])["house_rules"]}\nState:  {channel(st["channel"])["state_file"]}')
    print('\n'.join(L))

def owner_fixed_text(card):
    of = card.get('owner_fixed') if isinstance(card, dict) else None
    items = [x.strip() for x in of if isinstance(x, str) and x.strip()] if isinstance(of, list) else []
    return 'OWNER-FIXED, not open: ' + '; '.join(items) if items else ''   # nothing at all when the card has none

def cmd_brief(a):
    st = load_state(a.id); ch = st['channel']; c = channel(ch); e = Ep(a.id); name = a.template[:-3] if a.template.endswith('.md') else a.template
    p = f'{ROOT}/pipeline/briefs/{name}.md'
    if not os.path.exists(p):
        have = sorted(f[:-3] for f in os.listdir(f'{ROOT}/pipeline/briefs') if f.endswith('.md')) if os.path.isdir(f'{ROOT}/pipeline/briefs') else []
        die(f'template {name!r} does not exist in {rel(f"{ROOT}/pipeline/briefs")}. Existing: {", ".join(have) or "(none yet)"}', 1)
    card, _ = read_json(e.card) if os.path.exists(e.card) else (None, None)
    sd = card.get('script_doc') if isinstance(card, dict) and card.get('script_doc') else '(no script_doc in the card)'
    vals = dict(id=a.id, channel=ch, channel_name=c['name'], root=ROOT, card=e.card, treatment=e.treatment, beats=e.beats, episode=e.episode, out=e.out,
                mp4=render_mp4(st) or e.mp4_default, script_doc=sd, owner_fixed=owner_fixed_text(card), house_rules=ex(c['house_rules']), state_file=ex(c['state_file']))
    unknown = []
    def sub(m):
        k = m.group(1)
        if k in vals: return str(vals[k])
        if k not in unknown: unknown.append(k)
        return m.group(0)
    tpl = open(p, encoding='utf-8').read()
    if not vals['owner_fixed']: tpl = re.sub(r'^[ \t]*\{owner_fixed\}[ \t]*\n', '', tpl, flags=re.M)   # a line holding only {owner_fixed} disappears with it
    print(re.sub(r'\{([A-Za-z_][A-Za-z0-9_]*)\}', sub, tpl), end='')
    if unknown: print(f'unknown placeholders left as they are: {", ".join("{" + u + "}" for u in unknown)}', file=sys.stderr)

def cmd_record(a):
    st = load_state(a.id); e = Ep(a.id); ch = st['channel']; step = a.step
    if step not in RECORDABLE: die(f'step {step!r} cannot be recorded; recordable: {", ".join(RECORDABLE)}')
    w = a.verdict.strip().upper().replace('NO-GO', 'NOGO'); v = w
    if w in POS_WORDS: v = ALLOWED[step][0]
    elif w in NEG_WORDS:
        if step in ('render', 'posted'): die(f'{step} has no negative verdict: do not record it (the step stays TODO until a good mp4 / id is recorded)')
        v = ALLOWED[step][1]
    if v not in ALLOWED[step]: die(f'verdict {a.verdict!r} not allowed for {step}; use pass/ok/done/go (stored as {ALLOWED[step][0]}) or fail/fix/no (stored as {ALLOWED[step][-1] if len(ALLOWED[step]) > 1 else "none"}), any case')
    if not a.by or not a.by.strip(): die(f'--by <who> is required (every verdict names who gave it)')
    if step == 'owner' and not (a.quote and a.quote.strip()): die('owner needs --quote "<the owner\'s own words>" (never record the owner\'s OK without his words)')
    if step == 'animatic_owner' and step not in steps_of(st): die('animatic_owner is not a step in this episode\'s workflow (only Claude rules-2 uses animatic_owner; Gemini workflow uses credit_owner)')
    if step == 'animatic_owner' and not (a.quote and a.quote.strip()): die('animatic_owner needs --quote "<the owner\'s own words>" (never record the owner\'s OK without his words)')
    if step == 'credit_owner' and step not in steps_of(st): die('credit_owner exists only for `--workflow gemini` episodes; Claude rules-2 uses animatic_owner')
    if step == 'credit_owner' and not (a.quote and a.quote.strip()): die('credit_owner needs --quote "<the owner\'s own words>" (never record the owner\'s OK without his words)')
    if step == 'facts' and ch != 'goat': die('facts verdicts exist only for the goat channel')
    if step == 'posted' and not (a.platform and a.video_id): die('posted needs --platform <name> and --video-id <id>')
    if a.force is not None and not a.force.strip(): die('--force needs a reason')
    target = 'script_gate' if step == 'facts' else step; idx = steps_of(st).index(target)
    ev = evaluate(st, run=False, upto=idx); blocked = None
    for s, r in ev:
        if r is None or not r.done(): blocked = (s, r); break
    forced_note = None
    if blocked:
        s, r = blocked
        if a.force is None:
            lint_old = s == 'script' and r and r.state == 'TODO' and 'inputs changed' in r.reason
            reason = f'inputs changed since the last lint: run `pipeline.py status {a.id} --run`, then record again' if lint_old else (r.reason if r else '')
            out = f'REFUSED: cannot record {step}: earlier step {num(st, s)} {s} is {r.state if r else "not evaluated"}' + (f': {reason}' if r else '') + (f'\n  fix: {r.repro}' if r and r.repro and not lint_old else '') + '\n  (override only with --force "<reason>"; it is stored and shown forever)'
            print(out); sys.exit(1)
        forced_note = f'{s} {r.state if r else "?"}'
    # step-specific preconditions
    rec = dict(verdict=v, by=a.by.strip(), at=now_iso())
    if a.note: rec['note'] = a.note
    if a.quote: rec['quote'] = a.quote.strip()
    if step in ('script_gate', 'facts'):
        if not os.path.exists(e.beats): die(f'cannot record: {rel(e.beats)} does not exist', 1)
        rec['hash'] = sha(e.beats); rec['jhash'] = judged_hash(e.beats); rec['jv'] = JV
        if not rec['jhash']: die(f'cannot record: {rel(e.beats)} is not a beats file (JSON with a "beats" list)', 1)
    elif step == 'animatic_owner':
        rec['hash'] = rules2.animatic_hash(e.id)
        if not rec['hash']: die(f'REFUSED: no silent animatic to approve (out/{e.id}/animatic.mp4, animatic_sheet.jpg or animatic/*.jpg)', 1)
        rec['jhash'] = judged_hash(e.beats); rec['jv'] = JV
    elif step == 'credit_owner':
        if not os.path.exists(e.beats): die(f'cannot record: {rel(e.beats)} does not exist', 1)
        rec['hash'] = sha(e.beats); rec['jhash'] = judged_hash(e.beats); rec['jv'] = JV
        if not rec['jhash']: die(f'cannot record: {rel(e.beats)} is not a beats file (JSON with a "beats" list)', 1)
    elif step == 'driver_review':
        cs, _ = sheets(e); is_gem = st.get('workflow') == 'gemini'; proxy = review_proxy(e) if is_gem else None
        if not cs and not proxy and a.force is None:
            if is_gem: die(f'REFUSED: no review proof in {rel(e.out)} (neither review_proxy.mp4 nor cs*.jpg). Make it: python3 tools/build_check.py {rel(e.episode)} --final', 1)
            die(f'REFUSED: no contact sheets in {rel(e.out)}/cs*.jpg. Make them: python3 tools/sheets.py {rel(e.episode)}', 1)
        if not os.path.exists(e.episode): die(f'cannot record: {rel(e.episode)} does not exist', 1)
        rec['hash'] = sha(e.episode)
    elif step == 'render':
        if not a.mp4: die('render needs --mp4 <path to the final mp4>')
        mp4 = os.path.abspath(os.path.expanduser(a.mp4))
        if not os.path.exists(mp4): die(f'REFUSED: {mp4} does not exist', 1)
        rec.update(mp4=mp4, hash=sha(mp4), episode_hash=sha(e.episode))
    elif step in ('episode_gate', 'owner', 'posted'):
        mp4 = render_mp4(st)
        if a.mp4:
            given = os.path.abspath(os.path.expanduser(a.mp4))
            if mp4 and given != mp4 and a.force is None: die(f'REFUSED: --mp4 {given} differs from the recorded render {mp4}', 1)
            mp4 = mp4 or given
        if not mp4 or not os.path.exists(mp4): die(f'REFUSED: no existing final mp4 to judge (record render first, or pass --mp4)', 1)
        rec.update(hash=sha(mp4), mp4=mp4)
    if a.force is not None: rec['forced'] = a.force.strip(); rec['blocked_by'] = forced_note
    if step == 'posted':
        p = dict(platform=a.platform.strip().lower(), video_id=a.video_id.strip(), at=a.at or now_iso(), by=rec['by'], hash=rec['hash'])
        if a.at:
            try: parse_ts(a.at)
            except ValueError: die(f'--at {a.at!r} is not an ISO time')
        if any(x['platform'] == p['platform'] and x['video_id'] == p['video_id'] for x in st['posted']): print(f'already recorded: {p["platform"]}:{p["video_id"]}'); return
        st['posted'].append(p)
        c = channel(ch)
        if p['platform'] in c.get('paused_platforms', {}): print(f'WARNING: {p["platform"]} is paused for {ch}: {c["paused_platforms"][p["platform"]]}')
        elif p['platform'] not in c['platforms']: print(f'WARNING: {p["platform"]} is not in the platform list of {ch} ({", ".join(c["platforms"])})')
    st['records'][step] = rec; st['log'].append(dict(step=step, **rec, **({'platform': a.platform, 'video_id': a.video_id} if step == 'posted' else {})))
    save_state(st)
    if DIRTY: DIRTY.clear()
    print(f'recorded {step} {v}' + (f' (you wrote "{a.verdict}"; stored as {v})' if a.verdict != v else '') + f' by {rec["by"]} (hash {short_hash(rec.get("jhash") or rec.get("hash"))}' + (', judged text only' if rec.get('jhash') else '') + ')' + (f'  FORCED: {a.force} (earlier step open: {forced_note})' if a.force is not None else ''))

def cmd_can_post(a):
    st = load_state(a.id); ev = evaluate(st, run=False, upto=steps_of(st).index('owner') + 1)
    for s, r in ev:
        if r is None or not r.done():
            msg = f'BLOCKED at step {num(st, s)} {s}: ' + (f'{r.state}: {r.reason}' if r else 'not evaluated')
            if r and r.repro: msg += f'\n  fix: {r.repro}'
            if a.json: print(json.dumps(dict(can_post=False, blocked_step=s, state=r.state if r else None, reason=r.reason if r else None), ensure_ascii=False))
            else: print(msg)
            sys.exit(1)
    fl = [f for f in forced_list(st) if f['step'] in ('script_gate', 'facts', 'animatic_owner', 'credit_owner', 'driver_review', 'render', 'episode_gate', 'owner')]
    if fl and not a.allow_forced:
        msg = f'BLOCKED: steps 1-{num(st, "owner")} are done but ' + '; '.join(f'{f["step"]} was FORCED ({f["reason"]})' for f in fl) + '. Only the owner may accept this: can-post --allow-forced'
        print(json.dumps(dict(can_post=False, forced=fl), ensure_ascii=False) if a.json else msg); sys.exit(1)
    print(json.dumps(dict(can_post=True, forced=fl), ensure_ascii=False) if a.json else 'CAN POST' + (f' (with FORCED: {", ".join(f["step"] for f in fl)})' if fl else '') + f'  mp4: {render_mp4(st)}')

def cmd_list(a):
    import glob
    rows = []; ns = []
    for p in sorted(glob.glob(f'{ROOT}/out/*/pipeline.json')):
        try: st = json.load(open(p, encoding='utf-8'))
        except Exception: continue
        if a.channel and st['channel'] != a.channel: continue
        ev = evaluate(st); s, r = current(ev); e = Ep(st['id']); c, _ = read_json(e.card) if os.path.exists(e.card) else (None, None)
        flags = ([f'FORCED({",".join(sorted({f["step"] for f in forced_history(st)}))})'] if forced_history(st) else []) + (['STALE'] if r and r.state == 'STALE' else [])
        ns.append(num(st, s) if s else len(steps_of(st)))
        rows.append(dict(id=st['id'], channel=st['channel'], title=(c or {}).get('title', '') if isinstance(c, dict) else '', step=s, state=r.state if r else 'DONE', flags=flags))
    if a.json: print(json.dumps(rows, ensure_ascii=False, indent=1)); return
    if not rows: print('no episode has a pipeline.json yet'); return
    for x, nn in zip(rows, ns): print(f'{x["id"]:12s} {x["channel"]:6s} {(x["title"] or "(no card)")[:38]:38s} {nn:2d} {x["step"] or "all done":14s} {x["state"]:7s} {" ".join(x["flags"])}')


USAGE = '''pipeline.py: where is this episode, what is next, who does it, which gate cannot be skipped. Run from ~/cine3d. `pipeline.py <command> --help` for options.
  new <id> --channel trada|goat [--workflow claude|gemini]  write the missing card skeleton + pipeline.json (never overwrites)   e.g. new ngay14 --channel trada --workflow gemini
  adopt <id> --channel X               give an episode already on disk a pipeline.json (nothing forced)    e.g. adopt ngay12 --channel trada
  copy <src-id> <new-id> [--channel X] copy card, treatment, beats, episode + side files under a new id    e.g. copy ngay12 ngay12v5
  status <id> [--run] [--json]         one line per step + NEXT; --run re-runs the current machine check    e.g. status ngay12 --run
  next <id> [--json]                   the next step: who, model, effort, commands, proof, brief            e.g. next ngay12
  brief <id> <template>                print a brief template with the episode's paths filled in           e.g. brief ngay12 build
  record <id> <step> <verdict> --by W  record a verdict (steps: script_gate facts animatic_owner credit_owner driver_review render episode_gate owner posted)
                                       e.g. record ngay12 script_gate PASS --by tdvai-script-reviewer --note "10/10"
  can-post <id> [--allow-forced]       exit 0 + CAN POST only when every step up to owner is done (1-11, or 1-15 with rules 2), nothing stale   e.g. can-post ngay12
  list [--channel X] [--json]          every episode with a pipeline.json, current step, forced/stale      e.g. list --channel goat
  mix                                  Trà đá: share of the three pillars over the rules-2 cards against 40/35/25         e.g. mix
Rules 2 (23/11, Trà đá only, the default for `new --channel trada`): steps `build` (the whole picture, silent, estimated times), `animatic` (that build rendered without the voice) and `animatic_owner` sit between script_gate and voice, `retime` (real times + lips) after audio; voice.py refuses to call ElevenLabs until the owner approved the silent animatic. Docs: ENGINE.md, section 23/11.
Exit codes: 0 ok/allowed, 1 not allowed/failed, 2 usage error. Manual: docs/v4-pipeline.md'''


def main():
    if len(sys.argv) == 1: print(USAGE); sys.exit(2)
    if sys.argv[1] in ('-h', '--help', 'help'): print(USAGE); sys.exit(0)
    P = argparse.ArgumentParser(prog='pipeline.py', description=__doc__.split('\n')[0]); S = P.add_subparsers(dest='cmd', required=True)
    p = S.add_parser('copy'); p.add_argument('id'); p.add_argument('new_id'); p.add_argument('--channel', choices=['trada', 'goat']); p.set_defaults(f=cmd_copy)
    p = S.add_parser('new'); p.add_argument('id'); p.add_argument('--channel', required=True, choices=['trada', 'goat']); p.add_argument('--workflow', choices=['claude', 'gemini'], default='claude'); p.set_defaults(f=cmd_new)
    p = S.add_parser('adopt'); p.add_argument('id'); p.add_argument('--channel', required=True, choices=['trada', 'goat']); p.add_argument('--workflow', choices=['claude', 'gemini'], default='claude'); p.set_defaults(f=cmd_adopt)
    p = S.add_parser('status'); p.add_argument('id'); p.add_argument('--run', action='store_true'); p.add_argument('--json', action='store_true'); p.set_defaults(f=cmd_status)
    p = S.add_parser('next'); p.add_argument('id'); p.add_argument('--json', action='store_true'); p.set_defaults(f=cmd_next)
    p = S.add_parser('brief'); p.add_argument('id'); p.add_argument('template'); p.set_defaults(f=cmd_brief)
    p = S.add_parser('record'); p.add_argument('id'); p.add_argument('step'); p.add_argument('verdict')
    for o in ('--by', '--note', '--quote', '--mp4', '--platform', '--video-id', '--at', '--force'): p.add_argument(o)
    p.set_defaults(f=cmd_record)
    p = S.add_parser('can-post'); p.add_argument('id'); p.add_argument('--allow-forced', action='store_true'); p.add_argument('--json', action='store_true'); p.set_defaults(f=cmd_can_post)
    p = S.add_parser('list'); p.add_argument('--channel', choices=['trada', 'goat']); p.add_argument('--json', action='store_true'); p.set_defaults(f=cmd_list)
    p = S.add_parser('mix'); p.set_defaults(f=cmd_mix)
    a = P.parse_args()
    if hasattr(a, 'id'): valid_id(a.id)
    a.f(a)

if __name__ == '__main__':
    main()
