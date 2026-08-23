/**
 * Trame (demi-teinte) — cœur de traitement, sans dépendance DOM.
 * Utilisable dans le thread principal comme dans un Web Worker.
 *
 * Trame à modulation d'amplitude (« AM screen ») comme en imprimerie : la surface est
 * découpée en cellules régulières inclinées ; chaque cellule reçoit un point circulaire
 * dont l'AIRE est proportionnelle à la quantité d'encre. Les points sont PLEINS : un pixel
 * appartient au point ou non, il n'hérite jamais d'une opacité partielle de l'image.
 * La transparence de la source pilote la couverture d'encre (zone transparente = pas d'encre),
 * jamais l'opacité du point lui-même.
 *
 * Variantes :
 *   - 'bw'    : trame noire classique sur papier
 *   - 'color' : points de la couleur moyenne du pixel (trame couleur simple)
 *   - 'cmyk'  : quadrichromie — 4 trames inclinées (C 15°, M 75°, J 0°, N 45°) superposées
 *               en synthèse soustractive, ce qui recrée les rosaces de l'impression offset.
 */
(function (global) {
    'use strict';

    /** Angles de trame traditionnels de la quadrichromie (degrés). */
    const ILLU_HALFTONE_INK_ANGLES = { c: 15, m: 75, y: 0, k: 45 };

    /**
     * Couleurs des encres process réelles (offset/SWOP), en RVB.
     * Elles ne sont PAS pures : une encre cyan laisse passer du vert et du bleu. C'est ce qui
     * donne les vraies couleurs d'impression quand deux encres se superposent
     * (C+M = violet-bleu, C+J = vert, M+J = rouge), au lieu de couleurs primaires écran.
     */
    const ILLU_HALFTONE_INK_COLORS = {
        c: [0, 158, 224],
        m: [233, 0, 124],
        y: [255, 237, 0],
        k: [26, 23, 27]
    };

    const ILLU_HALFTONE_DEFAULTS = {
        mode: 'bw',        // 'bw' | 'color' | 'cmyk'
        cell: 6,           // pas de trame en pixels (déjà mis à l'échelle de l'aperçu)
        angle: 45,         // inclinaison de la trame (degrés) — décalage global en CMJN
        paper: 'white',    // 'white' | 'transparent'
        useBlack: true,    // CMJN : imprimer l'encre noire (sinon CMJ seul)
        invert: false,     // trame en négatif (encre là où l'image est claire)
        // Densité (intensité) de chaque encre : 1 = normal, <1 encre plus claire (points plus
        // petits), >1 encre plus chargée. Comme régler les encriers d'une presse.
        densityC: 1,
        densityM: 1,
        densityY: 1,
        densityK: 1,
        // Engraissement du point (dot gain) : l'encre s'étale sur le papier, les points
        // impriment plus gros que le nominal. 0 = aucun, 1 = fort (papier très absorbant).
        dotGain: 0,
        inkColors: null    // surcharge éventuelle des couleurs d'encre
    };

    function clamp01(v) {
        return v < 0 ? 0 : v > 1 ? 1 : v;
    }

    /** Applique densité puis engraissement à une couverture d'encre. */
    function inkCoverage(cov, density, gain) {
        let v = clamp01(cov * (density == null ? 1 : density));
        if (gain > 0 && v > 0 && v < 1) v = Math.pow(v, 1 / (1 + gain));
        return v;
    }

    /**
     * Point plein d'une cellule inclinée : vrai si (x, y) tombe dans le disque de la cellule.
     * L'aire du disque est proportionnelle à la couverture → rayon ∝ √couverture.
     * Les coordonnées sont absolues : le résultat est identique quel que soit le découpage
     * en tranches entre workers.
     */
    function inkDot(x, y, cos, sin, cell, coverage) {
        if (coverage <= 0.001) return false;
        if (coverage >= 0.999) return true;
        const u = x * cos + y * sin;
        const v = -x * sin + y * cos;
        const du = u - Math.round(u / cell) * cell;
        const dv = v - Math.round(v / cell) * cell;
        // rayon maximal : le disque circonscrit à la cellule (couverture totale)
        const rMax = cell * 0.7071067811865476;
        const r = rMax * Math.sqrt(coverage);
        return du * du + dv * dv <= r * r;
    }

    /**
     * @param {Uint8ClampedArray} src  pixels RGBA source (lecture seule)
     * @param {number} w
     * @param {number} h
     * @param {object} opts  voir ILLU_HALFTONE_DEFAULTS
     * @param {number} startY  première ligne à calculer (tranche worker)
     * @param {number} endY    ligne de fin (exclue)
     * @param {function} [onProgress]  (percent) => void
     * @returns {Uint8ClampedArray} pixels RGBA résultat (copie de la source hors tranche)
     */
    function illuApplyHalftone(src, w, h, opts, startY, endY, onProgress) {
        const o = Object.assign({}, ILLU_HALFTONE_DEFAULTS, opts || {});
        const out = new Uint8ClampedArray(src);
        const cell = Math.max(2, o.cell || 6);
        const sy = Math.max(0, startY | 0);
        const ey = Math.min(h, endY == null ? h : endY | 0);
        const keepPaper = o.paper !== 'transparent';
        const inv = !!o.invert;

        // Densités par encre, engraissement et couleurs d'encre.
        const density = {
            c: o.densityC == null ? 1 : o.densityC,
            m: o.densityM == null ? 1 : o.densityM,
            y: o.densityY == null ? 1 : o.densityY,
            k: o.densityK == null ? 1 : o.densityK
        };
        const gain = Math.max(0, o.dotGain || 0);
        const inkCols = Object.assign({}, ILLU_HALFTONE_INK_COLORS, o.inkColors || {});

        // Trames : une par encre en CMJN, une seule sinon.
        const base = (o.angle || 0) * Math.PI / 180;
        const screens = [];
        if (o.mode === 'cmyk') {
            const inks = o.useBlack ? ['c', 'm', 'y', 'k'] : ['c', 'm', 'y'];
            for (const ink of inks) {
                const a = base + ILLU_HALFTONE_INK_ANGLES[ink] * Math.PI / 180;
                screens.push({ ink, cos: Math.cos(a), sin: Math.sin(a) });
            }
        } else {
            screens.push({ ink: 'k', cos: Math.cos(base), sin: Math.sin(base) });
        }

        const total = Math.max(1, ey - sy);
        for (let y = sy; y < ey; y++) {
            if (onProgress && (y - sy) % 32 === 0) {
                onProgress(Math.round(((y - sy) / total) * 100));
            }
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const a = src[i + 3] / 255;

                // Hors du calque : rien n'est imprimé, la transparence est conservée.
                if (a <= 0) {
                    out[i] = out[i + 1] = out[i + 2] = 0;
                    out[i + 3] = 0;
                    continue;
                }

                // L'encre se calcule sur l'image composée sur papier blanc : une zone
                // semi-transparente imprime plus clair (points plus petits), jamais en demi-teinte.
                const r = src[i] * a + 255 * (1 - a);
                const g = src[i + 1] * a + 255 * (1 - a);
                const b = src[i + 2] * a + 255 * (1 - a);

                let outR = 255, outG = 255, outB = 255;
                let inked = false;

                if (o.mode === 'cmyk') {
                    // RVB → CMJN (avec retrait de noir), puis une trame inclinée par encre.
                    const rn = r / 255, gn = g / 255, bn = b / 255;
                    let k = 1 - Math.max(rn, gn, bn);
                    let c = 0, m = 0, yy = 0;
                    if (k < 0.999) {
                        c = (1 - rn - k) / (1 - k);
                        m = (1 - gn - k) / (1 - k);
                        yy = (1 - bn - k) / (1 - k);
                    }
                    if (!o.useBlack) {
                        // Sans encre noire : le noir est reporté sur les trois encres.
                        c = Math.min(1, c * (1 - k) + k);
                        m = Math.min(1, m * (1 - k) + k);
                        yy = Math.min(1, yy * (1 - k) + k);
                        k = 0;
                    }
                    const cov = { c: c, m: m, y: yy, k: k };
                    // Papier blanc = transmittance 1 ; chaque encre déposée la multiplie
                    // (synthèse soustractive réelle), donc les superpositions donnent les
                    // vraies couleurs d'impression au lieu de primaires écran saturées.
                    let tr = 1, tg = 1, tb = 1;
                    for (let s = 0; s < screens.length; s++) {
                        const sc = screens[s];
                        let cv = inkCoverage(cov[sc.ink], density[sc.ink], gain);
                        if (inv) cv = 1 - cv;
                        if (!inkDot(x, y, sc.cos, sc.sin, cell, cv)) continue;
                        inked = true;
                        const ic = inkCols[sc.ink];
                        tr *= ic[0] / 255;
                        tg *= ic[1] / 255;
                        tb *= ic[2] / 255;
                    }
                    if (inked) {
                        outR = 255 * tr;
                        outG = 255 * tg;
                        outB = 255 * tb;
                    }
                } else {
                    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    let cov = inkCoverage(1 - luma, density.k, gain);
                    if (inv) cov = 1 - cov;
                    const sc = screens[0];
                    if (inkDot(x, y, sc.cos, sc.sin, cell, cov)) {
                        inked = true;
                        if (o.mode === 'color') {
                            outR = src[i];
                            outG = src[i + 1];
                            outB = src[i + 2];
                        } else {
                            outR = outG = outB = 0;
                        }
                    }
                }

                if (inked) {
                    // Point plein : toujours 100 % opaque.
                    out[i] = outR;
                    out[i + 1] = outG;
                    out[i + 2] = outB;
                    out[i + 3] = 255;
                } else if (keepPaper) {
                    out[i] = 255;
                    out[i + 1] = 255;
                    out[i + 2] = 255;
                    out[i + 3] = 255;
                } else {
                    out[i] = out[i + 1] = out[i + 2] = 0;
                    out[i + 3] = 0;
                }
            }
        }
        return out;
    }

    /** Lit les réglages de la modale (ids ef-half-*) → options du cœur. `scale` = échelle d'aperçu. */
    function illuHalftoneOptsFromVals(vals, scale) {
        const num = (id, fb) => {
            const v = vals ? vals[id] : undefined;
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : fb;
        };
        const s = scale && scale > 0 ? scale : 1;
        return {
            mode: (vals && vals['ef-half-mode']) || 'bw',
            cell: Math.max(2, Math.round(num('ef-half-rad', 4) * 1.5 * s)),
            angle: num('ef-half-angle', 45),
            paper: (vals && vals['ef-half-paper']) || 'white',
            useBlack: !vals || vals['ef-half-k'] !== '0',
            invert: !!(vals && vals['ef-half-invert'] === '1'),
            // Intensités d'encre en % (100 = normal) et engraissement du point en %.
            densityC: num('ef-half-dc', 100) / 100,
            densityM: num('ef-half-dm', 100) / 100,
            densityY: num('ef-half-dy', 100) / 100,
            densityK: num('ef-half-dk', 100) / 100,
            dotGain: num('ef-half-gain', 0) / 100
        };
    }

    global.ILLU_HALFTONE_DEFAULTS = ILLU_HALFTONE_DEFAULTS;
    global.ILLU_HALFTONE_INK_ANGLES = ILLU_HALFTONE_INK_ANGLES;
    global.ILLU_HALFTONE_INK_COLORS = ILLU_HALFTONE_INK_COLORS;
    global.illuApplyHalftone = illuApplyHalftone;
    global.illuHalftoneOptsFromVals = illuHalftoneOptsFromVals;

})(typeof self !== 'undefined' ? self : window);
