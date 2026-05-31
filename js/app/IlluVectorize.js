/**
 * IlluVectorize.js — Vectorisation bitmap → SVG (WASM + formes géométriques).
 */
(function () {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';

    const DEFAULT_OPTIONS = {
        colorTolerance: 28,
        maxColors: 512,
        minArea: 24,
        minAlpha: 12,
        detectShapes: true,
        detectGrid: false,
        preserveTransparency: true,
        simplifyEpsilon: 2.2,
        maxPathPoints: 56,
        maxDimension: 2048,
        foregroundAlphaThreshold: 240
    };

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function rgbaHex(r, g, b) {
        const h = (n) => n.toString(16).padStart(2, '0');
        return `#${h(r)}${h(g)}${h(b)}`;
    }

    function imageToRaster(img, maxDim) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        let w = iw;
        let h = ih;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        if (scale < 1) {
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        return { imageData, width: w, height: h, scale: w / iw };
    }

    async function ensureWasm() {
        const wasm = window.MasterPaintWasm;
        if (!wasm) return null;
        if (!wasm.isLoaded) await wasm.init(true);
        return wasm.isLoaded ? wasm : null;
    }

    function computeBoundsFromMask(mask, w, h) {
        let x0 = w;
        let y0 = h;
        let x1 = -1;
        let y1 = -1;
        let count = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!mask[y * w + x]) continue;
                count++;
                if (x < x0) x0 = x;
                if (y < y0) y0 = y;
                if (x > x1) x1 = x;
                if (y > y1) y1 = y;
            }
        }
        if (count < 1) return null;
        return { x0, y0, x1: x1 + 1, y1: y1 + 1, count };
    }

    function measureCircularity(mask, w, h, bounds) {
        const cx = (bounds.x0 + bounds.x1) / 2;
        const cy = (bounds.y0 + bounds.y1) / 2;
        const radii = [];
        for (let y = bounds.y0; y < bounds.y1; y++) {
            for (let x = bounds.x0; x < bounds.x1; x++) {
                if (!mask[y * w + x]) continue;
                const dx = x + 0.5 - cx;
                const dy = y + 0.5 - cy;
                radii.push(Math.sqrt(dx * dx + dy * dy));
            }
        }
        if (radii.length < 8) return 0;
        const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
        if (mean < 1e-3) return 0;
        const variance = radii.reduce((a, r) => a + (r - mean) * (r - mean), 0) / radii.length;
        return clamp(1 - variance / (mean * mean), 0, 1);
    }

    function cornerRoundness(mask, w, h, bounds) {
        const bw = bounds.x1 - bounds.x0;
        const bh = bounds.y1 - bounds.y0;
        if (bw < 8 || bh < 8) return 0;
        const cornerSize = Math.max(2, Math.round(Math.min(bw, bh) * 0.22));
        const corners = [
            [bounds.x0, bounds.y0],
            [bounds.x1 - cornerSize, bounds.y0],
            [bounds.x0, bounds.y1 - cornerSize],
            [bounds.x1 - cornerSize, bounds.y1 - cornerSize]
        ];
        let empty = 0;
        let total = 0;
        corners.forEach(([cx, cy]) => {
            for (let dy = 0; dy < cornerSize; dy++) {
                for (let dx = 0; dx < cornerSize; dx++) {
                    const x = cx + dx;
                    const y = cy + dy;
                    if (x < 0 || y < 0 || x >= w || y >= h) continue;
                    total++;
                    if (!mask[y * w + x]) empty++;
                }
            }
        });
        return total > 0 ? empty / total : 0;
    }

    function setElementBBoxMeta(el, bounds) {
        if (!el || !bounds) return;
        const bw = bounds.x1 - bounds.x0;
        const bh = bounds.y1 - bounds.y0;
        el.setAttribute('data-illu-bbox', `${bounds.x0},${bounds.y0},${bw},${bh}`);
    }

    function simplifyPathBudget(pts, epsilon, maxPts) {
        const EM = window.EditorManager;
        if (!EM || typeof EM._rdpSimplify !== 'function' || !pts || pts.length < 4) {
            return pts || [];
        }
        let eps = Math.max(0.4, epsilon);
        let out = pts;
        for (let i = 0; i < 10 && out.length > maxPts; i++) {
            out = EM._rdpSimplify(pts, eps);
            eps *= 1.55;
        }
        return out;
    }

    function pathPointsToD(parts) {
        const EM = window.EditorManager;
        if (!EM || typeof EM._pointsToSvgPath !== 'function') return '';
        return parts
            .map((pts) => EM._pointsToSvgPath(pts, 1))
            .filter(Boolean)
            .join(' ');
    }

    function fitShapeElement(mask, w, h, fill, opacity, detectShapes, simplifyEpsilon, maxPathPoints) {
        const bounds = computeBoundsFromMask(mask, w, h);
        if (!bounds) return null;
        const bw = bounds.x1 - bounds.x0;
        const bh = bounds.y1 - bounds.y0;
        const bboxArea = bw * bh;
        const fillRatio = bounds.count / Math.max(1, bboxArea);
        const pathBudget = maxPathPoints || DEFAULT_OPTIONS.maxPathPoints;

        if (detectShapes && fillRatio > 0.68) {
            const circ = measureCircularity(mask, w, h, bounds);
            if (circ > 0.78 && Math.abs(bw - bh) / Math.max(bw, bh) < 0.18) {
                const el = document.createElementNS(NS, 'ellipse');
                el.setAttribute('cx', String((bounds.x0 + bounds.x1) / 2));
                el.setAttribute('cy', String((bounds.y0 + bounds.y1) / 2));
                el.setAttribute('rx', String(bw / 2));
                el.setAttribute('ry', String(bh / 2));
                el.setAttribute('fill', fill);
                if (opacity < 0.999) el.setAttribute('fill-opacity', String(opacity));
                el.setAttribute('data-illu-vectorized', 'ellipse');
                setElementBBoxMeta(el, bounds);
                return el;
            }

            const cornerEmpty = cornerRoundness(mask, w, h, bounds);
            if (fillRatio > 0.82) {
                const el = document.createElementNS(NS, 'rect');
                el.setAttribute('x', String(bounds.x0));
                el.setAttribute('y', String(bounds.y0));
                el.setAttribute('width', String(bw));
                el.setAttribute('height', String(bh));
                if (cornerEmpty > 0.35) {
                    const rx = Math.round(Math.min(bw, bh) * 0.12);
                    el.setAttribute('rx', String(rx));
                    el.setAttribute('ry', String(rx));
                }
                el.setAttribute('fill', fill);
                if (opacity < 0.999) el.setAttribute('fill-opacity', String(opacity));
                el.setAttribute('data-illu-vectorized', cornerEmpty > 0.35 ? 'round-rect' : 'rect');
                setElementBBoxMeta(el, bounds);
                return el;
            }
        }

        const EM = window.EditorManager;
        if (!EM || typeof EM._maskToPathsMarchingSquares !== 'function') return null;
        const paths = EM._maskToPathsMarchingSquares(mask, w, h);
        if (!paths || !paths.length) return null;
        const simplifiedParts = paths.map((pts) => {
            let simplified = pts;
            if (typeof EM._rdpSimplify === 'function' && pts.length > 8) {
                simplified = EM._rdpSimplify(pts, simplifyEpsilon || 2.4);
            }
            return simplifyPathBudget(simplified, (simplifyEpsilon || 2.4) * 1.35, pathBudget);
        });
        const fullD = pathPointsToD(simplifiedParts);
        if (!fullD) return null;

        // --- Star Detection ---
        if (detectShapes && simplifiedParts.length === 1 && simplifiedParts[0].length >= 8 && simplifiedParts[0].length <= 16) {
            const centroid = { x: (bounds.x0 + bounds.x1)/2, y: (bounds.y0 + bounds.y1)/2 };
            const pts = simplifiedParts[0];
            const dists = pts.map(p => Math.hypot(p.x - centroid.x, p.y - centroid.y));
            const isPeak = dists.map((d, i) => {
                const prev = dists[(i - 1 + dists.length) % dists.length];
                const next = dists[(i + 1) % dists.length];
                return d > prev && d > next;
            });
            const numPeaks = isPeak.filter(Boolean).length;
            if (numPeaks >= 4 && numPeaks <= 6) {
                const el = document.createElementNS(NS, 'polygon');
                el.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
                el.setAttribute('fill', fill);
                if (opacity < 0.999) el.setAttribute('fill-opacity', String(opacity));
                el.setAttribute('data-illu-vectorized', 'star');
                setElementBBoxMeta(el, bounds);
                return el;
            }
        }

        // --- Text/Small Complex Detection ---
        const totalArea = w * h;
        const isTextLike = detectShapes && (bboxArea < totalArea * 0.03) && (paths.length > 1 || paths[0].length > 40);
        
        const previewParts = simplifiedParts.map((pts) =>
            simplifyPathBudget(pts, (simplifyEpsilon || 2.4) * 2.2, Math.min(24, pathBudget))
        );
        const previewD = pathPointsToD(previewParts) || fullD;
        const totalPts = simplifiedParts.reduce((n, p) => n + p.length, 0);
        
        const el = document.createElementNS(NS, 'path');
        el.setAttribute('d', isTextLike ? previewD : fullD);
        el.setAttribute('fill', fill);
        if (opacity < 0.999) el.setAttribute('fill-opacity', String(opacity));
        el.setAttribute('fill-rule', 'evenodd');
        el.setAttribute('data-illu-vectorized', isTextLike ? 'text' : 'path');
        setElementBBoxMeta(el, bounds);
        if (!isTextLike && (totalPts > 32 || fullD.length > 900)) {
            el.setAttribute('data-illu-complex-path', '1');
            el.setAttribute('data-illu-path-preview', previewD);
        }
        return el;
    }

    function appendShapeForRegion(holder, mask, w, h, fill, opacity, opts) {
        const el = fitShapeElement(
            mask,
            w,
            h,
            fill,
            opacity,
            opts.detectShapes,
            opts.simplifyEpsilon,
            opts.maxPathPoints
        );
        if (el) holder.appendChild(el);
        return !!el;
    }

    function processColorRegions(wasm, imageData, w, h, opts, holder, detectShapes) {
        const runWasm = wasm && wasm.exports.labelColorRegions;
        if (runWasm) {
            try {
                wasm.uploadImageData(imageData);
                const labeled = wasm.labelColorRegions(
                    w,
                    h,
                    opts.colorTolerance,
                    opts.minAlpha,
                    opts.maxColors
                );
                if (labeled && labeled.numLabels > 0) {
                    const boundsPtr = wasm._allocScratch(20);
                    const labelOrder = [];
                    for (let lid = 0; lid < labeled.numLabels; lid++) {
                        if (labeled.counts[lid] < opts.minArea) continue;
                        labelOrder.push({ lid, count: labeled.counts[lid] });
                    }
                    labelOrder.sort((a, b) => b.count - a.count);

                    let added = 0;
                    for (const item of labelOrder) {
                        const lid = item.lid;
                        wasm.exports.computeLabelBounds(labeled.labelsPtr, lid, w, h, boundsPtr);
                        const b = wasm._readI32(boundsPtr, 5);
                        if (b[4] < opts.minArea) continue;

                        const maskPtr = wasm._allocScratch(w * h);
                        wasm.exports.extractLabelMask(labeled.labelsPtr, lid, maskPtr, w, h);
                        const mask = wasm._readMask(maskPtr, w * h);
                        wasm._freeScratch(maskPtr);

                        const pi = lid * 4;
                        const r = labeled.palette[pi];
                        const g = labeled.palette[pi + 1];
                        const bCol = labeled.palette[pi + 2];
                        const a = labeled.palette[pi + 3];
                        if (a < opts.minAlpha) continue;

                        const fill = rgbaHex(r, g, bCol);
                        const opacity = a / 255;
                        if (appendShapeForRegion(holder, mask, w, h, fill, opacity, opts)) added++;
                    }
                    wasm._freeScratch(boundsPtr);
                    wasm.freeLabelBuffers(labeled);
                    if (added > 0) return true;
                }
            } catch (wasmLabelErr) {
                console.warn('[IlluVectorize] labelColorRegions WASM failed, CPU fallback', wasmLabelErr);
            }
        }
        fallbackJsQuantize(imageData, w, h, opts, holder, detectShapes);
        return holder.childNodes.length > 0;
    }

    function buildGridLayer(wasm, imageData, w, h, minAlpha, holder) {
        const exp = wasm.exports;
        if (!exp.detectGridCellSize || !exp.sampleCellAverageColor) return false;

        try {
            const gridOutPtr = wasm._allocScratch(12);
            const colorBuf = wasm._allocScratch(4);
            const ok = exp.detectGridCellSize(wasm.inputPtr, w, h, gridOutPtr, minAlpha);
            const gridMeta = wasm._readI32(gridOutPtr, 3);
            wasm._freeScratch(gridOutPtr);

            if (!ok || gridMeta[0] < 4 || gridMeta[1] < 4) return false;
            if (gridMeta[2] < 920) return false;
            if (gridMeta[0] !== gridMeta[1]) return false;

            const cw = gridMeta[0];
            const ch = gridMeta[1];
            const cols = Math.floor(w / cw);
            const rows = Math.floor(h / ch);
            if (cols < 4 || rows < 4 || cols * rows < 16) return false;

            for (let gy = 0; gy < rows; gy++) {
                for (let gx = 0; gx < cols; gx++) {
                    const x0 = gx * cw;
                    const y0 = gy * ch;
                    exp.sampleCellAverageColor(wasm.inputPtr, w, h, x0, y0, cw, ch, colorBuf);
                    const rgba = wasm._readU8(colorBuf, 4);
                    if (rgba[3] < minAlpha) continue;
                    const rect = document.createElementNS(NS, 'rect');
                    rect.setAttribute('x', String(x0));
                    rect.setAttribute('y', String(y0));
                    rect.setAttribute('width', String(cw));
                    rect.setAttribute('height', String(ch));
                    rect.setAttribute('fill', rgbaHex(rgba[0], rgba[1], rgba[2]));
                    if (rgba[3] < 255) rect.setAttribute('fill-opacity', String(rgba[3] / 255));
                    rect.setAttribute('data-illu-vectorized', 'grid-cell');
                    holder.appendChild(rect);
                }
            }
            wasm._freeScratch(colorBuf);
            return holder.childNodes.length > 0;
        } catch (err) {
            console.warn('[IlluVectorize] detectGridCellSize WASM failed, skip grid layer', err);
            return false;
        }
    }

    function buildForegroundFromAlpha(imageData, w, h, opts, holder) {
        const data = imageData.data;
        const mask = new Uint8Array(w * h);
        const alphaSum = new Float32Array(w * h);
        let hasFg = false;
        const thr = opts.foregroundAlphaThreshold;

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            const a = data[i + 3];
            if (a < opts.minAlpha) continue;
            if (a >= thr) continue;
            mask[p] = 1;
            alphaSum[p] = a;
            hasFg = true;
        }
        if (!hasFg) return false;

        let sumA = 0;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;
        for (let p = 0; p < mask.length; p++) {
            if (!mask[p]) continue;
            const i = p * 4;
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
            sumA += alphaSum[p];
            count++;
        }
        if (count < opts.minArea) return false;
        const avgA = count > 0 ? sumA / count / 255 : 0.5;
        const fill = rgbaHex(
            Math.round(sumR / count),
            Math.round(sumG / count),
            Math.round(sumB / count)
        );

        const el = fitShapeElement(
            mask,
            w,
            h,
            fill,
            avgA,
            false,
            opts.simplifyEpsilon,
            opts.maxPathPoints
        );
        if (el) {
            el.setAttribute('data-illu-vectorized', 'foreground-alpha');
            holder.appendChild(el);
            return true;
        }
        return false;
    }

    async function vectorizeImage(img, userOpts) {
        const opts = { ...DEFAULT_OPTIONS, ...(userOpts || {}) };
        const { imageData, width: w, height: h } = imageToRaster(img, opts.maxDimension);
        const wasm = await ensureWasm();

        const root = document.createDocumentFragment();
        const bg = document.createElementNS(NS, 'g');
        bg.setAttribute('data-illu-vectorize-bg', '1');
        const fg = document.createElementNS(NS, 'g');
        fg.setAttribute('data-illu-vectorize-fg', '1');

        let gridDone = false;
        if (opts.detectGrid && wasm) {
            wasm.uploadImageData(imageData);
            gridDone = buildGridLayer(wasm, imageData, w, h, opts.minAlpha, bg);
        }

        if (!gridDone) {
            processColorRegions(wasm, imageData, w, h, opts, root, opts.detectShapes);
            if (opts.preserveTransparency) {
                buildForegroundFromAlpha(imageData, w, h, opts, fg);
            }
        } else if (opts.preserveTransparency) {
            buildForegroundFromAlpha(imageData, w, h, opts, fg);
        }

        if (bg.childNodes.length) root.insertBefore(bg, root.firstChild);
        if (fg.childNodes.length) root.appendChild(fg);

        let elementCount = 0;
        const countNodes = (node) => {
            if (node.nodeType === 1) {
                if (node.childNodes && node.childNodes.length) {
                    node.childNodes.forEach(countNodes);
                } else {
                    elementCount++;
                }
            }
        };
        root.childNodes.forEach(countNodes);

        return {
            fragment: root,
            width: w,
            height: h,
            elementCount
        };
    }

    function fallbackJsQuantize(imageData, w, h, opts, holder, detectShapes) {
        const data = imageData.data;
        const visited = new Uint8Array(w * h);
        const tol2 = opts.colorTolerance * opts.colorTolerance;
        const minA = opts.minAlpha;

        const match = (i, r, g, b, a) => {
            const dr = data[i] - r;
            const dg = data[i + 1] - g;
            const db = data[i + 2] - b;
            const da = data[i + 3] - a;
            return dr * dr + dg * dg + db * db + da * da * 2 <= tol2;
        };

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const p = y * w + x;
                if (visited[p]) continue;
                const i = p * 4;
                const a = data[i + 3];
                if (a < minA) {
                    visited[p] = 1;
                    continue;
                }
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const mask = new Uint8Array(w * h);
                const q = [p];
                visited[p] = 1;
                mask[p] = 1;
                let head = 0;
                while (head < q.length) {
                    const cur = q[head++];
                    const cx = cur % w;
                    const cy = (cur / w) | 0;
                    const nbs = [
                        [cx - 1, cy],
                        [cx + 1, cy],
                        [cx, cy - 1],
                        [cx, cy + 1]
                    ];
                    nbs.forEach(([nx, ny]) => {
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
                        const np = ny * w + nx;
                        if (visited[np]) return;
                        visited[np] = 1;
                        const ni = np * 4;
                        if (data[ni + 3] < minA) return;
                        if (!match(ni, r, g, b, a)) return;
                        mask[np] = 1;
                        q.push(np);
                    });
                }
                let count = 0;
                for (let k = 0; k < mask.length; k++) if (mask[k]) count++;
                if (count < opts.minArea) continue;
                const el = fitShapeElement(
                    mask,
                    w,
                    h,
                    rgbaHex(r, g, b),
                    a / 255,
                    detectShapes,
                    opts.simplifyEpsilon,
                    opts.maxPathPoints
                );
                if (el) holder.appendChild(el);
            }
        }
    }

    window.IlluVectorize = {
        DEFAULT_OPTIONS,
        vectorizeImage,
        imageToRaster,
        /** Aplatit le projet actif (SVG ou pixel) en Image pour vectorisation. */
        async captureActiveProjectImage() {
            const em = window.EditorManager;
            if (!em || !em.activeProject) return null;
            if (typeof em.syncActiveVectorSvg === 'function') em.syncActiveVectorSvg();
            const canvas = await em.flattenProjectToCanvas(em.activeProject);
            if (!canvas) return null;
            const dataUrl = canvas.toDataURL('image/png');
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });
            return img;
        }
    };
})();
