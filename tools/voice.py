#!/usr/bin/env python3
"""cine3d sound: from a beats file (the dialogue in order) to line times, voice stems, sound effects, music and the final mix.
  python tools/voice.py need  episodes/<id>.beats.json     # which lines still have no take (and what they cost)
  python tools/voice.py find  <SPEAKER> <words...>           # library takes of that speaker containing the words (case, accents ignored): exact text + path, reuse word for word
  python tools/voice.py record episodes/<id>.beats.json --ceiling <credits> [--max 5] [--yes] [--channel trada|goat]   # dry run unless --yes; ElevenLabs eleven_v4, one take per missing line (docs/v4-pipeline.md)
  python tools/voice.py stamp episodes/<id>.beats.json [ids]  # vouch that takes with no recorded text were made from the current text
  need / build compare each take with voice/<id>/takes.json (the text it was recorded from): STALE TAKE = missing; build stops unless --allow-stale. need also writes out/<id>/voice_need.json (chars + credits per line).
  python tools/voice.py build episodes/<id>.beats.json     # times -> episodes/<id>.times.js, stems + sfx + music + mix -> out/<id>/audio/
Takes: voice/<id>/<beat id>.mp3|wav (a new recording) first, else the Trà đá library (~/tdvai/vo/lib/index.json, key "SPK|text").
Beat: { id, who, spk (library speaker), text (what the caption shows and the library key), say (optional: the text sent to the voice, with [tags]; `need` counts its characters), gap (pause before, s), think (thought cloud: echo, quieter), phone (through a phone speaker), pitch, af (extra ffmpeg chain), gain (dB), tempo }
      or { id, pause: seconds }.   A reference is a beat id (= its start) or '<id>.end'. duck: [{ from, to, off0, off1, k }] holds the music at k between the two references.   sfx: [{ name, ref: '<beat id>' | '<beat id>.end', off, gain, dur }].
  14/11 (sound gate): build also writes the three STEMS (stem_voice / stem_music / stem_effects .wav, at the gain of the mix), auto-ducks music and effects so every line clears them by
  MARGIN_TARGET dB, shapes the music with the beats' tension curve, puts an accent on every `impact` beat, snaps `"snap": "cut"` effects and the score's stingers to the cuts (episodes/<id>.js),
  places foley from out/<id>/events.json (node tools/events.cjs episodes/<id>.js; `"foley": "auto"` in the header or on a beat) and lays a room tone under the film.  --legacy-mix = the old mix, none of that.
  New beat fields: tension (0-10), mood, impact (true | "heavy|huge|scare|light|bright", impactOff, impactGain), silence, marginWaive "<reason>", foley "auto"|"off".  Header: foley "auto", room "off" | {"below": dB}.
  Times file (episodes/<id>.times.js and out/<id>/audio/times.json) also carries  tension: [[t, v], ...]  and  impacts: [t, ...]  when the beats have them."""
import json, os, re, subprocess, sys, time, unicodedata
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
LEGACY = '--legacy-mix' in sys.argv
# ---- knobs of the new mix (one reason each) ----
SNAP_TOL = 0.15      # an effect flagged "snap": "cut", and the score's stingers, move to the nearest cut within this many seconds
MARGIN_TARGET = 6.3  # auto-duck keeps every line this many dB over music + effects (the gate wants 6.0; 0.3 dB for the limiter, which is not modelled)
PEAK_GOAL = DIP_GOAL = 3.4   # the closed loop on check e stops when the peak is this many LU over the quiet segments and over the segment before it (gate: 3.0)
THIN_DB = 5.0        # music pulled down on the beats after a tender / sad peak (tension >= 7)
NOTCH_DB = 14.0      # the breath before the top peak and before every impact: music pulled down this far for 0.45 s
ROOM_SIL_DB = 8.0    # an intended silence ducks the room tone by this much
# impact accents (a beat with "impact": true and no accent effect within 0.1 s gets one). kind = beat "impact" if it is a string, else IMPACT_BY_MOOD[mood], else heavy. kind -> (effect, gain dB)
IMPACT_FX = {'heavy': ('thud', 0.0), 'huge': ('boom', -2.0), 'scare': ('sting', -2.0), 'light': ('pop', 0.0), 'bright': ('ting', -4.0)}
IMPACT_BY_MOOD = {'anger': 'heavy', 'shock': 'heavy', 'flat': 'heavy', 'sad': 'heavy', 'fear': 'scare', 'smug': 'light', 'joy': 'bright', 'tender': 'bright'}
SR = 48000; ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); TD = os.path.expanduser('~/tdvai')
import datetime, glob, math, shutil, urllib.error, urllib.request
import sfx_lib
CREDIT_MARGIN = 1.035   # ElevenLabs bills about one credit per character; 3.5 % on top for the estimate
# ElevenLabs voice ids per library speaker (what the channel pages state). A `voices` map per channel in pipeline/channels.json wins over this table; pitch / phone / echo stay in the mix, never in the request.
VOICES = {'trada': {'TÈO': 'VOICE_ID_TEO', 'BÍP': 'VOICE_ID_BIP', 'MẸ': 'VOICE_ID_MOM', 'CHỦ QUÁN': 'VOICE_ID_MOM', 'KHÁCH': 'VOICE_ID_TEO', 'GPT': 'VOICE_ID_GPT', 'BẠN': 'VOICE_ID_FRIEND'},
          'goat': {'RON': 'VOICE_ID_RON', 'LEO': 'VOICE_ID_LEO'}}
def norm(t): return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(t if t is not None else '')).replace('…', '...').strip().lower())
def fold(t): return re.sub(r'\s+', ' ', ''.join(c for c in unicodedata.normalize('NFD', str(t).lower().replace('đ', 'd')) if not unicodedata.combining(c))).strip()
def opt(name, default=None):
    if name in sys.argv: i = sys.argv.index(name); return sys.argv[i + 1] if i + 1 < len(sys.argv) else default
    return default
def now_iso(): return datetime.datetime.now().astimezone().isoformat(timespec='seconds')
def credits(chars): return int(math.ceil(chars * CREDIT_MARGIN - 1e-9))
def key(spk, text):
    t = unicodedata.normalize('NFC', text).replace('…', '...').strip().lower(); return f"{spk}|{re.sub(r'\s+', ' ', t)}"
if len(sys.argv) > 1 and sys.argv[1] == 'find':   # voice.py find <SPEAKER> <words...>: library takes of that speaker whose text contains all the words (case and accents ignored)
    if len(sys.argv) < 4: sys.exit('usage: voice.py find <SPEAKER> <words...>   e.g. find TÈO chỉ có một chữ')
    want = fold(sys.argv[2]); words = [w for w in fold(' '.join(sys.argv[3:])).split(' ') if w]; hits = {}; texts = {}
    for f in glob.glob(f'{ROOT}/episodes/*.beats.json'):   # exact text of cine3d's own takes (their index key is lower-cased) from the beats files
        try:
            for bb in json.load(open(f, encoding='utf-8')).get('beats', []):
                if 'text' in bb: texts[key(bb.get('spk', bb['who'].upper()), bb['text'])] = bb['text']
        except Exception: pass
    libidx = json.load(open(f'{TD}/vo/lib/index.json')); ownidx = json.load(open(f'{ROOT}/voice/index.json')) if os.path.exists(f'{ROOT}/voice/index.json') else {}
    def add(spk, text, where):
        if fold(spk) == want and all(w in fold(text) for w in words): hits.setdefault((spk, norm(text)), (spk, text, []))[2].append(where)
    for k, e in libidx.items(): add(e.get('spk', k.split('|')[0]), e.get('text', k.split('|', 1)[1]), e['file'])
    for k, rel_ in ownidx.items(): add(k.split('|')[0], texts.get(k, k.split('|', 1)[1]), f'{ROOT}/{rel_}')
    for tf in glob.glob(f'{ROOT}/voice/*/takes.json'):   # takes recorded by `voice.py record` (reusable once a build has put them in voice/index.json)
        try: tk = json.load(open(tf, encoding='utf-8')).get('takes', {})
        except Exception: continue
        for e in tk.values():
            if e.get('file') and e.get('spk') and e.get('sent') == e.get('text'): add(e['spk'], e['text'], f"{os.path.dirname(tf)}/{e['file']}")
    rows = sorted(hits.values(), key=lambda r: (len(r[1]), r[1]))
    for spk, text, where in rows[:40]: print(f'{spk}  "{text}"\n    {where[0]}' + (f'  (+{len(where) - 1} more)' if len(where) > 1 else ''))
    print(f'{len(rows)} take(s) of {sys.argv[2]} contain: {" ".join(words)}' + (' (first 40 shown)' if len(rows) > 40 else '') + ('' if rows else '  -> write the line new, or try fewer / shorter words'))
    sys.exit(0 if rows else 1)
cmd, path = sys.argv[1], sys.argv[2]; B = json.load(open(path)); ID = B['id']
if cmd == 'record':   # 23/11 credit lock (rules 2, pack trada only): no ElevenLabs call, not even the dry run, until the owner has approved the silent animatic. Checked BEFORE anything is written to disk.
    import rules2
    _st = rules2.read_state(ID)
    if rules2.rules_version(B, _st, rules2.cli_rules()) == 2 and not ('--channel' in sys.argv and sys.argv[sys.argv.index('--channel') + 1:][:1] == ['goat']):
        _ok, _why = rules2.animatic_owner_ok(ID)
        if not _ok: print(f'DỪNG LẠI: {ID} theo luật v2, chưa được thu giọng (chưa gọi ElevenLabs). the owner phải duyệt bản animatic câm (không tiếng) trước: {_why}.\n  Làm animatic, gửi the owner; khi the owner OK thì ghi: python3 tools/pipeline.py record {ID} animatic_owner OK --by <người ghi> --quote "<lời the owner>"\n  (STOP: v2 episode, animatic_owner not done: no ElevenLabs call was made.)'); sys.exit(3)
OUT = f'{ROOT}/out/{ID}/audio'; os.makedirs(OUT, exist_ok=True)
idx = json.load(open(f'{TD}/vo/lib/index.json'))
OWN = f'{ROOT}/voice/index.json'; own = json.load(open(OWN)) if os.path.exists(OWN) else {}   # cine3d's own takes: 'SPEAKER|text' -> voice/<episode>/<beat>.mp3
def ff(x, af):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', af, '-f', 'f32le', '-'], input=x.astype(np.float32).tobytes(), capture_output=True, check=True).stdout, np.float32).copy()
def load(f):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32).copy()
def trim(x, thr=0.012, pad=0.03):
    w = int(SR * 0.01); e = np.sqrt(np.convolve(x * x, np.ones(w) / w, 'same')); on = np.where(e > thr * max(e.max(), 1e-6) / 0.25 if False else e > thr)[0]
    if not len(on): return x
    return x[max(0, on[0] - int(pad * SR)):min(len(x), on[-1] + int((pad + 0.05) * SR))]
# ---- takes.json (14/11): what each take was recorded FROM, so a changed line can never silently reuse an old take ----
TAKES = f'{ROOT}/voice/{ID}/takes.json'
def takes_load():
    try: T = json.load(open(TAKES, encoding='utf-8'))
    except Exception: T = {}
    T.setdefault('takes', {}); T.setdefault('pending', {}); return T
def takes_save(T):
    os.makedirs(os.path.dirname(TAKES), exist_ok=True); T['total_chars'] = sum(e.get('chars', 0) for e in T['takes'].values() if e.get('src') in ('record', 'agent'))
    tmp = TAKES + '.tmp'; json.dump(T, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); os.replace(tmp, TAKES)
def take_file(b):
    for ext in ('wav', 'mp3', 'flac'):
        f = f'{ROOT}/voice/{ID}/{b["id"]}.{ext}'
        if os.path.exists(f): return f
    return None
