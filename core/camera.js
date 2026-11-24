// cine3d core: the camera. A shot names a framing token; the engine solves a real lens (focal length, distance, height, angle)
// from where the heads actually are in 3-D, so composition holds for any character, seat or pose.
// Tokens: wide · all (everyone in the cast) · two · ms_<who> · cu_<who> · ecu_<who> · ots_<who> (who = the one in focus; ots = a single shot from far round the partner's side, so the partner's blurred shoulder edges into frame), each with _lo (camera looks up) or _hi (looks down).
import * as THREE from 'three';
import { clamp, lerp, easeOut, easeInOut, fbm1 } from './util.js';

const D2R = Math.PI / 180;
// focal length (mm, full-frame held upright: 36 mm tall), head height as a share of the frame, side angle, blur strength, eye line from the top
export const RIGS = {
  wide: { f: 27, az: 0, el: 4, eye: 0.4, dof: 0.2 },
  all: { f: 35, az: 0, el: 3, eye: 0.4, dof: 0.3 },
  two: { f: 42, head: 0.125, az: 7, el: 3, eye: 0.37, dof: 0.5 },
  ms: { f: 58, head: 0.22, az: 12, el: 2, eye: 0.35, dof: 0.7 },
  cu: { f: 85, head: 0.37, az: 9, el: 1, eye: 0.36, dof: 0.8 },
  ecu: { f: 105, head: 0.5, az: 6, el: 0, eye: 0.37, dof: 1.0 },
  ots: { f: 58, head: 0.19, az: 58, el: 3, eye: 0.35, dof: 1.7 },
};
export const fovOf = (f) => 2 * Math.atan(18 / f) / D2R;
// ease-out with a live tail: the picture never "settles" before a cut
export const camEase = (u) => { u = clamp(u); return 0.82 * (1 - (1 - u) * (1 - u)) + 0.18 * u; };

export function parseToken(tok) {
  const m = /^(wide|all|two|ms|cu|ecu|ots)(?:_([a-z0-9]+?))?(?:_(lo|hi))?$/.exec(tok) || [];
  let [, base, who, ang] = m; if (who === 'lo' || who === 'hi') { ang = who; who = undefined; }
  return { base: base || 'two', who, ang };
}

