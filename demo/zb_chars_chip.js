// look test (Zombie special, 13/11): CHÍP (packs/trada/chip.js) with Bíp. Sweet face, heart eyes, hearts; kneels by Bíp lying down and plugs the cable chest to chest
// (spark flares, battery red -> green); kiss on the cheek, Bíp's wavy eye bars; raised finger (polite face); taps her chest (the ChatGPT mark close up); blocks the alley
// shoulder to shoulder with Bíp; holds up a phone screen; runs holding Bíp's hand.
import { PACKS } from '../packs/index.js';
import { ZOMBIE_CHARS } from '../packs/trada/zombie.js';
import { makeChip } from '../packs/trada/chip.js';
Object.assign(PACKS.trada.chars, ZOMBIE_CHARS, { chip: makeChip });
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(1.2, 'ms_chip_lo', { partner: 'bip' }); add(2.4, 'cu_chip', { partner: 'bip' }); add(4.0, 'two', { frame: ['chip', 'bip'] }); add(5.2, 'cu_bip', { partner: 'chip' });
add(6.6, 'two', { frame: ['chip', 'bip'], v: 1 }); add(7.8, 'ms_chip', { partner: 'bip' });
add(9.0, 'free', { free: { from: [-0.35, 0.82, 2.25], at: [-0.32, 0.72, 1.3], f: 62, dof: 0.3 } });
add(10.5, 'two_lo', { frame: ['chip', 'bip'] }); add(12.0, 'ms_chip', { partner: 'bip', move: 'drift' }); add(15, 'wide', { hold: true, move: 'pull' });
const bill = (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#18a058'; c.beginPath(); c.arc(w / 2, 130, 56, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(w / 2 - 26, 130); c.lineTo(w / 2 - 6, 152); c.lineTo(w / 2 + 28, 108); c.stroke();
  c.fillStyle = '#222'; c.font = '800 26px sans-serif'; c.textAlign = 'center'; c.fillText('ĐÃ CHUYỂN', w / 2, 250); c.font = '900 30px sans-serif'; c.fillText('1.000.000đ', w / 2, 296); };
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 15, cast: ['bip', 'chip'],
  castOpts: { bip: { stand: 1, batt: 0.1 }, chip: { stand: 1, screen: bill } }, setOpts: { day: 'NGÀY 1' },
  seats: { bip: { pos: [0.32, 0, 1.3], yaw: -0.25 }, chip: { pos: [-0.32, 0, 1.3], yaw: 0.25 } }, partners: { chip: 'bip', bip: 'chip' },
  shots,
  lines: [{ who: 'chip', t0: 0.3, t1: 1.6, text: 'Anh Bíp ơi! Em đến rồi đây!', emo: 'love', pose: 'clasp' }, { who: 'chip', t0: 6.8, t1: 7.7, text: 'Xin lỗi, em không thể…', emo: 'polite', pose: 'finger' }],
  acts: [
    { t: -1, who: 'bip', fx: { stand: 1, lie: 1, off: 1, batt: 0.1 }, d: 0.01 }, { t: -1, who: 'chip', fx: { stand: 1, hearts: 1 }, d: 0.01 }, { t: 0, who: 'bip', pose: 'side', emo: 'deadpan' },
    { t: 1.6, who: 'chip', emo: 'neutral' }, { t: 2.3, who: 'chip', fx: { hearts: 0, kneel: 1 }, d: 0.4 }, { t: 2.4, who: 'chip', pose: 'plug' }, { t: 2.6, who: 'chip', fx: { plug: 1 }, d: 0.6 },
    { t: 3.2, who: 'bip', fx: { off: 0, batt: 0.95 }, d: 0.8 }, { t: 3.5, who: 'bip', emo: 'neutral' },
    // 4.0 Bíp gets up; Chíp unplugs, stands, kisses him (turns to him, leans)
    { t: 3.9, who: 'chip', fx: { plug: 0, kneel: 0 }, d: 0.3 }, { t: 3.9, who: 'bip', fx: { lie: 0 }, d: 0.4 }, { t: 4.3, who: 'bip', look: 'cam', d: 0.8 },
    { t: 5.0, who: 'chip', fx: { x: 0.3, dir: 0.9 }, d: 0.3 }, { t: 5.1, who: 'chip', emo: 'kiss', pose: 'hugB' }, { t: 5.3, who: 'chip', fx: { lean: 0 }, d: 0.1 }, { t: 5.5, who: 'bip', emo: 'wavy' }, { t: 4.4, who: 'bip', emo: 'wavy' },
    { t: 6.4, who: 'chip', fx: { x: 0, dir: 0 }, d: 0.3 }, { t: 6.4, who: 'chip', pose: 'rest', emo: 'happy' },
    { t: 7.8, who: 'chip', pose: 'tap', emo: 'happy' },
    { t: 9.0, who: 'chip', pose: 'block', emo: 'neutral' }, { t: 9.0, who: 'bip', pose: 'cross', emo: 'judge' }, { t: 9.0, who: 'chip', fx: { x: 0.12 }, d: 0.3 }, { t: 9.0, who: 'bip', fx: { x: -0.06 }, d: 0.3 },
    { t: 10.5, who: 'chip', pose: 'phoneUp', emo: 'happy' },
    { t: 12.0, who: 'chip', pose: 'hand', emo: 'love' }, { t: 12.0, who: 'bip', pose: 'handL', emo: 'neutral' }, { t: 12.0, who: 'chip', fx: { x: 0.08, run: 1, hearts: 1 }, d: 0.3 }, { t: 12.0, who: 'bip', fx: { x: -0.04, run: 1 }, d: 0.3 },
    { t: 12.0, who: 'chip', fx: { z: 1.0 }, d: 3, ease: 'lin' }, { t: 12.0, who: 'bip', fx: { z: 1.0 }, d: 3, ease: 'lin' },
  ],
  overlays: [],
};
