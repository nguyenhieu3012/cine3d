// look test (13/11, thank-you special): Tèo's counter phone in 3-D (poses phoneNear / phoneHold / phoneSlap / swipeIdle + fx swipe / scroll, fx names), the moved face, the ear call
import { KEYS } from './camon_counter.js';
const shots = [
  { t0: 0, t1: 1.0, cam: 'cu_teo' }, { t0: 1.0, t1: 2.0, cam: 'two' }, { t0: 2.0, t1: 3.2, cam: 'ms_teo' }, { t0: 3.2, t1: 4.8, cam: 'cu_bip' }, { t0: 4.8, t1: 6.4, cam: 'ms_teo_lo' },
  { t0: 6.4, t1: 8, cam: 'free', free: { from: [-0.22, 1.12, 1.15], at: [-0.17, 0.92, 0.35], f: 50, dof: 0.3 } }, { t0: 8, t1: 9.6, cam: 'cu_teo' }, { t0: 9.6, t1: 11.2, cam: 'ms_teo' }, { t0: 11.2, t1: 12.8, cam: 'cu_teo' },
];
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 12.8, cast: ['teo', 'bip'], castOpts: { teo: { counter: { keys: KEYS } } },
  shots, lines: [],
  acts: [
    { t: 0, who: 'teo', pose: 'phoneNear', emo: 'shock' }, { t: 1.6, who: 'teo', pose: 'phoneHold' }, { t: 3.2, who: 'teo', pose: 'phoneSlap', emo: 'angry' },
    { t: 4.8, who: 'teo', pose: 'swipeIdle', emo: 'think' }, { t: 5.0, who: 'teo', fx: { swipe: 1 }, d: 0.6, ease: 'lin' },
    { t: 6.4, who: 'teo', pose: 'phoneHold', emo: 'shock' }, { t: 7.0, who: 'teo', pose: 'scroll', fx: { names: 1 }, d: 0.3 }, { t: 7.9, who: 'teo', fx: { names: 0 }, d: 0.3 },
    { t: 8.0, who: 'teo', pose: 'rest', emo: 'moved' }, { t: 9.6, who: 'teo', pose: 'phoneEar', emo: 'worry' }, { t: 11.2, who: 'teo', pose: 'rest', emo: 'moved' },
  ],
  overlays: [],
};
