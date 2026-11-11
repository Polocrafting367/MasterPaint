# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Pack MasterPaint complet : chaque glyphe Font Awesome de l'interface a son icône au style
MasterPaint (trait de 2,1 px, aplats d'accent). Soit une icône maison existante (FA_TO_MP), soit
un dessin écrit ici dans icon-packs/masterpaint/source/fa-equiv/<nom Font Awesome>.svg.
Les logos de marques (Android, Apple, Linux, Windows) restent ceux de Font Awesome.
Produit src/mp_fa_gen.rs : (nom Font Awesome, modèle SVG)."""
import re
from pathlib import Path

UI = Path(__file__).resolve().parents[1]
SRC = UI / 'icon-packs' / 'masterpaint' / 'source'
OUT = SRC / 'fa-equiv'

FA_TO_MP = {
    'arrow-down': 'down', 'arrow-up': 'up', 'arrows': 'move', 'up-down-left-right': 'move',
    'arrows-left-right': 'swap', 'exchange': 'swap', 'left-right': 'swap', 'right-left': 'swap',
    'camera-retro': 'camera', 'chess-board': 'checker', 'circle-half-stroke': 'bw', 'clock': 'history',
    'clone': 'layer-dup', 'cloud': 'clouds', 'cloud-moon': 'moon', 'draw-polygon': 'lasso-poly',
    'expand': 'zoom-fit', 'maximize': 'zoom-fit', 'file-circle-plus': 'new', 'file-circle-xmark': 'close-doc',
    'file-export': 'export', 'file-image': 'image', 'fill': 'bucket', 'fill-drip': 'bucket', 'folder-open': 'open',
    'font': 'text', 'gear': 'settings', 'gears': 'settings', 'info-circle': 'info', 'layer-group': 'layers',
    'line-chart': 'curves', 'list': 'menu', 'navicon': 'menu', 'object-group': 'sel-all', 'paintbrush': 'brush',
    'pen-fancy': 'vector', 'pen-nib': 'vector', 'bezier-curve': 'vector', 'rotate-right': 'rotate',
    'ruler': 'rulers', 'ruler-horizontal': 'rulers', 'scissors': 'cut', 'search': 'zoom', 'search-plus': 'zoom-in',
    'search-minus': 'zoom-out', 'square-plus': 'plus', 'uf067': 'plus', 'square-minus': 'minus', 'swatchbook': 'palette',
    'sync': 'repeat', 'sync-alt': 'repeat', 'th': 'grid', 'th-large': 'gallery', 'border-all': 'grid',
    'thermometer-half': 'temperature', 'tint': 'drop', 'undo-alt': 'undo', 'up-right-and-down-left-from-center': 'resize',
    'up-right-from-square': 'external', 'vector-square': 'layer-bounds', 'wand-magic': 'wand', 'wand-magic-sparkles': 'fx',
    'table-columns': 'columns', 'subtract': 'minus', 'braille': 'dither', 'hurricane': 'twist', 'water': 'wave',
    'wind': 'motion', 'snowflake': 'crystal', 'globe': 'web', 'triangle-circle-square': 'shapes', 'clapperboard': 'film',
    'uf3fd': 'gauge', 'chart-column': 'levels', 'smog': 'dust',
}

A = '{ACCENT}'
DRAW = {
    # main ouverte (outil Main : déplacer la vue)
    'hand': '<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M10 10V4a1.5 1.5 0 0 1 3 0v6"/><path d="M13 10V5a1.5 1.5 0 0 1 3 0v6"/><path d="M16 11V8a1.5 1.5 0 0 1 3 0v6.5A6.5 6.5 0 0 1 12.5 21h-1a6 6 0 0 1-4.6-2.2L4 15a1.6 1.6 0 0 1 2.3-2.2L7 13.5" fill="' + A + '"/>',
    'arrow-right': '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
    'arrows-v': '<path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/>',
    'up-down': '<path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/>',
    'border-none': '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="2 3"/>',
    'border-top-left': '<path d="M3 21V5a2 2 0 0 1 2-2h16"/><path d="M21 8v11a2 2 0 0 1-2 2H8" stroke-dasharray="2 3"/>',
    'broom': '<path d="m19 3-7.5 7.5"/><path d="M11 10l3 3-4.5 7.5c-2.5 0-6-2-6.5-6.5z" fill="' + A + '"/>',
    'caret-down': '<path d="M6 9h12l-6 7z" fill="{STROKE}"/>',
    'caret-right': '<path d="M9 6v12l7-6z" fill="{STROKE}"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>', 'chevron-up': '<path d="m6 15 6-6 6 6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>', 'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'circle': '<circle cx="12" cy="12" r="9" fill="' + A + '"/>',
    'circle-notch': '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
    'spinner': '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    'comment': '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2-5.3A8.5 8.5 0 1 1 21 11.5z" fill="' + A + '"/>',
    'desktop': '<rect x="2" y="3" width="20" height="14" rx="2" fill="' + A + '"/><path d="M8 21h8M12 17v4"/>',
    'diamond': '<path d="m12 2 10 10-10 10L2 12z" fill="' + A + '"/>',
    'gem': '<path d="M6 3h12l4 6-10 13L2 9z" fill="' + A + '"/><path d="M2 9h20M12 22 8 9l4-6 4 6z"/>',
    'dot-circle': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="' + A + '"/>',
    'eye-slash': '<path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.5M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.5"/><circle cx="12" cy="12" r="3" fill="' + A + '"/><path d="M3 21 21 3"/>',
    'tint-slash': '<path d="M12 3c3.5 4.5 6 7.7 6 10.5a6 6 0 0 1-12 0C6 10.7 8.5 7.5 12 3z" fill="' + A + '"/><path d="M3 21 21 3"/>',
    'fast-backward': '<path d="M4 5v14"/><path d="M12 12 20 6v12z" fill="' + A + '"/><path d="M5 12l7-6v12z" fill="' + A + '"/>',
    'forward-fast': '<path d="M20 5v14"/><path d="M12 12 4 6v12z" fill="' + A + '"/><path d="M19 12l-7-6v12z" fill="' + A + '"/>',
    'forward': '<path d="M12 12 4 6v12z" fill="' + A + '"/><path d="M20 12l-8-6v12z" fill="' + A + '"/>',
    'step-backward': '<path d="M6 5v14"/><path d="M18 6v12l-9-6z" fill="' + A + '"/>',
    'step-forward': '<path d="M18 5v14"/><path d="M6 6v12l9-6z" fill="' + A + '"/>',
    'play': '<path d="M7 4v16l13-8z" fill="' + A + '"/>',
    'pause': '<rect x="6" y="4" width="4" height="16" rx="1" fill="' + A + '"/><rect x="14" y="4" width="4" height="16" rx="1" fill="' + A + '"/>',
    'folder-plus': '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="' + A + '"/><path d="M12 10v6M9 13h6"/>',
    'glasses': '<circle cx="6.5" cy="15" r="3.5" fill="' + A + '"/><circle cx="17.5" cy="15" r="3.5" fill="' + A + '"/><path d="M10 15h4"/><path d="M3 15 5 6h2M21 15l-2-9h-2"/>',
    'fingerprint': '<path d="M12 11v3a8 8 0 0 1-2 5"/><path d="M8 10a4 4 0 0 1 8 0v3"/><path d="M4.5 13a7.5 7.5 0 0 1 15-3v3a12 12 0 0 1-1 4"/><path d="M15.5 17a10 10 0 0 1-1.3 3"/>',
    'heart': '<path d="M12 20s-8-5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15 12 20 12 20z" fill="' + A + '"/>',
    'images': '<rect x="6" y="3" width="15" height="13" rx="2"/><rect x="3" y="7" width="15" height="13" rx="2" fill="' + A + '"/><path d="m6 17 4-4 3 3 2-2 3 3"/>',
    'lightbulb': '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 3.5 10.9c-.6.5-1 1.2-1 2V16h-5v-.1c0-.8-.4-1.5-1-2A6 6 0 0 1 12 3z" fill="' + A + '"/>',
    'link': '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    'unlink': '<path d="M14 6 15 5a4 4 0 0 1 6 6l-1 1M10 18l-1 1a4 4 0 0 1-6-6l1-1"/><path d="M8 3v3M3 8h3M16 21v-3M21 16h-3"/>',
    'mountain': '<path d="m2 20 7-12 4 6 3-4 6 10z" fill="' + A + '"/>',
    'object-ungroup': '<rect x="3" y="3" width="11" height="11" rx="1"/><rect x="10" y="10" width="11" height="11" rx="1" fill="' + A + '"/>',
    'share-nodes': '<circle cx="18" cy="5" r="3" fill="' + A + '"/><circle cx="6" cy="12" r="3" fill="' + A + '"/><circle cx="18" cy="19" r="3" fill="' + A + '"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    'slash': '<path d="M5 19 19 5"/>',
    'square': '<rect x="4" y="4" width="16" height="16" rx="2" fill="' + A + '"/>',
    'square-check': '<rect x="3" y="3" width="18" height="18" rx="2" fill="' + A + '"/><path d="m8 12 3 3 5-6"/>',
    'tape': '<circle cx="9" cy="12" r="6" fill="' + A + '"/><circle cx="9" cy="12" r="2"/><path d="M9 18h12"/>',
    'terminal': '<rect x="2" y="4" width="20" height="16" rx="2" fill="' + A + '"/><path d="m6 9 3 3-3 3M11 15h6"/>',
    'turn-down': '<path d="M5 4h7a4 4 0 0 1 4 4v12"/><path d="m12 16 4 4 4-4"/>',
    'user': '<circle cx="12" cy="8" r="4" fill="' + A + '"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'window-maximize': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18" stroke-width="3"/>',
    'window-minimize': '<path d="M5 19h14"/>',
    'window-close': '<path d="M6 6l12 12M18 6 6 18"/>',
    'xmark': '<path d="M6 6l12 12M18 6 6 18"/>',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" fill="' + A + '"/>',
    'zap': '<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="' + A + '"/>',
    'clover': '<path d="M12 12c-4 0-6-2-6-4a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 2-2 4-6 4zM12 12c-4 0-6 2-6 4a3 3 0 0 0 6 1 3 3 0 0 0 6-1c0-2-2-4-6-4z" fill="' + A + '"/><path d="M12 12 18 21"/>',
    'clipboard-list': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" fill="' + A + '"/><path d="M9 11h6M9 15h6"/>',
    'stamp': '<path d="M9 3h6l-1 8h-4z"/><path d="M4 14h16v4H4z" fill="' + A + '"/><path d="M6 21h12"/>',
    'wave-square': '<path d="M2 12h4V6h6v12h6v-6h4"/>',
}
BRANDS = {'android', 'apple', 'linux', 'windows', 'ufeff'}

HEAD = '<!-- MasterPaint © 2026 polocrafting — https://polocrafting.fr -->\n'
WRAP = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="{STROKE}"><g transform="scale(0.6666667)" '
        'fill="none" stroke="{STROKE}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">%s</g></svg>')

if __name__ == '__main__':
    used = [n for n in re.findall(r'\("\\u\{[0-9a-f]+\}", "([^"]+)", "[^"]+"\)', (UI / 'src/fa_used_gen.rs').read_text())]
    mp = set(re.findall(r'^    \("([^"]+)"', (UI / 'src/mpicons_gen.rs').read_text(), re.M))
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.svg'):
        old.unlink()
    rows, missing = [], []
    for n in used:
        if n in BRANDS:
            continue
        target = n if n in mp else FA_TO_MP.get(n)
        if target in mp:
            rows.append((n, f'../icon-packs/masterpaint/source/masterpaint/{target}.svg'))
        elif n in DRAW:
            (OUT / f'{n}.svg').write_text(HEAD + WRAP % DRAW[n] + '\n')
            rows.append((n, f'../icon-packs/masterpaint/source/fa-equiv/{n}.svg'))
        else:
            missing.append(n)
    (UI / 'src/mp_fa_gen.rs').write_text(
        '// Fichier généré par tools/gen_mp_fa_icons.py — ne pas modifier à la main.\n'
        '/// Icône au style MasterPaint de chaque glyphe Font Awesome de l\'interface (nom FA, modèle SVG).\n'
        'pub const MP_FA: &[(&str, &str)] = &[\n' + ''.join(f'    ("{n}", include_str!("{p}")),\n' for n, p in rows) + '];\n')
    print(len(rows), 'glyphes au style MasterPaint ;', len(list(OUT.glob('*.svg'))), 'dessins nouveaux ; sans équivalent :', missing)
