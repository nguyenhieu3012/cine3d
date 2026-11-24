# v4: sound gate, tension curve, sound build (14/11)

No agent can hear, so sound is measured and can fail. `voice.py build` now makes a mix that passes the gate by construction (nobody has listened to it: numbers only).

## Run order
1. `~/tdvai/.venv/bin/python tools/voice.py build episodes/<id>.beats.json` (`--legacy-mix` = the old mono mix, bit-identical, stems still written)
2. `python tools/scriptlint.py episodes/<id>.beats.json [--strict]`
3. `~/tdvai/.venv/bin/python tools/audiogate.py episodes/<id>.beats.json [--strict]` -> `AUDIO PASS` / `AUDIO FAIL (n)` + the list of SKIPPED checks, exit 1 on fail; `out/<id>/audio_report.md` (per 2 s: tension, voice, music, effects, bed, margin).
4. Foley only: `node tools/events.cjs episodes/<id>.js` (after step 1; about 1.5 x film length) writes `out/<id>/events.json`, then build again.
`tools/cuts.cjs` prints shot starts, hit-stops, set per time (the gate and voice.py call it).

## What build does by default (all off under `--legacy-mix`)
- **Stems** `out/<id>/audio/stem_voice|stem_music|stem_effects.wav` at the gain of the mix; the gate reads them (without stems it rebuilds the old graph). `sfx_placed.json` lists every effect as placed.
- **Voice on top:** every spoken line is kept >= 6.3 dB over music + effects (gate method, loudest 400 ms) by smooth gain automation per bus and per effect (fall over 70 ms ending at the line start, release 300 ms); prints a table. `marginWaive: "<reason>"` leaves a line alone. A hit that the duck had to bury is reported (put `impact` on a pause before the line).
- **Music follows tension:** gain curve from the beats' `tension` (a beat without one carries the value before it). The build measures check e itself and bends the curve (slope up to 5 dB per point, peak boost, extra dip) until the peak bed is >= 3.4 LU over the quiet beats and over the beat before, and the music bus alone rises too. A 0.45 s breath (-14 dB) comes before the top peak and every impact; after a tender/sad beat at tension >= 7 the music thins 5 dB for 3 s. score.py (Trà đá moods) also plays thin under tension <= 3, full from 6, and stings every impact. zombie score: gain curve only. If it still fails, the build says why (effects the author placed in calm beats, or a spoken peak line whose bed cannot exceed voice - 6).
- **Hits:** `"impact": true | "heavy"|"huge"|"scare"|"light"|"bright"` (+ `impactOff`, `impactGain`) gets an accent if none within 0.1 s (table `IMPACT_FX` / `IMPACT_BY_MOOD` at the top of voice.py: thud, boom, sting, pop, ting). `"snap": "cut"` on an effect, and the zombie score's sting / boom, move to the nearest cut or hit-stop within 150 ms.
- **Foley:** `"foley": "auto"` in the header or on a beat (`"off"` to exclude) places a step at every foot landing and a bite / thud / slide at the action events, surface by set (street, stall = pavement; market = tile; pub, bar = wood), replacing authored `footsteps` in that stretch; an authored accent within 0.15 s is kept instead.
- **Room tone:** a steady bed under the film by set (street, stall, zombie: `street`; market, pub, bar: `murmur`) 27 dB under the voice (header `"room": "off"` or `{"below": dB}`); `silence: true` ducks it 8 dB. Never digital silence.
- Mix is stereo, -14.0 LUFS final (the old mix folded the music to mono and ended at -14.2..-14.4).
- Times file (`episodes/<id>.times.js`, `out/<id>/audio/times.json`) also carries `tension: [[t, v], ...]` (beats that carry one) and `impacts: [t, ...]` (beat start + impactOff).

## Beat fields and header (optional)
`tension` 0-10 on EVERY beat, pauses too. `mood` (joy fear anger sad tender flat smug shock) on spoken beats only; a pause needs tension, not mood.
`land` only where something lands for the viewer, never every beat (WARN over 80 %): `laugh` a line or gag meant to get a laugh; `reveal` new information that changes how the viewer reads the scene; `gag` a wordless visual or prop joke; `turn` the story changes direction or power swaps.
`meta` is ONE header object, not per beat: `person sum opener sincere_beat withheld_opener thread`; `--strict` fails without it.

## scriptlint (`--help`: all rules)
Land rules (`land_8s`, `cliff_4_10`: first land by 6 s, a land in 3-10 s, no gap over 4 s) run when a beat has `land`, always under `--strict`.
Two sound rules (warnings, failures under `--strict`; the ids are printed): `peak_on_speech` = the top tension sits only on spoken beats (the bed stays 6 dB under a voice, so it can never be the loudest: move the top to the silent beat before or after); `impact_before_peak` = a beat marked `impact` right before the top beat (its accent makes the breath before the hit loud: take it off).
**Before the voice build** beat times are ESTIMATED from the text (0.79 s + 0.21 s per Vietnamese syllable, English 0.64 s + 0.29 s per word, plus `gap`, / `tempo`; about 1 s off early). It prints `TIMING ESTIMATED from text (no times file yet): re-run after voice.py build`; every timing rule runs on it except fast/slow rate. A rule that cannot run prints SKIPPED (fails under `--strict`).

## audiogate checks (constants at the top of the file)
a loudness -15..-13 LUFS, true peak <= -1; b voice >= 6 dB over bed in every line (names the bus / effect over it); c main speakers within 1.5 LU; d no dead air > 1 s under -50 LUFS unless `silence`; e (needs tension) peak bed >= 3 LU over the mean of beats <= 4 and >= 3 LU over the beat before (also prints the music bus alone); f an `impact` beat needs an accent within 100 ms (read from `sfx_placed.json`), accents within 80 ms of a cut counted; g clipping, DC, spectrum. A check that could not run is listed as SKIPPED in the verdict.

## Limits
The limiter is not modelled (~0.2 LU, hence the 0.3 dB / 0.4 LU slack). The gate checks shape, not taste. Foley contact moments of bite / trip / fall / pile are a fraction of the fx ramp (a core hook would make them exact).
