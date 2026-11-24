// look test (20/11) for the gta6p2 pieces: the 24 h grocery (set gta, place `shop`), Chị Lan, Tèo's hood, the safe keypad, the cracking door, the LIVESTREAM layer (live_overlay.js), the MẸ GỌI flash on the exit button,
// the loading star with a label, the name tag. Every piece in the framings the episode will use. Times (s):
//  0-2.2 street: Bíp on the stool, Tèo (hood up, fists on hips) | 2.2-3.4 through the glass: Lan yawns, scrolls, her NAME TAG | 3.4-6.2 Tèo's feet wide (chữ bát), the door cracks, the bell | 6.2-7.6 Lan goes LIVE (ring light)
//  7.6-9.0 cu Tèo hooded | 9.0-10.8 the safe: keypad 1-2-3-4-5, door opens, the cookie tin of thread | 10.8-12.2 her phone | 12.2-13.8 cash roll pushed | 13.9-19.1 MỘT bình luận của Mẹ Tèo, alone
//  16.0-25.5 exit button, flash MẸ GỌI: ƯU TIÊN (19.2-21.2) | 20.0-21.8 the star loads, label MẸ ĐÃ XEM | 19.2-25.5 chip | 23.4-25.4 THEO DÕI | hood droops 22.2
import { hud, exitButton, nameTag, stampCard } from '../packs/trada/gta_hud.js';
import { liveFrame, liveComment, liveChip, liveFollow } from '../packs/trada/live_overlay.js';
const O = 1600, P = ([x, y, z]) => [x + O, y, z];
const DUR = 32.6, FPS = 60;
const shots = [];
const sh = (t1, who, from, at, f, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam: 'free' + shots.length, free: { from: P(from), at: P(at), f, dof: 0.2, who }, hold: true, move: 'none', ...o }); };
sh(1.1, 'teo', [0.9, 1.15, 6.8], [-0.4, 2.3, 0], 22);                 // ext_wide
sh(2.0, 'bip', [-0.4, 1.3, 5.4], [-1.5, 1.15, 1.8], 40);              // ext_two
sh(3.8, 'lan', [1.7, 1.35, 1.4], [1.6, 1.3, -4.0], 75);              // through_glass
sh(5.0, 'teo', [-0.5, 0.22, 3.4], [-0.5, 0.25, 1.0], 36, { insert: true, action: true });            // feet_low (the kick)
sh(6.2, 'teo', [1.5, 1.2, 2.7], [-0.5, 1.0, 0.4], 40);               // door_kick (the cracked door from the street)
sh(7.6, 'lan', [0.6, 1.4, -1.7], [1.75, 1.2, -4.0], 70);            // lan_cu
sh(9.0, 'teo', [0.6, 1.45, -4.9], [1.6, 1.12, -2.65], 80);            // counter_cu
sh(11.3, 'teo', [2.3, 1.4, -1.6], [3.5, 1.15, -3.15], 55, { insert: true, action: true });           // safe_close (the keypad, the door)
sh(12.5, 'lan', [2.3, 1.85, -4.9], [1.85, 1.34, -3.65], 70, { insert: true });        // phone_close
sh(13.8, 'teo', [-0.2, 1.4, -1.0], [1.6, 1.1, -3.4], 36);            // counter_two
sh(15.1, 'teo', [-0.45, 0.2, -1.7], [-0.45, 0.42, 1.0], 50, { insert: true, action: true });   // feet_inside (chữ bát, from inside through the glass door)
sh(19.1, 'teo', [0.2, 1.5, -0.8], [2.0, 1.2, -3.5], 28);             // interior_wide (the comment card sits over it)
sh(22.0, 'teo', [0.6, 1.45, -4.9], [1.6, 1.12, -2.65], 80, { dutch: 1.5 });   // counter_cu again, later (exit flash + star)
sh(25.0, 'teo', [0.9, 1.15, 6.8], [-0.4, 2.3, 0], 23, { dutch: 0 });  // ext_wide, the end card (THEO DÕI)
sh(27.0, 'lan', [1.7, 1.35, 1.4], [1.6, 1.3, -4.0], 75, { move: 'none' });   // through_glass: the red / blue police light sweeps over Lan, the chat floods
sh(28.6, 'teo', [0.6, 1.3, -2.2], [-0.5, 1.2, 0.0], 36, { insert: true, action: true });   // door_inside: the glass bursts
sh(DUR, 'teo', [-1.6, 1.2, 6.4], [-0.4, 0.7, 0], 24, { dutch: 0 });  // ext_wide from the other side: the freeze + the CÒN TIẾP stamp
const A = [];
const a = (t, who, o, d) => A.push({ t, who, ...o, ...(d != null ? { d } : {}) });
// light rig: outside until 3.4, then at the counter
const focus = [{ t: 0, at: P([-0.5, 1.1, 2.2]) }, { t: 2.0, at: P([-0.5, 1.1, 2.2]) }, { t: 2.02, at: P([1.6, 1.2, -3.0]) }, { t: 3.78, at: P([1.6, 1.2, -3.0]) }, { t: 3.8, at: P([-0.5, 1.1, 1.6]) }, { t: 6.18, at: P([-0.5, 1.1, 1.6]) }, { t: 6.2, at: P([1.9, 1.2, -3.0]) }, { t: 25.0, at: P([-0.5, 1.1, 2.2]) }, { t: 25.01, at: P([1.9, 1.2, -3.0]) }, { t: 27.0, at: P([1.9, 1.2, -3.0]) }, { t: 27.01, at: P([-0.5, 1.1, 1.6]) }, { t: 28.59, at: P([-0.5, 1.1, 1.6]) }, { t: 28.6, at: P([-0.5, 1.1, 2.2]) }];
a(-1, 'teo', { pose: 'hips', emo: 'smug' }, 0.01); a(-1, 'bip', { pose: 'rigid', emo: 'neutral' }, 0.01); a(-1, 'lan', { pose: 'idle', emo: 'sleepy' }, 0.01);
a(2.0, 'lan', { pose: 'yawn', emo: 'sleepy' }); a(2.9, 'lan', { pose: 'scroll', emo: 'neutral' }); a(2.9, 'lan', { look: 'down', d: 1.0 });
a(3.8, 'teo', { pose: 'side', emo: 'angry' }); a(3.79, 'teo', { fx: { splay: 1 }, d: 0.01 });
a(6.2, 'lan', { pose: 'live', emo: 'love' }); a(7.0, 'lan', { pose: 'liveWave', emo: 'happy' });
a(6.2, 'teo', { pose: 'hips', emo: 'worry' }); a(6.2, 'teo', { fx: { splay: 0 }, d: 0.2 }); a(7.6, 'teo', { emo: 'shock' });
a(9.0, 'teo', { pose: 'keypad', emo: 'think' }); a(11.3, 'teo', { pose: 'side', emo: 'sad' });
a(12.5, 'lan', { pose: 'push', emo: 'love' }); a(14.0, 'lan', { pose: 'live', emo: 'happy' }); a(14.0, 'teo', { emo: 'worry' }); a(15.0, 'teo', { emo: 'shock' });
a(13.79, 'teo', { fx: { splay: 1 }, d: 0.01 }); a(15.09, 'teo', { fx: { splay: 0 }, d: 0.01 }); a(22.2, 'teo', { fx: { hoodDrop: 1 }, d: 0.9 }); a(22.2, 'teo', { emo: 'sad' });
const S = (t, f, d = 0.1) => ({ t, who: 'set', fx: f, d });
A.push(S(-1, { crack: 0, door: 0 }, 0.01), S(3.95, { door: 0.55 }, 0.12), S(4.07, { door: 0.1 }, 0.5), S(3.95, { crack: 1, bell: 1 }, 0.12), S(4.7, { bell: 0 }, 0.9), S(6.3, { ring: 1 }, 0.4), S(6.0, { drawer: 0 }, 0.1), S(12.6, { cash: 1 }, 0.7), S(12.7, { drawer: 1 }, 0.3),
  S(9.3, { keys: 5 }, 0.8), S(10.0, { safe: 1 }, 0.5), S(10.6, { tinLid: 1 }, 0.5), S(13.2, { cash: 0 }, 0.5), S(24.9, { police: 1 }, 0.4), S(27.2, { shatter: 1 }, 0.9));
