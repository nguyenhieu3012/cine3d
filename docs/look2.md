# look2: the opt-in picture chain (21/11)

Switch: page flag `&look2=1`, `ep.look2 = true` (or `ep.look2 = { knob: value }`), or `--look2` on `tools/render.cjs` (any mode).
One knob for a test: page flag `&l2_<knob>=<number>` (e.g. `--q "look2=1&l2_aoK=0"`). Off = the old chain, untouched (regress result at the end).

## Sheets (each panel 1080 x 1920: current engine | look2 | Blender reference)
- `sheet_keoluong60_9.10.jpg` (ms_bip, street behind Bíp), `sheet_keoluong60_12.30.jpg` (cu_teo), `sheet_keoluong60_17.30.jpg` (two-shot)
- `sheet_gta6p2b_1.40.jpg` (two_drive: neon, traffic lights, headlamps), `sheet_gta6p2b_8.50.jpg` (cu_ga close single)
- look2 stills: `look2/<id>_t<T>.png` (with the text layer, as in the sheets), `look2_raw/` (no text layer). Old stills `old/`, reference frames `ref/`.
- References: `out/keoluong60/blender/fullplus60b/keoluong60_blender_fullplus60b.mp4`, `out/gta6p2b/hybrid/full/gta6p2b_hybrid_full.mp4`; frame n = round(t*60 - 0.5).
  The stall reference was rendered from an earlier version of the episode: Bíp's arm in 9.10 differs; that is not the picture chain.
- Times are in `times.json`. Scripts: `tools/l2.sh` (look2 stills of the five times), `tools/sheet.sh`, `tools/cmp.sh` (crops), `tools/measure.cjs` (timings, memory), `tools/probe.cjs` (how the cast mask sees each mesh).

## What look2 does (code: `core/look2.js`, wired in `core/stage.js`; knobs = `LOOK2` at the top of look2.js)
| step | what | knobs |
|---|---|---|
| 1 scene | rendered at 2x (2160 x 3840) into a half-float target with 4x MSAA | `ss` 2, `msaa` 4 |
| 2 no fog | `scene.fog` is set aside during the render (owner: no haze) | `fogOff` 1 |
| 3 shadows | every spot / directional shadow light gets a 4096 map and PCF filtering with radius 2.2 texels (the old PCFSoft ignored its radius 5; PCF honours it) | `shSize`, `shRad` |
| 4 textures | every texture gets the GPU's full anisotropic filtering (drawn faces, floor tiles at grazing angles) | none |
| 5 cast mask | one cheap extra pass at 1080 x 1920, 4x MSAA: cast meshes (and their ink outlines) white, opaque set meshes black as occluders, glows / see-through hidden. Cast = everything under a cast root (`stage.setCast`, called by main.js), same rule as `blender/castpass.cjs` | none |
| 6 AO | ambient occlusion from the scene's own depth buffer (no extra scene render): normals from depth, 16 spiral samples within 0.4 m, range check (no halo round a character in front of a wall), two depth-aware blur passes, multiplied into the HDR colour BEFORE depth of field and bloom; bright pixels (luminance > 0.7 .. 2.2: bulbs, neon, glowing faces) are protected; on the cast at 55 % strength | `aoR` 0.4, `aoK` 1, `aoI` 3.2, `aoCast` 0.55, `aoMaxPx` |
| 7 depth of field | same gather as before (real depth, a sample behind the centre never blurs more than the centre), 64 taps instead of 48, HDR highlights weigh much more (rounder, brighter bokeh discs) | `dofTaps`, `bokeh` |
| 8 bloom | UnrealBloom run at the OLD pixel scale whatever `ss` is (mips from 1080 x 1920), radius 0 with own mip weights: full weight on the tightest mip, 0.55 on the two widest | `bloomK`, `bloomT`, `bloomCore`, `bloomWide` |
| 9 tone map | AgX (as before) | `tone` |
| 10 grade | the old grade without fringe and grain, plus the mask: the SET a little darker, harder and richer (x0.82, contrast 1.12, saturation 1.1); the CAST gets exactly the old grade, so its colours stay as approved | `setGain`, `setCon`, `setSat`, `setLookK`, `castLookK`, `castLift`, `conMul`, `satMul` |
| 11 resolve | 2x -> 1x with a [1 3 3 1] tent (4 bilinear taps; the old `ss` path was a plain 2x2 box in the grade pass), then AMD-style contrast-adaptive sharpening: 0.45 on the cast, 0.12 on the set (limited by local contrast, so the ink lines do not ring), film grain 0.010 on the set only (none on the cast) | `sharp`, `sharpSet`, `grain` |
| debug | `l2_dbg=1` shows the AO term, `l2_dbg=2` the cast mask | `dbg` |

