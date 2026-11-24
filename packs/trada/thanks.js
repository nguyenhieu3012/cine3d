// Trà đá thank-you special (13/11): the props one episode needs, built here so chars.js / people.js / stall.js only call them.
// Everything is OFF unless an episode asks (castOpts / setOpts / fx / pose numbers), so every earlier episode is pixel-identical. Pure functions of t: no state, no Math.random.
//   Ribbon ........ a flat strip along a polyline (paper): used by the receipt slip, the paper flood and the paper on Tèo
//   makeFollowerPhone .. a phone whose screen is the follower counter (core/overlay_zb.js `followerScreen`), for Tèo's hand
//   makeSlip / slipLines .. Bíp's printed slip (text from the episode)
//   makeFlood ..... paper pouring out of Bíp's chest without stopping
//   makePaperOn ... paper lying on Tèo's head and shoulders + a sheet over his face
//   makeStoolStack  a wobbling stack of plastic stools (Bà)
//   buildStoolRow .. the row of stools with a lit glass of tea on each, down the pavement (stall setOpts.row)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, smooth, hash, noise1, canvasTex, std, mesh, cyl, ball, V } from '../../core/util.js';
import { followerScreen } from '../../core/overlay_zb.js';

const FONT = (px, w = 900, fam = 'Display') => `${w} ${px}px ${fam}, sans-serif`;
const _T = new THREE.Vector3(), _S = new THREE.Vector3(), _N = new THREE.Vector3(), _A = new THREE.Vector3(), _R = new THREE.Vector3(0, 1, 0), _R2 = new THREE.Vector3(1, 0, 0);
const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);

