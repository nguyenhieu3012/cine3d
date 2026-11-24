import { shotsFrom } from './zb_sets_common.js';
const F = (who, o) => ({ dof: 0.25, who, ...o });
export default {
  pack: 'trada', set: 'zombie', fps: 30, dur: 3.6, cast: ['teo', 'bip', 'zshipper', 'victim'], partners: { teo: 'bip', bip: 'teo', zshipper: 'victim', victim: 'zshipper' },
  seats: { zshipper: { pos: [-0.6, 0, 5.85], yaw: -Math.PI / 2 }, victim: { pos: [-1.2, 0, 5.85], yaw: Math.PI / 2 } },
  castOpts: { bip: { batt: 0.12 } },
  setOpts: { layout: 'block' },
  shots: shotsFrom([
    [1.2, F('bip', { from: [-0.1, 1.3, -1.0], at: [-1.2, 1.55, 12], f: 32 })], [1.2, F('bip', { from: [-0.9, 1.3, -1.0], at: [-1.2, 1.55, 12], f: 32 })], [1.2, F('bip', { from: [-0.45, 1.5, -1.1], at: [-1.6, 1.4, 12], f: 30 })],
  ]),
  lines: [], acts: [{ t: 0, who: 'set', fx: { notes: 0.8 }, d: 0.01 }],
};
