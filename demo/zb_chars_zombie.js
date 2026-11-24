// look test (Zombie special, 13/11): the zombies of packs/trada/zombie.js in the framings of the scripts.
// guard sniffs, snaps his head round (neck crack), holds out a QR standee · shipper with the COD box · landlord with the ledger · friend with the endless receipt, then his phone (red X)
// · granny zombie in Bà's floral set (ecu) · anh khách bitten by the shipper and turning · the horde lurching, all heads snapping round, piling onto a point
import { PACKS } from '../packs/index.js';
import { ZOMBIE_CHARS } from '../packs/trada/zombie.js';
import { makeChip } from '../packs/trada/chip.js';
Object.assign(PACKS.trada.chars, ZOMBIE_CHARS, { chip: makeChip });   // until packs/index.js registers them
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(1.5, 'free', { free: { from: [0.3, 1.25, 6.8], to: [0.3, 1.15, 6.2], at: [0.4, 0.85, 2.0], f: 30, dof: 0.15 } });
add(2.8, 'ms_zguard', { partner: 'teo' }); add(3.8, 'cu_zguard', { partner: 'teo', move: 'none' }); add(5.0, 'cu_zshipper_lo', { partner: 'teo' }); add(6.2, 'ms_zlandlord', { partner: 'teo' });
add(7.6, 'free', { free: { from: [-3.6, 1.05, 3.9], at: [-1.6, 0.5, 2.1], f: 30, dof: 0.2 } }); add(8.6, 'ecu_zgranny', { partner: 'teo', eyes: { zgranny: 'cam' } });
add(9.3, 'cu_zshipper', { partner: 'victim', move: 'none' }); add(11.0, 'ms_victim', { partner: 'zshipper', move: 'none' });
add(12.5, 'ms_horde', { partner: 'teo', move: 'none' });
add(15, 'free', { free: { from: [1.5, 1.9, 4.6], at: [1.8, 0.45, 2.3], f: 30, dof: 0.15 }, hold: true });
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 15, cast: ['teo', 'zguard', 'zshipper', 'zlandlord', 'zfriend', 'zgranny', 'victim', 'horde'],
  castOpts: { teo: { stand: 1 }, horde: { n: 14, seed: 3, width: 2.4, depth: 2.2, pileAt: [1.8, 2.3] } }, setOpts: { day: 'NGÀY 1' },
  seats: {
    teo: { pos: [-0.1, 0, 1.3], yaw: 0.1 }, zguard: { pos: [-0.75, 0, 2.05], yaw: 0.35 }, zshipper: { pos: [0.95, 0, 2.25], yaw: -0.9 }, zlandlord: { pos: [-1.6, 0, 1.55], yaw: 0.55 },
    zfriend: { pos: [-1.45, 0, 2.55], yaw: 0.2 }, zgranny: { pos: [-2.5, 0, 1.0], yaw: 0.7 }, victim: { pos: [0.55, 0, 2.45], yaw: 0.6 }, horde: { pos: [3.2, 0, 0.6], yaw: -0.35 },
  },
  partners: { zguard: 'teo', zshipper: 'victim', zlandlord: 'teo', zfriend: 'teo', zgranny: 'teo', victim: 'zshipper', horde: 'teo' },
  shots,
  lines: [
    { who: 'zguard', t0: 2.0, t1: 2.75, text: 'Trả… tiền…' }, { who: 'zshipper', t0: 4.0, t1: 4.9, text: 'Ship… COD…' }, { who: 'zlandlord', t0: 5.2, t1: 6.1, text: 'Tiền… nhà…' },
    { who: 'zfriend', t0: 6.4, t1: 7.3, text: 'Chia… bill…' }, { who: 'zgranny', t0: 7.7, t1: 8.5, text: 'Dậyyy… trả tiềnnn…' },
  ],
  acts: [
    { t: 0, who: 'teo', pose: 'fists', emo: 'worry' }, { t: 0, who: 'zguard', pose: 'reach' }, { t: 0, who: 'zgranny', pose: 'grab' }, { t: 0, who: 'victim', pose: 'pockets', emo: 'worry' },
    { t: 0, who: 'horde', fx: { lurch: 1 }, d: 0.3 }, { t: 0, who: 'horde', fx: { x: -0.9, z: 0.5 }, d: 12, ease: 'lin' },
    { t: 0, who: 'zguard', fx: { lurch: 1 }, d: 0.3 }, { t: 1.4, who: 'zguard', fx: { lurch: 0, sniff: 1 }, d: 0.4 },
    { t: 3.0, who: 'zguard', fx: { sniff: 0, neck: -0.9 }, d: 0.16 }, { t: 3.0, who: 'zguard', look: 'cam', d: 1 }, { t: 3.2, who: 'zguard', pose: 'qr' },
    { t: 3.8, who: 'zshipper', fx: { lunge: 1 }, d: 0.35 }, { t: 4.9, who: 'zshipper', fx: { lunge: 0 }, d: 0.4 },
    { t: 6.2, who: 'zfriend', fx: { lurch: 0.6 }, d: 0.3 }, { t: 7.0, who: 'zfriend', pose: 'phoneUp' }, { t: 7.0, who: 'zfriend', fx: { shake: 1 }, d: 0.2 },
    // 8.6: the shipper bites anh khách's shoulder; he turns from 9.0 to 10.6
    { t: 8.4, who: 'zshipper', fx: { x: -0.2, z: 0.12, bite: 1 }, d: 0.3 }, { t: 8.4, who: 'zshipper', pose: 'grab' }, { t: 8.5, who: 'victim', emo: 'shock', pose: 'gag' },
    { t: 9.3, who: 'zshipper', fx: { x: 0, z: 0, bite: 0 }, d: 0.4 }, { t: 9.0, who: 'victim', fx: { turn: 1 }, d: 1.6 }, { t: 9.4, who: 'victim', pose: 'down', emo: 'deadpan' }, { t: 10.4, who: 'victim', pose: 'reach' },
    // 11.6 all heads snap round; 12.5 the pile
    { t: 11.7, who: 'horde', fx: { heads: 0.9 }, d: 0.18 }, { t: 12.4, who: 'horde', fx: { heads: 0, lurch: 0 }, d: 0.3 }, { t: 12.5, who: 'horde', fx: { pile: 1 }, d: 2.3 },
  ],
  overlays: [],
};
