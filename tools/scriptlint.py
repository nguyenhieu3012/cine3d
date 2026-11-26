#!/usr/bin/env python3
"""cine3d script lint: the mechanical half of the script gate, checked by machine so no agent spends tokens on counting.
  python tools/scriptlint.py episodes/<id>.beats.json [--strict]      (--help or no arguments prints this)
Exit 0 = LINT PASS, 1 = LINT FAIL. Timing comes from out/<id>/audio/times.json (or episodes/<id>.times.js) once `voice.py build` has run; before that it is ESTIMATED from the text and
the output says so: 'TIMING ESTIMATED from text (no times file yet): re-run after voice.py build'. Estimate per beat: gap (default 0.22 s) + 0.79 s + 0.21 s per Vietnamese syllable (English: 0.64 s + 0.29 s per word), divided by `tempo`,
a pause lasts `pause` s; fitted on 449 recorded lines of 14 built episodes (a line start in the first 15 s is off by about 1 s on average). Rate checks (fast/slow) need the real voice and run only with a times file.
CHECKS (old): distinct numbers spoken (max 5), Bip sentence length (max 6 syllables, warning), speech rate and tempo per line, silences > 1 s need an sfx, duck windows run forwards, speech share, first line by 0.3 s, tail <= 2 s.
CHECKS (new, 14/11): tension curve, mood, land, cliff_4_10, meta, see below. A rule that cannot run prints SKIPPED with its reason; under --strict every SKIPPED rule is a failure.
PER-BEAT FIELDS (all optional; a file without them lints as before with one WARN):
  tension  0-10 on EVERY beat, pauses included (the dip before a peak is often a pause).
  mood     joy|fear|anger|sad|tender|flat|smug|shock on every SPOKEN beat; a pause (a beat with no speaker) needs a tension but NO mood.
  land     set ONLY on beats where something lands for the viewer, never on every beat (a WARN fires when more than 80 % of beats carry it: the tag was sprayed). Values:
             laugh   a line or gag meant to get a laugh      reveal  new information that changes how the viewer reads the situation
             gag     a wordless visual or prop joke          turn    the story changes direction or the power swaps
  allowJokeAfter: true  waives 'no joy/smug right after a tender/sad peak' on purpose.   (audio fields silence, impact, marginWaive, foley: see docs/v4-sound-and-tension.md)
HEADER (ONE object "meta" in the file header, not per beat): person, sum, opener, sincere_beat, withheld_opener, thread. Missing keys warn; --strict FAILS when meta is missing.
TENSION RULES: range >= 5; peak_on_speech (the highest tension must sit on a silent beat, warning, failure under --strict); impact_before_peak (no `impact` on the beat right before the top beat, same); no 3 equal levels in a row; the top sits in the last 40 % of the time; every value >= 8 has a value >= 3 lower in the 3 beats before; the first 3 s reach >= 5; no joy/smug in the next 3 tagged beats after a tender/sad beat at >= 7.
LAND RULES (run when any beat has land, always under --strict; a land counts from its beat start): land_8s = no 8 s window without one; cliff_4_10 = the first land starts by 6.0 s, between 3 and 10 s at least one land and no stretch over 4 s without one (prints the first land time).
RULES 2 (pack trada only, see rules2.py; goat and old episodes unchanged), 23/11/2026 Blueprint v2.0: length 42-52 s (target 42-48; 52 by the owner 23/11 evening), hook <= 5 words, first line <= 6 words, first land < 5.5 s (only if a beat has land), on-screen message <= 8 words, double ending 4-5 s, tail after the last line <= 0.8 s (header waive {check:'tail', reason} makes it a WARN), twist at 45-68 %, speech <= 4.2 syll/s, <= 1 number per line, 4 summary lines at the top of the script doc (WARN when the doc is missing). The follow bar is optional.
FLAGS: --strict  missing curve, missing meta, any SKIPPED rule and land rules without land become failures.   --help  this text."""
import json, os, re, sys, unicodedata

