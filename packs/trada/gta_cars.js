// Trà đá với AI, special "Tèo vào GTA 6?" (19/11): the cars, and the small props Tèo and Bíp hold in the car / at the bank.
// Our own design (chunky, toy-like, clean shapes; no real car model, no brand marks, no game vehicle). Everything is a pure function of t.
// Car frame: origin on the ground at the middle of the wheelbase, +z = the way it drives, +x = screen-right when you look at it from the FRONT (so a driver sitting at -x is
// on the LEFT of a camera that faces the car: the tea-table two-shot, Tèo left / Bíp right). Heading `tyaw` > 0 turns the nose towards +x.
// ENGINE.md "Added 19/11, GTA cars and poses" is the manual. Used by: packs/trada/chars.js (CAR_FIT, prop builders), the `gta` set, demo/gta_cars_*.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, smooth, hash, noise1, canvasTex, std, mesh, V } from '../../core/util.js';

// where the riders sit and where the wheel is, shared with chars.js so Tèo's hands land on the rim
export const CAR_FIT = {
  seat: { driver: [-0.34, 0.24, -0.12], pass: [0.34, 0.24, -0.12] },   // rider root (the floor under his seat), car frame
  yaw: { driver: 0.14, pass: -0.14 },                                    // riders face a touch towards each other (the tea-table two-shot)
  wheel: { c: [-0.34, 0.76, 0.21], r: 0.165, tube: 0.016, n: [0, 0.5, -0.866], steerMax: 1.5 },   // steering wheel centre (car frame), radius, tube, normal (towards the driver)
  seatBackTop: [0.34, 1.07, -0.37], gloat: [0.0, 1.1, -0.36],      // gloat: where the draped hand rests (car frame, on top of the seats' backs between the two heads)
                                       // top edge of the passenger seat back (car frame), for the gloat arm
  hand: { l: 2.7, r: 0.45 },                                              // base angles (rad) of the two hands on the rim: about 10 and 2 o'clock
};
const _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _M = new THREE.Matrix4(), _S = new THREE.Vector3(1, 1, 1), _P = new THREE.Vector3();
// car-frame point -> a rider's root frame (rider = 'driver' | 'pass'); undo the seat offset and the rider's yaw
export function carToRider(p, who = 'driver') { const s = CAR_FIT.seat[who], y = CAR_FIT.yaw[who], c = Math.cos(y), si = Math.sin(y), x = p[0] - s[0], z = p[2] - s[2]; return V(c * x - si * z, p[1] - s[1], si * x + c * z); }
// the point on the wheel rim for hand angle `a` (rad) while the wheel is turned by `steer` (-1..1), in the driver's root frame
export function wheelPoint(a, steer = 0, rad = CAR_FIT.wheel.r) {
  const W = CAR_FIT.wheel, n = V(...W.n).normalize(), u = V(1, 0, 0), v = V().crossVectors(u, n), th = a - steer * W.steerMax;
  const p = V(...W.c).addScaledVector(u, Math.cos(th) * rad).addScaledVector(v, Math.sin(th) * rad); return carToRider([p.x, p.y, p.z], 'driver');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// small helpers
const rb = (w, h, d, r, mat, pos, parent, o = {}) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)), mat, pos, parent, o);
const paint = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25, ...o });
const glowTex = (inner = 'rgba(255,255,255,1)') => canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 2, 64, 64, 62); g.addColorStop(0, inner); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
const beamTex = () => canvasTex(64, 256, (c) => { const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.12, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 256); const h = c.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = h; c.fillRect(0, 0, 64, 256); });
const addMat = (tex, color, o = {}) => new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...o });
function plateTex(text) {   // a white plate, thick navy border, big navy letters (readable at phone size from 4-6 m)
  return canvasTex(1024, 480, (c, w, h) => { c.fillStyle = '#f7f6ef'; c.beginPath(); c.roundRect(0, 0, w, h, 54); c.fill(); c.strokeStyle = '#14234f'; c.lineWidth = 26; c.beginPath(); c.roundRect(24, 24, w - 48, h - 48, 38); c.stroke();
    c.fillStyle = '#14234f'; c.textAlign = 'center'; c.textBaseline = 'middle'; let s = 300; for (; s > 80; s -= 6) { c.font = `900 ${s}px Display, sans-serif`; if (c.measureText(text).width <= w - 150) break; } c.fillText(text, w / 2, h / 2 + 14); });
}
function textTex(text, w = 512, h = 128, fg = '#10131c', bg = null, weight = 900) { return canvasTex(w, h, (c) => { if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); } c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; let s = h * 0.8; for (; s > 20; s -= 4) { c.font = `${weight} ${s}px Display, sans-serif`; if (c.measureText(text).width <= w * 0.92) break; } c.fillText(text, w / 2, h / 2 + 2); }); }

