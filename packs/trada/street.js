// Trà đá với AI, special "Zombie": a ruined Hà Nội street (opening chase, end of Part 1, Part 2 chase) + the shared "ruin" helpers used by the market, the alley and the stall.
// World: the camera looks towards -z. A long street runs along z (road x -3.5..3.5, pavements to +-6, shop fronts beyond). Characters running TOWARDS the camera face +z (yaw 0),
// running away: yaw PI. Everything is a pure function of t (smoke, paper and lamps are slow waves). Options: { time: 'night' | 'grey_morning' | 'dusk', at: [x, y, z] (move the whole place, seats follow) }.
import * as THREE from 'three';
import { hash, lerp, smooth, noise1, fbm1, canvasTex, grain, std, emis, mesh, box, cyl, ball } from '../../core/util.js';

const FONT = (px, w = 900) => `${w} ${px}px Display, sans-serif`;

// ---------- shared helpers (exported: market.js, gate.js and stall.js use them) ----------
// a debt note (GIẤY NỢ): white sheet, red heading and stamp, ruled lines, a made-up amount
let _debt = null; export const debtTex = () => (_debt ??= canvasTex(96, 128, (c, w, h) => { c.fillStyle = '#f6f2e6'; c.fillRect(0, 0, w, h); c.fillStyle = '#c4272f'; c.font = '900 15px Display, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GIẤY NỢ', w / 2, 16, 80); c.fillRect(8, 28, w - 16, 2);
  c.fillStyle = 'rgba(40,40,50,0.6)'; for (let i = 0; i < 6; i++) c.fillRect(10, 40 + i * 9, 40 + (i * 23 % 34), 2); c.strokeStyle = '#c4272f'; c.lineWidth = 3; c.beginPath(); c.arc(66, 100, 15, 0, 7); c.stroke(); c.fillStyle = '#c4272f'; c.font = '900 11px Display, sans-serif'; c.fillText('NỢ', 66, 101); }));
// one debt note lying flat (a real mesh): put it where somebody will slip on it
export function debtSheet(parent, pos, yaw = 0.5, size = 0.26) { const m = mesh(new THREE.PlaneGeometry(size, size * 1.33), new THREE.MeshStandardMaterial({ map: debtTex(), roughness: 0.9, side: THREE.DoubleSide }), pos, parent, { cast: false, rot: [-Math.PI / 2 + 0.03, 0, yaw] }); return m; }

// a soft round glow / smoke puff texture
export const softDisc = (stops = [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]) => canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); for (const [o, col] of stops) g.addColorStop(o, col); c.fillStyle = g; c.fillRect(0, 0, w, h); }, { mip: false });
let _puff = null; const puffTex = () => (_puff ??= softDisc([[0, 'rgba(255,255,255,0.85)'], [0.45, 'rgba(255,255,255,0.4)'], [0.8, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]));
// a light pool on the ground (additive, no light cost)
export function lightPool(parent, pos, r, color, k = 0.5) { const m = new THREE.MeshBasicMaterial({ map: softDisc(), color, transparent: true, opacity: k, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }); const p = mesh(new THREE.PlaneGeometry(r * 2, r * 2), m, pos, parent, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }); p.renderOrder = 2; return p; }

// a smoke column: n puffs rising and growing in a loop (pure function of t). returns { update(t, k) } (k = overall opacity factor)
export function smokeColumn(parent, { pos = [0, 0, 0], n = 14, h = 7, w = 1.6, color = '#5b5f68', op = 0.4, period = 26, seed = 0, drift = [0.6, 0.2] } = {}) {
  const g = new THREE.Group(); g.position.set(...pos); parent.add(g);
  const sp = []; for (let i = 0; i < n; i++) { const m = new THREE.SpriteMaterial({ map: puffTex(), color, transparent: true, opacity: 0, depthWrite: false, fog: true }); const s = new THREE.Sprite(m); s.renderOrder = 3; g.add(s); sp.push(s); }
  return { group: g, update(t, k = 1) { sp.forEach((s, i) => { const u = ((t / period + i / n + hash(i + seed) * 0.05) % 1 + 1) % 1, y = u * h, sc = w * (0.55 + 1.9 * u) * (0.8 + 0.4 * hash(i * 3.1 + seed));
    s.position.set(noise1(t * 0.12 + i * 1.7, seed) * 0.3 * w + u * drift[0] * h * 0.25, y, noise1(t * 0.1 + i * 2.3, seed + 3) * 0.2 * w + u * drift[1] * h * 0.25); s.scale.set(sc, sc * 0.9, 1); s.material.opacity = op * k * Math.pow(Math.sin(Math.PI * u), 1.3) * (0.7 + 0.3 * hash(i * 7.7)); s.material.rotation = hash(i + seed) * 6.28 + t * 0.02 * (hash(i * 5) - 0.5); }); } };
}

// sheets of paper drifting slowly in a box [x0, x1, y0, y1, z0, z1] (instanced; each sheet loops and shrinks to nothing at the ends of its loop, so nothing pops). returns { update(t, k) }
export function driftPaper(parent, { n = 36, box: B = [-4, 4, 0.1, 2.2, -12, 3], wind = [0.5, 0.25], seed = 0, speed = 0.05, size = 0.2, color = '#f1ede0', debt = false } = {}) {
  const tex = debt ? debtTex() : canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(40,40,50,0.55)'; for (let i = 0; i < 9; i++) c.fillRect(7, 8 + i * 6, 14 + (i * 13 % 36), 2.4); c.fillStyle = 'rgba(40,40,50,0.8)'; c.fillRect(7, 5, 34, 3); });
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size * 1.35), new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.9, side: THREE.DoubleSide }), n); im.castShadow = false; im.frustumCulled = false; parent.add(im);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  return { update(t, k = 1) { for (let i = 0; i < n; i++) { const sp = speed * (0.6 + 0.8 * hash(i * 1.3 + seed)), u = (((t * sp + hash(i + seed)) % 1) + 1) % 1, life = Math.pow(Math.sin(Math.PI * u), 0.6);
      const x = lerp(B[0], B[1], hash(i * 2.9 + seed)) + wind[0] * (u - 0.5) * 9 + 0.35 * Math.sin(t * 0.6 + i), z = lerp(B[4], B[5], hash(i * 4.1 + seed)) + wind[1] * (u - 0.5) * 9 + 0.3 * Math.cos(t * 0.5 + i * 1.7);
      const y = lerp(B[2], B[3], hash(i * 6.7 + seed)) + 0.18 * Math.sin(t * 0.9 + i * 2.1) + (0.5 - u) * 0.3;
      e.set(t * (0.5 + hash(i) * 0.7) + i, t * 0.4 * (hash(i * 3) - 0.5) + i * 2, 0.5 * Math.sin(t * 0.8 + i)); q.setFromEuler(e); p.set(x, y, z); const sc = life * k; s.set(sc, sc, sc); m.compose(p, q, s); im.setMatrixAt(i, m); }
    im.instanceMatrix.needsUpdate = true; } };
}

