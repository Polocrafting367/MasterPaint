"""Icônes maison de MasterPaint (outils, barre rapide, ruban, menus, boutons) — source unique.

  python3 -I gen_mpicons.py

Style du sprite MasterPaint (icons/illu-sprite.svg) : trait épais (≈ 1,4 sur la grille 16),
extrémités arrondies, aplats francs à la couleur d'accentuation, pointillés pour les sélections.
Les icônes qui existent déjà dans le sprite sont reprises telles quelles (REUSE) ; les autres
sont dessinées ici sur une grille 24 (réduite à 16 dans le symbole) et écrites dans le sprite,
section « Icônes MasterPaint Rust — générées » (ids illu-icon-mp-…), que la version HTML peut
aussi utiliser.

Écrit : ../../../icons/illu-sprite.svg (section générée), ../src/mpicons_gen.rs (modèles SVG,
rendus aux couleurs du thème par theme.rs) et ../ui/mpicons.slint (global MpIcons : images +
correspondances outil / bouton / glyphe / entrée de menu → icône).
"""
import math
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CRATE = os.path.dirname(HERE)
SPRITE = os.path.normpath(os.path.join(CRATE, '..', '..', 'icons', 'illu-sprite.svg'))

ST = 'var(--illu-icon-stroke, #1e293b)'
AC = 'var(--illu-icon-accent, #3b82f6)'
SU = 'var(--illu-icon-accent-subtle, #bfdbfe)'
BASE_W = 2.1          # trait de base sur la grille 24 (≈ 1,4 sur 16)


# ------------------------------------------------------------------ primitives

def _fill(op, outlined):
    """aplat d'accent : franc, atténué (dégradés en paliers) ou accent pâle pour les fonds"""
    if op is None or op >= 0.9:
        return f' fill="{AC}"'
    if op < 0.3:
        return f' fill="{SU}"'
    if outlined:
        return f' fill="{AC}"'
    return f' fill="{AC}" fill-opacity="{max(op, 0.45)}"'


def _attrs(kind, op):
    """o : trait ; f : aplat d'accent ; fo : aplat d'accent + trait ; s : aplat du trait ;
    a : trait d'accent ; d : trait pointillé"""
    return {
        'o': '',
        'f': _fill(op, False) + ' stroke="none"',
        'fo': _fill(op, True),
        's': f' fill="{ST}" stroke="none"' + (f' fill-opacity="{op}"' if op is not None and op < 1 else ''),
        'a': f' stroke="{AC}"',
        'd': ' stroke-dasharray="3 2.4"',
    }[kind]


def _w(w):
    """épaisseurs du dessin d'origine → style du sprite (les traits fins s'épaississent)"""
    if w is None:
        return ''
    w = 1.5 if w < 1.5 else BASE_W if w < BASE_W else w
    return f' stroke-width="{w}"'


def P(d, k='o', op=None, w=None, extra=''):
    return f'<path d="{d}"{_attrs(k, op)}{_w(w)}{extra}/>'


def R(x, y, w, h, rx=0, k='o', op=None, sw=None, extra=''):
    r = f' rx="{rx}"' if rx else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}"{r}{_attrs(k, op)}{_w(sw)}{extra}/>'


def C(cx, cy, r, k='o', op=None, sw=None):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}"{_attrs(k, op)}{_w(sw)}/>'


class S:
    """icône reprise du sprite (id sans le préfixe illu-icon-)"""
    def __init__(self, sid):
        self.sid = sid


def star(cx, cy, r, inner=0.34, k='f', op=None):
    """étoile à 4 branches (baguette, éclat)"""
    pts = []
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * inner
        pts.append(f'{cx + rr * math.cos(a):.2f} {cy + rr * math.sin(a):.2f}')
    return P('M' + 'L'.join(pts) + 'z', k, op)


def gear(cx=12, cy=12, ro=9, ri=6.8, teeth=8):
    pts = []
    n = teeth * 4
    for i in range(n):
        a = 2 * math.pi * i / n
        r = ro if (i % 4) in (1, 2) else ri
        pts.append(f'{cx + r * math.cos(a):.2f} {cy + r * math.sin(a):.2f}')
    return P('M' + 'L'.join(pts) + 'z', 'fo', .25) + C(cx, cy, 2.6, 'f')


def wedges(cx, cy, r, n=6):
    out = []
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n - math.pi / 2, 2 * math.pi * (i + 1) / n - math.pi / 2
        x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
        x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
        out.append(P(f'M{cx} {cy}L{x0:.2f} {y0:.2f}A{r} {r} 0 0 1 {x1:.2f} {y1:.2f}z', 'f', round(0.15 + 0.85 * i / (n - 1), 2)))
    return ''.join(out) + C(cx, cy, r)


def rays(cx, cy, r0, r1, n=8, k='o'):
    d = ''
    for i in range(n):
        a = 2 * math.pi * i / n
        d += f'M{cx + r0 * math.cos(a):.2f} {cy + r0 * math.sin(a):.2f}L{cx + r1 * math.cos(a):.2f} {cy + r1 * math.sin(a):.2f}'
    return P(d, k)


DASH_RECT = R(3.5, 4.5, 17, 15, 1, 'd')
PAGE = P('M5 3h9l4 4v14H5z') + P('M14 3v4h4')
FOLDER = P('M3 19V5h6l2 2h8v4') + P('M3 19l3.2-8H22l-3.2 8z', 'fo', .35)
MAG = C(10, 10, 6, 'fo', .25) + P('M14.5 14.5L20 20', w=2.6)
CAMERA = P('M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z')
LAYERS = P('M12 3l9 5-9 5-9-5z', 'fo', .45) + P('M3 12.5l9 5 9-5') + P('M3 16.5l9 5 9-5')
LAYERS_S = P('M10 3l8 4.5-8 4.5-8-4.5z', 'fo', .45) + P('M2 11.5l8 4.5 4.5-2.5') + P('M2 15.5l8 4.5 3-1.7')
DROP = 'M12 3c3.5 4.5 6 7.7 6 10.5a6 6 0 0 1-12 0C6 10.7 8.5 7.5 12 3z'
SCISSORS = C(6.5, 17.5, 3, 'fo', .35) + C(17.5, 17.5, 3, 'fo', .35) + P('M8.6 15.3L18 3M15.4 15.3L6 3')
PALETTE = (P('M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.4-1.9-.5-1.2.2-2.6 1.6-2.6H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z')
           + C(7.5, 11.5, 1.6, 'f') + C(10, 7, 1.6, 'f', .7) + C(15, 7, 1.6, 'f', .45) + C(8.5, 16, 1.4, 's'))
CHECK4 = R(3, 3, 9, 9, 0, 'f', .55) + R(12, 12, 9, 9, 0, 'f', .55) + R(3, 3, 18, 18, 2)


def align(guide, a, b):
    return P(guide) + R(*a, 1, 'fo', .55) + R(*b, 1, 'fo', .55)


# ------------------------------------------------------------------ icônes

