// Trà đá với AI, special "Tèo vào GTA 6?" (19/11): the BANK (interior + the side characters) and the small helpers shared with gta_world.js.
// Law of this file: a pure function of t. Every fx is a ramp or a slow wave. Nothing here names a real bank, brand or game asset.
// Bank-local frame (the composite adds the place origin): hall x -6.5..4.8, z -6.5..6.6, ceiling 3.7. The camera usually stands at +z and looks towards -z; yaw 0 = facing +z.
//   north wall (z -6.5): entrance door (x -3.3), ticket machine LẤY SỐ (x -1.7), guard beside it; the five waiting chairs face +z in front of them (z -2.3)
//   south wall (z +6.6): the LED board ĐANG PHỤC VỤ (the chairs face it)
//   east wall (x +4.8): the counter windows QUẦY 2 / 3 / 4 (z +3.9 / +0.9 / -2.1); customers stand at x 1.75 facing +x, tellers sit at x 3.2 facing -x on a 0.38 m platform
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, smooth, hash, noise1, canvasTex, grain, std, emis, mesh, box, cyl, ball } from '../../core/util.js';
import { makePerson } from './people.js';
import { softDisc } from './street.js';

export const FONT = (px, w = 900) => `${w} ${px}px Display, sans-serif`;
const MAT = (o) => new THREE.MeshStandardMaterial(o);
// shrink a font until text fits
export function fitText(c, text, maxW, size, w = 900) { c.font = FONT(size, w); while (c.measureText(text).width > maxW && size > 8) { size -= 2; c.font = FONT(size, w); } return size; }
// neon lettering: a coloured glow round a thin white-hot core (draw into a canvas context; the same call on the emissive canvas makes it glow)
export function neonText(c, text, x, y, size, col, { glow = 0.35, core = '#ffffff', w = 900, align = 'center', maxW = 0, tube = 0.1 } = {}) {
  c.save(); c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; if (maxW) size = fitText(c, text, maxW, size, w); else c.font = FONT(size, w);
  c.shadowColor = col; c.shadowBlur = size * glow; c.strokeStyle = col; c.lineWidth = size * tube * 1.6; c.strokeText(text, x, y); c.strokeText(text, x, y);
  c.shadowBlur = size * glow * 0.4; c.lineWidth = size * tube; c.strokeStyle = col; c.strokeText(text, x, y);
  c.shadowBlur = 0; c.lineWidth = size * tube * 0.42; c.strokeStyle = core; c.strokeText(text, x, y); c.restore();
}
// a sign plate: dark body, coloured edge, white letters (readable at phone size)
export function plateTex(w, h, text, { bg = '#173238', fg = '#ffffff', edge = '#7fe6f2', size = 0, sub = null, subCol = '#9fd4dc' } = {}) {
  return canvasTex(w, h, (c) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = edge; c.lineWidth = Math.max(4, h * 0.05); c.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; const ty = sub ? h * 0.42 : h * 0.52, s = fitText(c, text, w * 0.86, size || h * (sub ? 0.5 : 0.62)); c.fillText(text, w / 2, ty);
    if (sub) { c.fillStyle = subCol; c.font = FONT(h * 0.17, 700); c.fillText(sub, w / 2, h * 0.8); } });
}
export const glowMat = (map, k = 1.2, o = {}) => new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: k, roughness: 0.6, ...o });
// additive glow (no light cost; toneMapped false so it can bloom)
export const addMat = (map, color = '#ffffff', k = 1, o = {}) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: k, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, ...o });
// merge boxes / planes (all BufferGeometry with position+normal+uv) given as [geometry, matrix] into one mesh
export function mergeList(list, mat, parent, { cast = true, recv = true } = {}) {
  if (!list.length) return null; const gs = list.map(([g, m]) => { const c = g.clone(); c.applyMatrix4(m); return c; }); const m = new THREE.Mesh(mergeGeometries(gs, false), mat); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export const xf = (p, rot = [0, 0, 0], s = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(...p), _q.setFromEuler(_e.set(...rot)).clone(), new THREE.Vector3(...s));

// ---------------------------------------------------------------------------------------------------------------------------------------
// PEOPLE (makePerson characters; names are cast names: castOpts may be omitted)
// ---------------------------------------------------------------------------------------------------------------------------------------
// baove: the bank guard. Middle-aged, stocky, cap, light-blue uniform shirt, navy trousers, belt, shoulder tabs, a badge. Poses: point (left arm out to the machine), pointF (forward), + the person poses. Speaks (deadpan).
export function makeBaove() {
  const decorate = ({ head, body, R, L }) => {
    const cap = new THREE.MeshStandardMaterial({ color: '#1d2a44', roughness: 0.7 }), band = std('#e0b840', { roughness: 0.5 });
    const dome = mesh(new THREE.SphereGeometry(R * 1.07, 40, 22, 0, Math.PI * 2, 0, Math.PI * 0.46), cap, [0, 0.012, -0.004], head, { rot: [-0.12, 0, 0] });
    mesh(new THREE.CylinderGeometry(R * 1.075, R * 1.08, 0.018, 40, 1, true), band, [0, R * 0.38, -0.014], head, { rot: [-0.12, 0, 0] });
    const brim = mesh(new THREE.CylinderGeometry(R * 0.78, R * 0.95, 0.014, 28, 1, false, -Math.PI / 2 - 1.2, 2.4), cap, [0, R * 0.52, R * 0.74], head, { rot: [0.12, 0, 0], scale: [1.0, 1, 0.9] });
    mesh(new THREE.SphereGeometry(0.02, 12, 8), band, [0, R * 0.62, R * 0.9], head);   // cap badge
    // moustache on the face patch
    mesh(new THREE.SphereGeometry(1, 16, 10), std('#16121a', { roughness: 0.8 }), [0, -0.0, R * 0.93], head, { scale: [0.062, 0.016, 0.026], cast: false });
    // epaulettes, belt, chest badge
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.075, 0.016, 0.1), std('#16213a'), [s * 0.13, 0.715 + L, 0.0], body, { rot: [0, 0, -s * 0.35] });
    mesh(new THREE.TorusGeometry(0.15, 0.016, 8, 36), std('#101018', { roughness: 0.5 }), [0, 0.43 + L, 0], body, { rot: [Math.PI / 2, 0, 0], scale: [1.1, 0.82, 1] });
    mesh(new THREE.BoxGeometry(0.034, 0.034, 0.008), std('#e8c84a', { roughness: 0.3, metalness: 0.6 }), [0.07, 0.6 + L, 0.138], body);
    return { update() {} };
  };
  const p = makePerson({ decorate, name: 'baove', skin: '#d29a76', hair: 'short', hairColor: '#241c1c', top: '#8cc3ea', bottom: '#1f2c4a', age: 'young', build: 1.16, stand: true, lift: 0.36, shoe: '#17151a', collar: '#e8f2fa', brow: '#2a2022', color: '#9ad0ff', seed: 41 });
  const L = 0.36;
  p.poses.point = { l: [-0.43, L + 0.62, 0.1, 0], r: [0.215, L + 0.37, 0.02, 0] };      // the machine is at his screen-left, level with him
  p.poses.pointF = { l: [-0.13, L + 0.62, 0.34, 0], r: [0.215, L + 0.37, 0.02, 0] };
  p.poses.arms = { l: [0.1, L + 0.56, 0.18, 0], r: [-0.1, L + 0.58, 0.19, 0] };       // arms folded, stern
  return p;
}
// gdv: the young teller (seated, tidy bun, teal vest over a white blouse). Poses: push (right hand reaches into the slot), press (reaches under the desk to a button), table, rest.
export function makeGdv() {
  const p = makePerson({ name: 'gdv', skin: '#f0c8a6', hair: 'bun', hairColor: '#1c1618', top: '#fbfbf6', blouse: '#fbfbf6', cardigan: '#2f6670', bottom: '#2a2f48', age: 'young', build: 0.95, stand: false, lash: true, shoe: '#2a2428', color: '#9de0e6', seed: 29, collar: '#fbfbf6' });
  p.poses.push = { l: [-0.12, 0.5, 0.3, 0], r: [0.1, 0.53, 0.5, 0] };
  p.poses.press = { l: [-0.12, 0.5, 0.3, 0], r: [0.16, 0.2, 0.34, 0] };               // reaches under the desk, presses the silent alarm
  p.poses.table = { l: [-0.12, 0.5, 0.3, 0], r: [0.12, 0.5, 0.3, 0] };
  return p;
}
// customers (seated; kh1s = the same old lady standing, for the walk to the counter)
const CUST = {
  kh1: { skin: '#e6b895', hair: 'bun', hairColor: '#b9b6c4', top: '#8d73b8', pattern: 'plain', bottom: '#4a3f5e', age: 'old', build: 1.04, color: '#c9b3ee', seed: 51, collar: '#f3ecfa' },
  kh2: { skin: '#dba67f', hair: 'short', hairColor: '#1c1a20', top: '#6f9a72', pattern: 'plain', bottom: '#33384a', glasses: '#202026', age: 'young', build: 1.0, color: '#a9d8ac', seed: 52 },
  kh3: { skin: '#c68e69', hair: 'long', hairColor: '#17110f', top: '#e5604d', pattern: 'plain', bottom: '#2c2c36', lash: true, age: 'young', build: 0.96, color: '#ffa391', seed: 53 },
  kh4: { skin: '#e2b08a', hair: 'short', hairColor: '#8c8a92', top: '#e9e2cf', cardigan: '#80603c', blouse: '#e9e2cf', bottom: '#3a3a42', glasses: '#6a4a2a', age: 'old', build: 1.1, color: '#d8b98a', seed: 54 },
  kh5: { skin: '#f0c8a6', hair: 'bob', hairColor: '#3a2a4a', top: '#f3d03c', pattern: 'stripes', bottom: '#40507a', lash: true, age: 'young', build: 0.92, color: '#ffe680', seed: 55 },
};
export const makeCustomer = (k, stand = false) => () => makePerson({ name: k, ...CUST[k === 'kh1s' ? 'kh1' : k], stand, ...(stand ? { lift: 0.36 } : {}) });
export const GTA_CHARS = { baove: makeBaove, gdv: makeGdv, kh1: makeCustomer('kh1'), kh1s: makeCustomer('kh1s', true), kh2: makeCustomer('kh2'), kh3: makeCustomer('kh3'), kh4: makeCustomer('kh4'), kh5: makeCustomer('kh5') };
export const BANK_PEOPLE = ['baove', 'gdv', 'kh1', 'kh1s', 'kh2', 'kh3', 'kh4', 'kh5'];

