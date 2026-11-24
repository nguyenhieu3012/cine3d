// GOAT Beef set: THE GOAT COURT — rich mahogany courtroom for debate trials & 16:9 long-form episodes.
// Uses the exact same seat geometry as bar.js so every camera token, pose, and prop works out of the box.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hash, canvasTex, grain, std, emis, mesh, box, cyl, ball } from '../../core/util.js';
import { contactBlob } from '../../core/rig.js';

const FONT = (px, w = 900) => `${w} ${px}px Display, sans-serif`;
const BZ = -3.6, XL = -4.6, XR = 4.6, HC = 3.9;

function mahoganyTex(base = '#3e1f12') {
  return canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const cols = 6, pw = w / cols;
    for (let i = 0; i < cols; i++) {
      const k = hash(i * 4.3 + 2);
      c.fillStyle = `rgba(${k > 0.5 ? '255,190,120' : '0,0,0'},${0.04 + k * 0.06})`;
      c.fillRect(i * pw, 0, pw, h);
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 4;
      c.strokeRect(i * pw + 10, 18, pw - 20, h - 36);
      c.strokeStyle = 'rgba(218,175,85,0.16)'; c.lineWidth = 2;
      c.strokeRect(i * pw + 22, 30, pw - 44, h - 60);
    }
    grain(c, w, h, 14000, 0.06, 6, 3);
  });
}

