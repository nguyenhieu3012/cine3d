"""Gemini Studio Antigravity `run_workflow` Orchestrator for `cine3d` (v2.1).
Zero-token Python orchestration + strict JSON schemas + model tiering:
  - Main (Gemini 4 Neon High): calls this workflow per stage, listens to mix_preview.mp3 & watches review_proxy.mp4.
  - `pro`: Writers' Room ideation (`stage="ideate"`), blind script gate (Trà đá 8-point + Kill-Floor / GOAT parallel Cold-Reader + Fact-Checker), true 2-step blind 6-door video+audio gate, and final-round builder escalation.
  - `flash`: stateful 3D episode builder (max 3 batched fix rounds via tools/build_check.py; auto-escalates to `pro` on final round or BLOCKED).
  - `flash_lite`: final posting package (`goi-dang.md`), only after `pipeline.py can-post` PASS + title/file checks.

Safety locks enforced in code:
  1. NEVER calls `tools/voice.py record --yes` (ElevenLabs credit lock requires explicit owner `credit_owner OK --quote`).
  2. NEVER publishes or deletes posts on any platform.
  3. NEVER touches `.claude/` or legacy Claude files.

Args:
  {
    "episode_id": "ep_id",
    "channel": "trada" | "goat",          # optional; auto-detected from out/<id>/pipeline.json
    "stage": "ideate" | "script_gate" | "audio" | "build_and_gate" | "package" | "dry_check",
    "seed_topic": "optional user topic",  # optional for stage="ideate"
    "max_build_rounds": 3,                # capped at 3
    "skip_audio_build": false,            # for stage="audio"
    "cover_t": 0.6,                       # optional cover args for stage="build_and_gate"
    "cover_top": "TOP LINE",
    "cover_plate": "PLATE LINE",
    "repo_root": "/abs/path/to/cine3d"    # optional override
  }
"""
import datetime
import glob
import importlib.util
import json
import os
import re
import subprocess
import sys
import time


def resolve_root():
    cand = [
        args.get("repo_root"),
        os.environ.get("CINE3D_ROOT"),
        os.getcwd(),
        os.path.join(os.getcwd(), "cine3d"),
    ]
    for w in WORKSPACES:
        cand.extend([w, os.path.join(w, "cine3d")])
    for c in cand:
        if c and os.path.exists(os.path.join(c, "tools", "build_check.py")) and os.path.exists(os.path.join(c, "tools", "pipeline.py")):
            return os.path.abspath(c)
    raise RuntimeError(f"Could not locate cine3d repo root from cwd={os.getcwd()}, WORKSPACES={WORKSPACES}")


ROOT = resolve_root()
_schema_path = os.path.join(ROOT, ".agents", "workflows", "schemas.py")
_spec = importlib.util.spec_from_file_location("gemini_studio_schemas", _schema_path)
SCHEMAS = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(SCHEMAS)


def now_iso():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def write_checkpoint(ep_id, stage_name, payload):
    out_dir = os.path.join(ROOT, "out", ep_id)
    os.makedirs(out_dir, exist_ok=True)
    p = os.path.join(out_dir, "workflow_state.json")
    try:
        cur = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
    except Exception:
        cur = {}
    cur.update({"episode_id": ep_id, "last_stage": stage_name, "updated_at": now_iso()})
    cur.setdefault("stages", {})[stage_name] = {**payload, "at": now_iso()}
    tmp = p + ".tmp"
    json.dump(cur, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, p)


