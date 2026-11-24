---
name: goatbeef-daily-build
description: Use when the owner asks to start or do today's GOAT Beef video ("bắt đầu dựng hôm nay", "dựng trong ngày hôm nay", "làm tập hôm nay", "làm bài hôm nay", "dựng tiếp GOAT Beef", "làm ngày tiếp theo"), or to move the GOAT Beef posting queue forward by one day.
---

# GOAT Beef: thin entry point
Load skill `studio-pipeline` (`~/.claude/skills/studio-pipeline/SKILL.md`), channel = `goat` (`pipeline.py new|adopt <id> --channel goat`), read `studio-pipeline/channels/goatbeef.md`, then follow `pipeline.py status <id>` and `next <id>`. The episode is the first TODO row of `~/goat-beef-test/QUEUE.md`; one row per run, never a batch (owner 08/11). The old nine-step day moved into `studio-pipeline` and the channel page; `references/builder-brief.md` (it briefed a retired v3 builder agent) is archived in vault `99 Archive/truoc-nen-mong-v4-20261113/`. Kept here: `references/new-episode.md`, `review.md`, `posting.md`.
Kept here because it has no other home:
- Daily mark: the first run of the Vietnam day writes today's weekly-% (`mcp__ccd_session_mgmt__get_usage`) as one line on top of STATE.md; stop the day's work at mark + 15 points.
- Posted or scheduled videos are never rebuilt or replaced. A new check after scheduling: leave that episode, apply the check from the next row.
- Agents kill only processes they started (no broad `pkill -f`). yt-dlp: one download at a time; on a bot check stop (no other clients, no cookies). At most 10 page loads per platform per run, no batch browsing.
- Where things are: plans `~/goat-beef-test/v2/script/` (`batch1_v3.md`, `epNN_*.md`); facts `~/goat-beef-test/news/factcheck_*.md`; engine `~/cine3d/ENGINE.md` (old v3: `~/goat-beef-test/v2/V3_ENGINE.md`); look standard vault `03 Projects/FootballBanter/Cach dung do hoa GOAT Beef v3 (08-11).md`; approved models: Ep 3 v3 (`~/Documents/Project/GOAT BEEF/03b Saudi League or MLS - v3/`), cine3d `episodes/gb04.js`.
- Craft carried over from Trà đá: Playbook sections A, B, D (path in `studio-pipeline/channels/trada.md`).
