// Character REPLAY for Blender (20/11): the exact cine3d character meshes, every mesh followed frame by frame straight from the engine, so standing /
// walking / leaning poses, the hood, props built inside a character (Bíp's glass, Tèo's pen...), the tubes of every limb and the hips all come out
// exactly as the engine poses them. No rig, no IK: Blender only plays what the engine computed.
//   node blender/replay.cjs <ep.js> <outdir> [--fps 30] [--from s] [--to s] [--chars teo,bip,lan]
// Same sweep as tools/dump.cjs (seekState(0.01), then t = (f + 0.5) / fps for each frame), so frame f here is frame f of the dump.
// Writes <outdir>/replay.json (per character: meshes with geometry, material, name, outline flag; frame numbers) and binaries:
//   <who>.mat.f32   frames x meshes x 16  world matrix (three.js, column-major, as Matrix4.elements)
//   <who>.vis.u8    frames x meshes       effective visibility (all ancestors visible, material not fully transparent)
//   <who>.mt.f32    frames x meshes x 2   material opacity, emissive intensity
//   <who>_<k>.pos.f32  frames x vertices x 3  LOCAL positions of mesh k, only for meshes whose geometry changes (limb tubes, blobs)
// Nothing in core/ or packs/ is touched.
const fs = require('fs'), path = require('path'), { start, flagOf } = require('../tools/_page.cjs');
const args = process.argv.slice(2), epf = args[0], out = args[1], flag = flagOf(args);
if (!epf || !out) { console.log('usage: node blender/replay.cjs <ep.js> <outdir> [--fps 30] [--from s] [--to s] [--chars teo,bip]'); process.exit(1); }