// a Vespa-like motorbike (origin: on the ground between the wheels, nose along +z). lying = 0..1: 0 standing on its stand, 1 = flat on its right side
export function makeBike(color = '#b3272c', lying = 0) {
  const root = new THREE.Group(), bike = new THREE.Group(); root.add(bike);
  const tyre = std('#17171b', { roughness: 0.75 }), paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.35 }), metal = std('#9aa0a8', { roughness: 0.35, metalness: 0.7 });
  for (const z of [-0.5, 0.52]) { mesh(new THREE.TorusGeometry(0.22, 0.055, 10, 24), tyre, [0, 0.28, z], bike, { rot: [0, Math.PI / 2, 0] }); cyl(0.12, 0.12, 0.05, metal, [0, 0.28, z], bike, { rot: [0, 0, Math.PI / 2] }, 14); }
  box(0.22, 0.22, 0.62, paint, [0, 0.42, -0.2], bike); box(0.26, 0.2, 0.34, paint, [0, 0.34, -0.5], bike); box(0.25, 0.09, 0.46, std('#25252c', { roughness: 0.6 }), [0, 0.6, -0.2], bike);
  box(0.2, 0.56, 0.16, paint, [0, 0.62, 0.42], bike, { rot: [0.25, 0, 0] }); box(0.24, 0.07, 0.3, paint, [0, 0.2, 0.0], bike); cyl(0.015, 0.015, 0.62, metal, [0, 0.98, 0.5], bike, { rot: [0, 0, Math.PI / 2] }, 8);
  box(0.14, 0.12, 0.1, paint, [0, 0.99, 0.46], bike); ball(0.045, emis('#fff2c8', 2.5), [0, 0.86, 0.56], bike, { cast: false }, 10); box(0.1, 0.04, 0.03, emis('#ff3a2a', 1.6), [0, 0.5, -0.66], bike, { cast: false });
  bike.position.set(0, 0, 0); root.userData.setLying = (k) => { bike.rotation.set(0, 0, -k * 1.5); bike.position.set(k * 0.2, k * 0.2, 0); }; root.userData.setLying(lying); return root;
}

// ---------- building front textures (shop front + upper floors); [map, emissive map] ----------
const SIGNS = ['QUÁN ĂN', 'THUỐC TÂY', 'ĐIỆN MÁY', 'TẠP HOÁ', 'PHỞ BÒ', 'CẮT TÓC', 'SỬA XE', 'NHÀ NGHỈ'];
export function facadeTex(seed, { hue = 30, ground = 'shutter', lit = 0.2, w = 512, h = 1024, floors = 3, sign = true } = {}) {
  const em = canvasTex(w, h, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); const gh = h * 0.3, fh = (h - gh) / floors;
    for (let f = 0; f < floors; f++) for (let k = 0; k < 2; k++) if (hash(seed * 7 + f * 3 + k * 11) < lit) { c.fillStyle = hash(seed + f + k) > 0.5 ? '#ffc070' : '#d8e8ff'; c.fillRect(56 + k * 220, h - gh - (f + 1) * fh + 26, 150, fh - 62); } });
  const map = canvasTex(w, h, (c) => {
    c.fillStyle = `hsl(${hue}, 24%, 40%)`; c.fillRect(0, 0, w, h); const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(15,15,25,0.5)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = hash(i * 3.7 + seed) * w, y = hash(i * 5.9 + seed) * h * 0.7; const sg = c.createLinearGradient(x, y, x, y + 160); sg.addColorStop(0, 'rgba(20,30,20,0.28)'); sg.addColorStop(1, 'rgba(20,30,20,0)'); c.fillStyle = sg; c.fillRect(x, y, 14 + hash(i) * 26, 160); }
    const gh = h * 0.3, fh = (h - gh) / floors;
    for (let f = 0; f < floors; f++) { const y0 = h - gh - (f + 1) * fh;
      for (let k = 0; k < 2; k++) { const x = 56 + k * 220, wy = y0 + 26, ww = 150, wh = fh - 62, lt = hash(seed * 7 + f * 3 + k * 11) < lit;
        c.fillStyle = '#26262e'; c.fillRect(x - 8, wy - 8, ww + 16, wh + 16); c.fillStyle = lt ? '#ffc070' : hash(seed + f * 9 + k) > 0.5 ? '#14181f' : '#2a5a46'; c.fillRect(x, wy, ww, wh);
        if (!lt && hash(seed + f * 9 + k) <= 0.5) { c.fillStyle = '#1d4636'; for (let s = 0; s < 9; s++) c.fillRect(x, wy + s * wh / 9, ww, 5); }
        c.strokeStyle = '#101018'; c.lineWidth = 6; for (let b = 0; b <= 5; b++) { c.beginPath(); c.moveTo(x + b * ww / 5, wy + wh - 70); c.lineTo(x + b * ww / 5, wy + wh); c.stroke(); } c.beginPath(); c.moveTo(x - 10, wy + wh - 36); c.lineTo(x + ww + 10, wy + wh - 36); c.stroke(); }
      if (hash(seed + f * 5) > 0.55) { c.fillStyle = '#9a9ea6'; c.fillRect(230, y0 + 34, 74, 50); c.fillStyle = '#6a6e76'; c.fillRect(238, y0 + 42, 58, 34); }
      c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(0, y0 + fh - 8, w, 8); }
    // ground floor
    const y0 = h - gh; c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, y0 - 6, w, 6);
    if (sign) { c.fillStyle = ['#7a2a2a', '#2a4a6a', '#6a5a24', '#2a5a3a'][seed % 4]; c.fillRect(24, y0 + 8, w - 48, 54); c.fillStyle = '#e8d9a8'; c.font = FONT(38); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(SIGNS[seed % SIGNS.length], w / 2, y0 + 36); }
    const sy = y0 + 70, sh = gh - 70;
    if (ground === 'shutter') { c.fillStyle = '#6a7a88'; c.fillRect(30, sy, w - 60, sh); const half = hash(seed * 1.7) > 0.5 ? sh * 0.35 : 0; for (let y = sy + half; y < sy + sh; y += 12) { const gg = c.createLinearGradient(0, y, 0, y + 12); gg.addColorStop(0, '#9fb0bf'); gg.addColorStop(0.55, '#62727f'); gg.addColorStop(1, '#3a4651'); c.fillStyle = gg; c.fillRect(30, y, w - 60, 12); } if (half) { c.fillStyle = '#0a0a10'; c.fillRect(30, sy, w - 60, half); }
      for (let i = 0; i < 9; i++) { c.fillStyle = hash(i + seed) > 0.5 ? '#c93a5a' : '#2a8a9a'; c.fillRect(40 + hash(i * 3 + seed) * (w - 140), sy + hash(i * 7) * sh, 60, 5); } }
    else if (ground === 'glass') { c.fillStyle = '#0a0d14'; c.fillRect(30, sy, w - 60, sh); c.strokeStyle = 'rgba(190,220,255,0.7)'; c.lineWidth = 2; for (let i = 0; i < 7; i++) { const cx = 100 + hash(i + seed) * (w - 200), cy = sy + 20 + hash(i * 3) * (sh - 40); for (let a = 0; a < 7; a++) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a * 0.9 + i) * 70, cy + Math.sin(a * 0.9 + i) * 70); c.stroke(); } } c.fillStyle = 'rgba(120,150,190,0.12)'; c.fillRect(30, sy, w - 60, sh); }
    else { c.fillStyle = '#245a46'; c.fillRect(80, sy, w - 160, sh); c.fillStyle = '#143a2c'; for (let i = 0; i < 4; i++) c.fillRect(100 + i * 70, sy + 14, 54, sh - 28); c.fillStyle = '#d6b048'; c.fillRect(w - 130, sy + sh / 2, 12, 24); }
    c.fillStyle = '#6a6a6e'; c.fillRect(0, h - 22, w, 22);
    grain(c, w, h, 9000, 0.1, seed, 3);
  });
  return [map, em];
}

