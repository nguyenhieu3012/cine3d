# Gemini Studio (`cine3d`) — Implementation & Live Verification Report

> Built on `cine3d` (base commit `9365016`) as a standalone Gemini / Antigravity video production system (**Gemini 4 Neon High** orchestrating `pro`, `flash`, `flash_lite`, `browser` via Python `run_workflow`). Completely independent of `.claude/` and 100% backwards-compatible with existing Claude v1/v2 workflows and legacy episodes.

## 1. Delivered Components

### A. Standalone Gemini Studio System (`.agents/` + `GEMINI.md`)
| File | Size | Role |
|---|---:|---|
| `GEMINI.md` | 3.00 KB | Repo-root bootstrap for Gemini / Antigravity agents |
| `.agents/skills/gemini-studio/SKILL.md` | 3.84 KB | 6-phase workflow, model routing, safety locks |
| `.agents/skills/gemini-studio/specs/trada.md` | 4.67 KB | Single Source of Truth — Trà đá với AI (Blueprint v2.0, `rules: 2`) |
| `.agents/skills/gemini-studio/specs/goat.md` | 2.93 KB | Single Source of Truth — GOAT Beef (`rules: 1`, US English) |
| `.agents/skills/gemini-studio/ENGINE-CORE.md` | 9.11 KB | Distilled 3D authoring API for `flash` builders |
| `.agents/skills/gemini-studio/ENGINE-INDEX.md` | 1.89 KB | On-demand line-range lookup into `ENGINE.md` & `docs/` |
| `.agents/workflows/schemas.py` | 7.6 KB | 6 rigid JSON schemas (Trà đá 8-pt gate, GOAT Cold-Reader + Fact-Checker, Builder, 6-Door Video+Audio Gate, Packager) |
| `.agents/workflows/episode_pipeline.py` | 20.5 KB | Zero-token Python `run_workflow` orchestrator (`script_gate`, `audio`, `build_and_gate`, `package`, `dry_check`) |

### B. New Opt-In Engine Helper & Unified Tooling
- **`core/ep_kit.js`**: Opt-in ES module (`makeKit`, `v2Defaults`, `v2Hook`, `goatDefaults`) preventing shot gaps/overlaps and enforcing Blueprint v2 / GOAT defaults cleanly.
- **`tools/build_check.py`**: Single CLI replacing scattered `lips.cjs`, `qa.cjs`, `clipcheck.cjs`, `render.cjs`, `smooth.py`, `sheets.py`, `voice.py build`, `audiogate.py`, and `scriptlint.py` calls — returns **≤ 25 lines** to stdout + writes structured JSON (`out/<id>/build_check.json` / `audio_check.json`), encodes `out/<id>/review_proxy.mp4` (`540×960`, `24 fps`, `~2–4 MB`) and `out/<id>/audio/mix_preview.mp3` (`96k`, `~550 KB`), and flags `SYNTH_FALLBACK`.

