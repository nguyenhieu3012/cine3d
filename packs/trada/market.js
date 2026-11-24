// Trà đá với AI, special "Zombie": a small supermarket (broken glass front, colourful aisles, GIẢM SỐC sign, noodle shelf, charger shelf, a shopping trolley that can carry a seated figure, exit to the street).
// World: the shop front is the plane z = 0. The interior runs back to z = -14 (x -5.5..5.5, ceiling 3.4 m), the street is at z > 0 (pavement to z = 2.8, road beyond, shops across at z = 12).
// The camera outside looks towards -z (the broken entrance); inside, down the main aisle, towards -z; towards +z it sees the exit and the street.
// Options: { time: 'night' (default) | 'grey_morning' (a dim overcast street, the shop still glows) (the street outside), rider: 'teo' (a cast name the trolley carries while fx.ride is on), at: [x, y, z] }.
// fx (acts on 'set'): noodle 0..1 (the noodle shelf is swept into the trolley), charger 0..1 (the hero charger leaves its hook), tx / tz (m) and tyaw (rad): trolley offset from its mark and turn,
// tshake 0..1 (rattle), ride 0..1 (the rider hops into the seat), night 0..1 (the street outside goes from grey morning to night), power 0..1 (lights dim).
import * as THREE from 'three';
import { hash, lerp, smooth, clamp, noise1, fbm1, canvasTex, grain, std, emis, mesh, box, cyl, ball } from '../../core/util.js';
import { LIGHT_PRESETS } from '../../core/stage.js';
import { facadeTex, softDisc, lightPool, makeBike, driftPaper, smokeColumn } from './street.js';

const FONT = (px, w = 900) => `${w} ${px}px Display, sans-serif`;
const PK = ['#d8323a', '#f2b631', '#2f8fd8', '#37a85a', '#f07a2a', '#8a4ac8', '#f2f0e6', '#e0508a', '#27b8c0', '#ffd23f'];

