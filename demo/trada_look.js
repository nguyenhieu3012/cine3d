// look test for the Trà đá pack: one framing of every kind, a few emotions and poses
const shots = [], add = (d, o) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1: t0 + d, ...o }); };
add(2, { cam: 'two' }); add(2, { cam: 'ms_teo' }); add(2, { cam: 'ms_bip' }); add(2, { cam: 'cu_teo' }); add(2, { cam: 'cu_bip' }); add(2, { cam: 'ecu_teo' });
add(2, { cam: 'ots_teo' }); add(2, { cam: 'ots_bip' }); add(2, { cam: 'wide' }); add(2, { cam: 'ms_teo_lo' }); add(2, { cam: 'cu_bip_hi' }); add(2, { cam: 'two_lo' });
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 24, cast: ['teo', 'bip'], shots,
  lines: [
    { who: 'teo', t0: 2.2, t1: 3.8, text: 'Nhịn hạt mười lăm ngày.', emo: 'smug', pose: 'raise' },
    { who: 'bip', t0: 4.2, t1: 5.8, text: 'Mắt đang mở.', emo: 'deadpan', pose: 'point' },
    { who: 'teo', t0: 6.2, t1: 7.8, text: 'Tao là thần rồi!', emo: 'happy', pose: 'cheer' },
    { who: 'bip', t0: 8.2, t1: 9.8, text: 'Chắc chưa?', emo: 'smug', pose: 'chin' },
    { who: 'teo', t0: 10.2, t1: 11.8, text: 'Không đọc!', emo: 'shock', pose: 'head' },
    { who: 'teo', t0: 12.2, t1: 13.8, text: 'Đọc là mất hết!', emo: 'worry', pose: 'beg' },
    { who: 'bip', t0: 14.2, t1: 15.8, text: 'Tin rác.', emo: 'happy', pose: 'shrug' },
    { who: 'teo', t0: 18.2, t1: 19.8, text: 'Xem… một giây thôi.', emo: 'think', pose: 'phone' },
    { who: 'bip', t0: 20.2, t1: 21.8, text: 'Ngủ ngon.', emo: 'sad', pose: 'rest' },
  ],
  overlays: [{ kind: 'hook', t0: 0, t1: 2, text: ['NHỊN 15 NGÀY:', 'ĐỌC HAY KHÔNG?'] }],
};
