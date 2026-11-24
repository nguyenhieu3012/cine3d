// Preloads the six detail maps of the stall `plus` set (packs/trada/assets/stall_plus/*.jpg) with a top-level await, so they are decoded BEFORE the set is built
// (main.js builds the set synchronously and sets filmReady without waiting for images; a late texture would give a first still with flat surfaces).
// An episode that uses `setOpts: { plus: true }` adds ONE line at the top:   import '../packs/trada/stall_plus_preload.js';
// Without it the set still works (stall_plus.js falls back to a plain async load and warns), but the first frames of a headless render may have no surface detail.
import * as THREE from 'three';
export const PLUS_TEX_NAMES = ['wall_nor', 'wall_rough', 'floor_nor', 'floor_rough', 'road_nor', 'road_rough'];
const base = new URL('./assets/stall_plus/', import.meta.url).href, cache = (globalThis.__stallPlusTex ||= {}), loader = new THREE.TextureLoader();
await Promise.all(PLUS_TEX_NAMES.filter((n) => !cache[n]).map((n) => loader.loadAsync(base + n + '.jpg').then((t) => { cache[n] = t; })));
