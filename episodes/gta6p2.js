// Trà đá với AI · "Tèo cướp tiệm tạp hoá?" (gta6p2, series Tèo vào GTA 6, phần 2/5; cine3d, 60 fps). Script: vault Kich ban GTA 6 P2 (20-11).md · times from tools/voice.py (episodes/gta6p2.times.js).
// ONE place (set gta, place `shop`): the 24 h grocery. Build rules of the driver (20/11, "Blender sau"): no long walks (a CUT puts Tèo where he is next), only three body moves (the door kick, the turn that shows the
// chữ bát feet, the leap through the glass + freeze), the safe opens by itself (no keypad pose, no digit change), the police light is a 2-D overlay, the cracks are geometry, the glass shards are keyed pieces,
// Bíp's red stool stands INSIDE the shop (he watches through the window), few exterior shots and those low on the neon facade. Everything 2-D (HUD, live frame, chat, mum's card, stamp, THEO DÕI) is an overlay.
// Eyeline convention (viewer's left / right): counter shots are taken from BEHIND the counter on the shopkeeper's side: Tèo faces the camera (his partner Lan is just beside / behind the lens), Lan seen from the customer
// side faces the camera; Bíp (inside, left) faces right / towards the counter, Tèo at the doorway faces out. A flipped direction is noted on its shot.
import T from './gta6p2.times.js';
import B from './gta6p2.beats.json' with { type: 'json' };
import { hud, hookPlate, exitButton, nameTag, stampCard } from '../packs/trada/gta_hud.js';
import { liveFrame, liveComment, liveChip, liveFollow, policeSweep } from '../packs/trada/live_overlay.js';

const s = (id) => T.lines[id].t0, e = (id) => T.lines[id].t1, DUR = T.dur, FPS = 60;
const O = 1600, P = ([x, y, z]) => [x + O, y, z];
const g60 = (t) => Math.round(t * FPS) / FPS;

// ================================================================ faces and poses of every spoken line (emo agrees with the beat's mood)
const LOOK = {
  l1: { emo: 'smug', pose: 'hips' }, l2: { emo: 'deadpan', pose: 'rigid' }, l3: { emo: 'smug', pose: 'hips' }, l4: { emo: 'smug', pose: 'hips' },
  l5: { emo: 'love', pose: 'live' }, l6: { emo: 'happy', pose: 'push' }, l7: { emo: 'smug', pose: 'cross' }, l8: { emo: 'deadpan', pose: 'rigid' }, l9: { emo: 'smug', pose: 'hips' },
  l10: { emo: 'happy', pose: 'live' }, l11: { emo: 'love', pose: 'live' }, l12: { emo: 'terror', pose: 'fists' }, l13: { emo: 'deadpan', pose: 'rigid' }, l15: { emo: 'deadpan', pose: 'rigid' },
  l16: {}, l17: { emo: 'worry', pose: 'give' }, l18: {}, l19: { emo: 'sad', pose: 'side' }, l20: { emo: 'love', pose: 'live' }, l21: { emo: 'smug', pose: 'cross' },
  l22: { emo: 'deadpan', pose: 'rigid' }, l23: { emo: 'deadpan', pose: 'rigid' }, l24: {}, l25: { emo: 'deadpan', pose: 'rigid' },
};
const lines = B.beats.filter((b) => b.text).map((b) => ({ id: b.id, who: b.who, t0: s(b.id), t1: e(b.id), text: b.text, ...(LOOK[b.id] || {}) }));

