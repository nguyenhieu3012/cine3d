// look test: layout 'block' of the composite 'zombie' set: the stall on the near pavement, the road, the charger shop across it (sign ĐIỆN MÁY · SẠC PIN, generator), blackout, QR card, bite pair, crossing, trolley with Bíp inside and Tèo on the handle, shutter hide. REAL characters.
import { shotsFrom } from './zb_sets_common.js';
const F = (who, o) => ({ dof: 0.25, who, ...o });
const OTS = { from: [-0.25, 1.5, -1.25], at: [-1.2, 1.5, 12], f: 34 };
export default {
  pack: 'trada', set: 'zombie', fps: 30, dur: 16.8, cast: ['teo', 'bip', 'zshipper', 'victim', 'zlandlord', 'horde'], partners: { teo: 'bip', bip: 'teo', zshipper: 'victim', victim: 'zshipper', zlandlord: 'teo', horde: 'teo' },
  seats: { zshipper: { pos: [-0.6, 0, 5.85], yaw: -Math.PI / 2 }, victim: { pos: [-1.2, 0, 5.85], yaw: Math.PI / 2 }, zlandlord: { pos: [-30, 0, 5.15], yaw: Math.PI / 2 }, horde: { pos: [-33, 0, 6.2], yaw: Math.PI / 2 } },
  castOpts: { bip: { batt: 0.12 }, horde: { n: 8, width: 2.4, depth: 1.6 } },
  setOpts: {
    layout: 'block',
    stands: [
      { t: 9.9, who: 'teo', mark: 'curb_stall' }, { t: 9.9, who: 'bip', pos: [-0.9, 0, 2.5] },
      { t: 11.1, who: 'teo', mark: 'curb_shop' }, { t: 11.1, who: 'bip', pos: [-1.4, 0, 9.5] },
      { t: 12.5, who: 'teo', pos: [-2, 0, 17.5] }, { t: 12.5, who: 'bip', pos: [-2, 0, 17] },
      { t: 15.2, who: 'teo', mark: 'shutter_hide' }, { t: 15.2, who: 'bip', mark: 'shutter_hide_b' },
    ],
    market: { rider: 'bip', holder: 'teo' },
  },
  shots: shotsFrom([
    [0.9, F('victim', OTS)], [0.9, F('victim', { from: [-0.25, 1.3, -1.0], at: [-2, 3.5, 12], f: 80 })], [0.9, F('victim', { from: [-0.62, 1.25, 0.72], at: [-1.0, 1.0, -0.4], f: 55 })],
    [0.9, F('victim', { from: [-0.1, 0.95, 1.25], at: [-0.15, 0.5, 0.5], f: 55 })],
    [1.5, F('victim', OTS)], [1.1, F('victim', { from: [-0.25, 1.3, -1.0], at: [-2, 3.5, 12], f: 80 })], [1.1, F('victim', { from: [-0.62, 1.25, 0.72], at: [-1.0, 1.0, -0.4], f: 55 })],
    [1.1, F('victim', { from: [-0.1, 0.95, 1.25], at: [-0.15, 0.5, 0.5], f: 55 })],
    [1.5, F('victim', { from: [0.2, 1.1, -0.5], at: [-0.9, 1.1, 5.85], f: 40 })],
    [1.2, F('victim', { from: [-2, 0.55, 1.2], at: [-2, 1.0, 11], f: 28 })],
    [1.4, F('victim', { from: [-1.5, 1.2, 7.5], at: [-2.2, 1.2, 12.5], f: 32 })],
    [1.4, F('victim', { from: [-1.2, 1.1, 14.0], at: [-2.2, 0.9, 18.5], f: 24 })],
    [1.5, F('victim', { from: [-3.0, 1.0, 14.5], at: [-2, 0.7, 18.5], f: 36 })],
    [1.4, F('victim', { from: [5.5, 1.2, 8.8], at: [8, 1.0, 11.7], f: 40 })],
  ]),
  lines: [],
  acts: [
    { t: 9.8, who: 'teo', fx: { stand: 1 }, d: 0.01 }, { t: 9.8, who: 'bip', fx: { stand: 1 }, d: 0.01 },
    { t: 2.7, who: 'set', fx: { spill: 1 }, d: 1.2 }, { t: 6.0, who: 'set', fx: { qrwet: 1 }, d: 0.8 },
    { t: 3.7, who: 'set', fx: { blackout: 1 }, d: 1.4 }, { t: 5.0, who: 'set', fx: { cold: 0.35 }, d: 1.0 },
    { t: 8.4, who: 'set', fx: { notes: 1 }, d: 0.6 },
    { t: 12.5, who: 'set', fx: { ride: 1, hold: 1 }, d: 0.3 }, { t: 12.9, who: 'set', fx: { tz: 5, tshake: 1 }, d: 1.0 },
    { t: 15.2, who: 'set', fx: { ride: 0, hold: 0, tz: 0, tshake: 0 }, d: 0.05 },
  ],
};
