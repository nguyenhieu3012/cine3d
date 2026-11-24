// stall `plus`, round 2: the night traffic and the walker with proper simple shapes in the set's drawn style (rounded bodies, wheels, windows, riders with helmets, a walking figure).
// Everything is built once; the only thing that moves per frame is `pose(t)` of the walker (a pure function of t). Vehicles face +z (their front), the walker too.
// Head / tail lights are MeshBasic (they are the vehicle's own battery: the stall's blackout / lamp switches leave them alone), plus a soft additive halo each.
import * as THREE from 'three';
import { std, mesh, box, cyl, ball } from '../../core/util.js';
import { softDisc } from './street.js';
import { sideExtrude, limbBetween } from './stall_plus_lib.js';

const glowMat = (hex, k) => { const m = new THREE.MeshBasicMaterial({ color: hex }); m.color.multiplyScalar(k); return m; };
const halo = (parent, hex, pos, size, op) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); s.scale.set(size, size, 1); s.position.set(...pos); parent.add(s); return s; };
const wheel = (parent, r, w, x, y, z, tire, hub) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); cyl(r, r, w, tire, [0, 0, 0], g, { cast: false, rot: [0, 0, Math.PI / 2] }, 20); cyl(r * 0.55, r * 0.55, w + 0.01, hub, [0, 0, 0], g, { cast: false, rot: [0, 0, Math.PI / 2] }, 14); return g; };

// ---------- the car: a dark rounded saloon, glass cabin, four wheels, two headlights, two tail lights ----------
export function buildCar() {
  const car = new THREE.Group(), paint = new THREE.MeshStandardMaterial({ color: '#343b49', roughness: 0.42, metalness: 0.25, envMapIntensity: 0.5 }), glass = new THREE.MeshStandardMaterial({ color: '#0b1018', roughness: 0.12, metalness: 0.4, envMapIntensity: 0.6 });
  const tire = std('#0a0a0d', { roughness: 0.9 }), hub = std('#6f7680', { roughness: 0.4, metalness: 0.6 }), dark = std('#121216', { roughness: 0.8 });
  const body = new THREE.Mesh(sideExtrude([[-2.0, 0.3], [2.0, 0.3], [2.07, 0.6], [1.88, 0.8], [1.0, 0.9], [-1.8, 0.93], [-2.07, 0.72]], 1.72, { k: 0.36, bevel: 0.09 }), paint); body.castShadow = false; car.add(body);
  const cab = new THREE.Mesh(sideExtrude([[-1.3, 0.88], [-0.88, 1.42], [0.52, 1.42], [1.12, 0.88]], 1.5, { k: 0.25, bevel: 0.06 }), glass); cab.castShadow = false; car.add(cab);
  const roof = new THREE.Mesh(sideExtrude([[-1.0, 1.4], [0.6, 1.4], [0.6, 1.52], [-1.02, 1.52]], 1.5, { k: 0.4, bevel: 0.05 }), paint); roof.castShadow = false; car.add(roof);
  for (const s of [-1, 1]) { box(0.07, 0.52, 0.08, paint, [s * 0.76, 1.14, -0.12], car, { cast: false }); box(0.1, 0.08, 0.16, paint, [s * 0.95, 1.0, 0.72], car, { cast: false });   // B pillar, mirror
    wheel(car, 0.33, 0.22, s * 0.78, 0.33, 1.3, tire, hub); wheel(car, 0.33, 0.22, s * 0.78, 0.33, -1.3, tire, hub);
    const hl = mesh(new THREE.SphereGeometry(0.1, 12, 8), glowMat('#fff3d6', 6), [s * 0.6, 0.72, 2.05], car, { cast: false, scale: [1.9, 0.75, 0.5] }); hl.name = 'plus_head';
    box(0.4, 0.09, 0.05, glowMat('#ff3326', 4), [s * 0.62, 0.78, -2.09], car, { cast: false }); halo(car, '#fff0cc', [s * 0.6, 0.72, 2.15], 0.95, 0.5); halo(car, '#ff3a2a', [s * 0.62, 0.78, -2.15], 0.7, 0.5); }
  box(0.5, 0.12, 0.03, std('#cfcfc4', { roughness: 0.6 }), [0, 0.5, -2.1], car, { cast: false }); box(1.3, 0.05, 0.05, dark, [0, 0.4, 2.1], car, { cast: false });   // number plate, grille bar
  return car;
}

