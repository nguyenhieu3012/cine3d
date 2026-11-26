# Spec Kênh: GOAT Beef (`goat`) — v2.1 (1 Nguồn Sự Thật)

> 100% English · Target audience: US viewers aged 16–30 · Always `rules: 1`, `fps: 30`, `set: 'bar'`, `look2: true, act2: true` (opt-in on new eps via `packs/goat/look2_sets.js`), `setOpts: { steady: true }`, `castOpts: { leo: { cup: 'mate' } }`, `captions: { y: 1421, accent: '#ffe45a' }`.
> **MUST load with:** `.agents/skills/gemini-studio/WRITERS-ROOM.md` (3-Take Divergence, 6 Comedy Engines, US Pub Trash-Talk Kill List, dynamic `gap` & ElevenLabs `[tag]` delivery).

## 1. Cast, Dynamic & Steel-Man Rule
- **Ron (left, looks right):** Loud, proud, whole-body gestures, stands/slams table when triggered, boasts goals, big-game aura & trophies.
- **Leo (right, looks left):** Deadpan, calm, sips mate (`cup` pose), delivers surgical 2–6 word counter-punches. Mix gives Leo **+0.6 LU** over Ron so soft deadpan always cuts through.
- **MANDATORY Steel-Man & Reversal Rule:** **NEVER write a 10–0 strawman blowout!** The losing side MUST land **≥ 1 genuinely undeniable point** that makes the winner sweat or pause. In **≥ 1 of 3 episodes**, reverse roles so **Leo cracks first** (drops the mate / gets visibly rattled) while Ron stays smug!
- **US-First Voice Anchors:** Use **"soccer"** alongside **"football"** naturally; favor **MLS / Inter Miami / 2026 World Cup / US sports-bar cadence** over obscure European trivia. Never require watching last episode's bet.

## 2. Unified Runtime & Non-Negotiable Script Rules
- **Runtime (STRICT — no 60 s podcast bloat):**
  - **Quickie (`kind: "quickie"`):** **15–22 s** (1 hot news item `< 48 h`, instant claim `< 2 s`, 1 razor twist, comment war).
  - **Full Beef (`kind: "fullbeef"`):** **28–42 s** (hard ceiling `45 s`, speech share `60–75%`).
- **Standalone opening claim (< 2 s):** Viewers immediately know the argument without prior episodes.
- **Strongest joke / hook < 3 s**, first genuine laugh **< 6 s**.
- **Pure Banter + Physical Pub Comedy in `0–15 s`:** **ZERO stat-and-card rounds before 15 s** AND **≥ 2 physical pub gags** written in `"visual"` fields (pint slam, mate sip mid-rant, napkin math, bar stool turn, phone shove, crowd reaction).
- **Numbers Discipline:** **≤ 1 number per spoken line**, **≤ 4 distinct numbers per episode** (never turn banter into a Wikipedia recital).
- **Dynamic Rhythm & Voice Craft:** Vary `gap` (`0.05–0.10 s` interrupts, `0.18–0.24 s` ping-pong, `0.38–0.60 s` deadpan stares — NEVER flat `0.18` everywhere). Include ElevenLabs v4 `[tag]` in `"say"` on ≥ 40% of punchlines.
- **Vary Endings & Comedy Engines:** Rotate the 6 Comedy Engines (`WRITERS-ROOM.md`). Never repeat `"Eight."` or the small moved beat back-to-back; `"Nobody asked!"` max **1 in 3 episodes**.
- **Red Lines:** Zero family, illness, body, religion, or death jokes. Keep the rivalry sharp, funny, and comment-baiting.
- **End Card & Pinned Comment:** Pose a **specific binary debate question** tied to one concrete moment of the episode (never generic `"Ron or Leo?"`).
- **Title & Cover:** Always include **"Ronaldo"** or **"Messi"**; hook/cover words must differ from first spoken line.

## 3. Dual Script Gate + Entertainment Kill-Floors (Parallel `pro` subagents before voice credit)
1. **Cold-Reader (`SCRIPT_GATE_GOAT_SCHEMA`):**
   - Reads raw script cold (including `"visual"` + `"note"` + `"cards"`, NO logline/meta).
   - Must predict **swipe second > 6.0 s** and **first laugh < 6.0 s**.
   - Simulates 3 **distinct** viewer comments (`ronaldo_fan`, `messi_fan`, `neutral_us`): passes ONLY if **≥ 2 would genuinely comment** AND the two fans disagree!
   - **Entertainment Kill-Floors (ALL MUST BE ≥ 7/10):** `hook_thumbstop_score`, `comedy_or_emotion_punch_score`, `originality_score`, `dialogue_authenticity_score`, `visual_storytelling_score`, `loser_steelman_score`. Any score `< 7` = **AUTOMATIC FAIL** with exact weak lines flagged.
2. **Fact-Checker (`FACT_CHECK_GOAT_SCHEMA`):**
   - MUST verify every mutable claim in `card.facts` live via `search_web` (up to 20 queries, citing **≥ 2 independent sources** per mutable stat; never trust memory). Returns `GO` only if all claims are accurate and live-sourced. Automatically skipped only if `card.facts == []`.

## 4. Final Episode Gate (`review_proxy.mp4` 2-Step True Blind 6-Door Check)
- **Door 1:** Hook + claim clear in `< 2 s`, visual gag in opening shot, zero dead air in first `10 s`.
- **Door 2:** Stat cards (only after `15 s`) readable (`read_time` pass), no overlap with faces or bottom/right platform UI.
- **Door 3:** Ron big acting vs Leo deadpan contrast, hands touch props (`pint`/`mate`), speaker sync + 180° rule, clean captions (`y: 1421`, `#ffe45a`).
- **Door 4:** Snappy banter cut rhythm, no static dead holds, no reaction missed after burns.
- **Door 5:** Fresh ending beat + specific binary debate end card + tail `≤ 2.0 s` (`rules: 1`).
- **Door 6:** Clean `1080×1920 30fps CFR CRF 17`, `AAC 192k 48kHz`, zero debug text, Leo's deadpan crystal clear over pub banter/crowd SFX.

