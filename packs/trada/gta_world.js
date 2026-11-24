// Trà đá với AI, special "Tèo vào GTA 6?" (19/11): the WORLD of the film, ONE composite set `gta` with four places: sky (the fall), plaza (the bank's square), bank (gta_bank.js), road (the coast boulevard).
// The look is a Miami-style sunset city done with free real-world cues (pink / purple / orange sky and a big low sun over the sea, tall thin palms, pastel art-deco hotels with neon tubes, wet road,
// lifeguard hut, flamingos, a pier) with the "bản Việt hoá" joke on top: Vietnamese neon words, concrete poles with tangled wires, a camera-fine box at every red light.
// Nothing here is the game's logo, typeface, character, map or a real brand / hotel name.  Every fx is a pure function of t (ramps and slow waves).  See ENGINE.md "Added 19/11, GTA world".
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LIGHT_PRESETS } from '../../core/stage.js';
import { clamp, lerp, smooth, hash, noise1, fbm1, canvasTex, grain, std, emis, mesh, box, cyl, ball } from '../../core/util.js';
import { softDisc, lightPool } from './street.js';
import { buildCar } from './gta_cars.js';
import { FONT, fitText, neonText, plateTex, glowMat, addMat, mergeList, xf, buildGtaBank, GTA_CHARS, BANK_PEOPLE } from './gta_bank.js';
import { buildGtaGym, buildGtaLair } from './gta_p2b_set.js';   // 20/11 (gta6p2b): places `gym` (beach road + a gym + the silver car) and `lair` (the tracker room), built only when asked
import { buildGtaPaint, buildGtaAlley } from './gta_p3b_set.js';   // 21/11 (gta6p3b): places `paint` and `alley`, built only when asked
import { addP3bSea } from './gta_p3b_sea.js';   // 21/11 (gta6p3b): police boats, helicopter, island, sacks added to the `sea` place when setOpts.p3b is given
import { buildStandGait } from '../../core/gait.js';   // 22/11: opt-in real walk for a stand (`gait`)
import { buildGtaSea } from './gta_sea.js';   // 20/11 (gta6p3): the beach road + pier + sea (place `sea`, built only when asked)
import { buildGtaShop } from './gta_shop.js';   // 20/11: the 24 h grocery (place `shop`, built only when asked)
export { GTA_CHARS } from './gta_bank.js';

// ---- light moods (added to the engine's table from here; nothing in core is edited) ----
Object.assign(LIGHT_PRESETS, {
  gta_sky:  { hemi: ['#d89ae0', '#5a3a78', 1.05], key: ['#ffb27a', 60, [-1.6, 2.6, 2.4]], rim: ['#ff5fb8', 90, [2.0, 2.4, -1.7]], kick: ['#4fe0e8', 30, [-2.2, 1.9, -1.2]], fog: ['#a85a9a', 0.002] },
  gta_dusk: { hemi: ['#b88ad0', '#40305a', 0.85], key: ['#ffc088', 62, [-1.6, 2.7, 2.4]], rim: ['#ff5fb8', 88, [2.0, 2.4, -1.7]], kick: ['#45dce6', 28, [-2.2, 1.9, -1.2]], fog: ['#b0507a', 0.0085] },
  gta_alley: { hemi: ['#b88ad0', '#40305a', 0.85], key: ['#ffc088', 62, [-1.6, 2.7, 2.4]], rim: ['#ff5fb8', 88, [2.0, 2.4, -1.7]], kick: ['#45dce6', 28, [-2.2, 1.9, -1.2]], fog: ['#b0507a', 0.0085] },   // 21/11 (gta6p3b): the alley's own name for the same mood as gta_dusk (same numbers: the old picture is unchanged), so look2 can light the alley apart (look2_sets.js)
  gta_plaza: { hemi: ['#a890c8', '#40305a', 0.6], key: ['#ffc088', 66, [-1.6, 2.7, 2.4]], rim: ['#ff5fb8', 70, [2.0, 2.4, -1.7]], kick: ['#45dce6', 26, [-2.2, 1.9, -1.2]], fog: ['#b0507a', 0.0025] },
  gta_bank: { hemi: ['#ffffff', '#cfd8de', 1.55], key: ['#fff6ea', 70, [-1.4, 2.7, 2.4]], rim: ['#e6f2ff', 40, [1.9, 2.5, -1.6]], kick: ['#ffffff', 22, [-2.2, 1.9, -1.2]], fog: ['#dfe6ea', 0.002] },
});
const LOOK = { bloom: [0.34, 0.65, 0.95], env: 0.3, grade: { contrast: 1.1, sat: 1.15, vig: 0.3, grain: 0.014, shadowTint: [0.0, 0.02, 0.04], hiTint: [0.045, 0.012, 0.0] } };

// ---- palette ----
const PINK = '#ff4fb8', CYAN = '#34e8ff', PURP = '#a65bff', AMBER = '#ffb040';
const PASTEL = ['#a8e6cf', '#ffa6c9', '#fff0a0', '#7fe0d8', '#ffc9a8', '#cdb8f0'];   // mint, flamingo, pale yellow, turquoise, peach, lavender
const sh = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color(k >= 0 ? '#ffffff' : '#000000'), Math.abs(k)).getHexString();

// ======================================================================================================================================
// shared: sky dome + sun, palms, lamp, deco facade, lifeguard hut, flamingo, pier
// ======================================================================================================================================
const SKY_STOPS = [[0, '#17123e'], [0.18, '#34206c'], [0.32, '#7a2e92'], [0.41, '#e0467e'], [0.465, '#ff7a64'], [0.495, '#ffb260'], [0.5, '#ffcf88'], [0.515, '#f09a86'], [0.56, '#a8587e'], [0.7, '#5a3a78'], [1, '#2a2a5a']];
export function skyDome(parent, { r = 150, sunDir = [-0.3, 0.06, -0.95], sunR = 11, stops = SKY_STOPS, clouds = true, seed = 0 } = {}) {
  const g = new THREE.Group(); g.name = 'gta_dome'; parent.add(g);
  const T = canvasTex(8, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); for (const [o, col] of stops) gr.addColorStop(o, col); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { mip: false });
  mesh(new THREE.SphereGeometry(r, 32, 24), new THREE.MeshBasicMaterial({ map: T, side: THREE.BackSide, fog: false, depthWrite: false }), [0, 0, 0], g, { cast: false, recv: false });
  const d = new THREE.Vector3(...sunDir).normalize();
  // the sun: a big low disc (hot core, soft rim) + a wide pink-orange glow + a thin horizon band
  const discT = canvasTex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.8, 'rgba(255,226,150,1)'); gr.addColorStop(0.955, 'rgba(255,150,90,1)'); gr.addColorStop(0.985, 'rgba(255,120,90,0.6)'); gr.addColorStop(1, 'rgba(255,110,90,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { mip: false });
  const place = (m, dist) => { m.position.copy(d).multiplyScalar(dist); m.lookAt(0, 0, 0); m.renderOrder = 1; return m; };
  const sun = place(new THREE.Mesh(new THREE.PlaneGeometry(sunR * 2, sunR * 2), new THREE.MeshBasicMaterial({ map: discT, transparent: true, depthWrite: false, fog: false, toneMapped: false })), r * 0.92); g.add(sun);
  const glow = place(new THREE.Mesh(new THREE.PlaneGeometry(sunR * 9, sunR * 9), addMat(softDisc([[0, 'rgba(255,170,120,0.5)'], [0.3, 'rgba(255,100,150,0.28)'], [1, 'rgba(255,60,150,0)']]), '#ffffff', 0.55)), r * 0.9); g.add(glow);
  if (clouds) { const cT = canvasTex(256, 64, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.save(); c.translate(0, 0); c.scale(1, h / w * 2); c.fillStyle = gr; c.fillRect(0, -w / 2 + h / 2 / (h / w * 2) - h / 2, w, w); c.restore(); }, { mip: false });
    for (let i = 0; i < 22; i++) { const az = Math.atan2(d.x, -d.z) + (hash(i * 3.1 + seed) - 0.5) * 3.0 + (i > 17 ? Math.PI : 0), el = (0.03 + 0.35 * Math.pow(hash(i * 5.7 + seed), 1.6)), dist = r * 0.88, w = 30 + 60 * hash(i * 7.3 + seed), warm = 1 - clamp(el / 0.28), col = new THREE.Color('#7a4ab0').lerp(new THREE.Color('#ff7aa0'), warm).lerp(new THREE.Color('#ffb070'), Math.max(0, warm - 0.6) * 1.6);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.11), new THREE.MeshBasicMaterial({ map: cT, color: col, transparent: true, opacity: 0.55 + 0.25 * warm, depthWrite: false, fog: false })); m.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, -Math.cos(az) * Math.cos(el) * dist); m.lookAt(0, 0, 0); m.renderOrder = 0; g.add(m); } }
  return g;
}

// the palm: a tall thin trunk with a slight lean and a crown of drooping fronds, returned as geometry lists to merge (trunks and fronds are two meshes per row)
function frondGeo() {
  const g = new THREE.PlaneGeometry(1, 1, 1, 6), p = g.attributes.position, L = 3.6;
  for (let i = 0; i < p.count; i++) { const row = Math.floor(i / 2), s = row / 6, side = i % 2 ? 1 : -1, w = 0.62 * Math.sin(Math.PI * (0.12 + 0.88 * s)) * (1 - 0.45 * s); p.setXYZ(i, side * w, -0.95 * s * s * 1.1, s * L); }
  g.computeVertexNormals(); return g;
}
let _FROND = null;
export function addPalm(trunks, fronds, x, z, H, seed, y0 = 0) {
  _FROND ??= frondGeo(); const lean = (hash(seed * 1.7) - 0.5) * 0.9, yaw = hash(seed * 2.3) * 6.28;
  const tg = new THREE.CylinderGeometry(0.15, 0.27, H, 7, 6, false); tg.translate(0, H / 2, 0); const tp = tg.attributes.position; for (let i = 0; i < tp.count; i++) { const k = tp.getY(i) / H; tp.setX(i, tp.getX(i) + lean * k * k * H * 0.12); }
  tg.computeVertexNormals(); trunks.push([tg, xf([x, y0, z], [0, yaw, 0])]);
  const cx = lean * H * 0.12, n = 9;
  for (let i = 0; i < n; i++) { const a = yaw + i / n * Math.PI * 2 + hash(i + seed) * 0.4, tilt = 0.15 + 0.7 * hash(i * 3.3 + seed * 5), sc = 0.85 + 0.35 * hash(i * 9.1 + seed);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x + cx * Math.cos(yaw) , y0 + H, z - cx * Math.sin(yaw) * 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt, a, 0, 'YXZ')), new THREE.Vector3(sc, sc, sc)); fronds.push([_FROND, m]); }
}
export function finishPalms(parent, trunks, fronds, { leaf = '#14403c', trunk = '#4a3a3a' } = {}) {
  if (trunks.length) mergeList(trunks, std(trunk, { roughness: 0.85 }), parent, { recv: false });
  if (fronds.length) mergeList(fronds, new THREE.MeshStandardMaterial({ color: leaf, roughness: 0.7, side: THREE.DoubleSide, emissive: '#0a2a2a', emissiveIntensity: 0.4 }), parent, { recv: false });
}

// art-deco street lamp: pole, curved arm, a pink-white globe (emissive) and a light pool
export function deco_lamp(parent, x, z, face = 1, col = '#ff9fd0') {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); const m = std('#2a2a38', { roughness: 0.5, metalness: 0.4 });
  cyl(0.09, 0.14, 4.6, m, [0, 2.3, 0], g, { cast: false }, 10); box(0.34, 0.2, 0.34, m, [0, 0.1, 0], g, { cast: false }); box(0.55, 0.06, 0.06, m, [face * 0.27, 4.6, 0], g, { cast: false });
  ball(0.22, new THREE.MeshStandardMaterial({ color: '#000', emissive: col, emissiveIntensity: 3.2 }), [face * 0.55, 4.55, 0], g, { cast: false }, 14);
  lightPool(g, [face * 0.55, 0.03, 0], 2.8, col, 0.4); return g;
}