export default {
  id: 'gta_shop_look', pack: 'trada', set: 'gta', fps: FPS, dur: DUR, cast: ['teo', 'bip', 'lan'], partners: { teo: 'lan', lan: 'teo', bip: 'teo' },
  castOpts: { teo: { gta: true, stand: 1, hood: true }, bip: { glass: true } },
  setOpts: { shop: {}, places: [{ t: 0, place: 'shop' }], focus,
    stands: [{ t: 0, who: 'teo', mark: 'shop.front_teo' }, { t: 0, who: 'bip', mark: 'shop.stool_bip' }, { t: 0, who: 'lan', mark: 'shop.behind_counter' }, { t: 3.8, who: 'teo', mark: 'shop.door_kick' }, { t: 6.2, who: 'teo', mark: 'shop.counter' }, { t: 9.0, who: 'teo', mark: 'shop.safe_teo' }, { t: 11.3, who: 'teo', mark: 'shop.counter' }, { t: 13.8, who: 'teo', mark: 'shop.door_kick' }, { t: 15.1, who: 'teo', mark: 'shop.counter' }, { t: 25.0, who: 'teo', mark: 'shop.safe_teo' }, { t: 27.0, who: 'teo', mark: 'shop.door_kick' }, { t: 28.6, who: 'teo', mark: 'shop.front_teo' }] },
  waive: [{ check: 'clip.frozen', t0: 29.12, t1: DUR, reason: 'the cliffhanger is a deliberate freeze-frame (engine hits: picture and overlays stop at 29.12 with the stamp on it, to the end of the film)' }],
  shots, lines: [], acts: A, hits: [{ t: 29.12, frames: Math.ceil((DUR - 29.12) * FPS) }],   // the freeze of the cliffhanger: picture AND overlays stop at 29.0 (the stamp has just landed) and stay to the end
  overlays: [
    hud({ t0: 0.4, t1: DUR - 0.02, money: [[0, -10e6]], stars: [[0, 0]], loadStar: { t0: 20.0, t1: 21.8, label: 'MẸ ĐÃ XEM', idx: 0, then: 2 } }),
    nameTag({ t0: 2.1, t1: 3.75, who: 'lan', text: 'CHỊ LAN' }),
    liveFrame({ t0: 6.2, t1: DUR - 0.2, viewers: [[0, 3], [7.2, 1200, { roll: 0.8 }], [22.4, 2400, { roll: 0.8 }], [24.0, 10000, { roll: 1.4 }]], flood: [{ t0: 25.0, t1: 27.0, text: 'BÁO CÔNG AN RỒI', perSec: 6 }], freeze: [{ at: 27.0, until: 28.4 }],
      chat: [{ t: 7.0, text: null }, { t: 7.5, text: '+1', name: 'minh_anh' }, { t: 8.1, text: 'chốt', name: 'bao.tran' }, { t: 8.7, text: null }, { t: 9.3, text: '+1', name: 'ngoc94' }, { t: 10.2, text: 'chốt', name: 'tuan_hn' }, { t: 12.0, text: null }, { t: 11.9, text: '+1', name: 'linh.le' }, { t: 19.6, text: '+1', name: 'minh_anh' }, { t: 20.2, text: null }, { t: 20.8, text: 'chốt', name: 'bao.tran' }],
      hearts: [[7.2, 12.5, 3.2], [19.4, 24.8, 2.4]], quiet: [[13.6, 19.2]] }),
    liveComment({ t0: 13.9, t1: 19.1, name: 'Mẹ Tèo', text: 'Đi chân chữ bát thế kia… chỉ có con tao.' }),
    liveChip({ t0: 19.2, t1: 28.5, name: 'Mẹ Tèo', text: 'đang xem' }),
    exitButton({ t0: 16.0, slamAt: 16.4, t1: DUR - 0.2, flash: [{ t0: 19.2, t1: 21.7, text: 'MẸ GỌI: ƯU TIÊN' }] }),
    liveFollow({ t0: 23.2, t1: 25.0, text: 'THEO DÕI' }),
    stampCard({ t0: 28.8, t1: DUR - 0.1, y: 1130 }),
  ],
};
