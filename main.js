// cine3d page: index.html?ep=demo/trada_look.js[&t=3.2][&render=1][&ss=1][&tone=agx][&dof=1]
// window.seek(t) draws one frame; window.filmReady is set when everything is loaded. space = play / pause, arrows = step.
import { createStage, lightRig } from './core/stage.js';
import { createPlayer } from './core/player.js';
import { PACKS } from './packs/index.js';
import { inkOutline } from './core/rig.js';
import { ONLY } from './core/overlay.js';

const q = new URLSearchParams(location.search), film = document.getElementById('film'), ctx = film.getContext('2d', { alpha: false });
await Promise.all(['800 40px Display', '900 40px Display', '600 40px UI', '800 40px UI'].map((f) => document.fonts.load(f, 'ẤƯỮđĐộệ RONALDO')));
const ep = (await import('./' + (q.get('ep') || 'demo/trada_look.js'))).default;
if (ep.lipsFile) ep.lips = await fetch(ep.lipsFile).then((r) => r.json()).catch(() => null);
// 16:9 support (23/11): opt-in via ep.aspect = '16:9', ep.size = [W, H], or ?aspect=16:9. Default 1080 x 1920 untouched.
const [W, H] = ep.size || ((q.get('aspect') || ep.aspect) === '16:9' ? [1920, 1080] : [1080, 1920]);
film.width = W; film.height = H;
// look2 (core/look2.js, 21/11): &look2=1 or ep.look2 = true | { knobs }; &l2_<knob>=<value> overrides one knob for a test. Off = the old picture, untouched.
const look2 = q.get('look2') != null ? q.get('look2') !== '0' : !!ep.look2, l2 = look2 ? { ...(typeof ep.look2 === 'object' ? ep.look2 : {}) } : null;
if (l2) { for (const [k, v] of q) if (k.startsWith('l2_')) l2[k.slice(3)] = isNaN(Number(v)) ? v : Number(v); if (q.get('tone')) l2.tone = q.get('tone'); }
const noWarm = q.get('nowarm') === '1';
const pack = PACKS[ep.pack], stage = createStage({ W, H, ss: Number(q.get('ss') || ep.ss || (look2 ? 0 : 1)), tone: q.get('tone') || pack.tone || 'agx', look2: l2, lazyEnv: noWarm });
const setName = ep.set || pack.defaultSet;
if (ep.pack === 'trada' && setName === 'stall' && ep.setOpts?.plus) await import('./packs/trada/stall_plus_preload.js');
const set = pack.sets[setName](stage.scene, ep.setOpts || {});
const lights = lightRig(stage.scene, ep.light || set.light, { at: set.lightAt }); set.lights = lights; set.tune?.(lights);
stage.setLook(set.look); if (ep.look) stage.setLook(ep.look);
if (q.get('dof')) ep.dof = Number(q.get('dof')); if (q.get('mb')) ep.mblur = Number(q.get('mb'));
// a cast entry is a character name, or 'stageName:character' to put a second copy of a character on stage under its own name (two Tèos: 'teo', 'teomai:teo')
const cast = {}; for (const entry of ep.cast || pack.defaultCast) { const [name, kind] = entry.split(':'); const c = pack.chars[kind || name](ep.castOpts?.[name] || {}); c.name = name; c.root.name = name; const seat = { ...set.seats, ...(ep.seats || {}) }[name]; c.root.position.set(...seat.pos); c.root.rotation.y = seat.yaw || 0; stage.scene.add(c.root); cast[name] = c;
  const ink = q.get('ink') === '0' ? false : (ep.outline ?? pack.outline); if (ink) { const io = ink === true ? {} : ink, L = stage.look2; inkOutline(c.root, L ? { ...io, scale: L.inkK, trim: L.inkTrim, raw: !!L.inkRaw, maxPx: L.inkPx, H } : { ...io, H }); } }
