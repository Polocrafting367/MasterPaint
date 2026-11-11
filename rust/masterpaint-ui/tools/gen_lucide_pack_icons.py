# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Glyphes Font Awesome de l'interface sans équivalent dans les packs Paint.NET et Photoshop :
icône Lucide de même sens (Lucide, licence ISC, même famille que PhotoCraft), écrite dans
icon-packs/{photocraft,paintdotjs}/custom/<nom FA>.svg — SEULEMENT si le fichier n'existe pas
(les icônes dessinées ou retouchées à la main ne sont jamais touchées).
- PhotoCraft : Lucide tel quel (24 × 24, trait 2 px, couleur courante).
- Paint.NET : même dessin à la palette adoucie du pack (trait #386890, formes fermées #c0d8e8).
- Logos de systèmes : glyphe Font Awesome Brands (déjà fourni), à la couleur du pack.

  python3 -I gen_lucide_pack_icons.py /chemin/vers/lucide-react/dist/esm/icons

Relancer ensuite build_reference_packs.py.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKS = ROOT / 'icon-packs'
FA_DIR = PACKS / 'masterpaint' / 'source' / 'fontawesome'

# nom Font Awesome (fa_used_gen.rs) → icône Lucide de même sens
LUCIDE = {
    'arrows-left-right': 'move-horizontal', 'arrows-v': 'move-vertical', 'border-all': 'grid-3x3',
    'border-none': 'square-dashed', 'border-top-left': 'square-dashed-top-solid', 'braille': 'grip',
    'broom': 'brush-cleaning', 'camera-retro': 'camera', 'cancel': 'ban', 'caret-down': 'chevron-down',
    'caret-right': 'chevron-right', 'chess-board': 'grid-2x2', 'church': 'church', 'circle-notch': 'loader-circle',
    'clapperboard': 'clapperboard', 'clipboard-list': 'clipboard-list', 'clover': 'clover', 'dot-circle': 'circle-dot',
    'file-circle-xmark': 'file-x', 'file-export': 'file-output', 'file-video': 'file-video-camera',
    'file-zipper': 'file-archive', 'fingerprint': 'fingerprint-pattern', 'forward': 'fast-forward', 'glasses': 'glasses',
    'grip-lines': 'grip-horizontal', 'heart': 'heart', 'hurricane': 'tornado', 'language': 'languages',
    'lightbulb': 'lightbulb', 'line-chart': 'chart-line', 'mortar-board': 'graduation-cap', 'object-ungroup': 'ungroup',
    'search-minus': 'zoom-out', 'share-nodes': 'share-2', 'smog': 'cloud-fog', 'snowflake': 'snowflake',
    'spinner': 'loader', 'square-check': 'square-check', 'square-minus': 'square-minus', 'step-backward': 'skip-back',
    'step-forward': 'skip-forward', 'suitcase-rolling': 'luggage', 'table-columns': 'columns-2', 'tape': 'cassette-tape',
    'terminal': 'terminal', 'tint-slash': 'droplet-off', 'triangle-circle-square': 'shapes', 'turn-down': 'corner-right-down',
    'up-down': 'arrow-up-down', 'up-right-from-square': 'external-link', 'user': 'user',
    'vector-square': 'square-dashed-mouse-pointer', 'video': 'video', 'water': 'waves', 'wave-square': 'activity',
    'wind': 'wind', 'window-maximize': 'maximize-2', 'window-minimize': 'minimize-2', 'wrench': 'wrench', 'zap': 'zap',
    'uf3fd': 'gauge', 'arrow-right': 'arrow-right', 'bezier-curve': 'spline', 'chart-column': 'chart-column',
    'chevron-down': 'chevron-down', 'chevron-left': 'chevron-left', 'chevron-right': 'chevron-right',
    'chevron-up': 'chevron-up', 'circle': 'circle', 'circle-half-stroke': 'contrast', 'cloud-moon': 'cloud-moon',
    'diamond': 'diamond', 'draw-polygon': 'pentagon', 'eye-slash': 'eye-off', 'fast-backward': 'rewind',
    'folder-plus': 'folder-plus', 'forward-fast': 'fast-forward', 'gem': 'gem', 'link': 'link', 'list': 'list',
    'mountain': 'mountain', 'navicon': 'menu', 'pause': 'pause', 'pen-fancy': 'pen-tool', 'pen-nib': 'pen-tool',
    'play': 'play', 'slash': 'slash', 'unlink': 'unlink',
}
BRANDS = {'android', 'apple', 'linux', 'windows'}

HEAD = {
    'photocraft': '<!-- MasterPaint © 2026 polocrafting — icône Lucide « {src} » (licence ISC, voir LICENSE-lucide.txt) pour le pack PhotoCraft -->\n',
    'paintdotjs': '<!-- MasterPaint © 2026 polocrafting — d\'après l\'icône Lucide « {src} » (licence ISC, voir LICENSE-lucide.txt), palette du pack Paint.NET -->\n',
}
BRAND_HEAD = '<!-- MasterPaint © 2026 polocrafting — logo Font Awesome Brands « {src} » (CC BY 4.0), couleur du pack -->\n'
STROKE_PDN, FILL_PDN = '#386890', '#c0d8e8'


def lucide_nodes(icons_dir, name):
    """Éléments d'une icône Lucide (fichier .js de lucide-react) : [(balise, attributs)]."""
    src = (icons_dir / f'{name}.js').read_text()
    body = src[src.index('__iconNode = [') + len('__iconNode = '):]
    body = body[:body.index('];') + 1]
    nodes = []
    for tag, attrs in re.findall(r'\[\s*"(\w+)",\s*\{([^}]*)\}\s*\]', body):
        kv = dict(re.findall(r'(\w+):\s*"([^"]*)"', attrs))
        kv.pop('key', None)
        nodes.append((tag, kv))
    return nodes


def closed(tag, kv):
    """forme fermée (remplie de bleu clair dans le pack Paint.NET)"""
    if tag in ('rect', 'circle', 'ellipse', 'polygon'):
        return True
    return tag == 'path' and kv.get('d', '').strip().lower().endswith('z')


def svg(nodes, pdn):
    out = []
    for tag, kv in nodes:
        kv = dict(kv)
        if pdn and closed(tag, kv) and kv.get('fill') != 'none':
            kv.setdefault('fill', FILL_PDN)
        attrs = ' '.join(f'{k.replace("strokeWidth", "stroke-width")}="{v}"' for k, v in kv.items())
        out.append(f'<{tag} {attrs}/>')
    stroke = STROKE_PDN if pdn else 'currentColor'
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + stroke
            + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ''.join(out) + '</svg>')


