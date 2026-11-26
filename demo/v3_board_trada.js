// cine3d v3.0 Demo — Trà đá với AI: Declarative 2D Diagrams + Gemini Cutout Stickers + Illustrated Backdrop.
// ~85 lines total (vs 630+ lines of hand-coded Canvas 2D in legacy *_props.js!).
// Demonstrates: `board` (flow + corkboard), Vox 12fps stutter, cutout stickers, `highlighter`, `setswapBackdrop`, `diagramRig`.
import { v2Defaults, v2Hook, diagramRig, boardOverlay, setswapBackdrop } from '../core/ep_kit.js';

const RIG = diagramRig();

export default v2Defaults({
  id: 'v3_board_trada',
  mode: 'wildcard',
  dur: 12.0,
  shots: [
    { t0: 0.0, t1: 1.05, cam: 'cu_teo', move: 'push' },
    { t0: 1.05, t1: 2.15, cam: 'two', move: 'push' },
    { t0: 2.15, t1: 4.3, cam: 'ms_bip', move: 'push', rig: RIG },
    { t0: 4.3, t1: 6.5, cam: 'two', move: 'push', rig: RIG },
    { t0: 6.5, t1: 8.6, cam: 'ms_teo', move: 'none', rig: RIG },
    { t0: 8.6, t1: 9.6, cam: 'cu_bip', move: 'push', rig: RIG },
    { t0: 9.6, t1: 12.0, cam: 'two', move: 'push' },
  ],
  lines: [
    { id: 'l1', who: 'teo', t0: 0.2, t1: 2.0, text: 'Thầy tao đi siêu xe đấy!', emo: 'smug' },
    { id: 'l2', who: 'bip', t0: 2.3, t1: 4.1, text: 'Thuê xe, thuê nhà, bán PDF.', emo: 'neutral' },
    { id: 'l3', who: 'bip', t0: 4.5, t1: 6.3, text: 'Hai trăm học viên là hai tỷ.', emo: 'smug' },
    { id: 'l4', who: 'teo', t0: 6.7, t1: 8.5, text: 'Khoan… sao có mặt tao trong đó?', emo: 'shock' },
    { id: 'l5', who: 'bip', t0: 9.8, t1: 11.4, text: 'Thôi về ăn cơm mẹ nấu.', emo: 'moved' },
  ],
  acts: [
    { t: -1, who: 'teo', d: 0.01, emo: 'smug', pose: 'phone' },
    { t: -1, who: 'bip', d: 0.01, emo: 'neutral', pose: 'table' },
    { t: 2.25, who: 'teo', emo: 'think', look: 'up' },
    { t: 2.25, who: 'bip', emo: 'neutral', pose: 'point', look: 'up' },
    { t: 6.65, who: 'teo', emo: 'shock', pose: 'head', look: 'up', nod: 'jolt' },
    { t: 9.6, who: 'teo', emo: 'moved', pose: 'rest', look: 'partner' },
    { t: 9.6, who: 'bip', emo: 'happy', pose: 'cup', look: 'partner' },
  ],
  overlays: [
    v2Hook('THẦY GIÀU THẬT KHÔNG?'),
    // Layout 1: Declarative 3-step Flow + Loop (Vox 12fps + Gemini stickers)
    boardOverlay({
      layout: 'flow',
      t0: 2.2,
      t1: 6.45,
      title: 'CÔNG THỨC THẦY LÀM GIÀU',
      steps: [
        { t: 2.3, caption: 'XE THUÊ 4TR', sub: 'B1', sticker: 'sports_car' },
        { t: 3.1, caption: 'VILLA 350K/H', sub: 'B2', sticker: 'villa' },
        { t: 4.0, caption: 'SÁCH RỖNG 0Đ', sub: 'B3', sticker: 'guru_book', stamp: { at: 4.5, text: 'CHỐT 2 TỶ' } },
      ],
      loop: { at: 5.0, label: 'VÒNG LẶP F2' },
    }),
    // Layout 4: Detective Corkboard with red strings + magnifying glass
    boardOverlay({
      layout: 'corkboard',
      t0: 6.55,
      t1: 9.5,
      title: 'HỒ SƠ BÓC PHỐT',
      pins: [
        { id: 'a', t: 6.6, x: 0.26, y: 0.34, title: 'MỒI THUÊ', sticker: 'sports_car' },
        { id: 'b', t: 7.1, x: 0.74, y: 0.34, title: 'CHỐT ĐƠN', sticker: 'scam_phone' },
        { id: 'c', t: 7.7, x: 0.5, y: 0.76, title: 'TÈO ĐÓNG 9,9TR', sticker: 'money_bag', highlight: true, highlightAt: 8.1 },
      ],
      links: [
        { from: 'a', to: 'b', t: 7.25 },
        { from: 'b', to: 'c', t: 7.9, label: 'LÙA GÀ' },
      ],
      magnify: { targetId: 'c', at: 8.3 },
    }),
    // Emotional Gemini 2D painted backdrop behind live 3D cast + sticker + Vox highlighter
    setswapBackdrop({ t0: 9.6, t1: 12.0, backdrop: 'mom_kitchen', fade: 0.4, kenBurns: 0.06 }),
    { kind: 'sticker', t0: 9.8, t1: 11.8, sticker: 'mom_box', x: 740, y: 420, size: 190, enter: 'drop', label: 'HỘP XỐP MẸ GỬI' },
    { kind: 'highlighter', t0: 10.1, t1: 11.8, text: 'VỀ NHÀ THÔI CON', y: 295, highlightAt: 10.35 },
  ],
});
