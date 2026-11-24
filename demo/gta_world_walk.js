// look test: Tèo walks from the bank door to the chairs (stands.walk + fx walk): feet, facing, no sliding
import { P, shotsFrom, F, at, fx } from './gta_world_common.js';
const b = (v) => P('bank', v);
export default {
  id: 'gta_world_walk', pack: 'trada', set: 'gta', fps: 30, dur: 5.0, cast: ['teo'], castOpts: { teo: { stand: 1 } },
  setOpts: { places: [{ t: 0, place: 'bank' }], stands: [{ t: 0, who: 'teo', mark: 'bank.door_in', walk: [{ t: 4, mark: 'bank.wait_3' }] }] },
  shots: shotsFrom([[5, F('teo', { from: b([-0.5, 1.5, 1.5]), at: b([-2.6, 1.0, -4], ), f: 28 })]]),
  lines: [], acts: [{ t: 0, who: 'teo', fx: { walk: 1 }, d: 0.3 }, { t: 3.9, who: 'teo', fx: { walk: 0 }, d: 0.3 }],
};
