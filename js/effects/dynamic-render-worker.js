importScripts('../WasmManager.js');

function clamp255(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
}

function rgbToHsv255(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d > 1e-6) {
        if (max === rn) h = ((gn - bn) / d) % 6;
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const s = max <= 1e-6 ? 0 : d / max;
    return { h, s: s * 255, v: max * 255 };
}

function hsvToRgb255(h, s, v) {
    const hn = (((h % 360) + 360) % 360) / 60;
    const sn = Math.max(0, Math.min(1, s / 255));
    const vn = Math.max(0, Math.min(1, v / 255));
    const c = vn * sn;
    const x = c * (1 - Math.abs((hn % 2) - 1));
    const m = vn - c;
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;
    if (hn < 1) {
        r1 = c; g1 = x;
    } else if (hn < 2) {
        r1 = x; g1 = c;
    } else if (hn < 3) {
        g1 = c; b1 = x;
    } else if (hn < 4) {
        g1 = x; b1 = c;
    } else if (hn < 5) {
        r1 = x; b1 = c;
    } else {
        r1 = c; b1 = x;
    }
    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255)
    };
}

function sampleNearest(data, w, h, x, y, out, oi) {
    const sx = x < 0 ? 0 : x >= w ? w - 1 : x;
    const sy = y < 0 ? 0 : y >= h ? h - 1 : y;
    const i = (sy * w + sx) * 4;
    out[oi] = data[i];
    out[oi + 1] = data[i + 1];
    out[oi + 2] = data[i + 2];
    out[oi + 3] = data[i + 3];
}

function boxBlurImageDataPass(srcData, w, h, radius, horizontal) {
    const out = new Uint8ClampedArray(srcData.length);
    const r = Math.max(1, Math.min(32, radius | 0));
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sr = 0;
            let sg = 0;
            let sb = 0;
            let cnt = 0;
            for (let d = -r; d <= r; d++) {
                const nx = horizontal ? Math.max(0, Math.min(w - 1, x + d)) : x;
                const ny = horizontal ? y : Math.max(0, Math.min(h - 1, y + d));
                const j = (ny * w + nx) * 4;
                sr += srcData[j];
                sg += srcData[j + 1];
                sb += srcData[j + 2];
                cnt++;
            }
            const i = (y * w + x) * 4;
            out[i] = sr / cnt;
            out[i + 1] = sg / cnt;
            out[i + 2] = sb / cnt;
            out[i + 3] = srcData[i + 3];
        }
    }
    return out;
}

function boxBlurRgbOnly(src, w, h, radius) {
    let d = boxBlurImageDataPass(src, w, h, radius, true);
    d = boxBlurImageDataPass(d, w, h, radius, false);
    if (radius > 1) {
        d = boxBlurImageDataPass(d, w, h, Math.max(1, Math.round(radius * 0.6)), true);
        d = boxBlurImageDataPass(d, w, h, Math.max(1, Math.round(radius * 0.6)), false);
    }
    return d;
}

function boxBlurFullPass(srcData, w, h, radius, horizontal) {
    const out = new Uint8ClampedArray(srcData.length);
    const r = Math.max(1, Math.min(64, radius | 0));
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sr = 0, sg = 0, sb = 0, sa = 0;
            let cnt = 0;
            for (let d = -r; d <= r; d++) {
                const nx = horizontal ? x + d : x;
                const ny = horizontal ? y : y + d;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                const j = (ny * w + nx) * 4;
                sr += srcData[j];
                sg += srcData[j + 1];
                sb += srcData[j + 2];
                sa += srcData[j + 3];
                cnt++;
            }
            if (cnt === 0) continue;
            const i = (y * w + x) * 4;
            out[i] = sr / cnt;
            out[i + 1] = sg / cnt;
            out[i + 2] = sb / cnt;
            out[i + 3] = sa / cnt;
        }
    }
    return out;
}

function boxBlurFull(src, w, h, radius) {
    let d = boxBlurFullPass(src, w, h, radius, true);
    d = boxBlurFullPass(d, w, h, radius, false);
    if (radius > 2) {
        d = boxBlurFullPass(d, w, h, Math.max(1, Math.round(radius * 0.6)), true);
        d = boxBlurFullPass(d, w, h, Math.max(1, Math.round(radius * 0.6)), false);
    }
    return d;
}

