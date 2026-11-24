// look test: the alley and the blue gate (Zombie special, Part 2)
import { shotsFrom, standIns } from './zb_sets_common.js';
const C = { wide_in: { from: [0, 1.5, 8.5], at: [0, 1.4, -10], f: 24 }, low_block: { from: [0, 0.4, -4.5], at: [0, 1.0, 2], f: 28 }, gate_close: { from: [0.0, 1.3, -6.5], at: [0, 1.25, -10], f: 40 }, inside_back: { from: [0, 1.2, -8.2], at: [0, 1.1, -11.8], f: 45 } };
const F = (o) => ({ dof: 0.3, who: 'ba', ...o });
export default {
  pack: 'trada', set: 'gate', fps: 30, dur: 12.9, cast: ['ba', 'me'], partners: { ba: 'me', me: 'ba' },
  seats: { ba: { pos: [0, 0, -9.0], yaw: Math.PI }, me: { pos: [0, 0, -11.6], yaw: Math.PI } },
  props: standIns(['block_l', 'block_r', 'horde1', 'horde2', 'horde3', 'horde4', 'horde5', 'horde6', 'horde7', 'horde8', 'horde9', 'horde10']),
  shots: shotsFrom([[0.9, F(C.wide_in)], [0.9, F(C.low_block)], [0.9, F(C.gate_close)], [2.4, F(C.inside_back)], [1.6, F({ from: [0.3, 2.05, -8.2], at: [1.05, 2.25, -9.7], f: 55, dof: 0.5 })], [2.2, F({ from: [0, 0.5, 9.5], at: [0, 1.2, -6], f: 26 })], [2, F({ from: [0.6, 7.5, 0], at: [0, 0.2, -5], f: 30 })], [2, F({ from: [0.35, 1.5, -2.2], at: [0, 1.4, -10], f: 30 })]]),
  lines: [],
  acts: [{ t: 4.6, who: 'set', fx: { open: 1 }, d: 1.6 }, { t: 4.0, who: 'set', fx: { knock: 1 }, d: 0.1 }, { t: 4.55, who: 'set', fx: { knock: 0 }, d: 0.1 }],
};