// ---------------------------------------------------------------------------------------------------------------------------------
// THE CAR.  buildCar(parent, opts) -> { group, update(t, fx), seats, name, bodyMat }
// opts: kind 'hero' (open two-seater) | 'police' (black and white, roof, light bar), prefix '' | 'p1' | 'p2' (fx names are prefix + name, see below),
//   at [x, z] the mark, yaw (rad) the mark's heading, color (hero body), plate ('TÈO 01'), riders { driver: 'teo', pass: 'bip' } (cast names; looked up lazily in the scene), name
// fx (acts on 'set'; a number is 0 before its first act, so lamps are an OFFSET on a base level, see below). tx tz ty (m from the mark; ty = up, the jump), tyaw (rad),
//   pitch (rad, + = nose up, whole car: the jump arc), roll (rad, + = the +x side goes down, whole car), squat (-1..1, body only on its springs: + = nose dives, - = tail squats),
//   lean (rad, body only: cornering lean, + = leans to +x), bounce (m, body only), steer (-1..1, + = steers towards +x: front tyres, wheel, driver's hands), wheels (extra rad),
//   skid 0..1 (tyre smoke), head (headlights, base 0.7), tail (tail-lights, base 0.45), brake 0..1 (tail-lights flare), bar (police light bar, base 1, give -1 to switch off), fade (0..1 hides the whole car), unride (>= 0.5: the riders are NOT glued to the seats: they stand wherever the cast puts them)
export function buildCar(parent, o = {}) {
  const { kind = 'hero', prefix = '', at = [0, 0], yaw = 0, plate = 'TÈO 01', name = prefix || 'car' } = o;
  const POL = kind === 'police', riders = o.riders ?? (POL ? {} : { driver: 'teo', pass: 'bip' }), K = (n) => prefix + n;
  const g = new THREE.Group(); g.name = 'car_' + name; parent.add(g); g.position.set(at[0], 0, at[1]); g.rotation.y = yaw;
  const rig = new THREE.Group(); g.add(rig);                                   // whole-car pitch / roll about the wheel centres
  const chassis = new THREE.Group(); rig.add(chassis);                          // body on its springs (squat, lean, bounce)
  const BODY = POL ? '#1d2331' : (o.color || '#e85d00'), TRIM = POL ? '#f3f4f2' : '#ffd9b0';
  const bodyM = paint(BODY), trimM = paint(TRIM, { roughness: 0.45 }), darkM = std('#1b1a26', { roughness: 0.6 }), chromeM = new THREE.MeshStandardMaterial({ color: '#d6dae0', roughness: 0.28, metalness: 0.7 });
  const seatM = std(POL ? '#2a2f3e' : '#2a2540', { roughness: 0.75 }), glassM = new THREE.MeshPhysicalMaterial({ color: '#bfeaff', transparent: true, opacity: 0.2, roughness: 0.04, clearcoat: 1 });
  const C = (m, a, b) => { m.userData.noClip = true; return m; };
  // ---- the tub: front block, rear block, cockpit floor and sides, a dash with a low windscreen. Dimensions in metres, 4.0 long (long bonnet), 1.56 wide ----
  rb(1.56, 0.52, 1.65, 0.17, bodyM, [0, 0.46, 1.395], chassis);                                  // long engine bay block (z 0.57 .. 2.22)
  rb(1.4, 0.16, 1.55, 0.08, bodyM, [0, 0.76, 1.42], chassis, { rot: [-0.04, 0, 0] });            // long bonnet
  rb(1.56, 0.56, 1.2, 0.17, bodyM, [0, 0.48, -1.17], chassis);                                  // rear block (z -1.77 .. -0.57)
  rb(1.4, 0.14, 1.0, 0.07, bodyM, [0, 0.8, -1.22], chassis);                                    // rear deck
  rb(1.4, 0.08, 1.3, 0.03, darkM, [0, 0.2, -0.0], chassis);                                      // cockpit floor (its top is y 0.24)
  for (const s of [-1, 1]) { rb(0.1, 0.5, 1.4, 0.05, bodyM, [s * 0.73, 0.5, -0.02], chassis); rb(0.13, 0.1, 1.36, 0.05, trimM, [s * 0.73, 0.8, -0.02], chassis); }   // doors with a pale top rail
  rb(1.5, 0.3, 0.45, 0.1, bodyM, [0, 0.78, 0.7], chassis); rb(1.36, 0.06, 0.3, 0.03, darkM, [0, 0.945, 0.7], chassis);   // dash and its dark pad
  for (const s of ['driver', 'pass']) { const x = CAR_FIT.seat[s][0]; rb(0.46, 0.28, 0.5, 0.09, seatM, [x, 0.38, -0.16], chassis); const b = rb(0.44, 0.56, 0.1, 0.05, seatM, [x, 0.8, -0.37], chassis, { rot: [-0.12, 0, 0] }); b.userData.seatBack = true; }
  // the steering wheel (turns with `steer`) on a column
  const W = CAR_FIT.wheel, wn = V(...W.n).normalize(), wheel = new THREE.Group(); wheel.position.set(...W.c); chassis.add(wheel);
  const wheelOri = new THREE.Group(); wheelOri.quaternion.setFromUnitVectors(V(0, 0, 1), wn.clone().negate()); wheel.add(wheelOri); const wheelSpin = new THREE.Group(); wheelOri.add(wheelSpin);
  mesh(new THREE.TorusGeometry(W.r, W.tube, 12, 36), std('#262033', { roughness: 0.5 }), [0, 0, 0], wheelSpin, { cast: false }); mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 16), std('#3a3350', { roughness: 0.5 }), [0, 0, 0], wheelSpin, { cast: false, rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(W.r * 1.0, 0.02, 0.016), std('#262033', { roughness: 0.5 }), [Math.cos(i * 2.094 + 1.57) * W.r * 0.5, Math.sin(i * 2.094 + 1.57) * W.r * 0.5, 0], wheelSpin, { cast: false, rot: [0, 0, i * 2.094 + 1.57] });
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), darkM, [0, 0, 0], chassis, { cast: false, rot: [0.5, 0, 0], name: 'column' }).position.set(W.c[0], W.c[1] - 0.12, W.c[2] + 0.13);
  // windscreen: a low raked pane and a thin chrome frame (the faces stay above it)
  const WS = new THREE.Group(); chassis.add(WS); WS.position.set(0, 0.94, 0.8); WS.rotation.x = -0.62;
  const wsH = 0.13, wsW = 1.36; mesh(new THREE.PlaneGeometry(wsW, wsH), C(glassM), [0, wsH / 2, 0], WS, { cast: false, recv: false }); mesh(new THREE.BoxGeometry(wsW + 0.06, 0.028, 0.03), chromeM, [0, wsH, 0], WS, { cast: false });
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, wsH, 0.03), chromeM, [s * wsW / 2, wsH / 2, 0], WS, { cast: false });
  // bumpers, grille, lamps
  rb(1.62, 0.12, 0.14, 0.05, chromeM, [0, 0.33, 2.25], chassis); rb(1.62, 0.12, 0.14, 0.05, chromeM, [0, 0.33, -1.8], chassis);
  rb(0.7, 0.2, 0.05, 0.03, darkM, [0, 0.52, 2.23], chassis);
  const headM = [], tailM = [], HL = new THREE.Color(5, 4.2, 2.8), TL = new THREE.Color(5, 0.35, 0.25);
  for (const s of [-1, 1]) {
    const hm = new THREE.MeshBasicMaterial({ color: HL.clone().multiplyScalar(0.7), toneMapped: false }); headM.push(hm); mesh(new THREE.SphereGeometry(0.1, 20, 14), hm, [s * 0.55, 0.64, 2.19], chassis, { cast: false, scale: [1, 1, 0.55] });
    const tm = new THREE.MeshBasicMaterial({ color: TL.clone().multiplyScalar(0.45), toneMapped: false }); tailM.push(tm); rb(0.26, 0.12, 0.06, 0.04, tm, [s * 0.55, 0.62, -1.77], chassis, { cast: false });
  }
  // glows: additive planes (never real lights: nothing changes per frame, and they survive the export)
  const glowH = [], glowT = [], gT = glowTex(), bT = beamTex();
  for (const s of [-1, 1]) {
    const gh = mesh(new THREE.PlaneGeometry(0.62, 0.62), addMat(gT, '#ffe8c0'), [s * 0.55, 0.64, 2.27], chassis, { cast: false, recv: false }); gh.userData.noClip = true; glowH.push(gh);
    const bm = mesh(new THREE.PlaneGeometry(1.1, 5.2), addMat(bT, '#ffd9a0'), [s * 0.55, 0.035, 4.9], chassis, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }); bm.userData.noClip = true; glowH.push(bm);
    const gt = mesh(new THREE.PlaneGeometry(0.7, 0.7), addMat(gT, '#ff3c28'), [s * 0.55, 0.62, -1.83], chassis, { cast: false, recv: false }); gt.userData.noClip = true; glowT.push(gt);
  }
  // number plates: a big readable one at the back (the plot device) and one at the front
  const pT = plateTex(plate), pM = new THREE.MeshStandardMaterial({ map: pT, roughness: 0.4, emissive: '#ffffff', emissiveMap: pT, emissiveIntensity: 0.28 });
  const plateB = mesh(new THREE.PlaneGeometry(0.88, 0.41), pM, [0, 0.58, -1.795], chassis, { cast: false, rot: [0, Math.PI, 0], name: 'plate_rear' }); plateB.userData.noClip = true;
  rb(0.92, 0.45, 0.025, 0.02, std('#1a1830', { roughness: 0.5 }), [0, 0.58, -1.782], chassis, { cast: false });
  const plateF = mesh(new THREE.PlaneGeometry(0.62, 0.29), pM, [0, 0.27, 2.33], chassis, { cast: false, name: 'plate_front' }); plateF.userData.noClip = true;
  // police: a roof on four posts, white doors with CẢNH SÁT, a light bar
  const barM = { r: null, b: null, rg: null, bg: null };
  if (POL) {
    for (const [x, z] of [[-0.72, 0.5], [0.72, 0.5], [-0.72, -0.6], [0.72, -0.6]]) rb(0.08, 0.78, 0.08, 0.03, bodyM, [x, 1.2, z], chassis);
    rb(1.6, 0.1, 1.45, 0.07, trimM, [0, 1.62, -0.05], chassis); mesh(new THREE.BoxGeometry(1.44, 0.46, 0.02), C(glassM), [0, 1.35, 0.52], chassis, { cast: false, recv: false, rot: [-0.2, 0, 0] });
    for (const s of [-1, 1]) { const d = mesh(new THREE.PlaneGeometry(1.0, 0.34), new THREE.MeshStandardMaterial({ map: textTex('CẢNH SÁT', 640, 214, '#141a2e', '#f3f4f2'), roughness: 0.5 }), [s * 0.783, 0.56, -0.02], chassis, { cast: false, rot: [0, s * Math.PI / 2, 0] }); d.userData.noClip = true; }
    rb(0.8, 0.07, 0.24, 0.03, darkM, [0, 1.71, -0.05], chassis);
    barM.r = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.02, 0.02), toneMapped: false }); barM.b = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.05, 0.2), toneMapped: false });
    rb(0.34, 0.13, 0.22, 0.06, barM.r, [-0.22, 1.78, -0.05], chassis, { cast: false }); rb(0.34, 0.13, 0.22, 0.06, barM.b, [0.22, 1.78, -0.05], chassis, { cast: false });
    barM.rg = mesh(new THREE.PlaneGeometry(1.5, 1.5), addMat(gT, '#ff2a1c'), [-0.22, 1.8, -0.05], chassis, { cast: false, recv: false }); barM.bg = mesh(new THREE.PlaneGeometry(1.5, 1.5), addMat(gT, '#2a52ff'), [0.22, 1.8, -0.05], chassis, { cast: false, recv: false });
    barM.rg.userData.noClip = barM.bg.userData.noClip = true; barM.rg.rotation.y = barM.bg.rotation.y = Math.PI / 4;
    const bd = mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshStandardMaterial({ map: textTex('POLICE', 640, 200, '#f3f4f2', '#1d2331'), roughness: 0.5 }), [0, 0.92, 1.9], chassis, { cast: false, rot: [-Math.PI / 2 + 0.05, 0, 0] }); bd.userData.noClip = true; bd.visible = false;
  }
  // ---- wheels: tyre (lathe with rounded shoulders), hub with five spokes so the roll reads; the front pair steers ----
  const tyreM = std('#17151f', { roughness: 0.85 }), hubM = new THREE.MeshStandardMaterial({ color: '#dfe3ea', roughness: 0.3, metalness: 0.6 }), R = 0.33, WD = 0.26;
  const tyreG = new THREE.LatheGeometry([[0.001, -WD / 2], [R - 0.06, -WD / 2], [R - 0.012, -WD / 2 + 0.03], [R, -WD / 2 + 0.07], [R, WD / 2 - 0.07], [R - 0.012, WD / 2 - 0.03], [R - 0.06, WD / 2], [0.001, WD / 2]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.86, R, sz > 0 ? 1.4 : -1.05); rig.add(pivot); const spin = new THREE.Group(); pivot.add(spin);
    const tyre = mesh(tyreG, tyreM, [0, 0, 0], spin, { rot: [0, 0, Math.PI / 2] }); tyre.userData.tyre = true;
    const hub = new THREE.Group(); spin.add(hub); hub.position.x = sx * (WD / 2 + 0.002); hub.rotation.z = -sx * Math.PI / 2;   // hub face looks outward
    mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20), hubM, [0, 0, 0], hub, { cast: false });
    for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(0.05, 0.034, 0.17), POL ? darkM : std('#232033', { roughness: 0.5 }), [Math.sin(i * 1.2566) * 0.095, 0.014, Math.cos(i * 1.2566) * 0.095], hub, { cast: false, rot: [0, i * 1.2566, 0] });
    mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 14), chromeM, [0, 0.01, 0], hub, { cast: false });
    wheels.push({ pivot, spin, front: sz > 0, sx });
  }
  // fender flares over the wheels (so the tyres tuck under the body)
  
  // ---- tyre smoke: 10 puffs behind each rear wheel on slow waves (cycle with a sine fade, so none pops); in the car's own frame, trailing back ----
  const puffs = []; const smokeG = new THREE.SphereGeometry(1, 12, 8);
  for (const sx of [-1, 1]) for (let i = 0; i < 10; i++) { const m = new THREE.MeshBasicMaterial({ color: '#d8d4e2', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }); const s = new THREE.Mesh(smokeG, m); s.castShadow = false; s.userData.noClip = true; rig.add(s); puffs.push({ s, sx, i }); }
  // the seats the riders sit on; the world places each rider's root every frame (glued, like the market trolley)
  const seats = { driver: { pos: CAR_FIT.seat.driver, yaw: CAR_FIT.yaw.driver }, pass: { pos: CAR_FIT.seat.pass, yaw: CAR_FIT.yaw.pass } };
  let baseP = null; const scn = () => { let o2 = g; while (o2.parent) o2 = o2.parent; return o2; };
  const place = (who, nm, steer = 0) => { if (!nm) return; const r = scn().getObjectByName(nm); if (!r) return; const s = CAR_FIT.seat[who], y = CAR_FIT.yaw[who]; _Q.setFromEuler(_E.set(0, y, 0)); _P.set(s[0], s[1], s[2]); _M.compose(_P, _Q, _S); _M.premultiply(chassis.matrixWorld); _M.decompose(r.position, r.quaternion, _P.set(1, 1, 1)); r.scale.set(1, 1, 1); r.updateMatrix(); r.userData.carSteer = steer; };
  const FPS_WHEEL = 1 / R;
  function update(t, fx = {}) {
    const f = (n) => fx[K(n)] || 0, tx = f('tx'), tz = f('tz'), ty = f('ty'), tyaw = f('tyaw'), pitch = f('pitch'), roll = f('roll'), steer = clamp(f('steer'), -1, 1), sq = clamp(f('squat'), -1.2, 1.2);
    g.visible = f('fade') < 0.5; g.position.set(at[0] + tx, ty, at[1] + tz); g.rotation.y = yaw + tyaw;
    rig.rotation.order = 'YXZ'; rig.position.set(0, R, 0); rig.rotation.set(-pitch, 0, -roll);
    for (const w of wheels) { w.pivot.position.set(w.sx * 0.86, 0, w.front ? 1.4 : -1.05); }   // the rig pivot is the wheel-centre height
    // body on its springs
    chassis.position.set(0, -R + f('bounce') - 0.05 * Math.abs(sq), 0); chassis.rotation.order = 'YXZ'; chassis.rotation.set(0.09 * sq, 0, -f('lean'));
    // wheels: roll with the distance driven, front pair steers; the rig sits at wheel-centre height so the wheels hang around y 0
    const dist = Math.hypot(tx, tz) * Math.sign(tz || tx || 1) + (f('wheels')) * R; for (const w of wheels) { w.spin.rotation.x = dist * FPS_WHEEL; w.pivot.rotation.y = w.front ? steer * 0.52 : 0; }
    wheelSpin.rotation.z = -steer * CAR_FIT.wheel.steerMax;
    // lamps: base level + offset
    const hl = clamp(0.7 + f('head'), 0, 1.4), tl = clamp(0.45 + f('tail') + 0.9 * clamp(f('brake')), 0, 1.5);
    headM.forEach((m) => m.color.copy(HL).multiplyScalar(0.2 + 0.9 * hl)); tailM.forEach((m) => m.color.copy(TL).multiplyScalar(0.12 + 0.9 * tl));
    glowH.forEach((m, i) => { m.material.opacity = (i % 2 ? 0.2 : 0.4) * hl; }); glowT.forEach((m) => { m.material.opacity = 0.7 * tl; });
    if (POL) { const lv = clamp(1 + f('bar'), 0, 1.2), a = 0.5 + 0.5 * Math.sin(t * 6.1), b = 0.5 + 0.5 * Math.sin(t * 6.1 + Math.PI);   // red and blue swap on a ~1 s sine, never per frame
      barM.r.color.setRGB(0.25 + 4.5 * a * a, 0.03, 0.03).multiplyScalar(lv); barM.b.color.setRGB(0.03, 0.08 + 0.4 * b * b, 0.25 + 4.5 * b * b).multiplyScalar(lv); barM.rg.material.opacity = 0.75 * a * a * lv; barM.bg.material.opacity = 0.75 * b * b * lv; }
    // smoke
    const sk = clamp(f('skid')); for (const p of puffs) { const u = (t * 0.55 + p.i / 10 + (p.sx > 0 ? 0.37 : 0)) % 1, a = Math.sin(Math.PI * u), k = u * u; p.s.visible = sk > 0.01 && a > 0.01;
      if (p.s.visible) { p.s.position.set(p.sx * 0.72 + p.sx * 0.35 * k + 0.12 * noise1(u * 3 + p.i, p.sx), -0.2 + 0.55 * k, -1.05 - 3.1 * u + 0.1 * noise1(p.i * 1.7, 3)); const r = 0.14 + 0.5 * k; p.s.scale.setScalar(r); p.s.material.opacity = 0.5 * sk * a * (1 - 0.4 * k); } }
    g.updateMatrixWorld(true); if (f('unride') < 0.5 && f('unrideD') < 0.5) place('driver', riders.driver, steer);   if (f('unride') < 0.5) place('pass', riders.pass); /* unrideD (20/11, gta6p3): lets only the driver go */
  }
  update(0, {});
  return { group: g, update, seats, name, kind, chassis, rig, wheel, plateRear: plateB, bodyMat: bodyM };
}

