# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Pack d'icônes « Paint.NET (ancien) » : icônes de Paint.NET 3.36 (OpenPDN, src/Resources).
Ordre de recherche pour chaque icône de MasterPaint :
  1. icône d'origine d'OpenPDN (copiée telle quelle dans icon-packs/openpdn/source/) ;
  2. icône dessinée pour MasterPaint au style semi-3D de Paint.NET 3.36 (icon-packs/openpdn/custom/ :
     dessins du pack PaintJS mis en volume par `semi3d`) — jamais mêlée aux originales.
Les icônes d'OpenPDN sont sous Creative Commons BY-NC-ND 2.5 (voir License.txt) : elles ne sont
ni retouchées ni recolorées ici. N'écrit que icon-packs/openpdn*, src/openpdn_assets_gen.rs."""
from pathlib import Path
import re, json, base64, shutil, sys
root = Path(__file__).resolve().parents[3]
ui = root / 'rust/masterpaint-ui'
src = root.parent / 'masterpaint-inspiration/OpenPDN-master'
dest = ui / 'icon-packs/openpdn'
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack_mappings import PDN
from gen_custom_pack_icons import CUSTOM_ALIAS

def snake(n):
    return re.sub(r'(?<=[a-z0-9])(?=[A-Z])', '_', n).lower()

files = {}
for folder in ('Icons', 'Images'):
    for f in sorted((src / 'src/Resources' / folder).glob('*.png')):
        files[f.stem] = f
