#!/usr/bin/env python3
"""cine3d SOUND GATE: nobody in the pipeline can hear, so the sound is measured and can FAIL.
  ~/tdvai/.venv/bin/python tools/audiogate.py episodes/<id>.beats.json [--strict]
Run after `tools/voice.py build`. Reads out/<id>/audio/{times.json, mix.wav} and the three STEMS voice.py writes at the gain of the real mix
(stem_voice.wav, stem_music.wav, stem_effects.wav). Without stems (an old build) it falls back to rebuilding the buses from vo_all / sfx / music with voice.py's
old ffmpeg graph at the one gain the real mix got, so voice-vs-bed is measured on what the listener gets. Prints one line per check, then AUDIO PASS or AUDIO FAIL (n),
and lists every check that was SKIPPED (a skipped check is never a pass); exit 1 on fail.
Also reads out/<id>/audio/{sfx_placed.json (every effect as placed: name, time, source), times.json impacts / tension} when voice.py wrote them.
Writes out/<id>/audio_report.md (a table per 2 s: tension, voice LUFS, bed LUFS, margin).
Optional beats-file fields it reads: beat "marginWaive": "<reason>" (check b waiver, listed as WAIVED and counted), beat "silence": true (intended silence), "impact": true (+ "impactOff" s after the beat start), beat "tension" (see scriptlint.py).
--strict: a missing tension curve is a failure instead of SKIPPED."""
import json, os, re, subprocess, sys, tempfile, shutil
import numpy as np
from scipy.signal import lfilter

# ---- thresholds (one reason each; change only on purpose) -------------------------------------------------------------
LUFS_MIN, LUFS_MAX = -15.0, -13.0   # a: platforms normalise to about -14; hotter gets turned down and squashed, quieter sounds weak next to other videos
TP_MAX = -1.0                       # a: true peak over -1 dBTP distorts after the platform's AAC re-encode
MARGIN_MIN = 6.0                    # b: voice at least 6 dB over the music+effects bed during every line, or the words are masked
SPEAKER_SPREAD = 1.5                # c: main speakers within 1.5 LU, or one character always sounds louder / more important
MAIN_SPEAKERS = 2                   # c: the N speakers with most speaking time are "main"; thinking / phone lines are excluded
SILENCE_FLOOR = -50.0               # d: 100 ms blocks of the whole mix below this (K-weighted LUFS) count as silence
SILENCE_MAX = 1.0                   # d: dead air longer than this (s) fails unless a beat is marked "silence": true
TENSION_LOW = 4                     # e: segments with tension <= this are the quiet reference
PEAK_OVER_LOW = 3.0                 # e: the peak segment's bed must be this many LU over the mean of the quiet ones
DIP_BEFORE_PEAK = 3.0               # e: and this many LU over the segment just before it (the breath before the hit)
NEAR_CUT = 0.08                     # f: an accent effect this close (s) to a cut or marked impact counts as "on the hit"
IMPACT_WINDOW = 0.10                # f: a beat marked "impact": true needs an accent effect within this (s)
ACCENT = ('sting', 'boom', 'hit', 'thud', 'bite', 'crack', 'stamp')   # f: accent effects (SFX names in voice.py; sting / boom are zombie-score one-shots)
CLIP_LEVEL, CLIP_RUN = 0.999, 3     # g: this many full-scale samples in a row = clipping
DC_MAX = 0.01                       # g: mean sample value over this = DC offset (wastes headroom, clicks on cuts)
SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def kw(x):   # BS.1770 K-weighting at 48 kHz (same coefficients as score_zombie.py)
    return lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x, axis=-1), axis=-1)
def power(x): return (kw(x) ** 2).sum(axis=0)
def cum(p): return np.concatenate([[0.0], np.cumsum(p, dtype=np.float64)])
def lu(m): return -0.691 + 10 * np.log10(m + 1e-12)
def win(c, a, b):   # loudness of [a, b) seconds from a cumulative power series
    n0, n1 = max(0, int(a * SR)), min(len(c) - 1, int(b * SR))
    return lu((c[n1] - c[n0]) / (n1 - n0)) if n1 > n0 else -120.0
