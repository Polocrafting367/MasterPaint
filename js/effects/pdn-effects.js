
(function (global) {
    'use strict';

    function clamp8(v) {
        return v < 0 ? 0 : v > 255 ? 255 : v | 0;
    }

    function sampleBilinear(src, w, h, x, y) {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = Math.min(w - 1, x0 + 1);
        const y1 = Math.min(h - 1, y0 + 1);
        const fx = x - x0;
        const fy = y - y0;
        const i00 = (y0 * w + x0) * 4;
        const i10 = (y0 * w + x1) * 4;
        const i01 = (y1 * w + x0) * 4;
        const i11 = (y1 * w + x1) * 4;
        const out = [0, 0, 0, 0];
        for (let c = 0; c < 4; c++) {
            const v00 = src[i00 + c];
            const v10 = src[i10 + c];
            const v01 = src[i01 + c];
            const v11 = src[i11 + c];
            const top = v00 + (v10 - v00) * fx;
            const bot = v01 + (v11 - v01) * fx;
            out[c] = top + (bot - top) * fy;
        }
        return out;
    }

    function blendSamples(samples) {
        let r = 0,
            g = 0,
            b = 0,
            a = 0,
            n = 0;
        for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            if (!s || s[3] < 1) continue;
            const w = s[3] / 255;
            r += s[0] * w;
            g += s[1] * w;
            b += s[2] * w;
            a += s[3];
            n += w;
        }
        if (n < 1e-6) return [0, 0, 0, 0];
        return [clamp8(r / n), clamp8(g / n), clamp8(b / n), clamp8(a / samples.length)];
    }

    /** Motion blur — OpenPDN MotionBlurEffect */
    function motionBlur(imageData, angleDeg, distance, centered) {
        const { data, width: w, height: h } = imageData;
        const out = new Uint8ClampedArray(data);
        const theta = ((angleDeg + 180) * Math.PI) / 180;
        const alpha = Math.max(1, distance | 0);
        let sx = alpha * Math.cos(theta);
        let sy = alpha * Math.sin(theta);
        let ex = sx;
        let ey = -sy;
        if (centered) {
            sx = -ex / 2;
            sy = -ey / 2;
            ex /= 2;
            ey /= 2;
        }
        const nPts = Math.max(1, Math.floor(((1 + alpha) * 3) / 2));
        const points = [];
        for (let i = 0; i < nPts; i++) {
            const t = nPts === 1 ? 0 : i / (nPts - 1);
            points.push({ x: sx + (ex - sx) * t, y: sy + (ey - sy) * t });
        }
        const src = data;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const samples = [];
                for (let j = 0; j < points.length; j++) {
                    const px = x + points[j].x;
                    const py = y + points[j].y;
                    if (px >= 0 && py >= 0 && px <= w - 1 && py <= h - 1) {
                        samples.push(sampleBilinear(src, w, h, px, py));
                    }
                }
                const b = blendSamples(samples);
                const o = (y * w + x) * 4;
                out[o] = b[0];
                out[o + 1] = b[1];
                out[o + 2] = b[2];
                out[o + 3] = b[3];
            }
        }
        return new ImageData(out, w, h);
    }

    /** Surface blur simplifié — seuil de couleur + boîte locale */
    function surfaceBlur(imageData, radius, threshold) {
        const { data, width: w, height: h } = imageData;
        const r = Math.max(1, Math.min(50, radius | 0));
        const th = Math.max(1, Math.min(100, threshold | 0));
        const slope = 96 / th;
        const factors = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            let f = Math.round(255 - i * slope);
            if (f < 0) f = 0;
            factors[i] = f;
        }
        const out = new Uint8ClampedArray(data.length);
        const tmp = new Float32Array(w * h * 4);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sr = 0,
                    sg = 0,
                    sb = 0,
                    sa = 0,
                    sw = 0;
                const ci = (y * w + x) * 4;
                const cr = data[ci];
                const cg = data[ci + 1];
                const cb = data[ci + 2];
                for (let dy = -r; dy <= r; dy++) {
                    const yy = y + dy;
                    if (yy < 0 || yy >= h) continue;
                    for (let dx = -r; dx <= r; dx++) {
                        const xx = x + dx;
                        if (xx < 0 || xx >= w) continue;
                        const j = (yy * w + xx) * 4;
                        const dr = Math.abs(data[j] - cr);
                        const dg = Math.abs(data[j + 1] - cg);
                        const db = Math.abs(data[j + 2] - cb);
                        const diff = (dr + dg + db) / 3;
                        const wf = factors[diff] / 255;
                        if (wf < 0.01) continue;
                        sr += data[j] * wf;
                        sg += data[j + 1] * wf;
                        sb += data[j + 2] * wf;
                        sa += data[j + 3] * wf;
                        sw += wf;
                    }
                }
                const o = ci;
                if (sw > 0) {
                    tmp[o] = sr / sw;
                    tmp[o + 1] = sg / sw;
                    tmp[o + 2] = sb / sw;
                    tmp[o + 3] = sa / sw;
                } else {
                    tmp[o] = data[ci];
                    tmp[o + 1] = data[ci + 1];
                    tmp[o + 2] = data[ci + 2];
                    tmp[o + 3] = data[ci + 3];
                }
            }
        }
        for (let i = 0; i < data.length; i++) out[i] = clamp8(tmp[i]);
        return new ImageData(out, w, h);
    }

    /** Fragment — OpenPDN FragmentEffect (échantillons radiaux) */
    function fragment(imageData, fragmentCount, distance, rotationDeg) {
        const { data, width: w, height: h } = imageData;
        const n = Math.max(2, Math.min(50, fragmentCount | 0));
        const dist = Math.max(0, distance | 0);
        const rot = ((rotationDeg - 90) * Math.PI) / 180;
        const step = (2 * Math.PI) / n;
        const offsets = [];
        for (let i = 0; i < n; i++) {
            const a = rot + step * i;
            offsets.push({ x: Math.round(-dist * Math.sin(a)), y: Math.round(-dist * Math.cos(a)) });
        }
        const out = new Uint8ClampedArray(data);
        const src = data;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sr = 0,
                    sg = 0,
                    sb = 0,
                    sa = 0,
                    cnt = 0;
                for (let i = 0; i < n; i++) {
                    const u = x - offsets[i].x;
                    const v = y - offsets[i].y;
                    if (u < 0 || v < 0 || u >= w || v >= h) continue;
                    const j = (v * w + u) * 4;
                    const a = src[j + 3] / 255;
                    if (a < 0.01) continue;
                    sr += src[j] * a;
                    sg += src[j + 1] * a;
                    sb += src[j + 2] * a;
                    sa += a;
                    cnt++;
                }
                const o = (y * w + x) * 4;
                if (cnt > 0 && sa > 0) {
                    out[o] = sr / sa;
                    out[o + 1] = sg / sa;
                    out[o + 2] = sb / sa;
                    out[o + 3] = Math.min(255, (sa / cnt) * 255);
                } else {
                    out[o] = src[o];
                    out[o + 1] = src[o + 1];
                    out[o + 2] = src[o + 2];
                    out[o + 3] = src[o + 3];
                }
            }
        }
        return new ImageData(out, w, h);
    }

    global.PdnEffects = { motionBlur, surfaceBlur, fragment };
})(typeof window !== 'undefined' ? window : globalThis);
