// cine3d events: the sound-relevant events of an episode, read from the PICTURE (no core edit), for tools/voice.py foley ("foley": "auto").
//   node tools/events.cjs episodes/<id>.js [--step 0.0167] [--props 0.05] [--no-props]      ->  out/<id>/events.json
// Run it AFTER `voice.py build` (the episode imports episodes/<id>.times.js), then build again so voice.py can place the sounds.
// Opens the page headless exactly like clipcheck.cjs (stage.render stubbed: scene updates only, nothing drawn) and reads
//   feet     foot contacts per character (and per horde, merged): the time each foot lands during a walk / run / lurch / charge / robot / backaway.
//            Measured, not computed: the bottom of each foot's meshes against the character's own ground level (its lowest foot point while it walks, 2nd percentile)
//            + 2 cm (the same 2 cm clipcheck calls "planted"); a landing = the bottom crossing under that line. Loudness hint from ground speed and run weight.
//   actions  what the player knows from the episode data: fx bite / bitten / trip / fall / pile / tackle / hit / slap at the moment of contact (a fraction of the fx ramp, table CONTACT_AT),
//            and every ep.hits hit-stop. Loudness hint from the fx value.
//   props    a free prop that was at rest, moved and came to rest again: `put` (set down gently), `drop` (arrived fast), `slide` (travelled mostly sideways). From mesh motion only.
//   needsHook  event types that exist in the film but cannot be read without a core hook (listed in the file and printed).
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.otf': 'font/otf' };
const EPFILE = args.find((a) => /\.js$/.test(a) && !args[args.indexOf(a) - 1]?.startsWith('--'));
if (!EPFILE) { console.log('usage: node tools/events.cjs episodes/<id>.js'); process.exit(2); }
const STEP = Number(flag('step', 1 / 60)), PSTEP = Number(flag('props', 0.05)), NOPROPS = args.includes('--no-props');
const GAITK = ['walk', 'run', 'lurch', 'robot', 'charge', 'backaway'];
const CONTACT_AT = { bite: 0.5, bitten: 0.5, trip: 0.4, fall: 1.0, pile: 0.8, tackle: 0.7, hit: 0.5, slap: 0.5 };   // fraction of the fx ramp at which the contact happens (a guess: the ramps are smooth-stepped)