def sent_text(b): return b.get('say', b['text'])
def spk_of(b): return b.get('spk', b['who'].upper())
lines = [b for b in B['beats'] if 'text' in b]
TK = takes_load()
def adopt_pending():   # a take file made after `need` listed its line as missing was recorded from that listing: file it under the text `need` printed (covers recorders that do not call `record`)
    got = False
    for bid, pe in list(TK['pending'].items()):
        b = next((x for x in lines if x['id'] == bid), None); f = take_file(b) if b else None
        if f and os.path.getmtime(f) >= pe.get('epoch', 1e18) - 1: TK['takes'][bid] = dict(text=pe['text'], say=pe.get('say'), sent=pe['sent'], spk=pe.get('spk'), chars=len(pe['sent']), file=os.path.basename(f), at=now_iso(), src='agent'); del TK['pending'][bid]; got = True
    if got: takes_save(TK)
adopt_pending()
def take_status(b):   # None (no file) | 'unknown' (recorded before takes.json) | 'ok' | 'stale' (recorded from other words)
    if not take_file(b): return None
    e = TK['takes'].get(b['id'])
    if not e: return 'unknown'
    return 'ok' if norm(e.get('sent')) == norm(sent_text(b)) and norm(e.get('text')) == norm(b['text']) else 'stale'
ALLOW_STALE = '--allow-stale' in sys.argv
def alt_take(b):   # a take for exactly the current text from an earlier episode or the library: (file, raw?) or None
    k = key(spk_of(b), b['text'])
    if k in own and os.path.exists(f"{ROOT}/{own[k]}"): return f"{ROOT}/{own[k]}", True   # recorded for an earlier cine3d episode (raw: trim it like a new one)
    e = idx.get(k)
    return (e['file'], False) if e else None
def take(b):
    f = take_file(b)
    if f and (take_status(b) != 'stale' or ALLOW_STALE): return f, True
    return alt_take(b) or (None, False)   # a stale take falls through: the library may hold the line as it is now
def stale_msg(b): return f'STALE TAKE {b["id"]}: recorded "{TK["takes"][b["id"]].get("sent")}" but the beat now says "{sent_text(b)}"'
def stale_report(announce=True):   # -> stale beats with no other take for the current text; prints the loud lines
    bad = []
    for b in lines:
        if take_status(b) != 'stale': continue
        alt = alt_take(b)
        if announce: print(f'  {stale_msg(b)}' + (' (the library has the current text: that take is used)' if alt else ' (--allow-stale: the OLD take is used, the sound does not match this text)' if ALLOW_STALE else ' -> counts as MISSING'))
        if not alt and not ALLOW_STALE: bad.append(b)
    unk = [b['id'] for b in lines if take_status(b) == 'unknown']
    if announce and unk: print(f'  note: {len(unk)} take(s) in voice/{ID} have no recorded text (made before takes.json), so the stale check cannot cover them: {", ".join(unk[:8])}{" ..." if len(unk) > 8 else ""}  (`voice.py stamp {path}` vouches for the current text)')
    return bad
def missing_lines():
    stale = stale_report()
    return [(b, 'stale take' if b in stale else 'no take') for b in lines if b in stale or take(b)[0] is None]
if cmd == 'stamp':   # voice.py stamp <beats.json> [beat id ...]: the driver vouches that these takes (default: every take with no recorded text) were recorded from the text the beats say now
    ids = [a for a in sys.argv[3:] if not a.startswith('--')]; n = 0
    for b in lines:
        if take_file(b) and (b['id'] in ids or (not ids and take_status(b) == 'unknown')): TK['takes'][b['id']] = dict(text=b['text'], say=b.get('say'), sent=sent_text(b), spk=spk_of(b), chars=len(sent_text(b)), file=os.path.basename(take_file(b)), at=now_iso(), src='stamp'); n += 1
    takes_save(TK); print(f'stamped {n} take(s) in voice/{ID}/takes.json (no credit counted for them)'); sys.exit(0)
if cmd == 'need':
    miss = missing_lines(); rows = []; tot = 0
    for b, why in miss:
        sent = sent_text(b); n = len(sent); tot += n
        print(f"  NEED {b['id']:5s} {spk_of(b)}: {sent}  ({n} chars, ~{credits(n)} credits{', STALE take' if why == 'stale take' else ''})")
        rows.append(dict(id=b['id'], spk=spk_of(b), sent=sent, chars=n, credits=credits(n), why=why))
    rep = dict(id=ID, beats=path, at=now_iso(), margin=CREDIT_MARGIN, lines=rows, missing=len(rows), total_chars=tot, total_credits=credits(tot), stale=[r['id'] for r in rows if r['why'] == 'stale take'], takes_without_recorded_text=[b['id'] for b in lines if take_status(b) == 'unknown'])
    json.dump(rep, open(f'{ROOT}/out/{ID}/voice_need.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    TK['pending'] = {b['id']: dict(text=b['text'], say=b.get('say'), sent=sent_text(b), spk=spk_of(b), epoch=time.time()) for b, _ in miss}
    if TK['pending'] or os.path.exists(TAKES): takes_save(TK)
    print(f'{len(lines)} lines, missing {len(miss)}, about {tot} chars = {credits(tot)} credits (chars + 3.5 %); per line and total also in out/{ID}/voice_need.json'); sys.exit(0)
if cmd == 'record':   # voice.py record <beats.json> --ceiling <credits> [--max 5] [--yes] [--channel trada|goat]: the voice step; a dry run unless --yes
    ceiling = opt('--ceiling'); mx = int(opt('--max', 5)); yes = '--yes' in sys.argv
    if ceiling is None: sys.exit('record needs --ceiling <credits> (the figure the owner approved for this episode)')
    ceiling = float(ceiling); ch = opt('--channel')
    if not ch:
        try: ch = json.load(open(f'{ROOT}/out/{ID}/pipeline.json')).get('channel')
        except Exception: ch = None
    try: CH = json.load(open(f'{ROOT}/pipeline/channels.json', encoding='utf-8')).get('channels', {})
    except Exception: CH = {}
    def voice_for(spk):
        for c in ([ch] if ch else list(VOICES)):
            v = (CH.get(c, {}).get('voices') or {}).get(spk) or VOICES.get(c, {}).get(spk)
            if v: return v
        return None
    miss = missing_lines(); rows = []
    for b, why in miss[:mx]: rows.append(dict(b=b, spk=spk_of(b), sent=sent_text(b), chars=len(sent_text(b)), voice=voice_for(spk_of(b)), why=why))
    spent = sum(e.get('chars', 0) for e in TK['takes'].values() if e.get('src') in ('record', 'agent'))
    print(f'{ID}: {len(miss)} line(s) missing, this call takes the first {len(rows)} (--max {mx}); channel {ch or "?"}')
    for r in rows: print(f"  {r['b']['id']:5s} {r['spk']:8s} voice {r['voice'] or 'NONE'}  {r['chars']:3d} chars ~{credits(r['chars']):3d} credits{'  (replaces a STALE take: the old file moves to voice/' + ID + '/_stale/)' if r['why'] == 'stale take' else ''}: {r['sent']}")
    bt = sum(r['chars'] for r in rows); after = spent + bt
    print(f'batch {bt} chars ~{credits(bt)} credits; recorded so far for {ID}: {spent} chars ~{credits(spent)} credits; after this batch {after} chars ~{credits(after)} credits; ceiling {ceiling:.0f}')
    if not rows: print('nothing to record'); sys.exit(0)
    nov = sorted({r['spk'] for r in rows if not r['voice']})
    if nov: sys.exit(f'REFUSED: no voice id for speaker(s) {", ".join(nov)}: add them to the `voices` map of the channel in pipeline/channels.json (or pass --channel)')
    if credits(after) > ceiling: sys.exit(f'REFUSED: ~{credits(after)} credits after this batch passes the ceiling {ceiling:.0f}: nothing sent. Lower --max, or ask the owner for a higher ceiling')
    if not yes: print(f'DRY RUN: nothing sent, no credit spent. Add --yes to send {len(rows)} request(s) (model eleven_v4, one generation each, mp3 44.1 kHz) and save voice/{ID}/<beat id>.mp3'); sys.exit(0)
    FAKE = os.environ.get('CINE3D_VOICE_FAKE_MP3')   # test hook: copy this mp3 instead of calling the API (no network, no key read)
    def api_key():
        m = re.search(r'^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$', open(os.path.expanduser('~/.config/cine3d/.env'), encoding='utf-8').read(), re.M)
        if not m: sys.exit('ELEVENLABS_API_KEY not found in ~/.config/cine3d/.env')
        return m.group(1).strip('\'"')
    saved = []; os.makedirs(f'{ROOT}/voice/{ID}', exist_ok=True)
    for r in rows:
        b = r['b']; dst = f'{ROOT}/voice/{ID}/{b["id"]}.mp3'
        try:
            if FAKE: data = open(FAKE, 'rb').read()
            else:
                rq = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{r["voice"]}?output_format=mp3_44100_128', data=json.dumps({'text': r['sent'], 'model_id': 'eleven_v4'}).encode(), method='POST', headers={'xi-api-key': api_key(), 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
                with urllib.request.urlopen(rq, timeout=120) as rs: data = rs.read()
            if not data: raise ValueError('empty audio')
        except urllib.error.HTTPError as ex_:
            print(f'STOPPED at {b["id"]}: ElevenLabs HTTP {ex_.code}: {ex_.read()[:300].decode("utf-8", "replace")}\nalready saved this call: {", ".join(saved) or "none"}; {b["id"]} was NOT saved and is not retried'); sys.exit(1)
        except Exception as ex_:
            print(f'STOPPED at {b["id"]}: {type(ex_).__name__}: {str(ex_)[:200]}\nalready saved this call: {", ".join(saved) or "none"}; {b["id"]} was NOT saved and is not retried'); sys.exit(1)
        old = take_file(b)
        if old:   # only a STALE take gets here: keep it aside, never delete
            os.makedirs(f'{ROOT}/voice/{ID}/_stale', exist_ok=True); shutil.move(old, f'{ROOT}/voice/{ID}/_stale/{time.strftime("%H%M%S")}_{os.path.basename(old)}')
        open(dst + '.tmp', 'wb').write(data); os.replace(dst + '.tmp', dst)
        TK['takes'][b['id']] = dict(text=b['text'], say=b.get('say'), sent=r['sent'], spk=r['spk'], chars=r['chars'], voice=r['voice'], model='eleven_v4', file=os.path.basename(dst), at=now_iso(), src='record'); TK['pending'].pop(b['id'], None); takes_save(TK); saved.append(b['id'])
        print(f'  saved voice/{ID}/{os.path.basename(dst)} ({len(data)} bytes, {r["chars"]} chars)')
    print(f'recorded {len(saved)} line(s); total recorded for {ID}: {TK["total_chars"]} chars ~{credits(TK["total_chars"])} credits (voice/{ID}/takes.json). Next: voice.py need {path}')
    sys.exit(0)
if cmd == 'build':
    bad = stale_report()
    if bad: print(f'STALE TAKE: build stopped. {len(bad)} line(s) would be mixed from a take recorded for other words: {", ".join(b["id"] for b in bad)}. Record them under a new beat id, or pass --allow-stale to build with the old audio.'); sys.exit(1)

def rms_db(x):
    w = int(SR * 0.05); e = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, max(1, len(x) - w), w)]); a = e[e > e.max() * 0.15] if len(e) else e
    return 20 * np.log10(max(1e-6, np.sqrt(np.mean(a ** 2)) if len(a) else 1e-6))
