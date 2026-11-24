// cine3d export for other renderers (Blender): the SET of an episode (window.set.group, no cast) as one binary glTF, plus a JSON of its lights
// and practicals, so a second renderer can stage the exact same place and relight it.
//   node tools/export_set.cjs <ep.js> <out.glb> [--t 0.5]
// The set is posed at time t (window.seekState(t)) before export. Canvas textures are embedded as PNG. Opt-in tool: no engine file is changed.
// Every node gets extras.c3d = { emissive: hex, emissiveIntensity, basic: true for MeshBasicMaterial, blending: 'add' for additive, opacity, transparent }
// so the importer can rebuild glows that glTF cannot carry (additive blending, emissive > 1).
const fs = require('fs'), path = require('path'), { start, flagOf } = require('./_page.cjs');
const args = process.argv.slice(2), epf = args[0], out = args[1], flag = flagOf(args);
if (!epf || !out) { console.log('usage: node tools/export_set.cjs <ep.js> <out.glb> [--t 0.5]'); process.exit(1); }
// glTF accessors whose min/max came out null (an attribute three.js keeps sparse) are invalid for strict readers (Blender): drop the bounds (optional except POSITION)
function fixGlb(b) {
  const l = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + l).toString()), rest = b.slice(20 + l);
  const pos = new Set(); for (const m of j.meshes || []) for (const pr of m.primitives) if (pr.attributes.POSITION !== undefined) pos.add(pr.attributes.POSITION);
  let n = 0; for (const [i, a] of j.accessors.entries()) { const bad = (v) => v && v.some((x) => typeof x !== 'number'); if ((bad(a.max) || bad(a.min)) && !pos.has(i)) { delete a.max; delete a.min; n++; } }
  let js = Buffer.from(JSON.stringify(j)); const pad = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const hdr = Buffer.alloc(20); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(20 + js.length + rest.length, 8); hdr.writeUInt32LE(js.length, 12); hdr.writeUInt32LE(0x4e4f534a, 16);
  if (n) console.log(`fixed ${n} accessor bounds`); return Buffer.concat([hdr, js, rest]);
}
(async () => {
  const S = await start(), p = await S.open(epf);
  try {
    const t = Number(flag('t', 0.5));
    const res = await p.evaluate(async (t) => {
      const THREE = await import('three'), { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      window.seekState(t);
      const g = window.set.group; g.updateMatrixWorld(true);
      const lights = [];
      g.traverse((o) => {
        if (o.isLight) { const v = new THREE.Vector3(); o.getWorldPosition(v); lights.push({ type: o.type, color: o.color.getHexString(), intensity: o.intensity, distance: o.distance ?? null, decay: o.decay ?? null, pos: [v.x, v.y, v.z], visible: o.visible }); }
        if (o.isMesh || o.isPoints || o.isLine) { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) return;
          o.userData.c3d = { basic: !!m.isMeshBasicMaterial, blending: m.blending === THREE.AdditiveBlending ? 'add' : 'normal', opacity: m.opacity, transparent: !!m.transparent, side: m.side,
            color: m.color ? m.color.getHexString() : null, colorRGB: m.color ? [m.color.r, m.color.g, m.color.b] : null,
            emissive: m.emissive ? m.emissive.getHexString() : null, emissiveIntensity: m.emissiveIntensity ?? 0, hasEmissiveMap: !!m.emissiveMap, noOutline: !!o.userData.noOutline, visible: o.visible, effVisible: (() => { let q = o; while (q && q !== g.parent) { if (!q.visible) return false; q = q.parent; } return true; })(), name: o.name || '' }; }
      });
      // every MESH gets a stable name c3dset_<i> (traversal order of set.group; tools/dump.cjs --set-dyn uses the same numbering) so a second
      // renderer can animate the pieces that set fx move or show / hide (the table phone, a pushed glass, ...). Hidden meshes are exported too
      // (visible: false in extras.c3d) because an fx may show them later; points / lines / sprites are dropped (dust, cones are rebuilt).
      let mi = 0; g.traverse((o) => { if (o.isMesh) o.userData.c3dId = 'c3dset_' + (mi++); });
      const clone = g.clone(true); const drop = []; clone.traverse((o) => { if (o.isLight || o.isPoints || o.isLine || o.isSprite) drop.push(o); else { if (o.isMesh) o.name = o.userData.c3dId; o.visible = true; } }); drop.forEach((o) => o.parent && o.parent.remove(o));
      let nan = 0; clone.traverse((o) => { if (!o.geometry) return; for (const a of Object.values(o.geometry.attributes)) { const arr = a.array; for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) { arr[i] = 0; nan++; } a.needsUpdate = true; } });   // degenerate vertices (NaN) break glTF min/max
      clone.position.set(0, 0, 0); clone.rotation.set(0, 0, 0); clone.scale.set(1, 1, 1);
      const exp = new GLTFExporter();
      const buf = await new Promise((ok, bad) => exp.parse(clone, ok, bad, { binary: true, onlyVisible: true, maxTextureSize: 2048 }));
      const u8 = new Uint8Array(buf); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return { b64: btoa(s), lights, seats: window.set.seats, nan };
    }, t);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, fixGlb(Buffer.from(res.b64, 'base64')));
    fs.writeFileSync(out.replace(/\.glb$/, '') + '_lights.json', JSON.stringify({ t, lights: res.lights, seats: res.seats }, null, 1));
    console.log(`-> ${out} ${(fs.statSync(out).size / 1e6).toFixed(2)} MB, ${res.lights.length} lights, ${res.nan} non-finite vertex values zeroed`);
  } finally { await S.close(); }
})();
