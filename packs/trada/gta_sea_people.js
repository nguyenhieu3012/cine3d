// Trà đá với AI, "Tèo vào GTA 6" part 3 (gta6p3, 20/11): the people of the sea place. Built on `makePerson` like Chị Lan (gta_shop.js). Cast names:
//   linh   LINH, standing (pier): young woman, sunglasses pushed up on her long black hair, orange life vest over a white summer top, shorts, sandals, a phone in a GOLD "KIM CƯƠNG" case
//   linhs  the same, SEATED (on the jet ski / in the water; the seated model has bent legs)
//   daica  ĐẠI CA: a big man, black sunglasses, gold chain with a pendant, tattoos (chest, neck, forearm bands), black tank top; NO weapon. Seated (the truck cab, the black jet ski)
//   cong1 / cong2  two police officers, standing: navy cap with a badge, light-blue shirt, navy trousers; cong1 holds a phone with a LIVE frame
// Poses (on top of the standing / seated set of makePerson): scroll (low phone, back of the gold case towards the viewer) ear (phone at the ear) show (arm out, the phone's screen towards the viewer) hug (seated: hands round the
// waist of the rider in front) three (right hand up with three fingers) point3.  Pose number `phoneP` = 1 scroll / 2 ear / 3 show, `phoneScr` = 1 qr / 2 photo / 3 live (0 dark) (what the screen shows).
// Nothing here is a real brand, uniform insignia or weapon.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, canvasTex, std, mesh, V } from '../../core/util.js';
import { makePerson } from './people.js';
import { FONT } from './gta_bank.js';

const TAU = Math.PI * 2;
const TORSO = [[0.001, 0.3], [0.13, 0.3], [0.168, 0.36], [0.172, 0.46], [0.155, 0.58], [0.128, 0.68], [0.085, 0.735], [0.04, 0.752], [0.001, 0.755]];
const rAt = (y) => { for (let i = 0; i < TORSO.length - 1; i++) { const [r0, y0] = TORSO[i], [r1, y1] = TORSO[i + 1]; if (y >= y0 && y <= y1) return lerp(r0, r1, (y - y0) / (y1 - y0)); } return 0.04; };

