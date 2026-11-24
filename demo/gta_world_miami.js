// the recognition stills: one wide of the road at an intersection, one wide of the plaza (a stranger should say "Miami / GTA" in a second)
import { P, shotsFrom, F, at } from './gta_world_common.js';
const r = (v) => P('road', v), p = (v) => P('plaza', v);
export default {
  id: 'gta_world_miami', pack: 'trada', set: 'gta', fps: 30, dur: 7.0, cast: ['teo', 'bip'], castOpts: { teo: { stand: 1 } },
  setOpts: { places: [{ t: 0, place: 'road' }, { t: 4, place: 'plaza' }], follow: 'teo',
    stands: [{ t: 0, who: 'teo', pos: r([2.75, 0, -31]), yaw: 0 }, { t: 0, who: 'bip', pos: r([4.2, -100, 4]) }, at(4, 'teo', 'plaza.stand_teo'), at(4, 'bip', 'plaza.bench_bip')] },
  shots: shotsFrom([
    [1, F('teo', { from: r([2.0, 2.0, -3]), at: r([3.5, 4.0, -45]), f: 22 })],
    [1, F('teo', { from: r([-2.0, 1.4, -6]), at: r([5.0, 3.8, -44]), f: 24 })],
    [1, F('teo', { from: r([2.75, 1.0, -10]), at: r([3.0, 3.0, -44]), f: 26 })],
    [1, F('teo', { from: r([3.5, 2.5, -8]), at: r([10, 7, -30]), f: 28 })],
    [1, F('teo', { from: p([6.0, 1.6, 6.6]), at: p([-1.0, 2.9, -3.0]), f: 22 })],
    [1, F('teo', { from: p([3.0, 1.4, 6.5]), at: p([3.0, 3.8, -7]), f: 20 })],
    [1, F('teo', { from: p([-2.0, 1.2, 4.5]), at: p([3.0, 3.0, -7]), f: 24 })],
  ]),
  lines: [], acts: [{ t: -1, who: 'bip', pose: 'cup' }],
};
