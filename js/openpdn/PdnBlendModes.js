/**
 * Modes de fusion Paint.NET (UserBlendOps) → équivalents MasterPaint / CSS.
 * Formules PDN dans OpenPDN-master/src/Data/UserBlendOps.Generated.cs
 */
(function (global) {
    'use strict';

    /** Nom sérialisé .NET ou libellé → mode MasterPaint (globalCompositeOperation / mix-blend-mode) */
    const PDN_TO_MASTERPAINT = {
        normal: 'source-over',
        normalblendop: 'source-over',
        multiply: 'multiply',
        multiplyblendop: 'multiply',
        screen: 'screen',
        screenblendop: 'screen',
        overlay: 'overlay',
        overlayblendop: 'overlay',
        darken: 'darken',
        darkenblendop: 'darken',
        lighten: 'lighten',
        lightenblendop: 'lighten',
        colorburn: 'color-burn',
        colorburnblendop: 'color-burn',
        colordodge: 'color-dodge',
        colordodgeblendop: 'color-dodge',
        difference: 'difference',
        differenceblendop: 'difference',
        additive: 'lighter',
        additiveblendop: 'lighter',
        xor: 'xor',
        xorblendop: 'xor',
        reflect: 'overlay',
        reflectblendop: 'overlay',
        glow: 'screen',
        glowblendop: 'screen',
        negation: 'exclusion',
        negationblendop: 'exclusion'
    };

    const MASTERPAINT_MODES = [
        'source-over',
        'multiply',
        'screen',
        'overlay',
        'darken',
        'lighten',
        'color-dodge',
        'color-burn',
        'hard-light',
        'soft-light',
        'difference',
        'exclusion',
        'hue',
        'saturation',
        'color',
        'luminosity',
        'lighter',
        'xor'
    ];

    function normalizeKey(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function mapPdnBlendToMasterPaint(pdnName, fallback) {
        const k = normalizeKey(pdnName);
        if (PDN_TO_MASTERPAINT[k]) return PDN_TO_MASTERPAINT[k];
        if (MASTERPAINT_MODES.includes(pdnName)) return pdnName;
        return fallback || 'source-over';
    }

    const PdnBlendModes = {
        PDN_TO_MASTERPAINT,
        MASTERPAINT_MODES,
        mapPdnBlendToMasterPaint,
        normalizeKey
    };

    global.PdnBlendModes = PdnBlendModes;
})(typeof window !== 'undefined' ? window : globalThis);