ICONS = {
    # --- fichier / barre rapide
    'new': P('M12 21H5V3h9l4 4v5') + P('M14 3v4h4') + P('M18 14v8M14 18h8', 'a', w=2.2),
    'open': FOLDER,
    'save': P('M4 4h13l3 3v13H4z') + P('M8 4v5h7V4') + R(7, 13, 10, 7, 1, 'fo', .45),
    'export': P('M4 15v5h16v-5') + P('M12 3v11M7.5 9.5L12 14l4.5-4.5', 'a', w=2),
    'print': P('M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3') + P('M7 9V3h10v6') + R(7, 14, 10, 7, 1, 'fo', .4),
    'undo': P('M4 9h10.5a5.5 5.5 0 0 1 0 11H11') + P('M8.5 4.5L4 9l4.5 4.5', 'a', w=2),
    'redo': P('M20 9H9.5a5.5 5.5 0 0 0 0 11H13') + P('M15.5 4.5L20 9l-4.5 4.5', 'a', w=2),
    'zoom': MAG,
    'zoom-in': MAG + P('M10 7v6M7 10h6', 'a', w=2),
    'zoom-out': MAG + P('M7 10h6', 'a', w=2),
    'zoom-fit': P('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5') + R(8, 8, 8, 8, 1, 'fo', .35),
    'close-doc': P('M12 21H5V3h9l4 4v5') + P('M14 3v4h4') + P('M15 15l5 5M20 15l-5 5', 'a', w=2.2),
    'settings': gear(),
    'changelog': R(5, 3, 14, 18, 2) + C(8.5, 8, 1.2, 'f') + C(8.5, 12, 1.2, 'f') + C(8.5, 16, 1.2, 'f') + P('M11.5 8h4.5M11.5 12h4.5M11.5 16h3'),
    'about': C(12, 12, 9, 'fo', .15) + C(12, 7.6, 1.4, 'f') + P('M12 11v6', 'a', w=2.4),
    'camera': CAMERA + C(12, 13, 4, 'fo', .4),
    'camera-raw': CAMERA + C(12, 13, 4) + C(12, 13, 2, 'f'),
    # --- édition
    'cut': SCISSORS,
    'copy': P('M9 7V4.5A1.5 1.5 0 0 1 10.5 3h8A1.5 1.5 0 0 1 20 4.5v10a1.5 1.5 0 0 1-1.5 1.5H15', 'a') + R(4, 7, 11, 14, 1.5) + P('M7 11h5M7 14h5M7 17h3'),
    'paste': R(5, 4, 14, 17, 2) + R(9, 2.5, 6, 4, 1, 'f') + P('M9 11h6M9 14h6M9 17h4'),
    'trash': P('M4 6h16M9 6V4h6v2') + P('M6 6l1 14h10l1-14', 'fo', .25) + P('M10 10v6M14 10v6'),
    'sel-rect': DASH_RECT + R(3.5, 4.5, 17, 15, 1, 'f', .18),
    'sel-new': R(5, 5, 14, 14, 2, 'fo', .5),
    'sel-add': R(3, 3, 13, 13, 2, 'fo', .3) + P('M18 13v8M14 17h8', 'a', w=2.2),
    'sel-sub': R(3, 3, 13, 13, 2, 'fo', .3) + P('M14 17h8', 'a', w=2.2),
    'sel-all': DASH_RECT + R(6.5, 7.5, 11, 9, 0.5, 'f', .5),
    'sel-none': DASH_RECT + P('M9 9l6 6M15 9l-6 6', 'a', w=2),
    'sel-invert': DASH_RECT + R(3.5, 4.5, 8.5, 15, 0, 'f', .55),
    'sel-grow': R(8, 8, 8, 8, 0, 'd') + P('M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5', 'a', w=1.8),
    'vector': P('M4 18C4 8 20 16 20 6') + P('M4 18l5-9M20 6l-5 9', w=1) + R(2.5, 16.5, 3, 3, 0, 'f') + R(18.5, 4.5, 3, 3, 0, 'f') + C(9, 9, 1.3, 'f') + C(15, 15, 1.3, 'f'),
    # --- outils
    'lasso': P('M12 4c5 0 8.5 2.4 8.5 5.5S17 15 12 15 3.5 12.6 3.5 9.5 7 4 12 4z', 'd') + P('M7.5 14.5c-1.4 2-.4 4 1.6 4.5s1.4 2 .2 3') + C(7.5, 14.3, 1.7, 'f'),
    'lasso-poly': P('M4 8l7-4.5 9 5-3 10.5-11.5 1z', 'd') + C(4, 8, 1.7, 'f') + C(11, 3.5, 1.7, 'f') + C(20, 8.5, 1.7, 'f') + C(17, 19, 1.7, 'f') + C(5.5, 20, 1.7, 'f'),
    'lasso-magnetic': P('M11 3c4.4 0 7.5 2 7.5 4.8 0 1-.4 1.9-1.1 2.6M8 12.3C5.3 11.7 3.5 10 3.5 7.8 3.5 5 6.6 3 11 3', 'd')
                      + P('M11.5 12.5v4.5a4 4 0 0 0 8 0v-4.5', w=2.4) + P('M11.5 12.5v2M19.5 12.5v2', 'a', w=2.8),
    'wand': P('M3.5 20.5l11-11', w=2.6) + P('M14.5 9.5l2-2', 'a', w=2.8) + star(18, 6, 4.6) + star(8.5, 4.5, 2.8) + star(20, 14, 2.6),
    'warp4': P('M5 6l14-2 2 15-17 1z', 'fo', .2) + R(3.7, 4.7, 2.6, 2.6, 0, 'f') + R(17.7, 2.7, 2.6, 2.6, 0, 'f') + R(19.7, 17.7, 2.6, 2.6, 0, 'f') + R(2.7, 18.7, 2.6, 2.6, 0, 'f'),
    'deform': P('M4 4c4 2 12 2 16 0v16c-4-2-12-2-16 0z', 'fo', .2) + P('M4 12c4 2 12 2 16 0M12 4.8c-2 4-2 10.4 0 14.4', w=1.1) + C(12, 13, 2, 'f'),
    'eyedropper': P('M13 7l-8.5 8.5L4 20l4.5-.5L17 11') + P('M14.2 3.8a2.6 2.6 0 0 1 3.7 0l2.3 2.3a2.6 2.6 0 0 1 0 3.7L18 12l-6-6z', 'fo', .9) + P('M6.5 15.5h5', 'a', w=1.6),
    'move': P('M12 3v18M3 12h18') + P('M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3', 'a', w=1.9),
    'brush': P('M20.5 3.5L11.5 12.5', w=2.6) + P('M11 13c-2.5-.5-4.5 1-4.8 3.6C6 18.8 5 20 3.5 20.5c3 .8 6.6.4 8.3-1.6 1.4-1.6 1.3-4-.8-5.9z', 'f'),
    'pencil': P('M15.5 4.5l4 4L9 19l-5 1 1-5z', 'fo', .35) + P('M5 15l4 4M13.5 6.5l4 4'),
    'gradient': '<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="{ACC}"/><stop offset="1" stop-color="{ACC}" stop-opacity="0"/></linearGradient></defs>'
                + R(3, 5, 18, 14, 2, 'o', extra=' fill="url(#g)"'),
    'bucket': P('M5 11l6.5-6.5 7 7L12 18a2 2 0 0 1-2.8 0L5 13.8a2 2 0 0 1 0-2.8z', 'fo', .3) + P('M9 7L6.5 4.5M5.5 12.5h12')
              + P('M20 14.5c1 1.6 1.6 2.6 1.6 3.4a1.6 1.6 0 0 1-3.2 0c0-.8.6-1.8 1.6-3.4z', 'f'),
    'eraser': P('M8 10.2l5.5-5.5a2 2 0 0 1 2.8 0l3 3a2 2 0 0 1 0 2.8L13.8 16z', 'f', .8)
              + P('M8.5 20H20M3.6 14.6l9.9-9.9a2 2 0 0 1 2.8 0l3 3a2 2 0 0 1 0 2.8L11.5 18.3a2 2 0 0 1-1.4.6H8.3a2 2 0 0 1-1.4-.6L3.6 17.4a2 2 0 0 1 0-2.8z'),
    'text': P('M5 4h14v4h-2V6h-4v12h2v2H9v-2h2V6H7v2H5z', 's') + P('M19.5 13v8', 'a', w=1.8),
    'shapes': R(3, 3, 10, 10, 1) + C(15.5, 15.5, 5.5, 'fo', .5),
    'roundrect': R(3.5, 6, 17, 12, 4, 'fo', .3),
    'line': P('M5 19L19 5', w=2) + C(5, 19, 2, 'f') + C(19, 5, 2, 'f'),
    'align-left': align('M4 3v18', (7, 6, 12, 4), (7, 14, 8, 4)),
    'align-center-h': align('M12 3v18', (6, 6, 12, 4), (8, 14, 8, 4)),
    'align-right': align('M20 3v18', (5, 6, 12, 4), (9, 14, 8, 4)),
    'align-top': align('M3 4h18', (6, 7, 4, 12), (14, 7, 4, 8)),
    'align-center-v': align('M3 12h18', (6, 6, 4, 12), (14, 8, 4, 8)),
    'align-bottom': align('M3 20h18', (6, 5, 4, 12), (14, 9, 4, 8)),
    'align-center': R(3, 3, 18, 18, 1, 'd') + P('M12 3v18M3 12h18', w=1) + R(8.5, 8.5, 7, 7, 1, 'fo', .55),
    'outside-canvas': R(3, 3, 13, 13, 1) + R(10, 10, 11, 11, 1.5, 'fo', .45, extra=' stroke-dasharray="2.6 2"'),
    'grid': R(3, 3, 18, 18, 2) + P('M9 3v18M15 3v18M3 9h18M3 15h18', w=1.2) + R(9, 9, 6, 6, 0, 'f', .7),
    'rulers': P('M3 3h18v5H8v13H3z', 'fo', .3) + P('M7 3v2.5M11 3v2.5M15 3v2.5M19 3v2.5M3 12h2.5M3 16h2.5', w=1.2),
    'magnet': P('M7.5 8v4a4.5 4.5 0 0 0 9 0V8', w=3) + R(5.9, 3, 3.2, 4, 0.5, 'f') + R(14.9, 3, 3.2, 4, 0.5, 'f'),
    # --- image / calques
    'crop': P('M6 2v16h16M2 6h16v16', w=1.9) + R(9, 9, 6, 6, 0, 'f', .45),
    'crop-sel': P('M6 2v16h16M2 6h16v16', w=1.9) + R(9, 9, 6, 6, 0, 'd') + R(9, 9, 6, 6, 0, 'f', .3),
    'resize': R(3, 9, 12, 12, 1.5, 'fo', .3) + P('M13 11l7-7M15 4h5v5', 'a', w=2),
    'canvas-size': R(2.5, 2.5, 19, 19, 1, 'd') + R(7, 7, 10, 10, 1, 'fo', .4),
    'border': P('M3 3h18v18H3zM7 7v10h10V7z', 'f', .45, extra=' fill-rule="evenodd"') + R(3, 3, 18, 18, 1) + R(7, 7, 10, 10),
    'rotate': R(8, 9, 9, 9, 1, 'fo', .3) + P('M20 12a8 8 0 1 1-2.4-5.7') + P('M20 3.5V8h-4.5', 'a', w=2),
    'layer-bounds': R(6, 6, 12, 12, 0, 'fo', .35) + R(4.5, 4.5, 3, 3, 0, 's') + R(16.5, 4.5, 3, 3, 0, 's') + R(4.5, 16.5, 3, 3, 0, 's') + R(16.5, 16.5, 3, 3, 0, 's'),
    'layer-buffer': R(3, 5, 18, 14, 2) + P('M6 12h12M9 9l-3 3 3 3M15 9l3 3-3 3', 'a', w=1.8),
    'fit-content': P('M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4') + R(6, 6, 7, 7, 1, 'fo', .5) + C(15, 15, 3.5, 'fo', .3),
    'layers': LAYERS,
    'layer-add': LAYERS_S + P('M19 13v8M15 17h8', 'a', w=2.2),
    'layer-delete': LAYERS_S + P('M16 14l5 5M21 14l-5 5', 'a', w=2.2),
    'layer-dup': R(3, 3, 12, 12, 1.5, 'fo', .35) + R(9, 9, 12, 12, 1.5),
    'layer-up': LAYERS_S + P('M19 21v-8M16 16l3-3 3 3', 'a', w=2),
    'layer-down': LAYERS_S + P('M19 13v8M16 18l3 3 3-3', 'a', w=2),
    'merge': R(4, 3, 16, 5, 1) + R(4, 16, 16, 5, 1, 'fo', .45) + P('M12 9v5M9.5 11.5L12 14l2.5-2.5', 'a', w=2),
    'channels': C(9, 9, 5, 'fo', .25) + C(15, 9, 5, 'fo', .5) + C(12, 15, 5, 'fo', .75),
    'columns': R(4, 4, 4, 16, 1, 'fo', 1) + R(10, 4, 4, 16, 1, 'fo', .6) + R(16, 4, 4, 16, 1, 'fo', .25),
    # --- ajustements
    'auto-level': P('M3 20h18') + R(5, 12, 3, 8, 0, 'f', .5) + R(10, 8, 3, 12, 0, 'f', .8) + R(15, 14, 3, 6, 0, 'f', .5) + star(18.5, 5.5, 3.2, k='s'),
    'bw': C(12, 12, 8.5) + P('M12 3.5a8.5 8.5 0 0 0 0 17z', 's'),
    'brightness': C(12, 12, 4, 'fo', .6) + rays(12, 12, 6.5, 9.5),
    'curves': P('M4 3v17h17') + P('M4 20C10 20 9 6 20 4', 'a', w=2) + C(9.5, 13, 1.5, 's') + C(15, 6.5, 1.5, 's'),
    'exposure': R(3, 3, 18, 18, 2) + P('M3 21L21 3', w=1.2) + P('M6 8h4M8 6v4', 'a', w=2) + P('M14 16h4', w=2),
    'shadows': C(12, 12, 8.5) + P('M3.5 12a8.5 8.5 0 0 0 17 0z', 'f', .55),
    'hue-sat': wedges(12, 12, 8.5),
    'invert-alpha': CHECK4,
    'invert': R(3, 3, 18, 18, 2) + P('M21 3v18H3z', 'f', .7) + C(12, 12, 4),
    'levels': P('M3 20h18') + P('M3 20l3-6 3 3 4-9 3 5 2-3 3 10z', 'fo', .45),
    'posterize': R(3, 3, 18, 18, 2) + R(3, 3, 4.5, 18, 0, 'f', .2) + R(7.5, 3, 4.5, 18, 0, 'f', .45) + R(12, 3, 4.5, 18, 0, 'f', .7) + R(16.5, 3, 4.5, 18, 0, 'f', 1),
    'photo': R(3, 5, 18, 14, 2) + P('M3 17l5-5 4 4 3-3 6 6', 'fo', .5) + C(16, 9, 1.8, 'f'),
    'drop': P(DROP, 'fo', .45),
    'transparency': C(12, 12, 8.5) + P('M12 3.5v17M3.5 12h17', w=1) + P('M12 3.5a8.5 8.5 0 0 1 8.5 8.5H12zM12 12h-8.5a8.5 8.5 0 0 0 8.5 8.5z', 'f', .6),
    'temperature': P('M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z') + C(12, 16.5, 2.2, 'f') + P('M12 16V8', 'a', w=2) + P('M17 6h3M17 10h2', w=1.2),
    'vibrance': P(DROP, 'fo', .45) + star(19, 5, 3.4, k='s'),
    'gallery': R(3, 3, 8, 8, 1, 'fo', .25) + R(13, 3, 8, 8, 1, 'fo', .5) + R(3, 13, 8, 8, 1, 'fo', .75) + R(13, 13, 8, 8, 1),
    'repeat': P('M4 11V9a3 3 0 0 1 3-3h13M20 13v2a3 3 0 0 1-3 3H4') + P('M17 3l3 3-3 3M7 15l-3 3 3 3', 'a', w=2),
    'sliders': P('M4 6h16M4 12h16M4 18h16') + C(9, 6, 2.2, 'f') + C(15, 12, 2.2, 'f') + C(7, 18, 2.2, 'f'),
    # --- effets
    'palette': PALETTE,
    'ink': P('M4 20l3.5-1L18.5 8 16 5.5 5 16.5z', 'fo', .5) + P('M14 7.5l2.5 2.5M3 21h6'),
    'oil': R(3, 3, 13, 13, 1.5, 'fo', .25) + P('M21 9.5l-8.5 8.5', w=2.4) + P('M12.2 18.3c-1.6-.4-2.9.6-3 2.2-.1.6-.4 1-.9 1.2 1.6.4 3.3.1 4.1-.9.7-.8.5-1.8-.2-2.5z', 'f'),
    'pastel': P('M6 18L16 8l3 3L9 21H6z', 'fo', .5) + P('M16 8l2-2 3 3-2 2M6 18v3'),
    'sketch': P('M15.5 3.5l4 4L11 16l-4.5 1 1-4.5z', 'fo', .3) + P('M3 21c3-2 5 1 8-1s5 1 8-1', 'a', w=1.6),
    'ascii': R(3, 4, 18, 16, 2) + P('M7 9l3 3-3 3', 'a', w=2) + P('M12 15h5'),
    'halftone': ''.join(C(5 + 4.6 * i, 5 + 4.6 * j, 0.6 + 0.5 * (i + j) / 1.5, 'f') for i in range(4) for j in range(4)),
    'bokeh': C(8, 9, 4.5, 'fo', .3) + C(16, 8, 3, 'fo', .55) + C(14, 16, 5, 'fo', .2),
    'fragment': ''.join(C(x, y, 5, 'fo', .15) for x, y in ((10, 10), (14, 10), (10, 14), (14, 14))),
    'gaussian': C(12, 12, 9, 'f', .15) + C(12, 12, 6.5, 'f', .3) + C(12, 12, 4, 'fo', .75),
    'motion': P('M3 8h8M2 12h10M4 16h7') + C(16, 12, 4.5, 'fo', .6),
    'radial': C(12, 12, 2, 'f') + P('M12 5a7 7 0 0 1 7 7M12 19a7 7 0 0 1-7-7') + P('M16.5 3.5A10 10 0 0 1 21 9M7.5 20.5A10 10 0 0 1 3 15', 'a'),
    'sketch-blur': P('M4 7h16', op=None) + P('M4 12h16', 'a') + P('M4 17h16', w=1, extra=' stroke-opacity=".4"') + P('M4 9.5h16M4 14.5h16', w=1, extra=' stroke-opacity=".25"'),
    'square-blur': R(3, 3, 18, 18, 1, 'f', .15) + R(6, 6, 12, 12, 1, 'f', .3) + R(9, 9, 6, 6, 1, 'fo', .8),
    'surface': P('M3 14c3-3 6-3 9 0s6 3 9 0v6H3z', 'fo', .45) + P('M3 8c3-3 6-3 9 0s6 3 9 0'),
    'zoom-blur': rays(12, 12, 4, 9.5) + C(12, 12, 2.5, 'f'),
    'quantize': ''.join(R(3 + 6 * i, 3 + 6 * j, 5, 5, 1, 'fo', round(.15 + .1 * (i + 3 * j), 2)) for i in range(3) for j in range(3)),
    'chroma-key': R(3, 7, 8, 10, 1, 'fo', .8) + P('M12.5 12h3.5M14.5 10l2 2-2 2', w=1.6) + R(17, 7, 4, 10, 0, 'd'),
    'chromatic': C(10, 12, 6.5) + C(14, 12, 6.5, 'a', sw=1.9),
    'duotone': C(12, 12, 8.5) + P('M12 3.5a8.5 8.5 0 0 0 0 17z', 's') + P('M12 3.5a8.5 8.5 0 0 1 0 17z', 'f', .7),
    'cmyk': C(8, 8, 3.8, 'f') + C(16, 8, 3.8, 'f', .7) + C(8, 16, 3.8, 'f', .45) + C(16, 16, 3.8, 'fo', .15),
    'colormode': R(3, 3, 8, 8, 1, 'f') + R(13, 3, 8, 8, 1, 'f', .6) + R(3, 13, 8, 8, 1, 'f', .3) + R(13, 13, 8, 8, 1),
    'bulge': C(12, 12, 8.5) + P('M3.5 12h17M12 3.5v17', w=1) + P('M6 6.5c3.5 3 8.5 3 12 0M6 17.5c3.5-3 8.5-3 12 0', 'a'),
    'dents': P('M3 7c3-2 6 2 9 0s6-2 9 0M3 17c3-2 6 2 9 0s6-2 9 0') + P('M3 12c3-2 6 2 9 0s6-2 9 0', 'a', w=1.9),
    'crystal': P('M7 4h10l4 5-9 11L3 9z', 'fo', .35) + P('M3 9h18M9 4l3 5 3-5M12 9v11', w=1.1),
    'frosted': R(3, 3, 18, 18, 2) + ''.join(C(x, y, 1, 'f') for x, y in ((7, 7), (12, 6), (17, 8), (8, 12), (14, 11), (6, 17), (11, 16), (17, 15), (15, 19))),
    'morphology': P('M8 4c3-1 5 2 8 1s5 2 4 6-3 4-2 7-4 3-7 2-6 0-7-3 0-5-1-8 2-4 5-5z', 'fo', .45),
    'pixelate': ''.join(R(3 + 6 * i, 3 + 6 * j, 6, 6, 0, 'f', round(.2 + .25 * ((i + j) % 4), 2)) for i in range(3) for j in range(3)) + R(3, 3, 18, 18, 1),
    'polar': C(12, 12, 8.5) + C(12, 12, 3, 'fo', .5) + P('M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4', 'a', w=1.8),
    'tile': R(3, 3, 18, 18, 1) + P('M12 3v18M3 12h18') + P('M3 3l9 9V3zM21 21l-9-9v9z', 'f', .5),
    'twist': P('M12 12a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0 7.5 7.5 0 0 1 15 0', 'a', w=1.7) + C(12.8, 12, 1.2, 's'),
    'mirror4': C(12, 12, 8.5) + P('M12 3.5v17M3.5 12h17') + P('M12 3.5A8.5 8.5 0 0 1 20.5 12H12zM12 12H3.5a8.5 8.5 0 0 0 8.5 8.5z', 'f', .55),
    'cube': P('M12 3l8 4.5v9L12 21l-8-4.5v-9z') + P('M12 3l8 4.5-8 4.5-8-4.5z', 'fo', .45) + P('M12 12v9'),
    'wave': P('M3 8c3-3 6 3 9 0s6 3 9 0M3 18c3-3 6 3 9 0s6 3 9 0') + P('M3 13c3-3 6 3 9 0s6 3 9 0', 'a', w=1.9),
    'noise': ''.join(C(x, y, 1.15, 's') for x, y in ((5, 5), (13, 4), (19, 9), (7, 12), (16, 15), (4, 19), (11, 19)))
             + ''.join(C(x, y, 1.15, 'f') for x, y in ((9, 7), (17, 4), (12, 12), (20, 19), (6, 16))),
    'median': ''.join(C(x, y, 1.1, 's') for x, y in ((5, 6), (12, 5), (19, 7), (6, 18), (13, 19), (19, 17))) + P('M3 12h18', 'a', w=2),
    'denoise': ''.join(C(x, y, 1.1, 's') for x, y in ((5, 6), (10, 11), (6, 17), (13, 18))) + star(17, 7, 4.5),
    'dither': ''.join(R(3 + 4.5 * i, 3 + 4.5 * j, 4.5, 4.5, 0, 'f', .75) for i in range(4) for j in range(4) if (i + j) % 2 == 0) + R(3, 3, 18, 18, 1),
    'vhs': R(2.5, 5, 19, 14, 2) + C(8, 11, 2.3, 'fo', .7) + C(16, 11, 2.3, 'fo', .7) + P('M10.3 11h3.4M6 19l1.5-3h9L18 19'),
    'shadow': P('M16 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2h6a2 2 0 0 0 2-2z', 'f', .55) + R(4, 4, 12, 12, 2),
    'feather': C(12, 12, 9, 'f', .15) + C(12, 12, 7, 'f', .3) + C(12, 12, 5, 'fo', .8),
    'outline': R(6.5, 6.5, 11, 11, 2, 'fo', .35) + R(3, 3, 18, 18, 4.5, 'a', sw=1.9),
    'glow': star(12, 12, 7.5, inner=0.3) + rays(12, 12, 8.5, 10.5, 4),
    'red-eye': P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z') + C(12, 12, 3.4, 'f') + C(12, 12, 1.2, 's'),
    'sharpen': P('M12 3l9 17H3z', 'fo', .3) + P('M12 9.5v6', 'a', w=2),
    'portrait': C(12, 8, 4, 'fo', .4) + P('M4 21a8 8 0 0 1 16 0'),
    'dream': P('M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 9z', 'fo', .25) + star(19, 5, 3.2) + star(5, 5, 2.2),
    'edge-fade': R(3, 3, 18, 18, 2) + R(5.5, 5.5, 13, 13, 3, 'f', .3) + R(8, 8, 8, 8, 2, 'f', .7),
    'dust': P('M20 4l-8 8', w=2.2) + P('M12 12l-2-2-6 6c1 2 2.5 3.5 4.5 4.5l6-6z', 'fo', .45) + C(17, 16, 1, 'f') + C(20, 19, 1.2, 'f'),
    'straighten': R(3, 4, 18, 16, 2) + P('M3 15L21 9') + P('M3 12h18', 'a', extra=' stroke-dasharray="2.4 2"'),
    'vignette': P('M3 5h18v14H3zM12 7.5c-4 0-6.5 2-6.5 4.5S8 16.5 12 16.5s6.5-2 6.5-4.5S16 7.5 12 7.5z', 'f', .5, extra=' fill-rule="evenodd"') + R(3, 5, 18, 14, 2),
    'clouds': P('M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 9z', 'fo', .35),
    'checker': CHECK4,
    'julia': ''.join(C(12 + (7.5 - i) * math.cos(i * 1.1), 12 + (7.5 - i) * math.sin(i * 1.1), 2.6 - 0.28 * i, 'f', round(1 - .1 * i, 2)) for i in range(7)),
    'mandelbrot': C(14, 12, 6, 'fo', .45) + C(6.3, 12, 2.6, 'fo', .45) + C(2.8, 12, 1, 'f'),
    'turbulence': P('M3 8h11a3 3 0 1 0-3-3M3 16h14a3 3 0 1 1-3 3') + P('M3 12h17', 'a', w=1.9),
    'edges': R(3, 3, 18, 18, 2) + P('M3 17l5-6 4 4 3-3 6 6', 'a', w=1.9),
    'emboss': R(4, 4, 16, 16, 2) + P('M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4', w=1.1) + R(8, 8, 8, 8, 0, 'fo', .4),
    'contour': R(6, 6, 12, 12, 3, 'a', sw=1.9) + R(3, 3, 18, 18, 5.5),
    'relief': P('M2 20l6.5-11 4 6 3-4 6.5 9z', 'fo', .45),
    'solarize': C(12, 12, 4) + P('M12 8a4 4 0 0 1 0 8z', 'f') + rays(12, 12, 6.5, 9.5),
    'remove-bg': R(3, 3, 18, 18, 2, 'd') + C(12, 9, 3.5, 'f') + P('M5.5 21c0-4 3-6.5 6.5-6.5s6.5 2.5 6.5 6.5z', 'f'),
    'cutout-sel': R(3, 3, 18, 18, 1, 'd') + C(8, 16, 2.4, 'fo', .4) + C(16, 16, 2.4, 'fo', .4) + P('M9.8 14.4L16 6M14.2 14.4L8 6'),
    'content-fill': R(3, 3, 18, 18, 2) + R(8, 8, 8, 8, 0, 'd') + R(8, 8, 8, 8, 0, 'f', .55) + star(18.5, 5.5, 2.8, k='s'),
    'external': R(3, 6, 14, 14, 2) + P('M14 3h7v7M21 3l-9 9', 'a', w=2),
    'eye': P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z') + C(12, 12, 3.2, 'fo', .6),
    'restore': R(7, 3, 14, 12, 1.5) + R(3, 9, 14, 12, 1.5, 'fo', .3) + P('M3 13h14', w=1.2),
    'toolbox': ''.join(R(3 + 7 * i, 3 + 7 * j, 5.5, 5.5, 1.5, 'fo' if (i, j) == (1, 1) else 'o', .8) for i in range(3) for j in range(3)),
    'history': P('M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4.5H8') + P('M12 7.5V12l3 2', 'a', w=2),
    'film': R(3, 4, 18, 16, 2) + R(8, 7, 8, 10, 1, 'fo', .45) + P('M5.5 7v1M5.5 11.5v1M5.5 16v1M18.5 7v1M18.5 11.5v1M18.5 16v1', w=1.8),
    'sequence': R(7, 3, 14, 11, 1.5) + R(3, 8, 14, 13, 1.5, 'fo', .3) + P('M3 18l4-4 3 3 2-2 5 5', w=1.2),
}