function unsharpRgb(src, w, h, blurRadius, amount) {
    const blurred = boxBlurRgbOnly(src, w, h, Math.max(1, blurRadius | 0));
    const out = new Uint8ClampedArray(src.length);
    const a = Math.max(0, Math.min(2.5, amount));
    for (let i = 0; i < src.length; i += 4) {
        out[i] = clamp255(Math.round(src[i] + (src[i] - blurred[i]) * a));
        out[i + 1] = clamp255(Math.round(src[i + 1] + (src[i + 1] - blurred[i + 1]) * a));
        out[i + 2] = clamp255(Math.round(src[i + 2] + (src[i + 2] - blurred[i + 2]) * a));
        out[i + 3] = src[i + 3];
    }
    return out;
}

function pixelate(src, w, h, rad) {
    const bs = Math.max(2, Math.min(48, Math.round(rad * 2)));
    const out = new Uint8ClampedArray(src.length);
    for (let by = 0; by < h; by += bs) {
        for (let bx = 0; bx < w; bx += bs) {
            const sx = Math.min(w - 1, bx + ((bs / 2) | 0));
            const sy = Math.min(h - 1, by + ((bs / 2) | 0));
            const si = (sy * w + sx) * 4;
            const r = src[si];
            const g = src[si + 1];
            const b = src[si + 2];
            const a = src[si + 3];
            const yMax = Math.min(h, by + bs);
            const xMax = Math.min(w, bx + bs);
            for (let y = by; y < yMax; y++) {
                for (let x = bx; x < xMax; x++) {
                    const i = (y * w + x) * 4;
                    out[i] = r;
                    out[i + 1] = g;
                    out[i + 2] = b;
                    out[i + 3] = a;
                }
            }
        }
    }
    return out;
}

function applyPerPixelFilter(src, w, h, typ, rad) {
    const out = new Uint8ClampedArray(src.length);
    const r = Math.max(1, Math.min(32, rad | 0));
    const satMul = Math.max(0, Math.min(4, (30 + r * 20) / 100));
    const brightMul = Math.max(0.4, Math.min(2.2, 0.65 + r * 0.055));
    const contrastMul = Math.max(0.5, Math.min(2.2, 0.55 + r * 0.065));
    const hueRot = r * 14;
    const grayAmt = Math.min(1, (5 + r * 8) / 100);
    const sepiaAmt = Math.min(1, (8 + r * 6) / 100);
    const invertAmt = Math.min(1, (12 + r * 7) / 100);
    for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3];
        let rr = src[i];
        let gg = src[i + 1];
        let bb = src[i + 2];
        if (typ === 'grayscale') {
            const lum = rr * 0.299 + gg * 0.587 + bb * 0.114;
            rr = rr * (1 - grayAmt) + lum * grayAmt;
            gg = gg * (1 - grayAmt) + lum * grayAmt;
            bb = bb * (1 - grayAmt) + lum * grayAmt;
        } else if (typ === 'sepia') {
            const sr = rr * 0.393 + gg * 0.769 + bb * 0.189;
            const sg = rr * 0.349 + gg * 0.686 + bb * 0.168;
            const sb = rr * 0.272 + gg * 0.534 + bb * 0.131;
            rr = rr * (1 - sepiaAmt) + sr * sepiaAmt;
            gg = gg * (1 - sepiaAmt) + sg * sepiaAmt;
            bb = bb * (1 - sepiaAmt) + sb * sepiaAmt;
        } else if (typ === 'invert') {
            rr = rr * (1 - invertAmt) + (255 - rr) * invertAmt;
            gg = gg * (1 - invertAmt) + (255 - gg) * invertAmt;
            bb = bb * (1 - invertAmt) + (255 - bb) * invertAmt;
        } else if (typ === 'brightness') {
            rr *= brightMul;
            gg *= brightMul;
            bb *= brightMul;
        } else if (typ === 'contrast') {
            rr = (rr - 127.5) * contrastMul + 127.5;
            gg = (gg - 127.5) * contrastMul + 127.5;
            bb = (bb - 127.5) * contrastMul + 127.5;
        } else if (typ === 'saturate' || typ === 'hue') {
            const hsv = rgbToHsv255(rr, gg, bb);
            if (typ === 'saturate') hsv.s = Math.max(0, Math.min(255, hsv.s * satMul));
            if (typ === 'hue') hsv.h = (hsv.h + hueRot) % 360;
            const rgb = hsvToRgb255(hsv.h, hsv.s, hsv.v);
            rr = rgb.r;
            gg = rgb.g;
            bb = rgb.b;
        }
        out[i] = clamp255(Math.round(rr));
        out[i + 1] = clamp255(Math.round(gg));
        out[i + 2] = clamp255(Math.round(bb));
        out[i + 3] = a;
    }
    return out;
}

