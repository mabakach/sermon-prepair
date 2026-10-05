#!/usr/bin/env python3
"""Brennt Wochenspruch und Bibelstelle ins Bild ein (Pillow).

Wählt automatisch das ruhigere Bilddrittel (oben oder unten), legt dort einen
weichen dunklen Verlauf und setzt den Text in weisser Serifenschrift darüber.
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat

FONT_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Georgia.ttf',
    '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
    '/Library/Fonts/Georgia.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
]
FONT_ITALIC_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Georgia Italic.ttf',
    '/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf',
]


def find_font(candidates, override=None):
    for path in ([override] if override else []) + candidates:
        if path and os.path.exists(path):
            return path
    return None


def load(path, size):
    if path:
        return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def wrap(draw, text, font, max_w):
    lines, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if draw.textlength(trial, font=font) <= max_w or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def calmer_band(img):
    """Gibt 'top' oder 'bottom' zurück: das Drittel mit weniger Detail."""
    gray = img.convert('L')
    w, h = gray.size
    third = h // 3
    scores = {}
    for name, box in (('top', (0, 0, w, third)), ('bottom', (0, h - third, w, h))):
        edges = gray.crop(box).filter(ImageFilter.FIND_EDGES)
        scores[name] = ImageStat.Stat(edges).mean[0]
    return min(scores, key=scores.get)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--text', required=True)
    ap.add_argument('--reference', default='')
    ap.add_argument('--font')
    ap.add_argument('--position', choices=['auto', 'top', 'bottom'], default='auto')
    a = ap.parse_args()

    img = Image.open(a.input).convert('RGB')
    w, h = img.size
    band = calmer_band(img) if a.position == 'auto' else a.position

    font_path = find_font(FONT_CANDIDATES, a.font)
    ital_path = find_font(FONT_ITALIC_CANDIDATES) or font_path
    if not font_path:
        print('Warnung: keine Serifenschrift gefunden, Standardschrift wird verwendet', file=sys.stderr)

    measure = ImageDraw.Draw(img)
    margin = int(w * 0.08)
    max_w = w - 2 * margin
    max_block_h = int(h * 0.30)

    size = int(h * 0.075)
    while True:
        body = load(ital_path, size)
        ref = load(font_path, max(int(size * 0.62), 12))
        lines = wrap(measure, f'«{a.text}»', body, max_w)
        line_h = int(size * 1.28)
        ref_h = int(size * 0.62 * 1.4) if a.reference else 0
        block_h = len(lines) * line_h + (int(size * 0.35) + ref_h if a.reference else 0)
        if block_h <= max_block_h or size <= 20:
            break
        size -= 2

    pad = int(h * 0.04)
    scrim_h = block_h + 2 * pad
    scrim_h = min(scrim_h + int(h * 0.12), int(h * 0.55))
    y0 = h - scrim_h if band == 'bottom' else 0

    # Verlauf: an der Bildkante am dunkelsten, zur Bildmitte transparent
    scrim = Image.new('L', (w, scrim_h), 0)
    sd = ImageDraw.Draw(scrim)
    for i in range(scrim_h):
        t = i / (scrim_h - 1)
        edge = t if band == 'bottom' else 1 - t
        sd.line([(0, i), (w, i)], fill=int(225 * min(1.0, edge * 1.6) ** 0.9))
    dark = Image.new('RGB', (w, scrim_h), (15, 18, 28))
    img.paste(dark, (0, y0), scrim)

    draw = ImageDraw.Draw(img)
    if band == 'bottom':
        y = h - pad - block_h
    else:
        y = pad
    shadow = (0, 0, 0)
    for line in lines:
        lw = draw.textlength(line, font=body)
        x = (w - lw) / 2
        draw.text((x + 2, y + 2), line, font=body, fill=shadow)
        draw.text((x, y), line, font=body, fill=(255, 255, 255))
        y += line_h
    if a.reference:
        y += int(size * 0.35)
        label = f'– {a.reference}'
        lw = draw.textlength(label, font=ref)
        x = (w - lw) / 2
        draw.text((x + 1, y + 1), label, font=ref, fill=shadow)
        draw.text((x, y), label, font=ref, fill=(235, 225, 200))

    os.makedirs(os.path.dirname(os.path.abspath(a.output)), exist_ok=True)
    img.save(a.output)
    print(f'{a.output} band={band} font_size={size}')


if __name__ == '__main__':
    main()
