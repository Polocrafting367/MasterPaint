// --- FilterManager.js ---
// Gestion des filtres mathématiques avec Modales Intégrées (Live Preview)

/**
 * Art ASCII : rampes de caractères prédéfinies, ordonnées du MOINS dense (espace) au PLUS dense.
 * L'index est choisi d'après la luminance de la cellule ; « Inverser » retourne la rampe
 * (encre claire sur fond sombre ↔ encre sombre sur fond clair).
 */
const ILLU_ASCII_RAMPS = {
    standard: ' .:-=+*#%@',
    detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
    blocks: ' ░▒▓█',
    dots: ' .·◦•●',
    binary: ' 10'
};

const EFFECT_PARAM_DEFAULTS = {
    brightness: { 'ef-b': '0', 'ef-c': '0' },
    hsv: { 'ef-h': '0', 'ef-s': '0', 'ef-l': '0' },
    blur: { 'ef-rad': '2', 'ef-ca': '0', 'ef-ca-amt': '8' },
    halftone: {
        'ef-half-rad': '4',
        'ef-half-mode': 'bw',
        'ef-half-angle': '45',
        'ef-half-paper': 'white',
        'ef-half-k': '1',
        'ef-half-invert': '0',
        'ef-half-dc': '100',
        'ef-half-dm': '100',
        'ef-half-dy': '100',
        'ef-half-dk': '100',
        'ef-half-gain': '0'
    },
    gaussian: { 'ef-rad': '2', 'ef-ca': '0', 'ef-ca-amt': '8' },
    pixelate: { 'ef-size': '10' },
    posterize: { 'ef-lvl': '4' },
    addnoise: { 'ef-int': '20' },
    bulge: { 'ef-bulge': '40', 'ef-ca': '0', 'ef-ca-amt': '8' },
    pinch: { 'ef-pinch': '40', 'ef-ca': '0', 'ef-ca-amt': '8' },
    twist: { 'ef-twist': '30', 'ef-ca': '0', 'ef-ca-amt': '8' },
    crystallize: { 'ef-cry': '12' },
    polarInvert: { 'ef-polar': '80', 'ef-ca': '0', 'ef-ca-amt': '8' },
    tileReflect: { 'ef-tile': '24', 'ef-ca': '0', 'ef-ca-amt': '8' },
    frosted: { 'ef-frost': '8', 'ef-ca': '0', 'ef-ca-amt': '8' },
    vignette: { 'ef-vig': '50' },
    softglow: { 'ef-glow-r': '6', 'ef-glow-a': '40' },
    edges: { 'ef-edge': '40' },
    emboss: { 'ef-emb': '12' },
    solarize: { 'ef-sol': '128' },
    threshold: { 'ef-thr': '128' },
    vibrance: { 'ef-vibr': '50' },
    unsharp: { 'ef-us-amount': '80', 'ef-us-radius': '3', 'ef-us-threshold': '0' },
    radialblur: { 'ef-rblur-angle': '2', 'ef-rblur-quality': '2', 'ef-rblur-ox': '0', 'ef-rblur-oy': '0', 'ef-rblur-inner': '0', 'ef-ca': '0', 'ef-ca-amt': '8' },
    zoomblur:   { 'ef-zblur-amount': '10', 'ef-zblur-ox': '0', 'ef-zblur-oy': '0', 'ef-zblur-inner': '0', 'ef-ca': '0', 'ef-ca-amt': '8' },
    motionblur: { 'ef-mblur-angle': '25', 'ef-mblur-dist': '10', 'ef-mblur-center': '1', 'ef-ca': '0', 'ef-ca-amt': '8' },
    surfaceblur: { 'ef-sblur-r': '6', 'ef-sblur-t': '15', 'ef-ca': '0', 'ef-ca-amt': '8' },
    fragment: { 'ef-frag-n': '4', 'ef-frag-d': '8', 'ef-frag-r': '0', 'ef-ca': '0', 'ef-ca-amt': '8' },
    oil: { 'ef-oil': '4' },
    projection3d: {
        'ef-3d-rx': '0', 'ef-3d-ry': '0', 'ef-3d-f': '280', 'ef-3d-z': '100',
        'ef-3d-tl': '0', 'ef-3d-tr': '0', 'ef-3d-br': '0', 'ef-3d-bl': '0'
    },
chroma: {
        'ef-ch-r': '0', 'ef-ch-g': '255', 'ef-ch-b': '0',
        'ef-ch-use2': '0', 'ef-ch-r2': '0', 'ef-ch-g2': '180', 'ef-ch-b2': '0',
        'ef-ch-tol': '30', 'ef-ch-feather': '15',
        'ef-ch-drift': '50', 'ef-ch-black': '0', 'ef-ch-white': '100',
        'ef-ch-luma': '0', 'ef-ch-recover': '0',
        'ef-ch-spill': '0', 'ef-ch-gamma': '1.0'
    },
    cabossage: {
        'ef-cab-scale': '25',
        'ef-cab-refr': '50',
        'ef-cab-rough': '10',
        'ef-cab-tension': '10',
        'ef-cab-q': '2',
        'ef-ca': '0',
        'ef-ca-amt': '8'
    },
    argenticgrain: { 'ef-grain': '40' },
    digitalpattern: { 'ef-grain': '40', 'ef-grain-fine': '15' },
    chromatic: { 'ef-chr': '6' },
    sharpen: { 'ef-sharp': '45', 'ef-sharp-r': '1' },
    exposure: { 'ef-exp': '100', 'ef-gamma': '100' },
    wave: { 'ef-wave-a': '12', 'ef-wave-f': '14', 'ef-ca': '0', 'ef-ca-amt': '8' },
    colorbal: { 'ef-cb-r': '0', 'ef-cb-g': '0', 'ef-cb-b': '0' },
    duotone: { 'ef-duo-mid': '128', 'ef-duo-c1': '#1a0533', 'ef-duo-c2': '#fff5e0' },
    dropshadow: { 'ef-ds-ox': '4', 'ef-ds-oy': '6', 'ef-ds-blur': '10', 'ef-ds-op': '45' },
    vhs: {
        'ef-vhs-preset': 'default',
        'ef-vhs-preview_max': '480',
        // Cadrage & base
        'ef-vhs-enable_y': '1',
        'ef-vhs-enable_r': '1',
        'ef-vhs-enable_g': '1',
        'ef-vhs-enable_b': '1',
        'ef-vhs-crop_padding': '6',
        'ef-vhs-crop_feather': '4',
        'ef-vhs-luma_contrast': '1',
        'ef-vhs-luma_brightness': '0',
        'ef-vhs-pixel_size': '1',
        'ef-vhs-band_patina': '0.9',
        'ef-vhs-apply_jpeg': '0',
        'ef-vhs-jpeg_quality': '86',
        // Colorimétrie
        'ef-vhs-chroma_saturation': '2.4',
        'ef-vhs-edge_sat': '4.8',
        'ef-vhs-hs_sat': '0',
        'ef-vhs-shadow_sat': '0',
        'ef-vhs-chroma_phase': '0',
        'ef-vhs-apply_color_cast': '1',
        'ef-vhs-cast_r': '33',
        'ef-vhs-cast_g': '-5',
        'ef-vhs-cast_b': '-10',
        // Décalages & bavements
        'ef-vhs-shift_y': '0',
        'ef-vhs-shift_r': '-13',
        'ef-vhs-shift_g': '8',
        'ef-vhs-shift_b': '6',
        'ef-vhs-chroma_blur': '25',
        'ef-vhs-chroma_bleed': '12',
        'ef-vhs-luma_smear': '0',
        'ef-vhs-right_pink': '0',
        'ef-vhs-right_pink_width': '0.4',
        // Déformations & instabilité
        'ef-vhs-glitch_intensity': '0',
        'ef-vhs-glitch_jitter': '1',
        'ef-vhs-glitch_dropouts': '1',
        'ef-vhs-glitch_tears': '1',
        'ef-vhs-glitch_noise': '1',
        'ef-vhs-jitter_amp': '1',
        'ef-vhs-jitter_freq': '0.39',
        'ef-vhs-head_switch_rows': '95',
        'ef-vhs-head_switch_pull': '24',
        'ef-vhs-head_switch_freq': '0.52',
        'ef-vhs-head_switch_wave': '0.5',
        'ef-vhs-head_switch_noise': '0',
        // Bandes couleur (tracking)
        'ef-vhs-hs_color_tear': '0',
        'ef-vhs-tear_color': 'cyan',
        'ef-vhs-tear_max_height': '20',
        'ef-vhs-tear_length': '80',
        'ef-vhs-tear_thickness': '2',
        // Dégradations & artefacts
        'ef-vhs-noise_intensity_y': '0',
        'ef-vhs-noise_intensity_c': '30',
        'ef-vhs-dropout_chance': '0',
        'ef-vhs-dropout_len': '0.2',
        'ef-vhs-dropout_thickness': '2'
    },
    ral: {
        'ef-ral-category': 'all',
        'ef-ral-dither': '0'
    },
    cmjn: {
        'ef-cmjn-dither': '0'
    },
    contour: {
        'ef-contour-width': '3',
        'ef-contour-color': '#ff0000',
        'ef-contour-opacity': '100',
        'ef-contour-mode': 'outside',
        'ef-contour-corner': 'miter'
    },
    ascii: {
        'ef-ascii-size': '10',
        'ef-ascii-font': 'monospace',
        'ef-ascii-set': 'standard',
        'ef-ascii-chars': ILLU_ASCII_RAMPS.standard,
        'ef-ascii-gamma': '100',
        'ef-ascii-invert': '0',
        'ef-ascii-bold': '0',
        'ef-ascii-color': 'pixel',
        'ef-ascii-bg': 'black'
    },
    clouds: { 'ef-clouds-scale': '250', 'ef-clouds-power': '50', 'ef-clouds-seed': '0' },
    mandelbrot: { 'ef-mb-zoom': '10', 'ef-mb-angle': '0', 'ef-mb-factor': '1', 'ef-mb-quality': '2', 'ef-mb-invert': '0' },
    julia: { 'ef-jl-zoom': '4', 'ef-jl-angle': '0', 'ef-jl-factor': '4', 'ef-jl-quality': '2' },
    pencilsketch: { 'ef-pencil-tip': '2', 'ef-pencil-range': '0' },
    softenportrait: { 'ef-soft-softness': '5', 'ef-soft-lighting': '0', 'ef-soft-warmth': '10' },
    reducenoise: { 'ef-rn-radius': '10', 'ef-rn-strength': '40' },
    dents: { 'ef-dent-scale': '25', 'ef-dent-refr': '50', 'ef-dent-rough': '10', 'ef-dent-tension': '10', 'ef-dent-seed': '0', 'ef-ca': '0', 'ef-ca-amt': '8' },
    unfocus: { 'ef-unfocus-r': '8', 'ef-unfocus-hl': '55', 'ef-ca': '0', 'ef-ca-amt': '8' },
    temptint: { 'ef-tt-temp': '0', 'ef-tt-tint': '0' }
};

const EFFECT_SCOPE_STORAGE_KEY = 'illu_effect_scope';

/** Aperçu des effets avec modale : traitement sur une image réduite ; le rendu plein calque n’a lieu qu’au clic sur OK. */
const EFFECT_PREVIEW_MAX_EDGE = 480;

function illuFxT(key, fb) {
    if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
        const v = window.IlluI18n.t(key);
        if (v != null && v !== '' && v !== key) return v;
    }
    return fb;
}
function illuEffectTitle(id, fb) {
    return illuFxT('effect.title.' + id, fb);
}
function illuEffectIconKey(id) {
    const map = {
        brightness: 'menu.adjBrightness',
        hsv: 'menu.adjHsv',
        temperature: 'menu.adjHsv',
        blur: 'menu.fxBlurSimple',
        gaussian: 'menu.fxGaussian',
        argenticgrain: 'menu.fxArgenticGrain',
        digitalpattern: 'menu.fxDigitalPattern',
        pixelate: 'menu.fxPixelate',
        posterize: 'menu.adjPosterize',
        vibrance: 'menu.adjVibrance',
        unsharp: 'menu.adjUnsharp',
        addnoise: 'menu.fxAddNoise',
        bulge: 'menu.fxBulge',
        pinch: 'menu.fxPinch',
        cabossage: 'menu.fxCabossage',
        crystallize: 'menu.fxCrystallize',
        polarInvert: 'menu.fxPolarInvert',
        tileReflect: 'menu.fxTileReflect',
        twist: 'menu.fxTwist',
        wave: 'menu.fxWave',
        mirrorquad: 'menu.fxMirrorQuad',
        frosted: 'menu.fxFrosted',
        radialblur: 'menu.fxRadialBlur',
        zoomblur: 'menu.fxZoomBlur',
        redeyeremove: 'menu.fxRedEyeRemove',
        vignette: 'menu.fxVignette',
        softglow: 'menu.fxSoftGlow',
        dropshadow: 'menu.fxDropShadow',
        edges: 'menu.fxEdges',
        contour: 'menu.fxContour',
        emboss: 'menu.fxEmboss',
        solarize: 'menu.fxSolarize',
        halftone: 'menu.fxHalftone',
        ascii: 'menu.fxAscii',
        chromatic: 'menu.fxChromatic',
        duotone: 'menu.fxDuotone',
        ral: 'menu.fxRal',
        cmjn: 'menu.fxCmjn',
        sketch: 'menu.fxSketch',
        oil: 'menu.fxOil',
        vhs: 'menu.fxVhs',
        median: 'menu.fxMedian',
        clouds: 'menu.fxClouds',
        mandelbrot: 'menu.fxMandelbrot',
        julia: 'menu.fxJulia',
        pencilsketch: 'menu.fxPencilSketch',
        softenportrait: 'menu.fxSoftenPortrait',
        reducenoise: 'menu.fxReduceNoise',
        dents: 'menu.fxDents',
        unfocus: 'menu.fxUnfocus',
        temptint: 'menu.adjTempTint'
    };
    return map[id] || null;
}
function illuEffectHistoryLabel(id) {
    const fb = EFFECT_HISTORY_LABELS[id] || id;
    return illuFxT('effect.title.' + id, fb);
}

const EFFECT_HISTORY_LABELS = {
    chroma: 'Incrustation (couleur → transparence)',
    chromaAlphaMask: 'Incrustation (masque alpha)',
    brightness: 'Luminosité / contraste',
    hsv: 'Teinte / saturation',
    blur: 'Flou simple',
    gaussian: 'Flou gaussien',
    projection3d: 'Projection 3D',
    cabossage: 'Cabossage',
    filmgrain: 'Grain cinéma',
    chromatic: 'Aberration chromatique',
    sharpen: 'Netteté',
    exposure: 'Exposition / gamma',
    wave: 'Onde',
    colorbal: 'Balance des couleurs',
    mirrorquad: 'Miroir 4 secteurs',
    duotone: 'Duo-tone',
    dropshadow: 'Ombre portée',
    vhs: 'Effet VHS',
    halftone: 'Trame (Demi-teinte)',
    ascii: 'Art ASCII',
    grayscale: 'Noir et blanc',
    invert: 'Inversion',
    sepia: 'Sépia',
    sketch: 'Esquisse',
    autolevel: 'Auto-niveau',
    median: 'Réduction du bruit (médian)',
    temperature: 'Température de couleur',
    ral: 'Conversion de couleur RAL',
    cmjn: 'Conversion de couleur CMJN',
    contour: 'Contour (Transparence)',
    clouds: 'Nuages',
    mandelbrot: 'Fractale de Mandelbrot',
    julia: 'Fractale de Julia',
    pencilsketch: 'Croquis au crayon',
    softenportrait: 'Portrait adouci',
    reducenoise: 'Réduction du bruit',
    dents: 'Bosselage',
    unfocus: 'Flou d’objectif',
    temptint: 'Température / Teinte'
};

/** Effets sans implémentation worker : repli sur _previewOneTarget (thread principal). */
const ILLU_MAIN_THREAD_PREVIEW_EFFECTS = new Set([
    'ascii', 'autolevel', 'dropshadow', 'emboss', 'filmgrain', 'fragment', 'frosted', 'redeyeremove', 'solarize', 'temperature', 'threshold'
]);

/** Effets de flou / déformation qui proposent la bascule « Aberration chromatique » (post-traitement). */
const ILLU_CHROMA_ABERRATION_EFFECTS = new Set([
    'blur', 'gaussian', 'radialblur', 'zoomblur', 'motionblur', 'surfaceblur', 'unfocus',
    'twist', 'bulge', 'pinch', 'dents', 'tileReflect', 'frosted', 'polarInvert', 'wave', 'fragment', 'cabossage'
]);

