// look test (19/11): the whole DRIVE of "Tèo vào GTA 6?" in one file: pull away from the bank (plaza), junction 1 with flash1 + hit-stop photo moment, junction 2 (FRONT two-shot), junction 3 with the police closing in,
// the ramp, THE JUMP in slow motion (side tracking shot) over the raised drawbridge, the landing, the cruise by the sea. Real Tèo (pose drive) and Bíp (glass, belt) in the hero car.
// Car numbers are written in PICTURE time (ENGINE.md "The jump"): the slow-motion window is real 8.0-10.8, so every set fx below uses ONE formula for the whole film. Road paths are piecewise: the car is
// teleported at each cut (B -> C -> D -> E), which the cut hides.
import { P, ORG } from './gta_world_common.js';
import { driveActs } from '../packs/trada/gta_cars.js';
import { deckAt, ROAD } from '../packs/trada/gta_world.js';
const p = (v) => P('plaza', v), V = 22.2, FL = 0.9, H = 2.4, T0 = 8.04, A = ROAD.bridge.angleDeg * Math.PI / 180, B = ROAD.bridge, TIP = B.tipNear, HTIP = (B.z0 - TIP) * Math.tan(A);
// a curve of acts that REACHES fn(t) at t (fxCurve of gta_cars lags by one step) and whose first act is a 12 ms jump straddling the cut a, so the frame before the cut and the frame after it each see one state
const crv = (key, fn, a, b, dt = 0.05, who = 'set') => { const o = [{ t: +(a - 0.006).toFixed(4), who, fx: { [key]: +fn(a + 0.0083).toFixed(5) }, d: 0.012 }]; for (let k = 1; a + k * dt <= b - 0.011 + 1e-9; k++) o.push({ t: +(a + (k === 1 ? 0.006 : (k - 1) * dt)).toFixed(4), who, fx: { [key]: +fn(a + k * dt).toFixed(5) }, d: k === 1 ? dt - 0.006 : dt, ease: 'lin' }); return o; };
const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const T1 = 2.95, T2 = 4.55, T3 = 6.1, CUT = { B: 1.3, B2: 2.5, C: T1 + 0.75, D: 5.2, E: 6.8 };            // flash times (a car crosses the light z at them) and the cuts
// ---- hero path (road z, absolute) ----
const zHero = (t) => t < CUT.C ? -32 - V * (t - T1) : t < CUT.D ? -82 - V * (t - T2) : t < CUT.E ? -132 - V * (t - T3) : TIP - V * (t - T0);
const Z0M = 4;                                                                                      // road.car_start z
const u = (t) => (t - T0) / FL, landed = T0 + FL;
const heroTy = (t) => { const z = zHero(t); if (t < CUT.E) return 0; if (u(t) > 0 && u(t) < 1) return HTIP + 4 * H * u(t) * (1 - u(t)); const d = deckAt(z); return d ? d.h : HTIP; };
const heroPitch = (t) => { if (t < CUT.E) return 0; const ru = (TIP + (TIP - B.z0) * 0 - zHero(t)); if (u(t) < 0) { const dz = B.z0 - zHero(t); return A * sm(dz / 1.0) * (dz > 0 ? 1 : 0); } if (u(t) < 1) return 0.30 * Math.cos(Math.PI * u(t)); const a = t - landed, z = zHero(t), d = deckAt(z);
  return (d ? -A : -A * (1 - sm((B.z1 - z) / 3.5 * -1))) * 1 + 0.05 * Math.exp(-a * 5) * Math.sin(a * 22) + (z < B.z1 ? A * sm((B.z1 - z) / 3.0) : 0); };
