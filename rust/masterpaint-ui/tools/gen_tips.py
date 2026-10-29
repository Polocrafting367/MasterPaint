"""Génère ui/tips.slint depuis tools/tips.json (descriptions des info-bulles, clé = titre)."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(here, 'tips.json'), encoding='utf-8'))
esc = lambda s: s.replace('\\', '\\\\').replace('"', '\\"')
out = ['// Généré par tools/gen_tips.py depuis tools/tips.json : descriptions des info-bulles (clé = titre).', 'export global Tips {', '    pure function desc(t: string) -> string {']
out += [f'        if (t == "{esc(k)}") {{ return "{esc(v)}"; }}' for k, v in T.items()]
out += ['        return "";', '    }', '}', '']
open(os.path.join(here, '..', 'ui', 'tips.slint'), 'w', encoding='utf-8').write('\n'.join(out))
