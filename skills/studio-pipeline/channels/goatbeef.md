# Channel Spec Pointer: GOAT Beef (`goat`)

> Local repository reference for `agents/idea-scout.md`, `pipeline/briefs/idea.md`, and `tools/pipeline.py` (keeps clean repo clones self-contained without missing `~/.claude/skills/studio-pipeline/channels/goatbeef.md`).

## Gates — Idea Card Fields (`episodes/<id>.card.json`)
Required by `tools/pipeline.py`:
- `title`: English title containing `"Ronaldo"` or `"Messi"` (never duplicate first spoken line)
- `claim`: One-sentence debatable standalone claim understandable in `< 2 s`
- `side`: `"ron"` | `"leo"` (who wins the round — avoid 10-0 blowouts; steel-man the loser!)
- `comment_ron`: Realistic comment a Ronaldo fan will argue in replies (≤ 15 words)
- `comment_leo`: Realistic comment a Messi fan will argue in replies (≤ 15 words)
- `facts`: List of mutable football/soccer claims to live-verify via Fact-Checker (`[]` if pure banter)
- `kind`: `"quickie"` (15–22 s news reaction) | `"fullbeef"` (28–42 s debate, hard ceiling 45 s)
- `comedy_engine` (recommended): `reinterpretation` | `sunk_cost` | `literalism` | `status_reversal` | `physical_metaphor` | `self_own`
- `steelman_beat` (recommended): The 1 undeniable point the losing side lands
- `script_doc`: Path to script doc (optional)
- `owner_fixed`: List of owner-locked lines/beats (optional)

## Full Specs & Craft Guides
- Channel spec: `.agents/skills/gemini-studio/specs/goat.md`
- Writers' Room & Comedy Craft Bible: `.agents/skills/gemini-studio/WRITERS-ROOM.md`
- Cold-Reader Gate: `agents/goatbeef-cold-reader.md`