// ================================================================ cameras (shop-local metres; P() adds the place origin)
const CAM = {
  cu_teo0: { from: [-1.1, 1.25, 4.9], at: [-1.4, 1.2, 2.3], f: 82 },                 // frame 0: Tèo hooded, neon pink wall behind him
  ext_low: { from: [1.3, 0.5, 6.4], at: [-0.4, 1.9, 0], f: 24 },                    // low, the neon facade; Bíp (left window) and Lan (right window) are inside
  through: { from: [1.7, 1.35, 1.4], at: [1.6, 1.3, -4.0], f: 75 },                 // Lan through the right window
  ext_two: { from: [0.0, 0.8, 8.2], at: [-0.4, 1.6, -0.5], f: 24 },                   // both windows (Bíp left, Lan right), low
  mid3: { from: [-1.4, 1.3, 6.4], at: [0.6, 1.5, 0], f: 28 },                       // Tèo in front, Lan in the window behind him
  bip_thr: { from: [-2.0, 1.0, 2.6], at: [-2.15, 0.9, -0.9], f: 80 },                // Bíp through the left window (reaction)
  ms_teo_lo: { from: [-1.1, 0.55, 5.0], at: [-1.2, 1.45, 2.4], f: 40 },              // Tèo on the pavement, low, the winner
  feet_low: { from: [-0.5, 0.22, 3.4], at: [-0.5, 0.25, 1.0], f: 36 },              // the kick: Tèo's feet, the door
  TA: { from: [0.6, 1.45, -4.9], at: [1.6, 1.12, -2.65], f: 80 },                   // Tèo at the counter, from behind the counter, left of Lan
  TB: { from: [2.8, 1.4, -4.8], at: [1.6, 1.15, -2.65], f: 72 },                    // ... from the right
  TC: { from: [1.0, 0.95, -4.6], at: [1.6, 1.25, -2.65], f: 70 },                   // ... low (the winner)
  TD: { from: [-0.7, 1.85, -4.4], at: [1.6, 1.0, -2.65], f: 60 },                   // ... from the left, high (the loser)
  lan_cu: { from: [0.6, 1.4, -1.7], at: [1.75, 1.2, -4.0], f: 70 },                 // Lan from the customer side, left
  lan_ms: { from: [2.4, 1.35, -1.7], at: [1.6, 1.2, -4.0], f: 55 },                 // ... from the right
  lan_cu2: { from: [2.2, 1.3, -1.2], at: [1.65, 1.12, -4.0], f: 60 },                 // Lan's whole face + the hand that pushes the cash (l6, l18)
  two: { from: [-0.2, 1.4, -1.0], at: [1.6, 1.1, -3.4], f: 36 },                    // Tèo from behind, Lan facing, the counter between
  two2: { from: [3.3, 1.5, -1.0], at: [1.4, 1.1, -3.4], f: 34 },
  cash: { from: [2.6, 1.4, -1.7], at: [1.75, 1.15, -3.5], f: 42 },                  // Lan's whole face AND the roll sliding over the counter (l6)
  safe_a: { from: [2.3, 1.4, -1.6], at: [3.5, 1.15, -3.15], f: 55 },
  safe_b: { from: [3.1, 1.05, -2.2], at: [3.4, 1.12, -3.3], f: 55 },
  TCs: { from: [4.1, 1.35, -4.1], at: [3.55, 1.28, -2.7], f: 62 },                   // Tèo at the safe, from behind the counter
  feet_pov: { from: [1.84, 1.4, -3.65], at: [1.6, 0.05, -1.3], f: 38 },             // Lan's phone looking down at his feet
  door_front: { from: [-0.45, 1.25, 3.4], at: [-0.45, 1.15, -0.2], f: 40 },
  door_cu: { from: [-0.45, 1.3, 2.3], at: [-0.45, 1.25, -0.3], f: 80 },
  door_low: { from: [-1.4, 0.45, 2.0], at: [-0.45, 1.2, -0.3], f: 50 },
  door_cu2: { from: [0.1, 1.3, 2.1], at: [-0.45, 1.25, -0.3], f: 82 },
  door_in: { from: [-1.9, 1.3, -1.6], at: [-0.45, 1.25, -0.9], f: 50 },             // from inside: Tèo in profile looking at Bíp (the flipped direction: he turns to the left of the frame towards Bíp)
  bip_in: { from: [0.2, 1.05, -2.5], at: [-2.15, 0.62, -0.9], f: 62 },
  bip_cu: { from: [-0.6, 1.0, -2.0], at: [-2.15, 0.66, -0.9], f: 92 },
  bip_cu2: { from: [-0.2, 1.1, -2.7], at: [-2.15, 0.68, -0.9], f: 88 },
  bip_st: { from: [-0.5, 1.15, -2.4], at: [-1.7, 0.78, -0.9], f: 50 },                // Bíp standing beside his stool (medium)
  in_ms: { from: [0.9, 1.3, -2.9], at: [-0.45, 1.25, -0.45], f: 60 },             // from INSIDE the shop at Tèo in the doorway (he faces into the shop: no glass in front of his face)
  in_cu: { from: [-0.3, 1.3, -2.3], at: [-0.45, 1.25, -0.45], f: 85 },
  in_lo: { from: [-1.3, 0.8, -2.4], at: [-0.45, 1.3, -0.45], f: 70 },
  T34: { from: [2.9, 0.9, -4.5], at: [1.6, 1.3, -2.65], f: 60 },                 // Tèo three-quarter, low, looking up at the star
  leap: { from: [-0.45, 1.15, 3.0], at: [-0.45, 1.1, 0.0], f: 36 },
  final: { from: [-1.6, 0.9, 5.2], at: [-0.4, 0.9, 0.6], f: 26 },
};
const shots = []; let nCam = 0;
const cut = (t1, name, who, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; const c = CAM[name]; shots.push({ t0, t1: Math.min(t1, DUR), cam: 'free' + (nCam++) + '_' + name, free: { from: P(c.from), at: P(c.at), f: c.f, dof: 0.2, who }, move: 'none', hold: t1 - t0 > 3 ? true : undefined, ...o }); };
// ---- the plan (every line has its own framing; Lan / Bíp / Tèo take turns; a line over an insert is marked `insert`)
cut(0.9, 'cu_teo0', 'teo');                                                     // frame 0: the hook plate, the red money box
cut(g60(s('p1')), 'ext_low', 'teo');                                            // l1: he stands hands on hips; the shop behind him, Bíp and Lan in the windows
cut(g60(s('l2') + 0.0), 'through', 'lan', { insert: true });                    // p1: Lan yawns, scrolls (through the glass)
cut(g60(s('l3')), 'ext_two', 'bip');                                            // l2: Bíp, inside, deadpan; the name tag finds Lan in the other window
cut(5.8, 'mid3', 'teo');                                                        // l3: Tèo outside, Lan behind the glass
cut(s('p3'), 'ms_teo_lo', 'teo');                                               // l3 end: "không có sao": the star row pulses
cut(g60(s('l4') - 0.1), 'feet_low', 'teo', { insert: true, action: true });     // p3: the kick, the crack, the bell, the feet wide
cut(g60(e('l4') + 0.0), 'TA', 'teo');                                           // l4: hips at the counter
cut(g60(s('l5')), 'lan_cu', 'lan');                                             // p4: Lan looks him over, bright eyes, the ring light, the phone up: LIVE 3
cut(g60(s('l5') + 1.4), 'lan_ms', 'lan');                                       // l5: "Cả nhà thấy không!"
cut(g60(s('l6')), 'two', 'teo');                                                // l5 end: Tèo, uneasy and proud; the counter jumps 3 -> 1,2K
cut(g60(s('l6') + 1.6), 'lan_cu2', 'lan');                                      // l6: the lì xì, hearts
cut(g60(s('p6')), 'cash', 'lan', { insert: true, action: true });               // l6: the cash roll slides over the counter
cut(g60(s('l7')), 'TB', 'teo');                                                 // p6: the red box +340.000đ -> -9.660.000đ
cut(g60(s('l8')), 'TC', 'teo');                                                 // l7: "Thấy chưa. Không sao." (low = the winner)
cut(g60(s('p8')), 'bip_in', 'bip');                                             // l8: Bíp, flat, "Nợ chín triệu sáu."
cut(g60(s('l9')), 'TD', 'teo');                                                 // p8: his smile jerks (high = the loser)
cut(g60(s('l10')), 'TA', 'teo');                                                // l9: "Còn két ạ?"
cut(g60(s('l10') + 1.2), 'lan_cu', 'lan');                                      // l10: the code, in words
cut(g60(s('l10') + 2.6), 'safe_a', 'teo', { insert: true, action: true });      // the safe pops open by itself
cut(g60(s('p10')), 'safe_b', 'teo', { insert: true, action: true });            // the cookie tin, the lid, the thread
cut(g60(s('l11') - 0.0), 'TCs', 'teo');                                         // p10: he looks into the tin
cut(g60(s('l11') + 0.65), 'lan_ms', 'lan');                                     // l11: "Cả nhà xem giày em nó đi này."
cut(g60(s('p11')), 'feet_pov', 'teo', { insert: true, action: true });          // her phone drops to his feet: chữ bát (1 s), he turns his back
cut(g60(s('p11') + 1.6), 'door_front', 'teo');                                  // p11: frozen in the doorway; mum's comment alone
cut(g60(s('l12')), 'in_ms', 'teo');
cut(g60(s('l13')), 'in_cu', 'teo');                                             // l12: "Sao mẹ xem được?!"
cut(g60(s('l15') - 0.1), 'bip_in', 'bip');                                      // l13: "Live ra mạng thật."
cut(g60(s('p15')), 'bip_cu', 'bip');                                            // l15: "Mẹ mày không sót live nào."
cut(g60(s('l16')), 'in_lo', 'teo');                                          // p15: MẸ GỌI: ƯU TIÊN, he does not look at the button, pale
cut(g60(s('l16') + 1.05), 'in_ms', 'teo');                                     // l16: mum on the phone (voice)
cut(g60(s('l18') - 0.1), 'two', 'teo', { action: true });                       // l17: "Dạ." the roll goes back on the counter
cut(g60(s('l19')), 'lan_cu2', 'lan');                                           // l18: mum: "Rồi về ăn cơm." Lan looks at him
cut(g60(s('p19')), 'TA', 'teo');                                                // l19: "Dạ, năm phút nữa ạ."
cut(g60(s('l20')), 'TB', 'teo');                                                // p19: he glances at the button, she raises the phone
cut(g60(s('l20') + 1.5), 'lan_ms', 'lan');                                      // l20: "Chốt đơn!"
cut(g60(s('p20')), 'TC', 'teo');                                                // l20: he looks at mum's chip, sighs, pays: -10.200.000đ
cut(g60(s('l21')), 'TD', 'teo');                                                // p20: the star fills, MẸ ĐÃ XEM
cut(g60(s('p21')), 'TB', 'teo');                                                // l21: "Có ai báo công an đâu!"
cut(g60(s('l22')), 'T34', 'teo');                                               // p21: he freezes, face three-quarter, looking up at the star
cut(g60(s('l23')), 'bip_in', 'bip');                                            // l22: "Bản Việt hoá."
cut(g60(s('p23')), 'bip_cu2', 'bip');                                           // l23: "Mẹ thấy cũng tính."
cut(g60(s('p23') + 0.65), 'TC', 'teo');                                         // p23: Tèo, still; the hood sags
cut(g60(s('l24')), 'two2', 'teo');                                              // p23: chat floods, 2,4K -> 10K, two more stars; the red / blue light starts
cut(g60(s('p24')), 'TB', 'teo');                                                // l24: the loudspeaker; he goes pale in the red / blue light
cut(g60(s('l25')), 'door_in', 'teo');                                           // p24: he turns to Bíp (towards the left of the frame: Bíp is on his left)
cut(g60(s('p25')), 'bip_st', 'bip');                                              // l25: "Chạy." Bíp stands up with his tea
const LEAP0 = g60(s('p25')), HIT = g60(s('p25') + 0.63), FREEZE = 0.6;
cut(DUR, 'leap', 'teo', { insert: true, action: true });                         // p25: the dash, the glass bursts, THE FREEZE to the end of the film, the stamp, THEO DÕI

