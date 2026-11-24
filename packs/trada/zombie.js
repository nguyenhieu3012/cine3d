// Trà đá với AI, Zombie special (13/11): zombies built on makePerson (same toy build as the supporting cast), plus a cheap horde.
// Law of the special (the owner 13/11): a zombie is ALWAYS frightening, never comic; "Zombie làm chuẩn hình zombie nha": rotting blotched grey-green skin with veins and patches of
// darker exposed flesh, a dried bite mark, sunken sockets with small clouded pupils (one eye bigger), a crooked hanging jaw with yellowed teeth and a dark stain from the mouth,
// hollow cheeks, hair missing in patches, one ear off; hunched, head hanging to one side, one shoulder dropped, clawed hands reaching, one leg dragging; clothes torn with holes
// showing skin, dirt and dark stains. Wounds are dried dark red-brown, cartoon-safe (TikTok / YouTube): no bright gore.
//   makeZombie(kind, opts)  kind: guard · shipper (cracked helmet + parcel held out) · landlord (ledger) · friend (very long receipt trailing) · granny (bun half undone + Bà's floral set) · plain
//   makeVictim(opts)        a person (default: anh khách standing) who TURNS: fx turn 0..1 blends skin, face, hunch and claws into the zombie's
//   makeHorde(opts)         { n, seed, width, depth, pileAt: [x, z] (world) }: cheap clones (shared geometry, rigid limbs), deterministic phase offsets
// Numbers (acts fx) on a zombie: lurch / walk (gait), sniff 0..1, neck (rad, head turned on the neck; a fast ramp gives the neck-crack kick), lunge 0..1, bite 0..1, turn (victim).
// Poses: rest (arms reaching low) reach claw grab box ledger receipt qr phoneUp down. On the horde: lurch, heads (rad, all heads turn together), pile 0..1.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, smooth, hash, fbm1, noise1, canvasTex, std, mesh, ball, cyl, lathe, V } from '../../core/util.js';
import { facePatch, onHead, GAIT_KEYS, jerk } from '../../core/rig.js';
import { makePerson, personPoses } from './people.js';
import { TEO_FACE } from './chars.js';

export const ZSKIN = '#8fa08c';
const INK = '#14101c', SCAB = '#4a1f1d', FLESH = '#6a3434', FLESH_D = '#3b1a1e';
const blob = (c, x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); };
// an irregular patch of darker exposed flesh (no gore): dark red-brown with a darker rim
function fleshPatch(c, x, y, r, seed, k = 1) {
  c.save(); c.globalAlpha *= k; c.beginPath(); for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, rr = r * (0.6 + 0.55 * hash(seed + i * 3.3)); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } c.closePath();
  c.fillStyle = FLESH; c.fill(); c.lineWidth = Math.max(2, r * 0.18); c.strokeStyle = 'rgba(40,30,30,0.75)'; c.stroke();
  c.fillStyle = FLESH_D; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x + (hash(seed * 3 + i) - 0.5) * r, y + (hash(seed * 7 + i) - 0.5) * r * 0.7, r * 0.18, r * 0.1, hash(i) * 3, 0, 7); c.fill(); }
  c.restore();
}
// a dried bite mark: two arcs of tooth dents inside a bruise
function biteMark(c, x, y, r, rot = 0, k = 1) {
  c.save(); c.globalAlpha *= k; c.translate(x, y); c.rotate(rot); blob(c, 0, 0, r * 1.6, 'rgba(70,40,62,A)', 0.55);
  c.fillStyle = SCAB; for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + 0.7 * i / 5); c.beginPath(); c.ellipse(Math.cos(a) * r, s * (Math.sin(a) * r * 0.55 + r * 0.12), r * 0.13, r * 0.09, a, 0, 7); c.fill(); }
  c.restore();
}
// the rotting skin (head sphere, neck, hands; also the horde): k = strength (0 = plain skin of colour col)
export function zombieSkin(seed = 1) {
  return (c, w, h, k = 1, col = ZSKIN) => {
    c.globalAlpha = 1; c.fillStyle = col; c.fillRect(0, 0, w, h); if (k <= 0) return; c.globalAlpha = k;
    for (let i = 0; i < 16; i++) { const x = hash(seed * 5 + i) * w, y = hash(seed * 9 + i * 2) * h, r = 14 + 34 * hash(seed + i * 7); blob(c, x, y, r, ['rgba(48,66,52,A)', 'rgba(96,88,52,A)', 'rgba(44,52,66,A)'][i % 3], 0.5); }
    c.strokeStyle = 'rgba(58,40,80,0.55)'; c.lineWidth = 1.6; for (let i = 0; i < 9; i++) { let x = hash(seed * 13 + i) * w, y = hash(seed * 17 + i) * h; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (hash(seed + i * 9 + j) - 0.5) * 26; y += 6 + 10 * hash(seed * 3 + i + j * 5); c.lineTo(x, y); } c.stroke(); }
    fleshPatch(c, w * (0.2 + 0.6 * hash(seed * 41)), h * (0.25 + 0.5 * hash(seed * 43)), 14, seed * 11);
    biteMark(c, w * (0.15 + 0.7 * hash(seed * 47)), h * (0.3 + 0.4 * hash(seed * 53)), 12, hash(seed) * 3);
    c.globalAlpha = 1;
  };
}