// where to put a light rig so the three lights follow a car (call from the set's tune/update; offsets are the preset's)
export function followLights(rig, preset, car, w = 1) {
  if (!rig?.key || !preset) return; const T = new THREE.Vector3().setFromMatrixPosition(car.chassis.matrixWorld); T.y = 0.8;
  for (const [l, q] of [[rig.key, preset.key], [rig.rim, preset.rim], [rig.kick, preset.kick]]) { l.target.position.copy(T); l.position.set(T.x + q[2][0], q[2][1], T.z + q[2][2]); }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// HELD PROPS (built here, driven by packs/trada/chars.js)
// the glass of trà đá Bíp holds: a big readable tumbler (cartoon 1.5x), amber tea with a bright top, and the blob that floats out of it (fx tea)
export const GLASS = { h: 0.2, rt: 0.064, rb: 0.05, tea: 0.82 };
export function makeTeaGlass(parent) {
  const g = new THREE.Group(); parent.add(g); g.visible = false;
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.26, roughness: 0.04, clearcoat: 1, metalness: 0.1, depthWrite: false });
  const teaM = new THREE.MeshStandardMaterial({ color: '#d27a1a', roughness: 0.12, emissive: '#8a4208', emissiveIntensity: 0.8 });
  mesh(new THREE.CylinderGeometry(GLASS.rt, GLASS.rb, GLASS.h, 24, 1, true), glassM, [0, 0, 0], g, { cast: false });
  const base = mesh(new THREE.CylinderGeometry(GLASS.rb * 0.98, GLASS.rb * 0.98, 0.012, 24), glassM, [0, -GLASS.h / 2 + 0.006, 0], g, { cast: false });
  const hT = GLASS.h * GLASS.tea, tea = new THREE.Group(); g.add(tea); tea.position.y = -GLASS.h / 2 + 0.01;   // scale.y = fill level 0..1
  const body = mesh(new THREE.CylinderGeometry(GLASS.rt - 0.004, GLASS.rb - 0.002, hT, 24), teaM, [0, hT / 2, 0], tea);
  const top = mesh(new THREE.CircleGeometry(GLASS.rt - 0.004, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.85, 0.3), toneMapped: false }), [0, hT, 0], tea, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, roughness: 0.1 }), [(i - 1) * 0.022, GLASS.h * 0.55 * (0.5 + 0.2 * i), 0.01 * (i % 2 ? 1 : -1)], g, { cast: false, rot: [0.4 * i, 0.6, 0.3] });
  // the blob (a unit sphere scaled in update) and the thin neck that joins it to the glass while it is leaving / returning
  const blobM = new THREE.MeshStandardMaterial({ color: '#d27a1a', roughness: 0.1, emissive: '#9a4c0a', emissiveIntensity: 0.9 });
  const blob = mesh(new THREE.SphereGeometry(1, 28, 20), blobM, [0, 0, 0], g, { cast: false }); const neck = mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), blobM, [0, 0, 0], g, { cast: false });
  const sheen = mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 1.1), toneMapped: false, transparent: true, opacity: 0.8 }), [0, 0, 0], blob, { cast: false }); sheen.scale.setScalar(0.16); sheen.position.set(-0.36, 0.4, 0.7);
  blob.visible = neck.visible = false; blob.userData.noClip = neck.userData.noClip = true;
  const Rb = 0.088, Q = new THREE.Quaternion(), up = new THREE.Vector3();
  // tea 0..1: 0 = full glass, ~0.5 = highest, 1 = back in. `upLocal` = world up in the glass's frame (the blob floats up in the WORLD, not along a tilted hand)
  function update(t, tea01, upLocal) {
    const u = clamp(tea01), e = smooth(u / 0.2) * (1 - smooth((u - 0.8) / 0.2));   // how far the tea has left the glass
    tea.scale.y = Math.max(0.001, 1 - 0.97 * e); tea.visible = e < 0.995; top.material.opacity = 1;
    blob.visible = e > 0.02; const hMax = 0.5, H = hMax * Math.pow(Math.sin(Math.PI * u), 0.85), lvl = (-GLASS.h / 2 + 0.01) + hT * tea.scale.y, rim = GLASS.h / 2;
    // blob centre above the rim; wobbles on two slow sines (volume kept); while it is still rising it is stretched tall
    const w1 = Math.sin(t * 10.2 + 1.1), w2 = Math.sin(t * 8.1), str = 1 + 0.45 * (1 - smooth(u / 0.3)) * (u < 0.5 ? 1 : 0) + 0.45 * (1 - smooth((1 - u) / 0.3)) * (u > 0.5 ? 1 : 0);
    const rr = Rb * Math.cbrt(e), sx = 1 + 0.14 * w1, sz = 1 - 0.1 * w1 + 0.04 * w2, sy = (str) / Math.sqrt(sx * sz) * (1 + 0.1 * w2);
    const cy = rim + rr * sy * 0.55 + H; up.copy(upLocal || V(0, 1, 0));
    blob.position.set(0, 0, 0).addScaledVector(up, cy); blob.scale.set(rr * sx, rr * sy, rr * sz); blob.quaternion.setFromUnitVectors(V(0, 1, 0), up);
    // neck: from the tea surface (or the rim) up to the blob's underside; thins out as the gap grows
    const bottom = cy - rr * sy, from = Math.max(lvl, rim - 0.04), gap = bottom - rim; const nk = e > 0.02 ? 1 - smooth(gap / 0.1) : 0; neck.visible = nk > 0.02 && gap > -rr;
    if (neck.visible) { const len = Math.max(0.005, bottom - from + rr * 0.6), nr = (0.014 + 0.026 * nk) * (0.4 + 0.6 * nk); neck.scale.set(nr, len, nr); neck.position.set(0, 0, 0).addScaledVector(up, from + len / 2); neck.quaternion.copy(blob.quaternion); }
  }
  return { group: g, update };
}
// the numbered ticket (`112`), cartoon size: 0.13 wide x 0.17 tall; held by its two lower side corners
export function makeTicket(parent, text = '112') {
  const g = new THREE.Group(); parent.add(g); g.visible = false;
  const tex = canvasTex(256, 340, (c, w, h) => { c.fillStyle = '#fbf4e2'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8362f'; c.fillRect(0, 0, w, 52); c.fillStyle = '#fff'; c.font = '900 34px UI, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SỐ THỨ TỰ', w / 2, 28);
    c.fillStyle = '#16213f'; let s = 190; for (; s > 60; s -= 6) { c.font = `900 ${s}px Display, sans-serif`; if (c.measureText(text).width < w - 36) break; } c.fillText(text, w / 2, 190); c.fillStyle = '#16213f33'; for (let i = 0; i < 9; i++) c.fillRect(24, 288, 9, 26 - (i % 3) * 5), c.translate(24, 0); });
  const m = mesh(new THREE.PlaneGeometry(0.13, 0.17), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide, emissive: '#fff4d8', emissiveMap: tex, emissiveIntensity: 0.18 }), [0, 0, 0], g, { cast: false }); m.userData.noClip = true;
  return { group: g, size: [0.13, 0.17] };
}
// a money bag: a tan sack with a tied neck and a big đ, cartoon size
export function makeMoneyBag(parent) {
  const g = new THREE.Group(); parent.add(g); g.visible = false;
  const tex = canvasTex(256, 256, (c) => { c.fillStyle = '#d8b66a'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#7a5a1e'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 150px Display, sans-serif'; c.fillText('đ', 128, 136); c.strokeStyle = '#7a5a1e'; c.lineWidth = 7; c.beginPath(); c.moveTo(78, 205); c.lineTo(178, 205); c.stroke(); });
  const sackM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const prof = [[0.001, -0.11], [0.08, -0.105], [0.125, -0.06], [0.14, 0.0], [0.12, 0.06], [0.07, 0.11], [0.03, 0.135], [0.026, 0.15]];
  const sack = mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28), sackM, [0, 0, 0], g); sack.scale.set(1.12, 1, 0.82);
  mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 18), std('#8a2b2b', { roughness: 0.6 }), [0, 0.142, 0], g, { rot: [Math.PI / 2, 0, 0] });
  mesh(new THREE.SphereGeometry(0.036, 14, 10), sackM, [0, 0.2, 0], g, { scale: [1.5, 0.8, 0.6] }); mesh(new THREE.SphereGeometry(0.03, 12, 8), sackM, [0.05, 0.19, 0], g, { rot: [0, 0, -0.6], scale: [1.4, 0.7, 0.6] });
  sack.userData.noClip = true; return { group: g, w: 0.31, h: 0.2 };
}
// the seat belt across Bíp: a flat strap on the egg surface that passes UNDER the chest plate (the spark is never covered); returns the mesh
export function makeBelt(parent) {
  const rad = (y) => y < 0.32 ? 0.168 : y < 0.5 ? 0.166 : y < 0.58 ? 0.158 - (y - 0.5) * 0.4 : 0.126 - (y - 0.58) * 1.2;
  const pts = [], N = 22; for (let i = 0; i <= N; i++) { const u = i / N, y = lerp(0.64, 0.34, u), x = lerp(0.115, -0.15, u), r = rad(y) + 0.008, z = Math.sqrt(Math.max(0.001, r * r - x * x)) * 0.98; pts.push(V(x, y, z)); }
  const pos = [], idx = [], W2 = 0.022; pts.forEach((p, i) => { const tg = pts[Math.min(i + 1, N)].clone().sub(pts[Math.max(i - 1, 0)]).normalize(), nr = V(p.x, 0, p.z).normalize(), side = new THREE.Vector3().crossVectors(tg, nr).normalize();
    for (const s of [-1, 1]) { const q = p.clone().addScaledVector(side, s * W2); pos.push(q.x, q.y, q.z); } if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#23222d', roughness: 0.8, side: THREE.DoubleSide })); m.castShadow = false; m.userData.noOutline = true; m.userData.noClip = true; m.visible = false; parent.add(m); return m;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// A bare test set (look tests only): dusk sky, wet-looking dark road with a dashed centre line, one hero car, two police cars, a bench.
// Registered by the demos:  import { registerCarTest } from '../packs/trada/gta_cars.js'; registerCarTest(PACKS);  then  set: 'gta_cars_test'.
// setOpts: { cars: ['hero', 'p1', 'p2'] (which to build), hero: { at, yaw, color }, p1: {...}, p2: {...}, riders: false (no glue) }
export function buildCarTest(scene, so = {}) {
  const g = new THREE.Group(); scene.add(g); const road = new THREE.Group(); g.add(road);
  const gm = std('#2a2740', { roughness: 0.45, metalness: 0.15 });
  if (so.gap) { const [z0, z1] = so.gap; for (const [za, zb] of [[-400, z0], [z1, 400]]) { mesh(new THREE.BoxGeometry(400, 1.0, zb - za), gm, [0, -0.5, (za + zb) / 2], g, { cast: false }); }   // a gap in the road (the drawbridge look test); the road does not follow the car then
    mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#1f7f93', roughness: 0.3, emissive: '#0a3a48', emissiveIntensity: 0.6 }), [0, -3.6, (z0 + z1) / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
    for (const z of [z0, z1]) for (let i = -8; i < 8; i++) mesh(new THREE.BoxGeometry(0.9, 0.05, 0.4), std(i % 2 ? '#f2c230' : '#1b1a26', { roughness: 0.6 }), [i * 0.9 + 0.45, 0.01, z + (z === z0 ? -0.25 : 0.25)], g, { cast: false }); }
  else mesh(new THREE.PlaneGeometry(400, 400), gm, [0, 0, 0], road, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  const line = std('#e8e0d0', { roughness: 0.6, emissive: '#403a30', emissiveIntensity: 0.5 }); const edgeM = std('#bfc0d0', { roughness: 0.6 }); for (let i = -40; i < 40; i++) { if (so.gap && i * 4 > so.gap[0] - 2 && i * 4 < so.gap[1] + 2) continue; mesh(new THREE.BoxGeometry(0.16, 0.01, 1.6), line, [0, 0.006, i * 4], road, { cast: false }); mesh(new THREE.BoxGeometry(0.12, 0.01, 4), edgeM, [6.2, 0.006, i * 4 + 1], road, { cast: false }); mesh(new THREE.BoxGeometry(0.12, 0.01, 4), edgeM, [-6.2, 0.006, i * 4 + 1], road, { cast: false }); }
  for (let i = -12; i < 12; i++) for (const s of [-1, 1]) { const x = s * 9.5, z = i * 12; mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.4, 10), std('#3a3558', { roughness: 0.6 }), [x, 2.7, z], road); mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.3), toneMapped: false }), [x - s * 0.5, 5.4, z], road, { cast: false }); }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 14), new THREE.MeshBasicMaterial({ map: canvasTex(8, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a2766'); gr.addColorStop(0.35, '#a3489a'); gr.addColorStop(0.5, '#ff7fa8'); gr.addColorStop(0.62, '#ffb48a'); gr.addColorStop(0.7, '#2b6e86'); gr.addColorStop(1, '#183a4a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }), side: THREE.BackSide, fog: false, toneMapped: false })); g.add(sky); sky.frustumCulled = false;
  const bench = new THREE.Group(); bench.position.set(7.0, 0, 1.0); g.add(bench); mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), std('#8a5a30', { roughness: 0.8 }), [0, 0.42, 0], bench); mesh(new THREE.BoxGeometry(1.5, 0.4, 0.06), std('#8a5a30', { roughness: 0.8 }), [0, 0.7, -0.22], bench); for (const x of [-0.65, 0.65]) mesh(new THREE.BoxGeometry(0.08, 0.42, 0.45), std('#3a3558', { roughness: 0.8 }), [x, 0.21, 0], bench);
  const want = so.cars || ['hero', 'p1', 'p2'], cars = {};
  if (want.includes('hero')) cars.hero = buildCar(g, { kind: 'hero', prefix: '', at: [0, 0], ...(so.hero || {}) });
  if (want.includes('p1')) cars.p1 = buildCar(g, { kind: 'police', prefix: 'p1', at: [-1.9, -9], name: 'p1', ...(so.p1 || {}) });
  if (want.includes('p2')) cars.p2 = buildCar(g, { kind: 'police', prefix: 'p2', at: [1.9, -13], name: 'p2', ...(so.p2 || {}) });
  const seats = { teo: { pos: [-0.34 - 0, 0.24, -0.12], yaw: 0.14 }, bip: { pos: [0.34, 0.24, -0.12], yaw: -0.14 } };
  let rigRef = null; const PRE = { key: [0, 0, [-1.6, 2.8, 2.4]], rim: [0, 0, [1.9, 2.4, -1.7]], kick: [0, 0, [-2.2, 1.9, -1.2]] };
  return { group: g, light: 'dusk_street', lightAt: [0, 0.8, 0], seats, cars, bench: { pos: [7.0, 0.0, 1.0] },
    look: { exposure: 1.0, bloom: [0.35, 0.6, 1.0], env: 0.25, grade: { contrast: 1.1, sat: 1.15, vig: 0.35, grain: 0.012, shadowTint: [0.0, 0.012, 0.034], hiTint: [0.02, 0.0, 0.02] } },
    tune(l) { rigRef = l; l.key.angle = 0.75; l.key.penumbra = 1; l.rim.angle = 0.9; l.kick.angle = 0.9; },
    update(t, fx = {}) { for (const k in cars) cars[k].update(t, fx); const h = cars.hero || cars.p1; if (h) { const hp = h.group.position; road.position.z = so.gap ? 0 : Math.round(hp.z / 48) * 48; sky.position.set(hp.x, 0, hp.z); } if (rigRef && cars.hero) followLights(rigRef, PRE, cars.hero); },
  };
}
export function registerCarTest(PACKS) { PACKS.trada.sets.gta_cars_test = buildCarTest; }

