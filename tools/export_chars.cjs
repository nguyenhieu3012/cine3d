// cine3d export for other renderers (Blender): the EXACT character models, as binary glTF in a neutral rest pose, plus a JSON of joints, face placement, outline and palette.
//   node tools/export_chars.cjs <pack> <name...> [--out out/chars/]        e.g.  trada teo bip ba me khach   |   goat ron leo
// Writes, per character:  <name>_seated.glb  <name>_tpose.glb  (Teo, Bip also <name>_stand_tpose.glb with standing legs; Ba and Me stand by design: <name>_standing.glb)  and  <name>.joints.json
// Nothing in core/ or packs/ is changed: the character is built by its own builder (packs/index.js), posed with its own apply(), outlined with its own inkOutline() only to
// RECORD which meshes get an outline (the outline shells are then removed: they are NOT in the GLB; colour and thickness are in the JSON), and exported with three's GLTFExporter.
// Every mesh is baked into the character root frame (metres, Y up, +Z = the way he faces, origin on the floor under the seat) so the GLB has no node transforms to untangle.
// Documentation: ENGINE.md, "Export for other renderers (15/11)".
const fs = require('fs'), path = require('path'), { start, flagOf } = require('./_page.cjs');
const args = process.argv.slice(2), flag = flagOf(args), pack = args[0], names = []; for (let i = 1; i < args.length && !args[i].startsWith('--'); i++) names.push(args[i]);
const out = flag('out', 'out/chars/');
if (!pack || !names.length) { console.log('usage: node tools/export_chars.cjs <trada|goat> <name...> [--out out/chars/]'); process.exit(1); }
const LOOK_EP = { trada: 'demo/trada_look.js', goat: 'demo/goat_look.js' };   // any episode of the pack: only used to start the page (fonts, stage, shaders)

