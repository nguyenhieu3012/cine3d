// v4 look test (14/11): intensity track + camera vocabulary in the pub. 12 s, synthetic curve calm -> rise -> dip -> peak with an impact -> release.
// Uses: drive (camera + light + grade, no hit-stop), a whip ACROSS a cut (whipOut / whipIn), a rack focus in an ots shot, a driven push, a dolly zoom into the burst,
// a deadpan shot with drive: false. The same film without the track: demo/v4_drive_goat_off.js. Docs: docs/v4-intensity-camera.md
const shots = []; const cut = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
cut(2.2, 'two', { move: 'push' });                                                        // calm
cut(3.0, 'ms_leo', { move: 'push', whipOut: 0.2 });                                       // whip away from Leo ...
cut(5.0, 'ms_ron_lo', { move: 'push', whipIn: 0.2 });                                     // ... and land on Ron (rise, driven push)
cut(7.1, 'ots_ron', { move: 'push', dof: 4, rack: { at: 5.8, d: 0.8, from: 'ron', to: 'leo' } }); // the dip: focus pulls to Leo's near shoulder
cut(8.7, 'cu_ron_lo', { move: 'dolly_zoom' });                                           // build-up: dolly zoom, impact 8.0 = punch + shake
cut(9.8, 'two', { move: 'push', v: 1 });                                                  // the world reacts
cut(12, 'cu_leo', { move: 'push', drive: false });                                        // deadpan
export default {
  id: 'v4_drive_goat', pack: 'goat', set: 'bar', fps: 60, dur: 12, cast: ['ron', 'leo'], captions: { y: 1421, accent: '#ffe45a' }, shots,
  intensity: [[0, 2], [2.5, 2], [4.5, 6], [5.4, 6], [6.2, 3], [7.2, 3], [8.0, 9.5], [9.0, 9], [10.0, 3], [12, 2]],
  impacts: [8.0],
  drive: { camera: true, light: true, grade: true },
  // the whip across the cut throws both faces out of frame for a few frames by design
  waive: [{ check: 'subject_cut', t0: 2.8, t1: 3.2, reason: 'whip pan across the cut (whipOut / whipIn)' }, { check: 'face_dark', t0: 2.8, t1: 3.2, reason: 'whip pan across the cut: the face is out of frame' }],
  lines: [
    { who: 'leo', t0: 0.4, t1: 1.9, text: "He's done. Retire him.", emo: 'sarcastic', pose: 'cross' },
    { who: 'ron', t0: 3.2, t1: 4.7, text: 'Done? He scored TWICE!', emo: 'angry', pose: 'point' },
    { who: 'ron', t0: 7.2, t1: 7.9, text: 'Watch this.', emo: 'smug', pose: 'rest' },
    { who: 'leo', t0: 10.3, t1: 10.9, text: 'Cute.', emo: 'deadpan', pose: 'cup' },
  ],
  acts: [
    { t: 5.9, who: 'leo', emo: 'smug' }, { t: 6.0, who: 'ron', look: 'down', d: 1.0 },
    { t: 8.0, who: 'ron', emo: 'laugh', pose: 'cheer' }, { t: 8.1, who: 'leo', emo: 'shock' }, { t: 9.7, who: 'leo', emo: 'unimpressed' },
  ],
};