// ---- phone with a gold case on the back and a screen on the front (+z = the back / case, -z = the screen) ----
function phoneTextures() {
  const gold = canvasTex(128, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffe08a'); g.addColorStop(0.5, '#ffc43a'); g.addColorStop(1, '#e0a010'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(64, 38); c.lineTo(94, 62); c.lineTo(64, 96); c.lineTo(34, 62); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(34, 62); c.lineTo(94, 62); c.stroke();   // a diamond
    c.fillStyle = '#7a4a00'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = FONT(25); c.fillText('KIM', 64, 150); c.fillText('CƯƠNG', 64, 182); });
  const qr = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#fff6f0'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffc43a'; c.fillRect(0, 0, w, 36); c.fillStyle = '#10131c'; c.font = FONT(14); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TÌNH YÊU VÀNG', 64, 18);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 13 + i * j) % 3) { c.fillStyle = '#10131c'; c.fillRect(14 + i * 11, 56 + j * 11, 10, 10); } c.fillStyle = '#ffc43a'; c.fillRect(0, 214, w, 42); c.fillStyle = '#10131c'; c.font = FONT(18); c.fillText('3.000.000đ', 64, 235); });
  const photo = canvasTex(128, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6a3f9a'); g.addColorStop(1, '#ff9a78'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b1a26'; c.fillRect(10, 40, 108, 14); c.fillStyle = '#e0a010'; c.fillRect(64, 54, 5, 40); c.fillStyle = '#e85d00'; c.save(); c.translate(64, 140); c.rotate(0.28); c.beginPath(); c.roundRect(-44, -22, 88, 44, 10); c.fill(); c.fillStyle = '#17151f'; c.beginPath(); c.arc(-26, 24, 12, 0, TAU); c.arc(26, 24, 12, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(-20, -4, 40, 18); c.fillStyle = '#14234f'; c.font = FONT(13); c.textAlign = 'center'; c.fillText('TÈO 01', 0, 10); c.restore(); });
  const live = canvasTex(128, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a2a6a'); g.addColorStop(1, '#ff8a5a'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(20, 70, 88, 130);
    c.fillStyle = '#f0b12e'; c.beginPath(); c.arc(64, 120, 16, 0, TAU); c.fill(); c.fillRect(54, 134, 20, 40); c.fillStyle = '#ff2a3a'; c.beginPath(); c.roundRect(8, 8, 46, 22, 6); c.fill(); c.fillStyle = '#fff'; c.font = FONT(15); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LIVE', 31, 19); });
  const dark = canvasTex(8, 8, (c) => { c.fillStyle = '#10131c'; c.fillRect(0, 0, 8, 8); });
  return { gold, qr, photo, live, dark };
}
function addPhone(body, { gold = true } = {}) {
  const T = phoneTextures(), ph = new THREE.Group(); body.add(ph); ph.visible = false;
  mesh(new RoundedBoxGeometry(0.095, 0.19, 0.014, 3, 0.012), std(gold ? '#ffc43a' : '#17151d', { roughness: 0.3, metalness: gold ? 0.7 : 0.4 }), [0, 0, 0], ph);
  if (gold) mesh(new THREE.PlaneGeometry(0.086, 0.18), new THREE.MeshStandardMaterial({ map: T.gold, roughness: 0.35, metalness: 0.5, emissive: '#fff', emissiveMap: T.gold, emissiveIntensity: 0.25 }), [0, 0, 0.0075], ph, { cast: false });
  const scr = mesh(new THREE.PlaneGeometry(0.084, 0.176), new THREE.MeshStandardMaterial({ map: T.dark, emissive: '#fff', emissiveMap: T.dark, emissiveIntensity: 1.0, roughness: 0.5 }), [0, 0, -0.0075], ph, { cast: false, rot: [0, Math.PI, 0] });
  const setScr = (k) => { const m = T[k] || T.dark; if (scr.material.map !== m) { scr.material.map = m; scr.material.emissiveMap = m; scr.material.needsUpdate = true; } };
  return { ph, setScr };
}
const CASE = (p) => ({ 1: 'scroll', 2: 'ear', 3: 'show' }[Math.round(p)] || null);
function placePhone(ph, mode, H, hidden) {
  ph.visible = !hidden && !!mode; if (!ph.visible) return;
  if (mode === 'scroll') { ph.position.copy(H[1]).add(V(-0.01, 0.055, 0.015)); ph.rotation.set(0.5, 0.85, 0.05); }       // the back (case) faces forward-up, the screen faces her
  else if (mode === 'ear') { ph.position.copy(H[1]).add(V(0.02, 0.05, 0.0)); ph.rotation.set(0.0, -1.35, 0.1); }       // against her ear, the back out to the side
  else { ph.position.copy(H[1]).add(V(0, 0.085, 0.035)); ph.rotation.set(-0.15, Math.PI - 0.7, 0); }                           // show: the screen towards the viewer
}
const sunglass = (head, { z = 0.158, y = 0.03, up = false, col = '#0c0c12' } = {}) => {
  const m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.12, metalness: 0.3, clearcoat: 1 });
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(1, 16, 12), m, [s * 0.066, y, z], head, { scale: [0.056, 0.038, 0.012], rot: [up ? -0.9 : 0, 0, s * 0.12], cast: false });
  mesh(new THREE.BoxGeometry(0.03, 0.01, 0.01), m, [0, y + 0.006, z + 0.002], head, { cast: false }); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.01, 0.01, 0.13), m, [s * 0.126, y + 0.006, z - 0.065], head, { cast: false });
};

