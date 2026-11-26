# GEMINI.md — Gemini Studio Entry Point (`cine3d` v3.0)

> Standalone Gemini / Antigravity video production system for **Trà đá với AI** (`trada`) and **GOAT Beef** (`goat`). Completely independent of `.claude/` (never modify Claude configs or break legacy episodes).

## Quick Bootstrap (Progressive Disclosure — Read ONLY What You Need)
1. **Always load first (~4 KB):** `.agents/skills/gemini-studio/SKILL.md`
2. **Load for Ideation / Scripting / Punch-Up (~7 KB):** `.agents/skills/gemini-studio/WRITERS-ROOM.md`
3. **Load 1 channel spec only:**
   - Trà đá với AI (Blueprint v2.1 + v3.0 Diagrams, `rules: 2`): `.agents/skills/gemini-studio/specs/trada.md`
   - GOAT Beef (v3.0 Parity + Tifo/StatCard, `rules: 1`, US English): `.agents/skills/gemini-studio/specs/goat.md`
4. **3D Builder (`flash`) only:** `.agents/skills/gemini-studio/ENGINE-CORE.md` (~11 KB; lookup rare sets via `ENGINE-INDEX.md`). **Main (`Gemini 4 Neon High`) never reads the 164 KB `ENGINE.md`.**

## Core Commands
- **Start a Gemini Studio episode & 0-token scaffold:**
  ```bash
  python3 tools/pipeline.py new <id> --channel trada --workflow gemini
  python3 tools/scaffold_ep.py episodes/<id>.beats.json --layout standard|flow|compare|chart|corkboard|tactics
  ```
- **Add new Gemini `generate_image` sticker or 9:16 backdrop:**
  ```bash
  python3 tools/cutout_sticker.py raw.jpg packs/shared/stickers/<name>.png
  python3 tools/cutout_sticker.py --backdrop raw.jpg packs/shared/backdrops/<name>.jpg
  ```
- **Run orchestrated Python stages (`run_workflow`):** `.agents/workflows/episode_pipeline.py`
  - `stage="ideate"` → Writers' Room `pro` 3-take divergence pitch (Grounded / Visual / Wildcard) + kill rationale + card skeleton
  - `stage="script_gate"` → deterministic `scriptlint` + blind `pro` gate (sees `"visual"`/`"note"`/`"card"`, hides `meta`/logline; enforces 8-point + Entertainment Kill-Floors ≥ 7/10) + `voice.py need` credit quote (**stops for human approval**)
  - `stage="audio"` → verifies fail-closed `credit_owner` unlock + `build_check.py --audio` → returns `out/<id>/audio/mix_preview.mp3` for Main to listen via `read_file`
  - `stage="build_and_gate"` → 0-token `scaffold_ep.py` (when new) + stateful `flash` builder (declarative `overlay_board.js` + prebuilt stickers; ≤ 3 batched rounds via `build_check.py`, auto-escalates to `pro` on round 3 / `BLOCKED`) → checkpoint + auto-chunked 30fps CRF17 Final + `smooth.py` + `review_proxy.mp4` → true blind 2-step `pro` multimodal 6-door gate (+ 1 consolidated fix pass if needed)
  - `stage="package"` → verifies `can-post` + `flash_lite` writes `out/<id>/goi-dang.md` + validates file & title rules (never auto-posts)
- **Unified check / draft / render / proxy CLI (≤ 25 lines stdout):**
  ```bash
  python3 tools/build_check.py episodes/<id>.beats.json --audio   # mix + audiogate + lint + mix_preview.mp3 + SYNTH_FALLBACK check
  python3 tools/build_check.py episodes/<id>.js                  # auto-lips + qa.cjs + clipcheck.cjs
  python3 tools/build_check.py episodes/<id>.js --draft          # fast 12fps 540p layout preview (<2 min) -> draft_preview.mp4
  python3 tools/build_check.py episodes/<id>.js --final          # check + auto-chunked 30fps CRF17 MP4 + smooth.py + review_proxy.mp4
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
