// GOAT Beef · Ep 11 "Messi's Assists vs Ronaldo's Goals" (cine3d, 60 fps, 17/11/2026). Ron × Leo at the pub; Ron's full PINT is the "assist" Leo slides across the table.
// Script: ~/goat-beef-test/v2/script/ep11_cine3d_assists.md · treatment: episodes/gb11.treatment.md · times come from tools/voice.py (episodes/gb11.times.js).
// The pint (slides, nudge, hoist, gulp, slam, shove), the hand poses that touch it, Ron's foam moustache and Ron's rage / deflated faces are episode-local: episodes/gb11_props.js.
// Shape copied from gb07.js (approved): every burn = the speaker's big move + the listener's face; Ron grows, stands from l18, slams on NEVER, sinks at p22, ends drinking the assist.
// Eyelines (left/right as the viewer sees them): Ron sits on the left and looks right, Leo sits on the right and looks left in every single, two and ots (the engine keeps this by
//   construction). The only flip is the last second: Leo glances to the lens while he sips the mate (a deliberate aside to the viewer, the sign-off).
import T from './gb11.times.js';
import B from './gb11.beats.json' with { type: 'json' };
import props, { pintPoses, KEYS1, KEYS2, TS, RAGE, DEFLATE, JAW, BOIL } from './gb11_props.js';
const s = (id) => T.lines[id].t0, e = (id) => T.lines[id].t1, DUR = T.dur;

// ---- faces that start with each spoken line (each matches its beat's mood: joy laugh/happy · smug smug · anger angry · flat deadpan · fear worry · sad sad) ----
const LOOK = {
  l2: { emo: 'laugh' }, l3: { emo: 'deadpan' }, l4: { emo: 'happy' }, l5b: { emo: 'happy' }, l6: { emo: 'smug' }, l8: { emo: 'angry' }, l9a: { emo: 'laugh' }, l9b: { emo: 'deadpan' }, l9: { emo: 'smug' },
  l10: { emo: 'angry' }, l11: { emo: 'deadpan' }, l12a: { emo: 'happy' }, l12b: { emo: 'deadpan' }, l13b: { emo: 'angry' }, l14: { emo: 'smug' }, l15: { emo: 'angry' }, l16: { emo: 'deadpan' },
  l18: { emo: 'laugh' }, l19: { emo: 'deadpan' }, l20: { emo: 'worry' }, l21: { emo: 'angry' }, l23: { emo: 'deadpan' }, l25: { emo: 'deadpan' }, l26: { emo: 'sad' },
};
const lines = B.beats.filter((b) => b.text).map((b) => ({ id: b.id, who: b.who, t0: s(b.id), t1: e(b.id), text: b.text, ...(LOOK[b.id] || {}) }));

// ---- stressed words (onsets read off the 10-20 ms envelope of the stems) ----
const W = { waiters: 1.3, goals: 2.47, full: 9.17, ever: 11.67, score: 15.16, lucky: 17.89, hundred: 20.36, time: 25.62, conf: 26.85, hobby: 28.46, ever2: 32.48, passed: 34.2, scared: 37.23,
  final: 40.12, penalty: 41.59, three: 45.59, point: 50.06, never: 51.32 };

