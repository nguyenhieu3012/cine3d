// look test: the GTA plaza (bank square at dusk, Miami deco) with the real Tèo (standing) and Bíp (seated on the stone bench with his glass)
import { P, shotsFrom, F, at, fx } from './gta_world_common.js';
const p = (v) => P('plaza', v);
export default {
  id: 'gta_world_plaza', pack: 'trada', set: 'gta', fps: 30, dur: 12.0, cast: ['teo', 'bip'], partners: { teo: 'bip', bip: 'teo' },
  castOpts: { teo: { stand: 1 }, bip: {} },
  setOpts: { places: [{ t: 0, place: 'plaza' }], stands: [at(0, 'teo', 'plaza.stand_teo'), at(0, 'bip', 'plaza.bench_bip')] },
  shots: shotsFrom([
    [1.0, F('teo', { from: p([6.0, 1.6, 6.6]), at: p([-1.0, 2.9, -3.0]), f: 22 })],           // wide with the sun and the sea
    [1.0, F('teo', { from: p([2.0, 1.5, 6.0]), at: p([2.0, 3.6, -7]), f: 20 })],              // wide front, the bank sign
    [1.0, F('teo', { from: p([1.2, 1.2, 3.2]), at: p([1.2, 0.95, -1.4]), f: 40 })],           // two
    [1.0, F('bip', { from: p([2.9, 0.95, 1.4]), at: p([2.9, 0.8, -1.2]), f: 50 })],            // bench close
    [1.0, F('teo', { from: p([3.0, 2.2, 3.4]), at: p([3.0, 5.4, -7]), f: 50 })],               // sign close
    [1.0, F('teo', { from: p([-1.5, 1.3, -4.2]), at: p([3.2, 1.2, -6.8]), f: 40 })],           // door side
    [1.0, F('teo', { from: p([0.8, 0.5, 2.4]), at: p([-0.6, 0.35, -1.6]), f: 40 })],           // landing dust
    [1.0, F('teo', { from: p([3.4, 1.4, -0.2]), at: p([3.0, 1.2, -7]), f: 36 })],              // door
    [1.0, F('teo', { from: p([-6, 1.8, 3]), at: p([-14, 2.4, -6]), f: 28 })],                  // sea, hut, flamingos
    [1.0, F('teo', { from: p([10, 1.4, 5]), at: p([14, 2.5, -4]), f: 28 })],                   // right side
    [1.0, F('teo', { from: p([4.2, 0.8, 5.0]), at: p([6.4, 0.7, 1.9]), f: 40 })],              // car spot
    [1.0, F('teo', { from: p([1.2, 1.4, 5.5]), at: p([1.2, 1.5, -2]), f: 32 })],
  ]),
  lines: [], acts: [{ t: -1, who: 'bip', pose: 'cup' }, fx(-1, { dust: 0, door: 0 }, 0.01), fx(7.0, { dust: 1, door: 1 }, 0.6)],
};
