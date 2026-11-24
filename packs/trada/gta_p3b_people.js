// Trà đá với AI, "Tèo vào GTA 6" part 3 NEW (gta6p3b "Tèo trốn bốn sao?", 21/11): the new people. All OFF unless the episode casts them (cast names `baban`, `hangxom`, `den1`, `den2`, `den3`).
//   baban   = bà bán nước: old woman, conical hat (nón lá), brown blouse, grey bun, stands (a drink seller). Poses: the standing ones of makePerson (`point`, `hips`, `scold`, `wave` ...).
//   hangxom = the neighbour: a heavy man in a white vest (áo ba lỗ) and shorts, round glasses, stands. Poses: `phone` (the phone to his ear), `rest`, `point` ...
//   den1..3 = the group in black: black hoodies, a black hood that hides the WHOLE head (no face, no logo), black gloves-free hands (skin), stand. No weapon.
// The sack (fx `sack` 0..1 on the cast member's HEAD) is made by `makeSack` in gta_p3b_set.js (the set adds it to Tèo's and Bíp's head by itself).
import * as THREE from 'three';
import { std, mesh, cyl, ball } from '../../core/util.js';
import { makePerson } from './people.js';

export function makeBaban() {
  const decorate = ({ head, R }) => {
    const straw = std('#e6c98a', { roughness: 0.9, side: THREE.DoubleSide }), strawD = std('#b8935a', { roughness: 0.9 });
    const hat = new THREE.Group(); head.add(hat); hat.position.set(0, 0.105, -0.01); hat.rotation.x = -0.12;
    mesh(new THREE.ConeGeometry(R * 1.95, R * 1.0, 40, 1, true), straw, [0, R * 0.5, 0], hat);                      // the cone (open below)
    mesh(new THREE.TorusGeometry(R * 1.93, 0.007, 8, 48), strawD, [0, 0.0, 0], hat, { rot: [Math.PI / 2, 0, 0], cast: false });   // the rim ring
    mesh(new THREE.TorusGeometry(R * 1.3, 0.005, 8, 36), strawD, [0, R * 0.32, 0], hat, { rot: [Math.PI / 2, 0, 0], cast: false });
    for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6), std('#c43a4a'), [s * R * 0.92, -0.085, 0.04], head, { rot: [0, 0, 0.1 * s], cast: false });   // the red chin strap
    for (const m of head.children) if (m.isMesh && m.userData.hair) m.visible = true;
    return { update() {} };
  };
  return makePerson({ decorate, name: 'baban', skin: '#d9a07a', hair: 'bun', hairColor: '#c8c6d2', top: '#8a5a32', pattern: 'plain', bottom: '#2a2a3a', age: 'old', build: 0.98, stand: true, lift: 0.34,
    sleeve: 0.55, legFrac: 0.68, shoe: '#e9ddc6', collar: '#f1dcb0', defaultFace: 'happy', color: '#e6c98a', seed: 31, hem: false });
}

export function makeHangxom() {
  return makePerson({ name: 'hangxom', skin: '#cf9a70', hair: 'short', hairColor: '#2a2024', top: '#f4f1ea', pattern: 'plain', bottom: '#4a6a8a', age: 'young', build: 1.18, stand: true, lift: 0.38, glasses: true,
    sleeve: 0.12, shoe: '#c9b896', collar: '#f4f1ea', color: '#cfe3f8', seed: 41, hem: false });
}

export function makeDen(n = 1) {
  const decorate = ({ body, head, R }) => {
    const blk = std('#0a0a0f', { roughness: 0.85, emissive: '#04080e' });
    const hood = mesh(new THREE.SphereGeometry(R * 1.2, 32, 24), blk, [0, 0.0, -0.02], head); hood.scale.set(1, 1.04, 1.02);
    mesh(new THREE.TorusGeometry(0.197, 0.02, 10, 40), blk, [0, 0.06, -0.012], head, { rot: [Math.PI / 2 - 0.12, 0, 0], scale: [1, 1.05, 1] });
    mesh(new THREE.TorusGeometry(0.1, 0.034, 10, 20), blk, [0, -0.15, -0.0], head, { rot: [1.35, 0, 0] });
    mesh(new THREE.SphereGeometry(R * 1.02, 24, 18, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.75), blk, [0, -0.01, 0.03], head, { scale: [1, 1, 1.02], cast: false });   // a dark veil over the face plate: nothing shows
    for (const m of head.children) if (m.isMesh && m.material !== blk && !m.userData.keep) m.visible = false;
    return { update() {} };
  };
  return makePerson({ decorate, name: 'den' + n, skin: '#6a5348', hair: 'short', hairColor: '#0b0b10', top: '#0d0d13', pattern: 'plain', bottom: '#0b0b10', age: 'young', build: [1.2, 1.06, 1.3][n - 1] || 1.15, stand: true, lift: 0.4,
    sleeve: 1, shoe: '#101014', color: '#1a1a22', seed: 50 + n, hem: false });
}
export const P3B_CHARS = { baban: makeBaban, hangxom: makeHangxom, den1: () => makeDen(1), den2: () => makeDen(2), den3: () => makeDen(3) };
