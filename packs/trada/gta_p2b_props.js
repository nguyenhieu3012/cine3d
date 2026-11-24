// Trà đá với AI, "Tèo vào GTA 6" part 2 NEW (gta6p2b "Tèo cướp xe xịn?", 20/11): the props. All OFF unless an episode asks (castOpts / setOpts / fx). Our own designs: no real brand, no logo.
//   ledWave(t)       the ONE blink every red light of the film shares (the key fob LED, the tracker dot): a smooth pulse, period 0.5 s
//   makeFob(parent)  the key fob: a gold chain with a ring, a small black key head and a RED LED (blinks with ledWave x the `led` level); update(t, { mode, led })
//                    mode 'hold' = hangs from the anchor (a hand) and sways, 'belt' = hangs from a belt hook and swings a little, 'spin' = whirled round on its chain (the shadow's hand)
//   makeBread(parent)   a bánh mì loaf (golden crust, diagonal cuts)
//   makeBarbell(parent) a barbell with two plates (Tèo's gym)
//   buildSilverCar(parent, o)  the SILVER convertible: buildCar (gta_cars.js) re-skinned and extended: silver paint, red leather, chrome roll hoops, tail fins, hood vents, a rear-view mirror,
//                    a mud-splattered plate, a tarp half over the rear, a palm leaf on the bonnet. fx (prefix `sv`): svrecline 0..1 (seat backs tilt back), svtarp 0..1 (the tarp is pulled off and falls behind),
//                    svdrv 0 | 1 (who drives: 0 = `gas`, 1 = `teo`), svpass 0 | 1 (0 = nobody, 1 = `bip` sits beside), plus every car fx with the prefix sv (svtx svtz svsquat svbrake ...).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, smooth, hash, canvasTex, grain, std, mesh, box, cyl, ball, V } from '../../core/util.js';
import { buildCar } from './gta_cars.js';

export const ledWave = (t) => { const s = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 0.5); return s * s * (3 - 2 * s); };

const glowSpr = (() => { let tex = null; return (col = '#ff2a1a', size = 0.14) => { tex ??= canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.scale.setScalar(size); s.userData.noClip = true; return s; }; })();

