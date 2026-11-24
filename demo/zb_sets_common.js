// shared by the Zombie set look tests: stand-in zombies (1.6 m, grey-green capsules) placed on a set's marks, and a shot-list helper
import * as THREE from 'three';
export const shotsFrom = (list) => { const out = []; let t = 0; for (const [d, free, o] of list) { out.push({ t0: t, t1: t + d, cam: 'free' + out.length, free, hold: true, ...(o || {}) }); t += d; } return out; };   // cam names differ ('free0', 'free1'...) so QA's same-framing check is happy; the free block decides the picture
export function standIns(marks, { color = '#6f8f6a', scale = 1 } = {}) {
  return ({ scene, set }) => {
    const g = new THREE.Group(); scene.add(g); const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 }), skin = new THREE.MeshStandardMaterial({ color: '#8fb48a', roughness: 0.7 });
    for (const m of marks) { const s = typeof m === 'string' ? set.seats[m] : m; if (!s) continue; const f = new THREE.Group(); f.position.set(...s.pos); f.rotation.y = s.yaw || 0; f.scale.setScalar(scale); g.add(f);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.0, 14), mat); b.position.y = 0.75; b.castShadow = true; f.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin); h.position.y = 1.43; h.castShadow = true; f.add(h);
      for (const x of [-0.07, 0.07]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8), mat); l.position.set(x, 0.27, 0); f.add(l); }
      for (const x of [-0.28, 0.28]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), skin); a.position.set(x, 1.0, 0.25); a.rotation.x = -1.3; f.add(a); } }
    return { update() {} };
  };
}
