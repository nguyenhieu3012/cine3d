"""Gemini Studio Antigravity `run_workflow` Orchestrator for `cine3d`.
Zero-token Python orchestration + strict JSON schemas + model tiering:
  - Main (Gemini 4 Neon High): calls this workflow per stage, listens to mix_preview.mp3 & watches review_proxy.mp4.
  - `pro`: blind script gate (Trà đá 8-point / GOAT parallel Cold-Reader + Fact-Checker) & blind 6-door video+audio gate.
  - `flash`: stateful 3D episode builder (max 3 batched fix rounds via tools/build_check.py).
  - `flash_lite`: final posting package (`goi-dang.md`), only after `pipeline.py can-post` PASS.

Safety locks enforced in code:
  1. NEVER calls `tools/voice.py record --yes` (ElevenLabs credit lock requires explicit owner `credit_owner OK --quote`).
  2. NEVER publishes or deletes posts on any platform.
  3. NEVER touches `.claude/` or legacy Claude files.

Args:
  {
    "episode_id": "ep_id",
    "channel": "trada" | "goat",          # optional; auto-detected from out/<id>/pipeline.json
    "stage": "script_gate" | "audio" | "build_and_gate" | "package" | "dry_check",
    "max_build_rounds": 3,                # capped at 3
    "skip_audio_build": false,            # for stage="audio"
    "cover_t": 0.6,                       # optional cover args for stage="build_and_gate"
    "cover_top": "TOP LINE",
    "cover_plate": "PLATE LINE",
    "repo_root": "/abs/path/to/cine3d"    # optional override
  }
"""
import importlib.util
import json
import os
import subprocess
import sys


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


