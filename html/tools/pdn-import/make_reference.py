"""
Construit docs/pdn-effects-reference.md à partir du JSON produit par extract_effect_props.py :
pour chaque effet Paint.NET 5, ses réglages (libellé FR, type, défaut, min, max, contrôle).

Usage : python -I make_reference.py pdn_effects.json res_fr.tsv docs/pdn-effects-reference.md
"""
import json, sys

data = json.load(open(sys.argv[1], encoding='utf-8'))
res = {}
for ln in open(sys.argv[2], encoding='utf-8'):
    k, _, v = ln.rstrip('\n').partition('\t')
    res[k] = v.replace('&', '')

# nom affiché de l'effet : <Nom>Effect.Name dans les ressources
def effect_name(cls):
    base = cls.replace('GpuEffect', 'Effect')
    for k in (base + '.Name', base.replace('Effect', '') + 'Effect.Name'):
        if k in res:
            return res[k]
    return cls

def fmtv(v):
    if isinstance(v, float):
        return ('%g' % v)
    if isinstance(v, list):
        return ', '.join(str(x) for x in v if x is not None)
    return str(v)

out = ['# Réglages des effets de Paint.NET 5.1 (référence)', '',
       "Extrait automatiquement de l'installation locale de Paint.NET (IL désassemblé par `ildasm`,",
       'libellés français officiels). Sert à aligner les dialogues d\'effets de MasterPaint.',
       'Régénérer : voir `tools/pdn-import/`.', '']
for cls in sorted(data, key=lambda c: effect_name(c).lower()):
    props = data[cls]
    out.append('## %s  (`%s`)' % (effect_name(cls), cls))
    out.append('')
    out.append('| Réglage | Type | Défaut | Min | Max | Contrôle |')
    out.append('|---|---|---|---|---|---|')
    for p in props:
        ui = p.get('ui', {})
        label = ui.get('DisplayName') or p['name']
        a = p['args']
        t = p['type']
        if t in ('Double', 'Int32') and len(a) >= 3:
            d, mn, mx = a[0], a[1], a[2]
        elif t == 'Boolean' and a:
            d, mn, mx = a[0], '', ''
        elif t == 'StaticListChoice' and a:
            choices = a[0] if isinstance(a[0], list) else a
            d = choices[a[1]] if len(a) > 1 and isinstance(a[1], int) and isinstance(choices, list) and a[1] < len(choices) else (choices[0] if choices else '')
            mn, mx = 'choix : ' + fmtv(choices), ''
        else:
            d, mn, mx = fmtv(a), '', ''
        ctl = ui.get('ControlType', '')
        extra = []
        if ui.get('UseExponentialScale'):
            extra.append('échelle exp.')
        if ui.get('ButtonText'):
            extra.append('bouton « %s »' % ui['ButtonText'])
        out.append('| %s | %s | %s | %s | %s | %s |' % (str(label).replace('|', '/'), t, fmtv(d), fmtv(mn), fmtv(mx),
                                                       ' '.join([str(ctl)] + extra).strip()))
    out.append('')
open(sys.argv[3], 'w', encoding='utf-8').write('\n'.join(out))
print('ok', len(data), 'effets')
