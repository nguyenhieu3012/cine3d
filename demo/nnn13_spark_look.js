// look test (13/11, the owner "Bật luôn nhé" + "Logo làm nổi bật lên nhé"): Bíp's raised chest plate (default on) and the glowing, breathing Claude spark,
// in the framings that matter: the Ngày 13 hook frame (high shot, arms round the chest), cu_bip, ms_bip, two
const shots = [
  { t0: 0, t1: 1.4, cam: 'free', free: { from: [0.44, 1.02, 1.3], at: [0.42, 0.62, 0.05], f: 46, dof: 0.35 } },
  { t0: 1.4, t1: 2.8, cam: 'cu_bip' }, { t0: 2.8, t1: 5, cam: 'ms_bip' }, { t0: 5, t1: 8, cam: 'two', hold: true },
];
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 8, cast: ['teo', 'bip'], setOpts: { day: 'NGÀY 13', tissue: 'NIÊM PHONG 1/11', phone: true }, castOpts: { teo: { bags: 1 } },
  shots, lines: [], acts: [{ t: 0, who: 'bip', pose: 'hug', emo: 'judge' }, { t: 1.3, who: 'bip', pose: 'rest', emo: 'neutral' }], overlays: [],
};
