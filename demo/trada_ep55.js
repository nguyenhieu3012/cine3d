// Side-by-side demo: the first 12.15 s of Tập 55 "Ngày 15: Đọc hay không?" re-staged in cine3d with the ORIGINAL sound.
// Line times come from the shipped subtitles (out/ep55/ep55.srt); mouths follow the real voice stems (demo/trada_ep55_lips.json).
const S = (t0, t1, o) => ({ t0, t1, ...o });
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 12.15, cast: ['teo', 'bip'], lipsFile: 'demo/trada_ep55_lips.json',
  shots: [
    S(0.0, 1.05, { cam: 'cu_teo', move: 'push', amt: 1.4, eyes: { teo: 'cam' } }),           // hook: eyes shut, proud
    S(1.05, 1.9, { cam: 'two', move: 'push', eyes: { teo: 'cam' } }),                           // reveal: Bíp is staring at him
    S(1.9, 3.15, { cam: 'cu_bip', move: 'drift', eyes: { bip: 'teo' } }),                       // "Mắt đang mở."
    S(3.15, 4.75, { cam: 'ms_teo_lo', move: 'push', punchAt: 4.35 }),                           // "Nhịn hạt mười lăm ngày."
    S(4.75, 6.15, { cam: 'two', move: 'push', amt: 1.2, punchAt: 5.55 }),                       // "Tao là thần rồi."
    S(6.15, 8.45, { cam: 'ots_teo', move: 'orbit', amt: 0.6 }),                                 // the stall lady, off screen
    S(8.45, 9.6, { cam: 'ms_bip', move: 'push', punchAt: 9.05 }),                               // "Ngủ chưa?"
    S(9.6, 10.75, { cam: 'cu_teo', move: 'none', punchAt: 9.97, eyes: { teo: 'cam' } }),        // "Không đọc!"
    S(10.75, 11.6, { cam: 'ecu_teo', move: 'push', eyes: { teo: 'cam' } }),                     // "Đọc là mất hết!"
    S(11.6, 12.15, { cam: 'cu_bip_hi', move: 'drift' }),
  ],
  lines: [
    { who: 'teo', t0: 0.10, t1: 1.79, text: 'Tin nào tao cũng không mở.', emo: 'sleepy', pose: 'cross' },
    { who: 'bip', t0: 2.00, t1: 2.98, text: 'Mắt đang mở.', emo: 'judge', pose: 'point' },
    { who: 'teo', t0: 3.20, t1: 4.65, text: 'Nhịn hạt mười lăm ngày.', emo: 'smug', pose: 'raise' },
    { who: 'teo', t0: 4.70, t1: 6.03, text: 'Tao là THẦN rồi.', emo: 'happy', pose: 'cheer' },
    { who: 'ba', t0: 6.45, t1: 8.24, text: 'Thằng này dạo này ngoan.' },
    { who: 'bip', t0: 8.90, t1: 9.51, text: 'Ngủ chưa?', emo: 'smug', pose: 'phone' },
    { who: 'teo', t0: 9.97, t1: 10.7, text: 'KHÔNG đọc!', emo: 'shock', pose: 'head' },
    { who: 'teo', t0: 10.75, t1: 11.7, text: 'Đọc là mất hết!', emo: 'worry', pose: 'beg' },
  ],
  acts: [
    { t: 0.0, who: 'bip', emo: 'neutral' }, { t: 1.75, who: 'teo', emo: 'neutral' }, { t: 1.95, who: 'teo', look: 'bip', d: 1.2 },
    { t: 6.2, who: 'teo', emo: 'smug', pose: 'chin' }, { t: 6.3, who: 'teo', look: 'cam', d: 2.1 }, { t: 7.0, who: 'teo', nod: 'yes' },
    { t: 6.2, who: 'bip', emo: 'think', pose: 'rest' }, { t: 8.5, who: 'bip', look: 'down', d: 0.45 }, { t: 9.55, who: 'teo', nod: 'jolt' },
    { t: 11.6, who: 'bip', emo: 'smug' },
  ],
  overlays: [
    { kind: 'hook', t0: 0, t1: 2.9, text: ['NHỊN 15 NGÀY:', 'ĐỌC HAY KHÔNG?'], y: 262 },
    { kind: 'bubble', t0: 9.0, t1: 11.5, from: 'Crush', text: 'Ngủ chưa?', x: 96, y: 300, color: '#ff6f9a' },
  ],
};
