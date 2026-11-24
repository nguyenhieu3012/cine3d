// Trà đá với AI: "faces plus" = richer ACTING of Tèo's and Bíp's drawn faces, for the face-texture export only (tools/dump.cjs --faces-plus).
// The faces are NOT redesigned: this file only computes numbers per frame (eased emotion changes, blinks, eye darts, brow pops, mouth shapes ...)
// and hands them to the characters' own drawFace() in chars.js as its optional last argument `xp` (null there = the film's picture, unchanged).
// Everything is a pure function of t and the episode data (Law 1): seeded hash noise only, nothing remembered between frames.
// Inputs besides the episode: Rhubarb mouth cues per character ({ teo: [[start, end, 'A'..'H'|'X'], ...] }, film seconds), computed by dump.cjs.
import { clamp, lerp, smooth, overshoot, hash, fbm1 } from '../../core/util.js';

// ---- emotion channels: brows lead, eyes a frame later, the mouth follows 2-3 frames (at 30 fps) after; colour and sweat are slow. [delay s, duration s, overshoot]
const TIM = { brow: [0, 0.16, 0.12], eye: [0.025, 0.18, 0.07], mouth: [0.085, 0.2, 0.06], blush: [0.06, 0.5, 0], sweat: [0.25, 0.35, 0], tear: [0.05, 0.45, 0] };
const CH = { brow: 'brow', tilt: 'brow', smile: 'mouth', open: 'mouth', wide: 'mouth', skew: 'mouth', gape: 'mouth', quiver: 'mouth', pucker: 'mouth', blush: 'blush', sweat: 'sweat', tear: 'tear' };   // any other key: eye
const DISCRETE = new Set(['arc', 'pin', 'gape', 'heart', 'wave', 'scan', 'pucker']);   // drawn as on / off at 0.5: switch at the middle of their channel, never extrapolate
// per character kind: which emotions read as suspicious (narrowing), shocked (widening), flushed, smug (smirk), worried (sweat drop), reading (scan flicker)
const KIND = {
  teo: { sus: ['smug', 'deadpan', 'angry', 'think'], shock: ['shock', 'terror', 'scream', 'dread'], flush: { angry: 0.3, moved: 0.15, happy: 0.1 }, smug: ['smug'], read: [],
    thr: 0.08, thrK: 0.95, open: 'eye',
    // Rhubarb shapes -> the existing mouth: o = openness, mw = width, rd = roundness, th = top teeth. X while the voice is on = a neutral open vowel
    M: { A: { o: 0, mw: 0.9, rd: 0, th: 0 }, B: { o: 0.3, mw: 1.08, rd: 0, th: 1 }, C: { o: 0.62, mw: 1.1, rd: 0, th: 0 }, D: { o: 0.95, mw: 1.18, rd: 0, th: 0 }, E: { o: 0.6, mw: 0.82, rd: 0.55, th: 0 },
      F: { o: 0.36, mw: 0.62, rd: 1, th: 0 }, G: { o: 0.24, mw: 1.02, rd: 0, th: 1 }, H: { o: 0.55, mw: 1, rd: 0, th: 0 }, X: { o: 0.5, mw: 1, rd: 0, th: 0 } } },
  bip: { sus: ['judge', 'smug', 'side', 'deadpan', 'think'], shock: ['shock'], flush: { angry: 0.25, love: 0.15, happy: 0.1, wavy: 0.1 }, smug: ['smug'], read: ['scan'],
    thr: 0.1, thrK: 1, open: 'h',
    dash: { judge: 0.78, deadpan: 0.84, side: 0.9, angry: 0.9, worry: 0.86, think: 0.88, sad: 0.92, happy: 1.1, love: 1.1 },   // the closed dash: shorter = tighter (his judging), longer = pleased
    M: { A: { o: 0, mw: 0.9, mh: 1 }, B: { o: 0.3, mw: 1.12, mh: 0.8 }, C: { o: 0.6, mw: 1.06, mh: 1 }, D: { o: 0.95, mw: 1.12, mh: 1.1 }, E: { o: 0.6, mw: 0.8, mh: 1.1 },
      F: { o: 0.42, mw: 0.62, mh: 1.15 }, G: { o: 0.25, mw: 1.06, mh: 0.8 }, H: { o: 0.55, mw: 1, mh: 1 }, X: { o: 0.5, mw: 1, mh: 1 } } },
};
const bump = (d, up, down) => (d < 0 ? 0 : d < up ? smooth(d / up) : 1 - smooth((d - up) / down));
const blinkShape = (d) => (d < 0 ? 0 : d < 0.05 ? smooth(d / 0.05) : d < 0.095 ? 1 : d < 0.2 ? 1 - smooth((d - 0.095) / 0.105) : 0);   // fast close, a held frame, slower open
const isHot = (raw) => { const w = raw.replace(/[*.,!?;:"“”…()]/g, ''); return raw.includes('*') || /[0-9]/.test(w) || (/\p{L}{2,}/u.test(w) && w === w.toUpperCase()) || /!/.test(raw); };   // the caption rule (CAPITALS, *starred*, digits) + a word carrying "!"

export function makeFacePlus(ep, cast, cues = {}) {
  const lines = ep.lines || [], shots = ep.shots || [], names = Object.keys(cast);
  const kinds = {}; for (const e of ep.cast || names) { const [n, k] = e.split(':'); kinds[n] = k || n; }
  // ---- the player's own tracks and mouth envelope, rebuilt the same way (core/player.js), so timing matches the film to the frame
  const track = {}; for (const n of names) track[n] = { emo: [{ t: -9, v: 'neutral' }], look: [] };
  lines.forEach((l) => { const tr = track[l.who]; if (tr && l.emo) tr.emo.push({ t: l.t0 - 0.06, v: l.emo }); });
  for (const a of ep.acts || []) { const tr = track[a.who]; if (!tr) continue; if (a.emo) tr.emo.push({ t: a.t, v: a.emo }); if (a.look) tr.look.push({ t: a.t, v: a.look, d: a.d ?? 1e9 }); }
  for (const n of names) for (const k of ['emo', 'look']) track[n][k].sort((a, b) => a.t - b.t);
  const at = (arr, t) => { let i = 0; while (i + 1 < arr.length && arr[i + 1].t <= t) i++; return [arr[Math.max(0, i - 1)], arr[i], i]; };
  const talkOf = (who, t) => { for (let i = 0; i < lines.length; i++) { const l = lines[i]; if (l.who !== who || l.think || t < l.t0 || t > l.t1) continue; const env = ep.lips?.[i]; const edge = smooth((t - l.t0) / 0.06) * smooth((l.t1 - t) / 0.08);
      if (env) { const x = (t - l.t0) * 60, j = Math.floor(x); return clamp(lerp(env[j] ?? 0, env[j + 1] ?? 0, x - j)) * edge; }
      return clamp(0.25 + 0.75 * Math.abs(Math.sin((t - l.t0) * 13 + i)) * (0.6 + 0.4 * fbm1(t * 5, i))) * edge; } return 0; };
  const talkMouth = (who, t) => (talkOf(who, t - 1 / 60) + 2 * talkOf(who, t) + talkOf(who, t + 1 / 60)) / 4;
  const speakerAt = (t) => lines.find((l) => t >= l.t0 - 0.05 && t <= l.t1 + 0.05)?.who;
  const shotAt = (t) => shots.find((s) => t >= s.t0 && t < s.t1) || shots[shots.length - 1];

  const H = {};
  for (const n of names) {
    const kind = kinds[n], K = KIND[kind]; if (!K) continue;
    const seed = hash(n.length * 13.7 + (kind === 'bip' ? 5 : 1)) * 100, partner = ep.partners?.[n] || names.find((m) => m !== n);
    const own = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.who === n && !l.think);
    // words of each own line, timed by the voice energy (Vietnamese is one syllable per word, so equal shares of voiced energy land close to each word)
    const words = [], questions = [];
    for (const { l, i } of own) {
      const ws = String(l.text || '').split(/\s+/).filter(Boolean); if (!ws.length) continue;
      const env = ep.lips?.[i], dur = l.t1 - l.t0, N = Math.max(2, Math.round(dur * 120)), cum = [0];
      for (let j = 1; j <= N; j++) { const tt = l.t0 + (j - 0.5) * dur / N, e = env ? Math.max(0, talkOf(n, tt) - 0.06) : 1; cum.push(cum[j - 1] + e); }
      const tot = cum[N] || 1, inv = (q) => { const y = q * tot; let j = 1; while (j < N && cum[j] < y) j++; const a = cum[j - 1], b = cum[j]; return l.t0 + (j - 1 + (b > a ? (y - a) / (b - a) : 0)) * dur / N; };
      const W = ws.map((raw, k) => ({ raw, t0: inv(k / ws.length), t1: inv((k + 1) / ws.length), hot: isHot(raw), line: l.id }));
      words.push(...W);
      W.forEach((w, k) => { if (/\?/.test(w.raw)) questions.push({ t0: W[Math.max(0, k - 1)].t0, t1: w.t1 + 0.2, sign: hash(k + i * 3.1) > 0.5 ? 1 : -1 }); });
    }
    const hot = words.filter((w) => w.hot);
    // voiced-segment onsets of the old mouth (the moments the film's mouth opens), for the onset guard
    const onsets = []; for (const { l } of own) { let was = false; for (let tt = l.t0; tt <= l.t1 + 0.01; tt += 1 / 240) { const on = talkMouth(n, tt) * K.thrK > K.thr; if (on && !was) onsets.push(tt); was = on; } }
    // events: emotion changes (with how big they are) and gaze-target changes
    const F = cast[n].faces, emoEv = [];
    track[n].emo.forEach((e, i) => { if (i === 0) return; const A = F[track[n].emo[i - 1].v] || F.neutral, B = F[e.v] || F.neutral; let d = 0; for (const k of ['brow', 'tilt', 'eye', 'size', 'h', 'w', 'round', 'arc']) d += Math.abs((B[k] ?? 0) - (A[k] ?? 0)); if (d > 0.02) emoEv.push({ t: e.t, v: e.v, d, blink: !(kind === 'bip' && (K.sus.includes(e.v) || K.read.includes(e.v))) && (d > 0.45 || hash(e.t * 7.7 + seed) < 0.4) }); });   // Bip's marker for 'now I judge you' is a scan sweep, not a blink
    const norm = (v) => (v === partner ? 'partner' : v);
    const whatAt = (tt) => { const lk = track[n].look.filter((a) => tt >= a.t && tt < a.t + a.d).pop(), s2 = speakerAt(tt), sh = shotAt(tt); return norm(lk?.v || sh?.eyes?.[n] || (s2 && s2 !== n ? s2 : 'partner')); };
    const lookEv = []; { let prev = whatAt(0); for (let tt = 1 / 60; tt < (ep.dur || 60); tt += 1 / 60) { const w = whatAt(tt); if (w !== prev) lookEv.push({ t: tt, blink: hash(tt * 3.3 + seed) < 0.55 }); prev = w; } }
    // blink times (a pure schedule): one per 2.8 s cell at a seeded moment, sometimes a double blink; moved off stressed words; plus blinks on big emotion / gaze changes
    const blinks = [];
    for (let k = -1; k * 2.8 < (ep.dur || 60) + 3; k++) {
      let tb = k * 2.8 + 0.25 + hash(k * 7.3 + seed * 31.7) * 2.1;
      for (const w of hot) if (tb > w.t0 - 0.15 && tb < w.t0 + 0.25) tb = w.t0 + 0.3;
      blinks.push(tb); if (hash(k * 3.1 + seed) > 0.78) blinks.push(tb + 0.25);
    }
    for (const e of emoEv) if (e.blink) blinks.push(e.t + 0.02);
    for (const e of lookEv) if (e.blink) blinks.push(e.t + 0.01);
    blinks.sort((a, b) => a - b); const bl2 = []; for (const b of blinks) if (!bl2.length || b - bl2[bl2.length - 1] > 0.22) bl2.push(b);   // never two closures in 0.22 s (they merge into one)
    // Rhubarb cues of this character, sorted
    const cu = (cues[n] || []).slice().sort((a, b) => a[0] - b[0]);
    H[n] = { n, kind, K, F, seed, partner, own, words, hot, questions, onsets, emoEv, lookEv, blinks: bl2, cues: cu };
  }

  // ---- the face at t: the emotion change eased per channel (recursive: a change that starts mid-change starts from what was on screen)
  function faceAt(h, t, depth = 0) {
    const tr = track[h.n].emo, [e0, e1, i] = at(tr, t), B = h.F[e1.v] || h.F.neutral;
    const A = i > 0 ? (depth < 3 ? faceAt(h, e1.t - 1e-6, depth + 1).f : (h.F[e0.v] || h.F.neutral)) : B, d = t - e1.t, f = {}, kc = {};
    for (const ch in TIM) { const [dl, du, os] = TIM[ch]; const u = (d - dl) / du; kc[ch] = os ? overshoot(u, os) : smooth(u); }
    for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) { const a = A[key] ?? 0, b = B[key] ?? 0, k = kc[CH[key] || 'eye'];
      f[key] = typeof a === 'number' && typeof b === 'number' ? (DISCRETE.has(key) ? (k >= 0.5 ? b : a) : lerp(a, b, k)) : (k < 0.5 ? a : b); }
    return { f, kc, e1, d };
  }
  // a seeded eye dart: holds a target 0.35-1.15 s, then moves to the next in 0.05 s (a saccade), sometimes back to centre
  const dart = (t, seed) => { const P = 0.75, b = (j) => j * P + hash(j * 1.7 + seed) * 0.4; let k = Math.floor(t / P); if (t < b(k)) k--; if (t < b(k)) k--;
    const tg = (j) => (hash(j * 9.7 + seed) > 0.62 ? [0, 0] : [hash(j * 3.3 + seed) * 2 - 1, hash(j * 5.1 + seed + 9) * 2 - 1]), s = smooth((t - b(k)) / 0.05), a = tg(k - 1), c = tg(k); return [lerp(a[0], c[0], s), lerp(a[1], c[1], s)]; };
  const spkW = (h, t) => { let a = 0; for (const { l } of h.own) a = Math.max(a, smooth((t - l.t0 + 0.12) / 0.12) * (1 - smooth((t - l.t1) / 0.15))); return a; };
  // mouth shape at t from the cues, cross-faded over 0.06 s at each boundary
  const shapeAt = (h, t) => { const M = h.K.M, cu = h.cues; if (!cu.length) return { s: M.C, cue: 'C' };
    let i = cu.findIndex((c) => t >= c[0] && t < c[1]); if (i < 0) return { s: M.X, cue: 'X' };
    const c = cu[i], cur = M[c[2]] || M.X; let o = null, k = 1;
    if (t - c[0] < 0.03 && i > 0 && Math.abs(cu[i - 1][1] - c[0]) < 1e-3) { o = M[cu[i - 1][2]] || M.X; k = smooth(0.5 + (t - c[0]) / 0.06); }
    else if (c[1] - t < 0.03 && i + 1 < cu.length && Math.abs(cu[i + 1][0] - c[1]) < 1e-3) { o = M[cu[i + 1][2]] || M.X; k = smooth(0.5 + (c[1] - t) / 0.06); }
    if (!o) return { s: cur, cue: c[2] }; const s = {}; for (const key in cur) s[key] = lerp(o[key], cur[key], k); return { s, cue: k >= 0.5 ? c[2] : '' + (cu[i + (t - c[0] < 0.03 ? -1 : 1)][2]) }; };

  const api = {
    on: false, ss: {}, last: {}, H,   // ss[n]: how much larger than its own size the face canvas is drawn (the export sets it; Bip's glow blur is scaled by it)
    handles: (n) => !!H[n],
    talkMouth,
    // returns the pose numbers with p.faceX added (the 3-D pose is not touched)
    apply(n, c, p, t) {
      const h = H[n]; if (!api.on || !h) return p;
      const K = h.K, { f: f0, kc, e1, d } = faceAt(h, t), f = { ...f0 }, emo = e1.v, sd = h.seed;
      const spk = spkW(h, t), talk = p.talk || 0, isBip = h.kind === 'bip';
      // --- eyes: change squint, shock widen, suspicion narrowing, darts, gaze leading the head
      const ev = h.emoEv.filter((e) => t >= e.t && t < e.t + 2.5).pop(), lastEv = h.emoEv.filter((e) => e.t <= t).pop(), dc = lastEv ? t - lastEv.t : 99;   // dc: time since the face REALLY changed (a line that repeats the same emotion is no change)
      let eyeK = 1, sizeAdd = 0;
      if (ev && !ev.blink) eyeK *= 1 - 0.3 * bump(t - ev.t, 0.06, 0.16);
      if (K.shock.includes(emo)) sizeAdd += 0.12 * bump(dc - 0.04, 0.08, 0.35);
      if (K.sus.includes(emo)) eyeK *= (1 - (isBip ? 0.1 : 0.2) * bump(dc - 0.05, 0.1, 0.45)) * (1 - (isBip ? 0.05 : 0.08) * smooth((dc - 0.4) / 1.8));   // Bip's bars stay thick
      const think = emo === 'think' ? 1 : 0, A = lerp(0.3, 0.08, spk) + 0.18 * think, dt = dart(t, sd);
      let px = (f.px || 0) + dt[0] * A, py = (f.py || 0) + dt[1] * A * 0.6;
      if (p._lookAt && c.body && c.headWorld) {   // gaze leads the head: the eyes reach the new target at once, the head (averaged over 0.3 s by the player) catches up and the eyes come back
        const V = c.root.position.constructor, hp = c.headWorld(new V()), v = new V(p._lookAt[0] - hp.x, p._lookAt[1] - hp.y, p._lookAt[2] - hp.z), q = c.body.getWorldQuaternion(c.root.quaternion.clone()).invert(); v.applyQuaternion(q);
        const yaw = clamp(Math.atan2(v.x, v.z), -1.05, 1.05) * 0.9, pit = clamp(Math.atan2(v.y, Math.hypot(v.x, v.z)), -0.5, 0.6) * 0.8;
        px += clamp((yaw - (p.yaw || 0)) * 1.3, -0.7, 0.7); py -= clamp((pit - (p.pitch || 0)) * 1.2, -0.6, 0.6);
      }
      f.px = clamp(px, isBip ? -1 : -0.95, isBip ? 1 : 0.95); f.py = clamp(py, -0.8, 0.8);
      if (isBip) f.h = Math.max(0.3, (f.h ?? 1) * eyeK); else { f.eye = clamp((f.eye ?? 1) * eyeK); f.size = (f.size || 1) + sizeAdd; }
      // --- blink
      let blink = 0; for (const b of h.blinks) { if (b > t + 0.01) break; if (t - b < 0.25) blink = Math.max(blink, blinkShape(t - b)); }
      // --- brows / bars: pops on stressed words (one side leads), a raise on questions, a little life with the voice
      let pop = 0, side = 1; for (const w of h.hot) { const dd = t - w.t0, v = smooth((dd + 0.04) / 0.08) * (1 - smooth((dd - 0.12) / 0.33)); if (v > pop) { pop = v; side = hash(w.t0 * 5.3 + sd) > 0.5 ? 1 : 0; } }
      let qr = 0, qs = 1; for (const q of h.questions) { const v = smooth((t - q.t0 + 0.05) / 0.15) * (1 - smooth((t - q.t1) / 0.35)); if (v > qr) { qr = v; qs = q.sign; } }
      const life = 0.12 * (p.talkSlow || 0) * spk;
      const bro = [0, 0]; bro[side] += 0.7 * pop; bro[1 - side] += 0.28 * pop; bro[0] += 0.5 * qr + life; bro[1] += 0.5 * qr + life;
      // --- mouth: Rhubarb shape x the film's own loudness. Closed in silence exactly as before; opens on the same frames (guard after each onset); M/B/P (A) may close it mid-word
      const { s: S, cue } = shapeAt(h, t), oldOpen = talk * K.thrK > K.thr;
      let mo = talk * K.thrK;
      if (oldOpen) { let last = -9; for (const o of h.onsets) { if (o > t + 1e-6) break; last = o; } const guard = t - last < 0.07;
        mo = cue === 'A' && !guard ? Math.min(mo, K.thr * 0.6) : Math.max(K.thr + 0.03, clamp(S.o * (0.55 + 0.65 * talk))); }
      f.open = (f.open || 0) * (1 - 0.75 * spk);   // a face with an open mouth (angry, shock) lets the speech shapes through while he talks
      // --- extras
      const fl = K.flush[emo] || 0; if (fl) f.blush = (f.blush || 0) + fl * smooth((dc - 0.1) / 0.9);
      const skw = clamp(f.skew || 0); let smirk = 0;
      if (K.smug.includes(emo)) { let tw = 0; for (let j = Math.floor(t / 2.6) - 1; j <= Math.floor(t / 2.6); j++) { const tt = j * 2.6 + 0.4 + hash(j * 4.1 + sd) * 1.6; tw = Math.max(tw, bump(t - tt, 0.08, 0.35)); } smirk = skw * (0.35 + 0.65 * tw) * (1 - 0.7 * clamp(mo * 4)); }
      const x = { face: f, skw, blink, mo, mw: S.mw ?? 1, ss: api.ss[n] || 1, cue, pop, qr, spk, emo, kc };
      if (isBip) {
        // bars stay flat and thick: they pop / narrow in height only, a slight common tilt on questions, a scan sweep when he starts to judge, cheek glow pulses
        x.hk = [1 + (side === 0 ? 0.16 : 0.06) * pop + 0.08 * qr, 1 + (side === 1 ? 0.16 : 0.06) * pop + 0.08 * qr];
        x.rot = 0.05 * qr * qs + 0.012 * fbm1(t * 0.4, sd + 3);
        let sa = 0, sx = 0; if (K.sus.includes(emo) || K.read.includes(emo)) { const u = clamp((dc - 0.05) / 0.4); if (u > 0 && u < 1) { sa = Math.sin(Math.PI * u) * 0.75; sx = lerp(-1, 1, smooth(u)); } }
        if (K.read.includes(emo) && dc > 0.5) { const u = ((dc - 0.5) % 1.4) / 0.34; if (u < 1) { sa = Math.max(sa, Math.sin(Math.PI * u) * 0.6); sx = lerp(1, -1, smooth(u)); } }
        x.scanA = sa; x.scanX = sx;
        const dl0 = K.dash[track[n].emo[at(track[n].emo, t)[2] - 1]?.v] ?? 1, dl1 = K.dash[emo] ?? 1; x.dash = lerp(dl0, dl1, clamp(kc.mouth)) * (cue === 'A' && spk > 0.5 ? 0.85 : 1);
        x.mh = S.mh ?? 1; f.blush = (f.blush || 0) * (1 + 0.3 * pop + 0.12 * (p.talkSlow || 0)) + 0.05 * Math.sin(t * 2.1 + sd);
      } else {
        x.bro = bro; x.round = S.rd || 0; x.teeth = S.th || 0; x.smirk = smirk;
        const P = 1.8, ph = ((t + hash(sd) * P) % P) / P; x.sweatK = Math.pow(clamp(ph / 0.7), 1.6); x.sweatA = smooth(ph / 0.08) * (1 - smooth((ph - 0.7) / 0.18));   // one drop forms, slides down (speeding up), fades; then the next
      }
      api.last[n] = { t, emo, cue, blink, mo, oldMo: talk * K.thrK, oldOpen: oldOpen ? 1 : 0, open: mo > K.thr ? 1 : 0, px: f.px, py: f.py, bro: isBip ? x.hk : bro, pop, qr, eye: isBip ? f.h : f.eye, size: f.size, blush: f.blush, mw: x.mw, round: x.round ?? null, mh: x.mh ?? null, dash: x.dash ?? null, scan: x.scanA ?? null, smirk: x.smirk ?? null, kc: [kc.brow, kc.eye, kc.mouth].map((v) => Math.round(v * 1e3) / 1e3) };
      return { ...p, faceX: x };
    },
  };
  return api;
}
