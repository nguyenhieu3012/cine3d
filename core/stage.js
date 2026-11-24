// cine3d core: the renderer and the picture pipeline shared by every channel.
// scene (HDR, MSAA, real shadow maps, image-based light) -> depth of field from real depth -> HDR bloom -> tone map -> grade (contrast, split tone, vignette, grain).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LOOK2, Look2Pass, DOF2, GRADE2, RESOLVE, look2Scene, bloomCastCut } from './look2.js';   // opt-in look2 (21/11): used only when createStage gets `look2`

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

// renders the scene into its own MSAA float target with a depth texture, then hands the colour to the composer chain
class ScenePass extends Pass {
  constructor(scene, camera, w, h, samples = 4) {
    super(); this.scene = scene; this.camera = camera;
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) });
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { t: { value: this.rt.texture } }, vertexShader: VERT, fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }', depthTest: false, depthWrite: false }));
    this.needsSwap = true;
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.copy.render(renderer);
  }
  setSize() {}
}

// depth of field: circle of confusion from the real depth buffer, 48-tap gather on a golden-angle disc; highlights weigh more (bokeh)
const DOF = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, near: { value: 0.1 }, far: { value: 200 }, focus: { value: 3 }, aperture: { value: 0 }, maxBlur: { value: 22 }, res: { value: new THREE.Vector2(1080, 1920) } },
  vertexShader: VERT,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse, tDepth; uniform float near, far, focus, aperture, maxBlur; uniform vec2 res; varying vec2 vUv;
    float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
    float coc(float z){ return min(maxBlur, aperture * abs(1.0 / focus - 1.0 / z)); }
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main(){
      vec4 c0 = texture2D(tDiffuse, vUv);
      if (aperture <= 0.0) { gl_FragColor = c0; return; }
      float z0 = viewZ(vUv), r0 = coc(z0);
      float rot = ign(gl_FragCoord.xy) * 6.2831853;
      vec3 acc = c0.rgb; float wsum = 1.0;
      for (int i = 1; i < 48; i++) {
        float fi = float(i), rr = sqrt(fi / 48.0) * maxBlur, a = fi * 2.39996323 + rot;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * rr / res;
        vec3 s = texture2D(tDiffuse, uv).rgb; float zs = viewZ(uv), rs = coc(zs);
        // a sample behind the centre may only blur as much as the centre itself (no background bleeding over a sharp face)
        if (zs > z0) rs = min(rs, r0);
        float w = smoothstep(rr - 1.0, rr + 1.0, rs) * (1.0 + 0.6 * dot(s, vec3(0.2126, 0.7152, 0.0722)));
        acc += s * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, c0.a);
    }`,
};

// final grade in display space: contrast, saturation, temperature, split tone, vignette, a little grain, faint edge fringing
const GRADE = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, premul: { value: 0 }, contrast: { value: 1.08 }, sat: { value: 1.05 }, lift: { value: new THREE.Vector3(0, 0, 0) }, gain: { value: new THREE.Vector3(1, 1, 1) },
    shadowTint: { value: new THREE.Vector3(0.0, 0.02, 0.05) }, hiTint: { value: new THREE.Vector3(0.03, 0.015, 0.0) }, vig: { value: 0.32 }, grain: { value: 0.018 }, fringe: { value: 0.0012 },
  },
  vertexShader: VERT,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, premul, contrast, sat, vig, grain, fringe; uniform vec3 lift, gain, shadowTint, hiTint; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 c = vec3(texture2D(tDiffuse, vUv + d * fringe * r2 * 4.0).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * fringe * r2 * 4.0).b);
      c = c * gain + lift;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c += shadowTint * (1.0 - smoothstep(0.0, 0.45, l)) + hiTint * smoothstep(0.5, 1.0, l);
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * contrast + 0.5;
      c *= 1.0 - vig * smoothstep(0.18, 0.85, r2 * 1.6);
      c += (h(vUv * vec2(1080.0, 1920.0) + fract(time) * 91.7) - 0.5) * grain;
      float a0 = texture2D(tDiffuse, vUv).a;   // 1 everywhere unless a set swap (backdrop) is rendering the cast on a transparent background
      gl_FragColor = vec4(clamp(c, 0.0, 1.0) * mix(1.0, a0, premul), mix(1.0, a0, premul));
    }`,
};