const _h = new THREE.Vector3(), _p = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
// cast: { name: api }, api.headWorld(), api.R. Returns { pos, quat, fov, focus, aperture }
function solveBase(shot, cast, t, { aspect = 9 / 16, dofK = 1, bandTop = 0.655, partners = null, fx = null, drv = null } = {}) {
  // camera numbers an episode ramps with acts on 'cam' (Zombie special): shake 0..1 = handheld chase shake (smooth noise, 2-7 Hz), punch 0..1 = a quick push-in (ramp it up in ~0.06 s, down in ~0.4 s)
  // drv (v4, only when the episode opts in with `drive.camera`): { amtK, shake, punch } from the intensity track (core/player.js); null = untouched
  const shk = fx?.shake || 0, pun = (fx?.punch || 0) + (drv?.punch || 0), dsk = drv?.shake || 0;
  const { base, who, ang } = parseToken(shot.cam), rig = { ...RIGS[base], ...(shot.rig || {}) };
  const names = Object.keys(cast), subj = cast[who] || cast[names[0]];
  // a free shot (an insert of a prop, a detail): shot.free = { from: [x, y, z], to?: [x, y, z], at: [x, y, z], f: 50, dof: 0.6 }
  if (shot.free) { const F = shot.free, u0 = clamp((t - shot.t0) / Math.max(0.001, shot.t1 - shot.t0)), e0 = camEase(u0), from = new THREE.Vector3(...F.from), at = new THREE.Vector3(...F.at);
    if (F.to) from.lerp(new THREE.Vector3(...F.to), F.lin ? u0 : e0); else from.lerp(at, 0.06 * (shot.amt ?? 1) * (drv?.amtK && shot.amt == null ? drv.amtK : 1) * e0);
    if (F.atTo) at.lerp(new THREE.Vector3(...F.atTo), F.lin ? u0 : e0);
    // free.follow = 'teo': from / at are offsets from that character's root (a tracking shot that stays with a runner)
    if (F.follow && cast[F.follow]) { const r = cast[F.follow].root.position; from.add(r); at.add(r); }
    if (pun) from.lerp(at, 0.14 * pun);
    if (dsk) driftShake(from, from.distanceTo(at) * 0.012 * dsk, t);
    if (shk) { const dd = from.distanceTo(at) * 0.012 * shk; from.x += (fbm1(t * 2.6, 11) + 0.35 * fbm1(t * 7.1, 12)) * dd; from.y += (fbm1(t * 2.3, 13) + 0.35 * fbm1(t * 6.7, 14)) * dd; at.x += fbm1(t * 1.9, 15) * dd * 0.6; }
    const sh0 = 0.0015 * from.distanceTo(at); from.x += fbm1(t * 0.9, 1) * sh0; from.y += fbm1(t * 0.8, 2) * sh0;
    // free.fTo (v4): dolly zoom on a free shot: the lens ramps f -> fTo (smooth in and out) and the camera slides along its line of sight so `at` keeps its size
    let fz = F.f || 50; if (F.fTo != null) { fz = lerp(fz, F.fTo, easeInOut(u0)); from.sub(at).multiplyScalar(fz / (F.f || 50)).add(at); }
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(from, at, new THREE.Vector3(0, 1, 0))), f0 = fz;
    if (dsk) quat.multiply(driftRot(dsk, t));
    return { pos: from, quat, fov: fovOf(f0), focus: from.distanceTo(at), aperture: (F.dof ?? 0.6) * dofK * 26 * (f0 / 50) * (f0 / 50), base: 'free', who: (cast[F.who] || subj).name, group: [] }; }
  // the partner: named on the shot, else the episode's partners map, else the first other cast member
  const other = cast[shot.partner] || cast[partners?.[subj.name]] || cast[names.find((n) => n !== subj.name)] || subj;
  // shot.frame = ['teo', 'bip', 'ba']: a wide / two / all that must hold exactly these people
  const group = shot.frame ? shot.frame.filter((n) => cast[n]) : names;
  const u = clamp((t - shot.t0) / Math.max(0.001, shot.t1 - shot.t0)), e = camEase(u), move = shot.move || 'push', amt = (shot.amt ?? 1) * (drv?.amtK && shot.amt == null ? drv.amtK : 1);
  let f = rig.f, az = rig.az, el = rig.el + (ang === 'lo' ? -13 : ang === 'hi' ? 17 : 0), eye = rig.eye + (ang === 'lo' ? 0.02 : 0), nx = 0, d, focusAt;
  // dolly zoom (v4): `move: 'dolly_zoom'` (lens to 0.55 x, unless fTo says otherwise) or `fTo: mm` with any move: the focal length ramps smoothly over the shot and the
  // distance follows it (singles / two / all solve the distance from the lens, wide scales it), so the subject keeps its size while the background swells or squeezes
  if (shot.fTo != null || move === 'dolly_zoom') f = lerp(f, shot.fTo ?? f * 0.55, easeInOut(u));
  const hs = subj.headWorld(new THREE.Vector3()), ho = other.headWorld(new THREE.Vector3());
  const vf0 = fovOf(f) * D2R;

  if (base === 'wide') { _h.set((hs.x + ho.x) / 2, 1.05, (hs.z + ho.z) / 2); d = shot.dist || 4.6; if (f !== rig.f) d *= f / rig.f; focusAt = _h.clone(); az = (shot.v ? -1 : 1) * 5; }
  else if (base === 'all' || (shot.frame && (base === 'two' || base === 'wide'))) {
    // everybody in the cast (three or more: the stall lady standing behind, a customer)
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z = 0, R = 0; const hw = new THREE.Vector3();
    for (const n of group) { cast[n].headWorld(hw); x0 = Math.min(x0, hw.x); x1 = Math.max(x1, hw.x); y0 = Math.min(y0, hw.y); y1 = Math.max(y1, hw.y); z += hw.z / group.length; R = Math.max(R, cast[n].R); }
    _h.set((x0 + x1) / 2, (y0 + y1) / 2, z); const span = (x1 - x0) / 2 + R * 2.2, tall = (y1 - y0) / 2 + R * 3.2;
    d = Math.max(span / (Math.tan(vf0 / 2) * aspect), tall / Math.tan(vf0 / 2) * 0.8, 2.2) * (base === 'wide' ? 1.5 : 1); focusAt = _h.clone(); az = (shot.v === 1 ? -1 : 1) * 4; eye = 0.4;
  }
  else if (base === 'two') {
    _h.copy(hs).add(ho).multiplyScalar(0.5); const span = Math.abs(hs.x - ho.x) / 2 + Math.max(subj.R, other.R) * 2.1;
    d = Math.max(span / (Math.tan(vf0 / 2) * aspect), 2 * Math.max(subj.R, other.R) / (rig.head * 2 * Math.tan(vf0 / 2))); focusAt = _h.clone(); az *= shot.v === 1 ? -1 : 1;
  } else {
    _h.copy(hs); _h.y += subj.eyeUp || 0; d = (2 * subj.R) / (rig.head * 2 * Math.tan(vf0 / 2)); focusAt = hs.clone();
    az *= ho.x > hs.x ? 1 : -1; if (subj === other) az = 0; if (shot.v === 1) az *= -0.4;
    nx = base === 'ecu' ? 0 : (ho.x > hs.x ? -1 : 1) * (base === 'ots' ? 0.06 : 0.07);
  }
  // moves
  let dz = 1, dAz = 0, dEl = 0, dx = 0, dy = 0;
  if (move === 'push') dz = 1 - 0.055 * amt * e; else if (move === 'pull') dz = 1 - 0.055 * amt * (1 - e);
  if (dz < 0.6) dz = 0.6;   // v4: a large `amt` (or a driven one) never pushes closer than 60 % of the framing distance
  else if (move === 'orbit') dAz = (e - 0.5) * 9 * amt; else if (move === 'crane') { dEl = (e - 0.5) * 9 * amt; dy = (e - 0.5) * 0.12 * amt; }
  else if (move === 'drift') dx = (e - 0.5) * 0.09 * amt;
  az += dAz; el += dEl;
  // punch-in on a stressed word: +8 % over 0.4 s, then it holds
  for (const pt of [].concat(shot.punchAt ?? [])) if (t >= pt) dz *= 1 - (shot.punchPush ?? 0.08) * easeOut((t - pt) / (shot.punchDur ?? 0.4));
  if (pun) dz *= 1 - 0.14 * pun;
  d *= dz;

  const a = az * D2R, b = el * D2R;
  _p.set(Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)).multiplyScalar(d).add(_h);
  _f.subVectors(_h, _p).normalize(); _r.crossVectors(_f, new THREE.Vector3(0, 1, 0)).normalize(); _u.crossVectors(_r, _f);
  const vf = fovOf(f) * D2R, hh = d * Math.tan(vf / 2), ny = 1 - 2 * eye;
  // slide the camera so the head lands on (nx, ny) of the frame (a parallel shift keeps the angle)
  const sx = -nx * hh * aspect + dx, sy = -ny * hh + dy;
  _p.addScaledVector(_r, sx).addScaledVector(_u, sy);
  // handheld: a breath of life, far below what reads as shake
  const sh = (shot.shake ?? 1) * 0.0022 * d;
  _p.x += fbm1(t * 0.9, 1) * sh; _p.y += fbm1(t * 0.8, 2) * sh * 0.8;
  if (dsk) driftShake(_p, 0.014 * d * dsk, t);
  if (shk) { const s2 = 0.014 * d * shk; _p.x += (fbm1(t * 2.6, 11) + 0.35 * fbm1(t * 7.1, 12)) * s2; _p.y += (fbm1(t * 2.3, 13) + 0.35 * fbm1(t * 6.7, 14)) * s2; }
  if (_p.y < 0.12) _p.y = 0.12;
  const m = new THREE.Matrix4().makeBasis(_r, _u, _f.clone().negate()), quat = new THREE.Quaternion().setFromRotationMatrix(m);
  quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(fbm1(t * 0.7, 3) * 0.0016 * (shot.shake ?? 1) + shk * 0.012 * fbm1(t * 3.1, 16), fbm1(t * 0.6, 4) * 0.0016 * (shot.shake ?? 1) + shk * 0.012 * fbm1(t * 2.7, 17), (shot.dutch || 0) * D2R + shk * 0.018 * fbm1(t * 2.2, 18))));
  if (dsk) quat.multiply(driftRot(dsk, t));
  const focus = (shot.focusOn ? cast[shot.focusOn].headWorld(new THREE.Vector3()) : focusAt).distanceTo(_p);
  const aperture = (shot.dof ?? rig.dof) * dofK * 26 * (f / 50) * (f / 50);
  return { pos: _p.clone(), quat, fov: fovOf(f), focus, aperture, base, who: subj.name, group: (base === 'all' || shot.frame) ? group : (base === 'two' || base === 'wide') ? [subj.name, other.name] : [subj.name] };
}
// ---- v4 (14/11): driven handheld, whip pan, rack focus. Everything below is opt-in: a shot without whip / whipOut / whipIn / rack and an episode without
// `drive` go straight to solveBase, unchanged. ----
// driven handheld (intensity track above its threshold): the chase-shake recipe at about half the frequency (1.1-6 Hz), a restrained sway, not a jitter
function driftShake(p, amp, t) { p.x += (fbm1(t * 1.3, 31) + 0.3 * fbm1(t * 3.4, 32)) * amp; p.y += (fbm1(t * 1.1, 33) + 0.3 * fbm1(t * 3.0, 34)) * amp * 0.8; }
const _dr = new THREE.Quaternion(), _de = new THREE.Euler();
function driftRot(k, t) { return _dr.setFromEuler(_de.set(k * 0.009 * fbm1(t * 1.5, 35), k * 0.009 * fbm1(t * 1.3, 36), k * 0.014 * fbm1(t * 1.0, 37))); }
const _wq = new THREE.Quaternion(), _wy = new THREE.Vector3(0, 1, 0), WHIP_B = new WeakMap();
// the second framing of a whip inside one shot: the same shot with the whip's `to` token (and optional rig / move / amt / punchAt / free of its own)
const whipShot = (shot, to) => { let m = WHIP_B.get(shot); if (!m) WHIP_B.set(shot, m = {}); const W = shot.whip;
  return (m[to] ??= { ...shot, cam: to, whip: null, rack: W.rack ?? null, rig: W.rig, free: W.free, focusOn: W.focusOn, dof: W.dof ?? shot.dof, move: W.move ?? shot.move, amt: W.amt ?? shot.amt, punchAt: W.punchAt, fTo: W.fTo }); };