const heroBounce = (t) => { const a = t - landed; return a < 0 ? 0 : -0.16 * Math.exp(-a * 7) * Math.cos(a * 13); }, heroSquat = (t) => { const a = t - landed; return a < 0 ? 0 : 0.8 * Math.exp(-a * 8); };
// police: same speed, 12 / 16 m behind the edge at T0 (marks), brake 0.3 s before the edge (their numbers), stop 2.9 / 7.5 m before the tip
const MARK = [TIP + 12, TIP + 16];
const polS = (k) => { const tb = T0 + (k ? 0.48 : 0.30), stop = k ? 8.5 : 9.1; return (t) => { const gap = (k ? 16 : 12), zh = zHero(t); if (t < CUT.E) return null; if (t < tb) return V * (t - T0); const off = V * (tb - T0); return off + (stop - off) * (1 - Math.pow(1 - Math.min(1, (t - tb) / 0.42), 2.2)); }; };
const polZ = [0, 1].map((k) => { const s = polS(k); return (t) => { if (t >= CUT.E) return MARK[k] - s(t); const gap = (k ? 16 : 12) + 10 * Math.max(0, CUT.E - t) / 1.7 + 0; return zHero(t) + gap; }; });
const polTy = (k) => (t) => { const d = deckAt(polZ[k](t)); return d ? d.h : HTIP; }, polPitch = (k) => (t) => { const d = deckAt(polZ[k](t)); return d ? d.pitch : 0; };
const acts = [
  { t: -1, who: 'teo', pose: 'drive', emo: 'happy', look: 'cam', d: 99 }, { t: -1, who: 'bip', pose: 'rigid', emo: 'deadpan', look: 'cam', d: 99 },
  { t: -1, who: 'set', fx: { ride: 1, p1fade: 1, p2fade: 1 }, d: 0.01 }, { t: CUT.D - 0.005, who: 'set', fx: { p1fade: 0, p2fade: 0 }, d: 0.005 },
  { t: 2.5, who: 'teo', emo: 'smug' }, { t: 7.7, who: 'teo', emo: 'happy' }, { t: 7.95, who: 'teo', emo: 'scream' }, { t: 7.95, who: 'bip', emo: 'deadpan' }, { t: 8.04, who: 'bip', fx: { tea: 1 }, d: 0.9, ease: 'lin' },
  // A: pull away from the kerb in front of the bank (plaza, heading -x): 0 -> 15 m/s, tail squat, a little tyre smoke
  ...driveActs('', { t0: -0.2, t1: CUT.B - 0.04, speed: (t) => 15 * sm((t + 0.2) / 1.2), yaw: () => 0, yaw0: -Math.PI / 2, dt: 0.1 }),
  { t: 0.1, who: 'set', fx: { skid: 1 }, d: 0.3 }, { t: 1.0, who: 'set', fx: { skid: 0 }, d: 0.3 },
  // B..E on the road (tz relative to the mark z 4); the first act of each fxCurve is the teleport at the cut
  ...crv('tz', (t) => zHero(t) - Z0M, CUT.B, CUT.C, 0.1), ...crv('tz', (t) => zHero(t) - Z0M, CUT.C, CUT.D, 0.1), ...crv('tz', (t) => zHero(t) - Z0M, CUT.D, CUT.E, 0.1), ...crv('tz', (t) => zHero(t) - Z0M, CUT.E, 11.4, 0.05),
  { t: CUT.B - 0.005, who: 'set', fx: { tx: 0, tyaw: 0, squat: 0, steer: 0, lean: 0 }, d: 0.005 },
  ...crv('ty', heroTy, CUT.E, 11.4, 0.03), ...crv('pitch', heroPitch, CUT.E, 11.4, 0.03), ...crv('bounce', heroBounce, landed - 0.1, 11.4, 0.03), ...crv('squat', heroSquat, landed - 0.1, 11.4, 0.03),
  // police
  ...[0, 1].flatMap((k) => { const pre = 'p' + (k + 1), mz = MARK[k], tb = T0 + (k ? 0.48 : 0.30); return [...crv(pre + 'tz', (t) => polZ[k](t) - mz, CUT.D, CUT.E, 0.1), ...crv(pre + 'tz', (t) => polZ[k](t) - mz, CUT.E, 11.4, 0.05), ...crv(pre + 'ty', polTy(k), CUT.D, 11.4, 0.04), ...crv(pre + 'pitch', polPitch(k), CUT.D, 11.4, 0.04),
    ...crv(pre + 'squat', (t) => 0.9 * sm((t - tb) / 0.1) * (1 - sm((t - tb - 0.36) / 0.25)), T0 + 0.2, T0 + 1.4, 0.04), ...crv(pre + 'skid', (t) => sm((t - tb) / 0.12) * (1 - sm((t - (tb + 0.9)) / 0.5)), T0 + 0.2, T0 + 2.2, 0.05), { t: tb, who: 'set', fx: { [pre + 'brake']: 1 }, d: 0.1 }]; }),
  // the three flashes (a short ramp: up 0.05 s, down 0.15 s), the bridge opening
  ...[[1, T1], [2, T2], [3, T3]].flatMap(([n, t]) => [{ t: t - 0.05, who: 'set', fx: { ['flash' + n]: 1 }, d: 0.1 }, { t: t + 0.1, who: 'set', fx: { ['flash' + n]: 0 }, d: 0.3 }]),
  { t: -1, who: 'set', fx: { p1head: -0.55, p2head: -0.55, p1tail: -0.25, p2tail: -0.25 }, d: 0.01 },   // police lamps lower: their glow bloomed over a third of the frame in the police shot
  { t: 3.4, who: 'set', fx: { bridge: 1 }, d: 3.4, ease: 'lin' },
];
const tr = (from, at, f, o = {}) => ({ follow: 'teo', from, at, f, dof: 0.15, ...o });
const shots = [
  { t0: 0, t1: CUT.B, cam: 'free0', free: tr([4.2, 0.9, 5.2], [-1.5, 0.8, 0], 34, { who: 'teo' }), hold: true, move: 'none' },                                                  // plaza: tracking beside the car as it pulls away from the bank
  { t0: CUT.B, t1: CUT.B2, cam: 'free1', free: tr([-1.2, 0.8, 6.2], [0.3, 0.8, -5], 30, { who: 'teo' }), hold: true, move: 'none' },                                    // low chase from the left, plate readable
  { t0: CUT.B2, t1: CUT.C, cam: 'free1b', free: tr([0.6, 0.95, 6.8], [-0.1, 0.75, -5], 30, { who: 'teo' }), hold: true, move: 'none' },                                // low chase straight behind (flash 1, hit-stop)
  { t0: CUT.C, t1: CUT.D, cam: 'free2', free: tr([-0.34, 1.75, -4.6], [-0.34, 0.97, 0], 75, { who: 'teo' }), hold: true, move: 'none' },                              // FRONT two-shot (long lens, above the bonnet)
  { t0: CUT.D, t1: CUT.E, cam: 'free3', free: tr([3.4, 1.4, 28], [-2.6, 1.0, -8], 40, { who: 'teo' }), hold: true, move: 'none' },                                      // police closing in
  { t0: CUT.E, t1: 8.0, cam: 'free4', free: tr([0.8, 0.9, 7.0], [-0.1, 1.8, -6], 30, { who: 'teo' }), hold: true, move: 'none' },                                         // the ramp
  { t0: 8.0, t1: 10.8, cam: 'free5', free: tr([-16, 2.9, 0], [0, 0.5, 0], 45, { who: 'teo' }), hold: true, move: 'none' },                                              // THE JUMP: side tracking (car about half the frame width)
  { t0: 10.8, t1: 14.5, cam: 'free6', free: tr([3.4, 1.2, 9], [-0.4, 1.0, -5], 32, { who: 'teo' }), hold: true, move: 'none' },                                          // cruise by the sea
];
export default {
  id: 'gta_drive_full', pack: 'trada', set: 'gta', fps: 60, dur: 14.5, cast: ['teo', 'bip'], partners: { teo: 'bip', bip: 'teo' }, castOpts: { teo: { gta: true }, bip: { glass: true, belt: true } },
  setOpts: { places: [{ t: 0, place: 'plaza' }, { t: CUT.B, place: 'road' }], cars: { hero: {}, police: 2 }, follow: 'teo' },
  slomo: [{ t0: 8.0, t1: 10.8, rate: 0.4, ease: 0.15 }], hits: [{ t: T1 + 0.25, frames: 15 }],
  shots, lines: [], acts, overlays: [],
};