// ---------------------------------------------------------------------------------------------------------------------
// Ribbon: a strip of paper along points P[0..n]; width (number or fn(u)); the side vector S (u runs along it) is tangent x ref, or `side` projected square to the tangent;
// twist(u) turns it about its length, v0 / v1 = the texture coordinate at the two ends (v 1 = top of the canvas). Front face: S x T points at the viewer, so with side = (1, 0, 0)
// and v rising along the strip, a printed texture reads upright and un-mirrored from the front.
export class Ribbon {
  constructor(mat, n, parent, { cast = false, recv = true } = {}) {
    this.n = n; const N = (n + 1) * 2; this.pos = new Float32Array(N * 3); this.nor = new Float32Array(N * 3); this.uv = new Float32Array(N * 2);
    const idx = []; for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.castShadow = cast; this.mesh.receiveShadow = recv; this.mesh.userData.noOutline = true; if (parent) parent.add(this.mesh);
  }
  set(P, width, ref = _R, twist = null, v0 = 1, v1 = 0, side = null) {
    const n = this.n;
    for (let i = 0; i <= n; i++) {
      const u = i / n; _T.subVectors(P[Math.min(i + 1, n)], P[Math.max(i - 1, 0)]); if (_T.lengthSq() < 1e-10) _T.set(0, 0, 1); _T.normalize();
      if (side) { _S.copy(side).addScaledVector(_T, -side.dot(_T)); if (_S.lengthSq() < 1e-6) _S.crossVectors(_T, ref); } else _S.crossVectors(_T, ref); if (_S.lengthSq() < 1e-6) _S.crossVectors(_T, _R2); _S.normalize();
      if (twist) { const a = twist(u), c = Math.cos(a), s = Math.sin(a); _A.crossVectors(_T, _S); _S.multiplyScalar(c).addScaledVector(_A, s); }
      _N.crossVectors(_S, _T).normalize();
 const w = (typeof width === 'function' ? width(u) : width) / 2, v = lerp(v0, v1, u);
      for (let k = 0; k < 2; k++) { const j = (i * 2 + k), sg = k ? 1 : -1; this.pos[j * 3] = P[i].x + _S.x * w * sg; this.pos[j * 3 + 1] = P[i].y + _S.y * w * sg; this.pos[j * 3 + 2] = P[i].z + _S.z * w * sg;
        this.nor[j * 3] = _N.x; this.nor[j * 3 + 1] = _N.y; this.nor[j * 3 + 2] = _N.z; this.uv[j * 2] = k; this.uv[j * 2 + 1] = v; }
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.uv.needsUpdate = true;
  }
}
const pts = (n) => Array.from({ length: n + 1 }, () => new THREE.Vector3());

// thermal paper: warm white, a little emissive so printed text stays readable in the dark stall
function paperMat(map, { emis = 0.3, alphaTest = 0 } = {}) {
  return new THREE.MeshStandardMaterial({ color: '#e9e5d6', map, roughness: 1, envMapIntensity: 0.2, side: THREE.DoubleSide, emissive: '#fff4dc', emissiveMap: map, emissiveIntensity: emis * 0.4, alphaTest, transparent: false });   // not brighter than the bloom threshold, or the glare washes the thin black text grey
}
// the long strip that pours out of the printer: faint grey text lines and a thin dark bar, repeating
function stripTex() {
  return canvasTex(128, 512, (c, w, h) => { c.fillStyle = '#fffdf4'; c.fillRect(0, 0, w, h); for (let i = 0; i < 20; i++) { const y = 14 + i * 25, ln = 0.35 + 0.55 * hash(i * 3.3); c.fillStyle = i % 7 === 0 ? 'rgba(40,36,34,0.7)' : 'rgba(60,54,50,0.38)'; c.fillRect(16, y, (w - 32) * ln, i % 7 === 0 ? 9 : 6); if (hash(i * 5.1) > 0.55) c.fillRect(16 + (w - 32) * ln + 8, y, 12, 6); } c.fillStyle = 'rgba(40,36,34,0.55)'; c.fillRect(0, 0, w, 4); c.fillRect(0, h - 4, w, 4); }, { repeat: [1, 1], aniso: 4 });
}

// ---------------------------------------------------------------------------------------------------------------------
// the follower phone: a phone body with the counter on its screen. opts: { keys, roll, name, sub } (see followerScreen); the screen faces local -z, like phoneProp.
// update(t, names): redraws the screen; the phone throws a soft blue light (only built here, so no earlier episode gets an extra light).
export function makeFollowerPhone(opts) {
  const g = new THREE.Group(), S = opts.size ?? 2.2, PW = 0.075 * S, PH = 0.15 * S;   // size: a cartoon phone, bigger than life so the number reads at phone size (the sizes are baked in, so the ink outline stays thin)
  mesh(new RoundedBoxGeometry(PW, PH, 0.009 * S, 3, 0.008 * S), std('#16161d', { roughness: 0.3, metalness: 0.4 }), [0, 0, 0], g);
  const SW = 512, SH = Math.round(512 * 0.138 / 0.066), tex = canvasTex(SW, SH, () => {}, { mip: true }); tex.anisotropy = 8;
  const scr = mesh(new THREE.PlaneGeometry(0.066 * S, 0.138 * S), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.2, 1.2, 1.2) }), [0, 0, -0.0052 * S], g, { cast: false, rot: [0, Math.PI, 0] });
  const light = new THREE.PointLight('#8fc4ff', 0, 2.2, 2); light.position.set(-0.07 * S, 0.03 * S, -0.14 * S); g.add(light);   // in front of the screen (towards the holder's face)
  const c = tex.userData.ctx; let last = -1e9;
  return { group: g, screen: scr, light, S, update(t, names = 0, glow = 0.5) {
    if (t !== last) { last = t; c.save(); c.translate(SW / 2, SH / 2); followerScreen(c, SW, SH, t, { ...opts, names }); c.restore(); tex.needsUpdate = true; }
    light.intensity = glow; } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bíp's slip. text: ['34.700', 'LƯỢT XEM', '2 NGÀY'] or '34.700 LƯỢT XEM · 2 NGÀY' (split at the dots; a leading number gets its own big line).
export function slipLines(text) {
  if (Array.isArray(text)) return text;
  const out = []; for (const part of String(text).split(/\s*[·|\n]\s*/)) { const m = part.match(/^([\d.,]+)\s+(.+)$/); if (m) out.push(m[1], m[2]); else if (part) out.push(part); } return out;
}
export function slipTex(lines, W = 512, H = 1280) {
  return canvasTex(W, H, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = '#fbf8ee'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, 22); for (let i = 0; i <= 16; i++) c.lineTo(i * w / 16, i % 2 ? 0 : 22); c.lineTo(w, h); c.closePath(); c.fill();   // zig-zag torn end at the TOP (the tail, last out of the printer), straight cut at the bottom (the tip)
    for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(120,100,70,${0.025 * hash(i)})`; c.fillRect(hash(i * 1.7) * w, hash(i * 3.1) * h, 2, 2); }
    c.fillStyle = '#060606'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = FONT(34, 800, 'UI'); c.fillText('BÍP IN', w / 2, 70); c.fillStyle = '#060606'; for (let x = 28; x < w - 28; x += 24) c.fillRect(x, 104, 14, 4);
    const L = lines.length ? lines : ['34.700'], n = L.length; let y = 150; const room = h - 150 - 250;
    L.forEach((ln, i) => { const big = i === 0, sz = big ? 190 : 100, wmax = w - 60; let s = sz; c.font = FONT(s, 900); while (c.measureText(ln).width > wmax && s > 30) { s -= 4; c.font = FONT(s, 900); } const slot = big ? room * 0.42 : room * 0.58 / Math.max(1, n - 1); c.fillStyle = '#050505'; c.fillText(ln, w / 2, y + slot / 2); y += slot; });
    for (let x = 28; x < w - 28; x += 24) c.fillRect(x, h - 220, 14, 4);
    let bx = 60; for (let i = 0; bx < w - 60; i++) { const bw = 3 + Math.floor(hash(i * 2.3) * 9); c.fillRect(bx, h - 190, bw, 110); bx += bw + 4 + Math.floor(hash(i * 4.9) * 6); }
  }, { aniso: 8 });
}
// a slip: ribbon with the printed texture. w x len metres. Returns { ribbon, mat, tex, w, len }.
export function makeSlip(text, parent, { w = 0.1, len = 0.25 } = {}) {
  const tex = slipTex(slipLines(text)), mat = paperMat(tex, { emis: 0.34, alphaTest: 0.5 }), ribbon = new Ribbon(mat, 16, parent, { cast: true, recv: true }); ribbon.mesh.visible = false;
  return { ribbon, mat, tex, w, len };
}

// ---------------------------------------------------------------------------------------------------------------------
// The paper flood out of Bíp's chest. Built lazily in the SCENE (not under Bíp's root) so it can land on Tèo and the table in world space.
// streams: long ribbons from the slot to their landing points, looping on the way, texture running along them (the paper flows); pile: short crumpled strips that fall onto the
// table (low in front of the plate so the spark stays visible), onto the floor and the side of the table.
export function makeFlood(bipRoot, { n = 8, pieces = 46 } = {}) {
  let G = null, st = null, teoRoot = null;
  const mat = paperMat(stripTex(), { emis: 0.26 });
  const build = () => {
    G = new THREE.Group(); G.name = 'flood'; bipRoot.parent.add(G); st = [];
    for (let i = 0; i < n; i++) st.push({ r: new Ribbon(mat, 40, G), P: pts(40), h: hash(i * 3.7), w: 0.045 + 0.03 * hash(i * 2.1), om: 1.3 + 1.2 * hash(i * 5.3), ph: hash(i * 7.9) });
    G.userData.pile = [];
    for (let k = 0; k < pieces; k++) G.userData.pile.push({ r: new Ribbon(mat, 7, G, { cast: true }), P: pts(7), h: [hash(k * 1.3 + 0.1), hash(k * 2.9 + 0.2), hash(k * 4.1 + 0.3), hash(k * 6.7 + 0.4), hash(k * 8.3 + 0.5)] });
    teoRoot = bipRoot.parent.getObjectByName('teo');
  };
  const S = new THREE.Vector3(), Lp = new THREE.Vector3(), C = new THREE.Vector3(), H0 = new THREE.Vector3();
  return {
    // flood 0..1 (stream + pile), pour 0..1 (1 = the paper keeps coming; 0 = the paper stops and the last of it falls; Bíp's fx floodStop 0 -> 1 drives it), t in seconds
    update(t, flood, pour = 1, body = null) {
      if (flood <= 0.0005 && !G) return; if (!G) build(); G.visible = flood > 0.0005; if (!G.visible) return;
      bipRoot.updateMatrixWorld(true); const wtop = bipRoot.localToWorld(S.set(0, 0.6, 0.12)).clone(), fwd = V(0, 0, 1).applyQuaternion(bipRoot.quaternion);
      const head = teoRoot?.userData.api?.headWorld?.(H0) ? H0.clone() : V(-0.42, 1.12, 0.0);
      const tx = [[head.x + 0.02, head.y + 0.16, head.z], [head.x - 0.06, head.y + 0.1, head.z + 0.04], [head.x - 0.2, head.y - 0.26, head.z + 0.02], [head.x + 0.2, head.y - 0.28, head.z + 0.05], [-0.15, 0.505, 0.42], [-0.32, 0.5, 0.3], [0.9, 0.02, 0.72], [0.62, 0.5, 0.56]];
      const grow = smooth(clamp(flood * 6)), tail = smooth(clamp(1 - pour));
      st.forEach((s, i) => {
        const a0 = tail * 0.98, a1 = grow; s.r.mesh.visible = a1 - a0 > 0.02; if (!s.r.mesh.visible) return;
        const tg = tx[i % tx.length]; Lp.set(tg[0], tg[1], tg[2]); C.copy(wtop).add(Lp).multiplyScalar(0.5).addScaledVector(fwd, 0.4 + 0.25 * s.h).add(V(0, 0.18 + 0.2 * s.h - (Lp.y > 0.9 ? 0.15 : 0), 0));
        const R = 0.05 + 0.04 * s.h, om = s.om, f = 0.55;
        for (let j = 0; j <= 40; j++) { const a = lerp(a0, a1, j / 40), q = 1 - a, p = s.P[j];
          p.set(q * q * wtop.x + 2 * q * a * C.x + a * a * Lp.x, q * q * wtop.y + 2 * q * a * C.y + a * a * Lp.y, q * q * wtop.z + 2 * q * a * C.z + a * a * Lp.z);
          const ph = 2 * Math.PI * (om * a - f * t + s.ph), env = Math.pow(Math.sin(Math.PI * Math.min(1, a * 1.05)), 0.7) * R * (0.4 + 0.6 * smooth(a * 3));   // loops: a travelling curl, bigger mid-flight
          p.x += Math.cos(ph) * env; p.y += Math.sin(ph) * env * 0.8; p.z += Math.sin(ph * 2) * env * 0.3 + 0.0; }
        s.r.set(s.P, s.w * (0.7 + 0.3 * smooth(grow)), _R, (u) => (u * 5 + s.ph * 6 - t * 0.7) * 1.1, 0 + (-t * 0.9 + s.h * 3), 1.6 + (-t * 0.9 + s.h * 3));
      });
      // the pile: short strips that fall in one after another as flood rises
      const table = V(0.0, 0.4795, 0.42);
      G.userData.pile.forEach((p, k) => { const h = p.h, thr = 0.04 + 0.9 * h[0], u = smooth((flood - thr) / 0.07); p.r.mesh.visible = u > 0.003; if (!p.r.mesh.visible) return;
        const where = k % 11;   // 0-6 table, 7-8 floor, 9 table edge front, 10 beside Bíp
        let x, z, y0, mound;
        if (where < 7) { x = lerp(-0.4, 0.3, h[1]); z = lerp(0.24, 0.64, h[2]); mound = 0.03 + 0.05 * Math.exp(-(((x + 0.12) ** 2) / 0.05 + ((z - 0.46) ** 2) / 0.04)); y0 = table.y + 0.006 * Math.floor(h[3] * 5) + mound * flood * h[4]; }
        else if (where < 9) { x = lerp(-1.0, 1.2, h[1]); z = lerp(0.7, 1.1, h[2]); y0 = 0.012 + 0.008 * Math.floor(h[3] * 3); }
        else if (where === 9) { x = lerp(-0.4, 0.2, h[1]); z = lerp(0.62, 0.8, h[2]); y0 = 0.46; }
        else { x = lerp(0.62, 0.95, h[1]); z = lerp(0.3, 0.6, h[2]); y0 = 0.012 + 0.01 * h[3]; }
        const fall = 0.45 * (1 - easeOut(u)), yaw = h[3] * 6.28, len = 0.1 + 0.08 * h[4], bend = 0.02 + 0.03 * h[1], cx = x, cz = z, cy = y0 + fall + 0.004;
        const cs = Math.cos(yaw), sn = Math.sin(yaw);
        for (let j = 0; j <= 7; j++) { const a = (j / 7 - 0.5) * len, b = Math.sin((j / 7) * Math.PI) * bend; p.P[j].set(cx + a * cs, cy + b, cz + a * sn); }
        p.r.set(p.P, 0.05 + 0.025 * h[2], _R, (uu) => (uu - 0.5) * 1.4 * (h[0] - 0.5), 0.2 + h[1], 0.9 + h[2]); p.r.mesh.scale.setScalar(clamp(u * 1.6)); });
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// paper on Tèo (castOpts teo: { paper: true }): bits resting on his hair and shoulders (fx paper 0..1: they fall in one by one), a sheet over his face (fx paperFace 0..1: drops from above),
// and paperBrush 0..1 flings the sheet and every bit off to the side and down. Parts live in Tèo's head / body groups, so they move with him.
export function makePaperOn(body, head, R) {
  const mat = paperMat(stripTex(), { emis: 0.22 }), bits = [], N = 16;
  for (let i = 0; i < N; i++) { const h = [hash(i * 1.7 + 0.2), hash(i * 3.3 + 0.4), hash(i * 5.9 + 0.6), hash(i * 7.3 + 0.8)], onHead = i < 9, par = onHead ? head : body;
    const r = new Ribbon(mat, 6, par); r.mesh.visible = false; bits.push({ r, h, onHead, P: pts(6) }); }
  // the sheet over his face: a curved plate in front of the glasses
  const sheetG = new THREE.Group(); head.add(sheetG); const sg = new THREE.CylinderGeometry(R * 1.12, R * 1.12, 0.17, 24, 1, true, -0.9, 1.8); const sheet = new THREE.Mesh(sg, paperMat(stripTex(), { emis: 0.22 })); sheet.userData.noOutline = true; sheet.castShadow = false; sheet.position.set(0, 0.035, 0); sheet.rotation.y = 0; sheetG.add(sheet); sheetG.visible = false;
  sheet.material.map.repeat.set(1, 0.6);
  return { update(t, paper, face, brush) {
    const any = paper > 0.001 || face > 0.001; sheetG.visible = face > 0.001 && brush < 0.995; for (const b of bits) b.r.mesh.visible = false; if (!any) return;
    bits.forEach((b, i) => { const h = b.h, thr = 0.05 + 0.85 * (i / N), u = smooth((paper - thr) / 0.08) * (1 - smooth(brush * 1.2 - h[0] * 0.2)); b.r.mesh.visible = u > 0.004; if (!b.r.mesh.visible) return;
      let cx, cy, cz, yaw, len = 0.12 + 0.07 * h[1];
      if (b.onHead) { const a = (h[0] - 0.5) * 2.2, el = 0.9 + 0.5 * h[1]; cx = Math.sin(a) * Math.cos(el * 0.4) * (R * 0.9); cy = 0.12 + Math.cos(el) * R * 0.7 + 0.02; cz = (h[2] - 0.55) * R * 0.9; yaw = h[3] * 3; }
      else { const s = i % 2 ? 1 : -1; cx = s * (0.1 + 0.07 * h[0]); cy = 0.725 + 0.012 * h[2]; cz = (h[1] - 0.5) * 0.12 - 0.01; yaw = h[3] * 2 - 1; }
      const fall = 0.5 * (1 - easeOut(smooth((paper - thr) / 0.08))), fling = smooth(brush * 1.3 - h[2] * 0.3), dx = fling * (0.5 + 0.3 * h[3]), dy = -fling * 0.25;
      const cs = Math.cos(yaw), sn = Math.sin(yaw); for (let j = 0; j <= 6; j++) { const a = (j / 6 - 0.5) * len, bend = Math.sin((j / 6) * Math.PI) * (0.02 + 0.015 * h[0]); b.P[j].set(cx + a * cs + dx, cy + bend + fall + dy, cz + a * sn); }
      b.r.set(b.P, 0.05 + 0.02 * h[3], _R, (uu) => (uu - 0.5) * 1.2 * (h[0] - 0.5), 0.1 + h[2], 0.9 + h[3]); b.r.mesh.scale.setScalar(clamp(u * 1.8)); });
    if (sheetG.visible) { const e = easeOut(face), fl = smooth(brush); sheetG.position.set(0.52 * fl, 0.28 * (1 - e) - 0.2 * fl, 0.0); sheetG.rotation.z = -0.9 * fl + 0.05 * (1 - e); sheetG.rotation.x = 0.15 * (1 - e); }
  } };
}

// ---------------------------------------------------------------------------------------------------------------------
// a stack of plastic stools (Bà carries it above her head): n units, alternating red / blue. Origin at the bottom of the stack, y up. Returns { group, height, units }.
export function makeStoolStack(n = 7) {
  const g = new THREE.Group(), units = [], UH = 0.088;
  const mats = ['#d63a34', '#2a6fd0'].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.35 }));
  for (let i = 0; i < n; i++) { const u = new THREE.Group(), m = mats[i % 2]; u.position.y = i * UH; g.add(u);
    const b = cyl(0.128, 0.17, 0.082, m, [0, 0.041, 0], u, {}, 4); b.rotation.y = Math.PI / 4; mesh(new RoundedBoxGeometry(0.24, 0.03, 0.24, 2, 0.012), m, [0, 0.092, 0], u); units.push(u); }
  return { group: g, height: n * UH + 0.03, units, UH };
}

// ---------------------------------------------------------------------------------------------------------------------
// the row of stools down the pavement (stall setOpts.row: true | { n, twice, z, x0, gap }). Default: as long as the stall frontage (12 stools). twice: about twice that (24).
// fx `row` 0..1 (acts on 'set'): the glasses light up one after another from the table outwards. Also builds the far shopfronts so the long row ends in a night street, not a void.
export function buildStoolRow(g, opts = {}, tileGround = 0) {
  const O = opts === true ? {} : opts, n = O.field ? 0 : (O.n ?? (O.twice ? 24 : 12)), z0 = O.z ?? 1.55, x0 = O.x0 ?? 1.7, gap = O.gap ?? 0.56, grp = new THREE.Group(); grp.name = 'stoolRow'; g.add(grp);
  const mats = ['#2a6fd0', '#d63a34'].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35, emissive: c, emissiveIntensity: 0.1 }));
  const bodyG = new THREE.CylinderGeometry(0.135, 0.185, 0.25, 4), seatG = new RoundedBoxGeometry(0.235, 0.03, 0.235, 2, 0.012);
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, roughness: 0.04, depthWrite: false });
  const glT = canvasTex(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); });
  const items = [];
  for (let i = 0; i < n; i++) {
    const h = hash(i * 3.17 + 1), x = x0 - i * gap - 0.05 * Math.sin(i * 2.3), z = z0 + 0.09 * Math.sin(i * 1.7 + 0.5) + (i % 3 === 0 ? 0.05 : 0), s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = (h - 0.5) * 0.7; grp.add(s);
    const m = mats[i % 2], b = new THREE.Mesh(bodyG, m); b.position.y = 0.125; b.rotation.y = Math.PI / 4; b.castShadow = i < 6; b.receiveShadow = true; s.add(b); const st = new THREE.Mesh(seatG, m); st.position.y = 0.265; st.castShadow = i < 6; st.receiveShadow = true; s.add(st);
    const q = new THREE.Group(); q.position.set(0.01, 0.28, 0.01); s.add(q);
    cyl(0.034, 0.027, 0.105, glassM, [0, 0.0525, 0], q, { cast: false }, 18);
    const tea = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb04a', emissiveIntensity: 0, roughness: 0.2 }); cyl(0.0305, 0.0255, 0.08, tea, [0, 0.043, 0], q, { cast: false }, 18);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glT, color: new THREE.Color(1.7, 0.95, 0.32), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(0.36); halo.position.set(0, 0.06, 0); q.add(halo);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: glT, color: new THREE.Color(1.4, 0.7, 0.22), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.012 + tileGround, 0); pool.renderOrder = 1; s.add(pool);
    items.push({ s, tea, halo, pool, i, seed: h });
  }
  // far shopfronts along the street behind the row (the stall's own wall ends at x = -5.2): dark shutters, some lit windows, a few strings of bulbs
  const far = new THREE.Group(); grp.add(far); const farW = Math.abs(x0 - n * gap) + 8, wx0 = -5.2, wx1 = -5.2 - Math.max(14, farW - 8);
  const wallC = canvasTex(1024, 512, (c, w, h) => { c.fillStyle = '#4a3a30'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { const x = i * 128 + 14; c.fillStyle = '#2a2320'; c.fillRect(x, 150, 100, 300); if (hash(i * 3.3) > 0.45) { c.fillStyle = hash(i * 1.9) > 0.5 ? '#ffcf8a' : '#e7b4a0'; c.fillRect(x + 8, 40, 84, 90); } else { c.fillStyle = '#1c1816'; c.fillRect(x + 8, 40, 84, 90); } } }, { repeat: [Math.ceil(Math.abs(wx1 - wx0) / 5), 1] });
  const emT = canvasTex(1024, 512, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { const x = i * 128 + 14; if (hash(i * 3.3) > 0.45) { c.fillStyle = hash(i * 1.9) > 0.5 ? '#ffb860' : '#d08c70'; c.fillRect(x + 8, 40, 84, 90); } } }, { repeat: [Math.ceil(Math.abs(wx1 - wx0) / 5), 1] });
  const fw = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(wx1 - wx0), 5.2), new THREE.MeshStandardMaterial({ map: wallC, emissive: '#fff', emissiveMap: emT, emissiveIntensity: 0.9, roughness: 0.95 })); fw.position.set((wx0 + wx1) / 2, 2.6, -1.52); far.add(fw);
  const bulbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, 0.7), toneMapped: false });
  for (let k = 0; k < Math.floor(Math.abs(wx1 - wx0) / 0.7); k++) { const bx = wx0 - 0.4 - k * 0.7, by = 2.35 - 0.12 * Math.sin(k * 0.9), b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), bulbM); b.position.set(bx, by, -1.2); far.add(b); }
  // ---- field (O.field: true | { x0, x1, z0, z1, pitch, avoid: [[x, z, r], ...] }): the whole pavement in front of the stall covered with plastic stools, each with a lit glass of iced tea, in neat-but-human rows
  // (a half-pitch shift per row, a little jitter and turn). Instanced (5 draw calls). fx `row` 0 -> 1 rolls a wave away from the stall: each stool grows in (one eased overshoot) and its glass lights up. A warm haze lifts the far end. ----
  let fieldUpd = null;
  if (O.field) {
    const F = O.field === true ? {} : O.field, fx0 = F.x0 ?? -17, fx1 = F.x1 ?? 3.0, fz0 = F.z0 ?? 1.45, fz1 = F.z1 ?? 11.5, pitch = F.pitch ?? 0.72, avoid = F.avoid ?? [[0.5, 2.6, 0.7]], list = [];
    for (let rz = 0, zz = fz0; zz <= fz1; rz++, zz += pitch) for (let cx = 0, xx = fx1 - (rz % 2) * pitch * 0.5; xx >= fx0; cx++, xx -= pitch) {
      const h1 = hash(rz * 31.7 + cx * 7.13 + 3.1), h2 = hash(rz * 12.9 + cx * 4.31 + 9.7), h3 = hash(rz * 5.3 + cx * 17.9 + 1.3), x = xx + (h1 - 0.5) * 0.12, z = zz + (h2 - 0.5) * 0.12;
      if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
      list.push({ x, z, yaw: (h3 - 0.5) * 0.9, blue: hash(rz * 2.7 + cx * 1.9 + 0.5) > 0.5, d: Math.hypot(x, z - 0.6), ph: h1 });
    }
    const N = list.length, maxD = Math.max(...list.map((q) => q.d)), IM = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, N); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.userData.noOutline = true; grp.add(m); return m; };
    const fm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, emissive: '#5a3418', emissiveIntensity: 0.6 });
    const bodyI = IM(bodyG, fm), seatI = IM(seatG, fm);
    const glassI = IM(new THREE.CylinderGeometry(0.034, 0.027, 0.105, 12), glassM);
    const teaM2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.35, 0.4), toneMapped: false }), teaI = IM(new THREE.CylinderGeometry(0.0305, 0.0255, 0.08, 12), teaM2);
    const poolM = new THREE.MeshBasicMaterial({ map: glT, color: new THREE.Color(1.3, 0.68, 0.22), transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const poolI = IM(new THREE.PlaneGeometry(0.7, 0.7), poolM); poolI.renderOrder = 1; poolI.receiveShadow = false;
    const cA = new THREE.Color('#1f62d2'), cB = new THREE.Color('#d42a26'); list.forEach((q, i) => { const c = q.blue ? cA : cB; bodyI.setColorAt(i, c); seatI.setColorAt(i, c); });
    const hazeM = new THREE.MeshBasicMaterial({ map: glT, color: new THREE.Color(1.2, 0.62, 0.22), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const hazes = [0.5, 1.0].map((y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(fx1 - fx0) + 10, fz1 - fz0 + 8), hazeM); m.rotation.x = -Math.PI / 2; m.position.set((fx0 + fx1) / 2, y, (fz0 + fz1) / 2); m.renderOrder = 2; grp.add(m); return m; });
    const D = new THREE.Object3D(), up = (u) => { const k = clamp(u); return k < 1 ? smooth(k) * (1 + 0.1 * Math.sin(Math.PI * k)) : 1; };   // eased grow with one small overshoot
    fieldUpd = (t, r) => {
      list.forEach((q, i) => { const g = Math.max(0.001, up(r * 1.5 - (q.d / maxD) * 0.5)), lit = clamp(r * 1.5 - (q.d / maxD) * 0.5 - 0.15);
        D.rotation.set(0, q.yaw, 0); D.position.set(q.x, 0, q.z); D.scale.setScalar(g); D.updateMatrix(); bodyI.setMatrixAt(i, D.matrix); seatI.setMatrixAt(i, D.matrix);
        D.position.set(q.x + 0.01, 0.28 * g, q.z + 0.01); D.updateMatrix(); glassI.setMatrixAt(i, D.matrix); D.position.y = 0.28 * g; D.scale.setScalar(g * smooth(lit)); D.updateMatrix(); teaI.setMatrixAt(i, D.matrix);
        D.rotation.set(-Math.PI / 2, 0, 0); D.position.set(q.x, 0.012 + tileGround, q.z); D.scale.setScalar(smooth(lit) * (0.9 + 0.1 * Math.sin(t * 0.8 + q.ph * 20))); D.updateMatrix(); poolI.setMatrixAt(i, D.matrix); });
      for (const m of [bodyI, seatI, glassI, teaI, poolI]) m.instanceMatrix.needsUpdate = true; if (bodyI.instanceColor) { bodyI.instanceColor.needsUpdate = seatI.instanceColor.needsUpdate = true; }
      hazeM.opacity = 0.1 * smooth(r * 1.2 - 0.2);
    };
  }
  grp.visible = false;
  return { group: grp, update(t, fx = {}) {
    const r = clamp(fx.row ?? (O.on === false ? 0 : 1)); grp.visible = r > 0.001; if (!grp.visible) return; fieldUpd?.(t, r);
    items.forEach((it) => { const k = it.i / Math.max(1, n - 1), u = smooth(r * 1.9 - k * 0.9), fl = 0.93 + 0.07 * noise1(t * 0.8 + it.seed * 20, it.i);   // lights come on from the table outwards (a slow flicker, never per frame)
      it.tea.emissiveIntensity = 2.0 * u * fl; it.halo.material.opacity = 0.85 * u * fl; it.pool.material.opacity = 0.5 * u; }); } };
}
