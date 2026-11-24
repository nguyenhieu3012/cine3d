# cine3d ENGINE-CORE (Builder Reference — ~9 KB)

> Distilled API for `flash` builders. Covers 95% of Trà đá v2 & GOAT Beef episodes without loading the 164 KB `ENGINE.md`. For rare sets (GTA, Zombie, `setswap`, `slomo`, `chest`), look up exact lines in `ENGINE-INDEX.md`.

## 1. Quick Boilerplate (`core/ep_kit.js`)
Prefer `core/ep_kit.js` to avoid shot gaps/overlaps and boilerplate bugs:
```js
import T from './<id>.times.js';
import B from './<id>.beats.json' with { type: 'json' };
import { makeKit, v2Defaults, v2Hook, goatDefaults } from '../core/ep_kit.js';
const K = makeKit(T, B), { s, e, mid, dur } = K;

const LOOK = { l1: { emo: 'smug', pose: 'phone' }, l2: { emo: 'deadpan', pose: 'cross' } };
const shots = K.shots()
  .cut(2.1, 'cu_teo', { move: 'push', amt: 0.7 })
  .cutEnd('l2', 'ms_bip', { move: 'push', amt: 0.5 })
  .fill('two', { move: 'pull', amt: 0.4, hold: true })
  .list();
const acts = K.acts()
  .init('teo', { emo: 'smug', pose: 'phone' })
  .init('bip', { emo: 'neutral', pose: 'table' })
  .atStart('l2', 'teo', { emo: 'shock', nod: 'jolt' })
  .list();

export default {
  ...v2Defaults({ id: '<id>', dur, lipsFile: 'episodes/<id>_lips.json' }),
  cast: ['teo', 'bip'], // add 'ba'|'me'|'khach' if on stage
  shots, lines: K.lines(LOOK), acts,
  overlays: [ v2Hook('HACK NICK, VAY 5 TRIỆU') ],
};
```
- **Defaults:** `v2Defaults()` sets `pack:'trada', set:'stall', fps:30, rules:2, look2:true, act2:true, setOpts:{ plus:true, menuBrand:true }, captions:{ y:1385 }, partners:{ teo:'bip', bip:'teo' }`. Add `setOpts: { mailbox: true }` whenever Hòm Thư appears.
- **GOAT defaults:** `goatDefaults()` sets `pack:'goat', set:'bar', fps:30, setOpts:{ steady:true }, castOpts:{ leo:{ cup:'mate' } }, captions:{ y:1421, accent:'#ffe45a' }, partners:{ ron:'leo', leo:'ron' }`.
- **16:9 Sunday compilation:** `aspect: '16:9'` (or `size: [1920, 1080]`); all `overlay_v2` widgets & captions adapt automatically.