### C. Backwards-Compatible Fixes in `cine3d` (`tools/`, `core/`, `audio_lib/`)
- `audio_lib/catalog.json`: fixed broken `mood_map.ai` (`"comedy_acoustic"` → `"comedy_quirky"`).
- `core/overlay.js`: kept `rules >= 2` 9:16 captions centered at `x: 540` with auto-capped `maxW: 710` (`x 185..895 < 900`, clearing Shorts/TikTok right UI zone without left-shifting Claude v2 captions; episodes can still override via `captions: { x, maxW }`); `rules: 1` & GOAT remain bit-identical.
- `tools/qa.cjs`: synced `V2` max length (`52.05 s`), resolved `hook` `text_time` vs `hook_timing` conflict, added `overlay_v2` text readability checks (`chatStrip`, `voiceNote`, `receipt`, `stamp`, `homThuSlip`, `questBadge`), allowed episode-level waivers (`tail`, `length`, `shot_rhythm`, `first_3s`) without fake object names while keeping shot-level checks strict, and removed hardcoded `1080×1920` bounds for `16:9` episodes.
- `tools/rules2.py` + `tools/voice.py` + `tools/pipeline.py`:
  - Added `--workflow gemini` (`STEPS_GEMINI`) + `credit_owner` lock (unlocks ElevenLabs spend ONLY when `script_gate` is `PASS` & fresh AND owner approved with `--quote`, allowing a **single 3D build on real times** while keeping `animatic_owner` strictly enforced for Claude v2).
  - Enforced strict Claude/Gemini isolation: Claude v2 episodes unlock ONLY via `animatic_owner` and require `cs*.jpg` for `driver_review`; Gemini episodes unlock via `credit_owner` (or optional `animatic_owner`) and accept `review_proxy.mp4`.
  - Fixed step-3 `script` false-stale cache key when `times.json`/`times.js` appear; added `rules2.py` to `audio` cache key; preserved `rules`/`workflow` in `cmd_copy`.
  - Enabled real CC0 `audio_lib` for both `rules: 2` and non-legacy GOAT Beef episodes (`sfxMode != 'synth'`), added `lib: "real"|"synth"` telemetry in `sfx_placed.json` + real/synth + `SYNTH_FALLBACK` console summary, fixed `UnboundLocalError` on `good`, guarded missing `~/tdvai/vo/lib/index.json`, and fixed Python 3.9 f-string syntax errors in `scriptlint.py`, `voice.py`, and `pipeline.py`.
- `tools/build_check.py`: parallelizes `qa.cjs` + `clipcheck.cjs` and post-render `smooth.py` + `review_proxy.mp4` + `cover.cjs` via `ThreadPoolExecutor`, supports SHA-256 verified `--reuse-check` (eliminating redundant back-to-back Chromium runs before `--final`), encodes compact mono `64k` `mix_preview.mp3`, reads `name` (with `sfx` fallback) from `sfx_placed.json` for accurate `SYNTH_FALLBACK` counts, requires `mix.wav` on non-demo `--final` builds (unless `--allow-silent`), verifies final MP4 media specs (`1080×1920`/`1920×1080`, requested CFR fps, duration, `aac@48000Hz` audio, cover exit code), and surfaces real error lines on tool crashes.
- `.agents/workflows/episode_pipeline.py` & `schemas.py`: pre-injects docs/specs/beats/times directly into `flash` builder & `pro` reviewer (saving 5–7 file-read turns per episode), passes `--reuse-check` on `--final`, auto-detects channel from `pipeline.json`/`beats.json`/`<id>.js`, mandates live `search_web` + cited `sources` for GOAT Fact-Checker, guards against recording stale MP4s after failed post-gate re-renders, and validates unique gate IDs (`1..8` / `1..6`) + real-times preflight before spawning `flash`.
- `tools/animatic.py`: skipped rendering ~500 unused Chromium timecode label PNGs when neither `--timecode` nor `--wide` is set.
- `tools/regress.py`: kept default `EPS`/`QA_KNOWN` untouched; added `--available` flag for clean repo clones.

---

## 2. Measured Verification & Benchmark Results

### A. Context & Documentation Footprint Reduction
- **Legacy docs** (`ENGINE.md` + `docs/` + `workflow/` + `agents/` + `pipeline/briefs/` + `skills/`): **38 files, 410.0 KB** (`ENGINE.md` alone = **164.0 KB**).
- **Gemini Studio docs** (all 6 markdown files combined): **25.4 KB** (**−93.8%** total).
- **Builder API doc** (`ENGINE-CORE.md`): **9.11 KB** vs `ENGINE.md` 164.0 KB (**−94.4%**).
- **Per-agent loaded context:**
  - Main (`Gemini 4 Neon High`): `SKILL.md` + 1 channel spec = **6.8–8.5 KB**.
  - Builder (`flash`): `ENGINE-CORE.md` + 1 channel spec = **12.0–13.8 KB**.

