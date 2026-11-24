#!/usr/bin/env python3
"""cine3d horror-chase score (mood `zombie`), synthesised in code (numpy), deterministic, written 13/11 for the Zombie special. Not listened to by a person yet.

  gen  : called by tools/voice.py (mood "zombie").  env SCORE_INFO = json { duration, segs:[{seg, t, ...params}], lines:{id:{t0,t1}} }, SCORE_OUT = wav to write
  check: python tools/score_zombie.py check episodes/<id>.beats.json  -> loudness curve, voice-vs-bed table, cue sheet (out/<id>/audio/cue_sheet.md)

HOW AN EPISODE PLACES IT (episodes/<id>.beats.json -> "music": { "mood": "zombie", "seed": 57, "fade": 0.35, "segs": [ { "seg": "chase", "ref": "l1", "off": -0.15, "why": "...", ...params }, ... ] })
 SECTIONS last from their time until the next section starts (ref = beat id, '<id>.end' or seconds, off = seconds):
   dread   sub drone + slow heartbeat + dissonant high string shimmer.   hb (bpm, default 54), hb_to, rise (0..1: swells from quiet), level (dB)
   stalk   ticking ostinato + low pulses, tension rising to the end.      bpm (104), bpm_to, level
   chase   taiko/toms 150-170 bpm, pounding bass ostinato, brass stabs.   bpm (160), bpm_to (< bpm = the run slows down), i0 / i1 (density 0..1 at start / end), g1 (end gain), rise_st (stab climb in semitones), open (bool: big downbeat), level
   riser   rising glide + noise + accelerating thumps; end it with `silence` or a `chase`
   tragic  slow heavy minor swell (pad strings, a lone cello line, soft taiko).  level
   doom    accelerating pulse + riser; ends at the next `boom` (give it one)
   warm    the normal light bed: the existing tdvai score.py (mood `home` by default) for this stretch; mood, seed, fade
   silence the music stops (sections only: stings and booms still ring)
 ONE-SHOTS (do not end a section): sting (kind blare | hit | bite, pitch in semitones, level)   boom (huge hit + sub boom, rings to the end)
 Every section is levelled by measurement (K-weighted loudness) to a house target, so `level` is a plain dB offset on that target."""
import json, os, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve, lfilter
SR = 48000; TD = os.path.expanduser('~/tdvai')
_S = {}
def _sos(kind, f, o):
    k = (kind, tuple(np.atleast_1d(f)), o)
    if k not in _S: _S[k] = butter(o, f, btype=kind, fs=SR, output='sos')
    return _S[k]
def lp(x, f, o=2): return sosfilt(_sos('low', f, o), x)
def hp(x, f, o=2): return sosfilt(_sos('high', f, o), x)
def bp(x, lo, hi, o=2): return sosfilt(_sos('band', [lo, hi], o), x)
def tt(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def ramp(n, a, b): return np.linspace(a, b, n)
# ---------------- loudness (BS.1770 K-weighting)
def kw(x): return lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x, axis=-1), axis=-1)
def lufs_of(x): return -0.691 + 10 * np.log10(np.sum(np.mean(kw(x) ** 2, axis=-1)) + 1e-12)
def momentary(x, win=0.4, hop=0.1):
    p = np.sum(kw(x) ** 2, axis=0); c = np.concatenate([[0], np.cumsum(p)]); w = int(win * SR); h = int(hop * SR)
    st = np.arange(0, max(1, len(p) - w + 1), h); return st / SR, -0.691 + 10 * np.log10((c[st + w] - c[st]) / w + 1e-12)

# ---------------- reverb and the per-section mixing desk
_IR = {}
def verb(x, dec, wet):
    if wet <= 0 or dec <= 0: return x
    if dec not in _IR:
        g = np.random.default_rng(int(dec * 100)); n = int(dec * SR); e = np.exp(-np.arange(n) / SR * 5.2 / dec)
        _IR[dec] = [lp(g.normal(0, 1, n) * e, 6000) / np.sqrt(n * 0.05) for _ in range(2)]
        for k in range(2): _IR[dec][k] /= np.sqrt((_IR[dec][k] ** 2).sum())
    n = x.shape[1]; return x + wet * np.stack([fftconvolve(x[0], _IR[dec][0])[:n], fftconvolve(x[1], _IR[dec][1])[:n]])
WETS = {'perc': (0.8, 0.10), 'bass': (0.0, 0.0), 'brass': (1.6, 0.22), 'str': (2.6, 0.38), 'fx': (2.2, 0.25), 'sub': (0.0, 0.0)}
class Sec:
    def __init__(s, secs): s.n = int(secs * SR); s.b = {}
    def put(s, bus, x, t, g=1.0, pan=0.0):
        a = int(round(t * SR))
        if a >= s.n or a + len(x) <= 0: return
        if a < 0: x = x[-a:]; a = 0
        x = x[:s.n - a] * g; arr = s.b.setdefault(bus, np.zeros((2, s.n), np.float32))
        arr[0, a:a + len(x)] += x * np.sqrt(0.5 * (1 - pan)); arr[1, a:a + len(x)] += x * np.sqrt(0.5 * (1 + pan))
    def mix(s):
        out = np.zeros((2, s.n), np.float32)
        for k, arr in s.b.items(): out += verb(arr, *WETS.get(k, (0, 0))).astype(np.float32)
        return out

