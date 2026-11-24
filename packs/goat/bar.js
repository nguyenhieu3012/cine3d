// GOAT Beef: a cosy sports pub at night, as a real 3-D set with practical lights.
// World: the camera looks towards -z. Ron (screen-left, x -0.45) and Leo (+0.45) sit at z = 0 on tall bar stools at a small round high table.
// Behind Ron: a warm brick wall, the bar and its amber backbar. Behind Leo: a big window onto a night street (cool, deep, bokeh). The back wall is 3.6 m behind them.
// Everything above head height (y > 1.9) is busy (shelves, chalkboard, TV, neon); the zone straight behind the heads stays calm.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hash, lerp, clamp, canvasTex, grain, std, emis, mesh, box, cyl, ball, lathe } from '../../core/util.js';
import { contactBlob } from '../../core/rig.js';

const FONT = (px, w = 900) => `${w} ${px}px Display, sans-serif`;
const BZ = -3.6, XL = -4.6, XR = 4.6, HC = 3.7;   // back wall z, side walls x, ceiling y

const rep = (tex, rx, ry) => { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; return t; };

// one brick tile = 2.0 m x 1.024 m (9 bricks across, 16 rows)
function brickPair() {
  const cols = 9, rows = 16, draw = (c, w, h, bump) => {
    c.fillStyle = bump ? '#000' : '#2b1c16'; c.fillRect(0, 0, w, h); const bw = w / cols, bh = h / rows, gap = 5;
    for (let j = 0; j < rows; j++) for (let i = -1; i < cols; i++) { const k = hash(i * 7.1 + j * 13.7 + 1), x = (i + (j % 2) * 0.5) * bw + gap / 2, y = j * bh + gap / 2;
      if (bump) { const v = 150 + k * 90; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(x, y, bw - gap, bh - gap); continue; }
      const dark = hash(i * 3.3 + j * 5.9) > 0.88; c.fillStyle = `hsl(${6 + k * 12}, ${42 + k * 14}%, ${dark ? 14 + k * 5 : 21 + k * 10}%)`; c.fillRect(x, y, bw - gap, bh - gap);
      c.fillStyle = 'rgba(255,200,160,0.07)'; c.fillRect(x, y, bw - gap, 5); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x, y + bh - gap - 6, bw - gap, 6); }
    if (!bump) grain(c, w, h, 22000, 0.08, 4, 3);
  };
  return [canvasTex(2048, 1024, (c, w, h) => draw(c, w, h, false)), canvasTex(1024, 512, (c, w, h) => draw(c, w, h, true), { srgb: false })];
}
function woodCanvas(c, w, h, base, planks, vertical) {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let i = 0; i < planks; i++) { const k = hash(i * 3.7 + base.length), a = vertical ? i * w / planks : 0, b = vertical ? 0 : i * h / planks, pw = vertical ? w / planks : w, ph = vertical ? h : h / planks;
    c.fillStyle = `rgba(${k > 0.5 ? '255,200,140' : '0,0,0'},${0.05 + k * 0.07})`; c.fillRect(a, b, pw, ph); c.fillStyle = 'rgba(0,0,0,0.55)'; if (vertical) c.fillRect(a, b, 3, ph); else c.fillRect(a, b, pw, 3);
    for (let q = 0; q < 14; q++) { c.strokeStyle = `rgba(0,0,0,${0.05 + hash(i * 11 + q) * 0.07})`; c.lineWidth = 1 + hash(q * 3 + i) * 2; c.beginPath(); if (vertical) { const x = a + hash(i * 5 + q * 2) * pw; c.moveTo(x, 0); c.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.7, x, h); } else { const y = b + hash(i * 5 + q * 2) * ph; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + 3, w * 0.7, y - 3, w, y); } c.stroke(); } }
  grain(c, w, h, 12000, 0.07, 8, 2);
}