// ================================================================ stands: Tèo is put where he is next (cuts); only three moves (kick = lunge on the spot, the turn, the leap)
const doorway = P([-0.45, 0, -0.45]);
const turnY = (t0, t1, pos, y0, y1) => { const o = []; for (let t = t0; t < t1 - 1e-6; t += 1 / FPS) { const u = (t - t0) / (t1 - t0), k = u * u * (3 - 2 * u); o.push({ t: +t.toFixed(4), who: 'teo', pos, yaw: y0 + (y1 - y0) * k }); } o.push({ t: +t1.toFixed(4), who: 'teo', pos, yaw: y1 }); return o; };
const BACK = P([-0.45, 0, -0.9]);
const leapStands = (() => { const o = [], t0 = LEAP0, t1 = HIT + 0.06; for (let t = t0; t <= t1 + 1e-6; t += 1 / FPS) { const u = Math.min(1, (t - t0) / (t1 - t0)), k = u * u * (3 - 2 * u); o.push({ t: +t.toFixed(4), who: 'teo', pos: P([-0.45, 0.16 * Math.sin(Math.PI * u), -0.9 + 1.8 * k]), yaw: 0 }); } return o; })();
const stands = [
  { t: 0, who: 'teo', pos: P([-1.25, 0, 2.3]), yaw: 0 }, { t: 0, who: 'bip', mark: 'shop.stool_bip' }, { t: 0, who: 'lan', mark: 'shop.behind_counter' },
  { t: g60(s('p3')), who: 'teo', mark: 'shop.door_kick' },                                                   // the kick (cut)
  { t: g60(s('l4') - 0.1), who: 'teo', mark: 'shop.counter' }, { t: g60(s('l4') - 0.1), who: 'bip', mark: 'shop.stool_bip', yaw: 1.8 },   // inside: Tèo at the counter, Bíp turns to watch him
  { t: g60(s('l10') + 1.2), who: 'teo', mark: 'shop.safe_teo' },                                            // beside the safe
  { t: g60(s('l11') + 0.65), who: 'teo', pos: P([1.6, 0, -1.2]), yaw: Math.PI },                            // stepped back from the counter (her phone looks down at his feet)
  ...turnY(g60(s('p11') - 0.8), g60(s('p11') - 0.8) + 0.45, P([1.6, 0, -1.2]), Math.PI, 0),                 // he turns his back
  { t: g60(s('p11')), who: 'teo', pos: doorway, yaw: Math.PI },                                               // frozen in the doorway, turned INTO the shop (cut): inside cameras see his face
  { t: g60(s('l16') + 1.05), who: 'teo', mark: 'shop.counter' },                                              // back at the counter (cut)
  { t: g60(s('p24')), who: 'teo', pos: BACK, yaw: -1.2 },                                                     // turned to Bíp (on his left)
  // 20/11: body yaw at the cuts where Tèo looks up at the star row. look 'up' aims at a FIXED world direction (behind him), so the head always swings to one side by the engine's clamp (54 deg); the side depends on the body yaw:
  // a yaw a little beyond pi flips it to the viewer's right (checked in stills). Changed only inside the shots (snapped at the cuts): TD p20, TC p23. NOT done for T34 (p21): there the flipped side shows only the back of the head (no yaw gives a visible face looking right), so he keeps look 'up' with the face seen turned to the viewer's left.
  ...[[g60(s('p20')), g60(s('l21')), Math.PI + 0.9]].flatMap(([a0, a1, y]) => [{ t: a0 - 1 / FPS, who: 'teo', pos: P([1.6, 0, -2.65]), yaw: Math.PI }, { t: a0, who: 'teo', pos: P([1.6, 0, -2.65]), yaw: y }, { t: a1 - 1 / FPS, who: 'teo', pos: P([1.6, 0, -2.65]), yaw: y }, { t: a1, who: 'teo', pos: P([1.6, 0, -2.65]), yaw: Math.PI }]),
  ...turnY(g60(s('p23') + 0.14), g60(s('p23') + 0.36), P([1.6, 0, -2.65]), Math.PI, Math.PI + 0.5), { t: g60(s('p23') + 0.65), who: 'teo', pos: P([1.6, 0, -2.65]), yaw: Math.PI },
  // 20/11 (fix 2): the whole body turns from the counter towards the door in 0.35 s from 54.20 (two2 sees his face 3/4, head to the lens side), and stays at that yaw through TB (the head goes out to the door with look 'bip') until p24
  ...turnY(g60(s('l24') - 0.56), g60(s('l24') - 0.56) + 0.35, P([1.6, 0, -2.65]), Math.PI, 2.2),
  { t: LEAP0 - 1 / FPS, who: 'teo', pos: BACK, yaw: 0 }, ...leapStands,
  { t: g60(s('p24')), who: 'bip', pos: P([-1.6, 0, -0.9]), yaw: 1.8 },                                         // Bíp steps off his stool (cut) to stand up
];