export function buildCourt(scene, opts = {}) {
  const g = new THREE.Group(); g.name = 'court'; scene.add(g);
  const woodTex = mahoganyTex('#3c1e12');
  const wallM = std('#ffffff', { map: woodTex, roughness: 0.62 });
  const darkWood = std('#28130a', { roughness: 0.52 });
  const trimWood = std('#562c18', { roughness: 0.48 });
  const brass = std('#dfb24a', { roughness: 0.24, metalness: 0.88 });
  const crimson = std('#6e141c', { roughness: 0.85 });

  // Floor: polished dark parquet + crimson runner carpet down the center
  const floorTex = canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#331c10'; c.fillRect(0, 0, w, h);
    const rows = 16, ph = h / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < 6; i++) {
        const k = hash(i * 5.1 + j * 9.7);
        c.fillStyle = `hsl(${20 + k * 8}, ${36 + k * 10}%, ${13 + k * 7}%)`;
        c.fillRect(i * (w / 6) + 2, j * ph + 2, w / 6 - 4, ph - 4);
      }
    }
    grain(c, w, h, 12000, 0.06, 3, 2);
  }, { repeat: [4, 6] });
  mesh(new THREE.PlaneGeometry(XR - XL, 15.6), new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45 }), [0, 0, (BZ + 12) / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  mesh(new THREE.PlaneGeometry(2.1, 12.0), crimson, [0, 0.004, 0.6], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });
  for (const sx of [-1.03, 1.03]) mesh(new THREE.PlaneGeometry(0.06, 12.0), brass, [sx, 0.006, 0.6], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });

  // Walls & coffered ceiling
  mesh(new THREE.PlaneGeometry(XR - XL, HC), wallM, [0, HC / 2, BZ], g, { cast: false });
  mesh(new THREE.PlaneGeometry(15.6, HC), wallM, [XL, HC / 2, (BZ + 12) / 2], g, { cast: false, rot: [0, Math.PI / 2, 0] });
  mesh(new THREE.PlaneGeometry(15.6, HC), wallM, [XR, HC / 2, (BZ + 12) / 2], g, { cast: false, rot: [0, -Math.PI / 2, 0] });
  mesh(new THREE.PlaneGeometry(XR - XL, 15.6), std('#20110a', { roughness: 0.85 }), [0, HC, (BZ + 12) / 2], g, { cast: false, rot: [Math.PI / 2, 0, 0] });

  // Classical pilasters along the back wall
  for (const px of [-3.6, -2.0, 2.0, 3.6]) {
    box(0.28, HC, 0.2, trimWood, [px, HC / 2, BZ + 0.1], g, { cast: false });
    box(0.36, 0.14, 0.26, brass, [px, HC - 0.12, BZ + 0.12], g, { cast: false });
    box(0.36, 0.22, 0.26, darkWood, [px, 0.11, BZ + 0.12], g, { cast: false });
  }

  // Judge's elevated bench in the background (z = -2.55)
  const bench = new THREE.Group(); bench.position.set(0, 0, -2.55); g.add(bench);
  box(3.4, 0.28, 1.3, darkWood, [0, 0.14, 0], bench, { cast: false });
  box(3.1, 1.15, 0.75, trimWood, [0, 0.85, 0.22], bench);
  box(3.26, 0.08, 0.9, darkWood, [0, 1.46, 0.22], bench);
  box(2.7, 0.03, 0.04, brass, [0, 1.18, 0.6], bench, { cast: false });
  // Brass scales of justice + gavel on judge's bench
  cyl(0.08, 0.1, 0.04, brass, [-0.55, 1.52, 0.22], bench, {}, 18);
  cyl(0.015, 0.02, 0.36, brass, [-0.55, 1.71, 0.22], bench, {}, 12);
  box(0.38, 0.018, 0.018, brass, [-0.55, 1.88, 0.22], bench);
  for (const dx of [-0.18, 0.18]) cyl(0.06, 0.04, 0.02, brass, [-0.55 + dx, 1.72, 0.22], bench, {}, 16);
  // Gavel & sound block
  cyl(0.09, 0.1, 0.04, darkWood, [0.55, 1.52, 0.25], bench, {}, 18);
  cyl(0.032, 0.032, 0.14, trimWood, [0.55, 1.59, 0.25], bench, { rot: [0, 0.4, Math.PI / 2] }, 14);
  cyl(0.011, 0.013, 0.24, darkWood, [0.44, 1.57, 0.32], bench, { rot: [0.2, 0.4, Math.PI / 2] }, 10);

  // Back-wall glowing crest: "THE GOAT COURT" (above head height)
  const crestT = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#180c08'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e8bd55'; c.lineWidth = 18; c.strokeRect(20, 20, w - 40, h - 40);
    c.strokeStyle = 'rgba(232,189,85,0.4)'; c.lineWidth = 6; c.strokeRect(42, 42, w - 84, h - 84);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffd978'; c.font = FONT(84); c.fillText(opts.bannerTop || 'THE', w / 2, 128);
    c.fillStyle = '#fff5d6'; c.font = FONT(148); c.fillText(opts.bannerMain || 'GOAT COURT', w / 2, 274);
    c.fillStyle = '#e8bd55'; c.font = FONT(52, 800); c.fillText(opts.bannerSub || 'RONALDO vs MESSI · FINAL VERDICT', w / 2, 405);
  });
  box(2.35, 1.2, 0.08, darkWood, [0, 2.75, BZ + 0.06], g, { cast: false });
  mesh(new THREE.PlaneGeometry(2.2, 1.1), std('#ffffff', { map: crestT, emissive: '#ffffff', emissiveMap: crestT, emissiveIntensity: 0.55, roughness: 0.45 }), [0, 2.75, BZ + 0.11], g, { cast: false });

  // Warm wall sconces (left & right of the crest)
  const bulbs = [];
  for (const sx of [-2.0, 2.0]) {
    box(0.12, 0.28, 0.08, brass, [sx, 2.45, BZ + 0.22], g, { cast: false });
    const b = ball(0.085, emis('#ffdfa6', 3.4), [sx, 2.6, BZ + 0.3], g, { cast: false, recv: false }, 14);
    b.userData.base = 3.4; bulbs.push(b);
    const l = new THREE.PointLight('#ffbe70', 5.5, 8, 2); l.position.set(sx, 2.55, BZ + 0.65); g.add(l);
  }

  // Counsel table in front of Ron & Leo (back edge at z = 0.39 so seated hand swings never clip the desk)
  const TZ = 0.66, desk = new THREE.Group(); desk.position.set(0, 0, TZ); g.add(desk);
  const deskTop = new THREE.MeshPhysicalMaterial({ color: '#3b1e10', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  mesh(new RoundedBoxGeometry(1.72, 0.06, 0.54, 4, 0.015), deskTop, [0, 0.88, 0], desk);
  box(1.56, 0.84, 0.44, trimWood, [0, 0.43, 0], desk);
  // Red accent strip (Ron's side) + Sky-blue accent strip (Leo's side) on desk front + gold seal plaque
  box(0.72, 0.04, 0.02, emis('#ff3d47', 1.2), [-0.42, 0.81, 0.255], desk, { cast: false });
  box(0.72, 0.04, 0.02, emis('#56c3ff', 1.2), [0.42, 0.81, 0.255], desk, { cast: false });
  const sealT = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#241108'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#dfb24a'; c.lineWidth = 10; c.strokeRect(12, 12, w - 24, h - 24);
    c.fillStyle = '#ffd978'; c.font = FONT(72); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('GOAT COURT', w / 2, 108);
    c.fillStyle = '#e8bd55'; c.font = FONT(34, 800); c.fillText('EST. 2026 · ZERO MERCY', w / 2, 184);
  });
  mesh(new THREE.PlaneGeometry(0.92, 0.46), std('#ffffff', { map: sealT, emissive: '#ffffff', emissiveMap: sealT, emissiveIntensity: 0.25, roughness: 0.5 }), [0, 0.46, 0.255], desk, { cast: false });
  contactBlob(2.1, 1.0, desk, [0, 0.006, 0], 0.55);

  // Desk props: two gooseneck courtroom microphones + case folder stacks
  const mic = (x) => {
    const m = new THREE.Group(); m.position.set(x, 0.91, -0.1); desk.add(m);
    cyl(0.045, 0.052, 0.022, std('#18181e', { metalness: 0.7, roughness: 0.35 }), [0, 0.011, 0], m, {}, 16);
    cyl(0.006, 0.007, 0.22, std('#202026', { metalness: 0.8, roughness: 0.3 }), [0, 0.12, -0.02], m, { rot: [-0.25, 0, 0] }, 8);
    ball(0.022, std('#282832', { roughness: 0.8 }), [0, 0.22, -0.055], m, {}, 12);
  };
  mic(-0.42); mic(0.42);
  // Case folders
  box(0.22, 0.028, 0.28, std('#d8c89c', { roughness: 0.8 }), [-0.18, 0.925, 0.04], desk, { rot: [0, 0.14, 0] });
  box(0.22, 0.028, 0.28, std('#cbd8e8', { roughness: 0.8 }), [0.18, 0.925, 0.05], desk, { rot: [0, -0.18, 0] });

  // Two leather courtroom stools/chairs at the exact bar.js seats
  for (const [x, col] of [[-0.45, '#6a181e'], [0.45, '#19385a']]) {
    const s = new THREE.Group(); s.position.set(x, 0, 0); s.rotation.y = x < 0 ? 0.3 : -0.3; g.add(s);
    cyl(0.2, 0.2, 0.06, std(col, { roughness: 0.45 }), [0, 0.66, 0], s, {}, 24);
    cyl(0.035, 0.04, 0.64, darkWood, [0, 0.32, 0], s, {}, 14);
    cyl(0.22, 0.24, 0.03, brass, [0, 0.015, 0], s, {}, 24);
    contactBlob(0.85, 0.85, s, [0, 0.005, 0], 0.55);
  }

  // Overhead courtroom chandelier / pendant light
  const lMain = new THREE.PointLight('#ffd296', 3.4, 8, 2); lMain.position.set(0, 2.35, TZ); g.add(lMain);
  const lCrest = new THREE.PointLight('#ffcf78', 4.5, 6, 2); lCrest.position.set(0, 3.1, BZ + 1.1); g.add(lCrest);

  return {
    group: g, light: 'pub', lightAt: [0, 1.15, 0.2],
    seats: { ron: { pos: [-0.45, 0.42, 0], yaw: 0.3 }, leo: { pos: [0.45, 0.42, 0], yaw: -0.3 } },
    look: { exposure: 1.0, bloom: [0.28, 0.55, 1.08], env: 0.26, grade: { contrast: 1.08, sat: 1.24, vig: 0.26, grain: 0.011, shadowTint: [0.014, 0.007, 0.018], hiTint: [0.035, 0.02, 0.0] } },
    tune(lights) {
      lights.key.position.set(-0.85, 2.6, 1.95); lights.key.intensity = 21; lights.hemi.intensity = 0.2;
      lights.rim.position.set(1.85, 2.5, -1.5); lights.rim.color.set('#ffd996'); lights.rim.intensity = 38;
      lights.kick.position.set(-2.0, 2.3, -1.4); lights.kick.color.set('#ff6a5a'); lights.kick.intensity = 20;
      scene.fog = new THREE.FogExp2('#160d09', 0.016);
    },
    update(t) {
      for (const b of bulbs) b.material.emissiveIntensity = b.userData.base * (1 + 0.02 * Math.sin(t * 7.2));
    },
  };
}
