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

    function applyCameraRawBuffer(src, width, height, p) {
        const isFloatArray = src instanceof Float32Array || (src && src.constructor && src.constructor.name === 'Float32Array');
        // --- WASM Engine Integration ---
        if (typeof MasterPaintWasm !== 'undefined' && MasterPaintWasm.isLoaded) {
            // Setup Curves LUTs (Graphiques en courbe) for Wasm
            const cbParams = {
                curveMaster: p.curveMaster && p.curveMaster.length > 0 ? { lut: createCurveLUT(p.curveMaster) } : null,
                curveR: p.curveR && p.curveR.length > 0 ? { lut: createCurveLUT(p.curveR) } : null,
                curveG: p.curveG && p.curveG.length > 0 ? { lut: createCurveLUT(p.curveG) } : null,
                curveB: p.curveB && p.curveB.length > 0 ? { lut: createCurveLUT(p.curveB) } : null
            };

            const res = MasterPaintWasm.applyCameraRaw(isFloatArray ? src : new ImageData(src, width, height), { 
                ...p, 
                cbParams,
                hsvMixParams: {
                    hslHue: p.hslHue,
                    hslSat: p.hslSat,
                    hslLum: p.hslLum
                },
                startY: (typeof FilterManager !== 'undefined' && typeof FilterManager._startY === 'number' ? FilterManager._startY : 0), 
                endY: (typeof FilterManager !== 'undefined' && typeof FilterManager._endY === 'number' ? FilterManager._endY : height)
            }, width, height);
            
            if (res) {
                if (isFloatArray) {
                    return res;
                }
                if (res.data) {
                    return new Uint8ClampedArray(res.data.buffer, res.data.byteOffset, res.data.byteLength);
                }
            }
        }

        const out = new Uint8ClampedArray(src.length);
        const expStops = (p.exposure / 100) * 2;
        const mult = Math.pow(2, expStops);
        const contrastF = (100 + p.contrast) / 100;

        // Setup Curves LUTs (Graphiques en courbe)
        const lutMaster = p.curveMaster && p.curveMaster.length > 0 ? createCurveLUT(p.curveMaster) : null;
        const lutR = p.curveR && p.curveR.length > 0 ? createCurveLUT(p.curveR) : null;
        const lutG = p.curveG && p.curveG.length > 0 ? createCurveLUT(p.curveG) : null;
        const lutB = p.curveB && p.curveB.length > 0 ? createCurveLUT(p.curveB) : null;

        // Setup HSL Selective Arrays
        const checkArray = (arr) => arr && arr.some(v => v !== 0);
        const hasHsl = checkArray(p.hslHue) || checkArray(p.hslSat) || checkArray(p.hslLum);
        const hslHueArr = p.hslHue || [0, 0, 0, 0, 0, 0, 0, 0];
        const hslSatArr = p.hslSat || [0, 0, 0, 0, 0, 0, 0, 0];
        const hslLumArr = p.hslLum || [0, 0, 0, 0, 0, 0, 0, 0];

        const isFloat = src instanceof Float32Array || (src && src.constructor && src.constructor.name === 'Float32Array');

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;

                let r, g, b, a;
                if (isFloat) {
                    // Float32Array data is already true linear light, no gamma conversion needed
                    r = src[i];
                    g = src[i + 1];
                    b = src[i + 2];
                    a = src[i + 3] * 255;
                } else {
                    r = SRGB_TO_LIN[src[i]];
                    g = SRGB_TO_LIN[src[i + 1]];
                    b = SRGB_TO_LIN[src[i + 2]];
                    a = src[i + 3];
                }

                r *= mult; g *= mult; b *= mult;

                // Temp & Tint based on luminance zones (preserving pure black and pure white highlights)
                const Y_orig = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                const Y_clamp = Math.max(0.0, Math.min(1.0, Y_orig));
                const wZone = Y_clamp * (1.0 - Y_clamp) * 4.0;
                const scaleDiv = isFloat ? 1000 : 100;

                if (p.temp !== 0) {
                    const t = (p.temp / scaleDiv) * wZone;
                    r *= Math.max(0.0, 1 + t * 0.12);
                    b *= Math.max(0.0, 1 - t * 0.12);
                    g *= Math.max(0.0, 1 + t * 0.02);
                }
                if (p.tint !== 0) {
                    const tn = (p.tint / scaleDiv) * wZone;
                    r *= Math.max(0.0, 1 + tn * 0.06);
                    b *= Math.max(0.0, 1 + tn * 0.06);
                    g *= Math.max(0.0, 1 - tn * 0.08);
                }

                // HDR-like Luma mapping
                let Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

                if (Y > 0.001) {
                    let yNew = Y;

                    // Highlights — ramp from Y=0.5 (w=0) to Y=1.0+ (w=1), quadratic
                    if (p.highlights !== 0) {
                        const hi = p.highlights / 100;
                        let w = Math.max(0, (yNew - 0.5) / 0.5);
                        w = w * w; // Quadratic: concentrated near whites
                        if (hi < 0 && yNew > 0.5) {
                            const over = yNew - 0.5;
                            yNew = 0.5 + over * Math.pow(over + 1.0, hi * 0.5);
                        } else {
                            yNew += hi * w * 1.5;
                        }
                    }

                    // Whites — only top range (Y > 0.7)
                    if (p.whites !== 0) {
                        const wh = p.whites / 100;
                        const w = Math.max(0, (yNew - 0.7) / 0.3);
                        if (wh < 0 && yNew > 0.7) {
                            const over = yNew - 0.7;
                            yNew = 0.7 + over * Math.pow(over + 1.0, wh * 0.6);
                        } else {
                            yNew += wh * w * 2.0;
                        }
                    }

                    yNew = Math.max(0, yNew);
                    const multLuma = yNew / Y;
                    r *= multLuma;
                    g *= multLuma;
                    b *= multLuma;

                    Y = yNew;
                }

                // Shadows (multiplicative tone adjustment, preserves blacks and avoids division explosions)
                if (p.shadows !== 0) {
                    const sh = p.shadows / 100;
                    const w = Math.max(0, 1 - (Y / 0.5));
                    const factor = Math.max(0, 1.0 + sh * w * w * 1.2);
                    r *= factor;
                    g *= factor;
                    b *= factor;
                }

                // Blacks (multiplicative tone adjustment, preserves blacks and avoids division explosions)
                if (p.blacks !== 0) {
                    const bl = p.blacks / 100;
                    const w = Math.max(0, 1 - (Y / 0.3));
                    const factor = Math.max(0, 1.0 + bl * w * w * 1.5);
                    r *= factor;
                    g *= factor;
                    b *= factor;
                }

                // Extended Reinhard tonemapping — preserves HDR range with smooth shoulder
                // Uses luminance-based mapping to maintain color ratios
                if (isFloat) {
                    const maxC = Math.max(r, g, b);
                    if (maxC > 0) {
                        // Reinhard with white point at 4.0 (preserves detail up to ~4 stops over mid-gray)
                        const Lw = 4.0;
                        const mappedMax = maxC * (1.0 + maxC / (Lw * Lw)) / (1.0 + maxC);
                        const ratio = mappedMax / maxC;
                        r *= ratio;
                        g *= ratio;
                        b *= ratio;
                    }
                }

                // --- RGB Split Toning ---
                if (p.red || p.redHi || p.redSh || p.green || p.greenHi || p.greenSh || p.blue || p.blueHi || p.blueSh) {
                    const wHi = Math.max(0, Y - 0.5) / 0.5;
                    const wSh = Math.max(0, 0.5 - Y) / 0.5;

                    if (p.red) r *= 1 + (p.red / 100);
                    if (p.redHi) r *= 1 + (p.redHi / 100) * wHi * 1.5;
                    if (p.redSh) r *= 1 + (p.redSh / 100) * wSh * 1.5;

                    if (p.green) g *= 1 + (p.green / 100);
                    if (p.greenHi) g *= 1 + (p.greenHi / 100) * wHi * 1.5;
                    if (p.greenSh) g *= 1 + (p.greenSh / 100) * wSh * 1.5;

                    if (p.blue) b *= 1 + (p.blue / 100);
                    if (p.blueHi) b *= 1 + (p.blueHi / 100) * wHi * 1.5;
                    if (p.blueSh) b *= 1 + (p.blueSh / 100) * wSh * 1.5;
                }

                // Conversion sRGB pour contraste, saturation, courbes et HSL
                let r8 = fastLinToSrgbByte(r);
                let g8 = fastLinToSrgbByte(g);
                let b8 = fastLinToSrgbByte(b);

                // Application du contraste global
                let lr = r8 / 255; let lg = g8 / 255; let lb = b8 / 255;
                lr = clamp01(0.5 + (lr - 0.5) * contrastF);
                lg = clamp01(0.5 + (lg - 0.5) * contrastF);
                lb = clamp01(0.5 + (lb - 0.5) * contrastF);
                r8 = (lr * 255) | 0; g8 = (lg * 255) | 0; b8 = (lb * 255) | 0;

                // Application des Courbes (Curves)
                if (lutMaster) {
                    r8 = lutMaster[r8]; g8 = lutMaster[g8]; b8 = lutMaster[b8];
                }
                if (lutR) r8 = lutR[r8];
                if (lutG) g8 = lutG[g8];
                if (lutB) b8 = lutB[b8];

                // --- TSL / HSL & Vibrance ---
                if (p.saturation !== 0 || p.vibrance !== 0 || hasHsl || (p.dehaze && p.dehaze !== 0)) {
                    let hsl = rgbToHsl(r8, g8, b8);

                    // Réglage HSL Sélectif par couleur (Pro)
                    if (hasHsl) {
                        const w = getHslWeightsFast(hsl.h);
                        const hShift = (hslHueArr[w.i1] * w.w1 + hslHueArr[w.i2] * w.w2);
                        const sShift = (hslSatArr[w.i1] * w.w1 + hslSatArr[w.i2] * w.w2);
                        const lShift = (hslLumArr[w.i1] * w.w1 + hslLumArr[w.i2] * w.w2);

                        hsl.h = (hsl.h + hShift + 360) % 360;
                        hsl.s = Math.max(0, Math.min(100, hsl.s + sShift));
                        hsl.l = Math.max(0, Math.min(100, hsl.l + lShift));
                    }

                    // Global Saturation & Vibrance
                    let s = hsl.s;
                    const satM = 1 + p.saturation / 100;
                    s = clamp01((s / 100) * satM) * 100;

                    if (p.vibrance !== 0) {
                        const vib = p.vibrance / 100;
                        const lowSatBoost = (1 - s / 100) * vib * 40;
                        s = Math.max(0, Math.min(100, s + lowSatBoost));
                    }

                    // Dehaze boost saturation lightly
                    if (p.dehaze && p.dehaze !== 0) {
                        s = Math.min(100, s + (p.dehaze / 100) * 15 * (1 - hsl.l / 100));
                    }

                    hsl.s = s;
                    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
                    r8 = rgb.r; g8 = rgb.g; b8 = rgb.b;
                }

                out[i] = r8; out[i + 1] = g8; out[i + 2] = b8; out[i + 3] = a;
            }
        }

        return out;
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

    function suggestAutoParams(imageData) {
        const data = imageData.data;
        const nPx = Math.max(1, (data.length / 4) | 0);
        const sampleTarget = 24000;
        const pxStep = Math.max(1, Math.floor(nPx / sampleTarget));
        const lumHist = new Uint32Array(256);
        let sampled = 0;
        let sumY = 0;
        let sumY2 = 0;
        let sumSat = 0;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let gradSum = 0;
        let gradCount = 0;
        let edgeSum = 0;
        let edgeCount = 0;

        const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));
        const lerp = (a, b, t) => a + (b - a) * t;
        const satFromRgb = (r, g, b) => {
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            if (max <= 1e-6) return 0;
            return ((max - min) / max) * 100;
        };
        const getPct = (hist, pct, total) => {
            const target = Math.max(0, Math.min(total - 1, Math.round((pct / 100) * (total - 1))));
            let acc = 0;
            for (let i = 0; i < 256; i++) {
                acc += hist[i];
                if (acc > target) return i;
            }
            return 255;
        };

        for (let p = 0; p < nPx; p += pxStep) {
            const i = p * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const y = 0.299 * r + 0.587 * g + 0.114 * b;
            const yi = y < 0 ? 0 : y > 255 ? 255 : y | 0;
            lumHist[yi]++;
            sampled++;
            sumY += y;
            sumY2 += y * y;
            sumSat += satFromRgb(r, g, b);
            sumR += r;
            sumG += g;
            sumB += b;

            // Quick sharpness proxy from local luma gradients.
            const x = p % imageData.width;
            const yPos = (p / imageData.width) | 0;
            if (x + 1 < imageData.width && yPos + 1 < imageData.height) {
                const iR = i + 4;
                const iD = i + imageData.width * 4;
                const yR = 0.299 * data[iR] + 0.587 * data[iR + 1] + 0.114 * data[iR + 2];
                const yD = 0.299 * data[iD] + 0.587 * data[iD + 1] + 0.114 * data[iD + 2];
                gradSum += Math.abs(y - yR) + Math.abs(y - yD);
                gradCount++;
            }

            // Edge luminance for subtle vignette compensation.
            const edgeBand = Math.max(8, Math.round(Math.min(imageData.width, imageData.height) * 0.1));
            if (
                x < edgeBand ||
                x >= imageData.width - edgeBand ||
                yPos < edgeBand ||
                yPos >= imageData.height - edgeBand
            ) {
                edgeSum += y;
                edgeCount++;
            }
        }

        if (sampled < 1) return {};

        const avgY = sumY / sampled;
        const stdY = Math.sqrt(Math.max(0, sumY2 / sampled - avgY * avgY));
        const avgSat = sumSat / sampled;
        const avgR = sumR / sampled;
        const avgG = sumG / sampled;
        const avgB = sumB / sampled;
        const edgeAvg = edgeCount > 0 ? edgeSum / edgeCount : avgY;
        const p01 = getPct(lumHist, 1, sampled);
        const p05 = getPct(lumHist, 5, sampled);
        const p50 = getPct(lumHist, 50, sampled);
        const p95 = getPct(lumHist, 95, sampled);
        const p99 = getPct(lumHist, 99, sampled);
        const dyn = Math.max(1, p95 - p05);
        const highClip = (lumHist[250] + lumHist[251] + lumHist[252] + lumHist[253] + lumHist[254] + lumHist[255]) / sampled;
        const lowClip = (lumHist[0] + lumHist[1] + lumHist[2] + lumHist[3] + lumHist[4] + lumHist[5]) / sampled;
        const gradMean = gradCount > 0 ? gradSum / gradCount : 0;

        // Exposure: center midtones, but strongly protect highlights.
        const targetMid = 125;
        let midBias = (targetMid - lerp(p50, avgY, 0.4)) * 0.9;
        if (highClip > 0.01) {
            midBias -= (highClip * 500); 
        }
        const exposure = clamp(Math.round(midBias), -130, 130);

        // Contrast: User wants MORE contrast, punchier look!
        const dynTarget = 210;
        const contrastFromDyn = (dynTarget - dyn) * 0.6;
        const contrastFromStd = (65 - stdY) * 0.5;
        const contrast = clamp(Math.round(contrastFromDyn + contrastFromStd + 15), -40, 75);

        // Tonal recovery: No burned whites! (Aggressive recovery)
        const highlights = clamp(Math.round(-highClip * 800 - Math.max(0, p95 - 230) * 0.8), -100, 30);
        const whites = clamp(Math.round((245 - p99) * 0.5 - highClip * 400), -80, 20);
        
        // Less burned blacks (permissive but protected)
        const shadows = clamp(Math.round(lowClip * 300 + Math.max(0, 20 - p05) * 0.6), -20, 60);
        const blacks = clamp(Math.round((p01 - 5) * 0.4 - lowClip * 150), -35, 30);

        // White balance from global channel bias.
        const rbDelta = (avgR - avgB) / 255;
        const gBias = (avgG - (avgR + avgB) * 0.5) / 255;
        const temp = clamp(Math.round(-rbDelta * 110), -70, 70);
        const tint = clamp(Math.round(-gBias * 140), -60, 60);

        // Color/texture: More colorful & clear
        const vibrance = clamp(Math.round((42 - avgSat) * 1.1), -10, 55);
        const saturation = clamp(Math.round((30 - avgSat) * 0.4), -10, 25);
        const clarity = clamp(Math.round((50 - stdY) * 0.6 + 10), -10, 45);
        const dehaze = clamp(Math.round((46 - stdY) * 0.3 + (avgY > 160 ? 10 : 0)), -5, 30);

        // Sharpen only when source looks soft.
        const sharpen = clamp(Math.round((14 - gradMean) * 2.5), 0, 40);

        // Subtle vignette correction only when edges are too bright.
        const vignette = clamp(Math.round((edgeAvg - avgY) * 0.25), -20, 25);

        return {
            exposure,
            contrast,
            highlights,
            shadows,
            whites,
            blacks,
            temp,
            tint,
            vibrance,
            saturation,
            clarity,
            dehaze,
            vignette,
            sharpen
        };
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
            hslHue: [0, 0, 0, 0, 0, 0, 0, 0], hslSat: [0, 0, 0, 0, 0, 0, 0, 0], hslLum: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        RANGES: {
            // Plages "raisonnables mais créatives": éviter les aplats/cassures trop brutales,
            // tout en gardant de la marge pour des looks marqués.
            exposure: [-150, 150], contrast: [-80, 80], highlights: [-170, 170], shadows: [-170, 170],
            whites: [-140, 140], blacks: [-140, 140], temp: [-1000, 1000], tint: [-1000, 1000],
            vibrance: [-90, 90], saturation: [-80, 80], clarity: [-70, 70], dehaze: [-70, 70], vignette: [-85, 85],
            red: [-80, 80], redHi: [-70, 70], redSh: [-70, 70],
            green: [-80, 80], greenHi: [-70, 70], greenSh: [-70, 70],
            blue: [-80, 80], blueHi: [-70, 70], blueSh: [-70, 70],
            grain: [0, 100], sharpen: [0, 100], grainSharpness: [0, 100]
        },
        RANGES_RAW: {
            // Plages EXTRÊMES pour un contrôle total de la dynamique 14-bit RAW
            exposure: [-400, 400], contrast: [-200, 200], highlights: [-400, 400], shadows: [-400, 400],
            whites: [-300, 300], blacks: [-300, 300], temp: [-1500, 1500], tint: [-1500, 1500],
            vibrance: [-150, 150], saturation: [-150, 150], clarity: [-150, 150], dehaze: [-150, 150], vignette: [-150, 150],
            red: [-150, 150], redHi: [-150, 150], redSh: [-150, 150],
            green: [-150, 150], greenHi: [-150, 150], greenSh: [-150, 150],
            blue: [-150, 150], blueHi: [-150, 150], blueSh: [-150, 150],
            grain: [0, 150], sharpen: [0, 150], grainSharpness: [0, 150]
        },
        UI_LAYOUT: [
            {
                id: 'sec-light',
                title: 'photo.secLight', fallback: 'Lumière',
                hasAuto: true,
                sliders: [
                    { id: 'exposure', label: 'photo.exposure', fallback: 'Exposition' },
                    { id: 'contrast', label: 'photo.contrast', fallback: 'Contraste' },
                    { id: 'highlights', label: 'photo.highlights', fallback: 'Hautes lumières' },
                    { id: 'shadows', label: 'photo.shadows', fallback: 'Ombres' },
                    { id: 'whites', label: 'photo.whites', fallback: 'Blancs' },
                    { id: 'blacks', label: 'photo.blacks', fallback: 'Noirs' }
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
                    { id: 'clarity', label: 'photo.clarity', fallback: 'Clarté (Micro-contraste)' },
                    { id: 'dehaze', label: 'photo.dehaze', fallback: 'Correction du voile' },
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
                
                if (valDisplay) {
                    valDisplay.addEventListener('input', (e) => update(e.target.value, true));
                    valDisplay.addEventListener('change', (e) => {
                        update(e.target.value, true);
                        if (callbacks.onChange) callbacks.onChange(parseInt(e.target.value, 10) || 0);
                    });
                }
            },
            
            updateRanges(root, idPrefix, isRaw) {
                if (!root) return;
                const ranges = isRaw ? (METADATA.RANGES_RAW || METADATA.RANGES) : METADATA.RANGES;
                for (const key in ranges) {
                    const rangeInput = root.querySelector('#' + idPrefix + key);
                    if (rangeInput) {
                        rangeInput.setAttribute('min', ranges[key][0]);
                        rangeInput.setAttribute('max', ranges[key][1]);
                        
                        // Re-clamp current value to new limits
                        let val = parseInt(rangeInput.value, 10) || 0;
                        val = Math.max(ranges[key][0], Math.min(ranges[key][1], val));
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


                canvas.onmousedown = (e) => {
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

                window.addEventListener('mousemove', moveHandler);
                window.addEventListener('mouseup', upHandler);
                canvas.oncontextmenu = (e) => e.preventDefault();
                sel.onchange = (e) => { activeChan = e.target.value; draw(); };

                // Nettoyage en cas de suppression du DOM (approximatif ici)
                wrap._cleanupCurve = () => {
                    window.removeEventListener('mousemove', moveHandler);
                    window.removeEventListener('mouseup', upHandler);
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
     function applyPostCameraRaw(src, width, height, p) {
        if (!p.vignette && !p.grain && !p.sharpen && !p.clarity && !p.dehaze) return src;
        const isFloat = src instanceof Float32Array;
        const out = new (isFloat ? Float32Array : Uint8ClampedArray)(src.length);
        out.set(src);
        
        const hasVignette = p.vignette && p.vignette !== 0;
        const vAmt = p.vignette ? p.vignette / 100 : 0;
        
        const hasGrain = p.grain && p.grain > 0;
        const grainAmt = p.grain ? p.grain / 100 : 0;
        const gs = (p.grainSharpness != null ? p.grainSharpness : 50) / 100;
        
        const hasDehaze = p.dehaze && p.dehaze !== 0;
        const dehazeAmt = p.dehaze ? p.dehaze / 100 : 0;
        
        const hasClarity = p.clarity && p.clarity !== 0;
        const clarityAmt = p.clarity ? p.clarity / 100 : 0;
        
        if (hasVignette || hasGrain || hasDehaze || hasClarity) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    let r = out[i], g = out[i+1], b = out[i+2];
                    
                    if (hasDehaze || hasClarity) {
                        // Very simple clarity/dehaze approximation (global midtone contrast)
                        let luma = 0.299 * r + 0.587 * g + 0.114 * b;
                        let maxVal = isFloat ? 1.0 : 255.0;
                        let lumaNorm = luma / maxVal;
                        
                        if (hasDehaze) {
                            // Dehaze: subtract light from shadows, boost saturation
                            let sub = dehazeAmt * maxVal * 0.2 * (1.0 - lumaNorm);
                            r = Math.max(0, r - sub);
                            g = Math.max(0, g - sub);
                            b = Math.max(0, b - sub);
                            // saturation boost
                            let satBoost = 1.0 + (dehazeAmt * 0.5);
                            luma = 0.299 * r + 0.587 * g + 0.114 * b;
                            r = luma + (r - luma) * satBoost;
                            g = luma + (g - luma) * satBoost;
                            b = luma + (b - luma) * satBoost;
                        }
                        
                        if (hasClarity) {
                            // Clarity: midtone contrast
                            let midCurve = Math.sin(lumaNorm * Math.PI); // 1.0 at midtones, 0 at shadows/highlights
                            let contrast = 1.0 + (clarityAmt * midCurve * 0.5);
                            luma = 0.299 * r + 0.587 * g + 0.114 * b;
                            r = luma + (r - luma) * contrast;
                            g = luma + (g - luma) * contrast;
                            b = luma + (b - luma) * contrast;
                        }
                    }
                    
                    if (hasVignette) {
                        const cx = (x / width) - 0.5;
                        const cy = (y / height) - 0.5;
                        const dist = Math.sqrt(cx * cx + cy * cy) * 2.0;
                        const falloff = Math.pow(Math.min(1, Math.max(0, dist)), 2.5);
                        const factor = 1 - (vAmt * falloff);
                        r *= factor; g *= factor; b *= factor;
                    }
                    
                    if (hasGrain) {
                        let maxVal = isFloat ? 1.0 : 255.0;
                        const gn = (Math.random() - 0.5) * grainAmt * maxVal * (0.2 + 0.4 * gs);
                        r += gn; g += gn; b += gn;
                    }
                    
                    if (isFloat) {
                        out[i] = r; out[i+1] = g; out[i+2] = b;
                    } else {
                        out[i] = r < 0 ? 0 : (r > 255 ? 255 : r);
                        out[i+1] = g < 0 ? 0 : (g > 255 ? 255 : g);
                        out[i+2] = b < 0 ? 0 : (b > 255 ? 255 : b);
                    }
                }
            }
        }
        
        if (p.sharpen && p.sharpen > 0) {
            return applySharpen(out, width, height, p.sharpen, isFloat);
        }
        return out;
    }
})(typeof self !== 'undefined' ? self : window);
