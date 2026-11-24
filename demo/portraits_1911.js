// portraits for the owner (19/11): Tèo panicked, Bíp sly. Stills only.
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 8, cast: ['teo', 'bip'],
  shots: [ { t0: 0, t1: 2, cam: 'cu_teo' }, { t0: 2, t1: 4, cam: 'ms_teo' }, { t0: 4, t1: 6, cam: 'cu_bip' }, { t0: 6, t1: 8, cam: 'ms_bip' } ],
  lines: [],
  acts: [
    { t: 0, who: 'teo', emo: 'terror', pose: 'head', fx: { shiver: 1 }, d: 0.01 }, { t: 0, who: 'teo', look: 'cam', d: 4 },
    { t: 2, who: 'teo', emo: 'terror', pose: 'guard', fx: { recoil: 1, glasses: 1 }, d: 0.12 },
    { t: 0, who: 'bip', emo: 'smug', pose: 'clasp' }, { t: 4, who: 'bip', look: 'cam', d: 4 },
    { t: 6, who: 'bip', emo: 'smug', pose: 'chin' },
  ],
  overlays: [],
};
