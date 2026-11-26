"""Strict JSON Schemas for Gemini Studio subagents (used with Antigravity `run_workflow` `agent(..., schema=...)`).
Prevents rule-drift and enforces structured, timestamped, evidence-backed verdicts (v2.1 Writers' Room + Kill-Floor)."""

_IDEATE_TAKE_SCHEMA = {
    "type": "object",
    "properties": {
        "angle": {"type": "string", "description": "Short punchy title/angle for this take."},
        "pillar_or_kind": {"type": "string"},
        "comedy_engine": {"type": "string", "description": "Primary comedy/emotional mechanism from WRITERS-ROOM.md."},
        "hook": {"type": "string", "description": "First 0-2.5s visual + opening line."},
        "twist": {"type": "string", "description": "Late re-contextualizing turn / second punch."},
        "visual_gag": {"type": "string", "description": "Visual payoff that lands even on mute."},
        "share_recipient": {"type": "string", "description": "Exact person the viewer forwards this to (or fan debate trigger)."},
        "kill_score_est": {"type": "integer", "minimum": 1, "maximum": 10},
    },
    "required": [
        "angle",
        "pillar_or_kind",
        "comedy_engine",
        "hook",
        "twist",
        "visual_gag",
        "share_recipient",
        "kill_score_est",
    ],
}

IDEATE_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "A_grounded": _IDEATE_TAKE_SCHEMA,
        "B_visual": _IDEATE_TAKE_SCHEMA,
        "C_wildcard": _IDEATE_TAKE_SCHEMA,
        "winner_take": {"type": "string", "enum": ["A_grounded", "B_visual", "C_wildcard"]},
        "why_winner": {"type": "string"},
        "why_others_killed": {
            "type": "array",
            "minItems": 2,
            "maxItems": 2,
            "items": {"type": "string"},
            "description": "Blunt, honest reason each of the 2 losing takes was killed.",
        },
        "draft_card": {
            "type": "object",
            "description": "Ready-to-edit episode card JSON matching CARD_REQ for the chosen channel.",
        },
    },
    "required": [
        "A_grounded",
        "B_visual",
        "C_wildcard",
        "winner_take",
        "why_winner",
        "why_others_killed",
        "draft_card",
    ],
}

SCRIPT_GATE_TRADA_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["PASS", "FAIL"]},
        "score": {"type": "integer", "minimum": 0, "maximum": 8},
        "stranger_retell": {
            "type": "string",
            "description": "Blind retell of the full story in <= 2 Vietnamese sentences without reading the logline.",
        },
        "first_laugh_s": {"type": "number", "description": "Estimated second of first laugh/hook punch (< 5.5s comedy, <= 7.5s emotional)."},
        "points": {
            "type": "array",
            "minItems": 8,
            "maxItems": 8,
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer", "minimum": 1, "maximum": 8},
                    "name": {"type": "string"},
                    "mandatory": {"type": "boolean"},
                    "pass": {"type": "boolean"},
                    "affects_logic_or_comedy": {"type": "boolean"},
                    "note": {"type": "string"},
                },
                "required": ["id", "name", "mandatory", "pass", "affects_logic_or_comedy", "note"],
            },
        },
        "blocking_checks": {
            "type": "object",
            "properties": {
                "cause_chain_and_who_knows_what": {"type": "boolean"},
                "no_4_to_10s_cliff": {"type": "boolean"},
                "clear_share_recipient": {"type": "boolean"},
                "world_logic_intact": {"type": "boolean"},
            },
            "required": [
                "cause_chain_and_who_knows_what",
                "no_4_to_10s_cliff",
                "clear_share_recipient",
                "world_logic_intact",
            ],
        },
        "entertainment_scores": {
            "type": "object",
            "description": "Kill-Floor entertainment quality scores (1-10). Every axis MUST be >= 7 to PASS.",
            "properties": {
                "hook_thumbstop_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "comedy_or_emotion_punch_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "originality_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "dialogue_authenticity_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "visual_storytelling_score": {"type": "integer", "minimum": 1, "maximum": 10},
            },
            "required": [
                "hook_thumbstop_score",
                "comedy_or_emotion_punch_score",
                "originality_score",
                "dialogue_authenticity_score",
                "visual_storytelling_score",
            ],
        },
        "ai_smell_lines": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Exact beat ids + lines that sound translated, stiff, preachy, or AI-generic.",
        },
        "weak_lines": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Flat, verbose, or filler lines that should be cut or punched up.",
        },
        "vietnamese_voice_naturalness": {
            "type": "string",
            "description": "Brief check on Hanoi Tèo-Bíp voice authenticity.",
        },
        "fix_list": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Consolidated, exact line-level fixes required if FAIL (empty if PASS).",
        },
    },
    "required": [
        "verdict",
        "score",
        "stranger_retell",
        "first_laugh_s",
        "points",
        "blocking_checks",
        "entertainment_scores",
        "ai_smell_lines",
        "weak_lines",
        "vietnamese_voice_naturalness",
        "fix_list",
    ],
}

