// cine3d look2 (21/11): an OPT-IN picture chain that aims at the Blender EEVEE frames. Switched on by the page flag `&look2=1` or `ep.look2 = true`;
// without it core/stage.js builds exactly the old chain (this file is then never used). Every knob is in LOOK2 below; a page flag `&l2_<knob>=<number>`
// (or `ep.look2 = { knob: value }`) overrides one for a test. See out/look2/NOTES.md for what each part does and what was tried and dropped.
//   chain: scene at ss x size (MSAA) -> cast mask (one cheap extra pass) -> ambient occlusion from the depth buffer (HDR, before bloom) -> depth of field
//          -> bloom (tight core + wide glow, at the old pixel scale) -> tone map -> grade (set and cast graded apart) -> downsample (tent) + adaptive sharpening + grain on the set only
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const LOOK2 = {
  ss: 2,              // internal render scale (1.5 .. 2); the page flag &ss= still wins
  msaa: 4,            // MSAA samples of the internal scene target (clamped to what the GPU allows)
  tone: 'agx',        // tone map under look2: 'agx' keeps the cast exactly as approved; 'neutral' (Khronos PBR Neutral, the Blender route) turned reds crimson and yellows harder, see NOTES
  conMul: 1.0,        // display contrast (whole frame; the set's own grade contrast is added on the set only)
  satMul: 1.0,        // display saturation (whole frame; the set's own grade saturation is added on the set only)
  fogOff: 1,          // 1 = no distance fog / haze (owner: no fog)
  shSize: 4096,       // shadow map size of every shadow-casting light
  shRad: 2.2,         // PCF filter radius in shadow-map texels (soft, clean edge)
  aoR: 0.4,           // ambient occlusion radius, metres
  aoK: 1.0,           // AO strength on the set (0 = AO off, the pass is skipped)
  aoI: 3.2,           // AO intensity inside the estimator (how dark a full corner gets)
  aoCast: 0.55,       // AO strength on the cast (relative)
  aoMaxPx: 110,       // AO radius cap, internal pixels
  bloomK: 1.0,        // multiplies the set's bloom strength
  bloomT: 0.0,        // added to the set's bloom threshold
  bloomCore: 1.0, bloomWide: 0.55,   // weight of the tightest mip / of the two widest mips
  setLookK: 1.0,      // how much of the set's own grade saturation / contrast (tuned for AgX, which washes colour out) still applies under look2
  castLookK: 1,       // ... and on the cast (0 = the cast gets only the display numbers; 1 = the old grade, as the approved engine look)
  setGain: 0.82,      // set brightness after the tone map (cast stays 1.0): the cast pops like it had its own lights
  setSat: 1.1,        // set saturation (cast untouched: character colours never change)
  setCon: 1.12,       // set contrast
  castLift: 0.0,      // small brightness add on the cast (0 = off)
  sharp: 0.45,        // adaptive sharpening on the cast (0 .. 1)
  sharpSet: 0.12,     // ... on the set
  grain: 0.010,       // film grain, set only
  dbg: 0,            // 1 = show the AO term, 2 = show the cast mask (look tests only)
  dofTaps: 64,        // depth-of-field gather taps (old: 48)
  bokeh: 1.6,         // extra weight of HDR highlights in the blur (round bright bokeh)
  // ---- round 2 (lighting and materials; see out/look2/NOTES.md "Round 2") ----
  inkK: 2.8,          // ink outline thickness x (the Blender route used 1.7 of its own; on screen its line reads about 2.2x ours)
  inkTrim: 0.25,      // a part's hull is at most inkTrim x its own radius (never thinner than the old line): cuffs, drawstrings, small trims stay thin
  inkRaw: 1,          // 1 = the ink is not tone-mapped (stays as dark as its colour)
  inkPx: 26,          // ... but never wider than this many output pixels (long-lens close-ups: the world-space hull would get heavy); 0 = no cap
  gloss: 1,           // 1 = cast material response: shinier clear coat, glossy dark hair, more sheen on skin (base colours untouched)
  ccRough: 0.1,       // clear-coat roughness cap on the cast (Bíp's shell, Tèo's glasses rims)
  ccRoughK: 0.85,     // base roughness x on clear-coated cast parts
  hairRough: 0.3, hairCoat: 0.4, hairCcRough: 0.22,   // dark sheen materials (hair): roughness cap, added clear coat and its roughness
  skinSheen: 1.0,     // sheen x on light sheen materials (skin)
  // no glare on the cast (owner 21/11: "too much light on the characters, glary, washed, blurred by glow"):
  castBloom0: 3.0, castBloom1: 5.0,  // on cast pixels bloom only starts at this HDR luminance (Bíp's screen / antenna keep a small tight glow; lit skin, shell, white hands never bloom)
  castGain: 1.1,      // the cast's brightness after the tone map (calmer faces)
  castKnee: 0.8, castTop: 0.96,   // cast highlights roll off softly above castKnee and never pass castTop (no clipped white on skin or shell; hue kept: the brightest channel is compressed, the others follow)
  // set light profiles (packs/<pack>/look2_sets.js) can be overridden one number at a time with &l2_s_<key>=<value> (e.g. l2_s_amb=0.3)
};

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

