# clipcheck: geometry faults (v4, 13/11)

`node tools/clipcheck.cjs episodes/<id>.js [--step 0.1] [--t0 a --t1 b] [--tol pen=0.03,...] [--stills 5] [--verbose] [--json f] [--raw f] [--still t,t]`
Steps the real player (poses, gaits, rides, set) with drawing off: 70 s = 9 s, 118 s = 29 s at 0.1 s. `CLIP PASS` / `CLIP FAIL (n)`, exit 1 on fail.
Worst finding of each kind gets a full-size still with a ring: `out/<id>/clip_<n>_<check>_t<time>.jpg`. Nothing in core/ or packs/ is touched.

| check | measures | tolerance |
|---|---|---|
| pen | part inside a set box / cylinder / plane (smaller overlap of 3 axes) | 3 cm side, 6.5 cm top of table, 9 cm top of a seat (< 0.4 m) |
| cc | body volumes (head, torso, pelvis) of two characters | 7 cm; 15 cm inside the horde |
| detach | glasses / antenna / prop not touching a body volume (chain of parts <= 1.2 cm ok; a ring must touch the head) | 1.5 cm |
| slide | foot on the ground at both ends of a step but moved (gait, glide, walking on the spot) | 0.2 m/s |
| ground | lowest point under the floor; standing character floating > 0.3 s | 3 cm / 6 cm |
| frozen | whole pose bit-identical while on screen | 1.5 s |
| dup | held prop + identical free one within 0.9 m: SUSPECT only; declare `clipUnique: ['<signature>']` in the episode to fail | not decidable from the scene graph |

Counts only what the camera sees (point in frustum; pen / cc / detach also not behind other opaque geometry).
Skipped: characters parked under the floor, riders (`ep.rides`), pairs in contact (fx bite, bitten, pile, piggy, carry, hug, grab, hold, drag, push, trip), zombie dragging foot (lurch / charge), horde feet, teleports at cuts (> 9 m/s), wires and rods, kerbs under 0.2 m.
Passable or decoration set mesh: `userData.noClip = true` or name starting `noclip` / `passable` (read only).
Waive: `waive: [{ check: 'clip', t0, t1, reason }]` (or `clip.pen`, ...): printed WAIVED, not counted.

Limits: limbs = 40 vertex samples, other parts = inscribed ellipsoid, so depths are estimates; a limb vs a thin table top only counts when it crosses a zero-thickness plane;
a run from standstill shows as a 0.2 s slide (real, short); visibility is one ray per sample point.
Found, not fixed: Teo's `cover` pose lowers him 14 cm (feet under the floor, belly through the table) in ngay12 and zb1v4.
