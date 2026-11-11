# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Looks de LightCraft (crates/engine/src/presets.rs, `builtin()`, MIT OR Apache-2.0, storytold —
https://getartcraft.com/apps) convertis en réglages du moteur Camera Raw de MasterPaint (58 valeurs,
ordre de masterpaint-core/src/fx_camraw.rs). Conversion approchée : même intention de réglage.

  python3 -I gen_lightcraft_looks.py

Écrit ../src/lightcraft_looks_gen.rs.
"""
import json, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'masterpaint-inspiration', 'lightcraft-main', 'crates', 'engine', 'src', 'presets.rs'))
OUT = os.path.join(HERE, '..', 'src', 'lightcraft_looks_gen.rs')

FR = {
    'Warm Glow': 'Lueur chaude', 'Cool Morning': 'Matin frais', 'Teal & Orange': 'Bleu canard et orange',
    'Vivid Pop': 'Couleurs vives', 'Soft Pastel': 'Pastel doux', 'Faded Matte': 'Mat délavé',
    'Warm Film': 'Pellicule chaude', 'Muted Film': 'Pellicule sourde', 'High Contrast B&W': 'N&B très contrasté',
    'Soft B&W': 'N&B doux', 'Selenium Tone': 'Virage sélénium', 'Crisp Landscape': 'Paysage net',
    'Golden Hour': 'Heure dorée', 'Blue Hour Boost': 'Heure bleue', 'Soft Skin': 'Peau douce',
    'Bright & Airy': 'Clair et aérien', 'Moody': 'Ambiance sombre', 'Cinematic': 'Cinéma',
    'Moody Portrait': 'Portrait sombre', 'Golden Glow': 'Éclat doré', 'Clean Studio': 'Studio net',
    'Crisp Vista': 'Panorama net', 'Deep Sky': 'Ciel profond', 'Lush Greens': 'Verts luxuriants',
    'Desert Warmth': 'Chaleur du désert', 'Misty Morning': 'Matin brumeux', 'Gritty Street': 'Rue granuleuse',
    'Neon Night': 'Nuit néon', 'Concrete Cool': 'Béton froid', 'Faded Urban': 'Ville délavée',
    'Fresh & Bright': 'Frais et lumineux', 'Warm Table': 'Table chaleureuse', 'Dark & Moody': 'Sombre et feutré',
    'Autumn Gold': 'Or d\'automne', 'Winter Blue': 'Bleu d\'hiver', 'Spring Fresh': 'Fraîcheur printanière',
    'Summer Haze': 'Brume d\'été',
}
BANDS = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta']


def hue_rgb(h):
    """Couleur pure de teinte h (degrés), centrée : écart de chaque canal à la moyenne."""
    h = (h % 360) / 60.0
    x = 1 - abs(h % 2 - 1)
    r, g, b = [(1, x, 0), (x, 1, 0), (0, 1, x), (0, x, 1), (x, 0, 1), (1, 0, x)][int(h) % 6]
    m = (r + g + b) / 3
    return r - m, g - m, b - m


def convert(s):
    p = [0.0] * 58
    p[24], p[28] = 50.0, 1.0
    light = s.get('light', {})
    p[0] = light.get('exposure', 0.0) * 50.0  # 2 IL pour 100
    p[3], p[4] = light.get('shadows', 0.0), light.get('blacks', 0.0)
    p[5], p[6] = light.get('highlights', 0.0), light.get('whites', 0.0)
    p[18] = light.get('contrast', 0.0)
    wb = s.get('wb', {})
    if 'temp' in wb:
        d = (1e6 / 6500 - 1e6 / wb['temp']) / 130.0  # écart en mireds rapporté à la course du moteur
        p[1] = 90.0 * math.atanh(max(-0.95, min(0.95, d)))
    p[2] = wb.get('tint', 0.0) * 0.66
    col = s.get('color', {})
    p[19], p[20] = col.get('saturation', 0.0), col.get('vibrance', 0.0)
    fx = s.get('effects', {})
    p[16], p[17] = fx.get('clarity', 0.0), fx.get('dehaze', 0.0)
    tex = fx.get('texture', 0.0)
    if tex > 0:
        p[21] = tex
    else:
        p[16] += tex * 0.4
    p[22] = -s.get('vignette', {}).get('amount', 0.0)
    p[23] = s.get('grain', {}).get('amount', 0.0)
    # courbe paramétrique : ombres relevées = noirs délavés (mat), hautes lumières adoucies
    curve = s.get('curve', {})
    p[4] += curve.get('shadows', 0.0) * 0.6
    p[6] += curve.get('highlights', 0.0) * 0.6
    # étalonnage (roues) → décalages R/V/B des hautes lumières, des ombres et global
    g = s.get('grading', {})
    for zone, idx in (('highlights', (8, 11, 14)), ('shadows', (9, 12, 15)), ('midtones', (7, 10, 13)), ('global', (7, 10, 13))):
        w = g.get(zone)
        if not w:
            continue
        d = hue_rgb(w.get('hue', 0.0))
        for k, i in enumerate(idx):
            p[i] += d[k] * w.get('sat', 0.0) * 1.6
    for i in range(7, 16):
        p[i] = max(-70.0, min(70.0, p[i]))
    for k, band in enumerate(BANDS):
        m = s.get('mixer', {}).get(band, {})
        p[30 + k], p[38 + k], p[46 + k] = m.get('hue', 0.0), m.get('sat', 0.0), m.get('lum', 0.0)
    if s.get('treatment') == 'bw':
        p[19] = -100.0
        for k, band in enumerate(BANDS):
            p[46 + k] += s.get('bw_mix', {}).get(band, 0.0)
    return [round(v, 1) for v in p]


def main():
    src = open(SRC, encoding='utf-8').read()
    body = src[src.index('pub fn builtin()'):]
    rows = []
    for m in re.finditer(r'p\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*json!\((\{.*?\})\),?\s*\)', body, re.S):
        group, pid, name, js = m.groups()
        rows.append((pid, FR.get(name, name), group, convert(json.loads(js))))
    out = ['// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.',
           '// Fichier généré par tools/gen_lightcraft_looks.py — ne pas modifier à la main.',
           '// Looks de LightCraft (storytold, MIT OR Apache-2.0 — https://getartcraft.com/apps,',
           '// https://github.com/storytold), convertis pour le moteur Camera Raw de MasterPaint.',
           '',
           '/// (identifiant, libellé, groupe, réglages du moteur Camera Raw)',
           'pub const LOOKS: &[(&str, &str, &str, [f32; 58])] = &[']
    for pid, name, group, p in rows:
        vals = ', '.join(f'{v:.1f}' for v in p)
        out.append(f'    ("lc-{pid}", {json.dumps(name, ensure_ascii=False)}, {json.dumps(group)}, [{vals}]),')
    out.append('];')
    open(OUT, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(len(rows), 'looks')


main()
