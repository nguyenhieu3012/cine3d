// GOAT Beef Ep 11 "Messi's Assists vs Ronaldo's Goals" (17/11/2026): Ron's full PINT that Leo slides across the table (the "assist"), an episode-local prop
// (ENGINE.md "Episode-local additions"), the hand poses that touch it, Ron's foam moustache and Ron's faces. Shape copied from gb07_props.js (the flag): the pint's
// whole life is ONE table of segments (Leo's slide, Leo's nudge, Ron's grip / hoist / gulp / slam, Ron's shove, Leo's second slide, Ron's tiny sip) and the hands'
// acts come from the SAME numbers (KEYS), so the glass stays glued to the palm. Pure function of t; nothing is stored between frames; nothing is edited outside this file.
//   Leo sits screen-right (x +0.45), Ron screen-left (x -0.45); the pint travels along x on the table (z PZ), toward Ron = -x.
import * as THREE from 'three';
import { clamp, lerp, smooth, overshoot, mesh, std } from '../core/util.js';
import { ctrTarget } from '../packs/goat/fans.js';
import T from './gb11.times.js';

const s = (id) => T.lines[id].t0, e = (id) => T.lines[id].t1;
export const TOP = 0.9, PZ = 0.30, POSE_T = 0.34;
const HP = 0.073, HR = 0.062;           // palm centre to pint centre: Leo from the side (pint r 0.037 + palm 0.036) / Ron's grip (the palm wraps the glass a little)
const OFF = [HR, 0.015, -0.02];         // pint centre = Ron's hand + this (when he holds it)
const RON = { shX: 0.19, px: 1.06, pz: 0.05, handR: 0.05 }, LEO = { shX: 0.135, px: 0.93, pz: 0, handR: 0.043 };
const uL = LEO.handR * 0.85, uR = RON.handR * 0.85;
const REST = { l: [-0.16, 0.41, 0.21], r: [0.16, 0.41, 0.21] }, LAP = [0.1, 0.42, 0.25];
const YL = TOP + uL + 0.004;           // Leo's hand on the table / on the glass side
const YG = 0.95;                       // Ron's grip height on the glass (pint centre 0.965)
const START = 0.30, X1 = -0.06, XS = -0.075, X2 = 0.06, XF = -0.13;   // where the pint lies: Leo's side / after the hook slide / after the slam / after Ron's shove / after the second slide
const grip = (x) => [x - HR, YG, PZ + 0.02];

// ---- timing anchors (the sfx of the beats file; change here only) ----
export const TS = {
  slide1: 0.0,                           // hook: Leo's hand pushes (whoosh at 0)
  nudge: s('l3') + 0.88,                 // "Assist." (4.84): the last inch
  hoist: 5.2, mouth: 5.6, slam: 5.86,    // Ron: grab and lift, to the mouth, down (thud at l4 + 0.5 = 6.094)
  thud4: s('l4') + 0.5,
  slap8: s('l8') + 0.9,                  // Ron's table slap on GOALS (thud 13.859)
  never: s('l21') + 0.7,                 // the table slam on NEVER (thud 51.499, hit-stop)
  sA: 54.34, sB: 54.68,                  // p22: Ron, sunk, pushes the pint away
  hover2: 56.0, slide2: 56.40,           // l25: Leo's second slide (whoosh at 56.423)
  take2: 56.1, lift2: 57.55, sip2: 58.55, down2: 59.3,   // Ron takes it, lifts it, the tiny sip, puts it down
};

// ---- the pint's segments on the table ----
// A slide: Leo's palm pushes (the same overshoot ramp as the pose blend), lets go `tr` s after the push starts, the glass runs on with a steady friction to X1.
function seg(o) { return { sgn: -1, tr: 0.08, ...o }; }
const SEGS = [
  seg({ t0: TS.slide1, hxA: START + HP, hxB: 0.10, X1 }),                                     // hook: Leo slides it to Ron (whoosh)
  seg({ t0: TS.nudge, hxA: X1 + HP, hxB: -0.012, tr: 1e9 }),                                 // l3: Leo nudges it the last inch (pint = palm - HP all the way)
  seg({ t0: TS.sA, hxA: XS - HP, hxB: -0.02, sgn: 1, X1: X2 }),                              // p22: Ron's palm shoves it away (the palm is on its LEFT side)
  seg({ t0: TS.slide2, hxA: X2 + HP, hxB: 0.0, X1: XF }),                                    // l25: Leo slides it again (whoosh)
];
const hx = (g, t) => lerp(g.hxA, g.hxB, overshoot((t - g.t0) / POSE_T, 0.07));
function segX(g, t) {
  if (t < g.t0) return g.hxA + g.sgn * HP;
  const u = t - g.t0;
  if (u < g.tr) return hx(g, t) + g.sgn * HP;
  const xr = hx(g, g.t0 + g.tr) + g.sgn * HP, v = Math.max(0.05, Math.abs(hx(g, g.t0 + g.tr + 0.005) - hx(g, g.t0 + g.tr - 0.005)) / 0.01);
  const d = g.X1 - xr, dist = Math.abs(d), dirv = Math.sign(d) || 1, D = 2 * dist / v, dt = Math.min(u - g.tr, D);
  return xr + dirv * (v * dt - v * dt * dt / (2 * D));
}
function restX(t) {   // the pint lying on the table (not held)
  let x = START;
  for (const g of SEGS) { if (t < g.t0) break; x = segX(g, t); }
  if (t >= WIN1[1] && t < TS.sA) x = XS;   // slammed down where Ron's hand put it (1 cm from the end of the nudge: the hand's own numbers)
  return x;
}

