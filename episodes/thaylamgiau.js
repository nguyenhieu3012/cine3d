// Trà đá với AI · "Thầy Dạy Làm Giàu 4.0" (cine3d, 30 fps, rules 2, look2 + facePlus + act2)
// Style: 2 characters talking below at the Hanoi iced tea stall, vivid animated 2-D "Imagine Diagram" floating above (episodes/thaylamgiau_props.js).
// Minimal text, lively animated illustrations, sharp social satire for 24-34 VN audience.
import T from './thaylamgiau.times.js';
import B from './thaylamgiau.beats.json' with { type: 'json' };
import { makeDiagram } from './thaylamgiau_props.js';

const s = (id) => T.lines[id].t0, e = (id) => T.lines[id].t1, DUR = T.dur;
const DIAG = makeDiagram(T);

// ---- face & pose per spoken line (strictly aligned with beats.json mood for QA face_mood) ----
const LOOK = {
  b1:  { emo: 'smug',    pose: 'phone' },   // "Tao sắp thành triệu phú!"
  b2:  { emo: 'deadpan', pose: 'rest'  },   // "Nợ trà đá xong chưa?"
  b3:  { emo: 'smug',    pose: 'raise' },   // "Tầm nhìn nhỏ! Xe thầy đấy!"
  b4:  { emo: 'deadpan', pose: 'cross' },   // "Bốn thầy chung con xe."
  b5:  { emo: 'worry',   pose: 'phone' },   // "Thì… thầy có biệt thự!"
  b6:  { emo: 'neutral', pose: 'point' },   // "Thuê theo giờ. Ba trăm rưỡi."
  b7:  { emo: 'worry',   pose: 'raise' },   // "Ít ra bí kíp thầy xịn!"
  b8:  { emo: 'deadpan', pose: 'cross' },   // "Mẹ mày dặn miễn phí."
  b9:  { emo: 'angry',   pose: 'point' },   // "Thế hai tỷ thầy khoe đâu?!"
  b10: { emo: 'deadpan', pose: 'point' },   // "Hai trăm đứa như mày."
  b11: { emo: 'angry',   pose: 'head'  },   // "Cay thật! Bọn lùa gà!"
  b12: { emo: 'smug',    pose: 'raise' },   // "Tao mở khóa… chống lùa gà!"
  b13: { emo: 'deadpan', pose: 'chin'  },   // "Thuê xe mấy tiếng?"
  b14: { emo: 'smug',    pose: 'phone' },   // "Nửa tiếng chụp ảnh thôi!"
};

const lines = B.beats
  .filter((b) => b.text)
  .map((b) => ({ id: b.id, who: b.who, t0: s(b.id), t1: e(b.id), text: b.text, ...(LOOK[b.id] || {}) }));

// ---- shots: heads sit cleanly below diagram (y ~ 54-57%) AND mouth stays above caption band (y < 1260) ----
// First 3s has 3 distinct framings (two -> cu_teo_lo -> cu_bip); first 12s has 6 shots (avg 2.0s, inside 1.8-2.4s!).
const shots = [];
const cut = (t1, cam, o = {}) => {
  const t0 = shots.length ? shots[shots.length - 1].t1 : 0;
  shots.push({ t0, t1: Math.min(t1, DUR), cam, ...o });
};
const RIG_TWO = { eye: 0.565, head: 0.155 };
const RIG_MS  = { eye: 0.54,  head: 0.165 };
const RIG_CU  = { eye: 0.54,  head: 0.205 };

