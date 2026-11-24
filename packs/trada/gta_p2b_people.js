// Trà đá với AI, "Tèo vào GTA 6" part 2 NEW (gta6p2b, 20/11): the two new people. Built on `makePerson` (people.js). Cast names:
//   ga    GÃ ĐÔ CON, standing: about 1.45 x Tèo's height (rig scaled), broad (build 1.5), a teal cap, a crimson bomber jacket he can throw off (fx `jacket` 1 hides it; the flying copy is the set's), a white tank top.
//   gas   the same man SEATED (in the silver car; the car glues him, see buildSilverCar riders)
//   bongden  BÓNG ĐEN: seated, black hoodie, a black hood that hides the whole head (NO face, NO logo), the right arm up spinning the gold-chain key fob (blinks with ledWave).
// Poses (on top of the standing / seated set of makePerson):
//   sleep (seated, leans back, hands in the lap; with fx capDown 1 the cap is pulled over the eyes) · sigh (hands down; fx `sigh` 0..1 = ONE long breath, chest up then out, shoulders drop) ·
//   mirror (seated: head up and turned to the rear-view mirror) · stretch (arms high, leans back) · offer (seated: right arm out with the fob) · wheel (seated: hands on the wheel) · hold (standing, arms low, fob in the right hand) · spin (bongden).
// fx on the person: eyeGlow 0..1 (gold eyes, ramp 0.4 s), tremble 0..1, hop 0..1 (the skipping run: a bounce, the legs run via the gait fx), jacket 0..1 (1 = off), capDown 0..1, fob 0 | 1, led 0..1, sigh 0..1.
// No weapon, no real logo or brand anywhere.
import * as THREE from 'three';
import { clamp, lerp, smooth, std, mesh, ball, cyl, canvasTex, V } from '../../core/util.js';
import { Noodle, armCtrl, onHead } from '../../core/rig.js';
import { makePerson } from './people.js';
import { makeFob } from './gta_p2b_props.js';

