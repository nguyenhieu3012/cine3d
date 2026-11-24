// motion test (Zombie motion pass): the bite as one ramp on each: zshipper bite 0 -> 1 (wind-up, lunge and clamp, head shake) and victim bitten 0 -> 1
// (jolt, arms fly up, limp, knees give, drops with weight, still, twitches: hand, shoulder, head snaps up, rises in jerks) with turn alongside. Side then front.
import { PACKS } from '../packs/index.js';
import { ZOMBIE_CHARS } from '../packs/trada/zombie.js';
Object.assign(PACKS.trada.chars, ZOMBIE_CHARS);
const Y = Math.PI / 2;
import { qaPad } from './zb_chars_shots.js';
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 12, cast: ['victim', 'zshipper'], setOpts: { day: 'NGÀY 1' },
  seats: { victim: { pos: [0.2, 0, 2.3], yaw: -Y }, zshipper: { pos: [-0.35, 0, 2.3], yaw: Y } }, partners: { victim: 'zshipper', zshipper: 'victim' },
  shots: qaPad([
    { t0: 0, t1: 6, cam: 'free', free: { from: [0.0, 0.85, 5.6], at: [0.0, 0.7, 2.3], f: 38, dof: 0.12 }, hold: true },
    { t0: 6, t1: 12, cam: 'free', free: { from: [2.6, 0.9, 3.3], at: [0.0, 0.62, 2.2], f: 34, dof: 0.12 }, hold: true },
  ], 'victim', 'zshipper'),

  lines: [],
  acts: [
    { t: 0, who: 'zshipper', pose: 'rest' }, { t: 0, who: 'victim', pose: 'pockets', emo: 'worry' },
    { t: 0.6, who: 'zshipper', fx: { bite: 1 }, d: 1.3, ease: 'lin' }, { t: 1.25, who: 'victim', fx: { bitten: 1 }, d: 4.4, ease: 'lin' }, { t: 1.3, who: 'victim', emo: 'scream' },
    { t: 2.6, who: 'zshipper', fx: { bite: 0, x: -0.25 }, d: 0.6 }, { t: 3.0, who: 'victim', fx: { turn: 1 }, d: 1.8 }, { t: 3.1, who: 'victim', emo: 'neutral' },
    // the same again for the front view
    { t: 6.0, who: 'victim', fx: { bitten: 0, turn: 0 }, d: 0.01 }, { t: 6.0, who: 'zshipper', fx: { x: 0 }, d: 0.01 }, { t: 6.0, who: 'victim', emo: 'worry' },
    { t: 6.4, who: 'zshipper', fx: { bite: 1 }, d: 1.3, ease: 'lin' }, { t: 7.05, who: 'victim', fx: { bitten: 1 }, d: 4.4, ease: 'lin' }, { t: 7.1, who: 'victim', emo: 'scream' },
    { t: 8.4, who: 'zshipper', fx: { bite: 0, x: -0.25 }, d: 0.6 }, { t: 8.8, who: 'victim', fx: { turn: 1 }, d: 1.8 }, { t: 8.9, who: 'victim', emo: 'neutral' },
  ],
  overlays: [],
};
