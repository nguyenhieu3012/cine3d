# GEMINI.md — Gemini Studio Entry Point (`cine3d`)

> Standalone Gemini / Antigravity video production system for **Trà đá với AI** (`trada`) and **GOAT Beef** (`goat`). Completely independent of `.claude/` (never modify Claude configs or break legacy episodes).

## Quick Bootstrap (Progressive Disclosure — Read ONLY What You Need)
1. **Always load first (~3.3 KB):** `.agents/skills/gemini-studio/SKILL.md`
2. **Load 1 channel spec only:**
   - Trà đá với AI (Blueprint v2.0, `rules: 2`): `.agents/skills/gemini-studio/specs/trada.md`
   - GOAT Beef (`rules: 1`, US English): `.agents/skills/gemini-studio/specs/goat.md`
3. **3D Builder (`flash`) only:** `.agents/skills/gemini-studio/ENGINE-CORE.md` (~9 KB; lookup rare sets via `ENGINE-INDEX.md`). **Main (`Gemini 4 Neon High`) never reads the 164 KB `ENGINE.md`.**

## Core Commands
- **Start a Gemini Studio episode:**
  ```bash
  python3 tools/pipeline.py new <id> --channel trada --workflow gemini
  ```
- **Run orchestrated Python stages (`run_workflow`):** `.agents/workflows/episode_pipeline.py`
  - `stage="script_gate"` → deterministic `scriptlint` + blind `pro` gate + `voice.py need` credit quote (**stops for human approval**)
  - `stage="audio"` → verifies `credit_owner` unlock + `build_check.py --audio` → returns `out/<id>/audio/mix_preview.mp3` for Main to listen via `read_file`
  - `stage="build_and_gate"` → stateful `flash` builder (≤ 3 batched rounds via `build_check.py`) → 30fps CRF17 Final + `smooth.py` + `review_proxy.mp4` → blind `pro` multimodal 6-door gate (+ 1 consolidated fix pass if needed)
  - `stage="package"` → verifies `can-post` + `flash_lite` writes `out/<id>/goi-dang.md` (never auto-posts)
- **Unified check / render / proxy CLI (≤ 25 lines stdout):**
  ```bash
  python3 tools/build_check.py episodes/<id>.beats.json --audio   # mix + audiogate + lint + mix_preview.mp3 + SYNTH_FALLBACK check
  python3 tools/build_check.py episodes/<id>.js                  # auto-lips + qa.cjs + clipcheck.cjs
  python3 tools/build_check.py episodes/<id>.js --final          # check + 30fps CRF17 MP4 + smooth.py + review_proxy.mp4
  python3 tools/build_check.py episodes/<id>.js --spot 0.5,4.2   # targeted 1080p stills
  ```
- **Regression check after any `core/` or `packs/` edit:**
  ```bash
  python3 tools/regress.py              # owner machine (all ref stills)
  python3 tools/regress.py --available  # clean repo clone
  ```

## Non-Negotiable Safety Locks
- **ElevenLabs Credit Lock:** NEVER call `tools/voice.py record --yes` until `script_gate` PASS is fresh and owner explicitly approves via `pipeline.py record <id> credit_owner OK --by driver --quote "<owner words>"` (or `animatic_owner OK --quote` if owner requested a silent animatic preview first).
- **No Auto-Publish / Delete:** Never upload, schedule, or delete on YouTube/TikTok/Facebook without explicit owner order + `pipeline.py can-post <id>` PASS.
- **Native Multimodal Advantage:** Watch & listen directly via `read_file` on `out/<id>/review_proxy.mp4` (~2–4 MB) and `out/<id>/audio/mix_preview.mp3` (~550 KB) instead of generating contact sheets (`cs*.jpg`) or 8fps motion strips.
