// look test (13/11) for GOAT Beef Ep 4: the desk goal counter (bar.js setOpts.counter) and the fans' counter poses (fans.js counterPoses)
const S = (t0, t1, o) => ({ t0, t1, ...o });
const CTRCAM = { from: [0.0, 1.16, 0.86], at: [0.0, 0.96, 0.24], f: 50, dof: 0.35 };
export default {
  pack: 'goat', set: 'bar', fps: 30, dur: 16, cast: ['ron', 'leo'], captions: { y: 1421, accent: '#ffe45a' },
  setOpts: { counter: { label: 'RONALDO GOALS', alt: 'WORLD CUPS' } }, castOpts: { leo: { cup: 'mate' } },
  shots: [
    S(0, 1, { cam: 'two', move: 'push' }),                       // Ron's hand on top (guard)
    S(1, 2, { cam: 'ms_ron', move: 'push' }),
    S(2, 4, { cam: 'free', free: CTRCAM }),                      // Leo rolls 985 -> 984
    S(4, 6, { cam: 'two', move: 'drift' }),                      // tug of war: Ron presses, Leo rolls
    S(6, 8, { cam: 'free', free: { ...CTRCAM, from: [0.05, 1.16, 0.86], at: [0.05, 0.96, 0.24] } }),   // Leo pulls it over, reset knob: 0985 -> 0000
    S(8, 10, { cam: 'ms_leo', move: 'push' }),                   // label flips to WORLD CUPS, one click: 0001
    S(10, 12, { cam: 'free', free: { ...CTRCAM, from: [-0.05, 1.16, 0.86], at: [-0.05, 0.96, 0.24] } }),   // slid to Ron, his hand hovers
    S(12, 14, { cam: 'ms_ron', move: 'push' }),                  // Ron pumps it back up to 0985
    S(14, 16, { cam: 'wide', move: 'none' }),
  ],
  lines: [],
  acts: [
    { t: -1, who: 'set', fx: { count: 985 }, d: 0.01 },
    { t: 0, who: 'ron', pose: 'guard', emo: 'happy' }, { t: 0, who: 'leo', pose: 'cup', emo: 'unimpressed' },
    { t: 1.6, who: 'ron', pose: 'rest', emo: 'neutral' }, { t: 2.1, who: 'leo', pose: 'roll', emo: 'sarcastic' }, { t: 2.9, who: 'set', fx: { count: 984 }, d: 0.18 },
    { t: 3.6, who: 'leo', pose: 'cup' },
    { t: 4.0, who: 'ron', pose: 'press', emo: 'angry' }, { t: 4.4, who: 'set', fx: { press: 1 }, d: 0.05 }, { t: 4.45, who: 'set', fx: { count: 985 }, d: 0.12 }, { t: 4.5, who: 'set', fx: { press: 0 }, d: 0.08 },
    { t: 4.5, who: 'leo', pose: 'roll' }, { t: 4.95, who: 'set', fx: { count: 984 }, d: 0.12 }, { t: 5.1, who: 'leo', pose: 'cup' },
    { t: 5.2, who: 'set', fx: { press: 1 }, d: 0.05 }, { t: 5.25, who: 'set', fx: { count: 985 }, d: 0.12 }, { t: 5.3, who: 'set', fx: { press: 0 }, d: 0.08 }, { t: 5.6, who: 'ron', pose: 'guard' },
    { t: 6.0, who: 'ron', pose: 'rest', emo: 'shock' }, { t: 6.0, who: 'set', fx: { cx: 0.07 }, d: 0.4 }, { t: 6.1, who: 'leo', pose: 'knob', emo: 'deadpan' },
    { t: 6.6, who: 'set', fx: { knob: 1.5, count: 0 }, d: 0.8 },
    { t: 8.0, who: 'leo', pose: 'flipR', emo: 'smug' }, { t: 8.4, who: 'set', fx: { label: 1 }, d: 0.25 }, { t: 8.9, who: 'leo', pose: 'click' }, { t: 9.3, who: 'set', fx: { press: 1 }, d: 0.05 }, { t: 9.32, who: 'set', fx: { count: 1 }, d: 0.12 }, { t: 9.4, who: 'set', fx: { press: 0 }, d: 0.08 },
    { t: 9.6, who: 'leo', pose: 'push' }, { t: 9.7, who: 'set', fx: { cx: -0.07 }, d: 0.5 }, { t: 10.2, who: 'leo', pose: 'cup' },
    { t: 10.2, who: 'ron', pose: 'hover', emo: 'worry' },
    { t: 12.0, who: 'ron', pose: 'flipL', emo: 'angry' }, { t: 12.2, who: 'set', fx: { label: 0 }, d: 0.2 }, { t: 12.45, who: 'ron', pose: 'pump' }, { t: 12.6, who: 'set', fx: { pump: 1, count: 985 }, d: 1.2 }, { t: 13.8, who: 'set', fx: { pump: 0 }, d: 0.1 },
    { t: 13.9, who: 'ron', pose: 'raise', emo: 'happy' },
  ],
  overlays: [],
};
