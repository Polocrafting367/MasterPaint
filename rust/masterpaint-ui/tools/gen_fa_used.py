# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Glyphes Font Awesome employés par l'interface (ui/*.slint, src/*.rs) avec leur nom, pour la
section « Non personnalisées » de la Visionneuse d'icônes (ceux sans icône maison MpIcons sont
repérés à l'exécution).

  python3 -I gen_fa_used.py

Écrit ../src/fa_used_gen.rs.
"""
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CRATE = os.path.dirname(HERE)
FA = os.path.normpath(os.path.join(CRATE, '..', '..', 'icons', 'fa-icons.json'))


def main():
    names = {}
    for e in json.load(open(FA, encoding='utf-8')):
        names.setdefault(e['code'].lower(), (e['name'], e.get('style', 'solid')))
    used = set()
    for f in glob.glob(os.path.join(CRATE, 'ui', '*.slint')) + glob.glob(os.path.join(CRATE, 'src', '*.rs')):
        base = os.path.basename(f)
        # tables de correspondance des icônes maison / ce fichier : pas des emplois
        if base in ('mpicons.slint', 'mpicons_gen.rs', 'fa_used_gen.rs'):
            continue
        for m in re.finditer(r'\\u\{([ef][0-9a-fA-F]{3})\}', open(f, encoding='utf-8').read()):
            # U+FEFF : caractère invisible (marque d'ordre des octets), pas une icône
            if m.group(1).lower() != 'feff':
                used.add(m.group(1).lower())
    rows = sorted(used, key=lambda c: names.get(c, ('~' + c,))[0])
    out = ['// Fichier généré par tools/gen_fa_used.py — ne pas modifier à la main.',
           '/// Glyphes Font Awesome employés par l\'interface : (glyphe, nom, style).',
           'pub const FA_USED: &[(&str, &str, &str)] = &[']
    for c in rows:
        n, st = names.get(c, ('u' + c, 'solid'))
        out.append(f'    ("\\u{{{c}}}", "{n}", "{st}"),')
    out.append('];')
    open(os.path.join(CRATE, 'src', 'fa_used_gen.rs'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(len(rows), 'glyphes')


main()
