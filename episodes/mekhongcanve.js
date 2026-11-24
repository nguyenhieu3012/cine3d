// Trà đá với AI · "Mẹ bảo không cần về?" (cine3d, 60 fps) · mã dựng mekhongcanve · BẢN 3 (16/11 night, gate round 3 applied)
// Script: vault 03 Projects/TraDaVoiAI/Kich ban Me bao khong can ve (16-11).md, sections "BẢN 3 — LỜI THOẠI" + "BẢN 3 — CHỐT" · treatment: episodes/mekhongcanve.treatment.md · times from tools/voice.py (episodes/mekhongcanve.times.js)
// NO board and NO background swap (owner 16/11): mẹ's chat is ONE big card in the top half (episodes/mekhongcanve_props.js), the two of them sit in the stall below, sharp, never dimmed.
// Under mẹ's bubbles Bíp "translates" in a blue strip that types letter by letter; mẹ's photos (pomelo tree in bloom / ripe / fallen; the live fish; the bare tree with one bagged fruit) are warm 2-D drawings in photo bubbles of the same card.
// Mẹ is never on stage. Only what Blender carries is used: seated cast, the phone in Tèo's hand, 2-D overlays.
// EYELINES (left / right as the VIEWER sees them): Tèo sits on the left and looks right at Bíp; Bíp sits on the right and looks left at Tèo (the card is above, so a look "up" = at the card). Typing shots: Tèo looks DOWN at the phone. Never flipped, no shot mirrors them.
import T from './mekhongcanve.times.js';
import B from './mekhongcanve.beats.json' with { type: 'json' };
import { project } from '../core/camera.js';
import { makeCard } from './mekhongcanve_props.js';
const s = (id) => T.lines[id].t0, e = (id) => T.lines[id].t1, DUR = T.dur;
const CARD = makeCard(T), IT = CARD.IT;

// ---- face and pose of every spoken line (emo matches the beat's mood: smug / flat / anger / sad / joy; Tèo stays on 'sad' from m9 to the bare-tree photo: leaving 'sad' on screen pops the head roll) ----
const LOOK = {
  m1: { emo: 'smug', pose: 'phone' },          // smug: chin up, the phone held out to Bíp
  l2: { emo: 'scan', pose: 'rest' },           // flat: Bíp switches on the translator
  l3: { emo: 'neutral', pose: 'rest' },        // flat reveal: "Mẹ nhớ."
  m3: { emo: 'angry', pose: 'point' },         // anger: "Nhớ gì! Tao mới hứa về hồi bưởi ra hoa mà!" (finger at the phone on the table)
  l5: { emo: 'neutral', pose: 'cross' },       // flat: Bíp, arms crossed, "Bưởi chín rồi."
  b6: { emo: 'deadpan', pose: 'cross' },       // flat, the biggest laugh: "Ba cái tuần sau."
  m7: { emo: 'happy', pose: 'phone' },         // smug family: a forced bright face, "Mẹ khoẻ không ạ?" (his message pops as he says it)
  m8: { emo: 'happy', pose: 'phone' },         // joy: "Đấy! Mẹ mua cá ngon!"
  m9: { emo: 'sad', pose: 'phone' },           // sad: the smile goes out, "Mà thôi… mẹ kho mặn, ăn dần."
  l15: { emo: 'sad', pose: 'rest' },           // very softly: "…Tao về."
  l16: { emo: 'sad', pose: 'phone' },          // soft, sincere
  m13: { emo: 'sad', pose: 'phone' },          // firm, a little choked: "Tối nay ạ. Con ra bến xe luôn đây."
  m15: { emo: 'moved', pose: 'phone' },        // whispered, choked ('moved' = the pack's wet-eyed face; fits mood sad, qa face_mood allows it)
};
const lines = B.beats.filter((b) => b.text).map((b) => ({ id: b.id, who: b.who, t0: s(b.id), t1: e(b.id), text: b.text, ...(LOOK[b.id] || {}) }));

