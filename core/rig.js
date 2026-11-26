// cine3d core: building blocks for a real 3-D character with a drawn face.
// A character = a body group (meshes lit by the scene lights, casting real shadows) + a head that can turn + a face canvas mapped on the head.
import * as THREE from 'three';
import { clamp, lerp, smooth, hash, fbm1, canvasTex, mesh } from './util.js';

// a bendy limb (sleeve, leg): a tube along a quadratic curve, updated in-place (zero per-frame BufferGeometry / VBO churn)
const _nP = new THREE.Vector3();
export class Noodle {
  constructor(r, mat, parent, { seg = 14, cast = true, taper = 1 } = {}) {
    this.r = r; this.seg = seg; this.taper = taper; this.radSeg = 12;
    const rings = seg + 1, ring = this.radSeg + 1, vCount = rings * ring;
    const g = new THREE.BufferGeometry(); g.type = 'TubeGeometry';
    const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uvs = new Float32Array(vCount * 2);
    for (let i = 0; i <= seg; i++) for (let j = 0; j <= this.radSeg; j++) { const q = (i * ring + j) * 2; uvs[q] = i / seg; uvs[q + 1] = j / this.radSeg; }
    const idx = [];
    for (let i = 1; i <= seg; i++) for (let j = 1; j <= this.radSeg; j++) { const a = ring * (i - 1) + (j - 1), b = ring * i + (j - 1), c = ring * i + j, d = ring * (i - 1) + j; idx.push(a, b, d, b, c, d); }
    g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.mesh = new THREE.Mesh(g, mat); this.mesh.castShadow = cast; this.mesh.receiveShadow = true; parent.add(this.mesh); this.mesh.userData.noodle = this; this.outline = null;
    this.curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
    this._cos = Array.from({ length: ring }, (_, j) => -Math.cos((j / this.radSeg) * Math.PI * 2));
    this._sin = Array.from({ length: ring }, (_, j) => Math.sin((j / this.radSeg) * Math.PI * 2));
  }
  set(a, b, c) {
    this.curve.v0.copy(a); this.curve.v1.copy(b); this.curve.v2.copy(c);
    const g = this.mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal;
    const frames = this.curve.computeFrenetFrames(this.seg, false), ring = this.radSeg + 1;
    for (let i = 0; i <= this.seg; i++) {
      this.curve.getPointAt(i / this.seg, _nP);
      const N = frames.normals[i], B = frames.binormals[i], rad = this.r * (this.taper !== 1 ? lerp(1, this.taper, i / this.seg) : 1);
      for (let j = 0; j < ring; j++) {
        const co = this._cos[j], si = this._sin[j], nx = co * N.x + si * B.x, ny = co * N.y + si * B.y, nz = co * N.z + si * B.z, q = i * ring + j;
        pos.setXYZ(q, _nP.x + rad * nx, _nP.y + rad * ny, _nP.z + rad * nz);
        nor.setXYZ(q, nx, ny, nz);
      }
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
    if (this.taper !== 1) g.computeVertexNormals();
    g.boundingBox = null; g.boundingSphere = null;
    if (this.outline && this.outline.geometry !== g) this.outline.geometry = g;
  }
}
// arm from shoulder S to hand H: the elbow drops and swings out as the hand comes closer than the arm is long
const _m = new THREE.Vector3(), _d = new THREE.Vector3();
export function armCtrl(S, H, len, side, out = new THREE.Vector3()) {
  const dist = S.distanceTo(H), slack = Math.max(0, len - dist);
  _m.copy(S).add(H).multiplyScalar(0.5); _d.set(side * 0.75, -0.6, -0.28).normalize();
  // a raised hand bends the elbow outwards, not down
  if (H.y > S.y + 0.05) _d.set(side * 0.95, -0.25, -0.15).normalize();
  return out.copy(_m).addScaledVector(_d, 0.03 + slack * 0.85);
}

// a patch of sphere in front of the head that carries the drawn face. u runs screen-left -> right seen from the front.
export function facePatch(R, { yaw = 70, pitch = 60, size = 512, rough = 0.6 } = {}) {
  const a = THREE.MathUtils.degToRad(yaw), b = THREE.MathUtils.degToRad(pitch);
  const tex = canvasTex(size, size, () => {}, { mip: true });
  const geo = new THREE.SphereGeometry(R * 1.004, 48, 36, Math.PI / 2 - a, 2 * a, Math.PI / 2 - b, 2 * b);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: rough, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 2;
  return { mesh: m, tex, ctx: tex.userData.ctx, size, px: size / (2 * yaw), py: size / (2 * pitch) };   // px / py = pixels per degree
}
// point on the head sphere at (yaw, pitch) degrees, pushed out by k
export function onHead(R, yawDeg, pitchDeg, k = 1, out = new THREE.Vector3()) {
  const y = THREE.MathUtils.degToRad(yawDeg), p = THREE.MathUtils.degToRad(pitchDeg);
  return out.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)).multiplyScalar(R * k);
}

