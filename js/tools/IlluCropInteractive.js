/**
 * Recadrage interactif : zone = sélection rect sur la toile, panneau compact, assombrissement hors zone.
 */
(function () {
    let panelRoot = null;
    let activeAspectRatio = null;

    function tKey(k, fb) {
        return window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t(k) : fb;
    }

    function readSb() {
        return window.selectionBounds &&
            window.selectionKind === 'rect' &&
            !window.selectionInverted
            ? window.selectionBounds
            : null;
    }

    window.illuCropPanelSync = function () {
        /* Panneau simplifié : pas de champs numériques. */
    };

    function applyAspectToSelection(ratio) {
        const em = window.EditorManager;
        const sb = readSb();
        if (!em || !sb || sb.w < 4 || sb.h < 4) return;
        const W = em.width;
        const H = em.height;
        if (!ratio) {
            activeAspectRatio = null;
            return;
        }
        activeAspectRatio = ratio;
        const cx = sb.x + sb.w / 2;
        const cy = sb.y + sb.h / 2;
        let w = sb.w;
        let h = sb.h;
        const current = w / h;
        if (current > ratio) {
            w = h * ratio;
        } else {
            h = w / ratio;
        }
        w = Math.max(4, Math.min(w, W));
        h = Math.max(4, Math.min(h, H));
        let x = cx - w / 2;
        let y = cy - h / 2;
        x = Math.max(0, Math.min(x, W - w));
        y = Math.max(0, Math.min(y, H - h));
        window.selectionBounds = { x, y, w, h };
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        em.render();
    }

    window.illuCropSetAspectRatio = function (ratio) {
        applyAspectToSelection(ratio);
    };

    function removePanel() {
        if (panelRoot) {
            panelRoot.remove();
            panelRoot = null;
        }
        activeAspectRatio = null;
    }

    function endSession() {
        window.illuCropSessionActive = false;
        if (typeof window.illuClearCropBoundsDrag === 'function') window.illuClearCropBoundsDrag();
        document.body.classList.remove('illu-crop-session');
        removePanel();
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        if (window.EditorManager) window.EditorManager.render();
    }

    function buildPanel() {
        removePanel();
        const root = document.createElement('div');
        root.id = 'illu-crop-panel-root';
        root.className = 'illu-crop-panel-host';
        root.innerHTML = `
            <div class="window floating-window illu-crop-panel" role="dialog" aria-labelledby="illu-crop-title">
                <div class="title-bar illu-crop-panel__title-bar">
                    <div class="title-bar-text" id="illu-crop-title" data-i18n="dlg.cropTitle">Recadrage</div>
                    <div class="title-bar-controls">
                        <button type="button" class="title-bar-close-btn" id="illu-crop-xbtn" aria-label="" data-i18n-aria-label="dlg.cameraRawClose"></button>
                    </div>
                </div>
                <div class="window-body illu-crop-panel-body">
                    <div class="illu-crop-ratio-row" role="group" aria-label="Ratio">
                        <button type="button" class="illu-crop-ratio-btn" data-crop-ratio="1.7777777778" title="16:9">
                            <span class="illu-crop-ratio-preview illu-crop-ratio-preview--169" aria-hidden="true"></span>
                            <span class="illu-crop-ratio-lbl">16:9</span>
                        </button>
                        <button type="button" class="illu-crop-ratio-btn" data-crop-ratio="0.5625" title="9:16">
                            <span class="illu-crop-ratio-preview illu-crop-ratio-preview--916" aria-hidden="true"></span>
                            <span class="illu-crop-ratio-lbl">9:16</span>
                        </button>
                        <button type="button" class="illu-crop-ratio-btn" data-crop-ratio="1" title="1:1">
                            <span class="illu-crop-ratio-preview illu-crop-ratio-preview--11" aria-hidden="true"></span>
                            <span class="illu-crop-ratio-lbl">1:1</span>
                        </button>
                        <button type="button" class="illu-crop-ratio-btn" data-crop-ratio="1.3333333333" title="4:3">
                            <span class="illu-crop-ratio-preview illu-crop-ratio-preview--43" aria-hidden="true"></span>
                            <span class="illu-crop-ratio-lbl">4:3</span>
                        </button>
                        <button type="button" class="illu-crop-ratio-btn illu-crop-ratio-btn--free" data-crop-ratio="" title="Libre" data-i18n="dlg.cropFree">
                            <span class="illu-crop-ratio-preview illu-crop-ratio-preview--free" aria-hidden="true"></span>
                            <span class="illu-crop-ratio-lbl" data-i18n="dlg.cropFree">Libre</span>
                        </button>
                    </div>
                    <div class="illu-crop-actions">
                        <button type="button" id="illu-crop-apply" class="illu-crop-btn-primary" data-i18n="dlg.cropApply" title="Recadrer">
                            <i class="fa-solid fa-crop" aria-hidden="true"></i>
                        </button>
                        <button type="button" id="illu-crop-cancel" class="illu-crop-btn-cancel" data-i18n="dlg.cancel">Annuler</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(root);
        panelRoot = root;

        root.querySelector('#illu-crop-xbtn').addEventListener('click', () => endSession());
        root.querySelector('#illu-crop-cancel').addEventListener('click', () => endSession());

        root.querySelectorAll('.illu-crop-ratio-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                root.querySelectorAll('.illu-crop-ratio-btn').forEach((b) => {
                    b.classList.remove('illu-crop-ratio-btn--active');
                });
                btn.classList.add('illu-crop-ratio-btn--active');
                const raw = btn.getAttribute('data-crop-ratio');
                const ratio = raw === '' || raw == null ? null : parseFloat(raw, 10);
                applyAspectToSelection(ratio);
            });
        });

        root.querySelector('#illu-crop-apply').addEventListener('click', () => {
            const em = window.EditorManager;
            const sb = readSb();
            if (!em || !sb || sb.w < 4 || sb.h < 4) {
                window.showIlluAlert(tKey('msg.cropInvalid', 'Zone de recadrage invalide.'));
                return;
            }
            em.cropPixelWorkspace(sb.x, sb.y, sb.w, sb.h);
            endSession();
            em.selectAll();
            if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
            em.render({ flushUiThumbnails: true });
        });

        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(root);
        }
    }

    window.startIlluInteractiveCrop = function () {
        const em = window.EditorManager;
        const pm = window.PhotoModeManager;
        const inPhoto = pm && pm.isOpen();

        if (!em || (!em.isPixelMode && !inPhoto) || !em.activeProject) {
            window.showIlluAlert(tKey('msg.cropPixel', 'Disponible en mode Pixel.'));
            return;
        }
        if (em.activeProject.role === 'layerAlphaMask' && !inPhoto) {
            window.showIlluAlert(tKey('msg.cropMask', 'Ouvrez le document principal.'));
            return;
        }
        endSession();
        const selBtn = document.getElementById('tool-select');
        if (selBtn) selBtn.click();
        em.selectAll();
        if (typeof window.fitActiveProjectZoomToWorkspace === 'function') {
            window.fitActiveProjectZoomToWorkspace(em);
        }
        window.illuCropSessionActive = true;
        document.body.classList.add('illu-crop-session');
        buildPanel();
        window.illuCropPanelSync();
        const winEl = panelRoot && panelRoot.querySelector('.illu-crop-panel');
        if (winEl && typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(winEl);
        }
    };
})();