const TORSO = [[0.001, 0.3], [0.13, 0.3], [0.168, 0.36], [0.172, 0.46], [0.155, 0.58], [0.128, 0.68], [0.085, 0.735], [0.04, 0.752], [0.001, 0.755]];
const rAt = (y) => { for (let i = 0; i < TORSO.length - 1; i++) { const [r0, y0] = TORSO[i], [r1, y1] = TORSO[i + 1]; if (y >= y0 && y <= y1) return lerp(r0, r1, (y - y0) / (y1 - y0)); } return 0.04; };
const glowTex = () => canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, '#fff'); g.addColorStop(0.45, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
const BIG = 1.4;

function poseSet(base, L, seated) {
  const P = { ...base };
  const lap = [[-0.13, 0.42, 0.2, 0], [0.13, 0.42, 0.2, 0]];
  P.sleep = { l: lap[0], r: lap[1], lean: -0.62, pitch: -0.3, bob: -0.02 };
  P.sigh = { l: [-0.2, L + 0.36, 0.04, 0], r: [0.2, L + 0.36, 0.04, 0], lean: 0.03, pitch: -0.06 };
  P.mirror = { l: [-0.08, 0.64, 0.33, 0], r: [0.1, 0.63, 0.33, 0], pitch: 0.28, yaw: 0.42, lean: 0.05 };
  P.wheel = { l: [-0.08, 0.62, 0.33, 0], r: [0.1, 0.62, 0.33, 0], lean: 0.04 };
  P.stretch = { l: [-0.3, L + 1.12, 0.0, 0], r: [0.3, L + 1.12, 0.0, 0], lean: -0.14, pitch: -0.18, shrug: 0.3 };
  P.offer = { l: [-0.08, 0.62, 0.33, 0], r: [0.3, 0.68, 0.36, 0], lean: 0.08, yaw: 0.5, fob: 1 };
  P.offer2 = { l: [-0.08, 0.62, 0.33, 0], r: [0.62, 0.8, 0.85, 0], lean: 0.15, yaw: 0.6, fob: 1 };
  P.hold = { l: [-0.21, L + 0.38, 0.03, 0], r: [0.2, L + 0.6, 0.3, 0], fob: 1 };
  P.spin = { l: [-0.2, 1.0, 0.28, 0], r: [0.13, 0.42, 0.18, 0], lean: 0.02 };
  return P;
}

function makeBig(seated) {
  const name = seated ? 'gas' : 'ga';
  let jacketOnly = null, capG = null, glows = [], bodyRef = null, headRef = null;
  const decorate = ({ rig, body, head, R, L, hipY, hairM, skinM }) => {
    bodyRef = body; headRef = head;
    const teal = std('#18b3a6', { roughness: 0.7 }), tealD = std('#0e8278', { roughness: 0.7 }), jk = std('#c9284a', { roughness: 0.85 }), jk2 = std('#f2e3c4', { roughness: 0.8 });
    // ---- cap: dome + a band + a visor (the whole group tilts forward over the face with capDown) ----
    capG = new THREE.Group(); head.add(capG); capG.position.set(0, 0.085, -0.012);
    mesh(new THREE.SphereGeometry(R * 1.1, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), teal, [0, 0, 0], capG, { rot: [-0.18, 0, 0] });
    mesh(new THREE.TorusGeometry(R * 1.07, 0.012, 8, 36), tealD, [0, 0.0, 0.0], capG, { rot: [Math.PI / 2 - 0.18, 0, 0], cast: false });
    const visor = mesh(new THREE.CylinderGeometry(R * 1.06, R * 1.0, 0.016, 28, 1, false, -1.07, 2.14), tealD, [0, 0, 0], capG); visor.scale.set(1, 1, 1.0); visor.position.set(0, -0.012, 0.045); visor.rotation.set(0.05, 0, 0);
    mesh(new THREE.SphereGeometry(0.014, 10, 8), tealD, [0, R * 1.1 - 0.018, 0.0], capG, { cast: false });
    // ---- eyes that light up (gold, additive) ----
    const P = V(), gt = glowTex();
    glows = [-1, 1].map((s) => { onHead(R, s * 19.5, 4, 1.075, P); const m = mesh(new THREE.CircleGeometry(0.03, 24), new THREE.MeshBasicMaterial({ map: gt, color: new THREE.Color(3.4, 2.4, 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [P.x, P.y, P.z], head, { cast: false, recv: false });
      m.quaternion.setFromUnitVectors(V(0, 0, 1), P.clone().normalize()); m.userData.noOutline = true; m.userData.noClip = true; return m; });
    // ---- jacket: an open shell over the torso + two sleeves; hidden by fx jacket ----
    const sx = 0.118 + 0.01 * 1.5, zs = 0.82 * lerp(1, 1.5, 0.5), pts = []; for (let i = 0; i <= 10; i++) { const y = lerp(0.3 + 0.02, 0.74, i / 10); pts.push(new THREE.Vector2(rAt(y) + 0.022, y - 0.3)); }
    const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 28, 0.42, Math.PI * 2 - 0.84), jk); shell.material.side = THREE.DoubleSide; shell.position.set(0, hipY, 0); shell.scale.set(1.5, 1, zs); shell.castShadow = true; body.add(shell);
    const rib = mesh(new THREE.TorusGeometry(0.148, 0.02, 8, 30, Math.PI * 2 - 0.9), jk2, [0, hipY + 0.012, 0], body, { rot: [Math.PI / 2, 0, -0.45 + Math.PI / 2 * 0], cast: false }); rib.scale.set(1.5, 0.82 * 1.2, 1); rib.rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.45); rib.rotation.order = 'XYZ';
    const jS = [new Noodle(0.056, jk, body, { taper: 0.9 }), new Noodle(0.056, jk, body, { taper: 0.9 })], jCuff = [-1, 1].map(() => mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 20), jk2, [0, 0, 0], body, { cast: false }));
    const Sx = [V(-sx, 0.675 + L, 0), V(sx, 0.675 + L, 0)], Cc = V(), fobH = makeFob(body), stripeM = jk2;
    // a cream stripe across the chest of the jacket's shell (decor, not a logo)
    const st = new THREE.Mesh(new THREE.LatheGeometry([0.5, 0.56, 0.62].map((y) => new THREE.Vector2(rAt(y + 0.3) + 0.0235, y)), 28, 0.5, Math.PI * 2 - 1.0), stripeM); st.material = stripeM.clone(); st.material.side = THREE.DoubleSide; st.position.set(0, hipY, 0); st.scale.set(1.5, 1, zs); body.add(st);
    jacketOnly = { shell, st, rib, jS, jCuff };
    return { update(p, t, api, H) {
      const jOff = clamp(p.jacket || 0) > 0.5; shell.visible = st.visible = rib.visible = !jOff;
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; jS[i].mesh.visible = jCuff[i].visible = !jOff; if (jOff) continue; const S = Sx[i].clone(); S.y += (p.shrug || 0) * 0.035; armCtrl(S, H[i], 0.37, s, Cc); const sl = jS[i]; sl.set(S, Cc, H[i].clone().lerp(S, 0.0)); const dir = H[i].clone().sub(Cc).normalize(); jCuff[i].position.copy(H[i]).addScaledVector(dir, -0.05); jCuff[i].quaternion.setFromUnitVectors(V(0, 0, 1), dir); }
      const eg = clamp(p.eyeGlow || 0); for (const m of glows) { m.material.opacity = 0.55 * eg * (0.92 + 0.08 * Math.sin(t * 17)); m.scale.setScalar(1 + 0.35 * eg); }
      const cd = clamp(p.capDown || 0); capG.position.set(0, 0.085 - 0.07 * cd, -0.012 + 0.05 * cd); capG.rotation.x = 1.05 * cd;
      // sigh: ONE long breath: the chest comes up for 0.45 of the time, then goes out over 0.55 with the shoulders and head dropping
      const sg = clamp(p.sigh || 0); if (sg > 0 && sg < 1) { const inh = smooth(sg / 0.45), exh = smooth((sg - 0.45) / 0.55); const k = inh * (1 - exh); body.position.y += 0.035 * k; body.rotation.x += -0.1 * k + 0.12 * exh * (1 - smooth((sg - 0.9) / 0.1)); head.rotation.x += 0.14 * exh * (1 - smooth((sg - 0.9) / 0.1)) - 0.08 * k; }
      const tr = clamp(p.tremble || 0); if (tr > 0) { body.position.x += tr * 0.005 * Math.sin(t * 22) * (0.6 + 0.4 * Math.sin(t * 7)); body.position.y += tr * 0.0015 * Math.sin(t * 27); head.rotation.z += tr * 0.015 * Math.sin(t * 19); }
      const hp = clamp(p.hop || 0); if (hp > 0) { const ph = (t * 4.6) % 1, up = Math.sin(Math.PI * ph); rig.position.y = 0.14 * hp * up; body.rotation.z += 0.07 * hp * Math.sin(Math.PI * 2 * t * 2.3); body.rotation.x += 0.06 * hp * up; } else rig.position.y = 0;
      const fb = Math.round(p.fob || 0); fobH.update(t, { mode: 'hold', led: clamp(p.led || 0), k: fb ? 1 : 0 }); if (fb) fobH.group.position.copy(H[1]).add(V(0, -0.01, 0.0));
    } };
  };
  const api = makePerson({ name, skin: '#d9a47a', hair: 'short', hairColor: '#1c1618', top: '#f4f1ea', pattern: 'plain', bottom: '#2c3a5a', age: 'young', build: 1.5, stand: !seated, lift: seated ? null : 0.38, sleeve: 0.34, brow: '#1c1618', decorate, seed: seated ? 7 : 5 });
  api.poses = poseSet(api.poses, seated ? 0 : 0.38, seated);
  const rig = api.root.children[0]; rig.scale.setScalar(seated ? 1.2 : BIG); api.R = 0.17 * (seated ? 1.2 : BIG); api.headY = (seated ? 0.955 : 0.955 + 0.38) * (seated ? 1.2 : BIG);
  if (seated) rig.position.y = -0.0;   // the car puts the root on the floor of the cockpit
  return api;
}
export const makeGa = () => makeBig(false);
export const makeGas = () => makeBig(true);