const num = (x, d) => (typeof x === 'number' ? x : d);
// where the whip of this shot is at time t: { k: 0..1 how fast the picture pans (for motion blur), yaw } (used by core/player.js for the blur)
export function whipState(shot, t) {
  let k = 0; const W = shot.whip, O = shot.whipOut, I = shot.whipIn;
  if (W && W.at != null) { const d = Math.max(0.12, W.d ?? 0.3), u = (t - W.at) / d; if (u > -0.05 && u < 1.05) k = Math.max(k, Math.sin(Math.PI * clamp(u))); }
  if (O) { const d = num(O, O.d ?? 0.2), u = (t - (shot.t1 - d)) / d; if (u > 0) k = Math.max(k, clamp(u) ** 2); }
  if (I) { const d = num(I, I.d ?? 0.2), u = (t - shot.t0) / d; if (u < 1) k = Math.max(k, (1 - clamp(u)) ** 2); }
  return k;
}
// focus distance of a rack target: a cast name (its head) or a world point [x, y, z]
const rackDist = (tg, cast, pos) => { if (Array.isArray(tg)) return new THREE.Vector3(...tg).distanceTo(pos); const c = cast[tg]; return c ? c.headWorld(new THREE.Vector3()).distanceTo(pos) : null; };
// o.prep = { whipTo, dirOut, dirIn } resolved once by the player (the speaker the whip lands on, pan directions); o.drv = driven camera numbers
export function solve(shot, cast, t, o = {}) {
  if (!shot.whip && !shot.whipOut && !shot.whipIn && !shot.rack) return solveBase(shot, cast, t, o);
  const P = o.prep || {}; let c;
  // whip inside one shot: { at, d: 0.3, to: 'cu_bip' | 'speaker' } pans from the shot's framing to `to` in d seconds (cubic ease in and out: slow - very fast - slow)
  const W = shot.whip;
  if (W && W.at != null) { const d = Math.max(0.12, W.d ?? 0.3), u = (t - W.at) / d, to = P.whipTo || (W.to === 'speaker' ? shot.cam : W.to);
    if (u <= 0 || !to) c = solveBase(shot, cast, t, o);
    else if (u >= 1) c = solveBase(whipShot(shot, to), cast, t, o);
    else { const a = solveBase(shot, cast, t, o), b = solveBase(whipShot(shot, to), cast, t, o), e = easeInOut(u);
      c = { ...(e < 0.5 ? a : b), pos: a.pos.clone().lerp(b.pos, e), quat: a.quat.clone().slerp(b.quat, e), fov: lerp(a.fov, b.fov, e), focus: 1 / lerp(1 / a.focus, 1 / b.focus, e), aperture: lerp(a.aperture, b.aperture, e) }; }
  } else c = solveBase(shot, cast, t, o);
  // whip across a cut: whipOut on the outgoing shot (accelerates away over its last d s), whipIn on the next one (arrives at the same speed and settles);
  // a number = d, or { d: 0.2, deg: 32, dir: 1 (pan to screen right) | -1 }. The speeds match at the cut (3 x deg / d each side).
  const O = shot.whipOut, I = shot.whipIn; let yaw = 0;
  if (O) { const d = num(O, O.d ?? 0.2), deg = O.deg ?? 32, dir = O.dir ?? P.dirOut ?? 1, u = (t - (shot.t1 - d)) / d; if (u > 0) yaw -= dir * deg * clamp(u) ** 3; }
  if (I) { const d = num(I, I.d ?? 0.2), deg = I.deg ?? 32, dir = I.dir ?? P.dirIn ?? 1, u = (t - shot.t0) / d; if (u < 1) yaw += dir * deg * (1 - clamp(u)) ** 3; }
  if (yaw) c = { ...c, quat: c.quat.clone().multiply(_wq.setFromAxisAngle(_wy, yaw * D2R)) };
  // rack focus: rack: { at, d: 0.8, to: 'bip' | [x, y, z], from? } or a list of them; the focus distance moves in dioptres (1 / m) with a smooth ease in and out.
  // It only reads when the shot has real depth of field (an ots shot, a free shot, or `dof` raised) and the two subjects sit at different distances.
  if (shot.rack) { let f = c.focus; for (const R of [].concat(shot.rack).sort((a, b) => a.at - b.at)) { const f0 = (R.from != null && rackDist(R.from, cast, c.pos)) || f;
      if (t < R.at) { f = f0; break; } const f1 = rackDist(R.to, cast, c.pos); if (!f1) continue;
      f = 1 / lerp(1 / f0, 1 / f1, easeInOut((t - R.at) / Math.max(0.3, R.d ?? 0.8))); }
    c = { ...c, focus: f }; }
  return c;
}
export function applyCam(camera, c) { camera.position.copy(c.pos); camera.quaternion.copy(c.quat); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); }
// where a world point lands on the frame, in pixels
export function project(camera, v, W, H) { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H, p.z]; }
