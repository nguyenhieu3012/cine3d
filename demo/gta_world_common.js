// shared by the GTA world look tests: place origins, shot helper
export const ORG = { sky: [0, 0, 0], plaza: [400, 0, 0], bank: [800, 0, 0], road: [1200, 0, 0] };
export const P = (place, [x, y, z]) => [x + ORG[place][0], y + ORG[place][1], z + ORG[place][2]];
// a list of [duration, free-shot, extra] -> shots that tile the time line (each gets its own cam name so QA's same-framing check is happy)
export const shotsFrom = (list) => { const out = []; let t = 0; for (const [d, free, o] of list) { out.push({ t0: t, t1: t + d, cam: 'free' + out.length, free, hold: true, move: 'none', ...(o || {}) }); t += d; } return out; };
export const F = (who, o) => ({ dof: 0.2, who, ...o });
export const at = (t, who, mark, yaw) => ({ t, who, mark, yaw });
export const fx = (t, f, d = 0.1) => ({ t, who: 'set', fx: f, d });