// ---------- the face (drawn on the person's second face patch) ----------
export function drawZombieFace(c, f, talk, t, { S, px, py, EY, EP, p = {}, seed = 1 }) {
  const cx = S / 2, ex = EY * px, ey = S / 2 - EP * py, R = (k) => hash(seed * 17.3 + k * 3.7); c.clearRect(0, 0, S, S); c.lineCap = 'round'; c.lineJoin = 'round';
  // rot: blotches, veins, an exposed patch on the forehead side, a dried bite mark on the far cheek
  for (let i = 0; i < 9; i++) { const x = cx + (R(i) - 0.5) * 330, y = ey + (R(i + 20) - 0.35) * 280, r = 28 + 42 * R(i + 40); blob(c, x, y, r, ['rgba(46,64,52,A)', 'rgba(92,84,48,A)', 'rgba(40,48,62,A)'][i % 3], 0.38); }
  for (const s of [-1, 1]) blob(c, cx + s * 100, ey + 96, 70, 'rgba(24,32,32,A)', 0.62);   // hollow cheeks
  blob(c, cx, ey - 40, 150, 'rgba(26,34,34,A)', 0.22);                                          // a heavy, shadowed brow
  c.strokeStyle = 'rgba(62,36,82,0.6)'; c.lineWidth = 3.6;
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { let x = cx + s * (156 - i * 6), y = ey - 74 + i * 34; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x -= s * (12 + 10 * R(i * 9 + k + s)); y += (R(i + k * 7 + s * 3) - 0.4) * 28; c.lineTo(x, y); } c.stroke(); }
  const side = R(5) > 0.5 ? 1 : -1;
  fleshPatch(c, cx - side * 118, ey - 92 + 20 * R(6), 30, seed * 7);
  biteMark(c, cx + side * 128, ey + 118, 22, side * 0.5);
  // deep sockets, small pale clouded pupils, one eye bigger and whiter
  for (const s of [-1, 1]) { const x = cx + s * ex; blob(c, x, ey + 4, 70, 'rgba(10,14,16,A)', 0.97); }
  const look = (f?.px || 0) * 6;
  for (const s of [-1, 1]) { const x = cx + s * ex, big = s === side ? 1.18 : 0.9, rx = 22 * big, ry = 17 * big, dy = s === side ? 4 : 0;
    c.fillStyle = s === side ? '#eef1e4' : '#d9dcc8'; c.beginPath(); c.ellipse(x, ey + 4 + dy, rx, ry, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(150,60,60,0.45)'; c.lineWidth = 1.6; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + s * rx * 0.95, ey + 4 + dy + (k - 1) * 5); c.lineTo(x + s * rx * 0.45, ey + 4 + dy + (k - 1) * 8 + 2); c.stroke(); }
    const pr = 6.5 * big; blob(c, x + look, ey + 5 + dy, pr * 2.1, 'rgba(225,232,232,A)', 0.9); c.fillStyle = '#aebac0'; c.beginPath(); c.arc(x + look, ey + 5 + dy, pr, 0, 7); c.fill(); c.fillStyle = 'rgba(70,82,88,0.8)'; c.beginPath(); c.arc(x + look, ey + 5 + dy, 1.8, 0, 7); c.fill();
    c.strokeStyle = INK; c.lineWidth = 10; c.beginPath(); c.moveTo(x - s * rx - s * 4, ey - ry + 14 + dy); c.quadraticCurveTo(x, ey - ry - 4 + dy, x + s * rx + s * 6, ey - ry + 8 + dy); c.stroke();   // heavy lid, low on the inside
    c.lineWidth = 5; c.strokeStyle = 'rgba(16,20,20,0.85)'; c.beginPath(); c.ellipse(x, ey + 4 + dy, rx, ry, 0, 0.2, Math.PI - 0.2); c.stroke();
    c.strokeStyle = '#17121c'; c.lineWidth = 19; c.beginPath(); c.moveTo(x - s * 34, ey - 46); c.quadraticCurveTo(x + s * 2, ey - 64, x + s * 42, ey - 70 + (s === side ? 6 : 0)); c.stroke();
  }
  // collapsed nose
  blob(c, cx, ey + 70, 26, 'rgba(24,30,30,A)', 0.5); c.fillStyle = 'rgba(22,26,26,0.9)'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 9, ey + 76, 5, 9, s * 0.4, 0, 7); c.fill(); }
  // the jaw hangs open, crooked, yellowed uneven teeth; a dark stain runs from the low corner
  const op = clamp(0.5 + 0.55 * talk + 0.9 * (p._biteOpen ?? p.bite ?? 0) + 0.5 * (p.lunge || 0) + 0.35 * (p.charge || 0) + 0.06 * Math.sin(t * 2.3 + seed)), my = S / 2 + 20 * py, w = 36 + 8 * op, h = 26 + 62 * op, tilt = side * (0.13 + 0.06 * R(9));
  c.save(); c.translate(cx + side * 8, my); c.rotate(tilt);
  blob(c, 0, h * 0.5, w * 2.2, 'rgba(22,28,28,A)', 0.5);
  c.fillStyle = '#0c0609'; c.strokeStyle = '#3a2634'; c.lineWidth = 7;
  c.beginPath(); c.moveTo(-w, 6); c.quadraticCurveTo(-w * 0.5, -12, 0, -9); c.quadraticCurveTo(w * 0.6, -13, w * 1.05, 10); c.quadraticCurveTo(w * 1.0, h * 0.9, w * 0.2, h + 8); c.quadraticCurveTo(-w * 0.8, h * 1.02, -w, 6); c.closePath(); c.fill(); c.stroke();
  c.save(); c.clip(); c.fillStyle = '#5a262c'; c.fillRect(-w * 1.2, -16, w * 2.4, 12); c.fillRect(-w * 1.2, h - 6, w * 2.4, 22);   // gums
  const tooth = (x, y, tw, th, dn) => { c.fillStyle = '#d6c47e'; c.strokeStyle = 'rgba(90,70,30,0.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - tw / 2, y); c.lineTo(x + tw / 2, y); c.lineTo(x + tw * 0.25, y + dn * th); c.lineTo(x - tw * 0.3, y + dn * th * 0.85); c.closePath(); c.fill(); c.stroke(); };
  for (let i = 0; i < 7; i++) { if (R(30 + i) > 0.82) continue; tooth(-w * 0.85 + i * w * 0.28, -9, 11 + 5 * R(i), 12 + 12 * R(i + 50), 1); }
  for (let i = 0; i < 6; i++) { if (R(60 + i) > 0.8) continue; tooth(-w * 0.7 + i * w * 0.28, h + 8, 10 + 4 * R(i + 70), 10 + 10 * R(i + 80), -1); }
  c.restore();
  c.fillStyle = 'rgba(58,26,26,0.78)'; const sx = side * w * 0.95; c.beginPath(); c.moveTo(sx - 7, 14); c.quadraticCurveTo(sx - 9, 60, sx - 3, 104); c.quadraticCurveTo(sx + 3, 112, sx + 6, 102); c.quadraticCurveTo(sx + 9, 58, sx + 7, 14); c.closePath(); c.fill(); c.beginPath(); c.ellipse(sx + 1, 122, 5, 7, 0, 0, 7); c.fill();
  c.restore();
}

// ---------- torn, filthy clothes: dirt, dark dried stains, holes that show grey skin ----------
export const grime = (seed = 1, soft = false) => (c, w, h) => {
  const a = soft ? 0.55 : 1;
  for (let i = 0; i < 16; i++) { const x = hash(seed * 13 + i) * w, y = hash(seed * 17 + i * 3) * h, r = 10 + 34 * hash(seed + i * 7); blob(c, x, y, r, 'rgba(46,42,28,A)', 0.48 * a); }
  for (let i = 0; i < 4; i++) { const x = hash(seed * 19 + i) * w, y = hash(seed * 23 + i) * h * 0.7, r = 8 + 10 * hash(seed + i); c.fillStyle = `rgba(66,26,24,${0.62 * a})`; c.beginPath(); c.ellipse(x, y, r, r * 0.8, 0, 0, 7); c.fill(); c.fillRect(x - 2.5, y, 5, r * 2.6 * hash(seed + i * 3) + 6); }   // dried drips
  if (!soft) for (let i = 0; i < 4; i++) { const x = hash(seed * 29 + i) * w, y = hash(seed * 31 + i) * h, s = 13 + 15 * hash(seed + i); c.beginPath(); for (let k = 0; k < 10; k++) { const an = (k / 10) * Math.PI * 2, rr = s * (0.45 + 0.6 * hash(seed + i * 9 + k)); c.lineTo(x + Math.sin(an) * rr * 0.65, y - Math.cos(an) * rr); } c.closePath(); c.fillStyle = ZSKIN; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(28,26,22,0.9)'; c.stroke(); blob(c, x, y, s * 0.6, 'rgba(48,66,52,A)', 0.5); }
  c.strokeStyle = 'rgba(30,30,26,0.55)'; c.lineWidth = 2; for (let i = 0; i < 12; i++) { const x = hash(seed * 41 + i) * w, y = hash(seed * 43 + i) * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 10, y + 14); c.stroke(); }
};