async function pageInit([GAITK, NOPROPS]) {
  const THREE = await import('/node_modules/three/build/three.module.js'), U = await import('/core/util.js');
  const { Vector3: V3, Box3, Frustum, Matrix4 } = THREE, scene = window.stage.scene, cast = window.cast, ep = window.ep, cam = window.stage.camera;
  window.__stageRender = window.stage.render; window.stage.render = () => {};
  const fxT = {}; for (const a of ep.acts || []) if (a.fx) for (const [k, v] of Object.entries(a.fx)) ((fxT[a.who] ??= {})[k] ??= []).push({ t: a.t, v, d: a.d ?? 0.4, lin: a.ease === 'lin' });
  for (const w in fxT) for (const k in fxT[w]) fxT[w][k].sort((a, b) => a.t - b.t);
  const fxAt = (who, t) => { const o = {}; for (const k in fxT[who] || {}) { let v = 0; for (const f of fxT[who][k]) { if (t < f.t) break; const u = (t - f.t) / Math.max(1e-3, f.d); v = U.lerp(v, f.v, f.lin ? U.clamp(u) : U.smooth(u)); } o[k] = v; } return o; };
  const units = [], inUnit = new Set();
  for (const [n, c] of Object.entries(cast)) {
    const list = c.members ? c.members.map((m, i) => ({ name: n + '#' + i, char: n, root: m.g })) : [{ name: n, char: n, root: c.root }];
    for (const u of list) { u.meshes = []; u.root.traverse((m) => { if (m.isMesh && !m.userData.isOutline) { u.meshes.push(m); inUnit.add(m); } }); units.push(u); }
  }
  const PM = new Matrix4(), frustum = new Frustum(), box = new Box3(), _v = new V3();
  const visible = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
  const isTube = (m) => m.geometry.type === 'TubeGeometry' || m.userData.noodle;
  const setFrame = (t) => { window.player.frame(document.getElementById('film').getContext('2d'), t, { overlays: false }); scene.updateMatrixWorld(true); cam.updateMatrixWorld(true); cam.updateProjectionMatrix(); PM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse.copy(cam.matrixWorld).invert()); frustum.setFromProjectionMatrix(PM); };
  const gaitW = (who, t) => { const f = fxAt(who, t); return GAITK.reduce((s, k) => s + (f[k] || 0), 0); };
  // which unit meshes are feet: small, not a limb tube, near the lowest point of the unit (found once per unit at the first frame it is walking)
  const feetOf = (u) => {
    const bb = u.meshes.filter((m) => visible(m) && !isTube(m)).map((m) => ({ m, b: new Box3().setFromObject(m) })).filter((o) => isFinite(o.b.min.y)); if (!bb.length) return null;
    const low = Math.min(...bb.map((o) => o.b.min.y)), rootInv = u.root.matrixWorld.clone().invert(), res = { L: [], R: [] };
    for (const o of bb) { const sz = o.b.getSize(new V3()); if (Math.max(sz.x, sz.y, sz.z) > 0.35 || o.m.geometry.type === 'PlaneGeometry' || o.m.geometry.type === 'CircleGeometry') continue; const c = o.b.getCenter(new V3()); if (c.y - low > 0.2) continue; const lx = c.clone().applyMatrix4(rootInv).x; (lx < 0 ? res.L : res.R).push(o.m); }
    return res.L.length && res.R.length ? res : null;
  };
  const botOf = (list) => { let y = 1e9; for (const m of list) { box.setFromObject(m); if (box.min.y < y) y = box.min.y; } return y; };
  // ---- feet: windows where anybody has gait weight, sampled at STEP ----
  window.__ev = {
    info: () => ({ dur: ep.dur, units: units.map((u) => u.name), places: ep.setOpts?.places || [], acts: ep.acts.length }),
    gaitWindows: () => { const W = {}; const names = [...new Set(units.map((u) => u.char))]; for (const n of names) { let on = null; const a = []; for (let t = -0.5; t <= ep.dur + 0.5; t += 0.05) { const w = gaitW(n, t) > 0.05; if (w && on === null) on = t; if (!w && on !== null) { a.push([Math.max(0, on - 0.1), t + 0.1]); on = null; } } if (on !== null) a.push([Math.max(0, on - 0.1), ep.dur]); W[n] = a; } return W; },
    feet: (n, t0, t1, step) => {   // samples of one character (all its units): per unit per side the bottom of the foot, ground speed, gait weights, in view
      const out = []; const us = units.filter((u) => u.char === n), F = new Map(); const prev = new Map();
      for (let t = t0; t <= t1 + 1e-9; t += step) {
        setFrame(t); const w = gaitW(n, t), f = fxAt(n, t), run = (f.run || 0) + (f.charge || 0);
        for (const u of us) {
          if (u.root.getWorldPosition(_v).y < -1.5) continue; let F_ = F.get(u); if (F_ === undefined) { F_ = feetOf(u); F.set(u, F_); } if (!F_) continue;
          const p = u.root.getWorldPosition(new V3()), q = prev.get(u), sp = q ? Math.hypot(p.x - q.x, p.z - q.z) / step : 0; prev.set(u, p);
          box.setFromObject(u.root); out.push({ u: u.name, t: +t.toFixed(4), L: botOf(F_.L), R: botOf(F_.R), w, run, sp, vis: frustum.intersectsBox(box) });
        }
      } return out; },
    // ---- props: free small meshes (not part of any character): world centre over time ----
    propCands: () => { const c = []; if (NOPROPS) return c; scene.traverse((m) => { if (!m.isMesh || inUnit.has(m) || m.userData.isOutline || isTube(m)) return; const g = m.geometry; if (g.type === 'PlaneGeometry' || g.type === 'CircleGeometry') return; box.setFromObject(m); const sz = box.getSize(new V3()), mx = Math.max(sz.x, sz.y, sz.z); if (mx < 0.03 || mx > 0.4) return; c.push(m); }); window.__pc = c; return c.length; },
    propStep: (t) => { setFrame(t); return window.__pc.map((m) => { const c = new Box3().setFromObject(m).getCenter(new V3()); return [c.x, c.y, c.z, visible(m) ? 1 : 0]; }); },
  };
  return window.__ev.info();
}

