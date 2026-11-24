# Writing the script (the plan has no shot table yet, or the queue is empty)

> Since 13/11 (v4) every episode is built in cine3d through skill `studio-pipeline`: steps 4-6 of "New Full Beef" below describe the retired v3 build; use `pipeline.py next <id>` instead (voice by the voice-recorder, shot plan by `cine3d-builder`). The script rules and the Quickie row still apply.

The driver writes the lines (the owner found Opus lines clearly better than Sonnet's). Lines and facts are final once scored; the builder never changes them. Read `~/goat-beef-test/STYLE.md` first.

## Script rules (decided 13/11 from the retention data)
1. **The opening claim stands alone.** A viewer who has seen nothing else must get the first line. Never open on the last episode's bet or forfeit shirt (Ep 2 and Ep 3 did, and lost the cold viewer). The shirt may appear later, as a visual.
2. **The strongest joke lands before 3 s.**
3. **No stat-and-card round in the first 15 s.** That is where viewers leave (Ep 2 lost 58 points in 4-15 s, Ep 1 lost 46 in 5-14 s). Put the joke first; a number comes with a punchline, not on its own.
4. **At most ONE number per line.**
6. **"Ronaldo" or "Messi" in the title and on the cover.**
7. **Do not reuse the "Eight." ending or the "small, moved" last beat** (in 7 and 8 of 8 scripts). Vary the last beat: a savage ending with no warmth, Leo cracking first, a new callback. "Nobody asked!" at most once in any 3 episodes.
9. Spoken clarity: a punchword the speech check mishears ("Pessi" heard as "Desi") needs a clearer word or a repeat.

## Quickie row (lines already chosen)
The driver fills the quickie spec (`v2/data/quickie_template.js` fields): news card <= 6 words; 2 lines with ElevenLabs tags (tag text costs credits, keep tags short); one REUSED evidence scene; the reaction close-up; the quick-round winner. Reuse an existing clip whenever a line already exists (0 credit), but rule 7 applies to the ending.

## New Full Beef (queue empty)
1. **Idea.** Next unused idea in vault `03 Projects/FootballBanter/Y tuong thang dau.md` (running order in section 4), or a fresh Ronaldo/Messi news item from the last 24-48 h (fact gate first). Month 1 lane: Ronaldo vs Messi only.
2. **Lines.** 13-15 rows, <= 10 words per line, one true fact per line (rule 4: one number); every line should make the rival fan furious; no jokes about family, illness or death; Ron loud and whole-body, Leo deadpan; one turn near the end where one admits something, then the callback. Continuity: whoever lost the last round wears the other's shirt; the round score and season come from the last row of QUEUE.md. Write `episodes/epNN.json` (beats with who, tag, text, scene hint, point).
3. **Score the lines** (`review.md` part A) before any voice credit.
4. **Voice.** `node make.js voice epNN` shows the cost (about 640-770 credits); `--yes` spends it. One generation per line.
5. **Shot table.** Same shape as `v2/script/ep02_v2.md`: hook; per row camera token + picture + dismissal (different every turn, in character); end board + teaser; sound; QA list. Reuse sets first; at most 2 new sets per episode.
6. Add the row to QUEUE.md, then continue with `pipeline.py next <id>` (skill `studio-pipeline`).

## Format v4 (PROPOSED 13/11, use only after the owner approves; until then the 13/11 script rules above stand)
- The verdict is said as a claim in the first 2 s.
- The video takes one side openly (the board favours one fan, with a running grudge).
- At most ONE number in the whole video.
- 20-25 s.
- The end card asks a binary question tied to one moment of the video; the pinned comment repeats it.
- Never plant a false fact to be corrected.
- Written for a viewer in the USA (owner 13/11: 100 % English, aim at US views): "soccer" in titles and hashtags alongside "football", US spelling, references an American fan knows (MLS, Inter Miami, the 2026 World Cup on home soil) before European club detail.
- Measured by Studio's "How many chose to view", % still watching at 10 s, comments per 1,000 views. Also read the US share of views per video (`ledger.py`, column top_country and the country split): on 13/11 it was 14 % US against 22 % Vietnam; the goal is to raise it.
