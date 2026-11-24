// motion test (Zombie motion pass): Tèo sprints with Bíp across his chest (heavier, shorter steps, leaning back; Bíp's limbs, head and antenna swing a beat late), side + front.
import { path } from '../core/player.js';
const Y = Math.PI / 2;
import { qaPad } from './zb_chars_shots.js';
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 8, cast: ['teo', 'bip'], setOpts: { day: 'NGÀY 1' }, castOpts: { teo: { stand: 1 }, bip: { stand: 1 } },
  seats: { teo: { pos: [-4, 0, 2.2], yaw: Y }, bip: { pos: [-3.5, 0, 1.0], yaw: 0 } }, rides: { bip: 'teo' },
  shots: qaPad([
    { t0: 0, t1: 4, cam: 'free', free: { follow: 'teo', from: [0.1, 0.85, 3.6], at: [0.1, 0.75, 0], f: 34, dof: 0.15 }, hold: true },
    { t0: 4, t1: 8, cam: 'free', free: { follow: 'teo', from: [0.05, 1.1, 3.3], at: [0, 0.95, 0], f: 40, dof: 0.2 }, hold: true },
  ], 'teo', 'bip'),

  lines: [],
  acts: [
    { t: -1, who: 'teo', fx: { run: 1, carry: 1 }, d: 0.01 }, { t: -1, who: 'bip', fx: { ride: 1, off: 1, batt: 0.03, stand: 1 }, d: 0.01 }, { t: 0, who: 'teo', emo: 'terror' },
    ...path('teo', [[0, -4, 2.2], [4, 4, 2.2], [4.4, 4.3, 2.6], [8, 4.3, 9.0]], { seat: [-4, 2.2], yaw0: Y, turn: 0.35 }),
  ],
  overlays: [],
};