// a canvas deco FRONT (9 m wide): pastel wall, eyebrow lines, lit windows, a porthole, neon outline, neon sign. Returns [map, emissive]. opts: { word, neon, floors, wall, door:false }
const DECO_W = 9, PPM = 56;
export function decoFront({ seed = 1, word = 'KARAOKE', neon = PINK, wall = PASTEL[0], floors = 4, w = DECO_W, bank = false, alpha = false } = {}) {
  const Wp = Math.round(w * PPM), gh = bank ? 5.0 : 4.4, fh = 3.0, Hm = gh + fh * (floors - 1) + 1.1, Hp = Math.round(Hm * PPM);
  const draw = (c, em) => {
    const base = em ? '#000' : wall; c.fillStyle = base; c.fillRect(0, 0, Wp, Hp);
    const Y = (m) => Hp - m * PPM;   // metres above the floor -> canvas y
    if (!em) { const gr = c.createLinearGradient(0, 0, 0, Hp); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(60,20,80,0.2)'); c.fillStyle = gr; c.fillRect(0, 0, Wp, Hp);
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(Wp * 0.1 * i * 1.6 + 6, 0, 8, Hp); } }
    // parapet band with a stepped top and a neon outline
    const top = Hm; if (!em) { c.fillStyle = sh(wall, 0.35); c.fillRect(0, Y(top), Wp, 0.8 * PPM); c.fillStyle = sh(wall, -0.12); c.fillRect(0, Y(top) + 0.8 * PPM, Wp, 5); }
    const tube = (col, lw = 6) => { c.save(); c.shadowColor = col; c.shadowBlur = em ? 18 : 0; c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; if (em) c.stroke(); else { c.globalAlpha = 0.9; c.stroke(); } c.restore(); };
    c.beginPath(); c.roundRect(0.3 * PPM, Y(top) + 0.14 * PPM, Wp - 0.6 * PPM, 0.52 * PPM, 12); tube(neon, 6);
    // floors above the ground floor
    for (let f = 1; f < floors; f++) { const y0 = gh + (f - 1) * fh, wy = y0 + 0.7, wh = 1.75;
      for (let k = 0; k < 3; k++) { const x = (0.9 + k * 2.95) * PPM, ww = 1.7 * PPM, lit = hash(seed * 7 + f * 3 + k * 11) < 0.55, rnd = hash(seed + f * 5 + k * 13) > 0.5;
        c.beginPath(); c.roundRect(x, Y(wy + wh), ww, wh * PPM, 10);
        if (!em) { c.fillStyle = '#2a2a42'; c.fill(); c.save(); c.clip(); const gg = c.createLinearGradient(0, Y(wy + wh), 0, Y(wy)); gg.addColorStop(0, '#ff7ab0'); gg.addColorStop(1, '#6a4a9a'); c.globalAlpha = 0.65; c.fillStyle = gg; c.fillRect(x, Y(wy + wh), ww, wh * PPM); c.restore(); c.lineWidth = 5; c.strokeStyle = sh(wall, -0.3); c.stroke(); for (let b = 0; b < 4; b++) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + 6, Y(wy) - (b + 1) * 5.0 * 4, ww - 12, 3); } }
        else if (lit) { c.fillStyle = rnd ? '#ffb86a' : '#ff80c8'; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; }
        // eyebrow ledge above each window
        if (!em) { c.fillStyle = sh(wall, 0.55); c.fillRect(x - 0.18 * PPM, Y(wy + wh) - 9, ww + 0.36 * PPM, 8); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x - 0.18 * PPM, Y(wy + wh) - 1, ww + 0.36 * PPM, 3); } }
      if (!em) { c.fillStyle = sh(wall, -0.2); c.fillRect(0, Y(y0 + fh - 0.02), Wp, 5); } }
    // the top floor gets a porthole (art deco) between two neon lines
    { const py = gh + (floors - 1) * fh - 0.55; c.beginPath(); c.arc(Wp / 2, Y(py), 0.42 * PPM, 0, 7); if (!em) { c.fillStyle = '#2a2a42'; c.fill(); c.lineWidth = 6; c.strokeStyle = sh(wall, -0.3); c.stroke(); } else { c.fillStyle = hash(seed) > 0.4 ? '#ffb86a' : '#7ff0ff'; c.globalAlpha = 0.8; c.fill(); c.globalAlpha = 1; } }
    // vertical neon fin on the left
    c.beginPath(); c.moveTo(0.34 * PPM, Y(top) + 0.8 * PPM); c.lineTo(0.34 * PPM, Y(gh)); tube(neon === CYAN ? PINK : CYAN, 7);
    // ground floor: shop window, door, neon word
    { const gy1 = gh - 1.2, gy0 = 0.3; c.beginPath(); c.roundRect(1.0 * PPM, Y(gy1), (w - 3.4) * PPM, (gy1 - gy0) * PPM, 14);
      if (!em) { c.fillStyle = '#2a1e30'; c.fill(); c.save(); c.clip(); const gg = c.createLinearGradient(0, Y(gy1), 0, Y(gy0)); gg.addColorStop(0, '#6a3a6a'); gg.addColorStop(1, '#ffb27a'); c.globalAlpha = 0.9; c.fillStyle = gg; c.fillRect(0, 0, Wp, Hp); c.restore(); c.lineWidth = 7; c.strokeStyle = sh(wall, -0.35); c.stroke(); for (let k = 1; k < 4; k++) { c.fillStyle = sh(wall, -0.35); c.fillRect(1.0 * PPM + k * (w - 3.4) * PPM / 4 - 3, Y(gy1), 6, (gy1 - gy0) * PPM); } }
      else { c.fillStyle = '#ffa860'; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; for (let k = 1; k < 4; k++) { c.fillStyle = '#000'; c.fillRect(1.0 * PPM + k * (w - 3.4) * PPM / 4 - 3, Y(gy1), 6, (gy1 - gy0) * PPM); } }
      // door at the right
      const dx = (w - 2.2) * PPM; c.beginPath(); c.roundRect(dx, Y(2.7), 1.5 * PPM, 2.4 * PPM, [14, 14, 0, 0]); if (!em) { c.fillStyle = '#3a2a40'; c.fill(); c.lineWidth = 6; c.strokeStyle = sh(wall, -0.35); c.stroke(); } else { c.fillStyle = '#ff9a70'; c.globalAlpha = 0.8; c.fill(); c.globalAlpha = 1; } }
    // the sign: a rounded neon plate between the floors, a deco curve under it
    { const sy = gh - 0.55, sw = (w - 3.0) * PPM; c.beginPath(); c.roundRect(1.0 * PPM, Y(sy) - 0.52 * PPM, sw, 1.04 * PPM, 20);
      if (!em) { c.fillStyle = '#1a1230'; c.fill(); c.lineWidth = 5; c.strokeStyle = neon; c.stroke(); } else { tube(neon, 7); }
      neonText(c, word, 1.0 * PPM + sw / 2, Y(sy) + 0.1 * PPM, 0.6 * PPM, neon, { glow: em ? 0.5 : 0.0, maxW: sw - 30, core: em ? '#ffffff' : '#ffe8f4', tube: 0.11 }); }
    // wet pavement sheen at the foot, so the building meets the ground
    if (!em) { const gg = c.createLinearGradient(0, Hp - 40, 0, Hp); gg.addColorStop(0, 'rgba(20,10,40,0)'); gg.addColorStop(1, 'rgba(20,10,40,0.5)'); c.fillStyle = gg; c.fillRect(0, Hp - 40, Wp, 40); grain(c, Wp, Hp, 5000, 0.07, seed, 3); }
  };
  return { maps: [canvasTex(Wp, Hp, (c) => draw(c, false)), canvasTex(Wp, Hp, (c) => draw(c, true))], H: Hm, gh, fh, fl: floors };
}

