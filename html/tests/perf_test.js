// Benchmark synchrone Rust/WASM vs JS (python run_in_edge.py --realtime perf_test.js …)
const R = self.MasterPaintRust;
if (!R.initSync(FILES['masterpaint_core.wasm'])) throw new Error('init ' + R.error);
const W = 2000, H = 1500, N = W * H * 4;
const img = new Uint8ClampedArray(N);
for (let i = 0; i < N; i++) img[i] = (Math.imul(i, 2654435761) >>> 24);
for (let i = 3; i < N; i += 4) img[i] = 255;

// Référence JS : _boxBlurRGBA du worker (3 passes = « gaussien »)
function jsBox(rgba, w, h, radius) {
    const tmp = new Uint8ClampedArray(rgba.length);
    for (let y = 0; y < h; y++) {
        let r = 0, g = 0, b = 0, a = 0, ws = 0; const ro = y * w * 4;
        for (let x = -radius; x <= radius; x++) { const o = ro + Math.max(0, Math.min(w - 1, x)) * 4; r += rgba[o]; g += rgba[o + 1]; b += rgba[o + 2]; a += rgba[o + 3]; ws++; }
        for (let x = 0; x < w; x++) {
            const i = ro + x * 4; tmp[i] = r / ws; tmp[i + 1] = g / ws; tmp[i + 2] = b / ws; tmp[i + 3] = a / ws;
            const iN = ro + Math.min(w - 1, x + radius + 1) * 4, iP = ro + Math.max(0, x - radius) * 4;
            r += rgba[iN] - rgba[iP]; g += rgba[iN + 1] - rgba[iP + 1]; b += rgba[iN + 2] - rgba[iP + 2]; a += rgba[iN + 3] - rgba[iP + 3];
        }
    }
    for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, ws = 0;
        for (let y = -radius; y <= radius; y++) { const o = (Math.max(0, Math.min(h - 1, y)) * w + x) * 4; r += tmp[o]; g += tmp[o + 1]; b += tmp[o + 2]; a += tmp[o + 3]; ws++; }
        for (let y = 0; y < h; y++) {
            const i = (y * w + x) * 4; rgba[i] = r / ws; rgba[i + 1] = g / ws; rgba[i + 2] = b / ws; rgba[i + 3] = a / ws;
            const iN = (Math.min(h - 1, y + radius + 1) * w + x) * 4, iP = (Math.max(0, y - radius) * w + x) * 4;
            r += tmp[iN] - tmp[iP]; g += tmp[iN + 1] - tmp[iP + 1]; b += tmp[iN + 2] - tmp[iP + 2]; a += tmp[iN + 3] - tmp[iP + 3];
        }
    }
}
// Référence JS : median du worker (histogramme carré recalculé par pixel), rayon 4
function jsMedian(src, w, h, rad) {
    const od = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const hr = new Int32Array(256), hg = new Int32Array(256), hb = new Int32Array(256); let area = 0;
        for (let dy = -rad; dy <= rad; dy++) { const ny = Math.max(0, Math.min(h - 1, y + dy));
            for (let dx = -rad; dx <= rad; dx++) { const nx = Math.max(0, Math.min(w - 1, x + dx)); const j = (ny * w + nx) * 4; hr[src[j]]++; hg[src[j + 1]]++; hb[src[j + 2]]++; area++; } }
        const si = (y * w + x) * 4; let c = 0; for (let k = 0; k < src[si]; k++) c += hr[k]; od[si] = c * 255 / area;
    }
    return od;
}
function time(fn) { const t = performance.now(); fn(); return performance.now() - t; }
const out = [];
const tJs = time(() => { const c = new Uint8ClampedArray(img); for (let p = 0; p < 3; p++) jsBox(c, W, H, 20); });
const tRs = time(() => R.apply('gaussian', img, W, H, [20]));
out.push(`Flou gaussien r=20 2000x1500 : JS ${tJs.toFixed(0)} ms | Rust/WASM ${tRs.toFixed(0)} ms | x${(tJs / tRs).toFixed(1)}`);
const S = 600, SH = 400, small = img.subarray(0, S * SH * 4);
const tJm = time(() => jsMedian(small, S, SH, 4));
const tRm = time(() => R.apply('median', small, S, SH, [4, 50]));
out.push(`Médiane r=4 600x400 : JS ${tJm.toFixed(0)} ms | Rust/WASM ${tRm.toFixed(0)} ms | x${(tJm / tRm).toFixed(1)}`);
for (const [n, p] of [['unfocus', [12, 55]], ['motionblur', [25, 20, 1]], ['oil', [4, 50]], ['clouds', [250, 50, 0, 0, 0xffffff, 0]], ['hsv', [30, 10, 0, 0]], ['sketch', [50, 50]]]) {
    out.push(`${n.padEnd(12)} 2000x1500 : Rust/WASM ${time(() => R.apply(n, img, W, H, p)).toFixed(0)} ms`);
}
done(out.join('\n'));
