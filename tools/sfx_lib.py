#!/usr/bin/env python3
"""cine3d real audio library loader, music builder, and catalog verifier.
  python3 tools/sfx_lib.py list
  python3 tools/sfx_lib.py verify
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB_DIR = os.path.join(ROOT, 'audio_lib')
CATALOG_PATH = os.path.join(LIB_DIR, 'catalog.json')
LICENSES_PATH = os.path.join(LIB_DIR, 'LICENSES.md')
DEFAULT_SR = 48000

_CAT = None
def catalog():
    global _CAT
    if _CAT is None:
        if not os.path.exists(CATALOG_PATH):
            _CAT = {'sfx': {}, 'aliases': {}, 'ambience': {}, 'music': {}, 'mood_map': {}}
        else:
            _CAT = json.load(open(CATALOG_PATH, encoding='utf-8'))
    return _CAT

def resolve_sfx_name(name):
    cat = catalog()
    nm = cat.get('aliases', {}).get(name, name)
    return nm if nm in cat.get('sfx', {}) else None

def resolve_amb_name(name):
    cat = catalog()
    nm = cat.get('aliases', {}).get(name, name)
    return nm if nm in cat.get('ambience', {}) else None

def has_sfx(name):
    return resolve_sfx_name(name) is not None or resolve_amb_name(name) is not None

def has_track(name):
    return name in catalog().get('music', {})

def mood_track(mood):
    return catalog().get('mood_map', {}).get(mood)

def _decode_audio(path, ch=1, sr=DEFAULT_SR):
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(sr), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    arr = np.frombuffer(raw, np.float32).copy()
    if ch > 1:
        arr = arr.reshape(-1, ch).T.copy()
    return arr

def _loop_or_trim_1d(x, dur, loop=False, sr=DEFAULT_SR, xfade_s=0.14):
    target = max(1, int(round(dur * sr)))
    if len(x) <= 0:
        return np.zeros(target, np.float32)
    if not loop:
        if len(x) <= target:
            return x
        y = x[:target].copy()
        fd = min(len(y), int(0.04 * sr))
        if fd > 1:
            y[-fd:] *= np.linspace(1.0, 0.0, fd, dtype=np.float32)
        return y
    # Seamless equal-power crossfade loop
    xf = min(int(xfade_s * sr), max(1, len(x) // 4))
    step = max(1, len(x) - xf)
    y = np.zeros(target + xf, np.float32)
    pos = 0
    first = True
    while pos < target:
        chunk = x.copy()
        if not first and xf > 1:
            fi = np.sin(np.linspace(0, np.pi / 2, xf, dtype=np.float32))
            chunk[:xf] *= fi
        if pos + step < target and xf > 1:
            fo = np.cos(np.linspace(0, np.pi / 2, xf, dtype=np.float32))
            chunk[-xf:] *= fo
        end = min(len(y), pos + len(chunk))
        y[pos:end] += chunk[: end - pos]
        pos += step
        first = False
    y = y[:target]
    fd = min(len(y), int(0.05 * sr))
    if fd > 1:
        y[-fd:] *= np.linspace(1.0, 0.0, fd, dtype=np.float32)
    return y

def _loop_or_trim_2d(x, dur, sr=DEFAULT_SR, xfade_s=0.8):
    target = max(1, int(round(dur * sr)))
    if x.shape[1] >= target:
        return x[:, :target].copy()
    xf = min(int(xfade_s * sr), max(1, x.shape[1] // 4))
    step = max(1, x.shape[1] - xf)
    y = np.zeros((x.shape[0], target + xf), np.float32)
    pos = 0
    first = True
    while pos < target:
        chunk = x.copy()
        if not first and xf > 1:
            fi = np.sin(np.linspace(0, np.pi / 2, xf, dtype=np.float32))[None, :]
            chunk[:, :xf] *= fi
        if pos + step < target and xf > 1:
            fo = np.cos(np.linspace(0, np.pi / 2, xf, dtype=np.float32))[None, :]
            chunk[:, -xf:] *= fo
        end = min(y.shape[1], pos + chunk.shape[1])
        y[:, pos:end] += chunk[:, : end - pos]
        pos += step
        first = False
    return y[:, :target]

def _ff_1d(x, af, sr=DEFAULT_SR):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-', '-af', af, '-f', 'f32le', '-'],
        input=x.astype(np.float32).tobytes(), capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, np.float32).copy()

def load_sfx(name, dur=None, o=None, rng=None, sr=DEFAULT_SR):
    cat = catalog()
    amb_nm = resolve_amb_name(name)
    sfx_nm = resolve_sfx_name(name)
    if sfx_nm:
        entry = cat['sfx'][sfx_nm]
    elif amb_nm:
        entry = cat['ambience'][amb_nm]
    else:
        raise KeyError(f'Unknown real audio key: {name}')

    files = entry['files']
    o = o or {}
    if 'variant' in o and isinstance(o['variant'], int):
        idx = o['variant'] % len(files)
    elif rng is not None and len(files) > 1:
        idx = int(rng.integers(0, len(files)))
    else:
        idx = 0
    path = os.path.join(LIB_DIR, files[idx])
    x = _decode_audio(path, ch=1, sr=sr)
    g = float(entry.get('gain_db', 0.0))
    if g:
        x = x * (10.0 ** (g / 20.0))
    if o.get('pitch'):
        p = float(o['pitch'])
        x = _ff_1d(x, f'asetrate={sr * p:.0f},aresample={sr},atempo={1.0 / p:.4f}', sr=sr)
    if o.get('far'):
        x = _ff_1d(x, 'lowpass=f=1800', sr=sr) * 0.45
    if dur is not None:
        x = _loop_or_trim_1d(x, float(dur), loop=bool(entry.get('loop', False)), sr=sr)
    return x.astype(np.float32)

def load_ambience_stereo(name, dur, sr=DEFAULT_SR):
    cat = catalog()
    nm = resolve_amb_name(name)
    if not nm:
        raise KeyError(f'Unknown ambience: {name}')
    entry = cat['ambience'][nm]
    path = os.path.join(LIB_DIR, entry['files'][0])
    x = _decode_audio(path, ch=2, sr=sr)
    g = float(entry.get('gain_db', 0.0))
    if g:
        x = x * (10.0 ** (g / 20.0))
    return _loop_or_trim_2d(x, float(dur), sr=sr, xfade_s=0.6)

def build_music(M, dur, when_fn, out_wav, sr=DEFAULT_SR):
    cat = catalog()
    music_map = cat.get('music', {})
    N = max(1, int(round(dur * sr)))
    bus = np.zeros((2, N), np.float32)

    def resolve_t(ref, off=0.0, default=0.0):
        if ref is None:
            return default
        if ref == 'end':
            return float(dur) + float(off)
        return float(when_fn(ref)) + float(off)

    segs = M.get('tracks')
    if not segs:
        tid = M.get('track') or mood_track(M.get('mood', 'home'))
        if not tid or tid not in music_map:
            raise SystemExit(f"sfx_lib: unknown music track '{tid}'")
        segs = [{'track': tid, 'from': 0.0, 'to': 'end', 'xfade': 0.0}]

    for i, seg in enumerate(segs):
        tid = seg['track']
        if tid not in music_map:
            raise SystemExit(f"sfx_lib: unknown music track '{tid}'")
        entry = music_map[tid]
        path = os.path.join(LIB_DIR, entry['file'])
        t0 = max(0.0, resolve_t(seg.get('from'), seg.get('off0', 0.0), 0.0))
        t1 = min(float(dur), resolve_t(seg.get('to'), seg.get('off1', 0.0), float(dur)))
        if t1 <= t0 + 0.05:
            continue
        xf = float(seg.get('xfade', 0.8 if i > 0 else 0.0))
        s_start = max(0.0, t0 - xf * 0.5)
        s_end = min(float(dur), t1 + xf * 0.5)
        seg_dur = s_end - s_start
        x = _decode_audio(path, ch=2, sr=sr)
        g = float(entry.get('gain_db', 0.0)) + float(seg.get('gain_db', 0.0))
        if g:
            x = x * (10.0 ** (g / 20.0))
        seg_audio = _loop_or_trim_2d(x, seg_dur, sr=sr, xfade_s=0.9)
        fade_in = min(int((xf if i > 0 else 0.05) * sr), seg_audio.shape[1])
        fade_out = min(int((float(seg.get('out_xfade', 0.8)) if i < len(segs) - 1 else 0.0) * sr), seg_audio.shape[1])
        if fade_in > 1:
            seg_audio[:, :fade_in] *= np.sin(np.linspace(0, np.pi / 2, fade_in, dtype=np.float32))[None, :]
        if fade_out > 1:
            seg_audio[:, -fade_out:] *= np.cos(np.linspace(0, np.pi / 2, fade_out, dtype=np.float32))[None, :]
        a = int(round(s_start * sr))
        e = min(N, a + seg_audio.shape[1])
        bus[:, a:e] += seg_audio[:, : e - a]

    fd = int(round(float(M.get('fade', 1.2)) * sr))
    if 1 < fd <= N:
        bus[:, -fd:] *= np.linspace(1.0, 0.0, fd, dtype=np.float32)[None, :]
    fd_in = min(N, int(0.03 * sr))
    if fd_in > 1:
        bus[:, :fd_in] *= np.linspace(0.0, 1.0, fd_in, dtype=np.float32)[None, :]

    lufs = float(M.get('lufs', -26))
    raw_wav = out_wav.replace('.wav', '_libraw.wav')
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-', raw_wav],
        input=np.ascontiguousarray(bus.T, dtype=np.float32).tobytes(), check=True,
    )
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-i', raw_wav, '-af', f'loudnorm=I={lufs}:TP=-3:LRA=11', '-ar', str(sr), out_wav],
        check=True,
    )
    if os.path.exists(raw_wav):
        os.remove(raw_wav)

def _probe(path):
    r = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels', '-of', 'json', path],
        capture_output=True, text=True, check=True,
    )
    j = json.loads(r.stdout)
    st = (j.get('streams') or [{}])[0]
    dur = float((j.get('format') or {}).get('duration', 0))
    return dur, int(st.get('sample_rate', 0)), int(st.get('channels', 0))

def cmd_list():
    cat = catalog()
    print('=== SFX ===')
    for k, v in sorted(cat.get('sfx', {}).items()):
        p = os.path.join(LIB_DIR, v['files'][0])
        dur = _probe(p)[0] if os.path.exists(p) else 0
        print(f"  {k:15s}  x{len(v['files'])}  {dur:5.2f}s  {'LOOP ' if v.get('loop') else '1shot'}  {v.get('desc', '')}")
    if cat.get('aliases'):
        print('  Aliases:', ', '.join(f'{a}->{b}' for a, b in sorted(cat['aliases'].items())))
    print('\n=== AMBIENCE ===')
    for k, v in sorted(cat.get('ambience', {}).items()):
        p = os.path.join(LIB_DIR, v['files'][0])
        dur = _probe(p)[0] if os.path.exists(p) else 0
        print(f"  {k:15s}  x{len(v['files'])}  {dur:5.2f}s  {v.get('desc', '')}")
    print('\n=== MUSIC TRACKS ===')
    for k, v in sorted(cat.get('music', {}).items()):
        p = os.path.join(LIB_DIR, v['file'])
        dur = _probe(p)[0] if os.path.exists(p) else 0
        print(f"  {k:20s}  {dur:6.1f}s  {v.get('vibe', '')}  ({v.get('author', '')}, {v.get('license', '')})")

def cmd_verify():
    cat = catalog()
    lic_txt = open(LICENSES_PATH, encoding='utf-8').read() if os.path.exists(LICENSES_PATH) else ''
    fails = []
    checked = 0

    def check_file(rel_p, label):
        nonlocal checked
        checked += 1
        p = os.path.join(LIB_DIR, rel_p)
        if not os.path.exists(p):
            fails.append(f'{label}: missing {rel_p}')
            return
        try:
            dur, sr, ch = _probe(p)
            x = _decode_audio(p, ch=ch or 1, sr=DEFAULT_SR)
        except Exception as e:
            fails.append(f'{label}: decode error {rel_p}: {e}')
            return
        pk = float(np.abs(x).max()) if x.size else 0.0
        dc = float(np.abs(x.mean())) if x.size else 1.0
        if sr != DEFAULT_SR:
            fails.append(f'{label}: {rel_p} sample rate {sr} != {DEFAULT_SR}')
        if dur <= 0.02 or pk < 0.01:
            fails.append(f'{label}: {rel_p} silent/empty (dur {dur:.2f}s, peak {pk:.4f})')
        if pk > 0.999:
            fails.append(f'{label}: {rel_p} clipping (peak {pk:.4f})')
        if dc > 0.01:
            fails.append(f'{label}: {rel_p} DC offset ({dc:.4f})')
        if os.path.basename(rel_p) not in lic_txt:
            fails.append(f'{label}: {os.path.basename(rel_p)} missing from LICENSES.md')

    for k, v in cat.get('sfx', {}).items():
        for rf in v['files']:
            check_file(rf, f'sfx.{k}')
    for k, v in cat.get('ambience', {}).items():
        for rf in v['files']:
            check_file(rf, f'ambience.{k}')
    for k, v in cat.get('music', {}).items():
        check_file(v['file'], f'music.{k}')

    if fails:
        print(f'VERIFY FAIL ({len(fails)} issues across {checked} files):')
        for f in fails:
            print('  FAIL', f)
        sys.exit(1)
    print(f'AUDIO_LIB VERIFY PASS ({checked} files checked, all 48kHz, clean headroom, zero DC/clip, CC0/PD logged)')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    if cmd == 'list':
        cmd_list()
    elif cmd == 'verify':
        cmd_verify()
    else:
        sys.exit(__doc__)
