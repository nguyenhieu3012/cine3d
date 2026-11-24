// Trà đá với AI, special "Zombie" Part 2: the narrow alley that ends at Mẹ's house: a blue iron gate (can swing open), flower pots, a warm porch lamp, a dark courtyard behind the gate.
// World: the camera looks towards -z. The alley runs along z, 2.0 m wide (x -1..1), mouth at z = +8 (a cross street with a cold glow beyond), the gate at z = -10, the courtyard behind it (z -10..-15).
// Two figures standing shoulder to shoulder at block_l / block_r fill the alley (that is the idea: nothing passes them). Options: { at: [x, y, z] }.
// fx (acts on 'set'): open 0..1 (the two gate leaves swing inward, creaking), knock 0..1 (the gate rattles on the knocks), glow 0..1 (a faint cold TV light deep in the house, default 0.35), lamp 0..1 (porch lamp strength, default 1).
import * as THREE from 'three';
import { hash, lerp, smooth, noise1, fbm1, canvasTex, grain, std, emis, mesh, box, cyl, ball } from '../../core/util.js';
import { facadeTex, softDisc, lightPool, smokeColumn } from './street.js';

const FONT = (px, w = 900) => `${w} ${px}px Display, sans-serif`;
const plaster = (base, seed) => canvasTex(512, 512, (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(30,20,10,0.35)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,20,10,0.25)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 20; i++) { const x = hash(i * 3.7 + seed) * w, y = hash(i * 5.9 + seed) * h * 0.8, sg = c.createLinearGradient(x, y, x, y + 140); sg.addColorStop(0, 'rgba(30,40,30,0.3)'); sg.addColorStop(1, 'rgba(30,40,30,0)'); c.fillStyle = sg; c.fillRect(x, y, 10 + hash(i) * 24, 140); }
  c.fillStyle = 'rgba(90,40,30,0.35)'; for (let i = 0; i < 6; i++) c.fillRect(hash(i * 7 + seed) * w, hash(i * 3 + seed) * h, 40 + hash(i) * 60, 26 + hash(i * 2) * 30); grain(c, w, h, 6000, 0.1, seed, 3); });

