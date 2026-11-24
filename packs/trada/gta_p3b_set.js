// Trà đá với AI, "Tèo vào GTA 6" part 3 NEW (gta6p3b "Tèo trốn bốn sao?", 21/11): the new PLACES and props of the composite set `gta`. All OFF unless the episode asks (setOpts.paint / alley / p3b or a place of that name).
//   paint  (origin x +3200) = the P1 beach road (`buildGtaRoad` again) + a paint shop [SƠN XE 3 PHÚT] in front of the hotels (a drive-in bay with spray rails, green mist, a green light) + a drink seller's cart (nước mát) + a trail ribbon of
//                             wet green paint that grows behind the silver car (fx `svdrip`): a long green line with blobs on the road. The silver car (buildSilverCar) turns glossy green with fx `svpaint` 0..1.
//   alley  (origin x +3600) = a narrow alley (1.84 m wide, walls = planes that face INTO the alley so a camera outside a wall still sees in), WANTED posters [TRUY NÃ] (Tèo's huge body on two stick legs), a window into a small room
//                             (the neighbour's), wires, laundry, a big police car stuck at the mouth (scaled 1.35: wider than the alley), the silver car (mirror scrapes the wall: fx `svscrape` 0..1 = sparks) and a green trail.
//   sea extras (`addP3bSea`, into the existing `sea` place) = two police boats, a helicopter with a searchlight beam (+ a SpotLight on the target), a sandbar, a small ISLAND with palms and two sun loungers, a duck float on the sand,
//                             a tilted tea cup (fx `cupEnd`), the silver car for the pier, the sacks (fx `sack` on a cast member: Tèo's / Bíp's head), a black group of `den1..3` is placed with `stands`.
// Law of the file: a pure function of t. Cars and boats follow ANALYTIC paths given by the episode (`setOpts.p3b.paths`): { paint: { sv, p1 }, alley: { sv, p1 }, sea: { sv, pb1, pb2, heli, heliAt } }.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, smooth, hash, noise1, canvasTex, grain, std, mesh, box, cyl, ball, V } from '../../core/util.js';
import { neonText, FONT, addMat, mergeList, xf } from './gta_bank.js';
import { buildGtaRoad, skyDome, addPalm, finishPalms } from './gta_world.js';   // (a module cycle: only used at call time)
import { buildSilverCar } from './gta_p2b_props.js';
import { buildCar } from './gta_cars.js';
import { buildDuck, DUCK_SEAT, waveH, carFxFrom } from './gta_sea.js';

const TAU = Math.PI * 2, V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const NC = (o) => { o.userData.noClip = true; return o; };
const glowTex = (() => { let t = null; return () => (t ||= canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); })); })();
const SILVER_C = new THREE.Color('#cdd3de'), GREEN_C = new THREE.Color('#12c25a');
const sprite = (parent, col, size, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.scale.setScalar(size); parent.add(s); return s; };
export const P3B = { paint: { shop: { x0: 9.8, x1: 16.6, z: -40, hw: 3.7, bay: 1.5 }, cart: [9.9, -30.8], bay: [13.6, -40] }, alley: { w: 0.92, win: { z: -19.5, y0: 0.95, y1: 2.0, hw: 0.45 }, room: { x1: 4.12, z0: -22.7, z1: -16.3, h: 2.9 }, z0: -34, z1: 10.5 } };

// paint the silver car glossy green (fx svpaint 0..1)
function repaint(car, k) { const m = car.bodyMat; m.color.copy(SILVER_C).lerp(GREEN_C, k); m.metalness = lerp(0.55, 0.22, k); m.roughness = lerp(0.28, 0.08, k); m.clearcoat = 1; m.clearcoatRoughness = lerp(0.1, 0.02, k); if (m.emissive) { m.emissive.set('#06501c'); m.emissiveIntensity = 0.28 * k; } }

