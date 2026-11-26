// cine3d clipcheck: geometry faults in an episode that qa.cjs cannot see (the owner caught them by eye).
//   node tools/clipcheck.cjs episodes/<id>.js [--step 0.1] [--t0 a --t1 b] [--tol pen=0.03,det=0.02,...] [--stills 5] [--json out.json] [--verbose]
// Steps through the episode time (scene updates + queries only: stage.render is stubbed, no frame is drawn or encoded), and reports
//   pen      a character part inside a solid of the set (box / cylinder volume, or a thin plane crossed) deeper than a tolerance
//   cc       two characters' body volumes overlapping (heads, torsos, thighs; hands excluded) unless a contact is declared (rides, fx bite/bitten/pile/...)
//   detach   a small part (glasses, antenna, held prop) farther from every body volume of its character than a tolerance
//   slide    a foot that is on the ground at both ends of a step but moved: sliding while walking / gliding
//   ground   lowest point of a character below the ground, or a standing character floating above it for > 0.3 s
//   frozen   a character on screen whose whole pose (every mesh matrix + limb tube) is bit-identical for > 1.5 s
//   dup      NOT decidable from the scene graph: same-looking prop held by a character and lying free nearby is listed as SUSPECT only,
//            unless the episode declares  clipUnique: ['<signature text printed by the report>']  (then it counts and fails)
// Only what the camera sees counts (the fault point must be inside the frustum, or the character's box intersects it).
// Set meshes that are passable or decoration: userData.noClip = true, or a name starting with "noclip" / "passable" (read, never written, by this tool).
// Waive in the episode: waive: [{ check: 'clip', t0, t1, reason }]   (printed as WAIVED, not counted).
// Stills of the 5 worst findings: out/<id>/clip_*.jpg (full 1080x1920 frame with a ring on the fault point).
// v5 (22/11, "checks 2": every episode except the LEGACY list below, or any episode with `checks: 2`; docs: ENGINE.md "Machine checks v4"):
//   nogait   a character whose position changes by > 0.3 m inside a shot (not across a cut) without feet that really lift (a walk cycle), a ride or a carrier -> FAIL. Waivable ONLY with a `carrier: '<what carries him>'`.
//   touch    ep.touch entries (hand ON a point / surface): the hand ball ends > 0.06 m from its target, or the declared point is > 0.05 m off the real surface under it; ep.touchProps = [{ who, hand: 'L'|'R'|'any', prop: '<object name>', t0, t1 }]: hand within 0.06 m of that object's surface
//   reads    ep.reads = [{ text: 'GIẤY XE', t0, t1 }] (or prop: '<object name>'): the text prop (canvas texture) must be whole inside the frame, facing the camera, >= 90 % unblocked, for the whole window, which lasts >= 1.0 + characters/12 s
//   waiver   a waiver wider than 25 % of the film, without a named object (`who`, or "Object: ..." in the reason, or a cast member in the reason), without a reason, or `check: 'clip'` for everything -> FAIL, and it is not applied
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), { ROOT, GPU, READY_TIMEOUT, stripQuery, serve, flagOf } = require('./_page.cjs');
const args = process.argv.slice(2), flag = flagOf(args);
const EPFILE = args.find((a, i) => /\.js(&|\?|$)/.test(a) && !args[i - 1]?.startsWith('--'));
if (!EPFILE) { console.log('usage: node tools/clipcheck.cjs episodes/<id>.js [--step 0.1] [--t0 a --t1 b]'); process.exit(2); }
const EPPATH = stripQuery(EPFILE);
// tolerances (metres unless noted). pen: body part inside a set solid. cc: depth of two body volumes. det: gap to every body volume. slide: m/s of a planted foot.
const TOL = { pen: 0.03, penTop: 0.065, penSeat: 0.09, cc: 0.07, crowd: 0.15, det: 0.015, slide: 0.2, below: 0.03, float: 0.06, floatT: 0.3, frozenT: 1.5, dupD: 0.9, ...Object.fromEntries((flag('tol', '') || '').split(',').filter(Boolean).map((kv) => kv.split('=')).map(([k, v]) => [k, Number(v)])) };
const STEP = Number(flag('step', 0.1)), NSTILL = Number(flag('stills', 5)), VERBOSE = args.includes('--verbose');
// ---- v5 (22/11) "checks 2": thresholds + waiver rules. LEGACY = approved episodes that the new checks flag for real flaws (never edited): they keep the old checks only. Everything new is covered by default. ----
const V5 = { move: 0.3, pairMin: 0.005, lift: 0.03, touchErr: 0.06, surfErr: 0.05, readBlock: 0.1, readFace: 0.25, wideFrac: 0.25 };
// 22/11: these five were approved before the new checks and fail them for real reasons (blanket waivers, instant moves, a teleport), listed in the report, never edited.
const LEGACY = new Set(['gta6', 'gta6p2', 'gta6p2b', 'gta6p3', 'gta6p3b']);
const nrm = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
// waiver problems (w = { check, t0, t1, reason, who?, carrier? }); returns a text, or '' when the waiver is fine
function waiverProblem(w, dur, castNames) {
  const t0 = Math.max(0, w.t0 ?? 0), t1 = Math.min(dur, w.t1 ?? 1e9), span = Math.max(0, t1 - t0), why = [];
  if (w.check === 'clip') why.push("check 'clip' waives every clip check at once: name the one (clip.pen, clip.detach, ...)");
  if (span > V5.wideFrac * dur) why.push(`covers ${(span / dur * 100).toFixed(0)} % of the film (${span.toFixed(1)} of ${dur.toFixed(1)} s; most 25 %)`);
  const r = nrm(w.reason || ''); if (!w.reason) why.push('no reason given');
  const named = !!(w.who || w.obj || w.object) || /\bobject:/.test(r) || (castNames || []).some((n) => new RegExp('(^|[^a-z0-9])' + nrm(n) + '([^a-z0-9]|$)').test(r));
  if (!named) why.push('names no object (add who: \'<character or prop>\' or "Object: ..." to the reason)');
  if (/^clip\.nogait$/.test(w.check || '') && !(w.carrier && String(w.carrier).trim())) why.push("a missing walk is never waived unless the waiver names what carries him (carrier: 'car', 'jet ski', 'carried by Bip', ...)");
  return why.join('; ');
}

