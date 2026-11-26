// GOAT Beef: Ron (the Ronaldo fan) and Leo (the Messi fan) as real 3-D vinyl-toy characters with drawn human faces.
// Local frame (same as Trà đá): origin on the floor under a LOW seat (seat top at y 0.27), +z = the way he faces, +x = screen-right when he faces the camera.
// For a tall bar stool the set puts the seat pos at y = 0.42; the legs here hang down to a foot ring 0.14 below the origin.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, smooth, hash, canvasTex, grain, std, mesh, ball, cyl, V } from '../../core/util.js';
import { Noodle, armCtrl, facePatch, onHead, blink, idle } from '../../core/rig.js';

const INK = '#22120e';

// ---------- face parameter sets (blended number by number) ----------
// eye: 1 open .. 0 shut (the lid comes down over a round eye) · arc: 1 = shut ^ (laughing) · size · px, py: where the pupil looks (+px right, +py down) · pup: pupil size
// brow: both brows up/down · browL, browR: extra for the screen-left / screen-right brow · tilt: + worried (inner ends up), - angry (inner ends down)
// smile: -1 frown .. 1 smile · smirk: right corner up, left corner down · open: mouth open · wide: mouth width · teeth · tongue · blush · sweat · tear · skew: head roll
export const FAN_FACE = {
  neutral: { eye: 1, arc: 0, size: 1, px: 0, py: 0, pup: 1, brow: 0, browL: 0, browR: 0, tilt: 0, smile: 0.12, smirk: 0, open: 0, wide: 1, teeth: 0, tongue: 0, blush: 0.35, sweat: 0, tear: 0 },
  happy: { eye: 0.9, arc: 0, size: 1, px: 0, py: 0, pup: 1, brow: 0.45, browL: 0, browR: 0, tilt: 0.1, smile: 1, smirk: 0, open: 0.55, wide: 1.2, teeth: 1, tongue: 0.3, blush: 0.8, sweat: 0, tear: 0 },
  smug: { eye: 0.58, arc: 0, size: 1, px: 0.5, py: 0.15, pup: 1, brow: 0.1, browL: -0.15, browR: 0.55, tilt: -0.25, smile: 0.55, smirk: 1, open: 0, wide: 1.1, teeth: 0, tongue: 0, blush: 0.5, sweat: 0, tear: 0, skew: 1 },
  shock: { eye: 1, arc: 0, size: 1.22, px: 0, py: 0, pup: 0.6, brow: 1, browL: 0, browR: 0, tilt: 0.25, smile: -0.1, smirk: 0, open: 0.95, wide: 0.72, teeth: 0.5, tongue: 0, blush: 0.15, sweat: 0.7, tear: 0 },
  worry: { eye: 1, arc: 0, size: 1.08, px: 0, py: 0, pup: 0.9, brow: 0.45, browL: 0, browR: 0, tilt: 1, smile: -0.6, smirk: 0, open: 0.18, wide: 0.9, teeth: 0.5, tongue: 0, blush: 0.2, sweat: 1, tear: 0 },
  sad: { eye: 0.66, arc: 0, size: 1.05, px: 0, py: 0.35, pup: 1.1, brow: 0.1, browL: 0, browR: 0, tilt: 1.3, smile: -0.95, smirk: 0, open: 0, wide: 0.85, teeth: 0, tongue: 0, blush: 0.4, sweat: 0, tear: 0.55 },
  cry: { eye: 0.16, arc: 0, size: 1, px: 0, py: 0.3, pup: 1.1, brow: 0.2, browL: 0, browR: 0, tilt: 1.2, smile: -1, smirk: 0, open: 1, wide: 1.0, teeth: 0.4, tongue: 0.8, blush: 0.8, sweat: 0, tear: 1 },
  angry: { eye: 0.68, arc: 0, size: 1, px: 0, py: 0, pup: 0.85, brow: -0.7, browL: 0, browR: 0, tilt: -1.4, smile: -0.8, smirk: 0, open: 0.5, wide: 1.1, teeth: 1, tongue: 0, blush: 0.7, sweat: 0, tear: 0 },
  think: { eye: 0.85, arc: 0, size: 1, px: 0.75, py: -0.75, pup: 1, brow: 0.2, browL: -0.2, browR: 0.7, tilt: -0.15, smile: -0.05, smirk: 0.3, open: 0, wide: 0.7, teeth: 0, tongue: 0, blush: 0.3, sweat: 0, tear: 0, skew: 1 },
  deadpan: { eye: 0.52, arc: 0, size: 1, px: 0, py: 0, pup: 1, brow: -0.1, browL: 0, browR: 0, tilt: 0, smile: 0, smirk: 0, open: 0, wide: 0.8, teeth: 0, tongue: 0, blush: 0.2, sweat: 0, tear: 0 },
  laugh: { eye: 0.4, arc: 1, size: 1, px: 0, py: 0, pup: 1, brow: 0.5, browL: 0, browR: 0, tilt: 0.1, smile: 1, smirk: 0, open: 1, wide: 1.3, teeth: 1, tongue: 1, blush: 1, sweat: 0, tear: 0 },
  sarcastic: { eye: 0.55, arc: 0, size: 1, px: 0.85, py: 0.1, pup: 1, brow: -0.1, browL: -0.3, browR: 0.95, tilt: -0.2, smile: 0.5, smirk: 1, open: 0, wide: 1.0, teeth: 0, tongue: 0, blush: 0.25, sweat: 0, tear: 0, skew: 1 },
  horror: { eye: 1, arc: 0, size: 1.26, px: 0, py: 0, pup: 0.5, brow: 0.95, browL: 0, browR: 0, tilt: 0.95, smile: -0.95, smirk: 0, open: 0.7, wide: 0.78, teeth: 0.7, tongue: 0, blush: 0.1, sweat: 1, tear: 0 },   // Ep 4: wide eyes + worried brows + open frown
  unimpressed: { eye: 0.5, arc: 0, size: 1, px: -0.55, py: 0.2, pup: 1, brow: -0.2, browL: 0.15, browR: 0, tilt: 0.15, smile: -0.2, smirk: 0, open: 0, wide: 0.78, teeth: 0, tongue: 0, blush: 0.2, sweat: 0, tear: 0 },
};
export const RON_FACE = { ...FAN_FACE, neutral: { ...FAN_FACE.neutral, brow: 0.12, smile: 0.25 }, smug: { ...FAN_FACE.smug, smile: 0.85, wide: 1.2 }, happy: { ...FAN_FACE.happy, wide: 1.3 } };
export const LEO_FACE = { ...FAN_FACE, neutral: { ...FAN_FACE.neutral, eye: 0.88, smile: 0.02, blush: 0.25 }, smug: { ...FAN_FACE.smug, smile: 0.4 }, happy: { ...FAN_FACE.happy, smile: 0.8, wide: 1.05 } };

