/**
 * Effet VHS (port depuis VIDEO/js/vhs-effect.js).
 * buffer : Uint8Array ou Uint8ClampedArray (RGBA ligne par ligne).
 */
(function () {
    // Les constantes ILLU_VHS_DEFAULTS, ILLU_VHS_PRESETS et les fonctions cœurs
    // sont désormais chargées depuis vhs-core.js (indispensable pour le Worker).


    /** Curseurs numériques (clés identiques à ILLU_VHS_DEFAULTS, préfixées par ef-vhs-). */
    const VHS_DOM_NUM_KEYS = [
        'crop_padding',
        'crop_feather',
        'pixel_size',
        'band_patina',
        'jpeg_quality',
        'luma_contrast',
        'luma_brightness',
        'chroma_phase',
        'chroma_saturation',
        'edge_sat',
        'hs_sat',
        'shadow_sat',
        'cast_r',
        'cast_g',
        'cast_b',
        'shift_y',
        'shift_r',
        'shift_g',
        'shift_b',
        'chroma_blur',
        'chroma_bleed',
        'luma_smear',
        'right_pink',
        'right_pink_width',
        'noise_intensity_y',
        'noise_intensity_c',
        'glitch_intensity',
        'jitter_amp',
        'jitter_freq',
        'head_switch_rows',
        'head_switch_pull',
        'head_switch_freq',
        'head_switch_wave',
        'head_switch_noise',
        'hs_color_tear',
        'tear_max_height',
        'tear_length',
        'tear_thickness',
        'dropout_chance',
        'dropout_len',
        'dropout_thickness'
    ];

    /** Cases à cocher (true/false). */
    const VHS_DOM_BOOL_KEYS = [
        'enable_y',
        'enable_r',
        'enable_g',
        'enable_b',
        'apply_color_cast',
        'apply_jpeg',
        'glitch_jitter',
        'glitch_dropouts',
        'glitch_tears',
        'glitch_noise'
    ];

    /** Listes déroulantes (valeur texte). */
    const VHS_DOM_SELECT_KEYS = [
        'tear_color'
    ];

    /** Clés affichées avec deux décimales dans leur étiquette. */
    const VHS_TWO_DECIMALS = ['luma_contrast', 'band_patina', 'right_pink_width'];

    function vhsFormatLabel(key, value) {
        if (VHS_TWO_DECIMALS.indexOf(key) !== -1) return Number(value).toFixed(2);
        return String(value);
    }

    window.illuBuildVhsParams = function () {
        const hid = document.getElementById('ef-vhs-preset');
        const name = (hid && hid.value) || 'default';
        const preset = window.ILLU_VHS_PRESETS[name] || window.ILLU_VHS_PRESETS.default;
        const base = JSON.parse(JSON.stringify(preset));

        for (let i = 0; i < VHS_DOM_NUM_KEYS.length; i++) {
            const k = VHS_DOM_NUM_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            if (!el || el.value === '') continue;
            const num = parseFloat(el.value);
            if (Number.isFinite(num)) base[k] = num;
        }
        for (let i = 0; i < VHS_DOM_BOOL_KEYS.length; i++) {
            const k = VHS_DOM_BOOL_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            if (!el) continue;
            base[k] = !!el.checked;
        }
        for (let i = 0; i < VHS_DOM_SELECT_KEYS.length; i++) {
            const k = VHS_DOM_SELECT_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            if (!el || el.value === '') continue;
            base[k] = el.value;
        }
        return base;
    };

    window.illuVhsApplyPreset = function (name) {
        const hid = document.getElementById('ef-vhs-preset');
        if (hid) hid.value = name;
        const preset = window.ILLU_VHS_PRESETS[name] || window.ILLU_VHS_PRESETS.default;

        for (let i = 0; i < VHS_DOM_NUM_KEYS.length; i++) {
            const k = VHS_DOM_NUM_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            if (!el || preset[k] === undefined) continue;
            el.value = String(preset[k]);
            const lab = document.getElementById('ef-vhs-' + k + '-val');
            if (lab) lab.textContent = vhsFormatLabel(k, el.value);
        }
        for (let i = 0; i < VHS_DOM_BOOL_KEYS.length; i++) {
            const k = VHS_DOM_BOOL_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            if (!el || preset[k] === undefined) continue;
            el.checked = !!preset[k];
        }
        for (let i = 0; i < VHS_DOM_SELECT_KEYS.length; i++) {
            const k = VHS_DOM_SELECT_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            if (!el || preset[k] === undefined) continue;
            el.value = String(preset[k]);
        }

        if (typeof window.FilterManager !== 'undefined' && typeof window.FilterManager.preview === 'function') {
            window.FilterManager.preview();
        }
    };

    window.illuVhsInitDialog = function () {
        const hid = document.getElementById('ef-vhs-preset');
        const name = (hid && hid.value) || 'default';
        window.illuVhsApplyPreset(name);
    };

    window.illuVhsSyncSliderLabels = function () {
        for (let i = 0; i < VHS_DOM_NUM_KEYS.length; i++) {
            const k = VHS_DOM_NUM_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            const lab = document.getElementById('ef-vhs-' + k + '-val');
            if (!el || !lab) continue;
            lab.textContent = vhsFormatLabel(k, el.value);
        }
        const pm = document.getElementById('ef-vhs-preview_max');
        const pml = document.getElementById('ef-vhs-preview_max-val');
        if (pm && pml) pml.textContent = pm.value;
    };
})();
