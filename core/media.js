// cine3d core: async image / sticker / backdrop preloader & catalog cache (v3.0, 26/11/2026).
// Pure opt-in ES module; zero side effects on legacy episodes that do not reference images or stickers.
// Supports shorthand sticker IDs (`'sports_car'`), backdrop IDs (`'mom_kitchen'` or `'backdrop:mom_kitchen'`),
// or direct relative paths (`'packs/shared/stickers/sports_car.png'`).

const IMG_CACHE = new Map();
let CATALOG = null;
let CATALOG_LOADED = false;

async function ensureCatalog() {
  if (CATALOG_LOADED) return CATALOG;
  CATALOG_LOADED = true;
  if (typeof fetch !== 'function') return null;
  try {
    const r = await fetch('packs/shared/stickers/catalog.json', { cache: 'no-store' });
    if (r.ok) CATALOG = await r.json();
  } catch (_) {
    CATALOG = null;
  }
  return CATALOG;
}

export function resolveMediaUrl(ref, kind = 'auto') {
  if (!ref || typeof ref !== 'string') return null;
  const s = ref.trim();
  if (!s) return null;
  if (s.startsWith('backdrop:')) {
    const id = s.slice(9).trim();
    return CATALOG?.backdrops?.[id]?.path || `packs/shared/backdrops/${id}.jpg`;
  }
  if (s.startsWith('sticker:')) {
    const id = s.slice(8).trim();
    return CATALOG?.stickers?.[id]?.path || `packs/shared/stickers/${id}.png`;
  }
  if (s.includes('/') || /\.(png|jpe?g|webp|svg|gif)$/i.test(s)) return s;
  if (kind === 'backdrop') {
    return CATALOG?.backdrops?.[s]?.path || `packs/shared/backdrops/${s}.jpg`;
  }
  if (CATALOG?.stickers?.[s]?.path) return CATALOG.stickers[s].path;
  if (CATALOG?.backdrops?.[s]?.path) return CATALOG.backdrops[s].path;
  return `packs/shared/stickers/${s}.png`;
}

function collectRefs(obj, out, depth = 0) {
  if (!obj || depth > 7) return;
  if (Array.isArray(obj)) {
    for (const item of obj) collectRefs(item, out, depth + 1);
    return;
  }
  if (typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      if (k === 'sticker' || k === 'iconImg' || k === 'img' || k === 'src') out.push([v, 'sticker']);
      else if (k === 'backdrop' || k === 'backdropImg') out.push([v, 'backdrop']);
    } else if (v && typeof v === 'object') {
      collectRefs(v, out, depth + 1);
    }
  }
}

function loadOneImage(url) {
  if (IMG_CACHE.has(url)) return Promise.resolve(IMG_CACHE.get(url));
  if (typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    const done = (ok) => {
      if (ok && im.naturalWidth > 0) {
        IMG_CACHE.set(url, im);
        resolve(im);
      } else {
        IMG_CACHE.set(url, null);
        resolve(null);
      }
    };
    im.onload = () => {
      if (typeof im.decode === 'function') im.decode().then(() => done(true)).catch(() => done(true));
      else done(true);
    };
    im.onerror = () => done(false);
    im.src = url;
  });
}

// Preload all referenced stickers, images, and backdrops before `window.filmReady = true`.
export async function preloadMedia(ep) {
  const refs = [];
  if (Array.isArray(ep?.assets)) {
    for (const a of ep.assets) {
      if (typeof a === 'string') refs.push([a, 'auto']);
      else if (a && typeof a === 'object' && a.src) refs.push([a.src, a.kind || 'auto']);
    }
  } else if (ep?.assets && typeof ep.assets === 'object') {
    for (const v of Object.values(ep.assets)) if (typeof v === 'string') refs.push([v, 'auto']);
  }
  collectRefs(ep?.overlays, refs);
  if (!refs.length) return {};
  await ensureCatalog();
  const urls = new Map();
  for (const [ref, kind] of refs) {
    const u = resolveMediaUrl(ref, kind);
    if (u) urls.set(ref, u);
  }
  const uniqueUrls = [...new Set(urls.values())];
  await Promise.all(uniqueUrls.map(loadOneImage));
  // Also alias shorthand IDs directly in IMG_CACHE for instant O(1) draw-time lookup
  for (const [ref, u] of urls.entries()) {
    const im = IMG_CACHE.get(u);
    if (im) IMG_CACHE.set(ref, im);
  }
  return Object.fromEntries([...urls.entries()].map(([k, u]) => [k, !!IMG_CACHE.get(u)]));
}

export function getMedia(ref, kind = 'auto') {
  if (!ref) return null;
  if (typeof ref !== 'string') return ref; // already HTMLImageElement / Canvas
  if (IMG_CACHE.has(ref)) return IMG_CACHE.get(ref);
  const u = resolveMediaUrl(ref, kind);
  return (u && IMG_CACHE.get(u)) || null;
}

export function getCatalog() {
  return CATALOG;
}