// ---------------------------------------------------------------------------------------------------------------------------------
// LINH
// ---------------------------------------------------------------------------------------------------------------------------------
export function makeLinh(seated = false) {
  const L = seated ? 0 : 0.36, build = 0.94, zs = 0.82 * lerp(1, build, 0.5);
  const decorate = ({ body, head, hipY }) => {
    const orange = std('#ff7a1a', { roughness: 0.65 }), orangeD = std('#e05a00', { roughness: 0.7 }), blk = std('#15141c', { roughness: 0.5 }), yel = std('#ffd21f', { roughness: 0.5 });
    const strip = (mat, y0, y1, half, off, yaw = 0, k = 1) => { const pts = []; for (let i = 0; i <= 8; i++) { const y = lerp(y0, y1, i / 8); pts.push(new THREE.Vector2(rAt(y) + off, y - 0.3)); } const m = mesh(new THREE.LatheGeometry(pts, 12, yaw - half / 0.16, 2 * half / 0.16), mat, [0, hipY, 0], body); m.scale.set(build * k, 1, zs * k); m.userData.noClip = true; return m; };
    // the life vest: two front panels with a dark zip gap, a back panel, shoulder straps, a buckle band, reflective yellow stripes
    for (const s of [-1, 1]) { strip(orange, 0.4, 0.72, 0.1, 0.012, s * 0.62); strip(yel, 0.5, 0.54, 0.1, 0.0135, s * 0.62); }
    strip(orange, 0.4, 0.72, 0.19, 0.012, Math.PI); strip(blk, 0.4, 0.72, 0.012, 0.0135, 0);
    for (const s of [-1, 1]) strip(orangeD, 0.68, 0.755, 0.03, 0.013, s * 0.42); strip(blk, 0.45, 0.5, 0.15, 0.0142, 0, 1.0);
    // sunglasses pushed up on her hair
    sunglass(head, { z: 0.112, y: 0.125, up: true, col: '#101018' });
    const { ph, setScr } = addPhone(body, { gold: true });
    // three fingers up (pose 'three')
    const fg = new THREE.Group(); body.add(fg); fg.visible = false; for (let i = -1; i <= 1; i++) { const f = mesh(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), std('#efc3a0', { roughness: 0.5 }), [i * 0.026, 0.045, 0], fg, { cast: false }); f.rotation.z = -i * 0.15; }
    return { update(p, t, api, H) { const mode = CASE(p.phoneP || 0); if (mode) setScr(['dark', 'qr', 'photo', 'live'][Math.round(p.phoneScr || 0)] || 'dark'); placePhone(ph, mode, H, false); fg.visible = (p.three || 0) > 0.5; if (fg.visible) { fg.position.copy(H[1]).add(V(0, 0.035, 0.02)); } } };
  };
  const p = makePerson({ decorate, name: seated ? 'linhs' : 'linh', skin: '#f0c4a0', hair: 'long', hairColor: '#18121a', top: '#fbf6ec', collar: '#fbf6ec', bottom: '#f4f1ea', age: 'young', build, stand: !seated, lift: seated ? undefined : L, legFrac: 0.5, lash: true, shoe: '#ff9a6a', color: '#ff8a5a', seed: 91, lips: '#d83a5a' });
  const ZC = 0.4, Lp = seated ? 0 : L, base = seated ? [0, 0] : [0, 0];
  Object.assign(p.poses, {
    scroll: { l: [-0.17, Lp + 0.55, 0.3, 0], r: [0.14, Lp + 0.62, 0.3, 0], phoneP: 1 },
    ear: { l: [-0.17, Lp + 0.45, 0.2, 0], r: [0.15, Lp + 0.97, 0.06, 0], phoneP: 2 },
    show: { l: [-0.17, Lp + 0.45, 0.2, 0], r: [0.2, Lp + 0.78, 0.46, 0], phoneP: 3 },
    hug: { l: [-0.12, Lp + 0.47, 0.42, 0], r: [0.14, Lp + 0.5, 0.42, 0] },
    three: { l: [-0.17, Lp + 0.4, 0.1, 0], r: [0.2, Lp + 0.98, 0.3, 0], three: 1 },
    drop: { l: [-0.2, Lp + 0.6, 0.0, 0], r: [0.2, Lp + 0.6, 0.0, 0] },
  });
  void ZC; void base;
  Object.assign(p.faces, { love: { eye: 1, arc: 0, size: 1.3, brow: 0.9, tilt: 0, smile: 1, open: 0.7, wide: 1.3, blush: 1, sweat: 0, tear: 0 } });
  return p;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// ĐẠI CA: big, sunglasses, gold chain, tattoos, black tank top. Seated.