// ---------------------------------------------------------------------------------------------------------------------------------
// THE KEY FOB (origin = the anchor: the ring end of the chain; the chain hangs towards -y)
export function makeFob(parent, { len = 0.17 } = {}) {
  const g = new THREE.Group(); parent.add(g); g.visible = false;
  const goldM = new THREE.MeshStandardMaterial({ color: '#ffc43a', roughness: 0.25, metalness: 0.85, emissive: '#6a4300', emissiveIntensity: 0.35 });
  const N = 9, links = [];
  for (let i = 0; i < N; i++) links.push(mesh(new THREE.TorusGeometry(0.0125, 0.0042, 6, 12), goldM, [0, 0, 0], g, { cast: false }));
  const ring = mesh(new THREE.TorusGeometry(0.02, 0.0045, 8, 18), goldM, [0, 0, 0], g, { cast: false });
  const head = new THREE.Group(); g.add(head);
  mesh(new RoundedBoxGeometry(0.036, 0.062, 0.016, 3, 0.007), std('#16151d', { roughness: 0.35, metalness: 0.3 }), [0, -0.031, 0], head);
  mesh(new THREE.BoxGeometry(0.022, 0.003, 0.0175), goldM, [0, -0.02, 0], head, { cast: false });
  const ledM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.02, 0.02), toneMapped: false });
  const led = mesh(new THREE.SphereGeometry(0.0072, 12, 8), ledM, [0, -0.047, 0.0095], head, { cast: false });
  const glow = glowSpr('#ff2a1a', 0.17); glow.position.copy(led.position).add(V(0, 0, 0.004)); head.add(glow);
  const key = mesh(new THREE.BoxGeometry(0.006, 0.05, 0.004), goldM, [0.0, -0.09, 0], head, { cast: false }); key.userData.noOutline = true;
  const p0 = V(), p1 = V(), tmp = V();
  // mode: 'hold' | 'belt' | 'spin'; led 0..1 (the level of the blink: 0 = dark, 1 = full blink); k 0..1 the amount this mode is shown (0 hides)
  function update(t, { mode = 'hold', led = 0, k = 1 } = {}) {
    g.visible = k > 0.01; if (!g.visible) return;
    const sw = mode === 'spin' ? 0 : mode === 'belt' ? 0.14 : 0.3, hang = mode === 'spin' ? 0 : 1;
    const ph = mode === 'spin' ? t * 11 : 0, ang = mode === 'spin' ? ph : sw * Math.sin(t * 2.7) + 0.05 * Math.sin(t * 6.1);
    // the chain: from the anchor out along (sin ang, -cos ang) [hanging] or a flat whirl (spin: a horizontal circle seen from the side)
    const dir = mode === 'spin' ? V(Math.cos(ph) * 0.9, 0.35 * Math.sin(ph * 0.5), Math.sin(ph) * 0.9).normalize() : V(Math.sin(ang), -Math.cos(ang), 0.06 * Math.sin(t * 2.1)).normalize();
    for (let i = 0; i < N; i++) { const u = (i + 0.5) / N, d = u * len; tmp.copy(dir).multiplyScalar(d); if (hang) tmp.y -= 0.0; links[i].position.copy(tmp); links[i].rotation.set(i % 2 ? Math.PI / 2 : 0, Math.atan2(dir.x, dir.z) + 1.2, 0); links[i].scale.setScalar(k); }
    p0.copy(dir).multiplyScalar(len + 0.008); ring.position.copy(p0); ring.rotation.set(Math.PI / 2 + 0.2, 0, 0); ring.scale.setScalar(k);
    head.position.copy(dir).multiplyScalar(len + 0.02); head.rotation.set(0, mode === 'spin' ? Math.atan2(dir.x, dir.z) : 0, ang * 0.7 * (mode === 'spin' ? 0 : 1)); head.scale.setScalar(k);
    if (mode === 'spin') head.rotation.z = Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * 0 + 0;
    const w = ledWave(t) * clamp(led); ledM.color.setRGB(0.35 + 5.0 * w, 0.02 + 0.2 * w, 0.02 + 0.1 * w); glow.material.opacity = 0.95 * w * k;
  }
  g.traverse((m) => { if (m.isMesh || m.isSprite) m.userData.noClip = true; });   // a small prop on a chain: the hand holds it (checked by eye in the strips), the clip check cannot model a hanging chain
  return { group: g, update, N, p1 };
}

