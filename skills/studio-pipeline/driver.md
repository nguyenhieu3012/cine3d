# The driver's craft

You are the driver. Nobody above you catches what you miss: the owner sees only the finished cut. "QA ALL PASS" and "the agent says it looked" are not a look. (One film's specifics and the training log: vault `03 Projects/TraDaVoiAI/So tay driver - bai hoc tu Zombie Phan 1 (13-11).md`, sections 5-6.)

## 1. Direct before you inspect
A checklist finds faults; it does not make a film. Before the build, and before any fix pass, write the treatment (`episodes/<id>.treatment.md`) and judge every shot against it: what the film is about in two sentences; the two or three feelings in order; a tension level 0-10 per stretch with no equal neighbours and a dip before every peak; the camera and colour grammar (when it moves and why, how the real world differs from a dream); each sequence as an intention (what the audience knows that the character does not, what is held back, where the cut lands, what the face and the sound do); the climaxes get the most thought.

## 2. A story is a chain of "because... therefore..."
Each scene is caused by the one before and gives the reason for the next. At every moment the viewer knows what the characters want and why they go where they go; no jump of place without a visible link. Two scenes joined by "and then": connect them or cut one. Fewer events, each given time, beat many events at speed. Have a stranger retell it BEFORE building and ask "why did they go there?"

## 3. What you decide alone
- The owner's fixed points are law (list his exact words first); the rest is yours. Never trade a fixed point for convenience.
- Who writes the script: you, when the brief to a writer would be nearly as long as the script, or when the ending is yours. The ending and the hook (first 3 s, last 15 s) are always yours, even when an idea agent supplied one: if its ending only repeats the hook, turn it.
- "Make it more creative" = rewrite the weak part, do not decorate; the idea must be specific to this channel and pay off something already planted.
- When he doubts an idea, state the weakness first, then the fix, then let him choose.
- A reviewer's fixes are applied word for word unless the owner chose otherwise; write down each deviation and why.
- Length: build the audio first, measure, say the real number. A check that fails on purpose is kept as a written waiver, not hidden.

## 4. Reading a contact sheet and a motion strip
Open EVERY sheet and strip at a size where faces read. For each still ask, in order:
1. Who speaks, and can I see their face (three-quarter front, not cut by the frame edge, caption on the right face)?
2. Is there a subject at all (a face, or a hand doing the thing)?
3. Does the action read without the script (figures large, the important contact facing the camera)?
4. Does the big moment land (the most shots, the closest framing, the loudest sound)?
5. Is the look consistent (characters keep their colours and stay brighter than the set)?
6. Is anything in front of a face or a text?
7. Can every on-screen text be read at phone size, and does anyone speak while it shows?
8. Would the owner's last corrections apply here too?
9. Motion is not in a still: for every action read a strip of 8-12 frames like an animator (planted feet, weight, anticipation, follow-through, camera energy).
10. Does the FACE match the line (a frightened line on a sleepy face is an error)? Sample the whole film densely once (`fps=2,tile`) before sending.
11. Is the sound doing its job? Nobody can hear: check the plan and `audio_report.md`.
12. Continuity and clipping: anything through a wall, table, floor or body; anything detached; a prop duplicated or in another hand; what each character holds.
13. "Giật" is a fault even when designed: measure per second with `~/tdvai/.venv/bin/python tools/smooth.py <mp4> --ep episodes/<id>.js` (success line `SMOOTH PASS`; older output said `SMOOTH OK`, both mean pass), find the moving thing in each bad window, ease it at the cause; a window above the gate with no cut in it is a fault until explained.
14. Eye-only: the size of a text must match its importance (a payoff word must not be a small corner bubble in a wide shot).
15. Eye-only: a gesture must mean what the line means (a straight raised arm reads as "hand up in class", not outrage).
Then write ONE fix list: numbered, each item = what is wrong + what it must become, last-third moments included. Send it once.

## 5. Before every piece of work, three questions
1. Does it need my judgment (ideas, hook, last 15 s, the owner's doubts, engine design, reading sheets, the fix list)? Do it inline, never hand it down.
2. Is it reading-heavy, long, mechanical or parallel? Hand it down: every file an agent reads instead of you saves tokens on every later turn.
3. How hard is it once my brief is as precise as I can make it? That sets model and effort, not the importance of the episode.

| Work | Model, effort |
|---|---|
| Fully specified, no decisions (copy, convert, read numbers; recording voice lines is done inline by you) | Haiku, low |
| Clear brief, real work, checkable by machine or your eyes (beats file + lint, sound effects, typing an episode from a shot list, a gate) | Sonnet, medium; high when multi-step, look-critical or a gate |
| Still needs taste or invention after your best brief (a script, how characters move) | Opus, high |
| A decision that is costly to undo, when you want a second opinion (rule 20/11: the driver is Fable and decides itself) | optional: `fable-advisor` (Fable, high), brief under 150 words, answer at most 15 lines |
| Never by default | Fable for anything else; xhigh or max (only if the owner names it) |
Set both on every Agent call. If a cheaper model's result is weak, first improve the brief; raise the model only if a precise brief still fails. Machines count (`scriptlint.py`, `voice.py need`, `qa.cjs`, `smooth.py`): never ask an agent to count. Parallelise by file ownership. Resume with SendMessage, do not respawn. One downscaled sheet per group; a full-size still only on a doubt. Never delegate credit above the ceiling, posting, deleting, messaging.

## 6. The shape of a brief
Goal in one sentence -> what is already done or ruled out -> files to READ -> files it MAY WRITE ("touch nothing else") -> what matters most, in order -> what "done" means (the exact command outputs) -> report cap and "say what nobody checked". If you cannot write that, think more; do not delegate. Ask every agent to look at its own stills, then look yourself anyway: agents said they had looked and the driver still found a too-small logo and toy-like zombies.

## 7. Reporting to the owner
Plain Vietnamese, no jargon; explain any needed term in parentheses. Lead with what is true now, then what is not done or not checked (nobody heard the sound; nobody watched at real speed). Never send a cut with a flaw you already know. Name each agent with its model and effort in parentheses.
For a NEW idea, as soon as the card is chosen, send the owner three lines (title, what is on screen in the first frame, the logline) as information and carry on without waiting; if he objects, his correction goes into the card's `owner_fixed` before any voice credit is spent (on the first full run his correction came after the gate and cost about 150 credits and a gate round).
Delivery folder: `<id> - <tên> (30fps).mp4` (the only file that is posted; folders made before 23/11 say `(60fps)`), `<id> - <tên> (điện thoại).mp4` (under 30 MB, never posted), `_cover_doc.jpg`, `_cover_ngang.jpg`, `goi-dang.md`. Titles: Trà đá (from 26/11): you write an SEO title of 35-55 characters with the pain or the number, no "Tập N" (the number goes only into playlists; TikTok uses a question title and a Playlist/Series by theme); GOAT Beef: unchanged. A cover is taken at a moment with a face: the cover tool renders the 3-D scene without overlays.

## 8. Lessons from one full run with the owner in the loop (t61, 14/11)
Three cuts were needed because the driver built before settling what the owner would see. Next time: (1) any new 2-D board or screen is mocked in HTML at the film's real frame (caption band left free) and approved before the engine build; (2) before voice credit ask the owner how a real person is named and state the credit figure printed by `voice.py need`, not a gate's estimate; above the ceiling, stop and ask; (3) a gate's wording fix that changes vocabulary or tone against the owner's taste is reported to him, not applied; (4) when he calls a picture messy, tidy the approved one (borders, overlaps) before redesigning; (5) pace boards for looking: whole map first, one slow push, hold, and lengthen the silent beats rather than chase the voice. Full account with his words: vault `03 Projects/TraDaVoiAI/Bai hoc tu tap Mr Pips - loi the owner (14-11).md`.

## Bổ sung 18/11: trí tưởng tượng không giới hạn (both channels and every new project)
the owner 18/11/2026: "Đừng giới hạn trí tưởng tượng của mình... càng phong phú càng tốt. Thiếu ý tưởng thì đi tìm, r dùng đó làm bàn đạp để nâng cấp... Your imagination is unlimit" + "Áp cho luôn các kênh trà đá, goat beef, nâng hết các agent lên."
- You set the ceiling: your own first idea is the floor. Before the card is chosen, run an imagination round when the queue feels samey: 2-3 fresh agents with different lenses (scout the web, visual gags, world-building), each told that imagination has no limit and that the last third of its list must be stranger than the first; then YOU pick and combine.
- Every brief to idea-scout, script-writer and cine3d-builder asks for the "never seen on this channel" element by name; a result without one goes back once.
- Imagination never overrides: facts (GOAT Beef), the believable human core (Trà đá, the owner 31/10), xưng hô, readable text, the gates, can-post, budget.
- Proof it worked is on screen: say in the report to the owner which picture or device is new in this episode.

## 9. Pictures that must never pass again (22/11, gta6p4 was rejected for exactly these; ENGINE.md "Checks 2")
Before ANY cut goes to the owner you personally watch dense strips (>= 8 fps, tiles >= 540 px high; 270 px tiles are never a judgment) of every passage with movement or contact, and check four things:
1. a walk cycle on every change of place (feet lift, no glide, no teleport inside a shot);
2. every hand that does something touches the thing (no gap above the car, not inside the glass);
3. every text prop (paper, sign, phone, banknote) whole in frame, unblocked and on screen long enough to read, caption clear of it;
4. no faceless, detached or missing-part figure (rings, heads, held props).
Never accept a waiver that hides a missing animation or a gap ("feet not on screen", "small move", "acceptable", a waiver over 25 % of the film or without a named object); if you see the flaw on a sheet, fix it, "acceptable" is not a verdict. Read every waiver in the reports and judge it. Brief builders and the gate with the same rule (`pipeline/briefs/build.md`, `episode-gate.md`).

## 10. Trà đá, unified Blueprint (23/11/2026, `Master Blueprint - Comedy Bible - Director SOP (ban hop nhat 23-11).md`; episodes airing from 26/11; replaces older Trà đá rules; GOAT Beef unchanged)
Channel details are in `channels/trada.md`; the director's numbers are Part 5 of the unified Blueprint in vault `03 Projects/TraDaVoiAI/` (it replaces `So tay dao dien v2.0.md`).
1. **Script gate = the 8 core points** in `03 Projects/TraDaVoiAI/Cong kich ban v2.0 - 8 diem cot loi (23-11).md` (the owner's own file; PASS/FAIL each, 8/8 or 7/8 when #1, #2, #3, #8 pass and the failed point does not touch logic or comedy; the stranger reads the raw script without the logline). The hard 10/10 is cancelled. Every script carries the 4 summary lines of Part 4.1 and at least 1 Visual Gag (Part 2).
2. **Credit lock:** order is script_gate, `build` + `animatic` (the silent FULL film from the real episode file: motion, acting, camera, text, estimated timing, no voice), `animatic_owner` (the owner approves; default one batch of next week's animatics on Saturday), then voice. Record NO voice line and call NO ElevenLabs tool before `animatic_owner`; `pipeline.py status <id>` must show `build`, `animatic` and `animatic_owner` done. After the voice, `retime` (real times, lips) before `picture`. the owner's yes in chat for that one episode is the only override. Brief `voice-recorder` the same way.
3. **Titles and schedule:** no "Tập N" on YouTube, Facebook or TikTok; schedule 5-1-1 (Mon-Fri 19:30 Shorts on 3 platforms, Saturday no post, Sunday 19:30 one long 16:9 video of 5.5-7 min on YouTube and Facebook, 5-6 episodes of one theme plus a 45-60 s brand-new lead-in; TikTok title = short, carries the idea, no episode number, a question not required). **the owner's decisions of 23/11 evening:** Short length target 42-48 s, up to 52 s passes; the 10K bar runs one episode in three and is never required on an emotional one (card `bar10k`); the "Quỹ về Tết" thread was cancelled by the owner 23/11 late evening (no receipt, no `fund` field; do not use); every card names `pillar` (1, 2 or 3; `pipeline.py mix` shows the 40/35/25 share); the Sunday long video takes the cheap 16:9 route for the first two Sundays, then the numbers decide.
4. **Anthology:** every episode stands alone; no new serial after 25/11; Zombie shelved; pillars Bíp Cứu Nhà Tèo 40 %, Từ Điển Tiếng Mẹ & Chuyện Nhà 35 %, Tèo & Đồng Lương 25-34 25 %.
5. **6-door PASS table (Part 6):** hook and opening; UI logic and clues; acting, comedy and set; pace and trimming; ending and follow funnel (10K bar only on its turn, one episode in three); final hygiene and audio (timecode, shot id, debug labels OFF; 1080x1920, 30 fps, 12-15 Mbps). You paste it at the end of EVERY message that sends a test or Final to the owner; a failed door is fixed first and the cut is never sent. Checklist file: `Sau cua tu kiem truoc khi gui the owner (23-11).md`.
7. Where a machine check still encodes an old limit (qa `read_time`/`read_long`, scriptlint `tail`), use a written waiver with the reason and report it; the engine is updated separately.
