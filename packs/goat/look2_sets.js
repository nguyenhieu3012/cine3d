// look2 round 2: how each GOAT Beef set is LIT under look2 (see packs/trada/look2_sets.js for every key). Nothing here runs without look2.
const WARM_KEY = [-0.55, 0.58, 0.62], TEAL_RIM = [0.78, 0.18, -0.35];
export const L2SETS = {
  // sports pub: moody amber practicals, crisp teal TV rim, rich contrast behind Ron & Leo while keeping skin/jerseys clean
  bar: {
    amb: 0.48, key: 0.62, rim: 0.9, kick: 0.85, pts: 0.85, emis: 1.2, castAmb: 0.95,
    cast: [[WARM_KEY, '#ffe4c4', 1.4, 0.25], [TEAL_RIM, '#7ce8da', 0.55, 0.45]],
    setGain: 0.84, setCon: 1.12, setSat: 1.06,
  },
};
L2SETS.pub = L2SETS.bar;