// runs inside the page
async function exportChar({ pack, name, pose }) {
  const THREE = await import('three'), { PACKS } = await import('/packs/index.js'), rig = await import('/core/rig.js'), { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const R5 = (x) => Math.round(x * 1e5) / 1e5, A3 = (v) => [R5(v.x), R5(v.y), R5(v.z)], BL = (v) => [R5(v.x), R5(-v.z), R5(v.y)];   // BL: three (x, y, z) -> Blender (x, -z, y)
  const K = { teo: { arm: 0.37, idle: 1, blink: 1 }, bip: { arm: 0.3, idle: 2, blink: 7 }, ba: { arm: 0.37, idle: 11, blink: 11 }, me: { arm: 0.37, idle: 17, blink: 17 }, khach: { arm: 0.37, idle: 23, blink: 23 }, ron: { arm: 0.41, idle: 11, blink: 11 }, leo: { arm: 0.38, idle: 23, blink: 23 } }[name];
  const EYE = { teo: [19.5, 4, -22], ba: [19.5, 4, -22], me: [19.5, 4, -22], khach: [19.5, 4, -22], ron: [21.5, 3, -23.5], leo: [20, 3, -24] }[name] || null;   // eye yaw, eye pitch, mouth pitch (degrees on the face patch), from each drawFace()
  const c = PACKS[pack].chars[name]({}); c.name = name; c.root.name = name; c.root.position.set(0, 0, 0); c.root.rotation.set(0, 0, 0);
  const inkCfg = PACKS[pack].outline, nInk = rig.inkOutline(c.root, inkCfg), outlined = new Set(), shells = [];
  c.root.traverse((o) => { if (o.userData.isOutline) { shells.push(o); outlined.add(o.parent); } });
  for (const o of shells) { if (o.parent.userData.noodle) o.parent.userData.noodle.outline = null; o.parent.remove(o); }
  // idle life (breathing, sway, head drift) is in every apply(): choose the instant where all of it is nearest to zero, with the eyes open
  let T = 0, best = 1e9, resid = null;
  for (let i = 0; i < 8000; i++) { const t = i * 0.005, id = rig.idle(t, K.idle), hov = name === 'bip' ? Math.sin(t * 2.1 + 1) / 1 : 0;
    const s = Math.abs(id.breathe) + Math.abs(id.sway) / 0.012 + Math.abs(id.headYaw) / 0.035 + Math.abs(id.headPitch) / 0.03 + Math.abs(id.headRoll) / 0.02 + Math.abs(hov) + (rig.blink(t, K.blink) > 0 || rig.blink(t - 0.2, K.blink) > 0 ? 50 : 0) + (name === 'bip' ? (rig.blink(t, K.blink - 2) > 0 ? 50 : 0) : 0);
    if (s < best) { best = s; T = t; resid = { breathe: R5(id.breathe), sway: R5(id.sway), headYaw: R5(id.headYaw), headPitch: R5(id.headPitch), headRoll: R5(id.headRoll) }; } }
  const F = { ...c.faces.neutral }, base = { face: F, talk: 0 }, standing = name === 'ba' || name === 'me';
  const stand = pose === 'stand_tpose' ? { stand: 1 } : {};
  const apply = (l, r) => { c.apply({ ...base, ...stand, l, r }, T); c.root.updateMatrixWorld(true); };
  const vis = (o) => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
  const box = (o) => new THREE.Box3().setFromObject(o, true);
  // ---- limbs from the Noodle tubes (exact: each tube keeps its bezier curve) ----
  function tubes() { const L = []; c.root.updateMatrixWorld(true); c.root.traverse((o) => { if (!o.isMesh || !o.userData.noodle || !vis(o)) return; const nd = o.userData.noodle, W = (v) => v.clone().applyMatrix4(o.matrixWorld); L.push({ mesh: o, nd, p0: W(nd.curve.v0), p1: W(nd.curve.v1), p2: W(nd.curve.v2), mid: W(nd.curve.getPointAt(0.5)) }); }); return L; }
  let torso = null, torsoBox = null; c.root.traverse((o) => { if (!o.isMesh || o.userData.noodle || !vis(o) || o.geometry.type !== 'LatheGeometry') return; const b = box(o), v = b.getSize(new THREE.Vector3()); const vol = v.x * v.y * v.z; if (!torso || vol > torso.vol) torso = { o, vol, b }; });
  const neckBase = new THREE.Vector3(0, torso.b.max.y, (torso.b.min.z + torso.b.max.z) / 2);
  const cls = new Map();   // arm / leg and side of each tube, decided once in the rest pose (a probe pose may put a hand anywhere)
  function limbs() {
    const L = tubes(), out = {};
    for (const t of L) { if (!cls.has(t.mesh)) cls.set(t.mesh, { leg: Math.min(t.p0.y, t.p2.y) < 0.3, side: (t.p0.x + t.p2.x) / 2 >= 0 ? 'L' : 'R' }); const { leg, side } = cls.get(t.mesh), key = (leg ? 'leg_' : 'arm_') + side; (out[key] ||= { leg, side, tubes: [] }).tubes.push(t); }
    for (const g of Object.values(out)) { const ends = g.tubes.flatMap((t) => [t.p0, t.p2]);
      if (g.leg) { g.top = ends.reduce((a, b) => (b.y > a.y ? b : a)); g.end = ends.reduce((a, b) => (b.y < a.y ? b : a)); }
      else { const t0 = g.tubes.map((t) => t.p0).reduce((a, b) => (b.distanceTo(neckBase) < a.distanceTo(neckBase) ? b : a)); g.top = t0; g.end = ends.reduce((a, b) => (b.distanceTo(t0) > a.distanceTo(t0) ? b : a)); }
      for (const t of g.tubes) { const s = t.p0.distanceTo(g.top) < 0.02 || t.p2.distanceTo(g.top) < 0.02, e = t.p0.distanceTo(g.end) < 0.02 || t.p2.distanceTo(g.end) < 0.02; t.role = s && e ? 'full' : s ? 'upper' : e ? 'lower' : 'mid'; }
      const full = g.tubes.find((t) => t.role === 'full'), up = g.tubes.find((t) => t.role === 'upper'), lo = g.tubes.find((t) => t.role === 'lower');
      g.mid = full ? full.mid : up ? (up.p0.distanceTo(g.top) < 0.02 ? up.p2 : up.p0) : lo ? (lo.p0.distanceTo(g.end) < 0.02 ? lo.p2 : lo.p0) : g.top.clone().lerp(g.end, 0.5); }
    return out;
  }
  // ---- pose ----
  const rest = c.poses.rest; let info = {}, tinfo = null;
  if (pose === 'seated' || pose === 'standing') apply(rest.l, rest.r);
  else {
    apply(rest.l, rest.r); const L0 = limbs(), S = { l: L0.arm_R.top.clone(), r: L0.arm_L.top.clone() };   // engine l = screen-left = -x = the character's RIGHT arm
    const probe = (tl, tr) => { apply(tl, tr); const Lm = limbs(); return { l: Lm.arm_R.end.clone(), r: Lm.arm_L.end.clone() }; };
    const P0 = probe([0, 0, 0], [0, 0, 0]), Px = probe([1, 0, 0], [1, 0, 0]), Py = probe([0, 1, 0], [0, 1, 0]), Pz = probe([0, 0, 1], [0, 0, 1]), sol = {};
    for (const k of ['l', 'r']) { const M = new THREE.Matrix3(), cx = Px[k].clone().sub(P0[k]), cy = Py[k].clone().sub(P0[k]), cz = Pz[k].clone().sub(P0[k]); M.set(cx.x, cy.x, cz.x, cx.y, cy.y, cz.y, cx.z, cy.z, cz.z);
      const D = S[k].clone().add(new THREE.Vector3(k === 'l' ? -K.arm : K.arm, 0, 0)), v = D.sub(P0[k]).applyMatrix3(M.clone().invert()); sol[k] = [v.x, v.y, v.z]; }
    apply(sol.l, sol.r); const Lc = limbs(); tinfo = { target_l: sol.l.map(R5), target_r: sol.r.map(R5), arm_length_used: K.arm, hand_error_m: R5(Math.max(Lc.arm_R.end.distanceTo(S.l.clone().add(new THREE.Vector3(-K.arm, 0, 0))), Lc.arm_L.end.distanceTo(S.r.clone().add(new THREE.Vector3(K.arm, 0, 0))))) };
  }
  const LM = limbs(), hasLegs = !!(LM.leg_L && LM.leg_R), side = (s, a, b) => (s === 'L' ? a : b);
  // ---- head, face ----
  const R = c.R; c.head.updateWorldMatrix(true, false);
  const headPivot = c.head.getWorldPosition(new THREE.Vector3());
  let faceMesh = null; c.root.traverse((o) => { if (faceMesh || !o.isMesh || !vis(o)) return; const m = Array.isArray(o.material) ? o.material[0] : o.material, cv = m?.map?.userData?.canvas; if (!cv || cv.width < 256) return; for (let p = o.parent; p; p = p.parent) if (p === c.head) { faceMesh = o; break; } });
  const faceMat = faceMesh.material, cv = faceMat.map.userData.canvas, FW = cv.width, FH = cv.height;
  function uvToWorld(u, v) {   // exact point of the face mesh at texture coordinate (u, v), v up (three convention)
    const g = faceMesh.geometry, uv = g.attributes.uv, pos = g.attributes.position, ix = g.index, tri = (a, b, c2) => { const A = [uv.getX(a), uv.getY(a)], B = [uv.getX(b), uv.getY(b)], C = [uv.getX(c2), uv.getY(c2)], d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(d) < 1e-12) return null;
      const l1 = ((B[1] - C[1]) * (u - C[0]) + (C[0] - B[0]) * (v - C[1])) / d, l2 = ((C[1] - A[1]) * (u - C[0]) + (A[0] - C[0]) * (v - C[1])) / d, l3 = 1 - l1 - l2; if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) return null;
      return new THREE.Vector3().addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, a), l1).addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, b), l2).addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, c2), l3); };
    for (let i = 0; i < ix.count; i += 3) { const p = tri(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)); if (p) return faceMesh.localToWorld(p); } return null; }
  const px2w = (x, y) => uvToWorld(x / FW, 1 - y / FH);
  const gp = faceMesh.geometry.parameters || {}, isPatch = faceMesh.geometry.type === 'SphereGeometry';
  let eyesPx, mouthPx, faceInfo;
  if (isPatch) { const Yh = gp.phiLength * 90 / Math.PI, Ph = gp.thetaLength * 90 / Math.PI, kx = FW / (2 * Yh), ky = FH / (2 * Ph), X = (d) => FW / 2 + d * kx, Y = (d) => FH / 2 - d * ky;
    eyesPx = [[X(EYE[0]), Y(EYE[1])], [X(-EYE[0]), Y(EYE[1])]]; mouthPx = [X(0), Y(EYE[2])];   // [0] = +x eye (the character's LEFT eye... see eye_L), [1] = -x eye
    faceInfo = { kind: 'sphere_patch', radius_m: R5(gp.radius), yaw_half_deg: R5(Yh), pitch_half_deg: R5(Ph), px_per_deg: [R5(kx), R5(ky)], centre: 'the patch is centred on the head local +Z axis (straight ahead), u runs from the character\'s right to left (screen-left to screen-right seen from the front), v up', eye_deg: [EYE[0], EYE[1]], mouth_deg: [0, EYE[2]] }; }
  else { eyesPx = [[FW / 2 + 82, 141], [FW / 2 - 82, 141]]; mouthPx = [FW / 2, 250]; faceInfo = { kind: 'visor_grid', note: 'a 36 x 24 grid bent to the visor pillow (see the mesh), canvas x 512 y 352; bars 113 x 37 px at +-82 px from the centre, 141 px from the top; mouth dash at 250 px', grid_size_m: [R5(gp.width), R5(gp.height)] }; }
  const eyeW = eyesPx.map(([x, y]) => px2w(x, y)), mouthW = px2w(...mouthPx);
  const eyeL = eyeW.find((p) => p.x >= 0) || eyeW[0], eyeR = eyeW.find((p) => p !== eyeL);
  // ---- classify and name every visible mesh ----
  const hexOf = (m) => (m.color ? '#' + m.color.getHexString() : null);
  const skinMat = (() => { let s = null; c.root.traverse((o) => { if (s || !o.isMesh) return; for (let p = o.parent; p; p = p.parent) if (p === c.head) { if (o.geometry.type === 'SphereGeometry' && Math.abs((o.geometry.parameters.radius || 0) - R) < 1e-6 && o.geometry.parameters.phiLength > 6) s = o.material; } }); return s; })();
  const items = [], used = {}; const uniq = (n) => { used[n] = (used[n] || 0) + 1; return used[n] === 1 ? n : `${n}_${String(used[n]).padStart(2, '0')}`; };
  const J = {}; const S_ = (s) => LM['arm_' + s].top, H_ = (s) => LM['arm_' + s].end, HIP = (s) => LM['leg_' + s].top, ANK = (s) => LM['leg_' + s].end;
  const underHead = (o) => { for (let p = o.parent; p; p = p.parent) if (p === c.head) return true; return false; };
  const under = (o, g) => { for (let p = o.parent; p; p = p.parent) if (p === g) return true; return false; };
  const sideOf = (x) => (x >= 0 ? 'L' : 'R');
  const sizeOf = (b) => b.getSize(new THREE.Vector3());
  const skipped = [];
  c.root.traverse((o) => {
    if (!o.isMesh) return; if (!vis(o)) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m.transparent && m.opacity <= 0.001) { skipped.push({ what: 'invisible (opacity 0)', geometry: o.geometry.type }); return; }
    if (o.geometry.type === 'PlaneGeometry' && m.isMeshBasicMaterial && o.renderOrder === 1) { skipped.push({ what: 'contact shadow blob' }); return; }
    const b = box(o), ctr = b.getCenter(new THREE.Vector3()), sz = sizeOf(b), gt = o.geometry.type, gpm = o.geometry.parameters || {}; let nm = null, bone = null, tube = null;
    if (o.userData.noodle) {
      const t = Object.values(LM).flatMap((g) => g.tubes.map((tt) => [g, tt])).find(([, tt]) => tt.mesh === o), [g, tt] = t, s = g.side, hasFull = g.tubes.some((q) => q.role === 'full'), a = g.leg ? ['thigh', 'shin'] : ['upperarm', 'forearm'];
      if (tt.role === 'full') { nm = a[0]; tube = 'split'; } else if (tt.role === 'upper') { nm = hasFull ? (g.leg ? 'trouser' : 'sleeve') : a[0]; bone = a[0]; } else if (tt.role === 'lower') { nm = a[1]; bone = a[1]; } else { nm = 'limb_part'; bone = a[0]; }
      tube = tube || 'whole'; items.push({ o, m, nm: nm + '_' + s, bone: bone ? bone + '_' + s : null, tube, role: tt.role, group: g, b, ctr, gt, lowerName: a[1] + '_' + s, upperName: a[0] + '_' + s }); return; }
    if (under(o, c.head) || underHead(o)) {
      if (o === faceMesh) nm = 'face';
      else if (gt === 'SphereGeometry' && skinMat && m === skinMat && Math.abs(gpm.radius - R) < 1e-6 && gpm.phiLength > 6) nm = 'head';
      else if (gt === 'BoxGeometry' && m.color && m.color.getHex() === 0x070b1c) nm = 'visor';
      else if (gt === 'BoxGeometry') nm = sz.x > 0.3 ? 'head' : 'head_part';
      else if (gt === 'CircleGeometry') nm = 'glasses_lens_' + sideOf(ctr.x);
      else if (m.clearcoat === 1 && gt === 'TorusGeometry') nm = (gpm.arc < 4 ? 'glasses_bridge' : 'glasses_rim_' + sideOf(ctr.x));
      else if (m.clearcoat === 1 && gt === 'CircleGeometry') nm = 'glasses_lens_' + sideOf(ctr.x);
      else if (m.clearcoat === 1 && gt === 'CylinderGeometry') nm = 'glasses_temple_' + sideOf(ctr.x);
      else if (gt === 'CylinderGeometry' && m.color && o.parent !== c.head && sz.y > 0.08) nm = 'antenna';
      else if (m.emissive && m.emissiveIntensity > 1 && gt === 'SphereGeometry') nm = 'antenna_bulb';
      else if (m.sheen > 0 && m !== skinMat && !m.clearcoat) nm = 'hair';
      else if (skinMat && m === skinMat) nm = Math.abs(ctr.x - headPivot.x) > 0.7 * R ? 'ear_' + sideOf(ctr.x) : 'nose';
      else nm = 'head_part';
      items.push({ o, m, nm, bone: 'head', b, ctr, gt }); return; }
    if (gt === 'SphereGeometry' && gpm.radius > 0.035 && gpm.radius < 0.055 && ['L', 'R'].some((s) => ctr.distanceTo(H_(s)) < 0.015)) { const s = ctr.distanceTo(H_('L')) < ctr.distanceTo(H_('R')) ? 'L' : 'R'; nm = 'hand_' + s; bone = nm; }
    else if (hasLegs && gt === 'SphereGeometry' && ['L', 'R'].some((s) => ctr.distanceTo(ANK(s)) < 0.1 && ctr.y <= ANK(s).y + 0.02 && gpm.radius < 0.07)) { const s = ctr.distanceTo(ANK('L')) < ctr.distanceTo(ANK('R')) ? 'L' : 'R'; nm = (gpm.phiLength > 6 && gpm.thetaLength > 3 ? 'foot_' : 'foot_cap_') + s; bone = 'foot_' + s; }
    else if (gt === 'SphereGeometry' && ['L', 'R'].some((s) => ctr.distanceTo(S_(s)) < 0.03)) { const s = ctr.distanceTo(S_('L')) < ctr.distanceTo(S_('R')) ? 'L' : 'R'; nm = 'shoulder_' + s; bone = 'upperarm_' + s; }
    else if (gt === 'TorusGeometry' && ['L', 'R'].some((s) => ctr.distanceTo(H_(s)) < 0.07)) { const s = ctr.distanceTo(H_('L')) < ctr.distanceTo(H_('R')) ? 'L' : 'R'; nm = 'cuff_' + s; bone = 'forearm_' + s; }
    else if (o === torso.o) { nm = 'torso'; bone = 'spine'; }
    else if (gt === 'BoxGeometry' && m.color && m.color.getHex() === 0xf6f4ee && sz.x > 0.12) { nm = 'plate'; bone = 'spine'; }   // Bip's chest plate
    else if (gt === 'PlaneGeometry' && m.emissiveMap) { nm = 'spark'; bone = 'spine'; }
    else if (gt === 'PlaneGeometry' && m.map) { nm = 'spark_glow'; bone = 'spine'; }
    else if (m.metalness > 0.5 && gt === 'TubeGeometry') { nm = 'chain'; bone = 'spine'; }
    else if (m.metalness > 0.5) { nm = 'pendant_part'; bone = 'spine'; }
    else if (gt === 'CylinderGeometry' && Math.abs(ctr.x) < 0.02 && ctr.y > neckBase.y - 0.06 && ctr.y < neckBase.y + 0.12 && sz.x < 0.14) { nm = 'neck'; bone = 'neck'; }
    items.push({ o, m, nm, bone, b, ctr, gt }); });
  // joints
  const jt = {}; const hipMid = hasLegs ? HIP('L').clone().add(HIP('R')).multiplyScalar(0.5) : new THREE.Vector3(0, torso.b.min.y + 0.03, (torso.b.min.z + torso.b.max.z) / 2);
  jt.hips = hipMid; jt.neck = neckBase; jt.head = headPivot; jt.head_top = headPivot.clone().add(new THREE.Vector3(0, R * (c.head.children.find((q) => q.isGroup) ? 1 : 1), 0));
  if (faceMesh.geometry.type !== 'SphereGeometry') { const hb = items.find((i) => i.nm === 'head'); if (hb) jt.head_top = new THREE.Vector3(headPivot.x, hb.b.max.y, headPivot.z); } else { const hb = items.find((i) => i.nm === 'head'); if (hb) jt.head_top = new THREE.Vector3(headPivot.x, hb.b.max.y, headPivot.z); }
  jt.eye_L = eyeL; jt.eye_R = eyeR; jt.mouth = mouthW;
  const dirOf = (s) => H_(s).clone().sub(LM['arm_' + s].mid).normalize(), hr = {};
  for (const s of ['L', 'R']) { const hand = items.find((i) => i.nm === 'hand_' + s); hr[s] = hand ? hand.o.geometry.parameters.radius * Math.max(...hand.o.getWorldScale(new THREE.Vector3()).toArray()) : 0.045;
    jt['shoulder_' + s] = S_(s); jt['elbow_' + s] = LM['arm_' + s].mid; jt['wrist_' + s] = H_(s).clone().addScaledVector(dirOf(s), -hr[s] * 0.9); jt['hand_' + s] = H_(s);
    if (hasLegs) { jt['hip_' + s] = HIP(s); jt['knee_' + s] = LM['leg_' + s].mid; jt['ankle_' + s] = ANK(s); } }
  // bones (head, tail), parent
  const up = new THREE.Vector3(0, 1, 0), bones = [], addB = (n, p, h, t) => bones.push({ name: n, parent: p, head: A3(h), tail: A3(t) });
  addB('hips', null, hipMid, hipMid.clone().lerp(neckBase, 0.15)); addB('spine', 'hips', hipMid, neckBase); addB('neck', 'spine', neckBase, headPivot); addB('head', 'neck', headPivot, jt.head_top);
  for (const s of ['L', 'R']) { addB('upperarm_' + s, 'spine', jt['shoulder_' + s], jt['elbow_' + s]); addB('forearm_' + s, 'upperarm_' + s, jt['elbow_' + s], jt['wrist_' + s]); addB('hand_' + s, 'forearm_' + s, jt['wrist_' + s], jt['hand_' + s].clone().addScaledVector(dirOf(s), hr[s]));
    if (!hasLegs) continue;
    addB('thigh_' + s, 'hips', jt['hip_' + s], jt['knee_' + s]); addB('shin_' + s, 'thigh_' + s, jt['knee_' + s], jt['ankle_' + s]);
    const ft = items.find((i) => i.nm === 'foot_' + s); addB('foot_' + s, 'shin_' + s, jt['ankle_' + s], ft ? new THREE.Vector3(jt['ankle_' + s].x, ft.ctr.y, ft.b.max.z - 0.01) : jt['ankle_' + s].clone().add(new THREE.Vector3(0, -0.03, 0.08))); }
  // generic bone / names for what is left
  const segs = []; for (const s of ['L', 'R']) { segs.push(['upperarm_' + s, jt['shoulder_' + s], jt['elbow_' + s]], ['forearm_' + s, jt['elbow_' + s], jt['wrist_' + s]]); if (hasLegs) segs.push(['thigh_' + s, jt['hip_' + s], jt['knee_' + s]], ['shin_' + s, jt['knee_' + s], jt['ankle_' + s]]); }
  const dseg = (p, a, b) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
  for (const it of items) { if (!it.bone) { let bb = null, bd = 0.06; for (const [n, a, b] of segs) { const d = dseg(it.ctr, a, b); if (d < bd) { bd = d; bb = n; } } it.bone = bb || (it.ctr.y < hipMid.y + 0.02 ? 'hips' : 'spine'); }
    if (!it.nm && it.gt === 'TorusGeometry' && /^(upperarm|forearm)_/.test(it.bone)) it.nm = 'sleeve_hem_' + it.bone.slice(-1);
    if (!it.nm && it.gt === 'TorusGeometry' && /^(thigh|shin)_/.test(it.bone)) it.nm = 'trouser_hem_' + it.bone.slice(-1);
    if (!it.nm) it.nm = `${it.bone}_${it.gt.replace('Geometry', '').toLowerCase()}`; }
  // ---- bake into one flat scene ----
  const scene = new THREE.Scene(), parts = [], mats = new Map(), matName = (m) => { if (!mats.has(m)) mats.set(m, `${name}_mat${mats.size + 1}_${hexOf(m) || 'x'}`.replace('#', '')); return mats.get(m); };
  const bake = (g, M) => { const q = g.clone(); q.applyMatrix4(M); if (M.determinant() < 0) { const ix = q.index; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1), b = ix.getX(i + 2); ix.setX(i + 1, b); ix.setX(i + 2, a); } } q.computeBoundingBox(); return q; };
  function split(g, seg) { const ring = 13, rad = 12, mid = seg / 2, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, ix = g.index;
    const mk = (r0, r1) => { const n = (r1 - r0 + 1) * ring, G = new THREE.BufferGeometry(), cp = (at, d) => { const a = new Float32Array(n * d); for (let i = 0; i < n * d; i++) a[i] = at.array[r0 * ring * d + i]; return new THREE.BufferAttribute(a, d); };
      G.setAttribute('position', cp(P, 3)); G.setAttribute('normal', cp(N, 3)); G.setAttribute('uv', cp(U, 2)); const idx = []; for (let j = r0; j < r1; j++) for (let k = 0; k < rad * 6; k++) idx.push(ix.getX(j * rad * 6 + k) - r0 * ring); G.setIndex(idx); return G; };
    return [mk(0, mid), mk(mid, seg)]; }
  const info_c3d = (m, extra) => ({ color: hexOf(m), emissive: m.emissive ? '#' + m.emissive.getHexString() : null, emissiveIntensity: m.emissiveIntensity ?? 0, basic: !!m.isMeshBasicMaterial, blending: m.blending === THREE.AdditiveBlending ? 'add' : 'normal', opacity: m.opacity, transparent: !!m.transparent, roughness: m.roughness ?? null, metalness: m.metalness ?? null, ...extra });
  const addMesh = (nm, geo, it, extra = {}) => { const m = it.m; m.name = matName(m); const mesh = new THREE.Mesh(geo, it.o.material); mesh.name = uniq(nm); const ol = outlined.has(it.o);
    mesh.userData = { bone: extra.bone || it.bone, outline: ol, c3d: info_c3d(m, { map: !!m.map }) }; scene.add(mesh);
    const bb = geo.boundingBox; parts.push({ name: mesh.name, bone: mesh.userData.bone, geometry: it.gt || it.o.geometry.type, material: m.name, color: hexOf(m), outline: ol, vertices: geo.attributes.position.count, triangles: (geo.index ? geo.index.count : geo.attributes.position.count) / 3, bbox_min: A3(bb.min), bbox_max: A3(bb.max), ...(extra.note ? { note: extra.note } : {}) }); };
  for (const it of items) { const M = it.o.matrixWorld;
    if (it.o.userData.noodle) { const nd = it.o.userData.noodle, g = it.o.geometry;
      if (it.tube === 'split') { const [a, b] = split(g, nd.seg); addMesh(it.upperName, bake(a, M), { ...it, nm: it.upperName }, { bone: it.upperName, note: 'upper half of one tube, cut at the middle ring (the elbow / knee)' }); addMesh(it.lowerName, bake(b, M), { ...it, nm: it.lowerName }, { bone: it.lowerName, note: 'lower half of the same tube' }); }
      else addMesh(it.nm, bake(g, M), it, { note: 'whole tube (a partial limb piece)' }); }
    else addMesh(it.nm, bake(it.o.geometry, M), it); }
  const jg = new THREE.Group(); jg.name = 'joints'; for (const [n, v] of Object.entries(jt)) { const e = new THREE.Object3D(); e.name = 'J_' + n; e.position.copy(v); jg.add(e); } scene.add(jg);
  // the face canvas exported with the neutral face drawn into it; keep a copy for the JSON size only
  const buf = await new Promise((ok, bad) => new GLTFExporter().parse(scene, ok, bad, { binary: true, onlyVisible: false, maxTextureSize: 2048 }));
  const u8 = new Uint8Array(buf); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  const palette = [...mats.entries()].map(([m, n]) => ({ material: n, type: m.type, ...info_c3d(m, {}), sheen: m.sheen ?? 0, clearcoat: m.clearcoat ?? 0, has_texture: !!m.map, used_by: parts.filter((p) => p.material === n).map((p) => p.name) }));
  const lights = []; c.root.traverse((o) => { if (o.isLight && vis(o)) lights.push({ type: o.type, color: '#' + o.color.getHexString(), intensity: R5(o.intensity), distance: o.distance, decay: o.decay, pos: A3(o.getWorldPosition(new THREE.Vector3())) }); });
  const hs = faceMesh.parent.scale; const hb = items.find((i) => i.nm === 'head');
  return { b64: btoa(s), data: { pose, legs: !hasLegs ? 'none (hidden under the table: Bip seated has no leg meshes)' : pose === 'stand_tpose' || standing ? 'standing' : 'seated', t_used: R5(T), idle_residual: resid, tpose: tinfo,
    joints: Object.fromEntries(Object.entries(jt).map(([k, v]) => [k, A3(v)])), joints_blender: Object.fromEntries(Object.entries(jt).map(([k, v]) => [k, BL(v)])), bones,
    bone_blender: bones.map((b) => ({ name: b.name, parent: b.parent, head: BL({ x: b.head[0], y: b.head[1], z: b.head[2] }), tail: BL({ x: b.tail[0], y: b.tail[1], z: b.tail[2] }) })),
    head: { pivot: A3(headPivot), radius_m: R5(R), group_scale: faceMesh.parent === c.head ? null : A3(hs), shape: faceMesh.geometry.type === 'SphereGeometry' ? 'sphere' : 'rounded box (visor robot)', head_mesh_bbox: hb ? [A3(hb.b.min), A3(hb.b.max)] : null },
    face: { mesh: 'face', bone: 'head', canvas_px: [FW, FH], uv_rect: [0, 0, 1, 1], blend: faceMat.blending === THREE.AdditiveBlending ? 'additive' : 'alpha', ...faceInfo, eye_px_L: eyesPx.find((p, i) => (eyeW[i] === eyeL))?.map(R5), eye_px_R: eyesPx.find((p, i) => (eyeW[i] === eyeR))?.map(R5), mouth_px: mouthPx.map(R5), eye_L: A3(eyeL), eye_R: A3(eyeR), mouth: A3(mouthW),
      eye_in_head_L: A3(c.head.worldToLocal(eyeL.clone())), eye_in_head_R: A3(c.head.worldToLocal(eyeR.clone())), mouth_in_head: A3(c.head.worldToLocal(mouthW.clone())) },
    outline: { color: inkCfg.color, thickness_m: inkCfg.t, meshes_with_outline: parts.filter((p) => p.outline).map((p) => p.name), count_in_engine: nInk }, palette, parts, skipped, lights, engine_color: c.color } };
}
(async () => {
  const S = await start(), p = await S.open(LOOK_EP[pack]);
  try {
    fs.mkdirSync(out, { recursive: true });
    for (const name of names) {
      const standing = name === 'ba' || name === 'me', poses = standing ? ['standing', 'tpose'] : ['seated', 'tpose', ...(name === 'teo' || name === 'bip' ? ['stand_tpose'] : [])], J = { format: 'cine3d-char/1', character: name, pack, files: {}, poses: {} };
      for (const pose of poses) { const r = await p.evaluate(exportChar, { pack, name, pose }); const f = `${name}_${pose}.glb`; fs.writeFileSync(path.join(out, f), Buffer.from(r.b64, 'base64')); J.files[pose] = f; J.poses[pose] = r.data; console.log(`${f}  ${(fs.statSync(path.join(out, f)).size / 1e3).toFixed(0)} KB  ${r.data.parts.length} meshes`); }
      const P0 = J.poses[poses[0]]; J.head = P0.head; J.face = { ...P0.face }; J.outline = P0.outline; J.palette = P0.palette; J.lights = P0.lights; J.engine_color = P0.engine_color; J.parts = P0.parts; J.skipped = P0.skipped;
      J.conventions = { units: 'metres', frame: 'character root frame: origin on the floor under the seat (Fans: under the low seat, feet hang to about y -0.1), +Y up, +Z = the way he faces, +X = screen-right when he faces the camera. World = root + Ry(yaw) * local (dump.json chars.<who>.root / yaw)',
        glb_axes: 'glTF is Y up, +Z front, right-handed: the GLB coordinates are IDENTICAL to joints (three.js axes). Blender glTF import turns (x, y, z) into (x, -z, y), so the character faces -Y in Blender (towards the front-view camera); joints_blender holds those numbers already',
        sides: '_L / _R are ANATOMICAL, as in Blender: _L = the character\'s left = +X (screen-right when he faces the camera), _R = -X. The engine\'s pose slot `l` (screen-left hand, dump hands.l) = the character\'s RIGHT hand = hand_R; slot `r` = hand_L',
        outline: 'ink outline = inverted hull: the same mesh pushed out along its normals by thickness_m (world metres) in the outline colour, back faces only, unlit. Meshes listed in outline.meshes_with_outline get it; transparent, glowing, unlit and tiny parts do not. The shells are NOT in the GLB',
        materials: 'extras.c3d on every node: basic (unlit MeshBasic), blending add (additive glow), emissive hex and intensity (can exceed 1), opacity. glTF cannot carry additive blending or emissive > 1 (Bip face screen, spark glow): rebuild them from this' };
      fs.writeFileSync(path.join(out, `${name}.joints.json`), JSON.stringify(J, null, 1)); console.log(`${name}.joints.json`);
    }
  } finally { await S.close(); }
})();
