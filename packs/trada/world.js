// Trà đá với AI, special "Zombie": ONE set that holds all the places of the two-part special (stall, street, market, gate) so an episode can cut between them.
// An episode asks for set: 'zombie'. The places sit far apart in the world (street +400 m, market +800 m, gate +1200 m in x; the stall stays at the origin); only the active place is visible,
// the one light rig is moved to it and re-moodied, and the characters are stood on its marks. Everything is a pure function of t, driven by two data lists in setOpts:
//   places: [{ t: 0, place: 'street' }, { t: 5, place: 'stall' }, ...]      which place is shown from t on
//   stands: [{ t: 0, who: 'teo', mark: 'street.run_a', yaw: 0 }, ...]        from t on, `who` stands on that mark (yaw = extra turn in rad, optional; `y` = lift, optional); `pos: [x, y, z]` instead of `mark` = an absolute world spot (`y: -100` parks a character out of sight)
// Marks are named '<place>.<mark>' ('street.run_a', 'market.door', 'gate.block_l', 'stall.teo'); the stall's own marks (teo, bip, ba, me, khach) also work unprefixed.
// `layout: 'block'` (default off) builds ONE connected neighbourhood instead (see buildBlock below).
// Options for a place go in street: {...}, market: {...}, gate: {...}, stall: {...} (the same options as the single sets). fx on 'set' reach whichever place is active.
import { buildStall } from './stall.js';
import { LIGHT_PRESETS } from '../../core/stage.js';
import * as THREE from 'three';
import { buildStreet, buildBlockStreet, debtSheet } from './street.js';
import { buildMarket } from './market.js';
import { buildGate } from './gate.js';

export function buildZombieWorld(scene, opts = {}) { return opts.layout === 'block' ? buildBlock(scene, opts) : buildSeparate(scene, opts); }

function buildSeparate(scene, { places = [], stands = [], stall = {}, street = {}, market = {}, gate = {}, start = null } = {}) {
  const ORG = { stall: [0, 0, 0], street: [400, 0, 0], market: [800, 0, 0], gate: [1200, 0, 0] };
  const P = { stall: buildStall(scene, stall), street: buildStreet(scene, { ...street, at: ORG.street }), market: buildMarket(scene, { ...market, at: ORG.market }), gate: buildGate(scene, { ...gate, at: ORG.gate }) };
  const seats = { ...P.stall.seats }; for (const [pn, ps] of Object.entries(P)) for (const [mn, m] of Object.entries(ps.seats || {})) seats[pn + '.' + mn] = m;
  const world = { group: P.stall.group, light: 'warm_night', seats, look: P.stall.look, places: P, origin: ORG, lights: null, active: null };
  const plan = [...places].sort((a, b) => a.t - b.t), stand = [...stands].sort((a, b) => a.t - b.t);
  world.setPlace = (name) => {
    if (world.active === name) return; world.active = name; const ps = P[name];
    for (const [pn, s] of Object.entries(P)) s.group.visible = pn === name;
    const L = world.lights; if (L) { L.apply(ps.light, ps.lightAt || [0, 0.8, 0]); ps.lights = L; ps.tune?.(L); }
    if (ps.look) globalThis.stage?.setLook(ps.look);
  };
  const placeAt = (t) => { let n = start || plan[0]?.place || 'stall'; for (const p of plan) if (p.t <= t) n = p.place; return n; };
  world.tune = (L) => { world.lights = L; world.active = null; for (const s of Object.values(P)) s.lights = L; world.setPlace(placeAt(0)); };
  world.update = (t, fx = {}) => {
    world.setPlace(placeAt(t));
    const last = {}; for (const s of stand) if (s.t <= t) last[s.who] = s;
    for (const [who, s] of Object.entries(last)) { const r = scene.getObjectByName(who), m = s.pos ? { pos: s.pos, yaw: 0 } : seats[s.mark]; if (r && m) { r.position.set(m.pos[0], m.pos[1] + (s.y || 0), m.pos[2]); r.rotation.y = (m.yaw || 0) + (s.yaw || 0); r.userData.zbHome = { p: r.position.clone(), y: r.rotation.y }; } }
    P[world.active].update?.(t, fx);
  };
  return world;
}

