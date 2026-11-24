// component test: the chat phone over the stall, a hit-stop, the end card
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 9, cast: ['teo', 'bip'],
  shots: [{ t0: 0, t1: 1.2, cam: 'cu_teo' }, { t0: 1.2, t1: 2.2, cam: 'two' }, { t0: 2.2, t1: 5.0, cam: 'ms_teo', hold: false }, { t0: 5.0, t1: 7.2, cam: 'cu_bip' }, { t0: 7.2, t1: 9, cam: 'wide' }],
  lines: [{ who: 'teo', t0: 0.2, t1: 1.6, text: 'Mẹ nhắn kìa.', emo: 'worry', pose: 'phone' }, { who: 'bip', t0: 5.2, t1: 6.6, text: 'Số lạ. Đừng bấm.', emo: 'angry', pose: 'point' }],
  hits: [{ t: 5.0, frames: 3 }],
  overlays: [
    { kind: 'phone', t0: 2.0, t1: 5.0, name: 'Mẹ', sub: 'Đang hoạt động', avatar: 'M', accent: '#ff7a59', msgs: [{ t: 2.3, from: 'them', text: 'Con ơi mẹ đổi số rồi nhé' }, { t: 3.1, from: 'them', text: 'Chuyển gấp cho mẹ 5 triệu' }, { t: 4.3, from: 'me', text: 'Mẹ gọi video đi ạ' }], typing: [{ t0: 3.5, t1: 4.3, from: 'me' }] },
    { kind: 'end', t0: 7.4, t1: 9, text: 'Mẹ thật hay giả?', sub: 'THEO DÕI · 0Đ' },
  ],
};
