"""Génère js/app/i18n-pdn.js à partir des ressources officielles de Paint.NET (FR/EN/DE/ES/IT).`n`nUsage (Paint.NET installé) : python -I tools/pdn-import/make_i18n.py js/app/i18n-pdn.js`n"""
import json, os, subprocess, sys

S = os.path.dirname(os.path.abspath(__file__))
TMP = os.environ.get('TEMP', S)
PDN = r"C:\Program Files\paint.net"
LANGS = {'fr': 'FR', 'en': None, 'de': 'DE', 'es': 'ES', 'it': 'it'}

def load(code):
    name = 'PaintDotNet.Strings.3.resources' if code is None else 'PaintDotNet.Strings.3.%s.resources' % code
    out = os.path.join(TMP, 'pdn_res_%s.tsv' % (code or 'en'))
    subprocess.run([sys.executable, '-I', os.path.join(S, 'dumpres.py'), os.path.join(PDN, name), out], check=True, capture_output=True)
    d = {}
    for line in open(out, encoding='utf-8'):
        k, _, v = line.rstrip('\n').partition('\t')
        d[k] = v.replace('&', '')
    return d

# clé MasterPaint -> clé de ressource Paint.NET (+ suffixe « … » pour les effets à dialogue)
MAP = {
    'pdn.adjAutoLevel': ('AutoLevelEffect.Name', ''),
    'pdn.adjBlackWhite': ('DesaturateEffect.Name', ''),
    'pdn.adjBrightness': ('BrightnessAndContrastAdjustment.Name', '…'),
    'pdn.adjCurves': ('CurvesEffect.Name', '…'),
    'pdn.adjExposure': ('ExposureEffect.Name', '…'),
    'pdn.adjHighlightsShadows': ('HighlightsAndShadowsEffect.Name', '…'),
    'pdn.adjHueSat': ('HueAndSaturationAdjustment.Name', '…'),
    'pdn.adjInvertAlpha': ('InvertAlphaEffect.Name', ''),
    'pdn.adjInvertColors': ('InvertColorsEffect.Name', ''),
    'pdn.adjLevels': ('LevelsEffect.Name', '…'),
    'pdn.adjPosterize': ('PosterizeAdjustment.Name', '…'),
    'pdn.adjSepia': ('SepiaEffect.Name', ''),
    'pdn.adjTempTint': ('TemperatureAndTintEffect.Name', '…'),
    'pdn.fxArtistic': ('Effects.Artistic.Submenu.Name', ''),
    'pdn.fxBlurs': ('Effects.Blurring.Submenu.Name', ''),
    'pdn.fxColor': ('Effects.Color.Submenu.Name', ''),
    'pdn.fxDistort': ('Effects.Distort.Submenu.Name', ''),
    'pdn.fxNoise': ('Effects.Noise.Submenu.Name', ''),
    'pdn.fxObject': ('Effects.Object.Submenu.Name', ''),
    'pdn.fxPhoto': ('Effects.Photo.Submenu.Name', ''),
    'pdn.fxRender': ('Effects.Render.Submenu.Name', ''),
    'pdn.fxStylize': ('Effects.Stylize.Submenu.Name', ''),
    'pdn.fxInkSketch': ('InkSketchEffect.Name', '…'),
    'pdn.fxOilPainting': ('OilPaintingEffect.Name', '…'),
    'pdn.fxPencilSketch': ('PencilSketchEffect.Name', '…'),
    'pdn.fxFragment': ('FragmentEffect.Name', '…'),
    'pdn.fxGaussian': ('BlurEffect.Name', '…'),
    'pdn.fxMotionBlur': ('MotionBlurEffect.Name', '…'),
    'pdn.fxRadialBlur': ('RadialBlurEffect.Name', '…'),
    'pdn.fxSketchBlur': ('SketchBlurEffect.Name', '…'),
    'pdn.fxSquareBlur': ('SquareBlurEffect.Name', '…'),
    'pdn.fxSurfaceBlur': ('SurfaceBlurEffect.Name', '…'),
    'pdn.fxZoomBlur': ('ZoomBlurEffect.Name', '…'),
    'pdn.fxQuantize': ('QuantizeEffect.Name', '…'),
    'pdn.fxBulge': ('BulgeEffect.Name', '…'),
    'pdn.fxDents': ('DentsEffect.Name', '…'),
    'pdn.fxCrystallize': ('CrystalizeEffect.Name', '…'),
    'pdn.fxFrostedGlass': ('FrostedGlassEffect.Name', '…'),
    'pdn.fxMorphology': ('MorphologyEffect.Name', '…'),
    'pdn.fxPixelate': ('PixelateEffect.Name', '…'),
    'pdn.fxTileReflection': ('TileEffect.Name', '…'),
    'pdn.fxTwist': ('TwistEffect.Name', '…'),
    'pdn.fxAddNoise': ('AddNoiseEffect.Name', '…'),
    'pdn.fxMedian': ('MedianEffect.Name', '…'),
    'pdn.fxReduceNoise': ('ReduceNoiseEffect.Name', '…'),
    'pdn.fxDropShadow': ('DropShadowEffect.Name', '…'),
    'pdn.fxGlow': ('GlowEffect.Name', '…'),
    'pdn.fxRedEye': ('RedEyeRemoveEffect.Name', '…'),
    'pdn.fxSharpen': ('SharpenEffect.Name', '…'),
    'pdn.fxSoftenPortrait': ('SoftenPortraitEffect.Name', '…'),
    'pdn.fxStraighten': ('StraightenEffect.Name', '…'),
    'pdn.fxVignette': ('VignetteEffect.Name', '…'),
    'pdn.fxClouds': ('CloudsEffect.Name', '…'),
    'pdn.fxJulia': ('JuliaFractalEffect.Name', '…'),
    'pdn.fxMandelbrot': ('MandelbrotFractalEffect.Name', '…'),
    'pdn.fxTurbulence': ('TurbulenceEffect.Name', '…'),
    'pdn.fxEdgeDetect': ('EdgeDetectEffect.Name', '…'),
    'pdn.fxEmboss': ('EmbossEffect.Name', '…'),
    'pdn.fxOutline': ('OutlineEffect.Name', '…'),
    'pdn.fxRelief': ('ReliefEffect.Name', '…'),
    'pdn.fxRotateZoom': ('RotateZoomEffect.Name', '…'),
    # menus
    'pdn.menuView': ('Menu.View.Text', ''),
    'pdn.viewZoomIn': ('Menu.View.ZoomIn.Text', ''),
    'pdn.viewZoomOut': ('Menu.View.ZoomOut.Text', ''),
    'pdn.viewZoomToWindow': ('Menu.View.ZoomToWindow.Text', ''),
    'pdn.viewZoomToSelection': ('Menu.View.ZoomToSelection.Text', ''),
    'pdn.viewActualSize': ('Menu.View.ActualSize.Text', ''),
    'pdn.viewGrid': ('Menu.View.Grid.Text', ''),
    'pdn.viewRulers': ('Menu.View.Rulers.Text', ''),
    'pdn.editUndo': ('Menu.Edit.Undo.Text', ''),
    'pdn.editRedo': ('Menu.Edit.Redo.Text', ''),
    'pdn.editCut': ('Menu.Edit.Cut.Text', ''),
    'pdn.editCopy': ('Menu.Edit.Copy.Text', ''),
    'pdn.editPaste': ('Menu.Edit.Paste.Text', ''),
    'pdn.editPasteNewLayer': ('Menu.Edit.PasteInToNewLayer.Text', ''),
    'pdn.editPasteNewImage': ('Menu.Edit.PasteInToNewImage.Text', ''),
    'pdn.editSelectAll': ('Menu.Edit.SelectAll.Text', ''),
    'pdn.editDeselect': ('Menu.Edit.Deselect.Text', ''),
    'pdn.editEraseSelection': ('Menu.Edit.EraseSelection.Text', ''),
    'pdn.editFillSelection': ('Menu.Edit.FillSelection.Text', ''),
    'pdn.editInvertSelection': ('Menu.Edit.InvertSelection.Text', ''),
    'pdn.imageCrop': ('Menu.Image.Crop.Text', ''),
    'pdn.imageResize': ('Menu.Image.Resize.Text', ''),
    'pdn.imageCanvasSize': ('Menu.Image.CanvasSize.Text', ''),
    'pdn.imageFlipH': ('Menu.Image.FlipHorizontal.Text', ''),
    'pdn.imageFlipV': ('Menu.Image.FlipVertical.Text', ''),
    'pdn.imageRotateCW': ('Menu.Image.Rotate90CW.Text', ''),
    'pdn.imageRotateCCW': ('Menu.Image.Rotate90CCW.Text', ''),
    'pdn.imageRotate180': ('Menu.Image.Rotate180.Text', ''),
    'pdn.imageFlatten': ('Menu.Image.Flatten.Text', ''),
    'pdn.layerAdd': ('Menu.Layers.AddNewLayer.Text', ''),
    'pdn.layerDelete': ('Menu.Layers.DeleteLayer.Text', ''),
    'pdn.layerDuplicate': ('Menu.Layers.DuplicateLayer.Text', ''),
    'pdn.layerMergeDown': ('Menu.Layers.MergeLayerDown.Text', ''),
    'pdn.layerImport': ('Menu.Layers.ImportFromFile.Text', ''),
    'pdn.layerFlipH': ('Menu.Layers.FlipHorizontal.Text', ''),
    'pdn.layerFlipV': ('Menu.Layers.FlipVertical.Text', ''),
    'pdn.layerRotate180': ('Menu.Layers.Rotate180.Text', ''),
    'pdn.layerMoveUp': ('Menu.Layers.MoveLayerUp.Text', ''),
    'pdn.layerMoveDown': ('Menu.Layers.MoveLayerDown.Text', ''),
    'pdn.layerProperties': ('Menu.Layers.LayerProperties.Text', ''),
    'pdn.winTools': ('Menu.Window.Tools.Text', ''),
}

