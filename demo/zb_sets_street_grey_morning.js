// look test: ruined street (Zombie special). ?time via setOpts. Cast: Bà + Mẹ standing as the two runners, stand-in zombies as the horde.
import { shotsFrom, standIns } from './zb_sets_common.js';
const horde = Array.from({ length: 15 }, (_, i) => 'horde' + (i + 1));
export default {
  pack: 'trada', set: 'street', fps: 30, dur: 12.9, cast: ["ba", "me"], setOpts: { time: "grey_morning" }, partners: { ba: 'me', me: 'ba' },
  seats: { ba: { pos: [-0.55, 0, 0], yaw: 0 }, me: { pos: [0.6, 0, 0.15], yaw: 0 } },
  props: standIns([...horde, 'biter', 'victim']),
  shots: shotsFrom([
    [0.9, { from: [0, 0.55, 6.5], at: [0, 1.3, -6], f: 27, dof: 0.2, who: 'ba' }],                         // low wide: depth to run through
    [0.9, { from: [0.5, 13, 5.5], at: [0, 0.3, -3.2], f: 32, dof: 0.2, who: 'ba' }],                      // high angle: the pile-on
    [1.2, { from: [-4.3, 1.35, -3.9], at: [-1.5, 1.1, -0.9], f: 45, dof: 0.5, who: 'ba' }],                // through the kiosk gap
    [2.9, { from: [1.9, 0.55, 0.9], at: [3.1, 0.25, -1.2], f: 45, dof: 0.5, who: 'ba' }],                  // close on a tipped bike
    [2, { from: [0, 1.3, 3.8], at: [0, 1.15, 0], f: 40, dof: 0.4, who: 'ba' }],                          // front on the runners
    [2, { from: [1.6, 1.5, -5.5], at: [-0.5, 1.3, -22], f: 30, dof: 0.2, who: 'ba' }],                   // from behind the horde, far end of the street
    [3, { from: [-0.5, 3.4, -2], at: [0, 1.0, 3], f: 28, dof: 0.2, who: 'ba' }],                         // wide from the far side towards the camera mark
  ]),
  lines: [], acts: [],
};
