// Trà đá với AI, special "Tèo vào GTA 6" part 3 (gta6p3 "Tèo tán gái bằng ca nô?", 20/11): the SEA place of the composite set `gta` (origin x +2000).
// It is the P1 / P2 beach road (`buildGtaRoad`, called again at this origin) plus: a sunset sea with moving waves, a wooden pier (cầu tàu) joined to the road's promenade, a bridge with columns over the water,
// an ice-cream stand and palm pots on the promenade, two jet skis (white / orange; black with a gold-chain logo), a yellow duck float on a tow rope, the black tow truck THU MUA XE with a crane, a thrown iron hook,
// the red safety cord, spray, wake and splashes. Built only when an episode asks (setOpts.sea or a place 'sea'): every older episode is untouched.
// Law of the file: a pure function of t (no state, no randomness): vehicles follow ANALYTIC paths given by the episode (`setOpts.sea.paths`), riders are glued to seats by name, events are absolute times (`ev`).
// Frame: place-local metres (the composite adds x +2000). The road runs along z (hero lane x 2.75, heading -z), the promenade x -18.6..-6.6, sand to x -27.5, the sea at x < -27.5.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, smooth, hash, noise1, canvasTex, grain, std, mesh, box, cyl, ball } from '../../core/util.js';
import { buildGtaRoad, addPalm, finishPalms, deco_lamp } from './gta_world.js';   // (a module cycle: only used at call time)
import { addMat, mergeList, xf, FONT } from './gta_bank.js';
import { SEA_CHARS } from './gta_sea_people.js';
export { SEA_CHARS };

const TAU = Math.PI * 2, V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rb = (w, h, d, r, mat, pos, parent, o = {}) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)), mat, pos, parent, o);
const paintM = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.3, ...o });
const glowT = () => canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 2, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
const cgeo = (g, col) => { const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const GOLD = '#ffc43a', NO_CLIP = (o) => { o.userData.noClip = true; return o; };

// ---------------------------------------------------------------------------------------------------------------------------------------
// the water: height of the sea surface at a place-local point (sum of four slow sines; amplitude fades to 0 on the shore)
// ---------------------------------------------------------------------------------------------------------------------------------------
const WAVES = [[0.98, 0.2, 0.15, 24.0, 0.8], [0.9, 0.45, 0.09, 14.0, 1.2], [0.35, 1.0, 0.05, 8.5, 1.7], [-0.55, 0.85, 0.03, 5.8, 2.2]];   // dir x, dir z, amplitude, wavelength, speed (rad)
const SHORE = -27.5, SEA_Y = -0.3;
export function waveH(x, z, t) {
  const sc = smooth((SHORE - x) / 7); let h = 0; for (const [dx, dz, a, L, sp] of WAVES) { const k = TAU / L; h += a * Math.sin(k * (dx * x + dz * z) - sp * t); } return SEA_Y + sc * h;
}
export function waveGrad(x, z, t) {   // d h / dx, d h / dz
  const sc = smooth((SHORE - x) / 7); let gx = 0, gz = 0; for (const [dx, dz, a, L, sp] of WAVES) { const k = TAU / L, c = a * k * Math.cos(k * (dx * x + dz * z) - sp * t); gx += c * dx; gz += c * dz; } return [sc * gx, sc * gz];
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// paths: keyPath([[t, x, z], ...]) = a smooth (Catmull-Rom in time) path; returns f(t) -> { x, z, yaw, vx, vz, speed, bank }; yaw 0 = +z. Outside the keys it holds the first / last point and the last heading.
// ---------------------------------------------------------------------------------------------------------------------------------------
export function keyPath(keys, { bankK = 0.55, bankMax = 0.5, y = 0 } = {}) {
  const K = keys.map((k) => ({ t: k[0], x: k[1], z: k[2], yaw: k[3] })), n = K.length;
  const pos = (t) => { if (t <= K[0].t) return [K[0].x, K[0].z]; if (t >= K[n - 1].t) return [K[n - 1].x, K[n - 1].z]; let i = 0; while (i + 1 < n && K[i + 1].t <= t) i++;
    const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(n - 1, i + 2)], u = (t - b.t) / (c.t - b.t), u2 = u * u, u3 = u2 * u, h = (p0, p1, p2, p3, t0, t1, t2, t3) => { const m1 = i === 0 ? 0 : (p2 - p0) / (t2 - t0) * (t2 - t1), m2 = i + 1 === n - 1 ? 0 : (p3 - p1) / (t3 - t1) * (t2 - t1); /* rest at both ends */ return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2; };
    return [h(a.x, b.x, c.x, d.x, a.t, b.t, c.t, d.t), h(a.z, b.z, c.z, d.z, a.t, b.t, c.t, d.t)]; };
  let lastYaw = 0; { const [x0, z0] = pos(K[n - 1].t - 0.1), [x1, z1] = pos(K[n - 1].t); lastYaw = Math.atan2(x1 - x0, z1 - z0); }
  const head = (t) => { const e = 0.04, [xa, za] = pos(t - e), [xb, zb] = pos(t + e), dx = xb - xa, dz = zb - za; return Math.hypot(dx, dz) < 1e-4 ? null : Math.atan2(dx, dz); };
  let firstYaw = head(K[0].t + 0.05); if (firstYaw == null) firstYaw = 0;
  const yawAt = (t) => { if (t >= K[n - 1].t) return K[n - 1].yaw ?? lastYaw; if (t <= K[0].t) return K[0].yaw ?? firstYaw; return head(t) ?? 0; };
  const f = (t) => { const [x, z] = pos(t), e = 0.05, [xa, za] = pos(t - e), [xb, zb] = pos(t + e), vx = (xb - xa) / (2 * e), vz = (zb - za) / (2 * e), speed = Math.hypot(vx, vz);
    const y0 = yawAt(t), yp = yawAt(t - 0.12), yn = yawAt(t + 0.12), dy = ((yn - yp + Math.PI) % TAU + TAU) % TAU - Math.PI, rate = dy / 0.24;
    return { x, z, yaw: y0, vx, vz, speed, bank: clamp(-rate * bankK * Math.min(1, speed / 6), -bankMax, bankMax), y }; };
  return f;
}
// routePath(pts, sOf): drive along a dense polyline of [x, z] points; sOf(t) = distance travelled along it at time t (so a speed law is just a function). Returns f(t) like keyPath.
export function routePath(pts, sOf, { bankK = 0.5, bankMax = 0.45, y = 0 } = {}) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const LEN = cum[cum.length - 1];
  const at = (s) => { s = clamp(s, 0, LEN); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const u = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]); return [lerp(pts[lo][0], pts[hi][0], u), lerp(pts[lo][1], pts[hi][1], u)]; };
  const yawAt = (s) => { const a = at(s - 0.5), b = at(s + 0.5); return Math.atan2(b[0] - a[0], b[1] - a[1]); };
  const f = (t) => { const s = sOf(t), [x, z] = at(s), e = 0.05, v = Math.abs(sOf(t + e) - sOf(t - e)) / (2 * e), yaw = yawAt(s), yp = yawAt(sOf(t - 0.12)), yn = yawAt(sOf(t + 0.12)), dy = ((yn - yp + Math.PI) % TAU + TAU) % TAU - Math.PI, rate = dy / 0.24;
    return { x, z, yaw, speed: v, bank: clamp(-rate * bankK * Math.min(1, v / 6), -bankMax, bankMax), y, s }; };
  f.len = LEN; return f;
}
export const lineTo = (a, b, step = 0.5) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); return Array.from({ length: n + 1 }, (_, i) => [lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]); };
export const arcPts = (cx, cz, r, a0, a1, step = 0.4) => { const n = Math.max(2, Math.round(Math.abs(a1 - a0) * r / step)); return Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n); return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; }); };
// s(t) from keys [[t, s], ...]: smooth (zero speed at each key) between keys, held outside
export const sKeys = (keys) => (t) => { if (t <= keys[0][0]) return keys[0][1]; const n = keys.length; if (t >= keys[n - 1][0]) return keys[n - 1][1]; let i = 0; while (keys[i + 1][0] <= t) i++; const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); return lerp(keys[i][1], keys[i + 1][1], smooth(u)); };
// a drive for the hero car / police: the path function -> the fx numbers of buildCar (see ENGINE "GTA cars"), in place-local metres (tx tz = position, tyaw = heading, steer from the turn rate, wheels from the arc length)
export function carFxFrom(f, pre = '', { arc0 = 0, dt = 0.05, extra = null } = {}) {
  return (t) => { const p = f(t), e = 0.1, q = f(t - e), r = f(t + e), dy = ((r.yaw - q.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI, rate = dy / (2 * e);
    let arc = 0; const t0 = t - arc0; for (let s = Math.min(t0, 0); s < 0; s += 0) break; arc = carArc(f, t);
    const hy = Math.hypot(p.x, p.z), o = { [pre + 'tx']: p.x, [pre + 'tz']: p.z, [pre + 'tyaw']: p.yaw, [pre + 'steer']: clamp(rate * 0.45, -1, 1), [pre + 'lean']: clamp(-rate * 0.03, -0.1, 0.1), [pre + 'wheels']: (arc - hy) / 0.33 };
    return extra ? { ...o, ...extra(t, p) } : o; };
}
const _arcCache = new WeakMap();
export function carArc(f, t) { // arc length since the first key (summed on a 0.1 s grid, cached per path function)
  let c = _arcCache.get(f); if (!c) { c = { a: [0], t0: -2 }; _arcCache.set(f, c); }
  const i = Math.floor((t - c.t0) / 0.1); if (i < 0) return 0; while (c.a.length <= i + 1) { const k = c.a.length - 1, p = f(c.t0 + k * 0.1), q = f(c.t0 + (k + 1) * 0.1); c.a.push(c.a[k] + Math.hypot(q.x - p.x, q.z - p.z)); }
  const u = (t - c.t0) / 0.1 - i; return c.a[i] + (c.a[i + 1] - c.a[i]) * u;
}

// a rope of cylinders along a sagging curve (set(a, b, slack): a, b world-or-parent points; slack 0..1 = how much it hangs)
function makeRope(parent, n = 14, r = 0.022, color = '#e8dcc0') {
  const g = new THREE.Group(); parent.add(g); const m = std(color, { roughness: 0.8 }), segs = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 6), m); s.castShadow = false; g.add(s); segs.push(s); }
  const up = V3(0, 1, 0), d = V3(), q = new THREE.Quaternion();
  return { group: g, set(a, b, slack = 0.15, waterY = null) { const L = a.distanceTo(b), sag = L * slack * 0.25; let prev = a.clone(); for (let i = 0; i < n; i++) { const u = (i + 1) / n, p = a.clone().lerp(b, u); p.y -= sag * 4 * u * (1 - u); if (waterY != null && p.y < waterY) p.y = waterY;
      d.copy(p).sub(prev); const l = d.length(); segs[i].position.copy(prev).addScaledVector(d, 0.5); segs[i].scale.set(1, Math.max(1e-3, l), 1); if (l > 1e-5) segs[i].quaternion.copy(q.setFromUnitVectors(up, d.divideScalar(l))); prev = p; } g.visible = true; }, hide() { g.visible = false; } };
}
// soft white foam / spray textures
const foamTex = () => canvasTex(64, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const gx = c.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = gx; c.fillRect(0, 0, w, h); });