// ---------------------------------------------------------------------------------------------------------------------------------
export function makeBread(parent) {
  const g = new THREE.Group(); parent.add(g); g.visible = false;
  const crust = std('#d99a45', { roughness: 0.75 }), light = std('#f3d9a0', { roughness: 0.9 });
  const loaf = mesh(new THREE.CapsuleGeometry(0.028, 0.15, 6, 14), crust, [0, 0, 0], g, { rot: [0, 0, Math.PI / 2] }); loaf.scale.set(1, 1, 0.9);
  for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(0.012, 0.004, 0.034), light, [i * 0.032, 0.0245, 0], g, { cast: false, rot: [0, 0.55, 0] });
  mesh(new THREE.SphereGeometry(0.0255, 10, 8), light, [0.093, 0, 0], g, { cast: false, scale: [0.4, 0.9, 0.9] });
  return g;
}
export function makeBarbell(parent) {
  const g = new THREE.Group(); parent.add(g); g.visible = false;
  const steel = new THREE.MeshStandardMaterial({ color: '#cfd3dc', roughness: 0.25, metalness: 0.85 }), plate = std('#2b2e3d', { roughness: 0.5 }), plate2 = std('#ff4fb8', { roughness: 0.5 });
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 12), steel, [0, 0, 0], g, { rot: [0, 0, Math.PI / 2], cast: false });
  for (const s of [-1, 1]) { mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), plate, [s * 0.34, 0, 0], g, { rot: [0, 0, Math.PI / 2] }); mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 20), plate2, [s * 0.38, 0, 0], g, { rot: [0, 0, Math.PI / 2], cast: false }); }
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// THE SILVER CAR
const mudPlateTex = () => canvasTex(1024, 480, (c, w, h) => {
  c.fillStyle = '#f2f0e6'; c.beginPath(); c.roundRect(0, 0, w, h, 54); c.fill(); c.strokeStyle = '#2a3a5a'; c.lineWidth = 24; c.beginPath(); c.roundRect(24, 24, w - 48, h - 48, 38); c.stroke();
  c.fillStyle = '#2a3a5a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 250px Display, sans-serif'; c.fillText('51K 86', w / 2, h / 2 - 30); c.font = '900 150px Display, sans-serif'; c.fillText('888.88', w / 2, h / 2 + 118);
  // MUD: dark brown splats over the lower half and the right side, flecks everywhere
  for (let i = 0; i < 46; i++) { const x = hash(i * 3.1) * w, y = (0.3 + 0.7 * hash(i * 5.7)) * h, r = 14 + 60 * hash(i * 9.3) * (x > w * 0.45 ? 1.3 : 0.7); c.fillStyle = `rgba(${86 + 30 * hash(i)},${58 + 20 * hash(i + 1)},${34},${0.75 + 0.2 * hash(i + 2)})`; c.beginPath(); c.ellipse(x, y, r, r * (0.6 + 0.5 * hash(i * 2.2)), hash(i) * 3, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(92,62,36,0.92)'; c.beginPath(); c.moveTo(w * 0.5, h * 0.1); for (let k = 0; k <= 12; k++) c.lineTo(w * (0.5 + 0.5 * k / 12), h * (0.1 + 0.08 * Math.sin(k * 2.1))); c.lineTo(w, h); c.lineTo(w * 0.4, h); c.closePath(); c.fill(); grain(c, w, h, 3000, 0.1, 4, 3);
});
const tarpGeo = () => {   // a cloth thrown over the rear: a grid over x -0.95..0.95, z (car frame) -1.95 .. -0.2; the top follows the deck, the sides and the back hang in folds
  const nx = 28, nz = 20, g = new THREE.PlaneGeometry(1.9, 1.75, nx, nz); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i) / 0.95, v = p.getZ(i), au = Math.abs(u); let y = 0.88 - 0.0 * v; const edge = Math.max(0, au - 0.74) / 0.26, back = Math.max(0, (-0.75 - v) / 0.2);
    y -= 0.55 * edge * edge * 1.4 + 0.5 * back * back; const fold = 0.035 * Math.sin(au * 24 + v * 3) * (edge + back * 0.7) + 0.02 * Math.sin(u * 9 + v * 5); p.setY(i, Math.max(0.28, y + fold)); p.setX(i, p.getX(i) * (1 + 0.1 * edge + 0.08 * back)); p.setZ(i, v - 1.07 - 0.08 * back + 0.05 * edge); }
  g.computeVertexNormals(); return g;
};
export function buildSilverCar(parent, o = {}) {
  const riders = { driver: 'gas', pass: null };
  const car = buildCar(parent, { kind: 'hero', prefix: 'sv', at: o.at || [0, 0], yaw: o.yaw || 0, plate: 'SV', color: '#cdd3de', name: 'silver', riders });
  car.group.name = 'car_silver';
  const rigG = car.rig, chassis = car.chassis;
  // ---- re-skin: the existing tub keeps its shape; colours change (trim -> dark graphite, seats -> red leather) ----
  const seatBacks = []; car.group.traverse((m) => { if (!m.isMesh) return; const c = m.material?.color; if (!c) return; const hx = c.getHexString();
    if (hx === '2a2540') { m.material = m.material.clone(); m.material.color.set('#8f1a2c'); m.material.roughness = 0.5; }
    if (hx === 'ffd9b0') { m.material = m.material.clone(); m.material.color.set('#3a3d4a'); }
    if (m.userData.seatBack) seatBacks.push({ m, rx: m.rotation.x }); });
  car.bodyMat.color.set('#cdd3de'); car.bodyMat.metalness = 0.55; car.bodyMat.roughness = 0.28; car.bodyMat.clearcoat = 1;
  // mud plate
  const mt = mudPlateTex(); car.group.traverse((m) => { if (m.name === 'plate_rear' || m.name === 'plate_front') { m.material = m.material.clone(); m.material.map = mt; m.material.emissiveMap = mt; m.material.needsUpdate = true; } });
  const chromeM = new THREE.MeshStandardMaterial({ color: '#e4e8ee', roughness: 0.2, metalness: 0.85 }), dark = std('#23252f', { roughness: 0.5 }), silverM = car.bodyMat;
  // ---- what makes it NOT TÈO 01: two chrome roll hoops behind the seats, tail fins, a hood vent pair + dark racing stripes, a side-view mirror each side, a rear-view mirror on the screen ----
  for (const x of [-0.34, 0.34]) { const h = mesh(new THREE.TorusGeometry(0.2, 0.026, 10, 24, Math.PI), chromeM, [x, 0.84, -0.62], chassis, { rot: [0, 0, 0] }); h.userData.noClip = true; }
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.74, 8), chromeM, [0, 1.04, -0.62], chassis, { rot: [0, 0, Math.PI / 2], cast: false });
  for (const s of [-1, 1]) { const fin = mesh(new RoundedBoxGeometry(0.06, 0.34, 0.95, 2, 0.02), silverM, [s * 0.69, 0.98, -1.3], chassis); fin.rotation.x = -0.12; mesh(new RoundedBoxGeometry(0.05, 0.05, 0.2, 2, 0.02), std('#ff2a3a', { emissive: '#ff2a3a', emissiveIntensity: 1.2 }), [s * 0.69, 0.84, -1.78], chassis, { cast: false }); }
  for (const s of [-1, 1]) { mesh(new THREE.BoxGeometry(0.2, 0.012, 0.8), dark, [s * 0.5, 0.835, 1.5], chassis, { cast: false }); for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.16, 0.008, 0.03), chromeM, [s * 0.5, 0.846, 1.2 + i * 0.1], chassis, { cast: false });
    mesh(new THREE.BoxGeometry(0.1, 0.012, 1.7), chromeM, [s * 0.4, 0.87, 1.4], chassis, { cast: false }).scale.set(1, 1, 0.01); mesh(new THREE.BoxGeometry(0.05, 0.04, 0.12), chromeM, [s * 0.88, 0.9, 0.78], chassis, { cast: false }); }
  mesh(new THREE.BoxGeometry(0.1, 0.012, 1.55), dark, [0, 0.826, 1.4], chassis, { cast: false });   // one dark racing stripe along the bonnet
  const WSm = new THREE.Group(); chassis.add(WSm); WSm.position.set(0, 1.03, 0.7); mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), chromeM, [0, 0.04, 0.0], WSm, { cast: false }); const mirrorG = new THREE.Group(); WSm.add(mirrorG); mirrorG.position.set(0, -0.015, -0.02);
  // the mirror: a chrome-rimmed frame and a glass whose picture is a canvas redrawn from fx svpol (the police car coming up behind, 0..1) and svflash (the red / blue lights): it reads as a REAL MIRROR with a sharp police car inside
  mesh(new RoundedBoxGeometry(0.3, 0.1, 0.02, 2, 0.012), dark, [0, 0, 0], mirrorG, { cast: false }); mesh(new RoundedBoxGeometry(0.285, 0.088, 0.008, 2, 0.01), chromeM, [0, 0, -0.008], mirrorG, { cast: false });
  const mcv = document.createElement('canvas'); mcv.width = 512; mcv.height = 160; const mc = mcv.getContext('2d'), mtex = new THREE.CanvasTexture(mcv); mtex.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(0.265, 0.074), new THREE.MeshBasicMaterial({ map: mtex }), [0, 0, -0.0125], mirrorG, { cast: false, rot: [0, Math.PI, 0] });
  const drawMirror = (t, u, fl) => { const W2 = 512, H2 = 160, sg = mc.createLinearGradient(0, 0, 0, H2); sg.addColorStop(0, '#6a3a8a'); sg.addColorStop(0.5, '#ffa070'); sg.addColorStop(0.52, '#4a4458'); sg.addColorStop(1, '#2a2634'); mc.fillStyle = sg; mc.fillRect(0, 0, W2, H2);
    mc.strokeStyle = 'rgba(255,255,255,0.5)'; mc.lineWidth = 3; for (const x of [-1, 0, 1]) { mc.beginPath(); mc.moveTo(W2 / 2 + x * 8, H2 * 0.52); mc.lineTo(W2 / 2 + x * 190, H2); mc.stroke(); }
    const k = 0.55 + 0.45 * u, cx = W2 / 2 + 30 * (1 - k), cy = H2 * 0.62 + 16 * k, w = 260 * k, h = 90 * k;   // the police car, front view, growing as it comes up
    mc.fillStyle = '#1d2331'; mc.beginPath(); mc.roundRect(cx - w / 2, cy - h, w, h, 8 * k); mc.fill(); mc.fillStyle = '#f3f4f2'; mc.fillRect(cx - w / 2 + 4 * k, cy - h * 0.62, w - 8 * k, h * 0.2); mc.fillStyle = '#2a3a4e'; mc.fillRect(cx - w * 0.36, cy - h * 0.98, w * 0.72, h * 0.34);
    const a = 0.5 + 0.5 * Math.sin(t * 6.1), b = 1 - a, bw = w * 0.22; mc.fillStyle = `rgb(${Math.round(120 + 135 * a * fl)},30,30)`; mc.fillRect(cx - w * 0.3, cy - h * 1.14, bw, h * 0.16); mc.fillStyle = `rgb(30,60,${Math.round(120 + 135 * b * fl)})`; mc.fillRect(cx + w * 0.3 - bw, cy - h * 1.14, bw, h * 0.16);
    for (const s2 of [-1, 1]) { mc.fillStyle = '#fff6c8'; mc.beginPath(); mc.arc(cx + s2 * w * 0.34, cy - h * 0.3, 7 * k + 2, 0, 7); mc.fill(); }
    for (const [col, sx] of [[`rgba(255,40,40,${0.5 * a * fl})`, -0.3], [`rgba(50,90,255,${0.5 * b * fl})`, 0.3]]) { const g2 = mc.createRadialGradient(cx + sx * w, cy - h * 1.06, 2, cx + sx * w, cy - h * 1.06, 90 * k); g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)'); mc.fillStyle = g2; mc.fillRect(0, 0, W2, H2); }
    mtex.needsUpdate = true; };
  drawMirror(0, 0.2, 0);
  // ---- the palm leaf on the bonnet: a rib and 11 leaflets each side, lying across the bonnet ----
  const leaf = new THREE.Group(); chassis.add(leaf); leaf.position.set(0.22, 0.87, 1.45); leaf.rotation.set(0, 0.5, 0); const leafM = new THREE.MeshStandardMaterial({ color: '#3da05a', roughness: 0.7, side: THREE.DoubleSide });
  mesh(new THREE.CylinderGeometry(0.008, 0.012, 1.3, 6), std('#6b8a3a'), [0, 0, 0], leaf, { rot: [0, 0, Math.PI / 2], cast: false });
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) { const x = -0.58 + i * 0.1, L = 0.36 * (1 - 0.35 * Math.abs(i - 5) / 6); const lf = mesh(new THREE.PlaneGeometry(0.075, L), leafM, [x, 0.012, s * L * 0.46], leaf, { cast: false }); lf.rotation.set(-Math.PI / 2 + s * 0.12, 0, -s * 0.35 + (s > 0 ? 0 : Math.PI) * 0); lf.rotation.order = 'YXZ'; lf.rotation.set(s * 1.35, -0.45, 0); }
  // ---- the tarp ----
  const tarp = new THREE.Group(); chassis.add(tarp); const tm = new THREE.Mesh(tarpGeo(), new THREE.MeshStandardMaterial({ color: '#5a7a98', roughness: 0.95, side: THREE.DoubleSide })); tm.castShadow = true; tarp.add(tm);
  const stripe = new THREE.Mesh(tarpGeo(), new THREE.MeshStandardMaterial({ color: '#d9d2c0', roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.0 })); void stripe;
  tm.userData.noClip = true;
  const baseUpdate = car.update;
  const update = (t, fx = {}) => {
    const f = (n) => fx['sv' + n] || 0, rc = clamp(f('recline')), tp = smooth(clamp(f('tarp')));
    for (const s of seatBacks) s.m.rotation.x = s.rx - 0.62 * rc;
    // the tarp: slides back and down off the car and lies behind it
    tarp.position.set(0, -0.0 - 0.0 * tp, 0); tarp.position.z = -1.3 * tp - 0.9 * tp * tp; tarp.position.y = -0.58 * tp * tp - 0.18 * tp; tarp.rotation.x = 0.35 * tp; tm.visible = true;
    riders.driver = f('drv') > 0.5 ? 'teo' : 'gas'; riders.pass = f('pass') > 0.5 ? 'bip' : null;
    drawMirror(t, clamp(f('pol')), clamp(f('flash')));
    baseUpdate(t, fx);
  };
  update(0, {}); car.update = update; car.riders = riders; car.tarp = tarp; car.leaf = leaf;
  return car;
}