def py_venv():
    import shutil
    cands = [
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


def detect_channel(ep_id):
    if args.get("channel") in ("trada", "goat"):
        return args["channel"]
    st = None
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
    return txt[:max_chars]


def trada_gate_passed(res):
    raw_pts = res.get("points", [])
    if len(raw_pts) != 8 or {p.get("id") for p in raw_pts} != {1, 2, 3, 4, 5, 6, 7, 8}:
        return False
    pts = {p["id"]: p for p in raw_pts}
    mandatory_ok = all(pts.get(i, {}).get("pass") for i in (1, 2, 3, 8))
    failed = [p for p in raw_pts if not p.get("pass")]
    block_ok = all(res.get("blocking_checks", {}).values())
    if not (mandatory_ok and block_ok):
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
    return (
        res.get("verdict") == "GO"
        and len(claims) >= expected_count
        and all(
            bool(c.get("accurate"))
            and bool(c.get("verified_live"))
            and isinstance(c.get("sources"), list)
            and len([s for s in c["sources"] if str(s).strip()]) >= 1
            for c in claims
        )
    )


def goat_gate_passed(res):
    comments = res.get("simulated_comments", [])
    would_cnt = sum(1 for c in comments if c.get("would_comment"))
    return (
        res.get("verdict") == "PASS"
        and res.get("swipe_second", 0) > 6.0
        and res.get("first_laugh_s", 99) < 6.0
        and bool(res.get("standalone_claim_under_2s"))
        and bool(res.get("no_stat_round_before_15s"))
        and bool(res.get("max_one_number_per_line"))
        and bool(res.get("fresh_ending"))
        and would_cnt >= 2
        and bool(res.get("fans_disagree"))
    )


def episode_gate_passed(res):
    doors = res.get("doors", [])
    au = res.get("audio_check", {})
    return (
        res.get("verdict") == "PASS"
        and bool(res.get("watched_proxy"))
        and len(doors) == 6
        and {d.get("door") for d in doors} == {1, 2, 3, 4, 5, 6}
        and all(d.get("pass") for d in doors)
        and bool(au.get("voice_clear_over_music"))
        and bool(au.get("lip_sync_ok"))
        and bool(au.get("sfx_clean_no_harsh_synth"))
        and bool(au.get("no_dead_silence_first_10s"))
    )


async def stage_dry_check(ep_id, ch):
    phase("Dry Check")
    rc1, out1 = sh([py_venv(), "tools/sfx_lib.py", "verify"], timeout=30)
    log(f"ROOT={ROOT}")
    log(f"episode_id={ep_id}, channel={ch}, schemas_loaded={len([k for k in dir(SCHEMAS) if k.endswith('_SCHEMA')])}")
    log(f"sfx_lib verify rc={rc1}: {out1}")
    print(json.dumps({"stage": "dry_check", "ok": rc1 == 0, "root": ROOT, "channel": ch, "episode_id": ep_id}, ensure_ascii=False))


async def stage_script_gate(ep_id, ch):
    beats_rel = f"episodes/{ep_id}.beats.json"
    card_rel = f"episodes/{ep_id}.card.json"
    if not os.path.exists(os.path.join(ROOT, beats_rel)):
        raise FileNotFoundError(f"Missing {beats_rel}")

    phase("1. Deterministic scriptlint (0 token)")
    lint_cmd = [sys.executable or "python3", "tools/scriptlint.py", beats_rel, "--strict"] + (["--rules", "2"] if ch == "trada" else [])
    rc_l, out_l = sh(lint_cmd, timeout=60)
    log(f"scriptlint rc={rc_l}")
    if rc_l != 0:
        print(json.dumps({"stage": "script_gate", "pass": False, "reason": "scriptlint_fail", "output": out_l[-1500:]}, ensure_ascii=False, indent=1))
        return

    phase(f"2. Blind Script Gate ({ch}, model=pro)")
    spec_text = read_text(f".agents/skills/gemini-studio/specs/{ch}.md")
    beats_raw = json.load(open(os.path.join(ROOT, beats_rel), encoding="utf-8"))
    # Strip any logline/meta summary for genuine blind Stranger Test (keep header cards so gate sees screen text)
    blind_beats = {
        "id": beats_raw.get("id"),
        "hook": beats_raw.get("hook"),
        "beats": [
            {k: b[k] for k in ("id", "who", "text", "say", "card", "mood", "land", "pause") if k in b}
            for b in beats_raw.get("beats", [])
        ],
    }
    if beats_raw.get("cards"):
        blind_beats["cards"] = beats_raw["cards"]
    blind_json = json.dumps(blind_beats, ensure_ascii=False, indent=1)

    if ch == "trada":
        prompt = (
            f"Blind Script Gate (8-point Trà đá Blueprint v2.0) for `{ep_id}`.\n"
            "READ-ONLY GATE: do NOT create, edit, or delete any files.\n"
            "DO NOT read treatment.md or card.json — judge strictly from the raw script below for a true Stranger Test.\n"
            "Also audit Vietnamese Hanoi Tèo-Bíp dialogue naturalness (flag stiff/preachy/AI-sounding phrasing).\n\n"
            f"=== CHANNEL SPEC ===\n{spec_text}\n\n"
            f"=== RAW SCRIPT (NO LOGLINE) ===\n{blind_json}\n"
        )
        gate_res = await agent(prompt, schema=SCHEMAS.SCRIPT_GATE_TRADA_SCHEMA, role=f"Blind Script Gate ({ep_id})", model="pro")
        passed = trada_gate_passed(gate_res)
        gate_res["verdict"] = "PASS" if passed else "FAIL"
        facts_res = None
    else:
        card = json.load(open(os.path.join(ROOT, card_rel), encoding="utf-8")) if os.path.exists(os.path.join(ROOT, card_rel)) else {}
        facts = card.get("facts") or []
        cold_prompt = (
            f"Blind GOAT Beef Cold-Reader Gate for `{ep_id}`.\n"
            "READ-ONLY GATE: do NOT create, edit, or delete any files.\n"
            "Judge strictly as a US 16-30 soccer/football viewer scrolling Reels/Shorts. Simulate 3 comments (Ronaldo fan, Messi fan, neutral US).\n\n"
            f"=== CHANNEL SPEC ===\n{spec_text}\n\n"
            f"=== RAW SCRIPT ===\n{blind_json}\n"
        )
        tasks = [("cold", cold_prompt, SCHEMAS.SCRIPT_GATE_GOAT_SCHEMA, f"GOAT Cold-Reader ({ep_id})")]
        if facts:
            fact_prompt = (
                f"GOAT Beef Fact-Checker for `{ep_id}`.\n"
                "READ-ONLY GATE: do NOT create, edit, or delete any files.\n"
                "MANDATORY LIVE VERIFICATION: Use `search_web` (up to 20 queries max) to verify EVERY mutable football/soccer stat, score, date, record, standing, or quote below.\n"
                "Cite at least 2 independent sources (URLs or official stat providers) per mutable number in `sources` and set `verified_live: true` ONLY when checked live.\n"
                "NEVER rely on memory for changing career totals or recent events; if any claim cannot be verified live, set `accurate: false` and `verdict: NOGO`.\n\n"
                f"CLAIMS:\n{json.dumps(facts, ensure_ascii=False, indent=1)}\n\n"
                f"SCRIPT CONTEXT:\n{blind_json}\n"
            )
            tasks.append(("facts", fact_prompt, SCHEMAS.FACT_CHECK_GOAT_SCHEMA, f"GOAT Fact-Checker ({ep_id})"))
        results = await parallel(tasks, lambda t: agent(t[1], schema=t[2], role=t[3], model="pro"))
        gate_res = results[0]
        facts_res = results[1] if len(results) > 1 else {"verdict": "GO", "claims": [], "summary": "No factual claims on card."}
        facts_ok = goat_facts_passed(facts_res, len(facts))
        facts_res["verdict"] = "GO" if facts_ok else "NOGO"
        passed = goat_gate_passed(gate_res) and facts_ok
        gate_res["verdict"] = "PASS" if goat_gate_passed(gate_res) else "FAIL"

    phase("3. Voice Credit Quote (0 token, NO ElevenLabs spend)")
    rc_v, out_v = sh([py_venv(), "tools/voice.py", "need", beats_rel], timeout=60)
    log(f"voice.py need rc={rc_v}")

    if passed and os.path.exists(os.path.join(ROOT, "out", ep_id, "pipeline.json")):
        sh([sys.executable or "python3", "tools/pipeline.py", "status", ep_id, "--run"], timeout=120)
        note = gate_res.get("stranger_retell", "")[:120] if ch == "trada" else f"swipe={gate_res.get('swipe_second')}s, laugh={gate_res.get('first_laugh_s')}s"
        sh([sys.executable or "python3", "tools/pipeline.py", "record", ep_id, "script_gate", "PASS", "--by", "gemini-pro-script-gate", "--note", note], timeout=30)
        if ch == "goat" and facts_res and facts_res.get("claims"):
            sh([sys.executable or "python3", "tools/pipeline.py", "record", ep_id, "facts", "GO", "--by", "gemini-pro-fact-checker", "--note", facts_res.get("summary", "")[:120]], timeout=30)

    out_payload = {
        "stage": "script_gate",
        "episode_id": ep_id,
        "channel": ch,
        "pass": passed,
        "script_gate": gate_res,
        "facts_check": facts_res,
        "voice_need_quote": out_v,
        "next_human_lock": (
            f'STOP FOR OWNER CREDIT LOCK: show quote above, then record:\n'
            f'python3 tools/pipeline.py record {ep_id} credit_owner OK --by driver --quote "<owner words>"'
            if passed
            else "Fix script issues in fix_list and re-run stage=script_gate."
        ),
    }
    print(json.dumps(out_payload, ensure_ascii=False, indent=1))


async def stage_audio(ep_id, ch):
    beats_rel = f"episodes/{ep_id}.beats.json"
    phase("1. Verify Credit Lock (NEVER calls ElevenLabs record)")
    rc_lock, out_lock = sh([sys.executable or "python3", "tools/rules2.py", ep_id], timeout=30)
    if rc_lock != 0:
        log(f"CREDIT LOCK ACTIVE: {out_lock}")
        print(json.dumps({"stage": "audio", "pass": False, "locked": True, "detail": out_lock}, ensure_ascii=False, indent=1))
        return

    phase("2. Build Audio Mix + Audiogate + Real-Time Lint + Mix Preview")
    cmd = [sys.executable or "python3", "tools/build_check.py", beats_rel, "--audio"]
    if args.get("skip_audio_build"):
        cmd.append("--skip-build")
    rc_a, out_a = sh(cmd, timeout=360)
    log(out_a)
    ac_path = os.path.join(ROOT, "out", ep_id, "audio_check.json")
    ac = json.load(open(ac_path, encoding="utf-8")) if os.path.exists(ac_path) else {"pass": rc_a == 0}
    preview = ac.get("mix_preview")
    print(json.dumps({
        "stage": "audio",
        "episode_id": ep_id,
        "pass": rc_a == 0 and bool(ac.get("pass")),
        "report": out_a,
        "synth_fallbacks": ac.get("synth_fallbacks", []),
        "mix_preview_abs": os.path.join(ROOT, preview) if preview else None,
        "next_action": f'Main: call read_file on {os.path.join(ROOT, preview)} to verify pronunciation, pacing, music & SFX before 3D build.' if preview else "Fix audio errors above.",
    }, ensure_ascii=False, indent=1))


async def stage_build_and_gate(ep_id, ch):
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
    if '"estimated": true' in read_text(times_rel, 4000) or '"estimated":true' in read_text(times_rel, 4000):
        raise RuntimeError(f"{times_rel} is still ESTIMATED — run stage='audio' after voice recording before stage='build_and_gate'.")
    if not os.path.exists(mix_abs):
        raise FileNotFoundError(f"Missing {mix_abs} — run stage='audio' before final render.")

    phase("1. 3D Episode Build (stateful flash, pre-injected context, max 3 batched rounds)")
    core_doc = read_text(".agents/skills/gemini-studio/ENGINE-CORE.md", 16000)
    spec_doc = read_text(f".agents/skills/gemini-studio/specs/{ch}.md", 12000)
    treat_doc = read_text(treat_rel, 12000)
    beats_doc = read_text(beats_rel, 16000)
    times_doc = read_text(times_rel, 12000)
    existing_ep = read_text(ep_rel, 24000)

    standing = (
        f"You are the Gemini Studio 3D Builder for cine3d (`{ep_id}`, channel `{ch}`).\n"
        f"Workspace root: {ROOT}\n"
        "STRICT CONTEXT & SPEED RULES:\n"
        "- All core docs (ENGINE-CORE + channel spec) are ALREADY injected below — do NOT waste turns re-reading them or reading `ENGINE.md` (164 KB).\n"
        "- Only check `.agents/skills/gemini-studio/ENGINE-INDEX.md` if you need a rare set (GTA/Zombie/chest/setswap).\n"
        "- Prefer `core/ep_kit.js` (`makeKit`, `v2Defaults`/`goatDefaults`, `v2Hook`) so shots tile cleanly with zero gaps.\n"
        "- NEVER run `voice.py record` or touch `.claude/`.\n"
        "- Fix ALL reported QA/clip errors together in ONE batched edit per round — never chase one error at a time.\n\n"
        f"=== ENGINE-CORE.md ===\n{core_doc}\n\n"
        f"=== CHANNEL SPEC ({ch}) ===\n{spec_doc}\n"
    )
    builder = agent(standing, role=f"3D Builder ({ep_id})", model="flash")

    build_prompt = (
        f"Write or update `{os.path.join(ROOT, ep_rel)}` (and `episodes/{ep_id}_props.js` ONLY if custom 3D props are needed) on REAL times in ONE pass.\n"
        "All input files are pre-injected below — write the file directly without wasting tool calls re-reading them.\n"
        "Do NOT run QA yourself — the workflow runs `tools/build_check.py` deterministically right after you finish.\n\n"
        f"=== {treat_rel} ===\n{treat_doc or '(none)'}\n\n"
        f"=== {beats_rel} ===\n{beats_doc}\n\n"
        f"=== {times_rel} ===\n{times_doc}\n"
        + (f"\n=== EXISTING {ep_rel} (polish instead of rewriting from scratch) ===\n{existing_ep}\n" if existing_ep else "")
    )

    pic_ok = False
    last_check = ""
    for rnd in range(1, max_rounds + 1):
        log(f"Builder round {rnd}/{max_rounds}")
        b_res = await builder(build_prompt, SCHEMAS.BUILDER_RESULT_SCHEMA)
        if b_res.get("status") == "BLOCKED":
            log(f"Builder reported BLOCKED: {b_res.get('blockers')}")
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

    if not pic_ok:
        del builder
        print(json.dumps({
            "stage": "build_and_gate",
            "episode_id": ep_id,
            "pass": False,
            "reason": f"build_check failed after {max_rounds} rounds",
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
        print(json.dumps({"stage": "build_and_gate", "episode_id": ep_id, "pass": False, "reason": "final_render_or_smooth_fail", "output": out_f}, ensure_ascii=False, indent=1))
        return

    proxy_abs = os.path.join(ROOT, "out", ep_id, "review_proxy.mp4")
    bc_abs = os.path.join(ROOT, "out", ep_id, "build_check.json")
    mp4_rel = f"out/{ep_id}/{ep_id}.mp4"

    phase("3. Blind Multimodal Episode Gate (pro watches + listens to review_proxy.mp4)")
    bc_text = read_text(f"out/{ep_id}/build_check.json", 12000)
    rev_standing = (
        f"You are the independent Blind Episode Gate Reviewer for cine3d (`{ep_id}`, channel `{ch}`).\n"
        "READ-ONLY GATE: do NOT create, edit, or delete any files.\n"
        "TWO-STEP SINGLE-PASS AUDIT (do NOT waste turns re-reading spec/beats — they are pre-injected below):\n"
        "  1. Call `read_file` on `review_proxy.mp4` FIRST to watch real motion AND hear real voice/SFX/music cold.\n"
        "  2. Cross-check what you saw & heard against the pre-injected channel spec, machine report, and beats below.\n"
        "Judge ALL 6 doors strictly with concrete timestamps and evidence. If FAIL, provide ONE consolidated fix_list with exact parameter/timing fixes.\n\n"
        f"=== CHANNEL SPEC ({ch}) ===\n{spec_doc}\n\n"
        f"=== SCRIPT BEATS (for post-watch cross-check of missing lines/gags) ===\n{beats_doc}\n"
    )
    reviewer = agent(rev_standing, role=f"Blind Episode Gate ({ep_id})", model="pro")
    gate_res = await reviewer(
        f"Watch and listen to `{proxy_abs}` via `read_file` now, then cross-check with the machine report below and return the 6-door verdict.\n\n"
        f"=== build_check.json ===\n{bc_text}\n",
        SCHEMAS.EPISODE_GATE_SCHEMA,
    )
    gate_ok = episode_gate_passed(gate_res)
    render_fresh = True
    log(f"Episode Gate round 1: pass={gate_ok}, summary={gate_res.get('summary', '')[:120]}")

    # At most 1 consolidated post-gate fix pass on the same stateful builder + targeted re-check
    if not gate_ok and gate_res.get("fix_list"):
        phase("4. Consolidated Post-Gate Fix (1 pass) + Re-Render + Targeted Re-Check")
        fix_json = json.dumps(gate_res["fix_list"], ensure_ascii=False, indent=1)
        await builder(
            f"The Blind Episode Gate watched `{proxy_abs}` and returned ONE consolidated fix_list. "
            f"Apply ALL fixes below cleanly to `{ep_rel}`:\n\n{fix_json}\n",
            SCHEMAS.BUILDER_RESULT_SCHEMA,
        )
        render_fresh = False
        rc_c2, out_c2 = sh([sys.executable or "python3", "tools/build_check.py", ep_rel], timeout=360)
        if rc_c2 != 0:
            # 1 emergency QA repair pass so we never render broken QA
            await builder(f"Fix these QA/clip errors introduced by the gate edit:\n\n{out_c2}\n", SCHEMAS.BUILDER_RESULT_SCHEMA)
            rc_c2, out_c2 = sh([sys.executable or "python3", "tools/build_check.py", ep_rel], timeout=360)
        if rc_c2 == 0:
            rc_f, out_f = run_final_render()
            log(out_f)
            if rc_f == 0:
                render_fresh = True
                bc_text2 = read_text(f"out/{ep_id}/build_check.json", 12000)
                gate_res = await reviewer(
                    f"Re-watch `{proxy_abs}` via `read_file` specifically verifying every timestamp in your previous fix_list was resolved without regressions.\n\n=== UPDATED build_check.json ===\n{bc_text2}\n",
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

    if render_fresh and os.path.exists(os.path.join(ROOT, "out", ep_id, "pipeline.json")) and os.path.exists(os.path.join(ROOT, mp4_rel)):
        sh([sys.executable or "python3", "tools/pipeline.py", "status", ep_id, "--run"], timeout=120)
        sh([sys.executable or "python3", "tools/pipeline.py", "record", ep_id, "render", "OK", "--by", "gemini-workflow", "--mp4", mp4_rel], timeout=30)
        sh([sys.executable or "python3", "tools/pipeline.py", "status", ep_id, "--run"], timeout=180)
        sh([sys.executable or "python3", "tools/pipeline.py", "record", ep_id, "episode_gate", "PASS" if gate_ok else "FAIL", "--by", "gemini-pro-episode-gate", "--note", gate_res.get("summary", "")[:140]], timeout=30)

    print(json.dumps({
        "stage": "build_and_gate",
        "episode_id": ep_id,
        "pass": bool(render_fresh and gate_ok),
        "render_fresh": render_fresh,
        "final_mp4": os.path.join(ROOT, mp4_rel),
        "review_proxy": proxy_abs,
        "episode_gate": gate_res,
        "next_action": (
            f'Main (Gemini 4 Neon High): call read_file("{proxy_abs}") to watch+listen final 6 doors, record driver_review OK, then deliver Final MP4 to owner.'
            if (render_fresh and gate_ok)
            else "Post-gate fix/render did not pass — inspect logs and episode_gate.fix_list before re-running."
        ),
    }, ensure_ascii=False, indent=1))


async def stage_package(ep_id, ch):
    phase("1. Verify pipeline.py can-post (0 token)")
    rc_cp, out_cp = sh([sys.executable or "python3", "tools/pipeline.py", "can-post", ep_id], timeout=30)
    if rc_cp != 0:
        log(f"can-post BLOCKED: {out_cp}")
        print(json.dumps({"stage": "package", "pass": False, "can_post": False, "detail": out_cp}, ensure_ascii=False, indent=1))
        return

    phase("2. Generate Posting Package (flash_lite, NO auto-publish)")
    pkg_rel = f"out/{ep_id}/goi-dang.md"
    spec_text = read_text(f".agents/skills/gemini-studio/specs/{ch}.md")
    card_text = read_text(f"episodes/{ep_id}.card.json")
    prompt = (
        f"Create the ready-to-post package at `{os.path.join(ROOT, pkg_rel)}` for `{ep_id}` (channel `{ch}`).\n"
        "NEVER post, upload, schedule, or call YouTube/TikTok/Facebook APIs or browser tools.\n"
        "Follow every title/hashtag/pinned-comment rule in the channel spec strictly (e.g., NO 'Tập N' for trada; include 'Ronaldo' or 'Messi' + binary question for goat).\n\n"
        f"=== CHANNEL SPEC ===\n{spec_text}\n\n"
        f"=== EPISODE CARD ===\n{card_text}\n"
    )
    res = await agent(prompt, schema=SCHEMAS.PACKAGE_RESULT_SCHEMA, role=f"Packager ({ep_id})", model="flash_lite")
    res["can_post_verified"] = True
    print(json.dumps({"stage": "package", "episode_id": ep_id, "pass": res.get("status") == "PACKAGED", "package": res}, ensure_ascii=False, indent=1))


ep_id = args.get("episode_id")
stage = args.get("stage")
if not ep_id or stage not in ("script_gate", "audio", "build_and_gate", "package", "dry_check"):
    raise ValueError("Args must include 'episode_id' and 'stage' in ('script_gate', 'audio', 'build_and_gate', 'package', 'dry_check').")

ch = detect_channel(ep_id)
if stage == "dry_check":
    await stage_dry_check(ep_id, ch)
elif stage == "script_gate":
    await stage_script_gate(ep_id, ch)
elif stage == "audio":
    await stage_audio(ep_id, ch)
elif stage == "build_and_gate":
    await stage_build_and_gate(ep_id, ch)
elif stage == "package":
    await stage_package(ep_id, ch)
