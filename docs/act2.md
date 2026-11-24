# act2: an opt-in acting layer for cine3d (22/11)

Switch: `ep.act2 = true` (or `{ gain, skip: ['bongden'], hands: 0, ... }`), or the page flag `&act2=1` (`&act2=0` forces it off, `&a2_<knob>=<number>` overrides one knob for a test).
`node tools/render.cjs mp4 <ep.js> out.mp4 --fps 60 --q "act2=1"` and `node tools/qa.cjs "episodes/<id>.js&act2=1"` already pass it through (qa.cjs puts its first argument into the page URL; no edit of any tool was needed).
Off = the old engine, pixel for pixel (see Determinism / Regress).

Files: `core/act2.js` (new, ~190 lines, all of the layer), `core/player.js` (+15 lines: the flag read, the call into act2 in `poseOf`, `reset / pre / post` around `apply`).
`core/rig.js` untouched (it was already being edited by someone else). Not touched: stage.js, look2.js, main.js, packs/, ENGINE.md, chars.js.
Throw-away helpers I used for measuring, in `tools/`: `_a2trace.cjs` (per-frame joint trace in any frame order), `_a2cmp.py`, `_a2an.py`, `_a2plot.py`, `_a2smooth.sh`, `_a2sheet.sh`, `_a2mp4sheet.sh` (safe to delete).

## What it does (all numbers in `ACT2` at the top of core/act2.js)

Every value is a pure function of t (see Determinism). The layer takes the pose that `poseOf` computed and returns it with the acting added; the character builders are not changed, it only uses the numbers they already read (`l`, `r`, `yaw`, `pitch`, `roll`, `lean`, `twist`, `bob`, `face.px/py/eye/h`) plus one post step on `body`.

| part | what | knobs |
|---|---|---|
| hands, pose changes | each pose change is a step of the hand target, softened by a 0.15 s cosine ramp (no jolt), through a damped spring: screen-left hand 2.15 Hz / damping 0.66, screen-right 2.45 Hz / 0.70 + 0.035 s later, so the hands never land on the same frame. Anticipation: a pull back opposite to the move, 85 ms (left) / 65 ms (right) before it, at most 2.8 cm and 28 % of the move. Overshoot about 6 %. Springs are linear, so the hand is `P0 + sum_k delta_k * R(t - t_k)` over the pose changes: closed form, overlapping changes superpose (the old `at()` pop when a change interrupted a change is gone) | `handL / handR {f, z, lead, delay}`, `ramp`, `antiMax`, `antiAmt` |
| contact poses | arms crossed, hands on head, phone, cup ... (list `CONTACT`): same spring, damping 0.95 and tiny anticipation (no overshoot). A pose the EPISODE defines in `ep.poses` keeps the engine's own ease exactly, because episode props (the hologram knob of keoluong60) are placed by that law, the same as `poseOf`; `lockCustom: 0` springs those too | `busyZ`, `lockCustom` |
| head | spring (2.5 Hz, 0.6) on the look target: the target is sampled over the last 0.5 s at 60 Hz and weighted with the spring's impulse response (direct convolution, exact), plus a 0.1 s box; leads the body by about 5 frames; a turn overshoots about 2 degrees and settles. Replaces the engine's 0.3 s linear boxcar (a ramp with corners) | `head {f, z, lead, box}` |
| torso | twist and lean follow the hands (30 % of the hands' sideways delta, 10 % of the forward delta, capped 4 deg / 1.1 deg) with a slower spring (1.45 Hz, 0.8, +60 ms), and the head's slow yaw (x0.1) | `torso`, `twistK/Max`, `leanK/Max`, `torsoYaw` |
| talking: beats | stressed syllables = peaks of the character's mouth envelope (`ep.lips`, or the engine's stand-in when a line has none), found once from the data (threshold max(0.42, 0.62 x line max), rise 0.2, 0.36 s apart). On each: head dips 0.03 rad (50 ms before), shoulders lean 0.01 rad (25 ms before), then one free hand comes out and dips (3 cm; two free hands take turns; a pointing hand jabs 4 cm along the arm). Hands in the lap under a table, hands resting on the table and busy hands do nothing | `beat {...}` |
| listening | small head nod (0.04 rad) on about 40 % of the partner's stresses, at least 1.3 s apart, 0.14 s after the stress; a slow head tilt (0.045 rad) while the partner speaks; an occasional glance (head 4 deg and pupils, every ~4 s with p 0.5) only while listening | `nodRate, nodGap, nodAmp, nodDelay, tilt, glance, glanceEye, glanceCell, glanceProb` |
| blinks | an extra blink rides on 60 % of gaze changes (the listener turning to a new speaker, an explicit look). Done by lowering `face.eye` (Tèo) / `face.h` (Bíp) for 0.16 s: the drawn faces are untouched, faces with `eye 0` / arcs stay as drawn | `blinkP` |
| always | slow weight shift on the seat (body slides 3 mm and rolls 0.006 rad, period ~5.8 s; seated characters only: nothing is moved for a character with legs on), slow lean drift (0.006 rad), breath rise of the body 1.6 mm, hand micro-drift 3.5 mm. The engine's own breathing and idle stay | `sway`, `breath`, `drift` |
| 60 fps | the engine's `spkK` (is-speaking) is a sum of 9 boolean taps 0.04 s apart, so the lean it drives climbs in 25 Hz stairs; act2 replaces that term with a continuous ramp (lean jerk p99 2418 -> 540 on Bíp). All curves above are continuous at any t; there is no 30 fps tick anywhere in the layer | |
| hands and body | table: a hand that the engine holds on or above the table never sinks below it (soft in the footprint edge, so nothing switches); torso: a hand is pushed out radially if it would sink into the torso ellipse (teo 0.205 x 0.17, bip 0.2 x 0.2), unless the engine's hand is already that deep (hugs, crossed arms) | `body`, stall table constants |