window.FilterManager = {
    originalImageData: null,
    currentEffect: null,
    _cabossageSeed: 0x9e3779b9,
    _effectPreferMainThreadPreview(effect) {
        return ILLU_MAIN_THREAD_PREVIEW_EFFECTS.has(effect);
    },
    /**
     * Modale « Postériser » : bascule le mode « Noir & blanc (seuil) ». Le seuil est rendu par
     * l'effet interne 'threshold' (thread principal), la postérisation classique par son pipeline
     * habituel (Wasm/WebGL/worker). On échange donc simplement currentEffect ; preview() et apply()
     * dispatchent dessus.
     */
    setPosterizeBw(on) {
        this.currentEffect = on ? 'threshold' : 'posterize';
        const lvlRow = document.getElementById('ef-post-lvl-row');
        const bwRow = document.getElementById('ef-post-bw-row');
        if (lvlRow) lvlRow.style.display = on ? 'none' : '';
        if (bwRow) bwRow.style.display = on ? '' : 'none';
        this.preview();
    },

    /** Trame : l'encre noire n'existe qu'en quadrichromie. */
    setHalftoneMode() {
        this._syncHalftoneUi();
        this.preview();
    },

    _syncHalftoneUi() {
        const sel = document.getElementById('ef-half-mode');
        const isCmyk = (sel ? sel.value : 'bw') === 'cmyk';
        const kRow = document.getElementById('ef-half-k-row');
        if (kRow) kRow.style.display = isCmyk ? '' : 'none';
        // Encriers C/M/J/N : n'ont de sens qu'en quadrichromie.
        const inks = document.getElementById('ef-half-inks');
        if (inks) inks.style.display = isCmyk ? '' : 'none';
        // Reflète les valeurs courantes dans les libellés (après restauration des réglages).
        [['ef-half-dc', '%'], ['ef-half-dm', '%'], ['ef-half-dy', '%'], ['ef-half-dk', '%'], ['ef-half-gain', '%']].forEach(
            ([id, suffix]) => {
                const el = document.getElementById(id);
                const lab = document.getElementById(id + '-val');
                if (el && lab) lab.innerText = el.value + suffix;
            }
        );
    },

    /* ---------------------------------------------------------------- Art ASCII */

    /** Rampe effectivement utilisée : le champ texte fait foi (les préréglages le remplissent). */
    _asciiChars() {
        const el = document.getElementById('ef-ascii-chars');
        const raw = el && el.value ? el.value : ILLU_ASCII_RAMPS.standard;
        const chars = Array.from(raw);
        return chars.length ? chars : Array.from(ILLU_ASCII_RAMPS.standard);
    },

    /** Préréglage choisi : on recopie la rampe dans le champ texte, qui reste éditable. */
    setAsciiCharset(sel) {
        const ramp = ILLU_ASCII_RAMPS[sel ? sel.value : 'standard'];
        const inp = document.getElementById('ef-ascii-chars');
        if (ramp && inp) {
            inp.value = ramp;
            this._persistCurrentEffectParams();
        }
        this.preview();
    },

    /** Édition manuelle de la rampe : le préréglage bascule sur « Personnalisé ». */
    onAsciiCharsInput() {
        const inp = document.getElementById('ef-ascii-chars');
        const sel = document.getElementById('ef-ascii-set');
        if (inp && sel) {
            const cur = inp.value;
            const match = Object.keys(ILLU_ASCII_RAMPS).find((k) => ILLU_ASCII_RAMPS[k] === cur);
            sel.value = match || 'custom';
        }
        this.preview();
    },

    _asciiUsesSolidColor() {
        const el = document.getElementById('ef-ascii-color');
        return (el ? el.value : 'pixel') === 'solid';
    },

    _asciiUsesSecondaryBg() {
        const el = document.getElementById('ef-ascii-bg');
        return (el ? el.value : 'transparent') === 'secondary';
    },

    /** Changement de mode couleur / fond : la palette n'a de sens que si l'effet lit une couleur. */
    setAsciiColorMode() {
        this._syncAsciiColorUi();
        this.preview();
    },

    /**
     * Affiche ou masque la palette flottante « win-colors » selon que l'effet utilise
     * une couleur de la palette (comme Contour) : couleur unique, ou fond « secondaire ».
     * En mode « couleur des pixels » sur fond neutre, la palette est masquée comme pour
     * les autres effets.
     */
    _syncAsciiColorUi() {
        const solid = this._asciiUsesSolidColor();
        const secBg = this._asciiUsesSecondaryBg();
        const needsPalette = solid || secBg;
        document.body.classList.toggle('effect-allows-colors', needsPalette);
        const row = document.getElementById('ef-ascii-color-row');
        if (row) row.style.display = needsPalette ? '' : 'none';
        const sw = document.getElementById('ef-ascii-swatch');
        if (sw && window.EditorManager) {
            const c = solid ? window.EditorManager.primaryColor : window.EditorManager.secondaryColor;
            if (c) sw.style.background = `rgb(${c.r},${c.g},${c.b})`;
        }
    },
    /** Flou box séparable (glissant) sur les canaux RVB ; l'alpha est recopié. Utilisé par le masque flou. */
    _boxBlurRGB(src, w, h, radius) {
        const tmp = new Float32Array(src.length);
        const out = new Uint8ClampedArray(src.length);
        const win = radius * 2 + 1;
        const cl = (v, hi) => (v < 0 ? 0 : v > hi ? hi : v);
        for (let y = 0; y < h; y++) {
            const row = y * w * 4;
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                for (let k = -radius; k <= radius; k++) sum += src[row + cl(k, w - 1) * 4 + c];
                for (let x = 0; x < w; x++) {
                    tmp[row + x * 4 + c] = sum / win;
                    sum += src[row + cl(x + radius + 1, w - 1) * 4 + c] - src[row + cl(x - radius, w - 1) * 4 + c];
                }
            }
        }
        for (let x = 0; x < w; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                for (let k = -radius; k <= radius; k++) sum += tmp[(cl(k, h - 1) * w + x) * 4 + c];
                for (let y = 0; y < h; y++) {
                    out[(y * w + x) * 4 + c] = sum / win;
                    sum += tmp[(cl(y + radius + 1, h - 1) * w + x) * 4 + c] - tmp[(cl(y - radius, h - 1) * w + x) * 4 + c];
                }
            }
        }
        for (let i = 3; i < out.length; i += 4) out[i] = src[i];
        return out;
    },
    /** Curseur d'effet standard : <label> + range + valeur live. */
    _fxSlider(id, label, min, max, value) {
        return `<div class="field-row" style="margin-top:6px;"><label style="width:70px;">${label}</label>` +
            `<input type="range" id="${id}" min="${min}" max="${max}" value="${value}" style="flex-grow:1;" ` +
            `oninput="document.getElementById('${id}-val').innerText=this.value; FilterManager.preview()"> ` +
            `<span id="${id}-val" style="width:32px; text-align:right;">${value}</span></div>`;
    },
    /**
     * Bascule « Aberration chromatique » réutilisable pour les flous / déformations.
     * Ajoute une case à cocher (ef-ca) + un curseur d'intensité (ef-ca-amt). Les ids
     * sont partagés : une seule modale d'effet est ouverte à la fois. Le post-traitement
     * radial est appliqué dans _runPreview, indépendamment du moteur (Wasm/WebGL/worker/CPU).
     */
    _fxChromaToggle(amount = 8) {
        return `<div class="field-row" style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(128,128,128,0.3);">` +
            `<input type="checkbox" id="ef-ca" onchange="FilterManager.preview()">` +
            `<label for="ef-ca" style="margin-left:6px;cursor:pointer;" data-i18n="effect.param.chromaticAberration">Aberration chromatique</label></div>` +
            `<div class="field-row" style="margin-top:6px;"><label style="width:92px;" data-i18n="effect.param.intensity">Intensité</label>` +
            `<input type="range" id="ef-ca-amt" min="1" max="40" value="${amount}" style="flex-grow:1;" ` +
            `oninput="document.getElementById('ef-ca-amt-val').innerText=this.value; FilterManager.preview()"> ` +
            `<span id="ef-ca-amt-val" style="width:32px; text-align:right;">${amount}</span></div>`;
    },
    canvas: null,
    ctx: null,
    _effectPrefsTimer: null,
    _effectPersistBound: false,
    _frozenSnapshots: null,
    _effectTargets: null,
    /** Mode animation : portée « Images » de la session ('current' | 'selection' | 'all'). */
    _effectFrameScope: null,
    /** Mode animation : Map 'layerId:frame' → { canvas (état d'origine), cel }. */
    _animCelSnapshots: null,
    /** Mode animation : cels effectivement traités par la dernière application. */
    _animCelTargets: null,
    /** Portée mémorisée à l’ouverture de la modale (pour l’historique à la validation). */
    _effectSessionScopeAll: false,
    /** Mode téléphone : portée de la modale effet en cours (ignorer localStorage / sélection). */
    _effectDialogScope: null,
    _workCanvas: null,
    _workCtx: null,
    _previewRaf: null,
    _previewQueued: false,
    _previewActive: false,
    _previewRunSeq: 0,
    _grainSeed: 0x2b7e1516,
    /** VHS : aperçu basse résolution ; false uniquement lors de apply() pour le rendu plein calque */
    _vhsUseLowResPreview: true,
    /** VHS : true tant que la modale est ouverte — l’aperçu ne modifie pas les buffers calque (uniquement le canvas de la fenêtre) */
    _vhsSkipCanvasWrite: true,
    _vhsPreviewResizeObs: null,
    /** true uniquement pendant apply() : aperçu pleine résolution pour le rendu final */
    _effectPreviewIsFinal: false,
    _previewUpscaleCanvas: null,
    /** Preset galerie en cours (aperçu uniquement, source = snapshot figé). */
    _galleryPresetId: 'none',
    _filterWorkerBatchSeq: 0,
    _activeFilterPreviewBatchId: 0,

    _isMobilePhoneEffectUi() {
        return typeof window.isIlluMobileUiActive === 'function' && window.isIlluMobileUiActive();
    },

    _clearEffectDialogScopeSession() {
        this._effectDialogScope = null;
    },

    _effectDialogDidClose() {
        document.body.classList.remove('effect-dialog-open', 'effect-allows-colors');
        this._clearEffectDialogScopeSession();
        /* La fenêtre est partagée avec d'autres boîtes de dialogue : on rend le
           conteneur neutre pour ne pas leur imposer la mise en page compacte. */
        if (window.IlluEffectDialogUI) {
            window.IlluEffectDialogUI.reset(document.getElementById('effect-dialog-content'));
        }
    },

    _scopeAffectsAllLayers() {
        return this._readEffectScope() === 'all';
    },

    /** Enregistre l’historique selon la portée (calque actif / sélection / tous les calques). */
    _commitEffectHistory(label) {
        const scopeAll = this._effectSessionScopeAll === true || this._scopeAffectsAllLayers();
        /* Mode animation : sans la liste des cels touchés, l'annulation ne rendrait que le
           buffer du calque actif — c'est-à-dire la seule image affichée. */
        const animCels =
            this._animCelTargets && this._animCelTargets.length
                ? this._animCelTargets.map(({ layer, cel }) => ({ layerId: layer.id, frame: cel.frame }))
                : null;
        if (scopeAll || (animCels && animCels.length > 1)) {
            EditorManager.saveHistoryAllLayers(`${label}${scopeAll ? ' (tous les calques)' : ''}`, { animCels });
        } else {
            EditorManager.saveHistory(label, { patchActiveLayer: true, animCels });
        }
        /* Les miniatures de la frise viennent des cels : elles doivent se redessiner. */
        if (animCels && animCels.length) {
            document.dispatchEvent(new CustomEvent('illu:anim-changed', { detail: { kind: 'effect' } }));
        }
    },

    _readEffectScope() {
        if (this._effectDialogScope === 'all' || this._effectDialogScope === 'selection' || this._effectDialogScope === 'active') {
            return this._effectDialogScope;
        }
        try {
            const v = localStorage.getItem(EFFECT_SCOPE_STORAGE_KEY);
            if (v === 'all' || v === 'selection' || v === 'active') return v;
            return 'active';
        } catch (e) {
            return 'active';
        }
    },

    /** Sélection pixel affichée (même critère que la portée « Sélection »). */
    _hasVisiblePixelSelection() {
        const ov = document.getElementById('selection-overlay');
        return !!(window.selectionBounds && ov && ov.style.display !== 'none');
    },

    /**
     * Ajuste la portée mémorisée selon le contexte : sélection visible → « Sélection » ;
     * sinon on repart toujours sur « Calque actif » pour que la prévisualisation et l'effet
     * ne touchent que le calque en cours. La portée « Tous les calques » reste un choix
     * ponctuel (non collant) que l'utilisateur peut réactiver à chaque effet.
     */
    _syncEffectScopeToContext() {
        if (this._isMobilePhoneEffectUi()) return;
        try {
            if (this._hasVisiblePixelSelection()) {
                localStorage.setItem(EFFECT_SCOPE_STORAGE_KEY, 'selection');
                return;
            }
            // Pas de sélection : on ne laisse pas « selection » ni « all » rester collés.
            if (this._readEffectScope() !== 'active') {
                localStorage.setItem(EFFECT_SCOPE_STORAGE_KEY, 'active');
            }
        } catch (e) {
            /* ignore */
        }
    },

    // ---- Mode animation : portée « Images » des effets -----------------------

    /** Sélection courante de la frise ({layers, from, to}) ou null. */
    _animSelection() {
        const p = window.IlluAnimPanel;
        if (p && typeof p.getSelection === 'function') return p.getSelection();
        return window.IlluAnimSelection || null;
    },

    /** Portée « Images » proposée par défaut : la sélection de frise si elle en vaut la peine. */
    _defaultFrameScope() {
        const s = this._animSelection();
        return s && (s.to > s.from || s.layers.length > 1) ? 'selection' : 'current';
    },

    _readFrameScope() {
        if (!EditorManager.isAnimationMode) return 'current';
        const v = this._effectFrameScope;
        if (v === 'current' || v === 'all') return v;
        if (v === 'selection') return this._animSelection() ? 'selection' : 'current';
        return this._defaultFrameScope();
    },

    /**
     * Plage de frise visée par l'effet, croisement des deux portées :
     *  - « Sélection de la frise » : exactement le rectangle sélectionné (calques × images) ;
     *  - « Toutes les images » : les calques de la portée calque × toute la durée.
     * Retourne null pour « Image courante » (comportement historique).
     */
    _animScopeSelection() {
        if (!EditorManager.isAnimationMode) return null;
        const anim = EditorManager.animation;
        if (!anim) return null;
        const fs = this._readFrameScope();
        if (fs === 'current') return null;
        if (fs === 'selection') {
            const sel = this._animSelection();
            return sel ? { layers: sel.layers.slice(), from: sel.from, to: sel.to } : null;
        }
        const layers =
            this._readEffectScope() === 'all'
                ? EditorManager.layers.map((l, i) => i)
                : [EditorManager.activeLayerIndex];
        return { layers, from: 0, to: Math.max(0, (anim.duration | 0) - 1) };
    },

    /** Cels visés, pour l'historique (undo d'un effet multi-images). */
    _animScopedCelRefs() {
        const sel = this._animScopeSelection();
        if (!sel || typeof EditorManager.animCelRefsForSelection !== 'function') return null;
        return EditorManager.animCelRefsForSelection(sel);
    },

    /**
     * Remplace les cibles de l'effet par un couple (buffer de cel, cliché d'origine) pour
     * chaque dessin de la plage. L'aperçu de la modale reste sur l'image courante — seule
     * la validation étale l'effet sur toutes les images (sinon chaque curseur relancerait
     * l'effet N fois).
     */
    _expandEffectTargetsToAnimCels() {
        const sel = this._animScopeSelection();
        const IA = window.IlluAnim;
        if (!sel || !IA || typeof IA.selectionCels !== 'function') return false;
        const cels = IA.selectionCels(EditorManager, sel);
        if (!cels || !cels.length) return false;
        if (!this._animCelSnapshots) this._animCelSnapshots = new Map();
        const out = [];
        cels.forEach(({ layer, cel }) => {
            if (!cel || !cel.buffer) return;
            const key = `${layer.id}:${cel.frame}`;
            let snap = this._animCelSnapshots.get(key);
            if (!snap) {
                snap = EditorManager.cloneCanvas(cel.buffer);
                this._animCelSnapshots.set(key, { canvas: snap, cel });
            } else {
                snap = snap.canvas;
            }
            out.push({
                // Calque « synthétique » : seuls buffer/x/y sont lus par le moteur d'effet.
                layer: { id: key, buffer: cel.buffer, x: layer.x, y: layer.y },
                backup: EditorManager.cloneCanvas(snap),
                animCel: { layerId: layer.id, frame: cel.frame }
            });
        });
        if (!out.length) return false;
        this._effectTargets = out;
        this._animCelTargets = cels;
        return true;
    },

    /** Remet les cels touchés dans leur état d'avant l'effet (annulation / re-rendu). */
    _restoreAnimCelsFromSnapshots() {
        if (!this._animCelSnapshots || !this._animCelSnapshots.size) return;
        this._animCelSnapshots.forEach(({ canvas, cel }) => {
            if (!cel || !cel.buffer || !canvas) return;
            const ctx = cel.buffer.getContext('2d', { willReadFrequently: true });
            ctx.clearRect(0, 0, cel.buffer.width, cel.buffer.height);
            ctx.drawImage(canvas, 0, 0);
        });
    },

    _clearAnimEffectState() {
        this._animCelSnapshots = null;
        this._animCelTargets = null;
        this._effectFrameScope = null;
    },

    _syncEffectFrameScopeButtonStyles(root, scope) {
        if (!root) return;
        root.querySelectorAll('.illu-scope-btn[data-frame-scope]').forEach((btn) => {
            btn.classList.toggle('illu-scope-btn--active', btn.getAttribute('data-frame-scope') === scope);
        });
    },

    _bindEffectFrameScopeButtons() {
        const root = document.querySelector('#effect-dialog-content .effect-frame-scope-bar');
        if (!root || root.dataset.illuFrameScopeBound) return;
        root.dataset.illuFrameScopeBound = '1';
        this._syncEffectFrameScopeButtonStyles(root, this._readFrameScope());
        root.querySelectorAll('.illu-scope-btn[data-frame-scope]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const v = btn.getAttribute('data-frame-scope');
                if (!v) return;
                this._effectFrameScope = v;
                this._syncEffectFrameScopeButtonStyles(root, this._readFrameScope());
                this._onEffectScopeChange();
            });
        });
    },

    /** Ligne « Images : … » de la modale d'effet (mode animation uniquement). */
    _buildFrameScopeRow() {
        if (!EditorManager.isAnimationMode) return '';
        const T = (k, fb) => {
            if (!window.IlluI18n || typeof window.IlluI18n.t !== 'function') return fb;
            const v = window.IlluI18n.t(k);
            return v && v !== k ? v : fb;
        };
        const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const anim = EditorManager.animation;
        const dur = anim ? Math.max(1, anim.duration | 0) : 1;
        const sel = this._animSelection();
        const nSel = sel ? (sel.to - sel.from + 1) * sel.layers.length : 0;
        const scope = this._readFrameScope();
        const on = (v) => (scope === v ? ' illu-scope-btn--active' : '');
        /* Les libellés restent courts : la rangée de portées est en flex, sans ellipse —
           les nombres vivent donc dans l'infobulle, pas dans le bouton. */
        const selBtn = sel
            ? `<button type="button" class="illu-scope-btn${on('selection')}" data-frame-scope="selection" title="${
                  esc(T('effect.frameScopeSelectionTitle', 'Images sélectionnées dans la frise') + ` : ${nSel}`)
              }">${esc(T('effect.frameScopeSelection', 'Sélection frise'))}</button>`
            : `<button type="button" class="illu-scope-btn illu-scope-btn--disabled" disabled title="${
                  esc(T('effect.frameScopeNoSelection', 'Sélectionnez des images dans la frise (clic, Maj+clic, glisser sur la règle).'))
              }">${esc(T('effect.frameScopeSelection', 'Sélection frise'))}</button>`;
        return `<div class="effect-frame-scope-bar illu-effect-scope-bar field-row" style="flex-wrap:nowrap;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #808080;font-size:11px;align-items:stretch;">
            <span class="illu-scope-bar-label" style="font-weight:600;flex-shrink:0;align-self:center;">${esc(T('effect.frameScopeLabel', 'Images :'))}</span>
            <div class="illu-scope-btn-row" role="group" aria-label="${esc(T('effect.frameScopeAria', 'Images visées par l’effet'))}">
                <button type="button" class="illu-scope-btn${on('current')}" data-frame-scope="current" title="${
                    esc(T('effect.frameScopeCurrentTitle', 'Seule l’image affichée'))
                }">${esc(T('effect.frameScopeCurrent', 'Image courante'))}</button>
                ${selBtn}
                <button type="button" class="illu-scope-btn${on('all')}" data-frame-scope="all" title="${
                    esc(T('effect.frameScopeAllTitle', 'Toutes les images de l’animation') + ` : ${dur}`)
                }">${esc(T('effect.frameScopeAll', 'Toute l’anim.'))}</button>
            </div>
        </div>`;
    },

    _beginPixelEffectSession() {
        const pm = window.PhotoModeManager;
        if (pm && pm.isOpen()) {
            const photoData = pm.getActiveImageData();
            if (!photoData) {
                window.showIlluAlert("Aucune photo active dans Photo Mode Pro.");
                return false;
            }
            // In Photo Mode, we don't need snapshots for other layers
            this._frozenSnapshots = [{ id: 'pm-active', snap: pm.getActiveImageData() }];
            this._effectTargets = [{
                layer: { id: 'pm-active', buffer: null }, // Dummy layer
                backup: pm.getActiveImageData(),
                isPhotoMode: true
            }];
            return true;
        }

        if (!EditorManager.activeProject || (!EditorManager.isPixelMode && EditorManager.mode !== 'vector')) return false;
        
        if (EditorManager.mode === 'vector') {
            if (!EditorManager.activeVectorSelection || !EditorManager.activeVectorSelection.length) {
                window.showIlluAlert('Veuillez sélectionner au moins une forme vectorielle pour appliquer un effet.');
                return false;
            }
            this._vectorSvgSnapshot = EditorManager.activeProject.svgData;
            return true;
        }
        if (!EditorManager.layers.some((l) => l.buffer)) {
            window.showIlluAlert('Aucun calque bitmap.');
            return false;
        }
        this._syncEffectScopeToContext();
        this._clearAnimEffectState();
        if (EditorManager.isAnimationMode) this._effectFrameScope = this._defaultFrameScope();
        const scope = this._readEffectScope();
        if (scope === 'active' && !EditorManager.activeLayer?.buffer) {
            window.showIlluAlert("Le calque actif n'a pas d'image.");
            return false;
        }
        if (scope === 'selection' && !EditorManager.activeLayer?.buffer) {
            window.showIlluAlert("Le calque actif n'a pas d'image.");
            return false;
        }
        // Mode animation : matérialiser le(s) cel(s) éditable(s) au temps courant avant que
        // l'effet ne mute les buffers, pour que la modification s'inscrive dans le cel de t.
        if (EditorManager.isAnimationMode) {
            if (scope === 'all') {
                for (let i = 0; i < EditorManager.layers.length; i++) {
                    EditorManager.ensureEditableCelAtPlayhead(i);
                }
            } else {
                EditorManager.ensureEditableCelAtPlayhead(EditorManager.activeLayerIndex);
            }
        }
        this._frozenSnapshots = EditorManager.layers
            .filter((l) => l.buffer)
            .map((l) => ({ id: l.id, snap: EditorManager.cloneCanvas(l.buffer) }));
        this._setupEffectTargets();
        return this._effectTargets && this._effectTargets.length > 0;
    },

    _restoreAllLayersFromFrozen() {
        this._restoreAnimCelsFromSnapshots();
        if (!this._frozenSnapshots) return;
        const byId = Object.fromEntries(EditorManager.layers.map((l) => [l.id, l]));
        this._frozenSnapshots.forEach(({ id, snap }) => {
            const layer = byId[id];
            if (!layer || !layer.buffer) return;
            const bctx = layer.buffer.getContext('2d', { willReadFrequently: true });
            bctx.clearRect(0, 0, layer.buffer.width, layer.buffer.height);
            bctx.drawImage(snap, 0, 0);
        });
        EditorManager.render();
    },

    _cloneEffectSnapshotData(snap) {
        if (!snap) return null;
        if (snap instanceof ImageData) {
            return new ImageData(new Uint8ClampedArray(snap.data), snap.width, snap.height);
        }
        return EditorManager.cloneCanvas(snap);
    },

    _setupEffectTargets() {
        this._effectTargets = [];
        const pmSnap = (this._frozenSnapshots || []).find((f) => f.id === 'pm-active');
        if (pmSnap && window.PhotoModeManager && window.PhotoModeManager.isOpen()) {
            const cloned = this._cloneEffectSnapshotData(pmSnap.snap);
            if (cloned) {
                this._effectTargets.push({
                    layer: { id: 'pm-active', buffer: null },
                    backup: cloned,
                    isPhotoMode: true
                });
            }
            return;
        }
        const scope = this._readEffectScope();
        const byId = Object.fromEntries((this._frozenSnapshots || []).map((f) => [f.id, f.snap]));
        if (scope === 'all') {
            EditorManager.layers.forEach((layer) => {
                if (!layer.buffer || !byId[layer.id]) return;
                this._effectTargets.push({
                    layer,
                    backup: EditorManager.cloneCanvas(byId[layer.id])
                });
            });
        } else {
            const al = EditorManager.activeLayer;
            if (al && al.buffer && byId[al.id]) {
                this._effectTargets.push({
                    layer: al,
                    backup: EditorManager.cloneCanvas(byId[al.id])
                });
            }
        }
        /* Mode animation, portée « Images » ≠ image courante : on remplace les cibles par
           un couple (buffer de cel, cliché d'origine) par dessin. Uniquement au rendu final :
           l'aperçu de la modale reste sur l'image affichée. */
        if (EditorManager.isAnimationMode && this._effectPreviewIsFinal) {
            this._expandEffectTargetsToAnimCels();
        }
    },

    _beginHeavyBusyToken(effectName) {
        if (!window.IlluBusyState || typeof window.IlluBusyState.begin !== 'function') return null;
        return window.IlluBusyState.begin('effect-heavy', {
            source: 'filter',
            effect: effectName || this.currentEffect || ''
        });
    },

    _endHeavyBusyToken(token) {
        if (!token || !window.IlluBusyState || typeof window.IlluBusyState.end !== 'function') return;
        window.IlluBusyState.end(token);
    },

    _waitForDoubleRaf() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    },

    _destroyFilterWorkerPool(cancelPayload) {
        if (this._filterWorkers && this._filterWorkers.length) {
            this._filterWorkers.forEach((wk) => {
                try {
                    wk.terminate();
                } catch (e) {
                    /* ignore */
                }
            });
        }
        this._filterWorkers = null;
        const pendingEntries = this._filterWorkerPending ? Array.from(this._filterWorkerPending.values()) : [];
        if (this._filterWorkerPending) this._filterWorkerPending.clear();
        this._filterWorkerPending = new Map();
        this._activeFilterPreviewBatchId = 0;
        pendingEntries.forEach((pending) => {
            try {
                pending.resolve(cancelPayload || { cancelled: true });
            } catch (e) {
                /* ignore */
            }
        });
    },

    _cancelActiveWorkerPreview() {
        if (!this._filterWorkerPending || this._filterWorkerPending.size === 0) return;
        this._destroyFilterWorkerPool({ cancelled: true });
    },

    _isPreviewRunStale(runSeq) {
        /* runSeq -1 = rendu final (OK) ; tout autre run pendant/après final = obsolète */
        if (runSeq === -1) return false;
        if (this._effectPreviewIsFinal) return true;
        return runSeq !== this._previewRunSeq;
    },

    /** Attend la fin des aperçus live avant le rendu pleine résolution (évite qu’un preview retardé écrase le final). */
    async _waitForPreviewIdle(maxMs = 800) {
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        while (this._previewActive) {
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (now - t0 > maxMs) break;
            await new Promise((r) => setTimeout(r, 16));
        }
    },

    _abortLivePreviewRuns() {
        this._previewRunSeq++;
        this._previewQueued = false;
        this._cancelActiveWorkerPreview();
    },

    _realignEffectHistoryCheckpoint() {
        if (EditorManager.mode === 'vector') return;
        if (!this._effectTargets || !this._effectTargets.length) return;
        const em = EditorManager;
        if (!em.activeProject || !em.history.length) return;
        const idx = em.historyIndex;
        if (idx < 0) return;
        const last = em.history[idx];
        if (!last || !/^État avant effet/.test(last.name)) return;
        em.history.pop();
        if (last.data && typeof em.disposeHistoryEntryData === 'function') {
            em.disposeHistoryEntryData(last.data);
        }
        em.historyIndex = em.history.length - 1;
        em.updateHistoryUI();
        this._effectSessionScopeAll = this._scopeAffectsAllLayers();
        if (typeof em.pushHistoryCheckpoint === 'function') {
            em.pushHistoryCheckpoint(
                this._effectSessionScopeAll
                    ? 'État avant effet (tous les calques)'
                    : 'État avant effet',
                { allLayers: this._effectSessionScopeAll, animCels: this._animScopedCelRefs() }
            );
        }
    },

    _onEffectScopeChange() {
        this._restoreAllLayersFromFrozen();
        this._setupEffectTargets();
        this._effectSessionScopeAll = this._scopeAffectsAllLayers();
        this._realignEffectHistoryCheckpoint();
        if (this.currentEffect === 'gallery') {
            this.previewInstantFilter(this._galleryPresetId || 'none');
        } else {
            this.preview();
        }
    },

    _syncEffectScopeButtonStyles(root, scope) {
        if (!root) return;
        root.querySelectorAll('.illu-scope-btn[data-scope]').forEach((btn) => {
            const v = btn.getAttribute('data-scope');
            btn.classList.toggle('illu-scope-btn--active', v === scope);
        });
    },

    _bindEffectScopeButtons() {
        const root = document.querySelector('#effect-dialog-content .effect-scope-bar');
        if (!root || root.dataset.illuScopeBound) return;
        root.dataset.illuScopeBound = '1';
        const scope = this._readEffectScope();
        this._syncEffectScopeButtonStyles(root, scope);
        root.querySelectorAll('.illu-scope-btn[data-scope]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const v = btn.getAttribute('data-scope');
                if (!v) return;
                if (this._isMobilePhoneEffectUi()) {
                    this._effectDialogScope = v;
                } else {
                    try {
                        localStorage.setItem(EFFECT_SCOPE_STORAGE_KEY, v);
                    } catch (e) {
                        /* ignore */
                    }
                }
                this._syncEffectScopeButtonStyles(root, v);
                this._onEffectScopeChange();
            });
        });
    },

    _syncEffectParamLabel(inp) {
        if (!inp || !inp.id) return;
        let lab = document.getElementById(`${inp.id}-val`);
        if (!lab) lab = document.getElementById(`${inp.id}-v`);
        if (!lab) return;
        // Les boîtes de valeur éditables (ex. chroma) sont des <input> : on écrit .value ;
        // les affichages classiques sont des <span> : on écrit .textContent.
        if (lab.tagName === 'INPUT' || lab.tagName === 'TEXTAREA') lab.value = inp.value;
        else lab.textContent = inp.value;
    },

    _persistCurrentEffectParams() {
        const eff = this.currentEffect;
        if (!eff || !EFFECT_PARAM_DEFAULTS[eff]) return;
        const root = document.getElementById('effect-dialog-content');
        if (!root) return;
        let store = {};
        try {
            store = JSON.parse(localStorage.getItem('illu_effect_params') || '{}');
        } catch (e) {
            store = {};
        }
        store[eff] = {};
        root.querySelectorAll('input[id^="ef-"]').forEach((el) => {
            store[eff][el.id] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
        });
        try {
            localStorage.setItem('illu_effect_params', JSON.stringify(store));
        } catch (err) { /* ignore */ }
    },

    _restoreEffectParams() {
        const eff = this.currentEffect;
        const defs = EFFECT_PARAM_DEFAULTS[eff];
        if (!defs) return;
        let store = {};
        try {
            store = JSON.parse(localStorage.getItem('illu_effect_params') || '{}');
        } catch (e) {
            store = {};
        }
        const saved = store[eff] || {};
        const merged = { ...defs, ...saved };
        for (const [id, v] of Object.entries(merged)) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (el.type === 'checkbox') el.checked = v === '1' || v === true || v === 'true';
            else if ('value' in el) el.value = v;
        }
        for (const id of Object.keys(merged)) {
            const el = document.getElementById(id);
            if (el) this._syncEffectParamLabel(el);
        }
    },

    _installEffectPrefsListener() {
        const dlg = document.getElementById('effect-dialog');
        if (!dlg || this._effectPersistBound) return;
        this._effectPersistBound = true;
        dlg.addEventListener('input', () => {
            clearTimeout(this._effectPrefsTimer);
            this._effectPrefsTimer = setTimeout(() => this._persistCurrentEffectParams(), 200);
        });
    },

    /** Met à jour le dégradé « saturation » (teinte de référence : curseur teinte ou boutons R/V/B). */
    _syncHsvStripHue() {
        const panel = document.getElementById('ef-hsv-panel');
        const hIn = document.getElementById('ef-h');
        if (!panel || !hIn) return;
        const shift = parseInt(hIn.value, 10) || 0;
        const base = 210;
        let hue;
        const refRaw = panel.dataset.hsvRefHue;
        if (refRaw !== undefined && refRaw !== '') {
            const r = parseInt(refRaw, 10);
            hue = Number.isFinite(r) ? ((r % 360) + 360) % 360 : (base + shift) % 360;
        } else {
            hue = (base + shift) % 360;
        }
        if (hue < 0) hue += 360;
        panel.style.setProperty('--hsv-strip-h', String(Math.round(hue)));
    },

    /**
     * Raccourcis RVB : même teinte de référence pour le bandeau saturation (0°, 120°, 240°)
     * et décalage de teinte appliqué à l’image (curseur ef-h : 0, 120, −120).
     */
    setHsvStripRefHue(degrees) {
        const panel = document.getElementById('ef-hsv-panel');
        const hIn = document.getElementById('ef-h');
        if (!panel || !hIn) return;
        let d = Math.round(Number(degrees) || 0);
        d = ((d % 360) + 360) % 360;
        panel.dataset.hsvRefHue = String(d);
        const shift = ((d + 180) % 360) - 180;
        hIn.value = String(Math.max(-180, Math.min(180, shift)));
        const v = document.getElementById('ef-h-val');
        if (v) v.textContent = hIn.value;
        this._syncHsvStripHue();
        this._persistCurrentEffectParams();
        this.preview();
    },

    _onHsvHueSliderInput(sliderEl) {
        const panel = document.getElementById('ef-hsv-panel');
        if (panel) delete panel.dataset.hsvRefHue;
        const v = document.getElementById('ef-h-val');
        if (v && sliderEl) v.textContent = sliderEl.value;
        this._syncHsvStripHue();
        this.preview();
    },

    resetCurrentEffectToDefaults() {
        const eff = this.currentEffect;
        if (eff === 'vhs' && typeof window.illuVhsApplyPreset === 'function') {
            window.illuVhsApplyPreset('default');
            this.preview();
            return;
        }
        const defs = EFFECT_PARAM_DEFAULTS[eff];
        if (!defs || !this.ctx) return;
        for (const [id, v] of Object.entries(defs)) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (el.type === 'checkbox') el.checked = v === '1' || v === true;
            else if ('value' in el) el.value = v;
        }
        let store = {};
        try {
            store = JSON.parse(localStorage.getItem('illu_effect_params') || '{}');
        } catch (e) {
            store = {};
        }
        store[eff] = { ...defs };
        try {
            localStorage.setItem('illu_effect_params', JSON.stringify(store));
        } catch (err) { /* ignore */ }
        for (const id of Object.keys(defs)) {
            const el = document.getElementById(id);
            if (el) this._syncEffectParamLabel(el);
        }
        if (eff === 'chroma') this._syncChromaSwatch();
        if (eff === 'hsv') {
            const p = document.getElementById('ef-hsv-panel');
            if (p) delete p.dataset.hsvRefHue;
            this._syncHsvStripHue();
            this._hsvMixParams = { 
                hslHue: Array(8).fill(0), 
                hslSat: Array(8).fill(0), 
                hslLum: Array(8).fill(0) 
            };
            this._syncHsvMixUI();
        }
        if (eff === 'colorbal') {
            const defPts = [{x:0, y:0}, {x:255, y:255}];
            this._cbParams = { 
                curveMaster: JSON.parse(JSON.stringify(defPts)), 
                curveR: JSON.parse(JSON.stringify(defPts)), 
                curveG: JSON.parse(JSON.stringify(defPts)), 
                curveB: JSON.parse(JSON.stringify(defPts)) 
            };
            this._forceRedrawCurves();
        }
        this.preview();
    },

    _syncChromaSwatch() {
        const ir = document.getElementById('ef-ch-r');
        const ig = document.getElementById('ef-ch-g');
        const ib = document.getElementById('ef-ch-b');
        const sw = document.getElementById('ef-ch-swatch');
        if (!ir || !ig || !ib || !sw) return;
        const r = Math.max(0, Math.min(255, parseInt(ir.value, 10) || 0));
        const g = Math.max(0, Math.min(255, parseInt(ig.value, 10) || 0));
        const b = Math.max(0, Math.min(255, parseInt(ib.value, 10) || 0));
        sw.style.background = `rgb(${r},${g},${b})`;
    },

    startChromaPick(target) {
        this._chromaPickTarget = target === 'B' ? 'B' : 'A';
        window._chromaKeyPickActive = true;
        document.body.style.cursor = 'crosshair';
        this.preview();
    },

    applyPickedChromaColor(r, g, b) {
        const suffix = this._chromaPickTarget === 'B' ? '2' : '';
        const ir = document.getElementById('ef-ch-r' + suffix);
        const ig = document.getElementById('ef-ch-g' + suffix);
        const ib = document.getElementById('ef-ch-b' + suffix);
        if (ir) ir.value = String(Math.round(r));
        if (ig) ig.value = String(Math.round(g));
        if (ib) ib.value = String(Math.round(b));
        // Échantillonner la couleur B active automatiquement la 2ᵉ clé
        if (this._chromaPickTarget === 'B') {
            const cb = document.getElementById('ef-ch-use2');
            if (cb) cb.checked = true;
        }
        this._syncChromaSwatch();
        if (window.ChromaKeyer && window.ChromaKeyer.syncUI) window.ChromaKeyer.syncUI(true);
        this._persistCurrentEffectParams();
        this.preview();
    },


    _sampleBilinear(src, w, h, x, y) {
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x >= w - 1) x = w - 1 - 1e-6;
        if (y >= h - 1) y = h - 1 - 1e-6;
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const x1 = x0 + 1, y1 = y0 + 1;
        const tx = x - x0, ty = y - y0;
        const idx = (yy, xx) => (yy * w + xx) * 4;
        const lerp = (a, b, t) => a + (b - a) * t;
        const i00 = idx(y0, x0), i10 = idx(y0, x1), i01 = idx(y1, x0), i11 = idx(y1, x1);
        const ch = (o) => lerp(lerp(src[i00 + o], src[i10 + o], tx), lerp(src[i01 + o], src[i11 + o], tx), ty);
        return [ch(0), ch(1), ch(2), ch(3)];
    },

    /**
     * Aberration chromatique radiale appliquée sur un rendu déjà calculé.
     * Le rouge est échantillonné en s'écartant du centre, le bleu en s'en rapprochant,
     * le vert reste fixe. La direction reste radiale (rendu « optique »).
     *
     * Le décalage est piloté par `modField` (0..1 par pixel) lorsqu'il est fourni :
     * plus un pixel a été flouté/déformé, plus l'aberration y est forte. À défaut, on
     * retombe sur le comportement historique où le décalage croît du centre vers les coins.
     * Retourne une nouvelle ImageData.
     */
    _applyChromaticAberration(imageData, amountPx, modField) {
        const amt = Number(amountPx) || 0;
        if (amt <= 0) return imageData;
        const w = imageData.width, h = imageData.height;
        const src = imageData.data;
        const out = new ImageData(w, h);
        const od = out.data;
        const cx = w / 2, cy = h / 2;
        const maxR = Math.hypot(cx, cy) || 1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const dx = x - cx, dy = y - cy;
                const r = Math.hypot(dx, dy);
                const ux = r > 1e-6 ? dx / r : 0;
                const uy = r > 1e-6 ? dy / r : 0;
                const shift = modField
                    ? amt * modField[y * w + x]
                    : amt * (r / maxR);
                const [rr, , , ra] = this._sampleBilinear(src, w, h, x + ux * shift, y + uy * shift);
                const [, g, , ga] = this._sampleBilinear(src, w, h, x, y);
                const [, , b, ba] = this._sampleBilinear(src, w, h, x - ux * shift, y - uy * shift);
                const i = (y * w + x) * 4;
                od[i] = rr; od[i + 1] = g; od[i + 2] = b;
                od[i + 3] = Math.min(ra, ga, ba);
            }
        }
        return out;
    },

    /**
     * Applique l'aberration chromatique au contenu du canvas de travail si l'effet
     * courant la propose et que la case (ef-ca) est cochée. Appelé après le rendu de
     * l'effet, donc valable quel que soit le moteur utilisé. L'intensité (px pleine
     * résolution) est mise à l'échelle de l'aperçu via _effectPreviewPxScale.
     */
    _maybeApplyChromaticAberration(pw, ph) {
        if (!ILLU_CHROMA_ABERRATION_EFFECTS.has(this.currentEffect)) return;
        const cb = document.getElementById('ef-ca');
        if (!cb || !cb.checked) return;
        const amtUi = parseFloat(document.getElementById('ef-ca-amt')?.value || '0') || 0;
        if (amtUi <= 0) return;
        const scale =
            this._effectPreviewPxScale != null && this._effectPreviewPxScale > 0
                ? this._effectPreviewPxScale
                : 1;
        let img;
        try {
            img = this.ctx.getImageData(0, 0, pw, ph);
        } catch (e) {
            return;
        }
        // Champ de modulation : intensité locale du flou/déformation par pixel.
        // 1) Champ ANALYTIQUE quand l'effet a une forme fermée (flou radial/zoom, torsion,
        //    renflement, pincement…) : on recalcule la vraie quantité de flou (rayon) ou de
        //    déplacement avec les mêmes formules que l'effet — donc valable même sur une zone
        //    unie (ex. zone de sécurité du flou radial = 0 aberration, bord = aberration max).
        // 2) Sinon REPLI sur l'écart rendu/source (effets à bruit, flous uniformes), où
        //    l'aberration de bord est de toute façon le bon comportement perceptif.
        let modField = this._buildEffectStrengthField(this.currentEffect, pw, ph, scale);
        if (!modField) modField = this._buildDeformationField(img, this.originalImageData, pw, ph);
        const out = this._applyChromaticAberration(img, amtUi * scale, modField);
        if (out !== img) this.ctx.putImageData(out, 0, 0);
    },

    /** Lit un paramètre numérique d'effet (#id) avec valeur de repli. */
    _fxNum(id, def) {
        const el = document.getElementById(id);
        const v = el ? parseFloat(el.value) : NaN;
        return Number.isFinite(v) ? v : def;
    },

    /**
     * Champ d'intensité locale (Float32, 0..1) calculé ANALYTIQUEMENT à partir de la
     * géométrie propre à l'effet — la vraie quantité de flou/déformation à chaque pixel,
     * pas l'écart visible. Normalisé par une référence absolue (REF, en px d'aperçu) :
     * peu de flou/déformation → peu d'aberration, beaucoup → aberration maximale.
     * Retourne null pour les effets sans forme fermée (→ repli sur _buildDeformationField).
     */
    _buildEffectStrengthField(effect, w, h, scale) {
        const s = scale > 0 ? scale : 1;
        const REF = 8 * s; // déplacement/flou local (px d'aperçu) au-delà duquel l'aberration sature
        const n = w * h;
        const f = new Float32Array(n);
        const cx0 = w / 2, cy0 = h / 2;
        const maxR0 = Math.hypot(cx0, cy0) || 1;
        let magFn = null;

        if (effect === 'radialblur' || effect === 'zoomblur') {
            // Même géométrie que radial-zoom-blur.js : zone nette (t=0) puis montée linéaire
            // de la force du flou jusqu'au bord (t=1), centre décalable via offset.
            const pfx = effect === 'radialblur' ? 'ef-rblur' : 'ef-zblur';
            const ox = this._fxNum(`${pfx}-ox`, 0) / 100;
            const oy = this._fxNum(`${pfx}-oy`, 0) / 100;
            const inner = Math.max(0, Math.min(1, this._fxNum(`${pfx}-inner`, 0) / 100));
            const cx = (w / 2) * (1 + ox);
            const cy = (h / 2) * (1 + oy);
            const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) || 1;
            const safeR = inner * maxR;
            // Force du flou : arc (rad) pour le radial, facteur de convergence pour le zoom.
            const strength = effect === 'radialblur'
                ? (Math.max(0, this._fxNum('ef-rblur-angle', 2)) * Math.PI / 180)
                : (Math.max(0, this._fxNum('ef-zblur-amount', 10)) / 100);
            magFn = (x, y) => {
                const d = Math.hypot(x - cx, y - cy);
                if (d <= safeR) return 0;
                const t = maxR > safeR ? (d - safeR) / (maxR - safeR) : 1;
                return strength * d * t; // étalement de flou local (px), 0 dans la zone nette
            };
        } else {
            switch (effect) {
                case 'twist': {
                    const ang = this._fxNum('ef-twist', 0) * Math.PI / 180;
                    magFn = (x, y) => {
                        const dx = x - cx0, dy = y - cy0, r = Math.hypot(dx, dy);
                        const a = ang * (1 - r / maxR0);
                        return 2 * r * Math.abs(Math.sin(a / 2)); // corde du déplacement
                    };
                    break;
                }
                case 'bulge':
                case 'pinch': {
                    const k = effect === 'bulge'
                        ? (this._fxNum('ef-bulge', 50) / 100) * 1.5
                        : -(this._fxNum('ef-pinch', 50) / 100) * 1.5;
                    magFn = (x, y) => {
                        const dx = x - cx0, dy = y - cy0, r = Math.hypot(dx, dy), t = r / maxR0;
                        const rS = r / (1 + k * (1 - t * t));
                        return Math.abs(r - rS);
                    };
                    break;
                }
                case 'polarInvert': {
                    const amt = this._fxNum('ef-polar', 50) / 100;
                    magFn = (x, y) => {
                        const dx = x - cx0, dy = y - cy0, r = Math.hypot(dx, dy);
                        const rS = r * (1 - amt) + (maxR0 - r) * amt;
                        return Math.abs(rS - r);
                    };
                    break;
                }
                case 'wave': {
                    const amp = this._fxNum('ef-wave-a', 12) * s;
                    const frq = this._fxNum('ef-wave-f', 14) || 1;
                    const k = (2 * Math.PI) / frq;
                    magFn = (x, y) => Math.hypot(amp * Math.sin(y * k), amp * Math.cos(x * k));
                    break;
                }
                case 'tileReflect': {
                    const T = Math.max(4, Math.round(this._fxNum('ef-tile', 30) * s));
                    magFn = (x, y) => {
                        const qx = Math.floor(x / T), qy = Math.floor(y / T);
                        const tx = x - qx * T, ty = y - qy * T;
                        const mx = tx < T / 2 ? tx : T - 1 - tx;
                        const my = ty < T / 2 ? ty : T - 1 - ty;
                        return Math.hypot((qx * T + mx) - x, (qy * T + my) - y);
                    };
                    break;
                }
                default:
                    return null;
            }
        }

        const inv = 1 / REF;
        let any = false;
        for (let y = 0, p = 0; y < h; y++) {
            for (let x = 0; x < w; x++, p++) {
                let m = magFn(x, y) * inv;
                if (m > 1) m = 1;
                else if (m < 0) m = 0;
                if (m > 0) any = true;
                f[p] = m;
            }
        }
        return any ? f : null;
    },

    /**
     * Champ d'intensité locale de déformation/flou (Float32, 0..1 par pixel) servant à
     * moduler l'aberration chromatique. Mesuré comme l'écart cumulé RGBA entre le rendu de
     * l'effet (`img`) et la source d'origine (`orig`, capturée avant l'effet). L'écart est
     * lissé pour passer de contours à des zones, puis ramené sur 0..1 via un seuil absolu
     * (REF) : ainsi « peu de déformation » → peu d'aberration, « beaucoup » → aberration max.
     * Retourne null si rien n'a changé ou si les dimensions ne correspondent pas (repli radial).
     */
    _buildDeformationField(img, orig, w, h) {
        if (!orig || orig.width !== w || orig.height !== h) return null;
        const a = img.data, b = orig.data;
        const n = w * h;
        const f = new Float32Array(n);
        let any = false;
        for (let p = 0, i = 0; p < n; p++, i += 4) {
            const d =
                Math.abs(a[i] - b[i]) +
                Math.abs(a[i + 1] - b[i + 1]) +
                Math.abs(a[i + 2] - b[i + 2]) +
                Math.abs(a[i + 3] - b[i + 3]);
            if (d > 0) any = true;
            f[p] = d;
        }
        if (!any) return null;
        // Lisse l'écart : transforme les contours de changement en « zones » de déformation,
        // pour une montée progressive de l'aberration plutôt que sur les seuls bords.
        this._blurFloatField2D(f, w, h, 3);
        // Seuil absolu : ~REF de différence cumulée RGBA correspond à l'aberration maximale.
        const REF = 48;
        const inv = 1 / REF;
        for (let p = 0; p < n; p++) {
            let v = f[p] * inv;
            if (v > 1) v = 1;
            f[p] = v;
        }
        return f;
    },

    _cabHash(ix, iy, seed) {
        let n = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + (seed >>> 0) * 1442695041;
        n = (n ^ (n >>> 13)) >>> 0;
        return (n / 4294967296) * 2 - 1;
    },

    /** Bruit de grain déterministe (aperçu stable pendant le glisser). */
    _grainNoise(ix, iy) {
        let n = Math.imul(ix | 0, 1597334677) + Math.imul(iy | 0, 3812015801) + (this._grainSeed >>> 0);
        n = (n ^ (n >>> 15)) >>> 0;
        return (n / 4294967296) * 2 - 1;
    },

    _parseHexColor(hex) {
        const h = String(hex || '').replace('#', '').trim();
        if (h.length !== 6) return { r: 0, g: 0, b: 0 };
        const n = parseInt(h, 16);
        if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },

    _smoothCabNoise(x, y, cell, seed) {
        const c = Math.max(1.5, cell);
        const x0 = Math.floor(x / c);
        const y0 = Math.floor(y / c);
        const fx = x / c - x0;
        const fy = y / c - y0;
        const u = fx * fx * (3 - 2 * fx);
        const v = fy * fy * (3 - 2 * fy);
        const a = this._cabHash(x0, y0, seed);
        const b = this._cabHash(x0 + 1, y0, seed);
        const cc = this._cabHash(x0, y0 + 1, seed);
        const d = this._cabHash(x0 + 1, y0 + 1, seed);
        return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v;
    },

    _blurFloatField2D(field, w, h, passes) {
        const tmp = new Float32Array(w * h);
        for (let p = 0; p < passes; p++) {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let s = 0;
                    let c = 0;
                    for (let dx = -1; dx <= 1; dx++) {
                        const xx = Math.max(0, Math.min(w - 1, x + dx));
                        s += field[y * w + xx];
                        c++;
                    }
                    tmp[y * w + x] = s / c;
                }
            }
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let s = 0;
                    let c = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        const yy = Math.max(0, Math.min(h - 1, y + dy));
                        s += tmp[yy * w + x];
                        c++;
                    }
                    field[y * w + x] = s / c;
                }
            }
        }
    },

    _buildCabossageHeightField(w, h, scaleUi, roughUi, tensionUi, qualityUi, seed) {
        const minD = Math.min(w, h);
        const scale = Math.max(1, Math.min(100, scaleUi));
        const cell = Math.max(2, (minD * (0.08 + ((100 - scale) / 100) * 0.35)) | 0);
        const cellFine = Math.max(1.5, cell * 0.22);
        const rough = Math.max(0, Math.min(100, roughUi)) / 100;
        const H = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                let v = this._smoothCabNoise(x, y, cell, seed);
                v += rough * this._smoothCabNoise(x + 17.3, y + 91.1, cellFine, seed + 1103515245);
                H[i] = v;
            }
        }
        const tension = Math.max(0, Math.min(100, tensionUi));
        const blurPasses = Math.max(0, Math.round(tension / 4));
        if (blurPasses > 0) this._blurFloatField2D(H, w, h, blurPasses);
        const q = Math.max(1, Math.min(4, Math.round(qualityUi)));
        if (q > 1) this._blurFloatField2D(H, w, h, q - 1);
        return H;
    },

    _solveHomography8(src4, dst4) {
        const A = [];
        const b = [];
        for (let i = 0; i < 4; i++) {
            const [X, Y] = src4[i];
            const [xp, yp] = dst4[i];
            A.push([X, Y, 1, 0, 0, 0, -X * xp, -Y * xp]);
            b.push(xp);
            A.push([0, 0, 0, X, Y, 1, -X * yp, -Y * yp]);
            b.push(yp);
        }
        const n = 8;
        const M = A.map((row, r) => [...row, b[r]]);
        for (let col = 0; col < n; col++) {
            let piv = col;
            for (let r = col + 1; r < n; r++) {
                if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
            }
            [M[col], M[piv]] = [M[piv], M[col]];
            const v = M[col][col];
            if (Math.abs(v) < 1e-12) return null;
            for (let c = col; c <= n; c++) M[col][c] /= v;
            for (let r = 0; r < n; r++) {
                if (r === col) continue;
                const f = M[r][col];
                if (f === 0) continue;
                for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
            }
        }
        const sol = M.map((row) => row[n]);
        return [sol[0], sol[1], sol[2], sol[3], sol[4], sol[5], sol[6], sol[7], 1];
    },

    _invert3x3(m) {
        const [a, b, c, d, e, f, g, h, i] = m;
        const A = e * i - f * h;
        const B = -(d * i - f * g);
        const C = d * h - e * g;
        const D = -(b * i - c * h);
        const E = a * i - c * g;
        const F = -(a * h - b * g);
        const G = b * f - c * e;
        const H = -(a * f - c * d);
        const I = a * e - b * d;
        const det = a * A + b * B + c * C;
        if (Math.abs(det) < 1e-14) return null;
        const id = 1 / det;
        return [A * id, D * id, G * id, B * id, E * id, H * id, C * id, F * id, I * id];
    },

    _quadCorners3D(w, h, rxDeg, ryDeg, focal, zoomScale = 1.0) {
        const cx = w / 2;
        const cy = h / 2;
        const rx = (rxDeg * Math.PI) / 180;
        const ry = (ryDeg * Math.PI) / 180;
        const f = Math.max(40, focal);
        const d = f * 0.55;
        const proj = (sx, sy) => {
            let X = sx - cx;
            let Y = sy - cy;
            let Z = d;
            const X1 = X * Math.cos(ry) + Z * Math.sin(ry);
            const Z1 = -X * Math.sin(ry) + Z * Math.cos(ry);
            X = X1;
            Z = Z1;
            const Y2 = Y * Math.cos(rx) - Z * Math.sin(rx);
            const Z2 = Y * Math.sin(rx) + Z * Math.cos(rx);
            Y = Y2;
            Z = Z2;
            const zz = Math.max(Z, f * 0.04);
            return [f * (X / zz) * zoomScale + cx, f * (Y / zz) * zoomScale + cy];
        };
        return [
            [0, 0],
            [w, 0],
            [w, h],
            [0, h]
        ].map(([sx, sy]) => proj(sx, sy));
    },

    _pullCorners(quad, w, h, tl, tr, br, bl) {
        const cx = w / 2;
        const cy = h / 2;
        const am = [tl, tr, br, bl];
        return quad.map((p, i) => {
            const k = (am[i] / 100) * 0.5;
            return [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k];
        });
    },

    async initEffect(effect) {
        if (!EditorManager.isPixelMode) {
            window.showIlluAlert("Les effets ne sont disponibles qu'en mode Pixel.");
            return;
        }
        
        // Yield the event loop so the browser can immediately close the dropdown menu
        // and provide instant visual feedback to the user before we freeze the CPU.
        await new Promise(resolve => setTimeout(resolve, 30));

        if (this._isMobilePhoneEffectUi()) {
            this._effectDialogScope = 'all';
        } else {
            this._clearEffectDialogScopeSession();
        }
        if (!this._beginPixelEffectSession()) {
            this._clearEffectDialogScopeSession();
            return;
        }
        this._workCanvas = document.createElement('canvas');
        this._workCtx = this._workCanvas.getContext('2d', { willReadFrequently: true });
        this.canvas = this._workCanvas;
        this.ctx = this._workCtx;
        this.currentEffect = effect;

        this._effectSessionScopeAll = this._scopeAffectsAllLayers();

        /* Point d’annulation Ctrl+Z : état calque avant que l’aperçu live ne modifie les pixels. */
        if (this._effectTargets && this._effectTargets.length && EditorManager.mode !== 'vector') {
            if (typeof EditorManager.pushHistoryCheckpoint === 'function') {
                EditorManager.pushHistoryCheckpoint(
                    this._effectSessionScopeAll
                        ? 'État avant effet (tous les calques)'
                        : 'État avant effet',
                    { allLayers: this._effectSessionScopeAll, animCels: this._animScopedCelRefs() }
                );
            }
        }

        switch (effect) {
            case 'brightness':
                this.showModal(illuEffectTitle('brightness', 'Luminosité / Contraste'), `
                    <div class="effect-slider-block">
                        <span class="effect-param-label" data-i18n="effect.param.brightness">Luminosité</span>
                        <div class="effect-track-row">
                            <div class="effect-track effect-track--luma">
                                <input type="range" id="ef-b" class="effect-range" min="-100" max="100" value="0" oninput="document.getElementById('ef-b-val').innerText=this.value; FilterManager.preview()">
                            </div>
                            <span class="effect-val" id="ef-b-val">0</span>
                        </div>
                    </div>
                    <div class="effect-slider-block">
                        <span class="effect-param-label" data-i18n="effect.param.contrast">Contraste</span>
                        <div class="effect-track-row">
                            <div class="effect-track effect-track--contrast">
                                <input type="range" id="ef-c" class="effect-range" min="-100" max="100" value="0" oninput="document.getElementById('ef-c-val').innerText=this.value; FilterManager.preview()">
                            </div>
                            <span class="effect-val" id="ef-c-val">0</span>
                        </div>
                    </div>
                `);
                break;
            case 'hsv':
                this.showModal(illuEffectTitle('hsv', 'Teinte / Saturation (TSL)'), `
                    <div id="ef-hsv-panel">
                        <div class="effect-slider-block">
                            <span class="effect-param-label" data-i18n="effect.param.hue">Teinte</span>
                            <div class="effect-track-row">
                                <div class="effect-track effect-track--hue">
                                    <input type="range" id="ef-h" class="effect-range" min="-180" max="180" value="0" oninput="FilterManager._onHsvHueSliderInput(this)">
                                </div>
                                <span class="effect-val" id="ef-h-val">0</span>
                            </div>
                            <div class="ef-hsv-rgb-presets" role="group" data-i18n-aria-label="effect.hsvPresetsAria">
                                <button type="button" class="ef-hsv-preset ef-hsv-preset--r" onclick="FilterManager.setHsvStripRefHue(0)" data-i18n-title="effect.hsvPresetR" title="">R</button>
                                <button type="button" class="ef-hsv-preset ef-hsv-preset--g" onclick="FilterManager.setHsvStripRefHue(120)" data-i18n-title="effect.hsvPresetG" title="">G</button>
                                <button type="button" class="ef-hsv-preset ef-hsv-preset--b" onclick="FilterManager.setHsvStripRefHue(240)" data-i18n-title="effect.hsvPresetB" title="">B</button>
                            </div>
                        </div>
                        <div class="effect-slider-block">
                            <span class="effect-param-label" data-i18n="effect.param.saturation">Saturation</span>
                            <div class="effect-track-row">
                                <div class="effect-track effect-track--sat">
                                    <input type="range" id="ef-s" class="effect-range" min="-100" max="100" value="0" oninput="document.getElementById('ef-s-val').innerText=this.value; FilterManager.preview()">
                                </div>
                                <span class="effect-val" id="ef-s-val">0</span>
                            </div>
                        </div>
                        <div class="effect-slider-block">
                            <span class="effect-param-label" data-i18n="effect.param.luminance">Luminance</span>
                            <div class="effect-track-row">
                                <div class="effect-track effect-track--lum">
                                    <input type="range" id="ef-l" class="effect-range" min="-100" max="100" value="0" oninput="document.getElementById('ef-l-val').innerText=this.value; FilterManager.preview()">
                                </div>
                                <span class="effect-val" id="ef-l-val">0</span>
                            </div>
                        </div>
                        <details class="illu-advanced-section" ontoggle="if(this.open && window.IlluImageAdjustCore) { FilterManager._syncHsvMixUI(); }">
                            <summary class="illu-advanced-section-summary" data-i18n="effect.advanced.hsvMixer">Avancé : Mélangeur TSL</summary>
                            <div class="illu-advanced-section-body">
                                ${window.IlluImageAdjustCore.HSLManager.createHtml('ef-hsv-mix')}
                            </div>
                        </details>
                    </div>
                `);
                if (!this._hsvMixParams) {
                    this._hsvMixParams = { 
                        hslHue: Array(8).fill(0), 
                        hslSat: Array(8).fill(0), 
                        hslLum: Array(8).fill(0) 
                    };
                }
                break;
            case 'temperature':
                this.showModal(illuEffectTitle('temperature', 'Température de couleur'), `
                    <div class="effect-slider-block">
                        <span class="effect-param-label" data-i18n="effect.param.warmth">Chaleur</span>
                        <div class="effect-track-row">
                            <div class="effect-track effect-track--temp">
                                <input type="range" id="ef-temp" class="effect-range" min="-100" max="100" value="0" oninput="document.getElementById('ef-temp-val').innerText=this.value; FilterManager.preview()">
                            </div>
                            <span class="effect-val" id="ef-temp-val">0</span>
                        </div>
                    </div>
                `);
                break;
            case 'blur':
            case 'gaussian':
                this.showModal(effect === 'blur' ? illuEffectTitle('blur', 'Flou simple') : illuEffectTitle('gaussian', 'Flou gaussien'), `
                    <div class="field-row"><label style="width: 60px;" data-i18n="effect.param.radius">Rayon:</label><input type="range" id="ef-rad" min="1" max="100" value="2" style="flex-grow:1;" oninput="document.getElementById('ef-rad-val').innerText=this.value; FilterManager.preview()"> <span id="ef-rad-val" style="width:30px; text-align:right;">2</span></div>
                    <div class="field-row" style="margin-top:6px; padding-left:60px;">
                        <input type="checkbox" id="ef-blur-edge" onchange="FilterManager.preview()" checked>
                        <label for="ef-blur-edge" data-i18n="effect.param.respectEdges">Prendre en compte les bords</label>
                    </div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'argenticgrain':
                this.showModal(illuEffectTitle('argenticgrain', 'Grain Argentique'), `
                    <div class="field-row"><label style="width: 80px;" data-i18n="effect.param.intensity">Intensité:</label><input type="range" id="ef-grain" min="0" max="100" value="40" style="flex-grow:1;" oninput="document.getElementById('ef-grain-val').innerText=this.value; FilterManager.preview()"> <span id="ef-grain-val" style="width:25px; text-align:right;">40</span></div>
                `);
                break;
            case 'digitalpattern':
                this.showModal(illuEffectTitle('digitalpattern', 'Tramage numérique'), `
                    <div class="field-row"><label style="width: 80px;" data-i18n="effect.param.intensity">Intensité:</label><input type="range" id="ef-grain" min="0" max="100" value="40" style="flex-grow:1;" oninput="document.getElementById('ef-grain-val').innerText=this.value; FilterManager.preview()"> <span id="ef-grain-val" style="width:25px; text-align:right;">40</span></div>
                    <div class="field-row"><label style="width: 80px;" data-i18n="effect.param.cell">Cellule:</label><input type="range" id="ef-grain-fine" min="2" max="30" value="15" style="flex-grow:1;" oninput="document.getElementById('ef-grain-fine-val').innerText=this.value; FilterManager.preview()"> <span id="ef-grain-fine-val" style="width:25px; text-align:right;">15</span></div>
                `);
                break;
            case 'pixelate':
                this.showModal(illuEffectTitle('pixelate', 'Pixéliser'), `
                    <div class="field-row"><label style="width: 60px;" data-i18n="effect.param.size">Taille:</label><input type="range" id="ef-size" min="2" max="50" value="10" style="flex-grow:1;" oninput="document.getElementById('ef-size-val').innerText=this.value; FilterManager.preview()"> <span id="ef-size-val" style="width:25px; text-align:right;">10</span></div>
                `);
                break;
            case 'posterize':
                this.showModal(illuEffectTitle('posterize', 'Postériser'), `
                    <div class="field-row" id="ef-post-lvl-row"><label style="width: 60px;" data-i18n="effect.param.levels">Niveaux:</label><input type="range" id="ef-lvl" min="2" max="16" value="4" style="flex-grow:1;" oninput="document.getElementById('ef-lvl-val').innerText=this.value; FilterManager.preview()"> <span id="ef-lvl-val" style="width:25px; text-align:right;">4</span></div>
                    <div class="field-row" style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(128,128,128,0.3);"><input type="checkbox" id="ef-post-bw" onchange="FilterManager.setPosterizeBw(this.checked)"><label for="ef-post-bw" style="margin-left:6px;cursor:pointer;" data-i18n="effect.param.posterizeBw">Noir &amp; blanc (seuil)</label></div>
                    <div class="field-row" id="ef-post-bw-row" style="margin-top:6px; display:none;"><label style="width: 60px;" data-i18n="effect.param.threshold">Seuil:</label><input type="range" id="ef-thr" min="0" max="255" value="128" style="flex-grow:1;" oninput="document.getElementById('ef-thr-val').innerText=this.value; FilterManager.preview()"> <span id="ef-thr-val" style="width:30px; text-align:right;">128</span></div>
                `);
                break;
            case 'vibrance':
                this.showModal(illuEffectTitle('vibrance', 'Vibrance / Éclat'), `
                    <div class="field-row"><label style="width: 60px;" data-i18n="effect.param.vibrance">Éclat:</label><input type="range" id="ef-vibr" min="-100" max="100" value="50" style="flex-grow:1;" oninput="document.getElementById('ef-vibr-val').innerText=this.value; FilterManager.preview()"> <span id="ef-vibr-val" style="width:30px; text-align:right;">50</span></div>
                `);
                break;
            case 'unsharp':
                this.showModal(illuEffectTitle('unsharp', 'Masque flou (netteté)'), `
                    <div class="field-row"><label style="width: 78px;" data-i18n="effect.param.amount">Intensité:</label><input type="range" id="ef-us-amount" min="0" max="300" value="80" style="flex-grow:1;" oninput="document.getElementById('ef-us-amount-val').innerText=this.value; FilterManager.preview()"> <span id="ef-us-amount-val" style="width:34px; text-align:right;">80</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 78px;" data-i18n="effect.param.radius">Rayon:</label><input type="range" id="ef-us-radius" min="1" max="20" value="3" style="flex-grow:1;" oninput="document.getElementById('ef-us-radius-val').innerText=this.value; FilterManager.preview()"> <span id="ef-us-radius-val" style="width:34px; text-align:right;">3</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 78px;" data-i18n="effect.param.threshold">Seuil:</label><input type="range" id="ef-us-threshold" min="0" max="50" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-us-threshold-val').innerText=this.value; FilterManager.preview()"> <span id="ef-us-threshold-val" style="width:34px; text-align:right;">0</span></div>
                `);
                break;
            case 'halftone':
                this.showModal(illuEffectTitle('halftone', 'Trame (Demi-teinte)'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;" data-i18n="effect.desc.halftone">Trame d'imprimerie : chaque cellule reçoit un point plein dont la taille suit la quantité d'encre. Les points sont toujours 100 % opaques.</p>
                    <div class="field-row" style="align-items:center;gap:8px;">
                        <label style="width:110px;" data-i18n="effect.param.halfMode">Variante</label>
                        <select id="ef-half-mode" onchange="FilterManager.setHalftoneMode()" style="flex-grow:1;">
                            <option value="bw" data-i18n="effect.half.modeBw">Noir &amp; blanc</option>
                            <option value="color" data-i18n="effect.half.modeColor">Points couleur</option>
                            <option value="cmyk" data-i18n="effect.half.modeCmyk">Impression CMJN (cyan / magenta / jaune)</option>
                        </select>
                    </div>
                    <div class="field-row" style="margin-top:6px;">
                        <label style="width:110px;" data-i18n="effect.halftoneRadius">Taille des points:</label>
                        <input type="range" id="ef-half-rad" min="1" max="50" value="4" style="flex-grow:1;" oninput="document.getElementById('ef-half-rad-val').innerText=this.value; FilterManager.preview()">
                        <span id="ef-half-rad-val" style="width:25px; text-align:right;">4</span>
                    </div>
                    <div class="field-row" style="margin-top:6px;">
                        <label style="width:110px;" data-i18n="effect.param.halfAngle">Angle de trame</label>
                        <input type="range" id="ef-half-angle" min="0" max="90" value="45" style="flex-grow:1;" oninput="document.getElementById('ef-half-angle-val').innerText=this.value; FilterManager.preview()">
                        <span id="ef-half-angle-val" style="width:25px; text-align:right;">45</span>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:110px;" data-i18n="effect.param.halfPaper">Fond</label>
                        <select id="ef-half-paper" onchange="FilterManager.preview()" style="flex-grow:1;">
                            <option value="white" data-i18n="effect.half.paperWhite">Papier blanc</option>
                            <option value="transparent" data-i18n="effect.half.paperNone">Transparent (points seuls)</option>
                        </select>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:14px;">
                        <label id="ef-half-k-row" style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" id="ef-half-k" checked onchange="FilterManager.preview()"><span data-i18n="effect.param.halfBlackInk">Encre noire (N)</span></label>
                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" id="ef-half-invert" onchange="FilterManager.preview()"><span data-i18n="effect.param.invert">Inverser</span></label>
                    </div>
                    <div id="ef-half-inks" style="display:none;margin-top:10px;border-top:1px solid #bbb;padding-top:8px;">
                        <p style="margin:0 0 6px;font-size:11px;color:#333;" data-i18n="effect.half.inkIntro">Encriers : intensité de chaque encre, comme sur une presse. 100 % = densité normale.</p>
                        <div class="field-row" style="margin-top:4px;">
                            <label style="width:110px;color:#0093c7;" data-i18n="effect.half.inkC">Cyan</label>
                            <input type="range" id="ef-half-dc" min="0" max="200" value="100" style="flex-grow:1;" oninput="document.getElementById('ef-half-dc-val').innerText=this.value+'%'; FilterManager.preview()">
                            <span id="ef-half-dc-val" style="width:38px; text-align:right;">100%</span>
                        </div>
                        <div class="field-row" style="margin-top:4px;">
                            <label style="width:110px;color:#c8007a;" data-i18n="effect.half.inkM">Magenta (rose)</label>
                            <input type="range" id="ef-half-dm" min="0" max="200" value="100" style="flex-grow:1;" oninput="document.getElementById('ef-half-dm-val').innerText=this.value+'%'; FilterManager.preview()">
                            <span id="ef-half-dm-val" style="width:38px; text-align:right;">100%</span>
                        </div>
                        <div class="field-row" style="margin-top:4px;">
                            <label style="width:110px;color:#a08800;" data-i18n="effect.half.inkY">Jaune</label>
                            <input type="range" id="ef-half-dy" min="0" max="200" value="100" style="flex-grow:1;" oninput="document.getElementById('ef-half-dy-val').innerText=this.value+'%'; FilterManager.preview()">
                            <span id="ef-half-dy-val" style="width:38px; text-align:right;">100%</span>
                        </div>
                        <div class="field-row" style="margin-top:4px;">
                            <label style="width:110px;" data-i18n="effect.half.inkK">Noir</label>
                            <input type="range" id="ef-half-dk" min="0" max="200" value="100" style="flex-grow:1;" oninput="document.getElementById('ef-half-dk-val').innerText=this.value+'%'; FilterManager.preview()">
                            <span id="ef-half-dk-val" style="width:38px; text-align:right;">100%</span>
                        </div>
                        <div class="field-row" style="margin-top:6px;">
                            <label style="width:110px;" data-i18n="effect.half.dotGain" title="L'encre s'étale sur le papier : les points impriment plus gros">Engraissement</label>
                            <input type="range" id="ef-half-gain" min="0" max="100" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-half-gain-val').innerText=this.value+'%'; FilterManager.preview()">
                            <span id="ef-half-gain-val" style="width:38px; text-align:right;">0%</span>
                        </div>
                    </div>
                `);
                break;
            case 'addnoise':
                this.showModal(illuEffectTitle('addnoise', 'Ajouter du bruit'), `
                    <div class="field-row"><label style="width: 60px;" data-i18n="effect.param.intensity">Intensité:</label><input type="range" id="ef-int" min="1" max="100" value="20" style="flex-grow:1;" oninput="document.getElementById('ef-int-val').innerText=this.value; FilterManager.preview()"> <span id="ef-int-val" style="width:25px; text-align:right;">20</span></div>
                `);
                break;
            case 'bulge':
                this.showModal(illuEffectTitle('bulge', 'Bosse'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.intensity">Intensité:</label><input type="range" id="ef-bulge" min="0" max="100" value="40" style="flex-grow:1;" oninput="document.getElementById('ef-bulge-val').innerText=this.value; FilterManager.preview()"> <span id="ef-bulge-val" style="width:25px; text-align:right;">40</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'pinch':
                this.showModal(illuEffectTitle('pinch', 'Pincement'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.intensity">Intensité:</label><input type="range" id="ef-pinch" min="0" max="100" value="40" style="flex-grow:1;" oninput="document.getElementById('ef-pinch-val').innerText=this.value; FilterManager.preview()"> <span id="ef-pinch-val" style="width:25px; text-align:right;">40</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'cabossage':
                this.showModal(illuEffectTitle('cabossage', 'Cabossage'), `
                    <div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:96px;" data-i18n="effect.param.scale">Échelle</label><input type="range" id="ef-cab-scale" min="1" max="100" value="25" style="flex:1;" oninput="document.getElementById('ef-cab-scale-v').textContent=Number(this.value).toFixed(2); FilterManager.preview();"><span id="ef-cab-scale-v" style="width:48px;text-align:right;">25.00</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:96px;" data-i18n="effect.param.refraction">Réfraction</label><input type="range" id="ef-cab-refr" min="0" max="100" value="50" style="flex:1;" oninput="document.getElementById('ef-cab-refr-v').textContent=Number(this.value).toFixed(2); FilterManager.preview();"><span id="ef-cab-refr-v" style="width:48px;text-align:right;">50.00</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:96px;" data-i18n="effect.param.roughness">Rugosité</label><input type="range" id="ef-cab-rough" min="0" max="100" value="10" style="flex:1;" oninput="document.getElementById('ef-cab-rough-v').textContent=Number(this.value).toFixed(2); FilterManager.preview();"><span id="ef-cab-rough-v" style="width:48px;text-align:right;">10.00</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:96px;" data-i18n="effect.param.tension">Tension</label><input type="range" id="ef-cab-tension" min="0" max="100" value="10" style="flex:1;" oninput="document.getElementById('ef-cab-tension-v').textContent=Number(this.value).toFixed(2); FilterManager.preview();"><span id="ef-cab-tension-v" style="width:48px;text-align:right;">10.00</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:96px;" data-i18n="effect.param.quality">Qualité</label><input type="range" id="ef-cab-q" min="1" max="4" value="2" step="1" style="flex:1;" oninput="document.getElementById('ef-cab-q-v').textContent=this.value; FilterManager.preview();"><span id="ef-cab-q-v" style="width:48px;text-align:right;">2</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:96px;" data-i18n="effect.param.highlight">Lumière</label><input type="range" id="ef-cab-light" min="0" max="100" value="0" style="flex:1;" oninput="document.getElementById('ef-cab-light-v').textContent=this.value; FilterManager.preview();"><span id="ef-cab-light-v" style="width:48px;text-align:right;">0</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:96px;">Angle</label><input type="range" id="ef-cab-angle" min="0" max="360" value="135" style="flex:1;" oninput="document.getElementById('ef-cab-angle-v').textContent=this.value; FilterManager.preview();"><span id="ef-cab-angle-v" style="width:48px;text-align:right;">135</span></div>
                        <div class="field-row" style="margin-bottom:10px;"><label style="width:96px;cursor:pointer;" for="ef-cab-invert" data-i18n="effect.param.invert">Inverser</label><input type="checkbox" id="ef-cab-invert" onchange="FilterManager.preview()"></div>
                        <div class="field-row" style="align-items:center;gap:8px;"><span style="min-width:96px;" data-i18n="effect.param.randomNoise">Bruit aléatoire</span><button type="button" id="ef-cab-reset-noise" style="font-size:11px;" data-i18n="effect.param.reset">Réinitialiser</button></div>
                        ${this._fxChromaToggle()}
                    </div>
                `);
                break;
            case 'twist':
                this.showModal(illuEffectTitle('twist', 'Torsion'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.angle">Angle:</label><input type="range" id="ef-twist" min="-90" max="90" value="30" style="flex-grow:1;" oninput="document.getElementById('ef-twist-val').innerText=this.value; FilterManager.preview()"> <span id="ef-twist-val" style="width:30px; text-align:right;">30</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'crystallize':
                this.showModal(illuEffectTitle('crystallize', 'Cristallisation'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.cells">Cellules:</label><input type="range" id="ef-cry" min="4" max="48" value="12" style="flex-grow:1;" oninput="document.getElementById('ef-cry-val').innerText=this.value; FilterManager.preview()"> <span id="ef-cry-val" style="width:25px; text-align:right;">12</span></div>
                `);
                break;
            case 'polarInvert':
                this.showModal(illuEffectTitle('polarInvert', 'Inversion polaire'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.intensity">Intensité:</label><input type="range" id="ef-polar" min="0" max="100" value="80" style="flex-grow:1;" oninput="document.getElementById('ef-polar-val').innerText=this.value; FilterManager.preview()"> <span id="ef-polar-val" style="width:25px; text-align:right;">80</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'tileReflect':
                this.showModal(illuEffectTitle('tileReflect', 'Réflexion mosaïque'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.tileSize">Taille tuile:</label><input type="range" id="ef-tile" min="8" max="128" value="24" style="flex-grow:1;" oninput="document.getElementById('ef-tile-val').innerText=this.value; FilterManager.preview()"> <span id="ef-tile-val" style="width:25px; text-align:right;">24</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'frosted':
                this.showModal(illuEffectTitle('frosted', 'Verre dépoli'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.grain">Grain:</label><input type="range" id="ef-frost" min="1" max="24" value="8" style="flex-grow:1;" oninput="document.getElementById('ef-frost-val').innerText=this.value; FilterManager.preview()"> <span id="ef-frost-val" style="width:25px; text-align:right;">8</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'clouds':
                this.showModal(illuEffectTitle('clouds', 'Nuages'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;">Rendu Perlin entre couleur primaire et secondaire.</p>
                    ${this._fxSlider('ef-clouds-scale', 'Échelle', 2, 1000, 250)}
                    ${this._fxSlider('ef-clouds-power', 'Rugosité', 0, 100, 50)}
                    ${this._fxSlider('ef-clouds-seed', 'Germe', 0, 255, 0)}
                `);
                break;
            case 'mandelbrot':
                this.showModal(illuEffectTitle('mandelbrot', 'Fractale de Mandelbrot'), `
                    ${this._fxSlider('ef-mb-zoom', 'Zoom', 0, 100, 10)}
                    ${this._fxSlider('ef-mb-angle', 'Angle', -180, 180, 0)}
                    ${this._fxSlider('ef-mb-factor', 'Facteur', 1, 10, 1)}
                    ${this._fxSlider('ef-mb-quality', 'Qualité', 1, 5, 2)}
                    <div class="field-row" style="margin-top:6px;"><label style="width:70px;">Inverser</label><input type="checkbox" id="ef-mb-invert" onchange="FilterManager.preview()"></div>
                `);
                break;
            case 'julia':
                this.showModal(illuEffectTitle('julia', 'Fractale de Julia'), `
                    ${this._fxSlider('ef-jl-zoom', 'Zoom', 1, 50, 4)}
                    ${this._fxSlider('ef-jl-angle', 'Angle', -180, 180, 0)}
                    ${this._fxSlider('ef-jl-factor', 'Facteur', 1, 10, 4)}
                    ${this._fxSlider('ef-jl-quality', 'Qualité', 1, 5, 2)}
                `);
                break;
            case 'pencilsketch':
                this.showModal(illuEffectTitle('pencilsketch', 'Croquis au crayon'), `
                    ${this._fxSlider('ef-pencil-tip', 'Pointe', 1, 20, 2)}
                    ${this._fxSlider('ef-pencil-range', 'Plage', -20, 20, 0)}
                `);
                break;
            case 'softenportrait':
                this.showModal(illuEffectTitle('softenportrait', 'Portrait adouci'), `
                    ${this._fxSlider('ef-soft-softness', 'Douceur', 0, 10, 5)}
                    ${this._fxSlider('ef-soft-lighting', 'Éclairage', -20, 20, 0)}
                    ${this._fxSlider('ef-soft-warmth', 'Chaleur', 0, 20, 10)}
                `);
                break;
            case 'reducenoise':
                this.showModal(illuEffectTitle('reducenoise', 'Réduction du bruit'), `
                    ${this._fxSlider('ef-rn-radius', 'Rayon', 1, 50, 10)}
                    ${this._fxSlider('ef-rn-strength', 'Force', 0, 100, 40)}
                `);
                break;
            case 'dents':
                this.showModal(illuEffectTitle('dents', 'Bosselage'), `
                    ${this._fxSlider('ef-dent-scale', 'Échelle', 1, 200, 25)}
                    ${this._fxSlider('ef-dent-refr', 'Réfraction', 0, 200, 50)}
                    ${this._fxSlider('ef-dent-rough', 'Rugosité', 0, 100, 10)}
                    ${this._fxSlider('ef-dent-tension', 'Tension', 0, 100, 10)}
                    ${this._fxSlider('ef-dent-seed', 'Germe', 0, 255, 0)}
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'unfocus':
                this.showModal(illuEffectTitle('unfocus', 'Flou d’objectif (bokeh)'), `
                    ${this._fxSlider('ef-unfocus-r', 'Rayon', 1, 50, 8)}
                    ${this._fxSlider('ef-unfocus-hl', 'Hautes lumières', 0, 100, 55)}
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'temptint':
                this.showModal(illuEffectTitle('temptint', 'Température / Teinte'), `
                    ${this._fxSlider('ef-tt-temp', 'Température', -100, 100, 0)}
                    ${this._fxSlider('ef-tt-tint', 'Teinte', -100, 100, 0)}
                `);
                break;
            case 'vignette':
                this.showModal(illuEffectTitle('vignette', 'Vignettage'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.intensity">Intensité:</label><input type="range" id="ef-vig" min="0" max="100" value="50" style="flex-grow:1;" oninput="document.getElementById('ef-vig-val').innerText=this.value; FilterManager.preview()"> <span id="ef-vig-val" style="width:25px; text-align:right;">50</span></div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:70px;" data-i18n="effect.param.color">Couleur</label>
                        <button type="button" id="ef-vig-open-colors" onclick="window.toggleFloatingPaletteVisibility('win-colors')" style="flex-grow:1; font-size:11px; padding:3px 6px;">
                            <i class="fa-solid fa-palette"></i> Palette de Couleurs (Primaire)
                        </button>
                        <div id="ef-vig-swatch" style="width:24px;height:18px;border:1px solid #888;margin-left:8px;flex-shrink:0;background:#000000;"></div>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:70px;" data-i18n="effect.param.blend">Fusion</label>
                        <select id="ef-vig-blend" onchange="FilterManager.preview()" style="flex-grow:1;">
                            <option value="0" data-i18n="effect.blend.normal">Normal</option>
                            <option value="1" data-i18n="effect.blend.multiply">Produit</option>
                            <option value="2" data-i18n="effect.blend.overlay">Superposition</option>
                            <option value="3" data-i18n="effect.blend.screen">Incrustation</option>
                        </select>
                    </div>
                `);
                break;
            case 'redeyeremove':
                this.showModal(illuEffectTitle('redeyeremove', 'Supprimer les yeux rouges'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.tolerance">Tolérance:</label><input type="range" id="ef-redeye-tol" min="0" max="100" value="70" style="flex-grow:1;" oninput="document.getElementById('ef-redeye-tol-val').innerText=this.value; FilterManager.preview()"> <span id="ef-redeye-tol-val" style="width:25px; text-align:right;">70</span></div>
                    <div class="field-row" style="margin-top:8px;"><label style="width: 70px;">Saturation:</label><input type="range" id="ef-redeye-sat" min="0" max="100" value="90" style="flex-grow:1;" oninput="document.getElementById('ef-redeye-sat-val').innerText=this.value; FilterManager.preview()"> <span id="ef-redeye-sat-val" style="width:25px; text-align:right;">90</span></div>
                `);
                break;
            case 'softglow':
                this.showModal(illuEffectTitle('softglow', 'Lueur douce'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.radius">Rayon:</label><input type="range" id="ef-glow-r" min="1" max="15" value="6" style="flex-grow:1;" oninput="document.getElementById('ef-glow-r-val').innerText=this.value; FilterManager.preview()"> <span id="ef-glow-r-val" style="width:25px; text-align:right;">6</span></div>
                    <div class="field-row" style="margin-top:8px;"><label style="width: 70px;" data-i18n="effect.param.force">Force:</label><input type="range" id="ef-glow-a" min="0" max="100" value="40" style="flex-grow:1;" oninput="document.getElementById('ef-glow-a-val').innerText=this.value; FilterManager.preview()"> <span id="ef-glow-a-val" style="width:25px; text-align:right;">40</span></div>
                `);
                break;
            case 'dropshadow':
                this.showModal(illuEffectTitle('dropshadow', 'Ombre portée'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;" data-i18n="effect.desc.dropshadow">Ajoute une ombre décalée derrière les pixels visibles du calque (aperçu sur la portée choisie).</p>
                    <div class="field-row"><label style="width: 92px;" data-i18n="effect.param.offsetX">Décalage X</label><input type="range" id="ef-ds-ox" min="-32" max="32" value="4" style="flex-grow:1;" oninput="document.getElementById('ef-ds-ox-val').innerText=this.value; FilterManager.preview()"> <span id="ef-ds-ox-val" style="width:28px;text-align:right;">4</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 92px;" data-i18n="effect.param.offsetY">Décalage Y</label><input type="range" id="ef-ds-oy" min="-32" max="32" value="6" style="flex-grow:1;" oninput="document.getElementById('ef-ds-oy-val').innerText=this.value; FilterManager.preview()"> <span id="ef-ds-oy-val" style="width:28px;text-align:right;">6</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 92px;" data-i18n="effect.param.blur">Flou</label><input type="range" id="ef-ds-blur" min="0" max="40" value="10" style="flex-grow:1;" oninput="document.getElementById('ef-ds-blur-val').innerText=this.value; FilterManager.preview()"> <span id="ef-ds-blur-val" style="width:28px;text-align:right;">10</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 92px;" data-i18n="effect.param.opacity">Opacité</label><input type="range" id="ef-ds-op" min="5" max="100" value="45" style="flex-grow:1;" oninput="document.getElementById('ef-ds-op-val').innerText=this.value; FilterManager.preview()"> <span id="ef-ds-op-val" style="width:28px;text-align:right;">45</span></div>
                `);
                break;
            case 'edges':
                this.showModal(illuEffectTitle('edges', 'Contours'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.sensitivity">Sensibilité:</label><input type="range" id="ef-edge" min="1" max="100" value="40" style="flex-grow:1;" oninput="document.getElementById('ef-edge-val').innerText=this.value; FilterManager.preview()"> <span id="ef-edge-val" style="width:25px; text-align:right;">40</span></div>
                `);
                break;
            case 'emboss':
                this.showModal(illuEffectTitle('emboss', 'Relief'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.intensity">Intensité:</label><input type="range" id="ef-emb" min="1" max="30" value="12" style="flex-grow:1;" oninput="document.getElementById('ef-emb-val').innerText=this.value; FilterManager.preview()"> <span id="ef-emb-val" style="width:25px; text-align:right;">12</span></div>
                `);
                break;
            case 'solarize':
                this.showModal(illuEffectTitle('solarize', 'Solariser'), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.threshold">Seuil:</label><input type="range" id="ef-sol" min="0" max="255" value="128" style="flex-grow:1;" oninput="document.getElementById('ef-sol-val').innerText=this.value; FilterManager.preview()"> <span id="ef-sol-val" style="width:30px; text-align:right;">128</span></div>
                `);
                break;
            case 'radialblur':
                this.showModal(illuEffectTitle('radialblur', 'Flou radial (rotation)'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#888;" data-i18n="effect.desc.radialblur">Flou par rotation autour du centre — algorithme Paint.NET.</p>
                    <div class="field-row"><label style="width:130px;" data-i18n="effect.param.angle">Arc de rotation °</label><input type="range" id="ef-rblur-angle" min="0" max="360" value="2" style="flex-grow:1;" oninput="document.getElementById('ef-rblur-angle-val').innerText=this.value; FilterManager.preview()"> <span id="ef-rblur-angle-val" style="width:36px;text-align:right;">2</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width:130px;" data-i18n="effect.param.innerRadius">Zone nette (rayon %)</label><input type="range" id="ef-rblur-inner" min="0" max="100" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-rblur-inner-val').innerText=this.value; FilterManager.preview()"> <span id="ef-rblur-inner-val" style="width:36px;text-align:right;">0</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width:130px;" data-i18n="effect.param.quality">Qualité (1-5)</label><input type="range" id="ef-rblur-quality" min="1" max="5" value="2" style="flex-grow:1;" oninput="document.getElementById('ef-rblur-quality-val').innerText=this.value; FilterManager.preview()"> <span id="ef-rblur-quality-val" style="width:36px;text-align:right;">2</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width:130px;" data-i18n="effect.param.offsetX">Décalage centre X</label><input type="range" id="ef-rblur-ox" min="-100" max="100" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-rblur-ox-val').innerText=this.value; FilterManager.preview()"> <span id="ef-rblur-ox-val" style="width:36px;text-align:right;">0</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width:130px;" data-i18n="effect.param.offsetY">Décalage centre Y</label><input type="range" id="ef-rblur-oy" min="-100" max="100" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-rblur-oy-val').innerText=this.value; FilterManager.preview()"> <span id="ef-rblur-oy-val" style="width:36px;text-align:right;">0</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'zoomblur':
                this.showModal(illuEffectTitle('zoomblur', 'Flou de zoom'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#888;" data-i18n="effect.desc.zoomblur">Flou radial centripète — algorithme Paint.NET.</p>
                    <div class="field-row"><label style="width:130px;" data-i18n="effect.param.amount">Intensité (0-100)</label><input type="range" id="ef-zblur-amount" min="0" max="100" value="10" style="flex-grow:1;" oninput="document.getElementById('ef-zblur-amount-val').innerText=this.value; FilterManager.preview()"> <span id="ef-zblur-amount-val" style="width:36px;text-align:right;">10</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width:130px;" data-i18n="effect.param.innerRadius">Zone nette (rayon %)</label><input type="range" id="ef-zblur-inner" min="0" max="100" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-zblur-inner-val').innerText=this.value; FilterManager.preview()"> <span id="ef-zblur-inner-val" style="width:36px;text-align:right;">0</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width:130px;" data-i18n="effect.param.offsetX">Décalage centre X</label><input type="range" id="ef-zblur-ox" min="-100" max="100" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-zblur-ox-val').innerText=this.value; FilterManager.preview()"> <span id="ef-zblur-ox-val" style="width:36px;text-align:right;">0</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width:130px;" data-i18n="effect.param.offsetY">Décalage centre Y</label><input type="range" id="ef-zblur-oy" min="-100" max="100" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-zblur-oy-val').innerText=this.value; FilterManager.preview()"> <span id="ef-zblur-oy-val" style="width:36px;text-align:right;">0</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'motionblur':
                this.showModal(illuEffectTitle('motionblur', 'Flou de mouvement'), `
                    <div class="field-row"><label style="width: 88px;" data-i18n="effect.param.angle">Angle °</label><input type="range" id="ef-mblur-angle" min="-180" max="180" value="25" style="flex-grow:1;" oninput="document.getElementById('ef-mblur-angle-v').innerText=this.value; FilterManager.preview()"> <span id="ef-mblur-angle-v" style="width:32px;text-align:right;">25</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 88px;" data-i18n="effect.param.distance">Distance</label><input type="range" id="ef-mblur-dist" min="1" max="200" value="10" style="flex-grow:1;" oninput="document.getElementById('ef-mblur-dist-v').innerText=this.value; FilterManager.preview()"> <span id="ef-mblur-dist-v" style="width:32px;text-align:right;">10</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 88px;" data-i18n="effect.param.centered">Centré</label><input type="checkbox" id="ef-mblur-center" checked onchange="FilterManager.preview()"></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'surfaceblur':
                this.showModal(illuEffectTitle('surfaceblur', 'Flou de surface'), `
                    <div class="field-row"><label style="width: 88px;" data-i18n="effect.param.radius">Rayon</label><input type="range" id="ef-sblur-r" min="1" max="50" value="6" style="flex-grow:1;" oninput="document.getElementById('ef-sblur-r-v').innerText=this.value; FilterManager.preview()"> <span id="ef-sblur-r-v" style="width:32px;text-align:right;">6</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 88px;" data-i18n="effect.param.threshold">Seuil</label><input type="range" id="ef-sblur-t" min="1" max="100" value="15" style="flex-grow:1;" oninput="document.getElementById('ef-sblur-t-v').innerText=this.value; FilterManager.preview()"> <span id="ef-sblur-t-v" style="width:32px;text-align:right;">15</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'fragment':
                this.showModal(illuEffectTitle('fragment', 'Fragment'), `
                    <div class="field-row"><label style="width: 88px;" data-i18n="effect.param.fragments">Fragments</label><input type="range" id="ef-frag-n" min="2" max="50" value="4" style="flex-grow:1;" oninput="document.getElementById('ef-frag-n-v').innerText=this.value; FilterManager.preview()"> <span id="ef-frag-n-v" style="width:32px;text-align:right;">4</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 88px;" data-i18n="effect.param.distance">Distance</label><input type="range" id="ef-frag-d" min="0" max="100" value="8" style="flex-grow:1;" oninput="document.getElementById('ef-frag-d-v').innerText=this.value; FilterManager.preview()"> <span id="ef-frag-d-v" style="width:32px;text-align:right;">8</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 88px;" data-i18n="effect.param.rotation">Rotation °</label><input type="range" id="ef-frag-r" min="0" max="360" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-frag-r-v').innerText=this.value; FilterManager.preview()"> <span id="ef-frag-r-v" style="width:32px;text-align:right;">0</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'oil':
                this.showModal(illuEffectTitle('oil', "Peinture à l'huile"), `
                    <div class="field-row"><label style="width: 70px;" data-i18n="effect.param.radius">Rayon:</label><input type="range" id="ef-oil" min="2" max="8" value="4" style="flex-grow:1;" oninput="document.getElementById('ef-oil-val').innerText=this.value; FilterManager.preview()"> <span id="ef-oil-val" style="width:25px; text-align:right;">4</span></div>
                `);
                break;
            case 'projection3d':
                this.showModal(illuEffectTitle('projection3d', 'Projection 3D…'), `
                    <div style="max-width:440px;font-size:11px;line-height:1.35;">
                        <p style="margin:0 0 6px;color:#333;">Rotation du plan image (perspective) puis déformation optionnelle des quatre coins vers le centre.</p>
                        <div class="field-row"><label style="width:120px;" data-i18n="effect.param.hAxis">Axe horizontal °</label><input type="range" id="ef-3d-rx" min="-60" max="60" value="0" style="flex:1;" oninput="document.getElementById('ef-3d-rx-v').innerText=this.value; FilterManager.preview()"><span id="ef-3d-rx-v" style="width:28px;text-align:right;">0</span></div>
                        <div class="field-row" style="margin-top:4px;"><label style="width:120px;" data-i18n="effect.param.vAxis">Axe vertical °</label><input type="range" id="ef-3d-ry" min="-60" max="60" value="0" style="flex:1;" oninput="document.getElementById('ef-3d-ry-v').innerText=this.value; FilterManager.preview()"><span id="ef-3d-ry-v" style="width:28px;text-align:right;">0</span></div>
                        <div class="field-row" style="margin-top:4px;"><label style="width:120px;" data-i18n="effect.param.cameraDist">Distance caméra</label><input type="range" id="ef-3d-f" min="80" max="800" value="280" style="flex:1;" oninput="document.getElementById('ef-3d-f-v').innerText=this.value; FilterManager.preview()"><span id="ef-3d-f-v" style="width:36px;text-align:right;">280</span></div>
                        <div class="field-row" style="margin-top:4px;"><label style="width:120px;" data-i18n="effect.param.zoom">Zoom %</label><input type="range" id="ef-3d-z" min="20" max="400" value="100" style="flex:1;" oninput="document.getElementById('ef-3d-z-v').innerText=this.value; FilterManager.preview()"><span id="ef-3d-z-v" style="width:36px;text-align:right;">100</span></div>
                        <div style="border-top:1px solid #aaa;margin:8px 0 4px;padding-top:6px;" data-i18n="effect.desc.projection3dCorners">Coins → centre (perspective type « trapèze »)</div>
                        <div class="field-row"><label style="width:120px;" data-i18n="effect.param.cornerTL">Haut gauche</label><input type="range" id="ef-3d-tl" min="0" max="100" value="0" style="flex:1;" oninput="document.getElementById('ef-3d-tl-v').innerText=this.value; FilterManager.preview()"><span id="ef-3d-tl-v" style="width:28px;">0</span></div>
                        <div class="field-row" style="margin-top:2px;"><label style="width:120px;" data-i18n="effect.param.cornerTR">Haut droite</label><input type="range" id="ef-3d-tr" min="0" max="100" value="0" style="flex:1;" oninput="document.getElementById('ef-3d-tr-v').innerText=this.value; FilterManager.preview()"><span id="ef-3d-tr-v" style="width:28px;">0</span></div>
                        <div class="field-row" style="margin-top:2px;"><label style="width:120px;" data-i18n="effect.param.cornerBR">Bas droite</label><input type="range" id="ef-3d-br" min="0" max="100" value="0" style="flex:1;" oninput="document.getElementById('ef-3d-br-v').innerText=this.value; FilterManager.preview()"><span id="ef-3d-br-v" style="width:28px;">0</span></div>
                        <div class="field-row" style="margin-top:2px;"><label style="width:120px;" data-i18n="effect.param.cornerBL">Bas gauche</label><input type="range" id="ef-3d-bl" min="0" max="100" value="0" style="flex:1;" oninput="document.getElementById('ef-3d-bl-v').innerText=this.value; FilterManager.preview()"><span id="ef-3d-bl-v" style="width:28px;">0</span></div>
                    </div>
                `);
                break;
            case 'filmgrain':
                this.showModal(illuEffectTitle('filmgrain', 'Grain cinéma'), `
                    <div class="field-row"><label style="width: 92px;" data-i18n="effect.param.intensity">Intensité</label><input type="range" id="ef-grain" min="0" max="100" value="40" style="flex-grow:1;" oninput="document.getElementById('ef-grain-val').innerText=this.value; FilterManager.preview()"> <span id="ef-grain-val" style="width:28px;text-align:right;">40</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 92px;" data-i18n="effect.param.grainSize">Taille du grain</label><input type="range" id="ef-grain-fine" min="4" max="40" value="15" style="flex-grow:1;" oninput="document.getElementById('ef-grain-fine-val').innerText=this.value; FilterManager.preview()"> <span id="ef-grain-fine-val" style="width:28px;text-align:right;">15</span></div>
                `);
                break;
            case 'chromatic':
                this.showModal(illuEffectTitle('chromatic', 'Aberration chromatique'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;" data-i18n="effect.desc.chromatic">Décalage du rouge et du bleu (effet prismatique).</p>
                    <div class="field-row"><label style="width: 92px;" data-i18n="effect.param.shift">Décalage (px)</label><input type="range" id="ef-chr" min="0" max="24" value="6" style="flex-grow:1;" oninput="document.getElementById('ef-chr-val').innerText=this.value; FilterManager.preview()"> <span id="ef-chr-val" style="width:28px;text-align:right;">6</span></div>
                `);
                break;
            case 'sharpen':
                this.showModal(illuEffectTitle('sharpen', 'Netteté (masque flou)'), `
                    <div class="field-row"><label style="width: 92px;" data-i18n="effect.param.intensity">Intensité</label><input type="range" id="ef-sharp" min="0" max="150" value="45" style="flex-grow:1;" oninput="document.getElementById('ef-sharp-val').innerText=this.value; FilterManager.preview()"> <span id="ef-sharp-val" style="width:28px;text-align:right;">45</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 92px;" data-i18n="effect.param.radius">Rayon</label><input type="range" id="ef-sharp-r" min="1" max="3" value="1" style="flex-grow:1;" oninput="document.getElementById('ef-sharp-r-val').innerText=this.value; FilterManager.preview()"> <span id="ef-sharp-r-val" style="width:28px;text-align:right;">1</span></div>
                `);
                break;
            case 'exposure':
                this.showModal(illuEffectTitle('exposure', 'Exposition / gamma'), `
                    <div class="field-row"><label style="width: 92px;" data-i18n="effect.param.exposure">Exposition %</label><input type="range" id="ef-exp" min="25" max="400" value="100" style="flex-grow:1;" oninput="document.getElementById('ef-exp-val').innerText=this.value; FilterManager.preview()"> <span id="ef-exp-val" style="width:36px;text-align:right;">100</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 92px;" data-i18n="effect.param.gamma">Gamma %</label><input type="range" id="ef-gamma" min="40" max="220" value="100" style="flex-grow:1;" oninput="document.getElementById('ef-gamma-val').innerText=this.value; FilterManager.preview()"> <span id="ef-gamma-val" style="width:36px;text-align:right;">100</span></div>
                `);
                break;
            case 'wave':
                this.showModal(illuEffectTitle('wave', 'Déformation en vague'), `
                    <div class="field-row"><label style="width: 92px;" data-i18n="effect.param.amplitude">Amplitude</label><input type="range" id="ef-wave-a" min="0" max="80" value="12" style="flex-grow:1;" oninput="document.getElementById('ef-wave-a-val').innerText=this.value; FilterManager.preview()"> <span id="ef-wave-a-val" style="width:28px;text-align:right;">12</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 92px;" data-i18n="effect.param.frequency">Fréquence</label><input type="range" id="ef-wave-f" min="4" max="48" value="14" style="flex-grow:1;" oninput="document.getElementById('ef-wave-f-val').innerText=this.value; FilterManager.preview()"> <span id="ef-wave-f-val" style="width:28px;text-align:right;">14</span></div>
                    ${this._fxChromaToggle()}
                `);
                break;
            case 'colorbal':
                // Initialiser AVANT showModal : showModal lie l'éditeur de courbes
                // immédiatement, or CurveEditor.bind abandonne si _cbParams est nul.
                if (!this._cbParams) {
                    const defPts = [{x:0, y:0}, {x:255, y:255}];
                    this._cbParams = {
                        curveMaster: JSON.parse(JSON.stringify(defPts)),
                        curveR: JSON.parse(JSON.stringify(defPts)),
                        curveG: JSON.parse(JSON.stringify(defPts)),
                        curveB: JSON.parse(JSON.stringify(defPts))
                    };
                }
                this.showModal(illuEffectTitle('colorbal', 'Balance des couleurs'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;" data-i18n="effect.desc.colorbal">Ajustez l'équilibre colorimétrique (RVB) ou utilisez les courbes avancées.</p>
                    <div class="field-row"><label style="width: 92px;" data-i18n="effect.param.red">Rouge</label><input type="range" id="ef-cb-r" min="-80" max="80" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-cb-r-val').innerText=this.value; FilterManager.preview()"> <span id="ef-cb-r-val" style="width:28px;text-align:right;">0</span></div>
                    <div class="field-row" style="margin-top:4px;"><label style="width: 92px;" data-i18n="effect.param.green">Vert</label><input type="range" id="ef-cb-g" min="-80" max="80" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-cb-g-val').innerText=this.value; FilterManager.preview()"> <span id="ef-cb-g-val" style="width:28px;text-align:right;">0</span></div>
                    <div class="field-row" style="margin-top:4px;"><label style="width: 92px;" data-i18n="effect.param.blue">Bleu</label><input type="range" id="ef-cb-b" min="-80" max="80" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-cb-b-val').innerText=this.value; FilterManager.preview()"> <span id="ef-cb-b-val" style="width:28px;text-align:right;">0</span></div>
                    <div style="margin-top:8px;border-top:1px solid #b9b3a0;padding-top:8px;">
                        <div style="font-size:11px;font-weight:bold;margin-bottom:4px;" data-i18n="effect.advanced.toneCurves">Courbes des tonalités</div>
                        ${window.IlluImageAdjustCore.CurveEditor.createHtml('ef-cb')}
                    </div>
                `);
                this._forceRedrawCurves();
                break;
            case 'mirrorquad':
                this.showModal(illuEffectTitle('mirrorquad', 'Miroir 4 secteurs'), `
                    <p style="margin:0;font-size:11px;color:#333;" data-i18n="effect.desc.mirrorquad">Le quadrant haut-gauche est répété par symétrie dans les 4 quarts (effet « kaleïdoscope carré »).</p>
                `);
                break;
            case 'ral':
                this.showModal(illuEffectTitle('ral', 'Conversion RAL'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;" data-i18n="effect.desc.ral">Convertit l'image aux teintes industrielles standard de la palette RAL Classic.</p>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:92px;" data-i18n="effect.param.ralSwatch">Nuancier RAL</label>
                        <select id="ef-ral-category" onchange="FilterManager.preview()" style="flex-grow:1;">
                            <option value="all" data-i18n="effect.ral.all">Tous (216 couleurs)</option>
                            <option value="yellow" data-i18n="effect.ral.yellow">Jaunes (RAL 1000 - 1037)</option>
                            <option value="orange" data-i18n="effect.ral.orange">Oranges (RAL 2000 - 2017)</option>
                            <option value="red" data-i18n="effect.ral.red">Rouges (RAL 3000 - 3033)</option>
                            <option value="violet" data-i18n="effect.ral.violet">Violets (RAL 4001 - 4012)</option>
                            <option value="blue" data-i18n="effect.ral.blue">Bleus (RAL 5000 - 5026)</option>
                            <option value="green" data-i18n="effect.ral.green">Verts (RAL 6000 - 6038)</option>
                            <option value="grey" data-i18n="effect.ral.grey">Gris (RAL 7000 - 7048)</option>
                            <option value="brown" data-i18n="effect.ral.brown">Bruns (RAL 8000 - 8029)</option>
                            <option value="white-black" data-i18n="effect.ral.whiteBlack">Blancs et Noirs (RAL 9001 - 9023)</option>
                        </select>
                    </div>
                    <div class="field-row" style="margin-top:6px;">
                        <label style="width:92px;" data-i18n="effect.param.dither">Tramage %</label>
                        <input type="range" id="ef-ral-dither" min="0" max="100" value="0" style="flex-grow:1;" oninput="document.getElementById('ef-ral-dither-val').innerText=this.value; FilterManager.preview()">
                        <span id="ef-ral-dither-val" style="width:28px;text-align:right;">0</span>
                    </div>
                    <div id="ral-stats-container" style="margin-top:12px;padding:8px;border:1px solid #ccc;background:#f5f5f5;border-radius:4px;display:none;">
                        <div style="font-weight:bold;font-size:11px;margin-bottom:6px;color:#333;" data-i18n="effect.ral.statsTitle">Couleurs RAL principales détectées :</div>
                        <div id="ral-stats-list" style="display:flex;flex-direction:column;gap:4px;font-size:10px;"></div>
                    </div>
                `);
                break;
            case 'cmjn':
                this.showModal(illuEffectTitle('cmjn', 'Conversion CMJN'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;" data-i18n="effect.desc.cmjn">Simule l'espace colorimétrique d'une imprimante par synthèse soustractive (CMJN) et restitue les couleurs reproductibles.</p>
                `);
                break;
            case 'contour':
                this.showModal(illuEffectTitle('contour', 'Contour (Transparence)'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;" data-i18n="effect.desc.contour">Dessine un contour de couleur autour des éléments basé sur la transparence.</p>
                    <div class="field-row" style="margin-top:6px;">
                        <label style="width:92px;" data-i18n="effect.param.width">Largeur (px)</label>
                        <input type="range" id="ef-contour-width" min="1" max="20" value="3" style="flex-grow:1;" oninput="document.getElementById('ef-contour-width-val').innerText=this.value; FilterManager.preview()">
                        <span id="ef-contour-width-val" style="width:28px;text-align:right;">3</span>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:92px;" data-i18n="effect.param.color">Couleur</label>
                        <button type="button" onclick="window.toggleFloatingPaletteVisibility('win-colors')" style="flex-grow:1; font-size:11px; padding:3px 6px;">
                            <i class="fa-solid fa-palette"></i> Palette de Couleurs (Primaire)
                        </button>
                    </div>
                    <div class="field-row" style="margin-top:6px;">
                        <label style="width:92px;" data-i18n="effect.param.opacity">Opacité %</label>
                        <input type="range" id="ef-contour-opacity" min="0" max="100" value="100" style="flex-grow:1;" oninput="document.getElementById('ef-contour-opacity-val').innerText=this.value; FilterManager.preview()">
                        <span id="ef-contour-opacity-val" style="width:28px;text-align:right;">100</span>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:92px;" data-i18n="effect.param.position">Position</label>
                        <select id="ef-contour-mode" onchange="FilterManager.preview()" style="flex-grow:1;">
                            <option value="outside" data-i18n="effect.contour.outside">Extérieur</option>
                            <option value="inside" data-i18n="effect.contour.inside">Intérieur</option>
                            <option value="both" data-i18n="effect.contour.both">Double (Centré)</option>
                        </select>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:92px;" data-i18n="effect.param.corner">Angles</label>
                        <select id="ef-contour-corner" onchange="FilterManager.preview()" style="flex-grow:1;">
                            <option value="round" data-i18n="effect.contour.round">Arrondi</option>
                            <option value="miter" selected data-i18n="effect.contour.miter">Pointu (Miter)</option>
                        </select>
                    </div>
                `);
                break;
            case 'ascii':
                this.showModal(illuEffectTitle('ascii', 'Art ASCII'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;" data-i18n="effect.desc.ascii">Recompose l'image avec des caractères : chaque cellule reçoit le caractère dont la densité correspond à sa luminosité, et sa couleur moyenne.</p>
                    <div class="field-row" style="margin-top:6px;">
                        <label style="width:92px;" data-i18n="effect.param.asciiSize">Taille car. (px)</label>
                        <input type="range" id="ef-ascii-size" min="4" max="48" value="10" style="flex-grow:1;" oninput="document.getElementById('ef-ascii-size-val').innerText=this.value; FilterManager.preview()">
                        <span id="ef-ascii-size-val" style="width:28px;text-align:right;">10</span>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:92px;" data-i18n="effect.param.asciiFont">Police</label>
                        <select id="ef-ascii-font" onchange="FilterManager.preview()" style="flex-grow:1;">
                            <option value="monospace" data-i18n="effect.ascii.fontSystem">Monospace (système)</option>
                            <option value="&quot;Courier New&quot;, monospace">Courier New</option>
                            <option value="Consolas, monospace">Consolas</option>
                            <option value="&quot;Share Tech Mono&quot;, monospace">Share Tech Mono</option>
                            <option value="VT323, monospace">VT323</option>
                            <option value="&quot;Press Start 2P&quot;, monospace">Press Start 2P</option>
                            <option value="Silkscreen, monospace">Silkscreen</option>
                        </select>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:92px;" data-i18n="effect.param.asciiSet">Jeu de car.</label>
                        <select id="ef-ascii-set" onchange="FilterManager.setAsciiCharset(this)" style="flex-grow:1;">
                            <option value="standard" data-i18n="effect.ascii.setStandard">Classique (10 niveaux)</option>
                            <option value="detailed" data-i18n="effect.ascii.setDetailed">Détaillé (70 niveaux)</option>
                            <option value="blocks" data-i18n="effect.ascii.setBlocks">Blocs (░▒▓█)</option>
                            <option value="dots" data-i18n="effect.ascii.setDots">Points</option>
                            <option value="binary" data-i18n="effect.ascii.setBinary">Binaire (1/0)</option>
                            <option value="custom" data-i18n="effect.ascii.setCustom">Personnalisé…</option>
                        </select>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:92px;" data-i18n="effect.param.asciiChars">Caractères</label>
                        <input type="text" id="ef-ascii-chars" spellcheck="false" autocomplete="off" style="flex-grow:1;font-family:monospace;" oninput="FilterManager.onAsciiCharsInput()">
                    </div>
                    <div style="margin:3px 0 0 92px;font-size:10px;color:#666;" data-i18n="effect.ascii.charsHint">Du plus clair (à gauche) au plus dense (à droite).</div>
                    <div class="field-row" style="margin-top:6px;">
                        <label style="width:92px;" data-i18n="effect.param.gamma">Gamma</label>
                        <input type="range" id="ef-ascii-gamma" min="20" max="300" value="100" style="flex-grow:1;" oninput="document.getElementById('ef-ascii-gamma-val').innerText=this.value; FilterManager.preview()">
                        <span id="ef-ascii-gamma-val" style="width:28px;text-align:right;">100</span>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:14px;">
                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" id="ef-ascii-invert" onchange="FilterManager.preview()"><span data-i18n="effect.param.asciiInvert">Inverser la rampe</span></label>
                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" id="ef-ascii-bold" onchange="FilterManager.preview()"><span data-i18n="effect.param.asciiBold">Gras</span></label>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:92px;" data-i18n="effect.param.color">Couleur</label>
                        <select id="ef-ascii-color" onchange="FilterManager.setAsciiColorMode()" style="flex-grow:1;">
                            <option value="pixel" data-i18n="effect.ascii.colorPixel">Couleur des pixels</option>
                            <option value="solid" data-i18n="effect.ascii.colorSolid">Couleur unique (primaire)</option>
                        </select>
                    </div>
                    <div class="field-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <label style="width:92px;" data-i18n="effect.param.asciiBg">Fond</label>
                        <select id="ef-ascii-bg" onchange="FilterManager.setAsciiColorMode()" style="flex-grow:1;">
                            <option value="transparent" data-i18n="effect.ascii.bgTransparent">Transparent</option>
                            <option value="black" data-i18n="effect.ascii.bgBlack">Noir</option>
                            <option value="white" data-i18n="effect.ascii.bgWhite">Blanc</option>
                            <option value="secondary" data-i18n="effect.ascii.bgSecondary">Couleur secondaire</option>
                        </select>
                    </div>
                    <div class="field-row" id="ef-ascii-color-row" style="margin-top:6px;align-items:center;gap:8px;">
                        <button type="button" onclick="window.toggleFloatingPaletteVisibility('win-colors')" style="flex-grow:1;font-size:11px;padding:3px 6px;">
                            <i class="fa-solid fa-palette"></i> <span data-i18n="effect.ascii.paletteBtn">Palette de couleurs</span>
                        </button>
                        <div id="ef-ascii-swatch" style="width:24px;height:18px;border:1px solid #888;flex-shrink:0;background:#000000;"></div>
                    </div>
                `);
                break;
            case 'duotone':
                this.showModal(illuEffectTitle('duotone', 'Duo-tone'), `
                    <p style="margin:0 0 8px;font-size:11px;color:#333;" data-i18n="effect.desc.duotone">Teinte du dégradé selon la luminance du calque.</p>
                    <div class="field-row" style="align-items:center;gap:8px;">
                        <button type="button" onclick="window.toggleFloatingPaletteVisibility('win-colors')" style="flex-grow:1; font-size:11px; padding:3px 6px;">
                            <i class="fa-solid fa-palette"></i> Palette de Couleurs (Prim. / Sec.)
                        </button>
                    </div>
                    <div class="field-row" style="margin-top:8px;"><label style="width: 92px;" data-i18n="effect.param.midtone">Mi-ton</label><input type="range" id="ef-duo-mid" min="0" max="255" value="128" style="flex-grow:1;" oninput="document.getElementById('ef-duo-mid-val').innerText=this.value; FilterManager.preview()"> <span id="ef-duo-mid-val" style="width:28px;text-align:right;">128</span></div>
                `);
                break;
            case 'chroma':
                this.showModal(illuEffectTitle('chroma', 'Incrustation Pro (CIELAB)'), window.ChromaKeyer.getUI(window.IlluI18n, {
                    r: parseInt(document.getElementById('ef-ch-r')?.value || 0, 10),
                    g: parseInt(document.getElementById('ef-ch-g')?.value || 255, 10),
                    b: parseInt(document.getElementById('ef-ch-b')?.value || 0, 10)
                }));
                if (window.ChromaKeyer && window.ChromaKeyer.syncUI) window.ChromaKeyer.syncUI();
                break;
            case 'median':
                this.showModal(illuEffectTitle('median', 'Réduction du bruit'), `
                    <div class="field-row"><label style="width: 92px;" data-i18n="effect.param.density">Densité (rayon)</label><input type="range" id="ef-med-rad" min="1" max="4" value="1" style="flex-grow:1;" oninput="document.getElementById('ef-med-rad-val').innerText=this.value; FilterManager.preview()"> <span id="ef-med-rad-val" style="width:28px;text-align:right;">1</span></div>
                    <div class="field-row" style="margin-top:6px;"><label style="width: 92px;">Intensité %</label><input type="range" id="ef-med-str" min="0" max="100" value="100" style="flex-grow:1;" oninput="document.getElementById('ef-med-str-val').innerText=this.value; FilterManager.preview()"> <span id="ef-med-str-val" style="width:28px;text-align:right;">100</span></div>
                `);
                break;
            case 'vhs': {
                this.showModal(illuEffectTitle('vhs', 'Effet VHS'), `
                    <div class="illu-vhs-split">
                        <div class="illu-vhs-preview-col" aria-label="Aperçu VHS">
                            <canvas id="illu-vhs-preview-canvas" class="illu-vhs-preview-canvas" width="1" height="1"></canvas>
                        </div>
                        <div class="illu-vhs-controls-col">
                            <div class="illu-vhs-scroll illu-vhs-controls-inner">
                        <p class="illu-vhs-hint" data-i18n="effect.vhsHint">Look cassette : décalage chromatique, bande de tête, bruit et glitch. Ajustez les curseurs ou choisissez un préréglage.</p>
                        <p class="illu-vhs-hint illu-vhs-hint--muted" data-i18n="effect.vhsPreviewHint">L’aperçu ne modifie pas le calque tant que vous n’avez pas validé (OK). Résolution réglable pour la fluidité.</p>
                        <input type="hidden" id="ef-vhs-preset" value="default">
                        <section class="illu-cr-sec">
                            <h3 class="illu-cr-sec-h" data-illu-vhs-toggle><span class="illu-cr-chev">▼</span> <span data-i18n="effect.vhsSecPresets">Préréglages & aperçu</span></h3>
                            <div class="illu-cr-sec-body">
                                <div class="field-row" style="margin-bottom:8px;align-items:center;flex-wrap:wrap;gap:6px;">
                                    <label style="min-width:100px;" data-i18n="effect.vhsPreviewMax">Max. aperçu (px)</label>
                                    <input type="range" id="ef-vhs-preview_max" min="200" max="900" step="20" value="480" style="flex:1;min-width:120px;" oninput="document.getElementById('ef-vhs-preview_max-val').textContent=this.value;FilterManager.preview()">
                                    <span id="ef-vhs-preview_max-val" style="width:40px;text-align:right;">480</span>
                                </div>
                                <div class="illu-vhs-preset-row">
                                    <button type="button" onclick="illuVhsApplyPreset('default')" data-i18n="effect.vhsPresetClassic">Classique</button>
                                    <button type="button" onclick="illuVhsApplyPreset('pro')" data-i18n="effect.vhsPresetPro">Pro</button>
                                    <button type="button" onclick="illuVhsApplyPreset('vhs')">Cassette VHS</button>
                                    <button type="button" onclick="illuVhsApplyPreset('minidv')">Mini DV</button>
                                    <button type="button" onclick="illuVhsApplyPreset('damaged')" data-i18n="effect.vhsPresetDamaged">Abîmé</button>
                                    <button type="button" onclick="illuVhsApplyPreset('pellicule')" data-i18n="effect.vhsPresetFilm">Pellicule</button>
                                    <button type="button" onclick="illuVhsApplyPreset('vintage')" data-i18n="effect.vhsPresetVintage">8mm</button>
                                    <button type="button" onclick="illuVhsApplyPreset('photo')">Polaroïd</button>
                                    <button type="button" onclick="illuVhsApplyPreset('matrix')">Matrix</button>
                                    <button type="button" onclick="illuVhsApplyPreset('dune')">Dune</button>
                                    <button type="button" onclick="illuVhsApplyPreset('cyberpunk')" data-i18n="effect.vhsPresetCyber">Cyberpunk</button>
                                </div>
                            </div>
                        </section>
                        <section class="illu-cr-sec illu-cr-sec--collapsed">
                            <h3 class="illu-cr-sec-h" data-illu-vhs-toggle><span class="illu-cr-chev">▼</span> <span data-i18n="effect.vhsSecCrop">Cadrage & couleur</span></h3>
                            <div class="illu-cr-sec-body illu-vhs-grid">
                            <div class="field-row" style="margin-bottom:8px;gap:12px;flex-wrap:wrap;">
                                <label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="ef-vhs-enable_y" checked onchange="FilterManager.preview()"> Y</label>
                                <label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="ef-vhs-enable_r" checked onchange="FilterManager.preview()"> R</label>
                                <label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="ef-vhs-enable_g" checked onchange="FilterManager.preview()"> V</label>
                                <label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="ef-vhs-enable_b" checked onchange="FilterManager.preview()"> B</label>
                            </div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsCropPad">Rognage (px)</label>
                                <input type="range" id="ef-vhs-crop_padding" min="0" max="64" value="6" style="flex:1;" oninput="document.getElementById('ef-vhs-crop_padding-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-crop_padding-val" style="width:32px;text-align:right;">6</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsCropFeather">Fondu bordure</label>
                                <input type="range" id="ef-vhs-crop_feather" min="0" max="32" value="4" style="flex:1;" oninput="document.getElementById('ef-vhs-crop_feather-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-crop_feather-val" style="width:32px;text-align:right;">4</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsShiftY">Décalage Y</label>
                                <input type="range" id="ef-vhs-shift_y" min="-40" max="40" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-shift_y-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-shift_y-val" style="width:36px;text-align:right;">0</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsShiftR">Décalage R</label>
                                <input type="range" id="ef-vhs-shift_r" min="-40" max="40" value="-13" style="flex:1;" oninput="document.getElementById('ef-vhs-shift_r-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-shift_r-val" style="width:36px;text-align:right;">-13</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsShiftG">Décalage V</label>
                                <input type="range" id="ef-vhs-shift_g" min="-40" max="40" value="8" style="flex:1;" oninput="document.getElementById('ef-vhs-shift_g-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-shift_g-val" style="width:36px;text-align:right;">8</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsShiftB">Décalage B</label>
                                <input type="range" id="ef-vhs-shift_b" min="-40" max="40" value="6" style="flex:1;" oninput="document.getElementById('ef-vhs-shift_b-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-shift_b-val" style="width:36px;text-align:right;">6</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsLumaContrast">Contraste luma</label>
                                <input type="range" id="ef-vhs-luma_contrast" min="0.5" max="2.5" step="0.05" value="1" style="flex:1;" oninput="document.getElementById('ef-vhs-luma_contrast-val').textContent=Number(this.value).toFixed(2);FilterManager.preview()">
                                <span id="ef-vhs-luma_contrast-val" style="width:36px;text-align:right;">1.00</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsLumaBright">Luminosité luma</label>
                                <input type="range" id="ef-vhs-luma_brightness" min="-50" max="50" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-luma_brightness-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-luma_brightness-val" style="width:36px;text-align:right;">0</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsChromaPhase">Phase chroma (°)</label>
                                <input type="range" id="ef-vhs-chroma_phase" min="-180" max="180" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-chroma_phase-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-chroma_phase-val" style="width:36px;text-align:right;">0</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Pixelisation</label>
                                <input type="range" id="ef-vhs-pixel_size" min="1" max="15" step="1" value="1" style="flex:1;" oninput="document.getElementById('ef-vhs-pixel_size-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-pixel_size-val" style="width:36px;text-align:right;">1</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Patine / flou bande</label>
                                <input type="range" id="ef-vhs-band_patina" min="0.2" max="1" step="0.01" value="0.9" style="flex:1;" oninput="document.getElementById('ef-vhs-band_patina-val').textContent=Number(this.value).toFixed(2);FilterManager.preview()">
                                <span id="ef-vhs-band_patina-val" style="width:36px;text-align:right;">0.90</span></div>
                            <div class="field-row" style="margin-bottom:6px;align-items:center;gap:8px;">
                                <label style="display:flex;align-items:center;gap:4px;width:120px;"><input type="checkbox" id="ef-vhs-apply_jpeg" onchange="FilterManager.preview()"> Flou codec</label>
                                <input type="range" id="ef-vhs-jpeg_quality" min="1" max="100" step="1" value="86" style="flex:1;" oninput="document.getElementById('ef-vhs-jpeg_quality-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-jpeg_quality-val" style="width:36px;text-align:right;">86</span></div>
                            </div>
                        </section>
                        <section class="illu-cr-sec illu-cr-sec--collapsed">
                            <h3 class="illu-cr-sec-h" data-illu-vhs-toggle><span class="illu-cr-chev">▼</span> <span>Colorimétrie</span></h3>
                            <div class="illu-cr-sec-body illu-vhs-grid">
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Sat. bordures</label>
                                <input type="range" id="ef-vhs-edge_sat" min="0" max="20" step="0.1" value="4.8" style="flex:1;" oninput="document.getElementById('ef-vhs-edge_sat-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-edge_sat-val" style="width:36px;text-align:right;">4.8</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Sat. bas de bande</label>
                                <input type="range" id="ef-vhs-hs_sat" min="-5" max="15" step="0.1" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-hs_sat-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-hs_sat-val" style="width:36px;text-align:right;">0</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Sat. ombres</label>
                                <input type="range" id="ef-vhs-shadow_sat" min="-5" max="5" step="0.1" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-shadow_sat-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-shadow_sat-val" style="width:36px;text-align:right;">0</span></div>
                            <div class="field-row" style="margin-bottom:6px;">
                                <label style="display:flex;align-items:center;gap:4px;width:120px;"><input type="checkbox" id="ef-vhs-apply_color_cast" checked onchange="FilterManager.preview()"> Teinte globale</label>
                            </div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Teinte R</label>
                                <input type="range" id="ef-vhs-cast_r" min="-50" max="50" step="1" value="33" style="flex:1;" oninput="document.getElementById('ef-vhs-cast_r-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-cast_r-val" style="width:36px;text-align:right;">33</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Teinte V</label>
                                <input type="range" id="ef-vhs-cast_g" min="-50" max="50" step="1" value="-5" style="flex:1;" oninput="document.getElementById('ef-vhs-cast_g-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-cast_g-val" style="width:36px;text-align:right;">-5</span></div>
                            <div class="field-row" style="margin-bottom:4px;"><label style="width:120px;">Teinte B</label>
                                <input type="range" id="ef-vhs-cast_b" min="-50" max="50" step="1" value="-10" style="flex:1;" oninput="document.getElementById('ef-vhs-cast_b-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-cast_b-val" style="width:36px;text-align:right;">-10</span></div>
                            </div>
                        </section>
                        <section class="illu-cr-sec">
                            <h3 class="illu-cr-sec-h" data-illu-vhs-toggle><span class="illu-cr-chev">▼</span> <span data-i18n="effect.vhsSecTape">Bande & dégradation</span></h3>
                            <div class="illu-cr-sec-body illu-vhs-grid">
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsChromaBleed">Dérive chroma</label>
                            <input type="range" id="ef-vhs-chroma_bleed" min="0" max="80" value="12" style="flex:1;" oninput="document.getElementById('ef-vhs-chroma_bleed-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-chroma_bleed-val" style="width:32px;text-align:right;">12</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsChromaBlur">Flou chroma</label>
                            <input type="range" id="ef-vhs-chroma_blur" min="0" max="50" value="25" style="flex:1;" oninput="document.getElementById('ef-vhs-chroma_blur-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-chroma_blur-val" style="width:32px;text-align:right;">25</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsSat">Saturation</label>
                            <input type="range" id="ef-vhs-chroma_saturation" min="0" max="50" step="0.1" value="2.4" style="flex:1;" oninput="document.getElementById('ef-vhs-chroma_saturation-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-chroma_saturation-val" style="width:36px;text-align:right;">2.4</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsNoiseY">Bruit Y</label>
                            <input type="range" id="ef-vhs-noise_intensity_y" min="0" max="100" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-noise_intensity_y-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-noise_intensity_y-val" style="width:32px;text-align:right;">0</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsNoiseC">Bruit chroma</label>
                            <input type="range" id="ef-vhs-noise_intensity_c" min="0" max="100" value="30" style="flex:1;" oninput="document.getElementById('ef-vhs-noise_intensity_c-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-noise_intensity_c-val" style="width:32px;text-align:right;">30</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsGlitch">Glitch</label>
                            <input type="range" id="ef-vhs-glitch_intensity" min="0" max="15" step="0.1" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-glitch_intensity-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-glitch_intensity-val" style="width:36px;text-align:right;">0</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsJitter">Jitter</label>
                            <input type="range" id="ef-vhs-jitter_amp" min="0" max="8" step="0.1" value="1" style="flex:1;" oninput="document.getElementById('ef-vhs-jitter_amp-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-jitter_amp-val" style="width:36px;text-align:right;">1</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;" data-i18n="effect.vhsHead">Bande tête (px)</label>
                            <input type="range" id="ef-vhs-head_switch_rows" min="0" max="300" value="95" style="flex:1;" oninput="document.getElementById('ef-vhs-head_switch_rows-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-head_switch_rows-val" style="width:36px;text-align:right;">95</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Fréq. jitter</label>
                            <input type="range" id="ef-vhs-jitter_freq" min="0" max="2" step="0.01" value="0.39" style="flex:1;" oninput="document.getElementById('ef-vhs-jitter_freq-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-jitter_freq-val" style="width:36px;text-align:right;">0.39</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Traînée lumineuse</label>
                            <input type="range" id="ef-vhs-luma_smear" min="0" max="100" step="1" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-luma_smear-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-luma_smear-val" style="width:36px;text-align:right;">0</span></div>
                        <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Délavement rose</label>
                            <input type="range" id="ef-vhs-right_pink" min="0" max="100" step="1" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-right_pink-val').textContent=this.value;FilterManager.preview()">
                            <span id="ef-vhs-right_pink-val" style="width:36px;text-align:right;">0</span></div>
                        <div class="field-row" style="margin-bottom:4px;"><label style="width:120px;">Largeur délavement</label>
                            <input type="range" id="ef-vhs-right_pink_width" min="0.05" max="1" step="0.05" value="0.4" style="flex:1;" oninput="document.getElementById('ef-vhs-right_pink_width-val').textContent=Number(this.value).toFixed(2);FilterManager.preview()">
                            <span id="ef-vhs-right_pink_width-val" style="width:36px;text-align:right;">0.40</span></div>
                            </div>
                        </section>
                        <section class="illu-cr-sec illu-cr-sec--collapsed">
                            <h3 class="illu-cr-sec-h" data-illu-vhs-toggle><span class="illu-cr-chev">▼</span> <span>Déformation bas de bande</span></h3>
                            <div class="illu-cr-sec-body illu-vhs-grid">
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Tirage (pull)</label>
                                <input type="range" id="ef-vhs-head_switch_pull" min="0" max="100" step="1" value="24" style="flex:1;" oninput="document.getElementById('ef-vhs-head_switch_pull-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-head_switch_pull-val" style="width:36px;text-align:right;">24</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Onde fréq.</label>
                                <input type="range" id="ef-vhs-head_switch_freq" min="0" max="2" step="0.01" value="0.52" style="flex:1;" oninput="document.getElementById('ef-vhs-head_switch_freq-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-head_switch_freq-val" style="width:36px;text-align:right;">0.52</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Onde amp.</label>
                                <input type="range" id="ef-vhs-head_switch_wave" min="0" max="5" step="0.1" value="0.5" style="flex:1;" oninput="document.getElementById('ef-vhs-head_switch_wave-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-head_switch_wave-val" style="width:36px;text-align:right;">0.5</span></div>
                            <div class="field-row" style="margin-bottom:4px;"><label style="width:120px;">Bruit déchirure</label>
                                <input type="range" id="ef-vhs-head_switch_noise" min="0" max="100" step="1" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-head_switch_noise-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-head_switch_noise-val" style="width:36px;text-align:right;">0</span></div>
                            </div>
                        </section>
                        <section class="illu-cr-sec illu-cr-sec--collapsed">
                            <h3 class="illu-cr-sec-h" data-illu-vhs-toggle><span class="illu-cr-chev">▼</span> <span>Bandes couleur (tracking)</span></h3>
                            <div class="illu-cr-sec-body illu-vhs-grid">
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Intensité bandes</label>
                                <input type="range" id="ef-vhs-hs_color_tear" min="0" max="1" step="0.05" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-hs_color_tear-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-hs_color_tear-val" style="width:36px;text-align:right;">0</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Couleur</label>
                                <select id="ef-vhs-tear_color" style="flex:1;" onchange="FilterManager.preview()">
                                    <option value="cyan">Cyan / Bleu</option>
                                    <option value="magenta">Magenta / Rose</option>
                                    <option value="red">Rouge</option>
                                    <option value="green">Vert</option>
                                    <option value="random">Aléatoire</option>
                                </select></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Hauteur max (%)</label>
                                <input type="range" id="ef-vhs-tear_max_height" min="0" max="100" step="1" value="20" style="flex:1;" oninput="document.getElementById('ef-vhs-tear_max_height-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-tear_max_height-val" style="width:36px;text-align:right;">20</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Largeur (%)</label>
                                <input type="range" id="ef-vhs-tear_length" min="10" max="100" step="1" value="80" style="flex:1;" oninput="document.getElementById('ef-vhs-tear_length-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-tear_length-val" style="width:36px;text-align:right;">80</span></div>
                            <div class="field-row" style="margin-bottom:4px;"><label style="width:120px;">Épaisseur (px)</label>
                                <input type="range" id="ef-vhs-tear_thickness" min="1" max="50" step="1" value="2" style="flex:1;" oninput="document.getElementById('ef-vhs-tear_thickness-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-tear_thickness-val" style="width:36px;text-align:right;">2</span></div>
                            </div>
                        </section>
                        <section class="illu-cr-sec illu-cr-sec--collapsed">
                            <h3 class="illu-cr-sec-h" data-illu-vhs-toggle><span class="illu-cr-chev">▼</span> <span>Glitch & rayures</span></h3>
                            <div class="illu-cr-sec-body illu-vhs-grid">
                            <div class="field-row" style="margin-bottom:6px;gap:10px;flex-wrap:wrap;">
                                <label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="ef-vhs-glitch_jitter" checked onchange="FilterManager.preview()"> Tremblement</label>
                                <label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="ef-vhs-glitch_dropouts" checked onchange="FilterManager.preview()"> Rayures</label>
                                <label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="ef-vhs-glitch_tears" checked onchange="FilterManager.preview()"> Tracking</label>
                                <label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" id="ef-vhs-glitch_noise" checked onchange="FilterManager.preview()"> Bruit</label>
                            </div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Quantité rayures</label>
                                <input type="range" id="ef-vhs-dropout_chance" min="0" max="1" step="0.01" value="0" style="flex:1;" oninput="document.getElementById('ef-vhs-dropout_chance-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-dropout_chance-val" style="width:36px;text-align:right;">0</span></div>
                            <div class="field-row" style="margin-bottom:6px;"><label style="width:120px;">Longueur rayure</label>
                                <input type="range" id="ef-vhs-dropout_len" min="0.01" max="1" step="0.01" value="0.2" style="flex:1;" oninput="document.getElementById('ef-vhs-dropout_len-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-dropout_len-val" style="width:36px;text-align:right;">0.2</span></div>
                            <div class="field-row" style="margin-bottom:4px;"><label style="width:120px;">Épaisseur rayure</label>
                                <input type="range" id="ef-vhs-dropout_thickness" min="1" max="20" step="1" value="2" style="flex:1;" oninput="document.getElementById('ef-vhs-dropout_thickness-val').textContent=this.value;FilterManager.preview()">
                                <span id="ef-vhs-dropout_thickness-val" style="width:36px;text-align:right;">2</span></div>
                            </div>
                        </section>
                            </div>
                        </div>
                    </div>
                `);
                break;
            }
            default: {
                this._effectDialogScope = this._hasVisiblePixelSelection() ? 'selection' : 'active';
                this._effectSessionScopeAll = false;
                this._setupEffectTargets();

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.apply(true);
                    });
                });
                break;
            }
        }
    },

    /**
     * Modales dont la largeur est imposée par un contenu non textuel (éditeur de
     * courbes, grille de nuanciers, aperçu ASCII) : la mesure automatique ne
     * conviendrait pas. `vhs` est absent : sa largeur vient de `.effect-dialog--vhs`.
     */
    _effectDialogFixedWidth: {
        projection3d: 480,
        chroma: 420,
        colorbal: 400,
        ral: 460,
        ascii: 420,
        halftone: 400,
        gallery: 380
    },

    /**
     * Normalise le contenu de la modale puis lui donne une largeur proportionnée.
     * Appelée juste après l'injection du HTML, avant le centrage de la fenêtre.
     *
     * @param {HTMLElement|null} win  `#effect-dialog-window`
     * @param {HTMLElement} content   `#effect-dialog-content`
     */
    _applyEffectDialogWidth(win, content) {
        const ui = window.IlluEffectDialogUI;
        const info = ui ? ui.normalize(content, { effect: this.currentEffect }) : null;
        if (!win) return;
        if (this.currentEffect === 'vhs') return; /* largeur pilotée par la classe VHS */

        const w = this._effectDialogFixedWidth[this.currentEffect] ||
            (ui ? ui.suggestWidth(content, info) : 400);
        /* La barre de portée impose un plancher : trois boutons côte à côte. */
        win.style.width = Math.max(340, w) + 'px';
    },

    showModal(title, html) {
        if (this._isMobilePhoneEffectUi()) {
            this._effectDialogScope = 'all';
        } else {
            this._clearEffectDialogScopeSession();
        }
        const shell = document.getElementById('effect-dialog');
        const win = document.getElementById('effect-dialog-window');
        if (win) {
            win.classList.toggle('effect-dialog--vhs', this.currentEffect === 'vhs');
            if (this.currentEffect === 'vhs') {
                this._vhsSkipCanvasWrite = true;
                win.style.removeProperty('width');
                win.style.removeProperty('max-width');
            }
            /* Largeur : calculée après normalisation du contenu (_applyEffectDialogWidth). */
            win.classList.add('floating-window');
            win.style.position = 'fixed';
        }
        document.body.classList.add('effect-dialog-open');
        if (this.currentEffect === 'contour' || this.currentEffect === 'duotone' || this.currentEffect === 'vignette') {
            document.body.classList.add('effect-allows-colors');
        }
        const titleEl = document.getElementById('effect-dialog-title');
        if (titleEl) {
            titleEl.textContent = title;
            const iconKey = illuEffectIconKey(this.currentEffect);
            if (iconKey) {
                titleEl.setAttribute('data-icon-key', iconKey);
                if (window.IlluI18n && typeof window.IlluI18n.applyIcons === 'function') {
                    window.IlluI18n.applyIcons(titleEl);
                }
            } else {
                titleEl.removeAttribute('data-icon-key');
            }
        }
        const scope = this._readEffectScope();
        const scopeRow = `<div class="effect-scope-bar illu-effect-scope-bar field-row" style="flex-wrap:nowrap;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #808080;font-size:11px;align-items:stretch;">
            <span class="illu-scope-bar-label" style="font-weight:600;flex-shrink:0;align-self:center;" data-i18n="effect.scopeLabel">Portée :</span>
            <div class="illu-scope-btn-row" role="group" aria-label="Portée de l’effet">
                <button type="button" class="illu-scope-btn${scope === 'selection' ? ' illu-scope-btn--active' : ''}" data-scope="selection" data-i18n="effect.scopeSelection">Sélection</button>
                <button type="button" class="illu-scope-btn${scope === 'active' ? ' illu-scope-btn--active' : ''}" data-scope="active" data-i18n="effect.scopeActive">Calque actif</button>
                <button type="button" class="illu-scope-btn${scope === 'all' ? ' illu-scope-btn--active' : ''}" data-scope="all" data-i18n="effect.scopeAll">Tous les calques</button>
            </div>
        </div>`;
        const content = document.getElementById('effect-dialog-content');
        /* Mode animation : seconde portée, orthogonale aux calques — sur quelles images
           l'effet est appliqué (image courante, sélection de la frise, toute l'animation). */
        content.innerHTML = scopeRow + this._buildFrameScopeRow() + html;

        /*
         * Mise au format compact : les gabarits d'effet sont écrits avec des styles en
         * ligne hétérogènes. EffectDialogUI enveloppe chaque curseur dans une piste
         * dégradée et rebâtit la grille libellé / piste / valeur, sans recréer aucun
         * élément (les id et les `oninput=` en ligne sont préservés).
         */
        this._applyEffectDialogWidth(win, content);

        const vhsFooterLink = document.getElementById('ef-vhs-open-video-pro');
        if (vhsFooterLink) {
            vhsFooterLink.hidden = this.currentEffect !== 'vhs';
            if (this.currentEffect !== 'vhs') vhsFooterLink.onclick = null;
        }
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') window.IlluI18n.apply();
        this._bindEffectScopeButtons();
        this._bindEffectFrameScopeButtons();
        this._restoreEffectParams();
        /* ASCII : la palette dépend des réglages restaurés (couleur unique / fond secondaire). */
        if (this.currentEffect === 'ascii') this._syncAsciiColorUi();
        if (this.currentEffect === 'halftone') this._syncHalftoneUi();
        if (this.currentEffect === 'vhs' && typeof window.illuVhsSyncSliderLabels === 'function') {
            window.illuVhsSyncSliderLabels();
        }
        this._installEffectPrefsListener();
        const pickBtn = document.getElementById('ef-ch-pick-btn');
        if (pickBtn) pickBtn.onclick = () => this.startChromaPick('A');
        const pickBtn2 = document.getElementById('ef-ch-pick-btn2');
        if (pickBtn2) pickBtn2.onclick = () => this.startChromaPick('B');
        const maskBtn = document.getElementById('ef-ch-apply-mask-btn');
        if (maskBtn) maskBtn.onclick = () => this.applyChromaAsAlphaMask();
        if (this.currentEffect === 'chroma') {
            this._syncChromaSwatch();
            if (window.ChromaKeyer && window.ChromaKeyer.syncUI) window.ChromaKeyer.syncUI(true);
        }
        if (this.currentEffect === 'hsv') {
            const hsvPanel = document.getElementById('ef-hsv-panel');
            if (hsvPanel) delete hsvPanel.dataset.hsvRefHue;
            this._syncHsvStripHue();
            if (window.IlluImageAdjustCore) {
                window.IlluImageAdjustCore.HSLManager.bind(document.getElementById('effect-dialog-content'), 'ef-hsv-mix', this._hsvMixParams, () => this.preview());
            }
        }
        if (this.currentEffect === 'colorbal') {
            if (window.IlluImageAdjustCore) {
                window.IlluImageAdjustCore.CurveEditor.bind(document.getElementById('effect-dialog-content'), 'ef-cb', this._cbParams, () => this.preview());
            }
        }
        if (this.currentEffect === 'cabossage') {
            const rn = document.getElementById('ef-cab-reset-noise');
            if (rn) {
                rn.onclick = () => {
                    this._cabossageSeed = (Math.random() * 0xffffffff) >>> 0;
                    this.preview();
                };
            }
        }
        if (this.currentEffect === 'contour' || this.currentEffect === 'duotone' || this.currentEffect === 'vignette' || this.currentEffect === 'ascii') {
            if (this._colorPollInterval) clearInterval(this._colorPollInterval);
            let lastP = window.EditorManager ? JSON.stringify(window.EditorManager.primaryColor) : '';
            let lastS = window.EditorManager ? JSON.stringify(window.EditorManager.secondaryColor) : '';
            this._colorPollInterval = setInterval(() => {
                if (document.getElementById('effect-dialog').style.display === 'none') {
                    clearInterval(this._colorPollInterval);
                    return;
                }
                if (!window.EditorManager) return;
                const curP = JSON.stringify(window.EditorManager.primaryColor);
                const curS = JSON.stringify(window.EditorManager.secondaryColor);
                if (curP !== lastP || curS !== lastS) {
                    lastP = curP;
                    lastS = curS;
                    // Update vignette swatch
                    if (this.currentEffect === 'vignette') {
                        const sw = document.getElementById('ef-vig-swatch');
                        if (sw && window.EditorManager.primaryColor) {
                            const c = window.EditorManager.primaryColor;
                            sw.style.background = `rgb(${c.r},${c.g},${c.b})`;
                        }
                    }
                    if (this.currentEffect === 'ascii') {
                        this._syncAsciiColorUi();
                        /* En « couleur des pixels » sur fond neutre, aucune couleur de palette n'est lue. */
                        if (!this._asciiUsesSolidColor() && !this._asciiUsesSecondaryBg()) return;
                    }
                    this.preview();
                }
            }, 200);
        }
        if (this.currentEffect === 'vhs') {
            document.querySelectorAll('#effect-dialog-content [data-illu-vhs-toggle]').forEach((h) => {
                h.addEventListener('click', () => {
                    h.closest('.illu-cr-sec')?.classList.toggle('illu-cr-sec--collapsed');
                });
            });
            const vBtn = document.getElementById('ef-vhs-open-video-pro');
            if (vBtn) {
                vBtn.hidden = false;
                vBtn.onclick = () => {
                    window.open('https://polocrafting.fr/VIDEO', '_blank', 'noopener');
                };
            }
            if (this._vhsPreviewResizeObs) {
                try {
                    this._vhsPreviewResizeObs.disconnect();
                } catch (e) {
                    /* ignore */
                }
                this._vhsPreviewResizeObs = null;
            }
            const vhsCol = document.querySelector('#effect-dialog-content .illu-vhs-preview-col');
            if (vhsCol && typeof ResizeObserver !== 'undefined') {
                this._vhsPreviewResizeObs = new ResizeObserver(() => {
                    if (this.currentEffect === 'vhs') this._updateVhsDialogPreviewCanvas();
                });
                this._vhsPreviewResizeObs.observe(vhsCol);
            }
        }
        if (shell) shell.style.display = 'block';
        document.body.classList.add('effect-dialog-open');
        if (win && shell) {
            const hasPos =
                (typeof window.applyEffectDialogSavedPosition === 'function' &&
                    window.applyEffectDialogSavedPosition(win)) ||
                (win.style.left &&
                    String(win.style.left).trim() !== '' &&
                    win.style.top &&
                    String(win.style.top).trim() !== '');
            if (!hasPos) {
                const w = win.offsetWidth || 440;
                const h = win.offsetHeight || 200;
                win.style.left = Math.max(0, Math.round((window.innerWidth - w) / 2)) + 'px';
                win.style.top = Math.max(0, Math.round((window.innerHeight - h) / 2)) + 'px';
            }
            if (typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
                window.WindowManager.bringToFront(win);
            }
            if (typeof window.illuScheduleEffectDialogWorkspaceClamp === 'function') {
                window.illuScheduleEffectDialogWorkspaceClamp();
            }
        }
        // Yield to allow the browser to paint the modal window before starting the heavy preview task
        // We use 300ms to ensure the window has plenty of time to animate/appear before CPU spikes
        setTimeout(() => this.preview(), 300);
    },

    _tearDownVhsEffectDialogUI() {
        const edw = document.getElementById('effect-dialog-window');
        if (edw) edw.classList.remove('effect-dialog--vhs');
        const vhsFooterLink = document.getElementById('ef-vhs-open-video-pro');
        if (vhsFooterLink) {
            vhsFooterLink.hidden = true;
            vhsFooterLink.onclick = null;
        }
        this._vhsSkipCanvasWrite = true;
        if (this._vhsPreviewResizeObs) {
            try {
                this._vhsPreviewResizeObs.disconnect();
            } catch (e) {
                /* ignore */
            }
            this._vhsPreviewResizeObs = null;
        }
    },

    dismissEffectDialogWithoutRestore() {
        if (this._colorPollInterval) {
            clearInterval(this._colorPollInterval);
            this._colorPollInterval = null;
        }
        if (this._previewRaf != null) {
            cancelAnimationFrame(this._previewRaf);
            this._previewRaf = null;
        }
        this._cancelActiveWorkerPreview();
        this._effectPreviewIsFinal = false;
        window._chromaKeyPickActive = false;
        document.body.style.cursor = '';
        document.body.classList.remove('effect-dialog-open');
        const shell = document.getElementById('effect-dialog');
        if (shell) shell.style.display = 'none';
        this._effectDialogDidClose();
        this._tearDownVhsEffectDialogUI();
        window.applyCurrentEffectModal = function () {
            FilterManager.apply();
        };
        this._frozenSnapshots = null;
        this._clearAnimEffectState();
        this._effectTargets = null;
        this._effectSessionScopeAll = false;
        this.originalImageData = null;
        this.currentEffect = null;
    },

    closeModal() {
        if (this._previewRaf != null) {
            cancelAnimationFrame(this._previewRaf);
            this._previewRaf = null;
        }
        this._cancelActiveWorkerPreview();
        this._effectPreviewIsFinal = false;
        window._chromaKeyPickActive = false;
        document.body.style.cursor = '';
        document.getElementById('effect-dialog').style.display = 'none';
        this._effectDialogDidClose();
        this._tearDownVhsEffectDialogUI();
        window.applyCurrentEffectModal = function () {
            FilterManager.apply();
        };
        this._restoreAllLayersFromFrozen();
        
        if (EditorManager.mode === 'vector' && this._vectorSvgSnapshot != null) {
            EditorManager.activeProject.svgData = this._vectorSvgSnapshot;
            EditorManager.render();
            this._vectorSvgSnapshot = null;
        }

        this._frozenSnapshots = null;
        this._clearAnimEffectState();
        this._effectTargets = null;
        this._effectSessionScopeAll = false;
        this.originalImageData = null;
        this.currentEffect = null;
    },

    /**
     * @param {boolean} [instantChain] si true (menu effet sans modale : esquisse, médiane…), application synchrone — la chaîne appelante gère l’overlay et le finally.
     */
    async _runPreviewSafe() {
        const timeoutMs = this._effectPreviewIsFinal ? 120000 : 45000;
        let timer = null;
        try {
            await Promise.race([
                this._runPreview(),
                new Promise((_, reject) => {
                    timer = setTimeout(
                        () => reject(new Error('FilterManager: délai de rendu dépassé')),
                        timeoutMs
                    );
                })
            ]);
        } catch (err) {
            console.warn(err);
            this._cancelActiveWorkerPreview();
        } finally {
            if (timer) clearTimeout(timer);
        }
    },

    async apply(instantChain) {
        if (this._previewRaf != null) {
            cancelAnimationFrame(this._previewRaf);
            this._previewRaf = null;
        }
        this._abortLivePreviewRuns();
        await this._waitForPreviewIdle();
        const eff = this.currentEffect;
        const label = eff ? illuEffectHistoryLabel(eff) : '';
        const P = window.IlluProgress;
        const hasWork = this._effectTargets && this._effectTargets.length && eff;
        const instant = instantChain === true;

        if (!instant && P && P.instantEffectBusy && typeof P.resetInstantEffect === 'function') {
            P.resetInstantEffect();
        }

        if (eff === 'gallery' && hasWork) {
            const preset = this._galleryPresetId || 'none';
            this._tearDownVhsEffectDialogUI();
            const shell = document.getElementById('effect-dialog');
            if (shell) shell.style.display = 'none';
            this._effectDialogDidClose();
            if (preset !== 'none') {
                const histLabel =
                    (window.IlluI18n && window.IlluI18n.t
                        ? window.IlluI18n.t('photo.filtersGallery')
                        : 'Galerie') + ` : ${preset}`;
                if (this._effectTargets[0] && this._effectTargets[0].isPhotoMode) {
                    /* déjà sur PhotoModeManager via dernier aperçu */
                } else {
                    this._commitEffectHistory(histLabel);
                }
            }
            this._frozenSnapshots = null;
            this._clearAnimEffectState();
            this._effectTargets = null;
            this._effectSessionScopeAll = false;
            this.originalImageData = null;
            this.currentEffect = null;
            this._galleryPresetId = 'none';
            if (typeof EditorManager !== 'undefined' && typeof EditorManager.render === 'function') {
                EditorManager.render({ flushUiThumbnails: true });
            }
            return;
        }

        if (EditorManager.mode === 'vector') {
            const params = this._getCurrentEffectParams();
            EditorManager.applyVectorFilter(eff, params);
            this._tearDownVhsEffectDialogUI();
            const shell = document.getElementById('effect-dialog');
            if (shell) shell.style.display = 'none';
            this._effectDialogDidClose();
            this._effectTargets = null;
            this.currentEffect = null;
            this._vectorSvgSnapshot = null;
            return;
        }

        if (hasWork && instant) {
            const busyToken = this._beginHeavyBusyToken(label);
            const runInstant = async ({ progress }) => {
                const wasLow = this._vhsUseLowResPreview;
                try {
                    if (progress) progress(8);
                    if (eff === 'vhs') {
                        this._vhsUseLowResPreview = false;
                        this._vhsSkipCanvasWrite = false;
                    }
                    this._restoreAllLayersFromFrozen();
                    this._effectPreviewIsFinal = true;
                    this._setupEffectTargets();
                    await this._runPreviewSafe();
                    this._effectPreviewIsFinal = false;
                    this._vhsUseLowResPreview = wasLow;
                    this._tearDownVhsEffectDialogUI();
                    document.getElementById('effect-dialog').style.display = 'none';
                    this._effectDialogDidClose();
                    await new Promise((resolve) => setTimeout(resolve, 30));
                    const isPM = this._effectTargets && this._effectTargets[0] && this._effectTargets[0].isPhotoMode;
                    if (isPM) {
                        window.PhotoModeManager.updateActivePhotoData(this._effectTargets[0].backup);
                    } else {
                        this._commitEffectHistory(`Effet : ${label}`);
                    }
                    this._frozenSnapshots = null;
                    this._clearAnimEffectState();
                    this._effectTargets = null;
                    this._effectSessionScopeAll = false;
                    this.originalImageData = null;
                    this.currentEffect = null;
                    if (progress) progress(100);
                } finally {
                    this._effectPreviewIsFinal = false;
                    this._vhsUseLowResPreview = wasLow;
                }
            };
            try {
                if (P && typeof P.runAsyncEffect === 'function') {
                    await P.runAsyncEffect(label, runInstant, { delayMs: 180 });
                } else {
                    await runInstant({});
                }
            } finally {
                this._endHeavyBusyToken(busyToken);
            }
            return;
        }

        if (hasWork && !instant) {
            const busyToken = this._beginHeavyBusyToken(label);
            const abortController = new AbortController();
            const runApply = async ({ progress }) => {
                if (progress) progress(8);
                this._tearDownVhsEffectDialogUI();
                const shell = document.getElementById('effect-dialog');
                if (shell) shell.style.display = 'none';
                this._effectDialogDidClose();
                await this._waitForDoubleRaf();
                const wasLow = this._vhsUseLowResPreview;
                try {
                    if (eff === 'vhs') {
                        this._vhsUseLowResPreview = false;
                        this._vhsSkipCanvasWrite = false;
                    }
                    this._restoreAllLayersFromFrozen();
                    this._effectPreviewIsFinal = true;
                    this._setupEffectTargets();

                    if (!abortController.signal.aborted) {
                        await this._runPreviewSafe();
                    }
                    
                    this._effectPreviewIsFinal = false;
                    this._vhsUseLowResPreview = wasLow;
                    
                    if (!abortController.signal.aborted) {
                        this._commitEffectHistory(`Effet : ${label}`);
                    }
                } finally {
                    this._effectPreviewIsFinal = false;
                    this._frozenSnapshots = null;
                    this._clearAnimEffectState();
                    this._effectTargets = null;
                    this._effectSessionScopeAll = false;
                    this.originalImageData = null;
                    this.currentEffect = null;
                }
                if (progress) progress(100);
            };
            try {
                if (P && typeof P.runAsyncEffect === 'function') {
                    await P.runAsyncEffect(label, runApply, { 
                        delayMs: 220,
                        onCancel: () => {
                            abortController.abort();
                            this._cancelActiveWorkerPreview();
                        }
                    });
                } else {
                    await runApply({});
                }
            } finally {
                this._endHeavyBusyToken(busyToken);
            }
            return;
        }

        this._tearDownVhsEffectDialogUI();
        document.getElementById('effect-dialog').style.display = 'none';
        this._effectDialogDidClose();
        this._frozenSnapshots = null;
        this._clearAnimEffectState();
        this._effectTargets = null;
        this.originalImageData = null;
        this.currentEffect = null;
    },

    /** Incrustation via masque alpha lié : calque restauré depuis l’aperçu figé, transparence = luminance du masque. */
    applyChromaAsAlphaMask() {
        if (this._previewRaf != null) {
            cancelAnimationFrame(this._previewRaf);
            this._previewRaf = null;
        }
        if (this.currentEffect !== 'chroma' || !this._effectTargets || !this._effectTargets.length) return;
        if (!EditorManager.activeProject || !EditorManager.isPixelMode) return;
        const val = (id) => parseFloat(document.getElementById(id) ? document.getElementById(id).value : '0') || 0;
        const kr = Math.max(0, Math.min(255, val('ef-ch-r')));
        const kg = Math.max(0, Math.min(255, val('ef-ch-g')));
        const kb = Math.max(0, Math.min(255, val('ef-ch-b')));
        
        const useKey2 = !!(document.getElementById('ef-ch-use2') && document.getElementById('ef-ch-use2').checked);
        const params = {
            tolerance: val('ef-ch-tol') !== undefined ? val('ef-ch-tol') : 30,
            lumTol: val('ef-ch-lum'),
            drift: val('ef-ch-drift'),
            shadowProt: val('ef-ch-shadows'),
            feather: val('ef-ch-feather'),
            clipBlack: val('ef-ch-black'),
            clipWhite: val('ef-ch-white') !== undefined ? val('ef-ch-white') : 100,
            gamma: val('ef-ch-gamma') > 0 ? val('ef-ch-gamma') : 1.0,
            spill: val('ef-ch-spill'),
            recover: val('ef-ch-recover'),
            lumaProt: val('ef-ch-luma'),
            useKey2,
            kr2: useKey2 ? Math.max(0, Math.min(255, val('ef-ch-r2'))) : undefined,
            kg2: useKey2 ? Math.max(0, Math.min(255, val('ef-ch-g2'))) : undefined,
            kb2: useKey2 ? Math.max(0, Math.min(255, val('ef-ch-b2'))) : undefined
        };

        const selOnly =
            this._readEffectScope() === 'selection' &&
            typeof window.isPixelInActiveLayerSelection === 'function';

        for (let ti = 0; ti < this._effectTargets.length; ti++) {
            const { layer, backup } = this._effectTargets[ti];
            const bw = backup.width;
            const bh = backup.height;
            let src;
            try {
                src = backup.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, bw, bh).data;
            } catch (e) {
                continue;
            }
            const maskBufPre = EditorManager.ensureAlphaMaskBufferForLayer(layer);
            let oldMask = null;
            if (selOnly && maskBufPre) {
                try {
                    oldMask = maskBufPre.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, bw, bh).data;
                } catch (e) {
                    oldMask = null;
                }
            }
            const maskData = new ImageData(bw, bh);
            const md = maskData.data;
            const lx = layer.x;
            const ly = layer.y;
            
            // On prépare un buffer pour le despill si besoin
            const pixelData = new Uint8ClampedArray(src);

            for (let i = 0; i < src.length; i += 4) {
                if (selOnly && oldMask) {
                    const p = i / 4;
                    const px = p % bw;
                    const py = (p / bw) | 0;
                    if (!window.isPixelInActiveLayerSelection(px, py, lx, ly)) {
                        md[i] = oldMask[i];
                        md[i + 1] = oldMask[i + 1];
                        md[i + 2] = oldMask[i + 2];
                        md[i + 3] = oldMask[i + 3];
                        continue;
                    }
                }
                
                // 1. Calcul du Masque
                const keep = ChromaKeyer.computeMatte(src[i], src[i+1], src[i+2], kr, kg, kb, params);
                const g = Math.round(255 * keep);
                md[i] = md[i + 1] = md[i + 2] = g;
                md[i + 3] = 255;
                
                // 2. Unmix / Despill optionnel sur l'image source (on modifie pixelData)
                let fg = [src[i], src[i+1], src[i+2]];
                if (params.recover > 0) {
                    fg = ChromaKeyer.applyUnmix(fg[0], fg[1], fg[2], kr, kg, kb, keep, params.recover);
                }
                if (params.spill > 0) {
                    fg = ChromaKeyer.applyDespill(fg[0], fg[1], fg[2], kr, kg, kb, params.spill);
                }
                pixelData[i] = fg[0];
                pixelData[i+1] = fg[1];
                pixelData[i+2] = fg[2];
                // Keep the original alpha for the layer buffer
            }
            
            const lbctx = layer.buffer.getContext('2d', { willReadFrequently: true });
            lbctx.clearRect(0, 0, layer.buffer.width, layer.buffer.height);
            // On injecte l'image (éventuellement despilled)
            const tempImg = new ImageData(pixelData, bw, bh);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = bw;
            tempCanvas.height = bh;
            tempCanvas.getContext('2d', { willReadFrequently: true }).putImageData(tempImg, 0, 0);
            lbctx.drawImage(tempCanvas, 0, 0);
            
            const maskBuf = EditorManager.ensureAlphaMaskBufferForLayer(layer);
            if (!maskBuf) continue;
            maskBuf.getContext('2d', { willReadFrequently: true }).putImageData(maskData, 0, 0);
            
            // Push basic history state for mask project explicitly if available
            const maskProj = EditorManager.projects.find(p => p.id === layer.alphaMaskProjectId);
            if (maskProj && EditorManager._captureProjectSnapshot) {
                const snap = EditorManager._captureProjectSnapshot(maskProj, { patchActiveLayer: true });
                if (snap) {
                    maskProj.history.push({ label: 'Appliquer Incrustation', ...snap });
                    maskProj.historyIndex = maskProj.history.length - 1;
                }
            }
        }

        document.getElementById('effect-dialog').style.display = 'none';
        this._effectDialogDidClose();
        window._chromaKeyPickActive = false;
        document.body.style.cursor = '';
        const base = illuEffectTitle('chromaAlphaMask', 'Incrustation (masque alpha)');
        this._commitEffectHistory(base);
        this._frozenSnapshots = null;
        this._clearAnimEffectState();
        this._effectTargets = null;
        this.originalImageData = null;
        this.currentEffect = null;
        EditorManager.render({ flushUiThumbnails: true });
        EditorManager.updateTabUI();
        EditorManager.updateLayerUI();
    },

    preview() {
        if (EditorManager.mode === 'vector' && this.currentEffect) {
            const params = this._getCurrentEffectParams();
            EditorManager.applyVectorFilter(this.currentEffect, params, true);
            return;
        }
        if (!this._effectTargets || !this._effectTargets.length || !this.currentEffect) return;
        if (this.currentEffect === 'gallery') {
            this.previewInstantFilter(this._galleryPresetId || 'none');
            return;
        }
        // Throttle ~5fps (200ms) pour éviter la saturation des Workers
        const now = performance.now();
        if (this._lastPreviewTime && (now - this._lastPreviewTime) < 200) {
            if (this._previewThrottleTid) clearTimeout(this._previewThrottleTid);
            this._previewThrottleTid = setTimeout(() => { this._lastPreviewTime = 0; this.preview(); }, 200 - (now - this._lastPreviewTime));
            return;
        }
        this._lastPreviewTime = now;
        if (this._previewThrottleTid) { clearTimeout(this._previewThrottleTid); this._previewThrottleTid = null; }
        this._previewRunSeq++;
        if (this._previewActive) {
            this._cancelActiveWorkerPreview();
        }
        this._previewQueued = true;
        this._triggerPreviewLoop();
    },

    async _triggerPreviewLoop() {
        if (this._previewActive) return;
        this._previewActive = true;
        while (this._previewQueued) {
            this._previewQueued = false;
            try {
                await this._runPreview();
            } catch (e) {
                console.error('Preview error:', e);
            }
        }
        this._previewActive = false;
    },

    _filterWorkers: null,
    _filterWorkerJobSeq: 0,
    _filterWorkerPending: null,

    _getFilterWorkers() {
        if (!this._filterWorkers && typeof Worker !== 'undefined') {
            // Les navigateurs brident parfois hardwareConcurrency à 1 ou 2 sur les domaines distants 
            // (protection anti-pistage) si les headers COOP/COEP ne sont pas configurés.
            let reportedCores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 0;
            const cores = Math.max(6, reportedCores || 6);
            const poolSize = Math.min(16, cores);
            
            if (reportedCores < 6) {
                console.log(`[ILLU-INIT] Détection CPU limitée (${reportedCores || 'inconnu'} cœurs). Forçage à ${poolSize} workers pour garantir de bonnes performances.`);
            } else {
                console.log(`[ILLU-INIT] Détection CPU réussie : ${reportedCores} cœurs. Utilisation de ${poolSize} workers.`);
            }
            
            this._filterWorkers = [];
            this._filterWorkerPending = new Map();
            for (let i = 0; i < poolSize; i++) {
                try {
                    if (!this._workersInitialized) {
                        console.log('FilterManager: Initializing worker', i, '(js/effects/filter-worker.js)');
                    }
                    const workerHref =
                        typeof window !== 'undefined' && window.location
                            ? new URL('js/effects/filter-worker.js', window.location.href).href
                            : 'js/effects/filter-worker.js';
                    const wk = new Worker(workerHref);
                    wk.onmessage = (e) => {
                        const msg = e.data;
                        if (msg.type === 'progress') {
                            const pending = this._filterWorkerPending.get(msg.jobId);
                            if (pending) {
                                if (typeof pending.resetWatchdog === 'function') {
                                    pending.resetWatchdog();
                                }
                                pending.percent = msg.percent;
                                
                                // Aggregate progress across ALL chunks (completed + remaining)
                                let totalPercent = (this._activeBatchCompletedChunks || 0) * 100;
                                for (const p of this._filterWorkerPending.values()) {
                                    if (p.batchId === pending.batchId) {
                                        totalPercent += (p.percent || 0);
                                    }
                                }
                                const totalChunks = this._activeBatchChunkCount || 1;
                                const aggregatePercent = Math.min(100, Math.round(totalPercent / totalChunks));
                                const P = window.IlluProgress;
                                if (P && P.instantEffectProgress) {
                                    P.instantEffectProgress(aggregatePercent, msg.message);
                                }
                            }
                            return;
                        }

                        const p = this._filterWorkerPending.get(msg.jobId);
                        if (!p) return;
                        this._filterWorkerPending.delete(msg.jobId);
                        if (msg.error) {
                            console.error('FilterManager: Worker job error', msg.error);
                            p.resolve(null);
                        } else {
                            this._activeBatchCompletedChunks = (this._activeBatchCompletedChunks || 0) + 1;
                            
                            // Optional: Final progress push for this chunk completion
                            const totalPercent = (this._activeBatchCompletedChunks * 100);
                            let remainingPercent = 0;
                            for (const remP of this._filterWorkerPending.values()) {
                                if (remP.batchId === p.batchId) remainingPercent += (remP.percent || 0);
                            }
                            const totalChunks = this._activeBatchChunkCount || 1;
                            const aggregatePercent = Math.min(100, Math.round((totalPercent + remainingPercent) / totalChunks));
                            if (window.IlluProgress && window.IlluProgress.instantEffectProgress) {
                                window.IlluProgress.instantEffectProgress(aggregatePercent, 'Traitement...');
                            }

                            p.resolve({
                                imgData: new ImageData(new Uint8ClampedArray(msg.buffer), msg.w, msg.h),
                                workerId: i,
                                startY: p.startY,
                                endY: p.endY
                            });
                        }
                    };
                    wk.onerror = (err) => {
                        console.error('FilterManager: Worker initialization or runtime error', err);
                        this._destroyFilterWorkerPool({ cancelled: true });
                    };
                    this._filterWorkers.push(wk);
                } catch (err) {
                    console.error('FilterManager: Worker creation failed', err);
                    // silent fallback
                }
            }
            this._workersInitialized = true;
        }
        return this._filterWorkers;
    },

    _requestWorkerPreview(params, srcOrig, w, h, effect, ps, onChunkUpdate) {
        return new Promise((resolve) => {
            const wks = this._getFilterWorkers();
            if (!wks || wks.length === 0) return resolve(null);
            const batchId = ++this._filterWorkerBatchSeq;
            this._activeFilterPreviewBatchId = batchId;

            const margin = this._getEffectMargin(effect, params, ps);
            // Special case: dropshadow uses Canvas API, cannot be chunked easily.
            // gaussian is now enabled for multi-worker thanks to margins.
            //
            // VHS : effet à l'échelle de l'image entière (commutation de tête, tracking,
            // bavement chroma d'une ligne à l'autre). Découpé en tuiles, chaque worker
            // recalculait la trame complète pour n'en garder qu'une bande — soit N fois
            // le travail, avec des ruptures aux jointures. Un seul chunk, donc.
            const chunkCount =
                effect === 'dropshadow' || effect === 'motionblur' || effect === 'surfaceblur' || effect === 'vhs'
                    ? 1
                    : wks.length;
            const stepY = Math.ceil(h / chunkCount);
            
            this._activeBatchChunkCount = chunkCount;
            this._activeBatchCompletedChunks = 0;

            let completed = 0;
            const results = [];
            const srcBuffer = new Uint8ClampedArray(srcOrig).buffer;
            let settled = false;
            let watchdog = null;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                if (watchdog) clearTimeout(watchdog);
                resolve(value);
            };

            const timeoutMs = Math.max(15000, Math.min(90000, Math.round((w * h) / 12000)));
            const resetWatchdog = () => {
                if (settled) return;
                if (watchdog) clearTimeout(watchdog);
                watchdog = setTimeout(() => {
                    if (settled) return;
                    console.warn('FilterManager: worker preview timeout, annulation du lot');
                    this._destroyFilterWorkerPool({ cancelled: true });
                    finish(null);
                }, timeoutMs);
            };
            resetWatchdog();

            const passes = (effect === 'gaussian') ? 3 : 1;
            for (let i = 0; i < chunkCount; i++) {
                const jobId = ++this._filterWorkerJobSeq;
                const startY = i * stepY;
                const endY = Math.min(h, (i + 1) * stepY);

                this._filterWorkerPending.set(jobId, {
                    batchId,
                    startY,
                    endY,
                    resetWatchdog,
                    resolve: (res) => {
                        if (settled) return;
                        if (!res || res.cancelled || batchId !== this._activeFilterPreviewBatchId) {
                            finish({ cancelled: true });
                            return;
                        }

                        // Progressive update support
                        if (onChunkUpdate && typeof onChunkUpdate === 'function') {
                            onChunkUpdate(res.imgData, res.startY, res.endY, (completed + 1) / chunkCount);
                        }

                        results.push(res);
                        completed++;
                        if (completed === chunkCount) {
                            if (results.some((r) => r === null)) return finish(null);

                            // Reassemble
                            const finalData = new ImageData(w, h);
                            for (const chunk of results) {
                                const rowWidthBytes = w * 4;
                                const startByte = chunk.startY * rowWidthBytes;
                                const endByte = chunk.endY * rowWidthBytes;
                                finalData.data.set(
                                    chunk.imgData.data.subarray(startByte, endByte),
                                    startByte
                                );
                            }
                            finish(finalData);
                        }
                    }
                });

                const payload = {
                    type: 'preview',
                    jobId,
                    params,
                    w, h, effect, ps,
                    rad: parseInt(document.getElementById('ef-rad')?.value || 0, 10) || 0,
                    passes: passes,
                    margin: margin,
                    startY, endY,
                    vhsUseLowRes: this._vhsUseLowResPreview,
                    wasmEnabled: localStorage.getItem('settings-wasm-enabled') !== '0',
                    webglEnabled: localStorage.getItem('illu_webgl_filters') !== 'false',
                    srcOrig: srcBuffer // NO TRANSFER, clone implicitly!
                };
                try {
                    wks[i].postMessage(payload);
                } catch (err) {
                    console.warn('FilterManager: postMessage worker échoué', err);
                    this._destroyFilterWorkerPool({ cancelled: true });
                    finish(null);
                    return;
                }
            }
        });
    },

    async _runPreview() {
        if (!this._effectTargets || !this._effectTargets.length || !this.currentEffect) return;
        const runSeq = this._effectPreviewIsFinal ? -1 : this._previewRunSeq;
        this._effectPreviewPxScale = 1;
        if (!this._workCanvas) {
            this._workCanvas = document.createElement('canvas');
            this._workCtx = this._workCanvas.getContext('2d', { willReadFrequently: true });
        }
        this.canvas = this._workCanvas;
        this.ctx = this._workCtx;
        const val = (id) => parseInt(document.getElementById(id) ? document.getElementById(id).value : 0, 10) || 0;
        
        // Grab all params dynamically for worker via DOM iteration
        let vals = {};
        document.querySelectorAll('input[id^="ef-"], select[id^="ef-"]').forEach((el) => {
            if (!el.id) return;
            if (el.type === 'checkbox') vals[el.id] = el.checked ? '1' : '0';
            else if (el.value !== undefined) vals[el.id] = el.value;
        });

        // Special bundling for effects with complex parameter builders
        if (this.currentEffect === 'vhs' && typeof window.illuBuildVhsParams === 'function') {
            vals = window.illuBuildVhsParams();
            // Ensure preview_max is also in there
            const pm = document.getElementById('ef-vhs-preview_max');
            if (pm) vals.preview_max = parseInt(pm.value, 10);
        }
        if (this.currentEffect === 'cabossage') {
            vals._cabossageSeed = this._cabossageSeed >>> 0;
        }
        
        // Inject global colors for effects that use the palette instead of inputs
        if (this.currentEffect === 'contour' || this.currentEffect === 'duotone' || this.currentEffect === 'vignette' || this.currentEffect === 'clouds') {
            const rgbToHex = (c) => "#" + (1 << 24 | c.r << 16 | c.g << 8 | c.b).toString(16).slice(1);
            if (this.currentEffect === 'contour') {
                vals['ef-contour-color'] = rgbToHex(window.EditorManager.primaryColor);
            } else if (this.currentEffect === 'duotone') {
                vals['ef-duo-c1'] = rgbToHex(window.EditorManager.primaryColor);
                vals['ef-duo-c2'] = rgbToHex(window.EditorManager.secondaryColor);
            } else if (this.currentEffect === 'vignette') {
                vals['ef-vig-color'] = rgbToHex(window.EditorManager.primaryColor);
            } else if (this.currentEffect === 'clouds') {
                vals['ef-clouds-from'] = rgbToHex(window.EditorManager.primaryColor);
                vals['ef-clouds-to'] = rgbToHex(window.EditorManager.secondaryColor);
            }
        }

        const nTargets = this._effectTargets.length;
        const vhsPreviewOnly = this.currentEffect === 'vhs' && this._vhsSkipCanvasWrite;
        const loopMax = vhsPreviewOnly ? 1 : nTargets;
        const P = window.IlluProgress;
        const busy = P && P.instantEffectBusy;
        const modalPreviewLowRes =
            !this._effectPreviewIsFinal &&
            !vhsPreviewOnly &&
            document.body.classList.contains('effect-dialog-open');

        for (let ti = 0; ti < loopMax; ti++) {
            const { layer, backup } = this._effectTargets[ti];
            const fw = backup.width;
            const fh = backup.height;
            let pw = fw;
            let ph = fh;
            /*
             * VHS : l'aperçu vit dans sa propre colonne, jamais dans le calque. Il a donc
             * sa propre limite de résolution, réglable par le curseur « Max. aperçu (px) ».
             * Sans cela l'effet tournait à la taille du document à chaque mouvement de
             * curseur — plusieurs secondes sur une photo, et un aperçu qui ne suivait plus.
             */
            const vhsMaxEdge = vhsPreviewOnly && !this._effectPreviewIsFinal
                ? Math.max(120, this._fxNum('ef-vhs-preview_max', 480))
                : 0;
            const maxEdge = modalPreviewLowRes ? EFFECT_PREVIEW_MAX_EDGE : vhsMaxEdge;
            const useLowResModal = maxEdge > 0 && Math.max(fw, fh) > 0;
            if (useLowResModal) {
                const big = Math.max(fw, fh);
                const s = Math.min(1, maxEdge / big);
                pw = Math.max(1, Math.round(fw * s));
                ph = Math.max(1, Math.round(fh * s));
            }
            /* Paramètres UI en « pixels pleine résolution » : à l’aperçu réduit, on scale pour garder le même rendu relatif qu’après OK. */
            this._effectPreviewPxScale = useLowResModal ? pw / Math.max(1, fw) : 1;

            this._workCanvas.width = pw;
            this._workCanvas.height = ph;
            const wctx = this._workCanvas.getContext('2d', { willReadFrequently: true });
            
            // Fix: check if backup is ImageData (occurs in Photo Mode Pro redirection)
            if (backup instanceof ImageData) {
                if (useLowResModal) {
                    // Need to scale. Safest is to put in temp canvas then draw scaled
                    const temp = document.createElement('canvas');
                    temp.width = fw; temp.height = fh;
                    temp.getContext('2d').putImageData(backup, 0, 0);
                    wctx.imageSmoothingEnabled = true;
                    wctx.drawImage(temp, 0, 0, fw, fh, 0, 0, pw, ph);
                } else {
                    wctx.putImageData(backup, 0, 0);
                }
            } else {
                if (useLowResModal) {
                    wctx.imageSmoothingEnabled = true;
                    wctx.imageSmoothingQuality = 'high';
                    wctx.drawImage(backup, 0, 0, fw, fh, 0, 0, pw, ph);
                } else {
                    wctx.drawImage(backup, 0, 0);
                }
            }
            this.originalImageData = wctx.getImageData(0, 0, pw, ph);
            
            if (window._chromaKeyPickActive) {
                this._refreshLayerBufferFromWorkCanvas(layer, backup, fw, fh, pw, ph, useLowResModal);
                continue;
            }

            // --- Engine Priority: Wasm > WebGL > CPU ---
            const isFinal = !!this._effectPreviewIsFinal;
            const logPrefix = isFinal ? '[FINAL RENDER]' : '[PREVIEW]';
            this._usedEngine = 'CPU'; 
            
            this._startY = 0;
            this._endY = (this.originalImageData ? this.originalImageData.height : 0);

            const useWasm = localStorage.getItem('settings-wasm-enabled') !== '0';

            const useWebGL = localStorage.getItem('illu_webgl_filters') !== 'false';
            const webglPreview = localStorage.getItem('illu_webgl_preview') === 'true';
            
            // Check if current effect has a Wasm implementation
            // (halftone est exclu : Wasm et WebGL ne connaissent ni les variantes CMJN,
            //  ni l'angle de trame, ni les points pleins — voir halftone-core.js)
            const wasmSupported = typeof MasterPaintWasm !== 'undefined' &&
                                MasterPaintWasm.isEffectSupported &&
                                MasterPaintWasm.isEffectSupported(this.currentEffect) &&
                                this.currentEffect !== 'halftone';
            
            // If Wasm is active AND supported, we skip GPU to ensure Wasm priority
            const skipGPU = useWasm && wasmSupported && MasterPaintWasm.isLoaded;

            if (skipGPU) {
                // Pre-log once to avoid flooding
                if (!this._lastLogEffect || this._lastLogEffect !== this.currentEffect) {
                    console.log(`${logPrefix} [Wasm Engine] Running '${this.currentEffect}'...`);
                    this._lastLogEffect = this.currentEffect;
                }
                this._usedEngine = 'Wasm';
            } else if (!useWasm && useWebGL) {
                 if (!this._lastLogEffect || this._lastLogEffect !== this.currentEffect) {
                    console.log(`${logPrefix} [GPU Filter] Running '${this.currentEffect}' via WebGL...`);
                    this._lastLogEffect = this.currentEffect;
                }
                this._usedEngine = 'WebGL';
            }

            let gpuApplied = false;
            
            // Only use GPU for final render OR if explicitly enabled for preview, AND if not preempted by Wasm
            if (!skipGPU && useWebGL && (this._effectPreviewIsFinal || webglPreview) && window.WebGLFilterEngine && window.WebGLFilterEngine.init()) {
                let shader = null;
                let uniforms = {};
                switch (this.currentEffect) {
                    case 'grayscale': shader = 'grayscale'; break;
                    case 'invert': shader = 'invert'; break;
                    case 'sepia': shader = 'sepia'; break;
                    case 'brightness': {
                        // Température/teinte non gérées par le shader → repli worker JS
                        if (parseFloat(vals['ef-bc-temp'] || 0) !== 0 || parseFloat(vals['ef-bc-tint'] || 0) !== 0) {
                            shader = null;
                            break;
                        }
                        shader = 'brightness_contrast';
                        uniforms.u_brightness = (vals['ef-b'] || 0) / 255;
                        uniforms.u_contrast = (vals['ef-c'] || 0) / 255;
                        break;
                    }
                    case 'exposure': {
                        shader = 'exposure';
                        uniforms.u_exposure = (vals['ef-exp'] || 100) / 100;
                        uniforms.u_gamma = (vals['ef-gamma'] || 100) / 100;
                        break;
                    }
                    case 'hsv': {
                        shader = 'hsv';
                        const hp = this._hsvMixParams;
                        const hasMix = hp && ((hp.hslHue && hp.hslHue.some(v=>v!==0)) || (hp.hslSat && hp.hslSat.some(v=>v!==0)) || (hp.hslLum && hp.hslLum.some(v=>v!==0)));
                        if (hasMix) {
                            shader = null;
                        } else {
                            uniforms.u_hue = vals['ef-h'] || 0;
                            uniforms.u_sat = vals['ef-s'] || 0;
                            uniforms.u_val = vals['ef-l'] || 0;
                        }
                        break;
                    }
                    case 'wave': {
                        shader = 'wave';
                        uniforms.u_amp = (vals['ef-wave-a'] || 0) / pw;
                        uniforms.u_freq = (pw / (vals['ef-wave-f'] || 100)) * 6.28;
                        break;
                    }
                    case 'bulge': {
                        shader = 'bulge_pinch';
                        uniforms.u_k = (vals['ef-bulge'] / 100) * 1.5;
                        break;
                    }
                    case 'pinch': {
                        shader = 'bulge_pinch';
                        uniforms.u_k = -(vals['ef-pinch'] / 100) * 1.5;
                        break;
                    }
                    case 'twist': {
                        shader = 'twist';
                        uniforms.u_rad = (vals['ef-twist'] || 0) * (Math.PI / 180);
                        break;
                    }
                    case 'pixelate': {
                        shader = 'pixelate';
                        uniforms.u_res = [pw, ph];
                        uniforms.u_size = (vals['ef-size'] || 10) * this._effectPreviewPxScale;
                        break;
                    }
                    case 'vignette': {
                        shader = 'vignette';
                        uniforms.u_intensity = (vals['ef-vig'] || 50) / 100;
                        const vc = this._parseHexColor(vals['ef-vig-color'] || '#000000');
                        uniforms.u_color = [vc.r / 255, vc.g / 255, vc.b / 255];
                        uniforms.u_blend = parseInt(vals['ef-vig-blend'] || 0, 10);
                        break;
                    }
                    case 'temperature': {
                        shader = 'temperature';
                        uniforms.u_temp = (vals['ef-temp'] || 0) / 100;
                        break;
                    }
                    case 'posterize': {
                        shader = 'posterize';
                        uniforms.u_levels = Math.max(2, vals['ef-lvl'] || 4);
                        break;
                    }
                    case 'solarize': {
                        shader = 'solarize';
                        uniforms.u_threshold = (vals['ef-sol'] || 128) / 255;
                        break;
                    }
                    case 'colorbal': {
                        shader = 'colorbal';
                        const cb = this._cbParams;
                        const hasP = v => v && v.length >= 2;
                        const hasCurve = cb && (hasP(cb.curveMaster) || hasP(cb.curveR) || hasP(cb.curveG) || hasP(cb.curveB));
                        if(hasCurve) {
                            shader = null;
                        } else {
                            uniforms.u_offset = [(vals['ef-cb-r'] || 0) / 255, (vals['ef-cb-g'] || 0) / 255, (vals['ef-cb-b'] || 0) / 255];
                        }
                        break;
                    }
                    case 'chromatic': {
                        shader = 'chromatic';
                        uniforms.u_offset = (vals['ef-chr'] || 6) * this._effectPreviewPxScale;
                        uniforms.u_res = [pw, ph];
                        break;
                    }
                    case 'mirrorquad': {
                        shader = 'mirrorquad';
                        break;
                    }
                    case 'duotone': {
                        shader = 'duotone';
                        const c1 = this._parseHexColor(vals['ef-duo-c1'] || '#1a0533');
                        const c2 = this._parseHexColor(vals['ef-duo-c2'] || '#fff5e0');
                        uniforms.u_c1 = [c1.r / 255, c1.g / 255, c1.b / 255];
                        uniforms.u_c2 = [c2.r / 255, c2.g / 255, c2.b / 255];
                        uniforms.u_pivot = (vals['ef-duo-mid'] || 128) / 255;
                        break;
                    }
                    case 'filmgrain': 
                    case 'argenticgrain': {
                        shader = 'filmgrain';
                        uniforms.u_intensity = (vals['ef-grain'] || 40) / 100;
                        uniforms.u_time = Math.random();
                        break;
                    }
                }

                if (shader) {
                    const startGpu = performance.now();
                    const gpuRes = window.WebGLFilterEngine.applyFilter(this.originalImageData, shader, uniforms);
                    if (gpuRes) {
                        this.ctx.putImageData(gpuRes, 0, 0);
                        gpuApplied = true;
                    }
                }
            }

            if (gpuApplied) {
                // Skips worker/cpu fallback
            } else if (this._effectPreferMainThreadPreview(this.currentEffect)) {
                this._previewOneTarget(val, pw, ph);
            } else if (typeof Worker !== 'undefined') {
                if (!gpuApplied && (!useWasm || !wasmSupported)) {
                     if (!this._lastLogEffect || this._lastLogEffect !== this.currentEffect + '_cpu') {
                        console.log(`${logPrefix} [CPU Engine] Running '${this.currentEffect}' via Workers...`);
                        this._lastLogEffect = this.currentEffect + '_cpu';
                    }
                }
                const resultImgData = await this._requestWorkerPreview(
                    { ...vals, hsvMixParams: this._hsvMixParams, cbParams: this._cbParams }, 
                    this.originalImageData.data, 
                    pw, ph, 
                    this.currentEffect, 
                    this._effectPreviewPxScale,
                    (chunkData, chunkStartY, chunkEndY, chunkPct) => {
                        // PARTIAL UPDATE
                        this.ctx.putImageData(chunkData, 0, 0, 0, chunkStartY, pw, chunkEndY - chunkStartY);
                        
                        // Progressive display ON SCREEN only for final render
                        if (this._effectPreviewIsFinal) {
                            this._refreshLayerBufferFromWorkCanvas(layer, backup, fw, fh, pw, ph, useLowResModal);
                            EditorManager.render({ skipUiThumbnails: true });
                        }

                        if (busy && typeof P.instantEffectProgress === 'function') {
                            const prog = nTargets === 1 
                                ? Math.round(8 + chunkPct * 85)
                                : Math.round(8 + (ti / nTargets) * 85 + (chunkPct / nTargets) * 85);
                            P.instantEffectProgress(prog);
                        }
                    }
                );
                if (resultImgData && resultImgData.cancelled) {
                    this._effectPreviewPxScale = 1;
                    return;
                }
                if (resultImgData) {
                    this.ctx.putImageData(resultImgData, 0, 0);
                } else {
                    this._previewOneTarget(val, pw, ph); // Fallback worker indisponible
                }
            } else {
                this._previewOneTarget(val, pw, ph); // Synchronous fallback
            }

            // Aberration chromatique optionnelle : post-traitement appliqué au rendu,
            // indépendamment du moteur (Wasm/WebGL/worker/CPU).
            this._maybeApplyChromaticAberration(pw, ph);

            const pm = EditorManager.activeProject && EditorManager.activeProject.mode;
            if (
                pm &&
                pm !== 'pixel' &&
                EditorManager.constrainImageDataToProjectMode
            ) {
                const idata = this.ctx.getImageData(0, 0, pw, ph);
                EditorManager.constrainImageDataToProjectMode(idata, pm);
                this.ctx.putImageData(idata, 0, 0);
            }

            if (busy && typeof P.instantEffectProgress === 'function') {
                if (nTargets === 1) {
                    P.instantEffectProgress(93);
                } else {
                    P.instantEffectProgress(Math.round(8 + ((ti + 1) / nTargets) * 85));
                }
            }
            if (this._isPreviewRunStale(runSeq)) {
                this._effectPreviewPxScale = 1;
                return;
            }
            const selOnly =
                this._readEffectScope() === 'selection' &&
                typeof window.isPixelInActiveLayerSelection === 'function';

            if (vhsPreviewOnly) {
                if (selOnly) {
                    let edited;
                    try {
                        edited = this._workCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, pw, ph);
                    } catch (e) {
                        edited = null;
                    }
                    let orig;
                    try {
                        orig = backup.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, fw, fh);
                    } catch (e) {
                        orig = null;
                    }
                    if (
                        edited &&
                        orig &&
                        edited.data &&
                        orig.data &&
                        edited.data.length === orig.data.length &&
                        pw === fw &&
                        ph === fh
                    ) {
                        const ed = edited.data;
                        const od = orig.data;
                        const lx = layer.x;
                        const ly = layer.y;
                        for (let py = 0; py < fh; py++) {
                            for (let px = 0; px < fw; px++) {
                                const i = (py * fw + px) * 4;
                                if (!window.isPixelInActiveLayerSelection(px, py, lx, ly)) {
                                    ed[i] = od[i];
                                    ed[i + 1] = od[i + 1];
                                    ed[i + 2] = od[i + 2];
                                    ed[i + 3] = od[i + 3];
                                }
                            }
                        }
                        this.ctx.putImageData(edited, 0, 0);
                    }
                }
                continue;
            }

            this._refreshLayerBufferFromWorkCanvas(layer, backup, fw, fh, pw, ph, useLowResModal);
            if (this._effectPreviewIsFinal && layer && layer.id && EditorManager._pixelLayerViewEls) {
                const v = EditorManager._pixelLayerViewEls.get(layer.id);
                if (v) {
                    if (v.parentNode) v.remove();
                    EditorManager._pixelLayerViewEls.delete(layer.id);
                }
            }
        }

        if (this._isPreviewRunStale(runSeq)) {
            this._effectPreviewPxScale = 1;
            return;
        }

        if (!vhsPreviewOnly) {
            EditorManager.render({
                flushUiThumbnails: !!this._effectPreviewIsFinal,
                uiThumbnailsAllLayers: !!this._effectPreviewIsFinal
            });
        }
        this._effectPreviewPxScale = 1;

        if (this.currentEffect === 'vhs') {
            requestAnimationFrame(() => this._updateVhsDialogPreviewCanvas());
        }
        if (this.currentEffect === 'ral') {
            this._updateRalHistogram();
        }

        if (this._effectPreviewIsFinal) {
            console.log(`[COMMIT] Effect '${this.currentEffect}' applied successfully using ${this._usedEngine || 'CPU'} engine.`);
            this._lastLogEffect = null;
        }
    },

    _updateRalHistogram() {
        const statsContainer = document.getElementById('ral-stats-container');
        const statsList = document.getElementById('ral-stats-list');
        if (!statsContainer || !statsList) return;

        if (!this._ralLookupMap && typeof RAL_COLORS !== 'undefined') {
            this._ralLookupMap = {};
            for (const color of RAL_COLORS) {
                const rgbKey = `${color.r},${color.g},${color.b}`;
                this._ralLookupMap[rgbKey] = color;
            }
        }
        if (!this._ralLookupMap) return;

        const ctx = this._workCanvas.getContext('2d');
        const w = this._workCanvas.width;
        const h = this._workCanvas.height;
        let imgData;
        try {
            imgData = ctx.getImageData(0, 0, w, h);
        } catch (e) {
            return;
        }

        const counts = {};
        const data = imgData.data;
        const step = 4;
        let totalCounted = 0;
        for (let i = 0; i < data.length; i += 4 * step) {
            const a = data[i + 3];
            if (a < 128) continue;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const key = `${r},${g},${b}`;
            counts[key] = (counts[key] || 0) + 1;
            totalCounted++;
        }

        if (totalCounted === 0) {
            statsContainer.style.display = 'none';
            return;
        }

        const sorted = Object.entries(counts)
            .map(([key, count]) => {
                const colorInfo = this._ralLookupMap[key];
                return {
                    key,
                    count,
                    info: colorInfo
                };
            })
            .filter(item => item.info)
            .sort((a, b) => b.count - a.count);

        if (sorted.length === 0) {
            statsContainer.style.display = 'none';
            return;
        }

        statsContainer.style.display = 'block';
        statsList.innerHTML = '';

        const top5 = sorted.slice(0, 5);
        const isFrench = window.IlluI18n && typeof window.IlluI18n.getLang === 'function' && window.IlluI18n.getLang() === 'fr';

        for (const item of top5) {
            const pct = Math.round((item.count / totalCounted) * 100);
            const color = item.info;
            const name = isFrench ? color.fr : color.en;

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.marginBottom = '4px';

            row.innerHTML = `
                <div style="width:20px;height:12px;border:1px solid #999;background-color:${color.hex};border-radius:2px;flex-shrink:0;"></div>
                <div style="flex-grow:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    <strong>${color.code}</strong> — ${name}
                </div>
                <div style="font-weight:bold;color:#555;width:32px;text-align:right;">${pct}%</div>
            `;
            statsList.appendChild(row);
        }
    },

    /** Calcule la marge de pixels voisins nécessaires pour éviter les cisaillements entre workers. */
    _getEffectMargin(effect, params, ps) {
        let m = 0;
        const scale = ps || 1;
        const val = (id) => {
            const el = document.getElementById(id);
            return parseInt(el ? el.value : (params && params[id]) || 0, 10) || 0;
        };
        switch (effect) {
            case 'edges':
            case 'emboss':
            case 'cabossage': {
                const ten = val('ef-cab-tension') || 10;
                const cq = val('ef-cab-q') || 2;
                const passes = Math.round(ten / 4) + Math.max(0, cq - 1);
                m = Math.ceil(passes * scale) + 4;
                break;
            }
            case 'gaussian':
            case 'blur':
            case 'softglow':
            case 'sharpen':
                const rad = val('ef-rad') || val('ef-glow-r') || val('ef-sharp-r') || 2;
                const p = effect === 'gaussian' ? 3 : 1;
                m = Math.ceil(rad * p * scale) + 1;
                break;
            case 'unsharp':
                /* Le masque flou lit un voisinage de `rayon` px : sans marge, chaque
                   tuile du worker afficherait une couture le long de son bord. */
                m = Math.ceil((val('ef-us-radius') || 3) * scale) + 1; break;
            case 'median':
                m = Math.ceil((val('ef-med-rad') || 2) * scale) + 1; break;
            case 'oil':
                m = Math.ceil((val('ef-oil') || 4) * scale) + 1; break;
            case 'crystallize':
                m = Math.ceil((val('ef-cry') || 12) * scale) + 1; break;
            case 'chromatic':
                m = Math.ceil((val('ef-chr') || 6) * scale) + 1; break;
            case 'halftone':
                m = Math.ceil((val('ef-half-rad') || 4) * 2 * scale) + 1; break;
            case 'radialblur':
            case 'zoomblur':
                m = Math.ceil((val('ef-rblur') || val('ef-zblur') || 12) * scale) + 4;
                break;
            case 'motionblur':
                m = Math.ceil((val('ef-mblur-dist') || 10) * scale) + 2;
                break;
            case 'surfaceblur':
                m = Math.ceil((val('ef-sblur-r') || 6) * scale) + 2;
                break;
        }
        return Math.min(128, m);
    },

    _refreshLayerBufferFromWorkCanvas(layer, backup, fw, fh, pw, ph, useLowResModal) {
        const selOnly =
            this._readEffectScope() === 'selection' &&
            typeof window.isPixelInActiveLayerSelection === 'function';

        let resultCanvas = this._workCanvas;
        if (useLowResModal) {
            if (!this._previewUpscaleCanvas) {
                this._previewUpscaleCanvas = document.createElement('canvas');
            }
            const uc = this._previewUpscaleCanvas;
            uc.width = fw;
            uc.height = fh;
            const uctx = uc.getContext('2d', { willReadFrequently: true });
            uctx.imageSmoothingEnabled = true;
            uctx.imageSmoothingQuality = 'high';
            uctx.clearRect(0, 0, fw, fh);
            uctx.drawImage(this._workCanvas, 0, 0, pw, ph, 0, 0, fw, fh);
            resultCanvas = uc;
        }

        // Photo Mode Pro: Handle write back to ImageData
        if (backup instanceof ImageData) {
            const resultData = resultCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, fw, fh);
            if (resultData && resultData.data && resultData.data.length === backup.data.length) {
                if (selOnly) {
                    // Manual merge with selection mask
                    for (let i = 0; i < resultData.data.length; i += 4) {
                        const mask = window.isPixelInActiveLayerSelection(i / 4);
                        if (mask > 0) {
                            const alpha = mask / 255;
                            backup.data[i] = Math.round(resultData.data[i] * alpha + backup.data[i] * (1 - alpha));
                            backup.data[i + 1] = Math.round(resultData.data[i + 1] * alpha + backup.data[i + 1] * (1 - alpha));
                            backup.data[i + 2] = Math.round(resultData.data[i + 2] * alpha + backup.data[i + 2] * (1 - alpha));
                            backup.data[i + 3] = Math.round(resultData.data[i + 3] * alpha + backup.data[i + 3] * (1 - alpha));
                        }
                    }
                } else {
                    backup.data.set(resultData.data);
                }
            }
            return;
        }

        if (!layer || !layer.buffer) return;
        const bctx = layer.buffer.getContext('2d', { willReadFrequently: true });
        if (selOnly) {
            let edited;
            try {
                edited = resultCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, fw, fh);
            } catch (e) {
                edited = null;
            }
            let orig;
            try {
                orig = backup.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, fw, fh);
            } catch (e) {
                orig = null;
            }
            if (edited && orig && edited.data && orig.data && edited.data.length === orig.data.length) {
                const ed = edited.data;
                const od = orig.data;
                const lx = layer.x;
                const ly = layer.y;
                for (let py = 0; py < fh; py++) {
                    for (let px = 0; px < fw; px++) {
                        const i = (py * fw + px) * 4;
                        if (!window.isPixelInActiveLayerSelection(px, py, lx, ly)) {
                            ed[i] = od[i];
                            ed[i + 1] = od[i + 1];
                            ed[i + 2] = od[i + 2];
                            ed[i + 3] = od[i + 3];
                        }
                    }
                }
                bctx.putImageData(edited, 0, 0);
            } else {
                bctx.clearRect(0, 0, layer.buffer.width, layer.buffer.height);
                bctx.drawImage(resultCanvas, 0, 0);
            }
        } else {
            bctx.clearRect(0, 0, layer.buffer.width, layer.buffer.height);
            bctx.drawImage(resultCanvas, 0, 0);
        }
    },

    /** Aperçu dans la colonne de la fenêtre VHS (résultat sur le canvas de travail, pas le buffer calque en mode prévisualisation). */
    _updateVhsDialogPreviewCanvas() {
        if (this.currentEffect !== 'vhs' || !this._effectTargets || !this._effectTargets.length) return;
        const wc = this._workCanvas;
        if (!wc || wc.width < 1 || wc.height < 1) return;
        const cv = document.getElementById('illu-vhs-preview-canvas');
        if (!cv) return;
        const col = cv.closest('.illu-vhs-preview-col');
        const bw = wc.width;
        const bh = wc.height;
        const dpr = Math.min(2, typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1);
        let boxW = 260;
        let boxH = 240;
        if (col) {
            const r = col.getBoundingClientRect();
            if (r.width > 24 && r.height > 24) {
                boxW = Math.max(40, Math.floor(r.width - 16));
                boxH = Math.max(40, Math.floor(r.height - 16));
            }
        }
        const scale = Math.min(boxW / bw, boxH / bh);
        const outW = Math.max(1, Math.round(bw * scale * dpr));
        const outH = Math.max(1, Math.round(bh * scale * dpr));
        if (cv.width !== outW || cv.height !== outH) {
            cv.width = outW;
            cv.height = outH;
        }
        const c2d = cv.getContext('2d', { willReadFrequently: true });
        if (!c2d) return;
        c2d.setTransform(1, 0, 0, 1, 0, 0);
        c2d.clearRect(0, 0, outW, outH);
        c2d.imageSmoothingEnabled = scale < 1;
        c2d.imageSmoothingQuality = 'high';
        c2d.drawImage(wc, 0, 0, bw, bh, 0, 0, outW, outH);
        cv.style.width = `${Math.round(outW / dpr)}px`;
        cv.style.height = `${Math.round(outH / dpr)}px`;
    },

    _previewOneTarget(val, w, h) {
        // --- WebGL Acceleration Integration ---
        const useWebGL = localStorage.getItem('illu_webgl_filters') !== 'false';
        const webglPreview = localStorage.getItem('illu_webgl_preview') === 'true';
        
        if (useWebGL && (this._effectPreviewIsFinal || webglPreview) && window.WebGLFilterEngine && window.WebGLFilterEngine.init()) {
            let shader = null;
            let uniforms = {};

            switch (this.currentEffect) {
                case 'grayscale': shader = 'grayscale'; break;
                case 'invert': shader = 'invert'; break;
                case 'sepia': shader = 'sepia'; break;
                case 'brightness': {
                    shader = 'brightness_contrast';
                    uniforms.u_brightness = (val('ef-b') || 0) / 255;
                    uniforms.u_contrast = (val('ef-c') || 0) / 255;
                    break;
                }
                case 'exposure': {
                    shader = 'exposure';
                    uniforms.u_exposure = (val('ef-exp') || 100) / 100;
                    uniforms.u_gamma = (val('ef-gamma') || 100) / 100;
                    break;
                }
                case 'hsv': {
                    shader = 'hsv';
                    uniforms.u_hue = val('ef-h') || 0;
                    uniforms.u_sat = val('ef-s') || 0;
                    uniforms.u_val = val('ef-l') || 0;
                    break;
                }
                case 'wave': {
                    shader = 'wave';
                    uniforms.u_amp = (val('ef-wave-a') || 0) / w;
                    uniforms.u_freq = (w / (val('ef-wave-f') || 100)) * 6.28;
                    break;
                }
                case 'bulge': {
                    shader = 'bulge_pinch';
                    uniforms.u_k = (val('ef-bulge') / 100) * 1.5;
                    break;
                }
                case 'pinch': {
                    shader = 'bulge_pinch';
                    uniforms.u_k = -(val('ef-pinch') / 100) * 1.5;
                    break;
                }
                case 'twist': {
                    shader = 'twist';
                    uniforms.u_rad = (val('ef-twist') || 0) * (Math.PI / 180);
                    break;
                }
                case 'pixelate': {
                    shader = 'pixelate';
                    uniforms.u_res = [this.originalImageData.width, this.originalImageData.height];
                    uniforms.u_size = (val('ef-size') || 10) * this._effectPreviewPxScale;
                    break;
                }
                case 'vignette': {
                    shader = 'vignette';
                    uniforms.u_intensity = (val('ef-vig') || 50) / 100;
                    const vc = this._parseHexColor(val('ef-vig-color') || '#000000');
                    uniforms.u_color = [vc.r / 255, vc.g / 255, vc.b / 255];
                    uniforms.u_blend = parseInt(val('ef-vig-blend') || 0, 10);
                    break;
                }
                case 'temperature': {
                    shader = 'temperature';
                    uniforms.u_temp = (val('ef-temp') || 0) / 100;
                    break;
                }
                case 'posterize': {
                    shader = 'posterize';
                    uniforms.u_levels = Math.max(2, val('ef-lvl') || 4);
                    break;
                }
                case 'solarize': {
                    shader = 'solarize';
                    uniforms.u_threshold = (val('ef-sol') || 128) / 255;
                    break;
                }
                case 'colorbal': {
                    shader = 'colorbal';
                    uniforms.u_offset = [
                        (val('ef-cb-r') || 0) / 255,
                        (val('ef-cb-g') || 0) / 255,
                        (val('ef-cb-b') || 0) / 255
                    ];
                    break;
                }
                case 'chromatic': {
                    shader = 'chromatic';
                    uniforms.u_offset = (val('ef-chr') || 6) * this._effectPreviewPxScale;
                    uniforms.u_res = [this.originalImageData.width, this.originalImageData.height];
                    break;
                }
                case 'mirrorquad': {
                    shader = 'mirrorquad';
                    break;
                }
                case 'duotone': {
                    shader = 'duotone';
                    const c1 = this._parseHexColor(document.getElementById('ef-duo-c1')?.value || '#1a0533');
                    const c2 = this._parseHexColor(document.getElementById('ef-duo-c2')?.value || '#fff5e0');
                    uniforms.u_c1 = [c1.r / 255, c1.g / 255, c1.b / 255];
                    uniforms.u_c2 = [c2.r / 255, c2.g / 255, c2.b / 255];
                    uniforms.u_pivot = (val('ef-duo-mid') || 128) / 255;
                    break;
                }
                case 'filmgrain':
                case 'argenticgrain': {
                    shader = 'filmgrain';
                    uniforms.u_intensity = (val('ef-grain') || 40) / 100;
                    uniforms.u_time = Math.random();
                    break;
                }
            }

            if (shader) {
                const gpuRes = window.WebGLFilterEngine.applyFilter(this.originalImageData, shader, uniforms);
                if (gpuRes) {
                    this.ctx.putImageData(gpuRes, 0, 0);
                    return;
                }
            }
        }
        // --- End of WebGL Acceleration ---

        const srcOrig = this.originalImageData.data;
        const ps =
            this._effectPreviewPxScale != null && this._effectPreviewPxScale > 0 && this._effectPreviewPxScale < 1
                ? this._effectPreviewPxScale
                : 1;
        const pxU = (v) => (ps >= 1 - 1e-9 ? v : v * ps);
        const pxInt = (v) => Math.max(1, Math.round(pxU(v)));
        const pxRad = (v) => {
            const n = Number(v) || 0;
            if (n < 1) return 0;
            return Math.max(1, Math.round(pxU(n)));
        };

        const geometricOutput = (mapFn) => {
            const out = new ImageData(w, h);
            const od = out.data;
            const cx = w / 2, cy = h / 2;
            const maxR = Math.hypot(cx, cy) || 1;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const [sx, sy] = mapFn(x, y, cx, cy, maxR);
                    const [r, g, b, a] = this._sampleBilinear(srcOrig, w, h, sx, sy);
                    const i = (y * w + x) * 4;
                    od[i] = r; od[i + 1] = g; od[i + 2] = b; od[i + 3] = a;
                }
            }
            this.ctx.putImageData(out, 0, 0);
        };

        switch (this.currentEffect) {
            case 'chromatic': {
                const sh = Math.max(0, Math.round(pxU(val('ef-chr'))));
                const out = new ImageData(w, h);
                const od = out.data;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const [r, , , ar] = this._sampleBilinear(srcOrig, w, h, x - sh, y);
                        const [, g, , ag] = this._sampleBilinear(srcOrig, w, h, x, y);
                        const [, , b, ab] = this._sampleBilinear(srcOrig, w, h, x + sh, y);
                        const i = (y * w + x) * 4;
                        od[i] = r;
                        od[i + 1] = g;
                        od[i + 2] = b;
                        od[i + 3] = Math.min(ar, ag, ab);
                    }
                }
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'wave': {
                const amp = Math.round(pxU(val('ef-wave-a')));
                const freq = Math.max(4, Math.round(pxU(val('ef-wave-f'))));
                geometricOutput((x, y) => [
                    x + amp * Math.sin(y / freq),
                    y + amp * Math.cos(x / freq)
                ]);
                return;
            }
            case 'mirrorquad': {
                geometricOutput((x, y) => {
                    const qx = x < w / 2 ? x : w - 1 - x;
                    const qy = y < h / 2 ? y : h - 1 - y;
                    return [qx, qy];
                });
                return;
            }
            case 'bulge': {
                const k = (val('ef-bulge') / 100) * 2.5;
                geometricOutput((x, y, cx, cy, maxR) => {
                    const dx = x - cx, dy = y - cy;
                    const r = Math.hypot(dx, dy);
                    if (r < 0.5) return [cx, cy];
                    const t = r / maxR;
                    const denom = 1 + k * (1 - t * t);
                    const rSrc = r / denom;
                    return [cx + (dx / r) * rSrc, cy + (dy / r) * rSrc];
                });
                return;
            }
            case 'cabossage': {
                const scaleUi = parseFloat(document.getElementById('ef-cab-scale')?.value) || 25;
                const refrUi = parseFloat(document.getElementById('ef-cab-refr')?.value) || 50;
                const roughUi = parseFloat(document.getElementById('ef-cab-rough')?.value) || 10;
                const tensionUi = parseFloat(document.getElementById('ef-cab-tension')?.value) || 10;
                const qUi = parseFloat(document.getElementById('ef-cab-q')?.value) || 2;
                const H = this._buildCabossageHeightField(
                    w,
                    h,
                    scaleUi,
                    roughUi,
                    tensionUi,
                    qUi,
                    this._cabossageSeed >>> 0
                );
                const str = (refrUi / 100) * Math.min(w, h) * 0.1;
                const out = new ImageData(w, h);
                const od = out.data;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const i = y * w + x;
                        let hx = 0;
                        let hy = 0;
                        if (x > 0 && x < w - 1) hx = (H[i + 1] - H[i - 1]) * 0.5;
                        else if (x > 0) hx = H[i] - H[i - 1];
                        else if (x < w - 1) hx = H[i + 1] - H[i];
                        if (y > 0 && y < h - 1) hy = (H[i + w] - H[i - w]) * 0.5;
                        else if (y > 0) hy = H[i] - H[i - w];
                        else if (y < h - 1) hy = H[i + w] - H[i];
                        const sx = x + hx * str;
                        const sy = y + hy * str;
                        const [r, g, b, a] = this._sampleBilinear(srcOrig, w, h, sx, sy);
                        const di = i * 4;
                        od[di] = r;
                        od[di + 1] = g;
                        od[di + 2] = b;
                        od[di + 3] = a;
                    }
                }
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'pinch': {
                const k = (val('ef-pinch') / 100) * 2.5;
                geometricOutput((x, y, cx, cy, maxR) => {
                    const dx = x - cx, dy = y - cy;
                    const r = Math.hypot(dx, dy);
                    if (r < 0.5) return [cx, cy];
                    const t = r / maxR;
                    const rSrc = r * (1 + k * (1 - t * t));
                    return [cx + (dx / r) * rSrc, cy + (dy / r) * rSrc];
                });
                return;
            }
            case 'twist': {
                const deg = val('ef-twist');
                const rad = (deg * Math.PI) / 180;
                geometricOutput((x, y, cx, cy, maxR) => {
                    const dx = x - cx, dy = y - cy;
                    const r = Math.hypot(dx, dy);
                    if (r < 0.5) return [cx, cy];
                    const theta = Math.atan2(dy, dx) + rad * (r / maxR);
                    return [cx + r * Math.cos(theta), cy + r * Math.sin(theta)];
                });
                return;
            }
            case 'polarInvert': {
                const amt = val('ef-polar') / 100;
                geometricOutput((x, y, cx, cy, maxR) => {
                    const dx = x - cx, dy = y - cy;
                    const r = Math.hypot(dx, dy);
                    if (r < 0.5) return [cx, cy];
                    const theta = Math.atan2(dy, dx);
                    const rSrc = r * (1 - amt) + (maxR - r) * amt;
                    return [cx + rSrc * Math.cos(theta), cy + rSrc * Math.sin(theta)];
                });
                return;
            }
            case 'tileReflect': {
                const T = Math.max(4, pxInt(val('ef-tile')));
                geometricOutput((x, y) => {
                    const qx = Math.floor(x / T), qy = Math.floor(y / T);
                    let tx = x - qx * T, ty = y - qy * T;
                    const mx = tx < T / 2 ? tx : T - 1 - tx;
                    const my = ty < T / 2 ? ty : T - 1 - ty;
                    return [qx * T + mx, qy * T + my];
                });
                return;
            }
            case 'frosted': {
                const spread = pxU(val('ef-frost'));
                const out = new ImageData(w, h);
                const od = out.data;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const sx = x + (Math.random() - 0.5) * spread * 2;
                        const sy = y + (Math.random() - 0.5) * spread * 2;
                        const [r, g, b, a] = this._sampleBilinear(srcOrig, w, h, sx, sy);
                        const i = (y * w + x) * 4;
                        od[i] = r; od[i + 1] = g; od[i + 2] = b; od[i + 3] = a;
                    }
                }
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'crystallize': {
                const cell = Math.max(4, pxInt(val('ef-cry')));
                const out = new ImageData(w, h);
                const od = out.data;
                for (let cy0 = 0; cy0 < h; cy0 += cell) {
                    for (let cx0 = 0; cx0 < w; cx0 += cell) {
                        const cw = Math.min(cell, w - cx0);
                        const chh = Math.min(cell, h - cy0);
                        const rx = cx0 + Math.floor(Math.random() * cw);
                        const ry = cy0 + Math.floor(Math.random() * chh);
                        const si = (ry * w + rx) * 4;
                        const R = srcOrig[si], G = srcOrig[si + 1], B = srcOrig[si + 2], A = srcOrig[si + 3];
                        for (let yy = cy0; yy < cy0 + chh; yy++) {
                            for (let xx = cx0; xx < cx0 + cw; xx++) {
                                const di = (yy * w + xx) * 4;
                                od[di] = R; od[di + 1] = G; od[di + 2] = B; od[di + 3] = A;
                            }
                        }
                    }
                }
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'radialblur': {
                const fn = typeof illuRadialBlurRGBA === 'function' ? illuRadialBlurRGBA : null;
                if (!fn) return;
                const out = fn(srcOrig, w, h, {
                    angle:       Math.max(0, parseFloat(vals['ef-rblur-angle']   ?? 2)),
                    quality:     Math.max(1, Math.min(5, parseInt(vals['ef-rblur-quality'] ?? 2, 10))),
                    innerRadius: Math.max(0, Math.min(1, parseFloat(vals['ef-rblur-inner'] ?? 0) / 100)),
                    offsetX:     (parseFloat(vals['ef-rblur-ox'] ?? 0)) / 100,
                    offsetY:     (parseFloat(vals['ef-rblur-oy'] ?? 0)) / 100
                });
                this.ctx.putImageData(new ImageData(out, w, h), 0, 0);
                return;
            }
            case 'zoomblur': {
                const fn = typeof illuZoomBlurRGBA === 'function' ? illuZoomBlurRGBA : null;
                if (!fn) return;
                const out = fn(srcOrig, w, h, {
                    amount:      Math.max(0, Math.min(100, parseFloat(vals['ef-zblur-amount'] ?? 10))),
                    innerRadius: Math.max(0, Math.min(1, parseFloat(vals['ef-zblur-inner'] ?? 0) / 100)),
                    offsetX:     (parseFloat(vals['ef-zblur-ox'] ?? 0)) / 100,
                    offsetY:     (parseFloat(vals['ef-zblur-oy'] ?? 0)) / 100
                });
                this.ctx.putImageData(new ImageData(out, w, h), 0, 0);
                return;
            }
            case 'motionblur': {
                if (!window.PdnEffects) return;
                const angle = parseFloat(document.getElementById('ef-mblur-angle')?.value || '25');
                const dist = Math.max(1, Math.round(pxU(parseInt(document.getElementById('ef-mblur-dist')?.value || '10', 10))));
                const centered = !!document.getElementById('ef-mblur-center')?.checked;
                const imgData = new ImageData(new Uint8ClampedArray(this.originalImageData.data), w, h);
                const out = window.PdnEffects.motionBlur(imgData, angle, dist, centered);
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'surfaceblur': {
                if (!window.PdnEffects) return;
                const rad = pxRad(parseInt(document.getElementById('ef-sblur-r')?.value || '6', 10));
                const th = parseInt(document.getElementById('ef-sblur-t')?.value || '15', 10);
                const imgData = new ImageData(new Uint8ClampedArray(this.originalImageData.data), w, h);
                const out = window.PdnEffects.surfaceBlur(imgData, rad, th);
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'fragment': {
                if (!window.PdnEffects?.fragment) return;
                const n = parseInt(document.getElementById('ef-frag-n')?.value || '4', 10);
                const d = Math.max(0, Math.round(pxU(parseInt(document.getElementById('ef-frag-d')?.value || '8', 10))));
                const rot = parseFloat(document.getElementById('ef-frag-r')?.value || '0');
                const imgData = new ImageData(new Uint8ClampedArray(this.originalImageData.data), w, h);
                const out = window.PdnEffects.fragment(imgData, n, d, rot);
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'projection3d': {
                const rx = val('ef-3d-rx');
                const ry = val('ef-3d-ry');
                const focal = Math.max(80, Math.min(800, Math.round(pxU(val('ef-3d-f')))));
                const zoom = (val('ef-3d-z') || 100) / 100;
                const tl = val('ef-3d-tl');
                const tr = val('ef-3d-tr');
                const br = val('ef-3d-br');
                const bl = val('ef-3d-bl');
                let dstQuad = this._quadCorners3D(w, h, rx, ry, focal, zoom);
                dstQuad = this._pullCorners(dstQuad, w, h, tl, tr, br, bl);
                const srcQuad = [
                    [0, 0],
                    [w, 0],
                    [w, h],
                    [0, h]
                ];
                const H = this._solveHomography8(srcQuad, dstQuad);
                if (!H) return;
                const Hinv = this._invert3x3(H);
                if (!Hinv) return;
                const out = new ImageData(w, h);
                const od = out.data;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const q0 = Hinv[0] * x + Hinv[1] * y + Hinv[2];
                        const q1 = Hinv[3] * x + Hinv[4] * y + Hinv[5];
                        const q2 = Hinv[6] * x + Hinv[7] * y + Hinv[8];
                        const i = (y * w + x) * 4;
                        if (Math.abs(q2) < 1e-9) {
                            od[i] = 0;
                            od[i + 1] = 0;
                            od[i + 2] = 0;
                            od[i + 3] = 0;
                            continue;
                        }
                        const sx = q0 / q2;
                        const sy = q1 / q2;
                        if (sx < -0.5 || sy < -0.5 || sx >= w - 0.5 || sy >= h - 0.5) {
                            od[i] = 0;
                            od[i + 1] = 0;
                            od[i + 2] = 0;
                            od[i + 3] = 0;
                        } else {
                            const [r, g, b, a] = this._sampleBilinear(srcOrig, w, h, sx, sy);
                            od[i] = r;
                            od[i + 1] = g;
                            od[i + 2] = b;
                            od[i + 3] = a;
                        }
                    }
                }
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'median': {
                // Port of OpenPDN ReduceNoiseEffect:
                // For each pixel, compute per-channel percentile from local histogram,
                // then lerp toward that percentile by strength * (1 - 0.75 * intensity).
                const srcD = this.originalImageData.data;
                const imgData = new ImageData(w, h);
                const data = imgData.data;
                const rad = Math.max(1, Math.min(8, parseInt(vals['ef-med-rad'] || '2', 10)));
                const strength = (parseFloat(vals['ef-med-str'] ?? '100') / 100) * 0.2; // PDN: strength = -0.2 * ui (we use positive for lerp)
                // Pre-build per-row sliding window histograms (R,G,B separately)
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        // Collect neighbourhood into per-channel histograms
                        const hr = new Int32Array(256);
                        const hg = new Int32Array(256);
                        const hb = new Int32Array(256);
                        let area = 0;
                        for (let dy = -rad; dy <= rad; dy++) {
                            const ny = Math.max(0, Math.min(h - 1, y + dy));
                            for (let dx = -rad; dx <= rad; dx++) {
                                const nx = Math.max(0, Math.min(w - 1, x + dx));
                                const j = (ny * w + nx) * 4;
                                hr[srcD[j]]++;
                                hg[srcD[j + 1]]++;
                                hb[srcD[j + 2]]++;
                                area++;
                            }
                        }
                        const si = (y * w + x) * 4;
                        const pR = srcD[si], pG = srcD[si + 1], pB = srcD[si + 2];
                        // Compute cumulative count up to pixel value → percentile position in [0,255]
                        let cR = 0; for (let k = 0; k < pR; k++) cR += hr[k];
                        let cG = 0; for (let k = 0; k < pG; k++) cG += hg[k];
                        let cB = 0; for (let k = 0; k < pB; k++) cB += hb[k];
                        const nR = Math.min(255, Math.round((cR * 255) / area));
                        const nG = Math.min(255, Math.round((cG * 255) / area));
                        const nB = Math.min(255, Math.round((cB * 255) / area));
                        // lerp = strength * (1 - 0.75 * intensity)   where intensity = luma / 255
                        const luma = (0.299 * pR + 0.587 * pG + 0.114 * pB) / 255;
                        const t = Math.max(0, Math.min(1, strength * (1 - 0.75 * luma)));
                        data[si]     = Math.round(pR + (nR - pR) * t);
                        data[si + 1] = Math.round(pG + (nG - pG) * t);
                        data[si + 2] = Math.round(pB + (nB - pB) * t);
                        data[si + 3] = srcD[si + 3];
                    }
                }
                this.ctx.putImageData(imgData, 0, 0);
                return;
            }
            case 'halftone': {
                // Repli thread principal : même trame que le worker (halftone-core.js), pour que
                // l'aperçu et le rendu soient identiques quel que soit le moteur disponible.
                const vals = {};
                document.querySelectorAll('#effect-dialog-content [id^="ef-half-"]').forEach((el) => {
                    vals[el.id] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
                });
                const opts = window.illuHalftoneOptsFromVals(vals, ps);
                const res = window.illuApplyHalftone(srcOrig, w, h, opts, 0, h);
                this.ctx.putImageData(new ImageData(res, w, h), 0, 0);
                return;
            }
            case 'oil': {
                const R = Math.max(1, pxInt(val('ef-oil')));
                const imgData = new ImageData(new Uint8ClampedArray(this.originalImageData.data), w, h);
                const data = imgData.data;
                const src = new Uint8ClampedArray(this.originalImageData.data);
                const buckets = 8;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const hist = new Array(buckets * buckets * buckets).fill(0);
                        const sumR = new Array(buckets * buckets * buckets).fill(0);
                        const sumG = new Array(buckets * buckets * buckets).fill(0);
                        const sumB = new Array(buckets * buckets * buckets).fill(0);
                        for (let dy = -R; dy <= R; dy++) {
                            for (let dx = -R; dx <= R; dx++) {
                                const nx = x + dx, ny = y + dy;
                                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                                const j = (ny * w + nx) * 4;
                                const br = Math.min(buckets - 1, Math.floor((src[j] / 256) * buckets));
                                const bg = Math.min(buckets - 1, Math.floor((src[j + 1] / 256) * buckets));
                                const bb = Math.min(buckets - 1, Math.floor((src[j + 2] / 256) * buckets));
                                const bi = (br * buckets + bg) * buckets + bb;
                                hist[bi]++;
                                sumR[bi] += src[j]; sumG[bi] += src[j + 1]; sumB[bi] += src[j + 2];
                            }
                        }
                        let maxC = 0, maxI = 0;
                        for (let k = 0; k < hist.length; k++) {
                            if (hist[k] > maxC) { maxC = hist[k]; maxI = k; }
                        }
                        const i = (y * w + x) * 4;
                        if (maxC > 0) {
                            data[i] = sumR[maxI] / maxC;
                            data[i + 1] = sumG[maxI] / maxC;
                            data[i + 2] = sumB[maxI] / maxC;
                        }
                    }
                }
                this.ctx.putImageData(imgData, 0, 0);
                return;
            }
            case 'edges': {
                const sens = val('ef-edge') / 100;
                const gray = new Float32Array(w * h);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const j = (y * w + x) * 4;
                        gray[y * w + x] = 0.299 * srcOrig[j] + 0.587 * srcOrig[j + 1] + 0.114 * srcOrig[j + 2];
                    }
                }
                const out = new ImageData(w, h);
                const od = out.data;
                const g = (xx, yy) => (xx >= 0 && xx < w && yy >= 0 && yy < h) ? gray[yy * w + xx] : 0;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const gx = -g(x - 1, y - 1) + g(x + 1, y - 1) - 2 * g(x - 1, y) + 2 * g(x + 1, y) - g(x - 1, y + 1) + g(x + 1, y + 1);
                        const gy = -g(x - 1, y - 1) - 2 * g(x, y - 1) - g(x + 1, y - 1) + g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1);
                        let m = Math.sqrt(gx * gx + gy * gy) * sens * 4;
                        m = Math.min(255, m);
                        const i = (y * w + x) * 4;
                        od[i] = od[i + 1] = od[i + 2] = m;
                        od[i + 3] = 255;
                    }
                }
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'emboss': {
                const str = val('ef-emb') / 10;
                const src = this.originalImageData.data;
                const imgData = new ImageData(w, h);
                const data = imgData.data;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const x0 = Math.max(0, x - 1), y0 = Math.max(0, y - 1);
                        const i = (y * w + x) * 4, j = (y0 * w + x0) * 4;
                        for (let c = 0; c < 3; c++) {
                            let v = 128 + (src[i + c] - src[j + c]) * str;
                            data[i + c] = Math.min(255, Math.max(0, v));
                        }
                        data[i + 3] = src[i + 3];
                    }
                }
                this.ctx.putImageData(imgData, 0, 0);
                return;
            }
            case 'solarize': {
                const th = val('ef-sol');
                const imgData = new ImageData(new Uint8ClampedArray(this.originalImageData.data), w, h);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    if (lum > th) {
                        data[i] = 255 - data[i];
                        data[i + 1] = 255 - data[i + 1];
                        data[i + 2] = 255 - data[i + 2];
                    }
                }
                this.ctx.putImageData(imgData, 0, 0);
                return;
            }
            case 'threshold': {
                // Seuil : chaque pixel devient noir ou blanc selon sa luminance (préserve l'alpha).
                const th = val('ef-thr');
                const imgData = new ImageData(new Uint8ClampedArray(this.originalImageData.data), w, h);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    const v = lum >= th ? 255 : 0;
                    data[i] = data[i + 1] = data[i + 2] = v;
                }
                this.ctx.putImageData(imgData, 0, 0);
                return;
            }
            case 'vibrance': {
                // Vibrance : booste surtout les couleurs peu saturées (protège les tons déjà vifs).
                const amount = val('ef-vibr') / 100;
                const imgData = new ImageData(new Uint8ClampedArray(this.originalImageData.data), w, h);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const mx = Math.max(r, g, b);
                    const avg = (r + g + b) / 3;
                    const boost = amount * (1 - (mx - avg) / 255);
                    data[i] = avg + (r - avg) * (1 + boost);
                    data[i + 1] = avg + (g - avg) * (1 + boost);
                    data[i + 2] = avg + (b - avg) * (1 + boost);
                }
                this.ctx.putImageData(imgData, 0, 0);
                return;
            }
            case 'unsharp': {
                // Masque flou : original + intensité × (original − flou), avec seuil anti-bruit.
                const amount = val('ef-us-amount') / 100;
                const radius = Math.max(1, Math.round(val('ef-us-radius')));
                const thr = val('ef-us-threshold');
                const src = this.originalImageData.data;
                const blur = this._boxBlurRGB(src, w, h, radius);
                const imgData = new ImageData(new Uint8ClampedArray(src), w, h);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    for (let c = 0; c < 3; c++) {
                        const o = src[i + c];
                        const diff = o - blur[i + c];
                        if (Math.abs(diff) > thr) data[i + c] = o + amount * diff;
                    }
                }
                this.ctx.putImageData(imgData, 0, 0);
                return;
            }
            case 'vignette': {
                const vig = val('ef-vig') / 100;
                const vc = this._parseHexColor(val('ef-vig-color') || '#000000');
                const blend = parseInt(val('ef-vig-blend') || 0, 10);
                const imgData = new ImageData(new Uint8ClampedArray(this.originalImageData.data), w, h);
                const data = imgData.data;
                const cx = w / 2, cy = h / 2;
                const maxR = Math.hypot(cx, cy) || 1;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const dist = Math.hypot(x - cx, y - cy);
                        // Using same smoothstep logic as WebGL: smoothstep(0.8, 0.2, dist * u_intensity * 2.0)
                        // but JS fallback used: Math.hypot(x-cx,y-cy)/maxR ... 1 - vig * dr * dr
                        // Let's implement the WebGL smoothstep logic to be consistent
                        let normDist = dist / maxR;
                        let d = normDist * vig * 2.0;
                        let mask = 0.0;
                        if (d <= 0.2) mask = 1.0;
                        else if (d >= 0.8) mask = 0.0;
                        else {
                            let t = (d - 0.8) / (0.2 - 0.8);
                            mask = t * t * (3.0 - 2.0 * t);
                        }
                        
                        const i = (y * w + x) * 4;
                        const r = data[i], g = data[i+1], b = data[i+2];
                        const oR = r/255, oG = g/255, oB = b/255;
                        const mR = vc.r/255, mG = vc.g/255, mB = vc.b/255;
                        
                        let fR = oR, fG = oG, fB = oB;
                        if (blend === 1) { // Multiply
                            fR = oR * mR; fG = oG * mG; fB = oB * mB;
                        } else if (blend === 2) { // Screen
                            fR = 1.0 - (1.0 - oR) * (1.0 - mR);
                            fG = 1.0 - (1.0 - oG) * (1.0 - mG);
                            fB = 1.0 - (1.0 - oB) * (1.0 - mB);
                        } else if (blend === 3) { // Overlay
                            fR = (oR < 0.5) ? (2.0 * oR * mR) : (1.0 - 2.0 * (1.0 - oR) * (1.0 - mR));
                            fG = (oG < 0.5) ? (2.0 * oG * mG) : (1.0 - 2.0 * (1.0 - oG) * (1.0 - mG));
                            fB = (oB < 0.5) ? (2.0 * oB * mB) : (1.0 - 2.0 * (1.0 - oB) * (1.0 - mB));
                        } else { // Normal
                            fR = mR; fG = mG; fB = mB;
                        }
                        
                        data[i] = Math.max(0, Math.min(255, (oR * mask + fR * (1.0 - mask)) * 255));
                        data[i+1] = Math.max(0, Math.min(255, (oG * mask + fG * (1.0 - mask)) * 255));
                        data[i+2] = Math.max(0, Math.min(255, (oB * mask + fB * (1.0 - mask)) * 255));
                    }
                }
                this.ctx.putImageData(imgData, 0, 0);
                return;
            }
            case 'softglow': {
                const rad = Math.max(1, pxRad(val('ef-glow-r')));
                const amt = val('ef-glow-a') / 100;
                const imgData = new ImageData(new Uint8ClampedArray(this.originalImageData.data), w, h);
                const data = imgData.data;
                const temp = new Uint8ClampedArray(data);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        let r = 0, g = 0, b = 0, c = 0;
                        for (let dy = -rad; dy <= rad; dy++) {
                            for (let dx = -rad; dx <= rad; dx++) {
                                const nx = x + dx, ny = y + dy;
                                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                    const j = (ny * w + nx) * 4;
                                    r += temp[j]; g += temp[j + 1]; b += temp[j + 2]; c++;
                                }
                            }
                        }
                        const j = (y * w + x) * 4;
                        const br = r / c, bg = g / c, bb = b / c;
                        data[j] = Math.min(255, temp[j] + (br - temp[j]) * amt * 2);
                        data[j + 1] = Math.min(255, temp[j + 1] + (bg - temp[j + 1]) * amt * 2);
                        data[j + 2] = Math.min(255, temp[j + 2] + (bb - temp[j + 2]) * amt * 2);
                    }
                }
                this.ctx.putImageData(imgData, 0, 0);
                return;
            }
            case 'ascii': {
                // La source est découpée en cellules de la taille d'un caractère. Chaque cellule
                // donne une couleur moyenne (pondérée par l'alpha) et une luminosité ; celle-ci
                // choisit le caractère dans la rampe (du plus clair au plus dense).
                const size = Math.max(2, pxInt(val('ef-ascii-size') || 10));
                const family = document.getElementById('ef-ascii-font')?.value || 'monospace';
                const bold = !!document.getElementById('ef-ascii-bold')?.checked;
                const invert = !!document.getElementById('ef-ascii-invert')?.checked;
                const gamma = Math.max(0.2, (val('ef-ascii-gamma') || 100) / 100);
                const chars = this._asciiChars();
                const nChars = chars.length;
                const solid = this._asciiUsesSolidColor();
                const bgMode = document.getElementById('ef-ascii-bg')?.value || 'transparent';

                const em = window.EditorManager;
                const pc = solid && em && em.primaryColor ? em.primaryColor : { r: 255, g: 255, b: 255 };
                const inkCss = `rgb(${pc.r},${pc.g},${pc.b})`;
                let bgCss = null;
                if (bgMode === 'black') bgCss = '#000000';
                else if (bgMode === 'white') bgCss = '#ffffff';
                else if (bgMode === 'secondary') {
                    const sc = em && em.secondaryColor ? em.secondaryColor : { r: 0, g: 0, b: 0 };
                    bgCss = `rgb(${sc.r},${sc.g},${sc.b})`;
                }

                const ctx = this.ctx;
                const fontSpec = `${bold ? 'bold ' : ''}${size}px ${family}`;
                ctx.font = fontSpec;

                // Police @font-face pas encore chargée : on rend avec le repli, puis on relance
                // l'aperçu une fois la police disponible (sinon le canvas garde le repli).
                try {
                    if (document.fonts && !document.fonts.check(fontSpec)) {
                        if (this._asciiFontPending !== fontSpec) {
                            this._asciiFontPending = fontSpec;
                            document.fonts
                                .load(fontSpec, chars.join(''))
                                .then(() => {
                                    if (this._asciiFontPending !== fontSpec) return;
                                    this._asciiFontPending = null;
                                    if (this.currentEffect === 'ascii') this.preview();
                                })
                                .catch(() => {
                                    this._asciiFontPending = null;
                                });
                        }
                    } else {
                        this._asciiFontPending = null;
                    }
                } catch (e) {
                    /* spécification de police non vérifiable : on rend tel quel */
                }

                // Grille régulière : largeur = caractère le plus large de la rampe.
                let cw = 0;
                for (let i = 0; i < nChars; i++) {
                    const m = ctx.measureText(chars[i]).width;
                    if (m > cw) cw = m;
                }
                cw = Math.max(1, Math.round(cw));
                const cellH = Math.max(1, Math.round(size));
                const cols = Math.ceil(w / cw);
                const rows = Math.ceil(h / cellH);

                ctx.clearRect(0, 0, w, h);
                ctx.save();
                ctx.font = fontSpec;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                for (let ry = 0; ry < rows; ry++) {
                    const y0 = ry * cellH;
                    const y1 = Math.min(h, y0 + cellH);
                    for (let rx = 0; rx < cols; rx++) {
                        const x0 = rx * cw;
                        const x1 = Math.min(w, x0 + cw);
                        let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
                        for (let y = y0; y < y1; y++) {
                            let i = (y * w + x0) * 4;
                            for (let x = x0; x < x1; x++, i += 4) {
                                const a = srcOrig[i + 3] / 255;
                                sr += srcOrig[i] * a;
                                sg += srcOrig[i + 1] * a;
                                sb += srcOrig[i + 2] * a;
                                sa += a;
                                n++;
                            }
                        }
                        if (!n) continue;
                        const aAvg = sa / n;
                        if (aAvg < 0.02) continue; // cellule vide : reste transparente
                        const r = sr / sa, g = sg / sa, b = sb / sa;

                        if (bgCss) {
                            ctx.globalAlpha = aAvg;
                            ctx.fillStyle = bgCss;
                            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                        }

                        let t = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        t = Math.pow(t < 0 ? 0 : t > 1 ? 1 : t, 1 / gamma);
                        if (invert) t = 1 - t;
                        const gi = Math.max(0, Math.min(nChars - 1, Math.round(t * (nChars - 1))));
                        const glyph = chars[gi];
                        if (glyph && glyph !== ' ') {
                            ctx.globalAlpha = aAvg;
                            ctx.fillStyle = solid ? inkCss : `rgb(${r | 0},${g | 0},${b | 0})`;
                            ctx.fillText(glyph, x0 + cw / 2, y0 + cellH / 2);
                        }
                    }
                }
                ctx.globalAlpha = 1;
                ctx.restore();
                return;
            }
            case 'dropshadow': {
                const ox = Math.round(pxU(parseInt(document.getElementById('ef-ds-ox')?.value || '0', 10) || 0));
                const oy = Math.round(pxU(parseInt(document.getElementById('ef-ds-oy')?.value || '0', 10) || 0));
                const blur = Math.max(0, pxRad(val('ef-ds-blur')));
                const op = Math.max(0, Math.min(100, val('ef-ds-op'))) / 100;
                const srcC = document.createElement('canvas');
                srcC.width = w;
                srcC.height = h;
                srcC.getContext('2d', { willReadFrequently: true }).putImageData(this.originalImageData, 0, 0);
                this.ctx.clearRect(0, 0, w, h);
                this.ctx.save();
                this.ctx.shadowColor = `rgba(0,0,0,${op})`;
                this.ctx.shadowBlur = blur;
                this.ctx.shadowOffsetX = ox;
                this.ctx.shadowOffsetY = oy;
                this.ctx.drawImage(srcC, 0, 0);
                this.ctx.shadowColor = 'transparent';
                this.ctx.shadowBlur = 0;
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
                this.ctx.drawImage(srcC, 0, 0);
                this.ctx.restore();
                return;
            }
