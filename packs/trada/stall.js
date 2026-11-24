// Trà đá với AI: the tea stall on a Hanoi street corner at night, as a real 3-D set with practical lights.
// World: camera looks towards -z. Characters sit at z = 0 (Tèo x -0.42, Bíp x +0.42). The shop wall (z = -1.5) is behind Tèo and ends at the
// corner x = 1.25; behind Bíp the side street runs back into the night (depth, bokeh, passing headlights): warm wall vs cool street.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hash, lerp, smooth, noise1, canvasTex, grain, std, emis, mesh, box, cyl, ball, lathe } from '../../core/util.js';
import { contactBlob } from '../../core/rig.js';
import { makeBike, driftPaper, smokeColumn, softDisc } from './street.js';
import { buildStoolRow } from './thanks.js';
import { buildStallPlus } from './stall_plus.js';

const FONT = (px, w = 900) => `${w} ${px}px Display, sans-serif`;

export function buildStall(scene, { sign = 'TRÀ ĐÁ · CÀ PHÊ', day = null, tissue = null, phone = false, card2 = null, post = false, speaker = false, spill = false, abandoned = 0, cold = 0, row = null, block = false, qrcard = false, steadyLights = false, plus = false, menuBrand = null, mailbox = false } = {}) {
  // plus (opt-in, 21/11, packs/trada/stall_plus.js): true | { fog, ... } = richer background: surface detail maps, real kettle / thermoses / plant / shutter, street fronts, lamps, wet road, small life (steam, moths, sway, neon, traffic). Off = this file draws exactly what it always drew.
  // row (thank-you special, 13/11, off by default): true | { twice: true, n, z, x0, gap } = a row of red and blue plastic stools with a lit glass of iced tea on each, down the pavement (fx `row` 0..1 on 'set' lights the glasses from the table outwards)
  const g = new THREE.Group(); g.name = 'stall'; scene.add(g);
  const practicals = [], blades = [], CX = 1.25;   // CX = the building corner

  // ---- pavement: Hanoi red brick tiles, slightly wet ----
  const tileC = canvasTex(1024, 1024, (c, w, h) => { c.fillStyle = '#5a241c'; c.fillRect(0, 0, w, h); const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = hash(i * 7 + j * 13); c.fillStyle = `hsl(${9 + k * 8}, ${52 + k * 12}%, ${26 + k * 8}%)`; c.fillRect(i * s + 5, j * s + 5, s - 10, s - 10); c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 3; for (let q = 1; q < 4; q++) { c.beginPath(); c.moveTo(i * s + 5, j * s + q * s / 4); c.lineTo(i * s + s - 5, j * s + q * s / 4); c.stroke(); c.beginPath(); c.moveTo(i * s + q * s / 4, j * s + 5); c.lineTo(i * s + q * s / 4, j * s + s - 5); c.stroke(); } } grain(c, w, h, 9000, 0.1, 3, 3); }, { repeat: [9, 9] });
  const tileR = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#909090'; c.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) { const x = hash(i * 3.3) * w, y = hash(i * 9.1) * h, r = 30 + hash(i * 5.7) * 90; const gr = c.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(30,30,30,0.95)'); gr.addColorStop(1, 'rgba(30,30,30,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } grain(c, w, h, 5000, 0.2, 9, 2); }, { srgb: false, repeat: [2.2, 2.2] });
  mesh(new THREE.PlaneGeometry(26, 60), new THREE.MeshStandardMaterial({ map: tileC, roughnessMap: tileR, roughness: 0.8, envMapIntensity: 1.5 }), [-9.6, 0, -18], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }).material.map.repeat.set(10.6, 24.5);
  // the side street: curb, wet asphalt, centre line
  box(0.2, 0.14, block ? 50 : 60, std('#8c8a86', { roughness: 0.85 }), [3.5, 0.07, block ? -23 : -18], g);
  mesh(new THREE.PlaneGeometry(7.2, 60), new THREE.MeshStandardMaterial({ color: '#14151c', roughness: 0.32, roughnessMap: tileR, envMapIntensity: 2 }), [7.1, 0.004, -18], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  for (let i = 0; i < 12; i++) mesh(new THREE.PlaneGeometry(0.12, 1.6), std('#c8c2a8', { roughness: 0.7 }), [7.1, 0.008, 6 - i * 3.6], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  box(0.2, 0.14, block ? 50 : 60, std('#8c8a86', { roughness: 0.85 }), [10.7, 0.07, block ? -23 : -18], g);

  // ---- the shop wall (behind Tèo): ochre plaster over a teal dado ----
  const wallC = canvasTex(2048, 1024, (c, w, h) => { c.fillStyle = '#e39440'; c.fillRect(0, 0, w, h); const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(60,30,10,0.3)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,20,10,0.25)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const x = hash(i * 1.9) * w, y = hash(i * 4.3) * h, r = 60 + hash(i * 7.7) * 200; const q = c.createRadialGradient(x, y, 2, x, y, r); q.addColorStop(0, `rgba(${hash(i) > 0.5 ? '255,230,170' : '90,60,20'},0.10)`); q.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = q; c.fillRect(x - r, y - r, r * 2, r * 2); } c.fillStyle = '#2f8f72'; c.fillRect(0, h * 0.78, w, h * 0.22); c.fillStyle = '#226b56'; c.fillRect(0, h * 0.78, w, 8); for (let i = 0; i < 14; i++) { const x = hash(i * 17.1) * w; c.fillStyle = 'rgba(30,20,10,0.10)'; c.fillRect(x, hash(i * 3.7) * h * 0.4, 5 + hash(i) * 8, h * (0.2 + hash(i * 2.2) * 0.4)); } grain(c, w, h, 26000, 0.07, 5, 3); });
  const WW = CX + 5.2, wallM = std('#8e8e8e', { map: wallC, roughness: 0.94 });
  mesh(new THREE.PlaneGeometry(WW, 4.4), wallM, [CX - WW / 2, 2.2, -1.5], g, { cast: false });
  box(WW + 0.2, 4, 0.3, std('#3a3148', { roughness: 0.95 }), [CX - WW / 2, 6.4, -1.62], g, { cast: false });
  // the corner pier and the side wall running back along the street
  box(0.26, 8.4, 0.26, std('#b89448', { roughness: 0.9 }), [CX - 0.08, 4.2, -1.58], g);
  const sideC = canvasTex(1024, 512, (c, w, h) => { c.fillStyle = '#7a6a48'; c.fillRect(0, 0, w, h); c.fillStyle = '#245a55'; c.fillRect(0, h * 0.8, w, h * 0.2); for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#ffca72' : '#101425'; c.fillRect(70 + i * 190, 40, 110, 150); c.fillStyle = '#3c2f22'; c.fillRect(64 + i * 190, 34, 122, 8); } grain(c, w, h, 9000, 0.09, 4, 3); });
  const sideE = canvasTex(1024, 512, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) if (i % 2) { c.fillStyle = '#ffb860'; c.fillRect(70 + i * 190, 40, 110, 150); } });
  mesh(new THREE.PlaneGeometry(36, 8.4), new THREE.MeshStandardMaterial({ map: sideC, emissive: '#fff', emissiveMap: sideE, emissiveIntensity: 1.3, roughness: 0.95 }), [CX + 0.05, 4.2, -19.5], g, { cast: false, rot: [0, Math.PI / 2, 0] }).material.map.repeat.set(4, 1);
  sideC.wrapS = sideE.wrapS = THREE.RepeatWrapping; sideE.repeat.set(4, 1);
  // a blade sign glowing at the corner, and a second one further down
  const blade = (z, y, txt, col, bg) => { const t = canvasTex(256, 512, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = col; c.font = FONT(120); c.textAlign = 'center'; c.textBaseline = 'middle'; [...txt].forEach((ch, i) => c.fillText(ch, w / 2, 90 + i * 118)); }); const m = box(0.06, 1.1, 0.55, std('#18141c'), [CX + 0.38, y, z], g); m.userData.lg = 'S'; for (const s of [-1, 1]) mesh(new THREE.PlaneGeometry(0.5, 1.04), new THREE.MeshStandardMaterial({ map: t, emissive: '#fff', emissiveMap: t, emissiveIntensity: 1.5 }), [s * 0.032, 0, 0], m, { cast: false, rot: [0, s * Math.PI / 2, 0] }); const l = new THREE.PointLight(col, 1.6, 4, 2); l.userData.lg = 'S'; l.position.set(CX + 0.8, y, z); g.add(l); blades.push({ m, l }); };
  blade(-2.3, 3.0, 'PHỞ', '#ff5a6e', '#2a0a14'); blade(-7.5, 3.3, 'CAFE', '#5ad0ff', '#0a1a2a');

  // rolled steel shutter (far left) + lit window with green shutters
  const shutC = canvasTex(256, 512, (c, w, h) => { for (let y = 0; y < h; y += 16) { const gr = c.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#8d9fb0'); gr.addColorStop(0.5, '#5d7084'); gr.addColorStop(1, '#3d4c5c'); c.fillStyle = gr; c.fillRect(0, y, w, 16); } grain(c, w, h, 2500, 0.1, 7, 2); });
  box(1.5, 2.5, 0.06, std('#ffffff', { map: shutC, roughness: 0.5, metalness: 0.5 }), [-3.15, 1.25, -1.46], g, { cast: false });
  box(1.65, 0.2, 0.12, std('#4a5868', { roughness: 0.6, metalness: 0.4 }), [-3.15, 2.6, -1.44], g);
  const winC = canvasTex(256, 320, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe7a8'); gr.addColorStop(1, '#ffb65a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(120,60,20,0.5)'; c.fillRect(w / 2 - 4, 0, 8, h); c.fillRect(0, h * 0.45, w, 7); c.fillStyle = 'rgba(90,40,20,0.35)'; c.beginPath(); c.arc(w * 0.3, h * 0.82, 38, 0, 7); c.fill(); c.fillRect(w * 0.6, h * 0.6, 50, h * 0.4); });
  const WX = -1.72, WY = 2.12;
  mesh(new THREE.PlaneGeometry(0.72, 0.9), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: winC, emissiveIntensity: 1.5 }), [WX, WY, -1.49], g, { cast: false });
  for (const s of [-1, 1]) { const sh = box(0.36, 0.94, 0.035, std('#2f6b4f', { roughness: 0.8 }), [WX + s * 0.54, WY, -1.44], g, { rot: [0, s * 0.5, 0] }); for (let i = 0; i < 8; i++) box(0.3, 0.012, 0.045, std('#234f3b'), [0, -0.39 + i * 0.11, 0], sh, { cast: false }); }
  box(0.86, 0.05, 0.14, std('#b9b3a4', { roughness: 0.9 }), [WX, WY - 0.48, -1.44], g);

  // ---- signboard over the stall ----
  const signC = canvasTex(1024, 256, (c, w, h) => { c.fillStyle = '#b3202a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffd45a'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28); c.fillStyle = '#ffe07a'; c.font = FONT(118); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sign, w / 2, h / 2 + 8); });
  box(2.3, 0.6, 0.07, std('#5a1016'), [-0.3, 2.86, -1.42], g);
  mesh(new THREE.PlaneGeometry(2.24, 0.54), new THREE.MeshStandardMaterial({ map: signC, emissive: '#ffffff', emissiveMap: signC, emissiveIntensity: 0.9, roughness: 0.6 }), [-0.3, 2.86, -1.38], g, { cast: false }).userData.lg = 'S';

  // ---- chalk menu board, above head height between the two seats ----
  const mb = menuBrand ? (menuBrand === true ? 'TRÀ ĐÁ VỚI AI' : String(menuBrand)) : null;
  const menuC = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#1d3a30'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.08, 4, 3);
    c.strokeStyle = '#8a5a30'; c.lineWidth = 22; c.strokeRect(0, 0, w, h);
    c.textBaseline = 'middle';
    if (mb) {
      c.fillStyle = '#b3202a'; c.fillRect(24, 24, w - 48, 66);
      c.strokeStyle = '#ffd45a'; c.lineWidth = 3; c.strokeRect(27, 27, w - 54, 60);
      c.textAlign = 'center'; c.fillStyle = '#ffe588';
      let fs = 40; c.font = FONT(fs); while (c.measureText(mb).width > w - 76 && fs > 22) { fs -= 2; c.font = FONT(fs); }
      c.fillText(mb, w / 2, 58);
      c.textAlign = 'left'; c.fillStyle = '#ffe9a0'; c.font = FONT(46); c.fillText('HÔM NAY', 46, 134);
      c.font = FONT(38, 800);
      [['Trà đá', '5K'], ['Nhân trần', '5K'], ['Trà chanh', '15K'], ['Hướng dương', '10K'], ['Kẹo lạc', '5K']].forEach(([a, b], i) => {
        const y = 204 + i * 58; c.textAlign = 'left'; c.fillStyle = '#f2efe6'; c.fillText(a, 46, y); c.textAlign = 'right'; c.fillStyle = '#ffd45a'; c.fillText(b, w - 46, y);
      });
    } else {
      c.textAlign = 'left'; c.fillStyle = '#ffe9a0'; c.font = FONT(58); c.fillText('HÔM NAY', 46, 78); c.fillStyle = '#f2efe6'; c.font = FONT(44, 800);
      [['Trà đá', '5K'], ['Nhân trần', '5K'], ['Trà chanh', '15K'], ['Hướng dương', '10K'], ['Kẹo lạc', '5K']].forEach(([a, b], i) => { c.textAlign = 'left'; c.fillText(a, 46, 170 + i * 68); c.textAlign = 'right'; c.fillStyle = '#ffd45a'; c.fillText(b, w - 46, 170 + i * 68); c.fillStyle = '#f2efe6'; });
    }
  });
  mesh(new THREE.PlaneGeometry(0.74, 0.74), std('#ffffff', { map: menuC, roughness: 0.85, emissive: '#ffffff', emissiveMap: menuC, emissiveIntensity: 0.18 }), [0.72, mb ? 1.84 : 1.98, -1.47], g, { cast: false });
  if (mailbox) {
    // Opt-in 3-D "HÒM THƯ QUÁN TRÀ" mounted on the wall below the menu board (Combo 1)
    const mbG = new THREE.Group(); mbG.position.set(0.92, 1.24, -1.42); g.add(mbG);
    const mbLbl = typeof mailbox === 'object' && mailbox.label ? String(mailbox.label) : 'HÒM THƯ';
    mesh(new RoundedBoxGeometry(0.25, 0.28, 0.13, 3, 0.012), std('#7c4d2b', { roughness: 0.72 }), [0, 0, 0], mbG);
    mesh(new RoundedBoxGeometry(0.29, 0.045, 0.17, 3, 0.01), std('#b3202a', { roughness: 0.55 }), [0, 0.15, 0.01], mbG, { rot: [0.12, 0, 0] });
    box(0.14, 0.016, 0.02, std('#15121d', { roughness: 0.9 }), [0, 0.088, 0.064], mbG, { cast: false });
    box(0.085, 0.05, 0.005, std('#fff3c4', { roughness: 0.75, emissive: '#ffe6a3', emissiveIntensity: 0.12 }), [0.01, 0.108, 0.068], mbG, { cast: false, rot: [0.22, 0, -0.14] });
    const mbTex = canvasTex(256, 160, (c, w, h) => {
      c.fillStyle = '#fff5d6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b3202a'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#b3202a'; c.textAlign = 'center'; c.textBaseline = 'middle';
      let fs = 46; c.font = FONT(fs); while (c.measureText(mbLbl).width > w - 34 && fs > 24) { fs -= 2; c.font = FONT(fs); }
      c.fillText(mbLbl, w / 2, h * 0.42); c.fillStyle = '#231a3d'; c.font = FONT(26, 800); c.fillText('QUÁN TRÀ', w / 2, h * 0.74);
    });
    mesh(new THREE.PlaneGeometry(0.2, 0.125), std('#ffffff', { map: mbTex, roughness: 0.75, emissive: '#ffffff', emissiveMap: mbTex, emissiveIntensity: 0.16 }), [0, -0.025, 0.066], mbG, { cast: false });
  }

  // ---- striped tarp awning (dim, it frames the top of wide shots) + poles ----
  const tarpC = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#8f8a7c' : '#1d3f73'; c.fillRect(i * 64, 0, 64, h); } grain(c, w, h, 800, 0.08, 2, 2); });
  mesh(new THREE.PlaneGeometry(6.2, 3.0, 12, 4), new THREE.MeshStandardMaterial({ map: tarpC, side: THREE.DoubleSide, roughness: 0.9 }), [-1.7, 3.3, 0.0], g, { rot: [-(Math.PI / 2 - 0.2), 0, 0] });
  for (const x of [-4.7, 1.35]) cyl(0.022, 0.022, 3.05, std('#7d8590', { roughness: 0.4, metalness: 0.7 }), [x, 1.52, 1.42], g, {}, 10);

  // ---- string lights (two runs) + the hanging key bulb + light pools on the wall ----
  const bulbM = emis('#ffdca0', 3.2), wireM = new THREE.MeshBasicMaterial({ color: '#0d0a12' });
  const run = (x0, x1, y, z, sag, n) => { const pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push(new THREE.Vector3(lerp(x0, x1, u), y - sag * 4 * u * (1 - u), z)); } g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.006, 5), wireM)); pts.forEach((p, i) => { if (i === 0 || i === n) return; const b = ball(0.028, bulbM.clone(), [p.x, p.y - 0.035, p.z], g, { cast: false, recv: false }, 12); b.userData.seed = i + x0 * 10; b.userData.lg = 'S'; practicals.push(b); }); };
  run(-4.6, CX - 0.1, 2.62, -1.26, 0.2, 15); run(-4.7, 1.35, 2.86, 1.38, 0.24, 13);
  for (const [x, y, k] of [[-2.6, 2.35, 0.7], [-0.9, 2.3, 0.8], [0.6, 2.35, 0.6]]) { const l = new THREE.PointLight('#ffb866', k, 3.4, 2); l.userData.lg = 'S'; l.position.set(x, y, -1.05); g.add(l); }
  { const n = 18, x0 = -4.4, x1 = CX - 0.15, cols = ['#e23d3d', '#ffd23f', '#2f9a6a', '#3a8ad6', '#ff8a5a', '#f6f1e4'], tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.07, 0, 0, 0.07, 0, 0, 0, -0.16, 0]), 3)); tri.computeVertexNormals();
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = lerp(x0, x1, u), y = 2.36 - 0.1 * 4 * u * (1 - u); const f = mesh(tri, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.8, side: THREE.DoubleSide, emissive: cols[i % cols.length], emissiveIntensity: 0.12 }), [x, y, -1.43], g, { cast: false, rot: [0, 0, (hash(i * 3.3) - 0.5) * 0.25] }); f.userData.noOutline = true; f.userData.lg = 'S'; } }
  const bulbCable = cyl(0.004, 0.004, 0.86, wireM, [-0.25, 2.57, 0.35], g, { cast: false }, 6);
  const bulbShade = cyl(0.05, 0.11, 0.07, std('#2a3a35', { roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), [-0.25, 2.15, 0.35], g, { cast: false }, 20);
  const keyBulb = ball(0.045, emis('#fff0c8', 5), [-0.25, 2.1, 0.35], g, { cast: false, recv: false }, 16); keyBulb.userData.lg = 'B';
  const bulbLight = new THREE.PointLight('#ffc98a', 1.4, 6, 2); bulbLight.position.set(-0.25, 2.05, 0.35); bulbLight.userData.lg = 'B'; g.add(bulbLight);
  const coneT = canvasTex(64, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,210,150,0.55)'); gr.addColorStop(1, 'rgba(255,210,150,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const cone = mesh(new THREE.CylinderGeometry(0.07, 1.25, 2.05, 32, 1, true), new THREE.MeshBasicMaterial({ map: coneT, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), [-0.25, 1.07, 0.35], g, { cast: false, recv: false }); cone.userData.lg = 'B';

  // ---- shelf with thermoses, jars, bottles (above head height, backlit) ----
  const SX = -0.55;
  box(1.5, 0.035, 0.24, std('#6a4428', { roughness: 0.8 }), [SX, 1.62, -1.36], g);
  box(1.5, 0.03, 0.02, emis('#ffcf8a', 1.8), [SX, 1.6, -1.47], g, { cast: false });
  const shelfItem = (x, kind, col) => { const y = 1.64; if (kind === 't') { cyl(0.055, 0.06, 0.26, std(col, { roughness: 0.3, metalness: 0.3 }), [x, y + 0.13, -1.36], g, {}, 18); cyl(0.04, 0.05, 0.05, std('#e8e2d0', { roughness: 0.4 }), [x, y + 0.285, -1.36], g, {}, 14); } else if (kind === 'j') { cyl(0.065, 0.065, 0.17, new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, roughness: 0.05 }), [x, y + 0.085, -1.36], g, { cast: false }, 18); cyl(0.058, 0.058, 0.11, std(col, { roughness: 0.6 }), [x, y + 0.06, -1.36], g, {}, 14); cyl(0.068, 0.068, 0.025, std('#c0392b', { roughness: 0.5 }), [x, y + 0.18, -1.36], g, {}, 18); } else { cyl(0.03, 0.036, 0.2, std(col, { roughness: 0.2, emissive: col, emissiveIntensity: 0.3 }), [x, y + 0.1, -1.36], g, {}, 12); cyl(0.012, 0.022, 0.07, std(col, { roughness: 0.2 }), [x, y + 0.235, -1.36], g, {}, 10); } };
  [[-0.63, 't', '#c93a34'], [-0.45, 't', '#2f7a5a'], [-0.23, 'j', '#e0a23a'], [-0.03, 'j', '#7a4a2a'], [0.17, 'b', '#d8782a'], [0.27, 'b', '#3a9a4a'], [0.37, 'b', '#c23a5a'], [0.55, 'j', '#d8d0b0'], [0.69, 'b', '#e8c84a']].forEach(([x, k, c]) => shelfItem(SX + x, k, c));
  // strings of snack packets hanging by the cabinet
  for (let s = 0; s < 3; s++) for (let i = 0; i < 6; i++) box(0.11, 0.13, 0.02, std(['#e8c21a', '#d6303f', '#2f9a6a', '#f2852a', '#3a8ad6'][(i + s * 2) % 5], { roughness: 0.35, metalness: 0.2 }), [-2.62 + s * 0.17, 2.3 - i * 0.16, -1.42 + s * 0.01], g, { rot: [0, 0, (hash(i + s * 7) - 0.5) * 0.3] });

  // ---- the vendor's corner (left): cabinet with a glass case, charcoal stove, big kettle ----
  const cab = new THREE.Group(); cab.position.set(-2.0, 0, -0.95); cab.rotation.y = 0.28; g.add(cab);
  box(0.95, 0.78, 0.45, std('#7a5230', { roughness: 0.75 }), [0, 0.39, 0], cab);
  box(0.97, 0.03, 0.47, std('#5a3a20', { roughness: 0.7 }), [0, 0.795, 0], cab);
  box(0.9, 0.34, 0.4, new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.04 }), [0, 0.98, 0], cab, { cast: false });
  for (let i = 0; i < 8; i++) box(0.085, 0.12 + hash(i) * 0.05, 0.05, std(['#d6303f', '#3a8ad6', '#f2b73a', '#e8e2d2', '#2f9a6a'][i % 5], { roughness: 0.55 }), [-0.36 + i * 0.1, 0.88, 0.05 - (i % 2) * 0.12], cab);
  box(0.9, 0.012, 0.02, emis('#fff0c8', 2.4), [0, 1.14, 0.18], cab, { cast: false });
  const stove = new THREE.Group(); stove.position.set(-1.22, 0, -0.98); g.add(stove);
  cyl(0.15, 0.13, 0.26, std('#8a4a2a', { roughness: 0.9 }), [0, 0.13, 0], stove, {}, 18);
  const coals = cyl(0.12, 0.12, 0.02, emis('#ff5a14', 2.4), [0, 0.262, 0], stove, { cast: false }, 16); coals.userData.lg = 'veh';
  const coalLight = new THREE.PointLight('#ff6a20', 0.5, 1.6, 2); coalLight.position.set(0, 0.4, 0.05); stove.add(coalLight);
  const ket = new THREE.Group(); ket.position.set(0, 0.28, 0); ket.scale.setScalar(0.72); stove.add(ket);
  const ketM = std('#8e949b', { roughness: 0.42, metalness: 0.75 });
  lathe([[0.001, 0], [0.14, 0.01], [0.17, 0.09], [0.16, 0.2], [0.11, 0.27], [0.05, 0.29], [0.001, 0.3]], ketM, [0, 0, 0], ket);
  cyl(0.018, 0.03, 0.2, ketM, [0.19, 0.19, 0], ket, { rot: [0, 0, -0.9] }, 10); ball(0.025, std('#1c1c20'), [0, 0.31, 0], ket, {}, 10);
  mesh(new THREE.TorusGeometry(0.11, 0.01, 8, 20, Math.PI), std('#2a2a30', { roughness: 0.5 }), [0, 0.28, 0], ket);

  // ---- the table and the plastic stools ----
  const table = new THREE.Group(); table.position.set(0, 0, 0.42); g.add(table);
  const tabM = new THREE.MeshPhysicalMaterial({ color: '#1f8a5c', roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  mesh(new RoundedBoxGeometry(0.86, 0.035, 0.5, 3, 0.014), tabM, [0, 0.46, 0], table);
  for (const [x, z] of [[-0.37, -0.2], [0.37, -0.2], [-0.37, 0.2], [0.37, 0.2]]) cyl(0.02, 0.026, 0.45, tabM, [x, 0.225, z], table, {}, 10);
  contactBlob(1.25, 0.85, table, [0, 0.006, 0], 0.6);
  const stool = (x, z, col) => { const s = new THREE.Group(); s.position.set(x, 0, z); g.add(s); const m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.35 }); const b = cyl(0.135, 0.185, 0.25, m, [0, 0.125, 0], s, {}, 4); b.rotation.y = Math.PI / 4; mesh(new RoundedBoxGeometry(0.235, 0.03, 0.235, 2, 0.012), m, [0, 0.265, 0], s); contactBlob(0.62, 0.62, s, [0, 0.005, 0], 0.7); return s; };
  stool(-0.42, 0, '#2a6fd0'); stool(0.42, 0, '#d63a34'); stool(-1.5, 0.6, '#d63a34').rotation.y = 0.5; stool(-2.5, 0.2, '#2a6fd0'); stool(1.55, 0.9, '#2a6fd0').rotation.y = 0.3;

  const rowObj = row ? buildStoolRow(g, row) : null;
  // ---- on the table: two glasses of iced tea, a plate of sunflower seeds, a toothpick jar ----
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, roughness: 0.03, clearcoat: 1 }), teaM = new THREE.MeshStandardMaterial({ color: '#c26a14', roughness: 0.12, emissive: '#7a3606', emissiveIntensity: 0.75 }), iceM = new THREE.MeshPhysicalMaterial({ color: '#f1fbff', roughness: 0.1, transparent: true, opacity: 0.85 });
  const glass = (x, z) => { const q = new THREE.Group(); q.position.set(x, 0.478, z); table.add(q); cyl(0.034, 0.027, 0.105, glassM, [0, 0.0525, 0], q, { cast: false }, 22); cyl(0.0305, 0.0255, 0.08, teaM, [0, 0.043, 0], q, {}, 22); for (let i = 0; i < 3; i++) box(0.022, 0.022, 0.022, iceM, [(hash(i + x) - 0.5) * 0.03, 0.078 + i * 0.004, (hash(i * 3 + x) - 0.5) * 0.03], q, { cast: false, rot: [hash(i) * 2, hash(i * 2) * 2, 0] }); return q; };
  const glasses = [glass(-0.22, 0.05), glass(0.24, 0.02)];
  cyl(0.085, 0.06, 0.014, std('#f1ece0', { roughness: 0.35 }), [0.02, 0.485, 0.1], table, {}, 26);
  for (let i = 0; i < 46; i++) { const a = hash(i * 2.3) * 6.28, r = Math.sqrt(hash(i * 5.1)) * 0.062; mesh(new THREE.SphereGeometry(0.008, 6, 5), std(i % 5 ? '#2c2622' : '#e8e0cc', { roughness: 0.7 }), [0.02 + Math.cos(a) * r, 0.497 + hash(i) * 0.008, 0.1 + Math.sin(a) * r], table, { scale: [0.6, 0.35, 1.3], rot: [0, hash(i * 9) * 6, 0], cast: false }); }
  cyl(0.022, 0.02, 0.05, std('#e23d3d', { roughness: 0.4 }), [-0.33, 0.503, -0.14], table, {}, 14);

  // ---- the street behind Bíp: far facades, lamp posts, parked bikes, far bokeh, passing headlights ----
  const facade = (x, z, w, h, hue, rot) => { const mk = (em) => canvasTex(256, 512, (ctx, W, H) => { ctx.fillStyle = em ? '#000' : `hsl(${hue}, 28%, 17%)`; ctx.fillRect(0, 0, W, H); for (let r = 0; r < 4; r++) for (let q = 0; q < 2; q++) { const lit = hash(x * 3 + z + r * 5 + q) > 0.45; if (lit) { ctx.fillStyle = `hsl(${28 + hash(r + q + z) * 28}, 90%, ${55 + hash(r * q + z) * 15}%)`; ctx.fillRect(28 + q * 112, 40 + r * 112, 84, 70); } else if (!em) { ctx.fillStyle = '#0c0f1c'; ctx.fillRect(28 + q * 112, 40 + r * 112, 84, 70); } } }); mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: mk(false), emissive: '#ffffff', emissiveMap: mk(true), emissiveIntensity: 1.5, roughness: 0.95 }), [x, h / 2, z], g, { cast: false, rot: [0, rot, 0] }); };
  for (let i = block ? 1 : 0; i < 11; i++) facade(11.6, 4 - i * 3.9, 3.9, 7 + hash(i) * 4, 215 + hash(i * 3) * 50, -Math.PI / 2);
  facade(6.4, -42, 12, 13, 232, 0);
  const lampPost = (z) => { const lamp = new THREE.Group(); lamp.userData.lg = 'street'; lamp.position.set(3.75, 0, z); g.add(lamp); cyl(0.05, 0.07, 4.6, std('#4a4f58', { roughness: 0.6, metalness: 0.5 }), [0, 2.3, 0], lamp, {}, 10); box(0.9, 0.06, 0.1, std('#4a4f58'), [0.4, 4.55, 0], lamp); ball(0.12, emis('#ffd9a0', 7), [0.78, 4.47, 0], lamp, { cast: false }, 14); const l = new THREE.PointLight('#ffc27a', 26, 13, 2); l.userData.lg = 'street'; l.position.set(4.5, 4.2, z); g.add(l); };
  lampPost(-5); lampPost(-17); lampPost(-29);
  for (let i = 0; i < 34; i++) { const far = ball(0.06 + hash(i) * 0.1, emis(['#ffcf8a', '#ff8a5a', '#8ad0ff', '#ff5a7a', '#fff2c8'][i % 5], 4 + hash(i * 3) * 5), [1.8 + hash(i * 1.7) * 9.4, 0.5 + hash(i * 2.9) * 6, -9 - hash(i * 4.1) * 30], g, { cast: false, recv: false }, 8); far.userData.seed = i * 3; far.userData.lg = 'street'; practicals.push(far); }
  const bikeAt = (x, z, ry, col) => { const bike = new THREE.Group(); bike.position.set(x, 0, z); bike.rotation.y = ry; g.add(bike); for (const zz of [-0.55, 0.55]) mesh(new THREE.TorusGeometry(0.24, 0.06, 10, 24), std('#15151a', { roughness: 0.7 }), [0, 0.3, zz], bike, { rot: [0, Math.PI / 2, 0] }); mesh(new RoundedBoxGeometry(0.26, 0.4, 0.95, 4, 0.1), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.3, clearcoat: 1 }), [0, 0.52, -0.05], bike); box(0.24, 0.1, 0.6, std('#1b1b22', { roughness: 0.6 }), [0, 0.78, -0.2], bike); cyl(0.02, 0.02, 0.6, std('#9aa0a8', { metalness: 0.8, roughness: 0.3 }), [0, 0.98, 0.42], bike, { rot: [0, 0, Math.PI / 2] }, 8); box(0.16, 0.12, 0.06, emis('#fff4d0', 0.5), [0, 0.86, 0.6], bike, { cast: false }); contactBlob(1.0, 1.7, bike, [0, 0.006, 0], 0.6); return bike; };
  bikeAt(2.75, -2.4, -0.25, '#b3272c'); bikeAt(2.9, -4.3, -0.15, '#2a5aa8');
  // passing motorbikes on the street: a headlight coming, a tail light going (pure functions of time)
  const movers = [0, 1, 2].map((i) => { const m = new THREE.Group(); m.userData.lg = 'veh'; g.add(m); const white = i !== 1; ball(0.1, emis(white ? '#fff6dc' : '#ff3a2a', white ? 9 : 5), [0, 0.85, 0], m, { cast: false, recv: false }, 10); const l = new THREE.PointLight(white ? '#ffe8c0' : '#ff4a3a', white ? 5 : 1.5, 9, 2); l.position.y = 0.9; m.add(l); return m; });
  const pot = new THREE.Group(); pot.position.set(-2.95, 0, 0.5); g.add(pot); cyl(0.17, 0.12, 0.3, std('#9a4a2e', { roughness: 0.85 }), [0, 0.15, 0], pot, {}, 16); for (let i = 0; i < 9; i++) { const a = i * 0.7; mesh(new THREE.SphereGeometry(0.1, 10, 8), std(i % 2 ? '#2f7a3f' : '#3f9a4f', { roughness: 0.8 }), [Math.cos(a) * 0.09, 0.42 + hash(i) * 0.3, Math.sin(a) * 0.09], pot, { scale: [0.5, 1.6, 0.2], rot: [hash(i) - 0.5, a, (hash(i * 3) - 0.5) * 1.2] }); }
  // power pole at the corner with a tangle of wires running down the street and across the front
  cyl(0.09, 0.11, 7.5, std('#8f8c84', { roughness: 0.9 }), [3.2, 3.75, -1.3], g, {}, 10);
  for (let i = 0; i < 8; i++) { const y = 4.2 + hash(i) * 1.8; const pts = i % 2 ? [new THREE.Vector3(3.2, y, -1.3), new THREE.Vector3(3.3, y - 0.7, -12), new THREE.Vector3(3.2, y, -24)] : [new THREE.Vector3(3.2, y, -1.3), new THREE.Vector3(0, y - 0.5 - hash(i * 2) * 0.3, -1.2 + hash(i * 5) * 0.4), new THREE.Vector3(-5, y + hash(i * 4) * 0.5, -1.3)]; g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.009, 4), wireM)); }
  // sky
  const skyT = canvasTex(64, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060818'); gr.addColorStop(0.5, '#141d46'); gr.addColorStop(0.78, '#33285a'); gr.addColorStop(1, '#5a3048'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  mesh(new THREE.SphereGeometry(90, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }), [0, 0, 0], g, { cast: false, recv: false });

  // ---- series props on the table (setOpts): day = 'NGÀY 12' tent card with tally marks, tissue = 'NIÊM PHONG 1/11' sealed tissue box, phone = Tèo's phone face down ----
  if (day) { const n = parseInt(String(day).replace(/\D/g, ''), 10) || 0, tex = canvasTex(512, 352, (c) => { c.fillStyle = '#fbf6e6'; c.fillRect(0, 0, 512, 352); c.strokeStyle = '#d6cdb4'; c.lineWidth = 6; c.strokeRect(10, 10, 492, 332);
      c.fillStyle = '#d4252f'; c.font = '900 132px Display, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(day, 256, 128);
      c.strokeStyle = '#231a3d'; c.lineWidth = 9; c.lineCap = 'round'; const groups = Math.ceil(n / 5), gw = 92, x0 = 256 - (groups * gw - 20) / 2; for (let i = 0; i < n; i++) { const g = Math.floor(i / 5), k = i % 5, x = x0 + g * gw; c.beginPath(); if (k < 4) { c.moveTo(x + k * 16, 232); c.lineTo(x + k * 16 + 3, 300); } else { c.moveTo(x - 10, 290); c.lineTo(x + 60, 240); } c.stroke(); } });
    const card = new THREE.Group(); card.position.set(0.03, 0.478, 0.17); card.rotation.y = -0.06; table.add(card);
    mesh(new THREE.BoxGeometry(0.2, 0.1375, 0.004), [std('#efe8d2'), std('#efe8d2'), std('#efe8d2'), std('#efe8d2'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.18 }), std('#e6dec6')], [0, 0.066, 0], card, { rot: [-0.2, 0, 0] });
    mesh(new THREE.BoxGeometry(0.2, 0.13, 0.004), std('#e6dec6'), [0, 0.062, -0.034], card, { rot: [0.32, 0, 0] }); }
  if (tissue) { const tb = new THREE.Group(); tb.position.set(-0.2, 0.478, 0.16); tb.rotation.y = 0.16; table.add(tb);
    const lab = canvasTex(512, 256, (c) => { c.fillStyle = '#8fc7ea'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#b9def5'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(30 + i * 58, 232, 16, 0, 7); c.fill(); c.beginPath(); c.arc(58 + i * 58, 22, 12, 0, 7); c.fill(); }
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(22, 50, 468, 158, 14); c.fill(); c.strokeStyle = '#d4252f'; c.lineWidth = 10; c.stroke(); c.fillStyle = '#d4252f'; c.textAlign = 'center'; c.textBaseline = 'middle'; const [l1, l2] = String(tissue).split(/\s(?=[0-9])/); c.font = '900 80px Display, sans-serif'; c.fillText(l1, 256, 104); c.font = '900 58px Display, sans-serif'; c.fillText(l2 || '', 256, 170); });
    const side = std('#8fc7ea', { roughness: 0.75 }); mesh(new THREE.BoxGeometry(0.17, 0.085, 0.105), [side, side, std('#a6d5f1', { roughness: 0.75 }), side, new THREE.MeshStandardMaterial({ map: lab, roughness: 0.75, emissive: '#ffffff', emissiveMap: lab, emissiveIntensity: 0.2 }), side], [0, 0.0425, 0], tb);
    const tape = std('#f2c230', { roughness: 0.45 }); mesh(new THREE.BoxGeometry(0.1, 0.004, 0.1075), tape, [0, 0.0865, 0], tb); mesh(new THREE.BoxGeometry(0.1, 0.014, 0.002), tape, [0, 0.079, 0.0535], tb); mesh(new THREE.BoxGeometry(0.1, 0.014, 0.002), tape, [0, 0.079, -0.0535], tb); }
  // card2 = ['XEM TÂM CAN', '20K']: a second tent card (two lines, no tally marks), front left of the table in front of Tèo, beside the tissue box (Ngày 13: Tèo's stall menu)
  if (card2) { const [c1, c2] = Array.isArray(card2) ? card2 : String(card2).split('|'), tex2 = canvasTex(512, 352, (c) => { c.fillStyle = '#fff4c9'; c.fillRect(0, 0, 512, 352); c.strokeStyle = '#7a3fd0'; c.lineWidth = 10; c.strokeRect(12, 12, 488, 328);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#231a3d'; let fs = 92; c.font = `900 ${fs}px Display, sans-serif`; while (c.measureText(c1).width > 460 && fs > 40) { fs -= 4; c.font = `900 ${fs}px Display, sans-serif`; } c.fillText(c1, 256, 118);
      c.fillStyle = '#d4252f'; c.font = '900 128px Display, sans-serif'; c.fillText(c2 || '', 256, 252); });
    const card = new THREE.Group(); card.position.set(-0.355, 0.478, 0.175); card.rotation.y = 0.22; table.add(card);
    mesh(new THREE.BoxGeometry(0.15, 0.103, 0.004), [std('#efe8d2'), std('#efe8d2'), std('#efe8d2'), std('#efe8d2'), new THREE.MeshStandardMaterial({ map: tex2, roughness: 0.8, emissive: '#ffffff', emissiveMap: tex2, emissiveIntensity: 0.18 }), std('#e6dec6')], [0, 0.05, 0], card, { rot: [-0.2, 0, 0] });
    mesh(new THREE.BoxGeometry(0.15, 0.097, 0.004), std('#e6dec6'), [0, 0.047, -0.026], card, { rot: [0.32, 0, 0] }); }
  let tPhone = null; if (phone) { tPhone = new THREE.Group(); tPhone.position.set(-0.2, 0.4835, -0.12); tPhone.rotation.set(-Math.PI / 2, 0, 0.35); table.add(tPhone); mesh(new RoundedBoxGeometry(0.075, 0.15, 0.009, 3, 0.004), std('#16161d', { roughness: 0.3, metalness: 0.4 }), [0, 0, 0], tPhone); mesh(new THREE.CircleGeometry(0.009, 16), std('#3a3a48', { roughness: 0.2, metalness: 0.7 }), [0.02, 0.05, 0.0048], tPhone, { cast: false }); }

  // ---- Zombie special (setOpts, all off by default: earlier episodes render exactly as before) ----
  // post: a wooden post beside Tèo with a QR payment sheet and a charger cable hanging from a socket; speaker: Bà's QR payment speaker on her glass cabinet (fx.ting 0..1 lights it);
  // spill: Tèo's glass can be knocked over (fx.spill 0..1: it tips, rolls, the tea spreads and drips off the table edge); abandoned (option, or fx.abandon 0..1): Bà's stool tipped, a motorbike on its side, paper and smoke drifting, no traffic;
  // cold (option, or fx.cold 0..1): warm yellow -> cold blue-grey with a slow unsteady lamp (lights, practicals, fog and the final grade)
  let postLed = null, qrUpd = null, postUpd = null, spkUpd = null, spillUpd = null, abUpd = null, glassNode = glasses[0];
  if (post) {
    const PX = -1.0, PZ = -0.42, pg = new THREE.Group(); pg.position.set(PX, 0, PZ); g.add(pg);
    box(0.12, 2.45, 0.12, std('#6a4a30', { roughness: 0.85 }), [0, 1.225, 0], pg); box(0.15, 0.05, 0.15, std('#4a3220', { roughness: 0.85 }), [0, 0.025, 0], pg);
    const qrC = canvasTex(512, 640, (c, w, h) => { c.fillStyle = '#fbfbf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#c4272f'; c.fillRect(0, 0, w, 96); c.fillStyle = '#fff'; c.font = FONT(50); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('QUÉT MÃ TRẢ TIỀN', w / 2, 50, 470);
      const N = 21, m = 15, q = (w - 2 * 44) / N, ox = 44, oy = 130, on = (i, j) => { const fin = (a, b) => { const d = Math.max(Math.abs(a - 3), Math.abs(b - 3)); return d === 3 || d <= 1 ? 1 : d === 2 ? 0 : -1; };
        for (const [a, b] of [[0, 0], [N - 7, 0], [0, N - 7]]) { if (i >= a && i < a + 7 && j >= b && j < b + 7) return fin(i - a, j - b) === 1; if (i >= a - 1 && i <= a + 7 && j >= b - 1 && j <= b + 7) return false; } return hash(i * 17 + j * 31 + 5) > 0.5; };
      c.fillStyle = '#111'; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (on(i, j)) c.fillRect(ox + i * q, oy + j * q, q + 0.6, q + 0.6);
      c.fillStyle = '#222'; c.font = FONT(46); c.fillText('BÀ CHỦ QUÁN', w / 2, 585); });
    mesh(new THREE.BoxGeometry(0.27, 0.34, 0.01), [std('#e8e2d0'), std('#e8e2d0'), std('#e8e2d0'), std('#e8e2d0'), new THREE.MeshStandardMaterial({ map: qrC, roughness: 0.7, emissive: '#ffffff', emissiveMap: qrC, emissiveIntensity: 0.22 }), std('#d8d2c0')], [-0.012, 1.3, 0.066], pg, { cast: false });
    for (const [x, y] of [[-0.13, 1.46], [0.11, 1.46], [-0.13, 1.14], [0.11, 1.14]]) box(0.045, 0.012, 0.012, std('#e8c850', { roughness: 0.5 }), [x, y, 0.074], pg, { cast: false, rot: [0, 0, 0.7] });
    // the socket strip with a glowing LED, and the charger cable hanging from it (a slow sway)
    box(0.07, 0.17, 0.035, std('#f2f0ea', { roughness: 0.5 }), [0.0, 0.93, 0.07], pg); postLed = box(0.012, 0.012, 0.01, emis('#46ff7a', 3), [0.0, 1.0, 0.09], pg, { cast: false });
    const cableG = new THREE.Group(); cableG.position.set(0, 0.88, 0.09); pg.add(cableG);
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.012, -0.16, 0.03), new THREE.Vector3(0.06, -0.36, 0.06), new THREE.Vector3(0.1, -0.48, 0.04), new THREE.Vector3(0.09, -0.57, 0.01)]), 24, 0.006, 6), std('#f4f4f2', { roughness: 0.5 }), [0, 0, 0], cableG, { cast: false });
    const plug = new THREE.Group(); plug.position.set(0.09, -0.57, 0.01); cableG.add(plug); box(0.026, 0.05, 0.014, std('#f4f4f2', { roughness: 0.45 }), [0, -0.025, 0], plug); box(0.016, 0.026, 0.008, std('#b8bcc2', { roughness: 0.3, metalness: 0.8 }), [0, -0.063, 0], plug);
    postUpd = (t) => { cableG.rotation.z = 0.03 * Math.sin(t * 0.9) + 0.01 * Math.sin(t * 2.1); plug.rotation.z = 0.12 * Math.sin(t * 1.1 + 0.6); };
  }
  if (speaker) {
    const sp = new THREE.Group(); sp.position.set(0.3, 1.155, 0.02); cab.add(sp);
    const body = new THREE.MeshPhysicalMaterial({ color: '#eef3f8', roughness: 0.4, clearcoat: 0.3 });
    mesh(new RoundedBoxGeometry(0.17, 0.11, 0.08, 3, 0.012), body, [0, 0.055, 0], sp); box(0.12, 0.05, 0.004, std('#2a2e36', { roughness: 0.6 }), [0, 0.05, 0.041], sp, { cast: false });
    for (let i = 0; i < 12; i++) ball(0.0035, std('#0b0c10'), [-0.05 + (i % 6) * 0.02, 0.035 + Math.floor(i / 6) * 0.03, 0.043], sp, { cast: false }, 6);
    const led = ball(0.007, new THREE.MeshBasicMaterial({ color: '#46ff7a', toneMapped: false }), [0.062, 0.098, 0.041], sp, { cast: false, recv: false }, 10);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: '#5aff8a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); halo.scale.set(0.075, 0.075, 1); halo.position.set(0.062, 0.098, 0.05); sp.add(halo);
    const qrM = new THREE.MeshStandardMaterial({ map: canvasTex(64, 64, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#111'; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (hash(i * 5 + j * 9) > 0.45 || (i < 3 && j < 3)) c.fillRect(5 + i * 6, 5 + j * 6, 6, 6); }), roughness: 0.7 }); mesh(new THREE.PlaneGeometry(0.04, 0.04), qrM, [0.045, 0.058, 0.0412], sp, { cast: false });
    const kk = new THREE.Color('#2a8a4a'); led.material.color.copy(kk).multiplyScalar(2);
    spkUpd = (t, fx) => { const k = fx.ting || 0, p = k * (0.6 + 0.4 * Math.max(0, Math.sin(t * 22))); led.material.color.set('#46ff7a').multiplyScalar(0.5 + 3 * p); halo.material.opacity = 0.7 * k * (0.6 + 0.4 * Math.sin(t * 22 * 0.5) ** 2); sp.scale.setScalar(1 + 0.03 * k * Math.sin(t * 40)); };
    spkUpd(0, {});
  }
  if (spill) {
    const q = glasses[0], p0 = q.position.clone(), RR = 0.027, pivot = new THREE.Group(); pivot.position.set(p0.x, p0.y + 0.003, p0.z + RR); pivot.rotation.order = 'YXZ'; table.add(pivot); pivot.add(q); q.position.set(0, -0.003, -RR); glassNode = pivot;
    const tea = q.children[1], ph = (rx, rz, seed) => { const gm = new THREE.CircleGeometry(1, 48), pa = gm.attributes.position; for (let i = 1; i < pa.count; i++) { const a = Math.atan2(pa.getY(i), pa.getX(i)), r = 1 + 0.2 * Math.sin(a * 3 + seed) + 0.12 * Math.sin(a * 5 + seed * 2.1) + 0.05 * Math.sin(a * 9 + seed * 3); pa.setXY(i, pa.getX(i) * r, pa.getY(i) * r); } return gm; };
    const pm = new THREE.MeshStandardMaterial({ color: '#a65a10', transparent: true, opacity: 0.82, roughness: 0.06, emissive: '#6a3004', emissiveIntensity: 0.55, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false });
    const pud = new THREE.Mesh(ph(1, 1, 1), pm); pud.rotation.x = -Math.PI / 2; pud.position.y = 0.4783; pud.renderOrder = 2; table.add(pud);
    const fpm = pm.clone(), fl = new THREE.Mesh(ph(1, 1, 4), fpm); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.008, 0.42 + 0.25 + 0.2); fl.renderOrder = 2; fl.receiveShadow = true; g.add(fl);
    const strm = new THREE.Mesh(new THREE.BoxGeometry(0.014, 1, 0.012), pm); strm.renderOrder = 2; table.add(strm);
    const drops = [0, 1, 2].map(() => { const d = ball(0.009, pm, [0, 0, 0], table, { cast: false, recv: false }, 8); return d; });
    spillUpd = (t, fx) => { const s = fx.spill || 0, tip = smooth(s / 0.16), roll = smooth((s - 0.14) / 0.34), k = smooth((s - 0.06) / 0.55);
      pivot.position.set(p0.x + roll * 0.11, p0.y + 0.003, p0.z + RR + roll * 0.015); pivot.rotation.set(tip * (Math.PI / 2 - 0.035), -roll * 0.35, 0); q.rotation.y = roll * 5;
      const fill = 1 - smooth((s - 0.02) / 0.2); tea.scale.y = Math.max(0.001, fill); tea.position.y = 0.003 + 0.04 * fill; tea.visible = fill > 0.01;
      pud.visible = s > 0.03; const cx = p0.x + 0.02 + k * 0.08, cz = p0.z + 0.03 + k * 0.075, rx = 0.012 + 0.105 * k, rz = 0.012 + 0.085 * k; pud.position.set(cx, 0.4783, cz); pud.scale.set(rx, rz, 1); pud.rotation.z = 0;
      const sk = smooth((s - 0.5) / 0.12), L = 0.46 * sk; strm.visible = sk > 0.01; strm.scale.y = Math.max(0.001, L); strm.position.set(cx, 0.4783 - L / 2, 0.25 + 0.006);
      const fk = smooth((s - 0.6) / 0.4); fl.visible = fk > 0.01; fl.position.x = cx; fl.scale.set(0.02 + 0.3 * fk, 0.015 + 0.2 * fk, 1);
      drops.forEach((d, i) => { const u = ((t * 1.3 + i / 3) % 1 + 1) % 1; d.visible = sk > 0.6; d.position.set(cx + 0.004 * (i - 1), 0.4783 - 0.44 * u * u, 0.25 + 0.012); d.scale.setScalar(1 - 0.5 * u); }); };
    spillUpd(0, {});
  }

  if (qrcard) {
    // a small standing QR card at the front of the table (table-local x -0.14, z 0.2): the spilled tea reaches its foot and smears the code (fx.qrwet 0..1 crossfades to a ruined copy)
    const qrDraw = (c, w, h, wet) => { c.fillStyle = '#fbfbf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#c4272f'; c.fillRect(0, 0, w, 56); c.fillStyle = '#fff'; c.font = FONT(34); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('QUÉT MÃ', w / 2, 30, 230);
      const N = 21, q = (w - 56) / N, ox = 28, oy = 74, on = (i, j) => { for (const [a, b] of [[0, 0], [N - 7, 0], [0, N - 7]]) { if (i >= a && i < a + 7 && j >= b && j < b + 7) { const d = Math.max(Math.abs(i - a - 3), Math.abs(j - b - 3)); return d === 3 || d <= 1; } if (i >= a - 1 && i <= a + 7 && j >= b - 1 && j <= b + 7) return false; } return hash(i * 13 + j * 29 + 3) > 0.5; };
      c.fillStyle = '#111'; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (on(i, j)) c.fillRect(ox + i * q, oy + j * q, q + 0.6, q + 0.6);
      if (wet) { const cv = c.canvas, tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; tmp.getContext('2d').drawImage(cv, 0, 0); c.save(); c.filter = 'blur(7px)'; c.drawImage(tmp, 0, 6); c.restore(); c.fillStyle = 'rgba(251,251,246,0.5)'; c.fillRect(0, 150, w, 150);
        for (let i = 0; i < 9; i++) { const x = 14 + i * 28 + hash(i * 3) * 12, y0 = 70 + hash(i * 7) * 90, gr = c.createLinearGradient(x, y0, x, h); gr.addColorStop(0, 'rgba(150,84,18,0)'); gr.addColorStop(0.35, 'rgba(150,84,18,0.75)'); gr.addColorStop(1, 'rgba(120,62,10,0.9)'); c.fillStyle = gr; c.fillRect(x, y0, 18 + hash(i) * 12, h - y0); }
        const bg = c.createLinearGradient(0, 120, 0, h); bg.addColorStop(0, 'rgba(160,92,20,0)'); bg.addColorStop(0.5, 'rgba(160,92,20,0.55)'); bg.addColorStop(1, 'rgba(110,56,8,0.85)'); c.fillStyle = bg; c.fillRect(0, 120, w, h - 120); } };
    const cleanT = canvasTex(256, 320, (c, w, h) => qrDraw(c, w, h, false)), wetT = canvasTex(256, 320, (c, w, h) => qrDraw(c, w, h, true));
    const qc = new THREE.Group(); qc.position.set(-0.14, 0.478, 0.2); qc.rotation.y = 0.04; table.add(qc);
    mesh(new THREE.BoxGeometry(0.11, 0.138, 0.006), [std('#efe8d2'), std('#efe8d2'), std('#efe8d2'), std('#efe8d2'), new THREE.MeshStandardMaterial({ map: cleanT, roughness: 0.8, emissive: '#ffffff', emissiveMap: cleanT, emissiveIntensity: 0.2 }), std('#e6dec6')], [0, 0.071, 0], qc, { rot: [-0.18, 0, 0] });
    mesh(new THREE.BoxGeometry(0.1, 0.1, 0.004), std('#e6dec6'), [0, 0.05, -0.04], qc, { rot: [0.5, 0, 0] });
    const wetM = new THREE.MeshStandardMaterial({ map: wetT, roughness: 0.55, transparent: true, opacity: 0, emissive: '#ffffff', emissiveMap: wetT, emissiveIntensity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const wetP = mesh(new THREE.PlaneGeometry(0.108, 0.136), wetM, [0, 0.071, 0.0036], qc, { cast: false, rot: [-0.18, 0, 0] }); wetP.renderOrder = 3;
    const tongue = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: '#a65a10', transparent: true, opacity: 0.82, roughness: 0.06, emissive: '#6a3004', emissiveIntensity: 0.55, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false })); tongue.rotation.x = -Math.PI / 2; tongue.position.set(-0.14, 0.4784, 0.2); tongue.renderOrder = 2; table.add(tongue);
    qrUpd = (t, fx) => { const w = smooth(fx.qrwet || 0); wetM.opacity = w; tongue.visible = w > 0.02; tongue.scale.set(0.012 + 0.075 * w, 0.01 + 0.032 * w, 1); tongue.position.set(-0.14, 0.4784, 0.215 + 0.02 * w); };
  }
  if (abandoned || true) {
    const ab = new THREE.Group(); g.add(ab); ab.visible = false;
    const bs = stool(0.98, -0.2, '#e8742a'); g.remove(bs); ab.add(bs); bs.rotation.set(0.1, 0.6, Math.PI / 2 * 0.95); bs.position.set(0.98, 0.17, -0.2);
    const bk = makeBike('#b3272c', 1); bk.position.set(2.1, 0, 0.7); bk.rotation.y = 2.5; ab.add(bk);
    const pap = driftPaper(g, { n: 26, box: [-3.2, 3.2, 0.1, 1.5, -1.0, 2.6], wind: [0.55, 0.35], seed: 3, speed: 0.045, color: '#cfd2d8' });
    const smk = smokeColumn(g, { pos: [6.0, 0, -16], n: 12, h: 9, w: 2.4, color: '#3a3f4c', op: 0.35, period: 30, seed: 11, drift: [0.5, 0] });
    abUpd = (t, fx) => { const a = Math.max(abandoned || 0, fx.abandon || 0); ab.visible = a > 0.5; pap.update(t, smooth(a)); smk.update(t, smooth(a)); movers.forEach((m) => { m.visible = a < 0.5 && !block; }); };
    abUpd(0, {});
  }
  const g0 = glassNode.position.clone();
  const plusU = plus ? buildStallPlus({ g, scene, practicals, blades, bulbCable, bulbShade, keyBulb, bulbLight, cone, ket, stove, pot, movers, cab, CX, block, steadyLights, abandoned, cold, opts: plus === true ? {} : plus }) : null;

  // ---- dust in the light of the bulb ----
  const N = 120, dp = new Float32Array(N * 3), dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffe2b0', size: 0.006, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })); dust.geometry.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dust.frustumCulled = false; g.add(dust);


  // ---- cold mood: fx.cold 0..1 (or the option) takes the stall from warm yellow to cold blue-grey; the lamp becomes slow and unsteady (waves, never a per-frame value) ----
  const coldBase = {}; let coldApplied = false; const CC = (h) => new THREE.Color(h);
  const coldPts = []; g.traverse((o) => { if (o.isPointLight) coldPts.push(o); });
  // blackout (fx 0..1): the stall lamps, string lights, signs and window glow die with a slow flutter (the socket strip's LED goes out), the warm key light goes, cold moonlight stays.
  // Everything emissive in the stall is collected once; the speaker's LED (it has its own battery) is left alone.
  const emisAll = [], washAll = []; { const seen = new Set(); g.traverse((o) => { for (const m of [].concat(o.material || [])) { if (!m || seen.has(m)) continue; seen.add(m);
    if ((m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) && (m.emissiveMap || (m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.05)) && m.emissiveIntensity > 0.0) { if (m !== postLed?.material) emisAll.push([m, m.emissiveIntensity]); }
    else if ((m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) && !m.transparent && m.opacity === 1) washAll.push(m); } }); }
  const coldUpd = (t, fx) => {
    const c = Math.max(cold || 0, fx.cold || 0), bo = fx.blackout || 0; if (c <= 0 && bo <= 0 && !coldApplied) return; coldApplied = true;
    const L = self.lights, st = globalThis.stage, B = coldBase, wave = 0.5 + 0.5 * noise1(t * 0.9, 4), dip = Math.pow(Math.max(0, noise1(t * 0.37, 7)), 2), lampK = 1 - c * (0.12 + 0.3 * wave + 0.45 * dip);
    const sb = smooth(bo), flut = 1 - 0.35 * Math.sin(Math.PI * sb) * (0.5 + 0.5 * Math.sin(t * 9.7 + 1.3 * Math.sin(t * 2.3))), kB = (1 - 0.97 * sb) * flut, mixK = (1 - c + c * lampK) * kB, u = Math.max(c, sb);
    if (L) { B.h ??= [L.hemi.color.clone(), L.hemi.groundColor.clone(), L.hemi.intensity, L.key.color.clone(), L.key.intensity, L.rim.color.clone(), L.rim.intensity, L.kick.color.clone(), L.kick.intensity, scene.fog?.color.clone(), scene.fog?.density];
      L.hemi.color.copy(B.h[0]).lerp(CC('#7e98d0'), u); L.hemi.groundColor.copy(B.h[1]).lerp(CC('#242c3c'), u); L.hemi.intensity = B.h[2] * (1 + 0.5 * c + 0.15 * sb);
      L.key.color.copy(B.h[3]).lerp(CC('#e2eaff'), u); L.key.intensity = B.h[4] * (1 - 0.15 * c) * mixK; L.rim.color.copy(B.h[5]).lerp(CC('#86b0ff'), u); L.rim.intensity = B.h[6] * (1 - 0.1 * u); L.kick.color.copy(B.h[7]).lerp(CC('#6a8ac8'), u); L.kick.intensity = B.h[8] * (1 - 0.55 * c) * (1 - 0.8 * sb);
      if (scene.fog) { scene.fog.color.copy(B.h[9]).lerp(CC('#121c2c'), u); scene.fog.density = B.h[10] * (1 + 0.5 * u); } }
    B.p ??= coldPts.map((l) => [l.color.clone(), l.intensity]); coldPts.forEach((l, i) => { if (l === coalLight || movers.some((m) => m.children.includes(l))) return; l.color.copy(B.p[i][0]).lerp(CC('#bcd4ff'), c); l.intensity = B.p[i][1] * (1 - 0.3 * c) * (l === bulbLight ? fx2(bulbLight, lampK) * kB : mixK); });
    keyBulb.material.emissive.copy(CC('#fff0c8')).lerp(CC('#dce8ff'), c); keyBulb.material.emissiveIntensity *= mixK; cone.material.color.copy(CC('#ffffff')).lerp(CC('#9ab4ee'), c); cone.material.opacity *= mixK;
    for (const b of practicals) { b.material.emissive.copy((b.userData.warm ??= b.material.emissive.clone())).lerp(CC('#dce8ff'), c * 0.8); b.material.emissiveIntensity *= mixK; }
    if (bo > 0) { for (const [m, e0] of emisAll) { if (practicals.some((b) => b.material === m) || m === keyBulb.material) continue; m.emissiveIntensity = e0 * kB; } if (postLed) postLed.material.emissiveIntensity = 3 * (1 - smooth((bo - 0.15) / 0.5)); }
    else { for (const [m, e0] of emisAll) if (m.emissiveIntensity !== e0 && !practicals.some((b) => b.material === m) && m !== keyBulb.material) m.emissiveIntensity = e0; if (postLed) postLed.material.emissiveIntensity = 3; }
    // walls and furniture go blue-grey (a flat blue-grey wash on the materials of the set; the characters are not part of it and keep their colours)
    if (!washAll.length) return; for (const m of washAll) { m.userData.e0 ??= m.emissive.clone(); m.emissive.copy(m.userData.e0).lerp(CC('#46688e'), 0.26 * u); }
    if (st) { const gu = st.grade.uniforms; B.g ??= [gu.sat.value, gu.contrast.value, gu.shadowTint.value.clone(), gu.hiTint.value.clone(), gu.vig.value];
      gu.sat.value = B.g[0] * (1 - 0.14 * c - 0.06 * sb); gu.contrast.value = B.g[1]; gu.shadowTint.value.copy(B.g[2]).lerp({ x: 0.0, y: 0.03, z: 0.08 }, Math.max(c, 0.6 * sb)); gu.hiTint.value.copy(B.g[3]).lerp({ x: 0.0, y: 0.02, z: 0.05 }, Math.max(c, 0.6 * sb)); gu.vig.value = B.g[4] * (1 + 0.2 * u); }
  };
  // ---- steadyLights (opt-in setOpts.steadyLights, 18/11, vay500): the lights go out in STEPS, each a quick "tách" and then a perfectly steady hold (no flutter, nothing per frame).
  // Groups (userData.lg on the pieces, default 'R' near the stall, 'street' beyond it): S = string lights, signs, bunting, wall pools (fx lampS 0..1 switches them OFF);
  // R = the shop's own lights (window, shelf and cabinet strips, menu board) (fx lampR 0..1 OFF, the hanging bulb with them); B = the hanging bulb, cone and its light (fx bulbOn 0..1 brings it back alone);
  // street = lamp posts, far glows (fx lampR dims them to 30 %); 'veh' (stove coals, passing headlights) never changes. dk = overall darkness: the warm key halves and cools, the ambient sinks, the grade goes bluer.
  // self.lgState = { S, R, B, street, d } (what tools/dump.cjs writes per frame, so Blender can key its own emissive pieces) and self.lgGroups(mesh) tell Blender which piece is which.
  let steadyOn = null;
  const lgOf = (o, dflt) => { for (let q = o; q; q = q.parent) if (q.userData?.lg) return q.userData.lg; if (dflt) return dflt; const p = new THREE.Vector3(); o.getWorldPosition(p); return (p.z < -3.5 || p.x > 1.6) ? 'street' : 'R'; };
  const steadyUpd = (t, fx) => {
    if (!steadyLights) return;
    const s = fx.lampS || 0, r = fx.lampR || 0, bo = fx.bulbOn || 0;
    if (!steadyOn) { steadyOn = { mats: [], lights: [] }; const upd = new Set([...practicals.map((b) => b.material), keyBulb.material]), seen = new Set();
      g.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material || [])) { if (seen.has(m)) continue; const e = emisAll.find((x) => x[0] === m); if (!e) continue; seen.add(m); steadyOn.mats.push({ m, e0: e[1], grp: lgOf(o), cur: upd.has(m) }); } if (o.isPointLight && o !== coalLight) steadyOn.lights.push({ l: o, i0: o.intensity, grp: lgOf(o, 'veh'), cur: o === bulbLight }); }); }
    const kS = 1 - s, kR = 1 - r, kB = Math.min(1, Math.max(0, 1 - r + bo)), kSt = 1 - 0.7 * r, dk = Math.max(0.5 * s, r), K = { S: kS, R: kR, B: kB, street: kSt, veh: 1 };
    self.lgState = { S: kS, R: kR, B: kB, street: kSt, d: dk };
    for (const x of steadyOn.mats) { const k = K[x.grp] ?? 1; if (x.cur) x.m.emissiveIntensity *= k; else x.m.emissiveIntensity = x.e0 * k; }
    for (const x of steadyOn.lights) { const k = (x.l === bulbLight && r > 0.5 ? 0.15 : 1) * (K[x.grp] ?? 1);   // the bulb back on alone, with the rest of the shop dark: the shade throws it DOWN (the episode adds the spot), not round the room
      if (x.cur) x.l.intensity *= k; else x.l.intensity = x.i0 * k; }
    cone.material.opacity *= kB;
    const L = self.lights, st = globalThis.stage, B = coldBase;
    if (L) { B.h ??= [L.hemi.color.clone(), L.hemi.groundColor.clone(), L.hemi.intensity, L.key.color.clone(), L.key.intensity, L.rim.color.clone(), L.rim.intensity, L.kick.color.clone(), L.kick.intensity, scene.fog?.color.clone(), scene.fog?.density];
      L.hemi.color.copy(B.h[0]).lerp(CC('#7e98d0'), 0.7 * dk); L.hemi.groundColor.copy(B.h[1]).lerp(CC('#242c3c'), 0.7 * dk); L.hemi.intensity = B.h[2] * (1 - 0.78 * dk);
      L.key.color.copy(B.h[3]).lerp(CC('#cfdcff'), 0.6 * dk); L.key.intensity = B.h[4] * (1 - 0.68 * dk); L.rim.color.copy(B.h[5]).lerp(CC('#86b0ff'), 0.7 * dk); L.rim.intensity = B.h[6] * (1 - 0.1 * dk);
      L.kick.color.copy(B.h[7]).lerp(CC('#6a8ac8'), dk); L.kick.intensity = B.h[8] * (1 - 0.8 * dk);
      if (scene.fog) { scene.fog.color.copy(B.h[9]).lerp(CC('#121c2c'), dk); scene.fog.density = B.h[10] * (1 + 0.3 * dk); } }
    if (st) { B.env ??= scene.environmentIntensity; scene.environmentIntensity = B.env * (1 - 0.7 * dk); }
    if (st) { const gu = st.grade.uniforms; B.g ??= [gu.sat.value, gu.contrast.value, gu.shadowTint.value.clone(), gu.hiTint.value.clone(), gu.vig.value];
      gu.sat.value = B.g[0] * (1 - 0.1 * dk); gu.shadowTint.value.copy(B.g[2]).lerp({ x: 0.0, y: 0.03, z: 0.08 }, 0.6 * dk); gu.hiTint.value.copy(B.g[3]).lerp({ x: 0.0, y: 0.02, z: 0.05 }, 0.6 * dk); gu.vig.value = B.g[4] * (1 + 0.2 * dk); }
  };
  const fx2 = (l, k) => k;
  const self = {
    group: g, light: 'warm_night',
    // Tèo and Bíp at the table; default places for the supporting cast (an episode can override any of them with its own `seats`):
    // ba / me stand at screen-right beside the table, khach sits on the second stool at screen-left. Other good spots: standing behind and between the two [0, 0, -0.6] yaw 0.
    seats: { teo: { pos: [-0.42, 0, 0], yaw: 0.3 }, bip: { pos: [0.42, 0, 0], yaw: -0.3 }, ba: { pos: [1.15, 0, -0.55], yaw: -0.5 }, me: { pos: [1.15, 0, -0.55], yaw: -0.5 }, khach: { pos: [-1.5, 0, 0.6], yaw: 1.0 } },
    glasses, keyBulb, bulbLight,
    look: { exposure: 1.0, bloom: [0.2, 0.5, 1.3], env: 0.24, grade: { contrast: 1.12, sat: 1.3, vig: 0.3, grain: 0.012, shadowTint: [0.012, 0.006, 0.02], hiTint: [0.04, 0.022, 0.0] } },
    // fx (acts on 'set'): slide = Tèo's glass pushed over to Bíp's side, buzz = the phone on the table rings, phoneUp = it has been picked up, fairy = string lights and bulb dimmed (0..1)
    update(t, fx = {}) {
      glassNode.position.set(lerp(g0.x, 0.13, fx.slide || 0), g0.y, lerp(g0.z, -0.12, fx.slide || 0));
      postUpd?.(t); spkUpd?.(t, fx); qrUpd?.(t, fx); spillUpd?.(t, fx); abUpd?.(t, fx); rowObj?.update(t, fx);
      if (tPhone) { tPhone.visible = (fx.phoneUp || 0) < 0.5; const bz = fx.buzz || 0; tPhone.rotation.z = 0.35 + bz * 0.05 * Math.sin(t * 95); tPhone.position.x = -0.2 + bz * 0.003 * Math.sin(t * 81); }
      for (const b of practicals) b.material.emissiveIntensity = (b.userData.base ??= b.material.emissiveIntensity) * (0.9 + 0.1 * Math.sin(t * 2.3 + b.userData.seed * 1.7));
      const fl = 1 + 0.04 * Math.sin(t * 9.1) * Math.sin(t * 3.7); bulbLight.intensity = 1.4 * fl; keyBulb.material.emissiveIntensity = 5 * fl; coals.material.emissiveIntensity = 2.2 + 0.5 * Math.sin(t * 5.3); cone.material.opacity = 0.035 * fl;
      movers.forEach((m, i) => { const per = [9, 12.5, 16][i], u = ((t + [2, 6.5, 11][i]) / per) % 1; if (i === 1) m.position.set(8.6, 0, 6 - u * 52); else m.position.set(5.6 + i * 0.4, 0, -46 + u * 56); });
      for (let i = 0; i < N; i++) { const a = hash(i * 1.3) * 6.28 + t * 0.05 * (hash(i) - 0.5), r = Math.sqrt(hash(i * 2.9)) * 1.25, y = ((hash(i * 4.7) + t * 0.012 * (0.5 + hash(i * 6.1))) % 1) * 2.0 + 0.1; dp[i * 3] = -0.25 + Math.cos(a) * r * (1 - y / 2.6); dp[i * 3 + 1] = y; dp[i * 3 + 2] = 0.35 + Math.sin(a) * r * (1 - y / 2.6); } dust.geometry.attributes.position.needsUpdate = true;
      plusU?.update(t, fx);
    },
  };
  const _u = self.update; self.update = (t, fx = {}) => { _u(t, fx); coldUpd(t, fx); steadyUpd(t, fx); };
  if (steadyLights) self.lgOf = (o) => lgOf(o);
  return self;
}
