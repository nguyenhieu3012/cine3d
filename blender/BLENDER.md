> **NGỪNG DÙNG từ 21/11/2026 (the owner):** kênh chỉ dựng bằng cine3d bản nâng cấp (`look2` + `setOpts.plus`). Ứng dụng Blender và các khung hình trung gian đã xoá khỏi máy; file này và mã trong `blender/` chỉ giữ để tra cứu. Đừng gọi `run_ep.py` / `hybrid.py`.

# Blender renderer for cine3d episodes (15/11)

Re-renders an episode that is already staged in cine3d, in Blender 5.2 EEVEE, with the SAME characters (exact cine3d models, faces, outline),
the SAME set (exported from the engine), the SAME shots, cut frames, focus and eye lines. What Blender adds: real light (soft shadows,
reflections on the wet tiles, AO), glowing practicals with bloom, real bokeh, a darker background under brighter characters,
smoother acting (spring follow-through on the head, IK arms, talking gestures, breathing, speech nods), a smoothed camera with a gentle handheld drift.

## Setup (once per machine)
- Blender 5.2.4 LTS at `~/Applications/Blender.app` (`BL` below = `~/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> -- <args>`), run from `~/cine3d`.
- node + playwright (cine3d's own), ffmpeg 8 (no drawtext needed), system python3 (no numpy needed), `~/tdvai/.venv/bin/python` for `tools/smooth.py`.
- Disk: about 1.7 GB per minute of board PNGs (set-swap episodes) + 1 GB per 1000 frames; frame folders are deleted after the encode.

## One command
`python3 blender/run_ep.py <id> [--from s --to s] [--fps 30] [--chunk 10] [--set <blend> --set-collections a,b] [--only steps] [--keep]`
runs dump (+faces) -> faces2x -> chars (exports missing cast) -> set (export_set + set_build, or a given .blend) -> overlay (with the additive split) -> board (if the episode has a set swap) -> render (10 s chunks, `--resume`: frames on disk are kept) -> qa -> compose -> check, into `out/<id>/blender/<full | r<from>-<to>>/`.
`report.json` there: qa summary, cut check (each cut = the biggest frame change around its dump frame), frozen-frame scan (no picture change while the dump says something moved), smooth.py lines, frame count vs expected, video / audio length, render seconds. Re-running skips finished steps; `--only render,qa,compose,check` resumes a crashed render.

## Pipeline by hand (what run_ep.py does)
| step | command | output |
|---|---|---|
| 1. dump + faces | `node tools/dump.cjs episodes/<id>.js out/<id>/blender/<tag>/dump.json --fps 30 [--from s --to s] --faces out/<id>/blender/<tag>/faces` | camera / poses / lights per frame, face PNG per frame |
| 2. text layer | `node tools/render.cjs pngseq episodes/<id>.js <dir>/overlay --overlays-only --split-additive --fps 30 [--from --to]` | RGBA PNGs, additive glows in `add/`, overlay_meta.json |
| 2b. set-swap board (only if the episode has `setswap`) | `node tools/render.cjs pngseq episodes/<id>.js <dir>/board --board-only --fps 30` | board PNGs (only swap frames) + board_meta.json |
| 2c. crisp faces | `python3 blender/faces_hires.py <dir>/faces` | `faces2x/` (Lanczos 2x, used automatically) |
| 3. characters (once per pack) | `node tools/export_chars.cjs trada teo bip` / `goat ron leo` | `out/chars/<who>_seated.glb`, `<who>.joints.json` |
| 4. set (once per set/opts) | `node tools/export_set.cjs episodes/<id>.js out/<id>/blender/set/set.glb` then `BL -P blender/set_build.py -- <glb> out/<id>/blender/set_cache.blend`; or a hand-built set: `--set ~/studio-assets/goat/pub_set.blend --set-collections pub,street` | `set_cache.blend` (collection SET) |
| 5. stills to check | `BL -P blender/render_ep.py -- --dump <dump> --out <dir> --at 0.42,1.4,...` then `python3 blender/sheet.py <dir>/stills <cine3d stills dir> sheet.jpg 0.42,1.4,...` or `node blender/checksheet.cjs <crops dir> out.jpg` | `stills/t<t>.jpg`, `qa.json` |
| 6. frames | `BL -P blender/render_ep.py -- --dump ... --out <dir>/bl --from 0 --to 15.6 [--resume] [--noqa]` | `frames/f_<abs frame>.jpg`, swap frames `frames_cast/f_*.png` |
| 7. composite + encode | `python3 blender/compose.py --frames <dir>/bl/frames --overlay <dir>/overlay --audio out/<id>/audio/mix.wav --out <mp4> --from 0 --to 15.6 [--board <dir>/board --dump <dump>] [--keep]` | H.264 1080x1920 30 fps CRF 16 |
| 8. old vs new | `node tools/sbs.cjs <cine3d.mp4> <blender.mp4> <out.mp4> "cine3d" "Blender"` | side-by-side |

## Adding a character
1. In cine3d, the character must have a builder (packs/<pack>/...) and a face canvas; `node tools/export_chars.cjs <pack> <name>` writes `out/chars/<name>_seated.glb` + `<name>.joints.json` (bones, parts with their bone, face patch, outline list, palette).
2. Nothing else is needed for a seated cast member: `cast_rig.py` builds the armature from `bone_blender`, parents rigid parts, skins the tube limbs, rebuilds the ink hull from the outline list, puts the face image sequence on the `face` mesh (alpha, or additive for a glowing screen) and animates from the dump. Character-specific material fixes go in `cast_rig.tune_material` keyed by the palette colour (never change a model colour: only material response and light).
3. Props a pose holds (Tèo's phone) are built in `cast_rig.py` (`phone_prop` / `attach_phone`); a new held prop follows that pattern. Standing / walking characters are NOT rigged yet (seated pose + IK arms only).

## Adding a set
- From the engine (exact layout): `node tools/export_set.cjs <ep.js> <glb>` + `set_build.py` (PBR detail on big surfaces, glows boosted). Lights come from the dump every frame, not from the set.
- Hand-built in Blender (e.g. `~/studio-assets/goat/pub_set.blend`): keep it in named collections, pass `--set <blend> --set-collections pub,street`; leave out placeholder and light collections (the dump's lights are added). It must match the engine's seats (cast origin on the floor under the seat) or the cast will float.
- Set-swap keep rule (`render_ep.swap_keeps`) is the engine's: the table, what is on it, the stools stay; everything else hides for the board.

cine3d stills for the sheet: `node tools/render.cjs stills episodes/<id>.js <dir> t1,t2 --raw`.

## Files (`blender/`)
- `c3d.py` axes (three.js -> Blender: `v3`, `q3` for camera / engine-frame objects, `q3c` for Blender-axis rigs), dump loader, noise.
- `bake.py` one key per frame straight into F-curves (fast, LINEAR, a cut stays a cut).
- `set_build.py` engine set GLB -> cached .blend: Poly Haven normal/roughness detail under the engine's own colours (walls, pavement), boosted practicals for bloom, clear-coat plastic, the fake light cone removed.
- `lights.py` every engine light keyed per frame (W = 4 pi x candela); the hemisphere -> world; shadows only on key, rim and the hanging bulb (EEVEE cost). `character_rig()` = a warm key, cool rim and low fill that light ONLY the cast (light linking), so the set can stay darker than the characters.
- `camera.py` dump camera keyed CONSTANT (a cut never leaks into the frame before it), smoothed inside each shot (never across a cut), handheld drift (0.18 deg, 0.35 Hz), real DoF from the dump focus / f-stop.
- `cast_rig.py` the exact characters (fix round 15/11: outline = a welded hull COPY pushed out along normals, no cracks / no hatch, 1.7x the JSON metres to match the engine on screen; trims sitting on bigger parts carry none; acting layer below): armature from `bone_blender`, rigid parts parented to their bone, each limb tube rejoined and skinned with a 6 cm blend at the elbow/knee, ink outline = inverted hull (Solidify, flipped, back-face culled, never casts shadows), face = image sequence (V flipped for this UV layout; Bíp additive glow). Motion: the engine's staging + an acting layer: head leads by 3 frames then a damped spring; anticipation (pull-back 5 frames ahead) and two different hand springs (2.6 / 3.0 Hz) so hands overshoot, settle and never land on the same frame; the body twists toward the moving hands (slower spring); beat gestures on stressed syllables of the voice (shoulders 2 frames and head 3 frames ahead of the hand; a pointing hand jabs); listening nods on the partner's stresses, head tilt and glances; slow weight shifts in the seat; breathing; the phone rides the hand bone with a thumb-scroll wrist; hands kept out of the table top and the body; talking gestures retargeted from Quaternius `Sitting_Talking_Loop`; root nudged (max ~2 cm) so the head centre lands exactly where the engine has it. Tèo's phone prop follows the engine's placement.
- `cast_proxy.py` placeholder shapes, used only when `out/chars/` is missing.
- `look.py` EEVEE settings (32 spp, screen ray tracing, AO, soft shadows, light haze, pixel filter 1.0, no bokeh scatter), view transform Khronos PBR Neutral (keeps the models' colours; AgX turned Bíp teal), exposure from the dump, bloom (compositor Glare).
- `lights.set_fill()` a soft warm area light linked to the SET only (readability of wall / menu / bunting like the engine, the cast untouched).
- `measure.py` median colour / hue / luma of boxes, sharpness; `faces_hires.py` 2x faces.
- `qa.py` per frame: head / top / eyes / mouth of each character projected; subject's head never cut, eye line 28-44 % (singles), mouth above y 1260, both heads in a two-shot -> `qa.json`.
- `compose.py` ONE .jpg sequence (pre-processed frames written as .jpg q1: a .png among .jpg names froze the picture), read as numbered image sequences (exact frames), backdrop blur/dim from overlay_meta, set-swap board under the cast, display grade (saturation 0.92 / contrast 1.06), mild vignette (PI/12), vignette, STATIC grain 2 (temporal grain failed smooth.py), text layer, audio, encode.
- `sheet.py` contact sheet: Blender row over cine3d row.

## Look knobs (where to turn)
Character brightness vs set: `lights.LIGHT_K / HEMI_K / CHAR_* / SET_FILL`. Overall: `look.EXPOSURE_BIAS`. Targets (fix round 15/11): hoodie ~245,185,100, Bíp hue ~212, frame luma like the engine's raw stills. The engine's side key lights only the SET; the cast has its own frontal key (`CHAR_KEY`, 180 W) + a cool fill from camera-right (`CHAR_FILL`) + rim, so faces read evenly. Display saturation 0.92 (Khronos Neutral keeps more colour than the engine's AgX). Glow: `look.BLOOM`, practicals `set_build.emission_boost`. Haze: `look.HAZE`.
Saturation: `compose.DISPLAY_GRADE` (keep it display-referred: saturation in scene-linear light turned the yellow hoodie salmon).
Camera life: `camera.SMOOTH_HALF / DRIFT_DEG / DRIFT_HZ`, blur `DOF_K`. Acting: `cast_rig.SPRING_* / NOD_RAD / BREATH_* / GESTURE`.

## Round 2 (15/11)
- Inner ink lines: Grease Pencil Line Art on the CAST (`look.inner_lines`, one silhouette per object, radius 2.8 mm) on the parts the engine outlines; hulls and un-outlined parts (face patch, lenses, glasses, glow screens) sit in `CAST_INK`, excluded from Line Art. Trims on bigger parts (cuffs, drawstrings, Bíp's plate, visor, neck) get a thin hull (`THIN_K` 0.4). Freestyle was tried: its lines hid inside the hulls.
- Model colours are NEVER changed (owner rule). Tèo's hair keeps #17141f; its look comes from material response + light: roughness 0.25, sheen 1 tint #5b4f8a (chars.js), and the engine's cold rim lights the hair (and Bíp, and the set) but not the face. The engine's side key lights only the set; its cold rim lights the set + Bíp only (`lights.rim_receivers`); the cast key sits higher (-0.95, 2.45, 2.55), the cast rim is warm 50 W. Measured at f180 (graded): skin 239,189,158 vs engine 223,193,163; hair 83,63,45 vs 92,74,67; hoodie 235,170,96 vs 247,185,100; Bíp f360 hue 213 / value 0.60 vs 214 / 0.57.
- Phone: real-size mesh (scale keys 1 / hidden), so its hull keeps its width.
- Faces: `faces2x` + Closest filtering.
- Set swap (`render_ep.cast_pass`): frames with dump `swap` > 0 get a second pass: film transparent, the set hidden except the engine's keep rule (table, things on it, stools, contact blobs), no DoF, no haze -> `<frames>_cast/f_%05d.png`; frames with swap = 1 skip the opaque pass. Board: `node tools/render.cjs pngseq episodes/<id>.js <dir> --board-only --from --to`. `compose.py --board <dir> --dump <dump.json>` stacks stall frame x (1 - fade) / board x fade / cast.

## Round 4 (15/11)
- Additive overlay glows (engine `lighter`: t61 sparkOverlay, phoneGlow): `render.cjs pngseq --overlays-only --split-additive` writes them to `<overlay>/add/`; compose ADDS them (premultiplied, RGB planar) to the graded picture before grain and text. The default export is unchanged (regress PASS).
- Line Art: no intersection lines (off), visor excluded (specks); drawstrings back to a full hull (rounded dark eyelets).
- Bíp gets a Bíp-only front fill (`lights.bip_fill`, light linking); cast key colour neutral-warm #fff0e2; depth of field 1.4x the engine's f-stop (crisper faces).
- `blender/checksheet.cjs`: labelled Blender | cine3d crop sheets (this ffmpeg has no drawtext).

## Final round (16/11)
- Set pieces moved / shown / hidden by set fx (table phone `phone`/`phoneUp`/`buzz`, a pushed glass, passing headlights...): `export_set.cjs` names every set mesh `c3dset_<i>` and exports hidden ones too; `dump.cjs --set-dyn` writes per-frame deltas (effective visibility + world transform) of the meshes that change; `render_ep.set_dynamic` keys them (CONSTANT; hide_render). run_ep's dump step passes `--set-dyn`. Without the flag the dump is byte-identical; regress PASS.
- Set swap stretch: no grain and no added contrast (compose `enable` spans), board level `BOARD_K` 0.64 (the engine's measured board level). t61 full: smooth.py PASS (mean 0.156, worst window 0.545 at 58-59 s, worst jump 4.92).
- `tools/sbs.cjs ... "" <frames>`: exact frame count, no trailing fps drop.

## Showcase switches (`--plus`, 16/11; `blender/plus.py`)
`render_ep.py ... --plus motion,props,toon,camera,mblur,faces,atmos` / `run_ep.py <id> --plus ... --tag demo`. Without `--plus` nothing changes (the approved baseline).
- `motion`: real clips (anim_lib_vrm.blend: Sitting_Idle/Talking_Loop body + head layer, Sit_Point / Sit_FoldArms / Sit_PhoneLook / Sit_Drink hand arcs into each pose) retargeted onto the chibi armature (VRM rig turned 180 deg about Z); the dump's hand targets stay the end points.
- `props`: the phone goes down onto the table and comes back on pose changes and turns its screen to Bíp at the end of l1; Bíp lifts his tea and sips (0.95-3.0 s); on l8 Tèo's free hand winds up and slams the table, everything on it hops (damped).
- `toon`: volume-preserving squash-and-stretch pulses on the spine on strong emotion changes, beats and the slam; spring-driven drawstrings and antenna (pivot empties, driven by the bone's angular velocity).
- `camera`: crane-down into shot 1, an arc + rack focus on the short two-shot, the over-the-shoulder 5 cm lower through the near glass at a wide stop, a snap push-in on "Thầy tao khác!", slow eased pushes in singles, handheld breathing; all inside shots (cut frames unchanged).
- `mblur`: EEVEE motion blur, shutter 0.35 (the camera is CONSTANT-keyed, so no blur across cuts).
- `faces`: uses `faces_plus/` (or `faces_plus2x/`) next to the dump instead of `faces/`.
- `atmos`: the set's ATMOS / BG_LIFE collections and the EEVEE settings listed in `~/studio-assets/sets/STALL_PLUS.md`.
`tools/sbs3.cjs a b c out "la" "lb" "lc" [frames] [fps]`: three-way comparison.

## Determinism
Same process, after the warm-up render: bit-identical. Separate processes: about 73 dB PSNR (at most 1 level on a few hundred pixels, in blurred foreground); EEVEE on Metal is not bit-exact across launches even with ray tracing, DoF and denoise off. Stamps are off so files carry no dates.

## Render time (M4, 1080x1920, 32 samples)
About 3.2-3.6 s per frame for the stall (EEVEE + Line Art); a set-swap frame costs a second (transparent) pass of ~3 s; setup ~20 s per 10 s chunk (the whole dump is baked each time). The pub (pub_set.blend) is slower (~25 s/frame first frames, shadow buffer overflow warnings: lower its lights' shadows if it is used for real).

## QA
`bl/qa.json` (every frame: subject's head never cut, eye line 28-44 % for singles, mouth above y 1260, both heads on two-shots), `report.json` (cuts on their dump frames, frozen-frame scan, frame count, audio length, smooth.py), `tools/smooth.py <mp4> --ep episodes/<id>.js` must PASS, and a contact sheet one still per shot (Blender over cine3d) looked at full size.

## Known limits
- Set swap: the cast pass has no floor, no haze and no depth of field (as in the engine); Bíp's visor still reflects the probe of the hidden set a little.
- Engine fx that the dump does not carry are not reproduced (props such as the cup are only the phone so far; `cup`, `slip`, etc. need a prop like `phone_prop`).
- Additive overlays are split out and added (see Round 4); an additive draw that also reads the canvas would not survive the split.
- Standing / walking cast, fx props other than the phone (cup, slip, hearts...), hit-stop and motion blur are not reproduced.
- EEVEE on Metal is not bit-exact across launches (see Determinism).
- In the swap stretch Tèo's hoodie reads warmer (orange) than the engine's yellow: the set's warm practicals still light the cast while the set is hidden.
- Full t61 (81.2 s, 2436 frames, 1542 swap frames): 2 h 48 min render on the M4 (3.2-3.5 s per normal frame, ~4.5 s per cast-pass frame), compose 4 min.

## GOAT Beef (16/11): flag, standing cast, hands, mate, skin (gb07)
All guarded by `header['pack'] == 'goat'` or by new side files; Trà đá renders are unchanged (t61 PSNR, see the 16/11 report).
- Scene props (the flag cloth, knot, contact blob...): `node tools/dump.cjs <ep> <dump> --props <dir>` writes `<dir>/props.json` + `props_<k>.f32` (world-space vertices per frame of deforming meshes; matrix deltas of rigid ones; material; `chars.<who>.cup` per frame). The dump itself stays byte-identical. `blender/props_cache.py` (called by `render_ep` when `<dump dir>/props/props.json` exists, or `--props-dir`, off with `--noprops`) rebuilds them: Mesh Cache modifier on a .pc2 (CONSTANT, hit-stop frames repeat), rigid = keyed transform, `hide_render` keyed; they join the SET collection (table key light, set fill). The soft contact blob is skipped (Blender's own shadow reads).
- Standing Ron: the armature is moved so the head lands on the engine's (up to 22 cm); the hand targets were measured from the un-moved origin, so the lift was counted twice. `cast_rig.animate` (GOAT): targets taken from `root + nudge`.
- Hands: arms stretch (bones lengthen, `inherit_scale` NONE on forearm / hand) when the target is beyond reach, like the engine's tube arms; `goat.contact_weights()` blends the acting layer to the engine's exact hand while it is on the table top (y within -4..+2 cm of the palm-on-top height, ramps to 12 cm) or a pose named `flag*` carries the flag (+-3 frame smoothing); `keep_out` (the Trà đá table) is skipped for goat.
- Leo's mate: `goat.mate()` builds `fans.js mateProp()` (gourd, rim, yerba, bombilla; ink hull) keyed per frame at the hand + (-0.03, -0.005, 0.07) in the body frame, tilt (-0.45 cup, 0, 0.1), visible while `cup` > 0.5 (needs the props.json written by `--props`).
- Skin: `lights.GOAT_CHAR_KEY / GOAT_CHAR_FILL` (0.66 x the Trà đá watts, warmer #ffcb98 / #ffd6ac) used when `lights.PACK == 'goat'`. Model colours untouched. Forehead (1080x1920, graded): Ron 251,159,116 vs engine 247,171,111; Leo 252,185,146 vs 239,189,147.
- Re-export gb07 at 60 fps: `node tools/dump.cjs episodes/gb07.js out/gb07/blender/f60/dump.json --fps 60 --props out/gb07/blender/f60/props --set-dyn` (faces / overlay there stay valid); render with the same flags as before. Debug: ranged 30 fps dumps with `--props`, setup is only ~5 s per 400 frames.

## Stepped light levels + textured props (18/11, vay500)
- `blender/lightlevels.py` (called by `render_ep`; does nothing unless the dump has `header.light_groups` + `lg`): multiplies the Emission Strength of every emissive set piece by its group level (S / R / B / street), keyed per frame through a Math node in a per-group copy of the material; also STREET lamp glass + lamp lights, ATMOS cones (bulb x 0.35, lamps = street), BG_LIFE neon / TV / cross + their lights; `char_key` / `char_fill` lose up to 50 % and `char_key` cools with the darkness, `set_fill` sinks 88 %, so the cast stays brighter than the set.
- `props_cache.material`: a prop material with `mapFile` (dump.cjs --props writes `tex_<i>.png`) gets an image texture on Base Color (and Emission Color when it glows); uv not flipped for those.
- Phase-A stills command: `node tools/dump.cjs <ep> <dir>/dump.json --fps 30 --faces <dir>/faces --set-dyn --props <dir>/props`, `python3 blender/faces_hires.py <dir>/faces`, then `Blender -b --factory-startup -P blender/render_ep.py -- --dump <dir>/dump.json --set ~/studio-assets/sets/stall_plus.blend --set-collections SET,STREET,ATMOS,BG_LIFE --out <dir>/bl --samples 16 --plus motion,props,toon,camera,faces,atmos,fast_shadow --noqa --at t1,t2,...` (run_ep.py does not pass `--props` to the dump step yet: for the final render dump by hand with `--props` first, then `run_ep.py --dump`).

## HYBRID render: Blender draws the SET, cine3d draws the CAST (20/11, for gta6p2 "Tèo cướp tiệm tạp hoá?")
the owner 20/11: "Nhân vật thì không cần blender, em làm cho background đẹp lên là được." The characters stay the engine's own (exact models, faces, hood, standing, hands, held props), the set gets Blender's look (neon bloom, glass, glossy wet floor, soft shadows, set pieces moved by set fx).
One command: `python3 blender/hybrid.py demo/gta_shop_look.js|<id> --tag <name> [--from s --to s] [--fps 60] [--workers 3] [--cast-workers 2] [--samples 24] [--chunk 240] [--freeze-from s] [--set <set_cache.blend>] [--only dump,set,overlay,cast,render,compose,check]` -> `out/<id>/hybrid/<tag>/` (dump.json, overlay/, cast/, bl/frames/, `<id>_hybrid_<tag>.mp4`, report.json with seconds per step and smooth.py lines).
Layers, bottom to top, all with the SAME engine camera (no Blender smoothing / drift: `render_ep.py --nocast` sets `camera.EXACT`; the cast pass writes `cast/cams.json`, checked against the dump: max difference 5e-5):
1. Blender, set only (`render_ep.py --nocast`: no cast, no Line Art, no character lights, no QA; set_dyn pieces keyed as before), JPG;
2. compose.py display grade (sat 0.92, contrast 1.06) + vignette;
3. the CAST, `node blender/castpass.cjs <ep.js> <dir> [--fps] [--from --to | --at t,t] [--workers 2]`: the engine renders only the characters on a TRANSPARENT background; every OPAQUE set mesh stays in the scene as an invisible occluder (`colorWrite = false`, depth written), so the counter hides Lan's body, the door frame / jar / shelves cover what they should. Transparent / additive set parts (glass, glows, shards, cracks) are hidden in this pass: Blender draws them (so the cast is never tinted by the glass in front of it). Aperture 0 (characters crisp; Blender blurs the set from the dump's focus), bloom off on this layer (the bloom pass pushes alpha to 1 everywhere; the set's bloom comes from Blender). Patch done in the page only: the grade shader's alpha is clamped (`min(1.0, a)`) so the premultiplied cast does not burn out. Nothing in core/ or packs/ changed. `--workers N` splits the frame range into N contiguous runs (each page warms up 1 s before its run). 40 frames/s, so 3550 frames take about 1.5 min;
4. additive glows, grain, then the 2-D layer (`render.cjs pngseq --overlays-only --split-additive`): HUD, livestream frame, comment card, stamp.
`compose.py --cast <dir> --freeze-from <frame>`: the cast folder is overlaid after the grade; hit-stop (`ep.hits`): from that frame on the Blender picture and the cast frame are the held frame (symlinked), so neither is rendered for the frozen stretch (the overlay PNGs already repeat the hit state). `hybrid.py --freeze-from <t>` does it.
Measured (M4, 10 cores, 60 fps, 1080x1920, 24 samples, 3 Blender processes + 2 cast pages): 3 s clip (180 frames) = 4.6 min wall, 1.5 s per frame wall (about 3.2 s per frame in one process, set only), cast 13 s, compose 10 s, `tools/smooth.py` SMOOTH PASS on the 0-3 s clip (mean 0.058, worst 1 s window 0.115, worst jump 0.51; limit 6).
Not carried / to know:
- THE SET CACHE GOES STALE: `hybrid.py` reuses `out/<id>/blender/set_cache.blend` if it exists. After ANY change to the set code (gta_shop.js...) delete it (or pass `--set` to a fresh one). A stale cache hid the door cracks and shards and printed `SETDYN missing object c3dset_NNNN`.
- Cracks are thin ribbons: they read weaker in Blender than in the engine (dark-white lines); shards are transparent meshes (Blender glass look, dithered).
- The cast has no bloom, no depth of field and no reflections in the Blender glass / floor. A character behind glass is not tinted by it. Shadows: the engine's lights and shadow maps throw the CAST's shadows on the set (castpass pass B: every opaque set mesh gets a `ShadowMaterial` twin, the set's own shadow casters are switched off for that pass, opacity `--shadow 0.5`, `--no-shadows` to skip) and the shadow layer sits under the cast in the PNG; the set's shadows on the cast come from the engine's own shadow maps as before. Blender's own set shadows are unchanged.
- Both renderers light the cast / the set separately: the cast is the engine's frame, the set is darker and more saturated (Miami night); check each new place with `--at` stills before a full run.
- `blender/replay.cjs` (+ `blender/cast_replay.py`): a character REPLAY experiment (every mesh of a character followed from the engine, no rig) started before the scope changed. `replay.cjs` writes the per-frame data and was run on the look test; `cast_replay.py` is NOT tested and NOT wired into `render_ep.py`. Not used by the hybrid route.
