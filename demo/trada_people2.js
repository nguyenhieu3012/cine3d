// look test for Mẹ and anh khách next to Tèo. 16 s: Mẹ standing at screen-right, the customer seated at the second stool on the left.
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(1, 'wide_khach'); add(2, 'two_khach', { v: 1 }); add(3.1, 'ms_teo'); add(5, 'cu_me'); add(7, 'ms_me'); add(8.8, 'ms_khach'); add(10.8, 'cu_khach'); add(12.2, 'ms_khach', { move: 'drift' }); add(13.8, 'ms_me_lo'); add(15.4, 'cu_khach_hi'); add(16, 'two_khach', { move: 'pull', v: 1 });
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 16, cast: ['me', 'teo', 'khach'],
  seats: { teo: { pos: [-0.42, 0, 0], yaw: 0.3 }, me: { pos: [0.62, 0, -0.1], yaw: -0.45 }, khach: { pos: [-1.5, 0, 0.6], yaw: 1.0 } },
  shots,
  lines: [
    { who: 'me', t0: 0.2, t1: 1.6, text: 'Teo ơi, con ăn cơm chưa?', emo: 'happy', pose: 'wave' },
    { who: 'teo', t0: 2.0, t1: 2.9, text: 'Mẹ?! Sao mẹ ở đây?', emo: 'shock', pose: 'head' },
    { who: 'me', t0: 3.2, t1: 4.8, text: 'Mẹ lên thăm con.', emo: 'sad', pose: 'me' },
    { who: 'me', t0: 5.2, t1: 6.8, text: 'Gầy thế này à con!', emo: 'worry', pose: 'hips' },
    { who: 'khach', t0: 7.2, t1: 8.5, text: 'Cho anh ly trà đá.', emo: 'happy', pose: 'raise' },
    { who: 'khach', t0: 9.0, t1: 10.5, text: 'Sao tính tiền nhầm?!', emo: 'angry', pose: 'point' },
    { who: 'khach', t0: 11.0, t1: 12.0, text: 'Hả?! Hết rồi?', emo: 'shock', pose: 'phone' },
    { who: 'me', t0: 12.4, t1: 13.6, text: 'Con hư quá đi!', emo: 'angry', pose: 'scold' },
    { who: 'khach', t0: 14.0, t1: 15.4, text: 'Thôi… anh về.', emo: 'sad', pose: 'chin' },
  ],
  acts: [{ t: 4.9, who: 'teo', emo: 'sad' }, { t: 7.0, who: 'teo', emo: 'smug', pose: 'cup' }],
};