// ---------------------------------------------------------------------------------------------------------------------------------------
// vehicles
// ---------------------------------------------------------------------------------------------------------------------------------------
// JET SKI (+z forward, +x right, origin on the waterline mid-hull). opts: { kind: 'white' | 'black' }
// seats (vehicle frame, root of a SEATED character = the floor under the seat): driver [0, 0.34, -0.22], pass [0, 0.40, -0.92]
export const SKI_SEATS = { driver: { pos: [0, 0.33, -0.2], yaw: 0 }, pass: { pos: [0, 0.38, -0.78], yaw: 0 } };
function buildSki(parent, { kind = 'white' } = {}) {
  const BLK = kind === 'black', g = new THREE.Group(); g.name = 'ski_' + kind; parent.add(g); const body = new THREE.Group(); g.add(body);
  const hullM = paintM(BLK ? '#16141c' : '#f4f1ea'), stripeM = paintM(BLK ? '#ffc43a' : '#ff7a1a'), darkM = std('#1b1a24', { roughness: 0.6 }), seatM = std(BLK ? '#2a1c10' : '#2a2540', { roughness: 0.8 }), chromeM = new THREE.MeshStandardMaterial({ color: '#d6dae0', roughness: 0.28, metalness: 0.7 });
  rb(1.0, 0.34, 2.7, 0.17, hullM, [0, 0.1, -0.15], body);                                             // main hull
  rb(0.86, 0.3, 1.2, 0.15, hullM, [0, 0.17, 1.15], body, { rot: [-0.18, 0, 0] });                        // bow, rising
  rb(1.02, 0.07, 3.3, 0.03, stripeM, [0, 0.19, 0.0], body);                                              // side stripe (seen from the sides: a belt)
  rb(0.62, 0.2, 1.5, 0.1, hullM, [0, 0.27, -0.88], body);                                               // seat base (low: the riders' feet and thighs rest above it)
  rb(0.5, 0.22, 0.85, 0.1, seatM, [0, 0.5, -0.42], body); rb(0.48, 0.26, 0.7, 0.1, seatM, [0, 0.54, -0.95], body);   // two seat humps (driver, passenger)
  rb(0.95, 0.06, 0.6, 0.03, stripeM, [0, 0.14, -1.6], body);                                              // boarding platform
  rb(0.5, 0.2, 0.9, 0.09, stripeM, [0, 0.4, 0.95], body, { rot: [-0.1, 0, 0] });                         // front cowl (the colour)
  // steering column, handlebar, dash pod with the gauge and the key slot
  cyl(0.032, 0.04, 0.5, chromeM, [0, 0.66, 0.5], body, { rot: [0.35, 0, 0] }); const bar = cyl(0.02, 0.02, 0.8, darkM, [0, 0.92, 0.42], body, { rot: [0, 0, Math.PI / 2] }); bar.name = 'handlebar';
  for (const s of [-1, 1]) { cyl(0.028, 0.028, 0.14, std('#e8e4dc'), [s * 0.4, 0.92, 0.42], body, { rot: [0, 0, Math.PI / 2] }); }
  rb(0.42, 0.14, 0.3, 0.06, darkM, [0, 0.72, 0.62], body, { rot: [0.25, 0, 0] });
  const gaugeT = canvasTex(128, 128, (c) => { c.fillStyle = '#10131c'; c.beginPath(); c.arc(64, 64, 62, 0, TAU); c.fill(); c.strokeStyle = '#e8ecf4'; c.lineWidth = 5; c.beginPath(); c.arc(64, 64, 52, 0, TAU); c.stroke(); c.strokeStyle = '#ffc43a'; c.lineWidth = 4; for (let i = 0; i <= 8; i++) { const a = 2.35 + i * 0.5; c.beginPath(); c.moveTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40); c.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); c.stroke(); } c.fillStyle = '#ff4d4d'; c.font = FONT(18); c.textAlign = 'center'; c.fillText('RPM', 64, 100); });
  const gauge = new THREE.Group(); gauge.position.set(0, 0.8, 0.5); gauge.rotation.x = -0.45; body.add(gauge);   // faces the rider (-z)
  mesh(new THREE.CircleGeometry(0.085, 28), new THREE.MeshBasicMaterial({ map: gaugeT, toneMapped: false }), [0, 0, 0], gauge, { cast: false, rot: [0, Math.PI, 0] });
  const needle = new THREE.Group(); needle.position.set(0, 0, -0.004); gauge.add(needle); mesh(new THREE.BoxGeometry(0.008, 0.062, 0.004), new THREE.MeshBasicMaterial({ color: '#ff3b30', toneMapped: false }), [0, 0.031, 0], needle, { cast: false });
  const keyM = std('#0d0d12', { roughness: 0.5 }); const slotPos = V3(0.15, 0.835, 0.42); cyl(0.034, 0.034, 0.03, keyM, slotPos.toArray(), body, { rot: [0.5, 0, 0] });   // the key slot (right of the gauge)
  mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 20), new THREE.MeshStandardMaterial({ color: '#ffb040', emissive: '#ff9a20', emissiveIntensity: 1.6 }), slotPos.toArray(), body, { cast: false, rot: [0.5 + Math.PI / 2, 0, 0] });   // a bright ring round the key slot so it reads
  const plug = new THREE.Group(); plug.position.copy(slotPos); body.add(plug); cyl(0.024, 0.024, 0.06, new THREE.MeshStandardMaterial({ color: '#e8231f', emissive: '#c01010', emissiveIntensity: 1.2, roughness: 0.5 }), [0, 0.025, 0], plug, { rot: [0.5, 0, 0], cast: false }); ball(0.026, new THREE.MeshStandardMaterial({ color: '#ff5a40', emissive: '#d02010', emissiveIntensity: 1.2 }), [0, 0.06, 0.03], plug, { cast: false }, 10);
  // windscreen + headlight (the light that goes off with the engine)
  // (no windscreen: it only got between the camera and the dash)
  const headM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.2, 2.8), toneMapped: false }); for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.09, 16, 10), headM, [s * 0.2, 0.5, 1.66], body, { cast: false, scale: [1, 0.7, 0.6] });
  const glowM = addMat(glowT(), '#ffe8c0', 0.5), glowPl = [-1, 1].map((s) => { const m = mesh(new THREE.PlaneGeometry(0.9, 0.9), glowM, [s * 0.2, 0.52, 1.75], body, { cast: false, recv: false }); NO_CLIP(m); return m; });
  // a gold-chain logo on both sides of the black ski (links of a chain), and the big letters on the white one
  const logoT = canvasTex(256, 128, (c, w, h) => { c.fillStyle = BLK ? '#16141c' : '#f4f1ea'; c.fillRect(0, 0, w, h); if (BLK) { c.strokeStyle = '#ffc43a'; c.lineWidth = 11; for (let i = 0; i < 7; i++) { const x = 30 + i * 33, y = 64 + Math.sin(i * 0.9) * 22; c.beginPath(); c.ellipse(x, y, 20, 12, i % 2 ? 0.6 : -0.6, 0, TAU); c.stroke(); } } else { c.fillStyle = '#ff7a1a'; c.font = FONT(58); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SEA·01', w / 2, h / 2); } });
  for (const s of [-1, 1]) { const lg = mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshStandardMaterial({ map: logoT, roughness: 0.4, emissive: '#fff', emissiveMap: logoT, emissiveIntensity: 0.22 }), [s * 0.52, 0.2, 0.15], body, { cast: false, rot: [0, s * Math.PI / 2, 0] }); NO_CLIP(lg); }
  // spray + wake (additive, own frame): the wake is two long soft strips trailing from the stern, spray = white spheres on slow cycles
  const wakeM = addMat(foamTex(), '#ffffff', 0.7), wakes = [-1, 1].map((s) => { const w = mesh(new THREE.PlaneGeometry(1.2, 14), wakeM.clone(), [s * 0.9, 0.03, -9], g, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }); w.userData.noClip = true; w.renderOrder = 2; return w; });
  const SP = 56, spM = new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), sG = new THREE.SphereGeometry(1, 8, 6), spr = [];
  for (let i = 0; i < SP; i++) { const s = new THREE.Mesh(sG, spM.clone()); s.castShadow = false; s.userData.noClip = true; g.add(s); spr.push(s); }
  g.traverse((o) => { if (o.isMesh) o.userData.noClip = true; });   // a moving hull is not a static solid for clipcheck (it reads boxes once): the riders sit on seats by design
  return { group: g, body, needle, plug, headM, glowPl, wakes, spr, slotPos, bar, kind };
}

