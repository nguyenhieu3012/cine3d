// cine3d core: act2 = an opt-in ACTING LAYER (22/11). Ideas ported from the Blender route's acting layer (blender/cast_rig.py: anticipation, follow-through, two hand
// springs, head leads body, beat gestures, listening nods, weight shifts), re-built so that every number is a PURE FUNCTION OF t:
//   - hands: a pose change is a step in the hand target. A damped spring's response to a step is a closed-form curve R(tau), and springs are linear, so the hand
//     is  P0 + sum_k  delta_k * R(t - t_k)  over the pose changes k of the episode. No simulation, no state: any frame, any order, any worker gives the same bits.
//     Anticipation (a small pull back a few frames before) is the same trick: the input A(t) = T(t) - a (T(t + lead) - T(t)) is two steps, so R = (1 + a) s(tau) - a s(tau + lead).
//   - head: the look target is sampled over the last 0.5 s (at 60 Hz) and weighted with the spring's impulse response = the spring's answer to the target history, exactly
//     (a direct convolution, so a target that moves by itself, a speaker change, a glance, is followed with follow-through and no stored state).
//   - torso: follows the hands (twist, lean) with a slower spring, the same closed form.
//   - beats (stressed syllables), listening nods, glances, blinks: tables built ONCE from the episode data (lines + mouth envelopes), then evaluated at t.
// A cut never carries anything: nothing here is simulated per shot; the curves are continuous over the whole film, so a cut shows the action where it really is.
// Off = the engine is untouched (player.js never calls into this file). On: ep.act2 = true | { gain, skip: ['bongden'], hands, head, torso, beats, listen, face, life, post: 0|1 ... }
// or the page flag &act2=1 (tools/render.cjs --q "act2=1"; tools/qa.cjs "episodes/x.js&act2=1"); &a2_<knob>=<number> overrides one knob of ACT2 for a test.
import * as THREE from 'three';
import { clamp, lerp, smooth, overshoot, hash, noise1 } from './util.js';
import { usesLegs, blinkGate } from './rig.js';

export const ACT2 = {
  gain: 1,                       // global amplitude of everything below that is a "motion on top" (not the spring timing)
  // ---- hands: two springs (screen-left hand, screen-right hand) so the hands never land on the same frame ----
  handL: { f: 2.15, z: 0.66, lead: 0.085, delay: 0 },        // spring Hz, damping ratio (overshoot 6 %), anticipation lead (s), delay (s)
  handR: { f: 2.45, z: 0.70, lead: 0.065, delay: 0.035 },
  antiMax: 0.028, antiAmt: 0.28,  // pull back at most 2.8 cm, and at most 28 % of the move, before the move
  ramp: 0.15,                    // s: a pose change is a ramp of this length into the spring (no jolt at the start)
  lockCustom: 1,                 // 1 = a pose the episode defines keeps the engine's own ease (props are placed by it); 0 = spring those too (episodes with nothing tied to the hand)
  busyZ: 0.95,                   // damping towards a contact pose (hands on the head, arms crossed, a phone: no overshoot). A pose the EPISODE defines (ep.poses) keeps the engine's own ease exactly: its props (a knob under the hand) are placed by that law
  // ---- torso follows the hands, slower ----
  torso: { f: 1.45, z: 0.8, delay: 0.06 }, twistK: 0.3, twistMax: 0.07, leanK: 0.1, leanMax: 0.02,
  // ---- head: spring on the look target; leads the body by a few frames ----
  head: { f: 2.5, z: 0.6, lead: 0.09, box: 0.1 }, torsoYaw: 0.1,   // torso follows the head's yaw (the engine's 0.12 x the fast yaw, now x0.07 of a slow one)
  // ---- beats: stressed syllables of that character's voice ----
  beat: { thr: 0.42, rel: 0.62, rise: 0.2, gap: 0.36, hand: 0.03, jab: 0.04, head: 0.03, lean: 0.01, attack: 0.075, release: 0.2, headLead: 0.05, leanLead: 0.025 },
  // ---- listening ----
  nodRate: 0.42, nodGap: 1.3, nodAmp: 0.04, nodDelay: 0.14, tilt: 0.045, glance: 0.07, glanceEye: 0.7, glanceCell: 3.9, glanceProb: 0.5,
  // ---- always ----
  sway: { x: 0.003, roll: 0.006, lean: 0.006, period: 5.8 },   // slow weight shift on the seat (seated characters only)
  breath: 0.0016,                // m: extra rise of the body on the in-breath (the engine's own breathing stays)
  body: { def: [0.205, 0.17], bip: [0.2, 0.2] },   // torso keep-out ellipse (x, z) in the character's frame, hand size included
  drift: 0.0035,                 // m: hand micro-drift
  blinkP: 0.6,                   // share of gaze changes that carry a blink
};