// ---- Ron's right-hand keys (world hand centre), the same times as his pose acts ----
// window 1: grab, nudge-in-hand, hoist (trophy), mouth (the gulp), slam on the table;  window 2: take it back, lift, sip, put it down
export const KEYS1 = [
  { t: 0.30, n: 'gCatch', w: grip(X1), l: [-0.34, 0.8, 0.18] },
  { t: TS.nudge, n: 'gNudge', w: grip(X1 - 0.025) },
  { t: TS.hoist, n: 'gHoist', w: [-0.28, 1.36, 0.27], l: [-0.46, 1.1, 0.1] },
  { t: TS.mouth, n: 'gMouth', w: [-0.363, 1.236, 0.245] },
  { t: TS.slam, n: 'gSlam', w: grip(XS), l: [-0.5, 0.95, 0.15] },
];
export const KEYS2 = [
  { t: TS.take2, n: 'gTake', w: grip(XF), j: -1.07 },
  { t: TS.lift2, n: 'gLift', w: [-0.16, 1.10, 0.30], j: -1.07 },
  { t: TS.sip2, n: 'gSip', w: [-0.42, 1.165, 0.245], j: -1.07 },
  { t: TS.down2, n: 'gDown', w: grip(XF), j: -1.07 },
];
const WIN1 = [TS.hoist, 6.25], WIN2 = [TS.lift2, 59.9];   // the glass is in the hand
function handAt(keys, t) {
  let i = -1; for (let j = 0; j < keys.length; j++) if (t >= keys[j].t) i = j;
  if (i <= 0) return keys[Math.max(0, i)].w.slice();
  const a = keys[i - 1].w, b = keys[i].w, k = overshoot((t - keys[i].t) / POSE_T, 0.07);
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}
const tiltAt = (t) => 1.05 * (smooth((t - 5.62) / 0.2) - smooth((t - 5.9) / 0.16)) + 0.42 * (smooth((t - 58.72) / 0.2) - smooth((t - 59.12) / 0.2));
const levelAt = (t) => 1 - 0.48 * smooth((t - 5.72) / 0.24) - 0.1 * smooth((t - 58.78) / 0.2);
const HOPS = [[TS.thud4, 0.009], [TS.slap8, 0.012], [TS.never, 0.024]];   // the table is hit: the glass jumps and the foam wobbles
const hopAt = (t) => { let h = 0; for (const [th, a] of HOPS) { const dt = t - th; if (dt > 0 && dt < 0.8) h += a * Math.exp(-7 * dt) * Math.abs(Math.sin(21 * dt)); } return h; };
// foam moustache on Ron: grows after the gulp, melts away slowly; a small dot after the tiny sip
const mousAt = (t) => smooth((t - 6.1) / 0.12) * (1 - smooth((t - 11.5) / 3.2)) + 0.4 * smooth((t - 58.85) / 0.25);