// ======================= layout 'block': one connected neighbourhood (Part 1 of the Zombie film, script ban 4) =======================
// The tea stall stands on the near pavement of a main road that runs along x; across the road, in plain view from Tèo's seat, is the charger shop (market.js, `sign: 'ĐIỆN MÁY · SẠC PIN'`,
// a generator rattling by its door that explains why only that shop has light); the stall, the road and the shop interior are all there at once, so people can walk or run from the stall across
// the road through the shop door in continuous space. setOpts: { layout: 'block', stall: {...}, market: {...}, street: {...}, shopX: -2, focus: [{ t, at: [x, y, z] }], stands: [...] }.
// Defaults of the block: stall { block, post, speaker, spill, qrcard } on, market { gen, outside: false }. fx on 'set' (all pure ramps): blackout (stall lamps, string lights, street lamps, windows and the socket strip's
// LED die with a slow flutter, cold moon), notes (debt notes drift on the road), qrwet (tea reaches the QR card on the table and ruins the code), cold, spill, ting, abandon (stall); ride / hold / drag / tx / tz /
// tyaw / tshake / noodle / charger (shop, see market.js); smoke, paper (street).
// Marks (world, unprefixed and also `block.<name>`): stall: teo, bip, ba, me, khach · road: curb_stall, mid_road, curb_shop, shop_door (the crossing, facing +z), victim, biter (the bite pair mid-road, 0.6 m apart, facing),
// end_a, end_b (debt zombies arriving from the far -x end), shutter_hide, shutter_hide_b (the bay at x 8, no socket), run_a, run_b, fall, fall_b (the long run away from the stall, +x), horde1..15 (behind the runners, facing +x).
// Shop marks are `shop.<mark>` (door, aisle_a, aisle_b, noodle, charger, checkout, trolley, push, ...: the shop's own marks turned to world, the shop faces -z).
// The one light rig stays on the stall unless `focus` moves it (keys, smooth between them); the moon (a directional light, cold) lights the road and gets strong with the blackout.
function buildBlock(scene, { stall = {}, market = {}, street = {}, shopX = -2, focus = null, stands = [] } = {}) {
  const S = buildStall(scene, { block: true, post: true, speaker: true, spill: true, qrcard: true, ...stall });
  const B = buildBlockStreet(scene, { shopX, ...street });
  const ZB = B.bounds.ZB, wrap = new THREE.Group(); wrap.name = 'shop_wrap'; wrap.position.set(shopX, 0, ZB); wrap.rotation.y = Math.PI; scene.add(wrap);
  debtSheet(B.group, [B.seats.fall.pos[0] + 0.1, 0.02, B.seats.fall.pos[2] - 0.12], 0.6);   // the debt note Tèo slips on in the finale
  const M = buildMarket(scene, { gen: true, sign: 'ĐIỆN MÁY · SẠC PIN', outside: false, ...market }); wrap.add(M.group);
  const toW = (m) => ({ pos: [shopX - m.pos[0], m.pos[1], ZB - m.pos[2]], yaw: (m.yaw || 0) + Math.PI });
  const seats = { ...S.seats, ...B.seats }; for (const [n, m] of Object.entries(B.seats)) seats['block.' + n] = m; for (const [n, m] of Object.entries(M.seats)) seats['shop.' + n] = toW(m);
  const cams = {}; for (const [n, c] of Object.entries(B.cams)) cams[n] = c; for (const [n, c] of Object.entries(M.cams || {})) cams['shop.' + n] = { ...c, from: [shopX - c.from[0], c.from[1], ZB - c.from[2]], at: [shopX - c.at[0], c.at[1], ZB - c.at[2]] };
  const world = { group: S.group, light: 'warm_night', seats, cams, look: S.look, parts: { stall: S, street: B, shop: M }, lights: null, anchors: M.anchors, layout: 'block' };
  const stand = [...stands].sort((a, b) => a.t - b.t), fk = focus ? [...focus].sort((a, b) => a.t - b.t) : null;
  world.tune = (L) => { world.lights = L; S.lights = L; };
  const P0 = require_preset();
  world.update = (t, fx = {}) => {
    const last = {}; for (const s of stand) if (s.t <= t) last[s.who] = s;
    for (const [who, s] of Object.entries(last)) { const r = scene.getObjectByName(who), m = s.pos ? { pos: s.pos, yaw: 0 } : seats[s.mark]; if (r && m) { r.position.set(m.pos[0], m.pos[1] + (s.y || 0), m.pos[2]); r.rotation.y = (m.yaw || 0) + (s.yaw || 0); r.userData.zbHome = { p: r.position.clone(), y: r.rotation.y }; } }
    S.update(t, fx); B.update(t, fx); M.update(t, fx);
    const L = world.lights; if (L && fk) { let i = 0; while (i + 1 < fk.length && fk[i + 1].t <= t) i++; const a = fk[i], b = fk[Math.min(i + 1, fk.length - 1)], u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1, e = u * u * (3 - 2 * u), at = a.at.map((v, k) => v + (b.at[k] - v) * e);
      for (const [l, q] of [[L.key, P0.key], [L.rim, P0.rim], [L.kick, P0.kick]]) { l.target.position.set(at[0], at[1], at[2]); l.position.set(q[2][0] + at[0], q[2][1], q[2][2] + at[2]); } }
  };
  return world;
}
const require_preset = () => LIGHT_PRESETS.warm_night;