def momentary_max(c, a, b, w=0.4, hop=0.1):   # loudest 400 ms block inside [a, b); a shorter stretch is measured whole
    if b - a <= w: return win(c, a, b)
    st = np.arange(a, b - w + 1e-9, hop); n0 = (st * SR).astype(int); n1 = np.minimum(len(c) - 1, ((st + w) * SR).astype(int))
    return float(lu((c[n1] - c[n0]) / np.maximum(n1 - n0, 1)).max())
def gated(p):   # BS.1770 integrated loudness of a power series (abs gate -70, rel gate -10)
    if len(p) < int(0.4 * SR): return lu(p.mean()) if len(p) else -120.0
    c = cum(p); st = np.arange(0, len(p) - int(0.4 * SR) + 1, int(0.1 * SR)); m = (c[st + int(0.4 * SR)] - c[st]) / int(0.4 * SR); m = m[lu(m) > -70]
    if not len(m): return -120.0
    m = m[lu(m) > lu(m.mean()) - 10]; return lu(m.mean()) if len(m) else -120.0
def readwav(f):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).T.astype(np.float64)
def ebur(f):
    r = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    il = [l for l in r.splitlines() if l.strip().startswith('I:')]
    pl = [l for l in r.splitlines() if l.strip().startswith('Peak:')]
    if not il or not pl:
        raise RuntimeError(f'ebur128 parse failed on {f}: {r[-240:].strip()}')
    return float(il[-1].split()[1]), float(pl[-1].split()[1])
def spark(vals, lo, hi):
    ramp = '_.,:-=+*#%@'; return ''.join(ramp[int(round((min(max(v, lo), hi) - lo) / max(hi - lo, 1e-9) * (len(ramp) - 1)))] for v in vals)

IMPACT_OK = ACCENT + ('pop', 'ting', 'ding_idea', 'msg_in', 'voice_note', 'kaching', 'tingting', 'clink', 'shutter', 'alarm_low', 'glitch')   # f: effects that count as the sound of an `impact` beat (real audio_lib & light accents included)
STEMS = ('stem_voice.wav', 'stem_music.wav', 'stem_effects.wav')
def segments(beats, TL, DUR):   # one contiguous time segment per beat: from the end of the one before to this beat's end (the last one runs to DUR)
    segs = []; prev = 0.0
    for b in beats:
        t1 = TL[b['id']]['t1'] if b['id'] in TL else prev; segs.append((prev, max(t1, prev + 0.05))); prev = max(t1, prev)
    if segs: segs[-1] = (segs[-1][0], DUR)
    return segs
def tension_list(beats):   # (tension per beat or None when no beat carries one, number of beats that carry it); a beat without one carries the value before it (the first ones the first value given)
    raw = [b.get('tension') for b in beats]; given = [t for t in raw if t is not None]
    if not given: return None, 0
    out = []; last = given[0]
    for t in raw:
        if t is not None: last = float(t)
        out.append(last)
    return out, len(given)