// ---------------------------------------------------------------------------------------------------------------------------------------------------
export function pintPoses() {
  // Ron: a world point of his hand -> his own pose numbers; `j` = the pose key `jump` (standing / slumped), as in gb07
  const unrot = (tg, th) => { const ly = tg[1], lz = tg[2] + RON.pz, c = Math.cos(th), sn = Math.sin(th); return [tg[0], ly * c + lz * sn, -ly * sn + lz * c - RON.pz]; };
  const cr = (w, j = 0) => unrot(ctrTarget(-1, RON, 1, [w[0], w[1] - j * 0.065, w[2]]), -j * 0.07), cl = (w, j = 0) => unrot(ctrTarget(-1, RON, -1, [w[0], w[1] - j * 0.065, w[2]]), -j * 0.07);
  const ron = (w, j = 0, o = {}) => ({ l: REST.l, r: cr(w, j), jump: j, ...o });
  const leo = (w, o = {}) => ({ r: LAP, cup: 1, l: ctrTarget(1, LEO, -1, w), ...o });   // the pint hand is his screen-left one; the mate rides hidden in his lap
  const J = 3.4, JH = 3.7, yT = TOP + 0.05, yR = TOP + uR + 0.004, LH = [-0.62, 1.0, 0.12];
  const P = { ron: {}, leo: {} };
  for (const k of KEYS1) P.ron[k.n] = ron(k.w, 0, { l: k.l ? k.l : REST.l });
  for (const k of KEYS2) P.ron[k.n] = { l: [-0.12, 0.38, 0.2], r: cr(k.w, k.j), jump: k.j, shrug: -0.6 };
  P.ron.gCatchB = { ...P.ron.gCatch, l: [-0.5, 1.12, 0.1] };       // l2: the free hand up, palm open ("Goals win games!")
  const lh = (j) => (j > 0.5 ? cl(LH, j) : REST.l);
  Object.assign(P.ron, {
    // seated gestures with the free pint-less hand
    slapUp: ron([-0.3, 1.3, 0.34], 0.9), slapDn: ron([-0.3, yR, 0.34], 0.5),            // l8: the table slap on GOALS (left of the pint)
    pointL: { l: REST.l, r: [0.38, 0.8, 0.3] },
    jab0: ron([0.2, 0.98, 0.42], 0.5), jab1: ron([0.36, 1.03, 0.46], 0.6),               // l13b: finger jabs across the table
    chest: { l: REST.l, r: [0.06, 0.6, 0.25], jump: 0.7 },                                // l10 / l12a: "me", chest out
    pounce: { l: cl([-0.32, 0.96, 0.4], 0.5), r: cr([-0.22, 0.96, 0.4], 0.5), jump: 0.5 },   // l15: both hands slap down, he pounces
    // standing (l18 on): proud, listening, fists, the table slam, the sink
    riseA: { l: cl([-0.5, yT, 0.46], 1.6), r: cr([0.18, 1.12, 0.48], 1.6), jump: 1.6 },
    armsOut: { l: [-0.55, 0.9, 0.18], r: [0.55, 0.9, 0.18], jump: JH },
    threeUp: { l: lh(J), r: [0.3, 1.2, 0.1], jump: JH },                                   // THREE: a hand up
    standPt: { l: cl([-0.5, yT, 0.46], JH), r: cr([0.18, 1.12, 0.48], JH), jump: JH },
    standLean: { l: cl(LH, 3.1), r: cr([-0.3, 1.02, 0.12], 3.1), jump: 3.1 },
    fistsUp: { l: [-0.38, 1.16, 0.08], r: [0.38, 1.16, 0.08], jump: JH },
    slamUp: { l: cl([-0.42, 1.32, 0.3], JH), r: cr([-0.3, 1.34, 0.3], JH), jump: JH }, slamDn: { l: cl([-0.4, yT - 0.005, 0.46], J), r: cr([-0.3, yT - 0.005, 0.44], J), jump: J },
    sit1: { l: REST.l, r: REST.r, jump: 2 }, sit2: { l: [-0.16, 0.3, 0.21], r: [0.16, 0.3, 0.21], jump: 0.6 },
    slump: { l: [-0.12, 0.38, 0.2], r: [0.12, 0.38, 0.2], jump: -1.07, shrug: -0.8 },
    // p22: sunk in the stool, the palm on the left side of the pint, then the shove
    sA: { l: [-0.12, 0.38, 0.2], r: cr([XS - HP, YG, PZ + 0.02], -1.07), jump: -1.07, shrug: -0.8 },
    sB: { l: [-0.12, 0.38, 0.2], r: cr([-0.02, YG, PZ + 0.02], -1.07), jump: -1.07, shrug: -0.8 },
  });
  const yH = YL + 0.012;
  Object.assign(P.leo, {
    cupLow: { l: REST.l, r: [0.1, 0.42, 0.25], cup: 1 },
    pA: leo([START + HP, YL, PZ]), pB: leo([0.10, YL, PZ]),                    // hook: the palm on the glass, the push
    nA: leo([X1 + HP, yH, PZ]), nB: leo([-0.012, YL, PZ]),                       // l3: the last inch
    p2A: leo([X2 + HP, yH, PZ]), p2B: leo([0.0, YL, PZ]),                        // l25: the second slide
  });
  return P;
}

