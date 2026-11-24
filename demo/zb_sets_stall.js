// look test: the stall additions of the Zombie special: post (QR + charger cable), speaker, spill, abandoned, cold
import { shotsFrom } from './zb_sets_common.js';
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 15, cast: ['teo', 'bip', 'ba'], setOpts: { post: true, speaker: true, spill: true }, partners: { teo: 'bip', bip: 'teo', ba: 'teo' },
  shots: [
    { t0: 0, t1: 0.9, cam: 'two' }, { t0: 0.9, t1: 1.8, cam: 'ms_teo' }, { t0: 1.8, t1: 2.7, cam: 'cu_bip' },
    ...shotsFrom([
      [1.3, { from: [-0.62, 1.22, 0.72], at: [-1.0, 1.12, -0.4], f: 48, dof: 0.35, who: 'ba' }],                  // post: QR sheet + charger cable
      [1.4, { from: [-1.5, 1.4, 0.15], at: [-1.7, 1.2, -0.94], f: 60, dof: 0.35, who: 'ba' }],                  // Bà's QR speaker
      [3.0, { from: [-0.05, 0.92, 1.0], at: [-0.05, 0.5, 0.5], f: 45, dof: 0.5, who: 'ba' }],                   // the glass tips and rolls
      [1.5, { from: [0.2, 0.7, 1.3], at: [0.0, 0.45, 0.66], to: [0.1, 0.4, 1.0], f: 50, dof: 0.5, who: 'ba' }],  // tea drips off the edge
    ]).map((s, i) => ({ ...s, t0: s.t0 + 2.7, t1: s.t1 + 2.7 })),
    { t0: 11.6, t1: 13.6, cam: 'wide' }, { t0: 13.6, t1: 15, cam: 'two', v: 1 },
  ],
  lines: [],
  acts: [
    { t: 0, who: 'ba', emo: 'happy', pose: 'hips' }, { t: 4.2, who: 'set', fx: { ting: 1 }, d: 0.1 }, { t: 5.0, who: 'set', fx: { ting: 0 }, d: 0.1 },
    { t: 6.4, who: 'set', fx: { spill: 1 }, d: 1.8 }, { t: 10.2, who: 'set', fx: { cold: 1 }, d: 1.4 }, { t: 11.0, who: 'set', fx: { abandon: 1 }, d: 0.1 },
  ],
};