# ---------------- instruments (mono arrays)
def taiko(R, f0=58, d=0.8, dec=0.28, click=0.6):
    t = tt(d); f = f0 * (1 + 1.6 * np.exp(-t / 0.035)); ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / dec) + 0.4 * np.sin(2.07 * ph) * np.exp(-t / (dec * 0.35)) + 0.2 * np.sin(3.1 * ph) * np.exp(-t / 0.05)   # the upper partials keep it audible on a phone speaker
    skin = bp(R.normal(0, 1, len(t)), 150, 800) * np.exp(-t / 0.05) * 0.6; cl = hp(R.normal(0, 1, len(t)), 2500) * np.exp(-t / 0.006) * click * 0.45
    return (x + skin + cl) * np.minimum(1, t / 0.002)
def frame_drum(R):
    t = tt(0.22); return (bp(R.normal(0, 1, len(t)), 1200, 5500) * np.exp(-t / 0.07) * 0.8 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.4) * np.minimum(1, t / 0.001)
def hat(R):
    t = tt(0.07); return hp(R.normal(0, 1, len(t)), 6500) * np.exp(-t / 0.018)
def crash(R, d=2.0):
    t = tt(d); return hp(R.normal(0, 1, len(t)), 2600) * (np.exp(-t / (d * 0.32)) * np.minimum(1, t / 0.03))
def boom_sub(d=1.2, f0=80, f1=36, dec=0.5):
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t / 0.12); return np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t / dec) * 0.7
def thump(f0=64, d=0.4):   # a heartbeat thump
    t = tt(d); f = 38 + (f0 - 38) * np.exp(-t / 0.045); ph = 2 * np.pi * np.cumsum(f) / SR; return (np.sin(ph) + 0.45 * np.sin(2 * ph) * np.exp(-t / 0.05)) * np.exp(-t / 0.13) * np.minimum(1, t / 0.003)
def bass_note(m, d=0.14):
    t = tt(d); f = hz(m); ph = (f * t) % 1.0; x = lp((2 * ph - 1) * 0.7 + np.sin(2 * np.pi * f * t) * 0.6, 520); return x * np.exp(-t / 0.085) * np.minimum(1, t / 0.003)
def tick(R, f=1700):
    t = tt(0.06); return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.010) + bp(R.normal(0, 1, len(t)), 2200, 4500) * np.exp(-t / 0.004) * 0.9) * 0.7
def brass(R, ms, d, att=0.022, rel=0.12, bright=1.0, decay=None, vib=0.0, det=0.09):
    n = int((d + rel) * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for m in ms:
        for dt in (-det, 0.0, det):
            fv = hz(m + dt) * (1 + vib * np.sin(2 * np.pi * 5.3 * t + R.random() * 6.28)); ph = np.cumsum(fv) / SR; x += 2 * (ph % 1.0) - 1
    x /= 3 * len(ms) ** 0.8; op = 1 - np.exp(-t / 0.05); y = lp(x, 650) * (1 - op) + lp(x, 3300 * bright) * op
    e = np.minimum(1, t / att) * np.where(t < d, 1.0, np.exp(-(t - d) / rel * 4)); e = e * (np.exp(-t / decay) if decay else 1.0)
    return y * e
def strings(R, ms, d, att=0.3, rel=0.4, vib=0.0035, bright=1.0, det=0.12):
    n = int((d + rel) * SR); t = np.arange(n) / SR; x = np.zeros(n); vv = vib * np.minimum(1, t / 0.5)
    for m in ms:
        for dt in (-det, 0.0, det):
            ph = np.cumsum(hz(m + dt) * (1 + vv * np.sin(2 * np.pi * 5.4 * t + R.random() * 6.28))) / SR; x += 2 * (ph % 1.0) - 1
    x = lp(x / (3 * len(ms) ** 0.8), 2800 * bright)
    return x * np.minimum(1, t / att) * np.where(t < d, 1.0, np.exp(-(t - d) / rel * 4))
def screech(R, f0=1900, f1=1250, d=0.7):
    t = tt(d); f = f0 + (f1 - f0) * t / d + 25 * np.sin(2 * np.pi * 7 * t); ph = np.cumsum(f) / SR; x = (2 * (ph % 1.0) - 1) + 0.6 * (2 * ((ph * 1.5) % 1.0) - 1)
    return lp(x, 4800) * np.exp(-t / (d * 0.5)) * np.minimum(1, t / 0.01) * 0.4
def shimmer_voice(R, f, d, rate, amp):
    t = tt(d); lfo = 0.5 + 0.5 * np.sin(2 * np.pi * rate * t + R.random() * 6.28); drift = lp(R.normal(0, 1, len(t)), 0.6, 1) * 0.0035; fv = f * (1 + drift + 0.004 * np.sin(2 * np.pi * 5.3 * t + R.random() * 6.28)); ph = np.cumsum(fv) / SR
    x = np.sin(2 * np.pi * ph) + 0.5 * np.sin(4 * np.pi * ph) * 0.8 + 0.33 * np.sin(6 * np.pi * ph) * 0.6
    return x * lfo ** 1.5 * np.minimum(1, t / 1.0) * np.minimum(1, (d - t) / 1.0).clip(0, 1) * amp
def noise_swell(R, d, lo=1800, hi=5200, amp=1.0):
    t = tt(d); return bp(R.normal(0, 1, len(t)), lo, hi) * np.sin(np.pi * t / d) ** 2 * amp
def drone(S, R, L, a0, a1, root_hz=36.71):
    t = tt(L + 0.3); amp = ramp(len(t), a0, a1)
    sub = np.tanh(2.4 * np.sin(2 * np.pi * root_hz * t)) * 0.28 + 0.34 * (np.sin(2 * np.pi * root_hz * 2 * t) + np.sin(2 * np.pi * (root_hz * 2 + 0.7) * t)) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.13 * t))
    rum = lp(R.normal(0, 1, len(t)), 90) * (0.35 + 0.25 * np.sin(2 * np.pi * 0.21 * t)) * 1.0
    horn = lp(2 * ((np.cumsum(hz(38) * (1 + 0.003 * np.sin(2 * np.pi * 0.3 * t))) / SR) % 1.0) - 1, 420) * 0.55
    S.put('sub', (sub + rum + horn) * amp, 0, 0.8)
    # a low string cluster (D3, Eb3, A3: a minor second and a tritone) that swells and trembles: the part a phone speaker can actually play
    lo = strings(R, [50, 51, 57], L + 0.3, 1.2, 0.5, 0.004, 0.55)[:len(t)]; trem = 0.75 + 0.25 * np.sin(2 * np.pi * 0.37 * t[:len(lo)]); S.put('str', lo * trem * amp[:len(lo)] * 0.55, 0, 1.0, 0.0)