// the cast mask: white where a cast mesh (or its ink outline) is the nearest surface, black elsewhere; the set is drawn black as the occluder.
// (the occluders are drawn BLACK, not depth-only: drawn after a cast mesh, a depth-only occluder would leave the white standing.) Rendered at output size with 4x MSAA (smooth edges), no shadows, no fog, no tone map.
class CastMask {
  constructor(W, H, maxSamples = 4) {
    this.rt = new THREE.WebGLRenderTarget(W, H, { samples: Math.max(1, Math.min(4, maxSamples)), type: THREE.UnsignedByteType });
    this.white = [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].map((side) => new THREE.MeshBasicMaterial({ color: 0xffffff, side, fog: false }));
    this.occ = [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].map((side) => new THREE.MeshBasicMaterial({ color: 0x000000, side, fog: false }));
    this.roots = new Set(); this.c0 = new THREE.Color();
  }
  render(renderer, scene, camera) {
    const roots = this.roots, saved = [], inCast = (o) => { for (let p = o; p; p = p.parent) if (roots.has(p)) return true; return false; };
    scene.traverseVisible((o) => {
      if (!(o.isMesh || o.isLine || o.isPoints || o.isSprite)) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) return;
      // see-through (additive, or opacity under 0.5: glows, haze cards, thin glass) is left out; everything else counts, transparent flag or not
      const see = !(m.blending === THREE.AdditiveBlending || (m.transparent && m.opacity < 0.5)) && m.visible !== false && !o.isPoints && !o.isSprite && !o.isLine;
      if (!see) { saved.push([o, 'v', true]); o.visible = false; return; }
      if (inCast(o)) {
        if (o.userData.isOutline) { saved.push([o, 'c', m.color.clone()]); m.color.setHex(0xffffff); }   // keep its own material (the outline displacement lives in it); the colour is saved exactly (getHex rounded it to 8-bit sRGB on the first mask render)
        else { saved.push([o, 'm', o.material]); o.material = this.white[m.side ?? 0]; }
      } else if (!m.depthWrite) { saved.push([o, 'v', true]); o.visible = false; }   // a set mesh that does not write depth does not hide the cast either
      else { saved.push([o, 'm', o.material]); o.material = this.occ[m.side ?? 0]; }
    });
    const bg = scene.background, fog = scene.fog, au = renderer.shadowMap.autoUpdate, ca = renderer.getClearAlpha(); renderer.getClearColor(this.c0);
    scene.background = null; scene.fog = null; renderer.shadowMap.autoUpdate = false; renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(scene, camera);
    scene.background = bg; scene.fog = fog; renderer.shadowMap.autoUpdate = au; renderer.setClearColor(this.c0, ca);
    for (let i = saved.length - 1; i >= 0; i--) { const [o, k, v] = saved[i]; if (k === 'v') o.visible = v; else if (k === 'm') o.material = v; else (Array.isArray(o.material) ? o.material[0] : o.material).color.copy(v); }
  }
}

