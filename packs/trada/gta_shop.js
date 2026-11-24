// Trà đá với AI, special "Tèo vào GTA 6?" part 2 (gta6p2, 20/11): the 24 h GROCERY "TẠP HOÁ 24H" and its shopkeeper CHỊ LAN. A fifth place of the composite set `gta` (place `shop`, origin x +1600),
// registered like the bank (gta_world.js builds it only when an episode asks: places include 'shop' or setOpts.shop is given, so older episodes are byte-identical).
// Look (owner 19/11, "nhìn phát biết GTA 6"): Miami night-dusk, pink-purple-orange sky behind the building, flamingo-pink art-deco facade with neon tubes, tall palms, wet street with neon pools, the
// "bản Việt hoá" on top (a plastic stool, a lucky cat, instant-noodle shelves, a kitchen-clock, a quạt). Nothing here is a real brand, logo, typeface, map or character.
// Law of this file: a pure function of t (ramps and slow waves only). Shop-local frame (the composite adds the origin): the front wall is the plane z = 0, the street is z > 0 (sidewalk 0..3, road 3.4..13),
// the shop interior is x -4.2..4.2, z -6.4..0, ceiling 3.3. Yaw 0 = facing +z (towards the street). The camera usually stands in the street (+z) looking -z, or inside (behind the counter) looking +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LIGHT_PRESETS } from '../../core/stage.js';
import { clamp, lerp, smooth, hash, noise1, canvasTex, grain, std, mesh, box, cyl, ball } from '../../core/util.js';
import { makePerson } from './people.js';
import { lightPool } from './street.js';
import { neonText, fitText, FONT, plateTex, glowMat, addMat, mergeList, xf } from './gta_bank.js';
import { skyDome, addPalm, finishPalms, deco_lamp, decoFront, flamingo } from './gta_world.js';   // (a module cycle: only used at call time)

Object.assign(LIGHT_PRESETS, {
  gta_shop: { hemi: ['#6a4a98', '#1c1030', 0.36], key: ['#ffa466', 46, [-1.6, 2.7, 2.4]], rim: ['#ff4fb0', 64, [2.0, 2.4, -1.7]], kick: ['#3adcf0', 14, [-2.2, 1.9, -1.2]], fog: ['#4a2a6a', 0.0045] },
});
const PINK = '#ff4fb8', CYAN = '#34e8ff', AMBER = '#ffb040';
const MAT = (o) => new THREE.MeshStandardMaterial(o);
const ease = (x) => smooth(clamp(x));
const SHOP_LOOK = { exposure: 0.88, bloom: [0.2, 0.45, 1.15], env: 0.06, grade: { contrast: 1.14, sat: 1.12, vig: 0.38, grain: 0.014, shadowTint: [0.0, 0.012, 0.045], hiTint: [0.05, 0.014, 0.0] } };

// ---------------------------------------------------------------------------------------------------------------------------------------
// CHỊ LAN: the shopkeeper. Young woman (adult), dyed-pink bob, mint apron over a pale-pink tee, a cyan hair clip, always on her phone.
// Poses (the standing set + these): idle (hands on the counter) yawn (right hand over the mouth, with face `sleepy` = the yawn) scroll (phone low, reads it: with `look: 'down'`) live (phone raised high in a selfie, other hand
// on the counter) liveWave (the same, the free hand waves) push (phone high, the free hand reaches over the counter: pushes the cash roll) point (phone high, the free arm points at the door, to her screen-left).
// Faces: Tèo's names, plus `sleepy` = a wide yawn (eyes shut, mouth open) and `love` = the eyes light up (wide eyes, big open grin).
// ---------------------------------------------------------------------------------------------------------------------------------------
const TORSO = [[0.001, 0.3], [0.13, 0.3], [0.168, 0.36], [0.172, 0.46], [0.155, 0.58], [0.128, 0.68], [0.085, 0.735], [0.04, 0.752], [0.001, 0.755]];
const rAt = (y) => { for (let i = 0; i < TORSO.length - 1; i++) { const [r0, y0] = TORSO[i], [r1, y1] = TORSO[i + 1]; if (y >= y0 && y <= y1) return lerp(r0, r1, (y - y0) / (y1 - y0)); } return 0.04; };
function phoneScreens() {
  const live = canvasTex(256, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a2a6a'); g.addColorStop(1, '#ff8a5a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,200,120,0.5)'; c.beginPath(); c.ellipse(w / 2, h * 0.62, 70, 120, 0, 0, 7); c.fill();                                              // the subject: a hooded blob
    c.fillStyle = '#ff2a3a'; c.beginPath(); c.roundRect(14, 16, 92, 40, 12); c.fill(); c.fillStyle = '#fff'; c.font = FONT(28); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LIVE', 60, 37);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.roundRect(116, 16, 120, 40, 12); c.fill(); c.fillStyle = '#fff'; c.font = FONT(26); c.fillText('1,2K', 176, 37);
    for (let i = 0; i < 4; i++) { c.fillStyle = ['#ff5a8a', '#ff7aa0', '#ff4a7a', '#ff9ab8'][i]; c.beginPath(); c.arc(214 - (i % 2) * 22, 440 - i * 62, 15, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 3; i++) c.fillRect(16, 400 + i * 30, 90 + (i * 47 % 70), 14); });
  const feed = canvasTex(256, 512, (c, w, h) => { c.fillStyle = '#f4eef8'; c.fillRect(0, 0, w, h); const cols = ['#ff8ab4', '#8ae0d4', '#ffd36a', '#b49af0'];
    for (let i = 0; i < 4; i++) { c.fillStyle = cols[i]; c.beginPath(); c.roundRect(14, 20 + i * 122, 228, 106, 14); c.fill(); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(54, 73 + i * 122, 22, 0, 7); c.fill(); c.fillRect(92, 55 + i * 122, 120, 12); c.fillRect(92, 80 + i * 122, 80, 12); } });
  return { live, feed };
}
export function makeLan() {
  const build = 0.93, zs = 0.82 * lerp(1, build, 0.5), L = 0.36;
  const decorate = ({ body, head, R, hipY, topM }) => {
    const mint = std('#5fd6b8', { roughness: 0.8 }), mintD = std('#3fae95', { roughness: 0.85 });
    const strip = (mat, y0, y1, half, off, yaw = 0) => { const pts = []; for (let i = 0; i <= 8; i++) { const y = lerp(y0, y1, i / 8); pts.push(new THREE.Vector2(rAt(y) + off, y - 0.3)); } const m = mesh(new THREE.LatheGeometry(pts, 12, yaw - half / 0.16, 2 * half / 0.16), mat, [0, hipY, 0], body); m.scale.set(build, 1, zs); return m; };
    strip(mint, 0.43, 0.72, 0.105, 0.007); strip(mintD, 0.31, 0.44, 0.17, 0.007);                                  // bib + lower apron
    for (const s of [-1, 1]) strip(mint, 0.7, 0.755, 0.014, 0.007, s * 0.4);                                         // straps
    // a pocket and a little heart pin
    { const pk = strip(std('#2fa088', { roughness: 0.8 }), 0.36, 0.43, 0.075, 0.013); void pk; }
    mesh(new THREE.SphereGeometry(0.018, 12, 8), std('#ff4f90', { emissive: '#ff4f90', emissiveIntensity: 0.4 }), [0.06, L + 0.6, 0.13], body, { scale: [1, 1, 0.5], cast: false });
    // the hair clip
    mesh(new THREE.SphereGeometry(1, 14, 10), std('#34e8ff', { emissive: '#34e8ff', emissiveIntensity: 0.5, roughness: 0.4 }), [0.125, 0.085, 0.07], head, { scale: [0.034, 0.014, 0.018], rot: [0, 0, 0.5], cast: false });
    // her phone (a cartoon 1.25 x): the screen faces her; fx liveP shows the LIVE screen, scrollP the feed
    const S = phoneScreens(), ph = new THREE.Group(); body.add(ph); ph.visible = false;
    mesh(new RoundedBoxGeometry(0.09, 0.18, 0.011, 3, 0.009), std('#17151d', { roughness: 0.3, metalness: 0.4 }), [0, 0, 0], ph);
    const scr = mesh(new THREE.PlaneGeometry(0.08, 0.16), new THREE.MeshStandardMaterial({ map: S.live, emissive: '#ffffff', emissiveMap: S.live, emissiveIntensity: 1.0, roughness: 0.6 }), [0, 0, -0.0062], ph, { cast: false, rot: [0, Math.PI, 0] });
    return { update(p, t, api, H) { const lv = clamp(p.liveP || 0), sc = clamp(p.scrollP || 0), k = Math.max(lv, sc); ph.visible = k > 0.5; if (!ph.visible) return;
      const m = lv >= sc ? S.live : S.feed; if (scr.material.map !== m) { scr.material.map = m; scr.material.emissiveMap = m; scr.material.needsUpdate = true; }
      ph.position.copy(H[1]).add(new THREE.Vector3(0.0, 0.07, 0.03)); ph.rotation.set(lv >= sc ? -0.25 : -0.5, lv >= sc ? 0.12 : 0.2, 0.05); } };
  };
  const p = makePerson({ decorate, name: 'lan', skin: '#efc3a0', hair: 'bob', hairColor: '#d4478c', top: '#ffe3ee', collar: '#ffffff', bottom: '#38426a', age: 'young', build, stand: true, lift: L, lash: true, shoe: '#f4f1ea', color: '#ff8ec0', seed: 61, lips: '#d83a6a' });
  const ZC = 0.4;
  Object.assign(p.poses, {
    idle: { l: [-0.17, 0.99, ZC, 0], r: [0.17, 0.99, ZC, 0] },
    yawn: { l: [-0.17, 0.99, ZC, 0], r: [0.035, 1.19, 0.2, 0] },
    scroll: { l: [-0.17, 0.99, ZC, 0], r: [0.15, 1.04, 0.34, 0], scrollP: 1 },
    live: { l: [-0.17, 0.99, ZC, 0], r: [0.24, 1.34, 0.34, 0], liveP: 1 },
    liveWave: { l: [-0.22, 1.3, 0.3, 1], r: [0.24, 1.34, 0.34, 0], liveP: 1 },
    push: { l: [-0.1, 1.0, 0.64, 0], r: [0.24, 1.34, 0.34, 0], liveP: 1 },
    point: { l: [-0.43, 1.12, 0.4, 0], r: [0.24, 1.34, 0.34, 0], liveP: 1 },
  });
  Object.assign(p.faces, {
    sleepy: { eye: 0.1, arc: 0, size: 1, brow: 0.5, tilt: 0, smile: 0, open: 1, wide: 0.75, blush: 0.4, sweat: 0, tear: 0 },                        // the yawn
    love: { eye: 1, arc: 0, size: 1.3, brow: 0.9, tilt: 0, smile: 1, open: 0.7, wide: 1.3, blush: 1, sweat: 0, tear: 0 },                           // the eyes light up: this is content
  });
  return p;
}
export const SHOP_CHARS = { lan: makeLan };

