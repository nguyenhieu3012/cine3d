// cine3d core: small math + texture helpers. Everything in the engine is a pure function of time (no accumulated state),
// so any frame can be rendered on its own (seek) and two render workers give identical pictures.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
// one overshoot then settle (gestures): peaks at 1 + a
export const overshoot = (t, a = 0.08) => { t = clamp(t); const e = 1 - Math.pow(1 - t, 3); return e + a * Math.sin(t * Math.PI) * (1 - t) * 2.2; };
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// smooth value noise in [-1, 1], deterministic
export const noise1 = (t, seed = 0) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1; };
export const fbm1 = (t, seed = 0) => noise1(t, seed) * 0.6 + noise1(t * 2.13, seed + 11) * 0.28 + noise1(t * 4.7, seed + 23) * 0.12;
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function canvasTex(w, h, draw, { srgb = true, repeat = null, aniso = 8, mip = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; t.generateMipmaps = mip; if (!mip) t.minFilter = THREE.LinearFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.userData.canvas = c; t.userData.ctx = ctx;
  return t;
}
// speckle / plaster grain into a canvas (seeded)
export function grain(ctx, w, h, n, alpha = 0.06, seed = 1, sz = 2) {
  for (let i = 0; i < n; i++) { const x = hash(i * 1.7 + seed) * w, y = hash(i * 3.1 + seed * 2) * h, d = hash(i * 5.3 + seed * 3); ctx.fillStyle = d > 0.5 ? `rgba(255,255,255,${alpha * d})` : `rgba(0,0,0,${alpha * (1 - d)})`; ctx.fillRect(x, y, sz * (0.5 + d), sz * (0.5 + d)); }
}
export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
export const emis = (color, k = 1, o = {}) => new THREE.MeshStandardMaterial({ color: '#000', emissive: color, emissiveIntensity: k, roughness: 1, ...o });
export function mesh(geo, mat, pos = [0, 0, 0], parent = null, { cast = true, recv = true, rot = null, scale = null, name = '' } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(pos[0], pos[1], pos[2]); m.castShadow = cast; m.receiveShadow = recv;
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]); if (scale) m.scale.set(scale[0], scale[1], scale[2]); if (name) m.name = name; if (parent) parent.add(m); return m;
}
export const box = (w, h, d, mat, pos, parent, o) => mesh(new THREE.BoxGeometry(w, h, d), mat, pos, parent, o);
export const cyl = (rt, rb, h, mat, pos, parent, o, seg = 24) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, pos, parent, o);
export const ball = (r, mat, pos, parent, o, seg = 32) => mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), mat, pos, parent, o);
// lathe from a profile [[radius, y], ...]
export const lathe = (pts, mat, pos, parent, o, seg = 40) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat, pos, parent, o);
