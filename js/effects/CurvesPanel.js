/**
 * Réglage des Courbes (tone curve) — canaux RVB + R/V/B, éditeur interactif,
 * histogramme, aperçu temps réel. Style Win98 / thème Illu, modelé sur LevelsPanel.
 *
 * Une courbe = liste de points de contrôle [entrée(0..255), sortie(0..255)], interpolés
 * par spline cubique monotone (Fritsch–Carlson) → LUT 256. La LUT « RVB » s'applique à
 * tous les canaux, puis les LUT R/V/B affinent chaque canal.
 */
(function () {
    const PREVIEW_MAX = 880;
    const EDITOR = 256; // résolution logique de l'éditeur (0..255 sur les deux axes)
    const HIT_PX = 10;  // rayon de sélection d'un point (pixels écran)

    function tKey(k, fb) {
        return window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t(k) : fb;
    }
    function clamp255(x) {
        return Math.max(0, Math.min(255, Math.round(x)));
    }
    function clamp01(x) {
        return Math.max(0, Math.min(1, x));
    }
    function identityPts() {
        return [[0, 0], [255, 255]];
    }

    // ---- Construction d'une LUT 256 à partir des points (spline cubique monotone) ----
    function buildLut(points) {
        const lut = new Uint8ClampedArray(256);
        const pts = (points && points.length ? points.slice() : identityPts()).sort((a, b) => a[0] - b[0]);
        const n = pts.length;
        if (n === 1) {
            const y = clamp255(pts[0][1]);
            for (let i = 0; i < 256; i++) lut[i] = y;
            return lut;
        }
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const dx = new Array(n - 1);
        const slope = new Array(n - 1);
        for (let i = 0; i < n - 1; i++) {
            dx[i] = xs[i + 1] - xs[i] || 1;
            slope[i] = (ys[i + 1] - ys[i]) / dx[i];
        }
        // Tangentes (Fritsch–Carlson : préserve la monotonie, évite les dépassements)
        const m = new Array(n);
        m[0] = slope[0];
        m[n - 1] = slope[n - 2];
        for (let i = 1; i < n - 1; i++) {
            if (slope[i - 1] * slope[i] <= 0) m[i] = 0;
            else m[i] = (slope[i - 1] + slope[i]) / 2;
        }
        for (let i = 0; i < n - 1; i++) {
            if (slope[i] === 0) {
                m[i] = 0;
                m[i + 1] = 0;
            } else {
                const a = m[i] / slope[i];
                const b = m[i + 1] / slope[i];
                const hprime = Math.hypot(a, b);
                if (hprime > 3) {
                    const t = 3 / hprime;
                    m[i] = t * a * slope[i];
                    m[i + 1] = t * b * slope[i];
                }
            }
        }
        for (let x = 0; x < 256; x++) {
            if (x <= xs[0]) {
                lut[x] = clamp255(ys[0]);
                continue;
            }
            if (x >= xs[n - 1]) {
                lut[x] = clamp255(ys[n - 1]);
                continue;
            }
            let seg = 0;
            while (seg < n - 2 && x > xs[seg + 1]) seg++;
            const h = dx[seg];
            const t = (x - xs[seg]) / h;
            const t2 = t * t;
            const t3 = t2 * t;
            const h00 = 2 * t3 - 3 * t2 + 1;
            const h10 = t3 - 2 * t2 + t;
            const h01 = -2 * t3 + 3 * t2;
            const h11 = t3 - t2;
            const y = h00 * ys[seg] + h10 * h * m[seg] + h01 * ys[seg + 1] + h11 * h * m[seg + 1];
            lut[x] = clamp255(y);
        }
        return lut;
    }

    /**
     * @param {ImageData} imageData
     * @param {{rgb?:Array,r?:Array,g?:Array,b?:Array}} p points par canal
     */
    window.illuApplyCurves = function (imageData, p) {
        p = p || {};
        const lutRGB = buildLut(p.rgb);
        const lutR = buildLut(p.r);
        const lutG = buildLut(p.g);
        const lutB = buildLut(p.b);
        const fR = new Uint8ClampedArray(256);
        const fG = new Uint8ClampedArray(256);
        const fB = new Uint8ClampedArray(256);
        for (let i = 0; i < 256; i++) {
            fR[i] = lutR[lutRGB[i]];
            fG[i] = lutG[lutRGB[i]];
            fB[i] = lutB[lutRGB[i]];
        }
        const d = imageData.data;
        const out = new Uint8ClampedArray(d.length);
        for (let i = 0; i < d.length; i += 4) {
            out[i] = fR[d[i]];
            out[i + 1] = fG[d[i + 1]];
            out[i + 2] = fB[d[i + 2]];
            out[i + 3] = d[i + 3];
        }
        return new ImageData(out, imageData.width, imageData.height);
    };

    function buildHistogram(imageData, channel) {
        const h = new Uint32Array(256);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 8) continue;
            let v;
            if (channel === 'r') v = d[i];
            else if (channel === 'g') v = d[i + 1];
            else if (channel === 'b') v = d[i + 2];
            else v = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
            h[v]++;
        }
        return h;
    }

    function downscaleForPreview(id) {
        const w = id.width;
        const h = id.height;
        const maxSide = Math.max(w, h);
        if (maxSide <= PREVIEW_MAX) return { id: id, scale: 1 };
        const s = PREVIEW_MAX / maxSide;
        const nw = Math.max(1, Math.round(w * s));
        const nh = Math.max(1, Math.round(h * s));
        const c = document.createElement('canvas');
        c.width = nw;
        c.height = nh;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        const c0 = document.createElement('canvas');
        c0.width = w;
        c0.height = h;
        c0.getContext('2d').putImageData(id, 0, 0);
        x.drawImage(c0, 0, 0, nw, nh);
        return { id: x.getImageData(0, 0, nw, nh), scale: s };
    }

    // ---- État du panneau ----
    let panelRoot = null;
    let baseFull = null;
    let previewBase = null;
    let onCommitCb = null;
    let onCancelCb = null;
    let channels = null;      // { rgb:[...], r:[...], g:[...], b:[...] }
    let activeChannel = 'rgb';
    let drag = null;          // { index }
    let previewRaf = 0;

    const CH_COLORS = { rgb: '#e0e0e0', r: '#e05a5a', g: '#4fbf6a', b: '#5a8fe0' };

    function resetChannels() {
        channels = { rgb: identityPts(), r: identityPts(), g: identityPts(), b: identityPts() };
    }

    function ptsToScreen(canvas, pt) {
        const sx = (pt[0] / 255) * canvas.width;
        const sy = canvas.height - (pt[1] / 255) * canvas.height;
        return [sx, sy];
    }

    function pointerToImg(canvas, ev) {
        const r = canvas.getBoundingClientRect();
        const ix = clamp255(((ev.clientX - r.left) / Math.max(1, r.width)) * 255);
        const iy = clamp255(255 - ((ev.clientY - r.top) / Math.max(1, r.height)) * 255);
        return [ix, iy];
    }

    function drawEditor() {
        if (!panelRoot) return;
        const canvas = panelRoot.querySelector('#illu-cv-editor');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const dark = document.body.classList.contains('theme-dark');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = dark ? '#2b2e35' : '#f4f4f4';
        ctx.fillRect(0, 0, w, h);

        // Histogramme du canal actif (léger, en fond)
        if (previewBase) {
            const hist = buildHistogram(previewBase, activeChannel);
            let mx = 1;
            for (let i = 0; i < 256; i++) if (hist[i] > mx) mx = hist[i];
            ctx.fillStyle = dark ? 'rgba(180,185,195,0.35)' : 'rgba(120,120,120,0.35)';
            const bw = w / 256;
            for (let i = 0; i < 256; i++) {
                const bh = (hist[i] / mx) * (h - 2);
                ctx.fillRect(i * bw, h - bh, Math.max(1, bw), bh);
            }
        }

        // Grille (quarts) + diagonale de référence
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        for (let k = 1; k < 4; k++) {
            const gx = (k / 4) * w;
            const gy = (k / 4) * h;
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, h);
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
        }
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w, 0);
        ctx.stroke();
        ctx.strokeStyle = dark ? '#5b6470' : '#888';
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

        // Courbe (via la LUT du canal actif)
        const lut = buildLut(channels[activeChannel]);
        ctx.strokeStyle = CH_COLORS[activeChannel] || '#000';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let x = 0; x < 256; x++) {
            const sx = (x / 255) * w;
            const sy = h - (lut[x] / 255) * h;
            if (x === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Points de contrôle
        const pts = channels[activeChannel];
        for (let i = 0; i < pts.length; i++) {
            const [sx, sy] = ptsToScreen(canvas, pts[i]);
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fillStyle = drag && drag.index === i ? '#ffcc00' : '#fff';
            ctx.fill();
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = CH_COLORS[activeChannel] || '#000';
            ctx.stroke();
        }
    }

    function schedulePreview() {
        if (previewRaf) return;
        previewRaf = requestAnimationFrame(() => {
            previewRaf = 0;
            if (!panelRoot || !previewBase) return;
            const pv = panelRoot.querySelector('#illu-cv-preview');
            if (!pv) return;
            const tmp = new ImageData(new Uint8ClampedArray(previewBase.data), previewBase.width, previewBase.height);
            const after = window.illuApplyCurves(tmp, channels);
            if (pv.width !== after.width || pv.height !== after.height) {
                pv.width = after.width;
                pv.height = after.height;
            }
            pv.getContext('2d').putImageData(after, 0, 0);
        });
    }

    function nearestPointIndex(canvas, ev) {
        const pts = channels[activeChannel];
        const r = canvas.getBoundingClientRect();
        const scaleX = r.width / canvas.width;
        const scaleY = r.height / canvas.height;
        let best = -1;
        let bestD = HIT_PX * HIT_PX;
        for (let i = 0; i < pts.length; i++) {
            const [sx, sy] = ptsToScreen(canvas, pts[i]);
            const dxp = (r.left + sx * scaleX) - ev.clientX;
            const dyp = (r.top + sy * scaleY) - ev.clientY;
            const d = dxp * dxp + dyp * dyp;
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        }
        return best;
    }

    function onEditorPointerDown(ev) {
        const canvas = ev.currentTarget;
        ev.preventDefault();
        const pts = channels[activeChannel];
        let idx = nearestPointIndex(canvas, ev);
        if (idx < 0) {
            // Ajoute un point à l'abscisse cliquée
            const [ix, iy] = pointerToImg(canvas, ev);
            pts.push([ix, iy]);
            pts.sort((a, b) => a[0] - b[0]);
            idx = pts.findIndex((p) => p[0] === ix && p[1] === iy);
        }
        drag = { index: idx };
        try {
            canvas.setPointerCapture(ev.pointerId);
        } catch (e) { /* ignore */ }
        drawEditor();
    }

    function onEditorPointerMove(ev) {
        if (!drag) return;
        const canvas = ev.currentTarget;
        const pts = channels[activeChannel];
        const i = drag.index;
        if (i < 0 || i >= pts.length) return;
        let [ix, iy] = pointerToImg(canvas, ev);
        const isFirst = i === 0;
        const isLast = i === pts.length - 1;
        if (isFirst) ix = 0;
        else if (isLast) ix = 255;
        else {
            const lo = pts[i - 1][0] + 1;
            const hi = pts[i + 1][0] - 1;
            ix = Math.max(lo, Math.min(hi, ix));
        }
        pts[i] = [ix, iy];
        drawEditor();
        schedulePreview();
    }

    function onEditorPointerUp(ev) {
        if (!drag) return;
        const canvas = ev.currentTarget;
        const pts = channels[activeChannel];
        const i = drag.index;
        // Retire un point intérieur relâché hors des bornes verticales (geste « jeter »)
        if (i > 0 && i < pts.length - 1) {
            const r = canvas.getBoundingClientRect();
            if (ev.clientY < r.top - 16 || ev.clientY > r.bottom + 16) {
                pts.splice(i, 1);
            }
        }
        drag = null;
        drawEditor();
        schedulePreview();
    }

    function onEditorDblClick(ev) {
        const canvas = ev.currentTarget;
        const pts = channels[activeChannel];
        const idx = nearestPointIndex(canvas, ev);
        if (idx > 0 && idx < pts.length - 1) {
            pts.splice(idx, 1);
            drag = null;
            drawEditor();
            schedulePreview();
        }
    }

    function setActiveChannel(ch) {
        activeChannel = ch;
        if (panelRoot) {
            panelRoot.querySelectorAll('.illu-cv-chan-btn').forEach((b) => {
                b.classList.toggle('illu-cv-chan-btn--on', b.getAttribute('data-ch') === ch);
            });
        }
        drawEditor();
    }

    function resetCurves() {
        resetChannels();
        setActiveChannel('rgb');
        drawEditor();
        schedulePreview();
    }

    function ensureStyles() {
        if (document.getElementById('illu-curves-styles')) return;
        const st = document.createElement('style');
        st.id = 'illu-curves-styles';
        st.textContent = `
            .illu-curves-overlay{position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;}
            .illu-cv-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.35);}
            .illu-cv-window{position:relative;min-width:320px;max-width:94vw;}
            .illu-cv-body{display:flex;flex-direction:column;gap:10px;padding:10px 12px;}
            .illu-cv-top{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;}
            .illu-cv-editor{width:256px;height:256px;border:1px solid #888;background:#f4f4f4;cursor:crosshair;touch-action:none;border-radius:2px;}
            .illu-cv-preview-wrap{flex:1;min-width:160px;max-width:340px;display:flex;align-items:center;justify-content:center;background:#00000010;border:1px solid #8886;border-radius:2px;padding:4px;}
            .illu-cv-preview{max-width:100%;max-height:256px;image-rendering:auto;}
            .illu-cv-chans{display:flex;gap:6px;align-items:center;}
            .illu-cv-chan-btn{min-width:38px;padding:3px 8px;cursor:pointer;font-weight:600;}
            .illu-cv-chan-btn--on{outline:2px solid #007acc;outline-offset:-2px;}
            .illu-cv-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;}
            .illu-cv-hint{font-size:11px;opacity:0.7;flex-basis:100%;}
        `;
        document.head.appendChild(st);
    }

    function buildPanel() {
        const root = document.createElement('div');
        root.id = 'illu-curves-root';
        root.className = 'illu-curves-overlay';
        const rgbTxt = tKey('dlg.curvesRgb', 'RVB');
        const rTxt = tKey('dlg.levelsChR', 'R');
        const gTxt = tKey('dlg.levelsChV', 'V');
        const bTxt = tKey('dlg.levelsChB', 'B');
        root.innerHTML = `
            <div class="illu-cv-backdrop" aria-hidden="true"></div>
            <div class="window floating-window illu-cv-window" role="dialog" aria-modal="true" aria-labelledby="illu-cv-title">
                <div class="title-bar">
                    <div class="title-bar-text" id="illu-cv-title">${tKey('dlg.curvesTitle', 'Courbes')}</div>
                    <div class="title-bar-controls">
                        <button type="button" class="title-bar-close-btn" id="illu-cv-x" aria-label="${tKey('dlg.cameraRawClose', 'Fermer')}" data-i18n-aria-label="dlg.cameraRawClose"></button>
                    </div>
                </div>
                <div class="window-body illu-cv-body">
                    <div class="illu-cv-chans" role="group">
                        <button type="button" class="illu-cv-chan-btn illu-cv-chan-btn--on" data-ch="rgb">${rgbTxt}</button>
                        <button type="button" class="illu-cv-chan-btn" data-ch="r">${rTxt}</button>
                        <button type="button" class="illu-cv-chan-btn" data-ch="g">${gTxt}</button>
                        <button type="button" class="illu-cv-chan-btn" data-ch="b">${bTxt}</button>
                    </div>
                    <div class="illu-cv-top">
                        <canvas id="illu-cv-editor" class="illu-cv-editor" width="256" height="256"></canvas>
                        <div class="illu-cv-preview-wrap">
                            <canvas id="illu-cv-preview" class="illu-cv-preview" width="1" height="1"></canvas>
                        </div>
                    </div>
                    <div class="illu-cv-foot">
                        <button type="button" id="illu-cv-reset" data-i18n="dlg.levelsReset">Réinitialiser</button>
                        <span class="illu-cv-hint" data-i18n="dlg.curvesHint">Cliquez pour ajouter un point, glissez pour l’ajuster, double-clic pour retirer.</span>
                        <span style="flex:1"></span>
                        <button type="button" id="illu-cv-ok" class="illu-cv-btn-ok" data-i18n="dlg.cameraRawOk">OK</button>
                        <button type="button" id="illu-cv-cancel" data-i18n="dlg.cancel">Annuler</button>
                    </div>
                </div>
            </div>
        `;
        return root;
    }

    function wirePanel() {
        const root = panelRoot;
        const canvas = root.querySelector('#illu-cv-editor');
        canvas.addEventListener('pointerdown', onEditorPointerDown);
        canvas.addEventListener('pointermove', onEditorPointerMove);
        canvas.addEventListener('pointerup', onEditorPointerUp);
        canvas.addEventListener('pointercancel', onEditorPointerUp);
        canvas.addEventListener('dblclick', onEditorDblClick);
        root.querySelectorAll('.illu-cv-chan-btn').forEach((b) => {
            b.addEventListener('click', () => setActiveChannel(b.getAttribute('data-ch')));
        });
        root.querySelector('#illu-cv-reset')?.addEventListener('click', resetCurves);
        root.querySelector('#illu-cv-ok')?.addEventListener('click', commitPanel);
        root.querySelector('#illu-cv-cancel')?.addEventListener('click', () => closePanel(true));
        root.querySelector('#illu-cv-x')?.addEventListener('click', () => closePanel(true));
        root.querySelector('.illu-cv-backdrop')?.addEventListener('click', () => closePanel(true));
    }

    function closePanel(runCancel) {
        if (previewRaf) {
            cancelAnimationFrame(previewRaf);
            previewRaf = 0;
        }
        if (panelRoot) {
            panelRoot.remove();
            panelRoot = null;
        }
        baseFull = null;
        previewBase = null;
        drag = null;
        document.body.classList.remove('illu-curves-open');
        if (runCancel && typeof onCancelCb === 'function') onCancelCb();
        onCancelCb = null;
        onCommitCb = null;
    }

    function commitPanel() {
        if (!baseFull || typeof onCommitCb !== 'function' || !panelRoot) {
            closePanel(false);
            return;
        }
        const busy =
            window.IlluProgress && typeof window.IlluProgress.createDelayedInstantEffect === 'function'
                ? window.IlluProgress.createDelayedInstantEffect(tKey('dlg.curvesTitle', 'Courbes'), 180)
                : null;
        let out;
        try {
            if (busy) busy.progress(30);
            out = window.illuApplyCurves(baseFull, channels);
            if (busy) busy.progress(100);
        } finally {
            if (busy) busy.done();
        }
        const fn = onCommitCb;
        onCommitCb = null;
        onCancelCb = null;
        fn(out);
        closePanel(false);
    }

    window.openCurvesPanel = function (fullImageData, opts) {
        if (!fullImageData || !fullImageData.data) return;
        closePanel(false);
        ensureStyles();
        onCommitCb = opts && opts.onCommit;
        onCancelCb = opts && opts.onCancel;
        baseFull = fullImageData;
        previewBase = downscaleForPreview(fullImageData).id;
        resetChannels();
        activeChannel = 'rgb';

        panelRoot = buildPanel();
        document.body.appendChild(panelRoot);
        document.body.classList.add('illu-curves-open');
        const winEl = panelRoot.querySelector('.illu-cv-window');
        if (winEl && typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(winEl);
        }
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(panelRoot);
        }
        if (window.IlluTheme && typeof window.IlluTheme.refreshIfActive === 'function') {
            window.IlluTheme.refreshIfActive();
        }
        wirePanel();
        drawEditor();
        schedulePreview();
    };

    window.openCurvesForActiveLayer = function () {
        const em = window.EditorManager;
        if (!em || !em.isPixelMode || !em.activeLayer || !em.activeLayer.buffer) {
            if (typeof window.showIlluAlert === 'function') {
                window.showIlluAlert(tKey('msg.levelsPixel', 'Disponible en mode Pixel avec un calque bitmap.'));
            }
            return;
        }
        if (em.activeProject && em.activeProject.role === 'layerAlphaMask') {
            if (typeof window.showIlluAlert === 'function') {
                window.showIlluAlert(tKey('msg.levelsMask', 'Ouvrez le document principal.'));
            }
            return;
        }
        const c = em.activeLayer.buffer;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const id = ctx.getImageData(0, 0, c.width, c.height);
        window.openCurvesPanel(id, {
            onCommit: (out) => {
                ctx.putImageData(out, 0, 0);
                em.saveHistory(tKey('history.curves', 'Réglage des courbes'), { patchActiveLayer: true });
                em.render({ flushUiThumbnails: true });
            }
        });
    };
})();
