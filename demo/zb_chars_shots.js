// helper for the zb_chars motion tests: keep tools/qa.cjs' editing rules (3 framings in the first 3 s, never the same framing twice in a row)
// while the tests hold long tracking shots: two quick singles open the test, and a 0.35 s single sits between two free shots.
export function qaPad(shots, a, b) {
  const out = [{ t0: 0, t1: 0.5, cam: `cu_${a}`, partner: b, move: 'none' }, { t0: 0.5, t1: 1.0, cam: `ms_${b}`, partner: a, move: 'none' }];
  shots.forEach((s, i) => { const s2 = { ...s }; if (i === 0) s2.t0 = Math.max(s2.t0, 1.0);
    if (i > 0 && s.cam === 'free' && shots[i - 1].cam === 'free') { const k = out.length % 2 ? a : b; out.push({ t0: s.t0, t1: s.t0 + 0.35, cam: `ms_${k}`, partner: k === a ? b : a, move: 'none' }); s2.t0 = s.t0 + 0.35; }
    out.push(s2); });
  return out;
}