function applyDynamicFilterStage(src, w, h, typ, rad) {
    if (typeof MasterPaintWasm !== 'undefined' && MasterPaintWasm.isLoaded && MasterPaintWasm.isEffectSupported(typ)) {
        const res = MasterPaintWasm.applyFilter(typ, new ImageData(src, w, h), { radius: rad, size: rad, dotSize: rad });
        if (res) return res.data || res;
    }
    if (typ === 'pixelate') return pixelate(src, w, h, rad);
    if (typ === 'blur') return boxBlurRgbOnly(src, w, h, rad);
    if (typ === 'gaussian') {
        let cur = boxBlurRgbOnly(src, w, h, rad);
        cur = boxBlurRgbOnly(cur, w, h, Math.max(1, Math.round(rad * 0.55)));
        return cur;
    }
    if (typ === 'sharpen') return unsharpRgb(src, w, h, Math.max(1, Math.min(3, rad)), 0.55 + rad * 0.08);

    if (typ === 'halftone') {
        const out = new Uint8ClampedArray(src.length);
        const dotSize = Math.max(2, rad * 1.5);
        const freq = (2 * Math.PI) / dotSize;
        const angle = Math.PI / 4;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        for (let i = 0; i < src.length; i += 4) {
            const x = (i / 4) % w;
            const y = (i / 4 / w) | 0;
            const luma = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255;
            const rotX = x * cosA - y * sinA;
            const rotY = x * sinA + y * cosA;
            const pattern = (Math.sin(rotX * freq) + Math.sin(rotY * freq)) / 2;
            const threshold = (pattern + 1) / 2;
            const v = luma >= threshold ? 255 : 0;
            out[i] = out[i + 1] = out[i + 2] = v;
            out[i + 3] = src[i + 3];
        }
        return out;
    }
    if (typ === 'shadow') {
        const out = new Uint8ClampedArray(src.length);
        const r = Math.max(1, rad | 0);
        // Turn into black shadow (using existing alpha)
        for (let i = 0; i < src.length; i += 4) {
            out[i] = 0;
            out[i + 1] = 0;
            out[i + 2] = 0;
            out[i + 3] = src[i + 3];
        }
        // Blur both RGB and Alpha
        const shadow = boxBlurFull(out, w, h, r);
        
        // Blend original (src) OVER shadow
        // Formula: a_out = a_src + a_dst * (1 - a_src)
        //          c_out = (c_src * a_src + c_dst * a_dst * (1 - a_src)) / a_out
        const final = new Uint8ClampedArray(shadow);
        for (let i = 0; i < src.length; i += 4) {
            const as = src[i + 3] / 255;
            if (as >= 1) {
                // Fully opaque source pixel
                final[i] = src[i];
                final[i + 1] = src[i + 1];
                final[i + 2] = src[i + 2];
                final[i + 3] = 255;
            } else if (as > 0) {
                const ad = final[i + 3] / 255;
                const m = 1 - as;
                const ao = as + ad * m;
                if (ao > 0) {
                    const invAo = 1 / ao;
                    final[i] = (src[i] * as + final[i] * ad * m) * invAo;
                    final[i + 1] = (src[i + 1] * as + final[i + 1] * ad * m) * invAo;
                    final[i + 2] = (src[i + 2] * as + final[i + 2] * ad * m) * invAo;
                    final[i + 3] = Math.round(ao * 255);
                }
            }
        }
        return final;
    }
    return applyPerPixelFilter(src, w, h, typ, rad);
}