// ---------------------------------------------------------------------------------------------------------------------------------
// the trail of wet green paint on the ground, behind a car's path (ribbon + blobs); a pure function of t
// ---------------------------------------------------------------------------------------------------------------------------------
function makeTrail(parent, { pathFn, t0, t1 = 1e9, back = 1.75, N = 220, width = 0.3, y = 0.025, nBlobs = 90, dtBlob = 0.055 }) {
  const mat = new THREE.MeshPhysicalMaterial({ color: '#1fd45a', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#0a7a30', emissiveIntensity: 0.55, side: THREE.DoubleSide });
  const geo = new THREE.BufferGeometry(), pos = new Float32Array((N + 1) * 6), nor = new Float32Array((N + 1) * 6), idx = [];
  for (let i = 0; i <= N; i++) { nor[i * 6 + 1] = 1; nor[i * 6 + 4] = 1; } for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(idx);
  const rib = new THREE.Mesh(geo, mat); rib.frustumCulled = false; rib.receiveShadow = false; rib.castShadow = false; rib.userData.noClip = true; parent.add(rib);
  const bl = []; for (let k = 0; k < nBlobs; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), mat); b.castShadow = false; b.userData.noClip = true; b.visible = false; parent.add(b); bl.push(b); }
  const at = (tau) => { const p = pathFn(tau); return [p.x - Math.sin(p.yaw) * back, p.z - Math.cos(p.yaw) * back, p.yaw]; };
  return { update(t) {
    const te = Math.min(t, t1); const on = te > t0 + 0.03; rib.visible = on; if (!on) { bl.forEach((b) => { b.visible = false; }); return; }
    for (let i = 0; i <= N; i++) { const tau = lerp(t0, te, i / N), [x, z, yaw] = at(tau), w = width * (0.78 + 0.32 * noise1(i * 0.11, 5)) * smooth(i / 14 + 0.05), px = Math.cos(yaw) * w / 2, pz = -Math.sin(yaw) * w / 2;
      pos[i * 6] = x - px; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z - pz; pos[i * 6 + 3] = x + px; pos[i * 6 + 4] = y; pos[i * 6 + 5] = z + pz; }
    geo.attributes.position.needsUpdate = true;
    for (let k = 0; k < nBlobs; k++) { const tau = te - 0.03 - k * dtBlob, b = bl[k]; b.visible = tau >= t0; if (!b.visible) continue; const [x, z, yaw] = at(tau), r = 0.07 + 0.1 * hash(k * 3.7 + 1), side = (hash(k * 1.3) - 0.5) * 0.16;
      b.position.set(x + Math.cos(yaw) * side, y + 0.01, z - Math.sin(yaw) * side); b.scale.set(r, r * 0.35, r * (1.1 + 0.8 * hash(k * 9.1))); b.rotation.y = yaw; } } };
}
// drops falling off the back of the car (car-local frame: they keep their world position while the car drives on)
function makeDrips(car, n = 5) {
  const g = new THREE.Group(); car.group.add(g); const mat = new THREE.MeshPhysicalMaterial({ color: '#1fd45a', roughness: 0.1, clearcoat: 1, emissive: '#0a7a30', emissiveIntensity: 0.6 });
  const ds = []; for (let j = 0; j < n; j++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat); m.scale.set(1, 1.7, 1); m.userData.noClip = true; m.castShadow = false; g.add(m); ds.push(m); }
  return { update(t, k, speed) { ds.forEach((m, j) => { const u = ((t * 2.3 + j / n) % 1), side = (j % 2 ? 1 : -1) * (0.3 + 0.28 * hash(j * 3.1)); m.visible = k > 0.5; m.position.set(side, lerp(0.62, 0.04, u * u), -1.95 - speed * u * 0.34); m.scale.y = 1.2 + 1.2 * (1 - u); }); } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// PAINT: the shop on the road
// ---------------------------------------------------------------------------------------------------------------------------------
export function buildGtaPaint(root, { at = [3200, 0, 0], sunDir, paths = {}, t0 = 0, trailT0 = 1e9, trailT1 = 1e9 } = {}) {
  const R = buildGtaRoad(root, { at, ...(sunDir ? { sunDir } : {}) }), g = R.group; g.name = 'gta_paint';
  const E = new THREE.Group(); E.name = 'paint_extras'; g.add(E);
  const { x0, x1, z: ZC, hw, bay } = P3B.paint.shop, H = 4.2, D = x1 - x0;
  const mint = std('#8fe8d0', { roughness: 0.85 }), mintD = std('#5fc8b0', { roughness: 0.9 }), pinkT = std('#ff7ab8', { roughness: 0.6 }), inside = std('#e9f3ee', { roughness: 0.95 }), dark = std('#23252f', { roughness: 0.8 });
  // walls: back, two sides, the front with a bay (3 m), the fascia over it, the roof
  box(0.25, H, 2 * hw, mint, [x1 + 0.12, H / 2, ZC], E); for (const s of [-1, 1]) box(D + 0.25, H, 0.25, mint, [(x0 + x1) / 2, H / 2, ZC + s * (hw + 0.12)], E);
  box(0.25, 2.5, hw - bay, mint, [x0, 1.25, ZC - (hw + bay) / 2], E); box(0.25, 2.5, hw - bay, mint, [x0, 1.25, ZC + (hw + bay) / 2], E); box(0.25, H - 2.5, 2 * hw, mint, [x0, 2.5 + (H - 2.5) / 2, ZC], E);
  box(D + 0.8, 0.3, 2 * hw + 0.7, pinkT, [(x0 + x1) / 2 - 0.1, H + 0.15, ZC], E);
  // interior: floor with green splats, swatch wall, ceiling light panel, a dark tray under the car
  const floorT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#34363f'; c.fillRect(0, 0, w, h); grain(c, w, h, 2400, 0.1, 3, 2); for (let i = 0; i < 22; i++) { c.fillStyle = `rgba(${40 + 40 * hash(i)},${190 + 40 * hash(i + 3)},${90 + 40 * hash(i + 6)},0.65)`; c.beginPath(); c.ellipse(hash(i * 3.3) * w, hash(i * 7.1) * h, 6 + 14 * hash(i + 9), 3 + 8 * hash(i + 13), hash(i) * 3, 0, 7); c.fill(); } });
  mesh(new THREE.PlaneGeometry(D, 2 * hw), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.55 }), [(x0 + x1) / 2, 0.025, ZC], E, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const swatchT = canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#f2ecdc'; c.fillRect(0, 0, w, h); const cols = ['#ff4f6a', '#ff9a3a', '#ffd23a', '#2fd36a', '#2fc8e6', '#5a6cff', '#b04fe6', '#ffffff', '#3a3a46', '#12c25a']; cols.forEach((cc, i) => { c.fillStyle = cc; c.fillRect(24 + (i % 5) * 96, 28 + Math.floor(i / 5) * 100, 82, 84); c.strokeStyle = '#2a2a34'; c.lineWidth = 3; c.strokeRect(24 + (i % 5) * 96, 28 + Math.floor(i / 5) * 100, 82, 84); }); });
  mesh(new THREE.PlaneGeometry(2 * hw - 0.4, 1.4), new THREE.MeshStandardMaterial({ map: swatchT, roughness: 0.9 }), [x1 - 0.02, 1.9, ZC], E, { cast: false, rot: [0, -Math.PI / 2, 0] });
  mesh(new THREE.PlaneGeometry(D - 0.4, 2 * hw - 0.5), std('#fdf6e6', { emissive: '#fff4d8', emissiveIntensity: 0.9 }), [(x0 + x1) / 2, H - 0.02, ZC], E, { cast: false, recv: false, rot: [Math.PI / 2, 0, 0] });
  // the sign over the bay + a small blade at the kerb
  const signT = canvasTex(1024, 256, (c, w, h) => { c.fillStyle = '#1b1f33'; c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, 38); c.fill(); c.strokeStyle = '#ff7ab8'; c.lineWidth = 12; c.stroke(); neonText(c, 'SƠN XE', 300, 132, 150, '#35f08a', { maxW: 520 }); neonText(c, '3 PHÚT', 760, 132, 150, '#ff6fb0', { maxW: 430 }); });
  NC(mesh(new THREE.PlaneGeometry(6.6, 1.65), new THREE.MeshStandardMaterial({ map: signT, roughness: 0.6, emissive: '#fff', emissiveMap: signT, emissiveIntensity: 0.95 }), [x0 - 0.15, 3.4, ZC], E, { cast: false, rot: [0, -Math.PI / 2, 0] }));
  const blade = canvasTex(256, 1024, (c, w, h) => { c.fillStyle = '#1b1f33'; c.fillRect(0, 0, w, h); c.strokeStyle = '#35f08a'; c.lineWidth = 12; c.strokeRect(10, 10, w - 20, h - 20); neonText(c, 'SƠN', 128, 250, 150, '#35f08a', { maxW: 210 }); neonText(c, 'XE', 128, 470, 160, '#35f08a', { maxW: 210 }); neonText(c, '3', 128, 700, 230, '#ff6fb0', { maxW: 210 }); neonText(c, 'PHÚT', 128, 900, 120, '#ff6fb0', { maxW: 210 }); });
  { const b = new THREE.Group(); b.position.set(x0 - 0.5, 5.6, ZC - hw + 0.3); E.add(b); NC(mesh(new THREE.PlaneGeometry(0.9, 3.6), new THREE.MeshStandardMaterial({ map: blade, emissive: '#fff', emissiveMap: blade, emissiveIntensity: 0.9, side: THREE.DoubleSide }), [0, 0, 0], b, { cast: false, rot: [0, 0.3, 0] })); }
  // the clock: 03:00 counting down is a gag; a plain red LED panel on the side post (a drawn picture, redrawn from t in update)
  const cd = document.createElement('canvas'); cd.width = 256; cd.height = 128; const cc = cd.getContext('2d'), ctex = new THREE.CanvasTexture(cd); ctex.colorSpace = THREE.SRGBColorSpace;
  NC(mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: ctex, toneMapped: false }), [x0 - 0.16, 2.0, ZC + hw - 0.55], E, { cast: false, rot: [0, -Math.PI / 2, 0] }));
  const drawClock = (sec) => { cc.fillStyle = '#10060a'; cc.fillRect(0, 0, 256, 128); cc.strokeStyle = '#ff3a3a'; cc.lineWidth = 6; cc.strokeRect(5, 5, 246, 118); cc.fillStyle = '#ff4040'; cc.font = FONT(86); cc.textAlign = 'center'; cc.textBaseline = 'middle'; const s = Math.max(0, Math.round(sec)), mm = Math.floor(s / 60), ss = s % 60; cc.fillText(`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, 128, 68); ctex.needsUpdate = true; };
  // paint cans and cones at the door
  for (let i = 0; i < 5; i++) cyl(0.13, 0.13, 0.24, std(['#ff4f6a', '#ffd23a', '#2fc8e6', '#12c25a', '#b04fe6'][i]), [x0 - 0.7 - 0.3 * (i % 3), 0.12 + 0.24 * Math.floor(i / 3), ZC - hw + 0.5 + 0.1 * (i % 2)], E, {}, 14);
  for (const dz of [-1.7, 1.7]) mesh(new THREE.ConeGeometry(0.16, 0.5, 14), std('#ff7a1a'), [x0 - 1.4, 0.25, ZC + dz], E, {});
  // the spray rails along both side walls: a nozzle slides along x (fx spray 0..1), green mist sprites, a green light
  const nozz = [-1, 1].map((s) => { const gp = new THREE.Group(); gp.position.set(x0 + 1.6, 1.25, ZC + s * (hw - 0.55)); E.add(gp); box(D - 2.4, 0.07, 0.07, dark, [(D - 2.4) / 2, 0.45, 0], gp, { cast: false }); box(D - 2.4, 0.07, 0.07, dark, [(D - 2.4) / 2, -0.45, 0], gp, { cast: false });
    const n = new THREE.Group(); gp.add(n); box(0.12, 1.0, 0.12, std('#ffd23a'), [0, 0, 0], n, {}); cyl(0.04, 0.05, 0.3, dark, [0, 0, -s * 0.2], n, { rot: [Math.PI / 2, 0, 0] }, 10); return { n, s, gp }; });
  const mist = Array.from({ length: 16 }, (_, i) => sprite(E, '#58ff90', 0.7, 0)); const gl = new THREE.PointLight('#6dff9a', 0, 7, 2); gl.position.set((x0 + x1) / 2, 1.8, ZC); E.add(gl);
  const lamp = new THREE.PointLight('#fff2dc', 6, 8, 2); lamp.position.set((x0 + x1) / 2, 3.6, ZC); E.add(lamp);
  // the drink seller's cart (nước mát) on the pavement, before the shop (road side); she stands beside it
  const [cx, cz] = P3B.paint.cart; const cart = new THREE.Group(); cart.position.set(cx, 0, cz); E.add(cart);
  box(0.9, 0.78, 1.5, std('#c8905a', { roughness: 0.85 }), [0, 0.45, 0], cart); box(1.0, 0.06, 1.6, std('#e8d2a8'), [0, 0.86, 0], cart, { cast: false }); for (const sz of [-1, 1]) for (const sx of [-1, 1]) cyl(0.08, 0.08, 0.1, std('#2a2a30'), [sx * 0.34, 0.06, sz * 0.58], cart, { rot: [0, 0, Math.PI / 2] }, 12);
  for (let i = 0; i < 6; i++) cyl(0.05, 0.04, 0.12, std('#cfeaff', { roughness: 0.1, transparent: true, opacity: 0.7 }), [-0.15 + 0.12 * (i % 3), 0.95, -0.4 + 0.2 * Math.floor(i / 3) + 0.15], cart, { cast: false }, 10);
  cyl(0.17, 0.2, 0.46, std('#d9684a'), [0.18, 1.12, 0.45], cart, {}, 14); cyl(0.13, 0.13, 0.4, std('#35c8a0'), [-0.2, 1.1, 0.5], cart, {}, 14);
  cyl(0.02, 0.02, 2.0, std('#4a3a3a'), [0, 1.9, -0.1], cart, {}, 8); const umb = mesh(new THREE.ConeGeometry(1.25, 0.5, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide }), [0, 2.78, -0.1], cart, { rot: [0, 0, 0] });
  const umbT = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fff6f0' : '#35c8a0'; c.fillRect(i * w / 8, 0, w / 8 + 1, h); } }); umb.material.map = umbT;
  const csign = canvasTex(512, 160, (c, w, h) => { c.fillStyle = '#143a32'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7fe6f2'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16); neonText(c, 'NƯỚC MÁT', w / 2, h / 2 + 2, 96, '#7fe6f2', { maxW: 440 }); });
  NC(mesh(new THREE.PlaneGeometry(1.05, 0.33), new THREE.MeshStandardMaterial({ map: csign, emissive: '#fff', emissiveMap: csign, emissiveIntensity: 0.6 }), [-0.48, 0.55, 0], cart, { cast: false, rot: [0, -Math.PI / 2, 0] }));
  // the silver car + police car + the trail
  const car = buildSilverCar(g, { at: [0, 0], yaw: 0 }); const pol = buildCar(g, { kind: 'police', prefix: 'p1', at: [0, 0], name: 'p1', plate: '29A 123.45' });
  const drips = makeDrips(car); const trail = makeTrail(g, { pathFn: paths.sv || (() => ({ x: 0, z: 0, yaw: 0 })), t0: trailT0, t1: trailT1, width: 0.55, nBlobs: 110 });
  const seats = { ...R.seats }, cams = { ...R.cams }, road0 = R.update;
  const update = (t, fx = {}, follow = null, sc = null) => {
    if (sc) for (const n of ['teo', 'bip']) { const o = sc.getObjectByName(n); if (o && o.rotation.order !== 'YXZ') { const q = o.quaternion.clone(); o.rotation.order = 'YXZ'; o.quaternion.copy(q); } }
    const pv = paths.sv ? paths.sv(t) : { speed: 10 }, f2 = { ...fx, ...(paths.sv ? carFxFrom(paths.sv, 'sv')(t) : {}), ...(paths.p1 ? carFxFrom(paths.p1, 'p1')(t) : {}) };
    // smoothfix 21/11: the silver car is re-placed (turned 180 deg) at paths.svSeam, a designed cut. carFxFrom reads the turn rate over t +- 0.1 s, so for 0.1 s each side of the seam it saw the 180 deg flip as a violent turn: steer 1.0 and lean -0.1 stepped on at seam - 0.1 and off at seam + 0.1 (the 6.32 / 6.52 s jolts). Here the turn rate is read ONE-SIDED (never across the seam): steer and lean stay 0 (the car sits still, then drives straight).
    if (paths.sv && paths.svSeam != null && Math.abs(t - paths.svSeam) < 0.1) { const sm = paths.svSeam, e = 0.1, ep = 1e-4, ta = t < sm ? t - e : Math.max(t - e, sm), tb = t < sm ? Math.min(t + e, sm - ep) : t + e; const dy = ((paths.sv(tb).yaw - paths.sv(ta).yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI, rate = tb > ta ? dy / (tb - ta) : 0; f2.svsteer = clamp(rate * 0.45, -1, 1); f2.svlean = clamp(-rate * 0.03, -0.1, 0.1); }
    repaint(car, smooth(clamp(fx.svpaint || 0))); car.update(t, f2); pol.update(t, { ...f2, p1fade: (fx.p1fade ?? 0) });
    drips.update(t, fx.svdrip || 0, pv.speed || 10); trail.update(t);
    { const tr = sc?.getObjectByName('teo'); road0(t, fx, tr ? { x: tr.position.x, z: tr.position.z } : follow, sc); }   // (the road's sky follows Tèo after the car glued him)
    const sp = clamp(fx.spray || 0); nozz.forEach((o, i) => { o.n.position.x = 0.4 + (D - 3.2) * (0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7)); }); gl.intensity = 7 * smooth(sp);
    mist.forEach((m, i) => { const ph = hash(i * 3.3); m.position.set(x0 + 2.4 + (D - 4.8) * ((ph + t * 0.35 * (i % 2 ? 1 : -1)) % 1 + 1) % 1, 0.5 + 1.0 * hash(i * 5.1) + 0.12 * Math.sin(t * 2 + i), ZC + (hash(i * 7.7) - 0.5) * 2.0); m.material.opacity = 0.5 * smooth(sp) * (0.6 + 0.4 * hash(i)); m.scale.setScalar(0.55 + 0.7 * hash(i * 2.2)); });
    drawClock(lerp(180, 0, smooth(clamp((t - (fx.clock0 ?? 1e9)) / 2.6)))); };
  drawClock(180);
  return { ...R, group: g, seats, cams, update, look: R.look, light: 'gta_dusk', lightAt: [2.75, 0.8, -34], parts: { car, pol, cart, trail } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// ALLEY
// ---------------------------------------------------------------------------------------------------------------------------------
const posterTex = (variant = 0) => canvasTex(512, 768, (c, w, h) => {
  c.fillStyle = '#f2e6c8'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.08, 7 + variant, 3);
  c.fillStyle = '#c4202a'; c.fillRect(0, 0, w, 150); c.fillStyle = '#fff'; c.font = FONT(112); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TRUY NÃ', w / 2, 80);
  c.strokeStyle = '#1b1620'; c.lineWidth = 9; c.lineJoin = 'round'; c.lineCap = 'round';
  // the sketch: a round head with a quiff and a smug grin, a HUGE torso in a gold hoodie, thin stick legs with shoes
  const cx = w / 2, headY = 300; c.fillStyle = '#f1c7a3'; c.beginPath(); c.arc(cx, headY, 62, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#2a2024'; c.beginPath(); c.moveTo(cx - 40, headY - 52); c.quadraticCurveTo(cx, headY - 112, cx + 46, headY - 56); c.quadraticCurveTo(cx, headY - 70, cx - 40, headY - 52); c.fill(); c.stroke();
  c.fillStyle = '#1b1620'; c.beginPath(); c.arc(cx - 22, headY - 8, 7, 0, 7); c.arc(cx + 22, headY - 8, 7, 0, 7); c.fill(); c.beginPath(); c.moveTo(cx - 26, headY + 24); c.quadraticCurveTo(cx, headY + 46, cx + 28, headY + 20); c.stroke();
  c.fillStyle = '#f0b12e'; c.beginPath(); c.ellipse(cx, 468, 196, 122, 0, 0, 7); c.fill(); c.stroke();                       // the huge torso
  c.beginPath(); c.ellipse(cx - 214, 448, 52, 86, 0.5, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.ellipse(cx + 214, 448, 52, 86, -0.5, 0, 7); c.fill(); c.stroke();   // pumped arms
  c.beginPath(); c.arc(cx, 468, 26, 0.2, 2.9); c.stroke();                                                                    // the hoodie pocket line
  c.lineWidth = 11; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 52, 580); c.lineTo(cx + s * 56, 700); c.stroke(); c.fillStyle = '#f4f1ea'; c.beginPath(); c.ellipse(cx + s * 64, 716, 30, 14, 0, 0, 7); c.fill(); c.lineWidth = 7; c.stroke(); c.lineWidth = 11; }   // two stick legs
  c.lineWidth = 6; for (let i = 0; i < 6; i++) { c.globalAlpha = 0.25; c.beginPath(); c.moveTo(60 + hash(i + variant) * 90, 170 + i * 90); c.lineTo(w - 60 - hash(i * 3) * 90, 170 + i * 90 + 12); c.stroke(); } c.globalAlpha = 1;
  c.strokeStyle = '#c4202a'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
});
const stucco = (base, accent, seed) => canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h); grain(c, w, h, 5200, 0.1, seed, 3);
  for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(${accent},${0.06 + 0.1 * hash(i + seed)})`; c.beginPath(); c.ellipse(hash(i * 3.1 + seed) * w, hash(i * 5.7 + seed) * h, 40 + 90 * hash(i + 2), 20 + 60 * hash(i + 5), hash(i) * 3, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(40,24,30,0.18)'; c.fillRect(0, h * 0.82, w, h * 0.18); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, h * 0.82 - 5, w, 5);   // a dado
  c.strokeStyle = 'rgba(20,16,20,0.35)'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(hash(i * 9 + seed) * w, 0); c.lineTo(hash(i * 9 + seed) * w + 20 * hash(i), h * 0.8); c.stroke(); }
}, { repeat: [1, 1] });
const wallPlane = (parent, w, h, mat, pos, rotY, uv = 3.2) => { const geo = new THREE.PlaneGeometry(w, h), u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * w / uv, u.getY(i) * h / uv); const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.y = rotY; m.userData.noClip = true; m.castShadow = false; m.receiveShadow = true; parent.add(m); return m; };