export function createStage({ W = 1080, H = 1920, ss = 1, tone = 'agx', exposure = 1, look2 = null } = {}) {
  // look2 (see core/look2.js): null / false = the old chain, untouched. An object = its knobs over LOOK2.
  const L2 = look2 ? { ...LOOK2, ...(typeof look2 === 'object' ? look2 : {}) } : null;
  if (L2) { if (!ss) ss = L2.ss; if (L2.tone) tone = L2.tone; }
  if (!ss) ss = 1;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = L2 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping }[tone] ?? THREE.AgXToneMapping;
  renderer.toneMappingExposure = exposure; renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#05060c');
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.25;

  const w = Math.round(W * ss), h = Math.round(H * ss);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(1); composer.setSize(w, h);
  const scenePass = new ScenePass(scene, camera, w, h, L2 ? Math.max(1, Math.min(L2.msaa, renderer.capabilities.maxSamples)) : 4); composer.addPass(scenePass);
  const l2pass = L2 ? new Look2Pass(L2, scenePass, W, H, w, h) : null; if (l2pass) composer.addPass(l2pass);
  const dof = new ShaderPass(L2 ? DOF2(L2.dofTaps, L2.bokeh) : DOF); dof.uniforms.tDepth.value = scenePass.rt.depthTexture; dof.uniforms.res.value.set(w, h); composer.addPass(dof);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.7, 0.9);
  if (L2) { const sz = bloom.setSize.bind(bloom); bloom.setSize = (a, b) => sz(Math.round(a / ss), Math.round(b / ss)); bloom.radius = 0;   // look2: bloom at the old pixel scale whatever ss is; own mip weights
    bloom.compositeMaterial.uniforms.bloomFactors.value = [L2.bloomCore, 0.6, 0.42, L2.bloomWide, L2.bloomWide]; }
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(L2 ? GRADE2 : GRADE); composer.addPass(grade);
  let resolve = null;
  if (L2) { const gu = grade.uniforms; gu.tMask.value = l2pass.mask.rt.texture; for (const k of ['setLookK', 'castLookK', 'conMul', 'satMul', 'setGain', 'setSat', 'setCon', 'castLift', 'castGain', 'castKnee', 'castTop']) gu[k].value = L2[k]; bloomCastCut(bloom, l2pass.mask.rt.texture, L2);
    resolve = new ShaderPass(RESOLVE); const ru = resolve.uniforms; ru.tMask.value = l2pass.mask.rt.texture; ru.inRes.value.set(w, h); ru.outRes.value.set(W, H); ru.ss.value = ss; ru.sharp.value = L2.sharp; ru.sharpSet.value = L2.sharpSet; ru.grain.value = L2.grain; composer.addPass(resolve); }
  // look2: every shadow light gets a big map and the PCF radius, every texture full anisotropic filtering (checked each frame: sets and props may add things late)
  const aniso = renderer.capabilities.getMaxAnisotropy(), prep2 = () => scene.traverse((o) => {
    if (o.isLight && o.castShadow && o.shadow && !o.isPointLight) { if (o.shadow.mapSize.x !== L2.shSize || o.shadow.radius !== L2.shRad) { o.shadow.mapSize.set(L2.shSize, L2.shSize); o.shadow.radius = L2.shRad; if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } } }
    else if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!m) continue; for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'aoMap']) { const tx = m[k]; if (tx && tx.image && tx.anisotropy < aniso) { tx.anisotropy = aniso; tx.needsUpdate = true; } } } });

  // (21/11 evening, order dependence) three computes a geometry's bounding sphere ONCE, from the vertices it has the first time it is drawn, and sorts by it (objects
  // sharing a material; every transparent object) and culls with it. A geometry rewritten every frame (the green paint trail, waves, wires, particles) kept the bounds
  // of whatever frame was drawn first, so the draw order (the trail ribbon vs its blobs) depended on the seek history. Bounds are refreshed whenever the positions changed.
  const bver = new WeakMap(), ver = (a) => (a.isInterleavedBufferAttribute ? a.data.version : a.version);
  const freshBounds = () => scene.traverseVisible((o) => {
    if (o.isInstancedMesh) { const v = o.instanceMatrix.version; if (o.boundingSphere && bver.get(o) !== v) { o.computeBoundingSphere(); if (o.boundingBox) o.computeBoundingBox(); } bver.set(o, v); }
    const g = o.geometry, pa = g?.attributes?.position; if (!pa || o.isSkinnedMesh || g.morphAttributes?.position?.length) return; const v = ver(pa), k = bver.get(g);
    if (k === v) return; if (k !== undefined || g.boundingSphere) { g.computeBoundingSphere(); if (g.boundingBox) g.computeBoundingBox(); } bver.set(g, v); });

  const stage = {
    W, H, canvas, renderer, scene, camera, composer, dof, bloom, grade, look2: L2, ss,
    // look2 only: the roots of the cast (characters + what they hold), for the cast mask; without look2 it does nothing
    setCast(roots) { if (l2pass) l2pass.mask.roots = new Set(roots); },
    // look2 only (round 2): the set's light profile + the cast's own lights / material response (core/look2.js look2Scene); without look2 it does nothing
    setLook2Scene(o) { if (l2pass) stage._l2s = look2Scene(stage, L2, { ...o, castRoots: [...l2pass.mask.roots] }); },
    // look = { exposure, bloom: [strength, radius, threshold], grade: { contrast, sat, vig, grain, shadowTint, hiTint, lift, gain }, env }
    setLook(look = {}) {
      if (look.exposure != null) renderer.toneMappingExposure = look.exposure;
      if (look.bloom) { if (L2) { bloom.strength = look.bloom[0] * L2.bloomK; bloom.radius = 0; bloom.threshold = look.bloom[2] + L2.bloomT; } else { bloom.strength = look.bloom[0]; bloom.radius = look.bloom[1]; bloom.threshold = look.bloom[2]; } }
      if (look.env != null) scene.environmentIntensity = look.env;
      const g = look.grade || {}; for (const k of Object.keys(g)) { const u = grade.uniforms[k]; if (!u) continue; if (Array.isArray(g[k])) u.value.set(g[k][0], g[k][1], g[k][2]); else u.value = g[k]; }
    },
    // set swap (backdrop for a 2-D board, see ENGINE.md "setswap"): on = the cast and the kept props are rendered on a TRANSPARENT background (alpha = coverage, smooth MSAA edges);
    // the page draws the board first and this canvas over it. off = exactly the old opaque render.
    setBackdrop(on) { if (on === (scene.background === null)) return; if (on) { stage._bg = scene.background; scene.background = null; renderer.setClearColor(0x000000, 0); grade.uniforms.premul.value = 1; } else { scene.background = stage._bg; renderer.setClearColor(0x000000, 1); grade.uniforms.premul.value = 0; } },
    // focus distance in metres, aperture = blur strength (0 = everything sharp)
    render(t, { focus = 3, aperture = 0, maxBlur = 22 } = {}) {
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      dof.uniforms.near.value = camera.near; dof.uniforms.far.value = camera.far; dof.uniforms.focus.value = focus; dof.uniforms.aperture.value = aperture * ss; dof.uniforms.maxBlur.value = maxBlur * ss;
      grade.uniforms.time.value = t;
      if (!L2) { composer.render(); return; }   // (the old chain keeps three's once-only bounds: its approved pictures stay byte-identical, see docs/look2.md "Fix 21/11 evening")
      freshBounds();
      prep2(); resolve.uniforms.time.value = t; const fog = scene.fog; if (L2.fogOff) scene.fog = null;
      stage._l2s?.pre(t); composer.render(); stage._l2s?.post(); scene.fog = fog;
    },
  };
  return stage;
}

