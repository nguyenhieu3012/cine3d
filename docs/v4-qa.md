# v4 machine checks (13/11)

`node tools/qa.cjs <ep.js> [--beats f.json]` samples every 0.25 s of every shot (min 3; always t0+0.05, t1-0.05, each line midpoint), free shots too.

| check | measures | fails when |
|---|---|---|
| same_framing | resolved camera (focal length, target = pos + view*focus, view angle) at end of shot i-1 vs start of i | all within 12 % / 12 % of distance / 20 deg. 20 deg so `ms_x` then `ms_x_lo` (15) fails; `ms_a`/`ms_b` (target 20 %) and `ms`/`cu` pass |
| first_3s | distinct resolved framings starting before 3 s | < 3 |
| subject_cut, ui_zone | free shots: each `who`/`free.who`, else the speaker on screen: head inside the frame, centre inside x 54-1026, y 150-1536 | < 85 % of the head inside, behind the camera, centre in a UI zone. `who`-less shot whose speaker is < 10 % in frame = prop insert, skipped |
| face_away | speaker's head-forward vs the direction to the camera, any shot | > 75 deg (approved episodes max 58) |
| speaker_off, no_lips, text_time, text_on_speech | as before | now failures |
| emo_missing | spoken line without `emo` (line, or an act within 0.7 s before). Bíp, Chíp, zombies skipped | any |
| face_mood | beats `mood` (joy fear anger sad tender flat smug shock; optional; matched by line `id`): face of the speaker or a visible listener at the line midpoint | obviously wrong family (table in qa.cjs). Bíp only for shock/fear; a listener never given an `emo` is not judged |
| text_fit | each drawn text: 16 px padding in its box, inside x 54-1026, y 150-1536 | any |
| text_occlusion | text (a caption, or an overlay text that is not exempt: see Panels) over >= 10 % of a visible head | any |
| subject_visible | subject's head >15 % under a text, or >25 % under a bigger head | any |
| hold_on_action | shot with `action:true`, or a `set` prop act starting >= 0.3 s before the cut | shot < 1.2 s |

| read_time | every message the viewer must read (14/11) | on screen < `1.0 + characters / 12` s (tolerance 0.15 s). Counted from the moment it has appeared (after the typing dots, its `t`) to the moment it leaves. The same text shown again by another overlay that starts within 0.3 s of the previous one ending is one continuous showing |
| read_long | the same messages | more than 60 characters (nobody reads that in a Short: shorten it or show only the part that matters) |
| draw_undeclared | every `kind: 'draw'` overlay | declares neither `reads` nor `noText` |

Declaring (14/11): `phone` overlay: every `msgs` entry counts, visible from its `t` to the overlay's `t1`. `draw` overlay: add `reads: [{ text, t0, t1 }]` (one entry per text the viewer must read, with its real visible window) or `noText: true` when the insert shows no text to read. A helper that draws bubbles builds `reads` from its own ids and times (see `thread` in `episodes/t60.js`). Waive with the normal `waive` list (`check: 'read_time'`), with a reason. Fixing it = shorter text or a longer beat, never a looser formula.

`insert: true` on a shot = deliberate insert, no subject checks.

## Panels (14/11): which overlay texts may sit over a head
The owner of a text is the drawer `core/overlay.js drawOverlays` called, whatever helper then drew it (qa reads the call stack). Exempt from text_occlusion AND subject_visible: (1) every text of an engine panel kind: `phone call calling transfer balance qr msgcard blank counter score chest backdrop freeze_rewind title iris white_flash cold end` (core/overlay.js, overlay_zb.js: screens, cards, dimmers made to be read); (2) a text drawn by an episode's own `kind: 'draw'` overlay ONLY when it sits inside a panel-sized box that the same overlay drew (at least 640 x 400 px on 1080x1920: chat panel, bank card), so a shot may show such a panel over a character without a `free` workaround. NOT exempt, always checked against faces: captions; every text of `hook chip bubble thought notify unlock pill`; texts of a `draw` overlay outside a big box (chips, call bars, floating message bubbles). A text of a `draw` overlay whose function has no name in the stack (anonymous arrow) stays exempt as before. Exempt does not waive text_fit.

## Waivers
Episode field `waive: [{ check: 'face_away', t0: 12.0, t1: 12.6, reason: 'Tèo turns his back on purpose' }]`. Inside the window the finding prints `WAIVED ... -- waiver: <reason>`, is counted in the summary (`waived N`), does not fail. An unused waiver warns. `check: 'smooth'` works in smooth.py (also `--ignore t0-t1`).

## smooth.py
`~/tdvai/.venv/bin/python tools/smooth.py out/<id>/<id>.mp4 --ep episodes/<id>.js` (or `--cuts t,t`; no positional episode argument). Last line `SMOOTH PASS (SMOOTH OK)` exit 0, else `SMOOTH FAIL` exit 1. Cuts by time from the episode (auto for `out/<id>/`); no `d < 12` mask. Skipped: cut frames, hit-stops, +-2 frames at overlay starts/ends, waivers. FAIL: a 1 s window mean jump > 0.60, any jump > 6.0 (about 2x Ngày 12: 0.29 / 2.7), or old rule (mean > 0.12, > 2 duplicates). Worst 3 jumps: `out/<id>/smooth_worst_N.jpg` = before | after | difference, red box = what changed.

## regress.py
gb04 added (7 stills). `QA_KNOWN` = faults v4 found in approved episodes, so it still answers "did my edit change a look". Never grow it to pass.