// ------------------------------------------------------------------------------------------------------------------------------
// runs in the page. Sets up window.__cc = { step(t) } -> one sample of raw measurements (the thresholds are applied in node).
// ------------------------------------------------------------------------------------------------------------------------------
async function pageInit(TOL) {
  const THREE = await import('/node_modules/three/build/three.module.js'), U = await import('/core/util.js');
  const { Vector3: V3, Matrix4, Frustum, Box3 } = THREE, scene = window.stage.scene, cast = window.cast, ep = window.ep, cam = window.stage.camera;
  window.__stageRender = window.stage.render; window.stage.render = () => {};   // no drawing: scene updates only (restored for stills)
  // ---- fx (same ramps as core/player.js fxAt: only used to know who is walking, riding, biting) ----
  const fxT = {}; for (const a of ep.acts || []) if (a.fx) for (const [k, v] of Object.entries(a.fx)) ((fxT[a.who] ??= {})[k] ??= []).push({ t: a.t, v, d: a.d ?? 0.4, lin: a.ease === 'lin' });
  for (const w in fxT) for (const k in fxT[w]) fxT[w][k].sort((a, b) => a.t - b.t);
  const fxAt = (who, t) => { const o = {}; for (const k in fxT[who] || {}) { let v = 0; for (const f of fxT[who][k]) { if (t < f.t) break; const u = (t - f.t) / Math.max(1e-3, f.d); v = U.lerp(v, f.v, f.lin ? U.clamp(u) : U.smooth(u)); } o[k] = v; } return o; };
  const GAITK = ['walk', 'run', 'lurch', 'robot', 'charge', 'backaway'], CONTACT = ['bite', 'bitten', 'pile', 'piggy', 'carry', 'hug', 'grab', 'hold', 'drag', 'push', 'ride', 'trip', 'fall', 'tackle'];
  // ---- units: a character, or each member of the horde ----
  const units = [], inUnit = new Set(), owner = new Map();
  for (const [n, c] of Object.entries(cast)) {
    const list = c.members ? c.members.map((m, i) => ({ name: n + '#' + i, char: n, root: m.g, headObj: m.hd, R: c.R })) : [{ name: n, char: n, root: c.root, headObj: null, R: c.R, c }];
    for (const u of list) { u.meshes = []; u.root.traverse((m) => { if (m.isMesh && !m.userData.isOutline) { u.meshes.push(m); inUnit.add(m); owner.set(m, u); } }); units.push(u); }
  }
  const matOf = (m) => (Array.isArray(m.material) ? m.material[0] : m.material);
  const visible = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
  const bbox = (g) => (g.boundingBox || (g.computeBoundingBox(), g.boundingBox));
  const SIG = (m) => { const g = m.geometry, mat = matOf(m), s = sx(m), h = bbox(g).getSize(new V3()); return g.type.replace('Geometry', '') + ' ' + [h.x * s[0], h.y * s[1], h.z * s[2]].map((x) => x.toFixed(3)).sort().join('x') + ' #' + (mat.color ? mat.color.getHexString() : '?'); };
  // ---- a mesh as an oriented box: center, three half-extent axes (world, scaled), world AABB ----
  const _v = new V3(), tmpB = new Box3();
  function desc(m) {
    const g = m.geometry, bb = bbox(g), M = m.matrixWorld.elements, cl = bb.getCenter(new V3()), hl = bb.getSize(new V3()).multiplyScalar(0.5);
    const c = cl.clone().applyMatrix4(m.matrixWorld), ax = [0, 1, 2].map((i) => new V3(M[i * 4], M[i * 4 + 1], M[i * 4 + 2]).multiplyScalar(hl.getComponent(i)));
    const d = { m, c, ax, hl, cl, type: g.type, max: 0, ext: new V3(), lo: 1e9 };
    d.ext.set(Math.abs(ax[0].x) + Math.abs(ax[1].x) + Math.abs(ax[2].x), Math.abs(ax[0].y) + Math.abs(ax[1].y) + Math.abs(ax[2].y), Math.abs(ax[0].z) + Math.abs(ax[1].z) + Math.abs(ax[2].z));
    d.max = 2 * Math.max(ax[0].length(), ax[1].length(), ax[2].length()); d.min = 2 * Math.min(ax[0].length(), ax[1].length(), ax[2].length());
    d.lo = c.y - d.ext.y; return d;
  }
  const sx = (m) => { const e = m.matrixWorld.elements; return [Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])]; };
  // surface sample points: tubes (limbs) = real vertices; everything else = centre + 6 axis ends + 8 diagonals of the inscribed ellipsoid
  function points(d) {
    const out = [d.c]; const m = d.m;
    if (d.type === 'TubeGeometry' || m.userData.noodle) { const p = m.geometry.attributes.position, n = p.count, st = Math.max(1, Math.floor(n / 40)); for (let i = 0; i < n; i += st) out.push(new V3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld)); return out; }
    for (const a of d.ax) { out.push(d.c.clone().add(a), d.c.clone().sub(a)); }
    const k = Math.SQRT1_2 * 0.82;   // diagonals of the inscribed ellipsoid
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) for (const s3 of [-1, 1]) out.push(d.c.clone().addScaledVector(d.ax[0], s1 * k).addScaledVector(d.ax[1], s2 * k).addScaledVector(d.ax[2], s3 * k));
    return out;
  }
  // signed distance (+ outside, - inside) of world point p to a mesh volume d: sphere/lathe/others = ellipsoid; box/cylinder = oriented box; tube = centre line
  const Minv = new Map();
  function sdf(p, d, gen = false) {
    const m = d.m, t = d.type;
    if (m.userData.noodle && m.userData.noodle.curve) { const nd = m.userData.noodle, cv = nd.curve; if (!d.poly) { d.poly = []; for (let i = 0; i <= 12; i++) d.poly.push(cv.getPoint(i / 12).applyMatrix4(m.matrixWorld)); d.rad = nd.r * (nd.taper !== 1 ? (1 + nd.taper) / 2 : 1) * sx(m)[0]; }
      let best = 1e9; for (let i = 0; i < 12; i++) { const a = d.poly[i], b = d.poly[i + 1]; _v.subVectors(b, a); const L2 = _v.lengthSq(), u = U.clamp(L2 ? new V3().subVectors(p, a).dot(_v) / L2 : 0), q = a.clone().addScaledVector(_v, u); best = Math.min(best, q.distanceTo(p)); } return best - d.rad; }
    let inv = Minv.get(m); if (!inv) { inv = m.matrixWorld.clone().invert(); Minv.set(m, inv); }
    const pl = p.clone().applyMatrix4(inv).sub(d.cl), s = sx(m), hl = d.hl;
    if (t === 'SphereGeometry' || ((t === 'LatheGeometry' || t === 'CapsuleGeometry') && !gen)) {
      const x = pl.x * s[0], y = pl.y * s[1], z = pl.z * s[2], a = hl.x * s[0] || 1e-6, b = hl.y * s[1] || 1e-6, c = hl.z * s[2] || 1e-6, k = Math.hypot(x / a, y / b, z / c), gr = Math.hypot(x / (a * a), y / (b * b), z / (c * c)) / Math.max(k, 1e-9);
      return (k - 1) / Math.max(gr, 1e-9); }
    const q0 = Math.abs(pl.x) * s[0] - hl.x * s[0], q1 = Math.abs(pl.y) * s[1] - hl.y * s[1], q2 = Math.abs(pl.z) * s[2] - hl.z * s[2];
    const o = Math.hypot(Math.max(q0, 0), Math.max(q1, 0), Math.max(q2, 0)); return o + Math.min(Math.max(q0, q1, q2), 0);
  }
  // ---- solids of the set: box / cylinder volumes and planes, opaque, visible, not tiny, not flagged passable ----
  const solidCand = []; scene.traverse((m) => { if (!m.isMesh || inUnit.has(m) || m.userData.isOutline) return; const t = m.geometry.type; if (!['BoxGeometry', 'RoundedBoxGeometry', 'CylinderGeometry', 'PlaneGeometry'].includes(t)) return;
    const mat = matOf(m); if (!mat || mat.transparent || mat.opacity < 0.99 || m.userData.noClip || /^(noclip|passable)/i.test(m.name || '') || m.userData.noodle) return; solidCand.push(m); });
  const frustum = new Frustum(), PM = new Matrix4();
  const labels = new WeakMap(), labelOf = (d) => { if (labels.has(d.m)) return labels.get(d.m); const b = tmpB.setFromObject(d.m), L = labelOf0(d, b); labels.set(d.m, L); return L; }, labelOf0 = (d, b) => { return d.type.replace('Geometry', '') + (d.m.name ? ' ' + d.m.name : d.m.parent?.name ? ' ' + d.m.parent.name : '') + ` x[${b.min.x.toFixed(1)},${b.max.x.toFixed(1)}] y[${b.min.y.toFixed(2)},${b.max.y.toFixed(2)}] z[${b.min.z.toFixed(1)},${b.max.z.toFixed(1)}]`; };
  const partOf = (u, d, head, low) => { if (head && d.c.distanceTo(head) < 0.24 && d.max < 0.3) return 'head'; if (d.type === 'SphereGeometry' && d.max < 0.13 && d.c.y - low > 0.12) return 'hand'; if (d.c.y - low < 0.1 && d.max < 0.35) return 'foot'; if (d.m.userData.noodle || d.type === 'TubeGeometry' || d.type === 'CylinderGeometry') return 'limb'; return 'body'; };
  const dupSig = (m) => SIG(m);
  // is a world point seen from the camera? (nothing opaque between, apart from the excluded meshes: the character's own parts, the solid it is sunk in)
  const ray = new THREE.Raycaster(), camPos = new V3(); let occ = null;
  const seenFrom = (pt, excl) => { occ ||= (() => { const a = []; scene.traverse((m) => { if (m.isMesh && !m.userData.isOutline && visible(m)) { const mt = matOf(m); if (mt && !mt.transparent && mt.opacity >= 0.99) a.push(m); } }); return a; })();
    const dir = pt.clone().sub(camPos), dist = dir.length(); dir.normalize(); ray.set(camPos, dir); ray.far = Math.max(0, dist - 0.04); return ray.intersectObjects(occ.filter((m) => !excl.has(m)), false).length === 0; };
  const unitSet = (...us) => { const e = new Set(); for (const u of us) for (const m of u.meshes) e.add(m); return e; };
  // ---- v5 (22/11): touch targets, canvas-text props (the init script of the node side records every fillText per canvas) ----
  const { makeTouch } = await import('/core/touch.js'), TC = ep.touch && ep.touch.length ? makeTouch(ep.touch) : null, CVT = window.__cvText || new WeakMap();
  const nz = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D').toUpperCase().replace(/\s+/g, ' ');
  const canvasOf = (m) => { for (const mt of (Array.isArray(m.material) ? m.material : [m.material])) for (const k of ['map', 'emissiveMap']) { const im = mt && mt[k] && mt[k].image; if (im && CVT.has(im)) return im; } return null; };
  const handBalls = (u) => { if (u._hb) return u._hb; const body = u.c?.body, out = []; u.root.traverse((m) => { if (!m.isMesh || m.geometry.type !== 'SphereGeometry') return; const r = m.geometry.parameters.radius; if (r >= 0.039 && r <= 0.048 && (!body || m.parent === body)) out.push(m); }); return (u._hb = out.slice(0, 2)); };
  const carRiders = []; for (const c of Object.values(ep.setOpts?.cars || {})) if (c && typeof c === 'object' && c.riders) carRiders.push(...Object.values(c.riders));
  let occNow = null; const occListNow = () => (occNow ||= (() => { const a = []; scene.traverse((m) => { if (m.isMesh && !m.userData.isOutline && visible(m)) { const mt = matOf(m); if (mt && mt.visible !== false && !mt.transparent && mt.opacity >= 0.99) a.push(m); } }); return a; })());
  function step(t) {
    occNow = null; const shotIdx = ep.shots.findIndex((s) => t >= s.t0 && t < s.t1), res = { t, shot: shotIdx < 0 ? ep.shots.length - 1 : shotIdx };
    window.player.frame(null, t, { overlays: false, noRender: true });
    scene.updateMatrixWorld(true); cam.updateMatrixWorld(true); cam.updateProjectionMatrix(); PM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse.copy(cam.matrixWorld).invert()); frustum.setFromProjectionMatrix(PM);
    Minv.clear(); occ = null; cam.getWorldPosition(camPos); const inView = (p) => frustum.containsPoint(p);
    // solids this step
    const solids = [], grounds = [];
    for (const m of solidCand) { if (!visible(m)) continue; const d = desc(m); if (d.max < 0.3 && m.geometry.type !== 'PlaneGeometry') continue; if (m.geometry.type !== 'PlaneGeometry') { const dm = [d.ext.x, d.ext.y, d.ext.z].map((x) => x * 2).sort((a, b) => a - b); if (dm[1] < 0.04) continue; }   // wires and rods (a trolley's bars) are not walls
      const bw = tmpB.setFromObject(m).clone(); d.bw = bw; const top = bw.max.y, flat = m.geometry.type === 'PlaneGeometry';
      if (flat) { const n = new V3(0, 0, 1).transformDirection(m.matrixWorld); d.n = n; if (Math.max(d.ax[0].length(), d.ax[1].length()) * 2 < 0.4) continue; if (Math.abs(n.y) > 0.9 && top < 0.3) { grounds.push(d); continue; } }
      else if (top < 0.06 && d.min < 0.4) { grounds.push(d); continue; }
      else if (top < 0.2 && d.min < 0.4) continue;   // kerbs, rubble, mats: walkable, neither floor nor wall
      solids.push(d); }
    let gwho = ''; const supportAt = (x, z, below) => { let g = -1e9; for (const d of solids) { const b = d.bw; if (b.max.y <= below + 0.08 && x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z) g = Math.max(g, b.max.y); } return g; };
    const groundAt = (x, z) => { let g = 0; gwho = ''; for (const d of grounds) { const b = d.bw; if (x >= b.min.x - 0.01 && x <= b.max.x + 0.01 && z >= b.min.z - 0.01 && z <= b.max.z + 0.01 && b.max.y > g) { g = b.max.y; gwho = labelOf(d); } } return g; };
    // units this step
    const U_ = [];
    for (const u of units) { const parts = []; for (const m of u.meshes) { const mat = matOf(m); if (!mat || mat.transparent || mat.opacity < 0.5 || !visible(m)) continue; const d = desc(m); if (d.max < 0.012 || !isFinite(d.c.x)) continue; d.pts = points(d); parts.push(d); }
      if (!parts.length) continue; if (u.root.getWorldPosition(new V3()).y < -1.5) continue;   // parked out of sight (stands y: -100)
      const box = new Box3(); let low = 1e9, lowD = null; for (const d of parts) for (const p of d.pts) { box.expandByPoint(p); if (p.y < low) { low = p.y; lowD = d; } }
      const head = u.c ? u.c.headWorld(new V3()) : u.headObj.getWorldPosition(new V3()); for (const d of parts) d.label = partOf(u, d, head, low);
      U_.push({ u, parts, box, low, lowD, head, vis: frustum.intersectsBox(box), fx: fxAt(u.char, t) }); }
    // 1. pen: each part's extent in the solid's own frame (box / cylinder; a plane is a box with no thickness) overlaps the solid: depth = the smaller overlap over its three axes.
    //    Resting on top of a solid is allowed more (a seat: 9 cm of cushion, a table: 3.5 cm) than going into its side (3 cm).
    const pen = [], up = new V3(0, 1, 0);
    for (const W of U_) { if (!W.vis) continue; const box = W.box.clone().expandByScalar(0.05), best = new Map();
      for (const s of solids) { if (!box.intersectsBox(s.bw)) continue; const sl = labelOf(s), cyl = s.type === 'CylinderGeometry', sc = sx(s.m), inv = (Minv.get(s.m) || (Minv.set(s.m, s.m.matrixWorld.clone().invert()), Minv.get(s.m))), h = [s.hl.x * sc[0], s.hl.y * sc[1], s.hl.z * sc[2]], seat = s.bw.max.y <= 0.4, upish = Math.abs(new V3(s.m.matrixWorld.elements[4], s.m.matrixWorld.elements[5], s.m.matrixWorld.elements[6]).normalize().y) > 0.9;
        const rW = cyl ? (s.m.geometry.parameters.radiusTop + s.m.geometry.parameters.radiusBottom) / 2 * sc[0] : 0;
        for (const d of W.parts) { if (d.max < 0.03) continue; const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], pl = [null, null, null]; let rmin = 1e9;
          for (const p of d.pts) { const l = p.clone().applyMatrix4(inv).sub(s.cl), q = [l.x * sc[0], l.y * sc[1], l.z * sc[2]]; if (cyl) rmin = Math.min(rmin, Math.hypot(q[0], q[2])); for (let k = 0; k < 3; k++) { if (q[k] < lo[k]) { lo[k] = q[k]; } if (q[k] > hi[k]) { hi[k] = q[k]; } } }
          const tube = d.type === 'TubeGeometry' || d.m.userData.noodle; let ov;
          if (!tube) { ov = [0, 1, 2].map((k) => (cyl && k !== 1 ? (k === 0 ? rW - rmin : 1e9) : Math.min(h[k] - lo[k], hi[k] + h[k]))); if (cyl) ov[2] = 1e9; }
          else { /* a bent limb is not convex: its bounding interval would claim overlaps it does not have, so test its own vertices; a thin plane needs the part to straddle it */
            ov = [-1, -1, -1]; const thin = h.findIndex((x) => x < 0.005);
            if (thin >= 0) { const o3 = Math.min(-lo[thin], hi[thin]); if (o3 > 0) { const inplane = [0, 1, 2].filter((k) => k !== thin).every((k) => hi[k] > -h[k] && lo[k] < h[k]); if (inplane) ov = [0, 1, 2].map((k) => (k === thin ? o3 : 1e9)); } }
            else { let bestD = 0; for (const p of d.pts) { const l = p.clone().applyMatrix4(inv).sub(s.cl), q = [l.x * sc[0], l.y * sc[1], l.z * sc[2]]; let dd; if (cyl) { const r = Math.hypot(q[0], q[2]); dd = Math.min(rW - r, h[1] - Math.abs(q[1])); } else dd = Math.min(h[0] - Math.abs(q[0]), h[1] - Math.abs(q[1]), h[2] - Math.abs(q[2])); if (dd > bestD) { bestD = dd; ov = [1e9, bestD, 1e9]; ov.top = q[1] > 0; } } }
          }
          if (ov.some((x) => x <= 0)) continue;
          const slab = h.filter((x) => x < 0.06).length === 1 && h.filter((x) => x >= 0.15).length === 2;   // a thin slab (table top, shelf): a hand resting on or at its edge may sink a little
          const k = ov.indexOf(Math.min(...ov)), dep = ov[k]; if (dep < 0.008) continue; const fromTop = tube && ov.top !== undefined ? ov.top : h[1] - lo[1] <= hi[1] + h[1], top = k === 1 && upish && fromTop; /* (th: when the slab axis is not y, top stays false) */
          const tol = top ? (seat ? TOL.penSeat : TOL.penTop) : slab ? TOL.penTop : TOL.pen, at = d.pts.reduce((a, p) => (p.y < a.y ? p : a), d.pts[0]);
          const key = W.u.name + '|' + d.label + '|' + sl, o = best.get(key); if (!o || o.depth / o.tol < dep / tol) best.set(key, { _p: d.pts.slice(0, 15), _s: s.m, _u: W.u, who: W.u.name, part: d.label, solid: sl, depth: dep, tol, face: top ? (seat ? 'top of a seat' : 'top') : 'side', at: top ? at.toArray() : d.c.toArray(), in: inView(d.c), kind: d.m.userData.noodle ? 'limb' : d.type.replace('Geometry', '') }); } }
      for (const o of best.values()) pen.push(o); }
    res.pen = pen.filter((o) => o.in && o.depth > o.tol && (() => { const ex = new Set([...unitSet(o._u), o._s]); return o._p.some((p) => seenFrom(p, ex)); })()).map((o) => ({ ...o, _s: undefined, _u: undefined, _p: undefined })).sort((a, b) => b.depth / b.tol - a.depth / a.tol).slice(0, 14);
    // 2. cc: body volumes of two units (hands, small details and limbs excluded)
    const cc = [], big = (d) => d.type !== 'TubeGeometry' && !d.m.userData.noodle && d.type !== 'CylinderGeometry' && d.hl.x * 2 >= 0.0 && d.min >= 0.1 && d.max < 0.8 && (d.m.userData.noodle ? false : true);
    const contact = (W) => CONTACT.some((k) => (W.fx[k] || 0) > 0.05);
    for (let i = 0; i < U_.length; i++) for (let j = i + 1; j < U_.length; j++) { const A = U_[i], B = U_[j]; if (!(A.vis || B.vis) || !A.box.clone().expandByScalar(0.03).intersectsBox(B.box)) continue;
      if (A.u.char === B.u.char && (A.fx.pile || 0) > 0.01) continue; if (contact(A) || contact(B)) continue; if ((ep.rides?.[A.u.char] === B.u.char && (A.fx.ride || 0) > 0.02) || (ep.rides?.[B.u.char] === A.u.char && (B.fx.ride || 0) > 0.02)) continue; if (ep.rides?.[A.u.char] === B.u.char || ep.rides?.[B.u.char] === A.u.char) continue;
      let best = { depth: 0 };
      for (const [P, Q] of [[A, B], [B, A]]) for (const d of P.parts) { if (!big(d)) continue; for (const e of Q.parts) { if (!big(e) || !P.box.intersectsBox(e.bw || (e.bw = tmpB.setFromObject(e.m).clone()))) continue; for (const p of d.pts) { const q = -sdf(p, e); if (q > best.depth) best = { depth: q, at: p.toArray(), pa: P.u.name + ':' + d.label, pb: Q.u.name + ':' + e.label }; } } }
      if (best.depth > 0.01 && inView(new V3(...best.at))) cc.push({ a: A.u.name, b: B.u.name, _ua: A.u, _ub: B.u, ...best }); }
    res.cc = cc.filter((o) => o.depth > (o.a.split('#')[0] === o.b.split('#')[0] ? TOL.crowd : TOL.cc) && seenFrom(new V3(...o.at), unitSet(o._ua, o._ub))).map((o) => ({ ...o, _ua: undefined, _ub: undefined })).sort((a, b) => b.depth - a.depth).slice(0, 8);
    // 3. detach: a small part must reach a body volume (an "anchor") of its unit, directly or through a chain of parts that touch (gap <= 1.2 cm: a stalk, a temple);
    //    a ring (glasses rim) has to touch the anchor itself, so glasses that float as a whole assembly are still caught.
    const det = [], LINK = 0.012, gapTo = (A, B) => { let g = 1e9; for (const p of A.pts) g = Math.min(g, sdf(p, B, true)); return g; };
    for (const W of U_) { if (!W.vis || W.u.char === 'horde') continue;
      const isAnchor = (d) => !(d.type === 'SphereGeometry' && d.m.geometry.parameters.thetaLength < 3 && d.m.geometry.parameters.phiLength < 6) && ((['SphereGeometry', 'LatheGeometry'].includes(d.type) && d.max >= 0.08) || ((d.m.userData.noodle || d.type === 'TubeGeometry') && d.max >= 0.1) || (d.type === 'CylinderGeometry' && d.min >= 0.05) || (d.max >= 0.25 && d.type !== 'PlaneGeometry' && d.type !== 'CircleGeometry'));
      const anchors = W.parts.filter(isAnchor), cand = W.parts.filter((d) => d.max >= 0.04 && d.max < 0.25 && d.type !== 'CircleGeometry' && d.type !== 'PlaneGeometry' && !isAnchor(d)); if (!cand.length || !anchors.length) continue;
      const direct = new Map(); for (const d of cand) { let g = 1e9, at = d.c; for (const a of anchors) { const q = gapTo(d, a); if (q < g) { g = q; at = d.c; } if (g <= LINK) break; } direct.set(d, g); }
      const seen = new Set(), pieces = W.parts.filter((d) => d.max >= 0.012 && d.type !== 'CircleGeometry' && d.type !== 'PlaneGeometry' && !isAnchor(d));
      const near = (A, B) => A.m !== B.m && new Box3().setFromObject(A.m).expandByScalar(0.02).intersectsBox(new Box3().setFromObject(B.m)) && Math.min(gapTo(A, B), gapTo(B, A)) <= LINK;
      for (const d of cand) { if (seen.has(d)) continue; const comp = [d], q = [d]; seen.add(d); let ok = direct.get(d) <= LINK;
        // grow the component through touching small parts
        while (q.length) { const a = q.pop(); for (const b of pieces) { if (seen.has(b)) continue; if (near(a, b)) { seen.add(b); comp.push(b); q.push(b); if (direct.has(b) && direct.get(b) <= LINK) ok = true; } } }
        const gap = Math.min(...comp.filter((x) => direct.has(x)).map((x) => direct.get(x)));
        const rings = comp.filter((x) => x.type === 'TorusGeometry' && direct.has(x) && direct.get(x) > TOL.det);
        const worst = rings.length ? rings.reduce((a, b) => (direct.get(b) > direct.get(a) ? b : a)) : d, g = rings.length ? direct.get(worst) : gap;
        if (!ok || rings.length) { if (g > 0.008 && g < 1e8) det.push({ _u: W.u, who: W.u.name, part: worst.label + ' ' + worst.type.replace('Geometry', '') + ' ' + worst.max.toFixed(2) + (comp.length > 1 ? ' +' + (comp.length - 1) + ' touching parts' : ''), gap: g, at: worst.c.toArray(), in: inView(worst.c), sig: SIG(worst.m) }); } } }
    res.det = det.filter((o) => o.in && o.gap > TOL.det && seenFrom(new V3(...o.at), unitSet(o._u))).map((o) => ({ ...o, _u: undefined })).sort((a, b) => b.gap - a.gap).slice(0, 10);
    // 4. ground + feet
    const gnd = [], feet = [];
    for (const W of U_) { const c = W.u.root.getWorldPosition(new V3()), gy = groundAt(c.x, c.z); const rider = ep.rides?.[W.u.char] && (W.fx.ride || 0) > 0.02;
      const gy0 = gy, gw0 = gwho; let sup = supportAt(W.box.getCenter(new V3()).x, W.box.getCenter(new V3()).z, W.low);
      if (W.low > gy + TOL.float && sup < -1e8) { /* floating? is any set mesh (a trolley's wire floor, a crate) under the lowest point */ const ctr = W.box.getCenter(new V3()), bx = new Box3(); scene.traverse((m) => { const mat = m.isMesh ? matOf(m) : null; if (sup > -1e8 || !m.isMesh || inUnit.has(m) || !m.visible || m.userData.isOutline || !mat || mat.transparent) return; bx.setFromObject(m); if (bx.min.x - 0.2 < ctr.x && bx.max.x + 0.2 > ctr.x && bx.min.z - 0.2 < ctr.z && bx.max.z + 0.2 > ctr.z && bx.max.y < W.low + 0.08 && bx.max.y > W.low - 0.25) sup = bx.max.y; }); }
      gnd.push({ sup, gw: gw0, who: W.u.name, low: W.low, lowPart: W.lowD.label + ' ' + W.lowD.type.replace('Geometry', '') + ' ' + W.lowD.max.toFixed(2) + ' m', gy, rider: !!rider, vis: W.vis, at: [c.x, W.low, c.z], gait: GAITK.reduce((s, k) => s + (W.fx[k] || 0), 0), yfx: W.fx.y || 0, dragLeg: (W.fx.lurch || 0) > 0.1 || (W.fx.charge || 0) > 0.1, pile: W.fx.pile || 0, standing: !!((fxT[W.u.char]?.stand ? (W.fx.stand || 0) > 0.5 : ep.castOpts?.[W.u.char]?.stand) || (W.fx.stand || 0) > 0.5 || GAITK.some((k) => (W.fx[k] || 0) > 0.3) || W.u.c?.zombie || W.u.char === 'victim' || !W.u.c), kneel: W.fx.kneel || 0, fall: W.fx.fall || 0, trip: W.fx.trip || 0 });
      if (W.u.char !== 'horde') for (const d of W.parts) { if (d.type === 'TubeGeometry' || d.m.userData.noodle || d.max >= 0.35 || d.c.y - W.low >= 0.1 || d.label === 'hand') continue; const mn = Math.min(...d.pts.map((p) => p.y)), gy2 = groundAt(d.c.x, d.c.z), lx = W.u.root.worldToLocal(d.c.clone()).x; feet.push({ who: W.u.name, id: W.u.meshes.indexOf(d.m), side: lx < 0 ? '-1' : '1', x: d.c.x, z: d.c.z, h: mn - gy2 }); } }
    res.gnd = gnd; res.feet = feet;
    // 5. frozen: one number for the whole pose
    const sig = {}; for (const W of U_) { let a = 0, b = 0, k = 1; for (const d of W.parts) { const e = d.m.matrixWorld.elements; for (let i = 0; i < 16; i++) { a += e[i] * (k = (k * 1.0001 + 0.1) % 7); b += e[i] * e[i]; } if (d.m.userData.noodle || d.type === 'TubeGeometry') { const p = d.m.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 7) a += p[i] * ((i % 11) + 1); } } sig[W.u.name] = a.toPrecision(15) + '/' + b.toPrecision(15); }
    res.sig = sig; res.vis = Object.fromEntries(U_.map((W) => [W.u.name, W.vis])); res.rooms = Object.fromEntries(U_.map((W) => [W.u.name, W.head.toArray()]));
    // 6. duplicate props (suspects): the same-looking small mesh held by a unit and lying free
    const held = new Map(), free = new Map(); scene.traverse((m) => { if (!m.isMesh || m.userData.isOutline || !visible(m)) return; const mat = matOf(m); if (!mat || mat.transparent) return; const g = m.geometry; if (!['RoundedBoxGeometry', 'BoxGeometry', 'CylinderGeometry', 'LatheGeometry'].includes(g.type)) return; const d = desc(m); if (d.max < 0.04 || d.max > 0.3 || !inView(d.c)) return;
      const s = dupSig(m), o = owner.get(m); (o ? held : free).set(s, [...((o ? held : free).get(s) || []), { c: d.c.toArray(), who: o?.name || '' }]); });
    res.dup = []; for (const [s, hs] of held) { const fs_ = free.get(s) || []; if (!fs_.length || fs_.length > 2) continue; for (const h of hs) for (const f of fs_) { const dd = new V3(...h.c).distanceTo(new V3(...f.c)); if (dd < TOL.dupD) res.dup.push({ sig: s, who: h.who, at: h.c, other: f.c, dist: dd }); } }

    // ---- v5 (22/11): root positions / carried / foot lifts (nogait), touch distances, text props (reads) ----
    res.root = {}; res.carried = {}; res.gfx = {}; res.fclr = {};
    for (const W of U_) { const c = W.u.root.getWorldPosition(new V3()); res.root[W.u.name] = [c.x, c.y, c.z];
      res.carried[W.u.name] = carRiders.includes(W.u.char) || CONTACT.some((k) => (W.fx[k] || 0) > 0.05) || !!(ep.rides?.[W.u.char] && (W.fx.ride || 0) > 0.02) || (W.fx.fall || 0) > 0.05 || (W.fx.trip || 0) > 0.05;
      res.gfx[W.u.name] = GAITK.reduce((s_, k) => s_ + (W.fx[k] || 0), 0) + (W.fx.fly || 0);
      { const gy = groundAt(c.x, c.z), fc = {}; for (const d of W.parts) { if (d.type === 'TubeGeometry' || d.m.userData.noodle || d.max >= 0.35 || d.c.y > gy + 0.25) continue; const side = W.u.root.worldToLocal(d.c.clone()).x < 0 ? '-1' : '1', mn = Math.min(...d.pts.map((p_) => p_.y)) - gy; if (fc[side] === undefined || mn < fc[side]) fc[side] = mn; } res.fclr[W.u.name] = fc; } }   // foot clearance per side: the lowest point of the shoe parts above the ground
    const solidsNow = []; scene.traverse((m) => { if (m.isMesh && !m.userData.isOutline && !inUnit.has(m) && visible(m)) { const mt = matOf(m); if (mt && mt.visible !== false && mt.opacity >= 0.15 && mt.blending !== THREE.AdditiveBlending && !m.userData.noClip) solidsNow.push(m); } });   // glass counts as a surface to touch (a window wipe), glow does not
    res.touch = [];
    if (TC) for (const e of TC.list) { if (t < e.t0 - 1e-6 || t > e.t1 + 1e-6) continue; const w = U.smooth((t - e.t0) / e.ramp) * U.smooth((e.t1 - t) / e.ramp); if (w < 0.95) continue;
      const W = U_.find((x) => x.u.name === e.who), id = TC.list.indexOf(e), base = { id, who: e.who, hand: e.hand, t0: e.t0, t1: e.t1 };
      if (!W) { res.touch.push({ ...base, err: null, why: 'character not on stage' }); continue; }
      const ball = handBalls(W.u)[e.hand === 'L' ? 0 : 1], p = TC.point(e, t), P_ = new V3(p[0], p[1], p[2]); let err = null; if (ball) { const q = ball.getWorldPosition(new V3()); err = q.distanceTo(P_); }
      let sf = null; const n = new V3(...e.n); if (n.lengthSq() > 1e-6) { n.normalize(); const s0 = P_.clone().addScaledVector(n, -(e.r - e.press)); ray.set(s0.clone().addScaledVector(n, 0.25), n.clone().negate()); ray.far = 1.0; const h = ray.intersectObjects(solidsNow, false)[0]; sf = h ? h.distance - 0.25 : 9; }
      res.touch.push({ ...base, err, sf, vis: inView(P_), at: p, n: ball ? null : 'no hand ball' }); }
    res.tprops = [];
    for (const [k, e] of (ep.touchProps || []).entries()) { const rp = e.ramp ?? 0.3; if (t < e.t0 + rp || t > e.t1 - rp) continue; const W = U_.find((x) => x.u.name === e.who), base = { k, who: e.who, prop: e.prop, t0: e.t0, t1: e.t1 };
      const obj = scene.getObjectByName(e.prop); if (!W || !obj) { res.tprops.push({ ...base, err: null, why: !W ? 'character not on stage' : 'no object named "' + e.prop + '"' }); continue; }
      const ms = []; obj.traverse((m) => { if (m.isMesh && !m.userData.isOutline && visible(m)) ms.push(m); }); const hb = handBalls(W.u), balls = e.hand === 'any' || !e.hand ? hb : [hb[e.hand === 'L' ? 0 : 1]]; let err = 9, at = null;
      for (const b of balls) { if (!b) continue; const q = b.getWorldPosition(new V3()), rr = b.geometry.parameters.radius; for (const m of ms) { const dd = Math.max(0, sdf(q, desc(m), true) - rr); if (dd < err) { err = dd; at = q.toArray(); } } }
      res.tprops.push({ ...base, err: ms.length ? err : null, why: ms.length ? '' : 'object "' + e.prop + '" has no visible mesh', at: at || obj.getWorldPosition(new V3()).toArray(), vis: !!at && inView(new V3(...at)) }); }
    res.reads = [];
    for (const [k, R] of (ep.reads || []).entries()) { if (t < R.t0 - 1e-6 || t > R.t1 + 1e-6) continue; const want = R.text ? nz(R.text) : null, base = { k, text: R.text || R.prop }, cand = [], root_ = R.prop ? scene.getObjectByName(R.prop) : null; let any = 0;
      scene.traverse((m) => { if (!m.isMesh || m.userData.isOutline) return; const cv = canvasOf(m); let ok = false;
        if (R.prop) { let o = m; while (o && o !== root_) o = o.parent; ok = !!root_ && o === root_ && !!cv; } else ok = !!cv && nz(CVT.get(cv).join(' ')).includes(want);
        if (!ok) return; any++; if (visible(m)) cand.push({ m, cv }); });
      if (!any) { res.reads.push({ ...base, state: 'nomatch' }); continue; } if (!cand.length) { res.reads.push({ ...base, state: 'hidden' }); continue; }
      let best = null; const camP = camPos.clone();
      for (const { m, cv } of cand) { const bb = bbox(m.geometry), c0 = bb.getCenter(new V3()), sz = bb.getSize(new V3()), dims = [sz.x, sz.y, sz.z], kk = dims.indexOf(Math.min(...dims)), ua = (kk + 1) % 3, va = (kk + 2) % 3, plane = m.geometry.type === 'PlaneGeometry';
        const wc = c0.clone().applyMatrix4(m.matrixWorld); let bestFace = null;
        for (const sg of plane ? [1] : [1, -1]) { const nl = new V3(); nl.setComponent(kk, sg); const nw = nl.clone().transformDirection(m.matrixWorld), face = c0.clone().addScaledVector(nl, dims[kk] / 2).applyMatrix4(m.matrixWorld), fc = nw.dot(camP.clone().sub(face).normalize()); if (!bestFace || fc > bestFace.fc) bestFace = { sg, nl, nw, face, fc }; }
        const pt = (a, b) => { const l = c0.clone(); l.setComponent(kk, c0.getComponent(kk) + bestFace.sg * dims[kk] / 2); l.setComponent(ua, c0.getComponent(ua) + (a - 0.5) * dims[ua]); l.setComponent(va, c0.getComponent(va) + (b - 0.5) * dims[va]); return l.applyMatrix4(m.matrixWorld); };
        let out = 0; for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const v = pt(a, b).project(cam); out = Math.max(out, Math.abs(v.x) - 1, Math.abs(v.y) - 1, v.z > 1 ? 1 : 0); }
        let blocked = 0, N = 0; const names = {}; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const q = pt(0.1 + 0.2 * i, 0.1 + 0.2 * j), v = q.clone().project(cam); if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue; N++; const dir = q.clone().sub(camP), dist = dir.length(); dir.normalize(); ray.set(camP, dir); ray.far = Math.max(0, dist - 0.04);
          const hit = ray.intersectObjects(occListNow(), false).find((h) => h.object !== m); if (hit) { blocked++; const o = owner.get(hit.object), nm = o ? o.name : (hit.object.name || hit.object.parent?.name || hit.object.geometry.type.replace('Geometry', '')); names[nm] = (names[nm] || 0) + 1; } }
        const rec = { ...base, state: 'ok', out: Math.max(0, out), blocked: N ? blocked / N : 1, nIn: N, facing: bestFace.fc, blocker: Object.entries(names).sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 2).join('+'), at: wc.toArray(), chars: CVT.get(cv).join('').replace(/\s/g, '').length, text: base.text };
        const sc = (rec.out > 0 ? 0 : 1) * (1 - rec.blocked) * Math.max(0, rec.facing); if (!best || sc > best.sc) best = { sc, rec }; }
      res.reads.push(best.rec); }
    return res;
  }
  window.__cc = { step, THREE, frustum, units, ep };
  return { dur: ep.dur, shots: ep.shots.map((s) => ({ t0: s.t0, t1: s.t1, cam: s.cam })), waive: ep.waive || [], unique: ep.clipUnique || [], units: units.map((u) => u.name), castNames: Object.keys(cast), checks: ep.checks, reads: ep.reads || [], nTouch: (ep.touch || []).length, nTouchProps: (ep.touchProps || []).length };
}