// the lifeguard hut: stilts, a candy-striped box, a roof and a flag (bright stripes, no real beach)
export function lifeguardHut(parent, x, z, yaw = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; parent.add(g);
  const stripe = canvasTex(256, 128, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : ['#ff4fa0', '#2ad6d0'][0]; c.fillRect(i * 32, 0, 32, h); } }, { repeat: [1, 1] });
  const stripe2 = canvasTex(256, 128, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fff6c8' : '#27d6d0'; c.fillRect(i * 32, 0, 32, h); } });
  const wood = std('#d8b890', { roughness: 0.8 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(0.07, 0.07, 1.6, wood, [sx * 0.85, 0.8, sz * 0.7], g, {}, 8);
  box(2.1, 0.08, 1.8, wood, [0, 1.6, 0], g); box(1.7, 1.25, 1.35, std('#fff', { map: stripe, roughness: 0.6 }), [0, 2.25, 0], g);
  const roof = mesh(new THREE.ConeGeometry(1.5, 0.75, 4), std('#ff4fa0', { roughness: 0.6 }), [0, 3.25, 0], g, { rot: [0, Math.PI / 4, 0], scale: [1.0, 1, 0.82] });
  box(1.1, 0.5, 0.04, new THREE.MeshStandardMaterial({ map: stripe2, roughness: 0.6 }), [0, 2.3, 0.7], g, { cast: false });   // front board
  box(0.7, 0.55, 0.05, std('#1a2a3a'), [0, 2.0, 0.69], g, { cast: false });   // window
  cyl(0.02, 0.02, 1.2, wood, [0.9, 3.55, 0.5], g, {}, 6); mesh(new THREE.PlaneGeometry(0.55, 0.32), new THREE.MeshStandardMaterial({ color: '#ff5a3a', side: THREE.DoubleSide, roughness: 0.8, emissive: '#ff3a20', emissiveIntensity: 0.25 }), [1.17, 3.95, 0.5], g, { cast: false });
  for (let i = 0; i < 5; i++) box(0.6, 0.04, 0.12, wood, [0, 0.2 + i * 0.32, 0.98 + i * 0.0], g, { cast: false, rot: [0.0, 0, 0] });   // ladder rungs
  return g;
}
// lawn-ornament flamingo (bright pink, emissive-ish so it reads at dusk)
export function flamingo(parent, x, z, yaw = 0, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; g.scale.setScalar(s); parent.add(g);
  const pink = new THREE.MeshStandardMaterial({ color: '#ff6fae', roughness: 0.45, emissive: '#ff3a8a', emissiveIntensity: 0.35 }), leg = std('#ff4f90');
  mesh(new THREE.SphereGeometry(0.32, 20, 14), pink, [0, 0.95, 0], g, { scale: [0.8, 0.85, 1.25] });
  mesh(new THREE.ConeGeometry(0.22, 0.5, 14), pink, [0, 0.98, -0.38], g, { rot: [-Math.PI / 2 - 0.2, 0, 0] });
  const pts = [[0, 1.08, 0.28], [0, 1.45, 0.42], [0, 1.78, 0.34], [0, 2.0, 0.14], [0, 2.02, 0.0]].map((p) => new THREE.Vector3(...p));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.065, 8), pink, [0, 0, 0], g); ball(0.1, pink, [0, 2.04, -0.02], g, {}, 12);
  mesh(new THREE.ConeGeometry(0.045, 0.2, 8), std('#2a2230'), [0, 2.0, -0.17], g, { rot: [-Math.PI / 2, 0, 0] });
  for (const sx of [-0.09, 0.09]) cyl(0.018, 0.018, 0.78, leg, [sx, 0.4, 0.0], g, {}, 6); box(0.2, 0.03, 0.2, std('#c8b090'), [0, 0.015, 0], g, { cast: false });
  return g;
}
// a pier / marina silhouette: a long dark deck on posts with a few warm lamps, for the far distance
export function pier(parent, x, z, len, yaw = 0, y = 0.4) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g); const dk = std('#1a1428', { roughness: 0.9 });
  box(2.4, 0.3, len, dk, [0, 0.5, -len / 2], g, { cast: false }); for (let i = 0; i < Math.floor(len / 5); i++) { for (const s of [-1, 1]) cyl(0.12, 0.12, 1.6, dk, [s * 1.0, -0.2, -i * 5 - 2], g, { cast: false }, 6); }
  for (let i = 0; i < Math.floor(len / 12); i++) { const zz = -i * 12 - 4; cyl(0.05, 0.05, 2.2, dk, [0.9, 1.6, zz], g, { cast: false }, 6); ball(0.2, new THREE.MeshStandardMaterial({ color: '#000', emissive: i % 2 ? '#ff9fd0' : '#ffd08a', emissiveIntensity: 3 }), [0.9, 2.8, zz], g, { cast: false }, 8); }
  box(5, 2.4, 6, dk, [0, 2, -len + 3], g, { cast: false }); return g;
}
// sea: gradient plane that fades to nothing at its rim; follows nobody (the caller moves it)
export function seaPlane(parent, { size = 380, y = -0.35, near = '#16305e', far = '#c85a8a', rimAlpha = true } = {}) {
  const T = canvasTex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, near); gr.addColorStop(0.55, sh(near, 0.25)); gr.addColorStop(0.9, far); gr.addColorStop(1, far); c.fillStyle = gr; c.fillRect(0, 0, w, h); const a = c.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2); a.addColorStop(0, 'rgba(0,0,0,1)'); a.addColorStop(0.8, 'rgba(0,0,0,1)'); a.addColorStop(1, 'rgba(0,0,0,0)'); c.globalCompositeOperation = 'destination-in'; c.fillStyle = a; c.fillRect(0, 0, w, h); }, { mip: false });
  const m = mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: T, transparent: true, depthWrite: false, fog: false }), [0, y, 0], parent, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }); m.renderOrder = 0; return m;
}
// a glitter path on the water towards the sun: soft additive strip with slow shimmer
export function glitter(parent, { dir = [-0.3, 0, -0.95], from = 12, to = 150, w0 = 3, w1 = 26, y = -0.3, col = '#ffc890' } = {}) {
  const d = new THREE.Vector3(dir[0], 0, dir[2]).normalize(), T = canvasTex(64, 256, (c, w, h) => { const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0.2)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(0,0,0,${0.5 + 0.5 * hash(i)})`; c.fillRect(hash(i * 3.3) * w, hash(i * 7.1) * h, 4 + hash(i * 9) * 14, 2 + hash(i * 5.7) * 3); } const a = c.createLinearGradient(0, 0, w, 0); a.addColorStop(0, 'rgba(0,0,0,0)'); a.addColorStop(0.5, 'rgba(0,0,0,1)'); a.addColorStop(1, 'rgba(0,0,0,0)'); c.globalCompositeOperation = 'destination-in'; c.fillStyle = a; c.fillRect(0, 0, w, h); }, { mip: false });
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1), p = geo.attributes.position;   // a trapezoid: narrow at the near end, wide at the sun
  p.setXYZ(0, -w1 / 2, 0, -to); p.setXYZ(1, w1 / 2, 0, -to); p.setXYZ(2, -w0 / 2, 0, -from); p.setXYZ(3, w0 / 2, 0, -from);
  const m = new THREE.Mesh(geo, addMat(T, col, 0.8)); m.rotation.y = Math.atan2(-d.x, -d.z) * 1 + 0; m.position.y = y; m.renderOrder = 1; const g = new THREE.Group(); g.add(m); g.rotation.y = Math.atan2(d.x, -d.z) * -1; g.userData.mat = m.material; parent.add(g); return g;
}

// ======================================================================================================================================
// SKY: the fall
// ======================================================================================================================================
export function buildGtaSky(scene, { at = [0, 0, 0], sunDir = [-0.17, 0.035, -0.985] } = {}) {
  const g = new THREE.Group(); g.name = 'gta_sky'; g.position.set(...at); scene.add(g);
  skyDome(g, { r: 150, sunDir, sunR: 12, seed: 3 });
  // ---- the city far below (a diorama: nothing here is life-size; it sits inside the 200 m clip): sea, coast, lit blocks, palms, a pier, traffic lines ----
  const city = new THREE.Group(); g.add(city);
  const sea = seaPlane(city, { size: 360, y: 0, near: '#1c2a60', far: '#d0628c' }); sea.position.set(0, 0, -95);
  const gl = glitter(city, { dir: sunDir, from: 20, to: 170, w0: 6, w1: 48, y: 0.12 }); gl.position.set(0, 0, 0);
  // land: a polygon coast on the right / near side, dark violet with a lit street grid (emissive)
  const landT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#20143a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffb060'; c.lineWidth = 2; for (let i = 0; i < 16; i++) { c.globalAlpha = 0.5 + 0.4 * hash(i); c.beginPath(); c.moveTo(i * 32 + 6, 0); c.lineTo(i * 32 + 6, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 32 + 12); c.lineTo(w, i * 32 + 12); c.stroke(); } c.globalAlpha = 1; for (let i = 0; i < 260; i++) { c.fillStyle = ['#ff7ab8', '#ffc880', '#7ff0ff'][i % 3]; c.fillRect(hash(i * 1.7) * w, hash(i * 2.9) * h, 3, 3); } });
  const xc = (z) => -24 + 0.3 * (-z - 40);   // the coast line: land lies to its right
  const shape = new THREE.Shape(); shape.moveTo(-30, 35); shape.lineTo(xc(-40), 40); shape.lineTo(xc(-190), 190); shape.lineTo(190, 190); shape.lineTo(190, 35); shape.closePath();
  const land = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ map: landT, emissive: '#ffffff', emissiveMap: landT, emissiveIntensity: 0.9, roughness: 1 })); land.rotation.x = -Math.PI / 2; land.position.y = 0.2; city.add(land);
  const uv = land.geometry.attributes.uv, pos = land.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 40, pos.getY(i) / 40);
  // blocks: pastel low-rise + a few towers, each a box with a window texture
  const winT = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#2a2040'; c.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 16) { c.fillStyle = hash(x * 3.1 + y * 7.7) > 0.4 ? ['#ffc07a', '#ff80c8', '#9ff0ff'][(x + y) % 3] : '#3a3058'; c.fillRect(x, y, 9, 8); } }, { repeat: [1, 1] });
  const bm = new THREE.MeshStandardMaterial({ map: winT, emissive: '#ffffff', emissiveMap: winT, emissiveIntensity: 0.9, roughness: 0.8 }), list = [];
  for (let i = 0; i < 260; i++) { const z = -38 - hash(i * 2.9) * 150, x = xc(z) + 2 + hash(i * 1.3) * 110; if (x > 100 + (-z) * 0.3) continue; const far = (-z - 38) / 150, hh = 2.5 + 16 * Math.pow(hash(i * 5.1), 2.2) * (0.5 + far), w = 3 + hash(i * 7) * 5; list.push([new THREE.BoxGeometry(w, hh, w * (0.8 + hash(i))), xf([x, hh / 2 + 0.2, z])]); }
  mergeList(list, bm, city, { cast: false, recv: false });
  const tr = [], fr = []; for (let i = 0; i < 26; i++) { const z = -36 - i * 5.2, x = xc(z) - 0.8 + (hash(i * 3.3) - 0.5) * 2; addPalm(tr, fr, x, z, 6 + hash(i * 2) * 3, i + 40, 0.2); }   // palms along the near coast, in silhouette
  finishPalms(city, tr, fr, { leaf: '#2a1a4a', trunk: '#2a1a4a' });
  pier(city, -8, -42, 55, 0.2, 0.2);
  // the wind and the clouds: streaks that rush UP past the pair (pure function of t), wisps behind
  const stT = canvasTex(16, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); const a = c.createLinearGradient(0, 0, w, 0); a.addColorStop(0, 'rgba(0,0,0,0)'); a.addColorStop(0.5, 'rgba(0,0,0,1)'); a.addColorStop(1, 'rgba(0,0,0,0)'); c.globalCompositeOperation = 'destination-in'; c.fillStyle = a; c.fillRect(0, 0, w, h); }, { mip: false });
  const wispT = canvasTex(256, 128, (c, w, h) => { for (let i = 0; i < 7; i++) { const x = w * (0.12 + 0.76 * hash(i * 2.3)), y = h * (0.35 + 0.3 * hash(i * 5.1)), r = 28 + 26 * hash(i * 7.7), gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); } }, { mip: false });
  const streaks = [], wisps = [], STN = 46, WSN = 20;
  for (let i = 0; i < STN; i++) { const near = i % 3 === 0, m = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + 0.07 * hash(i), 1), addMat(stT, i % 2 ? '#ffd8f0' : '#bff6ff', 0.6)); m.renderOrder = 4; g.add(m); streaks.push({ m, x: (hash(i * 3.7) < 0.5 ? -1 : 1) * (0.85 + 3.0 * hash(i * 5.3)), z: near ? 0.9 + 1.2 * hash(i) : -2.5 * hash(i * 2.2) - 0.3, len: 1.5 + 4.5 * hash(i * 9.1), v: 9 + 8 * hash(i * 7.9), ph: hash(i * 11.3) }); }
  for (let i = 0; i < WSN; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: wispT, color: i % 2 ? '#ffb8e0' : '#e8c8ff', transparent: true, opacity: 0, depthWrite: false })); m.renderOrder = 3; g.add(m); const back = i % 2 === 0; wisps.push({ m, x: (hash(i * 4.1) - 0.5) * (back ? 26 : 9), z: back ? -8 - 40 * hash(i * 2.7) : -3 - 2 * hash(i * 8.3), s: back ? 5 + 9 * hash(i) : 1.8 + 2.2 * hash(i), v: back ? 3.5 : 7 + 3 * hash(i), ph: hash(i * 6.1), back }); }
  const HY = 9;   // loop height (m): +-HY/2 around the pair
  const seats = {}, cams = {}; const S = (n, p, yaw = 0) => { seats[n] = { pos: [p[0] + at[0], p[1] + at[1], p[2] + at[2]], yaw }; };
  S('fall_teo', [-0.45, 0, 0], 0.15); S('fall_bip', [0.5, 0, 0], -0.15);   // y 0 = the pair's own level; the world is what moves
  cams.fall = { from: [0, -0.55, 4.2], at: [0.0, 0.25, 0], f: 42 }; cams.fall_wide = { from: [0.4, -0.9, 6.5], at: [0, -1.5, 0], f: 30 }; cams.fall_low = { from: [0, -2.2, 3.4], at: [0, 0.2, 0], f: 34 };
  for (const k of Object.keys(cams)) { cams[k].from = cams[k].from.map((v, i) => v + at[i]); cams[k].at = cams[k].at.map((v, i) => v + at[i]); }
  const update = (t, fx = {}) => {
    const d = smooth(clamp(fx.descend || 0)), alt = lerp(20, 6, d);   // the coast city rises towards the pair: 20 m below to 6 m (diorama units, not life size)
    city.position.set(0, -alt, 0); city.scale.setScalar(1 + 0.25 * d);
    // sun-glitter shimmer: slow wave
    gl.userData.mat.opacity = 0.7 + 0.15 * Math.sin(t * 1.1);
    const wind = 0.35 + 0.65 * clamp(fx.wind ?? 1);
    for (const s of streaks) { const u = ((s.ph + t * s.v * wind / (HY * 1.0)) % 1 + 1) % 1, y = (u - 0.5) * HY * 1.4 - s.len * 0; s.m.scale.set(1, s.len, 1); s.m.position.set(s.x, y, s.z); s.m.material.opacity = 0.55 * Math.pow(Math.sin(Math.PI * u), 0.8) * wind; }
    for (const w of wisps) { const u = ((w.ph + t * w.v / (HY * 2.2)) % 1 + 1) % 1, y = (u - 0.5) * HY * 2.2; w.m.scale.set(w.s * 0.7, w.s * 1.5, 1); w.m.position.set(w.x, y, w.z); w.m.material.opacity = (w.back ? 0.55 : 0.35) * Math.pow(Math.sin(Math.PI * u), 1.2); }
  };
  return { group: g, seats, cams, update, look: LOOK, light: 'gta_sky', lightAt: [0, 0.2, 0] };
}

// ======================================================================================================================================
// PLAZA: the square in front of the bank, at dusk, Miami deco
// ======================================================================================================================================
export function buildGtaPlaza(scene, { at = [0, 0, 0], sunDir = [-0.78, 0.07, -0.62] } = {}) {
  const g = new THREE.Group(); g.name = 'gta_plaza'; g.position.set(...at); scene.add(g);
  skyDome(g, { r: 150, sunDir, sunR: 12, seed: 7 });
  const sea = seaPlane(g, { size: 340, y: -0.45, near: '#1b2c64', far: '#d2608c' }); sea.position.set(-175, 0, -20); glitter(g, { dir: sunDir, from: 30, to: 150, w0: 8, w1: 55, y: -0.3 });
  // ---- ground: pale pavers with pink-teal tint, a kerb and a road along x (z 3.2 .. 11) ----
  const paveT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#b4a2b4'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#bfacbc' : '#a894a8'; c.fillRect(i * 128 + 3, j * 128 + 3, 122, 122); } grain(c, w, h, 4000, 0.08, 6, 3); }, { repeat: [14, 5] });
  mesh(new THREE.PlaneGeometry(26, 10.5), new THREE.MeshStandardMaterial({ map: paveT, roughness: 0.45 }), [1, 0, -2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const roadT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#2a2634'; c.fillRect(0, 0, w, h); grain(c, w, h, 6000, 0.06, 3, 2); }, { repeat: [10, 1] });
  mesh(new THREE.PlaneGeometry(60, 9), new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.3, envMapIntensity: 1.2 }), [-4, 0.001, 8.2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  box(60, 0.14, 0.3, std('#e8e0ec'), [-4, 0.07, 3.3], g, { cast: false }); for (let i = 0; i < 12; i++) box(2.2, 0.01, 0.16, std('#ffe9a0', { emissive: '#ffd070', emissiveIntensity: 0.3 }), [-26 + i * 5, 0.012, 8.2], g, { cast: false });
  // sand + the promenade rail at the left, sea beyond
  const sandT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#e8c8a6'; c.fillRect(0, 0, w, h); grain(c, w, h, 5000, 0.1, 9, 2); }, { repeat: [6, 6] });
  mesh(new THREE.PlaneGeometry(14, 26), new THREE.MeshStandardMaterial({ map: sandT, color: '#d8a6a0', roughness: 1 }), [-19, -0.03, 0], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  for (let i = 0; i < 9; i++) box(0.1, 0.8, 0.1, std('#f0e0ec'), [-12.2, 0.4, -6 + i * 1.7], g, { cast: false }); box(0.08, 0.08, 14.4, std('#f0e0ec'), [-12.2, 0.8, 1.2], g, { cast: false });
  // ---- the bank: pastel mint art-deco façade, glass opening (alpha cut) with a lit lobby behind, a swinging door leaf ----
  const BX = 3.0, BW = 12, FZ = -7, bankFloors = 4;
  const F = decoFront({ seed: 5, word: 'x', neon: PINK, wall: '#9fe3d0', floors: bankFloors, w: BW, bank: true });
  // redraw the front for the bank: big glass opening + neon sign NGÂN HÀNG (own canvas, same size logic)
  const Wp = Math.round(BW * PPM), Hm = F.H, Hp = Math.round(Hm * PPM), gh = F.gh;
  const bankDraw = (c, em, cut) => { const Y = (m) => Hp - m * PPM; const wall = '#9fe3d0'; c.clearRect(0, 0, Wp, Hp);
    if (!em) { c.fillStyle = wall; c.fillRect(0, 0, Wp, Hp); const gr = c.createLinearGradient(0, 0, 0, Hp); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(60,20,90,0.22)'); c.fillStyle = gr; c.fillRect(0, 0, Wp, Hp); } else { c.fillStyle = '#000'; c.fillRect(0, 0, Wp, Hp); }
    const tube = (col, lw = 7) => { c.save(); c.shadowColor = col; c.shadowBlur = em ? 20 : 0; c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); c.restore(); };
    // parapet + stepped crown, neon outline
    c.beginPath(); c.roundRect(0.35 * PPM, Y(Hm) + 0.15 * PPM, Wp - 0.7 * PPM, 0.55 * PPM, 14); tube(CYAN, 7);
    if (!em) { c.fillStyle = sh(wall, 0.4); c.fillRect(0, Y(Hm), Wp, 0.8 * PPM); }
    // upper floors: wide ribbon windows with eyebrow ledges
    for (let f = 1; f < bankFloors; f++) { const y0 = gh + (f - 1) * 3.0 + 0.7; for (let k = 0; k < 5; k++) { const x = (0.9 + k * 2.2) * PPM, ww = 1.6 * PPM, wh = 1.75; c.beginPath(); c.roundRect(x, Y(y0 + wh), ww, wh * PPM, 10);
        if (!em) { c.fillStyle = '#2a2a42'; c.fill(); c.save(); c.clip(); const gg = c.createLinearGradient(0, Y(y0 + wh), 0, Y(y0)); gg.addColorStop(0, '#ff7ab0'); gg.addColorStop(1, '#6a4a9a'); c.globalAlpha = 0.65; c.fillStyle = gg; c.fillRect(x, Y(y0 + wh), ww, wh * PPM); c.restore(); c.lineWidth = 5; c.strokeStyle = sh(wall, -0.3); c.stroke(); c.fillStyle = sh(wall, 0.6); c.fillRect(x - 0.18 * PPM, Y(y0 + wh) - 9, ww + 0.36 * PPM, 8); }
        else if (hash(f * 7 + k * 3 + 5) < 0.6) { c.fillStyle = hash(f + k) > 0.5 ? '#ffb86a' : '#ff80c8'; c.globalAlpha = 0.8; c.fill(); c.globalAlpha = 1; } } }
    // ground floor: the big glass opening (cut out of the colour map so the lobby shows) with a central door gap
    const gy1 = gh - 0.9, gy0 = 0; c.beginPath(); c.roundRect(0.8 * PPM, Y(gy1), (BW - 1.6) * PPM, (gy1 - gy0) * PPM, 18);
    if (!em) { c.save(); c.globalCompositeOperation = 'destination-out'; c.fill(); c.restore(); c.lineWidth = 9; c.strokeStyle = sh(wall, -0.4); c.stroke(); for (const k of [1, 2, 4, 5]) { c.fillStyle = sh(wall, -0.4); c.fillRect(0.8 * PPM + k * (BW - 1.6) * PPM / 6 - 4, Y(gy1), 8, (gy1 - gy0) * PPM); } }
    // the sign: NGÂN HÀNG in neon on a dark plate across the middle
    const sw = 7.4 * PPM, sy = gh - 0.45; c.beginPath(); c.roundRect(Wp / 2 - sw / 2, Y(sy) - 0.72 * PPM, sw, 1.44 * PPM, 24);
    if (!em) { c.fillStyle = '#1a1230'; c.fill(); c.lineWidth = 6; c.strokeStyle = PINK; c.stroke(); } else tube(PINK, 8);
    neonText(c, 'NGÂN HÀNG', Wp / 2, Y(sy) + 0.12 * PPM, 0.8 * PPM, PINK, { glow: em ? 0.55 : 0, core: em ? '#ffffff' : '#ffe9f6', maxW: sw - 50, tube: 0.12 });
    if (!em) { const gg = c.createLinearGradient(0, Hp - 40, 0, Hp); gg.addColorStop(0, 'rgba(20,10,40,0)'); gg.addColorStop(1, 'rgba(20,10,40,0.45)'); c.fillStyle = gg; c.fillRect(0, Hp - 40, Wp, 40); }
  };
  const bankMap = canvasTex(Wp, Hp, (c) => bankDraw(c, false)), bankEm = canvasTex(Wp, Hp, (c) => bankDraw(c, true));
  const front = mesh(new THREE.PlaneGeometry(BW, Hm), new THREE.MeshStandardMaterial({ map: bankMap, emissive: '#ffffff', emissiveMap: bankEm, emissiveIntensity: 1.55, roughness: 0.75, alphaTest: 0.5, transparent: false }), [BX, Hm / 2, FZ], g, { cast: false });
  { const bm = std('#8ad0c0', { roughness: 0.85 }); box(BW, Hm - (gh - 1.0), 4.4, bm, [BX, (Hm + gh - 1.0) / 2, FZ - 2.25], g, { cast: false }); box(BW, Hm, 6, bm, [BX, Hm / 2, FZ - 7.4], g, { cast: false });
    for (const s of [-1, 1]) box(0.8, gh - 1.0, 4.4, bm, [BX + s * (BW / 2 - 0.4), (gh - 1.0) / 2, FZ - 2.25], g, { cast: false }); }
  // art-deco: two rounded corners, eyebrow ledges under every floor, vertical fins
  const pas = std('#9fe3d0', { roughness: 0.8 }), led = std('#f6f0f6', { roughness: 0.7 }), L = [];
  for (const s of [-1, 1]) cyl(0.9, 0.9, Hm, pas, [BX + s * (BW / 2 - 0.1), Hm / 2, FZ - 0.1], g, { cast: false }, 20);
  for (let f = 0; f < bankFloors; f++) L.push([new THREE.BoxGeometry(BW - 0.4, 0.14, 0.7), xf([BX, f === 0 ? gh + 0.45 : gh + 2.5 + (f - 1) * 3.0, FZ + 0.3])]);
  mergeList(L, led, g, { cast: false });
  for (const s of [-1, 1]) for (const k of [0, 1]) box(0.3, Hm - gh, 0.5, std('#f6f0f6', { roughness: 0.7 }), [BX + s * (BW / 2 - 0.9 - k * 0.6), gh + (Hm - gh) / 2, FZ + 0.25], g, { cast: false });
  // the lobby behind the glass: a bright cream room (the interior itself is the `bank` place), and the door leaf that can be kicked open (fx door 0..1)
  const lob = new THREE.MeshStandardMaterial({ color: '#fff0d8', emissive: '#ffe6c0', emissiveIntensity: 0.5, roughness: 1, side: THREE.BackSide });
  mesh(new THREE.BoxGeometry(BW - 1.7, gh - 1.1, 4.0), lob, [BX, (gh - 1.1) / 2, FZ - 2.2], g, { cast: false, recv: false });
  { const gl2 = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff6e8', emissiveIntensity: 2.2 }); for (let i = 0; i < 4; i++) box(5.2, 0.05, 0.3, gl2, [BX, gh - 1.15, FZ - 0.9 - i * 0.9], g, { cast: false });
    box(7.2, 1.0, 0.7, std('#b6c8cc', { roughness: 0.6 }), [BX, 0.5, FZ - 3.3], g, { cast: false }); box(7.4, 0.06, 0.8, std('#e8e2d4'), [BX, 1.03, FZ - 3.3], g, { cast: false }); }
  const DW = 1.9, DH = 2.6, doorPivot = new THREE.Group(); doorPivot.position.set(BX + DW / 2, 0, FZ - 0.05); g.add(doorPivot);
  const leafM = new THREE.MeshPhysicalMaterial({ color: '#bfe8ee', transparent: true, opacity: 0.35, roughness: 0.5, specularIntensity: 0.1, side: THREE.DoubleSide }), frameM = std('#2c3c44', { metalness: 0.6, roughness: 0.4 });
  box(DW, DH, 0.03, leafM, [-DW / 2, DH / 2, 0], doorPivot, { cast: false }); for (const [w, h, x, y] of [[DW, 0.1, -DW / 2, DH], [DW, 0.1, -DW / 2, 0.05], [0.1, DH, -DW + 0.05, DH / 2], [0.1, DH, -0.05, DH / 2]]) box(w, h, 0.06, frameM, [x, y, 0], doorPivot, { cast: false }); cyl(0.02, 0.02, 0.9, std('#cfd6da', { metalness: 0.8, roughness: 0.3 }), [-DW + 0.2, 1.1, 0.07], doorPivot, { cast: false }, 8);
  for (const s of [-1, 1]) cyl(0.07, 0.07, 3.0, frameM, [BX + s * 0.0 - DW / 2 - 0.06 + (s > 0 ? DW + 0.12 : 0), 1.5, FZ + 0.05], g, { cast: false }, 8);
  // a canopy over the door with down-lights, two palms in planters in front, benches
  box(4.2, 0.18, 1.6, std('#f6f0f6'), [BX, 3.35, FZ + 0.75], g, { cast: false }); for (const s of [-1, 1]) cyl(0.12, 0.12, 3.3, std('#f6f0f6'), [BX + s * 1.9, 1.65, FZ + 1.4], g, { cast: false }, 12);
  lightPool(g, [BX, 0.03, FZ + 1.6], 3.2, '#ffd8a0', 0.55);
  // ---- the dust puff for Tèo's landing (fx dust 0..1): soft meshes that bloom outwards and fade ----
  const dustT = softDisc([[0, 'rgba(240,210,200,0.9)'], [0.5, 'rgba(235,200,195,0.5)'], [1, 'rgba(235,200,195,0)']]), puffs = [];
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dustT, transparent: true, opacity: 0, depthWrite: false })); m.renderOrder = 5; g.add(m); puffs.push({ m, a: i / 12 * Math.PI * 2 + hash(i) * 0.4, r: 0.4 + 0.6 * hash(i * 3.7), up: 0.15 + 0.5 * hash(i * 5.3) }); }
  // ---- palms (tall, thin, both sides), lamps, a flamingo pair, the lifeguard hut, a pier far out, a neighbour hotel ----
  const trunks = [], fronds = [], PZ = [[-8, -4.5], [-6.0, -2.6], [-10.5, -1.5], [-3.2, -5.4], [9.6, -5.6], [12.2, -1.2], [-3.0, -3.9], [15.5, -2.5], [10.0, -2.2], [-13, -4.0]];   // the strip z 0.8..3.0 is kept clear: the hero car pulls away along it
  PZ.forEach(([x, z], i) => addPalm(trunks, fronds, x, z, 8.5 + 4 * hash(i * 2.9), i + 3)); finishPalms(g, trunks, fronds);
  [[-5.0, 3.0, 1], [8.4, 3.0, -1], [13.2, 3.0, -1], [-9.5, 3.0, 1]].forEach(([x, z, f], i) => deco_lamp(g, x, z, f, i % 2 ? '#ff9fd0' : '#ffd08a'));
  flamingo(g, -6.8, -0.8, 0.6, 1.0); flamingo(g, -6.0, -0.2, -0.5, 0.82); lifeguardHut(g, -15.5, -2.5, 0.9); pier(g, -30, -12, 70, Math.PI / 2 + 0.2, 0.2);
  // a neighbour hotel (flamingo pink) to the right and a low one far left; reuses the street front
  const NF = decoFront({ seed: 9, word: 'KARAOKE', neon: CYAN, wall: '#ffa6c9', floors: 4 }); const nb = new THREE.Group(); nb.position.set(18.5, 0, FZ + 0.05); g.add(nb);
  mesh(new THREE.PlaneGeometry(DECO_W, NF.H), new THREE.MeshStandardMaterial({ map: NF.maps[0], emissive: '#fff', emissiveMap: NF.maps[1], emissiveIntensity: 1.5, roughness: 0.8 }), [0, NF.H / 2, 0], nb, { cast: false }); box(DECO_W, NF.H, 6, std('#e690b4'), [0, NF.H / 2, -3.05], nb, { cast: false });
  // ---- marks & cams ----
  const seats = {}, cams = {}; const S = (n, p, yaw = 0) => { seats[n] = { pos: [p[0] + at[0], p[1] + at[1], p[2] + at[2]], yaw }; };
  S('land_teo', [-0.6, 0, -1.6], 0.2); S('bench_bip', [2.9, 0, -1.2], 0); S('door_kick', [BX - 0.2, 0, FZ + 1.8], Math.PI); S('door_front', [BX - 0.2, 0, FZ + 1.5], 0); S('car_park', [6.4, 0, 4.7], -Math.PI / 2); S('stand_teo', [0.3, 0, -1.2], 0.15);
  // stone bench (seat top 0.30 m = a stool, so a seated Bíp sits right)
  { const stone = std('#d8cdd6', { roughness: 0.85 }); box(1.9, 0.3, 0.62, stone, [2.9, 0.15, -1.2 - 0.0], g); box(1.9, 0.5, 0.12, stone, [2.9, 0.55, -1.55], g); box(0.2, 0.5, 0.62, stone, [1.85, 0.25, -1.2], g); box(0.2, 0.5, 0.62, stone, [3.95, 0.25, -1.2], g); }
  const C = (n, from, a, f) => { cams[n] = { from: [from[0] + at[0], from[1] + at[1], from[2] + at[2]], at: [a[0] + at[0], a[1] + at[1], a[2] + at[2]], f }; };
  C('wide_sun', [6.0, 1.6, 6.6], [-1.0, 2.9, -3.0], 22); C('wide', [2.0, 1.5, 6.0], [2.0, 3.6, -7], 20); C('two', [1.2, 1.2, 3.2], [1.2, 0.95, -1.4], 40); C('door_kick', [3.4, 1.4, -0.2], [3.0, 1.2, -7], 36); C('door_side', [-1.5, 1.3, -4.2], [3.2, 1.2, -6.8], 40);
  C('bench_close', [2.9, 0.95, 1.4], [2.9, 0.8, -1.2], 50); C('car_close', [4.2, 0.8, 5.0], [6.4, 0.7, 1.9], 40); C('landing', [0.8, 0.5, 2.4], [-0.6, 0.35, -1.6], 40); C('sign', [3.0, 2.2, 3.4], [3.0, 5.4, -7], 50);
  const update = (t, fx = {}) => {
    const k = clamp(fx.door || 0), snap = k * k * (3 - 2 * k), over = Math.sin(Math.PI * clamp(k * 1.25)) * 0.07 * (k > 0.8 ? (1 - k) * 5 : 1);
    doorPivot.rotation.y = -(snap * 1.75 + over);   // swings INTO the lobby (away from the camera), about 100 degrees
    const d = clamp(fx.dust || 0); const lp = seats.land_teo.pos;
    puffs.forEach((p) => { const e = 1 - Math.pow(1 - d, 2), r = (0.2 + 1.6 * p.r) * e, fade = d <= 0 ? 0 : Math.pow(Math.sin(Math.PI * Math.min(1, d * 0.9 + 0.05)), 0.8); p.m.position.set(lp[0] - at[0] + Math.cos(p.a) * r, 0.08 + p.up * e * 0.9, lp[2] - at[2] + Math.sin(p.a) * r * 0.8); const s = 0.4 + 1.2 * e * (0.7 + 0.5 * p.r); p.m.scale.set(s, s * 0.8, 1); p.m.rotation.z = p.a; p.m.material.opacity = 0.7 * fade; p.m.visible = d > 0.001; });
  };
  return { group: g, seats, cams, update, look: { ...LOOK, bloom: [0.2, 0.45, 1.15], env: 0.22 }, light: 'gta_plaza', lightAt: [1.0, 0.8, -1.0] };
}

// ======================================================================================================================================
// ROAD: one long straight coast boulevard (z +14 .. -430), sea on the left (-x), Miami deco hotels with Vietnamese neon on the right (+x)
// ======================================================================================================================================
// All numbers the cars use (road-local metres; the composite adds the place origin to marks and cams, not to these).
export const ROAD = {
  centre: 0, median: [-1, 1], halfWidth: 8, lanes: [-6.25, -2.75, 2.75, 6.25], hero: 2.75,       // the hero car drives toward -z in the right-hand lane (x +2.75); the others are the oncoming / outer lanes
  zStart: 12, zEnd: -430, junction: [-40, -90, -140], stop: [-30, -80, -130],                        // junction = centre of each cross street (12 m wide, z j-6 .. j+6); stop = the white stop line (z), the red light and the camera box stand just before it
  light: { z: [-32, -82, -132], y: 6.4, x: [2.75, -2.75] },                                          // the hanging traffic light (red) is above each of these x at those z
  camBox: { x: 6.25, y: 5.1, z: [-32, -82, -132] },                                                  // the fine camera box hangs above the outer lane; its lens looks towards -z (photographs the rear plate)
  bridge: { z0: -190, z1: -248.2, leaf: 20, angleDeg: 17.2, tipNear: -209.1, tipFar: -229.1, mid: -219.1, slab: [-210, -228.2], gap: [-209.1, -229.1] },   // two leaves hinged at z0 / z1 and a centre slab; fully raised (fx bridge 1) the leaves are 17.2 deg ramps whose tips (5.9 m up) stand 20 m apart (z -209.1 / -229.1) = the cars agent's 20 m jump, and the slab lifts out of the way
  farSide: [-229.1, -430], seaX: -26,
};
// the deck height the car drives on when the bridge is fully raised (fx bridge 1): flat road, the near leaf ramp (17.2 deg, down to z -209.1), then the far leaf sloping down from its tip. In the gap there is no deck (null). Use it for ty / pitch of a drive.
export function deckAt(z, angleDeg = ROAD.bridge.angleDeg) { const B = ROAD.bridge, a = angleDeg * Math.PI / 180, r = B.leaf * Math.cos(a);
  if (z > B.z0) return { h: 0, pitch: 0 }; if (z >= B.z0 - r) return { h: (B.z0 - z) * Math.tan(a), pitch: a }; if (z > B.z1 + r) return null; if (z >= B.z1) return { h: (z - B.z1) * Math.tan(a), pitch: -a }; return { h: 0, pitch: 0 }; }
const wetAsphalt = (len, marks = true) => canvasTex(512, 1024, (c, w, h) => { c.fillStyle = '#2b2736'; c.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const x = hash(i * 3.1) * w, y = hash(i * 5.3) * h, r = 30 + 90 * hash(i * 7.7), gr = c.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, `rgba(${hash(i) > 0.5 ? '60,40,80' : '20,18,30'},0.5)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } grain(c, w, h, 14000, 0.05, 11, 2);
  // markings: dashed white lane lines, double yellow at the median kerb (x -1 / +1 -> u = (x + 8) / 16)
  if (marks) { c.fillStyle = '#efe8f4'; for (const x of [-4.5, 4.5]) for (let y = 0; y < h; y += 256) c.fillRect((x + 8) / 16 * w - 3, y + 20, 6, 120);
  c.fillStyle = '#ffd24a'; for (const x of [-1.2, 1.2]) c.fillRect((x + 8) / 16 * w - 3, 0, 6, h); } }, { repeat: [1, len / 8] });

