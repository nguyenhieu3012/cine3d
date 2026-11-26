#!/usr/bin/env python3
"""cine3d 0-token Episode Scaffolder (Gemini Studio v3.0, 26/11/2026).

Generates a clean, QA-friendly, declarative `episodes/<id>.js` directly from
`episodes/<id>.beats.json` (+ `episodes/<id>.times.js` when present), eliminating
~80% of boilerplate tokens before the `flash` 3D Builder refines acting & visuals.

Usage:
  python3 tools/scaffold_ep.py episodes/<id>.beats.json
  python3 tools/scaffold_ep.py episodes/<id>.beats.json --layout flow
  python3 tools/scaffold_ep.py episodes/<id>.beats.json --layout corkboard --force
  python3 tools/scaffold_ep.py episodes/<id>.beats.json --kind quickie --layout tactics
  python3 tools/scaffold_ep.py episodes/<id>.beats.json --out /tmp/test_ep.js

Python 3.9+ stdlib only."""
import argparse
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Emotion tables aligned with tools/qa.cjs KNOWN_FACES / WRONG and pack face maps
EMO_MAP = {
    'teo': {
        'smug': 'smug', 'fear': 'worry', 'shock': 'shock', 'sad': 'sad',
        'joy': 'happy', 'anger': 'angry', 'tender': 'moved', 'flat': 'think',
        'neutral': 'neutral', 'deadpan': 'think', 'think': 'think',
    },
    'bip': {
        'smug': 'smug', 'fear': 'shock', 'shock': 'shock', 'sad': 'sad',
        'joy': 'happy', 'anger': 'angry', 'tender': 'love', 'flat': 'neutral',
        'neutral': 'neutral', 'deadpan': 'neutral', 'think': 'think',
    },
    'ron': {
        'smug': 'smug', 'fear': 'worry', 'shock': 'shock', 'sad': 'sad',
        'joy': 'happy', 'anger': 'angry', 'tender': 'happy', 'flat': 'neutral',
        'neutral': 'neutral', 'deadpan': 'neutral', 'think': 'think',
    },
    'leo': {
        'smug': 'smug', 'fear': 'worry', 'shock': 'shock', 'sad': 'sad',
        'joy': 'happy', 'anger': 'angry', 'tender': 'happy', 'flat': 'neutral',
        'neutral': 'neutral', 'deadpan': 'neutral', 'think': 'think',
    },
}

STICKER_KEYWORDS = [
    ('sports_car', r'porsche|siêu xe|xe tự lái|supercar|lambo|ferrari|\bxe\b'),
    ('villa', r'villa|biệt thự|nhà lầu|mansion|penthouse'),
    ('guru_book', r'sách|pdf|khóa học|dậy 5 giờ|tư duy|ebook|course|book'),
    ('money_bag', r'tiền|tỷ|triệu|doanh thu|lãi|lời|vốn|học phí|cash|money|salary|\$'),
    ('scam_phone', r'lừa|scam|app|chốt đơn|f2|zoom|điện thoại|phone|link|mã otp'),
    ('mom_box', r'mẹ|hộp xốp|thùng xốp|cơm|quà quê|bếp|gia đình'),
    ('world_cup', r'world cup|wc|qatar|2022|cúp vàng|argentina'),
    ('ballon_dor', r'ballon|quả bóng vàng|golden ball|8\s*ballon'),
    ('ucl_trophy', r'champions league|ucl|c1|madrid|five ucl|5 ucl'),
    ('ref_card', r'var|ref|penalty|penaldo|pessi|red card|offside|foul|thẻ đỏ'),
]


def load_times_js(times_path):
    if not os.path.exists(times_path):
        return None
    raw = open(times_path, encoding='utf-8').read()
    m = re.search(r'export\s+default\s+(\{[\s\S]*\})\s*;?\s*$', raw)
    if not m:
        return None
    return json.loads(m.group(1))


