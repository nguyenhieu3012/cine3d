// look test (13/11, thank-you special): the follower counter as a big close-up inset (core/overlay_zb.js `counter`): rolls, flash, +N tick, pull-to-refresh, list of names
export const KEYS = [[0, 1000], [2.0, 1137, 'pull'], [4.5, 1400, 'pull'], [7.0, 2000], [9.0, 2325]];
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 12, cast: ['teo', 'bip'],
  shots: [{ t0: 0, t1: 1, cam: 'two' }, { t0: 1, t1: 2, cam: 'ms_teo' }, { t0: 2, t1: 3, cam: 'cu_bip' }, { t0: 3, t1: 6, cam: 'ms_teo' }, { t0: 6, t1: 9, cam: 'two', v: 1 }, { t0: 9, t1: 12, cam: 'cu_teo' }],
  lines: [], acts: [],
  overlays: [{ kind: 'counter', t0: 0, t1: 12, keys: KEYS, names: [[5.2, 6.8]] }],
};
