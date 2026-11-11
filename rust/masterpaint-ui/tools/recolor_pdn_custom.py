# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Icônes dessinées pour le pack Paint.NET (icon-packs/paintdotjs/custom/*.svg) ramenées à la
palette des icônes d'origine de paint.js : couleurs plus douces, moins contrastées (avant, les
bleus et violets francs se voyaient de loin à côté des icônes d'origine).

  python3 -I tools/recolor_pdn_custom.py [--dry]

Chaque couleur va vers la teinte d'origine la plus proche (famille de teinte, puis luminosité),
relevée sur les PNG de icon-packs/paintdotjs/source/. Relancer ensuite tools/build_reference_packs.py.
Les couleurs de modèle ({STROKE}, {ACCENT}…) ne sont pas touchées.
"""
import colorsys
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CUSTOM = HERE.parent / 'icon-packs' / 'paintdotjs' / 'custom'
GEN = HERE / 'gen_custom_pack_icons.py'

# nuances relevées sur les icônes d'origine (les plus employées de chaque famille)
FAMILIES = {
    'rouge': (10, ['#f0e0d8', '#d08068', '#c87058', '#c85038', '#a85848']),
    'or': (38, ['#f0e8d0', '#e8d0a0', '#f0c880', '#e0b060', '#b89050', '#a88850', '#685848']),
    'vert': (100, ['#e8f0e8', '#90b878', '#70a858', '#588848']),
    'vert-de-gris': (155, ['#e0f0e8', '#b8d8d0', '#90c0a8', '#68a088', '#389880']),
    'bleu': (207, ['#e0e8f0', '#c0d8e8', '#88a8c8', '#6898c0', '#5088b8', '#4080b0', '#386890']),
    'indigo': (240, ['#e8e8f0', '#b0b0d8', '#7878c0', '#5c5c98']),
    'violet': (280, ['#e8e0f0', '#d0c8d8', '#c0a8d0', '#a880b8', '#9868b0', '#705088']),
    'rose': (340, ['#f0e8f0', '#e8c8d8', '#d88098', '#b86078']),
}
GRAYS = ['#ffffff', '#f8f8f8', '#f0f0f0', '#e8e8e8', '#c0c8c8', '#9098a0', '#909898', '#808888', '#586070', '#404850']


def hls(c):
    c = c.lstrip('#')
    if len(c) == 3:
        c = ''.join(ch * 2 for ch in c)
    r, g, b = (int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hls(r, g, b)


def nearest(c):
    h, l, s = hls(c)
    if s < 0.15 or l < 0.08 or l > 0.97:
        return min(GRAYS, key=lambda g: abs(hls(g)[1] - l))
    deg = h * 360
    fam = min(FAMILIES.values(), key=lambda f: min(abs(deg - f[0]), 360 - abs(deg - f[0])))
    # luminosité d'abord, saturation ensuite (sinon un doré vif devenait brun terne)
    return min(fam[1], key=lambda g: abs(hls(g)[1] - l) + 0.5 * abs(hls(g)[2] - s))


COLOR = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b')


def recolor(text):
    return COLOR.sub(lambda m: nearest(m.group(0)), text)


def main():
    dry = '--dry' in sys.argv
    changed = 0
    for f in sorted(CUSTOM.glob('*.svg')):
        old = f.read_text(encoding='utf-8')
        new = recolor(old)
        if new != old:
            changed += 1
            if not dry:
                f.write_text(new, encoding='utf-8')
    # mêmes couleurs dans le générateur (section PAINT), pour qu'il ne les rétablisse pas
    src = GEN.read_text(encoding='utf-8')
    a = src.index('PAINT = {')
    b = src.index('CUSTOM_ALIAS = {', a)
    new_src = src[:a] + recolor(src[a:b]) + src[b:]
    if new_src != src and not dry:
        GEN.write_text(new_src, encoding='utf-8')
    print(f'{changed} icônes recolorées' + (' (essai)' if dry else ''))


if __name__ == '__main__':
    main()
