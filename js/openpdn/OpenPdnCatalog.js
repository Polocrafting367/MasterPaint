/**
 * Inventaire OpenPDN → MasterPaint : ce qui est portable (algorithmes réécrits, pas le C#).
 * Référence : OpenPDN-master/ (Paint.NET 3.x, Rick Brewster / dotPDN).
 */
(function (global) {
    'use strict';

    const PORT = {
        YES: 'oui',
        PARTIAL: 'partiel',
        NO: 'non',
        WASM: 'wasm',
        UI: 'ui-seul'
    };

    /** @type {Record<string, {id:string, pdn:string, status:string, note?:string}[]>} */
    const EFFECTS = {
        adjustment: [
            { id: 'autolevel', pdn: 'AutoLevelEffect', status: PORT.YES, note: 'IlluImageAdjustCore + menu' },
            { id: 'brightness', pdn: 'BrightnessAndContrastAdjustment', status: PORT.YES },
            { id: 'curves', pdn: 'CurvesEffect', status: PORT.PARTIAL, note: 'LevelsPanel partiel' },
            { id: 'grayscale', pdn: 'DesaturateEffect', status: PORT.YES },
            { id: 'hsv', pdn: 'HueAndSaturationAdjustment', status: PORT.YES },
            { id: 'invert', pdn: 'InvertColorsEffect', status: PORT.YES },
            { id: 'levels', pdn: 'LevelsEffect', status: PORT.PARTIAL, note: 'LevelsPanel' },
            { id: 'posterize', pdn: 'PosterizeAdjustment', status: PORT.YES },
            { id: 'sepia', pdn: 'SepiaEffect', status: PORT.YES }
        ],
        blur: [
            { id: 'gaussian', pdn: 'GaussianBlurEffect', status: PORT.YES },
            { id: 'blur', pdn: 'BlurEffect', status: PORT.YES },
            { id: 'motionblur', pdn: 'MotionBlurEffect', status: PORT.YES, note: 'pdn-effects.js' },
            { id: 'radialblur', pdn: 'RadialBlurEffect', status: PORT.PARTIAL },
            { id: 'zoomblur', pdn: 'ZoomBlurEffect', status: PORT.PARTIAL },
            { id: 'surfaceblur', pdn: 'SurfaceBlurEffect', status: PORT.PARTIAL, note: 'pdn-effects.js simplifié' },
            { id: 'unfocus', pdn: 'UnfocusEffect', status: PORT.NO },
            { id: 'fragment', pdn: 'FragmentEffect', status: PORT.PARTIAL, note: 'pdn-effects.js' }
        ],
        distort: [
            { id: 'bulge', pdn: 'BulgeEffect', status: PORT.PARTIAL },
            { id: 'twist', pdn: 'TwistEffect', status: PORT.YES },
            { id: 'pixelate', pdn: 'PixelateEffect', status: PORT.YES },
            { id: 'tileReflect', pdn: 'TileEffect', status: PORT.PARTIAL },
            { id: 'polarInvert', pdn: 'PolarInversionEffect', status: PORT.PARTIAL },
            { id: 'dents', pdn: 'DentsEffect', status: PORT.NO }
        ],
        render: [
            { id: null, pdn: 'CloudsEffect', status: PORT.NO },
            { id: null, pdn: 'MandelbrotFractalEffect', status: PORT.NO },
            { id: null, pdn: 'JuliaFractalEffect', status: PORT.NO },
            { id: null, pdn: 'ColorFillEffect', status: PORT.PARTIAL }
        ],
        noise: [
            { id: 'addnoise', pdn: 'AddNoiseEffect', status: PORT.YES },
            { id: 'median', pdn: 'MedianEffect', status: PORT.PARTIAL },
            { id: null, pdn: 'ReduceNoiseEffect', status: PORT.NO }
        ],
        photo: [
            { id: 'softglow', pdn: 'GlowEffect', status: PORT.PARTIAL },
            { id: 'sharpen', pdn: 'SharpenEffect', status: PORT.YES },
            { id: null, pdn: 'SoftenPortraitEffect', status: PORT.NO },
            { id: 'redeyeremove', pdn: 'RedEyeRemoveEffect', status: PORT.YES },
            { id: 'vignette', pdn: 'VignetteEffect', status: PORT.YES }
        ],
        artistic: [
            { id: 'oil', pdn: 'OilPaintingEffect', status: PORT.YES },
            { id: 'sketch', pdn: 'InkSketchEffect', status: PORT.PARTIAL },
            { id: null, pdn: 'PencilSketchEffect', status: PORT.NO },
            { id: 'frosted', pdn: 'FrostedGlassEffect', status: PORT.YES }
        ],
        stylize: [
            { id: 'emboss', pdn: 'EmbossEffect', status: PORT.YES },
            { id: 'edges', pdn: 'EdgeDetectEffect', status: PORT.YES },
            { id: null, pdn: 'OutlineEffect', status: PORT.NO },
            { id: null, pdn: 'ReliefEffect', status: PORT.PARTIAL },
            { id: 'fragment', pdn: 'FragmentEffect', status: PORT.PARTIAL }
        ],
        other: [{ id: null, pdn: 'RotateZoomEffect', status: PORT.PARTIAL, note: 'menu calques PDN' }]
    };

    const IO = [
        {
            format: '.pdn',
            pdn: 'PdnFileType',
            load: PORT.PARTIAL,
            save: PORT.PARTIAL,
            note: 'PdnFile.js — pixels + MPDN ; pas BinaryFormatter .NET complet'
        },
        { format: '.png', pdn: 'PngFileType', load: PORT.YES, save: PORT.YES, note: 'navigateur' },
        { format: '.jpg', pdn: 'JpegFileType', load: PORT.YES, save: PORT.YES, note: 'navigateur' },
        { format: '.webp', pdn: '—', load: PORT.YES, save: PORT.YES, note: 'MasterPaint uniquement' },
        { format: '.illu', pdn: '—', load: PORT.YES, save: PORT.YES, note: 'projet natif MasterPaint' },
        { format: '.bmp/.gif', pdn: 'Bmp/Gif', load: PORT.PARTIAL, save: PORT.PARTIAL },
        { format: '.tiff/.dds', pdn: 'GdiPlus/Tga/Dds', load: PORT.NO, save: PORT.NO, note: 'GDI+ / Squish natif' }
    ];

    const LAYERS = {
        concepts: [
            'LayerList, ordre, visibilité, opacité',
            'BitmapLayer + Surface BGRA',
            'Composition Document.Render() par ROI'
        ],
        blendModesPdn: [
            'Normal',
            'Multiply',
            'Additive',
            'ColorBurn',
            'ColorDodge',
            'Reflect',
            'Glow',
            'Overlay',
            'Difference',
            'Negation',
            'Lighten',
            'Darken',
            'Screen',
            'Xor'
        ],
        masterPaint: 'Canvas mix-blend-mode + opacité ; voir PdnBlendModes.js',
        portability: PORT.PARTIAL
    };

    const PREVIEW = {
        pdn: 'BackgroundEffectRenderer — tuiles × CPU, événement RenderedTile',
        masterPaint: 'FilterManager workers + aperçu basse résolution',
        portability: PORT.YES
    };

    const OPTIMIZATION = [
        { name: 'Tuiles / workers', pdn: 'BackgroundEffectRenderer, Document.threadPool', status: PORT.YES },
        { name: 'BGRA unsafe', pdn: 'Surface, MemoryBlock', status: PORT.YES, note: 'ImageData / WASM' },
        { name: 'Sérialisation différée', pdn: 'DeferredFormatter + MemoryBlock', status: PORT.PARTIAL, note: 'PdnFile.js' },
        { name: 'SIMD DDS', pdn: 'DdsFileType/Squish', status: PORT.NO },
        { name: 'Registre Windows', pdn: 'SystemLayer/Settings.cs', status: PORT.NO }
    ];

    const NOT_PORTABLE = [
        { cat: 'Interface', why: 'WinForms, MainForm, menus natifs — MasterPaint a HTML/CSS' },
        { cat: 'Pilotes / OS', why: 'WIA scan, stylet, ShellExtension, GDI+ direct' },
        { cat: 'Plugins DLL', why: 'FileTypes, CodeLab, effets tiers compilés' },
        { cat: 'Paramètres système', why: 'Registre HKCU, MRU chemins Windows' }
    ];

    function summary() {
        let total = 0;
        let ported = 0;
        Object.keys(EFFECTS).forEach((cat) => {
            EFFECTS[cat].forEach((e) => {
                total++;
                if (e.status === PORT.YES || e.status === PORT.WASM) ported++;
                else if (e.status === PORT.PARTIAL && e.id) ported += 0.5;
            });
        });
        return {
            effectEntries: total,
            effectPortedApprox: Math.round(ported),
            ioFormats: IO,
            layerBlendModes: LAYERS.blendModesPdn.length,
            notPortable: NOT_PORTABLE
        };
    }

    function missingEffects() {
        const out = [];
        Object.keys(EFFECTS).forEach((cat) => {
            EFFECTS[cat].forEach((e) => {
                if (e.status === PORT.NO || (e.status === PORT.PARTIAL && !e.id)) {
                    out.push({ category: cat, pdn: e.pdn, status: e.status, note: e.note });
                }
            });
        });
        return out;
    }

    const OpenPdnCatalog = {
        PORT,
        EFFECTS,
        IO,
        LAYERS,
        PREVIEW,
        OPTIMIZATION,
        NOT_PORTABLE,
        summary,
        missingEffects
    };

    global.OpenPdnCatalog = OpenPdnCatalog;
})(typeof window !== 'undefined' ? window : globalThis);