// ================================================================ acts
const A = [];
const a = (t, who, o, d) => A.push({ t, who, ...o, ...(d != null && o.d == null ? { d } : {}) });   // o.d (a look's length) wins over the blend time
const S = (t, f, d = 0.1, o = {}) => A.push({ t, who: 'set', fx: f, d, ...o });
a(-1, 'teo', { pose: 'hips', emo: 'smug', look: 'cam', d: 99 }, 0.01); a(-1, 'bip', { pose: 'rigid', emo: 'deadpan', look: 'cam', d: 99 }, 0.01); a(-1, 'lan', { pose: 'idle', emo: 'sleepy' }, 0.01);
// ---- 0-3 s: Lan yawns, scrolls (through the glass); Bíp turns his head (p1)
a(s('l1') + 0.8, 'lan', { pose: 'yawn', emo: 'sleepy' }); a(s('p1') - 0.2, 'lan', { pose: 'scroll', emo: 'neutral', look: 'down', d: 2 });
a(s('p1'), 'bip', { look: 'teo', d: 99 }); a(s('l2'), 'bip', { emo: 'deadpan', look: 'teo', d: 99 }); a(s('l2') + 0.5, 'bip', { nod: 'yes' });
a(s('l3'), 'teo', { pose: 'hips', emo: 'smug', look: 'bip', d: 99 }); a(s('l3') + 2.5, 'teo', { pose: 'point', emo: 'smug' });  // the stars
a(5.0, 'bip', { emo: 'side', look: 'teo', d: 99 });
// ---- p3: the kick (lunge on the spot), the door, the crack, the bell
a(s('p3') - 0.02, 'teo', { pose: 'hips', emo: 'angry', look: 'cam', d: 99 }); a(s('p3') - 0.02, 'teo', { fx: { splay: 1 }, d: 0.01 });
a(s('p3') + 0.38, 'teo', { fx: { lunge: 1 }, d: 0.1 }); a(s('p3') + 0.7, 'teo', { fx: { lunge: 0 }, d: 0.25 }, 0.25);
S(s('p3') + 0.46, { door: 0.55 }, 0.1); S(s('p3') + 0.56, { door: 0.12 }, 0.5); S(s('p3') + 0.46, { crack: 1, bell: 1 }, 0.1); S(s('p3') + 1.2, { bell: 0 }, 0.9);
a(g60(s('l4') - 0.1), 'teo', { fx: { splay: 0 }, d: 0.01 });
// ---- inside: l4 hips at the counter; p4 Lan goes live (the ring light, the phone up)
a(s('l4'), 'teo', { pose: 'hips', emo: 'smug', look: 'lan', d: 99 }); a(s('l4') + 0.01, 'teo', { nod: 'jolt' });
a(s('l4') - 0.2, 'lan', { pose: 'idle', emo: 'neutral', look: 'teo', d: 99 }); a(s('p4') + 0.1, 'lan', { emo: 'love' }); a(s('p4') + 0.2, 'lan', { pose: 'live' }); S(s('p4') + 0.15, { ring: 1 }, 0.5);
a(s('l5'), 'lan', { pose: 'live', emo: 'love', look: 'teo', d: 99 }); a(s('l5') + 1.3, 'teo', { emo: 'worry', look: 'lan', d: 99 }); a(s('l5') + 2.0, 'teo', { emo: 'smug' });
a(s('l6'), 'lan', { pose: 'push', emo: 'happy', look: 'teo', d: 99 }); S(s('l6') + 1.9, { cash: 1 }, 0.8); S(s('l6') + 2.0, { drawer: 1 }, 0.3);
a(s('l6') + 2.6, 'teo', { emo: 'shock', look: 'down', d: 1.0 });
a(s('p6'), 'lan', { pose: 'liveWave', emo: 'happy' }); a(s('p6') + 0.3, 'teo', { emo: 'smug', look: 'lan', d: 99 });
a(s('l7'), 'teo', { pose: 'cross', emo: 'smug', look: 'lan', d: 99 }); a(s('l7') + 0.02, 'teo', { nod: 'jolt' }); a(s('l7') + 0.9, 'teo', { nod: 'yes' });
a(s('l8'), 'bip', { emo: 'deadpan', look: 'teo', d: 99 }); a(s('l8') + 0.05, 'bip', { nod: 'jolt' });
a(s('p8') + 0.1, 'teo', { emo: 'worry', look: 'lan', d: 99 }); a(s('l9'), 'teo', { pose: 'hips', emo: 'smug', look: 'lan', d: 99 });
// ---- l10: the code, the safe pops open by itself (a keyed hinge), the cookie tin of thread
a(s('l10'), 'lan', { pose: 'live', emo: 'happy', look: 'teo', d: 99 }); S(s('l10') + 2.9, { safe: 1 }, 0.5); S(s('l10') + 3.5, { tinLid: 1 }, 0.6);
a(g60(s('l10') + 1.2), 'teo', { pose: 'keypad', emo: 'think', look: 'down', d: 99 }); a(g60(s('l10') + 2.9), 'teo', { pose: 'rest', emo: 'shock', look: 'down', d: 99 }); a(s('p10') + 0.2, 'teo', { emo: 'think' }); a(s('p10') + 0.5, 'teo', { emo: 'worry' });
// ---- l11: the phone drops to his feet: chữ bát (1 s) and he turns his back
a(s('l11'), 'lan', { pose: 'live', emo: 'love', look: 'teo', d: 99 });
a(g60(s('l11') + 0.65) - 0.01, 'teo', { pose: 'side', emo: 'shock', look: 'lan', d: 99 }); a(g60(s('l11') + 0.65) - 0.01, 'teo', { fx: { splay: 1 }, d: 0.01 });
a(s('p11') - 0.7, 'teo', { emo: 'worry', look: 'away', d: 1 }); a(g60(s('p11')), 'teo', { fx: { splay: 0 }, d: 0.01 });
// ---- p11: frozen in the doorway; mum's comment (a 2-D card, alone); l12 the scare
a(g60(s('p11')), 'teo', { pose: 'fists', emo: 'dread', look: 'cam', d: 99 }); a(s('l12'), 'teo', { emo: 'terror', look: 'cam', d: 99 }); a(s('l12') + 0.02, 'teo', { nod: 'jolt' }); a(s('l12') + 0.6, 'teo', { fx: { shiver: 0.6 }, d: 0.4 });
a(s('l13'), 'bip', { emo: 'deadpan', look: 'cam', d: 99 }); a(s('l15'), 'bip', { emo: 'deadpan', look: 'cam', d: 99 }); a(s('l15') + 0.1, 'bip', { nod: 'jolt' });
a(s('p15'), 'teo', { emo: 'dread', look: 'down', d: 99 });
// ---- l16-l19: mum on the phone, he pays (the roll goes back), "Dạ, năm phút nữa ạ."
a(g60(s('l16') + 1.05), 'teo', { pose: 'give', emo: 'worry', look: 'lan', d: 99 }); a(s('l17') - 0.05, 'teo', { emo: 'sad' }); S(s('l17'), { cash: 0 }, 0.5);
a(s('l16') - 0.2, 'lan', { pose: 'idle', emo: 'think', look: 'teo', d: 99 }); a(s('l19'), 'teo', { pose: 'side', emo: 'sad', look: 'down', d: 99 });
a(s('p19') + 0.05, 'teo', { look: 'up', d: 0.4 }); a(s('p19') + 0.2, 'lan', { pose: 'live', emo: 'love', look: 'teo', d: 99 });
a(s('l20'), 'lan', { emo: 'love' }); a(s('l20') + 0.9, 'teo', { emo: 'worry', look: 'up', d: 0.5 }); a(s('l20') + 1.5, 'teo', { emo: 'sad', look: 'down', d: 99 });
a(s('l21'), 'teo', { pose: 'cross', emo: 'smug', look: 'cam', d: 99 }); a(s('l21') + 0.02, 'teo', { nod: 'jolt' });
a(s('p21'), 'teo', { emo: 'deadpan', look: 'up', d: 99 });
a(s('l22'), 'bip', { emo: 'deadpan', look: 'cam', d: 99 }); a(s('l23'), 'bip', { emo: 'deadpan', look: 'teo', d: 99 }); a(s('l23') + 0.05, 'bip', { nod: 'yes' });
// ---- p23-p25: the hood sags, the chat floods, the loudspeaker, "Chạy.", the leap
a(s('p23') + 0.0, 'teo', { fx: { hoodDrop: 1 }, d: 0.6 }); a(s('p23') + 0.0, 'teo', { emo: 'sad', look: 'down', d: 99 });
a(s('p23') + 0.3, 'teo', { emo: 'worry' }); a(s('l24'), 'teo', { emo: 'dread', look: 'bip', d: 0.75 }); a(s('l24') + 0.75, 'teo', { emo: 'terror', look: 'cam', d: 99 }); a(s('l24') + 0.77, 'teo', { nod: 'jolt' }); a(s('l24') + 0.95, 'teo', { fx: { shiver: 0.8 }, d: 0.4 });
// 20/11: look 'bip' = the head turns out towards the door / window side (Bíp sits there); the head goes out to the door while the voice comes in, THEN the jolt (55.5 s) and the face back to us
a(g60(s('p24')), 'teo', { emo: 'dread', look: 'bip', d: 99 }); a(s('l25'), 'bip', { emo: 'deadpan', look: 'teo', d: 99 }); a(g60(s('p24')), 'bip', { fx: { stand: 1 } }, 0.4);
// ---- 20/11 (owner): Tèo LOOKS UP at the star row (upper right of the frame) while a star lights; `look: 'up'` is the only upward gaze the engine has, and with Tèo facing the lens it turns the head to the viewer's right
// (checked in stills); then at the siren he turns his head OUT to the door (look 'bip': Bíp sits on the window side) 0.56 s before l24, holds it through the voice, jolts at l24. Appended last so they win over the d:99 looks above.
a(s('p20') - 0.2, 'teo', { look: 'up', d: s('l21') - s('p20') + 0.2 });                 // 47.42 -> 48.52: the star fills (47.62-48.22), pops, the label drops
a(s('p20') - 0.2, 'teo', { emo: 'worry' }); a(s('p20') + 0.7, 'teo', { emo: 'dread' });
a(s('p23') + 0.3, 'teo', { look: 'up', d: 0.64 });                                      // 53.56 -> 54.20: two more stars pop at 53.76 / 53.92
a(g60(s('l24') - 0.56), 'teo', { emo: 'dread', look: 'cam', d: 0.56 });                // 54.20 -> 56.26: the head turns out to the door (seen from behind in two2), the siren swells, the voice comes in (the l24 acts above take over at 55.51)
a(LEAP0 - 0.01, 'teo', { pose: 'dash', emo: 'scream', look: 'cam', d: 99 });   // a DASH, not a cheer: leaning forward, one knee up (lunge), one arm swung forward, one back; face turned to us, mouth open
a(LEAP0 - 0.01, 'teo', { fx: { lunge: 1, wind: 1.3 }, d: 0.12 });                     // the hood stays DOWN (from p23 to the end) and his hair blows back
S(HIT - 0.42, { shatter: 1 }, 0.9, { ease: 'lin' });
A.push({ t: LEAP0, who: 'cam', fx: { shake: 0.9 }, d: 0.2 }, { t: HIT - 0.05, who: 'cam', fx: { punch: 1 }, d: 0.06 }, { t: HIT + 0.08, who: 'cam', fx: { punch: 0 }, d: 0.3 }, { t: HIT + 0.1, who: 'cam', fx: { shake: 0 }, d: 0.3 });