// ---- shots ----
const shots = []; const cut = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1: Math.min(t1, DUR), cam, ...o }); };
// the pint, close: the glass about 330 px tall (hook, wide enough for the whole slide) / the nudge and the hoist (narrower, higher)
cut(1.2, 'free', { free: { from: [0.12, 1.07, 0.85], at: [0.12, 0.98, 0.30], f: 22, dof: 0.2 }, action: true, insert: true });   // HOOK: Leo's palm slides the pint to Ron (whoosh), plate on top
cut(2.4, 'ms_ron_lo', { move: 'push', punchAt: W.waiters });                                           // l2 "Assists are for WAITERS!" - Ron has it in his fist, laughing
cut(s('l3'), 'two', { move: 'push', amt: 0.6, punchAt: W.goals });                                     // "Goals win games!" - free hand up; Leo deadpan
cut(4.5, 'cu_leo_lo', { move: 'none' });                                                                // l3 "Here."
cut(5.7, 'free', { free: { from: [-0.07, 1.10, 0.95], at: [-0.07, 0.99, 0.30], f: 38, dof: 0.3 }, action: true, insert: true });   // "Assist." - the last inch; Ron grabs it, hoists it (GOAL!)
cut(s('l5b'), 'ms_ron', { move: 'none' });                                                              // l4 the gulp, the slam (thud)
cut(7.9, 'cu_ron_lo', { move: 'push', amt: 0.6 });                                                      // l5b "Nobody remembers the waiter." - the foam moustache
cut(s('l6'), 'ms_ron_lo', { move: 'push', amt: 0.6, punchAt: W.full });                                 // "I'm FULL."
cut(e('l6'), 'cu_leo_lo', { move: 'push', amt: 0.7, punchAt: W.ever });                                 // l6 "Mine has the most assists EVER." - card
cut(s('l8'), 'cu_ron_hi', { move: 'none' });                                                            // p7 REACT: the jaw drops
cut(14.3, 'ms_ron', { move: 'push', amt: 0.6 });                                                        // l8 "Mine has more GOALS!" - table slap (thud)
cut(s('l9a'), 'ots_ron', { move: 'push', punchAt: W.score });                                           // "Check the SCOREBOARD!" - finger across
cut(e('l9a'), 'ms_ron_lo', { move: 'push', amt: 0.6, punchAt: W.lucky });                               // l9a "An assist is a pass that got LUCKY!"
cut(e('l9b'), 'cu_leo_lo', { move: 'push', amt: 0.7, punchAt: W.hundred });                             // l9b "Lucky over three hundred times." - Ron shocked
cut(s('l9'), 'cu_ron_hi', { move: 'none' });                                                            // p9c REACT
cut(24.5, 'cu_leo', { move: 'push', amt: 0.6 });                                                        // l9 "Yours shoots from forty yards."
cut(s('l10'), 'ots_leo', { move: 'push', amt: 0.7, punchAt: W.time });                                  // "Every. Time." - thrown at Ron
cut(e('l10'), 'ms_ron_lo', { move: 'push', amt: 0.6, punchAt: W.conf });                                // l10 "That's CONFIDENCE!" - chest out
cut(e('l11'), 'cu_leo_lo', { move: 'push', amt: 0.6, punchAt: W.hobby });                               // l11 "That's a hobby." - crowd OOOH
cut(s('l12a'), 'cu_ron_hi', { move: 'none' });                                                          // p12 REACT: the eye twitch
cut(31.4, 'ms_ron_lo', { move: 'push', amt: 0.6 });                                                     // l12a "Mine has the most international goals" - card
cut(s('l12b'), 'two', { move: 'push', amt: 0.5, punchAt: W.ever2 });                                    // "... EVER!"
cut(e('l12b'), 'cu_leo_lo', { move: 'push', amt: 0.7, punchAt: W.passed });                             // l12b "Great. Who passed him the ball?"
cut(e('l13b'), 'ots_ron', { move: 'push', punchAt: W.scared });                                         // l13b "Your guy passes 'cause he's SCARED!" - finger jabs
cut(e('l14'), 'cu_leo_lo', { move: 'push', amt: 0.8, punchAt: W.final });                               // l14 "He scored twice in a World Cup FINAL." - card
cut(e('l15'), 'ms_ron', { move: 'push', punchAt: W.penalty });                                          // l15 "One was a PENALTY!" - pounces
cut(e('l16'), 'two', { move: 'none' });                                                                 // l16 "Your favorite kind." - Ron horror; crowd OOOH
cut(s('l18'), 'ecu_ron', { move: 'push', amt: 0.5 });                                                   // p17 REACT: the face breaks (the one ecu), he starts to rise
cut(46.1, 'ms_ron_lo', { move: 'push', amt: 0.6 });                                                     // l18 "Mine scored in" - standing, arms out; card
cut(s('l19'), 'cu_ron_lo', { move: 'push', amt: 0.6, punchAt: W.three });                               // "THREE Champions League finals!"
cut(s('l20'), 'cu_leo', { move: 'push', amt: 0.5 });                                                    // l19 "Was one a penalty?" - the mate comes up at the end
cut(s('l21'), 'ms_ron_hi', { move: 'push', amt: 0.5, punchAt: W.point });                               // l20 "...Not the POINT!"
cut(52.2, 'two_lo', { move: 'none' });                                                                  // l21 "Ronaldo would NEVER" - both fists slam the table (thud, hit-stop)
cut(53.82, 'cu_ron_lo', { move: 'push', amt: 0.4 });                                                    // "pass in a big final!" - he hears himself
cut(s('l23'), 'two', { move: 'none', action: true });                                                   // p22 PEAK silent (1.2 s): Leo just looks at him, Ron sinks into the stool and pushes the pint away (crowd OOOH)
cut(e('l23'), 'cu_leo_lo', { move: 'none' });                                                           // l23 "...We know."
cut(s('l25'), 'cu_ron_hi', { move: 'none' });                                                           // p24 REACT: horror
cut(s('l26'), 'two', { move: 'push', amt: 0.4, action: true, rig: { head: 0.17 } });                                         // l25 "Here. Assist." - Leo slides the pint again, Ron takes it
cut(e('l26'), 'ms_ron_hi', { move: 'push', amt: 0.4 });                                                 // l26 "...goal." - the pint at his chest
cut(59.45, 'two', { move: 'none' });                                                                    // p27 the tiny sip, Leo sips the mate; the ask
cut(DUR, 'wide', { move: 'push', amt: 0.3 });                                                           // the result, once