def shimmer(S, R, L, a0, a1, notes=(80, 81, 92, 69), n_voices=None):
    d = L + 1.4
    for k, m in enumerate(notes):
        x = shimmer_voice(R, hz(m), d, 0.09 + 0.07 * k + 0.03 * R.random(), 1.0); amp = ramp(len(x), a0, a1) * 0.085
        S.put('str', x * amp, -0.2 + 0.1 * k, 1.0, pan=[-0.6, 0.5, -0.2, 0.7][k % 4])

# ---------------- sections
def sec_dread(S, R, L, P):
    hb0 = P.get('hb', 54); hb1 = P.get('hb_to', hb0); rise = P.get('rise', 0.0)
    drone(S, R, L, 1 - rise, 1.0); shimmer(S, R, L, 0.6 * (1 - rise) + 0.2, 1.0 + rise * 0.8)
    t = 0.0
    while t < L - 0.05:
        hb = hb0 + (hb1 - hb0) * t / L; g = 0.75 + 0.5 * (t / L) * rise
        S.put('perc', thump(64, 0.4), t, 0.9 * g); S.put('perc', thump(54, 0.35), t + min(0.2, 0.3 * 60 / hb), 0.6 * g); t += 60 / hb
    for t0 in np.arange(1.7, L - 1.5, 3.1): S.put('fx', noise_swell(R, 2.0, 1500, 5200, 0.07), t0 + 0.3 * R.random(), 1.0, pan=R.uniform(-0.7, 0.7))
def sec_stalk(S, R, L, P):
    b0 = P.get('bpm', 104); b1 = P.get('bpm_to', b0 + 16)
    drone(S, R, L, 0.45, 0.9); shimmer(S, R, L, 0.15, 1.3, notes=(80, 81, 69, 92))
    t = L * 0 + 0.0; k = 0
    while t < L - 0.03:
        p = t / L; bpm = b0 + (b1 - b0) * p; ed = 30 / bpm; acc = [1, .35, .6, .35, .85, .35, .6, .35][k % 8]; amp = acc * (0.45 + 0.55 * p)
        S.put('perc', tick(R, 1500 + 500 * p), t, 0.55 * amp, pan=0.25 if k % 2 else -0.25)
        if p > 0.5: S.put('perc', tick(R, 2300), t + ed / 2, 0.22 * amp, pan=-0.3)
        if k % 4 == 0: S.put('perc', thump(73, 0.45), t, 0.5 * (0.35 + 0.65 * p))   # low pulses on every beat
        if k % 8 == 5 and p > 0.3: S.put('perc', thump(61, 0.4), t, 0.3 * p)
        t += ed; k += 1
    t = tt(L + 0.5); f = 880 * 2 ** (1 / 12 * np.linspace(0, 1.6, len(t))); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.19 * t)); S.put('str', x * (np.linspace(0, 1, len(t)) ** 1.5) * 0.05, 0, 1.0, 0.3)
    for t0 in np.arange(1.2, L - 1.2, 2.8): S.put('fx', noise_swell(R, 1.6, 2200, 6000, 0.08 * (0.4 + t0 / L)), t0, 1.0, pan=R.uniform(-0.6, 0.6))
