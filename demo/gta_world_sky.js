// look test: the fall. Tèo (flailing: arms up) and Bíp (seated upright with his glass) high above the coast city at dusk; wind streaks rush up, the city rises (fx descend)
import { P, shotsFrom, F, at, fx } from './gta_world_common.js';
const s = (v) => P('sky', v);
export default {
  id: 'gta_world_sky', pack: 'trada', set: 'gta', fps: 30, dur: 9.0, cast: ['teo', 'bip'], partners: { teo: 'bip', bip: 'teo' },
  castOpts: { teo: { stand: 1 }, bip: {} },
  setOpts: { places: [{ t: 0, place: 'sky' }], stands: [at(0, 'teo', 'sky.fall_teo'), at(0, 'bip', 'sky.fall_bip')] },
  shots: shotsFrom([
    [1, F('teo', { from: s([0, -0.55, 4.2]), at: s([0, 0.25, 0]), f: 42, dof: 0.1 })],
    [1, F('teo', { from: s([0, -0.55, 4.2]), at: s([0, 0.25, 0]), f: 42, dof: 0.1 })],
    [1, F('teo', { from: s([0.4, -0.9, 6.5]), at: s([0, -1.5, 0]), f: 30, dof: 0.1 })],
    [1, F('teo', { from: s([0, -2.2, 3.4]), at: s([0, 0.2, 0]), f: 34, dof: 0.1 })],
    [1, F('teo', { from: s([0, -0.55, 4.2]), at: s([0, 0.25, 0]), f: 42, dof: 0.1 })],
    [1, F('teo', { from: s([0, 0.2, 3.2]), at: s([0, 0.3, 0]), f: 50, dof: 0.1 })],
    [1, F('teo', { from: s([0, -0.55, 4.2]), at: s([0, 0.25, 0]), f: 42, dof: 0.1 })],
    [1, F('teo', { from: s([0, -0.55, 4.2]), at: s([0, 0.25, 0]), f: 42, dof: 0.1 })],
    [1, F('teo', { from: s([0, -0.55, 4.2]), at: s([0, 0.25, 0]), f: 42, dof: 0.1 })],
  ]).map((x, i) => (i === 4 ? { ...x, free: { ...x.free, f: 43 } } : i === 6 ? { ...x, free: { ...x.free, f: 44 } } : i === 7 ? { ...x, free: { ...x.free, f: 45 } } : i === 8 ? { ...x, free: { ...x.free, f: 46 } } : x)),
  lines: [], acts: [{ t: -1, who: 'teo', pose: 'cheer', emo: 'shock' }, { t: -1, who: 'bip', pose: 'cup' }, fx(0, { descend: 1 }, 8.5)],
};
