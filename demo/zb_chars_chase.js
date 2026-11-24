// motion test (Zombie motion pass): the zombie chase. A single zombie charges (fast, uneven, one leg dragging, claws swiping, head jerking) next to one lurching
// (the walk, for comparison); the horde charges with members out of phase, overtaking one another. Side then front.
import { PACKS } from '../packs/index.js';
import { ZOMBIE_CHARS } from '../packs/trada/zombie.js';
import { path } from '../core/player.js';
Object.assign(PACKS.trada.chars, ZOMBIE_CHARS);
const Y = Math.PI / 2;
import { qaPad } from './zb_chars_shots.js';
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 10, cast: ['zguard', 'zfriend', 'horde'], setOpts: { day: 'NGÀY 1' },
  castOpts: { horde: { n: 12, seed: 4, width: 1.8, depth: 2.4 } },
  seats: { zguard: { pos: [-4.5, 0, 2.2], yaw: Y }, zfriend: { pos: [-4.5, 0, 3.4], yaw: Y }, horde: { pos: [-1, 0, -2], yaw: 0 } }, partners: { zguard: 'zfriend', zfriend: 'zguard', horde: 'zguard' },
  shots: qaPad([
    { t0: 0, t1: 4, cam: 'free', free: { follow: 'zguard', from: [0.3, 0.85, 3.9], at: [0.3, 0.75, 0], f: 30, dof: 0.12 }, hold: true },
    { t0: 4, t1: 7, cam: 'free', free: { follow: 'horde', from: [0.0, 1.3, 4.6], at: [0, 0.9, 0], f: 30, dof: 0.12 }, hold: true },
    { t0: 7, t1: 10, cam: 'free', free: { follow: 'horde', from: [4.2, 1.1, 0.6], at: [0, 0.8, -0.4], f: 28, dof: 0.12 }, hold: true },
  ], 'zguard', 'zfriend'),

  lines: [],
  acts: [
    { t: -1, who: 'zguard', fx: { charge: 1 }, d: 0.01 }, { t: -1, who: 'zfriend', fx: { lurch: 1 }, d: 0.01 }, { t: -1, who: 'horde', fx: { charge: 1 }, d: 0.01 },
    ...path('zguard', [[0, -4.5, 2.2], [4, 4.0, 2.2]], { seat: [-4.5, 2.2], yaw0: Y }), ...path('zfriend', [[0, -4.5, 3.4], [4, -2.0, 3.4]], { seat: [-4.5, 3.4], yaw0: Y }),
    ...path('horde', [[0, -1, -6], [10, -1, 9]], { seat: [-1, -2], yaw0: 0, face: false }),
  ],
  overlays: [],
};
