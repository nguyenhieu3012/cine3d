// motion test (Zombie motion pass, the owner "Hay cho Tèo cõng Bíp đi"): the piggyback. Tèo crouches with his back to the fallen Bíp, pulls his arms over his
// shoulders and heaves him up (Tèo fx piggy 1 + hoist 0 -> 1, Bíp fx ride 1); runs with him (side tracking, front, three-quarter back); a tight front close-up
// where Bíp is hidden (Bíp fx hide 1); the trip throws Bíp forward and Tèo lands half over him.
import { path } from '../core/player.js';
import { qaPad } from './zb_chars_shots.js';
const Y = Math.PI / 2, X0 = -5, Z0 = 2.95;
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 11.5, cast: ['teo', 'bip'], setOpts: { day: 'NGÀY 1' }, castOpts: { teo: { stand: 1 }, bip: { stand: 1 } },
  seats: { teo: { pos: [X0, 0, Z0], yaw: 0 }, bip: { pos: [X0 - 0.05, 0, Z0 - 0.62], yaw: 0 } }, rides: { bip: 'teo' },
  shots: qaPad([
    { t0: 0, t1: 2.8, cam: 'free', free: { from: [X0 + 2.6, 0.75, Z0 - 0.2], at: [X0, 0.5, Z0 - 0.25], f: 34, dof: 0.12 }, hold: true },                 // hoist, side
    { t0: 2.8, t1: 5.0, cam: 'free', free: { follow: 'teo', from: [0.1, 0.85, 3.4], at: [0.1, 0.8, 0], f: 34, dof: 0.12 }, hold: true },                // run, side tracking
    { t0: 5.0, t1: 6.5, cam: 'free', free: { follow: 'teo', from: [2.5, 1.15, 0.15], at: [0, 1.0, 0], f: 36, dof: 0.15 } },                            // run, front
    { t0: 6.5, t1: 8.0, cam: 'free', free: { follow: 'teo', from: [-1.9, 1.35, 1.6], at: [0, 0.95, 0], f: 34, dof: 0.12 } },                           // run, three-quarter back
    { t0: 8.0, t1: 9.4, cam: 'free', free: { follow: 'teo', from: [1.7, 1.28, 0.03], at: [0.25, 1.2, 0], f: 72, dof: 0.4 } },                              // tight front close-up: Bíp hidden
    { t0: 9.4, t1: 11.5, cam: 'free', free: { from: [7.9, 0.8, Z0 + 3.2], at: [7.9, 0.4, Z0], f: 30, dof: 0.1 }, hold: true },                         // the trip
  ], 'teo', 'bip'),
  lines: [],
  acts: [
    { t: -1, who: 'bip', fx: { lie: 1, off: 1, batt: 0.03 }, d: 0.01 }, { t: 0, who: 'teo', emo: 'terror', pose: 'side' },
    { t: 1.0, who: 'teo', fx: { piggy: 1 }, d: 0.01 }, { t: 1.0, who: 'teo', fx: { hoist: 1 }, d: 1.4, ease: 'lin' }, { t: 1.0, who: 'teo', emo: 'squeeze' },
    { t: 1.05, who: 'bip', fx: { ride: 1, lie: 0 }, d: 0.45 },
    { t: 2.4, who: 'teo', emo: 'terror' }, { t: 2.6, who: 'teo', fx: { run: 1 }, d: 0.3 }, { t: 2.45, who: 'teo', fx: { dir: Y }, d: 0.3 },
    { t: 2.6, who: 'teo', fx: { x: 7 - X0 }, d: 6.9, ease: 'lin' }, { t: 5.0, who: 'teo', fx: { panic: 0.7 }, d: 0.4 },
    { t: 8.0, who: 'bip', fx: { hide: 1 }, d: 0.3 }, { t: 9.4, who: 'bip', fx: { hide: 0 }, d: 0.3 },
    { t: 9.5, who: 'teo', fx: { run: 0, panic: 0, trip: 1 }, d: 1.0, ease: 'lin' }, { t: 9.5, who: 'teo', emo: 'scream' },
  ],
  overlays: [],
};
