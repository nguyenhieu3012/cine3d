// look test: supermarket (Zombie special): entrance from outside, aisle, GIẢM SỐC, noodle shelf, charger shelf, trolley with a rider, exit to the street (grey morning -> night)
import { shotsFrom, standIns } from './zb_sets_common.js';
const C = { entrance_out: { from: [0.5, 1.25, 7.6], at: [0, 1.25, 0], f: 28 }, aisle_down: { from: [0, 1.3, 1.6], at: [0, 1.2, -9], f: 24 }, sign_close: { from: [-1.1, 1.8, -0.2], at: [-2.6, 1.98, -1.93], f: 55 }, noodle_close: { from: [-0.7, 1.0, -5.0], at: [-2.2, 0.8, -5.0], f: 40 }, charger_close: { from: [0.7, 1.4, -4.1], at: [2.2, 1.4, -4.1], f: 45 }, trolley_low: { from: [-1.2, 0.45, -3.8], at: [0, 0.8, -7], f: 30 }, exit_in: { from: [0, 0.9, -5.0], at: [0, 1.0, 4], f: 26 } };
const F = (k, o = {}) => ({ ...C[k], dof: 0.3, who: 'ba', ...o });
export default {
  pack: 'trada', set: 'market', fps: 30, dur: 15.1, cast: ['ba', 'me', 'teo'], setOpts: { time: 'night', rider: 'teo' }, partners: { ba: 'me', me: 'ba', teo: 'ba' },
  seats: { ba: { pos: [-0.55, 0, -4.5], yaw: Math.PI }, me: { pos: [0.55, 0, -4.5], yaw: Math.PI }, teo: { pos: [0.0, 0, -9.5], yaw: 0 } },
  props: standIns([{ pos: [-1.2, 0, -8.5], yaw: 0.2 }, { pos: [1.3, 0, -9.5], yaw: -0.3 }, { pos: [0.2, 0, -11.5], yaw: 0 }, { pos: [-3.7, 0, -6], yaw: 1.2 }]),
  shots: shotsFrom([[0.9, F('entrance_out')], [0.9, F('aisle_down')], [0.9, F('sign_close', { dof: 0.5 })], [2.3, F('noodle_close', { dof: 0.5 })], [1.5, F('charger_close', { dof: 0.5 })], [2.3, F('trolley_low')], [2, F('exit_in')], [2.3, F('entrance_out', { from: [0.5, 1.25, 9.6] })], [2, { from: [0, 6.5, 6.5], at: [0, 0.4, 0.5], f: 28, dof: 0.2, who: 'ba' }]]),
  lines: [],
  acts: [
    { t: 5.8, who: 'set', fx: { noodle: 1 }, d: 1.5 }, { t: 7.8, who: 'set', fx: { charger: 1 }, d: 0.5 }, { t: 9.2, who: 'set', fx: { ride: 1 }, d: 0.35 },
    { t: 9.8, who: 'set', fx: { tz: 14, tshake: 1 }, d: 5.5 }, { t: 12.5, who: 'set', fx: { power: 1 }, d: 0.2 },
  ],
};