def check_e(beats, TL, DUR, cb, tens, shift=0.0, cm=None):   # check e on a cumulative bed-power series cb; shift = dB added to every bed loudness (voice.py measures before its final gain)
    segs = segments(beats, TL, DUR)
    def seg_lu(a, e):   # bed loudness of a segment; a segment under 400 ms is measured over a 400 ms window centred on it
        if e - a < 0.4: m = (a + e) / 2; a, e = max(0, m - 0.2), min(DUR, m + 0.2)
        return max(win(cb, a, e) + shift, -60.0)
    bedL = [seg_lu(a, e) for a, e in segs]
    pk = max(range(len(tens)), key=lambda i: (tens[i], -i)); low = [i for i in range(len(tens)) if tens[i] <= TENSION_LOW]; why = []; over = dip = None
    if not low: why.append(f'no segment with tension <= {TENSION_LOW} to compare against')
    else:
        over = bedL[pk] - float(np.mean([bedL[i] for i in low]))
        if over < PEAK_OVER_LOW: why.append(f'peak only {over:.1f} LU over the quiet segments (want >= {PEAK_OVER_LOW:.0f})')
    if pk == 0: why.append('peak is the first segment, no dip before it')
    else:
        dip = bedL[pk] - bedL[pk - 1]
        if dip < DIP_BEFORE_PEAK: why.append(f'segment before the peak is only {dip:.1f} LU quieter (want >= {DIP_BEFORE_PEAK:.0f})')
    mover = None   # information: the music bus ALONE, peak segment vs the quiet ones (the gate's pass/fail is on the whole bed)
    if cm is not None and low:
        mL = [seg_lu(a, e) for a, e in segs] if False else [max(win(cm, *((max(0, (a + e) / 2 - 0.2), min(DUR, (a + e) / 2 + 0.2)) if e - a < 0.4 else (a, e))) + shift, -60.0) for a, e in segs]
        mover = mL[pk] - float(np.mean([mL[i] for i in low]))
    return dict(ok=not why, why=why, pk=pk, low=low, over=over, dip=dip, bedL=bedL, segs=segs, music_over=mover)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; strict = '--strict' in sys.argv
    if not args: sys.exit(__doc__)
    path = args[0]; B = json.load(open(path, encoding='utf-8')); ID = B['id']; A = f'{ROOT}/out/{ID}/audio'
    have_stems = all(os.path.exists(f'{A}/{n}') for n in STEMS)
    for need in ('times.json', 'mix.wav') + (() if have_stems else ('vo_all.wav', 'sfx.wav')):
        if not os.path.exists(f'{A}/{need}'): sys.exit(f'AUDIO FAIL (1)\n  missing {A}/{need}: run tools/voice.py build {path} first')
    T = json.load(open(f'{A}/times.json', encoding='utf-8')); TL = T['lines']; DUR = T['dur']; beats = B['beats']; lines = [b for b in beats if 'text' in b]
    res = []   # (letter, name, ok or None (info), text, reason)
    skipped = []   # checks (or halves of a check) that could not run: printed in the verdict so a skip never reads as a pass
    def R(k, name, ok, text, why): res.append((k, name, ok, text, why))
    def when(ref):
        if isinstance(ref, (int, float)): return float(ref)
        i, _, e = ref.partition('.'); return TL[i]['t1' if e == 'end' else 't0']
    try: placed = json.load(open(f'{A}/sfx_placed.json', encoding='utf-8'))   # [{name, t, src}] every effect as voice.py placed it (snapped, auto accents, foley)
    except Exception: placed = None

    if have_stems:   # the three buses exactly as voice.py mixed them (already at the gain of the real mix)
        vo, ms, sf = (readwav(f'{A}/{n}') for n in STEMS); n = min(vo.shape[1], sf.shape[1], ms.shape[1]); vo, sf, ms = vo[:, :n], sf[:, :n], ms[:, :n]
        mix = readwav(f'{A}/mix.wav'); I, TP = ebur(f'{A}/mix.wav'); bed = ms + sf
        rebuilt = lu(np.mean(power(vo + bed))); note_rebuild = f'stems read; they sum to {rebuilt:.1f} LU vs mix.wav {I:.1f} LUFS (ungated, limiter not modelled)'
    else:
        # ---- rebuild the buses with voice.py's old graph ----
        tmp = tempfile.mkdtemp(prefix='audiogate_')
        try:
            music = f'{A}/music.wav'; has_m = os.path.exists(music)
            duck = ''.join(f",volume={d.get('k', 0.25)}:enable='between(t,{when(d['from']) + d.get('off0', 0):.2f},{when(d['to']) + d.get('off1', 0):.2f})'" for d in B.get('duck', []))
            fc = "[0:a]acompressor=threshold=0.1:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[vo1][vosc];[1:a]aresample=48000,volume=0.85[sfx];"
            ins = ['-i', f'{A}/vo_all.wav', '-i', f'{A}/sfx.wav']; outs = ['-map', '[vo1]', '-t', str(DUR), '-ar', '48000', '-ac', '2', f'{tmp}/vo.wav', '-map', '[sfx]', '-t', str(DUR), '-ar', '48000', '-ac', '2', f'{tmp}/sfx.wav']
            if has_m:
                sc = B.get('sc') or {}; ins += ['-i', music]
                fc += f"[2:a]aresample=48000,volume={B.get('musicVol', 0.9)}{duck}[mus];[mus][vosc]sidechaincompress=threshold={sc.get('threshold', 0.02)}:ratio={sc.get('ratio', 8)}:attack=20:release=350:makeup=1[musd]"
                outs += ['-map', '[musd]', '-t', str(DUR), '-ar', '48000', '-ac', '2', f'{tmp}/mus.wav']
            else: fc += '[vosc]anullsink'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc, *outs], check=True)
            raw = f'{A}/mix_raw.wav'; Iraw = ebur(raw)[0] if os.path.exists(raw) else None
            vo, sf = readwav(f'{tmp}/vo.wav'), readwav(f'{tmp}/sfx.wav'); ms = readwav(f'{tmp}/mus.wav') if has_m else np.zeros_like(sf)
        finally: shutil.rmtree(tmp, ignore_errors=True)
        n = min(vo.shape[1], sf.shape[1], ms.shape[1]); vo, sf, ms = vo[:, :n], sf[:, :n], ms[:, :n]
        mix = readwav(f'{A}/mix.wav'); I, TP = ebur(f'{A}/mix.wav')
        g = 10 ** ((-13.5 - Iraw) / 20) if Iraw is not None else 1.0   # voice.py: one measured gain to -13.5 LUFS, then a limiter
        vo, sf, ms = vo * g, sf * g, ms * g; bed = ms + sf
        rebuilt = lu(np.mean(power(vo + bed)))
        note_rebuild = f'NO STEMS (old build): rebuilt buses sum to {rebuilt:.1f} LU vs mix.wav {I:.1f} LUFS (ungated, limiter not modelled)'
    cv, cb, cm, cs = cum(power(vo)), cum(power(bed)), cum(power(ms)), cum(power(sf))

    # ---- a. loudness and true peak ----
    ok = LUFS_MIN <= I <= LUFS_MAX and TP <= TP_MAX
    R('a', 'loudness', ok, f'integrated {I:.1f} LUFS (want {LUFS_MIN:.0f}..{LUFS_MAX:.0f}), true peak {TP:.1f} dBTP (want <= {TP_MAX:.1f})', 'platforms normalise to about -14 and re-encode: too hot is turned down and squashed, true peak over -1 distorts')

    # ---- b. voice over the bed, every line ----
    rows = []; worst = (99, ''); bad = []; waived = []; badwaive = []
    sfxev = sorted((p['t'], p['name']) for p in placed) if placed else sorted((when(x['ref']) + x.get('off', 0), x['name']) for x in B.get('sfx', []))
    def culprit(a, e):   # WHAT is over the voice: the bus, and the effects that start inside the line (or the latest one still ringing from before it)
        if momentary_max(cs, a, e) <= momentary_max(cm, a, e): return 'music bus'
        ins = [f'{n}@{t:.2f}' for t, n in sfxev if a - 0.2 <= t <= e]; before = [f'{n}@{t:.2f}, started before the line' for t, n in sfxev if a - 3.0 <= t < a - 0.2][-1:]
        return 'effects bus: ' + (', '.join(ins) if ins else (before[0] if before else 'no effect starts nearby'))
    for b in lines:
        a, e = TL[b['id']]['t0'], TL[b['id']]['t1']; v = win(cv, a, e); bd = momentary_max(cb, a, e); mg = v - bd; rows.append((b['id'], a, e, v, bd, mg))
        if mg < worst[0]: worst = (mg, b['id'])
        wv = b.get('marginWaive')
        if 'marginWaive' in b and not (isinstance(wv, str) and wv.strip()): badwaive.append(b['id'])   # a waiver needs a written reason
        elif mg < MARGIN_MIN and 'marginWaive' in b: waived.append(f"WAIVED {b['id']} margin {mg:.1f} dB: {wv.strip()}   [{culprit(a, e)}]")
        elif mg < MARGIN_MIN: bad.append(f"{b['id']} {mg:.1f} ({culprit(a, e)})")
    R('b', 'voice_vs_bed', not bad and not badwaive, f'worst margin {worst[0]:.1f} dB at {worst[1]} (want >= {MARGIN_MIN:.0f}, bed = music + effects, loudest 400 ms in the line)' + (f'; OVER THE VOICE: {"; ".join(bad[:8])}{" ..." if len(bad) > 8 else ""} ({len(bad)} of {len(lines)} lines)' if bad else f', all {len(lines) - len(waived)} unwaived lines ok') + (f'; marginWaive without a reason: {", ".join(badwaive)}' if badwaive else ''), 'if the bed is within 6 dB of the voice the words are masked on a phone speaker; a deliberate swell or hit is waived per beat with "marginWaive": "<reason>"')

    # ---- c. per-speaker loudness ----
    cvp = power(vo); by = {}
    for b in lines:
        if b.get('think') or b.get('phone'): continue
        a, e = TL[b['id']]['t0'], TL[b['id']]['t1']; by.setdefault(b['who'], []).append(cvp[int(a * SR):int(e * SR)])
    spk = {w: (gated(np.concatenate(p)), sum(len(x) for x in p) / SR) for w, p in by.items()}
    main = sorted(spk, key=lambda w: -spk[w][1])[:MAIN_SPEAKERS]
    if len(main) >= 2:
        vals = [spk[w][0] for w in main]; sp = max(vals) - min(vals)
        R('c', 'speaker_balance', sp <= SPEAKER_SPREAD, 'main speakers ' + ', '.join(f'{w} {spk[w][0]:.1f} LUFS' for w in main) + f' -> spread {sp:.1f} LU (want <= {SPEAKER_SPREAD}); others: ' + (', '.join(f'{w} {spk[w][0]:.1f}' for w in spk if w not in main) or 'none'), 'one character always louder reads as more important and makes the viewer ride the volume')
    else: R('c', 'speaker_balance', True, f'only one main speaker ({main}), nothing to compare', 'n/a')

    # ---- d. dead air ----
    intended = [(TL[b['id']]['t0'], TL[b['id']]['t1']) for b in beats if b.get('silence') and b['id'] in TL]
    try:
        si = json.load(open(f'{A}/score_info.json', encoding='utf-8')); sg = sorted(si.get('segs', []), key=lambda s: s['t']); ends = [s['t'] for s in sg[1:]] + [DUR]
        intended += [(s['t'], e) for s, e in zip(sg, ends) if s.get('seg') == 'silence' and 'kind' not in s]   # the zombie score's own `silence` section is a marker too
    except Exception: pass
    pm = power(mix); hop = int(0.05 * SR); blk = int(0.1 * SR); cmx = cum(pm); st = np.arange(0, max(0, len(pm) - blk), hop); lev = lu((cmx[st + blk] - cmx[st]) / blk) if len(st) else np.array([], dtype=np.float64); quiet = lev < SILENCE_FLOOR
    for i, s0 in enumerate(st):
        t = s0 / SR + 0.05
        if any(a <= t <= e for a, e in intended): quiet[i] = False
    runs = []; i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j + 1 < len(quiet) and quiet[j + 1]: j += 1
            runs.append((st[i] / SR, st[j] / SR + 0.1)); i = j + 1
        else: i += 1
    longq = [(a, e) for a, e in runs if e - a > SILENCE_MAX]
    earlyq = [(a, min(e, 10.0)) for a, e in runs if a < 10.0 and min(e, 10.0) - a > 0.5]
    quietest = float(lev.min()) if len(lev) else -120.0
    dead_ok = (not longq) and (not earlyq if strict else True)
    R('d', 'dead_air', dead_ok, f'{len(longq)} stretches over {SILENCE_MAX:.1f} s below {SILENCE_FLOOR:.0f} LUFS' + (': ' + ', '.join(f'{a:.2f}-{e:.2f}' for a, e in longq[:6]) if longq else '') + (f'; early 0-10 s silence > 0.5 s: ' + ', '.join(f'{a:.2f}-{e:.2f}' for a, e in earlyq[:4]) if earlyq else '') + f'; quietest block {quietest:.1f} LUFS; intended windows {len(intended)}', 'a stretch of nothing makes the viewer think the video froze (especially in the first 10 s); mark deliberate silence with "silence": true on the beat')

    # ---- e. tension follows sound ----
    tens, ngiven = tension_list(beats); have_t = tens is not None; segs = segments(beats, TL, DUR)
    if not have_t:
        R('e', 'tension_follows_sound', False if strict else None, 'tension: SKIPPED (no beat carries a tension value)' if not strict else 'tension: no curve (--strict)', 'the climax must be audibly bigger than the setup, and a dip must come before it')
        if not strict: skipped.append('e (no tension curve in the beats file)')
    else:
        E = check_e(beats, TL, DUR, cb, tens, cm=cm); pk, bedL, over, dip, why = E['pk'], E['bedL'], E['over'], E['dip'], E['why']
        R('e', 'tension_follows_sound', E['ok'], f"peak tension {tens[pk]:g} at beat {beats[pk]['id']} ({segs[pk][0]:.1f}-{segs[pk][1]:.1f} s) bed {bedL[pk]:.1f} LUFS; " + (f'{over:.1f} LU over quiet mean ({len(E["low"])} quiet segments' + (f'; music bus alone {E["music_over"]:+.1f} LU' if E['music_over'] is not None else '') + '); ' if over is not None else '') + (f'{dip:.1f} LU over the segment before' if dip is not None else '') + (f'; only {ngiven} of {len(beats)} beats carry a tension value, the rest carry the value before them' if ngiven < len(beats) else '') + ('; ' + '; '.join(why) if why else ''), 'drama is loudness contrast: the biggest moment must be louder than the quiet ones and preceded by a dip')

    # ---- f. hits on cuts and impacts ----
    names = set(re.findall(r"name == '(\w+)'", open(f'{ROOT}/tools/voice.py', encoding='utf-8').read())); acc = sorted(set(ACCENT) & names) + [x for x in ('sting', 'boom') if x not in names]
    if placed is not None: events = [(p['t'], p['name']) for p in placed if p['name'] in IMPACT_OK]
    else: events = [(when(s['ref']) + s.get('off', 0), s['name']) for s in B.get('sfx', []) if s['name'] in IMPACT_OK]
    try: events += [(s['t'], s['seg']) for s in json.load(open(f'{A}/score_info.json', encoding='utf-8')).get('segs', []) if s.get('seg') in ('sting', 'boom', 'hit')]
    except Exception: pass
    cuts, hits = None, []; epf = f'{ROOT}/episodes/{ID}.js'
    if os.path.exists(epf):
        r = subprocess.run(['node', f'{ROOT}/tools/cuts.cjs', epf], capture_output=True, text=True)
        if r.returncode == 0:
            try: j = json.loads(r.stdout); cuts, hits = [c for c in j['cuts'] if c > 0.01], j.get('hits', [])
            except Exception: pass
    if cuts is None: skipped.append(f'f (cut half: no cut list, episodes/{ID}.js missing or cuts.cjs failed; impacts still checked)')
    impacts = [(b['id'], TL[b['id']]['t0'] + b.get('impactOff', 0)) for b in beats if b.get('impact') and b['id'] in TL]
    marks = (cuts or []) + hits + [t for _, t in impacts]
    onhit = [e for e in events if any(abs(e[0] - m) <= NEAR_CUT for m in marks)]
    miss = [(i, t) for i, t in impacts if not any(abs(e[0] - t) <= IMPACT_WINDOW for e in events)]
    R('f', 'hits_on_cuts', not miss, f'{len(events)} accent effects ({", ".join(sorted({e[1] for e in events})) or "none"}), {len(onhit)} within {NEAR_CUT * 1000:.0f} ms of a cut or marked impact' + (f' ({len(cuts)} cuts)' if cuts is not None else ' (no cut list: no episodes/%s.js or cuts.cjs failed)' % ID) + f'; {len(impacts)} beats marked impact' + (f', no effect within {IMPACT_WINDOW * 1000:.0f} ms of: ' + ', '.join(f'{i}@{t:.2f}' for i, t in miss) if miss else ''), 'a hit that lands off the picture event feels late or random; a marked impact without a sound is a silent punch')

    # ---- g. clipping, DC, spectrum ----
    hotm = (np.abs(mix) >= CLIP_LEVEL).any(axis=0).astype(np.int8); d = np.diff(np.concatenate([[0], hotm, [0]])); runs_c = np.where(d == -1)[0] - np.where(d == 1)[0]; clip = int((runs_c >= CLIP_RUN).sum())
    dc = float(np.abs(mix.mean(axis=1)).max()); x = mix.mean(axis=0); P = np.abs(np.fft.rfft(x)) ** 2; fr = np.fft.rfftfreq(len(x), 1 / SR); tot = P.sum() + 1e-12
    sh = [P[(fr >= lo) & (fr < hi)].sum() / tot * 100 for lo, hi in ((0, 250), (250, 4000), (4000, 24000))]
    R('g', 'clipping_dc', clip == 0 and dc <= DC_MAX, f'{clip} runs of >= {CLIP_RUN} full-scale samples, sample peak {20 * np.log10(np.abs(mix).max() + 1e-12):.2f} dBFS, DC {dc:.4f} (want <= {DC_MAX}); spectrum low<250 {sh[0]:.0f} %, mid 250-4k {sh[1]:.0f} %, high>4k {sh[2]:.0f} % (information)', 'flat-topped samples crackle; DC offset eats headroom and clicks on every cut')

    # ---- print ----
    nfail = sum(1 for r in res if r[2] is False)
    print(f'{ID}: {DUR:.1f} s, {len(lines)} lines  [{note_rebuild}]')
    for k, name, ok, text, why in res: print(f"{k}. {name:22s} {'info' if ok is None else ('PASS' if ok else 'FAIL')}  {text}  -- {why}")
    for x in waived: print(x)
    for x in skipped: print(f'SKIPPED: {x}')
    wtxt = (f', {len(waived)} waived' if waived else '') + (f', {len(skipped)} SKIPPED: ' + '; '.join(x.split(' (')[0] for x in skipped) if skipped else ''); verdict = ('AUDIO PASS' if not nfail else f'AUDIO FAIL ({nfail})') + wtxt; print(verdict)

    # ---- audio_report.md ----
    od = f'{ROOT}/out/{ID}'; os.makedirs(od, exist_ok=True); L = []; w = L.append
    seg_of = lambda t: next((i for i, (a, e) in enumerate(segs) if a <= t < e), None)
    w(f'# Audio report: {ID} ({DUR:.1f} s)\n\nWritten by `tools/audiogate.py`. Loudness in LUFS (K-weighted), measured on the rebuilt buses at the gain of the real mix. bed = music + effects. margin = voice - bed.\n')
    w('## Gate\n'); [w(f"- {k}. {name}: {'info' if ok is None else ('PASS' if ok else 'FAIL')}: {text}") for k, name, ok, text, why in res]; [w(f'- {x}') for x in waived]; [w(f'- SKIPPED: {x}') for x in skipped]; w(f'\n{verdict}\n')
    if have_t: tl = [tens[seg_of(min(DUR - 0.01, (k + 0.5) * 2.0))] if seg_of(min(DUR - 0.01, (k + 0.5) * 2.0)) is not None else 0 for k in range(int(np.ceil(DUR / 2)))]; w('Tension per 2 s: `' + spark(tl, 0, 10) + '`\n')
    w('## Per 2 s\n\n| t | tension | voice | music | effects | bed | margin | bed bar |\n|---|---|---|---|---|---|---|---|')
    allb = [win(cb, 2.0 * k, min(DUR, 2.0 * k + 2.0)) for k in range(int(np.ceil(DUR / 2)))]
    for k in range(int(np.ceil(DUR / 2))):
        a, e = 2.0 * k, min(DUR, 2.0 * k + 2.0); v = win(cv, a, e); bd = allb[k]; i = seg_of(min(DUR - 0.01, (a + e) / 2)); tn = '-' if not have_t or i is None else str(tens[i])
        speaking = v > -45; w(f'| {a:5.1f} | {tn} | {v:.1f} | {win(cm, a, e):.1f} | {win(cs, a, e):.1f} | {bd:.1f} | {("%.1f" % (v - bd)) if speaking else "-"} | `{"#" * max(0, int((bd + 50) / 2))}` |')
    w('\n## Per line\n\n| line | t0-t1 | voice | bed max | margin | ok |\n|---|---|---|---|---|---|')
    for i, a, e, v, bd, mg in rows: w(f'| {i} | {a:.2f}-{e:.2f} | {v:.1f} | {bd:.1f} | {mg:.1f} | {"yes" if mg >= MARGIN_MIN else "NO"} |')
    open(f'{od}/audio_report.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    sys.exit(1 if nfail else 0)
if __name__ == '__main__': main()
