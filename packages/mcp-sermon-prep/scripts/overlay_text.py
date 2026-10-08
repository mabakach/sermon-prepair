#!/usr/bin/env python3
"""Brennt Wochenspruch und Bibelstelle ins Bild ein (Pillow).

Wählt automatisch das ruhigere Bilddrittel (oben oder unten) und setzt den Text
in einer aus dem Bild abgeleiteten Kontrastfarbe (Kontrast mindestens 7:1, kein
Hintergrundverlauf) mit dezentem Lichthof um die Buchstaben.
"""
import argparse
import colorsys
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


PUNCT_END = ',.;:!?'


def ends_with_punct(word):
    return word.rstrip('»«"\u201c\u201d\u2019\')').endswith(tuple(PUNCT_END))


def greedy_wrap(draw, words, font, max_w):
    lines, line = [], ''
    for word in words:
        trial = f'{line} {word}'.strip()
        if draw.textlength(trial, font=font) <= max_w or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def wrap(draw, text, font, max_w):
    """Umbruch bevorzugt nach Satzzeichen (Komma, Punkt, ...). Erlaubt wird die minimale
    Zeilenzahl oder eine Zeile mehr, wenn dadurch Umbrüche mitten im Satzteil entfallen.
    Danach gewinnt die gleichmässigste Zeilenlänge."""
    words = text.split()
    n = len(greedy_wrap(draw, words, font, max_w))
    m = len(words)
    if n < 2:
        return greedy_wrap(draw, words, font, max_w)

    INF = float('inf')
    BREAK_PENALTY = 10.0  # grösser als jede Summe von Längenabweichungen
    EXTRA_LINE_PENALTY = 3.0  # eine Zeile mehr ist günstiger als ein Umbruch ohne Satzzeichen
    max_lines = n + 1

    def line_cost(i, j):
        width = draw.textlength(' '.join(words[i:j]), font=font)
        if width > max_w and j - i > 1:
            return INF
        cost = 0.0
        if j < m:  # keine Abweichungskosten für die letzte Zeile
            cost += ((max_w - width) / max_w) ** 2
            if not ends_with_punct(words[j - 1]):
                cost += BREAK_PENALTY
        return cost

    # dp[k][j]: minimale Kosten, die ersten j Wörter auf k Zeilen zu verteilen
    dp = [[INF] * (m + 1) for _ in range(max_lines + 1)]
    back = [[0] * (m + 1) for _ in range(max_lines + 1)]
    dp[0][0] = 0.0
    for k in range(1, max_lines + 1):
        for j in range(k, m + 1):
            for i in range(k - 1, j):
                if dp[k - 1][i] == INF:
                    continue
                c = dp[k - 1][i] + line_cost(i, j)
                if c < dp[k][j]:
                    dp[k][j], back[k][j] = c, i
    best_k = min(range(n, max_lines + 1), key=lambda k: dp[k][m] + (k - n) * EXTRA_LINE_PENALTY)
    if dp[best_k][m] == INF:
        return greedy_wrap(draw, words, font, max_w)
    lines, j = [], m
    for k in range(best_k, 0, -1):
        i = back[k][j]
        lines.append(' '.join(words[i:j]))
        j = i
    return lines[::-1]


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


def pixels(im):
    get = getattr(im, 'get_flattened_data', None) or im.getdata
    return list(get())


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(c1, c2):
    l1, l2 = sorted((lum(c1), lum(c2)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def pick_colors(img, box):
    """Kontrastfarbe aus der Palette des Bildes: Farbton der dunkelsten Bildpartien
    (bzw. der hellsten, wenn der Textbereich dunkel ist), Helligkeit so gewählt,
    dass der Kontrast zum Textbereich mindestens 7:1 beträgt."""
    small = img.resize((192, 108))
    px = pixels(small)
    px_sorted = sorted(px, key=lum)
    n = max(len(px_sorted) // 7, 1)

    region = pixels(img.crop(box).resize((96, 24)))
    reg_sorted = sorted(region, key=lum)
    k = max(len(reg_sorted) // 10, 1)
    reg_dark, reg_light = reg_sorted[k], reg_sorted[-k]
    reg_mean = tuple(int(sum(c[i] for c in region) / len(region)) for i in range(3))
    use_dark_text = lum(reg_mean) > 0.35

    pool = px_sorted[:n] if use_dark_text else px_sorted[-n:]
    base = tuple(sum(c[i] for c in pool) / len(pool) / 255 for i in range(3))
    hh, ll, ss = colorsys.rgb_to_hls(*base)
    ss = min(max(ss, 0.25), 0.55)

    worst = reg_dark if use_dark_text else reg_light
    step = -0.02 if use_dark_text else 0.02
    ll = min(ll, 0.30) if use_dark_text else max(ll, 0.75)
    fill = tuple(int(v * 255) for v in colorsys.hls_to_rgb(hh, ll, ss))
    while contrast(fill, worst) < 7 and 0.02 < ll < 0.98:
        ll += step
        fill = tuple(int(v * 255) for v in colorsys.hls_to_rgb(hh, ll, ss))
    glow = (255, 250, 240) if use_dark_text else (10, 12, 20)
    return fill, glow


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

    pad = int(h * 0.05)
    y_start = h - pad - block_h if band == 'bottom' else pad

    # Textbereich ausmessen und Kontrastfarbe aus dem Bild ableiten
    box = (margin, y_start, w - margin, y_start + block_h)
    fill, glow = pick_colors(img, box)

    draw = ImageDraw.Draw(img)
    halo = Image.new('L', img.size, 0)
    hd = ImageDraw.Draw(halo)

    y = y_start
    placed = []
    for line in lines:
        lw = draw.textlength(line, font=body)
        placed.append(((w - lw) / 2, y, line, body))
        y += line_h
    if a.reference:
        y += int(size * 0.35)
        label = f'– {a.reference}'
        lw = draw.textlength(label, font=ref)
        placed.append(((w - lw) / 2, y, label, ref))

    # Dezenter Lichthof nur um die Buchstaben (kein Hintergrundverlauf)
    for x, yy, text, font in placed:
        hd.text((x, yy), text, font=font, fill=255)
    halo = halo.filter(ImageFilter.GaussianBlur(max(size // 14, 3))).point(lambda v: int(v * 0.55))
    img.paste(Image.new('RGB', img.size, glow), (0, 0), halo)

    draw = ImageDraw.Draw(img)
    for x, yy, text, font in placed:
        draw.text((x, yy), text, font=font, fill=fill)

    os.makedirs(os.path.dirname(os.path.abspath(a.output)), exist_ok=True)
    img.save(a.output)
    print(f'{a.output} band={band} font_size={size}')


if __name__ == '__main__':
    main()