// ---------- arm poses: hand targets [x, y, z] in the character's frame; l = screen-left hand, r = screen-right hand ----------
export const FAN_POSE = {
  rest: { l: [-0.16, 0.41, 0.21], r: [0.16, 0.41, 0.21] },
  table: { l: [-0.14, 0.53, 0.31], r: [0.14, 0.53, 0.31] },
  point: { l: [-0.16, 0.41, 0.21], r: [0.38, 0.8, 0.3] },
  pointL: { l: [-0.38, 0.8, 0.3], r: [0.16, 0.41, 0.21] },
  me: { l: [-0.16, 0.41, 0.21], r: [0.06, 0.6, 0.25] },
  raise: { l: [-0.16, 0.41, 0.21], r: [0.31, 1.14, 0.1] },
  cheer: { l: [-0.35, 1.18, 0.06], r: [0.35, 1.18, 0.06] },
  facepalm: { l: [-0.16, 0.41, 0.21], r: [0.05, 1.0, 0.28] },
  chin: { l: [0.0, 0.5, 0.26], r: [0.06, 0.8, 0.26] },
  shrug: { l: [-0.37, 0.7, 0.14], r: [0.37, 0.7, 0.14], shrug: 1 },
  cross: { l: [0.1, 0.58, 0.26], r: [-0.1, 0.61, 0.29] },
  phone: { l: [-0.16, 0.41, 0.21], r: [0.14, 0.64, 0.32], phone: 1 },
  cup: { l: [-0.16, 0.41, 0.21], r: [0.08, 0.86, 0.25], cup: 1 },
  head: { l: [-0.27, 1.06, 0.03], r: [0.27, 1.06, 0.03] },
  beg: { l: [-0.06, 0.74, 0.28], r: [0.06, 0.74, 0.28] },
  siu: { l: [-0.52, 0.43, 0.02], r: [0.52, 0.43, 0.02] },
  clap: { l: [-0.03, 0.62, 0.29], r: [0.03, 0.62, 0.29] },
  siuJ: { l: [-0.48, 0.6, 0.24], r: [0.44, 0.6, 0.27], jump: 1 },   // Ep 4: the siu landing (arms down and out, chest out, lifted), reads in a two-shot
};

// ---------- GOAT Beef Ep 4 (13/11): hand poses on the desk goal counter (bar.js setOpts.counter) ----------
// The bar seats Ron at (-0.45, 0.42, 0) turned +0.3 rad and Leo at (0.45, 0.42, 0) turned -0.3; a pose target is in the fan's own frame, scaled by px,
// shifted by pz (and by the small shoulder offset in apply), so each fan gets his own numbers from one world point on the counter.
// Counter (bar.js): centre x = cx (fx.cx), z 0.22, body 0.90-1.00, front face z 0.265, plunger cap top 1.044, reset knob on the right side at x + 0.122.
export const CTR = { z: 0.22, front: 0.265, cap: 1.044, knobX: 0.122, knobY: 0.95 };
export function ctrTarget(side, cfg, s, [wx, wy, wz]) {
  const yaw = -side * 0.3, dx = wx - side * 0.45, lx = dx * Math.cos(yaw) - wz * Math.sin(yaw), lz = dx * Math.sin(yaw) + wz * Math.cos(yaw);
  return [(lx - s * (cfg.shX - 0.13) * 0.3) / cfg.px, wy - 0.42, lz - cfg.pz];
}
// side -1 = Ron (presses with the screen-right hand), +1 = Leo (screen-left hand; the other hand rests, so the mate never covers a face)
function counterPoses(side, cfg) {
  const s = side < 0 ? 1 : -1, hand = side < 0 ? 'r' : 'l', free = side < 0 ? { l: FAN_POSE.rest.l } : { r: FAN_POSE.rest.r };
  const at = (w) => ({ ...free, [hand]: ctrTarget(side, cfg, s, w) }), up = cfg.handR * 0.85;
  return {
    press: at([0, CTR.cap + up, CTR.z]),                                   // hand on the plunger, counter in the middle
    roll: at([0.1, 1.03, CTR.front + 0.004]),                             // fingers on the units wheel, from the top right corner (the digits stay visible)
    knob: at([0.07 + CTR.knobX + up * 0.8, CTR.knobY, CTR.z]),             // counter pulled to Leo (cx +0.07): hand on the reset knob
    click: at([0.07, CTR.cap + up, CTR.z]),                                // counter at cx +0.07: plunger
    flipR: at([0.07, 0.925, CTR.front + up * 0.9]),                        // counter at cx +0.07: the label strip
    push: at([-0.07 + CTR.knobX + up * 0.8, 0.97, CTR.z]),                 // counter slid to Ron (cx -0.07): hand on its right side
    hover: { ...at([-0.07, CTR.cap + up + 0.05, CTR.z]), hover: 1 },       // counter at cx -0.07: hand above the plunger, trembling, never presses
    pump: { ...at([-0.07, CTR.cap + up, CTR.z]), pump: 1 },                // counter at cx -0.07: presses 7 times a second
    flipL: at([-0.07, 0.925, CTR.front + up * 0.9]),                       // counter at cx -0.07: the label strip
    guard: side < 0 ? { l: [0.12, 0.6, 0.31], r: ctrTarget(side, cfg, s, [0.01, CTR.cap + up * 0.7, CTR.z + 0.01]) } : at([0, CTR.cap + up, CTR.z]),   // Ron: hand flat on top, the other arm across
  };
}
// smooth radius profile r(y) through control points [[y, r], ...] (cubic Hermite, Catmull-Rom tangents)
function smoothR(ctrl, y) {
  let i = 0; while (i < ctrl.length - 2 && y > ctrl[i + 1][0]) i++;
  const [y0, r0] = ctrl[i], [y1, r1] = ctrl[i + 1];
  const m = (k) => { const a = ctrl[Math.max(0, k - 1)], b = ctrl[Math.min(ctrl.length - 1, k + 1)]; return (b[1] - a[1]) / (b[0] - a[0]); };
  const h = y1 - y0, u = clamp((y - y0) / h), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * r0 + (u3 - 2 * u2 + u) * h * m(i) + (-2 * u3 + 3 * u2) * r1 + (u3 - u2) * h * m(i + 1);
}