case 'chroma': {
                const kr = Math.max(0, Math.min(255, val('ef-ch-r')));
                const kg = Math.max(0, Math.min(255, val('ef-ch-g')));
                const kb = Math.max(0, Math.min(255, val('ef-ch-b')));
                
                const useKey2 = !!(document.getElementById('ef-ch-use2') && document.getElementById('ef-ch-use2').checked);
                const params = {
                    tolerance: val('ef-ch-tol'),
                    drift: val('ef-ch-drift'),
                    feather: val('ef-ch-feather'),
                    clipBlack: val('ef-ch-black'),
                    clipWhite: val('ef-ch-white'),
                    gamma: val('ef-ch-gamma'),
                    spill: val('ef-ch-spill'),
                    lumaProt: val('ef-ch-luma'),
                    useKey2,
                    kr2: useKey2 ? Math.max(0, Math.min(255, val('ef-ch-r2'))) : undefined,
                    kg2: useKey2 ? Math.max(0, Math.min(255, val('ef-ch-g2'))) : undefined,
                    kb2: useKey2 ? Math.max(0, Math.min(255, val('ef-ch-b2'))) : undefined
                };

                const out = new ImageData(new Uint8ClampedArray(srcOrig), w, h);
                const data = out.data;

                // ASTUCE DE PERFORMANCE : 
                // Si c'est le rendu final (quand on clique sur Appliquer/OK), on calcule 100% des pixels (stride = 1)
                // Si c'est juste la prévisualisation (quand on bouge le slider), on calcule 1 pixel sur 2 (stride = 2). 
                // Ça divise la charge processeur par 4 !
                const stride = this._effectPreviewIsFinal ? 1 : 2;

                for (let y = 0; y < h; y += stride) {
                    for (let x = 0; x < w; x += stride) {
                        const i = (y * w + x) * 4;
                        
                        // 1. Calcul de la transparence
                        const keep = ChromaKeyer.computeMatte(data[i], data[i+1], data[i+2], kr, kg, kb, params);
                        const alpha = Math.round(data[i + 3] * keep);
                        
                        let r = data[i], g = data[i+1], b = data[i+2];

                        // 2. Correction des bords (Despill)
                        if (params.spill > 0 && alpha > 0) {
                            const rgb = ChromaKeyer.applyDespill(r, g, b, kr, kg, kb, params.spill);
                            r = rgb[0]; g = rgb[1]; b = rgb[2];
                        }

                        data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = alpha;

                        // 3. Remplissage des pixels sautés (uniquement en prévisualisation)
                        if (stride > 1) {
                            for (let dy = 0; dy < stride; dy++) {
                                for (let dx = 0; dx < stride; dx++) {
                                    if (dx === 0 && dy === 0) continue;
                                    
                                    const nx = x + dx;
                                    const ny = y + dy;
                                    
                                    // SÉCURITÉ : On vérifie qu'on ne sort pas de l'image
                                    if (nx < w && ny < h) {
                                        const ni = (ny * w + nx) * 4;
                                        data[ni] = r; 
                                        data[ni+1] = g; 
                                        data[ni+2] = b; 
                                        data[ni+3] = alpha;
                                    }
                                }
                            }
                        }
                    }
                }
                
                this.ctx.putImageData(out, 0, 0);
                return;
            }
            case 'vhs': {
                const params =
                    typeof window.illuBuildVhsParams === 'function' ? window.illuBuildVhsParams() : {};
                const applyVhs = window.illuApplyVhsToRgba;
                if (typeof applyVhs !== 'function') return;

                const fullRes = this._vhsUseLowResPreview === false;
                const pm = document.getElementById('ef-vhs-preview_max');
                let maxSide = 480;
                if (pm && pm.value !== '') {
                    const n = parseInt(pm.value, 10);
                    if (Number.isFinite(n)) maxSide = Math.max(160, Math.min(1600, n));
                }
                const bigSide = Math.max(w, h);
                const useDownscale = !fullRes && bigSide > maxSide;

                if (!useDownscale) {
                    const out = applyVhs(this.originalImageData.data, w, h, params, 0);
                    if (out) {
                        this.ctx.putImageData(new ImageData(out, w, h), 0, 0);
                    }
                    return;
                }

                const scale = maxSide / bigSide;
                const pw = Math.max(8, Math.round(w * scale));
                const ph = Math.max(8, Math.round(h * scale));
                const oc = document.createElement('canvas');
                oc.width = w;
                oc.height = h;
                oc.getContext('2d', { willReadFrequently: true }).putImageData(this.originalImageData, 0, 0);
                const sc = document.createElement('canvas');
                sc.width = pw;
                sc.height = ph;
                const sctx = sc.getContext('2d', { willReadFrequently: true });
                sctx.imageSmoothingEnabled = true;
                sctx.imageSmoothingQuality = 'low';
                sctx.drawImage(oc, 0, 0, pw, ph);
                let smallImg;
                try {
                    smallImg = sctx.getImageData(0, 0, pw, ph);
                } catch (e) {
                    const out = applyVhs(this.originalImageData.data, w, h, params, 0);
                    if (out) this.ctx.putImageData(new ImageData(out, w, h), 0, 0);
                    return;
                }
                const outSmall = applyVhs(smallImg.data, pw, ph, params, 0);
                if (!outSmall) return;
                const outC = document.createElement('canvas');
                outC.width = pw;
                outC.height = ph;
                outC.getContext('2d', { willReadFrequently: true }).putImageData(new ImageData(outSmall, pw, ph), 0, 0);
                this.ctx.clearRect(0, 0, w, h);
                this.ctx.imageSmoothingEnabled = true;
                this.ctx.imageSmoothingQuality = 'medium';
                this.ctx.drawImage(outC, 0, 0, w, h);
                return;
            }
            case 'sketch':
                this.ctx.putImageData(this.originalImageData, 0, 0);
                this.ctx.filter = 'grayscale(100%) contrast(500%) invert(100%)';
                this.ctx.drawImage(this.canvas, 0, 0);
                this.ctx.filter = 'none';
                return;
            default:
                break;
        }

        const imgData = new ImageData(
            new Uint8ClampedArray(this.originalImageData.data),
            this.originalImageData.width,
            this.originalImageData.height
        );
        const data = imgData.data;

        switch (this.currentEffect) {
            case 'grayscale': 
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    data[i] = data[i + 1] = data[i + 2] = avg;
                }
                break;
            case 'invert':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i]; data[i + 1] = 255 - data[i + 1]; data[i + 2] = 255 - data[i + 2];
                }
                break;
            case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;
            case 'autolevel':
                {
                let min = [255, 255, 255], max = [0, 0, 0];
                for (let i = 0; i < data.length; i += 4) {
                    for (let c = 0; c < 3; c++) {
                            if (data[i + c] < min[c]) min[c] = data[i + c];
                            if (data[i + c] > max[c]) max[c] = data[i + c];
                    }
                }
                for (let i = 0; i < data.length; i += 4) {
                    for (let c = 0; c < 3; c++) {
                            data[i + c] = (data[i + c] - min[c]) * (255 / ((max[c] - min[c]) || 1));
                        }
                    }
                }
                break;
            case 'brightness':
                {
                const b = val('ef-b'), c = val('ef-c');
                const factor = (259 * (c + 255)) / (255 * (259 - c));
                for (let i = 0; i < data.length; i += 4) {
                    for (let j = 0; j < 3; j++) {
                            data[i + j] = Math.min(255, Math.max(0, factor * (data[i + j] - 128) + 128 + b));
                        }
                    }
                }
                break;
            case 'hsv':
                {
                    const hue = val('ef-h'), sat = val('ef-s'), lig = val('ef-l');
                    const pm = this._hsvMixParams || {};
                    const hp = pm;
                    const hasMix = hp && ((hp.hslHue && hp.hslHue.some(v=>v!==0)) || (hp.hslSat && hp.hslSat.some(v=>v!==0)) || (hp.hslLum && hp.hslLum.some(v=>v!==0)));
                    for (let i = 0; i < data.length; i += 4) {
                        if (hasMix && window.IlluImageAdjustCore && window.IlluImageAdjustCore.rgbToHsl) {
                            let r = data[i], g = data[i + 1], b = data[i + 2];
                            let hsl = window.IlluImageAdjustCore.rgbToHsl(r, g, b);
                            const w = window.IlluImageAdjustCore.getHslWeightsFast(hsl.h);
                            const hShift = pm.hslHue ? (pm.hslHue[w.i1] * w.w1 + pm.hslHue[w.i2] * w.w2) : 0;
                            const sShift = pm.hslSat ? (pm.hslSat[w.i1] * w.w1 + pm.hslSat[w.i2] * w.w2) : 0;
                            const lShift = pm.hslLum ? (pm.hslLum[w.i1] * w.w1 + pm.hslLum[w.i2] * w.w2) : 0;
                            hsl.h = (hsl.h + hShift + hue + 360) % 360;
                            hsl.s = Math.max(0, Math.min(100, hsl.s + sShift + sat));
                            hsl.l = Math.max(0, Math.min(100, hsl.l + lShift + lig));
                            let rgb = window.IlluImageAdjustCore.hslToRgb(hsl.h, hsl.s, hsl.l);
                            data[i] = rgb.r; data[i + 1] = rgb.g; data[i + 2] = rgb.b;
                        } else {
                            let hsv = EditorManager.rgbToHsv(data[i], data[i + 1], data[i + 2]);
                            hsv.h = (hsv.h + hue + 360) % 360;
                            hsv.s = Math.max(0, Math.min(100, hsv.s + sat));
                            hsv.v = Math.max(0, Math.min(100, hsv.v + lig));
                            let rgb = EditorManager.hsvToRgb(hsv.h, hsv.s, hsv.v);
                            data[i] = rgb.r; data[i + 1] = rgb.g; data[i + 2] = rgb.b;
                        }
                    }
                }
                break;
            case 'addnoise':
                {
                const int = val('ef-int');
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * int;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
                    }
                }
                break;
            case 'pixelate':
                {
                const size = pxInt(val('ef-size'));
                    for (let yy = 0; yy < h; yy += size) {
                        for (let xx = 0; xx < w; xx += size) {
                            const idx = (yy * w + xx) * 4;
                            const vr = data[idx], vg = data[idx + 1], vb = data[idx + 2];
                            for (let dy = 0; dy < size && yy + dy < h; dy++) {
                                for (let dx = 0; dx < size && xx + dx < w; dx++) {
                                    const target = ((yy + dy) * w + (xx + dx)) * 4;
                                    data[target] = vr; data[target + 1] = vg; data[target + 2] = vb;
                                }
                            }
                        }
                    }
                }
                break;
            case 'posterize':
                {
                const levels = Math.max(2, val('ef-lvl'));
                const step = 255 / (levels - 1);
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.round(data[i] / step) * step;
                        data[i + 1] = Math.round(data[i + 1] / step) * step;
                        data[i + 2] = Math.round(data[i + 2] / step) * step;
                    }
                }
                break;
            case 'blur':
            case 'gaussian':
                {
                    const rad = pxRad(val('ef-rad'));
                    const edgeAware = !!document.getElementById('ef-blur-edge')?.checked;
                    const passes = this.currentEffect === 'gaussian' ? 3 : 1;
                    const cw = w;
                    const ch = h;
                    for (let pass = 0; pass < passes; pass++) {
                        const tempData = new Uint8ClampedArray(data);
                        for (let y = 0; y < ch; y++) {
                            for (let x = 0; x < cw; x++) {
                                let r = 0, g = 0, b = 0, count = 0;
                                for (let dy = -rad; dy <= rad; dy++) {
                                    for (let dx = -rad; dx <= rad; dx++) {
                                        let nx = x + dx, ny = y + dy;
                                        if (edgeAware) {
                                            nx = Math.max(0, Math.min(cw - 1, nx));
                                            ny = Math.max(0, Math.min(ch - 1, ny));
                                        }
                                        if (nx >= 0 && nx < cw && ny >= 0 && ny < ch) {
                                            const idx = (ny * cw + nx) * 4;
                                            r += tempData[idx]; g += tempData[idx + 1]; b += tempData[idx + 2];
                                            count++;
                                        }
                                    }
                                }
                                const target = (y * cw + x) * 4;
                                data[target] = r / count; data[target + 1] = g / count; data[target + 2] = b / count;
                            }
                        }
                    }
                }
                break;
            case 'argenticgrain': {
                const str = val('ef-grain') / 100;
                for (let i = 0; i < data.length; i += 4) {
                    const n = (Math.random() - 0.5) * str * 128;
                    for (let c = 0; c < 3; c++) {
                        data[i + c] = Math.min(255, Math.max(0, data[i + c] + n));
                    }
                }
                break;
            }
            case 'digitalpattern': {
                const str = val('ef-grain') / 100;
                const cell = Math.max(2, pxInt(val('ef-grain-fine')));
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const gx = (x / cell) | 0;
                        const gy = (y / cell) | 0;
                        const n = this._grainNoise(gx, gy) * str * 64;
                        const i = (y * w + x) * 4;
                        for (let c = 0; c < 3; c++) {
                            data[i + c] = Math.min(255, Math.max(0, data[i + c] + n));
                        }
                    }
                }
                break;
            }
            case 'sharpen': {
                const amt = val('ef-sharp') / 100;
                const rad = Math.max(1, Math.min(3, Math.round(pxU(val('ef-sharp-r')))));
                const src = new Uint8ClampedArray(data);
                const blur = new Uint8ClampedArray(data.length);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        let r = 0,
                            g = 0,
                            b = 0,
                            cnt = 0;
                        for (let dy = -rad; dy <= rad; dy++) {
                            for (let dx = -rad; dx <= rad; dx++) {
                                const nx = Math.max(0, Math.min(w - 1, x + dx));
                                const ny = Math.max(0, Math.min(h - 1, y + dy));
                                const j = (ny * w + nx) * 4;
                                r += src[j];
                                g += src[j + 1];
                                b += src[j + 2];
                                cnt++;
                            }
                        }
                        const i = (y * w + x) * 4;
                        blur[i] = r / cnt;
                        blur[i + 1] = g / cnt;
                        blur[i + 2] = b / cnt;
                        blur[i + 3] = src[i + 3];
                    }
                }
                for (let i = 0; i < data.length; i += 4) {
                    for (let c = 0; c < 3; c++) {
                        const hi = src[i + c] + (src[i + c] - blur[i + c]) * amt;
                        data[i + c] = Math.min(255, Math.max(0, Math.round(hi)));
                    }
                }
                break;
            }
            case 'exposure': {
                const expEl = document.getElementById('ef-exp');
                const gamEl = document.getElementById('ef-gamma');
                const expM = (parseFloat(expEl && expEl.value) || 100) / 100;
                const gamma = (parseFloat(gamEl && gamEl.value) || 100) / 100;
                const invG = gamma > 0.05 ? 1 / gamma : 1;
                for (let i = 0; i < data.length; i += 4) {
                    for (let c = 0; c < 3; c++) {
                        let v = data[i + c] * expM;
                        v = Math.min(255, Math.max(0, v));
                        const nv = Math.pow(v / 255, invG) * 255;
                        data[i + c] = Math.min(255, Math.max(0, Math.round(nv)));
                    }
                }
                break;
            }
            case 'colorbal': {
                const dr = val('ef-cb-r');
                const dg = val('ef-cb-g');
                const db = val('ef-cb-b');
                
                const cb = this._cbParams || {};
                const hasP = arr => arr && arr.length >= 2;
                const lutMaster = hasP(cb.curveMaster) && window.IlluImageAdjustCore ? window.IlluImageAdjustCore.createCurveLUT(cb.curveMaster) : null;
                const lutR = hasP(cb.curveR) && window.IlluImageAdjustCore ? window.IlluImageAdjustCore.createCurveLUT(cb.curveR) : null;
                const lutG = hasP(cb.curveG) && window.IlluImageAdjustCore ? window.IlluImageAdjustCore.createCurveLUT(cb.curveG) : null;
                const lutB = hasP(cb.curveB) && window.IlluImageAdjustCore ? window.IlluImageAdjustCore.createCurveLUT(cb.curveB) : null;

                for (let i = 0; i < data.length; i += 4) {
                    let r = Math.min(255, Math.max(0, data[i] + dr));
                    let g = Math.min(255, Math.max(0, data[i + 1] + dg));
                    let b = Math.min(255, Math.max(0, data[i + 2] + db));
                    
                    if (lutMaster) { r = lutMaster[r]; g = lutMaster[g]; b = lutMaster[b]; }
                    if (lutR) r = lutR[r];
                    if (lutG) g = lutG[g];
                    if (lutB) b = lutB[b];
                    
                    data[i] = r;
                    data[i + 1] = g;
                    data[i + 2] = b;
                }
                break;
            }
            case 'duotone': {
                const c1 = this._parseHexColor(
                    document.getElementById('ef-duo-c1') && document.getElementById('ef-duo-c1').value
                );
                const c2 = this._parseHexColor(
                    document.getElementById('ef-duo-c2') && document.getElementById('ef-duo-c2').value
                );
                const pivot = Math.max(0.02, Math.min(0.98, (val('ef-duo-mid') || 128) / 255));
                for (let i = 0; i < data.length; i += 4) {
                    const lum =
                        (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
                    let t;
                    if (lum <= pivot) t = (lum / pivot) * 0.5;
                    else t = 0.5 + ((lum - pivot) / (1 - pivot)) * 0.5;
                    t = Math.min(1, Math.max(0, t));
                    data[i] = Math.round(c1.r + (c2.r - c1.r) * t);
                    data[i + 1] = Math.round(c1.g + (c2.g - c1.g) * t);
                    data[i + 2] = Math.round(c1.b + (c2.b - c1.b) * t);
                }
                break;
            }
        }

        this.ctx.putImageData(imgData, 0, 0);
    },

    _syncHsvMixUI() {
        const content = document.getElementById('effect-dialog-content');
        if (window.IlluImageAdjustCore && content) {
            const wrap = content.querySelector('.illu-hsl-manager');
            if (wrap && wrap._syncUI) {
                wrap._syncUI();
            } else {
                window.IlluImageAdjustCore.HSLManager.bind(content, 'ef-hsv-mix', this._hsvMixParams, () => this.preview());
            }
        }
    },

    _forceRedrawCurves() {
        const content = document.getElementById('effect-dialog-content');
        if (window.IlluImageAdjustCore && content) {
            window.IlluImageAdjustCore.CurveEditor.bind(content, 'ef-cb', this._cbParams, () => this.preview());
            // Small delay to ensure canvas is fully visible for initial draw
            setTimeout(() => {
                const cv = content.querySelector('.illu-curve-editor canvas');
                if (cv && cv._forceDraw) cv._forceDraw();
            }, 10);
        }
    }
};