// ---- runs inside the page: build the table of meshes of every cast member (frame-0 state) ----
async function setupPage({ only, probe }) {
  for (const t of probe) window.seekState(t);   // tubes that are not used at the start have an empty geometry until they are first posed: visit the film once, then go back to the start
  window.seekState(0.01);
  const THREE = await import('three'), { PACKS } = await import('/packs/index.js');
  const ep = window.ep, cast = window.cast, R5 = (x) => Math.round(x * 1e5) / 1e5;
  const b64 = (ta) => { const u8 = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const ink = ep.outline ?? PACKS[ep.pack].outline;
  const png = (tex) => { const cv = tex?.userData?.canvas || (tex?.image instanceof HTMLCanvasElement ? tex.image : null); return cv ? cv.toDataURL('image/png').slice(22) : null; };
  const W = (window.__rp = { chars: {}, ink: ink === true ? {} : ink });
  stageUpdate();
  function stageUpdate() { window.stage.scene.updateMatrixWorld(true); }
  const types = {};
  for (const [name, c] of Object.entries(cast)) {
    if (only && !only.includes(name)) continue;
    const meshes = [], list = [];
    c.root.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) types[o.type] = (types[o.type] || 0) + 1; if (o.isMesh && !o.userData.isOutline) { if (o.geometry.attributes.position) list.push(o); else types.emptyGeometry = (types.emptyGeometry || 0) + 1; } });
    const outlined = new Set(); c.root.traverse((o) => { if (o.isMesh && o.userData.isOutline && o.parent) outlined.add(o.parent); });
    c.root.updateWorldMatrix(true, true);
    const rootInv = new THREE.Matrix4().copy(c.root.matrixWorld).invert();
    const underHead = (o) => { for (let p = o.parent; p; p = p.parent) if (p === c.head) return true; return false; };
    const bb = (o) => new THREE.Box3().setFromObject(o, true).applyMatrix4(rootInv);
    let faceMesh = null, skinMat = null, torso = null;
    for (const o of list) { const m = Array.isArray(o.material) ? o.material[0] : o.material; const cv = m?.map?.userData?.canvas;
      if (!faceMesh && cv && cv.width >= 256 && underHead(o)) faceMesh = o;
      if (!skinMat && underHead(o) && o.geometry.type === 'SphereGeometry' && Math.abs((o.geometry.parameters.radius || 0) - c.R) < 1e-6 && o.geometry.parameters.phiLength > 6) skinMat = m;
      if (!o.userData.noodle && o.geometry.type === 'LatheGeometry' && !underHead(o)) { const b = bb(o), s = b.getSize(new THREE.Vector3()), vol = s.x * s.y * s.z; if (!torso || vol > torso.vol) torso = { o, vol, b }; } }
    const used = {}, uniq = (n) => { used[n] = (used[n] || 0) + 1; return used[n] === 1 ? n : `${n}_${String(used[n]).padStart(2, '0')}`; };
    list.forEach((o, idx) => {
      const m = Array.isArray(o.material) ? o.material[0] : o.material, gt = o.geometry.type, gp = o.geometry.parameters || {}, b = bb(o), ctr = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
      const side = ctr.x >= 0 ? 'L' : 'R'; let nm = null;
      if (o === faceMesh) nm = 'face';
      else if (o.userData.noodle) nm = 'tube';
      else if (underHead(o)) {
        if (gt === 'SphereGeometry' && skinMat && m === skinMat && Math.abs(gp.radius - c.R) < 1e-6 && gp.phiLength > 6) nm = 'head';
        else if (gt === 'BoxGeometry' && m.color && m.color.getHex() === 0x070b1c) nm = 'visor';
        else if (gt === 'BoxGeometry') nm = sz.x > 0.3 ? 'head' : 'head_part';
        else if (gt === 'CircleGeometry') nm = 'glasses_lens_' + side;
        else if (m.clearcoat === 1 && gt === 'TorusGeometry') nm = (gp.arc < 4 ? 'glasses_bridge' : 'glasses_rim_' + side);
        else if (m.clearcoat === 1 && gt === 'CylinderGeometry') nm = 'glasses_temple_' + side;
        else if (gt === 'CylinderGeometry' && m.color && o.parent !== c.head && sz.y > 0.08) nm = 'antenna';
        else if (m.emissive && m.emissiveIntensity > 1 && gt === 'SphereGeometry') nm = 'antenna_bulb';
        else if (m.sheen > 0 && m !== skinMat && !m.clearcoat) nm = 'hair';
        else if (skinMat && m === skinMat) nm = Math.abs(ctr.x) > 0.7 * c.R ? 'ear_' + side : 'nose';
        else nm = 'head_part';
      } else if (o === torso?.o) nm = 'torso';
      else if (gt === 'SphereGeometry' && gp.radius > 0.035 && gp.radius < 0.055 && m.color && m.color.getHex() === (cast[name].handHex ?? m.color.getHex()) && ctr.y > 0.2 && false) nm = 'hand_' + side;
      else if (gt === 'BoxGeometry' && m.color && m.color.getHex() === 0xf6f4ee && sz.x > 0.12) nm = 'plate';
      else if (gt === 'PlaneGeometry' && m.emissiveMap) nm = 'spark';
      else if (gt === 'PlaneGeometry' && m.map) nm = 'spark_glow';
      else if (gt === 'CylinderGeometry' && Math.abs(ctr.x) < 0.02 && sz.x < 0.14 && sz.y > 0.03 && sz.y < 0.2 && torso && ctr.y > torso.b.max.y - 0.1) nm = 'neck';
      else if (gt === 'TorusGeometry' && sz.x < 0.15 && torso && ctr.y < torso.b.max.y - 0.1 && Math.abs(ctr.x) > 0.06) nm = 'cuff_' + side;
      else if (gt === 'TorusGeometry' && torso) nm = (ctr.y < torso.b.min.y + 0.07 ? 'hips' : 'spine') + '_torus';
      else if (gt === 'BoxGeometry' && torso) nm = (ctr.y < torso.b.min.y + 0.07 ? 'hips' : 'spine') + '_box';
      else nm = gt.replace('Geometry', '').toLowerCase() + '_' + idx;
      const g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
      const ix = g.index ? new Uint32Array(g.index.array) : Uint32Array.from({ length: pos.count }, (_, k) => k);
      const mat = { type: m.type, color: m.color ? '#' + m.color.getHexString() : null, emissive: m.emissive ? '#' + m.emissive.getHexString() : null, emissiveIntensity: m.emissiveIntensity ?? 0, roughness: m.roughness ?? null, metalness: m.metalness ?? null,
        opacity: m.opacity, transparent: !!m.transparent, side: m.side, additive: m.blending === THREE.AdditiveBlending, basic: !!m.isMeshBasicMaterial, sheen: m.sheen ?? 0, sheenColor: m.sheenColor ? '#' + m.sheenColor.getHexString() : null, clearcoat: m.clearcoat ?? 0, depthWrite: m.depthWrite, alphaTest: m.alphaTest || 0,
        mapPng: o === faceMesh ? null : png(m.map), emissivePng: png(m.emissiveMap) };
      meshes.push({ idx, name: uniq(nm), geom: gt, noodle: !!o.userData.noodle, outline: outlined.has(o), face: o === faceMesh, cast: !!o.castShadow, vcount: pos.count, material: mat,
        pos: b64(Float32Array.from(pos.array)), nor: nor ? b64(Float32Array.from(nor.array)) : null, uv: uv ? b64(Float32Array.from(uv.array)) : null, index: b64(ix) });
    });
    W.chars[name] = { objs: list, prevPos: list.map((o) => Float32Array.from(o.geometry.attributes.position.array)), changed: list.map((o) => !!o.userData.noodle), faceSize: faceMesh ? [faceMesh.material.map.userData.canvas.width, faceMesh.material.map.userData.canvas.height] : null };
    W.chars[name].meta = { name, R: R5(c.R), meshes };
  }
  return { ink: W.ink, types, chars: Object.fromEntries(Object.entries(W.chars).map(([n, v]) => [n, v.meta])) };
}