# icônes du sprite reprises à la place des dessins ci-dessus (même nom, même rang)
REUSE = {
    'lasso': 'tool-direct-select', 'wand': 'tool-wand', 'lasso-magnetic': 'tool-magnetic-lasso',
    'lasso-poly': 'tool-poly-lasso', 'sel-none': 'sel-deselect', 'warp4': 'sel-free-corners',
    'deform': 'tool-deform', 'eyedropper': 'tool-eyedropper', 'brush': 'tool-brush', 'pencil': 'tool-pencil',
    'gradient': 'tool-gradient', 'bucket': 'tool-bucket', 'eraser': 'tool-eraser', 'text': 'tool-text',
    'shapes': 'tool-shapes-family', 'roundrect': 'shape-round', 'sel-invert': 'sel-invert', 'sel-all': 'sel-all',
    'align-left': 'sel-align-left', 'align-center-h': 'sel-center-h', 'align-right': 'sel-align-right',
    'align-top': 'sel-align-top', 'align-center-v': 'sel-center-v', 'align-bottom': 'sel-align-bottom',
    'align-center': 'sel-center-both', 'outside-canvas': 'outside-canvas', 'crop': 'img-crop',
    'rotate': 'img-rot-cw', 'border': 'image-border', 'canvas-size': 'image-extend', 'merge': 'layer-merge',
    'eye': 'svg-obj-visible',
}
for _k, _v in REUSE.items():
    ICONS[_k] = S(_v)

