// look2 round 2 (21/11): how each Trà đá set is LIT under look2 (core/look2.js look2Scene reads this; nothing here runs without look2).
// Keys: a set name ('stall'), a light-rig preset name ('gta_gym': the composite `gta` moves one rig between moods), or 'set:rig'; later keys win.
// Numbers multiply what the set already does, every frame, and are put back after the frame (the set's own flicker / blackout / steady-light logic is untouched):
//   amb   hemisphere + environment light on the SET (the cast keeps castAmb of its own: castAmb / amb is given back to the cast only)
//   key / rim / kick   the rig's three spots on the SET; what is taken away is given back to the cast as its own directional light (castComp x)
//   pts   the set's own point / spot lights (practicals: bulbs, string lights, lamps, neon)      emis   the set's emissive pieces (windows, neon, bulbs; bloom catches them)
//   envK  set materials with their own env map (the GTA cars) x (default = amb)
//   cast  [[camera-space direction toward the light, colour, irradiance, diffuse weight (1 = a full light, 0.1 = mostly a glint)], ...] lights the CAST only (x right, y up, z toward the camera)
//   named { <set property>: factor } one practical of the set (the stall's bulbLight)      add [{ pos (set group), col, I, dist, follow, down?, angle?, pen? }] set-only lights look2 adds (dimming with `follow`)
//   setGain / setCon / setSat   the look2 grade of the set (null = LOOK2's)        bloomK  bloom strength x
// One number can be tried from the page: &l2_s_<key>=<value> (e.g. --q "look2=1&l2_s_pts=3").
const WARM_KEY = [-0.55, 0.6, 0.6], COOL_FILL = [0.8, 0.12, 0.45];
export const L2SETS = {
  // the tea stall: a dark street, the warm practicals light the stall with real falloff into dark corners; the cast warm/cool two-sided
  stall: {
    amb: 0.4, key: 0.55, rim: 0.85, kick: 0.7, pts: 0.6, emis: 1.15, castAmb: 0.92,
    named: { bulbLight: 1.6 },
    add: [{ pos: [-0.25, 2.0, 0.35], col: '#ffc98a', I: 11, dist: 7, down: true, angle: 1.05, pen: 0.75, follow: 'bulbLight' },   // the shaded hanging bulb throws a real warm pool DOWN on the table and the floor
          { pos: [-0.55, 1.5, -1.36], col: '#ffbb70', I: 0.3, dist: 1.0, follow: 'bulbLight' }],   // the warm wash under the shelf strip
    cast: [[WARM_KEY, '#ffe6cc', 1.6, 0.2], [COOL_FILL, '#a8c0ff', 0.5, 0.5]],
    setGain: 0.85, setCon: 1.1, setSat: 1.0,
  },
  // GTA dusk street (composite `gta`): near-silhouette buildings and road, the windows / neon / lamps glow hard, the car dark with coloured highlights, the cast clearly lit
  gta_gym: {
    amb: 0.06, key: 0.12, rim: 0.6, kick: 0.6, pts: 1.5, emis: 1.4, castAmb: 0.85, castComp: 0.7, envK: 0.4,
    cast: [[WARM_KEY, '#ffe0c8', 1.0, 0.1], [COOL_FILL, '#8fe8ff', 0.4, 0.5]],
    setGain: 0.95, setCon: 1.14, setSat: 1.12,
  },
};
for (const k of ['gta_dusk', 'gta_sky', 'gta_plaza']) L2SETS[k] = L2SETS.gta_gym;
// the alley of gta6p3b (gate fix 21/11): the dusk profile with the set's ambient x1.8 (0.06 -> 0.108) so the walls and the TRUY NÃ posters read (mean luma was 25-28)
L2SETS.gta_alley = { ...L2SETS.gta_gym, amb: 0.108 };