EXTRA = {
    # clés sans équivalent direct dans les ressources (ou fusions MasterPaint)
    'pdn.adjAutoLevel': {'fr': 'Auto-niveau', 'en': 'Auto-Level', 'de': 'Automatisch abgleichen', 'es': 'Nivel automático', 'it': 'Livelli automatici'},
    'pdn.fxRepeat': {'fr': 'Répéter', 'en': 'Repeat', 'de': 'Wiederholen', 'es': 'Repetir', 'it': 'Ripeti'},
    'pdn.fxBokeh': {'fr': 'Flou bokeh / Défocaliser…', 'en': 'Bokeh Blur / Unfocus…', 'de': 'Bokeh-Weichzeichner / Unschärfe…',
                    'es': 'Desenfoque bokeh / Desenfocar…', 'it': 'Sfocatura bokeh / Sfuoca…'},
    'pdn.fxPolarInversion': {'fr': 'Inversion polaire…', 'en': 'Polar Inversion…', 'de': 'Polare Inversion…',
                             'es': 'Inversión polar…', 'it': 'Inversione polare…'},
    'pdn.fxOutlineObject': {'fr': "Contour d'objet…", 'en': 'Outline Object…', 'de': 'Objektkontur…',
                            'es': 'Contorno de objeto…', 'it': 'Contorno oggetto…'},
    'settings.toolbarStyle': {'fr': "Barre d'options", 'en': 'Options bar', 'de': 'Optionsleiste', 'es': 'Barra de opciones', 'it': 'Barra opzioni'},
    'settings.toolbarStylePdn': {'fr': 'Style Paint.NET', 'en': 'Paint.NET style', 'de': 'Paint.NET-Stil', 'es': 'Estilo Paint.NET', 'it': 'Stile Paint.NET'},
    'settings.toolbarStyleRibbon': {'fr': 'Ruban MasterPaint', 'en': 'MasterPaint ribbon', 'de': 'MasterPaint-Menüband',
                                    'es': 'Cinta MasterPaint', 'it': 'Barra multifunzione MasterPaint'},
    'settings.rustEngine': {'fr': 'Moteur Rust (effets)', 'en': 'Rust engine (effects)', 'de': 'Rust-Engine (Effekte)',
                            'es': 'Motor Rust (efectos)', 'it': 'Motore Rust (effetti)'},
}