LEVEL = {'teo': -20.0, 'bip': -19.0, 'ron': -20.0, 'leo': -19.4}   # GOAT Beef: Leo sits ~0.6 LU above Ron (house rule)
BIPFX = 'aecho=1.0:1.0:7|13:0.16|0.09,equalizer=f=3200:t=q:w=1.2:g=3'
t = float(B.get('pre', 0)); times = {}; clips = []
for b in B['beats']:
    if 'pause' in b: times[b['id']] = dict(t0=round(t, 3), t1=round(t + b['pause'], 3)); t += b['pause']; continue
    f, new = take(b)
    if not f: sys.exit(f"no take for {b['id']}: {b['text']}  (run `need`)")
    x = load(f); x = trim(x) if new else x
    if b.get('tempo'): x = ff(x, f"atempo={b['tempo']}")
    r = b.get('pitch')
    if r: x = ff(x, f'asetrate={SR * r:.0f},aresample={SR},atempo={1 / r:.4f}')
    x = ff(x, 'highpass=f=' + ('110' if b['who'] == 'bip' else '80'))
    g = b.get('level', LEVEL.get(b['who'], -20.0)) - rms_db(x) + b.get('gain', 0); x = x * 10 ** (g / 20)
    if b['who'] == 'bip': x = ff(x, BIPFX)
    if b.get('phone'): x = ff(x, 'highpass=f=260,lowpass=f=3600,equalizer=f=1800:t=q:w=1.0:g=4,aecho=0.8:0.4:35:0.18')
    n0 = len(x)
    if b.get('think'): x = ff(np.concatenate([x, np.zeros(int(SR * 0.5), np.float32)]), b.get('af') or 'aecho=0.8:0.55:90|200:0.4|0.22,volume=-2.5dB')
    elif b.get('af'): x = ff(np.concatenate([x, np.zeros(int(SR * 0.4), np.float32)]), b['af'])
    t0 = t + b.get('gap', 0.22); t1 = t0 + n0 / SR; times[b['id']] = dict(t0=round(t0, 3), t1=round(t1, 3)); clips.append((b, t0, x)); t = t1
DUR = round(t + float(B.get('tail', 1.8)), 3); L = int(SR * (DUR + 1))
stems = {}
for b, t0, x in clips:
    tk = stems.setdefault(b['who'], np.zeros(L, np.float32)); a = int(t0 * SR); e = min(L, a + len(x)); tk[a:e] += x[:e - a]
def wav(name, x, ch=1):
    f = f'{OUT}/{name}.wav'; subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-', f], input=x.astype(np.float32).tobytes(), check=True); return f
for w, x in stems.items(): wav(f'vo_{w}', x)
vo = sum(stems.values()); wav('vo_all', vo)

