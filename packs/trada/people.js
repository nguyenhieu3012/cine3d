// Trà đá với AI: the supporting people (Bà chủ quán, Mẹ, anh khách) as real 3-D characters in Tèo's chunky toy style.
// makePerson(opts) is one parametric human with the SAME API as makeTeo (name, root, body, head, R, headY, eyeUp, faces, poses, color, apply, headWorld).
// Local frame: origin on the floor, +z = the way the person faces, +x = screen-right when facing the camera. Seated people (stand: false) sit on a stool like Tèo.
// Hand targets in the pose tables carry a 4th number: 0 none, 1 = waving hand, 2 = wagging finger (blends smoothly, so a wave fades into a wag).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, hash, canvasTex, std, mesh, ball, cyl, lathe, V } from '../../core/util.js';
import { touchArm } from '../../core/touch.js';
import { Noodle, armCtrl, facePatch, onHead, blink, idle, contactBlob, legRig, usesLegs, pivotRot } from '../../core/rig.js';
import { TEO_FACE, TEO_POSE } from './chars.js';
import { makeStoolStack } from './thanks.js';

const INK = '#231a3d';
const shade = (hex, k) => { const c = new THREE.Color(hex); return '#' + (k >= 0 ? c.lerp(new THREE.Color('#ffffff'), k) : c.lerp(new THREE.Color('#000000'), -k)).getHexString(); };

// ---------- canvas cloth patterns ----------
function clothTex(kind, base, repeat, post = null) {
  if (kind === 'plain' && !post) return null;
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    if (kind === 'floral') {
      const petal = shade(base, 0.82), mid = '#ffd25e', leaf = shade('#3f9a5a', 0), spots = [[50, 60, 30], [170, 40, 24], [210, 150, 32], [90, 170, 28], [20, 220, 22], [150, 232, 20]];
      for (const [x, y, r] of spots) for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        const X = x + dx, Y = y + dy; if (X < -50 || X > w + 50 || Y < -50 || Y > h + 50) continue;
        c.fillStyle = leaf; for (let i = 0; i < 2; i++) { c.save(); c.translate(X, Y); c.rotate(0.9 + i * 2.4); c.beginPath(); c.ellipse(r * 1.15, 0, r * 0.55, r * 0.2, 0, 0, 7); c.fill(); c.restore(); }
        c.fillStyle = petal; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + x; c.beginPath(); c.arc(X + Math.cos(a) * r * 0.55, Y + Math.sin(a) * r * 0.55, r * 0.42, 0, 7); c.fill(); }
        c.fillStyle = mid; c.beginPath(); c.arc(X, Y, r * 0.3, 0, 7); c.fill();
      }
    } else if (kind === 'stripes') {
      c.fillStyle = shade(base, 0.28); for (let i = 0; i < 4; i++) c.fillRect(i * 64 + 8, 0, 22, h);
    } else if (kind === 'check') {
      c.fillStyle = 'rgba(255,255,255,0.38)'; for (let i = 0; i < 4; i++) { c.fillRect(i * 64, 0, 28, h); c.fillRect(0, i * 64, w, 28); }
      c.fillStyle = 'rgba(0,0,0,0.20)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.fillRect(i * 64, j * 64, 28, 28);
    }
    if (post) post(c, w, h);   // Zombie special: grime and rips drawn over the cloth (zombie.js)
  }, { repeat });
}
const clothMat = (kind, base, repeat, post = null) => { const map = clothTex(kind, base, repeat, post); return map ? std('#ffffff', { map, roughness: 0.9 }) : std(base, { roughness: 0.92 }); };

// ---------- poses (hand targets [x, y, z, w]; l = screen-left hand) ----------
export function personPoses(L = 0, stand = false) {
  const side = (s) => [s * 0.215, L + 0.37, 0.02, 0];
  const conv = (h, s) => (stand && h[1] === 0.41 ? side(s) : [h[0], h[1] + L, h[2], 0]);
  const out = {};
  for (const [k, v] of Object.entries(TEO_POSE)) out[k] = { ...v, l: conv(v.l, -1), r: conv(v.r, 1) };
  out.rest = { l: side(-1), r: side(1) };
  const hipL = [-0.21, L + 0.4, 0.03, 0], hipR = [0.21, L + 0.4, 0.03, 0];
  out.hips = { l: hipL, r: hipR };
  out.wave = { l: side(-1), r: [0.28, L + 0.99, 0.12, 1] };
  out.give = { l: stand ? hipL : side(-1), r: [0.16, L + 0.5, 0.29, 0], cup: 1 };
  out.give.r[1] = stand ? L + 0.52 : 0.62;
  out.scold = { l: stand ? hipL : side(-1), r: [0.2, L + 0.9, 0.2, 2] };
  out.stack = { l: [-0.15, L + 1.17, 0.03, 0], r: [0.15, L + 1.17, 0.03, 0], stack: 1, pumpHold: 1 };   // thank-you special: both hands up under a stack of stools (makeBa({ stack: 7 }))
  return out;
}

