// motion test (Zombie motion pass): the first zombie steps out from behind a water cart in SLOW MOTION (ep.slomo: the picture slows to 0.35 and catches up after,
// mouths and captions keep real time), cut with Tèo's fear: terror + recoil, dread + shiver + knees knocking, glasses slipping and pushed back up, backing away, scream.
import * as THREE from 'three';
import { PACKS } from '../packs/index.js';
import { ZOMBIE_CHARS } from '../packs/trada/zombie.js';
import { std, mesh, cyl } from '../core/util.js';
Object.assign(PACKS.trada.chars, ZOMBIE_CHARS);
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(0.7, 'ms_teo', { partner: 'zguard' }); add(1.4, 'cu_zguard', { partner: 'teo' }); add(4.3, 'free', { free: { from: [0.15, 1.0, 3.6], to: [0.3, 0.95, 3.2], at: [1.15, 0.85, 1.3], f: 40, dof: 0.3 }, hold: true, mblur: 3 });
add(5.6, 'cu_teo', { partner: 'zguard', move: 'none' }); add(7.2, 'ms_teo_hi', { partner: 'zguard' }); add(8.4, 'cu_teo', { partner: 'zguard' }); add(10.4, 'two', { frame: ['teo', 'zguard'] }); add(12, 'ecu_teo', { partner: 'zguard', move: 'none' });
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 12, cast: ['teo', 'zguard'], setOpts: { day: 'NGÀY 1' },
  castOpts: { teo: { stand: 1 } }, seats: { teo: { pos: [-0.3, 0, 1.4], yaw: 0.6 }, zguard: { pos: [1.55, 0, 1.0], yaw: -1.2 } }, partners: { teo: 'zguard', zguard: 'teo' },
  slomo: [{ t0: 1.5, t1: 4.3, rate: 0.35, ease: 0.3 }],   // ends on the cut: snaps back to real time there
  props({ scene }) { const g = new THREE.Group(); g.position.set(1.35, 0, 1.15); g.rotation.y = -0.3; scene.add(g);   // a street water cart: a blue barrel on a little trolley
    mesh(new THREE.BoxGeometry(0.62, 0.05, 0.42), std('#6b6f78', { roughness: 0.5, metalness: 0.5 }), [0, 0.2, 0], g); for (const x of [-0.24, 0.24]) cyl(0.09, 0.09, 0.04, std('#1b1b20'), [x, 0.09, 0.22], g, { rot: [0, 0, Math.PI / 2] }, 14);
    cyl(0.25, 0.25, 0.62, std('#2f6fd0', { roughness: 0.35 }), [0, 0.54, 0], g, {}, 24); cyl(0.255, 0.255, 0.04, std('#24529c'), [0, 0.7, 0], g, {}, 24); cyl(0.04, 0.04, 0.06, std('#e4e4e4'), [0.2, 0.33, 0.18], g, { rot: [Math.PI / 2, 0, 0] }, 10); return { update() {} }; },
  shots,
  lines: [{ who: 'zguard', t0: 2.6, t1: 3.6, text: 'Trả… tiền…' }],
  acts: [
    { t: 0, who: 'teo', pose: 'side', emo: 'neutral' }, { t: 0, who: 'zguard', pose: 'reach' },
    // the zombie steps out (inside the slow-motion window), sniffs, the head turns to Tèo with a crack
    { t: 1.5, who: 'zguard', fx: { lurch: 1 }, d: 0.3 }, { t: 1.5, who: 'zguard', fx: { x: -0.95, z: 0.45 }, d: 2.8, ease: 'lin' }, { t: 3.9, who: 'zguard', fx: { lurch: 0 }, d: 0.3 },
    { t: 3.5, who: 'zguard', fx: { neck: -0.5 }, d: 0.18 },
    // Tèo: terror + recoil, dread + shiver + knees, glasses slip and pushed back, backs away, screams
    { t: 4.3, who: 'teo', emo: 'terror' }, { t: 4.35, who: 'teo', fx: { recoil: 1 }, d: 0.12 }, { t: 4.35, who: 'teo', pose: 'guard' }, { t: 5.2, who: 'teo', fx: { recoil: 0.35 }, d: 0.4 },
    { t: 5.6, who: 'teo', emo: 'dread', pose: 'fists' }, { t: 5.6, who: 'teo', fx: { recoil: 0, shiver: 1, kneesKnock: 1, glasses: 1 }, d: 0.5 },
    { t: 7.2, who: 'teo', pose: 'pushGlasses' }, { t: 7.5, who: 'teo', fx: { glasses: 0 }, d: 0.25 }, { t: 8.0, who: 'teo', pose: 'fists' },
    { t: 8.4, who: 'teo', fx: { kneesKnock: 0, backaway: 1 }, d: 0.3 }, { t: 8.4, who: 'teo', fx: { x: -0.7, z: -0.45 }, d: 2.0, ease: 'lin' }, { t: 8.4, who: 'teo', emo: 'terror' }, { t: 9.9, who: 'zguard', fx: { lurch: 1, x: -1.25, z: 0.5 }, d: 1.2 },
    { t: 10.4, who: 'teo', fx: { backaway: 0, shiver: 0.6 }, d: 0.3 }, { t: 10.45, who: 'teo', emo: 'scream' }, { t: 10.4, who: 'teo', look: 'zguard', d: 2 },
  ],
  overlays: [],
};
