// look test (13/11, thank-you special): Bíp's chest printer (one slip, torn off and laid on the table; then the flood of paper that piles on the table and on Tèo), his tear and the wipe;
// Tèo's paper (on head / shoulders / over the face, brushed off) and Tèo reading the slip
const SLIP = ['34.700', 'LƯỢT XEM', '2 NGÀY'];
const shots = [
  { t0: 0, t1: 1.0, cam: 'ms_bip' }, { t0: 1.0, t1: 2.0, cam: 'cu_bip' }, { t0: 2.0, t1: 3.0, cam: 'ms_bip_hi' }, { t0: 3.0, t1: 4.2, cam: 'ms_bip' },
  { t0: 4.2, t1: 6.6, cam: 'free', free: { from: [0.16, 0.78, 0.78], at: [0.155, 0.48, 0.4], f: 50, dof: 0.3 }, hold: true },
  { t0: 6.6, t1: 8.0, cam: 'ms_teo' }, { t0: 8.0, t1: 11.0, cam: 'cu_bip', hold: true }, { t0: 11.0, t1: 14.6, cam: 'two', hold: true }, { t0: 14.6, t1: 16.4, cam: 'all', frame: ['teo', 'bip'], hold: true },
  { t0: 16.4, t1: 18.2, cam: 'cu_teo' }, { t0: 18.2, t1: 20, cam: 'ms_teo' },
];
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 20, cast: ['teo', 'bip'], castOpts: { bip: { slip: SLIP, flood: true }, teo: { slip: SLIP, paper: true } },
  shots, lines: [],
  acts: [
    { t: 0, who: 'bip', pose: 'printing', emo: 'neutral' }, { t: 0.2, who: 'bip', fx: { slip: 1 }, d: 5, ease: 'lin' }, { t: 4.8, who: 'bip', pose: 'rest' },
    { t: 6.6, who: 'teo', pose: 'slipHold', emo: 'happy' }, { t: 6.6, who: 'bip', fx: { slipGone: 1 }, d: 0.01 }, { t: 8.0, who: 'teo', pose: 'rest', emo: 'neutral' },
    { t: 8.0, who: 'bip', fx: { tear: 1 }, d: 2.4, ease: 'lin' }, { t: 8.0, who: 'bip', emo: 'sad' }, { t: 10.4, who: 'bip', pose: 'wipe', emo: 'neutral' }, { t: 10.8, who: 'bip', fx: { tear: 0 }, d: 0.5 }, { t: 11.0, who: 'bip', pose: 'rest', fx: { slipGone: 0 }, d: 0.01 },
    { t: 11.0, who: 'bip', fx: { flood: 1 }, d: 4, ease: 'lin' }, { t: 11.5, who: 'teo', fx: { paper: 1 }, d: 3.5, ease: 'lin' }, { t: 14.6, who: 'teo', fx: { paperFace: 1 }, d: 0.7 },
    { t: 16.4, who: 'teo', pose: 'brush', fx: { paperBrush: 1 }, d: 1.0 }, { t: 18.2, who: 'teo', pose: 'rest', emo: 'moved' }, { t: 17.5, who: 'bip', fx: { floodStop: 1 }, d: 0.5 },
  ],
  overlays: [],
};
