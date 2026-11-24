// stall `plus`: small shared helpers (textures, breeze, merged boxes, finders). Everything here is a pure function of its inputs; nothing keeps state between frames.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { noise1, hash, smooth } from '../../core/util.js';

// the light breeze: 0.1 .. 1.0, slow, with gusts (one function so bunting, plant, bulb and cable sway together)
export const breeze = (t) => 0.55 + 0.45 * noise1(t * 0.31, 3) * (0.8 + 0.2 * Math.sin(t * 0.9));

export const walk = (g, pred) => { const o = []; g.traverse((m) => { if (pred(m)) o.push(m); }); return o; };
export const isPlane = (m, w, h, x) => m.isMesh && m.geometry.type === 'PlaneGeometry' && Math.abs(m.geometry.parameters.width - w) < 1e-6 && Math.abs(m.geometry.parameters.height - h) < 1e-6 && (x === undefined || Math.abs(m.position.x - x) < 1e-6);

// detail maps (normal / roughness): preloaded by stall_plus_preload.js (a top-level await in the episode), else loaded on the spot (async: the first frames may be flat)
const URL_BASE = new URL('./assets/stall_plus/', import.meta.url).href, loader = new THREE.TextureLoader();
export const texStats = { n: 0, bytes: 0 };
export function detailTex(name, repX, repY, anisotropy = 16) {
  const cache = (globalThis.__stallPlusTex ||= {}); let t;
  if (cache[name]?.image) { t = cache[name].clone(); t.needsUpdate = true; } else { if (!globalThis.__stallPlusWarned) { globalThis.__stallPlusWarned = 1; console.warn('stall plus: textures not preloaded; add  import "../packs/trada/stall_plus_preload.js"  to the episode'); } t = loader.load(URL_BASE + name + '.jpg'); }
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX, repY); t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  texStats.n++; return t;
}
export const texBytes = (w, h, mip = true) => w * h * 4 * (mip ? 4 / 3 : 1);

// merge a list of box pieces into ONE mesh with vertex colours. piece = { w, h, d, pos:[x,y,z], rot?:[rx,ry,rz], col:'#rrggbb' }
export function mergedBoxes(pieces, material) {
  if (!pieces.length) return null; const geos = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (const p of pieces) { const geo = new THREE.BoxGeometry(p.w, p.h, p.d); e.set(...(p.rot || [0, 0, 0])); q.setFromEuler(e); m4.compose(new THREE.Vector3(...p.pos), q, new THREE.Vector3(1, 1, 1)); geo.applyMatrix4(m4);
    c.set(p.col); const n = geo.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geos.push(geo); }
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), material); geos.forEach((x) => x.dispose()); mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
}
export const triCount = (root) => { let n = 0; root.traverse((m) => { if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return Math.round(n); };
export { hash };

// ---- round 2 helpers (vehicles / walker) ----
// a closed outline with softly rounded corners from a list of [x, y] points (each corner is cut at distance r*(edge length) and rounded with a quadratic curve); used for the car and scooter bodies
export function smoothShape(pts, k = 0.3) {
  const sh = new THREE.Shape(), n = pts.length, mid = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  for (let i = 0; i < n; i++) { const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], p0 = mid(p, a, k), p1 = mid(p, b, k); if (i === 0) sh.moveTo(p0[0], p0[1]); else sh.lineTo(p0[0], p0[1]); sh.quadraticCurveTo(p[0], p[1], p1[0], p1[1]); }
  sh.closePath(); return sh;
}
// a profile in (z, y) pulled out sideways over `width` (x), bevelled so no edge is sharp; the front of the shape (+z) stays +z in the world
export function sideExtrude(pts, width, { k = 0.3, bevel = 0.07, steps = 3 } = {}) {
  const geo = new THREE.ExtrudeGeometry(smoothShape(pts, k), { depth: Math.max(0.001, width - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: steps, curveSegments: 6 });
  geo.rotateY(-Math.PI / 2); geo.computeBoundingBox(); const bb = geo.boundingBox; geo.translate(-(bb.min.x + bb.max.x) / 2, 0, 0); return geo;   // shape x -> world z, extrusion -> world x (centred)
}
// a capsule laid between two points a and b (arrays), inside `parent`
export function limbBetween(a, b, r, mat, parent) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = Math.max(0.001, d.length() - 2 * r), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = false; parent.add(m); return m;
}

// the stall's lamp rules for the pieces `plus` adds (same formulas as stall.js: fx.cold / option cold, fx.blackout, and under steadyLights fx.lampR: the street group dims to 30 %).
// Returns { c, u, kB, lampK, mixK, kSt, k }: c = cold 0..1, u = max(cold, blackout) (the blue-grey wash), kB = the blackout flutter factor, mixK = lamp factor (cold unsteady lamp x blackout),
// kSt = street group under steadyLights, k = mixK * kSt (what a street light / window glow / halo is multiplied by). A pure function of t and fx.
export function lightCtl(t, fx = {}, { cold = 0, steadyLights = false } = {}) {
  const c = Math.max(cold || 0, fx.cold || 0), bo = fx.blackout || 0, sb = smooth(bo), wave = 0.5 + 0.5 * noise1(t * 0.9, 4), dip = Math.pow(Math.max(0, noise1(t * 0.37, 7)), 2), lampK = 1 - c * (0.12 + 0.3 * wave + 0.45 * dip);
  const flut = 1 - 0.35 * Math.sin(Math.PI * sb) * (0.5 + 0.5 * Math.sin(t * 9.7 + 1.3 * Math.sin(t * 2.3))), kB = (1 - 0.97 * sb) * flut, mixK = (1 - c + c * lampK) * kB, r = steadyLights ? (fx.lampR || 0) : 0, kSt = 1 - 0.7 * r;
  return { c, u: Math.max(c, sb), kB, lampK, mixK, kSt, k: mixK * kSt, r };
}
