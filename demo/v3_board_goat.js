// cine3d v3.0 Demo — GOAT Beef: Full v3.0 Parity (look2 + act2 + English facePlus)
// + ESPN/StatMuse `goatStatCard` + Tifo `tactics` pitch + vertical `compare` + `stadium_night` backdrop.
import { goatDefaults, diagramRig, boardOverlay, goatStatCard, setswapBackdrop } from '../core/ep_kit.js';

const RIG = diagramRig();

export default goatDefaults({
  id: 'v3_board_goat',
  dur: 12.0,
  shots: [
    { t0: 0.0, t1: 1.0, cam: 'cu_ron', move: 'push' },
    { t0: 1.0, t1: 2.0, cam: 'ms_leo', move: 'none' },
    { t0: 2.0, t1: 3.2, cam: 'two', move: 'push' },
    { t0: 3.2, t1: 5.4, cam: 'ms_leo', move: 'push', rig: RIG.ms },
    { t0: 5.4, t1: 7.2, cam: 'two', move: 'push', rig: RIG.two },
    { t0: 7.2, t1: 9.8, cam: 'ms_ron', move: 'push', rig: RIG.ms },
    { t0: 9.8, t1: 12.0, cam: 'two', move: 'push' },
  ],
  lines: [
    { id: 'l1', who: 'ron', t0: 0.15, t1: 1.8, text: 'Five Champions Leagues, bro! Untouchable!', emo: 'smug' },
    { id: 'l2', who: 'leo', t0: 2.0, t1: 3.1, text: 'Cool. Check the World Cup shelf.', emo: 'deadpan' },
    { id: 'l3', who: 'leo', t0: 3.4, t1: 5.3, text: 'Messi drops deep, threads the box.', emo: 'smug' },
    { id: 'l4', who: 'ron', t0: 7.4, t1: 9.4, text: 'That VAR call was straight robbery!', emo: 'angry' },
    { id: 'l5', who: 'leo', t0: 10.1, t1: 11.4, text: 'Eight Ballon d’Ors say hi.', emo: 'happy' },
  ],
  acts: [
    { t: -1, who: 'ron', d: 0.01, emo: 'smug', pose: 'raise' },
    { t: -1, who: 'leo', d: 0.01, emo: 'deadpan', pose: 'cup' },
    { t: 3.3, who: 'leo', emo: 'smug', pose: 'point', look: 'up' },
    { t: 3.3, who: 'ron', emo: 'worry', look: 'up' },
    { t: 7.3, who: 'ron', emo: 'angry', pose: 'fists', look: 'up', nod: 'jolt' },
    { t: 9.9, who: 'leo', emo: 'happy', pose: 'cup', look: 'partner' },
    { t: 9.9, who: 'ron', emo: 'shock', pose: 'facepalm', look: 'partner' },
  ],
  overlays: [
    // ESPN/StatMuse animated count-up broadcast card + Gemini sticker
    goatStatCard({
      t0: 1.1,
      t1: 3.15,
      team: 'leo',
      title: 'ALL-TIME RECORD',
      countTo: 8,
      suffix: ' BALLON D’OR',
      sub: '2022 WORLD CUP WINNER',
      sticker: 'ballon_dor',
      highlightAt: 1.7,
    }),
    // Tifo Football Tactical Pitch (numbered jersey tokens, dashed pass + moving ball, heat zone)
    boardOverlay({
      layout: 'tactics',
      t0: 3.25,
      t1: 7.15,
      title: 'FINAL PLAYMAKING MAP',
      players: [
        { id: 'lm', num: 10, name: 'MESSI', team: 'B', x: 0.3, y: 0.58, t: 3.35 },
        { id: 'cr', num: 7, name: 'RONALDO', team: 'A', x: 0.72, y: 0.28, t: 3.65 },
        { id: 'fw', num: 9, name: 'ALVAREZ', team: 'B', x: 0.76, y: 0.62, t: 3.85 },
      ],
      passes: [
        { from: 'lm', to: 'fw', t: 4.2, curve: -55, ball: true },
      ],
      zones: [
        { x: 0.76, y: 0.56, r: 0.17, t: 4.8, label: 'DANGER' },
      ],
      badge: { t: 5.4, text: 'ASSISTS + GOALS = GOAT' },
    }),
    // Vertical-first 9:16 Compare with cutout stickers & verdict stamp
    boardOverlay({
      layout: 'compare',
      stack: true,
      t0: 7.25,
      t1: 9.75,
      title: 'TROPHY CASE CHECK',
      left: {
        label: 'RONALDO',
        color: '#e63946',
        sticker: 'ucl_trophy',
        rows: [
          { t: 7.35, text: '5× Champions League' },
          { t: 7.85, text: '900+ Career Goals' },
        ],
      },
      right: {
        label: 'MESSI',
        color: '#3a86ff',
        sticker: 'world_cup',
        rows: [
          { t: 7.6, text: '2022 World Cup MVP' },
          { t: 8.2, text: '8× Ballon d’Or' },
        ],
      },
      verdict: { at: 8.75, text: 'COOKED' },
    }),
    // Floodlit Stadium painted backdrop cutaway behind live 3D Ron & Leo
    setswapBackdrop({ t0: 9.8, t1: 12.0, backdrop: 'stadium_night', fade: 0.35, kenBurns: 0.08 }),
    { kind: 'sticker', t0: 10.0, t1: 11.8, sticker: 'ref_card', x: 760, y: 390, size: 170, enter: 'slideR', label: 'NO VAR NEEDED' },
  ],
});
