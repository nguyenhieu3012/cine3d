// stall `plus`, the street half: building fronts with lit windows and balconies (both sides), the lamp posts, a wet road with puddles, parked scooters, the traffic
// (scooters + a car with head / tail lights that sweep light over the pavement), a walker on the far kerb, a TV glowing in a far window, drifting leaves and dust specks near the lamps.
// Every moving thing is a pure function of t (the engine renders frames in any order). Called from stall_plus.js. World: camera looks -z, side street at x 3.5 .. 10.7.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hash, lerp, smooth, noise1, canvasTex, std, emis, mesh, box, cyl, ball, lathe } from '../../core/util.js';
import { makeBike, softDisc, lightPool } from './street.js';
import { mergedBoxes, walk, isPlane, texBytes, lightCtl } from './stall_plus_lib.js';
import { buildCar, buildScooter, buildWalker } from './stall_plus_veh.js';

const FONT = (px, w = 900) => `${w} ${px}px Display, sans-serif`;
const PM = 98.5, TW = 384, TH = 1088, FWM = 3.9, FHM = TH / PM;                  // a facade texture covers 3.9 m x 11.04 m (98.5 px per metre)
export const WIN = { cols: [[0.3, 1.3], [2.3, 1.3]], sill: 0.9, h: 1.5, ground: 3.2, floor: 2.9 };
const flY = (f) => (f === 0 ? 0 : WIN.ground + (f - 1) * WIN.floor);
export const CYCLE = 34;   // the traffic / walker timetable repeats every 34 s