VI_BASE, VI_PER, EN_BASE, EN_PER = 0.79, 0.21, 0.64, 0.29   # seconds per line + per syllable (Vietnamese) / word (English), fitted on the recorded lines of 14 built episodes
EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million']   # English number words (GOAT Beef); 'one' alone is not counted
NUM = set(EN + ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười', 'mươi', 'trăm', 'nghìn', 'ngàn', 'triệu', 'tỷ', 'lăm', 'tư', 'mốt', 'chục', 'rưỡi'])
WEAK = {'không', 'một', 'ba', 'năm', 'tư', 'mốt', 'lăm', 'one'}
DIGIT_RE = re.compile(r'^\d+(?:[.,]\d+)*$')

MODE_CFG = {
    'comedy':    dict(len_a=30.0, len_b=52.0, tail_max=0.8, first_land=5.5, tw_a=0.45, tw_b=0.68, end_a=4.0, end_b=5.0, req_end=True),
    'emotional': dict(len_a=42.0, len_b=62.0, tail_max=2.5, first_land=7.5, tw_a=0.45, tw_b=0.72, end_a=2.0, end_b=8.0, req_end=False),
    'wildcard':  dict(len_a=35.0, len_b=60.0, tail_max=1.5, first_land=6.0, tw_a=0.35, tw_b=0.75, end_a=2.5, end_b=7.0, req_end=False),
}


def estimate(beats, pre, tail):
    txt = ' '.join(b['text'] for b in beats if 'text' in b).lower()
    vi = bool(re.search('[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', txt))
    base, per = (VI_BASE, VI_PER) if vi else (EN_BASE, EN_PER)
    t = float(pre); lines = {}
    for b in beats:
        if 'pause' in b:
            lines[b['id']] = dict(t0=round(t, 3), t1=round(t + b['pause'], 3)); t += b['pause']; continue
        n = len(re.findall(r'[\wÀ-ỹ]+', b['text'])); t0 = t + b.get('gap', 0.22); t = t0 + (base + per * n) / (b.get('tempo') or 1)
        lines[b['id']] = dict(t0=round(t0, 3), t1=round(t, 3))
    return dict(dur=round(t + float(tail), 3), lines=lines)


def numbers(text):   # runs of Arabic digits and/or number words; a run made only of ambiguous VN/EN words ("không một lần", "năm nay") is not counted
    out, cur = [], []
    tokens = re.findall(r'\d+(?:[.,]\d+)*|[^\W\d_]+', str(text).lower()) + ['.']
    for x in tokens:
        if x in NUM or DIGIT_RE.match(x):
            cur.append(x)
        else:
            if cur and (any(DIGIT_RE.match(tok) for tok in cur) or not set(cur) <= WEAK):
                out.append(cur[0] if len(set(cur)) == 1 else ' '.join(cur))   # "eight eight eight" is the number eight said three times
            cur = []
    return out


def _norm(x):
    return ''.join(c for c in unicodedata.normalize('NFD', x.lower().replace('đ', 'd')) if unicodedata.category(c) != 'Mn')


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or any(a in ('--help', '-h') for a in argv):
        print(__doc__); sys.exit(0 if argv else 2)
    STRICT = '--strict' in argv
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import rules2
    _cr = rules2.cli_rules(['scriptlint.py'] + argv)
    # Strip flag values so positional ARGS only holds the beats path
    ARGS = []
    i = 0
    while i < len(argv):
        if argv[i] in ('--rules', '--mode') and i + 1 < len(argv):
            i += 2; continue
        if argv[i].startswith('--'):
            i += 1; continue
        ARGS.append(argv[i]); i += 1
    if not ARGS: print(__doc__); sys.exit(2)

    B = json.load(open(ARGS[0], encoding='utf-8'))
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tp = f"{ROOT}/out/{B['id']}/audio/times.json"; tj = f"{ROOT}/episodes/{B['id']}.times.js"
    T = json.load(open(tp, encoding='utf-8')) if os.path.exists(tp) else (json.loads(open(tj, encoding='utf-8').read().split('export default', 1)[1].strip().rstrip(';')) if os.path.exists(tj) else None)   # real times: voice.py writes both files
    if T and T.get('estimated'): T = None   # 23/11: episodes/<id>.times.js written by tools/animatic.py --times-only is an ESTIMATE (no voice yet), not a voice times file: lint on the estimate path as before
    EST = False
    SKIPPED = []
    st = rules2.read_state(B['id'])
    IS_GOAT = rules2.is_goat(B, st)
    V2 = rules2.rules_version(B, st, _cr) == 2   # Blueprint v2.0/v2.1, trada only (--rules N > header rules > pipeline.json rules > 1); goat and old episodes stay on 1
    def skip(name, why): SKIPPED.append(f'{name}: {why}')

    bs = B.get('beats') or []
    if not (T and all(b['id'] in T.get('lines', {}) for b in bs)):
        stale = T is not None; T = estimate(bs, B.get('pre', 0), B.get('tail', 1.8)); EST = True
        print('TIMING ESTIMATED from text (no times file yet): re-run after voice.py build' + (' [the times file did not cover every beat, so it was ignored]' if stale else ''))
    lines = [b for b in bs if 'text' in b]; fails, warns = [], []
    if not lines:
        fails.append('beats: no spoken lines found in beats array')
    seen = {}
    for b in lines:
        for n in numbers(b['text']): seen.setdefault(n, b['id'])
    if len(seen) > 5: fails.append(f"numbers: {len(seen)} different numbers are spoken (max 5): " + ', '.join(f'{k} ({v})' for k, v in seen.items()))

    total_syl, total_dur_sp = 0, 0.0
    for b in lines:
        syl = len(re.findall(r'[\wÀ-ỹ]+', b['text']))
        if b.get('who') == 'bip':
            for sent in re.split(r'[.?!…]+', b['text']):
                n = len(sent.split())
                if n > 6: warns.append(f"bip_long: {b['id']} \"{sent.strip()}\" has {n} syllables (Bíp: 1-6)")
        if b.get('tempo', 1) > 1.1: fails.append(f"tempo: {b['id']} is sped up x{b['tempo']} (max 1.1)")
        if T and not EST:
            d = T['lines'][b['id']]['t1'] - T['lines'][b['id']]['t0']; r = syl / max(d, 0.1)
            total_syl += syl; total_dur_sp += max(d, 0.05)
            if r > 5.2: warns.append(f"fast: {b['id']} is {r:.1f} syllables a second")
            if V2:
                if syl >= 7 and r > 4.65:
                    fails.append(f"v2_speech_rate: {b['id']} is {r:.1f} syll/s ({syl} in {d:.2f} s; rules 2: <= 4.6 for >=7-syllable lines)")
                elif syl < 7 and r > 5.5:
                    warns.append(f"v2_speech_rate_short: {b['id']} short punchline is {r:.1f} syll/s ({syl} in {d:.2f} s)")
            if r < 2.0 and syl > 3: warns.append(f"slow: {b['id']} is {r:.1f} syllables a second ({d:.2f} s for {syl})")
    if V2 and T and not EST and total_dur_sp > 0:
        avg_rate = total_syl / total_dur_sp
        if avg_rate > 4.25:
            fails.append(f"v2_speech_rate_avg: episode average speech rate is {avg_rate:.2f} syll/s ({total_syl} in {total_dur_sp:.1f} s; rules 2: <= 4.2)")

    def when(ref):
        if isinstance(ref, (int, float)): return float(ref)
        i, _, e = str(ref).partition('.')
        if i not in T['lines']:
            fails.append(f"ref: unknown beat id {i!r} in reference {ref!r}")
            return 0.0
        return T['lines'][i]['t1' if e == 'end' else 't0']

    if T:
        fx = [when(x['ref']) + x.get('off', 0) for x in B.get('sfx', [])]
        for b in bs:
            if 'pause' in b and b['pause'] > 1.0:
                p0, p1 = T['lines'][b['id']]['t0'], T['lines'][b['id']]['t1']
                if not any(p0 - 0.3 <= t <= p1 for t in fx): fails.append(f"silence: {b['id']} is {b['pause']} s with no sound effect in it (max 1 s of nothing)")
        for d in B.get('duck', []):   # a duck is a stretch of music held down: it must run forwards ('p6' = the start of p6, 'p6.end' = its end)
            a0, a1 = when(d['from']) + d.get('off0', 0), when(d['to']) + d.get('off1', 0)
            if a1 <= a0: fails.append(f"duck: {d['from']} -> {d['to']} runs backwards ({a0:.2f} -> {a1:.2f}); use '<beat>.end' for the end of a beat")
    if T and lines:
        sp = sum(T['lines'][b['id']]['t1'] - T['lines'][b['id']]['t0'] for b in lines); share = sp / max(T['dur'], 0.01)
        print(f"length {T['dur']:.1f} s, speech {share * 100:.0f} % of it, {len(lines)} lines, first line at {T['lines'][lines[0]['id']]['t0']:.2f} s")
        if share > 0.78: warns.append(f"dense: speech fills {share * 100:.0f} % (want 60-75)")
        if T['lines'][lines[0]['id']]['t0'] > 0.3: fails.append('first line starts later than 0.3 s')
        if not V2 and T['dur'] - T['lines'][lines[-1]['id']]['t1'] > 2.05:   # v2: replaced by mode-aware tail check below
            _tw = [w for w in (B.get('waive') or []) if isinstance(w, dict) and w.get('check') == 'tail' and str(w.get('reason', '')).strip()]
            if _tw: warns.append(f"tail longer than 2 s WAIVED: {_tw[0]['reason']}")   # header waive {check:'tail', reason} (driver 22/11, final-episode end cards)
            else: fails.append('tail longer than 2 s')

    # ---------------- GOAT channel checks (v2.1 unified runtimes & <= 1 number/line) ----------------
    if IS_GOAT:
        for b in lines:
            _n = numbers(b['text'])
            if len(_n) > 1:
                fails.append(f"goat_numbers_line: {b['id']} says {len(_n)} numbers in one line ({', '.join(_n)}); GOAT max 1 per line")
        _card_kind = None
        try:
            _card_kind = (json.load(open(f"{ROOT}/episodes/{B['id']}.card.json", encoding='utf-8')).get('kind') or '').strip().lower()
        except Exception:
            pass
        if T:
            if _card_kind == 'quickie' and T['dur'] > 24.0:
                warns.append(f"goat_length: Quickie runs {T['dur']:.1f} s (target 15-22 s, max 24 s)")
            elif T['dur'] > 45.0:
                warns.append(f"goat_length: Full Beef runs {T['dur']:.1f} s (target 28-42 s, max 45 s; trim fat)")

    # ---------------- tension curve, mood and landings (all optional in the file; thresholds here) ----------------
    MOODS = {'joy', 'fear', 'anger', 'sad', 'tender', 'flat', 'smug', 'shock'}; LANDS = {'laugh', 'reveal', 'gag', 'turn'}
    RANGE_MIN, SAME_RUN, TOP_FROM, PEAK_AT, DIP_BY, DIP_WITHIN, HOOK_S, HOOK_MIN = 5, 3, 0.6, 8, 3, 3, 3.0, 5
    EMO_PEAK, JOKE_WINDOW, LAND_EVERY = 7, 3, 8.0
    CLIFF_FIRST, CLIFF_A, CLIFF_B, CLIFF_GAP = 6.0, 3.0, 10.0, 4.0
    ids = [b['id'] for b in bs]; tens = [b.get('tension') for b in bs]; has_curve = any('tension' in b or 'mood' in b for b in bs); has_land = any('land' in b for b in bs)
    NOTES = []
    if EST: NOTES.append('speech_rate (fast/slow): not checked on the estimate, it needs the recorded voice (a times file)')
    isnum = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
    if not has_curve:
        warns.append(('WARN', 'no tension curve (add per-beat "tension" 0-10 and "mood"; --strict makes this a failure)')); skip('tension rules (range, same level, top, dip, hook, joke after peak)', 'no beat carries tension or mood')
    else:
        for b in bs:
            kind = 'a pause' if 'text' not in b else 'a spoken line'
            if not isnum(b.get('tension')) or not 0 <= b['tension'] <= 10: fails.append(f"tension: {b['id']} ({kind}) has no tension 0-10; EVERY beat needs one, pauses included, because the dip before a peak is often a pause")
            if 'text' in b and b.get('mood') not in MOODS: fails.append(f"mood: {b['id']} (a spoken line) has {'no mood' if 'mood' not in b else 'the unknown mood ' + repr(b['mood'])}; every spoken beat needs one of {', '.join(sorted(MOODS))} (only pauses may leave mood out)")
            if 'text' not in b and 'mood' in b and b['mood'] not in MOODS: fails.append(f"mood: {b['id']} (a pause) has the unknown mood {b['mood']!r}; leave it out or use one of {', '.join(sorted(MOODS))}")
    for b in bs:
        if 'land' in b and b['land'] not in LANDS: fails.append(f"land: {b['id']} has land \"{b['land']}\" (want {', '.join(sorted(LANDS))})")
        if 'meta' in b: warns.append(f"meta: {b['id']} carries meta; meta is ONE object in the file header, not per beat")
    nl = sum(1 for b in bs if 'land' in b)
    if has_land and bs and nl > 0.8 * len(bs): warns.append(f'land_sprayed: {nl} of {len(bs)} beats carry land ({nl * 100 // len(bs)} %); land belongs only on beats where something lands for the viewer, so the tag was probably sprayed')
    META_KEYS = ('person', 'sum', 'opener', 'sincere_beat', 'withheld_opener', 'thread'); M = B.get('meta')
    if M is None:
        if STRICT: fails.append('meta: the header has no "meta" object (person, sum, opener, sincere_beat, withheld_opener, thread); --strict needs it')
    elif not isinstance(M, dict): fails.append('meta: must be ONE object in the header')
    else:
        miss = [k for k in META_KEYS if k not in M]
        if miss: warns.append(f"meta: the header meta lacks {', '.join(miss)}")
    tl = [(T['lines'][b['id']]['t0'], T['lines'][b['id']]['t1']) for b in bs]
    okv = has_curve and bool(bs) and all(isnum(t) for t in tens)
    if has_curve and not okv: skip('tension rules', 'some beats have no numeric tension (fix those failures first)')
    if okv:
        v = tens
        if max(v) - min(v) < RANGE_MIN: fails.append(f'tension_flat: the curve only spans {min(v)}..{max(v)} (range >= {RANGE_MIN})')
        for i in range(len(v) - SAME_RUN + 1):
            if len(set(v[i:i + SAME_RUN])) == 1: fails.append(f'tension_same: {ids[i]}, {ids[i + 1]}, {ids[i + 2]} all sit at {v[i]} (no {SAME_RUN} beats at the same level)'); break
        for i, x in enumerate(v):
            if x >= PEAK_AT and not any(v[j] <= x - DIP_BY for j in range(max(0, i - DIP_WITHIN), i)): fails.append(f'tension_dip: {ids[i]} is {x} with no beat {DIP_BY}+ lower in the {DIP_WITHIN} before it (a dip prepares a peak)')
        for i, b in enumerate(bs):   # no joke after the emotional beat (driver may waive: allowJokeAfter on the peak or on the joke beat)
            if b.get('mood') in ('tender', 'sad') and v[i] >= EMO_PEAK:
                for j in [j for j in range(i + 1, len(bs)) if bs[j].get('mood')][:JOKE_WINDOW]:
                    if bs[j]['mood'] in ('joy', 'smug') and not (b.get('allowJokeAfter') or bs[j].get('allowJokeAfter')): fails.append(f"joke_after_peak: {ids[j]} is {bs[j]['mood']} right after {ids[i]} ({b['mood']}, tension {v[i]}); add allowJokeAfter: true to waive on purpose")
        D = T['dur']; top = max(v)
        if not any(v[i] == top and (tl[i][0] + tl[i][1]) / 2 >= TOP_FROM * D for i in range(len(v))): fails.append(f'tension_top: the highest value ({top}) is not in the last {round((1 - TOP_FROM) * 100)} % of the running time (after {TOP_FROM * D:.1f} s)')
        topi = [i for i in range(len(v)) if v[i] == top]; sil = [i for i in topi if 'text' not in bs[i]]
        if not sil:
            # Relaxed to WARN (even under --strict): dialogue punchlines are often the real emotional/comedy peak; audiogate handles loudness contrast separately
            warns.append(f"peak_on_speech: the highest tension ({top}) sits only on spoken beat(s) {', '.join(ids[i] for i in topi)}; consider placing a short silent reaction beat at the peak if you want music to swell loudest")
        pk = [(ids[i - 1], ids[i]) for i in topi if i > 0 and bs[i - 1].get('impact')]
        if pk: (fails if STRICT else warns).append('impact_before_peak: ' + '; '.join(f"{a_} carries impact ({bs[ids.index(a_)]['impact']!r}) right before the top beat {b_}" for a_, b_ in pk) + ': its accent makes the segment before the peak loud, so the peak no longer stands out; take the impact off ' + ', '.join(a_ for a_, _ in pk))
        hk = max([v[i] for i in range(len(v)) if tl[i][0] < HOOK_S] or [0])
        if hk < HOOK_MIN: fails.append(f'tension_hook: the first {HOOK_S:.0f} s only reach {hk} (want >= {HOOK_MIN}): the hook is not a warm-up')

    # ---------------- 4 Writers' Room craft-smell warnings (non-blocking) ----------------
    if len(lines) >= 6:
        gaps = [round(float(b.get('gap', 0.22)), 2) for b in lines[1:]]
        if gaps:
            most_common = max(gaps.count(g) for g in set(gaps))
            if most_common / len(gaps) > 0.80:
                warns.append(f"flat_gaps: {most_common}/{len(gaps)} spoken lines use the exact same gap ({max(set(gaps), key=gaps.count):.2f} s); vary pauses (0.08 s interrupt .. 0.65 s reaction beat) for comedic rhythm")
    if len(lines) >= 5:
        tagged = sum(1 for b in lines if isinstance(b.get('say'), str) and '[' in b['say'] and ']' in b['say'])
        if tagged / len(lines) < 0.25:
            warns.append(f"missing_say_tags: only {tagged}/{len(lines)} lines have ElevenLabs v4 [tags] in 'say'; add delivery cues ([deadpan], [sighs], [whispers], [panicking]...) to avoid flat TTS")
    if bs and not any(b.get('visual') or b.get('note') for b in bs):
        warns.append("no_visual_plan: no beat carries a 'visual' or 'note' action/gag cue; pair dialogue with physical comedy/camera beats")
    for b in lines:
        if b.get('land') == 'laugh' and ((isnum(b.get('tension')) and b['tension'] < 4) or len(b['text']) > 120):
            warns.append(f"setup_tagged_laugh: {b['id']} is tagged land='laugh' despite low tension or long text ({len(b['text'])} chars); verify it is a genuine punchline, not setup")

    mode_name = str(B.get('mode') or 'comedy').strip().lower()
    if '--mode' in argv:
        mi = argv.index('--mode')
        if mi + 1 < len(argv): mode_name = argv[mi + 1].strip().lower()
    if mode_name not in MODE_CFG:
        warns.append(f"mode: unknown mode {mode_name!r}, falling back to 'comedy' (valid: comedy, emotional, wildcard)")
        mode_name = 'comedy'
    MC = MODE_CFG[mode_name]

    if has_land or STRICT:
        D = T['dur']; pts = sorted(tl[i][0] for i, b in enumerate(bs) if b.get('land') in LANDS)
        q = [0.0] + pts + [D]; gaps = [(q[i], q[i + 1]) for i in range(len(q) - 1) if q[i + 1] - q[i] > LAND_EVERY]
        if gaps: fails.append(f"land_8s: nothing lands for more than {LAND_EVERY:.0f} s: " + ', '.join(f'{a:.1f}-{e:.1f} s' for a, e in gaps[:5]))
        cliff_first = MC['first_land'] if (V2 and mode_name != 'comedy') else CLIFF_FIRST
        first = pts[0] if pts else None; w = [p for p in pts if CLIFF_A <= p <= CLIFF_B]; q = [CLIFF_A] + w + [CLIFF_B]; wg = [(q[i], q[i + 1]) for i in range(len(q) - 1) if q[i + 1] - q[i] > CLIFF_GAP]
        print("cliff_4_10: first land at " + (f'{first:.2f} s' if first is not None else 'never') + (' (estimated)' if EST else '') + f"; lands between {CLIFF_A:.0f} and {CLIFF_B:.0f} s: {len(w)}")
        if first is None or first > cliff_first: fails.append(f"cliff_4_10: the first land starts at {('%.2f s' % first) if first is not None else 'never'} (must start by {cliff_first:.1f} s)" + (' [estimated time]' if EST else ''))
        if not w: fails.append(f'cliff_4_10: no land between {CLIFF_A:.0f} and {CLIFF_B:.0f} s')
        elif wg: fails.append(f"cliff_4_10: between {CLIFF_A:.0f} and {CLIFF_B:.0f} s a stretch of more than {CLIFF_GAP:.0f} s has no land: " + ', '.join(f'{a:.1f}-{e:.1f} s' for a, e in wg))
    else: skip('land_8s, cliff_4_10', 'no beat carries land (they run once a beat has land, and always under --strict)')
    if okv:   # the curve as one line: one character a second, ramp _ (0) .. @ (10)
        ramp = '_.,:-=+*#%@'; ch = lambda x: ramp[int(round(min(max(x, 0), 10) * (len(ramp) - 1) / 10))]
        D = T['dur']; ends = [t[1] for t in tl]; n = max(1, int(round(D))); line = ''.join(ch(tens[next((i for i, e in enumerate(ends) if e > (k + 0.5) * D / n), len(ends) - 1)]) for k in range(n)); print(f'curve |{line}| 0-10 over {D:.0f} s' + (' (estimated)' if EST else '') + f', peak {max(tens)}')

    if V2:   # ---------------- rules 2 (Master Blueprint v2.1, mode-aware) ----------------
        HOOK_MAX, FIRST_WARN, FIRST_FAIL, CARD_MAX = 5, 6, 8, 8
        TW_A, TW_B, END_A, END_B = MC['tw_a'], MC['tw_b'], MC['end_a'], MC['end_b']
        LEN_A, LEN_B, TAIL_MAX, FIRST_LAND = MC['len_a'], MC['len_b'], MC['tail_max'], MC['first_land']
        EPS = 0.05; D2 = T['dur']; tag = ' [estimated time]' if EST else ''; wds = lambda t: re.findall(r'[\wÀ-ỹ]+', str(t).lower())
        print(f'rules 2 (Blueprint v2.1, trada, mode={mode_name})' + (' via --rules' if _cr is not None else ''))
        hk = B.get('hook'); hk = hk.get('text') if isinstance(hk, dict) else hk
        if not LEN_A - EPS <= D2 <= LEN_B + EPS:
            _m = f"v2_length: the film runs {D2:.1f} s (mode {mode_name}: want {LEN_A:.0f}-{LEN_B:.0f} s){tag}"
            (warns if EST and LEN_A - 1.0 <= D2 <= LEN_B + 1.0 else fails).append(_m)
        else: print(f'v2_length: {D2:.1f} s (mode {mode_name}: want {LEN_A:.0f}-{LEN_B:.0f} s){tag}')
        _tl = D2 - T['lines'][lines[-1]['id']]['t1'] if lines else 0.0
        _tw2 = [w for w in (B.get('waive') or []) if isinstance(w, dict) and w.get('check') == 'tail' and str(w.get('reason', '')).strip()]
        if _tl > TAIL_MAX + EPS:
            if _tw2: warns.append(f"v2_tail WAIVED: {_tw2[0]['reason']} ({_tl:.2f} s after the last line)")
            else: fails.append(f"v2_tail: {_tl:.2f} s of nothing after the last line ({lines[-1]['id']}); mode {mode_name} wants <= {TAIL_MAX} s{tag}")
        _fl = sorted(T['lines'][b['id']]['t0'] for b in bs if b.get('land') in LANDS)
        if _fl:
            if _fl[0] > FIRST_LAND: fails.append(f'v2_first_land: the first laugh / counter-hit starts at {_fl[0]:.2f} s (mode {mode_name}: want <= {FIRST_LAND} s){tag}')
            else: print(f'v2_first_land: {_fl[0]:.2f} s (mode {mode_name}: want <= {FIRST_LAND} s){tag}')
        else: warns.append(f'v2_first_land: not measured: no beat carries land, so the first laugh <= {FIRST_LAND} s cannot be found')
        for b in lines:
            _n = numbers(b['text'])
            if len(_n) > 1: fails.append(f"v2_numbers_line: {b['id']} says {len(_n)} numbers in one line ({', '.join(_n)}); rules 2: at most 1 per line")
        _doc = None
        try: _doc = json.load(open(f"{ROOT}/episodes/{B['id']}.card.json", encoding='utf-8')).get('script_doc') or None
        except Exception: pass
        _dp = None
        if _doc:
            _c = re.sub(r'\s*\(.*$', '', os.path.expanduser(_doc.strip()))
            for _q in (os.path.expanduser(_doc.strip()), _c, os.path.join(os.path.expanduser('~/vault'), _c)):
                if os.path.isfile(_q): _dp = _q; break
        if not _dp: warns.append('v2_summary_lines: not measured: the card has no readable script_doc, so the 4 summary lines at the top of the script doc are not checked')
        elif 'blueprint' in _norm(os.path.basename(_dp)): warns.append(f'v2_summary_lines: not measured: script_doc {os.path.basename(_dp)} is the Blueprint itself, not a script of its own')
        else:
            _tx = open(_dp, encoding='utf-8').read().split('\n'); _i = 0
            if _tx and _tx[0].strip() == '---':
                _i = next((k for k in range(1, len(_tx)) if _tx[k].strip() == '---'), -1) + 1
            _head = _norm('\n'.join(_tx[_i:_i + 30]))
            for _nm, _pat in (('1 share reflex (who sends it to whom)', r'share|gui cho|gui tap|gui nguoi'), ('2 pre-emptive strike (<= 5.5 s)', r'don phu dau|5[,.]5|phu dau'), ('3 comedy hook', r'mieng hai|comedy hook|visual gag|running gag'), ('4 plant and payoff detail', r'gieo|gat\b|plant|payoff|pay-off')):
                if not re.search(_pat, _head): fails.append(f'v2_summary_lines: the top of {os.path.basename(_dp)} has no line for "{_nm}" (the 4 summary lines come first, Blueprint 4.1)')
        fl = wds(lines[0]['text']) if lines else []
        if len(fl) > FIRST_FAIL: fails.append(f"v2_first_line: {lines[0]['id']} \"{lines[0]['text']}\" has {len(fl)} words (max {FIRST_FAIL}, target <= {FIRST_WARN})")
        elif len(fl) > FIRST_WARN: warns.append(f"v2_first_line: {lines[0]['id']} \"{lines[0]['text']}\" has {len(fl)} words (target <= {FIRST_WARN}, fail > {FIRST_FAIL})")
        if isinstance(hk, str) and hk.strip():
            hw = wds(hk)
            if len(hw) > HOOK_MAX: fails.append(f'v2_hook_words: the hook text "{hk}" has {len(hw)} words (max {HOOK_MAX})')
            both = sorted(set(hw) & set(fl))
            if both: fails.append(f"v2_hook_shared: the hook text and the first spoken line ({lines[0]['id']}) share the word(s) {', '.join(both)} (they must share none: the line must not repeat the hook)")
        else: warns.append('v2_hook: not measured: the header has no "hook" (the hook text on screen); add "hook": "<= 5 words" to measure the word count and the overlap with the first line (qa.cjs also checks the hook overlay of the episode file)')
        cards = [(str(x.get('id') or x.get('ref') or '#'), x.get('text', '')) if isinstance(x, dict) else ('#', x) for x in (B.get('cards') or [])] + [(b['id'], b['card']) for b in bs if isinstance(b.get('card'), str)]
        for cid, ct in cards:
            if len(wds(ct)) > CARD_MAX:
                _clab = '' if cid == '#' else ' ' + cid
                fails.append(f'v2_card_words: message card{_clab} "{ct}" has {len(wds(ct))} words (max {CARD_MAX})')
        if not cards: warns.append('v2_cards: not measured: no message-card text in the beats (header "cards": [...] or a "card" on a beat); qa.cjs measures the cards of the episode file (<= 8 words, 1.8-2.2 s)')
        tw = B.get('twist') or (M.get('twist') if isinstance(M, dict) else None)
        if isinstance(tw, str):
            twb = next((b for b in bs if b['id'] == tw), None)
            if not twb: fails.append(f'v2_twist: header twist "{tw}" is not a beat id')
            else:
                pos = T['lines'][twb['id']]['t0'] / max(D2, 0.01)
                if not TW_A - 0.0005 <= pos <= TW_B + 0.0005: fails.append(f"v2_twist_pos: the twist ({twb['id']}) starts at {T['lines'][twb['id']]['t0']:.1f} s = {pos * 100:.0f} % of {D2:.1f} s (mode {mode_name}: want {TW_A * 100:.0f}-{TW_B * 100:.0f} %){tag}")
                else: print(f"v2_twist: {twb['id']} at {pos * 100:.0f} % of the running time (want {TW_A * 100:.0f}-{TW_B * 100:.0f} %){tag}")
        else:
            turns = [b for b in bs if b.get('land') == 'turn']
            if turns:
                in_win = [b for b in turns if TW_A - 0.0005 <= (T['lines'][b['id']]['t0'] / max(D2, 0.01)) <= TW_B + 0.0005]
                pick = in_win[0] if in_win else turns[0]
                pos = T['lines'][pick['id']]['t0'] / max(D2, 0.01)
                if not in_win:
                    fails.append(f"v2_twist_pos: no land='turn' beat falls in {TW_A * 100:.0f}-{TW_B * 100:.0f} % (checked {', '.join(b['id'] + '@' + str(round(T['lines'][b['id']]['t0'] / max(D2, 0.01) * 100)) + '%' for b in turns)}){tag}")
                else:
                    print(f"v2_twist: {pick['id']} at {pos * 100:.0f} % of the running time (want {TW_A * 100:.0f}-{TW_B * 100:.0f} %){tag}")
            else:
                warns.append(f'v2_twist: not measured: no beat has land "turn" and the header has no "twist": "<beat id>"; add one to check the {TW_A * 100:.0f}-{TW_B * 100:.0f} % position')
        po = B.get('payoff'); pob = next((b for b in bs if b['id'] == po), None) if isinstance(po, str) else None
        if isinstance(po, str) and not pob: fails.append(f'v2_payoff: header payoff "{po}" is not a beat id')
        if pob:
            after = D2 - T['lines'][pob['id']]['t1']
            if MC['req_end'] and not END_A - EPS <= after <= END_B + EPS:
                fails.append(f"v2_ending: {after:.2f} s after the pay-off ({pob['id']} ends at {T['lines'][pob['id']]['t1']:.1f} s); want {END_A:.0f}-{END_B:.0f} s (double ending: pay-off, then the kicker / follow nudge){tag}")
            else:
                print(f'v2_ending: {after:.2f} s after the pay-off (mode {mode_name}: target {END_A:.0f}-{END_B:.0f} s){tag}')
        elif lines:
            last = D2 - T['lines'][lines[-1]['id']]['t1']
            if MC['req_end']:
                warns.append(f"v2_payoff: not measured: no \"payoff\" (beat id) in the header, so the 4-5 s after the pay-off cannot be checked; the last spoken line ({lines[-1]['id']}) ends {last:.2f} s before the end{tag}")
        fb = B.get('follow')
        if isinstance(fb, (int, float)) and not isinstance(fb, bool) and pob and fb > D2 - T['lines'][pob['id']]['t1'] + EPS:
            fails.append(f"v2_follow: the follow bar ({fb} s) is longer than the time after the pay-off ({D2 - T['lines'][pob['id']]['t1']:.2f} s)")

    for x in SKIPPED:
        print('  SKIPPED ' + x)
        if STRICT: fails.append('skipped under --strict: ' + x)
    for x in NOTES: print('  note ' + x)
    print('LINT ' + ('PASS' if not fails else f'FAIL ({len(fails)})'))
    for f in fails: print('  FAIL ' + f)
    for w in warns: print('  ' + (w[0] + ' ' + w[1] if isinstance(w, tuple) else 'warn ' + w))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