# icônes ajoutées (boutons, mode téléphone, Paramètres, Couleurs…) : à la suite, pour ne pas
# décaler les rangs déjà utilisés (welcome.slint s'en sert)
ICONS.update({
    'menu': P('M4 6h16M4 18h16') + P('M4 12h16', 'a'),
    'bug': R(7, 9, 10, 12, 5, 'fo') + C(12, 6.5, 2.6, 's') + P('M12 11.5v8.5', w=1.5)
           + P('M7 13H3.5M7 17.5l-3 2M17 13h3.5M17 17.5l3 2M7.6 10.2 4.8 8M16.4 10.2 19.2 8'),
    'filter': P('M3.5 4.5h17l-6.5 8v6.2l-4 2.3v-8.5z', 'fo'),
    'swap': P('M4 8h14', 'a') + P('M14.5 4.5 18 8l-3.5 3.5', 'a') + P('M20 16H6M9.5 12.5 6 16l3.5 3.5'),
    'plus': P('M12 4.5v15M4.5 12h15', 'a', w=2.8),
    'gauge': P('M3.5 17.5a8.5 8.5 0 1 1 17 0') + P('M6.2 11.3l1.4 1M12 6.5v1.8M17.8 11.3l-1.4 1')
             + P('M12 17.5l4.2-5.2', 'a', w=2.4) + C(12, 17.5, 2, 's'),
    'keyboard': R(2.5, 6, 19, 12.5, 2.2) + P('M6 10h.5M9.5 10h.5M13.5 10h.5M17.5 10h.5M6 14h.5M17.5 14h.5', w=2.4)
                + P('M9 14.2h6', 'a', w=2.4),
    'folder': P('M3 19V6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11z') + P('M3 10h18v9H3z', 'f'),
    'up': P('M12 20V5.5') + P('M6 11l6-6 6 6', 'a', w=2.4),
    'down': P('M12 4v14.5') + P('M6 13l6 6 6-6', 'a', w=2.4),
    'lock': R(5, 10.5, 14, 10, 2.2, 'fo') + P('M8 10.5V8a4 4 0 0 1 8 0v2.5') + C(12, 15.5, 1.5, 's'),
    'unlock': R(5, 10.5, 14, 10, 2.2) + P('M8 10.5V8a4 4 0 0 1 7.7-1.6') + C(12, 15.5, 1.5, 'f'),
    'trash-can': P('M4.5 6h15M9.5 6V4h5v2') + P('M6.5 6l1 14.5h9l1-14.5z', 'fo') + P('M10.2 10v6.5M13.8 10v6.5'),
    'brush-round': S('brush-round'), 'brush-soft': S('brush-soft'), 'brush-spray': S('brush-spray'),
    'brush-square': S('brush-square'), 'flip-h': S('img-flip-h'), 'flip-v': S('img-flip-v'),
    'rot-ccw': S('img-rot-ccw'), 'sym-x': S('sym-x'), 'sym-y': S('sym-y'),
    'quick-select': S('tool-quick-select'), 'object-select': S('tool-object-select'),
    'grad-linear': R(3, 5, 18, 14, 2) + R(4.5, 6.5, 5, 11, 0, 'f') + R(9.5, 6.5, 5, 11, 0, 'f', .5) + R(14.5, 6.5, 5, 11, 0, 'f', .2),
    'grad-diamond': P('M12 3l9 9-9 9-9-9z') + P('M12 7.5l4.5 4.5-4.5 4.5-4.5-4.5z', 'f'),
    'download': P('M4 15.5V20h16v-4.5') + P('M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5', 'a', w=2.4),
    'image': R(3, 5, 18, 14, 2) + P('M3.5 17.5l5-5.2 4 4 3-3 5 5.2z', 'f') + C(16, 9.2, 1.9, 's'),
    'signature': P('M3 17c2.5-5 4.5-9 6-9s-1.5 9 1 9 3-4 4.5-4 1 3 2.5 3 2-1 3-2') + P('M3 21h18', 'a'),
    'info': C(12, 12, 9) + C(12, 7.8, 1.5, 's') + P('M12 11v6', 'a', w=2.6),
    'warning': P('M12 3.5l9.5 16.5h-19z', 'fo') + P('M12 9.5v5', w=2.4) + C(12, 17.3, 1.3, 's'),
    'check': P('M4.5 12.5l5 5 10-11', 'a', w=2.8),
    'github': C(6, 5, 2.2, 'fo') + C(6, 19, 2.2, 'fo') + C(18, 7.5, 2.2, 'fo') + P('M6 7.2v9.6M18 9.7c0 4.5-7 3.5-11 7.6'),
    'web': C(12, 12, 9) + P('M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18', w=1.6) + C(12, 12, 9, 'a'),
    'book': P('M4 5.5C6.5 4 9.5 4 12 5.5v14c-2.5-1.5-5.5-1.5-8 0z', 'fo') + P('M20 5.5C17.5 4 14.5 4 12 5.5v14c2.5-1.5 5.5-1.5 8 0z'),
    'star': P('M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z', 'fo'),
    'sun': C(12, 12, 4, 'fo') + rays(12, 12, 6.8, 9.5),
    'moon': P('M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z', 'fo'),
    'layout': R(3, 4, 18, 16, 2) + P('M3 8.5h18M8.5 8.5V20') + R(8.5, 8.5, 12.5, 11.5, 0, 'f', .5),
    'ribbon': R(3, 4, 18, 16, 2) + P('M3 10h18') + R(5.5, 6, 3, 2, 0.5, 's') + R(10.5, 6, 3, 2, 0.5, 's') + R(15.5, 6, 3, 2, 0.5, 'f'),
    'phone': R(6.5, 2.5, 11, 19, 2.5) + P('M10.5 18.5h3', w=2.2) + R(8.5, 5, 7, 10.5, 1, 'f', .5),
})

