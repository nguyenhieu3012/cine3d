// Trà đá với AI, "Tèo vào GTA 6" part 2 NEW (gta6p2b, 20/11): Tèo's PUMP-UP body, bánh mì, barbell, key fob and belt. OFF unless castOpts teo: { p2b: true } (then chars.js calls the hooks below; nothing else of Tèo changes:
// the head, the face, the eyes, the glasses and the legs are NOT touched, only the body parts are scaled / added). Numbers come from the pose / fx (all 0..1 unless noted):
//   bChest bShoulder bArm bBelly   the four inflations (chest, shoulders, arms, belly); legs stay stick-thin
//   button   0..1 the cream button on the belly pops off and flies (an arc, 0.5 s)
//   loaf     0..5 loaves eaten (a ramp); eat 0..1 = the eating pose weight (the right hand feeds him, the left holds the paper bag); chew 0..1 = the mouth chews
//   bar      0..1 the barbell is in both hands (curl = 0..1 the lift); hang 0..1 = both hands up on the pull-up bar position (arms straight up)
//   fob      0 | 1 hand | 2 belt (the belt and the hook show), led 0..1 (the red blink level)
//   wob      0..1 the stick legs wobble sideways, buckle 0..1 the knees give (the hips drop)
import * as THREE from 'three';
import { clamp, lerp, smooth, hash, std, mesh, ball, V } from '../../core/util.js';
import { kneeCtrl } from '../../core/rig.js';
import { makeFob, makeBread, makeBarbell } from './gta_p2b_props.js';

