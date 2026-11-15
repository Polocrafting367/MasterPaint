# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Icônes dessinées à la main pour le pack « Paint.NET (ancien) », là où Paint.NET 3.36 n'a rien :
style semi-3D des originales (contour noir d'un pixel, dégradés haut clair → bas foncé, blanc,
gris, bleu vif, jaune). Écrit icon-packs/openpdn/handmade/<nom>.svg (prioritaires sur tout dessin
généré) ; ne touche jamais à windows.svg (fait main). Relancer ensuite build_openpdn_pack.py."""
from pathlib import Path
OUT = Path(__file__).resolve().parents[1] / 'icon-packs/openpdn/handmade'
OUT.mkdir(parents=True, exist_ok=True)
HEAD = '<!-- MasterPaint © 2026 polocrafting — icône dessinée pour le pack Paint.NET (ancien), style semi-3D de Paint.NET 3.36 ; ne vient pas de Paint.NET -->\n'
G = {  # dégradés haut / milieu / bas
    'blue': ('#a9c8fb', '#4f86e6', '#1f4fb4'), 'paper': ('#ffffff', '#f4f4f4', '#d4d7dc'),
    'gray': ('#e2e4e8', '#a9adb5', '#6b7079'), 'dark': ('#6a6a6a', '#3a3a3a', '#101010'),
    'yellow': ('#fff6b0', '#f6c63a', '#c98a10'), 'red': ('#ffb09c', '#e0402a', '#9c1a0c'),
    'green': ('#d2f5a0', '#5fb52e', '#2f7a14'), 'cyan': ('#c8f4ff', '#3cc2ea', '#0f7aa6'),
    'magenta': ('#ffc4ef', '#e04ab8', '#99146f'), 'orange': ('#ffd7a0', '#f59a2c', '#b35a08'),
    'purple': ('#e2c8ff', '#9a62e0', '#5a2a9c'),
}
def defs(*names, h=True):
    out = ''
    for n in names:
        a, b, c = G[n]
        x2, y2 = ('0', '1') if h else ('1', '0')
        out += f'<linearGradient id="{n}" x1="0" y1="0" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{a}"/><stop offset=".5" stop-color="{b}"/><stop offset="1" stop-color="{c}"/></linearGradient>'
    return f'<defs>{out}</defs>'
L = 'stroke="#000" stroke-width="1" stroke-linejoin="round"'
def svg(body, *g):
    return HEAD + f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">{defs(*g)}{body}</svg>\n'

trash = svg(f'<path d="M3.5 4.5h9l-1 10h-7z" fill="url(#gray)" {L}/><path d="M6.5 6.5v6M9.5 6.5v6" stroke="#4a4e55"/>'
            f'<rect x="2.5" y="2.5" width="11" height="2" rx=".5" fill="url(#paper)" {L}/><path d="M6.5 2.5v-1h3v1" fill="none" {L}/>', 'gray', 'paper')
info = svg(f'<circle cx="8" cy="8" r="6.5" fill="url(#blue)" {L}/><circle cx="8" cy="4.8" r="1.1" fill="#fff"/><path d="M8 7v5" stroke="#fff" stroke-width="2"/>'
           '<ellipse cx="7" cy="4.5" rx="4" ry="2" fill="#fff" opacity=".35"/>', 'blue')
icons = {
    'trash': trash, 'trash-can': trash, 'svg-obj-delete': trash,
    'about': info, 'info': info,
    'exposure': svg(f'<rect x="1.5" y="1.5" width="13" height="13" fill="url(#paper)" {L}/><path d="M1.5 14.5 14.5 1.5V14.5Z" fill="url(#dark)"/>'
                    f'<rect x="1.5" y="1.5" width="13" height="13" fill="none" {L}/><path d="M3 5h4M5 3v4" stroke="#000" stroke-width="1.4"/><path d="M9 11h4" stroke="#fff" stroke-width="1.4"/>', 'paper', 'dark'),
    'shadows': svg(f'<circle cx="8" cy="8" r="6.5" fill="url(#paper)" {L}/><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="url(#dark)"/><circle cx="8" cy="8" r="6.5" fill="none" {L}/>', 'paper', 'dark'),
    'shadow': svg(f'<rect x="5" y="5" width="10" height="10" fill="#000" opacity=".35"/><rect x="1.5" y="1.5" width="10" height="10" fill="url(#blue)" {L}/>', 'blue'),
    'invert-alpha': svg('<rect x="1.5" y="1.5" width="13" height="13" fill="#fff"/><path d="M1.5 1.5h3.25v3.25H1.5zM8 1.5h3.25v3.25H8zM4.75 4.75H8V8H4.75zM11.25 4.75h3.25V8h-3.25zM1.5 8h3.25v3.25H1.5zM4.75 11.25H8v3.25H4.75z" fill="#b8b8b8"/>'
                        f'<path d="M8 8h6.5v6.5H8z" fill="url(#blue)"/><rect x="1.5" y="1.5" width="13" height="13" fill="none" {L}/><path d="M8 1.5v13M1.5 8h13" stroke="#000" stroke-width=".6"/>', 'blue'),
    'transparency': None, 'checker': None,
    'temperature': svg(f'<path d="M6.5 10V3a1.5 1.5 0 0 1 3 0v7a3 3 0 1 1-3 0z" fill="url(#paper)" {L}/><circle cx="8" cy="12.3" r="1.9" fill="url(#red)"/><path d="M8 11V5" stroke="#e0402a" stroke-width="1.4"/>'
                       '<path d="M11 4h2M11 6h1.5M11 8h2" stroke="#000" stroke-width=".8"/>', 'paper', 'red'),
    'bokeh': svg(f'<rect x=".5" y=".5" width="15" height="15" fill="url(#dark)" {L}/><circle cx="5" cy="5" r="3" fill="#f6c63a" opacity=".8"/><circle cx="11" cy="7" r="2.5" fill="#3cc2ea" opacity=".8"/>'
                 '<circle cx="6.5" cy="11.5" r="2.3" fill="#e04ab8" opacity=".75"/><circle cx="12" cy="12.5" r="1.6" fill="#fff" opacity=".7"/>', 'dark'),
    'sketch-blur': svg(f'<rect x="1.5" y="1.5" width="13" height="13" fill="url(#paper)" {L}/><path d="M3 11c2-4 4-6 7-7M4 13c3-4 5-6 8-7" stroke="#606060" stroke-width="2.2" opacity=".35"/>'
                       '<path d="M3 11c2-4 4-6 7-7M4 13c3-4 5-6 8-7" stroke="#202020" stroke-width=".8"/>', 'paper'),
    'square-blur': svg(f'<rect x="1.5" y="1.5" width="13" height="13" fill="url(#paper)" {L}/><rect x="4" y="4" width="8" height="8" fill="#4f86e6" opacity=".35"/><rect x="5" y="5" width="6" height="6" fill="#4f86e6" opacity=".5"/><rect x="6" y="6" width="4" height="4" fill="#1f4fb4" opacity=".7"/>', 'paper'),
    'quantize': svg(f'<rect x="1.5" y="1.5" width="6.5" height="6.5" fill="url(#red)"/><rect x="8" y="1.5" width="6.5" height="6.5" fill="url(#yellow)"/><rect x="1.5" y="8" width="6.5" height="6.5" fill="url(#blue)"/><rect x="8" y="8" width="6.5" height="6.5" fill="url(#green)"/>'
                    f'<rect x="1.5" y="1.5" width="13" height="13" fill="none" {L}/><path d="M8 1.5v13M1.5 8h13" stroke="#000"/>', 'red', 'yellow', 'blue', 'green'),
    'cmyk': None, 'colormode': None,
    'crystal': svg(f'<path d="M8 .8 14.3 4.5v7L8 15.2 1.7 11.5v-7z" fill="url(#cyan)" {L}/><path d="M8 .8V8l6.3 3.5M8 8 1.7 11.5M8 8 1.7 4.5" stroke="#fff" stroke-width=".9"/><path d="M8 8 14.3 4.5" stroke="#0f7aa6" stroke-width=".8"/>', 'cyan'),
    'morphology': svg(f'<rect x="1.5" y="1.5" width="13" height="13" fill="url(#paper)" {L}/><path d="M4 11c-1-3 1-6 4-6 1-2 4-1 4 1 1 2-1 3 0 5-2 2-6 2-8 0z" fill="url(#dark)" stroke="#000" stroke-width=".8"/>', 'paper', 'dark'),
    'straighten': svg(f'<rect x="1.5" y="2.5" width="13" height="11" fill="url(#cyan)" {L}/><path d="M1.5 11.5 14.5 7.5V13.5H1.5z" fill="url(#green)"/><rect x="1.5" y="2.5" width="13" height="11" fill="none" {L}/><path d="M3 8.5h10" stroke="#fff" stroke-width="1" stroke-dasharray="1.5 1"/>', 'cyan', 'green'),
    'turbulence': svg(f'<rect x="1.5" y="1.5" width="13" height="13" fill="url(#paper)" {L}/><path d="M3 5c2-2 4 2 6 0s3 0 4 0M3 8.5c2-2 4 2 6 0s3 0 4 0M3 12c2-2 4 2 6 0s3 0 4 0" fill="none" stroke="#1f4fb4" stroke-width="1.3"/>', 'paper'),
    'eye': None, 'svg-obj-visible': None,
    'gauge': svg(f'<path d="M1.5 12.5a6.5 6.5 0 0 1 13 0z" fill="url(#paper)" {L}/><path d="M3 12.5a5 5 0 0 1 2-4" stroke="#5fb52e" stroke-width="2"/><path d="M11 8.5a5 5 0 0 1 2 4" stroke="#e0402a" stroke-width="2"/>'
                 '<path d="M8 12.5 11 6" stroke="#000" stroke-width="1.3"/><circle cx="8" cy="12.5" r="1.3" fill="url(#gray)" stroke="#000" stroke-width=".7"/>', 'paper', 'gray'),
    'download': svg(f'<path d="M1.5 11.5v3h13v-3" fill="url(#gray)" {L}/><path d="M6 1.5h4v5h3L8 11.5 3 6.5h3z" fill="url(#green)" {L}/>', 'gray', 'green'),
    'check': svg(f'<path d="M1.5 8.5 4 6l2.5 2.5L12 2.5l2.5 2.5-8 8z" fill="url(#green)" {L}/>', 'green'),
    'web': svg(f'<circle cx="8" cy="8" r="6.5" fill="url(#blue)" {L}/><path d="M4 4.5c2 0 2 2 3.5 2S8 9 6 9.5 5 12 4.5 12C3 10.5 2.5 6 4 4.5zM10 3.5c1 1 3 1 3.5 3-1 .5-2 0-2.5 1.5s1 2-.5 3.5c-1-1-1.5-3-1-4.5S9 4 10 3.5z" fill="url(#green)" stroke="#2f7a14" stroke-width=".5"/>'
               '<ellipse cx="6.5" cy="5" rx="3.5" ry="2" fill="#fff" opacity=".3"/>', 'blue', 'green'),
    'layout': None, 'ribbon': None,
}
icons['transparency'] = icons['checker'] = svg('<rect x="1.5" y="1.5" width="13" height="13" fill="#fff"/><path d="M1.5 1.5h3.25v3.25H1.5zM8 1.5h3.25v3.25H8zM4.75 4.75H8V8H4.75zM11.25 4.75h3.25V8h-3.25zM1.5 8h3.25v3.25H1.5zM8 8h3.25v3.25H8zM4.75 11.25H8v3.25H4.75zM11.25 11.25h3.25v3.25h-3.25z" fill="#b8b8b8"/>'
                                               f'<rect x="1.5" y="1.5" width="13" height="13" fill="none" {L}/>')
icons['cmyk'] = icons['colormode'] = svg('<circle cx="6" cy="6" r="4.5" fill="#3cc2ea" opacity=".85" stroke="#000" stroke-width=".8"/><circle cx="10" cy="6" r="4.5" fill="#e04ab8" opacity=".7" stroke="#000" stroke-width=".8"/><circle cx="8" cy="10" r="4.5" fill="#f6d23a" opacity=".7" stroke="#000" stroke-width=".8"/>')
icons['eye'] = icons['svg-obj-visible'] = svg(f'<path d="M.8 8C3 4 5.5 3 8 3s5 1 7.2 5C13 12 10.5 13 8 13S3 12 .8 8z" fill="url(#paper)" {L}/><circle cx="8" cy="8" r="3.2" fill="url(#blue)" stroke="#000" stroke-width=".8"/><circle cx="8" cy="8" r="1.4" fill="#000"/><circle cx="7" cy="7" r=".8" fill="#fff"/>', 'paper', 'blue')
icons['layout'] = icons['ribbon'] = svg(f'<rect x=".5" y="1.5" width="15" height="13" fill="url(#paper)" {L}/><rect x="1" y="2" width="14" height="3" fill="url(#blue)"/><rect x="1" y="5" width="14" height="3" fill="#e6edf7"/>'
                                        '<path d="M3 6.5h2M7 6.5h2M11 6.5h2" stroke="#4f86e6" stroke-width="1.6"/><path d="M.5 8.5h15" stroke="#000" stroke-width=".7"/><rect x=".5" y="1.5" width="15" height="13" fill="none" stroke="#000"/>', 'paper', 'blue')
n = 0
for name, s in icons.items():
    if s is None: raise SystemExit(f'{name} sans dessin')
    (OUT / f'{name}.svg').write_text(s); n += 1
print(n, 'icônes écrites dans', OUT)