// episode-local additions, so an episode never needs an edit in a shared pack file:
//   ep.poses / ep.faces = { ron: { myPose: { l, r, ... } } } are added to that character's tables;
//   ep.props({ scene, set, cast, stage }) may build its own meshes and returns { update(t, fx) } (fx = the acts on 'set'), called every frame after the set's own update.
stage.setCast(Object.values(cast).map((c) => c.root));   // look2's cast mask (does nothing without look2)
for (const [n, c] of Object.entries(cast)) { if (ep.poses?.[n]) c.poses = { ...c.poses, ...ep.poses[n] }; if (ep.faces?.[n]) c.faces = { ...c.faces, ...ep.faces[n] }; }
if (ep.props) ep._props = ep.props({ scene: stage.scene, set, cast, stage }) || null;
// look2 round 2: the set's light profile (packs/<pack>/look2_sets.js) + the cast's own lights and material response (core/look2.js); nothing without look2
if (stage.look2) { const m = await import('./packs/' + ep.pack + '/look2_sets.js').catch(() => null); stage.setLook2Scene({ set, lights, setName, profiles: m?.L2SETS || {} }); }
// facePlus (opt-in live facial acting + phoneme visemes: ep.facePlus = true or ?faceplus=1; off = untouched)
const fpQ = q.get('faceplus') ?? q.get('facePlus'), wantFP = fpQ != null ? fpQ !== '0' : !!(ep.facePlus || ep.faceplus);
let facePlus = null;
if (wantFP && ep.pack === 'trada') { const fpMod = await import('./packs/trada/faceplus.js').catch(() => null); if (fpMod?.makeFacePlus) { facePlus = fpMod.makeFacePlus(ep, cast, ep.visemes || {}); facePlus.on = true; } }
const player = createPlayer(stage, set, cast, ep, { facePlus });
window.stage = stage; window.player = player; window.ep = ep; window.cast = cast; window.set = set; window.facePlus = facePlus;
window.seek = (t, o) => player.frame(ctx, t, o);
// export for other renderers (tools/dump.cjs, tools/render.cjs pngseq --overlays-only); nothing here runs unless a tool calls it
window.seekState = (t) => player.state(t);   // run the player for time t, draw nothing; then read window.stage.camera, window.cast, window.set
let ovCv = null;   // a second, TRANSPARENT 1080 x 1920 canvas for the overlay layer alone (the film canvas is opaque)
// export split (render.cjs pngseq --overlays-only --split-additive): mode 'normal' draws every overlay EXCEPT what is drawn with
// globalCompositeOperation 'lighter' (additive glows), mode 'add' draws ONLY those. Done on a private canvas whose context hides the
// unwanted half by forcing its alpha to 0 (save / restore keep the requested values). Without a mode nothing changes.
const splitCtx = (mode) => { const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), x = c.getContext('2d'), P = CanvasRenderingContext2D.prototype;
  const dA = Object.getOwnPropertyDescriptor(P, 'globalAlpha'), dG = Object.getOwnPropertyDescriptor(P, 'globalCompositeOperation'); let st = { a: 1, g: 'source-over' }; const stack = [];
  const apply = () => { const show = (st.g === 'lighter') === (mode === 'add'); dA.set.call(x, show ? st.a : 0); dG.set.call(x, st.g === 'lighter' && mode === 'add' ? 'source-over' : st.g); };
  Object.defineProperty(x, 'globalAlpha', { get: () => st.a, set: (v) => { st.a = v; apply(); }, configurable: true });
  Object.defineProperty(x, 'globalCompositeOperation', { get: () => st.g, set: (v) => { st.g = v; apply(); }, configurable: true });
  const sv = x.save.bind(x), rs = x.restore.bind(x); x.save = () => { stack.push({ ...st }); sv(); }; x.restore = () => { rs(); st = stack.pop() || { a: 1, g: 'source-over' }; apply(); };
  x.reset_ = () => { st = { a: 1, g: 'source-over' }; stack.length = 0; apply(); }; apply(); return x; };
const splitCtxs = {};
window.seekOverlay = (t, png = true, mode = null) => { if (mode) { const x = splitCtxs[mode] ||= splitCtx(mode); x.reset_(); ONLY.on = true; ONLY.flags = []; try { player.overlayFrame(x, t); } finally { ONLY.on = false; }
    return { png: png ? x.canvas.toDataURL('image/png').slice(22) : null, skipped: ONLY.flags.filter((f, i, a) => a.findIndex((g) => g.kind === f.kind && g.sample === f.sample && g.blur === f.blur) === i) }; }
  ovCv ||= Object.assign(document.createElement('canvas'), { width: W, height: H }); ONLY.on = true; ONLY.flags = []; try { player.overlayFrame(ovCv.getContext('2d'), t); } finally { ONLY.on = false; }
  return { png: png ? ovCv.toDataURL('image/png').slice(22) : null, skipped: ONLY.flags.filter((f, i, a) => a.findIndex((g) => g.kind === f.kind && g.sample === f.sample && g.blur === f.blur) === i) }; };
let bdCv = null;   // export: the set-swap board alone (render.cjs pngseq --board-only)
window.seekBoard = (t) => { bdCv ||= Object.assign(document.createElement('canvas'), { width: W, height: H }); const a = player.boardFrame(bdCv.getContext('2d'), t); return { png: bdCv.toDataURL('image/png').slice(22), a }; };
let t = Number(q.get('t') || 0), playing = false, last = 0;
if (noWarm) player.state(t); else { window.seek(t); window.seek(t); }   // twice: the first frame compiles shaders and uploads textures (skipped under ?nowarm=1 for geometry-only tools)
if (!q.get('render')) {
  const hud = document.getElementById('hud');
  const loop = (now) => { if (playing) { t = (t + (now - last) / 1000) % ep.dur; window.seek(t); } last = now; hud.textContent = `${t.toFixed(2)} s · ${player.shotAt(t).cam}`; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  addEventListener('keydown', (e) => { if (e.key === ' ') playing = !playing; if (e.key === 'ArrowRight') { t += 1 / 30; window.seek(t); } if (e.key === 'ArrowLeft') { t -= 1 / 30; window.seek(t); } });
}
// QA probe: where the heads land on the frame at time t, and how bright the subject's face is (tools/qa.cjs)
import('./core/camera.js').then(({ project }) => {
  window.probe = (t, { luma = true } = {}) => { const cam = player.frame(ctx, t, { overlays: false, noRender: !luma }), heads = {};
    for (const [n, c] of Object.entries(cast)) { const h = c.headWorld(), [x, y, z] = project(stage.camera, h, W, H), top = project(stage.camera, h.clone().add(stage.camera.up.clone().multiplyScalar(c.R)), W, H); heads[n] = { x, y, r: Math.abs(y - top[1]), behind: z > 1 }; }
    let lv = null, bl = null;
    if (luma) { const s = heads[cam.who], d = ctx.getImageData(Math.max(0, Math.round(s.x - s.r * 0.5)), Math.max(0, Math.round(s.y - s.r * 0.5)), Math.max(1, Math.round(s.r)), Math.max(1, Math.round(s.r))).data; let l = 0, hi = 0; for (let i = 0; i < d.length; i += 4) { const v = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; l += v; if (v > 0.97) hi++; } lv = l / (d.length / 4); bl = hi / (d.length / 4); }
    return { shot: player.shotAt(t).cam, base: cam.base, who: cam.who, group: cam.group, darkFace: !!cast[cam.who].darkFace, heads, luma: lv, blown: bl }; };
  window.filmReady = true;
});
