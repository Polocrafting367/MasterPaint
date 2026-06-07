/**
 * Suppression de fond : @imgly/background-removal (ONNX + WASM, navigateur).
 * URL du module : window.ILLU_REMOVE_BG_MODULE_URL ou CDN (voir vendor/README-tiers.txt pour copie locale).
 */
(function () {
    const MODULE_URL =
        window.ILLU_REMOVE_BG_MODULE_URL ||
        'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm';

    let cachedRemoveBackground = null;

    function tKey(k, fb) {
        return window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t(k) : fb;
    }

    function progStatus(pct, key, fb) {
        if (!window.IlluProgress || typeof window.IlluProgress.status !== 'function') return;
        const msg = tKey(key, fb);
        window.IlluProgress.status(Math.max(0, Math.min(100, pct)), msg);
    }

    function progStatusDone() {
        if (window.IlluProgress && typeof window.IlluProgress.statusDone === 'function') {
            window.IlluProgress.statusDone();
        }
    }

    function ensureOverlayDom() {
        let root = document.getElementById('illu-remove-bg-overlay');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'illu-remove-bg-overlay';
        root.className = 'illu-rmbg-overlay';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.innerHTML =
            '<div class="illu-rmbg-backdrop" aria-hidden="true"></div>' +
            '<div class="window floating-window illu-rmbg-window" id="illu-rmbg-window">' +
            '<div class="title-bar">' +
            '<div class="title-bar-text" id="illu-rmbg-title"></div>' +
            '<div class="title-bar-controls">' +
            '<button type="button" class="title-bar-close-btn" id="illu-rmbg-x" aria-label="Close" data-i18n-aria-label="dlg.cameraRawClose"></button>' +
            '</div></div>' +
            '<div class="window-body illu-rmbg-body">' +
            '<div id="illu-rmbg-panel-settings">' +
            '<p class="illu-rmbg-lead" id="illu-rmbg-lead"></p>' +
            '<div class="field-row" style="align-items:center;flex-wrap:wrap;gap:8px;">' +
            '<label style="min-width:100px;" id="illu-rmbg-lab-model" for="illu-rmbg-model"></label>' +
            '<select id="illu-rmbg-model" style="flex:1;min-width:120px;">' +
            '<option value="small">small</option>' +
            '<option value="medium">medium</option>' +
            '<option value="large">large</option>' +
            '</select></div>' +
            '<div class="field-row" style="align-items:center;margin-top:8px;flex-wrap:wrap;gap:8px;">' +
            '<label style="min-width:100px;" id="illu-rmbg-lab-feather" for="illu-rmbg-feather"></label>' +
            '<input type="range" id="illu-rmbg-feather" min="0" max="12" value="0" style="flex:1;min-width:80px;">' +
            '<input type="number" id="illu-rmbg-feather-n" min="0" max="12" value="0" style="width:44px;">' +
            '<span style="font-size:11px;">px</span></div>' +
            '<p class="illu-rmbg-hint" id="illu-rmbg-hint-settings"></p>' +
            '<div style="text-align:right;margin-top:12px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">' +
            '<button type="button" id="illu-rmbg-cancel" data-i18n="dlg.cancel"></button>' +
            '<button type="button" id="illu-rmbg-start" data-i18n="dlg.removeBgStart"></button>' +
            '</div></div>' +
            '<div id="illu-rmbg-panel-progress" style="display:none;">' +
            '<div id="illu-rmbg-bar-wrap" class="illu-mp-progress-indicator illu-mp-progress-indicator--segmented illu-status-progress-track illu-rmbg-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-i18n-aria-label="status.progressAria">' +
            '<span class="illu-mp-progress-indicator__bar illu-status-progress-fill" id="illu-rmbg-bar-fill"></span></div>' +
            '<div style="text-align:right;margin-top:14px;">' +
            '<button type="button" id="illu-rmbg-abort-job" data-i18n="dlg.cancelOperation"></button>' +
            '</div>' +
            '</div></div></div>';
        document.body.appendChild(root);
        const close = () => {
            if (root.dataset.rmbgBusy === '1') return;
            root.style.display = 'none';
            document.body.classList.remove('illu-rmbg-open');
        };
        root.querySelector('.illu-rmbg-backdrop').addEventListener('click', close);
        root.querySelector('#illu-rmbg-x').addEventListener('click', close);
        root.querySelector('#illu-rmbg-cancel').addEventListener('click', close);
        root.querySelector('#illu-rmbg-abort-job').addEventListener('click', () => {
            window.__illuRmbgAbort = true;
        });
        const fR = root.querySelector('#illu-rmbg-feather');
        const fN = root.querySelector('#illu-rmbg-feather-n');
        function syncF() {
            if (!fR || !fN) return;
            fN.value = fR.value;
        }
        fR.addEventListener('input', syncF);
        fN.addEventListener('input', () => {
            let v = parseInt(fN.value, 10);
            if (!Number.isFinite(v)) v = 0;
            v = Math.max(0, Math.min(12, v));
            fN.value = String(v);
            fR.value = String(v);
        });
        return root;
    }

    function showSettingsPanel() {
        const root = ensureOverlayDom();
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(root);
        }
        const title = root.querySelector('#illu-rmbg-title');
        if (title) title.textContent = tKey('dlg.removeBgTitle', 'Suppression du fond');
        const lead = root.querySelector('#illu-rmbg-lead');
        if (lead) {
            lead.textContent = tKey('dlg.removeBgLead', 'Réglages puis lancement du traitement (premier usage : téléchargement du modèle).');
        }
        const lm = root.querySelector('#illu-rmbg-lab-model');
        if (lm) lm.textContent = tKey('dlg.removeBgModel', 'Modèle');
        const lf = root.querySelector('#illu-rmbg-lab-feather');
        if (lf) lf.textContent = tKey('dlg.removeBgFeather', 'Plume du détourage');
        const hs = root.querySelector('#illu-rmbg-hint-settings');
        if (hs) {
            hs.textContent = tKey(
                'dlg.removeBgHintSettings',
                'Plume : adoucit le bord du canal alpha après détourage. Modèle « small » : plus léger, un peu moins précis.'
            );
        }
        root.dataset.rmbgBusy = '0';
        root.querySelector('#illu-rmbg-panel-settings').style.display = '';
        root.querySelector('#illu-rmbg-panel-progress').style.display = 'none';
        const bar = root.querySelector('#illu-rmbg-bar-fill');
        const wrap = root.querySelector('#illu-rmbg-bar-wrap');
        if (bar) bar.style.width = '0%';
        if (wrap) {
            wrap.setAttribute('aria-valuenow', '0');
        }
        const fR = root.querySelector('#illu-rmbg-feather');
        const fN = root.querySelector('#illu-rmbg-feather-n');
        if (fR && fN) fN.value = fR.value;
        root.style.display = 'flex';
        document.body.classList.add('illu-rmbg-open');
        const win = root.querySelector('#illu-rmbg-window') || root.querySelector('.illu-rmbg-window');
        if (win) win.classList.remove('illu-rmbg-window--progress');
        if (win && typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(win);
        }
        return root;
    }

    function setRmbgBusyUi(busy) {
        const root = document.getElementById('illu-remove-bg-overlay');
        if (!root) return;
        root.dataset.rmbgBusy = busy ? '1' : '0';
        const x = root.querySelector('#illu-rmbg-x');
        if (x) {
            x.style.visibility = busy ? 'hidden' : '';
            x.disabled = !!busy;
        }
    }

    function showProgressPanel() {
        const root = document.getElementById('illu-remove-bg-overlay');
        if (!root) return;
        const win = root.querySelector('#illu-rmbg-window') || root.querySelector('.illu-rmbg-window');
        if (win) win.classList.add('illu-rmbg-window--progress');
        root.querySelector('#illu-rmbg-panel-settings').style.display = 'none';
        root.querySelector('#illu-rmbg-panel-progress').style.display = '';
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(root);
        }
    }

    /** Quand la lib n’envoie pas total (souvent), on estime une progression lisible par phase. */
    function keyPhaseApprox(key) {
        const k = String(key || '').toLowerCase();
        if (k.indexOf('fetch') !== -1 || k.indexOf('download') !== -1) return 22;
        if (k.indexOf('decode') !== -1 || k.indexOf('wasm') !== -1) return 32;
        if (k.indexOf('inference') !== -1) return 55;
        if (k.indexOf('mask') !== -1) return 76;
        if (k.indexOf('encode') !== -1) return 90;
        return 45;
    }

    function setProgress(key, cur, total) {
        const bar = document.getElementById('illu-rmbg-bar-fill');
        const wrap = document.getElementById('illu-rmbg-bar-wrap');
        const k = key || '';
        const hasTotal = total > 0;
        const rawPct = hasTotal ? Math.round((100 * cur) / total) : keyPhaseApprox(k);
        const pctDisplay = Math.min(100, Math.max(0, rawPct));
        if (bar) bar.style.width = pctDisplay + '%';
        if (wrap) wrap.setAttribute('aria-valuenow', String(pctDisplay));
        let text = '';
        if (k.indexOf('fetch') !== -1 || k.indexOf('download') !== -1) {
            text =
                tKey('dlg.removeBgDownload', 'Téléchargement des ressources…') +
                (hasTotal ? ' ' + pctDisplay + '%' : '');
        } else if (k.indexOf('inference') !== -1) {
            text = tKey('dlg.removeBgInfer', 'Analyse de l’image…');
        } else if (k.indexOf('mask') !== -1) {
            text = tKey('dlg.removeBgMask', 'Application du masque…');
        } else if (k.indexOf('encode') !== -1) {
            text = tKey('dlg.removeBgEncode', 'Encodage…');
        } else {
            text =
                tKey('dlg.removeBgWorking', 'Traitement…') + (hasTotal ? ' ' + pctDisplay + '%' : '');
        }
        const mapped = 15 + Math.round((80 * pctDisplay) / 100);
        if (window.IlluProgress && typeof window.IlluProgress.status === 'function') {
            window.IlluProgress.status(Math.min(100, mapped), text);
        }
    }

    function featherAlphaChannel(ctx, w, h, radiusPx) {
        const r = Math.max(0, Math.min(12, Math.round(radiusPx)));
        if (r <= 0) return;
        const id = ctx.getImageData(0, 0, w, h);
        const d = id.data;
        const a = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3];
        let cur = a;
        const rad = Math.min(r, 8);
        for (let pass = 0; pass < 2; pass++) {
            cur = boxBlur2D(cur, w, h, rad);
        }
        for (let i = 0; i < w * h; i++) {
            d[i * 4 + 3] = Math.round(Math.max(0, Math.min(255, cur[i])));
        }
        ctx.putImageData(id, 0, 0);
    }

    function boxBlur2D(src, w, h, rad) {
        const tmp = new Float32Array(w * h);
        const out = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let s = 0;
                let c = 0;
                for (let dx = -rad; dx <= rad; dx++) {
                    const xx = x + dx;
                    if (xx >= 0 && xx < w) {
                        s += src[y * w + xx];
                        c++;
                    }
                }
                tmp[y * w + x] = c ? s / c : 0;
            }
        }
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let s = 0;
                let c = 0;
                for (let dy = -rad; dy <= rad; dy++) {
                    const yy = y + dy;
                    if (yy >= 0 && yy < h) {
                        s += tmp[yy * w + x];
                        c++;
                    }
                }
                out[y * w + x] = c ? s / c : 0;
            }
        }
        return out;
    }

    async function getRemoveBackgroundFn() {
        if (cachedRemoveBackground) return cachedRemoveBackground;
        const mod = await import(/* webpackIgnore: true */ MODULE_URL);
        if (window.__illuRmbgAbort) throw new Error('ILLU_ABORT');
        const fn = mod && mod.removeBackground;
        if (typeof fn !== 'function') {
            throw new Error('removeBackground');
        }
        cachedRemoveBackground = fn;
        return fn;
    }

    function illuRmbgYieldToPaint() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 90);
                });
            });
        });
    }

    async function runRemoveJob(modelOpt, featherPx) {
        const em = window.EditorManager;
        const buf = em.activeLayer.buffer;
        const w = buf.width;
        const h = buf.height;
        window.__illuRmbgAbort = false;
        showProgressPanel();
        setRmbgBusyUi(true);
        await illuRmbgYieldToPaint();
        try {
            progStatus(2, 'progress.removeBgModule', 'Chargement du module IA…');
            const removeBackground = await getRemoveBackgroundFn();
            if (window.__illuRmbgAbort) throw new Error('ILLU_ABORT');
            progStatus(11, 'progress.removeBgPrepare', 'Préparation de l’image…');
            const blobIn = await new Promise((resolve, reject) => {
                try {
                    buf.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png');
                } catch (e) {
                    reject(e);
                }
            });
            if (window.__illuRmbgAbort) throw new Error('ILLU_ABORT');
            const outBlob = await removeBackground(blobIn, {
                model: modelOpt,
                progress: (key, cur, total) => {
                    if (window.__illuRmbgAbort) return;
                    setProgress(key, cur, total);
                },
                output: { format: 'image/png', quality: 1 }
            });
            if (window.__illuRmbgAbort) throw new Error('ILLU_ABORT');
            progStatus(96, 'progress.removeBgApply', 'Application sur le calque…');
            const bmp = await createImageBitmap(outBlob);
            const ctx = buf.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error('ctx');
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(bmp, 0, 0, w, h);
            bmp.close();
            featherAlphaChannel(ctx, w, h, featherPx);
            em.saveHistory(tKey('history.removeBg', 'Supprimer le fond (IA)'), { patchActiveLayer: true });
            em.render({ flushUiThumbnails: true });
        } finally {
            setRmbgBusyUi(false);
            progStatusDone();
        }
    }

    window.illuRemoveBackgroundIntelligent = function () {
        const em = window.EditorManager;
        if (!em || !em.isPixelMode || !em.activeLayer || !em.activeLayer.buffer) {
            window.showIlluAlert(tKey('msg.removeBgPixel', 'Disponible en mode Pixel sur un calque bitmap.'));
            return;
        }
        if (em.activeProject && em.activeProject.role === 'layerAlphaMask') {
            window.showIlluAlert(tKey('msg.removeBgMask', 'Ouvrez le document principal.'));
            return;
        }
        const buf = em.activeLayer.buffer;
        const w = buf.width;
        const h = buf.height;
        if (w < 2 || h < 2) {
            window.showIlluAlert(tKey('msg.removeBgSize', 'Image trop petite.'));
            return;
        }
        const maxSide = Math.max(w, h);
        if (maxSide > 4096) {
            const ok = window.confirm(
                tKey(
                    'msg.removeBgLarge',
                    'Image très grande : le traitement peut être lent ou saturer la mémoire. Continuer ?'
                )
            );
            if (!ok) return;
        }

        const root = showSettingsPanel();
        const startBtn = root.querySelector('#illu-rmbg-start');
        const modelSel = root.querySelector('#illu-rmbg-model');
        const featherN = root.querySelector('#illu-rmbg-feather-n');
        if (modelSel && window.ILLU_REMOVE_BG_MODEL) {
            modelSel.value = window.ILLU_REMOVE_BG_MODEL;
        }
        startBtn.onclick = async function () {
            startBtn.disabled = true;
            const modelOpt =
                (modelSel && modelSel.value) || window.ILLU_REMOVE_BG_MODEL || 'small';
            let featherPx = parseInt((featherN && featherN.value) || '0', 10);
            if (!Number.isFinite(featherPx)) featherPx = 0;
            featherPx = Math.max(0, Math.min(12, featherPx));
            try {
                await runRemoveJob(modelOpt, featherPx);
            } catch (e) {
                if (e && e.message === 'ILLU_ABORT') {
                    /* annulé par l’utilisateur */
                } else {
                    console.warn(e);
                    window.showIlluAlert(
                        e && e.message
                            ? tKey('msg.removeBgFail', 'Échec :') + ' ' + String(e.message).slice(0, 220)
                            : tKey(
                                  'msg.removeBgFailGeneric',
                                  'Impossible de supprimer le fond. Vérifiez la connexion (premier usage), un bloqueur de script, ou essayez un navigateur récent.'
                              )
                    );
                }
            } finally {
                startBtn.disabled = false;
                root.style.display = 'none';
                document.body.classList.remove('illu-rmbg-open');
            }
        };
    };
})();