// Ron's faces (the numbers approved in gb05b / gb07): rage replaces `angry`, deflated replaces `worry`
export const RAGE = { eye: 0.85, arc: 0, size: 1.12, px: 0, py: 0, pup: 0.45, brow: -1, browL: 0, browR: 0, tilt: -1.7, smile: -1, smirk: 0, open: 0.9, wide: 1.25, teeth: 1, tongue: 0.2, blush: 1, sweat: 0.7, tear: 0 };
export const DEFLATE = { eye: 0.8, arc: 0, size: 1.0, px: 0, py: -0.45, pup: 0.85, brow: 0.35, browL: 0, browR: 0, tilt: 1, smile: -0.7, smirk: 0, open: 0.08, wide: 0.7, teeth: 0, tongue: 0, blush: 0.1, sweat: 0.8, tear: 0 };
export const JAW = { eye: 1, arc: 0, size: 1.26, px: 0, py: 0, pup: 0.45, brow: 0.95, browL: 0, browR: 0, tilt: 0.95, smile: -0.95, smirk: 0, open: 1, wide: 0.85, teeth: 0.4, tongue: 0.2, blush: 0.1, sweat: 1, tear: 0 };
export const BOIL = { eye: 0.62, arc: 0, size: 1.05, px: 0, py: 0, pup: 0.7, brow: -0.8, browL: 0, browR: 0, tilt: -1.5, smile: -0.7, smirk: 0, open: 0.05, wide: 0.7, teeth: 0, tongue: 0, blush: 1, sweat: 0.9, tear: 0 };

// ---------------------------------------------------------------------------------------------------------------------------------------------------
export default function props({ scene, set, cast }) {
  scene.updateMatrixWorld(true);
  const pint = set.pints[0], other = set.pints[1];
  if (other) other.visible = false;                                   // one pint on the table: the assist
  const w0 = new THREE.Vector3(); pint.getWorldPosition(w0);
  const off = new THREE.Vector3(w0.x - pint.position.x, w0.y - pint.position.y, w0.z - pint.position.z);   // the table group's offset (a pure translation)
  const beer = pint.children[1], foam = pint.children[2];
  beer.material.color.set('#b86a05'); beer.material.emissive.set('#c25e00'); beer.material.emissiveIntensity = 1.1;   // a clearer golden beer (the set's own is pale under the pendant light)
  const beerH = 0.088, beerBot = -0.016 - beerH / 2, beerY0 = beer.position.y, beerS0 = beer.scale.y, foamY0 = foam.position.y, foamS0 = foam.scale.y;
  // Ron's foam moustache (white blobs on the face, in the head's own frame)
  const head = cast.ron?.head, mous = new THREE.Group();
  if (head) {
    const foamM = std('#fff8e6', { roughness: 0.85, emissive: '#3a362c', emissiveIntensity: 0.25 });
    mous.position.set(0, -0.062, 0.198); head.add(mous);
    for (const [x, y, z, sx, sy, sz, r] of [[0, 0.0, 0.002, 0.034, 0.011, 0.014, 0], [-0.036, -0.002, -0.006, 0.02, 0.011, 0.013, 0.3], [0.036, -0.002, -0.006, 0.02, 0.011, 0.013, -0.3], [-0.016, 0.012, 0.004, 0.012, 0.008, 0.009, 0], [0.02, 0.011, 0.004, 0.011, 0.008, 0.009, 0]])
      mesh(new THREE.SphereGeometry(1, 16, 12), foamM, [x, y, z], mous, { scale: [sx, sy, sz], rot: [0, 0, r], cast: false });
  }
  const R3 = new THREE.Euler();

  return {
    update(t) {
      const held = (t >= WIN1[0] && t < WIN1[1]) ? 1 : (t >= WIN2[0] && t < WIN2[1]) ? 2 : 0;
      let x, y = 0.965, z = PZ, tilt = 0;
      if (held) {
        const hnd = handAt(held === 1 ? KEYS1 : KEYS2, t); tilt = tiltAt(t);
        const c = Math.cos(tilt), sn = Math.sin(tilt);
        x = hnd[0] + OFF[0] * c - OFF[1] * sn; y = hnd[1] + OFF[0] * sn + OFF[1] * c; z = hnd[2] + OFF[2];
      } else {
        x = restX(t); y = 0.965 + hopAt(t);
      }
      pint.position.set(x - off.x, y - off.y, z - off.z); pint.rotation.set(0, 0, tilt);
      // the level: the beer drops, the foam rides on top
      const lv = levelAt(t), h = beerH * lv, bot = beerBot;
      beer.scale.y = beerS0 * lv; beer.position.y = bot + h / 2; foam.position.y = bot + h + 0.014;
      const dtf = t - TS.thud4, wob = !held && dtf > 0 && dtf < 0.9 ? Math.exp(-6.5 * dtf) * Math.sin(dtf * 26) : 0;
      foam.scale.y = foamS0 * (1 + 0.35 * wob);
      const m = clamp(mousAt(t), 0, 1.2); mous.visible = m > 0.02; mous.scale.setScalar(Math.max(0.001, m));
    },
  };
}
