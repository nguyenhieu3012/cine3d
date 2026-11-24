// Trà đá với AI, "Tèo vào GTA 6" part 3 NEW (gta6p3b, 21/11): extras ADDED to the existing `sea` place of the composite set `gta` (called from gta_world.js when setOpts.p3b is given).
//   two police boats `pb1` `pb2` (white hull, navy cabin, light bar, `CẢNH SÁT`, wake + spray), a sandbar, a helicopter `heli` with a searchlight beam + a SpotLight on its target + a light pool on the water,
//   a small ISLAND (sand plateau, five palms, two sun loungers, a duck float on the sand, a tilted tea cup), the silver car for the pier, sacks (fx `sack` 0..1 on `teo` / `bip`), Linh's sunglasses (fx `shades`).
// setOpts.p3b = { paths: { sea: { sv, pb1, pb2, heli, heliAt }, ... }, island: { x, z } }. fx on 'set' (all 0..1 ramps): heliOn heliLight pb1On pb2On island cupEnd sackTeo sackBip shades svpaint svdrv svpass, + every sv car fx (the silver car).
// A frame is a pure function of t. Nothing here is built unless asked.
import * as THREE from 'three';
import { clamp, lerp, smooth, hash, noise1, canvasTex, grain, std, mesh, box, cyl, ball } from '../../core/util.js';
import { FONT, addMat, mergeList, xf } from './gta_bank.js';
import { addPalm, finishPalms } from './gta_world.js';
import { buildSilverCar } from './gta_p2b_props.js';
import { makeTeaGlass } from './gta_cars.js';
import { buildDuck, DUCK_SEAT, waveH, waveGrad, carFxFrom } from './gta_sea.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const NC = (o) => { o.userData.noClip = true; return o; };
const glowTex = (() => { let t = null; return () => (t ||= canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); })); })();
const spr = (parent, col, size, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.scale.setScalar(size); parent.add(s); return s; };
const foam = (() => { let t = null; return () => (t ||= canvasTex(64, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); const gx = c.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = gx; c.fillRect(0, 0, w, h); })); })();
export const ISL = { x: -172, z: -150, r: 10, top: 0.38 };

// ---- a burlap sack that goes over a head (fx sack 0 = high above, 1 = on the head); r = head radius ----
export function makeSack(r) {
  const g = new THREE.Group(); g.visible = false;
  const bt = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#d9c39a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(120,90,50,${0.04 + 0.05 * hash(i)})`; c.beginPath(); c.ellipse(hash(i * 3.1) * w, hash(i * 5.3) * h, 30 + 60 * hash(i + 2), 6 + 14 * hash(i + 4), hash(i) * 3, 0, 7); c.fill(); } grain(c, w, h, 900, 0.05, 4, 3); }, { repeat: [1, 1] });
  const m = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95, side: THREE.DoubleSide });
  // a soft slack cloth sack: gathered at the neck by a drawstring, bulging round, a rounded slumped top (no point)
  const prof = [[0.98, -1.18], [1.08, -0.95], [1.38, -0.55], [1.6, 0.05], [1.62, 0.75], [1.42, 1.3], [1.0, 1.66], [0.5, 1.82], [0.0, 1.85]].map(([a2, b2]) => new THREE.Vector2(a2 * r, b2 * r));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), m); body.castShadow = true; body.scale.set(1, 1, 0.94); g.add(body);
  const slump = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 20, 14), m); slump.position.set(r * 0.55, r * 1.55, 0); slump.scale.set(1, 0.7, 0.9); g.add(slump);   // the slack top flops to one side
  const frill = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.16, 10, 32), m); frill.position.y = -r * 1.08; frill.rotation.x = Math.PI / 2; frill.scale.set(1, 1, 0.8); g.add(frill);   // the gathered cloth at the neck
  const cord = std('#4a3018', { roughness: 0.9 }); const rope = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, r * 0.055, 8, 32), cord); rope.position.y = -r * 1.0; rope.rotation.x = Math.PI / 2; g.add(rope);
  for (const sgn of [-1, 1]) { const tail = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.04, r * 0.5, 4, 6), cord); tail.position.set(sgn * r * 0.35, -r * 1.32, r * 0.95); tail.rotation.set(0.3, 0, sgn * 0.35); g.add(tail); }   // the two loose ends of the drawstring
  return { group: g, set(k, t) { const u = clamp(k); g.visible = u > 0.002; const d = 1 - u; g.position.y = r * 0.1 + 1.15 * d * d - 0.03 * Math.sin(u * Math.PI); g.scale.set(1 + 0.1 * d, 1 - 0.14 * d, 1 + 0.1 * d); g.rotation.z = 0.12 * d * Math.sin(t * 9) + 0.05 * Math.sin(t * 1.3) * u; slump.position.x = r * (0.55 + 0.06 * Math.sin(t * 1.7)); } };
}

