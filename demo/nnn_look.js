// look test for the "Tèo nhịn hạt" pieces: table props, aura + gold eyes, thought clouds, call card, notification, unlock plate
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(1, 'cu_teo'); add(2, 'free', { free: { from: [-0.09, 0.82, 1.7], at: [-0.09, 0.545, 0.58], f: 45, dof: 0.4 } }); add(3, 'cu_bip'); add(5, 'cu_teo', { eyes: { teo: 'cam' } }); add(6, 'two');
add(8, 'ms_ba'); add(10, 'ms_khach'); add(12, 'ms_teo'); add(14, 'two'); add(16, 'ms_bip');
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 16, cast: ['teo', 'bip', 'ba', 'khach'], setOpts: { day: 'NGÀY 12', tissue: 'NIÊM PHONG 1/11', phone: true }, castOpts: { teo: { bags: 1 } },
  partners: { teo: 'bip', bip: 'teo', ba: 'teo', khach: 'teo' },
  shots,
  lines: [
    { who: 'ba', t0: 6.2, t1: 7.8, text: 'Đá hôm qua. Pha thêm nước.', think: true, noCap: true, emo: 'happy' },
    { who: 'khach', t0: 8.2, t1: 9.8, text: 'Mai tao đổi số.', think: true, noCap: true, emo: 'happy', pose: 'wave' },
    { who: 'me', t0: 10.5, t1: 11.9, text: 'Tèo ơi!' },
    { who: 'bip', t0: 14.2, t1: 15.8, text: 'Ngày mười ba. Nhìn thấu.', emo: 'judge', pose: 'cross' },
  ],
  acts: [
    { t: 0, who: 'teo', emo: 'zen', pose: 'zen' }, { t: 3.2, who: 'set', fx: { dim: 1 }, d: 0.5 }, { t: 3.9, who: 'teo', emo: 'power' }, { t: 3.9, who: 'teo', fx: { aura: 1.4 }, d: 0.25 }, { t: 3.9, who: 'set', fx: { dim: 0, flash: 0.35 }, d: 0.15 }, { t: 4.1, who: 'set', fx: { flash: 0 }, d: 0.5 },
    { t: 5.4, who: 'teo', fx: { aura: 0.5 }, d: 0.4 }, { t: 10, who: 'teo', pose: 'phone', emo: 'worry' }, { t: 10, who: 'set', fx: { phoneUp: 1 }, d: 0.05 }, { t: 12.2, who: 'teo', fx: { aura: 0.5, flick: 1, droop: 1 }, d: 0.4 }, { t: 12.2, who: 'teo', pose: 'facepalm', emo: 'squeeze' },
  ],
  overlays: [
    { kind: 'hook', t0: 0, t1: 2.9, text: ['NHỊN 12 NGÀY:', 'ĐƯỢC GÌ?'], y: 262 },
    { kind: 'thought', t0: 6.1, t1: 8.0, who: 'ba', text: 'Đá hôm qua. Pha thêm nước.', r1: 7.6 },
    { kind: 'thought', t0: 8.1, t1: 10.0, who: 'khach', text: 'Mai tao đổi số.', r1: 9.4 },
    { kind: 'call', t0: 10.0, t1: 12.0, name: 'Mẹ', who: 'me', answer: 10.4 },
    { kind: 'notify', t0: 12.1, t1: 13.9, app: 'NGÂN HÀNG', text: '+500.000đ' },
    { kind: 'unlock', t0: 14.0, t1: 16, a: 'ĐÃ MỞ: NGHE SUY NGHĨ', b: 'NGÀY 13: NHÌN THẤU ???', swapAt: 15, follow: 'THEO DÕI ĐỂ XEM NGÀY 13' },
  ],
};
