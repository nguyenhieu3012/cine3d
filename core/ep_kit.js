// cine3d opt-in episode authoring helpers (Gemini Studio, 24/11/2026).
// Pure ES module; zero side effects on existing episodes or core modules.
// Usage:
//   import T from './myep.times.js';
//   import B from './myep.beats.json' with { type: 'json' };
//   import { makeKit, v2Defaults, v2Hook, goatDefaults } from '../core/ep_kit.js';

export function makeKit(T, B) {
  if (!T || !T.lines) throw new Error('ep_kit.makeKit(T, B): T.lines is required');
  const dur = Number(T.dur) || 0;
  const get = (id) => {
    const row = T.lines[id];
    if (!row) throw new Error(`ep_kit: unknown beat id "${id}" in times file`);
    return row;
  };
  const s = (id) => get(id).t0;
  const e = (id) => get(id).t1;
  const mid = (id) => (get(id).t0 + get(id).t1) * 0.5;

  function lines(lookMap = {}) {
    if (!B || !Array.isArray(B.beats)) return [];
    return B.beats
      .filter((b) => b && b.text)
      .map((b) => ({
        id: b.id,
        who: b.who,
        t0: s(b.id),
        t1: e(b.id),
        text: b.text,
        ...(lookMap[b.id] || {}),
      }));
  }

  function shots() {
    const arr = [];
    const cur = () => (arr.length ? arr[arr.length - 1].t1 : 0);
    const push = (t1Raw, cam, o = {}) => {
      const t0 = cur();
      const t1 = Math.min(dur, Math.max(t0, Number(t1Raw)));
      if (t1 - t0 <= 1e-4) return api;
      const { offset, ...rest } = o;
      arr.push({ t0: +t0.toFixed(4), t1: +t1.toFixed(4), cam, ...rest });
      return api;
    };
    const api = {
      cut: (t1, cam, o = {}) => push(t1, cam, o),
      cutStart: (id, cam, o = {}) => push(s(id) + (o.offset ?? 0), cam, o),
      cutEnd: (id, cam, o = {}) => push(e(id) + (o.offset ?? 0), cam, o),
      fill: (cam, o = {}) => push(dur, cam, o),
      list: () => {
        if (arr.length && Math.abs(arr[arr.length - 1].t1 - dur) > 0.02) {
          arr[arr.length - 1].t1 = +dur.toFixed(4);
        }
        return arr;
      },
    };
    return api;
  }

  function acts() {
    const arr = [];
    const api = {
      add: (t, who, o = {}) => { arr.push({ t: +Number(t).toFixed(4), who, ...o }); return api; },
      init: (who, o = {}) => { arr.push({ t: -1, who, d: 0.01, ...o }); return api; },
      atStart: (id, who, o = {}) => { const { offset = 0, ...r } = o; arr.push({ t: +(s(id) + offset).toFixed(4), who, ...r }); return api; },
      atEnd: (id, who, o = {}) => { const { offset = 0, ...r } = o; arr.push({ t: +(e(id) + offset).toFixed(4), who, ...r }); return api; },
      list: () => arr.sort((a, b) => a.t - b.t),
    };
    return api;
  }

  return { s, e, mid, dur, lines, shots, acts };
}

export function v2Hook(text, opts = {}) {
  return {
    kind: 'hook',
    t0: 0,
    t1: 2.15,
    text,
    y: 345,
    color: '#ffc531',
    ...opts,
  };
}

export function v2Defaults(overrides = {}) {
  const { setOpts, captions, partners, ...rest } = overrides;
  return {
    pack: 'trada',
    set: 'stall',
    fps: 30,
    rules: 2,
    look2: true,
    act2: true,
    setOpts: { plus: true, menuBrand: true, ...(setOpts || {}) },
    captions: { y: 1385, ...(captions || {}) },
    partners: { teo: 'bip', bip: 'teo', ...(partners || {}) },
    ...rest,
  };
}

export function goatDefaults(overrides = {}) {
  const { setOpts, castOpts, captions, partners, ...rest } = overrides;
  return {
    pack: 'goat',
    set: 'bar',
    fps: 30,
    setOpts: { steady: true, ...(setOpts || {}) },
    castOpts: { leo: { cup: 'mate' }, ...(castOpts || {}) },
    captions: { y: 1421, accent: '#ffe45a', ...(captions || {}) },
    partners: { ron: 'leo', leo: 'ron', ...(partners || {}) },
    ...rest,
  };
}