// ---- a police boat (+z forward) ----
function buildBoat(parent, id) {
  const g = new THREE.Group(); g.name = 'pboat' + id; g.visible = false; parent.add(g); const hullG = new THREE.Group(); g.add(hullG); hullG.scale.setScalar(1.7);   // 1.7x: readable at phone size
  const white = new THREE.MeshPhysicalMaterial({ color: '#f6f8fc', roughness: 0.34, clearcoat: 0.7, emissive: '#aab4cc', emissiveIntensity: 0.42 }), navy = std('#34436a', { roughness: 0.5, emissive: '#16203c', emissiveIntensity: 0.5 }), glassM = std('#7fb4e8', { roughness: 0.1, metalness: 0.2, emissive: '#2a5a9a', emissiveIntensity: 0.4 });
  const hg = new THREE.BoxGeometry(1.8, 0.75, 5.8, 1, 1, 1), hp = hg.attributes.position; for (let i = 0; i < hp.count; i++) { if (hp.getZ(i) > 0) { hp.setX(i, hp.getX(i) * 0.2); hp.setY(i, hp.getY(i) * (hp.getY(i) > 0 ? 0.85 : 1)); } } hg.computeVertexNormals();
  mesh(hg, white, [0, 0.36, 0], hullG); box(1.84, 0.12, 5.0, navy, [0, 0.46, -0.3], hullG, { cast: false });
  box(1.25, 0.62, 1.9, navy, [0, 1.02, -0.5], hullG); box(1.28, 0.3, 1.2, glassM, [0, 1.12, 0.05], hullG, { cast: false }); box(1.3, 0.06, 2.0, white, [0, 1.36, -0.5], hullG, { cast: false });
  const bar = []; for (const s of [-1, 1]) { const lm = new THREE.MeshStandardMaterial({ color: '#000', emissive: s < 0 ? '#ff2a2a' : '#2a5aff', emissiveIntensity: 1.5 }); bar.push({ lm, s, m: box(0.4, 0.14, 0.26, lm, [s * 0.3, 1.46, -0.5], hullG, { cast: false }), sp: spr(hullG, s < 0 ? '#ff3030' : '#3a6aff', 8.0, 0) }); bar[bar.length - 1].sp.position.set(s * 0.3, 1.5, -0.5); }
  for (const s of [-1, 1]) { const tx = canvasTex(512, 96, (c, w, h) => { c.fillStyle = '#1d2331'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = FONT(64); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CẢNH SÁT', w / 2, h / 2 + 3); }); NC(mesh(new THREE.PlaneGeometry(1.7, 0.32), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 }), [s * 0.93, 0.5, -0.7], hullG, { cast: false, rot: [0, s * Math.PI / 2, 0] })); }
  box(0.35, 0.5, 0.35, std('#15151b'), [0, 0.62, -3.05], hullG, {}); cyl(0.04, 0.04, 0.5, std('#15151b'), [0, 0.15, -3.1], hullG, {}, 8);
  const wakes = [-1, 1].map((s) => { const m = mesh(new THREE.PlaneGeometry(1.0, 8), addMat(foam(), '#ffffff', 0.0), [s * 1.1, 0.03, -6.0], g, { cast: false, recv: false, rot: [-Math.PI / 2, 0, s * 0.2] }); m.userData.noClip = true; return m; });
  const spray = Array.from({ length: 10 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0, depthWrite: false })); m.userData.noClip = true; g.add(m); return m; });
  return { group: g, hullG, bar, wakes, spray };
}
function placeBoat(b, p, t, on) {
  b.group.visible = on; if (!on) return; const h = waveH(p.x, p.z, t), [gx, gz] = waveGrad(p.x, p.z, t), fz = Math.cos(p.yaw), fx = Math.sin(p.yaw), sF = gx * fx + gz * fz, sR = gx * fz - gz * fx;
  b.group.position.set(p.x, h + (p.y || 0) - 0.06, p.z); b.group.rotation.order = 'YXZ'; b.group.rotation.set(-Math.atan(sF) + (p.pitch || 0) + clamp(p.speed / 24, 0, 0.5) * 0.14, p.yaw, (p.bank || 0) + Math.atan(sR) * 0.8);
  const k = clamp((p.aground ? Math.max(p.speed, 3.5) : p.speed) / 12), grounded = p.aground ? 1 : 0, s1 = Math.sin(t * 6.1), a = 0.5 + 0.5 * s1;
  b.bar.forEach((o, i) => { const on2 = i ? 1 - a : a; o.lm.emissiveIntensity = 0.3 + 3.2 * on2; o.sp.material.opacity = 0.95 * on2; });
  b.wakes.forEach((w, i) => { const kk = smooth(k * 1.6) * (1 - 0.35 * grounded); w.visible = kk > 0.02; w.material.opacity = 0.42 * kk; w.scale.set(1 + 2.0 * kk, 0.4 + 0.9 * kk, 1); w.position.set((i ? 1 : -1) * (1.2 + 1.5 * kk), 0.03, -4.9 - 6 * (0.4 + 0.9 * kk)); });
  b.spray.forEach((s, i) => { const side = i % 2 ? 1 : -1, ph = (t * 1.9 + i / b.spray.length * 3.7) % 1, a2 = Math.sin(Math.PI * ph); s.visible = k > 0.04 && a2 > 0.02; if (!s.visible) return; const r = 0.04 + 0.07 * hash(i * 3.1);
    s.position.set(side * (1.5 + (1.0 + hash(i * 1.7)) * ph), 0.3 + 2.0 * ph * (1 - ph) * 2, 1.7 - 7.5 * ph); s.scale.setScalar(r * 1.7 * (1 + ph)); s.material.opacity = 0.7 * a2 * k; });
}