// ---------------------------------------------------------------------------------------------------------------------------------------
// THE BANK
// ---------------------------------------------------------------------------------------------------------------------------------------
const WZ = [3.9, 0.9, -2.1];        // z of the three windows QUẦY 2 / 3 / 4
const ZC = 0.9;                      // QUẦY 3
const PLAT = 0.38, TOP = 0.88;       // teller platform height, counter top height
let _digits = new Map();
function ledTex(n) {   // the LED board: three red dot-matrix-ish digits under ĐANG PHỤC VỤ
  const s = String(Math.max(0, Math.min(999, Math.round(n)))).padStart(3, '0'); if (_digits.has(s)) return _digits.get(s);
  const t = canvasTex(1024, 384, (c, w, h) => { c.fillStyle = '#0a0c10'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a4350'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'ĐANG PHỤC VỤ', w * 0.8, 92); c.fillText('ĐANG PHỤC VỤ', w / 2, 70);
    // seven-segment digits
    const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
    const dw = 150, dh = 200, gap = 56, x0 = w / 2 - (3 * dw + 2 * gap) / 2, y0 = 132;
    for (let i = 0; i < 3; i++) { const x = x0 + i * (dw + gap), on = SEG[s[i]], th = 26;
      const seg = { a: [x + th / 2, y0, dw - th, th], d: [x + th / 2, y0 + dh - th, dw - th, th], g: [x + th / 2, y0 + dh / 2 - th / 2, dw - th, th], f: [x, y0 + th / 2, th, dh / 2 - th], b: [x + dw - th, y0 + th / 2, th, dh / 2 - th], e: [x, y0 + dh / 2 + th / 2, th, dh / 2 - th], c: [x + dw - th, y0 + dh / 2 + th / 2, th, dh / 2 - th] };
      for (const k of 'abcdefg') { const lit = on.includes(k); c.fillStyle = lit ? '#ff3a28' : '#2a1412'; if (lit) { c.shadowColor = '#ff5a30'; c.shadowBlur = 26; } c.fillRect(...seg[k]); c.shadowBlur = 0; } } });
  _digits.set(s, t); return t;
}
const clockTex = () => canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#e9ecee'; c.beginPath(); c.arc(w / 2, h / 2, 250, 0, 7); c.fill(); c.strokeStyle = '#1c2630'; c.lineWidth = 22; c.stroke(); c.fillStyle = '#1c2630';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.save(); c.translate(w / 2, h / 2); c.rotate(a); c.fillRect(-7, -222, 14, i % 3 ? 26 : 44); c.restore(); } });
const ticketTex = (txt, w = 192, h = 256) => canvasTex(w, h, (c) => { c.fillStyle = '#fbf6e2'; c.fillRect(0, 0, w, h); c.fillStyle = '#c4452d'; c.fillRect(0, 0, w, 40); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = FONT(26, 800); c.fillText('SỐ THỨ TỰ', w / 2, 21);
  c.fillStyle = '#1b2230'; fitText(c, txt, w * 0.8, 108); c.fillText(txt, w / 2, 130); c.fillStyle = 'rgba(30,40,60,0.45)'; c.fillRect(24, 200, w - 48, 6); c.fillRect(24, 216, w - 90, 6); });