export function buildGate(scene, { at = [0, 0, 0] } = {}) {
  const g = new THREE.Group(); g.name = 'gate'; g.position.set(...at); scene.add(g);
  const ZG = -10, AW = 0.9;   // gate plane, half-width of the alley
  // ---- ground: damp concrete with a gutter and a few puddles; the courtyard has red tiles ----
  const conc = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#5a5a60'; c.fillRect(0, 0, w, h); grain(c, w, h, 12000, 0.1, 3, 2); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(0, i * 110 + 20); c.lineTo(w, i * 110 + 30); c.stroke(); } c.fillStyle = 'rgba(10,10,14,0.55)'; c.fillRect(w / 2 - 14, 0, 28, h); }, { repeat: [1, 10] });
  mesh(new THREE.PlaneGeometry(2.0, 18), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.55, envMapIntensity: 1.2 }), [0, 0, -1], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  for (const [x, z, r] of [[-0.3, 4.2, 0.35], [0.25, -2.2, 0.28], [0.1, -7.4, 0.3]]) mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ color: '#262a38', roughness: 0.06, metalness: 0.2, envMapIntensity: 2, emissive: '#1a2236', emissiveIntensity: 0.6 }), [x, 0.004, z], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }).scale.y = 1.8;
  const tileC = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#6a2a22'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.fillStyle = `hsl(${8 + hash(i + j * 3) * 8}, 50%, ${24 + hash(i * 5 + j) * 8}%)`; c.fillRect(i * 128 + 4, j * 128 + 4, 120, 120); } grain(c, w, h, 2000, 0.1, 2, 2); }, { repeat: [3, 5] });
  mesh(new THREE.PlaneGeometry(3.2, 5.5), std('#ffffff', { map: tileC, roughness: 0.5 }), [0, 0.001, ZG - 2.75], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  // ---- alley walls (shop-house fronts: stained plaster, barred windows, boxes) ----
  const walls = []; const fac = [0, 1, 2, 3].map((i) => facadeTex(40 + i, { hue: [38, 22, 45, 18][i], ground: 'door', lit: 0.18, sign: false }));
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const z = 5.75 - i * 4.5, [map, em] = fac[(i + (s > 0 ? 2 : 0)) % 4]; map.wrapS = THREE.RepeatWrapping;
    mesh(new THREE.PlaneGeometry(4.5, 10), new THREE.MeshStandardMaterial({ map, emissive: '#fff', emissiveMap: em, emissiveIntensity: 1.2, roughness: 0.92 }), [s * AW, 5, z], g, { cast: false, rot: [0, -s * Math.PI / 2, 0] });
    if (i % 2 === (s > 0 ? 0 : 1)) box(0.45, 0.06, 3.0, std('#3a3a42', { roughness: 0.9 }), [s * (AW - 0.2), 3.6 + i * 0.3, z], g);   // a balcony slab overhead
    if (hash(i + s * 7) > 0.4) box(0.28, 0.34, 0.4, std('#9ea2a8', { roughness: 0.5 }), [s * (AW - 0.12), 3.1, z + 1.2], g);
    cyl(0.03, 0.03, 8, std('#6a6e74', { roughness: 0.5, metalness: 0.6 }), [s * (AW - 0.04), 4, z - 1.6], g, {}, 6); box(0.14, 0.2, 0.18, std('#c8c4b4', { roughness: 0.6 }), [s * (AW - 0.07), 1.5, z + 0.3], g); }
  // ---- clothes lines across the alley (soft sway), overhead wires ----
  const lines = []; for (let i = 0; i < 3; i++) { const y = 4.1 + i * 0.3, z = 3.4 - i * 5.2, cl = new THREE.Group(); cl.position.set(0, y, z); g.add(cl); cyl(0.004, 0.004, 2.0, std('#222'), [0, 0, 0], cl, { cast: false }, 4).rotation.z = Math.PI / 2;
    for (let k = 0; k < 5; k++) { const p = new THREE.Group(); p.position.set(-0.8 + k * 0.4 + hash(i * 5 + k) * 0.06, 0, 0); cl.add(p); const cc = ['#8a3a3e', '#a8a49a', '#3a6a92', '#9a7a30', '#8a4a6a'][(i + k) % 5]; const q = mesh(new THREE.PlaneGeometry(0.18, 0.26 + 0.14 * hash(i + k)), std(cc, { roughness: 0.9, side: THREE.DoubleSide }), [0, -0.22, 0], p, { cast: false }); q.userData.noOutline = true; lines.push([p, i * 3 + k]); } }
  for (let k = 0; k < 4; k++) { const pts = [new THREE.Vector3(-AW + 0.05, 5.2 + k * 0.4, 8), new THREE.Vector3(AW * 0.2 * (k % 2 ? 1 : -1), 4.9 + k * 0.4, -1), new THREE.Vector3(AW - 0.05, 5.4 + k * 0.4, -9.8)]; g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.008, 4), new THREE.MeshBasicMaterial({ color: '#06060a' }))); }
  // ---- clutter along the walls: pots with plants, a leaning bicycle, a bin, a stool, plastic crates ----
  const pot = (x, z, r, col) => { const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p); cyl(r, r * 0.72, r * 1.6, std(col, { roughness: 0.85 }), [0, r * 0.8, 0], p, {}, 14); for (let i = 0; i < 7; i++) { const a = i * 0.9; ball(r * (0.6 + 0.3 * hash(i + x)), std(['#2f8a4a', '#3a9a52', '#27763e'][i % 3], { roughness: 0.8 }), [Math.cos(a) * r * 0.4, r * 1.7 + hash(i) * r * 0.5, Math.sin(a) * r * 0.4], p, {}, 8); } return p; };
  pot(-0.82, 6.4, 0.16, '#9a4a2e'); pot(-0.8, 2.0, 0.2, '#a85a34'); pot(0.84, -1.0, 0.18, '#8a3a26'); pot(0.82, -5.6, 0.2, '#9a4a2e'); pot(-0.84, -3.4, 0.14, '#b86a3a'); pot(0.8, 4.0, 0.15, '#9a4a2e');
  const bike = new THREE.Group(); bike.position.set(0.8, 0, 1.0); bike.rotation.y = 0.12; g.add(bike); for (const z of [-0.42, 0.42]) mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 24), std('#1a1a1e'), [0.05, 0.32, z], bike, { rot: [0, Math.PI / 2, 0] }); box(0.03, 0.03, 0.9, std('#2a5aa8', { roughness: 0.4 }), [0.05, 0.62, 0], bike, { rot: [0.25, 0, 0] }); box(0.04, 0.03, 0.5, std('#2a5aa8'), [0.05, 0.42, -0.1], bike, { rot: [-0.4, 0, 0] }); bike.rotation.z = -0.22; bike.position.x = 0.7;
  const bin = new THREE.Group(); bin.position.set(-0.78, 0, -6.2); g.add(bin); cyl(0.2, 0.17, 0.62, std('#2a6a3a', { roughness: 0.6 }), [0, 0.31, 0], bin, {}, 14); cyl(0.215, 0.215, 0.04, std('#1f4f2b'), [0, 0.64, 0], bin, {}, 14);
  for (let i = 0; i < 4; i++) box(0.4, 0.28, 0.3, std(['#2f8fd8', '#d8323a', '#f2b631', '#37a85a'][i], { roughness: 0.6 }), [0.72, 0.14 + (i % 2) * 0.29, -3.6 + (i > 1 ? 0.0 : 0.0) - (i % 2) * 0.0 - Math.floor(i / 2) * 0.0 + i * 0.0], g, { rot: [0, 0.05 * i, 0] }).position.z = -3.3 - Math.floor(i / 2) * 0.35;
  // ---- the house at the end of the alley: plaster front with a gate opening, lintel, tiled roof, number plate ----
  const hm = std('#ffffff', { map: plaster('#d8c898', 3), roughness: 0.9 });
  box(2.2, 3.4, 0.4, hm, [-AW - 1.0 + 0.2 - 0.1, 1.7, ZG - 0.18], g); box(2.2, 3.4, 0.4, hm, [AW + 1.0 - 0.2 + 0.1, 1.7, ZG - 0.18], g);   // left / right of the gate
  box(2.6 + 1.2, 4.6, 0.4, hm, [0, 2.45 + 2.3 + 0.0, ZG - 0.18], g).scale.set(1, 1, 1);   // above the gate opening (starts at 2.45 m)
  const pillarM = std('#c9b98a', { roughness: 0.85 }); box(0.28, 2.6, 0.34, pillarM, [-0.82, 1.3, ZG + 0.04], g); box(0.28, 2.6, 0.34, pillarM, [0.82, 1.3, ZG + 0.04], g); box(2.1, 0.22, 0.4, pillarM, [0, 2.55, ZG + 0.02], g);
  for (const x of [-0.82, 0.82]) box(0.34, 0.1, 0.4, std('#a89a70'), [x, 2.67, ZG + 0.04], g);
  const roofM = std('#7a3a2a', { roughness: 0.8 }); box(3.4, 0.12, 1.6, roofM, [0, 3.0, ZG - 0.5], g, { rot: [0.15, 0, 0] }); for (let i = 0; i < 12; i++) box(0.26, 0.04, 1.6, std('#5a2a20'), [-1.55 + i * 0.28, 3.08, ZG - 0.5], g, { rot: [0.15, 0, 0] });
  const plate = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#d8d4c4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c4141f'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#c4141f'; c.font = FONT(70); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SỐ 12', w / 2, 68); });
  mesh(new THREE.PlaneGeometry(0.32, 0.16), std('#fff', { map: plate, roughness: 0.6 }), [-1.35, 2.0, ZG + 0.03], g, { cast: false });
  for (const [x, w] of [[-1.55, 0.6], [1.55, 0.6]]) { box(w, 1.0, 0.04, std('#1a1e2a', { roughness: 0.4 }), [x, 5.3, ZG + 0.04], g); for (let b = 0; b < 5; b++) box(0.012, 1.0, 0.03, std('#232c3a'), [x - w / 2 + 0.06 + b * w / 5.5, 5.3, ZG + 0.07], g); }
  // ---- the gate: two blue iron leaves, hinged on the pillars, swinging inward ----
  const blue = new THREE.MeshPhysicalMaterial({ color: '#2f6fd0', roughness: 0.4, metalness: 0.5, clearcoat: 0.3 }); const leaves = [];
  for (const s of [-1, 1]) { const hinge = new THREE.Group(); hinge.position.set(s * 0.68, 0, ZG + 0.05); g.add(hinge); const leaf = new THREE.Group(); hinge.add(leaf); leaf.position.set(-s * 0.34, 0, 0);
    for (const y of [0.2, 0.9, 1.6, 2.28]) box(0.68, 0.06, 0.04, blue, [0, y, 0], leaf); for (const x of [-0.325, 0.325]) box(0.05, 2.4, 0.05, blue, [x, 1.2, 0], leaf);
    for (let i = 0; i < 8; i++) { box(0.016, 2.1, 0.02, blue, [-0.28 + i * 0.08, 1.25, 0], leaf); const sp = mesh(new THREE.ConeGeometry(0.017, 0.08, 6), blue, [-0.28 + i * 0.08, 2.35, 0], leaf); }
    mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 20), blue, [0, 1.25, 0], leaf); box(0.14, 0.2, 0.03, std('#c4141f', { roughness: 0.5 }), [0, 1.25, 0.0], leaf).scale.set(0.001, 0.001, 0.001);
    box(0.08, 0.14, 0.05, std('#4a4f58', { metalness: 0.7, roughness: 0.4 }), [-s * 0.3, 1.0, 0.04], leaf); leaves.push({ hinge, s }); }
  // ---- porch lamp: a warm yellow globe on a bracket over the right pillar, soft glow, light pool, a few moths ----
  const lampG = new THREE.Group(); lampG.position.set(1.05, 2.25, ZG + 0.3); g.add(lampG); box(0.05, 0.05, 0.3, std('#4a4f58', { metalness: 0.6 }), [0, 0.12, -0.15], lampG); const globe = ball(0.1, emis('#ffcf70', 4.5), [0, 0, 0], lampG, { cast: false, recv: false }, 16); cyl(0.06, 0.09, 0.05, std('#4a4f58'), [0, 0.1, 0], lampG, {}, 12);
  const lampLight = new THREE.PointLight('#ffc060', 7, 8, 2); lampLight.position.set(0.9, 2.3, ZG + 1.0); g.add(lampLight);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: '#ffc870', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); halo.scale.set(1.0, 1.0, 1); halo.position.copy(lampG.position); halo.position.z += 0.05; g.add(halo);
  const pool = lightPool(g, [0.3, 0.02, ZG + 1.4], 2.0, '#ffb050', 0.45), pool2 = lightPool(g, [1.0, 1.6, ZG + 0.03], 1.2, '#ffc060', 0.0); pool2.rotation.set(0, 0, 0);
  const moths = [0, 1, 2, 3].map((i) => ball(0.012, new THREE.MeshBasicMaterial({ color: '#fff4d0', toneMapped: false }), [0, 0, 0], g, { cast: false, recv: false }, 6));
  // ---- the courtyard behind the gate: dark walls and roof, a doorway, a red altar glow, a faint cold TV light ----
  const dark = std('#2a2630', { roughness: 0.95 }); for (const s of [-1, 1]) box(0.2, 3.4, 5.5, dark, [s * 1.6, 1.7, ZG - 2.75], g); box(3.4, 0.2, 5.5, std('#1e1a24'), [0, 3.4, ZG - 2.75], g); box(3.4, 3.4, 0.2, dark, [0, 1.7, ZG - 5.5], g);
  box(1.0, 2.1, 0.06, std('#05050a'), [0, 1.05, ZG - 5.38], g); box(1.1, 0.06, 0.1, std('#4a3220'), [0, 2.12, ZG - 5.36], g); for (const s of [-1, 1]) box(0.06, 2.1, 0.1, std('#4a3220'), [s * 0.53, 1.05, ZG - 5.36], g);
  const altar = new THREE.Group(); altar.position.set(0.0, 1.3, ZG - 5.25); g.add(altar); const aGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: '#ff2a1a', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); aGlow.scale.set(0.7, 0.5, 1); altar.add(aGlow); for (const x of [-0.06, 0.06]) box(0.014, 0.05, 0.014, emis('#ff3a24', 3), [x, 0, 0.01], altar, { cast: false });
  const tvGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: '#6a9aff', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); tvGlow.scale.set(2.2, 2.0, 1); tvGlow.position.set(0.0, 1.1, ZG - 5.0); g.add(tvGlow);
  const tvLight = new THREE.PointLight('#7aa0ff', 0, 5, 2); tvLight.position.set(0, 1.2, ZG - 4.2); g.add(tvLight);
  // flower pots at the foot of the gate and on both sides of the courtyard door
  for (const [x, z, r, c] of [[-0.62, ZG + 0.62, 0.15, '#a85a34'], [-0.32, ZG + 0.82, 0.11, '#9a4a2e'], [0.45, ZG + 0.7, 0.14, '#8a3a26'], [0.7, ZG + 0.95, 0.12, '#b86a3a'], [-0.85, ZG + 1.1, 0.16, '#9a4a2e']]) { const p = pot(x, z, r, c); for (let i = 0; i < 8; i++) ball(0.028, emis(['#ff4a8a', '#ffd23f', '#f2f0e6', '#ff7a2a'][i % 4], 0.6), [Math.cos(i * 2.1) * r * 0.9, r * 2.0 + hash(i + x) * r, Math.sin(i * 2.1) * r * 0.9], p, { cast: false }, 8); }
  // bougainvillea over the lintel
  for (let i = 0; i < 18; i++) ball(0.07 + 0.05 * hash(i), std(['#d8267a', '#e04a9a', '#2f8a4a'][i % 3], { roughness: 0.8 }), [-1.1 + i * 0.13 + hash(i * 3) * 0.1, 2.75 + hash(i * 7) * 0.2, ZG + 0.2], g, { cast: false }, 8);
  // ---- the mouth: a cross street with a cold glow and smoke, a far wall ----
  mesh(new THREE.PlaneGeometry(30, 14), std('#2a2c33', { roughness: 0.8 }), [0, 0, 15], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const far = facadeTex(60, { hue: 215, ground: 'shutter', lit: 0.1 }); for (let i = 0; i < 5; i++) mesh(new THREE.PlaneGeometry(5, 10), new THREE.MeshStandardMaterial({ map: far[0], emissive: '#fff', emissiveMap: far[1], emissiveIntensity: 1.0, roughness: 0.92 }), [-10 + i * 5, 5, 22], g, { cast: false, rot: [0, Math.PI, 0] });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: '#ff7a3a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); glow.scale.set(14, 8, 1); glow.position.set(3, 3, 20); g.add(glow);
  const coldPool = lightPool(g, [0, 0.03, 9.5], 3.6, '#6a8cff', 0.2);
  const smoke = smokeColumn(g, { pos: [4, 0, 17], n: 10, h: 10, w: 3.5, color: '#3a3f4c', op: 0.5, period: 28, seed: 6 });
  const skyT = canvasTex(8, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#04060e'); gr.addColorStop(0.7, '#1b2144'); gr.addColorStop(1, '#31324e'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }); mesh(new THREE.SphereGeometry(70, 16, 12), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }), [0, 0, 0], g, { cast: false, recv: false });
  // ---- marks (world) ----
  const seats = {
    alley_mid: { pos: [0 + at[0], at[1], -4.5 + at[2]], yaw: Math.PI },                            // a runner mid-alley heading for the gate (yaw 0 = running back towards the mouth)
    block_l: { pos: [-0.36 + at[0], at[1], -1.5 + at[2]], yaw: 0 }, block_r: { pos: [0.36 + at[0], at[1], -1.5 + at[2]], yaw: 0 },   // two shoulder to shoulder, facing the mouth (+z), the alley is full
    at_gate: { pos: [0 + at[0], at[1], -9.0 + at[2]], yaw: Math.PI },                                // knocking at the gate, back to the camera at +z
    inside: { pos: [0 + at[0], at[1], -11.6 + at[2]], yaw: Math.PI },                                // behind the gate, in the dark, back turned to a camera in the alley (yaw 0 = she turns to face the gate)
    mouth: { pos: [0 + at[0], at[1], 7.0 + at[2]], yaw: Math.PI },                                   // the alley mouth, facing into the alley (where the horde enters)
  };
  for (let i = 0; i < 12; i++) { const r = Math.floor(i / 3), c = i % 3, z = 2.8 + r * 1.5 + (r > 3 ? 0.5 : 0); seats['horde' + (i + 1)] = { pos: [(c - 1) * (r > 3 ? 1.5 : 0.62) + (hash(i * 3.1) - 0.5) * 0.18 + at[0], at[1], z + at[2]], yaw: Math.PI + (hash(i * 7.3) - 0.5) * 0.3 }; }   // horde1..12 in the alley and its mouth, facing the gate (-z)
  const cams = { wide_in: { from: [0, 1.5, 8.5], at: [0, 1.4, -10], f: 24 }, low_block: { from: [0, 0.4, -4.5], at: [0, 1.0, 2], f: 28 }, gate_close: { from: [0.0, 1.3, -6.5], at: [0, 1.25, -10], f: 40 }, inside_back: { from: [0, 1.2, -8.2], at: [0, 1.1, -11.8], f: 45 } };
  return {
    group: g, light: 'alley_warm', lightAt: [at[0], at[1] + 0.8, -5 + at[2]], seats, cams,
    look: { exposure: 1.0, bloom: [0.3, 0.6, 1.1], env: 0.2, grade: { contrast: 1.12, sat: 1.2, vig: 0.36, grain: 0.014, shadowTint: [0.01, 0.006, 0.03], hiTint: [0.045, 0.022, 0.0] } },
    tune(l) { if (!l?.key) return; l.key.angle = 0.6; l.key.penumbra = 1; l.rim.angle = 0.7; l.kick.angle = 0.7; },
    update(t, fx = {}) {
      const open = smooth(fx.open || 0), kn = fx.knock || 0;
      leaves.forEach(({ hinge, s }, i) => { hinge.rotation.y = s * (-open * 1.75) + kn * 0.025 * Math.sin(t * 11 + i * 1.3) * (1 - open) + (1 - open) * kn * 0.0; hinge.rotation.y += open * 0.012 * Math.sin(t * 3 + i * 2); });
      const lk = (fx.lamp ?? 1), lw = 0.93 + 0.07 * fbm1(t * 0.5, 3); lampLight.intensity = 7 * lk * lw; globe.material.emissiveIntensity = 3.4 * lk * lw; halo.material.opacity = 0.4 * lk * lw; pool.material.opacity = 0.45 * lk * lw;
      moths.forEach((m, i) => { const a = t * (1.2 + 0.3 * i) + i * 1.7; m.position.set(1.05 + 0.2 * Math.cos(a) + 0.04 * Math.sin(a * 3.1), 2.25 + 0.16 * Math.sin(a * 1.3 + i) + 0.04 * Math.sin(a * 2.7), ZG + 0.35 + 0.18 * Math.sin(a)); m.visible = lk > 0.2; });
      lines.forEach(([p, i]) => { p.rotation.z = 0.08 * Math.sin(t * 0.6 + i * 0.9) + 0.03 * Math.sin(t * 1.3 + i); });
      const gl = (fx.glow ?? 0.35); const w = 0.8 + 0.2 * fbm1(t * 0.8, 4) + 0.2 * Math.max(0, noise1(t * 0.31, 8)); tvGlow.material.opacity = 0.32 * gl * w; tvLight.intensity = 5 * gl * w; aGlow.material.opacity = 0.28 + 0.06 * fbm1(t * 0.4, 6);
      glow.material.opacity = 0.32 + 0.05 * fbm1(t * 0.25, 2); smoke.update(t, 1);
    },
  };
}