// ---- the helicopter (+z forward) ----
function buildHeli(parent, scene) {
  const g = new THREE.Group(); g.name = 'heli'; g.visible = false; parent.add(g); const navy = new THREE.MeshPhysicalMaterial({ color: '#1d2331', roughness: 0.4, clearcoat: 0.6 }), white = std('#eef0f5', { roughness: 0.5 });
  mesh(new THREE.SphereGeometry(1, 24, 16), navy, [0, 0, 0.3], g, { scale: [1.15, 1.05, 2.3] }); mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), std('#8cc4f0', { roughness: 0.08, metalness: 0.3, emissive: '#2a6aa8', emissiveIntensity: 0.4 }), [0, 0.15, 1.4], g, { scale: [0.95, 0.85, 1.2] });
  mesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), white, [0, -0.2, 0.3], g, { scale: [1, 1, 1] }); box(0.18, 0.16, 4.4, navy, [0, 0.25, -3.8], g, {}); box(0.06, 1.0, 0.7, navy, [0, 0.75, -5.8], g, {});
  cyl(0.05, 0.06, 0.55, std('#2a2a34'), [0, 1.1, 0.2], g, {}, 8); const rotor = new THREE.Group(); rotor.position.set(0, 1.4, 0.2); g.add(rotor);
  const rtex = canvasTex(256, 256, (c, w, h) => { c.translate(128, 128); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const gr = c.createLinearGradient(0, 0, Math.cos(a) * 126, Math.sin(a) * 126); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.2, 'rgba(210,214,226,0.55)'); gr.addColorStop(1, 'rgba(210,214,226,0.0)'); c.strokeStyle = gr; c.lineWidth = 18; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 126, Math.sin(a) * 126); c.stroke(); } });
  NC(mesh(new THREE.CircleGeometry(4.6, 40), new THREE.MeshBasicMaterial({ map: rtex, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), [0, 0, 0], rotor, { cast: false, rot: [-Math.PI / 2, 0, 0] }));
  const tr = new THREE.Group(); tr.position.set(0.1, 0.9, -5.9); g.add(tr); NC(mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ map: rtex, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), [0, 0, 0], tr, { cast: false, rot: [0, Math.PI / 2, 0] }));
  for (const s of [-1, 1]) { cyl(0.04, 0.04, 2.4, std('#2a2a34'), [s * 0.8, -1.0, 0.3], g, { rot: [Math.PI / 2, 0, 0] }, 8); for (const z of [-0.5, 1.1]) cyl(0.03, 0.03, 0.9, std('#2a2a34'), [s * 0.78, -0.55, z], g, { rot: [0, 0, s * -0.3] }, 6); }
  const tur = new THREE.Group(); tur.position.set(0, -0.95, 1.3); g.add(tur); ball(0.26, new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 7.2, 5.4), toneMapped: false }), [0, 0, 0], tur, { cast: false, recv: false }, 12); const tglow = spr(g, '#fff0cc', 2.2, 0); tglow.position.copy(tur.position);
  // the beam: an open cone from the turret to the target, fading towards the apex; a SpotLight on the target; a light pool on the water
  const bt = canvasTex(8, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 28, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.85, 1.4), alphaMap: bt, transparent: true, opacity: 0.35 * 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); beam.userData.noClip = true;
  // gate fix 21/11: opacity x0.55 and a SOFT EDGE: alpha falls to 0 where the cone's surface turns edge-on to the camera (a pure function of the view angle), so the beam has no hard silhouette
  beam.material.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 bN; varying vec3 bV;').replace('#include <begin_vertex>', '#include <begin_vertex>\nbN = normalize(normalMatrix * normal); bV = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 bN; varying vec3 bV;').replace('#include <dithering_fragment>', 'gl_FragColor.a *= pow(abs(dot(normalize(bN), normalize(bV))), 1.3);\n#include <dithering_fragment>'); }; beam.frustumCulled = false; parent.add(beam);
  const spot = new THREE.SpotLight('#fff3dc', 0, 70, 0.14, 0.55, 1); spot.castShadow = false; parent.add(spot); parent.add(spot.target);
  const pool = NC(mesh(new THREE.CircleGeometry(1, 28), addMat(glowTex(), '#fff3d0', 0.0), [0, 0, 0], parent, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }));
  return { group: g, rotor, tr, tur, beam, spot, pool, tglow };
}