// Named light rigs. Each returns handles so a set / shot can retune them. Units: candela for spot / point (physically based falloff).
// the presets (also used by `rig.apply(name, at)` to re-mood a rig in place: a composite world with several places moves one rig between them)
export const LIGHT_PRESETS = {
    // a lit stall on a dark Hanoi street: one warm bulb as the key, blue night as the fill, a cool kicker from behind
    warm_night: { hemi: ['#8f7fb8', '#5a3420', 0.34], key: ['#ffd6a0', 40, [-1.3, 2.5, 2.3]], rim: ['#8fc0ff', 95, [2.3, 2.6, -1.3]], kick: ['#ffb060', 22, [-2.2, 1.9, -1.2]], fog: ['#2a1f3a', 0.025] },
    // a pub: amber practicals, a teal TV glow as the kicker
    pub: { hemi: ['#4a3a55', '#1d120c', 0.5], key: ['#ffd2a0', 50, [-1.4, 2.6, 2.3]], rim: ['#58e0c8', 60, [1.8, 2.4, -1.6]], kick: ['#ff8a4a', 30, [-2.2, 2.0, -1.2]], fog: ['#1a1210', 0.02] },
    // cold: a dream street, a phone-lit room
    cold_night: { hemi: ['#5a7ab8', '#10141c', 0.6], key: ['#bcd4ff', 40, [-1.5, 2.8, 2.2]], rim: ['#ffb070', 46, [1.9, 2.4, -1.7]], kick: ['#6aa0ff', 20, [-2.2, 1.9, -1.2]], fog: ['#0c1424', 0.045] },
    // late afternoon
    // Zombie special (13/11): a ruined street by night, grey after dawn, dusk; a lit supermarket; the warm alley to Mẹ's gate
    cold_street: { hemi: ['#6a82b8', '#10141c', 0.55], key: ['#c4d8ff', 48, [-1.5, 2.8, 2.4]], rim: ['#ffa860', 50, [1.9, 2.4, -1.7]], kick: ['#6a98ff', 22, [-2.2, 1.9, -1.2]], fog: ['#0e1626', 0.03] },
    grey_morning: { hemi: ['#cfd8e0', '#7a7870', 1.1], key: ['#e8f0ff', 70, [-2.0, 3.2, 2.6]], rim: ['#ffffff', 40, [1.9, 2.6, -1.7]], kick: ['#c8d4e0', 16, [-2.2, 1.9, -1.2]], fog: ['#b4babc', 0.028] },
    dusk_street: { hemi: ['#9a8ab8', '#4a3028', 0.7], key: ['#ffc890', 60, [-1.6, 2.8, 2.4]], rim: ['#ff9a60', 70, [1.9, 2.4, -1.7]], kick: ['#8a8ae0', 20, [-2.2, 1.9, -1.2]], fog: ['#4a3048', 0.026] },
    market: { hemi: ['#7a8a98', '#1a1e22', 0.3], key: ['#d8e6ff', 48, [-1.4, 2.8, 2.2]], rim: ['#8fd8e8', 34, [1.9, 2.4, -1.7]], kick: ['#ffd8a0', 14, [-2.2, 1.9, -1.2]], fog: ['#06090b', 0.04] },
    alley_warm: { hemi: ['#6a5a8a', '#2a1a12', 0.45], key: ['#ffc888', 40, [-0.9, 2.6, 2.2]], rim: ['#8fb0ff', 55, [1.0, 2.4, -1.5]], kick: ['#ffb060', 26, [-1.6, 1.9, -1.2]], fog: ['#1e1626', 0.028] },
    day: { hemi: ['#bcd6ff', '#7a6048', 1.5], key: ['#fff0d8', 120, [-2.0, 3.2, 2.6]], rim: ['#ffffff', 50, [1.9, 2.6, -1.7]], kick: ['#ffd0a0', 20, [-2.2, 1.9, -1.2]], fog: ['#a8c0e0', 0.008] },
  };

