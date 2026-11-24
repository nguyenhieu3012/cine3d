// look test (19/11): THE JUMP recipe over a 20 m gap, about 2.4 s of screen time in slow motion, with Bíp's tea blob. See ENGINE.md "Added 19/11", section "The jump".
// All car numbers below are written in PICTURE time (what the slow-motion window shows); one formula for the whole film (see ENGINE.md).
import { PACKS } from '../packs/index.js';
import { registerCarTest, fxCurve } from '../packs/trada/gta_cars.js';
registerCarTest(PACKS);
const T0 = 3.04, FL = 0.9, V = 22.2, H = 2.4, U = (t) => (t - T0) / FL;              // take-off at picture time T0, flight FL s, speed V m/s, apex H m
const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const hero = {
  tz: (t) => V * (t - T0),
  ty: (t) => (U(t) > 0 && U(t) < 1) ? 4 * H * U(t) * (1 - U(t)) : 0,
  pitch: (t) => { const u = U(t); if (u < 0) return 0.30 * sm((t - (T0 - 0.18)) / 0.18); if (u < 1) return 0.30 * Math.cos(Math.PI * u); const a = (t - (T0 + FL)); return -0.30 * (1 - sm(a / 0.3)) * Math.exp(-a * 1.5) + 0.05 * Math.exp(-a * 5) * Math.sin(a * 22); },   // nose up on the ramp, round the top, nose down for the landing, front wheels first, then it settles (a small bounce)
  bounce: (t) => { const a = t - (T0 + FL); return a < 0 ? 0 : -0.16 * Math.exp(-a * 7) * Math.cos(a * 13) * 1; },   // landing squat, then rebound
  squat: (t) => { const a = t - (T0 + FL); return a < 0 ? 0 : 0.8 * Math.exp(-a * 8); },
};
const police = (zStart, stopZ, tBrake) => { const vb = V, z = (t) => t < tBrake ? zStart + vb * (t - T0) : zStart + vb * (tBrake - T0) + (stopZ - (zStart + vb * (tBrake - T0))) * (1 - Math.pow(1 - Math.min(1, (t - tBrake) / 0.42), 2.2)); return z; };
const p1 = police(0, -2.9 - (-12), 3.34), p2 = police(0, -7.5 - (-16), 3.52);   // z offsets from each car's mark (-12, -16): stop with the nose 0.6 m from the edge / behind the first
const skid = (tb) => (t) => sm((t - tb) / 0.12) * (1 - sm((t - (tb + 0.9)) / 0.5));
export default {
  id: 'gta_cars_jump', pack: 'trada', set: 'gta_cars_test', fps: 60, dur: 8, cast: ['teo', 'bip'], setOpts: { cars: ['hero', 'p1', 'p2'], gap: [0, 20], p1: { at: [0, -12] }, p2: { at: [0, -16] } }, light: 'dusk_street',
  castOpts: { teo: { gta: true }, bip: { glass: true, belt: true } },
  seats: { teo: { pos: [-0.34, 0.24, -0.12], yaw: 0.14 }, bip: { pos: [0.34, 0.24, -0.12], yaw: -0.14 } }, partners: { teo: 'bip', bip: 'teo' },
  slomo: [{ t0: 3.0, t1: 5.4, rate: 0.4, ease: 0.15 }],   // 2.4 s of screen time = about 1.0 s of picture
  shots: [
    { t0: 0, t1: 0.5, cam: 'cu_teo', partner: 'bip', move: 'none' }, { t0: 0.5, t1: 1.0, cam: 'ms_bip', partner: 'teo', move: 'none' },
    { t0: 1.0, t1: 3.0, cam: 'free', free: { follow: 'teo', from: [-0.6, 1.0, -7.0], at: [0.2, 0.7, 6], f: 30, dof: 0.1 }, hold: true },
    { t0: 3.0, t1: 4.2, cam: 'free', free: { follow: 'teo', from: [3.4, 2.5, 5.2], at: [0.34, 1.0, 0], f: 34, dof: 0.1 }, hold: true },
    { t0: 4.2, t1: 5.4, cam: 'free', free: { from: [19, 3.0, 10], at: [0, 2.0, 10], f: 20, dof: 0.1 }, hold: true },
    { t0: 5.4, t1: 8, cam: 'free', free: { follow: 'teo', from: [-0.5, 0.9, -6.2], at: [0.2, 0.6, 5], f: 28, dof: 0.1 }, hold: true },
  ],
  lines: [],
  acts: [
    { t: -1, who: 'teo', pose: 'drive', emo: 'happy', look: 'cam', d: 99 }, { t: -1, who: 'bip', pose: 'rigid', emo: 'deadpan', look: 'cam', d: 99 },
    { t: 2.9, who: 'teo', emo: 'scream' }, { t: 3.04, who: 'bip', fx: { tea: 1 }, d: 0.9, ease: 'lin' },
    { t: -1, who: 'set', fx: { tz: hero.tz(1.0), p1tz: p1(1.0), p2tz: p2(1.0) }, d: 0.01 }, ...fxCurve('tz', hero.tz, 1.0, 8, 0.05), ...fxCurve('ty', hero.ty, 2.8, 4.2, 0.03), ...fxCurve('pitch', hero.pitch, 2.7, 4.8, 0.03), ...fxCurve('bounce', hero.bounce, 3.9, 4.8, 0.03), ...fxCurve('squat', hero.squat, 3.9, 4.8, 0.04),
    ...fxCurve('p1tz', p1, 1.0, 8, 0.05), ...fxCurve('p2tz', p2, 1.0, 8, 0.05), ...fxCurve('p1squat', (t) => 0.9 * sm((t - 3.34) / 0.1) * (1 - sm((t - 3.7) / 0.25)), 3.2, 4.2, 0.04), ...fxCurve('p2squat', (t) => 0.9 * sm((t - 3.52) / 0.1) * (1 - sm((t - 3.9) / 0.25)), 3.4, 4.4, 0.04),
    ...fxCurve('p1skid', skid(3.34), 3.2, 4.8, 0.05), ...fxCurve('p2skid', skid(3.52), 3.4, 5.0, 0.05), { t: 3.3, who: 'set', fx: { p1brake: 1, p2brake: 1 }, d: 0.1 },
  ],
  overlays: [],
};