// ---- a sun lounger (stagefix 21/11: the sitters floated 0.3 m above the old slabs, which sat at the root = floor-under-the-seat level) ----
// CHARACTER FRAME (the sitter's root = the origin; a SEATED body has its hips at y 0.30-0.33, thighs forward to the knee at z 0.30, shins down, back at z -0.17..-0.19):
//   cushion top at y 0.27 (under the thighs and hips), backrest face at z -0.21 (against the back), rails + `cancel` group counter-rotated so the legs stand on the SAND (world-upright)
const LNG_TILT = 0.34;
function buildLounger(parent, col, gy = 0.09) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; parent.add(g); const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }), frame = std('#f2f2f4', { roughness: 0.5 });
  NC(box(0.66, 0.09, 0.64, m, [0, 0.225, 0.02], g, { cast: false })); NC(box(0.66, 0.86, 0.09, m, [0, 0.70, -0.255], g, { cast: false }));   // thigh cushion; back cushion (soft: noClip, the sitter sinks 2 cm)
  for (const s2 of [-1, 1]) { box(0.05, 0.05, 0.74, frame, [s2 * 0.36, 0.19, 0.0], g, { cast: false }); box(0.05, 0.9, 0.05, frame, [s2 * 0.36, 0.64, -0.3], g, { cast: false }); }   // side rails (seat) and uprights (back)
  const cancel = new THREE.Group(); g.add(cancel); g.userData.cancel = cancel;   // upright (world) legs: from the sand up to the rail ends
  const E = new THREE.Euler(-LNG_TILT, 0, 0);
  for (const s2 of [-1, 1]) for (const zf of [0.34, -0.28]) { const pr = new THREE.Vector3(s2 * 0.36, 0.19, zf).applyEuler(E), h = Math.max(0.03, pr.y + gy); box(0.05, h, 0.05, frame, [pr.x, pr.y - h / 2, pr.z], cancel, { cast: false }); }
  return g;
}