# ---- sound effects (real CC0 library for v2 / sfxMode:"real", plus synthesised fallbacks, seeded) ----
USE_REAL = (B.get('sfxMode') == 'real') or (B.get('sfxMode') != 'synth' and B.get('rules') == 2)
SYNTH_BUILTINS = {
    'riser', 'bloom', 'hum', 'pop', 'ting', 'kaching', 'buzz', 'ring', 'fizz', 'zap',
    'thud', 'whoosh', 'slide', 'clink', 'lock', 'chime', 'click', 'whirr', 'cheer',
    'breath', 'heartbeat', 'stomach', 'bite', 'growl', 'crack', 'glass_crash',
    'footsteps', 'sniff', 'creak', 'street', 'rewind', 'tick', 'tingting', 'alarm_low',
    'rooster', 'rocket', 'boom', 'sting', 'step', 'murmur', 'wind', 'screech', 'engine',
    'siren', 'horn', 'shutter',
}
R = np.random.default_rng(B.get('seed', 12)); tt = lambda d: np.arange(int(d * SR)) / SR
def env(n, a=0.005, r=0.3): x = np.ones(n); na = max(1, int(a * SR)); x[:na] = np.linspace(0, 1, na); return x * np.exp(-np.arange(n) / SR / r)
def lp(x, f): return ff(x, f'lowpass=f={f}')
_STEP = {}
def SFX(name, dur=None, o=None):
    if not (o or {}).get('synth') and (USE_REAL or name not in SYNTH_BUILTINS) and sfx_lib.has_sfx(name):
        return sfx_lib.load_sfx(name, dur=dur, o=o, rng=R, sr=SR)
    if name == 'riser': d = dur or 1.4; n = tt(d); x = R.normal(0, 0.3, len(n)) * (n / d) ** 2; x = ff(x, 'highpass=f=500,lowpass=f=5000') * 0.8 + 0.25 * np.sin(2 * np.pi * (180 * n + 260 * n * n / d)) * (n / d) ** 1.5; return x * 0.5
    if name == 'bloom': d = dur or 2.2; n = tt(d); x = sum(a * np.sin(2 * np.pi * f * n) * np.exp(-n / r) for f, a, r in ((523.25, .5, .9), (783.99, .35, .8), (1046.5, .3, .7), (1318.5, .2, .6), (1568, .16, .5), (2093, .1, .4))); x += 0.5 * lp(R.normal(0, 0.4, len(n)) * np.exp(-n / 0.25), 1800); x += 0.6 * np.sin(2 * np.pi * 62 * n) * np.exp(-n / 0.35); return x * 0.5
    if name == 'hum': d = dur or 2.0; n = tt(d); x = (np.sin(2 * np.pi * 220 * n) + 0.5 * np.sin(2 * np.pi * 329.6 * n) + 0.3 * np.sin(2 * np.pi * 440.5 * n)) * (0.6 + 0.4 * np.sin(2 * np.pi * 5 * n)); e = np.minimum(1, n / 0.3) * np.minimum(1, (d - n) / 0.4); return x * e * 0.09
    if name == 'pop': n = tt(0.22); return np.sin(2 * np.pi * (420 + 900 * np.exp(-n / 0.03)) * n) * np.exp(-n / 0.05) * 0.5
    if name == 'ting': n = tt(1.1); return (np.sin(2 * np.pi * 1318.5 * n) + 0.6 * np.sin(2 * np.pi * 1975.5 * n) + 0.3 * np.sin(2 * np.pi * 2637 * n)) * np.exp(-n / 0.28) * 0.32
    if name == 'kaching': a = SFX('ting'); n = tt(1.3); b = (np.sin(2 * np.pi * 1568 * n) + 0.5 * np.sin(2 * np.pi * 2093 * n)) * np.exp(-n / 0.35) * 0.3; x = np.zeros(int(1.5 * SR)); x[:len(a)] += a; o = int(0.11 * SR); x[o:o + len(b)] += b[:len(x) - o]; return x
    if name == 'buzz': d = dur or 1.6; n = tt(d); gate = ((n % 0.8) < 0.5).astype(float); x = np.sign(np.sin(2 * np.pi * 150 * n)) * 0.12 * gate; x = lp(x, 900) + 0.03 * lp(R.normal(0, 1, len(n)) * gate, 2500); return x
    if name == 'ring': d = dur or 1.6; n = tt(d); gate = ((n % 0.8) < 0.5).astype(float) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 14 * n))); return (np.sin(2 * np.pi * 1760 * n) + 0.6 * np.sin(2 * np.pi * 2217 * n)) * gate * 0.1
    if name == 'fizz': d = dur or 0.9; n = tt(d); x = R.normal(0, 0.3, len(n)) * np.exp(-n / 0.25); x = ff(x, 'highpass=f=1800') + 0.4 * np.sin(2 * np.pi * (520 - 380 * n / d) * n) * np.exp(-n / 0.3); return x * 0.45
    if name == 'zap': n = tt(0.28); x = np.sign(np.sin(2 * np.pi * (90 + 700 * R.random(len(n)).cumsum() / len(n)) * n)) * (R.random(len(n)) > 0.35) * np.exp(-n / 0.09); return lp(x, 4200) * 0.22
    if name == 'thud': n = tt(0.5); return np.sin(2 * np.pi * (140 * np.exp(-n / 0.06) + 48) * n) * np.exp(-n / 0.11) * 0.8 + 0.2 * lp(R.normal(0, 1, len(n)) * np.exp(-n / 0.02), 1500)
    if name == 'whoosh': d = dur or 0.5; n = tt(d); x = R.normal(0, 0.4, len(n)) * np.sin(np.pi * n / d) ** 2; return ff(x, 'highpass=f=300,lowpass=f=3200') * 0.6
    if name == 'slide': d = dur or 0.6; n = tt(d); x = R.normal(0, 0.3, len(n)) * np.sin(np.pi * n / d); return ff(x, 'highpass=f=900,lowpass=f=5200') * 0.25
    if name == 'clink': n = tt(0.5); return (np.sin(2 * np.pi * 2400 * n) + 0.5 * np.sin(2 * np.pi * 3650 * n)) * np.exp(-n / 0.08) * 0.22
    if name == 'lock': a = SFX('thud') * 0.5; n = tt(0.25); c = (np.sin(2 * np.pi * 900 * n) + np.sin(2 * np.pi * 1370 * n)) * np.exp(-n / 0.03) * 0.3; x = np.zeros(int(0.6 * SR)); x[:len(c)] += c; x[int(0.05 * SR):int(0.05 * SR) + len(a)] += a[:len(x) - int(0.05 * SR)]; return x
    if name == 'chime': n = tt(1.6); return sum(np.concatenate([np.zeros(int(i * 0.09 * SR)), np.sin(2 * np.pi * f * n) * np.exp(-n / 0.4)])[:len(n)] for i, f in enumerate((1046.5, 1318.5, 1568, 2093))) * 0.16
    # GOAT Beef Ep 4 (13/11): the desk goal counter and the pub TV
    if name == 'click':   # a mechanical tally counter: a sharp tick, a small metal ping, a low thunk
        n = tt(0.14); x = ff(R.normal(0, 0.5, len(n)) * np.exp(-n / 0.004), 'highpass=f=1500') * 0.9 + np.sin(2 * np.pi * 2300 * n) * np.exp(-n / 0.018) * 0.25 + np.sin(2 * np.pi * 180 * n) * np.exp(-n / 0.02) * 0.3; return x * 0.6
    if name == 'whirr':   # the wheels spinning: a train of clicks that speeds up, over a soft ratchet noise (dur = length)
        d = dur or 0.6; n = tt(d); x = ff(R.normal(0, 0.12, len(n)), 'bandpass=f=900:w=600') * np.sin(np.pi * np.minimum(1, n / d)) ** 0.5; c = SFX('click') * 0.45; tc = 0.0
        while tc < d - 0.05: a = int(tc * SR); e = min(len(x), a + len(c)); x[a:e] += c[:e - a]; tc += 0.055 - 0.032 * (tc / d)
        return x
    if name == 'cheer':   # a pub-TV crowd roar: band-limited noise in a few swelling layers plus two rising whoops (dur = length)
        d = dur or 1.4; n = tt(d); env = np.minimum(1, n / 0.15) * np.minimum(1, (d - n) / 0.45); x = np.zeros(len(n))
        for k in range(4): x += ff(R.normal(0, 0.25, len(n)), f'bandpass=f={[420, 700, 1100, 1700][k]}:w={[300, 450, 700, 900][k]}') * (0.75 + 0.25 * np.sin(2 * np.pi * (0.7 + 0.4 * k) * n + k))
        for t0, f0 in ((0.12, 520), (0.35, 640)): m = (n >= t0) & (n < t0 + 0.5); u = (n[m] - t0) / 0.5; x[m] += np.sin(2 * np.pi * np.cumsum(f0 + 260 * u) / SR) * np.sin(np.pi * u) * 0.08
        return x * env * 0.55
    # Zombie / Ngày-series additions (13/11). Options come from the sfx entry (o): rise, n, far. All seeded through R, all optional dur.
    if name == 'breath':   # panting: ~3 breaths a second, each an in-out of band-passed noise; loops over dur
        d = dur or 2.0; n = tt(d); ph = (n * 3.0) % 1.0; sw = np.where(ph < 0.45, np.sin(np.pi * ph / 0.45) ** 2, 0.7 * np.sin(np.pi * (ph - 0.45) / 0.55) ** 2); x = ff(R.normal(0, 0.5, len(n)), 'bandpass=f=1400:w=1800:t=h') * sw * (0.85 + 0.15 * np.sin(2 * np.pi * 0.7 * n)); return x * np.minimum(1, n / 0.1) * np.minimum(1, (d - n) / 0.1) * 1.2
    if name == 'heartbeat':   # lub-dub at 110 bpm over dur
        d = dur or 2.0; x = np.zeros(int(d * SR)); per = 60 / 110; tb = 0.0
        while tb < d:
            for off, a in ((0.0, 1.0), (0.17, 0.7)):
                m = tt(0.16); b = np.sin(2 * np.pi * (62 * np.exp(-m / 0.05) + 40) * m) * np.exp(-m / 0.05) * a * 0.9; i = int((tb + off) * SR); e = min(len(x), i + len(b))
                if i < len(x): x[i:e] += b[:e - i]
            tb += per
        return x * 0.8
    if name == 'stomach':   # a growling gurgle, ~0.9 s: low wobbling pitch + bubbly band noise
        d = dur or 0.9; n = tt(d); f = 70 + 35 * np.sin(2 * np.pi * 2.3 * n) + 25 * np.sin(2 * np.pi * 6.1 * n + 1); ph = np.cumsum(f) / SR; x = np.sign(np.sin(2 * np.pi * ph)) * 0.25 + np.sin(2 * np.pi * ph) * 0.4; x = lp(x, 400) + 0.5 * ff(R.normal(0, 0.3, len(n)) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * n + 2)) ** 2, 'bandpass=f=350:w=300:t=h'); return x * np.sin(np.pi * n / d) ** 0.7 * 0.7
    if name == 'bite':   # wet crunch: a few short noise crackles + a soft low squelch
        d = 0.4; n = tt(d); x = np.zeros(len(n))
        for t0, a in ((0.0, 1.0), (0.05, 0.7), (0.11, 0.8), (0.19, 0.45)): m = tt(0.06); c = ff(R.normal(0, 1, len(m)) * np.exp(-m / 0.012), 'highpass=f=900,lowpass=f=6000') * a; i = int(t0 * SR); x[i:i + len(m)] += c
        sq = ff(R.normal(0, 0.4, len(n)), 'bandpass=f=420:w=250:t=h') * np.exp(-n / 0.14) * np.minimum(1, n / 0.05); return (x * 0.6 + sq * 0.7 + np.sin(2 * np.pi * (110 * np.exp(-n / 0.05) + 55) * n) * np.exp(-n / 0.07) * 0.4) * 0.8
    if name == 'growl':   # low horde bed: a few detuned buzzing voices + throat noise; o.rise (0..1+) swells it toward the end
        d = dur or 3.0; n = tt(d); rise = (o or {}).get('rise', 0.0); x = np.zeros(len(n))
        for k, f0 in enumerate((58, 71, 83, 97)): ph = np.cumsum(f0 * (1 + 0.06 * np.sin(2 * np.pi * (0.5 + 0.23 * k) * n + k))) / SR; x += np.sign(np.sin(2 * np.pi * ph)) * (0.5 + 0.5 * np.sin(2 * np.pi * (6 + 1.3 * k) * n)) * 0.2
        x = lp(x, 700) + 0.35 * ff(R.normal(0, 0.5, len(n)), 'bandpass=f=500:w=500:t=h') * (0.6 + 0.4 * np.sin(2 * np.pi * 1.1 * n)); g = (0.35 + 0.65 * (n / d)) ** (1 + 2 * rise) if rise else np.ones(len(n)); return x * g * np.minimum(1, n / 0.3) * np.minimum(1, (d - n) / 0.3) * 0.7
    if name == 'crack':   # neck crack: three or four short dry clicks
        d = 0.5; x = np.zeros(int(d * SR))
        for t0, a in ((0.0, 1.0), (0.06, 0.6), (0.21, 0.9), (0.27, 0.5)): m = tt(0.03); c = ff(R.normal(0, 1, len(m)) * np.exp(-m / 0.004), 'highpass=f=1200,lowpass=f=7000') * a + np.sin(2 * np.pi * 320 * m) * np.exp(-m / 0.01) * a * 0.3; i = int(t0 * SR); x[i:i + len(m)] += c
        return x * 0.45
    if name == 'glass_crash':   # a broken-glass burst, then a scatter of tinkles
        d = dur or 1.6; n = tt(d); x = ff(R.normal(0, 1, len(n)) * np.exp(-n / 0.06), 'highpass=f=1500') * 0.8 + 0.4 * lp(R.normal(0, 1, len(n)) * np.exp(-n / 0.02), 1200)
        for _ in range(26): t0 = 0.05 + R.random() * (d - 0.4) * R.random(); f0 = 2800 + R.random() * 4200; m = tt(0.25); c = np.sin(2 * np.pi * f0 * m) * np.exp(-m / (0.03 + 0.05 * R.random())) * (0.25 * np.exp(-t0 / 0.5)); i = int(t0 * SR); e = min(len(x), i + len(m)); x[i:e] += c[:e - i]
        return x * 0.3
    if name == 'footsteps':   # running steps over dur; o.n = steps a second (default 3.2): a thump + a scuff each, slightly uneven
        d = dur or 3.0; sp = (o or {}).get('n', 3.2); x = np.zeros(int(d * SR)); ts = 0.0; k = 0
        while ts < d - 0.1: m = tt(0.14); a = 0.8 + 0.2 * R.random() + (0.1 if k % 2 else 0); s = (np.sin(2 * np.pi * (95 * np.exp(-m / 0.03) + 55) * m) * np.exp(-m / 0.035) * 0.8 + ff(R.normal(0, 0.5, len(m)) * np.exp(-m / 0.02), 'highpass=f=400,lowpass=f=2500') * 0.45) * a; i = int(ts * SR); e = min(len(x), i + len(m)); x[i:e] += s[:e - i]; ts += (1 / sp) * (1 + 0.06 * (R.random() - 0.5)); k += 1
        return x * 0.7
    if name == 'sniff':   # two quick nose sniffs: short rising-then-falling band noise
        d = 0.5; x = np.zeros(int(d * SR))
        for t0 in (0.0, 0.2): m = tt(0.16); x[int(t0 * SR):int(t0 * SR) + len(m)] += ff(R.normal(0, 0.6, len(m)), 'bandpass=f=2600:w=2200:t=h') * np.sin(np.pi * m / 0.16) ** 1.5
        return x * 1.2
    if name == 'creak':   # an iron gate: a slow squeal with a wobbling pitch and some rasp
        d = dur or 1.4; n = tt(d); f = 520 + 180 * np.sin(2 * np.pi * 0.9 * n) + 90 * np.sin(2 * np.pi * 7.3 * n) + 140 * (n / d); ph = np.cumsum(f) / SR; x = (np.sin(2 * np.pi * ph) + 0.5 * np.sin(4 * np.pi * ph) + 0.3 * np.sign(np.sin(2 * np.pi * ph * 1.01))) * (0.7 + 0.3 * np.sin(2 * np.pi * 13 * n)); x = lp(x, 3600) + 0.1 * ff(R.normal(0, 1, len(n)), 'bandpass=f=1800:w=1200:t=h'); return x * np.sin(np.pi * n / d) ** 0.6 * 0.22
    if name == 'street':   # a quiet night street bed over dur: low rumble, faint hiss, a far car swell and an occasional insect-like chirp
        d = dur or 4.0; n = tt(d); x = lp(R.normal(0, 0.3, len(n)), 250) * 0.8 + 0.06 * ff(R.normal(0, 0.3, len(n)), 'bandpass=f=3000:w=2500:t=h') + 0.05 * np.sin(2 * np.pi * 50 * n); x += 0.12 * lp(R.normal(0, 0.5, len(n)), 450) * np.exp(-((n - d * 0.6) / (d * 0.18)) ** 2)
        for t0 in np.arange(0.4, d - 0.3, 0.9): m = tt(0.05); i = int((t0 + 0.2 * R.random()) * SR); x[i:i + len(m)] += np.sin(2 * np.pi * 4300 * m) * np.sin(np.pi * m / 0.05) * 0.015
        return x * np.minimum(1, n / 0.3) * np.minimum(1, (d - n) / 0.3) * 0.7
    if name == 'rewind':   # a tape rewind: a fast falling-then-wobbling squeal over whirring noise
        d = dur or 1.0; n = tt(d); f = 3400 - 1800 * (n / d) + 220 * np.sin(2 * np.pi * 19 * n); ph = np.cumsum(f) / SR; x = np.sin(2 * np.pi * ph) * 0.3 + 0.35 * ff(R.normal(0, 0.5, len(n)), 'bandpass=f=2200:w=2000:t=h') * (0.7 + 0.3 * np.sin(2 * np.pi * 31 * n)); return x * np.minimum(1, n / 0.04) * np.minimum(1, (d - n) / 0.08) * 0.5
    if name == 'tick':   # a clock tick-tock: two soft clicks (the second a touch lower), once a second; loops over dur (default one second)
        d = dur or 1.0; x = np.zeros(int(d * SR)); m = tt(0.05)
        for k in range(int(np.ceil(d / 0.5))): f0 = 2600 if k % 2 == 0 else 2100; c = (np.sin(2 * np.pi * f0 * m) * np.exp(-m / 0.006) + 0.5 * ff(R.normal(0, 0.5, len(m)) * np.exp(-m / 0.003), 'highpass=f=2000')) * 0.5; i = int(k * 0.5 * SR); e = min(len(x), i + len(m)); x[i:e] += c[:e - i]
        return x * 0.6
    if name == 'tingting':   # the Vietnamese bank-app chime: two bell notes, the second higher; o.far = quieter and low-passed
        n = tt(1.2); a = (np.sin(2 * np.pi * 1318.5 * n) + 0.5 * np.sin(2 * np.pi * 2637 * n)) * np.exp(-n / 0.22); b = (np.sin(2 * np.pi * 1760 * n) + 0.5 * np.sin(2 * np.pi * 3520 * n)) * np.exp(-n / 0.3); x = np.zeros(int(1.5 * SR)); x[:len(a)] += a; i = int(0.28 * SR); x[i:i + len(b)] += b; x *= 0.3
        return lp(x, 1800) * 0.4 if (o or {}).get('far') else x
    if name == 'alarm_low':   # a harsh error buzzer: two descending square-ish blats
        d = dur or 0.9; x = np.zeros(int(d * SR)); m = tt(0.32)
        for t0, f0 in ((0.0, 190), (0.38, 150)): ph = np.cumsum(f0 * (1 - 0.1 * m / 0.32)) / SR; c = (np.sign(np.sin(2 * np.pi * ph)) + 0.5 * np.sign(np.sin(2 * np.pi * ph * 1.5))) * np.minimum(1, m / 0.01) * np.minimum(1, (0.32 - m) / 0.03); i = int(t0 * SR); e = min(len(x), i + len(m)); x[i:e] += lp(c, 2200)[:e - i]
        return x * 0.22
    # 14/11 additions: accents for `impact` beats, one-shot footsteps for foley, room-tone beds
    # Ngày 14 (14/11): a rooster crow (cock-a-doodle-doo, dawn cue) and a firework rocket whistle; new names only, nothing else changes
    if name == 'rooster':
        segs = [(0.11, 560, 640), (0.09, 660, 700), (0.11, 720, 760), (0.62, 800, 540)]; out = []
        for d, f0, f1 in segs:
            n = tt(d); f = f0 + (f1 - f0) * (n / d) ** 1.4 + 9 * np.sin(2 * np.pi * 23 * n); ph = 2 * np.pi * np.cumsum(f) / SR
            x = sum(a * np.sin(k * ph) for k, a in ((1, 1.0), (2, 0.7), (3, 0.45), (4, 0.3), (5, 0.18), (6, 0.1))); x = x * (1 + 0.35 * R.normal(0, 1, len(n)))
            e = np.minimum(1, n / 0.015) * np.minimum(1, (d - n) / 0.04); out += [x * e, np.zeros(int(0.03 * SR))]
        return ff(np.concatenate(out), 'highpass=f=450,lowpass=f=4200') * 0.16
    if name == 'rocket':
        d = dur or 0.9; n = tt(d); f = 900 + 1700 * (n / d) ** 1.3 + 30 * np.sin(2 * np.pi * 11 * n); ph = 2 * np.pi * np.cumsum(f) / SR
        e = np.minimum(1, n / 0.08) * np.minimum(1, (d - n) / 0.12); x = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * 0.22 + ff(R.normal(0, 0.25, len(n)), 'highpass=f=2500') * 0.5
        return x * e
    if name == 'boom':   # a deep sub hit with a long tail (dur = tail length): the "heavy / huge" accent
        d = dur or 1.6; n = tt(d); f = 36 + 60 * np.exp(-n / 0.09); x = np.tanh(1.4 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-n / 0.55) * 0.8 + 0.35 * lp(R.normal(0, 1, len(n)) * np.exp(-n / 0.12), 220)
        return x * np.minimum(1, n / 0.004) * 0.9
    if name == 'sting':   # a short dissonant stab (minor second + tritone, bright): the "scare" accent
        n = tt(0.7); x = sum(np.sign(np.sin(2 * np.pi * f * n)) for f in (233.1, 246.9, 329.6, 466.2)) / 4; x = lp(x, 2600) * np.exp(-n / 0.2) + 0.5 * ff(R.normal(0, 1, len(n)) * np.exp(-n / 0.03), 'highpass=f=1500')
        return x * np.minimum(1, n / 0.006) * 0.3
    if name == 'step':   # ONE footstep (foley): o.surf = pavement | tile | wood, o.a = amplitude 0..1.2. 8 variants per surface are synthesised once and reused (a chase has hundreds of steps)
        kk = ((o or {}).get('surf', 'pavement'), int(R.integers(0, 8)))
        if kk in _STEP: return _STEP[kk] * (o or {}).get('a', 1.0)
        P = {'pavement': (95, 55, 400, 2500), 'tile': (120, 70, 800, 4500), 'wood': (150, 95, 300, 2000)}.get((o or {}).get('surf', 'pavement'), (95, 55, 400, 2500)); m = tt(0.16)
        _STEP[kk] = (np.sin(2 * np.pi * (P[0] * np.exp(-m / 0.03) + P[1]) * m) * np.exp(-m / 0.035) * 0.8 + ff(R.normal(0, 0.5, len(m)) * np.exp(-m / 0.02), f'highpass=f={P[2]},lowpass=f={P[3]}') * 0.45) * (0.9 + 0.2 * R.random()) * 0.7; return _STEP[kk] * (o or {}).get('a', 1.0)
    if name == 'murmur':   # a quiet room-tone bed of voices and glasses (pub, market): band noise with slow swells over dur
        d = dur or 4.0; n = tt(d); x = ff(R.normal(0, 1, len(n)), 'bandpass=f=650:w=700:t=h') * (0.75 + 0.25 * np.sin(2 * np.pi * 0.31 * n + 1)) + 0.5 * ff(R.normal(0, 1, len(n)), 'bandpass=f=1800:w=1500:t=h') * (0.5 + 0.5 * np.sin(2 * np.pi * 0.17 * n)) ** 2 + 0.5 * lp(R.normal(0, 1, len(n)), 140)
        return x * np.minimum(1, n / 0.3) * np.minimum(1, (d - n) / 0.3) * 0.12
    # 19/11 car-chase additions (gta6): wind, screech, engine, siren, horn, shutter. Each uses its OWN fixed-seed generator (never R), so no older effect's noise stream moves.
    if name == 'wind':   # the rush of a fall: three noise bands cross-fading upward (centre rises), a slow flutter; 0.1 s in, 0.3 s out (dur = length)
        d = dur or 3.0; n = tt(d); g = np.random.default_rng(1901); u = n / d; x = np.zeros(len(n))
        for f0, w0, c in ((420, 500, 0.0), (900, 800, 0.5), (1800, 1500, 1.0)): x += ff(g.normal(0, 0.5, len(n)), f'bandpass=f={f0}:w={w0}:t=h') * np.maximum(0, 1 - np.abs(u - c) / 0.55)
        x = x * (0.82 + 0.18 * np.sin(2 * np.pi * 1.7 * n) * np.sin(2 * np.pi * 0.43 * n + 1)); return x * np.minimum(1, n / 0.1) * np.minimum(1, (d - n) / 0.3) * 1.3
    if name == 'screech':   # tyre squeal: a narrow noisy tone near 1.8 kHz sliding down to 1.2 kHz, rough amplitude, quick attack, tail-off (dur about 0.5-0.7 s)
        d = dur or 0.6; n = tt(d); g = np.random.default_rng(1902); u = n / d; f = 1800 - 600 * u ** 0.8 + 25 * np.sin(2 * np.pi * 9 * n); ph = 2 * np.pi * np.cumsum(f) / SR
        x = np.sin(ph) + 0.4 * np.sin(2 * ph + 0.7) + 0.15 * np.sin(3 * ph); x = x * (0.75 + 0.25 * np.sin(2 * np.pi * 61 * n) * np.sin(2 * np.pi * 37 * n + 2)) + 0.5 * ff(g.normal(0, 0.5, len(n)), 'bandpass=f=1500:w=500:t=h')
        x = ff(x, 'highpass=f=700,lowpass=f=3800'); return x * np.minimum(1, n / 0.02) * np.minimum(1, (d - n) / (0.4 * d)) ** 1.5 * 0.32
    if name == 'engine':   # an idling-then-revving rumble under dialogue: sawtooth harmonics from ~70 Hz (o.rise 0..1: revs climb to ~140 Hz), slow rpm wobble, low-passed at 380 Hz (dur = length)
        d = dur or 3.0; n = tt(d); rise = (o or {}).get('rise', 0.0); f0 = (70 + 70 * rise * (n / d) ** 1.2) * (1 + 0.03 * np.sin(2 * np.pi * 3.1 * n) + 0.02 * np.sin(2 * np.pi * 7.3 * n + 1)); ph = 2 * np.pi * np.cumsum(f0) / SR
        x = sum(np.sin(k * ph) / k for k in range(1, 9)); x = x * (0.82 + 0.18 * np.cos(ph / 2)); x = lp(ff(x, 'highpass=f=40,lowpass=f=380'), 400)
        return x * np.minimum(1, n / 0.15) * np.minimum(1, (d - n) / 0.25) * 0.22
    if name == 'siren':   # a friendly two-tone wail: the pitch sweeps 650 -> 1300 Hz and back, 0.7 s each way; o.far = quieter and low-passed (dur = length)
        d = dur or 3.0; n = tt(d); f = 975 - 325 * np.cos(2 * np.pi * n / 1.4); ph = 2 * np.pi * np.cumsum(f) / SR; x = np.sin(ph) + 0.28 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
        x = ff(x, 'highpass=f=450,lowpass=f=2800'); x = x * np.minimum(1, n / 0.1) * np.minimum(1, (d - n) / 0.2) * 0.3
        return lp(x, 1500) * 0.5 if (o or {}).get('far') else x
    if name == 'horn':   # a car horn held: two buzzy tones a minor third apart (420 + 500 Hz), 20 ms attack, 80 ms release (dur = length)
        d = dur or 0.8; n = tt(d); x = np.zeros(len(n))
        for f0 in (420, 500): x += sum(np.sin(2 * np.pi * f0 * k * n + 0.3 * k) / k ** 1.3 for k in (1, 3, 5, 7)) + 0.35 * np.sin(2 * np.pi * f0 * 2 * n)
        x = x * (1 + 0.12 * np.sin(2 * np.pi * 120 * n)); x = lp(x, 3200); return x * np.minimum(1, n / 0.02) * np.minimum(1, (d - n) / 0.08) * 0.22
    if name == 'shutter':   # a camera shutter and flash pop, about 0.18 s: a sharp click, a softer second click 60 ms later, a short bright "pff"
        g = np.random.default_rng(1906); x = np.zeros(int(0.18 * SR))
        for t0, a, f0 in ((0.0, 1.0, 2600), (0.06, 0.55, 2000)): m = tt(0.05); c = (ff(g.normal(0, 1, len(m)) * np.exp(-m / 0.003), 'highpass=f=1500') * 0.8 + np.sin(2 * np.pi * f0 * m) * np.exp(-m / 0.008) * 0.4 + np.sin(2 * np.pi * 220 * m) * np.exp(-m / 0.012) * 0.25) * a; i = int(t0 * SR); x[i:i + len(m)] += c
        m = tt(0.11); i = int(0.07 * SR); x[i:i + len(m)] += ff(g.normal(0, 1, len(m)) * np.exp(-m / 0.035), 'highpass=f=4000') * 0.3 * np.minimum(1, m / 0.004)
        return x * 0.35
    raise SystemExit('unknown sfx ' + name)
