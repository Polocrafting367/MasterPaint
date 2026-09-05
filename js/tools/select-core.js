/**
 * Cœur des sélections assistées (sélection rapide, sélection d'objet, lasso magnétique).
 *
 * Aucune dépendance DOM : le fichier est chargé tel quel par la page ET par
 * js/tools/select-worker.js (importScripts). Toutes les fonctions travaillent sur
 * des ImageData « à plat » (Uint8ClampedArray RGBA) et rendent des masques
 * Uint8Array (1 = sélectionné).
 *
 * Trois briques partagées :
 *   1. une carte de contours (Sobel) — commune aux trois outils ;
 *   2. un tas binaire + Dijkstra — le lasso magnétique cherche le chemin de
 *      moindre coût le long des contours, la sélection rapide propage une
 *      distance géodésique couleur depuis les traits du pinceau ;
 *   3. un post-traitement de masque (plus grande composante, bouchage des trous,
 *      lissage) — commun lui aussi.
 *
 * La sélection d'objet n'utilise pas d'apprentissage : c'est une approximation
 * de GrabCut (modèles couleur k-moyennes avant/arrière + relaxation ICM sur un
 * champ de Markov sensible aux contours). Bons résultats sur un sujet contrasté,
 * limites attendues sur un fond de couleur proche du sujet.
 */
