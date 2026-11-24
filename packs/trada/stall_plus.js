// Trà đá stall `plus` (opt-in: setOpts: { plus: true } or { plus: { ...knobs } }, 21/11). A richer, livelier background for the same set; with the option off stall.js is untouched
// (nothing here runs). The seats, table, stools, glasses and everything the characters touch are never moved. No fog / haze / light shafts, no mirror reflections.
//   1. surfaces: Poly Haven normal + roughness maps under the set's own colours (wall plaster + dado, pavement, wet asphalt), tiled at real-world scale, mipmapped, anisotropic
//   2. things: kettle, thermoses, potted plant, roller shutter, parked scooters (stall_plus.js); building fronts, lamp posts, puddles, traffic (stall_plus_street.js)
//   3. life, all pure functions of t: kettle steam, moths round the bulb, bulb swing with its light, bunting / string lights / plant in a light breeze, neon that stutters,
//      a TV that changes colour in a far window, scooters + a car with sweeping lights, a walker on the far kerb, drifting leaves and dust near the lamps
// Knobs (all optional): fog 0.3 (multiplies the scene fog density; 1 = as before, 0 = none), surfaces, props, life, street, facades, lamps, puddles, traffic, walker, tv, specks (booleans, default true),
//   wetRough 0.4 (asphalt gloss, lower = wetter), normal 1 (normal map strength), breeze 1 (sway strength), maxPix (cap).  Add `import '../packs/trada/stall_plus_preload.js'` to the episode (see that file).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash, lerp, smooth, noise1, canvasTex, std, emis, mesh, box, cyl, ball, lathe } from '../../core/util.js';
import { smokeColumn, makeBike } from './street.js';
import { breeze, walk, isPlane, detailTex, texStats, texBytes, triCount } from './stall_plus_lib.js';
import { buildStreetPlus } from './stall_plus_street.js';
import './stall_plus_preload.js';   // top-level await: decodes the detail maps before anything that imports this file (the stall set) is built, so no episode has to import it by hand