## Tried and dropped
- **Khronos PBR Neutral + display saturation 0.92 / contrast 1.06 (the Blender route).** Cleaner and more contrasty, but it changed the cast: the red of the gas-station man went crimson, Tèo's hoodie and face turned harder yellow. Owner rule "never change a character's colour" wins: AgX stays; `&tone=neutral` (with `l2_setLookK=0.5&l2_castLookK=0&l2_satMul=0.92&l2_conMul=1.06`) gives that variant back for a test.
- **DOF gather limited to the pixel's own circle of confusion** (all taps inside r0): faces slightly out of focus went visibly soft. Back to the old spread (taps over maxBlur, weighted by each sample's CoC).
- **Wide bloom** (strength x1.6, wide mips 0.8): turned the GTA street and the stall into a glow haze, washing the cast. Dropped.
- **Cast mask with depth-only occluders**: a set mesh drawn after a cast mesh left the white standing (Bíp's legs "through" the table, both men through the car body). Occluders are now drawn black; set meshes that do not write depth are hidden.
- **three's GTAOPass / SAOPass**: not used. Both re-render the scene for normals and blend AO over everything, glows and transparent parts included; the depth-only estimator here costs no scene render and can skip bright pixels and soften on the cast.
- **8x MSAA**: not worth it at 2x supersampling (16 samples per output pixel already); it would double the largest buffer.
- **DOF only on the set** (as the brief suggested): not done. The partner's shoulder in an `ots_` shot is cast and must blur; the depth-based gather already keeps the focused face sharp. The mask only drives the grade, AO strength, sharpening and grain.

## Timings and memory (M4, `tools/measure.cjs`, keoluong60 from 10 s, 1080 x 1920)
| | old | look2 |
|---|---|---|
| still (seek + PNG encode), s/frame | 0.067 | 0.148 |
| 300-frame mp4 export at 60 fps (`render.cjs mp4`, 2 workers, the normal export) | 11.3 s = 26.6 fps | 35.5 s = 8.4 fps |
| projected 3755-frame 60 fps episode | 2.4 min | 7.4 min |
| peak RSS of the browser + ffmpeg process tree during that export | 1829 MB | 1807 MB |

Notes: RSS does not count GPU buffers on macOS (unified memory, the Metal heap is not in `ps rss`), so the equal RSS hides look2's larger GPU use. Estimated from the targets: about 0.8 GB of GPU memory per page at `ss` 2 (MSAA 4x half-float colour + depth at 2160 x 3840 is most of it), x2 workers. `&ss=1.5` cuts that roughly in half. Load average was about 2.4 during the runs (another session was busy), so timings may be a little slow; the ratio (about 3.1x) is the useful number. For scale: the Blender render of Tập 61 took about 1 h 40 (owner's note of 15/11); look2 stays around 7-8 minutes per episode.

## What still looks worse than Blender (honest)
- **Set lighting**: Blender's sets have their own light falloff and dark unlit areas (GTA: black buildings, only the windows and neon glow); our sets are lit by hemi + environment light everywhere, so the GTA street stays pastel and flat even without fog. That is lighting in `packs/`, not the post chain; the mask grade only darkens it by 18 %.
- **Specular / glossy**: Blender's hair and Bíp's shell have sharper, brighter highlights and the stall floor has a wet glossy sheen; ours are softer (materials + no reflections, which the owner does not want anyway).
- **Ink outlines** are thinner than in the Blender frames (the outline thickness lives in `packs/index.js`, not touched).
- **Warm wall wash** from the shelf bulb in the stall is stronger in Blender (real area-light falloff).
- **AO** is a screen-space estimate: thin parts at the frame edge get less of it, and through see-through glows it is approximate.
- **Mask edge**: the mask is 1080 x 1920 with 4x MSAA; set/cast grade differences change over 1-2 px at the silhouette, invisible at 1x but a hard set brightness change could show a faint rim if `setGain` is pushed far below 0.8.
- Bíp's visor shows soft environment reflections that Blender does not.

