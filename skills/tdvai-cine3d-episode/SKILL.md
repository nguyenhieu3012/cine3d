---
name: tdvai-cine3d-episode
description: Use when the owner asks to make, remake or continue a "Trà đá với AI" episode in the new 3-D engine ("làm tập mới", "dựng tập Trà đá", "làm Ngày 13", "làm lại tập", "làm tiếp series nhịn hạt", "dựng tập hôm nay"), or when a main session of any model has to drive one episode end to end by delegating to agents. Not for GOAT Beef (goatbeef-daily-build) or posting.
---

# Trà đá với AI: thin entry point
Load skill `studio-pipeline` (`~/.claude/skills/studio-pipeline/SKILL.md`), channel = `trada` (`pipeline.py new|adopt <id> --channel trada`), read `studio-pipeline/channels/trada.md`, then follow `pipeline.py status <id>` and `next <id>`. The step table, laws, "what stays with the driver" and the model table that were here now live in `studio-pipeline/SKILL.md` and `driver.md`; the previous text is archived in vault `99 Archive/truoc-nen-mong-v4-20261113/`.
From 26/11 the channel runs on the unified Blueprint 23/11 (`Master Blueprint - Comedy Bible - Director SOP (ban hop nhat 23-11).md`): the rules are in its section of `channels/trada.md` (8-point script gate with 4 summary lines and the Comedy Bible, 5-1-1 with the Sunday long film, the 6-door PASS table pasted to the owner with every test or Final, the Saturday ledger of Part 8.1, the silent FULL-film animatic (build the picture on estimated times first, `tools/animatic.py`) and credit lock before voice, retime + lips after the voice, 2-tier hook, double ending of 4-5 s, anthology). They replace anything older below.
Kept here because it has no other home (Trà đá only):
- A script is not ready for the gate unless a word planted mid-episode pays off in the last third (price ladder and callback chain, Playbook A2, A5); check the three corrections of Ngày 12 (Playbook D) every time.
- No new serial after 25/11 (anthology: every episode stands alone). A sequel the owner still names: read the approved previous episode's facts first (Ngày 13 once contradicted Ngày 12).
- Times come from `episodes/<id>.times.js`, never typed by hand. A prop gag gets its own `free` shot held 1.2 s or more. A second joke idea becomes another round of the same game at a higher price.
- Look for: drawings too small for a phone, an aura washing the background, a card over a face. `python3 tools/sheets.py <ep> <t0> <t1>` takes the two times as two separate arguments.
- Two builds at once: give each agent its own list of editable files (ENGINE.md, "One writer per file").
