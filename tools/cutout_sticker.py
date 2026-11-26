#!/usr/bin/env python3
"""cine3d sticker & backdrop processor (v3.0 — Vox Paper-Cutout / Gemini Image Pipeline).

Converts raw `generate_image` white-background illustrations into crisp, tight-cropped,
transparent-background RGBA PNG stickers (512px max) for `packs/shared/stickers/`,
or optimized 1080x1920 / 1920x1080 JPEG backdrops for `packs/shared/backdrops/`.

Usage:
  python3 tools/cutout_sticker.py input.jpg packs/shared/stickers/sports_car.png [--size 512] [--stroke 0] [--thresh 232]
  python3 tools/cutout_sticker.py --backdrop input.jpg packs/shared/backdrops/mom_kitchen.jpg [--w 1080 --h 1920]
  python3 tools/cutout_sticker.py --rebuild-catalog

Requires Pillow (`PIL`). Zero external binary dependencies."""
import argparse
from collections import deque
import json
import os
import sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STICKER_DIR = os.path.join(ROOT, 'packs', 'shared', 'stickers')
BACKDROP_DIR = os.path.join(ROOT, 'packs', 'shared', 'backdrops')


def is_bg_pixel(r, g, b, thresh=194, max_sat=26):
    mx = max(r, g, b)
    mn = min(r, g, b)
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return luma >= thresh and (mx - mn) <= max_sat


def strip_white_bg_flood(img, thresh=194, max_sat=26, feather=True):
    """Flood-fill from all 4 edges so white areas INSIDE the artwork (e.g. styrofoam box,
    highlights, white villa walls) stay 100% opaque while outer white + baked sticker borders
    and faint light-gray drop-shadow rings become cleanly transparent (stops at ink outlines
    or saturated colors)."""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    px = rgba.load()
    visited = bytearray(w * h)
    q = deque()

    def try_push(x, y):
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, a = px[x, y]
        if a == 0 or is_bg_pixel(r, g, b, thresh, max_sat):
            visited[idx] = 1
            q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (255, 255, 255, 0)
        if x > 0:
            try_push(x - 1, y)
        if x + 1 < w:
            try_push(x + 1, y)
        if y > 0:
            try_push(x, y - 1)
        if y + 1 < h:
            try_push(x, y + 1)

    # Second pass: eat 2px faint gray shadow / anti-alias white fringe on the outer boundary
    for _ in range(2):
        to_fade = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if px[x - 1, y][3] == 0 or px[x + 1, y][3] == 0 or px[x, y - 1][3] == 0 or px[x, y + 1][3] == 0:
                    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
                    sat = max(r, g, b) - min(r, g, b)
                    if luma > 180 and sat < 30:
                        to_fade.append((x, y, 0))
                    elif feather and luma > 145 and sat < 34:
                        to_fade.append((x, y, int(a * 0.45)))
        for x, y, na in to_fade:
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, na)

    return rgba


def add_cutout_stroke(rgba, stroke_px=10, color=(255, 255, 255)):
    if stroke_px <= 0:
        return rgba
    w, h = rgba.size
    pad = stroke_px + 4
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    canvas.paste(rgba, (pad, pad), rgba)
    alpha = canvas.getchannel('A')
    k = stroke_px * 2 + 1
    dilated = alpha.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.GaussianBlur(0.8))
    outline = Image.new('RGBA', canvas.size, (*color, 0))
    outline.putalpha(dilated)
    return Image.alpha_composite(outline, canvas)


def process_sticker(src, dst, size=512, stroke=0, thresh=194, max_sat=26):
    im = Image.open(src)
    rgba = strip_white_bg_flood(im, thresh=thresh, max_sat=max_sat)
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    # Trim thin semi-transparent outer fringe then add modest padding
    if stroke > 0:
        rgba = add_cutout_stroke(rgba, stroke_px=stroke)
    w, h = rgba.size
    scale = min((size - 16) / max(1, w), (size - 16) / max(1, h), 1.0)
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    rgba = rgba.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (nw + 16, nh + 16), (0, 0, 0, 0))
    out.paste(rgba, (8, 8), rgba)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    out.save(dst, format='PNG', optimize=True)
    kb = round(os.path.getsize(dst) / 1024, 1)
    print(f'STICKER OK  {os.path.relpath(dst, ROOT)}  ({out.size[0]}x{out.size[1]}, {kb} KB)')


