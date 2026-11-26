// Trà đá với AI · "Thùng đồ quê: 0 đồng?" (`giacomme`, cine3d v3.0, mode: emotional, rules: 2)
// Built on Gemini Studio v3.0: 0-token scaffold -> polished declarative 2D presentation (~150 lines, zero 600-line canvas props!).
// Showcases: `boardOverlay` (compare stack + flow invoice audit), Gemini cutout stickers (`money_bag`, `mom_meal`, `mom_box`),
// Vox 12fps stutter + `highlighter`, `setswapBackdrop` (`mom_kitchen`), `callCard` (outgoing red button), `look2 + act2 + facePlus`.
import T from './giacomme.times.js';
import B from './giacomme.beats.json' with { type: 'json' };
import { makeKit, v2Defaults, v2Hook, diagramRig, boardOverlay, setswapBackdrop } from '../core/ep_kit.js';

const K = makeKit(T, B);
const { s, e } = K;
const RIG = diagramRig();

// Faces & poses strictly aligned with beats.json mood + TEO_FACE / BIP_FACE
const lookMap = {
  b1:  { emo: 'angry',   pose: 'phone'    }, // "Cơm quán chém đẹp thật!"
  b2:  { emo: 'deadpan', pose: 'point'    }, // "Đĩa trắng trơn. Chê cái gì."
  b3:  { emo: 'angry',   pose: 'raise'    }, // "Trăm hai mà bé bằng nắm tay!"
  b4:  { emo: 'smug',    pose: 'me'       }, // "May mẹ gửi đồ quê. Chả mất đồng nào!"
  b4b: { emo: 'deadpan', pose: 'table'    }, // "Thùng còn nguyên. Vẫn ăn ngoài."
  b4c: { emo: 'smug',    pose: 'shrug'    }, // "Ơ… cá kho để mai hâm mới đượm!"
  b5:  { emo: 'neutral', pose: 'cross'    }, // "Mày tính thiếu dòng rồi."
  b5b: { emo: 'smug',    pose: 'shrug'    }, // "Thiếu gì? Đồ nhà làm hết mà."
  b5c: { emo: 'neutral', pose: 'point'    }, // "Đưa máy. Tao soi hóa đơn."
  b6:  { emo: 'love',    pose: 'point'    }, // "Ảnh chợ. Năm giờ sáng."
  b7:  { emo: 'worry',   pose: 'chin'     }, // "Ơ… mẹ bảo tiện đi chợ mà."
  b8:  { emo: 'love',    pose: 'table'    }, // "Gần chín giờ. Vẫn canh bếp."
  b9:  { emo: 'sad',     pose: 'point'    }, // "Tem xe khách. Giữa nắng trưa."
  b10: { emo: 'love',    pose: 'rest'     }, // "Đúng không đồng."
  b11: { emo: 'love',    pose: 'rest'     }, // "Mẹ trả từ sáng."
  b12: { emo: 'moved',   pose: 'phoneEar' }, // "Alo mẹ ạ… con lấy cá rồi. Cuối tuần con về ạ."
  b13: { emo: 'love',    pose: 'cup'      }, // "Rò nước."
};

// All cuts dynamically anchored to beat timings K.s / K.e -> auto-syncs when ElevenLabs real times arrive!
// First 3s has 3 distinct framings (cu_teo -> two -> cu_bip); first 12s has 6 shots (~2.0s avg).
const shots = K.shots()
  .cut(1.05,         'cu_teo',    { move: 'push', amt: 0.65, eyes: { teo: 'cam' } })
  .cutEnd('b1',      'two',       { move: 'push', amt: 0.45 })
  .cutEnd('b2',      'cu_bip',    { move: 'none' })
  .cutEnd('b3',      'ms_teo',    { move: 'push', amt: 0.55 })
  .cutEnd('b4',      'two',       { move: 'push', amt: 0.45, rig: RIG.two })
  .cut(Math.max(e('b4b'), 12.05), 'ms_bip', { move: 'push', amt: 0.45, rig: RIG.ms })
  .cutEnd('b4c',     'ms_teo',    { move: 'none', rig: RIG.ms })
  .cutEnd('p_stamp', 'two',       { move: 'push', amt: 0.50, rig: RIG.two, punchAt: s('p_stamp') + 0.14 })
  .cutEnd('b5',      'cu_bip',    { move: 'push', amt: 0.50, rig: RIG.cu })
  .cutEnd('b5b',     'ms_teo',    { move: 'none', rig: RIG.ms })
  .cutEnd('b5c',     'two',       { move: 'push', amt: 0.40 })
  .cutEnd('p_kitchen', 'wide',    { move: 'push', amt: 0.45 })
  .cutEnd('b6',      'ms_bip',    { move: 'push', amt: 0.40, rig: RIG.ms })
  .cutEnd('b7',      'cu_teo_hi', { move: 'push', amt: 0.45, rig: RIG.cu })
  .cutEnd('b8',      'two',       { move: 'push', amt: 0.35, rig: RIG.two })
  .cutEnd('b9',      'ms_bip',    { move: 'push', amt: 0.40, rig: RIG.ms })
  .cutEnd('p_dip',   'two',       { move: 'none', rig: RIG.two })
  .cutEnd('p_note',  'cu_teo_hi', { move: 'push', amt: 0.35, rig: RIG.cu })
  .cutEnd('b10',     'ms_bip',    { move: 'none', rig: RIG.ms })
  .cutEnd('b11',     'two',       { move: 'push', amt: 0.45 })
  .cutEnd('p_call',  'cu_teo',    { move: 'push', amt: 0.40 })
  .cutEnd('b12',     'ms_teo',    { move: 'push', amt: 0.40, hold: true })
  .fill(             'two',       { move: 'pull', amt: 0.35, hold: true })
  .list();

