"""Génère les icônes et les données d'outils de l'interface Slint à partir d'un relevé
de l'interface web (ui_dump.json, produit dans le navigateur).

  python -I gen_icons.py ui_dump.json

Écrit : ../icons/*.svg (symboles du sprite SVG de index.html) et ../ui/generated.slint
(liste des outils, boutons de la barre rapide et du ruban, avec leur icône).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CRATE = os.path.dirname(HERE)
ICONS = os.path.join(CRATE, 'icons')


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def write_svg(name, view_box, inner):
    # Modèle : les variables CSS du sprite deviennent des marqueurs remplacés par le Rust
    # selon le thème ({STROKE} trait, {ACCENT}/{SUBTLE} accent, {BG} fond).
    inner = re.sub(r'var\(--illu-icon-stroke[^)]*\)', '{STROKE}', inner)
    inner = re.sub(r'var\(--illu-icon-accent-subtle[^)]*\)', '{SUBTLE}', inner)
    inner = re.sub(r'var\(--illu-icon-accent[^)]*\)', '{ACCENT}', inner)
    inner = re.sub(r'var\(--illu-icon-bg[^)]*\)', '{BG}', inner)
    inner = inner.replace('currentColor', '{STROKE}')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" fill="{{STROKE}}">{inner}</svg>'
    with open(os.path.join(ICONS, name + '.svg'), 'w', encoding='utf-8') as f:
        f.write(svg)


def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')


def icon_fields(icon, fallback_name):
    """→ (svg, fa_code, fa_weight) ; svg = nom de fichier ou ''"""
    if not icon:
        return '', '', 900
    if icon['kind'] == 'svg':
        return icon['id'].replace('illu-icon-', ''), '', 900
    if icon['kind'] == 'fa':
        return '', icon['code'], int(icon.get('weight') or 900)
    if icon['kind'] == 'inline':
        m = re.search(r'viewBox="([^"]+)"', icon['svg'])
        inner = re.sub(r'^<svg[^>]*>|</svg>$', '', icon['svg'].strip())
        write_svg(fallback_name, m.group(1) if m else '0 0 24 24', inner)
        return fallback_name, '', 900
    return '', '', 900


def main():
    d = json.load(open(sys.argv[1], encoding='utf-8-sig'))
    os.makedirs(ICONS, exist_ok=True)
    for sid, s in d['symbols'].items():
        write_svg(sid.replace('illu-icon-', ''), s['viewBox'] or '0 0 24 24', s['inner'])

    svgs = set()
    lines = ['// Fichier généré par tools/gen_icons.py — ne pas modifier à la main.',
             'import { IconSpec } from "types.slint";', '']

    order = []

    def spec(icon, name):
        svg, fa, wt = icon_fields(icon, name)
        idx = -1
        if svg:
            svgs.add(svg)
            if svg not in order:
                order.append(svg)
            idx = order.index(svg)
        code = f'"\\u{{{fa}}}"' if fa else '""'
        return f'{{ svg-index: {idx}, fa: {code}, fa-weight: {wt} }}'

    # outils : 2 colonnes, dans l'ordre visuel
    tools = sorted(d['tools'], key=lambda t: (t['y'], t['x']))
    # les entrées des menus déroulants (sélections, formes) chevauchent la grille : on les écarte
    flyout = {'tool-quick-select', 'tool-object-select', 'tool-rect', 'tool-triangle', 'tool-circle', 'tool-star'}
    tools = [t for t in tools if t['id'] and t['id'] not in flyout]
    x0 = min(t['x'] for t in tools)
    y0 = min(t['y'] for t in tools)
    lines.append('export global Generated {')
    entries = []
    for t in tools:
        name = slug(t['id'])
        entries.append(f'        {{ id: "{esc(t["id"])}", title: "{esc(t["title"])}", icon: {spec(t["icon"], name)}, '
                       f'x: {t["x"] - x0}px, y: {t["y"] - y0}px, w: {t["w"]}px, h: {t["h"]}px }}')
    lines.append('    out property <[{id: string, title: string, icon: IconSpec, x: length, y: length, w: length, h: length}]> tools: [')
    lines.append(',\n'.join(entries))
    lines.append('    ];')

    quick = [t for t in d['top'] if t['y'] < 50]
    entries = []
    for t in quick:
        name = slug(t['id'] or t['title'])
        entries.append(f'        {{ id: "{esc(t["id"] or slug(t["title"]))}", title: "{esc(t["title"])}", label: "{esc(t["label"])}", '
                       f'icon: {spec(t["icon"], name)}, x: {t["x"]}px }}')
    lines.append('    out property <[{id: string, title: string, label: string, icon: IconSpec, x: length}]> quick: [')
    lines.append(',\n'.join(entries))
    lines.append('    ];')

    ribbon = [t for t in d['top'] if t['y'] >= 50]
    entries = []
    for t in ribbon:
        name = slug(t['id'] or t['title'])
        entries.append(f'        {{ id: "{esc(t["id"] or slug(t["title"]))}", title: "{esc(t["title"])}", label: "{esc(t["label"])}", '
                       f'icon: {spec(t["icon"], name)}, x: {t["x"]}px, y: {t["y"] - 52}px, w: {t["w"]}px, h: {t["h"]}px }}')
    lines.append('    out property <[{id: string, title: string, label: string, icon: IconSpec, x: length, y: length, w: length, h: length}]> ribbon: [')
    lines.append(',\n'.join(entries))
    lines.append('    ];')

    # barre classique Paint.NET : le contenu du ruban aplati en une rangée,
    # « Groupe : » puis ses boutons (chaque bouton rattaché au libellé de groupe le plus proche)
    groups = [g for g in d['groups'] if g['label'] != 'Outil']
    centre = lambda g: g['x'] + g['w'] / 2
    entries = ['        { kind: 1, id: "", label: "Outil :", icon: ' + spec(None, '') + ' }',
               '        { kind: 0, id: "tool-picker", label: "", icon: { svg-index: -1, fa: "\\u{f5cb}", fa-weight: 900 } }']
    for g in groups:
        members = [t for t in ribbon if min(groups, key=lambda h: abs(centre(h) - (t['x'] + t['w'] / 2))) is g]
        entries.append('        { kind: 2, id: "", label: "", icon: ' + spec(None, '') + ' }')
        entries.append(f'        {{ kind: 1, id: "", label: "{esc(g["label"])} :", icon: ' + spec(None, '') + ' }')
        for t in members:
            entries.append(f'        {{ kind: 0, id: "{esc(t["id"] or slug(t["title"]))}", label: "", icon: {spec(t["icon"], slug(t["id"] or t["title"]))} }}')
    lines.append('    out property <[{kind: int, id: string, label: string, icon: IconSpec}]> classic: [')
    lines.append(',\n'.join(entries))
    lines.append('    ];')

    entries = [f'        {{ label: "{esc(g["label"])}", x: {g["x"]}px, w: {g["w"]}px }}' for g in d['groups']]
    lines.append('    out property <[{label: string, x: length, w: length}]> ribbon-groups: [')
    lines.append(',\n'.join(entries))
    lines.append('    ];')
    # menus complets (relevé menus.json : libellés, icônes, raccourcis, actions, sous-menus)
    if len(sys.argv) > 2:
        md = json.load(open(sys.argv[2], encoding='utf-8-sig'))
        # raccourcis de MasterPaint absents du HTML des menus (gérés par Listener.js)
        known = {'showNewProjectDialog': 'Ctrl+N', 'illuTriggerFileImport': 'Ctrl+O', 'showExportDialog': 'Ctrl+Maj+S',
                 'undo()': 'Ctrl+Z', 'redo()': 'Ctrl+Y', 'cropToSelection': 'Ctrl+Maj+X', 'duplicateActiveLayer': 'Ctrl+Maj+D'}

        def shortcut(it):
            s = it.get('shortcut') or ''
            if not s:
                for k, v in known.items():
                    if k in (it.get('action') or ''):
                        s = v
            return s

        def sub_items(children):
            def fa_of(c):
                return f'"\\u{{{c["fa"]}}}"' if c.get('fa') else '""'
            return '[' + ', '.join(f'{{ label: "{esc(c["label"])}", action: "{esc(c.get("action") or "")}", badge: "", '
                                   f'fa: {fa_of(c)}, fa-weight: {int(c.get("faw") or 900)} }}' for c in children) + ']'

        menus = []
        for m in md['menus']:
            items = []
            for it in m['items']:
                if it.get('sep'):
                    items.append('{ label: "", separator: true, submenu: false, fa: "", fa-weight: 900, shortcut: "", action: "", children: [], badge: "" }')
                    continue
                fa = it.get('fa') or ''
                code = f'"\\u{{{fa}}}"' if fa else '""'
                kids = it.get('children') or []
                items.append(f'{{ label: "{esc(it["label"])}", separator: false, submenu: {"true" if kids else "false"}, '
                             f'fa: {code}, fa-weight: {int(it.get("faw") or 900)}, shortcut: "{esc(shortcut(it))}", '
                             f'action: "{esc(it.get("action") or "")}", children: {sub_items(kids)}, badge: "" }}')
            while items and 'separator: true' in items[-1]:
                items.pop()
            menus.append(f'        {{ title: "{esc(m["title"])}", items: [\n            ' + ',\n            '.join(items) + '\n        ] }')
        lines.append('    out property <[MenuSpec]> menus: [')
        lines.append(',\n'.join(menus))
        lines.append('    ];')
        cols = []
        for c in md['palette']:
            r, g, b = [int(v) for v in re.findall(r'\d+', c)[:3]]
            cols.append(f'#{r:02x}{g:02x}{b:02x}')
        lines.append('    out property <[color]> palette: [' + ', '.join(cols) + '];')
        lines[1] = 'import { IconSpec, MenuSpec } from "types.slint";'

    # fenêtres de réglage des effets (relevé dialogs.json) → src/effects_gen.rs
    if len(sys.argv) > 3:
        dd = json.load(open(sys.argv[3], encoding='utf-8-sig'))
        fallback = {'ef-cb-chan-sel': 'Canal', 'ef-vhs-jpeg_quality': 'Qualité JPEG'}
        # clés de traduction absentes du dictionnaire de la version web, et libellés R/V/B relevés « R »
        keyfix = {'chroma.useKey2': '2e couleur clé', 'chroma.lumaProt': 'Protection des lumières', 'chroma.recover': 'Récupération des détails'}
        rgbfix = {'ef-ch-r': 'R', 'ef-ch-g': 'V', 'ef-ch-b': 'B', 'ef-ch-r2': 'R', 'ef-ch-g2': 'V', 'ef-ch-b2': 'B'}
        sections = []
        rs = ['// Fichier généré par tools/gen_icons.py (relevé des fenêtres d\'effets de la version web).',
              '// Ne pas modifier à la main.', 'use crate::effects::Field;', '',
              '/// (effet, titre, champs) — mêmes identifiants `ef-…` que les fenêtres HTML.',
              'pub const DIALOGS: &[(&str, &str, &[Field])] = &[']

        def rstr(s):
            return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"'

        for eid, v in dd.items():
            if v.get('direct') or v.get('error'):
                continue
            fields = []
            for f in v.get('fields', []):
                if f['id'].startswith('ef-hsv-mix-'):
                    continue  # mélangeur TSL par teinte : fenêtre dédiée plus tard
                label = f['label'] or fallback.get(f['id'], f['id'][3:])
                label = rgbfix.get(f['id'], keyfix.get(label, label))
                sec = (f.get('section') or '').lstrip('▼▶ ').strip()
                if sec:
                    sections.append(f'    ({rstr(eid)}, {rstr(f["id"])}, {rstr(sec)}, {"true" if f.get("collapsed") else "false"}),')
                kind, mn, mx, st, de, ds, opts = 0, 0.0, 1.0, 1.0, 0.0, '', []
                if f['type'] in ('range', 'number'):
                    kind, mn, mx, st, de = 0, f.get('min', 0), f.get('max', 100), f.get('step', 1) or 1, f.get('value', 0)
                    if mx <= mn:
                        mx = mn + 100
                elif f['type'] == 'checkbox':
                    kind, de = 1, f.get('value', 0)
                elif f['type'] == 'select':
                    kind, opts = 2, f.get('options', [])
                    ds = str(f.get('value', ''))
                    de = next((i for i, o in enumerate(opts) if o[0] == ds), 0)
                elif f['type'] == 'color':
                    kind, ds = 3, f.get('value', '#000000')
                else:
                    kind, ds = 4, str(f.get('value', ''))
                ol = ', '.join(f'({rstr(a)}, {rstr(b)})' for a, b in opts)
                fields.append(f'        Field {{ id: {rstr(f["id"])}, label: {rstr(label)}, kind: {kind}, min: {float(mn)}, max: {float(mx)}, '
                              f'step: {float(st)}, def: {float(de)}, def_s: {rstr(ds)}, options: &[{ol}] }},')
            rs.append(f'    ({rstr(eid)}, {rstr(v.get("title", eid))}, &[')
            rs += fields
            rs.append('    ]),')
        rs.append('];')
        rs += ['', '/// (effet, champ, section, repliée au départ) — groupes des fenêtres HTML.',
               'pub const SECTIONS: &[(&str, &str, &str, bool)] = &['] + sections + ['];']
        with open(os.path.join(CRATE, 'src', 'effects_gen.rs'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(rs) + '\n')
    lines.append('}')

    with open(os.path.join(CRATE, 'ui', 'generated.slint'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    # modèles SVG embarqués dans le binaire, dans l'ordre des svg-index
    rs = ['// Fichier généré par tools/gen_icons.py — ne pas modifier à la main.',
          '/// Modèles SVG des icônes (index = `svg-index` de l\'interface).',
          'pub const ICONS: &[&str] = &[']
    rs += [f'    include_str!("../icons/{n}.svg"),' for n in order]
    rs.append('];')
    with open(os.path.join(CRATE, 'src', 'icons_gen.rs'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(rs) + '\n')
    missing = [s for s in svgs if not os.path.exists(os.path.join(ICONS, s + '.svg'))]
    print(len(tools), 'outils,', len(quick), 'rapides,', len(ribbon), 'ruban,', len(os.listdir(ICONS)), 'svg, manquants:', missing)


if __name__ == '__main__':
    main()