// ---- runs inside the page: one chunk of frames -> binary rows ----
async function sampleChunk({ frames, FPS, mode }) {
  const THREE = await import('three'), W = window.__rp, b64 = (ta) => { const u8 = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const res = {};
  for (const n of Object.keys(W.chars)) { const k = W.chars[n].objs.length; res[n] = { mat: new Float32Array(frames.length * k * 16), vis: new Uint8Array(frames.length * k), mt: new Float32Array(frames.length * k * 2), pos: {} }; }
  for (let fi = 0; fi < frames.length; fi++) {
    const t = (frames[fi] + 0.5) / FPS; window.seekState(t); window.stage.scene.updateMatrixWorld(true);
    for (const [n, C] of Object.entries(W.chars)) {
      const R = res[n], K = C.objs.length;
      C.objs.forEach((o, i) => {
        let vis = 1; for (let p = o; p; p = p.parent) if (p.visible === false) { vis = 0; break; }
        const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m.transparent && m.opacity <= 0.001) vis = 0;
        R.vis[fi * K + i] = vis; R.mat.set(o.matrixWorld.elements, (fi * K + i) * 16); R.mt[(fi * K + i) * 2] = m.opacity; R.mt[(fi * K + i) * 2 + 1] = m.emissiveIntensity ?? 0;
        const pa = o.geometry.attributes.position.array, pv = C.prevPos[i];
        if (pa.length !== pv.length) { C.changed[i] = true; C.prevPos[i] = Float32Array.from(pa); } else if (!C.changed[i]) { for (let q = 0; q < pa.length; q++) if (Math.abs(pa[q] - pv[q]) > 5e-6) { C.changed[i] = true; break; } }
        if (mode === 'pos' ? C.changed[i] : C.objs[i].userData.noodle) (R.pos[i] ||= new Float32Array(frames.length * pa.length)).set(pa, fi * pa.length);
      });
    }
  }
  const o = {}; for (const [n, R] of Object.entries(res)) o[n] = { mat: b64(R.mat), vis: b64(R.vis), mt: b64(R.mt), pos: Object.fromEntries(Object.entries(R.pos).map(([k, v]) => [k, b64(v)])), changed: window.__rp.chars[n].changed.map((x, i) => (x ? i : -1)).filter((i) => i >= 0) };
  return o;
}