export function buildStallPlus(ctx) {
  const { g, scene, practicals, blades, bulbCable, bulbShade, keyBulb, bulbLight, cone, ket, stove, pot, movers, CX, block, steadyLights, abandoned, cold } = ctx;
  const O = { fog: 0.3, surfaces: true, props: true, life: true, street: true, wetRough: 0.4, normal: 1, breeze: 1, ...ctx.opts }, P = new THREE.Group(); P.name = 'stall_plus'; g.add(P);
  const U = [], stats = { texMB: 0 };
  texStats.n = 0;

  // ================= 1. surfaces =================
  if (O.surfaces) {
    const N = O.normal, set = (m, nor, rough, s, w, h, roughK, ns) => { m.normalMap = detailTex(nor, w / s, h / s); m.normalScale.set(ns * N, ns * N); if (rough) m.roughnessMap = detailTex(rough, w / s, h / s); if (roughK) m.roughness = roughK; m.needsUpdate = true; stats.texMB += 2 * texBytes(1024, 1024) / 1048576; };
    const pave = walk(g, (m) => isPlane(m, 26, 60, -9.6))[0], road = walk(g, (m) => isPlane(m, 7.2, 60, 7.1))[0], wall = walk(g, (m) => isPlane(m, CX + 5.2, 4.4))[0];
    if (pave) { set(pave.material, 'floor_nor', 'floor_rough', 1.4, 26, 60, 1.0, 0.9); pave.material.envMapIntensity = 1.0; }
    if (road) { set(road.material, 'road_nor', 'road_rough', 1.6, 7.2, 60, O.wetRough, 1.0); road.material.envMapIntensity = 0.6; road.material.color.set('#15161d'); }   // wet, but lit by the lamps through roughness, not by a mirror
    if (wall) { set(wall.material, 'wall_nor', 'wall_rough', 1.4, CX + 5.2, 4.4, 0.95, 0.2); wall.material.color.multiplyScalar(1.08); }   // the maps and the missing light cone take about 7 % off the wall: give it back, so the orange stays the channel's orange
  }

  // ================= 2. things =================
  if (O.props) {
    // ---- the kettle: an aluminium Hanoi kettle with a sooty belly, a curved spout, a lid knob and a bail handle (replaces the little dark one) ----
    ket.visible = false;
    const kg = new THREE.Group(); kg.position.set(stove.position.x, 0.272, stove.position.z); kg.scale.setScalar(0.85); P.add(kg);
    const al = new THREE.MeshStandardMaterial({ color: '#b9bfc7', roughness: 0.36, metalness: 0.65, emissive: '#2a0d04', emissiveIntensity: 0.4 }), soot = std('#2b2622', { roughness: 0.85 }), blk = std('#1c1a1a', { roughness: 0.5 });
    lathe([[0.001, 0], [0.125, 0], [0.145, 0.015], [0.16, 0.06], [0.165, 0.11], [0.152, 0.17], [0.118, 0.21], [0.088, 0.235], [0.078, 0.25]], al, [0, 0, 0], kg, {}, 32);
    lathe([[0.001, -0.001], [0.127, -0.001], [0.147, 0.015], [0.159, 0.05], [0.158, 0.075]], soot, [0, 0, 0], kg, { cast: false }, 32);
    lathe([[0.078, 0.25], [0.084, 0.256], [0.062, 0.274], [0.022, 0.284], [0.001, 0.286]], al, [0, 0, 0], kg, {}, 24); ball(0.019, blk, [0, 0.295, 0], kg, {}, 10);
    const sp = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.13, 0.07, 0), new THREE.Vector3(-0.2, 0.1, 0), new THREE.Vector3(-0.255, 0.17, 0), new THREE.Vector3(-0.29, 0.245, 0)]);
    mesh(new THREE.TubeGeometry(sp, 14, 0.019, 8), al, [0, 0, 0], kg, {}); mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), al, [-0.29, 0.245, 0], kg, { rot: [0.5, 1.2, 0] });
    mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 28, Math.PI), blk, [0, 0.2, 0], kg, {}); cyl(0.014, 0.014, 0.1, std('#3a2a1e', { roughness: 0.7 }), [0, 0.352, 0], kg, { rot: [0, 0, Math.PI / 2] }, 10);
    for (const s of [-1, 1]) box(0.022, 0.03, 0.022, blk, [s * 0.155, 0.2, 0], kg);
    const steam = smokeColumn(g, { pos: [stove.position.x - 0.29 * 0.85, 0.272 + 0.245 * 0.85 + 0.02, stove.position.z], n: 14, h: 0.9, w: 0.15, color: '#f2f6ff', op: 0.38, period: 3.6, seed: 5, drift: [0.7, 0.1] });   // round 2: bigger, taller and drifting INTO the frame (it stood at the left edge and drifted out of it)
    U.push((t) => steam.update(t, 0.75 + 0.25 * Math.max(0, Math.sin(t * 0.7) * 0.6 + noise1(t * 0.5, 9) * 0.5 + 0.3)));

    // ---- thermoses on the shelf: flowered Hanoi thermoses (replace the two plain cylinders, same places) ----
    walk(g, (m) => m.isMesh && m.parent === g && m.geometry.type === 'CylinderGeometry' && Math.abs(m.position.z + 1.36) < 1e-3 && (Math.abs(m.position.x + 1.18) < 1e-3 || Math.abs(m.position.x + 1.0) < 1e-3) && (m.geometry.parameters.height === 0.26 || m.geometry.parameters.height === 0.05)).forEach((m) => { m.visible = false; });
    const flower = (col) => canvasTex(256, 128, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { const x = 14 + i * 28 + hash(i) * 8, y = 25 + (i % 3) * 36 + hash(i + 3) * 10; c.fillStyle = '#2f7a45'; c.beginPath(); c.ellipse(x + 11, y + 6, 10, 4, 0.6, 0, 7); c.fill(); c.fillStyle = i % 2 ? '#f6c2d0' : '#fff2c8'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + Math.cos(k * 1.26) * 7, y + Math.sin(k * 1.26) * 7, 6, 0, 7); c.fill(); } c.fillStyle = '#e8a030'; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); } });
    [[-1.18, '#c93a34'], [-1.0, '#2f7a5a']].forEach(([x, col]) => { const th = new THREE.Group(); th.position.set(x, 1.6375, -1.36); P.add(th);
      lathe([[0.001, 0], [0.05, 0], [0.062, 0.012], [0.065, 0.04], [0.065, 0.205], [0.058, 0.237], [0.044, 0.257], [0.001, 0.257]], new THREE.MeshStandardMaterial({ map: flower(col), roughness: 0.28, metalness: 0.15 }), [0, 0, 0], th, {}, 24);
      cyl(0.045, 0.047, 0.05, std('#e8e2d0', { roughness: 0.4 }), [0, 0.282, 0], th, {}, 16); cyl(0.036, 0.036, 0.012, std('#cfc8b4', { roughness: 0.4 }), [0, 0.313, 0], th, {}, 14);
      mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 14, Math.PI), std('#2a2a2e', { roughness: 0.5 }), [0.064, 0.15, 0], th, { rot: [0, 0, -Math.PI / 2] }); cyl(0.067, 0.067, 0.014, std('#d8d2c0', { roughness: 0.4 }), [0, 0.014, 0], th, {}, 18); });

    // ---- the potted plant: 18 curved leaves on a clay pot (replaces the green spikes) ----
    pot.visible = false;
    const pg = new THREE.Group(); pg.position.copy(pot.position); P.add(pg);
    lathe([[0.001, 0], [0.11, 0], [0.15, 0.02], [0.175, 0.29], [0.19, 0.3], [0.19, 0.325], [0.165, 0.33], [0.165, 0.29], [0.001, 0.285]], std('#9a4a2e', { roughness: 0.85, side: THREE.DoubleSide }), [0, 0, 0], pg, {}, 20);
    cyl(0.16, 0.16, 0.01, std('#2a1e16', { roughness: 1 }), [0, 0.31, 0], pg, { cast: false }, 16);
    const leafGeo = (() => { const sx = 4, sy = 7, pos = [], idx = []; for (let j = 0; j <= sy; j++) for (let i = 0; i <= sx; i++) { const v = j / sy, u = i / sx - 0.5, w = 0.5 * Math.pow(Math.sin(Math.PI * (0.06 + v * 0.88)), 0.8); pos.push(u * 2 * w * 0.1, v * 0.42, 0.25 * v * v * 0.42 - Math.abs(u) * w * 0.05); } for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) { const a = j * (sx + 1) + i; idx.push(a, a + 1, a + sx + 1, a + 1, a + sx + 2, a + sx + 1); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo; })();
    const greens = ['#2f7a3f', '#3f9a4f', '#58a84a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.08 }));
    const leaves = []; for (let i = 0; i < 18; i++) { const lg = new THREE.Group(); lg.rotation.order = 'YXZ'; lg.position.set(0, 0.31, 0); const sc = 0.65 + hash(i * 2.7) * 0.75; const m = new THREE.Mesh(leafGeo, greens[i % 3]); m.scale.set(sc, sc, sc); m.castShadow = true; lg.add(m); pg.add(lg); leaves.push({ lg, yaw: i * 2.4, pitch: 0.18 + 0.7 * hash(i * 1.9) * (i < 6 ? 0.5 : 1), ph: hash(i * 3.3) * 6.28 }); }
    U.push((t) => { const B = breeze(t) * O.breeze; for (const L of leaves) { L.lg.rotation.set(L.pitch + 0.07 * B * Math.sin(t * 1.7 + L.ph) + 0.02 * Math.sin(t * 0.8 + L.ph), L.yaw, 0.08 * B * Math.sin(t * 1.3 + L.ph * 1.7)); } });

    // ---- the roller shutter: 34 ribbed slats (one merged mesh), guide rails, a bottom bar with a handle and a padlock ----
    walk(g, (m) => m.isMesh && m.geometry.type === 'BoxGeometry' && m.geometry.parameters.width === 1.5 && m.geometry.parameters.height === 2.5).forEach((m) => { m.visible = false; });
    { const geos = [], c = new THREE.Color(); for (let k = 0; k < 34; k++) { const gc = new THREE.CylinderGeometry(0.034, 0.034, 1.46, 8, 1); gc.rotateZ(Math.PI / 2); gc.translate(-3.15, 0.08 + k * 0.0715, -1.405); const n = gc.attributes.position.count, col = new Float32Array(n * 3); c.set('#8fa3b6').multiplyScalar((0.7 + 0.3 * hash(k * 1.7)) * (0.55 + 0.45 * Math.min(1, k / 12) * (1 - 0.25 * Math.max(0, (k - 28) / 6)))); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } gc.setAttribute('color', new THREE.BufferAttribute(col, 3)); geos.push(gc); }
      const sm = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 })); sm.castShadow = false; P.add(sm);
      for (const s of [-1, 1]) box(0.07, 2.55, 0.1, std('#56606c', { roughness: 0.6, metalness: 0.5 }), [-3.15 + s * 0.77, 1.27, -1.42], P, { cast: false });
      box(1.5, 0.07, 0.08, std('#3f4854', { roughness: 0.6, metalness: 0.5 }), [-3.15, 0.04, -1.38], P, { cast: false }); ball(0.025, std('#9aa0a8', { metalness: 0.8, roughness: 0.3 }), [-3.15, 0.06, -1.33], P, { cast: false }, 8); box(0.05, 0.07, 0.03, std('#c8a030', { metalness: 0.7, roughness: 0.35 }), [-2.6, 0.1, -1.33], P, { cast: false }); }
  }

  // ================= 3. the street half (fronts, lamps, road, traffic, walker, TV, leaves, specks) =================
  const sp = O.street ? buildStreetPlus({ g, scene, P, opts: O, block, abandoned, steadyLights, cold }) : null; if (sp) { U.push((t, fx) => sp.update(t, fx)); stats.texMB += sp.stats.texBytes / 1048576; }
  // the abandoned look (fx.abandon) has no traffic: the old movers stay hidden always under plus (the plus traffic has its own, one big event at a time)
  const oldMovers = () => movers.forEach((m) => { m.visible = false; });

  // ================= life on the set's own pieces =================
  const bunting = walk(g, (m) => m.isMesh && m.userData.noOutline && m.geometry.attributes.position.count === 3);
  const wires = walk(g, (m) => m.isMesh && m.parent === g && m.geometry.type === 'TubeGeometry' && m.geometry.parameters.radius === 0.006);
  const wireBase = wires.map((w) => w.geometry.attributes.position.array.slice()), runs = [{ x0: -4.6, x1: CX - 0.1 }, { x0: -4.7, x1: 1.35 }], strBulbs = practicals.filter((b) => b.userData.lg === 'S');
  wires.forEach((w) => { w.frustumCulled = false; }); const bulbBase = strBulbs.map((b) => b.position.clone());
  // the hanging bulb: cable, shade, bulb and its light swing together about the point where the cable leaves the ceiling
  const piv = new THREE.Group(); piv.position.set(-0.25, 3.0, 0.35); g.add(piv); g.updateMatrixWorld(true); [bulbCable, bulbShade, keyBulb, bulbLight].forEach((o) => piv.attach(o));
  if (O.life) {
    cone.visible = false;   // no light shaft
    // moths: three round the hanging bulb, well above the heads (y > 1.9)
    // round 2: four moths, bigger (wings 4 cm) and brighter (they glow cream, so they read as small lit flecks): two circle the bulb tightly, two wander wider over the table (y stays above 1.95, never lower than the heads).
    // They carry an emissive material, so the stall's own blackout / lampR rules fade them with the bulb.
    const mothM = new THREE.MeshStandardMaterial({ color: '#5a5240', emissive: '#f4e6bc', emissiveIntensity: 1.0, roughness: 0.9, side: THREE.DoubleSide }), wg = new THREE.PlaneGeometry(0.042, 0.03);
    const moths = [0, 1, 2, 3].map((i) => { const m = new THREE.Group(), wl = new THREE.Mesh(wg, mothM), wr = new THREE.Mesh(wg, mothM); wl.position.x = -0.024; wr.position.x = 0.024; wl.castShadow = wr.castShadow = false; const pl = new THREE.Group(), pr = new THREE.Group(); pl.add(wl); pr.add(wr); m.add(pl, pr);
      mesh(new THREE.CapsuleGeometry(0.007, 0.035, 2, 4), mothM, [0, 0, 0], m, { cast: false, rot: [Math.PI / 2, 0, 0] }); g.add(m); return { m, pl, pr, i }; });
    const mothPos = (t, i, out) => { if (i < 2) { const w = 1.6 + 0.5 * i, a = t * w + 0.7 * Math.sin(t * 0.7 + i * 2) + i * 2.1, r = 0.2 + 0.1 * noise1(t * 0.6 + i * 5, 2) + 0.06 * i; return out.set(-0.25 + Math.cos(a) * r, 2.14 + 0.13 * Math.sin(t * 2.1 + i * 1.7) + 0.06 * i, 0.35 + Math.sin(a) * r * 0.8); }
      return out.set(-0.25 + 0.6 * Math.sin(t * 0.45 + i * 1.9) + 0.2 * Math.sin(t * 1.3 + i), 2.14 + 0.13 * Math.sin(t * 0.8 + i * 2) + 0.08 * Math.sin(t * 2.3 + i), 0.3 + 0.28 * Math.sin(t * 0.6 + i * 3)); };
    const mp = new THREE.Vector3(), mq = new THREE.Vector3();
    U.push((t) => { moths.forEach(({ m, pl, pr, i }) => { mothPos(t, i, mp); mothPos(t + 0.03, i, mq); m.position.copy(mp); m.rotation.y = Math.atan2(mq.x - mp.x, mq.z - mp.z) + Math.PI; const f = 0.15 + 1.1 * Math.abs(Math.sin(t * 30 + i * 1.7)); pl.rotation.z = f; pr.rotation.z = -f; m.scale.setScalar(0.9 + 0.1 * Math.sin(t * 3 + i)); }); });
    // neon: the two blade signs stutter now and then (a short burst of dips, a different pattern each), the lamp light with them
    const SEQ = [0.15, 1, 0.08, 0.7, 0.05, 1, 0.3, 1, 0.1, 0.9], neon = (t, per, seed) => { const c = Math.floor(t / per), dt = t - c * per - (0.2 + 0.6 * hash(c * 7.3 + seed)) * per; return dt > 0 && dt < 0.45 ? SEQ[Math.floor(dt * 22) % SEQ.length] : 1; };
    blades.forEach((b, i) => { b.base = b.m.children.map((p) => p.material.emissiveIntensity); b.l0 = b.l.intensity; });
    U.push((t, fx) => { blades.forEach((b, i) => { const k = steadyLights ? 1 : neon(t, [11.3, 17.9][i] || 13, i * 3.1 + 1); b.m.children.forEach((p, j) => { p.material.emissiveIntensity = b.base[j] * k; }); b.l.intensity = b.l0 * (0.25 + 0.75 * k); }); });
    // breeze: bunting, string lights and the hanging bulb
    bunting.forEach((f) => { f.userData.rz0 ??= f.rotation.z; });
    U.push((t) => { const B = breeze(t) * O.breeze, BL = steadyLights ? 0 : B;   // steadyLights: the string lights and the hanging bulb (a moving light) hold still; bunting and plant still move
      for (const f of bunting) { const x = f.position.x; f.rotation.z = f.userData.rz0 + 0.13 * B * Math.sin(t * 1.7 + x * 1.9); f.rotation.x = 0.2 * B * Math.sin(t * 1.35 + x * 2.3 + 1); }
      wires.forEach((w, wi) => { const p = w.geometry.attributes.position, b = wireBase[wi], R = runs[wi] || runs[0], len = R.x1 - R.x0; for (let i = 0; i < p.count; i++) { const x = b[i * 3], u = Math.min(1, Math.max(0, (x - R.x0) / len)), wgt = Math.sin(Math.PI * u); p.array[i * 3 + 1] = b[i * 3 + 1] + 0.012 * BL * wgt * Math.sin(t * 1.9 + x * 1.3); p.array[i * 3 + 2] = b[i * 3 + 2] + 0.035 * BL * wgt * Math.sin(t * 1.4 + x * 1.1); } p.needsUpdate = true; });
      strBulbs.forEach((b, i) => { const bb = bulbBase[i], R = Math.abs(bb.z - 1.38) < 0.2 ? runs[1] : runs[0], u = Math.min(1, Math.max(0, (bb.x - R.x0) / (R.x1 - R.x0))), wgt = Math.sin(Math.PI * u); b.position.set(bb.x, bb.y + 0.012 * BL * wgt * Math.sin(t * 1.9 + bb.x * 1.3), bb.z + 0.035 * BL * wgt * Math.sin(t * 1.4 + bb.x * 1.1)); });
      if (!steadyLights) piv.rotation.set(0.04 * B * Math.sin(t * 1.25 + 0.4) + 0.012 * Math.sin(t * 3.1), 0, 0.045 * B * Math.sin(t * 1.05) + 0.012 * Math.sin(t * 2.7 + 1)); });
  }

  // ================= per frame =================
  const fog0 = { k: null };
  P.traverse((o) => { if (o.isMesh) o.frustumCulled = o.frustumCulled; });
  return {
    P, stats, texCount: () => texStats.n, tris: () => triCount(P),
    update(t, fx = {}) {
      oldMovers();
      if (scene.fog) { fog0.k ??= scene.fog.density; scene.fog.density = fog0.k * O.fog; }   // the fog is part of the haze the owner dropped: keep a little for depth, not a veil
      for (const f of U) f(t, fx);
    },
  };
}
