#!/usr/bin/env python3
"""Composite + encode, OUTSIDE Blender (system python3 + ffmpeg, no numpy):
  python3 blender/compose.py --frames out/t61/blender/bl/frames --overlay out/t61/blender/overlay --audio out/t61/audio/mix.wav \
      --out out/t61/blender/t61_blender_0-15.6.mp4 [--from 0 --to 15.6] [--fps 30] [--crf 16] [--board out/t61/blender/board] [--keep]
Order, per frame f (absolute dump frame numbers):
  1. Blender frame (f_%05d.jpg / .png; during a set swap an RGBA png of the cast over a transparent background)
  2. set swap: the 2-D board (board/f_%05d.png, from `render.cjs pngseq --board-only`) under the cast, mixed with the swap fade of the dump
  3. backdrop (blur + dim) where overlay_meta.json lists it for that frame
  4. display-referred grade (DISPLAY_GRADE: the engine's saturation / contrast after the tone map), vignette, fine film grain (fixed seed: deterministic)
  5. the text/overlay layer on top (straight-alpha PNG)
  6. audio mix.wav from --from seconds; H.264 1080x1920, yuv420p, CRF 16
Frame folders are deleted after a successful encode unless --keep (disk)."""
import argparse, json, os, shutil, subprocess, sys, tempfile

GRADE = {'vignette': 'PI/12', 'grain': 2}     # grain is STATIC (no per-frame flag): temporal grain failed tools/smooth.py
DISPLAY_GRADE = 'eq=contrast=1.06:saturation=0.92'
BOARD_K = 0.64   # set-swap board level: the engine grades + vignettes the board with the 3-D picture (measured: board pixels at about 0.6x of the raw drawing in the film)   # the engine's grade, display-referred (after AgX), as cine3d does it


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(r.stderr[-3000:]); raise SystemExit(f'ffmpeg failed: {" ".join(cmd[:6])} ...')
    return r


def frame_path(d, f):
    for ext in ('.jpg', '.png'):
        p = os.path.abspath(os.path.join(d, f'f_{f:05d}{ext}'))
        if os.path.exists(p):
            return p
    return None


FREEZE = None


def fz(f):
    return f if FREEZE is None else min(f, FREEZE)


def _mix(spec, ramp=0.25, top=0.5):
    """--tmix t0-t1: a shutter that fades in and out (no step at the window edges): each frame is mixed with the one before it, weight 0 -> `top` -> 0"""
    t0, t1 = (float(x) for x in spec.split('-'))
    k = f"{top}*max(0,min(1,min((T-{t0})/{ramp},({t1}-T)/{ramp})))"
    return f",format=yuv420p,split[m0][m1];[m1]tpad=start=1:start_mode=clone[m2];[m0][m2]blend=all_expr='A*(1-({k}))+B*({k})'[v]"


