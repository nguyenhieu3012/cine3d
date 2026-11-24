// proof stills for fix round 4: (1) plaza colour, (2) a blade seen from behind, (3) the side wall beside junction 1
import { P, shotsFrom, F, at } from './gta_world_common.js';
const r = (v) => P('road', v), p = (v) => P('plaza', v);
export default {
  id: 'gta_world_fix4', pack: 'trada', set: 'gta', fps: 30, dur: 3, cast: ['teo', 'bip'], castOpts: { teo: { stand: 1 } },
  setOpts: { places: [{ t: 0, place: 'plaza' }, { t: 1, place: 'road' }], follow: 'teo',
    stands: [at(0, 'teo', 'plaza.stand_teo'), at(0, 'bip', 'plaza.bench_bip'), { t: 1, who: 'teo', pos: r([2.75, 0, -30]), yaw: 0 }, { t: 1, who: 'bip', pos: r([4.2, -100, 4]) }] },
  shots: shotsFrom([
    [1, F('teo', { from: p([1.2, 1.2, 3.2]), at: p([1.2, 0.95, -1.4]), f: 40 })],
    [1, F('teo', { from: r([2.75, 1.0, -8]), at: r([5.0, 3.5, -36]), f: 30 })],           // chase view just after the stop line of junction 1 (looking at the hotels on the right)
    [1, F('teo', { from: r([5.0, 4.0, -45]), at: r([7.5, 9.5, -28]), f: 32 })],               // seen from behind a blade
  ]),
  lines: [], acts: [{ t: -1, who: 'bip', pose: 'cup' }],
};
