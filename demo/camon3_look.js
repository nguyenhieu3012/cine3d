// LOOK TEST (17/11) for "Cảm ơn không kịp?" (camon3): the 2-D layer of episodes/camon3_props.js over the seated cast, on the line times of episodes/camon3.times.js.
// Phase 1: no voice yet, so camon3.times.js holds ESTIMATED times (the real file replaces it after `voice.py build`; nothing here is typed by hand).
// Stills: node tools/render.cjs stills demo/camon3_look.js out/camon3/look <times>
// EYELINES (left / right as the VIEWER sees them): Tèo sits left and looks right at Bíp; Bíp sits right and looks left at Tèo; looking UP = at the card; both face the lens only in the hook, row 10 and rows 21-22 (to the viewer).
import T from '../episodes/camon3.times.js';
import B from '../episodes/camon3.beats.json' with { type: 'json' };
import { makeCard, makeCloud, N, GEO } from '../episodes/camon3_props.js';
const s = (id) => T.lines[id].t0, e = (id) => T.lines[id].t1, DUR = T.dur;
const CARD = makeCard(T), CLOUD = makeCloud(T);

const LOOK = {
  l1: { emo: 'happy', pose: 'cheer' }, l2: { emo: 'neutral', pose: 'rest' }, l3: { emo: 'shock', pose: 'table' }, l4: { emo: 'worry', pose: 'table' }, l5: { emo: 'judge', pose: 'cross' },
  l6: { emo: 'angry', pose: 'point' }, l8: { emo: 'happy', pose: 'rest' }, l9: { emo: 'moved', pose: 'rest' }, l10: { emo: 'moved', pose: 'rest' }, l11: { emo: 'happy', pose: 'rest' },
  l12: { emo: 'happy', pose: 'chin' }, l13: { emo: 'neutral', pose: 'rest' }, l14: { emo: 'smug', pose: 'shrug' }, l15: { emo: 'judge', pose: 'rest' }, l16: { emo: 'smug', pose: 'cross' },
  l17: { emo: 'smug', pose: 'rest' }, l18: { emo: 'happy', pose: 'give' }, l19: { emo: 'neutral', pose: 'raise' }, l21: { emo: 'worry', pose: 'head' }, l22: { emo: 'judge', pose: 'rest' },
  l23: { emo: 'happy', pose: 'rest' }, l24: { emo: 'neutral', pose: 'rest' },
};
const lines = B.beats.filter((b) => b.text).map((b) => ({ id: b.id, who: b.who, t0: s(b.id), t1: e(b.id), text: b.text, ...(LOOK[b.id] || {}) }));