by_snake = {snake(k): k for k in files}
# noms de paintdotjs (Paint.NET 4/5) → fichier de Paint.NET 3.36 quand le nom a changé
RENAMED = {
    'enum_selection_combine_mode_replace': 'ToolConfigStrip.SelectionCombineMode.Replace',
    'enum_selection_combine_mode_union': 'ToolConfigStrip.SelectionCombineMode.Union',
    'enum_selection_combine_mode_exclude': 'ToolConfigStrip.SelectionCombineMode.Exclude',
    'enum_selection_combine_mode_intersect': 'ToolConfigStrip.SelectionCombineMode.Intersect',
    'enum_selection_combine_mode_xor': 'ToolConfigStrip.SelectionCombineMode.Xor',
    'enum_flood_mode_local': 'ToolConfigStrip.FloodMode.Local', 'enum_flood_mode_global': 'ToolConfigStrip.FloodMode.Global',
    'enum_gradient_type_linear_clamped': 'LinearClampedGradientIcon', 'enum_gradient_type_radial': 'RadialGradientIcon',
    'enum_gradient_type_linear_diamond': 'LinearDiamondGradientIcon', 'enum_gradient_type_conical': 'ConicalGradientIcon',
    'enum_gradient_type_linear_reflected': 'LinearReflectedGradientIcon',
    'enum_shape_draw_type_both_dark': 'ShapeBothIcon', 'enum_shape_draw_type_interior': 'ShapeInteriorIcon',
    'enum_shape_draw_type_outline_dark': 'ShapeOutlineIcon',
    'enum_text_alignment_left': 'TextAlignLeftIcon', 'enum_text_alignment_center': 'TextAlignCenterIcon',
    'enum_text_alignment_right': 'TextAlignRightIcon',
    'anti_aliasing_true': 'AntiAliasingEnabledIcon', 'anti_aliasing_false': 'AntiAliasingDisabledIcon',
    'alpha_blending_true': 'BlendingEnabledIcon', 'alpha_blending_false': 'BlendingOverwriteIcon',
    'enum_line_curve_cap_flat_end': 'LineCapButton.Flat.End', 'enum_line_curve_cap_rounded_end': 'LineCapButton.Rounded.End',
    'enum_line_curve_cap_arrow_filled_end': 'LineCapButton.ArrowFilled.End', 'enum_line_curve_cap_arrow_end': 'LineCapButton.Arrow.End',
    'enum_dash_style_solid': 'DashStyleButton.Solid', 'enum_dash_style_dash': 'DashStyleButton.Dash',
    'enum_dash_style_dot': 'DashStyleButton.Dot', 'enum_dash_style_dash_dot': 'DashStyleButton.DashDot',
    'enum_dash_style_dash_dot_dot': 'DashStyleButton.DashDotDot',
    'menu_image_rotate90_c_w_icon': 'MenuImageRotate90CWIcon', 'menu_image_rotate90_c_c_w_icon': 'MenuImageRotate90CCWIcon',
    'cursor_x_y_icon': 'CursorXYIcon', 'shapes_tool_icon': 'RectangleToolIcon', 'shapes_tool_icon_16': 'RoundedRectangleToolIcon',
    'menu_utilities_settings_icon': 'SettingsIcon', 'settings_tools_16': 'MenuWindowToolsIcon', 'settings_tools_24': 'MenuWindowToolsIcon',
    'settings_updates_24': 'MenuHelpCheckForUpdatesIcon', 'menu_layers_toggle_layer_visibility_icon': None,
    'drag_drop_open_or_import_form_icon': 'DragDrop.OpenOrImport.FormIcon',
}
# icônes propres à Paint.NET 3.36, par nom MasterPaint (prioritaires)
OLD = {
    'bold': 'FontBoldIcon', 'italic': 'FontItalicIcon', 'underline': 'FontUnderlineIcon',
    'text-bold': 'FontBoldIcon', 'text-italic': 'FontItalicIcon', 'text-underline': 'FontUnderlineIcon',
    'tool-rect': 'RectangleToolIcon', 'rect': 'RectangleToolIcon', 'shape-rect': 'RectangleToolIcon',
    'tool-ellipse': 'EllipseToolIcon', 'ellipse': 'EllipseToolIcon', 'shape-ellipse': 'EllipseToolIcon', 'circle': 'EllipseToolIcon',
    'tool-roundrect': 'RoundedRectangleToolIcon', 'shape-round': 'RoundedRectangleToolIcon',
    'tool-freeform': 'FreeformShapeToolIcon', 'shape-free': 'FreeformShapeToolIcon',
    'tool-hand': 'PanToolIcon', 'tool-pan': 'PanToolIcon', 'tool-zoom': 'ZoomToolIcon', 'tool-line': 'LineToolIcon',
    'tool-move': 'MoveToolIcon', 'tool-move-selection': 'MoveSelectionToolIcon',
    'tool-rect-select': 'RectangleSelectToolIcon', 'tool-lasso': 'LassoSelectToolIcon',
    'history-first': 'HistoryRewindIcon', 'backward-fast': 'HistoryRewindIcon', 'history-last': 'HistoryFastForwardIcon', 'forward-fast': 'HistoryFastForwardIcon',
    'language': 'MenuHelpLanguageIcon', 'globe-lang': 'MenuHelpLanguageIcon',
    'flatten': 'MenuImageFlattenIcon', 'layer-flatten': 'MenuImageFlattenIcon', 'layer-props': 'MenuLayersLayerPropertiesIcon',
    'rotate-180': 'MenuImageRotate180Icon', 'img-rot-180': 'MenuImageRotate180Icon',
    'actual-size': 'MenuViewActualSizeIcon', 'zoom-100': 'MenuViewActualSizeIcon',
    'rotate-zoom': 'RotateZoomIcon', 'red-eye': 'RedEyeRemoveEffect', 'sepia': 'SepiaEffect', 'sharpen': 'SharpenEffect',
    'emboss': 'EmbossEffect', 'relief': 'ReliefEffect', 'outline': 'OutlineEffectIcon', 'edge': 'EdgeDetectEffect', 'edges': 'EdgeDetectEffect',
    'glow': 'GlowEffect', 'noise': 'AddNoiseEffect', 'median': 'MedianEffectIcon', 'denoise': 'ReduceNoiseEffectIcon',
    'clouds': 'CloudsEffect', 'julia': 'JuliaFractalEffectIcon', 'mandelbrot': 'MandelbrotFractalEffectIcon',
    'vignette': 'VignetteEffectIcon', 'unfocus': 'UnfocusEffectIcon', 'soften': 'SoftenPortraitEffectIcon',
    'up': 'MenuLayersMoveLayerUpIcon', 'down': 'MenuLayersMoveLayerDownIcon',
    'arrow-up': 'MenuLayersMoveLayerUpIcon', 'arrow-down': 'MenuLayersMoveLayerDownIcon',
    'fast-backward': 'HistoryRewindIcon', 'channels': 'AllColorChannelsIcon', 'arrow-right': 'RightArrowBlue',
    'list': 'MenuWindowOpenMdiListIcon',
    'desaturate': 'DesaturateEffect', 'scanner': 'MenuFileAcquireFromScannerOrCameraIcon', 'camera': 'MenuFileAcquireFromScannerOrCameraIcon',
}