// the yellow duck float (a rubber duck you can sit on; one rider seat on its back)
export const DUCK_SEAT = { pos: [0, 0.5, -0.1], yaw: 0 };
export function buildDuck(parent) {
  const g = new THREE.Group(); g.name = 'duck'; parent.add(g); const body = new THREE.Group(); g.add(body); const Y = std('#ffd21f', { roughness: 0.42 }), O = std('#ff8a1a', { roughness: 0.5 });
  mesh(new THREE.SphereGeometry(0.78, 28, 20), Y, [0, 0.28, -0.05], body, { scale: [0.82, 0.62, 1.12] });                 // the body (a fat float)
  mesh(new THREE.SphereGeometry(0.4, 22, 16), Y, [0, 1.0, 0.62], body, { scale: [0.9, 1, 0.95] });                         // the head
  mesh(new THREE.SphereGeometry(0.2, 14, 10), O, [0, 0.96, 1.02], body, { scale: [1.5, 0.55, 1.35] });                      // the beak
  for (const s of [-1, 1]) { ball(0.06, std('#12131a'), [s * 0.17, 1.1, 0.95], body, { cast: false }, 10); mesh(new THREE.SphereGeometry(0.4, 14, 10), Y, [s * 0.62, 0.42, -0.3], body, { scale: [0.2, 0.34, 0.66], rot: [0.2, s * 0.15, 0] }); }   // eyes, wings
  mesh(new THREE.SphereGeometry(0.26, 12, 10), Y, [0, 0.6, -1.0], body, { scale: [0.7, 0.6, 1.0], rot: [-0.5, 0, 0] });      // the tail
  mesh(new THREE.TorusGeometry(0.62, 0.07, 10, 28), std('#e03a4a', { roughness: 0.5 }), [0, 0.52, -0.1], body, { rot: [Math.PI / 2, 0, 0], scale: [0.88, 1.18, 1] });    // a red grab ring round the seat
  return { group: g, body, tow: V3(0, 0.3, 1.0) };
}

