---
Type: assistant rule (model routing + delegation)
Status: active — supersedes every earlier fixed model-per-task rule
Confidence: high
Scope: every Claude Code session and every sub-agent, all projects
Source: the owner 2026-10-31 (chat "Phiên tạm 3"): "I made the mistake of using Sonnet to delegate tasks to models such as Opus… burning tokens without a huge result… you, Opus 5.5, are the main driver, and you can spawn however many Sonnet sub-agents… I don't want to lock down on what model for each task… understand its complexity and delegate accordingly… be proactive."
Last seen: 2026-10-31
---

# Model routing: Opus drives, picks sub-agents per task

## The rule
1. **The main session is Opus 5.5, the driver.** It understands the request, plans, makes the decisions, does the creative and quality judgment, writes every brief, checks every result and talks to the owner.
   - If a session is not running Opus when heavy work starts, tell the owner once in a single line, then carry on.
2. **No fixed model per task type.** For every delegation, the driver judges how complex that specific piece is and chooses the model AND the effort. Older notes that say "Opus dựng", "Opus chấm", "Fable viết" or "Sonnet điều phối" describe the old fixed routing. The quality gates in those notes still apply; the model running them is now the driver's call.
3. **Delegate proactively.** the owner authorizes spawning sub-agents, any number, on the driver's own judgment, without asking first, whenever it saves tokens or time. Actions that need the owner's yes still need it: spending ElevenLabs or other credits, publishing, deleting, messaging, purchases.
4. **On every Agent call, set `model` and `effort` explicitly.** This note is the owner's standing instruction to do so. The `model:` / `effort:` lines in agent files (`~/.claude/agents/*.md`) are only a fallback for when no override is given.

## When to delegate, and when not to
Delegate:
- independent pieces that can run in parallel;
- wide search, web research or bulk reading where only the conclusion matters;
- long mechanical runs: renders, batch file work, data collection, uploads from a finished package;
- work whose raw output would flood the driver's context;
- a fresh-eyes review of something the driver made.

Do it inline (no spawn):
- anything a handful of tool calls settles. A sub-agent starts cold and re-reads context, so small jobs cost more when delegated;
- the hard thinking itself. The driver works out the hard part, then hands a cheaper model a precise brief.

## Picking the model (judge each piece, not the task's label)
| Model | Use when the piece is… | Examples |
|---|---|---|
| **Haiku** | fully specified, mechanical, little judgment | move/rename files, pull fields out of known files, format conversion, yes/no checklist on a clear spec |
| **Sonnet** (default for sub-agents) | real work with a clear brief or method | web/video research and idea scouting, summaries, routine code and scripts, running builds and renders from a spec, channel ops and uploads, data analysis, first drafts, rubric-based gate checks |
| **Opus** | still needs top-tier judgment after the best brief the driver can write | debugging that Sonnet already failed, creative work where quality is the bottleneck and the driver cannot do it inline, a final gate where a miss is expensive (big credit spend, publishing) |
| **Fable** | not used | only if the owner asks by name (about 2× Opus cost) |

## Picking the effort
- **low**: mechanical, one obvious path.
- **medium**: default for routine sub-agent work.
- **high**: multi-step, ambiguous, creative, or a quality gate.
- **xhigh / max**: never by default. Only when the owner asks, or after `high` already failed on the same problem.

Escalation: when a sub-agent's output is weak, first fix the brief. Then go up one step (effort first, then model), and only once. Record what changed in the report.

## How to delegate well (keeps tokens low)
- **Self-contained brief:** goal, exact file paths, constraints and banned actions, what "done" looks like, where to write output, and a report cap (≤ 8–12 lines).
- **Resume, don't respawn:** use SendMessage to continue an agent that already holds the context instead of starting a new one.
- **Run in the background** when pieces run in parallel. Never poll; wait for the notification.
- **Verify before reporting:** check that claimed files exist and spot-check numbers. A sub-agent's report is a claim, not proof.
- **Tell the owner what ran:** every time an agent is mentioned to the owner, write its model and effort in parentheses right after it, e.g. "agent chấm cổng (Sonnet, high)" (the owner 31/10), so he learns which model gets which kind of work and sees where the tokens went.