# ------------------------------------------------------------------ correspondances

# outils / ruban : index du sprite d'origine (icons_gen.rs) → icône
SPEC_SVG = {0: 'lasso', 1: 'wand', 2: 'lasso-magnetic', 3: 'lasso-poly', 4: 'sel-none', 5: 'warp4', 6: 'deform',
            7: 'eyedropper', 8: 'brush', 9: 'pencil', 10: 'gradient', 11: 'bucket', 12: 'eraser', 13: 'text',
            14: 'shapes', 15: 'roundrect', 16: 'sel-invert', 17: 'sel-all', 18: 'align-left', 19: 'align-center-h',
            20: 'align-right', 21: 'align-top', 22: 'align-center-v', 23: 'align-bottom', 24: 'align-center',
            25: 'outside-canvas'}
# entrées de menu : libellé → icône
MENU = {
    'Nouveau...': 'new', 'Ouvrir / Importer image…': 'open', 'Exporter…': 'export', 'Photo Mode Pro…': 'camera',
    'Ouvrir projet dans Photo Mode Pro': 'camera', 'Espace de couleur :': 'colormode', 'Bitmap (Couleurs)': 'colormode',
    'Tramé (Noir et Blanc)': 'halftone', 'Couleurs RAL (Limité)': 'palette', 'Espace de travail CMJN': 'cmyk',
    'Fermer le projet actif…': 'close-doc', 'Paramètres…': 'settings', 'Historique des versions...': 'changelog',
    'Bienvenue / Informations…': 'about',
    'Annuler': 'undo', 'Rétablir': 'redo', 'Couper': 'cut', 'Copier': 'copy', 'Coller': 'paste',
    'Tout sélectionner': 'sel-all', 'Désélectionner': 'sel-none', 'Inverser la sélection': 'sel-invert',
    'Effacer sélection': 'trash', 'Étendre / réduire la sélection…': 'sel-grow', 'Vectoriser un bitmap…': 'vector',
    'Recadrage': 'crop', 'Régler la zone de travail à la sélection (Ctrl+Maj+X)': 'crop-sel', 'Redimensionner…': 'resize',
    'Recadrer (sélection sur la toile)…': 'crop', 'Étendre la zone de travail…': 'canvas-size', "Bordure d'image…": 'border',
    'Rotation et retournement…': 'rotate', 'Calque actif : position et taille…': 'layer-bounds',
    'Tampon du calque = dimensions de la toile': 'layer-buffer', 'Ajuster la page au contenu': 'fit-content',
    'Ajouter un calque': 'layer-add', 'Supprimer': 'layer-delete', 'Dupliquer le calque': 'layer-dup',
    'Monter le calque': 'layer-up', 'Descendre le calque': 'layer-down', 'Faire pivoter / Zoomer…': 'rotate',
    'Fusionner': 'merge', 'Séparer canaux RVB (3 calques)': 'columns', 'Centrer la sélection horizontalement': 'align-center-h',
    'Centrer la sélection verticalement': 'align-center-v', 'Centrer la sélection (H + V)': 'align-center',
    'Auto-niveau': 'auto-level', 'Noir et blanc': 'bw', 'Luminosité / Contraste…': 'brightness', 'Courbes…': 'curves',
    'Exposition…': 'exposure', 'Mises en lumière / Ombres…': 'shadows', 'Teinte / Saturation…': 'hue-sat',
    "Inverser l'Alpha": 'invert-alpha', 'Inverser les couleurs': 'invert', 'Niveaux…': 'levels', 'Postériser…': 'posterize',
    'Sépia': 'photo', 'Accent de couleur…': 'drop', 'Transparence…': 'transparency', 'Température / Teinte…': 'temperature',
    'Vibrance / Éclat…': 'vibrance', 'Camera Raw…': 'camera-raw', 'Galerie de Filtres…': 'gallery',
    'Artistique': 'palette', "Croquis à l'encre…": 'ink', "Peinture à l'huile…": 'oil', 'Pastel…': 'pastel',
    'Croquis au crayon…': 'sketch', 'Art ASCII…': 'ascii', 'Trame (Demi-teinte)…': 'halftone',
    'Flous': 'gaussian', 'Flou bokeh / Défocaliser…': 'bokeh', 'Fragment de flou…': 'fragment', 'Flou gaussien…': 'gaussian',
    'Flou de déplacement…': 'motion', 'Flou radial…': 'radial', "Flou d'esquisse…": 'sketch-blur', 'Flou carré…': 'square-blur',
    'Flou de surface…': 'surface', 'Flou de zoom…': 'zoom-blur',
    'Couleur': 'hue-sat', 'Quantifier…': 'quantize', 'Balance des couleurs…': 'sliders',
    'Incrustation (couleur → transparence)…': 'chroma-key', 'Aberration chromatique…': 'chromatic',
    'Séparer les canaux RVB…': 'channels', 'Duo-tone…': 'duotone', 'Conversion de couleur RAL…': 'palette',
    'Conversion de couleur CMJN…': 'cmyk',
    'Déformer': 'wave', 'Bosse…': 'bulge', 'Cabossage…': 'dents', 'Cristallisation…': 'crystal', 'Verre dépoli…': 'frosted',
    'Morphologie…': 'morphology', 'Pixéliser…': 'pixelate', 'Inversion polaire…': 'polar', 'Réflexion mosaïque…': 'tile',
    'Torsion…': 'twist', 'Miroir 4 secteurs…': 'mirror4', 'Projection 3D…': 'cube', 'Onde…': 'wave',
    'Bruit': 'noise', 'Ajouter du bruit…': 'noise', 'Médiane…': 'median', 'Réduire le bruit…': 'denoise',
    'Tramage numérique…': 'dither', 'Effet VHS…': 'vhs',
    'Objet': 'shadow', 'Ombre portée…': 'shadow', "Adoucir le contour de l'objet…": 'feather', "Contour d'objet…": 'outline',
    'Photo': 'camera', 'Éclat…': 'glow', 'Suppression des yeux rouges…': 'red-eye', 'Améliorer la netteté…': 'sharpen',
    'Adoucir le portrait…': 'portrait', 'Rêve…': 'dream', 'Fondu des bords…': 'edge-fade', 'Supprimer la poussière…': 'dust',
    'Redresser…': 'straighten', 'Vignette…': 'vignette',
    'Rendu': 'clouds', 'Nuages…': 'clouds', 'Grille / Damier…': 'checker', 'Fractale de Julia…': 'julia',
    'Fractale de Mandelbrot…': 'mandelbrot', 'Turbulence…': 'turbulence',
    'Styliser': 'edges', 'Détection des bords…': 'edges', 'Embosser…': 'emboss', 'Contour…': 'contour',
    'Mise en relief…': 'relief', 'Solariser…': 'solarize',
    'Détourage': 'cut', 'Supprimer le fond (IA)…': 'remove-bg', 'Détourage par sélection…': 'cutout-sel',
    'Remplissage contenu pris en compte…': 'content-fill',
    'Aperçu toile 1:1 (fenêtre)…': 'external', 'Grille de pixels': 'grid', 'Règles': 'rulers',
    'Aimantation des bords': 'magnet', 'Paramètres aimantation…': 'sliders', 'Toutes les options du ruban': 'eye',
    'Hors toile': 'outside-canvas', 'Réinitialiser le bureau...': 'restore', 'Outils': 'toolbox', 'Couleurs': 'palette',
    'Calques': 'layers', 'Historique': 'history', 'Objets SVG': 'vector', 'Animation (frise)': 'film',
    'Importer une séquence d’images (frames)…': 'sequence',
}
MENU.update({
    'Nouveau dossier': 'folder', 'Grouper dans un dossier': 'folder', 'Dégrouper': 'open',
    'Verrouiller / déverrouiller le calque': 'lock', 'Verrouiller le calque': 'lock',
    'Déverrouiller le calque': 'unlock', 'Pixelliser le calque': 'pixelate', 'Répéter Sépia': 'repeat',
    'Signaler un bug': 'bug', 'Effacer': 'trash', 'Grille': 'grid', 'Aimantation': 'magnet',
    'Palettes volantes (Paint.NET)': 'layout', 'Palettes : ancrage fixe (style Adobe)': 'layout',
    'Interface : mode téléphone (menu ☰, palettes en colonnes)': 'phone', 'Préréglages créatifs': 'gallery',
    'Supprimer le calque': 'layer-delete',
})