def when(ref):
    if isinstance(ref, (int, float)): return float(ref)
    i, _, e = ref.partition('.'); return times[i]['t1' if e == 'end' else 't0']

# =====================================================================================================================================
# 14/11: picture facts (cuts, sets), the effect list, foley, accents, room tone. Everything marked NEW is skipped by --legacy-mix.
# =====================================================================================================================================
def write_times():   # the episode imports this file, and cuts.cjs / events.cjs import the episode: write it before anything that reads the picture
    d = dict(dur=DUR, lines=times)
    tension = [[times[b['id']]['t0'], b['tension']] for b in B['beats'] if 'tension' in b and b['id'] in times]; impacts = [round(times[b['id']]['t0'] + b.get('impactOff', 0), 3) for b in B['beats'] if b.get('impact') and b['id'] in times]
    if tension: d['tension'] = tension   # [[t_seconds, value_0_to_10], ...] one point per beat start, only beats that carry a tension value
    if impacts: d['impacts'] = impacts   # start of every beat marked "impact": true (+ its impactOff)
    json.dump(d, open(f'{OUT}/times.json', 'w'), indent=1)
    open(os.path.splitext(path)[0].replace('.beats', '') + '.times.js', 'w').write('// written by tools/voice.py: do not edit\nexport default ' + json.dumps(d) + ';\n')
    return tension, impacts
TENSION_PTS, IMPACT_T = write_times()

CUTS, HITS, PLACES, PACK, SETNAME = None, [], [], None, None
epf = f'{ROOT}/episodes/{ID}.js'
if not LEGACY and os.path.exists(epf):
    r = subprocess.run(['node', f'{ROOT}/tools/cuts.cjs', epf], capture_output=True, text=True)
    if r.returncode == 0:
        try: j = json.loads(r.stdout); CUTS, HITS, PLACES, PACK, SETNAME = [c for c in j['cuts'] if c > 0.01], j.get('hits', []), j.get('places', []), j.get('pack'), j.get('set')
        except Exception as e: print('cuts.cjs output not readable:', e)
    else: print('cuts.cjs failed (no snapping, room tone by header only):', r.stderr.strip()[-200:])
elif not LEGACY: print(f'no episodes/{ID}.js: effects and stingers are not snapped to cuts, room tone and foley surface come from the beats header')
def snap_cut(t, tol=SNAP_TOL):   # nearest cut within tol seconds (hit-stops count as cuts)
    c = [x for x in (CUTS or []) + HITS if abs(x - t) <= tol]; return (min(c, key=lambda x: abs(x - t)), True) if c else (t, False)