// ------------------------------------------------------------------------------------------------------------------------------
(async () => {
  const srv = await serve();
  const b = await chromium.launch({ args: GPU }), p = await b.newPage({ viewport: { width: 540, height: 960 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.__cvText = new WeakMap(); const P = CanvasRenderingContext2D.prototype; for (const k of ['fillText', 'strokeText']) { const o = P[k]; P[k] = function (tx, ...a) { try { const c = this.canvas; if (c && typeof tx === 'string' && tx.trim()) { let L = window.__cvText.get(c); if (!L) window.__cvText.set(c, (L = [])); if (L.length < 40 && !L.includes(tx)) L.push(tx); } } catch (e) {} return o.call(this, tx, ...a); }; } });   // v5: which canvas carries which text (reads)
  await p.goto(`http://localhost:${srv.address().port}/index.html?render=1&nowarm=1&ep=${EPFILE}`); await p.waitForFunction(() => window.filmReady, null, { timeout: READY_TIMEOUT });
  const T0 = Date.now(), info = await p.evaluate(pageInit, TOL), id = path.basename(EPPATH, '.js'), t0 = Number(flag('t0', 0)), t1 = Math.min(Number(flag('t1', info.dur)), info.dur);
  const samples = []; const wanted = (flag('still', '') || '').split(',').filter(Boolean).map(Number);
  for (const t of wanted) { fs.mkdirSync(path.join(ROOT, 'out', id), { recursive: true }); const d = await p.evaluate((t) => { window.stage.render = window.__stageRender; window.seek(t, { overlays: true }); const d = document.getElementById('film').toDataURL('image/jpeg', 0.88).split(',')[1]; window.stage.render = () => {}; return d; }, t); fs.writeFileSync(path.join(ROOT, 'out', id, `clip_at_${t.toFixed(2)}.jpg`), Buffer.from(d, 'base64')); }
  for (let t = t0; t <= t1 + 1e-9; t += STEP) samples.push(await p.evaluate((t) => window.__cc.step(t), +t.toFixed(4)));
  if (flag('raw')) fs.writeFileSync(flag('raw'), JSON.stringify(samples));
  // ---------------- aggregate: samples -> runs (one thing, consecutive steps) -> findings (the same thing over the whole film) ----------------
  const runs = [], open_ = new Map(), shotOf = (t) => Math.max(0, info.shots.findIndex((s) => t >= s.t0 && t < s.t1));
  const add = (check, key, t, mag, o) => { let r = open_.get(key); if (r && t - r.t1 > STEP * 1.6) { runs.push(r); r = null; } if (!r) { r = { check, key, t0: t, t1: t, mag: 0, ...o }; open_.set(key, r); } r.t1 = t; if (mag >= r.mag) { r.mag = mag; r.tp = t; r.at = o.at; r.shot = shotOf(t); r.what = o.what; } };
  samples.forEach((S, i) => {
    for (const o of S.pen) if (o.depth > o.tol) add('pen', `pen|${o.who}|${o.part}|${o.solid}`, S.t, o.depth, { gkey: 'pen|' + o.solid, who: o.who, what: `${o.part} sunk into the ${o.face} of ${o.solid}`, at: o.at, unit: 'm', tol: o.tol });
    for (const o of S.cc) { const crowd = o.a.split('#')[0] === o.b.split('#')[0], tol = crowd ? TOL.crowd : TOL.cc; if (o.depth > tol) add('cc', `cc|${o.a}|${o.b}`, S.t, o.depth, { gkey: 'cc|' + [o.a.split('#')[0], o.b.split('#')[0]].sort().join('|'), who: `${o.a} / ${o.b}`, what: `${o.pa} overlaps ${o.pb}${crowd ? ' (crowd members)' : ''}`, at: o.at, unit: 'm', tol }); }
    for (const o of S.det) if (o.gap > TOL.det) add('detach', `det|${o.who}|${o.sig}`, S.t, o.gap, { gkey: 'det|' + o.who.split('#')[0] + '|' + o.sig, who: o.who, what: `${o.part} (${o.sig}) is ${(o.gap * 100).toFixed(1)} cm from every body volume`, at: o.at, unit: 'm', tol: TOL.det });
    for (const g of S.gnd) { if (!g.vis || g.rider || g.pile > 0.01) continue; if (g.low < g.gy - TOL.below) add('ground', `below|${g.who}`, S.t, g.gy - g.low, { gkey: 'below|' + g.who.split('#')[0], who: g.who, what: `lowest point below the ground (${g.lowPart}; ground = ${g.gw} top ${g.gy.toFixed(2)})`, at: g.at, unit: 'm', tol: TOL.below });
      if (g.low > g.gy + TOL.float && g.standing && !(g.sup > -1e8 && g.low - g.sup < TOL.float) && !g.yfx && !g.fall && !g.trip) add('floatraw', `float|${g.who}`, S.t, g.low - g.gy, { gkey: 'float|' + g.who.split('#')[0], who: g.who, what: `standing character floats above the ground (lowest: ${g.lowPart})`, at: g.at, unit: 'm', tol: TOL.float }); }
    if (i) { const P = samples[i - 1], dt = S.t - P.t; for (const f of S.feet) { const q = P.feet.find((x) => x.who === f.who && x.id === f.id), g = S.gnd.find((x) => x.who === f.who), g0 = P.gnd.find((x) => x.who === f.who); if ((f.side === '1' && g.dragLeg) || !q || !g || !g0 || !g.vis || g.rider || g.kneel > 0.3 || g.fall > 0.05 || g.trip > 0.05 || g.pile > 0.01) continue;
        const rootV = Math.hypot(g.at[0] - g0.at[0], g.at[2] - g0.at[2]) / dt; if (rootV > 9) continue;   // a cut moved the character (stands): not a slide
        if (f.h < 0.02 && q.h < 0.02) { const v = Math.hypot(f.x - q.x, f.z - q.z) / dt; if (v > TOL.slide) add('slide', `slide|${f.who}|${f.id}`, S.t, v, { gkey: 'slide|' + f.who.split('#')[0], who: f.who, what: `foot #${f.id} (${f.side === '-1' ? 'left' : 'right'}) planted but moves${g.gait > 0.3 ? ' during a gait' : ' (no gait fx: gliding)'}, character speed ${rootV.toFixed(1)} m/s`, at: [f.x, 0, f.z], unit: 'm/s', tol: TOL.slide }); } } }
    for (const o of S.dup) add('dup', `dup|${o.sig}|${o.who}`, S.t, o.dist, { gkey: 'dup|' + o.sig + '|' + o.who, who: o.who, what: `${o.sig}: held and also lying ${o.dist.toFixed(2)} m away`, at: o.at, unit: 'm', tol: 0, sig: o.sig });
  });
  for (const r of open_.values()) runs.push(r);
  // ---------------- v5 (22/11) "checks 2": no-gait moves, touch distance, readable text props, broad waivers ----------------
  const NEW = info.checks >= 2 || (info.checks === undefined && !LEGACY.has(id)), carriedMoves = [];
  const pushR = (check, key, gkey, who, what, t0, t1, mag, tol, unit, at, tp, extra = {}) => runs.push({ check, key, gkey, who, what, t0, t1, mag, tol, unit, at, tp, shot: shotOf(tp), ...extra });
  const wAll = (info.waive || []), wBad = wAll.map((w) => (NEW && /^clip(\.|$)/.test(w.check || '') ? waiverProblem(w, info.dur, info.castNames) : '')), WV = wAll.filter((w, i) => !wBad[i]);
  if (NEW) {
    wAll.forEach((w, i) => { if (wBad[i]) pushR('waiver', 'waiver|' + i, 'waiver|' + i, w.who || w.check, `waiver {${w.check}, ${(w.t0 ?? 0).toFixed(1)}..${Math.min(info.dur, w.t1 ?? 1e9).toFixed(1)} s} is not accepted: ${wBad[i]}`, w.t0 ?? 0, Math.min(info.dur, w.t1 ?? 1e9), 1, 1, '', [0, 0, 0], w.t0 ?? 0, { nostill: true }); });
    const shotAt = (t) => info.shots.findIndex((s_) => t >= s_.t0 && t < s_.t1);
    for (const n of info.units) { if (/^horde/.test(n)) continue; let run = null;
      const flush = () => { if (!run) return; const R = run; run = null; const net = Math.hypot(R.last[0] - R.first[0], R.last[2] - R.first[2]); if (net < V5.move || !R.vis) return;
        if (R.carried) { carriedMoves.push(`${n} ${R.t0.toFixed(1)}-${R.t1.toFixed(1)} s (${net.toFixed(1)} m, carried: ride / contact fx / car rider)`); return; }
        const mx = { '-1': 0, '1': 0 }; let nf = 0; for (const S of samples) { if (S.t < R.t0 - 1e-6 || S.t > R.t1 + 1e-6) continue; const fc = S.fclr[n] || {}; for (const sd of ['-1', '1']) if (fc[sd] !== undefined) { nf++; mx[sd] = Math.max(mx[sd], fc[sd]); } }
        let walked, how; if (!nf) { walked = R.gfx > 0.3; how = `no feet to measure; walk fx ${R.gfx.toFixed(1)} (need > 0.3)`; } else { walked = (mx['-1'] >= V5.lift && mx['1'] >= V5.lift) || (net < 0.8 && Math.max(mx['-1'], mx['1']) >= V5.lift); how = `feet lift only ${(mx['-1'] * 100).toFixed(1)} / ${(mx['1'] * 100).toFixed(1)} cm (a step lifts at least ${V5.lift * 100} cm${net >= 0.8 ? ' with both feet' : ''})`; }
        if (!walked) pushR('nogait', `nogait|${n}|${R.t0.toFixed(2)}`, 'nogait|' + n.split('#')[0], n, `${n} changes place by ${net.toFixed(2)} m (${R.t0.toFixed(1)}-${R.t1.toFixed(1)} s) inside one shot with no walk cycle: ${how}. Use a walk cycle (stand gait / path() + fx walk), or put the jump on a cut; a ride / carrier needs its own fx`, R.t0, R.t1, net / V5.move, 1, 'x limit', [R.first[0], 0.9, R.first[2]], (R.t0 + R.t1) / 2); };
      for (let i = 1; i < samples.length; i++) { const A = samples[i - 1], B = samples[i], a = A.root?.[n], b = B.root?.[n], sa = shotAt(A.t), sb = shotAt(B.t);
        if (!a || !b || sa !== sb || sa < 0) { flush(); continue; }
        const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
        if (d >= V5.pairMin) { if (!run) run = { first: a, last: b, t0: A.t, t1: B.t, vis: false, carried: false, gfx: 0 }; run.last = b; run.t1 = B.t; run.vis ||= !!(A.vis[n] || B.vis[n]); run.carried ||= !!(A.carried[n] || B.carried[n]); run.gfx = Math.max(run.gfx, A.gfx[n] || 0, B.gfx[n] || 0); } else flush(); }
      flush(); }
    for (const S of samples) { const nm = (o) => `${o.who} ${o.hand === 'L' ? 'left' : 'right'} hand`;
      for (const o of S.touch) { const who = o.who;
        if (o.err === null) { add('touch', `touch|${o.id}|nohand`, S.t, 1, { gkey: `touch|${o.id}|nohand`, who, what: `${nm(o)}: ${o.why || 'no hand ball found on this character (touch works for makePerson characters and Teo, not Bip)'}`, at: [0, 0, 0], unit: '', tol: 0.5 }); continue; }
        if (!o.vis) continue;
        if (o.err > V5.touchErr) add('touch', `touch|${o.id}|err`, S.t, o.err, { gkey: `touch|${o.id}|err`, who, what: `${nm(o)} must be ON its touch point (ep.touch entry ${o.id}, ${o.t0.toFixed(1)}-${o.t1.toFixed(1)} s) but ends ${(o.err * 100).toFixed(0)} cm from it (reach / lean too short: move the character closer)`, at: o.at, unit: 'm', tol: V5.touchErr });
        if (o.sf !== null && Math.abs(o.sf) > V5.surfErr) add('touch', `touch|${o.id}|surf`, S.t, Math.abs(o.sf), { gkey: `touch|${o.id}|surf`, who, what: `${nm(o)}: the declared touch point (entry ${o.id}) is ${o.sf >= 1 ? 'over 75 cm from any surface below it (nothing to touch)' : (Math.abs(o.sf) * 100).toFixed(0) + ' cm ' + (o.sf > 0 ? 'ABOVE' : 'INSIDE') + ' the surface under it'}`, at: o.at, unit: 'm', tol: V5.surfErr }); }
      for (const o of S.tprops) { if (o.err === null) { add('touch', `tprop|${o.k}|x`, S.t, 1, { gkey: `tprop|${o.k}|x`, who: o.who, what: `touchProps ${o.k} (${o.who} on "${o.prop}"): ${o.why}`, at: [0, 0, 0], unit: '', tol: 0.5 }); continue; }
        if (o.vis && o.err > V5.touchErr) add('touch', `tprop|${o.k}|err`, S.t, o.err, { gkey: `tprop|${o.k}|err`, who: o.who, what: `${o.who}'s hand must touch "${o.prop}" (${o.t0.toFixed(1)}-${o.t1.toFixed(1)} s) but is ${(o.err * 100).toFixed(0)} cm from its surface`, at: o.at, unit: 'm', tol: V5.touchErr }); }
      for (const o of S.reads) { let bad = '', mag = 1; if (o.state === 'nomatch') bad = 'matches no canvas-text prop in the scene (wrong text, or the prop is not built)'; else if (o.state === 'hidden') bad = 'is not visible (prop hidden or not yet / no longer in the scene)';
        else { const parts = []; if (o.out > 0) { parts.push(`runs out of the frame (${(o.out * 100).toFixed(0)} % past the edge)`); mag = Math.max(mag, 1 + o.out); } if (o.blocked > V5.readBlock) { parts.push(`${(o.blocked * 100).toFixed(0)} % of its face is covered by ${o.blocker || 'something'}`); mag = Math.max(mag, o.blocked / V5.readBlock); } if (o.facing < V5.readFace) { parts.push(`turned away from the camera (cos ${o.facing.toFixed(2)}, need ${V5.readFace})`); mag = Math.max(mag, 1.5); } bad = parts.join('; '); }
        if (bad) add('reads', `reads|${o.k}`, S.t, mag, { gkey: `reads|${o.k}`, who: `prop "${o.text}"`, what: `text prop "${o.text}" ${bad}`, at: o.at || [0, 0, 0], unit: '', tol: 1 }); }
    }
    for (const [k, R] of (info.reads || []).entries()) { const rec = samples.flatMap((S) => S.reads).find((o) => o.k === k && o.chars), chars = R.chars ?? rec?.chars ?? String(R.text || '').replace(/\s/g, '').length, need = 1.0 + chars / 12;
      if (R.t1 - R.t0 < need - 1e-6) pushR('reads', `reads|${k}|short`, `reads|${k}|short`, `prop "${R.text || R.prop}"`, `text prop "${R.text || R.prop}" is declared readable for ${(R.t1 - R.t0).toFixed(2)} s but ${chars} characters need 1.0 + ${chars}/12 = ${need.toFixed(2)} s`, R.t0, R.t1, need / Math.max(0.01, R.t1 - R.t0), 1, '', [0, 0, 0], R.t0, { nostill: true }); }
    for (const r of open_.values()) if (!runs.includes(r) && ['touch', 'reads'].includes(r.check)) runs.push(r);
  }
  const out = [];
  for (const r of runs) { if (r.check === 'floatraw') { if (r.t1 - r.t0 + STEP >= TOL.floatT) out.push({ ...r, check: 'ground' }); } else if (r.check === 'slide' && r.t1 - r.t0 < STEP * 1.5) { /* one step is noise */ } else out.push(r); }
  // frozen: the pose signature of a visible character stays bit-identical for > frozenT
  for (const n of info.units) { let a = 0; const flush = (end) => { const d = samples[end].t - samples[a].t; if (d >= TOL.frozenT && samples[a].vis[n] && samples[end].vis[n]) out.push({ check: 'frozen', key: 'frozen|' + n, gkey: 'frozen|' + n, who: n, what: `pose bit-identical for ${d.toFixed(1)} s`, t0: samples[a].t, t1: samples[end].t, mag: d, tp: samples[a].t + d / 2, at: samples[a].rooms[n], shot: shotOf(samples[a].t + d / 2), unit: 's', tol: TOL.frozenT }); };
    for (let i = 1; i < samples.length; i++) { const same = samples[i].sig[n] !== undefined && samples[i].sig[n] === samples[a].sig[n] && samples[i].vis[n] && samples[a].vis[n]; if (!same) { flush(i - 1); a = i; } } flush(samples.length - 1); }
  for (const r of out) { if (r.check === 'dup') r.suspect = !(info.unique || []).some((u) => r.sig.includes(u)); if (r.check === 'waiver') continue; const w = WV.find((w) => (w.check === 'clip' || w.check === 'clip.' + r.check) && r.t1 >= (w.t0 ?? 0) && r.t0 <= (w.t1 ?? 1e9) && (!NEW || !w.who || String(r.who).split(/[ ,\/]+/).some((x) => [].concat(w.who).includes(x.split('#')[0])))); if (w) { r.waived = w.reason || 'no reason given'; w.hit = (w.hit || 0) + 1; r.carrier = w.carrier; } }
  // one finding per (check, who, what) over the whole film: its windows, its worst moment
  const groups = new Map(); for (const r of out) { const g = groups.get(r.gkey) || groups.set(r.gkey, { ...r, windows: [], whos: new Set(), waived: 'x' }).get(r.gkey); g.windows.push([r.t0, r.t1]); g.whos.add(r.who); if (r.mag / Math.max(r.tol, 1e-6) > g.mag / Math.max(g.tol, 1e-6)) for (const k of ['mag', 'tp', 'at', 'shot', 'what', 'who', 'tol']) g[k] = r[k]; if (!r.waived) g.waived = null; else if (g.waived !== null) g.waived = r.waived; }
  const keep = [...groups.values()]; for (const g of keep) { g.t0 = Math.min(...g.windows.map((w) => w[0])); g.t1 = Math.max(...g.windows.map((w) => w[1])); if (g.waived === 'x') g.waived = null; g.windows.sort((a, b) => a[0] - b[0]); g.windows = g.windows.reduce((m, w) => { const l = m[m.length - 1]; if (l && w[0] <= l[1] + STEP * 1.6) l[1] = Math.max(l[1], w[1]); else m.push([...w]); return m; }, []); const w = [...g.whos]; g.whoStr = w.length > 3 ? `${w.slice(0, 3).join(', ')} +${w.length - 3} more` : w.join(', '); }
  const counted = keep.filter((r) => !r.waived && !r.suspect), sc = (r) => r.mag / Math.max(r.tol, 1e-6);
  // stills of the worst findings (distinct check + who first, then the rest)
  const sorted = [...counted].filter((r) => !r.nostill).sort((a, b) => sc(b) - sc(a)), seen = new Set(), worst = []; for (const r of sorted) { const k = r.check; if (!seen.has(k) && worst.length < NSTILL) { seen.add(k); worst.push(r); } } for (const r of sorted) if (worst.length < NSTILL && !worst.includes(r)) worst.push(r);
  const dir = path.join(ROOT, 'out', id); if (worst.length) fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => /^clip_\d+_.*\.jpg$/.test(x)) : []) fs.unlinkSync(path.join(dir, f));
  for (const [i, r] of worst.entries()) { const data = await p.evaluate(async ([t, at, label]) => { const THREE = window.__cc.THREE; window.stage.render = window.__stageRender; window.seek(t, { overlays: true }); const CW = window.stage.W || 1080, CH = window.stage.H || 1920, c = document.createElement('canvas'); c.width = CW; c.height = CH; const x = c.getContext('2d'); x.drawImage(document.getElementById('film'), 0, 0);
      const v = new THREE.Vector3(...at).project(window.stage.camera), px = (v.x * 0.5 + 0.5) * CW, py = (-v.y * 0.5 + 0.5) * CH; x.strokeStyle = '#ff2bd6'; x.lineWidth = 8; x.beginPath(); x.arc(px, py, 70, 0, 7); x.stroke(); x.fillStyle = '#ff2bd6'; x.fillRect(0, 0, CW, 64); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.fillText(label, 14, 46);
      window.stage.render = () => {}; return c.toDataURL('image/jpeg', 0.88).split(',')[1]; }, [r.tp, r.at, `${r.check} ${r.who} t=${r.tp.toFixed(2)} ${r.mag.toFixed(3)}${r.unit}`]).catch(() => null);
    if (data) { r.still = `clip_${i + 1}_${r.check}_t${r.tp.toFixed(2)}.jpg`; fs.writeFileSync(path.join(dir, r.still), Buffer.from(data, 'base64')); } }
  // ---------------- report ----------------
  const names = { pen: 'INTERPENETRATION (part inside a set solid)', cc: 'CHARACTER OVERLAP (body volumes, no declared contact)', detach: 'DETACHED PARTS (glasses, antenna, held props)', slide: 'FOOT SLIDE', ground: 'GROUND (below / floating)', frozen: 'FROZEN CHARACTER', dup: 'DUPLICATE PROPS', nogait: 'MOVE WITHOUT A WALK CYCLE (v5)', touch: 'HAND NOT ON WHAT IT TOUCHES (v5)', reads: 'TEXT PROP NOT READABLE (v5)', waiver: 'WAIVER NOT ACCEPTED (v5)' };
  const ms = Date.now() - T0, fmtW = (w) => (w.length > 3 ? `${w.length} windows ` : '') + w.slice(0, 3).map((x) => `${x[0].toFixed(1)}-${x[1].toFixed(1)}`).join(', ');
  console.log(`${counted.length ? 'CLIP FAIL (' + counted.length + ')' : 'CLIP PASS'}  ${EPFILE}  ${samples.length} steps of ${STEP} s over ${t0}-${t1.toFixed(1)} s, ${(ms / 1000).toFixed(1)} s wall`);
  console.log('  tolerances ' + JSON.stringify(TOL));
  for (const c of Object.keys(names)) { const L = keep.filter((r) => r.check === c).sort((a, b) => sc(b) - sc(a)); if (!L.length) continue; console.log(`-- ${names[c]}: ${L.length}`);
    for (const r of (VERBOSE ? L : L.slice(0, 10))) console.log(`  ${r.waived ? 'WAIVED' : r.suspect ? 'SUSPECT' : 'FAIL  '} ${r.whoStr}: ${r.what}  [peak ${r.mag.toFixed(3)} ${r.unit}${r.tol ? ' vs ' + r.tol : ''} at t ${r.tp.toFixed(2)}, shot ${r.shot} ${(info.shots[r.shot] || {}).cam}; t ${fmtW(r.windows)}]${r.waived ? '  waived: ' + r.waived : ''}${r.still ? '  -> out/' + id + '/' + r.still : ''}`);
    if (!VERBOSE && L.length > 10) console.log(`  ... ${L.length - 10} more (--verbose)`); }
  if (!keep.length) console.log('  nothing found');
  if (NEW) { console.log(`v5 checks 2 ON (${info.checks >= 2 ? 'checks: 2' : 'default'}): touch entries ${info.nTouch} + touchProps ${info.nTouchProps}, reads ${(info.reads || []).length}, carried moves skipped ${carriedMoves.length}`); for (const c of carriedMoves.slice(0, 8)) console.log('  carried: ' + c);
    for (const w of WV) if (/^clip\.nogait$/.test(w.check || '')) console.log(`  CARRIER WAIVER ${w.who || ''} ${w.t0}-${w.t1} s carried by "${w.carrier}": ${w.reason}`);
    for (const w of WV) if (!w.hit && /^clip\./.test(w.check || '')) console.log(`  note: waiver {${w.check}, ${w.t0}..${w.t1}} matched nothing: remove it`); } else console.log('v5 checks 2 OFF: ' + id + ' is on the LEGACY list (approved before 22/11; edit it and give it `checks: 2` to turn them on)');
  console.log('dup props: a held prop with an identical one lying free within 0.9 m is only a SUSPECT (the scene graph cannot say if the episode means one object); declare clipUnique: [\'<signature>\'] in the episode to make it count.');
  for (const e of errs) console.log('page error: ' + e);
  if (flag('json')) fs.writeFileSync(flag('json'), JSON.stringify({ ep: EPFILE, pass: !counted.length, tol: TOL, findings: keep }, null, 1));
  await b.close(); srv.close(); process.exit(counted.length ? 1 : 0);
})();