// ---------------------------------------------------------------------------------------------------------------------------------
export function makeDaica() {
  const build = 1.32, L = 0, zs = 0.82 * lerp(1, build, 0.5);
  const decorate = ({ body, head, hipY, skinM }) => {
    const gold = new THREE.MeshStandardMaterial({ color: '#ffc43a', roughness: 0.25, metalness: 0.9, emissive: '#6a4a00', emissiveIntensity: 0.25 });
    sunglass(head, { z: 0.16, y: 0.028 });
    // gold chain (two loops) + a dollar-less pendant (a gold square with a diamond)
    for (let i = 0; i < 2; i++) { const c = mesh(new THREE.TorusGeometry(0.108 + i * 0.012, 0.011, 8, 28), gold, [0, hipY + 0.455 - i * 0.045, 0.012 + i * 0.012], body, { rot: [Math.PI / 2 - 0.35 - i * 0.12, 0, 0], scale: [build * 1.08, 1, 1.0], cast: false }); c.userData.noClip = true; }
    const pend = mesh(new RoundedBoxGeometry(0.06, 0.06, 0.012, 2, 0.01), gold, [0, hipY + 0.34, 0.136], body, { rot: [0, 0, Math.PI / 4], cast: false }); pend.userData.noClip = true;
    // tattoos: a chest patch (skin + ink) in the scoop neck, a neck swirl, and forearm bands that follow the arms
    const ink = std('#1d2a3a', { roughness: 0.9 }), tT = canvasTex(256, 128, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); c.strokeStyle = '#1d2a3a'; c.lineWidth = 7; c.lineCap = 'round'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(128 + s * 8, 20); c.bezierCurveTo(128 + s * 50, 0, 128 + s * 100, 20, 128 + s * 108, 70); c.bezierCurveTo(128 + s * 90, 50, 128 + s * 60, 55, 128 + s * 40, 70); c.stroke(); c.beginPath(); c.moveTo(128 + s * 20, 60); c.lineTo(128 + s * 60, 100); c.stroke(); } c.beginPath(); c.arc(128, 78, 14, 0, TAU); c.stroke(); });
    const chest = mesh(new THREE.CylinderGeometry(rAt(0.66) + 0.016, rAt(0.5) + 0.016, 0.24, 20, 1, true, -0.55, 1.1), new THREE.MeshStandardMaterial({ color: '#e6b58a', map: tT, transparent: true, roughness: 0.6 }), [0, hipY + 0.36, 0], body, { cast: false }); chest.scale.set(build, 1, zs * 1.0); chest.userData.noClip = true;
    for (const s of [-1, 1]) { const nk = mesh(new THREE.TorusGeometry(0.038, 0.007, 6, 14, Math.PI * 1.4), ink, [s * 0.012, hipY + 0.478, 0.0], body, { rot: [Math.PI / 2, 0, s * 0.8], cast: false }); nk.userData.noClip = true; }
    const bands = [0, 1].map(() => [0, 1, 2].map(() => { const b = mesh(new THREE.TorusGeometry(0.036, 0.0075, 6, 14), ink, [0, 0, 0], body, { cast: false }); b.userData.noClip = true; return b; }));
    const { ph, setScr } = addPhone(body, { gold: false });
    return { update(p, t, api, H) {
      const mode = CASE(p.phoneP || 0); if (mode) setScr(['dark', 'qr', 'photo', 'live'][Math.round(p.phoneScr || 0)] || 'dark'); placePhone(ph, mode, H, false);
      for (let i = 0; i < 2; i++) { const sh = new THREE.Vector3((i ? 1 : -1) * (0.118 + 0.01 * build), 0.675 + L, 0), mid = sh.clone().lerp(H[i], 0.5); mid.y -= 0.06; mid.x += (i ? 1 : -1) * 0.03; const dir = H[i].clone().sub(mid).normalize();
        bands[i].forEach((b, k) => { b.position.copy(H[i]).addScaledVector(dir, -0.12 - k * 0.04); b.quaternion.setFromUnitVectors(V(0, 0, 1), dir); }); } } };
  };
  const p = makePerson({ decorate, name: 'daica', skin: '#e6b58a', hair: 'short', hairColor: '#0e0c10', top: '#17151d', collar: '#17151d', bottom: '#1e1b27', sleeve: 0, age: 'young', build, stand: false, shoe: '#f2f0ea', color: '#ffc43a', seed: 133, brow: 0.2, hem: false });
  Object.assign(p.poses, {
    show: { l: [-0.22, 0.45, 0.2, 0], r: [0.2, 0.78, 0.5, 0], phoneP: 3 },
    hold: { l: [0.1, 1.08, 0.4, 0], r: [0.4, 1.1, 0.32, 0] },   // both hands on the steering wheel of the tow truck
    ski: { l: [-0.3, 0.59, 0.6, 0], r: [0.3, 0.59, 0.6, 0] },
    cross: { l: [0.14, 0.52, 0.28, 0], r: [-0.14, 0.58, 0.3, 0] },
  });
  return p;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// the two police officers (standing). cong1 holds a phone showing LIVE (pose `live`), cong2 is a bit bigger.