// ---------- props ----------
function phoneProp() { const g = new THREE.Group(); mesh(new RoundedBoxGeometry(0.075, 0.15, 0.009, 3, 0.008), std('#16161d', { roughness: 0.3, metalness: 0.4 }), [0, 0, 0], g); mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#bcd8ff', emissiveIntensity: 1.1 }), [0, 0, -0.0052], g, { cast: false, rot: [0, Math.PI, 0] }); return g; }
function glassProp(g, pos) { const q = new THREE.Group(); q.position.set(...pos); g.add(q); cyl(0.034, 0.027, 0.1, new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, roughness: 0.04 }), [0, 0, 0], q, { cast: false }, 20); cyl(0.03, 0.025, 0.078, std('#c8741f', { roughness: 0.15, emissive: '#6a3208', emissiveIntensity: 0.6 }), [0, -0.008, 0], q, {}, 20); return q; }
function cupProp() { const g = new THREE.Group(); glassProp(g, [0, 0, 0]); return g; }
function trayProp() { const g = new THREE.Group(); cyl(0.11, 0.1, 0.012, std('#cfd3da', { roughness: 0.3, metalness: 0.6 }), [0, 0, 0], g, {}, 28); cyl(0.095, 0.095, 0.004, std('#f3b3c6', { roughness: 0.5 }), [0, 0.007, 0], g, { cast: false }, 28); glassProp(g, [0.02, 0.062, 0]); glassProp(g, [-0.045, 0.062, 0.03]); return g; }

// sub-curve [f0, f1] of a quadratic Bezier (a, b, c) as three control points
const _B = (a, b, c, t, o) => o.copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(b, 2 * (1 - t) * t).addScaledVector(c, t * t);
function sub(a, b, c, f0, f1) { const p0 = _B(a, b, c, f0, V()), p2 = _B(a, b, c, f1, V()), d = b.clone().sub(a).multiplyScalar(1 - f0).addScaledVector(c.clone().sub(b), f0).multiplyScalar(f1 - f0); return [p0, p0.clone().add(d), p2]; }

const TORSO = [[0.001, 0.3], [0.13, 0.3], [0.168, 0.36], [0.172, 0.46], [0.155, 0.58], [0.128, 0.68], [0.085, 0.735], [0.04, 0.752], [0.001, 0.755]];
const rAt = (y) => { for (let i = 0; i < TORSO.length - 1; i++) { const [r0, y0] = TORSO[i], [r1, y1] = TORSO[i + 1]; if (y >= y0 && y <= y1) return lerp(r0, r1, (y - y0) / (y1 - y0)); } return 0.04; };

