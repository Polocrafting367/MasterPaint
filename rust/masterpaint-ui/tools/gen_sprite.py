"""Icônes du sprite de MasterPaint (icons/illu-sprite.svg, le même que la version web) pour
l'interface Slint : une propriété nommée par icône (Sprite.brush-round…), recolorée selon le
thème comme les icônes d'outils (variables CSS → marqueurs {STROKE}, {ACCENT}…).

  python3 -I gen_sprite.py ../../../icons/illu-sprite.svg

Écrit ../ui/sprite.slint et ../src/sprite_gen.rs.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CRATE = os.path.dirname(HERE)


def template(view_box, inner):
    inner = re.sub(r'var\(--illu-icon-stroke[^)]*\)', '{STROKE}', inner)
    inner = re.sub(r'var\(--illu-icon-accent-subtle[^)]*\)', '{SUBTLE}', inner)
    inner = re.sub(r'var\(--illu-icon-accent[^)]*\)', '{ACCENT}', inner)
    inner = re.sub(r'var\(--illu-icon-bg[^)]*\)', '{BG}', inner)
    inner = inner.replace('currentColor', '{STROKE}')
    inner = re.sub(r'\s+', ' ', inner).strip()
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" fill="{{STROKE}}">{inner}</svg>'


def main():
    src = open(sys.argv[1], encoding='utf-8').read()
    syms = re.findall(r'<symbol\s+id="illu-icon-([a-z0-9-]+)"([^>]*)>(.*?)</symbol>', src, re.S)
    names, svgs = [], []
    for name, attrs, inner in syms:
        # icônes maison générées par gen_mpicons.py (illu-icon-mp-…) : servies par MpIcons
        if name.startswith('mp-'):
            continue
        vb =re.search(r'viewBox="([^"]+)"', attrs)
        names.append(name)
        svgs.append(template(vb.group(1) if vb else '0 0 24 24', inner))
    sl = ['// Fichier généré par tools/gen_sprite.py (icons/illu-sprite.svg) — ne pas modifier à la main.',
          '/// Icônes du sprite MasterPaint, aux couleurs du thème (rendues par theme.rs).',
          'export global Sprite {']
    sl += [f'    in property <image> {n};' for n in names]
    sl.append('}')
    open(os.path.join(CRATE, 'ui', 'sprite.slint'), 'w', encoding='utf-8').write('\n'.join(sl) + '\n')
    rs = ['// Fichier généré par tools/gen_sprite.py (icons/illu-sprite.svg) — ne pas modifier à la main.',
          '/// (nom, modèle SVG) des icônes du sprite MasterPaint, dans l\'ordre de `apply`.',
          'pub const SPRITE: &[(&str, &str)] = &[']
    for n, s in zip(names, svgs):
        rs.append('    ("{}", r##"{}"##),'.format(n, s))
    rs += ['];', '', '/// Pose les images rendues (même ordre que SPRITE) dans le global Slint `Sprite`.',
           'pub fn apply(g: &crate::Sprite, imgs: Vec<slint::Image>) {', '    let mut it = imgs.into_iter();']
    rs += [f'    g.set_{n.replace("-", "_")}(it.next().unwrap_or_default());' for n in names]
    rs.append('}')
    open(os.path.join(CRATE, 'src', 'sprite_gen.rs'), 'w', encoding='utf-8').write('\n'.join(rs) + '\n')
    print(len(names), 'icônes')


main()