function applyDynamicFilterStack(src, w, h, stack) {
    let cur = new Uint8ClampedArray(src);
    for (let i = 0; i < stack.length; i++) {
        const fx = stack[i];
        cur = applyDynamicFilterStage(cur, w, h, fx.type, fx.radius);
    }
    return cur;
}

function buildDynamicMask(layerBuf, bw, bh, layerX, layerY, docW, docH, opacity) {
    const out = new Uint8ClampedArray(docW * docH * 4);
    const op = opacity != null ? opacity : 1;
    for (let py = 0; py < docH; py++) {
        for (let px = 0; px < docW; px++) {
            const lpx = px - layerX;
            const lpy = py - layerY;
            if (lpx < 0 || lpy < 0 || lpx >= bw || lpy >= bh) continue;
            const i = (py * docW + px) * 4;
            const j = (lpy * bw + lpx) * 4;
            const lum = (0.299 * layerBuf[j] + 0.587 * layerBuf[j + 1] + 0.114 * layerBuf[j + 2]) / 255;
            const aBuf = layerBuf[j + 3] / 255;
            out[i + 3] = clamp255(Math.round(lum * aBuf * op * 255));
        }
    }
    return out;
}

function blendDynamicMask(base, filtered, mask) {
    const out = new Uint8ClampedArray(base.length);
    const inv255 = 1 / 255;
    for (let i = 0; i < base.length; i += 4) {
        const m = mask[i + 3] * inv255;
        const om = 1 - m;
        out[i] = (base[i] * om + filtered[i] * m + 0.5) | 0;
        out[i + 1] = (base[i + 1] * om + filtered[i + 1] * m + 0.5) | 0;
        out[i + 2] = (base[i + 2] * om + filtered[i + 2] * m + 0.5) | 0;
        out[i + 3] = base[i + 3];
    }
    return out;
}

function alphaPreviewFromMask(mask) {
    const out = new Uint8ClampedArray(mask.length);
    for (let i = 0; i < mask.length; i += 4) {
        const m = mask[i + 3];
        out[i] = m;
        out[i + 1] = m;
        out[i + 2] = m;
        out[i + 3] = 255;
    }
    return out;
}

function applyLuminanceMaskToLayerDoc(layerBuf, bw, bh, layerX, layerY, maskBuf, mw, mh, docW, docH) {
    const out = new Uint8ClampedArray(docW * docH * 4);
    for (let py = 0; py < docH; py++) {
        for (let px = 0; px < docW; px++) {
            const lpx = px - layerX;
            const lpy = py - layerY;
            if (lpx < 0 || lpy < 0 || lpx >= bw || lpy >= bh) continue;
            const i = (py * docW + px) * 4;
            const j = (lpy * bw + lpx) * 4;
            out[i] = layerBuf[j];
            out[i + 1] = layerBuf[j + 1];
            out[i + 2] = layerBuf[j + 2];
            let alpha = layerBuf[j + 3];
            if (lpx < mw && lpy < mh) {
                const k = (lpy * mw + lpx) * 4;
                const lum = ((0.299 * maskBuf[k] + 0.587 * maskBuf[k + 1] + 0.114 * maskBuf[k + 2]) / 255) * (maskBuf[k + 3] / 255);
                alpha = Math.round(alpha * lum);
            }
            out[i + 3] = alpha;
        }
    }
    return out;
}