def main():
    global FREEZE
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', required=True); ap.add_argument('--overlay', required=True); ap.add_argument('--audio'); ap.add_argument('--out', required=True)
    ap.add_argument('--from', dest='t0', type=float, default=0.0); ap.add_argument('--to', dest='t1', type=float, default=None)
    ap.add_argument('--fps', type=int, default=30); ap.add_argument('--crf', type=int, default=16); ap.add_argument('--board'); ap.add_argument('--dump')
    ap.add_argument('--keep', action='store_true'); ap.add_argument('--keep-seq', action='store_true')
    ap.add_argument('--tmix', help='t0-t1 (seconds of the OUTPUT): average each frame with the one before it inside this window (a cheap shutter: a fast move / burst that the engine renders softer than the hybrid layers)')
    ap.add_argument('--cast', help='HYBRID: a folder of RGBA cast frames from blender/castpass.cjs, laid over the graded Blender picture (the cast carries the engine\'s own grade)')
    ap.add_argument('--freeze-from', type=int, default=None, help='HYBRID: hit-stop: from this absolute frame on the picture (Blender + cast) is frame N held; frames after it need not be rendered')
    a = ap.parse_args()
    FREEZE = a.freeze_from
    fps = a.fps; f0 = int(round(a.t0 * fps))
    have = sorted(int(n[2:7]) for n in os.listdir(a.frames) if n.startswith('f_'))
    castd = a.frames.rstrip('/') + '_cast'
    if os.path.isdir(castd):   # full-swap frames have only the cast pass
        have = sorted(set(have) | {int(n[2:7]) for n in os.listdir(castd) if n.startswith('f_')})
    f1 = int(round(a.t1 * fps)) if a.t1 is not None else have[-1] + 1
    want = list(range(f0, f1)); missing = [f for f in want if fz(f) not in set(have)]
    if missing:
        raise SystemExit(f'missing Blender frames: {missing[:10]} ... ({len(missing)})')
    meta = json.load(open(os.path.join(a.overlay, 'overlay_meta.json')))
    skipped = dict(meta.get('skipped', {})) if isinstance(meta.get('skipped'), dict) else {str(k): v for k, v in meta.get('skipped', [])}
    swap = {}
    if a.board and a.dump:
        for fr in json.load(open(a.dump))['frames']:
            if fr.get('swap', 0) > 0: swap[fr['f']] = fr['swap']
    UP = ''   # a 3-D render below 1080x1920 (run_ep --res): Lanczos up to full size before the overlays (17/11); full-size renders: nothing changes
    _p = frame_path(a.frames, fz(want[0])) or frame_path(a.frames.rstrip('/') + '_cast', want[0])
    _sz = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', _p], capture_output=True, text=True).stdout.strip()
    if _sz and _sz != '1080,1920': UP = 'scale=1080:1920:flags=lanczos,'; print('upscaling the 3-D layer from', _sz)
    tmp = tempfile.mkdtemp(prefix='c3dcomp_', dir=os.path.dirname(os.path.abspath(a.out)))
    try:
        seq = os.path.join(tmp, 'seq'); os.makedirs(seq)
        nproc = 0
        for f in want:
            src = frame_path(a.frames, fz(f)) or (frame_path(a.frames.rstrip('/') + '_cast', f) if swap.get(f, 0) >= 1 else None); dst = os.path.join(seq, f'f_{f:05d}.jpg')   # ONE extension for the whole sequence (a .png among .jpg names was dropped by the reader: the picture froze)
            vf = []; inputs = ['-i', src]; filt = None
            s = swap.get(f, 0)
            if s > 0:
                # set swap: [the full stall frame, while it cross-fades] -> the board at the fade s -> the cast + kept props (RGBA, transparent film) on top.
                # Blender writes the cast pass to <frames>_cast/f_%05d.png for swap frames; the opaque frame (if any) is the stall.
                b = frame_path(a.board, f); cast = frame_path(a.frames.rstrip('/') + '_cast', f)
                if not (b and cast):
                    raise SystemExit(f'swap frame {f}: board or cast pass missing')
                base = src if src and s < 1 else None
                inputs = (['-i', base] if base else ['-f', 'lavfi', '-i', 'color=black:s=1080x1920']) + ['-i', b, '-i', cast]
                filt = f'[0]{UP}format=rgba[k];[1]format=rgba,colorchannelmixer=rr={BOARD_K}:gg={BOARD_K}:bb={BOARD_K}:aa={s:.4f}[b];[k][b]overlay=format=auto[bb];[2]{UP}format=rgba[cc];[bb][cc]overlay=format=auto'
            for o in skipped.get(str(f), []):
                if o.get('kind') == 'backdrop' or o.get('sample') == 'backdrop':
                    vf.append(f"gblur=sigma={max(0.1, o['blur']):.2f},colorchannelmixer=rr={o['dim']:.4f}:gg={o['dim']:.4f}:bb={o['dim']:.4f}")
            if filt is None and not vf:
                continue   # plain frames are re-encoded in one pass below (one encoder for every file: mixed JPEG headers made the reader drop frames)
            chain = (filt + (',' if vf else '') if filt else '') + ','.join(vf)
            cmd = ['ffmpeg', '-loglevel', 'error', '-y', *inputs, '-filter_complex' if filt else '-vf', chain + ',format=yuvj420p', '-q:v', '1', '-frames:v', '1', dst]   # same pixel format as every other file
            run(cmd); nproc += 1
        plain = [f for f in want if not os.path.exists(os.path.join(seq, f'f_{f:05d}.jpg'))]
        if plain:
            tmpin = os.path.join(tmp, 'in'); os.makedirs(tmpin)
            for f in plain:
                os.symlink(frame_path(a.frames, fz(f)), os.path.join(tmpin, f'p_{plain.index(f):05d}' + os.path.splitext(frame_path(a.frames, fz(f)))[1]))
            ext = os.path.splitext(frame_path(a.frames, fz(plain[0])))[1]
            run(['ffmpeg', '-loglevel', 'error', '-y', '-threads', '1', '-i', os.path.join(tmpin, 'p_%05d' + ext), '-vf', UP + 'format=yuvj420p', '-q:v', '1', '-start_number', '0', os.path.join(tmpin, 'o_%05d.jpg')])
            for k, f in enumerate(plain):
                os.replace(os.path.join(tmpin, f'o_{k:05d}.jpg'), os.path.join(seq, f'f_{f:05d}.jpg'))
        # every frame now has a file seq/f_%05d.jpg: read both layers as numbered image sequences (exact frame numbers, no concat timing)
        missing = [f for f in want if not os.path.exists(os.path.join(seq, f'f_{f:05d}.jpg'))]
        if missing: raise SystemExit(f'composite sequence incomplete: {missing[:10]}')
        g = GRADE
        addd = os.path.join(os.path.abspath(a.overlay), 'add')
        has_add = os.path.isdir(addd) and all(os.path.exists(os.path.join(addd, f'f_{f:05d}.png')) for f in want)
        # additive glows (engine 'lighter': Bíp's spark glow, the phone glow) are ADDED to the graded picture (colour x alpha), then grain, then the text layer
        glow = (f"[{2}:v]format=rgba,premultiply=inplace=1,format=gbrp[g];[pg]format=gbrp[pb];[pb][g]blend=all_mode=addition[pa];" if has_add else "")   # both inputs RGB planar (a YUV input made the add magenta)
        # during a set swap the board's flashing elements were magnified by the grain and the added contrast (smooth.py): there, no grain
        # and no extra contrast (saturation only); elsewhere the normal grade
        sw_frames = sorted(f - f0 for f in swap if f0 <= f < f1)
        if sw_frames:
            spans = []; a0 = b0 = sw_frames[0]
            for x in sw_frames[1:]:
                if x == b0 + 1: b0 = x
                else: spans.append((a0, b0)); a0 = b0 = x
            spans.append((a0, b0)); inb = '+'.join(f'between(n,{p0},{p1})' for p0, p1 in spans)   # inside quotes: plain commas
            grade = (f"eq=contrast=1.06:saturation=0.92:enable='not({inb})',eq=saturation=0.92:enable='{inb}'")
            grain = f"noise=alls={g['grain']}:all_seed=7:enable='not({inb})'"
        else:
            grade = DISPLAY_GRADE; grain = f"noise=alls={g['grain']}:all_seed=7"
        castseq = None
        if a.cast:   # the cast frames as a numbered sequence (hit-stop: the held frame repeated through symlinks)
            castseq = os.path.join(tmp, 'castseq'); os.makedirs(castseq)
            for f in want:
                s_ = os.path.abspath(os.path.join(a.cast, f'f_{fz(f):05d}.png'))
                if not os.path.exists(s_): raise SystemExit(f'cast frame missing: {s_}')
                os.symlink(s_, os.path.join(castseq, f'f_{f:05d}.png'))
        ci = (3 if has_add else 2)   # cast input index
        castf = (f"[pg0]format=rgba[pgr];[{ci}:v]format=rgba[cs];[pgr][cs]overlay=format=auto,format=gbrp[pg];" if castseq else "")
        fc = (f"[0:v]format=gbrp,{grade},vignette=angle={g['vignette']}[{'pg0' if castseq else 'pg'}];" + castf + glow +
              f"[{'pa' if has_add else 'pg'}]{grain},format=rgba[p];[1:v]format=rgba[o];[p][o]overlay=format=auto:shortest=1" + (_mix(a.tmix) if a.tmix else ",format=yuv420p[v]"))
        cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-threads', '1', '-framerate', str(fps), '-start_number', str(f0), '-i', os.path.join(seq, 'f_%05d.jpg'),
               '-framerate', str(fps), '-start_number', str(f0), '-i', os.path.join(os.path.abspath(a.overlay), 'f_%05d.png')]
        if has_add:
            cmd += ['-framerate', str(fps), '-start_number', str(f0), '-i', os.path.join(addd, 'f_%05d.png')]
        if castseq:
            cmd += ['-framerate', str(fps), '-start_number', str(f0), '-i', os.path.join(castseq, 'f_%05d.png')]
        ai = (3 if has_add else 2) + (1 if castseq else 0)
        if a.audio:
            cmd += ['-ss', f'{f0 / fps:.4f}', '-t', f'{len(want) / fps:.4f}', '-i', a.audio]
        cmd += ['-filter_complex', fc, '-map', '[v]']
        if a.audio:
            cmd += ['-map', f'{ai}:a', '-c:a', 'aac', '-b:a', '192k']
        cmd += ['-r', str(fps), '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-frames:v', str(len(want)), a.out]
        run(cmd)
        print(f'-> {a.out}  {len(want)} frames ({nproc} pre-processed: backdrop / swap)')
        if not a.keep:
            shutil.rmtree(a.frames, ignore_errors=True); shutil.rmtree(castd, ignore_errors=True); print('deleted', a.frames)
    finally:
        if not a.keep_seq: shutil.rmtree(tmp, ignore_errors=True)
        else: print('kept', tmp)


if __name__ == '__main__':
    main()