// ambient occlusion from the scene's own depth buffer (no extra scene render): normals rebuilt from depth, 16 samples on a spiral within aoR metres,
// a range check (a sample far in front of the surface counts nothing: no dark halo round a character standing before a wall), two depth-aware blur passes,
// then multiplied into the HDR colour before depth of field and bloom. Bright pixels (bulbs, neon, emissive faces, glows) are protected.
const AO_SHADER = `
  uniform sampler2D tDepth; uniform mat4 projInv; uniform vec2 res; uniform float radius, proj11, maxPx, inten; varying vec2 vUv;
  vec3 vpos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 p = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
  float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  void main(){
    float d0 = texture2D(tDepth, vUv).x; if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
    vec2 px = 1.0 / res; vec3 P = vpos(vUv);
    vec3 pr = vpos(vUv + vec2(px.x, 0.0)), pl = vpos(vUv - vec2(px.x, 0.0)), pu = vpos(vUv + vec2(0.0, px.y)), pd = vpos(vUv - vec2(0.0, px.y));
    vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl, dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
    vec3 cr = cross(dx, dy); vec3 N = length(cr) > 1e-6 ? normalize(cr) : vec3(0.0, 0.0, 1.0);
    float rpx = clamp(radius * proj11 * 0.5 * res.y / max(0.05, -P.z), 2.0, maxPx);
    float rot = ign(gl_FragCoord.xy) * 6.2831853, sum = 0.0;
    for (int i = 0; i < 16; i++) {
      float fi = float(i) + 0.5, rr = rpx * fi / 16.0, a = fi * 2.39996323 + rot;
      vec3 v = vpos(vUv + vec2(cos(a), sin(a)) * rr * px) - P; float l = length(v);
      sum += max(0.0, dot(N, v) / max(l, 1e-4) - 0.12) * (1.0 - smoothstep(0.35 * radius, radius, l));
    }
    gl_FragColor = vec4(vec3(clamp(1.0 - inten * sum / 16.0, 0.0, 1.0)), 1.0);
  }`;
const BLUR_SHADER = `
  #include <packing>
  uniform sampler2D tAO, tDepth; uniform vec2 dir, res; uniform float near, far; varying vec2 vUv;
  float vz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
  void main(){
    float z0 = vz(vUv), s = 0.0, w = 0.0;
    for (int i = -5; i <= 5; i++) { vec2 uv = vUv + dir * float(i) * 1.5 / res; float z = vz(uv), k = exp(-float(i * i) / 18.0) * max(0.0, 1.0 - abs(z - z0) / (0.04 * z0 + 0.02)); s += texture2D(tAO, uv).r * k; w += k; }
    gl_FragColor = vec4(vec3(s / max(w, 1e-4)), 1.0);
  }`;
const AO_APPLY = `
  uniform sampler2D tDiffuse, tAO, tMask; uniform float k, kCast, dbg; varying vec2 vUv;
  void main(){
    vec4 c = texture2D(tDiffuse, vUv); float ao = texture2D(tAO, vUv).r, m = texture2D(tMask, vUv).r;
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)), keep = 1.0 - smoothstep(0.7, 2.2, l);
    c.rgb *= mix(1.0, ao, k * mix(1.0, kCast, m) * keep);
    gl_FragColor = dbg > 1.5 ? vec4(vec3(m), 1.0) : dbg > 0.5 ? vec4(vec3(ao), 1.0) : c;
  }`;

export class Look2Pass extends Pass {
  // mask + AO; reads the scene pass (colour in readBuffer, depth in depthTexture), writes the occluded colour
  constructor(L, scenePass, W, H, w, h, maxSamples = 4) {
    super(); this.L = L; this.sp = scenePass; this.needsSwap = true; this.mask = new CastMask(W, H, maxSamples);
    const rt = () => new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.a = rt(); this.b = rt();
    const mk = (fs, u) => new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: fs, depthTest: false, depthWrite: false }));
    const dt = scenePass.rt.depthTexture;
    this.ao = mk(AO_SHADER, { tDepth: { value: dt }, projInv: { value: new THREE.Matrix4() }, res: { value: new THREE.Vector2(w, h) }, radius: { value: L.aoR }, proj11: { value: 1 }, maxPx: { value: L.aoMaxPx }, inten: { value: L.aoI } });
    this.blur = mk(BLUR_SHADER, { tAO: { value: null }, tDepth: { value: dt }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(w, h) }, near: { value: 0.1 }, far: { value: 200 } });
    this.apply = mk(AO_APPLY, { tDiffuse: { value: null }, tAO: { value: this.a.texture }, tMask: { value: this.mask.rt.texture }, k: { value: L.aoK }, kCast: { value: L.aoCast }, dbg: { value: L.dbg } });
  }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.sp.camera; this.mask.render(renderer, this.sp.scene, cam);
    if (this.L.aoK > 0) {
      const u = this.ao.material.uniforms; u.projInv.value.copy(cam.projectionMatrixInverse); u.proj11.value = cam.projectionMatrix.elements[5];
      renderer.setRenderTarget(this.a); this.ao.render(renderer);
      const bu = this.blur.material.uniforms; bu.near.value = cam.near; bu.far.value = cam.far;
      bu.tAO.value = this.a.texture; bu.dir.value.set(1, 0); renderer.setRenderTarget(this.b); this.blur.render(renderer);
      bu.tAO.value = this.b.texture; bu.dir.value.set(0, 1); renderer.setRenderTarget(this.a); this.blur.render(renderer);
    }
    this.apply.material.uniforms.k.value = this.L.aoK; this.apply.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.apply.render(renderer);
  }
  setSize() {}
}

