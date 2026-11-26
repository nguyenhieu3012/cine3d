// cine3d core: turns an episode (plain data) into the picture at time t.
// Episode = { pack, set, fps, dur, shots: [{ t0, t1, cam, move, punchAt, eyes, ... }], lines: [{ who, t0, t1, text, emo, pose }],
//             acts: [{ t, who, emo?, pose?, look?, nod? }], overlays: [...], lips: { '<line index>': [..60 Hz..] } }
import * as THREE from 'three';
import { clamp, lerp, smooth, overshoot, fbm1, hash, easeOut } from './util.js';
import { blendNum, blendVec, gaitRate, gaitPlan, GAIT_KEYS, usesLegs } from './rig.js';
import { solve, applyCam, whipState, parseToken } from './camera.js';
import { drawOverlays } from './overlay.js';
import { makeAct2, ACT2 } from './act2.js';
import { makeTouch, touchLean } from './touch.js';

const EMO_T = 0.2, POSE_T = 0.34, LOOK_T = 0.3;

export function createPlayer(stage, set, cast, ep, { facePlus = null } = {}) {
  const names = Object.keys(cast), shots = ep.shots, lines = ep.lines || [];
  // per character: the ordered list of emotion / pose / look changes (from lines and acts)
  const track = {}; for (const n of names) track[n] = { emo: [{ t: -9, v: 'neutral' }], pose: [{ t: -9, v: 'rest' }], look: [], nod: [] };
  lines.forEach((l) => { const tr = track[l.who]; if (!tr) return; if (l.emo) tr.emo.push({ t: l.t0 - 0.06, v: l.emo }); if (l.pose) tr.pose.push({ t: l.t0 - 0.1, v: l.pose }); });
  for (const a of ep.acts || []) { const tr = track[a.who]; if (!tr) continue; if (a.emo) tr.emo.push({ t: a.t, v: a.emo }); if (a.pose) tr.pose.push({ t: a.t, v: a.pose }); if (a.look) tr.look.push({ t: a.t, v: a.look, d: a.d ?? 1e9 }); if (a.nod) tr.nod.push({ t: a.t, v: a.nod }); }
  for (const n of names) for (const k of ['emo', 'pose', 'look', 'nod']) track[n][k].sort((a, b) => a.t - b.t);
  // free numbers that ramp over time (an aura, a glow, a prop sliding): acts: [{ t, who: 'teo' | 'set', fx: { aura: 1 }, d: 0.4 }]
  // ease: 'lin' on an act = a straight ramp (a walk along a path keeps its speed through the waypoints); default = smooth in and out
  const fxT = {}; for (const a of ep.acts || []) if (a.fx) for (const [k, v] of Object.entries(a.fx)) ((fxT[a.who] ??= {})[k] ??= []).push({ t: a.t, v, d: a.d ?? 0.4, lin: a.ease === 'lin' });
  for (const w in fxT) for (const k in fxT[w]) fxT[w][k].sort((a, b) => a.t - b.t);
  const fxAt = (who, t) => { const o = {}; for (const k in fxT[who] || {}) { let v = 0; for (const f of fxT[who][k]) { if (t < f.t) break; const u = (t - f.t) / Math.max(1e-3, f.d); v = lerp(v, f.v, f.lin ? clamp(u) : smooth(u)); } o[k] = v; } return o; };
  // gait phase (Zombie special): the gait numbers (walk, run, lurch, robot) give a step rate; its integral, tabled once here from the data
  // (so it is still a pure function of t), is p.gph, in cycles. A character with no gait numbers gets nothing new.
  const gphT = {}; for (const n of names) if (fxT[n] && GAIT_KEYS.some((k) => fxT[n][k])) { const dt = 1 / 240, t0 = -2, N = Math.ceil(((ep.dur || 60) + 6) / dt), arr = new Float64Array(N + 1), str = new Float32Array(N + 1), spd = new Float32Array(N + 1), dist = new Float64Array(N + 1), off = hash(n.length * 3.7 + n.charCodeAt(0)) * 0.5;
    // the step rate follows the real ground speed (fx x / z), so a planted foot stays where it landed (gaitPlan in core/rig.js)
    let ph = off, d = 0, prev = fxAt(n, t0 - dt); for (let i = 0; i <= N; i++) { const f = fxAt(n, t0 + i * dt), v = Math.hypot((f.x || 0) - (prev.x || 0), (f.z || 0) - (prev.z || 0)) / dt, P = gaitPlan(f, v); arr[i] = ph; str[i] = P.stride; spd[i] = v; dist[i] = d; ph += P.rate * dt; d += v * dt; prev = f; } gphT[n] = { arr, str, spd, dist, t0, dt, N }; }
  const gAt = (n, t, key = 'arr') => { const G = gphT[n]; if (!G) return undefined; const x = clamp((t - G.t0) / G.dt, 0, G.N - 1), i = Math.floor(x); return lerp(G[key][i], G[key][i + 1], x - i); };
  const gphAt = (n, t) => gAt(n, t, 'arr');
  // root motion (Zombie special): fx x, y, z (metres added to the seat position, world axes) and dir (radians added to the seat yaw).
  // ep.rides = { bip: 'teo' } + fx ride 0..1 on the rider: the rider is carried at the carrier's carryAt() point. Characters with none of these are never touched.
  const base = {}; for (const n of names) base[n] = { pos: cast[n].root.position.clone(), yaw: cast[n].root.rotation.y };
  const movers = names.filter((n) => (fxT[n] && ['x', 'y', 'z', 'dir'].some((k) => fxT[n][k])) || ep.rides?.[n]);
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _a = new THREE.Vector3();
  const placeAll = (tt) => {
    for (const n of movers) { const f = fxAt(n, tt), c = cast[n], b = base[n]; c.root.position.set(b.pos.x + (f.x || 0), b.pos.y + (f.y || 0), b.pos.z + (f.z || 0)); c.root.rotation.set(0, b.yaw + (f.dir || 0), 0); }
    for (const n of movers) { const by = cast[ep.rides?.[n]], k = clamp(fxAt(n, tt).ride || 0); if (!by || !by.carryAt || k <= 0) continue; const c = cast[n], A = by.carryAt({ ...fxAt(by.name, tt), gph: gphAt(by.name, tt), gstride: gAt(by.name, tt, 'str') }, tt, fxAt(n, tt));
      _a.copy(A.pos).applyQuaternion(by.root.quaternion).add(by.root.position); _q2.copy(by.root.quaternion).multiply(A.q || _q1.setFromEuler(_e.set(A.rot[0], A.rot[1], A.rot[2], 'YXZ')));
      c.root.position.lerp(_a, k); c.root.quaternion.slerp(_q2, k); }
  };
  const at = (arr, t) => { let i = 0; while (i + 1 < arr.length && arr[i + 1].t <= t) i++; return [arr[Math.max(0, i - 1)], arr[i], i]; };

  // mouth: the real voice envelope when the episode has one, else a syllable-shaped stand-in
  const talkOf = (who, t) => { for (let i = 0; i < lines.length; i++) { const l = lines[i]; if (l.who !== who || l.think || t < l.t0 || t > l.t1) continue; const env = ep.lips?.[i]; const edge = smooth((t - l.t0) / 0.06) * smooth((l.t1 - t) / 0.08);
      if (env) { const x = (t - l.t0) * 60, j = Math.floor(x); return clamp(lerp(env[j] ?? 0, env[j + 1] ?? 0, x - j)) * edge; }
      return clamp(0.25 + 0.75 * Math.abs(Math.sin((t - l.t0) * 13 + i)) * (0.6 + 0.4 * fbm1(t * 5, i))) * edge; } return 0; };
  // the raw voice envelope jumps from one 60 Hz sample to the next: the mouth gets a 3-tap average, heads and bodies a slow one (about 0.25 s),
  // and "is speaking" ramps in and out instead of switching, so nothing pops on a syllable or at the start of a line
  const talkMouth = (who, t) => (talkOf(who, t - 1 / 60) + 2 * talkOf(who, t) + talkOf(who, t + 1 / 60)) / 4;
  const talkSlow = (who, t) => { let a = 0; for (let i = -4; i <= 4; i++) a += talkOf(who, t + i * 0.03) * (5 - Math.abs(i)); return a / 25; };
  const isSpk = (who, tt) => (lines.some((q) => !q.think && q.who === who && tt >= q.t0 - 0.05 && tt <= q.t1 + 0.05) ? 1 : 0);
  const spkK = (who, t) => { let a = 0; for (let i = -4; i <= 4; i++) a += isSpk(who, t + i * 0.04) * (5 - Math.abs(i)); return a / 25; };
  const speakerAt = (t) => lines.find((l) => !l.think && t >= l.t0 - 0.05 && t <= l.t1 + 0.05)?.who;
  const shotAt = (t) => shots.find((s) => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  // act2 (core/act2.js, 22/11): an opt-in acting layer. ep.act2 = true | { knobs }, or the page flag &act2=1 (&act2=0 forces it off, &a2_<knob>=<number> overrides a knob). Off = nothing below runs and the picture is unchanged.
  const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams(), a2q = qs.get('act2');
  if (a2q != null) ep.act2 = a2q === '0' ? false : (ep.act2 || true);
  if (ep.act2) for (const [k, v] of qs) if (k.startsWith('a2_') && !isNaN(Number(v))) { if (typeof ep.act2 !== 'object') ep.act2 = {}; ep.act2[k.slice(3)] = Number(v); }
  const A2 = ep.act2 ? makeAct2({ ep, cast, names, lines, track, talkOf, spkK, fxAt }) : null;

  const hp = new THREE.Vector3(), tp = new THREE.Vector3(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  // yaw / pitch (in the body's frame) that turn the head towards a world point
  const lookAngles = (c, target) => { c.headWorld(hp); v.subVectors(target, hp); c.body.getWorldQuaternion(q).invert(); v.applyQuaternion(q); const yaw = Math.atan2(v.x, v.z), pitch = Math.atan2(v.y, Math.hypot(v.x, v.z)); return [clamp(yaw, -1.05, 1.05), clamp(pitch, -0.5, 0.6)]; };
  const lookTarget = (c, what, camPos) => { const other = cast[ep.partners?.[c.name]] || cast[names.find((n) => n !== c.name)]; if (what === 'cam') return tp.copy(camPos); if (what === 'down') return c.headWorld(tp).add(v.set(0, -0.5, 0.6).applyQuaternion(c.body.getWorldQuaternion(q))); if (what === 'up') return c.headWorld(tp).add(v.set(0.2, 0.6, 0.8)); if (what === 'away') return c.headWorld(tp).add(v.set(other && other.root.position.x > c.root.position.x ? -1 : 1, 0, 0.6)); const o2 = cast[what] || other; if (!o2) return tp.copy(camPos);
    // "cheat to camera": looking at the partner means a three-quarter turn, the face stays readable
    return o2.headWorld(tp).lerp(v.copy(camPos).setY(tp.y), ep.cheat ?? 0.5); };

  const TOUCH = ep.touch ? makeTouch(ep.touch) : null;
  let exportOn = false;   // set by player.state(): poseOf then also reports where each character's eyes aim (tools/dump.cjs)
  function poseOf(c, t, shot, camPos, tReal = t) {
    const tr = track[c.name], F = c.faces, P = c.poses;
    const [e0, e1] = at(tr.emo, t), ke = smooth((t - e1.t) / EMO_T), face = blendNum(F[e0.v] || F.neutral, F[e1.v] || F.neutral, ke);
    const [p0, p1] = at(tr.pose, t), kp = overshoot((t - p1.t) / POSE_T, 0.07), A = P[p0.v] || P.rest, B = P[p1.v] || P.rest;
    const talk = talkMouth(c.name, tReal), slow = talkSlow(c.name, tReal), sk = spkK(c.name, tReal);
    // eyes: an explicit look wins, then the shot's wish, else speaker -> partner, listener -> speaker.
    // The target is averaged over the last 0.3 s, so a head turns instead of snapping (stateless: any frame renders alone).
    const whatAt = (tt) => { const lk = tr.look.filter((a) => tt >= a.t && tt < a.t + a.d).pop(), s2 = speakerAt(tt); return lk?.v || shot.eyes?.[c.name] || (s2 && s2 !== c.name ? s2 : 'partner'); };
    let yaw = 0, pitch = 0; const NS = 19, a2 = A2 && A2.S[c.name];   // one sample per 60 fps frame over 0.3 s: the turn is a ramp, not five steps (act2: core/act2.js replaces this loop with a spring)
    if (!a2) for (let i = 0; i < NS; i++) { const [y1, x1] = lookAngles(c, lookTarget(c, whatAt(t - i * LOOK_T / (NS - 1)), camPos)); yaw += y1 * 0.9 / NS; pitch += x1 * 0.8 / NS; }
    const what = whatAt(t);
    // speaking life: nods on the voice, a lean in; a nod / shake act on top
    let nodP = slow * 0.05 * Math.sin(t * 7.3) + sk * 0.02, nodY = 0;
    for (const a of tr.nod) { const d = t - a.t; if (d < 0 || d > 0.7) continue; const w = Math.sin(d / 0.7 * Math.PI); if (a.v === 'yes') nodP -= 0.2 * w * Math.sin(d * 16); else if (a.v === 'no') nodY += 0.32 * w * Math.sin(d * 15); else if (a.v === 'jolt') nodP += 0.16 * w * (1 - d / 0.7); }
    // any extra numeric key of a pose (a prop switch such as mate, tray, flag) is blended and handed to the character
    const extra = {}; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (k !== 'l' && k !== 'r' && (typeof A[k] === 'number' || typeof B[k] === 'number')) extra[k] = lerp(A[k] || 0, B[k] || 0, clamp(kp));
    const fxN = fxAt(c.name, t), gph = gphAt(c.name, t); if (gph !== undefined) { fxN.gph = gph; fxN.gstride = gAt(c.name, t, 'str'); fxN.gspeed = gAt(c.name, t, 'spd'); fxN.gdist = gAt(c.name, t, 'dist'); }
    { const sg = set.gaitOf?.(c.name, t); if (sg) Object.assign(fxN, sg); const tc = TOUCH?.at(c.name, t); if (tc) fxN.touch = tc; }   // 22/11 opt-in: a stand's real walk (core/gait.js) and hand contact (core/touch.js)
    const by = ep.rides?.[c.name]; if (by && cast[by]) { const cf = fxAt(by, t); fxN.rideGph = gphAt(by, t) ?? 0; fxN.rideRun = clamp((cf.run || 0) + (cf.walk || 0) + (cf.charge || 0)); fxN.rideTrip = cf.trip || 0; fxN.ridePiggy = clamp(cf.piggy || 0); fxN.rideHoist = cf.hoist ?? 1; }
    if (fxT[c.name] && (fxT[c.name].neck || fxT[c.name].heads)) { const f0 = fxAt(c.name, t - 1 / 60); fxN.dNeck = ((fxN.neck || 0) - (f0.neck || 0)) * 60; fxN.dHeads = ((fxN.heads || 0) - (f0.heads || 0)) * 60; }   // turn speed (rad/s) for the neck-crack moment
    const P_ = {
      ...extra, ...fxN, face, talk, yaw: yaw + nodY, pitch: pitch + nodP, roll: 0.06 * clamp(face.skew || 0) + lerp(e0.v === 'sad' ? -0.07 : 0, e1.v === 'sad' ? -0.07 : 0, ke),   // the sad head tilt blends out as well as in (it used to snap back in one frame)
      lean: sk * 0.035 + slow * 0.012, twist: yaw * 0.12, bob: slow * 0.004 * Math.sin(t * 11), talkSlow: slow,
      l: blendVec(A.l, B.l, kp), r: blendVec(A.r, B.r, kp), shrug: lerp(A.shrug || 0, B.shrug || 0, clamp(kp)), phone: lerp(A.phone || 0, B.phone || 0, clamp(kp)), cup: lerp(A.cup || 0, B.cup || 0, clamp(kp)), _what: what,
      _emo: [e0.v, e1.v, ke], _pose: [p0.v, p1.v, kp], _lookAt: (exportOn || (facePlus && facePlus.on)) ? lookTarget(c, what, camPos).toArray() : undefined,   // read by tools/dump.cjs and live facePlus (gaze leads head)
    };
    if (P_.touch) P_.lean += touchLean(P_.touch, c, P_, P_.lean);   // 22/11: lean in to reach a touched surface
    if (!a2) return P_;
    return A2.pose(P_, c, t, tReal, { v0: p0.v, v1: p1.v, kp: (t - p1.t) / POSE_T, shot, whatAt, camPos, standing: (P_.stand ?? ep.castOpts?.[c.name]?.stand ?? 0) > 0.02 || usesLegs(P_) });
  }

  // slow motion (Zombie special): ep.slomo = [{ t0, t1, rate: 0.35, ease: 0.15, back: null | seconds | false }]. The PICTURE runs at a warped time w(t)
  // (poses, gaits, set, props, camera moves); mouths, captions and overlays stay on real t. The rate eases 1 -> rate -> 1 over `ease` s at each end, then the
  // lost time is paid back over `back` s after t1 (default: (lost time) / 0.6, so the catch-up never runs faster than about 1.6 x), so the picture is back in
  // sync with the sound and nothing ever jumps. back: false = no catch-up (the picture stays behind for the rest of the film).
  // A window that ENDS ON A CUT (t1 = some shot's t0) snaps back to real time at that cut, which nobody can see (the slow motion holds to the cut, the next
  // shot is in sync with the sound); give back: false to keep it behind, or back: seconds to force a smooth catch-up instead.
  const slo = (ep.slomo || []).map((w) => { const snap = w.back === undefined && shots.some((s) => Math.abs(s.t0 - w.t1) < 1e-3), e = Math.min(w.ease ?? 0.15, (w.t1 - w.t0) / 2), r = w.rate ?? 0.35, lost = (1 - r) * (w.t1 - w.t0 - (snap ? e / 2 : e)); return { ...w, e, r, lost, snap, back: snap || w.back === false ? 0 : (w.back ?? lost / 0.6) }; });
  const rateAt = (t) => { let k = 1; for (const w of slo) { if (t >= w.t0 && t < w.t1) { const a = smooth((t - w.t0) / w.e) * (w.snap ? 1 : smooth((w.t1 - t) / w.e)); k *= lerp(1, w.r, a); } else if (w.back > 0 && t >= w.t1 && t < w.t1 + w.back) { const u = (t - w.t1) / w.back; k *= 1 + (w.lost / w.back) * 2 * Math.sin(Math.PI * u) ** 2; } } return k; };
  let warpT = null; if (slo.length) { const dt = 1 / 480, t0 = -2, N = Math.ceil(((ep.dur || 60) + 8) / dt), arr = new Float64Array(N + 1); let w = t0, pend = 0;
    for (let i = 0; i <= N; i++) { const t = t0 + i * dt; for (const s2 of slo) if (s2.snap && t >= s2.t1 && t - dt < s2.t1) w = t - pend; arr[i] = w; w += rateAt(t + 0.5 * dt) * dt; for (const s2 of slo) if (!s2.snap && s2.back === 0 && t < s2.t1 && t + dt >= s2.t1) pend += s2.t1 - w; }
    warpT = { arr, t0, dt, N }; }
  const warp = (t) => { if (!warpT) return t; const x = clamp((t - warpT.t0) / warpT.dt, 0, warpT.N - 1), i = Math.floor(x); for (const w of slo) if (w.snap && t >= w.t1 && t - warpT.dt * 1.01 < w.t1) return t - (warpT.t0 + (i + 1) * warpT.dt - warpT.arr[i + 1]);   /* never blend across the snap */ return lerp(warpT.arr[i], warpT.arr[i + 1], x - i); };
  // ---- v4 (14/11): intensity track + drive, whip set-up (all opt-in: without ep.intensity / ep.times.tension AND ep.drive nothing below touches the picture) ----
  const ITR = buildIntensity(ep), DV = ep.drive === true ? { camera: true, light: true, grade: true } : ep.drive || null, DRV = ITR && DV ? DV : null;
  const Iat = (t) => (ITR ? ITR.I(t) : 0);
  const impacts = [].concat(ep.impacts ?? ep.times?.impacts ?? []).filter((x) => typeof x === 'number').sort((a, b) => a - b);
  // drive.time: a hit-stop on every impact (unless the episode already has one there)
  const HITS = [...(ep.hits || []), ...(DRV?.time ? impacts.filter((x) => !(ep.hits || []).some((h) => Math.abs(h.t - x) < 0.05)).map((x) => ({ t: x, frames: Math.max(2, Math.round(DRIVE.hitFrames * (ep.fps || 30))) })) : [])];
  const shotOff = (shot, k) => shot.drive === false || shot.drive?.[k] === false;
  // camera numbers for this shot at t (sound time): move amount from the highest intensity reached since the shot began (so a push never backs off),
  // handheld above the threshold, a punch-in on each impact. A shot's own amt / shake / punchAt wins over the track.
  const drvCam = (shot, t) => { if (!DRV?.camera || shotOff(shot, 'camera')) return null;
    let m = Iat(t); for (let x = shot.t0; x < t; x += 1 / 60) m = Math.max(m, Iat(x));
    let pu = 0; if (shot.punchAt == null) for (const ti of impacts) { const d = t - (ti - DRIVE.punchLead); if (d < 0 || d > DRIVE.punchIn + DRIVE.punchHold + DRIVE.punchOut) continue; pu = Math.max(pu, d < DRIVE.punchIn ? easeOut(d / DRIVE.punchIn) : 1 - smooth((d - DRIVE.punchIn - DRIVE.punchHold) / DRIVE.punchOut)); }
    return { amtK: 1 + DRIVE.move[2] * sstep(DRIVE.move[0], DRIVE.move[1], m), shake: shot.shake !== undefined ? 0 : DRIVE.shake[2] * sstep(DRIVE.shake[0], DRIVE.shake[1], Iat(t)), punch: DRIVE.punch * pu }; };
  // light + grade: multiply the values the set / look / fx left there this frame (remembered per object, so a set that rewrites a light keeps working)
  const OWN = new Map(), own = (obj, key, f) => { if (!obj || typeof obj[key] !== 'number') return; let r = OWN.get(obj); if (!r) OWN.set(obj, (r = {})); let s2 = r[key]; if (!s2 || obj[key] !== s2.last) s2 = r[key] = { base: obj[key] }; obj[key] = f(s2.base); s2.last = obj[key]; };
  const drvLook = (shot, t) => {
    const I = Iat(t), b = ITR.breath(t), L = set.lights, G = stage.grade?.uniforms;
    if (DRV.light) { const on = !shotOff(shot, 'light'), pk = on ? sstep(DRIVE.peak[0], DRIVE.peak[1], I) : 0;
      if (on) stage.renderer.toneMappingExposure *= 1 - 0.5 * DRIVE.breath[2] * b;
      if (L) { own(L.hemi, 'intensity', (v) => v * (1 - DRIVE.hemi * (on ? b : 0))); own(L.rim, 'intensity', (v) => v * (1 + DRIVE.rim * pk)); own(L.kick, 'intensity', (v) => v * (1 + DRIVE.kick * pk)); own(L.key, 'intensity', (v) => v * (1 + DRIVE.key * pk)); } }
    if (DRV.grade && G) { const on = !shotOff(shot, 'grade'), k = on ? sstep(DRIVE.grade[0], DRIVE.grade[1], I) : 0, bb = on && DRV.light ? b : 0;
      own(G.contrast, 'value', (v) => v * (1 + DRIVE.contrast * k)); own(G.sat, 'value', (v) => v * (1 + DRIVE.sat * k) * (1 - DRIVE.satBreath * bb)); own(G.vig, 'value', (v) => v + DRIVE.vig * k + DRIVE.vigBreath * bb);
      for (const ax of ['x', 'y', 'z']) { own(G.gain.value, ax, (v) => v * (1 - DRIVE.gain * k)); own(G.lift.value, ax, (v) => v - DRIVE.lift * k); } } };
  // whip: the speaker a whip lands on (`to: 'speaker'`) and the pan direction across a cut (world +x = screen right; `dir` on the shot overrides)
  const subjOf = (s) => { if (s.free) return s.free.who || [].concat(s.who || [])[0] || names[0]; const w = parseToken(s.cam).who; return cast[w] ? w : names[0]; };
  const dirTo = (a, b) => Math.sign((cast[b]?.root.position.x ?? 0) - (cast[a]?.root.position.x ?? 0)) || 1;
  const prep = new Map(); shots.forEach((s, i) => { if (!s.whip && !s.whipOut && !s.whipIn) return; const P = {};
    if (s.whip?.to === 'speaker') { const ta = s.whip.at + (s.whip.d ?? 0.3), l = lines.find((q) => cast[q.who] && !q.think && q.t1 > ta - 0.05) || lines.find((q) => cast[q.who] && q.t1 > s.whip.at); const pt = parseToken(s.cam), bs = ['ms', 'cu', 'ecu', 'ots'].includes(pt.base) ? pt.base : 'ms';
      if (l) P.whipTo = `${bs}_${l.who}${pt.ang ? '_' + pt.ang : ''}`; }
    if (s.whipOut && shots[i + 1]) P.dirOut = dirTo(subjOf(s), subjOf(shots[i + 1]));
    if (s.whipIn && shots[i - 1]) P.dirIn = dirTo(subjOf(shots[i - 1]), subjOf(s));
    prep.set(s, P); });
  let exp0 = null;   // the look's exposure; acts on 'set' may dim it (fx.dim) or flash it (fx.flash)
  // ---- set swap (backdrop for a 2-D board): between t0 and t1 the SET behind the cast is replaced by a 2-D drawing; the cast and the props it sits on stay live in 3-D ----
  // ep.overlays: { kind: 'setswap', t0, t1, fade: 0.5, fn(ctx, t, { ep, cast, a }), keep?: (obj, box, isDefault) => bool }  (documented in ENGINE.md "setswap")
  const SWAPS = (ep.overlays || []).filter((o) => o.kind === 'setswap');
  const swapAt = (t) => { for (const o of SWAPS) { const f = Math.max(o.fade ?? 0.5, 1e-3), a = Math.min((t - o.t0) / f, (o.t1 - t) / f); if (a > 0) return { o, a: smooth(clamp(a, 0, 1)) }; } return null; };
  const swKeep = new WeakMap(); let swZone = null, swHidden = [];
  const swapZone = () => swZone ||= (() => { const ps = Object.values(cast).map((c) => c.root.position); const xs = ps.map((p) => p.x), zs = ps.map((p) => p.z); return { x0: Math.min(...xs) - 0.65, x1: Math.max(...xs) + 0.65, z0: Math.min(...zs) - 0.65, z1: Math.max(...zs) + 1.0, h: 1.3 }; })();
  // default keep rule: a top-level piece of the set whose bounding box lies in the seating zone (the table, the stools, what is on them) and is lower than 1.3 m; the cast is never part of the set
  const swapKeeps = (o, ch) => { let k = swKeep.get(o); if (!k) swKeep.set(o, k = new WeakMap()); if (k.has(ch)) return k.get(ch); const z = swapZone(), b = new THREE.Box3().setFromObject(ch), c = b.getCenter(new THREE.Vector3());
    const dflt = b.max.y < z.h && c.x > z.x0 && c.x < z.x1 && c.z > z.z0 && c.z < z.z1 && (b.max.x - b.min.x) < 2.2 && (b.max.z - b.min.z) < 2.2; const v = o.keep ? !!o.keep(ch, b, dflt) : dflt; k.set(ch, v); return v; };
  const swapBegin = (o) => { stage.setBackdrop(true); swHidden = []; for (const ch of set.group.children) { if (ch.isLight || !ch.visible || swapKeeps(o, ch)) continue; ch.visible = false; swHidden.push(ch); } };
  const swapEnd = () => { for (const ch of swHidden) ch.visible = true; swHidden = []; stage.setBackdrop(false); };
  const swCv = SWAPS.length ? Object.assign(document.createElement('canvas'), { width: stage.W, height: stage.H }) : null, swCx = swCv?.getContext('2d'), swAcc = SWAPS.length ? Object.assign(document.createElement('canvas'), { width: stage.W, height: stage.H }) : null;

  const player = {
    ep, cast, shotAt,
    // v4: the smoothed intensity 0..1 at t (0 without a track); the drive numbers for a look at what the track does
    intensity: Iat, breath: (t) => (ITR ? ITR.breath(t) : 0), impacts, drvCam: (t) => drvCam(shotAt(t), t),
    // draws the whole frame for time t into ctx (the 1080 x 1920 film canvas)
    frame(ctx, t, { overlays = true, noRender = false, clear = false } = {}) {   // noRender (export tools): run the whole player (camera, poses, set) but draw no 3-D picture; clear = wipe ctx to transparent first
      // hit-stop: ep.hits = [{ t, frames: 3 }] freezes the picture for 2-3 frames on an impact (the sound is not delayed)
      for (const h of HITS) { const d = (h.frames ?? 3) / (ep.fps || 30); if (t >= h.t && t < h.t + d) { t = h.t; break; } }
      const shot = shotAt(t), tReal0 = t;
      const sw = overlays ? swapAt(t) : null;
      const pass = (tReal, bd = false, noRender = false) => { const tt = warp(tReal);
        if (movers.length) { placeAll(tt); stage.scene.updateMatrixWorld(true); }
        const sfx = fxAt('set', tt); set.update?.(tt, sfx); ep._props?.update?.(tt, sfx); exp0 ??= stage.renderer.toneMappingExposure; stage.renderer.toneMappingExposure = exp0 * (1 - 0.5 * (sfx.dim || 0)) * (1 + 0.7 * (sfx.flash || 0));
        if (DRV) drvLook(shot, tReal);
        // two passes: place the camera from the current heads, pose (eyes may look at the camera), then re-solve for the final heads
        const cfx = fxAt('cam', tt), so = { aspect: stage.W / stage.H, dofK: ep.dof ?? 1, partners: ep.partners, fx: cfx, drv: drvCam(shot, tReal), prep: prep.get(shot) }; let cam = (A2?.reset(), solve(shot, cast, tt, so));   // act2: reset() puts the cast in its rest state first, so the first camera solve (which the looks are aimed from) never sees the frame drawn before
        const poseAll = (cp) => { for (const n of names) { let pp = poseOf(cast[n], tt, shot, cp, tReal); if (facePlus && facePlus.on) pp = facePlus.apply(n, cast[n], pp, tReal); if (A2) A2.pre(cast[n]); cast[n].apply(pp, tt); if (A2) A2.post(cast[n], tt, (pp.stand ?? ep.castOpts?.[n]?.stand ?? 0) > 0.02 || usesLegs(pp), pp); } };
        poseAll(cam.pos);
        stage.scene.updateMatrixWorld(true);
        cam = solve(shot, cast, tt, so); applyCam(stage.camera, cam);
        shot.light?.(stage, tt); ep.onFrame?.(stage, set, cast, tt, shot);
        if (!noRender) { if (bd) swapBegin(sw.o); stage.render(tt, { focus: cam.focus, aperture: bd ? 0 : cam.aperture }); if (bd) swapEnd(); } return cam;
      };
      // motion blur (ep.mblur = 2..8 sub-frames, 180 degree shutter): samples stay inside their own shot, so a cut never ghosts
      let mb = Math.max(1, Math.round(shot.mblur ?? ep.mblur ?? 1)), shut = slo.length ? 1 + 0.8 * (1 - rateAt(t)) : 1; const fps = ep.fps || 30; let cam;   // a little more blur inside a slow-motion window
      // v4 whip: while the picture pans fast, 16 sub-frames over a 360 degree shutter (shot.whipBlur = another count); the blur fades in with the pan speed, so it never pops
      if ((shot.whip || shot.whipOut || shot.whipIn) && whipState(shot, t) > 0.02) { mb = Math.max(mb, shot.whipBlur ?? 16); shut = Math.max(shut, 2); }
      if (noRender) { cam = pass(t, false, true); if (clear) ctx.clearRect(0, 0, stage.W, stage.H); if (overlays) drawOverlays(ctx, ep, t, cast, stage.camera); return cam; }
      if (sw) {
        // set swap: [the real set, while it cross-fades] -> the 2-D board (alpha = the fade) -> the cast and the kept props over it (rendered on a transparent background)
        const board = (tt, a) => { swCx.clearRect(0, 0, stage.W, stage.H); swCx.save(); sw.o.fn(swCx, tt, { ep, cast, a, k: 1 }); swCx.restore(); ctx.globalAlpha = a; ctx.drawImage(swCv, 0, 0); ctx.globalAlpha = 1; };
        if (sw.a >= 1 && mb > 1) {   // motion blur inside a set swap: every sub-frame is composed on its own, then averaged
          const ac = swAcc.getContext('2d'); ac.globalAlpha = 1;
          for (let k = 0; k < mb; k++) { const tt = Math.min(Math.max(t + ((k + 0.5) / mb - 0.5) * 0.5 * shut / fps, shot.t0), shot.t1 - 1e-4); cam = pass(tt, true); swCx.clearRect(0, 0, stage.W, stage.H); sw.o.fn(swCx, tt, { ep, cast, a: 1, k: 1 }); swCx.drawImage(stage.canvas, 0, 0, stage.W, stage.H); ac.globalAlpha = 1 / (k + 1); ac.drawImage(swCv, 0, 0); }
          ctx.drawImage(swAcc, 0, 0);
        } else {
          if (sw.a < 1) { cam = pass(t); ctx.drawImage(stage.canvas, 0, 0, stage.W, stage.H); }
          board(t, sw.a); cam = pass(t, true); ctx.drawImage(stage.canvas, 0, 0, stage.W, stage.H);
        }
      }
      else if (mb === 1) { cam = pass(t); ctx.drawImage(stage.canvas, 0, 0, stage.W, stage.H); }
      else for (let k = 0; k < mb; k++) { const tt = Math.min(Math.max(t + ((k + 0.5) / mb - 0.5) * 0.5 * shut / fps, shot.t0), shot.t1 - 1e-4); cam = pass(tt); ctx.globalAlpha = 1 / (k + 1); ctx.drawImage(stage.canvas, 0, 0, stage.W, stage.H); ctx.globalAlpha = 1; }
      if (overlays) drawOverlays(ctx, ep, t, cast, stage.camera);
      return cam;
    },
    // export for other renderers (ENGINE.md "Export for other renderers"): the scene state at t with no picture drawn (tools/dump.cjs reads the camera, characters, lights afterwards)
    state(t) { exportOn = true; try { return this.frame(null, t, { overlays: false, noRender: true }); } finally { exportOn = false; } },
    // the 2-D layer alone on a TRANSPARENT ctx (tools/render.cjs pngseq --overlays-only): captions, hook, cards, every overlay of core/overlay*.js, without the 3-D picture
    overlayFrame(ctx, t) { return this.frame(ctx, t, { overlays: true, noRender: true, clear: true }); },
    // the set-swap BOARD alone (tools/render.cjs pngseq --board-only, for a second renderer that composites the cast over it): the player runs for t
    // (camera, poses: a board may follow heads), ctx is cleared, and the active swap's fn draws the board at full strength; the fade is NOT applied
    // (the dump's `swap` gives it). Returns the fade 0..1, or 0 with a transparent ctx when no swap is active.
    boardFrame(ctx, t) { this.frame(null, t, { overlays: false, noRender: true }); ctx.clearRect(0, 0, stage.W, stage.H); const sw = swapAt(t); if (!sw) return 0;
      ctx.save(); sw.o.fn(ctx, warp(t), { ep, cast, a: sw.a, k: 1 }); ctx.restore(); return sw.a; },
  };
  return player;
}

// Path helper (Zombie special): acts that walk a character along waypoints at a steady speed and turn it to face the way it goes.
//   acts: [...path('teo', [[t, x, z], [t, x, z], ...], { seat: [x0, z0], yaw0: seatYaw, turn: 0.25, face: true })]
// x, z are WORLD positions; seat / yaw0 must be the character's seat (pos x, z and yaw) so the fx offsets come out right. The gait itself is yours: add
// { t, who, fx: { walk: 1 }, d: 0.3 } (or run, lurch, robot) for the stretch where it moves.
export function path(who, pts, { seat = [0, 0], yaw0 = 0, turn = 0.25, face = true } = {}) {
  const acts = []; const [t0, x0, z0] = pts[0];
  acts.push({ t: Math.min(-1, t0 - 1), who, fx: { x: x0 - seat[0], z: z0 - seat[1] }, d: 0.01 });
  let yawPrev = 0;
  for (let i = 1; i < pts.length; i++) { const [ta, xa, za] = pts[i - 1], [tb, xb, zb] = pts[i];
    acts.push({ t: ta, who, fx: { x: xb - seat[0], z: zb - seat[1] }, d: tb - ta, ease: 'lin' });
    if (face && Math.hypot(xb - xa, zb - za) > 1e-3) { let y = Math.atan2(xb - xa, zb - za) - yaw0; while (y - yawPrev > Math.PI) y -= 2 * Math.PI; while (y - yawPrev < -Math.PI) y += 2 * Math.PI; acts.push({ t: ta - (i === 1 ? 0 : turn / 2), who, fx: { dir: y }, d: turn }); yawPrev = y; } }
  return acts;
}

// ---- v4 (14/11): the intensity track. One curve per episode (0..1) that, when the episode opts in with `drive`, moves camera, light and grade together.
// Source: ep.intensity = [[t, v 0..10], ...] (straight lines between the keys), else ep.times.tension (the times file of tools/voice.py, passed as `times: T`;
// one value per beat, held until the next). The curve is then smoothed with a 1.0 s raised-cosine window, so a step eases over about 0.6 s and nothing ever pops.
// Tables are built once from the data: every value is still a pure function of t.
export const DRIVE = {
  ease: 1.0,                                   // s, full width of the smoothing window
  move: [0.25, 1.0, 2.0],                      // camera: move amount x (1 + 2.0 * smoothstep(0.25, 1.0, I_max since the shot began))
  shake: [0.62, 0.95, 0.55],                   // camera: handheld 0 -> 0.55 between I 0.62 and 0.95 (the cam-fx shake scale, at about half its frequency)
  punch: 0.6, punchIn: 0.3, punchHold: 0.4, punchOut: 1.2, punchLead: 0.1,   // impact: push-in to 0.6 x the cam-fx punch (8.4 %), eased out over 0.3 s from 0.1 s before the impact
  breath: [0.18, 0.3, 1.0], hemi: 0.7,         // light: the rise ahead within 1.5 s (0..1 units) -> breath 0..1; exposure x (1 - 0.5 * 1.0 * breath) (the set fx `dim` formula, -50 %), fill (hemi) x (1 - 0.7 * breath): the set sinks more than the faces
  look: 1.5,                                   // s, how far ahead the breath looks
  peak: [0.55, 0.95], rim: 1.2, kick: 0.8, key: 0,   // light at the peak: rim x 2.2, kick x 1.8 (the key stays: a brighter key clips white faces)
  // grade at I = 1: contrast x 1.10 with the whole curve pulled down (gain x 0.94, lift -0.025 on all three channels alike: no hue shift), so the blacks deepen while
  // a bright face does not clip (QA face_blown); saturation x 1.14, vignette +0.20. In a breath: vignette +0.20 and saturation x 0.85.
  grade: [0.3, 1.0], contrast: 0.1, gain: 0.06, lift: 0.025, sat: 0.14, vig: 0.2, vigBreath: 0.2, satBreath: 0.15,
  hitFrames: 0.1,                              // drive.time: hit-stop of 0.1 s (3 frames at 30 fps, 6 at an episode fps of 60) on every impact
};
const sstep = (a, b, x) => smooth((x - a) / (b - a));
export function buildIntensity(ep) {
  let pts = ep.intensity, step = false;
  if (!pts?.length && ep.times?.tension?.length) { pts = ep.times.tension; step = true; }
  if (!pts?.length) return null;
  pts = pts.map(([t, v]) => [t, clamp(v / 10)]).sort((a, b) => a[0] - b[0]);
  const raw = (t) => { if (t <= pts[0][0]) return pts[0][1]; for (let i = 0; i < pts.length - 1; i++) { const [ta, va] = pts[i], [tb, vb] = pts[i + 1]; if (t < tb) return step ? va : lerp(va, vb, (t - ta) / Math.max(1e-6, tb - ta)); } return pts[pts.length - 1][1]; };
  const dt = 1 / 120, t0 = -3, N = Math.ceil(((ep.dur || 60) + 6) / dt), R = new Float32Array(N + 1); for (let i = 0; i <= N; i++) R[i] = raw(t0 + i * dt);
  const hw = Math.round(DRIVE.ease / 2 / dt), ker = []; let ks = 0; for (let j = -hw; j <= hw; j++) { const w = 0.5 + 0.5 * Math.cos(Math.PI * j / (hw + 1)); ker.push(w); ks += w; }
  const conv = (A) => { const O = new Float32Array(N + 1); for (let i = 0; i <= N; i++) { let a = 0; for (let j = -hw; j <= hw; j++) a += A[Math.min(N, Math.max(0, i + j))] * ker[j + hw]; O[i] = a / ks; } return O; };
  const S = conv(R), L = Math.round(DRIVE.look / dt), B0 = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { let m = S[i]; for (let j = 1; j <= L && i + j <= N; j++) m = Math.max(m, S[i + j]); B0[i] = sstep(DRIVE.breath[0], DRIVE.breath[1], m - S[i]); }
  const B = conv(B0), at = (A, t) => { const x = clamp((t - t0) / dt, 0, N - 1), i = Math.floor(x); return lerp(A[i], A[i + 1], x - i); };
  return { I: (t) => at(S, t), breath: (t) => at(B, t), step };
}