// rows of colourful goods (boxes, bottles, bags) on grey metal shelves; rows = number of shelf levels. empty = the bare shelf back (pegboard) used where a hero item sits
function goodsTex(seed, { rows = 5, cols = 12, empty = false, w = 1024, h = 640 } = {}) {
  return canvasTex(w, h, (c) => {
    c.fillStyle = '#b6bcc2'; c.fillRect(0, 0, w, h); const rh = h / rows, cw = w / cols;
    if (empty) { c.fillStyle = '#9aa2aa'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(40,46,54,0.5)'; for (let y = 14; y < h; y += 26) for (let x = 14; x < w; x += 26) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); } }
    for (let r = 0; r < rows; r++) { const y0 = r * rh, base = y0 + rh - 14;
      if (!empty) for (let k = 0; k < cols; k++) { const hh = hash(seed * 3 + r * 17 + k * 5), col = PK[Math.floor(hash(seed + r * 7 + k * 13) * PK.length)], kind = Math.floor(hh * 3), x = k * cw + cw * 0.12, ww = cw * 0.76;
        const ih = rh * (0.52 + 0.3 * hash(seed + r * 31 + k * 3)); c.fillStyle = col;
        if (kind === 0) { c.fillRect(x, base - ih, ww, ih); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x, base - ih * 0.6, ww, ih * 0.22); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + ww - 8, base - ih, 8, ih); }
        else if (kind === 1) { c.beginPath(); c.roundRect(x + ww * 0.15, base - ih, ww * 0.7, ih, 10); c.fill(); c.fillStyle = '#f2f2ee'; c.fillRect(x + ww * 0.3, base - ih - 12, ww * 0.4, 14); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(x + ww * 0.15, base - ih * 0.62, ww * 0.7, ih * 0.25); }
        else { c.beginPath(); c.moveTo(x, base); c.lineTo(x + ww, base); c.lineTo(x + ww * 0.92, base - ih); c.lineTo(x + ww * 0.08, base - ih); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(x + ww / 2, base - ih * 0.5, ww * 0.2, 0, 7); c.fill(); } }
      c.fillStyle = '#6c737a'; c.fillRect(0, y0 + rh - 14, w, 14); c.fillStyle = '#f2d84a'; for (let k = 0; k < cols; k++) c.fillRect(k * cw + 6, y0 + rh - 12, cw * 0.5, 9); }
    grain(c, w, h, 3000, 0.08, seed, 2);
  });
}
// the red sale sign: starburst + big white text (readable at phone size)
function saleTex(text, w = 1024, h = 420) {
  return canvasTex(w, h, (c) => {
    c.fillStyle = '#c4141f'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff2a35'; c.beginPath(); c.roundRect(14, 14, w - 28, h - 28, 22); c.fill();
    c.strokeStyle = '#ffe04a'; c.lineWidth = 12; c.beginPath(); c.roundRect(22, 22, w - 44, h - 44, 18); c.stroke();
    c.fillStyle = 'rgba(255,224,74,0.9)'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; c.beginPath(); c.moveTo(w - 130 + Math.cos(a) * 80, 120 + Math.sin(a) * 80); c.lineTo(w - 130 + Math.cos(a + 0.2) * 40, 120 + Math.sin(a + 0.2) * 40); c.lineTo(w - 130 + Math.cos(a - 0.2) * 40, 120 + Math.sin(a - 0.2) * 40); c.fill(); }
    c.textAlign = 'center'; c.textBaseline = 'middle'; let fs = 230; c.font = FONT(fs); while (c.measureText(text).width > w - 140 && fs > 60) { fs -= 6; c.font = FONT(fs); }
    c.lineWidth = 16; c.strokeStyle = '#7a0a12'; c.lineJoin = 'round'; c.strokeText(text, w / 2, h / 2 + 8); c.fillStyle = '#ffffff'; c.fillText(text, w / 2, h / 2 + 8);
  });
}
// a broken pane: an alpha map with a jagged hole and a few cracks
function brokenPane(seed, w = 512, h = 512, hole = 0.7) {
  return canvasTex(w, h, (c) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'destination-out'; c.beginPath(); const n = 22, cx = w / 2 + (hash(seed) - 0.5) * 80, cy = h * 0.52;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = (0.34 + 0.18 * hash(seed + i * 3.1)) * w * hole * (i % 2 ? 0.7 : 1.15); c.lineTo(cx + Math.cos(a) * r * 1.0, cy + Math.sin(a) * r * 1.15); } c.closePath(); c.fill(); c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.fillStyle = 'rgba(255,255,255,0)'; for (let i = 0; i < 9; i++) { const a = hash(seed + i) * 6.28; c.beginPath(); c.moveTo(cx + Math.cos(a) * w * 0.3, cy + Math.sin(a) * w * 0.3); c.lineTo(cx + Math.cos(a) * w * 0.52, cy + Math.sin(a) * w * 0.52); c.stroke(); } });
}
const packTex = () => canvasTex(128, 192, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8c8c8'; c.fillRect(0, 0, w, 30); c.fillRect(0, h - 22, w, 22); c.fillStyle = '#9a9a9a'; c.beginPath(); c.ellipse(w / 2, 100, 40, 26, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(w / 2, 92, 34, 16, 0, 0, 7); c.fill(); c.fillStyle = '#7a7a7a'; c.fillRect(24, 44, 80, 12); });

export function buildMarket(scene, { time = 'night', rider = null, at = [0, 0, 0], outside = true, sign = 'SIÊU THỊ MINI', gen = false, holder = null } = {}) {
  const g = new THREE.Group(); g.name = 'market'; g.position.set(...at); scene.add(g);
  const baseNight = time === 'night' ? 1 : 0, ZB = -14, XW = 5.5, HC = 3.4;
  // ---- floor: pale vinyl tiles, glossy, a little dirty ----
  const floorT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#343c39'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#3e4743' : '#2d3532'; c.fillRect(i * 128, j * 128, 128, 128); } c.strokeStyle = 'rgba(60,56,48,0.5)'; c.lineWidth = 3; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 128, 0); c.lineTo(i * 128, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 128); c.lineTo(w, i * 128); c.stroke(); } grain(c, w, h, 5000, 0.09, 5, 2.5);
    for (let i = 0; i < 10; i++) { const x = hash(i * 3.7) * w, y = hash(i * 5.1) * h, gr = c.createRadialGradient(x, y, 2, x, y, 40 + hash(i) * 50); gr.addColorStop(0, 'rgba(10,8,6,0.5)'); gr.addColorStop(1, 'rgba(10,8,6,0)'); c.fillStyle = gr; c.fillRect(x - 100, y - 100, 200, 200); } }, { repeat: [XW * 2 / 1.8, -ZB / 1.8] });
  mesh(new THREE.PlaneGeometry(XW * 2, -ZB), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.28, envMapIntensity: 0.8 }), [0, 0.001, ZB / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  // ---- walls, ceiling ----
  const wallM = std('#3a423f', { roughness: 0.9 });
  mesh(new THREE.PlaneGeometry(-ZB, HC), wallM, [-XW, HC / 2, ZB / 2], g, { cast: false, rot: [0, Math.PI / 2, 0] }); mesh(new THREE.PlaneGeometry(-ZB, HC), wallM, [XW, HC / 2, ZB / 2], g, { cast: false, rot: [0, -Math.PI / 2, 0] });
  const fridgeT = canvasTex(1024, 512, (c, w, h) => { c.fillStyle = '#10161c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { const x = 20 + i * 123, dead = [1, 4, 5].includes(i); c.fillStyle = dead ? '#161c20' : '#cfe6ee'; c.fillRect(x, 24, 110, h - 48); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { c.fillStyle = dead ? '#2a3238' : PK[(i * 5 + r * 3 + k * 7) % PK.length]; c.beginPath(); c.roundRect(x + 8 + k * 25, 40 + r * 112 + 22, 18, 74, 5); c.fill(); } c.fillStyle = '#c4141f'; c.fillRect(x, 24, 110, 12); } });
  mesh(new THREE.PlaneGeometry(XW * 2, HC), new THREE.MeshStandardMaterial({ color: '#fff', map: canvasTex(64, 64, (c) => { c.fillStyle = '#2e3432'; c.fillRect(0, 0, 64, 64); }), roughness: 0.9 }), [0, HC / 2, ZB], g, { cast: false });
  mesh(new THREE.PlaneGeometry(XW * 1.6, 1.7), new THREE.MeshStandardMaterial({ map: fridgeT, emissive: '#ffffff', emissiveMap: fridgeT, emissiveIntensity: 0.3, roughness: 0.5 }), [0, 1.0, ZB + 0.02], g, { cast: false });
  mesh(new THREE.PlaneGeometry(XW * 2, -ZB), std('#151817', { roughness: 0.95 }), [0, HC, ZB / 2], g, { cast: false, rot: [Math.PI / 2, 0, 0] });
  // wall shelves (goods on textured planes) along both side walls
  for (const s of [-1, 1]) { const T = goodsTex(s + 5, { rows: 5, cols: 30, w: 2048, h: 640 }); T.wrapS = THREE.RepeatWrapping; T.repeat.set(1, 1);
    mesh(new THREE.PlaneGeometry(11.5, 1.75), new THREE.MeshStandardMaterial({ map: T, roughness: 0.6, emissive: '#fff', emissiveMap: T, emissiveIntensity: 0.13 }), [s * (XW - 0.24), 0.97, -7.6], g, { cast: false, rot: [0, -s * Math.PI / 2, 0] });
    box(0.5, 0.12, 11.6, std('#555c63', { roughness: 0.5, metalness: 0.4 }), [s * (XW - 0.26), 0.06, -7.6], g); box(0.5, 0.05, 11.6, std('#555c63'), [s * (XW - 0.26), 1.86, -7.6], g, { cast: false });
    mesh(new THREE.PlaneGeometry(11.5, 1.2), std('#2c3230', { roughness: 0.8 }), [s * (XW - 0.02), 2.55, -7.6], g, { cast: false, rot: [0, -s * Math.PI / 2, 0] }); }
  // ---- gondolas: two double-sided shelf blocks down the room ----
  const metal = std('#454b52', { roughness: 0.45, metalness: 0.5 }), hero = { noodle: [-5.8, -4.2], charger: [-5.0, -3.2] };
  const gond = (cx, L0, L1, face, seedBase) => { const gg = new THREE.Group(); gg.position.set(cx, 0, 0); g.add(gg); const zc = (L0 + L1) / 2, len = L0 - L1;
    box(0.9, 0.14, len, metal, [0, 0.07, zc], gg); box(0.04, 1.8, len, std('#8a9098', { roughness: 0.5 }), [0, 0.9, zc], gg);
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) box(0.42, 0.025, len, metal, [s * 0.22, 0.18 + k * 0.3 + 0.0, zc], gg, { cast: false });
    for (const z of [L0, L1, (L0 + L1) / 2]) for (const s of [-1, 1]) box(0.04, 1.85, 0.04, metal, [s * 0.42, 0.93, z], gg);
    // goods faces, in three runs so the hero run (noodles / chargers) can have its own back
    const heroRun = cx < 0 ? hero.noodle : hero.charger, runs = [[L0, heroRun[1] + (heroRun[0] - heroRun[1]) * 0 + (heroRun[1] > L1 ? 0 : 0)]];
    const seg = [[L0, heroRun[1]], heroRun, [heroRun[0], L1]];
    seg.forEach(([a, b], i) => { if (a - b <= 0.01) return; const l = a - b; for (const s of [-1, 1]) { const emp = i === 1 && s === face; const T = goodsTex(seedBase + i + (s > 0 ? 7 : 0), { cols: Math.max(2, Math.round(l * 4.2)), empty: emp }); mesh(new THREE.PlaneGeometry(l, 1.5), new THREE.MeshStandardMaterial({ map: T, roughness: 0.6, emissive: '#fff', emissiveMap: T, emissiveIntensity: 0.12 }), [s * 0.2, 0.18 + 0.75, (a + b) / 2], gg, { cast: false, rot: [0, s * Math.PI / 2, 0] }); } });
    // an end-cap with a flyer at the door end, a header board over the aisle face
    return gg; };
  const GL = gond(-2.6, -2.0, -11.5, 1, 3), GR = gond(2.6, -2.0, -11.5, -1, 11);
  // end-cap stacks at the far ends (promo pallets of boxes)
  for (const x of [-2.6, 2.6]) for (let i = 0; i < 6; i++) box(0.34, 0.26, 0.34, std(PK[(i * 3 + (x > 0 ? 4 : 0)) % PK.length], { roughness: 0.6 }), [x - 0.35 + (i % 3) * 0.36, 0.13 + Math.floor(i / 3) * 0.26, -1.7 - (i % 2) * 0.1], g);
  // ---- the noodle shelf: 3-D packs (left gondola, face to the aisle), swept away by fx.noodle ----
  const NR = 5, NC = 10, nN = NR * NC, ptex = packTex(), packG = new THREE.PlaneGeometry(0.15, 0.22);
  const nodl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.22, 0.035), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.5 }), nN), cargo = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.22, 0.035), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.5 }), 34);
  nodl.castShadow = true; cargo.castShadow = true; nodl.frustumCulled = false; cargo.frustumCulled = false; g.add(nodl);
  const ncol = []; for (let i = 0; i < nN; i++) ncol.push(new THREE.Color(['#e03030', '#f2a020', '#f0d020', '#3aa04a', '#e05a20'][Math.floor(hash(i * 1.7) * 5)])); ncol.forEach((c, i) => nodl.setColorAt(i, c)); for (let i = 0; i < 34; i++) cargo.setColorAt(i, ncol[(i * 3) % nN]);
  // header board "MÌ TÔM" over the noodle run
  const hdr = canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#f2c21a'; c.fillRect(0, 0, w, h); c.fillStyle = '#c4141f'; c.fillRect(0, h - 22, w, 22); c.fillStyle = '#c4141f'; c.font = FONT(84); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MÌ TÔM', w / 2, 52); });
  mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshStandardMaterial({ map: hdr, roughness: 0.6, emissive: '#fff', emissiveMap: hdr, emissiveIntensity: 0.25 }), [-2.14, 2.0, -5.0], g, { cast: false, rot: [0, Math.PI / 2, 0] });
  // ---- the charger pegboard (right gondola, face to the aisle): hooks with cards, cables, one hero brick ----
  const chargers = new THREE.Group(); g.add(chargers); let heroCharger = null;
  { const LAB = [['SẠC NHANH', '#1a6fd0', '49K'], ['CÁP USB-C', '#d8323a', '29K'], ['TAI NGHE', '#2a9a5a', '59K'], ['PIN DỰ PHÒNG', '#e08a1a', '129K']];
    const cardT = LAB.map(([txt, col, price], q) => canvasTex(256, 384, (c, w, h) => { c.fillStyle = '#f4f4ee'; c.fillRect(0, 0, w, h); c.fillStyle = col; c.fillRect(0, 0, w, 84); c.fillStyle = '#fff'; c.font = FONT(36); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, 44, 230);
      c.fillStyle = '#d8dadd'; c.beginPath(); c.roundRect(60, 110, 136, 150, 14); c.fill(); c.fillStyle = '#fff'; if (q === 0) { c.fillRect(86, 130, 84, 100); c.fillStyle = '#9aa0a8'; c.fillRect(104, 110, 14, 22); c.fillRect(138, 110, 14, 22); } else if (q === 1) { c.strokeStyle = '#fff'; c.lineWidth = 12; c.beginPath(); c.arc(128, 200, 46, 0.3, 5.6); c.stroke(); } else if (q === 2) { c.beginPath(); c.arc(100, 190, 28, 0, 7); c.arc(156, 190, 28, 0, 7); c.fill(); } else { c.fillRect(80, 150, 96, 80); c.fillStyle = '#46d870'; c.fillRect(90, 160, 50, 12); }
      c.fillStyle = '#c4141f'; c.beginPath(); c.arc(206, 300, 40, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = FONT(34); c.fillText(price, 206, 302, 70); c.fillStyle = '#555'; c.font = FONT(26, 700); c.textAlign = 'left'; c.fillText('Hàng chính hãng', 20, 350); }));
    for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) { const x = 2.2, y = 0.5 + r * 0.31, z = -3.3 - 0.2 * k, q = (r + k) % 4, c = new THREE.Group(); c.position.set(x + 0.02, y, z - 0.1); chargers.add(c); box(0.01, 0.23, 0.15, std('#f4f4ee', { roughness: 0.5 }), [0.004, 0, 0], c);
      mesh(new THREE.PlaneGeometry(0.15, 0.225), new THREE.MeshStandardMaterial({ map: cardT[q], roughness: 0.5, emissive: '#fff', emissiveMap: cardT[q], emissiveIntensity: 0.18 }), [-0.0014, 0, 0], c, { cast: false, rot: [0, -Math.PI / 2, 0] }); }
    heroCharger = new THREE.Group(); heroCharger.position.set(2.16, 1.58, -4.1); chargers.add(heroCharger);
    box(0.045, 0.16, 0.1, std('#f6f6f2', { roughness: 0.35 }), [0, 0, 0], heroCharger); box(0.015, 0.045, 0.03, std('#b8bcc2', { metalness: 0.8, roughness: 0.3 }), [0.03, 0.06, 0.02], heroCharger); box(0.015, 0.045, 0.03, std('#b8bcc2', { metalness: 0.8, roughness: 0.3 }), [0.03, 0.06, -0.02], heroCharger);
    box(0.012, 0.09, 0.14, std('#f2c21a', { roughness: 0.5 }), [-0.03, -0.02, 0], heroCharger); }
  const hdr2 = canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#1a6fd0'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = FONT(72); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PHỤ KIỆN · SẠC', w / 2, 66, 480); });
  mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshStandardMaterial({ map: hdr2, roughness: 0.6, emissive: '#fff', emissiveMap: hdr2, emissiveIntensity: 0.25 }), [2.14, 2.0, -4.1], g, { cast: false, rot: [0, -Math.PI / 2, 0] });
  // ---- sale signs: one hanging over the main aisle (both faces), one on the end of the left gondola (hero close-up) ----
  const sale = saleTex('GIẢM SỐC'), saleM = new THREE.MeshStandardMaterial({ map: sale, roughness: 0.55, emissive: '#ffffff', emissiveMap: sale, emissiveIntensity: 0.95, side: THREE.DoubleSide });
  const hang = new THREE.Group(); hang.position.set(0, 2.55, -7.2); g.add(hang); mesh(new THREE.PlaneGeometry(2.0, 0.82), saleM, [0, 0, 0], hang, { cast: false }); for (const x of [-0.8, 0.8]) cyl(0.006, 0.006, 0.85, std('#222'), [x, 0.64, 0], hang, { cast: false }, 5);
  const sGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: '#ff2a2a', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); sGlow.scale.set(3.4, 1.8, 1); sGlow.position.set(0, 2.55, -7.25); g.add(sGlow);
  const endSign = new THREE.Group(); endSign.position.set(-2.6, 1.98, -1.93); g.add(endSign); mesh(new THREE.PlaneGeometry(0.9, 0.37), saleM, [0, 0, 0], endSign, { cast: false }); box(0.02, 0.5, 0.02, metal, [0, -0.38, -0.04], endSign);
  // ---- ceiling: 20 tubes, about half of them dead; the live ones are cold and each breathes on its own slow wave (a rare deep dip); four real lights sit under live tubes: pools of light, dark aisles between ----
  const ALIVE = new Set([2, 4, 6, 9, 10, 12, 13, 16, 17, 19]), tubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.04, 1.3), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 20); tubes.frustumCulled = false; g.add(tubes);
  const tm = new THREE.Matrix4(), tcol = new THREE.Color(); { let i = 0; for (const x of [-3.9, -1.3, 1.3, 3.9]) for (let k = 0; k < 5; k++) { tm.makeTranslation(x, HC - 0.04, -1.8 - k * 2.5); tubes.setMatrixAt(i, tm); tubes.setColorAt(i, tcol.set('#dff0ff')); i++; } }
  const lampDef = [[6, -1.3, -4.3, 11], [9, -1.3, -11.8, 6], [10, 1.3, -1.8, 8], [12, 1.3, -6.8, 10], [13, 1.3, -9.3, 8], [2, -3.9, -6.8, 5]];   // [tube index, x, z, candela]
  const lamps = lampDef.map(([i, x, z, k]) => { const l = new THREE.PointLight('#cfe4ff', k, 8, 2); l.position.set(x, HC - 0.9, z); g.add(l); l.userData = { i, k }; return l; });
  const tubeW = (t, i) => { const dying = i === 9 || i === 4 ? 1 : 0, base = 0.82 + 0.14 * noise1(t * 0.5 + i * 3.7, 2), dip = Math.pow(Math.max(0, noise1(t * (0.23 + 0.2 * dying) + i * 1.9, 6)), dying ? 1.5 : 2.5); return Math.max(0.05, base - (dying ? 0.85 : 0.6) * dip); };
  // ---- checkout counter ----
  const co = new THREE.Group(); co.position.set(3.7, 0, -2.5); g.add(co); box(2.2, 0.9, 0.7, std('#2f8a9a', { roughness: 0.5 }), [0, 0.45, 0], co); box(2.24, 0.05, 0.74, std('#d6d8dc', { roughness: 0.3 }), [0, 0.92, 0], co); box(1.1, 0.03, 0.46, std('#1a1a1e', { roughness: 0.7 }), [-0.4, 0.955, 0], co);
  box(0.34, 0.26, 0.3, std('#2a2a30', { roughness: 0.4 }), [0.7, 1.08, -0.1], co); const scr = box(0.3, 0.2, 0.01, emis('#7ee8ff', 0.8), [0.7, 1.12, 0.06], co, { cast: false }); scr.rotation.x = -0.2;
  for (let i = 0; i < 4; i++) box(0.34, 0.2, 0.24, std(['#d8323a', '#2f8fd8', '#f2b631', '#37a85a'][i], { roughness: 0.6 }), [0.95, 0.35 + 0.0, 0.52], co).position.y = 0.1 + i * 0.0;
  // ---- the storefront (z = 0): a lit sign band, aluminium frames, four broken panes, glass on the ground ----
  const frontT = canvasTex(1024, 256, (c, w, h) => { c.fillStyle = '#1a6fd0'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = FONT(110); c.textAlign = 'center'; c.textBaseline = 'middle'; { let fs = 110; c.font = FONT(fs); while (c.measureText(sign).width > w - 40 && fs > 40) { fs -= 4; c.font = FONT(fs); } c.fillText(sign, w / 2, 128); } });
  const signM = new THREE.MeshStandardMaterial({ map: frontT, roughness: 0.7, emissive: '#fff', emissiveMap: frontT, emissiveIntensity: 0.45 }); mesh(new THREE.PlaneGeometry(2 * XW + 4, 0.86), std('#1a6fd0', { roughness: 0.7 }), [0, HC + 0.35, 0.065], g, { cast: false }); mesh(new THREE.PlaneGeometry(5.2, 0.86 * 1.3), signM, [0, HC + 0.38, 0.07], g, { cast: false });
  box(2 * XW + 4, 1.7, 0.2, std('#d8d4c6', { roughness: 0.9 }), [0, HC + 0.1, -0.05], g, { cast: false }); box(2 * XW + 4, 0.3, 0.16, std('#9aa0a6', { roughness: 0.7 }), [0, 0.15, 0.0], g, { cast: false });
  const alu = std('#aab1b8', { roughness: 0.35, metalness: 0.75 }), panes = [[-3.6, 3.8], [-1.0, 1.6], [1.0, 1.6], [3.6, 3.8]], GH = 2.5;
  panes.forEach(([x, w], i) => { const hole = i % 3 === 0 ? 0.85 : 1.15; const am = brokenPane(i * 3 + 1, 1024, 1024, hole);
    mesh(new THREE.PlaneGeometry(w, GH), new THREE.MeshPhysicalMaterial({ color: '#cfe4ff', transparent: true, opacity: 0.38, roughness: 0.05, clearcoat: 1, alphaMap: am, side: THREE.DoubleSide, depthWrite: false }), [x, 0.3 + GH / 2, 0.02], g, { cast: false });
    box(0.07, GH, 0.08, alu, [x - w / 2, 0.3 + GH / 2, 0.02], g); box(w, 0.07, 0.08, alu, [x, 0.3 + GH, 0.02], g); box(w, 0.07, 0.08, alu, [x, 0.33, 0.02], g); });
  box(0.07, GH, 0.08, alu, [XW, 0.3 + GH / 2, 0.02], g);
  // the entrance: green exit sign (self-explanatory), a floor mat, pushed-open door leaf
  const exitT = canvasTex(512, 160, (c, w, h) => { c.fillStyle = '#0f7a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = FONT(88); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LỐI RA', 190, 82); c.beginPath(); c.moveTo(380, 80); c.lineTo(440, 80); c.lineTo(440, 50); c.lineTo(500, 82); c.lineTo(440, 114); c.lineTo(440, 84); c.lineTo(380, 84); c.fill(); });
  const exitS = mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshBasicMaterial({ map: exitT, toneMapped: false }), [0, 2.95, -0.1], g, { cast: false }); exitS.material.color.setScalar(1.05);
  mesh(new THREE.PlaneGeometry(2.0, 1.2), std('#2a2a30', { roughness: 0.95 }), [0, 0.004, -0.5], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const door = new THREE.Group(); door.position.set(-1.45, 0, 0.1); door.rotation.y = -1.1; g.add(door); box(0.05, 2.2, 0.06, alu, [0, 1.2, 0], door); box(0.8, 0.05, 0.06, alu, [0.4, 2.3, 0], door); box(0.8, 0.05, 0.06, alu, [0.4, 0.3, 0], door);
  // glass on the ground inside and outside the entrance (thin sparkling shards, fixed)
  const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.03, 0), new THREE.MeshPhysicalMaterial({ color: '#dff0ff', transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, flatShading: true })); const shards = new THREE.InstancedMesh(shard.geometry, shard.material, 120); const sm = new THREE.Matrix4(), sq = new THREE.Quaternion(), se = new THREE.Euler();
  for (let i = 0; i < 120; i++) { const x = (hash(i * 2.3) - 0.5) * 7.4, z = 1.3 - hash(i * 4.7) * 3.6; se.set(hash(i) * 6, hash(i * 3) * 6, hash(i * 5) * 6); sq.setFromEuler(se); const sc = 0.5 + hash(i * 7) * 1.6; sm.compose(new THREE.Vector3(x, 0.012, z), sq, new THREE.Vector3(sc, sc * 0.35, sc)); shards.setMatrixAt(i, sm); } shards.castShadow = false; g.add(shards);
  // debris inside: fallen goods, a tipped basket, spilled drink
  for (let i = 0; i < 46; i++) { const s = 0.07 + hash(i * 1.3) * 0.12, x = (hash(i * 2.7) - 0.5) * 4.6, z = -1.0 - hash(i * 3.9) * 12; box(s, s * 1.4, s * 0.6, std(PK[i % PK.length], { roughness: 0.6 }), [x, s * 0.35, z], g, { rot: [hash(i) * 3, hash(i * 3) * 6, hash(i * 5) * 3] }); }
  for (let i = 0; i < 34; i++) { const x = (hash(i * 3.3 + 1) - 0.5) * 8, z = -0.8 - hash(i * 5.1 + 2) * 12.5, r = 0.035 + hash(i * 7) * 0.02; cyl(r, r, 0.12, std(PK[(i * 3) % PK.length], { roughness: 0.4, metalness: 0.4 }), [x, r, z], g, { rot: [Math.PI / 2, 0, hash(i) * 6] }, 10); }
  for (let i = 0; i < 7; i++) { const x = (hash(i * 4.1 + 9) - 0.5) * 7, z = -1.5 - hash(i * 6.3 + 4) * 11, bk = new THREE.Group(); bk.position.set(x, 0.17, z); bk.rotation.set((hash(i) - 0.5) * 0.4, hash(i * 3) * 6, 2.6 + hash(i * 5) * 0.9); g.add(bk); const bc = std(i % 2 ? '#c4283a' : '#2a6ac0', { roughness: 0.55 }); box(0.42, 0.02, 0.28, bc, [0, -0.1, 0], bk); box(0.42, 0.2, 0.02, bc, [0, 0, 0.14], bk); box(0.42, 0.2, 0.02, bc, [0, 0, -0.14], bk); box(0.02, 0.2, 0.28, bc, [0.21, 0, 0], bk); box(0.02, 0.2, 0.28, bc, [-0.21, 0, 0], bk); }
  for (const [x, z, r] of [[-1.0, -6.2, 0.5], [1.5, -10.4, 0.42], [0.2, -3.0, 0.36], [-0.4, -8.8, 0.3]]) mesh(new THREE.CircleGeometry(r * 0.7, 24), new THREE.MeshStandardMaterial({ color: '#1a2226', roughness: 0.2, metalness: 0.0, envMapIntensity: 0.5 }), [x, 0.004, z], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }).scale.y = 1.6;
  for (const [x, z, c] of [[1.2, -9, '#d8323a'], [-1.4, -3.2, '#2f8fd8']]) { const b = new THREE.Group(); b.position.set(x, 0.12, z); b.rotation.set(0.5, hash(x) * 6, 0.8); g.add(b); box(0.4, 0.2, 0.28, std(c, { roughness: 0.6 }), [0, 0, 0], b); }
  // ---- the street outside: pavement, road, shops across, lamps, a tipped bike, paper; it can go from grey morning to night (fx.night). outside: false = the shop front and interior only (the block's street is built elsewhere) ----
  let frontLs = []; let facMats = [], skyM = null, lampG = [], papers = null, smoke = null;
  if (outside) {
  mesh(new THREE.PlaneGeometry(60, 3.0), std('#4a4842', { roughness: 0.85 }), [0, 0.0, 1.5], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }); box(60, 0.14, 0.2, std('#8a8a86', { roughness: 0.85 }), [0, 0.07, 3.05], g);
  const asph = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#1c1e24'; c.fillRect(0, 0, w, h); grain(c, w, h, 6000, 0.08, 4, 1.6); }, { repeat: [20, 3] });
  mesh(new THREE.PlaneGeometry(60, 9.6), new THREE.MeshStandardMaterial({ map: asph, roughness: 0.82 }), [0, 0, 7.8], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const fac = []; for (let i = 0; i < 4; i++) fac.push(facadeTex(i + 20, { hue: [28, 200, 12, 150][i], ground: ['shutter', 'glass', 'shutter', 'door'][i], lit: 0.3 }));
  for (let i = 0; i < 9; i++) { const [map, em] = fac[i % 4], m = new THREE.MeshStandardMaterial({ map, emissive: '#fff', emissiveMap: em, emissiveIntensity: 0, roughness: 0.92 }); facMats.push(m); mesh(new THREE.PlaneGeometry(5, 10), m, [-20 + i * 5, 5, 12.5], g, { cast: false, rot: [0, Math.PI, 0] }); }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const [map, em] = fac[(i + 1) % 4], m = new THREE.MeshStandardMaterial({ map, emissive: '#fff', emissiveMap: em, emissiveIntensity: 0, roughness: 0.92 }); facMats.push(m); mesh(new THREE.PlaneGeometry(5, 10), m, [s * (XW + 2.5 + i * 5), 5, 0.02], g, { cast: false }); }
  const skyT = canvasTex(8, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(1, '#ffffff'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  skyM = new THREE.MeshBasicMaterial({ map: skyT, color: '#b8bcc0', side: THREE.BackSide, fog: false, depthWrite: false }); mesh(new THREE.SphereGeometry(80, 16, 12), skyM, [0, 0, 0], g, { cast: false, recv: false });
  for (const x of [-3.5, 4.0]) { const L = new THREE.Group(); L.position.set(x, 0, 3.4); g.add(L); cyl(0.045, 0.07, 5.0, std('#4a4f58', { metalness: 0.5, roughness: 0.6 }), [0, 2.5, 0], L, {}, 8); box(0.8, 0.05, 0.08, std('#4a4f58'), [0, 5.0, -0.4], L); const hd = box(0.32, 0.07, 0.2, emis('#ffb868', 3), [0, 4.95, -0.8], L, { cast: false }); const pool = lightPool(g, [x, 0.02, 2.5], 3.4, '#ff9a48', 0.0); lampG.push([hd, pool]); }
  const bk = makeBike('#b3272c', 1); bk.position.set(2.6, 0.14, 4.4); bk.rotation.y = 2.3; g.add(bk); const bk2 = makeBike('#2a5aa8', 1); bk2.position.set(-3.6, 0.14, 2.0); bk2.rotation.y = 0.4; g.add(bk2);
  papers = driftPaper(g, { n: 24, box: [-4, 4, 0.15, 1.8, -0.5, 6], wind: [0.3, 0.6], seed: 2, color: '#d0d2d6' }); smoke = smokeColumn(g, { pos: [-4, 0, 16], n: 10, h: 12, w: 4, color: '#6a6e76', op: 0.4, period: 32, seed: 5 });
  }
  if (!outside) { const fl = [[0, 2.7, -1.4, 16], [-2.6, 2.4, -3.2, 9], [2.6, 2.4, -3.2, 9]].map(([x, y, z, k]) => { const l = new THREE.PointLight('#cfe4ff', k, 7, 2); l.position.set(x, y, z); g.add(l); return [l, k]; }); frontLs = fl; }
  const glowL = new THREE.PointLight('#a8c8ff', 8, 11, 2); glowL.position.set(0, 2.2, 2.4); g.add(glowL); const glowPool = lightPool(g, [0, 0.03, 3.6], 2.8, '#8fb8ff', 0.28);
  // ---- the trolley ----
  const cart = new THREE.Group(); g.add(cart); const cm = std('#c4cad0', { roughness: 0.28, metalness: 0.85 }), plastic = std('#d8323a', { roughness: 0.5 }), wheels = [];
  for (const x of [-0.26, 0.26]) box(0.025, 0.025, 0.9, cm, [x, 0.16, 0.0], cart); for (const z of [-0.38, 0.38]) box(0.52, 0.025, 0.025, cm, [0, 0.16, z], cart); for (const x of [-0.26, 0.26]) for (const z of [-0.38, 0.38]) box(0.02, 0.24, 0.02, cm, [x, 0.28, z], cart);
  for (const x of [-0.27, 0.27]) for (const z of [-0.38, 0.38]) { const w = cyl(0.07, 0.07, 0.035, std('#1a1a1e', { roughness: 0.7 }), [x, 0.07, z], cart, {}, 14); w.rotation.z = Math.PI / 2; wheels.push(w); }
  for (let i = 0; i < 9; i++) box(0.006, 0.006, 0.92, cm, [-0.25 + i * 0.0625, 0.4, 0.0], cart); for (let i = 0; i < 12; i++) box(0.5, 0.006, 0.006, cm, [0, 0.4, -0.44 + i * 0.08], cart);
  for (const s of [-1, 1]) { for (let k = 1; k <= 5; k++) box(0.006, 0.006, 0.92, cm, [s * (0.25 + k * 0.012), 0.4 + k * 0.095, 0], cart); for (let i = 0; i < 12; i++) box(0.006, 0.5, 0.006, cm, [s * 0.29, 0.65, -0.44 + i * 0.08], cart); }
  for (let k = 1; k <= 5; k++) box(0.6, 0.006, 0.006, cm, [0, 0.4 + k * 0.095, 0.45], cart); for (let i = 0; i < 8; i++) box(0.006, 0.5, 0.006, cm, [-0.28 + i * 0.08, 0.65, 0.45], cart);
  box(0.64, 0.03, 0.03, plastic, [0, 0.98, -0.5], cart); for (const s of [-1, 1]) box(0.025, 0.55, 0.025, cm, [s * 0.3, 0.7, -0.5], cart, { rot: [0.1, 0, 0] });
  box(0.5, 0.02, 0.3, plastic, [0, 0.66, -0.26], cart);   // the child seat flap: the rider sits on it
  cart.add(cargo);
  // ---- Zombie block extras: a QR sticker on the charger shelf and a wall socket with a green LED beside it (the generator feeds the shop), the generator by the door (gen: true), the trolley's handle anchor ----
  const qrStick = canvasTex(256, 320, (c, w, h) => { c.fillStyle = '#fbfbf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#c4272f'; c.fillRect(0, 0, w, 58); c.fillStyle = '#fff'; c.font = FONT(30); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('QUÉT MÃ TRẢ TIỀN', w / 2, 32, 236);
    const N = 21, q = (w - 56) / N, ox = 28, oy = 76, on = (i, j) => { for (const [a, b] of [[0, 0], [N - 7, 0], [0, N - 7]]) { if (i >= a && i < a + 7 && j >= b && j < b + 7) { const d = Math.max(Math.abs(i - a - 3), Math.abs(j - b - 3)); return d === 3 || d <= 1; } if (i >= a - 1 && i <= a + 7 && j >= b - 1 && j <= b + 7) return false; } return hash(i * 11 + j * 23 + 9) > 0.5; };
    c.fillStyle = '#111'; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (on(i, j)) c.fillRect(ox + i * q, oy + j * q, q + 0.6, q + 0.6); });
  mesh(new THREE.PlaneGeometry(0.15, 0.19), new THREE.MeshStandardMaterial({ map: qrStick, roughness: 0.7, emissive: '#fff', emissiveMap: qrStick, emissiveIntensity: 0.25 }), [2.158, 1.58, -4.55], g, { cast: false, rot: [0, -Math.PI / 2, 0] });
  { const so = new THREE.Group(); so.position.set(2.155, 1.0, -5.3); g.add(so); box(0.014, 0.13, 0.13, std('#f2f0ea', { roughness: 0.5 }), [0, 0, 0], so, { cast: false });
    for (const dz of [-0.025, 0.025]) { box(0.016, 0.04, 0.008, std('#15151a'), [-0.002, 0.012, dz], so, { cast: false }); } box(0.016, 0.012, 0.012, std('#15151a'), [-0.002, -0.025, 0], so, { cast: false });
    box(0.012, 0.014, 0.014, emis('#46ff7a', 3.2), [-0.004, 0.05, 0.045], so, { cast: false }); const sl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: '#5aff8a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); sl.scale.set(0.12, 0.12, 1); sl.position.set(-0.03, 0.05, 0.045); so.add(sl); }
  let genUpd = null;
  if (gen) {
    const ge = new THREE.Group(); ge.position.set(1.9, 0, 1.15); ge.rotation.y = -0.3; g.add(ge); const body = new THREE.Group(); ge.add(body);
    const dark = std('#1c1d22', { roughness: 0.5, metalness: 0.4 }), orange = std('#d2561c', { roughness: 0.5 }), steel = std('#8a9098', { roughness: 0.35, metalness: 0.8 });
    for (const [x, z] of [[-0.4, -0.22], [0.4, -0.22], [-0.4, 0.22], [0.4, 0.22]]) box(0.04, 0.3, 0.04, dark, [x, 0.15, z], body); box(0.9, 0.04, 0.56, dark, [0, 0.3, 0], body); box(0.9, 0.04, 0.56, dark, [0, 0.74, 0], body);
    box(0.78, 0.4, 0.5, orange, [0, 0.52, 0], body); cyl(0.12, 0.12, 0.62, std('#c4141f', { roughness: 0.4 }), [0, 0.88, 0.0], body, { rot: [0, 0, Math.PI / 2] }, 14); box(0.3, 0.2, 0.012, dark, [0.22, 0.54, 0.256], body, { cast: false });
    box(0.5, 0.24, 0.01, emis('#ff9a3a', 2.4), [-0.12, 0.5, 0.254], body, { cast: false }); for (const x of [0.15, 0.3]) ball(0.012, emis(x < 0.2 ? '#46ff7a' : '#ff3a2a', 3), [x, 0.6, 0.264], body, { cast: false }, 8);
    const ex = new THREE.Group(); ex.position.set(-0.3, 0.76, -0.12); body.add(ex); cyl(0.07, 0.07, 0.3, steel, [0, 0.12, 0], ex, {}, 12); cyl(0.025, 0.025, 0.55, steel, [0, 0.4, 0], ex, {}, 8); cyl(0.032, 0.025, 0.06, dark, [0, 0.7, 0], ex, {}, 8);
    const gl = new THREE.PointLight('#ffa840', 5, 4.5, 2); gl.position.set(0, 0.55, 0.6); ge.add(gl); const gh = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: '#ff9a3a', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); gh.scale.set(1.5, 1.2, 1); gh.position.set(0, 0.5, 0.35); ge.add(gh);
    const gsm = smokeColumn(ge, { pos: [-0.3, 1.5, -0.12], n: 8, h: 2.2, w: 0.38, color: '#8a8e96', op: 0.34, period: 4.2, seed: 3, drift: [0.4, 0.1] });
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.4, 0.32, 0.2), new THREE.Vector3(0.3, 0.02, 0.5), new THREE.Vector3(-0.8, 0.02, 0.1), new THREE.Vector3(-1.5, 0.02, -0.2), new THREE.Vector3(-1.9, 0.02, -0.7)]), 30, 0.012, 6), std('#1a1a1e', { roughness: 0.6 }), [0, 0, 0], ge, { cast: false });
    genUpd = (t) => { body.position.set(0.0022 * Math.sin(t * 69), 0.0016 * Math.sin(t * 83 + 1), 0); body.rotation.z = 0.004 * Math.sin(t * 61 + 2); ex.rotation.z = 0.03 * Math.sin(t * 52); gl.intensity = 5 * (0.9 + 0.1 * Math.sin(t * 3.1) * Math.sin(t * 1.7)); gh.material.opacity = 0.32 * (0.9 + 0.1 * Math.sin(t * 3.1)); gsm.update(t, 1); };
  }
  const handleA = new THREE.Object3D(); handleA.name = 'handle'; handleA.position.set(0, 0.98, -0.5); cart.add(handleA);
  const worldYaw = (o) => new THREE.Euler().setFromRotationMatrix(o.matrixWorld, 'YXZ').y; const holdW = new THREE.Vector3(); let holderHome = null; const holderRoot = () => (holder ? scene.getObjectByName(holder) : null);

  // ---- marks (world) ----
  const seats = {
    door: { pos: [0 + at[0], at[1], 0.9 + at[2]], yaw: Math.PI },                               // the threshold, facing into the shop (yaw 0 = facing the street)
    aisle_a: { pos: [-0.55 + at[0], at[1], -4.5 + at[2]], yaw: Math.PI }, aisle_b: { pos: [0.55 + at[0], at[1], -4.5 + at[2]], yaw: Math.PI },     // two walking abreast down the main aisle, facing the back wall (yaw 0 = walking towards the door)
    noodle: { pos: [-1.5 + at[0], at[1], -5.0 + at[2]], yaw: -Math.PI / 2 }, charger: { pos: [1.5 + at[0], at[1], -4.1 + at[2]], yaw: Math.PI / 2 },   // in front of the noodle shelf (left) / the charger pegboard (right), facing it
    checkout: { pos: [3.7 + at[0], at[1], -1.5 + at[2]], yaw: Math.PI },                       // in front of the counter, facing it
    trolley: { pos: [0 + at[0], at[1], -7.0 + at[2]], yaw: 0 },                                // where the trolley starts; it faces the exit (+z), the handle is at its -z end
    push: { pos: [0 + at[0], at[1], -8.05 + at[2]], yaw: 0 },                                  // the one pushing, behind the handle (move him with the same fx as the trolley)
    outside: { pos: [0 + at[0], at[1], 6.0 + at[2]], yaw: 0 }, street_a: { pos: [-0.6 + at[0], at[1], 6.0 + at[2]], yaw: 0 }, street_b: { pos: [0.6 + at[0], at[1], 6.0 + at[2]], yaw: 0 },   // on the road outside, facing the street
  };
  // recommended free camera shots ({ from, at, f }): paste into a shot as `cam: 'free', free: {...}`
  const cams = {
    entrance_out: { from: [0.5, 1.25, 7.6], at: [0, 1.25, 0], f: 28 }, aisle_down: { from: [0, 1.3, 1.6], at: [0, 1.2, -9], f: 24 }, sign_close: { from: [-1.1, 1.8, -0.2], at: [-2.6, 1.98, -1.93], f: 55 },
    noodle_close: { from: [-0.7, 1.0, -5.0], at: [-2.2, 0.8, -5.0], f: 40 }, charger_close: { from: [0.7, 1.4, -4.1], at: [2.2, 1.4, -4.1], f: 45 }, trolley_low: { from: [-1.2, 0.45, -3.8], at: [0, 0.8, -7], f: 30 }, exit_in: { from: [0, 0.9, -5.0], at: [0, 1.0, 4], f: 26 },
  };
  const rootOf = () => (rider ? scene.getObjectByName(rider) : null); let riderHome = null;
  const hero0 = heroCharger.position.clone(), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), p4 = new THREE.Vector3(), s4 = new THREE.Vector3();
  const cartPos = new THREE.Vector3(), seatW = new THREE.Vector3(), lightB = new THREE.Vector3(at[0], at[1] + 0.8, at[2] - 4); let rigRef = null;
  return {
    group: g, anchors: { handle: handleA, cart }, light: 'market', lightAt: [at[0], at[1] + 0.8, -4 + at[2]], seats, cams, hero: { noodle: hero.noodle, charger: hero.charger },
    look: { exposure: 1.0, bloom: [0.3, 0.6, 1.0], env: 0.16, grade: { contrast: 1.14, sat: 1.12, vig: 0.4, grain: 0.014, shadowTint: [0.0, 0.012, 0.034], hiTint: [0.0, 0.012, 0.03] } },
    tune(l) { if (!l?.key) return; rigRef = l; l.key.angle = 0.7; l.key.penumbra = 1; l.rim.angle = 0.8; l.kick.angle = 0.8; },
    update(t, fx = {}) {
      const nz = clamp(fx.noodle || 0), night = Math.max(baseNight, fx.night || 0), power = 1 - 0.55 * (fx.power || 0);
      // noodles: rows of packs on the shelf; the shelf is cleared from the top row down and from the far end, the trolley cargo fills up in step
      let ci = 0; for (let r = 0; r < NR; r++) for (let k = 0; k < NC; k++) { const i = r * NC + k, order = (NR - 1 - r) * 0.12 + k * 0.045, sw = smooth((nz * 1.45 - order) / 0.22), z = lerp(-5.75, -4.25, k / (NC - 1)); e4.set(0, Math.PI / 2 + (hash(i) - 0.5) * 0.08, (hash(i * 3) - 0.5) * 0.06); q4.setFromEuler(e4);
        p4.set(-2.33 - sw * 0.05, 0.18 + r * 0.3 + 0.11, z); s4.setScalar(1 - sw); m4.compose(p4, q4, s4); nodl.setMatrixAt(i, m4);
        if (r >= 1 && ci < 34 && (k % 3 !== 2)) { const cj = ci++, cw = smooth((nz * 1.45 - order) / 0.22), col = cj % 3, row = Math.floor(cj / 3) % 5, lay = Math.floor(cj / 15); e4.set(0.15 * (hash(cj) - 0.5), hash(cj * 3) * 6, 0.35 * (hash(cj + 4) - 0.5)); q4.setFromEuler(e4); p4.set(-0.17 + col * 0.17 + (hash(cj * 2) - 0.5) * 0.04, 0.41 + 0.12 + lay * 0.2, 0.0 + row * 0.085); s4.setScalar(cw); m4.compose(p4, q4, s4); cargo.setMatrixAt(cj, m4); } }
      for (let i = ci; i < 34; i++) { m4.compose(p4.set(0, -5, 0), q4.identity(), s4.setScalar(0)); cargo.setMatrixAt(i, m4); } nodl.instanceMatrix.needsUpdate = cargo.instanceMatrix.needsUpdate = true;
      const ch = smooth(fx.charger || 0); heroCharger.position.set(hero0.x - 0.12 * ch, hero0.y + 0.16 * Math.sin(ch * Math.PI) - 0.5 * ch * ch, hero0.z + 0.0); heroCharger.visible = ch < 0.98; heroCharger.rotation.z = ch * 0.8;
      // trolley: mark + (tx, tz), turned by tyaw; the wheels roll with the distance, a soft rattle while it rushes
      const tz = fx.tz || 0, tx = fx.tx || 0, yaw = fx.tyaw || 0, sh = fx.tshake || 0; cart.position.set(seats.trolley.pos[0] - at[0] + tx, 0, seats.trolley.pos[2] - at[2] + tz); cart.rotation.set(0.012 * sh * Math.sin(t * 9), yaw, 0.02 * sh * Math.sin(t * 7.3 + 1)); cart.position.y = 0.012 * sh * (0.5 + 0.5 * Math.sin(t * 8.1));
      wheels.forEach((w, i) => { w.rotation.x = (tz + tx) / 0.07; });
      // rider hops from where it stands to the seat while fx.ride goes 0 -> 1, then stays glued to the trolley
      const r = rootOf(); if (r) { const hm = r.userData.zbHome || (riderHome ??= { p: r.position.clone(), y: r.rotation.y }); const k = smooth(fx.ride || 0); cart.updateWorldMatrix(true, false); seatW.set(0, 0.2, -0.24).applyMatrix4(cart.matrixWorld); const up = Math.sin(k * Math.PI) * 0.4;
        r.position.copy(hm.p).lerp(seatW, k); r.position.y += up; r.rotation.y = lerp(hm.y, worldYaw(cart), k); }
      // the holder (somebody gripping the handle and dragged behind): fx hold 0..1 puts him behind the handle (fx drag 0..1 lets him trail further back)
      const hr = holderRoot(); if (hr) { const hh = hr.userData.zbHome || (holderHome ??= { p: hr.position.clone(), y: hr.rotation.y }), hk = smooth(fx.hold || 0); cart.updateWorldMatrix(true, false); holdW.set(0, 0, -0.98 - 0.55 * (fx.drag || 0)).applyMatrix4(cart.matrixWorld); hr.position.copy(hh.p).lerp(holdW, hk); hr.rotation.y = lerp(hh.y, worldYaw(cart), hk); }
      genUpd?.(t);
      // lights: each tube on its own slow wave (a rare soft dip), the real lights follow; the outside street changes with night
      for (let i = 0; i < 20; i++) { if (ALIVE.has(i)) tcol.set('#c4dcff').multiplyScalar(1.5 * tubeW(t, i) * power); else tcol.set('#2a3036').multiplyScalar(0.5); tubes.setColorAt(i, tcol); } tubes.instanceColor.needsUpdate = true;
      lamps.forEach((l) => { l.intensity = l.userData.k * power * tubeW(t, l.userData.i); });
      if (skyM) { const dayC = new THREE.Color('#5a626a'), nightC = new THREE.Color('#06091a'); skyM.color.copy(dayC).lerp(nightC, night); facMats.forEach((m) => { m.emissiveIntensity = 2.2 * night; m.color.setScalar(lerp(0.62, 0.72, night)); }); }
      glowL.intensity = lerp(8, 9, night) * (0.9 + 0.1 * tubeW(t, 4)); glowPool.material.opacity = lerp(0.2, 0.3, night) * (0.9 + 0.1 * tubeW(t, 4)); lampG.forEach(([hd, pool], i) => { hd.material.emissiveIntensity = (i === 0 ? 3.0 : 0.15) * night + 0.15; pool.material.opacity = (i === 0 ? 0.4 : 0.0) * night; });
      signM.emissiveIntensity = 0.28 + 0.22 * tubeW(t, 3); frontLs.forEach(([l, k], i) => { l.intensity = k * power * (0.9 + 0.1 * tubeW(t, 6 + i)); });
      // the key light (and rim, kick) follows the trolley once it has moved or carries somebody: the aisle is 14 m long and the rig's cone is small
      if (rigRef) { const w = smooth(clamp(Math.max(fx.ride || 0, Math.abs(fx.tz || 0) / 3))); cart.updateWorldMatrix(true, false); cartPos.setFromMatrixPosition(cart.matrixWorld); cartPos.y = at[1] + 0.7; const T = lightB.clone().lerp(cartPos, w), M = LIGHT_PRESETS.market;
        for (const [l, q] of [[rigRef.key, M.key], [rigRef.rim, M.rim], [rigRef.kick, M.kick]]) { l.target.position.copy(T); l.position.set(T.x + q[2][0], q[2][1], T.z + q[2][2]); } }
      if (papers) { papers.update(t, 1); smoke.update(t, lerp(0.8, 1.1, night)); }
    },
  };
}