// the black tow truck THU MUA XE (+z forward). Seat (driver, left): [-0.55, 1.02, 1.5]. The crane is at the REAR and reaches back.
export const TRUCK_SEAT = { pos: [-0.55, 0.53, 1.55], yaw: 0 };
function buildTruck(parent) {
  const g = new THREE.Group(); g.name = 'truck'; parent.add(g); const chassis = new THREE.Group(); g.add(chassis);
  const blk = paintM('#15131b'), dk = std('#0d0c12', { roughness: 0.7 }), gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 0.8 }), glassM = new THREE.MeshPhysicalMaterial({ color: '#bfeaff', transparent: true, opacity: 0.18, roughness: 0.04, side: THREE.DoubleSide });
  rb(2.2, 0.5, 6.1, 0.18, blk, [0, 0.62, 0], chassis);                                                            // chassis + bed
  rb(2.15, 0.14, 3.3, 0.04, std('#2a2833', { roughness: 0.6 }), [0, 0.95, -1.35], chassis);                          // the flatbed deck
  rb(2.2, 0.5, 1.7, 0.16, blk, [0, 0.88, 1.5], chassis); rb(2.1, 0.75, 1.0, 0.18, blk, [0, 1.0, 2.6], chassis);   // cab lower (doors up to the belt line y 1.13: the driver's head is above it) + the bonnet
  for (const [x, z] of [[-1.0, 0.75], [1.0, 0.75], [-0.98, 2.15], [0.98, 2.15]]) rb(0.1, 1.25, 0.1, 0.03, blk, [x, 1.75, z], chassis);   // cab upper: four pillars + a roof (open on the driver's side)
  rb(2.2, 0.1, 1.6, 0.05, blk, [0, 2.38, 1.45], chassis);
  rb(2.2, 0.1, 1.5, 0.05, gold, [0, 2.42, 1.45], chassis);                                                        // a gold roof line
  rb(2.22, 0.5, 0.2, 0.08, std('#cfd3da', { metalness: 0.6, roughness: 0.3 }), [0, 0.5, 3.1], chassis);            // front bumper
  mesh(new THREE.PlaneGeometry(1.9, 1.2), glassM, [0, 1.75, 2.17], chassis, { cast: false, rot: [-0.2, 0, 0] });   // windscreen
  mesh(new THREE.PlaneGeometry(1.3, 1.2), glassM, [1.06, 1.75, 1.45], chassis, { cast: false, rot: [0, Math.PI / 2, 0] });
  // the seat inside the cab (so the driver does not float)
  rb(0.6, 0.18, 0.6, 0.06, std('#3a2a1a'), [-0.55, 0.72, 1.55], chassis); rb(0.6, 0.6, 0.12, 0.05, std('#3a2a1a'), [-0.55, 1.05, 1.22], chassis);
  const wh = new THREE.Group(); wh.position.set(-0.28, 1.72, 1.9); wh.rotation.x = -0.4; chassis.add(wh); mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), dk, [0, 0, 0], wh, { cast: false });
  // logo panels on both doors + the flatbed sides: the gold chain and the words
  const lgT = canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#15131b'; c.fillRect(0, 0, w, h); c.strokeStyle = GOLD; c.lineWidth = 14; for (let i = 0; i < 9; i++) { const x = 40 + i * 54, y = 56 + Math.sin(i * 0.9) * 20; c.beginPath(); c.ellipse(x, y, 26, 15, i % 2 ? 0.6 : -0.6, 0, TAU); c.stroke(); } c.fillStyle = GOLD; c.textAlign = 'center'; c.textBaseline = 'middle'; let sz = 110; c.font = FONT(sz); while (c.measureText('THU MUA XE').width > w - 40) c.font = FONT(sz -= 4); c.fillText('THU MUA XE', w / 2, 168); });
  const lgM = new THREE.MeshStandardMaterial({ map: lgT, roughness: 0.5, emissive: '#ffffff', emissiveMap: lgT, emissiveIntensity: 0.3 });
  for (const s of [-1, 1]) { NO_CLIP(mesh(new THREE.PlaneGeometry(1.4, 0.42), lgM, [s * 1.111, 0.88, 1.5], chassis, { cast: false, rot: [0, s * Math.PI / 2, 0] })); NO_CLIP(mesh(new THREE.PlaneGeometry(2.6, 0.55), lgM, [s * 1.083, 1.3, -1.3], chassis, { cast: false, rot: [0, s * Math.PI / 2, 0] })); }
  // beacon on the cab roof (a slow amber swing, never a blink)
  const beM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.2), toneMapped: false }); mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 12), beM, [0.6, 2.54, 1.0], chassis, { cast: false }); const beG = NO_CLIP(mesh(new THREE.PlaneGeometry(1.4, 1.4), addMat(glowT(), '#ffb040', 0.6), [0.6, 2.58, 1.0], chassis, { cast: false, recv: false }));
  // headlights, tail lights, reverse lights
  const hM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.2, 2.8), toneMapped: false }); for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.14, 12, 8), hM, [s * 0.8, 0.8, 3.08], chassis, { cast: false, scale: [1, 1, 0.5] }); mesh(new THREE.BoxGeometry(0.3, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.4, 0.3), toneMapped: false }), [s * 0.8, 0.85, -3.07], chassis, { cast: false }); }
  // wheels: 3 axles (front + two rear)
  const tyreM = std('#17151f', { roughness: 0.85 }), hubM = new THREE.MeshStandardMaterial({ color: '#dfe3ea', roughness: 0.3, metalness: 0.6 }), R = 0.5, wheels = [];
  for (const z of [2.1, -1.5, -2.6]) for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * 1.0, R, z); g.add(piv); const sp = new THREE.Group(); piv.add(sp); mesh(new THREE.CylinderGeometry(R, R, 0.42, 22), tyreM, [0, 0, 0], sp, { rot: [0, 0, Math.PI / 2] }); mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.44, 14), hubM, [0, 0, 0], sp, { rot: [0, 0, Math.PI / 2], cast: false }); mesh(new THREE.BoxGeometry(0.46, 0.08, 0.5), dk, [0, 0.0, 0], sp, { cast: false }); wheels.push(sp); }
  // the CRANE: on the cab roof, the boom reaches forward over the bonnet (fx via ev.liftT0..T1: it rises), a chain hangs from the tip (the sea place hooks it on the car's tail)
  const tur = new THREE.Group(); tur.position.set(0, 2.5, 1.0); chassis.add(tur); rb(0.9, 0.4, 0.9, 0.08, std('#e0a010', { roughness: 0.5 }), [0, 0.15, 0], tur);
  const boom = new THREE.Group(); boom.position.set(0, 0.4, 0); tur.add(boom); const BL = 3.6; rb(0.3, 0.3, BL, 0.06, std('#e0a010', { roughness: 0.5 }), [0, 0, BL / 2], boom); rb(0.22, 0.22, 1.2, 0.05, std('#c88a0c'), [0, 0, BL + 0.2], boom);
  const tip = new THREE.Group(); tip.position.set(0, 0, BL + 0.8); boom.add(tip); ball(0.14, std('#2a2a30', { metalness: 0.6 }), [0, 0, 0], tip, { cast: false }, 10);
  return { group: g, chassis, wheels, boom, tip, beG, beM, BL, tur, R };
}

