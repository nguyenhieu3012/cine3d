// Trà đá với AI, "Tèo vào GTA 6" part 2 NEW (gta6p2b "Tèo cướp xe xịn?", 20/11): the two new PLACES of the composite set `gta` (registered in gta_world.js, origins x +2400 / +2800; built only when asked).
//   gym   = the P1/P2/P3 beach road (`buildGtaRoad` again, like `sea`) + on its promenade, a stand-alone 24 h gym "GYM 24H" (a pastel box, neon sign, awning, a big lit window and a NARROW door a pumped Tèo must squeeze through
//           sideways) with a REAL interior (rubber floor, mirror wall, dumbbell rack, bench + barbell, pull-up bar, leg machine, neon strips) + the SILVER convertible parked at the sea-side kerb in front of it
//           (tarp, mud plate, palm leaf, seat recline) + a seagull + the thrown jacket.
//   lair  = a dark room: a big TRACKER screen (dark map, a red dot moving, rings pulsing in step with the fob LED), a desk, a chair. The shadow figure (cast `bongden`) is put there with `stands`.
// Coordinates: every number here is place-local metres (the composite adds the origin). The gym building: origin (GX, 0, GZ) = (-13, 0, -26.5); +x (local) faces the road; the door is at local z +2.4; interior x -3.6..3.6, z -4.3..4.3, ceiling 3.4.
// setOpts.gym = { jacket: { t0, t1, from: [x, y, z], to: [x, y, z] } (place-local, the thrown jacket's arc), gull: { t0, t1 } (the seagull's whole visit), silver: { at: [x, z], yaw } }
// fx on 'set': svrecline svtarp svdrv svpass (the silver car: buildSilverCar), gdoor 0..1 (the gym door leaf: 0 = open flat against the wall (default), 1 = shut), + every car fx.
import * as THREE from 'three';
import { LIGHT_PRESETS } from '../../core/stage.js';
import { clamp, lerp, smooth, hash, noise1, canvasTex, grain, std, mesh, box, cyl, ball, V } from '../../core/util.js';
import { neonText, FONT, addMat, mergeList, xf } from './gta_bank.js';
import { buildGtaRoad } from './gta_world.js';   // (a module cycle: only used at call time)
import { buildSilverCar, ledWave, makeBread } from './gta_p2b_props.js';

Object.assign(LIGHT_PRESETS, {
  gta_lair: { hemi: ['#16284a', '#05060c', 0.22], key: ['#7fb8ff', 16, [1.4, 2.2, 3.2]], rim: ['#34e8ff', 70, [0.2, 2.0, -2.8]], kick: ['#ff3a4a', 12, [-2.0, 1.2, 1.6]], fog: ['#05060e', 0.02] },
  gta_gym: { hemi: ['#d89ae0', '#403060', 0.62], key: ['#ffc8a0', 48, [-1.4, 2.4, 2.2]], rim: ['#ff5fb8', 70, [2.0, 2.2, -1.6]], kick: ['#45dce6', 26, [-2.2, 1.7, -1.1]], fog: ['#7a3a6a', 0.0045] },
});
const PINK = '#ff4fb8', CYAN = '#34e8ff', AMBER = '#ffb040';
const GYM_LOOK = { exposure: 0.92, bloom: [0.3, 0.55, 1.0], env: 0.14, grade: { contrast: 1.12, sat: 1.12, vig: 0.34, grain: 0.014, shadowTint: [0.0, 0.01, 0.04], hiTint: [0.05, 0.014, 0.0] } };
const LAIR_LOOK = { exposure: 0.85, bloom: [0.5, 0.6, 0.78], env: 0.02, grade: { contrast: 1.2, sat: 1.05, vig: 0.5, grain: 0.02, shadowTint: [0.0, 0.01, 0.05], hiTint: [0.0, 0.03, 0.06] } };
export const GYM = { GX: -13, GZ: -26.5, DOOR_Z: 2.4, SILVER_AT: [-6.3, -21.2], SILVER_YAW: 0 };

