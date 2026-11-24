// look test (19/11): the cabin from the front, parked: drive with steer, gloat, slam, wheelDrop, Bíp's sip (hands on the wheel, glass, belt, spark clear).
import { PACKS } from '../packs/index.js';
import { registerCarTest, fxCurve } from '../packs/trada/gta_cars.js';
registerCarTest(PACKS);
const cam = (t0, t1, from, at, f = 40) => ({ t0, t1, cam: 'free', free: { follow: 'teo', from, at, f, dof: 0.1 }, hold: true });
export default {
  id: 'gta_cars_cab', pack: 'trada', set: 'gta_cars_test', fps: 60, dur: 16, cast: ['teo', 'bip'], setOpts: { cars: ['hero'] }, light: 'dusk_street',
  castOpts: { teo: { gta: true }, bip: { glass: true, belt: true } },
  seats: { teo: { pos: [-0.34, 0.24, -0.12], yaw: 0.14 }, bip: { pos: [0.34, 0.24, -0.12], yaw: -0.14 } }, partners: { teo: 'bip', bip: 'teo' },
  shots: [
    { t0: 0, t1: 0.5, cam: 'cu_teo', partner: 'bip', move: 'none' }, { t0: 0.5, t1: 1.0, cam: 'ms_bip', partner: 'teo', move: 'none' },
    cam(1, 4, [0.55, 1.45, 2.7], [0.34, 0.9, 0], 40), cam(4, 7, [-2.4, 1.15, 0.9], [0.0, 0.85, 0.15], 40), cam(7, 10, [0.7, 1.4, 2.8], [0.34, 0.95, 0], 40), cam(10, 13, [-2.4, 1.1, 0.6], [0.0, 0.85, 0.15], 40), cam(13, 16, [0.5, 1.5, 2.9], [0.34, 0.9, 0], 40),
  ],
  lines: [],
  acts: [
    { t: -1, who: 'teo', pose: 'drive', emo: 'happy', look: 'cam', d: 99 }, { t: -1, who: 'bip', pose: 'rigid', emo: 'deadpan', look: 'cam', d: 99 },
    ...fxCurve('steer', (t) => Math.sin((t - 1.5) * 2.2) * Math.min(1, Math.max(0, (t - 1.5) / 0.5)) * (t < 4.2 ? 1 : 0), 1.5, 4.2, 0.1, 'set'),
    { t: 4.6, who: 'teo', fx: { slam: 1 }, d: 1.15, ease: 'lin' }, { t: 6.0, who: 'teo', fx: { slam: 0 }, d: 0.01 },
    { t: 7.2, who: 'teo', pose: 'gloat', emo: 'smug' }, { t: 9.8, who: 'teo', pose: 'drive' },
    { t: 10.4, who: 'teo', fx: { wheelDrop: 1 }, d: 0.9, emo: 'sad' }, { t: 12.5, who: 'teo', fx: { wheelDrop: 0 }, d: 0.6 },
    { t: 13.3, who: 'bip', fx: { sip: 1 }, d: 1.3, ease: 'lin' },
  ],
  overlays: [],
};
