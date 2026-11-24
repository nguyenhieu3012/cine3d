// look test for the supporting people: Bà chủ quán next to Tèo and Bíp. 16 s: wide / two / ms / cu, happy worry angry shock sad, waving hips scolding giving.
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(1, 'wide'); add(2, 'two_ba'); add(3.6, 'ms_ba'); add(5.8, 'cu_ba'); add(7.2, 'ms_teo'); add(9, 'ms_ba_lo'); add(10.8, 'cu_ba_hi'); add(12.4, 'ms_bip'); add(14.4, 'two_ba', { move: 'drift' }); add(16, 'wide', { v: 1 });
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 16, cast: ['teo', 'bip', 'ba'],
  seats: { teo: { pos: [-0.42, 0, 0], yaw: 0.3 }, bip: { pos: [0.42, 0, 0], yaw: -0.3 }, ba: { pos: [1.15, 0, -0.55], yaw: -0.5 } },
  shots,
  lines: [
    { who: 'ba', t0: 0.2, t1: 1.8, text: 'Hai đứa ra chơi hả?', emo: 'happy', pose: 'wave' },
    { who: 'ba', t0: 2.2, t1: 3.6, text: 'Trà đá đây con.', emo: 'happy', pose: 'give' },
    { who: 'ba', t0: 4.2, t1: 5.6, text: 'Ơ, nhịn hạt hả?', emo: 'shock', pose: 'hips' },
    { who: 'teo', t0: 6.0, t1: 7.0, text: 'Dạ… mười lăm ngày.', emo: 'worry', pose: 'beg' },
    { who: 'ba', t0: 7.3, t1: 8.8, text: 'Lại ăn nhầm là chết!', emo: 'angry', pose: 'scold' },
    { who: 'ba', t0: 9.2, t1: 10.6, text: 'Thương cháu quá…', emo: 'sad', pose: 'me' },
    { who: 'bip', t0: 11.0, t1: 12.2, text: 'Bà ơi, cười đi.', emo: 'happy', pose: 'shrug' },
    { who: 'ba', t0: 12.6, t1: 14.2, text: 'Ừ, cười thì cười!', emo: 'happy', pose: 'cheer' },
  ],
  acts: [{ t: 3.7, who: 'teo', emo: 'smug' }, { t: 5.7, who: 'teo', emo: 'shock', pose: 'head' }, { t: 14.4, who: 'ba', pose: 'rest' }],
};