// =====================================================================================================================
export function makePerson(o = {}) {
  const { name = 'person', skin = '#f1c7a3', hair = 'short', hairColor = '#2a2024', top = '#6aa0d8', pattern = 'plain', bottom = '#3a3f58', bottomPattern = 'plain', glasses = false, age = 'young', build = 1,
    stand = false, color = '#ffffff', seed = 3, shoe = '#f4f1ea', sleeve = 1, legFrac = 1, lift = null, cardigan = null, blouse = null, tie = null, collar = null, defaultFace = null, brow = null, lips = null, lash = false, hem = true,
    // Zombie special (13/11): clothFx (c, w, h) draws grime / rips over the cloth; alt = { skin, draw(ctx, f, talk, t, info), sheen } a second face and skin that fx turn (0..1) blends in
    // (turnDef = the value without fx); decorate({ root, rig, body, head, R, L, hipY, skinM, topM, hairM, bottomM }) adds meshes and returns { update(p, t, api) }
    clothFx = null, alt = null, turnDef = 0, decorate = null } = o;
  const old = age === 'old', R = 0.17, L = stand ? (lift ?? 0.38) : 0, hipY = 0.3 + L, root = new THREE.Group(); root.name = name;
  const rig = new THREE.Group(); root.add(rig); const legsG = new THREE.Group(), body = new THREE.Group(); rig.add(legsG, body);   // body = everything above the hips (leans, twists, breathes); rig = all of it (falls, lies down)
  const PIV = V(0, hipY, 0);

  const skinM = new THREE.MeshPhysicalMaterial({ color: skin, roughness: 0.58, sheen: 0.5, sheenColor: new THREE.Color(shade(skin, 0.3)), sheenRoughness: 0.6 });
  const topBase = cardigan || top, topM = clothMat(cardigan ? 'plain' : pattern, topBase, pattern === 'check' ? [6, 4] : [3, 2], clothFx), bottomM = clothMat(bottomPattern, bottom, [3, 2], clothFx), trim = std(shade(topBase, -0.18), { roughness: 0.95 });

  // ---- torso (a soft bell, like Tèo's) ----
  const TP = stand ? [[0.001, 0.23], [0.145, 0.23], [0.158, 0.27], [0.166, 0.34], ...TORSO.slice(3)] : TORSO;
  const torso = lathe(TP.map(([r, y]) => [r, y - 0.3]), topM, [0, hipY, 0], body); torso.scale.set(build, 1, 0.82 * lerp(1, build, 0.5));
  if (hem && !cardigan && pattern === 'plain') mesh(new THREE.TorusGeometry(0.148, 0.018, 10, 36), trim, [0, hipY + 0.018, 0], body, { rot: [Math.PI / 2, 0, 0], scale: [build, 0.82, 1] });
  const zs = 0.82 * lerp(1, build, 0.5), front = (y) => rAt(y) * zs;
  // a narrow vertical strip that follows the torso's surface (blouse under a cardigan, a tie)
  const strip = (mat, y0, y1, half, off) => { const pts = []; for (let i = 0; i <= 8; i++) { const y = lerp(y0, y1, i / 8); pts.push(new THREE.Vector2(rAt(y) + off, y - 0.3)); } const m = mesh(new THREE.LatheGeometry(pts, 10, -half / 0.16, 2 * half / 0.16), mat, [0, hipY, 0], body); m.scale.set(build, 1, zs); return m; };
  // blouse panel + buttons under an open cardigan
  if (cardigan) {
    const bl = std(blouse || '#f6ead8', { roughness: 0.85 });
    strip(bl, 0.4, 0.72, 0.05, 0.005);
  }
  // pelvis in the trousers' colour, so the hem never shows a hole
  mesh(new THREE.SphereGeometry(0.125, 24, 16), bottomM, [0, hipY - 0.025, 0], body, { scale: [1.0 * build, 0.75, 0.74] });
  // neck (short and sturdy, unlike Tèo's stick) + collar
  cyl(0.032, 0.036, 0.12, skinM, [0, 0.775 + L, 0.002], body, {}, 16);
  const colC = std(collar || blouse || top, { roughness: 0.9 });
  mesh(new THREE.TorusGeometry(0.058, 0.014, 10, 28), colC, [0, 0.748 + L, 0.004], body, { rot: [Math.PI / 2 - 0.12, 0, 0], scale: [1, 1.1, 1] });
  if (tie) {
    const tm = std(tie, { roughness: 0.55 });
    strip(tm, 0.5, 0.685, 0.017, 0.006); mesh(new THREE.SphereGeometry(1, 14, 12), tm, [0, L + 0.7, front(0.7) + 0.003], body, { scale: [0.02, 0.017, 0.014] });
  }

  // ---- legs ----
  const shoeM = std(shoe, { roughness: 0.6 }), legR = (stand ? 0.06 : 0.052) * (0.9 + 0.1 * build);
  const legs = [-1, 1].map((s) => {
    const a = stand ? V(s * 0.07, hipY - 0.02, 0.0) : V(s * 0.075 * build, 0.33, 0.02), b = stand ? V(s * 0.078, hipY * 0.5, 0.006) : V(s * 0.1, 0.37, 0.3), c = stand ? V(s * 0.085, 0.095, 0.012) : V(s * 0.1, 0.08, 0.27);
    const cl = new Noodle(legR, bottomM, legsG, { seg: 12, taper: stand ? 0.85 : 1 }); let sk = null, ring = null;
    if (legFrac >= 1) cl.set(a, b, c);
    else { const [p0, p1, p2] = sub(a, b, c, 0, legFrac); cl.set(p0, p1, p2); sk = new Noodle(legR * 0.72, skinM, legsG, { seg: 8 }); const [q0, q1, q2] = sub(a, b, c, legFrac - 0.04, 1); sk.set(q0, q1, q2); ring = mesh(new THREE.TorusGeometry(legR * 0.8, 0.01, 8, 18), trim, [p2.x, p2.y, p2.z], legsG, { rot: [Math.PI / 2, 0, 0] }); }
    const fx = stand ? s * 0.085 : s * 0.1, fz = stand ? 0.04 : 0.31;
    const shoeMesh = mesh(new THREE.SphereGeometry(0.056, 20, 14), shoeM, [fx, 0.038, fz], legsG, { scale: [0.95, 0.66, 1.5] });
    return { cl, sk, ring, shoeMesh, a, b, c, shoe0: shoeMesh.position.clone() };
  });
  let legsMoved = false;
  if (stand) contactBlob(0.5, 0.45, legsG, [0, 0.004, 0.03], 0.5);

  // ---- arms ----
  const armR = 0.038 * (0.9 + 0.1 * build), sleeveL = new Noodle(armR, topM, body, { taper: 0.84 }), sleeveR = new Noodle(armR, topM, body, { taper: 0.84 });
  const skinL = new Noodle(armR * 0.78, skinM, body, { seg: 8 }), skinR = new Noodle(armR * 0.78, skinM, body, { seg: 8 });
  const handL = ball(0.044, skinM, [0, 0, 0], body, {}, 24), handR = ball(0.044, skinM, [0, 0, 0], body, {}, 24);
  const cuffL = mesh(new THREE.TorusGeometry(armR * 0.9, 0.011, 8, 20), trim, [0, 0, 0], body), cuffR = mesh(new THREE.TorusGeometry(armR * 0.9, 0.011, 8, 20), trim, [0, 0, 0], body);
  const shoulders = [-1, 1].map(() => ball(armR * 1.1, topM, [0, 0, 0], body, {}, 16));   // caps the open end of each sleeve
  const fingerOf = () => { const g = new THREE.Group(); cyl(0.012, 0.013, 0.07, skinM, [0, 0.045, 0], g, {}, 10); ball(0.0125, skinM, [0, 0.082, 0], g, {}, 10); body.add(g); g.visible = false; return g; };
  const fingers = [fingerOf(), fingerOf()];
  const phone = phoneProp(), cup = stand ? trayProp() : cupProp(); body.add(phone, cup); phone.visible = cup.visible = false;

  // ---- head ----
  const head = new THREE.Group(); head.position.set(0, 0.955 + L, 0); head.rotation.order = 'YXZ'; body.add(head);
  ball(R, skinM, [0, 0, 0], head, {}, 64);
  const face = facePatch(R, { rough: 0.55 }); head.add(face.mesh);
  const altFace = alt ? facePatch(R, { rough: 0.6 }) : null; if (altFace) { head.add(altFace.mesh); altFace.mesh.renderOrder = 3; if (alt.glow) { altFace.mesh.material.emissive = new THREE.Color('#ffffff'); altFace.mesh.material.emissiveMap = altFace.tex; altFace.mesh.material.emissiveIntensity = alt.glow; } }
  const skin0 = new THREE.Color(skin), skin1 = alt ? new THREE.Color(alt.skin) : null;
  // alt.skinTex(ctx, w, h, k, colour): a painted skin (rot, veins, blotches) at strength k, redrawn only when the turn moves by 1/64 (a ramp, never a switch)
  const skinT = alt?.skinTex ? canvasTex(256, 256, () => {}, { repeat: [2, 1] }) : null; let skinK = -1; if (skinT) { skinM.map = skinT; skinM.color.set('#ffffff'); }
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.036, 16, 12), skinM, [s * R * 0.975, -0.004, -0.012], head, { scale: [0.38, 1, 0.75] });
  mesh(new THREE.SphereGeometry(1, 16, 12), skinM, onHead(R, 0, -8, 1.0).toArray(), head, { scale: [0.0115, 0.0135, 0.0125], cast: false });
  // hair
  const hairM = new THREE.MeshPhysicalMaterial({ color: hairColor, roughness: 0.45, sheen: 0.15, sheenColor: new THREE.Color(shade(hairColor, 0.15)), sheenRoughness: 0.4 });
  const cap = (th, tilt, rad = 1.035) => mesh(new THREE.SphereGeometry(R * rad, 48, 28, 0, Math.PI * 2, 0, th), hairM, [0, 0.004, -0.012], head, { rot: [tilt, 0, 0] });
  const curtain = (a0, th0, th1, rad = 1.05) => { const a = THREE.MathUtils.degToRad(a0); return mesh(new THREE.SphereGeometry(R * rad, 48, 24, Math.PI / 2 + a, Math.PI * 2 - 2 * a, th0, th1 - th0), hairM, [0, 0, -0.008], head); };
  const blob = (x, y, z, sx, sy, sz, rz = 0) => mesh(new THREE.SphereGeometry(1, 24, 16), hairM, [x, y, z], head, { scale: [sx, sy, sz], rot: [0, 0, rz] });
  if (hair === 'short') {
    cap(Math.PI * 0.38, -0.32); curtain(100, Math.PI * 0.28, Math.PI * 0.47);
    for (const [x, y, z, sx, sy, sz, rz] of [[0.04, 0.152, 0.08, 0.1, 0.05, 0.08, -0.25], [-0.045, 0.165, 0.085, 0.105, 0.05, 0.08, 0.15], [-0.105, 0.15, 0.065, 0.07, 0.045, 0.065, 0.55], [0.09, 0.14, 0.07, 0.07, 0.04, 0.07, -0.5], [0, 0.17, 0, 0.13, 0.05, 0.12, 0]]) blob(x, y, z, sx, sy, sz, rz);
  } else if (hair === 'bun') {
    cap(Math.PI * 0.4, -0.3); curtain(100, Math.PI * 0.28, Math.PI * 0.6);
    blob(0, 0.175, -0.1, 0.075, 0.07, 0.07); mesh(new THREE.TorusGeometry(0.052, 0.014, 8, 20), hairM, [0, 0.168, -0.098], head, { rot: [Math.PI / 2 + 0.3, 0, 0] });
    for (const s of [-1, 1]) blob(s * 0.12, 0.085, 0.07, 0.03, 0.05, 0.04, s * 0.2);
  } else if (hair === 'bob' || hair === 'long') {
    cap(Math.PI * 0.4, -0.3); curtain(hair === 'bob' ? 54 : 56, Math.PI * 0.28, Math.PI * (hair === 'bob' ? 0.76 : 0.86), hair === 'bob' ? 1.09 : 1.05);
    blob(0, 0.108, 0.13, 0.11, 0.03, 0.04, 0); blob(-0.065, 0.1, 0.12, 0.06, 0.03, 0.045, 0.4); blob(0.065, 0.1, 0.12, 0.06, 0.03, 0.045, -0.4);   // fringe
    if (hair === 'long') { blob(0, -0.2, -0.1, 0.15, 0.2, 0.06); for (const s of [-1, 1]) blob(s * 0.152, -0.13, -0.03, 0.035, 0.15, 0.06, 0); }
  }
  // glasses
  if (glasses) {
    const rimM = new THREE.MeshPhysicalMaterial({ color: glasses, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 }), lensM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.03, depthWrite: false }), P = new THREE.Vector3();
    for (const s of [-1, 1]) { onHead(R, s * 19.5, 4, 1.035, P); const rim = mesh(new THREE.TorusGeometry(0.0535, 0.0072, 14, 44), rimM, [P.x, P.y, P.z], head); rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), P.clone().normalize()); const lens = mesh(new THREE.CircleGeometry(0.052, 32), lensM, [P.x, P.y, P.z], head, { cast: false }); lens.quaternion.copy(rim.quaternion); lens.renderOrder = 3;
      const A = onHead(R, s * 38, 4, 1.045, new THREE.Vector3()), B = onHead(R, s * 88, 7, 1.02, new THREE.Vector3()), mid = A.clone().add(B).multiplyScalar(0.5); const tm = cyl(0.0042, 0.0042, A.distanceTo(B), rimM, [mid.x, mid.y, mid.z], head, {}, 8); tm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); }
    onHead(R, 0, 5.5, 1.045, P); mesh(new THREE.TorusGeometry(0.014, 0.0055, 8, 16, Math.PI), rimM, [P.x, P.y - 0.004, P.z], head);
  }

  // ---- faces: same parameter names as Tèo's, so TEO_FACE entries work here ----
  const faces = { ...TEO_FACE }; if (defaultFace) faces.neutral = TEO_FACE[defaultFace];
  const browC = brow || (old ? '#5b5260' : shade(hairColor, -0.2)), lipC = lips || (stand || lash ? '#a8353f' : '#7a3a3a'), EY = 19.5, EP = 4, wrk = 'rgba(120,64,48,0.55)';
  function drawFace(f, talk, t) {
    const c = face.ctx, S = face.size, cx = S / 2, ex = EY * face.px, ey = S / 2 - EP * face.py; c.clearRect(0, 0, S, S);
    const bl = blink(t, seed), open = clamp(f.eye * (1 - bl)), arc = clamp(f.arc), sz = f.size || 1;
    c.lineCap = 'round'; c.lineJoin = 'round';
    // wrinkles of an old face: forehead, crow's feet, smile lines (stronger when the face smiles)
    if (old) {
      c.strokeStyle = wrk; c.lineWidth = 4;
      for (const k of [0, 1]) { c.beginPath(); c.moveTo(cx - 62 + k * 8, ey - 100 - k * 14 - f.brow * 8); c.quadraticCurveTo(cx, ey - 108 - k * 14 - f.brow * 8, cx + 62 - k * 8, ey - 100 - k * 14 - f.brow * 8); c.stroke(); }
      for (const s of [-1, 1]) { for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(cx + s * (ex + 34), ey + 2 + i * 4); c.lineTo(cx + s * (ex + 56), ey - 6 + i * 16); c.stroke(); }
        c.globalAlpha = 0.5 + 0.5 * clamp(f.smile); c.beginPath(); c.moveTo(cx + s * 30, ey + 60); c.quadraticCurveTo(cx + s * 54, ey + 96, cx + s * 52, ey + 124); c.stroke(); c.globalAlpha = 1; }
    }
    // blush: bigger and softer on old cheeks
    if (f.blush > 0.01) for (const s of [-1, 1]) { const rr = old ? 50 : 36, g = c.createRadialGradient(cx + s * 100, ey + 80, 2, cx + s * 100, ey + 80, rr); g.addColorStop(0, `rgba(255,96,112,${0.5 * f.blush})`); g.addColorStop(1, 'rgba(255,96,112,0)'); c.fillStyle = g; c.fillRect(cx + s * 100 - rr, ey + 80 - rr, rr * 2, rr * 2); }
    // eyes
    for (const s of [-1, 1]) {
      const x = cx + s * ex + (f.px || 0) * 14, y = ey + (f.py || 0) * 12 + 2;
      if (arc > 0.5) { c.strokeStyle = INK; c.lineWidth = 10; c.beginPath(); c.arc(x, y + 10, 22, Math.PI * 1.13, Math.PI * 1.87); c.stroke(); }
      else if (open < 0.14) { c.strokeStyle = INK; c.lineWidth = 9; c.beginPath(); c.moveTo(x - 20, y + 3); c.quadraticCurveTo(x, y + 9, x + 20, y + 3); c.stroke(); }
      else { const rx = 16 * sz, ry = 22 * sz * lerp(0.35, 1, open); c.fillStyle = INK; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x - rx * 0.3, y - ry * 0.38, 4.6 * sz, 0, 7); c.fill(); c.beginPath(); c.arc(x + rx * 0.3, y + ry * 0.3, 2.2 * sz, 0, 7); c.fill();
        c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.moveTo(x - rx - 5, y - ry + 1); c.lineTo(x + rx + 5, y - ry + 1 + (f.skew ? -s * 3 : 0)); c.stroke();   // upper lid line (lets the eye read on skin)
        if (lash) { c.lineWidth = 5; for (const k of [0, 1]) { c.beginPath(); c.moveTo(x + s * (rx + 3), y - ry + 3 + k * 6); c.lineTo(x + s * (rx + 15), y - ry - 7 + k * 8); c.stroke(); } } }
    }
    // brows: dark and thick, closer to the eyes than Tèo's because there are no rims in between
    const boff = glasses ? 92 : 66;
    for (const s of [-1, 1]) { const x = cx + s * ex, by = ey - boff - f.brow * 16 - (f.skew && s > 0 ? 9 : 0), inn = -f.tilt * 15; c.strokeStyle = browC; c.lineWidth = 16; c.beginPath(); c.moveTo(x - s * 30, by + inn); c.quadraticCurveTo(x, by - 8 + inn * 0.25, x + s * 32, by + 5 - inn * 0.35); c.stroke(); }
    // mouth
    const my = S / 2 + 22 * face.py, mo = clamp(Math.max(f.open, talk * 0.95)), w = 30 * (f.wide || 1) * (1 + talk * 0.18 * Math.sin(t * 23)), sm = f.smile, mx = cx + (f.skew ? 9 : 0);
    if (mo > 0.08) { const h = 5 + mo * 30; c.fillStyle = '#3a1630'; c.strokeStyle = lipC; c.lineWidth = 8; c.beginPath(); c.moveTo(mx - w, my - sm * 5); c.quadraticCurveTo(mx, my - sm * 5 - h * 0.25 + (sm < 0 ? -6 : 2), mx + w, my - sm * 5); c.quadraticCurveTo(mx + w * 0.9, my + h * (sm > 0 ? 1.2 : 0.8), mx, my + h); c.quadraticCurveTo(mx - w * 0.9, my + h * (sm > 0 ? 1.2 : 0.8), mx - w, my - sm * 5); c.closePath(); c.fill(); c.stroke();
      c.save(); c.clip(); c.fillStyle = '#ff7f8f'; c.beginPath(); c.ellipse(mx, my + h + 3, w * 0.62, h * 0.55, 0, 0, 7); c.fill(); if (mo > 0.3 && sm > 0.2) { c.fillStyle = '#fff'; c.fillRect(mx - w, my - sm * 5 - 6, w * 2, 11); } c.restore(); }
    else { c.strokeStyle = lipC; c.lineWidth = 9; c.beginPath(); c.moveTo(mx - w, my - sm * 9); c.quadraticCurveTo(mx, my + sm * 17, mx + w, my - sm * 9 - (f.skew ? 7 : 0)); c.stroke(); }
    if (f.sweat > 0.05) { const k = (t * 0.8) % 1, x = cx + 132, y = ey - 96 + k * 26; c.globalAlpha = f.sweat * (1 - k * 0.6); c.fillStyle = '#8fd2ff'; c.beginPath(); c.moveTo(x, y - 17); c.quadraticCurveTo(x + 13, y + 3, x, y + 9); c.quadraticCurveTo(x - 13, y + 3, x, y - 17); c.fill(); c.globalAlpha = 1; }
    if (f.tear > 0.05) for (const s of [-1, 1]) { const k = (t * 0.9 + (s > 0 ? 0.4 : 0)) % 1, x = cx + s * (ex + 6), y = ey + 62 + k * 60; c.globalAlpha = f.tear * (1 - k); c.fillStyle = '#8fd2ff'; c.beginPath(); c.ellipse(x, y, 7, 11, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
    face.tex.needsUpdate = true;
  }

  const poses = personPoses(L, stand), sx = 0.118 + 0.01 * build;
  const S0 = [V(-sx, 0.675 + L, 0), V(sx, 0.675 + L, 0)], H = [V(), V()], C = V(), skins = [skinL, skinR], sleeves = [sleeveL, sleeveR], hands = [handL, handR], cuffs = [cuffL, cuffR], q = new THREE.Quaternion();
  const deco = decorate ? decorate({ root, rig, body, head, R, L, hipY, skinM, topM, hairM, bottomM, trim, H, legs }) : null;
  const api = {
    name, root, body, head, R, headY: 0.955 + L, eyeUp: R * 0.07, faces, poses, color, stand,
    reach: () => ({ pivotY: hipY, shoulderY: 0.675 + L, sx }),   // 22/11: where the shoulders are (core/touch.js leans him in to a surface)
    apply(p, t) {
      const id = idle(t, seed), br = id.breathe;
      body.rotation.set(p.lean || 0, p.twist || 0, id.sway * (stand ? 0.9 : 0.6) + (p.bodyRoll || 0));
      body.position.copy(PIV).sub(PIV.clone().applyQuaternion(body.quaternion)); body.position.y += (p.bob || 0);
      // ---- Zombie special: walking legs (stand only), falling, lying; off by default ----
      const LR = stand && usesLegs(p) ? legRig(p, { hx: 0.07, hipY: hipY - 0.02, ankle: 0.095 }) : null;
      if (LR) { legsMoved = true;
        legs.forEach((g, i) => { const Hh = LR.H[i].clone(), A = LR.A[i], Cc = LR.C[i]; Hh.x += LR.sway; Hh.z += 0.01;
          if (!g.sk) g.cl.set(Hh, Cc, A); else { const [p0, p1, p2] = sub(Hh, Cc, A, 0, legFrac); g.cl.set(p0, p1, p2); const [q0, q1, q2] = sub(Hh, Cc, A, legFrac - 0.04, 1); g.sk.set(q0, q1, q2); g.ring.position.copy(p2); }
          g.shoeMesh.position.set(A.x, A.y - 0.057, A.z + 0.028); g.shoeMesh.rotation.set(-LR.tilt[i], 0, 0); });
        const q = new THREE.Euler((p.lean || 0) + LR.lean, p.twist || 0, id.sway * 0.9 + LR.roll + (p.bodyRoll || 0)); body.rotation.copy(q); body.position.copy(PIV).sub(PIV.clone().applyEuler(q)); body.position.y += LR.dy + (p.bob || 0); body.position.x += LR.sway;
      } else if (legsMoved) { legsMoved = false; legs.forEach((g) => { if (!g.sk) g.cl.set(g.a, g.b, g.c); else { const [p0, p1, p2] = sub(g.a, g.b, g.c, 0, legFrac); g.cl.set(p0, p1, p2); const [q0, q1, q2] = sub(g.a, g.b, g.c, legFrac - 0.04, 1); g.sk.set(q0, q1, q2); g.ring.position.copy(p2); } g.shoeMesh.position.copy(g.shoe0); g.shoeMesh.rotation.set(0, 0, 0); }); }
      const fall = clamp(p.fall || 0), lie = clamp(p.lie || 0);
      if (fall > 0 || lie > 0 || rig.rotation.x !== 0 || rig.rotation.z !== 0) { pivotRot(rig, new THREE.Euler(fall * 1.45, 0, -lie * Math.PI / 2 * 0.96), V(lie * 0.17, 0, fall > 0 ? 0.17 : 0)); rig.position.y += p.fallBounce || 0; }
      const tn = alt ? clamp(p.turn ?? turnDef) : 0;
      if (alt) { if (skinT) { const kq = Math.round(tn * 64) / 64; if (kq !== skinK) { skinK = kq; const col = '#' + skin0.clone().lerp(skin1, kq).getHexString(); alt.skinTex(skinT.userData.ctx, 256, 256, kq, col); skinT.needsUpdate = true; } } else skinM.color.copy(skin0).lerp(skin1, tn); skinM.sheen = lerp(0.5, alt.sheen ?? 0.15, tn); face.mesh.material.opacity = 1 - tn; altFace.mesh.material.opacity = tn; altFace.mesh.visible = tn > 0.003; face.mesh.visible = tn < 0.997; }
      const sq = LR ? (LR.squash || 0) : 0; torso.scale.set(build * (1 + br * 0.008 + 0.05 * sq), 1 + br * 0.012 - 0.07 * sq, 0.82 * lerp(1, build, 0.5) + br * 0.012 + 0.04 * sq);
      head.position.y = 0.955 + L + br * 0.004 + (p.shrug || 0) * -0.012;
      head.rotation.set(-(p.pitch || 0) - id.headPitch - (p.talkSlow ?? p.talk ?? 0) * 0.03, (p.yaw || 0) + id.headYaw, (p.roll || 0) + id.headRoll);
      if (LR && LR.rk > 0) head.rotation.y = lerp(head.rotation.y, id.headYaw, 0.8 * LR.rk);
      const sh = (p.shrug || 0) * 0.035;
      [[p.l, -1, 0], [p.r, 1, 1]].forEach(([tg, s, i]) => {
        const w = tg[3] || 0, wave = Math.max(0, 1 - Math.abs(w - 1)), wag = clamp(w - 1);
        const S = S0[i].clone(); S.y += sh; shoulders[i].position.copy(S);
        H[i].set(tg[0] + Math.sin(t * 9.5) * 0.05 * wave + Math.sin(t * 12) * 0.028 * wag, tg[1] + br * 0.003 + Math.sin(t * 9.5 + 1.2) * 0.012 * wave, tg[2]);
        if (LR && LR.amt > 0 && !p.noPump) { const f = (i ? 1 : -1) * LR.pump / Math.max(1e-3, LR.amt), rk = LR.rk; H[i].lerp(V(s * 0.21, L + 0.43 + 0.07 * rk + (0.14 * rk + 0.03) * Math.max(0, f), 0.05 + (0.1 + 0.1 * rk) * f), LR.amt * (1 - (p.pumpHold || 0))); }   // arms pump opposite to the legs
        if (p.touch) touchArm(p.touch, i, H[i], body, S);   // 22/11: hand contact (ep.touch)
        armCtrl(S, H[i], 0.37, s, C); hands[i].position.copy(H[i]);
        const dir = H[i].clone().sub(C).normalize();
        if (sleeve >= 1) { sleeves[i].set(S, C, H[i]); skins[i].mesh.visible = false; cuffs[i].position.copy(H[i]).addScaledVector(dir, -0.04); }
        else { const [a0, a1, a2] = sub(S, C, H[i], 0, sleeve), [b0, b1, b2] = sub(S, C, H[i], sleeve - 0.04, 1); sleeves[i].set(a0, a1, a2); skins[i].set(b0, b1, b2); skins[i].mesh.visible = true; cuffs[i].position.copy(a2); dir.copy(a2).sub(a1).normalize(); }
        cuffs[i].quaternion.setFromUnitVectors(V(0, 0, 1), dir);
        fingers[i].visible = wag > 0.25; fingers[i].position.copy(H[i]).add(V(0, 0.02, 0)); fingers[i].scale.setScalar(0.4 + 0.6 * wag);
      });
      phone.visible = (p.phone || 0) > 0.5; if (phone.visible) { phone.position.copy(H[1]).add(V(-0.02, 0.07, 0.03)); phone.rotation.set(-0.35, 0.25, 0.08); }
      cup.visible = (p.cup || 0) > 0.5;
      if (cup.visible) { if (stand) { cup.position.copy(H[1]).add(V(0.0, 0.035, 0.05)); cup.rotation.set(0, 0, 0); } else { cup.position.copy(H[1]).add(V(-0.03, 0.03, 0.04)); cup.rotation.set(-0.5 * (p.cup || 0), 0, 0.1); } }
      if (!alt || tn < 0.997) drawFace(p.face, p.talk || 0, t);
      if (alt && tn > 0.003) { alt.draw(altFace.ctx, p.face, p.talk || 0, t, { S: altFace.size, px: altFace.px, py: altFace.py, EY, EP, p, seed }); altFace.tex.needsUpdate = true; }
      deco?.update?.(p, t, api, H);
    },
    headWorld(out = V()) { return head.getWorldPosition(out); },
  };
  root.userData.api = api; return api;
}

