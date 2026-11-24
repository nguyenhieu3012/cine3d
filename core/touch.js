// cine3d core: HAND CONTACT (22/11). Puts a character's hand ON a world point, or slides it back and forth between two points
// (a wipe), by solving the arm to that point. Opt-in: ep.touch = [ ... ]; no entry = no change.
//
// ep.touch = [{ who, hand: 'R' | 'L', t0, t1,                    // the hand is on the surface from t0 to t1 (it comes in / leaves over `ramp` s)
//               at: [x, y, z] | (t) => [x, y, z],                // a world point ON the surface (the contact point) ...
//               from: [x, y, z], to: [x, y, z], period: 0.8,     // ... or a wipe: back and forth between two points, one round trip per `period` s (slows to a stop at each end)
//               n: [0, 1, 0],                                    // outward normal of the surface (the hand ball sits r = 0.044 m off it, so it rests ON the paint, not inside); default up
//               r: 0.044, ramp: 0.25, press: 0 }]                // press = extra metres pushed into the surface (a firm wipe); default 0
// The player adds `touch: { L?: { w, p }, R?: { w, p } }` to the pose numbers of that character at t (w = 0..1 weight, p = world point of the hand ball centre);
// people.js / chars.js call touchArm() inside the arm loop, which turns p into the body frame and blends the hand target to it by w.
import * as THREE from 'three';
import { clamp, smooth } from './util.js';

export function makeTouch(list) {
  const L = (list || []).map((e) => ({ ...e, hand: (e.hand || 'R').toUpperCase(), ramp: e.ramp ?? 0.25, n: e.n || [0, 1, 0], r: e.r ?? 0.044, press: e.press ?? 0 }));
  const point = (e, t) => {
    let p; if (typeof e.at === 'function') p = e.at(t);
    else if (e.at) p = e.at;
    else { const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t - e.t0) / (e.period || 0.8)); p = [0, 1, 2].map((i) => e.from[i] + (e.to[i] - e.from[i]) * k); }
    const off = e.r - e.press; return [p[0] + e.n[0] * off, p[1] + e.n[1] * off, p[2] + e.n[2] * off];
  };
  return {
    list: L, point,
    at(who, t) { let out = null; for (const e of L) { if (e.who !== who || t < e.t0 - 1e-6 || t > e.t1 + 1e-6) continue; const w = smooth((t - e.t0) / e.ramp) * smooth((e.t1 - t) / e.ramp); if (w <= 0) continue; (out ??= {})[e.hand] = { w, p: point(e, t) }; } return out; },
  };
}

const _v = new THREE.Vector3(), _d = new THREE.Vector3();
// inside the arm loop, after the pose / pump target is in H (body frame) and before armCtrl: moves H towards the contact point.
// body = the character's `body` group (hands and shoulders are its children), S = this shoulder (body frame), reach = longest hand distance from the shoulder.
// Returns the weight used (0 = nothing done). A hand farther than `reach` stops short on the line to the point: stand within about 0.5 m of it, or lean (pose key `lean`).
export function touchArm(touch, i, H, body, S, reach = 0.6) {
  const T = touch && touch[i ? 'R' : 'L']; if (!T || T.w <= 0) return 0;
  body.updateWorldMatrix(true, false); _v.set(T.p[0], T.p[1], T.p[2]); body.worldToLocal(_v);
  if (S) { _d.copy(_v).sub(S); const d = _d.length(); if (d > reach) _v.copy(S).addScaledVector(_d.divideScalar(d), reach); }
  H.lerp(_v, clamp(T.w)); return T.w;
}

// the extra forward lean (rad) a character needs so that the shoulder of each touching hand is within `reach` of its point: the smallest angle >= lean0 that does it,
// weighted by the touch weight, so he leans in as the hand comes to the surface and straightens as it leaves (and sways with a wipe that goes far). Needs c.reach(p) (people.js / chars.js).
export function touchLean(touch, c, p, lean0 = 0, reach = 0.5, maxLean = 0.55) {
  const info = touch && c.reach && c.reach(p); if (!info) return 0;
  c.root.updateWorldMatrix(true, false); let need = 0;
  for (const h of ['L', 'R']) {
    const T = touch[h]; if (!T || T.w <= 0) continue; _v.set(T.p[0], T.p[1], T.p[2]); c.root.worldToLocal(_v);
    const sx = (h === 'R' ? 1 : -1) * info.sx, dy = info.shoulderY - info.pivotY, dist = (a) => Math.hypot(Math.max(-0.26, Math.min(0.26, _v.x - sx)), _v.y - info.pivotY - dy * Math.cos(a), _v.z - dy * Math.sin(a));
    let a = lean0, best = lean0, bd = dist(lean0);
    for (; a < maxLean; a += 0.01) { const d = dist(a); if (d < bd) { bd = d; best = a; } if (d <= reach) break; }   // the smallest angle that reaches (a point far to the side counts only 0.26 m of its sideways offset, so the lean never jumps: leaning cannot bring a side point closer; the arm stretches)
    a = bd <= reach ? Math.min(a, best + 0.0) : best;
    need = Math.max(need, (a - lean0) * clamp(T.w));
  }
  return need;
}
