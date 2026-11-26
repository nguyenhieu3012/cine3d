// GOAT Beef: live "facePlus" facial acting + English phoneme visemes for Ron & Leo (v3.0, 26/11/2026).
// Mirrors packs/trada/faceplus.js with zero external Rhubarb dependency:
//   - Eased per-channel emotion transitions (brows lead, eyes follow, mouth follows 2-3 frames after)
//   - Natural seeded blinks shifted off stressed words + blinks on big gaze/emotion switches
//   - Eye darts (saccades) + gaze-leads-head tracking
//   - Asymmetric brow pops on stressed words (ALL CAPS, numbers, !, *starred*) & question raises
//   - English text -> viseme mouth shapes (A: M/B/P closure, G: F/V teeth, F: O/U round, D: A wide, B: E/I smile)
// Pure function of `t` and episode data (Law 1); opt-in via `ep.facePlus: true` (off = legacy bit-identical).
import { clamp, lerp, smooth, overshoot, hash, fbm1 } from '../../core/util.js';

const TIM = {
  brow: [0, 0.14, 0.14],
  eye: [0.02, 0.16, 0.08],
  mouth: [0.075, 0.18, 0.06],
  blush: [0.05, 0.45, 0],
  sweat: [0.22, 0.32, 0],
  tear: [0.05, 0.42, 0],
};
const CH = {
  brow: 'brow', browL: 'brow', browR: 'brow', tilt: 'brow',
  smile: 'mouth', smirk: 'mouth', open: 'mouth', wide: 'mouth', teeth: 'mouth', tongue: 'mouth', skew: 'mouth',
  blush: 'blush', sweat: 'sweat', tear: 'tear',
};
const DISCRETE = new Set(['arc']);

const M_SHAPES = {
  A: { o: 0.0, mw: 0.90, th: 0.0 },   // M/B/P closed lips
  B: { o: 0.32, mw: 1.12, th: 0.9 },  // E/I/S/Z/T teeth
  C: { o: 0.62, mw: 1.08, th: 0.2 },  // mid vowel
  D: { o: 0.96, mw: 1.22, th: 0.35 }, // A/AH wide open
  E: { o: 0.62, mw: 0.84, th: 0.0 },  // O rounded
  F: { o: 0.38, mw: 0.64, th: 0.0 },  // U/OO/W tight round
  G: { o: 0.25, mw: 1.02, th: 0.95 }, // F/V upper teeth
  X: { o: 0.50, mw: 1.00, th: 0.15 },
};

const KIND = {
  ron: {
    sus: ['smug', 'sarcastic', 'angry', 'deadpan', 'unimpressed'],
    shock: ['shock', 'horror'],
    flush: { angry: 0.35, laugh: 0.25, happy: 0.15 },
    thr: 0.08, thrK: 0.95, browPop: 0.85,
  },
  leo: {
    sus: ['deadpan', 'unimpressed', 'sarcastic', 'smug', 'think'],
    shock: ['shock', 'horror'],
    flush: { angry: 0.25, laugh: 0.15, happy: 0.1 },
    thr: 0.08, thrK: 0.95, browPop: 0.52, // Leo stays drier / more deadpan than Ron
  },
};