## What looks better than the current engine (and in places than Blender)
- No haze: the backgrounds keep their colour and depth instead of the pink / purple veil.
- Characters pop: the set sits darker and richer behind an untouched cast, like the Blender light linking.
- Grounding: AO darkens stool bases, table legs, under the shelf, the gap between body and stool.
- Edges: 2x supersampling + tent resolve + adaptive sharpening: ink lines, glasses rims, drawn eyes and mouths are crisper than the old 1x MSAA and as crisp as Blender at full size, without ringing; no grain and no chromatic fringe on faces.
- Render time: about 7-8 minutes per 60 fps episode against well over an hour in Blender.

## Not done / next
- Timings were measured before the last grade-constant change (setGain / setCon / setSat); those are uniforms, cost unchanged.
- Only five stills were judged; a moving 60 fps clip with `tools/smooth.py` has not been run under look2 (the AO noise pattern is fixed per pixel and blurred, so it should not crawl, but this is unverified).
- Set swap (`setbackdrop`) and motion blur paths run through look2 untested.

## Files touched
- `core/look2.js` (new): LOOK2 knobs, cast mask, AO, DOF2, GRADE2, RESOLVE.
- `core/stage.js`: imports look2; `createStage({ look2 })` builds the look2 chain only when asked; `ScenePass` takes a sample count; `stage.setCast(roots)`; `setLook` maps bloom under look2. Without look2 every line runs as before.
- `main.js`: reads `&look2`, `ep.look2`, `&l2_<knob>`; calls `stage.setCast(...)` (does nothing without look2).
- `tools/render.cjs`: `--look2` flag (adds `look2=1` to the page query) in every mode.
- Pre-edit copies: `out/look2/stage.js.orig`, `main.js.orig`, `render.cjs.orig`. `ENGINE.md` not edited (a "Page flags" line for `&look2=1` / `--look2` should be added by whoever owns it).

## Regress
`python3 tools/regress.py` (look2 off, after all edits): **REGRESS PASS**, 23 of 23 stills "same" (see the dB values in `_regress.txt`), QA failures only the known ones. Full log: `_regress.txt`.