def log_telemetry(ep_id, entry):
    out_dir = os.path.join(ROOT, "out", ep_id)
    os.makedirs(out_dir, exist_ok=True)
    p = os.path.join(out_dir, "runs.jsonl")
    rec = {"at": now_iso(), "episode_id": ep_id, **entry}
    with open(p, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def py_venv():
    import shutil
    cands = [
        os.environ.get("CINE3D_VENV_PYTHON"),
        os.path.expanduser("~/tdvai/.venv/bin/python"),
        sys.executable,
        shutil.which("python3"),
        "/usr/bin/python3",
        "/opt/homebrew/bin/python3",
    ]
    seen = set()
    for c in cands:
        if not c or c in seen or not os.path.exists(c):
            continue
        seen.add(c)
        try:
            r = subprocess.run([c, "-c", "import numpy"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
            if r.returncode == 0:
                return c
        except Exception:
            pass
    return sys.executable or "python3"


def sh(cmd, timeout=600):
    p = subprocess.run(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace", timeout=timeout)
    return p.returncode, p.stdout.strip()


def run_pipeline(cmd_args, warnings, label, timeout=60):
    rc, out = sh([sys.executable or "python3", "tools/pipeline.py", *cmd_args], timeout=timeout)
    if rc != 0:
        msg = f"pipeline.py {label} failed (rc={rc}): {out[-300:]}"
        log(f"WARNING: {msg}")
        warnings.append(msg)
    return rc, out


def detect_channel(ep_id):
    if args.get("channel") in ("trada", "goat"):
        return args["channel"]
    st_p = os.path.join(ROOT, "out", ep_id, "pipeline.json")
    if os.path.exists(st_p):
        try:
            st = json.load(open(st_p, encoding="utf-8"))
            if st.get("channel") in ("trada", "goat"):
                return st["channel"]
        except Exception:
            pass
    beats_p = os.path.join(ROOT, "episodes", f"{ep_id}.beats.json")
    if os.path.exists(beats_p):
        try:
            B = json.load(open(beats_p, encoding="utf-8"))
            v = B.get("voices")
            if B.get("pack") == "goat" or B.get("channel") == "goat" or (isinstance(v, dict) and "ron" in v):
                return "goat"
            if B.get("pack") == "trada" or B.get("channel") == "trada" or (isinstance(v, dict) and "teo" in v):
                return "trada"
        except Exception:
            pass
    ep_p = os.path.join(ROOT, "episodes", f"{ep_id}.js")
    if os.path.exists(ep_p):
        try:
            txt = open(ep_p, encoding="utf-8").read(4000)
            if "pack: 'goat'" in txt or 'pack: "goat"' in txt or "goatDefaults(" in txt:
                return "goat"
        except Exception:
            pass
    return "trada"


def read_text(rel_path, max_chars=24000):
    p = os.path.join(ROOT, rel_path)
    if not os.path.exists(p):
        return ""
    txt = open(p, encoding="utf-8").read()
    if len(txt) > max_chars:
        log(f"WARNING: read_text truncated {rel_path} from {len(txt)} to {max_chars} chars")
        return txt[:max_chars]
    return txt


TRADA_BLOCK_KEYS = (
    "cause_chain_and_who_knows_what",
    "no_4_to_10s_cliff",
    "clear_share_recipient",
    "world_logic_intact",
)
TRADA_ENT_KEYS = (
    "hook_thumbstop_score",
    "comedy_or_emotion_punch_score",
    "originality_score",
    "dialogue_authenticity_score",
    "visual_storytelling_score",
)
GOAT_ENT_KEYS = TRADA_ENT_KEYS + ("loser_steelman_score",)


def trada_gate_passed(res, mode="comedy"):
    raw_pts = res.get("points", [])
    if len(raw_pts) != 8 or {p.get("id") for p in raw_pts} != {1, 2, 3, 4, 5, 6, 7, 8}:
        return False
    pts = {p["id"]: p for p in raw_pts}
    mandatory_ok = all(pts.get(i, {}).get("pass") for i in (1, 2, 3, 8))
    failed = [p for p in raw_pts if not p.get("pass")]
    bc = res.get("blocking_checks") or {}
    block_ok = all(bool(bc.get(k)) for k in TRADA_BLOCK_KEYS)
    laugh_cap = 7.5 if mode == "emotional" else 5.5
    laugh_ok = float(res.get("first_laugh_s", 99)) <= laugh_cap
    ent = res.get("entertainment_scores") or {}
    ent_ok = all(isinstance(ent.get(k), (int, float)) and ent.get(k) >= 7 for k in TRADA_ENT_KEYS)
    if not (mandatory_ok and block_ok and laugh_ok and ent_ok):
        return False
    if len(failed) == 0:
        return True
    if len(failed) == 1 and not failed[0].get("affects_logic_or_comedy", True):
        return True
    return False


def goat_facts_passed(res, expected_count):
    if expected_count == 0:
        return True
    claims = res.get("claims") or []
    if res.get("verdict") != "GO" or len(claims) < expected_count:
        return False
    for c in claims:
        if not (bool(c.get("accurate")) and bool(c.get("verified_live"))):
            return False
        srcs = [str(s).strip() for s in (c.get("sources") or []) if str(s).strip()]
        distinct_srcs = set(srcs)
        min_req = 1 if c.get("single_primary_source") else 2
        if len(distinct_srcs) < min_req:
            return False
    return True


def goat_gate_passed(res):
    comments = res.get("simulated_comments", [])
    viewers = {c.get("viewer") for c in comments}
    would_cnt = sum(1 for c in comments if c.get("would_comment"))
    ent = res.get("entertainment_scores") or {}
    ent_ok = all(isinstance(ent.get(k), (int, float)) and ent.get(k) >= 7 for k in GOAT_ENT_KEYS)
    return (
        res.get("verdict") == "PASS"
        and res.get("swipe_second", 0) > 6.0
        and res.get("first_laugh_s", 99) < 6.0
        and bool(res.get("standalone_claim_under_2s"))
        and bool(res.get("no_stat_round_before_15s"))
        and bool(res.get("max_one_number_per_line"))
        and bool(res.get("fresh_ending"))
        and viewers == {"ronaldo_fan", "messi_fan", "neutral_us"}
        and would_cnt >= 2
        and bool(res.get("fans_disagree"))
        and ent_ok
    )


def episode_gate_passed(res):
    doors = res.get("doors", [])
    au = res.get("audio_check", {})
    waivers = res.get("waivers_audit") or []
    waivers_ok = all(bool(w.get("justified")) for w in waivers)
    return (
        res.get("verdict") == "PASS"
        and bool(res.get("watched_proxy"))
        and bool(str(res.get("blind_cold_retell") or "").strip())
        and len(doors) == 6
        and {d.get("door") for d in doors} == {1, 2, 3, 4, 5, 6}
        and all(d.get("pass") for d in doors)
        and bool(au.get("voice_clear_over_music"))
        and bool(au.get("lip_sync_ok"))
        and bool(au.get("sfx_clean_no_harsh_synth"))
        and bool(au.get("no_dead_silence_first_10s"))
        and waivers_ok
    )


def recent_episode_catalog(ch, limit=20):
    rows = []
    for p in sorted(glob.glob(os.path.join(ROOT, "episodes", "*.card.json")), key=os.path.getmtime, reverse=True):
        try:
            c = json.load(open(p, encoding="utf-8"))
        except Exception:
            continue
        is_g = "claim" in c or "comment_ron" in c
        if (ch == "goat") != is_g:
            continue
        eid = os.path.basename(p).replace(".card.json", "")
        rows.append(f"- {eid}: {c.get('title') or ''} | {c.get('sum') or c.get('claim') or ''}"[:140])
        if len(rows) >= limit:
            break
    return "\n".join(rows) if rows else "(no recent cards found)"


async def stage_dry_check(ep_id, ch):
    phase("Dry Check")
    rc1, out1 = sh([py_venv(), "tools/sfx_lib.py", "verify"], timeout=30)
    log(f"ROOT={ROOT}")
    log(f"episode_id={ep_id}, channel={ch}, schemas_loaded={len([k for k in dir(SCHEMAS) if k.endswith('_SCHEMA')])}")
    log(f"sfx_lib verify rc={rc1}: {out1}")
    print(json.dumps({"stage": "dry_check", "ok": rc1 == 0, "root": ROOT, "channel": ch, "episode_id": ep_id}, ensure_ascii=False))


async def stage_ideate(ep_id, ch):
    t0 = time.time()
    gate_model = args.get("gate_model") or "pro"
    phase(f"1. Writers' Room Ideation — 3 Takes & Kill 2 ({ch}, model={gate_model})")
    writers_doc = read_text(".agents/skills/gemini-studio/WRITERS-ROOM.md", 20000)
    spec_doc = read_text(f".agents/skills/gemini-studio/specs/{ch}.md", 14000)
    chan_doc = read_text(f"skills/studio-pipeline/channels/{ch}.md", 12000)
    recent_cat = recent_episode_catalog(ch, limit=20)
    seed_topic = (args.get("seed_topic") or "").strip()

    prompt = (
        f"You are the Writers' Room Showrunner for cine3d (`{ep_id}`, channel `{ch}`).\n"
        "READ-ONLY IDEATION: do NOT create, edit, or delete files directly — return the structured JSON pitch.\n"
        "MANDATORY 3-TAKE RULE:\n"
        "  - Pitch 3 GENUINELY DIFFERENT episode angles (A_grounded, B_visual, C_wildcard) — NOT 3 wordings of the same joke.\n"
        "  - Use the comedy engines, anti-cliché rules, and hook/twist standards from WRITERS-ROOM.md.\n"
        "  - Avoid repeating any angle in the Recent Episodes list below.\n"
        "  - Ruthlessly KILL 2 takes with honest, blunt critique, pick 1 winner, and output its complete `draft_card`.\n"
        + (f"\nOWNER SEED / DIRECTION: {seed_topic}\n" if seed_topic else "")
        + f"\n=== WRITERS-ROOM.md ===\n{writers_doc}\n"
        + f"\n=== CHANNEL SPEC ({ch}) ===\n{spec_doc}\n"
        + (f"\n=== CHANNEL GUIDE ({ch}) ===\n{chan_doc}\n" if chan_doc else "")
        + f"\n=== RECENT EPISODES (DO NOT REPEAT) ===\n{recent_cat}\n"
    )
    res = await agent(prompt, schema=SCHEMAS.IDEATE_RESULT_SCHEMA, role=f"Writers' Room ({ep_id})", model=gate_model)
    out_dir = os.path.join(ROOT, "out", ep_id)
    os.makedirs(out_dir, exist_ok=True)
    ideate_path = os.path.join(out_dir, "ideate.json")
    json.dump(res, open(ideate_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    dur_s = round(time.time() - t0, 2)
    write_checkpoint(ep_id, "ideate", {"winner_take": res.get("winner_take"), "ideate_file": ideate_path})
    log_telemetry(ep_id, {"stage": "ideate", "channel": ch, "model": gate_model, "winner": res.get("winner_take"), "elapsed_s": dur_s})
    print(json.dumps({
        "stage": "ideate",
        "episode_id": ep_id,
        "channel": ch,
        "pass": True,
        "ideate_file": ideate_path,
        "result": res,
        "next_action": f"Review the 3 takes in {ideate_path} with the owner, write episodes/{ep_id}.card.json + treatment.md + beats.json, then run stage='script_gate'.",
    }, ensure_ascii=False, indent=1))


async def stage_script_gate(ep_id, ch):
    t0 = time.time()
    beats_rel = f"episodes/{ep_id}.beats.json"
    card_rel = f"episodes/{ep_id}.card.json"
    if not os.path.exists(os.path.join(ROOT, beats_rel)):
        raise FileNotFoundError(f"Missing {beats_rel}")

    phase("1. Deterministic scriptlint (0 token)")
    lint_cmd = [sys.executable or "python3", "tools/scriptlint.py", beats_rel, "--strict"] + (["--rules", "2"] if ch == "trada" else [])
    rc_l, out_l = sh(lint_cmd, timeout=60)
    log(f"scriptlint rc={rc_l}")
    if rc_l != 0:
        log_telemetry(ep_id, {"stage": "script_gate", "channel": ch, "pass": False, "reason": "scriptlint_fail", "elapsed_s": round(time.time() - t0, 2)})
        print(json.dumps({"stage": "script_gate", "pass": False, "reason": "scriptlint_fail", "output": out_l[-1500:]}, ensure_ascii=False, indent=1))
        return

    gate_model = args.get("gate_model") or "pro"
    phase(f"2. Blind Script Gate + Kill-Floor ({ch}, model={gate_model})")
    spec_text = read_text(f".agents/skills/gemini-studio/specs/{ch}.md", 16000)
    writers_text = read_text(".agents/skills/gemini-studio/WRITERS-ROOM.md", 16000)
    beats_raw = json.load(open(os.path.join(ROOT, beats_rel), encoding="utf-8"))
    ep_mode = str(beats_raw.get("mode") or "comedy").strip().lower()
    # Strip logline/meta for true blind Stranger Test, while preserving visual/note/sfx/mode/cards/hook/payoff/twist so visual storytelling is judged fairly
    blind_beats = {
        "id": beats_raw.get("id"),
        "mode": ep_mode,
        "hook": beats_raw.get("hook"),
        "twist": beats_raw.get("twist"),
        "payoff": beats_raw.get("payoff"),
        "beats": [
            {k: b[k] for k in ("id", "who", "text", "say", "card", "visual", "note", "mood", "land", "pause", "impact", "silence") if k in b}
            for b in beats_raw.get("beats", [])
        ],
    }
    if beats_raw.get("cards"):
        blind_beats["cards"] = beats_raw["cards"]
    if beats_raw.get("sfx"):
        blind_beats["sfx"] = [{k: s[k] for k in ("name", "ref", "off") if k in s} for s in beats_raw["sfx"] if isinstance(s, dict)]
    blind_json = json.dumps(blind_beats, ensure_ascii=False, indent=1)

    if ch == "trada":
        prompt = (
            f"Blind Script Gate + Kill-Floor Audit (Trà đá Blueprint v2.1, mode=`{ep_mode}`) for `{ep_id}`.\n"
            "READ-ONLY GATE: do NOT create, edit, or delete any files.\n"
            "DO NOT read treatment.md or card.json — judge strictly from the raw script below for a true Stranger Test.\n"
            "Score all 5 `entertainment_scores` brutally (1-10; < 7 on ANY axis = automatic FAIL). List any `ai_smell_lines` and `weak_lines`.\n\n"
            f"=== WRITERS-ROOM.md ===\n{writers_text}\n\n"
            f"=== CHANNEL SPEC ===\n{spec_text}\n\n"
            f"=== RAW SCRIPT (NO LOGLINE) ===\n{blind_json}\n"
        )
        gate_res = await agent(prompt, schema=SCHEMAS.SCRIPT_GATE_TRADA_SCHEMA, role=f"Blind Script Gate ({ep_id})", model=gate_model)
        passed = trada_gate_passed(gate_res, mode=ep_mode)
        gate_res["verdict"] = "PASS" if passed else "FAIL"
        facts_res = None
    else:
        card = json.load(open(os.path.join(ROOT, card_rel), encoding="utf-8")) if os.path.exists(os.path.join(ROOT, card_rel)) else {}
        facts = card.get("facts") or []
        cold_prompt = (
            f"Blind GOAT Beef Cold-Reader Gate + Kill-Floor for `{ep_id}`.\n"
            "READ-ONLY GATE: do NOT create, edit, or delete any files.\n"
            "Judge strictly as a US 16-30 soccer/football viewer scrolling Reels/Shorts. Simulate 3 DISTINCT comments (`ronaldo_fan`, `messi_fan`, `neutral_us`).\n"
            "Score all 6 `entertainment_scores` brutally (1-10, including `loser_steelman_score`; < 7 on ANY axis = automatic FAIL).\n\n"
            f"=== WRITERS-ROOM.md ===\n{writers_text}\n\n"
            f"=== CHANNEL SPEC ===\n{spec_text}\n\n"
            f"=== RAW SCRIPT ===\n{blind_json}\n"
        )
        tasks = [("cold", cold_prompt, SCHEMAS.SCRIPT_GATE_GOAT_SCHEMA, f"GOAT Cold-Reader ({ep_id})")]
        if facts:
            fact_prompt = (
                f"GOAT Beef Fact-Checker for `{ep_id}`.\n"
                "READ-ONLY GATE: do NOT create, edit, or delete any files.\n"
                "MANDATORY LIVE VERIFICATION: Use `search_web` (up to 20 queries max) to verify EVERY mutable football/soccer stat, score, date, record, standing, or quote below.\n"
                "Cite at least 2 independent sources (URLs or official stat providers) per mutable number in `sources` (or set `single_primary_source: true` ONLY if one primary FIFA/UEFA/league source exists) and set `verified_live: true` ONLY when checked live.\n"
                "NEVER rely on memory for changing career totals or recent events; if any claim cannot be verified live, set `accurate: false` and `verdict: NOGO`.\n\n"
                f"CLAIMS:\n{json.dumps(facts, ensure_ascii=False, indent=1)}\n\n"
                f"SCRIPT CONTEXT:\n{blind_json}\n"
            )
            tasks.append(("facts", fact_prompt, SCHEMAS.FACT_CHECK_GOAT_SCHEMA, f"GOAT Fact-Checker ({ep_id})"))
        results = await parallel(tasks, lambda t: agent(t[1], schema=t[2], role=t[3], model=gate_model))
        gate_res = results[0]
        facts_res = results[1] if len(results) > 1 else {"verdict": "GO", "claims": [], "summary": "No factual claims on card."}
        facts_ok = goat_facts_passed(facts_res, len(facts))
        facts_res["verdict"] = "GO" if facts_ok else "NOGO"
        cold_ok = goat_gate_passed(gate_res)
        passed = cold_ok and facts_ok
        gate_res["verdict"] = "PASS" if cold_ok else "FAIL"

    phase("3. Voice Credit Quote (0 token, NO ElevenLabs spend)")
    rc_v, out_v = sh([py_venv(), "tools/voice.py", "need", beats_rel], timeout=60)
    log(f"voice.py need rc={rc_v}")

    pipeline_warnings = []
    if passed and os.path.exists(os.path.join(ROOT, "out", ep_id, "pipeline.json")):
        run_pipeline(["status", ep_id, "--run"], pipeline_warnings, "status --run", timeout=120)
        note = gate_res.get("stranger_retell", "")[:120] if ch == "trada" else f"swipe={gate_res.get('swipe_second')}s, laugh={gate_res.get('first_laugh_s')}s"
        run_pipeline(["record", ep_id, "script_gate", "PASS", "--by", "gemini-pro-script-gate", "--note", note], pipeline_warnings, "record script_gate", timeout=30)
        if ch == "goat" and facts_res and facts_res.get("claims"):
            run_pipeline(["record", ep_id, "facts", "GO", "--by", "gemini-pro-fact-checker", "--note", facts_res.get("summary", "")[:120]], pipeline_warnings, "record facts", timeout=30)

    dur_s = round(time.time() - t0, 2)
    write_checkpoint(ep_id, "script_gate", {"pass": passed, "mode": ep_mode, "pipeline_warnings": pipeline_warnings})
    log_telemetry(ep_id, {"stage": "script_gate", "channel": ch, "mode": ep_mode, "pass": passed, "elapsed_s": dur_s, "warnings": len(pipeline_warnings)})

    out_payload = {
        "stage": "script_gate",
        "episode_id": ep_id,
        "channel": ch,
        "mode": ep_mode,
        "pass": passed,
        "script_gate": gate_res,
        "facts_check": facts_res,
        "voice_need_quote": out_v,
        "pipeline_warnings": pipeline_warnings,
        "next_human_lock": (
            f'STOP FOR OWNER CREDIT LOCK: show quote above, then record:\n'
            f'python3 tools/pipeline.py record {ep_id} credit_owner OK --by driver --quote "<owner words>"'
            if passed
            else "Fix script issues in fix_list / ai_smell_lines / weak_lines and re-run stage=script_gate."
        ),
    }
    print(json.dumps(out_payload, ensure_ascii=False, indent=1))


async def stage_audio(ep_id, ch):
    t0 = time.time()
    beats_rel = f"episodes/{ep_id}.beats.json"
    phase("1. Verify Credit Lock (NEVER calls ElevenLabs record)")
    rc_lock, out_lock = sh([sys.executable or "python3", "tools/rules2.py", ep_id], timeout=30)
    if rc_lock != 0:
        log(f"CREDIT LOCK ACTIVE: {out_lock}")
        log_telemetry(ep_id, {"stage": "audio", "channel": ch, "pass": False, "locked": True, "elapsed_s": round(time.time() - t0, 2)})
        print(json.dumps({"stage": "audio", "pass": False, "locked": True, "detail": out_lock}, ensure_ascii=False, indent=1))
        return

    phase("2. Build Audio Mix + Audiogate + Real-Time Lint + Mix Preview")
    cmd = [sys.executable or "python3", "tools/build_check.py", beats_rel, "--audio"]
    if args.get("skip_audio_build"):
        cmd.append("--skip-build")
    if args.get("strict_sfx"):
        cmd.append("--strict-sfx")
    rc_a, out_a = sh(cmd, timeout=360)
    log(out_a)
    ac_path = os.path.join(ROOT, "out", ep_id, "audio_check.json")
    ac = json.load(open(ac_path, encoding="utf-8")) if os.path.exists(ac_path) else {"pass": rc_a == 0}
    preview = ac.get("mix_preview")
    ok = rc_a == 0 and bool(ac.get("pass"))
    write_checkpoint(ep_id, "audio", {"pass": ok, "mix_preview": preview})
    log_telemetry(ep_id, {"stage": "audio", "channel": ch, "pass": ok, "synth_fallbacks": len(ac.get("synth_fallbacks", [])), "elapsed_s": round(time.time() - t0, 2)})
    print(json.dumps({
        "stage": "audio",
        "episode_id": ep_id,
        "pass": ok,
        "report": out_a,
        "synth_fallbacks": ac.get("synth_fallbacks", []),
        "mix_preview_abs": os.path.join(ROOT, preview) if preview else None,
        "next_action": f'Main: call read_file on {os.path.join(ROOT, preview)} to verify pronunciation, pacing, music & SFX before 3D build.' if preview else "Fix audio errors above.",
    }, ensure_ascii=False, indent=1))


async def stage_build_and_gate(ep_id, ch):
    t0 = time.time()
    ep_rel = f"episodes/{ep_id}.js"
    beats_rel = f"episodes/{ep_id}.beats.json"
    times_rel = f"episodes/{ep_id}.times.js"
    treat_rel = f"episodes/{ep_id}.treatment.md"
    mix_abs = os.path.join(ROOT, "out", ep_id, "audio", "mix.wav")
    max_rounds = min(3, max(1, int(args.get("max_build_rounds", 3))))

    # Preflight: fail fast before spending any builder tokens if real audio/times are missing
    if not os.path.exists(os.path.join(ROOT, beats_rel)):
        raise FileNotFoundError(f"Missing {beats_rel}")
    if not os.path.exists(os.path.join(ROOT, times_rel)):
        raise FileNotFoundError(f"Missing {times_rel} — run stage='audio' first so builder works on REAL voice times.")
    times_head = read_text(times_rel, 4000)
    if '"estimated": true' in times_head or '"estimated":true' in times_head:
        raise RuntimeError(f"{times_rel} is still ESTIMATED — run stage='audio' after voice recording before stage='build_and_gate'.")
    if not os.path.exists(mix_abs):
        raise FileNotFoundError(f"Missing {mix_abs} — run stage='audio' before final render.")

    phase("1. 3D Episode Build (stateful flash -> pro escalation, pre-injected context, max 3 batched rounds)")
    core_doc = read_text(".agents/skills/gemini-studio/ENGINE-CORE.md", 16000)
    spec_doc = read_text(f".agents/skills/gemini-studio/specs/{ch}.md", 12000)
    treat_doc = read_text(treat_rel, 12000)
    beats_doc = read_text(beats_rel, 16000)
    times_doc = read_text(times_rel, 12000)
    was_scaffolded = False
    ep_abs = os.path.join(ROOT, ep_rel)
    if not os.path.exists(ep_abs) and os.path.exists(os.path.join(ROOT, "tools", "scaffold_ep.py")):
        sc_cmd = [sys.executable or "python3", "tools/scaffold_ep.py", beats_rel]
        if args.get("layout"):
            sc_cmd += ["--layout", str(args["layout"])]
        if args.get("kind"):
            sc_cmd += ["--kind", str(args["kind"])]
        rc_sc, out_sc = sh(sc_cmd, timeout=30)
        log(f"0-token scaffold_ep rc={rc_sc}: {out_sc.strip()}")
        was_scaffolded = rc_sc == 0 and os.path.exists(ep_abs)

    existing_ep = read_text(ep_rel, 24000)

    # Tiny catalog summary (~300 bytes) of prebuilt Gemini stickers & backdrops so Builder reuses them
    asset_summary = "(none)"
    cat_p = os.path.join(ROOT, "packs", "shared", "stickers", "catalog.json")
    if os.path.exists(cat_p):
        try:
            cat = json.load(open(cat_p, encoding="utf-8"))
            st_ids = ", ".join(sorted((cat.get("stickers") or {}).keys()))
            bd_ids = ", ".join(sorted((cat.get("backdrops") or {}).keys()))
            asset_summary = f"Stickers (`packs/shared/stickers/`): {st_ids}\nBackdrops (`packs/shared/backdrops/`): {bd_ids}"
        except Exception:
            pass

    standing = (
        f"You are the Gemini Studio 3D Builder for cine3d (`{ep_id}`, channel `{ch}`).\n"
        f"Workspace root: {ROOT}\n"
        "STRICT CONTEXT & SPEED RULES:\n"
        "- All core docs (ENGINE-CORE + channel spec) are ALREADY injected below — do NOT waste turns re-reading them or reading `ENGINE.md` (164 KB).\n"
        "- Only check `.agents/skills/gemini-studio/ENGINE-INDEX.md` if you need a rare set (GTA/Zombie/chest/setswap).\n"
        "- Prefer `core/ep_kit.js` (`makeKit`, `v2Defaults`/`goatDefaults`, `v2Hook`, `diagramRig`, `boardOverlay`, `goatStatCard`, `setswapBackdrop`) so shots tile cleanly with zero gaps.\n"
        "- NEVER hand-code 300+ line Canvas 2D diagrams in `*_props.js` when declarative `boardOverlay({ layout: 'flow'|'compare'|'chart'|'corkboard'|'tactics' })` + prebuilt stickers can do it in ~30 lines!\n"
        "- NEVER run `voice.py record` or touch `.claude/`.\n"
        "- Fix ALL reported QA/clip errors together in ONE batched edit per round — never chase one error at a time.\n\n"
        f"=== PREBUILT GEMINI VISUAL ASSETS ===\n{asset_summary}\n\n"
        f"=== ENGINE-CORE.md ===\n{core_doc}\n\n"
        f"=== CHANNEL SPEC ({ch}) ===\n{spec_doc}\n"
    )
    builder = agent(standing, role=f"3D Builder ({ep_id})", model="flash")
    builder_initialized = False
    builder_model = "flash"

    initial_context_block = (
        f"=== {treat_rel} ===\n{treat_doc or '(none)'}\n\n"
        f"=== {beats_rel} ===\n{beats_doc}\n\n"
        f"=== {times_rel} ===\n{times_doc}\n"
        + (f"\n=== EXISTING {ep_rel} {'(0-token scaffold — polish acting, visual gags & diagram details)' if was_scaffolded else ''} ===\n{existing_ep}\n" if existing_ep else "")
    )
    build_prompt = (
        f"{'Polish the 0-token scaffold in' if was_scaffolded else 'Write or update'} `{os.path.join(ROOT, ep_rel)}` (and `episodes/{ep_id}_props.js` ONLY if custom 3D props are needed) on REAL times in ONE pass.\n"
        "All input files are pre-injected below — edit the file directly without wasting tool calls re-reading them.\n"
        "Do NOT run QA yourself — the workflow runs `tools/build_check.py` deterministically right after you finish.\n\n"
        + initial_context_block
    )

    pic_ok = False
    last_check = ""
    rounds_used = 0
    if existing_ep and not was_scaffolded and args.get("skip_if_passing", True):
        rc_pre, out_pre = sh([sys.executable or "python3", "tools/build_check.py", ep_rel], timeout=360)
        if rc_pre == 0:
            log(f"Existing {ep_rel} already passed build_check (0 builder tokens spent):\n{out_pre}")
            pic_ok = True
            last_check = out_pre
        else:
            log(f"Existing {ep_rel} pre-check rc={rc_pre}; handing failures directly to builder:\n{out_pre}")
            build_prompt += f"\n=== CURRENT build_check.py FAILURES TO FIX ===\n{out_pre}\n"

    for rnd in range(1, (0 if pic_ok else max_rounds) + 1):
        rounds_used = rnd
        # Auto-escalate to `pro` on final round if flash struggled on earlier rounds
        if rnd == max_rounds and max_rounds > 1 and builder_model == "flash":
            log(f"Escalating 3D Builder flash -> pro on final round {rnd}/{max_rounds}")
            del builder
            builder = agent(standing, role=f"3D Builder Pro ({ep_id})", model="pro")
            builder_model = "pro"
            builder_initialized = False
            latest_ep = read_text(ep_rel, 24000)
            build_prompt = (
                f"ESCALATED FINAL ROUND ({rnd}/{max_rounds}): previous flash edits failed `build_check.py`. "
                f"Diagnose root causes and fix ALL errors cleanly in ONE batched edit to `{ep_rel}`.\n\n"
                f"=== LATEST {ep_rel} ===\n{latest_ep}\n\n"
                f"=== {beats_rel} ===\n{beats_doc}\n\n"
                f"=== {times_rel} ===\n{times_doc}\n\n"
                f"=== CURRENT build_check.py FAILURES ===\n{last_check}\n"
            )
        log(f"Builder round {rnd}/{max_rounds} (model={builder_model})")
        b_res = await builder(build_prompt, SCHEMAS.BUILDER_RESULT_SCHEMA)
        builder_initialized = True
        if b_res.get("status") == "BLOCKED":
            log(f"Builder ({builder_model}) reported BLOCKED: {b_res.get('blockers')}")
            if builder_model == "flash" and rnd < max_rounds:
                log("Escalating BLOCKED flash builder -> pro immediately")
                del builder
                builder = agent(standing, role=f"3D Builder Pro ({ep_id})", model="pro")
                builder_model = "pro"
                builder_initialized = False
                latest_ep = read_text(ep_rel, 24000)
                build_prompt = (
                    f"Previous flash builder reported BLOCKED: {b_res.get('blockers')}.\n"
                    f"Unblock and complete `{ep_rel}` cleanly.\n\n"
                    f"=== LATEST {ep_rel} ===\n{latest_ep or existing_ep}\n\n"
                    f"=== {beats_rel} ===\n{beats_doc}\n\n"
                    f"=== {times_rel} ===\n{times_doc}\n"
                )
                continue
            break
        rc_c, out_c = sh([sys.executable or "python3", "tools/build_check.py", ep_rel], timeout=360)
        last_check = out_c
        log(f"build_check round {rnd} rc={rc_c}:\n{out_c}")
        if rc_c == 0:
            pic_ok = True
            break
        build_prompt = (
            f"Round {rnd} `tools/build_check.py` FAILED. Fix ALL issues below in ONE batched edit to `{ep_rel}` "
            "(read `out/" + ep_id + "/build_check.json` only if truncated):\n\n"
            f"{out_c}\n"
        )

    write_checkpoint(ep_id, "build", {"pic_ok": pic_ok, "rounds_used": rounds_used, "builder_model": builder_model})
    if not pic_ok:
        del builder
        log_telemetry(ep_id, {"stage": "build_and_gate", "channel": ch, "pass": False, "reason": "build_check_fail", "rounds": rounds_used, "elapsed_s": round(time.time() - t0, 2)})
        print(json.dumps({
            "stage": "build_and_gate",
            "episode_id": ep_id,
            "pass": False,
            "reason": f"build_check failed after {rounds_used} rounds",
            "last_build_check": last_check,
        }, ensure_ascii=False, indent=1))
        return

    def run_final_render():
        cmd = [sys.executable or "python3", "tools/build_check.py", ep_rel, "--final", "--reuse-check"]
        if args.get("cover_t") is not None and args.get("cover_top") and args.get("cover_plate"):
            cmd += ["--cover-t", str(args["cover_t"]), "--cover-top", str(args["cover_top"]), "--cover-plate", str(args["cover_plate"])]
        return sh(cmd, timeout=900)

    phase("2. Final 30fps Render + smooth.py + review_proxy.mp4 (0 token)")
    rc_f, out_f = run_final_render()
    log(out_f)
    if rc_f != 0:
        del builder
        log_telemetry(ep_id, {"stage": "build_and_gate", "channel": ch, "pass": False, "reason": "final_render_fail", "elapsed_s": round(time.time() - t0, 2)})
        print(json.dumps({"stage": "build_and_gate", "episode_id": ep_id, "pass": False, "reason": "final_render_or_smooth_fail", "output": out_f}, ensure_ascii=False, indent=1))
        return

    proxy_abs = os.path.join(ROOT, "out", ep_id, "review_proxy.mp4")
    mp4_rel = f"out/{ep_id}/{ep_id}.mp4"
    write_checkpoint(ep_id, "render", {"mp4": mp4_rel, "proxy": proxy_abs})

    phase("3. True 2-Step Blind Multimodal Episode Gate (pro watches cold BEFORE seeing beats/reports)")
    # Step 3A: Reviewer receives ONLY channel spec — ZERO beats.json, ZERO build_check.json — for genuine blind viewing!
    rev_standing = (
        f"You are the independent Blind Episode Gate Reviewer for cine3d (`{ep_id}`, channel `{ch}`).\n"
        "READ-ONLY GATE: do NOT create, edit, or delete any files.\n"
        "This is a strict TWO-STEP audit:\n"
        "  - Turn 1 (BLIND): watch + listen to `review_proxy.mp4` via `read_file` BEFORE seeing any script or machine report.\n"
        "  - Turn 2 (CROSS-CHECK): after you submit your blind observations, you will receive `beats.json` and `build_check.json` (including waivers) to issue the final 6-door verdict.\n\n"
        f"=== CHANNEL SPEC ({ch}) ===\n{spec_doc}\n"
    )
    rev_model = args.get("gate_model") or "pro"
    reviewer = agent(rev_standing, role=f"Blind Episode Gate ({ep_id})", model=rev_model)
    blind_res = await reviewer(
        f"STEP 1 (TRUE BLIND WATCH): Call `read_file` on `{proxy_abs}` right now. Do NOT read beats.json or build_check.json.\n"
        "Report cold what story you understood, how the hook/pacing felt, every visual glitch you spotted, and your honest audio impression.",
        SCHEMAS.EPISODE_BLIND_WATCH_SCHEMA,
    )
    log(f"Blind watch retell: {blind_res.get('cold_retell', '')[:120]}")

    # Step 3B: Now hand beats_doc + build_check.json (with waiver lists) for structured 6-door verdict + waiver audit
    bc_text = read_text(f"out/{ep_id}/build_check.json", 12000)
    gate_res = await reviewer(
        "STEP 2 (CROSS-CHECK & 6-DOOR VERDICT): Now cross-check what you saw & heard in Step 1 against the script beats and machine report below.\n"
        "Audit EVERY waiver in `qa_waived_list` / `clip_waived_list` (mark `justified: false` if a waiver hides a real visible bug!).\n"
        "Copy your Step 1 cold retell into `blind_cold_retell`. If FAIL, give ONE consolidated `fix_list` with exact parameter/timing changes.\n\n"
        f"=== SCRIPT BEATS ===\n{beats_doc}\n\n"
        f"=== build_check.json ===\n{bc_text}\n",
        SCHEMAS.EPISODE_GATE_SCHEMA,
    )
    gate_ok = episode_gate_passed(gate_res)
    render_fresh = True
    log(f"Episode Gate round 1: pass={gate_ok}, summary={gate_res.get('summary', '')[:120]}")

    # At most 1 consolidated post-gate fix pass on the builder + targeted re-check
    if not gate_ok and gate_res.get("fix_list"):
        phase("4. Consolidated Post-Gate Fix (1 pass) + Re-Render + Targeted Re-Check")
        fix_json = json.dumps(gate_res["fix_list"], ensure_ascii=False, indent=1)
        latest_ep = read_text(ep_rel, 24000)
        fix_prompt = (
            f"The Blind Episode Gate watched `{proxy_abs}` and returned ONE consolidated fix_list. "
            f"Apply ALL fixes below cleanly to `{ep_rel}`:\n\n{fix_json}\n"
        )
        # Fix skip_if_passing bug: if Phase 1 was skipped, builder has NEVER seen the episode or beats yet!
        if not builder_initialized:
            fix_prompt += f"\n=== CONTEXT (Phase 1 was skipped because build_check passed) ===\n{initial_context_block}\n"
        elif latest_ep:
            fix_prompt += f"\n=== CURRENT {ep_rel} ===\n{latest_ep}\n"
        await builder(fix_prompt, SCHEMAS.BUILDER_RESULT_SCHEMA)
        builder_initialized = True
        render_fresh = False
        rc_c2, out_c2 = sh([sys.executable or "python3", "tools/build_check.py", ep_rel], timeout=360)
        if rc_c2 != 0:
            await builder(f"Fix these QA/clip errors introduced by the gate edit:\n\n{out_c2}\n", SCHEMAS.BUILDER_RESULT_SCHEMA)
            rc_c2, out_c2 = sh([sys.executable or "python3", "tools/build_check.py", ep_rel], timeout=360)
        if rc_c2 == 0:
            rc_f, out_f = run_final_render()
            log(out_f)
            if rc_f == 0:
                render_fresh = True
                bc_text2 = read_text(f"out/{ep_id}/build_check.json", 12000)
                gate_res = await reviewer(
                    f"Re-watch `{proxy_abs}` via `read_file` specifically verifying every timestamp in your previous fix_list was resolved without regressions, and audit any updated waivers.\n\n=== UPDATED build_check.json ===\n{bc_text2}\n",
                    SCHEMAS.EPISODE_GATE_SCHEMA,
                )
                gate_ok = episode_gate_passed(gate_res)
                log(f"Episode Gate round 2: pass={gate_ok}")
            else:
                log("Post-gate re-render FAILED; skipping stale pipeline record.")
        else:
            log(f"Post-gate build_check FAILED; skipping stale render & pipeline record:\n{out_c2}")

    del builder
    del reviewer

    pipeline_warnings = []
    if render_fresh and os.path.exists(os.path.join(ROOT, "out", ep_id, "pipeline.json")) and os.path.exists(os.path.join(ROOT, mp4_rel)):
        # Advance cached machine checks cleanly to render without blind polling
        for _ in range(3):
            rc_st, st_out = sh([sys.executable or "python3", "tools/pipeline.py", "status", ep_id, "--run"], timeout=180)
            lines_out = st_out.splitlines() if st_out else []
            last_line = lines_out[-1] if lines_out else ""
            if rc_st != 0:
                pipeline_warnings.append(f"pipeline.py status --run rc={rc_st}")
                break
            if "NEXT: step" in last_line and (" render " in last_line or " episode_gate " in last_line or " driver_review " in last_line):
                break
        run_pipeline(["record", ep_id, "render", "OK", "--by", "gemini-workflow", "--mp4", mp4_rel], pipeline_warnings, "record render", timeout=30)
        run_pipeline(["status", ep_id, "--run"], pipeline_warnings, "status after render", timeout=180)
        run_pipeline(["record", ep_id, "episode_gate", "PASS" if gate_ok else "FAIL", "--by", "gemini-pro-episode-gate", "--note", gate_res.get("summary", "")[:140]], pipeline_warnings, "record episode_gate", timeout=30)

    final_pass = bool(render_fresh and gate_ok)
    write_checkpoint(ep_id, "build_and_gate", {"pass": final_pass, "render_fresh": render_fresh, "gate_ok": gate_ok, "pipeline_warnings": pipeline_warnings})
    log_telemetry(ep_id, {"stage": "build_and_gate", "channel": ch, "pass": final_pass, "rounds": rounds_used, "builder_model": builder_model, "elapsed_s": round(time.time() - t0, 2), "warnings": len(pipeline_warnings)})

    print(json.dumps({
        "stage": "build_and_gate",
        "episode_id": ep_id,
        "pass": final_pass,
        "render_fresh": render_fresh,
        "final_mp4": os.path.join(ROOT, mp4_rel),
        "review_proxy": proxy_abs,
        "blind_watch": blind_res,
        "episode_gate": gate_res,
        "pipeline_warnings": pipeline_warnings,
        "next_action": (
            f'Main (Gemini 4 Neon High): call read_file("{proxy_abs}") to watch+listen final 6 doors, record driver_review OK, then deliver Final MP4 to owner.'
            if final_pass
            else "Post-gate fix/render did not pass — inspect logs and episode_gate.fix_list before re-running."
        ),
    }, ensure_ascii=False, indent=1))


async def stage_package(ep_id, ch):
    t0 = time.time()
    phase("1. Verify pipeline.py can-post (0 token)")
    rc_cp, out_cp = sh([sys.executable or "python3", "tools/pipeline.py", "can-post", ep_id], timeout=30)
    if rc_cp != 0:
        log(f"can-post BLOCKED: {out_cp}")
        log_telemetry(ep_id, {"stage": "package", "channel": ch, "pass": False, "reason": "can_post_blocked", "elapsed_s": round(time.time() - t0, 2)})
        print(json.dumps({"stage": "package", "pass": False, "can_post": False, "detail": out_cp}, ensure_ascii=False, indent=1))
        return

    phase("2. Generate Posting Package (flash_lite, NO auto-publish)")
    pkg_rel = f"out/{ep_id}/goi-dang.md"
    pkg_abs = os.path.join(ROOT, pkg_rel)
    spec_text = read_text(f".agents/skills/gemini-studio/specs/{ch}.md")
    card_text = read_text(f"episodes/{ep_id}.card.json")
    prompt = (
        f"Create the ready-to-post package at `{pkg_abs}` for `{ep_id}` (channel `{ch}`).\n"
        "NEVER post, upload, schedule, or call YouTube/TikTok/Facebook APIs or browser tools.\n"
        "Follow every title/hashtag/pinned-comment rule in the channel spec strictly (e.g., NO 'Tập N' for trada; include 'Ronaldo' or 'Messi' + binary question for goat).\n\n"
        f"=== CHANNEL SPEC ===\n{spec_text}\n\n"
        f"=== EPISODE CARD ===\n{card_text}\n"
    )
    res = await agent(prompt, schema=SCHEMAS.PACKAGE_RESULT_SCHEMA, role=f"Packager ({ep_id})", model="flash_lite")
    res["can_post_verified"] = True

    # Deterministic package validation
    pkg_errors = []
    if not os.path.exists(pkg_abs) or os.path.getsize(pkg_abs) < 40:
        pkg_errors.append(f"Package file missing or empty: {pkg_rel}")
    yt_t = str(res.get("yt_title") or "")
    tt_t = str(res.get("tiktok_title") or "")
    if ch == "trada":
        if re.search(r"\bTập\s*\d+\b", yt_t, re.I) or re.search(r"\bTập\s*\d+\b", tt_t, re.I):
            pkg_errors.append("Trà đá title must NOT include 'Tập N'")
    elif ch == "goat":
        if not any(k in yt_t.lower() for k in ("ronaldo", "messi")):
            pkg_errors.append("GOAT yt_title must mention 'Ronaldo' or 'Messi'")
        if not any(k in tt_t.lower() for k in ("ronaldo", "messi")):
            pkg_errors.append("GOAT tiktok_title must mention 'Ronaldo' or 'Messi'")

    ok = res.get("status") == "PACKAGED" and not pkg_errors
    if pkg_errors:
        res["status"] = "BLOCKED"
        res["note"] = "; ".join(pkg_errors)
    write_checkpoint(ep_id, "package", {"pass": ok, "package_file": pkg_rel, "errors": pkg_errors})
    log_telemetry(ep_id, {"stage": "package", "channel": ch, "pass": ok, "elapsed_s": round(time.time() - t0, 2)})
    print(json.dumps({"stage": "package", "episode_id": ep_id, "pass": ok, "package": res, "validation_errors": pkg_errors}, ensure_ascii=False, indent=1))


VALID_STAGES = ("ideate", "script_gate", "audio", "build_and_gate", "package", "dry_check")
ep_id = args.get("episode_id")
stage = args.get("stage")
if not ep_id or stage not in VALID_STAGES:
    raise ValueError(f"Args must include 'episode_id' and 'stage' in {VALID_STAGES}.")

ch = detect_channel(ep_id)
if stage == "dry_check":
    await stage_dry_check(ep_id, ch)
elif stage == "ideate":
    await stage_ideate(ep_id, ch)
elif stage == "script_gate":
    await stage_script_gate(ep_id, ch)
elif stage == "audio":
    await stage_audio(ep_id, ch)
elif stage == "build_and_gate":
    await stage_build_and_gate(ep_id, ch)
elif stage == "package":
    await stage_package(ep_id, ch)
