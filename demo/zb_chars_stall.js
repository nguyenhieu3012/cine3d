// look test (Zombie special, 13/11): the seated moments at the stall. Bíp's battery bar red and blinking under the spark; Tèo slumps asleep on the table,
// jerks awake with the table edge printed on his cheek, pinches his cheek ("Mơ à?… Á!"); Bíp sputters and powers off; Bà stands by.
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(1.0, 'two'); add(2.0, 'cu_bip'); add(2.9, 'free', { free: { from: [0.38, 0.86, 0.95], at: [0.4, 0.66, 0.17], f: 58, dof: 0.3 } });
add(5.4, 'ms_teo_hi', { hold: true }); add(6.6, 'cu_teo'); add(8.0, 'ecu_teo'); add(9.6, 'ms_bip'); add(12, 'all', { frame: ['teo', 'bip', 'ba'], hold: true });
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 12, cast: ['teo', 'bip', 'ba'], setOpts: { day: 'NGÀY 1', phone: true },
  castOpts: { bip: { batt: 0.12 } },
  shots,
  lines: [{ who: 'teo', t0: 6.7, t1: 7.9, text: 'Mơ à?… Á!', emo: 'squeeze', pose: 'pinch' }, { who: 'ba', t0: 10.0, t1: 11.2, text: 'Ba cốc rồi đấy nhá.', pose: 'hips' }],
  acts: [
    { t: 0, who: 'bip', emo: 'neutral' }, { t: 2.9, who: 'teo', emo: 'sleepy', pose: 'sleep' }, { t: 3.0, who: 'teo', fx: { slump: 1 }, d: 0.9 }, { t: 3.4, who: 'teo', emo: 'zen' },
    { t: 5.4, who: 'teo', fx: { slump: 0, print: 1 }, d: 0.14 }, { t: 5.4, who: 'teo', nod: 'jolt' }, { t: 5.4, who: 'teo', emo: 'shock', pose: 'rest' }, { t: 5.5, who: 'teo', look: 'cam', d: 1 },
    { t: 8.2, who: 'bip', fx: { sputter: 1 }, d: 0.3 }, { t: 9.0, who: 'bip', fx: { sputter: 0, off: 1 }, d: 0.4 }, { t: 9.0, who: 'bip', fx: { droop: 1 }, d: 0.4 },
    { t: 8.0, who: 'teo', emo: 'worry', pose: 'rest' },
  ],
  overlays: [],
};
