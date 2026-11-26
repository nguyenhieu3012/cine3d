# cine3d

A small real-3-D engine for 9:16 dialogue Shorts, plus the AI-agent workflow that drives it. Characters, sets, camera, lip-sync, text overlays and sound are code; each episode is a small data file.

![Stills rendered by the engine](media/stills.jpg)

**Tiếng Việt:** engine 3D tự viết cho video Short dọc, kèm toàn bộ quy trình: agent, skill, cổng kiểm máy, cổng kịch bản. Mỗi tập là một file dữ liệu, máy kiểm trước khi người xem.

## What is here

| Folder | Content |
|---|---|
| `core/`, `main.js`, `index.html` | Engine: stage, rig, gait, camera, overlays (`overlay_v2.js`, `overlay_board.js`, `media.js`), player, plus opt-in `core/ep_kit.js` authoring helper |
| `packs/` | Characters & sets (`trada`, `goat` with live `facePlus` for both) + `packs/shared/` (10 Gemini cutout stickers + 2 stylized 9:16 backdrops + `catalog.json`) |
| `episodes/` | Sample episodes: `gb11`, `gta6p2`, `mekhongcanve`, `thaylamgiau` |
| `demo/` | Look tests & v3.0 board demos (`demo/v3_board_trada.js`, `demo/v3_board_goat.js`) |
| `tools/` | Render, QA, clipcheck, smooth, scriptlint, voice/mix, audiogate, pipeline, `scaffold_ep.py`, `cutout_sticker.py`, unified `build_check.py` |
| `audio_lib/` | Sound effects, ambience, music; sources in `audio_lib/LICENSES.md` |
| `blender/` | Retired Blender path, kept for reference |
| `pipeline/` | Step table and brief templates for the agents |
| `agents/`, `skills/` | Claude Code agents and skills (builder, reviewers, script writer, idea scout) |
| `.agents/`, `GEMINI.md` | **Gemini Studio v3.0**: standalone Gemini / Antigravity workflow (skills, compact channel specs, `WRITERS-ROOM.md`, `ENGINE-CORE.md`, JSON schemas, Python `run_workflow` orchestrator) |
| `workflow/` | Production workflow, model routing, script gate, self-check, machine checks (mostly Vietnamese) |
| `ENGINE.md`, `docs/` | Engine manual and benchmark notes (`docs/gemini-studio-benchmark.md`) |

## How an episode is made

1. Card, then a one-page treatment.
2. Script and `beats.json`, checked by `tools/scriptlint.py`, then read by an independent reviewer agent.
3. Build, then a silent animatic that the owner approves. Voice credit is locked until then.
4. Voice, mix, `tools/audiogate.py`, retiming.
5. Picture checks: `tools/qa.cjs`, `tools/clipcheck.cjs`, `tools/smooth.py`.
6. Render at 30 fps, then a blind review by another agent, then the owner.

## Gemini Studio v3.0 (Gemini / Antigravity Workflow)

A standalone, Gemini-native production system placed cleanly in `.agents/` and `GEMINI.md` (zero changes to `.claude/`, 100% backwards-compatible with existing Claude workflows and legacy episodes).

**Tiếng Việt:** Hệ thống sản xuất video dành riêng cho **Gemini / Antigravity** (độc lập hoàn toàn với bộ Claude cũ), tận dụng lợi thế **xem video chuyển động thật & nghe âm thanh thật trực tiếp**, hệ sinh thái trình bày 2D khai báo + sticker Gemini (`overlay_board.js`), khởi tạo khung 0-token (`scaffold_ep.py`), xem nháp nhanh `--draft`, và điều phối bằng Python (`run_workflow` = 0 token).

