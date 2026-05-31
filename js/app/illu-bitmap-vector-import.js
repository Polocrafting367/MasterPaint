/**
 * illu-bitmap-vector-import.js — Import bitmap + vectorisation (projet ou fichier).
 */
(function () {
    'use strict';

    let pendingImg = null;
    let pendingSource = 'file';

    function overlay(id) {
        return document.getElementById(id);
    }

    function hideAll() {
        ['vector-bitmap-import-overlay', 'vectorize-params-overlay'].forEach((id) => {
            const el = overlay(id);
            if (el) el.style.display = 'none';
        });
    }

    function readVectorizeOptions() {
        const num = (id, fallback) => {
            const el = document.getElementById(id);
            if (!el) return fallback;
            const v = parseFloat(el.value);
            return Number.isFinite(v) ? v : fallback;
        };
        const chk = (id, fallback) => {
            const el = document.getElementById(id);
            return el ? !!el.checked : fallback;
        };
        const base = window.IlluVectorize?.DEFAULT_OPTIONS || {};
        return {
            ...base,
            colorTolerance: num('vz-color-tolerance', base.colorTolerance),
            maxColors: num('vz-max-colors', base.maxColors),
            minArea: num('vz-min-area', base.minArea),
            simplifyEpsilon: num('vz-simplify', base.simplifyEpsilon),
            detectShapes: chk('vz-detect-shapes', true),
            detectGrid: chk('vz-detect-grid', false),
            preserveTransparency: chk('vz-preserve-alpha', true),
            removeEmbeddedBitmaps: chk('vz-remove-bitmaps', false)
        };
    }

    function bindVectorizeSliders() {
        const pairs = [
            ['vz-color-tolerance', 'vz-color-tolerance-val'],
            ['vz-max-colors', 'vz-max-colors-val'],
            ['vz-min-area', 'vz-min-area-val'],
            ['vz-simplify', 'vz-simplify-val']
        ];
        pairs.forEach(([inputId, labelId]) => {
            const input = document.getElementById(inputId);
            const label = document.getElementById(labelId);
            if (!input || !label) return;
            const sync = () => {
                label.textContent = String(input.value);
            };
            input.addEventListener('input', sync);
            sync();
        });
    }

    function vectorizeParamsHtml(fromProject) {
        const lead = fromProject
            ? 'Vectorise le contenu visible du document (formes, bitmaps intégrés, aplats de couleur).'
            : 'Conversion en ellipses, rectangles, formes arrondies ou tracés libres selon les zones de couleur.';
        const rmRow = fromProject
            ? `<label style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                    <input type="checkbox" id="vz-remove-bitmaps" checked> Retirer les bitmaps intégrés après vectorisation
               </label>`
            : '';
        return `
            <p style="margin:0 0 10px;font-size:11px;opacity:0.9;line-height:1.35;">${lead}</p>
            <label style="display:block;margin:10px 0 4px;">Tolérance couleur : <span id="vz-color-tolerance-val">28</span></label>
            <input type="range" id="vz-color-tolerance" min="4" max="96" value="28" style="width:100%;">
            <label style="display:block;margin:10px 0 4px;">Couleurs max : <span id="vz-max-colors-val">512</span></label>
            <input type="range" id="vz-max-colors" min="32" max="1024" step="32" value="512" style="width:100%;">
            <label style="display:block;margin:10px 0 4px;">Surface min. (px) : <span id="vz-min-area-val">24</span></label>
            <input type="range" id="vz-min-area" min="4" max="256" step="4" value="24" style="width:100%;">
            <label style="display:block;margin:10px 0 4px;">Simplification tracés : <span id="vz-simplify-val">2.2</span></label>
            <input type="range" id="vz-simplify" min="0.2" max="10" step="0.1" value="2.2" style="width:100%;">
            <label style="display:flex;align-items:center;gap:8px;margin-top:12px;">
                <input type="checkbox" id="vz-detect-shapes" checked> Détecter formes (rond, carré, coins arrondis)
            </label>
            <label style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                <input type="checkbox" id="vz-detect-grid"> Détecter damier / sprite sheet (grille carrée uniquement)
            </label>
            <label style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                <input type="checkbox" id="vz-preserve-alpha" checked> Formes semi-transparentes (calque au-dessus)
            </label>
            ${rmRow}
        `;
    }

    function openVectorizeEffectDialog(fromProject) {
        const dialog = document.getElementById('effect-dialog');
        const win = document.getElementById('effect-dialog-window');
        const titleEl = document.getElementById('effect-dialog-title');
        if (!dialog || !win) {
            window.illuOpenVectorizeParamsDialog(pendingImg, fromProject ? 'project' : 'file');
            return;
        }
        if (titleEl) titleEl.textContent = fromProject ? 'Vectoriser le document' : 'Vectoriser le bitmap';
        document.getElementById('effect-dialog-content').innerHTML = vectorizeParamsHtml(fromProject);
        bindVectorizeSliders();
        if (typeof illuSetEffectDialogFooterMode === 'function') illuSetEffectDialogFooterMode('resize');
        win.classList.add('floating-window');
        win.style.position = 'fixed';
        win.style.width = '420px';
        const hasPos =
            (typeof window.applyEffectDialogSavedPosition === 'function' &&
                window.applyEffectDialogSavedPosition(win)) ||
            (win.style.left &&
                String(win.style.left).trim() !== '' &&
                win.style.top &&
                String(win.style.top).trim() !== '');
        if (!hasPos) {
            const w = win.offsetWidth || 420;
            const h = win.offsetHeight || 360;
            win.style.left = Math.max(0, Math.round((window.innerWidth - w) / 2)) + 'px';
            win.style.top = Math.max(0, Math.round((window.innerHeight - h) / 2)) + 'px';
        }
        if (typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(win);
        }
        dialog.style.display = 'block';
        document.body.classList.add('effect-dialog-open');
        if (typeof window.illuScheduleEffectDialogWorkspaceClamp === 'function') {
            window.illuScheduleEffectDialogWorkspaceClamp();
        }
        const prevApply = window.applyCurrentEffectModal;
        const prevClose = window.closeEffectModal;
        window.applyCurrentEffectModal = async function () {
            await runVectorize();
            if (typeof prevClose === 'function') prevClose();
            else if (typeof window.closeEffectModal === 'function') window.closeEffectModal();
            window.applyCurrentEffectModal = prevApply || function () {
                if (window.FilterManager) window.FilterManager.apply();
            };
        };
    }

    function updateVectorizeDialogLead() {
        const lead = document.getElementById('vectorize-dialog-lead');
        const rmRow = document.getElementById('vz-remove-bitmaps-row');
        if (pendingSource === 'project') {
            if (lead) {
                lead.textContent =
                    'Vectorise le contenu visible du document (formes, bitmaps intégrés, aplats de couleur).';
            }
            if (rmRow) rmRow.hidden = false;
        } else {
            if (lead) {
                lead.textContent =
                    'Conversion en ellipses, rectangles, formes arrondies ou tracés libres selon les zones de couleur.';
            }
            if (rmRow) rmRow.hidden = true;
        }
    }

    window.illuPromptVectorBitmapImport = function (img) {
        pendingImg = img;
        pendingSource = 'file';
        const ov = overlay('vector-bitmap-import-overlay');
        if (!ov) {
            if (window.EditorManager?.embedBitmapInVectorProject) {
                window.EditorManager.embedBitmapInVectorProject(img);
            }
            return;
        }
        ov.style.display = 'flex';
    };

    window.illuOpenVectorizeParamsDialog = function (img, source) {
        pendingImg = img || pendingImg;
        if (source) pendingSource = source;
        hideAll();
        updateVectorizeDialogLead();
        const ov = overlay('vectorize-params-overlay');
        if (ov) ov.style.display = 'flex';
    };

    function removeEmbeddedBitmapImages() {
        const layersRoot = document.getElementById('svg-layers');
        if (!layersRoot) return 0;
        let n = 0;
        layersRoot.querySelectorAll('image[data-illu-bitmap-embed="1"]').forEach((el) => {
            el.remove();
            n++;
        });
        return n;
    }

    async function runVectorize() {
        const img = pendingImg;
        if (!img || !window.IlluVectorize || !window.EditorManager) return;
        hideAll();
        const opts = readVectorizeOptions();
        if (typeof window.illuShowProgress === 'function') {
            window.illuShowProgress('Vectorisation…');
        }
        try {
            const em = window.EditorManager;
            const p = em.activeProject;
            const result = await window.IlluVectorize.vectorizeImage(img, opts);
            const sw = p ? p.width : img.naturalWidth || img.width;
            const sh = p ? p.height : img.naturalHeight || img.height;

            if (opts.removeEmbeddedBitmaps && pendingSource === 'project') {
                removeEmbeddedBitmapImages();
            }

            em.injectVectorizedFragment(result, {
                sourceWidth: sw,
                sourceHeight: sh,
                historyLabel: pendingSource === 'project' ? 'Vectoriser le document' : 'Vectoriser bitmap',
                newLayer: pendingSource === 'project'
            });

            if (window.showIlluAlert) {
                window.showIlluAlert(
                    `Vectorisation terminée (${result.elementCount || 0} forme(s)).`
                );
            }
        } catch (err) {
            console.error('[vectorize]', err);
            if (window.showIlluAlert) {
                window.showIlluAlert(
                    err && err.message ? `Vectorisation : ${err.message}` : 'Échec de la vectorisation.'
                );
            }
        } finally {
            pendingImg = null;
            pendingSource = 'file';
            if (typeof window.illuHideProgress === 'function') window.illuHideProgress();
        }
    }

    window.illuMenuVectorizeBitmap = async function () {
        if (
            typeof EditorManager === 'undefined' ||
            !EditorManager.activeProject ||
            EditorManager.isPixelMode
        ) {
            if (window.showIlluAlert) {
                window.showIlluAlert('Vectorisation disponible uniquement en mode SVG.');
            }
            return;
        }
        if (!window.IlluVectorize || typeof window.IlluVectorize.captureActiveProjectImage !== 'function') {
            if (window.showIlluAlert) window.showIlluAlert('Moteur de vectorisation indisponible.');
            return;
        }
        try {
            if (typeof window.illuShowProgress === 'function') {
                window.illuShowProgress('Capture du document…');
            }
            if (typeof EditorManager.syncActiveVectorSvg === 'function') {
                EditorManager.syncActiveVectorSvg();
            }
            const img = await window.IlluVectorize.captureActiveProjectImage();
            if (!img) {
                if (window.showIlluAlert) window.showIlluAlert('Impossible de capturer le document.');
                return;
            }
            pendingImg = img;
            pendingSource = 'project';
            openVectorizeEffectDialog(true);
        } catch (err) {
            console.error('[vectorize] capture', err);
            if (window.showIlluAlert) {
                window.showIlluAlert('Impossible de préparer le document pour la vectorisation.');
            }
        } finally {
            if (typeof window.illuHideProgress === 'function') window.illuHideProgress();
        }
    };

    function init() {
        bindVectorizeSliders();
        syncVectorizeMenuState();

        const btnEmbed = document.getElementById('btn-vector-import-embed');
        if (btnEmbed) {
            btnEmbed.addEventListener('click', () => {
                hideAll();
                if (pendingImg && window.EditorManager?.embedBitmapInVectorProject) {
                    window.EditorManager.embedBitmapInVectorProject(pendingImg);
                }
                pendingImg = null;
                pendingSource = 'file';
            });
        }

        const btnVectorize = document.getElementById('btn-vector-import-vectorize');
        if (btnVectorize) {
            btnVectorize.addEventListener('click', () => {
                hideAll();
                pendingSource = 'file';
                window.illuOpenVectorizeParamsDialog(pendingImg, 'file');
            });
        }

        const btnPixel = document.getElementById('btn-vector-import-pixel-tab');
        if (btnPixel) {
            btnPixel.addEventListener('click', () => {
                hideAll();
                if (pendingImg && window.EditorManager?.handleNewProjectFromImage) {
                    window.EditorManager.handleNewProjectFromImage(pendingImg);
                }
                pendingImg = null;
                pendingSource = 'file';
            });
        }

        const btnVzCancel = document.getElementById('btn-vectorize-cancel');
        if (btnVzCancel) {
            btnVzCancel.addEventListener('click', () => {
                hideAll();
                pendingImg = null;
                pendingSource = 'file';
            });
        }

        const btnVzOk = document.getElementById('btn-vectorize-ok');
        if (btnVzOk) btnVzOk.addEventListener('click', () => runVectorize());

        document.querySelectorAll('[data-vector-import-cancel]').forEach((btn) => {
            btn.addEventListener('click', () => {
                hideAll();
                pendingImg = null;
                pendingSource = 'file';
            });
        });

        bindVectorizeFileInput();
    }

    function syncVectorizeMenuState() {
        const item = document.getElementById('menu-edit-vectorize');
        if (!item) return;
        const vector =
            typeof EditorManager !== 'undefined' &&
            EditorManager.activeProject &&
            !EditorManager.isPixelMode;
        item.setAttribute('aria-disabled', vector ? 'false' : 'true');
        item.style.opacity = vector ? '' : '0.45';
        item.style.pointerEvents = vector ? '' : 'none';
        item.style.filter = vector ? '' : 'grayscale(60%)';
    }

    window.illuSyncVectorizeMenuState = syncVectorizeMenuState;

    function bindVectorizeFileInput() {
        const input = document.getElementById('illu-vectorize-file-input');
        if (!input || input.dataset.illuBound) return;
        input.dataset.illuBound = '1';
        input.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    pendingImg = img;
                    pendingSource = 'file';
                    window.illuOpenVectorizeParamsDialog(img, 'file');
                };
                img.onerror = () => {
                    if (window.showIlluAlert) window.showIlluAlert('Impossible de charger cette image.');
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            input.value = '';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