const bump = (d, up, down) => (d < 0 ? 0 : d < up ? smooth(d / up) : 1 - smooth((d - up) / down));
const blinkShape = (d) => (d < 0 ? 0 : d < 0.048 ? smooth(d / 0.048) : d < 0.09 ? 1 : d < 0.19 ? 1 - smooth((d - 0.09) / 0.10) : 0);
const isHot = (raw) => {
  const w = raw.replace(/[*.,!?;:"“”…()']/g, '');
  return raw.includes('*') || /[0-9]/.test(w) || (/[A-Z]{2,}/.test(w) && w === w.toUpperCase()) || /!/.test(raw);
};

// Lightweight deterministic English word -> viseme sequence
function englishVisemes(raw, t0, t1) {
  const d = t1 - t0;
  if (d < 0.03) return [];
  const w = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!w) return [];
  const chunks = [];
  let i = 0;
  while (i < w.length && chunks.length < 5) {
    const sub = w.slice(i, i + 2);
    const ch = w[i];
    if (sub === 'oo' || sub === 'ou' || sub === 'ow') { chunks.push('F'); i += 2; continue; }
    if (sub === 'ee' || sub === 'ea' || sub === 'ie') { chunks.push('B'); i += 2; continue; }
    if (sub === 'th' || sub === 'sh' || sub === 'ch') { chunks.push('B'); i += 2; continue; }
    if (ch === 'm' || ch === 'b' || ch === 'p') chunks.push('A');
    else if (ch === 'f' || ch === 'v') chunks.push('G');
    else if (ch === 'u' || ch === 'w') chunks.push('F');
    else if (ch === 'o') chunks.push('E');
    else if (ch === 'a') chunks.push('D');
    else if (ch === 'e' || ch === 'i' || ch === 'y') chunks.push('B');
    else if (chunks.length === 0) chunks.push('C');
    i++;
  }
  const seq = chunks.length ? chunks : ['C'];
  const step = d / seq.length;
  return seq.map((code, idx) => [t0 + idx * step, t0 + (idx + 1) * step, code]);
}

export function makeFacePlus(ep, cast, cues = {}) {
  const lines = ep.lines || [], shots = ep.shots || [], names = Object.keys(cast);
  const kinds = {};
  for (const e of ep.cast || names) { const [n, k] = e.split(':'); kinds[n] = k || n; }

  const track = {};
  for (const n of names) track[n] = { emo: [{ t: -9, v: 'neutral' }], look: [] };
  lines.forEach((l) => { const tr = track[l.who]; if (tr && l.emo) tr.emo.push({ t: l.t0 - 0.06, v: l.emo }); });
  for (const a of ep.acts || []) {
    const tr = track[a.who]; if (!tr) continue;
    if (a.emo) tr.emo.push({ t: a.t, v: a.emo });
    if (a.look) tr.look.push({ t: a.t, v: a.look, d: a.d ?? 1e9 });
  }
  for (const n of names) for (const k of ['emo', 'look']) track[n][k].sort((a, b) => a.t - b.t);

  const at = (arr, t) => { let i = 0; while (i + 1 < arr.length && arr[i + 1].t <= t) i++; return [arr[Math.max(0, i - 1)], arr[i], i]; };
  const talkOf = (who, t) => {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; if (l.who !== who || l.think || t < l.t0 || t > l.t1) continue;
      const env = ep.lips?.[i];
      const edge = smooth((t - l.t0) / 0.05) * smooth((l.t1 - t) / 0.07);
      if (env) { const x = (t - l.t0) * 60, j = Math.floor(x); return clamp(lerp(env[j] ?? 0, env[j + 1] ?? env[j] ?? 0, x - j)) * edge; }
      return clamp(0.28 + 0.72 * Math.abs(Math.sin((t - l.t0) * 14 + i)) * (0.6 + 0.4 * fbm1(t * 5, i))) * edge;
    }
    return 0;
  };
  const talkMouth = (who, t) => (talkOf(who, t - 1 / 60) + 2 * talkOf(who, t) + talkOf(who, t + 1 / 60)) / 4;
  const speakerAt = (t) => lines.find((l) => !l.think && t >= l.t0 - 0.05 && t <= l.t1 + 0.05)?.who;
  const shotAt = (t) => shots.find((s) => t >= s.t0 && t < s.t1) || shots[shots.length - 1];

  const H = {};
  for (const n of names) {
    const kind = kinds[n], K = KIND[kind]; if (!K) continue;
    const seed = hash(n.length * 17.3 + (kind === 'leo' ? 23 : 11)) * 100;
    const partner = ep.partners?.[n] || names.find((m) => m !== n);
    const own = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.who === n && !l.think);

    const words = [], questions = [];
    for (const { l, i } of own) {
      const ws = String(l.text || '').split(/\s+/).filter(Boolean); if (!ws.length) continue;
      const weights = ws.map((w) => Math.max(1, w.replace(/[^a-z0-9]/gi, '').length + 1));
      const sumW = weights.reduce((a, b) => a + b, 0);
      let acc = 0;
      const W = ws.map((raw, k) => {
        const f0 = acc / sumW; acc += weights[k]; const f1 = acc / sumW;
        return { raw, t0: lerp(l.t0, l.t1, f0), t1: lerp(l.t0, l.t1, f1), hot: isHot(raw), line: l.id };
      });
      words.push(...W);
      W.forEach((w, k) => { if (/\?/.test(w.raw)) questions.push({ t0: W[Math.max(0, k - 1)].t0, t1: w.t1 + 0.2, sign: hash(k + i * 3.1) > 0.5 ? 1 : -1 }); });
    }
    const hot = words.filter((w) => w.hot);
    const onsets = [];
    for (const { l } of own) {
      let was = false;
      for (let tt = l.t0; tt <= l.t1 + 0.01; tt += 1 / 240) {
        const on = talkMouth(n, tt) * K.thrK > K.thr;
        if (on && !was) onsets.push(tt);
        was = on;
      }
    }
    const F = cast[n].faces, emoEv = [];
    track[n].emo.forEach((e, i) => {
      if (i === 0) return;
      const A = F[track[n].emo[i - 1].v] || F.neutral, B = F[e.v] || F.neutral;
      let d = 0;
      for (const k of ['brow', 'tilt', 'eye', 'size', 'arc', 'smile']) d += Math.abs((B[k] ?? 0) - (A[k] ?? 0));
      if (d > 0.02) emoEv.push({ t: e.t, v: e.v, d, blink: d > 0.42 || hash(e.t * 7.7 + seed) < 0.38 });
    });
    const norm = (v) => (v === partner ? 'partner' : v);
    const whatAt = (tt) => { const lk = track[n].look.filter((a) => tt >= a.t && tt < a.t + a.d).pop(), s2 = speakerAt(tt), sh = shotAt(tt); return norm(lk?.v || sh?.eyes?.[n] || (s2 && s2 !== n ? s2 : 'partner')); };
    const lookEv = [];
    { let prev = whatAt(0); for (let tt = 1 / 60; tt < (ep.dur || 60); tt += 1 / 60) { const w = whatAt(tt); if (w !== prev) lookEv.push({ t: tt, blink: hash(tt * 3.3 + seed) < 0.5 }); prev = w; } }

    const blinks = [];
    for (let k = -1; k * 2.9 < (ep.dur || 60) + 3; k++) {
      let tb = k * 2.9 + 0.25 + hash(k * 7.3 + seed * 31.7) * 2.2;
      for (const w of hot) if (tb > w.t0 - 0.14 && tb < w.t0 + 0.24) tb = w.t0 + 0.28;
      blinks.push(tb);
      if (hash(k * 3.1 + seed) > 0.80) blinks.push(tb + 0.24);
    }
    for (const e of emoEv) if (e.blink) blinks.push(e.t + 0.02);
    for (const e of lookEv) if (e.blink) blinks.push(e.t + 0.01);
    blinks.sort((a, b) => a - b);
    const bl2 = []; for (const b of blinks) if (!bl2.length || b - bl2[bl2.length - 1] > 0.22) bl2.push(b);

    const cu = (cues[n] && cues[n].length ? cues[n] : words.flatMap((w) => englishVisemes(w.raw, w.t0, w.t1))).slice().sort((a, b) => a[0] - b[0]);
    H[n] = { n, kind, K, F, seed, partner, own, words, hot, questions, onsets, emoEv, lookEv, blinks: bl2, cues: cu };
  }

  function faceAt(h, t, depth = 0) {
    const tr = track[h.n].emo, [e0, e1, i] = at(tr, t), B = h.F[e1.v] || h.F.neutral;
    const A = i > 0 ? (depth < 3 ? faceAt(h, e1.t - 1e-6, depth + 1).f : (h.F[e0.v] || h.F.neutral)) : B, d = t - e1.t, f = {};
    const kc = {};
    for (const ch in TIM) { const [dl, du, os] = TIM[ch]; const u = (d - dl) / du; kc[ch] = os ? overshoot(u, os) : smooth(u); }
    for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const a = A[key] ?? 0, b = B[key] ?? 0, k = kc[CH[key] || 'eye'];
      f[key] = typeof a === 'number' && typeof b === 'number' ? (DISCRETE.has(key) ? (k >= 0.5 ? b : a) : lerp(a, b, k)) : (k < 0.5 ? a : b);
    }
    return { f, e1 };
  }
  const dart = (t, seed) => {
    const P = 0.8, b = (j) => j * P + hash(j * 1.7 + seed) * 0.4; let k = Math.floor(t / P); if (t < b(k)) k--; if (t < b(k)) k--;
    const tg = (j) => (hash(j * 9.7 + seed) > 0.62 ? [0, 0] : [hash(j * 3.3 + seed) * 2 - 1, hash(j * 5.1 + seed + 9) * 2 - 1]), s = smooth((t - b(k)) / 0.05), a = tg(k - 1), c = tg(k);
    return [lerp(a[0], c[0], s), lerp(a[1], c[1], s)];
  };
  const spkW = (h, t) => { let a = 0; for (const { l } of h.own) a = Math.max(a, smooth((t - l.t0 + 0.12) / 0.12) * (1 - smooth((t - l.t1) / 0.15))); return a; };
  const shapeAt = (h, t) => {
    const cu = h.cues; if (!cu.length) return { s: M_SHAPES.C, cue: 'C' };
    const i = cu.findIndex((c) => t >= c[0] && t < c[1]); if (i < 0) return { s: M_SHAPES.X, cue: 'X' };
    const cur = M_SHAPES[cu[i][2]] || M_SHAPES.X;
    return { s: cur, cue: cu[i][2] };
  };

  const api = {
    on: false, H,
    handles: (n) => !!H[n],
    talkMouth,
    apply(n, c, p, t) {
      const h = H[n]; if (!api.on || !h) return p;
      const K = h.K, { f: f0, e1 } = faceAt(h, t), f = { ...f0 }, emo = e1.v, sd = h.seed;
      const spk = spkW(h, t), talk = p.talk || 0;
      const lastEv = h.emoEv.filter((e) => e.t <= t).pop(), dc = lastEv ? t - lastEv.t : 99;
      let eyeK = 1, sizeAdd = 0;
      if (K.shock.includes(emo)) sizeAdd += 0.10 * bump(dc - 0.03, 0.08, 0.32);
      if (K.sus.includes(emo)) eyeK *= (1 - 0.16 * bump(dc - 0.04, 0.1, 0.42));
      const dt = dart(t, sd), amp = lerp(0.24, 0.08, spk);
      let px = (f.px || 0) + dt[0] * amp, py = (f.py || 0) + dt[1] * amp * 0.55;
      if (p._lookAt && c.body && c.headWorld) {
        const V = c.root.position.constructor, hp = c.headWorld(new V());
        const v = new V(p._lookAt[0] - hp.x, p._lookAt[1] - hp.y, p._lookAt[2] - hp.z);
        const q = c.body.getWorldQuaternion(c.root.quaternion.clone()).invert(); v.applyQuaternion(q);
        const yaw = clamp(Math.atan2(v.x, v.z), -1.05, 1.05) * 0.9, pit = clamp(Math.atan2(v.y, Math.hypot(v.x, v.z)), -0.5, 0.6) * 0.8;
        px += clamp((yaw - (p.yaw || 0)) * 1.15, -0.65, 0.65); py -= clamp((pit - (p.pitch || 0)) * 1.05, -0.55, 0.55);
      }
      f.px = clamp(px, -0.95, 0.95); f.py = clamp(py, -0.75, 0.75);
      f.eye = clamp((f.eye ?? 1) * eyeK); f.size = (f.size || 1) + sizeAdd;

      let blink = 0;
      for (const b of h.blinks) { if (b > t + 0.01) break; if (t - b < 0.24) blink = Math.max(blink, blinkShape(t - b)); }

      let pop = 0, side = 1;
      for (const w of h.hot) { const dd = t - w.t0, v = smooth((dd + 0.04) / 0.08) * (1 - smooth((dd - 0.12) / 0.30)); if (v > pop) { pop = v; side = hash(w.t0 * 5.3 + sd) > 0.5 ? 1 : 0; } }
      let qr = 0; for (const q of h.questions) { const v = smooth((t - q.t0 + 0.05) / 0.14) * (1 - smooth((t - q.t1) / 0.30)); if (v > qr) qr = v; }
      const life = 0.10 * (p.talkSlow || 0) * spk;
      const bro = [0, 0];
      bro[side] += K.browPop * 0.65 * pop; bro[1 - side] += K.browPop * 0.26 * pop;
      bro[0] += 0.42 * qr + life; bro[1] += 0.42 * qr + life;

      const { s: S, cue } = shapeAt(h, t), oldOpen = talk * K.thrK > K.thr;
      let mo = talk * K.thrK;
      if (oldOpen) {
        let last = -9; for (const o of h.onsets) { if (o > t + 1e-6) break; last = o; }
        const guard = t - last < 0.065;
        mo = cue === 'A' && !guard ? Math.min(mo, K.thr * 0.6) : Math.max(K.thr + 0.03, clamp(S.o * (0.55 + 0.65 * talk)));
      }
      f.open = (f.open || 0) * (1 - 0.75 * spk);
      const fl = K.flush[emo] || 0;
      if (fl) f.blush = clamp((f.blush || 0) + fl * smooth(dc / 0.35));

      const faceX = { blink, bro, mo, mw: oldOpen ? S.mw : 1, th: oldOpen ? S.th : 0 };
      return { ...p, face: f, faceX };
    },
  };
  return api;
}