// deterministic blink: 0 open .. 1 closed
export const blinkGate = { fn: null };   // act2 (21/11 gate fix) sets fn(onsetTime) -> true = drop that whole blink (shock / last line / first 0.5 s of a shot); null = the film as before
export function blink(t, seed = 0) {
  const cell = 3.1, k = Math.floor(t / cell), at = k * cell + 0.3 + hash(k * 7.3 + seed * 31.7) * (cell - 0.7), d = t - at;
  const one = (x) => (x < 0 || x > 0.16 ? 0 : x < 0.06 ? x / 0.06 : 1 - (x - 0.06) / 0.1), g = blinkGate.fn;
  return Math.max(g && g(at) ? 0 : one(d), hash(k * 3.1 + seed) > 0.75 && !(g && g(at + 0.26)) ? one(d - 0.26) : 0);
}
export const blendNum = (a, b, k) => { const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[key] ?? 0, y = b[key] ?? 0; o[key] = typeof x === 'number' && typeof y === 'number' ? lerp(x, y, k) : (k < 0.5 ? x : y); } return o; };
export const blendVec = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

// idle life shared by every character: breathing, a slow sway, small head drift. Returns offsets to add to a pose.
export function idle(t, seed = 0) {
  return { breathe: Math.sin(t * 1.75 + seed * 2.1), sway: fbm1(t * 0.35, seed) * 0.012, headYaw: fbm1(t * 0.5, seed + 3) * 0.035, headPitch: fbm1(t * 0.45, seed + 7) * 0.03, headRoll: fbm1(t * 0.4, seed + 9) * 0.02 };
}

// Ink outline (the hand-drawn feel of the old 2-D characters, on real 3-D bodies): every solid mesh of a character gets a dark shell,
// the same geometry pushed out along its normals and drawn inside-out. Skipped: see-through parts, glowing parts, tiny details and
// anything marked userData.noOutline. t = thickness in metres (0.0055 = about 6 px in a medium shot).
// look2 only (21/11, round 2): scale = thicker hull (Blender route 1.7x), trim = a part's hull is never thicker than trim x its own radius (but never thinner than t),
// so cuffs, drawstrings and small trims keep the old line; raw = the ink is not tone-mapped (stays as dark as its colour). Defaults = the old outline, unchanged.
export function inkOutline(root, { color = '#231a3d', t = 0.0055, min = 0.028, scale = 1, trim = 0, raw = false, maxPx = 0, H = 1920 } = {}) {
  const list = []; root.updateMatrixWorld(true);
  root.traverse((m) => { if (!m.isMesh || m.userData.noOutline || m.userData.isOutline) return; const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat || mat.transparent || mat.isMeshBasicMaterial || (mat.emissiveIntensity > 1 && mat.emissive && mat.emissive.getHex() !== 0)) return;
    if (!m.userData.noodle) { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); const sc = new THREE.Vector3(); m.getWorldScale(sc); if (m.geometry.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z) < min) return; }
    list.push(m); });
  for (const m of list) { const sc = new THREE.Vector3(); m.getWorldScale(sc); const ws = (Math.abs(sc.x) + Math.abs(sc.y) + Math.abs(sc.z)) / 3 || 1;
    let tw = t; if (scale !== 1) { tw = t * scale; if (trim > 0) { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); const bsR = m.geometry.boundingSphere?.radius || 0; const effR = m.userData.noodle && bsR < 1e-4 ? m.userData.noodle.r * 2.5 : bsR; tw = Math.min(tw, Math.max(t, trim * effR * ws)); } }
    const k = tw / ws, halfH = H * 0.5;
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }); if (raw) mat.toneMapped = false;
    // maxPx (look2): the hull is capped at maxPx output pixels (relative to H/2) at the vertex's depth: 1 / ws turns the world cap into the mesh's own units
    mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', maxPx > 0 ? `float inkZ = -(modelViewMatrix * vec4(position, 1.0)).z; vec3 transformed = position + normalize(normal) * min(${k.toFixed(5)}, ${(maxPx / ws).toFixed(5)} * inkZ / (projectionMatrix[1][1] * ${halfH.toFixed(1)}));` : `vec3 transformed = position + normalize(normal) * ${k.toFixed(5)};`); };
    mat.customProgramCacheKey = () => 'ink' + k.toFixed(5) + (maxPx > 0 ? 'px' + (maxPx / ws).toFixed(5) + (H !== 1920 ? 'h' + H : '') : '');
    const o = new THREE.Mesh(m.geometry, mat); o.userData.isOutline = true; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; m.add(o); if (m.userData.noodle) m.userData.noodle.outline = o; }
  return list.length;
}

