# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Icônes dessinées pour MasterPaint là où paintdotjs et PhotoCraft n'ont pas d'équivalent.
Écrit icon-packs/paintdotjs/custom/*.svg et icon-packs/photocraft/custom/*.svg (sources visibles,
modifiables à la main) ; build_reference_packs.py les ajoute aux packs, à part des originaux.
Nom de fichier = nom MasterPaint de l'icône (mp/ ou sprite/), voir CUSTOM_ALIAS pour les outils.
- PhotoCraft : style Lucide (24 × 24, trait 2 px arrondi, couleur courante).
- paintdotjs : aplats colorés façon Paint.NET (16 × 16 : bleu, bleu clair, violet, gris, jaune)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'icon-packs'
HEAD = '<!-- MasterPaint © 2026 polocrafting — icône dessinée pour le pack {pack} (style {style}) -->\n'

# ---------------------------------------------------------------- PhotoCraft (Lucide)
def lucide(body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>')

DOT = lambda x, y, r=1.2: f'<circle cx="{x}" cy="{y}" r="{r}" fill="currentColor" stroke="none"/>'
FRAME = '<rect x="3" y="3" width="18" height="18" rx="2"/>'

PHOTO = {
    'save': '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    'export': '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    'download': '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    'print': '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    'zoom-out': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6"/>',
    'paste': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    'changelog': '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
    'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    'camera-raw': '<circle cx="12" cy="12" r="10"/><path d="m14.31 8 5.74 9.94"/><path d="M9.69 8h11.48"/><path d="m7.38 12 5.74-9.94"/><path d="M9.69 16 3.95 6.06"/><path d="M14.31 16H2.83"/><path d="m16.62 12-5.74 9.94"/>',
    'levels': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-3"/><path d="M13 17V9"/><path d="M18 17V5"/>',
    'posterize': FRAME + '<path d="M9 3v18"/><path d="M15 3v18"/>',
    'transparency': FRAME + '<path d="M3 9h6V3"/><path d="M9 15h6V9h6"/><path d="M15 21v-6H9"/>',
    'shadows': '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    'gaussian': '<circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/><circle cx="12" cy="12" r="4"/>',
    'motion': '<circle cx="15" cy="12" r="5"/><path d="M2 8h6"/><path d="M2 12h5"/><path d="M2 16h6"/>',
    'zoom-blur': '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
    'noise': FRAME + DOT(8, 8) + DOT(13, 7) + DOT(16, 11) + DOT(9, 13) + DOT(14, 16) + DOT(7, 17) + DOT(17, 17, 1),
    'pixelate': '<rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/>',
    'emboss': '<path d="M3 15 9 9l4 4 8-8"/><path d="M3 20l6-6 4 4 8-8" opacity=".45"/>',
    'relief': '<path d="M3 15 9 9l4 4 8-8"/><path d="M3 20l6-6 4 4 8-8" opacity=".45"/>',
    'edges': '<path d="m2 20 6-12 4 6 3-4 7 10z"/>',
    'contour': '<path d="M4 18c2-6 6-2 8-8s6-4 8-6"/><path d="M4 13c2-4 5-2 7-6"/><path d="M12 20c2-3 5-3 8-6"/>',
    'shadow': '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M20 8v10a2 2 0 0 1-2 2H8"/>',
    'outline': FRAME + '<rect x="7.5" y="7.5" width="9" height="9" rx="1"/>',
    'dither': FRAME + DOT(7, 7, 1) + DOT(11, 7, 1) + DOT(15, 7, 1) + DOT(9, 11, 1) + DOT(13, 11, 1) + DOT(17, 11, 1) + DOT(7, 15, 1) + DOT(11, 15, 1) + DOT(15, 15, 1),
    'halftone': DOT(6, 6, 2.6) + DOT(12, 6, 2) + DOT(18, 6, 1.4) + DOT(6, 12, 2) + DOT(12, 12, 1.4) + DOT(18, 12, 0.9) + DOT(6, 18, 1.4) + DOT(12, 18, 0.9) + DOT(18, 18, 0.5),
    'mandelbrot': '<path d="M12 4a5 5 0 1 0 0 10 5 5 0 1 0 0-10"/><circle cx="12" cy="17" r="3"/><circle cx="12" cy="21" r="1"/>',
    'julia': '<path d="M12 12c0-3 3-5 5-3s0 6-4 6-7-4-5-8 8-4 10 0"/>',
    'checker': FRAME + '<rect x="3" y="3" width="6" height="6" fill="currentColor"/><rect x="15" y="3" width="6" height="6" fill="currentColor"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/><rect x="3" y="15" width="6" height="6" fill="currentColor"/><rect x="15" y="15" width="6" height="6" fill="currentColor"/>',
    'vhs': '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><circle cx="16" cy="12" r="2.5"/><path d="M10.5 12h3"/>',
    'tile': '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
    'grad-linear': FRAME + '<path d="M7 17 17 7"/><path d="M11 7h6v6"/>',
    'grad-radial': FRAME + '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="5.5" stroke-dasharray="2 2"/>',
    'grad-diamond': FRAME + '<path d="m12 6 6 6-6 6-6-6z"/><path d="m12 9.5 2.5 2.5-2.5 2.5-2.5-2.5z" fill="currentColor"/>',
    'grad-conic': FRAME + '<circle cx="12" cy="12" r="6"/><path d="M12 12V6"/><path d="M12 12h6" opacity=".45"/>',
    'cap-none': '<path d="M3 12h15"/><path d="M18 7v10"/>',
    'cap-round': '<path d="M3 12h13"/><circle cx="18" cy="12" r="3" fill="currentColor"/>',
    'cap-arrow': '<path d="M3 12h12"/><path d="m14 6 7 6-7 6z" fill="currentColor"/>',
    'cap-arrow-hollow': '<path d="M3 12h14"/><path d="m15 6 6 6-6 6"/>',
    'cap-diamond': '<path d="M3 12h11"/><path d="m18 8 4 4-4 4-4-4z" fill="currentColor"/>',
    'mode-contiguous': FRAME + '<path d="M12 3v18M3 12h18"/><rect x="3" y="3" width="9" height="9" fill="currentColor"/>',
    'mode-layer': '<path d="m12 3 9 5-9 5-9-5z" fill="currentColor"/><path d="m3 13 9 5 9-5"/>',
    'shape-both': '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" fill="currentColor"/>',
    'fill-none': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m5 19 14-14"/>',
    'fill-gradient': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16" opacity=".85"/><path d="M12 4v16" opacity=".55"/><path d="M16 4v16" opacity=".25"/>',
    'brush-soft': '<circle cx="12" cy="12" r="4" fill="currentColor"/><circle cx="12" cy="12" r="8" stroke-dasharray="2 3"/>',
    'brush-spray': DOT(12, 12, 1.5) + DOT(7, 9) + DOT(16, 8) + DOT(9, 16) + DOT(17, 15) + DOT(12, 5, 0.9) + DOT(5, 13, 0.9) + DOT(19, 11, 0.9) + DOT(13, 19, 0.9),
    'brush-square': '<rect x="6" y="6" width="12" height="12" fill="currentColor"/>',
    'shape-arrow': '<path d="M3 9h10V5l8 7-8 7v-4H3z"/>',
    'shape-cross': '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    'shape-trapezoid': '<path d="M7 5h10l4 14H3z"/>',
    'shape-parallelogram': '<path d="M8 5h13l-5 14H3z"/>',
    'shape-hexagon': '<path d="M7 3h10l5 9-5 9H7l-5-9z"/>',
    'shape-heptagon': '<path d="m12 2 7.8 3.8 1.9 8.4-5.4 6.8H7.7l-5.4-6.8 1.9-8.4z"/>',
    'shape-octagon': '<path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z"/>',
    'shape-star-4': '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
    'shape-star-6': '<path d="m12 2 3 5h6l-3 5 3 5h-6l-3 5-3-5H3l3-5-3-5h6z"/>',
    'shape-star-thin': '<path d="m12 2 1.6 8.4L22 12l-8.4 1.6L12 22l-1.6-8.4L2 12l8.4-1.6z"/>',
    'shape-callout-rect': '<path d="M3 4h18v12H10l-5 4v-4H3z"/>',
    'shape-callout-round': '<path d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
    'shape-callout-oval': '<path d="M12 4c5 0 9 3 9 7s-4 7-9 7c-1 0-2-.1-3-.4L4 20l1.5-4C3.9 14.7 3 13 3 11c0-4 4-7 9-7z"/>',
    'shape-callout-cloud': '<path d="M17.5 17H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z"/><circle cx="6" cy="20" r="1.2"/>',
    'anim-onion': '<rect x="2" y="7" width="11" height="11" rx="2" opacity=".35"/><rect x="6" y="5" width="11" height="11" rx="2" opacity=".65"/><rect x="10" y="3" width="11" height="11" rx="2"/>',
    'anim-draw-step': '<path d="M14 4l3 3-9 9H5v-3z"/><path d="M14 20h7"/><path d="m18 17 3 3-3 3"/>',
    'film': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/>',
    'sequence': '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M19 8v8"/><path d="M22 10v4"/>',
    'keyboard': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
    'bug': '<path d="m8 2 1.9 1.9"/><path d="M14.1 3.9 16 2"/><path d="M9 7.1v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.5 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M21 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    'book': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    'outside-canvas': '<rect x="2" y="2" width="20" height="20" rx="2" stroke-dasharray="3 3"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
    'magnet': '<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15"/><path d="m5 8 4 4"/><path d="m12 15 4 4"/>',
    'layer-buffer': '<rect x="3" y="6" width="18" height="12" rx="2" stroke-dasharray="3 2"/><path d="M8 12h8"/><path d="m10 10-2 2 2 2"/><path d="m14 10 2 2-2 2"/>',
    'external': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'phone': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    'signature': '<path d="M3 17c3-4 5-9 7-9s-1 8 1 8 3-4 5-4 1 3 3 3"/><path d="M3 21h18"/>',
    'gallery': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    'repeat': '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    'render-low': FRAME + '<path d="M3 12h9v9"/><path d="M8 8h.01"/>',
    'github': '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
    'cube': '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5"/><path d="M12 12v10"/>',
    'wave': '<path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M2 18c2-4 4-4 6 0s4 4 6 0 4-4 6 0" opacity=".45"/>',
    'twist': '<path d="M12 12c0-2 2-3 3.5-2S17 14 13 15s-6-3-5-6 6-5 9-2 3 9-2 11-11-1-11-6"/>',
    'chromatic': '<circle cx="9" cy="10" r="5"/><circle cx="15" cy="10" r="5" opacity=".6"/><circle cx="12" cy="15" r="5" opacity=".35"/>',
    'duotone': '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>',
    'solarize': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/><path d="M12 8a4 4 0 0 1 0 8z" fill="currentColor"/>',
    'cmyk': '<circle cx="9" cy="9" r="5"/><circle cx="15" cy="9" r="5"/><circle cx="12" cy="15" r="5"/>',
    'colormode': '<circle cx="9" cy="9" r="5"/><circle cx="15" cy="9" r="5"/><circle cx="12" cy="15" r="5"/>',
    'oil': '<path d="M18 2l4 4-9 9-4 1 1-4z"/><path d="M7 14c-2 0-4 2-4 4s-1 3-1 3 5 0 7-2 2-5-2-5z" fill="currentColor"/>',
    'ink': '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z" fill="currentColor"/>',
    'sketch': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    'pastel': '<path d="m15 3 6 6-11 11H4v-6z"/><path d="m12 6 6 6"/>',
    'bokeh': '<circle cx="8" cy="9" r="4"/><circle cx="16" cy="8" r="3" opacity=".6"/><circle cx="14" cy="16" r="4.5" opacity=".4"/>',
    'fragment': '<rect x="4" y="4" width="10" height="10" rx="1"/><rect x="10" y="10" width="10" height="10" rx="1" opacity=".5"/>',
    'surface': FRAME + '<path d="M3 15c3-2 6 2 9 0s6-2 9 0"/>',
    'square-blur': '<rect x="5" y="5" width="14" height="14" rx="1"/><rect x="2" y="2" width="20" height="20" rx="2" stroke-dasharray="2 3"/>',
    'sketch-blur': '<path d="M3 17c4-1 6-6 9-6s4 4 9 2"/><path d="M3 12c4-1 6-6 9-6s4 4 9 2" opacity=".45"/>',
    'quantize': '<rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/>',
    'bulge': '<circle cx="12" cy="12" r="9"/><path d="M3 12c3-3 15-3 18 0"/><path d="M3 12c3 3 15 3 18 0"/><path d="M12 3c-3 3-3 15 0 18"/>',
    'dents': '<path d="M2 7c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/><path d="M2 12c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/><path d="M2 17c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/>',
    'crystal': '<path d="m12 2 8 6-3 12H7L4 8z"/><path d="m4 8 8 4 8-4"/><path d="M12 12v10"/>',
    'frosted': FRAME + '<path d="M8 3v18M14 3v18" stroke-dasharray="1.5 2.5"/>',
    'morphology': '<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="2" y="2" width="20" height="20" rx="3" opacity=".4"/>',
    'median': FRAME + '<path d="M3 12h18"/><path d="M12 3v18" opacity=".45"/>',
    'denoise': FRAME + DOT(8, 8, 1) + DOT(16, 9, 1) + '<path d="m8 16 8-8"/>',
    'portrait': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'dream': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/><path d="M18 4h.01M20 7h.01"/>',
    'turbulence': '<path d="M3 8c3-3 6 3 9 0s6-3 9 0"/><path d="M3 14c3-3 6 3 9 0s6-3 9 0"/><path d="M3 20c3-3 6 3 9 0"/>',
    'ascii': '<path d="M4 18 8 6l4 12"/><path d="M5.5 14h5"/><path d="M15 6v12"/><path d="M15 6h4a2 2 0 0 1 0 4h-4"/><path d="M15 12h5"/>',
    'mirror4': '<path d="M12 2v20M2 12h20" stroke-dasharray="2 2"/><path d="m5 5 4 4H5z"/><path d="m19 5-4 4h4z"/><path d="m5 19 4-4H5z"/><path d="m19 19-4-4h4z"/>',
    'dust': '<path d="M3 21c3-6 7-9 18-18"/>' + DOT(6, 8, 1) + DOT(10, 5, 1) + DOT(17, 14, 1) + DOT(14, 19, 1),
    'chroma-key': FRAME + '<path d="M3 15c3-3 6-3 9 0s6 3 9 0"/><circle cx="8" cy="8" r="1.5"/>',
    'vec-shape': '<path d="m12 3 9 7-3.5 11h-11L3 10z"/>',
    'grad-method-simple': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14" opacity=".9"/><path d="M11 5v14" opacity=".6"/><path d="M15 5v14" opacity=".35"/>',
    'grad-method-smart': '<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 7v14" opacity=".9"/><path d="M11 7v14" opacity=".55"/><path d="M19 2v4M17 4h4"/>',
}

# ---------------------------------------------------------------- paintdotjs (aplats Paint.NET)
B, L, D, P, G, Y, R, W, O = '#3d7cc0', '#c3dcf2', '#26578f', '#8e5cb6', '#6b6b6b', '#f0b429', '#d64541', '#ffffff', '#e8833a'


def pdn(body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' + body + '</svg>'


def dash_rect(x, y, w, h, fill=L):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{D}" stroke-width="1" stroke-dasharray="1.5 1"/>'


def shape(d, fill=L, stroke=B):
    return pdn(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="1" stroke-linejoin="round"/>')


def align(bar, boxes):
    return pdn(bar + ''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{L}" stroke="{B}"/>' for x, y, w, h in boxes))


LOCK = (f'<path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="{G}" stroke-width="1.5"/>'
        f'<rect x="3.5" y="7" width="9" height="7.5" rx="1" fill="{Y}" stroke="#b07d12"/>'
        f'<rect x="7.3" y="9.3" width="1.4" height="3" fill="#7a560c"/>')
UNLOCK = (f'<path d="M11 7V5a3 3 0 0 0-6 0" fill="none" stroke="{G}" stroke-width="1.5"/>'
          f'<rect x="3.5" y="7" width="9" height="7.5" rx="1" fill="{Y}" stroke="#b07d12"/>'
          f'<rect x="7.3" y="9.3" width="1.4" height="3" fill="#7a560c"/>')
MAGNET = (f'<path d="M3 2v6a5 5 0 0 0 10 0V2h-3v6a2 2 0 0 1-4 0V2z" fill="{R}" stroke="#8f2a27" stroke-width=".8"/>'
          f'<rect x="3" y="2" width="3" height="2.2" fill="#e8e8e8"/><rect x="10" y="2" width="3" height="2.2" fill="#e8e8e8"/>')
LASSO = f'<ellipse cx="8" cy="6" rx="6" ry="4" fill="none" stroke="{B}" stroke-width="1.4"/><path d="M4 9c-1 2 0 4 2 5" fill="none" stroke="{B}" stroke-width="1.4"/>'
CAMERA = (f'<rect x="1" y="4" width="14" height="10" rx="1.5" fill="{G}"/><rect x="5" y="2.5" width="6" height="2.5" rx=".5" fill="{G}"/>'
          f'<circle cx="8" cy="9" r="3.3" fill="{L}" stroke="{D}"/><circle cx="8" cy="9" r="1.4" fill="{B}"/><rect x="11.5" y="5.3" width="2" height="1.2" fill="{Y}"/>')
FILM = (f'<rect x="1" y="2" width="14" height="12" rx="1" fill="{G}"/>'
        + ''.join(f'<rect x="{x}" y="3" width="1.4" height="1.4" fill="{W}"/><rect x="{x}" y="11.6" width="1.4" height="1.4" fill="{W}"/>' for x in (2.2, 5.2, 8.2, 11.2))
        + f'<rect x="3" y="5.5" width="4.5" height="5" fill="{L}"/><rect x="8.5" y="5.5" width="4.5" height="5" fill="{B}"/>')
STAR5 = 'M8 1.5l1.9 4 4.3.5-3.2 3 .9 4.3L8 11.1l-3.9 2.2.9-4.3-3.2-3 4.3-.5z'

PAINT = {
    # lasso magnétique, aimantation, correcteur, doigt, densité : redessinés le 2026-11-11 (planche comparée à paint.js)
    'lasso-magnetic': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M4.3 10.6C1.6 9.6.9 7.6 2 5.6 3.4 3 7.2 1.6 10.6 2.2c3 .5 4.2 2.4 3.2 4.4" fill="none" stroke="#5088b8" stroke-width="1.7" stroke-linecap="round"/><path d="M4.3 10.6c-1.2.4-1.4 1.6-.6 2.2.8.6 1.9.2 1.6-1M4.8 11.8c-.4 1.5.2 2.6 1.4 3" fill="none" stroke="#5088b8" stroke-width="1.5" stroke-linecap="round"/><g transform="translate(7.6 7.4) scale(.52)"><path d="M3 2v6a5 5 0 0 0 10 0V2h-3v6a2 2 0 0 1-4 0V2z" fill="#c85038" stroke="#c85038" stroke-width="1.2"/><path d="M3 2h3v2.6H3zM10 2h3v2.6h-3z" fill="#e8e8e8" stroke="#c85038" stroke-width="1.2"/></g></svg>',
    'heal': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g transform="rotate(-45 8 8)"><rect x=".8" y="4.8" width="14.4" height="6.4" rx="3.2" fill="#f0c880" stroke="#a88850"/><rect x="5.4" y="4.8" width="5.2" height="6.4" fill="#e0b060" stroke="#a88850"/><g fill="#b89050"><circle cx="7" cy="6.9" r=".6"/><circle cx="9" cy="6.9" r=".6"/><circle cx="7" cy="9.1" r=".6"/><circle cx="9" cy="9.1" r=".6"/></g></g></svg>',
    'smudge': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1.3 14.7C2.2 13 3.3 12 4.8 11.6" fill="none" stroke="#c0d8e8" stroke-width="3.2" stroke-linecap="round"/><path d="M1.3 14.7C2.2 13 3.3 12 4.8 11.6" fill="none" stroke="#4080b0" stroke-width="1.7" stroke-linecap="round"/><g transform="rotate(225 8.6 7.4) translate(0.6 -0.6)" fill="#f0c880" stroke="#a88850" stroke-width=".85" stroke-linejoin="round"><path d="M5.3 9V2.2a1.3 1.3 0 0 1 2.6 0V7"/><path d="M7.9 7V6a1.2 1.2 0 0 1 2.4 0v1.2a1.2 1.2 0 0 1 2.4 0v4.3c0 2-1.4 3.4-3.4 3.4H8c-1.4 0-2.3-.6-3-1.7L3.4 10.5a1.2 1.2 0 0 1 1.9-1.4"/><path d="M5.3 9v.4" fill="none"/></g></svg>',
    'dodge': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 10.2V15" stroke="#909898" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="5.6" r="4.6" fill="#f8f8f8"/><path d="M8 1a4.6 4.6 0 0 0 0 9.2z" fill="#404850"/><circle cx="8" cy="5.6" r="4.6" fill="none" stroke="#404850"/></svg>',
    'quick-select': pdn(dash_rect(1.5, 6.5, 9, 8) + f'<path d="M15 1 9 7" stroke="{G}" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="8" r="2.2" fill="{B}"/>'),
    'object-select': pdn(dash_rect(1.5, 1.5, 13, 13, 'none') + f'<rect x="4.5" y="4.5" width="5" height="5" fill="{L}" stroke="{B}"/><path d="M9 9l5 2-2 1 2 2-1 1-2-2-1 2z" fill="{W}" stroke="#404850" stroke-width=".7"/>'),
    'warp4': pdn(f'<path d="M3 2.5 14 4l-1.5 9.5L1.5 12z" fill="{L}" stroke="{B}"/>' + ''.join(f'<rect x="{x-1.3}" y="{y-1.3}" width="2.6" height="2.6" fill="{D}"/>' for x, y in ((3, 2.5), (14, 4), (12.5, 13.5), (1.5, 12)))),
    'deform': pdn(dash_rect(2.5, 2.5, 11, 11, L) + ''.join(f'<rect x="{x-1.3}" y="{y-1.3}" width="2.6" height="2.6" fill="{D}"/>' for x, y in ((2.5, 2.5), (13.5, 2.5), (13.5, 13.5), (2.5, 13.5), (8, 2.5), (8, 13.5), (2.5, 8), (13.5, 8)))),
    'sel-align-left': align(f'<rect x="1" y="1" width="1.5" height="14" fill="{G}"/>', [(3.5, 3, 9, 3.5), (3.5, 9.5, 5.5, 3.5)]),
    'sel-align-right': align(f'<rect x="13.5" y="1" width="1.5" height="14" fill="{G}"/>', [(3.5, 3, 9, 3.5), (7, 9.5, 5.5, 3.5)]),
    'sel-center-h': align(f'<rect x="7.25" y="1" width="1.5" height="14" fill="{G}"/>', [(2.5, 3, 11, 3.5), (4.5, 9.5, 7, 3.5)]),
    'sel-align-top': align(f'<rect x="1" y="1" width="14" height="1.5" fill="{G}"/>', [(3, 3.5, 3.5, 9), (9.5, 3.5, 3.5, 5.5)]),
    'sel-align-bottom': align(f'<rect x="1" y="13.5" width="14" height="1.5" fill="{G}"/>', [(3, 3.5, 3.5, 9), (9.5, 7, 3.5, 5.5)]),
    'sel-center-v': align(f'<rect x="1" y="7.25" width="14" height="1.5" fill="{G}"/>', [(3, 2.5, 3.5, 11), (9.5, 4.5, 3.5, 7)]),
    'sel-center-both': align(f'<rect x="7.25" y="1" width="1.5" height="14" fill="{G}"/><rect x="1" y="7.25" width="14" height="1.5" fill="{G}"/>', [(4.5, 4.5, 7, 7)]),
    'outside-canvas': pdn(dash_rect(.5, .5, 15, 15, 'none') + f'<rect x="4" y="4" width="8" height="8" fill="{W}" stroke="{B}"/><rect x="9" y="9" width="5" height="5" fill="{L}" stroke="{B}" opacity=".85"/>'),
    'lock': pdn(LOCK),
    'unlock': pdn(UNLOCK),
    'svg-obj-hidden': pdn(f'<path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" fill="{W}" stroke="{G}"/><circle cx="8" cy="8" r="2.4" fill="{B}"/><path d="M2 14 14 2" stroke="{R}" stroke-width="1.6"/>'),
    'svg-obj-refresh': pdn(f'<path d="M13 8a5 5 0 1 1-1.5-3.6" fill="none" stroke="{B}" stroke-width="1.8"/><path d="M14 1v4.5H9.5z" fill="{B}"/>'),
    'sym-x': pdn(f'<path d="M8 1v14" stroke="{P}" stroke-dasharray="1.5 1"/><path d="M6.5 3v10L1 13z" fill="{L}" stroke="{B}"/><path d="M9.5 3v10L15 13z" fill="{P}"/>'),
    'sym-y': pdn(f'<path d="M1 8h14" stroke="{P}" stroke-dasharray="1.5 1"/><path d="M3 6.5h10L13 1z" fill="{L}" stroke="{B}"/><path d="M3 9.5h10L13 15z" fill="{P}"/>'),
    'mirror4': pdn(f'<path d="M8 1v14M1 8h14" stroke="{P}" stroke-dasharray="1.5 1"/><path d="M2 2l4 4H2z" fill="{B}"/><path d="M14 2l-4 4h4z" fill="{P}"/><path d="M2 14l4-4H2z" fill="{P}"/><path d="M14 14l-4-4h4z" fill="{B}"/>'),
    'brush-soft': pdn(f'<defs><radialGradient id="g"><stop offset="0" stop-color="{B}"/><stop offset="1" stop-color="{B}" stop-opacity="0"/></radialGradient></defs><circle cx="8" cy="8" r="7" fill="url(#g)"/>'),
    'brush-spray': pdn(''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{B}"/>' for x, y, r in ((8, 8, 1.4), (4, 6, 1), (12, 5, 1), (5, 12, 1), (12, 11, 1), (8, 3, .7), (2.5, 9, .7), (14, 8, .7), (9, 13.5, .7)))),
    'brush-square': pdn(f'<rect x="3" y="3" width="10" height="10" fill="{B}" stroke="{D}"/>'),
    'fill-none': pdn(f'<rect x="1.5" y="1.5" width="13" height="13" fill="{W}" stroke="{G}"/><path d="M2 14 14 2" stroke="{R}" stroke-width="1.6"/>'),
    'fill-gradient': pdn(f'<defs><linearGradient id="g"><stop offset="0" stop-color="{B}"/><stop offset="1" stop-color="{P}"/></linearGradient></defs><rect x="1.5" y="1.5" width="13" height="13" fill="url(#g)" stroke="{D}"/>'),
    'camera': pdn(CAMERA),
    'camera-raw': pdn(CAMERA + f'<rect x="0" y="10.5" width="7.5" height="5.5" rx="1" fill="{P}"/><path d="M1.6 15V12h1.4a.9.9 0 0 1 0 1.8H1.6M3 13.8 4 15M4.6 15l.9-3 .9 3M5 14h1" fill="none" stroke="{W}" stroke-width=".7"/>'),
    'photo': pdn(CAMERA),
    'film': pdn(FILM),
    'sequence': pdn(f'<rect x="5" y="1" width="10" height="8" fill="{L}" stroke="{B}"/><rect x="3" y="3.5" width="10" height="8" fill="{L}" stroke="{B}"/><rect x="1" y="6" width="10" height="8" fill="{B}" stroke="{D}"/>'),
    'render-low': pdn(f'<rect x="1" y="2" width="14" height="10" fill="{L}" stroke="{G}"/>' + ''.join(f'<rect x="{x}" y="{y}" width="3" height="3" fill="{B}"/>' for x, y in ((2, 3), (8, 3), (5, 6), (11, 6), (2, 9 - .5), (8, 8.5))) + f'<rect x="6" y="12" width="4" height="2" fill="{G}"/><rect x="4" y="14" width="8" height="1" fill="{G}"/>'),
    'render-now': pdn(f'<rect x="1" y="2" width="14" height="10" fill="{L}" stroke="{G}"/><path d="M6 4.5v5l4.5-2.5z" fill="{B}"/><rect x="6" y="12" width="4" height="2" fill="{G}"/><rect x="4" y="14" width="8" height="1" fill="{G}"/>'),
    'fx': pdn(f'<path d="M3 15c3 0 3-3 4-8s1-6 4-6" fill="none" stroke="{P}" stroke-width="1.8"/><path d="M4 6h7" stroke="{P}" stroke-width="1.6"/><path d="M14 2l.6 1.4L16 4l-1.4.6L14 6l-.6-1.4L12 4l1.4-.6z" fill="{Y}"/>'),
    'filter': pdn(f'<path d="M1 2h14L9.5 8.5V14l-3-1.5V8.5z" fill="{L}" stroke="{B}"/>'),
    'menu': pdn(f'<rect x="2" y="3" width="12" height="2" fill="{G}"/><rect x="2" y="7" width="12" height="2" fill="{G}"/><rect x="2" y="11" width="12" height="2" fill="{G}"/>'),
    'star': shape(STAR5, Y, '#e0b060'),
    'moon': shape('M10 1.5a6.5 6.5 0 1 0 4.5 11A5.5 5.5 0 0 1 10 1.5z', Y, '#e0b060'),
    'magnet': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 12.5h14M3.5 1v14" fill="none" stroke="#586070" stroke-dasharray="1.5 1"/><g transform="rotate(225 10 6.2)"><path d="M6.7 2.2v4a3.3 3.3 0 0 0 6.6 0v-4h-2.3v4a1 1 0 0 1-2 0v-4z" fill="#c85038" stroke="#c85038" stroke-width=".7"/><path d="M6.7 2.2h2.3v1.7H6.7zM11 2.2h2.3v1.7H11z" fill="#e8e8e8" stroke="#c85038" stroke-width=".7"/></g><circle cx="3.5" cy="12.5" r="1.8" fill="#4080b0" stroke="#386890"/></svg>',
    'layer-bounds': pdn(dash_rect(2.5, 2.5, 11, 11, 'none') + f'<rect x="4.5" y="4.5" width="7" height="7" fill="{B}"/>'),
    'layer-buffer': pdn(dash_rect(.5, 3.5, 15, 9, 'none') + f'<rect x="4" y="5.5" width="8" height="5" fill="{L}" stroke="{B}"/><path d="M1.5 8h2M12.5 8h2" stroke="{D}"/>'),
    'border': pdn(f'<rect x="1.5" y="1.5" width="13" height="13" fill="{B}" stroke="{D}"/><rect x="4.5" y="4.5" width="7" height="7" fill="{W}" stroke="{D}"/>'),
    'image-border': pdn(f'<rect x="1.5" y="1.5" width="13" height="13" fill="{B}" stroke="{D}"/><rect x="4.5" y="4.5" width="7" height="7" fill="{W}" stroke="{D}"/>'),
    'channels': pdn('<circle cx="5.5" cy="6" r="4" fill="#d08068" opacity=".85"/><circle cx="10.5" cy="6" r="4" fill="#70a858" opacity=".85"/><circle cx="8" cy="10.5" r="4" fill="#7878c0" opacity=".85"/>'),
    'columns': pdn(f'<rect x="1" y="2" width="4" height="12" fill="{L}" stroke="{B}"/><rect x="6" y="2" width="4" height="12" fill="{L}" stroke="{B}"/><rect x="11" y="2" width="4" height="12" fill="{B}" stroke="{D}"/>'),
    'gallery': pdn(''.join(f'<rect x="{x}" y="{y}" width="6" height="6" fill="{c}" stroke="{D}" stroke-width=".7"/>' for x, y, c in ((1, 1, L), (9, 1, B), (1, 9, P), (9, 9, Y)))),
    'phone': pdn(f'<rect x="4" y="1" width="8" height="14" rx="1.5" fill="{G}"/><rect x="5" y="2.5" width="6" height="9.5" fill="{L}"/><circle cx="8" cy="13.4" r=".8" fill="{W}"/>'),
    'external': pdn(f'<rect x="1.5" y="4.5" width="10" height="10" fill="{W}" stroke="{G}"/><path d="M9 1h6v6z" fill="{B}"/><path d="M14 2 7 9" stroke="{B}" stroke-width="1.6"/>'),
    'signature': pdn(f'<path d="M1 11c2-3 3-7 4.5-7S5 10 6.5 10s2-3 3.5-3 .5 2.5 2 2.5S14 8 15 8" fill="none" stroke="{B}" stroke-width="1.2"/><path d="M1 14h14" stroke="{G}"/>'),
    'github': pdn(f'<path d="M8 1a7 7 0 0 0-2.2 13.6c.35.07.48-.15.48-.34v-1.2c-1.95.42-2.36-.94-2.36-.94-.32-.81-.78-1.03-.78-1.03-.64-.44.05-.43.05-.43.7.05 1.07.72 1.07.72.63 1.07 1.64.76 2.04.58.06-.45.24-.76.44-.94-1.55-.18-3.19-.78-3.19-3.46 0-.76.27-1.39.72-1.88-.07-.18-.31-.89.07-1.85 0 0 .59-.19 1.92.72a6.6 6.6 0 0 1 3.5 0c1.33-.91 1.92-.72 1.92-.72.38.96.14 1.67.07 1.85.45.49.72 1.12.72 1.88 0 2.69-1.64 3.28-3.2 3.45.25.22.48.65.48 1.31v1.94c0 .19.12.41.48.34A7 7 0 0 0 8 1z" fill="{G}"/>'),
    'anim-onion': pdn(f'<rect x="1" y="5" width="8" height="8" fill="{L}" opacity=".5" stroke="{B}"/><rect x="4" y="3.5" width="8" height="8" fill="{L}" opacity=".75" stroke="{B}"/><rect x="7" y="2" width="8" height="8" fill="{B}" stroke="{D}"/>'),
    'anim-draw-step': pdn(f'<path d="M10 1.5l2.5 2.5-7 7H3V8.5z" fill="{Y}" stroke="#e0b060"/><path d="M8 14h7M13 12l2 2-2 2" fill="none" stroke="{B}" stroke-width="1.3"/>'),
    'halftone': pdn(''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{B}"/>' for x, y, r in ((3, 3, 2), (8, 3, 1.5), (13, 3, 1), (3, 8, 1.5), (8, 8, 1), (13, 8, .7), (3, 13, 1), (8, 13, .7), (13, 13, .4)))),
    'dither': pdn(''.join(f'<rect x="{x}" y="{y}" width="2" height="2" fill="{B if (x + y) % 4 == 0 else P}"/>' for x in range(1, 15, 2) for y in range(1, 15, 2) if (x * 3 + y) % 5 < 3)),
    'pastel': pdn(f'<path d="M11 1l4 4-8 8H3V9z" fill="#e8c8d8" stroke="#b86078"/><path d="M3 13l-2 2" stroke="{G}"/>'),
    'ascii': pdn('<rect x=".5" y="1.5" width="15" height="13" fill="#404850"/><path d="M2.5 11.5 4.5 4.5l2 7M3.2 9h2.6M9 6h4.5M9 9h4.5M10.5 4.5l-.8 7M12.8 4.5l-.8 7" fill="none" stroke="#90b878" stroke-width="1"/>'),
    'vhs': pdn(f'<rect x="1" y="3" width="14" height="10" rx="1" fill="#404850"/><circle cx="5" cy="8" r="2.2" fill="{W}"/><circle cx="11" cy="8" r="2.2" fill="{W}"/><rect x="1" y="11" width="14" height="1" fill="{R}"/><rect x="1" y="12" width="14" height="1" fill="#6898c0"/>'),
    'duotone': pdn(f'<circle cx="8" cy="8" r="7" fill="{B}"/><path d="M8 1a7 7 0 0 1 0 14z" fill="{Y}"/>'),
    'chromatic': pdn('<circle cx="6.5" cy="8" r="5" fill="#c87058" opacity=".75"/><circle cx="9.5" cy="8" r="5" fill="#6898c0" opacity=".75"/>'),
    'solarize': pdn(f'<circle cx="8" cy="8" r="4" fill="{Y}"/><path d="M8 4a4 4 0 0 1 0 8z" fill="{P}"/>' + ''.join(f'<rect x="7.4" y="0" width="1.2" height="2.5" fill="{Y}" transform="rotate({a} 8 8)"/>' for a in range(0, 360, 45))),
    'cube': pdn(f'<path d="M8 1l6.5 3.5v7L8 15l-6.5-3.5v-7z" fill="{L}" stroke="{B}"/><path d="M1.5 4.5 8 8l6.5-3.5M8 8v7" fill="none" stroke="{B}"/><path d="M8 8l6.5-3.5v7L8 15z" fill="{B}" opacity=".6"/>'),
    'dust': pdn(f'<rect x="1.5" y="1.5" width="13" height="13" fill="{L}" stroke="{B}"/>' + ''.join(f'<circle cx="{x}" cy="{y}" r=".8" fill="{G}"/>' for x, y in ((4, 5), (11, 3.5), (6, 11), (12, 12), (9, 7))) + f'<path d="M3 13l9-9" stroke="{W}" stroke-width="1.4"/>'),
    'remove-bg': pdn('<rect x="1" y="1" width="14" height="14" fill="#c0c8c8"/><path d="M1 1h3.5v3.5H1zm7 0h3.5v3.5H8zM4.5 4.5H8V8H4.5zm7 0H15V8h-3.5zM1 8h3.5v3.5H1zm7 0h3.5v3.5H8zm-3.5 3.5H8V15H4.5zm7 0H15V15h-3.5z" fill="#ffffff"/><circle cx="8" cy="6" r="2.5" fill="' + B + '"/><path d="M3.5 15a4.5 4.5 0 0 1 9 0z" fill="' + B + '"/>'),
    'chroma-key': pdn('<rect x="1" y="1" width="14" height="14" fill="#389880"/><circle cx="8" cy="6" r="2.5" fill="#e8d0a0"/><path d="M3.5 15a4.5 4.5 0 0 1 9 0z" fill="' + B + '"/>'),
    'keyboard': pdn(f'<rect x=".5" y="4" width="15" height="9" rx="1" fill="#e8e8e8" stroke="{G}"/>' + ''.join(f'<rect x="{x}" y="{y}" width="1.6" height="1.6" fill="{G}"/>' for x in (2, 4.5, 7, 9.5, 12) for y in (5.5, 8)) + f'<rect x="4" y="10.5" width="8" height="1.4" fill="{G}"/>'),
    'grad-method-simple': pdn(f'<defs><linearGradient id="g"><stop offset="0" stop-color="{B}"/><stop offset="1" stop-color="{W}"/></linearGradient></defs><rect x="1.5" y="3.5" width="13" height="9" fill="url(#g)" stroke="{D}"/>'),
    'grad-method-smart': pdn(f'<defs><linearGradient id="g"><stop offset="0" stop-color="{B}"/><stop offset="1" stop-color="{W}"/></linearGradient></defs><rect x="1.5" y="3.5" width="13" height="9" fill="url(#g)" stroke="{D}"/><path d="M12 .5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="{Y}"/>'),
    'cap-diamond': pdn(f'<path d="M1 8h9" stroke="{G}" stroke-width="2"/><path d="m12 4 4 4-4 4-4-4z" fill="{B}"/>'),
    'sel-grow': pdn(dash_rect(4.5, 4.5, 7, 7) + f'<path d="M1 1h3M1 1v3M15 1h-3M15 1v3M1 15h3M1 15v-3M15 15h-3M15 15v-3" stroke="{D}" stroke-width="1.4" fill="none"/><path d="M2 2l2.3 2.3M14 2l-2.3 2.3M2 14l2.3-2.3M14 14l-2.3-2.3" stroke="{B}" stroke-width="1.2"/>'),
    'warp-rect-lock': pdn(dash_rect(1.5, 1.5, 13, 13, 'none') + f'<g transform="translate(3.5 3) scale(.6)">{LOCK}</g>'),
    # formes : aplat bleu clair, contour bleu, comme l'outil Formes de Paint.NET
    'shape-round': pdn(f'<rect x="1.5" y="3" width="13" height="10" rx="3" fill="{L}" stroke="{B}"/>'),
    'shape-ellipse': pdn(f'<ellipse cx="8" cy="8" rx="6.5" ry="5" fill="{L}" stroke="{B}"/>'),
    'shape-triangle': shape('M8 1.5 14.5 14h-13z'),
    'shape-triangle-right': shape('M2 1.5V14h12.5z'),
    'shape-diamond': shape('M8 1 15 8 8 15 1 8z'),
    'shape-trapezoid': shape('M4.5 3h7l3 10h-13z'),
    'shape-parallelogram': shape('M5 3h10l-4 10H1z'),
    'shape-pentagon': shape('M8 1.5l6.5 4.7-2.5 7.8H4L1.5 6.2z'),
    'shape-hexagon': shape('M4.5 2h7L15 8l-3.5 6h-7L1 8z'),
    'shape-heptagon': shape('M8 1.3l5.2 2.5 1.3 5.6-3.6 4.6H5.1L1.5 9.4l1.3-5.6z'),
    'shape-octagon': shape('M5.2 1.5h5.6l3.7 3.7v5.6l-3.7 3.7H5.2l-3.7-3.7V5.2z'),
    'shape-star-4': shape('M8 1l1.8 5.2L15 8l-5.2 1.8L8 15l-1.8-5.2L1 8l5.2-1.8z'),
    'shape-star-5': shape(STAR5),
    'shape-star-6': shape('M8 1l2 3.5h4L12 8l2 3.5h-4L8 15l-2-3.5H2L4 8 2 4.5h4z'),
    'shape-star-thin': shape('M8 1l1.1 5.9L15 8l-5.9 1.1L8 15l-1.1-5.9L1 8l5.9-1.1z'),
    'shape-arrow': shape('M1.5 5.5h7V2l6 6-6 6v-3.5h-7z'),
    'shape-cross': shape('M5.5 1.5h5v4h4v5h-4v4h-5v-4h-4v-5h4z'),
    'shape-heart': shape('M8 14.5S1.5 10.4 1.5 5.8A3.3 3.3 0 0 1 8 4.4a3.3 3.3 0 0 1 6.5 1.4C14.5 10.4 8 14.5 8 14.5z', '#d08068', R),
    'shape-callout-rect': shape('M1.5 2h13v8.5H7L3.5 14v-3.5h-2z'),
    'shape-callout-round': shape('M3.5 2h9a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H7L3.5 14v-3.5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z'),
    'shape-callout-oval': shape('M8 2c3.6 0 6.5 2.1 6.5 4.8S11.6 11.6 8 11.6c-.7 0-1.4-.1-2-.2L2.5 14l1-3.4C2.2 9.7 1.5 8.4 1.5 6.8 1.5 4.1 4.4 2 8 2z'),
    'shape-callout-cloud': shape('M12 11H5a3.5 3.5 0 1 1 1.2-6.8A3.7 3.7 0 0 1 13 5.5 2.8 2.8 0 0 1 12 11z'),
}

# Clés d'outils (tool/N) et doublons : fichier à réutiliser
CUSTOM_ALIAS = {
    'tool-magnetic-lasso': 'lasso-magnetic', 'tool-quick-select': 'quick-select', 'tool-object-select': 'object-select',
    'sel-free-corners': 'warp4', 'svg-obj-locked': 'lock', 'svg-obj-unlocked': 'unlock', 'tool-deform': 'deform',
    'align-center-h': 'sel-center-h', 'align-center-v': 'sel-center-v', 'align-top': 'sel-align-top',
    'align-bottom': 'sel-align-bottom', 'shape-round': 'shape-round', 'fill-solid': 'shape-fill',
}

README = """Icônes dessinées pour MasterPaint (polocrafting, 2026) là où le projet de référence n'a pas
d'équivalent. Elles ne viennent pas de {project} : à garder à part de ses fichiers d'origine.
Style : {style}. Nom de fichier = nom MasterPaint de l'icône. Générées par
tools/gen_custom_pack_icons.py ; on peut aussi les retoucher ici à la main (relancer ensuite
tools/build_reference_packs.py, sans relancer ce script, sinon les retouches sont écrasées).
"""

if __name__ == '__main__':
    for pack, icons, style, wrap, project in (('photocraft', PHOTO, 'Lucide, trait de 2 px', lucide, 'PhotoCraft / Lucide'),
                                               ('paintdotjs', PAINT, 'aplats colorés Paint.NET', lambda b: b, 'paintdotjs / Paint.NET')):
        out = ROOT / pack / 'custom'
        out.mkdir(parents=True, exist_ok=True)
        for old in out.glob('*.svg'):
            old.unlink()
        for name, body in icons.items():
            (out / f'{name}.svg').write_text(HEAD.format(pack=project, style=style) + wrap(body) + '\n')
        (out / 'README.md').write_text(README.format(project=project, style=style))
        print(pack, len(icons), 'icônes dessinées')
