// look test: the teller's poses push (hand into the slot) and press (reaches under the desk, smiles) at QUẦY 3 with Tèo
import { P, shotsFrom, F, at, fx } from './gta_world_common.js';
const b = (v) => P('bank', v);
export default {
  id: 'gta_world_teller', pack: 'trada', set: 'gta', fps: 30, dur: 4.0, cast: ['teo', 'gdv'], partners: { teo: 'gdv', gdv: 'teo' }, castOpts: { teo: { stand: 1 } },
  setOpts: { places: [{ t: 0, place: 'bank' }], stands: [at(0, 'teo', 'bank.counter'), at(0, 'gdv', 'bank.teller')] },
  shots: shotsFrom([[1, F('gdv', { from: b([-0.2, 1.5, 3.6]), at: b([2.3, 1.1, 0.9]), f: 36 })], [1, F('gdv', { from: b([-0.2, 1.5, 3.6]), at: b([2.3, 1.1, 0.9]), f: 37 })], [1, F('gdv', { from: b([0.6, 1.4, 2.4]), at: b([3.0, 1.0, 0.9]), f: 50 })], [1, F('gdv', { from: b([0.6, 1.4, 2.4]), at: b([3.0, 1.0, 0.9]), f: 51 })]]),
  lines: [], acts: [{ t: -1, who: 'teo', pose: 'table' }, { t: -1, who: 'gdv', pose: 'push', emo: 'happy' }, { t: 2, who: 'gdv', pose: 'press' }, fx(-1, { form: 1 }, 0.01)],
};