# glyphes Font Awesome sans ambiguïté → icône (boutons, menus, mode téléphone, Paramètres…)
COMMON = {
    'e494': 'new', 'f07c': 'open', 'f0c7': 'save', 'f02f': 'print', 'f2ea': 'undo', 'f2f9': 'redo',
    'f010': 'zoom-out', 'f00e': 'zoom-in', 'f0c5': 'copy', 'f0ea': 'paste', 'f1f8': 'trash', 'f2ed': 'trash-can',
    'f84c': 'grid', 'f545': 'rulers', 'f076': 'magnet', 'f0fe': 'sel-add', 'f146': 'sel-sub', 'f0c4': 'cut',
    'f019': 'export', 'f030': 'camera', 'f083': 'camera-raw', 'e5a1': 'close-doc', 'f013': 'settings',
    'f085': 'settings', 'f05a': 'about', 'f14a': 'sel-all', 'f410': 'sel-none', 'f5fd': 'layers',
    'f24d': 'layer-dup', 'f062': 'up', 'f063': 'down', 'f2f1': 'rotate', 'f248': 'merge', 'f247': 'fit-content',
    'f0db': 'channels', 'f53f': 'palette', 'f1da': 'history', 'f125': 'crop', 'f31e': 'resize', 'f363': 'repeat',
    'f201': 'curves', 'f185': 'brightness', 'f06e': 'eye', 'f35d': 'external', 'f1de': 'sliders',
    'f188': 'bug', 'f0c9': 'menu', 'f1fb': 'eyedropper', 'e2ca': 'wand', 'f1fc': 'brush', 'f303': 'pencil',
    'f575': 'bucket', 'f576': 'chroma-key', 'f12d': 'eraser', 'f031': 'text', 'f61f': 'shapes',
    'f03e': 'image', 'f302': 'sequence', 'f065': 'zoom-fit', 'f0b0': 'filter', 'f773': 'wave',
    'f042': 'bw', 'f3fd': 'gauge', 'f11c': 'keyboard', 'f362': 'swap', 'f067': 'plus', '2b': 'plus',
    'f023': 'lock', 'f09c': 'unlock', 'f07b': 'folder', 'f65e': 'folder', 'f05e': 'sel-none',
    'f071': 'warning', 'f09b': 'github', 'f0ac': 'web', 'f02d': 'book', 'f005': 'star', 'f186': 'moon',
    'f0eb': 'photo', 'f43c': 'checker', 'f2a1': 'halftone', 'f5c3': 'posterize', 'f4db': 'vhs',
    'f51a': 'denoise', 'f530': 'chromatic', 'f120': 'ascii', 'f1b2': 'cube', 'f390': 'restore',
    'f46d': 'changelog', 'f00c': 'check', 'f5cb': 'sel-rect', 'f047': 'move', 'f002': 'zoom',
}
# outils / barre rapide / ruban / boutons à IconSpec (Icon)
SPEC_FA = dict(COMMON, **{'f0c8': 'sel-new', 'f068': 'line', 'f12d': 'trash'})
# glyphes directs (GlyphIcon : pinceaux, dégradés, fenêtre Couleurs, téléphone, Paramètres…)
GLYPH = dict(COMMON, **{'f0c8': 'brush-square', 'f111': 'brush-round', 'f192': 'brush-soft',
                        'f5c7': 'brush-spray', 'f337': 'grad-linear', 'f219': 'grad-diamond'})