// ---------------------------------------------------------------------------------------------------------------------------------
// THE GYM
// ---------------------------------------------------------------------------------------------------------------------------------
export function buildGtaGym(scene, { at = [0, 0, 0], silver = {}, jacket = null, gull = null } = {}) {
  const R = buildGtaRoad(scene, { at }), g = R.group; g.name = 'gta_gym';
  const E = new THREE.Group(); E.name = 'gym_extras'; g.add(E);
  const GX = GYM.GX, GZ = GYM.GZ, B = new THREE.Group(); B.position.set(GX, 0, GZ); E.add(B);   // building frame: +x faces the road, +z along it
  const WX = 3.6, WZ = 4.3, WH = 3.4, TH = 0.3;
  const teal = std('#2ab8c8', { roughness: 0.8 }), plum = std('#5a3a8a', { roughness: 0.9 }), wallI = std('#f3c6e0', { roughness: 0.95 }), rubber = std('#2b2536', { roughness: 0.7 });
  const NW = (cast = false) => ({ cast, recv: true });
  // ---- floor, ceiling, walls ----
  const floorT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#2b2536'; c.fillRect(0, 0, w, h); grain(c, w, h, 5000, 0.08, 4, 2); c.fillStyle = '#34e8ff'; c.globalAlpha = 0.5; c.fillRect(0, 252, w, 8); c.globalAlpha = 1; }, { repeat: [3, 3] });
  mesh(new THREE.PlaneGeometry(WX * 2, WZ * 2), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.55 }), [0, 0.036, 0], B, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  box(WX * 2 + 0.4, 0.06, WZ * 2 + 0.4, std('#8a7aa0'), [0, 0.0, 0], B, { cast: false });
  box(WX * 2 + 0.6, 0.2, WZ * 2 + 0.6, std('#5a3a8a'), [0, WH + 0.1, 0], B, { cast: false });   // roof slab (its underside is the ceiling)
  mesh(new THREE.PlaneGeometry(WX * 2, WZ * 2), std('#e6b8d8', { roughness: 1 }), [0, WH - 0.012, 0], B, { cast: false, recv: false, rot: [Math.PI / 2, 0, 0] });
  // back wall (x -3.6) with the MIRROR, side walls (z +-4.3), front wall (x +3.6) with the door and the window
  box(TH, WH, WZ * 2 + TH, wallI, [-WX - TH / 2, WH / 2, 0], B, NW());
  for (const s of [-1, 1]) box(WX * 2 + TH, WH, TH, wallI, [0, WH / 2, s * (WZ + TH / 2)], B, NW());
  // the mirror: a long glossy panel on the back wall, a cyan-white sheen, a thin chrome frame
  const mirT = canvasTex(512, 256, (c, w, h) => { const g2 = c.createLinearGradient(0, 0, w, h); g2.addColorStop(0, '#9fd8f0'); g2.addColorStop(0.5, '#5a7ab0'); g2.addColorStop(1, '#8fc4e8'); c.fillStyle = g2; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(90, 0); c.lineTo(190, 0); c.lineTo(100, h); c.lineTo(0, h); c.closePath(); c.fill(); c.beginPath(); c.moveTo(300, 0); c.lineTo(340, 0); c.lineTo(250, h); c.lineTo(210, h); c.closePath(); c.fill(); });
  mesh(new THREE.PlaneGeometry(WZ * 1.7, 2.1), new THREE.MeshStandardMaterial({ map: mirT, roughness: 0.04, metalness: 0.6, emissive: '#7aa8d8', emissiveMap: mirT, emissiveIntensity: 0.35 }), [-WX + 0.012, 1.55, 0], B, { cast: false, rot: [0, Math.PI / 2, 0] });
  const chrome = new THREE.MeshStandardMaterial({ color: '#dfe3ea', roughness: 0.25, metalness: 0.85 });
  box(0.04, 0.05, WZ * 1.7 + 0.1, chrome, [-WX + 0.02, 2.62, 0], B, { cast: false }); box(0.04, 0.05, WZ * 1.7 + 0.1, chrome, [-WX + 0.02, 0.46, 0], B, { cast: false });
  // the front wall: left of the door a big window, right of the door a plain strip. Door opening z local 2.4 +- 0.42 (0.84 wide: a pumped Tèo goes through sideways), 2.2 high
  const DZ = GYM.DOOR_Z, DW = 0.46, WIN = [-3.3, 1.5];   // window z range
  const frontMat = teal, fz = WX + TH / 2;
  box(TH, 0.95, (DZ - DW) + WZ, frontMat, [fz, 0.475, (-WZ + DZ - DW) / 2], B, NW()); box(TH, 0.95, WZ - (DZ + DW), frontMat, [fz, 0.475, (DZ + DW + WZ) / 2], B, NW()); box(TH, WH - 2.85, WZ * 2 + TH, frontMat, [fz, 2.85 + (WH - 2.85) / 2, 0], B, NW());           // below / above the window band (band y 0.95 .. 2.85)
  box(TH, 1.9, (WIN[0] + WZ) + 0.0, frontMat, [fz, 1.9, (WIN[0] - WZ) / 2 - 0.0], B, NW());                                                                 // left of the window
  box(TH, 1.9, DZ - DW - WIN[1], frontMat, [fz, 1.9, (WIN[1] + DZ - DW) / 2], B, NW()); box(TH, 1.9, WZ - (DZ + DW), frontMat, [fz, 1.9, (DZ + DW + WZ) / 2], B, NW());   // between window and door / right of the door
  box(TH, 2.85 - 2.2, DW * 2, frontMat, [fz, 2.2 + (2.85 - 2.2) / 2, DZ], B, NW());                                                                       // over the door
  box(TH + 0.02, 0.05, DW * 2 + 0.16, chrome, [fz, 2.22, DZ], B, { cast: false }); for (const s of [-1, 1]) box(TH + 0.02, 2.2, 0.06, chrome, [fz, 1.1, DZ + s * (DW + 0.03)], B, { cast: false });
  // the window: glass with a warm glow, a thin frame
  mesh(new THREE.PlaneGeometry(WIN[1] - WIN[0], 1.9), new THREE.MeshStandardMaterial({ color: '#cfeaff', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.2, depthWrite: false }), [WX + 0.02, 1.9, (WIN[0] + WIN[1]) / 2], B, { cast: false, rot: [0, Math.PI / 2, 0] });
  box(0.05, 0.06, WIN[1] - WIN[0] + 0.1, chrome, [WX + 0.02, 2.87, (WIN[0] + WIN[1]) / 2], B, { cast: false }); box(0.05, 0.06, WIN[1] - WIN[0] + 0.1, chrome, [WX + 0.02, 0.93, (WIN[0] + WIN[1]) / 2], B, { cast: false });
  // the door leaf: a glass leaf in a chrome frame, hinged on the road-side jamb at z DZ + DW; open 100 degrees against the outside wall
  const hinge = new THREE.Group(); B.add(hinge); hinge.position.set(WX + TH, 0.0, DZ - DW); const leaf = new THREE.Group(); hinge.add(leaf);
  mesh(new THREE.PlaneGeometry(DW * 2 - 0.04, 2.1), new THREE.MeshStandardMaterial({ color: '#cfeaff', transparent: true, opacity: 0.22, roughness: 0.04, side: THREE.DoubleSide, depthWrite: false }), [0, 1.08, DW], leaf, { cast: false, rot: [0, 0, 0] }).rotation.y = Math.PI / 2;
  for (const [y, h2] of [[0.05, 0.1], [2.1, 0.08]]) box(0.04, h2, DW * 2, chrome, [0, y, DW], leaf, { cast: false }); for (const z of [0.01, DW * 2 - 0.01]) box(0.04, 2.1, 0.05, chrome, [0, 1.05, z], leaf, { cast: false });
  // sign GYM 24H (a neon plate over the awning), a pink awning, two wall lamps
  const signT = canvasTex(1024, 256, (c, w, h) => { c.fillStyle = '#150f2a'; c.beginPath(); c.roundRect(10, 10, w - 20, h - 20, 40); c.fill(); c.strokeStyle = PINK; c.lineWidth = 9; c.shadowColor = PINK; c.shadowBlur = 22; c.stroke(); c.shadowBlur = 0;
    neonText(c, 'GYM 24H', w / 2 + 70, h / 2 + 4, 150, CYAN, { glow: 0.5, maxW: 700 });
    // a dumbbell icon on the left (neon pink)
    c.save(); c.translate(150, h / 2); c.strokeStyle = PINK; c.shadowColor = PINK; c.shadowBlur = 16; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(-52, 0); c.lineTo(52, 0); c.stroke(); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 52, -34); c.lineTo(s * 52, 34); c.stroke(); c.beginPath(); c.moveTo(s * 72, -22); c.lineTo(s * 72, 22); c.stroke(); } c.restore(); });
  mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshStandardMaterial({ map: signT, emissive: '#ffffff', emissiveMap: signT, emissiveIntensity: 1.6, roughness: 0.6 }), [WX + 0.16, 3.1, -0.4], B, { cast: false, rot: [0, Math.PI / 2, 0] });
  const awn = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, WIN[1] - WIN[0] + 0.5), std('#ff5fa8', { roughness: 0.8 })); awn.position.set(WX + 0.5, 2.95, (WIN[0] + WIN[1]) / 2); awn.rotation.z = -0.28; awn.castShadow = true; B.add(awn);
  for (let i = 0; i < 6; i++) box(0.9, 0.065, 0.28, std('#fff0f6', { roughness: 0.8 }), [WX + 0.5, 2.95, WIN[0] - 0.12 + 0.28 + i * 0.72], B, { cast: false }).rotation.z = -0.28;
  // pavement apron in front of the door so he steps out onto something
  mesh(new THREE.PlaneGeometry(3, 8), std('#a898b4', { roughness: 0.5 }), [WX + 1.5 + 0.4, 0.022, 0], B, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  // ---- interior fittings ----
  const DB = [['#ff4fb8', 0.1], ['#34e8ff', 0.12], ['#ffc43a', 0.14], ['#7a4cff', 0.16]], blackM = std('#1d1a26', { roughness: 0.5 }), steel = new THREE.MeshStandardMaterial({ color: '#cfd3dc', roughness: 0.25, metalness: 0.85 });
  // dumbbell rack on the right wall (z +4.3): two shelves of dumbbells
  { const rk = new THREE.Group(); B.add(rk); rk.position.set(-1.2, 0, WZ - 0.4); box(2.6, 0.06, 0.5, blackM, [0, 0.55, 0], rk); box(2.6, 0.06, 0.5, blackM, [0, 1.05, 0], rk); for (const x of [-1.25, 1.25]) box(0.06, 1.1, 0.5, blackM, [x, 0.55, 0], rk);
    for (const y of [0.62, 1.12]) for (let i = 0; i < 6; i++) { const [col, r] = DB[(i + (y > 1 ? 2 : 0)) % 4], x = -1.0 + i * 0.4; cyl(0.012, 0.012, 0.22, steel, [x, y + 0.04 + 0.0, 0], rk, { cast: false }, 8).rotation.x = Math.PI / 2; for (const s of [-1, 1]) cyl(r * 0.55, r * 0.55, 0.06, std(col, { roughness: 0.4 }), [x, y + 0.04 + r * 0.55, s * 0.1], rk, { cast: false }, 14).rotation.x = Math.PI / 2; } }
  // bench with a barbell on its rack (centre-left)
  { const bn = new THREE.Group(); B.add(bn); bn.position.set(-0.3, 0, -1.6); box(0.45, 0.1, 1.3, std('#c2185b', { roughness: 0.6 }), [0, 0.45, 0], bn); box(0.06, 0.45, 0.06, blackM, [0, 0.22, -0.5], bn); box(0.06, 0.45, 0.06, blackM, [0, 0.22, 0.5], bn);
    for (const z of [-0.5, 0.5]) { box(0.06, 0.9, 0.06, blackM, [0.0, 0.5, z + (z > 0 ? 0.45 : -0.45)], bn, { cast: false }); } cyl(0.014, 0.014, 1.9, steel, [0, 1.05, 0], bn, { cast: false }, 10).rotation.x = Math.PI / 2; for (const s of [-1, 1]) { cyl(0.2, 0.2, 0.05, blackM, [0, 1.05, s * 0.78], bn, {}, 20).rotation.x = Math.PI / 2; cyl(0.14, 0.14, 0.05, std('#ff4fb8'), [0, 1.05, s * 0.84], bn, { cast: false }, 18).rotation.x = Math.PI / 2; } }
  // pull-up bar: two uprights and a bar at 2.15 m (left of the mirror's centre)
  { const pu = new THREE.Group(); B.add(pu); pu.position.set(-2.6, 0, -2.4); for (const z of [-0.55, 0.55]) { box(0.08, 2.45, 0.08, std('#34e8ff', { roughness: 0.4, emissive: '#0c4a52', emissiveIntensity: 0.6 }), [0, 1.22, z], pu); box(0.5, 0.05, 0.08, blackM, [0.18, 0.02, z], pu, { cast: false }); } cyl(0.022, 0.022, 1.2, steel, [0, 2.15, 0], pu, { cast: false }, 10).rotation.x = Math.PI / 2; }
  // the leg machine (the thing he skips): a seat, a sloped rail, a sled with plates, a weight stack; near the door side so a camera can slide past it
  { const lm = new THREE.Group(); B.add(lm); lm.position.set(1.6, 0, 1.3); lm.rotation.y = -Math.PI / 2; const red = std('#ff3a4a', { roughness: 0.5 });
    box(0.7, 0.12, 1.1, std('#7a4cff', { roughness: 0.6 }), [0, 0.45, -0.3], lm); box(0.7, 0.55, 0.12, std('#7a4cff', { roughness: 0.6 }), [0, 0.8, -0.82], lm).rotation.x = -0.3;
    for (const s of [-1, 1]) { const rail = box(0.06, 0.06, 1.7, blackM, [s * 0.34, 0.55, 0.45], lm, { cast: false }); rail.rotation.x = -0.52; } const sled = box(0.78, 0.07, 0.6, red, [0, 0.82, 0.78], lm); sled.rotation.x = -0.52;
    for (let i = 0; i < 4; i++) box(0.5, 0.05, 0.5, i % 2 ? blackM : red, [0, 0.95 + i * 0.06, 0.82 + 0.05 * i], lm, { cast: false }).rotation.x = -0.52;
    box(0.8, 0.06, 0.06, chrome, [0, 0.1, 1.2], lm, { cast: false }); }
  // a kettlebell, two plates leaning on the wall, a water cooler: set dressing at the far right corner
  for (let i = 0; i < 3; i++) cyl(0.3, 0.3, 0.05, i % 2 ? blackM : std('#ff4fb8'), [-3.4 + 0.0, 0.3, -3.4 + i * 0.06 + 0.9], B, { cast: false }, 22).rotation.z = Math.PI / 2 - 0.1;
  // neon strips on the ceiling + wall (emissive tubes) and warm / pink point lights (short range: they do not reach the street)
  for (const [x, z, col] of [[-1.5, -2.4, '#ffffff'], [1.5, -2.4, '#ffe9d8'], [-1.5, 2.4, '#ffffff'], [1.5, 2.4, '#ffe9d8']]) box(0.14, 0.04, 2.4, new THREE.MeshStandardMaterial({ color: '#fff', emissive: col, emissiveIntensity: 3.0 }), [x, WH - 0.04, z], B, { cast: false, recv: false });
  box(0.05, 0.07, WZ * 1.9, new THREE.MeshStandardMaterial({ color: '#000', emissive: PINK, emissiveIntensity: 3.2 }), [-WX + 0.05, 2.78, 0], B, { cast: false, recv: false });
  const lampsI = [[-0.5, 2.9, 0.0, '#ffd2b0', 22], [0.8, 2.6, -2.6, '#ff6ac0', 14], [0.8, 2.6, 2.6, '#6ae8ff', 12]].map(([x, y, z, col, I]) => { const L = new THREE.PointLight(col, I, 9, 2); L.position.set(x, y, z); B.add(L); return L; });
  void lampsI;
  // bánh mì on a stool by the window (the five loaves are in Tèo's bag; this is a stack for the wide shots)
  // ---- a vestibule "inside" glimpse is the room itself (the door opens straight into it) ----
  // ---- the SILVER car on the sea-side kerb, in front of the gym ----
  const sOpt = { at: silver.at || GYM.SILVER_AT, yaw: silver.yaw ?? GYM.SILVER_YAW }, car = buildSilverCar(g, sOpt);
  // ---- the seagull ----
  const gullG = new THREE.Group(); g.add(gullG); gullG.visible = false; const wing = [];
  { const wm = std('#f6f6f4', { roughness: 0.8 }), gry = std('#8a93a0', { roughness: 0.8 }), org = std('#ff9a1a', { roughness: 0.6 });
    ball(0.1, wm, [0, 0, 0], gullG, {}, 14).scale.set(1, 0.8, 1.9); ball(0.062, wm, [0, 0.07, 0.19], gullG, {}, 12); mesh(new THREE.ConeGeometry(0.018, 0.08, 8), org, [0, 0.062, 0.265], gullG, { rot: [Math.PI / 2, 0, 0], cast: false }); mesh(new THREE.BoxGeometry(0.005, 0.04, 0.06), std('#d9a020'), [0.03, 0.07, 0.01], gullG, { cast: false });
    mesh(new THREE.ConeGeometry(0.05, 0.16, 8), wm, [0, 0.0, -0.22], gullG, { rot: [-Math.PI / 2, 0, 0], cast: false });
    for (const s of [-1, 1]) { const pv = new THREE.Group(); gullG.add(pv); pv.position.set(s * 0.07, 0.04, 0.02); const wp = mesh(new THREE.BoxGeometry(0.42, 0.012, 0.2), wm, [s * 0.21, 0, 0], pv); mesh(new THREE.BoxGeometry(0.2, 0.013, 0.2), gry, [s * 0.42, 0, 0.0], pv, { cast: false }); wing.push({ pv, s }); void wp;
      cyl(0.006, 0.006, 0.09, org, [s * 0.035, -0.1, 0.02], gullG, { cast: false }, 6); } }
  // ---- the thrown jacket ----
  const jk = new THREE.Group(); g.add(jk); jk.visible = false; { const m = std('#c9284a', { roughness: 0.85 }), c2 = std('#f2e3c4', { roughness: 0.8 }); ball(0.2, m, [0, 0, 0], jk, {}, 14).scale.set(1.2, 0.45, 1.0); for (const s of [-1, 1]) { mesh(new THREE.CapsuleGeometry(0.06, 0.34, 4, 10), m, [s * 0.34, 0.0, 0.1], jk, { rot: [0.3, 0, s * 1.2] }); } mesh(new THREE.BoxGeometry(0.28, 0.03, 0.06), c2, [0, 0.07, -0.05], jk, { cast: false }); }
  // seats / cams: the episode writes its own free cameras; marks are not needed
  const seats = {}, cams = {};
  const SC = sOpt.at, SY = sOpt.yaw, cs = Math.cos(SY), sn = Math.sin(SY);
  const carW = (x, y, z) => [SC[0] + x * cs + z * sn, y, SC[1] - x * sn + z * cs];   // a point in the silver car's frame -> place-local
  const update = (t, fx = {}, follow = null, sc) => {
    // a rider glued into a car that heads -z (yaw PI) leaves Euler x = z = PI in his root (decompose in XYZ order): a later `rotation.y = PI` then faces the WRONG way (found in the sequential dump of gta6p2b: Tèo faced +z at l4). YXZ keeps x, z ~ 0.
    if (sc) for (const n of ['teo', 'bip', 'ga', 'gas', 'bongden']) { const o = sc.getObjectByName(n); if (o && o.rotation.order !== 'YXZ') { const q = o.quaternion.clone(); o.rotation.order = 'YXZ'; o.quaternion.copy(q); } }
    R.update?.(t, fx, follow, sc);
    car.update(t, fx);
    // door leaf: fx gdoor 0 = open flat against the wall outside (100 degrees), 1 = shut
    const dk = smooth(clamp(fx.gdoor || 0)); leaf.rotation.y = lerp(2.9, 0.0, dk);
    // seagull: lands on the bonnet, stands, flies off (setOpts.gym.gull = { t0, t1 })
    const gl = gull; gullG.visible = !!gl && t >= gl.t0 && t <= gl.t1; if (gullG.visible) { const u = clamp((t - gl.t0) / (gl.t1 - gl.t0)), land = carW(0.3, 0.96, 1.5);
      const A = [land[0] - 9, 5.5, land[2] - 5], Z = [land[0] + 7, 6.5, land[2] + 6]; let p, fly = 1, yaw;
      if (u < 0.34) { const k = smooth(u / 0.34), e = 1 - Math.pow(1 - u / 0.34, 2.2); p = [lerp(A[0], land[0], e), lerp(A[1], land[1], e) + 0.25 * Math.sin(Math.PI * k) * (1 - k), lerp(A[2], land[2], e)]; fly = 1 - smooth((u - 0.27) / 0.07); yaw = Math.atan2(land[0] - A[0], land[2] - A[2]); }
      else if (u < 0.7) { p = [...land]; fly = 0; yaw = 0.6 + 0.4 * Math.sin(u * 20); }
      else { const k = smooth((u - 0.7) / 0.3), e = Math.pow((u - 0.7) / 0.3, 1.6); p = [lerp(land[0], Z[0], e), lerp(land[1], Z[1], k), lerp(land[2], Z[2], e)]; fly = smooth((u - 0.7) / 0.04); yaw = Math.atan2(Z[0] - land[0], Z[2] - land[2]); }
      gullG.position.set(...p); gullG.rotation.y = yaw; const fl = fly * Math.sin(t * 22); for (const w of wing) w.pv.rotation.z = w.s * (fly > 0.05 ? 0.8 * fl : -0.85 * (1 - fly)) * (1) + w.s * 0.0; if (fly > 0.05) gullG.rotation.z = 0.12 * Math.sin(t * 5); else gullG.position.y += 0.012 * Math.sin(t * 3); }
    // jacket: an arc between two place-local points (setOpts.gym.jacket)
    const jc = jacket; jk.visible = !!jc && t >= jc.t0; if (jk.visible) { const u = clamp((t - jc.t0) / (jc.t1 - jc.t0)), e = 1 - Math.pow(1 - u, 1.6), a = jc.from, b = jc.to; jk.position.set(lerp(a[0], b[0], e), lerp(a[1], b[1], u) + 1.4 * 4 * u * (1 - u), lerp(a[2], b[2], e)); jk.rotation.set(u * 6, u * 4, u * 3 * (1 - u)); if (u >= 1) jk.rotation.set(0.1, 1.2, 0); }
  };
  return { ...R, group: g, seats, cams, update, look: GYM_LOOK, light: 'gta_gym', lightAt: [0, 1.0, -22], consts: { GX, GZ, WX, WZ, WH, DZ, carW }, car, B, Egroup: E };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// THE LAIR (tracker screen + a chair + a desk in the dark)
// ---------------------------------------------------------------------------------------------------------------------------------
export const DOT = (t, t0 = 0) => {   // the red dot's path on the tracker (0..1 map coordinates): a slow loop along a coast road, a pure function of t
  const u = Math.max(0, t - t0), k = u * 0.06; const pts = [[0.3, 0.72], [0.4, 0.62], [0.5, 0.52], [0.62, 0.5], [0.74, 0.38], [0.86, 0.32]]; const f = Math.min(pts.length - 1.001, k * (pts.length - 1)), i = Math.floor(f), a = pts[i], b = pts[i + 1], w = f - i; return [lerp(a[0], b[0], w), lerp(a[1], b[1], w)]; };
export function buildGtaLair(scene, { at = [0, 0, 0], t0 = 0 } = {}) {
  const g = new THREE.Group(); g.name = 'gta_lair'; g.position.set(...at); scene.add(g);
  const dark = std('#0d0f17', { roughness: 0.9 }), seats = {}, cams = {};
  mesh(new THREE.PlaneGeometry(14, 12), std('#10131c', { roughness: 0.6 }), [0, 0, 0], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  for (const [x, z, w, d] of [[0, -4.6, 14, 0.3], [-6.6, 0, 0.3, 12], [6.6, 0, 0.3, 12], [0, 5.6, 14, 0.3]]) box(w, 5, d, dark, [x, 2.5, z], g, { cast: false });
  mesh(new THREE.PlaneGeometry(14, 12), dark, [0, 5, 0], g, { cast: false, rot: [Math.PI / 2, 0, 0] });
  // the big screen on the back wall: a canvas redrawn each frame from a pure function of t
  const SW = 512, SH = 288, cv = document.createElement('canvas'); cv.width = SW; cv.height = SH; const sc2 = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const scr = mesh(new THREE.PlaneGeometry(4.2, 2.36), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.1, 1.1, 1.1) }), [0, 2.35, -4.42], g, { cast: false });
  box(4.4, 2.56, 0.08, std('#05060a', { roughness: 0.5 }), [0, 2.35, -4.47], g, { cast: false });
  // two small side monitors (dim, blank)
  for (const s of [-1, 1]) { box(1.3, 0.8, 0.06, std('#05060a'), [s * 3.4, 2.1, -4.45], g, { cast: false }); mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshStandardMaterial({ color: '#06121c', emissive: '#0a2a3a', emissiveIntensity: 0.7 }), [s * 3.4, 2.1, -4.41], g, { cast: false }); }
  // desk + chair (the figure sits on the chair, facing -z)
  box(3.6, 0.07, 1.2, std('#1a1d28', { roughness: 0.5 }), [0, 0.78, -3.4], g); for (const [x, z] of [[-1.7, -3.9], [1.7, -3.9], [-1.7, -2.9], [1.7, -2.9]]) box(0.07, 0.78, 0.07, dark, [x, 0.39, z], g, { cast: false });
  box(0.9, 0.04, 0.34, std('#10121a'), [0, 0.82, -3.3], g, { cast: false }); box(0.4, 0.14, 0.04, std('#10121a'), [0.6, 0.86, -3.5], g, { cast: false });
  const chair = new THREE.Group(); g.add(chair); chair.position.set(0, 0, -1.5); box(0.55, 0.08, 0.55, std('#1a1c26'), [0, 0.45, 0], chair); box(0.5, 0.26, 0.08, std('#1a1c26'), [0, 0.62, 0.3], chair).rotation.x = -0.08; cyl(0.04, 0.04, 0.42, std('#222'), [0, 0.22, 0], chair, { cast: false }, 8); box(0.6, 0.04, 0.6, std('#222'), [0, 0.02, 0], chair, { cast: false });
  // the screen's cool light on the room (a weak point light; the figure is a silhouette against it)
  const pl = new THREE.PointLight('#5fbaff', 12, 9, 2); pl.position.set(0, 2.3, -3.6); g.add(pl);
  const rimL = new THREE.PointLight('#dff0ff', 7, 3.2, 2); rimL.position.set(0.55, 1.55, -1.1); g.add(rimL);   // a rim light on the shadow's HAND and the chain (his back stays dark)
  for (const [x, z, c] of [[0.85, -1.9, '#7fd8ff'], [-0.85, -1.9, '#7fd8ff'], [0, -2.7, '#9fe8ff']]) { const L = new THREE.PointLight(c, 4.5, 2.6, 2); L.position.set(x, 1.55, z); g.add(L); }   // rim lights behind / beside the shadow: the head and shoulders read as a PERSON against the bright screen
  const rimL2 = new THREE.PointLight('#5fd0ff', 5, 3.0, 2); rimL2.position.set(-0.75, 1.5, -2.3); g.add(rimL2);
  const draw = (t) => {
    const c = sc2; c.clearRect(0, 0, SW, SH); c.fillStyle = '#0b2c4a'; c.fillRect(0, 0, SW, SH);
    c.strokeStyle = 'rgba(80,170,230,0.16)'; c.lineWidth = 1; for (let x = 0; x <= SW; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, SH); c.stroke(); } for (let y = 0; y <= SH; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(SW, y); c.stroke(); }
    // coastline (land top-right, sea bottom-left), roads, blocks
    c.fillStyle = '#134468'; c.beginPath(); c.moveTo(SW * 0.0, SH * 0.55); c.quadraticCurveTo(SW * 0.3, SH * 0.52, SW * 0.5, SH * 0.36); c.quadraticCurveTo(SW * 0.7, SH * 0.2, SW * 0.78, SH * 0.0); c.lineTo(SW, 0); c.lineTo(SW, SH); c.lineTo(SW * 0.3, SH); c.quadraticCurveTo(SW * 0.2, SH * 0.8, 0, SH * 0.78); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(95,200,255,0.55)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, SH * 0.55); c.quadraticCurveTo(SW * 0.3, SH * 0.52, SW * 0.5, SH * 0.36); c.quadraticCurveTo(SW * 0.7, SH * 0.2, SW * 0.78, 0); c.stroke();
    c.strokeStyle = 'rgba(110,190,235,0.35)'; c.lineWidth = 3; for (const [a, b, d, e] of [[0.1, 0.76, 0.9, 0.3], [0.3, 1, 0.55, 0.45], [0.6, 0.5, 1, 0.64], [0.45, 0.2, 0.7, 0.62]]) { c.beginPath(); c.moveTo(SW * a, SH * b); c.lineTo(SW * ((a + d) / 2 + 0.03), SH * ((b + e) / 2 - 0.05)); c.lineTo(SW * d, SH * e); c.stroke(); }
    c.fillStyle = 'rgba(70,140,190,0.25)'; for (let i = 0; i < 40; i++) { const x = SW * (0.35 + 0.6 * hash(i * 3.3)), y = SH * (0.04 + 0.6 * hash(i * 7.1)); if (x / SW + y / SH > 1.05 - 0.0) c.fillRect(x, y, 14 + 18 * hash(i), 8 + 12 * hash(i + 4)); }
    // the red dot, its trail, and a ring that opens on every beat of the LED
    const p = DOT(t, t0), px = p[0] * SW, py = p[1] * SH, w = ledWave(t);
    c.strokeStyle = 'rgba(255,60,60,0.45)'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); for (let k = 0; k <= 18; k++) { const q = DOT(t - k * 0.9, t0); if (k === 0) c.moveTo(q[0] * SW, q[1] * SH); else c.lineTo(q[0] * SW, q[1] * SH); } c.stroke(); c.setLineDash([]);
    const ph = (t / 0.5) % 1, rr = 8 + 46 * ph; c.strokeStyle = `rgba(255,70,70,${0.8 * (1 - ph)})`; c.lineWidth = 3; c.beginPath(); c.arc(px, py, rr, 0, 7); c.stroke();
    const gg = c.createRadialGradient(px, py, 1, px, py, 30); gg.addColorStop(0, `rgba(255,40,40,${0.3 + 0.55 * w})`); gg.addColorStop(1, 'rgba(255,60,60,0)'); c.fillStyle = gg; c.fillRect(px - 32, py - 32, 64, 64);
    c.fillStyle = `rgb(255,${Math.round(36 + 40 * w)},${Math.round(36 + 30 * w)})`; c.beginPath(); c.arc(px, py, 7 + 3 * w, 0, 7); c.fill();
    // crosshair ticks + a scanning line
    c.strokeStyle = 'rgba(120,220,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(px - 22, py); c.lineTo(px - 12, py); c.moveTo(px + 12, py); c.lineTo(px + 22, py); c.moveTo(px, py - 22); c.lineTo(px, py - 12); c.moveTo(px, py + 12); c.lineTo(px, py + 22); c.stroke();
    const sy = ((t * 0.45) % 1) * SH; const sg = c.createLinearGradient(0, sy - 20, 0, sy + 4); sg.addColorStop(0, 'rgba(120,220,255,0)'); sg.addColorStop(1, 'rgba(120,220,255,0.18)'); c.fillStyle = sg; c.fillRect(0, sy - 20, SW, 24);
    tex.needsUpdate = true;
  };
  draw(0);
  const update = (t) => { draw(t); };
  return { group: g, seats, cams, update, look: LAIR_LOOK, light: 'gta_lair', lightAt: [0, 1.4, -1.2] };
}
