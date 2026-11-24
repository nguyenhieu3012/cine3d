// cine3d core: a REAL walk for a character that moves along a polyline (22/11, engine stage 1 of the gta6p4 fix round).
// Opt-in; nothing here runs unless a set asks for it (packs/trada/gta_world.js: a stand with `gait`).
//
// The old way: the set slides the character along the path and the episode switches fx `walk` 1 on: the legs step at a fixed rate whatever
// the ground speed, so the feet skate. Here the legs are driven by the DISTANCE travelled:
//   phase (cycles) = integral of rate dt, rate = max(r0, v * duty / S)  (S = step length, r0 = natural cadence, v = ground speed)
//   amount (0..1)  = clamp(v / vN), vN = S * r0 / duty               (small, quick steps while he starts and stops)
// legRig() (core/rig.js) puts the stance foot back by amount * S * (phase rate) / duty = exactly v, so a planted foot stays planted
// (measured: see out/gait_test/feet.txt). Arms swing opposite to the legs, the body bobs and leans, all scaled by the same amount, so he
// eases in from standing and out to standing with no pop. Everything is a pure function of t (tables built once, like the player's gphT).
import { clamp, lerp } from './util.js';
import { GAIT } from './rig.js';

const sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

// W = [{ t, pos: [x, y, z], yaw }, ...] (the stand's start then each waypoint: he arrives at waypoint i at W[i].t)
// o = { kind: 'walk' (any key of GAIT: 'walk' | 'run' | 'lurch' | ...), step: metres per stride (default from the speed), cadence: multiplier of the natural
//       step rate (1; 0.6 = the slow "stride"), ease: seconds of speeding up / slowing down at a stop (0.45) }
export function buildStandGait(W, o = {}) {
  const kind = o.kind || 'walk', G = GAIT[kind] || GAIT.walk, D = G.duty, r0 = G.rate * (o.cadence ?? 1), ease = o.ease ?? 0.45;
  const n = W.length - 1, seg = [];
  for (let i = 0; i < n; i++) { const a = W[i], b = W[i + 1]; seg.push({ a, b, len: Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]), dur: Math.max(1e-3, b.t - a.t) }); }
  seg.forEach((s, i) => { s.start = i === 0 || seg[i - 1].len < 0.01; s.end = i === n - 1 || seg[i + 1].len < 0.01; s.e = Math.min(ease, s.dur * 0.45); });
  const ramp = (s, t) => (s.start ? sm((t - s.a.t) / s.e) : 1) * (s.end ? sm((s.b.t - t) / s.e) : 1);
  // per segment: the cumulative ramp, tabled (position inside the segment = len * cum / total, so he arrives exactly on time)
  const dt = 1 / 240;
  for (const s of seg) { const N = Math.max(2, Math.ceil(s.dur / dt)); s.N = N; s.h = s.dur / N; s.cum = new Float64Array(N + 1); for (let k = 0; k < N; k++) s.cum[k + 1] = s.cum[k] + 0.5 * (ramp(s, s.a.t + k * s.h) + ramp(s, s.a.t + (k + 1) * s.h)) * s.h; s.tot = Math.max(1e-9, s.cum[N]); }
  const segAt = (t) => { let i = 0; while (i + 1 < n && W[i + 1].t <= t) i++; return seg[i]; };
  const kin = (t) => { // position, ground speed and distance walked at t
    if (!n || t <= W[0].t) return { p: W[0].pos, v: 0 };
    if (t >= W[n].t) return { p: W[n].pos, v: 0 };
    const s = segAt(t), x = clamp((t - s.a.t) / s.h, 0, s.N - 1e-9), k = Math.floor(x), q = lerp(s.cum[k], s.cum[k + 1], x - k) / s.tot;
    return { p: [lerp(s.a.pos[0], s.b.pos[0], q), lerp(s.a.pos[1], s.b.pos[1], q), lerp(s.a.pos[2], s.b.pos[2], q)], v: s.len * ramp(s, t) / s.tot };
  };
  // the step length: from the fastest cruise (average speed of a moving segment) unless given
  let vc = 0; for (const s of seg) if (s.len > 0.01) vc = Math.max(vc, s.len / s.dur);
  const S = o.step ?? clamp(vc * D / (r0 * 1.15), G.stride * 0.5, G.stride * 1.7), vN = S * r0 / D;
  // phase and distance tables over the whole walk (default mode: every step is as long as the speed allows, amount = clamp(v / vN))
  const t0 = W[0].t, tN = W[n].t, M0 = Math.max(2, Math.ceil((tN - t0) / dt)), ph0 = new Float64Array(M0 + 1), ds0 = new Float64Array(M0 + 1), vv0 = new Float32Array(M0 + 1);
  { let p = 0, d = 0; for (let k = 0; k <= M0; k++) { const v = kin(t0 + k * dt).v, a = clamp(v / vN); ph0[k] = p; ds0[k] = d; vv0[k] = v; p += (a < 1 ? r0 : v * D / S) * dt; d += v * dt; } }
  const tab0 = (arr, t) => { const x = clamp((t - t0) / dt, 0, M0 - 1), i = Math.floor(x); return lerp(arr[i], arr[i + 1], x - i); };
  // EXPERIMENTAL (o.latch: true): per-foot latched step lengths, see below. Measured worse at the start and the stop than the default, kept for a later round.
  // phase, distance and per-foot step lengths over the whole walk (and the settling steps after it), tabled once.
  // Each foot LANDS with a step length A = clamp(v / vN) (small while he speeds up or slows down) and keeps it for its whole stance; the step rate follows v / A, so the planted
  // foot moves back at exactly v whatever the speed does (no sliding). The swing foot goes to the length of its NEXT landing (read ahead: v is known for all t). After the walk
  // the last two landings have A = 0 (feet together) and the table ends there.
  const LT = o.latch ? 1 : 0, TAIL = 2.5, M = LT ? Math.ceil((tN - t0 + TAIL) / dt) : 2, ph = new Float64Array(M + 1), ds = new Float64Array(M + 1), vv = new Float32Array(M + 1), GA = [0, 1, 2, 3].map(() => new Float32Array(M + 1));
  let kEnd = M; const half = 0.5 * D / r0;   // a foot lands with the step length that matches the speed in the MIDDLE of its stance
  { let p = 0, d = 0; const a0 = clamp(kin(t0 + half).v / vN), lastN = [0, 0], Acur = [a0, a0], doneAfter = [false, false], fr = (x) => x - Math.floor(x);
    for (let k = 0; k <= M; k++) {
      const t = t0 + k * dt, v = kin(t).v;
      for (let f = 0; f < 2; f++) { const nf = Math.floor(p + 0.5 * f); if (nf !== lastN[f]) { lastN[f] = nf; Acur[f] = t > tN ? 0 : clamp(kin(t + half).v / vN); if (t > tN) doneAfter[f] = true; } }
      let ref = 0, uMin = 9; for (let f = 0; f < 2; f++) { const u = fr(p + 0.5 * f); if (u < D && u < uMin) { uMin = u; ref = f; } }
      const rate = clamp(v * D / (S * Math.max(Acur[ref], 0.15)), 0.5 * r0, 2 * r0);
      ph[k] = p; ds[k] = d; vv[k] = v;
      for (let f = 0; f < 2; f++) { const tl = (1 - fr(p + 0.5 * f)) / Math.max(rate, 0.5 * r0), tn = t + tl; GA[2 * f][k] = Acur[f]; GA[2 * f + 1][k] = tn > tN ? 0 : clamp(kin(tn + half).v / vN); }
      if (doneAfter[0] && doneAfter[1] && kEnd === M) kEnd = k;
      p += rate * dt; d += v * dt;
    } }
  const tab = (arr, t) => { const x = clamp((t - t0) / dt, 0, M - 1), i = Math.floor(x); return lerp(arr[i], arr[i + 1], x - i); };
  const tEnd = t0 + kEnd * dt;
  const moving = n > 0 && seg.some((s) => s.len > 0.01);
  // facing: the way he goes (turning into each new heading over 0.25 s), and the LAST turn to the final yaw happens while he slows down (over the last 0.5 s of the walk,
  // never as a swivel on the spot after he arrived: a planted foot would then rotate with the body)
  const head = (s) => Math.atan2(s.b.pos[0] - s.a.pos[0], s.b.pos[2] - s.a.pos[2]);
  seg.forEach((s, i) => { s.hd = s.len > 0.01 ? head(s) : (i ? seg[i - 1].hd : s.a.yaw || 0); });
  const lerpYaw = (a, b, k) => { const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; };
  const yaw = (t) => {
    if (!n || t <= W[0].t) return W[0].yaw || 0; if (t >= W[n].t) return W[n].yaw || 0;
    let i = 0; while (i + 1 < n && W[i + 1].t <= t) i++; const s = seg[i], prev = i ? seg[i - 1].hd : (W[0].yaw || 0);
    let y = lerpYaw(prev, s.hd, sm((t - s.a.t) / 0.25));
    if (i === n - 1) { const T = Math.min(0.5, s.dur * 0.4); y = lerpYaw(y, W[n].yaw || 0, sm((t - (s.b.t - T)) / T)); }
    return y;
  };
  return {
    kind, S, r0, vN, moving, t0, tN,
    pos: (t) => kin(t).p, yaw,
    // the numbers the player hands to the character: gait key = amount, gph = phase (cycles), gstride, gspeed, gdist
    fx: (t) => { if (!moving) return null;
      if (o.latch) { const v = t <= t0 || t >= tN ? 0 : tab(vv, t), a = clamp(v / vN), live = t > t0 && t < tEnd, fade = sm((t - t0) / 0.12);
        const o2 = { gph: live ? tab(ph, t) : 0, gstride: S, gspeed: v, gdist: t <= t0 ? 0 : tab(ds, Math.min(t, tN)), gamt: a, gamp: live ? [0, 1, 2, 3].map((i) => tab(GA[i], t) * fade) : [0, 0, 0, 0] };
        for (const k of Object.keys(GAIT)) o2[k] = 0; o2[kind] = live ? Math.max(a, 0.002) : 0; return o2; }
      const v = t <= t0 || t >= tN ? 0 : tab0(vv0, t), a = clamp(v / vN), o2 = { gph: t <= t0 ? 0 : tab0(ph0, Math.min(t, tN)), gstride: S, gspeed: v, gdist: t <= t0 ? 0 : tab0(ds0, Math.min(t, tN)), gamt: a, glift: 1 };
      for (const k of Object.keys(GAIT)) o2[k] = 0; o2[kind] = a; return o2; },
  };
}

// A coat / apron / hanging cloth that should read as WALKING: the numbers to add to the cloth group's rotation (pivot at the hip, hem hanging below, +x tilts the hem BACK).
// p = the pose numbers handed to decorate().update(p, t): p.gph (cycles) and p.gamt (0..1, the walk amount) exist while a stand has `gait`. Zero otherwise.
//   coat.rotation.x += s.rx;  coat.rotation.z += s.rz;  coat.position.y += s.dy   (s = hemSway(p))
export function hemSway(p, k = 1) {
  const a = clamp(p.gamt || 0) * k, ph = (p.gph || 0) * Math.PI * 2;
  return { rx: a * (0.13 + 0.07 * Math.cos(2 * ph + 0.6)), rz: a * 0.07 * Math.sin(ph + 0.3), dy: -a * 0.004 * Math.cos(2 * ph) };
}