// ---- shots. Framing for a card in the top half: heads sit LOW (the lower half belongs to the stall), the card never touches a face ----
const shots = []; const cut = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1: Math.min(t1, DUR), cam, ...o }); };
const RIG_TWO = { eye: 0.59, head: 0.16 }, RIG_MS = { eye: 0.54, head: 0.17 }, RIG_CU = { eye: 0.56, head: 0.235 }, RIG_CUH = { eye: 0.545, head: 0.225 }, RIG_CU2 = { eye: 0.545, head: 0.19 }, RIG_OTS = { eye: 0.54, head: 0.115 };
const HANDS = { from: [-0.1, 1.2, 1.75], at: [-0.3, 0.74, 0.3], f: 42, dof: 0.4 };         // Tèo's hands and the phone (typing)
const A1 = CARD.A1, A2 = CARD.A2, A3 = CARD.A3, OV = CARD.OV, ZI = CARD.ZI;
cut(0.9, 'two', { move: 'push', amt: 0.6, rig: RIG_TWO });                                  // 1  the two of them, Tèo holds the phone out; the card above; the hook plate
cut(s('m1') + 1.35, 'ms_teo', { move: 'push', amt: 0.8, rig: RIG_MS });                     // 2  m1: he reads it out
cut(e('m1'), 'cu_teo_lo', { move: 'push', amt: 0.9, rig: RIG_CU, punchAt: s('m1') + 1.5, eyes: { teo: 'cam' } });   // 3  "Tâm lý ghê!": winning, to the viewer
cut(s('l2') + 0.1, 'cu_bip', { move: 'none', rig: RIG_CU });                                // 4  Bíp's flat stare
cut(e('l2'), 'ms_bip', { move: 'push', amt: 0.5, rig: RIG_MS });                            // 5  l2: "Để tao dịch."
cut(s('l3'), 'two', { move: 'none', rig: RIG_TWO });                                        // 6  p2: the strip appears and types, the spark glows, Tèo goes still
cut(e('l3'), 'cu_bip_lo', { move: 'push', amt: 0.6, rig: RIG_CU, punchAt: s('l3') + 0.25 });   // 7  l3: "Mẹ nhớ."
cut(s('m3') + 0.5, 'cu_teo_hi', { move: 'none', rig: RIG_CUH });                             // 8  Tèo frozen, then he starts
cut(e('m3'), 'ms_teo_hi', { move: 'push', amt: 0.9, rig: RIG_MS, punchAt: s('m3') + 1.3 });   // 9  m3 "Nhớ gì! Tao mới hứa về hồi bưởi ra hoa mà!"
cut(A1 + 1.5, 'two', { move: 'none', rig: RIG_TWO });                                       // 10 p4: the chat scrolls up to the first photo and his own reply
cut(A2, 'cu_teo_hi', { move: 'push', amt: 0.4, rig: RIG_CUH });                              // 10b he reads his own "Dạ, tuần sau con về ạ."
cut(e('l5'), 'ms_bip_lo', { move: 'push', amt: 0.6, rig: RIG_MS, punchAt: s('l5') + 0.3 });   // 11 p5 + l5: the ripe photo, the second reply, "Bưởi chín rồi."
cut(e('p5b'), 'cu_teo_hi', { move: 'push', amt: 0.3, rig: RIG_CUH });                         // 12 row 5 ("Thì… tao bận thật mà.") was cut for length: his face, fading
cut(A3 + 1.5, 'two', { move: 'none', rig: RIG_TWO });                                       // 13 p6: scroll: the fallen fruit, the third reply
cut(OV, 'ms_bip', { move: 'push', amt: 0.3, rig: RIG_MS });                                 // 14 Bíp waits (he has seen all three)
cut(e('b6'), 'cu_bip_lo', { move: 'push', amt: 0.5, rig: RIG_CU, punchAt: s('b6') + 0.45 });   // 15 b6: "Ba cái tuần sau." (the biggest laugh; the card shows the three replies lined up)
cut(e('b6') + 0.5, 'cu_teo_hi', { move: 'none', rig: RIG_CUH });                             // 16 his face
cut(e('p7'), 'free', { free: HANDS, move: 'none', action: true });                          // 17 p7: he types (hands and phone)
cut(e('m7'), 'ms_teo', { move: 'push', amt: 0.5, rig: RIG_MS });                            // 18 m7: "Mẹ khoẻ không ạ?" (his message pops)
cut(e('p8') + 0.2, 'two', { move: 'none', rig: RIG_TWO });                                  // 19 p8: mẹ types, tin A arrives
cut(e('m8'), 'cu_teo', { move: 'push', amt: 0.5, rig: RIG_CU });                            // 20 m8: the smile at its widest
cut(s('m9'), 'ms_bip', { move: 'push', amt: 0.3, rig: RIG_MS });                            // 21 p9: tin B arrives; Bíp reads it
cut(e('m9'), 'cu_teo_hi', { move: 'push', amt: 0.5, rig: RIG_CU2 });                         // 22 m9: the smile goes out
cut(s('p10') + 1.2, 'two', { move: 'push', amt: 0.35, rig: RIG_TWO });                      // 23 p10: the strip with only a cursor, the light sinks
cut(s('l15') - 0.1, 'cu_teo', { move: 'push', amt: 0.4, rig: RIG_CU2 });                    // 24 the silence goes on, his face
cut(e('l15') + 0.3, 'ecu_teo_hi', { move: 'push', amt: 0.4, rig: { eye: 0.5, head: 0.25 } });   // 25 l15: "…Tao về." (the one ecu: the face quietly gives in)
cut(e('p11'), 'free', { free: HANDS, move: 'none', action: true });                         // 26 p11: he types, his message arrives
cut(s('l16') + 1.3, 'ms_teo', { move: 'push', amt: 0.5, rig: RIG_MS });                     // 27 l16: "Mẹ đừng kho ạ."
cut(e('l16'), 'cu_teo', { move: 'push', amt: 0.4, rig: { eye: 0.5, head: 0.19 } });         // 28 l16: "Tối nay con về."
// THE ENDING. Both stay still. Row 12 ("Ừ. Tuần sau cũng được con ạ."): nobody reads it aloud, held 3.5 s, Bíp looks at Tèo, music near-off.
cut(s('p12') + 1.7, 'ms_teo_hi', { move: 'none', rig: RIG_MS });                           // 29 Tèo reads it
cut(s('p12') + 3.1, 'cu_bip', { move: 'none', rig: RIG_CU });                               // 30 Bíp looks at Tèo (a silent look that earns its shot)
cut(e('p12'), 'two', { move: 'none', rig: RIG_TWO });                                       // 31 both still
cut(e('p13'), 'free', { free: HANDS, move: 'none', action: true });                         // 32 p13: he types again
cut(e('m13'), 'ms_teo', { move: 'push', amt: 0.4, rig: RIG_MS });                           // 33 m13: "Tối nay ạ. Con ra bến xe luôn đây."
cut(s('p14') + 1.6, 'cu_bip', { move: 'none', rig: RIG_CU });                               // 34 p14: mẹ types, deletes, types (dots in the card): Bíp watches
cut(s('p14') + 3.2, 'two', { move: 'push', amt: 0.35, rig: RIG_TWO });                      // 35 both still, Tèo leans in a little
cut(e('p14') + 0.0, 'cu_teo', { move: 'none', rig: RIG_CU });                               // 36 he holds his breath: the third "..."
cut(s('p15') + 1.4, 'ms_bip', { move: 'push', amt: 0.3, rig: RIG_MS });                     // 37 the fish photo arrives (one soft note): Bíp reads it
cut(e('p15'), 'two', { move: 'none', rig: RIG_TWO });                                       // 38 it stands still 2.6 s, nobody speaks
cut(e('m15'), 'cu_teo', { move: 'push', amt: 0.35, rig: { eye: 0.545, head: 0.19 } });      // 39 the bare tree, one fruit in a bag; the whisper "Mẹ để phần con."
cut(DUR, 'two', { move: 'pull', amt: 0.5, rig: RIG_TWO, action: true });                    // 40 the tail 2.0 s: he lowers his head and wipes his eyes once, Bíp looks at him then down, slowly back