export function addP3bSea(sea, { scene, paths = {}, island: IS = {} } = {}) {
  const parent = sea.group, X = new THREE.Group(); X.name = 'p3b_sea'; parent.add(X); const I = { ...ISL, ...IS };
  const P = paths.sea || {}; const b1 = buildBoat(X, 1), b2 = buildBoat(X, 2), heli = buildHeli(X, scene);
  const car = buildSilverCar(X, { at: [0, 0], yaw: 0 }); const duckI = buildDuck(X); duckI.group.name = 'duck_island';
  // sandbar (a low sand patch the police boat runs up on)
  const sand = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#e8cf9a'; c.fillRect(0, 0, w, h); grain(c, w, h, 4000, 0.12, 6, 2); }, { repeat: [3, 3] }); const sandM = new THREE.MeshStandardMaterial({ map: sand, roughness: 0.95 });
  const SB = P.bar || [-132, -128]; NC(cyl(6.5, 8.5, 0.5, sandM, [SB[0], -0.05, SB[1]], X, { cast: false }, 32));
  // stagefix 21/11: the bar must read as a pale warm sand patch floating in the sea, never a dark slab: the sand glows a little (emissive map = its own texture), a shallow-water halo and a foam ring round it (a pure function of t: it breathes with sin t)
  sandM.emissive = new THREE.Color('#ffd9a0'); sandM.emissiveMap = sand; sandM.emissiveIntensity = 0.55;
  const ringT = canvasTex(256, 256, (c, w, h) => { const g = c.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.52, 'rgba(120,230,225,0)'); g.addColorStop(0.58, 'rgba(150,240,230,0.5)'); g.addColorStop(0.64, 'rgba(255,255,255,0.85)'); g.addColorStop(0.72, 'rgba(170,240,235,0.4)'); g.addColorStop(0.86, 'rgba(120,220,225,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const ringM = new THREE.MeshBasicMaterial({ map: ringT, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: true }); const ring = NC(mesh(new THREE.CircleGeometry(13.5, 48), ringM, [SB[0], 0.06, SB[1]], X, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] })); ring.renderOrder = 2;
  const sandRing = ring;
  // the island
  const IG = new THREE.Group(); IG.position.set(I.x, 0, I.z); X.add(IG); NC(cyl(I.r * 0.92, I.r * 1.35, 1.0, sandM, [0, I.top - 0.5, 0], IG, { cast: false }, 40)); NC(cyl(I.r * 0.55, I.r * 0.9, 0.2, std('#d8c08a', { roughness: 1, emissive: '#c8a066', emissiveIntensity: 0.55 }), [0, I.top + 0.0, 0], IG, { cast: false }, 32));
  for (let i = 0; i < 5; i++) { const a = i * 1.7 + 0.4, d = 2 + 3.6 * hash(i + 2); NC(ball(0.9 + 0.5 * hash(i), sandM, [Math.cos(a) * d, I.top - 0.35, Math.sin(a) * d], IG, { cast: false }, 12)).scale.y = 0.35; }
  { const T = [], F = []; [[-3.8, -2.2, 5.6], [-5.2, 1.0, 6.4], [3.9, -3.4, 5.2], [5.4, 1.6, 6.0], [0.4, -5.6, 5.8]].forEach(([x, z, H], i) => addPalm(T, F, I.x + x, I.z + z, H, 30 + i, I.top - 0.05)); finishPalms(X, T, F); }
  for (let i = 0; i < 4; i++) { const a = 2.4 + i * 0.6; NC(ball(0.5, std('#7a7a88', { roughness: 0.9 }), [Math.cos(a) * (I.r * 0.95), I.top - 0.1, Math.sin(a) * (I.r * 0.95)], IG, {}, 8)); }
  // loungers (their frames follow the reclined sitters; `pre` places them) + the poles standing on the sand
  const LNG = [{ pos: [I.x + 1.6, I.top + 0.01, I.z - 0.6], yaw: 0.42 + Math.PI, who: 'linhs', col: '#35c8a0' }, { pos: [I.x - 0.5, I.top + 0.01, I.z - 0.8], yaw: -0.18 + Math.PI, who: 'teo', col: '#ff9fc0' }];   // facing -z = the sunset (and the camera that looks at the sunset sees their backs: cameras go round to +z side)
  LNG.forEach((l) => { l.g = buildLounger(X, l.col, I.top + 0.1 - (I.top + 0.01)); });
  const DUCK_AT = [I.x - 3.0, I.top + 0.2, I.z + 1.6, 0.5]; duckI.group.position.set(DUCK_AT[0], DUCK_AT[1], DUCK_AT[2]); duckI.group.rotation.y = DUCK_AT[3];
  const cup = makeTeaGlass(X); cup.group.visible = false; cup.group.traverse((o) => { if (o.isMesh && o.material?.transparent && o.material.opacity < 0.3) { o.material = o.material.clone(); o.material.opacity = 0.8; } });   // the glass shows on the sand
  const puddle = NC(mesh(new THREE.CircleGeometry(0.3, 24), std('#c0701c', { roughness: 0.15, emissive: '#6a3408', emissiveIntensity: 0.5 }), [I.x - 1.75, I.top + 0.115, I.z + 2.35], X, { cast: false, rot: [-Math.PI / 2, 0, 0], scale: [1.2, 0.8, 1] })); puddle.visible = false; /* the spilled tea */
  cup.group.scale.setScalar(1.9); const CUP_AT = [I.x - 1.9, I.top + 0.1, I.z + 2.5];
  const shades = {}, sacks = {}; const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _up = V3(0, 1, 0);
  const seatOf = (root, sc, who) => sc.getObjectByName(who);
  function lazy(sc) {   // sacks on the heads, Linh's sunglasses on her face: added once (the objects exist in every frame; only their visibility / position change)
    for (const [who, r, k] of [['teo', 0.17, 'sackTeo'], ['bip', 0.19, 'sackBip']]) if (!sacks[who]) { const api = sc?.getObjectByName(who)?.userData.api; if (api?.head) { sacks[who] = makeSack(r * 1.0); api.head.add(sacks[who].group); sacks[who].fxName = k; } }
    if (!shades.g) { const api = sc?.getObjectByName('linhs')?.userData.api; if (api?.head) { const m = new THREE.MeshPhysicalMaterial({ color: '#0c0c12', roughness: 0.12, metalness: 0.3, clearcoat: 1 }), g = new THREE.Group(); for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(1, 16, 12), m, [s * 0.066, 0.028, 0.162], g, { scale: [0.06, 0.042, 0.012], rot: [0, 0, s * 0.1], cast: false }); mesh(new THREE.BoxGeometry(0.04, 0.01, 0.01), m, [0, 0.036, 0.165], g, { cast: false }); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.01, 0.01, 0.13), m, [s * 0.128, 0.034, 0.1], g, { cast: false }); api.head.add(g); shades.g = g; g.visible = false; } } }
  const target = V3();
  function pre(t, fx = {}, sc = null) {
    lazy(sc); const sk = paths.sea?.pbOn ?? null; void sk;
    const p1 = P.pb1 ? P.pb1(t) : null, p2 = P.pb2 ? P.pb2(t) : null; placeBoat(b1, p1 || { x: 0, z: 0, yaw: 0, speed: 0 }, t, !!p1 && (fx.pb1On ?? 0) > 0.5); placeBoat(b2, p2 || { x: 0, z: 0, yaw: 0, speed: 0 }, t, !!p2 && (fx.pb2On ?? 0) > 0.5);
    // the island party: Linh and Tèo on the loungers (reclined 0.38 rad), Bíp on the duck on the sand (fx island >= 0.5)
    const on = (fx.island || 0) >= 0.5, gone = (fx.isleGone || 0) >= 0.5;
    LNG.forEach((l) => { l.g.visible = on; if (!on || !sc) return; const root = sc.getObjectByName(l.who); if (!root) return; if (root.rotation.order !== 'YXZ') { const q = root.quaternion.clone(); root.rotation.order = 'YXZ'; root.quaternion.copy(q); }
      const tilt = -(l.tilt ?? 0.34) * (fx['lie_' + l.who] ?? 1); root.position.set(l.pos[0] + parent.position.x, gone ? -100 : l.pos[1], l.pos[2] + parent.position.z); root.rotation.set(tilt, l.yaw, 0); l.g.position.set(l.pos[0], l.pos[1], l.pos[2]); l.g.rotation.set(tilt, l.yaw, 0); l.g.userData.cancel.rotation.x = -tilt; });
    duckI.group.visible = on; if (on && sc) { const bip = sc.getObjectByName('bip'); if (bip && (fx.bipOnDuck ?? 1) > 0.5 && !gone && (fx.bipGone || 0) < 0.5) { _e.set(0, DUCK_AT[3], 0); _q.setFromEuler(_e); _p.set(DUCK_SEAT.pos[0], DUCK_SEAT.pos[1], DUCK_SEAT.pos[2]).applyQuaternion(_q).add(duckI.group.position); bip.position.set(_p.x + parent.position.x, _p.y, _p.z + parent.position.z); bip.rotation.set(0, DUCK_AT[3] + 0.2, 0); } }
    ringM.opacity = 0.82 + 0.1 * Math.sin(t * 1.3); ring.scale.setScalar(1 + 0.012 * Math.sin(t * 0.9)); duckI.body.rotation.z = 0.03 * Math.sin(t * 1.7); duckI.body.position.y = 0.02 * Math.sin(t * 2.1);
    cup.group.visible = (fx.cupEnd || 0) >= 0.5; cup.group.position.set(CUP_AT[0], CUP_AT[1] + 0.07, CUP_AT[2]); cup.group.rotation.set(0.15, 0.5, 1.25); { cup.group.updateWorldMatrix(true, false); const iq = new THREE.Quaternion(); cup.group.getWorldQuaternion(iq).invert(); cup.update(t, 0.0, _up.set(0, 1, 0).applyQuaternion(iq)); }
    puddle.visible = cup.group.visible;
    // sacks / sunglasses
    for (const w of ['teo', 'bip']) if (sacks[w]) sacks[w].set(fx[sacks[w].fxName] || 0, t); if (shades.g) shades.g.visible = (fx.shades || 0) >= 0.5;
  }
  const sea0 = sea.update, sea0pre = sea.pre;
  function update(t, fx = {}, follow = null, sc = null) {
    const pv = P.sv ? P.sv(t) : null; car.group.visible = !!pv && (fx.svOn ?? 1) > 0.5; if (pv) { const f2 = { ...fx, ...carFxFrom(P.sv, 'sv')(t) }; car.update(t, f2); car.group.visible = (fx.svOn ?? 1) > 0.5; const m = car.bodyMat; m.color.set('#cdd3de').lerp(new THREE.Color('#12c25a'), smooth(clamp(fx.svpaint || 0))); m.metalness = lerp(0.55, 0.22, smooth(clamp(fx.svpaint || 0))); m.roughness = lerp(0.28, 0.08, smooth(clamp(fx.svpaint || 0))); }
    sea0(t, fx, follow, sc);   // (after the silver car glued its riders: the sky dome follows Tèo, who must already be in his seat)
    // helicopter
    const hp = P.heli ? P.heli(t) : null, hon = !!hp && (fx.heliOn ?? 0) > 0.5; heli.group.visible = hon;
    const light = smooth(clamp(fx.heliLight || 0)) * (hon ? 1 : 0); heli.beam.visible = heli.spot.visible = heli.pool.visible = light > 0.01; heli.tglow.material.opacity = 0.9 * light;
    if (hon) { heli.group.position.set(hp.x, hp.y, hp.z); heli.group.rotation.order = 'YXZ'; heli.group.rotation.set(hp.pitch || 0.08, hp.yaw, hp.roll || 0);
      heli.rotor.rotation.y = t * 1.3; heli.tr.rotation.x = t * 1.7; heli.group.updateMatrixWorld(true); const tw = parent.worldToLocal(heli.tur.getWorldPosition(V3()));
      const tgt = P.heliAt ? P.heliAt(t) : null; if (tgt === 'duck' || !tgt) { const dk = sc?.getObjectByName?.('duck'); if (dk) { dk.getWorldPosition(target); target.sub(parent.getWorldPosition(V3())); target.y = 0.55; } } else target.set(tgt.x, tgt.y ?? 0.5, tgt.z);
      if (light > 0.01) { const d = target.clone().sub(tw), L = d.length(), dir = d.clone().normalize(); heli.beam.position.copy(tw).addScaledVector(dir, L / 2); heli.beam.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().negate()); heli.beam.scale.set(0.5 + 2.2 * smooth(clamp(L / 18)) * 1.0 + 0.3, L, 0.5 + 2.2 * smooth(clamp(L / 18)) * 1.0 + 0.3); heli.beam.material.opacity = 0.34 * 0.55 * light;
        heli.spot.position.copy(tw); heli.spot.target.position.copy(target); heli.spot.intensity = 90 * light; heli.pool.position.set(target.x, waveH(target.x, target.z, t) + 0.06, target.z); heli.pool.scale.setScalar(3.0); heli.pool.material.opacity = 0.7 * light; } }
    else { heli.beam.visible = false; heli.spot.intensity = 0; }
  }
  const pre2 = (t, fx, sc) => { sea0pre?.(t, fx, sc); pre(t, fx, sc); };
  // (21/11 evening) the sacks and Linh's sunglasses hang on the CAST's heads, outside the sea group: in any other place they are put away (a seek into the climax left Tèo's sack on him in the paint shop)
  const off = () => { for (const w of ['teo', 'bip']) sacks[w]?.set(0, 0); if (shades.g) shades.g.visible = false; };
  return { update, pre: pre2, off, parts: { b1, b2, heli, car, duckI, cup, LNG, I }, ISL: I };
}
