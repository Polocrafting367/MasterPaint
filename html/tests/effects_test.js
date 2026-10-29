// Test de non-régression du moteur Rust (exécuté par rust/tools/run_in_edge.py).
// Vérifie pour chaque effet : pas d'erreur, sortie ≠ entrée (sauf exceptions),
// et rendu par bandes (workers) identique au rendu complet.
const R = self.MasterPaintRust;
const ok = await R.init(FILES['masterpaint_core.wasm'].buffer);
if (!ok) { done('INIT FAIL ' + R.error); return; }
const W = 160, H = 120;
const img = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    img[i] = (x * 255 / W) | 0;
    img[i + 1] = (y * 255 / H) | 0;
    img[i + 2] = ((x ^ y) & 0xff);
    // disque opaque sur fond semi-transparent (pour contour / ombre / alpha)
    const inside = (x - 80) ** 2 + (y - 60) ** 2 < 40 ** 2;
    img[i + 3] = inside ? 255 : ((x + y) % 7 === 0 ? 255 : 0);
}
const special = {
    quantize: [8, 50], ral: [0, 3, 255, 0, 0, 0, 255, 0, 0, 0, 255],
    curves: Array.from({ length: 1024 }, (_, k) => 255 - (k % 256)),
    levels: [20, 230, 1.3, 0, 255], hsv: [40, 20, 0, 0],
    rotatezoom: [30, 0.1, 0, 1.2, 0], straighten: [10], morphology: [0, 3, 0],
    projection3d: [20, 15, 280, 100, 0, 0, 0, 0], highlightsshadows: [60, 40, 10],
    clouds: [60, 50, 3, 0x102030, 0xffeedd, 0], turbulence: [40, 5, 50, 7, 0, 0xffffff, 0],
    contour: [3, 0x00ff00, 100, 0, 0], dropshadow: [5, 5, 6, 60, 0],
    mandelbrot: [1, 0, 2, 10, 0], julia: [4, 0, 2, 4],
    motionblur: [25, 10, 1], radialblur: [10, 2, 0, 0, 0], zoomblur: [30, 0, 0, 0],
    redeyeremove: [10, 50], threshold: [128], solarize: [100], emboss: [30], relief: [45]
};
const lines = [];
let fails = 0;
for (const name of R.names) {
    const p = special[name] || [];
    try {
        const t0 = performance.now();
        const full = R.apply(name, img, W, H, p, 0, H);
        const dt = performance.now() - t0;
        if (!full) { lines.push('FAIL ' + name + ' null'); fails++; continue; }
        let diff = 0;
        for (let i = 0; i < full.length; i++) if (full[i] !== img[i]) diff++;
        // bandes : 3 morceaux comme 3 workers
        const cuts = [0, 37, 81, H];
        const banded = new Uint8ClampedArray(W * H * 4);
        for (let k = 0; k < 3; k++) {
            const part = R.apply(name, img, W, H, p, cuts[k], cuts[k + 1]);
            banded.set(part.subarray(cuts[k] * W * 4, cuts[k + 1] * W * 4), cuts[k] * W * 4);
        }
        let bandDiff = 0, maxD = 0;
        for (let i = 0; i < full.length; i++) {
            const d = Math.abs(full[i] - banded[i]);
            if (d) { bandDiff++; if (d > maxD) maxD = d; }
        }
        const flag = (diff === 0 ? ' NOCHANGE' : '') + (bandDiff ? ' BAND≠ ' + bandDiff + ' (max ' + maxD + ')' : '');
        if (bandDiff) fails++;
        lines.push((flag ? 'WARN ' : 'ok   ') + name.padEnd(18) + (dt.toFixed(1) + 'ms').padStart(9) + '  changed=' + diff + flag);
    } catch (e) {
        lines.push('EXC  ' + name + ' ' + e); fails++;
    }
}
// performance : gaussien r=20 sur 2000x1500
const BW = 2000, BH = 1500, big = new Uint8ClampedArray(BW * BH * 4);
for (let i = 0; i < big.length; i++) big[i] = (i * 2654435761) >>> 24;
let t = performance.now(); R.apply('gaussian', big, BW, BH, [20]); const tg = performance.now() - t;
t = performance.now(); R.apply('unfocus', big, BW, BH, [12, 55]); const tb = performance.now() - t;
t = performance.now(); R.apply('median', big, BW, BH, [6, 50]); const tm = performance.now() - t;
lines.push(`PERF 2000x1500: gaussian r20 ${tg.toFixed(0)}ms, bokeh r12 ${tb.toFixed(0)}ms, median r6 ${tm.toFixed(0)}ms`);
done(`effects=${R.names.length} fails=${fails}\n` + lines.join('\n'));