// Springs. A pose change is a step in the hand target, softened by a short cosine ramp (W) so the start is not a jolt; the answer of a damped spring to that
// ramped step is tabled ONCE (480 Hz, numeric convolution of the closed-form step response with the ramp) and looked up by time: a pure function of tau.
const SETTLE = 2.3;                                   // s: after this a response is exactly 1
const stepR = (tau, f, z) => { if (tau <= 0) return 0; const zc = Math.min(z, 0.999), w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - zc * zc); return 1 - Math.exp(-zc * w * tau) * (Math.cos(wd * tau) + (zc * w / wd) * Math.sin(wd * tau)); };
const mkTab = (f, z, W) => { const dt = 1 / 480, n = Math.ceil(SETTLE / dt) + 1, T = new Float64Array(n), M = 24; for (let i = 0; i < n; i++) { let a = 0; for (let j = 0; j < M; j++) { const u0 = j / M, u1 = (j + 1) / M, w = 0.5 - 0.5 * Math.cos(Math.PI * u1) - (0.5 - 0.5 * Math.cos(Math.PI * u0)); a += w * stepR(i * dt - (u0 + u1) / 2 * W, f, z); } T[i] = a; } T.dt = dt; return T; };
const tabAt = (T, tau) => { if (tau <= 0) return 0; const x = tau / T.dt, i = Math.floor(x); if (i >= T.length - 1) return 1; return T[i] + (T[i + 1] - T[i]) * (x - i); };
const resp = (tau, h, amt) => (h.old ? overshoot(tau / 0.34, 0.07) : tau <= -h.lead ? 0 : tau >= SETTLE ? 1 : (1 + amt) * tabAt(h.tab, tau) - amt * tabAt(h.tab, tau + h.lead));
const kernel = (f, z, dt, len) => { const zc = Math.min(z, 0.999), w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - zc * zc), n = Math.ceil(len / dt), k = new Float64Array(n); let s = 0; for (let j = 0; j < n; j++) { k[j] = Math.exp(-zc * w * j * dt) * Math.sin(wd * j * dt); s += k[j]; } for (let j = 0; j < n; j++) k[j] /= s || 1; return k; };
const CONTACT = new Set(['phone', 'cross', 'cup', 'chin', 'head', 'facepalm', 'hug', 'cover', 'grip', 'beg', 'clasp', 'gag', 'ticket', 'drive']);
const TABLE = { top: 0.4775, x: [-0.43, 0.43], z: [0.17, 0.67] };   // the stall table (world), packs/trada/stall.js
const bsearch = (arr, x) => { let a = 0, b = arr.length; while (a < b) { const m = (a + b) >> 1; if (arr[m].t < x) a = m + 1; else b = m; } return a; };