// ---------- facade textures: 6 variants of [diffuse, emissive] (shop front, two floors of windows, lit or dark, curtains, cages, signs) ----------
const SIGNS = [['PHỞ BÒ', '#ff5a4a'], ['TẠP HOÁ', '#5ad08a'], ['CẮT TÓC', '#ffd45a'], ['SỬA XE', '#5ab4ff'], ['QUÁN ĂN', '#ff9a4a'], ['ĐIỆN MÁY', '#c88aff']];
function facadeTex(v) {
  const hue = [214, 28, 168, 12, 262, 44][v], sat = 20 + (v % 3) * 7, lig = 17 + (v % 2) * 3, H = (k) => hash(v * 101 + k * 7.3);
  const px = (x, y, w, h) => [x * PM, TH - (y + h) * PM, w * PM, h * PM];
  const draw = (c, em) => {
    c.fillStyle = em ? '#000' : `hsl(${hue}, ${sat}%, ${lig}%)`; c.fillRect(0, 0, TW, TH);
    if (!em) { for (let i = 0; i < 16; i++) { c.fillStyle = 'rgba(0,0,0,0.13)'; c.fillRect(H(i) * TW, TH - H(i + 50) * 600 - 300, 3 + H(i + 9) * 10, 120 + H(i + 20) * 300); } for (const f of [0, 1, 2, 3]) { c.fillStyle = `hsl(${hue}, ${sat - 6}%, ${lig + 7}%)`; c.fillRect(...px(0, (f === 0 ? WIN.ground : flY(f) + WIN.floor) - 0.06, FWM, 0.16)); } }
    // ground floor: a closed roller shutter, or an open lit shop with a sign
    const sh = v % 3, [sx, sy, sw, shh] = px(0.18, 0, 3.54, 2.45);
    if (sh === 0) { if (!em) { for (let y = 0; y < shh; y += 5) { const gr = c.createLinearGradient(0, sy + y, 0, sy + y + 5); gr.addColorStop(0, '#8195a8'); gr.addColorStop(1, '#46566a'); c.fillStyle = gr; c.fillRect(sx, sy + y, sw, 5); } c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(sx, sy, sw, shh * 0.3); } }
    else { const gr = c.createLinearGradient(0, sy, 0, sy + shh); gr.addColorStop(0, em ? '#ffd9a0' : '#1c1208'); gr.addColorStop(1, em ? '#ff9f4a' : '#140c05'); c.fillStyle = gr; c.fillRect(sx, sy, sw, shh);
      c.fillStyle = em ? '#000' : '#1a1210'; for (let i = 0; i < 3; i++) c.fillRect(sx + 20, sy + 40 + i * 62, sw - 40, 6); for (let i = 0; i < 9; i++) { c.fillStyle = em ? 'rgba(0,0,0,0.55)' : ['#6a1a24', '#7a6020', '#17503a', '#1e4470'][i % 4]; c.fillRect(sx + 28 + i * 34, sy + 14 + (i % 3) * 62, 20, 26); }
      c.fillStyle = em ? '#000' : '#120d0a'; c.beginPath(); c.roundRect(sx + sw * 0.55, sy + shh * 0.38, 38, shh * 0.62, 12); c.fill(); }
    const [sn, scol] = SIGNS[(v + 2) % 6], [bx, by, bw, bh] = px(0.3, 2.52, 3.3, 0.62); c.fillStyle = em ? '#000' : '#17141b'; c.fillRect(bx, by, bw, bh); c.fillStyle = scol; c.globalAlpha = em ? 1 : 0.3; c.font = FONT(46); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sn, bx + bw / 2, by + bh / 2 + 3, bw - 20); c.globalAlpha = 1;
    // upper floors
    for (let f = 1; f <= 2; f++) WIN.cols.forEach(([x0, w], k) => {
      const [wx, wy, ww, wh] = px(x0, flY(f) + WIN.sill, w, WIN.h), lit = H(f * 11 + k * 3) > 0.4, warm = 26 + H(f * 5 + k) * 28, cool = H(f * 13 + k * 2) > 0.85;
      if (lit) { const gr = c.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, cool ? (em ? '#c8f0e0' : '#2a4038') : `hsl(${warm}, 95%, ${em ? 70 : 9}%)`); gr.addColorStop(1, cool ? (em ? '#8fd0b8' : '#1a2c28') : `hsl(${warm - 6}, 90%, ${em ? 58 : 7}%)`); c.fillStyle = gr; c.fillRect(wx, wy, ww, wh);
        const cc = ['#c24a5a', '#e8d6a8', '#4a7ab8', '#d89a3a'][Math.floor(H(f * 7 + k * 5) * 4)]; c.fillStyle = em ? 'rgba(0,0,0,0.45)' : cc; c.globalAlpha = em ? 1 : 0.55; c.fillRect(wx, wy, ww * 0.26, wh); c.fillRect(wx + ww * 0.74, wy, ww * 0.26, wh); c.globalAlpha = 1;
        if (H(f * 3 + k * 9) > 0.5) { c.fillStyle = em ? '#000' : '#10281a'; c.beginPath(); c.ellipse(wx + ww * 0.5, wy + wh * 0.92, ww * 0.18, wh * 0.2, 0, 0, 7); c.fill(); } }
      else if (!em) { const gr = c.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, '#1d2846'); gr.addColorStop(1, '#080b16'); c.fillStyle = gr; c.fillRect(wx, wy, ww, wh); }
      c.strokeStyle = em ? '#000' : '#16110e'; c.lineWidth = 3; c.strokeRect(wx, wy, ww, wh); c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, wy + wh * 0.42); c.lineTo(wx + ww, wy + wh * 0.42); c.stroke();
      if (H(f * 17 + k * 4) > 0.55) { c.strokeStyle = em ? '#000' : 'rgba(10,10,14,0.85)'; c.lineWidth = 2; for (let i = 0; i <= 5; i++) { c.beginPath(); c.moveTo(wx + i * ww / 5, wy - 6); c.lineTo(wx + i * ww / 5, wy + wh + 30); c.stroke(); } for (let i = 0; i <= 3; i++) { c.beginPath(); c.moveTo(wx, wy + i * (wh + 36) / 3 - 6); c.lineTo(wx + ww, wy + i * (wh + 36) / 3 - 6); c.stroke(); } }   // a "tiger cage" grille
      if (!em && H(f * 19 + k * 6) > 0.6) for (let i = 0; i < 4; i++) { c.fillStyle = ['#d6303f', '#e8e2d2', '#3a8ad6', '#f2b73a'][i]; c.fillRect(wx + 6 + i * ww / 4.4, wy + wh + 4, 20, 34 + H(i + f) * 26); }   // washing
    });
  };
  const mk = (em) => { const t = canvasTex(TW, TH, (c) => draw(c, em), { aniso: 8 }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  return [mk(false), mk(true)];
}

export function buildStreetPlus({ g, scene, P, opts, block, abandoned = 0, steadyLights = false, cold = 0 }) {
  const stats = { texBytes: 0 }, O = { facades: true, lamps: true, puddles: true, traffic: true, walker: true, tv: true, specks: true, ...opts };
  const U = []; const upd = (f) => U.push(f);   // per-frame functions

  // ---------- facades ----------
  const variants = [0, 1, 2, 3, 4, 5].map((v) => facadeTex(v)); stats.texBytes += 6 * 2 * texBytes(TW, TH);
  const reliefPieces = [], palette = ['#a8322f', '#2a5aa8', '#2f8a5a', '#c8902a', '#7a3a8a'];
  const facadeMat = (v, big = false) => { const [m, e] = variants[v]; return new THREE.MeshStandardMaterial({ map: m, emissiveMap: e, emissive: '#ffffff', emissiveIntensity: big ? 0.95 : 1.12, roughness: 0.92 }); };
  const mats = [0, 1, 2, 3, 4, 5].map((v) => facadeMat(v));
  // lamp rules (round 2): the emissive INTENSITY is the stall's own (blackout, steadyLights groups act on it, it collects every emissive material); here the emissive COLOUR (cold: cooler) and the diffuse COLOUR (blue-grey wash) follow cold / blackout
  const CC = (h) => new THREE.Color(h), cool = CC('#a4bcff'), wash = CC('#a9bbdc'), WHITE = CC('#ffffff');
  upd((t, fx, L) => { for (const m of mats) { m.emissive.copy(WHITE).lerp(cool, 0.85 * L.c).multiplyScalar(1 - 0.25 * L.c); m.color.copy(WHITE).lerp(wash, 0.45 * L.u); } });
  const plane = (w, h, x, z, rotY, v, flip) => { const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) { uv.setXY(i, flip ? 1 - uv.getX(i) : uv.getX(i), uv.getY(i) * h / FHM); } const m = new THREE.Mesh(geo, mats[v]); m.position.set(x, h / 2, z); m.rotation.y = rotY; m.castShadow = false; P.add(m); return m; };
  const relief = (dir, x, z, w, hN, seed, skipBelow = 0) => {   // dir = +1: the building front looks towards +x (near side); -1: towards -x (far side)
    const H = (k) => hash(seed * 17 + k * 3.1), cx = x + dir * 0.3;
    for (let f = 1; f <= 2; f++) if (H(f) > 0.3 && f * 3 + 2 < hN + 2) { const zc = z + (H(f + 9) - 0.5) * 0.3, y = flY(f);
      reliefPieces.push({ w: 0.6, h: 0.12, d: 2.9, pos: [cx, y + 0.06, zc], col: '#6a6258' }, { w: 0.06, h: 0.55, d: 2.9, pos: [x + dir * 0.57, y + 0.4, zc], col: '#34343c' }, { w: 0.6, h: 0.5, d: 0.06, pos: [cx, y + 0.37, zc - 1.42], col: '#34343c' }, { w: 0.6, h: 0.5, d: 0.06, pos: [cx, y + 0.37, zc + 1.42], col: '#34343c' }); }
    for (let f = 1; f <= 2; f++) if (H(f + 30) > 0.62) reliefPieces.push({ w: 0.3, h: 0.36, d: 0.55, pos: [x + dir * 0.15, flY(f) + 1.45, z], col: '#aeb4ba' });   // an air conditioner
    reliefPieces.push({ w: 1.0, h: 0.06, d: 3.3, pos: [x + dir * 0.5, 3.0, z], rot: [0, 0, -dir * 0.32], col: palette[Math.floor(H(7) * 5)] });   // shop awning
    reliefPieces.push({ w: 0.8, h: 0.8, d: 0.9, pos: [x + dir * 0.9, hN + 0.4, z + (H(5) - 0.5) * 1.4], col: '#1d2634' }, { w: 0.4, h: 0.3, d: w, pos: [x + dir * 0.2, hN + 0.15, z], col: '#3a3a44' });   // roof tank, parapet
  };
  let tvPos = null;
  if (O.facades) {
    walk(g, (m) => isPlane(m, 3.9, m.geometry?.parameters?.height, 11.6)).forEach((m) => { m.visible = false; });
    for (let i = block ? 1 : 0; i < 11; i++) { const z = 4 - i * 3.9, hN = 9.0 + hash(i * 1.7) * 1.9, v = (i * 5 + 1) % 6; plane(3.9, hN, 11.58, z, -Math.PI / 2, v, false); relief(-1, 11.58, z, 3.9, hN, i + 1);
      if (i === 4) tvPos = { x: 11.555, z: z + (WIN.cols[1][0] + WIN.cols[1][1] / 2 - FWM / 2) * 1, y: flY(2) + WIN.sill + WIN.h / 2 }; }
    const far = plane(12, 13, 6.4, -41.97, 0, 3, false); far.geometry.attributes.uv.array.forEach((_, i, a) => { if (i % 2 === 0) a[i] *= 12 / 3.9; }); far.geometry.attributes.uv.needsUpdate = true; walk(g, (m) => isPlane(m, 12, 13, 6.4)).forEach((m) => { if (m !== far) m.visible = false; });
    // the near side of the street: nine more fronts along the stall's own building (the first two stay flat: the blade signs hang there)
    walk(g, (m) => isPlane(m, 36, 8.4)).forEach((m) => { m.userData.oldSide = true; });
    for (let k = 0; k < 9; k++) { const z = -1.5 - 2 - k * 4.0, hN = 9.0 + hash(k * 2.3 + 5) * 1.9, v = (k * 5 + 3) % 6; plane(4.0, hN, 1.315, z, Math.PI / 2, v, false); if (k >= 2) relief(1, 1.315, z, 4.0, hN, k + 40); }
    const rm = mergedBoxes(reliefPieces, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); if (rm) { rm.name = 'plus_relief'; P.add(rm); }
  }
  // the TV window: a pane whose colour cuts like a programme (every 0.4 .. 3 s), a pure function of t
  let tv = null;
  if (O.tv && tvPos) { tv = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.78), new THREE.MeshBasicMaterial({ color: '#5a8aff' })); tv.position.set(tvPos.x, tvPos.y - 0.1, tvPos.z); tv.rotation.y = -Math.PI / 2; P.add(tv);
    const TVC = ['#4a78ff', '#ff5a8a', '#3ac8a0', '#f0e2a8', '#8a6aff', '#ff9a4a'];
    upd((t, fx, L) => { const per = 1.43, q = Math.floor(t / per), fr = t / per - q, id = q * 2 + (fr > hash(q * 1.7) ? 1 : 0), col = TVC[steadyLights ? 0 : Math.floor(hash(id * 7.7) * TVC.length)], fl = steadyLights ? 0.72 : 0.72 + 0.12 * noise1(t * 9, 5); tv.material.color.set(col).lerp(cool, 0.6 * L.c).multiplyScalar(fl * L.k); }); }   // steadyLights: one steady colour, no cuts

  // ---------- lamp posts: a shade over each bulb, a glow, a plinth, a pool of light; two more posts further down (emissive only, no extra light) ----------
  const lampHalos = [], lampPools = [];
  if (O.lamps) {
    const dark = std('#2c3038', { roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }), haloM = () => new THREE.SpriteMaterial({ map: softDisc(), color: '#ffd9a0', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    const dress = (parent, z, withPole) => { if (withPole) { cyl(0.05, 0.07, 4.6, std('#4a4f58', { roughness: 0.6, metalness: 0.5 }), [0, 2.3, 0], parent, {}, 10); box(0.9, 0.06, 0.1, std('#4a4f58'), [0.4, 4.55, 0], parent); ball(0.12, emis('#ffd9a0', withPole === 2 ? 5 : 7), [0.78, 4.47, 0], parent, { cast: false }, 14); }
      lathe([[0.001, 0.12], [0.1, 0.08], [0.21, 0.0]], dark, [0.78, 4.55, 0], parent, { cast: false }, 18); cyl(0.1, 0.12, 0.34, std('#3a3f48', { roughness: 0.6, metalness: 0.4 }), [0, 0.17, 0], parent, { cast: false }, 12); cyl(0.065, 0.065, 0.12, std('#3a3f48'), [0, 1.2, 0], parent, { cast: false }, 10);
      const h = new THREE.Sprite(haloM()); h.scale.set(0.6, 0.6, 1); h.position.set(0.78, 4.47, 0.02); parent.add(h); lampHalos.push(h); lampPools.push(lightPool(g, [3.75 + 0.78, 0.012, z], 2.4, '#ffcf90', 0.17)); };
    walk(g, (o) => o.isGroup && o.userData.lg === 'street' && Math.abs(o.position.x - 3.75) < 1e-6).forEach((lp) => dress(lp, lp.position.z, 0));
    for (const z of [-11, -23]) { const lp = new THREE.Group(); lp.position.set(3.75, 0, z); lp.userData.lg = 'street'; P.add(lp); dress(lp, z, 2); }
  }
  upd((t, fx, L) => { for (const h of lampHalos) { h.material.opacity = 0.3 * L.k; h.material.color.set('#ffd9a0').lerp(cool, 0.6 * L.c); } for (const p of lampPools) { p.material.opacity = 0.17 * L.k; p.material.color.set('#ffcf90').lerp(cool, 0.6 * L.c); } });
  // ---------- the wet road: puddles (soft edge, glossy, no mirror) ----------
  if (O.puddles) { const pm = () => new THREE.MeshStandardMaterial({ color: '#07080e', roughness: 0.1, metalness: 0, envMapIntensity: 0.25, transparent: true, opacity: 0.8, alphaMap: softDisc([[0, '#fff'], [0.6, '#fff'], [1, '#000']]), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    [[5.2, -6.5, 1.5, 0.9, 0.3], [6.6, -10.8, 2.2, 1.1, -0.2], [4.4, -15.5, 1.3, 0.8, 0.1], [7.8, -19.5, 2.6, 1.2, 0.4], [5.5, -26, 2.0, 1.0, -0.3], [8.4, -9, 1.2, 0.7, 0.2]].forEach(([x, z, rx, rz, ry]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), pm()); p.rotation.set(-Math.PI / 2, 0, ry); p.position.set(x, 0.007, z); p.renderOrder = 1; p.castShadow = false; p.receiveShadow = false; P.add(p); }); }

  // ---------- parked scooters (both kerbs) ----------
  [[2.85, -6.7, -0.2, '#2f2f36'], [2.95, -8.7, 0.12, '#d9d3c4'], [3.0, -12.4, -0.1, '#a8322f'], [2.9, -14.6, 0.18, '#2a5aa8'], [10.3, -6.4, Math.PI + 0.1, '#2f2f36'], [10.35, -7.5, Math.PI - 0.1, '#a8322f'], [10.3, -13.0, Math.PI + 0.05, '#d9d3c4'], [10.4, -20, Math.PI, '#2a5aa8']].forEach(([x, z, ry, col]) => { const b = makeBike(col, 0); b.position.set(x, 0, z); b.rotation.y = ry; b.traverse((o) => { if (o.isMesh) o.castShadow = x < 5; }); P.add(b); });

  // ---------- the traffic: one big event at a time, all on the FAR half of the street (lanes x 8.7 .. 9.7, the far kerb is x 10.7); ONE shared point light follows whichever vehicle is passing ----------
  // (the light is a child of the scene, not of the stall group: the stall's cold / blackout / steadyLights code that walks the group and rewrites every point light must not freeze it; under steadyLights it is skipped, and the moving pools with it)
  if (O.traffic) {
    const car = buildCar(), mkS = (col, hc, jk, pax) => buildScooter(col, hc, jk, pax);
    const EV = [{ k: 'A', o: mkS('#2a5aa8', '#d6303f', '#2a2f3a'), t0: 0.5, dur: 5.4, lane: 9.6, dir: -1 }, { k: 'car', o: car, t0: 8, dur: 7.0, lane: 8.7, dir: 1, car: true }, { k: 'B', o: mkS('#8a2a2a', '#e8c84a', '#3a2a2a', { jacket: '#5e5546', helmet: '#c8c0a8' }), t0: 17, dur: 5.4, lane: 9.0, dir: 1 }, { k: 'C', o: mkS('#2f2f36', '#3a8ad6', '#202630'), t0: 25, dur: 5.4, lane: 9.7, dir: -1 }];
    for (const e of EV) { e.o.visible = false; e.o.userData.lg = 'veh'; P.add(e.o); }
    const vl = steadyLights ? { position: { set() {} }, color: { set() {} }, intensity: 0 } : new THREE.PointLight('#ffe6bd', 0, 15, 2);
    if (!steadyLights) { vl.userData.lg = 'veh'; (scene || P).add(vl); }
    const headPool = lightPool(g, [0, 0.014, 0], 1, '#ffe9c4', 0), tailPool = lightPool(g, [0, 0.014, 0], 1, '#ff3a2a', 0);
    upd((t, fx) => {
      const tc = ((t % CYCLE) + CYCLE) % CYCLE, calm = Math.max(abandoned || 0, fx.abandon || 0) >= 0.5; let any = false;
      for (const e of EV) { const u = (tc - e.t0) / e.dur, on = !calm && u >= 0 && u < 1; e.o.visible = on; if (!on) continue; any = true;
        const z = e.dir > 0 ? lerp(-40, 2, u) : lerp(2, -40, u), farEnd = e.dir > 0 ? u : 1 - u, ed = smooth(farEnd / 0.07), ramp = smooth((-z - 3) / 6) * ed;
        e.o.position.set(e.lane, 0, z); e.o.rotation.y = e.dir > 0 ? 0 : Math.PI; e.o.scale.setScalar(Math.max(0.001, ed));
        if (steadyLights) continue;
        const front = e.dir > 0, sx = front ? 1.4 : -1.2;   // the light sits ahead of a vehicle coming at us, behind one going away (its tail light)
        vl.position.set(e.lane, 0.8, z + sx); vl.color.set(front ? '#ffe6bd' : '#ff4a38'); vl.intensity = (front ? (e.car ? 34 : 18) : 5) * ramp;
        headPool.position.set(e.lane, 0.014, z + (front ? 4.2 : -4)); headPool.scale.set(e.car ? 1.5 : 0.9, 4.2, 1); headPool.material.color.set(front ? '#ffe9c4' : '#ff3a2a'); headPool.material.opacity = (front ? (e.car ? 0.2 : 0.13) : 0.07) * ramp; tailPool.material.opacity = 0; }
      if (!any || steadyLights) { vl.intensity = 0; headPool.material.opacity = 0; tailPool.material.opacity = 0; } });
  }
  // ---------- the walker on the far kerb (1.15 m/s; enters a doorway at the end, turning to it) ----------
  if (O.walker) {
    const wk = buildWalker(), W = wk.group; P.add(W); W.visible = false;
    upd((t, fx) => { const ph = (((t + 12) % CYCLE) + CYCLE) % CYCLE, on = ph < 28 && !(Math.max(abandoned || 0, fx.abandon || 0) >= 0.5); W.visible = on; if (!on) return;
      const z = -40 + 1.15 * ph, door = smooth((ph - 25.6) / 1.6), g0 = ph * 5.0;
      W.position.set(lerp(10.95, 11.6, door), 0.015 * Math.abs(Math.cos(g0)), z); W.rotation.y = lerp(0, Math.PI / 2, door * 0.9); W.scale.setScalar(1 - 0.25 * door * door); wk.pose(g0); });
  }
  // ---------- two drifting leaves and dust specks near the lamps ----------
  if (O.specks) {
    const leafM = std('#8c6a2b', { roughness: 0.8, side: THREE.DoubleSide, emissive: '#2a1e08', emissiveIntensity: 0.6 }), leaves = [[2.6, -4.2, 13, 0], [4.9, -16.2, 17, 6]].map(([x, z, per, off]) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.05, 7), leafM); m.scale.set(1, 1.7, 1); m.castShadow = false; P.add(m); return { m, x, z, per, off }; });
    const lampXZ = [[4.53, -5], [4.53, -17], [4.53, -29]], N = 26, pos = new Float32Array(lampXZ.length * N * 3), col = new Float32Array(lampXZ.length * N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.014, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    pts.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pts.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); pts.frustumCulled = false; P.add(pts);
    upd((t, fx, LC) => { for (const L of leaves) { const u = (((t + L.off) / L.per) % 1 + 1) % 1, a = smooth(u / 0.08) * smooth((1 - u) / 0.08); L.m.visible = a > 0.01; L.m.scale.set(a, a * 1.7, 1); L.m.position.set(L.x + 0.9 * Math.sin(u * 9 + L.off) + u * 0.8, 4.0 - 3.95 * u * (0.7 + 0.3 * u), L.z + 0.5 * Math.cos(u * 7)); L.m.rotation.set(t * 1.3, t * 0.9 + L.off, t * 0.7); }
      lampXZ.forEach(([lx, lz], li) => { for (let i = 0; i < N; i++) { const k = (li * N + i) * 3, a = hash(i * 3.7 + li) * 6.28 + t * (0.12 + 0.2 * hash(i)) * (hash(i * 2) > 0.5 ? 1 : -1), r = 0.3 + 0.9 * hash(i * 5.3 + li), y = 4.3 - 2.6 * hash(i * 7.9 + li) + 0.18 * Math.sin(t * 0.8 + i);
          pos[k] = lx + Math.cos(a) * r; pos[k + 1] = y; pos[k + 2] = lz + Math.sin(a) * r * 0.8; const tw = steadyLights ? 0.6 : 0.35 + 0.65 * Math.max(0, Math.sin(t * (1.5 + hash(i) * 2) + i * 2.1)) ** 2; col[k] = 1 * tw; col[k + 1] = 0.85 * tw; col[k + 2] = 0.6 * tw; } });
      pts.material.opacity = 0.8 * LC.k;
      pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.color.needsUpdate = true; });
  }
  return { update: (t, fx) => { const L = lightCtl(t, fx, { cold, steadyLights }); for (const f of U) f(t, fx, L); }, stats };
}
