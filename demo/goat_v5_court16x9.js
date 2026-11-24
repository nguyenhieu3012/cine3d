export default {
  pack: 'goat', set: 'court', aspect: '16:9', look2: true, fps: 30, dur: 4.0, cast: ['ron', 'leo'],
  captions: { accent: '#ffe45a' },
  shots: [
    { t0: 0, t1: 2.0, cam: 'two', move: 'push', amt: 0.8 },
    { t0: 2.0, t1: 4.0, cam: 'cu_ron', move: 'push', amt: 1.0 },
  ],
  lines: [
    { who: 'ron', t0: 0.2, t1: 1.8, text: 'Order in the GOAT COURT!', emo: 'angry', pose: 'point' },
    { who: 'leo', t0: 2.1, t1: 3.8, text: 'Case dismissed. *EIGHT.*', emo: 'smug', pose: 'chin' },
  ],
  overlays: [
    { kind: 'hook', t0: 0, t1: 2.0, text: ['THE GOAT COURT: 16:9 TEST'], color: '#ffe45a' },
  ],
};