### B. Live End-to-End Test Matrix (All Observed on Local Machine)
| Verification Check | Command / Action | Measured Result |
|---|---|---|
| Python 3.9 & 3.12 compilation | `py_compile` on `tools/*.py`, `schemas.py` + `PyCF_ALLOW_TOP_LEVEL_AWAIT` on `episode_pipeline.py` | **PASS** (0 errors on both 3.9.6 & 3.12) |
| Audio Library Integrity | `python3 tools/sfx_lib.py verify` + `mood_map.ai` lookup | **PASS** (`55 files checked`, `mood_map.ai -> comedy_quirky`, 9 music / 27 SFX) |
| `core/ep_kit.js` Smoke Test | Node ESM import against `mekhongcanve.times.js` + `beats.json` | **PASS** (`13 lines`, `3 shots`, `lastT1=58.837`, `rules=2`) |
| `scriptlint.py` Backwards Compat | `gb11`, `mekhongcanve`, `gta6p2` `.beats.json` | **LINT PASS** on all 3 |
| Unified Picture Check (60.5 s ep) | `python3 tools/build_check.py episodes/gb11.js` | **BUILD_CHECK PASS** in **23.6 s** (`qa 19.0s`, `clip 4.6s`), **3 lines stdout** |
| Unified Final Render + Smooth + Proxy | `python3 tools/build_check.py demo/trada_v2_widgets.js --final` | **FINAL PASS** (`1080×1920 30fps 9.64 MB` in `71.7s`, `SMOOTH PASS` in `1.4s`, `review_proxy.mp4 540×960 24fps 0.97 MB` in `1.0s`, **6 lines stdout**) |
| Targeted Stills (`--spot`) | `python3 tools/build_check.py demo/trada_v2_widgets.js --spot 0.5,5.8` | **SPOT OK** (`2 stills` in `1.9s`) |
| Fast Proxy Transcode (`--proxy-only`) | `python3 tools/build_check.py demo/trada_v2_widgets.js --proxy-only` | **PROXY PASS** (`0.97 MB` in `1.1s`) |
| Native Gemini Multimodal Watch | `read_file("out/trada_v2_widgets/review_proxy.mp4")` | **VERIFIED** — watched all 15 s motion, verified `hook`, `chatStrip`, `callCard` red-only button, `voiceNote`, `receipt` + `stamp`, `questBadge`, `homThuSlip`, `look2` ink |
| Native Gemini Multimodal Listen | `read_file("out/_test_audio_preview.mp3")` (`96k 48kHz`, `48 KB` / 4 s) | **VERIFIED** — heard CC0 track cleanly directly via `read_file` |
| `run_workflow` Runtime Execution | `run_workflow(ScriptPath=".agents/workflows/episode_pipeline.py", Args={"stage":"dry_check",...})` | **PASS** (`ROOT` resolved, `6 schemas` loaded, numpy Python auto-detected, `AUDIO_LIB VERIFY PASS`) |
| Gemini State Machine & Credit Lock | 6-test integration suite (`new --workflow gemini`, step 3 cache stability, `voice.py record` exit 3 lock on both `rules=2` and `rules=1`, `credit_owner OK --quote` unlock, `driver_review` accepting `review_proxy.mp4`) | **ALL 6 PASS** |
| Regression Suite | `python3 tools/regress.py --available` (all 4 original demos + `trada_v2_widgets` + `gb11`) | **REGRESS PASS** (0 new failures) |

### C. Proxy Size & Visual Review Efficiency
- **Old Claude workflow:** 12–20 contact sheet PNGs/JPGs + 8 fps motion strips (~15–35 MB of images across 3 separate review layers, blind to motion & deaf to audio).
- **Gemini Studio:** **1 single `review_proxy.mp4`** (`0.97 MB` measured for 15 s → **~2.9–3.2 MB** for a 45–48 s episode, transcoded in **~1–2 s**) + **1 `mix_preview.mp3`** (`~540 KB` for 45 s) — watched and heard natively in 1 `read_file` call each.