const shots = []; const cut = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1: Math.min(t1, DUR), cam, ...o }); };
// the card owns the top half: heads sit LOW (same numbers as mekhongcanve)
const RIG_TWO = { eye: 0.59, head: 0.16 }, RIG_MS = { eye: 0.54, head: 0.17 }, RIG_CU = { eye: 0.56, head: 0.235 }, RIG_CUH = { eye: 0.545, head: 0.225 };
cut(0.9, 'two', { move: 'push', amt: 0.6, rig: RIG_TWO });                                  // 1  hook: Tèo's hands up, the card above
cut(e('l1'), 'ms_teo', { move: 'push', amt: 0.8, rig: RIG_MS, eyes: { teo: 'cam' } });      // 2  "Xong! Cảm ơn hai nghìn bạn!" (to the viewer)
cut(3.05, 'two', { move: 'push', amt: 0.3, rig: RIG_TWO, v: 1 });                          // 3  the counter spins, both stunned (no close-up while the card is still sliding up)
cut(e('l2'), 'cu_bip', { move: 'none', rig: RIG_CU });                                      // 3b Bíp: "Ba nghìn rồi."
cut(e('l3'), 'ms_teo_hi', { move: 'push', amt: 0.6, rig: RIG_MS });                         // 4  "Hả?! Để tao sửa!"
cut(e('l4'), 'cu_teo_hi', { move: 'push', amt: 0.6, rig: RIG_CUH });                        // 5  "Khoan! Khoan đã!"
cut(e('l5'), 'cu_bip_lo', { move: 'none', rig: RIG_CU, punchAt: s('l5') + 0.5 });          // 6  "Nó không khoan."
cut(e('l6'), 'ms_teo_hi', { move: 'push', amt: 0.8, rig: RIG_MS });                         // 7  "Đứng yên cho tao viết!"
cut(e('p7'), 'two', { move: 'none', rig: RIG_TWO });                                        // 8  both hold their breath, looking up
cut(e('l8'), 'cu_teo', { move: 'push', amt: 0.4, rig: RIG_CU });                            // 9  "Nó dừng rồi."
cut(e('l9'), 'ms_teo', { move: 'push', amt: 0.3, rig: RIG_MS });                            // 10 "Mỗi số là một người thật đấy."
cut(e('l10'), 'cu_teo', { move: 'push', amt: 0.3, rig: RIG_CU, eyes: { teo: 'cam' } });      // 11 "Cảm ơn mọi người. Thật lòng." (to the viewer)
cut(e('l11'), 'cu_bip', { move: 'none', rig: RIG_CU });                                     // 12 "Cảm ơn."
cut(e('l12'), 'ms_teo', { move: 'push', amt: 0.4, rig: RIG_MS });                           // 13 "Bao giờ thì mười nghìn nhỉ?" (the goal line appears)
cut(e('l13'), 'cu_bip', { move: 'none', rig: RIG_CU });                                     // 14 "Không xa đâu."
cut(s('l14') + 1.6, 'ms_teo_lo', { move: 'push', amt: 0.5, rig: RIG_MS });                  // 15 "Mày mơ à?"
cut(e('l14'), 'cu_teo_lo', { move: 'push', amt: 0.4, rig: RIG_CU, punchAt: e('l14') - 0.5 });   // 16 "tao cạo đầu!"
cut(e('p15'), 'two', { move: 'none', rig: RIG_TWO });                                       // 17 sheet 1 comes out and stands (silent)
cut(e('l15'), 'cu_bip', { move: 'none', rig: RIG_CU });                                     // 18 "Ghi nhận."
cut(e('l16'), 'ms_teo', { move: 'push', amt: 0.4, rig: RIG_MS });                           // 19 "In đi! Còn lâu! Thế không đủ thì sao?"
cut(e('p17'), 'two', { move: 'none', rig: RIG_TWO, v: 1 });                                 // 20 sheet 2 comes out and stands (silent)
cut(e('l17'), 'cu_bip_lo', { move: 'none', rig: RIG_CU });                                  // 21 "Tao mặc áo này."
cut(e('l18'), 'ms_teo', { move: 'push', amt: 0.5, rig: RIG_MS });                           // 22 "Đệ Tèo?! Cá!"
cut(e('l19'), 'cu_bip', { move: 'none', rig: RIG_CU });                                     // 23 "Cá."
cut(e('p20'), 'ms_teo_hi', { move: 'push', amt: 0.5, rig: RIG_MS });                        // 24 ting ting ting: the smile goes out, the hand goes up to his hair
cut(e('l21'), 'cu_teo', { move: 'push', amt: 0.4, rig: RIG_CUH, eyes: { teo: 'cam' } });     // 25 "Các bạn ơi… theo dõi từ từ thôi!"
cut(e('l22'), 'cu_bip', { move: 'none', rig: RIG_CU, eyes: { bip: 'cam' } });               // 26 "Theo dõi đi." (to the viewer)
cut(e('p23'), 'two', { move: 'none', rig: { eye: 0.625, head: 0.15 } });                                       // 27 the shared cloud: 10.000
cut(e('l23'), 'ms_teo', { move: 'push', amt: 0.3, rig: RIG_MS });                           // 28 "Không thể nào đâu nhỉ." (laughing)
cut(e('l24'), 'cu_bip', { move: 'none', rig: RIG_CU });                                     // 29 "Ừ. Chắc không."
cut(DUR, 'two', { move: 'pull', amt: 0.3, rig: RIG_TWO });                                  // 30 the last ting: both frozen, eyes up at the counter