const formTex = () => canvasTex(256, 340, (c, w, h) => { c.fillStyle = '#f7f7f1'; c.fillRect(0, 0, w, h); c.fillStyle = '#25427a'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'PHIẾU RÚT TIỀN', w * 0.9, 38, 900); c.fillText('PHIẾU RÚT TIỀN', w / 2, 36);
  c.fillStyle = 'rgba(40,50,70,0.5)'; for (let i = 0; i < 7; i++) c.fillRect(22, 86 + i * 26, 120 + (i * 37 % 90), 5); c.strokeStyle = 'rgba(40,50,70,0.7)'; c.lineWidth = 3; c.strokeRect(22, 270, 150, 46); c.fillStyle = 'rgba(40,50,70,0.5)'; c.font = FONT(16, 700); c.textAlign = 'left'; c.fillText('Chữ ký', 28, 258); });
const stampTex = () => canvasTex(160, 160, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#c4262e'; c.lineWidth = 8; c.beginPath(); c.arc(80, 80, 66, 0, 7); c.stroke(); c.lineWidth = 3; c.beginPath(); c.arc(80, 80, 52, 0, 7); c.stroke(); c.fillStyle = '#c4262e'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = FONT(26, 900); c.fillText('ĐÃ CHI', 80, 80); }, {});
const bagTex = () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#b98a54'; c.fillRect(0, 0, w, h); grain(c, w, h, 3500, 0.12, 5, 2); c.fillStyle = '#f7f1dc'; c.beginPath(); c.roundRect(52, 92, 152, 96, 10); c.fill(); c.fillStyle = '#7a3a1c'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, '50 TRIỆU', 132, 44); c.fillText('50 TRIỆU', 128, 128); c.font = FONT(26, 800); c.fillText('VNĐ', 128, 165); });

export function buildGtaBank(scene, { at = [0, 0, 0], numA = 47, numB = 112 } = {}) {
  const g = new THREE.Group(); g.name = 'gta_bank'; g.position.set(...at); scene.add(g);
  const seats = {}, cams = {}; const S = (n, p, yaw = 0) => { seats[n] = { pos: [p[0] + at[0], p[1] + at[1], p[2] + at[2]], yaw }; };
  const X0 = -6.5, X1 = 4.8, Z0 = -6.5, Z1 = 6.6, H = 3.7;
  // ---- floor: big pale tiles, a little shine ----
  const floorT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#c9ced0'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#bfc5c8' : '#d3d8d9'; c.fillRect(i * 256, j * 256, 256, 256); } c.strokeStyle = 'rgba(80,90,96,0.35)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); c.beginPath(); c.moveTo(256, 0); c.lineTo(256, h); c.moveTo(0, 256); c.lineTo(w, 256); c.stroke(); grain(c, w, h, 2500, 0.05, 3, 2); }, { repeat: [(X1 - X0) / 1.8, (Z1 - Z0) / 1.8] });
  mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), MAT({ map: floorT, roughness: 0.42, envMapIntensity: 0.6 }), [(X0 + X1) / 2, 0, (Z0 + Z1) / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  // ---- walls (mid-pale grey-teal, so the characters stay brighter), skirting, ceiling with flat light panels ----
  const wallM = MAT({ color: '#8fa7b0', roughness: 0.92 }), wallM2 = MAT({ color: '#7d9aa4', roughness: 0.92 });
  mesh(new THREE.PlaneGeometry(Z1 - Z0, H), wallM2, [X0, H / 2, (Z0 + Z1) / 2], g, { cast: false, rot: [0, Math.PI / 2, 0] });                 // west
  mesh(new THREE.PlaneGeometry(Z1 - Z0, H), wallM, [X1, H / 2, (Z0 + Z1) / 2], g, { cast: false, rot: [0, -Math.PI / 2, 0] });                  // east
  mesh(new THREE.PlaneGeometry(X1 - X0, H), wallM, [(X0 + X1) / 2, H / 2, Z0], g, { cast: false });                                             // north (faces +z)
  mesh(new THREE.PlaneGeometry(X1 - X0, H), wallM2, [(X0 + X1) / 2, H / 2, Z1], g, { cast: false, rot: [0, Math.PI, 0] });                      // south
  for (const [w, p, r] of [[Z1 - Z0, [X0 + 0.02, 0.07, (Z0 + Z1) / 2], Math.PI / 2], [X1 - X0, [(X0 + X1) / 2, 0.07, Z0 + 0.035], 0]]) mesh(new THREE.PlaneGeometry(w, 0.14), std('#3c4a52'), p, g, { cast: false, rot: [0, r, 0] });
  const ceilT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#d8dde0'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(24, 60, 208, 136, 8); c.fill(); c.strokeStyle = '#a9b1b6'; c.lineWidth = 6; c.stroke(); c.fillStyle = '#eef2f4'; for (let i = 0; i < 4; i++) c.fillRect(40 + i * 48, 70, 22, 116); }, { repeat: [(X1 - X0) / 2.4, (Z1 - Z0) / 2.4] });
  mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ map: ceilT, emissive: '#ffffff', emissiveMap: ceilT, emissiveIntensity: 0.55, roughness: 1 }), [(X0 + X1) / 2, H, (Z0 + Z1) / 2], g, { cast: false, rot: [Math.PI / 2, 0, 0] });
  // ---- west wall: a band of tall windows onto a bright dusty-peach outside ----
  const winT = canvasTex(256, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffd9b8'); gr.addColorStop(1, '#ffeedd'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  for (let i = 0; i < 4; i++) { const z = -4.6 + i * 3.1; mesh(new THREE.PlaneGeometry(2.3, 2.2), new THREE.MeshStandardMaterial({ map: winT, emissive: '#fff3e6', emissiveMap: winT, emissiveIntensity: 1.0, roughness: 1 }), [X0 + 0.03, 1.75, z], g, { cast: false, rot: [0, Math.PI / 2, 0] });
    box(0.1, 0.1, 2.5, std('#2c3840'), [X0 + 0.06, 2.88, z], g, { cast: false }); box(0.1, 0.1, 2.5, std('#2c3840'), [X0 + 0.06, 0.62, z], g, { cast: false }); for (const s of [-1, 1]) box(0.1, 2.3, 0.1, std('#2c3840'), [X0 + 0.06, 1.75, z + s * 1.2], g, { cast: false }); box(0.08, 2.2, 0.05, std('#2c3840'), [X0 + 0.06, 1.75, z], g, { cast: false }); }
  // ---- north wall: the entrance door (glass, bright outside), a poster wall, plants ----
  const DX = -3.3;
  mesh(new THREE.PlaneGeometry(2.0, 2.5), new THREE.MeshStandardMaterial({ map: winT, emissive: '#ffe8d0', emissiveMap: winT, emissiveIntensity: 1.05, roughness: 1 }), [DX, 1.25, Z0 + 0.02], g, { cast: false });
  for (const [w, h, p] of [[2.2, 0.1, [DX, 2.55, Z0 + 0.06]], [0.1, 2.5, [DX - 1.05, 1.25, Z0 + 0.06]], [0.1, 2.5, [DX + 1.05, 1.25, Z0 + 0.06]], [0.07, 2.5, [DX, 1.25, Z0 + 0.06]]]) box(w, h, 0.1, std('#2c3840'), p, g, { cast: false });
  box(1.3, 0.08, 0.04, std('#c8d0d4', { metalness: 0.7, roughness: 0.3 }), [DX, 1.05, Z0 + 0.12], g, { cast: false });
  const posterT = (txt, col) => canvasTex(256, 360, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(128, 130, 70, 0, 7); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, txt, w * 0.84, 38); c.fillText(txt, w / 2, 270); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(40, 310, 176, 8); });
  [[0.5, 'VAY NHANH', '#4b7f8c'], [2.0, 'GỬI TIẾT KIỆM', '#6c5f95'], [3.5, 'THẺ TÍN DỤNG', '#c0733f']].forEach(([x, t, c]) => mesh(new THREE.PlaneGeometry(0.9, 1.26), MAT({ map: posterT(t, c), roughness: 0.8 }), [x, 1.7, Z0 + 0.03], g, { cast: false }));
  for (const x of [-5.7, -1.0]) { const pot = cyl(0.22, 0.17, 0.4, std('#cfd5d8'), [x, 0.2, Z0 + 0.5], g, {}, 18); for (let i = 0; i < 7; i++) { const a = i * 2.4; mesh(new THREE.SphereGeometry(1, 10, 8), std('#3f7a52', { roughness: 0.8 }), [x + Math.cos(a) * 0.16, 0.62 + 0.08 * (i % 3), Z0 + 0.5 + Math.sin(a) * 0.16], g, { scale: [0.1, 0.34, 0.1], rot: [0.3 * Math.sin(a), 0, 0.3 * Math.cos(a)] }); } }
  // wall clock above the chairs (fx clock), a calendar
  const clk = new THREE.Group(); clk.position.set(-2.0, 2.75, Z0 + 0.06); g.add(clk);
  mesh(new THREE.CircleGeometry(0.46, 40), MAT({ map: clockTex(), roughness: 0.6 }), [0, 0, 0.0], clk, { cast: false });
  const handM = std('#10151c', { roughness: 0.6 }), hMin = new THREE.Group(), hHr = new THREE.Group(), hSec = new THREE.Group(); clk.add(hHr, hMin, hSec);
  box(0.034, 0.3, 0.012, handM, [0, 0.15, 0.012], hMin, { cast: false }); box(0.046, 0.2, 0.012, handM, [0, 0.1, 0.02], hHr, { cast: false }); box(0.012, 0.36, 0.01, std('#c4262e'), [0, 0.15, 0.03], hSec, { cast: false }); ball(0.03, handM, [0, 0, 0.034], clk, { cast: false }, 12);
  // ---- east wall: teller back wall (wood slats, shelves with folders, a safe), + platform ----
  const slatT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#7a634a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#6c5740' : '#86705a'; c.fillRect(i * 32, 0, 28, h); } }, { repeat: [(Z1 - Z0) / 1.0, 1] });
  mesh(new THREE.PlaneGeometry(Z1 - Z0, 2.2), MAT({ map: slatT, roughness: 0.8 }), [X1 - 0.02, PLAT + 1.1 + 0.5, (Z0 + Z1) / 2], g, { cast: false, rot: [0, -Math.PI / 2, 0] });
  box(2.1, 0.1, 11.4, MAT({ color: '#9aa6a8', roughness: 0.85 }), [(2.55 + X1) / 2, PLAT - 0.05, 0.6], g, { cast: false });   // platform  (x 2.55..4.8)
  const folderCols = ['#c5503a', '#3f6fa6', '#d9b13c', '#5a9a6a', '#8a62b0'];
  for (const zc of WZ) { for (let r = 0; r < 3; r++) { const y = PLAT + 1.25 + r * 0.5; box(0.34, 0.04, 2.2, std('#59636a'), [X1 - 0.19, y, zc - 0.2], g, { cast: false }); for (let k = 0; k < 14; k++) { const hh = 0.24 + 0.1 * hash(k + r * 9 + zc), col = folderCols[(k * 7 + r * 3 + Math.floor(zc * 9)) & 3 + ((k + r) % 2)] ?? folderCols[0]; box(0.07, hh, 0.11, std(folderCols[(k + r * 2 + Math.abs(Math.floor(zc * 3))) % 5], { roughness: 0.7 }), [X1 - 0.19, y + hh / 2 + 0.02, zc - 1.2 + k * 0.145], g, { cast: false }); } } }
  // ---- the three counter windows ----
  const counterTop = MAT({ color: '#e5e0d3', roughness: 0.5 }), counterBody = MAT({ color: '#4f6c75', roughness: 0.7 }), glassM = new THREE.MeshPhysicalMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.1, roughness: 0.6, specularIntensity: 0.05, envMapIntensity: 0.1, depthWrite: false, side: THREE.DoubleSide }), alu = std('#c0c8cc', { metalness: 0.7, roughness: 0.35 });
  const blade = (txt, z, sub = null) => { const T = plateTex(512, 180, txt, { bg: '#173a44', edge: '#7fe6f2', size: 118 }), m = new THREE.MeshStandardMaterial({ map: T, emissive: '#ffffff', emissiveMap: T, emissiveIntensity: 0.9, roughness: 0.6 });
    const gp = new THREE.Group(); gp.position.set(2.0, 2.78, z); g.add(gp); for (const s of [1, -1]) mesh(new THREE.PlaneGeometry(1.5, 0.53), m, [0, 0, s * 0.026], gp, { cast: false, rot: [0, s > 0 ? 0 : Math.PI, 0] }); box(1.5, 0.53, 0.05, std('#0d1c21'), [0, 0, 0], gp, { cast: false }); for (const s of [-1, 1]) cyl(0.012, 0.012, 0.9, std('#9aa4a8'), [s * 0.6, 0.7, 0], gp, { cast: false }, 8); };
  WZ.forEach((zc, i) => {
    box(0.9, TOP, 2.0, counterBody, [2.5, TOP / 2, zc], g); box(0.96, 0.05, 2.06, counterTop, [2.52, TOP + 0.005, zc], g, { cast: false });   // desk x 2.05..2.95 incl. teller's half
    box(0.05, 1.0, 2.0, glassM, [2.55, TOP + 0.13 + 0.5, zc], g, { cast: false });                                                                 // the screen (a 0.13 slot below it)
    for (const z of [-1, 1]) box(0.07, 1.14, 0.06, alu, [2.55, TOP + 0.57, zc + z], g, { cast: false }); box(0.07, 0.05, 2.06, alu, [2.55, TOP + 1.14, zc], g, { cast: false }); box(0.07, 0.025, 2.0, alu, [2.55, TOP + 0.125, zc], g, { cast: false });
    box(0.42, 0.012, 0.5, alu, [2.55, TOP + 0.036, zc + 0.0], g, { cast: false });                                                                 // the pass-through tray
    blade('QUẦY ' + (i === 0 ? 2 : i === 1 ? 3 : 4), zc);
    // desk things on the teller's side: monitor (we see its back), keyboard, pen pot
    box(0.05, 0.3, 0.46, std('#20262c'), [3.02, TOP + 0.3, zc - 0.62], g, { cast: false }); box(0.1, 0.14, 0.1, std('#20262c'), [3.0, TOP + 0.08, zc - 0.62], g, { cast: false }); box(0.18, 0.012, 0.42, std('#d8dde0'), [2.8, TOP + 0.03, zc - 0.55], g, { cast: false });
    // teller chair (swivel): pole, seat, back
    if (true) { const cz = zc; cyl(0.03, 0.03, 0.3, std('#222'), [3.2, PLAT + 0.15, cz], g, { cast: false }, 8); box(0.5, 0.07, 0.5, std('#33444c'), [3.2, PLAT + 0.2, cz], g, { cast: false }); box(0.07, 0.5, 0.46, std('#33444c'), [3.5, PLAT + 0.5, cz], g, { cast: false }); }
  });
  // the stamp pad and a bell on QUẦY 3 teller side
  box(0.12, 0.02, 0.1, std('#2a3a8a'), [2.78, TOP + 0.04, ZC + 0.45], g, { cast: false });
  // ---- props with fx: ticket, form + pen, stamp, bag ----
  const ticket = mesh(new THREE.PlaneGeometry(0.16, 0.21), MAT({ map: ticketTex('112'), roughness: 0.85, side: THREE.DoubleSide }), [2.2, TOP + 0.045, ZC + 0.05], g, { cast: false, rot: [-Math.PI / 2, 0, 0.25] }); ticket.visible = false;
  const formG = new THREE.Group(); g.add(formG); mesh(new THREE.PlaneGeometry(0.21, 0.28), MAT({ map: formTex(), roughness: 0.85, side: THREE.DoubleSide }), [0, 0, 0], formG, { cast: false, rot: [-Math.PI / 2, 0, 0] }); cyl(0.007, 0.007, 0.15, std('#2b4a9a'), [0.05, 0.01, -0.02], formG, { cast: false, rot: [0, 0, Math.PI / 2], }, 8); formG.visible = false;
  const stampMark = mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ map: stampTex(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 }), [0.04, 0.003, 0.08], formG, { cast: false, rot: [-Math.PI / 2, 0, 0] }); stampMark.visible = false;
  const stamper = new THREE.Group(); g.add(stamper); cyl(0.035, 0.04, 0.05, std('#20242a'), [0, 0.03, 0], stamper, {}, 14); cyl(0.022, 0.022, 0.07, std('#8a4a2a'), [0, 0.09, 0], stamper, {}, 12); ball(0.03, std('#8a4a2a'), [0, 0.13, 0], stamper, {}, 12); stamper.visible = false;
  const bag = new THREE.Group(); g.add(bag); { const bm = MAT({ map: bagTex(), roughness: 0.9 }); mesh(new THREE.SphereGeometry(0.16, 20, 16), bm, [0, 0.13, 0], bag, { scale: [1, 0.85, 1.0] }); cyl(0.05, 0.1, 0.12, bm, [0, 0.27, 0], bag, {}, 14); mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16), std('#4a2a14'), [0, 0.3, 0], bag, { rot: [Math.PI / 2, 0, 0] }); } bag.visible = false;
  // ---- the LED board on the south wall (faces -z, the chairs face it); numbers come from fx num ----
  const ledMat = new THREE.MeshStandardMaterial({ map: ledTex(numA), emissive: '#ffffff', emissiveMap: ledTex(numA), emissiveIntensity: 1.35, roughness: 0.5 });
  const led = mesh(new THREE.PlaneGeometry(2.4, 0.9), ledMat, [-2.0, 2.5, Z1 - 0.075], g, { cast: false, rot: [0, Math.PI, 0] }); box(2.5, 1.0, 0.1, std('#0d1013'), [-2.0, 2.5, Z1 - 0.01], g, { cast: false });
  // ---- the ticket machine LẤY SỐ (north wall, faces +z) ----
  const MX = -1.75, MZ = Z0 + 0.5;
  box(0.56, 1.3, 0.34, MAT({ color: '#314a58', roughness: 0.5 }), [MX, 0.65, MZ], g); box(0.6, 0.06, 0.38, std('#1b2a32'), [MX, 1.32, MZ], g);
  const lsT = plateTex(512, 200, 'LẤY SỐ', { bg: '#ffd23a', fg: '#1b2230', edge: '#1b2230', size: 140 }); mesh(new THREE.PlaneGeometry(0.9, 0.35), glowMat(lsT, 0.9), [MX, 1.62, MZ + 0.06], g, { cast: false }); box(0.92, 0.37, 0.08, std('#20262c'), [MX, 1.62, MZ + 0.01], g, { cast: false }); for (const s of [-1, 1]) cyl(0.012, 0.012, 0.25, std('#20262c'), [MX + s * 0.3, 1.45, MZ + 0.02], g, { cast: false }, 8);
  const scrT = canvasTex(256, 200, (c, w, h) => { c.fillStyle = '#10222c'; c.fillRect(0, 0, w, h); c.fillStyle = '#7fe6f2'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'CHẠM ĐỂ LẤY SỐ', w * 0.86, 30); c.fillText('CHẠM ĐỂ LẤY SỐ', w / 2, 60); c.fillStyle = '#ffd23a'; c.beginPath(); c.roundRect(60, 100, 136, 60, 12); c.fill(); c.fillStyle = '#1b2230'; c.font = FONT(36, 900); c.fillText('LẤY SỐ', 128, 131); });
  mesh(new THREE.PlaneGeometry(0.4, 0.31), glowMat(scrT, 0.9), [MX, 1.02, MZ + 0.176], g, { cast: false, rot: [-0.18, 0, 0] }); box(0.2, 0.05, 0.14, std('#10161a'), [MX, 0.66, MZ + 0.2], g, { cast: false }); box(0.1, 0.1, 0.012, std('#fbf6e2'), [MX, 0.62, MZ + 0.27], g, { cast: false, rot: [0.3, 0, 0] });
  // ---- five linked waiting chairs (one beam, five seats), facing +z ----
  const chairBase = std('#3d4a52', { roughness: 0.5, metalness: 0.3 }), seatM = MAT({ color: '#5f8f9f', roughness: 0.7 }), CZ = -2.3; box(5.3, 0.05, 0.1, chairBase, [-2.0, 0.17, CZ - 0.05], g, { cast: false }); box(5.3, 0.05, 0.1, chairBase, [-2.0, 0.17, CZ + 0.14], g, { cast: false });
  for (let k = 0; k < 5; k++) { const x = -4.0 + k; box(0.88, 0.07, 0.62, seatM, [x, 0.24, CZ], g); box(0.88, 0.5, 0.07, seatM, [x, 0.53, CZ - 0.33], g, { rot: [-0.08, 0, 0] }); for (const s of [-0.45, 0.45]) box(0.06, 0.2, 0.6, chairBase, [x + s, 0.34, CZ], g, { cast: false }); S('wait_' + (k + 1), [x, 0, CZ], 0); }
  for (const x of [-4.5, 0.5]) for (const z of [CZ - 0.05, CZ + 0.1]) box(0.06, 0.16, 0.06, chairBase, [x, 0.08, z], g, { cast: false });
  // ---- sun patch from the door (fx sun): a warm parallelogram that slides over the floor, + a shaft in the doorway ----
  const sunT = canvasTex(128, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.82, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'destination-in'; const g2 = c.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.7, 'rgba(0,0,0,0.6)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.fillRect(0, 0, w, h); }, { mip: false });
  const sunP = mesh(new THREE.PlaneGeometry(2.0, 3.6), addMat(sunT, '#ffc684', 0.55), [DX, 0.012, Z0 + 2.0], g, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }); sunP.renderOrder = 2;
  // ---- the door + a camera dome, lights ----
  cyl(0.12, 0.1, 0.07, std('#14181c'), [0.5, H - 0.04, 3.2], g, { cast: false }, 14); ball(0.1, std('#101418', { roughness: 0.2 }), [0.5, H - 0.1, 3.2], g, { cast: false }, 14);
  // ---- marks ----
  S('door_in', [DX, 0, Z0 + 1.0], 0); S('guard', [-0.75, 0, Z0 + 0.95], 0); S('machine', [MX, 0, MZ + 0.6], 0);
  S('counter', [1.75, 0, ZC], 1.2); S('teller', [3.2, PLAT, ZC], -1.2); S('counter_2', [1.75, 0, WZ[0]], 1.2); S('teller_2', [3.2, PLAT, WZ[0]], -1.2); S('queue', [1.2, 0, ZC + 1.4], 1.2);
  S('hall_a', [-1.5, 0, 1.0], 0); S('hall_b', [0.6, 0, 1.0], 0); S('walk_door', [DX, 0, Z0 + 0.9], 0);
  // cameras (free shots: { from, at, f, who }) in bank-local metres; add the place origin in world space (the composite does it)
  const C = (name, from, atp, f) => { cams[name] = { from: [from[0] + at[0], from[1] + at[1], from[2] + at[2]], at: [atp[0] + at[0], atp[1] + at[1], atp[2] + at[2]], f }; };
  C('hall_from_door', [-3.3, 1.6, -5.9], [0.8, 1.1, 1.5], 24); C('wait_front', [-2.0, 1.25, 1.6], [-2.0, 0.95, -2.3], 40); C('wait_wide', [-1.0, 1.7, 2.6], [-2.2, 1.1, -2.6], 24);
  C('board_front', [-2.0, 1.5, -1.0], [-2.0, 2.4, 6.5], 55); C('board_from_chairs', [-2.0, 1.35, -3.0], [-2.0, 2.0, 6.5], 36); C('machine_guard', [-1.3, 1.25, -1.9], [-1.25, 1.1, -5.6], 46); C('door_in', [-3.0, 1.3, -1.6], [-3.3, 1.1, -5.9], 40);
  C('counter_two', [2.3, 1.45, 5.3], [2.3, 1.15, ZC], 40); C('counter_34', [-0.2, 1.5, 3.6], [2.3, 1.1, ZC], 36); C('slot_close', [1.1, 1.2, 1.9], [2.5, 0.98, ZC], 50); C('sign_q3', [2.0, 1.8, 4.2], [2.0, 2.7, ZC], 60); C('clock', [-2.0, 1.7, 0.2], [-2.0, 2.75, Z0], 50);
  // ---- the fx ----
  const ease = (x) => smooth(clamp(x));
  const update = (t, fx = {}) => {
    // LED number: fx num (a number; rounded) or, when absent, numA. numB = what fx num >= 112 shows anyway.
    const n = fx.num == null || fx.num === 0 ? numA : fx.num, tx = ledTex(n); if (ledMat.map !== tx) { ledMat.map = tx; ledMat.emissiveMap = tx; ledMat.needsUpdate = true; }
    ledMat.emissiveIntensity = 1.35 * (1 - 0.35 * clamp(fx.blink || 0) * (0.5 + 0.5 * Math.sin(t * 5.2)));
    // wall clock: fx clock 0..1 = 14 turns of the minute hand (eased); the second hand 12 x faster, the hour hand 1/12
    const ck = ease(fx.clock || 0) * 14 * Math.PI * 2; hMin.rotation.z = -(ck + 0.6); hHr.rotation.z = -(ck / 12 + 2.4); hSec.rotation.z = -(ck * 8);
    // sun patch slides across the floor and drifts to the east, getting longer and a little redder
    const sk = clamp(fx.sun || 0); sunP.visible = fx.sun !== undefined; sunP.position.set(DX + 0.2 + sk * 6.0, 0.012, Z0 + 2.2 + sk * 0.9); sunP.scale.set(1 + sk * 0.5, 1 + sk * 0.35, 1); sunP.material.opacity = 0.55 * (0.4 + 0.6 * Math.sin(Math.PI * clamp(0.05 + sk * 0.95))); sunP.material.color.set('#ffcf94').lerp(new THREE.Color('#ff9a60'), sk);
    // ticket on the counter (drops and slaps down)
    const tk = clamp(fx.ticket || 0); ticket.visible = tk > 0.01; ticket.position.y = TOP + 0.045 + (1 - ease(tk * 3)) * 0.35; ticket.scale.setScalar(0.9 + 0.1 * ease(tk * 3));
    // the form with its pen: fx form 0..1 = from the teller's tray (x 2.8) through the slot to the customer's side (x 2.15); formBack 0..1 = pulled back to the teller side (x 2.95); stamp 0..1 = stamp down at 0.5; bag 0..1
    const fm = clamp(fx.form || 0), fb = clamp(fx.formBack || 0); formG.visible = fm > 0.005 || fx.formBack > 0.005;
    const fxp = lerp(lerp(2.95, 2.15, ease(fm)), 2.95, ease(fb)); formG.position.set(fxp, TOP + 0.05, ZC + 0.02); formG.rotation.y = 0.5 * Math.PI + 0.06;
    const sp = clamp(fx.stamp || 0), down = Math.sin(Math.PI * clamp(sp * 1.0)), pressK = sp > 0.0 && sp < 1 ? Math.pow(Math.sin(Math.PI * sp), 0.6) : 0; stamper.visible = sp > 0.003 && sp < 0.997;
    stamper.position.set(2.95 - 0.0, TOP + 0.05 + 0.28 * (1 - pressK) + 0.0, ZC + 0.1); stampMark.visible = sp >= 0.5;
    const bk = clamp(fx.bag || 0); bag.visible = bk > 0.005; bag.position.set(lerp(2.95, 2.2, ease(bk)), TOP + 0.045, ZC - 0.3); bag.scale.setScalar(0.5 + 0.1 * ease(bk * 2)); bag.rotation.y = 0.5 * ease(bk);
    // customers in the chairs: seatPlan { wait_2: [{ t, who }, ...] } (+ the walkers); see composite. Nothing here.
  };
  const out = { group: g, seats, cams, update, look: { bloom: [0.18, 0.5, 1.2], env: 0.5, grade: { contrast: 1.04, sat: 1.0, vig: 0.22, grain: 0.012, shadowTint: [0, 0.008, 0.016], hiTint: [0.01, 0.006, 0.0] } }, light: 'gta_bank', lightAt: [0, 0.9, 0], consts: { WZ, ZC, PLAT, TOP, MX, MZ, DX, CZ } };
  return out;
}