// soft round contact shadow under a seat / feet (the shadow map gives the cast shadow, this grounds the object)
let _blob = null;
export function contactBlob(w, d, parent, pos, op = 0.55) {
  _blob ||= canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  const m = mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: _blob, transparent: true, opacity: op, depthWrite: false }), pos, parent, { cast: false, recv: false, rot: [-Math.PI / 2, 0, 0] }); m.renderOrder = 1; return m;
}
export { clamp, lerp, smooth };

// ---------------------------------------------------------------------------------------------------------------------
// Standing legs and gaits (Zombie special, 13/11). Everything a pure function of the pose numbers p and the gait phase p.gph
// (cycles, integrated by the player from the gait numbers, so a change of speed never makes the legs jump).
// Gait numbers 0..1, blended: walk · run · lurch (zombie: one leg drags, body lolls) · robot (stiff short steps).
// Body numbers 0..1: crouch (knees bent, hips low) · kneel (both knees on the ground) · lunge (one big step forward).
export const GAIT = {
  walk: { stride: 0.42, lift: 0.075, duty: 0.6, bob: 0.016, lean: 0.05, arm: 0.12, rate: 1.8, kick: 0, roll: 0.03 },
  run: { stride: 0.62, lift: 0.13, duty: 0.38, bob: 0.05, lean: 0.34, arm: 0.2, rate: 2.7, kick: 0.2, roll: 0.06 },
  lurch: { stride: 0.3, lift: 0.05, duty: 0.68, bob: 0.03, lean: 0.17, arm: 0.03, rate: 0.85, kick: 0, roll: 0.05 },
  robot: { stride: 0.22, lift: 0.085, duty: 0.55, bob: 0.006, lean: 0, arm: 0, rate: 1.6, kick: 0, roll: 0 },
  // Zombie special, motion pass (13/11): charge = the zombie chase (a fast, uneven lurching run, one leg dragging); backaway = stumbling backwards steps (afraid)
  charge: { stride: 0.55, lift: 0.1, duty: 0.45, bob: 0.06, lean: 0.38, arm: 0.06, rate: 2.2, kick: 0.1, roll: 0.09 },
  backaway: { stride: 0.26, lift: 0.06, duty: 0.6, bob: 0.02, lean: -0.1, arm: 0.04, rate: 1.7, kick: 0, roll: 0.05 },
};
export const GAIT_KEYS = Object.keys(GAIT);
const blendGait = (fx) => { let w = 0; const g = { stride: 0, lift: 0, duty: 0, bob: 0, lean: 0, arm: 0, rate: 0, kick: 0, roll: 0 }; for (const k of GAIT_KEYS) { const v = clamp(fx[k] || 0); if (!v) continue; w += v; for (const q in g) g[q] += GAIT[k][q] * v; } const W = Math.max(1e-6, w); for (const q in g) g[q] /= W; if (!w) { g.duty = 0.6; g.rate = 1.8; g.stride = 0.42; } return { g, w }; };
// cycles per second for a set of fx numbers, travelling at nothing in particular (kept for older callers)
export const gaitRate = (fx) => { let w = 0, r = 0; for (const k of GAIT_KEYS) { const v = clamp(fx[k] || 0); w += v; r += v * GAIT[k].rate; } return w > 1 ? r / w : r; };
// step rate and stride for fx numbers at a ground speed v (m/s): the planted foot moves back at exactly v, so it does not slide.
// The rate stays within 0.65-1.45 x the gait's own cadence; the stride takes up the rest. v < 0.15 = stepping on the spot (old behaviour).
export function gaitPlan(fx, v = 0) {
  const { g, w } = blendGait(fx), amt = clamp(w); if (!amt) return { rate: 0, stride: g.stride };
  const carry = clamp(Math.max(fx.carry || 0, fx.piggy || 0)), S0 = g.stride * (1 - 0.32 * carry), r0 = g.rate * (1 + 0.12 * carry);
  if (v < 0.15) return { rate: r0 * amt, stride: S0 };
  const rate = clamp(v * g.duty / S0, 0.65 * r0, 1.45 * r0); return { rate: rate * Math.max(amt, 0.35), stride: v * g.duty / rate };
}
export const usesLegs = (p) => GAIT_KEYS.some((k) => p[k] > 1e-4) || p.crouch > 1e-4 || p.kneel > 1e-4 || p.lunge > 1e-4 || p.kneesKnock > 1e-4;
const _fr = (x) => x - Math.floor(x), _k = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector3();
// knee of a two-bone leg (thigh = shin = len / 2) from hip H to ankle A, bending towards +z; returns the Noodle control point that makes the curve pass through the knee
export function kneeCtrl(H, A, len, out = new THREE.Vector3(), knee = null) {
  const d = H.distanceTo(A), l = len / 2, h = Math.sqrt(Math.max(0, l * l - d * d / 4));
  _v.subVectors(A, H).normalize(); _n.set(0, 0, 1).addScaledVector(_v, -_v.z); if (_n.lengthSq() < 1e-6) _n.set(0, 1, 0); _n.normalize();
  _k.copy(H).add(A).multiplyScalar(0.5).addScaledVector(_n, h); if (knee) knee.copy(_k);
  return out.copy(_k).multiplyScalar(2).sub(_v.copy(H).add(A).multiplyScalar(0.5));
}
// a jerky value: holds a random level, then snaps to the next in `snap` seconds (a ramp of a few frames, never a one-frame switch). Range -1..1.
export const jerk = (t, seed = 0, hold = 0.32, snap = 0.07) => { const k = Math.floor(t / hold), f = (t - k * hold) / snap; return lerp(hash(k * 7.1 + seed) * 2 - 1, hash((k + 1) * 7.1 + seed) * 2 - 1, smooth(f - (hold / snap - 1))); };
// hips, knees, ankles of both legs in the character's root frame (+z forward). hx = half hip width, hipY = standing hip height, ankle = ankle height.
// p.gstride (from the player) = the stride that matches the real travel speed, so the stance foot stays planted.
// Returns { dy (hip drop), lean, sway, roll, amt, swing, pump (arm swing: + = right arm forward), squash (0..1 on each landing), rk (run share), g, H[2], A[2], C[2], K[2], tilt[2] }
export function legRig(p, { hx = 0.075, hipY = 0.68, ankle = 0.08, fz = 0.0 } = {}) {
  const len = hipY - ankle; const { g, w } = blendGait(p), W = Math.max(1, w);
  const amt = clamp(w), share = (k) => clamp((p[k] || 0) / W) * amt, lu = share('lurch'), rb = share('robot'), ch = share('charge'), rk = share('run') + ch, bk = share('backaway');
  const ph = p.gph || 0, cr = clamp(p.crouch || 0), kn = clamp(p.kneel || 0), lg = clamp(p.lunge || 0), pan = clamp(p.panic || 0), carry = clamp(Math.max(p.carry || 0, p.piggy || 0));   // a load (in the arms or on the back): shorter, heavier steps
  const S = p.gstride ?? g.stride * (1 - 0.32 * carry), dir = 1 - 2 * Math.min(1, bk / Math.max(1e-6, amt) || 0);   // backwards: the stance foot moves forward under the body
  const out = { H: [], A: [], C: [], K: [], tilt: [], amt, g, ph, rk, swing: Math.sin(ph * Math.PI * 2) * amt, pump: Math.cos(ph * Math.PI * 2) * amt };
  // one bounce per step: lowest just after a foot lands (squash), highest in the push-off; a stumble now and then when panicking
  const u2 = _fr(ph * 2), step = Math.floor(ph * 2), stumble = pan * (hash(step * 1.37 + 0.5) > 0.72 ? 1 : 0) * Math.sin(Math.PI * u2);
  const bob = g.bob * amt * (1 + 0.7 * carry);
  const bounce = -bob * 0.5 * (1 + Math.cos(Math.PI * 2 * (u2 - 0.15))) - 0.035 * lu * Math.max(0, Math.sin(ph * Math.PI * 2 + 0.6)) - 0.07 * stumble;
  out.squash = (rk + 0.4 * lu + 0.3 * carry) * Math.sin(Math.PI * clamp(u2 / 0.3)) * (1 + 0.6 * carry);
  let dy = bounce - cr * 0.3 * len, lean = g.lean * amt + cr * 0.38 + lg * 0.32 + 0.22 * stumble;
  const kneelHip = ankle * 0.7 + len * 0.42; dy = lerp(dy, kneelHip - hipY, kn); lean = lerp(lean, 0.12, kn);
  dy -= lg * 0.12 * len;
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1, u = _fr(ph + (i ? 0.5 : 0)), drag = i === 1 ? Math.max(lu, ch * 0.75) : 0, stride = S * (1 - 0.55 * drag), lift = g.lift * (1 - 0.88 * drag), D = g.duty;
    // (22/11, core/gait.js) p.gamp = [A0cur, A0next, A1cur, A1next]: each foot keeps the step length it LANDED with for its whole stance (so it never slides when the speed changes) and swings to the length of its next landing
    const GA = p.gamp, Ac = GA ? GA[2 * i] : 1, An = GA ? GA[2 * i + 1] : 1, zk = GA ? 1 : amt, yk = GA ? Math.max(Math.sqrt(amt), clamp(1.5 * (Ac + An))) : p.glift ? Math.max(amt, Math.min(0.45, 3 * amt)) : amt;   // glift (core/gait.js): a foot that moves is always lifted a little (never a gliding shuffle while the steps are tiny)
    let z, y; if (u < D) { z = stride * Ac * (0.5 - u / D); y = 0; }
    else { const q = (u - D) / (1 - D), kick = g.kick * (1 - drag) * Math.sin(Math.PI * clamp(q * 1.7)) * (1 - q); z = stride * (-0.5 * Ac + 0.5 * (Ac + An) * Math.pow(smooth(q), 1 + 0.9 * rk)); y = lift * Math.sin(Math.PI * q) + kick; if (drag > 0) y *= 0.6; }
    if (rb > 0) y *= 1 + 0.5 * rb;   // the robot lifts his knees, stiffly
    z *= dir;
    const H = new THREE.Vector3(s * hx, hipY + dy, -0.01), A = new THREE.Vector3(s * (hx + 0.012 + 0.03 * cr) - s * 0.03 * drag, ankle + y * yk, fz + 0.02 + z * zk + cr * 0.05);
    if (lg > 0) { if (i === 1) A.z += lg * 0.42; else A.z -= lg * 0.2; }
    const K = new THREE.Vector3(), C = kneeCtrl(H, A, len * (1 + 0.04 * cr), new THREE.Vector3(), K);
    if (kn > 0) { const Kk = new THREE.Vector3(s * (hx + 0.02), ankle * 0.7, 0.2), Ak = new THREE.Vector3(s * hx, ankle * 0.75, 0.2 - len * 0.48); K.lerp(Kk, kn); A.lerp(Ak, kn); C.copy(K).multiplyScalar(2).sub(H.clone().add(A).multiplyScalar(0.5)); }
    out.H.push(H); out.A.push(A); out.C.push(C); out.K.push(K); out.tilt.push(u >= D ? 0.5 * Math.sin(Math.PI * (u - D) / (1 - D)) * amt * (1 - kn) * dir : -0.12 * rk * clamp(1 - u / 0.12));
  }
  out.dy = dy; out.lean = lean; out.sway = lu * 0.035 * Math.sin(ph * Math.PI * 2) + (1 - lu) * g.bob * amt * 0.35 * Math.sin(ph * Math.PI * 2);
  out.roll = (g.roll * amt + 0.04 * pan) * Math.sin(ph * Math.PI * 2 + 0.4); out.lu = lu; out.rb = rb; out.kn = kn; out.cr = cr; out.lg = lg; out.ch = ch; out.bk = bk; out.stumble = stumble;
  return out;
}
// the robot walk (Tèo's "đi như máy"): square arms that swap on each step and a head that jerks between fixed angles.
// Ramps of 0.07 s between the held positions (never a one-frame switch; Law 2). k = 0..1 (which arm is up), jerk = -1..1 (head)
export function robotBeat(ph) { const x = ph * 2, i = Math.floor(x), f = x - i, k = smooth((f - 0.0) / 0.14); const a = i % 2, b = 1 - a; return { k: lerp(b, a, k), jerk: lerp(b, a, k) * 2 - 1 }; }
// rotate a group about a pivot point (in its parent's frame): used for falling forward and lying down
export function pivotRot(group, euler, pivot) { group.rotation.copy(euler); group.position.copy(pivot).sub(pivot.clone().applyEuler(euler)); }
