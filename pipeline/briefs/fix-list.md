<!-- driver: send with SendMessage to the SAME cine3d-builder that built {id}; no new agent, its model and effort stay -->
GOAL: apply the driver's ONE fix list to {id} in a single pass.
ALREADY DONE: your build passed qa and clipcheck; the driver read every sheet and strip against {treatment}.
READ: the list below and nothing new.
MAY WRITE: the same files as in the build brief ({episode}, its lips and props files, {out}). Touch nothing else.
FIX LIST (numbered; each item = what is wrong + what it must become, with time and shot):
<1. ...>
TRÀ ĐÁ ONLY (GOAT Beef ignores this line): the rules you fix against are Part 5.3 of the unified Blueprint 23/11 as mirrored in your agent file; a fix must not break any of the 6 doors (hook and opening, UI and clues, comedy and set, pace, ending and 10K bar, final hygiene), and the Final keeps no timecode, shot id or debug label.
MATTERS MOST, IN ORDER: apply every item as written, the last-third moments first; if an item looks wrong, apply the rest and say why you skipped it; never loosen a check.
DONE = `node {root}/tools/qa.cjs {episode}` and `node {root}/tools/clipcheck.cjs {episode}` PASS again; the strips of the changed actions re-read; `python3 {root}/tools/pipeline.py status {id} --run` shows no FAIL or STALE for picture. Re-render only after the driver says go.
REPORT: at most 8 lines: each item done or not, with the reason. Say what nobody checked.
