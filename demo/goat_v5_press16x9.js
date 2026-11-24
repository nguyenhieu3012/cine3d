export default {
  pack: 'goat', set: 'press', aspect: '16:9', look2: true, fps: 30, dur: 4.0, cast: ['ron', 'leo'],
  captions: { accent: '#ffe45a' },
  shots: [
    { t0: 0, t1: 2.0, cam: 'two', move: 'push', amt: 0.8 },
    { t0: 2.0, t1: 4.0, cam: 'cu_leo', move: 'push', amt: 1.0 },
  ],
  lines: [
    { who: 'ron', t0: 0.2, t1: 1.8, text: 'LIVE from the ROAST DESK!', emo: 'laugh', pose: 'raise' },
    { who: 'leo', t0: 2.1, t1: 3.8, text: 'Four nil. What a club.', emo: 'sarcastic', pose: 'shrug' },
  ],
  overlays: [
    { kind: 'hook', t0: 0, t1: 2.0, text: ['GOAT BEEF LIVE: 16:9 TEST'], color: '#4ac4ff' },
  ],
};
