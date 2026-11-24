// motion test (Zombie motion pass, 13/11): walk -> sprint (stride tied to the ground speed: the planted foot must not slide) -> panic (flailing, looking back,
// stumbles) with the terror face, side view tracking then front view; Bíp and Chíp sprint side by side.
import { PACKS } from '../packs/index.js';
import { ZOMBIE_CHARS } from '../packs/trada/zombie.js';
import { makeChip } from '../packs/trada/chip.js';
import { path } from '../core/player.js';
Object.assign(PACKS.trada.chars, ZOMBIE_CHARS, { chip: makeChip });
const Y = Math.PI / 2;
import { qaPad } from './zb_chars_shots.js';
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 12, cast: ['teo', 'bip', 'chip'], setOpts: { day: 'NGÀY 1' },
  castOpts: { teo: { stand: 1 }, bip: { stand: 1 }, chip: { stand: 1 } },
  seats: { teo: { pos: [-4, 0, 2.2], yaw: Y }, bip: { pos: [-4, 0, 3.4], yaw: Y }, chip: { pos: [-4, 0, 4.0], yaw: Y } },
  shots: qaPad([
    { t0: 0, t1: 1.6, cam: 'free', free: { from: [-2.6, 0.75, 6.0], at: [-2.6, 0.6, 2.2], f: 34, dof: 0.1 }, hold: true },                                  // fixed: the walk (feet against the tiles)
    { t0: 1.6, t1: 3.4, cam: 'free', free: { follow: 'teo', from: [0.2, 0.7, 3.4], at: [0.2, 0.62, 0], f: 34, dof: 0.15 }, hold: true },                   // tracking side: the sprint
    { t0: 3.4, t1: 5.0, cam: 'free', free: { from: [2.6, 0.7, 5.5], at: [2.6, 0.6, 2.2], f: 30, dof: 0.1 } },                                            // fixed side: the sprint passes (foot plant)
    { t0: 5.0, t1: 8.0, cam: 'free', free: { follow: 'teo', from: [0.1, 1.05, 3.4], at: [0, 0.95, 0], f: 40, dof: 0.2 }, hold: true },                    // front tracking: panic + terror
    { t0: 8.0, t1: 12, cam: 'free', free: { follow: 'bip', from: [0.35, 0.7, 3.6], at: [0.35, 0.5, 0], f: 34, dof: 0.15 }, hold: true },                 // Bíp and Chíp sprint
  ], 'teo', 'bip'),

  lines: [],
  acts: [
    { t: -1, who: 'teo', fx: { walk: 1 }, d: 0.01 }, { t: 0, who: 'teo', pose: 'side', emo: 'worry' },
    ...path('teo', [[0, -4, 2.2], [1.6, -2.4, 2.2], [5.0, 4.0, 2.2], [5.4, 4.3, 2.5], [8.0, 4.3, 9.4]], { seat: [-4, 2.2], yaw0: Y, turn: 0.35 }),
    { t: 1.45, who: 'teo', fx: { walk: 0, run: 1 }, d: 0.25 }, { t: 1.6, who: 'teo', emo: 'shock' },
    { t: 5.0, who: 'teo', fx: { panic: 1 }, d: 0.4 }, { t: 5.0, who: 'teo', emo: 'terror' },
    { t: -1, who: 'bip', fx: { stand: 1, run: 1, batt: 0.2 }, d: 0.01 }, { t: -1, who: 'chip', fx: { stand: 1, run: 1 }, d: 0.01 },
    ...path('bip', [[0, -4, 3.4], [7.9, -4, 3.4], [12, 6.0, 3.4]], { seat: [-4, 3.4], yaw0: Y }), ...path('chip', [[0, -4, 4.0], [7.9, -4, 4.0], [12, 6.0, 4.0]], { seat: [-4, 4.0], yaw0: Y }),
    { t: 8, who: 'chip', emo: 'worry' }, { t: 8, who: 'bip', emo: 'judge' },
  ],
  overlays: [],
};