(async () => {
  const srv = await new Promise((res) => { const s = http.createServer((req, rsp) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { rsp.writeHead(404); return rsp.end(); } rsp.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); rsp.end(d); }); }); s.listen(0, () => res(s)); });
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }), p = await b.newPage({ viewport: { width: 540, height: 960 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${srv.address().port}/index.html?render=1&ep=${EPFILE}`); await p.waitForFunction(() => window.filmReady, null, { timeout: 60000 });
  const T0 = Date.now(), info2 = await p.evaluate(pageInit, [GAITK, NOPROPS]);
  const id = path.basename(EPFILE, '.js'), ep = (await import(require('url').pathToFileURL(path.resolve(EPFILE)).href)).default;
  const places = (info2.places || []).map((x) => ({ t: +(+x.t).toFixed(3), place: x.place })), placeAt = (t) => { let r = ep.set || null; for (const x of places) if (x.t <= t + 1e-6) r = x.place; return r; };
  const out = { id, dur: info2.dur, step: STEP, places, set: ep.set || null, feet: [], actions: [], props: [], needsHook: [] };
  // ---- feet ----
  const W = await p.evaluate(() => window.__ev.gaitWindows()), perChar = {};
  for (const [n, wins] of Object.entries(W)) {
    // merge windows closer than 0.4 s and sample each
    const m = []; for (const w of wins) { if (m.length && w[0] - m[m.length - 1][1] < 0.4) m[m.length - 1][1] = w[1]; else m.push([...w]); }
    const rows = []; for (const [a, c] of m) rows.push(...await p.evaluate(([n, a, c, s]) => window.__ev.feet(n, a, c, s), [n, a, c, STEP]));
    if (rows.length) perChar[n] = rows;
  }
  const feetRaw = [];
  for (const [n, rows] of Object.entries(perChar)) {
    const byU = {}; for (const r of rows) (byU[r.u] ??= []).push(r);
    for (const [u, rs] of Object.entries(byU)) {
      const all = rs.filter((r) => r.w > 0.05).flatMap((r) => [r.L, r.R]).sort((a, b) => a - b); if (all.length < 4) continue; const g0 = all[Math.floor(all.length * 0.02)];   // this unit's ground: 2nd percentile of its foot bottoms while walking
      for (const side of ['L', 'R']) { let down = false, last = -9;
        for (let i = 0; i < rs.length; i++) { const r = rs[i], c = r[side] < g0 + 0.02 && r.w > 0.05; if (c && !down && i > 0 && r.t - last > 0.12 && rs[i - 1].t >= r.t - STEP * 2.5 && (r.vis || r.sp > 0.3)) {   // a landing we saw, of a character that is on screen or really travelling (not one stepping on the spot off screen)
           feetRaw.push({ t: r.t, who: n, unit: u, foot: side, loud: Math.min(1, 0.3 + 0.25 * r.sp + 0.2 * Math.min(1, r.run)), speed: +r.sp.toFixed(2), vis: r.vis, place: placeAt(r.t) }); last = r.t; } down = c; } }
    }
  }
  // the horde is one sound: members landing within 80 ms of each other merge into one contact (n = how many)
  const solo = feetRaw.filter((f) => !f.unit.includes('#')), crowd = feetRaw.filter((f) => f.unit.includes('#')).sort((a, c) => a.t - c.t), bins = new Map();
  for (const f of crowd) { const k = f.who + '|' + Math.floor(f.t / 0.2); const l = bins.get(k); if (l) { l.n++; l.ts.push(f.t); l.loud = Math.max(l.loud, f.loud); l.vis = l.vis || f.vis; } else bins.set(k, { ...f, n: 1, ts: [f.t] }); }   // the horde is one texture: landings inside the same 0.2 s merge into one event (n = how many, t = their mean)
  const merged = [...bins.values()].map((l) => ({ ...l, t: +(l.ts.reduce((a, c) => a + c, 0) / l.ts.length).toFixed(4) }));
  out.feet = [...solo.map((f) => ({ t: f.t, who: f.who, foot: f.foot, loud: +f.loud.toFixed(2), speed: f.speed, vis: f.vis, place: f.place, n: 1 })), ...merged.map((f) => ({ t: f.t, who: f.who, foot: 'x', loud: +f.loud.toFixed(2), speed: f.speed, vis: f.vis, place: f.place, n: f.n }))].sort((a, c) => a.t - c.t);
  // ---- actions from the episode data ----
  const seen = new Set();
  for (const a of ep.acts || []) if (a.fx) for (const [k, v] of Object.entries(a.fx)) { if (!(k in CONTACT_AT) || v < 0.5) continue; const t = a.t + CONTACT_AT[k] * (a.d ?? 0.4); if (t < 0 || t > ep.dur) continue; const key = k + '|' + a.who + '|' + t.toFixed(1); if (seen.has(key)) continue; seen.add(key); out.actions.push({ t: +t.toFixed(3), who: a.who, type: k, loud: +Math.min(1, 0.5 + 0.5 * v).toFixed(2), src: 'acts fx ' + k, place: placeAt(t) }); }
  for (const h of ep.hits || []) out.actions.push({ t: +h.t.toFixed(3), who: '-', type: 'hit', loud: 0.9, src: 'ep.hits', place: placeAt(h.t) });
  out.actions.sort((a, c) => a.t - c.t);
  // ---- props: at rest -> moved -> at rest ----
  if (!NOPROPS) {
    const nc = await p.evaluate(() => window.__ev.propCands()), ts = []; for (let t = 0; t <= info2.dur; t += PSTEP) ts.push(+t.toFixed(3));
    const S = []; for (const t of ts) S.push(await p.evaluate((t) => window.__ev.propStep(t), t));
    for (let k = 0; k < nc; k++) {
      let i = 1; const pos = (j) => S[j][k], sp = (j) => Math.hypot(...[0, 1, 2].map((a) => pos(j)[a] - pos(j - 1)[a])) / PSTEP;
      while (i < S.length) {
        if (sp(i) > 0.25 && S[i][k][3] && S[i - 1][k][3]) { let j = i; while (j + 1 < S.length && sp(j + 1) > 0.05) j++;   // moving from i..j
          let s0 = i - 1; const calm = j + 3 < S.length ? [1, 2, 3].every((q) => sp(j + q) < 0.05) : true;
          const d = [0, 1, 2].map((a) => pos(j)[a] - pos(s0)[a]), hor = Math.hypot(d[0], d[2]), ver = Math.abs(d[1]), vend = sp(j) , dur = (j - s0) * PSTEP;
          const jump = places.some((x) => Math.abs(x.t - ts[j]) < 0.3 || Math.abs(x.t - ts[s0]) < 0.3);   // a set change teleports every prop: not an event
          if (calm && Math.hypot(...d) >= 0.06 && Math.hypot(...d) <= 1.5 && dur <= 2.0 && S[j][k][3] && !jump) { const t = ts[j], type = hor > 2 * ver && vend < 0.9 ? 'slide' : (vend > 0.9 ? 'drop' : 'put'); out.props.push({ t, who: 'prop#' + k, type, loud: +Math.min(1, 0.35 + vend * 0.3).toFixed(2), src: `mesh moved ${Math.hypot(...d).toFixed(2)} m in ${dur.toFixed(2)} s`, place: placeAt(t) }); }
          i = j + 1; } else i++;
      }
    }
    out.props.sort((a, c) => a.t - c.t); const keep = []; for (const e of out.props) if (!keep.some((k) => Math.abs(k.t - e.t) < 0.15)) keep.push(e); out.props = keep;   // several meshes of one object moving together are one event
  }
  out.needsHook = [
    'bite / bitten / trip / fall / pile / tackle: the contact moment is a fixed fraction of the fx ramp (table CONTACT_AT), not read from the bodies touching: a hook in core/player.js that reports the frame two body volumes first touch would make it exact',
    'prop contact with a surface (a glass set on the table at a certain frame): only the stop of the mesh is seen, so a prop that is carried and put down inside one character-owned mesh group is not detectable',
    'hand-on-object and hand-on-body events (slap, grab, punch) driven by poses (ep.poses / faces tables) rather than fx: not in ep.acts, no event emitted (the ep.hits hit-stops are the only ones)',
    'cloth, hair and tray rattles: not events in the engine',
  ];
  fs.mkdirSync(path.join(ROOT, 'out', id), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out', id, 'events.json'), JSON.stringify(out));
  const cnt = (a, f) => a.reduce((o, x) => (o[f(x)] = (o[f(x)] || 0) + 1, o), {});
  console.log(`${id}: ${out.feet.length} foot contacts (${JSON.stringify(cnt(out.feet, (f) => f.who))}), ${out.actions.length} action events (${JSON.stringify(cnt(out.actions, (a) => a.type))}), ${out.props.length} prop events (${JSON.stringify(cnt(out.props, (a) => a.type))}) in ${((Date.now() - T0) / 1000).toFixed(0)} s -> out/${id}/events.json`);
  console.log('needs a hook:\n  - ' + out.needsHook.join('\n  - ')); if (errs.length) console.log('page errors:', [...new Set(errs)].slice(0, 3));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
