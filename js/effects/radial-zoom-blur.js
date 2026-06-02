/**
 * Radial Blur and Zoom Blur – OpenPDN port with progressive safe-zone.
 *
 * innerRadius [0,1]:  rayon de zone nette (fraction de la demi-diagonale)
 *   – À l'intérieur : pixel copié sans modification.
 *   – À la frontière : flou = 0 (aucune rotation / aucun zoom).
 *   – Au bord de l'image : flou = 100 % (intensité complète).
 *   La progression est LINÉAIRE avec la distance depuis safeR jusqu'à maxR.
 *   On scale directement le paramètre de flou (fsr ou fz) par t ∈ [0,1].
 *
 * offsetX/Y [-1,1] : décalage du centre par rapport au centre du canvas.
 *   0,0 → centre exact du canvas.  (bug précédent : cx = fcx/32768 → w au lieu de w/2)
 *   Le centre réel en pixels est cx = fcx / 65536.
 */
(function (global) {
    'use strict';

    /** Clamp a value to [0, 255]. */
    function clamp255(v) {
        return v < 0 ? 0 : v > 255 ? 255 : v | 0;
    }

    /* ------------------------------------------------------------------
     * Radial (Spin) Blur  – OpenPDN RadialBlurEffect port
     *
     * opts:
     *   angle       – arc total en degrés (0-360, défaut 2)
     *   quality     – 1-5, nombre de samples n = q²*(30+q²) (défaut 2)
     *   offsetX     – décalage horizontal du centre [-1, 1] (0 = centre canvas)
     *   offsetY     – décalage vertical   du centre [-1, 1] (0 = centre canvas)
     *   innerRadius – rayon de zone nette [0,1] (fraction de la demi-diagonale)
     *   startY / endY – tile rendering
     * ------------------------------------------------------------------ */
    function illuRadialBlurRGBA(src, w, h, opts) {
        opts = opts || {};

        const angle       = opts.angle       != null ? Math.max(0, Math.min(360, opts.angle))   : 2;
        const quality     = opts.quality     != null ? Math.max(1, Math.min(5,   opts.quality)) : 2;
        const offsetX     = opts.offsetX     != null ? opts.offsetX : 0;
        const offsetY     = opts.offsetY     != null ? opts.offsetY : 0;
        const innerRadius = opts.innerRadius != null ? Math.max(0, Math.min(1, opts.innerRadius)) : 0;
        const sy = opts.startY != null ? opts.startY : 0;
        const ey = opts.endY   != null ? opts.endY   : h;

        const out = new Uint8ClampedArray(src.length);
        for (let i = 0; i < sy * w * 4; i++) out[i] = src[i];
        for (let i = ey * w * 4; i < src.length; i++) out[i] = src[i];

        // --- Fixed-point centre (OpenPDN convention, × 2^15) ---
        // fcx = (w << 15) + offsetX * (w << 15)
        // Centre réel en pixels : fcx / 65536  (NOT / 32768 !)
        // Preuve : pour x = w/2, (x<<16) - fcx = w/2*65536 - w*32768*(1+offsetX)
        //          = 0 quand offsetX=0  → centre à w/2 ✓
        const fcx = Math.round((w << 15) + offsetX * (w << 15));
        const fcy = Math.round((h << 15) + offsetY * (h << 15));

        // Centre en pixels (float)
        const cx = fcx / 65536;   // = w/2 * (1 + offsetX)
        const cy = fcy / 65536;   // = h/2 * (1 + offsetY)

        // Demi-diagonale depuis le centre (distance maximale atteignable)
        const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) || 1;
        const safeR = innerRadius * maxR;

        // Amplitude de rotation par step (OpenPDN)
        const n  = quality * quality * (30 + quality * quality);
        const fr = Math.round(angle * Math.PI * 65536.0 / 181.0);
        const baseFsr = fr / n;   // rotation maximale par step (intensité = 1)

        for (let y = sy; y < ey; y++) {
            for (let x = 0; x < w; x++) {
                const si0 = (y * w + x) * 4;

                // Distance euclidienne exacte au centre
                const dist = Math.hypot(x - cx, y - cy);

                // ── Zone nette : copie brute ──
                if (dist <= safeR) {
                    out[si0]     = src[si0];
                    out[si0 + 1] = src[si0 + 1];
                    out[si0 + 2] = src[si0 + 2];
                    out[si0 + 3] = src[si0 + 3];
                    continue;
                }

                // ── Progression linéaire depuis la frontière ──
                // t = 0 à safeR, t = 1 à maxR
                const t   = (maxR > safeR) ? (dist - safeR) / (maxR - safeR) : 1;
                const fsr = baseFsr * t;   // scale l'arc de rotation par t

                // Position relative au centre (fixed-point × 2^16)
                let ox1 = (x << 16) - fcx;
                let oy1 = (y << 16) - fcy;
                let ox2 = ox1;
                let oy2 = oy1;

                // Accumulation alpha-prémultipliée (pixel source inclus)
                const a0 = src[si0 + 3];
                let sumR = src[si0]     * a0;
                let sumG = src[si0 + 1] * a0;
                let sumB = src[si0 + 2] * a0;
                let sumA = a0;
                let cnt  = 1;

                for (let i = 0; i < n; i++) {
                    let cx_, cy_;

                    // CW rotation (approx. PDN : sin≈x, cos≈1-x²/2)
                    cx_ = ox1; cy_ = oy1;
                    ox1 = cx_ - ((cy_ >> 8) * fsr >> 8) - ((cx_ >> 14) * (fsr * fsr >> 11) >> 8);
                    oy1 = cy_ + ((cx_ >> 8) * fsr >> 8) - ((cy_ >> 14) * (fsr * fsr >> 11) >> 8);

                    // CCW rotation
                    cx_ = ox2; cy_ = oy2;
                    ox2 = cx_ - ((cy_ >> 8) * (-fsr) >> 8) - ((cx_ >> 14) * ((-fsr) * (-fsr) >> 11) >> 8);
                    oy2 = cy_ + ((cx_ >> 8) * (-fsr) >> 8) - ((cy_ >> 14) * ((-fsr) * (-fsr) >> 11) >> 8);

                    const u1 = (ox1 + fcx + 32768) >> 16;
                    const v1 = (oy1 + fcy + 32768) >> 16;
                    if (u1 > 0 && v1 > 0 && u1 < w && v1 < h) {
                        const si = (v1 * w + u1) * 4;
                        const a  = src[si + 3];
                        sumR += src[si] * a; sumG += src[si+1] * a;
                        sumB += src[si+2] * a; sumA += a; cnt++;
                    }

                    const u2 = (ox2 + fcx + 32768) >> 16;
                    const v2 = (oy2 + fcy + 32768) >> 16;
                    if (u2 > 0 && v2 > 0 && u2 < w && v2 < h) {
                        const si = (v2 * w + u2) * 4;
                        const a  = src[si + 3];
                        sumR += src[si] * a; sumG += src[si+1] * a;
                        sumB += src[si+2] * a; sumA += a; cnt++;
                    }
                }

                if (sumA > 0) {
                    out[si0]     = clamp255(sumR / sumA);
                    out[si0 + 1] = clamp255(sumG / sumA);
                    out[si0 + 2] = clamp255(sumB / sumA);
                    out[si0 + 3] = clamp255(sumA / cnt);
                } else {
                    out[si0] = out[si0+1] = out[si0+2] = out[si0+3] = 0;
                }
            }
        }
        return out;
    }

    /* ------------------------------------------------------------------
     * Zoom Blur  – OpenPDN ZoomBlurEffect port
     *
     * opts:
     *   amount      – intensité 0-100 (défaut 10)
     *   offsetX/Y   – décalage du point focal [-1,1] (0 = centre canvas)
     *   innerRadius – rayon de zone nette [0,1]
     *   startY / endY
     * ------------------------------------------------------------------ */
    function illuZoomBlurRGBA(src, w, h, opts) {
        opts = opts || {};

        const amount      = opts.amount      != null ? Math.max(0, Math.min(100, opts.amount)) : 10;
        const offsetX     = opts.offsetX     != null ? opts.offsetX : 0;
        const offsetY     = opts.offsetY     != null ? opts.offsetY : 0;
        const innerRadius = opts.innerRadius != null ? Math.max(0, Math.min(1, opts.innerRadius)) : 0;
        const sy = opts.startY != null ? opts.startY : 0;
        const ey = opts.endY   != null ? opts.endY   : h;

        const out = new Uint8ClampedArray(src.length);
        for (let i = 0; i < sy * w * 4; i++) out[i] = src[i];
        for (let i = ey * w * 4; i < src.length; i++) out[i] = src[i];

        // --- Fixed-point focus point (OpenPDN) ---
        // fox = w * offsetX * 32768
        // fcx = fox + (w << 15) = w*32768*(1 + offsetX)
        // Centre réel en pixels : fcx / 65536 = w/2*(1+offsetX)
        const fox = Math.round(w * offsetX * 32768);
        const foy = Math.round(h * offsetY * 32768);
        const fcx = fox + (w << 15);
        const fcy = foy + (h << 15);

        // Centre en pixels (float) — corrigé : /65536 et non /32768
        const pixCx = fcx / 65536;   // = w/2 * (1 + offsetX)
        const pixCy = fcy / 65536;

        // Demi-diagonale depuis le point focal
        const maxR = Math.hypot(Math.max(pixCx, w - pixCx), Math.max(pixCy, h - pixCy)) || 1;
        const safeR = innerRadius * maxR;

        const N = 64; // PDN : constante 64 samples

        for (let y = sy; y < ey; y++) {
            for (let x = 0; x < w; x++) {
                const si0 = (y * w + x) * 4;

                // Distance euclidienne exacte au point focal
                const dist = Math.hypot(x - pixCx, y - pixCy);

                // ── Zone nette ──
                if (dist <= safeR) {
                    out[si0]     = src[si0];
                    out[si0 + 1] = src[si0 + 1];
                    out[si0 + 2] = src[si0 + 2];
                    out[si0 + 3] = src[si0 + 3];
                    continue;
                }

                // ── Progression linéaire ──
                // t = 0 à safeR → fz effectif = 0 (aucun zoom)
                // t = 1 à maxR  → fz effectif = amount (zoom complet)
                const t  = (maxR > safeR) ? (dist - safeR) / (maxR - safeR) : 1;
                const fz = amount * t;   // scale le facteur de convergence par t

                // Position relative au point focal (fixed-point × 2^16)
                let fx = (x << 16) - fcx;
                let fy = (y << 16) - fcy;

                const a0 = src[si0 + 3];
                let sumR = src[si0]     * a0;
                let sumG = src[si0 + 1] * a0;
                let sumB = src[si0 + 2] * a0;
                let sumA = a0;
                let cnt  = 1;

                for (let i = 0; i < N; i++) {
                    // Convergence exponentielle vers le focal (PDN)
                    // fx -= (fx>>4) * fz >> 10
                    fx -= ((fx >> 4) * fz) >> 10;
                    fy -= ((fy >> 4) * fz) >> 10;

                    const u = (fx + fcx + 32768) >> 16;
                    const v = (fy + fcy + 32768) >> 16;

                    if (u >= 0 && v >= 0 && u < w && v < h) {
                        const si = (v * w + u) * 4;
                        const a  = src[si + 3];
                        sumR += src[si] * a; sumG += src[si+1] * a;
                        sumB += src[si+2] * a; sumA += a; cnt++;
                    }
                }

                if (sumA > 0) {
                    out[si0]     = clamp255(sumR / sumA);
                    out[si0 + 1] = clamp255(sumG / sumA);
                    out[si0 + 2] = clamp255(sumB / sumA);
                    out[si0 + 3] = clamp255(sumA / cnt);
                } else {
                    out[si0] = out[si0+1] = out[si0+2] = out[si0+3] = 0;
                }
            }
        }
        return out;
    }

    /* ------------------------------------------------------------------
     * Export
     * ------------------------------------------------------------------ */
    const api = { illuRadialBlurRGBA, illuZoomBlurRGBA };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof global !== 'undefined') {
        global.illuRadialBlurRGBA = illuRadialBlurRGBA;
        global.illuZoomBlurRGBA   = illuZoomBlurRGBA;
    }

})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