// ---------- props ----------
function pintProp() {
  const g = new THREE.Group();
  cyl(0.037, 0.028, 0.125, new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1 }), [0, 0, 0], g, { cast: false }, 20);
  cyl(0.034, 0.0265, 0.088, std('#c9780f', { roughness: 0.15, emissive: '#6a3208', emissiveIntensity: 0.3 }), [0, -0.016, 0], g, {}, 20);
  cyl(0.035, 0.034, 0.028, std('#fff6e0', { roughness: 0.9 }), [0, 0.045, 0], g, { cast: false }, 20);
  return g;
}
function phoneProp() { const g = new THREE.Group(); mesh(new RoundedBoxGeometry(0.075, 0.15, 0.009, 3, 0.008), std('#16161d', { roughness: 0.3, metalness: 0.4 }), [0, 0, 0], g); const scr = mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#bcd8ff', emissiveIntensity: 1.1 }), [0, 0, -0.0052], g, { cast: false, rot: [0, Math.PI, 0] }); g.userData.screen = scr; return g; }
function mateProp() {
  const g = new THREE.Group();
  ball(0.046, std('#5a3720', { roughness: 0.55 }), [0, -0.01, 0], g, {}, 20).scale.set(1, 1.05, 1);
  mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 20), std('#c9ccd2', { roughness: 0.3, metalness: 0.8 }), [0, 0.04, 0], g, { rot: [Math.PI / 2, 0, 0] });
  mesh(new THREE.CircleGeometry(0.03, 20), std('#3a5a1a', { roughness: 1 }), [0, 0.038, 0], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  cyl(0.004, 0.004, 0.16, std('#d6d9de', { roughness: 0.25, metalness: 0.9 }), [0.022, 0.1, 0.01], g, { rot: [0, 0, -0.2] }, 6);
  return g;
}

