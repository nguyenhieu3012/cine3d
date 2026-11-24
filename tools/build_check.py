#!/usr/bin/env python3
"""cine3d unified build & check CLI for Gemini Studio (<= 25 lines compact stdout + full JSON on disk).
Modes:
  python3 tools/build_check.py episodes/<id>.js [--rules 1|2] [--beats path] [--skip-lips] [--skip-clip]
      Auto-cuts lips if voice stems exist & stale, runs qa.cjs + clipcheck.cjs, prints <= 25-line report.
  python3 tools/build_check.py episodes/<id>.js --final [--audio-file path] [--fps 30] [--crf 17] [--proxy-fps 24] [--cover-t T --cover-top "..." --cover-plate "..."] [--force-render]
      Checks picture -> renders clean 30fps CRF17 MP4 -> smooth.py -> review_proxy.mp4 (540p, 24fps, ~2-4MB) -> optional cover.
  python3 tools/build_check.py episodes/<id>.js --proxy-only [--mp4 path] [--audio-file path] [--proxy-fps 24]
      Makes out/<id>/review_proxy.mp4 directly (fast transcode if final MP4 is fresh, else fast preview render).
  python3 tools/build_check.py episodes/<id>.beats.json --audio [--rules 1|2] [--skip-build]
      Runs voice.py build + audiogate.py + scriptlint.py --strict + encodes mix_preview.mp3 + flags SYNTH_FALLBACK.
  python3 tools/build_check.py episodes/<id>.js --spot 0.5,4.2,12.0
      Renders targeted 1080p stills at specific timestamps into out/<id>/spot/t*.png.
Python 3.9+ stdlib only."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.expanduser(os.environ.get('CINE3D_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
HOME = os.path.expanduser('~')


def rel(p):
    try:
        r = os.path.relpath(os.path.abspath(p), ROOT)
        return r if not r.startswith('..') else p
    except Exception:
        return p


def py_venv():
    import shutil
    cands = [
        os.path.join(HOME, 'tdvai', '.venv', 'bin', 'python'),
        sys.executable,
        shutil.which('python3'),
        '/usr/bin/python3',
        '/opt/homebrew/bin/python3',
    ]
    seen = set()
    for c in cands:
        if not c or c in seen or not os.path.exists(c):
            continue
        seen.add(c)
        try:
            r = subprocess.run([c, '-c', 'import numpy'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
            if r.returncode == 0:
                return c
        except Exception:
            pass
    return sys.executable or 'python3'


def run_cmd(cmd, timeout=600):
    t0 = time.time()
    try:
        p = subprocess.run(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors='replace', timeout=timeout)
        return p.returncode, p.stdout, round(time.time() - t0, 1)
    except subprocess.TimeoutExpired as ex:
        out = (ex.stdout or '') if isinstance(ex.stdout, str) else ''
        return 124, out + f'\nTIMEOUT after {timeout}s', round(time.time() - t0, 1)


def ep_id_of(path):
    base = os.path.basename(path)
    if base.endswith('.beats.json'):
        return base[:-11]
    if base.endswith('.js'):
        return base[:-3]
    return os.path.splitext(base)[0]


def detect_rules(ep_id, beats_path, cli_rules):
    if cli_rules:
        return str(cli_rules)
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    try:
        import rules2
        B = json.load(open(beats_path, encoding='utf-8')) if beats_path and os.path.exists(beats_path) else None
        st = rules2.read_state(ep_id)
        return str(rules2.rules_version(B, st, None))
    except Exception:
        return '1'


def first_err_line(out):
    lines = [l.strip() for l in (out or '').splitlines() if l.strip()]
    for l in lines:
        if re.search(r'(?:Error:|TypeError:|SyntaxError:|ReferenceError:|ENOENT|Cannot find module|ERR_)', l):
            return l[:160]
    return (lines[-1] if lines else 'unknown error')[:160]


def parse_rate(val):
    if val and '/' in str(val):
        a, b = str(val).split('/', 1)
        return round(float(a) / float(b), 2) if float(b) else 0.0
    return None


def probe_media(path):
    if not os.path.exists(path):
        return None
    rc, out, _ = run_cmd(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,sample_rate', '-of', 'json', path], timeout=30)
    if rc != 0:
        return None
    try:
        d = json.loads(out)
        fmt = d.get('format', {})
        vs = next((s for s in d.get('streams', []) if s.get('codec_type') == 'video'), None)
        aus = next((s for s in d.get('streams', []) if s.get('codec_type') == 'audio'), None)
        fps = parse_rate(vs.get('avg_frame_rate')) if vs else None
        r_fps = parse_rate(vs.get('r_frame_rate')) if vs else None
        return {
            'path': rel(path),
            'size_mb': round(int(fmt.get('size', 0)) / (1024 * 1024), 2),
            'dur_s': round(float(fmt.get('duration', 0)), 2),
            'kbps': round(int(fmt.get('bit_rate', 0)) / 1000) if fmt.get('bit_rate') else None,
            'w': vs.get('width') if vs else None,
            'h': vs.get('height') if vs else None,
            'fps': fps,
            'r_fps': r_fps,
            'audio': f"{aus.get('codec_name')}@{aus.get('sample_rate')}Hz" if aus else 'none',
        }
    except Exception:
        return None


def make_proxy(src_mp4, dst_proxy, proxy_fps=24, proxy_crf=25):
    info = probe_media(src_mp4)
    w, h = (info['w'], info['h']) if info and info.get('w') and info.get('h') else (1080, 1920)
    scale = 'scale=960:540' if w > h else 'scale=540:960'
    has_audio = info and info.get('audio') != 'none'
    cmd = [
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src_mp4,
        '-vf', f'{scale},fps={proxy_fps},format=yuv420p',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', str(proxy_crf),
        '-movflags', '+faststart',
    ]
    if has_audio:
        cmd += ['-c:a', 'aac', '-b:a', '96k', '-ar', '48000']
    else:
        cmd += ['-an']
    cmd.append(dst_proxy)
    return run_cmd(cmd, timeout=180)


def auto_lips(ep_path, ep_id, skip_lips=False):
    if skip_lips:
        return None
    audio_dir = os.path.join(ROOT, 'out', ep_id, 'audio')
    stems = sorted(p for p in glob.glob(os.path.join(audio_dir, 'vo_*.wav')) if os.path.basename(p) != 'vo_all.wav')
    if not stems:
        return None
    lips_out = os.path.join(ROOT, 'episodes', f'{ep_id}_lips.json')
    try:
        ep_txt = open(ep_path, encoding='utf-8').read()
    except Exception:
        ep_txt = ''
    if 'lipsFile' not in ep_txt and not os.path.exists(lips_out):
        return None
    newest_src = max([os.path.getmtime(ep_path)] + [os.path.getmtime(s) for s in stems])
    if os.path.exists(lips_out) and os.path.getmtime(lips_out) >= newest_src:
        return 'fresh'
    cmd = ['node', 'tools/lips.cjs', rel(ep_path)]
    for st in stems:
        who = os.path.basename(st)[3:-4]
        cmd += ['--stem', f'{who}={st}']
    cmd += ['--out', rel(lips_out)]
    rc, out, dt = run_cmd(cmd, timeout=120)
    return f'rebuilt ({out.strip()}, {dt}s)' if rc == 0 else f'ERROR (rc={rc}): {out.strip()[:120]}'


def _sha_file(path):
    if not path or not os.path.exists(path):
        return None
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def pic_input_sig(ep_path, beats_path, ep_id, rules, skip_clip=False):
    lips_p = os.path.join(ROOT, 'episodes', f'{ep_id}_lips.json')
    raw = json.dumps({
        'ep': _sha_file(ep_path),
        'beats': _sha_file(beats_path),
        'lips': _sha_file(lips_p),
        'rules': int(rules),
        'skip_clip': bool(skip_clip),
    }, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def run_picture_checks(ep_path, ep_id, beats_path, rules, skip_lips=False, skip_clip=False):
    out_dir = os.path.join(ROOT, 'out', ep_id)
    os.makedirs(out_dir, exist_ok=True)
    lips_msg = auto_lips(ep_path, ep_id, skip_lips=skip_lips)
    qa_json = os.path.join(out_dir, 'qa.json')
    clip_json = os.path.join(out_dir, 'clip.json')

    qa_cmd = ['node', 'tools/qa.cjs', rel(ep_path), '--json', rel(qa_json)]
    if beats_path and os.path.exists(beats_path):
        qa_cmd += ['--beats', rel(beats_path)]
    if str(rules) == '2':
        qa_cmd += ['--rules', '2']
    clip_cmd = ['node', 'tools/clipcheck.cjs', rel(ep_path), '--stills', '3', '--json', rel(clip_json)]

    if skip_clip:
        qa_rc, qa_out, qa_dt = run_cmd(qa_cmd, timeout=300)
        clip_rc, clip_out, clip_dt = 0, '', 0.0
    else:
        # Run qa.cjs and clipcheck.cjs in parallel (independent Chromium instances, ~25-30% faster)
        with ThreadPoolExecutor(max_workers=2) as pool:
            f_qa = pool.submit(run_cmd, qa_cmd, 300)
            f_cl = pool.submit(run_cmd, clip_cmd, 300)
            qa_rc, qa_out, qa_dt = f_qa.result()
            clip_rc, clip_out, clip_dt = f_cl.result()

    qa_data = json.load(open(qa_json, encoding='utf-8')) if os.path.exists(qa_json) else {'pass': False, 'fails': [f'qa crashed rc={qa_rc}: {first_err_line(qa_out)}'], 'counts': {}, 'waived': [], 'warns': []}

    clip_data = None
    if not skip_clip:
        if os.path.exists(clip_json):
            clip_data = json.load(open(clip_json, encoding='utf-8'))
        else:
            clip_data = {'pass': clip_rc == 0, 'fails': [] if clip_rc == 0 else [f'clipcheck rc={clip_rc}: {first_err_line(clip_out)}'], 'counts': {}, 'waived': []}

    qa_fails = qa_data.get('fails', [])
    clip_fails = []
    clip_counts = {}
    if clip_data:
        raw_cf = clip_data.get('fails') or clip_data.get('findings') or []
        if isinstance(raw_cf, list):
            for x in raw_cf:
                if isinstance(x, str):
                    clip_fails.append(x)
                elif isinstance(x, dict):
                    k = x.get('k') or x.get('check') or 'clip'
                    t0 = x.get('t0', x.get('t'))
                    msg = x.get('m') or x.get('msg') or json.dumps(x, ensure_ascii=False)
                    clip_fails.append(f'{k}: {msg}' + (f' [@{t0:.2f}s]' if isinstance(t0, (int, float)) else ''))
        clip_counts = clip_data.get('counts') or clip_data.get('by') or {}

    ok = bool(qa_data.get('pass')) and (True if skip_clip else bool(clip_data.get('pass', len(clip_fails) == 0)))
    summary = {
        'id': ep_id, 'ep': rel(ep_path), 'rules': int(rules), 'pass': ok,
        'input_sig': pic_input_sig(ep_path, beats_path, ep_id, rules, skip_clip=skip_clip),
        'lips': lips_msg, 'qa_s': qa_dt, 'clip_s': clip_dt,
        'qa_fail_count': len(qa_fails), 'qa_counts': qa_data.get('counts', {}), 'qa_fails': qa_fails,
        'qa_waived': len(qa_data.get('waived', [])), 'qa_warns': len(qa_data.get('warns', [])),
        'clip_fail_count': len(clip_fails), 'clip_counts': clip_counts, 'clip_fails': clip_fails,
    }
    json.dump(summary, open(os.path.join(out_dir, 'build_check.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return summary


def print_picture_report(s, max_lines=22):
    status = 'BUILD_CHECK PASS' if s['pass'] else 'BUILD_CHECK FAIL'
    lines = [
        f"{status}  {s['ep']}  (rules {s['rules']}, qa {s['qa_s']}s, clip {s['clip_s']}s)" + (f"  lips: {s['lips']}" if s.get('lips') else ''),
        f"  qa: {s['qa_fail_count']} fail(s), {s['qa_waived']} waived, {s['qa_warns']} warn(s)" + (f"  [{', '.join(f'{k}:{v}' for k, v in s['qa_counts'].items())}]" if s['qa_counts'] else ''),
        f"  clip: {s['clip_fail_count']} fail(s)" + (f"  [{', '.join(f'{k}:{v}' for k, v in s['clip_counts'].items())}]" if s['clip_counts'] else ''),
    ]
    all_fails = [('QA', f) for f in s['qa_fails']] + [('CLIP', f) for f in s['clip_fails']]
    cap = max_lines - len(lines) - 1
    for tag, msg in all_fails[:cap]:
        lines.append(f'  [{tag}] {msg[:155]}')
    if len(all_fails) > cap:
        lines.append(f'  ... +{len(all_fails) - cap} more (full JSON: out/{s["id"]}/build_check.json)')
    print('\n'.join(lines[:max_lines]))


def mode_audio(a):
    beats_path = os.path.abspath(a.target)
    if not os.path.exists(beats_path):
        print(f'AUDIO_CHECK FAIL  missing {a.target}'); sys.exit(2)
    ep_id = ep_id_of(beats_path)
    rules = detect_rules(ep_id, beats_path, a.rules)
    py = py_venv()
    out_dir = os.path.join(ROOT, 'out', ep_id)
    audio_dir = os.path.join(out_dir, 'audio')
    os.makedirs(audio_dir, exist_ok=True)
    lines = []
    ok = True
    report = {'id': ep_id, 'beats': rel(beats_path), 'rules': int(rules)}

    if not a.skip_build:
        rc, out, dt = run_cmd([py, 'tools/voice.py', 'build', rel(beats_path)], timeout=300)
        report['voice_build'] = {'rc': rc, 's': dt, 'tail': out.strip().splitlines()[-4:]}
        if rc != 0:
            ok = False
            lines.append(f'  [VOICE] FAIL (rc={rc}, {dt}s): ' + ' | '.join(out.strip().splitlines()[-3:]))
        else:
            lines.append(f'  [VOICE] OK ({dt}s): ' + (out.strip().splitlines()[-1][:110] if out.strip() else 'built'))

    rc_ag, out_ag, dt_ag = run_cmd([py, 'tools/audiogate.py', rel(beats_path)], timeout=180)
    ag_pass = rc_ag == 0 and bool(re.search(r'^AUDIO PASS', out_ag, re.M))
    if not ag_pass:
        ok = False
    ag_head = next((l.strip() for l in out_ag.splitlines() if re.match(r'^AUDIO (PASS|FAIL)', l)), f'rc={rc_ag}')
    ag_fails = [l.strip() for l in out_ag.splitlines() if re.match(r'^\s+FAIL\b', l)][:4]
    report['audiogate'] = {'pass': ag_pass, 's': dt_ag, 'head': ag_head, 'fails': ag_fails}
    lines.append(f'  [GATE] {ag_head[:125]} ({dt_ag}s)')
    for fl in ag_fails:
        lines.append(f'    {fl[:145]}')

    sl_cmd = [sys.executable or 'python3', 'tools/scriptlint.py', rel(beats_path), '--strict'] + (['--rules', '2'] if rules == '2' else [])
    rc_sl, out_sl, dt_sl = run_cmd(sl_cmd, timeout=60)
    sl_pass = rc_sl == 0 and bool(re.search(r'^LINT PASS', out_sl, re.M))
    if not sl_pass:
        ok = False
    sl_head = next((l.strip() for l in out_sl.splitlines() if re.match(r'^LINT (PASS|FAIL)', l)), f'rc={rc_sl}')
    sl_fails = [l.strip() for l in out_sl.splitlines() if re.match(r'^\s+FAIL\b', l)][:4]
    report['scriptlint'] = {'pass': sl_pass, 's': dt_sl, 'head': sl_head, 'fails': sl_fails}
    lines.append(f'  [LINT] {sl_head[:125]} ({dt_sl}s)')
    for fl in sl_fails:
        lines.append(f'    {fl[:145]}')

    # Check synth fallbacks from sfx_placed.json (voice.py writes key `name`; keep `sfx` fallback for compat)
    sfx_p = os.path.join(audio_dir, 'sfx_placed.json')
    synth_names = []
    total_sfx = 0
    real_sfx = 0
    synth_sfx = 0
    if os.path.exists(sfx_p):
        try:
            fx_list = json.load(open(sfx_p, encoding='utf-8'))
            total_sfx = len(fx_list)
            real_sfx = sum(1 for x in fx_list if x.get('lib') == 'real')
            synth_sfx = total_sfx - real_sfx
            synth_names = sorted({(x.get('name') or x.get('sfx')) for x in fx_list if x.get('lib') == 'synth' and (x.get('name') or x.get('sfx'))})
        except Exception:
            pass
    report['sfx_total'] = total_sfx
    report['sfx_real'] = real_sfx
    report['sfx_synth'] = synth_sfx
    report['synth_fallbacks'] = synth_names
    if synth_names:
        lines.append(f'  [SFX] WARN SYNTH_FALLBACK ({real_sfx} real / {synth_sfx} synth, {len(synth_names)} name(s)): {", ".join(synth_names)}')
    else:
        lines.append(f'  [SFX] OK ({real_sfx}/{total_sfx} real, 0 synth fallback)')

    # Encode compact listening preview for Gemini multimodal read_file (only if mix is fresh/valid)
    mix_wav = os.path.join(audio_dir, 'mix.wav')
    preview_path = os.path.join(audio_dir, 'mix_preview.mp3')
    voice_built_ok = a.skip_build or (report.get('voice_build', {}).get('rc') == 0)
    if voice_built_ok and os.path.exists(mix_wav):
        rc_mp3, _, _ = run_cmd(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', mix_wav, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', '48000', preview_path], timeout=60)
        if rc_mp3 != 0:
            preview_path = os.path.join(audio_dir, 'mix_preview.m4a')
            run_cmd(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', mix_wav, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', '-ar', '48000', preview_path], timeout=60)
        if os.path.exists(preview_path):
            kb = round(os.path.getsize(preview_path) / 1024, 1)
            report['mix_preview'] = rel(preview_path)
            lines.append(f'  [LISTEN] {rel(preview_path)} ({kb} KB) -> read_file to verify voice/SFX/music')

    report['pass'] = ok
    json.dump(report, open(os.path.join(out_dir, 'audio_check.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    header = f"AUDIO_CHECK {'PASS' if ok else 'FAIL'}  {rel(beats_path)}  (rules {rules})"
    print('\n'.join([header] + lines[:23]))
    sys.exit(0 if ok else 1)


def mode_spot(a):
    ep_path = os.path.abspath(a.target)
    ep_id = ep_id_of(ep_path)
    out_dir = os.path.join(ROOT, 'out', ep_id, 'spot')
    os.makedirs(out_dir, exist_ok=True)
    rc, out, dt = run_cmd(['node', 'tools/render.cjs', 'stills', rel(ep_path), rel(out_dir), a.spot], timeout=180)
    files = [l.strip() for l in out.splitlines() if l.strip().endswith('.png')]
    print(f"SPOT {'OK' if rc == 0 else 'FAIL'}  {rel(ep_path)}  ({len(files)} still(s), {dt}s)")
    for f in files[:20]:
        print('  ' + rel(f))
    sys.exit(0 if rc == 0 else 1)


def mode_proxy_only(a):
    ep_path = os.path.abspath(a.target)
    ep_id = ep_id_of(ep_path)
    out_dir = os.path.join(ROOT, 'out', ep_id)
    os.makedirs(out_dir, exist_ok=True)
    proxy = os.path.join(out_dir, 'review_proxy.mp4')
    src_mp4 = os.path.abspath(a.mp4) if a.mp4 else os.path.join(out_dir, f'{ep_id}.mp4')
    audio = os.path.abspath(a.audio) if a.audio else os.path.join(out_dir, 'audio', 'mix.wav')
    use_audio = audio if os.path.exists(audio) else None

    if os.path.exists(src_mp4) and os.path.getmtime(src_mp4) >= os.path.getmtime(ep_path):
        rc, out, dt = make_proxy(src_mp4, proxy, proxy_fps=a.proxy_fps)
        src_note = f'transcoded from {rel(src_mp4)}'
    else:
        tmp_mp4 = os.path.join(out_dir, '_proxy_raw.mp4')
        cmd = ['node', 'tools/render.cjs', 'mp4', rel(ep_path), rel(tmp_mp4), '--fps', str(a.proxy_fps), '--preset', 'veryfast', '--crf', '24']
        if use_audio:
            cmd += ['--audio', rel(use_audio)]
        rc1, out1, dt1 = run_cmd(cmd, timeout=600)
        if rc1 != 0:
            print(f'PROXY FAIL  render failed (rc={rc1}): {out1.strip()[-180:]}')
            sys.exit(1)
        rc, out, dt2 = make_proxy(tmp_mp4, proxy, proxy_fps=a.proxy_fps)
        dt = round(dt1 + dt2, 1)
        try:
            os.remove(tmp_mp4)
        except OSError:
            pass
        src_note = f'rendered fresh ({dt1}s + scale {dt2}s)'

    if rc != 0:
        print(f'PROXY FAIL  ffmpeg rc={rc}: {out.strip()[-180:]}')
        sys.exit(1)
    pi = probe_media(proxy)
    print(f"PROXY PASS  {rel(proxy)}  ({pi['w']}x{pi['h']}, {pi['fps']}fps, {pi['dur_s']}s, {pi['size_mb']} MB, audio={pi['audio']}, {src_note}, {dt}s)")
    sys.exit(0)


def mode_final(a):
    ep_path = os.path.abspath(a.target)
    ep_id = ep_id_of(ep_path)
    beats_path = os.path.abspath(a.beats) if a.beats else os.path.join(ROOT, 'episodes', f'{ep_id}.beats.json')
    rules = detect_rules(ep_id, beats_path, a.rules)
    out_dir = os.path.join(ROOT, 'out', ep_id)
    os.makedirs(out_dir, exist_ok=True)

    pic = None
    reused_pic = False
    if a.reuse_check:
        bc_p = os.path.join(out_dir, 'build_check.json')
        if os.path.exists(bc_p):
            try:
                prev = json.load(open(bc_p, encoding='utf-8'))
                cand = prev.get('picture') if isinstance(prev.get('picture'), dict) else prev
                cur_sig = pic_input_sig(ep_path, beats_path, ep_id, rules, skip_clip=a.skip_clip)
                if cand and cand.get('pass') and cand.get('input_sig') == cur_sig:
                    pic = cand
                    reused_pic = True
            except Exception:
                pass
    if pic is None:
        pic = run_picture_checks(ep_path, ep_id, beats_path, rules, skip_lips=a.skip_lips, skip_clip=a.skip_clip)
    if not pic['pass'] and not a.force_render:
        print_picture_report(pic, max_lines=22)
        print('  STOP: fix QA/clip fails before --final render (or pass --force-render to inspect anyway)')
        sys.exit(1)

    mp4 = os.path.join(out_dir, f'{ep_id}.mp4')
    proxy = os.path.join(out_dir, 'review_proxy.mp4')
    audio = os.path.abspath(a.audio) if a.audio else os.path.join(out_dir, 'audio', 'mix.wav')
    use_audio = audio if os.path.exists(audio) else None
    is_demo = rel(ep_path).startswith('demo/') or rel(ep_path).startswith('demo' + os.sep)
    if not use_audio and not is_demo and not a.allow_silent:
        print(f'FINAL FAIL  missing audio mix {rel(audio)} for {rel(ep_path)} (run `--audio` first, or pass `--allow-silent` for silent preview)')
        sys.exit(1)

    rc_r, out_r, dt_r = run_cmd(
        ['node', 'tools/render.cjs', 'mp4', rel(ep_path), rel(mp4), '--fps', str(a.fps), '--crf', str(a.crf)] + (['--audio', rel(use_audio)] if use_audio else []),
        timeout=900,
    )
    if rc_r != 0 or not os.path.exists(mp4):
        print(f'FINAL FAIL  render.cjs rc={rc_r} ({dt_r}s): {first_err_line(out_r)}')
        sys.exit(1)

    py = py_venv()
    want_cover = a.cover_t is not None and a.cover_top and a.cover_plate
    # Post-render tasks (smooth.py, review_proxy.mp4, cover.cjs) are independent -> run in parallel
    with ThreadPoolExecutor(max_workers=3) as pool:
        f_sm = pool.submit(run_cmd, [py, 'tools/smooth.py', rel(mp4), '--ep', rel(ep_path)], 180)
        f_px = pool.submit(make_proxy, mp4, proxy, a.proxy_fps)
        f_cv = pool.submit(run_cmd, ['node', 'tools/cover.cjs', rel(ep_path), str(a.cover_t), a.cover_top, a.cover_plate, rel(os.path.join(out_dir, ep_id))], 120) if want_cover else None
        rc_s, out_s, dt_s = f_sm.result()
        rc_p, out_p, dt_p = f_px.result()
        if f_cv:
            rc_c, out_c, dt_c = f_cv.result()

    smooth_ok = rc_s == 0 and bool(re.search(r'^SMOOTH (PASS|OK)', out_s, re.M))
    smooth_line = next((l.strip() for l in out_s.splitlines() if re.match(r'^SMOOTH ', l)), f'rc={rc_s}')
    proxy_ok = rc_p == 0 and os.path.exists(proxy)

    cover_msg = None
    cover_ok = True
    if want_cover:
        cover_ok = rc_c == 0
        cover_msg = f'OK ({dt_c}s): {out_c.strip()[:100]}' if cover_ok else f'FAIL rc={rc_c}: {first_err_line(out_c)}'

    fi = probe_media(mp4) or {}
    pi = probe_media(proxy) or {}
    spec_fails = []
    if (fi.get('w'), fi.get('h')) not in ((1080, 1920), (1920, 1080)):
        spec_fails.append(f"bad dimensions {fi.get('w')}x{fi.get('h')} (expect 1080x1920 or 1920x1080)")
    if fi.get('fps') is None or abs(fi['fps'] - a.fps) > 0.1 or (fi.get('r_fps') is not None and abs(fi['r_fps'] - a.fps) > 0.1):
        spec_fails.append(f"not {a.fps}fps CFR (avg={fi.get('fps')}, r={fi.get('r_fps')})")
    if not fi.get('dur_s') or fi['dur_s'] < 0.5:
        spec_fails.append(f"invalid duration {fi.get('dur_s')}s")
    if use_audio and fi.get('audio') != 'aac@48000Hz':
        spec_fails.append(f"expected audio aac@48000Hz, got {fi.get('audio')}")
    if not is_demo and not a.allow_silent and fi.get('audio') == 'none':
        spec_fails.append('final MP4 has no audio track')

    all_ok = pic['pass'] and smooth_ok and proxy_ok and cover_ok and not spec_fails
    final_report = {
        'id': ep_id, 'pass': all_ok, 'picture': pic,
        'render_s': dt_r, 'smooth_ok': smooth_ok, 'smooth_line': smooth_line,
        'spec_fails': spec_fails, 'final_mp4': fi, 'review_proxy': pi, 'cover': cover_msg, 'cover_ok': cover_ok,
    }
    json.dump(final_report, open(os.path.join(out_dir, 'build_check.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    lines = [
        f"FINAL {'PASS' if all_ok else 'FAIL'}  {rel(ep_path)}  (rules {rules})",
        f"  [QA/CLIP] {'PASS' if pic['pass'] else 'FAIL'} (qa_fail={pic['qa_fail_count']}, clip_fail={pic['clip_fail_count']}, warns={pic['qa_warns']}" + (", reused" if reused_pic else "") + ")",
        f"  [RENDER]  {fi.get('path')}  {fi.get('w')}x{fi.get('h')} {fi.get('fps')}fps {fi.get('dur_s')}s {fi.get('size_mb')} MB {fi.get('kbps')} kbps audio={fi.get('audio')} ({dt_r}s)",
        f"  [SMOOTH]  {smooth_line[:135]} ({dt_s}s)",
        f"  [PROXY]   {pi.get('path')}  {pi.get('w')}x{pi.get('h')} {pi.get('fps')}fps {pi.get('size_mb')} MB audio={pi.get('audio')} ({dt_p}s)" if proxy_ok else f"  [PROXY]   FAIL rc={rc_p}: {out_p.strip()[-100:]}",
    ]
    if spec_fails:
        lines.append(f"  [SPEC]    FAIL: {'; '.join(spec_fails)[:140]}")
    if cover_msg:
        lines.append(f'  [COVER]   {cover_msg}')
    if not smooth_ok:
        for fl in [l.strip() for l in out_s.splitlines() if 'FAIL' in l][:5]:
            lines.append(f'    {fl[:145]}')
    if not pic['pass']:
        for fl in (pic['qa_fails'] + pic['clip_fails'])[:5]:
            lines.append(f'    {fl[:145]}')
    lines.append(f'  [NEXT]    read_file("{os.path.abspath(proxy)}") for Gemini multimodal watch + listen')
    print('\n'.join(lines[:24]))
    sys.exit(0 if all_ok else 1)


def main():
    P = argparse.ArgumentParser(description='cine3d unified build & check CLI for Gemini Studio (<= 25 lines stdout)')
    P.add_argument('target', help='episodes/<id>.js (or episodes/<id>.beats.json with --audio)')
    P.add_argument('--rules', choices=['1', '2'], default=None)
    P.add_argument('--beats', default=None)
    P.add_argument('--skip-lips', action='store_true')
    P.add_argument('--skip-clip', action='store_true')
    P.add_argument('--audio', action='store_true', dest='audio_mode', help='audio check mode (target is .beats.json)')
    P.add_argument('--skip-build', action='store_true', help='with --audio: skip voice.py build')
    P.add_argument('--final', action='store_true', help='run checks + 30fps CRF17 render + smooth + review_proxy.mp4')
    P.add_argument('--reuse-check', action='store_true', help='with --final: reuse passing build_check.json when SHA-256 of inputs matches')
    P.add_argument('--force-render', action='store_true', help='with --final: render even if QA/clip fails')
    P.add_argument('--allow-silent', action='store_true', help='with --final: allow rendering without mix.wav (auto-on for demo/)')
    P.add_argument('--proxy-only', action='store_true', help='create out/<id>/review_proxy.mp4 only')
    P.add_argument('--spot', default=None, help='comma-separated timestamps for targeted 1080p stills')
    P.add_argument('--audio-file', dest='audio', default=None, help='override mix.wav path for --final / --proxy-only')
    P.add_argument('--mp4', default=None, help='existing mp4 path for --proxy-only')
    P.add_argument('--fps', type=int, default=30)
    P.add_argument('--crf', type=int, default=17)
    P.add_argument('--proxy-fps', type=int, default=24)
    P.add_argument('--cover-t', type=float, default=None)
    P.add_argument('--cover-top', default=None)
    P.add_argument('--cover-plate', default=None)
    a = P.parse_args()

    if a.audio_mode or a.target.endswith('.beats.json'):
        mode_audio(a)
    elif a.spot:
        mode_spot(a)
    elif a.proxy_only:
        mode_proxy_only(a)
    elif a.final:
        mode_final(a)
    else:
        ep_path = os.path.abspath(a.target)
        if not os.path.exists(ep_path):
            print(f'BUILD_CHECK FAIL  missing {a.target}'); sys.exit(2)
        ep_id = ep_id_of(ep_path)
        beats_path = os.path.abspath(a.beats) if a.beats else os.path.join(ROOT, 'episodes', f'{ep_id}.beats.json')
        rules = detect_rules(ep_id, beats_path, a.rules)
        s = run_picture_checks(ep_path, ep_id, beats_path, rules, skip_lips=a.skip_lips, skip_clip=a.skip_clip)
        print_picture_report(s, max_lines=24)
        sys.exit(0 if s['pass'] else 1)


if __name__ == '__main__':
    main()
