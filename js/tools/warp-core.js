(function (global) {
    'use strict';

    function solveHomography8(src4, dst4) {
        const A = [];
        const b = [];
        for (let i = 0; i < 4; i++) {
            const X = src4[i][0];
            const Y = src4[i][1];
            const xp = dst4[i][0];
            const yp = dst4[i][1];
            A.push([X, Y, 1, 0, 0, 0, -X * xp, -Y * xp]);
            b.push(xp);
            A.push([0, 0, 0, X, Y, 1, -X * yp, -Y * yp]);
            b.push(yp);
        }
        const n = 8;
        const M = A.map((row, r) => row.concat([b[r]]));
        for (let col = 0; col < n; col++) {
            let piv = col;
            for (let r = col + 1; r < n; r++) {
                if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
            }
            const tmp = M[col];
            M[col] = M[piv];
            M[piv] = tmp;
            const v = M[col][col];
            if (Math.abs(v) < 1e-12) return null;
            for (let c = col; c <= n; c++) M[col][c] /= v;
            for (let r = 0; r < n; r++) {
                if (r === col) continue;
                const f = M[r][col];
                if (f === 0) continue;
                for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
            }
        }
        const sol = M.map((row) => row[n]);
        return [sol[0], sol[1], sol[2], sol[3], sol[4], sol[5], sol[6], sol[7], 1];
    }

    function invert3x3(m) {
        const a = m[0], b = m[1], c = m[2];
        const d = m[3], e = m[4], f = m[5];
        const g = m[6], h = m[7], i = m[8];
        const A = e * i - f * h;
        const B = -(d * i - f * g);
        const C = d * h - e * g;
        const D = -(b * i - c * h);
        const E = a * i - c * g;
        const F = -(a * h - b * g);
        const G = b * f - c * e;
        const H = -(a * f - c * d);
        const I = a * e - b * d;
        const det = a * A + b * B + c * C;
        if (Math.abs(det) < 1e-14) return null;
        const id = 1 / det;
        return [A * id, D * id, G * id, B * id, E * id, H * id, C * id, F * id, I * id];
    }

    function pointInPolygon(x, y, pts) {
        if (!pts || pts.length < 3) return false;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x;
            const yi = pts[i].y;
            const xj = pts[j].x;
            const yj = pts[j].y;
            const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function sampleBilinearInto(data, w, h, x, y, out, di) {
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
        const i00 = (y0 * w + x0) * 4;
        const i10 = (y0 * w + x1) * 4;
        const i01 = (y1 * w + x0) * 4;
        const i11 = (y1 * w + x1) * 4;
        for (let o = 0; o < 4; o++) {
            const top = data[i00 + o] + (data[i10 + o] - data[i00 + o]) * tx;
            const bottom = data[i01 + o] + (data[i11 + o] - data[i01 + o]) * tx;
            out[di + o] = top + (bottom - top) * ty;
        }
    }

    function sampleNearestInto(data, w, h, x, y, out, di) {
        const ix = Math.floor(x + 0.5);
        const iy = Math.floor(y + 0.5);
        if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
        const i = (iy * w + ix) * 4;
        out[di] = data[i];
        out[di + 1] = data[i + 1];
        out[di + 2] = data[i + 2];
        out[di + 3] = data[i + 3];
    }

    function renderWarpPatch(opts) {
        const stride = Math.max(1, opts.stride | 0);
        const sourceData =
            opts.sourceData instanceof Uint8ClampedArray ? opts.sourceData : new Uint8ClampedArray(opts.sourceData);
        const sw = opts.sourceWidth | 0;
        const sh = opts.sourceHeight | 0;
        const bw = opts.patchWidth | 0;
        const bh = opts.patchHeight | 0;
        const outW = stride === 1 ? bw : Math.max(1, Math.ceil(bw / stride));
        const outH = stride === 1 ? bh : Math.max(1, Math.ceil(bh / stride));
        
        const outSize = outW * outH * 4;
        const out = new Uint8ClampedArray(outSize);
        if (stride === 1 && opts.baseData) {
            const baseData = opts.baseData instanceof Uint8ClampedArray ? opts.baseData : new Uint8ClampedArray(opts.baseData);
            if (baseData.length === outSize) out.set(baseData);
        }

        const minX = opts.patchX | 0;
        const minY = opts.patchY | 0;
        const srcQuad = opts.srcQuad;
        const dstQuad = opts.dstQuad;
        const polyLocal = Array.isArray(opts.polyLocal) ? opts.polyLocal : null;
        const Hmat = solveHomography8(srcQuad, dstQuad);
        if (!Hmat) return null;
        const Hinv = invert3x3(Hmat);
        if (!Hinv) return null;
        const h0 = Hinv[0], h1 = Hinv[1], h2 = Hinv[2];
        const h3 = Hinv[3], h4 = Hinv[4], h5 = Hinv[5];
        const h6 = Hinv[6], h7 = Hinv[7], h8 = Hinv[8];
        const useLasso = !!(polyLocal && polyLocal.length >= 3);
        let lxMin = 0, lxMax = sw, lyMin = 0, lyMax = sh;
        if (useLasso) {
            lxMin = polyLocal[0].x; lxMax = lxMin;
            lyMin = polyLocal[0].y; lyMax = lyMin;
            for (let k = 1; k < polyLocal.length; k++) {
                const p = polyLocal[k];
                if (p.x < lxMin) lxMin = p.x; if (p.x > lxMax) lxMax = p.x;
                if (p.y < lyMin) lyMin = p.y; if (p.y > lyMax) lyMax = p.y;
            }
            lxMin -= 0.5; lxMax += 0.5;
            lyMin -= 0.5; lyMax += 0.5;
        }

        for (let j = 0; j < outH; j++) {
            const lpy = minY + j * stride;
            const rowIndex = j * outW;
            for (let i = 0; i < outW; i++) {
                const lpx = minX + i * stride;
                const q2 = h6 * lpx + h7 * lpy + h8;
                if (Math.abs(q2) < 1e-10) continue;
                const qinv = 1.0 / q2;
                const su = (h0 * lpx + h1 * lpy + h2) * qinv;
                const sv = (h3 * lpx + h4 * lpy + h5) * qinv;
                if (su < -0.5 || sv < -0.5 || su >= sw || sv >= sh) continue;
                if (useLasso) {
                    if (su < lxMin || su > lxMax || sv < lyMin || sv > lyMax) continue;
                    if (!pointInPolygon(su, sv, polyLocal)) continue;
                }
                if (opts.smooth !== false) {
                    sampleBilinearInto(sourceData, sw, sh, su, sv, out, (rowIndex + i) * 4);
                } else {
                    sampleNearestInto(sourceData, sw, sh, su, sv, out, (rowIndex + i) * 4);
                }
            }
        }
        return {
            width: outW,
            height: outH,
            x: minX,
            y: minY,
            stride: stride,
            data: out
        };
    }

    global.IlluWarpCore = {
        solveHomography8: solveHomography8,
        invert3x3: invert3x3,
        pointInPolygon: pointInPolygon,
        renderWarpPatch: renderWarpPatch
    };
})(typeof self !== 'undefined' ? self : window);