// ---------------------------------------------------------------------------------------------------------------------------------------
// small builders
// ---------------------------------------------------------------------------------------------------------------------------------------
const cgeo = (g, col) => { const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const GOODS = ['#ff5a8a', '#5fe0c8', '#ffd24a', '#4ac8ff', '#ff9a3a', '#b48aff', '#ff4a4a', '#f4f0e8', '#7adf6a'];
// one shelf bay (w wide, rows tall) of goods + frame, as [geometry, matrix] lists in bay-local coordinates (x along the width, y up, z = the way the goods face)
function bay(goods, frame, w, rows, seed, depth = 0.34, y0 = 0.12, gap = 0.4) {
  for (let r = 0; r < rows; r++) { const y = y0 + r * gap; frame.push([cgeo(new THREE.BoxGeometry(w, 0.035, depth), '#d9cfc2'), xf([0, y, 0])]);
    let x = -w / 2 + 0.05, i = 0; while (x < w / 2 - 0.1) { const h = hash(seed + r * 13.1 + i * 7.7), k = Math.floor(hash(seed * 3.1 + r * 5.3 + i * 2.9) * 4), col = GOODS[Math.floor(hash(seed + r * 3.3 + i * 1.7) * GOODS.length)]; i++;
      let g, wd, hh;
      if (k === 0) { wd = 0.1 + 0.05 * h; hh = 0.16 + 0.07 * h; g = new THREE.BoxGeometry(wd, hh, depth * 0.7); }                                            // a box (noodles, biscuits)
      else if (k === 1) { wd = 0.075; hh = 0.12; g = new THREE.CylinderGeometry(0.037, 0.037, hh, 10); }                                                   // a can
      else if (k === 2) { wd = 0.07; hh = 0.24 + 0.04 * h; g = new THREE.CylinderGeometry(0.03, 0.036, hh, 10); }                                          // a bottle
      else { wd = 0.13 + 0.04 * h; hh = 0.2; g = new THREE.BoxGeometry(wd, hh, 0.05); }                                                                       // a bag (chips)
      if (x + wd > w / 2 - 0.04) break; goods.push([cgeo(g, col), xf([x + wd / 2, y + 0.0175 + hh / 2, k === 3 ? depth * 0.15 : 0], [0, k === 3 ? (h - 0.5) * 0.3 : 0, 0])]); x += wd + 0.012; } }
  frame.push([cgeo(new THREE.BoxGeometry(0.04, y0 + rows * gap, depth), '#8f8a96'), xf([-w / 2, (y0 + rows * gap) / 2, 0])], [cgeo(new THREE.BoxGeometry(0.04, y0 + rows * gap, depth), '#8f8a96'), xf([w / 2, (y0 + rows * gap) / 2, 0])]);
}
const place = (list, M) => list.map(([g, m]) => [g, M.clone().multiply(m)]);
// the cracks as REAL GEOMETRY (thin white ribbons in the door plane, three stages): no texture, so any renderer that keeps meshes and their visibility keeps the cracks
function crackLines(stage) {   // polylines in a 512 x 1024 grid, from the kick point (x 0.80, y 0.66), three stages: a star, a web, a smash
  const cx = 512 * 0.8, cy = 1024 * 0.66, rnd = (i) => hash(i * 3.7 + stage * 11.3), N = [6, 11, 17][stage], len = [150, 300, 560][stage], out = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 + rnd(i) * 0.4, L0 = len * (0.45 + 0.55 * rnd(i + 20)); const pl = [[cx, cy]]; let x = cx, y = cy; for (let k = 1; k <= 5; k++) { const aa = a + (rnd(i * 7 + k) - 0.5) * 0.35; x += Math.cos(aa) * L0 / 5; y += Math.sin(aa) * L0 / 5; pl.push([x, y]); } out.push(pl);
    if (stage >= 1 && i % 2 === 0) { const bx = cx + Math.cos(a) * L0 * 0.5, by = cy + Math.sin(a) * L0 * 0.5, ab = a + (i % 4 ? 0.7 : -0.7); out.push([[bx, by], [bx + Math.cos(ab) * L0 * 0.35, by + Math.sin(ab) * L0 * 0.35]]); } }
  if (stage >= 1) for (const rr of stage === 1 ? [70, 150] : [60, 130, 220]) { const pl = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2, r = rr * (0.85 + 0.3 * rnd(i + rr)); pl.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } out.push(pl); }
  return out;
}
function crackMesh(stage, DW, DH, parent) {
  const W = DW - 0.1, Hh = DH - 0.2, X = (px) => (px / 512 - 0.5) * W + DW / 2, Y = (py) => DH / 2 + (0.5 - py / 1024) * Hh, pos = [];
  for (const pl of crackLines(stage)) for (let i = 0; i + 1 < pl.length; i++) { const x0 = X(pl[i][0]), y0 = Y(pl[i][1]), x1 = X(pl[i + 1][0]), y1 = Y(pl[i + 1][1]); if (x0 < 0.05 && x1 < 0.05) continue; const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 0.0032, ny = dx / l * 0.0032;
    pos.push(x0 + nx, y0 + ny, 0, x0 - nx, y0 - ny, 0, x1 + nx, y1 + ny, 0, x0 - nx, y0 - ny, 0, x1 - nx, y1 - ny, 0, x1 + nx, y1 + ny, 0); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.computeVertexNormals();
  const m = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: '#e8f0fa', emissive: '#c8dcf0', emissiveIntensity: 0.6, roughness: 0.3, side: THREE.DoubleSide })); m.position.set(0, 0, 0.022 + stage * 0.001); m.castShadow = false; m.userData.noOutline = true; parent.add(m); return m;
}
const keypadTex = (n) => canvasTex(256, 384, (c, w, h) => { c.fillStyle = '#16202a'; c.fillRect(0, 0, w, h); c.fillStyle = '#0b1218'; c.beginPath(); c.roundRect(24, 20, 208, 76, 10); c.fill();
  c.fillStyle = n >= 5.5 ? '#42e8a0' : '#7fe6f2'; c.font = FONT(54); c.textAlign = 'center'; c.textBaseline = 'middle'; const s = n >= 5.5 ? 'MỞ' : '●'.repeat(Math.min(5, n)) + '-'.repeat(Math.max(0, 5 - n)); c.fillText(s, w / 2, 60);
  for (let i = 0; i < 12; i++) { const x = 34 + (i % 3) * 66, y = 118 + Math.floor(i / 3) * 62; c.fillStyle = i === 9 || i === 11 ? '#32414f' : '#d8dee6'; c.beginPath(); c.roundRect(x, y, 56, 50, 10); c.fill(); c.fillStyle = '#16202a'; c.font = FONT(30); if (i < 9) c.fillText(String(i + 1), x + 28, y + 26); else if (i === 10) c.fillText('0', x + 28, y + 26); } });