# Round 2 (21/11): lighting, materials, ink, no glare on the cast
Deliverables in `r2/`: `sheet_<id>_<t>.jpg` (current engine | look2 round 2 | Blender, 1080x1920 each), `pair_keoluong60_9.10.jpg` / `_17.30.jpg` (look2 final | Blender, from `demo/cmp_look2plus.js` = keoluong60 + look2 + the lively stall `setOpts.plus`), `clip_keoluong60_15.5-19.5.mp4` and `clip_gta6p2b_0-4.mp4` (4 s, 60 fps, normal export `render.cjs mp4 --look2`), `smooth_*` (worst-jump pictures). Stills `r2/final/`, pair stills `r2/pairs/`, the "before" of the glare fix `r2/n1/`, pre-edit copies `r2/pre/`.
Scripts (`tools/`): `r2.sh` (5 stills), `sheet2.sh`, `pair.sh`, `one.sh` (one raw still + query), `crop3.sh`, `peak.py` (peak / mean luma of Tèo's face and hands at 17.30), `cuts.cjs` (cut times inside a clip), `pick.cjs` (which mesh is under a pixel), `probe2.cjs` (lights in the page), `batch_final.sh` (all deliverables + smooth.py in one go).

## What changed (all look2-only; knobs in `LOOK2` of `core/look2.js`, set profiles in `packs/<pack>/look2_sets.js`, one number from the page: `&l2_<knob>=` or `&l2_s_<profile key>=`)
1. **Ink**: hull `inkK` 2.8x the pack's width, but a part's hull is at most `inkTrim` 0.25 x its own radius (never thinner than before: cuffs, drawstrings, buttons, small trims keep the old line; glasses rims carry none, as before), capped at `inkPx` 26 output pixels at the vertex's depth (long-lens close-ups do not get a cartoon-heavy line), `inkRaw` 1 = ink not tone-mapped (stays as dark as its colour). Code: `core/rig.js inkOutline({ scale, trim, raw, maxPx })`, defaults = old outline; `main.js` passes them only under look2.
2. **Cast light link** (`look2Scene` in `core/look2.js`, called by `stage.render` around the composer: `pre()` multiplies, `post()` puts every touched value back, so the sets' own flicker / blackout / steady-light / rig.apply logic never sees look2's numbers). Every cast material gets a shader patch: (a) its indirect light x `castAmb / amb`, so dimming the set's hemisphere + environment leaves the cast as it was; (b) up to 6 directional cast-only lights: the part of the rig's key / rim / kick taken from the set (I x (1 - f) x `castComp` / d^2 at the rig target) and the profile's own `cast` lights (camera-space; diffuse weight per light, a low weight = mostly a glint, and the glint's specular only on smooth parts, roughness < 0.75: no streaks on cloth); (c) every set practical boosted for the set comes back to the cast as a NEGATIVE light at the same spot (same falloff, same BRDF; 8 nearest; measured: x5 practicals changed the cast by 1.4 / 255 mean). So the set can be re-lit freely and the cast stays exactly as approved plus its own glints.
3. **Material response** (`gloss`): clear coat roughness capped 0.1 and base roughness x0.85 on clear-coated parts (Bíp's shell, Tèo's glasses rims), dark sheen materials (hair) roughness 0.3 + clear coat 0.4 / 0.22 (glossy highlight band), skin sheen x1.0 (raised in a test, dropped: glare). Colours never touched.
4. **No glare on the cast** (owner 21/11): bloom's bright pass on cast pixels (mask) only starts at HDR luminance `castBloom0` 3.0 .. `castBloom1` 5.0 (`bloomCastCut`): lit skin, white hands, shoes, shell highlights never bloom; Bíp's screen and antenna keep a small tight glow; set lamps / neon bloom as before. Cast grade: `castGain` 1.1, then a soft knee on the brightest channel from `castKnee` 0.8 to `castTop` 0.96 (hue kept, nothing clips). Measured on `demo/cmp_look2plus.js` 17.30 (99.9th percentile luma, % of pixels with a channel at 255): face 255 / 30.1 % clipped -> 236 / 0 %; left hand 236 -> 218; right hand 254 / 7.8 % -> 236 / 0 %. Blender: face 252 / 11.4 %.
5. **Stall** (`L2SETS.stall`): set ambient x0.4, key x0.55 (the cast gets the rest back), rim x0.85, kick x0.7, practicals x0.6 (the string-light pools sat 0.45 m from the wall and made a hot orange wall behind Tèo), hanging bulb point light x1.6 plus a set-only SPOT aimed down from the bulb (11 cd, 60 deg, follows the bulb's flicker / blackout): a warm pool on the table and floor that does not light the wall (a shaded bulb; three's point lights cast no shadow, so the shade could not block it), a tight warm wash under the shelf strip (0.3 cd, 1 m), emissive x1.15, cast warm glint + cool two-sided fill, set grade gain 0.85.
6. **GTA dusk** (`L2SETS.gta_gym`, also gta_dusk / gta_sky / gta_plaza): set ambient x0.06, key x0.12, rim / kick x0.6 (pink and cyan rims stay on the car), practicals x1.5, emissive x1.4 (windows, neon, traffic lights), the cars' own env map x0.4: buildings and road go near-silhouette, the car dark with neon edges; the cast keeps 0.85 of its ambient and 0.7 of the key taken from the set; set grade gain 0.95, contrast 1.14, saturation 1.12.
7. `packs/goat/look2_sets.js`: empty profile (the pub unchanged; under look2 the GOAT cast gets the ink, gloss and no-glare rules).

## Motion (smooth.py, cuts by time from the shot list via `tools/cuts.cjs`)
- stall clip: **SMOOTH PASS**, worst 1 s window 0.138 (limit 0.6), worst single jump 1.49 (limit 6) = the subtitle change at 2.70 s. GTA clip: **SMOOTH PASS**, 0.103 / 1.05. No flicker from the AO or the sharpening visible in either clip (AO noise is a fixed per-pixel pattern, blurred; it does not crawl).

## Timings (M4, 2 workers, normal mp4 export, 240 frames at 1080x1920)
- stall 33 s = 0.14 s/frame (7.3 fps); GTA 27 s = 0.11 s/frame (8.9 fps). Round 1: 8.4 fps. A 3755-frame episode: about 7.5-8.5 min. The round-2 additions (6 + 8 extra lights in the cast shader, the bright-pass mask read) cost almost nothing.

