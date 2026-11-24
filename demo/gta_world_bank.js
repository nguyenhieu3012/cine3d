// look test: the bank interior (flat bright office light) with real Tèo, Bíp and the bank people on their marks
import { P, shotsFrom, F, at, fx } from './gta_world_common.js';
const b = (v) => P('bank', v);
export default {
  id: 'gta_world_bank', pack: 'trada', set: 'gta', fps: 30, dur: 17.0, cast: ['teo', 'bip', 'baove', 'gdv', 'kh1', 'kh2', 'kh3', 'kh4'], partners: { teo: 'gdv', gdv: 'teo', baove: 'teo', bip: 'teo', kh1: 'teo', kh2: 'teo', kh3: 'teo', kh4: 'teo' },
  castOpts: { teo: { stand: 1 }, bip: { stand: 1 } },
  setOpts: { places: [{ t: 0, place: 'bank' }],
    stands: [{ t: 0, who: 'teo', mark: 'bank.door_in', walk: [{ t: 4, mark: 'bank.wait_3' }, { t: 7, mark: 'bank.counter' }] }, at(0, 'gdv', 'bank.teller'), at(0, 'baove', 'bank.guard'), { t: 0, who: 'bip', pos: b([-0.5, -100, 0]) }],
    seatPlan: { wait_2: [{ t: 0, who: 'kh1' }, { t: 9, who: 'kh3' }], wait_4: [{ t: 0, who: 'kh2' }, { t: 9, who: 'kh4' }] } },
  shots: shotsFrom([
    [1, F('teo', { from: b([-3.3, 1.6, -5.9]), at: b([0.8, 1.1, 1.5]), f: 24 })],              // from the door down the hall
    [1, F('teo', { from: b([-2.0, 1.25, 1.6]), at: b([-2.0, 0.95, -2.3]), f: 40 })],         // chairs front
    [1, F('teo', { from: b([-1.0, 1.7, 2.6]), at: b([-2.2, 1.1, -2.6]), f: 24 })],           // chairs wide
    [1, F('teo', { from: b([-2.0, 1.5, -1.0]), at: b([-2.0, 2.4, 6.5]), f: 55 })],           // board
    [1, F('teo', { from: b([-2.0, 1.35, -3.0]), at: b([-2.0, 2.0, 6.5]), f: 36 })],           // board from the chairs
    [1, F('baove', { from: b([-1.3, 1.25, -1.9]), at: b([-1.25, 1.1, -5.6]), f: 46 })],       // machine + guard
    [1, F('teo', { from: b([2.3, 1.45, 5.3]), at: b([2.3, 1.15, 0.9]), f: 40 })],            // counter two
    [1, F('teo', { from: b([-0.2, 1.5, 3.6]), at: b([2.3, 1.1, 0.9]), f: 36 })],             // counter 3/4
    [1, F('teo', { from: b([1.1, 1.2, 1.9]), at: b([2.5, 0.98, 0.9]), f: 50 })],          // slot
    [1, F('teo', { from: b([2.0, 1.8, 4.2]), at: b([2.0, 2.7, 0.9]), f: 60 })],              // sign
    [1, F('teo', { from: b([-2.0, 1.7, 0.2]), at: b([-2.0, 2.75, -6.5]), f: 50 })],          // clock
    [1, F('teo', { from: b([-3.0, 1.3, -1.6]), at: b([-3.3, 1.1, -5.9]), f: 40 })],          // door
    [1, F('teo', { from: b([-0.2, 1.5, 3.6]), at: b([2.3, 1.1, 0.9]), f: 36 })],             // counter with props
    [1, F('teo', { from: b([-2.0, 1.25, 1.6]), at: b([-2.0, 0.95, -2.3]), f: 40 })],         // chairs, after the swap
    [1, F('teo', { from: b([1.8, 1.3, 2.4]), at: b([2.6, 1.0, 0.9]), f: 60 })],              // props close
    [1, F('teo', { from: b([-2.0, 1.5, -1.0]), at: b([-2.0, 2.4, 6.5]), f: 55 })],           // board 112
    [1, F('teo', { from: b([2.0, 2.0, 1.9]), at: b([2.4, 0.9, 0.9]), f: 45 })],               // props from above
  ]),
  lines: [], acts: [{ t: -1, who: 'gdv', pose: 'push' }, { t: -1, who: 'baove', pose: 'point' }, { t: -1, who: 'teo', pose: 'table' }, { t: -1, who: 'kh1', pose: 'phone' }, { t: -1, who: 'kh2', pose: 'rest' },
    { t: -1, who: 'teo', look: 'partner' },
    fx(-1, { num: 47, clock: 0, sun: 0 }, 0.01), { t: 0.0, who: 'teo', fx: { walk: 1 }, d: 0.3 }, { t: 3.9, who: 'teo', fx: { walk: 0 }, d: 0.3 }, { t: 4.1, who: 'teo', fx: { walk: 1 }, d: 0.3 }, { t: 6.9, who: 'teo', fx: { walk: 0 }, d: 0.3 }, fx(10.0, { num: 112 }, 0.01), fx(11.0, { ticket: 1, form: 1, stamp: 0.6, bag: 1, clock: 0.5, sun: 0.5, num: 112 }, 0.3)],
};