(async () => {
  const S = await start(), p = await S.open(epf);
  try {
    const FPS = Number(flag('fps', 30)), only = flag('chars', null) ? flag('chars').split(',') : null;
    const info = await p.evaluate(() => { window.seekState(0.01); return { id: window.ep.id, dur: window.ep.dur, pack: window.ep.pack }; });
    const F0 = Math.round(Number(flag('from', 0)) * FPS), F1 = Math.round(Number(flag('to', info.dur)) * FPS), frames = []; for (let f = F0; f < F1; f++) frames.push(f);
    fs.mkdirSync(out, { recursive: true });
    const probe = Array.from({ length: 24 }, (_, i) => (i + 0.5) * (F1 - F0) / FPS / 24 + F0 / FPS), setup = await p.evaluate(setupPage, { only, probe });
    console.log('mesh types', JSON.stringify(setup.types), ' meshes', Object.fromEntries(Object.entries(setup.chars).map(([n, c]) => [n, c.meshes.length])));
    const t0 = Date.now(), CH = 60, names = Object.keys(setup.chars);
    const fd = {}, pd = {};   // open binary files
    for (const n of names) { fd[n] = { mat: fs.openSync(path.join(out, n + '.mat.f32'), 'w'), vis: fs.openSync(path.join(out, n + '.vis.u8'), 'w'), mt: fs.openSync(path.join(out, n + '.mt.f32'), 'w') }; }
    const changed = {}; const posParts = {};
    for (let i = 0; i < frames.length; i += CH) {
      const r = await p.evaluate(sampleChunk, { frames: frames.slice(i, i + CH), FPS, mode: 'noodle' });
      for (const n of names) { const o = r[n]; fs.writeSync(fd[n].mat, Buffer.from(o.mat, 'base64')); fs.writeSync(fd[n].vis, Buffer.from(o.vis, 'base64')); fs.writeSync(fd[n].mt, Buffer.from(o.mt, 'base64'));
        changed[n] = o.changed; for (const [k, v] of Object.entries(o.pos)) { const f = path.join(out, `${n}_${k}.pos.f32`); fs.appendFileSync(f, Buffer.from(v, 'base64')); } }
      process.stdout.write(`\r${Math.min(frames.length, i + CH)}/${frames.length}`);
    }
    for (const n of names) for (const k of Object.values(fd[n])) fs.closeSync(k);
    // meshes that turned out to change shape but are not tubes: a second sweep records their positions
    const extra = {}; for (const n of names) extra[n] = (changed[n] || []).filter((i) => !setup.chars[n].meshes[i].noodle);
    if (Object.values(extra).some((a) => a.length)) {
      console.log('\nchanging shape (not tubes):', JSON.stringify(Object.fromEntries(Object.entries(extra).map(([n, a]) => [n, a.map((i) => setup.chars[n].meshes[i].name)]))));
      await p.evaluate(() => { window.seekState(0.01); });
      for (let i = 0; i < frames.length; i += CH) {
        const r = await p.evaluate(sampleChunk, { frames: frames.slice(i, i + CH), FPS, mode: 'pos' });
        for (const n of names) for (const [k, v] of Object.entries(r[n].pos)) if (extra[n].includes(Number(k))) fs.appendFileSync(path.join(out, `${n}_${k}.pos.f32`), Buffer.from(v, 'base64'));
        process.stdout.write(`\rpos ${Math.min(frames.length, i + CH)}/${frames.length}`);
      }
    }
    const meta = { format: 'cine3d-replay/1', ep: epf, id: info.id, fps: FPS, first_frame: F0, frame_count: frames.length, ink: setup.ink, axes: 'three.js; matrices column-major world; pos = LOCAL vertex positions', chars: {} };
    for (const n of names) { meta.chars[n] = { ...setup.chars[n], deform: (changed[n] || []) }; }
    fs.writeFileSync(path.join(out, 'replay.json'), JSON.stringify(meta));
    console.log(`\nreplay -> ${out}  ${frames.length} frames  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } finally { await S.close(); }
})();