SCRIPT_GATE_GOAT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["PASS", "FAIL"]},
        "swipe_second": {"type": "number", "description": "Predicted swipe-away second (> 6.0 required)."},
        "swipe_reason": {"type": "string", "description": "Exact beat/reason where a scrolling US viewer would hesitate or swipe."},
        "first_laugh_s": {"type": "number", "description": "First genuine laugh second (< 6.0 required)."},
        "standalone_claim_under_2s": {"type": "boolean"},
        "no_stat_round_before_15s": {"type": "boolean"},
        "max_one_number_per_line": {"type": "boolean"},
        "fresh_ending": {"type": "boolean"},
        "entertainment_scores": {
            "type": "object",
            "description": "Kill-Floor entertainment quality scores (1-10). Every axis MUST be >= 7 to PASS.",
            "properties": {
                "hook_thumbstop_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "comedy_or_emotion_punch_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "originality_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "dialogue_authenticity_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "visual_storytelling_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "loser_steelman_score": {"type": "integer", "minimum": 1, "maximum": 10},
            },
            "required": [
                "hook_thumbstop_score",
                "comedy_or_emotion_punch_score",
                "originality_score",
                "dialogue_authenticity_score",
                "visual_storytelling_score",
                "loser_steelman_score",
            ],
        },
        "ai_smell_lines": {"type": "array", "items": {"type": "string"}},
        "weak_lines": {"type": "array", "items": {"type": "string"}},
        "simulated_comments": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "viewer": {"type": "string", "enum": ["ronaldo_fan", "messi_fan", "neutral_us"]},
                    "would_comment": {"type": "boolean"},
                    "comment": {"type": "string"},
                },
                "required": ["viewer", "would_comment", "comment"],
            },
        },
        "fans_disagree": {"type": "boolean"},
        "fix_list": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "verdict",
        "swipe_second",
        "swipe_reason",
        "first_laugh_s",
        "standalone_claim_under_2s",
        "no_stat_round_before_15s",
        "max_one_number_per_line",
        "fresh_ending",
        "entertainment_scores",
        "ai_smell_lines",
        "weak_lines",
        "simulated_comments",
        "fans_disagree",
        "fix_list",
    ],
}

FACT_CHECK_GOAT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["GO", "NOGO"]},
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "accurate": {"type": "boolean"},
                    "verified_live": {"type": "boolean", "description": "True if verified via live web search (not memory alone)."},
                    "single_primary_source": {
                        "type": "boolean",
                        "description": "True ONLY if a single official primary authority (FIFA/UEFA/league) is the sole source; otherwise >= 2 sources required.",
                    },
                    "sources": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Independent source URLs or official publications checked (>= 2 per mutable stat unless single_primary_source).",
                    },
                    "note": {"type": "string"},
                },
                "required": ["claim", "accurate", "verified_live", "sources", "note"],
            },
        },
        "summary": {"type": "string"},
    },
    "required": ["verdict", "claims", "summary"],
}

