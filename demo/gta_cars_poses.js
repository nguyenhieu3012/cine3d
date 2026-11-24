// look test (19/11): Tèo's and Bíp's new poses on bare ground, front-ish medium shots: flail, hips, ticket, sign, bag while running, gloat, wheelDrop, slam, Bíp with the glass.
import { PACKS } from '../packs/index.js';
import { registerCarTest, fxCurve } from '../packs/trada/gta_cars.js';
registerCarTest(PACKS);
const S = { teo: { pos: [-3.2, 0, 3.2], yaw: 0.25 }, bip: { pos: [-2.4, 0, 3.2], yaw: -0.25 } };
const cam = (t0, t1, who, from, at, f = 40) => ({ t0, t1, cam: 'free', free: { follow: who, from, at, f, dof: 0.1 }, hold: true });
export default {
  id: 'gta_cars_poses', pack: 'trada', set: 'gta_cars_test', fps: 60, dur: 21, cast: ['teo', 'bip'], setOpts: { cars: ['hero'], hero: { at: [3.2, 3.0], yaw: 0 } }, light: 'dusk_street',
  castOpts: { teo: { gta: true, stand: 1 }, bip: { glass: true, belt: true } }, seats: S, partners: { teo: 'bip', bip: 'teo' },
  shots: [
    { t0: 0, t1: 0.5, cam: 'cu_teo', partner: 'bip', move: 'none' }, { t0: 0.5, t1: 1.0, cam: 'ms_bip', partner: 'teo', move: 'none' },
    cam(1, 4, 'teo', [0.5, -0.3, 3.8], [0.1, 0.5, 0], 34),            // the fall: from slightly below and in front
    cam(4, 6, 'teo', [0.9, 0.9, 3.0], [0, 0.95, 0], 50),             // hips
    cam(6, 9, 'teo', [0.8, 1.0, 2.6], [0, 0.85, 0], 30),             // ticket (seated: low)
    cam(9, 12, 'teo', [1.5, 1.3, 2.4], [0, 0.8, 0.2], 46),           // sign
    cam(12, 15, 'teo', [1.8, 1.0, 4.2], [0.5, 0.8, 0], 28),          // bag while running
    cam(15, 18, 'bip', [0.9, 0.9, 3.0], [0, 0.55, 0], 52),           // Bíp glass seated / sip
    cam(18, 21, 'bip', [1.0, 0.8, 3.6], [0, 0.6, 0], 28),            // Bíp falling seated + tea blob
  ],
  lines: [],
  acts: [
    { t: -1, who: 'teo', fx: { stand: 1 }, d: 0.01 }, { t: -1, who: 'set', fx: { unride: 1 }, d: 0.01 },
    { t: 0, who: 'teo', pose: 'flail', emo: 'scream', look: 'cam', d: 99 }, { t: 0, who: 'bip', pose: 'rigid', emo: 'deadpan', look: 'cam', d: 99 },
    { t: -1, who: 'teo', fx: { y: 14 }, d: 0.01 }, { t: -1, who: 'bip', fx: { y: 14 }, d: 0.01 },
    ...fxCurve('y', (t) => 14 * (1 - (t - 1) / 2.6), 1, 3.6, 0.1, 'teo'), ...fxCurve('y', (t) => 14 * (1 - (t - 1) / 2.6), 1, 3.6, 0.1, 'bip'), { t: 3.55, who: 'teo', pose: 'rest', d: 99 }, { t: 3.6, who: 'teo', fx: { fall: 1 }, d: 0.22 }, { t: 3.8, who: 'bip', pose: 'rigid', emo: 'deadpan', d: 99 }, { t: 3.9, who: 'teo', fx: { fall: 0 }, d: 0.01 }, { t: 4, who: 'teo', pose: 'hips', emo: 'smug', look: 'cam', d: 99 },
    { t: 6, who: 'teo', pose: 'ticket', emo: 'worry', look: 'cam', d: 99 }, { t: 6, who: 'teo', fx: { stand: 0 }, d: 0.01 },
    { t: 9, who: 'teo', pose: 'sign', emo: 'think', fx: { stand: 1 }, d: 0.01 },
    { t: 12, who: 'teo', pose: 'bag', emo: 'terror', fx: { run: 1, panic: 0.3 }, d: 0.2 },
    ...fxCurve('z', (t) => 8 * (t - 12), 12, 15, 0.2, 'teo'),
    { t: 15, who: 'teo', fx: { run: 0, panic: 0, z: 0 }, d: 0.01, }, { t: 15, who: 'teo', pose: 'rest', d: 99 },
    { t: 15, who: 'bip', pose: 'rigid', fx: { sip: 0 }, d: 0.01 }, { t: 16, who: 'bip', fx: { sip: 1 }, d: 1.3, ease: 'lin' },
    { t: 18, who: 'bip', fx: { tea: 1, sip: 0 }, d: 2.4, ease: 'lin' },
  ],
  overlays: [],
};
