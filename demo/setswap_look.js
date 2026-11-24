// look test for the SET SWAP element (15/11): the stall behind Tèo and Bíp is replaced by a 2-D board between 3 s and 9 s (cross-fade 0.5 s each way, camera untouched).
// node tools/render.cjs stills demo/setswap_look.js out/backdrop_look 1,3.25,5,7,8.75,9.25,11
const board = (ctx, t, { a }) => {
  ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, 1080, 1920);
  const g = ctx.createRadialGradient(540, 500, 80, 540, 700, 1300); g.addColorStop(0, '#26385f'); g.addColorStop(1, '#0b0f1c'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(540, 330); ctx.lineTo(300 + 60 * Math.sin(t), 700); ctx.moveTo(540, 330); ctx.lineTo(780, 700); ctx.stroke();
  ctx.fillStyle = '#1c2538'; ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 8; for (const [x, y, w, h] of [[360, 230, 360, 150], [160, 700, 280, 220], [640, 700, 280, 220]]) { ctx.beginPath(); ctx.roundRect(x, y, w, h, 30); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#f5efe0'; ctx.font = '800 66px UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MR PIPS', 540, 330);
  ctx.fillStyle = '#5ee08a'; ctx.beginPath(); ctx.arc(540 + 200 * Math.sin(t * 2), 1000, 28, 0, 7); ctx.fill();
};
export default {
  id: 'setswap_look', pack: 'trada', set: 'stall', fps: 30, dur: 12, cast: ['teo', 'bip'], partners: { teo: 'bip', bip: 'teo' },
  shots: [{ t0: 0, t1: 12, cam: 'two', move: 'drift', rig: { eye: 0.56, head: 0.15 }, hold: true }],
  lines: [{ who: 'teo', t0: 1, t1: 2.6, text: 'Cái gì đây?', emo: 'worry', pose: 'rest' }, { who: 'bip', t0: 4, t1: 6.5, text: 'Bảng này đây.', emo: 'neutral', pose: 'point' }, { who: 'teo', t0: 6.8, t1: 8.5, text: 'Ơ hay.', emo: 'shock', pose: 'head' }],
  acts: [{ t: 0, who: 'teo', emo: 'smug', pose: 'rest' }, { t: 4.2, who: 'bip', look: 'up', d: 2.2 }],
  overlays: [{ kind: 'setswap', t0: 3, t1: 9, fade: 0.5, fn: board }],
};