export function makeAct2({ ep, cast, names, lines, track, talkOf, spkK, fxAt }) {
  const cfg = typeof ep.act2 === 'object' ? ep.act2 : {}, K = { ...ACT2, ...cfg }, G = K.gain, on = (k) => cfg[k] !== 0 && cfg[k] !== false;
  const skip = new Set(cfg.skip || []), who = names.filter((n) => !skip.has(n) && cast[n].faces && cast[n].poses);
  const isCustom = (n, v) => !!ep.poses?.[n]?.[v];
  const busyPose = (n, v, P, s) => { if (CONTACT.has(v) || isCustom(n, v)) return true; const d = P[v] || P.rest; if (!d) return false; for (const k in d) if (k !== 'l' && k !== 'r' && k !== 'shrug' && typeof d[k] === 'number' && d[k] > 0.5 && !(k === 'phone' || k === 'cup') ) return true; return (s === 1 && !!(d.phone || d.cup)); };
  const tab = ep.set === 'stall' ? (typeof cfg.table === 'object' ? { ...TABLE, ...cfg.table } : TABLE) : (cfg.table ? { ...TABLE, ...cfg.table } : null);
  // ---- order-free look angles (see pose()) ----
  const hy0 = {}; for (const n of names) hy0[n] = cast[n].headY;
  const _hp = new THREE.Vector3(), _tp = new THREE.Vector3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), api = { camUsed: false };
  const liftOf = (c) => (c.stand ? 0 : (c.standLift ?? (c.faces?.neutral && 'h' in c.faces.neutral && !('eye' in c.faces.neutral) ? 0.15 : 0.36)));
  const headC = (c, out, t) => c.root.localToWorld(out.set(0, hy0[c.name] + liftOf(c) * clamp((fxAt(c.name, t).stand ?? ep.castOpts?.[c.name]?.stand ?? 0)), 0));
  const targetC = (c, what, camPos, t) => { const other = cast[ep.partners?.[c.name]] || cast[names.find((n) => n !== c.name)];
    if (what === 'cam') { api.camUsed = true; return _tp.copy(camPos); }
    if (what === 'down') return headC(c, _tp, t).add(_v.set(0, -0.5, 0.6).applyQuaternion(c.root.getWorldQuaternion(_q)));
    if (what === 'up') return headC(c, _tp, t).add(_v.set(0.2, 0.6, 0.8));
    if (what === 'away') return headC(c, _tp, t).add(_v.set(other && other.root.position.x > c.root.position.x ? -1 : 1, 0, 0.6));
    const o2 = cast[what] || other; if (!o2) { api.camUsed = true; return _tp.copy(camPos); }
    return headC(o2, _tp, t).lerp(_v.copy(camPos).setY(_tp.y), ep.cheat ?? 0.5); };
  const anglesC = (c, what, camPos, t) => { const tg = targetC(c, what, camPos, t); headC(c, _hp, t); _v.subVectors(tg, _hp); c.root.getWorldQuaternion(_q).invert(); _v.applyQuaternion(_q);
    return [clamp(Math.atan2(_v.x, _v.z), -1.05, 1.05), clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.5, 0.6)]; };
  const S = {}, TAB = {};   // per character data, built once
  const tabFor = (H, z, W) => { const key = H.f + '/' + z + '/' + W; return TAB[key] ||= mkTab(H.f, z, W); };
  const TT = mkTab(K.torso.f, K.torso.z, K.ramp * 1.4), dtS = 1 / 60, KH = (() => { const k0 = kernel(K.head.f, K.head.z, dtS, 0.5), B = Math.max(1, Math.round(K.head.box / dtS)), k = new Float64Array(k0.length + B - 1); for (let j = 0; j < k0.length; j++) for (let b = 0; b < B; b++) k[j + b] += k0[j] / B; return k; })(), KT = kernel(1.3, 0.85, dtS, 0.9), NS = KT.length + 3;

  // ---- tables built once from the episode: beats of every voice ----
  const beatList = []; const env60 = (i, l) => { const e = ep.lips?.[i]; if (e && e.length) return e; const n = Math.max(2, Math.round((l.t1 - l.t0) * 60)), a = new Float32Array(n); for (let j = 0; j < n; j++) a[j] = talkOf(l.who, l.t0 + j / 60); return a; };
  lines.forEach((l, i) => { if (l.think || !who.includes(l.who)) return; const E = env60(i, l), n = E.length, m = (j) => (E[j - 1] + 2 * E[j] + E[j + 1]) / 4;
    let mx = 0; for (let j = 0; j < n; j++) mx = Math.max(mx, E[j]); const thr = Math.max(K.beat.thr, K.beat.rel * mx); let last = -1e9;
    for (let j = 3; j < n - 3; j++) { const v = m(j); let lo = 9; if (v < thr) continue; let top = true, mn = 9; for (let q = -3; q <= 3; q++) if (m(Math.min(n - 2, Math.max(1, j + q))) > v + 1e-9) top = false; if (!top) continue;
      for (let q = Math.max(1, j - 9); q < j; q++) mn = Math.min(mn, m(q)); if (v - mn < K.beat.rise) continue; const tb = l.t0 + j / 60; if (tb - last < K.beat.gap) continue; last = tb; beatList.push({ t: tb, who: l.who, amp: clamp(v / Math.max(0.5, mx) * 0.9 + 0.1, 0.45, 1), line: i }); } });
  beatList.sort((a, b) => a.t - b.t);
  const beatsOf = {}; for (const n of who) { beatsOf[n] = beatList.filter((b) => b.who === n); beatsOf[n].forEach((b, k) => { b.k = k; }); }
  // listening nods: on a beat of somebody else's voice, now and then (never twice within nodGap), after a short reaction delay
  const nodsOf = {}; for (const n of who) { const out = []; let last = -1e9; for (const b of beatList) { if (b.who === n) continue; const tn = b.t + K.nodDelay; if (tn - last < K.nodGap) continue; if (hash(b.t * 7.31 + n.length * 3.7 + n.charCodeAt(0)) > K.nodRate) continue;
      if (lines.some((l) => l.who === n && !l.think && tn >= l.t0 - 0.1 && tn <= l.t1)) continue; last = tn; out.push({ t: tn, amp: 0.7 + 0.3 * hash(b.t * 3.3), t0: tn }); } nodsOf[n] = out; }
  // blink gate (gate fix 21/11), closed form in t, built once from the episode data: a blink that would be on screen (onset g, lasts 0.16 s) is dropped when it overlaps
  //   - the first 0.5 s of any shot (every shot opens with the eyes as the face draws them), or
  //   - a line that is shouted / a shock (emo shock | angry, `shout`, or its text ends in "!"), or the LAST line of a shot (the line that starts last among those spoken in that shot)
  const BLINK = 0.16, quiet = []; for (const sh of ep.shots || []) quiet.push([sh.t0 - BLINK, sh.t0 + 0.5]);
  { const sp = lines.filter((l) => !l.think && l.t1 > l.t0); for (const l of sp) if (l.shout || l.emo === 'shock' || l.emo === 'angry' || /!\s*["”]?$/.test(l.text || '')) quiet.push([l.t0 - BLINK, l.t1]);
    for (const sh of ep.shots || []) { let last = null; for (const l of sp) if (l.t0 < sh.t1 && l.t1 > sh.t0 && (!last || l.t0 > last.t0)) last = l; if (last) quiet.push([last.t0 - BLINK, last.t1]); } }
  const noBlink = (g) => quiet.some(([a, b]) => g > a && g < b);
  blinkGate.fn = noBlink;   // the engine's own periodic blink (core/rig.js blink) obeys the same gate
  // gaze changes (the listener turns to the new speaker, an explicit look): a blink rides on most of them
  const gazeOf = {}; for (const n of who) { const out = []; for (const l of lines) if (!l.think && l.who !== n) out.push({ t: l.t0 + 0.02, id: l.t0 }); for (const a of track[n].look) out.push({ t: a.t + 0.02, id: a.t }); out.sort((a, b) => a.t - b.t); gazeOf[n] = out.filter((g) => hash(g.id * 5.1 + n.length) < K.blinkP && !noBlink(g.t)); }
  // hand changes: per character, the list of pose changes with the hand deltas and the spring settings of each
  for (const n of who) { const c = cast[n], P = c.poses, tr = track[n].pose, pv = (v) => P[v] || P.rest; const ch = []; let prev = pv(tr[0].v), pn = tr[0].v;
    for (let k = 1; k < tr.length; k++) { const cur = pv(tr[k].v), cn = tr[k].v; if (cn === pn) continue;
      const rec = { t: tr[k].t, from: pn, to: cn, h: [] };
      for (let s = 0; s < 2; s++) { const a = s ? prev.r : prev.l, b = s ? cur.r : cur.l, d = [(b[0] - a[0]), (b[1] - a[1]), (b[2] - a[2])], len = Math.hypot(d[0], d[1], d[2]), busy = busyPose(n, pn, P, s) || busyPose(n, cn, P, s), H = s ? K.handR : K.handL;
        rec.h.push({ d, H: K.lockCustom && (isCustom(n, pn) || isCustom(n, cn)) ? { old: true, delay: 0 } : { ...H, tab: tabFor(H, busy ? K.busyZ : H.z, K.ramp) }, busy, amt: busy || len < 0.012 ? (busy ? 0.08 : 0) : Math.min(K.antiAmt, K.antiMax / len) }); }
      ch.push(rec); prev = cur; pn = cn; }
    S[n] = { x0: c.body.position.x, y0: c.body.position.y, z0: c.body.position.z, hy: c.head.position.y, base: pv(tr[0].v), ch, seed: (n.charCodeAt(0) * 7 + n.length * 13) % 17 }; }

  const tableW = (c, x, z) => { if (!tab) return 0; const p = c.root.position, yw = c.root.rotation.y, co = Math.cos(yw), si = Math.sin(yw), wx = p.x + x * co + z * si, wz = p.z - x * si + z * co, e = 0.03; return smooth((wx - tab.x[0]) / e) * smooth((tab.x[1] - wx) / e) * smooth((wz - tab.z[0]) / e) * smooth((tab.z[1] - wz) / e); };
  const inTable = (c, x, z) => { if (!tab) return false; const p = c.root.position, yw = c.root.rotation.y, co = Math.cos(yw), si = Math.sin(yw), wx = p.x + x * co + z * si, wz = p.z - x * si + z * co; return wx > tab.x[0] && wx < tab.x[1] && wz > tab.z[0] && wz < tab.z[1]; };

  // ---- the layer: takes the pose the engine computed (out) and returns it with the acting added ----
  // info: { v0, v1, t1, kp, angAt(tt) -> [yaw, pitch] of the look target at tt, standing }
  function pose(out, c, t, tReal, info) {
    const n = c.name, D = S[n];
    const spkC = (m, tt) => { let a = 0; for (const l of lines) if (l.who === m && !l.think) a = Math.max(a, smooth((tt - (l.t0 - 0.05)) / 0.25) * smooth((l.t1 + 0.05 - tt) / 0.25)); return a; };   // is-speaking as a continuous ramp (the engine's spkK steps in 25 Hz stairs)
    const kp = clamp(info.kp), P = c.poses, busy0 = [busyPose(n, info.v0, P, 0), busyPose(n, info.v0, P, 1)], busy1 = [busyPose(n, info.v1, P, 0), busyPose(n, info.v1, P, 1)], seed = D.seed, spk = spkC(n, tReal), isTalk = spk > 0.01;
    const old = { l: out.l.slice(), r: out.r.slice() };
    // who is speaking now (other than me), smoothed: the listening weight
    let other = 0; for (const m of who) if (m !== n) other = Math.max(other, spkC(m, tReal)); const lw = clamp(other * (1 - clamp(spk * 1.6)));
    // ---- hands: sum of spring responses over the pose changes ----
    let twF = 0, leanF = 0; const hand = [0, 1].map((s) => { const b = s ? D.base.r : D.base.l; return [b[0], b[1], b[2]]; });
    if (on('hands') || on('torso')) for (const r of D.ch) { if (t - r.t > SETTLE + 0.2) { for (let s = 0; s < 2; s++) { const d = r.h[s].d; hand[s][0] += d[0]; hand[s][1] += d[1]; hand[s][2] += d[2]; } twF += K.twistK * (r.h[0].d[0] + r.h[1].d[0]); leanF += K.leanK * 0.5 * (r.h[0].d[2] + r.h[1].d[2]); continue; }
      if (t - r.t < -0.3) break;
      for (let s = 0; s < 2; s++) { const h = r.h[s], R = resp(t - r.t - h.H.delay, h.H, h.amt); hand[s][0] += h.d[0] * R; hand[s][1] += h.d[1] * R; hand[s][2] += h.d[2] * R; }
      const Rt = tabAt(TT, t - r.t - K.torso.delay); twF += K.twistK * (r.h[0].d[0] + r.h[1].d[0]) * Rt; leanF += K.leanK * 0.5 * (r.h[0].d[2] + r.h[1].d[2]) * Rt; }
    // ---- beats (this voice) ----
    const B = K.beat, bl = beatsOf[n] || []; let headB = 0, leanB = 0; const dh = [[0, 0, 0], [0, 0, 0]];
    const pulse = (tau) => (tau < -B.attack ? 0 : tau < 0 ? 0.5 - 0.5 * Math.cos(Math.PI * (tau + B.attack) / B.attack) : tau < B.release ? 0.5 + 0.5 * Math.cos(Math.PI * tau / B.release) : 0);
    if (on('beats') && bl.length) for (let i = bsearch(bl, tReal - 0.45); i < bl.length && bl[i].t < tReal + 0.2; i++) { const b = bl[i], tau = tReal - b.t; headB += b.amp * pulse(tau + B.headLead); leanB += b.amp * pulse(tau + B.leanLead);
      const pk = pulse(tau) * b.amp; if (pk <= 0) continue;
      const el = [0, 1].filter((s) => { const fr = (1 - kp) * (busy0[s] ? 0 : 1) + kp * (busy1[s] ? 0 : 1), hy = hand[s][1];
        return fr > 0.5 && !(tab && inTable(c, hand[s][0], hand[s][2]) && hy < tab.top - c.root.position.y + 0.06); });
      const pt = el.filter((s) => Math.abs(hand[s][0]) > 0.24 && hand[s][1] > 0.62), use = pt.length ? pt : el.length === 2 ? [b.k % 2] : el;   // a pointing hand takes every beat; two free hands take turns
      for (const s of use) { const fr = (1 - kp) * (busy0[s] ? 0 : 1) + kp * (busy1[s] ? 0 : 1), hx = hand[s][0], hy = hand[s][1], hz = hand[s][2], w = pk * fr * K.beat.hand * G;
        if (pt.length) { const sx = (s ? 1 : -1) * 0.17, vx = hx - sx, vy = hy - 0.63, vz = hz, L = Math.hypot(vx, vy, vz) || 1, j = pk * fr * K.beat.jab * G; dh[s][0] += vx / L * j; dh[s][1] += vy / L * j; dh[s][2] += vz / L * j; }   // a pointing hand jabs along the arm
        else if (hy < 0.55) { dh[s][1] += 0.8 * w; dh[s][2] += 1.1 * w; dh[s][0] += (s ? 1 : -1) * 0.3 * w; }      // a hand at rest comes out and punctuates
        else { dh[s][1] -= w; dh[s][2] += 0.55 * w; } } }       // a raised hand dips on the stress
    // ---- hands: add beats and micro drift, keep them out of the table and the body ----
    if (on('hands')) for (let s = 0; s < 2; s++) { const H = hand[s], o = old[s ? 'r' : 'l'], busy = (1 - kp) * (busy0[s] ? 1 : 0) + kp * (busy1[s] ? 1 : 0), ft = 1 - busy;
      const dr = K.drift * G * ft * (0.5 + 0.5 * clamp(spk * 2)), sd = seed + s * 5;
      H[0] += dh[s][0] + dr * noise1(t * 0.55 + sd, 3); H[1] += dh[s][1] + dr * 0.8 * noise1(t * 0.5 + sd, 5); H[2] += dh[s][2] + dr * noise1(t * 0.6 + sd, 7);
      // table: a hand that the engine holds on / above the table never sinks into it (soft in the footprint edge and in the engine's own height, so nothing ever switches)
      if (tab) { const top = tab.top - c.root.position.y, w = tableW(c, H[0], H[2]) * smooth((o[1] - (top - 0.06)) / 0.03); if (w > 0) H[1] += w * Math.max(0, Math.min(o[1], top + 0.025) - 0.003 - H[1]); }
      // body: pushed out of the torso (an ellipse in x / z) when it would sink in, unless the engine's own hand is already that deep (crossed arms, a hug)
      { const [rx, rz] = K.body[n] || K.body.def, Ef = (x, z) => (x / rx) ** 2 + (z / rz) ** 2, wy = smooth((H[1] - 0.25) / 0.05) * smooth((0.85 - H[1]) / 0.05), lim = Math.min(1, Ef(o[0], o[2])), en = Ef(H[0], H[2]);
        if (wy > 0 && en < lim && en > 1e-6) { const k = lerp(1, Math.sqrt(lim / en), wy); H[0] *= k; H[2] *= k; } }
      const dst = s ? out.r : out.l; dst[0] = H[0]; dst[1] = H[1]; dst[2] = H[2]; }
    // ---- head: spring on the look target, leads the body ----
    // The look angles are taken in the character's own rest frame (root, no lean / twist) from where the heads WOULD be (root + the seat height), never from the scene's
    // last-drawn state: that is what makes the frame independent of the order frames are asked in.
    // the head only ever looks at its own shot: samples before the cut / after the next cut are clamped to the shot, so a cut shows the head already where it belongs (a cut hides the turn, as before) and never slides in or twitches before it
    const ac = {}, angAt = (tt) => { const w = info.whatAt(tt); return ac[w] ||= anglesC(c, w, info.camPos, tt); };
    let yawF = 0, pitF = 0, yawS = 0;
    if (on('head')) { const u = new Float64Array(NS * 2);
      for (let j = 0; j < NS; j++) { const a = angAt(Math.min(Math.max(t + K.head.lead - j * dtS, info.shot.t0), info.shot.t1 - 1e-4)); u[2 * j] = a[0]; u[2 * j + 1] = a[1]; }
      for (let j = 0; j < KH.length; j++) { yawF += KH[j] * u[2 * j]; pitF += KH[j] * u[2 * j + 1]; }
      for (let j = 0; j < KT.length; j++) yawS += KT[j] * u[2 * (j + 3)]; }
    else { const a = angAt(t); yawF = yawS = a[0]; pitF = a[1]; }
    const twist = yawS * 0.9 * K.torsoYaw + (on('torso') ? clamp(twF, -K.twistMax, K.twistMax) * G : 0);
    D.last = { twist, lean: 0 }; const leanAdd0 = out.lean; out.twist = twist; out.yaw += 0.9 * yawF - 0.9 * twist; out.pitch += pitF * 0.8;   // the body turns by `twist`, the head the rest of the way
    out.lean += 0.035 * (spk - spkK(n, tReal)) + (on('torso') ? clamp(leanF, -K.leanMax, K.leanMax) * G : 0) + leanB * K.beat.lean * G;
    out.pitch -= headB * K.beat.head * G;                                  // a small head accent on the stress (a dip)
    // ---- listening: nods on the partner's stresses, a tilt, an occasional glance ----
    let glY = 0, glX = 0, glP = 0;
    if (on('listen')) { const nl = nodsOf[n] || []; for (let i = bsearch(nl, tReal - 0.5); i < nl.length && nl[i].t < tReal + 0.05; i++) { const d = tReal - nl[i].t; if (d < 0 || d > 0.45) continue; const w = Math.sin(Math.PI * d / 0.45); out.pitch -= K.nodAmp * nl[i].amp * w * w * G; }
      out.roll += K.tilt * lw * noise1(t / 6.3 + seed, 11) * G;
      const cell = K.glanceCell, kc = Math.floor(t / cell + seed * 0.07), gs = (kc + 0.1 + 0.6 * hash(kc * 3.3 + seed)) * cell - seed * 0.07 * cell, dur = 0.5 + 0.5 * hash(kc * 1.7 + seed), act = hash(kc * 9.1 + seed * 2.3) < K.glanceProb ? 1 : 0, dirn = hash(kc * 2.9 + seed) > 0.5 ? 1 : -1;
      const gE = (x) => (x <= 0 || x >= dur ? 0 : Math.sin(Math.PI * x / dur) ** 2); glY = act * dirn * gE(t - gs) * lw; glX = act * dirn * gE(t + 0.07 - gs) * lw; glP = act * gE(t - gs) * lw; out.yaw += glY * K.glance * G; out.pitch += glP * 0.02 * G;
      if (out.face && on('face')) { out.face.px = (out.face.px || 0) + glX * K.glanceEye; out.face.py = (out.face.py || 0) - glP * 0.2; } }
    // ---- blink on gaze changes (the drawn faces stay as they are; the lid number only goes down) ----
    if (on('face') && out.face) { const gz = gazeOf[n] || []; let bk = 0; for (let i = bsearch(gz, tReal - 0.2); i < gz.length && gz[i].t < tReal; i++) { const x = tReal - gz[i].t; bk = Math.max(bk, x < 0 || x > 0.16 ? 0 : x < 0.06 ? x / 0.06 : 1 - (x - 0.06) / 0.1); }
      if (bk > 0) { if (typeof out.face.eye === 'number') out.face.eye *= 1 - bk; if (typeof out.face.h === 'number') out.face.h *= 1 - 0.9 * bk; } }
    // ---- always: breathing and a slow lean drift (the engine's own breath and idle stay) ----
    D.leanAdd = out.lean - leanAdd0;   // what the layer added to the lean; post() lifts the seat by the toes' drop
    if (on('life')) { const br = Math.sin(t * 1.75 + seed * 2.1 + 0.9); out.bob = (out.bob || 0) + K.breath * G * (0.5 + 0.5 * br) * (isTalk ? 0.7 : 1);
      out.lean += K.sway.lean * G * noise1(t / (K.sway.period * 1.3) + seed, 2) * (info.standing ? 0.3 : 1); D.leanAdd = out.lean - leanAdd0; }
    return out;
  }
  // after c.apply(): the weight shift on the seat. The body group moves a little sideways and rolls the other way (apply() resets both every frame, so this never accumulates).
  // before c.apply(): Bíp's apply never writes body.position.x, so the offset of the last frame is taken out first (the offset is then always added to the same base)
  // before the first camera solve of a frame: every character back to its build-time rest state (the pose is then written by apply() as always), so nothing of the frame drawn before is seen
  function reset() { for (const n of who) { const c = cast[n], D = S[n]; if (c.rig) { c.rig.position.set(0, 0, 0); c.rig.rotation.set(0, 0, 0); } c.body.position.set(D.x0, D.y0, D.z0); c.body.rotation.set(0, 0, 0); c.head.rotation.set(0, 0, 0); c.head.position.y = D.hy; } }
  function pre(c) { const D = S[c.name]; if (D) c.body.position.x = D.x0; }
  function post(c, t, standing, out) { const D = S[c.name]; if (!D) return;
    // the look was aimed from the rest frame; whatever else turned or tilted the body inside apply() (a gloat, a lean into a run) is taken out of the head, as the engine's stale-frame look used to do
    if (D.last) { c.head.rotation.y -= 0.9 * (c.body.rotation.y - D.last.twist); c.head.rotation.x -= 0.8 * c.body.rotation.x; }
    if (!on('post') || standing) return; const sd = S[c.name].seed, w = noise1(t / K.sway.period + sd, 4) + 0.35 * noise1(t / (K.sway.period * 0.4) + sd, 9);
    c.body.position.x += K.sway.x * G * w; c.body.rotation.z -= K.sway.roll * G * w; c.body.position.y += 0.3 * Math.max(0, S[c.name].leanAdd || 0); }   // a lean about the floor point would sink the toes (clipcheck 'below the ground'): lift by the toes' drop

  Object.assign(api, { pose, pre, post, reset, busyPose: (n, v, P, s) => busyPose(n, v, P, s), who, beats: beatsOf, nods: nodsOf, S }); return api;
}