# titres des dialogues (effect.title.<id>) : mêmes noms, sans « … »
TITLES = {
    'invertalpha': 'pdn.adjInvertAlpha', 'highlightsshadows': 'pdn.adjHighlightsShadows', 'quantize': 'pdn.fxQuantize',
    'sketchblur': 'pdn.fxSketchBlur', 'morphology': 'pdn.fxMorphology', 'turbulence': 'pdn.fxTurbulence',
    'straighten': 'pdn.fxStraighten', 'rotatezoom': 'pdn.fxRotateZoom', 'outline': 'pdn.fxOutline', 'relief': 'pdn.fxRelief',
    'emboss': 'pdn.fxEmboss', 'unfocus': 'pdn.fxBokeh', 'blur': 'pdn.fxSquareBlur', 'median': 'pdn.fxMedian',
    'reducenoise': 'pdn.fxReduceNoise', 'sketch': 'pdn.fxInkSketch', 'softglow': 'pdn.fxGlow', 'unsharp': 'pdn.fxSharpen',
    'dents': 'pdn.fxDents', 'fragment': 'pdn.fxFragment', 'motionblur': 'pdn.fxMotionBlur', 'contour': 'pdn.fxOutlineObject',
    'edges': 'pdn.fxEdgeDetect', 'redeyeremove': 'pdn.fxRedEye', 'softenportrait': 'pdn.fxSoftenPortrait',
    'vignette': 'pdn.fxVignette', 'addnoise': 'pdn.fxAddNoise', 'bulge': 'pdn.fxBulge', 'exposure': 'pdn.adjExposure',
    'temptint': 'pdn.adjTempTint', 'oil': 'pdn.fxOilPainting', 'tileReflect': 'pdn.fxTileReflection',
    'crystallize': 'pdn.fxCrystallize', 'frosted': 'pdn.fxFrostedGlass',
}

