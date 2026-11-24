// look test (19/11) for the gta6 screen layer (packs/trada/gta_hud.js): every element in the order and with the relative lengths of the film, over the stall set with Tèo and Bíp.
//   render:  node tools/render.cjs stills demo/gta_hud_look.js out/gta_hud_look/dark <times>               (the stall = a dark / warm backdrop)
//            node tools/render.cjs stills demo/gta_hud_look.js out/gta_hud_look/bright <times> --q "bg=bright"   (cream wash over everything)
//            ... --q "bg=pink" = a pink-to-purple dusk gradient (the colours of the real picture); "bg=dark" = near black
//   qa:      node tools/qa.cjs demo/gta_hud_look.js
// Times (seconds): hook 0-3.4 | HUD boots 3.3 | mission line 3.9-7.1 | +50.000.000đ and 3 stars 7.5 | stars 4 at 9.0, camera photo 1 at 9.5 (hit-stop 9.75-10.25), 5 stars 10.9,
// photo 2 at 11.3, photo 3 at 12.7 | stars go out 13.9 | NHIỆM VỤ HOÀN THÀNH 14.2-17.0 | fine card 17.3 (held), money 30M at 18.5, dim at 21.3, extra cards 21.4 + 22.1,
// money 10M 21.5 -> -10M 22.2 (red + shake) | cards gone 24.4 | exit button 24.6 (slam 25.1) | end card 27.0-28.9.
import { hud, hookPlate, missionLine, passedBanner, camPhoto, fineCard, exitButton, endCard } from '../packs/trada/gta_hud.js';
const BG = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('bg') : null;
const DUR = 29.0, H = 15 / 30;
// the shots: every framing differs from the one before; the big texts sit over `two` and `wide`
const shots = []; const add = (t1, cam, o = {}) => { const t0 = shots.length ? shots[shots.length - 1].t1 : 0; shots.push({ t0, t1, cam, ...o }); };
add(1.1, 'two'); add(2.2, 'wide'); add(3.4, 'two', { v: 1 }); add(7.1, 'wide', { hold: true }); add(9.5, 'two', { v: 1, hold: true }); add(10.25, 'ms_teo'); add(11.3, 'wide', { v: 1 }); add(12.05, 'ms_bip'); add(12.7, 'two'); add(13.45, 'cu_teo');
add(14.2, 'two', { v: 1 }); add(17.3, 'wide', { hold: true }); add(24.5, 'two', { move: 'none', hold: true }); add(26.9, 'ms_teo', { hold: true }); add(DUR, 'two', { v: 1, hold: true });
const poses = ['cheer', 'point', 'raise', 'shrug', 'cheer', 'rest'], acts = [{ t: 0, who: 'teo', emo: 'shock', pose: 'raise' }, { t: 0, who: 'bip', emo: 'neutral', pose: 'rest' }];
for (let i = 0; i < 24; i++) acts.push({ t: 7.2 + i * 0.28, who: 'teo', pose: poses[i % poses.length], emo: i % 3 ? 'happy' : 'smug' });
acts.push({ t: 17.4, who: 'teo', emo: 'smug', pose: 'chin' }, { t: 21.6, who: 'teo', emo: 'shock', pose: 'head' }, { t: 24.6, who: 'teo', emo: 'angry', pose: 'point' }, { t: 27.2, who: 'teo', emo: 'sad', pose: 'rest' });
const PLATE = [420, 905, 240, 92];   // the number plate of the test: the camera photos box it
const bg = (ctx, t) => {
  if (!BG) return; ctx.save(); const g = ctx.createLinearGradient(0, 0, 0, 1920);
  if (BG === 'pink') { g.addColorStop(0, '#ff8fb8'); g.addColorStop(0.55, '#b45fc2'); g.addColorStop(0.85, '#5d3a96'); g.addColorStop(1, '#2fb8b0'); } else if (BG === 'bright') { g.addColorStop(0, '#fff6e2'); g.addColorStop(1, '#ffe9c4'); } else { g.addColorStop(0, '#10121e'); g.addColorStop(1, '#05060c'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = BG === 'bright' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(540, 760, 150, 0, 7); ctx.fill(); ctx.restore();   // a bright round blob where a face would be
};
const plate = (ctx, t) => { if ((t > 9.5 && t < 10.3) || (t > 11.3 && t < 12.1) || (t > 12.7 && t < 13.5)) { ctx.save(); ctx.fillStyle = '#f4f1e6'; ctx.strokeStyle = '#222'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(...PLATE, 12); ctx.fill(); ctx.stroke(); ctx.restore(); } };
export default {
  pack: 'trada', set: 'stall', fps: 30, dur: DUR, cast: ['teo', 'bip'], partners: { teo: 'bip', bip: 'teo' }, shots, lines: [], acts,
  hits: [{ t: 9.75, frames: 15 }, { t: 11.55, frames: 15 }, { t: 12.95, frames: 15 }],
  overlays: [
    { kind: 'draw', t0: -0.05, t1: DUR, fade: 0.01, noText: true, fn: bg },
    { kind: 'draw', t0: -0.05, t1: DUR, fade: 0.01, noText: true, fn: plate },
    hookPlate({ t0: 0, t1: 3.4 }),
    hud({ t0: 3.3, t1: DUR - 0.01,
      money: [[0, 0], [7.5, 50e6], [18.5, 30e6, { roll: 0.8 }], [21.5, 10e6, { roll: 0.5 }], [22.2, -10e6, { roll: 0.6 }]],
      stars: [[0, 0], [7.5, 3], [9.0, 4], [10.9, 5], [13.9, 0, 0.3]],
      dim: [[0, 0], [21.3, 1]],
      map: { scroll: [[7.8, 13.6, 90]], bank: [3.8, 8.0] } }),
    missionLine({ t0: 3.9, t1: 7.1 }),
    camPhoto({ t0: 9.5, t1: 10.25, cam: 1, rect: PLATE }), camPhoto({ t0: 11.3, t1: 12.05, cam: 2, rect: PLATE }), camPhoto({ t0: 12.7, t1: 13.45, cam: 3, rect: PLATE }),
    passedBanner({ t0: 14.2, t1: 17.0 }),
    fineCard({ t0: 17.3, stamps: [21.4, 22.1], t1: 24.4 }),
    exitButton({ t0: 24.6, slamAt: 25.1, t1: 26.9 }),
    endCard({ t0: 27.0, t1: 28.9 }),
  ],
};