window.applyEffect = function(effect) {
    FilterManager.initEffect(effect);
};

window.closeEffectModal = function() {
    FilterManager.closeModal();
};

window.applyCurrentEffectModal = function() {
    FilterManager.apply();
};

// --- Instant Filter Gallery (Standard Editor) ---

FilterManager.showInstantFilterGallery = function() {
    if (!this._beginPixelEffectSession()) return;
    this.currentEffect = 'gallery';

    if (!document.getElementById('illu-instant-filter-styles')) {
        const style = document.createElement('style');
        style.id = 'illu-instant-filter-styles';
        style.textContent = `
            .illu-if-list {
                display: flex;
                flex-direction: column;
                max-height: 420px;
                overflow-y: auto;
                background: #1e1e1e;
                border: 1px solid #444;
                border-radius: 4px;
            }
            .illu-if-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 15px;
                cursor: pointer;
                transition: background 0.1s;
                border-bottom: 1px solid #2d2d2d;
                user-select: none;
            }
            .illu-if-item:last-child {
                border-bottom: none;
            }
            .illu-if-item:hover {
                background: #007acc;
            }
            .illu-if-item:hover i, .illu-if-item:hover span {
                color: #fff !important;
            }
            .illu-if-item i {
                font-size: 14px;
                color: #007acc;
                width: 20px;
                text-align: center;
                flex-shrink: 0;
            }
            .illu-if-item span {
                font-size: 12px;
                color: #ccc;
                font-weight: 500;
            }
            .illu-if-section-h {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #666;
                background: #181818;
                padding: 6px 15px;
                border-bottom: 1px solid #333;
                position: sticky;
                top: 0;
                z-index: 10;
            }
        `;
        document.head.appendChild(style);
    }
    const tKey = (k, fb) => (window.IlluI18n && window.IlluI18n.t) ? window.IlluI18n.t(k) : fb;

    const contentHtml = `
        <div class="field-row" style="margin-top: 10px; flex-direction: column; align-items: stretch; gap: 8px;">
            <label for="illu-cr-preset" style="font-weight: 600;">${tKey('photo.choiceLook', 'Choix du look :')}</label>
            <select id="illu-cr-preset" onchange="FilterManager.previewInstantFilter(this.value)">
                <option value="none">${tKey('photo.lookNone', 'Aucun (Manuel)')}</option>
                
                <optgroup label="${tKey('photo.groupFlash', 'Corrections Rapides')}">
                    <option value="autolevel">${tKey('photo.presetAutoLevel', 'Niveaux Automatiques')}</option>
                    <option value="bw_soft">${tKey('photo.presetBWDoux', 'Noir & Blanc Doux')}</option>
                    <option value="sepia">${tKey('photo.presetSepiaSimple', 'Sépia Simple')}</option>
                </optgroup>

                <optgroup label="${tKey('photo.groupBW', 'Noir & Blanc / Sépia')}">
                    <option value="bw_hard">${tKey('photo.presetBWIntense', 'Noir & Blanc Intense')}</option>
                    <option value="sepia_classic">${tKey('photo.presetSepiaClassic', 'Sépia Historique')}</option>
                </optgroup>

                <optgroup label="${tKey('photo.groupCinema', 'Cinématographique & Urbain')}">
                    <option value="teal_and_orange">${tKey('photo.presetTealOrange', 'Cinéma (Teal & Orange)')}</option>
                    <option value="neon_city">${tKey('photo.presetNeon', 'Néon Urbain')}</option>
                    <option value="cyber_green">${tKey('photo.presetCyber', 'Code Vert (Cyber)')}</option>
                    <option value="urban_night">${tKey('photo.presetUrbanNight', 'Nuit Bleutée')}</option>
                </optgroup>

                <optgroup label="${tKey('photo.groupVintage', 'Vintage & Pellicule')}">
                    <option value="retro_instant">${tKey('photo.presetRetro', 'Photo Rétro (Instant)')}</option>
                    <option value="faded_70s">${tKey('photo.preset70s', 'Pellicule 70s')}</option>
                    <option value="warm_nostalgia">${tKey('photo.presetWarmNostalgia', 'Nostalgie Chaude')}</option>
                    <option value="bleached">${tKey('photo.presetBleached', 'Couleurs Délavées')}</option>
                </optgroup>

                <optgroup label="${tKey('photo.groupNature', 'Nature & Atmosphère')}">
                    <option value="desert_sun">${tKey('photo.presetDesert', 'Soleil du Désert')}</option>
                    <option value="arctic_chill">${tKey('photo.presetArctic', 'Froid Arctique')}</option>
                    <option value="autumn_leaves">${tKey('photo.presetAutumn', 'Feuilles d\'Automne')}</option>
                </optgroup>

                <optgroup label="${tKey('photo.groupSoft', 'Douceur & Portrait')}">
                    <option value="dreamy_soft">${tKey('photo.presetDreamy', 'Rêve Pastel')}</option>
                    <option value="cotton_candy">${tKey('photo.presetCotton', 'Barbe à Papa')}</option>
                </optgroup>

                <optgroup label="${tKey('photo.groupTech', 'Styles Techniques')}">
                    <option value="ultra_detail">${tKey('photo.presetHDR', 'Détails Améliorés (HDR)')}</option>
                    <option value="matte_finish">${tKey('photo.presetMatte', 'Finition Mate')}</option>
                </optgroup>
            </select>
        </div>
        <p style="margin: 10px 0 0; font-size: 10px; opacity: 0.8; line-height: 1.4;">
            ${tKey('photo.applyImmediateHint', 'Aperçu en direct depuis l’image d’origine. OK pour valider, Annuler pour retrouver l’état initial.')}
        </p>
    `;

    // Force "active" scope by default when opening the gallery
    try {
        localStorage.setItem(EFFECT_SCOPE_STORAGE_KEY, 'active');
    } catch (e) { /* ignore */ }

    this.showModal(typeof tKey === 'function' ? tKey('photo.filtersGallery', 'Galerie de Filtres') : 'Galerie de Filtres', contentHtml);
    if (typeof illuSetEffectDialogFooterMode === 'function') illuSetEffectDialogFooterMode('default');
    this._bindEffectScopeButtons();
    this._bindEffectFrameScopeButtons();
    this._galleryPresetId = 'none';
    this.previewInstantFilter('none');
};