# logo de Paint.NET : jamais employé pour une fonction de MasterPaint (Info, À propos, site)
NOT_USED = {'MenuHelpAboutIcon', 'MenuHelpPdnWebsiteIcon', 'MenuHelpPdnSearchIcon'}
def old_file(n):
    f = _old_file(n)
    return None if f is not None and f.stem in NOT_USED else f
def _old_file(n):
    for cand in (n, n.removeprefix('tool-')):
        if OLD.get(cand) in files: return files[OLD[cand]]
    for cand in (n, n.removeprefix('tool-')):
        stem = PDN.get(cand)
        if not stem: continue
        if stem in RENAMED:
            return files.get(RENAMED[stem]) if RENAMED[stem] else None
        if stem in by_snake: return files[by_snake[stem]]
    return None

mpnames = re.findall(r'^    \("([^"]+)"', (ui / 'src/mpicons_gen.rs').read_text(), re.M)
sprites = re.findall(r'^    \("([^"]+)"', (ui / 'src/sprite_gen.rs').read_text(), re.M)
tools = re.findall(r'^    "([^"]+)",$', (ui / 'src/icons_gen.rs').read_text().split('ICON_NAMES')[1], re.M)
fa = [n for _, n, _ in re.findall(r'\("\\u\{([0-9a-f]+)\}", "([^"]+)", "([^"]+)"\)', (ui / 'src/fa_used_gen.rs').read_text())]

source_dir = dest / 'source'; custom_dir = dest / 'custom'
for d in (source_dir, custom_dir):
    if d.exists(): shutil.rmtree(d)
    d.mkdir(parents=True)
shutil.copy(src / 'src/Resources/Files/License.txt', dest / 'LICENSE-Paint.NET.txt')
(dest / 'NOTICE.md').write_text(
    '# Paint.NET (ancien)\n\n'
    'Icônes de `source/` : Paint.NET 3.36, © Rick Brewster / dotPDN LLC et contributeurs, reprises sans\n'
    'modification du dépôt OpenPDN (https://github.com/rivy/OpenPDN, `src/Resources`).\n'
    'Elles sont sous licence Creative Commons Attribution-NonCommercial-NoDerivs 2.5\n'
    '(http://creativecommons.org/licenses/by-nc-nd/2.5/) : usage non commercial, sans modification,\n'
    'avec attribution. Voir `LICENSE-Paint.NET.txt` (exceptions 1 et 2).\n\n'
    'Icônes de `custom/` : dessinées pour MasterPaint (polocrafting) au style Paint.NET, là où\n'
    'Paint.NET 3.36 n\'a pas d\'équivalent. Elles ne viennent pas de Paint.NET.\n')
pdn_custom = ui / 'icon-packs/paintdotjs/custom'

