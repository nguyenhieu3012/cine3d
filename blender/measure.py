#!/usr/bin/env python3
"""Colour / brightness measurements for the fix rounds (system python3 + ffmpeg, no numpy).
  python3 blender/measure.py <image_or_video> [--t seconds] box x,y,w,h ...   -> median RGB, hue (deg), value (0..1) per box; mean luma of the frame
Boxes are in 1080x1920 pixels."""
import colorsys, subprocess, sys, statistics


def frame_rgb(src, t=None, box=None):
    vf = []
    if box:
        x, y, w, h = box; vf.append(f'crop={w}:{h}:{x}:{y}')
    cmd = ['ffmpeg', '-v', 'error'] + (['-ss', str(t)] if t is not None else []) + ['-i', src, '-frames:v', '1'] + (['-vf', ','.join(vf)] if vf else []) + ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    b = subprocess.run(cmd, capture_output=True, check=True).stdout
    return [(b[i], b[i + 1], b[i + 2]) for i in range(0, len(b), 3)]


def median_rgb(px):
    return tuple(int(statistics.median(c[k] for c in px)) for k in range(3))


def describe(rgb):
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    return {'rgb': rgb, 'hue': round(h * 360), 'sat': round(s, 2), 'value': round(v, 2)}


def luma(src, t=None):
    px = frame_rgb(src, t)
    return round(sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px[::7]) / len(px[::7]), 1)


if __name__ == '__main__':
    a = sys.argv[1:]; src = a[0]; t = float(a[a.index('--t') + 1]) if '--t' in a else None
    boxes = [tuple(int(v) for v in a[i + 1].split(',')) for i, x in enumerate(a) if x == 'box']
    for bx in boxes:
        print('box', bx, describe(median_rgb(frame_rgb(src, t, bx))))
    print('mean luma', luma(src, t))


def sharpness(src, box, t=None):
    """mean |Laplacian| of the luma in a box (higher = crisper lines)"""
    x, y, w, h = box
    px = frame_rgb(src, t, box)
    L = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px]
    s = 0.0; n = 0
    for j in range(1, h - 1):
        for i in range(1, w - 1):
            k = j * w + i
            s += abs(4 * L[k] - L[k - 1] - L[k + 1] - L[k - w] - L[k + w]); n += 1
    return round(s / n, 2)