// a sedan (lying on its roof is too much; it just stands there dead, one door open, glass gone)
function deadCar(color) {
  const g = new THREE.Group(), body = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.5 }), dark = std('#101218', { roughness: 0.3 });
  box(1.8, 0.6, 4.2, body, [0, 0.55, 0], g); box(1.6, 0.52, 2.2, body, [0, 1.1, -0.2], g); box(1.62, 0.42, 2.0, dark, [0, 1.12, -0.2], g, { recv: false });
  for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) cyl(0.34, 0.34, 0.24, std('#17171b'), [x, 0.34, z], g, { rot: [0, 0, Math.PI / 2] }, 16);
  box(0.06, 0.5, 1.0, body, [-1.15, 0.9, 0.4], g, { rot: [0, 0.8, 0] }); return g;
}

const TIMES = {
  night: { light: 'cold_street', sky: ['#04060e', '#0c1430', '#1b2144', '#31324e'], lamp: 1, glow: 1, lit: 0.22, smoke: '#3a3f4c', smokeK: 1, paper: '#cfd2d8',
    look: { exposure: 1.0, bloom: [0.3, 0.6, 1.1], env: 0.2, grade: { contrast: 1.12, sat: 1.12, vig: 0.34, grain: 0.014, shadowTint: [0.0, 0.012, 0.03], hiTint: [0.0, 0.01, 0.03] } } },
  grey_morning: { light: 'grey_morning', sky: ['#8f979e', '#a9b0b4', '#c3c5c0', '#cfcfc6'], lamp: 0, glow: 0, lit: 0, smoke: '#8e949a', smokeK: 1.4, paper: '#e6e4da',
    look: { exposure: 0.95, bloom: [0.12, 0.5, 1.4], env: 0.34, grade: { contrast: 1.05, sat: 0.72, vig: 0.3, grain: 0.015, shadowTint: [0.0, 0.008, 0.02], hiTint: [0.005, 0.008, 0.012] } } },
  dusk: { light: 'dusk_street', sky: ['#202044', '#5c3c6c', '#d8785a', '#ffc27a'], lamp: 0.5, glow: 0.7, lit: 0.12, smoke: '#6a4a52', smokeK: 1.1, paper: '#e8d8c4',
    look: { exposure: 1.0, bloom: [0.3, 0.6, 1.1], env: 0.24, grade: { contrast: 1.1, sat: 1.18, vig: 0.34, grain: 0.014, shadowTint: [0.01, 0.005, 0.03], hiTint: [0.04, 0.018, 0.0] } } },
};