export function buildGtaAlley(root, { at = [3600, 0, 0], paths = {}, trailT0 = 1e9, trailT1 = 1e9 } = {}) {
  const g = new THREE.Group(); g.name = 'gta_alley'; g.position.set(...at); root.add(g);
  const { w: AW, win, room, z0, z1 } = P3B.alley, L = z1 - z0, ZM = (z0 + z1) / 2, WH = 7;
  const dome = new THREE.Group(); g.add(dome); skyDome(dome, { r: 120, sunDir: [-0.1, 0.1, -0.99], sunR: 14, seed: 17 });
  const wallM = (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.FrontSide });
  const tL = stucco('#e0a860', '120,60,30', 3), tR = stucco('#f0b0b8', '90,50,80', 8); tL.wrapS = tL.wrapT = tR.wrapS = tR.wrapT = THREE.RepeatWrapping; const mL = wallM(tL), mR = wallM(tR), mW = wallM(stucco('#f2e0b8', '130,90,50', 12));
  // ground: concrete with puddles + the two streets at the ends
  const gT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#4a4252'; c.fillRect(0, 0, w, h); grain(c, w, h, 3200, 0.12, 5, 2); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4 + 6); c.stroke(); } }, { repeat: [(2 * AW + 1) / 2, (L + 20) / 2] });
  mesh(new THREE.PlaneGeometry(2 * AW + 1, L + 24), new THREE.MeshStandardMaterial({ map: gT, roughness: 0.6 }), [0, 0.0, ZM], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }).userData.noClip = true;
  mesh(new THREE.PlaneGeometry(60, 28), new THREE.MeshStandardMaterial({ map: gT.clone(), roughness: 0.6 }), [0, -0.005, z1 + 14], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }).userData.noClip = true;
  mesh(new THREE.PlaneGeometry(60, 28), new THREE.MeshStandardMaterial({ color: '#4a4252', roughness: 0.6 }), [0, -0.005, z0 - 14], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }).userData.noClip = true;
  // walls = planes facing INTO the alley (a camera outside a wall sees through its back): left wall x = -AW (faces +x), right wall x = +AW (faces -x) with the window
  wallPlane(g, L, WH, mL, [-AW, WH / 2, ZM], Math.PI / 2).rotation.set(0, Math.PI / 2, 0);
  { const zw0 = win.z - win.hw, zw1 = win.z + win.hw; wallPlane(g, zw0 - z0, WH, mR, [AW, WH / 2, (z0 + zw0) / 2], -Math.PI / 2); wallPlane(g, z1 - zw1, WH, mR, [AW, WH / 2, (z1 + zw1) / 2], -Math.PI / 2);
    wallPlane(g, zw1 - zw0, win.y0, mR, [AW, win.y0 / 2, win.z], -Math.PI / 2); wallPlane(g, zw1 - zw0, WH - win.y1, mR, [AW, win.y1 + (WH - win.y1) / 2, win.z], -Math.PI / 2); }
  // ---- stagefix 21/11 (owner: "hai bên nhà biến mất", the wide shot from outside showed two paper-thin spikes and a black floor): CLOSED building masses behind both walls (boxes with a roof and lit windows on every face), so no camera
  // sees a cut-away; the street at both ends is lit (emissive tint + lamp pools). The wall planes stay the inner skin of the alley (nothing about the alley picture inside changes).
  { const facT = {}, facade = (v, glow) => (facT[v + (glow ? 'g' : 'c')] ||= canvasTex(256, 256, (c, w, h) => {
      const base = ['#6a4a5e', '#5a4a6e', '#74504a'][v % 3]; c.fillStyle = glow ? '#000' : base; c.fillRect(0, 0, w, h); if (!glow) grain(c, w, h, 2600, 0.1, 21 + v, 3);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const lit = hash(r * 7.3 + k * 3.1 + v * 5.7) > 0.55, x = 18 + k * 62, y = 16 + r * 62, col = ['#ffd890', '#ff9fc0', '#ffe8b0', '#9fd8ff'][Math.floor(hash(r + k * 4 + v * 2) * 4)];
        if (glow) { if (lit) { c.fillStyle = col; c.fillRect(x, y, 34, 40); } } else { c.fillStyle = lit ? col : '#1c1626'; c.fillRect(x, y, 34, 40); c.strokeStyle = '#2a1c30'; c.lineWidth = 4; c.strokeRect(x - 2, y - 2, 38, 44); c.fillStyle = '#2a1c30'; c.fillRect(x - 6, y + 42, 46, 5); } } }, { repeat: [1, 1] }));
    const faceMat = (v, rx, ry) => { const m = new THREE.MeshStandardMaterial({ map: facade(v, false).clone(), emissiveMap: facade(v, true).clone(), emissive: '#fff', emissiveIntensity: 1.1, roughness: 0.95 }); for (const t of [m.map, m.emissiveMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; } return m; };
    const roofM = std('#2a2230', { roughness: 1 }), dark = std('#1d1822', { roughness: 1 });
    const mass = (x0, x1, y0, y1, za, zb, v) => { const W = Math.abs(x1 - x0), D = zb - za, H = y1 - y0, side = faceMat(v, D / 4, H / 4), endm = faceMat(v + 1, W / 4, H / 4);
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [side, side, roofM, dark, endm, endm]); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (za + zb) / 2); m.userData.noClip = true; m.castShadow = false; m.receiveShadow = false; g.add(m); return m; };
    const roofKit = (xc, y, zc, i) => { if (i % 3 === 0) { NC(cyl(0.7, 0.7, 1.1, dark, [xc, y + 0.55, zc], g, { cast: false }, 14)); NC(cyl(0.05, 0.05, 1.4, dark, [xc + 0.9, y + 0.7, zc - 0.6], g, { cast: false }, 6)); } else if (i % 3 === 1) NC(box(1.4, 0.7, 1.0, dark, [xc, y + 0.35, zc], g, { cast: false })); else NC(cyl(0.03, 0.03, 2.4, dark, [xc, y + 1.2, zc], g, { cast: false }, 6)); };
    const B = 0.012, zs = []; for (let z = z0 - 2.0; z < z1 + 8; ) { const d = 5 + 4 * hash(z * 1.9 + 3); zs.push([z, Math.min(z1 + 8, z + d)]); z += d; }
    zs.forEach(([za, zb], i) => { const hl = 8.2 + 4.8 * hash(i * 2.3 + 1), hr = 8.0 + 5.0 * hash(i * 3.7 + 2), dl = 5.5 + 3 * hash(i + 9), dr = 5.5 + 3 * hash(i + 4);
      mass(-AW - B, -AW - B - dl, 0, hl, za, zb, i); roofKit(-AW - 1.8, hl, (za + zb) / 2, i);
      if (zb > room.z0 - 0.02 && za < room.z1 + 0.02) { const a = Math.max(za, room.z0 - 0.02), b = Math.min(zb, room.z1 + 0.02); mass(AW + B, AW + B + dr, room.h + 0.05, hr, a, b, i + 1);   // over the room
        if (za < room.z0 - 0.02) mass(AW + B, AW + B + dr, 0, hr, za, room.z0 - 0.02, i + 1); if (zb > room.z1 + 0.02) mass(AW + B, AW + B + dr, 0, hr, room.z1 + 0.02, zb, i + 1);
        mass(room.x1 + 0.03, Math.max(room.x1 + 1.6, AW + B + dr), 0, hr, a, b, i + 1); } else mass(AW + B, AW + B + dr, 0, hr, za, zb, i + 1);
      roofKit(AW + 1.8, hr, (za + zb) / 2, i + 1); });
    // the street at both ends: brighter pavement (the sky colour on it) + two lamp pools at the exit end + kerb strips
    for (const gz of [z1 + 14, z0 - 14]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 28), new THREE.MeshStandardMaterial({ color: '#8a7596', roughness: 0.75, emissive: '#5a3a6a', emissiveIntensity: 0.55 })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.012, gz); m.userData.noClip = true; m.castShadow = false; g.add(m); }
    for (const sx of [-1, 1]) { const lp = new THREE.PointLight('#ffb878', 16, 16, 2); lp.position.set(sx * 3.4, 3.2, z0 - 6); g.add(lp); NC(cyl(0.05, 0.05, 3.2, dark, [sx * 3.4, 1.6, z0 - 6], g, { cast: false }, 6)); NC(ball(0.16, std('#fff2c8', { emissive: '#ffcf80', emissiveIntensity: 1.8 }), [sx * 3.4, 3.25, z0 - 6], g, { cast: false, recv: false }, 8)); }
    const kerbM = std('#b09ab8', { roughness: 0.9, emissive: '#3a2a48', emissiveIntensity: 0.5 }); for (const sx of [-1, 1]) NC(box(0.5, 0.12, 24, kerbM, [sx * (AW + 0.28), 0.06, z0 - 12], g, { cast: false })); }
  // the window: a wooden frame, a sill, a pink curtain each side; the room behind it
  const wood = std('#7a4a2a', { roughness: 0.8 }), curt = new THREE.MeshStandardMaterial({ color: '#ff9fc0', roughness: 0.95, side: THREE.DoubleSide });
  box(0.18, 0.06, 2 * win.hw + 0.14, wood, [AW + 0.02, win.y1 + 0.03, win.z], g, { cast: false }); box(0.28, 0.07, 2 * win.hw + 0.2, wood, [AW - 0.04, win.y0 - 0.02, win.z], g, { cast: false });
  for (const s of [-1, 1]) { box(0.18, win.y1 - win.y0, 0.06, wood, [AW + 0.02, (win.y0 + win.y1) / 2, win.z + s * (win.hw + 0.03)], g, { cast: false }); mesh(new THREE.PlaneGeometry(0.12, win.y1 - win.y0 - 0.1), curt, [AW + 0.1, (win.y0 + win.y1) / 2, win.z + s * (win.hw - 0.05)], g, { cast: false, rot: [0, -Math.PI / 2 + s * 0.1, 0] }).userData.noClip = true; }
  // the room (planes that face inward): floor, ceiling, back wall x = room.x1, side walls
  { const RW = room.z1 - room.z0, RD = room.x1 - AW, RM = (room.z0 + room.z1) / 2, rx = (AW + room.x1) / 2, flT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c8a070'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#bd9462' : '#d2aa7e'; c.fillRect(0, i * h / 8, w, h / 8 - 2); } grain(c, w, h, 1500, 0.08, 2, 2); }, { repeat: [1, 1] });
    mesh(new THREE.PlaneGeometry(RD, RW), new THREE.MeshStandardMaterial({ map: flT, roughness: 0.6 }), [rx, 0.02, RM], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }).userData.noClip = true;
    mesh(new THREE.PlaneGeometry(RD, RW), std('#f6ead2', { roughness: 1 }), [rx, room.h, RM], g, { cast: false, rot: [Math.PI / 2, 0, 0] }).userData.noClip = true;
    const bwT = canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#9fd8c8'; c.fillRect(0, 0, w, h); grain(c, w, h, 2000, 0.07, 3, 2); c.fillStyle = '#e8dcc0'; c.fillRect(0, h * 0.78, w, h * 0.22); for (const [x, y, ww, hh, col] of [[60, 50, 90, 110, '#f2b6c8'], [190, 40, 70, 90, '#ffd88a'], [320, 56, 110, 80, '#b4c8f0']]) { c.fillStyle = '#5a3a24'; c.fillRect(x - 6, y - 6, ww + 12, hh + 12); c.fillStyle = col; c.fillRect(x, y, ww, hh); } });
    mesh(new THREE.PlaneGeometry(RW, room.h), new THREE.MeshStandardMaterial({ map: bwT, roughness: 0.9 }), [room.x1, room.h / 2, RM], g, { cast: false, rot: [0, -Math.PI / 2, 0] }).userData.noClip = true;
    for (const [zz, ry] of [[room.z0, 0], [room.z1, Math.PI]]) mesh(new THREE.PlaneGeometry(RD, room.h), std('#f6e3c0', { roughness: 0.95 }), [rx, room.h / 2, zz], g, { cast: false, rot: [0, ry, 0] }).userData.noClip = true;
    // furniture: a bed, a small table with a fan, a lamp (warm), a TV on a stand
    box(1.0, 0.32, 2.0, std('#8a5a3a'), [room.x1 - 0.7, 0.18, room.z0 + 1.2], g, {}); box(0.95, 0.12, 1.9, std('#ff9fc0'), [room.x1 - 0.7, 0.4, room.z0 + 1.2], g, {});
    box(0.7, 0.55, 0.6, std('#8a5a3a'), [room.x1 - 0.5, 0.28, room.z1 - 0.5], g, {}); cyl(0.12, 0.16, 0.3, std('#fff2c8', { emissive: '#ffd890', emissiveIntensity: 1.4 }), [room.x1 - 0.5, 0.72, room.z1 - 0.5], g, { cast: false }, 14);
    box(0.65, 0.4, 0.5, std('#1b1f2a'), [room.x1 - 0.5, 1.0, room.z0 + 3.4], g, {}); box(0.5, 0.3, 0.02, std('#2a4a6a', { emissive: '#3a78a8', emissiveIntensity: 0.9 }), [room.x1 - 0.76, 1.0, room.z0 + 3.4], g, { cast: false });
    const rl = new THREE.PointLight('#ffd9a0', 9, 7.5, 2); rl.position.set(room.x1 - 1.0, 2.3, room.z0 + 3.2); g.add(rl); }
  // posters on both walls (TRUY NÃ, different tilts), a tangle of wires, laundry, a flower pot, drain pipes
  const posters = [[-1, -2.4, 0.06], [-1, -5.4, -0.04], [1, -4.2, 0.03], [-1, -14.5, -0.05], [1, -16.4, 0.05], [-1, -19.0, 0.03], [1, -21.8, -0.04], [-1, 2.8, 0.04], [1, 4.6, -0.03], [-1, -26.0, 0.05]];
  posters.forEach(([side, z, tilt], i) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.05), new THREE.MeshStandardMaterial({ map: posterTex(i % 3), roughness: 0.9 })); p.position.set(side * (AW - 0.012), 1.5 + 0.05 * (i % 3), z); p.rotation.set(0, -side * Math.PI / 2, tilt); p.userData.noClip = true; p.userData.poster = i; p.receiveShadow = false; p.castShadow = false; g.add(p);
    for (const dx of [-0.3, 0.3]) NC(mesh(new THREE.PlaneGeometry(0.16, 0.05), std('#f2e6a0', { roughness: 0.7 }), [side * (AW - 0.016), 1.5 + 0.05 * (i % 3) + 0.52, z + dx * 1.0], g, { cast: false, rot: [0, -side * Math.PI / 2, tilt] })); });
  { const wires = []; const wm = new THREE.LineBasicMaterial({ color: '#12101a' }); for (let i = 0; i < 9; i++) { const z = z0 + 3 + i * 4.6 + 0.8 * hash(i), y = 3.4 + 1.3 * hash(i + 4); const pts = []; for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push(new THREE.Vector3(lerp(-AW, AW, u), y - 0.18 * Math.sin(Math.PI * u), z + 0.6 * (hash(i + 2) - 0.5) * u)); } const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wm); ln.userData.noClip = true; g.add(ln); wires.push(ln); }
    for (const [z, col] of [[-12, '#35c8e6'], [-18.5, '#ffd23a'], [4, '#ff6fa0']]) { const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, side: THREE.DoubleSide })); cl.position.set(0.0, 3.9, z); cl.rotation.set(0, 1.57, 0.08); cl.userData.noClip = true; g.add(cl); }
    for (const s of [-1, 1]) NC(cyl(0.05, 0.05, WH, std('#8a8a96', { metalness: 0.4 }), [s * (AW - 0.06), WH / 2, s > 0 ? -22.8 : 6.2], g, { cast: false }, 8));
    NC(cyl(0.2, 0.15, 0.4, std('#d9684a'), [-AW + 0.22, 0.2, -7.4], g, { cast: false }, 12)); ball(0.22, std('#2f8f4a'), [-AW + 0.22, 0.55, -7.4], g, { cast: false, recv: false }, 10).userData.noClip = true;
    for (const [z, h2] of [[-0.8, 3.2], [-16, 3.0], [-24.5, 2.9]]) { const lm = new THREE.PointLight('#ffb070', 3.6, 6, 2); lm.position.set(0, h2, z); g.add(lm); NC(ball(0.1, std('#fff2c8', { emissive: '#ffcf80', emissiveIntensity: 1.6 }), [0, h2, z], g, { cast: false }, 8)); } }
  // the silver car, the big police car at the mouth, the green trail, sparks of the scraping mirror
  const car = buildSilverCar(g, { at: [0, 0], yaw: 0 }); const pol = buildCar(g, { kind: 'police', prefix: 'p1', at: [0, 0], name: 'p1', plate: '29A 123.45' }); pol.group.scale.setScalar(1.35);
  const drips = makeDrips(car); const trail = makeTrail(g, { pathFn: paths.sv || (() => ({ x: 0, z: 0, yaw: 0 })), t0: trailT0, t1: trailT1, width: 0.26 });
  const sparks = Array.from({ length: 8 }, () => sprite(g, '#ffd27a', 0.28, 0)); const seats = {}, cams = {};
  // gate fix 21/11: one cool blue RIM light that rides with the silver car (pure function of its path): it draws the car body's edge against the dark red walls (the alley read at mean luma 25-28)
  const rimL = new THREE.PointLight('#4f9dff', 2.4, 3.6, 2); rimL.position.set(-0.55, 1.7, 0); g.add(rimL);
  const update = (t, fx = {}, follow = null, sc = null) => {
    if (sc) for (const n of ['teo', 'bip']) { const o = sc.getObjectByName(n); if (o && o.rotation.order !== 'YXZ') { const q = o.quaternion.clone(); o.rotation.order = 'YXZ'; o.quaternion.copy(q); } }
    const f2 = { ...fx, ...(paths.sv ? carFxFrom(paths.sv, 'sv')(t) : {}), ...(paths.p1 ? carFxFrom(paths.p1, 'p1')(t) : {}) }; const pv = paths.sv ? paths.sv(t) : { speed: 4 };
    repaint(car, smooth(clamp(fx.svpaint || 0))); car.update(t, f2); pol.update(t, { ...f2, p1fade: fx.p1fade ?? 0 }); drips.update(t, fx.svdrip || 0, pv.speed || 4); trail.update(t);
    const sc2 = clamp(fx.svscrape || 0); sparks.forEach((s, i) => { const ph = ((t * 7 + i * 0.37) % 1); s.material.opacity = sc2 > 0.3 ? 0.9 * (1 - ph) * (hash(i * 2.1 + Math.floor(t * 7)) > 0.3 ? 1 : 0) : 0; s.position.set(AW - 0.02, 0.85 + 0.2 * ph, pv.z + 0.55 - 0.5 * ph - (i % 3) * 0.12); s.scale.setScalar(0.22 + 0.2 * (1 - ph)); });
    rimL.position.set(-0.55, 1.7, pv.z + 0.4);
    dome.position.set(0, 0, (follow ? follow.z - at[2] : 0)); };
  update(0);
  const look = { exposure: 0.92, bloom: [0.3, 0.55, 1.0], env: 0.16, grade: { contrast: 1.12, sat: 1.1, vig: 0.36, grain: 0.014, shadowTint: [0.0, 0.01, 0.04], hiTint: [0.05, 0.014, 0.0] } };
  return { group: g, seats, cams, update, look, light: 'gta_alley', lightAt: [0, 1.0, -6], parts: { car, pol, trail } };
}