// ---------------------------------------------------------------------------------------------------------------------------------
export function makeCop(n = 1) {
  const L = 0.36, build = n === 1 ? 1.0 : 1.12, zs = 0.82 * lerp(1, build, 0.5);
  const decorate = ({ body, head, hipY }) => {
    const navy = std('#1d2748', { roughness: 0.7 }), band = std('#f3f4f2', { roughness: 0.6 }), gold = new THREE.MeshStandardMaterial({ color: '#ffc43a', roughness: 0.3, metalness: 0.8 });
    const cap = new THREE.Group(); cap.position.set(0, 0.105, -0.004); head.add(cap); mesh(new THREE.CylinderGeometry(0.168, 0.176, 0.085, 22), navy, [0, 0.045, 0], cap); mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 22), band, [0, -0.002, 0], cap, { cast: false });
    mesh(new THREE.CylinderGeometry(0.176, 0.176, 0.016, 22), navy, [0, 0.09, 0], cap, { cast: false }); mesh(new THREE.BoxGeometry(0.2, 0.012, 0.09), std('#10131c', { roughness: 0.4 }), [0, -0.01, 0.2], cap, { rot: [0.18, 0, 0], cast: false });
    mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.01, 6), gold, [0, 0.04, 0.178], cap, { rot: [Math.PI / 2, 0, 0], cast: false });   // the badge
    for (const s of [-1, 1]) { const ep = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.09), navy, [s * 0.12, hipY + 0.436 + L * 0 + 0.0, 0.0], body, { cast: false }); ep.userData.noClip = true; }
    const { ph, setScr } = addPhone(body, { gold: false });
    return { update(p, t, api, H) { const mode = CASE(p.phoneP || 0); if (mode) setScr(['dark', 'qr', 'photo', 'live'][Math.round(p.phoneScr || 0)] || 'dark'); placePhone(ph, mode, H, false); } };
  };
  const p = makePerson({ decorate, name: 'cong' + n, skin: n === 1 ? '#e8b896' : '#d9a37c', hair: 'short', hairColor: '#17110f', top: '#8ec0ea', collar: '#8ec0ea', tie: '#1d2748', bottom: '#1d2748', age: 'young', build, stand: true, lift: L, shoe: '#101018', color: '#3a6ea8', seed: 150 + n, brow: 0.1 });
  Object.assign(p.poses, {
    live: { l: [-0.21, L + 0.4, 0.03, 0], r: [0.24, L + 0.95, 0.4, 0], phoneP: 3, phoneScr: 3 },
    run: { l: [-0.21, L + 0.38, 0.1, 0], r: [0.21, L + 0.38, 0.1, 0] },
    wet: { l: [-0.21, L + 0.36, 0.02, 0], r: [0.21, L + 0.36, 0.02, 0] },
  });
  return p;
}
export const SEA_CHARS = { linh: () => makeLinh(false), linhs: () => makeLinh(true), daica: makeDaica, cong1: () => makeCop(1), cong2: () => makeCop(2) };
