/**
 * Effet VHS (port depuis VIDEO/js/vhs-effect.js).
 * buffer : Uint8Array ou Uint8ClampedArray (RGBA ligne par ligne).
 */
(function () {
    // Les constantes ILLU_VHS_DEFAULTS, ILLU_VHS_PRESETS et les fonctions cœurs
    // sont désormais chargées depuis vhs-core.js (indispensable pour le Worker).


    /** Paramètres lus depuis les curseurs (identiques aux clés ILLU_VHS_DEFAULTS). */
    const VHS_DOM_PARAM_KEYS = [
        'chroma_bleed',
        'chroma_blur',
        'chroma_saturation',
        'noise_intensity_y',
        'noise_intensity_c',
        'glitch_intensity',
        'jitter_amp',
        'head_switch_rows',
        'crop_padding',
        'crop_feather',
        'shift_y',
        'shift_r',
        'shift_g',
        'shift_b',
        'luma_contrast',
        'luma_brightness',
        'chroma_phase'
    ];

    window.illuBuildVhsParams = function () {
        const hid = document.getElementById('ef-vhs-preset');
        const name = (hid && hid.value) || 'default';
        const preset = window.ILLU_VHS_PRESETS[name] || window.ILLU_VHS_PRESETS.default;
        const base = JSON.parse(JSON.stringify(preset));
        for (let i = 0; i < VHS_DOM_PARAM_KEYS.length; i++) {
            const k = VHS_DOM_PARAM_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            if (!el || el.value === '') continue;
            const num = parseFloat(el.value);
            if (Number.isFinite(num)) base[k] = num;
        }
        return base;
    };

    window.illuVhsApplyPreset = function (name) {
        const hid = document.getElementById('ef-vhs-preset');
        if (hid) hid.value = name;
        const preset = window.ILLU_VHS_PRESETS[name] || window.ILLU_VHS_PRESETS.default;
        for (let i = 0; i < VHS_DOM_PARAM_KEYS.length; i++) {
            const k = VHS_DOM_PARAM_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            if (!el || preset[k] === undefined) continue;
            el.value = String(preset[k]);
            const lab = document.getElementById('ef-vhs-' + k + '-val');
            if (lab) {
                if (k === 'luma_contrast') lab.textContent = Number(el.value).toFixed(2);
                else lab.textContent = el.value;
            }
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
        for (let i = 0; i < VHS_DOM_PARAM_KEYS.length; i++) {
            const k = VHS_DOM_PARAM_KEYS[i];
            const el = document.getElementById('ef-vhs-' + k);
            const lab = document.getElementById('ef-vhs-' + k + '-val');
            if (!el || !lab) continue;
            if (k === 'luma_contrast') lab.textContent = Number(el.value).toFixed(2);
            else lab.textContent = el.value;
        }
        const pm = document.getElementById('ef-vhs-preview_max');
        const pml = document.getElementById('ef-vhs-preview_max-val');
        if (pm && pml) pml.textContent = pm.value;
    };
})();