// depth of field for look2: same gather as the old one (circle of confusion from real depth, a sample behind the centre never blurs more than the centre),
// more taps, and HDR highlights weigh much more so out-of-focus bulbs become round bright discs instead of grey smudges
export const DOF2 = (taps, bokeh) => ({
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, near: { value: 0.1 }, far: { value: 200 }, focus: { value: 3 }, aperture: { value: 0 }, maxBlur: { value: 22 }, res: { value: new THREE.Vector2(1080, 1920) } },
  vertexShader: VERT,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse, tDepth; uniform float near, far, focus, aperture, maxBlur; uniform vec2 res; varying vec2 vUv;
    float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
    float coc(float z){ return min(maxBlur, aperture * abs(1.0 / max(focus, 1e-3) - 1.0 / max(z, 1e-3))); }
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main(){
      vec4 c0 = texture2D(tDiffuse, vUv);
      if (aperture <= 0.0) { gl_FragColor = c0; return; }
      float z0 = viewZ(vUv), r0 = coc(z0);
      float rot = ign(gl_FragCoord.xy) * 6.2831853;
      vec3 acc = c0.rgb; float wsum = 1.0;
      for (int i = 1; i < ${taps}; i++) {
        float fi = float(i), rr = sqrt(fi / ${taps}.0) * maxBlur, a = fi * 2.39996323 + rot;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * rr / res;
        vec3 s = texture2D(tDiffuse, uv).rgb; float zs = viewZ(uv), rs = coc(zs);
        if (zs > z0) rs = min(rs, r0);
        float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
        float w = smoothstep(rr - 1.0, rr + 1.0, rs) * (1.0 + 0.6 * l + ${bokeh.toFixed(3)} * max(0.0, l - 0.8));
        acc += s * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, c0.a);
    }`,
});

// grade for look2 (display space, at the internal size): the old grade without fringe and grain, plus the cast mask: the set a little darker, richer and
// harder, the cast untouched (its colours stay exactly the model's)
export const GRADE2 = {
  uniforms: {
    tDiffuse: { value: null }, tMask: { value: null }, time: { value: 0 }, premul: { value: 0 }, contrast: { value: 1.08 }, sat: { value: 1.05 }, lift: { value: new THREE.Vector3(0, 0, 0) }, gain: { value: new THREE.Vector3(1, 1, 1) },
    shadowTint: { value: new THREE.Vector3(0.0, 0.02, 0.05) }, hiTint: { value: new THREE.Vector3(0.03, 0.015, 0.0) }, vig: { value: 0.32 }, grain: { value: 0.018 }, fringe: { value: 0 },
    setLookK: { value: 1 }, castLookK: { value: 1 }, conMul: { value: 1 }, satMul: { value: 1 }, setGain: { value: 0.86 }, setSat: { value: 1.12 }, setCon: { value: 1.04 }, castLift: { value: 0 }, castGain: { value: 1 }, castKnee: { value: 1 }, castTop: { value: 1 },
  },
  vertexShader: VERT,
  fragmentShader: `
    uniform sampler2D tDiffuse, tMask; uniform float time, premul, contrast, sat, vig, grain, fringe, setLookK, castLookK, conMul, satMul, setGain, setSat, setCon, castLift, castGain, castKnee, castTop; uniform vec3 lift, gain, shadowTint, hiTint; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec4 c4 = texture2D(tDiffuse, vUv); vec3 c = c4.rgb; float m = texture2D(tMask, vUv).r;
      c = c * gain + lift;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c += shadowTint * (1.0 - smoothstep(0.0, 0.45, l)) + hiTint * smoothstep(0.5, 1.0, l);
      // the set: the set's own grade (saturation, contrast) on top of the display numbers, then a little darker and richer;
      // the cast: only the display numbers (the Blender route: saturation 0.92, contrast 1.06), so its colours stay the model's
      float sa = 1.0 + (sat - 1.0) * setLookK, co = 1.0 + (contrast - 1.0) * setLookK;
      vec3 s = mix(vec3(l), c, sa * satMul * setSat); s = ((s - 0.5) * co * conMul * setCon + 0.5) * setGain;
      float ka = 1.0 + (sat - 1.0) * castLookK, kc = 1.0 + (contrast - 1.0) * castLookK;
      vec3 k = mix(vec3(l), c, ka * satMul); k = ((k - 0.5) * kc * conMul + 0.5 + castLift) * castGain;
      float kx = max(max(k.r, k.g), k.b); if (kx > castKnee && castTop > castKnee) { float w = castTop - castKnee; k *= (castKnee + w * (1.0 - exp(-(kx - castKnee) / w))) / kx; }
      c = mix(s, k, m);
      c *= 1.0 - vig * smoothstep(0.18, 0.85, r2 * 1.6);
      float a0 = min(1.0, c4.a);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0) * mix(1.0, a0, premul), mix(1.0, a0, premul));
    }`,
};

// the last pass: internal size -> output size with a [1 3 3 1] tent (4 bilinear taps), contrast-adaptive sharpening (AMD CAS) on the result, grain on the set
export const RESOLVE = {
  uniforms: { tDiffuse: { value: null }, tMask: { value: null }, inRes: { value: new THREE.Vector2(2160, 3840) }, outRes: { value: new THREE.Vector2(1080, 1920) }, ss: { value: 2 }, sharp: { value: 0.45 }, sharpSet: { value: 0.12 }, grain: { value: 0.01 }, time: { value: 0 } },
  vertexShader: VERT,
  fragmentShader: `
    uniform sampler2D tDiffuse, tMask; uniform vec2 inRes, outRes; uniform float ss, sharp, sharpSet, grain, time; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec4 px(vec2 o){ vec2 c = vUv + o / outRes, e = vec2(0.375 * ss) / inRes;
      return 0.25 * (texture2D(tDiffuse, c + vec2(-e.x, -e.y)) + texture2D(tDiffuse, c + vec2(e.x, -e.y)) + texture2D(tDiffuse, c + vec2(-e.x, e.y)) + texture2D(tDiffuse, c + vec2(e.x, e.y))); }
    void main(){
      vec4 e4 = px(vec2(0.0)); vec3 e = e4.rgb;
      vec3 a = px(vec2(-1.0, -1.0)).rgb, b = px(vec2(0.0, -1.0)).rgb, c = px(vec2(1.0, -1.0)).rgb, d = px(vec2(-1.0, 0.0)).rgb, f = px(vec2(1.0, 0.0)).rgb, g = px(vec2(-1.0, 1.0)).rgb, hh = px(vec2(0.0, 1.0)).rgb, i = px(vec2(1.0, 1.0)).rgb;
      vec3 mn = min(min(min(d, e), min(f, b)), hh), mn2 = min(mn, min(min(a, c), min(g, i))); mn += mn2;
      vec3 mx = max(max(max(d, e), max(f, b)), hh), mx2 = max(mx, max(max(a, c), max(g, i))); mx += mx2;
      vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
      float m = texture2D(tMask, vUv).r, k = mix(sharpSet, sharp, m);
      vec3 w = amp * (-1.0 / mix(8.0, 5.0, k)) * step(0.001, k);
      vec3 o = (w * (b + d + f + hh) + e) / (1.0 + 4.0 * w);
      o += (h(vUv * outRes + fract(time) * 91.7) - 0.5) * grain * (1.0 - m) * e4.a;
      float aOut = clamp(e4.a, 0.0, 1.0);
      gl_FragColor = vec4(clamp(o, 0.0, aOut), aOut);
    }`,
};

// =====================================================================================================================================
// Round 2: LIGHT and MATERIALS under look2 (the post chain above is unchanged).
// look2Scene(stage, L, { set, lights, setName, profiles, castRoots }) returns { pre(t), post() }, called by stage.render around the composer:
//   pre  multiplies the set's lights (hemisphere + environment = `amb`, the rig's key / rim / kick, the set's own point / spot lights = `pts`,
//        the set's emissive pieces = `emis`) by the set profile, and saves every value it touched; post puts them all back, so the set's own
//        logic (flicker, blackout, steady lights, rig.apply) never sees look2's numbers.
//   The CAST is lit apart (a light link three.js has no native way to do): every cast material gets a small shader patch that
//     - multiplies its indirect light (hemisphere + environment) by castAmb / amb, so dimming the set's ambient leaves the cast as it was;
//     - adds up to 6 directional lights of its own: the part of the rig's key / rim / kick taken away from the set (I x (1 - f) / d^2 at the
//       rig's target, so the cast keeps exactly the light it had), and the profile's own cast lights (`cast`: camera-space directions; a warm
//       key glint, a cool two-sided fill, a rim), which the set never receives.
//   Material response (`gloss`): shinier clear coat, glossy hair, more sheen on skin. Base colours are never touched.
// Profiles: keyed by set name, by light-rig preset name (rig.name, changes with rig.apply: one composite set moves between moods) and 'set:rig';
// later keys win. An unknown set = the defaults below (= round 1: nothing changes but the cast's material response and its own lights, which default to none).
export const L2SET_DEFAULT = { amb: 1, key: 1, rim: 1, kick: 1, pts: 1, emis: 1, castAmb: 1, castComp: 1, cast: [], castK: 1, envK: null, namedK: 1, addK: 1, setGain: null, setCon: null, setSat: null, bloomK: 1 };
const CAST_PARS = 'uniform vec3 l2D[6]; uniform vec3 l2C[6]; uniform float l2W[6]; uniform float l2Ind; uniform vec3 l2PP[8]; uniform vec3 l2PC[8]; uniform vec4 l2PD[8]; uniform vec3 l2PS[8];\nvoid main() {';
const CAST_LIGHT = `#include <lights_fragment_end>
  reflectedLight.indirectDiffuse *= l2Ind; reflectedLight.indirectSpecular *= l2Ind;
  { IncidentLight l2L; l2L.visible = true;
    for (int i = 0; i < 6; i++) { l2L.direction = l2D[i]; l2L.color = l2C[i]; ReflectedLight l2R = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
      RE_Direct(l2L, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, l2R);
      reflectedLight.directDiffuse += l2R.directDiffuse * l2W[i]; reflectedLight.directSpecular += l2R.directSpecular * (l2W[i] < 0.99 ? smoothstep(0.75, 0.3, material.roughness) : 1.0); }
    // the set's practicals boosted for the SET only: the cast gets the boost back as a NEGATIVE point light at the same spot (same falloff, same BRDF: it cancels exactly)
    for (int i = 0; i < 8; i++) { vec3 lv = l2PP[i] - geometryPosition; float ld = max(length(lv), 1e-3); l2L.direction = lv / ld; l2L.color = l2PC[i] * getDistanceAttenuation(ld, l2PD[i].x, l2PD[i].y) * (dot(l2PS[i], l2PS[i]) > 0.5 ? smoothstep(l2PD[i].z, l2PD[i].w, dot(-l2L.direction, l2PS[i])) : 1.0);
      RE_Direct(l2L, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight); } }`;   // l2W = how much of a light's DIFFUSE the cast takes (1 = a full light; < 1 = mostly a glint: highlights on hair, shell, coat without washing the faces)
function respond(m, L) {
  if (!L.gloss || !m.isMeshPhysicalMaterial) return;
  const c = m.color, lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (m.clearcoat > 0) { m.clearcoatRoughness = Math.min(m.clearcoatRoughness, L.ccRough); m.roughness *= L.ccRoughK; }
  else if (m.sheen > 0.5 && lum < 0.05) { m.roughness = Math.min(m.roughness, L.hairRough); m.clearcoat = L.hairCoat; m.clearcoatRoughness = L.hairCcRough; }
  else if (m.sheen > 0) m.sheen = Math.min(1, m.sheen * L.skinSheen);
}
export function look2Scene(stage, L, { set, lights, setName, profiles = {}, castRoots = [] }) {
  const scene = stage.scene, roots = new Set(castRoots), V = () => new THREE.Vector3();
  const U = { l2D: { value: Array.from({ length: 6 }, V) }, l2C: { value: Array.from({ length: 6 }, V) }, l2W: { value: [1, 1, 1, 1, 1, 1] }, l2Ind: { value: 1 }, l2PP: { value: Array.from({ length: 8 }, V) }, l2PC: { value: Array.from({ length: 8 }, V) }, l2PD: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 2, 0, 1)) }, l2PS: { value: Array.from({ length: 8 }, V) } };
  const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const under = (o, set) => { for (let p = o; p; p = p.parent) if (set.has(p)) return true; return false; };
  const patched = new WeakSet();
  const patch = () => { for (const r of roots) r.traverse((o) => { if (!o.isMesh || o.userData.isOutline) return; for (const m of [].concat(o.material)) {
    if (!m || !m.isMeshStandardMaterial || patched.has(m)) continue; patched.add(m); respond(m, L);
    const prev = m.onBeforeCompile, key = m.customProgramCacheKey;
    m.onBeforeCompile = function (sh, r) { prev.call(this, sh, r); Object.assign(sh.uniforms, U); sh.fragmentShader = sh.fragmentShader.replace('void main() {', CAST_PARS).replace('#include <lights_fragment_end>', CAST_LIGHT); };
    m.customProgramCacheKey = function () { return key.call(this) + '|l2cast'; }; m.needsUpdate = true; } }); };
  // the set's own lights and emissive pieces (not the cast, not the rig)
  const skip = new Set([...roots, ...(lights?.group ? [lights.group] : [])]), pts = [], emis = new Set(), envM = new Set(), castMats = new Set();
  for (const r of roots) r.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m) castMats.add(m); });
  scene.traverse((o) => { if (under(o, skip)) return; if ((o.isPointLight || o.isSpotLight) && !o.isDirectionalLight) pts.push(o);
    if (o.isMesh) for (const m of [].concat(o.material)) { if (!m || !m.isMeshStandardMaterial || castMats.has(m)) continue; if (m.emissiveIntensity > 0 && (m.emissiveMap || m.emissive.r + m.emissive.g + m.emissive.b > 0.02)) emis.add(m); if (m.envMap) envM.add(m); } });   // envM: set materials with their own env map (scene.environmentIntensity does not reach them: the GTA cars)
  const saved = [], mul = (o, k, f) => { if (f === 1 || f == null) return; saved.push([o, k, o[k]]); o[k] *= f; };
  // set-only lights look2 adds (P.add = [{ pos: [x, y, z] in the set group, col, I, dist, follow: '<set property of a light whose dimming it follows>' }]), built once, hidden when no profile asks for them
  const addL = []; { const rn = lights?.name, P0 = { ...(profiles[setName] || {}), ...(profiles[rn] || {}), ...(profiles[setName + ':' + rn] || {}) };
    for (const a of P0.add || []) { const par = set?.group || scene, l = a.down ? new THREE.SpotLight(a.col, 0, a.dist ?? 0, a.angle ?? 0.9, a.pen ?? 0.7, 2) : new THREE.PointLight(a.col, 0, a.dist ?? 0, 2);
      l.position.set(...a.pos); par.add(l); if (a.down) { l.target.position.set(a.pos[0], a.pos[1] - 1, a.pos[2]); par.add(l.target); } addL.push({ l, a, base: set?.[a.follow]?.intensity || 1 }); } }   // base = the followed light as built (it used to be read on the first rendered frame: order dependent)   // down: a spot aimed straight down (a shaded bulb throws its light down, not onto the wall)
  const castC = V(), lp = V(), tp = V(), col = new THREE.Color(), gu = stage.grade.uniforms, g0 = { setGain: L.setGain, setCon: L.setCon, setSat: L.setSat };
  const ctl = {
    profile() { const rn = lights?.name, P = { ...L2SET_DEFAULT, ...(profiles[setName] || {}), ...(profiles[rn] || {}), ...(profiles[setName + ':' + rn] || {}) };
      for (const k of Object.keys(P)) if (L['s_' + k] != null) P[k] = L['s_' + k]; return P; },
    pre() {
      const P = ctl.profile(), vm = stage.camera.matrixWorldInverse; saved.length = 0; patch(); let n = 0;
      if (lights) {
        mul(lights.hemi, 'intensity', P.amb);
        for (const nm of ['key', 'rim', 'kick']) { const l = lights[nm], f = P[nm]; if (!l || f === 1) continue;
          l.getWorldPosition(lp); l.target.getWorldPosition(tp); const comp = l.intensity * (1 - f) * P.castComp / Math.max(lp.distanceToSquared(tp), 0.04);
          if (n < 6 && comp > 0) { U.l2D.value[n].copy(lp).sub(tp).normalize().transformDirection(vm); U.l2C.value[n].set(l.color.r, l.color.g, l.color.b).multiplyScalar(comp); U.l2W.value[n] = 1; n++; }
          mul(l, 'intensity', f); }
      }
      mul(scene, 'environmentIntensity', P.amb);
      // practicals: P.pts on all, P.named = { <set property>: factor } on one (e.g. the stall's hanging bulb); the added set-only lights (P.add) follow their light's dimming.
      // The cast gets every boost back as a negative light (the 8 nearest to the cast).
      const neg = [], named = new Map(Object.entries(P.named || {}).map(([k, f]) => [set?.[k], 1 + (f - 1) * P.namedK]).filter(([o]) => o));
      for (const l of pts) { const f = named.get(l) ?? P.pts, i0 = l.intensity; mul(l, 'intensity', f); if ((l.isPointLight || l.isSpotLight) && f > 1 && i0 > 0 && vis(l)) neg.push([l, i0 * (f - 1)]); }
      addL.forEach((x) => { const src = set?.[x.a.follow], k = src ? src.intensity / x.base : 1; x.l.intensity = x.a.I * k * (P.addK ?? 1); if (x.l.intensity > 0) neg.push([x.l, x.l.intensity]); });
      castC.set(0, 0, 0); let nc = 0; for (const r of roots) { if (!vis(r)) continue; r.getWorldPosition(lp); if (lp.y < -50) continue; castC.add(lp); nc++; } castC.multiplyScalar(1 / Math.max(1, nc));
      neg.forEach((x) => { x[0].getWorldPosition(lp); x[2] = lp.distanceToSquared(castC); }); neg.sort((a, b) => a[2] - b[2]);
      for (let i = 0; i < 8; i++) { const x = neg[i]; if (!x) { U.l2PC.value[i].set(0, 0, 0); U.l2PP.value[i].set(0, 0, 0); U.l2PS.value[i].set(0, 0, 0); U.l2PD.value[i].set(0, 2, 0, 1); continue; } const l = x[0]; l.getWorldPosition(lp); U.l2PP.value[i].copy(lp).applyMatrix4(vm);   // unused slots fully reset (nothing kept from an earlier frame)
        U.l2PC.value[i].set(l.color.r, l.color.g, l.color.b).multiplyScalar(-x[1]);
        if (l.isSpotLight) { l.target.getWorldPosition(tp); U.l2PS.value[i].copy(tp).sub(lp).normalize().transformDirection(vm); U.l2PD.value[i].set(l.distance, l.decay, Math.cos(l.angle), Math.cos(l.angle * (1 - l.penumbra))); }
        else { U.l2PS.value[i].set(0, 0, 0); U.l2PD.value[i].set(l.distance, l.decay, 0, 1); } }
      for (const m of emis) mul(m, 'emissiveIntensity', P.emis);
      for (const m of envM) mul(m, 'envMapIntensity', P.envK ?? P.amb);
      mul(stage.bloom, 'strength', P.bloomK);
      for (const [d, c, I, w = 1] of P.cast) { if (n >= 6) break; U.l2D.value[n].set(d[0], d[1], d[2]).normalize(); col.set(c); U.l2C.value[n].set(col.r, col.g, col.b).multiplyScalar(I * P.castK); U.l2W.value[n] = w; n++; }
      for (; n < 6; n++) { U.l2C.value[n].set(0, 0, 0); U.l2D.value[n].set(0, 0, 1); U.l2W.value[n] = 1; }
      U.l2Ind.value = P.castAmb / Math.max(P.amb, 1e-3);
      for (const k of ['setGain', 'setCon', 'setSat']) gu[k].value = P[k] ?? g0[k];
    },
    post() { for (let i = saved.length - 1; i >= 0; i--) { const [o, k, v] = saved[i]; o[k] = v; } saved.length = 0; },
    U, pts, emis,
  };
  patch();   // the cast's material response is taken from the materials AS BUILT, before any frame (it used to wait for the first rendered frame, whose time decided what it saw)
  return ctl;
}

// the bloom's bright-pass under look2: on CAST pixels (mask) bloom starts only at castBloom0 .. castBloom1 HDR luminance, so lit skin, white hands and
// shell highlights never glow; lamps, bulbs and neon of the set bloom as before (owner 21/11: bloom from the set's lights, not from the characters)
export function bloomCastCut(bloom, maskTex, L) {
  const u = bloom.highPassUniforms; u.tMask = { value: maskTex }; u.c0 = { value: L.castBloom0 }; u.c1 = { value: L.castBloom1 };
  bloom.materialHighPassFilter.fragmentShader = `
    uniform sampler2D tDiffuse, tMask; uniform vec3 defaultColor; uniform float defaultOpacity, luminosityThreshold, smoothWidth, c0, c1; varying vec2 vUv;
    void main() { vec4 texel = texture2D(tDiffuse, vUv); float v = luminance(texel.xyz), m = texture2D(tMask, vUv).r;
      float alpha = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v) * mix(1.0, smoothstep(c0, c1, v), m);
      gl_FragColor = mix(vec4(defaultColor.rgb, defaultOpacity), texel, alpha); }`;
  bloom.materialHighPassFilter.needsUpdate = true;
}