def place_at(t):   # which set is on screen at time t
    p = [x['place'] for x in PLACES if x['t'] <= t + 1e-6]; return p[-1] if p else (SETNAME or ('pub' if PACK == 'goat' else 'street'))

# ---- foley from the picture: out/<id>/events.json (node tools/events.cjs episodes/<id>.js), asked for by "foley": "auto" in the header or on a beat ----
EV = None; foley_scopes = []
if not LEGACY and (B.get('foley') == 'auto' or any(b.get('foley') == 'auto' for b in B['beats'])):
    if B.get('foley') == 'auto': foley_scopes = [(0.0, DUR)]
    foley_scopes += [(times[b['id']]['t0'], times[b['id']]['t1']) for b in B['beats'] if b.get('foley') == 'auto' and b['id'] in times]
    foley_off = [(times[b['id']]['t0'], times[b['id']]['t1']) for b in B['beats'] if b.get('foley') == 'off' and b['id'] in times]
    evf = f'{ROOT}/out/{ID}/events.json'
    if os.path.exists(evf):
        EV = json.load(open(evf))
        if abs(EV.get('dur', DUR) - DUR) > 0.05: print(f"FOLEY WARNING: events.json is for a {EV.get('dur')} s film, this build is {DUR} s: run  node tools/events.cjs episodes/{ID}.js  again"); EV = None
    else: print(f'FOLEY: "foley": "auto" asked but {evf} does not exist: run  node tools/events.cjs episodes/{ID}.js  and build again (no foley this pass)')
    in_scope = lambda t: any(a - 1e-6 <= t <= e + 1e-6 for a, e in foley_scopes) and not any(a <= t <= e for a, e in foley_off)

FX = []   # every effect as placed: dict(name, t, x (mono, float32, before the 0.85 bus gain), src)
def put_fx(name, t, gain=0.0, dur=None, o=None, src='beats'):
    x = SFX(name, dur, o) * 10 ** (gain / 20); FX.append(dict(name=name, t=float(t), x=x.astype(np.float32), src=src, gain=gain)); return FX[-1]
snapped = []; steps_cut = []
for s in B.get('sfx', []):
    t = when(s['ref']) + s.get('off', 0)
    if not LEGACY and s.get('snap') == 'cut':
        t2, ok = snap_cut(t)
        if ok and abs(t2 - t) > 1e-6: snapped.append((s['name'], t, t2))
        t = t2
    if EV and s['name'] == 'footsteps' and any(in_scope(f['t']) and t - 0.05 <= f['t'] <= t + (s.get('dur') or 3.0) + 0.05 for f in EV.get('feet', [])): steps_cut.append((t, s.get('dur') or 3.0)); continue   # foley replaces the rate-based steps
    put_fx(s['name'], t, s.get('gain', 0), s.get('dur'), s)
auth_n = len(FX)
R = np.random.default_rng(int(B.get('seed', 12)) + 7919)   # everything below draws from its own stream: the authored effects above sound the same as before
ACC_NAMES = ('sting', 'boom', 'hit', 'thud', 'bite', 'crack', 'pop', 'ting', 'stamp', 'ding_idea', 'msg_in', 'voice_note')
def near_accent(t, w): return any(f['name'] in ACC_NAMES and abs(f['t'] - t) <= w for f in FX)
foley_n = {}
if EV:
    SURF = {'street': 'pavement', 'stall': 'pavement', 'zombie': 'pavement', 'market': 'tile', 'pub': 'wood', 'bar': 'wood'}
    for f in EV.get('feet', []):
        if not in_scope(f['t']): continue
        loud = float(f.get('loud', 0.6)); g = -10 + 8 * loud + min(9.0, 3 * np.log2(max(1, f.get('n', 1)))) - (0 if f.get('vis', True) else 6)
        put_fx('step', f['t'], g, None, {'surf': SURF.get(f.get('place') or place_at(f['t']), 'pavement'), 'a': 1.0}, 'foley:step'); foley_n['step'] = foley_n.get('step', 0) + 1
    ACT = {'bite': ('bite', -4.0), 'trip': ('thud', -8.0), 'fall': ('thud', -3.0), 'pile': ('thud', -3.0), 'tackle': ('thud', -4.0), 'hit': ('thud', -3.0), 'slap': ('thud', -6.0), 'put': ('clink', -12.0), 'slide': ('slide', -9.0), 'drop': ('thud', -10.0)}   # event type -> (effect, gain dB); 'bitten' is the victim's reaction to the same bite: no sound of its own
    for a in sorted(EV.get('actions', []) + EV.get('props', []), key=lambda e: e['t']):
        if a['type'] not in ACT or not in_scope(a['t']) or near_accent(a['t'], 0.15): continue
        nm, g = ACT[a['type']]; put_fx(nm, a['t'], g + 6 * (float(a.get('loud', 0.7)) - 0.7), 0.5 if nm == 'slide' else None, None, 'foley:' + a['type']); foley_n[a['type']] = foley_n.get(a['type'], 0) + 1

# ---- accents for beats marked "impact": true that have none (kind from "impact": "heavy|huge|scare|light|bright" or from the beat's mood) ----
auto_acc = []
if not LEGACY:
    for b in B['beats']:
        if not b.get('impact') or b['id'] not in times: continue
        t = times[b['id']]['t0'] + b.get('impactOff', 0)
        if CUTS and b.get('impactSnap', True): t, _ = snap_cut(t, 0.06)
        if near_accent(t, 0.10): continue
        kind = b['impact'] if isinstance(b['impact'], str) and b['impact'] in IMPACT_FX else IMPACT_BY_MOOD.get(b.get('mood'), 'heavy'); nm, g = IMPACT_FX[kind]
        put_fx(nm, t, g + b.get('impactGain', 0), None, None, 'auto-accent'); auto_acc.append((b['id'], nm, t))

L = int(SR * (DUR + 1)); sfx = np.zeros(L, np.float32)
for f in FX:
    a = max(0, int(f['t'] * SR)); e = min(L, a + len(f['x'])); sfx[a:e] += f['x'][:e - a]
fs = wav('sfx', sfx)
json.dump(sorted([dict(name=f['name'], t=round(f['t'], 3), src=f['src']) for f in FX], key=lambda p: p['t']), open(f'{OUT}/sfx_placed.json', 'w'))
if not LEGACY: print(f'effects: {auth_n} authored, {len(snapped)} snapped to a cut, {len(auto_acc)} auto accents, foley {foley_n or "none"}' + (f', {len(steps_cut)} rate-based footsteps replaced' if steps_cut else ''))
for nm, t, t2 in snapped: print(f'  snap {nm}: {t:.3f} -> {t2:.3f} (cut)')
for i, nm, t in auto_acc: print(f'  auto accent for impact {i}: {nm} at {t:.3f}')

# ---- music (real CC0 tracks via audio_lib when `track`/`tracks`/`useLib`, else custom `file`, else score generator) ----
music = f'{OUT}/music.wav'
M = B.get('music') or {}
MF = M.get('file')   # an existing music file instead of the generator: trimmed / padded to the episode, faded out, set to music.lufs (default -26, the generator's level)
if M.get('tracks') or M.get('track') or (M.get('useLib') and M.get('mood')):
    sfx_lib.build_music(M, DUR, when, music, SR)
elif MF:
    fd = float(M.get('fade', 1.2)); src = os.path.expanduser(MF); src = src if os.path.isabs(src) else os.path.join(ROOT, src)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f"apad,atrim=0:{DUR},afade=t=out:st={max(0, DUR - fd):.3f}:d={fd},loudnorm=I={M.get('lufs', -26)}:TP=-6:LRA=11", '-ar', str(SR), '-ac', '2', music], check=True)
elif B.get('music'):
    seg_snap = []
    if M.get('mood') == 'zombie':   # 13/11: the horror-chase score (tools/score_zombie.py). Sections are named, placed by beat id, with their own parameters; rebuilt on every run (it is cheap)
        segs_i = [{**{k: v for k, v in s.items() if k not in ('ref', 'off', 'to_ref', 'to_off')}, 't': when(s['ref']) + s.get('off', 0), **({'to': when(s['to_ref']) + s.get('to_off', 0)} if 'to_ref' in s else {})} for s in M['segs']]
        if not LEGACY and CUTS:   # the score's own one-shots (sting, boom) land on the nearest cut within SNAP_TOL
            for s in segs_i:
                if s['seg'] in ('sting', 'boom', 'hit') and not s.get('nosnap'):
                    t2, ok = snap_cut(s['t'])
                    if ok and abs(t2 - s['t']) > 1e-6: seg_snap.append((s['seg'], s['t'], t2)); s['t'] = round(t2, 4)
        info = dict(duration=DUR, seed=M.get('seed', 57), segs=segs_i, lines={b['id']: times[b['id']] for b in lines})
    else:
        segs_i = [dict(seg=s.get('seg', 'R'), t=when(s['ref']) + s.get('off', 0)) for s in M['segs']]
        info = dict(duration=DUR, segs=segs_i, shots=[], receipts=[], metas=[])
    if not LEGACY:   # NEW: the generators may shape their density from the tension curve and put a stinger on every impact
        if TENSION_PTS: info['tension'] = TENSION_PTS
        if IMPACT_T: info['impacts'] = [snap_cut(t, 0.06)[0] if CUTS else t for t in IMPACT_T]
    prev_info = None
    try: prev_info = json.load(open(f'{OUT}/score_info.json'))
    except Exception: pass
    stale = (not LEGACY) and json.loads(json.dumps(info)) != prev_info
    if M.get('mood') == 'zombie' or not os.path.exists(music) or '--music' in sys.argv or stale or abs(float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', music], capture_output=True, text=True).stdout or 0) - DUR) > 0.6:
        json.dump(info, open(f'{OUT}/score_info.json', 'w'), ensure_ascii=False)
        if M.get('mood') == 'zombie': subprocess.run([f'{TD}/.venv/bin/python', f'{ROOT}/tools/score_zombie.py'], env={**os.environ, 'SCORE_INFO': f'{OUT}/score_info.json', 'SCORE_OUT': music, 'MUSIC_FADE': str(M.get('fade', 0.35))}, check=True)
        else: subprocess.run([f'{TD}/.venv/bin/python', f'{TD}/vo/score.py', '900', M.get('mood', 'ghost'), str(M.get('seed', 12))], env={**os.environ, 'SCORE_INFO': f'{OUT}/score_info.json', 'SCORE_OUT': music, 'MUSIC_FADE': str(M.get('fade', 1.2))}, check=True)
    for nm, t, t2 in seg_snap: print(f'  snap music {nm}: {t:.3f} -> {t2:.3f} (cut)')

# ---- remember this episode's own takes, so the next episode gets the same words for free ----
own0 = dict(own)
for b in lines:
    for ext in ('wav', 'mp3', 'flac'):
        if os.path.exists(f'{ROOT}/voice/{ID}/{b["id"]}.{ext}') and take_status(b) != 'stale': own[key(b.get('spk', b['who'].upper()), b['text'])] = f'voice/{ID}/{b["id"]}.{ext}'
if own != own0: json.dump(own, open(OWN, 'w'), ensure_ascii=False, indent=0)

def lufs(f): return float([l for l in subprocess.run(['ffmpeg', '-v', 'info', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr.splitlines() if l.strip().startswith('I:')][-1].split()[1])
def f32wav(f, x):   # x: (2, n) float
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', f], input=np.ascontiguousarray(x.T, dtype=np.float32).tobytes(), check=True)
def readf(f): return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).T.copy()
duck = ''.join(f",volume={d.get('k', 0.25)}:enable='between(t,{when(d['from']) + d.get('off0', 0):.2f},{when(d['to']) + d.get('off1', 0):.2f})'" for d in B.get('duck', []))
SCP = B.get('sc') or {}; MUSVOL = B.get('musicVol', 0.9); HAS_M = os.path.exists(music)
FINAL = lambda g: ['-af', f'volume={g:.2f}dB,aresample=192000,alimiter=limit=0.82:level=false:attack=3:release=60,aresample=48000']   # limited at 4x the sample rate, so the true peak (between samples) stays under about -1 dBTP

if LEGACY:
    # ---- the old mix, untouched: music ducked under the voice (and under the marked silences), effects on top, -14 LUFS ----
    ins = ['-i', f'{OUT}/vo_all.wav', '-i', fs] + (['-i', music] if HAS_M else [])
    fc = "[0:a]acompressor=threshold=0.1:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[vo1][vosc];[1:a]aresample=48000,volume=0.85[sfx];"
    fc += (f"[2:a]aresample=48000,volume={MUSVOL}{duck}[mus];[mus][vosc]sidechaincompress=threshold={SCP.get('threshold', 0.02)}:ratio={SCP.get('ratio', 8)}:attack=20:release=350:makeup=1[musd];[musd][sfx][vo1]amix=inputs=3:normalize=0" if HAS_M else "[vosc]anullsink;[sfx][vo1]amix=inputs=2:normalize=0") + ",alimiter=limit=0.89:level=false[a]"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc, '-map', '[a]', '-t', str(DUR), '-ar', '48000', f'{OUT}/mix_raw.wav'], check=True)
    g = -13.5 - lufs(f'{OUT}/mix_raw.wav')   # one measured gain to -14 LUFS (keeps the dynamics the mix was built with), then a safety limiter
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/mix_raw.wav', *FINAL(g), '-ar', '48000', f'{OUT}/mix.wav'], check=True)
    # stems of the old mix (so audiogate reads them like any other): the same graph with the three buses taken out separately, at the one gain the mix got
    fc2 = "[0:a]acompressor=threshold=0.1:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[vo1][vosc];[1:a]aresample=48000,volume=0.85[sfx];"
    outs = ['-map', '[vo1]', '-t', str(DUR), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', f'{OUT}/_v.wav', '-map', '[sfx]', '-t', str(DUR), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', f'{OUT}/_s.wav']
    if HAS_M: fc2 += f"[2:a]aresample=48000,volume={MUSVOL}{duck}[mus];[mus][vosc]sidechaincompress=threshold={SCP.get('threshold', 0.02)}:ratio={SCP.get('ratio', 8)}:attack=20:release=350:makeup=1[musd]"; outs += ['-map', '[musd]', '-t', str(DUR), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', f'{OUT}/_m.wav']
    else: fc2 += '[vosc]anullsink'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc2, *outs], check=True)
    gl = 10 ** (g / 20); v_, s_ = readf(f'{OUT}/_v.wav'), readf(f'{OUT}/_s.wav'); m_ = readf(f'{OUT}/_m.wav') if HAS_M else np.zeros_like(s_); n_ = min(v_.shape[1], s_.shape[1], m_.shape[1])
    f32wav(f'{OUT}/stem_voice.wav', v_[:, :n_] * gl); f32wav(f'{OUT}/stem_music.wav', m_[:, :n_] * gl); f32wav(f'{OUT}/stem_effects.wav', s_[:, :n_] * gl)
    for x in ('_v', '_s', '_m'):
        if os.path.exists(f'{OUT}/{x}.wav'): os.remove(f'{OUT}/{x}.wav')