## 2. Shots & Camera (`core/camera.js`)
Tokens: `wide` (27mm) · `all` (35mm, ≥3 cast) · `two` (42mm, both) · `ms_<who>` (58mm, default talk) · `cu_<who>` (85mm, punchline/react) · `ecu_<who>` (105mm, 1 climax beat) · `ots_<who>` (58mm over partner's shoulder).
- Suffixes: `_lo` (power/bravado) · `_hi` (shame/defeat). Engine enforces 180° rule automatically.
- Shot options:
  - `move`: `'push'` (default) | `'pull'` | `'orbit'` | `'crane'` | `'drift'` | `'none'` · `amt` (0.3–1.4)
  - `punchAt: t | [t1, t2]` (8% push on stressed word) · `whip: 0.14` (whip pan in) · `rack: { from, to, t0, t1 }`
  - `eyes: { teo: 'cam' }` · `dof` (0 = all sharp) · `focusOn: 'bip'` · `shake` · `dutch` (deg) · `v: 1` (mirrored `two`/`wide`)
  - `hold: true` (deliberate shot > 3 s) · `action: true` (prop/move beat, must last ≥ 1.2 s) · `insert: true` (prop close-up)
  - `rig: { f, head, az, el, eye }` (override framing; **QA eye_line requires eyes at 28–44% from top**: default tokens are already safe — NEVER set `rig.eye > 0.41`, and on `_lo` low-angle shots like `cu_teo_lo` keep `rig.eye <= 0.34` or omit `rig`!)
  - `free: { from: [x,y,z], at: [x,y,z], f, dof }` (custom camera; QA still checks framing & exposure!)
  - **First-3s & rhythm rule (Round-1 PASS):** ALWAYS place **≥ 3 distinct resolved camera framings in `0..3.0 s`** (e.g., `0.0–1.0 cu_teo`, `1.0–2.0 ms_bip`, `2.0–3.2 two`) and aim for **6 shots (~2.0 s avg)** in `0..12 s` (never 7 shots = 1.71 s avg, which fails `shot_rhythm`!). Keep top overlays compact (`y: 260..345`) so they never cover > 15% of a subject's head.
  - Multi-cast: `frame: ['teo', 'bip', 'ba']` on `two`/`wide`/`all`; `partner: 'ba'` on singles.
- Episode-level timing FX: `hits: [{ t, frames: 3 }]` (hit-stop freeze on slam/impact).

## 3. Cast, Faces, Poses & Acting
Every spoken line MUST have an `emo` matching its beat's `mood` (`qa.cjs` checks `face_mood`!).
- **Trà đá (`packs/trada/chars.js`, `people.js`):**
  - `TEO_FACE` (also used by `ba`, `me`, `khach`): `neutral, happy, smug, shock, worry, sad, cry, angry, think, deadpan, sleepy, zen, power, squeeze, moved, terror, dread, scream`
  - `BIP_FACE`: `neutral` (flat bars = default judging stare), `judge, smug, side, deadpan, happy, shock, worry, sad, angry, think, love, scan, wavy`
  - `TEO_POSE`: `rest, table, point, pointL, me, raise, cheer, facepalm, chin, shrug, cross, hug, phone, cup, head, beg, zen, give, push, pushA, pushB, grip, cover, pinch, gag, stop, reach, sleep, side, fists, shoo, pushGlasses, guard, phoneHold, phoneNear, phoneSlap, swipeIdle, scroll, phoneEar, slipHold, brush, flail, hips, ticket, sign, bag, drive, gloat, keypad`
  - `BIP_POSE`: `rest, table, point, pointL, me, raise, cheer, facepalm, chin, shrug, hug, cross, phone, cup, head, beg, side, poke, shoo, waveUp, clasp, finger, tap, block, hugB, phoneUp, plug, hand, handL, wipe, wipeR, printing, rigid`
  - `people.js` extras (`ba`, `me`, `khach`): Tèo's faces + poses `hips, wave, give, scold`.
- **GOAT Beef (`packs/goat/fans.js`):**
  - `RON_FACE` / `LEO_FACE`: `neutral, happy, smug, shock, worry, sad, cry, angry, think, deadpan, laugh, sarcastic, horror, unimpressed`
  - `FAN_POSE`: `rest, table, point, pointL, me, raise, cheer, facepalm, chin, shrug, cross, phone, cup, head, beg, siu, clap, siuJ`
- **Acts (`ep.acts`):** `{ t, who, emo?, pose?, look?: 'cam'|'partner'|'<who>'|'down'|'up'|'away', d?, nod?: 'yes'|'no'|'jolt', fx?: { ... } }`
  - `who: 'set'` drives stall/bar fx: `phoneUp: 0|1`, `dim: 0..1`, `spill`, `cold`, `blackout`, `steadyLights` levels.
  - Line flags: `noCap: true` (suppress subtitle when big phone card is up), `think: true` (thought/inner voice).

## 4. Overlays (`core/overlay_v2.js` + `core/overlay.js`)
**Safe zones (9:16 v2):** keep widgets centered around `x: 472` (`x 54..890`, strictly clear of right platform UI `x > 900`), `y 224..1220` (above captions at `y: 1385`, clear of bottom UI `y > 1536`). Captions in `rules: 2` stay centered at `x: 540` with auto-capped `maxW: 710` (`x 185..895 < 900`; override via `captions: { x, maxW }` if needed).
- **Blueprint v2 Floating Widgets (`core/overlay_v2.js` — `backdrop: false` by default, zero blur over cast):**
  - `chatStrip`: `{ kind:'chatStrip', t0, t1, sender, sub?, avatar:'mum'|'gpt'|'bank'|'letter', accent, y:345, maxShow:2, msgs:[{ t, from:'them'|'me', text }] }` (**≤ 8 words/msg, STRICT `1.8–2.5 s` per message — NEVER keep a message card up > 2.5 s or `card_time` fails!**, 1 msg revealed at a time!)
  - `callCard`: `{ kind:'callCard', t0, t1, mode:'outgoing'|'busy'|'incoming'|'live', name, who?, busyAt?, busyText?:'Máy bận!', answer?, avatar:'mum', y:320 }` (`outgoing`/`busy` draw red hang-up button ONLY)
  - `voiceNote`: `{ kind:'voiceNote', t0, t1, sender, who, avatar:'mum', durLabel:'0:04', text?, y:345 }` (waveform auto-synced to `ep.lips`)
  - `receipt`: `{ kind:'receipt', t0, t1, title, amount, rows:[['K','V']], status:'ok'|'fail'|'pending', y:370 }`
  - `stamp`: `{ kind:'stamp', t0, t1, text, color:'#e53935', x:645, y:530, size:52, rot:-0.14 }`
  - `homThuSlip`: `{ kind:'homThuSlip', t0, t1, header:'HÒM THƯ QUÁN TRÀ', text, sub?, y:474 }` (Combo 1)
  - `questBadge`: `{ kind:'questBadge', t0, t1, label:'KHÁCH QUÁN → MỐC 1', pct:[78,84], goalText?, y:278 }` (Combo 2, % ONLY)
- **Classic Overlays (`core/overlay.js`):**
  - `hook`: `{ kind:'hook', t0:0, t1:2.15, text:'≤ 5 TỪ', y:345, color:'#ffc531' }` (`t0 <= 0.05`, `1.4 <= t1 <= 2.2`)
  - `pill`: `{ kind:'pill', t0, t1, text:'...', y:300 }` · `end`: `{ kind:'end', t0, t1, text, sub }` · `score` (GOAT) · `phone` (`big: true` needs `noCap: true` on overlapping lines!) · `thought` · `notify` · `bubble`
  - `draw`: custom canvas `{ kind:'draw', t0, t1, fn(ctx,t,info), reads:[{ text, t0, t1 }] | noText:true }` (MUST declare `reads` or `noText: true`!)

## 5. Contact, Walking, Reads & Machine-Check Guardrails
- **Hand Contact:** `ep.touch = [{ who, hand:'R'|'L', t0, t1, at:[x,y,z]|fn, n:[0,1,0], r:0.044, ramp:0.25 }]` (Tèo & `makePerson`, not Bíp). Declare prop contact check via `ep.touchProps = [{ who, hand:'L'|'R'|'any', prop:'<meshName>', t0, t1 }]`.
- **3D Text Props:** declare `ep.reads = [{ text:'...', t0, t1 }]` (or `prop:'<meshName>'`); must be unblocked ≥ 90% and held `>= 1.0 + chars/12` s.
- **Waivers (`ep.waive`):** ONLY when genuinely intentional. Max span **≤ 25%** of duration, MUST include `reason`, MUST name object (`who`/`obj` or `"Object: ..."` in reason — except episode-level checks `tail/length/shot_rhythm/first_3s`). Never use blanket `check: 'clip'`.
- **QA v2 Hard Numbers:**
  - `dur`: 42–52 s (target 42–48 s) · `tail <= 0.85 s` (v1: `<= 2.05 s`)
  - First 12 s avg shot: `1.8–2.4 s`, no static shot `> 2.8 s`, no static `two` `> 2.5 s`
  - Speaker visible & facing camera (`<= 75°`), no `same_framing` back-to-back, no `long_shot > 3.0 s` without `hold: true`
  - **One command checks everything:** `python3 tools/build_check.py episodes/<id>.js` (auto-lips + `qa.cjs` + `clipcheck.cjs`, ≤ 25 lines).

## 6. Verified Real Audio Library (`audio_lib/catalog.json`, 48 kHz CC0)
Use ONLY verified real IDs in `beats.json` so zero SFX fall back to numpy synth (`build_check.py --audio` flags any `SYNTH_FALLBACK`):
- **Real SFX (27):** `pop, msg_in, msg_out, thought_pop, voice_note, ting, tingting, kaching, ding_idea, chime, ring, dial_busy, click, lock, alarm_low, glitch, whoosh, slide, thud, stamp, boom, paper_slip, clink, tea_pour, tick, cheer, shutter` (aliases: `popup, notify, message, paper, busy`).
- **Real Ambience (2):** `street` (Trà đá default), `murmur` (GOAT pub).
- **Real Music Tracks (9):** `comedy_playful, comedy_quirky, comedy_capers, tension_comic, tension_dark, warm_family, warm_slice, pub_banter, lofi_night`.
  - Single track: `"music": { "track": "comedy_quirky", "fade": 1.2 }`
  - Multi-track cue: `"music": { "tracks": [{ "track": "tension_comic", "from": 0, "to": "l11", "xfade": 0.6 }, { "track": "warm_family", "from": "l11", "to": "end", "xfade": 0.9 }] }`