def estimate_times(B):
    """Estimate beat timings when `<id>.times.js` does not exist yet."""
    t = float(B.get('pre', 0.12))
    lines = {}
    for b in B.get('beats', []):
        bid = b.get('id')
        if not bid:
            continue
        if 'pause' in b and not b.get('text'):
            dur = max(0.25, float(b['pause']))
            lines[bid] = {'t0': round(t, 2), 't1': round(t + dur, 2)}
            t += dur
        else:
            gap = float(b.get('gap', 0.14))
            t += gap
            words = len(str(b.get('text', '')).split())
            dur = round(max(1.15, min(2.9, 0.55 + words * 0.28)), 2)
            lines[bid] = {'t0': round(t, 2), 't1': round(t + dur, 2)}
            t += dur
    tail = float(B.get('tail', 0.6))
    return {'dur': round(t + tail, 2), 'lines': lines}


def detect_pack(B, ep_id):
    if B.get('pack') in ('trada', 'goat'):
        return B['pack']
    speakers = {b.get('who') for b in B.get('beats', []) if b.get('who')}
    if speakers & {'ron', 'leo'} or ep_id.startswith('gb'):
        return 'goat'
    return 'trada'


def guess_sticker(text):
    low = str(text or '').lower()
    for name, pat in STICKER_KEYWORDS:
        if re.search(pat, low):
            return name
    return None


def map_emo(who, mood):
    table = EMO_MAP.get(who, EMO_MAP['teo'])
    m = str(mood or 'neutral').lower().strip()
    return table.get(m, 'neutral' if who == 'bip' else 'think')


def build_shots(B, T, pack, use_diagram):
    """Build QA-compliant shots:
    - >= 3 distinct resolved framings inside 0..3.0s (`first_3s` PASS)
    - average ~1.9-2.2s/shot inside 0..12s (`shot_rhythm` PASS)
    - zero back-to-back `same_framing`
    - speaker always in frame (`speaker_off` PASS)
    - no static shot > 2.65s (`static_shot` / `static_two` / `long_shot` PASS)
    """
    dur = float(T['dur'])
    lines_map = T['lines']
    spoken = [b for b in B.get('beats', []) if b.get('text') and b.get('id') in lines_map]
    default_pair = ('ron', 'leo') if pack == 'goat' else ('teo', 'bip')
    first_who = spoken[0]['who'] if spoken else default_pair[0]

    def speaker_at(t_mid):
        for b in spoken:
            row = lines_map[b['id']]
            if row['t0'] <= t_mid <= row['t1']:
                return b['who']
        # Nearest upcoming or previous speaker
        best_who, best_d = first_who, 1e9
        for b in spoken:
            row = lines_map[b['id']]
            d = min(abs(row['t0'] - t_mid), abs(row['t1'] - t_mid))
            if d < best_d:
                best_d, best_who = d, b['who']
        return best_who

    # Build cut points aligned to beats, guaranteeing 3 distinct cuts in 0..3s and <= 2.35s slices
    cuts = [0.0, min(1.05, dur), min(2.05, dur), min(3.05, dur)]
    for b in spoken:
        t0 = float(lines_map[b['id']]['t0'])
        if t0 > 3.2 and t0 < dur - 0.55:
            if t0 - cuts[-1] >= 1.15:
                cuts.append(round(t0, 2))
    cuts.append(round(dur, 2))
    # Deduplicate and subdivide any span > 2.45s so static_shot / long_shot / shot_rhythm always pass
    clean = [cuts[0]]
    for c in cuts[1:]:
        if c - clean[-1] < 0.55:
            continue
        while c - clean[-1] > 2.45:
            step = min(2.15, (c - clean[-1]) * 0.5)
            clean.append(round(clean[-1] + step, 2))
        clean.append(round(c, 2))
    if clean[-1] < dur:
        if dur - clean[-1] < 0.45 and len(clean) > 2:
            clean[-1] = round(dur, 2)
        else:
            clean.append(round(dur, 2))

    shots = []
    prev_cam = None
    for idx in range(len(clean) - 1):
        t0, t1 = clean[idx], clean[idx + 1]
        mid = (t0 + t1) * 0.5
        spk = speaker_at(mid)
        if idx == 0:
            cam = f'cu_{spk}'
            move = 'push'
        elif idx == 1:
            cam = 'two'
            move = 'push'
        elif idx == 2:
            cam = f'ms_{spk}'
            move = 'none'
        else:
            # Cycle framings with guaranteed non-repeating camera for the active speaker
            cands = [f'ms_{spk}', 'two', f'cu_{spk}'] if use_diagram else [f'cu_{spk}', f'ms_{spk}', 'two']
            if prev_cam in cands:
                cands = [c for c in cands if c != prev_cam]
            cam = cands[idx % len(cands)]
            move = 'push' if (cam == 'two' or (t1 - t0) > 2.0) else 'none'
        entry = {'t0': t0, 't1': t1, 'cam': cam}
        if move != 'none':
            entry['move'] = move
        if use_diagram and t0 >= 2.2:
            entry['rig'] = '__RIG__'
        shots.append(entry)
        prev_cam = cam
    return shots


