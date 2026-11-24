// v4 look test (14/11): intensity track + camera vocabulary at the tea stall. 12 s, synthetic curve calm -> rise -> dip -> peak with an impact -> release.
// Uses: drive (camera + light + grade + time), a whip inside one shot landing on the next speaker, a rack focus in an ots shot, a driven push into the burst,
// a deadpan shot with drive: false. The same film without the track: demo/v4_drive_trada_off.js. Docs: docs/v4-intensity-camera.md
const shots = []; const cut = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
cut(2.4, 'two', { move: 'push' });                                                        // calm
cut(4.9, 'ms_teo', { move: 'push', whip: { at: 4.15, d: 0.3, to: 'speaker' } });         // rise; whips to Bíp as he starts to talk
cut(7.0, 'ots_teo', { move: 'push', dof: 4, rack: { at: 5.7, d: 0.8, from: 'teo', to: 'bip' } }); // the dip: focus pulls from Tèo to Bíp's near shoulder
cut(8.7, 'cu_teo', { move: 'push' });                                                    // build-up -> burst (impact 8.0): driven push, punch, hit-stop
cut(9.8, 'wide', { move: 'push' });                                                       // the world reacts
cut(12, 'cu_bip', { move: 'push', drive: false });                                        // deadpan: the track keeps its hands off
export default {
  id: 'v4_drive_trada', pack: 'trada', set: 'stall', fps: 60, dur: 12, cast: ['teo', 'bip', 'ba'], setOpts: { day: 'NGÀY 12', tissue: 'NIÊM PHONG 1/11', phone: true },
  partners: { teo: 'bip', bip: 'teo', ba: 'teo' }, shots,
  intensity: [[0, 2], [2.5, 2], [4.5, 6], [5.4, 6], [6.2, 3], [7.2, 3], [8.0, 9.5], [9.0, 9], [10.0, 3], [12, 2]],
  impacts: [8.0],
  drive: { camera: true, light: true, grade: true, time: true },
  lines: [
    { who: 'teo', t0: 2.6, t1: 4.0, text: 'Tao nhịn mười hai ngày rồi.', emo: 'smug', pose: 'me' },
    { who: 'bip', t0: 4.5, t1: 5.5, text: 'Rồi sao?', emo: 'judge', pose: 'cross' },
    { who: 'teo', t0: 7.2, t1: 7.9, text: 'Nhìn đây!', emo: 'squeeze', pose: 'grip' },
    { who: 'bip', t0: 10.3, t1: 10.9, text: 'Ờ.', emo: 'deadpan' },
  ],
  acts: [
    { t: 0, who: 'teo', emo: 'zen', pose: 'zen' }, { t: 6.0, who: 'teo', look: 'down', d: 1.0 },
    { t: 8.0, who: 'teo', emo: 'power', pose: 'cheer' }, { t: 7.95, who: 'teo', fx: { aura: 1.3 }, d: 0.3 }, { t: 9.4, who: 'teo', fx: { aura: 0.4 }, d: 0.8 },
    { t: 8.1, who: 'ba', emo: 'shock' }, { t: 8.1, who: 'bip', emo: 'shock' }, { t: 9.8, who: 'bip', emo: 'deadpan' },
  ],
  waive: [{ check: 'smooth', t0: 7.95, t1: 8.15, reason: 'driven hit-stop on the impact at 8.0 (drive.time): the freeze is by design and not in ep.hits' }],
};
