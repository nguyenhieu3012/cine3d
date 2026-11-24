"""Strict JSON Schemas for Gemini Studio subagents (used with Antigravity `run_workflow` `agent(..., schema=...)`).
Prevents rule-drift and enforces structured, timestamped, evidence-backed verdicts."""

SCRIPT_GATE_TRADA_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["PASS", "FAIL"]},
        "score": {"type": "integer", "minimum": 0, "maximum": 8},
        "stranger_retell": {
            "type": "string",
            "description": "Blind retell of the full story in <= 2 Vietnamese sentences without reading the logline.",
        },
        "first_laugh_s": {"type": "number", "description": "Estimated second of first laugh/counter (< 5.5s target)."},
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
        "vietnamese_voice_naturalness": {
            "type": "string",
            "description": "Brief check on Hanoi Tèo-Bíp voice authenticity (flag any stiff/AI-translated/preachy lines).",
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
        "vietnamese_voice_naturalness",
        "fix_list",
    ],
}

SCRIPT_GATE_GOAT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["PASS", "FAIL"]},
        "swipe_second": {"type": "number", "description": "Predicted swipe-away second (> 6.0 required)."},
        "first_laugh_s": {"type": "number", "description": "First genuine laugh second (< 6.0 required)."},
        "standalone_claim_under_2s": {"type": "boolean"},
        "no_stat_round_before_15s": {"type": "boolean"},
        "max_one_number_per_line": {"type": "boolean"},
        "fresh_ending": {"type": "boolean"},
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
        "first_laugh_s",
        "standalone_claim_under_2s",
        "no_stat_round_before_15s",
        "max_one_number_per_line",
        "fresh_ending",
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
                    "sources": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Independent source URLs or official publications checked (aim for >= 2 per mutable stat).",
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

EPISODE_GATE_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["PASS", "FAIL"]},
        "watched_proxy": {"type": "boolean", "description": "Must be true: reviewer actually called read_file on review_proxy.mp4."},
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
    "required": ["verdict", "watched_proxy", "doors", "audio_check", "fix_list", "summary"],
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