BASS_PAT = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1, 0, 0]; BASS_BAR = [0, 0, 1, 0, 0, 0, 3, 1]
def sec_chase(S, R, L, P):
    b0 = P.get('bpm', 160); b1 = P.get('bpm_to', b0); i0 = P.get('i0', 0.7); i1 = P.get('i1', 1.0); g1 = P.get('g1', 1.0); root = P.get('root', 38); rise_st = P.get('rise_st', 4)
    if P.get('open', True):
        og = 10 ** (P.get('open_db', 0) / 20)
        S.put('perc', taiko(R, 46, 1.3, 0.5), 0, 1.5 * og); S.put('perc', taiko(R, 62, 0.8), 0.005, 1.0 * og); S.put('sub', boom_sub(1.0, 70, 34, 0.45), 0, 0.7 * og)
        S.put('brass', brass(R, [root + 12, root + 13, root + 18, root + 24], 0.55, decay=0.7), 0, 1.0 * og); S.put('fx', crash(R, 1.8), 0, 0.55 * og)
    t = 0.0; step = 0; tom = [150, 128, 108]
    while t < L - 0.02:
        p = t / L; bpm = b0 + (b1 - b0) * p; sd = 15 / bpm; it = i0 + (i1 - i0) * p; s = step % 16; bar = step // 16; g = 1 + (g1 - 1) * p
        if s in (0, 6, 8, 12) or (it > 0.85 and s in (3, 14)): S.put('perc', taiko(R, 54 if s in (0, 8) else 60, 0.7), t, (0.8 if s in (0, 8) else 0.6) * g, pan=-0.15)
        if it > 0.5 and s in (2, 4, 10, 14) and not (bar % 4 == 3 and s >= 12): S.put('perc', taiko(R, tom[(step // 2) % 3], 0.4, 0.12, 0.4), t, 0.8 * g, pan=0.3 if s % 4 else -0.3)
        if bar % 4 == 3 and s >= 12 and it > 0.4: S.put('perc', taiko(R, [190, 160, 130, 100][s - 12], 0.4, 0.12), t, 0.7 * g, pan=[-0.4, -0.1, 0.2, 0.4][s - 12])   # a descending tom run closes every fourth bar
        if it > 0.45 and s in (4, 12): S.put('perc', frame_drum(R), t, 0.65 * g)
        if it > 0.5: S.put('perc', hat(R), t, (0.3 if s % 4 == 0 else 0.16) * g, pan=0.4)
        tr = BASS_BAR[bar % 8]
        if it > 0.3 and (it > 0.55 or s % 2 == 0): S.put('bass', bass_note(root + BASS_PAT[s] + tr), t, (1.0 if s % 4 == 0 else 0.7) * g)
        tb = int(rise_st * p)
        if it > 0.5 and ((bar % 2 == 0 and s in (0, 3, 6)) or (bar % 2 == 1 and s in (8, 10, 12))):
            r = root + 12 + tr + tb; long = (s == 0 and bar % 2 == 0)
            S.put('brass', brass(R, [r, r + 3, r + 7] + ([r + 13] if it > 0.85 else []), 0.46 if long else 0.15, decay=0.5 if long else 0.2), t, (1.0 if long else 0.85) * g, pan=0.0)
        if it > 0.6: S.put('str', strings(R, [root + 36 + (step % 2), root + 43], 0.07, 0.004, 0.02, 0, 1.4), t, 0.3 * g, pan=-0.5 if step % 2 else 0.5)
        if s == 0 and bar % 4 == 0 and bar > 0 and it > 0.5: S.put('fx', crash(R, 1.6), t, 0.4 * g)
        t += sd; step += 1
def sec_riser(S, R, L, P):
    t = tt(L); p = t / L; ph = 2 * np.pi * np.cumsum(100 * 2 ** (p * 4.0)) / SR
    x = (np.sin(ph) + 0.35 * (2 * ((ph / 2 / np.pi) % 1.0) - 1)) * p ** 2 * 0.5; S.put('fx', lp(x, 5000), 0, 1.0)
    nz = hp(R.normal(0, 1, len(t)), 700) * p ** 2.4 * (0.8 + 0.2 * np.sin(2 * np.pi * (6 + 18 * p) * t)); S.put('fx', nz * 0.55, 0, 1.0)
    for k, m0 in enumerate((50, 53, 58)):   # a minor cluster gliding up two octaves
        f = hz(m0) * 2 ** (p * 2.0); y = lp(2 * ((np.cumsum(f) / SR) % 1.0) - 1, 2400) * p ** 2.2 * 0.22; S.put('brass', y, 0, 1.0, pan=[-0.4, 0, 0.4][k])
    tp = 0.0
    while tp < L - 0.08:
        pp = tp / L; S.put('perc', taiko(R, 62, 0.4, 0.16, 0.3), tp, 0.35 + 0.8 * pp); tp += 0.52 * (1 - pp) ** 1.1 + 0.075
    S.put('sub', boom_sub(L, 40, 34, 3.0) * p ** 2 * 0.35, 0, 1.0)
def sec_tragic(S, R, L, P):
    cl = L / max(1, round(L / 2.8)); nch = max(1, round(L / cl)); CH = [[50, 53, 57, 62], [46, 53, 58, 62], [43, 50, 55, 58], [50, 53, 57, 62]]; MEL = [[(0.15, 69, 1.5)], [(0.1, 72, 0.8), (1.1, 70, 1.4)], [(0.1, 70, 1.0), (1.2, 67, 1.3)], [(0.1, 69, 2.0)]]
    sw = lambda t: 0.45 + 0.55 * np.clip(t / max(L, 0.1), 0, 1) ** 1.3
    for c in range(nch):
        t0 = c * cl; d = cl + 0.15
        S.put('str', strings(R, CH[c % 4], d, 0.5, 0.6, 0.004, 0.9), t0, 0.5 * sw(t0 + cl / 2) * 1.0)
        S.put('bass', lp(strings(R, [CH[c % 4][0] - 12], d, 0.35, 0.5, 0.0, 0.5), 300), t0, 1.0 * sw(t0 + cl / 2))
        for dt, m, dd in MEL[c % 4]: S.put('str', strings(R, [m + 12], dd, 0.12, 0.5, 0.006, 1.2, det=0.07), t0 + dt, 0.55 * sw(t0 + dt), pan=0.15)
        S.put('perc', taiko(R, 48, 1.4, 0.45, 0.2), t0, 0.7 * sw(t0 + cl / 2)); S.put('sub', boom_sub(1.6, 56, 34, 0.7) * 0.5, t0, sw(t0))
        if cl > 2.2: S.put('perc', taiko(R, 54, 0.9, 0.3, 0.1), t0 + cl * 0.5, 0.35 * sw(t0 + cl / 2))
def sec_doom(S, R, L, P):
    tp = 0.0; k = 0; iv = P.get('iv0', 0.34)
    while tp < L - 0.03:
        p = tp / L; S.put('perc', taiko(R, [52, 58][k % 2], 0.5, 0.2, 0.5), tp, 0.55 + 0.7 * p, pan=-0.1)
        if p > 0.25: S.put('bass', bass_note(38 + (k % 3 == 2), 0.1), tp, 0.7 * p)
        if p > 0.45: S.put('perc', taiko(R, [150, 120][k % 2], 0.25, 0.1, 0.3), tp + iv * 0.5, 0.5 * p, pan=0.3)
        tp += iv; iv = max(0.05, iv * 0.90); k += 1
    t = tt(L); p = t / L; ph = 2 * np.pi * np.cumsum(140 * 2 ** (p * 3.2)) / SR; S.put('fx', lp((np.sin(ph) + 0.4 * (2 * ((ph / 2 / np.pi) % 1) - 1)) * p ** 1.8 * 0.45, 5500), 0, 1.0)
    S.put('fx', hp(R.normal(0, 1, len(t)), 800) * p ** 2.0 * 0.5, 0, 1.0)
    for m0, pn in ((50, -0.4), (51, 0), (56, 0.4)): S.put('brass', lp(2 * ((np.cumsum(hz(m0) * 2 ** (p * 1.0)) / SR) % 1.0) - 1, 2600) * p ** 1.6 * 0.3, 0, 1.0, pn)
def one_sting(S, R, P):
    k = P.get('kind', 'blare'); b = 50 + P.get('pitch', 0)
    if k == 'blare':
        S.put('brass', brass(R, [b - 12, b, b + 1, b + 6, b + 12, b + 13], 0.5, 0.012, 0.35, 1.2, 0.9), 0, 0.9); S.put('sub', boom_sub(1.4, 76, 36, 0.6), 0, 1.0); S.put('perc', taiko(R, 50, 1.0, 0.4), 0, 1.0)
        S.put('fx', crash(R, 1.4), 0, 0.5); S.put('str', screech(R, 1900, 1300, 0.9), 0, 0.5)
    elif k == 'hit':
        S.put('brass', brass(R, [b, b + 7, b + 12, b + 13], 0.2, 0.01, 0.2, 1.1, 0.25), 0, 0.9); S.put('perc', taiko(R, 56, 0.7, 0.28), 0, 1.0); S.put('sub', boom_sub(0.6, 70, 38, 0.3), 0, 0.7); S.put('fx', crash(R, 0.7), 0, 0.2)
    elif k == 'bite':
        S.put('brass', brass(R, [b - 12, b, b + 6], 0.15, 0.01, 0.2, 1.0, 0.2), 0, 0.8); S.put('str', screech(R, 2300, 1500, 0.55), 0, 0.7); S.put('perc', taiko(R, 52, 0.6, 0.22), 0, 0.9)
    else: raise SystemExit('unknown sting kind ' + k)
def one_boom(S, R, P):
    S.put('sub', boom_sub(4.0, 90, 30, 1.5) * 1.4, 0, 1.0); S.put('perc', taiko(R, 40, 2.2, 0.8), 0, 1.4); S.put('perc', taiko(R, 56, 1.4, 0.5), 0.02, 1.0)
    S.put('brass', brass(R, [26, 38, 39, 44, 50, 51, 56, 62], 1.6, 0.012, 1.0, 1.1, 1.5), 0, 1.0); S.put('fx', crash(R, 3.0), 0, 0.9)
    S.put('str', strings(R, [74, 75, 80, 86], 1.6, 0.02, 1.2, 0.004, 1.6), 0, 0.5); S.put('fx', lp(R.normal(0, 1, int(3 * SR)), 110) * np.exp(-tt(3) / 1.6) * 3.0, 0, 0.7)
SECTIONS = {'dread': (sec_dread, 1.4, 0.4, -24.5), 'stalk': (sec_stalk, 1.2, 0.3, -22.0), 'chase': (sec_chase, 0.5, 0.0, -16.0), 'riser': (sec_riser, 0.0, 0.1, -19.0), 'tragic': (sec_tragic, 1.2, 0.6, -19.0), 'doom': (sec_doom, 0.0, 0.0, -15.0)}   # (function, ring s, fade-in s, target LUFS before the mix desk)
ONESHOTS = {'sting': (one_sting, 3.0, -14.5, {'hit': -18.5, 'bite': -16.5}), 'boom': (one_boom, 5.0, -11.0, {})}   # (function, ring s, target momentary-max LUFS, per-kind override)

DUCK_DB = {'warm': 13.0, 'dread': 3.0, 'stalk': 3.0, 'chase': 10.0, 'riser': 7.0, 'tragic': 8.0, 'doom': 0.0, 'sting': 9.0, 'boom': 0.0}   # how far each kind of music sinks while a line plays (the mix desk's sidechain is set to ratio 1 for this mood: the ducking is written here, in code, with a look-ahead)
def duck_state(info, n):
    """0..1 at the sample rate: 1 while a spoken line is on (starts 80 ms BEFORE the line so a hit in the gap before it has already sunk; attack 25 ms, release 250 ms)"""
    cr = 200; N = int(info['duration'] * cr) + 2; tgt = np.zeros(N)
    for v in info.get('lines', {}).values(): tgt[max(0, int((v['t0'] - 0.08) * cr)):int((v['t1'] + 0.12) * cr) + 1] = 1
    st = np.zeros(N); y = 0.0; ka = 1 - np.exp(-1 / (cr * 0.025)); kr = 1 - np.exp(-1 / (cr * 0.25))
    for i in range(N): y += (tgt[i] - y) * (ka if tgt[i] > y else kr); st[i] = y
    return np.interp(np.arange(n) / SR, np.arange(N) / cr, st)
def load_stereo(f): return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).T.copy()
def gen():
    info = json.load(open(os.environ['SCORE_INFO'])); DUR = info['duration']; out = os.environ['SCORE_OUT']; fade = float(os.environ.get('MUSIC_FADE', 0.35)); seed = int(info.get('seed', 57))
    segs = sorted(info['segs'], key=lambda s: s['t']); secs = [s for s in segs if s['seg'] in SECTIONS or s['seg'] in ('warm', 'silence')]; ovs = [s for s in segs if s['seg'] in ONESHOTS]
    for s in segs:
        if s['seg'] not in SECTIONS and s['seg'] not in ONESHOTS and s['seg'] not in ('warm', 'silence'): raise SystemExit('unknown zombie section ' + s['seg'])
    Lm = int((DUR + 6) * SR); sec_bus = np.zeros((2, Lm), np.float32); ov_bus = np.zeros((2, Lm), np.float32); gate = np.ones(Lm, np.float32); rep = []
    DS = duck_state(info, Lm)
    def add(dst, x, t0, kind=None, db=None):
        a = int(round(t0 * SR)); x = x[:, :max(0, Lm - a)]; d = DUCK_DB.get(kind, 0.0) if db is None else db
        if d: x = x * 10 ** (-d * DS[a:a + x.shape[1]] / 20)
        dst[:, a:a + x.shape[1]] += x
    for i, s in enumerate(secs):
        t0 = s['t']; t1 = s.get('to', secs[i + 1]['t'] if i + 1 < len(secs) else DUR); L = t1 - t0; name = s['seg']
        if L <= 0.02: continue
        if name == 'silence':
            a = int(t0 * SR); b = int(t1 * SR); fo = int(0.02 * SR); gate[max(0, a - fo):a] = np.linspace(1, 0, min(fo, a)); gate[a:b] = 0; fi = int(0.008 * SR); gate[b:b + fi] = np.minimum(gate[b:b + fi], np.linspace(0, 1, fi)) if b < Lm else gate[b:b + fi]
            rep.append(dict(t=round(t0, 3), seg=name, dur=round(L, 3))); continue
        if name == 'warm':
            tmp = os.path.join(os.path.dirname(out), f'warm_{i}.json'); json.dump(dict(duration=L, segs=[dict(seg='R', t=0.0)], shots=[], receipts=[], metas=[]), open(tmp, 'w')); wav = os.path.join(os.path.dirname(out), f'warm_{i}.wav')
            subprocess.run([f'{TD}/.venv/bin/python', f'{TD}/vo/score.py', '900', s.get('mood', 'home'), str(s.get('seed', 57))], env={**os.environ, 'SCORE_INFO': tmp, 'SCORE_OUT': wav, 'MUSIC_FADE': str(s.get('fade', 0.8))}, check=True, capture_output=True)
            x = load_stereo(wav); fi = int(s.get('fade_in', 0.12) * SR); x[:, :fi] *= np.linspace(0, 1, fi); x = x[:, :int(L * SR)] * 10 ** (s.get('level', 0) / 20); add(sec_bus, x, t0, 'warm', s.get('duck')); rep.append(dict(t=round(t0, 3), seg=name, dur=round(L, 3), lufs=round(lufs_of(x), 1))); continue
        fn, ring, fin, target = SECTIONS[name]; ring = 0.0 if s.get('cut') else ring; R = np.random.default_rng(seed * 1000 + i); S = Sec(L + ring); fn(S, R, L, s); x = S.mix(); n = int(L * SR)
        g = 10 ** ((target + s.get('level', 0) - lufs_of(x[:, :n])) / 20); x = x * g
        env = np.ones(x.shape[1], np.float32); f_in = int(s.get('fade_in', fin) * SR)
        if f_in > 1: env[:f_in] = np.linspace(0, 1, f_in) ** 1.5
        if x.shape[1] > n: env[n:] = np.cos(np.linspace(0, np.pi / 2, x.shape[1] - n)) ** 2
        env[max(0, n - int(0.02 * SR)):n] *= np.linspace(1, 1 if ring else 0, len(env[max(0, n - int(0.02 * SR)):n]))
        add(sec_bus, x * env, t0, name, s.get('duck')); rep.append(dict(t=round(t0, 3), seg=name, dur=round(L, 3), lufs=round(lufs_of(x[:, :n]), 1), gain_db=round(20 * np.log10(g), 1)))
    for j, s in enumerate(ovs):
        fn, ring, target, over = ONESHOTS[s['seg']]; kind = s.get('kind', 'blare'); target = over.get(kind, target) if s['seg'] == 'sting' else target
        R = np.random.default_rng(seed * 1000 + 500 + j); S = Sec(ring); fn(S, R, s); x = S.mix(); _, m = momentary(x, 0.4, 0.05); g = 10 ** ((target + s.get('level', 0) - m.max()) / 20)
        add(ov_bus, x * g, s['t'], s['seg'], s.get('duck')); rep.append(dict(t=round(s['t'], 3), seg=s['seg'], kind=kind, peak_momentary=round(float(m.max() + 20 * np.log10(g)), 1)))
    y = (sec_bus * gate + ov_bus)[:, :int(DUR * SR)]; fo = int(fade * SR); y[:, -fo:] *= np.linspace(1, 0, fo)
    y = 0.95 * np.tanh(y / 0.95)   # a soft ceiling (the mix desk limits again); the music is NOT peak-normalised: its loudness is set per section
    raw = out.replace('.wav', '_raw.wav'); subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', out], input=y.T.astype(np.float32).tobytes(), check=True)
    json.dump(sorted(rep, key=lambda r: r['t']), open(out.replace('.wav', '_report.json'), 'w'), indent=1)
    print(f'zombie score: {len(secs)} sections, {len(ovs)} one-shots, peak {np.abs(y).max():.2f} -> {out}')


def check():
    """loudness curve + voice-vs-bed table + silence audit + spectral balance + cue sheet, from the last `voice.py build` of the episode"""
    path = sys.argv[2]; B = json.load(open(path)); ID = B['id']; ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = f'{ROOT}/out/{ID}/audio'; T = json.load(open(f'{OUT}/times.json')); lines = {k: v for k, v in T['lines'].items() if k.startswith('l')}
    rep = json.load(open(f'{OUT}/music_report.json')); info = json.load(open(f'{OUT}/score_info.json')); DUR = T['dur']
    # the same graph as voice.py's mix, but with the three buses taken out separately, all at the one gain the real mix got
    sc = B.get('sc', {}); fc = ("[0:a]acompressor=threshold=0.1:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[vo1][vosc];[1:a]aresample=48000,volume=0.85[sfx];"
        f"[2:a]aresample=48000,volume={B.get('musicVol', 0.9)}[mus];[mus][vosc]sidechaincompress=threshold={sc.get('threshold', 0.02)}:ratio={sc.get('ratio', 8)}:attack=20:release=350:makeup=1[musd]")
    stem = lambda n: f'{OUT}/chk_{n}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/vo_all.wav', '-i', f'{OUT}/sfx.wav', '-i', f'{OUT}/music.wav', '-filter_complex', fc, '-map', '[musd]', '-t', str(DUR), '-ar', '48000', stem('mus'), '-map', '[vo1]', '-t', str(DUR), '-ar', '48000', stem('vo'), '-map', '[sfx]', '-t', str(DUR), '-ar', '48000', stem('sfx')], check=True)
    raw = subprocess.run(['ffmpeg', '-v', 'info', '-i', f'{OUT}/mix_raw.wav', '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr.splitlines(); I = float([l for l in raw if l.strip().startswith('I:')][-1].split()[1]); g = 10 ** ((-13.5 - I) / 20)
    ld = lambda f: (load_stereo(f) * g)
    mus, vo, sfx, mix = ld(stem('mus')), ld(stem('vo')), ld(stem('sfx')), load_stereo(f'{OUT}/mix.wav'); n = min(mus.shape[1], vo.shape[1], sfx.shape[1], mix.shape[1]); mus, vo, sfx, mix = mus[:, :n], vo[:, :n], sfx[:, :n], mix[:, :n]
    ml = lambda x, a, b: lufs_of(x[:, int(a * SR):max(int(a * SR) + 1, int(b * SR))]) if b > a else -99.0
    secs = [r for r in rep if r['seg'] not in ('sting', 'boom')]; ovs = [r for r in rep if r['seg'] in ('sting', 'boom')]
    def sec_at(t): return ([r for r in secs if r['t'] <= t] or [dict(seg='-')])[-1]['seg']
    def line_at(t): return next((k for k, v in lines.items() if v['t0'] <= t < v['t1']), '')
    screen = B.get('music', {}).get('screen', []); scr_at = lambda t: ([x[1] for x in screen if x[0] <= t] or [''])[-1]
    L = []; w = L.append
    mt, mm = momentary(mix, 3.0, 2.0)   # short-term (3 s) every 2 s
    w(f'# Cue sheet: {ID} ({DUR:.1f} s), mood zombie\n\nNobody has listened to this yet. Written by `tools/score_zombie.py check`; the numbers are measured from the real mix (music after the in-code ducking, voice after the mix desk, all at the one gain that puts the whole mix at -14 LUFS).\n')
    w('## Cue list (time, section, why)\n\n| time | section | why |\n|---|---|---|')
    ev = sorted([(s['t'], s['seg'] + (' (' + s.get('kind', 'blare') + ')' if s['seg'] == 'sting' else ''), s.get('why', '')) for s in info['segs']])
    for t, nm, why in ev: w(f'| {t:6.2f} | {nm} | {why} |')
    w('\n## Loudness curve: every 2 s (VO, bed and sfx are that block\'s loudness, LUFS; short-term = 3 s window of the whole mix)\n\n| t | on screen | section | line | VO | bed | sfx | mix short-term |\n|---|---|---|---|---|---|---|---|')
    for k in range(int(DUR // 2) + 1):
        a, b = 2.0 * k, min(DUR, 2.0 * k + 2.0); c = (a + b) / 2; i = min(len(mm) - 1, k)
        w(f'| {a:5.1f} | {scr_at(c)} | {sec_at(c)} | {line_at(c)} | {ml(vo, a, b):.1f} | {ml(mus, a, b):.1f} | {ml(sfx, a, b):.1f} | {mm[i]:.1f} |')
    w('\n## Voice vs bed during each line (bed = the music stem as mixed, loudest 400 ms inside the line; voice = the line itself)\n\n| line | t0-t1 | voice LUFS | bed max LUFS | margin dB | ok (>= 6) |\n|---|---|---|---|---|---|')
    worst = 99; bad = []
    for k, v in lines.items():
        a, b = v['t0'], v['t1']; seg = vo[:, int(a * SR):int(b * SR)]; vl = lufs_of(seg); bm = mus[:, int(a * SR):int(b * SR)]; _, m = momentary(bm, 0.4, 0.1); bed = float(m.max()) if len(m) else -99.0; mg = vl - bed; worst = min(worst, mg)
        if mg < 6: bad.append(k)
        w(f'| {k} | {a:.2f}-{b:.2f} | {vl:.1f} | {bed:.1f} | {mg:.1f} | {"yes" if mg >= 6 else "NO"} |')
    w(f'\nWorst margin {worst:.1f} dB' + (f', below 6 dB: {bad}' if bad else ', every line is at least 6 dB above the bed') + '.')
    w('\n## Intended silences (music stem after the mix desk, loudest 100 ms; a one-shot hit inside is intentional and is measured separately)\n\n| window | music max LUFS before the first one-shot | one-shots inside (time, loudest 100 ms after it) |\n|---|---|---|')
    for r in secs:
        if r['seg'] != 'silence': continue
        a, b = r['t'], r['t'] + r['dur']; ins = [o for o in ovs if a <= o['t'] < b]; e0 = ins[0]['t'] if ins else b; _, m = momentary(mus[:, int(a * SR):int(e0 * SR)], 0.1, 0.05) if e0 - a > 0.12 else (0, np.array([-120.7]))
        tail = ", ".join(f"{o['seg']}@{o['t']:.2f}: {float(momentary(mus[:, int(o['t'] * SR):int((o['t'] + 1) * SR)], 0.1, 0.05)[1].max()):.1f}" for o in ins) or "none"
        w(f'| {a:.2f}-{b:.2f} | {float(m.max()):.1f} | {tail} |')
    w('\n## Spectral balance per section (share of energy in the music file, %)\n\n| from | section | sub <80 | bass 80-250 | low-mid 250-1k | mid 1-4k | high >4k | loudness LUFS |\n|---|---|---|---|---|---|---|---|')
    mf = load_stereo(f'{OUT}/music.wav')
    for r in secs:
        if r['seg'] == 'silence': continue
        a, b = r['t'], r['t'] + r['dur']; x = mf[:, int(a * SR):int(b * SR)].mean(axis=0)
        if len(x) < 2048: continue
        P2 = np.abs(np.fft.rfft(x)) ** 2; fr = np.fft.rfftfreq(len(x), 1 / SR); tot = P2.sum() + 1e-12; sh = [P2[(fr >= lo) & (fr < hi)].sum() / tot * 100 for lo, hi in ((0, 80), (80, 250), (250, 1000), (1000, 4000), (4000, 24000))]
        w(f'| {a:.2f} | {r["seg"]} | ' + ' | '.join(f'{v:.0f}' for v in sh) + f' | {lufs_of(mf[:, int(a * SR):int(b * SR)]):.1f} |')
    pk = float(np.abs(mix).max()); hot = int((np.abs(mix) > 0.97).sum()); tp = [l for l in subprocess.run(['ffmpeg', '-v', 'info', '-i', f'{OUT}/mix.wav', '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'], capture_output=True, text=True).stderr.splitlines() if 'Input Integrated' in l or 'Input True Peak' in l]
    w(f'\n## Whole mix\n\n- {" ; ".join(t.strip() for t in tp)}\n- sample peak {20 * np.log10(pk):.2f} dBFS, samples above 0.97: {hot} (clipping: {"none" if pk < 0.999 else "YES"})\n- voice-only {lufs_of(vo):.1f} LUFS, bed-only {lufs_of(mus):.1f} LUFS, sfx-only {lufs_of(sfx):.1f} LUFS (whole length)')
    open(f'{OUT}/cue_sheet.md', 'w').write('\n'.join(L) + '\n'); print('\n'.join(L[-6:])); print('worst voice-vs-bed margin', round(worst, 1), 'dB; lines below 6:', bad)
if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'check': check()
    else: gen()
