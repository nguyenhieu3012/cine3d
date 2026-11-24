// look test 2 for layout 'block': stall seen from the front warm then after the blackout, generator, QR sticker + socket in the shop, trolley (Bíp inside, Tèo gripping and dragged), the long run direction and the debt note at `fall`
import { shotsFrom } from './zb_sets_common.js';
const F = (who, o) => ({ dof: 0.25, who, ...o });
export default {
  pack: 'trada', set: 'zombie', fps: 30, dur: 12.2, cast: ['teo', 'bip', 'zlandlord', 'horde'], partners: { teo: 'bip', bip: 'teo', zlandlord: 'teo', horde: 'teo' },
  seats: { zlandlord: { pos: [-30, 0, 5.15], yaw: Math.PI / 2 }, horde: { pos: [-33, 0, 6.2], yaw: Math.PI / 2 } },
  castOpts: { bip: { batt: 0.12 }, horde: { n: 8, width: 2.4, depth: 1.6 } },
  setOpts: { layout: 'block', market: { rider: 'bip', holder: 'teo' }, stands: [
    { t: 8.0, who: 'teo', pos: [-2, 0, 20.5] }, { t: 8.0, who: 'bip', pos: [-2, 0, 19] },
    { t: 10.4, who: 'teo', mark: 'run_a' }, { t: 10.4, who: 'bip', mark: 'run_b' }, { t: 10.4, who: 'horde', mark: 'horde1' },
  ] },
  shots: shotsFrom([
    [1.0, F('teo', { from: [0.3, 1.3, 4.4], at: [-0.3, 1.0, 0], f: 30 })], [1.0, F('teo', { from: [-1.4, 1.5, 1.8], at: [-1.9, 1.7, -0.9], f: 38 })],
    [1.2, F('teo', { from: [0.3, 1.3, 4.4], at: [-0.3, 1.0, 0], f: 30 })], [1.2, F('teo', { from: [-1.4, 1.5, 1.8], at: [-1.9, 1.7, -0.9], f: 38 })],
    [1.2, F('teo', { from: [-3.0, 0.9, 8.6], at: [-3.9, 0.6, 10.85], f: 45 })], [1.2, F('teo', { from: [-2.6, 1.3, 16.5], at: [-4.15, 1.25, 17.0], f: 30 })],
    [1.6, F('teo', { from: [-3.2, 1.0, 16.6], at: [-2, 0.8, 19.6], f: 38 })], [1.6, F('teo', { from: [-0.8, 0.8, 17.2], at: [-2, 0.8, 20.2], f: 42 })],
    [1.2, F('teo', { from: [0, 1.3, 2.5], at: [18, 1.0, 5.85], f: 30 })], [1.0, F('teo', { from: [27.5, 0.6, 5.2], at: [26, 0.1, 5.85], f: 40 })],
  ]),
  lines: [],
  acts: [
    { t: 2.0, who: 'set', fx: { blackout: 1 }, d: 1.4 }, { t: 7.0, who: 'set', fx: { ride: 1, hold: 1 }, d: 0.2 }, { t: 7.4, who: 'set', fx: { tz: 3, drag: 1, tshake: 1 }, d: 1.0 },
    { t: 8.0, who: 'teo', fx: { stand: 1 }, d: 0.01 }, { t: 8.0, who: 'bip', fx: { stand: 1 }, d: 0.01 },
    { t: 10.3, who: 'set', fx: { ride: 0, hold: 0, tz: 0, drag: 0, tshake: 0 }, d: 0.05 },
  ],
};