// ---- acts ----
const R = (t, o) => ({ t, who: 'ron', ...o }), Lo = (t, o) => ({ t, who: 'leo', ...o });
const jabs = [...Array(6)].map((_, i) => R(35.6 + i * 0.4, { pose: 'jab' + (i % 2) }));            // l13b: finger jabs across the table
const poseOf = (k) => R(k.t, { pose: k.n });
const acts = [
  // ---- hook: Leo slides it, Ron catches it; l2: WAITERS, Goals win games ----
  R(-1, { emo: 'happy', pose: 'rest', look: 'down', d: 1.2 }), R(0.30, { pose: 'gCatch' }), R(1.0, { pose: 'gCatchB' }), R(2.5, { pose: 'gCatch' }), R(W.waiters, { nod: 'jolt' }), R(W.goals + 0.05, { nod: 'jolt' }),
  Lo(-1, { emo: 'smug', pose: 'pA' }), Lo(TS.slide1, { pose: 'pB' }), Lo(0.5, { pose: 'cupLow' }), Lo(0.9, { pose: 'cross', emo: 'unimpressed' }), Lo(2.6, { emo: 'deadpan' }),
  // ---- l3: "Here. Assist." the last inch; l4: GOAL! hoist, the gulp, the slam ----
  R(3.5, { emo: 'smug' }), R(4.6, { look: 'down', d: 0.6 }), Lo(4.5, { pose: 'nA' }), Lo(TS.nudge, { pose: 'nB' }), Lo(5.2, { pose: 'cupLow' }), Lo(5.6, { pose: 'cross' }), Lo(6.1, { emo: 'unimpressed' }),
  ...KEYS1.slice(1).map(poseOf), R(6.45, { pose: 'rest' }),
  // ---- l5b: moustache, I'm FULL (belly pat) ----
  R(7.0, { pose: 'chest' }), R(9.5, { pose: 'rest' }), Lo(s('l6') - 0.1, { emo: 'smug', pose: 'chin' }),
  // ---- l6: card; Ron's jaw (p7) ----
  R(W.ever - 0.4, { emo: 'worry' }), R(W.ever + 0.1, { emo: 'jaw', nod: 'jolt' }), R(e('l6') + 0.4, { nod: 'jolt' }), R(e('l6') + 0.58, { look: 'down', d: 0.2 }),
  // ---- l8: the table slap on GOALS, the point on SCOREBOARD ----
  R(s('l8') - 0.05, { emo: 'angry' }), R(TS.slap8 - 0.62, { pose: 'slapUp' }), R(TS.slap8 - 0.31, { pose: 'slapDn' }), R(14.7, { pose: 'pointL' }), R(15.95, { pose: 'rest' }),
  Lo(s('l8') + 0.1, { emo: 'unimpressed', pose: 'cross' }), Lo(14.0, { nod: 'jolt' }), Lo(W.score + 0.3, { emo: 'deadpan' }),
  // ---- l9a: LUCKY (a hand up); l9b: three hundred - Ron's shock ----
  R(17.5, { pose: 'raise' }), R(18.5, { pose: 'rest' }), Lo(18.0, { nod: 'no' }), Lo(s('l9b') - 0.1, { pose: 'chin' }),
  R(W.hundred - 0.1, { emo: 'shock', nod: 'jolt' }), R(21.0, { emo: 'jaw' }), R(21.6, { emo: 'worry', look: 'away', d: 0.3 }),
  // ---- l9: Every. Time. ; l10: chest out; l11: hobby ----
  Lo(s('l9') - 0.1, { emo: 'smug', pose: 'cross' }), R(24.5, { emo: 'boil' }), R(W.time + 0.05, { nod: 'jolt' }),
  R(26.3, { pose: 'chest' }), R(27.95, { pose: 'rest' }), Lo(27.85, { pose: 'chin' }), R(W.hobby, { emo: 'shock', nod: 'jolt' }), R(s('p12') + 0.05, { emo: 'boil' }), R(29.15, { nod: 'jolt' }), R(29.32, { nod: 'jolt' }),
  // ---- l12a: international goals (chest out, then up); l12b: who passed him the ball ----
  R(s('l12a') + 0.07, { pose: 'chest' }), R(32.3, { pose: 'raise' }), R(33.0, { pose: 'rest' }), Lo(33.0, { pose: 'cross', emo: 'deadpan' }), R(W.passed, { emo: 'shock', nod: 'jolt' }),
  // ---- l13b: SCARED (finger jabs); l14: a World Cup FINAL (card) ----
  R(s('l13b') - 0.05, { emo: 'angry' }), ...jabs, R(37.95, { pose: 'rest' }), Lo(s('l13b') + 0.3, { emo: 'unimpressed' }), Lo(37.9, { pose: 'chin', emo: 'smug' }),
  R(38.9, { emo: 'worry' }), R(W.final - 0.1, { emo: 'jaw', nod: 'jolt' }), R(e('l14') - 0.1, { emo: 'boil' }),
  // ---- l15: PENALTY (pounces); l16: Your favorite kind (horror) ----
  R(s('l15') - 0.05, { emo: 'angry', pose: 'pounce' }), R(41.45, { pose: 'pointL' }), R(42.3, { pose: 'rest' }), Lo(42.3, { pose: 'cross', emo: 'deadpan' }),
  R(42.55, { emo: 'horror', nod: 'jolt' }),
  // ---- p17: the face breaks; l18: Ron stands, arms out, THREE (a hand up) ----
  R(43.65, { emo: 'jaw' }), R(43.9, { nod: 'jolt' }), R(44.1, { nod: 'jolt' }), R(44.2, { pose: 'riseA' }), R(44.55, { pose: 'armsOut' }), R(45.35, { pose: 'threeUp' }), R(46.4, { pose: 'standPt' }),
  Lo(44.8, { emo: 'unimpressed' }), Lo(47.6, { pose: 'chin' }),
  // ---- l19: Was one a penalty?; l20: Not the POINT! ----
  R(47.62, { pose: 'standLean' }), R(48.3, { emo: 'worry' }), R(W.penalty + 6.9, { nod: 'jolt' }), Lo(49.15, { pose: 'cup' }), R(W.point, { nod: 'jolt' }),
  // ---- l21: NEVER (both fists slam, hit-stop), pointing; then he hears himself ----
  R(50.5, { pose: 'fistsUp' }), R(50.84, { pose: 'slamUp' }), R(TS.never - 0.31, { pose: 'slamDn' }), R(51.65, { pose: 'slamUp' }), R(52.05, { pose: 'standPt' }),
  Lo(50.5, { pose: 'cupLow' }), Lo(51.6, { emo: 'unimpressed' }), Lo(52.0, { pose: 'cross' }),
  R(53.45, { emo: 'horror', pose: 'standLean' }),
  // ---- p22: Leo just looks; Ron sinks (stand -> sit -> slump) and pushes the pint away ----
  Lo(53.4, { pose: 'chin' }), Lo(53.75, { emo: 'deadpan', look: 'ron', d: 1.3 }),
  R(54.0, { pose: 'sit1', emo: 'worry' }), R(TS.sA, { pose: 'sA' }), R(TS.sB, { pose: 'sB' }), R(55.1, { pose: 'slump', look: 'down', d: 0.6 }),
  // ---- l23 ...We know. / p24 horror / l25 Here. Assist. (Leo slides it again) / l26 ...goal. ----
  R(55.65, { emo: 'horror' }), R(55.9, { nod: 'jolt' }),
  Lo(TS.hover2, { pose: 'p2A' }), Lo(TS.slide2, { pose: 'p2B' }), Lo(56.85, { pose: 'cupLow' }), Lo(58.6, { emo: 'deadpan' }),
  ...KEYS2.map(poseOf), R(56.6, { look: 'down', d: 0.8 }),
  Lo(58.9, { pose: 'cup' }), Lo(59.0, { look: 'cam', d: 1.0 }),
];