## Still worse than (or different from) Blender, honestly
- No real soft shadows / GI: Blender's floor and table are lit more broadly and warmly (EEVEE bounce + area lights); ours is a pool + falloff. The table top is a deeper green than Blender's bright lime.
- Bíp's visor still shows soft environment reflections (streaks); Blender's is cleaner. Bíp's shell reads a little darker and bluer than Blender's.
- Tèo's face is a cooler, slightly greyer white than Blender's creamy white (AgX + the knee); turning the cool fill down further would warm it.
- The cast lights for glints are camera-relative (they move with the camera inside a moving shot; subtle). Hair highlight is broader / bluer than Blender's tight band.
- GTA: the sky is pinker and a little brighter than Blender's; the GTA reference's cast is the hybrid route (thin outlines), so our ink is bolder there by choice (the stall Blender route is the target).
- The added stall lights are only for set 'stall' (keyed by name); other sets get the defaults (= round 1 + ink + gloss + no glare).
- `stall.js` / `stall_plus.js` are being changed by another agent; the profile keys on `set.bulbLight` (a set property) and positions in the stall group; if the stall layout moves, `L2SETS.stall.add` positions must follow.

## Files touched (round 2)
- `core/look2.js`: knobs (ink, gloss, no glare), cast shader patch, `look2Scene`, `bloomCastCut`, GRADE2 cast gain + knee.
- `core/stage.js`: imports; `setLook2Scene()`; `pre()` / `post()` around `composer.render()`; grade knob list + `bloomCastCut` (L2 branch only).
- `core/rig.js`: `inkOutline` options `scale`, `trim`, `raw`, `maxPx` (defaults = old outline, same shader string).
- `main.js`: ink options under look2; after props: `stage.setLook2Scene({ set, lights, setName, profiles })` from `packs/<pack>/look2_sets.js` (dynamic import, look2 only).
- New: `packs/trada/look2_sets.js`, `packs/goat/look2_sets.js`. Not touched: `stall.js`, `stall_plus.js`, `ENGINE.md`.

## Regress
`python3 tools/regress.py` (look2 off, after all edits): **REGRESS PASS**, 23 of 23 stills "same" at inf dB (pixel-identical), QA failures only the known ones. Log `r2/_regress.txt`.

# Fix 21/11 evening: order dependence
**Symptom.** In the look2 export of `gta6p3b`, the first frame of every 6-frame render batch was wrong: the car filling the bottom of the frame went black. smooth.py failed most 1 s windows because of it.
**Main cause.** It is not in the look2 chain: the old chain had it too (bottom grey 91 vs 120 at 0.5 s). In the composite set `gta` (`packs/trada/gta_world.js` `world.update`), the light rig (key / rim / kick) was moved to the followed cast member (Tèo) BEFORE the place's own update ran. In `paint` and `alley` (`gta_p3b_set.js`), that update is what drives the silver car and glues Tèo into it. So the rig stood where Tèo was on the PREVIOUS seek: about 0.35 m behind between consecutive frames, and 4 m behind after the 12-frame jump at the start of each batch. There the key missed the car, and under look2's GTA profile (key x0.12, envK 0.4) the car went black. The `follow` position handed to the place (the alley sky dome) was copied too early in the same way.
**Same class of bug, found with a whole-episode scan** (`scan.cjs`: 80 + 145 times, each rendered in four seek orders: forward, reverse, shuffled, and after a far jump):
1. `setPlace` applied a place's look only on a change of place, and `setLook` writes only the keys a look names. So a place showed what the place visited before it had left behind (bloom 0.40 / thr 0.90 instead of 0.34 / 0.95 when coming back to `paint`).
2. A standing character got only `rotation.y`: the lean / pitch from a vehicle ride in another place stayed on him (Tèo in the alley after a seek into the sea).
3. A character nobody places at t stayed where an earlier seek had left him (Linh on her island lounger at 29.5 s after any seek past 38 s).
4. The sea hangs the sacks and Linh's sunglasses on the cast's heads, outside the sea group, and only the sea updates them. A seek into the climax left Tèo's sack on him in the paint shop.
5. Three.js computes a geometry's bounding sphere ONCE, from the vertices it has the first time it is drawn, and uses it to sort (objects sharing a material; every transparent object) and to cull. The green paint trail (ribbon + blobs, one material) is rewritten every frame, so its draw order depended on which frame was drawn first (a few pixels on the blobs).
**Fixes.**
- `packs/trada/gta_world.js`:
  - the rig is shifted by however far the followed member moved during the place's update (positions and targets only);
  - `follow` is a getter, read when the place uses it;
  - every change of place first puts back the page's base look (set look + `ep.look`, snapshotted on the first frame), then lays the place's look over it. The first place keeps the base look, exactly as every forward render showed it;
  - stands set the whole rotation;
  - every character (a scene child with `userData.api`) starts each frame at the seat the page gave him, then the stands, the seat plan, the places and the cars place whoever they own at t;
  - outside the sea, the sea's cast attachments are put away (`P.sea.p3b.off()`).
