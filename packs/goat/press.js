// GOAT Beef set: POST-MATCH PRESS / LIVE BROADCAST STUDIO — crisp sports-network desk for news & tier-list videos.
// Uses the exact same seat geometry as bar.js so every camera token, pose, and prop works out of the box.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hash, canvasTex, grain, std, emis, mesh, box, cyl, ball } from '../../core/util.js';
import { contactBlob } from '../../core/rig.js';

const FONT = (px, w = 900) => `${w} ${px}px Display, sans-serif`;
const BZ = -3.6, XL = -4.6, XR = 4.6, HC = 3.8;

export function buildPress(scene, opts = {}) {
  const g = new THREE.Group(); g.name = 'press'; scene.add(g);
  const navy = std('#0e172a', { roughness: 0.72 });
  const darkMetal = std('#1c2230', { roughness: 0.38, metalness: 0.65 });
  const chrome = std('#cfd6e0', { roughness: 0.2, metalness: 0.92 });

  // Glossy dark studio floor with subtle light reflection
  const floorT = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#0c111e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(110,160,255,0.08)'; c.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      c.beginPath(); c.moveTo(i * w / 8, 0); c.lineTo(i * w / 8, h); c.stroke();
      c.beginPath(); c.moveTo(0, i * h / 8); c.lineTo(w, i * h / 8); c.stroke();
    }
    grain(c, w, h, 6000, 0.04, 3, 2);
  }, { repeat: [5, 7] });
  mesh(new THREE.PlaneGeometry(XR - XL, 15.6), new THREE.MeshPhysicalMaterial({ map: floorT, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 }), [0, 0, (BZ + 12) / 2], g, { cast: false, rot: [-Math.PI / 2, 0, 0] });

  // Back wall: studio sponsor / acoustic grid backdrop
  const backT = canvasTex(2048, 1024, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#131d36'); gr.addColorStop(0.5, '#0b1224'); gr.addColorStop(1, '#19132c');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    // Diagonal subtle studio stripes
    c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 14;
    for (let x = -h; x < w + h; x += 90) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + h * 0.5, h); c.stroke(); }
    // Subtle watermark repeating pattern (kept calm behind heads)
    c.fillStyle = 'rgba(255,255,255,0.04)'; c.font = FONT(42); c.textAlign = 'center';
    for (let r = 0; r < 6; r++) for (let k = 0; k < 8; k++) c.fillText('GOAT BEEF', 140 + k * 255 + (r % 2) * 120, 120 + r * 165);
    grain(c, w, h, 16000, 0.04, 4, 2);
  });
  mesh(new THREE.PlaneGeometry(XR - XL, HC), std('#ffffff', { map: backT, roughness: 0.8 }), [0, HC / 2, BZ], g, { cast: false });
  mesh(new THREE.PlaneGeometry(15.6, HC), navy, [XL, HC / 2, (BZ + 12) / 2], g, { cast: false, rot: [0, Math.PI / 2, 0] });
  mesh(new THREE.PlaneGeometry(15.6, HC), navy, [XR, HC / 2, (BZ + 12) / 2], g, { cast: false, rot: [0, -Math.PI / 2, 0] });
  mesh(new THREE.PlaneGeometry(XR - XL, 15.6), std('#090d18', { roughness: 0.9 }), [0, HC, (BZ + 12) / 2], g, { cast: false, rot: [Math.PI / 2, 0, 0] });

  // Vertical LED studio pillars (red on Ron's left, sky-blue on Leo's right)
  for (const [px, col] of [[-2.6, '#ff3545'], [-1.45, '#ff3545'], [1.45, '#4ac4ff'], [2.6, '#4ac4ff']]) {
    box(0.08, HC - 0.3, 0.08, darkMetal, [px, HC / 2, BZ + 0.06], g, { cast: false });
    box(0.03, HC - 0.5, 0.02, emis(col, 1.9), [px, HC / 2, BZ + 0.105], g, { cast: false, recv: false });
  }

  // Main upper studio screen / banner ("GOAT BEEF LIVE")
  const signT = canvasTex(1024, 320, (c, w, h) => {
    c.fillStyle = '#090e1c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#384b7a'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16);
    // Red left & blue right accent bars
    c.fillStyle = '#ff3545'; c.fillRect(20, 20, 24, h - 40);
    c.fillStyle = '#4ac4ff'; c.fillRect(w - 44, 20, 24, h - 40);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffffff'; c.font = FONT(112); c.fillText(opts.headline || 'GOAT BEEF LIVE', w / 2, 128);
    c.fillStyle = '#ffe45a'; c.font = FONT(52, 800); c.fillText(opts.subline || 'POST-MATCH ROAST DESK', w / 2, 236);
  });
  box(2.7, 0.86, 0.08, darkMetal, [0, 2.72, BZ + 0.06], g, { cast: false });
  mesh(new THREE.PlaneGeometry(2.58, 0.78), std('#ffffff', { map: signT, emissive: '#ffffff', emissiveMap: signT, emissiveIntensity: 0.95, roughness: 0.35 }), [0, 2.72, BZ + 0.11], g, { cast: false });

  // Glowing red ON AIR box above the screen
  const airT = canvasTex(256, 96, (c, w, h) => {
    c.fillStyle = '#c81624'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = FONT(54); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ON AIR', w / 2, h / 2 + 4);
  });
  const airM = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: airT, emissiveIntensity: 1.6, roughness: 0.5 });
  box(0.56, 0.22, 0.08, darkMetal, [0, 3.34, BZ + 0.08], g, { cast: false });
  mesh(new THREE.PlaneGeometry(0.5, 0.18), airM, [0, 3.34, BZ + 0.125], g, { cast: false });

  // Sleek broadcast desk (back edge at z = 0.39 so seated hand swings never clip the desk)
  const TZ = 0.66, desk = new THREE.Group(); desk.position.set(0, 0, TZ); g.add(desk);
  const topM = new THREE.MeshPhysicalMaterial({ color: '#141a2b', roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.15 });
  mesh(new RoundedBoxGeometry(1.78, 0.06, 0.54, 4, 0.018), topM, [0, 0.88, 0], desk);
  box(1.62, 0.84, 0.44, darkMetal, [0, 0.43, 0], desk);
  // Bright dual LED team strips on front edge + glowing front studio panel
  box(0.78, 0.036, 0.024, emis('#ff3545', 1.8), [-0.43, 0.83, 0.315], desk, { cast: false, recv: false });
  box(0.78, 0.036, 0.024, emis('#4ac4ff', 1.8), [0.43, 0.83, 0.315], desk, { cast: false, recv: false });
  const deskLogoT = canvasTex(512, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#3a0e16'); gr.addColorStop(0.5, '#101628'); gr.addColorStop(1, '#0e2840');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffffff'; c.font = FONT(84); c.fillText('GOAT BEEF', w / 2, 110);
    c.fillStyle = '#ffe45a'; c.font = FONT(36, 800); c.fillText('LIVE ROAST SHOW', w / 2, 188);
  });
  mesh(new THREE.PlaneGeometry(1.12, 0.54), std('#ffffff', { map: deskLogoT, emissive: '#ffffff', emissiveMap: deskLogoT, emissiveIntensity: 0.65, roughness: 0.3 }), [0, 0.46, 0.258], desk, { cast: false });
  contactBlob(2.15, 1.0, desk, [0, 0.006, 0], 0.55);

  // Dual broadcast microphones + water mugs
  const studioMic = (x, col) => {
    const m = new THREE.Group(); m.position.set(x, 0.91, -0.08); desk.add(m);
    cyl(0.048, 0.055, 0.024, darkMetal, [0, 0.012, 0], m, {}, 18);
    cyl(0.009, 0.009, 0.2, chrome, [0, 0.11, 0], m, {}, 10);
    mesh(new RoundedBoxGeometry(0.046, 0.075, 0.046, 3, 0.014), std(col, { roughness: 0.75 }), [0, 0.23, 0], m);
  };
  studioMic(-0.44, '#c8202c'); studioMic(0.44, '#2478b8');

  // Studio swivel stools at exact bar.js seats
  for (const [x, col] of [[-0.45, '#b82028'], [0.45, '#2272b8']]) {
    const s = new THREE.Group(); s.position.set(x, 0, 0); s.rotation.y = x < 0 ? 0.3 : -0.3; g.add(s);
    cyl(0.2, 0.2, 0.06, std(col, { roughness: 0.4 }), [0, 0.66, 0], s, {}, 24);
    cyl(0.03, 0.035, 0.64, chrome, [0, 0.32, 0], s, {}, 14);
    cyl(0.22, 0.24, 0.025, chrome, [0, 0.0125, 0], s, {}, 24);
    contactBlob(0.85, 0.85, s, [0, 0.005, 0], 0.55);
  }

  // Studio fill lights (red left, blue right, clean white overhead)
  const lL = new THREE.PointLight('#ff4a5a', 6, 8, 2); lL.position.set(-2.3, 2.2, BZ + 1.2); g.add(lL);
  const lR = new THREE.PointLight('#4ac4ff', 6, 8, 2); lR.position.set(2.3, 2.2, BZ + 1.2); g.add(lR);
  const lTop = new THREE.PointLight('#eef4ff', 2.8, 7, 2); lTop.position.set(0, 2.5, TZ + 0.1); g.add(lTop);

  return {
    group: g, light: 'pub', lightAt: [0, 1.15, 0.2],
    seats: { ron: { pos: [-0.45, 0.42, 0], yaw: 0.3 }, leo: { pos: [0.45, 0.42, 0], yaw: -0.3 } },
    look: { exposure: 1.0, bloom: [0.3, 0.55, 1.05], env: 0.28, grade: { contrast: 1.08, sat: 1.22, vig: 0.24, grain: 0.01, shadowTint: [0.006, 0.01, 0.024], hiTint: [0.02, 0.02, 0.03] } },
    tune(lights) {
      lights.key.position.set(-0.8, 2.55, 1.95); lights.key.color.set('#fff6eb'); lights.key.intensity = 22; lights.hemi.intensity = 0.22;
      lights.rim.position.set(1.9, 2.4, -1.5); lights.rim.color.set('#58c4ff'); lights.rim.intensity = 44;
      lights.kick.position.set(-1.9, 2.4, -1.5); lights.kick.color.set('#ff5262'); lights.kick.intensity = 34;
      scene.fog = new THREE.FogExp2('#0b1020', 0.015);
    },
    update(t) {
      airM.emissiveIntensity = 1.45 + 0.25 * Math.sin(t * 3.8);
    },
  };
}
