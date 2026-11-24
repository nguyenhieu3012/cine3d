// look test for the Zombie screen-layer pieces (core/overlay_zb.js): iris, freeze_rewind, title, phone insets, white_flash, cold. 22.6 s, 9:16, over the stall.
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(1.0, 'ecu_teo', { eyes: { teo: 'cam' } }); add(2.0, 'cu_teo', { eyes: { teo: 'cam' } }); add(3.6, 'ms_teo'); add(5.6, 'two'); add(7.4, 'ms_bip'); add(9.4, 'wide'); add(11.6, 'cu_teo'); add(13.4, 'two'); add(15.4, 'cu_bip'); add(17.4, 'wide'); add(19.4, 'ms_bip'); add(21.2, 'ms_teo'); add(22.6, 'two', { hold: true });
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 22.6, cast: ['teo', 'bip'], setOpts: { day: 'NGÀY 14', phone: true },
  partners: { teo: 'bip', bip: 'teo' }, shots, lines: [],
  acts: [{ t: 0, who: 'teo', emo: 'shock', pose: 'rest' }, { t: 0, who: 'bip', emo: 'neutral', pose: 'rest' }, { t: 5.6, who: 'teo', emo: 'sleepy' }],
  overlays: [
    // 0-2: iris opens from Tèo's eye, then breathes wider in steps
    { kind: 'iris', t0: 0, t1: 2.0, who: 'teo', side: -1, eyeUp: -0.05, r: [[0, 0], [0.4, 0], [0.8, 70], [1.1, 70], [1.5, 200], [1.8, 200], [2.0, 1500]], breathe: 6 },
    // 2.0-3.6 freeze + tape rewind + clock + card
    { kind: 'freeze_rewind', t0: 2.0, t1: 3.6, text: '24 GIỜ TRƯỚC' },
    // 3.6-5.2: closes on his face, black held
    { kind: 'iris', t0: 3.6, t1: 5.2, who: 'teo', dy: 10, r: [[3.6, 1500], [4.0, 260], [4.5, 60], [4.75, 0]] },
    // 5.2-6.6 title cards
    { kind: 'title', t0: 5.2, t1: 6.6, text: 'TO BE CONTINUED' },
    { kind: 'title', t0: 6.6, t1: 8.0, text: 'THEO DÕI TÈO & BÍP', style: 'end' },
    // 8.0-9.4 chat with the ChatGPT symbol beside "Chíp"
    { kind: 'phone', t0: 8.0, t1: 9.4, name: 'Chíp', sub: 'ChatGPT', logo: 'gpt', big: true, accent: '#10a37f', msgs: [{ t: 8.35, from: 'them', text: 'ANH SẠC CHƯA???' }] },
    { kind: 'calling', t0: 9.4, t1: 10.8, name: 'MẸ', sub: 'Đang gọi…' },
    { kind: 'notify', t0: 10.8, t1: 12.6, app: 'NGÂN HÀNG', text: '+2.000đ HOÀN TIỀN' },
    { kind: 'balance', t0: 12.6, t1: 14.0, amount: '2.000đ' },
    { kind: 'transfer', t0: 14.0, t1: 15.4, amount: '1.000.000đ' },
    { kind: 'transfer', t0: 15.4, t1: 16.8, amount: '1.000.000đ', fake: 1 },
    { kind: 'blank', t0: 16.8, t1: 18.0 },
    { kind: 'qr', t0: 18.0, t1: 19.2 },
    // 18.6-20.4 white flash, then the wake-up iris: white disc shrinks to a dot, opens on the picture
    { kind: 'white_flash', t0: 19.2, t1: 19.9, peak: 19.6 },
    { kind: 'iris', t0: 19.6, t1: 21.2, color: '#000', inner: '#fff', innerFade: [20.3, 20.9], at: [0.5, 0.42], r: [[19.60, 1500], [19.90, 1500], [20.15, 40], [20.40, 40], [21.00, 1500]] },
    // 20.4-22 cold mood ramp
    { kind: 'cold', t0: 21.2, t1: 22.6, in: 0.8, amount: 0.9 },
  ],
};