def main(out_path):
    res = {k: load(v) for k, v in LANGS.items()}
    bundles = {k: {} for k in LANGS}
    for key, (rk, suffix) in MAP.items():
        for lang, d in res.items():
            v = d.get(rk) or res['en'].get(rk)
            if v is None:
                continue
            v = v.split('\\n')[0].strip()
            # retire « (F5) » etc. pour la clé des fenêtres
            if suffix and not v.endswith('…') and not v.endswith('...'):
                v = v + suffix
            bundles[lang][key] = v
    for key, per in EXTRA.items():
        for lang in LANGS:
            bundles[lang][key] = per[lang]
    # « Quantize » n'est pas traduit dans la ressource FR de Paint.NET
    bundles['fr']['pdn.fxQuantize'] = 'Quantifier…'
    bundles['fr']['pdn.fxBokeh'] = EXTRA['pdn.fxBokeh']['fr']
    for eff, key in TITLES.items():
        for lang in LANGS:
            v = bundles[lang].get(key)
            if v:
                bundles[lang]['effect.title.' + eff] = v.rstrip('…').rstrip('.').strip()
    js = ['/**',
          ' * i18n-pdn.js — libellés des menus et effets repris de Paint.NET 5 (générés depuis ses',
          ' * ressources officielles FR/EN/DE/ES/IT par tools/pdn-import/make_i18n.py), fusionnés dans',
          ' * IlluI18n.BUNDLES. Les titres de dialogues effect.title.* suivent les noms Paint.NET.',
          ' */',
          '(function () {',
          "    'use strict';",
          '    const I = window.IlluI18n;',
          '    if (!I || !I.BUNDLES) return;',
          '    const ADD = ' + json.dumps(bundles, ensure_ascii=False, indent=4, sort_keys=True).replace('\n', '\n    ') + ';',
          '    Object.keys(ADD).forEach((lang) => {',
          '        if (!I.BUNDLES[lang]) return;',
          '        Object.assign(I.BUNDLES[lang], ADD[lang]);',
          '    });',
          "    if (typeof I.apply === 'function') I.apply();",
          '})();', '']
    open(out_path, 'w', encoding='utf-8').write('\n'.join(js))
    print('ok', {k: len(v) for k, v in bundles.items()})

main(sys.argv[1])