export function makeTeoP2b({ body, torso, cloth, cloth2, skin, S0, sleeves, cuffs, hands, head, hug = false }) {   // hug (castOpts teo.p2b = 'hug', gta6p3b 21/11): the belt hugs the inflated waist instead of standing out like a hoop
  // belly (a sphere that grows), shoulder balls, the popping button
  const belly = mesh(new THREE.SphereGeometry(1, 28, 20), cloth, [0, 0.42, 0.05], body); belly.visible = false;
  const delt = [-1, 1].map((s) => { const m = mesh(new THREE.SphereGeometry(1, 22, 16), cloth, [s * 0.16, 0.66, 0], body); m.visible = false; return m; });
  const btnM = new THREE.MeshStandardMaterial({ color: '#fff4dc', roughness: 0.35, emissive: '#ffe9b8', emissiveIntensity: 0.35 });
  const button = mesh(new THREE.SphereGeometry(0.02, 14, 10), btnM, [0, 0.47, 0.3], body); button.scale.set(1, 1, 0.55); button.visible = false;
  for (const dy of [0.1, -0.1]) { const b2 = mesh(new THREE.SphereGeometry(0.02, 12, 8), btnM, [0, 0.47 + dy, 0.3], body); b2.scale.set(1, 1, 0.55); b2.visible = false; button.userData['b' + dy] = b2; }
  // belt + hook (shown with fob 2)
  const beltM = std('#3a2a22', { roughness: 0.6 }), belt = new THREE.Group(); body.add(belt); belt.visible = false;
  mesh(new THREE.TorusGeometry(0.17, 0.014, 8, 40), beltM, [0, 0.335, 0], belt, { rot: [Math.PI / 2, 0, 0], scale: [1, 0.84, 1] }); mesh(new THREE.BoxGeometry(0.05, 0.04, 0.012), new THREE.MeshStandardMaterial({ color: '#ffc43a', metalness: 0.8, roughness: 0.3 }), [0, 0.335, 0.153], belt, { cast: false });
  const hook = new THREE.Group(); belt.add(hook); hook.position.set(-0.155, 0.335, 0.05); mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 12), new THREE.MeshStandardMaterial({ color: '#ffc43a', metalness: 0.8, roughness: 0.3 }), [0, 0, 0], hook, { cast: false });
  const fobH = makeFob(body), fobB = makeFob(hook, { len: 0.12 });
  const bread = makeBread(body), bag = new THREE.Group(); body.add(bag); bag.visible = false;
  mesh(new THREE.BoxGeometry(0.14, 0.2, 0.1), std('#d8b27a', { roughness: 0.9 }), [0, 0, 0], bag, { cast: true }); const lv = [];
  for (let i = 0; i < 5; i++) { const l = makeBread(bag); l.visible = true; l.position.set(-0.04 + i * 0.02, 0.12 + 0.0 * i, 0.0); l.rotation.set(0, 0.2 * i, 1.2 + 0.1 * i); l.scale.setScalar(0.85); lv.push(l); }
  const bar = makeBarbell(body);
  const P = V(), Q = V();
  return {
    // scale the torso; returns nothing (torso.scale is set by the caller every frame, we multiply)
    torso(p, t) {
      const bC = clamp(p.bChest || 0), bS = clamp(p.bShoulder || 0), bA = clamp(p.bArm || 0), bB = clamp(Math.max(p.bBelly || 0, 0)), br = Math.sin(t * 1.9);
      torso.scale.x *= 1 + 0.52 * bC + 0.14 * bS + 0.18 * bB; torso.scale.z *= 1 + 0.38 * bC + 0.3 * bB; torso.scale.y *= 1 + 0.07 * bC + 0.03 * bS;
      { const sx = hug ? 1 + 0.52 * bC + 0.14 * bS + 0.18 * bB + 0.1 * bB : 1 + 0.66 * bB + 0.32 * bC, sz = hug ? lerp(1, 0.86 * (1 + 0.38 * bC + 0.3 * bB) + 0.08 * bB, clamp(Math.max(bC, bS, bB))) : 1 + 0.95 * bB + 0.42 * bC; belt.scale.set(sx, 1, sz); hook.scale.set(1 / sx, 1, 1 / sz); }   // the belt follows the inflated waist (the fob hangs from it undistorted)
      belly.visible = bB > 0.02; if (belly.visible) { belly.scale.set(0.155 + 0.13 * bB, 0.1 + 0.11 * bB, 0.15 + 0.12 * bB); belly.position.set(0, 0.42 - 0.01 * bB, 0.03 + 0.03 * bB + 0.003 * br * bB); }
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1, m = delt[i]; m.visible = bS > 0.02; if (m.visible) { m.scale.setScalar(0.045 + 0.085 * bS); m.scale.y *= 0.92; m.position.set(s * (S0[i].x * s * (1 + 0.95 * bS + 0.35 * bC) + 0.012), 0.665 + 0.012 * bS, 0); } }
      // the button: sits on the belly; fx `button` 0..1 pops it off (an arc forward-up, then it falls and rolls out of sight)
      const bt = clamp(p.button || 0), full = bB > 0.5; button.visible = full && bt < 1; const front = 0.03 + 0.03 * bB + 0.15 + 0.12 * bB + 0.012;
      for (const [k, dy] of [[button, 0.0], [button.userData['b0.1'], 0.1], [button.userData['b-0.1'], -0.1]]) { const first = dy === 0; const u = first ? bt : 0; k.visible = full && (first ? bt < 0.995 : true);
        if (first && bt > 0) { const T = bt; k.position.set(0.02 * T, 0.47 + 0.55 * T - 1.4 * T * T, front + 0.3 + 0.9 * T); k.rotation.set(T * 12, 0, T * 9); } else { k.position.set(0, 0.47 + dy * (0.55 + 0.45 * bB), front); k.rotation.set(0, 0, 0); } void u; }
    },
    arm(i, s, S, Hi, sl, cf, p, t) {
      const bC = clamp(p.bChest || 0), bS = clamp(p.bShoulder || 0), bA = clamp(p.bArm || 0), eat = clamp(p.eat || 0), bar_ = clamp(p.bar || 0), hang = clamp(p.hang || 0);
      S.x = s * (Math.abs(S.x) * (1 + 0.95 * bS + 0.35 * bC)); sl.r = 0.04 * (1 + 1.55 * bA + 0.25 * bS); cf.scale.setScalar(1 + 0.1 * bA); hands[i].scale.setScalar(1 + 0.35 * bA);
      if (eat > 0) { const u = ((p.loaf || 0) % 1 + 1) % 1, L = i === 0;
        if (!L) { const reach = smooth(u / 0.22), up = smooth((u - 0.2) / 0.28), back = smooth((u - 0.7) / 0.28), mouth = V(0.01, 0.84, 0.19 + 0.02 * Math.sin(t * 14) * up), pick = V(0.17, 0.55, 0.28);   // bag hand (left) is at x -0.1; the right hand goes to the bag, then up to the mouth
          const tgt = pick.clone().lerp(mouth, up * (1 - back)); tgt.y += 0.02 * Math.sin(t * 13) * up * (1 - back); Hi.lerp(tgt, eat); void reach; }
        else Hi.lerp(V(-0.1, 0.5, 0.3), eat); }
      if (bar_ > 0) { const curl = clamp(p.curl || 0), y = lerp(0.46, 0.8, smooth(curl)); Hi.lerp(V(s * 0.19, y, 0.27 + 0.05 * Math.sin(curl * Math.PI)), bar_); }
      if (hang > 0) Hi.lerp(V(s * 0.19, 1.36 + 0.1 * clamp(p.pull || 0), 0.14), hang);
    },
    talk(p, t) { const ch = clamp(p.chew || 0); return Math.max(p.talk || 0, ch * (0.35 + 0.65 * Math.abs(Math.sin(t * 11)))); },
    legs(LR, p, t) {   // the stick legs wobble sideways and the knees give (the hips drop); called before the legs are placed
      const wob = clamp(p.wob || 0), bk = clamp(p.buckle || 0); if (wob <= 0 && bk <= 0) return;
      LR.dy -= 0.2 * bk;
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1, H = LR.H[i], A = LR.A[i]; H.y -= 0.2 * bk; A.x += s * 0.035 * wob * Math.sin(t * 13 + i * 2.1) + 0.02 * wob * Math.sin(t * 7.3 + i); A.z += 0.03 * bk;
        const len = 0.61 * (1 + 0.04 * (LR.cr || 0)); LR.C[i] = kneeCtrl(H, A, len, new THREE.Vector3(), LR.K[i]); LR.C[i].x += s * (0.09 * wob * Math.sin(t * 12 + i * 3.0) - 0.05 * bk) + 0.03 * wob * Math.sin(t * 17 + i); LR.C[i].z += 0.1 * bk; }
      LR.roll += 0.1 * wob * Math.sin(t * 6.2); LR.lean += 0.08 * bk;
    },
    update(p, t, Hr, Hl, R) {   // props (called once per frame, after the arms are placed): hands in the body frame
      const eat = clamp(p.eat || 0), u = ((p.loaf || 0) % 1 + 1) % 1, loaf = p.loaf || 0;
      bag.visible = eat > 0.3; if (bag.visible) { bag.position.copy(Hl).add(V(0.0, 0.05, 0.0)); bag.rotation.set(0.15, 0.2, 0.05); for (let k = 0; k < 5; k++) lv[k].visible = k >= Math.floor(loaf + 1e-6) + 0; }
      bread.visible = eat > 0.3 && loaf < 5 - 1e-3; if (bread.visible) { const shrink = 1 - smooth((u - 0.5) / 0.22), grow = smooth(u / 0.1); bread.position.copy(Hr).add(V(0.0, 0.0, 0.03)); bread.rotation.set(0.0, 0.3, 0.6 + 0.3 * smooth((u - 0.2) / 0.3)); bread.scale.setScalar(Math.max(0.001, shrink * grow) * 0.95); }
      const br_ = clamp(p.bar || 0); bar.visible = br_ > 0.3; if (bar.visible) { P.copy(Hr).add(Hl).multiplyScalar(0.5); bar.position.copy(P).add(V(0, 0.0, 0.03)); bar.rotation.set(0, 0, 0); bar.scale.setScalar(smooth((br_ - 0.3) / 0.4)); }
      const fb = Math.round(p.fob || 0), led = clamp(p.led || 0);
      belt.visible = fb === 2; fobH.update(t, { mode: 'hold', led, k: fb === 1 ? 1 : 0 }); if (fb === 1) fobH.group.position.copy(Hr).add(V(0.0, -0.02, 0.02));
      fobB.update(t, { mode: 'belt', led, k: fb === 2 ? 1 : 0 });
    },
  };
}
