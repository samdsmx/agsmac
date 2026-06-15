"""Generate stylized cover cards for library books without a real cover image.

Run once. Outputs PNGs into images/biblioteca/portadas-base/.

If you need to regenerate (e.g. after editing the BOOKS list or color palette),
just re-run: `python helpers\generar_portadas_cards.py`.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'images', 'biblioteca', 'portadas-base')
os.makedirs(OUT_DIR, exist_ok=True)

W, H = 600, 900

PALETTES = {
    'bp':      ((74, 31, 143), (32, 14, 70)),
    'kipling': ((30, 86, 49), (15, 45, 23)),
}

BOOKS = [
    ('acerca-de-los-scouts',                 'Acerca de los Scouts',                 'Baden-Powell',        '1909', 'bp'),
    ('aventura-hacia-la-edad-viril',         'Aventura hacia la edad viril',         'Baden-Powell',        '1936', 'bp'),
    ('educacion-por-amor',                   'Educación por amor',                   'Baden-Powell',        '1923', 'bp'),
    ('el-libro-de-las-tierras-virgenes',     'El libro de las Tierras Vírgenes',     'Rudyard Kipling',     '1893', 'kipling'),
    ('escultismo-y-movimientos-juveniles',   'Escultismo y movimientos juveniles',   'Baden-Powell',        '1929', 'bp'),
    ('guia-para-el-jefe-de-tropa',           'Guía para el Jefe de Tropa',           'Baden-Powell',        '1919', 'bp'),
    ('lecciones-de-la-universidad-de-la-vida','Lecciones de la Universidad de la vida','Baden-Powell',      '1933', 'bp'),
    ('notas-para-instructores',              'Notas para Instructores',              'Baden-Powell',        '1908', 'bp'),
    ('rema-tu-propia-canoa',                 'Rema tu propia canoa',                 'Baden-Powell',        '1939', 'bp'),
    ('tropiezos-de-la-vida-y-como-encararlos','Tropiezos de la vida y cómo encararlos','Baden-Powell',      '1927', 'bp'),
    ('ultimas-cartas-de-baden-powell',       'Últimas cartas de Baden-Powell',       'Baden-Powell',        '1941', 'bp'),
]

def find_font(candidates, size):
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()

WIN_FONTS = r'C:\Windows\Fonts'
FONT_TITLE_CANDIDATES = [
    os.path.join(WIN_FONTS, 'georgiab.ttf'),
    os.path.join(WIN_FONTS, 'timesbd.ttf'),
    os.path.join(WIN_FONTS, 'arialbd.ttf'),
]
FONT_AUTHOR_CANDIDATES = [
    os.path.join(WIN_FONTS, 'georgiai.ttf'),
    os.path.join(WIN_FONTS, 'timesi.ttf'),
    os.path.join(WIN_FONTS, 'ariali.ttf'),
]
FONT_LABEL_CANDIDATES = [
    os.path.join(WIN_FONTS, 'arial.ttf'),
]

def gradient(palette):
    top, bottom = palette
    img = Image.new('RGB', (W, H), top)
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    return img

def draw_fleur(img, cx, cy, size, opacity=40):
    """Draw a stylized fleur-de-lis silhouette centered at (cx, cy)."""
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    col = (255, 255, 255, opacity)
    s = size
    d.ellipse((cx - s*0.06, cy - s*0.7, cx + s*0.06, cy + s*0.1), fill=col)
    d.polygon([(cx, cy - s*0.55), (cx - s*0.18, cy + s*0.1), (cx + s*0.18, cy + s*0.1)], fill=col)
    d.polygon([(cx - s*0.55, cy - s*0.1), (cx - s*0.6, cy + s*0.3), (cx - s*0.05, cy + s*0.15)], fill=col)
    d.polygon([(cx + s*0.55, cy - s*0.1), (cx + s*0.6, cy + s*0.3), (cx + s*0.05, cy + s*0.15)], fill=col)
    d.rectangle((cx - s*0.45, cy + s*0.18, cx + s*0.45, cy + s*0.28), fill=col)
    d.ellipse((cx - s*0.18, cy + s*0.3, cx + s*0.18, cy + s*0.55), fill=col)
    layer = layer.filter(ImageFilter.GaussianBlur(radius=1.2))
    img.paste(layer, (0, 0), layer)

def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, cur = [], ''
    for w in words:
        test = (cur + ' ' + w).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def fit_title(text, max_width):
    """Find largest title size that wraps to <=4 lines within max_width."""
    for size in (60, 54, 48, 42, 38, 34, 30):
        font = find_font(FONT_TITLE_CANDIDATES, size)
        tmp = Image.new('RGB', (10, 10))
        d = ImageDraw.Draw(tmp)
        lines = wrap_text(d, text, font, max_width)
        if len(lines) <= 4:
            return font, lines
    return font, lines

def render_card(slug, title, author, year, palette_key):
    img = gradient(PALETTES[palette_key])
    draw_fleur(img, W // 2, H // 2 + 40, 420, opacity=28)
    draw = ImageDraw.Draw(img)
    border = 18
    draw.rectangle((border, border, W - border, H - border), outline=(255, 255, 255, 200), width=2)
    draw.rectangle((border + 6, border + 6, W - border - 6, H - border - 6), outline=(255, 255, 255, 120), width=1)
    label_font = find_font(FONT_LABEL_CANDIDATES, 16)
    label = 'BIBLIOGRAFÍA SCOUT'
    bbox = draw.textbbox((0, 0), label, font=label_font)
    lw = bbox[2] - bbox[0]
    draw.text(((W - lw) // 2, 70), label, font=label_font, fill=(255, 255, 255, 220), spacing=4)
    draw.line((W // 2 - 60, 100, W // 2 + 60, 100), fill=(255, 255, 255, 180), width=1)
    title_font, lines = fit_title(title, max_width=W - 100)
    asc, desc = title_font.getmetrics()
    line_h = asc + desc + 6
    block_h = line_h * len(lines)
    start_y = (H - block_h) // 2 - 40
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=title_font)
        tw = bbox[2] - bbox[0]
        draw.text(((W - tw) // 2, start_y + i * line_h), line, font=title_font, fill=(255, 255, 255))
    author_font = find_font(FONT_AUTHOR_CANDIDATES, 30)
    bbox = draw.textbbox((0, 0), author, font=author_font)
    aw = bbox[2] - bbox[0]
    draw.text(((W - aw) // 2, H - 160), author, font=author_font, fill=(255, 255, 255, 230))
    year_font = find_font(FONT_LABEL_CANDIDATES, 18)
    bbox = draw.textbbox((0, 0), year, font=year_font)
    yw = bbox[2] - bbox[0]
    draw.text(((W - yw) // 2, H - 115), year, font=year_font, fill=(255, 255, 255, 180))
    out = os.path.join(OUT_DIR, slug + '.png')
    img.save(out, 'PNG', optimize=True)
    print(f'  {slug}.png  {os.path.getsize(out) // 1024} KB')

def main():
    print(f'Generando {len(BOOKS)} portadas-card en {OUT_DIR}')
    for slug, title, author, year, palette in BOOKS:
        render_card(slug, title, author, year, palette)
    print('Listo.')

if __name__ == '__main__':
    main()
