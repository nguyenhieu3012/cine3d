// HYBRID render, cine3d half (20/11): the CAST (characters + what they hold) rendered by the engine itself on a TRANSPARENT background, with the whole set
// kept as an invisible OCCLUDER (opaque set meshes write depth but no colour), so the counter hides legs, the door frame and the shelves cover what they should.
// The set's own picture comes from Blender (blender/render_ep.py --nocast). Same camera, same frames as the dump (t = (f + 0.5) / fps, hit-stop included).
//   node blender/castpass.cjs <ep.js> <outDir> [--fps 30] [--from s] [--to s] [--at t1,t2,...] [--workers 2] [--glass hide|keep]
// -> <outDir>/f_%05d.png (RGBA, straight alpha; absolute frame numbers).  Transparent / additive set parts (glass, neon glows, shards) are hidden here; Blender draws them.
// Nothing in core/ or packs/ is changed.
const fs = require('fs'), path = require('path'), { start, flagOf } = require('../tools/_page.cjs');
const args = process.argv.slice(2), epf = args[0], out = args[1], flag = flagOf(args);
if (!epf || !out) { console.log('usage: node blender/castpass.cjs <ep.js> <outDir> [--fps 30] [--from s] [--to s] [--at t,t] [--workers 2]'); process.exit(1); }

async function grab({ frames, FPS, SHADOWS, SHADOW_OPACITY, DOF }) {
  const THREE = await import('three'), stage = window.stage, set = window.set, cast = window.cast, res = [];
  const cv2 = window.__cpCv || (window.__cpCv = Object.assign(document.createElement('canvas'), { width: 1080, height: 1920 })), g = cv2.getContext('2d');
  // the grade shader multiplies colour by the (unclamped) alpha when the background is transparent: bloom pushes alpha above 1 and the cast burned out. Clamp it here, in this page only.
  { const gm = stage.grade.material; if (!gm.fragmentShader.includes('min(1.0, texture2D(tDiffuse, vUv).a)')) { gm.fragmentShader = gm.fragmentShader.replace('float a0 = texture2D(tDiffuse, vUv).a;', 'float a0 = min(1.0, texture2D(tDiffuse, vUv).a);'); gm.needsUpdate = true; } }
  const castRoots = new Set(Object.values(cast).map((c) => c.root));
  // everything in the scene that is not the cast, a light or the camera: the occluders
  const occ = []; const walk = (root) => root.traverse((o) => { if (castRoots.has(o) || o.userData.cpTwin) return; if (o.isMesh || o.isLine || o.isPoints || o.isSprite) occ.push(o); });
  const inCast = (o) => { for (let p = o; p; p = p.parent) if (castRoots.has(p)) return true; return false; };
  for (const ch of stage.scene.children) { if (ch.isLight || ch.isCamera || castRoots.has(ch)) continue; walk(ch); }
  const occluders = occ.filter((o) => !inCast(o));
  // contact / cast shadows on the set (engine lights, engine shadow maps): every opaque set mesh gets an invisible-in-colour ShadowMaterial twin (draws only the shadow, as alpha);
  // pass B renders those twins with the set's own shadow casters switched off (so only the CAST shadows the set, never the set itself: Blender has its own) and the cast hidden in colour
  const ST = (window.__cpShadow ||= (() => { const SM = new THREE.ShadowMaterial({ opacity: SHADOW_OPACITY, transparent: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), twins = new Map();
    for (const o of occluders) { if (!o.isMesh) continue; const t = new THREE.Mesh(o.geometry, SM); t.receiveShadow = true; t.castShadow = false; t.renderOrder = 7; t.visible = false; t.frustumCulled = false; t.userData.cpTwin = true; o.add(t); twins.set(o, t); } return { SM, twins }; })());
  const castMeshes = []; for (const c of Object.values(cast)) c.root.traverse((o) => { if (o.isMesh) castMeshes.push(o); });
  for (const f of frames) {
    const t = (f + 0.5) / FPS, cam = window.seekState(t); stage.scene.updateMatrixWorld(true);
    const saved = [], kind = new Map(), shardObjs = [];
    for (const o of occluders) {
      const ms = Array.isArray(o.material) ? o.material : [o.material], vis = o.visible; let hide = !o.isMesh;
      const shard = ms.every((m) => m && m.color && m.color.getHexString() === 'd8f4ff' && m.transparent && Math.abs(m.opacity - 0.55) < 0.02);   // the door glass shards (gta_shop.js): drawn by the ENGINE in this layer, like its own picture (Blender's version made the burst jump); the set_build.py deletes them from the Blender set
      for (const m of ms) { if (!m) continue; if (!shard && (m.transparent || m.opacity < 1 || m.blending === THREE.AdditiveBlending || m.isPointsMaterial || m.isSpriteMaterial)) hide = true; }
      if (shard) { shardObjs.push(o); kind.set(o, false); continue; }
      kind.set(o, !hide);
      if (hide) { saved.push([o, vis, null]); o.visible = false; } else { saved.push([o, vis, ms.map((m) => m.colorWrite)]); for (const m of ms) m.colorWrite = false; }
    }
    const bg0 = stage.scene.background; stage.scene.background = null; stage.renderer.setClearColor(0x000000, 0); stage.grade.uniforms.premul.value = 1;   // (stage.setBackdrop returns early when the set already clears the background)
    const bs = stage.bloom.strength; stage.bloom.strength = 0;   // the bloom pass pushes alpha to 1 over the whole frame: no bloom on the cast layer (Blender has its own on the set)
    g.clearRect(0, 0, 1080, 1920);
    if (SHADOWS) {   // pass B (the shards are not drawn here: they come with the colour pass): the shadows the cast throws on the set
      const shv = shardObjs.map((o) => o.visible); for (const o of shardObjs) o.visible = false;
      const cs = occluders.filter((o) => o.isMesh).map((o) => [o, o.castShadow]); for (const [o] of cs) o.castShadow = false;
      const cm = castMeshes.map((o) => { const ms = Array.isArray(o.material) ? o.material : [o.material]; return [ms, ms.map((m) => m.colorWrite)]; }); for (const [ms] of cm) for (const m of ms) m.colorWrite = false;
      for (const [o, tw] of ST.twins) tw.visible = !!kind.get(o);
      stage.render(t, { focus: cam.focus, aperture: 0 });
      g.drawImage(stage.canvas, 0, 0, 1080, 1920);
      for (const [o, tw] of ST.twins) tw.visible = false;
      shardObjs.forEach((o, i) => { o.visible = shv[i]; });
      for (const [ms, w] of cm) ms.forEach((m, i) => { m.colorWrite = w[i]; }); for (const [o, c] of cs) o.castShadow = c;
    }
    stage.render(t, { focus: cam.focus, aperture: DOF ? cam.aperture : 0 }); stage.bloom.strength = bs;
    g.drawImage(stage.canvas, 0, 0, 1080, 1920);
    const png = cv2.toDataURL('image/png').slice(22);
    stage.scene.background = bg0; stage.renderer.setClearColor(0x000000, 1); stage.grade.uniforms.premul.value = 0;
    for (const [o, vis, cw] of saved) { o.visible = vis; if (cw) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m, i) => { if (m) m.colorWrite = cw[i]; }); }
    res.push({ f, png, cam: [...stage.camera.position.toArray(), ...stage.camera.quaternion.toArray(), stage.camera.fov] });
  }
  return res;
}