// ---- acts: faces, poses, the listener's reaction ----
const EL = e('m15'), TC = IT.co.t;
const acts = [
  { t: -1, who: 'set', fx: { phoneUp: 1 }, d: 0.01 }, { t: -1, who: 'teo', emo: 'smug', pose: 'phone' }, { t: -1, who: 'bip', emo: 'neutral', pose: 'rest' },
  { t: s('m1') + 1.5, who: 'teo', look: 'cam', d: 0.9 },                                                                                // "Tâm lý ghê!" to the viewer
  { t: e('m1') + 0.05, who: 'bip', look: 'up', d: 1.0 },
  { t: s('l2'), who: 'bip', emo: 'scan', look: 'up', d: 1.2 },
  { t: e('l2') + 0.05, who: 'bip', look: 'up', d: 1.6 },
  { t: s('p2') + 0.05, who: 'teo', emo: 'worry', look: 'up', d: 0.8 },
  { t: s('l3') + 0.05, who: 'teo', emo: 'shock', nod: 'jolt' },                                                                          // reaction to "Mẹ nhớ.": he freezes
  { t: s('l3') + 0.2, who: 'bip', emo: 'neutral', look: 'partner', d: 0.7 },
  { t: e('l3') - 0.1, who: 'set', fx: { phoneUp: 0 }, d: 0.05 }, { t: e('l3') - 0.1, who: 'teo', pose: 'rest' },                         // the phone down on the table: evidence
  // row 4: the first two photos and his own replies
  { t: A1 + 0.1, who: 'teo', emo: 'worry', pose: 'rest', look: 'up', d: 1.0 },
  { t: IT.T1.t + 0.1, who: 'teo', look: 'down', d: 1.0 }, { t: IT.T1.t + 0.4, who: 'teo', nod: 'no' },                                    // "Dạ, tuần sau con về ạ." in his own name
  { t: s('l5') + 0.1, who: 'bip', look: 'partner', d: 0.8 },
  { t: s('l5') + 0.4, who: 'teo', emo: 'deadpan', look: 'down', d: 0.9 },
  { t: e('l5') + 0.2, who: 'teo', emo: 'worry', fx: { droop: 0.06 }, d: 0.8 },
  // row 6: the third photo and the third reply, the overview, Bíp counts
  { t: IT.T3.t + 0.1, who: 'teo', look: 'down', d: 1.4 },
  { t: IT.T3.t + 0.3, who: 'bip', emo: 'scan', look: 'up', d: 2.4 },
  { t: s('b6') + 0.1, who: 'bip', emo: 'deadpan', look: 'partner', d: 0.8 }, { t: s('b6') + 0.3, who: 'teo', emo: 'shock', nod: 'jolt' },
  { t: e('b6') + 0.3, who: 'teo', emo: 'worry', look: 'down', d: 0.8 },
  // row 7-9: he grabs the phone, bright and fake
  { t: e('b6') + 0.5, who: 'set', fx: { phoneUp: 1 }, d: 0.05 }, { t: e('b6') + 0.5, who: 'teo', emo: 'happy', pose: 'phone' },
  { t: e('b6') + 0.9, who: 'bip', emo: 'judge', look: 'partner', d: 1.0 },
  { t: s('p7') + 0.2, who: 'teo', look: 'down', d: 1.3 },
  { t: s('m7') + 0.1, who: 'teo', look: 'up', d: 0.8 },
  { t: s('p8') + 0.1, who: 'teo', look: 'down', d: 1.2 }, { t: s('p8') + 0.1, who: 'bip', emo: 'neutral', look: 'up', d: 1.0 },
  { t: IT.A.t + 0.1, who: 'teo', look: 'up', d: 1.2 },
  { t: e('m8') - 0.2, who: 'bip', emo: 'scan', look: 'up', d: 1.2 },
  { t: s('p9') + 0.7, who: 'teo', look: 'down', d: 0.8 },
  { t: s('m9') + 0.1, who: 'teo', emo: 'sad', look: 'down', d: 2.3 },                                                                    // the smile goes out; he never leaves 'sad' again until the bare tree
  // row 10 (as built): the strip stays empty, the light sinks, nobody speaks
  { t: s('p10') + 0.55, who: 'set', fx: { phoneUp: 0 }, d: 0.05 }, { t: s('p10') + 0.25, who: 'teo', pose: 'rest', look: 'down', d: 1.6 },
  { t: s('p10') + 0.05, who: 'bip', emo: 'scan', pose: 'rest', look: 'up', d: 2.1 },                                                       // Bíp looks at the empty strip and does not speak
  { t: s('l15') - 0.2, who: 'bip', emo: 'neutral', look: 'partner', d: 1.0 }, { t: s('l15') + 0.35, who: 'bip', nod: 'yes' },
  { t: s('p10') - 0.05, who: 'set', fx: { dim: 0.4 }, d: 0.7 },                                                                         // the stall light sinks one notch for the silence
  { t: s('l15') + 0.3, who: 'set', fx: { dim: 0.25 }, d: 2.4 },                                                                        // and comes back only a little
  { t: s('p11') + 0.12, who: 'set', fx: { phoneUp: 1 }, d: 0.05 }, { t: s('p11') + 0.12, who: 'teo', pose: 'phone', look: 'down', d: 1.4 },
  { t: s('l16') - 0.05, who: 'teo', look: 'up', d: 1.0 },
  // row 12: "Ừ. Tuần sau cũng được con ạ." arrives; nobody reads it aloud; Bíp looks at Tèo; Tèo looks down at it
  { t: IT.D.t + 0.05, who: 'teo', look: 'down', d: 3.4 }, { t: IT.D.t + 0.2, who: 'bip', look: 'partner', d: 3.4 },
  { t: IT.D.t + 0.4, who: 'teo', nod: 'jolt' },
  // row 13: he types again; rows 14-15: she types, deletes, types; the fish; the bare tree
  { t: s('p13') + 0.1, who: 'teo', look: 'down', d: 1.6 },
  { t: s('p14') + 0.1, who: 'bip', look: 'partner', d: 4.5 }, { t: s('p14') + 0.1, who: 'teo', look: 'down', d: 4.5 },                       // both look at the phone, still
  { t: s('p14') + 0.3, who: 'teo', fx: { droop: 0.08 }, d: 2.2 },                                                                        // Tèo leans in slightly as mẹ types and deletes
  { t: s('p14') + 3.8, who: 'teo', nod: 'jolt' },                                                                                         // the third "..." : he holds his breath
  { t: IT.ca.t, who: 'set', fx: { dim: 0 }, d: 2.6 },                                                                                     // the warm light comes back with the fish: from here the theme rises to the end
  { t: IT.ca.t + 0.1, who: 'bip', look: 'up', d: 1.6 }, { t: IT.ca.t + 0.2, who: 'teo', look: 'down', d: 2.0 },
  { t: TC - 0.1, who: 'teo', emo: 'moved', look: 'up', d: 1.0 },                                                                          // Tèo sees the bare tree, the one fruit in its bag
  { t: IT.G.t + 0.05, who: 'teo', look: 'down', d: 3.0 }, { t: IT.G.t + 0.05, who: 'teo', fx: { droop: 0.08 }, d: 1.2 }, { t: IT.G.t + 0.1, who: 'bip', look: 'partner', d: 1.6 },   // the whisper
  // the tail 2.0 s: he lowers his head and wipes his eyes ONCE with the back of his hand (episode-local pose, his free hand; the other holds the phone); Bíp looks at him, then down (no existing act pushes his glass toward Tèo)
  { t: EL + 0.0, who: 'teo', fx: { droop: 0.19 }, d: 0.8 }, { t: EL + 0.0, who: 'teo', look: 'down', d: 1.4 },
  { t: EL + 0.15, who: 'teo', pose: 'wipeA' }, { t: EL + 0.6, who: 'teo', pose: 'wipeB' }, { t: EL + 0.95, who: 'teo', pose: 'phone' },
  { t: EL + 0.1, who: 'bip', look: 'partner', d: 1.0 },                                                                                      // Bíp, without a word, looks at Tèo...
  { t: EL + 1.1, who: 'bip', look: 'down', d: 3.0 },                                                                                       // ...then looks down at the table
];