// =====================================================================================================================
// the shared builder
// =====================================================================================================================
function buildFan(cfg, opts) {
  if (cfg.counterSide) { cfg.poses = { ...FAN_POSE, ...counterPoses(cfg.counterSide, cfg) }; cfg.pressHand = cfg.counterSide < 0 ? 1 : 0; }   // the desk counter poses (Ep 4)
  const seed = cfg.seed, R = cfg.R, root = new THREE.Group(); root.name = cfg.name;
  const body = new THREE.Group(); root.add(body);
  const skin = new THREE.MeshPhysicalMaterial({ color: cfg.skin, roughness: 0.58, sheen: 0.35, sheenColor: new THREE.Color(cfg.sheen), sheenRoughness: 0.6 });
  const jeans = std('#1f2638', { roughness: 0.88 });

  // ---- torso: a lathe with a uniform-height profile, so the jersey canvas maps straight on (u around, v up) ----
  const yb = 0.3, yt = cfg.neckY, N = 30, prof = []; for (let i = 0; i < N; i++) { const y = lerp(yb, yt, i / (N - 1)); prof.push([smoothR(cfg.torso, y), y]); }
  const rr = (y) => smoothR(cfg.torso, y);
  const jer = cfg.jersey(opts), jerTex = jer.tex(yb, yt);
  const torso = mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48), new THREE.MeshStandardMaterial({ map: jerTex, roughness: 0.9 }), [0, 0, 0], body); torso.rotation.y = Math.PI; torso.scale.set(1, 1, cfg.zs);
  cyl(rr(yb) * 0.97, rr(yb) * 0.97, 0.07, jeans, [0, yb - 0.025, 0], body, {}, 28).scale.set(1, 1, cfg.zs);
  mesh(new THREE.TorusGeometry(rr(yb) + 0.002, 0.01, 8, 40), std(jer.trim, { roughness: 0.8 }), [0, yb + 0.004, 0], body, { rot: [Math.PI / 2, 0, 0], scale: [1, cfg.zs, 1] });
  // collar and neck
  mesh(new THREE.TorusGeometry(rr(yt) + 0.004, 0.017, 10, 28), std(jer.trim, { roughness: 0.7 }), [0, yt - 0.002, 0.004], body, { rot: [Math.PI / 2, 0, 0], scale: [1, cfg.zs, 1] });
  cyl(cfg.neckR, cfg.neckR * 1.08, 0.11, skin, [0, yt + 0.035, 0], body, {}, 18);
  cfg.extras?.(body, rr, cfg.zs);

  // ---- legs: seated on a tall stool, the shins drop to the foot ring (origin y - 0.14) ----
  const shoeM = std(cfg.shoe, { roughness: 0.6 }), soleM = std(cfg.sole, { roughness: 0.7 });
  const legs = [-1, 1].map((s) => {
    const n = new Noodle(cfg.legR, jeans, body, { seg: 12 }); n.set(V(s * cfg.hipX, 0.33, 0.02), V(s * (cfg.hipX + 0.03), 0.36, 0.4), V(s * 0.095, -0.07, 0.262));
    const at = [s * 0.095, -0.105, 0.268];
    mesh(new THREE.SphereGeometry(0.058, 20, 14), shoeM, at, body, { scale: [0.95, 0.66, 1.5] });
    mesh(new THREE.SphereGeometry(0.0592, 20, 14, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.4), soleM, at, body, { scale: [0.96, 0.67, 1.51] });
    return n;
  });

  // ---- arms: skin forearm + a short jersey sleeve over the upper part, a mitten hand ----
  const armL = new Noodle(cfg.armR, skin, body, { taper: 0.9 }), armR = new Noodle(cfg.armR, skin, body, { taper: 0.9 });
  const slvL = new Noodle(cfg.armR * 1.36, new THREE.MeshStandardMaterial({ color: jer.sleeve, roughness: 0.9 }), body, { taper: 1.05, seg: 8 }), slvR = new Noodle(cfg.armR * 1.36, slvL.mesh.material, body, { taper: 1.05, seg: 8 });
  const hemL = mesh(new THREE.TorusGeometry(cfg.armR * 1.3, 0.008, 8, 20), std(jer.trim), [0, 0, 0], body), hemR = mesh(new THREE.TorusGeometry(cfg.armR * 1.3, 0.008, 8, 20), std(jer.trim), [0, 0, 0], body);
  const handL = ball(cfg.handR, skin, [0, 0, 0], body, {}, 24), handR = ball(cfg.handR, skin, [0, 0, 0], body, {}, 24);
  const shoulderBalls = [-1, 1].map((s) => ball(cfg.armR * 1.38, slvL.mesh.material, [s * cfg.shX, cfg.shY, 0], body, {}, 14));
  const phone = phoneProp(), cup = opts.cup === 'mate' ? mateProp() : pintProp(); body.add(phone, cup); phone.visible = cup.visible = false;

  // ---- head: an (optionally squashed) sphere group; everything on the head lives in `shape`, so the face patch and the hair stay in step ----
  const head = new THREE.Group(); head.position.set(0, cfg.headY, 0); head.rotation.order = 'YXZ'; body.add(head);
  const shape = new THREE.Group(); shape.scale.set(...cfg.hs); head.add(shape);
  ball(R, skin, [0, 0, 0], shape, {}, 64);
  const face = facePatch(R, { yaw: 62, pitch: 62, size: 768, rough: 0.55 }); shape.add(face.mesh);
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), U = new THREE.Vector3(0, 1, 0);
  // ellipsoid lying on the head at (yaw, pitch), its z axis along the surface normal
  const blob = (mat, yaw, pitch, k, sx, sy, sz, roll = 0, par = shape) => { onHead(R, yaw, pitch, k, P); const m = mesh(new THREE.SphereGeometry(1, 20, 14), mat, [P.x, P.y, P.z], par, { scale: [sx, sy, sz] }); Q.setFromUnitVectors(Z, P.clone().normalize()); m.quaternion.copy(Q).multiply(new THREE.Quaternion().setFromAxisAngle(Z, roll)); return m; };
  // nose, ears
  const noseP = onHead(R, 0, cfg.nose.p, 1, new THREE.Vector3()); ball(cfg.nose.r, skin, [noseP.x, noseP.y, noseP.z], shape, {}, 20).scale.set(...cfg.nose.s);
  for (const s of [-1, 1]) blob(skin, s * 89, -3, 1.0, R * 0.2, R * 0.27, R * 0.1);
  cfg.hair(shape, { R, blob, onHead, P, Q, Z, U });

  // ---- the drawn face ----
  const EY = cfg.EY, EP = cfg.EP, MP = cfg.MP;
  const stub = document.createElement('canvas'); stub.width = stub.height = face.size;
  if (cfg.stubble) {
    const c = stub.getContext('2d'), S = face.size, k = face.px, X = (d) => S / 2 + d * k, Y = (d) => S / 2 - d * k;
    const gr = c.createRadialGradient(X(0), Y(-34), 2 * k, X(0), Y(-34), 38 * k); gr.addColorStop(0, 'rgba(40,24,14,0.0)'); gr.addColorStop(0.55, 'rgba(40,24,14,0.06)'); gr.addColorStop(1, 'rgba(40,24,14,0.22)');
    c.save(); c.beginPath(); c.ellipse(X(0), Y(-36), 56 * k, 29 * k, 0, 0, 7); c.clip(); c.fillStyle = gr; c.fillRect(0, 0, S, S); c.restore();
    for (let i = 0; i < 2600; i++) { const yw = (hash(i * 1.7 + 3) * 2 - 1) * 58, pt = -6 - hash(i * 2.9 + 1) * 56, rn = Math.hypot(yw / 58, (pt + 34) / 29); if (rn > 1) continue; const mouthZone = Math.hypot(yw / 15, (pt - MP) / 5.5) < 1; if (mouthZone) continue; if (pt > -15.5 && Math.abs(yw) > 20) continue; if (pt > -12) continue; if (hash(i * 7.3) > clamp((1 - rn) * 3 + 0.2)) continue; c.fillStyle = `rgba(28,16,10,${0.35 + hash(i * 4.4) * 0.4})`; c.beginPath(); c.arc(X(yw), Y(pt), (0.3 + hash(i * 5.1) * 0.25) * k, 0, 7); c.fill(); }
  }

  let _lastFaceKey = '';
  function drawFace(f, talk, t, xp = null) {
    const bl = xp ? xp.blink : blink(t, seed), open = clamp(f.eye * (1 - bl)), sz = f.size || 1, tk = talk;
    const xpKey = xp ? `|x:${xp.mo.toFixed(3)},${xp.mw.toFixed(2)},${xp.bro[0].toFixed(2)},${xp.bro[1].toFixed(2)},${(xp.th || 0).toFixed(2)}` : '';
    const tDyn = (tk > 0.001 || (f.sweat || 0) > 0.05 || (f.tear || 0) > 0.05) ? t.toFixed(4) : '';
    const fKey = `${open.toFixed(4)}|${sz.toFixed(4)}|${tk.toFixed(4)}|${(f.blush || 0).toFixed(3)}|${(f.arc || 0).toFixed(2)}|${(f.px || 0).toFixed(3)}|${(f.py || 0).toFixed(3)}|${(f.pup ?? 1).toFixed(3)}|${(f.brow || 0).toFixed(3)}|${(f.browL || 0).toFixed(3)}|${(f.browR || 0).toFixed(3)}|${(f.tilt || 0).toFixed(3)}|${(f.open || 0).toFixed(3)}|${(f.wide || 1).toFixed(3)}|${(f.smile || 0).toFixed(3)}|${(f.smirk || 0).toFixed(3)}|${(f.tongue || 0).toFixed(2)}|${(f.teeth || 0).toFixed(2)}|${(f.sweat || 0).toFixed(2)}|${(f.tear || 0).toFixed(2)}|${tDyn}${xpKey}`;
    if (fKey === _lastFaceKey) return; _lastFaceKey = fKey;
    const c = face.ctx, S = face.size, k = face.px, X = (d) => S / 2 + d * k, Y = (d) => S / 2 - d * k;
    c.clearRect(0, 0, S, S); c.lineCap = 'round'; c.lineJoin = 'round';
    if (cfg.stubble) c.drawImage(stub, 0, 0);
    // cheeks
    if (f.blush > 0.01) for (const s of [-1, 1]) { const x = X(s * (EY + 4)), y = Y(-9), r = 8.5 * k, g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, `rgba(${cfg.blushRGB},${0.42 * f.blush})`); g.addColorStop(1, `rgba(${cfg.blushRGB},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
    // eyes
    for (const s of [-1, 1]) {
      const ex = X(s * EY), ey = Y(EP), a = cfg.eyeW * k * (1 + (sz - 1) * 0.5), b = cfg.eyeH * k * sz;
      if (f.arc > 0.5) { c.strokeStyle = INK; c.lineWidth = 1.7 * k; c.beginPath(); c.arc(ex, ey + 2.4 * k, 5.4 * k, Math.PI * 1.12, Math.PI * 1.88); c.stroke(); continue; }
      if (open < 0.13) { c.strokeStyle = INK; c.lineWidth = 1.5 * k; c.beginPath(); c.moveTo(ex - a, ey - 0.2 * k); c.quadraticCurveTo(ex, ey + 2.6 * k, ex + a, ey - 0.2 * k); c.stroke(); c.lineWidth = 0.9 * k; c.beginPath(); c.moveTo(ex + s * a, ey - 0.1 * k); c.lineTo(ex + s * (a + 1.5 * k), ey - 0.7 * k); c.stroke(); continue; }
      const lidY = ey - b + (1 - open) * 2 * b * 0.92;
      c.save(); c.beginPath(); c.ellipse(ex, ey, a, b, 0, 0, 7); c.clip(); c.beginPath(); c.rect(ex - a - 2, lidY, 2 * a + 4, 3 * b); c.clip();
      c.fillStyle = '#fbf6ee'; c.fillRect(ex - a - 2, ey - b - 2, 2 * a + 4, 2 * b + 4);
      const ix = ex + (f.px || 0) * a * 0.42, iy = ey + (f.py || 0) * b * 0.36 + (1 - open) * b * 0.12, ir = 3.7 * k * (0.92 + sz * 0.08);
      const ig = c.createRadialGradient(ix, iy + ir * 0.3, ir * 0.2, ix, iy, ir); ig.addColorStop(0, cfg.iris[0]); ig.addColorStop(1, cfg.iris[1]);
      c.fillStyle = ig; c.beginPath(); c.arc(ix, iy, ir, 0, 7); c.fill(); c.strokeStyle = 'rgba(20,10,6,0.55)'; c.lineWidth = 0.35 * k; c.stroke();
      c.fillStyle = '#0c0707'; c.beginPath(); c.arc(ix, iy, ir * 0.5 * (f.pup ?? 1), 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.arc(ix - ir * 0.32, iy - ir * 0.34, ir * 0.24, 0, 7); c.fill(); c.beginPath(); c.arc(ix + ir * 0.34, iy + ir * 0.3, ir * 0.1, 0, 7); c.fill();
      const sg = c.createLinearGradient(0, lidY, 0, lidY + 2.4 * k); sg.addColorStop(0, 'rgba(30,12,6,0.32)'); sg.addColorStop(1, 'rgba(30,12,6,0)'); c.fillStyle = sg; c.fillRect(ex - a - 2, lidY, 2 * a + 4, 2.6 * k);
      c.restore();
      // lids: lower rim, upper lid line (a chord when the lid is down) and a flick at the outer corner
      c.strokeStyle = 'rgba(60,28,18,0.5)'; c.lineWidth = 0.4 * k; c.beginPath(); c.ellipse(ex, ey, a, b, 0, 0.05, Math.PI - 0.05); c.stroke();
      c.strokeStyle = INK; c.lineWidth = (open > 0.9 ? 1.25 : 1.45) * k;
      const dy = (lidY - ey) / b, hw = a * Math.sqrt(Math.max(0.02, 1 - dy * dy));
      c.beginPath(); if (open > 0.93) c.ellipse(ex, ey, a, b, 0, Math.PI * 1.02, Math.PI * 1.98); else { c.moveTo(ex - hw, lidY); c.quadraticCurveTo(ex, lidY - 0.9 * k * open, ex + hw, lidY); } c.stroke();
      c.lineWidth = 0.95 * k; c.beginPath(); c.moveTo(ex + s * hw, lidY); c.lineTo(ex + s * (hw + 1.5 * k), lidY - 0.6 * k); c.stroke();
      if (open < 0.9 && open > 0.25) { c.strokeStyle = 'rgba(40,18,10,0.35)'; c.lineWidth = 0.5 * k; c.beginPath(); c.moveTo(ex - hw * 0.9, lidY - 1.9 * k); c.quadraticCurveTo(ex, lidY - 2.7 * k, ex + hw * 0.9, lidY - 1.7 * k); c.stroke(); }
    }
    // brows: tapered, drawn over the forehead above the eyes
    const talkBrow = xp ? 0 : tk * 0.22 * Math.sin(t * 6.1 + seed);
    for (const s of [-1, 1]) {
      const xpBro = xp ? xp.bro[s > 0 ? 1 : 0] : 0;
      const raise = (f.brow || 0) + (s > 0 ? f.browR || 0 : f.browL || 0) + talkBrow + xpBro, bh = cfg.browH + raise * 4.2, tl = f.tilt || 0;
      const xi = X(s * (EY - 7.8)), xo = X(s * (EY + 8.8)), yi = Y(EP + bh + tl * 3.4), yo = Y(EP + bh - tl * 1.3 - 0.8), xm = (xi + xo) / 2, ym = Y(EP + bh + 1.6 + tl * 0.9), th = cfg.browT * k;
      c.fillStyle = cfg.browC; c.strokeStyle = cfg.browC; c.lineWidth = 0.5 * k; c.beginPath(); c.moveTo(xi, yi - th * 0.5); c.quadraticCurveTo(xm, ym - th * 0.62, xo, yo - th * 0.24); c.lineTo(xo, yo + th * 0.24); c.quadraticCurveTo(xm, ym + th * 0.5, xi, yi + th * 0.5); c.closePath(); c.fill(); c.stroke();
    }
    // mouth
    const mo = xp ? clamp(Math.max(f.open, xp.mo)) : clamp(Math.max(f.open, tk * 0.95));
    const w = cfg.mouthW * (f.wide || 1) * (xp ? xp.mw : (1 + tk * 0.12 * Math.sin(t * 23))) * k;
    const sm = f.smile || 0, sk = f.smirk || 0, mx = X(sk * 1.1), my = Y(MP);
    const cl = sm * 2.2 - sk * 0.9, cr = sm * 2.2 + sk * 2.7, Ly = my - cl * k, Ry = my - cr * k, Lx = mx - w, Rx = mx + w, lip = cfg.lip * k;
    const teethAmt = xp ? Math.max(f.teeth || 0, xp.th || 0) : (f.teeth || 0);
    if (mo > 0.08) {
      const h = (1.2 + mo * 11) * k, bd = 1.25 + Math.min(0, sm) * 0.3, topY = my - ((cl + cr) / 2) * k + sm * 1.5 * k - (sm < 0 ? 2.6 * k * (-sm) : 0);
      c.save(); c.beginPath(); c.moveTo(Lx, Ly); c.quadraticCurveTo(mx, topY * 2 - (Ly + Ry) / 2, Rx, Ry); c.bezierCurveTo(Rx - 0.1 * w, Ry + h * bd, Lx + 0.1 * w, Ly + h * bd, Lx, Ly); c.closePath();
      c.fillStyle = '#3b0f18'; c.fill(); c.clip();
      if (f.tongue > 0.05 && mo > 0.25) { c.fillStyle = '#e0647a'; c.beginPath(); c.ellipse(mx, my + h * 1.0, w * 0.62, h * 0.55 * Math.min(1, f.tongue + 0.3), 0, 0, 7); c.fill(); }
      if (teethAmt > 0.05) { const th = Math.min(h * 0.5, 2.9 * k) * clamp(teethAmt + 0.15); c.fillStyle = '#fbf8f0'; c.beginPath(); c.roundRect(Lx + w * 0.12, Math.min(Ly, Ry) - 0.8 * k, w * 1.76, th + 0.8 * k, [0, 0, 1.2 * k, 1.2 * k]); c.fill();
        if (teethAmt > 0.5 && mo < 0.5) { c.beginPath(); c.roundRect(Lx + w * 0.12, my + h * 0.55, w * 1.76, h * 0.45, [1 * k, 1 * k, 0, 0]); c.fill(); c.fillStyle = '#3b0f18'; c.fillRect(Lx, my + h * 0.5, w * 2, 0.35 * k); } }
      c.restore();
      c.strokeStyle = INK; c.lineWidth = lip; c.beginPath(); c.moveTo(Lx, Ly); c.quadraticCurveTo(mx, topY * 2 - (Ly + Ry) / 2, Rx, Ry); c.bezierCurveTo(Rx - 0.1 * w, Ry + h * bd, Lx + 0.1 * w, Ly + h * bd, Lx, Ly); c.stroke();
    } else {
      const cy = my - ((cl + cr) / 2) * k + sm * 3.4 * k;
      c.strokeStyle = INK; c.lineWidth = lip; c.beginPath(); c.moveTo(Lx, Ly); c.quadraticCurveTo(mx, cy * 2 - (Ly + Ry) / 2 - 0 * k, Rx, Ry); c.stroke();
      if (sk > 0.4) { c.lineWidth = 0.6 * k; c.beginPath(); c.moveTo(Rx + 0.5 * k, Ry - 0.2 * k); c.lineTo(Rx + 1.6 * k, Ry - 1.3 * k); c.stroke(); }
    }
    // sweat, tears
    if (f.sweat > 0.05) { const q = (t * 0.8) % 1, x = X(EY + 16), y = Y(EP + 12) + q * 5 * k; c.globalAlpha = f.sweat * (1 - q * 0.6); c.fillStyle = '#9ad6ff'; c.strokeStyle = 'rgba(40,90,140,0.6)'; c.lineWidth = 0.4 * k; c.beginPath(); c.moveTo(x, y - 3.6 * k); c.quadraticCurveTo(x + 2.7 * k, y + 0.6 * k, x, y + 2 * k); c.quadraticCurveTo(x - 2.7 * k, y + 0.6 * k, x, y - 3.6 * k); c.fill(); c.stroke(); c.globalAlpha = 1; }
    if (f.tear > 0.05) for (const s of [-1, 1]) {
      const x0 = X(s * (EY + 1)), y0 = Y(EP - 4 * 0 - b2(f)), tw = clamp(f.tear);
      c.strokeStyle = `rgba(150,215,255,${0.85 * Math.min(1, tw * 1.6)})`; c.lineWidth = 1.7 * k; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + s * 1.2 * k, y0 + 8 * k, x0 + s * 0.4 * k, y0 + 17 * k * tw); c.stroke();
      const q = (t * 0.9 + (s > 0 ? 0.4 : 0)) % 1; c.globalAlpha = tw * (1 - q * q); c.fillStyle = '#a8defc'; c.beginPath(); c.ellipse(x0 + s * 0.6 * k, y0 + (4 + q * 16) * k, 1.2 * k, 1.9 * k, 0, 0, 7); c.fill(); c.globalAlpha = 1;
      c.fillStyle = `rgba(190,230,255,${0.55 * tw})`; c.beginPath(); c.ellipse(x0, Y(EP - 4.2), a2(), 0.9 * k, 0, 0, 7); c.fill();
    }
    face.tex.needsUpdate = true;
  }
  const b2 = () => 5.5, a2 = () => cfg.eyeW * face.px * 0.8;

  // ---- animation ----
  const S0 = [V(-cfg.shX, cfg.shY, 0), V(cfg.shX, cfg.shY, 0)], H = [V(), V()], C = V(), T = V(), A1 = V(), A2 = V(), cap = (p) => 1;
  const arms = [[armL, slvL, hemL, handL, -1, 0], [armR, slvR, hemR, handR, 1, 1]];
  const api = {
    name: cfg.name, root, body, head, R, headY: cfg.headY, eyeUp: R * 0.07, faces: cfg.faces, poses: cfg.poses || FAN_POSE, color: cfg.color,
    // pose: { face, talk, yaw, pitch, roll, lean, twist, bob, l, r, shrug, phone, cup }
    apply(p, t) {
      const id = idle(t, seed), br = id.breathe;
      body.rotation.set((p.lean || 0) - (p.jump || 0) * 0.07, p.twist || 0, id.sway * 0.6); body.position.y = (p.bob || 0) + (p.jump || 0) * 0.065;
      torso.scale.set(1 + br * 0.008, 1 + br * 0.012, cfg.zs + br * 0.012);
      head.position.y = cfg.headY + br * 0.004 + (p.shrug || 0) * -0.012;
      head.rotation.set(-(p.pitch || 0) - id.headPitch - (p.talkSlow ?? p.talk ?? 0) * 0.03, (p.yaw || 0) + id.headYaw, (p.roll || 0) + id.headRoll);
      // clapping: when both hands sit at the clap pose, they swing together and apart
      const cw = clamp(1 - (Math.abs(p.l[1] - 0.62) + Math.abs(p.r[1] - 0.62) + Math.abs(p.l[0] + 0.03) + Math.abs(p.r[0] - 0.03)) / 0.06), cs = cw * 0.075 * (0.5 + 0.5 * Math.sin(t * 15)), cy = cw * 0.02 * Math.sin(t * 15);
      const sh = (p.shrug || 0) * 0.035;
      arms.forEach(([arm, slv, hem, hd, s, i]) => {
        const tg = i ? p.r : p.l, S = S0[i].clone(); S.y += sh;
        H[i].set(tg[0] * cfg.px + s * cs + s * (cfg.shX - 0.13) * 0.3, tg[1] + br * 0.003 + cy, tg[2] + cfg.pz);
        if (i === (cfg.pressHand ?? 1) && (p.hover || p.pump)) H[i].y += (p.hover || 0) * 0.004 * Math.sin(t * 38) * (0.55 + 0.45 * Math.sin(t * 5.1)) - (p.pump || 0) * 0.026 * (0.5 - 0.5 * Math.cos(t * Math.PI * 14));
        armCtrl(S, H[i], cfg.arm, s, C);
        arm.set(S, C, H[i]); hd.position.copy(H[i]);
        const u = 0.5; A1.copy(S).lerp(C, u); A2.copy(S).multiplyScalar((1 - u) * (1 - u)).addScaledVector(C, 2 * u * (1 - u)).addScaledVector(H[i], u * u); slv.set(S, A1, A2);
        T.copy(C).sub(S).multiplyScalar(1 - u).addScaledVector(H[i].clone().sub(C), u).normalize(); hem.position.copy(A2); hem.quaternion.setFromUnitVectors(Z, T);
      });
      phone.visible = (p.phone || 0) > 0.5; if (phone.visible) { phone.position.copy(H[1]).add(V(-0.02, 0.07, 0.03)); phone.rotation.set(-0.35, 0.25, 0.08); }
      cup.visible = (p.cup || 0) > 0.5; if (cup.visible) { cup.position.copy(H[1]).add(V(-0.03, opts.cup === 'mate' ? -0.005 : 0.045, opts.cup === 'mate' ? 0.07 : 0.04)); cup.rotation.set(-0.45 * (p.cup || 0), 0, 0.1); }
      drawFace(p.face, p.talk || 0, t, p.faceX || null);
    },
    headWorld(out = V()) { return head.getWorldPosition(out); },
  };
  root.userData.api = api; return api;
}

// ---------- jersey canvases (u around, v up; the front centre is at u = 0.5) ----------
function jerseyTex(W, H, base, draw) { return canvasTex(W, H, (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); draw(c, w, h); grain(c, w, h, 9000, 0.05, 6, 2); }, { aniso: 8 }); }
function bigNum(c, w, h, cx, cy, txt, size, fill, stroke, mirror = false) { c.save(); c.translate(cx, cy); if (mirror) c.scale(-1, 1); c.font = `900 ${size}px Display, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = size * 0.08; c.strokeStyle = stroke; c.strokeText(txt, 0, 0); c.fillStyle = fill; c.fillText(txt, 0, 0); c.restore(); }

// =====================================================================================================================
// RON: broad round tan head, black spiky hair, thick brows, stubble, chubby, red 7, gold chain
// =====================================================================================================================
export function makeRon(opts = {}) {
  const hairM = new THREE.MeshPhysicalMaterial({ color: '#0a090d', roughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color('#3a3050'), sheenRoughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: '#f0c030', roughness: 0.28, metalness: 0.85, emissive: '#6a4a08', emissiveIntensity: 0.35 });
  return buildFan({
    name: 'ron', counterSide: -1, seed: 11, R: 0.2, hs: [1.1, 0.96, 1.02], headY: 0.985, neckY: 0.755, neckR: 0.062, zs: 0.86, color: '#ff4d4d',
    skin: '#c68248', sheen: '#ffb890', blushRGB: '225,96,80', iris: ['#7a4a22', '#3a1c0c'],
    torso: [[0.3, 0.19], [0.36, 0.23], [0.46, 0.248], [0.58, 0.245], [0.68, 0.2], [0.735, 0.125], [0.755, 0.075]],
    shX: 0.19, shY: 0.66, arm: 0.41, armR: 0.04, handR: 0.05, legR: 0.062, hipX: 0.085, shoe: '#d62830', sole: '#f2efe8', px: 1.06, pz: 0.05,
    EY: 21.5, EP: 3, MP: -23.5, eyeW: 8.8, eyeH: 7.0, browH: 16.5, browT: 7.0, browC: '#0f0a0c', mouthW: 12.0, lip: 1.7, nose: { p: -8, r: 0.032, s: [1.12, 0.92, 1.1] }, stubble: true, faces: RON_FACE,
    jersey: () => ({ sleeve: '#a80f1a', trim: '#f2c21a', tex: (yb, yt) => jerseyTex(1536, 512, '#a80f1a', (c, w, h) => {
      for (let i = 0; i < 24; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)'; c.fillRect(i * w / 24, 0, w / 24, h); }
      const cy = h * (1 - (0.55 - yb) / (yt - yb)); bigNum(c, w, h, w / 2, cy, '7', 330, '#f6c81c', '#6a1014'); bigNum(c, w, h, 0, cy, '7', 330, '#f6c81c', '#6a1014', true); bigNum(c, w, h, w, cy, '7', 330, '#f6c81c', '#6a1014', true);
    }) }),
    hair: (shape, { R, blob, onHead, P, Q, U }) => {
      const cap = mesh(new THREE.SphereGeometry(R * 1.035, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.36), hairM, [0, 0.004, -0.014], shape, { rot: [-0.2, 0, 0] });
      const spike = (yaw, pitch, h, lean = 0.55, rad = 0.037) => { onHead(R, yaw, pitch, 0.985, P); const n = P.clone().normalize(), d = n.clone().multiplyScalar(lean).add(U.clone().multiplyScalar(1 - lean * 0.2)).normalize(); const m = mesh(new THREE.ConeGeometry(rad, h, 14), hairM, [P.x + d.x * h / 2, P.y + d.y * h / 2, P.z + d.z * h / 2], shape); m.quaternion.setFromUnitVectors(U, d); };
      [-60, -30, 0, 30, 60].forEach((y, i) => spike(y, 46 + (i % 2) * 3, 0.085 + 0.012 * (i % 2), 0.75, 0.034));
      for (let i = 0; i < 9; i++) spike(-160 + i * 40, 68, 0.12 + 0.025 * hash(i * 3.3));
      [[-30, 82], [60, 82], [150, 82], [-120, 82], [0, 86]].forEach(([y, p], i) => spike(y, p, 0.135 + 0.03 * hash(i + 4), 0.3, 0.04));
      for (const y of [-100, -130, -165, 165, 130, 100]) spike(y, 38, 0.08, 0.7, 0.034);
      for (const s of [-1, 1]) spike(s * 92, 44, 0.07, 0.6, 0.032);
    },
    extras: (body, rr, zs) => {
      // gold chain following the chest, with a small pendant
      const pts = []; for (let i = 0; i <= 18; i++) { const a = (i / 18 - 0.5) * 2 * 1.15, y = 0.745 - 0.1 * Math.cos(a / 1.15 * Math.PI / 2) ** 1.0 * 1.0, r = rr(y) + 0.008; pts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r * zs)); }
      const ch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0075, 8), gold); ch.castShadow = true; body.add(ch);
      const last = pts[9]; mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.008, 20), gold, [last.x, last.y - 0.03, last.z + 0.002], body, { rot: [Math.PI / 2 - 0.12, 0, 0] });
      mesh(new THREE.SphereGeometry(0.012, 12, 10), gold, [last.x, last.y - 0.003, last.z], body);
    },
  }, opts);
}