def process_backdrop(src, dst, w=1080, h=1920, quality=88):
    im = Image.open(src).convert('RGB')
    sw, sh = im.size
    # Center-crop to target aspect ratio then high-quality resize
    target_ar = w / h
    cur_ar = sw / sh
    if cur_ar > target_ar:
        nw = int(round(sh * target_ar))
        x0 = (sw - nw) // 2
        im = im.crop((x0, 0, x0 + nw, sh))
    elif cur_ar < target_ar:
        nh = int(round(sw / target_ar))
        y0 = (sh - nh) // 2
        im = im.crop((0, y0, sw, y0 + nh))
    im = im.resize((w, h), Image.Resampling.LANCZOS)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    im.save(dst, format='JPEG', quality=quality, optimize=True, progressive=True)
    kb = round(os.path.getsize(dst) / 1024, 1)
    print(f'BACKDROP OK  {os.path.relpath(dst, ROOT)}  ({w}x{h}, {kb} KB)')


def rebuild_catalog():
    os.makedirs(STICKER_DIR, exist_ok=True)
    os.makedirs(BACKDROP_DIR, exist_ok=True)
    stickers = {}
    for fn in sorted(os.listdir(STICKER_DIR)):
        if fn.lower().endswith(('.png', '.webp')):
            stem = os.path.splitext(fn)[0]
            p = os.path.join(STICKER_DIR, fn)
            with Image.open(p) as im:
                w, h = im.size
            stickers[stem] = {'path': f'packs/shared/stickers/{fn}', 'w': w, 'h': h}
    backdrops = {}
    for fn in sorted(os.listdir(BACKDROP_DIR)):
        if fn.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            stem = os.path.splitext(fn)[0]
            p = os.path.join(BACKDROP_DIR, fn)
            with Image.open(p) as im:
                w, h = im.size
            backdrops[stem] = {'path': f'packs/shared/backdrops/{fn}', 'w': w, 'h': h}
    cat = {
        '_comment': 'Auto-generated by tools/cutout_sticker.py --rebuild-catalog. Used by core/media.js and core/overlay_board.js.',
        'style_prompt_sticker': 'Single isolated flat-shaded editorial cartoon sticker icon of [SUBJECT], bold clean dark navy-plum ink outlines (#231a3d), vibrant harmonious cel-shaded colors, modern editorial cartoon style, centered with generous white margin on a pure solid flat #FFFFFF white background, no floor shadow, no frame, NO TEXT, NO LETTERS, NO NUMBERS.',
        'style_prompt_backdrop': 'Vertical 9:16 stylized 2D editorial painted illustration background of [SCENE], atmospheric lighting, bold clean graphic shapes with subtle paper grain texture matching 3D toon characters, lower third darker and uncluttered, NO PEOPLE, NO CHARACTERS, NO TEXT.',
        'stickers': stickers,
        'backdrops': backdrops,
    }
    cat_path = os.path.join(STICKER_DIR, 'catalog.json')
    with open(cat_path, 'w', encoding='utf-8') as f:
        json.dump(cat, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'CATALOG OK  {os.path.relpath(cat_path, ROOT)}  ({len(stickers)} stickers, {len(backdrops)} backdrops)')


def main():
    p = argparse.ArgumentParser(description='cine3d Gemini sticker cutout & backdrop processor')
    p.add_argument('src', nargs='?', help='Source image path')
    p.add_argument('dst', nargs='?', help='Destination output path')
    p.add_argument('--backdrop', action='store_true', help='Process as 9:16/16:9 backdrop JPEG instead of RGBA sticker')
    p.add_argument('--size', type=int, default=512, help='Max sticker dimension in px (default 512)')
    p.add_argument('--stroke', type=int, default=0, help='Optional baked white cutout stroke in px (default 0; overlay_board.js draws dynamic Vox cutout rim)')
    p.add_argument('--thresh', type=int, default=194, help='White/gray-shadow background luminance threshold (default 194)')
    p.add_argument('--max-sat', type=int, default=26, help='Max RGB channel spread for background flood-fill (default 26)')
    p.add_argument('--w', type=int, default=1080)
    p.add_argument('--h', type=int, default=1920)
    p.add_argument('--rebuild-catalog', action='store_true')
    a = p.parse_args()

    if a.src and a.dst:
        if a.backdrop:
            process_backdrop(a.src, a.dst, w=a.w, h=a.h)
        else:
            process_sticker(a.src, a.dst, size=a.size, stroke=a.stroke, thresh=a.thresh, max_sat=a.max_sat)
    if a.rebuild_catalog or (a.src and a.dst):
        rebuild_catalog()
    elif not a.src:
        p.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()