// ---------- props ----------
function boxProp() { const g = new THREE.Group(); const card = std('#b98a55', { roughness: 0.95 }); mesh(new RoundedBoxGeometry(0.3, 0.22, 0.24, 2, 0.01), card, [0, 0, 0], g); mesh(new THREE.BoxGeometry(0.302, 0.05, 0.242), std('#d8c79a', { roughness: 0.6 }), [0, 0.06, 0], g, { cast: false });
  const lab = canvasTex(128, 96, (c) => { c.fillStyle = '#f2efe6'; c.fillRect(0, 0, 128, 96); c.fillStyle = '#222'; c.font = '900 30px sans-serif'; c.fillText('COD', 30, 44); for (let i = 0; i < 18; i++) c.fillRect(14 + i * 5.6, 60, hash(i) > 0.5 ? 3 : 1.6, 24); });
  mesh(new THREE.PlaneGeometry(0.12, 0.09), std('#ffffff', { map: lab, roughness: 0.8 }), [0.04, -0.03, 0.1205], g, { cast: false }); return g; }
function ledgerProp() { const g = new THREE.Group(); const cov = std('#5b2a2a', { roughness: 0.8 }), pg = canvasTex(128, 160, (c) => { c.fillStyle = '#efe6cf'; c.fillRect(0, 0, 128, 160); c.strokeStyle = 'rgba(80,90,140,0.6)'; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(6, 16 + i * 12); c.lineTo(122, 16 + i * 12); c.stroke(); } c.fillStyle = '#3a2f4a'; c.font = '700 11px sans-serif'; for (let i = 0; i < 10; i++) c.fillText(['P.204', '3.500.000', 'NỢ', 'P.102', 'ĐIỆN', 'NƯỚC', '2.800.000', 'P.301', 'NỢ', 'NỢ'][i], 10 + (i % 2) * 60, 26 + Math.floor(i / 2) * 24); c.strokeStyle = '#b02a2a'; c.lineWidth = 3; c.beginPath(); c.arc(92, 120, 20, 0, 7); c.stroke(); });
  for (const s of [-1, 1]) { const half = new THREE.Group(); half.rotation.y = -s * 0.32; g.add(half); mesh(new THREE.BoxGeometry(0.13, 0.17, 0.008), cov, [s * 0.066, 0, -0.004], half); mesh(new THREE.PlaneGeometry(0.122, 0.162), std('#ffffff', { map: pg, roughness: 0.9 }), [s * 0.066, 0, 0.0005], half, { cast: false }); } return g; }
function qrTex(seed = 3) { return canvasTex(192, 256, (c) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, 192, 256); c.fillStyle = '#1d5bd6'; c.fillRect(0, 0, 192, 40); c.fillStyle = '#fff'; c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.fillText('QUÉT MÃ', 96, 28);
  const x0 = 26, y0 = 62, n = 23, s = 140 / n; c.fillStyle = '#111'; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (hash(seed * 101 + i * 31 + j * 7) > 0.52) c.fillRect(x0 + i * s, y0 + j * s, s + 0.4, s + 0.4);
  for (const [a, b] of [[0, 0], [n - 7, 0], [0, n - 7]]) { c.fillStyle = '#fff'; c.fillRect(x0 + a * s - s, y0 + b * s - s, 9 * s, 9 * s); c.fillStyle = '#111'; c.fillRect(x0 + a * s, y0 + b * s, 7 * s, 7 * s); c.fillStyle = '#fff'; c.fillRect(x0 + (a + 1) * s, y0 + (b + 1) * s, 5 * s, 5 * s); c.fillStyle = '#111'; c.fillRect(x0 + (a + 2) * s, y0 + (b + 2) * s, 3 * s, 3 * s); }
  c.fillStyle = '#333'; c.font = '700 15px sans-serif'; c.fillText('TRẢ… TIỀN…', 96, 236); }); }
function qrProp() { const g = new THREE.Group(); mesh(new RoundedBoxGeometry(0.17, 0.225, 0.012, 2, 0.008), std('#e8ecf2', { roughness: 0.3 }), [0, 0, 0], g); mesh(new THREE.PlaneGeometry(0.15, 0.2), new THREE.MeshStandardMaterial({ map: qrTex(), roughness: 0.6, emissive: '#ffffff', emissiveMap: qrTex(), emissiveIntensity: 0.18 }), [0, 0, 0.0065], g, { cast: false }); mesh(new THREE.BoxGeometry(0.12, 0.02, 0.05), std('#cfd5de', { roughness: 0.3 }), [0, -0.12, 0], g); return g; }
export function phoneScreen(kind) { return canvasTex(128, 256, (c) => { if (kind === 'x') { c.fillStyle = '#16181f'; c.fillRect(0, 0, 128, 256); c.strokeStyle = '#ff2b2b'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(30, 88); c.lineTo(98, 156); c.moveTo(98, 88); c.lineTo(30, 156); c.stroke(); }
  else if (kind === 'qr') { c.drawImage(qrTex(5).image, 0, 0, 128, 256); } else { c.fillStyle = '#dfe6f2'; c.fillRect(0, 0, 128, 256); } }); }
function phoneProp(kind = 'x') { const g = new THREE.Group(); mesh(new RoundedBoxGeometry(0.08, 0.16, 0.01, 3, 0.008), std('#15151b', { roughness: 0.3, metalness: 0.4 }), [0, 0, 0], g); mesh(new THREE.PlaneGeometry(0.07, 0.146), new THREE.MeshBasicMaterial({ map: phoneScreen(kind), toneMapped: false, color: new THREE.Color(1.2, 1.2, 1.2) }), [0, 0, 0.0056], g, { cast: false, recv: false }); return g; }
function receiptTex() { return canvasTex(64, 1024, (c, w, h) => { c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(40,40,50,0.7)'; for (let y = 10; y < h; y += 12) { const n = 3 + Math.floor(hash(y) * 4); for (let k = 0; k < n; k++) c.fillRect(5 + k * 13, y, 6 + 5 * hash(y + k), 3); } c.fillStyle = 'rgba(80,70,60,0.18)'; for (let i = 0; i < 30; i++) c.fillRect(0, hash(i * 7) * h, w, 2 + 6 * hash(i)); }, { repeat: [1, 1] }); }

// ---------- kinds ----------
const KINDS = {
  guard: { top: '#3c4964', bottom: '#242a3a', hair: 'none', hairColor: '#1c1a22', collar: '#2c3650', build: 1.1, shoe: '#25222a', seed: 31 },
  shipper: { top: '#4a5a3c', bottom: '#2a2a30', hair: 'none', hairColor: '#1f1a20', collar: '#3a4730', build: 1.0, shoe: '#2b2a2e', seed: 37 },
  landlord: { top: '#e2dccd', bottom: '#4a4038', hair: 'short', hairColor: '#6d6a72', sleeve: 0.16, age: 'old', glasses: '#2a2830', build: 1.14, collar: '#e2dccd', shoe: '#3a3330', seed: 41 },
  friend: { top: '#b4433e', pattern: 'check', bottom: '#2e3446', hair: 'short', hairColor: '#221c22', collar: '#a83a36', build: 1.04, shoe: '#2a2a30', seed: 43 },
  granny: { top: '#f2709f', pattern: 'floral', bottom: '#f2709f', bottomPattern: 'floral', hair: 'bun', hairColor: '#9a98a6', age: 'old', build: 1.06, lift: 0.34, sleeve: 0.5, legFrac: 0.68, shoe: '#e9ddc6', collar: '#fff2f6', hem: false, seed: 11 },
  plain: { top: '#787c86', bottom: '#30343e', hair: 'short', hairColor: '#201c24', build: 1.0, shoe: '#2a2a30', seed: 47 },
};
const KIND_POSE = { shipper: 'box', landlord: 'ledger', friend: 'receipt' };
const helmetTex = (seed) => canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#d6a92c'; c.fillRect(0, 0, w, h); blob(c, w * 0.3, h * 0.5, 60, 'rgba(60,50,30,A)', 0.45); c.strokeStyle = '#1e160c'; c.lineWidth = 7; c.lineJoin = 'miter';
  for (const [x0, y0] of [[w * 0.2, 60], [w * 0.28, 70], [w * 0.7, 64]]) { let x = x0, y = y0; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (hash(seed + k + x0) - 0.5) * 30; y += 12 + 8 * hash(seed * 3 + k); c.lineTo(x, y); } c.stroke(); }
  c.fillStyle = '#1e1810'; c.beginPath(); c.moveTo(w * 0.2, h); c.lineTo(w * 0.22, h * 0.72); c.lineTo(w * 0.27, h * 0.82); c.lineTo(w * 0.31, h * 0.66); c.lineTo(w * 0.34, h); c.closePath(); c.fill(); });