// ---- text and screens: one thing at a time ----
// Bíp's Claude spark glows (coral, additive) while a translate strip types: it follows the real spark through the camera, so it holds in any shot that shows his chest.
function sparkGlow(ctx, t, { cast }) {
  const wins = CARD.glowWins, w = wins.find(([a, b]) => t >= a && t <= b); if (!w) return;
  const c = cast?.bip, cam = globalThis.stage?.camera; if (!c || !cam || !c.chestWorld) return;
  const p = project(cam, c.chestWorld(), 1080, 1920), u = (t - w[0]) / (w[1] - w[0]), a = Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.6 * (0.8 + 0.2 * Math.sin(t * 16)), r = 150;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(p[0], p[1], 4, p[0], p[1], r); g.addColorStop(0, `rgba(255,170,130,${0.85 * a})`); g.addColorStop(0.45, `rgba(255,110,70,${0.4 * a})`); g.addColorStop(1, 'rgba(255,110,70,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); ctx.restore();
}
const overlays = [
  { kind: 'hook', t0: 0, t1: 2.95, text: ['MẸ NÓI KHỎI VỀ.', 'MẸ NGHĨ GÌ?'], y: 236 },
  { kind: 'draw', t0: -0.05, t1: DUR, fade: 0.01, reads: CARD.reads, fn: (ctx, t) => CARD.draw(ctx, t) },                              // the chat card (top half), mẹ's bubbles, Bíp's strips, the photos
  ...CARD.glowWins.map(([a, b]) => ({ kind: 'draw', t0: a, t1: b, fade: 0.01, noText: true, fn: sparkGlow })),
  { kind: 'pill', t0: DUR - 2.0, t1: DUR - 0.03, text: 'MẸ BẠN HAY NÓI CÂU GÌ?', size: 46, color: '#fff0c8', y: 1470 },
];

// ---- waivers kept: eye_line only (owner's card layout). The 2.0 s tail needs none.
const waive = [
  { check: 'eye_line', t0: 0, t1: DUR, reason: 'owner order 16/11: the top half of the frame belongs to the big chat card (mẹ\'s chat, Bíp\'s strips, the photos, bottom edge up to y about 800) and the two of them stay seated in the lower half, sharp, with the card never touching a face; so every single (ms / cu / ots) is framed with the eye line at 54-58 % from the top instead of 28-44 % (mouth still above the caption band at y 1260, headroom and side margins unchanged)' },
];
export default {
  id: 'mekhongcanve', pack: 'trada', set: 'stall', fps: 60, dur: DUR, cast: ['teo', 'bip'], lipsFile: 'episodes/mekhongcanve_lips.json',
  setOpts: { phone: true }, partners: { teo: 'bip', bip: 'teo' }, times: T,
  poses: { teo: { wipeA: { l: [-0.075, 0.975, 0.2], r: [0.13, 0.6, 0.3], phone: 1 }, wipeB: { l: [-0.04, 0.95, 0.2], r: [0.13, 0.6, 0.3], phone: 1 } } },   // the back of his free hand at his eye, then a stroke across it
  shots, lines, acts, overlays, waive,
};