// ---------- a scooter with its rider (and a passenger): rounded body, two wheels, fork and bars, a headlight and tail light, a helmeted rider sitting forward ----------
export function buildScooter(col, helmet, jacket, pax = null) {
  const s = new THREE.Group(), paint = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2 }), dk = std('#17181d', { roughness: 0.75 }), tire = std('#0a0a0d', { roughness: 0.9 }), hub = std('#6f7680', { roughness: 0.4, metalness: 0.6 });
  const part = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = false; s.add(m); return m; };
  part(sideExtrude([[-0.93, 0.4], [-0.55, 0.3], [-0.1, 0.4], [-0.12, 0.8], [-0.6, 0.82], [-0.92, 0.68]], 0.34, { k: 0.3, bevel: 0.05 }), paint);   // rear body
  part(sideExtrude([[0.28, 0.24], [0.5, 0.3], [0.62, 0.96], [0.52, 1.03], [0.34, 0.56]], 0.3, { k: 0.3, bevel: 0.04 }), paint);   // leg shield
  part(sideExtrude([[-0.15, 0.27], [0.35, 0.27], [0.35, 0.34], [-0.15, 0.36]], 0.3, { k: 0.3, bevel: 0.03 }), dk);   // floor
  part(sideExtrude([[-0.95, 0.8], [-0.1, 0.8], [-0.12, 0.9], [-0.9, 0.9]], 0.3, { k: 0.3, bevel: 0.04 }), dk);   // seat
  part(sideExtrude([[0.46, 0.4], [0.82, 0.36], [0.84, 0.46], [0.44, 0.56]], 0.22, { k: 0.3, bevel: 0.03 }), paint);   // front mudguard
  wheel(s, 0.22, 0.1, 0, 0.22, 0.65, tire, hub); wheel(s, 0.22, 0.12, 0, 0.22, -0.58, tire, hub);
  limbBetween([0, 0.22, 0.65], [0, 0.98, 0.56], 0.022, dk, s); cyl(0.016, 0.016, 0.66, dk, [0, 1.07, 0.54], s, { cast: false, rot: [0, 0, Math.PI / 2] }, 8);
  mesh(new THREE.SphereGeometry(0.075, 12, 8), glowMat('#fff3d6', 6), [0, 1.0, 0.69], s, { cast: false, scale: [1, 1, 0.7] }); box(0.2, 0.06, 0.04, glowMat('#ff3326', 4), [0, 0.66, -0.96], s, { cast: false });
  halo(s, '#fff0cc', [0, 1.0, 0.8], 0.6, 0.5); halo(s, '#ff3a2a', [0, 0.66, -1.04], 0.45, 0.5);
  const skin = std('#7a5a44', { roughness: 0.8 }), trs = std('#1b2230', { roughness: 0.85 });
  const person = (z0, lean, jk, hc, face, fwdHand) => {   // z0 = hip z
    const jm = std(jk, { roughness: 0.8 }); limbBetween([0, 0.88, z0], [0, 1.4, z0 + lean], 0.14, jm, s);
    ball(0.125, std(hc, { roughness: 0.35 }), [0, 1.62, z0 + lean + 0.07], s, { cast: false }, 14);
    if (face) mesh(new THREE.SphereGeometry(0.1, 10, 8), std('#0d1118', { roughness: 0.15, metalness: 0.3 }), [0, 1.6, z0 + lean + 0.17], s, { cast: false, scale: [1.05, 0.55, 0.55] });
    for (const x of [-1, 1]) { const sh = [x * 0.2, 1.36, z0 + lean * 0.9];
      if (fwdHand) { limbBetween(sh, [x * 0.31, 1.2, z0 + lean + 0.34], 0.05, jm, s); limbBetween([x * 0.31, 1.2, z0 + lean + 0.34], [x * 0.27, 1.08, 0.52], 0.045, jm, s); ball(0.045, skin, [x * 0.27, 1.07, 0.53], s, { cast: false }, 8); }
      else limbBetween(sh, [x * 0.17, 1.02, z0 + 0.3], 0.05, jm, s);
      limbBetween([x * 0.12, 0.88, z0], [x * 0.21, 0.86, z0 + 0.4], 0.078, trs, s); limbBetween([x * 0.21, 0.86, z0 + 0.4], [x * 0.18, 0.36, z0 + 0.52], 0.062, trs, s); box(0.09, 0.06, 0.2, dk, [x * 0.18, 0.31, z0 + 0.56], s, { cast: false }); } };
  person(-0.46, 0.22, jacket, helmet, true, true);
  if (pax) person(-0.82, 0.1, pax.jacket, pax.helmet, false, false);
  return s;
}