// ================================================================ text on the picture (2-D layers; the order = the draw order, captions last)
const P4 = s('p4'), FL0 = s('p23') + 0.65;
const overlays = [
  policeSweep({ t0: s('p23') + 0.7, t1: DUR - 0.05 }),
  hud({ t0: 0, boot: -0.6, t1: DUR - 0.01, exactCarry: true,
    money: [[0, -10e6], [s('p6') + 0.1, -9.66e6, { roll: 0.6 }], [s('l17'), -10e6, { roll: 0.5, tick: true }], [s('l20') + 1.7, -10.2e6, { roll: 0.6 }]],
    starMax: 6, stars: [[0, 0]], loadStar: { t0: s('p20'), t1: s('p20') + 0.6, label: 'MẸ ĐÃ XEM', idx: 0, then: 2, thenAt: s('p23') + 0.5 },
    starFocus: [[s('p20') - 0.17, s('p20') + 1.35], [s('p23') + 0.24, s('p23') + 1.49]] }),   // 20/11: the row blows up 1.6x with a gold halo at each increase (47.45-48.97, 53.50-54.75)
  hookPlate({ t0: 0, t1: 4.05, title: 'TÈO CƯỚP TẠP HOÁ?', accent: 'TẠP HOÁ?', sub: 'GTA 6 Việt hoá · P2' }),
  nameTag({ t0: 4.1, t1: 5.75, who: 'lan', text: 'CHỊ LAN' }),
  { kind: 'draw', t0: 6.5, t1: s('p3'), fade: 0.1, noText: true, fn: (ctx, t) => { const k = 0.5 + 0.5 * Math.sin((t - 6.5) * 9); ctx.save(); ctx.strokeStyle = `rgba(255,196,58,${(0.35 + 0.6 * k).toFixed(2)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(732, 246, 288, 64, 30); ctx.stroke(); ctx.restore(); } },   // "không có sao": the empty star row pulses
  liveFrame({ t0: s('p4') + 0.2, t1: DUR - 0.05,
    viewers: [[0, 3], [s('l5') + 2.0, 1200, { roll: 0.6 }], [s('l20') + 0.5, 2400, { roll: 0.6 }], [FL0, 10000, { roll: 0.8 }]],
    chat: [{ t: s('l5') + 0.5, text: null }, { t: s('l5') + 1.2, text: '+1', name: 'minh_anh' }, { t: s('l5') + 1.9, text: 'chốt', name: 'bao.tran' }, { t: s('l6') + 0.4, text: null }, { t: s('l6') + 1.2, text: '+1', name: 'ngoc94' },
      { t: s('l6') + 2.3, text: 'chốt', name: 'tuan_hn' }, { t: s('p10') + 0.1, text: null }, { t: s('p10') + 0.4, text: 'ha', name: 'linh.le' }, { t: s('l11') + 0.4, text: null },
      { t: s('l20') + 0.2, text: 'chốt', name: 'bao.tran' }, { t: s('l20') + 0.9, text: '+1', name: 'minh_anh' }, { t: s('l20') + 1.6, text: null }],
    hearts: [[s('l5') + 0.3, s('l11') + 0.6, 2.6], [s('l20'), s('p21') - 0.2, 2.4]], quiet: [[s('p11') - 0.0, s('p11') + 5.2], [e('l16') - 0.6, s('l20') - 0.3]],
    flood: [{ t0: FL0 + 0.25, t1: s('l24'), text: 'BÁO CÔNG AN RỒI', perSec: 9 }], freeze: [{ at: s('l24'), until: e('l24') + 0.45 }] }),
  liveComment({ t0: s('p11') + 0.12, t1: s('p11') + 5.1, name: 'Mẹ Tèo', text: 'Đi chân chữ bát thế kia… chỉ có con tao.', type: 0.4 }),
  liveChip({ t0: s('p15') + 0.05, t1: DUR - 0.05, name: 'Mẹ Tèo', text: 'đang xem' }),
  exitButton({ t0: s('p15'), slamAt: s('p15') + 0.08, t1: DUR - 0.05, flash: [{ t0: s('p15') + 0.18, t1: s('p15') + 2.9, text: 'MẸ GỌI: ƯU TIÊN' }] }),
  liveFollow({ t0: LEAP0 + 0.02, t1: DUR - 0.05, text: 'THEO DÕI', y: 1450, pressAt: HIT - 0.12 }),
  stampCard({ t0: HIT - 0.32, t1: DUR - 0.05, y: 1185 }),
];
const hits = [{ t: HIT, frames: Math.round((DUR - HIT) * FPS) }];   // the freeze lasts to the end of the film (the stamp and THEO DÕI are on it)

export default {
  id: 'gta6p2', pack: 'trada', set: 'gta', fps: FPS, dur: DUR, cast: ['teo', 'bip', 'lan'],
  lipsFile: 'episodes/gta6p2_lips.json',
  castOpts: { teo: { gta: true, stand: 1, hood: true }, bip: { glass: true } },
  partners: { teo: 'lan', lan: 'teo', bip: 'teo' },
  setOpts: { shop: { stoolIn: true }, places: [{ t: 0, place: 'shop' }],
    focus: [{ t: 0, at: P([-0.3, 1.2, 2.2]) }, { t: g60(s('p3')) - 0.01, at: P([-0.3, 1.2, 2.2]) }, { t: g60(s('p3')), at: P([-0.5, 1.1, 1.0]) }, { t: g60(s('l4') - 0.1) - 0.01, at: P([-0.5, 1.1, 1.0]) }, { t: g60(s('l4') - 0.1), at: P([1.6, 1.2, -3.0]) }, { t: g60(s('p11') + 1.6) - 0.01, at: P([1.6, 1.2, -3.0]) },
      { t: g60(s('p11') + 1.6), at: P([-0.45, 1.2, 0.6]) }, { t: g60(s('l16') + 1.05) - 0.01, at: P([-0.45, 1.2, 0.6]) }, { t: g60(s('l16') + 1.05), at: P([1.6, 1.2, -3.0]) }, { t: g60(s('l24')) - 0.01, at: P([1.6, 1.2, -3.0]) }, { t: g60(s('l24')), at: P([-0.45, 1.2, 0.6]) }],
    stands },
  shots, lines, acts: A, overlays, hits,
  poses: { teo: { dash: { l: [-0.36, 0.86, 0.42], r: [0.34, 0.74, -0.18], lean: 0.4, pitch: 0.34 } } },
  waive: [{ check: 'smooth', t0: 12.9, t1: 59.2, reason: 'từ lúc bật livestream (tim bay, chat, số người xem đổi từng khung) tới hết: the owner 20/11 xem bản 60 fps và duyệt ("Ok đấy."). smooth.py trượt riêng luật trung bình 0,166 > 0,12 (bản engine thuần cùng tập cũng trượt, 0,143: tim live, chat, đèn công an, nền Blender nhiều chi tiết); đo KHÔNG waiver: 0 khung trùng, nhảy max 5,85 < 6,0, cửa sổ 1 s xấu nhất 0,553 < 0,6' },
    { check: 'clip.slide', t0: 7.7, t1: 8.1, reason: 'the door kick: the lunge pose moves one foot forward on the spot on purpose (an authored move, not a gait)' },
    { check: 'clip.slide', t0: 28.3, t1: 29.0, reason: 'the turn on the spot (he turns his back showing the chữ bát feet): the feet pivot with the body by design' },
    { check: 'clip.ground', t0: 57.2, t1: DUR, reason: 'the leap through the glass: he is airborne on purpose, and the picture freezes on him to the end of the film' },
    { check: 'read_time', t0: HIT - 0.4, t1: DUR, reason: 'the CÒN TIẾP card is the series stinger of a cliffhanger: the driver\'s tail is <= 2 s after the last line (p25 = 1.9 s) and the stamp lands with the freeze, so its 27 characters cannot get 3.25 s; it is a title card, not information (the same words are in the caption of the next episode)' }],
};