self.onmessage = async function (ev) {
    const msg = ev.data || {};
    const jobId = msg.jobId | 0;
    try {
        if (typeof MasterPaintWasm !== 'undefined' && !MasterPaintWasm.isLoaded) {
            await MasterPaintWasm.init();
        }
        if (msg.type === 'dynamicFilterLayer') {
            const mode = msg.mode | 0;
            const dw = msg.docWidth | 0;
            const dh = msg.docHeight | 0;
            const stack = Array.isArray(msg.stack) ? msg.stack : [];

            if (mode === 1) {
                // Mode 1: Effect on Self (Active Layer)
                const layerBuf = new Uint8ClampedArray(msg.layerBuffer);
                const lw = msg.layerWidth | 0;
                const lh = msg.layerHeight | 0;
                const lx = msg.layerX | 0;
                const ly = msg.layerY | 0;

                // Place layer in a document-sized buffer before filtering
                // to allow filters (like blur) to extend naturally.
                const selfFull = new Uint8ClampedArray(dw * dh * 4);
                for (let y = 0; y < lh; y++) {
                    const dy = y + ly;
                    if (dy < 0 || dy >= dh) continue;
                    for (let x = 0; x < lw; x++) {
                        const dx = x + lx;
                        if (dx < 0 || dx >= dw) continue;
                        const si = (y * lw + x) * 4;
                        const di = (dy * dw + dx) * 4;
                        selfFull[di] = layerBuf[si];
                        selfFull[di + 1] = layerBuf[si + 1];
                        selfFull[di + 2] = layerBuf[si + 2];
                        selfFull[di + 3] = layerBuf[si + 3];
                    }
                }

                const out = applyDynamicFilterStack(selfFull, dw, dh, stack);
                self.postMessage(
                    {
                        type: 'dynamicFilterLayerResult',
                        jobId,
                        width: dw,
                        height: dh,
                        buffer: out.buffer
                    },
                    [out.buffer]
                );
                return;
            }

            // Mode 0: Effect on Below (Legacy / Default)
            const base = new Uint8ClampedArray(msg.baseBuffer);
            const layerBuf = new Uint8ClampedArray(msg.layerBuffer);
            const lw = msg.layerWidth | 0;
            const lh = msg.layerHeight | 0;
            const lx = msg.layerX | 0;
            const ly = msg.layerY | 0;

            const wasm = typeof MasterPaintWasm !== 'undefined' && MasterPaintWasm.isLoaded;
            
            let mask;
            if (wasm) {
                mask = MasterPaintWasm.buildDynamicMask(
                    new ImageData(layerBuf, lw, lh),
                    lx, ly, dw, dh,
                    Number.isFinite(msg.opacity) ? msg.opacity : 1
                );
            } else {
                mask = buildDynamicMask(
                    layerBuf,
                    lw, lh, lx, ly,
                    dw, dh,
                    Number.isFinite(msg.opacity) ? msg.opacity : 1
                );
            }

            let filtered;
            if (msg.alphaPreview) {
                filtered = alphaPreviewFromMask(mask);
            } else {
                const stackRes = applyDynamicFilterStack(base, dw, dh, stack);
                if (wasm) {
                    filtered = MasterPaintWasm.blendMask(
                        new ImageData(base, dw, dh),
                        new ImageData(stackRes, dw, dh),
                        mask
                    );
                } else {
                    filtered = blendDynamicMask(base, stackRes, mask);
                }
            }
            
            const out = filtered.data || filtered;
            self.postMessage(
                {
                    type: 'dynamicFilterLayerResult',
                    jobId,
                    width: dw,
                    height: dh,
                    buffer: out.buffer
                },
                [out.buffer]
            );
            return;
        }
        if (msg.type === 'alphaMaskLayer') {
            const layerBuf = new Uint8ClampedArray(msg.layerBuffer);
            const maskBuf = new Uint8ClampedArray(msg.maskBuffer);
            const lw = msg.layerWidth | 0;
            const lh = msg.layerHeight | 0;
            const lx = msg.layerX | 0;
            const ly = msg.layerY | 0;
            const mw = msg.maskWidth | 0;
            const mh = msg.maskHeight | 0;
            const dw = msg.docWidth | 0;
            const dh = msg.docHeight | 0;

            let out;
            if (typeof MasterPaintWasm !== 'undefined' && MasterPaintWasm.isLoaded) {
                out = MasterPaintWasm.applyLuminanceMask(
                    new ImageData(layerBuf, lw, lh),
                    new ImageData(maskBuf, mw, mh),
                    lx, ly, dw, dh
                );
            } else {
                out = applyLuminanceMaskToLayerDoc(
                    layerBuf, lw, lh, lx, ly,
                    maskBuf, mw, mh,
                    dw, dh
                );
            }
            
            const outBuf = out.data || out;
            self.postMessage(
                {
                    type: 'alphaMaskLayerResult',
                    jobId,
                    width: dw,
                    height: dh,
                    buffer: outBuf.buffer
                },
                [outBuf.buffer]
            );
        }
    } catch (err) {
        self.postMessage({
            type: 'error',
            jobId,
            message: err && err.message ? err.message : String(err)
        });
    }
};