(async () => {
  const W = Number(flag('workers', 2)), S = await start(), pages = []; for (let i = 0; i < W; i++) pages.push(await S.open(epf));
  try {
    const FPS = Number(flag('fps', 30)), dur = await pages[0].evaluate(() => window.ep.dur);
    for (const p of pages) await p.evaluate(() => window.seekState(0.01));
    let frames = [];
    if (flag('at', null)) frames = String(flag('at')).split(',').map((t) => Math.floor(Number(t) * FPS));
    else { const f0 = Math.round(Number(flag('from', 0)) * FPS), f1 = Math.round(Number(flag('to', dur)) * FPS); for (let f = f0; f < f1; f++) frames.push(f); }
    fs.mkdirSync(out, { recursive: true });
    const BATCH = 8, t0 = Date.now(); let next = 0;
    // each page walks its OWN contiguous run (the player keeps a little state between frames: gaze smoothing), batches interleaved would break it
    const per = Math.ceil(frames.length / W), runs = pages.map((p, i) => frames.slice(i * per, (i + 1) * per));
    let done = 0; const CAMS = {};
    await Promise.all(runs.map(async (run, i) => { const p = pages[i]; if (run.length) await p.evaluate((t) => window.seekState(t), Math.max(0.01, (run[0] - 30) / FPS));   // warm-up a second before the run
      for (let k = 0; k < run.length; k += BATCH) { const r = await p.evaluate(grab, { frames: run.slice(k, k + BATCH), FPS, SHADOWS: !args.includes('--no-shadows'), SHADOW_OPACITY: Number(flag('shadow', 0.5)), DOF: args.includes('--dof') });
        for (const x of r) { CAMS[x.f] = x.cam; } for (const x of r) fs.writeFileSync(path.join(out, `f_${String(x.f).padStart(5, '0')}.png`), Buffer.from(x.png, 'base64')); done += r.length; process.stdout.write(`\r${done}/${frames.length}  ${(done / ((Date.now() - t0) / 1000)).toFixed(1)} fps`); } }));
    fs.writeFileSync(path.join(out, 'cams.json'), JSON.stringify(CAMS)); console.log(`\n-> ${out}  ${frames.length} frames (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } finally { await S.close(); }
})();
