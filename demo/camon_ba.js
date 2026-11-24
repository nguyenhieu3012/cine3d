// look test (13/11, thank-you special): Bà walks in with a wobbling stack of plastic stools above her head; the row of stools with lit glasses of tea down the pavement, slow pull-back
import { path } from '../core/player.js';
const shots = [
  { t0: 0, t1: 1.0, cam: 'all', frame: ['teo', 'bip', 'ba'] }, { t0: 1.0, t1: 2.0, cam: 'ms_ba' }, { t0: 2.0, t1: 3.0, cam: 'cu_ba' }, { t0: 3.0, t1: 3.6, cam: 'ms_ba' }, { t0: 3.6, t1: 5.2, cam: 'all', frame: ['teo', 'bip', 'ba'], hold: true },
  { t0: 5.2, t1: 12, cam: 'free', free: { from: [0.7, 1.15, 2.3], to: [7.5, 2.1, 6.0], at: [-0.1, 0.9, 0.2], atTo: [-7.5, 0.45, 0.8], f: 30, fTo: 24, dof: 0.2 }, hold: true },
];
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 12, cast: ['teo', 'bip', 'ba'], castOpts: { ba: { stack: 7 } }, setOpts: { row: { twice: true } },
  shots, lines: [],
  acts: [
    { t: 0, who: 'ba', pose: 'stack', emo: 'worry' }, { t: 0, who: 'ba', fx: { walk: 1 }, d: 0.3 }, ...path('ba', [[0, 2.2, 0.9], [3.2, 1.4, -0.3]], { seat: [1.15, -0.55], yaw0: -0.5 }),
    { t: 3.3, who: 'ba', fx: { walk: 0 }, d: 0.5 }, { t: 3.4, who: 'ba', fx: { dir: 0.4 }, d: 0.5 }, { t: 3.6, who: 'ba', emo: 'happy' },
    { t: 5.0, who: 'set', fx: { row: 1 }, d: 4.5, ease: 'lin' },
  ],
  overlays: [],
};