const acts = [
  { t: -1, who: 'teo', emo: 'happy', pose: 'cheer' }, { t: -1, who: 'bip', emo: 'neutral', pose: 'rest' },
  { t: s('p1') + 0.1, who: 'teo', emo: 'shock', look: 'up', d: 0.8 }, { t: s('p1') + 0.1, who: 'bip', look: 'up', d: 1.0 },
  { t: s('l3') + 0.05, who: 'bip', look: 'up', d: 1.2 },
  { t: s('p7') + 0.1, who: 'teo', emo: 'worry', look: 'up', d: 1.8 }, { t: s('p7') + 0.1, who: 'bip', look: 'up', d: 1.8 },
  { t: s('l8') + 0.0, who: 'teo', look: 'down', d: 1.2 },
  { t: s('l10') + 0.05, who: 'teo', look: 'cam', d: 1.8 },
  { t: s('l11') + 0.1, who: 'bip', nod: 'yes' },
  { t: s('l12') + 0.05, who: 'teo', look: 'up', d: 1.5 }, { t: s('l13') + 0.05, who: 'teo', emo: 'smug', nod: 'jolt' },
  { t: e('l14') - 0.3, who: 'bip', emo: 'judge', look: 'partner', d: 0.8 },
  { t: s('p15') + 0.9, who: 'bip', look: 'up', d: 1.6 }, { t: s('p15') + 1.0, who: 'teo', look: 'up', d: 1.6 },
  { t: s('l16') + 0.2, who: 'teo', look: 'up', d: 1.2 },
  { t: s('p17') + 0.9, who: 'teo', look: 'up', d: 1.6 }, { t: s('p17') + 1.0, who: 'bip', look: 'up', d: 1.6 },
  { t: s('l18') + 0.3, who: 'teo', nod: 'yes' }, { t: s('l19') + 0.1, who: 'bip', nod: 'yes' },
  { t: s('p20') + 0.15, who: 'teo', look: 'up', d: 1.4 }, { t: s('p20') + 0.15, who: 'bip', look: 'up', d: 1.4 },
  { t: s('p20') + 0.7, who: 'teo', emo: 'worry' }, { t: s('p20') + 1.0, who: 'teo', pose: 'head' },
  { t: s('p23') + 0.05, who: 'teo', emo: 'think', pose: 'rest', look: 'up', d: 1.2 }, { t: s('p23') + 0.05, who: 'bip', emo: 'scan', look: 'up', d: 1.2 },
  { t: s('p23') + 1.3, who: 'teo', emo: 'happy', look: 'partner', d: 0.7 }, { t: s('p23') + 1.3, who: 'bip', emo: 'happy', look: 'partner', d: 0.7 },
  { t: s('l23') + 1.0, who: 'teo', nod: 'no' }, { t: s('l24') + 0.5, who: 'bip', nod: 'no' },
  { t: CARD.END0 - 0.35, who: 'teo', emo: 'shock', pose: 'point' }, { t: CARD.END0 - 0.35, who: 'bip', emo: 'shock', look: 'up', d: 1.0 },
  { t: CARD.END0 + 0.7, who: 'teo', pose: 'head' },
];

const overlays = [
  { kind: 'hook', t0: 0, t1: GEO.HOOK_END, text: ['SỐ NHẢY NHANH', 'HƠN BÚT?'], y: 236 },
  { kind: 'draw', t0: -0.05, t1: DUR, fade: 0.01, reads: CARD.reads, fn: (ctx, t) => CARD.draw(ctx, t) },
  { kind: 'draw', t0: CLOUD.t0, t1: CLOUD.t1, fade: 0.01, reads: [{ text: '10.000', t0: CLOUD.t0 + 0.2, t1: CLOUD.t1 }], fn: (ctx, t, o) => CLOUD.draw(ctx, t, o) },
];

const waive = [
  { check: 'read_time', t0: CARD.END0, t1: DUR, reason: 'the end plate of row 25 ("4.605 / 10.000" + the follow line, 26 characters) is the follow card: the house rule caps it at 2 s (here 1.4 s after the pop-in) while qa wants 1.0 + 26/12 = 3.2 s for 26 characters; the numbers on it are already on the counter above, the follow line is the channel line. Driver decides: shorten the line to about 9 characters or accept 3.2 s of plate'},
  { check: 'eye_line', t0: 0, t1: DUR, reason: 'same layout as mekhongcanve: the top half belongs to the counter + paper card (bottom edge up to y about 740), so every single is framed with the eye line at 54-58 % from the top instead of 28-44 %' },
];
export default { id: 'camon3', pack: 'trada', set: 'stall', fps: 30, dur: DUR, cast: ['teo', 'bip'], partners: { teo: 'bip', bip: 'teo' }, times: T, shots, lines, acts, overlays, waive };
