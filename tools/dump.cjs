// cine3d export for other renderers (Blender): the staging the engine already computes, frame by frame, as JSON. No picture is drawn.
//   node tools/dump.cjs <ep.js> <out.json> [--fps 30] [--from s] [--to s] [--faces dir] [--set-dyn]   (--set-dyn: per-frame deltas of the set meshes that set fx move / show / hide, ids = tools/export_set.cjs names) [--faces <dir>] [--face-size 512]
//   --props <dir>: ALSO write the scene-level meshes the episode's props() adds (cloth, knot...) to <dir>/props.json + props_<k>.f32 (blender/props_cache.py plays them); the dump itself is unchanged
//   --faces <dir>: ALSO save, for every frame and every cast member, the drawn face canvas (eyes, brows, mouth, blush; Bip's visor bars) as <dir>/<who>/f_00000.png
//   (same absolute frame numbers as the dump) plus <dir>/faces_meta.json. The canvas is the one the character's own drawFace() painted during seekState(t): nothing is re-drawn here.
//   --faces-plus <dir>: ALSO save the same face sequences with richer ACTING (packs/trada/faceplus.js: eased emotion changes, blinks, eye darts, gaze lead, brow pops,
//   Rhubarb mouth shapes, smirk / sweat / blush / Bip's scan and bars), drawn by the SAME drawFace code (its optional last argument). Tèo and Bíp only; other cast = plain faces.
//   With --face-size larger than a canvas (e.g. 1024), the canvas is drawn at that size (crisp, not scaled up). The dump JSON is the same with or without it.
// Frame f is sampled at t = (f + 0.5) / fps (the same instant render.cjs uses), AFTER window.seekState(t) has run the whole player (camera solve, poses, set, props, lights).
// Fields are documented in ENGINE.md, "Export for other renderers (15/11)".
const fs = require('fs'), path = require('path'), { start, flagOf } = require('./_page.cjs');
const args = process.argv.slice(2), epf = args[0], out = args[1], flag = flagOf(args);
if (!epf || !out) { console.log('usage: node tools/dump.cjs <ep.js> <out.json> [--fps 30] [--from s] [--to s] [--faces <dir>] [--faces-plus <dir>] [--face-size 512]'); process.exit(1); }
// runs inside the page
async function collect({ frames, FPS, first, faces, fsize, setDyn, propsOn }) {
  const THREE = await import('three'), { blink } = await import('/core/rig.js'), { fovOf } = await import('/core/camera.js');
  const stage = window.stage, cast = window.cast, ep = window.ep, set = window.set, lights = set.lights, R = (x) => Math.round(x * 1e4) / 1e4;
  const arr = (v) => [R(v.x), R(v.y), R(v.z)], qarr = (q) => [R(q.x), R(q.y), R(q.z), R(q.w)];
  const kinds = {}; for (const e of ep.cast || []) { const [n, k] = e.split(':'); kinds[n] = k || n; }
  // blink seed of each character (the face drawing calls blink(t, seed); the seed is a builder option, not exposed on the character)
  const BASE = { teo: 1, bip: 7, chip: 11, ba: 11, me: 17, khach: 23, ron: 11, leo: 23 };
  const seedOf = (n) => { const o = ep.castOpts?.[n] || {}, k = kinds[n]; if (k === 'teo') return o.seed ?? 1; if (k === 'bip') return (o.seed ?? 2) + 5; if (k === 'chip') return (o.seed ?? 6) + 5; return o.seed ?? BASE[k]; };
  // capture the pose numbers each character is given (hand targets, mouth); the last call of a frame is the final one
  const last = {}; for (const [n, c] of Object.entries(cast)) { const o = c.apply; c.apply = (p, t) => { last[n] = { p, t }; return o.call(c, p, t); }; }
  // every light of the scene, in a fixed order
  const L = []; stage.scene.traverse((o) => { if (o.isLight) L.push(o); });
  const role = (l) => (l === lights?.hemi ? 'hemi' : l === lights?.key ? 'key' : l === lights?.rim ? 'rim' : l === lights?.kick ? 'kick' : 'practical');
  const header = { lights: L.map((l, i) => ({ i, role: role(l), type: l.type, name: l.name || l.parent?.name || '', castShadow: !!l.castShadow, ...(l.isSpotLight ? { angle: R(l.angle), penumbra: R(l.penumbra), decay: l.decay } : {}), ...(l.isPointLight ? { distance: l.distance, decay: l.decay } : {}) })) };
  const swaps = (ep.overlays || []).filter((o) => o.kind === 'setswap');
  const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const swapA = (t) => { let a = 0; for (const o of swaps) { const f = Math.max(o.fade ?? 0.5, 1e-3); a = Math.max(a, sm(Math.min((t - o.t0) / f, (o.t1 - t) / f))); } return a; };
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpV2 = new THREE.Vector3(), G = stage.grade.uniforms;
  const rec = [], facePng = [];
  // --faces: the face canvas of each cast member = the first canvas texture (>= 256 px) on a mesh under its head group (Teo / people: the sphere patch; Bip: the visor screen; Ron / Leo: the 768 px patch)
  const faceCv = {}; if (faces) for (const [n, c] of Object.entries(cast)) { c.root.traverse((o) => { if (faceCv[n] || !o.isMesh) return; const m = Array.isArray(o.material) ? o.material[0] : o.material, cv = m?.map?.userData?.canvas; if (!cv || cv.width < 256) return;
    for (let p = o.parent; p; p = p.parent) if (p === c.head) { faceCv[n] = { cv, additive: m.blending === THREE.AdditiveBlending, mesh: o.geometry.type }; break; } }); }
  const small = document.createElement('canvas');
  // --props: scene-level meshes that ep.props() added (every mesh under a top-level scene child that is not the set, a cast root, a light group or a camera)
  let PR = null, propMeta = null; const propRows = [], propCup = [];
  if (propsOn) { PR = (window.__c3dProps ||= (() => { const known = new Set([set.group, ...Object.values(cast).map((c) => c.root)]), meshes = [];
      for (const ch of stage.scene.children) { if (known.has(ch) || ch.isLight || ch.isCamera) continue; let hasL = false; ch.traverse((o) => { if (o.isLight) hasL = true; }); if (hasL) continue; ch.traverse((o) => { if (o.isMesh) meshes.push(o); }); }
      return { meshes, prev: new Map(), meta: null }; })());
    if (!PR.meta) PR.meta = PR.meshes.map((m, i) => { const g = m.geometry, mt = Array.isArray(m.material) ? m.material[0] : m.material, ix = g.index ? Array.from(g.index.array) : Array.from({ length: g.attributes.position.count }, (_, k) => k), uvA = g.attributes.uv;
      return { id: 'c3dprop_' + i, name: m.name || g.type, geom: g.type, vcount: g.attributes.position.count, index: ix, uv: uvA ? Array.from(uvA.array, (x) => Math.round(x * 1e5) / 1e5) : null, cast: !!m.castShadow, receive: !!m.receiveShadow,
        material: { type: mt.type, color: mt.color ? '#' + mt.color.getHexString() : null, emissive: mt.emissive ? '#' + mt.emissive.getHexString() : null, emissiveIntensity: mt.emissiveIntensity ?? null, roughness: mt.roughness ?? null, metalness: mt.metalness ?? null,
          opacity: mt.opacity, transparent: !!mt.transparent, side: mt.side, hasMap: !!mt.map, depthWrite: mt.depthWrite, renderOrder: m.renderOrder, ...(mt.map?.userData?.canvas ? { mapPng: mt.map.userData.canvas.toDataURL('image/png').slice(22) } : {}) } }; }); propMeta = PR.meta; }
  for (const f of frames) {
    const t = (f + 0.5) / FPS, cam = window.seekState(t), shot = window.player.shotAt(t), C = stage.camera;
    stage.scene.updateMatrixWorld(true);
    const fw = tmpV.set(0, 0, -1).applyQuaternion(C.quaternion), fm = 18 / Math.tan(C.fov * Math.PI / 360);
    const camera = { p: arr(C.position), q: qarr(C.quaternion), fov: R(C.fov), f_mm: R(fm), focus: R(cam.focus), aperture: R(cam.aperture), fstop: cam.aperture > 0 ? R(fm * fm / (18.75 * cam.aperture)) : null, focus_point: arr(tmpV2.copy(C.position).addScaledVector(fw, cam.focus)), shake: undefined };
    delete camera.shake;
    const chars = {};
    for (const [n, c] of Object.entries(cast)) {
      const ls = last[n], p = ls?.p || {}, tt = ls?.t ?? t, root = c.root, o = {};
      root.getWorldPosition(tmpV); o.root = arr(tmpV); root.getWorldQuaternion(tmpQ); o.yaw = R(new THREE.Euler().setFromQuaternion(tmpQ, 'YXZ').y);
      if (c.body) { c.body.getWorldQuaternion(tmpQ); o.body_q = qarr(tmpQ); }
      c.headWorld(tmpV); o.head = arr(tmpV); if (c.head) { c.head.getWorldQuaternion(tmpQ); o.head_q = qarr(tmpQ); o.head_rel = [R(c.head.rotation.x), R(c.head.rotation.y), R(c.head.rotation.z)]; }
      if (p._emo) o.emo = [p._emo[0], p._emo[1], R(p._emo[2])]; if (p._pose) o.pose = [p._pose[0], p._pose[1], R(p._pose[2])];
      o.mouth = R(p.talk || 0); const sd = seedOf(n); o.blink = sd === undefined ? null : R(blink(tt, sd));
      if (p._lookAt) o.look = [p._what, ...p._lookAt.map(R)];
      const hands = {}; for (const k of ['l', 'r']) if (p[k] && c.body) hands[k] = arr(c.body.localToWorld(tmpV.set(p[k][0], p[k][1], p[k][2]))); if (hands.l || hands.r) o.hands = hands;
      chars[n] = o;
    }
    if (faces) { const row = { f }; for (const [n, fc] of Object.entries(faceCv)) { let src = fc.cv; if (fsize && src.width > fsize) { const k = fsize / src.width; small.width = fsize; small.height = Math.round(src.height * k); const g = small.getContext('2d'); g.clearRect(0, 0, small.width, small.height); g.drawImage(src, 0, 0, small.width, small.height); src = small; } row[n] = src.toDataURL('image/png').slice(22); } facePng.push(row); }
    const lr = L.map((l) => { l.getWorldPosition(tmpV); const on = l.visible ? 1 : 0;
      if (l.isHemisphereLight) return [R(l.intensity * on), l.color.getHexString(), l.groundColor.getHexString()];
      const row = [R(l.intensity * on), l.color.getHexString(), ...arr(tmpV)]; if (l.isSpotLight) { l.target.getWorldPosition(tmpV2); row.push(...arr(tmpV2)); } return row; });
    const fog = stage.scene.fog;
    // --set-dyn: the set meshes that set fx move / show / hide, as DELTAS (a mesh is written when its effective visibility or world
    // transform changed since the previous frame; the first frame of the dump writes every mesh). Ids = tools/export_set.cjs names.
    let set_dyn = null;
    if (setDyn) { const g = set.group; g.updateMatrixWorld(true); const prev = (window.__c3dSetPrev ||= {}); set_dyn = {}; let mi = 0; const P = new THREE.Vector3(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3();
      g.traverse((o) => { if (!o.isMesh) return; const id = 'c3dset_' + (mi++); let vis = true; for (let q = o; q && q !== g.parent; q = q.parent) if (!q.visible) { vis = false; break; }
        o.matrixWorld.decompose(P, Q, Sc); const st = [vis ? 1 : 0, ...arr(P), ...qarr(Q), ...arr(Sc)], k = st.join(',');
        if (first && f === frames[0] || prev[id] !== k) { set_dyn[id] = st; prev[id] = k; } }); }
    if (PR) { const row = {}; PR.meshes.forEach((m, i) => { m.updateWorldMatrix(true, false); let vis = 1; for (let q = m; q; q = q.parent) if (!q.visible) { vis = 0; break; }
        const pa = m.geometry.attributes.position, pv = pa.array, mwA = Array.from(m.matrixWorld.elements, (x) => Math.round(x * 1e5) / 1e5), mwK = mwA.join(','), pr = PR.prev.get(i), e = {};
        if (!pr || pr.vis !== vis) e.vis = vis; if (!pr || pr.mw !== mwK) e.mw = mwA;
        let same = !!pr && pr.pos.length === pv.length; if (same) for (let k = 0; k < pv.length; k++) if (Math.abs(pr.pos[k] - pv[k]) > 5e-6) { same = false; break; }
        if (!same) { e.v = Array.from(pv, (x) => Math.round(x * 1e5) / 1e5); }
        PR.prev.set(i, { vis, mw: mwK, pos: same ? pr.pos : Float32Array.from(pv) }); if (Object.keys(e).length) row[i] = e; }); propRows.push(row);
      propCup.push(Object.fromEntries(Object.keys(cast).map((n) => [n, R(Number(last[n]?.p?.cup) || 0)]))); }
    rec.push({ f, t: R(t), shot: ep.shots.indexOf(shot), cam_token: shot.cam, base: cam.base, camera, chars, lights: lr, ...(set_dyn ? { set_dyn } : {}),
      look: { exposure: R(stage.renderer.toneMappingExposure), bloom: R(stage.bloom.strength), contrast: R(G.contrast.value), sat: R(G.sat.value), vig: R(G.vig.value), ...(fog ? { fog: [fog.color.getHexString(), R(fog.density)] } : {}) },
      ...(set.lgState ? { lg: [R(set.lgState.S), R(set.lgState.R), R(set.lgState.B), R(set.lgState.street), R(set.lgState.d)] } : {}), ...(swaps.length ? { swap: R(swapA(t)) } : {}) });
  }
  return { rec, propRows, propCup, propMeta, header, facePng, faceInfo: Object.fromEntries(Object.entries(faceCv).map(([n, v]) => [n, { size: [v.cv.width, v.cv.height], blend: v.additive ? 'additive' : 'alpha', mesh_geometry: v.mesh }])) };
}
// --faces-plus: Rhubarb mouth cues (phonetic recogniser: the speech is Vietnamese) for every spoken line of a plus character in the range, from his own voice stem
// out/<id>/audio/vo_<who>.wav (else stem_voice.wav), cut at the line times; cached in <dir>/_rhubarb/. Returns { who: [[start, end, shape], ...] (film seconds), _info }.
async function rhubarbCues(info, id, from, to, dir) {
  const { execFile } = require('child_process'), run = (cmd, a) => new Promise((res, rej) => execFile(cmd, a, { maxBuffer: 1 << 24 }, (e, so, se) => (e ? rej(new Error(cmd + ': ' + (se || e.message))) : res(so))));
  const RH = process.env.RHUBARB || path.join(require('os').homedir(), 'studio-assets/tools/rhubarb/Rhubarb-Lip-Sync-1.14.0-macOS/rhubarb'), ROOT = path.join(__dirname, '..');
  const out = { _info: { rhubarb: RH, recogniser: 'phonetic', stems: {}, lines: 0 } };
  if (!fs.existsSync(RH)) { console.log('\nRhubarb not found (' + RH + '): mouth shapes fall back to loudness only'); out._info.missing = true; return out; }
  const cdir = path.join(dir, '_rhubarb'); fs.mkdirSync(cdir, { recursive: true });
  const jobs = info.lines.filter((l) => /^(teo|bip)$/.test((info.cast.find((c) => c.split(':')[0] === l.who) || '').split(':').pop() || '') && !l.think && l.t1 > from - 0.5 && l.t0 < to + 0.5);
  const todo = jobs.map((l) => async () => { let stem = path.join(ROOT, `out/${id}/audio/vo_${l.who}.wav`); if (!fs.existsSync(stem)) stem = path.join(ROOT, `out/${id}/audio/stem_voice.wav`); out._info.stems[l.who] = path.relative(ROOT, stem);
    const a = Math.max(0, l.t0 - 0.05), b = l.t1 + 0.1, key = `${l.who}_${l.id}_${a.toFixed(3)}_${b.toFixed(3)}`, js = path.join(cdir, key + '.json'), wav = path.join(cdir, key + '.wav');
    if (!fs.existsSync(js) || fs.statSync(js).mtimeMs < fs.statSync(stem).mtimeMs) { await run('ffmpeg', ['-v', 'error', '-y', '-ss', a.toFixed(3), '-to', b.toFixed(3), '-i', stem, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
      fs.writeFileSync(js, await run(RH, ['-r', 'phonetic', '-f', 'json', '-q', wav])); fs.rmSync(wav, { force: true }); }
    (out[l.who] ||= []).push(...JSON.parse(fs.readFileSync(js, 'utf8')).mouthCues.map((c) => [Math.round((a + c.start) * 1e4) / 1e4, Math.round((a + c.end) * 1e4) / 1e4, c.value]).filter((c) => c[0] < l.t1 + 0.05 && c[1] > l.t0 - 0.05)); out._info.lines++; });
  const pool = Array.from({ length: 6 }, async () => { while (todo.length) await todo.shift()(); }); await Promise.all(pool);
  for (const k of Object.keys(out)) if (k !== '_info') out[k].sort((x, y) => x[0] - y[0]);
  return out;
}
// --faces-plus, runs inside the page: a SECOND sweep over the same frames with the acting layer on. The player's camera / head solve starts from the state the
// previous seek left, so the plus sweep repeats the plain sweep's exact history (reset = the same seekState(0.01) the start-up ran, then frame after frame):
// the 3-D state, and so the gaze numbers the acting reads, are those of the plain sweep. The face canvas is drawn k times larger when --face-size asks for it.
async function collectPlus({ frames, FPS, psize, reset }) {
  const THREE = await import('three'), cast = window.cast, FP = window.__fp, small = document.createElement('canvas'), png = [], meta = [];
  const cvs = {}; for (const [n, c] of Object.entries(cast)) { c.root.traverse((o) => { if (cvs[n] || !o.isMesh) return; const m = Array.isArray(o.material) ? o.material[0] : o.material, cv = m?.map?.userData?.canvas; if (!cv || cv.width < 256) return;
    for (let p = o.parent; p; p = p.parent) if (p === c.head) { cv.userData0 ||= { w: cv.width, h: cv.height }; const { w: w0, h: h0 } = cv.userData0; cvs[n] = { cv, w0, h0, k: FP.handles(n) && psize > w0 ? psize / w0 : 1, additive: m.blending === THREE.AdditiveBlending, mesh: o.geometry.type }; break; } }); }
  const sizeCv = (big) => { for (const [n, e] of Object.entries(cvs)) { const k = big ? e.k : 1, W = Math.round(e.w0 * k), Hh = Math.round(e.h0 * k); if (e.cv.width !== W || e.cv.height !== Hh) { e.cv.width = W; e.cv.height = Hh; } e.cv.getContext('2d').setTransform(k, 0, 0, k, 0, 0); FP.ss[n] = k; } };
  if (reset) { FP.on = false; window.seekState(0.01); }
  FP.on = true; sizeCv(true);
  for (const f of frames) { const t = (f + 0.5) / FPS; FP.last = {}; window.seekState(t); const row = { f }, mrow = { f };
    for (const [n, e] of Object.entries(cvs)) { let src = e.cv; if (src.width > psize) { const k = psize / src.width; small.width = psize; small.height = Math.round(src.height * k); const g = small.getContext('2d'); g.clearRect(0, 0, small.width, small.height); g.drawImage(src, 0, 0, small.width, small.height); src = small; }
      row[n] = src.toDataURL('image/png').slice(22); if (FP.last[n]) mrow[n] = FP.last[n]; }
    png.push(row); meta.push(mrow); }
  FP.on = false; sizeCv(false);
  return { png, meta, info: Object.fromEntries(Object.entries(cvs).map(([n, v]) => { const W = Math.round(Math.min(psize, v.w0 * v.k)); return [n, { size: [W, Math.round(v.h0 * W / v.w0)], native: [v.w0, v.h0], plus: FP.handles(n), blend: v.additive ? 'additive' : 'alpha', mesh_geometry: v.mesh }]; })) };
}
(async () => {
  const S = await start(), p = await S.open(epf);
  try {
    const FPS = Number(flag('fps', 30)), info = await p.evaluate(() => { const ep = window.ep, st = window.stage, cast = window.cast; const THREE_V = st.camera.position.constructor;
      const seats = { ...window.set.seats, ...(ep.seats || {}) }, plain = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
      window.seekState(0.01);
      const R = (x) => Math.round(x * 1e4) / 1e4, size = {}; for (const [n, c] of Object.entries(cast)) { const h = c.headWorld(new THREE_V()); size[n] = { head_center_y: R(h.y), head_radius: R(c.R), head_top_y: R(h.y + c.R), root_y: R(c.root.getWorldPosition(new THREE_V()).y) }; }
      let lgroups = null; if (window.set.lgOf) { lgroups = { S: [], R: [], B: [], street: [], veh: [] }; let mi = 0; window.set.group.traverse((o) => { if (!o.isMesh) return; const k = window.set.lgOf(o); (lgroups[k] ||= []).push('c3dset_' + (mi++)); }); }
      return { lgroups, id: ep.id || null, dur: ep.dur, fps: ep.fps || 30, pack: ep.pack, set: ep.set || null, cast: ep.cast || Object.keys(cast), castOpts: plain(ep.castOpts || {}), setOpts: plain(ep.setOpts || {}), light: ep.light || window.set.light || null, seats: plain(seats), size,
        look: plain({ set: window.set.look || null, episode: ep.look || null }), partners: plain(ep.partners || {}),
        shots: ep.shots.map((s, i) => plain({ i, t0: s.t0, t1: s.t1, cam: s.cam, move: s.move, free: s.free, amt: s.amt, punchAt: s.punchAt, whip: s.whip, whipIn: s.whipIn, whipOut: s.whipOut, rack: s.rack, dutch: s.dutch })),
        lines: (ep.lines || []).map((l) => plain({ id: l.id, who: l.who, t0: l.t0, t1: l.t1, text: l.text, emo: l.emo, pose: l.pose, think: l.think, noCap: l.noCap })),
        overlays: (ep.overlays || []).map((o) => { const r = { kind: o.kind, t0: o.t0, t1: o.t1 }; for (const k of ['text', 'from', 'who', 'name', 'sub', 'y', 'fade']) if (o[k] !== undefined && typeof o[k] !== 'function') r[k] = o[k]; return plain(r); }),
        slomo: plain(ep.slomo || []), hits: plain(ep.hits || []), mblur: ep.mblur || null }; });
    const id = info.id || path.basename(epf, '.js'), dur = info.dur, F0 = Math.round(Number(flag('from', 0)) * FPS), F1 = Math.round(Number(flag('to', dur)) * FPS), frames = [];
    for (let f = F0; f < F1; f++) frames.push(f);
    const CH = 60, recs = [], facesDir = flag('faces', null), fsize = Number(flag('face-size', 512)), plusDir = flag('faces-plus', null); let lightsHdr = null, t0 = Date.now(), faceInfo = null, plusInfo = null, cues = null;
    const propsDir = flag('props', null); let propMeta = null; const propRows = [], propCup = [];
    const plusMeta = []; if (facesDir) fs.mkdirSync(facesDir, { recursive: true });
    if (plusDir) { fs.mkdirSync(plusDir, { recursive: true }); cues = await rhubarbCues(info, id, F0 / FPS, F1 / FPS, plusDir);
      await p.evaluate(async ({ cues }) => { const { makeFacePlus } = await import('/packs/trada/faceplus.js'); const fp = makeFacePlus(window.ep, window.cast, cues); window.__fp = fp;
        for (const [n, c] of Object.entries(window.cast)) { if (!fp.handles(n)) continue; const o = c.apply; c.apply = (q, t) => o.call(c, fp.apply(n, c, q, t), t); } }, { cues }); }
    for (let i = 0; i < frames.length; i += CH) { const r = await p.evaluate(collect, { frames: frames.slice(i, i + CH), FPS, first: i === 0, faces: !!facesDir, fsize, setDyn: args.includes('--set-dyn'), propsOn: !!flag('props', null) }); recs.push(...r.rec); if (r.propMeta) { propMeta ||= r.propMeta; propRows.push(...r.propRows); propCup.push(...r.propCup); } lightsHdr ||= r.header.lights;
      if (facesDir) { faceInfo = r.faceInfo; for (const row of r.facePng) for (const [n, b64] of Object.entries(row)) { if (n === 'f') continue; fs.mkdirSync(path.join(facesDir, n), { recursive: true }); fs.writeFileSync(path.join(facesDir, n, `f_${String(row.f).padStart(5, '0')}.png`), Buffer.from(b64, 'base64')); } }
      process.stdout.write(`\r${recs.length}/${frames.length}`); }
    if (plusDir) for (let i = 0; i < frames.length; i += CH) { const r = await p.evaluate(collectPlus, { frames: frames.slice(i, i + CH), FPS, psize: fsize, reset: i === 0 });
      { plusInfo = r.info; plusMeta.push(...r.meta); for (const row of r.png) for (const [n, b64] of Object.entries(row)) { if (n === 'f') continue; fs.mkdirSync(path.join(plusDir, n), { recursive: true }); fs.writeFileSync(path.join(plusDir, n, `f_${String(row.f).padStart(5, '0')}.png`), Buffer.from(b64, 'base64')); } }
      process.stdout.write(`\rplus ${plusMeta.length}/${frames.length}`); }
    const audio = `out/${id}/audio/mix.wav`;
    const header = { format: 'cine3d-dump/1', id, pack: info.pack, set: info.set, light_rig: info.light, fps: FPS, ep_fps: info.fps, dur, from: F0 / FPS, to: F1 / FPS, frame_from: F0, frame_count: frames.length, time_of_frame: 't = (f + 0.5) / fps',
      cast: info.cast, cast_opts: info.castOpts, partners: info.partners, audio_mix: fs.existsSync(path.join(__dirname, '..', audio)) ? audio : audio + ' (not found)',
      units: { unit: '1 three.js unit = 1 metre (real-scale set: the lens is in real millimetres, the camera is about 2-4 m from the table)', character_size: info.size, note: 'head_center_y = head sphere centre above the floor (seated at the table unless a gait / stand fx is on); head_top_y = centre + radius. The characters are chibi: a head of radius 0.17-0.19 m on a small body, so a seated Teo has the head centre at about 0.96 m and the top of his head at 1.13 m above the floor (see character_size, measured at t = 0.01 s).' },
      coordinates: { system: 'three.js: Y up, right-handed, camera looks down its own -Z with +Y up', yaw: 'rotation about +Y in radians; yaw 0 = the character faces +Z (towards the default camera, which looks towards -Z); positive yaw turns him towards +X', quaternions: '[x, y, z, w], world space', blender: 'to convert: (x, y, z)_three -> (x, -z, y)_blender, i.e. a +90 degree turn about X; quaternions q_blender = Rx(+90 deg) * q_three. A three.js camera and a Blender camera both look down their own -Z with +Y up, so the camera needs no further correction' },
      camera_note: { fov: 'vertical field of view in degrees, frame 1080 x 1920 (aspect 0.5625)', f_mm: 'equivalent focal length on a 36 mm tall (full-frame, held upright) sensor: 18 / tan(fov / 2); sensor width = 20.25 mm', focus: 'focus distance in metres', aperture: 'engine blur strength: circle of confusion in px (of 1920) = aperture * |1/focus - 1/z|, z in metres, capped at 22 px', fstop: 'matching real f-number for the 36 mm sensor: f_mm^2 / (18.75 * aperture); null = no depth of field', focus_point: 'the point on the optical axis at the focus distance' },
      frame_fields: { f: 'absolute frame number', t: 'seconds', shot: 'index into shots', cam_token: 'camera token of that shot', base: 'resolved base token (free = a free camera)', camera: '{p, q, fov, f_mm, focus, aperture, fstop, focus_point}',
        chars: '{ name: { root, yaw, body_q, head, head_q, head_rel [x,y,z rad, order YXZ, relative to the body], emo [from, to, k 0..1], pose [from, to, k (can overshoot above 1 for a moment)], mouth 0..1, blink 0..1 (1 = closed; null when the seed is unknown), look [target name, x, y, z], hands {l, r} } }',
        hands: 'the hand TARGETS of the current pose, converted to world space (body-frame pose numbers: gaits, carry, run and other fx move the real hand away from them)', lights: 'one row per light of header.lights: spot / point [intensity, colour hex, x, y, z, (spot: target x, y, z)], hemisphere [intensity, sky hex, ground hex]; intensity 0 when the light is hidden', look: '{exposure, bloom, contrast, sat, vig, fog [hex, density]} (the grade after drive / fx)', swap: '0..1 how far a "setswap" 2-D board has replaced the set behind the cast (see ENGINE.md); absent when the episode has none' },
      lights: lightsHdr, ...(info.lgroups ? { light_groups: info.lgroups, light_groups_note: 'steadyLights: per frame lg = [S, R, B, street, dark] (0..1); S string lights / signs / bunting, R shop lights, B the hanging bulb, street lamps and far glows; objects c3dset_<i> as in set_dyn' } : {}), look_defaults: info.look, seats: info.seats, set_opts: info.setOpts, shots: info.shots, lines: info.lines, overlays: info.overlays, slomo: info.slomo, hits: info.hits, mblur: info.mblur,
      caveats: ['hit-stop frames (ep.hits) repeat the state of the hit; slow motion warps the picture time exactly as the render does', 'with motion blur (ep.mblur or whip) the state is that of the last sub-frame, at most half a frame after t'] };
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, '{"header":' + JSON.stringify(header) + ',\n"frames":[\n' + recs.map((r) => JSON.stringify(r)).join(',\n') + '\n]}\n');
    if (facesDir) { const who = {}; for (const [n, fi] of Object.entries(faceInfo || {})) who[n] = { ...fi, dir: n, mouth: recs.map((r) => r.chars[n].mouth), blink: recs.map((r) => r.chars[n].blink), emo: recs.map((r) => r.chars[n].emo) };
      fs.writeFileSync(path.join(facesDir, 'faces_meta.json'), JSON.stringify({ format: 'cine3d-faces/1', ep: epf, id, fps: FPS, first_frame: F0, frame_count: frames.length, file_pattern: '<who>/f_%05d.png (absolute frame numbers, same as dump.json frames[].f; t = (f + 0.5) / fps)',
        note: 'RGBA PNG of the face canvas the character painted for that frame (the exact emotion blend, mouth openness = chars.<who>.mouth, blink = chars.<who>.blink). Teo / people: alpha over the head patch; Bip: additive glow on the dark visor (blend: additive). Frames where the canvas did not change are identical files.', who }));
      console.log(`\nfaces -> ${facesDir}`); }
    if (plusDir) { const who = {}; for (const [n, fi] of Object.entries(plusInfo || {})) { const m = plusMeta.map((r) => r[n] || null), g = (k) => m.map((x) => (x ? (typeof x[k] === 'number' ? Math.round(x[k] * 1e4) / 1e4 : x[k]) : null));
        who[n] = { ...fi, dir: n, mouth: fi.plus ? g('mo') : recs.map((r) => r.chars[n].mouth), mouth_old: recs.map((r) => r.chars[n].mouth), blink: fi.plus ? g('blink') : recs.map((r) => r.chars[n].blink), emo: recs.map((r) => r.chars[n].emo),
          ...(fi.plus ? { cue: g('cue'), open: g('open'), open_old: g('oldOpen'), eye: g('eye'), px: g('px'), py: g('py'), brows_or_bars: g('bro'), stress: g('pop'), question: g('qr'), blush: g('blush'), mouth_width: g('mw'), round: g('round'), mouth_height: g('mh'), dash: g('dash'), scan: g('scan'), smirk: g('smirk'), channels_brow_eye_mouth: g('kc') } : {}) }; }
      fs.writeFileSync(path.join(plusDir, 'faces_meta.json'), JSON.stringify({ format: 'cine3d-faces-plus/1', ep: epf, id, fps: FPS, first_frame: F0, frame_count: frames.length, file_pattern: '<who>/f_%05d.png (absolute frame numbers, same as dump.json frames[].f; t = (f + 0.5) / fps)',
        note: 'Same files and orientation as --faces, with the acting layer of packs/trada/faceplus.js (plus: true). mouth = the drawn speech openness (open when > 0.08 Teo / 0.1 Bip), mouth_old = the film envelope, cue = Rhubarb shape. Characters with plus: false are the plain faces.', rhubarb: cues?._info || null, who }));
      console.log(`\nfaces plus -> ${plusDir}`); }
    if (propsDir && propMeta) {   // --props: the cloth & co. of ep.props(): rigid meshes = world matrix deltas, deforming ones = world-space vertices per frame (float32, three.js axes)
      fs.mkdirSync(propsDir, { recursive: true }); const outM = [];
      propMeta.forEach((m, i) => { if (m.material?.mapPng) { fs.writeFileSync(path.join(propsDir, `tex_${i}.png`), Buffer.from(m.material.mapPng, 'base64')); m.material = { ...m.material, mapFile: `tex_${i}.png` }; delete m.material.mapPng; }
        const rec = propRows.map((r, k) => [F0 + k, r[i] || null]), nv = rec.filter(([, e]) => e && e.v).length, vis = [], mw = [];
        for (const [f, e] of rec) { if (e?.vis !== undefined) vis.push([f, e.vis]); if (e?.mw) mw.push([f, e.mw]); }
        const o = { ...m, deform: nv > 1, vis, mw }; delete o.index0;
        if (nv > 1) {   // world-space vertices of every frame
          const buf = Buffer.alloc(frames.length * m.vcount * 12); let cur = null, mcur = null, ptr = 0, mi = 0;
          rec.forEach(([f, e], k) => { if (e?.v) cur = e.v; if (e?.mw) mcur = e.mw; const M = mcur;
            for (let q = 0; q < m.vcount; q++) { const x = cur[q * 3], y = cur[q * 3 + 1], z = cur[q * 3 + 2];
              buf.writeFloatLE(M[0] * x + M[4] * y + M[8] * z + M[12], ptr); buf.writeFloatLE(M[1] * x + M[5] * y + M[9] * z + M[13], ptr + 4); buf.writeFloatLE(M[2] * x + M[6] * y + M[10] * z + M[14], ptr + 8); ptr += 12; } });
          o.file = `props_${i}.f32`; fs.writeFileSync(path.join(propsDir, o.file), buf); o.frames = frames.length; } else { o.pos = rec.find(([, e]) => e?.v)[1].v; }
        outM.push(o); });
      fs.writeFileSync(path.join(propsDir, 'props.json'), JSON.stringify({ format: 'cine3d-props/1', ep: epf, fps: FPS, first_frame: F0, frame_count: frames.length, axes: 'three.js (Y up); f32 = frames x vcount x xyz in WORLD space', meshes: outM,
        chars: Object.fromEntries(Object.keys(propCup[0] || {}).filter((n) => propCup.some((r) => r[n])).map((n) => [n, { cup: propCup.map((r) => r[n]) }])) }));
      console.log(`\nprops -> ${propsDir}  (${outM.length} meshes, ${outM.filter((m) => m.deform).length} deforming)`); }
    console.log(`\n-> ${out}  ${recs.length} frames, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } finally { await S.close(); }
})();
