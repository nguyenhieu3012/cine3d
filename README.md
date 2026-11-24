# cine3d

A small real-3-D engine for 9:16 dialogue Shorts, plus the AI-agent workflow that drives it. Characters, sets, camera, lip-sync, text overlays and sound are code; each episode is a small data file.

![Stills rendered by the engine](media/stills.jpg)

**Tiếng Việt:** engine 3D tự viết cho video Short dọc, kèm toàn bộ quy trình: agent, skill, cổng kiểm máy, cổng kịch bản. Mỗi tập là một file dữ liệu, máy kiểm trước khi người xem.

## What is here

| Folder | Content |
|---|---|
| `core/`, `main.js`, `index.html` | Engine: stage, rig, gait, camera, overlays, player |
| `packs/` | Characters and sets of two shows: a Vietnamese tea stall (`trada`) and an English football pub (`goat`) |
| `episodes/` | Three sample episodes: `gb11`, `gta6p2`, `mekhongcanve` |
| `demo/` | Look tests for sets, props and effects |
| `tools/` | Render, QA, collision check, smoothness check, script lint, animatic, voice and mix, audio gate, pipeline |
| `audio_lib/` | Sound effects, ambience, music; sources in `audio_lib/LICENSES.md` |
| `blender/` | Retired Blender path, kept for reference |
| `pipeline/` | Step table and brief templates for the agents |
| `agents/`, `skills/` | Claude Code agents and skills (builder, reviewers, script writer, idea scout) |
| `workflow/` | Production workflow, model routing, script gate, self-check, machine checks (mostly Vietnamese) |
| `ENGINE.md`, `docs/` | Engine manual |

## How an episode is made

1. Card, then a one-page treatment.
2. Script and `beats.json`, checked by `tools/scriptlint.py`, then read by an independent reviewer agent.
3. Build, then a silent animatic that the owner approves. Voice credit is locked until then.
4. Voice, mix, `tools/audiogate.py`, retiming.
5. Picture checks: `tools/qa.cjs`, `tools/clipcheck.cjs`, `tools/smooth.py`.
6. Render at 30 fps, then a blind review by another agent, then the owner.

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