// ---------------------------------------------------------------------------------------------------------------------------------------
// THE SHOP
// ---------------------------------------------------------------------------------------------------------------------------------------
export function buildGtaShop(scene, { at = [0, 0, 0], safeCode = 12345, stoolIn = false } = {}) {   // stoolIn: true = the red plastic stool (and the mark `stool_bip`) stands INSIDE the shop by the door, so Bíp watches from within (gta6p2, 20/11)
  const g = new THREE.Group(); g.name = 'gta_shop'; g.position.set(...at); scene.add(g);
  const seats = {}, cams = {}; const S = (n, p, yaw = 0) => { seats[n] = { pos: [p[0] + at[0], p[1] + at[1], p[2] + at[2]], yaw }; };
  const X0 = -4.2, X1 = 4.2, ZB = -6.4, H = 3.3, TOP = 0.92;
  // ---- sky: a night-dusk behind the building (the sun below the roof line; its glow lights the sky above the facade) ----
  skyDome(g, { r: 150, sunDir: [-0.12, 0.012, -0.99], sunR: 9, seed: 21, stops: [[0, '#120e34'], [0.2, '#2c1c66'], [0.34, '#6a2a8c'], [0.42, '#c8407e'], [0.47, '#ff6a60'], [0.495, '#ffa656'], [0.5, '#ffc882'], [0.52, '#ec8a86'], [0.6, '#8a4a84'], [0.75, '#3a2c68'], [1, '#1c1a4a']] });
  // ---- ground: sidewalk (pale pink-grey pavers), kerb, wet road with neon pools ----
  const paveT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#4a3c5a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#54466a' : '#3e3250'; c.fillRect(i * 128 + 3, j * 128 + 3, 122, 122); } grain(c, w, h, 4000, 0.08, 6, 3); }, { repeat: [10, 3] });
  mesh(new THREE.PlaneGeometry(60, 3.4), MAT({ map: paveT, roughness: 0.45 }), [0, 0, 1.7], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  box(60, 0.14, 0.3, std('#7a6a8a'), [0, 0.07, 3.55], g, { cast: false });
  const roadT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#1a1626'; c.fillRect(0, 0, w, h); grain(c, w, h, 6000, 0.06, 3, 2); }, { repeat: [10, 1] });
  mesh(new THREE.PlaneGeometry(80, 10), MAT({ map: roadT, roughness: 0.28, envMapIntensity: 1.2 }), [0, 0.001, 8.7], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  for (let i = 0; i < 12; i++) box(2.2, 0.01, 0.16, std('#ffe9a0', { emissive: '#ffd070', emissiveIntensity: 0.3 }), [-26 + i * 5, 0.012, 9.2], g, { cast: false });
  lightPool(g, [-1.4, 0.03, 4.4], 3.8, '#ff5fb8', 0.4); lightPool(g, [2.0, 0.03, 4.8], 3.4, '#34e8ff', 0.35); lightPool(g, [0, 0.03, 1.4], 4.8, '#ff9ccc', 0.22);
  // ---- the neighbours (pastel deco fronts, neon words) and the far side of the road ----
  const nbr = (x, word, neon, wall, seed) => { const F = decoFront({ seed, word, neon, wall, floors: 4 }); const ng = new THREE.Group(); ng.position.set(x, 0, -0.02); g.add(ng);
    mesh(new THREE.PlaneGeometry(9, F.H), new THREE.MeshStandardMaterial({ map: F.maps[0], emissive: '#fff', emissiveMap: F.maps[1], emissiveIntensity: 1.0, roughness: 0.8 }), [0, F.H / 2, 0], ng, { cast: false }); box(9, F.H, 8, std('#8a4a78'), [0, F.H / 2, -4.05], ng, { cast: false }); return ng; };
  nbr(-8.7, 'KARAOKE', CYAN, '#a8e6cf', 3); nbr(8.7, 'PHỞ BÒ', PINK, '#fff0a0', 4); nbr(-17.7, 'CẦM ĐỒ', PINK, '#cdb8f0', 5); nbr(17.7, 'RỬA XE', CYAN, '#ffc9a8', 6);
  { const F = decoFront({ seed: 8, word: 'BÁNH MÌ', neon: PINK, wall: '#7fe0d8', floors: 4 }), ng = new THREE.Group(); ng.position.set(-2, 0, 22.0); ng.rotation.y = Math.PI; g.add(ng); mesh(new THREE.PlaneGeometry(9, F.H), new THREE.MeshStandardMaterial({ map: F.maps[0], emissive: '#fff', emissiveMap: F.maps[1], emissiveIntensity: 1.4, roughness: 0.8 }), [0, F.H / 2, 0], ng, { cast: false }); box(9, F.H, 6, std('#d884ac'), [0, F.H / 2, -3.05], ng, { cast: false });
    const F2 = decoFront({ seed: 9, word: 'NHÀ NGHỈ', neon: CYAN, wall: '#ffa6c9', floors: 4 }), n2 = new THREE.Group(); n2.position.set(8, 0, 22.0); n2.rotation.y = Math.PI; g.add(n2); mesh(new THREE.PlaneGeometry(9, F2.H), new THREE.MeshStandardMaterial({ map: F2.maps[0], emissive: '#fff', emissiveMap: F2.maps[1], emissiveIntensity: 1.4, roughness: 0.8 }), [0, F2.H / 2, 0], n2, { cast: false }); }
  // palms along the sidewalk, lamps
  { const tr = [], fr = []; [[-5.6, 2.3, 9.5], [5.8, 2.5, 8.6], [-12.5, 2.4, 10], [13, 2.4, 9], [-20, 2.4, 9.4], [21, 2.4, 10]].forEach(([x, z, h], i) => addPalm(tr, fr, x, z, h, i + 70)); finishPalms(g, tr, fr, { leaf: '#14403c', trunk: '#4a3a3a' }); }
  deco_lamp(g, 4.6, 3.0, -1, '#ff9fd0'); deco_lamp(g, -6.8, 3.0, 1, '#ffd08a'); flamingo(g, 5.2, 1.4, -0.6, 0.9);
  // ---- the facade: flamingo-pink art deco with a neon outline, riser, piers, lintel with the big sign ----
  const wallM = MAT({ color: '#a83a78', roughness: 0.75 }), wallD = MAT({ color: '#7e2a5e', roughness: 0.8 }), alu = std('#c8d0d6', { metalness: 0.7, roughness: 0.35 });
  const DX0 = -1.1, DX1 = 0.2, WL = [-3.9, -1.4], WR = [0.6, 3.9], WY = [0.5, 2.8];   // window sill 0.5 m (was 0.8): a seated Bíp's chest and spark show through the glass from the street
  for (const [a, b] of [[X0, DX0], [DX1, X1]]) box(b - a, WY[0], 0.3, wallM, [(a + b) / 2, WY[0] / 2, -0.15], g);          // riser under the windows (the door gap is open down to the floor)
  box(DX1 - DX0, 0.05, 0.3, wallD, [(DX0 + DX1) / 2, 0.025, -0.15], g);
  for (const [a, b] of [[X0, WL[0]], [WL[1], DX0], [DX1, WR[0]], [WR[1], X1]]) box(b - a, WY[1], 0.3, wallM, [(a + b) / 2, WY[1] / 2, -0.15], g);
  box(X1 - X0 + 0.3, 4.95 - WY[1], 0.34, wallM, [0, (4.95 + WY[1]) / 2, -0.15], g);                                  // the lintel + parapet
  box(X1 - X0 + 0.5, 0.18, 0.5, wallD, [0, 4.98, -0.12], g, { cast: false });
  const tubeM = (c, k = 3.2) => new THREE.MeshStandardMaterial({ color: '#000', emissive: c, emissiveIntensity: k, roughness: 1 });
  for (const [w, h, x, y, c] of [[X1 - X0 + 0.5, 0.05, 0, 4.9, PINK], [X1 - X0 + 0.3, 0.05, 0, 2.86, CYAN], [0.05, 4.8, X0 + 0.12, 2.4, CYAN], [0.05, 4.8, X1 - 0.12, 2.4, CYAN]]) box(w, h, 0.05, tubeM(c), [x, y, 0.03], g, { cast: false });
  for (const [a, b] of [WL, WR]) { box(b - a + 0.1, 0.05, 0.05, tubeM(PINK, 2.4), [(a + b) / 2, WY[0] - 0.02, 0.05], g, { cast: false }); }
  // glass: tinted panes with a pink street reflection, aluminium frames, window stickers
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.1, roughness: 0.6, specularIntensity: 0.05, envMapIntensity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  for (const [a, b] of [WL, WR]) { const w = b - a; box(w, WY[1] - WY[0], 0.02, glassM, [(a + b) / 2, (WY[0] + WY[1]) / 2, -0.02], g, { cast: false }); for (const y of [WY[0], WY[1]]) box(w + 0.08, 0.06, 0.08, alu, [(a + b) / 2, y, -0.04], g, { cast: false }); for (const x of [a, b]) box(0.06, WY[1] - WY[0], 0.08, alu, [x, (WY[0] + WY[1]) / 2, -0.04], g, { cast: false }); box(0.05, WY[1] - WY[0], 0.06, alu, [(a + b) / 2, (WY[0] + WY[1]) / 2, -0.04], g, { cast: false }); }
  const stick = (txt, col, x, y, w, h, fg = '#fff') => { const T = plateTex(Math.round(w * 400), Math.round(h * 400), txt, { bg: col, fg, edge: '#ffffff' }); mesh(new THREE.PlaneGeometry(w, h), MAT({ map: T, roughness: 0.6, emissive: '#ffffff', emissiveMap: T, emissiveIntensity: 0.5 }), [x, y, 0.012], g, { cast: false }); };
  stick('NƯỚC NGỌT', '#ff4f90', -3.0, 2.35, 1.2, 0.34); stick('XÚC XÍCH', '#34a8d8', -2.2, 2.35, 0.9, 0.34); stick('NÓNG', '#ffa030', 3.3, 2.35, 0.7, 0.34); stick('NỘP TIỀN ĐIỆN', '#7a50d0', 1.6, 2.35, 1.4, 0.34);
  // the glass door (a leaf hinged at its left edge, swings INTO the shop; fx door), pull bar, "open" sticker, cracks (fx crack 0..1), the bell (fx bell)
  let openSign = null; const hinge = new THREE.Group(); hinge.position.set(DX0, 0, -0.04); g.add(hinge); const DW = DX1 - DX0, DH = 2.36;
  const doorGlass = box(DW, DH, 0.025, glassM, [DW / 2, DH / 2, 0], hinge, { cast: false });
  for (const [w, h, x, y] of [[DW, 0.07, DW / 2, DH], [DW, 0.1, DW / 2, 0.05], [0.07, DH, 0.0, DH / 2], [0.07, DH, DW, DH / 2]]) box(w, h, 0.07, alu, [x, y, 0], hinge, { cast: false });
  cyl(0.018, 0.018, 0.7, alu, [DW - 0.14, 1.05, 0.07], hinge, { cast: false }, 10); { const T = plateTex(256, 96, 'MỞ CỬA 24/7', { bg: '#ff4f90', fg: '#fff', edge: '#fff' }); openSign = mesh(new THREE.PlaneGeometry(0.46, 0.17), glowMat(T, 0.7), [DW * 0.48, 1.55, 0.016], hinge, { cast: false }); }
  const cracks = [0, 1, 2].map((st) => { const m = crackMesh(st, DW, DH, hinge); m.visible = false; return m; });
  const bellG = new THREE.Group(); bellG.position.set(DX0 + DW * 0.6, 2.38, -0.2); g.add(bellG); box(0.5, 0.03, 0.03, alu, [0, 0, 0], g, { cast: false }).position.set(DX0 + DW * 0.6, 2.4, -0.2);
  { const bg = new THREE.Group(); bg.position.set(0, 0, 0); bellG.add(bg); cyl(0.004, 0.004, 0.12, std('#caa24a'), [0, -0.06, 0], bg, { cast: false }, 6); ball(0.045, std('#e8c050', { metalness: 0.7, roughness: 0.3, emissive: '#6a4a10', emissiveIntensity: 0.3 }), [0, -0.14, 0], bg, { cast: false }, 14); ball(0.012, std('#6a4a10'), [0, -0.19, 0], bg, { cast: false }, 8); bellG.userData.bell = bg; }
  // the big sign over the shop: TẠP HOÁ (pink) 24H (cyan) on a dark plate with a neon tube border, halo
  { const W = 6.9, Hh = 1.34, signT = (em) => canvasTex(1536, 300, (c, w, h) => { c.fillStyle = em ? '#000' : '#1c1238'; c.fillRect(0, 0, w, h); c.beginPath(); c.roundRect(16, 16, w - 32, h - 32, 46); c.lineWidth = 12; c.strokeStyle = em ? CYAN : '#5cd8ee'; c.shadowColor = CYAN; c.shadowBlur = em ? 30 : 0; c.stroke(); c.shadowBlur = 0;
      neonText(c, 'TẠP HOÁ', w * 0.36, h / 2 + 4, 176, PINK, { glow: em ? 0.5 : 0.0, core: em ? '#ffe4f4' : '#ffd0e8', tube: 0.11 }); neonText(c, '24H', w * 0.82, h / 2 + 4, 176, CYAN, { glow: em ? 0.5 : 0.0, core: em ? '#e8ffff' : '#d0ffff', tube: 0.11 }); });
    const st = signT(false), se = signT(true); mesh(new THREE.PlaneGeometry(W, Hh), new THREE.MeshStandardMaterial({ map: st, emissive: '#ffffff', emissiveMap: se, emissiveIntensity: 1.6, roughness: 0.6 }), [0, 3.85, 0.05], g, { cast: false });
    mesh(new THREE.PlaneGeometry(W * 1.35, Hh * 2.3), addMat(canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,120,200,0.55)'); gr.addColorStop(1, 'rgba(255,60,160,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { mip: false }), '#ffffff', 0.5), [0, 3.85, 0.3], g, { cast: false, recv: false }).renderOrder = 3; }
  // ---- interior shell: floor (checker), side walls, back wall, ceiling with tube lights ----
  const floorT = canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#1f6a70' : '#8aa6a8'; c.fillRect(i * 128, j * 128, 128, 128); } grain(c, w, h, 1800, 0.05, 3, 2); }, { repeat: [(X1 - X0) / 1.0, (-ZB) / 1.0] });
  mesh(new THREE.PlaneGeometry(X1 - X0, -ZB), MAT({ map: floorT, roughness: 0.55, envMapIntensity: 0.3 }), [0, 0.002, ZB / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const sideM = MAT({ color: '#6a4a98', roughness: 0.92 }), backM = MAT({ color: '#2f7f74', roughness: 0.9 });
  mesh(new THREE.PlaneGeometry(-ZB, H), sideM, [X0, H / 2, ZB / 2], g, { cast: false, rot: [0, Math.PI / 2, 0] }); mesh(new THREE.PlaneGeometry(-ZB, H), sideM, [X1, H / 2, ZB / 2], g, { cast: false, rot: [0, -Math.PI / 2, 0] });
  mesh(new THREE.PlaneGeometry(X1 - X0, H), backM, [0, H / 2, ZB], g, { cast: false });
  const ceilT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#4a3a66'; c.fillRect(0, 0, w, h); }, { repeat: [1, 1] }); mesh(new THREE.PlaneGeometry(X1 - X0, -ZB), MAT({ map: ceilT, roughness: 1 }), [0, H, ZB / 2], g, { cast: false, rot: [Math.PI / 2, 0, 0] });
  for (const [x, z] of [[-2.2, -1.2], [-2.2, -4.2], [1.4, -1.2], [1.4, -4.2]]) { box(0.14, 0.05, 1.5, tubeM('#d8dcff', 0.55), [x, H - 0.04, z], g, { cast: false }); box(0.22, 0.04, 1.6, std('#dedae6'), [x, H - 0.015, z], g, { cast: false }); }
  // ---- shelves and goods (merged, vertex colours): back wall left, left wall, a middle aisle gondola ----
  const goods = [], frame = [], bayRows = 4;
  [[-3.0, ZB + 0.2, 0, 1.5], [-1.5, ZB + 0.2, 0, 1.4]].forEach(([x, z, yaw, w], i) => { const gl = [], fl = []; bay(gl, fl, w, bayRows, 11 + i * 5); const M = xf([x, 0, z], [0, yaw, 0]); goods.push(...place(gl, M)); frame.push(...place(fl, M)); });
  [-1.4, -2.7, -4.0, -5.3].forEach((z, i) => { const gl = [], fl = []; bay(gl, fl, 1.2, bayRows, 31 + i * 7); const M = xf([X0 + 0.22, 0, z], [0, Math.PI / 2, 0]); goods.push(...place(gl, M)); frame.push(...place(fl, M)); });
  [[-1.9, -2.4], [-1.9, -3.6]].forEach(([x, z], i) => { for (const s of [1, -1]) { const gl = [], fl = []; bay(gl, fl, 1.15, 3, 51 + i * 9 + s * 3, 0.34, 0.12, 0.38); const M = xf([x + s * 0.2, 0, z], [0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0]); goods.push(...place(gl, M)); frame.push(...place(fl, M)); } box(0.42, 1.3, 1.2, std('#9a94a4'), [x, 0.65, z], g, { cast: false }); });
  mergeList(goods, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: '#2a1a30', emissiveIntensity: 0.08 }), g, { cast: true }); mergeList(frame, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), g, { cast: false });
  // the drinks fridge (right of the back wall's calm patch? no: LEFT end), glowing cold; hanging snack strips; a poster; the clock; a fan
  { const fg = new THREE.Group(); fg.position.set(-3.5, 0, ZB + 0.45); g.add(fg); box(1.5, 2.0, 0.7, std('#e6e8f0', { roughness: 0.5 }), [0, 1.0, 0], fg); const bt = canvasTex(256, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b8f0ff'); gr.addColorStop(1, '#6ac8e8'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let r = 0; r < 5; r++) for (let i = 0; i < 7; i++) { c.fillStyle = GOODS[(i * 3 + r * 5) % GOODS.length]; c.beginPath(); c.roundRect(10 + i * 34, 28 + r * 96, 24, 66, 8); c.fill(); } });
    mesh(new THREE.PlaneGeometry(1.36, 1.8), glowMat(bt, 0.8), [0, 1.05, 0.36], fg, { cast: false }); box(1.4, 0.1, 0.05, std('#2a2a3a'), [0, 2.0, 0.37], fg, { cast: false }); }
  { const pt = canvasTex(256, 360, (c, w, h) => { c.fillStyle = '#ffd24a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff3a6a'; c.beginPath(); c.roundRect(14, 14, w - 28, 120, 14); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'KHUYẾN MÃI', w - 60, 52); c.fillText('KHUYẾN MÃI', w / 2, 74); c.fillStyle = '#1c1238'; fitText(c, 'MUA 2 TẶNG 1', w - 50, 40); c.fillText('MUA 2 TẶNG 1', w / 2, 200); c.fillStyle = '#ff3a6a'; c.beginPath(); c.arc(w / 2, 290, 40, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = FONT(40); c.fillText('-50%', w / 2, 292); });
    mesh(new THREE.PlaneGeometry(0.8, 1.12), MAT({ map: pt, roughness: 0.8 }), [0.4, 1.95, ZB + 0.03], g, { cast: false }); }
  { const clk = new THREE.Group(); clk.position.set(2.7, 2.55, ZB + 0.04); g.add(clk); mesh(new THREE.CircleGeometry(0.34, 36), MAT({ color: '#fff8ec', roughness: 0.5 }), [0, 0, 0], clk, { cast: false }); cyl(0.36, 0.36, 0.03, std('#ff4f90'), [0, 0, -0.012], clk, { cast: false, rot: [Math.PI / 2, 0, 0] }, 36);
    const hm = new THREE.Group(), hh = new THREE.Group(); clk.add(hm, hh); box(0.025, 0.24, 0.01, std('#222'), [0, 0.12, 0.012], hm, { cast: false }); box(0.035, 0.16, 0.01, std('#222'), [0, 0.08, 0.02], hh, { cast: false }); hm.rotation.z = -1.9; hh.rotation.z = -5.2; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(0.02, 0.05, 0.008, std('#222'), [Math.sin(a) * 0.27, Math.cos(a) * 0.27, 0.008], clk, { cast: false }).rotation.z = -a; } }
  const fan = new THREE.Group(); fan.position.set(-3.9, 2.25, -2.0); g.add(fan); const fanBlades = new THREE.Group(); fan.add(fanBlades); cyl(0.04, 0.04, 0.5, std('#aaa'), [0, -0.25, 0], fan, { cast: false }, 8); for (let i = 0; i < 3; i++) { const b = new THREE.Group(); b.rotation.z = i * 2.094; fanBlades.add(b); mesh(new THREE.SphereGeometry(1, 12, 8), std('#e8f0f8', { roughness: 0.5 }), [0, 0.17, 0], b, { scale: [0.07, 0.17, 0.012], cast: false }); } ball(0.06, std('#c8ccd6'), [0, 0, 0.02], fan, { cast: false }, 12); fan.rotation.y = Math.PI / 2; fanBlades.position.set(0, 0, 0.0);
  // ---- the counter: pastel front with a glass display, top at 0.92; on it: register + drawer, ring light, lucky cat, candy jar, the small SAFE with a keypad ----
  const CX0 = 0.1, CX1 = 3.95, CZF = -2.95, CZB = -3.75, CZ = (CZF + CZB) / 2;
  box(CX1 - CX0, TOP, CZF - CZB, MAT({ color: '#c8387e', roughness: 0.55 }), [(CX0 + CX1) / 2, TOP / 2, CZ], g);
  box(CX1 - CX0 + 0.06, 0.05, CZF - CZB + 0.08, MAT({ color: '#6a3a6e', roughness: 0.35 }), [(CX0 + CX1) / 2, TOP + 0.005, CZ], g, { cast: false });
  { const dt = canvasTex(512, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff6ea'); gr.addColorStop(1, '#ffd8e8'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { c.fillStyle = GOODS[i % GOODS.length]; c.beginPath(); c.roundRect(14 + i * 27, 70 + (i % 3) * 34, 22, 56 + (i % 4) * 16, 8); c.fill(); } });
    mesh(new THREE.PlaneGeometry(1.7, 0.5), glowMat(dt, 0.45), [2.2, 0.5, CZF + 0.012], g, { cast: false }); box(1.76, 0.03, 0.03, alu, [2.2, 0.77, CZF + 0.02], g, { cast: false }); box(1.76, 0.03, 0.03, alu, [2.2, 0.24, CZF + 0.02], g, { cast: false }); }
  { const bt2 = plateTex(512, 96, 'GIÁ NIÊM YẾT · KHÔNG MẶC CẢ', { bg: '#1c1238', fg: '#ffd24a', edge: '#ff4f90' }); mesh(new THREE.PlaneGeometry(1.2, 0.225), glowMat(bt2, 0.6), [0.8, 0.5, CZF + 0.012], g, { cast: false }); }
  // register + drawer (fx drawer 0..1 slides it towards the customer)
  const reg = new THREE.Group(); reg.position.set(0.5, TOP + 0.03, CZ - 0.05); g.add(reg); box(0.42, 0.14, 0.38, std('#2c2c3a', { roughness: 0.5 }), [0, 0.07, 0], reg); { const sc = canvasTex(128, 96, (c, w, h) => { c.fillStyle = '#10202a'; c.fillRect(0, 0, w, h); c.fillStyle = '#7fffa8'; c.font = FONT(44); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('0.340', w / 2, h / 2); }); box(0.24, 0.17, 0.03, std('#2c2c3a'), [0, 0.22, -0.1], reg, { rot: [-0.25, 0, 0] }); mesh(new THREE.PlaneGeometry(0.2, 0.13), glowMat(sc, 0.9), [0, 0.225, -0.083], reg, { cast: false, rot: [-0.25, 0, 0] }); }
  const drawer = new THREE.Group(); drawer.position.set(0, 0.04, 0.12); reg.add(drawer); box(0.38, 0.06, 0.3, std('#b8bcc8', { metalness: 0.6, roughness: 0.4 }), [0, 0, 0], drawer, { cast: false }); for (let i = 0; i < 4; i++) box(0.09, 0.012, 0.13, std(['#c8e8c0', '#f0d8e8', '#c0e0f0', '#e8e0b0'][i]), [-0.12 + i * 0.08, 0.034, 0.02 + (i % 2) * 0.03], drawer, { cast: false, rot: [0, (i - 1.5) * 0.12, 0] });
  // the cash roll (cuộn tiền): bills in a rubber band; fx cash 0..1 slides it from Lan's side to the edge in front of Tèo (and back with 0)
  const cash = new THREE.Group(); g.add(cash); { const bm = MAT({ color: '#a8d890', roughness: 0.7 }), bn = MAT({ color: '#ff4f4f', roughness: 0.6 }); cyl(0.046, 0.046, 0.15, bm, [0, 0.046, 0], cash, {}, 16).rotation.z = Math.PI / 2; for (const x of [-0.035, 0.035]) cyl(0.049, 0.049, 0.018, bn, [x, 0.046, 0], cash, { cast: false }, 16).rotation.z = Math.PI / 2; }
  // the lucky cat waves (slow sine), the ring light (fx ring), the candy jar
  const catG = new THREE.Group(); catG.position.set(0.28, TOP + 0.03, CZ + 0.05); g.add(catG); { const cw = MAT({ color: '#fbf4ec', roughness: 0.45 }), red = MAT({ color: '#e83a4a', roughness: 0.5 }); mesh(new THREE.SphereGeometry(0.1, 20, 14), cw, [0, 0.1, 0], catG, { scale: [1, 1.08, 0.9] }); ball(0.075, cw, [0, 0.24, 0.01], catG, {}, 20); for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.026, 0.05, 8), cw, [s * 0.05, 0.31, 0.01], catG, { rot: [0, 0, -s * 0.2] }); ball(0.012, std('#1c1238'), [-0.028, 0.255, 0.075], catG, {}, 8); ball(0.012, std('#1c1238'), [0.028, 0.255, 0.075], catG, {}, 8); box(0.1, 0.018, 0.02, red, [0, 0.178, 0.06], catG, {}); ball(0.018, std('#ffd24a', { metalness: 0.6, roughness: 0.3 }), [0, 0.15, 0.09], catG, {}, 10);
    const arm = new THREE.Group(); arm.position.set(0.09, 0.14, 0.03); catG.add(arm); mesh(new THREE.SphereGeometry(0.03, 12, 10), cw, [0.02, 0.06, 0], arm, { scale: [0.7, 1.7, 0.7] }); catG.userData.arm = arm; }
  const ringG = new THREE.Group(); ringG.position.set(2.55, TOP + 0.03, CZ + 0.1); g.add(ringG); cyl(0.012, 0.012, 0.45, std('#2a2a3a'), [0, 0.225, 0], ringG, { cast: false }, 8); for (const a of [0, 2.1, 4.2]) cyl(0.008, 0.008, 0.28, std('#2a2a3a'), [Math.sin(a) * 0.09, 0.07, Math.cos(a) * 0.09], ringG, { cast: false, rot: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5] }, 6);
  const ringHeadG = new THREE.Group(); ringHeadG.position.set(0, 0.5, 0); ringG.add(ringHeadG); const ringMat = new THREE.MeshStandardMaterial({ color: '#f4eef6', emissive: '#fff0f8', emissiveIntensity: 0.0, roughness: 0.4 }); mesh(new THREE.TorusGeometry(0.19, 0.032, 12, 40), ringMat, [0, 0, 0], ringHeadG, { cast: false }); box(0.07, 0.11, 0.025, std('#17151d'), [0, 0, -0.012], ringHeadG, { cast: false });   // the phone holder in the middle
  ringHeadG.rotation.y = 0.0; const ringHalo = mesh(new THREE.PlaneGeometry(0.9, 0.9), addMat(canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(255,240,250,0.9)'); gr.addColorStop(0.45, 'rgba(255,170,220,0.35)'); gr.addColorStop(1, 'rgba(255,120,200,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { mip: false }), '#ffffff', 0), [0, 0, 0.1], ringHeadG, { cast: false, recv: false }); ringHalo.renderOrder = 4;
  const ringLight = new THREE.PointLight('#ffd8f0', 0, 3.4, 2); ringLight.position.set(0, 0, 0.35); ringHeadG.add(ringLight);
  { const jar = new THREE.Group(); jar.position.set(1.55, TOP + 0.03, CZ + 0.18); g.add(jar); cyl(0.07, 0.07, 0.17, new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, roughness: 0.1 }), [0, 0.085, 0], jar, { cast: false }, 18); for (let i = 0; i < 14; i++) ball(0.02, std(GOODS[i % GOODS.length], { roughness: 0.3 }), [(hash(i * 2.1) - 0.5) * 0.07, 0.03 + (i % 4) * 0.035, (hash(i * 3.3) - 0.5) * 0.07], jar, { cast: false }, 8); cyl(0.074, 0.074, 0.02, std('#ff4f90'), [0, 0.18, 0], jar, { cast: false }, 18); }
  // ---- the SAFE on the counter (right end): door hinged on the right, keypad, a cookie tin with sewing thread inside (the lid lifts: fx tinLid) ----
  const SX = 3.4, SW = 0.58, SH = 0.46, SD = 0.46, SZ = CZ + 0.02, SF = SZ + SD / 2;   // front face z = SF
  const safe = new THREE.Group(); safe.position.set(SX, TOP + 0.03, SZ); g.add(safe);
  const steel = MAT({ color: '#6a7488', roughness: 0.45, metalness: 0.55 });
  { const T = 0.04, inner = MAT({ color: '#2a2e3c', roughness: 0.7, side: THREE.DoubleSide }); box(SW, T, SD, steel, [0, T / 2, 0], safe); box(SW, T, SD, steel, [0, SH - T / 2, 0], safe); box(T, SH, SD, steel, [-SW / 2 + T / 2, SH / 2, 0], safe); box(T, SH, SD, steel, [SW / 2 - T / 2, SH / 2, 0], safe); box(SW, SH, T, steel, [0, SH / 2, -SD / 2 + T / 2], safe); box(SW - 2 * T, SH - 2 * T, 0.01, inner, [0, SH / 2, -SD / 2 + T + 0.006], safe, { cast: false }); box(SW - 2 * T, 0.01, SD - 2 * T, inner, [0, T + 0.006, 0], safe, { cast: false }); }   // a hollow box: the cookie tin really sits inside
  const tin = new THREE.Group(); tin.position.set(-0.03, 0.05, -0.02); safe.add(tin); cyl(0.14, 0.14, 0.15, MAT({ color: '#2a6ac8', roughness: 0.45 }), [0, 0.075, 0], tin, {}, 24);
  { const tt = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#2a6ac8'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff8e0'; c.beginPath(); c.roundRect(14, 18, w - 28, h - 36, 12); c.fill(); c.fillStyle = '#c83a2a'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'BÁNH QUY BƠ', w - 60, 36); c.fillText('BÁNH QUY BƠ', w / 2, 46); c.fillStyle = '#7a4a1a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(40 + i * 44, 92, 12, 0, 7); c.fill(); } }); mesh(new THREE.CylinderGeometry(0.1405, 0.1405, 0.12, 28, 1, true), MAT({ map: tt, roughness: 0.5, side: THREE.DoubleSide }), [0, 0.075, 0], tin, { cast: false }); }
  const lid = new THREE.Group(); lid.position.set(0, 0.152, 0); tin.add(lid); cyl(0.148, 0.148, 0.025, MAT({ color: '#d8dce8', roughness: 0.35, metalness: 0.5 }), [0, 0.0125, 0], lid, {}, 24);
  for (const [x, z, c] of [[-0.05, 0.02, '#ff4f6a'], [0.04, -0.03, '#ffd24a'], [0.0, 0.07, '#3ad0a0'], [0.07, 0.05, '#6a5af0']]) { const sp = new THREE.Group(); sp.position.set(x, 0.12 + z * 0.1, z); tin.add(sp); sp.userData.k = 1; cyl(0.03, 0.03, 0.05, std(c, { roughness: 0.6 }), [0, 0, 0], sp, { cast: false }, 14); for (const y of [-0.026, 0.026]) cyl(0.036, 0.036, 0.006, std('#eee0c8'), [0, y, 0], sp, { cast: false }, 14); tin.userData.spools = (tin.userData.spools || []).concat([sp]); }
  const sdoor = new THREE.Group(); sdoor.position.set(SW / 2 - 0.02, 0, SD / 2); safe.add(sdoor);          // hinge on the right edge (as seen from the street)
  box(SW - 0.02, SH - 0.02, 0.04, steel, [-(SW - 0.02) / 2, SH / 2, 0.02], sdoor); for (const y of [0.1, SH - 0.1]) cyl(0.02, 0.02, 0.05, std('#c8ccd6', { metalness: 0.8, roughness: 0.3 }), [0.0, y, 0.02], sdoor, { cast: false }, 10);
  const keyMat = new THREE.MeshStandardMaterial({ map: keypadTex(0), emissive: '#ffffff', emissiveMap: keypadTex(0), emissiveIntensity: 0.9, roughness: 0.5 }); mesh(new THREE.PlaneGeometry(0.16, 0.24), keyMat, [-0.12, SH * 0.5, 0.043], sdoor, { cast: false }); box(0.18, 0.26, 0.012, std('#10151c'), [-0.12, SH * 0.5, 0.036], sdoor, { cast: false });
  { const wh = new THREE.Group(); wh.position.set(-0.4, SH * 0.55, 0.045); sdoor.add(wh); cyl(0.07, 0.07, 0.025, std('#c8ccd6', { metalness: 0.8, roughness: 0.3 }), [0, 0, 0], wh, { cast: false, rot: [Math.PI / 2, 0, 0] }, 20); for (let i = 0; i < 3; i++) box(0.17, 0.014, 0.014, std('#c8ccd6', { metalness: 0.8, roughness: 0.3 }), [0, 0, 0.02], wh, { cast: false }).rotation.z = i * Math.PI / 3; }
  const safeLed = ball(0.014, new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff3a3a', emissiveIntensity: 2.4 }), [-0.12, SH * 0.5 + 0.145, 0.05], sdoor, { cast: false }, 8);
  // ---- the red plastic stool by the door (seat top 0.30) ----
  const STOOL = stoolIn ? [-2.15, -0.9] : [-2.1, 1.75];
  { const st = new THREE.Group(); st.position.set(STOOL[0], 0, STOOL[1]); g.add(st); const red = MAT({ color: '#e8283a', roughness: 0.4 }); cyl(0.19, 0.17, 0.06, red, [0, 0.27, 0], st, {}, 24); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; cyl(0.022, 0.03, 0.27, red, [Math.cos(a) * 0.13, 0.135, Math.sin(a) * 0.13], st, {}, 8).rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); } for (const y of [0.13]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 20), red); r.rotation.x = Math.PI / 2; r.position.y = y; st.add(r); } cyl(0.14, 0.14, 0.012, std('#b81a2a'), [0, 0.302, 0], st, { cast: false }, 24); }
  // ---- fx shatter 0..1: the door glass bursts into 56 shards that fly OUT into the street (+z), spin, fall and lie on the pavement (a pure function of the ramp); fx police 0..1: red / blue light sweeps through the windows and over the faces inside ----
  const shardGeo = (i) => { const gg = new THREE.BufferGeometry(), a = 0.5 + hash(i * 3.1), b = 0.4 + hash(i * 5.7), c2 = 0.3 + hash(i * 7.9), v = [0, 0.6 * a, 0, -0.5 * b, -0.45, 0, 0.55 * c2, -0.35, 0]; gg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); gg.computeVertexNormals(); return gg; };
  const shardM = new THREE.MeshStandardMaterial({ color: '#d8f4ff', emissive: '#9ad8ff', emissiveIntensity: 0.35, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }); shardM.emissiveIntensity = 0.6;
  const shards = []; for (let i = 0; i < 56; i++) { const m = new THREE.Mesh(shardGeo(i), shardM); m.visible = false; g.add(m);
    // shards fly RADIALLY out of the door plane (up, down, sideways) and only a little into the street, so at the freeze they ring the person who comes through (who is 0.9 m outside the plane, in front of them) and the biggest ones sit at the edge of the frame
    const th = hash(i * 6.3) * Math.PI * 2, R = 1.5 + 2.4 * hash(i * 9.7), sz = 0.13 + 0.14 * hash(i * 2.3) + 0.05 * R;
    shards.push({ m, sz, x0: DX0 + 0.1 + (DX1 - DX0 - 0.2) * hash(i * 1.7), y0: 0.3 + 1.8 * hash(i * 4.1), vx: Math.cos(th) * R, vy: Math.sin(th) * R * 0.9, vz: 0.3 + 0.9 * hash(i * 8.9), sx: (hash(i * 11.1) - 0.5) * 14, sy: (hash(i * 12.3) - 0.5) * 12, sz2: (hash(i * 13.7) - 0.5) * 16 }); }
  const polR = new THREE.SpotLight('#ff2a3a', 0, 30, 0.7, 1, 2), polB = new THREE.SpotLight('#2a50ff', 0, 30, 0.7, 1, 2); polR.position.set(0.6, 1.5, 8.6); polB.position.set(2.6, 1.5, 8.6); const polT = new THREE.Object3D(); polT.position.set(1.6, 1.3, -2.5); g.add(polT, polR, polB); polR.target = polT; polB.target = polT;
  const washT = canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { mip: false });
  const wash = [['#ff2030', 0], ['#2040ff', 1]].map(([col, k]) => { const m = mesh(new THREE.PlaneGeometry(4.6, 3.0), addMat(washT, col, 0), [0, 1.8, 0.07], g, { cast: false, recv: false }); m.renderOrder = 5; return { m, k }; });
  const polPools = [lightPool(g, [0.0, 0.03, 5.4], 4.4, '#ff2030', 0), lightPool(g, [2.8, 0.03, 5.4], 4.4, '#2040ff', 0)];
  // ---- practical lights (only on while the shop shows): fluorescent over the counter, pink neon spill at the front, a cyan one for the street ----
  const lamps = [new THREE.PointLight('#ffd8b8', 5, 6.2, 2), new THREE.PointLight('#ff6ac0', 7, 7, 2), new THREE.PointLight('#5ae0ff', 4, 6, 2)];
  lamps[0].position.set(1.5, 2.6, -3.0); lamps[1].position.set(-0.6, 3.0, 1.2); lamps[2].position.set(3.0, 2.2, 2.4); lamps.forEach((l) => g.add(l));
  // ---- marks ----
  S('stool_bip', [STOOL[0], 0, STOOL[1]], stoolIn ? 0.2 : 0.35); S('front_teo', [0.35, 0, 2.7], -0.5); S('door_kick', [-0.45, 0, 1.0], Math.PI); S('entry', [-0.45, 0, -0.75], Math.PI); S('exit', [-0.45, 0, 0.55], 0); S('street', [0, 0, 5.5], 0);
  S('counter', [1.6, 0, -2.65], Math.PI); S('behind_counter', [1.6, 0, -4.0], 0); S('safe_teo', [SX + 0.22, 0, SF + 0.42], Math.PI); S('safe_walk', [2.6, 0, -1.8], Math.PI); S('far_street', [3.0, 0, 8], 0);
  // ---- cams (free shots, shop-local metres; the composite adds nothing: they already include the origin) ----
  const C = (n, from, a, f) => { cams[n] = { from: [from[0] + at[0], from[1] + at[1], from[2] + at[2]], at: [a[0] + at[0], a[1] + at[1], a[2] + at[2]], f }; };
  C('ext_wide', [0.9, 1.15, 6.8], [-0.4, 2.3, 0], 22); C('ext_two', [-0.4, 1.3, 5.4], [-1.5, 1.15, 1.8], 40); C('through_glass', [1.7, 1.35, 1.4], [1.6, 1.3, -4.0], 75); C('feet_low', [-0.5, 0.22, 3.4], [-0.5, 0.25, 1.0], 36);
  C('door_kick', [1.5, 1.2, 2.7], [-0.5, 1.0, 0.4], 40); C('door_inside', [0.6, 1.3, -2.2], [-0.5, 1.2, 0.0], 36); C('counter_cu', [0.6, 1.45, -4.9], [1.6, 1.12, -2.65], 80); C('counter_two', [-0.2, 1.4, -1.0], [1.6, 1.1, -3.4], 36);
  C('feet_inside', [-0.45, 0.2, -1.7], [-0.45, 0.42, 1.0], 50); C('interior_wide', [0.2, 1.5, -0.8], [2.0, 1.2, -3.5], 28); C('safe_close', [2.3, 1.4, -1.6], [3.5, 1.15, -3.15], 55); C('phone_close', [2.3, 1.85, -4.9], [1.85, 1.34, -3.65], 70); C('lan_cu', [0.6, 1.4, -1.7], [1.75, 1.2, -4.0], 70);
  const KP = [SX - 0.12 + at[0], at[1] + TOP + 0.03 + SH * 0.5, SF + at[2]];
  // ---- the fx ----
  const update = (t, fx = {}) => {
    // door: fx door 0..1 = the leaf swings about 1.1 rad INTO the shop (with a small bounce), fx crack 0..1 = the three crack stages fade in, fx bell 0..1 = the bell swings (give it a ramp 1 -> 0 over 0.8 s)
    const dk = clamp(fx.door || 0), dsw = smooth(dk) * 1.1 + Math.sin(Math.PI * clamp(dk * 1.25)) * 0.05 * (dk > 0.8 ? (1 - dk) * 5 : 1); hinge.rotation.y = dsw + 0.012 * Math.sin(t * 38) * clamp(fx.bell || 0);
    const ck = clamp(fx.crack || 0); cracks[0].visible = ck > 0.02; cracks[1].visible = ck > 0.4; cracks[2].visible = ck > 0.75;   // geometry stages: shown or hidden (carried by any renderer that keeps visibility)
    const bl = clamp(fx.bell || 0); bellG.userData.bell.rotation.z = bl * 0.9 * Math.sin(t * 17); bellG.userData.bell.rotation.x = bl * 0.35 * Math.sin(t * 13 + 1);
    // register drawer, cash roll, ring light, safe
    drawer.position.z = 0.12 + 0.2 * ease(fx.drawer || 0);
    const cs = ease(fx.cash || 0); cash.visible = (fx.cash || 0) > 0.003; cash.position.set(lerp(1.9, 1.45, cs), TOP + 0.035 + 0.06 * Math.sin(Math.PI * cs), lerp(-3.55, -3.1, cs)); cash.rotation.y = 0.5 * (1 - cs) + 1.5708;
    const rg = clamp(fx.ring || 0); ringMat.emissiveIntensity = 3.2 * rg; ringHalo.material.opacity = 0.75 * rg; ringLight.intensity = 1.4 * rg;
    catG.userData.arm.rotation.z = -0.9 + 0.55 * Math.sin(t * 3.6); catG.userData.arm.position.y = 0.14 + 0.01 * Math.sin(t * 3.6);
    fanBlades.rotation.z = t * 9.0;
    const nk = Math.round(clamp(fx.keys || 0, 0, 5)), want = fx.safe > 0.45 ? 6 : nk; if (keyMat.userData.n !== want) { keyMat.userData.n = want; const tx = keypadTex(want); keyMat.map = tx; keyMat.emissiveMap = tx; keyMat.needsUpdate = true; }
    safeLed.material.emissive.set(fx.safe > 0.45 ? '#42e8a0' : '#ff3a3a');
    const so = ease(fx.safe || 0), sbump = Math.sin(Math.PI * clamp((fx.safe || 0) * 1.1)) * 0.06; sdoor.rotation.y = -(so * 1.9 + sbump); safe.position.y = TOP + 0.03 + 0.012 * Math.exp(-6 * Math.max(0, (fx.safe || 0) - 0.35)) * Math.sin(t * 45) * (fx.safe > 0.35 && fx.safe < 0.9 ? 1 : 0);
    const tl = ease(fx.tinLid || 0); lid.position.set(0.06 * tl, 0.152 + 0.17 * tl, 0.0); lid.rotation.set(0, 0, -0.5 * tl); for (const sp of tin.userData.spools) sp.position.y = 0.12 + 0.0 + 0.03 * tl;
    // shards: the leaf glass and its cracks vanish at the burst, the pieces fly out (+z), spin, fall and lie still
    const sk2 = clamp(fx.shatter || 0), T = 1.15 * (1 - Math.pow(1 - sk2, 2)); doorGlass.visible = sk2 < 0.02; if (openSign) openSign.visible = sk2 < 0.02; if (sk2 > 0.02) for (const c of cracks) c.visible = false;
    for (const sd of shards) { sd.m.visible = sk2 > 0.003; if (!sd.m.visible) continue; const fall = Math.max(0.03, sd.y0 + sd.vy * T - 4.9 * T * T * 0.85), landed = fall <= 0.031; sd.m.position.set(sd.x0 + sd.vx * T, fall, -0.04 + sd.vz * T * (1 - 0.3 * T)); sd.m.scale.setScalar(sd.sz * (0.6 + 0.4 * Math.min(1, sk2 * 8)));
      sd.m.rotation.set(landed ? 1.45 : sd.sx * T, sd.sy * T, sd.sz2 * T * (landed ? 0.2 : 1)); }
    // police lights: red and blue take turns on a smooth 1.4 s swing (cos squared, never a hard switch), a wash sweeps across the glass, pools of colour on the pavement
    const pk = smooth(clamp(fx.police || 0)), ph = t * Math.PI * 2 / 1.4, rI = Math.pow(Math.max(0, Math.sin(ph)), 2), bI = Math.pow(Math.max(0, -Math.sin(ph)), 2) * 0.0 + Math.pow(Math.max(0, Math.sin(ph + Math.PI)), 2);
    polR.intensity = 520 * pk * rI; polB.intensity = 520 * pk * bI; wash[0].m.material.opacity = 0.3 * pk * rI; wash[1].m.material.opacity = 0.3 * pk * bI;
    wash[0].m.position.x = 1.6 + 1.8 * Math.sin(ph * 0.5 + 0.4); wash[1].m.position.x = 1.6 - 1.8 * Math.sin(ph * 0.5 + 0.4);
    polPools[0].material.opacity = 0.55 * pk * rI; polPools[1].material.opacity = 0.55 * pk * bI;
    lamps.forEach((l, i) => { l.intensity = [5, 7, 4][i] * (0.96 + 0.04 * noise1(t * 0.9 + i * 7, 21 + i)); });   // the neon buzzes, slowly
  };
  const out = { group: g, seats, cams, update, look: SHOP_LOOK, light: 'gta_shop', lightAt: [1.0, 1.0, 0.8], consts: { TOP, KEYPAD: KP, SAFE_X: SX, SAFE_FRONT_Z: SF, COUNTER: [CX0, CX1, CZB, CZF], safeCode } };
  return out;
}
