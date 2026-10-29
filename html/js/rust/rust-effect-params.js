/**
 * rust-effect-params.js — traduit les réglages des dialogues d'effets (valeurs des
 * <input id="ef-…">) en tableau de paramètres pour le moteur Rust.
 *
 * Partagé par la page (FilterManager) et les workers (filter-worker.js).
 *   MasterPaintRustParams.build(effect, vals, ps, extra) → Float32Array | null
 *     vals  : { 'ef-xxx': '12', … } (chaînes, comme lues dans le DOM)
 *     ps    : échelle d'aperçu (≤ 1) — les longueurs en pixels sont mises à l'échelle
 *     extra : { hsvMixParams, cbParams, seed }
 *   null = configuration non gérée par Rust → repli sur le moteur JS existant.
 *
 * L'ordre des paramètres de chaque effet est documenté dans rust/masterpaint-core/src/fx_*.rs.
 */
(function (global) {
    'use strict';

    function num(v, d) {
        if (v === undefined || v === null || v === '') return d;
        if (v === true) return 1;
        if (v === false) return 0;
        const n = parseFloat(String(v).replace(',', '.'));
        return Number.isFinite(n) ? n : d;
    }
    function hex(s, d) {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(s || '').trim());
        return m ? parseInt(m[1], 16) : d;
    }
    function bool(v, d) {
        if (v === undefined || v === null || v === '') return d ? 1 : 0;
        return v === true || v === '1' || v === 'true' || v === 1 ? 1 : 0;
    }

    /** Effets dont le rendu ne peut pas être découpé en bandes indépendantes. */
    const SINGLE_CHUNK = new Set(['quantize', 'ral', 'vhs']);

    function build(effect, vals, ps, extra) {
        vals = vals || {};
        extra = extra || {};
        ps = ps > 0 && ps < 1 ? ps : 1;
        const g = (id, d) => num(vals[id], d);
        const pxU = (v) => v * ps;
        const pxInt = (v) => Math.max(1, Math.round(pxU(v)));
        const pxRad = (v) => (v < 1 ? 0 : Math.max(1, Math.round(pxU(v))));
        const seed = (extra.seed >>> 0) || 1;

        switch (effect) {
            case 'brightness':
                return [g('ef-b', g('ef-br', 0)), g('ef-c', g('ef-co', 0)), g('ef-bc-temp', 0), g('ef-bc-tint', 0)];
            case 'grayscale': case 'invert': case 'invertalpha': case 'sepia':
            case 'autolevel': case 'cmjn': case 'mirrorquad':
                return [];
            case 'exposure': return [g('ef-exp', 100), g('ef-gamma', 100)];
            case 'posterize': return [Math.max(2, g('ef-lvl', 4))];
            case 'threshold': return [g('ef-thr', 128)];
            case 'solarize': return [g('ef-sol', 128)];
            case 'hsv': {
                const pm = extra.hsvMixParams || {};
                const arr = (a) => Array.from({ length: 8 }, (_, i) => num(a && a[i], 0));
                const mix = [arr(pm.hslHue), arr(pm.hslSat), arr(pm.hslLum)].flat();
                const hasMix = mix.some((v) => v !== 0);
                return [g('ef-h', 0), g('ef-s', 0), g('ef-l', 0), hasMix ? 1 : 0, ...mix];
            }
            case 'vibrance': return [g('ef-vibr', 50)];
            case 'temptint': return [g('ef-tt-temp', 0), g('ef-tt-tint', 0)];
            case 'temperature': return [g('ef-temp', 0)];
            case 'colorbal': {
                const cb = extra.cbParams || {};
                const hasP = (a) => a && a.length >= 2;
                const curves = [cb.curveMaster, cb.curveR, cb.curveG, cb.curveB];
                const any = curves.some(hasP);
                const head = [g('ef-cb-r', 0), g('ef-cb-g', 0), g('ef-cb-b', 0), any ? 1 : 0];
                if (!any) return head;
                const core = global.IlluImageAdjustCore;
                if (!core || typeof core.createCurveLUT !== 'function') return null;
                const ident = Array.from({ length: 256 }, (_, i) => i);
                for (const c of curves) {
                    const lut = hasP(c) ? core.createCurveLUT(c) : ident;
                    for (let i = 0; i < 256; i++) head.push(num(lut[i], i));
                }
                return head;
            }
            case 'duotone':
                return [hex(vals['ef-duo-c1'], 0x1a0533), hex(vals['ef-duo-c2'], 0xfff5e0), g('ef-duo-mid', 128)];
            case 'highlightsshadows':
                return [g('ef-hs-shadows', 30), g('ef-hs-highlights', 0), Math.max(1, pxU(g('ef-hs-radius', 25))), g('ef-hs-clarity', 0)];
            case 'quantize': return [g('ef-q-colors', 16), g('ef-q-dither', 50)];
            case 'ral': {
                let colors = global.RAL_COLORS || [];
                const cat = vals['ef-ral-category'] || 'all';
                const pre = { yellow: 1, orange: 2, red: 3, violet: 4, blue: 5, green: 6, grey: 7, brown: 8, 'white-black': 9 }[cat];
                if (pre && colors.length) {
                    const f = colors.filter((c) => String(c.code).startsWith('RAL ' + pre));
                    if (f.length) colors = f;
                }
                if (!colors.length) return null;
                const out = [g('ef-ral-dither', 0), colors.length];
                for (const c of colors) out.push(c.r, c.g, c.b);
                return out;
            }
            case 'blur': case 'gaussian': return [pxRad(g('ef-rad', 2))];
            case 'median': return [Math.max(1, pxRad(g('ef-med-rad', 10))), g('ef-med-pct', 50)];
            case 'reducenoise': return [Math.min(20, pxRad(g('ef-rn-radius', 10)) || 1), g('ef-rn-strength', 40)];
            case 'unfocus': return [pxRad(g('ef-unfocus-r', 8)) || 1, g('ef-unfocus-hl', 55)];
            case 'motionblur':
                return [g('ef-mblur-angle', 25), Math.max(1, Math.round(pxU(g('ef-mblur-dist', 10)))), bool(vals['ef-mblur-center'], true)];
            case 'surfaceblur': return [pxRad(g('ef-sblur-r', 6)) || 1, g('ef-sblur-t', 15)];
            case 'fragment': return [g('ef-frag-n', 4), Math.round(pxU(g('ef-frag-d', 8))), g('ef-frag-r', 0)];
            case 'radialblur':
                return [g('ef-rblur-angle', 2), g('ef-rblur-quality', 2), g('ef-rblur-ox', 0), g('ef-rblur-oy', 0), g('ef-rblur-inner', 0)];
            case 'zoomblur':
                return [g('ef-zblur-amount', 10), g('ef-zblur-ox', 0), g('ef-zblur-oy', 0), g('ef-zblur-inner', 0)];
            case 'sketchblur': return [Math.max(1, pxU(g('ef-skb-r', 10))), g('ef-skb-var', 50), g('ef-skb-seed', 0)];
            case 'bulge': return [g('ef-bulge', 40)];
            case 'pinch': return [g('ef-pinch', 40)];
            case 'twist': return [g('ef-twist', 30)];
            case 'polarInvert': return [g('ef-polar', 80)];
            case 'tileReflect': return [Math.max(4, pxInt(g('ef-tile', 24)))];
            case 'wave': return [pxU(g('ef-wave-a', 12)), g('ef-wave-f', 14)];
            case 'chromatic': return [pxInt(g('ef-chr', 6))];
            case 'crystallize': return [Math.max(2, pxInt(g('ef-cry', 12))), g('ef-cry-seed', seed & 0xffff)];
            case 'pixelate': return [pxInt(g('ef-size', 10))];
            case 'frosted': return [pxU(g('ef-frost', 8)), g('ef-frost-q', 2), seed & 0xffff];
            case 'dents':
                return [g('ef-dent-scale', 25), g('ef-dent-refr', 50), g('ef-dent-rough', 10), g('ef-dent-tension', 10), g('ef-dent-seed', 0)];
            case 'cabossage':
                return [g('ef-cab-scale', 25), g('ef-cab-refr', 50), g('ef-cab-rough', 10), g('ef-cab-tension', 10), g('ef-cab-q', 2),
                    num(vals._cabossageSeed, 0x9e3779b9) >>> 0];
            case 'projection3d':
                return [g('ef-3d-rx', 0), g('ef-3d-ry', 0), Math.max(80, Math.min(800, Math.round(pxU(g('ef-3d-f', 280))))), g('ef-3d-z', 100),
                    g('ef-3d-tl', 0), g('ef-3d-tr', 0), g('ef-3d-br', 0), g('ef-3d-bl', 0)];
            case 'rotatezoom':
                return [g('ef-rz-angle', 0), g('ef-rz-panx', 0) / 100, g('ef-rz-pany', 0) / 100, g('ef-rz-zoom', 100) / 100, bool(vals['ef-rz-tile'], false)];
            case 'straighten': return [g('ef-str-angle', 0)];
            case 'edges': return [g('ef-edge', 40)];
            case 'emboss': return [g('ef-emb-angle', 0)];
            case 'relief': return [g('ef-relief-angle', 45)];
            case 'outline': return [Math.max(1, pxRad(g('ef-ol-thick', 3))), g('ef-ol-int', 50)];
            case 'morphology': return [g('ef-mo-mode', 0), Math.max(1, pxRad(g('ef-mo-r', 3))), g('ef-mo-shape', 0)];
            case 'oil': return [pxInt(g('ef-oil', 4)), g('ef-oil-coarse', 50)];
            case 'sketch': return [g('ef-ink', 50), g('ef-ink-color', 50)];
            case 'pencilsketch': return [pxRad(g('ef-pencil-tip', 2)) || 1, g('ef-pencil-range', 0)];
            case 'sharpen': return [g('ef-sharp', 45), Math.max(1, pxRad(g('ef-sharp-r', 1)))];
            case 'unsharp': return [g('ef-us-amount', 80), Math.max(1, pxRad(g('ef-us-radius', 3))), g('ef-us-threshold', 0)];
            case 'softglow': return [Math.max(1, pxRad(g('ef-glow-r', 6))), g('ef-glow-a', 40)];
            case 'softenportrait': {
                const s = g('ef-soft-softness', 5);
                return [pxU(s), g('ef-soft-lighting', 0), g('ef-soft-warmth', 10)];
            }
            case 'vignette':
                return [g('ef-vig', 50), hex(vals['ef-vig-color'], 0), g('ef-vig-blend', 0), g('ef-vig-cx', 0), g('ef-vig-cy', 0)];
            case 'redeyeremove': return [g('ef-redeye-tol', 70), g('ef-redeye-sat', 90)];
            case 'addnoise':
                if (vals['ef-noise-int'] === undefined) return [g('ef-int', 20) * 0.8, 0, 100, seed];
                return [g('ef-noise-int', 64), g('ef-noise-sat', 100), g('ef-noise-cov', 100), seed];
            case 'argenticgrain': case 'filmgrain': return [g('ef-grain', 40) * 1.28, seed];
            case 'digitalpattern': return [g('ef-grain', 40), pxInt(g('ef-grain-fine', 15)), 0x2b7e1516];
            case 'clouds':
                return [Math.max(1, pxU(g('ef-clouds-scale', 250))), g('ef-clouds-power', 50), g('ef-clouds-seed', 0),
                    hex(vals['ef-clouds-from'], 0), hex(vals['ef-clouds-to'], 0xffffff), g('ef-clouds-blend', 0)];
            case 'turbulence':
                return [Math.max(1, pxU(g('ef-tb-scale', 200))), g('ef-tb-oct', 6), g('ef-tb-rough', 50), g('ef-tb-seed', 0),
                    hex(vals['ef-tb-from'], 0), hex(vals['ef-tb-to'], 0xffffff), g('ef-tb-blend', 0), g('ef-tb-noise', 0)];
            case 'mandelbrot':
                return [g('ef-mb-factor', 1), g('ef-mb-angle', 0), g('ef-mb-quality', 2), g('ef-mb-zoom', 10), bool(vals['ef-mb-invert'], false)];
            case 'julia':
                return [g('ef-jl-factor', 4), g('ef-jl-angle', 0), g('ef-jl-quality', 2), g('ef-jl-zoom', 4)];
            case 'contour': {
                const mode = { outside: 0, inside: 1, both: 2 }[vals['ef-contour-mode'] || 'outside'] ?? 0;
                const corner = (vals['ef-contour-corner'] || 'round') === 'round' ? 0 : 1;
                return [pxInt(g('ef-contour-width', 3)), hex(vals['ef-contour-color'], 0xff0000), g('ef-contour-opacity', 100), mode, corner];
            }
            case 'dropshadow':
                return [Math.round(pxU(g('ef-ds-ox', 4))), Math.round(pxU(g('ef-ds-oy', 6))), pxRad(g('ef-ds-blur', 10)), g('ef-ds-op', 45),
                    hex(vals['ef-ds-color'], 0)];
            /* Plugins Paint.NET (BoltBait, Vandermotten) — rust/masterpaint-core/src/fx_plugins.rs */
            case 'dream': return [pxU(g('ef-dream-r', 10)), bool(vals['ef-dream-vig'], true)];
            case 'removedust': return [g('ef-dust-mode', 0)];
            case 'gridcheck':
                return [g('ef-gc-mode', 0), Math.max(1, Math.round(pxU(g('ef-gc-size', 33)))), Math.max(1, Math.round(pxU(g('ef-gc-width', 1)))),
                    hex(vals['ef-gc-color'], 0), g('ef-gc-bg', 0), hex(vals['ef-gc-color2'], 0xffffff), bool(vals['ef-gc-swap'], false)];
            case 'fadeedge': return [g('ef-fe-shape', 0), Math.round(pxU(g('ef-fe-width', 20))), g('ef-fe-power', 1)];
            case 'coloraccent': return [hex(vals['ef-ca-color'], 0xff0000), g('ef-ca-tol', 10)];
            case 'transparency': {
                const em = global.EditorManager;
                const c = em && em.secondaryColor;
                const sec = c ? (c.r << 16) | (c.g << 8) | c.b : 0xffffff;
                return [g('ef-tr-adj', 0), bool(vals['ef-tr-ignore'], false), bool(vals['ef-tr-replace'], false), sec];
            }
            case 'featherobj': return [Math.round(pxU(g('ef-fo-r', 1)))];
            case 'pastel':
                return [g('ef-pa-brush', 3), g('ef-pa-coarse', 50), g('ef-pa-pencil', 50), pxRad(g('ef-pa-tip', 2)) || 1];
            case 'chroma': {
                // mêmes valeurs par défaut que ChromaKeyer.computeMatte (sémantique `||`)
                const c = (id) => Math.max(0, Math.min(255, g(id, 0)));
                const use2 = bool(vals['ef-ch-use2'], false) && vals['ef-ch-r2'] !== undefined;
                return [
                    c('ef-ch-r'), c('ef-ch-g'), c('ef-ch-b'),
                    g('ef-ch-tol', 0) || 30, g('ef-ch-drift', 0) || 50, g('ef-ch-feather', 0) || 15,
                    g('ef-ch-black', 0), g('ef-ch-white', 0) || 100, Math.max(0.1, g('ef-ch-gamma', 0) || 1),
                    g('ef-ch-spill', 0), 0, g('ef-ch-luma', 0),
                    use2 ? 1 : 0, use2 ? c('ef-ch-r2') : 0, use2 ? c('ef-ch-g2') : 0, use2 ? c('ef-ch-b2') : 0,
                    0
                ];
            }
            default:
                return null;
        }
    }

    global.MasterPaintRustParams = {
        SINGLE_CHUNK,
        build(effect, vals, ps, extra) {
            const r = build(effect, vals, ps, extra);
            return r ? Float32Array.from(r) : null;
        },
        /** Le rendu Rust de cet effet peut-il être réparti entre plusieurs workers ? */
        chunkable(effect, vals) {
            if (effect === 'ral') return num((vals || {})['ef-ral-dither'], 0) <= 0;
            if (effect === 'quantize') return num((vals || {})['ef-q-dither'], 50) <= 0;
            return !SINGLE_CHUNK.has(effect);
        }
    };
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