// ---------------------------------------------------------------------------------------------------------------------------------
export function makeBongden() {
  const decorate = ({ body, head, R, L }) => {
    const blk = std('#0b0b10', { roughness: 0.8, emissive: '#050c14' });
    const hood = mesh(new THREE.SphereGeometry(R * 1.2, 32, 24), blk, [0, 0.0, -0.02], head); hood.scale.set(1, 1.04, 1.02);
    // a round hood that follows the head (no point, no ears): a rolled cuff all round just above the brow, like a beanie / hood rim
    mesh(new THREE.TorusGeometry(0.197, 0.02, 10, 40), blk, [0, 0.06, -0.012], head, { rot: [Math.PI / 2 - 0.12, 0, 0], scale: [1, 1.05, 1] });
    mesh(new THREE.TorusGeometry(0.1, 0.034, 10, 20), blk, [0, -0.15, -0.0], head, { rot: [1.35, 0, 0] });
    for (const m of head.children) if (m.isMesh && m !== hood && m.material !== blk && !m.userData.keep) m.visible = false;   // face plate, hair, glasses: all hidden under the hood (no face at all)
    const fob = makeFob(body, { len: 0.2 });
    return { update(p, t, api, H) { fob.update(t, { mode: 'spin', led: 1, k: 1 }); fob.group.position.copy(H[0]).add(V(0.0, 0.03, 0.0)); } };
  };
  const api = makePerson({ name: 'bongden', skin: '#6a5348', hair: 'short', hairColor: '#0b0b10', top: '#0f0f16', pattern: 'plain', bottom: '#0f0f16', age: 'young', build: 1.25, stand: false, sleeve: 1, decorate, seed: 11 });
  api.poses = poseSet(api.poses, 0, true); return api;
}
export const GA_CHARS = { ga: makeGa, gas: makeGas, bongden: makeBongden };