export function lightRig(scene, name = 'warm_night', o = {}) {
  const g = new THREE.Group(); g.name = 'lights'; scene.add(g);
  const P = LIGHT_PRESETS[name];
  const at = o.at || [0, 0.8, 0];
  const hemi = new THREE.HemisphereLight(P.hemi[0], P.hemi[1], P.hemi[2]); g.add(hemi);
  const spot = (c, I, p, shadow) => { const l = new THREE.SpotLight(c, I, 0, 0.46, 0.85, 2); l.position.set(p[0] + at[0], p[1], p[2] + at[2]); l.target.position.set(at[0], at[1], at[2]); g.add(l, l.target);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0006; l.shadow.normalBias = 0.02; l.shadow.radius = 5; l.shadow.blurSamples = 16; l.shadow.camera.near = 0.5; l.shadow.camera.far = 12; }
    return l; };
  const key = spot(P.key[0], P.key[1], P.key[2], true), rim = spot(P.rim[0], P.rim[1], P.rim[2], false), kick = spot(P.kick[0], P.kick[1], P.kick[2], false);
  scene.fog = new THREE.FogExp2(P.fog[0], P.fog[1]);
  const rig = { group: g, hemi, key, rim, kick, name };
  // re-mood the rig in place (colours, intensities, positions, fog) and move it to a new `at`; same numbers lightRig(scene, name, { at }) would have made
  rig.apply = (nm, atNew = [0, 0.8, 0]) => { const Q = LIGHT_PRESETS[nm]; rig.name = nm; hemi.color.set(Q.hemi[0]); hemi.groundColor.set(Q.hemi[1]); hemi.intensity = Q.hemi[2];
    for (const [l, q] of [[key, Q.key], [rim, Q.rim], [kick, Q.kick]]) { l.color.set(q[0]); l.intensity = q[1]; l.position.set(q[2][0] + atNew[0], q[2][1], q[2][2] + atNew[2]); l.target.position.set(atNew[0], atNew[1], atNew[2]); }
    if (scene.fog) { scene.fog.color.set(Q.fog[0]); scene.fog.density = Q.fog[1]; } return rig; };
  return rig;
}