def main():
    icons_dir = Path(sys.argv[1])
    fa_names = [n for _, n, _ in re.findall(r'\("\\u\{([0-9a-f]+)\}", "([^"]+)", "([^"]+)"\)',
                                            (ROOT / 'src' / 'fa_used_gen.rs').read_text())]
    for pack in ('photocraft', 'paintdotjs'):
        have = set(json.loads((PACKS / f'{pack}.json').read_text())['icons'])
        custom = PACKS / pack / 'custom'
        made = []
        for n in fa_names:
            f = custom / f'{n}.svg'
            if f'fa/{n}' in have or f.exists():
                continue
            if n in BRANDS:
                s = (FA_DIR / f'{n}.svg').read_text().split('-->', 1)[-1].strip()
                s = s.replace('{STROKE}', '#586070' if pack == 'paintdotjs' else 'currentColor')
                f.write_text(BRAND_HEAD.format(src=n) + s + '\n')
                made.append(n)
            elif n in LUCIDE:
                f.write_text(HEAD[pack].format(src=LUCIDE[n]) + svg(lucide_nodes(icons_dir, LUCIDE[n]), pack == 'paintdotjs') + '\n')
                made.append(n)
            else:
                print(f'  {pack} : pas d\'équivalent pour « {n} »')
        lic = PACKS / 'photocraft' / 'LICENSE-lucide.txt'
        if pack == 'paintdotjs' and made and lic.exists():
            (custom / 'LICENSE-lucide.txt').write_text(lic.read_text())
        print(pack, len(made), 'icônes ajoutées')


if __name__ == '__main__':
    main()