export function buildBar(scene, opts = {}) {
  const g = new THREE.Group(); g.name = 'bar'; scene.add(g);
  const flick = [], wireM = new THREE.MeshBasicMaterial({ color: '#0d0a0a' });
  const [brickC, brickB] = brickPair();
  const darkWood = std('#3a2314', { roughness: 0.55 }), glassM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1 });

  // ---- floor: glossy planks ----
  const plankC = canvasTex(1024, 1024, (c, w, h) => { c.fillStyle = '#4a2c16'; c.fillRect(0, 0, w, h); const rows = 12, ph = h / rows; for (let j = 0; j < rows; j++) { let x = -hash(j * 3.1) * 300; while (x < w) { const L = 380 + hash(j * 9.3 + x) * 420, k = hash(j * 5.7 + x * 0.01); c.fillStyle = `hsl(${22 + k * 8}, ${38 + k * 14}%, ${16 + k * 9}%)`; c.fillRect(x + 2, j * ph + 2, L - 4, ph - 4); for (let q = 0; q < 5; q++) { c.strokeStyle = `rgba(0,0,0,${0.05 + hash(q + x + j) * 0.08})`; c.lineWidth = 1.5; const y = j * ph + 6 + hash(q * 3 + j + x) * (ph - 12); c.beginPath(); c.moveTo(x + 4, y); c.bezierCurveTo(x + L * 0.3, y + 3, x + L * 0.7, y - 3, x + L - 4, y); c.stroke(); } x += L; } } grain(c, w, h, 14000, 0.08, 2, 3); }, { repeat: [5.8, 9.8] });
  const plankR = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#6a6a6a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = hash(i * 3.3) * w, y = hash(i * 9.1) * h, r = 40 + hash(i * 5.7) * 110, gr = c.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(20,20,20,0.9)'); gr.addColorStop(1, 'rgba(20,20,20,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } grain(c, w, h, 6000, 0.2, 9, 2); }, { srgb: false, repeat: [2.4, 4] });
  mesh(new THREE.PlaneGeometry(XR - XL, 15.6), new THREE.MeshPhysicalMaterial({ map: plankC, roughnessMap: plankR, roughness: 0.7, clearcoat: 0.3, clearcoatRoughness: 0.5, envMapIntensity: 1.2 }), [0, 0, (BZ + 12) / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });

  // ---- back wall: brick with a window opening (x 0.55 .. 3.55, y 1.0 .. 2.5) ----
  const WX0 = 0.55, WX1 = 3.55, WY0 = 1.0, WY1 = 2.5;
  const shp = new THREE.Shape(); shp.moveTo(XL, 0); shp.lineTo(XR, 0); shp.lineTo(XR, HC); shp.lineTo(XL, HC); shp.closePath();
  const hole = new THREE.Path(); hole.moveTo(WX0, WY0); hole.lineTo(WX0, WY1); hole.lineTo(WX1, WY1); hole.lineTo(WX1, WY0); hole.closePath(); shp.holes.push(hole);
  const brickM = (rx, ry) => new THREE.MeshStandardMaterial({ map: rep(brickC, rx, ry), bumpMap: rep(brickB, rx, ry), bumpScale: 2.2, roughness: 0.92, color: '#b4b4b4' });
  mesh(new THREE.ShapeGeometry(shp), brickM(0.5, 0.9766), [0, 0, BZ], g, { cast: false });
  // reveal of the window: sill, jambs, lintel, frame and mullions
  const frameM = std('#2a1a10', { roughness: 0.5 });
  box(WX1 - WX0 + 0.3, 0.08, 0.4, std('#4a3020', { roughness: 0.5 }), [(WX0 + WX1) / 2, WY0 - 0.01, BZ - 0.1], g);
  box(0.06, WY1 - WY0, 0.3, frameM, [WX0 + 0.03, (WY0 + WY1) / 2, BZ - 0.08], g); box(0.06, WY1 - WY0, 0.3, frameM, [WX1 - 0.03, (WY0 + WY1) / 2, BZ - 0.08], g);
  box(WX1 - WX0, 0.06, 0.3, frameM, [(WX0 + WX1) / 2, WY1 - 0.03, BZ - 0.08], g);
  for (const x of [1.55, 2.55]) box(0.045, WY1 - WY0, 0.05, frameM, [x, (WY0 + WY1) / 2, BZ - 0.02], g, { cast: false });
  box(WX1 - WX0, 0.04, 0.05, frameM, [(WX0 + WX1) / 2, 1.75, BZ - 0.02], g, { cast: false });

  // ---- left and right walls (brick), ceiling, dark wainscot ----
  mesh(new THREE.PlaneGeometry(15.6, HC), brickM(7.8, 3.3), [XL, HC / 2, (BZ + 12) / 2], g, { cast: false, rot: [0, Math.PI / 2, 0] });
  mesh(new THREE.PlaneGeometry(15.6, HC), brickM(7.8, 3.3), [XR, HC / 2, (BZ + 12) / 2], g, { cast: false, rot: [0, -Math.PI / 2, 0] });
  const ceilC = canvasTex(512, 512, (c, w, h) => { woodCanvas(c, w, h, '#2a1a12', 8, false); }, { repeat: [5, 8] });
  mesh(new THREE.PlaneGeometry(XR - XL, 15.6), std('#ffffff', { map: ceilC, roughness: 0.9 }), [0, HC, (BZ + 12) / 2], g, { cast: false, rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 9; i++) box(XR - XL, 0.18, 0.2, std('#24160d', { roughness: 0.8 }), [0, HC - 0.09, BZ + 0.6 + i * 1.5], g, { cast: false });
  const panelC = canvasTex(512, 512, (c, w, h) => woodCanvas(c, w, h, '#4a2a16', 6, true), { repeat: [14, 1] }), panelM = std('#ffffff', { map: panelC, roughness: 0.55 });
  box(XR - XL, 0.95, 0.07, panelM, [0, 0.475, BZ + 0.035], g, { cast: false }); box(XR - XL, 0.05, 0.12, std('#2a180d', { roughness: 0.4 }), [0, 0.97, BZ + 0.05], g, { cast: false });
  for (const [x, ry] of [[XL, Math.PI / 2], [XR, -Math.PI / 2]]) { mesh(new THREE.PlaneGeometry(15.6, 0.95), new THREE.MeshStandardMaterial({ map: rep(panelC, 28, 1), roughness: 0.55 }), [x + Math.sign(-x) * 0.04, 0.475, (BZ + 12) / 2], g, { cast: false, rot: [0, ry, 0] }); mesh(new THREE.BoxGeometry(0.1, 0.05, 15.6), std('#2a180d', { roughness: 0.4 }), [x + Math.sign(-x) * 0.05, 0.97, (BZ + 12) / 2], g, { cast: false }); }

  // ---- the night street seen through the window ----
  const skyT = canvasTex(64, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05070f'); gr.addColorStop(0.55, '#0e1632'); gr.addColorStop(0.85, '#1c2450'); gr.addColorStop(1, '#2c2850'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  mesh(new THREE.SphereGeometry(95, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }), [0, 0, 0], g, { cast: false, recv: false });
  const roadR = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#7a7a7a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) { const x = hash(i * 3.3) * w, y = hash(i * 9.1) * h, r = 30 + hash(i * 5.7) * 90, gr = c.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(20,20,20,0.95)'); gr.addColorStop(1, 'rgba(20,20,20,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } }, { srgb: false, repeat: [4, 4] });
  mesh(new THREE.PlaneGeometry(90, 40), new THREE.MeshStandardMaterial({ color: '#12141c', roughness: 0.3, roughnessMap: roadR, envMapIntensity: 2 }), [0, 0.0, BZ - 20], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  mesh(new THREE.PlaneGeometry(90, 3.4), std('#2a2a30', { roughness: 0.7 }), [0, 0.03, BZ - 1.7], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });   // pavement under the window
  box(90, 0.12, 0.2, std('#55535a', { roughness: 0.8 }), [0, 0.06, BZ - 3.4], g, { cast: false });
  for (let i = 0; i < 10; i++) mesh(new THREE.PlaneGeometry(1.6, 0.12), std('#c8c2a8', { roughness: 0.7 }), [-18 + i * 4, 0.01, BZ - 8.5], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const facade = (x, z, w, h, hue) => { const mk = (em) => canvasTex(256, 512, (ctx, W, H) => { ctx.fillStyle = em ? '#000' : `hsl(${hue}, 26%, 12%)`; ctx.fillRect(0, 0, W, H); for (let r = 0; r < 18; r++) for (let q = 0; q < 10; q++) { const lit = hash(x * 3 + z + r * 5 + q * 1.7) > 0.7; if (lit) { ctx.fillStyle = `hsl(${30 + hash(r + q + x) * 22}, 70%, ${38 + hash(r * q + x) * 14}%)`; ctx.fillRect(8 + q * 23, 14 + r * 28, 13, 18); } else if (!em) { ctx.fillStyle = '#070a16'; ctx.fillRect(8 + q * 23, 14 + r * 28, 13, 18); } } }); mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: mk(false), emissive: '#ffffff', emissiveMap: mk(true), emissiveIntensity: 0.45, roughness: 0.95 }), [x, h / 2, z], g, { cast: false, rot: [0, 0, 0] }); };
  for (let i = 0; i < 14; i++) facade(-22 + i * 4.1, BZ - 15.5, 4.1, 7 + hash(i) * 5, 215 + hash(i * 3) * 50);
  for (let i = 0; i < 6; i++) facade(-16 + i * 6.5, BZ - 36, 6.5, 14, 232);
  // a street lamp just outside, a parked car, bokeh lights, passing headlights
  const lamp = new THREE.Group(); lamp.position.set(1.0, 0, BZ - 2.6); g.add(lamp); cyl(0.04, 0.06, 3.6, std('#3a3f48', { roughness: 0.6, metalness: 0.5 }), [0, 1.8, 0], lamp, { cast: false }, 10); box(0.6, 0.05, 0.08, std('#3a3f48'), [0.3, 3.55, 0], lamp, { cast: false }); const lampBall = ball(0.11, emis('#ffd9a0', 4.5), [0.58, 3.48, 0], lamp, { cast: false, recv: false }, 14);
  const lampL = new THREE.PointLight('#ffc27a', 9, 12, 2); lampL.position.set(1.6, 3.3, BZ - 2.2); g.add(lampL);
  const car = new THREE.Group(); car.position.set(3.6, 0, BZ - 6.2); car.rotation.y = 0.06; g.add(car); mesh(new RoundedBoxGeometry(2.6, 0.55, 1.1, 4, 0.18), new THREE.MeshPhysicalMaterial({ color: '#2a3a5a', roughness: 0.3, clearcoat: 1 }), [0, 0.45, 0], car, { cast: false }); mesh(new RoundedBoxGeometry(1.4, 0.4, 0.95, 4, 0.14), new THREE.MeshPhysicalMaterial({ color: '#1a2338', roughness: 0.2, clearcoat: 1 }), [-0.1, 0.85, 0], car, { cast: false }); for (const z of [-0.4, 0.4]) ball(0.07, emis('#ff2a2a', 4), [1.3, 0.5, z], car, { cast: false, recv: false }, 8);
  const bokeh = []; for (let i = 0; i < 40; i++) { const col = ['#ffcf8a', '#ff8a5a', '#8ad0ff', '#ff5a7a', '#fff2c8', '#7affc8'][i % 6], b = ball(0.06 + hash(i) * 0.09, emis(col, 1.0 + hash(i * 3) * 1.4), [-4 + hash(i * 1.7) * 16, 0.4 + hash(i * 2.9) * 5.5, BZ - 8 - hash(i * 4.1) * 26], g, { cast: false, recv: false }, 8); b.userData.seed = i * 3; bokeh.push(b); }
  const movers = [0, 1, 2].map((i) => { const m = new THREE.Group(); g.add(m); const white = i !== 1; ball(0.1, emis(white ? '#fff6dc' : '#ff3a2a', white ? 5 : 3), [0, 0.75, 0], m, { cast: false, recv: false }, 10); return m; });
  // shop signs across the street
  for (const [x, y, w, h, col] of [[-3, 3.2, 1.6, 0.5, '#ff3a5a'], [2.5, 2.4, 1.2, 0.4, '#5ad0ff'], [7, 3.6, 1.8, 0.5, '#ffb84a'], [-9, 2.8, 1.4, 0.4, '#7affc8']]) box(w, h, 0.05, emis(col, 1.9), [x, y, BZ - 15.2], g, { cast: false, recv: false });

  // ---- bar counter, taps, backbar with amber shelves ----
  const CZ = -2.35, bar = new THREE.Group(); bar.position.set((XL - 1.5) / 2 - 0.0, 0, CZ); g.add(bar);
  const barW = -1.5 - XL;   // from the left wall to x = -1.5
  const counterM = std('#ffffff', { map: rep(panelC, 8, 1), roughness: 0.6, color: '#c9a07a' });
  box(barW, 1.0, 0.56, counterM, [0, 0.5, 0], bar); box(barW + 0.08, 0.06, 0.66, new THREE.MeshPhysicalMaterial({ color: '#2a170c', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25 }), [0, 1.03, 0], bar);
  cyl(0.045, 0.045, barW, std('#5a1010', { roughness: 0.5 }), [0, 1.08, 0.3], bar, { rot: [0, 0, Math.PI / 2] }, 14);    // padded leather arm rail
  cyl(0.02, 0.02, barW, std('#d9a840', { roughness: 0.25, metalness: 0.9 }), [0, 0.16, 0.42], bar, { rot: [0, 0, Math.PI / 2], cast: false }, 10);   // brass foot rail
  const chrome = std('#cfd3d8', { roughness: 0.18, metalness: 0.95 });
  for (let i = 0; i < 5; i++) { const x = -0.42 + i * 0.21; const tp = new THREE.Group(); tp.position.set(x, 1.06, -0.05); bar.add(tp); cyl(0.022, 0.026, 0.24, chrome, [0, 0.12, 0], tp, {}, 14); cyl(0.014, 0.014, 0.1, chrome, [0, 0.26, 0.04], tp, { rot: [Math.PI / 2, 0, 0] }, 10); cyl(0.012, 0.016, 0.07, ['#d6303f', '#2a8a4a', '#e8b030', '#3a6ad6', '#e8e0d0'][i] ? std(['#d6303f', '#2a8a4a', '#e8b030', '#3a6ad6', '#e8e0d0'][i], { roughness: 0.4 }) : chrome, [0, 0.32, 0], tp, {}, 10); }
  box(1.0, 0.012, 0.22, chrome, [0, 1.065, -0.02], bar, { cast: false });
  const pint = (x, z, par) => { const q = new THREE.Group(); q.position.set(x, 1.06 + 0.065, z); par.add(q); cyl(0.037, 0.028, 0.125, glassM, [0, 0, 0], q, { cast: false }, 18); cyl(0.034, 0.0265, 0.085, std('#c9780f', { roughness: 0.15, emissive: '#6a3208', emissiveIntensity: 0.3 }), [0, -0.018, 0], q, { cast: false }, 18); cyl(0.035, 0.034, 0.025, std('#fff6e0', { roughness: 0.9 }), [0, 0.042, 0], q, { cast: false }, 18); };
  pint(-0.2, 0.12, bar); pint(-0.9, 0.18, bar); pint(0.8, 0.1, bar);
  mesh(new THREE.BoxGeometry(0.2, 0.012, 0.14), std('#7a1a1a', { roughness: 0.9 }), [-1.2, 1.066, 0.1], bar, { cast: false, rot: [0, 0.3, 0] });
  // bar stools along the counter
  const stool = (x, z, h, col, par = g, sq = 1) => { const s = new THREE.Group(); s.position.set(x, 0, z); par.add(s); const m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.45, clearcoat: 0.4 }); cyl(0.19, 0.19, 0.05, m, [0, h - 0.025, 0], s, {}, 28); cyl(0.2, 0.2, 0.02, std('#2a2a30', { metalness: 0.7, roughness: 0.4 }), [0, h - 0.06, 0], s, { cast: false }, 28);
    const lm = std('#1a1a1e', { metalness: 0.8, roughness: 0.35 }); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, top = [Math.cos(a) * 0.12, h - 0.07, Math.sin(a) * 0.12], bot = [Math.cos(a) * 0.36, 0.0, Math.sin(a) * 0.36]; const len = Math.hypot(bot[0] - top[0], bot[1] - top[1], bot[2] - top[2]); const l = cyl(0.014, 0.014, len, lm, [(top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2, (top[2] + bot[2]) / 2], s, { cast: false }, 8); l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(bot[0] - top[0], bot[1] - top[1], bot[2] - top[2]).normalize()); }
    const ry = 0.262, rrad = lerp(0.36, 0.12, ry / (h - 0.07)); mesh(new THREE.TorusGeometry(rrad, 0.011, 8, 32), lm, [0, ry, 0], s, { rot: [Math.PI / 2, 0, 0], cast: false }); contactBlob(0.95, 0.95, s, [0, 0.005, 0], 0.65); return s; };
  for (const x of [-3.9, -3.2, -2.5, -1.9]) stool(x, -1.62, 0.72, '#7a1a1a');
  // backbar: mirror glow, shelves, bottles, strip lights
  const mirC = canvasTex(256, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffb04a'); gr.addColorStop(1, '#c8641c'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { const x = hash(i * 3) * w, r = 20 + hash(i) * 60, q = c.createRadialGradient(x, h / 2, 2, x, h / 2, r); q.addColorStop(0, 'rgba(255,240,200,0.5)'); q.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = q; c.fillRect(x - r, 0, r * 2, h); } });
  const SBX = -3.8, SBW = 1.5;
  box(SBW + 0.14, 1.75, 0.08, std('#2a170c', { roughness: 0.6 }), [SBX, 2.3, BZ + 0.1], g, { cast: false });
  mesh(new THREE.PlaneGeometry(SBW, 1.62), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: mirC, emissiveIntensity: 0.85, roughness: 1 }), [SBX, 2.3, BZ + 0.145], g, { cast: false });
  const bottleProfiles = [[[0.001, 0], [0.034, 0], [0.036, 0.02], [0.036, 0.15], [0.03, 0.2], [0.012, 0.25], [0.012, 0.3], [0.001, 0.3]], [[0.001, 0], [0.03, 0], [0.032, 0.18], [0.02, 0.24], [0.011, 0.27], [0.011, 0.31], [0.001, 0.31]], [[0.001, 0], [0.026, 0], [0.028, 0.14], [0.014, 0.2], [0.014, 0.24], [0.001, 0.24]]];
  const cols = ['#c6761a', '#2a7a3a', '#d9c88a', '#7a2a2a', '#c6761a', '#e8e0c8', '#2a4a7a'];
  for (const y of [1.58, 1.98, 2.38, 2.78]) { box(SBW, 0.03, 0.2, std('#5a3418', { roughness: 0.5 }), [SBX, y, BZ + 0.22], g, { cast: false }); box(SBW, 0.012, 0.012, emis('#ffcf8a', 1.8), [SBX, y - 0.02, BZ + 0.31], g, { cast: false, recv: false });
    for (let i = 0; i < 10; i++) { const x = SBX - SBW / 2 + 0.1 + i * (SBW - 0.2) / 9 + (hash(i + y * 7) - 0.5) * 0.03, c = cols[Math.floor(hash(i * 3.7 + y) * cols.length)]; lathe(bottleProfiles[Math.floor(hash(i * 5 + y * 3) * 3)], std(c, { roughness: 0.18, emissive: c, emissiveIntensity: 0.28 }), [x, y + 0.015, BZ + 0.22], g, { cast: false }, 14); } }
  box(SBW + 0.14, 0.06, 0.2, std('#2a170c', { roughness: 0.6 }), [SBX, 3.2, BZ + 0.15], g, { cast: false });

  // ---- chalkboard, TV, neon GOAL and OPEN, dartboard, posters (all above head height) ----
  const chalkC = canvasTex(1024, 640, (c, w, h) => { c.fillStyle = '#1b2b24'; c.fillRect(0, 0, w, h); grain(c, w, h, 9000, 0.08, 4, 3); const gr = c.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w * 0.7); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a5a30'; c.lineWidth = 34; c.strokeRect(0, 0, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f2efe0'; c.font = FONT(112); c.fillText('TONIGHT:', w / 2, 175); c.fillStyle = '#ffd86a'; c.font = FONT(122); c.fillText("WHO'S THE", w / 2, 320); c.fillStyle = '#ff8a7a'; c.font = FONT(168); c.fillText('GOAT?', w / 2, 480);
    c.strokeStyle = 'rgba(242,239,224,0.55)'; c.lineWidth = 6; c.beginPath(); c.moveTo(250, 250); c.quadraticCurveTo(w / 2, 262, w - 250, 246); c.stroke(); grain(c, w, h, 4000, 0.1, 6, 2); });
  const CBX = -2.15, CBY = 3.0; box(1.4, 0.9, 0.05, std('#4a2a14', { roughness: 0.6 }), [CBX, CBY, BZ + 0.05], g, { cast: false });
  mesh(new THREE.PlaneGeometry(1.3, 0.8125), std('#ffffff', { map: chalkC, roughness: 0.9, emissive: '#ffffff', emissiveMap: chalkC, emissiveIntensity: 0.22 }), [CBX, CBY, BZ + 0.08], g, { cast: false });
  // TV with a green pitch (redrawn each frame from t)
  const tvX = -0.15, tvY = 2.55; box(1.3, 0.78, 0.07, std('#0d0d10', { roughness: 0.35, metalness: 0.4 }), [tvX, tvY, BZ + 0.05], g, { cast: false });
  const pitchBase = document.createElement('canvas'); pitchBase.width = 512; pitchBase.height = 288; { const c = pitchBase.getContext('2d'); for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#2b8a3a' : '#31963f'; c.fillRect(i * 512 / 12, 0, 512 / 12 + 1, 288); } c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3; c.strokeRect(20, 20, 472, 248); c.beginPath(); c.moveTo(256, 20); c.lineTo(256, 268); c.stroke(); c.beginPath(); c.arc(256, 144, 36, 0, 7); c.stroke(); c.strokeRect(20, 84, 66, 120); c.strokeRect(426, 84, 66, 120); }
  const tvT = canvasTex(512, 288, () => {}); const tvC = tvT.userData.ctx;
  const tvM = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: tvT, emissiveIntensity: 1.15, roughness: 0.4 }); mesh(new THREE.PlaneGeometry(1.22, 0.686), tvM, [tvX, tvY, BZ + 0.09], g, { cast: false });
  // neon GOAL (the glow is painted into the emissive map) and a small OPEN
  const neon = (txt, w, h, col, glow, size, y0) => canvasTex(512, Math.round(512 * h / w), (c, W, H) => { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = FONT(size); c.lineJoin = 'round'; c.shadowColor = glow; c.shadowBlur = 26; c.lineWidth = 12; c.strokeStyle = glow; c.strokeText(txt, W / 2, H / 2 + y0); c.shadowBlur = 8; c.lineWidth = 6; c.strokeStyle = col; c.strokeText(txt, W / 2, H / 2 + y0); c.fillStyle = col; c.fillText(txt, W / 2, H / 2 + y0); }, { srgb: true });
  const goatT = neon('GOAL', 1.1, 0.5, '#ffd0dc', '#ff2a5a', 176, 6), goatM = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: goatT, emissiveIntensity: 1.7, transparent: false, roughness: 1 });
  box(1.2, 0.6, 0.04, std('#120c0e', { roughness: 0.8 }), [1.25, 2.95, BZ + 0.03], g, { cast: false }); mesh(new THREE.PlaneGeometry(1.1, 0.5), goatM, [1.25, 2.95, BZ + 0.055], g, { cast: false });
  const openT = neon('OPEN', 0.5, 0.22, '#d8fff0', '#2affb0', 200, 6), openM = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: openT, emissiveIntensity: 1.5, roughness: 1 });
  mesh(new THREE.PlaneGeometry(0.5, 0.22), openM, [3.05, 2.1, BZ + 0.02], g, { cast: false }); for (const dx of [-0.2, 0.2]) cyl(0.003, 0.003, 0.4, wireM, [3.05 + dx, 2.3, BZ + 0.02], g, { cast: false }, 4);
  // dartboard on the left wall
  const dartC = canvasTex(512, 512, (c, w, h) => { c.translate(256, 256); c.fillStyle = '#12100e'; c.beginPath(); c.arc(0, 0, 256, 0, 7); c.fill(); const nums = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]; for (let i = 0; i < 20; i++) { const a0 = (i - 0.5) * Math.PI / 10 - Math.PI / 2, a1 = a0 + Math.PI / 10; const ring = (r0, r1, col) => { c.fillStyle = col; c.beginPath(); c.arc(0, 0, r1, a0, a1); c.arc(0, 0, r0, a1, a0, true); c.closePath(); c.fill(); }; const even = i % 2 === 0; ring(30, 150, even ? '#16130f' : '#e8dcb0'); ring(150, 170, even ? '#d02a2a' : '#1f8a3a'); ring(170, 215, even ? '#16130f' : '#e8dcb0'); ring(215, 235, even ? '#d02a2a' : '#1f8a3a'); c.save(); c.rotate(i * Math.PI / 10); c.fillStyle = '#e8e0d0'; c.font = FONT(30, 800); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(nums[i]), 0, -249 + 8); c.restore(); } c.fillStyle = '#1f8a3a'; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill(); c.fillStyle = '#d02a2a'; c.beginPath(); c.arc(0, 0, 13, 0, 7); c.fill(); });
  cyl(0.27, 0.27, 0.05, std('#2a1a10', { roughness: 0.6 }), [XL + 0.04, 2.3, -1.3], g, { rot: [0, 0, Math.PI / 2], cast: false }, 28);
  mesh(new THREE.CircleGeometry(0.23, 40), std('#ffffff', { map: dartC, roughness: 0.8 }), [XL + 0.07, 2.3, -1.3], g, { cast: false, rot: [0, Math.PI / 2, 0] });
  // framed posters and two scarves
  const poster = (draw) => canvasTex(256, 384, (c, w, h) => draw(c, w, h));
  const posters = [
    poster((c, w, h) => { c.fillStyle = '#10204a'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8c030'; c.font = FONT(64); c.textAlign = 'center'; c.fillText('DERBY', w / 2, 70); c.fillText('NIGHT', w / 2, 130); c.fillStyle = '#d6252d'; c.beginPath(); c.arc(w / 2, 245, 62, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = FONT(70); c.fillText('7', w / 2, 270); c.fillStyle = '#74c7f0'; c.fillRect(30, 330, w - 60, 20); }),
    poster((c, w, h) => { c.fillStyle = '#74c7f0'; c.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { c.fillStyle = '#f6f9ff'; c.fillRect(i * 46 + 18, 0, 24, h); } c.fillStyle = '#16233f'; c.font = FONT(150); c.textAlign = 'center'; c.fillText('10', w / 2, 240); }),
    poster((c, w, h) => { c.fillStyle = '#e8dcb0'; c.fillRect(0, 0, w, h); c.fillStyle = '#7a1a1a'; c.font = FONT(56); c.textAlign = 'center'; c.fillText('CUP', w / 2, 80); c.fillText('FINAL', w / 2, 140); c.fillStyle = '#d9a840'; c.beginPath(); c.moveTo(80, 190); c.lineTo(176, 190); c.lineTo(150, 270); c.lineTo(106, 270); c.closePath(); c.fill(); c.fillRect(120, 270, 16, 40); c.fillRect(96, 310, 64, 14); }),
  ];
  const frame = (tex, x, y, z, ry, w = 0.5, h = 0.75) => { const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f); box(w + 0.06, h + 0.06, 0.04, std('#1a1008', { roughness: 0.5 }), [0, 0, 0], f, { cast: false }); mesh(new THREE.PlaneGeometry(w, h), std('#ffffff', { map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12 }), [0, 0, 0.022], f, { cast: false }); };
  frame(posters[0], XL + 0.04, 2.45, -2.4, Math.PI / 2); frame(posters[2], XL + 0.04, 2.5, 0.4, Math.PI / 2);
  frame(posters[1], XR - 0.04, 2.45, -2.2, -Math.PI / 2); frame(posters[0], XR - 0.04, 2.5, -0.9, -Math.PI / 2); frame(posters[2], XR - 0.04, 2.45, 0.9, -Math.PI / 2);
  frame(posters[1], 3.1, 2.95, BZ + 0.03, 0, 0.4, 0.6);
  const scarf = (x, y, z, ry, cols) => { const sg = new THREE.Group(); sg.position.set(x, y, z); sg.rotation.y = ry; g.add(sg); cols.forEach((cc, i) => box(0.07, 0.6, 0.015, std(cc, { roughness: 0.9 }), [(i - (cols.length - 1) / 2) * 0.07, 0, 0], sg, { cast: false })); };
  scarf(XL + 0.03, 1.95, -3.0, Math.PI / 2, ['#d6252d', '#f2f2f2', '#d6252d', '#f2f2f2', '#d6252d']); scarf(XR - 0.03, 1.95, -3.0, -Math.PI / 2, ['#74c7f0', '#f6f9ff', '#74c7f0', '#f6f9ff', '#74c7f0']);

  // ---- the table, the stools, other tables further back ----
  const TZ = 0.58, table = new THREE.Group(); table.position.set(0, 0, TZ); g.add(table);
  const topM = new THREE.MeshPhysicalMaterial({ color: '#4a2a14', roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.3 });
  cyl(0.5, 0.5, 0.04, topM, [0, 0.88, 0], table, {}, 48); cyl(0.5, 0.5, 0.012, std('#b88a3a', { roughness: 0.3, metalness: 0.9 }), [0, 0.866, 0], table, { cast: false }, 48);
  cyl(0.045, 0.05, 0.8, std('#1c1c20', { roughness: 0.35, metalness: 0.8 }), [0, 0.46, 0], table, {}, 16); cyl(0.3, 0.3, 0.035, std('#1c1c20', { roughness: 0.35, metalness: 0.8 }), [0, 0.0175, 0], table, {}, 32);
  contactBlob(1.3, 1.3, table, [0, 0.006, 0], 0.55);
  // two pints, a bowl of nuts, a phone
  const tp = (x, z) => { const q = new THREE.Group(); q.position.set(x, 0.9 + 0.065, z); table.add(q); cyl(0.037, 0.028, 0.125, glassM, [0, 0, 0], q, { cast: false }, 22); cyl(0.034, 0.0265, 0.088, std('#c9780f', { roughness: 0.12, emissive: '#6a3208', emissiveIntensity: 0.35 }), [0, -0.016, 0], q, {}, 22); cyl(0.035, 0.034, 0.028, std('#fff6e0', { roughness: 0.9 }), [0, 0.042, 0], q, {}, 22); return q; };
  const pints = [tp(-0.2, -0.16), tp(0.22, -0.2)];
  if (!opts.counter) {   // the counter (Ep 4) takes the middle of the table
    const bowl = lathe([[0.001, 0], [0.04, 0], [0.075, 0.03], [0.09, 0.06], [0.085, 0.062], [0.07, 0.036], [0.03, 0.01], [0.001, 0.008]], std('#e8e0d0', { roughness: 0.35 }), [0.0, 0.9, 0.12], table, {}, 28);
    for (let i = 0; i < 40; i++) { const a = hash(i * 2.3) * 6.28, r = Math.sqrt(hash(i * 5.1)) * 0.06; mesh(new THREE.SphereGeometry(0.0105, 8, 6), std(['#b9803a', '#9a6428', '#d0a05a'][i % 3], { roughness: 0.7 }), [Math.cos(a) * r, 0.9 + 0.035 + hash(i) * 0.02, 0.12 + Math.sin(a) * r], table, { scale: [0.9, 0.7, 1.2], rot: [0, hash(i * 9) * 6, 0], cast: false }); }
  }
  const ph = mesh(new RoundedBoxGeometry(0.075, 0.009, 0.15, 2, 0.004), std('#16161d', { roughness: 0.3, metalness: 0.4 }), [0.26, 0.9 + 0.005, 0.14], table, { rot: [0, -0.5, 0] }); mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#bcd8ff', emissiveIntensity: 0.9 }), [0, 0.0049, 0], ph, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  // ---- GOAT Beef Ep 4 (13/11): a desk goal counter on the table between the stools, only with setOpts.counter ----
  // setOpts.counter = { label: 'RONALDO GOALS', alt: 'WORLD CUPS' }. Acts on 'set' drive it: fx.count (the number; its fraction rolls the wheels,
  // so give the first act t < 0), fx.label (0 = label, 1 = alt, flips through 0.5), fx.press (0..1 plunger down), fx.pump (0..1: pumps 7 times a second),
  // fx.knob (turns of the reset knob), fx.cx (slides it along the table, metres; fans' poses expect 0, +0.07 or -0.07).
  let ctr = null;
  if (opts.counter) {
    const C = { label: 'RONALDO GOALS', alt: 'WORLD CUPS', ...opts.counter }, cg = new THREE.Group(); cg.position.set(0, 0.9, 0.22 - TZ); table.add(cg);
    const bodyM = std('#2b2c36', { roughness: 0.32, metalness: 0.65 }), brass = std('#e0b040', { roughness: 0.25, metalness: 0.9, emissive: '#3a2a08', emissiveIntensity: 0.3 });
    mesh(new RoundedBoxGeometry(0.2, 0.1, 0.09, 4, 0.012), bodyM, [0, 0.05, 0], cg);
    box(0.205, 0.008, 0.095, brass, [0, 0.004, 0], cg);
    for (const x of [-0.08, 0.08]) for (const z of [-0.03, 0.03]) cyl(0.009, 0.011, 0.006, brass, [x, -0.001, z], cg, {}, 12);
    const face = canvasTex(640, 320, () => {}, { mip: false }), fc = face.userData.ctx;
    mesh(new THREE.PlaneGeometry(0.184, 0.092), new THREE.MeshStandardMaterial({ map: face, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: 0.22, roughness: 0.4 }), [0, 0.05, 0.0452], cg, { cast: false });
    const plg = new THREE.Group(); cg.add(plg); cyl(0.011, 0.011, 0.034, brass, [0, 0.112, 0], plg, {}, 16); cyl(0.026, 0.026, 0.012, brass, [0, 0.13, 0], plg, {}, 28); ball(0.026, brass, [0, 0.136, 0], plg, {}, 28).scale.set(1, 0.3, 1);
    const knob = new THREE.Group(); knob.position.set(0.106, 0.05, 0); cg.add(knob); cyl(0.016, 0.016, 0.014, brass, [0, 0, 0], knob, { rot: [0, 0, Math.PI / 2] }, 20); box(0.016, 0.026, 0.005, bodyM, [0.008, 0, 0], knob);
    contactBlob(0.3, 0.16, cg, [0, 0.003, 0], 0.5);
    let key = '';
    const draw = (count, lab) => {
      const c = fc, W = 640, H = 320, n = Math.floor(count + 1e-6), f = clamp(count - n, 0, 1), dh = 196, wy = 18;
      c.fillStyle = '#1a1b22'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) {   // i = 0: thousands ... 3: units
        const x = 28 + i * 148, p10 = 10 ** (3 - i), a = Math.floor(n / p10) % 10, b = Math.floor((n + 1) / p10) % 10, roll = a !== b ? f : 0;
        c.save(); c.beginPath(); c.roundRect(x, wy, 132, dh, 16); c.fillStyle = '#05050a'; c.fill(); c.clip();
        c.fillStyle = '#f8f4ea'; c.font = FONT(178); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(a), x + 66, wy + dh / 2 + 8 - roll * dh); if (roll) c.fillText(String(b), x + 66, wy + dh / 2 + 8 + (1 - roll) * dh);
        const g = c.createLinearGradient(0, wy, 0, wy + dh); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.22, 'rgba(0,0,0,0)'); g.addColorStop(0.78, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = g; c.fillRect(x, wy, 132, dh);
        c.restore();
      }
      // the label strip flips like a split-flap card: the old text squashes to a line, the new one opens
      const ly = 236, lh = 70, k = lab < 0.5 ? 1 - lab * 2 : lab * 2 - 1, txt = lab < 0.5 ? C.label : C.alt;
      c.fillStyle = '#f2e6c8'; c.beginPath(); c.roundRect(28, ly, 584, lh, 12); c.fill();
      c.save(); c.translate(320, ly + lh / 2); c.scale(1, Math.max(0.02, k)); c.fillStyle = lab < 0.5 ? '#b0141f' : '#16336a'; c.font = FONT(56); c.textAlign = 'center'; c.textBaseline = 'middle';
      let fs = 56; while (fs > 30 && c.measureText(txt).width > 556) { fs -= 2; c.font = FONT(fs); } c.fillText(txt, 0, 3); c.restore();
      face.needsUpdate = true;
    };
    ctr = { update(t, fx) {
      const count = fx.count ?? C.start ?? 0, lab = clamp(fx.label || 0), k2 = count.toFixed(3) + '|' + lab.toFixed(3); if (k2 !== key) { key = k2; draw(count, lab); }
      cg.position.x = fx.cx || 0; plg.position.y = -0.013 * clamp((fx.press || 0) + (fx.pump || 0) * (0.5 - 0.5 * Math.cos(t * Math.PI * 14)));
      knob.rotation.x = -(fx.knob || 0) * Math.PI * 2;
    } };
    ctr.update(0, {});
  }
  // the two tall stools (feet rest on the ring 0.25 above the floor)
  for (const x of [-0.45, 0.45]) { const s = stool(x, 0, 0.69, '#7a1a1a'); s.rotation.y = x < 0 ? 0.3 : -0.3; }
  // empty tables and stools behind
  const spare = (x, z, ry) => { const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t); cyl(0.36, 0.36, 0.04, topM, [0, 0.88, 0], t, {}, 36); cyl(0.04, 0.045, 0.82, std('#1c1c20', { metalness: 0.8, roughness: 0.4 }), [0, 0.44, 0], t, {}, 12); cyl(0.24, 0.24, 0.03, std('#1c1c20', { metalness: 0.8, roughness: 0.4 }), [0, 0.015, 0], t, {}, 24); contactBlob(0.95, 0.95, t, [0, 0.005, 0], 0.5); stool(x - 0.5 * Math.cos(ry), z + 0.5 * Math.sin(ry), 0.69, '#2a4a7a'); stool(x + 0.5 * Math.cos(ry), z - 0.5 * Math.sin(ry), 0.69, '#2a4a7a'); const p = tp(0.05, 0.05); t.add(p); p.position.set(0.05, 0.965, 0.04); };
  spare(-1.8, -1.0, 0.5); spare(2.2, -1.5, -0.4); spare(3.6, 0.9, 0.2);
  // plants
  const plant = (x, z, s = 1) => { const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); g.add(p); cyl(0.2, 0.15, 0.36, std('#8a3a22', { roughness: 0.85 }), [0, 0.18, 0], p, {}, 18); for (let i = 0; i < 12; i++) { const a = i * 0.9; mesh(new THREE.SphereGeometry(0.12, 10, 8), std(i % 2 ? '#2a6a38' : '#3a8a48', { roughness: 0.75 }), [Math.cos(a) * 0.1, 0.55 + hash(i) * 0.5, Math.sin(a) * 0.1], p, { scale: [0.5, 1.8, 0.22], rot: [(hash(i) - 0.5) * 0.9, a, (hash(i * 3) - 0.5) * 1.2] }); } contactBlob(0.6, 0.6, p, [0, 0.005, 0], 0.6); };
  plant(-1.45, -2.9, 1.2); plant(4.0, -3.0, 1.35); plant(-4.1, 1.8, 1.0);

  // ---- pendant lamps (the middle one over the table is the practical key), with a soft light cone and dust ----
  const pendant = (x, y, z, sc, bulbK) => { const q = new THREE.Group(); q.position.set(x, y, z); g.add(q); cyl(0.004, 0.004, HC - y - 0.1, wireM, [0, (HC - y) / 2 + 0.05, 0], q, { cast: false }, 5);
    mesh(new THREE.CylinderGeometry(0.07 * sc, 0.26 * sc, 0.2 * sc, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#1f5a46', roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide }), [0, 0.1 * sc, 0], q, { cast: false });
    mesh(new THREE.CylinderGeometry(0.068 * sc, 0.255 * sc, 0.19 * sc, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffcf90', emissiveIntensity: 0.45, side: THREE.BackSide }), [0, 0.1 * sc, 0], q, { cast: false, recv: false });
    const b = ball(0.04 * sc, emis('#fff0c8', bulbK), [0, 0.0, 0], q, { cast: false, recv: false }, 14); b.userData.base = bulbK; flick.push(b); return q; };
  pendant(0, 2.2, TZ, 1.0, 5); pendant(-0.55, 2.55, -1.1, 0.8, 3.5); pendant(1.8, 2.45, -1.2, 0.8, 3.5);
  const coneT = canvasTex(64, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,210,150,0.55)'); gr.addColorStop(1, 'rgba(255,210,150,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const cone = mesh(new THREE.CylinderGeometry(0.07, 1.0, 1.3, 32, 1, true), new THREE.MeshBasicMaterial({ map: coneT, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), [0, 1.52, TZ], g, { cast: false, recv: false });
  const N = 110, dp = new Float32Array(N * 3), dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffe2b0', size: 0.006, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })); dust.geometry.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dust.frustumCulled = false; g.add(dust);

  // ---- small practical lights: pools of colour on the walls and the floor ----
  const L = (col, I, d, p) => { const l = new THREE.PointLight(col, I, d, 2); l.position.set(...p); g.add(l); return l; };
  const lPend = L('#ffc27a', 2.4, 7, [0, 2.1, TZ + 0.05]), lPend2 = L('#ffc27a', 1.4, 5, [-0.55, 2.4, -1.1]), lPend3 = L('#ffc27a', 1.4, 5, [1.8, 2.3, -1.2]);
  const lBack = L('#ff9a3a', 7, 7, [-3.8, 2.2, BZ + 1.1]), lTv = L('#7affc8', 1.6, 5, [tvX, 2.4, BZ + 0.9]), lNeon = L('#ff3a6a', 3.2, 5, [1.25, 2.8, BZ + 0.9]), lWin = L('#6a9aff', 6, 9, [2.0, 1.7, BZ - 0.8]);

  return {
    group: g, light: 'pub', lightAt: [0, 1.15, 0.2],
    seats: { ron: { pos: [-0.45, 0.42, 0], yaw: 0.3 }, leo: { pos: [0.45, 0.42, 0], yaw: -0.3 } },
    pints, tvM, lPend,
    look: { exposure: 0.98, bloom: [0.34, 0.6, 1.05], env: 0.24, grade: { contrast: 1.08, sat: 1.3, vig: 0.26, grain: 0.012, shadowTint: [0.012, 0.006, 0.02], hiTint: [0.04, 0.02, 0.0] } },
    tune(lights) {
      lights.key.position.set(-0.9, 2.5, 1.9); lights.key.intensity = 20; lights.hemi.intensity = 0.16;
      lights.rim.position.set(1.9, 2.4, -1.5); lights.rim.color.set('#7aa8ff'); lights.rim.intensity = 45; lights.kick.position.set(-2.0, 2.2, -1.4); lights.kick.intensity = 22;
      scene.fog = new THREE.FogExp2('#150f0e', 0.018);
    },
    update(t, fx = {}) {
      ctr?.update(t, fx);
      for (const b of flick) b.material.emissiveIntensity = b.userData.base * (1 + 0.03 * Math.sin(t * 9.1) * Math.sin(t * 3.7));
      for (const b of bokeh) b.material.emissiveIntensity = (b.userData.base ??= b.material.emissiveIntensity) * (0.88 + 0.12 * Math.sin(t * 1.9 + b.userData.seed * 1.7));
      lPend.intensity = 2.4 * (1 + 0.03 * Math.sin(t * 9.1) * Math.sin(t * 3.7)); cone.material.opacity = 0.04 * (1 + 0.04 * Math.sin(t * 9.1));
      // TV: pitch, a few players and the ball, a slight flicker
      tvC.drawImage(pitchBase, 0, 0); const bx = 256 + Math.sin(t * 0.9) * 150 + Math.sin(t * 2.3) * 40, by = 144 + Math.sin(t * 1.3) * 70;
      for (let i = 0; i < 8; i++) { const px = 256 + Math.sin(t * (0.5 + i * 0.11) + i * 2) * (60 + i * 18), py = 144 + Math.cos(t * (0.6 + i * 0.07) + i) * (50 + (i % 3) * 14); tvC.fillStyle = i < 4 ? '#e23a3a' : '#e8f0ff'; tvC.beginPath(); tvC.arc(px, py, 7, 0, 7); tvC.fill(); }
      tvC.fillStyle = '#fff'; tvC.beginPath(); tvC.arc(bx, by, 5, 0, 7); tvC.fill(); tvT.needsUpdate = true;
      const fl = 1 + 0.05 * Math.sin(t * 31) * Math.sin(t * 7.3) + (opts.flicker && hash(Math.floor(t * 18)) > 0.97 ? -0.2 : 0);   // setOpts.steady: no on/off drop-outs (60 fps smoothness)
      tvM.emissiveIntensity = 1.15 * fl; lTv.intensity = 1.6 * fl;
      goatM.emissiveIntensity = 1.7 * (opts.flicker && (Math.sin(t * 2.2) > 0.985 || (t % 11.3 > 11.1 && hash(Math.floor(t * 20)) > 0.5)) ? 0.45 : 1 + 0.03 * Math.sin(t * 40)); lNeon.intensity = 3.2 * goatM.emissiveIntensity / 1.7;
      movers.forEach((m, i) => { const per = [9, 12.5, 16][i], u = ((t + [2, 6.5, 11][i]) / per) % 1; if (i === 1) m.position.set(26 - u * 56, 0, BZ - 10.2); else m.position.set(-28 + u * 56, 0, BZ - 9.2 - i * 0.2); });
      for (let i = 0; i < N; i++) { const a = hash(i * 1.3) * 6.28 + t * 0.05 * (hash(i) - 0.5), r = Math.sqrt(hash(i * 2.9)) * 0.9, y = ((hash(i * 4.7) + t * 0.012 * (0.5 + hash(i * 6.1))) % 1) * 1.9 + 0.2; dp[i * 3] = Math.cos(a) * r * (1 - y / 3.0); dp[i * 3 + 1] = y; dp[i * 3 + 2] = TZ + Math.sin(a) * r * (1 - y / 3.0); } dust.geometry.attributes.position.needsUpdate = true;
    },
  };
}
