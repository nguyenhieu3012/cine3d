// Trà đá với AI, Zombie special (13/11): CHÍP, Bíp's girlfriend = ChatGPT. Same build and size as Bíp (it IS makeBip with another look):
// a white glossy robot with teal-green trim, a dark visor with teal-mint eyes and lashes, a charcoal chest plate with the ChatGPT knot glowing white-teal
// (the six interlocking rounded bars of gptLogo in ~/tdvai/shared/teo.js), breathing like Bíp's spark.
// Faces: neutral (sweet smile, happy arcs) happy love (heart eyes) polite (the polite refusal: arcs, small smile, head tilted) kiss (pucker) shock worry sad think.
// Poses (Bíp's table, plus): clasp finger tap block hugB phoneUp plug hand poke shoo waveUp side. Numbers (acts fx): stand, walk, run, kneel, lie, hearts, plug (cable to plugTo's chest).
// castOpts: { chip: { stand: 1, plugTo: 'bip', screen: (ctx, w, h) => {} } } (screen = what her held-up phone shows, drawn once).
import { makeBip, BIP_FACE } from './chars.js';

export const CHIP_FACE = {
  ...BIP_FACE,
  neutral: { h: 1, arc: 1, tilt: 0, w: 0.86, round: 0, smile: 0.8, open: 0, blush: 0.9, heart: 0 },
  happy: { h: 1, arc: 1, tilt: 0, w: 0.9, round: 0, smile: 1, open: 0.3, blush: 1, heart: 0 },
  love: { h: 1, arc: 0, tilt: 0, w: 1, round: 0, smile: 1, open: 0.15, blush: 1, heart: 1 },
  polite: { h: 1, arc: 1, tilt: 0, w: 0.82, round: 0, smile: 0.55, open: 0, blush: 0.7, heart: 0, skew: 1 },
  kiss: { h: 1, arc: 1, tilt: 0, w: 0.8, round: 0, smile: 0, open: 0, blush: 1, heart: 0, pucker: 1 },
};
export function makeChip(o = {}) {
  const c = makeBip({ seed: 6, ...o, look: { body: '#f3f5f8', body2: '#36c3a3', plate: '#1f6e5c', eye: '#7dffe0', mark: 'gpt', lash: true, hand: '#f6f6f4', leg: '#e6eaef', name: 'chip', color: '#7dffe0' } });
  c.faces = CHIP_FACE; c.plugTo = o.plugTo || 'bip';
  return c;
}