export function zombiePoses(L) {
  const P = personPoses(L, true);
  const z = {
    rest: { l: [-0.14, L + 0.6, 0.4], r: [0.18, L + 0.52, 0.34] }, down: { l: [-0.22, L + 0.4, 0.06], r: [0.22, L + 0.39, 0.06] },
    reach: { l: [-0.13, L + 0.76, 0.46], r: [0.14, L + 0.72, 0.48] }, claw: { l: [-0.21, L + 0.95, 0.4], r: [0.21, L + 0.99, 0.38] }, grab: { l: [-0.17, L + 0.72, 0.42], r: [0.17, L + 0.73, 0.42] },
    box: { l: [-0.14, L + 0.6, 0.33], r: [0.14, L + 0.6, 0.33], box: 1 }, ledger: { l: [-0.1, L + 0.7, 0.34], r: [0.2, L + 0.5, 0.16], ledger: 1 },
    receipt: { l: [-0.2, L + 0.5, 0.18], r: [0.16, L + 0.64, 0.36], receipt: 1 }, qr: { l: [-0.2, L + 0.5, 0.18], r: [0.06, L + 0.82, 0.5], qr: 1 }, phoneUp: { l: [-0.2, L + 0.5, 0.18], r: [0.07, L + 0.86, 0.42], phoneUp: 1 },
  };
  return { ...P, ...z };
}