# entrées de menu absentes de la table (menu contextuel, entrées ajoutées) : d'après leur glyphe
MENU_FA = dict(COMMON, **{'f12d': 'trash', 'f2ed': 'layer-delete', 'f062': 'layer-up', 'f063': 'layer-down'})


# ------------------------------------------------------------------ écriture

MARK_A = '<!-- ===== Icônes MasterPaint Rust — générées par rust/masterpaint-ui/tools/gen_mpicons.py (ne pas modifier à la main) ===== -->'
MARK_B = '<!-- ===== fin des icônes MasterPaint Rust générées ===== -->'


def symbol(name, body):
    """symbole du sprite : grille 16 comme les autres, dessin d'origine en 24 réduit"""
    return (f'<symbol id="illu-icon-mp-{name}" viewBox="0 0 16 16">\n'
            f'  <g transform="scale(0.6666667)" fill="none" stroke="{ST}" stroke-width="{BASE_W}" '
            f'stroke-linecap="round" stroke-linejoin="round">{body}</g>\n</symbol>')


def template(view_box, inner):
    """symbole → modèle SVG pour l'application (mêmes marqueurs que gen_sprite.py)"""
    inner = re.sub(r'var\(--illu-icon-stroke[^)]*\)', '{STROKE}', inner)
    inner = re.sub(r'var\(--illu-icon-accent-subtle[^)]*\)', '{SUBTLE}', inner)
    inner = re.sub(r'var\(--illu-icon-accent[^)]*\)', '{ACCENT}', inner)
    inner = re.sub(r'var\(--illu-icon-bg[^)]*\)', '{BG}', inner)
    inner = inner.replace('currentColor', '{STROKE}')
    inner = re.sub(r'\s+', ' ', inner).strip()
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" fill="{{STROKE}}">{inner}</svg>'