# ---- icônes manquantes : redessinées en « semi-3D » comme Paint.NET 3.36 (aplats du pack
# PaintJS repris, puis volumes : dégradé clair → foncé, contour sombre net, couleurs plus vives)
import colorsys
def _rgb(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
def _hex(c): return '#' + ''.join(f'{max(0, min(255, round(v * 255))):02x}' for v in c)
def _adj(h, light=0.0, sat=1.0):
    hh, l, s_ = colorsys.rgb_to_hls(*_rgb(h))
    l = l + (1 - l) * light if light > 0 else l * (1 + light)
    return _hex(colorsys.hls_to_rgb(hh, l, min(1, s_ * sat)))
def _lum(h): return colorsys.rgb_to_hls(*_rgb(h))[1]
def _sat(h): return colorsys.rgb_to_hls(*_rgb(h))[2]
def _hue(h): return colorsys.rgb_to_hls(*_rgb(h))[0] * 360
# D'après les 147 icônes d'origine (analyse des pixels) : 20 % de noir pur (contours d'un pixel),
# remplissages blancs à gris clair, bleu vif en accent (teintes 210–240°), un peu de jaune orangé.
def _stops(col):
    """Dégradé haut → bas d'un aplat du pack PaintJS, dans la palette de Paint.NET 3.36."""
    l, s_, hue = _lum(col), _sat(col), _hue(col)
    if l > 0.78: return ('#ffffff', '#f4f4f4', '#d4d7dc')              # papier, surfaces claires
    if s_ < 0.22: return ('#b4b4b4', '#808080', '#3e3e3e') if l > 0.3 else ('#6a6a6a', '#3a3a3a', '#101010')
    if 190 <= hue <= 250:
        return ('#a9c8fb', '#4f86e6', '#1f4fb4') if l > 0.4 else ('#6f9cf0', '#2d5fcc', '#143a94')
    v = _adj(col, 0, 1.45)
    return (_adj(v, 0.5), v, _adj(v, -0.3))
def _line(col):
    """Contour : noir pour les traits bleus ou gris du pack PaintJS, teinte assombrie sinon."""
    if _lum(col) > 0.93: return col
    return '#000000' if _sat(col) < 0.3 or 190 <= _hue(col) <= 250 else _adj(col, -0.5, 1.4)
def semi3d(svg):
    head, body = svg.split('-->', 1) if '-->' in svg else ('', svg)
    body = body.strip()
    m = re.match(r'<svg\b[^>]*>', body)
    root_tag = m.group(0)
    big = 'viewBox="0 0 24 24"' in root_tag
    root_stroke = 'stroke="#' in root_tag
    grads = {}
    def fill_ref(col):
        col = col.lower()
        if col not in grads: grads[col] = f's3d{len(grads)}'
        return f'url(#{grads[col]})'
    def element(m):
        tag = m.group(0)
        if tag.startswith(('<stop', '<linearGradient', '<radialGradient', '<defs')): return tag
        f = re.search(r'\bfill="(#[0-9a-fA-F]{6})"', tag)
        has_stroke = re.search(r'\bstroke="', tag)
        tag = re.sub(r'\bstroke="(#[0-9a-fA-F]{6})"', lambda k: f'stroke="{_line(k.group(1))}"', tag)
        if tag.startswith('<svg') and big:
            # traits Lucide (2 px sur 24) : un pixel net à 16 px, comme les contours d'origine
            tag = tag.replace('stroke-width="2"', 'stroke-width="1.6"')
        if f and not tag.startswith(('<svg', '<g')):
            col = f.group(1)
            if _lum(col) <= 0.93:
                tag = tag.replace(f.group(0), f'fill="{fill_ref(col)}"')
                # forme pleine sans contour : liseré sombre
                if not has_stroke and not root_stroke:
                    w = '0.9' if big else '0.6'
                    edge = '#000000' if _sat(col) < 0.3 or 190 <= _hue(col) <= 250 else _adj(col, -0.55, 1.4)
                    tag = re.sub(r'(/?>)$', f' stroke="{edge}" stroke-opacity="0.85" stroke-width="{w}" stroke-linejoin="round"\\1', tag)
        return tag
    body = re.sub(r'<[a-zA-Z][^>]*>', element, body)
    defs = ''
    for col, gid in grads.items():
        a, b_, c = _stops(col)
        defs += (f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{a}"/>'
                 f'<stop offset="0.5" stop-color="{b_}"/><stop offset="1" stop-color="{c}"/></linearGradient>')
    if defs:
        m = re.match(r'<svg\b[^>]*>', body)
        body = body[:m.end()] + '<defs>' + defs + '</defs>' + body[m.end():]
    return "<!-- MasterPaint © 2026 polocrafting — icône dessinée pour le pack Paint.NET (ancien), style semi-3D de Paint.NET 3.36 ; ne vient pas de Paint.NET -->\n" + body + '\n'

icons = {}; asset_map = {}; custom_keys = []; used = set()
def asset(n, key):
    f = old_file(n)
    if f is not None:
        name = f.name
        if name not in used:
            shutil.copy2(f, source_dir / name); used.add(name)
        asset_map.setdefault(f'assets/openpdn/{name}', []).append(key)
        return 'data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode()
    # dessin fait main sans équivalent PaintJS (handmade/, gen_openpdn_handmade.py)
    HAND_ALIAS = {'chess-board': 'checker', 'desktop': 'layout', 'globe': 'web', 'info-circle': 'info', 'thermometer-half': 'temperature'}
    for c in (n, CUSTOM_ALIAS.get(n, ''), n.removeprefix('tool-'), HAND_ALIAS.get(n, '')):
        hf = dest / 'handmade' / f'{c}.svg'
        if c and hf.exists() and not (pdn_custom / f'{c}.svg').exists():
            out = custom_dir / hf.name
            if not out.exists(): out.write_text(hf.read_text())
            asset_map.setdefault(f'custom/openpdn/{hf.name}', []).append(key)
            custom_keys.append(key)
            return out.read_text().split('-->', 1)[-1].strip().replace('currentColor', '{STROKE}')
    for c in (n, CUSTOM_ALIAS.get(n, ''), n.removeprefix('tool-')):
        cf = pdn_custom / f'{c}.svg'
        if c and cf.exists():
            out = custom_dir / cf.name
            hand = dest / 'handmade' / cf.name   # dessin fait main : prioritaire, jamais régénéré
            if not out.exists(): out.write_text(hand.read_text() if hand.exists() else semi3d(cf.read_text()))
            asset_map.setdefault(f'custom/openpdn/{cf.name}', []).append(key)
            custom_keys.append(key)
            return out.read_text().split('-->', 1)[-1].strip().replace('currentColor', '{STROKE}')
    return None
for ns, names in (('mp', mpnames), ('sprite', sprites), ('fa', fa)):
    for n in names:
        a = asset(n, f'{ns}/{n}')
        if a: icons[f'{ns}/{n}'] = a
for i, n in enumerate(tools):
    a = asset(n, f'tool/{i}')
    if a: icons[f'tool/{i}'] = a
# toutes les icônes d'origine restent consultables dans source/ (export ZIP)
for stem, f in files.items():
    if f.parent.name == 'Icons' and f.name not in used: shutil.copy2(f, source_dir / f.name)
total = len(mpnames) + len(sprites) + len(tools) + len(fa)
notices = '\n\n'.join(f.name + '\n' + f.read_text(errors='replace') for f in sorted(dest.iterdir()) if f.is_file())
data = {'format': 'masterpaint-icon-pack', 'version': 2, 'name': 'Paint.NET (ancien)',
        'author': 'Rick Brewster / dotPDN LLC et contributeurs de Paint.NET 3.36',
        'source': 'https://github.com/rivy/OpenPDN', 'origin': 'https://www.getpaint.net/',
        'revision': 'Paint.NET 3.36 (OpenPDN)', 'license': notices, 'icons': icons, 'assetMap': asset_map,
        'assets': sorted(asset_map.keys()), 'customIcons': custom_keys,
        'customNote': "Icônes de custom/ : dessinées pour MasterPaint (polocrafting) là où Paint.NET 3.36 n'a pas d'équivalent ; elles ne viennent pas de Paint.NET."}
(ui / 'icon-packs/openpdn.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))
lines = ['// Copyright polocrafting; see COPYRIGHT.md. Généré par tools/build_openpdn_pack.py.',
         'use crate::reference_assets_gen::ReferenceAsset;', 'pub const OPENPDN_ASSETS: &[ReferenceAsset] = &[']
for f in sorted(source_dir.iterdir()):
    lines.append(f'    ReferenceAsset {{ pack: 4, path: {json.dumps("assets/openpdn/" + f.name)}, bytes: include_bytes!("../icon-packs/openpdn/source/{f.name}") }},')
for f in sorted(custom_dir.iterdir()):
    lines.append(f'    ReferenceAsset {{ pack: 4, path: {json.dumps("custom/openpdn/" + f.name)}, bytes: include_bytes!("../icon-packs/openpdn/custom/{f.name}") }},')
for f in sorted(dest.iterdir()):
    if f.is_file(): lines.append(f'    ReferenceAsset {{ pack: 4, path: {json.dumps("licenses/openpdn/" + f.name)}, bytes: include_bytes!("../icon-packs/openpdn/{f.name}") }},')
lines += ['];', '']
(ui / 'src/openpdn_assets_gen.rs').write_text('\n'.join(lines))
orig = len(icons) - len(custom_keys)
print(f'openpdn : {len(icons)}/{total} icônes couvertes — {orig} d\'origine ({len(used)} fichiers), {len(custom_keys)} dessinées pour MasterPaint')
print('icônes d\'origine non utilisées :', ' '.join(sorted(k for k, f in files.items() if f.name not in used and f.parent.name == 'Icons')))
