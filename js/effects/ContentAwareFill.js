// Remplissage « contenu pris en compte » : orchestration UI + worker.
// Les algorithmes sont déportés dans content-aware-fill-worker.js pour ne pas geler l'UI.

(function () {
    const CAF_WORKER_URL = 'js/effects/content-aware-fill-worker.js';
    let cafWorker = null;
    let cafWorkerBroken = false;
    let cafWorkerJobSeq = 0;
    const cafWorkerPending = new Map();

    function prog(pct, key, fb) {
        if (window.__illuCafAbort) return;
        const msg =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t(key)
                : fb;
        if (window.IlluProgress && typeof window.IlluProgress.status === 'function') {
            window.IlluProgress.status(pct); // Pas de message
        }
        if (document.body.classList.contains('illu-caf-progress-open')) {
            const root = document.getElementById('illu-caf-progress-overlay');
            if (root) {
                const fill = root.querySelector('#illu-caf-progress-fill');
                if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
            }
        }
    }

    function progDone() {
        if (window.IlluProgress && typeof window.IlluProgress.statusDone === 'function') {
            window.IlluProgress.statusDone();
        }
    }

    function illuCafYieldToPaint() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 90);
                });
            });
        });
    }

    function tCaf(key, fb) {
        return window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t(key) : fb;
    }

    function ensureCafOverlayDom() {
        let root = document.getElementById('illu-caf-progress-overlay');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'illu-caf-progress-overlay';
        root.className = 'illu-caf-progress-overlay';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div class="illu-caf-progress-backdrop" aria-hidden="true"></div>' +
            '<div class="window illu-caf-progress-window" id="illu-caf-progress-win">' +
            '<div class="title-bar"><div class="title-bar-text" id="illu-caf-progress-title"></div></div>' +
            '<div class="window-body illu-caf-progress-body">' +
            '<div class="illu-mp-progress-indicator illu-mp-progress-indicator--segmented illu-status-progress-track illu-caf-progress-track"><span class="illu-mp-progress-indicator__bar illu-status-progress-fill" id="illu-caf-progress-fill"></span></div>' +
            '<p class="illu-caf-progress-hint" id="illu-caf-progress-hint"></p>' +
            '<div style="text-align:right;margin-top:14px;">' +
            '<button type="button" id="illu-caf-progress-abort" data-i18n="dlg.cancelOperation"></button>' +
            '</div></div></div>';
        document.body.appendChild(root);
        root.querySelector('.illu-caf-progress-backdrop').addEventListener('click', (e) => e.stopPropagation());
        root.querySelector('#illu-caf-progress-abort').addEventListener('click', () => {
            window.__illuCafAbort = true;
        });
        return root;
    }

    function showCafProgressOverlay() {
        const root = ensureCafOverlayDom();
        window.__illuCafAbort = false;
        const title = root.querySelector('#illu-caf-progress-title');
        const hint = root.querySelector('#illu-caf-progress-hint');
        if (title) title.textContent = tCaf('dlg.cafProgressTitle', 'Remplissage contenu pris en compte');
        if (hint) {
            hint.textContent = tCaf(
                'dlg.cafProgressHint',
                'Analyse et remplissage en cours… Vous pouvez annuler ; le résultat ne sera pas appliqué.'
            );
        }
        root.style.display = 'flex';
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('illu-caf-progress-open');
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(root);
        }
        const fill = root.querySelector('#illu-caf-progress-fill');
        if (fill) fill.style.width = '0%';
        const w = root.querySelector('#illu-caf-progress-win');
        if (w && typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(w);
        }
    }

    function hideCafProgressOverlay() {
        const root = document.getElementById('illu-caf-progress-overlay');
        if (!root) return;
        root.style.display = 'none';
        root.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('illu-caf-progress-open');
        window.selectionExpansionPreviewPx = 0;
    }

    function terminateCafWorker(markBroken) {
        if (cafWorker) {
            try {
                cafWorker.terminate();
            } catch (e) {
                /* ignore */
            }
        }
        cafWorker = null;
        cafWorkerPending.forEach((pending) => {
            pending.reject(new Error('content-aware-fill worker unavailable'));
        });
        cafWorkerPending.clear();
        if (markBroken) cafWorkerBroken = true;
    }

    function ensureCafWorker() {
        if (cafWorkerBroken || typeof Worker === 'undefined') return null;
        if (cafWorker) return cafWorker;
        try {
            console.log(`ContentAwareFill: Initializing worker (${CAF_WORKER_URL})`);
            const wk = new Worker(CAF_WORKER_URL);
            wk.onmessage = (ev) => {
                const msg = ev && ev.data ? ev.data : {};
                if (msg.type === 'progress') {
                    prog(msg.pct, 'progress.cafRun', msg.message || 'Traitement…');
                    return;
                }
                const pending = cafWorkerPending.get(msg.jobId | 0);
                if (!pending) return;
                cafWorkerPending.delete(msg.jobId | 0);
                if (msg.type === 'result') {
                    pending.resolve(msg);
                } else {
                    console.error('ContentAwareFill: Worker error message', msg.message);
                    pending.reject(new Error(msg.message || 'content-aware-fill worker failed'));
                }
            };
            wk.onerror = (err) => {
                console.error('ContentAwareFill: Worker error', err);
                terminateCafWorker(true);
            };
            cafWorker = wk;
            return wk;
        } catch (e) {
            cafWorkerBroken = true;
            console.error('ensureCafWorker failed:', e);
            return null;
        }
    }

    function requestCafWorker(payload, transferList) {
        const wk = ensureCafWorker();
        if (!wk) return Promise.reject(new Error('worker unavailable'));
        const jobId = ++cafWorkerJobSeq;
        return new Promise((resolve, reject) => {
            cafWorkerPending.set(jobId, { resolve, reject });
            try {
                wk.postMessage({ ...payload, jobId }, transferList || []);
            } catch (e) {
                cafWorkerPending.delete(jobId);
                reject(e);
            }
        });
    }

    function requestCafWorkerWithAbort(payload, transferList) {
        const base = requestCafWorker(payload, transferList);
        return new Promise((resolve, reject) => {
            let done = false;
            const timeout = setTimeout(() => {
                if (done) return;
                done = true;
                clearInterval(iv);
                terminateCafWorker(false);
                reject(new Error('Remplissage trop long (Timeout)'));
            }, 600000);

            const iv = setInterval(() => {
                if (done) return;
                if (!window.__illuCafAbort) return;
                done = true;
                clearInterval(iv);
                clearTimeout(timeout);
                terminateCafWorker(false);
                reject(new Error('Opération annulée par l\'utilisateur'));
            }, 80);

            base.then((msg) => {
                if (done) return;
                done = true;
                clearInterval(iv);
                clearTimeout(timeout);
                resolve(msg);
            }).catch((err) => {
                if (done) return;
                done = true;
                clearInterval(iv);
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    window.applyContentAwareFillAsync = async function (options) {
        const opts = options || {};
        const expandPx = Math.max(0, Math.min(128, parseInt(String(opts.expandPx), 10) || 0));
        const preserveTransparency = !!opts.preserveTransparency;

        const em = window.EditorManager;
        const l = em && em.activeLayer;
        if (!l || !l.buffer || !em.isPixelMode) return false;

        const ov = document.getElementById('selection-overlay');
        if (!ov || ov.style.display === 'none') return false;
        if (window.selectionInverted) return false;

        const lw = l.buffer.width;
        const lh = l.buffer.height;
        const raster = typeof window.rasterizeCurrentSelectionToLayerMask === 'function'
            ? window.rasterizeCurrentSelectionToLayerMask()
            : null;
        if (!raster || raster.length !== lw * lh) return false;

        let anySel = false;
        for (let i = 0; i < raster.length; i++) {
            if (raster[i]) { anySel = true; break; }
        }
        if (!anySel) return false;

        const ctx = l.buffer.getContext('2d', { willReadFrequently: true });
        if (!ctx) return false;

        showCafProgressOverlay();
        await illuCafYieldToPaint();

        try {
            prog(4, 'progress.cafPrep', 'Analyse de la zone…');
            let minX = lw, minY = lh, maxX = -1, maxY = -1;
            for (let y = 0; y < lh; y++) {
                const row = y * lw;
                for (let x = 0; x < lw; x++) {
                    if (!raster[row + x]) continue;
                    if (x < minX) minX = x; if (y < minY) minY = y;
                    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
                }
            }
            if (maxX < minX || maxY < minY) return false;

            // AMÉLIORATION CLÉ DE L'INTELLIGENCE DU CAF :
            // On agrandit considérablement la zone extraite (le "contexte") envoyée au Worker.
            // L'IA a besoin de voir les textures très loin du trou pour les cloner correctement,
            // 24px de marge n'était pas suffisant pour recréer une belle texture.
            const contextNeeded = Math.min(lw, lh) * 0.45; // On lui donne jusqu'à 45% de l'image comme contexte
            const roiPad = Math.max(120, Math.floor(contextNeeded));
            
            const roiX = Math.max(0, minX - roiPad), roiY = Math.max(0, minY - roiPad);
            const roiX2 = Math.min(lw, maxX + 1 + roiPad), roiY2 = Math.min(lh, maxY + 1 + roiPad);
            const roiW = Math.max(1, roiX2 - roiX), roiH = Math.max(1, roiY2 - roiY);

            prog(8, 'progress.cafPrep', 'Extraction des pixels et du contexte…');
            const id = ctx.getImageData(roiX, roiY, roiW, roiH);
            const source = new Uint8ClampedArray(id.data.buffer);
            const selectionMask = new Uint8Array(roiW * roiH);
            for (let y = 0; y < roiH; y++) {
                const maskSrc = (roiY + y) * lw + roiX;
                const maskDst = y * roiW;
                selectionMask.set(raster.subarray(maskSrc, maskSrc + roiW), maskDst);
            }

            prog(15, 'progress.cafRun', 'Lancement de l\'intelligence artificielle…');

            const msg = await requestCafWorkerWithAbort({
                type: 'runCaf',
                width: roiW,
                height: roiH,
                expandPx: expandPx,
                opacity: opts.opacity ?? 100,
                mode: opts.mode || 'texture',
                innerRadius: Math.max(0, Math.min(200, parseInt(String(opts.innerRadius || 0), 10) || 0)),
                preserveTransparency: preserveTransparency,
                sourceBuffer: source.buffer,
                maskBuffer: selectionMask.buffer
            }, [source.buffer, selectionMask.buffer]);

            if (!msg || !msg.resultBuffer) throw new Error('Échec du remplissage');

            const newImageData = new ImageData(
                new Uint8ClampedArray(msg.resultBuffer),
                roiW,
                roiH
            );

            ctx.putImageData(newImageData, roiX, roiY);
            return true;
        } catch (e) {
            console.error('CAF error:', e);
            if (!String(e.message).includes('ABORT')) {
                alert('Erreur lors du remplissage : ' + (e.message || 'erreur inconnue'));
            }
        } finally {
            progDone();
            hideCafProgressOverlay();
        }
        return false;
    };

    window.applyContentAwareFill = function () {
        console.warn('applyContentAwareFill est obsolète — utiliser applyContentAwareFillAsync');
        return false;
    };
})();