export function buildGtaRoad(scene, { at = [0, 0, 0], sunDir = [-0.3, 0.1, -0.95], bridgeAngle = ROAD.bridge.angleDeg, railGap = null } = {}) {
  const g = new THREE.Group(); g.name = 'gta_road'; g.position.set(...at); scene.add(g);
  const Z0 = ROAD.zStart, Z1 = ROAD.zEnd, LEN = Z0 - Z1, ZM = (Z0 + Z1) / 2, J = ROAD.junction, B = ROAD.bridge;
  const dome = new THREE.Group(); g.add(dome); skyDome(dome, { r: 120, sunDir, sunR: 14, seed: 11 });
  const sea = seaPlane(dome, { size: 380, y: -0.5, near: '#1a2b62', far: '#d0628c' }); const gl = glitter(dome, { dir: sunDir, from: 30, to: 150, w0: 10, w1: 46, y: -0.4 });
  const inBridge = (z) => z < B.z0 + 6 && z > B.z1 - 6, inJ = (z, m = 9) => J.some((j) => Math.abs(z - j) < m);
  // ---- the carriageway: wet dark asphalt, kerbs, a raised median ----
  const segs = [[Z0, B.z0], [B.z1, Z1]];    // the deck over the water is the two leaves
  for (const [a, b] of segs) mesh(new THREE.PlaneGeometry(16, a - b), new THREE.MeshStandardMaterial({ map: wetAsphalt(a - b), roughness: 0.26, envMapIntensity: 1.5, metalness: 0.05 }), [0, 0, (a + b) / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const kerb = std('#d8cce0', { roughness: 0.6 });
  for (const [a, b] of segs) { box(2.0, 0.16, a - b, std('#c8bcd4', { roughness: 0.7 }), [0, 0.08, (a + b) / 2], g, { cast: false }); for (const s of [-1, 1]) { box(0.3, 0.2, a - b, kerb, [s * 8.15, 0.1, (a + b) / 2], g, { cast: false }); } }
  // cross streets (12 m, to the +x side and across to the promenade) with zebra crossings and stop lines
  J.forEach((j) => { const ct = wetAsphalt(52, false); ct.repeat.set(5, 1); const w = new THREE.Mesh(new THREE.PlaneGeometry(52, 12), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.26, envMapIntensity: 1.5 })); w.rotation.x = -Math.PI / 2; w.position.set(14, 0.003, j); g.add(w); w.receiveShadow = true;
    const zebra = []; for (let i = 0; i < 12; i++) zebra.push([new THREE.BoxGeometry(0.55, 0.012, 3.0), xf([-7.2 + i * 1.3, 0.012, j + 8.6])]); mergeList(zebra, std('#efe8f4', { roughness: 0.5 }), g, { cast: false });
    box(7.8, 0.012, 0.35, std('#efe8f4'), [4.5, 0.013, j + 10.4], g, { cast: false }); box(7.8, 0.012, 0.35, std('#efe8f4'), [-4.5, 0.013, j - 10.4], g, { cast: false }); });
  // neon reflections on the wet road: long soft additive streaks (pink / cyan / purple), thicker under the shopfronts side
  const reflT = canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 18; i++) { const x = hash(i * 3.3) * w, ww = 10 + 22 * hash(i * 5.1), col = [PINK, CYAN, PINK, PURP][i % 4], gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = 0.45 * (0.4 + 0.6 * hash(i)); c.fillStyle = gr; c.fillRect(x, 0, ww, h); } }, { repeat: [1, LEN / 14] });
  for (const [a, b] of segs) { const m = mesh(new THREE.PlaneGeometry(9, a - b), addMat(reflT, '#ffffff', 0.38), [3.5, 0.02, (a + b) / 2], g, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }); m.renderOrder = 2; const m2 = mesh(new THREE.PlaneGeometry(7, a - b), addMat(reflT, '#cfe8ff', 0.2), [-3, 0.021, (a + b) / 2], g, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }); m2.renderOrder = 2; }
  // ---- sea side: promenade, sand, rail, lamps; the sea beyond ----
  const sandT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#e8c4a6'; c.fillRect(0, 0, w, h); grain(c, w, h, 5000, 0.1, 9, 2); }, { repeat: [8, LEN / 8] });
  mesh(new THREE.PlaneGeometry(20, LEN), new THREE.MeshStandardMaterial({ map: sandT, color: '#c898a0', roughness: 1 }), [-17.5, -0.04, ZM], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  mesh(new THREE.PlaneGeometry(12, LEN), std('#7a6a88', { roughness: 0.5 }), [-12.6, 0.005, ZM], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });   // paved promenade x -18.6 .. -6.6 under the sand edge
  mesh(new THREE.PlaneGeometry(14, LEN), std('#a89ab0', { roughness: 0.55 }), [-11.2, 0.01, ZM], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const inGap = (z) => railGap && z < railGap[0] + 0.01 && z > railGap[1] - 0.01;   // 20/11: an optional opening in the rail (the pier of gta6p3); default none = identical
  const posts = []; for (let z = Z0; z > Z1; z -= 3) if (!inGap(z)) posts.push([new THREE.BoxGeometry(0.1, 0.9, 0.1), xf([-17.2, 0.45, z])]); mergeList(posts, std('#f2e6f0'), g, { cast: false });
  if (!railGap) box(0.08, 0.08, LEN, std('#f2e6f0'), [-17.2, 0.92, ZM], g, { cast: false });
  else for (const [a, b] of [[Z0, railGap[0]], [railGap[1], Z1]]) box(0.08, 0.08, a - b, std('#f2e6f0'), [-17.2, 0.92, (a + b) / 2], g, { cast: false });
  for (let z = Z0 - 4; z > Z1; z -= 24) if (!inBridge(z)) deco_lamp(g, -9.4, z, 1, (Math.round(z / 24) % 2) ? '#ff9fd0' : '#ffd08a');
  // palms: three rows (promenade, median, shop side), evenly spaced and tall and thin so they streak past
  const T = [], Fr = [], Tm = [], Fm = [];
  for (let z = Z0 - 2, i = 0; z > Z1; z -= 11, i++) { if (inBridge(z) || inJ(z, 9)) continue; addPalm(T, Fr, -9.6, z, 10.5 + 2.5 * hash(i * 1.9), i * 3 + 1); addPalm(T, Fr, 9.4, z - 5.5, 10 + 2.5 * hash(i * 2.3), i * 3 + 2); }
  for (let z = Z0 - 5, i = 0; z > Z1; z -= 12, i++) { if (inBridge(z) || inJ(z, 10)) continue; addPalm(Tm, Fm, 0, z, 9.5 + 2.2 * hash(i * 3.7), i * 3 + 7); }
  finishPalms(g, T, Fr); finishPalms(g, Tm, Fm);
  // ---- the shop side: contiguous deco hotels / shophouses, Vietnamese neon words, in pastels with neon tubes ----
  const WORDS = [['KARAOKE', PINK], ['PHỞ BÒ', CYAN], ['CẦM ĐỒ', AMBER], ['TRÀ ĐÁ 5K', PURP], ['RỬA XE', CYAN], ['CẮT TÓC', PINK], ['QUÁN NHẬU', AMBER], ['NHÀ NGHỈ', PURP], ['BÁNH MÌ', PINK], ['SỬA XE', CYAN]];
  const fronts = WORDS.map(([w, n], i) => decoFront({ seed: i + 21, word: w, neon: n, wall: PASTEL[i % PASTEL.length], floors: [4, 3, 5, 4, 3, 4, 5, 3, 4, 3][i], w: DECO_W }));
  const planeL = fronts.map(() => []), bodyL = fronts.map(() => []), ledgeL = [], cornerL = fronts.map(() => []), finL = [], stripP = [], stripC = [];
  let bi = 0; for (let z = Z0 - 4; z > Z1; z -= 9.4, bi++) { if (inBridge(z) || inJ(z, 10.5)) continue; const v = (bi * 7 + (bi >> 2)) % fronts.length, F = fronts[v], sx = 1.0, hOff = 0;
    planeL[v].push([new THREE.PlaneGeometry(DECO_W, F.H), xf([10.96, F.H / 2, z], [0, -Math.PI / 2, 0], [1, 1, 1])]);
    // a building next to a cross street / the bridge / the road's ends shows its SIDE to the road: give it the same front (windows, neon outline, sign) instead of a blank wall
    for (const dz of [9.4, -9.4]) { const nz = z - dz; if (!(inBridge(nz) || inJ(nz, 10.5) || nz > Z0 - 3 || nz < Z1)) continue; planeL[v].push([new THREE.PlaneGeometry(8, F.H), xf([15.0, F.H / 2, z - dz * 0.5 * 0 + (dz > 0 ? -1 : 1) * 4.52], [0, dz > 0 ? Math.PI : 0, 0])]); } bodyL[v].push([new THREE.BoxGeometry(8, F.H, 9.0), xf([15.0, F.H / 2, z])]);
    for (let f = 0; f < F.fl; f++) { const ly = f === 0 ? F.gh + 0.2 : F.gh + 2.5 + (f - 1) * F.fh; ledgeL.push([new THREE.BoxGeometry(0.7, 0.13, DECO_W - 0.3), xf([11.3, ly, z])]); ((f + bi) % 2 ? stripP : stripC).push([new THREE.BoxGeometry(0.07, 0.07, DECO_W - 0.6), xf([11.64, ly - 0.1, z])]); }
    cornerL[v].push([new THREE.CylinderGeometry(0.75, 0.75, F.H, 16), xf([11.3, F.H / 2, z - DECO_W / 2 + 0.2])]); finL.push([new THREE.BoxGeometry(0.5, F.H - F.gh, 0.34), xf([11.3, F.gh + (F.H - F.gh) / 2, z + DECO_W / 2 - 0.5])]); }
  fronts.forEach((F, i) => { if (planeL[i].length) mergeList(planeL[i], new THREE.MeshStandardMaterial({ map: F.maps[0], emissive: '#ffffff', emissiveMap: F.maps[1], emissiveIntensity: 1.5, roughness: 0.55, envMapIntensity: 0.6 }), g, { cast: false }); if (cornerL[i].length) mergeList(cornerL[i], std(PASTEL[i % PASTEL.length], { roughness: 0.8 }), g, { cast: false }); });
  fronts.forEach((F, i) => { if (bodyL[i].length) mergeList(bodyL[i], std(sh(PASTEL[i % PASTEL.length], -0.28), { roughness: 0.9 }), g, { cast: false }); }); if (stripP.length) { mergeList(stripP, new THREE.MeshStandardMaterial({ color: '#000', emissive: PINK, emissiveIntensity: 3.2 }), g, { cast: false, recv: false }); mergeList(stripC, new THREE.MeshStandardMaterial({ color: '#000', emissive: CYAN, emissiveIntensity: 3.2 }), g, { cast: false, recv: false }); } mergeList(ledgeL, std('#f6eef6', { roughness: 0.7 }), g, { cast: false }); mergeList(finL, std('#f6eef6', { roughness: 0.7 }), g, { cast: false });
  // big vertical neon BLADE signs (Vietnamese words) hung over the kerb on both sides every ~13 m: they face the arriving car, so one is always in a chase frame and they streak past
  { const BW = [['KARAOKE', PINK], ['CẦM ĐỒ', AMBER], ['TRÀ ĐÁ 5K', CYAN], ['PHỞ BÒ', PINK], ['RỬA XE', CYAN], ['CẮT TÓC', PURP], ['BÁNH MÌ', AMBER]], cache = {}, tex = (w, col) => cache[w] ??= canvasTex(192, 768, (c, ww, hh) => { c.fillStyle = 'rgba(14,6,30,0.9)'; c.beginPath(); c.roundRect(14, 14, ww - 28, hh - 28, 34); c.fill(); c.strokeStyle = col; c.lineWidth = 9; c.shadowColor = col; c.shadowBlur = 22; c.stroke(); c.shadowBlur = 0; c.save(); c.translate(ww / 2, hh / 2); c.rotate(-Math.PI / 2); neonText(c, w, 0, 4, 120, col, { glow: 0.55, maxW: hh - 130, tube: 0.12 }); c.restore(); });
    let k = 0; for (let z = Z0 - 14; z > Z1; z -= 13, k++) { if (inBridge(z) || inJ(z, 12)) continue; const side = k % 2 ? -1 : 1, [w, col] = BW[k % BW.length], x = side * 7.7, T3 = tex(w, col), by = 6.2;
      for (const back of [0, 1]) mesh(new THREE.PlaneGeometry(2.2, 8.8), new THREE.MeshBasicMaterial({ map: T3, transparent: true, depthWrite: false, toneMapped: false }), [x, by + 4.4, z - back * 0.03], g, { cast: false, recv: false, rot: [0, side * -0.25 + back * Math.PI, 0] });   // two single-sided planes back to back: the back face reads the right way round
      box(0.1, 11, 0.1, std('#201828'), [side * 8.45, 5.5, z], g, { cast: false }); box(0.9, 0.08, 0.08, std('#201828'), [side * 8.1, by - 0.1, z], g, { cast: false }); box(0.9, 0.08, 0.08, std('#201828'), [side * 8.1, by + 8.9, z], g, { cast: false }); } }
  // glass towers far behind (silhouette with lit grid)
  const towerT = canvasTex(128, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6a3a8a'); gr.addColorStop(1, '#2a1e4a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let y = 8; y < h; y += 16) for (let x = 6; x < w; x += 14) { c.fillStyle = hash(x * 3.7 + y * 5.1) > 0.45 ? ['#ffc07a', '#9ff0ff', '#ff8ac8'][(x + y) % 3] : '#2e2450'; c.fillRect(x, y, 8, 9); } });
  const tw = []; for (let i = 0, z = Z0 - 20; z > Z1; z -= 52, i++) { const hh = 40 + 36 * hash(i * 3.1); tw.push([new THREE.BoxGeometry(11, hh, 11), xf([48 + 14 * hash(i), hh / 2, z])]); } mergeList(tw, new THREE.MeshStandardMaterial({ map: towerT, emissive: '#ffffff', emissiveMap: towerT, emissiveIntensity: 0.8, roughness: 0.5 }), g, { cast: false });
  // pavement on the shop side, parked motorbikes, concrete poles with tangled black wires (the Hà Nội touch)
  mesh(new THREE.PlaneGeometry(3.4, LEN), std('#a898b4', { roughness: 0.5 }), [9.7, 0.012, ZM], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const poleM = std('#8e8a96', { roughness: 0.95 }), wireM = std('#0c0a10', { roughness: 0.6 }), PX = 8.9; let prev = null;
  for (let z = Z0 - 6, i = 0; z > Z1; z -= 24, i++) { if (inBridge(z) || inJ(z, 6)) { prev = null; continue; }
    cyl(0.16, 0.2, 9, poleM, [PX, 4.5, z], g, { cast: false }, 8); box(2.6, 0.12, 0.12, std('#3a3440'), [PX - 1.0, 8.4, z], g, { cast: false }); box(2.0, 0.1, 0.1, std('#3a3440'), [PX - 0.8, 7.5, z], g, { cast: false }); box(0.42, 0.55, 0.22, std('#b4b0b8', { metalness: 0.4 }), [PX - 0.3, 3.2, z], g, { cast: false });
    for (let k = 0; k < 6; k++) { const y = 8.4 - (k % 3) * 0.45, xo = -2.1 + k * 0.38; if (prev) { const p0 = new THREE.Vector3(PX + xo * 0.0 - 0.1 - 0.35 * (k % 3), y, prev), p1 = new THREE.Vector3(PX - 0.1 - 0.35 * (k % 3), y, z); const mid = p0.clone().lerp(p1, 0.5); mid.y -= 1.0 + 0.5 * hash(i + k * 3); mid.x += (hash(i * 2 + k) - 0.5) * 0.5; mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, mid, p1]), 12, 0.03, 4), wireM, [0, 0, 0], g, { cast: false, recv: false }); } }
    // the tangle: a knot of loops hanging off the pole
    for (let k = 0; k < 3; k++) { const a = new THREE.Vector3(PX - 0.5, 7.4 - k * 0.2, z), b = new THREE.Vector3(PX - 0.9 + k * 0.2, 6.8 - k * 0.3, z + (k - 1) * 0.35), c2 = new THREE.Vector3(PX - 0.3, 6.5 - k * 0.2, z - 0.25); mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, b, c2, a.clone().add(new THREE.Vector3(-0.15, -0.8, 0.2))]), 14, 0.035, 4), wireM, [0, 0, 0], g, { cast: false, recv: false }); }
    prev = z; }
  const bikes = []; for (let z = Z0 - 5, i = 0; z > Z1; z -= 7.7, i++) { if (inBridge(z) || inJ(z, 9) || hash(i * 5.3) < 0.35) continue; bikes.push(z); }
  const bikeM = new THREE.MeshStandardMaterial({ color: '#202030', roughness: 0.5 }), bl = [], blp = [], bseat = [];
  for (const z of bikes) { const c = ['#ff5aa0', '#2adfe0', '#ffd24a', '#a65bff'][Math.floor(hash(z * 3.1) * 4)]; bl.push([new THREE.BoxGeometry(1.5, 0.35, 0.5), xf([9.9, 0.45, z], [0, 0.0, 0])]); blp.push([new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), xf([9.9 - 0.62, 0.28, z], [Math.PI / 2, 0, 0])], [new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), xf([9.9 + 0.62, 0.28, z], [Math.PI / 2, 0, 0])]); bseat.push([new THREE.BoxGeometry(0.7, 0.14, 0.38), xf([9.8, 0.72, z])]); }
  if (bl.length) { mergeList(bl, std('#d4468a', { roughness: 0.4 }), g, { cast: false }); mergeList(blp, std('#15141c', { roughness: 0.7 }), g, { cast: false }); mergeList(bseat, std('#1c1a24'), g, { cast: false }); }
  // beach furniture: lifeguard huts, flamingos, a pier, in the order they pass the camera
  [[-8, -22], [-120, -22], [-255, -22]].forEach(([z, x], i) => lifeguardHut(g, x, z, 1.4 + i * 0.3)); [[-34, -14.5], [-72, -14.5], [-150, -14.5], [-200, -14.5], [-300, -14.5]].forEach(([z, x], i) => { flamingo(g, x, z, -0.4 + i * 0.3, 1.0); flamingo(g, x + 0.9, z + 0.9, 0.5, 0.85); });
  pier(dome, -60, -80, 120, Math.PI / 2 + 0.12, 0.2);
  // ---- three red lights with their fine-camera boxes (fx flash1..3) ----
  const flash = [], mats = [];
  J.forEach((j, n) => { const zs = ROAD.light.z[n], pg = new THREE.Group(); pg.position.set(0, 0, zs); g.add(pg); const metal = std('#2e2a38', { roughness: 0.5, metalness: 0.4 });
    cyl(0.2, 0.26, 7.6, poleM, [8.9, 3.8, 0], pg, { cast: false }, 10); box(0.5, 0.5, 0.5, poleM, [8.9, 0.25, 0], pg, { cast: false });
    box(9.0, 0.22, 0.26, metal, [4.45, ROAD.light.y + 1.15, 0], pg, { cast: false });   // the mast arm over the lanes
    // the light heads: big, one per hero-side lane, facing +z (towards the arriving car). Red lit (a lot), amber and green dim; a huge halo so it reads from 40 m
    for (const x of [2.75, 6.25, -2.75]) { box(1.0, 2.3, 0.42, metal, [x, ROAD.light.y, 0], pg, { cast: false }); box(1.3, 2.6, 0.12, std('#f2f0f4', { roughness: 0.6 }), [x, ROAD.light.y, -0.18], pg, { cast: false });   // white back-board
      const red = new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff1a1a', emissiveIntensity: 5.0, roughness: 0.4 }); mats.push(red);
      mesh(new THREE.CircleGeometry(0.42, 24), red, [x, ROAD.light.y + 0.75, 0.215], pg, { cast: false, recv: false }); mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshStandardMaterial({ color: '#201800', emissive: '#ffb000', emissiveIntensity: 0.12 }), [x, ROAD.light.y, 0.215], pg, { cast: false, recv: false }); mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshStandardMaterial({ color: '#002010', emissive: '#00ff80', emissiveIntensity: 0.1 }), [x, ROAD.light.y - 0.75, 0.215], pg, { cast: false, recv: false });
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), addMat(softDisc([[0, 'rgba(255,60,50,0.95)'], [0.3, 'rgba(255,40,50,0.5)'], [1, 'rgba(255,20,60,0)']]), '#ffffff', x === -2.75 ? 0.5 : 0.9)); halo.position.set(x, ROAD.light.y + 0.75, 0.3); halo.renderOrder = 6; pg.add(halo); }
    // a ground reflection of the red on the wet road
    lightPool(g, [2.75, 0.03, zs + 4.5], 3.4, '#ff2a30', 0.45);
    // the camera box on its own arm over the outer lane, next to the red light: dark housing, visor, lens (faces -z), a flash panel (fx flashN), a status LED on its back
    box(2.3, 0.14, 0.14, metal, [7.6, ROAD.camBox.y + 0.55, 0.3], pg, { cast: false });
    const cb = new THREE.Group(); cb.position.set(ROAD.camBox.x, ROAD.camBox.y, 0.3); pg.add(cb); const housing = std('#16141c', { roughness: 0.35, metalness: 0.5 });
    box(1.3, 0.9, 1.5, housing, [0, 0, 0], cb); box(1.4, 0.08, 0.7, housing, [0, 0.52, -0.9], cb, { rot: [0.08, 0, 0] }); box(1.45, 0.06, 0.06, new THREE.MeshStandardMaterial({ color: '#000', emissive: CYAN, emissiveIntensity: 2.5 }), [0, 0.5, -1.22], cb, { cast: false });   // visor + cyan edge strip
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20), std('#0a0a10', { roughness: 0.15, metalness: 0.7 }), [-0.2, 0.0, -0.8], cb, { rot: [Math.PI / 2, 0, 0], cast: false }); mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshStandardMaterial({ color: '#102040', emissive: '#4a78ff', emissiveIntensity: 1.1, roughness: 0.1 }), [-0.2, 0.0, -0.885], cb, { rot: [0, Math.PI, 0], cast: false });
    const panel = new THREE.MeshStandardMaterial({ color: '#cfd4dc', emissive: '#ffffff', emissiveIntensity: 0.0, roughness: 0.4 }); box(0.42, 0.62, 0.05, panel, [0.38, 0.0, -0.78], cb, { cast: false });
    const led = new THREE.MeshStandardMaterial({ color: '#200', emissive: '#ff2020', emissiveIntensity: 2 }); ball(0.06, led, [0.5, 0.25, 0.77], cb, { cast: false }, 10);
    // warning sign on the pole facing the arriving traffic
    const wT = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#ffd23a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#111'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'CAMERA', w - 40, 54); c.fillText('CAMERA', w / 2, 38); fitText(c, 'PHẠT NGUỘI', w - 40, 40); c.fillText('PHẠT NGUỘI', w / 2, 88); });
    box(1.5, 0.75, 0.05, std('#222'), [8.9 - 0.9, 5.6, 0.32], pg, { cast: false }); mesh(new THREE.PlaneGeometry(1.4, 0.7), glowMat(wT, 0.55), [8.9 - 0.9, 5.6, 0.36], pg, { cast: false });
    // the flash: a real light at the box + a big bright flare (both pure ramps of fx flashN)
    const fl = new THREE.PointLight('#ffffff', 0, 60, 2); fl.position.set(ROAD.camBox.x, ROAD.camBox.y - 0.2, 1.2); pg.add(fl);
    const flare = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), addMat(softDisc([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.8)'], [0.55, 'rgba(255,240,255,0.25)'], [1, 'rgba(255,240,255,0)']]), '#ffffff', 0)); flare.position.set(ROAD.camBox.x, ROAD.camBox.y, 0.0); flare.renderOrder = 8; flare.material.side = THREE.DoubleSide; pg.add(flare);
    flash.push({ fl, flare, panel, led, cb }); });
  // ---- the drawbridge: two leaves hinged at z0 / z1 (fx bridge 0..1 raises them), towers, the water ----
  const BL = B.z0 - B.z1;
  const water = mesh(new THREE.PlaneGeometry(140, BL + 10), new THREE.MeshStandardMaterial({ color: '#27306a', roughness: 0.12, metalness: 0.4, envMapIntensity: 1.6 }), [0, -3.0, (B.z0 + B.z1) / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const wglit = mesh(new THREE.PlaneGeometry(14, BL - 4), addMat(reflT, '#ffb0d0', 0.4), [0, -2.98, (B.z0 + B.z1) / 2], g, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] });
  for (const z of [B.z0 + 0.5, B.z1 - 0.5]) { box(20, 3.2, 3, std('#cfc4d8', { roughness: 0.8 }), [0, -1.6, z], g, { cast: false }); }
  const leafMat = new THREE.MeshStandardMaterial({ map: wetAsphalt(20), roughness: 0.28, envMapIntensity: 1.5 }), leaves = [];
  [[B.z0, -1], [B.z1, 1]].forEach(([hz, dir], i) => { const piv = new THREE.Group(); piv.position.set(0, 0, hz); g.add(piv); leaves.push({ piv, dir });
    const dk = new THREE.Group(); piv.add(dk); box(16.6, 0.9, B.leaf, std('#4a3e5c', { roughness: 0.7 }), [0, -0.45, dir * B.leaf / 2], dk, { cast: false }); mesh(new THREE.PlaneGeometry(16, B.leaf), leafMat, [0, 0.004, dir * B.leaf / 2], dk, { cast: false, rot: [-Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) { box(0.2, 0.16, B.leaf, std('#f2e6f0'), [s * 8.3, 0.9, dir * B.leaf / 2], dk, { cast: false }); for (let k = 0; k <= 8; k++) box(0.1, 0.8, 0.1, std('#f2e6f0'), [s * 8.3, 0.5, dir * (k * B.leaf / 8)], dk, { cast: false }); box(0.16, 0.14, B.leaf, new THREE.MeshStandardMaterial({ color: '#000', emissive: s > 0 ? PINK : CYAN, emissiveIntensity: 2.6 }), [s * 8.3, 1.1, dir * B.leaf / 2], dk, { cast: false }); }
    box(16.6, 1.6, 6, std('#4a3e5c'), [0, -0.7, -dir * 3.4], dk, { cast: false }); });   // counterweight behind the hinge
  // the centre slab (fills the gap between the closed leaves; fx bridge lifts it 15 m between two guide towers) and the towers
  const slab = new THREE.Group(); slab.position.set(0, 0, B.mid); g.add(slab); { const sl = B.slab[0] - B.slab[1]; box(16.6, 0.9, sl, std('#4a3e5c', { roughness: 0.7 }), [0, -0.45, 0], slab, { cast: false }); mesh(new THREE.PlaneGeometry(16, sl), leafMat, [0, 0.004, 0], slab, { cast: false, rot: [-Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) { box(0.2, 0.16, sl, std('#f2e6f0'), [s * 8.3, 0.9, 0], slab, { cast: false }); box(0.16, 0.14, sl, new THREE.MeshStandardMaterial({ color: '#000', emissive: s > 0 ? PINK : CYAN, emissiveIntensity: 2.6 }), [s * 8.3, 1.1, 0], slab, { cast: false }); } }
  for (const [z, s, hh] of [[B.z0 + 3, -1, 15], [B.z0 + 3, 1, 15], [B.z1 - 3, -1, 15], [B.z1 - 3, 1, 15], [B.mid, 1, 15]]) { const tw2 = new THREE.Group(); tw2.position.set(s * 11, 0, z); g.add(tw2); box(1.6, hh, 1.8, std('#ffa6c9', { roughness: 0.8 }), [0, hh / 2, 0], tw2, { cast: false }); box(2.0, 0.3, 2.2, std('#f6eef6'), [0, hh + 0.1, 0], tw2, { cast: false }); box(0.18, hh * 0.8, 0.18, new THREE.MeshStandardMaterial({ color: '#000', emissive: s < 0 ? CYAN : PINK, emissiveIntensity: 2.6 }), [-s * 0.85, hh / 2, 0.0], tw2, { cast: false }); ball(0.3, new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff2a30', emissiveIntensity: 3 }), [0, hh + 0.6, 0], tw2, { cast: false }, 8); }
  // ---- marks (hero lane) + cams ----
  const seats = {}, cams = {}; const S = (n, p, yaw = Math.PI) => { seats[n] = { pos: [p[0] + at[0], p[1] + at[1], p[2] + at[2]], yaw }; };
  S('car_start', [ROAD.hero, 0, 4]); J.forEach((j, i) => S('car_j' + (i + 1), [ROAD.hero, 0, j + 16])); S('car_bridge', [ROAD.hero, 0, B.z0 + 14]); S('car_edge', [ROAD.hero, 0, B.tipNear]); S('car_land', [ROAD.hero, 0, B.tipFar]); S('police_1', [ROAD.hero, 0, B.tipNear + 12]); S('police_2', [ROAD.hero + 3.5, 0, B.tipNear + 16]); S('car_cruise', [ROAD.hero, 0, -300]); S('car_end', [ROAD.hero, 0, -400]);
  const C = (n, from, a, f) => { cams[n] = { from: [from[0] + at[0], from[1] + at[1], from[2] + at[2]], at: [a[0] + at[0], a[1] + at[1], a[2] + at[2]], f }; };
  J.forEach((j, i) => { const zs = ROAD.light.z[i]; C('light' + (i + 1) + '_low', [ROAD.hero, 0.9, zs + 22], [ROAD.hero + 0.6, 4.2, zs], 32); C('light' + (i + 1) + '_wide', [ROAD.hero - 1.5, 1.7, zs + 34], [ROAD.hero + 2.0, 4.6, zs], 24); C('box' + (i + 1) + '_low', [ROAD.hero + 1.5, 0.9, zs + 14], [ROAD.camBox.x, ROAD.camBox.y - 0.2, zs], 40); C('junction' + (i + 1), [-1.5, 2.0, j + 36], [3, 1.5, j - 6], 30); });
  C('chase_low', [ROAD.hero, 1.0, 12], [ROAD.hero, 0.9, -8], 32); C('bridge_side', [-30, 3.2, B.mid + 2], [0, 4, B.mid], 26); C('bridge_front', [ROAD.hero, 1.4, B.z0 + 30], [0, 6, B.mid], 28); C('cruise_side', [-9, 1.2, -296], [ROAD.hero, 0.9, -300], 36);
  const upd = { sunY: 0 };
  const update = (t, fx = {}, follow = null) => {
    // dome, sea and glitter follow the car (or Tèo) so the horizon never ends; everything else is static
    const fz = follow ? clamp(follow.z - at[2] - 6, Z1 + 40, Z0 + 40) : -60, fxp = follow ? follow.x - at[0] : 0; dome.position.set(fxp * 0.0, 0, fz);
    gl.userData.mat.opacity = 0.75 + 0.12 * Math.sin(t * 1.0);
    flash.forEach((f, n) => { const k = clamp(fx['flash' + (n + 1)] || 0), kk = k * k * (3 - 2 * k); f.fl.intensity = 320 * kk; f.flare.material.opacity = 0.85 * kk; f.panel.emissiveIntensity = 5 * kk; f.led.emissiveIntensity = 1.2 + 1.0 * Math.sin(t * 4.0 + n); f.flare.visible = kk > 0.002; f.fl.visible = kk > 0.002; });
    // the red lights breathe on a very slow wave (never a blink)
    mats.forEach((m, i) => { m.emissiveIntensity = 5.0 + 0.6 * Math.sin(t * 0.8 + i); });
    const b = smooth(clamp(fx.bridge || 0)), ang = b * THREE.MathUtils.degToRad(bridgeAngle); leaves.forEach((l) => { l.piv.rotation.x = l.dir < 0 ? ang : -ang; }); slab.position.y = -7 * b;   // the centre slab sinks under the water (a lifted slab read as a floating roof)
  };
  return { group: g, seats, cams, update, look: { ...LOOK, bloom: [0.4, 0.7, 0.9] }, light: 'gta_dusk', lightAt: [2.75, 0.8, 0], bridgeTip: (k) => { const a = smooth(clamp(k)) * THREE.MathUtils.degToRad(bridgeAngle); return { angle: a, nearTip: [B.z0 - B.leaf * Math.cos(a), B.leaf * Math.sin(a)], farTip: [B.z1 + B.leaf * Math.cos(a), B.leaf * Math.sin(a)], slabY: -7 * smooth(clamp(k)) }; } };
}

// ======================================================================================================================================
// THE COMPOSITE `gta`: set: 'gta'; setOpts below.  Places far apart (sky x 0, plaza +400, bank +800, road +1200); only the active one shows; one light rig is moved and re-moodied.
// ======================================================================================================================================
//   places: [{ t, place: 'sky'|'plaza'|'bank'|'road' }]       which place shows from t on (default: the first one listed at t = 0)
//   stands: [{ t, who, mark, yaw?, y?, pos?, walk? }]          from t on `who` stands on that mark ('plaza.land_teo' or just 'land_teo'); pos: [x, y, z] = an absolute world spot; y: -100 parks him; walk: [{ t, mark }] = he walks there in straight lines (set fx walk 1 on him for the legs)
//   seatPlan: { wait_2: [{ t, who: 'kh1' }, { t: 3.1, who: 'kh3' }], wait_4: [...] }   who sits in a waiting chair from t on (soft pop 0.14 s when it changes; nobody listed is parked); kh1..kh5 are the customers
//   follow: 'teo' (default for the road): the cast member the road's light rig and horizon follow;  focus: [{ t, at: [x, y, z] }] moves the light rig by hand instead
//   sky / plaza / bank / road: options of the place ({ sunDir }, { numA, numB }, { bridgeAngle }...)
const ORG = { sky: [0, 0, 0], plaza: [400, 0, 0], bank: [800, 0, 0], road: [1200, 0, 0], shop: [1600, 0, 0], sea: [2000, 0, 0], gym: [2400, 0, 0], lair: [2800, 0, 0], paint: [3200, 0, 0], alley: [3600, 0, 0] };
export function buildGtaWorld(scene, { places = [], stands = [], seatPlan = null, follow = 'teo', focus = null, cars = null, sky = {}, plaza = {}, bank = {}, road = {}, shop = null, sea = null, gym = null, lair = null, paint = null, alley = null, p3b = null } = {}) {
  const root = new THREE.Group(); root.name = 'gta'; scene.add(root);
  const P = { sky: buildGtaSky(root, { ...sky, at: ORG.sky }), plaza: buildGtaPlaza(root, { ...plaza, at: ORG.plaza }), bank: buildGtaBank(root, { ...bank, at: ORG.bank }), road: buildGtaRoad(root, { ...road, at: ORG.road }) };
  if (shop || places.some((p) => p.place === 'shop')) P.shop = buildGtaShop(root, { ...(shop || {}), at: ORG.shop });   // setOpts.shop (any object, e.g. {}) or a place 'shop' builds the grocery; otherwise nothing is built
  if (sea || places.some((p) => p.place === 'sea')) P.sea = buildGtaSea(root, { ...(sea || {}), at: ORG.sea, scene });   // 20/11: setOpts.sea (any object) or a place 'sea' builds the beach road + pier + sea; otherwise nothing
  if (gym || places.some((p) => p.place === 'gym')) P.gym = buildGtaGym(root, { ...(gym || {}), at: ORG.gym });   // 20/11 (gta6p2b)
  if (lair || places.some((p) => p.place === 'lair')) P.lair = buildGtaLair(root, { ...(lair || {}), at: ORG.lair });
  if (paint || places.some((p) => p.place === 'paint')) P.paint = buildGtaPaint(root, { ...(paint || {}), at: ORG.paint, paths: p3b?.paths?.paint || {} });   // 21/11 (gta6p3b)
  if (alley || places.some((p) => p.place === 'alley')) P.alley = buildGtaAlley(root, { ...(alley || {}), at: ORG.alley, paths: p3b?.paths?.alley || {} });
  if (p3b && P.sea) { const x = addP3bSea(P.sea, { scene, paths: p3b.paths || {}, island: p3b.island || {} }); P.sea.update = x.update; P.sea.pre = x.pre; P.sea.p3b = x; }
  const seats = {}, cams = {};
  for (const [pn, ps] of Object.entries(P)) { for (const [m, v] of Object.entries(ps.seats)) { seats[pn + '.' + m] = v; if (!seats[m]) seats[m] = v; } for (const [m, v] of Object.entries(ps.cams || {})) { cams[pn + '.' + m] = v; if (!cams[m]) cams[m] = v; } }
  seats.teo = { ...seats['plaza.land_teo'] }; seats.bip = { ...seats['plaza.bench_bip'] }; for (const n of [...BANK_PEOPLE, 'lan', 'linh', 'linhs', 'daica', 'cong1', 'cong2', 'ga', 'gas', 'bongden', 'baban', 'hangxom', 'den1', 'den2', 'den3']) seats[n] = { pos: [0, -100, 0], yaw: 0 };
  // ---- the cars (option `cars: { hero: { color?, plate?, riders? }, police: 0|1|2 }`): built once on the root, MOVED between the places' marks: plaza.car_park (heading -x) or road.car_start (heading -z); hidden in sky / bank ----
  const CAR_R = 0.33;   // wheel radius used by gta_cars.js (its wheels roll with hypot(tx, tz) x sign(tz): the composite adds `wheels` so they roll FORWARD whatever the heading)
  const CAR = { hero: null, p1: null, p2: null, at: { hero: [0, 0], p1: [0, 0], p2: [0, 0] } };
  if (cars) { const ho = cars.hero || {}; CAR.hero = buildCar(root, { kind: 'hero', prefix: '', at: CAR.at.hero, yaw: 0, plate: ho.plate || 'TÈO 01', color: ho.color, riders: ho.riders ?? { driver: 'teo', pass: 'bip' } });
    if ((cars.police || 0) >= 1) CAR.p1 = buildCar(root, { kind: 'police', prefix: 'p1', at: CAR.at.p1, name: 'p1', plate: cars.policePlate || '29A 123.45' }); if ((cars.police || 0) >= 2) CAR.p2 = buildCar(root, { kind: 'police', prefix: 'p2', at: CAR.at.p2, name: 'p2', plate: cars.policePlate || '29A 123.46' }); }
  // the cars' glossy paint mirrored the bright room environment (env 0.3) and clipped the bonnet to cream (measured: bonnet pixel 239,195,184 with the env, 215,100,58 without): its reflection is turned down
  for (const c of [CAR.hero, CAR.p1, CAR.p2]) c?.group.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && 'envMapIntensity' in m && scene.environment) { m.envMap = scene.environment; m.envMapIntensity = 0.05; m.needsUpdate = true; } });   // (three ignores material.envMapIntensity for scene.environment: give the material the same map and its own intensity)
  const world = { group: root, light: 'gta_dusk', seats, cams, look: LOOK, places: P, origin: ORG, ROAD, lights: null, active: null };
  const plan = [...places].sort((a, b) => a.t - b.t), stand = [...stands].sort((a, b) => a.t - b.t), fk = focus ? [...focus].sort((a, b) => a.t - b.t) : null;
  // a place's look (21/11 evening, order dependence): setLook only writes the keys a look names, so what a place showed depended on the places visited before it, and the
  // FIRST place never got its own look (at tune time the page has no window.stage yet; it shows the set look + ep.look). Now every change of place first puts back the look
  // the page had at its first frame (set look + ep.look), then lays the place's look over it; the first place keeps that base look, exactly as every forward render showed it.
  let look0 = null, home0 = null; const lookSnap = (st) => { const g = {}; for (const [k, u] of Object.entries(st.grade.uniforms)) if (typeof u.value === 'number') g[k] = u.value; else if (u.value?.isVector3) g[k] = u.value.clone();
    return { exp: st.renderer.toneMappingExposure, bs: st.bloom.strength, br: st.bloom.radius, bt: st.bloom.threshold, env: st.scene.environmentIntensity, g }; };
  const lookBack = (st, s0) => { st.renderer.toneMappingExposure = s0.exp; st.bloom.strength = s0.bs; st.bloom.radius = s0.br; st.bloom.threshold = s0.bt; st.scene.environmentIntensity = s0.env;
    for (const [k, v] of Object.entries(s0.g)) { const u = st.grade.uniforms[k]; if (typeof v === 'number') u.value = v; else u.value.copy(v); } };
  world.setPlace = (name) => { if (world.active === name) return; world.active = name; for (const [pn, s] of Object.entries(P)) s.group.visible = pn === name; const ps = P[name], st = globalThis.stage;
    if (!st || !look0) return; lookBack(st, look0); if (ps.look && name !== world.home) st.setLook(ps.look); };
  const placeAt = (t) => { let n = plan[0]?.place || 'plaza'; for (const p of plan) if (p.t <= t) n = p.place; return n; };
  world.tune = (L) => { world.lights = L; world.active = null; world.home = placeAt(0); world.setPlace(placeAt(0)); if (cars) { L.key.angle = 0.75; L.key.penumbra = 1; L.rim.angle = 0.9; L.kick.angle = 0.9; } };
  const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  // a stand is a mark (or a pos) from t on; with `walk: [{ t, mark | pos, yaw? }, ...]` he walks in straight lines to each waypoint (arriving at its t), facing the way he goes, then turns to the last waypoint's yaw
  const lerpYaw = (a, b, k) => { const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; };
  const standAt = (s, t) => { const m0 = s.pos ? { pos: s.pos, yaw: 0 } : seats[s.mark]; if (!m0) return null; const W = [{ t: s.t, pos: m0.pos, yaw: (m0.yaw || 0) + (s.yaw || 0) }];
    for (const w of s.walk || []) { const m = w.pos ? { pos: w.pos, yaw: 0 } : seats[w.mark]; if (m) W.push({ t: w.t, pos: m.pos, yaw: (m.yaw || 0) + (w.yaw || 0) }); }
    if (W.length === 1) return { p: W[0].pos, yaw: W[0].yaw };
    const head = (a, b) => Math.atan2(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]); let i = 0; while (i + 1 < W.length && W[i + 1].t <= t) i++;
    if (i === W.length - 1) { const h = head(W[i - 1], W[i]); return { p: W[i].pos, yaw: lerpYaw(h, W[i].yaw, ease((t - W[i].t) / 0.3)) }; }
    const a = W[i], b = W[i + 1], u = clamp((t - a.t) / Math.max(1e-3, b.t - a.t)), h = head(a, b), prev = i === 0 ? a.yaw : head(W[i - 1], a);
    return { p: [lerp(a.pos[0], b.pos[0], u), lerp(a.pos[1], b.pos[1], u), lerp(a.pos[2], b.pos[2], u)], yaw: lerpYaw(prev, h, ease((t - a.t) / 0.25)) }; };
  // (22/11) a stand with `gait: true | { kind: 'walk', step, cadence, ease }` and a `walk` path walks like a person: the distance covered drives the legs (core/gait.js),
  // he speeds up from standing and slows to standing over `ease` s, the feet do not skate. Without `gait` the stand is exactly as before. world.gaitOf(who, t) = the pose numbers for that
  // character at t (walk amount, gph, gstride, ...), read by the player; null when his current stand has no gait.
  const gaitCache = new WeakMap();
  const gaitFor = (s) => { if (!s.gait || !s.walk?.length) return null; let g = gaitCache.get(s); if (g === undefined) { const m0 = s.pos ? { pos: s.pos, yaw: 0 } : seats[s.mark]; const W = m0 ? [{ t: s.t, pos: m0.pos, yaw: (m0.yaw || 0) + (s.yaw || 0) }] : []; for (const w of s.walk) { const m = w.pos ? { pos: w.pos, yaw: 0 } : seats[w.mark]; if (m) W.push({ t: w.t, pos: m.pos, yaw: (m.yaw || 0) + (w.yaw || 0) }); } g = W.length > 1 ? buildStandGait(W, s.gait === true ? {} : s.gait) : null; gaitCache.set(s, g); } return g; };
  world.gaitOf = (who, t) => { let cur = null; for (const s of stand) if (s.who === who && s.t <= t) cur = s; const g = cur && gaitFor(cur); return g ? g.fx(t) : null; };
  world.update = (t, fx = {}) => {
    if (!look0 && globalThis.stage) look0 = lookSnap(globalThis.stage);   // the page's base look, taken on the first frame (after main.js laid the set look and ep.look)
    world.setPlace(placeAt(t)); const name = world.active, ps = P[name]; if (name !== 'sea') P.sea?.p3b?.off?.();   // what the sea hangs on the cast is put away elsewhere
    // characters on their marks
    const last = {}; for (const s of stand) if (s.t <= t) last[s.who] = s;
    // (21/11 evening) every character starts each frame where the page put him (his seat; the parked ones at y -100), then the stands, the seat plan, the places and the cars
    // move whoever they own at t. A character nobody places at t used to stay wherever an earlier seek had left him (Linh on her island lounger at 29.5 s after a seek past 38 s).
    if (!home0) { home0 = []; for (const r of scene.children) if (r.userData.api) home0.push({ r, p: r.position.clone(), q: r.quaternion.clone(), s: r.scale.clone() }); }
    for (const h of home0) { h.r.position.copy(h.p); h.r.quaternion.copy(h.q); h.r.scale.copy(h.s); }
    for (const [who, s] of Object.entries(last)) { const r = scene.getObjectByName(who); if (!r) continue; const q = standAt(s, t); if (!q) continue; const gg = gaitFor(s); if (gg) { q.p = gg.pos(t); q.yaw = gg.yaw(t); } r.position.set(q.p[0], q.p[1] + (s.y || 0), q.p[2]); r.rotation.set(0, q.yaw, 0); }   // the whole rotation (21/11 evening): a lean / pitch left by a vehicle ride in another place used to stay on him (order dependence)
    if (p3b?.fx) fx = { ...fx, ...p3b.fx(t, name) };   // 21/11 (gta6p3b): fx computed from the episode's analytic paths (e.g. the silver car's, per place)
    P[name].pre?.(t, fx, scene);   // 20/11 (gta6p3): the sea place places its vehicles and glues its riders here, before the cars / light / camera of this frame read them
    // customers in the waiting chairs (seatPlan): the one listed at t sits, the rest are parked out of sight; a change pops in over 0.14 s
    if (seatPlan) { const inPlan = new Set(), here = {}; for (const [seat, list] of Object.entries(seatPlan)) { for (const e of list) inPlan.add(e.who); let cur = null; for (const e of [...list].sort((a, b) => a.t - b.t)) if (e.t <= t) cur = e; if (cur) here[cur.who] = { seat, since: t - cur.t }; }
      for (const who of inPlan) { const r = scene.getObjectByName(who); if (!r) continue; const h = here[who]; if (!h) { r.position.y = -100; r.scale.setScalar(1); continue; } const m = seats[h.seat]; r.position.set(m.pos[0], m.pos[1], m.pos[2]); r.rotation.y = m.yaw || 0; const k = ease(h.since / 0.14); r.scale.setScalar(Math.max(0.001, k * (1 + 0.06 * Math.sin(Math.PI * clamp(h.since / 0.14))))); } }
    // the cars: placed on this place's mark, their own fx (tx tz ty tyaw pitch ... / p1tz ... , see ENGINE.md "GTA cars") on top; fx `ride` >= 0.5 glues Tèo and Bíp into the hero car
    if (cars?.path && (name === 'sea' || name === 'shop' || name === 'gym')) fx = { ...fx, ...cars.path(t, name) };   // 20/11 (gta6p3): the cars of the sea / shop places follow an analytic path (place-local metres from the place origin, heading in tyaw: 0 = +z, PI = -z), keys tx tz tyaw pitch ty steer squat lean skid brake p1tx ... p2... ride
    if (CAR.hero) { const hm = name === 'plaza' ? seats['plaza.car_park'] : name === 'road' ? seats['road.car_start'] : (name === 'sea' || name === 'shop' || name === 'gym') ? { pos: ORG[name], yaw: 0 } : null, pm = [name === 'road' ? seats['road.police_1'] : (name === 'sea' || name === 'shop' || name === 'gym') ? hm : null, name === 'road' ? seats['road.police_2'] : (name === 'sea' || name === 'shop' || name === 'gym') ? hm : null];
      const put = (car, at, m, pre, extra) => { if (!car) return; const hy = Math.hypot(fx[pre + 'tx'] || 0, fx[pre + 'tz'] || 0), sg = Math.sign(fx[pre + 'tz'] || fx[pre + 'tx'] || 1), f2 = { ...fx, ...extra, [pre + 'wheels']: (fx[pre + 'wheels'] || 0) + hy * (1 - sg) / CAR_R, [pre + 'fade']: m ? (fx[pre + 'fade'] || 0) : 1, [pre + 'tyaw']: (fx[pre + 'tyaw'] || 0) + (m ? m.yaw : 0) }; if (m) { at[0] = m.pos[0]; at[1] = m.pos[2]; } car.update(t, f2); };
      put(CAR.hero, CAR.at.hero, hm, '', { unride: (fx.ride || 0) >= 0.5 ? 0 : 1 }); put(CAR.p1, CAR.at.p1, pm[0], 'p1', {}); put(CAR.p2, CAR.at.p2, pm[1], 'p2', {}); }
    // the light rig: the place's own spot, or the followed cast member, or the focus keys
    const L = world.lights; let lf = null; if (L) { let a = [ps.lightAt[0] + ORG[name][0], ps.lightAt[1], ps.lightAt[2] + ORG[name][2]]; const useF = follow && (name === 'road' || name === 'sea' || name === 'gym' || name === 'paint' || name === 'alley' || (name === 'plaza' && (fx.ride || 0) >= 0.5)), fr = useF ? scene.getObjectByName(follow) : null;
      if (fk) { let i = 0; while (i + 1 < fk.length && fk[i + 1].t <= t) i++; const A = fk[i], Bk = fk[Math.min(i + 1, fk.length - 1)], u = Bk.t > A.t ? ease((t - A.t) / (Bk.t - A.t)) : 1; a = A.at.map((v, k) => v + (Bk.at[k] - v) * u); } else if (fr) { a = [fr.position.x, fr.position.y + 0.8, fr.position.z]; lf = { fr, a }; }
      L.apply(ps.light, a); if (cars) { L.key.angle = 0.75; L.key.penumbra = 1; L.rim.angle = 0.9; L.kick.angle = 0.9; L.key.intensity *= 0.8; L.rim.intensity *= 0.35; L.kick.intensity *= 0.7; } }   // with cars the wide cones also hit the bonnet, 1.5 m from the rim spot: it clipped to white (front two-shot), so the rim / kick are turned down
    const fr2 = follow && (name === 'road' || name === 'sea' || name === 'gym' || name === 'paint' || name === 'alley') ? scene.getObjectByName(follow) : null;
    // (21/11 evening) `follow` is read when the place uses it, not now: a place whose own update moves the car (paint, alley) glues Tèo there, and a copy taken here was the frame BEFORE (order dependence)
    P[name].update?.(t, fx, fr2 ? { get x() { return fr2.position.x; }, get z() { return fr2.position.z; } } : null, scene);
    // ... and the light rig that follows him moves with him if the place's update moved him after the rig was placed (it used to keep the previous frame's spot: the car went black on every first frame of a render batch)
    if (lf) { const p = lf.fr.position, dx = p.x - lf.a[0], dy = p.y + 0.8 - lf.a[1], dz = p.z - lf.a[2]; if (dx || dy || dz) for (const l of [L.key, L.rim, L.kick]) { l.position.x += dx; l.position.z += dz; l.target.position.set(l.target.position.x + dx, l.target.position.y + dy, l.target.position.z + dz); } }
  };
  return world;
}