// ---------------------------------------------------------------------------------------------------------------------------------
// path helpers (an fx is a smooth ramp between two acts; a long drive is sampled every `dt` s and joined with straight ramps, ease 'lin', so the speed never stops)
// fxCurve('hero.key', fn, t0, t1, dt) -> acts for 'set': fn(t) = the value of that fx at t.
export function fxCurve(key, fn, t0, t1, dt = 0.2, who = 'set') { const a = []; for (let t = t0; t <= t1 + 1e-6; t += dt) a.push({ t: +t.toFixed(4), who, fx: { [key]: +fn(t).toFixed(5) }, d: t === t0 ? 0.01 : dt, ease: 'lin' }); return a; }
// driveActs(prefix, { t0, t1, speed(t) m/s, yaw(t) rad (heading change, + towards +x), x0, z0, dt }) -> acts: tx tz tyaw (integrated path), steer, lean, squat (from the yaw rate and the acceleration)
export function driveActs(prefix, { t0, t1, speed, yaw = () => 0, x0 = 0, z0 = 0, yaw0 = 0, dt = 0.2, steerK = 2.2, delay = 0 }) {
  const sub = 20, pts = []; let x = x0, z = z0; for (let t = t0; t <= t1 + 1e-6; t += dt / sub) { const k = Math.round((t - t0) / (dt / sub)); if (k % sub === 0) pts.push({ t, x, z }); const v = speed(t), y = yaw(t) + yaw0; x += Math.sin(y) * v * dt / sub; z += Math.cos(y) * v * dt / sub; }
  const acts = [], P = prefix; pts.forEach(({ t, x, z }, i) => { const e = 0.05, rate = (yaw(t + e) - yaw(t - e)) / (2 * e), acc = (speed(t + e) - speed(t - e)) / (2 * e), v = speed(t), d = i === 0 ? 0.01 : dt;
    acts.push({ t: +(t + delay).toFixed(4), who: 'set', ease: 'lin', d, fx: { [P + 'tx']: +x.toFixed(4), [P + 'tz']: +z.toFixed(4), [P + 'tyaw']: +yaw(t).toFixed(5), [P + 'steer']: +clamp(rate * steerK, -1, 1).toFixed(4), [P + 'lean']: +(-0.05 * clamp(rate * v / 6, -1.2, 1.2)).toFixed(4), [P + 'squat']: +(-clamp(acc / 6, -1, 1)).toFixed(4) } }); }); return acts;
}