/** Calcule ImageData filtre galerie à partir d’une source (snapshot d’ouverture). */
FilterManager._instantFilterImageDataFromSource = function (effectId, src) {
    if (!src || !effectId || effectId === 'none') return null;
    const metadata = (window.IlluImageAdjustCore && window.IlluImageAdjustCore.METADATA) || {};
    const presets = metadata.PRESETS || {};
    const defaultParams = metadata.DEFAULT_PARAMS || {};
    let out = null;
    if (presets[effectId]) {
        const params = Object.assign({}, defaultParams, presets[effectId]);
        params.u_res = [src.width, src.height];
        out = window.illuApplyCameraRawParams ? window.illuApplyCameraRawParams(src, params) : null;
    } else if (effectId === 'grayscale' || effectId === 'sepia' || effectId === 'invert' || effectId === 'autolevel') {
        if (effectId === 'invert') {
            out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
            const data = out.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];
                data[i + 1] = 255 - data[i + 1];
                data[i + 2] = 255 - data[i + 2];
            }
        } else {
            let params = Object.assign({}, defaultParams);
            if (effectId === 'grayscale') params.saturation = -100;
            if (effectId === 'sepia') {
                params.saturation = -50;
                params.temp = 40;
                params.tint = 10;
            }
            if (effectId === 'autolevel' && window.IlluImageAdjustCore?.suggestAutoParams) {
                params = Object.assign(params, window.IlluImageAdjustCore.suggestAutoParams(src));
            }
            out = window.illuApplyCameraRawParams ? window.illuApplyCameraRawParams(src, params) : null;
        }
    }
    return out;
};