// ---------- the walker: a head with a conical hat, a torso, hinged legs (hip, knee) and arms (shoulder, elbow); pose(ph) swings them ----------
export function buildWalker() {
  const W = new THREE.Group(), shirt = std('#394a5e', { roughness: 0.85, emissive: '#080b10' }), trs = std('#262a36', { roughness: 0.85, emissive: '#06070a' }), skin = std('#86644c', { roughness: 0.8, emissive: '#0c0806' }), hat = std('#a89460', { roughness: 0.8, emissive: '#100d06', side: THREE.DoubleSide }), shoe = std('#17171c', { roughness: 0.8 });
  const torso = mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 10), shirt, [0, 1.2, 0], W, { cast: false, scale: [1.12, 1, 0.8] }); mesh(new THREE.CapsuleGeometry(0.135, 0.1, 4, 10), trs, [0, 0.96, 0], W, { cast: false, scale: [1.1, 1, 0.8] });
  cyl(0.045, 0.05, 0.1, skin, [0, 1.5, 0], W, { cast: false }, 8); ball(0.105, skin, [0, 1.62, 0.01], W, { cast: false }, 14);
  mesh(new THREE.ConeGeometry(0.31, 0.17, 22), hat, [0, 1.75, 0.01], W, { cast: false, scale: [1, 1, 0.96] }); box(0.2, 0.012, 0.012, trs, [0, 1.6, 0.1], W, { cast: false });
  const leg = (x) => { const hip = new THREE.Group(); hip.position.set(x, 0.92, 0); W.add(hip); mesh(new THREE.CapsuleGeometry(0.07, 0.3, 3, 8), trs, [0, -0.22, 0], hip, { cast: false });
    const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee); mesh(new THREE.CapsuleGeometry(0.06, 0.3, 3, 8), trs, [0, -0.21, 0], knee, { cast: false }); box(0.09, 0.06, 0.23, shoe, [0, -0.45, 0.05], knee, { cast: false }); return { hip, knee }; };
  const arm = (x) => { const sh = new THREE.Group(); sh.position.set(x, 1.4, 0); W.add(sh); mesh(new THREE.CapsuleGeometry(0.05, 0.2, 3, 8), shirt, [0, -0.17, 0], sh, { cast: false });
    const el = new THREE.Group(); el.position.set(0, -0.33, 0); sh.add(el); mesh(new THREE.CapsuleGeometry(0.045, 0.2, 3, 8), skin, [0, -0.16, 0], el, { cast: false }); ball(0.045, skin, [0, -0.36, 0], el, { cast: false }, 8); return { sh, el }; };
  const L = leg(-0.09), R = leg(0.09), aL = arm(-0.21), aR = arm(0.21);
  // phi = gait phase (rad). Forward = negative rotation about x. A knee bends while its leg swings forward; the arms swing against the legs.
  const pose = (phi) => { const s = Math.sin(phi), c = Math.cos(phi), c2 = Math.cos(phi + Math.PI);
    L.hip.rotation.x = -0.45 * s; R.hip.rotation.x = 0.45 * s; L.knee.rotation.x = 0.06 + 0.75 * Math.max(0, c); R.knee.rotation.x = 0.06 + 0.75 * Math.max(0, c2);
    aL.sh.rotation.x = 0.4 * s; aR.sh.rotation.x = -0.4 * s; aL.el.rotation.x = -0.25 - 0.15 * Math.max(0, -s); aR.el.rotation.x = -0.25 - 0.15 * Math.max(0, s);
    torso.rotation.y = 0.06 * s; };
  return { group: W, pose };
}