## Related
- Budget habits: `03 Projects/TraDaVoiAI/Quy trinh lam video viral (27-10).md`, section "Luật tiết kiệm token".
- Agent fallbacks: `08 Assistant System/agents/README.md`.
- Correction log: `02 Memory/corrections.md` (2026-10-31).

## Trần mỗi ngày (the owner 07/11/2026)
Mỗi ngày chỉ dùng tối đa **15% hạn mức weekly**, tính chung mọi kênh và mọi phiên. Việc không xong trong 15% thì để sang ngày mai. Đo bằng `get_usage`: lần đọc đầu ngày làm mốc, ngày tính theo giờ Việt Nam. the owner nói "15% width", Claude hiểu là weekly, chưa hỏi lại.


## Bổ sung 19/11/2026: Opus làm chính, Fable 5.2 làm cố vấn
Lời the owner: "bây giờ main session thì sẽ là Opus làm rồi, tất cả những cái gì mà Opus chuẩn bị làm thì sẽ hỏi advisor là Fable 5.2. Những cái việc gì cần quyết định thì nó sẽ hỏi advisor Fable rồi mới làm, chứ Fable không, nếu mà việc gì thật sự khó thì Fable sẽ trực tiếp nhúng tay vào làm."
- Phiên chính = Opus 5.5 (the owner gõ "Opus 5.52"; driver hiểu là Opus 5.5).
- Trước khi làm một việc có quyết định (chốt ý, câu móc, kết, nhận hay bác kết quả cổng, thiết kế engine, kế hoạch việc mới, tiêu credit, bản gửi the owner), Opus hỏi agent `fable-advisor` (model fable, effort high): đề bài dưới 300 từ, trả lời tối đa 15 dòng.
- Việc máy móc, việc máy kiểm quyết thì không cần hỏi.
- Fable chỉ tự tay làm khi việc thật sự khó (cố vấn nói vậy, hoặc Opus và agent đã thử hai lần không được).
- Hạn mức Fable nhỏ: mỗi lần hỏi phải ngắn; dùng lại cùng một cố vấn trong phiên bằng SendMessage.
- Luật cũ "không dùng Fable trừ khi the owner nêu tên" nay đọc là: Fable chỉ ở vai cố vấn này, hoặc khi the owner nêu tên.

## Bổ sung 20/11/2026: Fable 5.2 làm chính, quản lý tất cả
Lời the owner: "Nhớ là blender nhé. Fable lo giao việc cho cno cho anh, r chốt cuối" và "Vẫn là fable quản lý tâts cả."
- Phiên chính = Fable 5.2: lên kế hoạch, quyết định, viết brief, giao việc cho agent, kiểm kết quả, chốt bản cuối, nói chuyện với the owner. Thay cho mục 19/11 (Opus làm chính, Fable cố vấn) và mọi chỗ ghi "Opus 5.5 is the driver" ở trên.
- Không còn bước bắt buộc hỏi cố vấn. Agent `fable-advisor` chỉ dùng khi cần một ý kiến thứ hai từ ngữ cảnh sạch cho quyết định khó đảo lại; đề bài dưới 150 chữ.
- Agent con: Haiku cho việc máy móc, Sonnet mặc định, Opus khi brief tốt nhất vẫn cần phán đoán cao. Mỗi lần gọi đặt model + effort và nêu trong ngoặc khi nói với the owner.
- Hạn mức Fable nhỏ: phiên chính phải gọn (giao việc đọc cho agent, bàn giao sang phiên mới trước khoảng 300K ngữ cảnh). Số đo mở agent và các sửa tiết kiệm token: `04 Work/Bao cao sua workflow (20-11).md`.


## Auto-compact 400K (the owner 23/11/2026 tối; 200K lúc trưa)
