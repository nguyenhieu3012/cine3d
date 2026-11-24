# Spec Kênh: GOAT Beef (`goat`) — 1 Nguồn Sự Thật

> 100% English · Target audience: US viewers aged 16–30 · Always `rules: 1`, `fps: 30`, `set: 'bar'`, `setOpts: { steady: true }`, `castOpts: { leo: { cup: 'mate' } }`, `captions: { y: 1421, accent: '#ffe45a' }`.

## 1. Cast & Dynamic
- **Ron (left, looks right):** Loud, proud, whole-body gestures, stands/slams table when triggered, boasts goals & trophies.
- **Leo (right, looks left):** Deadpan, calm, sips mate (`cup` pose), delivers surgical 2–6 word counter-punches. Mix gives Leo **+0.6 LU** over Ron so soft deadpan always cuts through.
- **US-First Voice Anchors:** Use **"soccer"** alongside **"football"** naturally; favor **MLS / Inter Miami / 2026 World Cup** references over obscure European club trivia. Never reference last episode's bet as required context.

## 2. Non-Negotiable Content & Script Rules
- **Standalone opening claim (< 2 s):** Viewers immediately know the argument without watching earlier episodes.
- **Strongest joke / hook < 3 s**, first laugh **< 6 s**.
- **NO stat-and-card round in the first 15 s** (pure banter + physical comedy first).
- **≤ 1 number per spoken line** (never pile stats into one sentence).
- **Vary endings:** Never repeat `"Eight."` or the small moved beat back-to-back; `"Nobody asked!"` max **1 in 3 episodes**.
- **Red lines:** Zero family, illness, or death jokes. Keep the rivalry fun, sharp, and comment-baiting.
- **End card & pinned comment:** Must pose a clean **binary question** so Ronaldo fans and Messi fans argue in comments.
- **Title & cover:** Always include **"Ronaldo"** or **"Messi"**; hook/cover words must differ from first spoken line.

## 3. Dual Script Gate (Parallel `pro` subagents before voice credit)
1. **Cold-Reader (`SCRIPT_GATE_GOAT_SCHEMA`):**
   - Reads raw script cold (no logline).
   - Must predict **swipe second > 6 s** and **first laugh < 6 s**.
   - Simulates 3 real viewer comments (**Ronaldo fan**, **Messi fan**, **neutral US scroller**): passes ONLY if **≥ 2 would genuinely comment** and the two fans disagree!
2. **Fact-Checker (`FACT_CHECK_GOAT_SCHEMA`):**
   - Verifies every claim in `card.facts` (GO / NOGO). Automatically skipped only if `card.facts == []`.

## 4. Final Episode Gate (`review_proxy.mp4` 6-Door Check)
- **Door 1:** Hook + claim clear in < 2 s, visual gag in opening shot, zero dead air in first 10 s.
- **Door 2:** Stat cards (only after 15 s) readable (`read_time` pass), no overlap with faces or bottom/right platform UI.
- **Door 3:** Ron big acting vs Leo deadpan contrast, hands touch props (`pint`/`mate`), speaker sync + 180° rule, clean captions (`y: 1421`, `#ffe45a`).
- **Door 4:** Snappy banter cut rhythm, no static dead holds, no reaction missed after burns.
- **Door 5:** Fresh ending beat + binary debate end card + tail ≤ 2.0 s (`rules: 1`).
- **Door 6:** Clean 1080×1920 30fps CFR CRF 17, AAC 192k 48kHz, zero debug text, Leo's deadpan crystal clear over pub banter/crowd SFX.