// the zombie life added on top of the person: hunch, lolling head, sniff, neck snap with its crack, bite, props
function zombieDeco(kind, { seed = 1, phone = 'x', tatters = true } = {}) {
  return ({ root, rig, body, head, R, L, hipY, topM, trim }) => {
    // torn hem: cloth tatters hanging below the shirt
    const tat = new THREE.ConeGeometry(0.03, 0.07, 4); const tats = [];
    if (tatters && kind !== 'granny') for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + hash(seed + i), m = mesh(tat, topM, [Math.sin(a) * 0.148, L + 0.21 - 0.02 * hash(seed * 3 + i), Math.cos(a) * 0.12], body, { rot: [Math.PI + 0.25 * Math.cos(a), 0, -0.25 * Math.sin(a)], scale: [1, 0.7 + 0.8 * hash(seed + i * 5), 0.5] }); tats.push(m); }
    // kind props on the body
    if (kind === 'guard') { const cap = std('#26304a', { roughness: 0.7 }); mesh(new THREE.SphereGeometry(R * 1.045, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), cap, [0, 0.012, -0.012], head, { rot: [-0.22, 0, 0] }); mesh(new THREE.CylinderGeometry(R * 1.12, R * 1.1, 0.05, 32), cap, [0, 0.105, -0.02], head, { rot: [-0.22, 0, 0] }); mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24, 1, false, -Math.PI / 2, Math.PI), cap, [0, 0.07, 0.125], head, { rot: [0.32, 0, 0] }); mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 16), std('#d8b444', { roughness: 0.4, metalness: 0.5 }), [0, 0.105, 0.172], head, { rot: [Math.PI / 2 - 0.25, 0, 0] });
      const gold = std('#d8b444', { roughness: 0.4, metalness: 0.5 }); for (const s of [-1, 1]) mesh(new RoundedBoxGeometry(0.07, 0.014, 0.04, 2, 0.005), gold, [s * 0.12, L + 0.69, 0.0], body); mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 16), gold, [0.07, L + 0.6, 0.128], body, { rot: [Math.PI / 2 - 0.2, 0, 0] }); }
    if (kind === 'shipper') { const hm = std('#d6a92c', { roughness: 0.35 }); mesh(new THREE.SphereGeometry(R * 1.13, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.36), hm, [0, 0.03, -0.02], head, { rot: [-0.4, 0, 0.12] }); mesh(new THREE.TorusGeometry(R * 0.93, 0.012, 8, 40), std('#2a2a2e', { roughness: 0.5 }), [0, 0.112, -0.03], head, { rot: [Math.PI / 2 - 0.4, 0, 0.12] }); for (const sx of [-1, 1]) cyl(0.004, 0.004, 0.17, std('#2a2a2e'), [sx * 0.17, -0.06, 0.0], head, { rot: [0, 0, sx * 0.12] }, 6); }
    // clawed hands: four curled fingers with dark broken nails on each hand (scaled in by the turn on the victim)
    const fingerG = new THREE.CylinderGeometry(0.0085, 0.011, 0.05, 6); fingerG.translate(0, 0.025, 0); const nailG = new THREE.ConeGeometry(0.0085, 0.022, 5); const skinMat = head.children[0]?.material || std(ZSKIN), nailM = std('#3a3226', { roughness: 0.6 });
    const claws = [0, 1].map(() => { const g = new THREE.Group(); body.add(g); for (let k = 0; k < 4; k++) { const f = new THREE.Group(); f.position.set((k - 1.5) * 0.019, 0.006 * Math.abs(k - 1.5), 0.026); f.rotation.set(1.1 + 0.15 * hash(seed + k), (k - 1.5) * 0.12, 0); g.add(f); mesh(fingerG, skinMat, [0, 0, 0], f, {}); const tip = new THREE.Group(); tip.position.y = 0.05; tip.rotation.x = 0.9; f.add(tip); mesh(fingerG, skinMat, [0, 0, 0], tip, { scale: [0.85, 0.6, 0.85] }); mesh(nailG, nailM, [0, 0.036, 0.002], tip, { cast: false }); } return g; });
    // hair missing in patches and messy tufts (short hair), one ear hanging lower
    if (kind !== 'guard' && kind !== 'shipper' && kind !== 'granny' && kind !== 'victim') { const hairM = head.children.find((m) => m.material?.sheen === 0.15)?.material || std('#1c1a22');
      for (let i = 0; i < 2; i++) { const a = (hash(seed * 3 + i) - 0.5) * 1.6, P = onHead(R, a * 57, 34 + 14 * i, 1.06); mesh(new THREE.SphereGeometry(1, 16, 10), skinMat, [P.x, P.y, P.z], head, { scale: [0.05, 0.026, 0.045], rot: [0.5, a, 0] }); }
      for (let i = 0; i < 5; i++) { const a = (hash(seed * 5 + i) - 0.5) * 2.4, P = onHead(R, a * 57, 40 + 10 * hash(i), 1.05); const m = mesh(new THREE.ConeGeometry(0.012, 0.06, 5), hairM, [P.x, P.y, P.z], head, { cast: false }); m.quaternion.setFromUnitVectors(V(0, 1, 0), P.clone().normalize().add(V((hash(i) - 0.5) * 0.8, 0, 0)).normalize()); } }
    if (kind !== 'victim') for (const m of head.children) if (m.isMesh && m.geometry?.parameters?.radius === 0.036 && m.position.x * (hash(seed) > 0.5 ? 1 : -1) > 0) { m.position.y -= 0.025; m.rotation.z = 0.5 * Math.sign(m.position.x); }
    if (kind === 'shipper') for (const m of head.children) if (m.isMesh && m.material?.color?.getHexString?.() === 'd6a92c') { m.material = std('#ffffff', { map: helmetTex(seed), roughness: 0.4 }); }
    if (kind === 'granny') { const hm = head.children.find((m) => m.isMesh && m.geometry?.type === 'TorusGeometry')?.material || std('#9a98a6');   // the bun half undone: loose hanks down one side
      const sideB = hash(seed) > 0.5 ? 1 : -1; for (let i = 0; i < 5; i++) { const cv = new THREE.QuadraticBezierCurve3(V(sideB * 0.03 * i, 0.17, -0.1), V(sideB * (0.12 + 0.02 * i), 0.12 - 0.02 * i, -0.13), V(sideB * (0.15 + 0.012 * i), -0.08 - 0.05 * hash(i + seed), -0.05 - 0.02 * i)); mesh(new THREE.TubeGeometry(cv, 12, 0.012 - 0.0012 * i, 6), hm, [0, 0, 0], head, {}); }
      for (const m of head.children) if (m.isMesh && m.geometry?.type === 'TorusGeometry') { m.rotation.z += 0.5; m.position.x += 0.02 * sideB; m.position.y -= 0.02; } }
    const box = kind === 'shipper' ? boxProp() : null, ledger = kind === 'landlord' ? ledgerProp() : null, qr = qrProp(), ph = phoneProp(phone);
    for (const o of [box, ledger, qr, ph]) if (o) { body.add(o); o.visible = false; }
    // the receipt: a long paper ribbon from the hand down to the ground and trailing behind (root frame, rebuilt every frame)
    let rec = null; if (kind === 'friend') { const g = new THREE.PlaneGeometry(0.1, 1, 1, 64); rec = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: receiptTex(), roughness: 0.9, side: THREE.DoubleSide })); rec.castShadow = true; rec.receiveShadow = true; rec.userData.noOutline = true; root.add(rec); rec.visible = false; }
    const hw = V(), P = V(), _hw = V(), N = 65;
    return {
      update(p, t, api, H) {
        const zc = clamp(p._z ?? 1); claws.forEach((g, i) => { g.visible = zc > 0.02; if (!g.visible) return; g.position.copy(H[i]); const sh = V((i ? 1 : -1) * 0.13, L + 0.675, 0), d = H[i].clone().sub(sh).normalize(); g.quaternion.setFromUnitVectors(V(0, 0, 1), d); g.rotateZ((i ? -1 : 1) * 0.3); g.scale.setScalar(zc * (1 + 0.15 * Math.sin(t * 1.7 + i * 2) * 0.3)); });
        // head: lolling to one side, chin down; sniff = nose up with short inhales; neck = a turn on the neck with a crack when it is fast
        const zk = clamp(p._z ?? 1), loll = (0.27 + 0.06 * fbm1(t * 0.5, seed) * (1 - clamp(p.sniff || 0))) * zk * (hash(seed * 7) > 0.5 ? 1 : -1);
        const sn = clamp(p.sniff || 0), nk = p.neck || 0, dn = clamp((p.dNeck || 0) / 9, -1, 1), wd = p._wind || 0, lu = p._lun || 0, shk = p._shake || 0, chg = clamp(p.charge || 0);
        // bite: rears back (wind), snaps forward and down onto the shoulder (lun), shakes while clamped; charge: the head jerks between angles
        head.rotation.z += loll * (1 - lu) - dn * 0.28 + 0.16 * chg * jerk(t, seed + 5, 0.27, 0.06); head.rotation.x += 0.2 * zk - sn * (0.32 + 0.05 * Math.sin(t * 14)) - 0.55 * wd + 0.5 * lu + Math.abs(dn) * 0.08 + 0.08 * chg * jerk(t, seed + 9, 0.3, 0.06);
        head.rotation.y += nk + sn * 0.08 * Math.sin(t * 3.1) + 0.3 * shk * Math.sin(t * 38) + 0.28 * chg * jerk(t, seed, 0.34, 0.06);
        head.position.z = 0.09 * lu - 0.03 * wd + sn * 0.02; head.position.y += -0.05 * lu + 0.015 * wd;
        const bx = clamp(p.box || 0), lg = clamp(p.ledger || 0), qk = clamp(p.qr || 0), pk = clamp(p.phoneUp || 0), rk = clamp(p.receipt || 0);
        if (box) { box.visible = bx > 0.5; if (box.visible) { box.position.copy(H[0]).add(H[1]).multiplyScalar(0.5).add(V(0, 0.01, 0.0)); box.rotation.set(0.1, 0, 0); } }
        if (ledger) { ledger.visible = lg > 0.5; if (ledger.visible) { ledger.position.copy(H[0]).add(V(0.05, 0.06, 0.04)); ledger.rotation.set(-0.5, 0.15, 0); } }
        qr.visible = qk > 0.5; if (qr.visible) { qr.position.copy(H[1]).add(V(-0.01, 0.1, 0.03)); qr.rotation.set(-0.08, -0.05, 0.04); }
        ph.visible = pk > 0.5; if (ph.visible) { ph.position.copy(H[1]).add(V(-0.01, 0.08, 0.035)); ph.rotation.set(-0.05, 0, 0.05 + 0.08 * Math.sin(t * 7) * clamp(p.shake || 0)); }
        if (rec) { rec.visible = rk > 0.5; if (rec.visible) { root.updateMatrixWorld(true); body.localToWorld(hw.copy(H[1]).add(V(0, -0.02, 0.03))); root.worldToLocal(hw);
          const pos = rec.geometry.attributes.position, len = 2.4; // metres of paper: about 0.9 hanging down, the rest along the ground behind
          for (let i = 0; i < N; i++) { const u = i / (N - 1), sDist = u * len, drop = Math.max(0.02, hw.y - 0.01);
            if (sDist < drop) { const k = sDist / drop; P.set(hw.x + 0.04 * Math.sin(k * 3 + t * 1.3), hw.y - sDist, hw.z + 0.12 * Math.sin(k * Math.PI) ); }
            else { const g = sDist - drop; P.set(hw.x + 0.06 * Math.sin(g * 4 + 1) + 0.02 * noise1(g * 3 + t * 0.4, seed), 0.006 + 0.004 * Math.sin(g * 9), hw.z - g * 0.98); }
            const half = 0.05; pos.setXYZ(i * 2, P.x - half, P.y, P.z); pos.setXYZ(i * 2 + 1, P.x + half, P.y, P.z); }
          // PlaneGeometry(1 x 64) rows go top -> bottom; we wrote them in that order, so the paper starts at the hand
          pos.needsUpdate = true; rec.geometry.computeVertexNormals(); rec.geometry.computeBoundingSphere(); } }
      },
    };
  };
}