const acts = K.acts()
  .init('set', { fx: { phoneUp: 1 } })
  .init('teo', { emo: 'angry', pose: 'phone' })
  .init('bip', { emo: 'neutral', pose: 'rest' })
  .atStart('b2',      'teo', { emo: 'worry', nod: 'jolt' })
  .atStart('b4',      'teo', { emo: 'smug', pose: 'me', look: 'up' })
  .atStart('b4',      'bip', { emo: 'deadpan', look: 'up' })
  .atStart('p_stamp', 'teo', { emo: 'shock', look: 'up', nod: 'jolt' })
  .atStart('b5',      'teo', { emo: 'worry', look: 'partner' })
  .atStart('b5c',     'set', { fx: { dim: 0.25 } })
  .atStart('b6',      'teo', { emo: 'think', look: 'up' })
  .atStart('b6',      'bip', { emo: 'love', pose: 'point', look: 'up' })
  .atStart('b7',      'teo', { emo: 'worry', pose: 'chin', look: 'down' })
  .atStart('b8',      'teo', { emo: 'sad', look: 'up' })
  .atStart('b9',      'teo', { emo: 'sad', pose: 'head', look: 'up' })
  .atStart('p_note',  'teo', { emo: 'moved', pose: 'rest', look: 'up' })
  .atStart('b10',     'bip', { emo: 'love', look: 'partner' })
  .atStart('b11',     'teo', { emo: 'moved', look: 'down' })
  .atStart('p_call',  'teo', { emo: 'moved', pose: 'phone', look: 'down' })
  .atStart('b12',     'teo', { emo: 'moved', pose: 'phoneEar', look: 'partner' })
  .atStart('b13',     'bip', { emo: 'love', pose: 'cup', look: 'partner', nod: 'yes' })
  .list();

const overlays = [
  // 0-2.15s: Two-tier hook (5 words, 0 overlap with b1)
  v2Hook('THÙNG ĐỒ QUÊ: 0 ĐỒNG?'),

  // Act 1 (b4..b5c): Vertical-first 9:16 Compare Board (Vox 12fps + Gemini stickers + SAI GIÁ stamp)
  boardOverlay({
    layout: 'compare',
    stack: true,
    t0: s('b4'),
    t1: s('b5c') - 0.08,
    title: 'SO SÁNH HÓA ĐƠN',
    left: {
      label: 'CƠM PHỐ 120K',
      color: '#e63946',
      sticker: 'money_bag',
      rows: [
        { t: s('b4'), text: 'Đĩa ăn sạch bóng' },
        { t: s('b4b'), text: 'Vẫn bỏ thùng ăn ngoài' },
      ],
    },
    right: {
      label: 'ĐỒ QUÊ 0Đ',
      color: '#22a699',
      sticker: 'mom_meal',
      rows: [
        { t: s('b4') + 0.35, text: 'Cá kho · Rau sạch' },
        { t: s('b4c'), text: 'Thùng nguyên băng dính' },
      ],
    },
    verdict: { at: s('p_stamp') + 0.12, text: 'SAI GIÁ', sub: 'THIẾU DÒNG', color: '#d62828' },
  }),

  // Act 2 -> End: Warm 2D painted Vietnamese kitchen behind live 3D cast
  setswapBackdrop({
    t0: s('p_kitchen'),
    t1: K.dur,
    backdrop: 'mom_kitchen',
    fade: 0.65,
    kenBurns: 0.06,
    dim: 0.14,
    vignette: 0.38,
  }),

  // Act 2 (b6..p_dip): 3-step Invoice Audit Flow (Zalo timestamps + Gemini stickers, non-redundant labels)
  boardOverlay({
    layout: 'flow',
    style: 'dark',
    thoughtDots: false,
    t0: s('b6'),
    t1: s('p_dip') - 0.05,
    title: 'HÓA ĐƠN MẸ KHÔNG GHI',
    steps: [
      { t: s('b6'), badge: 'ZALO #1', hero: '05:12', caption: '05:12 · CHỢ SỚM', accent: '#ffb703' },
      { t: s('b8'), badge: 'ZALO #2', sticker: 'mom_meal', caption: '08:50 · KHO 2 LỬA', accent: '#22a699' },
      { t: s('b9'), badge: 'TEM XE',  sticker: 'mom_box',  caption: '11:35 · NẮNG 38°C', accent: '#e63946' },
    ],
  }),

  // Climax (p_note..b10): Bus receipt chip + Vox Highlighter on Mẹ's handwritten note (>= 2.05s hold!)
  { kind: 'pill', t0: s('p_dip'), t1: e('b10'), text: 'CUỐNG VÉ · CƯỚC 50K ĐÃ TRẢ', y: 258 },
  {
    kind: 'highlighter',
    t0: s('p_note'),
    t1: e('b10'),
    text: 'Cước xe mẹ trả rồi. Đừng ăn ngoài.',
    y: 410,
    highlightAt: s('p_note') + 0.55,
    color: 'rgba(255,228,90,0.88)',
  },

  // Payoff (p_call..b12): Outgoing callCard (red hang-up button ONLY, zero CTA / zero bar10k)
  {
    kind: 'callCard',
    t0: s('p_call'),
    t1: e('b12'),
    mode: 'outgoing',
    name: 'Mẹ ❤️',
    avatar: 'mum',
    y: 335,
  },
];

export default v2Defaults({
  id: 'giacomme',
  mode: 'emotional',
  dur: K.dur,
  // lipsFile: './giacomme_lips.json', // auto-generated by build_check.py once ElevenLabs voice is recorded
  shots,
  lines: K.lines(lookMap),
  acts,
  overlays,
});
