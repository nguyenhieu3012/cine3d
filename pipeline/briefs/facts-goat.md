<!-- driver: Agent goatbeef-fact-checker, model sonnet, effort medium -->
GOAL: check every fact of script {id} that can change or be wrong, so nothing false is voiced or posted.
ALREADY DONE: the script passed the cold read; facts already marked GO in <factcheck files, or none>.
READ: the lines and fact list in {script_doc}; the files named above. Nothing else.
MAY WRITE: `~/goat-beef-test/news/factcheck_{id}.md` only.
MATTERS MOST, IN ORDER: 1. scores, counts, dates, records, standings, transfers, quotes, anything "just happened"; 2. two independent major outlets per number (one source = NO-GO or "single source"); 3. each count labelled AS OF its date, with the list RE-CHECK ON AIR DAY; 4. at most 20 web requests, unchecked lines marked NOT CHECKED.
DONE = the file is written, every fact line has a verdict, the last line says GO, GO WITH FIXES (list) or NO-GO. The driver records it with `pipeline.py record {id} facts`.
REPORT: at most 15 lines: path, overall verdict, each changed value (old -> new), the air-day list, requests used. You never edit the script.
