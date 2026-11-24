// look test: the coast boulevard (Miami deco + Vietnamese neon), the three red lights with their fine-camera boxes, the drawbridge, the quiet seaside after it
import { P, shotsFrom, F, at, fx } from './gta_world_common.js';
const r = (v) => P('road', v);
const EP = {
  id: 'gta_world_road', pack: 'trada', set: 'gta', fps: 30, dur: 16.0, cast: ['teo', 'bip'], partners: { teo: 'bip', bip: 'teo' },
  castOpts: { teo: { stand: 1 }, bip: { stand: 1 } },
  setOpts: { places: [{ t: 0, place: 'road' }], follow: 'teo',
    stands: [at(0, 'teo', 'road.car_start'), { t: 0, who: 'bip', pos: r([4.2, -100, 4]) }] },
  shots: shotsFrom([
    [1, F('teo', { from: r([2.75, 1.0, 12]), at: r([2.75, 0.9, -8]), f: 32 })],                 // chase low at the start
    [1, F('teo', { from: r([1.25, 1.7, -6]), at: r([4.75, 4.6, -32]), f: 24 })],                // wide at light 1
    [1, F('teo', { from: r([2.75, 0.9, -10]), at: r([3.4, 4.2, -32]), f: 32 })],                // low at light 1
    [1, F('teo', { from: r([4.25, 0.9, -18]), at: r([6.25, 4.9, -32]), f: 40 })],               // the box
    [1, F('teo', { from: r([-1.5, 2.0, -4]), at: r([3, 1.5, -40]), f: 30 })],                   // junction 1
    [1, F('teo', { from: r([2.75, 0.9, -60]), at: r([3.4, 4.2, -82]), f: 32 })],                // light 2
    [1, F('teo', { from: r([2.75, 0.9, -110]), at: r([3.4, 4.2, -132]), f: 32 })],              // light 3 (flash)
    [1, F('teo', { from: r([4.25, 0.9, -118]), at: r([6.25, 4.9, -132]), f: 40 })],             // box 3 (flash)
    [1, F('teo', { from: r([2.75, 1.4, -160]), at: r([0, 6, -210]), f: 28 })],                  // bridge ahead, raised
    [1, F('teo', { from: r([-24, 3.2, -212]), at: r([0, 4, -210]), f: 26 })],                   // bridge side
    [1, F('teo', { from: r([2.75, 1.0, -222]), at: r([2.75, 3.0, -250]), f: 30 })],             // after the bridge
    [1, F('teo', { from: r([-9, 1.2, -296]), at: r([2.75, 0.9, -300]), f: 36 })],               // cruise by the sea
    [1, F('teo', { from: r([-12, 1.8, -40]), at: r([-30, 2.0, -70]), f: 26 })],                 // beach side: hut, flamingos
    [1, F('teo', { from: r([2.75, 6, 20]), at: r([2.75, 2.0, -60]), f: 28 })],                 // high looking down the boulevard
    [1, F('teo', { from: r([8, 1.2, -60]), at: r([14, 5, -80]), f: 30 })],                      // shop front
    [1, F('teo', { from: r([-4, 1.2, 8]), at: r([4, 3.5, -20]), f: 30 })],
  ]),
  lines: [], acts: [fx(-1, { flash1: 0, bridge: 0 }, 0.01), fx(3.0, { flash1: 1 }, 0.05), fx(3.3, { flash1: 0 }, 0.15), fx(6.0, { flash3: 1 }, 0.05), fx(6.3, { flash3: 0 }, 0.15), fx(2.0, { bridge: 1 }, 0.05)],
};

// Tèo stands 9 m ahead of each camera in the hero lane (so the set's dome and light rig, which follow him, are where the camera is)
let tt = 0; EP.setOpts.stands = [];
for (const sh of EP.shots) { const f = sh.free.from; EP.setOpts.stands.push({ t: sh.t0, who: 'teo', pos: [f[0] + (2.75 - (f[0] - 1200)) - 0, 0, f[2] - 9], yaw: 0 }); }
EP.setOpts.stands.push({ t: 0, who: 'bip', pos: [1204.2, -100, 4] });
export default EP;