// a full zombie (a cast member). opts: { kind, phone: 'x' | 'qr' | 'plain', seed }
export function makeZombie(kind = 'plain', opts = {}) {
  const K = { ...(KINDS[kind] || KINDS.plain), ...(opts.look || {}) }, seed = opts.seed ?? K.seed;
  const z = makePerson({ name: opts.name || 'z' + kind, skin: ZSKIN, ...K, stand: true, color: '#a9e5a0', seed, clothFx: grime(seed, kind === 'granny'), alt: { skin: ZSKIN, draw: drawZombieFace, sheen: 0.12, glow: 0.14, skinTex: zombieSkin(seed) }, turnDef: 1,
    decorate: zombieDeco(kind, { seed, phone: opts.phone || (kind === 'friend' ? 'x' : 'plain') }) });
  zombieLife(z, kind);
  return z;
}
// hunch + default pose for every zombie, through a thin wrapper of apply (the person's own code stays untouched)
function zombieLife(z, kind) {
  const L = z.headY - 0.955; z.poses = zombiePoses(L); if (KIND_POSE[kind]) z.poses.rest = z.poses[KIND_POSE[kind]];
  z.faces = { ...TEO_FACE }; z.zombie = true; z.darkFace = true;   // grey-green skin + dark sockets by design: QA's face-luma check skips it, as for Bíp's visor
  const base = z.apply.bind(z);
  const drop = (hash((z.seed ?? 3) * 1.7 + kind.length) > 0.5 ? 1 : -1) * 0.1;
  const G = z.poses.grab, mixv = (a, b, k) => a.map((v, i) => (i < 3 ? lerp(v, b[i], k) : v));
  z.apply = (p, t) => {
    // bite 0..1 (one ramp, about 1.2 s): wind-up (head rears back, jaw wide) 0-0.25 -> lunge and clamp 0.25-0.4 -> head shake while clamped 0.42-0.9 -> holds the clamp at 1
    const b = clamp(p.bite || 0), wind = smooth(b / 0.22) * (1 - smooth((b - 0.24) / 0.08)), lun = smooth((b - 0.25) / 0.13), shake = smooth((b - 0.42) / 0.05) * (1 - smooth((b - 0.86) / 0.08)), ch = clamp(p.charge || 0);
    let l = p.l, r = p.r;
    if (ch > 0) { const ph = (p.gph || 0) * Math.PI * 2; l = mixv(l, [-0.16, L + 0.84 + 0.12 * Math.sin(ph), 0.44 + 0.1 * Math.cos(ph)], ch); r = mixv(r, [0.16, L + 0.82 - 0.12 * Math.sin(ph), 0.44 - 0.1 * Math.cos(ph)], ch); }   // claws swiping forward, out of step
    if (wind > 0) { l = mixv(l, [-0.24, L + 0.78, 0.2], wind); r = mixv(r, [0.24, L + 0.8, 0.2], wind); }
    if (lun > 0) { l = mixv(l, G.l, lun); r = mixv(r, G.r, lun); }
    return base({ ...p, l, r, noPump: 1, box: (p.box || 0) * (1 - smooth((b - 0.2) / 0.08)), ledger: (p.ledger || 0) * (1 - lun), lean: (p.lean || 0) * 0.5 + 0.2 + 0.18 * clamp(p.lunge || 0) - 0.2 * wind + 0.42 * lun, lunge: Math.max(p.lunge || 0, 0.85 * lun), pitch: (p.pitch || 0) * 0.6, twist: (p.twist || 0) * 0.5, bodyRoll: drop + 0.06 * shake * Math.sin(t * 38 + 1),
      _wind: wind, _lun: lun, _shake: shake, _biteOpen: Math.max(wind * 1.1, lun * 0.55) }, t);
  };
}
// anh khách (or anyone) who is bitten and turns: fx turn 0..1 (0 = himself). Pass makePerson options to change who it is.
export function makeVictim(opts = {}) {
  const v = makePerson({ name: 'victim', skin: '#dfa982', hair: 'short', hairColor: '#241c22', top: '#7fb0e6', pattern: 'check', tie: '#d4333c', collar: '#9cc3ee', bottom: '#2f3550', age: 'young', build: 1.06, stand: true,
    shoe: '#3a302c', color: '#9ad0ff', seed: 23, ...opts, alt: { skin: ZSKIN, draw: drawZombieFace, sheen: 0.12, glow: 0.14, skinTex: zombieSkin(23) }, turnDef: 0, decorate: zombieDeco('victim', { seed: 23, tatters: false }) });
  const L = v.headY - 0.955; v.poses = { ...zombiePoses(L), rest: personPoses(L, true).rest, pockets: { l: [-0.17, L + 0.42, 0.1], r: [0.17, L + 0.42, 0.1] }, wave: { l: [-0.2, L + 0.5, 0.18], r: [0.24, L + 0.86, 0.28, 1] } };
  // the zombie hunch and head life come in with the turn
  const base = v.apply.bind(v);
  // bitten 0..1 (one ramp, about 4 s): the jolt (body arches, arms fly up) 0-0.14 -> arms go limp -> knees give 0.24-0.36 -> he drops forward with weight 0.34-0.46, a bounce
  // -> still -> twitches: a hand 0.66, a shoulder 0.74, the head snaps up 0.8 -> rises stiffly in three jerks 0.86-1. Ramp `turn` alongside (e.g. 0.4 -> 0.85 of the same span).
  v.apply = (p, t) => { const k = clamp(p.turn ?? 0); v.darkFace = k > 0.5; const b = clamp(p.bitten || 0);
    if (b <= 0) return base({ ...p, lean: (p.lean || 0) + 0.2 * k, bodyRoll: 0.1 * k, _z: k }, t);
    const j = Math.sin(Math.PI * clamp(b / 0.1)), up = smooth(b / 0.04) * (1 - smooth((b - 0.13) / 0.08)), limp = smooth((b - 0.15) / 0.08), kn = Math.pow(clamp((b - 0.24) / 0.12), 1.6), fl = Math.pow(clamp((b - 0.34) / 0.12), 2.2);
    const rise = 0.4 * smooth((b - 0.86) / 0.025) + 0.35 * smooth((b - 0.92) / 0.025) + 0.25 * smooth((b - 0.97) / 0.02), u = b - 0.46, bounce = u > 0 ? 0.035 * Math.exp(-u * 28) * Math.abs(Math.sin(u * 75)) : 0;
    const tw1 = Math.sin(Math.PI * clamp((b - 0.66) / 0.035)), tw2 = Math.sin(Math.PI * clamp((b - 0.74) / 0.035)), headUp = smooth((b - 0.8) / 0.018) * (1 - rise);
    const mix = (a, c, q) => a.map((x, i) => (i < 3 ? lerp(x, c[i], q) : x));
    let l = mix(p.l, [-0.26, L + 1.05, 0.12], up), r = mix(p.r, [0.27, L + 1.08, 0.1], up);
    const down = clamp(limp - rise); l = mix(l, [-0.21, L + 0.36, 0.08], down); r = mix(r, [0.21 + 0.05 * tw1, L + 0.36 + 0.14 * tw1, 0.08 + 0.12 * tw1], down);
    if (rise > 0) { l = mix(l, v.poses.reach.l, rise); r = mix(r, v.poses.reach.r, rise); }
    return base({ ...p, l, r, noPump: 1, lean: (p.lean || 0) + 0.2 * k - 0.32 * j * (1 - fl), bodyRoll: 0.1 * k + 0.18 * j + 0.22 * tw2, pitch: (p.pitch || 0) + 0.4 * j + 0.85 * headUp - 0.3 * limp * (1 - fl),
      kneel: Math.max(p.kneel || 0, kn * (1 - rise)), fall: Math.max(p.fall || 0, fl * (1 - rise)), fallBounce: bounce, _z: k }, t); };
  return v;
}

