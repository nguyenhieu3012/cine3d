// Side-by-side demo: the first 6.3 s of GOAT Beef Ep 3 "Saudi League or MLS" re-staged in cine3d with the ORIGINAL voices.
// Line times from ~/goat-beef-test/v2/data/ep03_time.js; mouths from the clips' own envelopes (data/lips/<clip id>.json).
const S = (t0, t1, o) => ({ t0, t1, ...o });
export default {
  pack: 'goat', set: 'bar', fps: 30, dur: 6.3, cast: ['ron', 'leo'], lipsFile: 'demo/goat_ep03_lips.json', captions: { y: 1421, accent: '#ffe45a' },
  castOpts: { leo: { jersey: 'red7' } },   // Leo lost the bet in Ep 2: he wears Ron's red 7 all episode
  shots: [
    S(0.0, 0.95, { cam: 'cu_leo', move: 'push', amt: 1.3 }),                 // Leo tugging at the red shirt
    S(0.95, 1.7, { cam: 'two', move: 'push', punchAt: 1.1 }),                // "...GOOD in red."
    S(1.7, 2.9, { cam: 'cu_leo_hi', move: 'drift' }),                        // "It's itchy."
    S(2.9, 4.55, { cam: 'ms_ron_lo', move: 'push', punchAt: 3.95 }),         // "Your guy retired to FLORIDA!"
    S(4.55, 5.5, { cam: 'ots_ron', move: 'orbit', amt: 0.6 }),               // "Like everyone's..."
    S(5.5, 6.3, { cam: 'cu_leo', move: 'none', punchAt: 5.6 }),              // "...GRANDPA!" lands on Leo's face
  ],
  lines: [
    { who: 'ron', t0: 0.10, t1: 1.65, text: 'You look GOOD in red.', emo: 'smug', pose: 'point' },
    { who: 'leo', t0: 1.75, t1: 2.823, text: "It's itchy.", emo: 'unimpressed', pose: 'cross' },
    { who: 'ron', t0: 2.943, t1: 4.557, text: 'Your guy retired to FLORIDA!', emo: 'laugh', pose: 'raise' },
    { who: 'ron', t0: 4.657, t1: 6.116, text: "Like everyone's GRANDPA!", emo: 'happy', pose: 'shrug' },
  ],
  acts: [
    { t: 0.0, who: 'leo', emo: 'unimpressed', pose: 'me' }, { t: 0.0, who: 'leo', look: 'down', d: 0.9 },
    { t: 2.95, who: 'leo', emo: 'deadpan' }, { t: 5.45, who: 'leo', emo: 'sarcastic' }, { t: 5.6, who: 'leo', look: 'cam', d: 0.7 },
  ],
  overlays: [{ kind: 'hook', t0: 0, t1: 2.6, text: ["NOW HE'S IN RED."], y: 250, color: '#ff4d4d' }],
};