- `packs/trada/gta_p3b_sea.js`: `off()` (sacks set to 0, sunglasses hidden).
- `core/stage.js`: under look2 only, before each render, bounds are recomputed for any geometry whose positions changed (and for instanced meshes whose matrices changed). The old chain keeps three's once-only bounds so its approved pictures stay byte-identical: tried globally, it moved `gb04` 6.00 s to 100.2 dB in regress. Turn it on for both chains when the owner allows a re-approval.
- `core/look2.js` (hardening, same class; no picture change measured):
  - the cast-mask outline colour is saved as an exact `Color` (`getHex` rounded it to 8-bit sRGB);
  - the base of a set-only added light (`add[].follow`) is the followed light as built, not its value on the first rendered frame;
  - unused cast-light slots are fully reset every frame;
  - the cast material response (`respond`) is applied to the materials as built, at `look2Scene` creation.

  Audited and found pure: shadow maps (re-rendered every `renderer.render`; the mask pass switches `autoUpdate` off only around itself), the AO / DOF / bloom passes (no history; noise from `gl_FragCoord`, grain from `t`), the `pre()` / `post()` multipliers (put back every render), the grade uniforms (set in `pre()`, before the render), the ink (constant per build), and `prep2`.
- Not touched (not mine): `stall.js` captures some bases lazily (`B.p ??=`, `steadyOn`). The tools always seek 0 first, so this is deterministic there.
**Proof** (`out/look2/fix/`):
- `det.cjs`: one t after t-1/60, t-12/60, t twice, in separate evaluates, and in a fresh page.
- `state.cjs` / `fine.cjs`: scene-state diff, also captured at the moment of the render.
- `pix.cjs`: pixel diff between two histories.
- `scan.cjs`: whole-episode scan.
- `prove.cjs`: 30 frames forward after warm-up seeks into the other places, the same 30 in reverse in a second page, and 5 of them alone in fresh pages.

Before: at 0.5 s, 4 different md5s depending on the previous seek (bottom-strip grey 17 / 65 / 77). After: 30/30 identical in all four stretches, and the scans are clean (results in `prove.txt`, `scan.txt`, `final.txt`).
**Re-export** (`render.cjs mp4 ... --fps 60`, 359 s):
- Bottom-strip grey from 0.3 s: `66 66 67 ... 76 76 | 24 16 9 ...`. It rises smoothly; the drop at 0.9 s is the cut to `hook_cu_teo`. The every-6th-frame pattern is gone, and the median jump by frame index mod 6 is flat (1.15-1.22).
- smooth.py still FAILS, but only on content. Any order effect would show up in the proof:
  - designed: the wipes at 3.85 / 3.87 and 28.60 / 28.62 s (windows 3-4 and 28-29), and the 9 duplicate frames of the hit-stop.
  - not designed, and not order: 6.32 / 6.52 s (green spray light pulsing in the bay, the car rolling out), 35.00 s (a blink on `cu_teo_heli`), 35.87 s (the searchlight beam just before `island_wide`). The windows 24-25 s (jet ski, spray and puffs at speed), 16-17 s (alley window inserts) and 35-36 s, and the overall mean jump 0.231, are motion in the picture. All of it shows up identically when each frame is rendered alone.

Regress (look2 off): **REGRESS PASS**, 23 of 23 stills at inf dB (log `out/look2/fix/_regress.txt`).