// =====================================================================================================================
// The horde: n cheap zombies sharing geometry and materials, rigid limbs (only transforms change per frame), one shared face canvas.
// opts: { n = 14, seed = 1, width = 2.6, depth = 2.4, pileAt: [x, z] (world point the pile lands on), pileR = 0.42 }
// fx: lurch / walk (all walk, each with its own phase and speed), heads (rad: all heads snap round together, with a crack when fast), pile 0..1 (they swarm onto pileAt and stack up).
// The camera token of the horde (ms_horde etc.) frames the leader (member 0, front centre).
// =====================================================================================================================
export function makeHorde({ n = 14, seed = 1, width = 2.6, depth = 2.4, pileAt = null, pileR = 0.42, name = 'horde' } = {}) {
  const root = new THREE.Group(); root.name = name; const body = new THREE.Group(); root.add(body);
  const L = 0.38, hipY = 0.68, R = 0.17;
  const skinM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: canvasTex(256, 256, (c, w, h) => zombieSkin(seed)(c, w, h, 1, ZSKIN), { repeat: [2, 1] }), roughness: 0.62, sheen: 0.12, sheenColor: new THREE.Color('#b8c8b8') });
  const tops = ['#3c4964', '#4a5a3c', '#787c86', '#6b3f3a', '#46566e', '#5c5046', '#2f3d3a', '#7a6a52'].map((c, i) => { const tx = canvasTex(256, 256, (cc, w, h) => { cc.fillStyle = c; cc.fillRect(0, 0, w, h); grime(seed * 10 + i)(cc, w, h); }, { repeat: [3, 2] }); return std('#ffffff', { map: tx, roughness: 0.92 }); });
  const pants = ['#242a3a', '#2a2a30', '#3a3330', '#30343e'].map((c) => std(c, { roughness: 0.92 })), shoeM = std('#2a2730', { roughness: 0.6 });
  const hairMs = ['#1c1a22', '#2a2026', '#6d6a72'].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5 }));
  const TP = [[0.001, 0.23], [0.145, 0.23], [0.158, 0.27], [0.166, 0.34], [0.172, 0.46], [0.155, 0.58], [0.128, 0.68], [0.085, 0.735], [0.04, 0.752], [0.001, 0.755]];
  const torsoG = new THREE.LatheGeometry(TP.map(([r, y]) => new THREE.Vector2(r, y - 0.3)), 28), headG = new THREE.SphereGeometry(R, 32, 22), capG = new THREE.SphereGeometry(R * 1.035, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.36);
  const limbG = new THREE.CylinderGeometry(1, 0.85, 1, 10); limbG.translate(0, -0.5, 0); const handG = new THREE.SphereGeometry(0.044, 14, 10), shoeG = new THREE.SphereGeometry(0.056, 14, 10), neckG = new THREE.CylinderGeometry(0.034, 0.036, 0.12, 10), pelG = new THREE.SphereGeometry(0.125, 18, 12), tatG = new THREE.ConeGeometry(0.03, 0.07, 4);
  const fp = facePatch(R, { rough: 0.6, size: 512 }); fp.mesh.material.emissive = new THREE.Color('#ffffff'); fp.mesh.material.emissiveMap = fp.tex; fp.mesh.material.emissiveIntensity = 0.12;
  const members = [];
  const cols = Math.max(2, Math.round(Math.sqrt(n * width / depth)));
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols, rows = Math.ceil(n / cols), h1 = hash(seed * 7 + i * 3.1), h2 = hash(seed * 11 + i * 5.7), h3 = hash(seed * 13 + i * 1.3);
    const fx0 = i === 0 ? 0 : ((c + 0.5) / cols - 0.5) * width + (h1 - 0.5) * 0.35 + (r % 2 ? 0.2 : 0), fz0 = i === 0 ? 0.25 : -(r / Math.max(1, rows - 1)) * depth + (h2 - 0.5) * 0.3;
    const g = new THREE.Group(); body.add(g); g.position.set(fx0, 0, fz0);
    const top = tops[(i + seed) % tops.length], pant = pants[(i * 3 + seed) % pants.length], bd = new THREE.Group(); bd.position.y = hipY; g.add(bd);
    const torso = mesh(torsoG, top, [0, 0, 0], bd); torso.scale.set(1 + 0.1 * h3, 1, 0.82); mesh(pelG, pant, [0, -0.025, 0], bd, { scale: [1, 0.75, 0.74] });
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + h1 * 3; mesh(tatG, top, [Math.sin(a) * 0.15, -0.075, Math.cos(a) * 0.12], bd, { rot: [Math.PI, 0, 0], scale: [1, 0.8 + h2, 0.5] }); }
    mesh(neckG, skinM, [0, 0.775 + L - hipY, 0], bd);
    const hd = new THREE.Group(); hd.position.set(0, 0.955 + L - hipY, 0); hd.rotation.order = 'YXZ'; bd.add(hd); mesh(headG, skinM, [0, 0, 0], hd); const fm = new THREE.Mesh(fp.mesh.geometry, fp.mesh.material); fm.renderOrder = 2; hd.add(fm);
    mesh(capG, hairMs[(i + 2 * seed) % hairMs.length], [0, 0.004, -0.012], hd, { rot: [-0.32 - 0.2 * h2, 0, 0.15 * (h1 - 0.5)] });
    const arms = [-1, 1].map((s) => { const sh = new THREE.Group(); sh.position.set(s * 0.13, 0.675 + L - hipY, 0); bd.add(sh); const up = mesh(limbG, top, [0, 0, 0], sh, { scale: [0.038, 0.2, 0.038] }); const el = new THREE.Group(); el.position.y = -0.2; sh.add(el); mesh(limbG, skinM, [0, 0, 0], el, { scale: [0.03, 0.19, 0.03] }); mesh(handG, skinM, [0, -0.2, 0], el); return { sh, el }; });
    const legs = [-1, 1].map((s) => { const hp = new THREE.Group(); hp.position.set(s * 0.07, hipY - 0.02, 0); g.add(hp); mesh(limbG, pant, [0, 0, 0], hp, { scale: [0.058, 0.3, 0.058] }); const kn = new THREE.Group(); kn.position.y = -0.3; hp.add(kn); mesh(limbG, pant, [0, 0, 0], kn, { scale: [0.05, 0.28, 0.05] }); mesh(shoeG, shoeM, [0, -0.3, 0.035], kn, { scale: [0.95, 0.66, 1.5] }); return { hp, kn }; });
    members.push({ g, bd, hd, arms, legs, fx0, fz0, sp: 0.8 + 0.4 * h1, off: h2, h1, h2, h3, limp: h3 > 0.4 ? 1 : -1 });
  }
  const lead = members[0];
  let faceT = -1;
  const P = V(), Q = V();
  const api = {
    name, root, body, head: lead.hd, R, headY: 0.955 + L, eyeUp: R * 0.07, darkFace: true, faces: { ...TEO_FACE }, poses: { rest: { l: [-0.2, 0.9, 0.2], r: [0.2, 0.9, 0.2] } }, color: '#a9e5a0', horde: true, members,
    apply(p, t) {
      // one face for everybody, redrawn once per frame
      if (faceT !== t) { faceT = t; drawZombieFace(fp.ctx, null, 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.1)), t, { S: fp.size, px: fp.px, py: fp.py, EY: 19.5, EP: 4, p: {}, seed }); fp.tex.needsUpdate = true; }
      let gw = 0; for (const k of GAIT_KEYS) gw += clamp(p[k] || 0); gw = clamp(gw); const chg = clamp(p.charge || 0), gd = p.gdist || 0;
      const ph0 = p.gph || 0, pile = clamp(p.pile || 0), hz = p.heads || 0, dh = clamp((p.dHeads || 0) / 9, -1, 1);
      // the pile point in the horde's own frame (no matrices needed: position + yaw of the root)
      let px = 0, pz = 2; if (pileAt) { const dx = pileAt[0] - root.position.x, dz = pileAt[1] - root.position.z, a = -root.rotation.y; px = dx * Math.cos(a) + dz * Math.sin(a); pz = -dx * Math.sin(a) + dz * Math.cos(a); }
      const order = members.map((m, i) => [Math.hypot(m.fx0 - px, m.fz0 - pz), i]).sort((a, b) => a[0] - b[0]);
      order.forEach(([dist, i], rank) => {
        const m = members[i], ph = ph0 * m.sp + m.off, s2 = Math.sin(ph * Math.PI * 2), sway = fbm1(t * 0.4, seed + i), legA = 0.42 + 0.3 * chg;
        // running in: each surges ahead and drops back on its own clock, so they overtake one another (bounded, from the distance travelled)
        const surge = (0.55 * Math.sin(gd * 0.21 * m.sp + m.off * 6.3) + 0.25 * Math.sin(gd * 0.47 + i)) * clamp(chg + 0.3 * gw), weave = 0.12 * Math.sin(gd * 0.33 + i * 1.7) * chg;
        const fx = m.fx0 + weave, fz = m.fz0 + surge;
        m.legs.forEach((lg, j) => { const drag = j === (m.limp > 0 ? 1 : 0), sw = Math.sin((ph + j * 0.5) * Math.PI * 2) * gw * (drag ? legA * 0.5 : legA); lg.hp.rotation.x = -sw - 0.25 * chg; lg.kn.rotation.x = Math.max(0, Math.cos((ph + j * 0.5) * Math.PI * 2)) * (0.5 + 0.5 * chg) * gw * (drag ? 0.5 : 1); });
        m.bd.position.y = hipY - (0.025 + 0.03 * chg) * gw * Math.abs(s2) - 0.02 * gw * Math.max(0, Math.sin(ph * Math.PI * 2 + 0.6)) - 0.04 * chg;
        m.bd.rotation.set(0.24 + 0.06 * gw + 0.25 * chg + 0.03 * sway, 0.08 * s2 * gw, 0.07 * Math.sin(ph * Math.PI * 2 + 0.4) * gw + 0.04 * sway + (m.h1 > 0.5 ? 0.1 : -0.1));
        // arms reaching forward; in a charge they claw, out of step
        m.arms.forEach((a, j) => { const s = j ? 1 : -1, claw = chg * 0.35 * Math.sin(ph * Math.PI * 2 + j * Math.PI); a.sh.rotation.set(-1.25 - 0.18 * m.h1 + 0.12 * Math.sin(t * 1.3 + i + j) + 0.1 * s2 * gw * s - 0.2 * chg + claw, 0, s * (0.08 + 0.06 * m.h2)); a.el.rotation.set(-0.25 - 0.2 * m.h3 - 0.3 * chg * Math.max(0, -claw * 3), 0, 0); });
        // heads: hanging, jerking in a charge, all snapping round together (heads)
        m.hd.rotation.set(0.2 + 0.05 * sway + Math.abs(dh) * 0.1 + 0.1 * chg * jerk(t, seed + i * 3, 0.3, 0.06), hz * (0.88 + 0.24 * m.h1) + 0.06 * Math.sin(t * 0.7 + i) + 0.3 * chg * jerk(t, seed + i * 7, 0.28 + 0.1 * m.h2, 0.06), (0.26 + 0.08 * m.h2) * (m.h3 > 0.5 ? 1 : -1) * (1 - 0.6 * clamp(Math.abs(hz))) - dh * 0.3);
        // the pile: one after another (closest first), each dives from its own side in a short arc, lands lying across the pile head-in, bounces, claws at it
        const st = (rank / n) * 0.72, k = clamp((pile - st) / 0.16), after = pile - st - 0.16;
        m.g.rotation.order = 'YXZ';
        if (k > 0) { const layer = Math.floor(rank / 5), base = Math.atan2(fx - px, fz - pz), ang = base + ((rank % 5) - 2) * 0.95 + layer * 0.6 + (hash(i * 9.1) - 0.5) * 0.4, rr = Math.max(0.2, 0.46 - layer * 0.08) * (0.9 + 0.2 * m.h2);   // from different sides, over the middle
          const T = V(px + Math.sin(ang) * rr, 0.3 + layer * 0.2 + 0.05 * hash(i), pz + Math.cos(ang) * rr), S0 = V(fx, hipY, fz), bnc = after > 0 ? 0.05 * Math.exp(-after * 40) * Math.abs(Math.sin(after * 95)) : 0;
          const hipP = S0.clone().lerp(T, k); hipP.y = lerp(hipY, T.y, k) + 0.65 * 4 * k * (1 - k) + bnc;
          const pitch = lerp(0.2, 1.45 + 0.15 * (hash(i * 3) - 0.5), smooth(k * 1.3)), yaw = lerp(0, ang + Math.PI, smooth(k * 2)), roll = (hash(i * 5) - 0.5) * 0.5 * k;
          m.g.rotation.set(pitch, yaw, roll); const off = V(0, hipY, 0).applyEuler(m.g.rotation); m.g.position.copy(hipP).sub(off);
          m.bd.rotation.set(lerp(m.bd.rotation.x, 0.15, k), 0, m.bd.rotation.z * (1 - k)); m.bd.position.y = hipY;
          m.arms.forEach((a, j) => { const clawK = after > 0 ? 0.45 * Math.sin(t * 5 + i * 2 + j * 1.9) : 0; a.sh.rotation.x = lerp(a.sh.rotation.x, -2.5 + clawK, smooth(k * 1.5)); a.el.rotation.x = lerp(a.el.rotation.x, -0.5 + 0.4 * clawK, k); });
          m.hd.rotation.x = lerp(m.hd.rotation.x, -0.5, k); m.legs.forEach((lg, j) => { const kick = after > 0 ? 0.2 * Math.sin(t * 3 + i + j * 2) : 0; lg.hp.rotation.x = lerp(lg.hp.rotation.x, lerp(0.35, -0.75 - 0.2 * j + kick, smooth(k * 1.6 - 0.6)), k); lg.kn.rotation.x = lerp(lg.kn.rotation.x, lerp(0.2, 1.25 + 0.3 * hash(i + j), smooth(k * 1.6 - 0.6)), k);  /* legs trail in the dive, then fold down onto the pile (crawling on it) */ }); }
        else { m.g.position.set(fx, 0, fz); m.g.rotation.set(0, 0, 0); }
      });
    },
    headWorld(out = V()) { return lead.hd.getWorldPosition(out); },
  };
  root.userData.api = api; return api;
}

// ---------- the names an episode uses (register in packs/index.js, or Object.assign(PACKS.trada.chars, ZOMBIE_CHARS) from the episode file) ----------
export const ZOMBIE_CHARS = {
  zguard: (o) => makeZombie('guard', o), zshipper: (o) => makeZombie('shipper', o), zlandlord: (o) => makeZombie('landlord', o), zfriend: (o) => makeZombie('friend', o),
  zgranny: (o) => makeZombie('granny', o), zombie: (o) => makeZombie(o.kind || 'plain', o), victim: (o) => makeVictim(o), horde: (o) => makeHorde(o),
};