else:
    # =================================================================================================================================
    # NEW MIX: voice, music and effects are separate buses; the voice is always on top (auto-duck), the music follows the tension curve,
    # a room tone sits under everything. Stereo throughout (the old mix folded the music to mono); stems written at the gain of the mix.
    # =================================================================================================================================
    import audiogate as AG
    tmp = f'{OUT}/_tmp'; os.makedirs(tmp, exist_ok=True)
    fc = "[0:a]acompressor=threshold=0.1:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[vo1][vosc];"
    outs = ['-map', '[vo1]', '-t', str(DUR), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', f'{tmp}/vo.wav']; ins = ['-i', f'{OUT}/vo_all.wav']
    if HAS_M:
        ins += ['-i', music]; fc += f"[1:a]aresample=48000,volume={MUSVOL}{duck}[mus];[mus][vosc]sidechaincompress=threshold={SCP.get('threshold', 0.02)}:ratio={SCP.get('ratio', 8)}:attack=20:release=350:makeup=1[musd]"; outs += ['-map', '[musd]', '-t', str(DUR), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', f'{tmp}/mus.wav']
    else: fc += '[vosc]anullsink'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc, *outs], check=True)
    N = int(round(DUR * SR)); fit = lambda x: np.pad(x, ((0, 0), (0, max(0, N - x.shape[1]))))[:, :N]
    vo = fit(readf(f'{tmp}/vo.wav')); ms = fit(readf(f'{tmp}/mus.wav')) if HAS_M else np.zeros((2, N), np.float32)
    for x in os.listdir(tmp): os.remove(f'{tmp}/{x}')
    os.rmdir(tmp)
    CR = 200; tc = np.arange(int(DUR * CR) + 3) / CR; sstep = lambda u: (lambda c: c * c * (3 - 2 * c))(np.clip(u, 0, 1))
    cv = AG.cum(AG.power(vo)); LV = AG.gated(AG.power(vo))   # voice bus: cumulative K-weighted power (the gate's own measure) and its integrated loudness
    # ---- room tone: a steady bed under the whole film, by set; intended silences duck it instead of cutting it ----
    room = np.zeros((2, N), np.float32); room_info = 'off'; RM = B.get('room', 'auto')
    if RM != 'off':
        KIND = {'street': 'street', 'stall': 'street', 'zombie': 'street', 'market': 'murmur', 'pub': 'murmur', 'bar': 'murmur'}
        spans = [(p['t'], p['place']) for p in PLACES] or [(0.0, RM if isinstance(RM, str) and RM not in ('auto', 'real') else place_at(0))]
        spans[0] = (0.0, spans[0][1]); xf = 0.6; beds = np.zeros((2, N), np.float32); bedm = np.zeros(N, np.float32); names_ = []; use_stereo = False
        for i, (t0_, pl) in enumerate(spans):
            t1_ = spans[i + 1][0] if i + 1 < len(spans) else DUR; a0, a1 = max(0.0, t0_ - xf / 2), min(DUR, t1_ + xf / 2); kind = KIND.get(pl, 'street'); names_.append(f'{pl}:{kind}')
            a_ = int(a0 * SR); fi = int(xf * SR)
            if (USE_REAL or RM == 'real') and sfx_lib.resolve_amb_name(kind):
                use_stereo = True
                x = sfx_lib.load_ambience_stereo(kind, a1 - a0, sr=SR); env_ = np.ones(x.shape[1], np.float32)
                if i > 0 and fi > 1: env_[:fi] = np.linspace(0, 1, fi)
                if i + 1 < len(spans) and fi > 1: env_[-fi:] = np.minimum(env_[-fi:], np.linspace(1, 0, fi))
                if i == 0: n0 = min(x.shape[1], int(0.05 * SR)); env_[:n0] = np.linspace(0, 1, n0)
                klen = min(N - a_, x.shape[1]); beds[:, a_:a_ + klen] += (x[:, :klen] * env_[None, :klen])
            else:
                x = SFX(kind, a1 - a0 + 0.4, None)[:int((a1 - a0) * SR)]; env_ = np.ones(len(x), np.float32)
                if i > 0: env_[:fi] = np.linspace(0, 1, fi)
                if i + 1 < len(spans): env_[-fi:] = np.minimum(env_[-fi:], np.linspace(1, 0, fi))
                if i == 0: env_[:int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
                bedm[a_:a_ + len(x)] += (x * env_)[:N - a_]
        if not use_stereo: beds = np.stack([bedm, bedm]) * 0.7071
        tg = LV - float((B.get('room') or {}).get('below', 27.0) if isinstance(B.get('room'), dict) else 27.0); cur = AG.lu(np.mean(AG.power(beds)))
        room = beds * (10 ** ((tg - cur) / 20)); room_info = ', '.join(names_) + f' at {tg:.1f} LU' + (' (real)' if use_stereo else '')
    # ---- per-effect buses (mono, with the bus gain 0.85 and the mono -> stereo -3 dB the old graph also applied) ----
    FE = []
    for f in FX:
        a = int(f['t'] * SR)
        if a >= N: continue
        FE.append(dict(name=f['name'], t=f['t'], a=max(0, a), x=(f['x'] * 0.85)[max(0, -a):N - max(0, a)] if a < 0 else (f['x'] * 0.85)[:N - a], src=f['src']))
    for e in FE: e['len'] = len(e['x']); e['cum'] = None
    # ---- the lines the duck protects ----
    LN = [(b['id'], TL_a, TL_e, 'marginWaive' in b) for b in lines for TL_a, TL_e in [(times[b['id']]['t0'], times[b['id']]['t1'])]]
    ATT_LEAD, REL, TARGET, CAP = 0.07, 0.30, MARGIN_TARGET, 30.0

    def duck_ctrl(items):   # [(a, e, att_dB)] -> attenuation in dB at the control rate: smooth fall over ATT_LEAD s ending at the line start, held to the line end, smooth release over REL s
        d = np.zeros(len(tc))
        for a, e, att in items:
            if att <= 0: continue
            i0, i1 = max(0, int((a - ATT_LEAD) * CR) - 1), min(len(tc), int((e + REL) * CR) + 2); t = tc[i0:i1]
            d[i0:i1] = np.maximum(d[i0:i1], att * sstep((t - (a - ATT_LEAD)) / ATT_LEAD) * sstep(1 - np.maximum(0, t - e) / REL))
        return d
    def lin(db_ctrl, t0, n): return 10 ** (np.interp(t0 + np.arange(n) / SR, tc, db_ctrl) / 20)

    # ---- the music gain curve from the tension curve (dB at the control rate) ----
    tens, ngiven = AG.tension_list(B['beats']); segs_t = AG.segments(B['beats'], times, DUR) if tens else None
    notch_t = sorted(set(([times[B['beats'][max(range(len(tens)), key=lambda i: (tens[i], -i))]['id']]['t0']] if tens else []) + list(IMPACT_T)))
    def music_curve(P):
        db = np.zeros(len(tc))
        if tens:
            tmax = max(tens); pk = max(range(len(tens)), key=lambda i: (tens[i], -i)); arr = np.zeros(len(tc))
            for i, (a, e) in enumerate(segs_t):
                o = P['boost'] - P['slope'] * (tmax - tens[i]) - P['extra'].get(i, 0.0)
                for j in range(max(0, i - 2), i):   # after a tender / sad beat at tension >= 7 the music thins instead of pushing (not the top beat itself)
                    bm = B['beats'][j]
                    if j != pk and i != pk and bm.get('mood') in ('tender', 'sad') and tens[j] >= 7 and a < segs_t[j][1] + 3.0: o -= THIN_DB
                arr[int(a * CR):int(e * CR) + 1] = max(o, -26.0)
            k = int(0.4 * CR); pad = np.pad(arr, k // 2, mode='edge'); db = np.convolve(pad, np.ones(k) / k, 'valid')[:len(tc)]
        for t in notch_t:   # the breath before the top peak and before every impact: music pulled down for 0.45 s, back on the hit
            a, e = t - 0.45 - 0.03, t - 0.03; sh = sstep((tc - a) / 0.06) * sstep(1 - np.maximum(0, tc - e) / 0.08); db = db - NOTCH_DB * sh
        return np.maximum(db, -40.0)

    def assemble(mdb, am, ae, want_cum=True):
        """mdb: music gain dB curve; am: {line idx: att dB} on the music bus; ae: {(effect idx, line idx): att dB}. Returns the buses and the cumulative power series."""
        mg = lin(mdb - duck_ctrl([(LN[i][1], LN[i][2], v) for i, v in am.items()]), 0.0, N).astype(np.float32); mf = ms * mg
        sil = [(times[b['id']]['t0'], times[b['id']]['t1'], ROOM_SIL_DB) for b in B['beats'] if b.get('silence') and b['id'] in times]   # intended silences duck the room tone, they do not cut it
        fxb = room * lin(-duck_ctrl(sil), 0.0, N).astype(np.float32) if sil and RM != 'off' else room.copy()
        # effects: each with its own gain envelope where it was ducked
        per = {}
        for (ei, li), v in ae.items(): per.setdefault(ei, []).append((LN[li][1], LN[li][2], v))
        for ei, e in enumerate(FE):
            x = e['x']
            if ei in per: x = x * lin(-duck_ctrl(per[ei]), e['t'], e['len']).astype(np.float32)
            fxb[:, e['a']:e['a'] + e['len']] += (x * 0.7071)[None, :]
        return mf, fxb

    def evaluate(mdb, am, ae):
        mf, fxb = assemble(mdb, am, ae); bed = mf + fxb; cb = AG.cum(AG.power(bed)); return mf, fxb, cb
    def local_peak(ei, li, ae):   # loudest 400 ms of effect ei (with its current duck) inside line li, the gate's own way of measuring
        e = FE[ei]; x = e['x']; items = [(LN[l][1], LN[l][2], v) for (k, l), v in ae.items() if k == ei]
        if items: x = x * lin(-duck_ctrl(items), e['t'], e['len']).astype(np.float32)
        p = 2 * AG.kw(x.astype(np.float64) * 0.7071) ** 2   # both channels
        c = AG.cum(p); a0, e0 = LN[li][1], LN[li][2]; off = e['a']
        def energy(s, t): lo = int(np.clip(int(s * SR) - off, 0, len(p))); hi = int(np.clip(int(t * SR) - off, 0, len(p))); return (c[hi] - c[lo])
        if e0 - a0 <= 0.4: return AG.lu(energy(a0, e0) / max(1, int((e0 - a0) * SR)))
        st = np.arange(a0, e0 - 0.4 + 1e-9, 0.1); w = int(0.4 * SR); return float(max(AG.lu(energy(s, s + 0.4) / w) for s in st))

    def solve_duck(mdb, verbose=False):
        am, ae, first = {}, {}, None
        for it in range(12):
            mf, fxb, cb = evaluate(mdb, am, ae); mrg = {}
            for li, (lid, a, e, waive) in enumerate(LN): mrg[li] = AG.win(cv, a, e) - AG.momentary_max(cb, a, e)
            if first is None: first = dict(mrg)
            bad = [li for li, m in mrg.items() if m < TARGET and not LN[li][3]]
            if not bad: break
            cm_ = AG.cum(AG.power(mf))
            for li in bad:
                lid, a, e, _ = LN[li]; need = TARGET - mrg[li] + 0.05; bedpk = AG.momentary_max(cb, a, e); comps = {'music': AG.momentary_max(cm_, a, e)}
                for ei, fe in enumerate(FE):
                    if fe['t'] - 0.1 < e and fe['t'] + fe['len'] / SR > a: comps[ei] = local_peak(ei, li, ae)
                for c, pk in comps.items():
                    if pk >= bedpk - 25.0:   # everything that adds to the bed gets the cut (a texture of many steps has no single dominant one)
                        if c == 'music': am[li] = min(CAP, am.get(li, 0.0) + need)
                        else: ae[(c, li)] = min(CAP, ae.get((c, li), 0.0) + need)
        return am, ae, first, mrg, it

    P = dict(boost=1.5, slope=1.5, extra={})
    # ---- closed loop on check e: the build measures what the gate measures and bends the curve until the gate would pass ----
    gl_est = lambda mf, fxb: -13.5 - AG.gated(AG.power(vo + mf + fxb))
    mdb = music_curve(P); loop_log = []
    for rnd in range(9):
        am, ae, first, mrg, nit = solve_duck(mdb)
        mf, fxb, cb = evaluate(mdb, am, ae)
        if not tens or not HAS_M: break   # no curve to follow, or no music for the build to bend
        sh = gl_est(mf, fxb); E = AG.check_e(B['beats'], times, DUR, cb, tens, shift=sh, cm=AG.cum(AG.power(mf))); loop_log.append((rnd, round(P['slope'], 2), None if E['over'] is None else round(E['over'], 1), None if E['dip'] is None else round(E['dip'], 1), E['ok'], None if E['music_over'] is None else round(E['music_over'], 1)))
        mus_low = E['music_over'] is not None and E['music_over'] < PEAK_GOAL and P['slope'] < 5.0 and np.abs(ms).max() > 0   # not the gate: the climax must come from the MUSIC too, not only from the effects the author placed
        good = E['ok'] and (E['over'] is None or E['over'] >= PEAK_GOAL) and (E['dip'] is None or E['dip'] >= DIP_GOAL) and not mus_low   # the goal sits 0.4 LU inside the gate's thresholds: the limiter is not modelled
        if good or rnd == 8: break
        if mus_low and not (E['over'] is not None and E['over'] < PEAK_GOAL): P['slope'] = min(5.0, P['slope'] + 0.5 + 0.25 * (PEAK_GOAL - E['music_over'])); P['boost'] = min(8.0, P['boost'] + 1.0)
        if E['over'] is not None and E['over'] < PEAK_GOAL: P['slope'] = min(5.0, P['slope'] + 0.5 + 0.25 * (PEAK_GOAL - E['over'])); P['boost'] = min(8.0, P['boost'] + 1.0)   # the calm music sinks and the peak rises (the duck still caps it at the voice margin)
        if E['dip'] is not None and E['dip'] < DIP_GOAL and E['pk'] > 0: P['extra'][E['pk'] - 1] = P['extra'].get(E['pk'] - 1, 0.0) + (DIP_GOAL - E['dip']) + 0.7
        if (E['over'] is None or E['over'] >= PEAK_GOAL) and (E['dip'] is None or E['dip'] >= DIP_GOAL or E['pk'] == 0) and not mus_low: break   # nothing more the music can do (e.g. peak is the first segment)
        mdb = music_curve(P)
    if tens:
        print(f'tension curve: {ngiven} of {len(B["beats"])} beats carry a value; music gain follows it (slope {P["slope"]:.2f} dB per tension point' + (f', extra dip on beats {sorted(P["extra"])}' if P['extra'] else '') + f'); closed loop on check e: ' + ' -> '.join(f"[slope {s} bed +{o} dip {d} music alone {m} {'gate ok' if k else 'gate no'}]" for _, s, o, d, k, m in loop_log))
    if tens and not good:   # say WHY: the music is the only thing the build bends; effects the author placed and the voice margin are not
        cmx_, cfx_ = AG.cum(AG.power(mf)), AG.cum(AG.power(fxb)); sg = E['segs']; pk_ = E['pk']; lo_ = E['low']
        dom = sorted(((AG.win(cfx_, *sg[i]) + sh, AG.win(cmx_, *sg[i]) + sh, i) for i in lo_ if AG.win(cfx_, *sg[i]) > AG.win(cmx_, *sg[i]) + 3), reverse=True)[:4]
        vpk = AG.win(cv, *sg[pk_]) + sh if B['beats'][pk_].get('text') else None
        print('  check e still failing after the loop: ' + '; '.join(E['why']) + '. ' + (f"Calm beats whose bed is mostly effects (the build only shapes the music): " + ', '.join(f"{B['beats'][i]['id']} fx {a:.1f} vs music {b:.1f}" for a, b, i in dom) + '. ' if dom else '') + (f"The peak beat {B['beats'][pk_]['id']} is a spoken line (voice {vpk:.1f} LUFS), so its bed cannot exceed about {vpk - TARGET:.1f}: put the top tension on a pause or a louder line, or lower the tension of the effect-heavy calm beats." if vpk is not None else ''))
    # ---- the duck table ----
    ducked = sorted(set(list(am) + [l for (_, l) in ae])); print(f'auto-duck: voice kept >= {TARGET:.1f} dB over music + effects; {len(ducked)} of {len(LN)} lines needed it (worst margin before {min(first.values()):.1f} dB, after {min(mrg.values()):.1f} dB, {nit + 1} passes)' + ('' if ducked else ''))
    if ducked: print('  line   margin before -> after   music dB   effects (name@time dB)')
    for li in ducked:
        grp = {}
        for (ei, l), v in sorted(ae.items()):
            if l == li: grp.setdefault(FE[ei]['name'], []).append((FE[ei]['t'], v))
        fl = [(f"{nm}@{g[0][0]:.2f} -{g[0][1]:.1f}" if len(g) == 1 else f"{nm} x{len(g)} {g[0][0]:.2f}-{g[-1][0]:.2f} up to -{max(v for _, v in g):.1f}") for nm, g in grp.items()]
        print(f"  {LN[li][0]:6s} {first[li]:8.1f} -> {mrg[li]:5.1f}   {('-%.1f' % am[li]) if li in am else '    -'}     " + ('; '.join(fl) if fl else '-') + ('   [marginWaive: left alone]' if LN[li][3] else ''))
    for (ei, li), v in sorted(ae.items()):   # an accent the duck had to bury is a hit nobody hears: say so
        if FE[ei]['src'] == 'auto-accent' and v > 6: print(f"  NOTE: the auto accent {FE[ei]['name']}@{FE[ei]['t']:.2f} had to be ducked {v:.1f} dB under line {LN[li][0]}: put `impact` on a pause beat before the line, or give the line a marginWaive reason")
    waived_l = [LN[li][0] for li in range(len(LN)) if LN[li][3]]
    if waived_l: print('  marginWaive (left alone): ' + ', '.join(waived_l))
    stuck = [LN[li][0] for li in range(len(LN)) if mrg[li] < TARGET - 0.25 and not LN[li][3]]
    if stuck: print('  STILL UNDER THE MARGIN (duck capped at %.0f dB or the bed is the room tone): ' % CAP + ', '.join(f'{x} {mrg[[l[0] for l in LN].index(x)]:.1f}' for x in stuck))
    # ---- sum, limiter, one gain to -13.5 LUFS, stems at that gain ----
    f32wav(f'{OUT}/mix_pre.wav', vo + mf + fxb)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/mix_pre.wav', '-af', 'alimiter=limit=0.89:level=false', '-ar', '48000', '-c:a', 'pcm_f32le', f'{OUT}/mix_raw.wav'], check=True); os.remove(f'{OUT}/mix_pre.wav')
    g = -13.5 - lufs(f'{OUT}/mix_raw.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/mix_raw.wav', *FINAL(g), '-ar', '48000', f'{OUT}/mix.wav'], check=True)
    If = lufs(f'{OUT}/mix.wav')   # what the limiter left: one correction so the finished mix sits at -14.0 LUFS (the old mix landed at -14.2..-14.4 because the limiter took the rest)
    if abs(If + 14.0) > 0.15: g += -14.0 - If; subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/mix_raw.wav', *FINAL(g), '-ar', '48000', f'{OUT}/mix.wav'], check=True)
    gl = 10 ** (g / 20); f32wav(f'{OUT}/stem_voice.wav', vo * gl); f32wav(f'{OUT}/stem_music.wav', mf * gl); f32wav(f'{OUT}/stem_effects.wav', fxb * gl)
    print(f'room tone: {room_info}')
r = subprocess.run(['ffmpeg', '-v', 'info', '-i', f'{OUT}/mix.wav', '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'], capture_output=True, text=True).stderr
print(f'{ID}: {len(clips)} lines, {DUR} s ->', OUT, '(legacy mix)' if LEGACY else ''); print('\n'.join(l.strip() for l in r.splitlines() if 'Input Integrated' in l or 'Input True Peak' in l))
print('stems: ' + ' '.join(f'--stem {w}={OUT}/vo_{w}.wav' for w in stems))