FilterManager._blendInstantFilterWithMask = function (out, src, mask) {
    if (!out || !src || !mask || mask.length !== out.data.length / 4) return out;
    const data = out.data;
    const orig = src.data;
    for (let i = 0; i < data.length; i += 4) {
        const m = mask[i / 4];
        if (m === 0) {
            data[i] = orig[i];
            data[i + 1] = orig[i + 1];
            data[i + 2] = orig[i + 2];
            data[i + 3] = orig[i + 3];
        } else if (m < 255) {
            const alpha = m / 255;
            data[i] = orig[i] + (data[i] - orig[i]) * alpha;
            data[i + 1] = orig[i + 1] + (data[i + 1] - orig[i + 1]) * alpha;
            data[i + 2] = orig[i + 2] + (data[i + 2] - orig[i + 2]) * alpha;
        }
    }
    return out;
};

/** Aperçu galerie : toujours depuis le snapshot figé (pas d’empilement). */
FilterManager.previewInstantFilter = function (effectId) {
    this._galleryPresetId = effectId || 'none';
    this._setupEffectTargets();
    if (!this._effectTargets || this._effectTargets.length === 0) return;

    if (effectId === 'none') {
        this._restoreAllLayersFromFrozen();
        const pm = window.PhotoModeManager;
        const pmSnap = (this._frozenSnapshots || []).find((f) => f.id === 'pm-active');
        if (pm && pm.isOpen() && pmSnap && pmSnap.snap) {
            const restored = this._cloneEffectSnapshotData(pmSnap.snap);
            if (restored) pm.updateActivePhotoData(restored);
        }
        if (typeof EditorManager !== 'undefined' && typeof EditorManager.render === 'function') {
            EditorManager.render({ flushUiThumbnails: true });
        }
        return;
    }

    const scope = this._readEffectScope();
    const mask =
        scope === 'selection' && typeof window.rasterizeCurrentSelectionToLayerMask === 'function'
            ? window.rasterizeCurrentSelectionToLayerMask()
            : null;

    this._effectTargets.forEach((target) => {
        const layer = target.layer;
        const backupCanvas = target.backup;
        if (!backupCanvas) return;
        let src = null;
        if (backupCanvas instanceof ImageData) {
            src = backupCanvas;
        } else {
            const bctx = backupCanvas.getContext('2d', { willReadFrequently: true });
            if (!bctx) return;
            src = bctx.getImageData(0, 0, backupCanvas.width, backupCanvas.height);
        }
        if (!src) return;
        let out = this._instantFilterImageDataFromSource(effectId, src);
        if (!out) return;
        out = this._blendInstantFilterWithMask(out, src, mask);
        if (target.isPhotoMode) {
            const pm = window.PhotoModeManager;
            if (pm) pm.updateActivePhotoData(out);
        } else if (layer && layer.buffer) {
            const lctx = layer.buffer.getContext('2d', { willReadFrequently: true });
            if (lctx) {
                lctx.putImageData(out, 0, 0);
                layer.imageData = out;
                if (typeof EditorManager.refreshLayerPreview === 'function') {
                    EditorManager.refreshLayerPreview(layer.id);
                }
            }
        }
    });

    if (typeof EditorManager !== 'undefined' && typeof EditorManager.render === 'function') {
        EditorManager.render({ flushUiThumbnails: true });
    }
};

/** @deprecated Utiliser previewInstantFilter + OK ; conservé pour compat. */
FilterManager.applyInstantFilter = function (effectId) {
    this.previewInstantFilter(effectId);
};