## Determinism (the pose at time t from t alone)

* No simulation and no cache: hands and torso are closed-form sums over the pose changes, the head is a fixed-window convolution, beats / nods / blinks are tables built once from the episode data. Frames in any order or worker give the same numbers.
* The engine itself was NOT order-free: `poseOf` aimed the head from the scene's last-drawn state (heads and body of whatever frame was drawn before, partner included), and the first camera solve (whose camera position a look-at-partner uses) saw the same stale heads. Measured on the untouched engine: 30 frames forward vs reverse differ in all 30 frames (head rotation up to 0.03 rad). With act2 on: `reset()` puts the cast in its build-time rest state before the first camera solve, and the look angles are taken in each character's rest frame from where the heads are by construction (root + seat height), never from the scene. Whatever else turns the body inside `apply()` (a gloat, a lean into a run) is taken out of the head afterwards in `post()`.
* The head only looks inside its own shot (samples are clamped to the shot's [t0, t1)), so a cut shows the head already where it belongs and nothing slides in at the first frame or twitches before the cut. Hands and torso are continuous across a cut (the action goes on).
* Test (stills, md5 of the PNG): 30 consecutive frames at 3 places (keoluong60 hook with the look to the lens, keoluong60 mid, gta6p2b 15 s), rendered forward, reverse, and five of them alone in fresh pages. act2 on: 30/30 identical forward vs reverse and 5/5 alone, in all three. Off: 0/30 forward vs reverse (the old behaviour, unchanged on purpose). Joint traces of 480 frames in forward / reverse / shuffled order: max abs difference 0.

## Cost

Per frame, poses and camera, no picture (1500 frames, same t, in page): keoluong60 0.205 ms off / 0.201 ms on; gta6p2b (5 characters) 1.62 ms off / 1.65 ms on. The old 19-sample look loop is skipped when act2 is on, which pays for the layer on two characters. The picture itself is 25-30 ms a frame, so the layer is free. Memory: three spring tables of 1100 doubles.

## Results

Deliverables here: `keoluong60_off.mp4` / `keoluong60_act2.mp4` (film seconds 4-14), `gta6p2b_off.mp4` / `gta6p2b_act2.mp4` (film seconds 7.6-17.6), all 60 fps with the film's audio, normal export (`node tools/render.cjs mp4 <ep> out.mp4 --fps 60 --audio <mix.wav> --from a --to b [--q "act2=1"]`); side by side `sbs_keoluong60.mp4`, `sbs_gta6p2b.mp4` (made with tools/sbs.cjs, which writes 30 fps); contact sheets `sheet_keoluong60_3s_6fps.jpg` (clip 5.6-8.6 s = film 9.6-12.6 s, Tèo's hand raise and head swing; old row over act2 row, 18 frames each at 6 fps) and `sheet_gta6p2b_3s_6fps.jpg` (clip 1.4-4.4 s = film 9.0-12.0 s, Gã and Tèo); joint curves `curves_keoluong60_old_vs_act2.png`, `curves_gta6p2b_old_vs_act2.png` (blue old, red act2: head yaw / pitch, hand heights and x, torso twist and lean per frame, dotted = cuts; drawn from the build just before the last amplitude cut of sway / lean, so those two curves differ from the final clips by a few mm).
What I saw on the sheets and curves: hands arrive about 0.08 s later than the old ease, with a pull-back first and a small overshoot, then settle; heads turn with a small overshoot instead of a ramp with corners; between pose changes there is always a little life (tilts, blinks, glances, the shoulder / head accents on stresses, a nod on the partner's words); no jitter and no float visible. The 6 fps stills cannot show timing, so the curves are the real evidence; the one thing I could not judge by eye is how the beats feel at speed: watch the sbs clips.

| check | old | act2 |
|---|---|---|
| smooth.py, keoluong60 full 55 s film at 60 fps, `--ep` (mean jump / spikes > 1 / worst 1 s window) | PASS 0.100 / 32 / 0.187 | PASS 0.083 / 24 / 0.178 |
| smooth.py, gta6p2b full 62.6 s film, `--ep` | PASS 0.094 / 47 / 0.512 | PASS 0.078 / 32 / 0.522 |
| smooth.py on the 10 s clips (shifted cuts, see weaknesses) keoluong60 / gta6p2b | PASS 0.112 / PASS 0.105 | PASS 0.089 / PASS 0.061 |
| qa.cjs (`"episodes/<id>.js&act2=1"`), no new failure | keoluong60 ALL PASS, gta6p2b ALL PASS | keoluong60 ALL PASS, gta6p2b ALL PASS (largest speaker turn 113 -> 119 deg) |
| clipcheck.cjs (hands / toes / frozen / penetration) via a wrapper with `act2: true` | both CLIP PASS | both CLIP PASS after the amplitude fix (see Tried and dropped) |
| determinism, 30 frames forward vs reverse, 5 single stills in fresh pages (md5 of PNG) | keoluong60 hook 0/30, mid 0/30, gta 0/30 (the old engine is order dependent) | 30/30 and 5/5 in all three; joint traces forward / reverse / shuffled: max diff 0 |
| frozen frames | none | none (clipcheck "frozen" clean) |
| `python3 tools/regress.py` | REGRESS PASS, every reference still 'same (inf dB)' = pixel-identical with act2 off; old engine vs new engine with act2 off compared separately on 20 stills per episode: 20/20 and 20/20 md5-identical | |
| per-frame motion numbers, keoluong60 55 s, frames away from cuts (|a| max m/s2 or rad/s2, jerk p99) | Tèo head yaw 132 / 2370, Bíp lean 35 / 2118 (the 25 Hz stairs) | Tèo head yaw 57 / 491, Bíp lean 8.7 / 324 |


## Tried and dropped

* Plain step into a spring (no ramp): the start of a move had 330-420 m/s2 acceleration on a 40 cm reach (the old ease about 80); a 0.15 s ramp and lower frequencies (2.15 / 2.45 Hz instead of the Blender 2.6 / 3.0) brought it to 20-50. Blender's anticipation 35 % of the move was 10 cm on a big reach: capped at 2.8 cm.
* Anticipation on contact poses and on the engine-defined poses: dropped (a hand on the knob must not pull back; the knob follows the engine's law).
* A hard "table side" clamp (new hand never above / below the old one): it flipped when the hand crossed the table edge and made 7-10 m/s jumps; replaced by the soft clamp above. A bisecting torso keep-out did the same; replaced by the radial push-out.
* A mutable per-frame cache to avoid re-aiming the head (the engine's own approach) : replaced by order-free look angles (above); the camera-position dependency is cut by `reset()` rather than by a second pose pass.
* The Quaternius "talking loop" gesture clip of the Blender layer: not ported (it is retargeted clip data, not a rule); the beat gesture + head + shoulder rule carries the talking motion instead.
* Bigger sway / lean (6.5 mm, 0.011 rad, 0.035 lean cap): `tools/clipcheck.cjs` then found two new fails with act2 on: Tèo's toes 3.2 cm under the floor at 34.7 s of keoluong60 (a lean about the floor point sinks the toes) and Gã's body 3.6 cm into the car side at 7 s of gta6p2b (sideways sway). Amplitudes were cut to the values above and `post()` lifts the seat by 0.3 x the lean the layer added; both episodes now CLIP PASS with act2 (run as `out/act2/a2_<id>.js`, a 2-line wrapper that sets `act2: true`, because clipcheck does not take query flags).
* Spine / chest breathing through `shrug`: moves the head by 0.5 mm, invisible; the body rise 1.6 mm is kept, the rest is the engine's own breath (torso scale).

## Weaknesses (honest)

* On keoluong60 nearly every pose is defined by the episode (hologram knob), so hands keep the engine's ease there on purpose; the hand part of act2 shows mainly in the free poses, the contact poses, the beats and the drift. A clip where the hands move more would show the springs better. `lockCustom: 0` springs them but a hand then trails the knob by about 0.1 s.
* Seated at the stall table both characters keep their hands in the lap or on the table, so beat gestures are mostly head, shoulder and torso; the lap hands do not gesture (they are under the tabletop).
* Table: the hands still pass through the tabletop when a pose change goes lap -> table (as the old engine does); act2 only guarantees it does not push a hand lower. One frame in 55 s of keoluong60 had a hand centre 2 mm under the surface while the engine's was above.
* Standing / walking characters: no weight shift (feet are in the body group and would slide); the lean / twist / head layers do apply. a custom character that stands without going through the pose numbers (`stand`, gaits) is not recognised as standing and also gets the 3 mm seat sway (the trace of `ga` in gta6p2b shows it); invisible, but wrong in principle (`post: 0` turns the sway off for an episode, `skip: [name]` turns the whole layer off for one character).
* Glances and nods are random-looking by design (hash of the beat time); there is no intent behind them. The blink only lowers the lid number: faces without an open eye (`arc`, `eye 0`) do not blink.
* The head follow-through reaches 5-7 rad/s on a 40-60 degree turn (accelerations are 2-4x lower than the old boxcar, the peak speed is higher); fine on a cut-away look, snappy on a very slow scene: raise `head.box` or lower `head.f`.
* `sbs.cjs` always writes 30 fps (it runs `fps=30` on both inputs); the 60 fps clips are the `*_off.mp4` / `*_act2.mp4` pair.
* smooth.py on the 10 s clips: the clip starts at 4 s / 7.6 s so `--ep` cannot be used (the cut times would be wrong); I passed the shifted cuts and overlay edges (`tools/_a2smooth.sh`). The full films were also rendered with act2 and measured with `--ep` (below).
* QA only measures what it measures: `speaker-facing` largest turn went 113 -> 119 degrees on gta6p2b with act2 (limit not hit).