export function buildStreet(scene, { time = 'night', at = [0, 0, 0] } = {}) {
  const T = TIMES[time] || TIMES.night, g = new THREE.Group(); g.name = 'street'; g.position.set(...at); scene.add(g);
  const LEN = 70, ZC = -26;   // the street runs from z = +9 to z = -61
  // ---- ground: cracked asphalt, kerbs, pavements ----
  const asph = canvasTex(1024, 1024, (c, w, h) => { c.fillStyle = '#2a2c33'; c.fillRect(0, 0, w, h); grain(c, w, h, 30000, 0.07, 4, 1.6); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; for (let i = 0; i < 16; i++) { let x = hash(i * 3.3) * w, y = hash(i * 7.7) * h; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (hash(i * 5 + s) - 0.5) * 120; y += (hash(i * 9 + s) - 0.3) * 90; c.lineTo(x, y); } c.stroke(); } c.fillStyle = 'rgba(210,205,180,0.5)'; for (let i = 0; i < 8; i++) c.fillRect(w / 2 - 6, i * 128 + 14, 12, 70); }, { repeat: [1, 12] });
  const roughT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { const r = 14 + hash(i * 5.7) * 40, x = r + hash(i * 3.3) * (w - 2 * r), y = r + hash(i * 9.1) * (h - 2 * r), gr = c.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(60,60,60,0.8)'); gr.addColorStop(1, 'rgba(60,60,60,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } }, { srgb: false, repeat: [1, 12] });
  mesh(new THREE.PlaneGeometry(7.2, LEN), new THREE.MeshStandardMaterial({ map: asph, roughnessMap: roughT, roughness: 0.85, envMapIntensity: 1.0 }), [0, 0, ZC], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const paveT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#6a6c70'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const k = hash(i * 7 + j * 13); c.fillStyle = `hsl(${20 + k * 20}, ${8 + k * 8}%, ${34 + k * 10}%)`; c.fillRect(i * 128 + 4, j * 128 + 4, 120, 120); } grain(c, w, h, 5000, 0.1, 6, 3); }, { repeat: [2.4, 24] });
  for (const s of [-1, 1]) { mesh(new THREE.PlaneGeometry(2.6, LEN), std('#ffffff', { map: paveT, roughness: 0.85 }), [s * 4.8, 0.14, ZC], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }); box(0.18, 0.14, LEN, std('#8a8a86', { roughness: 0.85 }), [s * 3.55, 0.07, ZC], g, { cast: false }); }
  // pavement behind the building line / facades
  const fac = []; for (let i = 0; i < 6; i++) fac.push(facadeTex(i + 1, { hue: [28, 200, 12, 150, 40, 215][i], ground: ['shutter', 'glass', 'shutter', 'door', 'shutter', 'glass'][i], lit: T.lit }));
  const wires = [];
  for (const s of [-1, 1]) for (let i = 0; i < 14; i++) { const z = 8 - i * 5, k = (i * 2 + (s > 0 ? 1 : 0)) % 6, [map, em] = fac[k];
    const tall = 9 + hash(i * 3 + s) * 5; const m = new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: em, emissiveIntensity: 1.4, roughness: 0.92 });
    const p = mesh(new THREE.PlaneGeometry(5, 10), m, [s * 6.1, 5, z], g, { cast: false, rot: [0, -s * Math.PI / 2, 0] });
    box(4.99, tall, 0.3, std('#2a2a34', { roughness: 0.95 }), [s * 6.4, tall / 2 + 0.1, z], g, { cast: false, rot: [0, 0, 0] }).rotation.y = Math.PI / 2;
    if (hash(i + s * 9) > 0.4) box(0.7, 0.07, 4.2, std('#3a3a44', { roughness: 0.9 }), [s * 5.78, 4.2 + hash(i) * 0.6, z], g);   // balcony slab
    if (hash(i * 2 + s) > 0.5) box(0.55, 0.4, 0.5, std('#a2a6ac', { roughness: 0.5 }), [s * 5.8, 6.4, z + 0.8], g);   // air-conditioner
    if (i % 3 === s + 1) { const aw = mesh(new THREE.PlaneGeometry(4, 1.2), new THREE.MeshStandardMaterial({ color: ['#a3342a', '#2a5a8a', '#c0a030'][i % 3], side: THREE.DoubleSide, roughness: 0.9 }), [s * 5.4, 3.05, z], g, { rot: [0, -s * Math.PI / 2, 0.0] }); aw.rotation.x = 0.0; aw.rotation.z = 0; aw.rotateX(s * 0.55); aw.position.y = 3.0; aw.userData.noOutline = true; }
    wires.push([s * 5.9, 7 + hash(i) * 2.5, z]); }
  // far end of the street: a blank building, a cross street glow
  box(14, 16, 1, std('#232733'), [0, 8, -62], g, { cast: false });
  // overhead wires: long runs along the street and a few across the road (thin, above the lamp heads)
  const wireM = new THREE.MeshBasicMaterial({ color: '#06060a' });
  for (let k = 0; k < 4; k++) { const x = -5.7 + k * 3.8, y = 8.6 + (k % 2) * 0.6, pts = []; for (let i = 0; i <= 14; i++) pts.push(new THREE.Vector3(x + 0.15 * Math.sin(i * 1.3 + k), y - 0.25 * (i % 2) - 0.03 * i, 8 - i * 5)); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 70, 0.009, 4), wireM)); }
  for (let i = 0; i < 5; i++) { const z = 3 - i * 9, y = 8.8 + hash(i) * 0.8; g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-5.9, y, z), new THREE.Vector3(0, y - 0.9, z - 0.3), new THREE.Vector3(5.9, y + 0.1, z)]), 18, 0.009, 4), wireM)); }

  // ---- street lamps (pools of light on the ground instead of real lights; two real ones near the action) ----
  const lampHead = []; const lamp = (x, z, lean = 0, dead = false) => { const L = new THREE.Group(); L.position.set(x, 0, z); L.rotation.z = lean; g.add(L); cyl(0.045, 0.07, 5.2, std('#4a4f58', { roughness: 0.6, metalness: 0.5 }), [0, 2.6, 0], L, {}, 8); box(0.9 * Math.sign(-x || 1), 0.05, 0.08, std('#4a4f58'), [-0.4 * Math.sign(x || 1), 5.2, 0], L);
    const hd = box(0.34, 0.07, 0.2, emis(dead ? '#222' : '#ffb868', dead ? 0.2 : 3.2), [-0.8 * Math.sign(x || 1), 5.15, 0], L, { cast: false }); if (!dead) { hd.userData.base = 3.2; lampHead.push(hd); lightPool(g, [x - 0.8 * Math.sign(x || 1), 0.02, z], 3.1, '#ff9a48', 0.36 * T.lamp); } };
  if (T.lamp > 0) { lamp(-3.9, 4.5); lamp(3.9, -2.5, 0.0); lamp(-3.9, -9, 0.06); lamp(3.9, -15, 0, true); lamp(-3.9, -22); lamp(3.9, -28); }
  else { lamp(-3.9, 4.5, 0, true); lamp(3.9, -2.5, 0, true); lamp(-3.9, -9, 0.09, true); lamp(3.9, -15, 0, true); }
  const lampLights = []; if (T.lamp > 0) for (const [x, z, k] of [[-3.1, -1.6, 22], [3.1, -8, 14]]) { const l = new THREE.PointLight('#ff9d52', k * T.lamp, 7, 2); l.position.set(x, 4.2, z); g.add(l); lampLights.push([l, k * T.lamp]); }
  // a far glow (fire behind the smoke) at the end of the street
  const glows = []; if (T.glow > 0) for (const [x, z, r, c, k] of [[1.2, -52, 7, '#ff6a2a', 0.5], [-4, -40, 4, '#ff8a3a', 0.25]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: c, transparent: true, opacity: k * T.glow, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); sp.scale.set(r * 2, r * 1.3, 1); sp.position.set(x, 3.5, z); g.add(sp); glows.push([sp, k * T.glow]); }

  // ---- ruin: tipped motorbikes, a dead car, rubble, plastic stools, trash, a fallen shutter ----
  const bike = (x, z, ry, col, lying) => { const b = makeBike(col, lying); b.position.set(x, 0.14 * (Math.abs(x) > 3.5 ? 1 : 0), z); b.rotation.y = ry; g.add(b); return b; };
  bike(3.1, -1.2, -0.3, '#b3272c', 1); bike(-2.7, 1.8, 2.6, '#2a5aa8', 1); bike(3.5, -4.0, 0.2, '#e0a12a', 0); bike(-3.7, -6.5, -0.1, '#2f8a5a', 1); bike(1.9, -11, 1.1, '#8a2a6a', 1); bike(-2.5, -13, 0.4, '#b3272c', 0); bike(3.9, -18, 2.2, '#2a5aa8', 1); bike(-3.8, -1.0, 0.1, '#6a6a72', 0);
  const car = deadCar('#6a2a2a'); car.position.set(4.2, 0, -20); car.rotation.y = 0.15; g.add(car); const car2 = deadCar('#2a3a5a'); car2.position.set(-3.5, 0, -30); car2.rotation.y = -0.1; g.add(car2);
  const rub = std('#6a6660', { roughness: 0.95 }); for (let i = 0; i < 46; i++) { const x = (hash(i * 2.1) > 0.5 ? 1 : -1) * (3.0 + hash(i * 5.3) * 2.6) * (hash(i * 1.9) > 0.15 ? 1 : 0.2), z = 6 - hash(i * 3.7) * 52, s = 0.05 + hash(i * 7.1) * 0.18; box(s * 2, s, s * 1.4, i % 4 ? rub : std('#7a4a3a', { roughness: 0.9 }), [x, s * 0.4 + (Math.abs(x) > 3.5 ? 0.14 : 0), z], g, { rot: [hash(i) * 3, hash(i * 3) * 6, hash(i * 5) * 3] }); }
  for (const [x, z, c] of [[-4.6, -4.5, '#2a6fd0'], [-4.3, -5.0, '#d63a34'], [4.7, -12, '#2a6fd0'], [-5.0, 2.5, '#d63a34']]) { const s = new THREE.Group(); s.position.set(x, 0.14, z); s.rotation.set(hash(x * z) * 1.2 + 1, hash(z) * 6, 0); g.add(s); cyl(0.13, 0.17, 0.24, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4 }), [0, 0.12, 0], s, {}, 16); }
  for (let i = 0; i < 9; i++) mesh(new THREE.SphereGeometry(0.2 + hash(i) * 0.14, 8, 6), std(['#1a1a1e', '#2a3a2a', '#d8d6cc'][i % 3], { roughness: 0.6 }), [(i % 2 ? 1 : -1) * (3.8 + hash(i * 2) * 1.8), 0.22, 2 - i * 5.4], g, { scale: [1, 0.8, 1] });
  // a fallen shop shutter on the road
  box(2.2, 0.04, 1.4, std('#7c8a96', { roughness: 0.4, metalness: 0.6 }), [1.9, 0.06, -6.2], g, { rot: [0.04, 0.4, 0.05] });

  // ---- the newspaper kiosk on the left pavement (hide behind it) ----
  const kio = new THREE.Group(); kio.position.set(-4.5, 0.14, -2.0); kio.rotation.y = 0.12; g.add(kio);
  const kioC = canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#1f6b50'; c.fillRect(0, 0, w, h); c.fillStyle = '#12402f'; c.fillRect(0, 0, w, 36); c.fillStyle = '#f2e6b8'; c.font = FONT(30); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BÁO · TẠP CHÍ · SIM', w / 2, 20); c.fillStyle = '#10241c'; c.fillRect(24, 58, w - 48, 150);
    for (let i = 0; i < 18; i++) { c.fillStyle = ['#d24a5a', '#e0b030', '#4a8ad0', '#f2f2ee', '#58b878'][i % 5]; c.fillRect(32 + (i % 9) * 52, 66 + Math.floor(i / 9) * 70, 44, 62); } grain(c, w, h, 3000, 0.1, 2, 2); });
  box(2.3, 2.0, 1.15, std('#1f6b50', { roughness: 0.6 }), [0, 1.0, 0], kio); mesh(new THREE.PlaneGeometry(2.1, 1.05), new THREE.MeshStandardMaterial({ map: kioC, roughness: 0.7 }), [0, 1.15, 0.581], kio, { cast: false });
  box(2.5, 0.08, 1.45, std('#d2402f', { roughness: 0.7 }), [0, 2.08, 0.1], kio); box(2.6, 0.5, 0.08, std('#b8321f', { roughness: 0.7 }), [0, 1.8, 0.82], kio, { rot: [0.2, 0, 0] });
  box(2.3, 0.1, 1.2, std('#2a2a2e'), [0, 0.5, 0], kio, { cast: false });

  // ---- slow things: smoke, paper, lamps ----
  const smokes = [smokeColumn(g, { pos: [1.5, 0, -30], n: 16, h: 18, w: 5, color: T.smoke, op: 0.55 * T.smokeK, period: 40, seed: 1, drift: [-0.5, 0] }), smokeColumn(g, { pos: [-3.6, 0, -9], n: 11, h: 7, w: 1.8, color: T.smoke, op: 0.42 * T.smokeK, period: 24, seed: 4, drift: [1.0, 0.3] }), smokeColumn(g, { pos: [3.6, 0, -1.5], n: 9, h: 5, w: 1.1, color: T.smoke, op: 0.3 * T.smokeK, period: 20, seed: 9, drift: [-1.2, 0.4] }), smokeColumn(g, { pos: [-1.2, 0, -48], n: 12, h: 16, w: 6, color: T.smoke, op: 0.6 * T.smokeK, period: 46, seed: 7, drift: [0.8, 0] })];
  const papers = [driftPaper(g, { n: 36, box: [-4.5, 4.5, 0.12, 2.0, -16, 4], wind: [0.4, 0.5], seed: 1, color: T.paper }), driftPaper(g, { n: 14, box: [-2, 2, 0.6, 3.2, -3, 3], wind: [0.2, 0.7], seed: 5, speed: 0.04, size: 0.28, color: T.paper })];
  const sky = canvasTex(64, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); T.sky.forEach((s, i) => gr.addColorStop(i / (T.sky.length - 1), s)); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, {});
  mesh(new THREE.SphereGeometry(95, 24, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false }), [0, 0, -20], g, { cast: false, recv: false });
  if (time === 'dusk') { const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: '#ffb468', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); sun.scale.set(30, 22, 1); sun.position.set(2, 5, -58); g.add(sun); }

  // ---- standing marks (world; add PI to yaw to run AWAY from the camera) ----
  const seats = {
    run_a: { pos: [-0.55 + at[0], at[1], at[2]], yaw: 0 }, run_b: { pos: [0.6 + at[0], at[1], 0.15 + at[2]], yaw: 0 },     // two runners side by side, coming towards the camera (Tèo left, Bíp / the second runner right)
    far_a: { pos: [-0.55 + at[0], at[1], -12 + at[2]], yaw: 0 }, far_b: { pos: [0.6 + at[0], at[1], -12 + at[2]], yaw: 0 },     // the same pair far down the street (wide high shots)
    kiosk_hide: { pos: [-4.9 + at[0], at[1] + 0.14, -3.3 + at[2]], yaw: 0.2 }, kiosk_hide_b: { pos: [-4.0 + at[0], at[1] + 0.14, -3.3 + at[2]], yaw: 0.2 },   // behind the newspaper kiosk, hidden from a camera in front (+z)
    victim: { pos: [-2.0 + at[0], at[1], -0.9 + at[2]], yaw: Math.PI / 2 }, biter: { pos: [-1.05 + at[0], at[1], -0.9 + at[2]], yaw: -Math.PI / 2 },   // the customer and the zombie who blocks him, 1 m apart on the road, facing each other (seen through the kiosk gap from kiosk_hide)
    fall: { pos: [0 + at[0], at[1], -1.0 + at[2]], yaw: 0 }, fall_b: { pos: [0.5 + at[0], at[1], -1.4 + at[2]], yaw: 0.3 },     // where the runner trips and the horde piles on
  };
  const horde = []; for (let i = 0; i < 15; i++) { const r = Math.floor(i / 4), c = i % 4, x = (c - 1.5) * 1.15 + (hash(i * 3.3) - 0.5) * 0.7 + (r % 2) * 0.5, z = -1.8 - r * 1.35 - hash(i * 1.7) * 0.5; horde.push({ pos: [x + at[0], at[1], z + at[2]], yaw: (hash(i * 5.1) - 0.5) * 0.4 }); seats['horde' + (i + 1)] = horde[i]; }   // horde1..horde15: a loose crowd behind a runner who is at z = 0 and runs towards the camera (they face +z)

  return {
    group: g, light: T.light, lightAt: [at[0], at[1] + 0.8, at[2] - 1.5], seats, horde, look: T.look, time,
    // key spot widened a little so a horde 10 m deep is not lost in the dark (penumbra keeps the edge soft)
    tune(l) { if (!l?.key) return; l.key.angle = 0.78; l.key.penumbra = 1; l.key.intensity *= 1.5; l.rim.angle = 0.9; l.kick.angle = 0.9; },
    // fx (acts on 'set'): smoke (0..1, default 1), paper (0..1, default 1). The lamps breathe by themselves (a slow wave).
    update(t, fx = {}) {
      const sm = fx.smoke ?? 1, pp = fx.paper ?? 1; smokes.forEach((s, i) => s.update(t, sm)); papers.forEach((p) => p.update(t, pp));
      const lw = 0.9 + 0.1 * fbm1(t * 0.35, 3) + 0.06 * Math.max(0, noise1(t * 0.2, 8)); lampHead.forEach((h, i) => { h.material.emissiveIntensity = h.userData.base * (0.88 + 0.12 * fbm1(t * 0.4 + i * 3.1, 5)); }); lampLights.forEach(([l, k], i) => { l.intensity = k * (0.86 + 0.14 * fbm1(t * 0.3 + i * 5, 9)) * (lw / 0.9); });
      glows.forEach(([s, k], i) => { s.material.opacity = k * (0.85 + 0.15 * fbm1(t * 0.25 + i * 4, 2)); });
    },
  };
}

