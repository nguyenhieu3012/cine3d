<!-- driver: Agent voice-recorder, model haiku, effort low -->
GOAL: record the missing voice lines of {id} ({channel_name}), one take each, within the credit ceiling.
ALREADY DONE: the script passed its gate; {beats} is final. Do not change any text.
READ: the output of `~/tdvai/.venv/bin/python {root}/tools/voice.py need {beats}`; this brief.
MAY WRITE: `{root}/voice/{id}/<beat id>.mp3` only.
VOICES (do not choose others): <speaker: voice id, pitch, one line per speaker>. Model eleven_v4, `generations_count: 1`. Emotion tag only where the beat's `say` has one. Recording route, in order: the ElevenLabs connector if your session has one; else `~/tdvai/.venv/bin/python ~/cine3d/tools/voice.py record episodes/<id>.beats.json --ceiling <credits>` (dry run; `--yes` records, at most 5 lines per call, refuses above the ceiling, key never printed); if neither works, stop and report.
CEILING: <N credits>. Never re-record a line that already has a take. If the next line would pass the ceiling, stop and report. Record at most 5 lines, then report and wait for the driver's go. A changed line gets a NEW beat id, never the old id with new text.
DONE = `~/tdvai/.venv/bin/python {root}/tools/voice.py need {beats}` lists no missing line. (The driver runs `voice.py build` and the audio gate.)
REPORT: at most 6 lines: lines recorded, characters sent per line (the driver computes spend from `out/{id}/voice_need.json` and the files on disk, never from your total; the balance cannot be read), any line not recorded and why. You never post or change text.