// the hook: an iron hook with a ring (thrown on a rope)
function buildHook(parent) {
  const g = new THREE.Group(); parent.add(g); const iron = new THREE.MeshStandardMaterial({ color: '#8b93a0', roughness: 0.35, metalness: 0.85 });
  mesh(new THREE.TorusGeometry(0.1, 0.028, 10, 22, Math.PI * 1.45), iron, [0, -0.1, 0], g, { rot: [0, 0, Math.PI * 0.2], cast: false }); mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.3, 8), iron, [0.0, 0.1, 0], g, { cast: false }); mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16), iron, [0, 0.3, 0], g, { cast: false });
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// THE PLACE
// ---------------------------------------------------------------------------------------------------------------------------------------
// setOpts.sea = {
//   paths: { js, bj, tt },            keyPath() functions: white ski, black ski, tow truck (place-local)
//   duckLag: 4.6,                       the duck's rope length (m)
//   ev: { cordPull, dive, hookT0, hookT1, crank: [t, t], liftT0, liftT1, kem, splash0 ... }  absolute times (see below)
//   riders: [{ t, who, on: 'js' | 'bj' | 'duck' | 'tt', seat: 'driver' | 'pass' }]   from t on `who` is glued to that seat (on: null lets go)
//   pier: true (default), bridge: true, stand: true
// }
// fx on 'set': engine (0..1 white ski; default 1 once the ski is shown), blackOn (0..1 shows the black ski), duckOn, truckOn, hookOn (all 0..1 = visible; default hidden), kem 0..1 (the ice-cream stand is hit), cordWrap 0..1 (two red loops on Linh's wrist)
export function buildGtaSea(root, { at = [2000, 0, 0], scene = null, paths = {}, ev = {}, riders = [], duckLag = 4.6, sunDir = [-0.45, 0.07, -0.89], pierZ = -110, stand = true, pier = true, bridge = true, followName = 'teo', skiSpray = null } = {}) {   // skiSpray (gta6p3b gate fix 21/11): { keep, of, op, maxUp } = the ski's spray puffs white, fewer (keep of every `of`), see-through (op) and never higher than maxUp m (off Tèo's face); null = as before
  const SK = skiSpray;
  const R = buildGtaRoad(root, { at, sunDir, railGap: [pierZ + 3.4, pierZ - 3.4] }), g = R.group, S = new THREE.Group(); S.name = 'sea_extras'; g.add(S);
  const road0 = R.update;
  // ---- the water patch with moving waves (vertex colours: deep blue, reflected sunset, sun glints) ----
  const X0 = SHORE, X1 = -210, Z0 = 40, Z1 = -250, CELL = 2.6, NX = Math.round((X0 - X1) / CELL), NZ = Math.round((Z0 - Z1) / CELL);
  const wg = new THREE.PlaneGeometry(X0 - X1, Z0 - Z1, NX, NZ); wg.rotateX(-Math.PI / 2); wg.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2); const wp = wg.attributes.position, wc = new Float32Array(wp.count * 4); wg.setAttribute('color', new THREE.BufferAttribute(wc, 4));
  const water = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, transparent: true, depthWrite: true })); water.castShadow = false; water.receiveShadow = false; water.userData.noClip = true; S.add(water); water.frustumCulled = false;
  const sunV = V3(...sunDir).normalize(), viewV = V3(0.15, 0.36, 1).normalize(), skyLo = new THREE.Color('#e0708a'), skyHi = new THREE.Color('#5a3a92'), deep = new THREE.Color('#0b2a62'), deepB = new THREE.Color('#13417a'), shal = new THREE.Color('#1f8a9c'), glintC = new THREE.Color('#ffd7a0'), tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const nrm = V3(), refl = V3();
  function updateWater(t) {
    for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), z = wp.getZ(i); const h = waveH(x, z, t), [gx, gz] = waveGrad(x, z, t); wp.setY(i, h);
      nrm.set(-gx * 0.7, 1, -gz * 0.7).normalize(); const ndv = Math.max(0, nrm.dot(viewV)), fr = Math.pow(1 - ndv, 3);
      refl.copy(viewV).negate().reflect(nrm); const sky = clamp(refl.y * 2.2), sun = Math.pow(Math.max(0, refl.dot(sunV)), 70), crest = clamp((h - SEA_Y - 0.06) * 5), vary = 0.5 + 0.5 * noise1(x * 0.07 + z * 0.045 + t * 0.05, 3);
      const near = smooth((SHORE - x) / 12); tmp.copy(shal).lerp(deep, near); tmp.lerp(deepB, vary * 0.5 * near); tmp2.copy(skyLo).lerp(skyHi, sky); tmp.lerp(tmp2, clamp(0.04 + fr * 0.4));
      { const gk = sun * 2.0 + crest * 0.1; tmp.r += glintC.r * gk; tmp.g += glintC.g * gk; tmp.b += glintC.b * gk; }
      wc[i * 4] = tmp.r; wc[i * 4 + 1] = tmp.g; wc[i * 4 + 2] = tmp.b; wc[i * 4 + 3] = smooth((x - X1) / 40) * smooth((Z0 - 4 - z) / 6 + 0.4) * smooth((z - Z1) / 40); }
    wp.needsUpdate = true; wg.attributes.color.needsUpdate = true;
  }
  // shore foam: a slow lapping white band at the water's edge
  const lap = mesh(new THREE.PlaneGeometry(1, 270), addMat(foamTex(), '#ffffff', 0.5), [SHORE - 1.0, -0.02, -100], S, { cast: false, recv: false, rot: [-Math.PI / 2, 0, Math.PI / 2] }); lap.renderOrder = 2; lap.scale.set(2.4, 1, 1); NO_CLIP(lap); lap.rotation.z = 0; lap.rotation.x = -Math.PI / 2;
  // ---- the PIER (cầu tàu): a wooden deck on posts from the promenade out to sea, rails, lamps, bollards, a sign ----
  const PX0 = -14, PX1 = -66, PW = 4.8, PY = 0.42, pz = pierZ, wood = std('#8a5a3a', { roughness: 0.85, vertexColors: true }), postM = std('#4a3426', { roughness: 0.9 });
  if (pier) {
    const planks = []; for (let x = PX0 - 0.45; x > PX1; x -= 0.95) planks.push([cgeo(new THREE.BoxGeometry(0.88, 0.07, PW), ['#9a6a44', '#8a5a3a', '#a07048', '#7e5236'][Math.floor(hash(x * 3.7) * 4)]), xf([x, PY - 0.035, pz])]); mergeList(planks, wood, S, { cast: false });
    for (const sz of [-1, 1]) { box(PX0 - PX1 + 0.6, 0.18, 0.2, std('#6b4630'), [(PX0 + PX1) / 2, PY - 0.14, pz + sz * (PW / 2 - 0.1)], S, { cast: false }); }
    box(PX0 - PX1 - 0.4, 0.1, PW - 0.3, std('#5a3a26'), [(PX0 + PX1) / 2 - 0.2, PY - 0.07, pz], S, { cast: false });   // a solid slab under the planks (the ground for the feet)
    const posts = []; for (let x = PX0 - 1; x > PX1; x -= 3.2) for (const sz of [-1, 1]) posts.push([new THREE.CylinderGeometry(0.15, 0.17, 3.0, 8), xf([x, PY - 1.5, pz + sz * (PW / 2 - 0.25)])]); mergeList(posts, postM, S, { cast: false });
    const rails = []; for (let x = PX0 - 1; x > PX1; x -= 3.2) for (const sz of [-1, 1]) rails.push([new THREE.BoxGeometry(0.1, 1.0, 0.1), xf([x, PY + 0.5, pz + sz * (PW / 2 - 0.1)])]); mergeList(rails, std('#f2e6f0'), S, { cast: false });
    for (const sz of [-1, 1]) box(PX0 - PX1 - 1.0, 0.07, 0.09, std('#f2e6f0'), [(PX0 + PX1) / 2 - 0.5, PY + 1.0, pz + sz * (PW / 2 - 0.1)], S, { cast: false });
    for (let x = PX0 - 4; x > PX1 + 3; x -= 9.6) for (const sz of [-1, 1]) { cyl(0.04, 0.05, 2.4, std('#2a2434'), [x, PY + 1.2, pz + sz * (PW / 2 + 0.14)], S, { cast: false }, 8); ball(0.17, new THREE.MeshStandardMaterial({ color: '#000', emissive: sz > 0 ? '#ff9fd0' : '#ffd08a', emissiveIntensity: 3 }), [x, PY + 2.45, pz + sz * (PW / 2 + 0.14)], S, { cast: false }, 12); }
    for (const [x, sz] of [[PX1 + 1.3, -1], [PX1 + 1.3, 1], [PX1 + 4, 1]]) cyl(0.12, 0.15, 0.4, std('#2a2a30', { metalness: 0.5 }), [x, PY + 0.2, pz + sz * (PW / 2 - 0.5)], S, { cast: false }, 10);   // bollards
    // a ramp from the promenade (y 0.01) up to the deck
    box(3.2, 0.12, PW, wood.clone(), [PX0 + 0.8, 0.2, pz], S, { cast: false }).rotation.z = -0.1;
    const signT = canvasTex(512, 160, (c, w, h) => { c.fillStyle = '#173238'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7fe6f2'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = FONT(96); c.fillText('CẦU TÀU', w / 2, h / 2 + 4); });
    NO_CLIP(mesh(new THREE.PlaneGeometry(2.6, 0.81), new THREE.MeshStandardMaterial({ map: signT, roughness: 0.5, emissive: '#fff', emissiveMap: signT, emissiveIntensity: 0.4 }), [PX0 - 1.2, PY + 2.25, pz + PW / 2 - 0.1], S, { cast: false, rot: [0, 0, 0] }));
  }
  // ---- palm pots (terracotta pots with small palms) along the promenade and the pier ----
  { const T = [], Fr = []; const pots = [[-13.2, -44], [-13.2, -64], [-13.2, -80], [-13.2, pierZ + 6], [-13.2, pierZ - 6], [-13.2, -134], [-13.2, -150], [-20, pierZ + PW / 2 + 0.6]];
    for (const [x, z] of pots) { cyl(0.34, 0.26, 0.52, std('#d9684a', { roughness: 0.8 }), [x, 0.26, z], S, { cast: false }, 14); cyl(0.36, 0.36, 0.06, std('#e8826a'), [x, 0.55, z], S, { cast: false }, 14); addPalm(T, Fr, x, z, 2.4 + 0.5 * hash(x + z), z * 0.37, 0.5); }
    for (const x of [PX0 - 30, PX0 - 38, PX0 - 46]) for (const sz of [-1, 1]) { const zz = pz + sz * (PW / 2 - 0.55); cyl(0.3, 0.23, 0.46, std('#d9684a', { roughness: 0.8 }), [x, PY + 0.23, zz], S, { cast: false }, 14); addPalm(T, Fr, x, zz, 2.2, x * 0.7 + sz, PY + 0.46); }
    finishPalms(S, T, Fr); }
  // ---- the ICE-CREAM stand on the promenade: striped awning, a counter, a big cone sign; fx kem 0..1 = a police car hits it (it tips, the scoops fly) ----
  const SX = -12.4, SZ = -62, stand0 = new THREE.Group(); stand0.position.set(SX, 0, SZ); S.add(stand0); const kemG = new THREE.Group(); stand0.add(kemG); const scoops = [];
  if (stand) {
    box(2.4, 0.95, 1.2, std('#ff8ec0'), [0, 0.5, 0], kemG, {}); box(2.5, 0.08, 1.3, std('#ffffff'), [0, 1.0, 0], kemG, {}); box(0.1, 1.7, 0.1, std('#f2e6f0'), [-1.15, 1.85, -0.5], kemG, {}); box(0.1, 1.7, 0.1, std('#f2e6f0'), [1.15, 1.85, -0.5], kemG, {}); box(0.1, 1.7, 0.1, std('#f2e6f0'), [-1.15, 1.85, 0.55], kemG, {}); box(0.1, 1.7, 0.1, std('#f2e6f0'), [1.15, 1.85, 0.55], kemG, {});
    const awT = canvasTex(256, 128, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fff6f0' : '#ff5a8a'; c.fillRect(i * w / 8, 0, w / 8 + 1, h); } });
    mesh(new THREE.PlaneGeometry(2.9, 1.6), new THREE.MeshStandardMaterial({ map: awT, roughness: 0.8, side: THREE.DoubleSide }), [0, 2.75, 0.0], kemG, { rot: [-Math.PI / 2 + 0.28, 0, 0] });
    const kT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ff5a8a'; c.beginPath(); c.roundRect(10, 10, 236, 236, 40); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = FONT(120); c.fillText('KEM', w / 2, 118); c.font = FONT(44); c.fillText('5K', w / 2, 200); });
    NO_CLIP(mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshStandardMaterial({ map: kT, emissive: '#fff', emissiveMap: kT, emissiveIntensity: 0.35, roughness: 0.6 }), [0, 1.65, 0.62], kemG, { cast: false }));
    const cone = new THREE.Group(); cone.position.set(0, 3.0, 0); kemG.add(cone); mesh(new THREE.ConeGeometry(0.28, 0.7, 12), std('#e8b46a', { roughness: 0.8 }), [0, -0.1, 0], cone, { rot: [Math.PI, 0, 0] }); ball(0.3, std('#ffd3e6'), [0, 0.36, 0], cone, {}, 14); ball(0.22, std('#9ff0e0'), [0, 0.7, 0], cone, {}, 12);
    for (let i = 0; i < 9; i++) { const s = ball(0.14, std(['#ffd3e6', '#9ff0e0', '#fff0a0', '#ffb08a', '#cdb8f0'][i % 5]), [0, 0, 0], S, { cast: false }, 10); const c2 = mesh(new THREE.ConeGeometry(0.1, 0.24, 8), std('#e8b46a'), [0, -0.2, 0], s, { rot: [Math.PI, 0, 0], cast: false }); scoops.push(s); void c2; }
  }
  // ---- the BRIDGE with columns over the water (parallel to the shore, deck 6 m up), a lamp row, red warning lights on the columns ----
  const BX = -96, BY = 6.4;
  if (bridge) {
    const bz0 = 50, bz1 = -250; box(10, 0.9, bz0 - bz1, std('#5a4c70', { roughness: 0.7, emissive: '#4a3a70', emissiveIntensity: 0.9 }), [BX, BY, (bz0 + bz1) / 2], S, { cast: false }); for (let z = 40; z > -250; z -= 9) for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.2, 0.06, 2.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(sx > 0 ? 1.0 : 3.0, sx > 0 ? 2.2 : 0.6, sx > 0 ? 3.0 : 1.6), toneMapped: false }), [BX + sx * 3.3, BY - 0.48, z], S, { cast: false }); box(10.4, 0.16, bz0 - bz1, std('#e8d0e0'), [BX, BY + 0.5, (bz0 + bz1) / 2], S, { cast: false });
    for (const sx of [-1, 1]) box(0.25, 0.9, bz0 - bz1, std('#f2e6f0'), [BX + sx * 5.0, BY + 1.0, (bz0 + bz1) / 2], S, { cast: false });
    for (let z = bz0 - 6; z > bz1; z -= 13) for (const sx of [-1, 1]) { cyl(0.55, 0.7, BY + 3.0, std('#6a5a82', { roughness: 0.8 }), [BX + sx * 3.3, (BY - 3.0) / 2 + 0.3, z], S, { cast: false }, 12); }
    for (let z = bz0 - 6; z > bz1; z -= 26) ball(0.22, new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff3a3a', emissiveIntensity: 3 }), [BX + 5.0, BY + 1.7, z], S, { cast: false }, 10);
    // a traffic camera on the underside (the one that flashes: gta6p3 "chớp tách")
    const cam = new THREE.Group(); cam.position.set(BX + 1.5, BY - 0.5, pierZ - 5); S.add(cam); box(0.5, 0.35, 0.7, std('#2a2a34'), [0, -0.2, 0], cam, { cast: false }); ball(0.12, std('#10131c'), [0, -0.2, 0.36], cam, { cast: false }, 10);
  }
  // ---- vehicles ----
  const skiW = buildSki(S, { kind: 'white' }), skiB = buildSki(S, { kind: 'black' }), duck = buildDuck(S), truck = buildTruck(S), hook = buildHook(S);
  const ropeD = makeRope(S, 16, 0.025, '#f2e8d0'), ropeH = makeRope(S, 20, 0.03, '#d8c9a0'), cordR = makeRope(S, 14, 0.02, '#ff2a1c'), chainR = makeRope(S, 12, 0.03, '#9aa2ae');
  const wrapG = new THREE.Group(); S.add(wrapG); for (let i = 0; i < 2; i++) mesh(new THREE.TorusGeometry(0.052 + i * 0.006, 0.01, 6, 16), std('#e8231f'), [0, i * 0.022, 0], wrapG, { cast: false, rot: [Math.PI / 2, 0, 0] });
  const splashG = new THREE.Group(); S.add(splashG); const spl = []; for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); m.castShadow = false; m.userData.noClip = true; splashG.add(m); spl.push(m); }
  const ring = mesh(new THREE.RingGeometry(0.6, 1, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), [0, 0, 0], S, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }); ring.userData.noClip = true;
  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpM = new THREE.Matrix4(), tmpS = V3(1, 1, 1), tmpP = V3(), tmpV = V3(), tmpV2 = V3();
  // place a vehicle group on the water from a path sample: waves lift and tilt it, bank leans it
  function onWater(grp, p, t, { y0 = 0, bob = 1, pitch0 = 0 } = {}) { const h = waveH(p.x, p.z, t), [gx, gz] = waveGrad(p.x, p.z, t), fz = Math.cos(p.yaw), fx = Math.sin(p.yaw), slopeF = gx * fx + gz * fz, slopeR = gx * fz - gz * fx;
    grp.position.set(p.x, h * bob + (p.y || 0) + y0, p.z); grp.rotation.order = 'YXZ'; grp.rotation.set(-Math.atan(slopeF * bob) + pitch0 + (p.pitch || 0), p.yaw, p.bank + Math.atan(slopeR * bob) * 0.8); }
  // the ski: spray, wake, lights, needle
  function drive(ski, p, t, fx, on, id) { ski.group.visible = on; if (!on) return; onWater(ski.group, p, t, { y0: -0.04, pitch0: clamp(p.speed / 22, 0, 0.5) * 0.18 });
    const eng = id === 'js' ? smooth(clamp(fx.engine ?? 1)) : 1, sp = clamp(p.speed / 12) * (eng > 0.2 ? 1 : 0);
    const en = id === 'js' ? clamp(fx.engine ?? 1) : 1, on2 = en > 0.05 ? 1 : 0;   // engine 1 = running, 0.3 = idle (lights on, needle low), 0 = OFF (light out, needle falls to 0)
    ski.needle.rotation.z = -2.1 + on2 * 4.2 * (0.1 + 0.9 * clamp(p.speed / 14)); ski.headM.color.setRGB(5 * on2 + 0.05, 4.2 * on2 + 0.05, 2.8 * on2 + 0.05); ski.glowPl.forEach((m) => { m.material.opacity = 0.5 * on2; });
    ski.wakes.forEach((w, i) => { const k = smooth(sp * 1.6); w.visible = k > 0.02; w.material.opacity = 0.65 * k; w.scale.set(1 + 2.2 * k, 0.4 + 0.9 * k, 1); w.position.set((i ? 1 : -1) * (0.55 + 0.9 * k), 0.03, -1.7 - 7 * (0.4 + 0.9 * k)); w.rotation.z = (i ? 1 : -1) * 0.14; });
    ski.spr.forEach((s, i) => { const side = i % 2 ? 1 : -1, ph = (t * 1.9 + i / ski.spr.length * 3.7) % 1, a = Math.sin(Math.PI * ph); s.visible = sp > 0.04 && a > 0.02 && (!SK || i % SK.of < SK.keep); if (!s.visible) return; const r = 0.03 + 0.055 * hash(i * 3.1);
      const out = 0.5 + (0.6 + 1.1 * hash(i * 1.7)) * ph * (0.6 + 0.8 * sp), up = 0.12 + (1.3 + 0.9 * hash(i * 5.3)) * ph * (1 - ph) * 2 * (0.5 + sp), back = 1.2 - (3.0 + 3.0 * sp) * ph - (i % 5 === 0 ? 1.5 : 0);
      s.position.set(side * out, up, back); if (SK) { s.position.y = Math.min(s.position.y, SK.maxUp); s.material.color.set('#ffffff'); } s.scale.setScalar(r * (1 + ph * 1.2)); s.material.opacity = (SK ? SK.op : 0.7) * a * sp; });
  }
  // rider glue: the root of a seated character on a vehicle seat (like the cars' riders)
  const SEAT = { js: SKI_SEATS, bj: SKI_SEATS, duck: { driver: DUCK_SEAT }, tt: { driver: TRUCK_SEAT } };
  const sorted = [...riders].sort((a, b) => a.t - b.t);
  const diveQ = new THREE.Quaternion(), diveE = new THREE.Euler();
  function glue(t) { if (!scene) return; const cur = {};
    // the dive (ev.dive, ev.diveWho): the seat -> an arc -> the splash point ev.splashAt -> she sinks under the surface (the water hides her)
    if (ev.diveWho && ev.dive != null && t >= ev.dive) { const root = scene.getObjectByName(ev.diveWho); if (root) { const sa = ev.splashAt || [0, 0], DT = ev.diveT ?? 0.55, u = clamp((t - ev.dive) / DT), skiG = skiW.group; skiG.updateMatrixWorld(true); const st = skiG.localToWorld(V3(...SKI_SEATS.pass.pos)), tgt = V3(sa[0] + at[0], waveH(sa[0], sa[1], t), sa[1] + at[2]);
        const k = smooth(u); root.position.set(lerp(st.x, tgt.x, k), lerp(st.y, tgt.y, k) + 1.4 * 4 * u * (1 - u) - clamp((t - ev.dive - DT) / 0.6) * 1.2, lerp(st.z, tgt.z, k)); diveE.set(-clamp(u * 1.0) * 2.6, ev.diveYaw ?? 0, 0); root.quaternion.setFromEuler(diveE); } }
    for (const r of sorted) if (r.t <= t) cur[r.who] = r; const grp = { js: skiW.group, bj: skiB.group, duck: duck.group, tt: truck.group };
    for (const [who, r] of Object.entries(cur)) { if (!r.on) continue; const root = scene.getObjectByName(who); if (!root) continue; const seat = SEAT[r.on][r.seat || 'driver']; if (!seat) continue; const gp = grp[r.on]; if (!gp.visible) continue; gp.updateMatrixWorld(true);
      tmpQ.setFromEuler(tmpE.set(r.pitch || 0, seat.yaw + (r.yaw || 0), 0)); tmpP.set(seat.pos[0], seat.pos[1] + (r.dy || 0), seat.pos[2]); tmpM.compose(tmpP, tmpQ, tmpS); tmpM.premultiply(gp.matrixWorld); tmpM.decompose(root.position, root.quaternion, tmpV); } }
  const WRIST = V3(0.17, 0.76, -0.45);   // the passenger's wrist (white ski frame): the red cord ends here
  const toS = (obj, v) => S.worldToLocal(obj.localToWorld(v.clone()));
  function pre(t, fx = {}, sc = null) {   // called by the composite right after the stands: vehicles placed, riders glued (so the camera, light and dome of this frame see the riders where they really are)
    const pj = paths.js ? paths.js(t) : null, pb = paths.bj ? paths.bj(t) : null, pt = paths.tt ? paths.tt(t) : null, nul = { x: 0, z: 0, yaw: 0, bank: 0, speed: 0 };
    drive(skiW, pj || nul, t, fx, !!pj && (fx.skiOn ?? 1) > 0.5, 'js'); drive(skiB, pb || nul, t, fx, !!pb && (fx.blackOn ?? 0) > 0.5, 'bj');
    // the duck rides the white ski's trail, one rope length behind its stern (walk the trail back in time until the arc length reaches the rope length)
    duck.group.visible = !!pj && (fx.duckOn ?? 0) > 0.5;
    if (duck.group.visible) { let tt = t, acc = 0, prev = pj, pp = pj; for (let k = 0; k < 90 && acc < duckLag; k++) { tt -= 0.05; const q = paths.js(tt); acc += Math.hypot(q.x - prev.x, q.z - prev.z); prev = q; pp = q; }
      const sx = pj.x - Math.sin(pj.yaw) * 1.7, sz = pj.z - Math.cos(pj.yaw) * 1.7; let dx = pp.x - sx, dz = pp.z - sz; const dl = Math.hypot(dx, dz); if (acc < duckLag - 0.3 || dl < 0.5) { dx = -Math.sin(pj.yaw); dz = -Math.cos(pj.yaw); } else { dx /= dl; dz /= dl; }
      const dd = (acc < duckLag - 0.3 || dl < 0.5) ? duckLag : Math.min(duckLag, dl);
      onWater(duck.group, { x: sx + dx * dd, z: sz + dz * dd, yaw: Math.atan2(-dx, -dz), bank: 0, speed: pj.speed }, t, { y0: -0.18, bob: 1.3 });
      duck.body.rotation.z = 0.04 * Math.sin(t * 2.6); duck.body.position.y = 0.05 * Math.sin(t * 3.1 + 1) + clamp(pj.speed / 14) * 0.08 * Math.sin(t * 8.3);
      S.updateMatrixWorld(true); ropeD.set(toS(skiW.group, V3(0, 0.34, -1.75)), toS(duck.group, duck.tow), 0.06); } else ropeD.hide();
    // the truck
    truck.group.visible = !!pt && (fx.truckOn ?? 0) > 0.5;
    if (truck.group.visible) { truck.group.position.set(pt.x, 0, pt.z); truck.group.rotation.set(0, pt.yaw, 0); truck.chassis.position.y = 0.03 * Math.sin(t * 5) * clamp(pt.speed / 3); const ar = carArc(paths.tt, t) * (pt.rev ? -1 : 1); truck.wheels.forEach((w) => { w.rotation.x = ar / truck.R; });
      const lift = smooth(clamp((t - (ev.liftT0 ?? 1e9)) / Math.max(0.1, (ev.liftT1 ?? 1e9) - (ev.liftT0 ?? 1e9)))); truck.boom.rotation.x = lerp(0.3, -0.5, lift); truck.beG.material.opacity = 0.25 + 0.5 * smooth(0.5 + 0.5 * Math.sin(t * 2.2));
    } else chainR.hide();
    S.updateMatrixWorld(true);   // the checks (clipcheck) read the matrices without a render
    glue(t);
  }
  function update(t, fx = {}, follow = null, sc = null) {
    road0(t, fx, follow); const pj = paths.js ? paths.js(t) : null, pb = paths.bj ? paths.bj(t) : null, pt = paths.tt ? paths.tt(t) : null;
    { const tr = sc?.getObjectByName(followName); g.children[0].position.x = (tr ? tr.position.x : follow ? follow.x : at[0]) - at[0]; if (tr) g.children[0].position.z = clamp(tr.position.z - at[2] - 6, -390, 52); }   // the sky dome (first child of the road) follows the camera subject in x and z: the sea is wide
    updateWater(t);
    lap.material.opacity = 0.35 + 0.18 * Math.sin(t * 0.9); lap.position.x = SHORE - 0.8 - 0.8 * (0.5 + 0.5 * Math.sin(t * 0.9));
    if (pt && truck.group.visible) { const lift = smooth(clamp((t - (ev.liftT0 ?? 1e9)) / Math.max(0.1, (ev.liftT1 ?? 1e9) - (ev.liftT0 ?? 1e9)))); { const car0 = sc?.getObjectByName('car_car'), pf = car0?.getObjectByName('plate_front'); if (pf) { const k = smooth(clamp((t - (ev.liftT0 ?? 1e9) + 0.3) / 0.5)); pf.scale.setScalar(1 + 0.6 * k); } }
      const car = sc?.getObjectByName('car_car');
      if (car && lift > 0.0001 || (car && t >= (ev.chainT ?? 1e9))) { S.updateMatrixWorld(true); truck.group.updateMatrixWorld(true); car.updateMatrixWorld(true); const ch = car.children[0].children[0]; chainR.set(toS(truck.tip, V3()), S.worldToLocal(ch.localToWorld(V3(0, 0.5, -1.85))), 0.02); } else chainR.hide();
    } else chainR.hide();
    // the ice-cream stand: fx kem (a police car hits it: it tips and slides, the scoops fly)
    const kem = smooth(clamp(fx.kem || 0));
    if (stand) { kemG.rotation.set(0.0, 0.9 * kem, -0.5 * kem); kemG.position.set(-0.7 * kem, 0.25 * kem, -0.6 * kem);
      scoops.forEach((s, i) => { const k = clamp((fx.kem || 0) * 1.6 - 0.1), tt2 = k * 1.4, vx = (hash(i * 3.3) - 0.2) * 5.0, vy = 4 + 3 * hash(i * 1.9), vz = (hash(i * 7.1) - 0.5) * 6; s.visible = k > 0.01 && k < 1.6; s.position.set(SX + vx * tt2, Math.max(0.15, 1.2 + vy * tt2 - 4.9 * tt2 * tt2), SZ + vz * tt2); s.rotation.set(tt2 * 7, tt2 * 3, 0); }); }
    // the hook thrown from the black ski to the white ski's handlebar, and its rope
    const h0 = ev.hookT0 ?? 1e9, h1 = ev.hookT1 ?? 1e9; hook.visible = !!pb && !!pj && t >= h0 - 0.05 && (fx.blackOn ?? 0) > 0.5; ropeH.group.visible = hook.visible;
    if (hook.visible) { S.updateMatrixWorld(true); const hs = toS(skiB.group, V3(0.35, 1.0, 0.2)), hb = toS(skiW.group, V3(0, 0.95, 0.42)), u = clamp((t - h0) / (h1 - h0)), pos = hs.clone().lerp(hb, smooth(u)); pos.y += 1.6 * 4 * u * (1 - u);
      hook.position.copy(pos); hook.rotation.set(0, Math.atan2(hb.x - hs.x, hb.z - hs.z), clamp(u * 7) * 1.2 * (u < 1 ? 1 : 0)); ropeH.set(hs, pos, u < 1 ? 0.08 : 0.01); }
    // the red cord: from the key slot's plug to the passenger's wrist; pulled out at ev.cordPull (the plug flies after the wrist, then floats on the water)
    const cp = ev.cordPull ?? 1e9, cu = t - cp, dv = ev.dive ?? 1e9; cordR.group.visible = !!pj && (fx.skiOn ?? 1) > 0.5 && (fx.cordOn ?? 1) > 0.5;
    if (cordR.group.visible) { S.updateMatrixWorld(true); const slotW = toS(skiW.group, skiW.slotPos); let wr = toS(skiW.group, WRIST); { const w0 = ev.wrapT0 ?? -1e9, w1 = ev.wrapT1 ?? -1e8, k = smooth(clamp((t - w0) / Math.max(0.05, w1 - w0))); wr = toS(skiW.group, V3(0.1, 0.5, 0.28)).lerp(wr, k); }   // before the wrap the cord end hangs loose by the dash; she winds it onto her wrist between wrapT0 and wrapT1
      if (t > dv && sc) { const lr = sc.getObjectByName('linhs'); if (lr) wr = S.worldToLocal(lr.position.clone().add(V3(0.15, 0.45, 0))); }
      let plugW = slotW.clone(), sag = 0.2, wy = null;
      if (cu > 0) { const k = smooth(clamp(cu / 0.2)), restX = ev.plugAt ? ev.plugAt[0] : pj.x - 1.4, restZ = ev.plugAt ? ev.plugAt[1] : pj.z - 0.6; plugW = slotW.clone().lerp(V3(restX, waveH(restX, restZ, t) + 0.03, restZ), k); plugW.y += 0.9 * 4 * k * (1 - k) * (cu < 0.2 ? 1 : 0); sag = 0.02; if (cu > 0.2) wy = waveH(plugW.x, plugW.z, t) + 0.02; }
      skiW.plug.visible = cu <= 0; cordR.set(plugW, wr, sag, wy); }
    wrapG.visible = !!pj && (fx.cordWrap || 0) > 0.5 && t < dv; if (wrapG.visible) { S.updateMatrixWorld(true); wrapG.position.copy(toS(skiW.group, WRIST)); wrapG.quaternion.copy(skiW.group.quaternion); }
    // the splash where Linh goes in (fx splash 0..1, at ev.splashAt = [x, z])
    const sk = clamp(fx.splash || 0), sa = ev.splashAt || [0, 0]; ring.visible = sk > 0.01 && sk < 0.999; ring.position.set(sa[0], waveH(sa[0], sa[1], t) + 0.03, sa[1]); ring.scale.setScalar(0.4 + 3.2 * sk); ring.material.opacity = 0.75 * (1 - sk) * Math.min(1, sk * 8);
    spl.forEach((m, i) => { const tt2 = sk; m.visible = sk > 0.01 && sk < 0.98; if (!m.visible) return; const a = hash(i * 2.7) * TAU, v = 1.2 + 1.5 * hash(i * 4.1), vy = 3.2 + 2.2 * hash(i * 6.3); m.position.set(sa[0] + Math.cos(a) * v * tt2 * 0.9, waveH(sa[0], sa[1], t) + Math.max(0, vy * tt2 - 4.9 * tt2 * tt2), sa[1] + Math.sin(a) * v * tt2 * 0.9); m.scale.setScalar(0.07 + 0.09 * hash(i * 1.1)); m.material.opacity = 0.9 * (1 - tt2) * Math.min(1, sk * 14); });
    S.updateMatrixWorld(true);
  }
  // marks + cams (place-local + the origin)
  const seats = { ...R.seats }; const mk = (n, p, yaw = 0) => { seats[n] = { pos: [p[0] + at[0], p[1] + at[1], p[2] + at[2]], yaw }; };
  mk('car_origin', [0, 0, 0]); mk('pier_foot', [PX0 - 1, PY, pierZ], -Math.PI / 2); mk('pier_mid', [-40, PY, pierZ], -Math.PI / 2); mk('pier_end', [PX1 + 2, PY, pierZ], -Math.PI / 2); mk('stand', [SX, 0, SZ]);
  const cams = { ...R.cams };
  return { ...R, group: g, seats, cams, update, pre, look: { ...R.look, bloom: [0.34, 0.65, 0.95] }, light: 'gta_dusk', lightAt: [2.75, 0.8, -60], parts: { skiW, skiB, duck, truck, hook }, waveH, pier: { x0: PX0, x1: PX1, z: pierZ, y: PY, w: PW }, stand: { x: SX, z: SZ } };
}
