// look test: the composite 'zombie' set with the REAL characters (Tèo standing, Bíp with the battery bar, Chíp, a zombie shipper, the horde, the granny zombie): scale, floor contact, face brightness on every place
import { shotsFrom } from './zb_sets_common.js';
const F = (who, o) => ({ dof: 0.25, who, ...o });
const HIDE = (t, who) => ({ t, who, pos: [0, -100, 0] });
const at = (t, who, mark, yaw) => ({ t, who, mark, yaw });
const pos = (t, who, p, yaw) => ({ t, who, pos: p, yaw });   // absolute spot (yaw is the final yaw here: pos has no mark yaw)
export default {
  pack: 'trada', set: 'zombie', fps: 30, dur: 12.8, cast: ['teo', 'bip', 'chip', 'zshipper', 'zgranny', 'horde'], partners: { teo: 'bip', bip: 'teo', chip: 'bip', zshipper: 'teo', zgranny: 'teo', horde: 'teo' },
  seats: Object.fromEntries(['chip', 'zshipper', 'zgranny', 'horde'].map((n) => [n, { pos: [0, -100, 0], yaw: 0 }])),   // cast members that are not on the stall's own marks start parked; `stands` puts them on the places
  castOpts: { teo: { stand: 1 }, bip: { stand: 1, batt: 0.3 }, chip: { stand: 1 }, horde: { n: 14, width: 2.8, depth: 2.6 } },
  setOpts: {
    street: { time: 'night' }, market: { time: 'night' }, stall: {},
    places: [{ t: 0, place: 'street' }, { t: 3.2, place: 'stall' }, { t: 6.4, place: 'market' }, { t: 9.6, place: 'gate' }],
    stands: [
      // street: two runners facing the camera, a zombie shipper beside them, the horde behind
      at(0, 'teo', 'street.run_a'), at(0, 'bip', 'street.run_b'), at(0, 'zshipper', 'street.biter', Math.PI), pos(0, 'horde', [400, 0, -2.6], 0), HIDE(0, 'chip'), HIDE(0, 'zgranny'),
      // stall: Tèo, Bíp and Chíp standing round the table, a zombie in the street behind
      pos(3.2, 'teo', [-1.0, 0, 0.5], 0.5), pos(3.2, 'bip', [0.9, 0, 0.6], -0.5), pos(3.2, 'chip', [1.6, 0, 0.35], -0.7), pos(3.2, 'zshipper', [2.6, 0, -1.4], -0.6), HIDE(3.2, 'horde'), HIDE(3.2, 'zgranny'),
      // market: two in the aisle, Chíp at the door, a zombie at the noodle shelf, a horde at the back
      pos(6.4, 'teo', [799.45, 0, -4.5], 0), pos(6.4, 'bip', [800.55, 0, -4.5], 0), pos(6.4, 'chip', [800, 0, 0.9], 0), pos(6.4, 'zshipper', [798.2, 0, -7.5], 1.2), pos(6.4, 'horde', [800, 0, -11.0], 0), HIDE(6.4, 'zgranny'),
      // gate: Bíp and Chíp block the alley, Tèo behind them, the horde at the mouth, the zombie granny inside the gate
      pos(9.6, "bip", [1199.64, 0, -1.5], 0), pos(9.6, "chip", [1200.36, 0, -1.5], 0), pos(9.6, 'teo', [1200, 0, -5.0], 0), pos(9.6, 'zgranny', [1200, 0, -11.6], 0), pos(9.6, 'horde', [1200, 0, 5.0], Math.PI), HIDE(9.6, 'zshipper'),
    ],
  },
  shots: shotsFrom([
    [1.0, F('teo', { from: [400, 0.9, 6.5], at: [400, 0.9, -2], f: 30 })], [1.1, F('teo', { from: [401.4, 1.0, 2.4], at: [400, 0.85, 0.0], f: 40 })], [1.1, F('teo', { from: [397.2, 1.0, -1.4], at: [400, 0.9, -1.2], f: 34 })],
    [1.1, F('teo', { from: [0.2, 1.2, 4.2], at: [0.2, 0.8, 0.4], f: 30 })], [1.1, F('bip', { from: [1.6, 1.0, 2.2], at: [1.2, 0.85, 0.4], f: 42 })], [1.0, F('teo', { from: [-2.2, 1.0, 2.0], at: [0.3, 0.8, 0.3], f: 34 })],
    [1.1, F('teo', { from: [800, 1.2, 0.2], at: [800, 1.0, -8], f: 26 })], [1.1, F('teo', { from: [800.6, 1.0, -1.8], at: [800, 0.85, -4.5], f: 42 })], [1.0, F('teo', { from: [796.5, 1.0, -5.5], at: [799.2, 0.85, -6.5], f: 36 })],
    [1.1, F('teo', { from: [1200, 1.2, 9.5], at: [1200, 1.0, 0.5], f: 26 })], [1.1, F('teo', { from: [1200, 1.2, -8.2], at: [1200, 1.1, -11.8], f: 40 })], [1.0, F('teo', { from: [1200.3, 1.1, -3.0], at: [1200, 1.0, 5.0], f: 32 })],
  ]),
  lines: [],
  acts: [],
};