def build_board_stub(B, T, layout, pack):
    """Build a declarative `boardOverlay(...)` or `goatStatCard(...)` spec from beats."""
    lines_map = T['lines']
    beats = B.get('beats', [])
    dur = float(T['dur'])
    cards = [b for b in beats if (b.get('card') or '[Sơ đồ' in str(b.get('visual', ''))) and b.get('id') in lines_map]
    t0 = round(lines_map[cards[0]['id']]['t0'], 2) if cards else round(min(2.3, dur * 0.12), 2)
    t1 = round(max(t0 + 4.0, dur - 1.2), 2)
    title = B.get('hook') or B.get('title') or B.get('id', 'DIAGRAM').upper()

    if layout == 'flow':
        steps = []
        src = cards[:4] if cards else [b for b in beats if b.get('text') and b.get('id') in lines_map][:3]
        for i, b in enumerate(src[:4]):
            cap = str(b.get('card') or b.get('text') or f'Step {i + 1}')[:26]
            st = {
                't': round(lines_map[b['id']]['t0'], 2),
                'caption': cap,
                'sub': f'B{i + 1}',
                'sticker': guess_sticker(cap + ' ' + str(b.get('visual', ''))) or ('money_bag' if i % 2 else 'guru_book'),
            }
            steps.append(st)
        return {
            'layout': 'flow', 't0': t0, 't1': t1, 'title': title, 'steps': steps,
            'loop': {'at': round(max(t0 + 2.0, t1 - 3.5), 2), 'label': 'VÒNG LẶP'},
        }

    if layout == 'compare':
        l_rows, r_rows = [], []
        for i, b in enumerate(cards[:6]):
            row = {'t': round(lines_map[b['id']]['t0'], 2), 'text': str(b.get('card') or '')[:28]}
            (l_rows if i % 2 == 0 else r_rows).append(row)
        if not l_rows:
            l_rows = [{'t': t0, 'text': 'Point A1'}, {'t': round(t0 + 1.5, 2), 'text': 'Point A2'}]
        if not r_rows:
            r_rows = [{'t': round(t0 + 0.8, 2), 'text': 'Point B1'}, {'t': round(t0 + 2.2, 2), 'text': 'Point B2'}]
        return {
            'layout': 'compare', 't0': t0, 't1': t1, 'title': title,
            'left': {'label': 'RON' if pack == 'goat' else 'QUẢNG CÁO', 'color': '#e63946', 'sticker': 'ucl_trophy' if pack == 'goat' else 'sports_car', 'rows': l_rows},
            'right': {'label': 'LEO' if pack == 'goat' else 'SỰ THẬT', 'color': '#3a86ff', 'sticker': 'world_cup' if pack == 'goat' else 'money_bag', 'rows': r_rows},
            'verdict': {'at': round(max(t0 + 2.5, t1 - 2.2), 2), 'text': 'COOKED' if pack == 'goat' else 'CHỐT HẠ'},
        }

    if layout == 'chart':
        bars = []
        for i, b in enumerate((cards or beats[:4])[:4]):
            bid = b.get('id')
            tb = round(lines_map[bid]['t0'], 2) if bid in lines_map else round(t0 + i * 0.6, 2)
            lbl = str(b.get('card') or f'Mục {i + 1}')[:18]
            bars.append({'t': tb, 'label': lbl, 'value': (i + 1) * 25, 'unit': '%', 'sticker': guess_sticker(lbl + ' ' + str(b.get('visual', ''))) or 'money_bag'})
        return {'layout': 'chart', 't0': t0, 't1': t1, 'title': title, 'bars': bars, 'summary': {'t': round(max(t0 + 2.0, t1 - 2.5), 2), 'text': 'TỔNG KẾT'}}

    if layout == 'corkboard':
        pins, links = [], []
        coords = [(0.24, 0.28), (0.74, 0.28), (0.30, 0.74), (0.76, 0.74)]
        for i, b in enumerate((cards or beats[:4])[:4]):
            bid = b.get('id')
            tb = round(lines_map[bid]['t0'], 2) if bid in lines_map else round(t0 + i * 0.7, 2)
            lbl = str(b.get('card') or b.get('text') or f'Clue {i + 1}')[:22]
            pid = f'p{i + 1}'
            pins.append({
                'id': pid, 't': tb, 'x': coords[i][0], 'y': coords[i][1],
                'title': lbl, 'sticker': guess_sticker(lbl + ' ' + str(b.get('visual', ''))) or 'scam_phone',
                'highlight': i == len((cards or beats[:4])[:4]) - 1,
            })
            if i > 0:
                links.append({'from': f'p{i}', 'to': pid, 't': round(tb + 0.12, 2)})
        return {'layout': 'corkboard', 't0': t0, 't1': t1, 'title': title, 'pins': pins, 'links': links}

    if layout == 'tactics':
        return {
            'layout': 'tactics', 't0': t0, 't1': t1, 'title': title,
            'players': [
                {'id': 'lm', 'num': 10, 'name': 'MESSI', 'team': 'B', 'x': 0.34, 'y': 0.56, 't': t0},
                {'id': 'cr', 'num': 7, 'name': 'RONALDO', 'team': 'A', 'x': 0.72, 'y': 0.34, 't': round(t0 + 0.3, 2)},
                {'id': 'fw', 'num': 9, 'name': 'STRIKER', 'team': 'B', 'x': 0.74, 'y': 0.62, 't': round(t0 + 0.5, 2)},
            ],
            'passes': [{'from': 'lm', 'to': 'fw', 't': round(t0 + 0.9, 2), 'curve': -45, 'ball': True}],
            'zones': [{'x': 0.76, 'y': 0.5, 'r': 0.18, 't': round(t0 + 1.2, 2), 'label': 'BOX'}],
            'badge': {'t': round(max(t0 + 1.6, t1 - 2.5), 2), 'text': 'BIG FINAL RECEIPT'},
        }
    return None