// ---- text on the picture: one thing at a time ----
const card = (lines, col, y) => (ctx, t, { k }) => {   // a fact card readable on a phone: first line 60 px white, the rest 44 px in the accent (shrunk to fit 870 px)
  ctx.globalAlpha = k; ctx.translate(540, y - (1 - k) * 24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fit = (txt, px, min) => { let f = px; ctx.font = `900 ${f}px Display, sans-serif`; while (f > min && ctx.measureText(txt).width > 870) { f -= 2; ctx.font = `900 ${f}px Display, sans-serif`; } return [f, ctx.measureText(txt).width]; };
  const fs = lines.map((l, i) => fit(l, i ? 44 : 60, 40)), w = Math.max(...fs.map((f) => f[1])) + 90, lh = fs.map(([f], i) => f * (i ? 1.22 : 1.2)), h = lh.reduce((a, b) => a + b, 0) + 40;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; ctx.fillStyle = 'rgba(16,12,34,0.93)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 28); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.stroke();
  let yy = -h / 2 + 20; lines.forEach((l, i) => { ctx.font = `900 ${fs[i][0]}px Display, sans-serif`; ctx.fillStyle = i ? col : '#fff'; ctx.fillText(l, 0, yy + lh[i] / 2); yy += lh[i]; });
};
const cardOverlay = (lines, t0, t1, y = 275) => ({ kind: 'draw', t0, t1, fade: 0.18, reads: lines.map((text) => ({ text, t0, t1 })), fn: card(lines, '#ffe45a', y) });
const overlays = [
  { kind: 'hook', t0: 0, t1: 2.95, text: ['ASSISTS ARE FOR', 'LOSERS?'], y: 262, color: '#ffe45a' },
  cardOverlay(['MOST ASSISTS IN HISTORY', 'MESSI'], s('l6') + 0.05, s('p7') + 0.62),
  cardOverlay(["MOST MEN'S INTERNATIONAL GOALS", 'RONALDO'], s('l12a') + 0.05, s('l12b') - 0.04),
  cardOverlay(['WORLD CUP FINAL 2022', 'MESSI: 2 GOALS'], s('l14') + 0.05, s('l15') - 0.03),
  cardOverlay(['3 CL FINALS'], s('l18') + 0.08, e('l18') - 0.05),
  { kind: 'pill', t0: s('l26') - 0.1, t1: DUR - 0.03, text: 'ASSISTS OR GOALS? ONE WORD.', y: 215, size: 54 },
];

const PZ = pintPoses();
export default {
  id: 'gb11', pack: 'goat', set: 'bar', fps: 60, dur: DUR, cast: ['ron', 'leo'], lipsFile: 'episodes/gb11_lips.json', captions: { y: 1421, accent: '#ffe45a' },
  setOpts: { steady: true }, castOpts: { leo: { cup: 'mate' } }, partners: { ron: 'leo', leo: 'ron' },
  poses: { ron: PZ.ron, leo: PZ.leo },
  faces: { ron: { angry: RAGE, worry: DEFLATE, boil: BOIL, jaw: JAW } }, props, times: T,
  drive: { light: true, grade: true },
  hits: [{ t: TS.never, frames: 3 }],
  shots, lines, acts, overlays,
};