def chain(cases, var, default='-1'):
    """chaîne de conditions Slint (fonction pure)"""
    return ''.join(f'\n            : {var} == {k} ? {v}' for k, v in cases)[len('\n            : '):] + f'\n            : {default}'


def chunks(cases, n=60):
    return [cases[i:i + n] for i in range(0, len(cases), n)] or [[]]


def main():
    names = list(ICONS)
    idx = {n: i for i, n in enumerate(names)}
    for m in (SPEC_SVG.values(), SPEC_FA.values(), MENU.values(), MENU_FA.values(), GLYPH.values()):
        for n in m:
            assert n in idx, n

    # 1. section générée du sprite (remplacée à chaque passage)
    src = open(SPRITE, encoding='utf-8').read()
    if MARK_A in src:
        a = src.index(MARK_A)
        b = src.index(MARK_B) + len(MARK_B)
        src = src[:a].rstrip() + '\n\n' + src[b:].lstrip()
    gen = [symbol(n, b) for n, b in ICONS.items() if not isinstance(b, S)]
    tail = src.rindex('</svg>')
    src = src[:tail].rstrip() + '\n\n' + MARK_A + '\n' + '\n'.join(gen) + '\n' + MARK_B + '\n\n</svg>\n'
    open(SPRITE, 'w', encoding='utf-8').write(src)

    # 2. modèles pour l'application : symboles du sprite (repris ou générés)
    syms = {sid: (attrs, inner) for sid, attrs, inner in
            re.findall(r'<symbol\s+id="illu-icon-([a-z0-9-]+)"([^>]*)>(.*?)</symbol>', src, re.S)}
    rs = ['// Fichier généré par tools/gen_mpicons.py — ne pas modifier à la main.',
          '/// Icônes maison (nom, modèle SVG au style du sprite) ; index = position dans `MpIcons.images`.',
          'pub const MP_ICONS: &[(&str, &str)] = &[']
    for n, b in ICONS.items():
        sid = b.sid if isinstance(b, S) else 'mp-' + n
        attrs, inner = syms[sid]
        vb = re.search(r'viewBox="([^"]+)"', attrs)
        rs.append('    ("{}", r##"{}"##),'.format(n, template(vb.group(1) if vb else '0 0 16 16', inner)))
    rs.append('];\n')
    open(os.path.join(CRATE, 'src', 'mpicons_gen.rs'), 'w', encoding='utf-8').write('\n'.join(rs))

    # 3. global Slint
    def q(s):
        return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

    def u(k):
        return f'"\\u{{{k}}}"'

    svg_cases = [(str(k), idx[v]) for k, v in SPEC_SVG.items()]
    fa_cases = [(u(k), idx[v]) for k, v in SPEC_FA.items()]
    menu_items = chunks([(q(k), idx[v]) for k, v in MENU.items()], 90)
    mfa_cases = [(u(k), idx[v]) for k, v in MENU_FA.items()]
    gl = chunks([(u(k), idx[v]) for k, v in GLYPH.items()])
    fns = []
    menu_expr = ' : '.join(f'menu-{i}(label) >= 0 ? menu-{i}(label)' for i in range(len(menu_items))) + ' : menu-fa(fa)'
    for i, c in enumerate(menu_items):
        fns.append(f'    pure function menu-{i}(l: string) -> int {{\n        return {chain(c, "l")};\n    }}')
    glyph_expr = ' : '.join(f'glyph-{i}(g) >= 0 ? glyph-{i}(g)' for i in range(len(gl))) + ' : -1'
    for i, c in enumerate(gl):
        fns.append(f'    pure function glyph-{i}(g: string) -> int {{\n        return {chain(c, "g")};\n    }}')
    sl = f'''// Fichier généré par tools/gen_mpicons.py — ne pas modifier à la main.
// Icônes maison de MasterPaint, au style du sprite (icons/illu-sprite.svg) : trait épais aux
// couleurs du thème, aplats à la couleur d'accentuation ; images rendues par theme.rs
// (render_icons) à chaque changement de ces couleurs. Les fonctions renvoient un index dans
// `images` (-1 : pas d'icône maison).
import {{ IconSpec }} from "types.slint";

export global MpIcons {{
    in property <[image]> images;
    /// icône d'un outil / d'un bouton de la barre rapide ou du ruban (sprite ou glyphe d'origine)
    public pure function for-spec(s: IconSpec) -> int {{
        return s.svg-index >= 0 ? by-svg(s.svg-index) : by-fa(s.fa);
    }}
    pure function by-svg(i: int) -> int {{
        return {chain(svg_cases, 'i')};
    }}
    pure function by-fa(g: string) -> int {{
        return {chain(fa_cases, 'g')};
    }}
    /// icône d'une entrée de menu, d'après son libellé puis son glyphe
    public pure function for-menu(label: string, fa: string) -> int {{
        return {menu_expr};
    }}
    pure function menu-fa(g: string) -> int {{
        return {chain(mfa_cases, 'g')};
    }}
    /// icône d'un glyphe Font Awesome posé directement (GlyphIcon) ; -1 : garder le glyphe
    public pure function for-glyph(g: string) -> int {{
        return {glyph_expr};
    }}
{chr(10).join(fns)}
}}
'''
    open(os.path.join(CRATE, 'ui', 'mpicons.slint'), 'w', encoding='utf-8').write(sl)
    print(len(names), 'icônes,', sum(isinstance(b, S) for b in ICONS.values()), 'reprises du sprite,', len(gen), 'générées')


if __name__ == '__main__':
    main()
