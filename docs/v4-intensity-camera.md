# v4: intensity track + camera vocabulary (14/11)

All opt-in. An episode without `drive` and a shot without `whip` / `whipOut` / `whipIn` / `rack` / `fTo` / `move: 'dolly_zoom'` renders exactly as before (regress: every still inf dB). Code: `core/player.js` (track, drive, whip blur, hit-stop), `core/camera.js` (moves). Look tests: `demo/v4_drive_trada.js`, `demo/v4_drive_goat.js` (+ `_off` twins without the track).

## Intensity track
| field | default | range | example |
|---|---|---|---|
| `intensity` (episode) | none | `[[t, v]]`, v 0-10, straight lines between keys | `intensity: [[0, 2], [6.2, 3], [8.0, 9.5], [10, 3]]` |
| `times: T` (episode) | none | the voice.py times object; uses `T.tension` (held per beat) and `T.impacts` when `intensity` / `impacts` are absent | `times: T` |
| `impacts` | `times.impacts` or none | seconds (sound time) | `impacts: [8.0]` |
| `drive` | off | `{ camera, light, grade, time }` any subset; `true` = camera + light + grade | `drive: { camera: true, light: true, grade: true }` |
| shot `drive` | on | `false` = no drive on this shot (deadpan); `{ camera: false }` / `{ light: false }` / `{ grade: false }` | `{ cam: 'cu_bip', drive: false }` |

The curve is smoothed with a 1.0 s raised-cosine window (a step eases over ~0.6 s). `player.intensity(t)` gives 0..1, `player.breath(t)` 0..1. Numbers live in `DRIVE` at the bottom of `core/player.js`.
- **camera**: move amount x (1 + 2 * smoothstep(0.25, 1, highest I since the shot began)), so a push goes 5.5 % -> up to 16.5 % and never backs off; only when the shot has no `amt`. Handheld (cam-fx shake recipe at ~half frequency, 1.1-6 Hz) 0 -> 0.55 between I 0.62 and 0.95; off when the shot sets `shake`. Impact: push-in 8.4 %, eased out over 0.3 s from 0.1 s before the impact, held 0.4 s, released over 1.2 s; off when the shot has `punchAt`.
- **light**: breath = the smoothed curve rises >= ~3 points within the next 1.5 s: exposure x (1 - 0.5 * breath) (the `dim` formula, -50 %), fill (hemi) x (1 - 0.7 * breath), so the set sinks more than the faces. Peak (smoothstep 0.55-0.95): rim x 2.2, kick x 1.8; key unchanged (a brighter key clipped white faces). Calm (I < 0.3, no rise ahead): the set's preset.
- **grade** (k = smoothstep(0.3, 1, I)): contrast x (1 + 0.10 k), gain x (1 - 0.06 k), lift -0.025 k (all channels alike, no hue shift: deeper blacks, faces do not clip), saturation x (1 + 0.14 k), vignette +0.20 k; in a breath vignette +0.20 and saturation x 0.85.
- **time**: hit-stop of 0.1 s (6 frames at 60 fps) on every impact. `tools/smooth.py` reads only `ep.hits`, so waive the frozen frames: `waive: [{ check: 'smooth', t0: 7.95, t1: 8.15, reason: 'driven hit-stop' }]`.
Values written to lights / grade multiply what the set, look and fx left there that frame (a set that rewrites a light keeps working).

## Camera vocabulary (with or without the track)
| shot field | default | range | example |
|---|---|---|---|
| `whip` (inside a shot) | none | `{ at, d: 0.3, to }`, d 0.2-0.4; `to` a token or `'speaker'` (same size on the next line's speaker); optional `rig move amt punchAt fTo dof` for the landing framing | `whip: { at: 4.15, d: 0.3, to: 'speaker' }` |
| `whipOut` / `whipIn` (across a cut) | none | number = d (0.15-0.25) or `{ d: 0.2, deg: 32, dir }`; dir +1 = pan to screen right, default from the two subjects' seats | `whipOut: 0.2` on shot A, `whipIn: 0.2` on shot B |
| `whipBlur` | 16 | 8-24 sub-frames during the whip (360 degree shutter) | `whipBlur: 12` |
| `rack` | none | `{ at, d: 0.8, to, from? }` or a list; to/from = cast name or `[x, y, z]`; d >= 0.3; focus moves in dioptres | `rack: { at: 5.7, d: 0.8, from: 'teo', to: 'bip' }` |
| `move: 'dolly_zoom'` / `fTo` | lens to 0.55 x | `fTo` 20-120 mm; distance follows the lens so the subject keeps its size | `{ cam: 'cu_ron_lo', move: 'dolly_zoom' }`, `fTo: 40` |
| `free.fTo` | none | same, for a free shot (the camera slides along its sight line) | `free: { from, at, f: 50, fTo: 30 }` |
| `amt` | 1 | push / pull 0.5-6 (3-33 %; floor: never closer than 60 % of the framing distance), orbit 0.5-3 (4.5-27 deg), crane 0.5-2.5, drift 0.5-3 | `{ move: 'push', amt: 3 }` |

Whip: cubic ease in and out (inside a shot) or ease-in / ease-out matched at the cut (3 x deg / d each side); motion blur fades in with the pan speed. QA flags `subject_cut` / `face_dark` on the frames where the face is out of frame by design: waive those 0.2-0.4 s (`demo/v4_drive_goat.js`). Rack reads only with real depth of field and two subjects at different distances: ots shots or free shots with `dof: 3-4` (at 1 m separation default ots blur is ~10 px, too soft to see).