(function (root) {
    'use strict';

    /* ─── Qualité ────────────────────────────────────────────────────────────
     * Un seul réglage utilisateur pilote la résolution de travail et l'effort
     * des algorithmes. Le masque est calculé en réduit puis ré-agrandi : c'est
     * ce qui fait l'essentiel de l'écart de vitesse entre les trois niveaux.
     */
    const QUALITY = {
        fast: { maxDim: 480, iterations: 2, smooth: 1, kmeans: 3, kmeansIters: 4 },
        medium: { maxDim: 900, iterations: 4, smooth: 2, kmeans: 4, kmeansIters: 6 },
        slow: { maxDim: 1800, iterations: 8, smooth: 2, kmeans: 6, kmeansIters: 10 }
    };

    function qualityProfile(name) {
        return QUALITY[name] || QUALITY.medium;
    }

    /** Facteur de réduction entier (1, 2, 3…) pour tenir sous maxDim. */
    function scaleFactorFor(w, h, maxDim) {
        const big = Math.max(w, h);
        if (big <= maxDim) return 1;
        return Math.max(1, Math.ceil(big / maxDim));
    }

    /** Réduction par moyenne de bloc (box filter) : garde les couleurs justes. */
    function downscaleRGBA(data, w, h, factor) {
        if (factor <= 1) return { data: data, w: w, h: h, factor: 1 };
        const nw = Math.max(1, Math.floor(w / factor));
        const nh = Math.max(1, Math.floor(h / factor));
        const out = new Uint8ClampedArray(nw * nh * 4);
        for (let y = 0; y < nh; y++) {
            const y0 = y * factor;
            const y1 = Math.min(h, y0 + factor);
            for (let x = 0; x < nw; x++) {
                const x0 = x * factor;
                const x1 = Math.min(w, x0 + factor);
                let r = 0, g = 0, b = 0, a = 0, n = 0;
                for (let yy = y0; yy < y1; yy++) {
                    let i = (yy * w + x0) * 4;
                    for (let xx = x0; xx < x1; xx++, i += 4) {
                        r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
                        n++;
                    }
                }
                const o = (y * nw + x) * 4;
                out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
                out[o + 3] = a / n;
            }
        }
        return { data: out, w: nw, h: nh, factor: factor };
    }

    /** Masque réduit → masque pleine résolution (plus proche voisin). */
    function upscaleMask(mask, w, h, targetW, targetH) {
        if (w === targetW && h === targetH) return mask;
        const out = new Uint8Array(targetW * targetH);
        const sx = w / targetW;
        const sy = h / targetH;
        for (let y = 0; y < targetH; y++) {
            const syy = Math.min(h - 1, (y * sy) | 0);
            const row = syy * w;
            const orow = y * targetW;
            for (let x = 0; x < targetW; x++) {
                out[orow + x] = mask[row + Math.min(w - 1, (x * sx) | 0)];
            }
        }
        return out;
    }

    /* ─── Carte de contours ──────────────────────────────────────────────── */

    function toLuma(data, w, h) {
        const l = new Float32Array(w * h);
        for (let i = 0, p = 0; p < l.length; p++, i += 4) {
            l[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        }
        return l;
    }

    /** Flou boîte 3×3 en place sur un plan Float32 (une passe par rayon). */
    function blurPlane(src, w, h, radius) {
        if (radius <= 0) return src;
        let cur = src;
        for (let r = 0; r < radius; r++) {
            const tmp = new Float32Array(cur.length);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let sum = 0, n = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        const yy = y + dy;
                        if (yy < 0 || yy >= h) continue;
                        for (let dx = -1; dx <= 1; dx++) {
                            const xx = x + dx;
                            if (xx < 0 || xx >= w) continue;
                            sum += cur[yy * w + xx];
                            n++;
                        }
                    }
                    tmp[y * w + x] = sum / n;
                }
            }
            cur = tmp;
        }
        return cur;
    }

    /** Flou boîte 3×3 sur du RGBA (répété `radius` fois). */
    function blurRGBA(data, w, h, radius) {
        if (radius <= 0) return data;
        let cur = data;
        for (let r = 0; r < radius; r++) {
            const out = new Uint8ClampedArray(cur.length);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        const yy = y + dy;
                        if (yy < 0 || yy >= h) continue;
                        for (let dx = -1; dx <= 1; dx++) {
                            const xx = x + dx;
                            if (xx < 0 || xx >= w) continue;
                            const p = (yy * w + xx) * 4;
                            sr += cur[p]; sg += cur[p + 1]; sb += cur[p + 2]; sa += cur[p + 3];
                            n++;
                        }
                    }
                    const o = (y * w + x) * 4;
                    out[o] = sr / n; out[o + 1] = sg / n; out[o + 2] = sb / n; out[o + 3] = sa / n;
                }
            }
            cur = out;
        }
        return cur;
    }

    /**
     * Norme du gradient (Sobel) normalisée sur son maximum → 0..1.
     * Sert de coût pour le lasso (fort gradient = passage bon marché) et de
     * frein pour la sélection rapide. La luminance est floutée d'abord, sinon
     * le grain d'une photo produit des « contours » partout.
     */
    function buildEdgeMap(data, w, h, blurRadius) {
        const lum = blurPlane(toLuma(data, w, h), w, h, blurRadius != null ? blurRadius : 1);
        const g = new Float32Array(w * h);
        let max = 1e-6;
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = y * w + x;
                const tl = lum[i - w - 1], t = lum[i - w], tr = lum[i - w + 1];
                const ml = lum[i - 1], mr = lum[i + 1];
                const bl = lum[i + w - 1], bm = lum[i + w], br = lum[i + w + 1];
                const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
                const gy = (bl + 2 * bm + br) - (tl + 2 * t + tr);
                const m = Math.sqrt(gx * gx + gy * gy);
                g[i] = m;
                if (m > max) max = m;
            }
        }
        /* Normalisation robuste plutôt que « divisé par le maximum » : sur une
           image granuleuse, le bruit produit un gradient de fond non nul partout,
           qui coûtait cher à la sélection rapide (pénalité de contour) et attirait
           le lasso n'importe où. On cale donc 0 sur le niveau courant (médiane) et
           1 sur les vrais contours (98e centile). */
        const BINS = 256;
        const hist = new Int32Array(BINS);
        for (let i = 0; i < g.length; i++) {
            let b = ((g[i] / max) * (BINS - 1)) | 0;
            if (b < 0) b = 0; else if (b >= BINS) b = BINS - 1;
            hist[b]++;
        }
        const total = g.length;
        const percentile = (frac) => {
            const target = total * frac;
            let acc = 0;
            for (let b = 0; b < BINS; b++) {
                acc += hist[b];
                if (acc >= target) return (b / (BINS - 1)) * max;
            }
            return max;
        };
        const lo = percentile(0.5);
        const hi = Math.max(lo + 1e-6, percentile(0.98));
        const span = hi - lo;
        for (let i = 0; i < g.length; i++) {
            let v = (g[i] - lo) / span;
            g[i] = v <= 0 ? 0 : v >= 1 ? 1 : v;
        }
        return g;
    }

    /* ─── Tas binaire (file de priorité min) ─────────────────────────────── */

    function MinHeap(capacity) {
        this.idx = new Int32Array(capacity);
        this.key = new Float32Array(capacity);
        this.size = 0;
    }
    MinHeap.prototype.clear = function () { this.size = 0; };
    MinHeap.prototype._grow = function () {
        const n = Math.max(16, this.idx.length * 2);
        const ni = new Int32Array(n); ni.set(this.idx);
        const nk = new Float32Array(n); nk.set(this.key);
        this.idx = ni; this.key = nk;
    };
    MinHeap.prototype.push = function (index, key) {
        if (this.size >= this.idx.length) this._grow();
        let i = this.size++;
        this.idx[i] = index; this.key[i] = key;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.key[p] <= this.key[i]) break;
            const ti = this.idx[p], tk = this.key[p];
            this.idx[p] = this.idx[i]; this.key[p] = this.key[i];
            this.idx[i] = ti; this.key[i] = tk;
            i = p;
        }
    };
    MinHeap.prototype.pop = function () {
        const top = this.idx[0];
        this.size--;
        if (this.size > 0) {
            this.idx[0] = this.idx[this.size];
            this.key[0] = this.key[this.size];
            let i = 0;
            for (;;) {
                const l = 2 * i + 1, r = l + 1;
                let m = i;
                if (l < this.size && this.key[l] < this.key[m]) m = l;
                if (r < this.size && this.key[r] < this.key[m]) m = r;
                if (m === i) break;
                const ti = this.idx[m], tk = this.key[m];
                this.idx[m] = this.idx[i]; this.key[m] = this.key[i];
                this.idx[i] = ti; this.key[i] = tk;
                i = m;
            }
        }
        return top;
    };

    const NB8_DX = [1, -1, 0, 0, 1, 1, -1, -1];
    const NB8_DY = [0, 0, 1, -1, 1, -1, 1, -1];
    const NB8_LEN = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

    /* ─── Lasso magnétique : chemin de moindre coût le long des contours ─── */

    /**
     * Dijkstra de `from` vers `to`, restreint à la fenêtre englobante des deux
     * points élargie de `margin`. Le coût d'entrée sur un pixel décroît avec la
     * force du contour : le chemin « colle » donc aux bords de l'objet.
     *
     * @returns {Array<{x:number,y:number}>} chemin (from → to), vide si échec.
     */
    function livewire(opts) {
        const w = opts.w | 0;
        const h = opts.h | 0;
        const edge = opts.edge;
        const from = opts.from;
        const to = opts.to;
        const margin = opts.margin != null ? opts.margin : 24;
        /* Poids du contour : 0 = ligne droite, 1 = colle au contour le plus fort. */
        const pull = opts.pull != null ? opts.pull : 1;

        if (!edge || !from || !to) return [];
        const fx = Math.max(0, Math.min(w - 1, Math.round(from.x)));
        const fy = Math.max(0, Math.min(h - 1, Math.round(from.y)));
        const tx = Math.max(0, Math.min(w - 1, Math.round(to.x)));
        const ty = Math.max(0, Math.min(h - 1, Math.round(to.y)));
        if (fx === tx && fy === ty) return [{ x: fx, y: fy }];

        const x0 = Math.max(0, Math.min(fx, tx) - margin);
        const x1 = Math.min(w - 1, Math.max(fx, tx) + margin);
        const y0 = Math.max(0, Math.min(fy, ty) - margin);
        const y1 = Math.min(h - 1, Math.max(fy, ty) + margin);
        const bw = x1 - x0 + 1;
        const bh = y1 - y0 + 1;
        const n = bw * bh;
        if (n <= 0) return [];

        const dist = new Float32Array(n).fill(Infinity);
        const prev = new Int32Array(n).fill(-1);
        const done = new Uint8Array(n);
        const heap = new MinHeap(Math.min(n, 4096));

        const startLocal = (fy - y0) * bw + (fx - x0);
        const endLocal = (ty - y0) * bw + (tx - x0);
        dist[startLocal] = 0;
        heap.push(startLocal, 0);

        while (heap.size > 0) {
            const cur = heap.pop();
            if (done[cur]) continue;
            done[cur] = 1;
            if (cur === endLocal) break;
            const cx = x0 + (cur % bw);
            const cy = y0 + ((cur / bw) | 0);
            for (let k = 0; k < 8; k++) {
                const nx = cx + NB8_DX[k];
                const ny = cy + NB8_DY[k];
                if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
                const nl = (ny - y0) * bw + (nx - x0);
                if (done[nl]) continue;
                /* 1 - contour : traverser un pixel de fort gradient ne coûte presque rien. */
                const step = NB8_LEN[k] * (1 - pull * 0.98 * edge[ny * w + nx]);
                const nd = dist[cur] + step;
                if (nd < dist[nl]) {
                    dist[nl] = nd;
                    prev[nl] = cur;
                    heap.push(nl, nd);
                }
            }
        }

        if (!done[endLocal] && prev[endLocal] < 0) return [];
        const path = [];
        let c = endLocal;
        let guard = n + 8;
        while (c >= 0 && guard-- > 0) {
            path.push({ x: x0 + (c % bw), y: y0 + ((c / bw) | 0) });
            if (c === startLocal) break;
            c = prev[c];
        }
        path.reverse();
        return path;
    }

    /* ─── Sélection rapide : distance géodésique couleur depuis les traits ── */

    /**
     * Propage depuis les pixels « graine » (là où le pinceau est passé) une
     * distance qui s'accumule avec les écarts de couleur entre voisins. Une zone
     * uniforme se remplit presque gratuitement, un contour coûte cher : la
     * sélection s'arrête donc d'elle-même sur les bords, comme la sélection
     * rapide de Photoshop.
     *
     * @param {Uint8Array} seeds 1 = pixel peint par l'utilisateur
     * @param {number} tolerance 0..100 (réglage ruban)
     */
    function quickSelect(opts) {
        const w = opts.w | 0;
        const h = opts.h | 0;
        /* Comparaisons de couleur sur une copie légèrement débruitée : sur une
           photo granuleuse, le grain dominerait sinon les écarts entre voisins
           et bloquerait la propagation à quelques pixels du trait. Les vrais
           contours, eux, survivent largement à un flou 3×3. */
        const denoise = opts.denoise != null ? opts.denoise : 1;
        const data = denoise > 0 ? blurRGBA(opts.data, w, h, denoise) : opts.data;
        const seeds = opts.seeds;
        const edge = opts.edge;
        const n = w * h;
        const tol = Math.max(0, Math.min(100, opts.tolerance != null ? opts.tolerance : 40));
        const k = Math.pow(tol / 100, 1.5);

        /* Statistiques des pixels peints : couleur moyenne + dispersion. La
           dispersion élargit la tolérance sur un sujet texturé et sert de
           plancher de bruit pour la propagation. */
        let sr = 0, sg = 0, sb = 0, sa = 0, cnt = 0;
        for (let i = 0; i < n; i++) {
            if (!seeds[i]) continue;
            const p = i * 4;
            sr += data[p]; sg += data[p + 1]; sb += data[p + 2]; sa += data[p + 3];
            cnt++;
        }
        if (!cnt) return new Uint8Array(n);
        const mr = sr / cnt, mg = sg / cnt, mb = sb / cnt, ma = sa / cnt;
        let varSum = 0;
        for (let i = 0; i < n; i++) {
            if (!seeds[i]) continue;
            const p = i * 4;
            const dr = data[p] - mr, dg = data[p + 1] - mg, db = data[p + 2] - mb;
            varSum += dr * dr + dg * dg + db * db;
        }
        const seedStd = Math.sqrt(varSum / cnt) / 255;

        /* Garde absolue : un pixel trop éloigné de la couleur des traits n'entre
           jamais, quelle que soit la distance parcourue. C'est ce qui empêche la
           sélection de déborder sur le fond, y compris sur une image bruitée où
           la distance géodésique seule dérive. */
        const tolAbs = 0.05 + k * 0.85 + Math.min(0.35, seedStd * 1.5);
        /* Distance géodésique : garde la sélection d'un seul tenant et l'arrête
           net sur un contour, même si la couleur d'en face passerait la garde.
           Le plafond reste sous le coût d'une traversée de contour franc
           (≈ 2,3) pour qu'aucun réglage ne fasse « sauter » le bord ; c'est la
           garde absolue, plus haut, qui limite l'étendue en zone uniforme. */
        const limit = 0.45 + k * 1.6;
        /* Plancher de bruit = écart moyen entre pixels VOISINS là où l'utilisateur
           a peint. Sans lui, la distance géodésique s'accumule sur une photo
           granuleuse et la sélection s'arrête à quelques dizaines de pixels du
           trait, même en pleine zone uniforme. (La dispersion autour de la
           moyenne, elle, ne dit rien du coût d'un pas.) */
        let nfSum = 0, nfCnt = 0;
        for (let i = 0; i < n && nfCnt < 4000; i++) {
            if (!seeds[i]) continue;
            const x = i % w, y = (i / w) | 0;
            const p = i * 4;
            for (let d = 0; d < 4; d++) {
                const nx = x + NB8_DX[d], ny = y + NB8_DY[d];
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                const q = (ny * w + nx) * 4;
                const dr = (data[p] - data[q]) / 255;
                const dg = (data[p + 1] - data[q + 1]) / 255;
                const db = (data[p + 2] - data[q + 2]) / 255;
                nfSum += Math.sqrt(dr * dr + dg * dg + db * db);
                nfCnt++;
            }
        }
        const noiseFloor = nfCnt > 0 ? Math.min(0.45, (nfSum / nfCnt) * 1.6) : 0;

        /* Même raisonnement pour les contours : la texture du sujet là où
           l'utilisateur peint donne le niveau de gradient « normal ». Seul ce
           qui le dépasse nettement est une vraie frontière. Sans ce recalage,
           un sujet texturé (tissu, feuillage) bloquait la propagation dès le
           deuxième pixel, d'autant plus que l'image de travail est réduite. */
        let efSum = 0, efCnt = 0;
        if (edge) {
            for (let i = 0; i < n; i++) {
                if (!seeds[i]) continue;
                efSum += edge[i];
                efCnt++;
            }
        }
        const edgeFloor = efCnt > 0 ? Math.min(0.9, (efSum / efCnt) * 1.15) : 0;
        const edgeSpan = 1 - edgeFloor;
        const edgePenalty = opts.edgePenalty != null ? opts.edgePenalty : 1.4;

        const dist = new Float32Array(n).fill(Infinity);
        const heap = new MinHeap(4096);
        for (let i = 0; i < n; i++) {
            if (seeds[i]) { dist[i] = 0; heap.push(i, 0); }
        }

        const withinTol = (i) => {
            const p = i * 4;
            const dr = (data[p] - mr) / 255;
            const dg = (data[p + 1] - mg) / 255;
            const db = (data[p + 2] - mb) / 255;
            const da = (data[p + 3] - ma) / 255;
            return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= tolAbs;
        };

        const done = new Uint8Array(n);
        while (heap.size > 0) {
            const cur = heap.pop();
            if (done[cur]) continue;
            done[cur] = 1;
            const d0 = dist[cur];
            if (d0 > limit) continue;
            const cx = cur % w;
            const cy = (cur / w) | 0;
            const ci = cur * 4;
            for (let kk = 0; kk < 8; kk++) {
                const nx = cx + NB8_DX[kk];
                const ny = cy + NB8_DY[kk];
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                const nl = ny * w + nx;
                if (done[nl]) continue;
                if (!seeds[nl] && !withinTol(nl)) continue;
                const ni = nl * 4;
                const dr = (data[ci] - data[ni]) / 255;
                const dg = (data[ci + 1] - data[ni + 1]) / 255;
                const db = (data[ci + 2] - data[ni + 2]) / 255;
                const da = (data[ci + 3] - data[ni + 3]) / 255;
                const col = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
                /* Puissance 4 et non 2 : la texture interne d'un sujet (tissu,
                   feuillage, grain) produit un gradient moyen qui, au carré,
                   bloquait la propagation dès quelques pixels. Seuls les
                   contours francs (e proche de 1) doivent coûter cher. */
                const eRaw = edge ? edge[nl] : 0;
                const e = eRaw > edgeFloor ? (eRaw - edgeFloor) / edgeSpan : 0;
                const e2 = e * e;
                const step =
                    NB8_LEN[kk] * (0.001 + Math.max(0, col - noiseFloor) + edgePenalty * e2 * e2);
                const nd = d0 + step;
                if (nd < dist[nl] && nd <= limit) {
                    dist[nl] = nd;
                    heap.push(nl, nd);
                }
            }
        }

        const mask = new Uint8Array(n);
        for (let i = 0; i < n; i++) if (dist[i] <= limit) mask[i] = 1;
        return mask;
    }

    /* ─── Sélection d'objet : modèles couleur + relaxation ICM ───────────── */

    /** k-moyennes sur des couleurs RGB (échantillons plats r,g,b). */
    function kmeans(samples, count, k, iters) {
        k = Math.max(1, Math.min(k, count));
        const cent = new Float32Array(k * 3);
        /* Init déterministe et étalée : évite le hasard (résultat reproductible). */
        for (let c = 0; c < k; c++) {
            const s = Math.floor((c + 0.5) * count / k) * 3;
            cent[c * 3] = samples[s];
            cent[c * 3 + 1] = samples[s + 1];
            cent[c * 3 + 2] = samples[s + 2];
        }
        const sum = new Float32Array(k * 3);
        const cnt = new Int32Array(k);
        for (let it = 0; it < iters; it++) {
            sum.fill(0); cnt.fill(0);
            for (let p = 0; p < count; p++) {
                const r = samples[p * 3], g = samples[p * 3 + 1], b = samples[p * 3 + 2];
                let best = 0, bestD = Infinity;
                for (let c = 0; c < k; c++) {
                    const dr = r - cent[c * 3], dg = g - cent[c * 3 + 1], db = b - cent[c * 3 + 2];
                    const d = dr * dr + dg * dg + db * db;
                    if (d < bestD) { bestD = d; best = c; }
                }
                sum[best * 3] += r; sum[best * 3 + 1] += g; sum[best * 3 + 2] += b;
                cnt[best]++;
            }
            for (let c = 0; c < k; c++) {
                if (cnt[c] > 0) {
                    cent[c * 3] = sum[c * 3] / cnt[c];
                    cent[c * 3 + 1] = sum[c * 3 + 1] / cnt[c];
                    cent[c * 3 + 2] = sum[c * 3 + 2] / cnt[c];
                }
            }
        }
        return cent;
    }

    function minClusterDist2(cent, k, r, g, b) {
        let best = Infinity;
        for (let c = 0; c < k; c++) {
            const dr = r - cent[c * 3], dg = g - cent[c * 3 + 1], db = b - cent[c * 3 + 2];
            const d = dr * dr + dg * dg + db * db;
            if (d < best) best = d;
        }
        return best;
    }

    /**
     * Segmente l'objet contenu dans `rect` (coordonnées du buffer réduit).
     * Approximation de GrabCut : modèles couleur avant/arrière par k-moyennes,
     * puis quelques passes ICM sur un champ de Markov dont le terme de lissage
     * est atténué par les contours.
     */
    function objectSelect(opts) {
        const data = opts.data;
        const w = opts.w | 0;
        const h = opts.h | 0;
        const n = w * h;
        const prof = qualityProfile(opts.quality);
        const iterations = opts.iterations != null ? opts.iterations : prof.iterations;
        const K = opts.kmeans != null ? opts.kmeans : prof.kmeans;
        const kmIters = opts.kmeansIters != null ? opts.kmeansIters : prof.kmeansIters;

        const rx0 = Math.max(0, Math.min(w - 1, opts.rect.x | 0));
        const ry0 = Math.max(0, Math.min(h - 1, opts.rect.y | 0));
        const rx1 = Math.max(rx0 + 1, Math.min(w, (opts.rect.x + opts.rect.w) | 0));
        const ry1 = Math.max(ry0 + 1, Math.min(h, (opts.rect.y + opts.rect.h) | 0));
        const rw = rx1 - rx0;
        const rh = ry1 - ry0;
        if (rw < 3 || rh < 3) return new Uint8Array(n);

        /* Hypothèse GrabCut : hors du cadre = fond certain. On y ajoute une fine
           bande intérieure comme fond probable (l'utilisateur cadre rarement au
           pixel près), et on ne prélève l'échantillon « objet » qu'au CŒUR du
           cadre — c'est décisif : prélever jusqu'à la bordure fait entrer du fond
           dans le modèle d'objet, et la sélection déborde alors largement
           (mesuré : 86 % d'IoU en prélevant partout, 99,5 % en se limitant au cœur). */
        const bandX = Math.max(1, Math.round(rw * 0.06));
        const bandY = Math.max(1, Math.round(rh * 0.06));
        const coreX = rw * 0.25;
        const coreY = rh * 0.25;

        const fgS = [];
        const bgS = [];
        const pushSample = (arr, i) => {
            const p = i * 4;
            arr.push(data[p], data[p + 1], data[p + 2]);
        };
        /* Sous-échantillonnage : quelques milliers de points suffisent aux k-moyennes. */
        const stride = Math.max(1, Math.round(Math.sqrt(n / 6000)));
        for (let y = 0; y < h; y += stride) {
            for (let x = 0; x < w; x += stride) {
                const i = y * w + x;
                const inRect = x >= rx0 && x < rx1 && y >= ry0 && y < ry1;
                if (!inRect) { pushSample(bgS, i); continue; }
                const nearBorder =
                    x < rx0 + bandX || x >= rx1 - bandX || y < ry0 + bandY || y >= ry1 - bandY;
                if (nearBorder) { pushSample(bgS, i); continue; }
                const inCore =
                    x >= rx0 + coreX && x < rx1 - coreX && y >= ry0 + coreY && y < ry1 - coreY;
                if (inCore) pushSample(fgS, i);
            }
        }
        if (fgS.length < 9 || bgS.length < 9) return new Uint8Array(n);

        const fgArr = Float32Array.from(fgS);
        const bgArr = Float32Array.from(bgS);
        const fgC = kmeans(fgArr, fgArr.length / 3, K, kmIters);
        const bgC = kmeans(bgArr, bgArr.length / 3, K, kmIters);
        const kFg = Math.min(K, fgArr.length / 3 | 0);
        const kBg = Math.min(K, bgArr.length / 3 | 0);

        /* Terme d'attache aux données : distance au modèle le plus proche. */
        const costFg = new Float32Array(n);
        const costBg = new Float32Array(n);
        const label = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            const p = i * 4;
            const r = data[p], g = data[p + 1], b = data[p + 2];
            const dF = minClusterDist2(fgC, kFg, r, g, b);
            const dB = minClusterDist2(bgC, kBg, r, g, b);
            /* Normalisé sur 255² : le terme d'attache aux données tient alors dans
               0..3, du même ordre que le terme de lissage (λ × 4 voisins au plus).
               Avec l'échelle précédente il l'écrasait, et la relaxation ICM ne
               changeait rien — la segmentation se réduisait à un seuillage. */
            costFg[i] = dF / 65025;
            costBg[i] = dB / 65025;
            label[i] = dF < dB ? 1 : 0;
        }
        /* Hors du cadre : fond certain (contrainte dure, comme GrabCut). */
        for (let y = 0; y < h; y++) {
            const inY = y >= ry0 && y < ry1;
            for (let x = 0; x < w; x++) {
                if (inY && x >= rx0 && x < rx1) continue;
                label[y * w + x] = 0;
            }
        }

        /* Lissage sensible aux contours : β issu du contraste moyen de l'image. */
        let beta = 0;
        let bn = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w - 1; x++) {
                const i = y * w + x, j = i + 1;
                const dr = data[i * 4] - data[j * 4];
                const dg = data[i * 4 + 1] - data[j * 4 + 1];
                const db = data[i * 4 + 2] - data[j * 4 + 2];
                beta += dr * dr + dg * dg + db * db;
                bn++;
            }
        }
        beta = bn > 0 ? 1 / (2 * Math.max(1, beta / bn)) : 0.001;
        const lambda = opts.smoothness != null ? opts.smoothness : 1.2;

        const next = new Uint8Array(n);
        for (let it = 0; it < iterations; it++) {
            next.set(label);
            for (let y = ry0; y < ry1; y++) {
                for (let x = rx0; x < rx1; x++) {
                    const i = y * w + x;
                    let eFg = costFg[i];
                    let eBg = costBg[i];
                    const p = i * 4;
                    for (let k = 0; k < 4; k++) {
                        const nx = x + NB8_DX[k];
                        const ny = y + NB8_DY[k];
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                        const j = ny * w + nx;
                        const q = j * 4;
                        const dr = data[p] - data[q];
                        const dg = data[p + 1] - data[q + 1];
                        const db = data[p + 2] - data[q + 2];
                        const wgt = lambda * Math.exp(-beta * (dr * dr + dg * dg + db * db));
                        if (label[j] === 1) eBg += wgt; else eFg += wgt;
                    }
                    next[i] = eFg < eBg ? 1 : 0;
                }
            }
            label.set(next);
        }

        let mask = label;
        mask = largestComponent(mask, w, h);
        mask = fillHoles(mask, w, h);
        if (prof.smooth > 0) mask = smoothMask(mask, w, h, prof.smooth);
        return mask;
    }

    /* ─── Post-traitement de masque ──────────────────────────────────────── */

    /** Ne garde que la plus grande composante connexe (supprime les îlots). */
    function largestComponent(mask, w, h) {
        const n = w * h;
        const lab = new Int32Array(n).fill(-1);
        const stack = new Int32Array(n);
        let best = -1, bestSize = 0, cur = 0;
        for (let s = 0; s < n; s++) {
            if (!mask[s] || lab[s] >= 0) continue;
            let sp = 0, size = 0;
            stack[sp++] = s;
            lab[s] = cur;
            while (sp > 0) {
                const i = stack[--sp];
                size++;
                const x = i % w, y = (i / w) | 0;
                for (let k = 0; k < 4; k++) {
                    const nx = x + NB8_DX[k], ny = y + NB8_DY[k];
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                    const j = ny * w + nx;
                    if (mask[j] && lab[j] < 0) { lab[j] = cur; stack[sp++] = j; }
                }
            }
            if (size > bestSize) { bestSize = size; best = cur; }
            cur++;
        }
        if (best < 0) return mask;
        const out = new Uint8Array(n);
        for (let i = 0; i < n; i++) if (lab[i] === best) out[i] = 1;
        return out;
    }

    /** Bouche les trous : tout le fond non relié au bord de l'image devient objet. */
    function fillHoles(mask, w, h) {
        const n = w * h;
        const outside = new Uint8Array(n);
        const stack = new Int32Array(n);
        let sp = 0;
        const push = (i) => { if (!mask[i] && !outside[i]) { outside[i] = 1; stack[sp++] = i; } };
        for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
        for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
        while (sp > 0) {
            const i = stack[--sp];
            const x = i % w, y = (i / w) | 0;
            for (let k = 0; k < 4; k++) {
                const nx = x + NB8_DX[k], ny = y + NB8_DY[k];
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                push(ny * w + nx);
            }
        }
        const out = new Uint8Array(n);
        for (let i = 0; i < n; i++) out[i] = mask[i] || !outside[i] ? 1 : 0;
        return out;
    }

    /** Vote majoritaire dans un voisinage carré : adoucit les bords en escalier. */
    function smoothMask(mask, w, h, radius) {
        if (radius <= 0) return mask;
        const n = w * h;
        /* Somme intégrale : coût indépendant du rayon. */
        const sat = new Int32Array((w + 1) * (h + 1));
        for (let y = 0; y < h; y++) {
            let rowSum = 0;
            for (let x = 0; x < w; x++) {
                rowSum += mask[y * w + x];
                sat[(y + 1) * (w + 1) + (x + 1)] = sat[y * (w + 1) + (x + 1)] + rowSum;
            }
        }
        const area = (x0, y0, x1, y1) =>
            sat[y1 * (w + 1) + x1] - sat[y0 * (w + 1) + x1] - sat[y1 * (w + 1) + x0] + sat[y0 * (w + 1) + x0];
        const out = new Uint8Array(n);
        for (let y = 0; y < h; y++) {
            const y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1);
            for (let x = 0; x < w; x++) {
                const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1);
                const cnt = area(x0, y0, x1, y1);
                const tot = (x1 - x0) * (y1 - y0);
                out[y * w + x] = cnt * 2 > tot ? 1 : 0;
            }
        }
        return out;
    }

    /**
     * Coût d'un pas diagonal selon le type de joint voulu.
     *
     * La boule d'une distance de chamfer (pas droit = 1, pas diagonal = b) donne
     * directement la forme de l'élément structurant, donc l'allure des angles
     * après dilatation :
     *   b = √2  → disque      : angles arrondis
     *   b = 1.2 → octogone    : angles biseautés
     *   b = 1   → carré (L∞)  : angles droits conservés tels quels
     * Un seul paramètre suffit donc à couvrir les trois joints.
     */
    const JOIN_DIAG = { round: Math.SQRT2, bevel: 1.2, miter: 1 };

    function joinDiagonalCost(join) {
        return JOIN_DIAG[join] || JOIN_DIAG.round;
    }

    /**
     * Distance au pixel « allumé » le plus proche (chamfer deux passes).
     * Suffisamment exacte pour un rayon de quelques dizaines de pixels, et
     * linéaire en nombre de pixels — contrairement à une dilatation par disque
     * qui coûterait O(n·r²).
     *
     * @param {number} [diagCost] coût d'un pas diagonal (voir JOIN_DIAG)
     */
    function distanceTransform(src, w, h, diagCost) {
        const INF = 1e9;
        const n = w * h;
        const d = new Float32Array(n);
        for (let i = 0; i < n; i++) d[i] = src[i] ? 0 : INF;
        const D = diagCost != null ? diagCost : Math.SQRT2;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                let v = d[i];
                if (v === 0) continue;
                if (y > 0) {
                    if (x > 0) v = Math.min(v, d[i - w - 1] + D);
                    v = Math.min(v, d[i - w] + 1);
                    if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
                }
                if (x > 0) v = Math.min(v, d[i - 1] + 1);
                d[i] = v;
            }
        }
        for (let y = h - 1; y >= 0; y--) {
            for (let x = w - 1; x >= 0; x--) {
                const i = y * w + x;
                let v = d[i];
                if (v === 0) continue;
                if (y < h - 1) {
                    if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
                    v = Math.min(v, d[i + w] + 1);
                    if (x > 0) v = Math.min(v, d[i + w - 1] + D);
                }
                if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
                d[i] = v;
            }
        }
        return d;
    }

    /**
     * Dilate (rayon > 0) ou érode (rayon < 0) un masque, en pixels.
     *
     * @param {'round'|'bevel'|'miter'} [join] traitement des angles :
     *   'round' arrondit (défaut), 'bevel' coupe le coin, 'miter' conserve
     *   l'angle droit. Le joint vaut aussi pour l'érosion, sans quoi réduire
     *   puis étendre d'autant ne redonnerait pas la forme de départ.
     * @returns {Uint8Array} nouveau masque (l'entrée n'est pas modifiée)
     */
    function growMask(mask, w, h, radius, join) {
        const r = Math.abs(radius);
        if (!r) return mask;
        const n = w * h;
        const diag = joinDiagonalCost(join);
        const out = new Uint8Array(n);
        if (radius > 0) {
            const d = distanceTransform(mask, w, h, diag);
            for (let i = 0; i < n; i++) out[i] = mask[i] || d[i] <= r ? 1 : 0;
        } else {
            /* Éroder = dilater le complément, puis reprendre le complément. */
            const inv = new Uint8Array(n);
            for (let i = 0; i < n; i++) inv[i] = mask[i] ? 0 : 1;
            const d = distanceTransform(inv, w, h, diag);
            for (let i = 0; i < n; i++) out[i] = mask[i] && d[i] > r ? 1 : 0;
        }
        return out;
    }

    /** Contour extérieur du masque, en polygone (suivi de contour de Moore). */
    function maskToPolygon(mask, w, h) {
        let start = -1;
        for (let i = 0; i < w * h; i++) if (mask[i]) { start = i; break; }
        if (start < 0) return [];
        const sx = start % w, sy = (start / w) | 0;
        const dx = [1, 1, 0, -1, -1, -1, 0, 1];
        const dy = [0, 1, 1, 1, 0, -1, -1, -1];
        const at = (x, y) => (x < 0 || x >= w || y < 0 || y >= h ? 0 : mask[y * w + x]);
        const pts = [];
        let cx = sx, cy = sy, dir = 6;
        const guard = w * h * 4;
        for (let step = 0; step < guard; step++) {
            pts.push({ x: cx, y: cy });
            let found = false;
            for (let k = 0; k < 8; k++) {
                const d = (dir + 6 + k) % 8;
                const nx = cx + dx[d], ny = cy + dy[d];
                if (at(nx, ny)) { cx = nx; cy = ny; dir = d; found = true; break; }
            }
            if (!found) break;
            if (cx === sx && cy === sy && pts.length > 2) break;
        }
        return pts;
    }

    root.IlluSelectCore = {
        QUALITY: QUALITY,
        qualityProfile: qualityProfile,
        scaleFactorFor: scaleFactorFor,
        downscaleRGBA: downscaleRGBA,
        upscaleMask: upscaleMask,
        blurPlane: blurPlane,
        blurRGBA: blurRGBA,
        buildEdgeMap: buildEdgeMap,
        livewire: livewire,
        quickSelect: quickSelect,
        objectSelect: objectSelect,
        JOIN_DIAG: JOIN_DIAG,
        distanceTransform: distanceTransform,
        growMask: growMask,
        largestComponent: largestComponent,
        fillHoles: fillHoles,
        smoothMask: smoothMask,
        maskToPolygon: maskToPolygon
    };
})(typeof self !== 'undefined' ? self : globalThis);