cut(0.85,         'two',       { move: 'push', amt: 0.5, rig: RIG_TWO });                           // 0: 0.00..0.85  two-shot opener + hook
cut(e('b1'),      'cu_teo_lo', { move: 'push', amt: 0.7, rig: RIG_CU, eyes: { teo: 'cam' } });     // 1: 0.85..2.04  Tèo flexing ("triệu phú")
cut(e('b2'),      'cu_bip',    { move: 'none', rig: RIG_CU });                                      // 2: 2.04..4.12  Bíp deadpan ("Nợ trà đá xong chưa?")
cut(e('b3'),      'ms_teo',    { move: 'push', amt: 0.6, rig: RIG_MS });                            // 3: 4.12..6.27  "Xe thầy đấy!"
cut(e('b4'),      'two',       { move: 'push', amt: 0.4, rig: RIG_TWO });                           // 4: 6.27..9.11  Node 1 pops (4 gurus / 1 Porsche) + Bíp
cut(e('b5'),      'ms_teo_hi', { move: 'push', amt: 0.5, rig: RIG_MS });                            // 5: 9.11..11.07 "Thì… thầy có biệt thự!"
cut(e('b6'),      'ms_bip',    { move: 'push', amt: 0.5, rig: RIG_MS });                            // 6: 11.07..14.16 Villa 350k/h + Bíp "Ba trăm rưỡi."
cut(e('b7'),      'cu_teo',    { move: 'push', amt: 0.6, rig: RIG_CU });                            // 7: 14.16..16.31 "Ít ra bí kíp thầy xịn!"
cut(e('p_pdf'),   'two',       { move: 'none', rig: RIG_TWO });                                     // 8: 16.31..17.06 Node 2 open book 05:00
cut(e('b8'),      'cu_bip_lo', { move: 'push', amt: 0.6, rig: RIG_CU, punchAt: s('b8') + 0.15 });   // 9: 17.06..19.30 "Mẹ mày dặn miễn phí." + 0Đ stamp
cut(e('b9'),      'ms_teo_lo', { move: 'push', amt: 0.8, rig: RIG_MS });                            // 10: 19.30..21.43 "Thế hai tỷ thầy khoe đâu?!"
cut(e('p_dip'),   'two',       { move: 'push', amt: 0.4, rig: RIG_TWO });                           // 11: 21.43..22.28 Node 3 (200 Zoom -> 1,98 tỷ)
cut(e('b10'),     'cu_bip',    { move: 'push', amt: 0.7, rig: RIG_CU, punchAt: s('b10') + 0.1 });   // 12: 22.28..24.18 "Hai trăm đứa như mày."
cut(e('p_freeze'),'cu_teo_hi', { move: 'push', amt: 0.5, rig: RIG_CU });                            // 13: 24.18..25.08 Tèo freezes -> eyes gleam!
cut(e('b11'),     'ms_teo',    { move: 'none', rig: RIG_MS });                                      // 14: 25.08..27.06 "Cay thật! Bọn lùa gà!"
cut(e('b12'),     'cu_teo_lo', { move: 'push', amt: 0.7, rig: RIG_CU, punchAt: s('b12') + 0.2 });   // 15: 27.06..29.47 "Tao mở khóa… chống lùa gà!"
cut(e('p_note'),  'two',       { move: 'none', rig: RIG_TWO });                                     // 16: 29.47..30.05 Node 4 red loop -> Porsche 30 phút
cut(e('b13'),     'cu_bip',    { move: 'none', rig: RIG_CU });                                      // 17: 30.05..31.84 "Thuê xe mấy tiếng?"
cut(DUR,          'two',       { move: 'pull', amt: 0.4, rig: RIG_TWO });                           // 18: 31.84..34.42 "Nửa tiếng chụp ảnh thôi!" + full loop

// ---- acts: expressive looks up at the floating diagram & partner reactions ----
const acts = [
  { t: -1, who: 'set', fx: { phoneUp: 1 }, d: 0.01 },
  { t: -1, who: 'teo', emo: 'smug', pose: 'phone' },
  { t: -1, who: 'bip', emo: 'deadpan', pose: 'rest' },
  { t: s('b2'), who: 'teo', emo: 'worry', nod: 'jolt' },
  { t: s('p_plate'), who: 'teo', emo: 'shock', look: 'up', d: 0.9 },
  { t: s('p_plate'), who: 'bip', emo: 'scan', look: 'up', d: 0.9 },
  { t: s('b4') + 0.15, who: 'bip', look: 'partner', d: 0.8 },
  { t: s('p_villa'), who: 'teo', emo: 'shock', look: 'up', d: 0.9 },
  { t: s('p_villa'), who: 'bip', emo: 'scan', look: 'up', d: 0.9 },
  { t: s('p_pdf'), who: 'teo', emo: 'worry', look: 'up', d: 0.9 },
  { t: s('p_pdf'), who: 'bip', emo: 'scan', look: 'up', d: 0.8 },
  { t: s('b8') + 0.2, who: 'teo', emo: 'shock', nod: 'jolt' },
  { t: s('p_dip') - 0.05, who: 'set', fx: { dim: 0.35 }, d: 0.5 },
  { t: s('p_dip'), who: 'teo', emo: 'shock', look: 'up', d: 1.5 },
  { t: s('p_dip'), who: 'bip', emo: 'scan', look: 'up', d: 1.0 },
  { t: s('p_freeze'), who: 'teo', emo: 'shock', look: 'up', d: 0.55 },
  { t: s('p_freeze') + 0.55, who: 'teo', emo: 'smug', nod: 'yes' },
  { t: s('b12') - 0.05, who: 'set', fx: { dim: 0 }, d: 0.4 },
  { t: s('p_note'), who: 'teo', emo: 'smug', pose: 'phone', look: 'up', d: 0.9 },
  { t: s('p_note'), who: 'bip', emo: 'deadpan', look: 'up', d: 0.9 },
  { t: s('b13'), who: 'bip', look: 'partner', d: 1.2 },
  { t: s('b14'), who: 'teo', emo: 'smug', pose: 'phone', look: 'partner', d: 1.5 },
];

const overlays = [
  { kind: 'hook', t0: 0, t1: 2.1, text: ['THẦY GIÀU', 'THẬT KHÔNG?'], y: 342 },
  { kind: 'draw', t0: 0, t1: DUR, fade: 0.01, reads: DIAG.reads, fn: (ctx, t) => DIAG.draw(ctx, t) },
];

export default {
  id: 'thaylamgiau',
  pack: 'trada',
  set: 'stall',
  rules: 2,
  mode: 'comedy',
  fps: 30,
  dur: DUR,
  look2: true,
  act2: true,
  facePlus: true,
  cast: ['teo', 'bip'],
  setOpts: { phone: true, plus: true, menuBrand: true },
  partners: { teo: 'bip', bip: 'teo' },
  captions: { y: 1380, accent: '#ffe45a' },
  times: T,
  shots,
  lines,
  acts,
  overlays,
};
