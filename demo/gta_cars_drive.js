// look test (19/11): the hero car and two police cars on a bare dusk road: start, steer, the front two-shot over the windscreen, the low rear chase view with the plate.
import { PACKS } from '../packs/index.js';
import { registerCarTest, driveActs } from '../packs/trada/gta_cars.js';
registerCarTest(PACKS);
const speed = (t) => t < 3 ? 0 : Math.min(19, 5.2 * (t - 3));                       // accelerates from 3 s at about 5 m/s2, then holds 19 m/s
const yaw = (t) => 0.55 * Math.exp(-Math.pow((t - 11.2) / 0.9, 2)) - 0.55 * Math.exp(-Math.pow((t - 12.9) / 0.9, 2));   // a swerve to +x and back
const police = (P, delay) => driveActs(P, { t0: 3, t1: 15, speed: (t) => speed(t - delay), yaw: (t) => yaw(t - delay), delay: 0 });
export default {
  id: 'gta_cars_drive', pack: 'trada', set: 'gta_cars_test', fps: 60, dur: 15, cast: ['teo', 'bip'], setOpts: { cars: ['hero', 'p1', 'p2'] }, light: 'dusk_street',
  castOpts: { teo: { gta: true }, bip: { glass: true, belt: true } },
  seats: { teo: { pos: [-0.34, 0.24, -0.12], yaw: 0.14 }, bip: { pos: [0.34, 0.24, -0.12], yaw: -0.14 } }, partners: { teo: 'bip', bip: 'teo' },
  shots: [
    { t0: 0, t1: 0.5, cam: 'cu_teo', partner: 'bip', move: 'none' }, { t0: 0.5, t1: 1.0, cam: 'ms_bip', partner: 'teo', move: 'none' },
    { t0: 1.0, t1: 5.0, cam: 'free', free: { follow: 'teo', from: [1.1, 1.5, 3.9], at: [0.34, 0.98, 0], f: 36, dof: 0.12 }, hold: true },
    { t0: 5.0, t1: 9.0, cam: 'free', free: { follow: 'teo', from: [0.8, 0.85, -5.6], at: [0.3, 0.6, 2.5], f: 30, dof: 0.1 }, hold: true },
    { t0: 9.0, t1: 12.0, cam: 'free', free: { follow: 'teo', from: [2.4, 1.2, 4.2], at: [0.34, 0.95, 0], f: 34, dof: 0.12 }, hold: true },
    { t0: 12.0, t1: 15, cam: 'free', free: { follow: 'teo', from: [-0.4, 0.8, -6.2], at: [0.2, 0.7, 4], f: 28, dof: 0.1 }, hold: true },
  ],
  lines: [],
  acts: [
    { t: -1, who: 'teo', pose: 'drive' }, { t: -1, who: 'bip', pose: 'rigid' }, { t: 4.2, who: 'teo', fx: { slam: 1 }, d: 1.15, ease: 'lin' }, { t: 6.0, who: 'teo', fx: { slam: 0 }, d: 0.01 },
    { t: 6.5, who: 'teo', pose: 'gloat', emo: 'smug' }, { t: 9.2, who: 'teo', pose: 'drive', emo: 'happy' }, { t: 13.3, who: 'teo', fx: { wheelDrop: 1 }, d: 0.9, emo: 'sad' }, { t: 13.2, who: 'bip', fx: { tea: 1 }, d: 1.8, ease: 'lin' }, { t: 0, who: 'teo', emo: 'smug', look: 'bip', d: 99 }, { t: 0, who: 'bip', emo: 'deadpan', look: 'cam', d: 99 },
    { t: -1, who: 'set', fx: { head: 0.2 }, d: 0.01 },
    ...driveActs('', { t0: 3, t1: 15, speed, yaw }),
    ...police('p1', 0.0), ...police('p2', 0.3),
  ],
  overlays: [],
};