def generate_episode_js(beats_path, out_path, layout='standard', kind='standard'):
    B = json.load(open(beats_path, encoding='utf-8'))
    ep_id = B.get('id') or os.path.basename(beats_path).replace('.beats.json', '')
    pack = detect_pack(B, ep_id)
    times_path = os.path.join(os.path.dirname(os.path.abspath(beats_path)), f'{ep_id}.times.js')
    T = load_times_js(times_path)
    has_times_file = T is not None
    if not has_times_file:
        T = estimate_times(B)

    use_diagram = layout != 'standard'
    shots = build_shots(B, T, pack, use_diagram)
    lines_map = T['lines']
    spoken = [b for b in B.get('beats', []) if b.get('text') and b.get('id') in lines_map]

    # Build lookMap (emo per spoken beat)
    look_entries = []
    for b in spoken:
        emo = map_emo(b['who'], b.get('mood'))
        look_entries.append(f"  {json.dumps(b['id'])}: {{ emo: {json.dumps(emo)} }},")

    # Build acts (initial pose + expressive nods/glances on board beats)
    cast_init = [('ron', 'neutral'), ('leo', 'neutral')] if pack == 'goat' else [('teo', 'neutral'), ('bip', 'neutral')]
    act_lines = [f"  .init({json.dumps(w)}, {{ emo: {json.dumps(e)} }})" for w, e in cast_init]
    for i, b in enumerate(spoken):
        who = b['who']
        emo = map_emo(who, b.get('mood'))
        extra = ['look: "up"'] if (use_diagram and (b.get('card') or i >= 2)) else []
        if b.get('mood') in ('shock', 'anger', 'smug'):
            extra.append('nod: "yes"')
        opts_str = ', '.join([f'emo: {json.dumps(emo)}'] + extra)
        act_lines.append(f"  .atStart({json.dumps(b['id'])}, {json.dumps(who)}, {{ {opts_str} }})")

    # Build shot chain
    shot_lines = []
    for s in shots:
        opts = []
        if s.get('move'):
            opts.append(f"move: {json.dumps(s['move'])}")
        if s.get('rig') == '__RIG__':
            cam = s['cam']
            rk = 'RIG.two' if cam.startswith('two') else ('RIG.cu' if cam.startswith('cu_') or cam.startswith('ecu_') else 'RIG.ms')
            opts.append(f'rig: {rk}')
        opt_str = f", {{ {', '.join(opts)} }}" if opts else ''
        shot_lines.append(f"  .cut({s['t1']}, {json.dumps(s['cam'])}{opt_str})")

    # Build overlays
    overlay_blocks = []
    if pack == 'trada':
        hook_txt = B.get('hook') or (B.get('title') or ep_id).upper()[:24]
        overlay_blocks.append(f"  v2Hook({json.dumps(hook_txt, ensure_ascii=False)}),")
    if use_diagram:
        spec = build_board_stub(B, T, layout, pack)
        overlay_blocks.append('  boardOverlay(' + json.dumps(spec, ensure_ascii=False, indent=2).replace('\n', '\n  ') + '),')
    elif pack == 'goat':
        # Auto-emit goatStatCard stubs for card beats (or quickie highlight)
        card_beats = [b for b in B.get('beats', []) if b.get('card') and b.get('id') in lines_map][:3]
        for idx, b in enumerate(card_beats):
            row = lines_map[b['id']]
            t0 = round(row['t0'], 2)
            t1 = round(min(float(T['dur']) - 0.3, max(row['t1'] + 0.6, t0 + 2.2)), 2)
            sc = {
                't0': t0, 't1': t1, 'team': 'leo' if idx % 2 else 'ron',
                'title': 'STAT RECEIPT', 'big': str(b['card'])[:22],
                'sticker': guess_sticker(str(b['card']) + ' ' + str(b.get('visual', ''))) or ('world_cup' if idx % 2 else 'ucl_trophy'),
            }
            overlay_blocks.append('  goatStatCard(' + json.dumps(sc, ensure_ascii=False) + '),')

    # Check whether lipsFile should be active immediately
    lips_exists = os.path.exists(os.path.join(ROOT, 'episodes', f'{ep_id}_lips.json'))
    stems_exist = bool(glob.glob(os.path.join(ROOT, 'out', ep_id, 'audio', 'vo_*.wav')))
    lips_line = f"  lipsFile: './{ep_id}_lips.json'," if (lips_exists or stems_exist) else f"  // lipsFile: './{ep_id}_lips.json', // auto-generated by build_check.py once voice stems exist"

    # Relative import prefix based on out_path location
    out_dir = os.path.dirname(os.path.abspath(out_path))
    rel_core = os.path.relpath(os.path.join(ROOT, 'core', 'ep_kit.js'), out_dir).replace(os.sep, '/')
    if not rel_core.startswith('.'):
        rel_core = './' + rel_core
    rel_beats = os.path.relpath(os.path.abspath(beats_path), out_dir).replace(os.sep, '/')
    if not rel_beats.startswith('.'):
        rel_beats = './' + rel_beats
    rel_times = os.path.relpath(times_path, out_dir).replace(os.sep, '/')
    if not rel_times.startswith('.'):
        rel_times = './' + rel_times

    kit_imports = ['makeKit']
    if pack == 'goat':
        kit_imports += ['goatDefaults', 'goatStatCard']
    else:
        kit_imports += ['v2Defaults', 'v2Hook']
    if use_diagram:
        kit_imports += ['diagramRig', 'boardOverlay']

    times_block = (
        f"import T from {json.dumps(rel_times)};"
        if has_times_file
        else f"const T = {json.dumps(T, ensure_ascii=False)}; // estimated fallback (run voice.py build to write {ep_id}.times.js)"
    )

    defaults_fn = 'goatDefaults' if pack == 'goat' else 'v2Defaults'
    mode_field = f"  mode: {json.dumps(B['mode'])},\n" if B.get('mode') and pack == 'trada' else ''
    rig_decl = "\nconst RIG = diagramRig();\n" if use_diagram else "\n"

    code = f"""// Auto-scaffolded by tools/scaffold_ep.py (Gemini Studio v3.0 — 0 tokens).
// Channel: {pack} | Layout: {layout} | Kind: {kind}
// Refine acting, sticker swaps, and camera punch-ins as needed; keep declarative overlays compact!
{times_block}
import B from {json.dumps(rel_beats)} with {{ type: 'json' }};
import {{ {', '.join(kit_imports)} }} from {json.dumps(rel_core)};

const K = makeKit(T, B);{rig_decl}
const lookMap = {{
{chr(10).join(look_entries)}
}};

const shots = K.shots()
{chr(10).join(shot_lines)}
  .list();

const acts = K.acts()
{chr(10).join(act_lines)}
  .list();

const overlays = [
{chr(10).join(overlay_blocks)}
];

export default {defaults_fn}({{
  id: {json.dumps(ep_id)},
{mode_field}  dur: K.dur,
{lips_line}
  shots,
  lines: K.lines(lookMap),
  acts,
  overlays,
}});
"""
    os.makedirs(out_dir, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(code)
    return {
        'id': ep_id, 'pack': pack, 'layout': layout, 'kind': kind,
        'out': out_path, 'shots': len(shots), 'lines': len(spoken),
        'dur': T['dur'], 'has_times': has_times_file,
    }


def main():
    p = argparse.ArgumentParser(description='cine3d 0-token Episode Scaffolder (Gemini Studio v3.0)')
    p.add_argument('beats', help='Path to episodes/<id>.beats.json')
    p.add_argument('--out', default=None, help='Output .js path (default: episodes/<id>.js)')
    p.add_argument('--layout', choices=['standard', 'flow', 'compare', 'chart', 'corkboard', 'tactics'], default='standard')
    p.add_argument('--kind', choices=['standard', 'quickie', 'fullbeef'], default='standard')
    p.add_argument('--force', action='store_true', help='Overwrite existing output .js file')
    a = p.parse_args()

    beats_path = os.path.abspath(a.beats)
    if not os.path.exists(beats_path):
        print(f'SCAFFOLD FAIL  missing {a.beats}', file=sys.stderr)
        sys.exit(2)
    B = json.load(open(beats_path, encoding='utf-8'))
    ep_id = B.get('id') or os.path.basename(beats_path).replace('.beats.json', '')
    out_path = os.path.abspath(a.out) if a.out else os.path.join(ROOT, 'episodes', f'{ep_id}.js')
    if os.path.exists(out_path) and not a.force:
        print(f'SCAFFOLD SKIP  {os.path.relpath(out_path, ROOT)} already exists (pass --force to overwrite)')
        sys.exit(0)
    res = generate_episode_js(beats_path, out_path, layout=a.layout, kind=a.kind)
    rel_out = os.path.relpath(out_path, ROOT)
    print(
        f"SCAFFOLD OK  {rel_out}  (pack={res['pack']}, layout={res['layout']}, "
        f"{res['shots']} shots, {res['lines']} lines, {res['dur']}s, times={'file' if res['has_times'] else 'estimated'})"
    )


if __name__ == '__main__':
    main()
