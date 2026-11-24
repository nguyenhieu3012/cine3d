// motion test (Zombie motion pass): Tèo, running with Bíp in his arms, trips (foot catches, pitches forward faster and faster, lands on Bíp, bounces, slides);
// the horde dives onto them one after another from different sides (short arcs, impacts), clawing. Side then front-high.
import { PACKS } from '../packs/index.js';
import { ZOMBIE_CHARS } from '../packs/trada/zombie.js';
import { path } from '../core/player.js';
Object.assign(PACKS.trada.chars, ZOMBIE_CHARS);
const Y = Math.PI / 2, PX = 1.6, PZ = 2.4;
import { qaPad } from './zb_chars_shots.js';
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 9, cast: ['teo', 'bip', 'horde'], setOpts: { day: 'NGÀY 1' },
  castOpts: { teo: { stand: 1 }, bip: { stand: 1 }, horde: { n: 14, seed: 3, width: 2.4, depth: 2.6, pileAt: [PX + 1.15, PZ] } },
  seats: { teo: { pos: [-2.5, 0, PZ], yaw: Y }, bip: { pos: [-3, 0, 1], yaw: 0 }, horde: { pos: [-3.5, 0, 2.6], yaw: Y } }, rides: { bip: 'teo' },
  shots: qaPad([
    { t0: 0, t1: 3.2, cam: 'free', free: { from: [2.4, 0.8, 5.9], at: [2.4, 0.45, PZ], f: 30, dof: 0.1 }, hold: true },
    { t0: 3.2, t1: 9, cam: 'free', free: { from: [PX + 3.3, 1.9, PZ + 2.8], at: [PX + 1.1, 0.35, PZ], f: 30, dof: 0.1 }, hold: true },
  ], 'bip', 'teo'),

  lines: [],
  acts: [
    { t: -1, who: 'teo', fx: { run: 1, carry: 1 }, d: 0.01 }, { t: -1, who: 'bip', fx: { ride: 1, off: 1, stand: 1 }, d: 0.01 }, { t: 0, who: 'teo', emo: 'terror' },
    ...path('teo', [[0, -2.5, PZ], [1.4, PX, PZ]], { seat: [-2.5, PZ], yaw0: Y }),
    { t: 1.4, who: 'teo', fx: { run: 0, trip: 1 }, d: 1.0, ease: 'lin' }, { t: 1.4, who: 'teo', emo: 'scream' }, { t: 2.0, who: 'teo', emo: 'squeeze' },
    { t: -1, who: 'horde', fx: { charge: 1 }, d: 0.01 }, ...path('horde', [[0, -3.5, 2.6], [3.0, PX - 1.2, 2.6]], { seat: [-3.5, 2.6], yaw0: Y, face: false }),
    { t: 3.0, who: 'horde', fx: { charge: 0 }, d: 0.3 }, { t: 2.9, who: 'horde', fx: { pile: 1 }, d: 3.4, ease: 'lin' },
    { t: 2.95, who: 'cam', fx: { shake: 1 }, d: 0.3 }, { t: 3.4, who: 'cam', fx: { punch: 1 }, d: 0.06 }, { t: 3.46, who: 'cam', fx: { punch: 0 }, d: 0.5 },
  ],
  overlays: [],
};