// =====================================================================================================================
// LEO: slimmer, oval fair head, brown mop with a side fringe, calm dry look, sky-blue and white 10 (or Ron's red 7 after losing a bet)
// =====================================================================================================================
export function makeLeo(opts = {}) {
  const hairM = new THREE.MeshPhysicalMaterial({ color: '#5a3820', roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color('#b08050'), sheenRoughness: 0.5 });
  const red7 = opts.jersey === 'red7';
  return buildFan({
    name: 'leo', counterSide: 1, seed: 23, R: 0.19, hs: [0.93, 1.1, 1.0], headY: 1.0, neckY: 0.765, neckR: 0.045, zs: 0.82, color: '#6ecbff',
    skin: '#e8bf9e', sheen: '#ffd8c4', blushRGB: '240,130,130', iris: ['#8a5a2c', '#4a2a12'],
    torso: [[0.3, 0.12], [0.36, 0.14], [0.46, 0.148], [0.58, 0.138], [0.68, 0.118], [0.74, 0.085], [0.765, 0.055]],
    shX: 0.135, shY: 0.68, arm: 0.38, armR: 0.032, handR: 0.043, legR: 0.047, hipX: 0.07, shoe: '#f4f2ee', sole: '#c9ccd2', px: 0.93, pz: 0.0,
    EY: 20, EP: 3, MP: -24, eyeW: 8.0, eyeH: 6.6, browH: 16, browT: 4.2, browC: '#3a2414', mouthW: 10.0, lip: 1.3, nose: { p: -8, r: 0.025, s: [0.9, 1.1, 1.25] }, stubble: false, faces: LEO_FACE,
    jersey: () => red7 ? ({ sleeve: '#a80f1a', trim: '#f2c21a', tex: (yb, yt) => jerseyTex(1024, 512, '#a80f1a', (c, w, h) => { for (let i = 0; i < 18; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)'; c.fillRect(i * w / 18, 0, w / 18, h); } const cy = h * (1 - (0.56 - yb) / (yt - yb)); bigNum(c, w, h, w / 2, cy, '7', 320, '#f6c81c', '#6a1014'); bigNum(c, w, h, 0, cy, '7', 320, '#f6c81c', '#6a1014', true); bigNum(c, w, h, w, cy, '7', 320, '#f6c81c', '#6a1014', true); }) })
      : ({ sleeve: '#7ccdf2', trim: '#16233f', tex: (yb, yt) => jerseyTex(1024, 512, '#f6f9ff', (c, w, h) => {
        const n = 11; for (let i = 0; i < n; i++) { c.fillStyle = '#74c7f0'; c.fillRect((i + 0.25) * w / n, 0, w / n * 0.55, h); }
        const cy = h * (1 - (0.56 - yb) / (yt - yb)); c.save(); c.fillStyle = '#f6f9ff'; c.fillRect(w / 2 - 128, cy - 130, 256, 260); c.restore();
        bigNum(c, w, h, w / 2, cy, '10', 230, '#16233f', '#f6f9ff'); bigNum(c, w, h, 0, cy, '10', 230, '#16233f', '#f6f9ff', true); bigNum(c, w, h, w, cy, '10', 230, '#16233f', '#f6f9ff', true);
      }) }),
    hair: (shape, { R, blob, onHead, P, Q, U }) => {
      mesh(new THREE.SphereGeometry(R * 1.07, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.4), hairM, [0, 0.002, -0.012], shape, { rot: [-0.25, 0, 0] });
      blob(hairM, 0, 76, 1.02, 0.12, 0.1, 0.03, 0);       // the mop's volume lying on the crown
      // the side fringe: broad flat locks swept across the forehead to screen-right, never lower than the brows
      [[-34, 50, 0.1, 0.05, 0.03, 0.45], [-6, 54, 0.1, 0.05, 0.03, 0.2], [22, 52, 0.1, 0.05, 0.03, -0.15], [48, 44, 0.085, 0.045, 0.03, -0.55], [64, 34, 0.06, 0.035, 0.03, -1.0]].forEach(([y, p, sx, sy, sz, roll]) => blob(hairM, y, p, 1.045, sx, sy, sz, roll));
      for (const [y, p, sx, sy, roll] of [[-70, 30, 0.05, 0.075, 0.2], [-84, 12, 0.04, 0.07, 0.1], [82, 18, 0.045, 0.07, 0.2], [-120, 24, 0.07, 0.07, 0], [120, 24, 0.07, 0.07, 0], [180, 30, 0.1, 0.07, 0]]) blob(hairM, y, p, 1.03, sx, sy, 0.04, roll);
    },
  }, opts);
}