BUILDER_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "status": {"type": "string", "enum": ["READY", "BLOCKED"]},
        "files_written": {"type": "array", "items": {"type": "string"}},
        "changes_summary": {"type": "string"},
        "waivers_added": {"type": "array", "items": {"type": "string"}},
        "blockers": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["status", "files_written", "changes_summary", "waivers_added", "blockers"],
}

EPISODE_BLIND_WATCH_SCHEMA = {
    "type": "object",
    "description": "Step 1 of true 2-step Blind Episode Gate: written purely from watching/listening to review_proxy.mp4 BEFORE seeing beats.json or build_check.json.",
    "properties": {
        "watched_proxy": {"type": "boolean"},
        "cold_retell": {"type": "string", "description": "What happened in the video in 1-2 plain sentences without seeing the script."},
        "hook_and_pacing_feel": {"type": "string"},
        "visual_glitches_seen": {"type": "array", "items": {"type": "string"}},
        "audio_impressions": {"type": "string"},
    },
    "required": ["watched_proxy", "cold_retell", "hook_and_pacing_feel", "visual_glitches_seen", "audio_impressions"],
}

EPISODE_GATE_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["PASS", "FAIL"]},
        "watched_proxy": {"type": "boolean", "description": "Must be true: reviewer actually called read_file on review_proxy.mp4."},
        "blind_cold_retell": {"type": "string", "description": "Cold retell captured during blind Step 1 before seeing beats/reports."},
        "doors": {
            "type": "array",
            "minItems": 6,
            "maxItems": 6,
            "items": {
                "type": "object",
                "properties": {
                    "door": {"type": "integer", "minimum": 1, "maximum": 6},
                    "name": {"type": "string"},
                    "pass": {"type": "boolean"},
                    "evidence": {"type": "string", "description": "Concrete visual/audio observation from the watched video."},
                },
                "required": ["door", "name", "pass", "evidence"],
            },
        },
        "audio_check": {
            "type": "object",
            "properties": {
                "voice_clear_over_music": {"type": "boolean"},
                "lip_sync_ok": {"type": "boolean"},
                "sfx_clean_no_harsh_synth": {"type": "boolean"},
                "no_dead_silence_first_10s": {"type": "boolean"},
                "notes": {"type": "string"},
            },
            "required": [
                "voice_clear_over_music",
                "lip_sync_ok",
                "sfx_clean_no_harsh_synth",
                "no_dead_silence_first_10s",
                "notes",
            ],
        },
        "waivers_audit": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "waiver": {"type": "string"},
                    "justified": {"type": "boolean"},
                    "note": {"type": "string"},
                },
                "required": ["waiver", "justified", "note"],
            },
            "description": "Audit of every QA/clipcheck waiver reported in build_check.json.",
        },
        "fix_list": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "timestamp_s": {"type": "number"},
                    "door": {"type": "integer", "minimum": 1, "maximum": 6},
                    "issue": {"type": "string"},
                    "exact_fix": {"type": "string", "description": "Exact code/parameter/timing change for the builder."},
                },
                "required": ["timestamp_s", "door", "issue", "exact_fix"],
            },
        },
        "summary": {"type": "string"},
    },
    "required": [
        "verdict",
        "watched_proxy",
        "blind_cold_retell",
        "doors",
        "audio_check",
        "waivers_audit",
        "fix_list",
        "summary",
    ],
}

PACKAGE_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "status": {"type": "string", "enum": ["PACKAGED", "BLOCKED"]},
        "package_file": {"type": "string"},
        "yt_title": {"type": "string"},
        "tiktok_title": {"type": "string"},
        "pinned_comment": {"type": "string"},
        "can_post_verified": {"type": "boolean"},
        "note": {"type": "string"},
    },
    "required": ["status", "package_file", "yt_title", "tiktok_title", "pinned_comment", "can_post_verified", "note"],
}