// ======================= the BLOCK (Zombie special, `layout: 'block'` of the composite `zombie` set) =======================
// One connected neighbourhood in the stall's own world: the stall stands on the near pavement (z -1.5 .. 2.3), the main road runs along x in front of it
// (road z 2.3 .. 9.4, two metres of pavement beyond it, shop fronts at z 12), the supermarket / charger shop (market.js, placed by world.js) faces the stall from across the road.
// Built in WORLD coordinates (no wrapper): x runs along the road (-x = the far end with the glow, where the debt zombies come from), the camera inside the stall looks towards +z.
// fx (acts on 'set'): blackout 0..1 (street lamps and the lit windows die with a slow flutter, a cold moon takes over), notes 0..1 (debt notes drift over the road), paper 0..1 (the ordinary paper, default 1).
export function buildBlockStreet(scene, { x0 = -62, x1 = 46, shopX = -2, shopW = 15 } = {}) {
  const g = new THREE.Group(); g.name = 'block_street'; scene.add(g);
  const Zn = 2.3, Zf = 9.4, ZB = 12.0, ZR = (Zn + Zf) / 2, L = x1 - x0, XC = (x0 + x1) / 2, sh0 = shopX - shopW / 2, sh1 = shopX + shopW / 2;
  const T = TIMES.night;
  // ---- ground: road (dashes along x), pavements flush with the stall's tiles (a thin relief only), kerbs ----
  const asph = canvasTex(1024, 512, (c, w, h) => { c.fillStyle = '#2a2c33'; c.fillRect(0, 0, w, h); grain(c, w, h, 22000, 0.07, 4, 1.6); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; for (let i = 0; i < 10; i++) { let x = hash(i * 3.3) * w, y = hash(i * 7.7) * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (hash(i * 5 + k) - 0.3) * 110; y += (hash(i * 9 + k) - 0.5) * 70; c.lineTo(x, y); } c.stroke(); } c.fillStyle = 'rgba(210,205,180,0.55)'; for (let i = 0; i < 4; i++) c.fillRect(i * 256 + 30, h / 2 - 6, 130, 12); }, { repeat: [L / 7.5, 1] });
  mesh(new THREE.PlaneGeometry(L, Zf - Zn), new THREE.MeshStandardMaterial({ map: asph, roughness: 0.82, envMapIntensity: 1.0 }), [XC, 0.012, ZR], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const paveT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#6a6c70'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const k = hash(i * 7 + j * 13); c.fillStyle = `hsl(${20 + k * 20}, ${8 + k * 8}%, ${34 + k * 10}%)`; c.fillRect(i * 128 + 4, j * 128 + 4, 120, 120); } grain(c, w, h, 5000, 0.1, 6, 3); }, { repeat: [L / 2.6, 1] });
  const pave = (xa, xb, za, zb) => mesh(new THREE.PlaneGeometry(xb - xa, zb - za), std('#ffffff', { map: paveT, roughness: 0.85 }), [(xa + xb) / 2, 0.014, (za + zb) / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] }).material.map.repeat.set((xb - xa) / 2.6, 1);
  pave(x0, x1, Zf, ZB); pave(x0, -22.4, -0.6, Zn); pave(11.0, x1, -0.6, Zn);
  box(L, 0.1, 0.18, std('#8a8a86', { roughness: 0.85 }), [XC, 0.05, Zn - 0.09], g, { cast: false }); box(L, 0.1, 0.18, std('#8a8a86', { roughness: 0.85 }), [XC, 0.05, Zf + 0.09], g, { cast: false });
  // ---- building fronts: far side with a gap for the shop (and the shutter bay at x 8), near side only beyond the stall and the side street ----
  const fac = []; for (let i = 0; i < 6; i++) fac.push(facadeTex(i + 1, { hue: [28, 200, 12, 150, 40, 215][i], ground: ['shutter', 'glass', 'shutter', 'door', 'shutter', 'glass'][i], lit: T.lit * 1.6 })); const facM = [];
  const seg = (cx, z, ry, k, i) => { const [map, em] = fac[k % 6], m = new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: em, emissiveIntensity: 1.4, roughness: 0.92 }); facM.push(m); mesh(new THREE.PlaneGeometry(5, 10), m, [cx, 5, z], g, { cast: false, rot: [0, ry, 0] });
    const tall = 9 + hash(i * 3 + cx) * 5; box(5.0, tall, 0.3, std('#2a2a34', { roughness: 0.95 }), [cx, tall / 2 + 0.1, z + (ry ? 0.3 : -0.3)], g, { cast: false }); if (hash(i + cx) > 0.5) box(4.2, 0.07, 0.7, std('#3a3a44', { roughness: 0.9 }), [cx, 4.2 + hash(i) * 0.6, z + (ry ? -0.3 : 0.3)], g); if (hash(i * 2 + cx) > 0.55) box(0.55, 0.4, 0.5, std('#a2a6ac', { roughness: 0.5 }), [cx + 1, 6.4, z + (ry ? -0.3 : 0.3)], g); };
  for (let k = 0, i = 0; ; k++, i++) { const cx = sh1 + 2.5 + k * 5; if (cx > x1) break; seg(cx, ZB, Math.PI, i, i); }
  for (let k = 0, i = 20; ; k++, i++) { const cx = sh0 - 2.5 - k * 5; if (cx < x0) break; seg(cx, ZB, Math.PI, i + 1, i); }
  for (let k = 0, i = 40; ; k++, i++) { const cx = 15.5 + k * 5; if (cx > x1) break; seg(cx, -0.25, 0, i, i); }
  for (let k = 0, i = 60; ; k++, i++) { const cx = -25 - k * 5; if (cx < x0) break; seg(cx, -0.25, 0, i, i); }
  for (const x of [x0 - 1, x1 + 1]) box(1, 16, 14, std('#232733'), [x, 8, ZR + 1], g, { cast: false });
  // upper floors over the shop (the shop front is only 4.9 m tall; the building must rise above it)
  { const [uMap, uEm] = facadeTex(77, { hue: 215, ground: 'shutter', lit: 0.2, sign: false }); for (const dx of [-5, 0, 5]) { const m = new THREE.MeshStandardMaterial({ map: uMap, emissive: '#ffffff', emissiveMap: uEm, emissiveIntensity: 1.4, roughness: 0.92 }); facM.push(m); mesh(new THREE.PlaneGeometry(5, 10), m, [shopX + dx, 6.9, ZB + 0.15], g, { cast: false, rot: [0, Math.PI, 0] }); } box(shopW, 12, 0.3, std('#2a2a34', { roughness: 0.95 }), [shopX, 6, ZB + 0.5], g, { cast: false }); }
  // ---- the shutter bay (a few doors down, x 8): two pillars and a rolled steel shutter, NO socket on this wall; the hiding spot is between the pillars ----
  { const bx = 8, shutC = canvasTex(256, 512, (c, w, h) => { for (let y = 0; y < h; y += 14) { const gg = c.createLinearGradient(0, y, 0, y + 14); gg.addColorStop(0, '#9fb0bf'); gg.addColorStop(0.55, '#62727f'); gg.addColorStop(1, '#3a4651'); c.fillStyle = gg; c.fillRect(0, y, w, 14); } c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, w, 150); for (let i = 0; i < 5; i++) { c.fillStyle = hash(i) > 0.5 ? '#c93a5a' : '#2a8a9a'; c.fillRect(20 + hash(i * 3) * 190, 160 + hash(i * 7) * 320, 50, 5); } });
    const pm = std('#7a7468', { roughness: 0.9 }); for (const dx of [-1.55, 1.55]) box(0.45, 3.0, 0.6, pm, [bx + dx, 1.5, ZB - 0.35], g); box(3.55, 0.35, 0.6, pm, [bx, 3.1, ZB - 0.35], g);
    mesh(new THREE.PlaneGeometry(2.65, 2.9), new THREE.MeshStandardMaterial({ map: shutC, roughness: 0.5, metalness: 0.5 }), [bx, 1.47, ZB - 0.12], g, { cast: false, rot: [0, Math.PI, 0] }); box(2.7, 0.2, 0.25, std('#4a5868', { roughness: 0.6, metalness: 0.4 }), [bx, 2.95, ZB - 0.3], g); }
  // ---- street lamps: warm, on both kerbs; heads, light pools and two real lights go out with fx.blackout ----
  const lampHead = [], lampPools = [], lampLights = []; const lamp = (x, z, dir) => { const Lp = new THREE.Group(); Lp.position.set(x, 0, z); g.add(Lp); cyl(0.045, 0.07, 5.2, std('#4a4f58', { roughness: 0.6, metalness: 0.5 }), [0, 2.6, 0], Lp, {}, 8); box(0.08, 0.05, 0.9, std('#4a4f58'), [0, 5.2, dir * 0.4], Lp);
    const hd = box(0.2, 0.07, 0.34, emis('#ffb868', 3.2), [0, 5.15, dir * 0.8], Lp, { cast: false }); hd.userData.base = 3.2; lampHead.push(hd); const pl = lightPool(g, [x, 0.03, z + dir * 0.8], 3.1, '#ff9a48', 0.36); lampPools.push([pl, 0.36]); };
  for (const [x, z, d] of [[-47, Zn + 0.4, 1], [-34, Zf - 0.4, -1], [-22, Zn + 0.4, 1], [-9.5, Zf - 0.4, -1], [4.5, Zn + 0.4, 1], [14, Zf - 0.4, -1], [26, Zn + 0.4, 1], [38, Zf - 0.4, -1]]) lamp(x, z, d);
  for (const [x, y, z, k] of [[-9.5, 4.2, 8.2, 24], [4.5, 4.2, 3.6, 18], [-22, 4.2, 3.2, 12]]) { const l = new THREE.PointLight('#ff9d52', k, 8, 2); l.position.set(x, y, z); g.add(l); lampLights.push([l, k]); }
  // ---- ruin: tipped bikes, dead cars, rubble, plastic stools, bags (the crossing line x -4 .. 3.5 stays clear) ----
  const bike = (x, z, ry, col, ly) => { const b = makeBike(col, ly); b.position.set(x, 0.012, z); b.rotation.y = ry; g.add(b); };
  bike(-6.5, 3.2, 0.5, '#b3272c', 1); bike(7.5, 8.4, 2.6, '#2a5aa8', 1); bike(-14, 4.6, -0.2, '#2f8a5a', 1); bike(13, 3.6, 1.1, '#8a2a6a', 1); bike(-20.5, 8.6, 0.4, '#b3272c', 0); bike(21, 7.2, 2.2, '#2a5aa8', 1); bike(-11.5, 10.6, 0.1, '#e0a12a', 0); bike(17, 10.8, 3.1, '#6a6a72', 0);
  const car = deadCar('#6a2a2a'); car.position.set(-27, 0.012, 3.9); car.rotation.y = Math.PI / 2 + 0.06; g.add(car); const car2 = deadCar('#2a3a5a'); car2.position.set(31, 0.012, 8.3); car2.rotation.y = Math.PI / 2 - 0.08; g.add(car2);
  const rub = std('#6a6660', { roughness: 0.95 }); for (let i = 0; i < 60; i++) { let x = x0 + hash(i * 2.1) * L; if (x > -4.5 && x < 3.5) x += 10; const z = hash(i * 3.7) > 0.5 ? Zn + 0.3 + hash(i * 5.3) * 1.2 : Zf - 0.3 - hash(i * 5.3) * 1.2, s2 = 0.05 + hash(i * 7.1) * 0.16; box(s2 * 2, s2, s2 * 1.4, i % 4 ? rub : std('#7a4a3a', { roughness: 0.9 }), [x, s2 * 0.4 + 0.012, z], g, { rot: [hash(i) * 3, hash(i * 3) * 6, hash(i * 5) * 3] }); }
  for (const [x, z, c] of [[-8, 9.0, '#2a6fd0'], [-8.4, 9.6, '#d63a34'], [11, 9.2, '#2a6fd0'], [-16, 3.0, '#d63a34'], [9.5, 3.4, '#2a6fd0']]) { const st = new THREE.Group(); st.position.set(x, 0.15, z); st.rotation.set(hash(x * z) * 1.2 + 1, hash(z) * 6, 0); g.add(st); cyl(0.13, 0.17, 0.24, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4 }), [0, 0.12, 0], st, {}, 16); }
  for (let i = 0; i < 9; i++) mesh(new THREE.SphereGeometry(0.2 + hash(i) * 0.14, 8, 6), std(['#1a1a1e', '#2a3a2a', '#d8d6cc'][i % 3], { roughness: 0.6 }), [((x) => (x > -5 && x < 3.5 ? x + 9 : x))(-30 + i * 9 + (i % 2) * 2), 0.2, i % 2 ? Zn + 0.7 : Zf - 0.8], g, { scale: [1, 0.8, 1] });
  box(2.2, 0.04, 1.4, std('#7c8a96', { roughness: 0.4, metalness: 0.6 }), [6, 0.07, 4.3], g, { rot: [0.04, 0.4, 0.05] });
  // ---- wires over the road and along it ----
  const wireM = new THREE.MeshBasicMaterial({ color: '#06060a' });
  for (let k = 0; k < 4; k++) { const z = 0.5 + k * 3.8, y = 8.6 + (k % 2) * 0.6, pts = []; for (let i = 0; i <= 21; i++) pts.push(new THREE.Vector3(x0 + i * L / 21, y - 0.25 * (i % 2) - 0.03 * i, z + 0.15 * Math.sin(i * 1.3 + k))); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.009, 4), wireM)); }
  for (let i = 0; i < 9; i++) { const x = x0 + 8 + i * 12, y = 8.8 + hash(i) * 0.8; g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x, y, -0.2), new THREE.Vector3(x + 0.3, y - 0.9, ZR), new THREE.Vector3(x, y + 0.1, ZB)]), 18, 0.009, 4), wireM)); }
  // ---- slow things: smoke, fire glow at the far end (-x) and a small one at +x, paper, debt notes ----
  const smokes = [smokeColumn(g, { pos: [-46, 0, 6], n: 16, h: 18, w: 5, color: T.smoke, op: 0.55, period: 40, seed: 1, drift: [-0.5, 0] }), smokeColumn(g, { pos: [-24, 0, 10.5], n: 11, h: 8, w: 2.2, color: T.smoke, op: 0.42, period: 24, seed: 4, drift: [1.0, 0.3] }), smokeColumn(g, { pos: [22, 0, 1.5], n: 9, h: 6, w: 1.4, color: T.smoke, op: 0.3, period: 20, seed: 9, drift: [-1.2, 0.4] })];
  const glows = [[-56, 3, 6, 9, '#ff6a2a', 0.5], [-38, 3, 11, 4, '#ff8a3a', 0.22], [42, 3, 6, 5, '#ff7a3a', 0.2]].map(([x, y, z, r, c, k]) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: c, transparent: true, opacity: k, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); sp.scale.set(r * 2, r * 1.3, 1); sp.position.set(x, y, z); g.add(sp); return [sp, k]; });
  const papers = driftPaper(g, { n: 30, box: [-12, 12, 0.12, 2.0, 1.5, 10.5], wind: [0.5, 0.2], seed: 1, color: T.paper }), notes = driftPaper(g, { n: 34, box: [-9, 7, 0.3, 2.6, 2.6, 9.2], wind: [0.35, 0.18], seed: 7, speed: 0.04, size: 0.3, debt: true, color: '#ffffff' });
  // ---- the moon: cold light for the whole block (weak while the lamps burn, strong after the blackout) ----
  const moon = new THREE.DirectionalLight('#a8c0ff', 0.3); moon.position.set(-9, 16, -9); moon.target.position.set(-1, 0, 6.5); g.add(moon, moon.target);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -17; moon.shadow.camera.right = 17; moon.shadow.camera.top = 14; moon.shadow.camera.bottom = -14; moon.shadow.camera.near = 1; moon.shadow.camera.far = 50; moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03; moon.shadow.radius = 4;
  // ---- marks (world) ----
  const X = shopX, seats = {
    curb_stall: { pos: [X + 0.4, 0, 2.5], yaw: 0 }, mid_road: { pos: [X + 0.1, 0, ZR], yaw: 0 }, curb_shop: { pos: [X, 0, 9.55], yaw: 0 }, shop_door: { pos: [X, 0, 11.3], yaw: 0 },   // the crossing, facing the shop (yaw 0 = facing +z)
    victim: { pos: [X + 0.8, 0, ZR], yaw: Math.PI / 2 }, biter: { pos: [X + 1.4, 0, ZR], yaw: -Math.PI / 2 },                                                                         // the bite pair in the middle of the road, 0.6 m apart facing each other (side-on from the stall)
    end_a: { pos: [-30, 0, ZR - 0.7], yaw: Math.PI / 2 }, end_b: { pos: [-31.6, 0, ZR + 0.7], yaw: Math.PI / 2 },                                                                       // the debt zombies arriving from the far (-x) end, facing the stall
    shutter_hide: { pos: [8.0, 0, ZB - 0.3], yaw: Math.PI }, shutter_hide_b: { pos: [8.75, 0, ZB - 0.3], yaw: Math.PI },                                                            // between the pillars of the shutter bay (no socket)
    run_a: { pos: [10.5, 0, ZR - 0.6], yaw: Math.PI / 2 }, run_b: { pos: [10.5, 0, ZR + 0.6], yaw: Math.PI / 2 }, fall: { pos: [26, 0, ZR], yaw: Math.PI / 2 }, fall_b: { pos: [26.5, 0, ZR + 0.5], yaw: 1.9 },   // the long run away from the stall (+x)
  };
  const horde = []; for (let i = 0; i < 15; i++) { const r = Math.floor(i / 4), c = i % 4; horde.push({ pos: [10.5 - 2.0 - r * 1.35 - hash(i * 1.7) * 0.5, 0, ZR + (c - 1.5) * 1.15 + (hash(i * 3.3) - 0.5) * 0.7 + (r % 2) * 0.4], yaw: Math.PI / 2 + (hash(i * 5.1) - 0.5) * 0.4 }); seats['horde' + (i + 1)] = horde[i]; }   // horde1..15 behind the runners (they face +x)
  const cams = { from_stall: { from: [-0.25, 1.5, -1.25], at: [-1.2, 1.5, 12], f: 34 }, sign_from_stall: { from: [-0.25, 1.3, -1.0], at: [-2, 3.5, 12], f: 80 }, bite_from_stall: { from: [-0.1, 1.15, -0.95], at: [X + 1.1, 1.0, ZR], f: 55 }, cross_low: { from: [X, 0.55, 1.2], at: [X, 1.0, 11], f: 28 } };
  const smoothK = (b, t) => { const sb = smooth(b), flut = 1 - 0.35 * Math.sin(Math.PI * sb) * (0.5 + 0.5 * Math.sin(t * 9.1 + 1.1 * Math.sin(t * 2.7))); return (1 - 0.97 * sb) * flut; };
  return { group: g, seats, horde, moon, cams, bounds: { Zn, Zf, ZB, shopX, sh0, sh1 },
    update(t, fx = {}) {
      const bo = fx.blackout || 0, kB = smoothK(bo, t + 0.4), sm = fx.smoke ?? 1;
      smokes.forEach((s) => s.update(t, sm)); papers.update(t, fx.paper ?? 1); notes.update(t, fx.notes || 0);
      lampHead.forEach((h, i) => { h.material.emissiveIntensity = (h.userData.base * (0.88 + 0.12 * fbm1(t * 0.4 + i * 3.1, 5))) * smoothK(bo, t + i * 0.37); }); lampPools.forEach(([p, k], i) => { p.material.opacity = k * smoothK(bo, t + i * 0.37); }); lampLights.forEach(([l, k], i) => { l.intensity = k * (0.86 + 0.14 * fbm1(t * 0.3 + i * 5, 9)) * smoothK(bo, t + i * 0.37 + 0.2); });
      facM.forEach((m, i) => { m.emissiveIntensity = 1.4 * smoothK(bo, t + (i % 7) * 0.31); }); glows.forEach(([s, k], i) => { s.material.opacity = k * (0.85 + 0.15 * fbm1(t * 0.25 + i * 4, 2)); });
      moon.intensity = lerp(0.3, 1.1, smooth(bo));
    },
  };
}
