// look test (20/11) for gta6p2b: the gym place (road, gym building, interior, silver car, tarp, leaf, seagull, jacket), the pumped Tèo, Gã đô con (ga / gas), the key fob, the HUD bars + the label, the lair (tracker + shadow).
// Stills: node tools/render.cjs stills demo/gta_p2b_look.js out/gta_p2b_look <times>
import { statBars, wantedLabel, endTag } from '../packs/trada/gta_p2b_overlay.js';
const OG = 2400, OL = 2800, GX = -13, GZ = -26.5;
const P = ([x, y, z]) => [x + OG, y, z], I = ([x, y, z]) => [x + OG + GX, y, z + GZ], LR = ([x, y, z]) => [x + OL, y, z];
const FPS = 30, DUR = 30;
const C = [
  [2, 'ext_wide', P([5, 2.4, -8]), P([-9, 1.2, -24]), 30, 'teo'],
  [4, 'silver_front', P([-3.5, 1.5, -15.5]), P([-6.3, 1.1, -21.2]), 50, 'gas'],
  [6, 'gym_front', P([2.5, 1.5, -22.5]), P([-10, 1.5, -26.5]), 36, 'teo'],
  [8, 'int_wide', I([3.2, 1.8, 3.6]), I([-1, 1.2, -1.2]), 30, 'teo'],
  [10, 'int_body', I([2.6, 1.1, 1.6]), I([0.4, 0.85, -0.6]), 34, 'teo'],
  [12, 'int_body2', I([2.2, 0.9, 1.4]), I([0.4, 0.8, -0.6]), 40, 'teo'],
  [13.9, 'int_mirror', I([-1.2, 1.3, -3.0]), I([-3, 1.2, -1.5]), 46, 'teo'],
  [14, 'ga_cu', P([-3.3, 1.4, -18.5]), P([-6.3, 1.5, -21.2]), 70, 'ga'],
  [16, 'door', P([-4.5, 1.2, -21.5]), P([-9.4, 1.0, -24.1]), 40, 'teo'],
  [18, 'lair', LR([0.45, 1.5, 0.1]), LR([-0.1, 1.25, -3.2]), 36, 'bongden'],
  [DUR, 'end', P([-3, 1.3, -14]), P([-6, 1.2, -21]), 45, 'teo'],
];
const shots = []; C.forEach(([t1, name, from, at, f, who], i) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam: 'free' + i + '_' + name, free: { from, at, f, dof: 0.2, who }, move: 'none', hold: true }); });
const A = []; const a = (t, who, o, d) => A.push({ t, who, ...o, ...(d != null ? { d } : {}) }); const S = (t, f, d = 0.3, o = {}) => A.push({ t, who: 'set', fx: f, d, ...o });
a(-1, 'teo', { pose: 'rest', emo: 'smug', fx: { bChest: 0.0 } }, 0.01);
a(-1, 'bip', { pose: 'rigid', emo: 'deadpan' }, 0.01); a(-1, 'gas', { pose: 'sleep', emo: 'sleepy' }, 0.01); a(-1, 'ga', { pose: 'stretch', emo: 'happy' }, 0.01); a(-1, 'bongden', { pose: 'spin', emo: 'neutral' }, 0.01);
a(1.0, 'teo', { fx: { bChest: 1, bShoulder: 1, bArm: 1, bBelly: 1, stand: 1, wob: 0.6, fob: 2, led: 1 } }, 0.3);
a(1.0, 'gas', { fx: { capDown: 1 } }, 0.01); a(4.0, 'gas', { fx: { capDown: 0, eyeGlow: 1 }, pose: 'mirror', emo: 'joy' }, 0.2);
a(9, 'teo', { fx: { eat: 1, loaf: 0 }, emo: 'happy' }, 0.1); a(9, 'teo', { fx: { loaf: 2.5 }, d: 2.5, ease: 'lin' });
a(11, 'teo', { fx: { eat: 0, bar: 1, curl: 1 }, pose: 'rest' }, 0.3);
a(13.5, 'teo', { fx: { button: 0 } }, 0.01); a(13.8, 'teo', { fx: { button: 1 }, d: 0.6, ease: 'lin' });
a(14, 'ga', { fx: { eyeGlow: 1, tremble: 1 }, pose: 'sigh' }, 0.2); a(14, 'ga', { fx: { sigh: 0 } }, 0.01); a(14.1, 'ga', { fx: { sigh: 1 }, d: 1.4, ease: 'lin' });
S(2, { svtarp: 0 }, 0.01); S(3, { svtarp: 1 }, 2.0);
export default {
  id: 'gta_p2b_look', pack: 'trada', set: 'gta', fps: FPS, dur: DUR, cast: ['teo', 'bip', 'ga', 'gas', 'bongden'], partners: { teo: 'bip', bip: 'teo', ga: 'teo', gas: 'teo' },
  castOpts: { teo: { gta: true, stand: 1, p2b: true }, bip: { glass: true } },
  setOpts: { gym: { gull: { t0: 1.0, t1: 5.0 }, jacket: { t0: 14, t1: 15, from: [-6, 1.6, -22], to: [-4.5, 0.05, -18] } }, lair: {}, places: [{ t: 0, place: 'gym' }, { t: 16, place: 'lair' }, { t: 18, place: 'gym' }],
    cars: { hero: { riders: { driver: 'teo', pass: 'bip' } }, police: 0, path: () => ({ tz: -20, tx: -2.75, ride: 0 }) },
    follow: 'teo',
    focus: [{ t: 0, at: P([-6, 1.0, -21]) }, { t: 7.99, at: P([-6, 1.0, -21]) }, { t: 8, at: I([0, 1.2, 0]) }, { t: 13.99, at: I([0, 1.2, 0]) }, { t: 14, at: P([-6, 1.0, -21]) }, { t: 15.99, at: P([-6, 1, -21]) }, { t: 16, at: LR([0, 1.4, -1.2]) }, { t: 17.99, at: LR([0, 1.4, -1.2]) }, { t: 18, at: P([-6, 1.0, -21]) }],
    stands: [
      { t: 0, who: 'teo', pos: P([-4.5, 0, -19.5]), yaw: 2.6 }, { t: 0, who: 'bip', pos: P([-7.5, 0, -19.8]), yaw: 1.2 }, { t: 0, who: 'ga', pos: P([-4.2, 0, -23.5]), yaw: 0.5 }, { t: 0, who: 'gas', pos: P([-6.3, 0, -21.2]), yaw: 0 },
      { t: 0, who: 'bongden', pos: LR([0, 0.17, -1.5]), yaw: Math.PI },
      { t: 8, who: 'teo', pos: I([0.4, 0.03, -0.6]), yaw: 0.4 }, { t: 8, who: 'bip', pos: I([1.4, 0.03, 0.8]), yaw: 2.3 },
      { t: 14, who: 'teo', pos: P([-7.5, 0, -22.5]), yaw: 1.2 }, { t: 14, who: 'bip', pos: P([-7.5, 0, -19.8]), yaw: 1.2 }, { t: 14, who: 'ga', pos: P([-4.6, 0, -21.2]), yaw: -1.6 }],
  },
  shots, lines: [], acts: A,
  overlays: [statBars({ t0: 9, t1: 13, who: 'teo', bars: [{ icon: 'arm', fill: [[9, 0], [12, 1]] }, { icon: 'weight', fill: [[9, 0], [10, 0.9]] }] }), wantedLabel({ t0: 1, t1: 5, target: 'car_silver' }), endTag({ t0: 26, t1: 29, who: 'teo' })],
};
