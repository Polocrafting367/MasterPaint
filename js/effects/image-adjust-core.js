(function (global) {
    'use strict';

    function clamp255(x) {
        return Math.max(0, Math.min(255, x | 0));
    }

    function clamp01(x) {
        return Math.max(0, Math.min(1, x));
    }

    function parseGamma(g) {
        let out = parseFloat(String(g != null ? g : 1));
        if (!Number.isFinite(out) || out < 0.01) out = 0.01;
        if (out > 9.99) out = 9.99;
        return out;
    }

    const SRGB_TO_LIN = new Float32Array(256);
    const LIN_TO_SRGB = new Uint8Array(4096);

    for (let i = 0; i < 256; i++) {
        let c = i / 255;
        SRGB_TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    for (let i = 0; i < 4096; i++) {
        let x = i / 4095;
        const y = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
        LIN_TO_SRGB[i] = clamp255(y * 255);
    }

    function fastLinToSrgbByte(x) {
        if (x <= 0) return 0;
        if (x >= 1) return 255;
        return LIN_TO_SRGB[(x * 4095) | 0];
    }

    // Convertit RGB (0-255) vers HSL (H: 0-360, S: 0-100, L: 0-100) pour un contrôle Pro
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        }
        return { h: h, s: s * 100, l: l * 100 };
    }

    // Convertit HSL vers RGB (0-255)
    function hslToRgb(h, s, l) {
        s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            h /= 360;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return { r: clamp255(r * 255), g: clamp255(g * 255), b: clamp255(b * 255) };
    }

    // Pondération ultra-rapide pour le HSL sélectif (8 teintes)
    function getHslWeightsFast(h) {
        if (h < 30) return { i1: 0, i2: 1, w1: 1 - h / 30, w2: h / 30 }; // Red to Orange
        if (h < 60) return { i1: 1, i2: 2, w1: 1 - (h - 30) / 30, w2: (h - 30) / 30 }; // Orange to Yellow
        if (h < 120) return { i1: 2, i2: 3, w1: 1 - (h - 60) / 60, w2: (h - 60) / 60 }; // Yellow to Green
        if (h < 180) return { i1: 3, i2: 4, w1: 1 - (h - 120) / 60, w2: (h - 120) / 60 }; // Green to Aqua
        if (h < 240) return { i1: 4, i2: 5, w1: 1 - (h - 180) / 60, w2: (h - 180) / 60 }; // Aqua to Blue
        if (h < 280) return { i1: 5, i2: 6, w1: 1 - (h - 240) / 40, w2: (h - 240) / 40 }; // Blue to Purple
        if (h < 320) return { i1: 6, i2: 7, w1: 1 - (h - 280) / 40, w2: (h - 280) / 40 }; // Purple to Magenta
        return { i1: 7, i2: 0, w1: 1 - (h - 320) / 40, w2: (h - 320) / 40 }; // Magenta wraps to Red
    }

    // Génère une LUT (Look-Up Table) de 256 valeurs à partir de points de courbe (Interpolation Cubique Monotone)
    function createCurveLUT(pts) {
        const lut = new Uint8Array(256);
        if (!pts || pts.length === 0) {
            for (let i = 0; i < 256; i++) lut[i] = i;
            return lut;
        }

        pts = pts.slice().sort((a, b) => a.x - b.x);
        if (pts[0].x > 0) pts.unshift({ x: 0, y: pts[0].y });
        if (pts[pts.length - 1].x < 255) pts.push({ x: 255, y: pts[pts.length - 1].y });

        const n = pts.length;
        const m = new Float32Array(n);
        const dx = new Float32Array(n - 1);
        const dy = new Float32Array(n - 1);
        const delta = new Float32Array(n - 1);

        for (let i = 0; i < n - 1; i++) {
            dx[i] = pts[i + 1].x - pts[i].x;
            dy[i] = pts[i + 1].y - pts[i].y;
            delta[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
        }

        m[0] = delta[0];
        m[n - 1] = delta[n - 2];
        for (let i = 1; i < n - 1; i++) {
            if (delta[i - 1] * delta[i] <= 0) {
                m[i] = 0;
            } else {
                m[i] = 2 / (1 / delta[i - 1] + 1 / delta[i]);
            }
        }

        let pIdx = 0;
        for (let i = 0; i < 256; i++) {
            while (pIdx < n - 2 && i >= pts[pIdx + 1].x) {
                pIdx++;
            }
            const p0 = pts[pIdx], p1 = pts[pIdx + 1];
            const h = p1.x - p0.x;
            if (h === 0) {
                lut[i] = clamp255(p0.y);
                continue;
            }
            const t = (i - p0.x) / h;
            const t2 = t * t, t3 = t2 * t;
            const h00 = 2 * t3 - 3 * t2 + 1;
            const h10 = t3 - 2 * t2 + t;
            const h01 = -2 * t3 + 3 * t2;
            const h11 = t3 - t2;

            const val = h00 * p0.y + h10 * h * m[pIdx] + h01 * p1.y + h11 * h * m[pIdx + 1];
            lut[i] = clamp255(val);
        }
        return lut;
    }

    function lumaByte(r, g, b) {
        return Math.round(0.299 * r + 0.587 * g + 0.114 * b) | 0;
    }

    function applyLevelsBuffer(src, width, height, p) {
        const out = new Uint8ClampedArray(src.length);
        const ib = clamp255(p.inBlack != null ? p.inBlack : 0);
        let iw = clamp255(p.inWhite != null ? p.inWhite : 255);
        if (iw <= ib) iw = Math.min(255, ib + 1);
        const g = parseGamma(p.gamma);
        const ob = clamp255(p.outBlack != null ? p.outBlack : 0);
        let ow = clamp255(p.outWhite != null ? p.outWhite : 255);
        if (ow < ob) ow = ob;

        const span = Math.max(1, iw - ib);
        const lut = new Uint8Array(256);
        for (let v = 0; v < 256; v++) {
            let t = (v - ib) / span;
            t = clamp01(t);
            if (g !== 1) t = Math.pow(t, 1 / g);
            const y = t * 255;
            const o = ob + (y / 255) * (ow - ob);
            lut[v] = clamp255(o);
        }

        const rR = p.chR !== false, rG = p.chG !== false, rB = p.chB !== false;
        const any = rR || rG || rB;
        const useR = any ? rR : true, useG = any ? rG : true, useB = any ? rB : true;

        for (let i = 0; i < out.length; i += 4) {
            out[i] = useR ? lut[src[i]] : src[i];
            out[i + 1] = useG ? lut[src[i + 1]] : src[i + 1];
            out[i + 2] = useB ? lut[src[i + 2]] : src[i + 2];
            out[i + 3] = src[i + 3];
        }
        return out;
    }

    function buildHistogramBuffer(src, chR, chG, chB) {
        const h = new Uint32Array(256);
        const any = chR || chG || chB;
        const uR = any ? chR : true, uG = any ? chG : true, uB = any ? chB : true;
        for (let i = 0; i < src.length; i += 4) {
            const a = src[i + 3];
            if (a < 8) continue;
            let v;
            if (uR && uG && uB) {
                v = lumaByte(src[i], src[i + 1], src[i + 2]);
            } else {
                let s = 0, n = 0;
                if (uR) { s += src[i]; n++; }
                if (uG) { s += src[i + 1]; n++; }
                if (uB) { s += src[i + 2]; n++; }
                v = n ? Math.round(s / n) : 0;
            }
            h[v]++;
        }
        return h;
    }

    /**
     * Traitement Camera Raw complet.
     *
     * Délègue à IlluPhotoPipeline, qui est LA définition de référence du
     * pipeline (voir js/effects/photo-pipeline.js). Tout le traitement s'y fait
     * en virgule flottante : une source RAW 14 bits garde sa dynamique jusqu'aux
     * outils couleur (température, teinte, saturation, vibrance, TSL, courbes),
     * et la quantification 8 bits n'a lieu qu'à l'écriture du pixel de sortie.
     *
     * Le pipeline traite aussi la clarté, la correction du voile, le vignettage,
     * le grain et la netteté : applyPostCameraRaw n'a donc plus rien à faire et
     * n'est conservée que pour la compatibilité des appelants.
     *
     * @param {Uint8ClampedArray|Float32Array} src RGBA. Float32 = RAW linéaire.
     * @param {object} p paramètres, éventuellement enrichis de sourceWhite /
     *        fullWidth / fullHeight (voir photo-pipeline.js).
     * @returns {Uint8ClampedArray} RGBA 8 bits prêt à l'affichage.
     */
    function applyCameraRawBuffer(src, width, height, p) {
        const PP = global.IlluPhotoPipeline;
        if (!PP) {
            console.error('[CameraRaw] photo-pipeline.js non chargé — traitement ignoré.');
            return src instanceof Float32Array ? new Uint8ClampedArray(src.length) : src;
        }
        p = p || {};
        return PP.process(src, width, height, p, {
            sourceWhite: p.sourceWhite,
            fullWidth: p.fullWidth,
            fullHeight: p.fullHeight,
            grainSeed: p.grainSeed
        });
    }

    /**
     * Conservée pour compatibilité : le vignettage, le grain, la netteté, la
     * clarté et la correction du voile sont désormais intégrés à
     * applyCameraRawBuffer, à leur place correcte dans le pipeline (les deux
     * derniers agissent en linéaire, avant le tone mapping).
     */
    function applyPostCameraRaw(src) {
        return src;
    }

    function applySharpen(data, width, height, amount, isFloat = false) {
        const out = new (isFloat ? Float32Array : Uint8ClampedArray)(data.length);
        const k = amount / 150;
        const c = 1 + 4 * k;
        const n = -k;

        out.set(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;
                const up = i - width * 4;
                const dn = i + width * 4;
                const lf = i - 4;
                const rt = i + 4;

                let res = data[i] * c + (data[up] + data[dn] + data[lf] + data[rt]) * n;
                out[i] = isFloat ? res : (res < 0 ? 0 : (res > 255 ? 255 : res));

                res = data[i + 1] * c + (data[up + 1] + data[dn + 1] + data[lf + 1] + data[rt + 1]) * n;
                out[i + 1] = isFloat ? res : (res < 0 ? 0 : (res > 255 ? 255 : res));

                res = data[i + 2] * c + (data[up + 2] + data[dn + 2] + data[lf + 2] + data[rt + 2]) * n;
                out[i + 2] = isFloat ? res : (res < 0 ? 0 : (res > 255 ? 255 : res));
                
                if (isFloat) out[i + 3] = data[i + 3];
            }
        }
        return out;
    }

    // ==================================================================
    // Ajustement automatique
    //
    // Méthode : analyser la scène en LINÉAIRE (et non en sRGB, où un écart
    // d'un diaphragme n'a pas la même taille selon la zone), en déduire des
    // réglages par inversion des réponses connues du pipeline, puis affiner
    // en simulant réellement le rendu sur une vignette et en corrigeant les
    // écarts aux cibles. C'est cette boucle de vérification qui remplace les
    // coefficients empiriques de l'ancienne version.
    // ==================================================================

    /** Cibles photographiques, en luminance perceptuelle (0..1). */
    const AUTO_TARGET = {
        /** Médiane visée pour une scène de clé normale (≈ 118/255). */
        midtone: 0.462,
        /** Écart-type visé : en dessous l'image est molle, au-dessus elle est dure. */
        contrast: 0.190,
        /** Zone morte autour de la cible de contraste : évite de corriger du bruit. */
        contrastDead: 0.030,
        /** Proportion de pixels tolérée au blanc pur. */
        clipHigh: 0.0015,
        /** Proportion tolérée au noir pur — un peu de vrai noir est souhaitable. */
        clipLow: 0.006,
        /** Position visée pour le point blanc (percentile 99,9). */
        white: 0.985,
        /** Position visée pour le point noir (percentile 0,1). */
        black: 0.012
    };

    /**
     * Vignette de travail en linéaire flottant.
     * Sur un RAW on part des données 14 bits (rawFloatData) : analyser la
     * prévisualisation 8 bits reviendrait à mesurer une image déjà écrêtée.
     */
    function buildAutoSample(imageData, maxEdge) {
        const srcFloat = (imageData.rawFloatData instanceof Float32Array) ? imageData.rawFloatData
            : (imageData.data instanceof Float32Array) ? imageData.data : null;
        const srcW = srcFloat && imageData.rawFloatWidth ? imageData.rawFloatWidth : imageData.width;
        const srcH = srcFloat && imageData.rawFloatHeight ? imageData.rawFloatHeight : imageData.height;
        const scale = Math.min(1, maxEdge / Math.max(1, Math.max(srcW, srcH)));
        const w = Math.max(1, Math.round(srcW * scale));
        const h = Math.max(1, Math.round(srcH * scale));
        const out = new Float32Array(w * h * 4);
        const PP = global.IlluPhotoPipeline;

        for (let y = 0; y < h; y++) {
            const sy = Math.min(srcH - 1, Math.floor(y / scale));
            for (let x = 0; x < w; x++) {
                const sx = Math.min(srcW - 1, Math.floor(x / scale));
                const si = (sy * srcW + sx) * 4;
                const di = (y * w + x) * 4;
                if (srcFloat) {
                    out[di] = srcFloat[si];
                    out[di + 1] = srcFloat[si + 1];
                    out[di + 2] = srcFloat[si + 2];
                } else {
                    const d = imageData.data;
                    out[di] = PP ? PP.SRGB_TO_LIN_8[d[si]] : d[si] / 255;
                    out[di + 1] = PP ? PP.SRGB_TO_LIN_8[d[si + 1]] : d[si + 1] / 255;
                    out[di + 2] = PP ? PP.SRGB_TO_LIN_8[d[si + 2]] : d[si + 2] / 255;
                }
                out[di + 3] = 1;
            }
        }
        return { data: out, width: w, height: h, isRaw: !!srcFloat };
    }

    /** Percentile d'un tableau trié. */
    function pct(sorted, p) {
        if (!sorted.length) return 0;
        const i = Math.max(0, Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1))));
        return sorted[i];
    }

    /**
     * Mesures d'une image 8 bits déjà rendue : c'est sur elles que porte la
     * boucle de correction, puisqu'elles décrivent ce que l'utilisateur verra.
     */
    function measureRendered(buf, n) {
        const lum = new Float32Array(n);
        let clipHigh = 0, clipLow = 0, sum = 0;
        for (let i = 0, o = 0; i < n; i++, o += 4) {
            const r = buf[o], g = buf[o + 1], b = buf[o + 2];
            const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            lum[i] = l;
            sum += l;
            if (r >= 254 || g >= 254 || b >= 254) clipHigh++;
            if (r <= 1 && g <= 1 && b <= 1) clipLow++;
        }
        const mean = sum / n;
        let varSum = 0;
        for (let i = 0; i < n; i++) { const d = lum[i] - mean; varSum += d * d; }
        const sorted = Array.prototype.slice.call(lum).sort((a, b) => a - b);
        return {
            mean: mean,
            std: Math.sqrt(varSum / n),
            median: pct(sorted, 0.5),
            p25: pct(sorted, 0.25),
            p001: pct(sorted, 0.001),
            p01: pct(sorted, 0.01),
            p05: pct(sorted, 0.05),
            p95: pct(sorted, 0.95),
            p99: pct(sorted, 0.99),
            p999: pct(sorted, 0.999),
            clipHigh: clipHigh / n,
            clipLow: clipLow / n
        };
    }

    /**
     * Analyse de la scène, en linéaire.
     * Renvoie des grandeurs photographiques : plage dynamique en diaphragmes,
     * clé de la scène, contraste local, voile, dominante colorée.
     */
    function analyseScene(sample) {
        const { data, width, height } = sample;
        const n = width * height;
        const lin = new Float32Array(n);
        const perc = new Float32Array(n);
        let sumR = 0, sumG = 0, sumB = 0, sumSat = 0;
        const PP = global.IlluPhotoPipeline;
        const toPerc = (y) => (y <= 0 ? 0 : Math.pow(y, 1 / 2.2));

        for (let i = 0, o = 0; i < n; i++, o += 4) {
            const r = Math.max(0, data[o]), g = Math.max(0, data[o + 1]), b = Math.max(0, data[o + 2]);
            const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            lin[i] = y;
            perc[i] = toPerc(y);
            sumR += r; sumG += g; sumB += b;
            const mx = Math.max(r, Math.max(g, b));
            const mn = Math.min(r, Math.min(g, b));
            sumSat += mx > 1e-6 ? (mx - mn) / mx : 0;
        }

        const sortedLin = Array.prototype.slice.call(lin).sort((a, b) => a - b);
        const sortedPerc = Array.prototype.slice.call(perc).sort((a, b) => a - b);

        // Contraste local : écart moyen à un flou de rayon moyen. Distingue une
        // image molle (à réveiller par la clarté) d'une image simplement peu
        // contrastée globalement.
        let localContrast = 0;
        if (PP && PP.boxBlurChannel) {
            const blur = new Float32Array(n);
            PP.boxBlurChannel(perc, blur, width, height, Math.max(1, Math.round(Math.min(width, height) * 0.03)));
            let acc = 0;
            for (let i = 0; i < n; i++) acc += Math.abs(perc[i] - blur[i]);
            localContrast = acc / n;
        }

        // Netteté apparente : gradient moyen.
        let grad = 0, gradN = 0;
        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const i = y * width + x;
                grad += Math.abs(perc[i] - perc[i + 1]) + Math.abs(perc[i] - perc[i + width]);
                gradN++;
            }
        }

        const p001 = pct(sortedLin, 0.001), p01 = pct(sortedLin, 0.01), p05 = pct(sortedLin, 0.05);
        const p25 = pct(sortedLin, 0.25);
        const p50 = pct(sortedLin, 0.5);
        const p95 = pct(sortedLin, 0.95), p99 = pct(sortedLin, 0.99), p999 = pct(sortedLin, 0.999);

        // Plage dynamique utile, en diaphragmes.
        const dynStops = Math.log2(Math.max(1e-6, p999) / Math.max(1e-7, p001 + 1e-7));

        // Clé de la scène : proportion de pixels sombres contre pixels clairs.
        // Sert à ne pas transformer une photo de nuit en photo de jour.
        let darkN = 0, brightN = 0;
        for (let i = 0; i < n; i++) {
            if (perc[i] < 0.20) darkN++;
            else if (perc[i] > 0.75) brightN++;
        }
        const darkFrac = darkN / n;
        const brightFrac = brightN / n;

        // Scène à forte dynamique (contre-jour) : les deux extrémités sont
        // peuplées et le milieu est creux.
        let midN = 0;
        for (let i = 0; i < n; i++) if (perc[i] >= 0.30 && perc[i] <= 0.70) midN++;
        const midFrac = midN / n;
        const highDynamic = (darkFrac > 0.20 && brightFrac > 0.12 && midFrac < 0.42);

        // Voile atmosphérique. Le signe distinctif n'est PAS un plancher de
        // noirs élevé — une photo de neige en a un aussi sans être voilée —
        // mais la conjonction d'une plage dynamique écrasée et d'un contraste
        // local quasi nul : la brume mange le micro-détail.
        const blackFloor = toPerc(p001);
        const avgSat = sumSat / n;
        const dynFor = Math.log2(Math.max(1e-6, p999) / Math.max(1e-7, p001 + 1e-7));
        const hazeDyn = Math.max(0, Math.min(1, (2.0 - dynFor) / 1.6));
        const hazeLoc = Math.max(0, Math.min(1, (0.006 - localContrast) / 0.005));
        const haze = hazeDyn * hazeLoc;

        return {
            n: n,
            p001: p001, p01: p01, p05: p05, p25: p25, p50: p50, p95: p95, p99: p99, p999: p999,
            percMedian: pct(sortedPerc, 0.5),
            percP05: pct(sortedPerc, 0.05),
            percP95: pct(sortedPerc, 0.95),
            dynStops: dynStops,
            darkFrac: darkFrac,
            brightFrac: brightFrac,
            midFrac: midFrac,
            highDynamic: highDynamic,
            blackFloor: blackFloor,
            haze: haze,
            localContrast: localContrast,
            grad: gradN ? grad / gradN : 0,
            avgSat: avgSat,
            avgR: sumR / n, avgG: sumG / n, avgB: sumB / n
        };
    }

    /**
     * Position de curseur produisant un gain donné sur une étape tonale.
     * Inverse gain = exp(amt · tanh(u/100)), la forme utilisée par le pipeline.
     * Renvoie 0 si le gain demandé dépasse ce que l'étape peut fournir.
     */
    function solveToneSlider(gain, amt) {
        if (!(gain > 0) || !isFinite(gain)) return 0;
        const t = Math.log(gain) / amt;
        if (t >= 0.999) return 400;
        if (t <= -0.999) return -400;
        // atanh
        return 100 * 0.5 * Math.log((1 + t) / (1 - t));
    }

    /**
     * Analyse automatique complète.
     * @param {ImageData|{width,height,data,rawFloatData}} imageData
     * @returns {object} paramètres prêts à être appliqués au pipeline
     */
    function suggestAutoParams(imageData) {
        const PP = global.IlluPhotoPipeline;
        if (!imageData || !imageData.width || !imageData.height) return {};

        const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));
        const sample = buildAutoSample(imageData, 180);
        const S = analyseScene(sample);
        if (!S.n) return {};

        const sourceWhite = PP ? PP.sourceWhiteFor(sample.data) : 1.0;
        const stopsPer100 = PP ? PP.K.EXPOSURE_STOPS_PER_100 : 2;
        const AMT_HI = PP ? PP.K.AMT_HIGHLIGHTS : 0.9;
        const AMT_WH = PP ? PP.K.AMT_WHITES : 1.1;
        const AMT_SH = PP ? PP.K.AMT_SHADOWS : 1.1;
        const AMT_BL = PP ? PP.K.AMT_BLACKS : 1.3;

        // ---------------------------------------------------------------
        // 1. Exposition
        //
        // Cible adaptative : une scène majoritairement sombre (nuit, clé
        // basse) ou majoritairement claire (neige, clé haute) ne doit pas
        // être ramenée de force sur un gris moyen — ce serait la dénaturer.
        // ---------------------------------------------------------------
        let targetMid = AUTO_TARGET.midtone;
        targetMid -= clamp((S.darkFrac - 0.35) * 0.30, 0, 0.10);   // clé basse : on reste sombre
        targetMid += clamp((S.brightFrac - 0.35) * 0.24, 0, 0.08); // clé haute : on reste clair
        if (S.highDynamic) targetMid += 0.02; // contre-jour : ouvrir un peu les ombres

        // En contre-jour, la médiane globale ne veut rien dire : elle tombe
        // entre un ciel écrasé de lumière et un sujet dans l'ombre, si bien
        // que la viser revient à sous-exposer le sujet pour ménager le ciel.
        // On expose alors pour le sujet — le premier quart de l'histogramme —
        // et le ciel est rattrapé par la récupération des hautes lumières.
        // C'est la démarche du photographe, et non la moyenne arithmétique.
        const anchorLin = S.highDynamic ? Math.max(1e-6, S.p25) : Math.max(1e-6, S.p50);
        const anchorTarget = S.highDynamic ? Math.max(0.26, targetMid - 0.14) : targetMid;
        let stops = Math.log2(Math.pow(anchorTarget, 2.2) / anchorLin);
        stops = clamp(stops, -4, 5);

        // ---------------------------------------------------------------
        // 2. Récupération des hautes lumières
        //
        // C'est ici que se joue le cas « image sombre à réveiller » : monter
        // l'exposition pousse mécaniquement les hautes lumières vers le
        // blanc. On calcule donc de combien de diaphragmes le point blanc
        // débordera APRÈS exposition, et on demande aux hautes lumières puis
        // aux blancs de rendre exactement cette marge.
        // ---------------------------------------------------------------
        const expMult = Math.pow(2, stops);
        // Une scène de forte dynamique va recevoir beaucoup d'exposition pour
        // son sujet : les hautes lumières devront donc être franchement
        // rattrapées, ce que le calcul ci-dessous chiffre.

        const whiteAfter = S.p999 * expMult;
        const brightAfter = S.p95 * expMult;

        let highlights = 0;
        let whites = 0;
        if (whiteAfter > 1.0) {
            // Attention : le tone mapping se cale déjà sur le blanc réel de la
            // scène et absorbe l'essentiel du dépassement. Lui ajouter une
            // récupération calculée sur le dépassement BRUT écraserait deux
            // fois les hautes lumières et leur ferait perdre tout modelé — le
            // ciel deviendrait un aplat gris uniforme au lieu d'être détaillé.
            // On n'anticipe donc qu'une correction modérée, et la boucle de
            // vérification affine ensuite sur le rendu réellement mesuré.
            const overStops = Math.log2(whiteAfter);
            const hiStops = Math.min(overStops * 0.35, 0.55);
            highlights = solveToneSlider(Math.pow(2, -hiStops), AMT_HI);
        }
        // Le cas inverse — aucune haute lumière n'atteint le blanc — est traité
        // par la boucle de vérification, qui mesure le rendu réel plutôt que de
        // l'extrapoler.

        // Une scène de forte dynamique part avec un peu de récupération, sans
        // plus : c'est la mesure du rendu qui décidera du reste.
        if (S.highDynamic && highlights > -18) highlights = -18;
        if (brightAfter > 0.9 && highlights > -8) highlights -= 6;

        // ---------------------------------------------------------------
        // 3. Ombres et noirs
        //
        // Les ombres remontent d'autant plus que la scène est contrastée et
        // que le bas de l'histogramme est encombré. Le point noir, lui, est
        // posé sur le percentile 0,1 : on récupère du contraste sans boucher.
        // ---------------------------------------------------------------
        const shadowLin = Math.max(1e-7, S.p05 * expMult);
        const shadowPerc = Math.pow(shadowLin, 1 / 2.2);
        let shadows = 0;
        const shadowTarget = S.highDynamic ? 0.26 : 0.20;
        if (shadowPerc < shadowTarget) {
            const need = Math.pow(shadowTarget, 2.2) / Math.max(1e-7, shadowLin);
            shadows = solveToneSlider(Math.min(need, 3.0), AMT_SH);
        }

        // Le point noir est posé par la boucle de vérification, sur le rendu
        // mesuré : l'estimer ici à partir de l'histogramme d'entrée conduisait
        // à l'écraser sur presque toutes les images.
        let blacks = 0;

        // ---------------------------------------------------------------
        // 4. Contraste
        //
        // Mesuré, pas forfaitaire. Une scène de forte dynamique en reçoit
        // moins : on vient d'y récupérer du détail, l'écraser serait absurde.
        // ---------------------------------------------------------------
        const stdPerc = Math.max(0.02, (S.percP95 - S.percP05) / 3.2);
        let contrast = (AUTO_TARGET.contrast - stdPerc) * 120;
        // Une scène de forte dynamique vient d'être ouverte : la réécraser
        // annulerait la récupération.
        if (S.highDynamic) contrast = Math.min(contrast, 6) - 10;
        if (S.haze > 0.35) contrast += 8;

        // ---------------------------------------------------------------
        // 5. Balance des blancs — monde gris partiel, en linéaire, obtenue
        //    en inversant la vraie courbe de température du pipeline.
        // ---------------------------------------------------------------
        let temp = 0, tint = 0;
        if (PP) {
            const STRENGTH = 0.7;
            const solve = (target, ratioOf) => {
                let lo = -150, hi = 150;
                for (let it = 0; it < 26; it++) {
                    const mid = (lo + hi) * 0.5;
                    if (ratioOf(mid) < target) lo = mid; else hi = mid;
                }
                return (lo + hi) * 0.5;
            };
            const lr = Math.max(1e-6, S.avgR), lg = Math.max(1e-6, S.avgG), lb = Math.max(1e-6, S.avgB);
            const wantRB = Math.pow(lb / lr, STRENGTH);
            temp = clamp(solve(wantRB, (v) => {
                const g = PP.whiteBalanceGains(v, 0);
                return g.r / Math.max(1e-6, g.b);
            }), -400, 400);
            const wantG = Math.pow(((lr + lb) * 0.5) / lg, STRENGTH);
            tint = clamp(solve(wantG, (v) => {
                const g = PP.whiteBalanceGains(0, v);
                return ((g.r + g.b) * 0.5) / Math.max(1e-6, g.g);
            }), -400, 400);
        }

        // ---------------------------------------------------------------
        // 6. Couleur et texture
        // ---------------------------------------------------------------
        const satPct = S.avgSat * 100;
        let vibrance = clamp((32 - satPct) * 1.1, -15, 45);
        let saturation = clamp((22 - satPct) * 0.35, -12, 16);

        // Le voile décolore : sa correction rend déjà de la couleur, inutile
        // d'en rajouter par la saturation.
        const dehaze = clamp(Math.round(S.haze * 45), 0, 38);
        if (dehaze > 8) { vibrance *= 0.65; saturation *= 0.55; }

        // Clarté et netteté sont calées sur les valeurs réellement observées
        // (contraste local ≈ 0,002 à 0,05 ; gradient ≈ 0,001 à 0,015 sur la
        // vignette d'analyse), et non sur des seuils arbitraires.
        const clarity = clamp((0.011 - S.localContrast) * 1400, -6, 28);
        const sharpen = clamp((0.006 - S.grad) * 2500, 0, 30);

        let params = {
            exposure: clamp(Math.round((stops / stopsPer100) * 100), -220, 220),
            contrast: clamp(Math.round(contrast), -45, 38),
            highlights: clamp(Math.round(highlights), -220, 40),
            shadows: clamp(Math.round(shadows), -30, 130),
            whites: clamp(Math.round(whites), -140, 45),
            blacks: clamp(Math.round(blacks), -70, 45),
            temp: Math.round(temp),
            tint: Math.round(tint),
            vibrance: Math.round(vibrance),
            saturation: Math.round(saturation),
            clarity: Math.round(clarity),
            dehaze: Math.round(dehaze),
            sharpen: Math.round(sharpen),
            vignette: 0
        };

        // ---------------------------------------------------------------
        // 7. Vérification par simulation
        //
        // Les étapes précédentes raisonnent sur des étapes prises isolément ;
        // elles interagissent. On rend donc réellement la vignette et on
        // corrige les écarts restants — médiane, écrêtage haut, écrêtage bas,
        // contraste. Deux ou trois passes suffisent à converger.
        // ---------------------------------------------------------------
        if (PP && typeof PP.process === 'function') {
            const base = Object.assign({}, METADATA.DEFAULT_PARAMS);

            // Cibles RELATIVES à la scène.
            //
            // Viser un écart-type ou un point blanc absolus revient à imposer
            // le même rendu à toutes les images : une scène naturellement
            // douce (brume, portrait en lumière diffuse) se retrouverait
            // durcie jusqu'à la butée. On mesure donc d'abord le rendu neutre,
            // et on ne demande qu'une amélioration proportionnée.
            const neutral = measureRendered(
                PP.process(sample.data, sample.width, sample.height, base, {
                    sourceWhite: sourceWhite,
                    fullWidth: sample.width,
                    fullHeight: sample.height
                }),
                sample.width * sample.height
            );
            const targetStd = Math.min(AUTO_TARGET.contrast, neutral.std * 1.7 + 0.03);
            const targetWhite = Math.min(AUTO_TARGET.white, neutral.p999 + 0.06);
            // Amortissement décroissant : la première passe corrige gros, les
            // suivantes affinent. Sans lui, deux réglages antagonistes
            // (exposition et hautes lumières) se renvoient la balle et finissent
            // en butée.
            const damping = [0.75, 0.45, 0.28, 0.18];

            for (let iter = 0; iter < damping.length; iter++) {
                const k = damping[iter];
                const test = Object.assign({}, base, params);
                const rendered = PP.process(sample.data, sample.width, sample.height, test, {
                    sourceWhite: sourceWhite,
                    fullWidth: sample.width,
                    fullHeight: sample.height
                });
                const M = measureRendered(rendered, sample.width * sample.height);
                let moved = 0;

                // -- Exposition : ramener l'ancre sur sa cible ---------------
                const anchorNow = S.highDynamic ? M.p25 : M.median;
                if (Math.abs(anchorTarget - anchorNow) > 0.010) {
                    const gain = Math.pow(Math.max(0.04, anchorTarget) / Math.max(0.02, anchorNow), 2.2);
                    const dStops = clamp(Math.log2(gain) * k, -1.5, 1.5);
                    const next = clamp(params.exposure + (dStops / stopsPer100) * 100, -220, 220);
                    moved += Math.abs(next - params.exposure);
                    params.exposure = Math.round(next);
                }

                // -- Hautes lumières : le blanc ne doit pas brûler -----------
                if (M.clipHigh > AUTO_TARGET.clipHigh) {
                    const excess = Math.min(1, (M.clipHigh - AUTO_TARGET.clipHigh) / 0.015);
                    const d = (10 + 45 * excess) * k;
                    params.highlights = clamp(Math.round(params.highlights - d), -220, 40);
                    if (M.clipHigh > 0.008) {
                        params.whites = clamp(Math.round(params.whites - d * 0.7), -140, 45);
                    }
                    moved += d;
                }

                // -- Modelé des hautes lumières ------------------------------
                // Pas d'écrêtage mais des hautes lumières tassées : la zone
                // claire est devenue un aplat. On rend de la marge aux hautes
                // lumières pour rouvrir la séparation entre p95 et p99,9.
                if (M.clipHigh <= AUTO_TARGET.clipHigh && params.highlights < -10) {
                    const sep = M.p999 - M.p95;
                    const sepNeutral = Math.max(0.02, neutral.p999 - neutral.p95);
                    if (sep < sepNeutral * 0.6) {
                        const d = Math.min(45, (sepNeutral * 0.75 - sep) * 320) * k;
                        params.highlights = clamp(Math.round(params.highlights + d), -220, 40);
                        params.whites = clamp(Math.round(params.whites + d * 0.5), -140, 45);
                        moved += d;
                    }
                }

                // -- Blancs : viser un point blanc juste sous la saturation --
                // C'est ce qui donne de l'éclat sans écrêter.
                if (M.clipHigh <= AUTO_TARGET.clipHigh) {
                    const dW = targetWhite - M.p999;
                    if (Math.abs(dW) > 0.040) {
                        const d = clamp(dW * 70 * k, -18, 18);
                        params.whites = clamp(Math.round(params.whites + d), -140, 30);
                        moved += Math.abs(d);
                    }
                }

                // -- Noirs : poser le point noir sans boucher ---------------
                if (M.clipLow > AUTO_TARGET.clipLow) {
                    const excess = Math.min(1, (M.clipLow - AUTO_TARGET.clipLow) / 0.02);
                    const d = (8 + 30 * excess) * k;
                    params.blacks = clamp(Math.round(params.blacks + d), -70, 45);
                    moved += d;
                } else {
                    const targetBlack = Math.max(AUTO_TARGET.black, neutral.p001 - 0.06);
                    const dB = M.p001 - targetBlack;
                    if (Math.abs(dB) > 0.030) {
                        const d = clamp(-dB * 90 * k, -16, 16);
                        params.blacks = clamp(Math.round(params.blacks + d), -60, 45);
                        moved += Math.abs(d);
                    }
                }

                // -- Contraste : zone morte, pour ne pas courir après le bruit
                const stdErr = targetStd - M.std;
                if (Math.abs(stdErr) > AUTO_TARGET.contrastDead) {
                    const d = clamp(stdErr * 80 * k, -14, 14);
                    params.contrast = clamp(Math.round(params.contrast + d), -45, 30);
                    moved += Math.abs(d);
                }

                if (moved < 1.5) break;
            }
        }

        return params;
    }


    const METADATA = {
        DEFAULT_PARAMS: {
            exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
            temp: 0, tint: 0, vibrance: 0, saturation: 0,
            clarity: 0, dehaze: 0, vignette: 0,
            red: 0, redHi: 0, redSh: 0, green: 0, greenHi: 0, greenSh: 0, blue: 0, blueHi: 0, blueSh: 0,
            grain: 0, sharpen: 0, grainSharpness: 50,
            curveMaster: [{x:0, y:0}, {x:255, y:255}],
            curveR: [{x:0, y:0}, {x:255, y:255}],
            curveG: [{x:0, y:0}, {x:255, y:255}],
            curveB: [{x:0, y:0}, {x:255, y:255}],
            hslHue: [0, 0, 0, 0, 0, 0, 0, 0], hslSat: [0, 0, 0, 0, 0, 0, 0, 0], hslLum: [0, 0, 0, 0, 0, 0, 0, 0],
            /**
             * Masque local par réglage. Absent = actif : on n'y stocke que les
             * exceptions, ce qui garde les anciens projets compatibles.
             */
            maskOn: {},
            /** Réglages dont la course a été étendue par l'utilisateur. */
            extend: {}
        },
        RANGES: {
            // Plages "raisonnables mais créatives": éviter les aplats/cassures trop brutales,
            // tout en gardant de la marge pour des looks marqués.
            exposure: [-150, 150], contrast: [-80, 80], highlights: [-170, 170], shadows: [-170, 170],
            whites: [-140, 140], blacks: [-140, 140],
            // Course resserrée : au-delà, la courbe de température sature et le
            // curseur ne répond plus (voir WB_MIRED_SPAN dans photo-pipeline.js).
            temp: [-100, 100], tint: [-100, 100],
            vibrance: [-90, 90], saturation: [-80, 80], clarity: [-70, 70], dehaze: [-70, 70], vignette: [-85, 85],
            red: [-80, 80], redHi: [-70, 70], redSh: [-70, 70],
            green: [-80, 80], greenHi: [-70, 70], greenSh: [-70, 70],
            blue: [-80, 80], blueHi: [-70, 70], blueSh: [-70, 70],
            grain: [0, 100], sharpen: [0, 100], grainSharpness: [0, 100]
        },
        /** Facteur appliqué aux bornes quand « Étendre » est coché. */
        RANGE_EXTEND_FACTOR: 2.5,

        RANGES_RAW: {
            // Plages EXTRÊMES pour un contrôle total de la dynamique 14-bit RAW
            exposure: [-400, 400], contrast: [-200, 200], highlights: [-400, 400], shadows: [-400, 400],
            whites: [-300, 300], blacks: [-300, 300], temp: [-150, 150], tint: [-150, 150],
            vibrance: [-200, 200], saturation: [-200, 200], clarity: [-200, 200], dehaze: [-200, 200], vignette: [-200, 200],
            red: [-200, 200], redHi: [-200, 200], redSh: [-200, 200],
            green: [-200, 200], greenHi: [-200, 200], greenSh: [-200, 200],
            blue: [-200, 200], blueHi: [-200, 200], blueSh: [-200, 200],
            grain: [0, 200], sharpen: [0, 200], grainSharpness: [0, 200]
        },
        UI_LAYOUT: [
            {
                id: 'sec-light',
                title: 'photo.secLight', fallback: 'Lumière',
                hasAuto: true,
                sliders: [
                    { id: 'exposure', label: 'photo.exposure', fallback: 'Exposition', options: { extendable: true } },
                    { id: 'contrast', label: 'photo.contrast', fallback: 'Contraste', options: { extendable: true } },
                    { id: 'highlights', label: 'photo.highlights', fallback: 'Hautes lumières', options: { maskable: true, extendable: true } },
                    { id: 'shadows', label: 'photo.shadows', fallback: 'Ombres', options: { maskable: true, extendable: true } },
                    { id: 'whites', label: 'photo.whites', fallback: 'Blancs', options: { maskable: true, extendable: true } },
                    { id: 'blacks', label: 'photo.blacks', fallback: 'Noirs', options: { maskable: true, extendable: true } }
                ]
            },
            {
                id: 'sec-color',
                title: 'photo.secColor', fallback: 'Couleur et Saturation',
                sliders: [
                    { id: 'temp', label: 'photo.temp', fallback: 'Température' },
                    { id: 'tint', label: 'photo.tint', fallback: 'Teinte' },
                    { id: 'vibrance', label: 'photo.vibrance', fallback: 'Vibrance' },
                    { id: 'saturation', label: 'photo.saturation', fallback: 'Saturation' }
                ]
            },
            {
                id: 'sec-presence',
                title: 'photo.secPresence', fallback: 'Présence et Détail',
                sliders: [
                    { id: 'clarity', label: 'photo.clarity', fallback: 'Clarté (Micro-contraste)', options: { extendable: true } },
                    { id: 'dehaze', label: 'photo.dehaze', fallback: 'Correction du voile', options: { extendable: true } },
                    { id: 'vignette', label: 'photo.vignette', fallback: 'Vignettage' },
                    { type: 'separator' },
                    { id: 'sharpen', label: 'photo.sharpen', fallback: 'Netteté (Piqué)' },
                    { id: 'grain', label: 'photo.grain', fallback: 'Grain Film' },
                    { id: 'grainSharpness', label: 'photo.grainSharpness', fallback: 'Piqué du grain', options: { indent: true } }
                ]
            },
            {
                id: 'sec-curves',
                title: 'photo.secCurves', fallback: 'Courbe des Tonalités',
                isCurve: true
            },
            {
                id: 'sec-hsl',
                title: 'photo.secHsl', fallback: 'Mélangeur de couleurs (TSL)',
                isCollapsed: true,
                isHSL: true
            },
            {
                id: 'sec-rgb',
                title: 'photo.secRGB', fallback: 'Color Grading (RGB)',
                isCollapsed: true,
                isRGB: true
            }
        ],
        UI_PRESETS_LAYOUT: [
            // (La disposition des groupes de presets reste la même, avec un exemple de mise à jour ci-dessous)
            {
                id: 'group-quick',
                label: 'photo.groupQuick', fallback: 'Corrections Rapides',
                items: [
                    { id: 'autolevel', label: 'photo.presetAutoLevel', fallback: 'Niveaux Automatiques' },
                    { id: 'bw_soft', label: 'photo.presetBWDoux', fallback: 'Noir & Blanc Doux' },
                    { id: 'sepia', label: 'photo.presetSepiaSimple', fallback: 'Sépia Simple' }
                ]
            },
            {
                id: 'group-cinema',
                label: 'photo.groupCinema', fallback: 'Cinématographique & Urbain',
                items: [
                    { id: 'teal_and_orange', label: 'photo.presetTealOrange', fallback: 'Cinéma (Teal & Orange)' },
                    { id: 'neon_city', label: 'photo.presetNeon', fallback: 'Néon Urbain' },
                    { id: 'cyber_green', label: 'photo.presetCyber', fallback: 'Code Vert (Cyber)' },
                    { id: 'urban_night', label: 'photo.presetUrbanNight', fallback: 'Nuit Bleutée' }
                ]
            },
            {
                id: 'group-pro',
                label: 'photo.groupPro', fallback: 'Collection Pro',
                items: [
                    { id: 'pro_film', label: 'photo.presetProFilm', fallback: 'Argentique Pro' },
                    { id: 'sunkissed', label: 'photo.presetProSun', fallback: 'Baisé par le Soleil' },
                    { id: 'high_key', label: 'photo.presetProHighKey', fallback: 'High Key (Lumineux)' },
                    { id: 'cinematic_mood', label: 'photo.presetProMood', fallback: 'Ambiance Cinéma Subtile' }
                ]
            }
            // D'autres groupes existants peuvent être remis ici...
        ],
        PRESETS: {
            'none': { exposure: 0, contrast: 0, temp: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, saturation: 0, red: 0, redHi: 0, redSh: 0, green: 0, greenHi: 0, greenSh: 0, blue: 0, blueHi: 0, blueSh: 0, grain: 0, clarity: 0, dehaze: 0, vignette: 0 },

            // --- NOIR ET BLANC ---
            'bw_hard': { exposure: 5, contrast: 45, highlights: 25, shadows: -15, whites: 30, blacks: -35, vibrance: 0, saturation: -100, clarity: 25, vignette: 20, grain: 15 },
            'bw_soft': { exposure: 10, contrast: -10, highlights: -20, shadows: 20, whites: -15, blacks: 35, vibrance: 0, saturation: -100, clarity: -10, grain: 10 },
            'sepia_classic': { exposure: 5, contrast: 0, temp: 45, tint: 10, highlights: -15, shadows: 20, whites: -10, blacks: 15, vibrance: -20, saturation: -40, red: 10, green: 5, blue: -10, clarity: 5, vignette: 15, grain: 20 },

            // --- CINÉMATOGRAPHIQUE & URBAIN ---
            // Exemple pro avec TSL (Désaturer les bleus, booster les oranges)
            'teal_and_orange': {
                exposure: 0, contrast: 15, temp: 5, tint: 0, highlights: -15, shadows: 10, whites: 5, blacks: -10, vibrance: 25, saturation: 5, clarity: 15, vignette: 15,
                hslHue: [0, -10, 0, 0, 15, -15, 0, 0], hslSat: [0, 20, 10, -50, -20, -30, -50, -50], hslLum: [0, 10, 0, 0, 0, -10, 0, 0],
                blueSh: 15, redHi: 10
            },
            'neon_city': { exposure: 5, contrast: 45, temp: -25, tint: 60, highlights: -10, shadows: 15, whites: 10, blacks: 0, vibrance: 70, saturation: 30, clarity: 30, dehaze: 10, vignette: 25, blueHi: 80, blueSh: 50, grain: 5 },
            'cyber_green': { exposure: -15, contrast: 60, temp: -30, tint: -50, highlights: -20, shadows: -30, whites: 5, blacks: -10, vibrance: 45, saturation: 10, clarity: 40, vignette: 30, greenHi: 100, greenSh: 60, grain: 15 },
            'urban_night': { exposure: -20, contrast: 40, temp: -50, tint: 20, highlights: 30, shadows: -10, whites: 15, blacks: 0, vibrance: 50, saturation: 5, clarity: 20, vignette: 15, blueHi: 70, blueSh: 30, grain: 10 },

            // --- COLLECTION PRO ---
            'pro_film': { exposure: 10, contrast: -5, temp: 10, tint: -5, highlights: -25, shadows: 35, whites: -15, blacks: 40, vibrance: -5, saturation: -5, clarity: 10, vignette: 20, blueSh: 15, redSh: -5, grain: 20, grainSharpness: 30 },
            'sunkissed': { exposure: 15, contrast: 5, temp: 30, tint: -5, highlights: -10, shadows: 15, whites: 10, blacks: 10, vibrance: 15, saturation: 5, clarity: -5, dehaze: 5, redHi: 20, red: 5 },
            'high_key': { exposure: 40, contrast: -25, temp: -5, tint: 5, highlights: -30, shadows: 45, whites: -10, blacks: 20, vibrance: 25, saturation: 5, clarity: 15, sharpen: 10 },
            'cinematic_mood': { exposure: -5, contrast: 25, temp: -10, tint: 0, highlights: -20, shadows: 5, whites: 5, blacks: -15, vibrance: 20, saturation: -15, clarity: 20, vignette: 30, blueSh: 25, blueHi: -10, greenSh: 5, grain: 12 }
        }
    };

    global.IlluImageAdjustCore = {
        applyLevelsBuffer: applyLevelsBuffer,
        buildHistogramBuffer: buildHistogramBuffer,
        applyCameraRawBuffer: applyCameraRawBuffer, applyPostCameraRaw: applyPostCameraRaw,
        suggestAutoParams: suggestAutoParams,
        _autoAnalyse: function (imageData) { return analyseScene(buildAutoSample(imageData, 180)); },
        createCurveLUT: createCurveLUT,
        rgbToHsl: rgbToHsl,
        hslToRgb: hslToRgb,
        getHslWeightsFast: getHslWeightsFast,
        METADATA: METADATA
    };

    // UI-only logic (Sliders) - Shielded from Workers
    if (typeof document !== 'undefined') {
        global.IlluImageAdjustCore.Slider = {
            createHtml(id, label, key, options = {}) {
                const ranges = METADATA.RANGES || {};
                const range = ranges[key] || [0, 100];
                const min = range[0];
                const max = range[1];
                const isMini = options.isMini || false;
                const wrapClass = options.wrapClass || `illu-cr-range-wrap--${key}`;

                if (isMini) {
                    return `
                        <div class="illu-pm-row illu-pm-row--mini" style="margin-bottom:5px">
                            <label style="font-size:9px; display:flex; justify-content:space-between; align-items:center;">
                                <span>${label}</span>
                                <input type="number" class="val val-input" id="${id}-val" value="0">
                            </label>
                            <div class="illu-cr-range-wrap ${wrapClass}">
                                <input type="range" class="illu-cr-range" id="${id}" min="${min}" max="${max}" value="0">
                            </div>
                        </div>
                    `;
                }

                // Options par réglage : masque local et course étendue.
                // Elles ne sont proposées que là où elles ont un sens, pour ne
                // pas encombrer les réglages qui n'en ont pas besoin.
                let opts = '';
                if (options.maskable || options.extendable) {
                    // IlluI18n.t renvoie la CLÉ quand elle est absente du
                    // dictionnaire : sans ce contrôle, l'interface afficherait
                    // « photo.extendRange » au lieu du libellé.
                    const t = (k, fb) => {
                        if (!global.IlluI18n || typeof global.IlluI18n.t !== 'function') return fb;
                        const r = global.IlluI18n.t(k);
                        return (r && r !== k) ? r : fb;
                    };
                    let items = '';
                    if (options.maskable) {
                        items += `<label class="illu-pm-opt" title="${t('photo.maskHint', 'Le réglage suit les zones de l\'image (masque local) au lieu de traiter chaque pixel isolément.')}">
                            <input type="checkbox" class="illu-pm-opt-mask" id="${id}-mask" checked>
                            <span>${t('photo.useMask', 'Masque')}</span>
                        </label>`;
                    }
                    if (options.extendable) {
                        items += `<label class="illu-pm-opt" title="${t('photo.extendHint', 'Élargit les bornes du curseur.')}">
                            <input type="checkbox" class="illu-pm-opt-ext" id="${id}-ext">
                            <span>${t('photo.extendRange', 'Étendre')}</span>
                        </label>`;
                    }
                    opts = `<div class="illu-pm-opt-row">${items}</div>`;
                }

                return `
                    <div class="illu-pm-row">
                        <label style="display:flex; justify-content:space-between; align-items:center;">
                            <span>${label}</span>
                            <input type="number" class="val val-input" id="${id}-val" value="0">
                        </label>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="illu-cr-range-wrap ${wrapClass}" style="flex: 1;">
                                <input type="range" class="illu-cr-range" id="${id}" min="${min}" max="${max}" value="0">
                            </div>
                        </div>
                        ${opts}
                    </div>
                `;
            },

            bind(root, id, key, options = {}, callbacks = {}) {
                const rangeInput = root.querySelector('#' + id);
                if (!rangeInput) return;

                const defVal = METADATA.DEFAULT_PARAMS[key];
                if (Array.isArray(defVal)) return;

                const valDisplay = root.querySelector('#' + id + '-val');

                const update = (val, fromTextInput = false) => {
                    let parsedVal = parseInt(val, 10);
                    if (isNaN(parsedVal)) parsedVal = 0;

                    const min = parseInt(rangeInput.getAttribute('min'), 10) || -100;
                    const max = parseInt(rangeInput.getAttribute('max'), 10) || 100;
                    
                    // Si on tape au clavier, on permet d'aller jusqu'à 4x la limite du slider
                    const safeMin = fromTextInput ? min * 4 : min;
                    const safeMax = fromTextInput ? max * 4 : max;
                    
                    parsedVal = Math.max(safeMin, Math.min(safeMax, parsedVal));

                    // Ne pas forcer le rangeInput si on est hors limite pour ne pas brider le texte
                    if (parsedVal >= min && parsedVal <= max) {
                        rangeInput.value = parsedVal;
                    } else {
                        // Le slider reste bloqué à son bord visuellement
                        rangeInput.value = parsedVal > max ? max : min; 
                    }
                    
                    if (valDisplay && valDisplay.value !== parsedVal.toString()) {
                        valDisplay.value = parsedVal;
                    }

                    if (callbacks.onInput) callbacks.onInput(parsedVal);
                };

                rangeInput.addEventListener('input', (e) => update(e.target.value, false));
                rangeInput.addEventListener('change', (e) => {
                    if (callbacks.onChange) callbacks.onChange(parseInt(e.target.value, 10) || 0);
                });

                const maskBox = root.querySelector('#' + id + '-mask');
                if (maskBox) {
                    maskBox.addEventListener('change', () => {
                        if (callbacks.onMask) callbacks.onMask(!!maskBox.checked);
                    });
                }

                const extBox = root.querySelector('#' + id + '-ext');
                if (extBox) {
                    extBox.addEventListener('change', () => {
                        global.IlluImageAdjustCore.Slider.applyExtend(rangeInput, key, !!extBox.checked, options.isRaw);
                        // La valeur courante peut sortir des nouvelles bornes.
                        const v = parseInt(rangeInput.value, 10) || 0;
                        update(v, false);
                        if (callbacks.onExtend) callbacks.onExtend(!!extBox.checked);
                    });
                }
                
                if (valDisplay) {
                    valDisplay.addEventListener('input', (e) => update(e.target.value, true));
                    valDisplay.addEventListener('change', (e) => {
                        update(e.target.value, true);
                        if (callbacks.onChange) callbacks.onChange(parseInt(e.target.value, 10) || 0);
                    });
                }
            },
            
            /** Bornes d'un réglage, éventuellement étendues. */
            rangeFor(key, isRaw, extended) {
                const table = isRaw ? (METADATA.RANGES_RAW || METADATA.RANGES) : METADATA.RANGES;
                const r = table[key] || METADATA.RANGES[key] || [0, 100];
                if (!extended) return r;
                const f = METADATA.RANGE_EXTEND_FACTOR || 2;
                return [Math.round(r[0] * f), Math.round(r[1] * f)];
            },

            applyExtend(rangeInput, key, extended, isRaw) {
                if (!rangeInput) return;
                const r = this.rangeFor(key, isRaw, extended);
                rangeInput.setAttribute('min', r[0]);
                rangeInput.setAttribute('max', r[1]);
                let v = parseInt(rangeInput.value, 10) || 0;
                v = Math.max(r[0], Math.min(r[1], v));
                rangeInput.value = v;
            },

            updateRanges(root, idPrefix, isRaw) {
                if (!root) return;
                const ranges = isRaw ? (METADATA.RANGES_RAW || METADATA.RANGES) : METADATA.RANGES;
                for (const key in ranges) {
                    const rangeInput = root.querySelector('#' + idPrefix + key);
                    if (rangeInput) {
                        // Une course déjà étendue par l'utilisateur le reste
                        // quand on bascule entre 8 bits et RAW.
                        const extBox = root.querySelector('#' + idPrefix + key + '-ext');
                        const eff = this.rangeFor(key, isRaw, !!(extBox && extBox.checked));
                        rangeInput.setAttribute('min', eff[0]);
                        rangeInput.setAttribute('max', eff[1]);
                        
                        // Re-clamp current value to new limits
                        let val = parseInt(rangeInput.value, 10) || 0;
                        val = Math.max(eff[0], Math.min(eff[1], val));
                        rangeInput.value = val;
                        
                        const valDisplay = root.querySelector('#' + idPrefix + key + '-val');
                        if (valDisplay) valDisplay.innerText = val;
                    }
                }
            }
        };

        global.IlluImageAdjustCore.CurveEditor = {
            createHtml(idPrefix) {
                const t = (k, fb) => (global.IlluI18n && global.IlluI18n.t ? global.IlluI18n.t(k) : fb);
                return `
                    <div class="illu-curve-editor" id="${idPrefix}-curve-editor">
                        <div class="illu-curve-channels">
                            <select class="illu-curve-chan-sel" id="${idPrefix}-chan-sel">
                                <option value="curveMaster">${t('photo.chanMaster', 'Luminosité')}</option>
                                <option value="curveR">${t('photo.red', 'Rouge')}</option>
                                <option value="curveG">${t('photo.green', 'Vert')}</option>
                                <option value="curveB">${t('photo.blue', 'Bleu')}</option>
                            </select>
                        </div>
                        <div class="illu-curve-canvas-wrap">
                            <canvas class="illu-curve-canvas" width="256" height="256"></canvas>
                            <div class="illu-curve-grid"></div>
                        </div>
                        <div class="illu-curve-help">
                            ${t('photo.curveHelp', 'Clic : ajouter/déplacer | Clic-droit : supprimer')}
                        </div>
                    </div>
                `;
            },

            bind(root, idPrefix, params, onUpdate) {
                if (!params) return;
                const wrap = root.querySelector('#' + idPrefix + '-curve-editor');
                if (!wrap) return;
                const canvas = wrap.querySelector('canvas');
                const ctx = canvas.getContext('2d');
                const sel = wrap.querySelector('.illu-curve-chan-sel');
                let activeChan = 'curveMaster';
                let dragIdx = -1;

                const draw = () => {
                    const w = canvas.width;
                    const h = canvas.height;
                    ctx.clearRect(0, 0, w, h);

                    // Diagonale par défaut
                    ctx.strokeStyle = '#333';
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.stroke();
                    ctx.setLineDash([]);

                    if (!params[activeChan] || params[activeChan].length < 2) {
                        params[activeChan] = [{x:0, y:0}, {x:255, y:255}];
                    }

                    // On utilise createCurveLUT (défini plus haut dans le même fichier)
                    const lut = global.IlluImageAdjustCore.createCurveLUT(params[activeChan]);
                    ctx.strokeStyle = activeChan === 'curveMaster' ? '#fff' : (activeChan === 'curveR' ? '#f55' : (activeChan === 'curveG' ? '#5f5' : '#55f'));
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let i = 0; i < 256; i++) {
                        const px = i;
                        const py = 255 - lut[i];
                        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.stroke();

                    // Points de contrôle
                    params[activeChan].forEach((p, idx) => {
                        const dotColor = idx === dragIdx ? '#fff' : (activeChan === 'curveMaster' ? '#aaa' : ctx.strokeStyle);
                        ctx.beginPath();
                        ctx.arc(p.x, 255 - p.y, 4, 0, Math.PI * 2);
                        ctx.fillStyle = dotColor;
                        ctx.fill();
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    });
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = activeChan === 'curveMaster' ? '#fff' : (activeChan === 'curveR' ? '#f55' : (activeChan === 'curveG' ? '#5f5' : '#55f'));
                };
                canvas._forceDraw = draw;
                // Édition de courbe au doigt / stylet : le canevas capte le geste sans défilement.
                canvas.style.touchAction = 'none';

                canvas.onpointerdown = (e) => {
                    if (e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
                    const rect = canvas.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 255);
                    const y = Math.round((1 - (e.clientY - rect.top) / rect.height) * 255);

                    if (e.button === 2) {
                        const idx = params[activeChan].findIndex(p => Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10);
                        if (idx !== -1 && params[activeChan].length > 2) {
                            params[activeChan].splice(idx, 1);
                            draw(); if (onUpdate) onUpdate();
                        }
                        return false;
                    }

                    dragIdx = params[activeChan].findIndex(p => Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 8);
                    if (dragIdx === -1) {
                        params[activeChan].push({x, y});
                        params[activeChan].sort((a,b) => a.x - b.x);
                        dragIdx = params[activeChan].findIndex(p => p.x === x && p.y === y);
                    }
                    draw();
                };

                const moveHandler = (e) => {
                    if (dragIdx === -1) return;
                    const rect = canvas.getBoundingClientRect();
                    let x = Math.round(((e.clientX - rect.left) / rect.width) * 255);
                    let y = Math.round((1 - (e.clientY - rect.top) / rect.height) * 255);
                    
                    x = Math.max(0, Math.min(255, x));
                    y = Math.max(0, Math.min(255, y));

                    const pts = params[activeChan];
                    // On ne peut pas croiser les voisins
                    const minX = dragIdx > 0 ? pts[dragIdx-1].x + 1 : 0;
                    const maxX = dragIdx < pts.length - 1 ? pts[dragIdx+1].x - 1 : 255;
                    
                    pts[dragIdx].x = Math.max(minX, Math.min(maxX, x));
                    pts[dragIdx].y = y;

                    draw();
                    if (onUpdate) onUpdate();
                };

                const upHandler = () => { dragIdx = -1; draw(); };

                window.addEventListener('pointermove', moveHandler);
                window.addEventListener('pointerup', upHandler);
                window.addEventListener('pointercancel', upHandler);
                canvas.oncontextmenu = (e) => e.preventDefault();
                sel.onchange = (e) => { activeChan = e.target.value; draw(); };

                // Nettoyage en cas de suppression du DOM (approximatif ici)
                wrap._cleanupCurve = () => {
                    window.removeEventListener('pointermove', moveHandler);
                    window.removeEventListener('pointerup', upHandler);
                    window.removeEventListener('pointercancel', upHandler);
                };
                
                wrap._forceDrawCurve = draw;

                draw();
            }
        };

        global.IlluImageAdjustCore.HSLManager = {
            createHtml(idPrefix) {
                const t = (k, fb) => (global.IlluI18n && global.IlluI18n.t ? global.IlluI18n.t(k) : fb);
                const colors = [
                    { label: t('photo.red', 'Rouge'), grad: '#f55' },
                    { label: t('photo.orange', 'Orange'), grad: '#f95' },
                    { label: t('photo.yellow', 'Jaune'), grad: '#ff5' },
                    { label: t('photo.green', 'Vert'), grad: '#5f5' },
                    { label: t('photo.aqua', 'Aqua'), grad: '#5ff' },
                    { label: t('photo.blue', 'Bleu'), grad: '#55f' },
                    { label: t('photo.purple', 'Violet'), grad: '#a5f' },
                    { label: t('photo.magenta', 'Magenta'), grad: '#f5f' }
                ];

                const buildTab = (tabId) => {
                    const tabRanges = {
                        hslSat: [-70, 70],
                        hslLum: [-60, 60],
                        hslHue: [-45, 45]
                    };
                    const tabRange = tabRanges[tabId] || [-60, 60];
                    return `
                    <div class="illu-hsl-tab" id="${idPrefix}-${tabId}" style="display:none; padding-top:10px">
                        ${colors.map((c, i) => `
                            <div class="illu-pm-row illu-pm-row--mini" style="margin-bottom:6px">
                                <label style="font-size:9px"><span>${c.label}</span> <span class="val" id="${idPrefix}-${tabId}-${i}-val">0</span></label>
                                <div class="illu-cr-range-wrap" style="height:6px; border-radius:3px; position:relative;">
                                    <div style="position:absolute; left:0; top:0; height:100%; width:100%; pointer-events:none; opacity:0.35; background:${c.grad}"></div>
                                    <input type="range" class="illu-cr-range" id="${idPrefix}-${tabId}-${i}" min="${tabRange[0]}" max="${tabRange[1]}" value="0" style="position:relative; z-index:1">
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                };

                return `
                    <div class="illu-hsl-manager" id="${idPrefix}-hsl-manager">
                        <div class="illu-hsl-tabs-h illu-scope-btn-row">
                            <button class="illu-hsl-tab-btn illu-scope-btn illu-scope-btn--active" data-target="hslSat">${t('photo.saturation', 'Saturation')}</button>
                            <button class="illu-hsl-tab-btn illu-scope-btn" data-target="hslLum">${t('photo.luminance', 'Luminance')}</button>
                            <button class="illu-hsl-tab-btn illu-scope-btn" data-target="hslHue">${t('photo.hue', 'Teinte')}</button>
                        </div>
                        ${buildTab('hslSat')}
                        ${buildTab('hslLum')}
                        ${buildTab('hslHue')}
                    </div>
                `;
            },

            bind(root, idPrefix, params, onUpdate) {
                if (!params) return;
                const wrap = root.querySelector('#' + idPrefix + '-hsl-manager');
                if (!wrap) return;
                
                const tabs = wrap.querySelectorAll('.illu-hsl-tab');
                const btns = wrap.querySelectorAll('.illu-hsl-tab-btn');

                const showTab = (tabId) => {
                    tabs.forEach(t => t.style.display = t.id === idPrefix + '-' + tabId ? 'block' : 'none');
                    btns.forEach(b => {
                        const active = b.dataset.target === tabId;
                        b.classList.toggle('illu-scope-btn--active', active);
                    });
                };

                btns.forEach(btn => btn.onclick = () => showTab(btn.dataset.target));
                showTab('hslSat');

                ['hslHue', 'hslSat', 'hslLum'].forEach(tabId => {
                    const tabArr = params[tabId] || [0,0,0,0,0,0,0,0];
                    for (let i = 0; i < 8; i++) {
                        const input = wrap.querySelector('#' + idPrefix + '-' + tabId + '-' + i);
                        const valText = wrap.querySelector('#' + idPrefix + '-' + tabId + '-' + i + '-val');
                        if (!input) continue;

                        input.value = tabArr[i];
                        if (valText) valText.innerText = (tabArr[i] > 0 ? '+' : '') + tabArr[i];

                        input.oninput = (e) => {
                            const v = parseInt(e.target.value, 10);
                            tabArr[i] = v;
                            if (valText) valText.innerText = (v > 0 ? '+' : '') + v;
                            if (onUpdate) onUpdate();
                        };
                    }
                });
                wrap._syncUI = () => {
                    ['hslHue', 'hslSat', 'hslLum'].forEach(tabId => {
                        const tabArr = params[tabId] || [0, 0, 0, 0, 0, 0, 0, 0];
                        for (let i = 0; i < 8; i++) {
                            const input = wrap.querySelector('#' + idPrefix + '-' + tabId + '-' + i);
                            const valText = wrap.querySelector('#' + idPrefix + '-' + tabId + '-' + i + '-val');
                            if (input) {
                                input.value = tabArr[i];
                                if (valText) valText.innerText = (tabArr[i] > 0 ? '+' : '') + tabArr[i];
                            }
                        }
                    });
                };
            }

        };
    }
})(typeof self !== 'undefined' ? self : window);