// ---------- the three ready characters ----------
// Bà chủ quán: old, grey bun, round smiling face with closed happy eyes, pink floral đồ bộ (short sleeves, three-quarter trousers)
// makeBa({ stack: 7 }) (castOpts ba: { stack: 7 }) gives her a stack of 7 plastic stools to carry above her head: pose `stack` lifts both hands under it (the stack grows out of her hands with the pose,
// wobbles on slow waves, more at the top; fx `wobble` 0..1 scales that, default 1); with fx walk (+ x / z or path()) she walks in with it. Nothing changes without the option.
export function makeBa({ stack = 0 } = {}) {
  const decorate = stack ? ({ body, L }) => { const S = makeStoolStack(stack), g = S.group; body.add(g); g.visible = false;
    return { update(p, t, api, H) { const k = clamp(((p.stack || 0) - 0.15) / 0.7), kk = k * k * (3 - 2 * k); g.visible = kk > 0.01; if (!g.visible) return;
      const wb = (p.wobble ?? 1) * (0.55 + 0.45 * Math.sin(t * 0.9)), mx = (H[0].x + H[1].x) / 2, my = (H[0].y + H[1].y) / 2, mz = (H[0].z + H[1].z) / 2;
      g.position.set(mx, my + 0.02 + (1 - kk) * -0.25, mz); g.scale.setScalar(0.3 + 0.7 * kk);
      g.rotation.set(0.07 * wb * Math.sin(t * 2.3 + 1), 0.05 * Math.sin(t * 1.1), 0.11 * wb * Math.sin(t * 3.1) + 0.05 * wb * Math.sin(t * 5.3 + 2));   // tilts about the hands; the units sway on top of that, the top most
      S.units.forEach((u, i) => { const h = i / Math.max(1, S.units.length - 1); u.position.x = 0.03 * h * h * wb * Math.sin(t * 3.3 + i * 0.35); u.position.z = 0.02 * h * h * wb * Math.sin(t * 2.7 + 1.2 + i * 0.3); }); } }; } : null;
  return makePerson({ decorate, name: 'ba', skin: '#e8b088', hair: 'bun', hairColor: '#9a98a6', top: '#f2709f', pattern: 'floral', bottom: '#f2709f', bottomPattern: 'floral', age: 'old', build: 1.06, stand: true, lift: 0.34,
    sleeve: 0.5, legFrac: 0.68, shoe: '#e9ddc6', collar: '#fff2f6', defaultFace: 'happy', color: '#ff9ac2', seed: 11, hem: false });
}
// Mẹ: middle-aged, dark low bob, teal cardigan over a cream blouse, dark trousers
export function makeMe() {
  return makePerson({ name: 'me', skin: '#e6b08c', hair: 'bob', hairColor: '#2b1f26', top: '#f6ead8', blouse: '#f6ead8', cardigan: '#3f8088', bottom: '#3b3550', age: 'young', build: 0.97, stand: true, lift: 0.4,
    shoe: '#4a3d3a', lash: true, color: '#ffb46a', seed: 17 });
}
// anh khách: young man, short hair, blue check shirt and red tie, seated on a stool
export function makeKhach() {
  return makePerson({ name: 'khach', skin: '#dfa982', hair: 'short', hairColor: '#241c22', top: '#7fb0e6', pattern: 'check', tie: '#d4333c', collar: '#9cc3ee', bottom: '#2f3550', age: 'young', build: 1.06, stand: false,
    shoe: '#3a302c', color: '#9ad0ff', seed: 23 });
}
