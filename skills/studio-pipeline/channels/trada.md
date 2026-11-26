# Channel Spec Pointer: Trà đá với AI (`trada`)

> Local repository reference for `agents/idea-scout.md`, `pipeline/briefs/idea.md`, and `tools/pipeline.py` (keeps clean repo clones self-contained without missing `~/.claude/skills/studio-pipeline/channels/trada.md`).

## Gates — Idea Card Fields (`episodes/<id>.card.json`)
Required by `tools/pipeline.py`:
- `title`: SEO title 35–55 chars (no `"Tập N"`, avoid repeating last 4 title templates)
- `person`: Real person in viewer's life (`Mẹ`, `Bà chủ quán`, `Chủ trọ`, `Đồng nghiệp`...)
- `sum`: Concrete sum of money or concrete stake (`500K`, `nợ 24 cốc`, `lương 5tr8`...)
- `recipient`: Who a viewer sends this to on Zalo/Messenger and why
- `first_frame`: What is visible at `00:00` (ECU/CU face or incident object, works sound-off)
- `kind`: `standalone` | `special` | `series:<name>`
- `pillar` (`rules: 2`): `1 Bíp Cứu Nhà Tèo` | `2 Từ Điển Tiếng Mẹ & Chuyện Nhà` | `3 Tèo & Đồng Lương` | `4 Wildcard / Parody`
- `mode` (optional, default `comedy`): `comedy` (30–52s) | `emotional` (42–62s) | `wildcard` (35–60s)
- `comedy_engine` (recommended): `reinterpretation` | `sunk_cost` | `literalism` | `status_reversal` | `physical_metaphor` | `self_own`
- `bar10k`: `"yes"` (max 1 in 3 comedy eps; NEVER on emotional) | `"no"`
- `script_doc`: Path to script doc (optional)
- `owner_fixed`: List of owner-locked lines/beats (optional)

## Full Specs & Craft Guides
- Channel spec: `.agents/skills/gemini-studio/specs/trada.md`
- Writers' Room & Comedy Craft Bible: `.agents/skills/gemini-studio/WRITERS-ROOM.md`
- 8-Point Script Gate: `workflow/script-gate-8-points.md`
