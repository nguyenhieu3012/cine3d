# Writers' Room & Comedy Craft Bible (`cine3d`)

> Load during **Ideation (`stage="ideate"`)**, **Scripting**, **Punch-Up**, and **Blind Script Gate (`stage="script_gate"`)**.
> **Core Rule:** Compliance is the floor, NOT the goal. A script that ticks every technical checkbox but feels predictable, preachy, or AI-written is an **automatic FAIL**.

---

## 1. Three-Take Divergence (Never Write Your First Idea)
Before locking any `card.json`, pitch **3 genuinely different takes** on the topic (different comedic mechanism, prop/visual device, or twist angle — NEVER 3 rewordings of the same joke):
1. **Take A — Grounded Relatable:** Everyday Hanoi / pub escalation rooted in a sharp real detail.
2. **Take B — Visual / Physical Escalation:** Story told ≥ 50% through props, screen UI, silent reaction beats, and physical comedy (works with **sound OFF**).
3. **Take C — WILD / Subversive:** Breaks channel autopilot (unexpected POV, literalized metaphor, role reversal, pop-culture parody, or "never seen on this channel" device).

Pick **1 winner** + write a 1-line **Kill Rationale** explaining why the other 2 were cut.

---

## 2. Six Comedy Engines (Rotate — Never Repeat Back-to-Back)
Stop defaulting to `"Tèo khoe → Bíp hỏi → Tèo lộ"` or `"Ron shouts → Leo says 'Eight.'"`:
1. **Reinterpretation (Lật nghĩa):** A single planted phrase, number, or prop from `0–8 s` means the exact opposite at `50–68%` (e.g., `"Mẹ không cần về"` = she already cooked and left the door open).
2. **Sunk-Cost Spiral (Đâm lao theo lao):** Tèo/Ron gets caught on a tiny lie at `4 s` and invents increasingly absurd lies to protect his ego until reality physically collapses on him.
3. **Deadpan Literalism (Hiểu theo nghĩa đen):** Bíp or Leo takes an exaggeration 100% literally and executes it with receipts, timers, or math.
4. **Status Reversal (Đảo vai):** The usual winner loses control (e.g., **Leo cracks first** on a stat Ron legitimately nailed; **Bíp gets briefly stumped** by Mẹ's logic; Tèo accidentally outsmarts a scammer by being too broke).
5. **Physical Metaphor (Ẩn dụ hữu hình):** Turn an abstract pain (payday vanishing, scam trap, Champions League drought) into a tangible 3D object/prop on the table or screen.
6. **Self-Own Trap (Tự đào hố):** Character builds an elaborate brag/excuse whose final proof accidentally exposes the exact thing they were hiding.

---

## 3. Channel Pacing Modes (One Size Does NOT Fit All)

### Trà đá với AI (`trada`, `rules: 2`)
Declare `"mode"` in `beats.json` header (`"comedy"` default):
- **`"comedy"` (30–52 s, sweet spot 34–46 s):** Snappy punch-counter rhythm, first laugh `< 5.5 s`, twist `45–68%`, sharp cut `≤ 0.8 s` after last beat. Funnel/bar10k optional (`≤ 1/3` episodes).
- **`"emotional"` (42–62 s):** Warm family/Mẹ stories (`mekhongcanve` style). Allow visual breathing (`35–60%` speech share!), first emotional hook/smile `< 7.5 s`, quiet lingering tail up to `2.5 s`, **ZERO forced CTA/clipper/bar10k** — end on a quiet human line or whisper-light `"Rò nước"`.
- **`"wildcard"` (35–60 s):** Pillar 4 parodies/high-concept (`gta6p2` style). Twist `35–75%`, tail `≤ 1.5 s`, custom prop/setplay allowed as long as human core stays Vietnamese & believable.

**Rebalanced Trà đá Pillar Mix (`pipeline.py mix`):**
- `1 Bíp Cứu Nhà Tèo` **25–30%** (scam comedy — NEVER a dry PSA; mock Tèo's pride or scammer's stupidity, ≥ 1 physical/UI visual gag)
- `2 Từ Điển Tiếng Mẹ & Chuyện Nhà` **35%** (relatable family/Mẹ subtext, warm + sharp)
- `3 Tèo & Đồng Lương` **20–25%** (broke 25–34 life, rent, debt ledger, payday illusions)
- `4 Wildcard / Parody / Pop Culture` **15%** (unbounded imagination lane — games, movies, absurd hypotheticals grounded in Tèo's broke Hanoi soul)

### GOAT Beef (`goat`, `rules: 1`, US English 16–30)
- **Quickie (15–22 s):** 1 hot football/soccer news item (< 48 h), instant claim `< 2 s`, 1 brutal twist/counter, binary comment bait.
- **Full Beef (28–42 s, hard ceiling 45 s — NEVER 60 s radio-play bloat):** Speech `60–75%`, pure banter + ≥ 2 physical pub gags in the first `15 s` (**ZERO stat cards before 15 s**), ≤ 1 number per line & ≤ 4 distinct numbers total.
- **MANDATORY Steel-Man Rule:** The losing side MUST land **at least ONE genuinely undeniable point** that makes the winner sweat (or reverse roles so **Leo cracks first** in ≥ 1 of 3 episodes). A 10-0 strawman blowout kills comments!
- **US-First Anchors:** Natural `"soccer"`/`"football"` mix, MLS / Inter Miami / 2026 World Cup / NBA-NFL sports-bar cadence. No niche European trivia without instant visual context.

---

## 4. Anti-AI Dialogue Audit (Kill List)

### Vietnamese (`trada`) — Real Hanoi Street Voice vs AI Textbook
| ❌ AI-Smell (INSTANT REWRITE) | ✅ Real Hanoi Tèo / Bíp Voice |
|---|---|
| *"Thật ra thì chuyện này rất đáng suy nghĩ."* | *"Nghe sai sai rồi đấy."* |
| *"Bạn có biết rằng lừa đảo rất nguy hiểm không?"* | *"Số lạ. Đừng bấm."* |
| *"Mẹ luôn yêu thương con vô điều kiện."* | *"Mẹ bảo đừng về. Cửa vẫn hé."* |
| *"Hãy chia sẻ video này cho người thân nhé!"* | *(Zero preach — cut on Bíp's deadpan receipt or Tèo's panic)* |
| *"Tôi cảm thấy vô cùng bất ngờ về điều này!"* | *"Ơ… khoan đã!"* / *"Đùa à?!"* |

- **Bíp Rule:** 1–6 syllables per sentence. Surgical, calm, dry. **NEVER** reads on-screen messages aloud; picks ONE fatal keyword to flip the scene.
- **Tèo Rule:** Uses Hanoi particles naturally (*"nhá", "đấy", "chứ lị", "khổ quá", "thật luôn?"*), 100% polite to Mẹ & Bà chủ (*"con/cháu … ạ"*), never lectures the audience.

### English (`goat`) — Real US Sports-Bar Trash Talk vs AI Essay
| ❌ AI-Smell (INSTANT REWRITE) | ✅ Real Ron / Leo Bar Banter |
|---|---|
| *"That is an interesting statistical comparison."* | *"Cool story. Check the trophy shelf."* |
| *"Let's break down why Messi is better."* | *"Bro brought a calculator to a bar fight."* |
| *"Who do you think is the real GOAT? Comment below!"* | *"Walked out at halftime — legend or fraud? Pick a side."* |

---

## 5. Performance Craft Inside `beats.json` (Show, Don't Just Talk)
1. **First-Class `"visual"` Field:** Every key beat (especially pauses & lands) MUST include `"visual": "<what moves/appears on screen — expression, prop action, UI card>"`. The Blind Script Gate reads `"visual"` + `"note"` so visual comedy is judged fairly!
2. **Dynamic `gap` Rhythm (NEVER Flat `0.18` Everywhere):**
   - Interrupt / cut-off / heated retort: `gap: 0.04–0.10`
   - Normal conversational ping-pong: `gap: 0.16–0.25`
   - Comedic beat / deadpan realization / double-take: `gap: 0.35–0.65` (or explicit `pause` + `"visual"` + `"sfx"`)
3. **ElevenLabs v4 Delivery Tags (`"say"`):** Put expressive tags on ≥ 40% of pivotal lines (never spam every line):
   - Tèo: `[boastful]`, `[nervous laugh]`, `[panicked]`, `[whispering]`, `[defensive]`, `[gulps]`, `[softly]`
   - Bíp: `[deadpan]`, `[flat]`, `[matter-of-fact]`, `[quietly]`
   - Ron: `[shouting]`, `[smug]`, `[outraged]`, `[scoffs]`, `[slams table]`
   - Leo: `[deadpan]`, `[dryly]`, `[sipping, calm]`, `[amused]`
4. **Loop / Rewatch & Comment-Bait Engineering:**
   - Plant 1 tiny visual or verbal clue in `0–5 s` that only clicks on **rewatch**.
   - End with a **seamless audio/idea loop** OR a sharp **specific debate question** (never generic `"Like & Follow"`).

---

## 6. Entertainment Kill-Floors (Blocking in `stage="script_gate"`)
Compliance checks alone CANNOT pass a boring script. The `pro` Blind Script Gate scores 5 craft axes (`1–10`) — **ANY score `< 7` = AUTOMATIC FAIL**:
1. **`hook_thumbstop_score` (≥ 7):** Would a cold stranger freeze their thumb in the first `1.5 s` with sound OFF?
2. **`comedy_or_emotion_punch_score` (≥ 7):** Genuine laugh-out-loud sting or real gut-punch (not polite smirk/cliché)?
3. **`originality_score` (≥ 7):** Distinct angle, twist, or "never-seen" visual gag — not recycled channel boilerplate?
4. **`dialogue_authenticity_score` (≥ 7):** Zero AI-smell, zero preachy moralizing, razor-sharp spoken Hanoi VN / US pub EN?
5. **`visual_storytelling_score` (≥ 7):** Picture & props carry ≥ 40% of the joke/emotion (not a podcast with 3D avatars)?
6. *(GOAT only)* **`loser_steelman_score` (≥ 7):** Does the losing side land ≥ 1 undeniable point that triggers real comment warfare?
