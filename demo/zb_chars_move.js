// look test (Zombie special, 13/11): Tèo and Bíp standing on their own legs and moving, in the framings the two scripts use.
// walk · robot walk ("đi như máy") · run · Bíp's battery bar · Bíp kneels, lies down, shoos Tèo away · Tèo carries Bíp while running · Tèo crouches, gags, falls forward
import { path } from '../core/player.js';
const SEAT = { teo: [-0.45, 1.25], bip: [0.45, 1.25] };
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(1.0, 'two', { move: 'push' }); add(1.8, 'cu_bip'); add(2.9, 'ms_teo', { move: 'pull' }); add(4.6, 'wide', { move: 'drift' }); add(6.0, 'ms_teo_lo');
add(7.4, 'free', { free: { from: [0.06, 0.82, 3.55], at: [0.155, 0.7, 2.8], f: 60, dof: 0.3 } });
add(8.8, 'ms_bip'); add(10.4, 'two', { v: 1 }); add(12.2, 'cu_teo', { move: 'none' }); add(13.4, 'ms_teo'); add(15, 'free', { free: { from: [1.7, 2.0, 6.0], to: [1.8, 2.2, 6.3], at: [-0.3, 0.2, 3.6], f: 30, dof: 0.15 } });
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: 15, cast: ['teo', 'bip'],
  castOpts: { teo: { stand: 1 }, bip: { stand: 1, batt: 0.15 } }, setOpts: { day: 'NGÀY 1' },
  seats: { teo: { pos: [SEAT.teo[0], 0, SEAT.teo[1]], yaw: 0.25 }, bip: { pos: [SEAT.bip[0], 0, SEAT.bip[1]], yaw: -0.25 } },
  rides: { bip: 'teo' },
  shots, lines: [],
  acts: [
    { t: -1, who: 'bip', fx: { stand: 1 }, d: 0.01 }, { t: 0, who: 'teo', pose: 'side' }, { t: 0, who: 'bip', pose: 'side', emo: 'neutral' },
    // 0-2.9: Tèo walks a little loop, then the robot walk
    { t: 0.1, who: 'teo', fx: { walk: 1 }, d: 0.3 },
    ...path('teo', [[0.1, -0.45, 1.25], [1.9, -0.75, 1.75], [2.9, -0.95, 1.6]], { seat: SEAT.teo, yaw0: 0.25 }),
    { t: 1.9, who: 'teo', fx: { walk: 0, robot: 1 }, d: 0.25 }, { t: 1.9, who: 'teo', emo: 'worry' },
    // 2.9-6: both run towards the camera side
    { t: 2.9, who: 'teo', fx: { robot: 0, run: 1 }, d: 0.3 }, { t: 2.9, who: 'bip', fx: { run: 1 }, d: 0.3 }, { t: 2.9, who: 'teo', emo: 'shock' },
    ...path('bip', [[2.9, 0.45, 1.25], [6.0, 0.2, 2.6]], { seat: SEAT.bip, yaw0: -0.25 }),
    { t: 2.9, who: 'teo', fx: { x: -0.7, z: 1.4 }, d: 3.1, ease: 'lin' }, { t: 2.9, who: 'teo', fx: { dir: -0.15 }, d: 0.4 },
    { t: 6.0, who: 'teo', fx: { run: 0 }, d: 0.4 }, { t: 6.0, who: 'bip', fx: { run: 0 }, d: 0.4 },
    // 6-7.4 battery close-up: red, blinking; 7.4 Bíp sputters and kneels, then lies down and shoos
    { t: 6.0, who: 'bip', fx: { batt: 0.12 }, d: 0.1 }, { t: 7.0, who: 'bip', fx: { sputter: 1 }, d: 0.3 }, { t: 7.4, who: 'bip', fx: { kneel: 1 }, d: 0.5 }, { t: 7.4, who: 'bip', emo: 'sad' },
    { t: 8.8, who: 'bip', fx: { lie: 1, kneel: 0 }, d: 0.6 }, { t: 8.9, who: 'bip', pose: 'shoo', emo: 'deadpan' }, { t: 8.8, who: 'teo', emo: 'cry', pose: 'fists' },
    // 10.4 Tèo picks him up and runs with him
    { t: 10.2, who: 'bip', fx: { sputter: 0, off: 1 }, d: 0.3 }, { t: 10.4, who: 'bip', fx: { ride: 1, lie: 0, stand: 0.6 }, d: 0.35 }, { t: 10.4, who: 'teo', fx: { carry: 1, run: 1 }, d: 0.35 }, { t: 10.4, who: 'teo', emo: 'worry' },
    { t: 10.4, who: 'teo', fx: { x: -0.2, z: 2.1 }, d: 3.0, ease: 'lin' },
    // 12.2 he crouches, gags, then trips and falls forward
    { t: 12.2, who: 'teo', fx: { run: 0, carry: 0, crouch: 1 }, d: 0.3 }, { t: 12.2, who: 'bip', fx: { ride: 0, lie: 1, stand: 1 }, d: 0.3 }, { t: 12.25, who: 'teo', pose: 'gag', emo: 'shock' }, { t: 12.3, who: 'teo', look: 'cam', d: 1.1 },
    { t: 13.45, who: 'teo', fx: { crouch: 0, fall: 1 }, d: 0.5 }, { t: 13.4, who: 'teo', pose: 'raise', emo: 'squeeze' },
  ],
  overlays: [],
};
