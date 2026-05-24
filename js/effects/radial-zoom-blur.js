/**
 * Flou radial (tangential) et flou de zoom — utilisable main thread et worker.
 * @param {Uint8ClampedArray} src RGBA
 * @param {number} w
 * @param {number} h
 * @param {{ cx?:number, cy?:number, sharpPct?:number, startPct?:number, intensity?:number, angleDeg?:number, startY?:number, endY?:number, sampleBilinear?:(src,w,h,x,y)=>[number,number,number,number] }} opts
 */
(function (global) {
    'use strict';

    function defaultSample(src, w, h, x, y) {
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x >= w - 1) x = w - 1 - 1e-6;
        if (y >= h - 1) y = h - 1 - 1e-6;
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        const tx = x - x0;
        const ty = y - y0;
        const idx = (yy, xx) => (yy * w + xx) * 4;
        const lerp = (a, b, t) => a + (b - a) * t;
        const i00 = idx(y0, x0);
        const i10 = idx(y0, x1);
        const i01 = idx(y1, x0);
        const i11 = idx(y1, x1);
        const ch = (o) => lerp(lerp(src[i00 + o], src[i10 + o], tx), lerp(src[i01 + o], src[i11 + o], tx), ty);
        return [ch(0), ch(1), ch(2), ch(3)];
    }

    function blurStrength(norm, sharpPct, startPct, intensity) {
        const sharp = Math.max(0, Math.min(90, sharpPct)) / 100;
        const start = Math.max(sharp, Math.min(100, startPct)) / 100;
        if (norm <= sharp) return 0;
        if (norm < start) return 0;
        const span = Math.max(1e-6, 1 - start);
        const t = (norm - start) / span;
        return t * Math.max(1, intensity);
    }

    function illuRadialBlurRGBA(src, w, h, opts) {
        const cx = opts.cx != null ? opts.cx : w / 2;
        const cy = opts.cy != null ? opts.cy : h / 2;
        const sharpPct = opts.sharpPct != null ? opts.sharpPct : 15;
        const startPct = opts.startPct != null ? opts.startPct : 25;
        const intensity = opts.intensity != null ? opts.intensity : 12;
        const angleDeg = opts.angleDeg != null ? opts.angleDeg : 0;
        const sy = opts.startY != null ? opts.startY : 0;
        const ey = opts.endY != null ? opts.endY : h;
        const sample = opts.sampleBilinear || defaultSample;
        const out = new Uint8ClampedArray(src.length);
        const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) || 1;
        const angleBias = (angleDeg * Math.PI) / 180;

        for (let y = sy; y < ey; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.hypot(dx, dy);
                const norm = dist / maxR;
                const strength = blurStrength(norm, sharpPct, startPct, intensity);
                if (strength < 0.01 || dist < 0.5) {
                    out[i] = src[i];
                    out[i + 1] = src[i + 1];
                    out[i + 2] = src[i + 2];
                    out[i + 3] = src[i + 3];
                    continue;
                }
                const base = Math.atan2(dy, dx);
                const spread = (0.15 + strength * 0.85) * (Math.PI * 0.5);
                const n = Math.max(2, Math.min(64, Math.round(2 + strength * 3)));
                let r = 0;
                let g = 0;
                let b = 0;
                let a = 0;
                for (let s = 0; s < n; s++) {
                    const u = n > 1 ? s / (n - 1) - 0.5 : 0;
                    const aOff = base + angleBias + u * spread;
                    const sx = cx + dist * Math.cos(aOff);
                    const sy_ = cy + dist * Math.sin(aOff);
                    const [rr, gg, bb, aa] = sample(src, w, h, sx, sy_);
                    r += rr;
                    g += gg;
                    b += bb;
                    a += aa;
                }
                out[i] = r / n;
                out[i + 1] = g / n;
                out[i + 2] = b / n;
                out[i + 3] = a / n;
            }
        }
        return out;
    }

    function illuZoomBlurRGBA(src, w, h, opts) {
        const cx = opts.cx != null ? opts.cx : w / 2;
        const cy = opts.cy != null ? opts.cy : h / 2;
        const sharpPct = opts.sharpPct != null ? opts.sharpPct : 15;
        const startPct = opts.startPct != null ? opts.startPct : 25;
        const intensity = opts.intensity != null ? opts.intensity : 12;
        const sy = opts.startY != null ? opts.startY : 0;
        const ey = opts.endY != null ? opts.endY : h;
        const sample = opts.sampleBilinear || defaultSample;
        const out = new Uint8ClampedArray(src.length);
        const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) || 1;

        for (let y = sy; y < ey; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.hypot(dx, dy);
                const norm = dist / maxR;
                const strength = blurStrength(norm, sharpPct, startPct, intensity);
                if (strength < 0.01 || dist < 0.5) {
                    out[i] = src[i];
                    out[i + 1] = src[i + 1];
                    out[i + 2] = src[i + 2];
                    out[i + 3] = src[i + 3];
                    continue;
                }
                const n = Math.max(2, Math.min(64, Math.round(2 + strength * 4)));
                let r = 0;
                let g = 0;
                let b = 0;
                let a = 0;
                for (let s = 0; s < n; s++) {
                    const t = n > 1 ? s / (n - 1) : 1;
                    const sx = cx + dx * t;
                    const sy_ = cy + dy * t;
                    const [rr, gg, bb, aa] = sample(src, w, h, sx, sy_);
                    r += rr;
                    g += gg;
                    b += bb;
                    a += aa;
                }
                out[i] = r / n;
                out[i + 1] = g / n;
                out[i + 2] = b / n;
                out[i + 3] = a / n;
            }
        }
        return out;
    }

    const api = { illuRadialBlurRGBA, illuZoomBlurRGBA, defaultSample };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof global !== 'undefined') {
        global.illuRadialBlurRGBA = illuRadialBlurRGBA;
        global.illuZoomBlurRGBA = illuZoomBlurRGBA;
    }
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