### What's new in v3.0 (YouTube 2026 Upgrade)
- **Declarative 2D Visual Explainer Engine (`core/overlay_board.js` + `core/media.js` + `core/ep_kit.js`):** 5 built-in `boardOverlay` layouts (`flow`, `compare` with 9:16 vertical `stack`, `chart`, `corkboard` with pins/red strings/magnifying glass, and Tifo Football `tactics` pitch), plus `goatStatCard`, `sticker`/`image` (Vox 12fps stutter + white paper-cutout rim), `highlighter`, `setswapBackdrop` (painted 2D backdrop + Ken Burns), and `diagramRig()`. Cuts diagram authoring code & tokens by ~90%, with automatic QA read extraction in `tools/qa.cjs`.
- **Gemini Cutout Sticker & Backdrop Library (`packs/shared/` + `tools/cutout_sticker.py`):** 10 cohesive ink-outlined transparent PNG stickers + 2 stylized `1080×1920` backdrops + `catalog.json` with reusable style prompts.
- **0-Token Scaffolder & Faster Rendering (`tools/scaffold_ep.py` + `tools/build_check.py`):** Generates QA-ready `episodes/<id>.js` directly from `beats.json` at 0 tokens (auto-run inside `episode_pipeline.py`); adds `--draft` (12fps 540p layout preview in `< 2 min`) and `--chunks auto` (frame-accurate chunked rendering + lossless concat for long episodes).
- **GOAT Beef v3.0 Parity (`packs/goat/faceplus.js` + `packs/goat/fans.js` + `main.js`):** Enables `look2: true, act2: true, facePlus: true` by default in `goatDefaults()` with live English phoneme→viseme lip-sync, blinks, saccades, and Quickie 18s fast-track.
- **Core v2.1 Foundation (retained):** Strict fail-closed ElevenLabs credit lock (`credit_owner OK --quote`), Writers' Room 3-take divergence + Entertainment Kill-Floors ≥ 7/10, 16:9 native overlay/post support, `L2SETS.bar`, native multimodal review via `review_proxy.mp4` & `mix_preview.mp3`, and verified real CC0 `audio_lib`.

### Quick start (Gemini Studio v3.0)

```bash
# 1. Start a Gemini-workflow episode & generate 0-token QA-ready scaffold
python3 tools/pipeline.py new <id> --channel trada --workflow gemini
python3 tools/scaffold_ep.py episodes/<id>.beats.json --layout standard|flow|compare|chart|corkboard|tactics

# 2. Cut out a new Gemini generate_image sticker or 9:16 backdrop
python3 tools/cutout_sticker.py raw.jpg packs/shared/stickers/<name>.png
python3 tools/cutout_sticker.py --backdrop raw.jpg packs/shared/backdrops/<name>.jpg

# 3. Unified audio build + gate + real-time lint + mix_preview.mp3 + SYNTH_FALLBACK check
python3 tools/build_check.py episodes/<id>.beats.json --audio

# 4. Unified picture check + fast 12fps draft preview (< 2 min)
python3 tools/build_check.py episodes/<id>.js
python3 tools/build_check.py episodes/<id>.js --draft

# 5. Final auto-chunked 30fps CRF17 render + smooth.py + review_proxy.mp4 (~2-4 MB)
python3 tools/build_check.py episodes/<id>.js --final

# 6. Regression check & v3.0 demos
python3 tools/regress.py              # full reference stills (owner machine)
python3 tools/regress.py --available  # public repo clone
python3 tools/build_check.py demo/v3_board_trada.js --draft
python3 tools/build_check.py demo/v3_board_goat.js --draft
```

See [GEMINI.md](GEMINI.md), [.agents/skills/gemini-studio/SKILL.md](.agents/skills/gemini-studio/SKILL.md), and [docs/gemini-studio-benchmark.md](docs/gemini-studio-benchmark.md) for full workflow details and live benchmark measurements.

## Run it

```bash
npm install
npx playwright install chromium
node tools/render.cjs stills episodes/gb11.js out/stills 8
node tools/qa.cjs episodes/gb11.js
```

Node and ffmpeg are required; the Python tools that handle sound also need numpy and scipy. Tested on macOS with Metal; other systems were not tested.

## Not included

Recorded voices, rendered video, unreleased episodes, channel accounts and posting tools, channel statistics, API keys, original fonts (system fonts are used, so text looks different) and two music tracks of unclear origin. Voice IDs are placeholders. Some notes mention files that live outside this repo.

## Rights

No licence is granted for the code, characters and texts. Sound files and textures keep their own licences (see `audio_lib/LICENSES.md` and `packs/trada/assets/stall_plus/README.md`). Fan parody content is not affiliated with any person, club, game or company it mentions.
