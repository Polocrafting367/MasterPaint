/**
 * app.js
 * Main entry point for MasterPaint 98 tools and interactions (Orchestrator).
 */

// Initialise les contextes globaux pour les autres modules
window.canvas = document.getElementById('drawing-canvas');
window.svg = document.getElementById('drawing-svg');
window.ctx = window.canvas.getContext('2d', { willReadFrequently: true });

/** Journal de chargement sur le splash screen. */
window.illuSplashLog = function (msg) {
    console.log('[ILLU-INIT] ' + msg);
    const el = document.getElementById('illu-splash-status');
    if (el) {
        el.textContent = msg;
    }
};

/** Laisse le navigateur peindre / répondre (évite freeze sur gros .illu). */
window.illuYieldToMain = function (frames) {
    const n = Math.max(1, Number(frames) || 1);
    return new Promise((resolve) => {
        const step = (left) => {
            if (left <= 0) resolve();
            else requestAnimationFrame(() => step(left - 1));
        };
        step(n);
    });
};

/** Taille document par défaut (nouveau projet / repli). */
window.ILLU_DEFAULT_DOC_WIDTH = 1280;
window.ILLU_DEFAULT_DOC_HEIGHT = 720;

/** Rayon d’arrondi rectangle (outil forme + ruban vecteur). */
window.ILLU_SHAPE_CORNER_RADIUS_MAX = 256;

window.illuShapeCornerRadiusMax = function () {
    const m = window.ILLU_SHAPE_CORNER_RADIUS_MAX;
    return Number.isFinite(m) && m > 0 ? m : 256;
};

window.illuClampShapeCornerRadius = function (v) {
    return Math.max(0, Math.min(window.illuShapeCornerRadiusMax(), Number(v) || 0));
};

window.illuApplyShapeCornerRadiusMaxToInputs = function () {
    const max = window.illuShapeCornerRadiusMax();
    ['tool-shape-corner-radius', 'vector-prop-corner-radius'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.max = String(max);
    });
};

/** Remplace window.alert par une fenêtre modale au style de l’application. */
window.showIlluAlert = function (message) {
    const ov = document.getElementById('illu-alert-overlay');
    const msgEl = document.getElementById('illu-alert-message');
    const titleEl = document.getElementById('illu-alert-title');
    if (!ov || !msgEl) {
        alert(message == null ? '' : String(message));
        return;
    }
    msgEl.textContent = message == null ? '' : String(message);
    if (titleEl) {
        titleEl.textContent =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('dlg.alertTitle')
                : 'Illu';
    }
    if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
        window.IlluI18n.apply();
    }
    const single = document.getElementById('illu-alert-actions-single');
    const dual = document.getElementById('illu-alert-actions-confirm');
    if (single) single.style.display = '';
    if (dual) dual.style.display = 'none';
    ov.style.display = 'flex';
    const ok = document.getElementById('illu-alert-ok');
    if (ok) {
        ok.focus();
    }
};

/**
 * @param {{ title?: string, message: string, confirmText?: string, cancelText?: string, onConfirm?: function, onCancel?: function }} opts
 */
window.showIlluConfirm = function (opts) {
    opts = opts || {};
    const ov = document.getElementById('illu-alert-overlay');
    const msgEl = document.getElementById('illu-alert-message');
    const titleEl = document.getElementById('illu-alert-title');
    const single = document.getElementById('illu-alert-actions-single');
    const dual = document.getElementById('illu-alert-actions-confirm');
    const okBtn = document.getElementById('illu-alert-ok');
    const cancelBtn = document.getElementById('illu-alert-cancel');
    const confirmBtn = document.getElementById('illu-alert-confirm');
    if (!ov || !msgEl || !dual || !confirmBtn) {
        if (window.confirm(opts.message || '')) {
            if (typeof opts.onConfirm === 'function') opts.onConfirm();
        } else if (typeof opts.onCancel === 'function') {
            opts.onCancel();
        }
        return;
    }
    const t =
        window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t.bind(window.IlluI18n)
            : (k, fb) => fb || k;
    if (titleEl) {
        titleEl.textContent = opts.title || t('dlg.alertTitle', 'Illu');
    }
    msgEl.textContent = opts.message == null ? '' : String(opts.message);
    if (single) single.style.display = 'none';
    dual.style.display = 'flex';
    if (cancelBtn) cancelBtn.textContent = opts.cancelText || t('dlg.cancel', 'Annuler');
    confirmBtn.textContent = opts.confirmText || t('dlg.apply', 'Continuer');
    ov.style.display = 'flex';
    const close = (confirmed) => {
        ov.style.display = 'none';
        if (single) single.style.display = '';
        dual.style.display = 'none';
        if (confirmed) {
            if (typeof opts.onConfirm === 'function') opts.onConfirm();
        } else if (typeof opts.onCancel === 'function') {
            opts.onCancel();
        }
    };
    const onConfirm = () => close(true);
    const onCancel = () => close(false);
    confirmBtn.onclick = onConfirm;
    if (cancelBtn) cancelBtn.onclick = onCancel;
    confirmBtn.focus();
};

/** Passage téléphone ↔ bureau : rechargement complet de la page requis. */
window.illuLayoutRequiresFullReload = function (prev, next) {
    const phone = (m) => m === 'phone';
    return phone(prev) !== phone(next);
};

/** Modifications locales non exportées vers un fichier (historique d’édition). */
window.illuWorkspaceHasUnsavedWork = function () {
    const em = window.EditorManager;
    if (!em || !Array.isArray(em.projects)) return false;
    return em.projects.some((p) => {
        if (!p || p.role === 'layerAlphaMask') return false;
        const hi = p.historyIndex | 0;
        if (hi > 0) return true;
        const h = p.history;
        return Array.isArray(h) && h.length > 1 && hi >= 0;
    });
};

window.illuReloadPageForUILayout = function () {
    const persist = () => {
        try {
            if (window.WorkspaceIO && typeof window.WorkspaceIO.persistToLocalStorage === 'function') {
                window.WorkspaceIO.persistToLocalStorage({ force: true });
            }
        } catch (e) {
            console.warn(e);
        }
        window.location.reload();
    };
    if (window.WorkspaceIO && typeof window.WorkspaceIO.persistToLocalStorageAsync === 'function') {
        window.WorkspaceIO.persistToLocalStorageAsync({ force: true }).finally(persist);
        return;
    }
    persist();
};

/** Après validation Paramètres : confirmer puis recharger si passage mode téléphone. */
window.illuConfirmUILayoutReloadIfNeeded = function (prevLayout, nextLayout, onCancelLayoutRevert) {
    if (!window.illuLayoutRequiresFullReload(prevLayout, nextLayout)) return false;
    const t =
        window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t.bind(window.IlluI18n)
            : (k, fb) => fb || k;
    const unsaved =
        typeof window.illuWorkspaceHasUnsavedWork === 'function' && window.illuWorkspaceHasUnsavedWork();
    window.showIlluConfirm({
        title: t('dlg.layoutReloadTitle', 'Changer de disposition'),
        message: unsaved
            ? t('dlg.layoutReloadUnsaved', 'Modifications non exportées. Recharger ?')
            : t('dlg.layoutReloadMsg', 'La page va se recharger.'),
        confirmText: t('dlg.layoutReloadConfirm', 'Recharger la page'),
        cancelText: t('dlg.cancel', 'Annuler'),
        onConfirm: () => {
            const settingsOv = document.getElementById('settings-overlay');
            if (settingsOv) settingsOv.style.display = 'none';
            window.illuReloadPageForUILayout();
        },
        onCancel: () => {
            if (typeof onCancelLayoutRevert === 'function') onCancelLayoutRevert();
        }
    });
    return true;
};

function initIlluBeforeUnloadGuard() {
    if (window._illuBeforeUnloadGuard) return;
    window._illuBeforeUnloadGuard = true;
    window.addEventListener('beforeunload', (e) => {
        if (typeof window.illuWorkspaceHasUnsavedWork !== 'function') return;
        if (!window.illuWorkspaceHasUnsavedWork()) return;
        e.preventDefault();
        e.returnValue = '';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initIlluBeforeUnloadGuard();
    setTimeout(() => {
        if (typeof window.illuRevealSplashSub === 'function') window.illuRevealSplashSub();
    }, 900);
    window.illuSplashLog('Démarrage de l\'application...');

    // Auto-fetch version from changelog
    fetch('changelog.txt')
        .then(r => r.text())
        .then(t => {
            const m = t.match(/(\d+\.\d+\.\d+)/);
            const vEl = document.getElementById('illu-version-text');
            if (m && vEl) vEl.textContent = 'v' + m[1] + ' - ';
            if (typeof window.illuRevealSplashSub === 'function') window.illuRevealSplashSub();
        })
        .catch(() => {
            if (typeof window.illuRevealSplashSub === 'function') window.illuRevealSplashSub();
        });

    const ov = document.getElementById('illu-alert-overlay');
    const ok = document.getElementById('illu-alert-ok');
    if (ov && ok) {
        const close = () => {
            ov.style.display = 'none';
        };
        ok.addEventListener('click', close);
        ov.addEventListener('click', (e) => {
            if (e.target === ov) close();
        });
    }
    if (typeof initTools === 'function') {
        initTools();
    }
    window.illuSplashLog('Initialisation de l\'interface...');
    illuInitMenubarToolbar();
    window.illuSplashLog('Prêt.');
});

const ILLU_RESIZE_SCOPE_KEY = 'illu_resize_scope';
const ILLU_RESAMPLE_KEY = 'illu_resample';
const ILLU_ALLOW_OUTSIDE_CANVAS_KEY = 'illu_allow_outside_canvas';

function illuReadResampleMode() {
    try {
        const v = localStorage.getItem(ILLU_RESAMPLE_KEY);
        if (v === 'nearest' || v === 'smooth') return v;
    } catch (e) { /* ignore */ }
    return 'smooth';
}

function illuReadAllowOutsideCanvas() {
    try {
        const v = localStorage.getItem(ILLU_ALLOW_OUTSIDE_CANVAS_KEY);
        if (v === '1') return true;
        if (v === '0') return false;
    } catch (e) {
        /* ignore */
    }
    return false;
}

window.illuInterpolationMode = illuReadResampleMode();
if (typeof EditorManager !== 'undefined' && EditorManager.toolProps) {
    EditorManager.toolProps.allowOutsideCanvas = illuReadAllowOutsideCanvas();
}

// ==========================================
// Hors toile (contenu hors document)
// ==========================================
window.syncIlluAllowOutsideCanvasUI = function () {
    if (typeof EditorManager === 'undefined' || !EditorManager.toolProps) return;
    const on = !!EditorManager.toolProps.allowOutsideCanvas;

    const menuCheck = document.getElementById('menu-win-outside-canvas-check');
    if (menuCheck) menuCheck.style.visibility = on ? 'visible' : 'hidden';

    const outsideCb = document.getElementById('tool-allow-outside-canvas');
    if (outsideCb) outsideCb.checked = on;

    const mcc = document.getElementById('main-canvas-container');
    if (mcc) mcc.classList.toggle('illu-allow-outside-canvas-active', on);

    const ws = document.getElementById('workspace');
    if (ws) ws.classList.toggle('illu-allow-outside-canvas-active', on);

    const wsw = document.getElementById('workspace-wrapper');
    if (wsw) wsw.classList.toggle('illu-allow-outside-canvas-active', on);

    if (typeof window.syncAllToolbarToggles === 'function') {
        window.syncAllToolbarToggles();
    }
    if (typeof window.updateMainCanvasCursor === 'function') {
        window.updateMainCanvasCursor();
    }
    if (typeof EditorManager !== 'undefined' && typeof EditorManager.render === 'function') {
        EditorManager.render();
    }
};

window.illuHasOutsideCanvasContent = function () {
    if (typeof EditorManager === 'undefined' || !EditorManager.activeProject) return false;
    if (!EditorManager.isPixelMode) return false;
    const W = EditorManager.width;
    const H = EditorManager.height;
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return false;

    const hasOutsideInProject = (p) => {
        if (!p || !Array.isArray(p.layers)) return false;
        for (const l of p.layers) {
            if (!l || !l.buffer) continue;
            const x = l.x | 0;
            const y = l.y | 0;
            const bw = l.buffer.width | 0;
            const bh = l.buffer.height | 0;
            if (x < 0 || y < 0 || x + bw > W || y + bh > H) return true;
        }
        return false;
    };

    const p0 = EditorManager.activeProject;
    if (hasOutsideInProject(p0)) return true;

    // Vérifier aussi les projets de masques alpha si référencés
    const maskIds = new Set();
    if (Array.isArray(p0.layers)) {
        p0.layers.forEach((l) => {
            if (l && l.alphaMaskProjectId) maskIds.add(l.alphaMaskProjectId);
        });
    }
    for (const mid of maskIds) {
        const mp = EditorManager.projects ? EditorManager.projects.find((pr) => pr.id === mid) : null;
        if (hasOutsideInProject(mp)) return true;
    }
    return false;
};

window.requestIlluAllowOutsideCanvasChange = function (nextOn) {
    if (typeof EditorManager === 'undefined' || !EditorManager.toolProps) return;
    const prevOn = !!EditorManager.toolProps.allowOutsideCanvas;
    const desired = !!nextOn;
    if (desired === prevOn) return;

    const getShortLabel = () =>
        window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t('tools.allowOutsideCanvasShort', 'Hors toile')
            : 'Hors toile';

    const setFlagOnly = (on) => {
        EditorManager.toolProps.allowOutsideCanvas = !!on;
        try {
            localStorage.setItem(ILLU_ALLOW_OUTSIDE_CANVAS_KEY, on ? '1' : '0');
        } catch (e) {
            /* ignore */
        }
    };

    if (desired) {
        setFlagOnly(true);
        // Le toggle doit être undo/redo : on crée une entrée légère
        if (EditorManager.isPixelMode) {
            EditorManager.saveHistory(`${getShortLabel()} : activé`, { patchActiveLayer: true });
        }
        window.syncIlluAllowOutsideCanvasUI();
        return;
    }

    // desired === false : on confirme puis on purgera
    const label = getShortLabel();
    const message =
        `Si vous désactivez "${label}", le contenu dessiné en dehors du canvas sera supprimé.\n\n` +
        `OK pour supprimer (rogner) tout ce qui dépasse du document ?`;

    window.showIlluConfirm({
        title: label,
        message,
        confirmText: window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t('dlg.apply', 'OK') : 'OK',
        cancelText: window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t('dlg.cancel', 'Annuler') : 'Annuler',
        onConfirm: () => {
            // Coupure logique d’abord : la purge travaille en mode "clamp"
            setFlagOnly(false);
            const W = EditorManager.width;
            const H = EditorManager.height;
            if (window.illuHasOutsideCanvasContent && window.illuHasOutsideCanvasContent()) {
                EditorManager.cropPixelWorkspace(0, 0, W, H, {
                    actionName: `${label} : contenu hors toile supprimé`,
                    normalizeLayersToDocument: true
                });
            } else {
                EditorManager.saveHistory(`${label} : désactivé`, { patchActiveLayer: true });
            }
            window.syncIlluAllowOutsideCanvasUI();
        },
        onCancel: () => {
            setFlagOnly(true);
            window.syncIlluAllowOutsideCanvasUI();
        }
    });
};

window.toggleIlluAllowOutsideCanvas = function () {
    if (typeof EditorManager === 'undefined' || !EditorManager.toolProps) return;
    window.requestIlluAllowOutsideCanvasChange(!EditorManager.toolProps.allowOutsideCanvas);
};

// Best-effort initial sync (elements can be added/removed during init).
setTimeout(() => {
    if (typeof window.syncIlluAllowOutsideCanvasUI === 'function') window.syncIlluAllowOutsideCanvasUI();
}, 0);

function illuSetEffectDialogFooterMode(mode) {
    const raz = document.getElementById('effect-dialog-btn-raz');
    const ok = document.getElementById('effect-dialog-btn-ok');
    const fermer = document.getElementById('effect-dialog-btn-fermer');
    const annul = document.getElementById('effect-dialog-btn-annuler');
    const vhsLink = document.getElementById('ef-vhs-open-video-pro');
    if (mode === 'transform') {
        if (raz) raz.style.display = 'none';
        if (ok) ok.style.display = 'none';
        if (fermer) fermer.style.display = '';
        if (annul) annul.style.display = '';
        if (vhsLink) vhsLink.hidden = true;
    } else if (mode === 'resize') {
        if (raz) raz.style.display = 'none';
        if (ok) ok.style.display = '';
        if (fermer) fermer.style.display = 'none';
        if (annul) annul.style.display = '';
        if (vhsLink) vhsLink.hidden = true;
    } else if (mode === 'gallery') {
        if (raz) raz.style.display = 'none';
        if (ok) ok.style.display = 'none';
        if (fermer) fermer.style.display = '';
        if (annul) annul.style.display = 'none';
        if (vhsLink) vhsLink.hidden = true;
    } else {
        if (raz) raz.style.display = '';
        if (ok) ok.style.display = '';
        if (fermer) fermer.style.display = 'none';
        if (annul) annul.style.display = '';
        /* Lien VHS : visible uniquement si FilterManager ouvre l’effet VHS (showModal). */
    }
}

(function illuWrapEffectModalClose() {
    const prev = window.closeEffectModal;
    window.closeEffectModal = function () {
        illuSetEffectDialogFooterMode('default');
        window.selectionExpansionPreviewPx = 0;
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        return prev.apply(this, arguments);
    };
})();

function illuReadResizeScope() {
    try {
        const v = localStorage.getItem(ILLU_RESIZE_SCOPE_KEY);
        if (v === 'active' || v === 'all') return v;
    } catch (e) {
        /* ignore */
    }
    return 'all';
}

function illuReadEffectScope() {
    try {
        const v = localStorage.getItem('illu_effect_scope');
        if (v === 'all' || v === 'selection' || v === 'active') return v;
    } catch (e) {
        /* ignore */
    }
    return 'active';
}

function illuBindScopeBar(root) {
    if (!root || root.dataset.illuScopeBarBound) return;
    root.dataset.illuScopeBarBound = '1';
    const scope = illuReadEffectScope();
    root.querySelectorAll('.illu-scope-btn[data-scope]').forEach((btn) => {
        const v = btn.getAttribute('data-scope');
        btn.classList.toggle('illu-scope-btn--active', v === scope);
        btn.addEventListener('click', () => {
            const nv = btn.getAttribute('data-scope');
            if (!nv) return;
            try {
                localStorage.setItem('illu_effect_scope', nv);
            } catch (e) {
                /* ignore */
            }
            root.querySelectorAll('.illu-scope-btn[data-scope]').forEach((b) => {
                b.classList.toggle('illu-scope-btn--active', b.getAttribute('data-scope') === nv);
            });
        });
    });
}

function illuBindResizeScopeBar(root) {
    if (!root || root.dataset.illuResizeScopeBound) return;
    root.dataset.illuResizeScopeBound = '1';
    const scope = illuReadResizeScope();
    root.querySelectorAll('.illu-rz-scope-btn[data-rz-scope]').forEach((btn) => {
        const v = btn.getAttribute('data-rz-scope');
        btn.classList.toggle('illu-scope-btn--active', v === scope);
        btn.addEventListener('click', () => {
            const nv = btn.getAttribute('data-rz-scope');
            if (!nv) return;
            try {
                localStorage.setItem(ILLU_RESIZE_SCOPE_KEY, nv);
            } catch (e) {
                /* ignore */
            }
            root.querySelectorAll('.illu-rz-scope-btn[data-rz-scope]').forEach((b) => {
                b.classList.toggle('illu-scope-btn--active', b.getAttribute('data-rz-scope') === nv);
            });
        });
    });
}

// --- MENU ACTIONS ---
window.resizeCanvas = function () {
    const em = window.EditorManager;
    const dialog = document.getElementById('effect-dialog');
    const win = document.getElementById('effect-dialog-window');
    const i18n = window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t.bind(window.IlluI18n) : null;

    if (em && em.activeProject && em.isPixelMode && em.activeProject.role !== 'layerAlphaMask') {
        const cw = em.activeProject.width;
        const ch = em.activeProject.height;
        const rs = illuReadResizeScope();
        const titleEl = document.getElementById('effect-dialog-title');
        if (titleEl) titleEl.textContent = i18n ? i18n('dlg.resizeImage') : "Redimensionner l'image";
        const wLab = i18n ? i18n('dlg.width') : 'Largeur :';
        const hLab = i18n ? i18n('dlg.height') : 'Hauteur :';
        const interpLab = i18n ? i18n('dlg.resizeInterp') : 'Interpolation :';
        const interpNear = i18n ? i18n('dlg.resizeNearest') : 'Plus proche voisin';
        const interpBi = i18n ? i18n('dlg.resizeBicubic') : 'Lissée (bicubique)';
        const interpLow = i18n ? i18n('dlg.resizeLow') : 'Lissée (moyenne)';
        const propLab = i18n ? i18n('dlg.resizeConstrain') : 'Conserver les proportions';
        const scopeLab = i18n ? i18n('dlg.resizeScopeLabel') : 'Appliquer à :';
        const scopeAll = i18n ? i18n('dlg.resizeScopeDoc') : 'Document (tous les calques)';
        const scopeAct = i18n ? i18n('dlg.resizeScopeLayer') : 'Calque actif seulement';
        document.getElementById('effect-dialog-content').innerHTML = `
            <div class="effect-scope-bar illu-effect-scope-bar field-row" style="flex-wrap:wrap;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #808080;font-size:11px;align-items:center;">
                <span data-i18n="dlg.resizeScopeLabel">${scopeLab}</span>
                <div class="illu-scope-btn-row" role="group">
                    <button type="button" class="illu-scope-btn illu-rz-scope-btn${rs === 'all' ? ' illu-scope-btn--active' : ''}" data-rz-scope="all">${scopeAll}</button>
                    <button type="button" class="illu-scope-btn illu-rz-scope-btn${rs === 'active' ? ' illu-scope-btn--active' : ''}" data-rz-scope="active">${scopeAct}</button>
                </div>
            </div>
            <div class="field-row"><label style="width: 90px;">${wLab}</label><input type="number" id="rz-w" min="1" value="${cw}" style="flex-grow:1;"> px</div>
            <div class="field-row" style="margin-top: 5px;"><label style="width: 90px;">${hLab}</label><input type="number" id="rz-h" min="1" value="${ch}" style="flex-grow:1;"> px</div>
            <div class="field-row" style="margin-top:8px;align-items:center;"><label><input type="checkbox" id="rz-proportions"> ${propLab}</label></div>
            <div class="field-row" style="margin-top:8px;"><label style="width:90px;">${interpLab}</label>
                <select id="rz-smooth" style="flex:1;min-width:0;">
                    <option value="bicubic">${interpBi}</option>
                    <option value="low">${interpLow}</option>
                    <option value="nearest">${interpNear}</option>
                </select>
            </div>
        `;
        illuBindResizeScopeBar(document.querySelector('#effect-dialog-content .effect-scope-bar'));
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(document.getElementById('effect-dialog-content'));
        }
        const rzW = document.getElementById('rz-w');
        const rzH = document.getElementById('rz-h');
        const rzProp = document.getElementById('rz-proportions');
        rzProp.checked = true;
        let baseRatio = cw / Math.max(1, ch);
        const syncHFromW = () => {
            if (!rzProp.checked) return;
            const w = parseInt(rzW.value, 10) || 1;
            rzH.value = Math.max(1, Math.round(w / baseRatio));
        };
        const syncWFromH = () => {
            if (!rzProp.checked) return;
            const h = parseInt(rzH.value, 10) || 1;
            rzW.value = Math.max(1, Math.round(h * baseRatio));
        };
        rzW.addEventListener('input', () => {
            if (rzProp.checked) syncHFromW();
            else baseRatio = (parseInt(rzW.value, 10) || 1) / Math.max(1, parseInt(rzH.value, 10) || 1);
        });
        rzH.addEventListener('input', () => {
            if (rzProp.checked) syncWFromH();
            else baseRatio = (parseInt(rzW.value, 10) || 1) / Math.max(1, parseInt(rzH.value, 10) || 1);
        });
        rzProp.addEventListener('change', () => {
            if (rzProp.checked) {
                baseRatio = cw / Math.max(1, ch);
                syncHFromW();
            }
        });
        if (win) {
            win.style.width = '340px';
        }
        illuSetEffectDialogFooterMode('resize');
    } else {
        const titleEl = document.getElementById('effect-dialog-title');
        if (titleEl) titleEl.textContent = i18n ? i18n('dlg.resizeImage') : "Redimensionner l'image";
        const wLab = i18n ? i18n('dlg.width') : 'Largeur :';
        const hLab = i18n ? i18n('dlg.height') : 'Hauteur :';
        document.getElementById('effect-dialog-content').innerHTML = `
            <div class="field-row"><label style="width: 70px;">${wLab}</label><input type="number" id="rz-w" value="${window.canvas.width}" style="flex-grow:1;"> px</div>
            <div class="field-row" style="margin-top: 5px;"><label style="width: 70px;">${hLab}</label><input type="number" id="rz-h" value="${window.canvas.height}" style="flex-grow:1;"> px</div>
            <p style="margin:8px 0 0;font-size:10px;opacity:.85;">${i18n ? i18n('dlg.resizeVectorHint') : 'Mode vecteur : redimensionne la toile affichée (comportement classique).'}</p>
        `;
        if (win) win.style.width = '300px';
        illuSetEffectDialogFooterMode('resize');
    }
    if (win) {
        win.classList.add('floating-window');
        win.style.position = 'fixed';
        const hasPos =
            (typeof window.applyEffectDialogSavedPosition === 'function' && window.applyEffectDialogSavedPosition(win)) ||
            (win.style.left &&
                String(win.style.left).trim() !== '' &&
                win.style.top &&
                String(win.style.top).trim() !== '');
        if (!hasPos) {
            const w = win.offsetWidth || 300;
            const h = win.offsetHeight || 160;
            win.style.left = Math.max(0, Math.round((window.innerWidth - w) / 2)) + 'px';
            win.style.top = Math.max(0, Math.round((window.innerHeight - h) / 2)) + 'px';
        }
        if (typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(win);
        }
    }
    dialog.style.display = 'block';
    document.body.classList.add('effect-dialog-open');
    if (typeof window.illuScheduleEffectDialogWorkspaceClamp === 'function') {
        window.illuScheduleEffectDialogWorkspaceClamp();
    }

    window.applyCurrentEffectModal = function () {
        const iw = parseInt(document.getElementById('rz-w').value, 10);
        const ih = parseInt(document.getElementById('rz-h').value, 10);
        if (iw > 0 && ih > 0) {
            if (em && em.activeProject && em.isPixelMode && em.activeProject.role !== 'layerAlphaMask') {
                const smoothEl = document.getElementById('rz-smooth');
                const smoothing = smoothEl ? smoothEl.value : 'bicubic';
                const scope = illuReadResizeScope();
                em.resizePixelWorkspace(iw, ih, { smoothing, scope });
            } else {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = window.canvas.width;
                tempCanvas.height = window.canvas.height;
                tempCanvas.getContext('2d', { willReadFrequently: true }).drawImage(window.canvas, 0, 0);

                window.canvas.width = iw;
                window.canvas.height = ih;
                window.svg.setAttribute('width', iw);
                window.svg.setAttribute('height', ih);
                window.svg.setAttribute('viewBox', `0 0 ${iw} ${ih}`);
                document.getElementById('main-canvas-container').style.width = iw + 'px';
                document.getElementById('main-canvas-container').style.height = ih + 'px';

                window.ctx.fillStyle = '#ffffff';
                window.ctx.fillRect(0, 0, iw, ih);
                window.ctx.drawImage(tempCanvas, 0, 0);
                window.EditorManager.saveHistory('Redimensionnement');
            }
        }
        dialog.style.display = 'none';
        document.body.classList.remove('effect-dialog-open');
        illuSetEffectDialogFooterMode('default');
        window.applyCurrentEffectModal = function () {
            window.FilterManager.apply();
        };
    };
};

window.showPixelTransformDialog = function () {
    const em = window.EditorManager;
    if (!em || !em.activeProject || !em.isPixelMode) {
        const msg =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('msg.pixelOnlyFlip')
                : 'Disponible uniquement en mode Pixel.';
        window.showIlluAlert(msg);
        return;
    }
    if (em.activeProject.role === 'layerAlphaMask') {
        const msg =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('msg.extendCanvasMask')
                : 'Ouvrez le document principal.';
        window.showIlluAlert(msg);
        return;
    }
    const dialog = document.getElementById('effect-dialog');
    const win = document.getElementById('effect-dialog-window');
    const i18n = window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t.bind(window.IlluI18n) : null;
    const titleEl = document.getElementById('effect-dialog-title');
    if (titleEl) titleEl.textContent = i18n ? i18n('dlg.transformTitle') : 'Rotation et retournement';
    const scope = illuReadEffectScope(); // Follow standard effect scope setting
    const scopeRow = `<div class="effect-scope-bar illu-effect-scope-bar field-row" style="flex-wrap:nowrap;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #808080;font-size:11px;align-items:stretch;">
            <span class="illu-scope-label" data-i18n="effect.scopeLabel" style="flex:0 0 auto;align-self:center;">${i18n ? i18n('effect.scopeLabel') : 'Portée :'}</span>
            <div class="illu-scope-btn-row" role="group">
                <button type="button" class="illu-scope-btn${scope === 'selection' ? ' illu-scope-btn--active' : ''}" data-scope="selection" data-i18n="effect.scopeSelection">${i18n ? i18n('effect.scopeSelection') : 'Sélection'}</button>
                <button type="button" class="illu-scope-btn${scope === 'active' ? ' illu-scope-btn--active' : ''}" data-scope="active" data-i18n="effect.scopeActive">${i18n ? i18n('effect.scopeActive') : 'Calque actif'}</button>
                <button type="button" class="illu-scope-btn${scope === 'all' ? ' illu-scope-btn--active' : ''}" data-scope="all" data-i18n="effect.scopeAll">${i18n ? i18n('effect.scopeAll') : 'Tous les calques'}</button>
            </div>
        </div>`;
    const b1 = i18n ? i18n('dlg.transformRotCw') : '90° horaire';
    const b2 = i18n ? i18n('dlg.transformRotCcw') : '90° antihoraire';
    const b3 = i18n ? i18n('dlg.transformFlipH') : 'Retourner H';
    const b4 = i18n ? i18n('dlg.transformFlipV') : 'Retourner V';
    document.getElementById('effect-dialog-content').innerHTML =
        scopeRow +
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
            <button type="button" class="tool-btn" id="pt-rot-cw" style="min-height:32px;">${b1}</button>
            <button type="button" class="tool-btn" id="pt-rot-ccw" style="min-height:32px;">${b2}</button>
            <button type="button" class="tool-btn" id="pt-flip-h" style="min-height:32px;">${b3}</button>
            <button type="button" class="tool-btn" id="pt-flip-v" style="min-height:32px;">${b4}</button>
        </div>
        <p style="margin:10px 0 0;font-size:10px;opacity:.88;">${i18n ? i18n('dlg.transformHint') : 'La rotation 90° sur la sélection nécessite une sélection rectangulaire.'}</p>`;
    illuBindScopeBar(document.querySelector('#effect-dialog-content .effect-scope-bar'));
    if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
        window.IlluI18n.apply(document.getElementById('effect-dialog-content'));
    }
    const readScope = () => {
        const a = document.querySelector('#effect-dialog-content .illu-scope-btn.illu-scope-btn--active[data-scope]');
        return (a && a.getAttribute('data-scope')) || 'active';
    };
    const run = (action) => {
        let sc = readScope();
        // Respect the selected scope in the dialog
        em.applyPixelGeomTransform(action, sc);
    };
    document.getElementById('pt-rot-cw').addEventListener('click', () => run('rot90cw'));
    document.getElementById('pt-rot-ccw').addEventListener('click', () => run('rot90ccw'));
    document.getElementById('pt-flip-h').addEventListener('click', () => run('flipH'));
    document.getElementById('pt-flip-v').addEventListener('click', () => run('flipV'));
    if (win) {
        win.classList.add('floating-window');
        win.style.position = 'fixed';
        win.style.width = '360px';
        const hasPos =
            (typeof window.applyEffectDialogSavedPosition === 'function' && window.applyEffectDialogSavedPosition(win)) ||
            (win.style.left &&
                String(win.style.left).trim() !== '' &&
                win.style.top &&
                String(win.style.top).trim() !== '');
        if (!hasPos) {
            const w = win.offsetWidth || 360;
            const h = win.offsetHeight || 220;
            win.style.left = Math.max(0, Math.round((window.innerWidth - w) / 2)) + 'px';
            win.style.top = Math.max(0, Math.round((window.innerHeight - h) / 2)) + 'px';
        }
        if (typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(win);
        }
    }
    illuSetEffectDialogFooterMode('transform');
    dialog.style.display = 'block';
    document.body.classList.add('effect-dialog-open');
    if (typeof window.illuScheduleEffectDialogWorkspaceClamp === 'function') {
        window.illuScheduleEffectDialogWorkspaceClamp();
    }
    if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
        window.IlluI18n.apply(document.getElementById('effect-dialog-window'));
    }
    window.applyCurrentEffectModal = function () {
        window.FilterManager.apply();
    };
};

window.flipCanvas = function (dir) {
    window.showPixelTransformDialog();
};

window.showExtendCanvasDialog = function () {
    const em = window.EditorManager;
    const p = em && em.activeProject;
    const okMode = p && (p.mode === 'vector' || em.isPixelMode);
    if (!em || !p || !okMode) {
        const msg =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('msg.extendCanvasPixel')
                : 'Disponible sur un document principal (Pixel ou Vecteur SVG).';
        window.showIlluAlert(msg);
        return;
    }
    if (em.activeProject.role === 'layerAlphaMask') {
        const msg =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('msg.extendCanvasMask')
                : 'Ouvrez le document principal pour étendre la toile.';
        window.showIlluAlert(msg);
        return;
    }
    const dialog = document.getElementById('effect-dialog');
    const win = document.getElementById('effect-dialog-window');
    const i18n = window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t.bind(window.IlluI18n) : null;
    const titleEl = document.getElementById('effect-dialog-title');
    if (titleEl) titleEl.textContent = i18n ? i18n('dlg.extendWork') : 'Étendre la zone de travail';
    const hint = i18n ? i18n('dlg.extendWorkHint') : 'Marges (px) :';
    const lt = i18n ? i18n('dlg.extendTop') : 'Haut';
    const ll = i18n ? i18n('dlg.extendLeft') : 'Gauche';
    const lr = i18n ? i18n('dlg.extendRight') : 'Droite';
    const lb = i18n ? i18n('dlg.extendBottom') : 'Bas';
    document.getElementById('effect-dialog-content').innerHTML = `
        <p style="margin:0 0 8px;font-size:11px;">${hint}</p>
        <div class="field-row"><label style="width:70px;">${lt}</label><input type="number" id="ex-mt" value="0" min="0" style="flex:1;"> px</div>
        <div class="field-row" style="margin-top:4px;"><label style="width:70px;">${ll}</label><input type="number" id="ex-ml" value="0" min="0" style="flex:1;"> px</div>
        <div class="field-row" style="margin-top:4px;"><label style="width:70px;">${lr}</label><input type="number" id="ex-mr" value="0" min="0" style="flex:1;"> px</div>
        <div class="field-row" style="margin-top:4px;"><label style="width:70px;">${lb}</label><input type="number" id="ex-mb" value="0" min="0" style="flex:1;"> px</div>
    `;
    if (win) {
        win.classList.add('floating-window');
        win.style.position = 'fixed';
        win.style.width = '320px';
        const hasPos =
            (typeof window.applyEffectDialogSavedPosition === 'function' && window.applyEffectDialogSavedPosition(win)) ||
            (win.style.left &&
                String(win.style.left).trim() !== '' &&
                win.style.top &&
                String(win.style.top).trim() !== '');
        if (!hasPos) {
            const w = win.offsetWidth || 320;
            const h = win.offsetHeight || 200;
            win.style.left = Math.max(0, Math.round((window.innerWidth - w) / 2)) + 'px';
            win.style.top = Math.max(0, Math.round((window.innerHeight - h) / 2)) + 'px';
        }
        if (typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(win);
        }
    }
    dialog.style.display = 'block';
    document.body.classList.add('effect-dialog-open');
    if (typeof window.illuScheduleEffectDialogWorkspaceClamp === 'function') {
        window.illuScheduleEffectDialogWorkspaceClamp();
    }

    window.applyCurrentEffectModal = function () {
        const mt = parseInt(document.getElementById('ex-mt')?.value, 10) || 0;
        const ml = parseInt(document.getElementById('ex-ml')?.value, 10) || 0;
        const mr = parseInt(document.getElementById('ex-mr')?.value, 10) || 0;
        const mb = parseInt(document.getElementById('ex-mb')?.value, 10) || 0;
        if (mt + ml + mr + mb > 0) {
            em.extendDocumentMargins(ml, mt, mr, mb);
        }
        dialog.style.display = 'none';
        document.body.classList.remove('effect-dialog-open');
        window.applyCurrentEffectModal = function () {
            window.FilterManager.apply();
        };
    };
};

window.showContentAwareFillDialog = function () {
    const em = window.EditorManager;
    const t = window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t.bind(window.IlluI18n) : null;
    const alertMsg = (key, fallback) => (t ? t(key) : fallback);

    if (!em || !em.activeProject || !em.isPixelMode) {
        window.showIlluAlert(alertMsg('msg.cafPixel', 'Disponible sur un document en mode Pixel.'));
        return;
    }
    if (em.activeProject.role === 'layerAlphaMask') {
        window.showIlluAlert(alertMsg('msg.cafMask', 'Ouvrez le document principal pour utiliser cette commande.'));
        return;
    }
    const ov = document.getElementById('selection-overlay');
    if (!ov || ov.style.display === 'none' || !window.selectionBounds) {
        window.showIlluAlert(alertMsg('msg.cafNoSelection', 'Tracez une sélection pixel non vide.'));
        return;
    }
    if (window.selectionInverted) {
        window.showIlluAlert(alertMsg('msg.cafInverted', 'Désactivez l’inversion de sélection pour le remplissage contenu.'));
        return;
    }
    const l = em.activeLayer;
    if (!l || !l.buffer) {
        window.showIlluAlert(alertMsg('msg.cafNoLayer', 'Le calque actif doit contenir une image bitmap.'));
        return;
    }
    const mask =
        typeof window.rasterizeCurrentSelectionToLayerMask === 'function'
            ? window.rasterizeCurrentSelectionToLayerMask()
            : null;
    const lw = l.buffer.width;
    const lh = l.buffer.height;
    let anySel = false;
    if (mask && mask.length === lw * lh) {
        for (let i = 0; i < mask.length; i++) {
            if (mask[i]) {
                anySel = true;
                break;
            }
        }
    }
    if (!anySel) {
        window.showIlluAlert(alertMsg('msg.cafNoSelection', 'Tracez une sélection pixel non vide.'));
        return;
    }

    const dialog = document.getElementById('effect-dialog');
    const win = document.getElementById('effect-dialog-window');
    const titleEl = document.getElementById('effect-dialog-title');
    illuSetEffectDialogFooterMode('resize');
    if (titleEl) titleEl.textContent = t ? t('dlg.cafTitle') : 'Remplir (contenu pris en compte)';

    const hint = t ? t('dlg.cafHint') : '';
    const blendHint = t ? t('dlg.cafBlendHint') : '';
    const labExpand = t ? t('dlg.cafExpand') : 'Extension de la sélection';
    const labBlend = t ? (t('dlg.cafBlend') || t('dlg.cafOpacity')) : 'Intensité du remplissage';
    const labPreserve = t ? t('dlg.cafPreserve') : 'Conserver la transparence';
    const labMode = t ? t('dlg.cafMode') : 'Mode';
    const labNormal = t ? t('dlg.cafModeNormal') : 'Normal';

    document.getElementById('effect-dialog-content').innerHTML = `
        <p style="margin:0 0 8px;font-size:11px;opacity:0.9;line-height:1.35;">Sélectionner une zone, puis appliquer pour la remplir intelligemment par clonage de texture.</p>
        <div class="field-row" style="align-items:center;">
            <label style="width:130px;flex-shrink:0;" title="Élargit la sélection avant le remplissage pour mieux couvrir les bords">${labExpand}</label>
            <input type="range" id="caf-expand-range" min="0" max="64" value="4" style="flex:1;min-width:0;">
            <input type="number" id="caf-expand" value="4" min="0" max="64" style="width:46px;margin-left:8px;">
            <span style="margin-left:4px;font-size:11px;">px</span>
        </div>
        <div class="field-row" style="margin-top:8px;align-items:center;">
            <label style="width:130px;flex-shrink:0;" title="Fondu progressif sur le bord de la sélection : 0 = bord net, valeur haute = fondu large">Fondu de bord (innerRadius)</label>
            <input type="range" id="caf-inner-range" min="0" max="80" value="8" style="flex:1;min-width:0;">
            <input type="number" id="caf-inner" value="8" min="0" max="80" style="width:46px;margin-left:8px;">
            <span style="margin-left:4px;font-size:11px;">px</span>
        </div>
        <div class="field-row" style="margin-top:8px;align-items:center;">
            <label style="width:130px;flex-shrink:0;">${labBlend}</label>
            <input type="range" id="caf-opacity-range" min="0" max="100" value="100" style="flex:1;min-width:0;">
            <input type="number" id="caf-opacity" value="100" min="0" max="100" style="width:46px;margin-left:8px;">
            <span style="margin-left:4px;font-size:11px;">%</span>
        </div>
        <div class="field-row" style="margin-top:8px;">
            <label style="width:130px;flex-shrink:0;">${labMode}</label>
            <select id="caf-mode" style="flex:1;">
                <option value="texture" selected>Texture (clonage PatchMatch)</option>
                <option value="stretch">Dégradé (rapide, zones unies)</option>
            </select>
        </div>
        <div class="field-row" style="margin-top:8px;">
            <label style="flex:1;display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="caf-preserve">
                <span>${labPreserve}</span>
            </label>
        </div>
        <p style="margin:8px 0 0;font-size:10px;opacity:0.7;line-height:1.3;">Fondu de bord : les pixels au bord de la sélection sont progressivement mélangés avec l'original sur la distance indiquée.</p>
    `;

    const exR = document.getElementById('caf-expand-range');
    const exN = document.getElementById('caf-expand');
    const opR = document.getElementById('caf-opacity-range');
    const opN = document.getElementById('caf-opacity');
    function syncEx() {
        if (!exR || !exN) return;
        let v = parseInt(exN.value, 10);
        if (!Number.isFinite(v)) v = 0;
        v = Math.max(0, Math.min(128, v));
        exN.value = String(v);
        const rv = Math.min(128, v);
        if (parseInt(exR.value, 10) !== rv) exR.value = String(rv);

        // Visual expansion preview
        window.selectionExpansionPreviewPx = v;
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
    }
    function syncExFromRange() {
        if (!exR || !exN) return;
        exN.value = exR.value;
        syncEx();
    }
    exR.addEventListener('input', syncExFromRange);
    exN.addEventListener('input', syncEx);
    syncEx();
    const irR = document.getElementById('caf-inner-range');
    const irN = document.getElementById('caf-inner');
    function syncIr() {
        if (!irR || !irN) return;
        let v = parseInt(irN.value, 10);
        if (!Number.isFinite(v)) v = 0;
        v = Math.max(0, Math.min(80, v));
        irN.value = String(v);
        if (parseInt(irR.value, 10) !== v) irR.value = String(v);
    }
    function syncIrFromRange() { if (!irR || !irN) return; irN.value = irR.value; syncIr(); }
    if (irR) irR.addEventListener('input', syncIrFromRange);
    if (irN) irN.addEventListener('input', syncIr);

    function syncOp() {
        if (!opR || !opN) return;
        let v = parseInt(opN.value, 10);
        if (!Number.isFinite(v)) v = 100;
        v = Math.max(0, Math.min(100, v));
        opN.value = String(v);
        if (parseInt(opR.value, 10) !== v) opR.value = String(v);
    }
    function syncOpFromRange() {
        if (!opR || !opN) return;
        opN.value = opR.value;
        syncOp();
    }
    opR.addEventListener('input', syncOpFromRange);
    opN.addEventListener('input', syncOp);
    syncOp();

    if (win) {
        win.classList.add('floating-window');
        win.style.position = 'fixed';
        win.style.width = '360px';
        const hasPos =
            (typeof window.applyEffectDialogSavedPosition === 'function' && window.applyEffectDialogSavedPosition(win)) ||
            (win.style.left &&
                String(win.style.left).trim() !== '' &&
                win.style.top &&
                String(win.style.top).trim() !== '');
        if (!hasPos) {
            const wpx = win.offsetWidth || 360;
            const hpx = win.offsetHeight || 280;
            win.style.left = Math.max(0, Math.round((window.innerWidth - wpx) / 2)) + 'px';
            win.style.top = Math.max(0, Math.round((window.innerHeight - hpx) / 2)) + 'px';
        }
        if (typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(win);
        }
    }
    dialog.style.display = 'block';
    document.body.classList.add('effect-dialog-open');
    if (typeof window.illuScheduleEffectDialogWorkspaceClamp === 'function') {
        window.illuScheduleEffectDialogWorkspaceClamp();
    }
    if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
        window.IlluI18n.apply(document.getElementById('effect-dialog-window'));
    }

    window.applyCurrentEffectModal = async function () {
        const btnOk = document.getElementById('effect-dialog-btn-ok');
        if (btnOk) btnOk.disabled = true;
        try {
            syncEx();
            syncOp();
            const expandPx = parseInt(document.getElementById('caf-expand')?.value, 10) || 0;
            const opacity = parseInt(document.getElementById('caf-opacity')?.value, 10);
            const opacityPct = Number.isFinite(opacity) ? opacity : 100;
            const preserve = !!document.getElementById('caf-preserve')?.checked;
            if (typeof window.applyContentAwareFillAsync !== 'function') {
                window.showIlluAlert(alertMsg('msg.cafFailed', 'Impossible d’appliquer le remplissage.'));
                return;
            }
            const innerRadius = parseInt(document.getElementById('caf-inner')?.value, 10) || 0;
            let ok = false;
            try {
                ok = await window.applyContentAwareFillAsync({
                    expandPx,
                    opacity: opacityPct,
                    preserveTransparency: preserve,
                    innerRadius: Math.max(0, Math.min(80, innerRadius)),
                    mode: document.getElementById('caf-mode')?.value || 'texture'
                });
            } catch (err) {
                console.warn(err);
                ok = false;
            }
            if (!ok) {
                window.showIlluAlert(
                    alertMsg(
                        'msg.cafFailed',
                        'Impossible d’appliquer le remplissage (worker/OpenCV indisponible ou traitement trop long).'
                    )
                );
            } else {
                const hist = t ? t('history.caf') : 'Remplissage contenu pris en compte';
                em.saveHistory(hist, { patchActiveLayer: true });
                em.render({ flushUiThumbnails: true });
            }
        } finally {
            if (btnOk) btnOk.disabled = false;
            dialog.style.display = 'none';
            document.body.classList.remove('effect-dialog-open');
            window.selectionExpansionPreviewPx = 0;
            if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
            window.applyCurrentEffectModal = function () {
                window.FilterManager.apply();
            };
        }
    };
};

const ILLU_UI_LAYOUT_KEY = 'illu_ui_layout';
const ILLU_EFFECT_DIALOG_POS_KEY = 'illu_effect_dialog_pos';
const ILLU_PALETTE_WINDOWS_POS_KEY = 'illu_palette_windows_pos';
const ILLU_FLOATING_PALETTE_VIS_KEY = 'illu_floating_palette_visibility';
const ILLU_PDN_OPEN_KEY = 'illu_pdn_slot_open';

const PALETTE_WINDOW_IDS = ['win-tools', 'win-colors', 'win-layers', 'win-history', 'win-svg-objects'];
/** Mode téléphone + dock bas : seules ces palettes ont un emplacement repliable en bas (les outils sont sous les onglets). */
const ILLU_PDN_BOTTOM_SLOT_IDS = ['win-colors', 'win-layers', 'win-history'];

/** Palettes repliables : mode flottant classique ou mode téléphone (dock bas, mêmes clés localStorage). */
function illuIsFloatingOrPhonePaletteMode() {
    if (typeof window.getUILayoutMode !== 'function') return false;
    const m = window.getUILayoutMode();
    return m === 'floating' || m === 'phone';
}

/** Retire l’ancien compensateur JS (padding-top sur #editor-dock-row + position:fixed sur #win-tools). */
function illuDisconnectMobileToolsToolbarLayout() {
    const row = document.getElementById('editor-dock-row');
    if (row) row.style.removeProperty('padding-top');
    const tools = document.getElementById('win-tools');
    if (tools) {
        tools.style.removeProperty('position');
        tools.style.removeProperty('left');
        tools.style.removeProperty('right');
        tools.style.removeProperty('top');
        tools.style.removeProperty('z-index');
        tools.style.removeProperty('zIndex');
    }
    const th = document.getElementById('illu-mobile-toolbar-host');
    if (th && !th.querySelector('#win-tools')) {
        th.setAttribute('aria-hidden', 'true');
    }
}

/** Restaure left/top de la fenêtre modale (effets, redimensionner, étendre) depuis le stockage local. */
window.applyEffectDialogSavedPosition = function (win) {
    if (!win) return false;
    try {
        const raw = localStorage.getItem(ILLU_EFFECT_DIALOG_POS_KEY);
        if (!raw) return false;
        const p = JSON.parse(raw);
        if (p && p.left && p.top) {
            win.style.left = String(p.left);
            win.style.top = String(p.top);
            win.style.bottom = 'auto';
            win.style.right = 'auto';
            return true;
        }
    } catch (e) {
        /* ignore */
    }
    return false;
};

window.saveEffectDialogPosition = function (win) {
    if (!win) return;
    const l = win.style.left;
    const t = win.style.top;
    if (l && t && String(l).trim() !== '' && String(t).trim() !== '') {
        try {
            localStorage.setItem(
                ILLU_EFFECT_DIALOG_POS_KEY,
                JSON.stringify({ left: l, top: t })
            );
        } catch (e) {
            /* ignore */
        }
    }
};

/** Après positionnement (centrage ou sauvegarde), garde `#effect-dialog-window` dans `.workspace-dock-center`. */
window.illuScheduleEffectDialogWorkspaceClamp = function () {
    const win = document.getElementById('effect-dialog-window');
    if (!win) return;
    const run = () => {
        if (typeof window.clampIlluFloatingWindowToWorkspace === 'function') {
            window.clampIlluFloatingWindowToWorkspace(win, 5);
        }
    };
    requestAnimationFrame(() => {
        run();
        requestAnimationFrame(run);
    });
};

function readPaletteWindowsPosMap() {
    try {
        const s = localStorage.getItem(ILLU_PALETTE_WINDOWS_POS_KEY);
        if (!s) return {};
        const o = JSON.parse(s);
        return o && typeof o === 'object' ? o : {};
    } catch (e) {
        return {};
    }
}

function writePaletteWindowsPosMap(map) {
    try {
        localStorage.setItem(ILLU_PALETTE_WINDOWS_POS_KEY, JSON.stringify(map));
    } catch (e) {
        /* ignore */
    }
}

/** True si l’utilisateur a déjà enregistré au moins une position de palette (évite d’écraser au changement d’onglets). */
window.illuPalettePositionsSaved = function () {
    const m = readPaletteWindowsPosMap();
    return PALETTE_WINDOW_IDS.some((id) => m[id] && typeof m[id] === 'object');
};

window.applySavedFloatingPalettePositions = function () {
    const map = readPaletteWindowsPosMap();
    const keys = ['left', 'top', 'right', 'bottom', 'width', 'maxWidth'];
    PALETTE_WINDOW_IDS.forEach((id) => {
        const el = document.getElementById(id);
        const pos = map[id];
        if (!el) return;

        if (id === 'win-history') {
            el.style.width = '200px';
            el.style.minWidth = '200px';
            el.style.maxWidth = '200px';
        }

        if (!pos || typeof pos !== 'object') return;

        // Reset all before applying saved ones to avoid conflicts (e.g. top + bottom)
        el.style.top = 'auto';
        el.style.bottom = 'auto';
        el.style.left = 'auto';
        el.style.right = 'auto';

        keys.forEach((k) => {
            if (id === 'win-history' && (k === 'width' || k === 'maxWidth')) return;
            const v = pos[k];
            if (v != null && String(v).trim() !== '' && v !== 'auto') el.style[k] = String(v);
        });

        if (id === 'win-history') {
            el.style.width = '200px';
            el.style.minWidth = '200px';
            el.style.maxWidth = '200px';
        }
    });
};

window.saveIlluWindowPositionAfterDrag = function (win) {
    if (!win || !win.id) return;
    if (document.body.classList.contains('illu-pdn-dock-active') && PALETTE_WINDOW_IDS.includes(win.id)) {
        return;
    }
    if (win.id === 'effect-dialog-window') {
        window.saveEffectDialogPosition(win);
        return;
    }
    if (!PALETTE_WINDOW_IDS.includes(win.id)) return;
    const o = {};
    ['left', 'top', 'right', 'bottom', 'width', 'maxWidth'].forEach((k) => {
        if (win.id === 'win-history' && (k === 'width' || k === 'maxWidth')) return;
        const v = win.style[k];
        if (v != null && String(v).trim() !== '' && v !== 'auto') o[k] = v;
    });
    if (Object.keys(o).length === 0) return;
    const map = readPaletteWindowsPosMap();
    map[win.id] = o;
    writePaletteWindowsPosMap(map);
};

function readFloatingPaletteVisibilityMap() {
    try {
        const s = localStorage.getItem(ILLU_FLOATING_PALETTE_VIS_KEY);
        if (!s) return {};
        const o = JSON.parse(s);
        return o && typeof o === 'object' ? o : {};
    } catch (e) {
        return {};
    }
}

function readPdnOpenMap() {
    try {
        const s = localStorage.getItem(ILLU_PDN_OPEN_KEY);
        if (!s) return {};
        const o = JSON.parse(s);
        return o && typeof o === 'object' ? o : {};
    } catch (e) {
        return {};
    }
}

function writePdnOpenMap(map) {
    try {
        localStorage.setItem(ILLU_PDN_OPEN_KEY, JSON.stringify(map));
    } catch (e) {
        /* ignore */
    }
}

window.illuPdnRefreshTabAria = function () {
    if (!document.body.classList.contains('illu-pdn-dock-active')) return;
    PALETTE_WINDOW_IDS.forEach((id) => {
        const tab = document.querySelector(`[data-illu-pdn-tab="${id}"]`);
        const slot = document.querySelector(`.illu-pdn-slot[data-illu-pdn-slot="${id}"]`);
        if (!tab) return;
        const open = !!(slot && slot.classList.contains('illu-pdn-slot--open'));
        tab.setAttribute('aria-pressed', open ? 'true' : 'false');
        // Ajout de la classe active pour le style visuelle (enfoncé)
        tab.classList.toggle('illu-pdn-tab--active', open);
    });
};

window.illuPdnPersistOpen = function (id, open) {
    const map = readPdnOpenMap();
    if (open) {
        PALETTE_WINDOW_IDS.forEach((oid) => {
            if (oid !== id) delete map[oid];
        });
        map[id] = true;
    } else {
        delete map[id];
    }
    writePdnOpenMap(map);
};

function illuPdnEnsureTabDelegation(host) {
    if (!host || host.dataset.illuPdnTabBound === '1') return;
    host.dataset.illuPdnTabBound = '1';
    host.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-illu-pdn-tab]');
        if (!tab) return;
        e.preventDefault();
        const id = tab.getAttribute('data-illu-pdn-tab');
        if (id && typeof window.illuPdnToggleSlot === 'function') window.illuPdnToggleSlot(id);
    });
}

/**
 * Mode téléphone : les 3 languettes Couleurs / Calques / Historique regroupées à droite (Outils restent en barre du haut).
 * Mode flottant classique : restaure gauche Outils+Couleurs, droite Historique+Calques.
 */
function illuPdnArrangeEdgeTabsForPhone(phoneLayout) {
    const strip = document.querySelector('.illu-pdn-edge-strip');
    if (!strip) return;
    const left = strip.querySelector('.illu-pdn-edge--left');
    const right = strip.querySelector('.illu-pdn-edge--right');
    if (!left || !right) return;
    const toolsBtn = strip.querySelector('[data-illu-pdn-tab="win-tools"]');
    const colorsBtn = strip.querySelector('[data-illu-pdn-tab="win-colors"]');
    const histBtn = strip.querySelector('[data-illu-pdn-tab="win-history"]');
    const layersBtn = strip.querySelector('[data-illu-pdn-tab="win-layers"]');
    if (!toolsBtn || !colorsBtn || !histBtn || !layersBtn) return;

    if (phoneLayout) {
        if (toolsBtn.parentNode !== left) left.insertBefore(toolsBtn, left.firstChild);
        right.appendChild(colorsBtn);
        right.appendChild(layersBtn);
        right.appendChild(histBtn);
    } else {
        left.appendChild(toolsBtn);
        left.appendChild(colorsBtn);
        right.appendChild(histBtn);
        right.appendChild(layersBtn);
    }
    if (typeof window.illuPdnRefreshTabAria === 'function') window.illuPdnRefreshTabAria();
}

window.illuPdnToggleSlot = function (id) {
    if (!PALETTE_WINDOW_IDS.includes(id)) return;
    if (!document.body.classList.contains('illu-pdn-dock-active')) return;
    const slot = document.querySelector(`.illu-pdn-slot[data-illu-pdn-slot="${id}"]`);
    if (!slot) return;
    const win = document.getElementById(id);
    const wasOpen = slot.classList.contains('illu-pdn-slot--open');
    if (wasOpen) {
        slot.classList.remove('illu-pdn-slot--open');
        window.illuPdnPersistOpen(id, false);
    } else {
        if (win && win.classList.contains('illu-floating-window-hidden')) {
            const map = readFloatingPaletteVisibilityMap();
            map[id] = true;
            try {
                localStorage.setItem(ILLU_FLOATING_PALETTE_VIS_KEY, JSON.stringify(map));
            } catch (e) {
                /* ignore */
            }
            window.applyFloatingPaletteVisibility();
            if (typeof window.refreshFloatingPaletteMenuLabels === 'function') {
                window.refreshFloatingPaletteMenuLabels();
            }
        }
        document.querySelectorAll('.illu-pdn-slot--open').forEach((s) => {
            const oid = s.getAttribute('data-illu-pdn-slot');
            if (oid === id) return;
            s.classList.remove('illu-pdn-slot--open');
        });
        slot.classList.add('illu-pdn-slot--open');
        window.illuPdnPersistOpen(id, true);
        if (win && typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(win);
        }
    }
    window.illuPdnRefreshTabAria();
};

/** Ouvre une palette (tiroir mobile / raccourci) sans basculer si déjà seule ouverte. */
window.illuPdnRevealPalette = function (id) {
    if (!PALETTE_WINDOW_IDS.includes(id)) return;
    if (!document.body.classList.contains('illu-pdn-dock-active')) return;
    if (id === 'win-tools') {
        window.illuPdnRefreshTabAria();
        return;
    }
    const slot = document.querySelector(`.illu-pdn-slot[data-illu-pdn-slot="${id}"]`);
    if (!slot) return;
    const win = document.getElementById(id);
    if (win && win.classList.contains('illu-floating-window-hidden')) {
        const map = readFloatingPaletteVisibilityMap();
        map[id] = true;
        try {
            localStorage.setItem(ILLU_FLOATING_PALETTE_VIS_KEY, JSON.stringify(map));
        } catch (e) {
            /* ignore */
        }
        window.applyFloatingPaletteVisibility();
        if (typeof window.refreshFloatingPaletteMenuLabels === 'function') {
            window.refreshFloatingPaletteMenuLabels();
        }
    }
    document.querySelectorAll('.illu-pdn-slot--open').forEach((s) => {
        s.classList.remove('illu-pdn-slot--open');
    });
    slot.classList.add('illu-pdn-slot--open');
    window.illuPdnPersistOpen(id, true);
    window.illuPdnRefreshTabAria();
    if (win && typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
        window.WindowManager.bringToFront(win);
    }
};

function illuPdnApplyOpenClassesFromStorage() {
    const map = readPdnOpenMap();
    let chosen = null;
    ILLU_PDN_BOTTOM_SLOT_IDS.forEach((pid) => {
        if (map[pid] === true && !chosen) chosen = pid;
    });
    ILLU_PDN_BOTTOM_SLOT_IDS.forEach((id) => {
        const slot = document.querySelector(`.illu-pdn-slot[data-illu-pdn-slot="${id}"]`);
        if (!slot) return;
        slot.classList.toggle('illu-pdn-slot--open', id === chosen);
    });
    if (chosen) {
        writePdnOpenMap({ [chosen]: true });
    } else {
        writePdnOpenMap({});
    }
    window.illuPdnRefreshTabAria();
}

/** Repositionne une palette flottante pour rester dans `.workspace-dock-center` (coords viewport). */
window.clampIlluFloatingWindowToWorkspace = function (win, pad) {
    if (document.body.classList.contains('illu-pdn-dock-active')) return;
    const p = pad != null ? pad : 5;
    if (!win) return;
    const ws = document.getElementById('workspace');
    if (!ws) return;
    const wr = ws.getBoundingClientRect();
    const minL = wr.left + p;
    const minT = wr.top + p;
    const br = win.getBoundingClientRect();
    const w = br.width;
    const h = br.height;
    const maxL = wr.right - w - p;
    const maxT = wr.bottom - h - p;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 8 || h < 8) return;
    /* Fenêtre plus large/haute que la zone : on colle au bord haut-gauche du workspace. */
    const nl = maxL < minL ? minL : Math.max(minL, Math.min(maxL, br.left));
    const nt = maxT < minT ? minT : Math.max(minT, Math.min(maxT, br.top));
    if (Math.abs(nl - br.left) > 0.5 || Math.abs(nt - br.top) > 0.5) {
        win.style.left = `${Math.round(nl)}px`;
        win.style.top = `${Math.round(nt)}px`;
        win.style.right = 'auto';
        win.style.bottom = 'auto';
    }
};

window.illuClampAllFloatingPalettes = function () {
    const ed = document.getElementById('effect-dialog-window');
    const shell = document.getElementById('effect-dialog');
    if (
        ed &&
        shell &&
        shell.style.display !== 'none' &&
        document.body.classList.contains('effect-dialog-open') &&
        typeof window.clampIlluFloatingWindowToWorkspace === 'function'
    ) {
        window.clampIlluFloatingWindowToWorkspace(ed, 5);
    }
    if (typeof window.getUILayoutMode !== 'function' || window.getUILayoutMode() !== 'floating') return;
    if (document.body.classList.contains('illu-pdn-dock-active')) return;
    PALETTE_WINDOW_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('illu-floating-window-hidden')) {
            window.clampIlluFloatingWindowToWorkspace(el, 5);
        }
    });
};

window.applyFloatingPaletteVisibility = function () {
    if (document.body.classList.contains('illu-mobile-shell-active')) {
        const activeSheet =
            typeof window.illuMobileGetOpenSheetId === 'function' ? window.illuMobileGetOpenSheetId() : null;
        const sheetToPanel = {
            tools: 'win-tools',
            colors: 'win-colors',
            layers: 'win-layers',
            history: 'win-history'
        };
        const openPanelId = activeSheet ? sheetToPanel[activeSheet] : null;
        PALETTE_WINDOW_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle('illu-floating-window-hidden', id !== openPanelId);
        });
        if (typeof window.illuPdnRefreshTabAria === 'function') window.illuPdnRefreshTabAria();
        return;
    }
    const map = readFloatingPaletteVisibilityMap();
    const isVector = typeof EditorManager !== 'undefined' && !EditorManager.isPixelMode;
    PALETTE_WINDOW_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === 'win-svg-objects' && !isVector) {
            el.classList.add('illu-floating-window-hidden');
            return;
        }
        const vis = map[id] !== false;
        el.classList.toggle('illu-floating-window-hidden', !vis);
    });
    if (
        document.body.classList.contains('illu-mobile-ui') &&
        document.body.classList.contains('illu-pdn-dock-active')
    ) {
        const tools = document.getElementById('win-tools');
        if (tools) tools.classList.remove('illu-floating-window-hidden');
    }
    if (typeof window.illuPdnRefreshTabAria === 'function') window.illuPdnRefreshTabAria();
};

/**
 * Amène une palette à l’écran (mobile / tiroir) : affiche la fenêtre flottante si besoin,
 * ouvre les panneaux rail Photoshop (curseurs / historique) et fait défiler jusqu’à la fenêtre.
 */
window.illuFocusPaletteForMobile = function (id) {
    if (!PALETTE_WINDOW_IDS.includes(id)) return;
    const mode = window.getUILayoutMode();
    if (mode === 'floating') {
        const map = readFloatingPaletteVisibilityMap();
        map[id] = true;
        try {
            localStorage.setItem(ILLU_FLOATING_PALETTE_VIS_KEY, JSON.stringify(map));
        } catch (e) {
            /* ignore */
        }
        window.applyFloatingPaletteVisibility();
        window.refreshFloatingPaletteMenuLabels();
        if (typeof window.illuClampAllFloatingPalettes === 'function') window.illuClampAllFloatingPalettes();
    }
    if (mode === 'phone') {
        const slot = document.querySelector(`.illu-pdn-slot[data-illu-pdn-slot="${id}"]`);
        const isCurrentlyOpen = slot && slot.classList.contains('illu-pdn-slot--open');

        if (isCurrentlyOpen) {
            // Si déjà ouvert sur mobile, on le ferme (Toggle)
            if (typeof window.illuPdnToggleSlot === 'function') {
                window.illuPdnToggleSlot(id);
            }
        } else {
            const map = readFloatingPaletteVisibilityMap();
            map[id] = true;
            try {
                localStorage.setItem(ILLU_FLOATING_PALETTE_VIS_KEY, JSON.stringify(map));
            } catch (e) {
                /* ignore */
            }
            window.applyFloatingPaletteVisibility();
            window.refreshFloatingPaletteMenuLabels();
            if (typeof window.illuPdnRevealPalette === 'function') window.illuPdnRevealPalette(id);
        }
    }
    if (mode === 'photoshop') {
        if (id === 'win-history') {
            const hostH = document.getElementById('dock-rail-history-host');
            if (hostH && hostH.hasAttribute('hidden') && typeof window.illuToggleDockRailPanel === 'function') {
                window.illuToggleDockRailPanel('history');
            }
        }
        if (id === 'win-colors') {
            const hostS = document.getElementById('dock-rail-sliders-host');
            if (hostS && hostS.hasAttribute('hidden') && typeof window.illuToggleDockRailPanel === 'function') {
                window.illuToggleDockRailPanel('sliders');
            }
        }
        if (typeof window.illuUpdateDockRailVisibility === 'function') window.illuUpdateDockRailVisibility();
    }
    const el = document.getElementById(id);
    if (el) {
        requestAnimationFrame(() => {
            try {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            } catch (e2) {
                el.scrollIntoView();
            }
        });
    }
};

window.toggleFloatingPaletteVisibility = function (id) {
    if (!PALETTE_WINDOW_IDS.includes(id)) return;
    if (!illuIsFloatingOrPhonePaletteMode()) return;
    const el = document.getElementById(id);
    if (!el) return;
    const map = readFloatingPaletteVisibilityMap();
    const cur = map[id] !== false;
    map[id] = !cur;
    try {
        localStorage.setItem(ILLU_FLOATING_PALETTE_VIS_KEY, JSON.stringify(map));
    } catch (e) {
        /* ignore */
    }
    if (document.body.classList.contains('illu-pdn-dock-active') && map[id] === false) {
        const slot = document.querySelector(`.illu-pdn-slot[data-illu-pdn-slot="${id}"]`);
        if (slot) {
            slot.classList.remove('illu-pdn-slot--open');
            if (typeof window.illuPdnPersistOpen === 'function') window.illuPdnPersistOpen(id, false);
        }
    }
    window.applyFloatingPaletteVisibility();
    window.refreshFloatingPaletteMenuLabels();
    if (typeof window.illuClampAllFloatingPalettes === 'function') window.illuClampAllFloatingPalettes();
};

/** Masque une palette flottante (bouton × comme la fenêtre d’effets). Sans effet en mode Photoshop / docké. */
window.hideFloatingPalette = function (id) {
    if (!PALETTE_WINDOW_IDS.includes(id)) return;
    if (!illuIsFloatingOrPhonePaletteMode()) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (document.body.classList.contains('illu-pdn-dock-active')) {
        const slot = document.querySelector(`.illu-pdn-slot[data-illu-pdn-slot="${id}"]`);
        if (slot) {
            slot.classList.remove('illu-pdn-slot--open');
            if (typeof window.illuPdnPersistOpen === 'function') window.illuPdnPersistOpen(id, false);
        }
    }
    const map = readFloatingPaletteVisibilityMap();
    map[id] = false;
    try {
        localStorage.setItem(ILLU_FLOATING_PALETTE_VIS_KEY, JSON.stringify(map));
    } catch (e) {
        /* ignore */
    }
    window.applyFloatingPaletteVisibility();
    window.refreshFloatingPaletteMenuLabels();
    if (typeof window.illuClampAllFloatingPalettes === 'function') window.illuClampAllFloatingPalettes();
};

window.refreshFloatingPaletteMenuLabels = function () {
    const map = readFloatingPaletteVisibilityMap();
    const rows = [
        { id: 'win-tools', el: 'menu-win-tools-check' },
        { id: 'win-colors', el: 'menu-win-colors-check' },
        { id: 'win-layers', el: 'menu-win-layers-check' },
        { id: 'win-history', el: 'menu-win-history-check' },
        { id: 'win-svg-objects', el: 'menu-win-svg-objects-check' }
    ];
    rows.forEach((r) => {
        const check = document.getElementById(r.el);
        if (!check) return;
        const vis = map[r.id] !== false;
        check.style.visibility = vis ? 'visible' : 'hidden';
    });
};

window.exportIlluLocalStorageBundle = async function () {
    const bundle = {
        format: 'illu-local-bundle',
        version: 1,
        exportedAt: new Date().toISOString(),
        keys: {}
    };
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('illu_')) bundle.keys[k] = localStorage.getItem(k);
        }
    } catch (e) {
        return;
    }
    if (
        window.WorkspaceIO &&
        typeof window.WorkspaceIO.attachIdbBlobsToExportBundle === 'function'
    ) {
        try {
            await window.WorkspaceIO.attachIdbBlobsToExportBundle(bundle);
        } catch (e) {
            console.warn('Export bundle + IndexedDB :', e);
        }
    }
    const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'illu-local-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2500);
};

window.importIlluLocalStorageBundle = async function (text) {
    let bundle;
    try {
        bundle = JSON.parse(text);
    } catch (e) {
        const m =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('settings.importBundleInvalid')
                : 'Fichier JSON invalide.';
        window.showIlluAlert(m);
        return;
    }
    if (!bundle || bundle.format !== 'illu-local-bundle' || typeof bundle.keys !== 'object') {
        const m =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('settings.importBundleBadFormat')
                : 'Fichier non reconnu (sauvegarde locale Illu attendue).';
        window.showIlluAlert(m);
        return;
    }
    const c =
        window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t('settings.importBundleConfirm')
            : 'Remplacer toutes les données locales Illu par ce fichier et recharger la page ?';
    if (!confirm(c)) return;
    if (
        bundle.idbBlobs &&
        window.WorkspaceIO &&
        typeof window.WorkspaceIO.importIdbBlobsFromBundle === 'function'
    ) {
        try {
            await window.WorkspaceIO.importIdbBlobsFromBundle(bundle.idbBlobs);
        } catch (e) {
            console.warn('Import bundle IndexedDB :', e);
        }
    }
    Object.keys(bundle.keys).forEach((k) => {
        if (!k || !k.startsWith('illu_')) return;
        const v = bundle.keys[k];
        if (v === undefined || v === null) {
            try {
                localStorage.removeItem(k);
            } catch (e2) {
                /* ignore */
            }
        } else {
            try {
                localStorage.setItem(k, String(v));
            } catch (e2) {
                /* ignore */
            }
        }
    });
    location.reload();
};

window.loadExampleProject = async function () {
    const ov = document.getElementById('settings-overlay');
    if (ov) {
        ov.style.display = 'none';
        document.body.classList.remove('no-scroll');
    }
    const welcome = document.getElementById('welcome-overlay');
    if (welcome) welcome.style.display = 'none';

    try {
        if (window.IlluProgress) window.IlluProgress.splash(20, 'Récupération du projet exemple…');
        const res = await fetch('./IMG/start.illu');
        if (!res.ok) throw new Error('Fichier introuvable (' + res.status + ')');

        if (window.IlluProgress) window.IlluProgress.splash(40, 'Lecture des données…');
        const text = await res.text();

        if (window.IlluProgress) window.IlluProgress.splash(60, 'Analyse du projet…');
        if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(2);
        const data = JSON.parse(text);
        if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);

        if (data && data.format === 'illu-workspace') {
            if (window.WorkspaceIO && typeof window.WorkspaceIO.applyWorkspaceFromJsonText === 'function') {
                if (window.IlluProgress) window.IlluProgress.splash(80, 'Application du projet…');
                await window.WorkspaceIO.applyWorkspaceFromJsonText(data);
            } else {
                throw new Error('Module WorkspaceIO indisponible');
            }
        } else {
            throw new Error('Format de fichier .illu invalide');
        }

        if (window.IlluProgress) window.IlluProgress.splash(100, 'Chargement terminé !');
        setTimeout(() => { if (window.IlluProgress) window.IlluProgress.hide(); }, 500);
    } catch (err) {
        if (window.IlluProgress) window.IlluProgress.hide();
        console.warn('[LOAD-EXAMPLE]', err);
        const msg = window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t('msg.loadExampleError')
            : 'Échec du chargement du projet exemple.';
        if (window.showIlluAlert) {
            window.showIlluAlert(msg + '\n' + err.message);
        } else {
            alert(msg + '\n' + err.message);
        }
    }
};

window.getUILayoutMode = function () {
    try {
        const v = localStorage.getItem(ILLU_UI_LAYOUT_KEY);
        if (v === 'photoshop') return 'photoshop';
        if (v === 'phone') return 'phone';
        if (v === 'floating') return 'floating';
        return 'floating';
    } catch (e) {
        return 'floating';
    }
};

/**
 * Client « type téléphone » : Client Hints (mobile) si disponible, sinon fenêtre étroite + (tactile ou pointeur grossier).
 */
window.illuIsPhoneLikeClient = function () {
    try {
        const uad = navigator.userAgentData;
        if (uad && typeof uad.mobile === 'boolean' && uad.mobile) return true;
    } catch (e) {
        /* ignore */
    }
    try {
        const w = typeof window.innerWidth === 'number' ? window.innerWidth : 1024;
        const h = typeof window.innerHeight === 'number' ? window.innerHeight : 768;
        const narrow = w <= 768 || (w <= 900 && h <= 520);
        const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
        let coarse = false;
        try {
            coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        } catch (e2) {
            /* ignore */
        }
        return narrow && (touch || coarse);
    } catch (e3) {
        return false;
    }
};

/**
 * Si aucune disposition n’a jamais été enregistrée et que le client ressemble à un téléphone,
 * enregistre le mode interface « téléphone » (dock bas, menu ☰).
 */
window.illuApplyPhoneLayoutDefaultIfUnset = function () {
    if (typeof window.illuIsPhoneLikeClient !== 'function' || !window.illuIsPhoneLikeClient()) return;
    try {
        if (localStorage.getItem(ILLU_UI_LAYOUT_KEY) != null) return;
        localStorage.setItem(ILLU_UI_LAYOUT_KEY, 'phone');
    } catch (e) {
        /* ignore */
    }
};

/** Jauge type « barre bleue » (tolérance baguette / pot) : met à jour --illu-gauge-pct et le libellé. */
window.syncIlluGaugeForRange = function (rangeEl) {
    if (!rangeEl || !rangeEl.closest) return;
    const wrap = rangeEl.closest('.illu-gauge-wrap') || rangeEl.closest('.illu-range-wrap');
    if (!wrap) return;
    const min = Number(rangeEl.min) || 0;
    const max = Number(rangeEl.max) || 100;
    let val = Number(rangeEl.value);
    if (!Number.isFinite(val)) val = min;
    const pct = max <= min ? 0 : Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    wrap.style.setProperty('--illu-gauge-pct', pct + '%');
    const lab = wrap.querySelector('.illu-gauge-val');
    if (lab) lab.textContent = String(Math.round(val));
    wrap.classList.toggle('illu-gauge-wrap--low', pct < 16);
};

window.refreshAllIlluGauges = function () {
    document.querySelectorAll('.illu-gauge-wrap input[type="range"], .illu-range-wrap input[type="range"]').forEach((r) => {
        window.syncIlluGaugeForRange(r);
    });
};

/** Nombre de colonnes de teinte (hors gris). */
window.ILLU_PALETTE_HUE_COUNT = 12;

/** Source unique : grilles couleurs + 2 gris par ligne (Paint.NET). */
window.ILLU_PALETTE_GRAY_BY_ROW = [
    ['#000000', '#404040'],
    ['#1E1E1E', '#707070'],
    ['#FFFFFF', '#B4B4B4'],
    ['#141414', '#888888']
];

/** index i = une colonne (rouge → magenta). Ligne foncée = index 2. */
window.ILLU_PALETTE_COLOR_ROWS = [
    ['#FF0000', '#FF6A00', '#FFD800', '#B6FF00', '#4CFF00', '#00FF21', '#00FF90', '#00FFFF', '#0094FF', '#0026FF', '#4800FF', '#B200FF'],
    ['#B200FF', '#FF00DC', '#FF006E', '#7F0000', '#7F3300', '#7F6A00', '#5B7F00', '#267F00', '#007F0E', '#007F46', '#007F7F', '#FF00DC'],
    ['#7F0000', '#7F3300', '#7F6A00', '#5B7F00', '#267F00', '#007F0E', '#007F46', '#007F7F', '#004A7F', '#00137F', '#21007F', '#57007F'],
    ['#57007F', '#7F006E', '#7F0037', '#004A7F', '#00137F', '#21007F', '#5C4033', '#6F4E37', '#82663A', '#9A7B4F', '#B8956A', '#7F006E']
];

const ILLU_PALETTE_VIVID_ROW = 0;
const ILLU_PALETTE_DARK_ROW = 2;

function illuParseHexRgb(hex) {
    let h = String(hex || '').trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length < 6) return { r: 0, g: 0, b: 0 };
    h = h.slice(0, 6);
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function illuRgbSwatch(r, g, b, a) {
    return { r, g, b, a: a != null ? a : 255 };
}

function illuLerpRgb(a, b, t) {
    const u = Math.max(0, Math.min(1, t));
    return {
        r: Math.round(a.r + (b.r - a.r) * u),
        g: Math.round(a.g + (b.g - a.g) * u),
        b: Math.round(a.b + (b.b - a.b) * u)
    };
}

function illuRgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const l = (max + min) / 2;
    let s = 0;
    if (d > 1e-6) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            default:
                h = (r - g) / d + 4;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

function illuHslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rp = 0;
    let gp = 0;
    let bp = 0;
    if (h < 60) {
        rp = c;
        gp = x;
    } else if (h < 120) {
        rp = x;
        gp = c;
    } else if (h < 180) {
        gp = c;
        bp = x;
    } else if (h < 240) {
        gp = x;
        bp = c;
    } else if (h < 300) {
        rp = x;
        bp = c;
    } else {
        rp = c;
        bp = x;
    }
    return {
        r: Math.round((rp + m) * 255),
        g: Math.round((gp + m) * 255),
        b: Math.round((bp + m) * 255)
    };
}

function illuPastelFromVividRgb(rgb) {
    const hsl = illuRgbToHsl(rgb.r, rgb.g, rgb.b);
    const s = Math.max(48, Math.min(78, hsl.s * 0.75 + 22));
    const l = Math.max(62, Math.min(84, hsl.l * 0.42 + 48));
    const out = illuHslToRgb(hsl.h, s, l);
    return illuRgbSwatch(out.r, out.g, out.b, 255);
}

function illuPaletteThemeSwatch(themeRow, colorIndex) {
    const rows = window.ILLU_PALETTE_COLOR_ROWS;
    const vividHex = rows[ILLU_PALETTE_VIVID_ROW][colorIndex];
    const vivid = illuParseHexRgb(vividHex);
    if (themeRow === 0) return vividHex;
    if (themeRow === 1) return rows[ILLU_PALETTE_DARK_ROW][colorIndex];
    if (themeRow === 2) return illuPastelFromVividRgb(vivid);
    return illuRgbSwatch(vivid.r, vivid.g, vivid.b, 128);
}

function illuColumnAnchorWeights(colIndex, totalColorCols, anchorCount) {
    const n = anchorCount || window.ILLU_PALETTE_HUE_COUNT || 12;
    if (n <= 1) return { i0: 0, i1: 0, f: 0 };
    const pos = totalColorCols <= 1 ? 0 : (colIndex / (totalColorCols - 1)) * (n - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(n - 1, i0 + 1);
    return { i0, i1, f: pos - i0 };
}

function illuCompactGrayForRow(r, grayCol) {
    const hex = window.ILLU_PALETTE_GRAY_BY_ROW[r][grayCol];
    const rgb = illuParseHexRgb(hex);
    if (r === 3) return illuRgbSwatch(rgb.r, rgb.g, rgb.b, 128);
    return hex;
}

function illuCompactSwatchForRow(r, colorIndex) {
    return illuPaletteThemeSwatch(r, colorIndex);
}

function illuExpandedGrayForCell(grayCol, row) {
    const hex = window.ILLU_PALETTE_GRAY_BY_ROW[row][grayCol];
    const rgb = illuParseHexRgb(hex);
    return row === 3 ? illuRgbSwatch(rgb.r, rgb.g, rgb.b, 128) : illuRgbSwatch(rgb.r, rgb.g, rgb.b, 255);
}

function illuExpandedColorSwatch(themeRow, colorCol, colorCols) {
    const rows = window.ILLU_PALETTE_COLOR_ROWS;
    const w = illuColumnAnchorWeights(colorCol, colorCols, window.ILLU_PALETTE_HUE_COUNT);
    const vivid = rows[ILLU_PALETTE_VIVID_ROW];
    const dark = rows[ILLU_PALETTE_DARK_ROW];
    const vividRgb = illuLerpRgb(
        illuParseHexRgb(vivid[w.i0]),
        illuParseHexRgb(vivid[w.i1]),
        w.f
    );
    if (themeRow === 0) return illuRgbSwatch(vividRgb.r, vividRgb.g, vividRgb.b, 255);
    if (themeRow === 1) {
        const d = illuLerpRgb(illuParseHexRgb(dark[w.i0]), illuParseHexRgb(dark[w.i1]), w.f);
        return illuRgbSwatch(d.r, d.g, d.b, 255);
    }
    if (themeRow === 2) return illuPastelFromVividRgb(vividRgb);
    return illuRgbSwatch(vividRgb.r, vividRgb.g, vividRgb.b, 128);
}

/** Compact 14×4 : 2 gris + 12 teintes alignées par colonne. */
window.buildIlluCompactPaletteSwatches = function () {
    const n = window.ILLU_PALETTE_HUE_COUNT;
    const cells = [];
    for (let r = 0; r < 4; r++) {
        cells.push(illuCompactGrayForRow(r, 0), illuCompactGrayForRow(r, 1));
        for (let i = 0; i < n; i++) cells.push(illuCompactSwatchForRow(r, i));
    }
    return cells;
};

window.buildIlluCompactPaletteHex = function () {
    return window.buildIlluCompactPaletteSwatches();
};

/**
 * 37×4 : 2 gris à gauche (comme compact) + 35 teintes ; L1 vif, L2 foncé, L3 pastel, L4 vif 50 %.
 */
window.buildIlluExpandedPaletteSwatches = function () {
    const COLS = 37;
    const GRAY_COLS = 2;
    const COLOR_COLS = 35;
    const cells = new Array(COLS * 4);

    for (let r = 0; r < 4; r++) {
        for (let g = 0; g < GRAY_COLS; g++) {
            cells[r * COLS + g] = illuExpandedGrayForCell(g, r);
        }
        for (let c = 0; c < COLOR_COLS; c++) {
            const col = GRAY_COLS + c;
            cells[r * COLS + col] = illuExpandedColorSwatch(r, c, COLOR_COLS);
        }
    }
    return cells;
};

window.fillPaletteGridFromSwatches = function (items) {
    const grid = document.getElementById('palette-grid');
    const em = window.EditorManager;
    if (!grid || !em || !items || !items.length) return;
    grid.innerHTML = '';
    items.forEach((item) => {
        const swatch = document.createElement('div');
        swatch.className = 'palette-swatch';
        let r;
        let g;
        let b;
        let a = 255;
        let bg;
        if (typeof item === 'string') {
            const hex = item.startsWith('#') ? item : '#' + item;
            const rgb = em.hexToRgb(hex);
            r = rgb.r;
            g = rgb.g;
            b = rgb.b;
            bg = hex;
        } else {
            r = item.r;
            g = item.g;
            b = item.b;
            a = item.a != null ? item.a : 255;
            if (a < 255) {
                swatch.classList.add('palette-swatch--translucent');
                const aN = (a / 255).toFixed(4);
                const tint = `linear-gradient(rgba(${r},${g},${b},${aN}), rgba(${r},${g},${b},${aN}))`;
                const checker =
                    'linear-gradient(45deg,#bdbdbd 25%,transparent 25%),linear-gradient(-45deg,#bdbdbd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#bdbdbd 75%),linear-gradient(-45deg,transparent 75%,#bdbdbd 75%)';
                swatch.style.backgroundColor = 'transparent';
                swatch.style.backgroundImage = `${tint}, ${checker}`;
                swatch.style.backgroundSize = '100% 100%, 6px 6px';
                swatch.style.backgroundRepeat = 'no-repeat, repeat';
                swatch.style.backgroundPosition = '0 0, 0 0';
                bg = null;
            } else {
                bg = em.rgbToHex(r, g, b);
            }
        }
        if (bg) swatch.style.background = bg;
        swatch.onclick = () => em.setColorFromRGB(r, g, b, a);
        grid.appendChild(swatch);
    });
};

window.ILLU_PALETTE_CELL_PX = 13;

function illuMeasurePaletteGridWidth(grid) {
    const colorsSheetBody = document.getElementById('illu-mobile-sheet-colors-body');
    if (
        document.body.classList.contains('illu-mobile-shell-active') &&
        colorsSheetBody &&
        colorsSheetBody.clientWidth > 0 &&
        grid.closest('#illu-mobile-sheet-colors-body')
    ) {
        return Math.max(120, colorsSheetBody.clientWidth - 12);
    }
    const host = grid.closest('.color-picker-main') || grid.parentElement;
    if (host && host.clientWidth > 0) return host.clientWidth;
    const dockRight = document.getElementById('palette-dock-right');
    if (dockRight && dockRight.clientWidth > 0) return Math.max(120, dockRight.clientWidth - 16);
    return 220;
}

function illuPaletteUsesFlowLayout() {
    const mode = typeof window.getUILayoutMode === 'function' ? window.getUILayoutMode() : 'floating';
    if (mode === 'photoshop') return true;
    return (
        document.body.classList.contains('illu-pdn-dock-active') ||
        document.body.classList.contains('illu-mobile-shell-active')
    );
}

function illuApplyPaletteGridFlow(grid, swatches, cellPx) {
    const mobileShell = document.body.classList.contains('illu-mobile-shell-active');
    const cell = mobileShell ? 16 : cellPx || window.ILLU_PALETTE_CELL_PX || 13;
    const w = illuMeasurePaletteGridWidth(grid);
    const cols = mobileShell
        ? Math.max(8, Math.min(16, Math.floor(w / cell)))
        : Math.max(10, Math.min(20, Math.floor(w / cell)));
    const rows = Math.max(1, Math.ceil(swatches.length / cols));
    grid.classList.add('palette-grid--flow');
    grid.style.gap = '0';
    grid.style.maxWidth = '100%';
    grid.style.width = 'max-content';
    grid.style.gridTemplateColumns = `repeat(${cols}, ${cell}px)`;
    grid.style.gridTemplateRows = `repeat(${rows}, ${cell}px)`;
    window.fillPaletteGridFromSwatches(swatches);
}

function illuApplyPaletteGridFixed(grid, cols, rows, swatches, cellPx) {
    const cell = cellPx || window.ILLU_PALETTE_CELL_PX || 13;
    grid.classList.remove('palette-grid--flow');
    grid.style.gap = '0';
    grid.style.maxWidth = '100%';
    grid.style.width = 'max-content';
    grid.style.gridTemplateColumns = `repeat(${cols}, ${cell}px)`;
    grid.style.gridTemplateRows = `repeat(${rows}, ${cell}px)`;
    window.fillPaletteGridFromSwatches(swatches);
}

/** Compact 14×4 ; flottant étendu 37×4 ; Photoshop / téléphone : colonnes dynamiques, lignes auto. */
window.refreshPaletteGridLayout = function () {
    const grid = document.getElementById('palette-grid');
    const winColors = document.getElementById('win-colors');
    if (!grid || !winColors) return;
    const em = window.EditorManager;
    const p = em && em.activeProject;

    if (p && p.mode === 'pixel-dither') {
        grid.classList.add('illu-palette-disabled');
        grid.style.display = 'none';
        return;
    }
    grid.classList.remove('illu-palette-disabled');
    
    const expanded = winColors.classList.contains('color-window-expanded');
    const flow = illuPaletteUsesFlowLayout();
    const cell = window.ILLU_PALETTE_CELL_PX || 13;

    let baseSwatches = null;
    let isCmjn = p && em.isCmjnSimulationMode && em.isCmjnSimulationMode(p.mode) && em.applyCmjnFilter;
    let isRestricted = p && em.isPaletteRestrictedMode && em.isPaletteRestrictedMode(p.mode) && em.buildModePaletteGridSwatches;

    const mapCmjnSwatch = (item) => {
        let r, g, b;
        if (typeof item === 'string') {
            const hex = item.startsWith('#') ? item : '#' + item;
            const rgb = em.hexToRgb(hex);
            r = rgb.r; g = rgb.g; b = rgb.b;
        } else {
            r = item.r; g = item.g; b = item.b;
        }
        const out = em.applyCmjnFilter(r, g, b);
        return { r: out.r, g: out.g, b: out.b, a: item.a != null ? item.a : 255 };
    };

    const mapRestrictedSwatch = (item) => {
        let r, g, b;
        if (typeof item === 'string') {
            const hex = item.startsWith('#') ? item : '#' + item;
            const rgb = em.hexToRgb(hex);
            r = rgb.r; g = rgb.g; b = rgb.b;
        } else {
            r = item.r; g = item.g; b = item.b;
        }
        const out = em._quantizeOpaquePixelRgb ? em._quantizeOpaquePixelRgb(r, g, b, p.mode) : {r, g, b};
        return { r: out.r, g: out.g, b: out.b, a: item.a != null ? item.a : 255 };
    };

    if (isCmjn || (isRestricted && !expanded)) {
        if (expanded) {
            baseSwatches = window.buildIlluExpandedPaletteSwatches().map(isCmjn ? mapCmjnSwatch : mapRestrictedSwatch);
        } else {
            baseSwatches = window.buildIlluCompactPaletteSwatches().map(isCmjn ? mapCmjnSwatch : mapRestrictedSwatch);
        }
    } else if (isRestricted && expanded) {
        baseSwatches = em.buildModePaletteGridSwatches(p.mode);
    } else {
        if (expanded) {
            window._illuExpandedPaletteSwatches = window.buildIlluExpandedPaletteSwatches();
            baseSwatches = window._illuExpandedPaletteSwatches;
        } else {
            window._illuCompactPaletteSwatches = window.buildIlluCompactPaletteSwatches();
            baseSwatches = window._illuCompactPaletteSwatches;
        }
    }

    if (!baseSwatches || !baseSwatches.length) return;

    if (flow) {
        illuApplyPaletteGridFlow(grid, baseSwatches, cell);
    } else {
        if (expanded) {
            illuApplyPaletteGridFixed(grid, 37, Math.ceil(baseSwatches.length / 37), baseSwatches, cell);
        } else {
            illuApplyPaletteGridFixed(grid, 14, 4, baseSwatches, cell);
        }
    }
};

let _illuPaletteGridResizeObserver = null;
let _illuPaletteGridResizeTimer = null;

window.initIlluPaletteGridResizeObserver = function () {
    const winColors = document.getElementById('win-colors');
    if (!winColors || typeof ResizeObserver === 'undefined') return;
    if (_illuPaletteGridResizeObserver) return;
    _illuPaletteGridResizeObserver = new ResizeObserver(() => {
        clearTimeout(_illuPaletteGridResizeTimer);
        _illuPaletteGridResizeTimer = setTimeout(() => {
            if (typeof window.refreshPaletteGridLayout === 'function') window.refreshPaletteGridLayout();
        }, 80);
    });
    _illuPaletteGridResizeObserver.observe(winColors);
    const picker = winColors.querySelector('.color-picker-main');
    if (picker) _illuPaletteGridResizeObserver.observe(picker);
    const pickerBody = winColors.querySelector('.color-picker-body');
    if (pickerBody) _illuPaletteGridResizeObserver.observe(pickerBody);
};

function stripPaletteInlinePosition(el) {
    if (!el) return;
    ['position', 'left', 'top', 'right', 'bottom', 'zIndex', 'inset'].forEach((k) => {
        el.style[k] = '';
    });
}

/** Mode Paint.NET : palettes aux 4 coins de la zone workspace (toile), padding ~5px. */
window.applyFloatingPaletteDefaults = function () {
    const pad = 6;
    const ws = document.querySelector('.workspace-dock-center');
    const t = document.getElementById('win-tools');
    const c = document.getElementById('win-colors');
    const h = document.getElementById('win-history');
    const l = document.getElementById('win-layers');
    const iw = window.innerWidth;
    const ih = window.innerHeight;
    if (!ws) {
        if (t) {
            t.style.left = `${pad}px`;
            t.style.top = `${pad + 88}px`;
            t.style.right = 'auto';
            t.style.bottom = 'auto';
            t.style.width = 'auto';
            t.style.maxWidth = 'none';
        }
        if (c) {
            c.style.left = `${pad}px`;
            c.style.bottom = `${pad}px`;
            c.style.top = 'auto';
            c.style.right = 'auto';
            c.style.width = '200px';
        }
        if (h) {
            h.style.right = `${pad}px`;
            h.style.top = `${pad + 88}px`;
            h.style.left = 'auto';
            h.style.bottom = 'auto';
            h.style.width = '150px';
        }
        if (l) {
            l.style.right = `${pad}px`;
            l.style.bottom = `${pad}px`;
            l.style.left = 'auto';
            l.style.top = 'auto';
            l.style.width = '196px';
        }
        return;
    }
    const r = ws.getBoundingClientRect();
    if (t) {
        t.style.left = `${Math.round(r.left + pad)}px`;
        t.style.top = `${Math.round(r.top + pad)}px`;
        t.style.right = 'auto';
        t.style.bottom = 'auto';
        t.style.width = 'auto';
        t.style.maxWidth = 'none';
    }
    if (c) {
        c.style.left = `${Math.round(r.left + pad)}px`;
        c.style.top = 'auto';
        c.style.right = 'auto';
        c.style.bottom = `${Math.round(ih - r.bottom + pad)}px`;
        c.style.width = '200px';
        c.style.maxWidth = '';
    }
    if (h) {
        h.style.right = `${Math.round(iw - r.right + pad)}px`;
        h.style.top = `${Math.round(r.top + pad)}px`;
        h.style.left = 'auto';
        h.style.bottom = 'auto';
        h.style.width = '150px';
        h.style.maxWidth = '';
    }
    if (l) {
        l.style.right = `${Math.round(iw - r.right + pad)}px`;
        l.style.bottom = `${Math.round(ih - r.bottom + pad)}px`;
        l.style.left = 'auto';
        l.style.top = 'auto';
        l.style.width = '196px';
        l.style.maxWidth = '';
    }
};

window.layoutPalettePhotoshop = function () {
    /* Les colonnes #palette-dock-* gèrent le placement ; rien à faire ici. */
};

/** Photoshop ancré : largeur du rail outils = contenu (#main-toolbox), sans resize manuel ni localStorage. */
window.illuSyncToolsDockAutoWidth = function () {
    if (!document.body.classList.contains('ui-layout-docked')) return;
    if (document.body.classList.contains('illu-mobile-ui')) return;
    const dock = document.getElementById('palette-dock-left');
    const box = document.getElementById('main-toolbox');
    if (!dock || !box) return;

    dock.style.removeProperty('width');
    dock.style.removeProperty('flex-basis');
    dock.style.removeProperty('max-width');

    const pad = 4;
    const sw = Math.ceil(box.scrollWidth);
    const w = Math.min(168, Math.max(36, sw + pad));
    /* Sur body : body.ui-layout-docked définit aussi cette variable en CSS et gagnerait sur <html>. */
    document.body.style.setProperty('--palette-dock-left-width', w + 'px');
    document.documentElement.style.removeProperty('--palette-dock-left-width');
};

/** Observe la boîte à outils pour ajuster --palette-dock-left-width automatiquement. */
window.illuInitToolsDockAutoWidth = function () {
    const dock = document.getElementById('palette-dock-left');
    const box = document.getElementById('main-toolbox');
    if (!dock || !box) return;

    dock.querySelectorAll('.illu-dock-left-resize-e').forEach((el) => el.remove());
    try {
        localStorage.removeItem('illu_tools_dock_width');
    } catch (e) {
        /* ignore */
    }

    if (dock.dataset.illuDockAutoWired === '1') {
        window.illuSyncToolsDockAutoWidth();
        return;
    }
    dock.dataset.illuDockAutoWired = '1';

    const schedule = () => {
        requestAnimationFrame(() => window.illuSyncToolsDockAutoWidth());
    };

    schedule();
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(schedule);
        ro.observe(box);
        ro.observe(dock);
    }
    window.addEventListener('resize', schedule);
};

/**
 * Vide le dock bas Paint.NET sans détruire les nœuds des palettes (sinon innerHTML les retire du document).
 */
function illuClearPdnBottomDockPreservingPalettes(bottomDock, safeParent) {
    if (!bottomDock) return;
    if (safeParent) {
        PALETTE_WINDOW_IDS.forEach((id) => {
            const el = document.getElementById(id);
            try {
                if (el && bottomDock.contains(el)) safeParent.appendChild(el);
            } catch (e) {
                /* ignore */
            }
        });
    }
    bottomDock.innerHTML = '';
}

/** Paint.NET classique : quatre fenêtres volantes (barre de titre déplaçable). */
function mountPalettesFloating() {
    if (typeof window.teardownIlluMobileShell === 'function') window.teardownIlluMobileShell();
    illuDisconnectMobileToolsToolbarLayout();
    illuPdnArrangeEdgeTabsForPhone(false);
    const host = document.getElementById('floating-palette-host');
    if (!host) return;
    const bottomDock = document.getElementById('illu-pdn-bottom-dock');
    const colors = document.getElementById('win-colors');
    const layers = document.getElementById('win-layers');
    const hist = document.getElementById('win-history');
    const slidersPanel = document.getElementById('color-sliders-panel');
    const slidersHost = document.getElementById('dock-rail-sliders-host');
    const historyHost = document.getElementById('dock-rail-history-host');
    const rail = document.getElementById('palette-dock-rail');
    const right = document.getElementById('palette-dock-right');

    if (slidersPanel && colors && slidersHost && slidersPanel.parentNode === slidersHost) {
        const bodyEl = colors.querySelector('.color-picker-body');
        if (bodyEl) bodyEl.appendChild(slidersPanel);
        else {
            const leftEl = colors.querySelector('.color-picker-left');
            if (leftEl) leftEl.after(slidersPanel);
            else {
                const mainPicker = colors.querySelector('.color-picker-main');
                if (mainPicker) mainPicker.appendChild(slidersPanel);
            }
        }
    }
    if (hist && historyHost && hist.parentNode === historyHost) {
        if (layers && layers.parentNode === right) {
            layers.after(hist);
        } else if (right) {
            right.appendChild(hist);
        }
    }
    if (rail) {
        rail.style.display = 'none';
    }

    document.body.classList.remove('ui-layout-docked');
    document.body.classList.add('ui-layout-floating');
    document.body.classList.remove('illu-pdn-dock-active');
    host.setAttribute('aria-hidden', 'false');

    illuClearPdnBottomDockPreservingPalettes(bottomDock, host);

    PALETTE_WINDOW_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.parentNode && el.parentNode !== host) {
            host.appendChild(el);
        }
        stripPaletteInlinePosition(el);
        el.classList.add('floating-window');
        el.style.position = 'fixed';
        el.style.zIndex = '610';
        el.style.removeProperty('inset');
        el.style.removeProperty('width');
        el.style.removeProperty('max-width');
        el.style.removeProperty('maxWidth');
        el.style.removeProperty('box-sizing');
        el.style.removeProperty('boxSizing');
        if (id === 'win-history') {
            el.style.width = '200px';
            el.style.minWidth = '200px';
            el.style.maxWidth = '200px';
        }
        el.querySelectorAll('.title-bar').forEach((tb) => {
            tb.style.cursor = 'move';
        });
    });

    if (typeof window.applySavedFloatingPalettePositions === 'function') {
        window.applySavedFloatingPalettePositions();
    }
    window.applyFloatingPaletteDefaults();
    if (window.EditorManager && typeof window.EditorManager.syncFloatingPalettesPosition === 'function') {
        window.EditorManager.syncFloatingPalettesPosition();
    }
    if (typeof window.applyFloatingPaletteVisibility === 'function') {
        window.applyFloatingPaletteVisibility();
    }
    if (typeof window.refreshFloatingPaletteMenuLabels === 'function') {
        window.refreshFloatingPaletteMenuLabels();
    }
    queueMicrotask(() => {
        if (typeof window.illuClampAllFloatingPalettes === 'function') window.illuClampAllFloatingPalettes();
    });
    const leftDock = document.getElementById('palette-dock-left');
    if (leftDock) {
        delete leftDock.dataset.illuDockAutoWired;
        leftDock.style.removeProperty('width');
        leftDock.style.removeProperty('flex-basis');
    }
    document.body.style.removeProperty('--palette-dock-left-width');
    document.documentElement.style.removeProperty('--palette-dock-left-width');
}

/** Téléphone : shell mobile (dock + sheets) ; palettes dans #illu-mobile-palette-pool. */
function mountPalettesPhonePdn() {
    illuDisconnectMobileToolsToolbarLayout();
    const host = document.getElementById('floating-palette-host');
    const pool = document.getElementById('illu-mobile-palette-pool');
    const bottomDock = document.getElementById('illu-pdn-bottom-dock');
    const colors = document.getElementById('win-colors');
    const layers = document.getElementById('win-layers');
    const hist = document.getElementById('win-history');
    const slidersPanel = document.getElementById('color-sliders-panel');
    const slidersHost = document.getElementById('dock-rail-sliders-host');
    const historyHost = document.getElementById('dock-rail-history-host');
    const rail = document.getElementById('palette-dock-rail');
    const right = document.getElementById('palette-dock-right');

    if (slidersPanel && colors && slidersHost && slidersPanel.parentNode === slidersHost) {
        const bodyEl = colors.querySelector('.color-picker-body');
        if (bodyEl) bodyEl.appendChild(slidersPanel);
        else {
            const leftEl = colors.querySelector('.color-picker-left');
            if (leftEl) leftEl.after(slidersPanel);
            else {
                const mainPicker = colors.querySelector('.color-picker-main');
                if (mainPicker) mainPicker.appendChild(slidersPanel);
            }
        }
    }
    if (hist && historyHost && hist.parentNode === historyHost) {
        if (layers && layers.parentNode === right) {
            layers.after(hist);
        } else if (right) {
            right.appendChild(hist);
        }
    }
    if (rail) rail.style.display = 'none';
    if (bottomDock) bottomDock.innerHTML = '';

    document.body.classList.remove('ui-layout-docked');
    document.body.classList.add('ui-layout-floating');
    document.body.classList.remove('illu-pdn-dock-active');
    if (host) host.setAttribute('aria-hidden', 'true');

    function stashInPool(el) {
        if (!el || !pool) return;
        stripPaletteInlinePosition(el);
        el.classList.remove('illu-floating-window-hidden');
        el.classList.add('floating-window');
        el.style.position = 'relative';
        el.style.width = '100%';
        el.style.maxWidth = 'none';
        pool.appendChild(el);
    }

    PALETTE_WINDOW_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) stashInPool(el);
    });

    if (typeof window.initIlluMobileShell === 'function') {
        window.initIlluMobileShell();
    }
    if (typeof window.applyFloatingPaletteVisibility === 'function') {
        window.applyFloatingPaletteVisibility();
    }
    queueMicrotask(() => {
        if (typeof window.applyFloatingPaletteVisibility === 'function') {
            window.applyFloatingPaletteVisibility();
        }
    });
    if (typeof window.refreshFloatingPaletteMenuLabels === 'function') {
        window.refreshFloatingPaletteMenuLabels();
    }
}

function mountPalettesDocked() {
    if (typeof window.teardownIlluMobileShell === 'function') window.teardownIlluMobileShell();
    illuDisconnectMobileToolsToolbarLayout();
    illuPdnArrangeEdgeTabsForPhone(false);
    const left = document.getElementById('palette-dock-left');
    const right = document.getElementById('palette-dock-right');
    const rail = document.getElementById('palette-dock-rail');
    const slidersHost = document.getElementById('dock-rail-sliders-host');
    const historyHost = document.getElementById('dock-rail-history-host');
    const host = document.getElementById('floating-palette-host');
    const bottomDock = document.getElementById('illu-pdn-bottom-dock');
    if (!left || !right) return;
    document.body.classList.remove('illu-pdn-dock-active');
    illuClearPdnBottomDockPreservingPalettes(bottomDock, host || left);
    if (host) host.setAttribute('aria-hidden', 'true');
    /* Mode Photoshop : les quatre palettes sont toujours visibles ; réinitialiser masquage pour le prochain passage en flottant. */
    try {
        localStorage.setItem(ILLU_FLOATING_PALETTE_VIS_KEY, '{}');
    } catch (e) {
        /* ignore */
    }
    document.body.classList.add('ui-layout-docked');
    document.body.classList.remove('ui-layout-floating');
    const tools = document.getElementById('win-tools');
    const colors = document.getElementById('win-colors');
    const layers = document.getElementById('win-layers');
    const hist = document.getElementById('win-history');
    const slidersPanel = document.getElementById('color-sliders-panel');
    if (tools) {
        tools.classList.remove('illu-floating-window-hidden');
        left.insertBefore(tools, left.firstChild);
        tools.classList.remove('floating-window');
        stripPaletteInlinePosition(tools);
        tools.style.maxWidth = '';
        tools.style.width = '';
        const tb = tools.querySelector('.title-bar');
        if (tb) tb.style.cursor = 'default';
    }
    if (layers) {
        layers.classList.remove('illu-floating-window-hidden');
        right.insertBefore(layers, right.firstChild);
        layers.classList.remove('floating-window');
        stripPaletteInlinePosition(layers);
        layers.style.width = '';
        layers.style.maxWidth = '';
        const tb = layers.querySelector('.title-bar');
        if (tb) tb.style.cursor = 'default';
    }
    if (colors) {
        colors.classList.remove('illu-floating-window-hidden');
        if (layers && layers.parentNode === right) {
            right.insertBefore(colors, layers);
        } else {
            right.insertBefore(colors, right.firstChild);
        }
        colors.classList.remove('floating-window');
        stripPaletteInlinePosition(colors);
        colors.style.width = '';
        colors.style.maxWidth = '';
        const tb = colors.querySelector('.title-bar');
        if (tb) tb.style.cursor = 'default';
    }
    if (slidersPanel && slidersHost && slidersPanel.parentNode !== slidersHost) {
        slidersHost.appendChild(slidersPanel);
    }
    if (hist && historyHost && hist.parentNode !== historyHost) {
        hist.classList.remove('illu-floating-window-hidden');
        historyHost.appendChild(hist);
        hist.classList.remove('floating-window');
        stripPaletteInlinePosition(hist);
        hist.style.width = '200px';
        hist.style.minWidth = '200px';
        hist.style.maxWidth = '200px';
        const tb = hist.querySelector('.title-bar');
        if (tb) tb.style.cursor = 'default';
    }
    if (rail) {
        rail.style.removeProperty('display');
    }
    if (typeof window.illuUpdateDockRailVisibility === 'function') {
        window.illuUpdateDockRailVisibility();
    }
    if (typeof window.illuSyncToolsDockAutoWidth === 'function') {
        queueMicrotask(() => window.illuSyncToolsDockAutoWidth());
    }
}

/** Masque uniquement la colonne de contenu du rail si les deux panneaux sont repliés ; les onglets restent visibles. */
window.illuUpdateDockRailVisibility = function () {
    const m = typeof window.getUILayoutMode === 'function' ? window.getUILayoutMode() : '';
    if (m !== 'photoshop') {
        return;
    }
    const rail = document.getElementById('palette-dock-rail');
    const content = rail && rail.querySelector('.palette-dock-rail__content');
    const hostS = document.getElementById('dock-rail-sliders-host');
    const hostH = document.getElementById('dock-rail-history-host');
    if (!rail || !content || !hostS || !hostH) return;

    rail.style.removeProperty('display');
    const sVis = !hostS.hasAttribute('hidden');
    const hVis = !hostH.hasAttribute('hidden');
    if (!sVis && !hVis) {
        content.setAttribute('hidden', '');
    } else {
        content.removeAttribute('hidden');
    }
};

/** Bascule panneaux curseurs / historique dans le rail Photoshop (ancré). */
window.illuToggleDockRailPanel = function (which) {
    const m = typeof window.getUILayoutMode === 'function' ? window.getUILayoutMode() : '';
    if (m !== 'photoshop') return;
    const host =
        which === 'sliders'
            ? document.getElementById('dock-rail-sliders-host')
            : document.getElementById('dock-rail-history-host');
    const btn =
        which === 'sliders'
            ? document.getElementById('btn-dock-rail-sliders')
            : document.getElementById('btn-dock-rail-history');
    if (!host || !btn) return;
    if (host.hasAttribute('hidden')) {
        host.removeAttribute('hidden');
        btn.classList.add('palette-dock-rail__tab--active');
        btn.setAttribute('aria-pressed', 'true');
    } else {
        host.setAttribute('hidden', '');
        btn.classList.remove('palette-dock-rail__tab--active');
        btn.setAttribute('aria-pressed', 'false');
    }
    if (typeof window.illuUpdateDockRailVisibility === 'function') {
        window.illuUpdateDockRailVisibility();
    }
};

/** Mode téléphone / shell : panneau RVB/TSV/Alpha toujours masqué (roue + palette uniquement). */
window.illuIsPhoneColorSlidersHidden = function () {
    return (
        document.body.classList.contains('illu-mobile-ui') ||
        document.body.classList.contains('illu-mobile-shell-active') ||
        (typeof window.isIlluMobileUiActive === 'function' && window.isIlluMobileUiActive())
    );
};

/** Panneau RVB/TSV/Alpha : toujours visible en mode Photoshop ; bouton Plus/Masquer seulement en flottant. */
window.syncColorPanelToUILayout = function () {
    const btnExpand = document.getElementById('btn-col-expand');
    const slidersPanel = document.getElementById('color-sliders-panel');
    const winColors = document.getElementById('win-colors');
    if (!slidersPanel || !winColors) return;
    const mode = typeof window.getUILayoutMode === 'function' ? window.getUILayoutMode() : 'floating';
    if (typeof window.illuIsPhoneColorSlidersHidden === 'function' && window.illuIsPhoneColorSlidersHidden()) {
        if (btnExpand) btnExpand.style.display = 'none';
        slidersPanel.style.display = 'none';
        slidersPanel.setAttribute('aria-hidden', 'true');
        if (typeof window.refreshPaletteGridLayout === 'function') window.refreshPaletteGridLayout();
        return;
    }
    const dockedLikePs = mode === 'photoshop';
    if (dockedLikePs) {
        if (btnExpand) btnExpand.style.display = 'none';
        slidersPanel.style.removeProperty('display');
        winColors.classList.add('color-window-expanded');
    } else {
        if (btnExpand) btnExpand.style.display = '';
        const exp = window._illuColorSlidersExpanded === true;
        if (exp) {
            slidersPanel.style.removeProperty('display');
            winColors.classList.add('color-window-expanded');
        } else {
            slidersPanel.style.display = 'none';
            winColors.classList.remove('color-window-expanded');
        }
        if (btnExpand) {
            const more =
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('color.more')
                    : 'Plus >>';
            const less =
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('color.less')
                    : '<< Moins';
            btnExpand.textContent = exp ? less : more;
            if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
                btnExpand.title = exp
                    ? window.IlluI18n.t('title.colorCollapse')
                    : window.IlluI18n.t('title.colorExpand');
            } else {
                btnExpand.title = exp
                    ? 'Masquer RVB, TSV et Alpha'
                    : 'Afficher les réglages RVB, TSV et Alpha';
            }
        }
    }
    if (typeof window.refreshPaletteGridLayout === 'function') window.refreshPaletteGridLayout();
};

window.applyUILayoutFromPreference = function () {
    const mode = window.getUILayoutMode();
    if (mode === 'floating') {
        mountPalettesFloating();
    } else if (mode === 'phone') {
        mountPalettesPhonePdn();
    } else {
        mountPalettesDocked();
    }
    const railEl = document.getElementById('palette-dock-rail');
    if (railEl && window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
        window.IlluI18n.apply(railEl);
    }
    if (typeof window.syncColorPanelToUILayout === 'function') window.syncColorPanelToUILayout();
    if (typeof window.refreshFloatingPaletteMenuLabels === 'function') {
        window.refreshFloatingPaletteMenuLabels();
    }
    if (typeof window.applyIlluMobileUiClass === 'function') {
        window.applyIlluMobileUiClass();
    }
    if (typeof window.illuInitToolbarRibbon === 'function') {
        window.illuInitToolbarRibbon();
    }
    if (typeof window.illuInitToolsDockAutoWidth === 'function') {
        window.illuInitToolsDockAutoWidth();
    }
    queueMicrotask(() => {
        if (typeof window.initIlluPaletteGridResizeObserver === 'function') {
            window.initIlluPaletteGridResizeObserver();
        }
        if (typeof window.refreshPaletteGridLayout === 'function') window.refreshPaletteGridLayout();
        if (typeof window.illuClampAllFloatingPalettes === 'function') window.illuClampAllFloatingPalettes();
    });
};

function illuSettingsScopeSetActive(row, value) {
    if (!row) return;
    let matched = false;
    row.querySelectorAll('.illu-scope-btn').forEach((btn) => {
        const active = (btn.getAttribute('data-value') || '') === String(value);
        btn.classList.toggle('illu-scope-btn--active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (active) matched = true;
    });
    if (!matched) {
        const first = row.querySelector('.illu-scope-btn');
        if (first) {
            first.classList.add('illu-scope-btn--active');
            first.setAttribute('aria-pressed', 'true');
        }
    }
}

function illuSettingsScopeGetValue(row, fallback) {
    if (!row) return fallback;
    const active = row.querySelector('.illu-scope-btn.illu-scope-btn--active');
    if (!active) return fallback;
    const value = active.getAttribute('data-value');
    return value == null || value === '' ? fallback : value;
}

window.illuSettingsScopeSetActive = illuSettingsScopeSetActive;
window.illuSettingsScopeGetValue = illuSettingsScopeGetValue;

function illuSettingsToggleSetActive(row, isOn) {
    if (!row) return;
    const want = isOn ? '1' : '0';
    row.setAttribute('data-illu-toggle-value', want);
    row.querySelectorAll('.illu-scope-btn').forEach((btn) => {
        const on = (btn.getAttribute('data-value') || '0') === want;
        btn.classList.toggle('illu-scope-btn--active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}

function syncIlluSettingsToggleRows(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-illu-toggle-for]').forEach((row) => {
        const input = document.getElementById(row.getAttribute('data-illu-toggle-for') || '');
        illuSettingsToggleSetActive(row, !!(input && input.checked));
    });
}

window.syncIlluSettingsToggleRows = syncIlluSettingsToggleRows;

function illuBindSettingsToggleRows() {
    const bound = document.dataset?.illuSettingsToggleBound === '1';
    if (bound) return;
    if (document.documentElement) document.documentElement.dataset.illuSettingsToggleBound = '1';
    
    document.querySelectorAll('[data-illu-toggle-for]').forEach((row) => {
        const targetId = row.getAttribute('data-illu-toggle-for') || '';
        const input = document.getElementById(targetId);
        row.addEventListener('click', (e) => {
            const btn = e.target.closest('.illu-scope-btn');
            if (!btn || !row.contains(btn) || !input) return;
            const want = (btn.getAttribute('data-value') || '0') === '1';
            input.checked = want;
            illuSettingsToggleSetActive(row, want);
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        if (input) {
            input.addEventListener('change', () => {
                illuSettingsToggleSetActive(row, !!input.checked);
            });
        }
    });
    syncIlluSettingsToggleRows(document);
}

function syncSettingsLangScopeFromStorage() {
    const row = document.getElementById('settings-lang-scope-row');
    if (!row || !window.IlluI18n || typeof window.IlluI18n.getLang !== 'function') return;
    illuSettingsScopeSetActive(row, window.IlluI18n.getLang() === 'en' ? 'en' : 'fr');
}

function syncSettingsLayoutScopeFromStorage() {
    const row = document.getElementById('settings-layout-scope-row');
    if (!row || typeof window.getUILayoutMode !== 'function') return;
    const mode = window.getUILayoutMode();
    illuSettingsScopeSetActive(row, mode === 'photoshop' || mode === 'phone' ? mode : 'floating');
}

window.syncSettingsLayoutScopeFromStorage = syncSettingsLayoutScopeFromStorage;

function syncSettingsResampleScopeFromStorage() {
    const row = document.getElementById('settings-resample-scope-row');
    if (!row) return;
    illuSettingsScopeSetActive(row, illuReadResampleMode());
}

function syncSettingsAutosaveScopeFromStorage() {
    const row = document.getElementById('settings-autosave-scope-row');
    if (!row || !window.WorkspaceIO || typeof window.WorkspaceIO.getAutoSaveMode !== 'function') return;
    const mode = window.WorkspaceIO.getAutoSaveMode();
    illuSettingsScopeSetActive(row, mode === 'interval' || mode === 'off' ? mode : 'continuous');
}

function illuEnforceLockedAppearanceStorage() {
    try {
        localStorage.setItem('illu_beta_skin', 'none');
        localStorage.setItem('illu_icon_style', 'monochrome');
    } catch (e) { /* ignore */ }
}
window.illuEnforceLockedAppearanceStorage = illuEnforceLockedAppearanceStorage;

function syncSettingsThemeVariantScopeFromStorage() {
    illuEnforceLockedAppearanceStorage();
    let variant = 'classic';
    try {
        variant = localStorage.getItem('illu_theme_variant') === 'flat' ? 'flat' : 'classic';
    } catch (e) { /* ignore */ }
    const row = document.getElementById('settings-ui-base-row');
    if (row) illuSettingsScopeSetActive(row, variant);
    
    const welcomeRow = document.getElementById('welcome-ui-base-row');
    if (welcomeRow) illuSettingsScopeSetActive(welcomeRow, variant);
}

function syncSettingsBetaSkinFromStorage() {
    illuEnforceLockedAppearanceStorage();
    const row = document.getElementById('settings-beta-skin-row');
    if (row) illuSettingsScopeSetActive(row, 'none');
}

function syncSettingsIconStyleFromStorage() {
    illuEnforceLockedAppearanceStorage();
    const row = document.getElementById('settings-icon-style-row');
    if (row) illuSettingsScopeSetActive(row, 'monochrome');
}

function syncSettingsControlsLayoutFromStorage() {
    const row = document.getElementById('settings-controls-layout-row');
    if (!row) return;
    let layout = 'right';
    try {
        layout = localStorage.getItem('illu_window_controls_layout') === 'left' ? 'left' : 'right';
    } catch (e) { /* ignore */ }
    illuSettingsScopeSetActive(row, layout);
}

function illuBindSettingsScopeRows() {
    const bound = document.dataset?.illuSettingsScopeBound === '1';
    if (bound) return;
    if (document.documentElement) document.documentElement.dataset.illuSettingsScopeBound = '1';
    
    document.querySelectorAll('.illu-settings-scope-btn-row').forEach((row) => {
        row.addEventListener('click', (e) => {
            const btn = e.target.closest('.illu-scope-btn');
            if (!btn || !row.contains(btn)) return;
            const value = btn.getAttribute('data-value');
            if (value == null || value === '') return;
            illuSettingsScopeSetActive(row, value);
            if (
                (row.id === 'settings-lang-scope-row' || row.id === 'welcome-lang-scope-row') &&
                window.IlluI18n &&
                typeof window.IlluI18n.setLang === 'function'
            ) {
                window.IlluI18n.setLang(value === 'en' ? 'en' : 'fr');
                if (typeof window.refreshChromeDocTitle === 'function') window.refreshChromeDocTitle();
                if (typeof window.EditorManager !== 'undefined' && window.EditorManager) {
                    if (typeof window.EditorManager.updateTabUI === 'function') window.EditorManager.updateTabUI();
                    if (typeof window.EditorManager.updateLayerUI === 'function') window.EditorManager.updateLayerUI();
                }
            } else if (row.id === 'settings-resample-scope-row') {
                try {
                    localStorage.setItem(ILLU_RESAMPLE_KEY, value);
                    window.illuInterpolationMode = value;
                } catch (e) { /* ignore */ }
            } else if (row.id === 'settings-ui-base-row' || row.id === 'welcome-ui-base-row') {
                try {
                    localStorage.setItem('illu_theme_variant', value);
                    if (window.IlluTheme && window.IlluTheme.applyFromStorage) {
                        window.IlluTheme.applyFromStorage();
                    }
                } catch (e) { /* ignore */ }
            }
        });
    });
}

const ILLU_UI_THUMBS_KEY = 'illu_ui_thumbs';

/** Miniatures onglets MDI + liste calques (décoché = masqué, moins de travail de rendu). */
window.illuUiThumbsEnabled = function () {
    try {
        return localStorage.getItem(ILLU_UI_THUMBS_KEY) !== '0';
    } catch (e) {
        return true;
    }
};

function syncSettingsFormFromStorage() {
    try {
        const s = localStorage.getItem('illu_accent');
        const hex =
            window.IlluTheme && typeof window.IlluTheme.normalizeAccent === 'function'
                ? window.IlluTheme.normalizeAccent(s)
                : '#0d7a7a';
        document.querySelectorAll('input[name="settings-accent"]').forEach((r) => {
            r.checked = (r.value || '').toLowerCase() === hex.toLowerCase();
        });
    } catch (e) { /* ignore */ }
    const dark = document.getElementById('settings-theme-dark');
    if (dark) {
        try {
            dark.checked = localStorage.getItem('illu_theme_dark') === '1';
        } catch (e) { /* ignore */ }
    }
    syncSettingsLangScopeFromStorage();
    syncSettingsThemeVariantScopeFromStorage();
    syncSettingsBetaSkinFromStorage();
    syncSettingsIconStyleFromStorage();
    syncSettingsControlsLayoutFromStorage();
    syncSettingsLayoutScopeFromStorage();
    syncSettingsResampleScopeFromStorage();
    const webglCb = document.getElementById('settings-webgl-blend');
    if (webglCb) {
        try {
            webglCb.checked = localStorage.getItem('illu_webgl_blend') !== '0';
        } catch (e) {
            webglCb.checked = true;
        }
    }
    const shapeAa = document.getElementById('settings-shape-antialias');
    if (shapeAa) {
        try {
            const s = localStorage.getItem('illu_tool_antialias');
            if (s === '0') shapeAa.checked = false;
            else if (s === '1') shapeAa.checked = true;
            else if (typeof window.EditorManager !== 'undefined' && window.EditorManager.toolProps) {
                shapeAa.checked = !!window.EditorManager.toolProps.antialias;
            } else {
                shapeAa.checked = true;
            }
        } catch (e) {
            shapeAa.checked = true;
        }
    }
    const ramCb = document.getElementById('settings-ram-session');
    if (ramCb) {
        try {
            ramCb.checked = localStorage.getItem('illu_ram_session_mirror') === '1';
        } catch (e) {
            ramCb.checked = false;
        }
    }
    syncSettingsAutosaveScopeFromStorage();
    const asMin = document.getElementById('settings-autosave-interval-min');
    if (asMin && window.WorkspaceIO && typeof window.WorkspaceIO.getAutoSaveIntervalMinutes === 'function') {
        asMin.value = String(window.WorkspaceIO.getAutoSaveIntervalMinutes());
    }
    const thumbsCb = document.getElementById('settings-ui-thumbs');
    if (thumbsCb) {
        try {
            thumbsCb.checked = localStorage.getItem(ILLU_UI_THUMBS_KEY) !== '0';
        } catch (e) {
            thumbsCb.checked = true;
        }
    }
    const win11Cb = document.getElementById('settings-win11-enabled');
    if (win11Cb) {
        try {
            win11Cb.checked = localStorage.getItem('settings-win11-enabled') !== '0';
        } catch (e) {
            win11Cb.checked = true;
        }
    }
    const tabBgCb = document.getElementById('settings-tab-bg-preview-enabled');
    if (tabBgCb) {
        try {
            tabBgCb.checked = localStorage.getItem('settings-tab-bg-preview-enabled') !== '0';
        } catch (e) {
            tabBgCb.checked = true;
        }
    }
    const strokeLightCb = document.getElementById('settings-stroke-light-render');
    if (strokeLightCb) {
        try {
            strokeLightCb.checked = localStorage.getItem('illu_stroke_light_render') !== '0';
        } catch (e) {
            strokeLightCb.checked = true;
        }
    }

    const histMax = document.getElementById('settings-history-max');
    if (histMax && typeof window.EditorManager !== 'undefined' && EditorManager.getHistoryMaxEntries) {
        histMax.value = String(EditorManager.getHistoryMaxEntries());
    } else if (histMax) {
        try {
            const n = parseInt(localStorage.getItem('illu_history_max_entries'), 10);
            histMax.value = String(Number.isFinite(n) && n >= 5 && n <= 500 ? n : 15);
        } catch (e) {
            histMax.value = '15';
        }
    }
    syncIlluSettingsToggleRows(document.getElementById('settings-overlay'));
}

/** Supprime toutes les clés `illu_*` du stockage local et de session, puis recharge la page. */
window.clearIlluLocalStorage = async function () {
    function removeIlluKeys(store) {
        if (!store || typeof store.length !== 'number') return;
        const keys = [];
        for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (k && (k.startsWith('illu_') || k.startsWith('settings-') || k === 'app_device_id')) {
                keys.push(k);
            }
        }
        keys.forEach((k) => {
            try {
                store.removeItem(k);
            } catch (e) { /* ignore */ }
        });
    }
    try {
        removeIlluKeys(localStorage);
        removeIlluKeys(sessionStorage);
    } catch (e) { /* ignore */ }
    if (window.WorkspaceIO && typeof window.WorkspaceIO.clearAllIlluIdbBlobs === 'function') {
        try {
            await window.WorkspaceIO.clearAllIlluIdbBlobs();
        } catch (e) { /* ignore */ }
    }
    location.reload();
};

window.showAboutIfNeeded = function () {
    if (typeof window.illuShouldAutoShowWelcome === 'function' && !window.illuShouldAutoShowWelcome()) return;
    window.showWelcomeDialog();
};

/** Jamais au démarrage automatique sur téléphone / shell mobile / fenêtre trop petite. */
window.illuIsWelcomeDialogSuppressed = function () {
    if (typeof window.illuIsPhoneLikeClient === 'function' && window.illuIsPhoneLikeClient()) return true;
    try {
        if (typeof window.getUILayoutMode === 'function' && window.getUILayoutMode() === 'phone') return true;
    } catch (e) { /* ignore */ }
    if (
        document.body &&
        (document.body.classList.contains('illu-mobile-ui') ||
            document.body.classList.contains('illu-mobile-shell-active'))
    ) {
        return true;
    }
    /* Garde-fou : viewport type téléphone (complète Client Hints / tactile). */
    try {
        const w = typeof window.innerWidth === 'number' ? window.innerWidth : 0;
        const h = typeof window.innerHeight === 'number' ? window.innerHeight : 0;
        if (w > 0 && h > 0 && (w < 900 || h < 500)) return true;
    } catch (e) { /* ignore */ }
    return false;
};

/** Afficher la fenêtre Bienvenue au boot : 1re visite OU « Voir au démarrage » = Oui (pas sur téléphone). */
window.illuMigrateWelcomeSeenKey = function () {
    try {
        if (localStorage.getItem('illu_welcome_seen') === '1') return;
        if (localStorage.getItem('illu_hide_about') === '1') {
            localStorage.setItem('illu_welcome_seen', '1');
            return;
        }
        if (localStorage.getItem('illu_ui_layout') != null) {
            localStorage.setItem('illu_welcome_seen', '1');
        }
    } catch (e) { /* ignore */ }
};

window.illuShouldAutoShowWelcome = function () {
    if (typeof window.illuMigrateWelcomeSeenKey === 'function') window.illuMigrateWelcomeSeenKey();
    if (window.illuIsWelcomeDialogSuppressed()) return false;
    try {
        const hideStartup = localStorage.getItem('illu_hide_about') === '1';
        const firstVisit = localStorage.getItem('illu_welcome_seen') !== '1';
        return firstVisit || !hideStartup;
    } catch (e) {
        return true;
    }
};

window.markWelcomeDialogSeen = function () {
    try {
        localStorage.setItem('illu_welcome_seen', '1');
    } catch (e) { /* ignore */ }
};

window.showWelcomeDialog = function (force) {
    const ov = document.getElementById('welcome-overlay');
    if (!ov) return;
    if (!force && document.body && document.body.classList.contains('illu-splash-active')) return;
    if (!force && typeof window.illuShouldAutoShowWelcome === 'function' && !window.illuShouldAutoShowWelcome()) {
        return;
    }
    if (window.IlluI18n) window.IlluI18n.apply();

    // Sync UI with storage values for the welcome window elements
    syncSettingsThemeVariantScopeFromStorage();
    syncSettingsLayoutScopeFromStorage();
    syncSettingsLangScopeFromStorage();
    const welcomeLang = document.getElementById('welcome-lang-scope-row');
    if (welcomeLang && window.IlluI18n && typeof window.IlluI18n.getLang === 'function') {
        illuSettingsScopeSetActive(welcomeLang, window.IlluI18n.getLang() === 'en' ? 'en' : 'fr');
    }
    const welcomeLayout = document.getElementById('welcome-layout-scope-row');
    if (welcomeLayout && typeof window.getUILayoutMode === 'function') {
        const mode = window.getUILayoutMode();
        illuSettingsScopeSetActive(
            welcomeLayout,
            mode === 'photoshop' || mode === 'phone' ? mode : 'floating'
        );
    }
    try {
        const hex =
            window.IlluTheme && typeof window.IlluTheme.normalizeAccent === 'function'
                ? window.IlluTheme.normalizeAccent(localStorage.getItem('illu_accent'))
                : '#0d7a7a';
        ov.querySelectorAll('input[name="welcome-accent"]').forEach((r) => {
            r.checked = (r.value || '').toLowerCase() === String(hex).toLowerCase();
        });
    } catch (e) { /* ignore */ }
    const welcomeDark = document.getElementById('welcome-theme-dark');
    if (welcomeDark) {
        try {
            welcomeDark.checked = localStorage.getItem('illu_theme_dark') === '1';
        } catch (e) {
            welcomeDark.checked = false;
        }
        const themeRow = ov.querySelector('[data-illu-toggle-for="welcome-theme-dark"]');
        if (themeRow) illuSettingsToggleSetActive(themeRow, !!welcomeDark.checked);
    }
    const welcomeStartup = document.getElementById('welcome-hide-startup');
    if (welcomeStartup) {
        try {
            welcomeStartup.checked = localStorage.getItem('illu_hide_about') === '1';
        } catch (e) {
            welcomeStartup.checked = false;
        }
        const startupRow = ov.querySelector('[data-illu-toggle-for="welcome-hide-startup"]');
        if (startupRow) illuSettingsToggleSetActive(startupRow, !!welcomeStartup.checked);
    }

    ov.style.display = 'flex';
    document.body.classList.add('no-scroll');
};

window.closeWelcomeDialog = function () {
    const ov = document.getElementById('welcome-overlay');
    if (!ov) return;
    if (typeof window.markWelcomeDialogSeen === 'function') window.markWelcomeDialogSeen();
    ov.style.display = 'none';
    document.body.classList.remove('no-scroll');
};

/** @param {boolean} [force] si true, affiche même si « ne plus afficher » a été coché. */
window.showChangelog = function () {
    fetch('changelog.txt')
        .then(response => {
            if (!response.ok) throw new Error('Changelog not found');
            return response.text();
        })
        .then(text => {
            if (window.showIlluAlert) {
                // Fetch the element to force white-space if needed, though it seems it handles pre-wrap
                const msgEl = document.getElementById('illu-alert-message');
                if (msgEl) {
                    msgEl.style.whiteSpace = 'pre-wrap';
                    msgEl.style.textAlign = 'left';
                    msgEl.style.fontFamily = 'monospace';
                    msgEl.style.fontSize = '12px';
                    msgEl.style.maxHeight = '50vh';
                    msgEl.style.overflowY = 'auto';
                }
                window.showIlluAlert(text);
            } else {
                window.alert(text);
            }
        })
        .catch(err => {
            console.error(err);
            if (window.showIlluAlert) window.showIlluAlert('Changelog indisponible.');
            else window.alert('Changelog indisponible.');
        });
};


window.showSettingsDialog = function (force) {
    const ov = document.getElementById('settings-overlay');
    if (!ov) return;
    if (!force && document.body && document.body.classList.contains('illu-splash-active')) return;
    syncSettingsFormFromStorage();
    if (window.IlluI18n) window.IlluI18n.apply();
    ov.style.display = 'flex';
    document.body.classList.add('no-scroll');
};

/** @deprecated Utiliser showSettingsDialog */
window.showAboutDialog = window.showSettingsDialog;

window.resetWorkspace = function () {
    try {
        localStorage.removeItem(ILLU_PALETTE_WINDOWS_POS_KEY);
        localStorage.removeItem(ILLU_EFFECT_DIALOG_POS_KEY);
        localStorage.removeItem(ILLU_PDN_OPEN_KEY);
        localStorage.removeItem(ILLU_FLOATING_PALETTE_VIS_KEY);
    } catch (e) {
        /* ignore */
    }

    // Réinitialise l'état développé de la fenêtre de couleur (RVB/TSV/Alpha masqués par défaut)
    window._illuColorSlidersExpanded = false;
    const winColors = document.getElementById('win-colors');
    if (winColors) {
        winColors.style.removeProperty('height');
        winColors.style.height = '';
        winColors.classList.remove('color-window-expanded');
    }
    const sliders = document.getElementById('color-sliders-panel');
    if (sliders) {
        sliders.style.display = 'none';
    }

    window.applyUILayoutFromPreference();
    if (typeof window.applyFloatingPaletteVisibility === 'function') {
        window.applyFloatingPaletteVisibility();
    }
    if (typeof window.refreshFloatingPaletteMenuLabels === 'function') {
        window.refreshFloatingPaletteMenuLabels();
    }

    if (typeof window.getUILayoutMode === 'function' && window.getUILayoutMode() === 'floating') {
        if (!document.body.classList.contains('illu-pdn-dock-active')) {
            if (typeof window.applyFloatingPaletteDefaults === 'function') window.applyFloatingPaletteDefaults();
            queueMicrotask(() => {
                if (typeof window.illuClampAllFloatingPalettes === 'function') window.illuClampAllFloatingPalettes();
            });
        }
    }
};

(function initIlluWorkspaceResizeClamp() {
    let t = null;
    window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => {
            if (typeof window.refreshPaletteGridLayout === 'function') window.refreshPaletteGridLayout();
            if (typeof window.illuClampAllFloatingPalettes === 'function') window.illuClampAllFloatingPalettes();
            if (typeof window.illuUpdatePixelGrid === 'function') window.illuUpdatePixelGrid();
            if (typeof window.illuUpdateRulers === 'function') window.illuUpdateRulers();
        }, 120);
    });
})();

window.addEventListener('illu-i18n-applied', () => {
    if (typeof window.refreshAllIlluGauges === 'function') window.refreshAllIlluGauges();
    if (typeof window.refreshFloatingPaletteMenuLabels === 'function') window.refreshFloatingPaletteMenuLabels();
    if (typeof window.refreshChromeDocTitle === 'function') window.refreshChromeDocTitle();
});

/** Titre de l’onglet navigateur / PWA : document + langue */
window.refreshChromeDocTitle = function () {
    const p = window.EditorManager && EditorManager.activeProject;
    const raw = p && p.name ? p.name : null;
    const untitled =
        window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t('app.untitled')
            : 'Sans titre';
    const name = raw || untitled;
    const mobileUi =
        typeof window.getUILayoutMode === 'function' && window.getUILayoutMode() === 'phone';
    const titleKey = mobileUi ? 'app.titleMobile' : 'app.title';
    const titleText =
        window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t(titleKey, { doc: name })
            : mobileUi
                ? `MasterPaint 98 — ${name}`
                : `MasterPaint  — ${name}`;
    if (typeof document !== 'undefined') document.title = titleText;
    if (typeof window.illuMobileSyncDocTitle === 'function') window.illuMobileSyncDocTitle();
};

/** Défilement de la barre d’onglets : molette verticale → horizontal, clic maintenu + glisser */
window.initTabBarScrollBehavior = function () {
    const wrap = document.getElementById('tab-bar-scroll');
    if (!wrap || wrap.dataset.illuTabScrollInit) return;
    wrap.dataset.illuTabScrollInit = '1';
    wrap.style.cursor = typeof window.illuGrabCursor === 'function' ? window.illuGrabCursor() : 'grab';
    wrap.addEventListener(
        'wheel',
        (e) => {
            const dy = e.deltaY;
            const dx = e.deltaX;
            if (Math.abs(dy) <= Math.abs(dx)) return;
            if (wrap.scrollWidth <= wrap.clientWidth) return;
            wrap.scrollLeft += dy;
            e.preventDefault();
        },
        { passive: false }
    );
    let drag = null;
    wrap.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest && e.target.closest('button')) return;
        if (e.target.closest && e.target.closest('.tab')) return;
        drag = { id: e.pointerId, x0: e.clientX, sl0: wrap.scrollLeft, moved: false };
        try {
            wrap.setPointerCapture(e.pointerId);
        } catch (err) {
            /* ignore */
        }
        wrap.style.cursor = 'grabbing';
    });
    wrap.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (Math.abs(e.clientX - drag.x0) > 4) drag.moved = true;
        if (drag.moved) wrap.scrollLeft = drag.sl0 - (e.clientX - drag.x0);
    });
    const endDrag = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (drag.moved) wrap._illuSuppressClickUntil = performance.now() + 120;
        try {
            wrap.releasePointerCapture(e.pointerId);
        } catch (err) {
            /* ignore */
        }
        drag = null;
        wrap.style.cursor = typeof window.illuGrabCursor === 'function' ? window.illuGrabCursor() : 'grab';
    };
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);
    wrap.addEventListener(
        'click',
        (e) => {
            if (e.target.closest && e.target.closest('.tab')) return;
            if (wrap._illuSuppressClickUntil && performance.now() < wrap._illuSuppressClickUntil) {
                e.preventDefault();
                e.stopPropagation();
            }
        },
        true
    );
};

window.centerActiveTabInScroll = function () {
    const wrap = document.getElementById('tab-bar-scroll');
    if (!wrap) return;
    const activeTab = wrap.querySelector('.tab.active');
    if (!activeTab) return;
    const wrapRect = wrap.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    const relativeLeft = tabRect.left - wrapRect.left + wrap.scrollLeft;
    const targetScrollLeft = relativeLeft - (wrapRect.width / 2) + (tabRect.width / 2);
    wrap.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
    });
};

window.updateBodyBackgroundFromActiveTabThumb = function () {
    // --- VARIABLES DE CONFIGURATION ---
    const BLUR_INTENSITY = '0px'; // Intensité du flou de l'arrière-plan
    const MAX_BRIGHTNESS = 1.5;   // Luminosité maximale (appliquée si l'image est noire/sombre)
    const MIN_BRIGHTNESS = 1;   // Luminosité minimale (appliquée si l'image est blanche/très vive)

    const bar = document.getElementById('tab-bar');
    if (!bar) return;
    
    let enabled = true;
    try {
        enabled = localStorage.getItem('settings-tab-bg-preview-enabled') !== '0';
    } catch (e) { /* ignore */ }

    // 1. Gestion du conteneur principal (bgDiv)
    let bgDiv = document.getElementById('body-bg-preview');
    if (!bgDiv) {
        bgDiv = document.createElement('div');
        bgDiv.id = 'body-bg-preview';
        bgDiv.style.position = 'fixed';
        bgDiv.style.top = '0';
        bgDiv.style.left = '0';
        bgDiv.style.width = '100vw';
        bgDiv.style.height = '70px';
        bgDiv.style.zIndex = '-1000';
        bgDiv.style.pointerEvents = 'none';
        bgDiv.style.backgroundSize = 'cover';
        bgDiv.style.backgroundPosition = 'top center';
        bgDiv.style.backgroundRepeat = 'no-repeat';
        bgDiv.style.backgroundColor = '#ffffff';
        // Évite le bord blanc (effet de halo) créé par le flou sur les bords
        bgDiv.style.transform = 'scale(1.05)';
        bgDiv.style.transformOrigin = 'top center';
        // Transition douce pour éviter les clignotements intempestifs
        bgDiv.style.transition = 'filter 0.4s ease-out';
        document.body.appendChild(bgDiv);
    }

    // 2. Gestion du calque de couleur (overlay)
    let overlay = document.getElementById('bg-color-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'bg-color-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.transition = 'background-color 0.4s ease-out';
        bgDiv.appendChild(overlay);
    }

    if (!enabled) {
        bgDiv.style.display = 'none';
        return;
    }

    const activeTab = bar.querySelector('.tab.active');
    const img = activeTab ? activeTab.querySelector('img.tab-thumb') : null;

    if (img && img.src) {
        bgDiv.style.backgroundImage = `url("${img.src}")`;
        overlay.style.backgroundColor = 'color-mix(in srgb, rgba(var(--mp-accent-rgb), 0.3), white 40%)';
        
        // --- Calcul de l'intensité (Luminosité + Couleurs vives) ---
        let brightnessFilter = window._lastValidBgBrightness != null ? window._lastValidBgBrightness : 1; 
        try {
            // Création d'un mini-canvas pour lire les pixels rapidement
            if (!window._bgPreviewAnalyzerCanvas) {
                window._bgPreviewAnalyzerCanvas = document.createElement('canvas');
                window._bgPreviewAnalyzerCanvas.width = 50; 
                window._bgPreviewAnalyzerCanvas.height = 50;
            }
            const canvas = window._bgPreviewAnalyzerCanvas;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            // On dessine l'image miniature sur le canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // On lit les pixels
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let intensitySum = 0;
            let count = 0;
            
            for (let i = 0; i < imgData.length; i += 4) {
                if (imgData[i + 3] < 128) continue; // Ignore les zones transparentes
                
                let r = imgData[i];
                let g = imgData[i + 1];
                let b = imgData[i + 2];
                
                // Luminance classique (perception de la lumière)
                let luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                
                // Intensité de la couleur (prend la valeur la plus haute parmi Rouge, Vert, Bleu)
                let maxColor = Math.max(r, g, b);
                
                // On garde la valeur la plus forte. Ainsi, un rouge vif (faible luminance mais fort maxColor) sera considéré comme "intense".
                let pixelIntensity = Math.max(luminance, maxColor);
                
                intensitySum += pixelIntensity;
                count++;
            }
            
            // On ne met à jour la luminosité que si l'image contient un minimum de pixels opaques (ex: 2%)
            // Cela évite le clignotement ("paf ça assombrit") quand on crée un nouveau calque (l'image devient brièvement vide/transparente)
            if (count > (canvas.width * canvas.height * 0.02)) {
                const avgIntensity = intensitySum / count; // Moyenne de l'intensité entre 0 et 255
                // Ajustement dynamique : une intensité élevée va vers MIN_BRIGHTNESS (assombrit)
                brightnessFilter = MAX_BRIGHTNESS - (avgIntensity / 255) * (MAX_BRIGHTNESS - MIN_BRIGHTNESS);
                window._lastValidBgBrightness = brightnessFilter;
            } else if (count === 0 && window._lastValidBgBrightness == null) {
                // Si l'image est totalement vide et qu'on n'a pas d'historique
                brightnessFilter = 1;
            }
        } catch (e) {
            // Si l'image ne peut pas être lue (ex: blocage CORS), on ignore l'erreur
            // Le brightness restera à sa valeur par défaut
        }

        // Application du filtre flou + luminosité dynamique
        bgDiv.style.filter = `blur(${BLUR_INTENSITY}) brightness(${brightnessFilter})`;

        bgDiv.style.display = 'block';
    } else {
        bgDiv.style.display = 'none';
    }
};



window.addEventListener('resize', () => {
    if (typeof window.centerActiveTabInScroll === 'function') {
        window.centerActiveTabInScroll();
    }
});

/**
 * Zoom « adapter à la fenêtre » (sans modifier le projet) : facteur CSS pour que la toile tienne dans #workspace.
 */
window.illuIsMobileShellLayout = function () {
    return document.body.classList.contains('illu-mobile-shell-active');
};

/** Hauteur réelle du dock bas (menu + .illu-mobile-dock-scroll), 0 si masqué. */
window.illuMobileBottomDockHeight = function () {
    const dock = document.getElementById('illu-mobile-bottom-dock');
    if (!dock || dock.hidden || dock.getAttribute('aria-hidden') === 'true') return 0;
    const h = dock.getBoundingClientRect().height;
    return h > 0 ? Math.ceil(h) : 0;
};

/** Marges pour le zoom « ajuster » dans #workspace (shell : #workspace a déjà le padding dock). */
window.illuMobileWorkspaceFitInsets = function () {
    const shell = window.illuIsMobileShellLayout();
    const phone = typeof window.isIlluMobileUiActive === 'function' && window.isIlluMobileUiActive();
    if (!shell && !phone) {
        return { top: 28, bottom: 28, left: 28, right: 28 };
    }
    let top = 10;
    let bottom = 10;
    let left = 10;
    let right = 10;
    if (
        shell &&
        typeof window.illuMobileEffectDialogCanvasLayout === 'function' &&
        window.illuMobileEffectDialogCanvasLayout()
    ) {
        const strip = document.getElementById('illu-mobile-opt-strip');
        if (strip && !strip.hidden) {
            bottom += Math.ceil(strip.getBoundingClientRect().height) || 0;
        }
    } else if (phone && !shell && document.body.classList.contains('illu-pdn-dock-active')) {
        bottom += 48;
    }
    return { top, bottom, left, right };
};

/**
 * Point d’ancrage du conteneur toile dans #workspace.
 * Shell mobile : haut du workspace + translate(-50%, 0) pour caler l’image en haut avec marges.
 */
/** Ancrage « haut » : uniquement pendant un dialogue d’effet en shell mobile (pinch/pan libre sinon). */
window.illuMobileEffectDialogCanvasLayout = function () {
    return (
        window.illuIsMobileShellLayout() &&
        document.body.classList.contains('effect-dialog-open')
    );
};

window.illuCanvasLayoutAnchors = function () {
    if (window.illuMobileEffectDialogCanvasLayout()) {
        const ins = window.illuMobileWorkspaceFitInsets();
        return {
            left: 50,
            top: 0,
            topPx: ins.top,
            translateX: '-50%',
            translateY: '0',
            transformOrigin: '50% 0'
        };
    }
    return {
        left: 50,
        top: 50,
        translateX: '-50%',
        translateY: '-50%',
        transformOrigin: '50% 50%'
    };
};

window.illuCanvasLayoutTransform = function (z) {
    const ax = window.illuCanvasLayoutAnchors();
    const tx = ax.translateX != null ? ax.translateX : '-50%';
    const ty = ax.translateY != null ? ax.translateY : '-50%';
    const scale = z != null ? z : 1;
    return `translate(${tx}, ${ty}) scale(${scale})`;
};

window.illuApplyCanvasViewportStyles = function (container, p) {
    if (!container || !p) return;
    const panX = p.canvasPanX != null ? p.canvasPanX : 0;
    const panY = p.canvasPanY != null ? p.canvasPanY : 0;
    const z = p.zoomLevel || 1.0;
    const ax = window.illuCanvasLayoutAnchors();
    container.style.left = `calc(${ax.left}% + ${panX}px)`;
    if (ax.topPx != null) {
        container.style.top = `${ax.topPx + panY}px`;
    } else {
        container.style.top = `calc(${ax.top}% + ${panY}px)`;
    }
    container.style.transform = window.illuCanvasLayoutTransform(z);
    container.style.transformOrigin = ax.transformOrigin || '50% 50%';
    container.style.setProperty('--canvas-zoom', String(z));

    // Met à jour la grille de pixels et les règles à chaque changement de viewport
    if (typeof window.illuUpdatePixelGrid === 'function') {
        window.illuUpdatePixelGrid();
    }
    if (typeof window.illuUpdateRulers === 'function') {
        window.illuUpdateRulers();
    }
};


/** false pendant pinch / pan tactile : évite le « recentrage » qui annule le geste. */
window.illuShouldClampCanvasPan = function () {
    if (window._illuPinchGestureActive) return false;
    if (window.isPanning) return false;
    const em = window.EditorManager;
    const p = em && em.activeProject;
    if (p && p.mode === 'vector') return false;
    if (typeof window.illuIsMobileShellLayout === 'function' && window.illuIsMobileShellLayout()) {
        return (
            typeof window.illuMobileEffectDialogCanvasLayout === 'function' &&
            window.illuMobileEffectDialogCanvasLayout()
        );
    }
    return true;
};

window.illuWorkspaceFitAvailableSize = function () {
    const ws = document.getElementById('workspace');
    if (!ws) return { availW: 1280, availH: 720 };
    const shell = window.illuIsMobileShellLayout && window.illuIsMobileShellLayout();
    const effectTop =
        typeof window.illuMobileEffectDialogCanvasLayout === 'function' &&
        window.illuMobileEffectDialogCanvasLayout();
    const phone =
        effectTop ||
        (typeof window.isIlluMobileUiActive === 'function' && window.isIlluMobileUiActive());

    /* Mobile / shell : zone utile = client moins padding (dont dock bas via padding-bottom). */
    if (shell || phone) {
        const pad = 8;
        const cs = getComputedStyle(ws);
        let pt = parseFloat(cs.paddingTop) || 0;
        let pb = parseFloat(cs.paddingBottom) || 0;
        const pl = parseFloat(cs.paddingLeft) || 0;
        const pr = parseFloat(cs.paddingRight) || 0;
        if (shell && typeof window.illuMobileBottomDockHeight === 'function') {
            const dockH = window.illuMobileBottomDockHeight();
            if (dockH > 0) pb = Math.max(pb, dockH);
        }
        const innerW = Math.max(0, ws.clientWidth - pl - pr);
        const innerH = Math.max(0, ws.clientHeight - pt - pb);
        return {
            availW: Math.max(80, innerW - pad * 2),
            availH: Math.max(80, innerH - pad * 2)
        };
    }

    const wr = ws.getBoundingClientRect();
    const ins = window.illuMobileWorkspaceFitInsets();
    const availW = Math.max(80, wr.width - ins.left - ins.right);
    let availH = Math.max(80, wr.height - ins.top - ins.bottom);
    return { availW, availH };
};

/**
 * @param {object} p projet
 * @param {object} [em] EditorManager
 * @param {{ fitWidth?: boolean }} [opts] fitWidth = adapter à la largeur utile du workspace
 */
window.computeFitZoomForProject = function (p, em, opts) {
    opts = opts || {};
    if (!p) return 1;
    const { availW, availH } = window.illuWorkspaceFitAvailableSize();
    const dw = window.ILLU_DEFAULT_DOC_WIDTH || 1280;
    const dh = window.ILLU_DEFAULT_DOC_HEIGHT || 720;
    const docW = Math.max(1, p.width || dw);
    const docH = Math.max(1, p.height || dh);
    let z = availW / docW;
    if (!opts.fitWidth && docH * z > availH) z = availH / docH;
    return Math.max(0.05, z);
};

/** Zoom CSS max : toiles très petites (32×32) doivent pouvoir grossir bien au-delà du « fit ». */
window.illuMaxZoomLevelForProject = function (p) {
    if (!p) return 64;
    const { availW, availH } = window.illuWorkspaceFitAvailableSize();
    const docW = Math.max(1, p.width || 1);
    const docH = Math.max(1, p.height || 1);
    const fitZ = window.computeFitZoomForProject(p);
    const minDoc = Math.min(docW, docH);
    const maxScreen = Math.max(availW, availH);
    const pixelArtCap = Math.ceil((maxScreen / minDoc) * 6);
    const relativeCap = fitZ * 48;
    return Math.max(10, Math.min(256, Math.max(relativeCap, pixelArtCap)));
};

window.illuMinZoomLevelForProject = function () {
    return 0.05;
};

/** Affichage zoom : 100 % = niveau « adapter à la fenêtre », pas le 1:1 pixel. */
window.IlluZoomUi = {
    getDisplayPercent(p) {
        if (!p) return 100;
        const z = p.zoomLevel != null ? p.zoomLevel : 1;
        const fitZ = window.computeFitZoomForProject(p);
        if (!fitZ || fitZ < 1e-8) return Math.round(z * 100);
        return Math.max(1, Math.min(5000, Math.round((z / fitZ) * 100)));
    },
    setFromDisplayPercent(p, pct) {
        if (!p) return;
        const fitZ = window.computeFitZoomForProject(p);
        const maxZ = window.illuMaxZoomLevelForProject(p);
        const n = Number(pct);
        const pc = Number.isFinite(n) ? Math.max(1, Math.min(5000, n)) : 100;
        p.zoomLevel = Math.max(
            window.illuMinZoomLevelForProject(),
            Math.min(maxZ, fitZ * (pc / 100))
        );
    }
};

/** Ajuste le zoom du projet actif pour que la toile tienne dans #workspace → affichage 100 %. */
window.fitActiveProjectZoomToWorkspace = function (em, opts) {
    opts = opts || {};
    const force = !!opts.force;
    const onDocumentOpen = !!opts.onDocumentOpen;
    if (
        !force &&
        !onDocumentOpen &&
        typeof window.illuIsMobileShellLayout === 'function' &&
        window.illuIsMobileShellLayout() &&
        !(
            typeof window.illuMobileEffectDialogCanvasLayout === 'function' &&
            window.illuMobileEffectDialogCanvasLayout()
        )
    ) {
        return;
    }
    const EditorManager = em || window.EditorManager;
    const p = EditorManager && EditorManager.activeProject;
    if (!p) return;
    p.zoomLevel = window.computeFitZoomForProject(p, EditorManager, {
        fitWidth: !!opts.fitWidth
    });
    p.canvasPanX = 0;
    p.canvasPanY = 0;
    const cont = document.getElementById('main-canvas-container');
    if (typeof window.illuApplyCanvasViewportStyles === 'function' && cont) {
        window.illuApplyCanvasViewportStyles(cont, p);
    } else if (typeof EditorManager.applyProjectToUI === 'function') {
        EditorManager.applyProjectToUI();
    }
    if (
        typeof EditorManager.clampCanvasPanInWorkspace === 'function' &&
        window.illuShouldClampCanvasPan()
    ) {
        EditorManager.clampCanvasPanInWorkspace(
            window.illuMobileEffectDialogCanvasLayout() ? 14 : 48
        );
    }
    if (typeof window.syncIlluMenubarZoomControls === 'function') {
        window.syncIlluMenubarZoomControls();
    }
};

/** À l’ouverture d’image / nouveau projet : adapter à la largeur du workspace (mobile inclus). */
window.fitActiveProjectZoomToPageWidth = function (em) {
    return window.fitActiveProjectZoomToWorkspace(em, { force: true, fitWidth: true, onDocumentOpen: true });
};

window.scheduleFitActiveProjectZoomToPageWidth = function (em) {
    const target = em || window.EditorManager;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.fitActiveProjectZoomToPageWidth(target);
        });
    });
};

/** Ouverture image / nouveau projet : adapter au workspace (comme le bouton « Ajuster »). */
window.scheduleFitActiveProjectZoomOnDocumentOpen = function (em) {
    const target = em || window.EditorManager;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (typeof window.fitActiveProjectZoomToWorkspace === 'function') {
                window.fitActiveProjectZoomToWorkspace(target, { force: true, onDocumentOpen: true });
            }
        });
    });
};

/** Shell mobile : ajuster — tient dans #workspace au-dessus du dock (largeur + hauteur). */
window.fitActiveProjectZoomToWorkspaceMobile = function (em) {
    return window.fitActiveProjectZoomToWorkspace(em, { force: true });
};

/** Shell mobile : ajuster calé en haut — uniquement à l’ouverture d’un dialogue d’effet. */
window.fitActiveProjectZoomToWorkspaceForEffect = function (em) {
    if (!window.illuIsMobileShellLayout()) return;
    if (!document.body.classList.contains('effect-dialog-open')) return;
    return window.fitActiveProjectZoomToWorkspace(em, { force: true });
};

let _illuMobileCanvasFitTimer = 0;
window.scheduleIlluMobileCanvasFit = function () {
    if (!window.illuIsMobileShellLayout()) return;
    if (!document.body.classList.contains('effect-dialog-open')) return;
    clearTimeout(_illuMobileCanvasFitTimer);
    _illuMobileCanvasFitTimer = setTimeout(() => {
        if (typeof window.fitActiveProjectZoomToWorkspaceForEffect === 'function') {
            window.fitActiveProjectZoomToWorkspaceForEffect();
        }
    }, 140);
};

window.syncIlluMenubarZoomControls = function () {
    const p = window.EditorManager && window.EditorManager.activeProject;
    const slider = document.getElementById('illu-zoom-slider');
    const valEl = document.getElementById('illu-zoom-value');
    const stZoom = document.getElementById('status-zoom');
    if (!p) {
        if (valEl) valEl.textContent = '—';
        const gw = document.getElementById('illu-zoom-gauge-wrap');
        if (gw) gw.style.setProperty('--illu-gauge-pct', '0%');
        return;
    }
    const pct = window.IlluZoomUi.getDisplayPercent(p);
    const smin = slider ? parseInt(slider.min, 10) || 10 : 10;
    const smax = slider ? parseInt(slider.max, 10) || 500 : 500;
    const clamped = Math.min(smax, Math.max(smin, pct));
    if (slider) {
        slider._illuFromApp = true;
        slider.value = String(clamped);
        slider.setAttribute('aria-valuenow', String(Math.round(pct)));
        slider._illuFromApp = false;
    }
    const label = `${pct}%`;
    if (valEl) valEl.textContent = label;
    const gaugeWrap = document.getElementById('illu-zoom-gauge-wrap');
    if (gaugeWrap && slider) {
        const v = parseFloat(slider.value);
        const smn = parseFloat(slider.min) || 10;
        const smx = parseFloat(slider.max) || 500;
        const fillPct = smx > smn ? ((v - smn) / (smx - smn)) * 100 : 0;
        gaugeWrap.style.setProperty('--illu-gauge-pct', `${Math.max(0, Math.min(100, fillPct))}%`);
    }
    if (stZoom) {
        const t =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('status.zoom', { z: pct })
                : null;
        stZoom.textContent = t || `Zoom : ${pct} %`;
    }

    // Met à jour la grille de pixels et les règles lors du zoom
    if (typeof window.illuUpdatePixelGrid === 'function') window.illuUpdatePixelGrid();
    if (typeof window.illuUpdateRulers === 'function') window.illuUpdateRulers();
};


function illuInitMenubarToolbar() {
    const slider = document.getElementById('illu-zoom-slider');
    const zOut = document.getElementById('illu-tb-zoom-out');
    const zIn = document.getElementById('illu-tb-zoom-in');
    if (!slider) return;
    const stepPct = () => {
        const w = window.innerWidth || 1200;
        if (w < 480) return 15;
        if (w < 900) return 10;
        return 5;
    };
    const applyPct = (pct) => {
        const em = window.EditorManager;
        const p = em && em.activeProject;
        if (!p) return;
        window.IlluZoomUi.setFromDisplayPercent(p, pct);
        em.applyCanvasViewportOnly();
        em.clampCanvasPanInWorkspace(48);
        window.syncIlluMenubarZoomControls();
    };
    slider.addEventListener('input', () => {
        if (slider._illuFromApp) return;
        applyPct(parseInt(slider.value, 10));
    });
    slider.addEventListener('change', () => {
        if (slider._illuFromApp) return;
        applyPct(parseInt(slider.value, 10));
    });
    if (zOut) {
        zOut.addEventListener('click', () => {
            const em = window.EditorManager;
            const p = em && em.activeProject;
            if (!p) return;
            const cur = window.IlluZoomUi.getDisplayPercent(p);
            applyPct(cur - stepPct());
        });
    }
    if (zIn) {
        zIn.addEventListener('click', () => {
            const em = window.EditorManager;
            const p = em && em.activeProject;
            if (!p) return;
            const cur = window.IlluZoomUi.getDisplayPercent(p);
            applyPct(cur + stepPct());
        });
    }
    const ws = document.getElementById('workspace');
    if (ws && typeof ResizeObserver !== 'undefined') {
        let t = 0;
        const ro = new ResizeObserver(() => {
            clearTimeout(t);
            t = setTimeout(() => window.syncIlluMenubarZoomControls(), 80);
        });
        ro.observe(ws);
    }
    const tb = document.querySelector('.illu-menubar-toolbar');
    if (tb && window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
        window.IlluI18n.apply(tb);
    }
}

let _illuLivePreviewRaf = 0;
let _illuLivePreviewWin = null;

/** Fenêtre / onglet : copie 1:1 du canvas principal (pixels document), mise à jour en direct. */
window.openCanvasLivePreviewWindow = function () {
    const mc = document.getElementById('drawing-canvas');
    const em = window.EditorManager;
    if (!mc || !em || !em.activeProject) return;
    if (_illuLivePreviewWin && !_illuLivePreviewWin.closed) {
        try {
            _illuLivePreviewWin.focus();
        } catch (e) {
            /* ignore */
        }
        return;
    }
    const w = window.open('', 'illu_canvas_live');
    if (!w) {
        const msg =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('msg.popupBlocked')
                : 'Autorisez les pop-ups pour afficher l’aperçu toile.';
        window.showIlluAlert(msg);
        return;
    }
    _illuLivePreviewWin = w;
    const doc = w.document;
    doc.open();
    const title =
        window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t('livePreview.title')
            : 'Aperçu toile 1:1';
    doc.write(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
        title +
        '</title><style>html,body{margin:0;padding:0;overflow:auto;background:#1a1a1a;}canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges;}</style></head><body><canvas id="illu-pv"></canvas></body></html>'
    );
    doc.close();
    const loop = () => {
        _illuLivePreviewRaf = 0;
        if (!w || w.closed) {
            _illuLivePreviewWin = null;
            return;
        }
        _illuLivePreviewRaf = window.requestAnimationFrame(loop);
        try {
            const mgr = window.EditorManager;
            const pc = w.document.getElementById('illu-pv');
            if (!mgr || !mgr.activeProject || !pc) return;
            const pw = mgr.activeProject.width;
            const ph = mgr.activeProject.height;
            if (pc.width !== pw || pc.height !== ph) {
                pc.width = pw;
                pc.height = ph;
            }
            const ctx = pc.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            if (mgr.pixelDomLayerViewsActive && mgr.pixelDomLayerViewsActive()) {
                const stack = document.getElementById('pixel-layer-stack');
                ctx.clearRect(0, 0, pw, ph);
                mgr.layers.forEach((l, i) => {
                    if (!l.visible || !l.buffer) return;
                    const el = stack && stack.querySelector(`canvas.illu-pixel-layer-view[data-layer-id="${l.id}"]`);
                    if (!el) return;
                    ctx.save();
                    ctx.globalAlpha = l.opacity != null ? l.opacity : 1;
                    ctx.globalCompositeOperation = mgr.getLayerBlendMode(l);
                    ctx.drawImage(el, l.x, l.y);
                    ctx.restore();
                });
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
            } else {
                const canvas = document.getElementById('drawing-canvas');
                if (!canvas) return;
                ctx.drawImage(canvas, 0, 0);
            }
        } catch (err) {
            /* fenêtre fermée ou accès refusé */
        }
    };
    _illuLivePreviewRaf = window.requestAnimationFrame(loop);
};

/** Prise d'instantané 1:1 et impression propre. */
window.printCanvasLive = function () {
    const em = window.EditorManager;
    if (!em || !em.activeProject) return;
    const p = em.activeProject;
    const pw = p.width;
    const ph = p.height;
    
    // Créer un canvas temporaire
    const pc = document.createElement('canvas');
    pc.width = pw;
    pc.height = ph;
    const ctx = pc.getContext('2d');
    if (!ctx) return;
    
    if (em.pixelDomLayerViewsActive && em.pixelDomLayerViewsActive()) {
        const stack = document.getElementById('pixel-layer-stack');
        ctx.clearRect(0, 0, pw, ph);
        const layers = p.layers || [];
        layers.forEach((l) => {
            if (!l.visible || !l.buffer) return;
            const el = stack && stack.querySelector(`canvas.illu-pixel-layer-view[data-layer-id="${l.id}"]`);
            if (!el) return;
            ctx.save();
            ctx.globalAlpha = l.opacity != null ? l.opacity : 1;
            ctx.globalCompositeOperation = em.getLayerBlendMode ? em.getLayerBlendMode(l) : 'source-over';
            ctx.drawImage(el, l.x, l.y);
            ctx.restore();
        });
    } else {
        const canvas = document.getElementById('drawing-canvas');
        if (canvas) {
            ctx.drawImage(canvas, 0, 0);
        }
    }
    
    // Conversion en Data URL (PNG)
    const dataUrl = pc.toDataURL('image/png');
    
    // Ouvrir une fenêtre d'impression
    const w = window.open('', '_blank');
    if (!w) {
        const msg =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('msg.popupBlocked')
                : 'Autorisez les pop-ups pour imprimer la toile.';
        window.showIlluAlert(msg);
        return;
    }
    
    const title =
        window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t('livePreview.title') || 'Impression MasterPaint'
            : 'Impression MasterPaint';
            
    const doc = w.document;
    doc.open();
    doc.write(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
        title +
        '</title><style>' +
        '@page { size: auto; margin: 10mm; }' +
        'html,body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#ffffff;}' +
        'img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated;image-rendering:crisp-edges;}' +
        '</style></head><body>' +
        '<img id="prt-img" src="' + dataUrl + '">' +
        '<script>' +
        'window.onload = function() {' +
        '  setTimeout(function() {' +
        '    window.print();' +
        '    setTimeout(function() { window.close(); }, 500);' +
        '  }, 300);' +
        '};' +
        '</script>' +
        '</body></html>'
    );
    doc.close();
};

/** Thème : accent (barre de titre, menus) + sombre */
window.IlluTheme = {
    ACCENT_PRESETS: [
        '#b91c1c',
        '#f97316',
        '#b45309',
        '#ca8a04',
        '#166534',
        '#059669',
        '#0d7a7a',
        '#0891b2',
        '#2563eb',
        '#0f2d5c',
        '#4338ca',
        '#5b21b6',
        '#c026d3',
        '#db2777'
    ],
    isAllowedAccent(hex) {
        const h = String(hex || '').trim().toLowerCase();
        return /^#[0-9a-f]{6}$/.test(h) && this.ACCENT_PRESETS.includes(h);
    },
    normalizeAccent(hex) {
        const h = String(hex || '').trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(h) && this.ACCENT_PRESETS.includes(h)) return h;
        return '#0d7a7a';
    },
    /** Texte lisible sur fond accent (menus, listes) : noir ou blanc selon luminance WCAG. */
    menuHoverForegroundForAccent(hex) {
        const rgb = this.hexToRgb(hex);
        const lin = rgb.map((c) => {
            const x = c / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        });
        const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
        return L > 0.52 ? '#1a1a1a' : '#ffffff';
    },
    hexToRgb(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
        if (!m) return [15, 45, 92];
        return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    },
    rgbToHex(r, g, b) {
        const h = (n) => {
            const x = Math.max(0, Math.min(255, Math.round(n))).toString(16);
            return x.length === 1 ? `0${x}` : x;
        };
        return `#${h(r)}${h(g)}${h(b)}`;
    },
    mix(a, b, t) {
        return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
    },
    applyFromStorage() {
        if (typeof illuEnforceLockedAppearanceStorage === 'function') {
            illuEnforceLockedAppearanceStorage();
        }
        let hex = '#0d7a7a';
        try {
            const s = localStorage.getItem('illu_accent');
            hex = this.normalizeAccent(s);
        } catch (e) { /* ignore */ }
        const rgb = this.hexToRgb(hex);
        const light = this.mix(rgb, [255, 255, 255], 0.38);
        const dark = this.mix(rgb, [0, 0, 0], 0.25);
        const r = document.documentElement;
        r.style.setProperty('--mp-title', this.rgbToHex(dark[0], dark[1], dark[2]));
        r.style.setProperty('--mp-title-light', this.rgbToHex(light[0], light[1], light[2]));
        r.style.setProperty('--mp-accent', hex);
        r.style.setProperty('--mp-accent-rgb', rgb.join(', '));
        r.style.setProperty('--mp-menu-hover-fg', this.menuHoverForegroundForAccent(hex));
        let darkTheme = false;
        try {
            darkTheme = localStorage.getItem('illu_theme_dark') === '1';
        } catch (e) { /* ignore */ }
        const isPhotoMode = document.body.classList.contains('illu-photo-mode-active');
        document.body.classList.toggle('theme-dark', darkTheme || isPhotoMode);

        let w11 = true;
        try {
            w11 = localStorage.getItem('settings-win11-enabled') !== '0';
        } catch (e) { /* ignore */ }
        document.body.classList.toggle('win11-effects', w11);

        document.body.classList.remove('illu-flat-colored-icons', 'illu-colored-icons');

        let themeVariant = 'flat';
        try {
            const stored = localStorage.getItem('illu_theme_variant');
            if (stored === 'classic') themeVariant = 'classic';
        } catch(e) {}

        // Force classic Windows 98 theme on mobile/phone UI
        const isMobileMode = (document.body && document.body.classList.contains('illu-mobile-ui')) || 
                             (typeof window.getUILayoutMode === 'function' && window.getUILayoutMode() === 'phone') ||
                             (typeof window.isIlluMobileUiActive === 'function' && window.isIlluMobileUiActive());
        if (isMobileMode) {
            themeVariant = 'classic';
        }

        const classicLink = document.getElementById('theme-link-classic');
        const flatLink = document.getElementById('theme-link-flat');
        if (classicLink && flatLink) {
            if (themeVariant === 'flat') {
                classicLink.disabled = true;
                flatLink.disabled = false;
            } else {
                classicLink.disabled = false;
                flatLink.disabled = true;
            }
        } else if (classicLink) {
            classicLink.disabled = false;
        }

        const deskHex = '#0d8f8f';
        window._illuSplashDeskColor = deskHex;
        document.documentElement.style.setProperty('--illu-splash-desk', deskHex);
        document.body.style.backgroundColor = deskHex;
        const sp = document.getElementById('illu-splash');
        if (sp) sp.style.backgroundColor = deskHex;
    }
};

/**
 * Thème / accent / langue : mise à jour immédiate depuis le formulaire Paramètres
 * (localStorage + apply), sans attendre « OK ».
 */
function initSettingsLiveApply() {
    const ov = document.getElementById('settings-overlay');
    if (!ov || ov.dataset.illuLiveApply === '1') return;
    ov.dataset.illuLiveApply = '1';
    illuBindSettingsToggleRows();

    const applyDarkFromForm = () => {
        const dk = document.getElementById('settings-theme-dark');
        try {
            localStorage.setItem('illu_theme_dark', dk && dk.checked ? '1' : '0');
        } catch (e) { /* ignore */ }
        if (window.IlluTheme && typeof window.IlluTheme.applyFromStorage === 'function') {
            window.IlluTheme.applyFromStorage();
        }
    };

    const applyAccentFromForm = () => {
        const ar = document.querySelector('#settings-overlay input[name="settings-accent"]:checked');
        const hex = ar && ar.value;
        if (
            hex &&
            window.IlluTheme &&
            typeof window.IlluTheme.isAllowedAccent === 'function' &&
            window.IlluTheme.isAllowedAccent(hex)
        ) {
            try {
                localStorage.setItem('illu_accent', hex);
            } catch (e) { /* ignore */ }
            window.IlluTheme.applyFromStorage();
        }
    };

    const applyLangFromForm = () => {
        const row = document.getElementById('settings-lang-scope-row');
        const lang = illuSettingsScopeGetValue(row, 'fr');
        if (window.IlluI18n && typeof window.IlluI18n.setLang === 'function') {
            window.IlluI18n.setLang(lang === 'en' ? 'en' : 'fr');
            if (typeof window.IlluI18n.apply === 'function') window.IlluI18n.apply();
        }
        if (typeof window.refreshChromeDocTitle === 'function') window.refreshChromeDocTitle();
        if (typeof window.EditorManager !== 'undefined' && window.EditorManager) {
            if (typeof window.EditorManager.updateTabUI === 'function') window.EditorManager.updateTabUI();
            if (typeof window.EditorManager.updateLayerUI === 'function') window.EditorManager.updateLayerUI();
        }
    };

    const applyLockedAppearanceFromForm = () => {
        illuEnforceLockedAppearanceStorage();
        syncSettingsThemeVariantScopeFromStorage();
        syncSettingsBetaSkinFromStorage();
        syncSettingsIconStyleFromStorage();
        if (window.IlluTheme && typeof window.IlluTheme.applyFromStorage === 'function') {
            window.IlluTheme.applyFromStorage();
        }
    };

    const dark = document.getElementById('settings-theme-dark');
    if (dark) dark.addEventListener('change', applyDarkFromForm);

    const applyWin11FromForm = () => {
        const w11 = document.getElementById('settings-win11-enabled');
        try {
            localStorage.setItem('settings-win11-enabled', w11 && w11.checked ? '1' : '0');
        } catch (e) { /* ignore */ }
        if (window.IlluTheme && typeof window.IlluTheme.applyFromStorage === 'function') {
            window.IlluTheme.applyFromStorage();
        }
    };
    const win11 = document.getElementById('settings-win11-enabled');
    if (win11) win11.addEventListener('change', applyWin11FromForm);

    const applyTabBgFromForm = () => {
        const tbg = document.getElementById('settings-tab-bg-preview-enabled');
        try {
            localStorage.setItem('settings-tab-bg-preview-enabled', tbg && tbg.checked ? '1' : '0');
        } catch (e) { /* ignore */ }
        if (typeof window.updateBodyBackgroundFromActiveTabThumb === 'function') {
            window.updateBodyBackgroundFromActiveTabThumb();
        }
    };
    const tabBg = document.getElementById('settings-tab-bg-preview-enabled');
    if (tabBg) tabBg.addEventListener('change', applyTabBgFromForm);

    ov.querySelectorAll('input[name="settings-accent"]').forEach((r) => {
        r.addEventListener('change', applyAccentFromForm);
    });

    illuBindSettingsScopeRows();
    window.illuBindWelcomeWindow();
    const langRow = document.getElementById('settings-lang-scope-row');
    if (langRow) langRow.addEventListener('click', applyLangFromForm);
    const variantRow = document.getElementById('settings-ui-base-row');
    if (variantRow) variantRow.addEventListener('click', applyLockedAppearanceFromForm);
    const betaSkinRow = document.getElementById('settings-beta-skin-row');
    if (betaSkinRow) betaSkinRow.addEventListener('click', applyLockedAppearanceFromForm);
    const iconStyleRow = document.getElementById('settings-icon-style-row');
    if (iconStyleRow) iconStyleRow.addEventListener('click', applyLockedAppearanceFromForm);

    const strokeLight = document.getElementById('settings-stroke-light-render');
    if (strokeLight) {
        strokeLight.addEventListener('change', () => {
            try {
                localStorage.setItem('illu_stroke_light_render', strokeLight.checked ? '1' : '0');
            } catch (e) { /* ignore */ }
            if (window.EditorManager && typeof window.EditorManager.render === 'function') {
                window.EditorManager.render();
            }
        });
    }

}

window.addEventListener('illu-mobile-ui-changed', () => {
    if (window.IlluTheme && typeof window.IlluTheme.applyFromStorage === 'function') {
        window.IlluTheme.applyFromStorage();
    }
    if (typeof window.refreshPaletteGridLayout === 'function') window.refreshPaletteGridLayout();
});

document.addEventListener('DOMContentLoaded', () => {
    if (window.IlluTheme) window.IlluTheme.applyFromStorage();
    initSettingsLiveApply();
    if (typeof window.initIlluPaletteGridResizeObserver === 'function') {
        window.initIlluPaletteGridResizeObserver();
    }
    if (typeof window.refreshPaletteGridLayout === 'function') window.refreshPaletteGridLayout();
    if (typeof window.refreshChromeDocTitle === 'function') window.refreshChromeDocTitle();
    if (typeof window.initTabBarScrollBehavior === 'function') window.initTabBarScrollBehavior();

    // Initialisation de la grille de pixels et des règles
    if (typeof window.syncIlluPixelGridUI === 'function') window.syncIlluPixelGridUI();
    if (typeof window.syncIlluRulersUI === 'function') window.syncIlluRulersUI();
    if (typeof window.syncIlluSnapToEdgesUI === 'function') window.syncIlluSnapToEdgesUI();
    if (typeof EditorManager !== 'undefined') {
        EditorManager.snapToEdges = !!window._illuSnapToEdges;
    }
});

// ==========================================
// GRILLE DE PIXELS & RÈGLES (Style Paint.NET)
// ==========================================

const ILLU_SHOW_PIXEL_GRID_KEY = 'illu_show_pixel_grid';
const ILLU_SHOW_RULERS_KEY = 'illu_show_rulers';

try {
    window._illuShowPixelGrid = localStorage.getItem(ILLU_SHOW_PIXEL_GRID_KEY) === 'true';
    window._illuShowRulers = localStorage.getItem(ILLU_SHOW_RULERS_KEY) === 'true';
} catch (e) {
    window._illuShowPixelGrid = false;
    window._illuShowRulers = false;
}

window.toggleIlluPixelGrid = function () {
    window._illuShowPixelGrid = !window._illuShowPixelGrid;
    try {
        localStorage.setItem(ILLU_SHOW_PIXEL_GRID_KEY, String(window._illuShowPixelGrid));
    } catch (e) {}
    window.syncIlluPixelGridUI();
};

window.toggleIlluRulers = function () {
    window._illuShowRulers = !window._illuShowRulers;
    try {
        localStorage.setItem(ILLU_SHOW_RULERS_KEY, String(window._illuShowRulers));
    } catch (e) {}
    window.syncIlluRulersUI();
    if (typeof window.illuClampAllFloatingPalettes === 'function') {
        requestAnimationFrame(() => window.illuClampAllFloatingPalettes());
    }
};

const ILLU_SNAP_EDGES_KEY = 'illu_snap_edges';
try {
    window._illuSnapToEdges = localStorage.getItem(ILLU_SNAP_EDGES_KEY) === 'true';
} catch (e) {
    window._illuSnapToEdges = false;
}
window.toggleIlluSnapToEdges = function () {
    window._illuSnapToEdges = !window._illuSnapToEdges;
    try {
        localStorage.setItem(ILLU_SNAP_EDGES_KEY, String(window._illuSnapToEdges));
    } catch (e) {}
    window.syncIlluSnapToEdgesUI();
    if (typeof EditorManager !== 'undefined') {
        EditorManager.snapToEdges = window._illuSnapToEdges;
    }
    if (typeof window.illuDrawSnapGridPreview === 'function') {
        window.illuDrawSnapGridPreview();
    }
};

window.syncIlluSnapToEdgesUI = function () {
    const checkEl = document.getElementById('menu-win-snap-edges-check');
    if (checkEl) {
        checkEl.style.visibility = window._illuSnapToEdges ? 'visible' : 'hidden';
    }
    document.querySelectorAll('.opt-toggle-snap').forEach(btn => {
        btn.classList.toggle('active', !!window._illuSnapToEdges);
        btn.classList.toggle('illu-icon-toggle--on', !!window._illuSnapToEdges);
        btn.setAttribute('aria-pressed', window._illuSnapToEdges ? 'true' : 'false');
    });
};

window.syncIlluPixelGridUI = function () {
    const checkEl = document.getElementById('menu-win-pixel-grid-check');
    if (checkEl) {
        checkEl.style.visibility = window._illuShowPixelGrid ? 'visible' : 'hidden';
    }
    document.querySelectorAll('.opt-toggle-pixelgrid').forEach(btn => {
        btn.classList.toggle('active', !!window._illuShowPixelGrid);
        btn.classList.toggle('illu-icon-toggle--on', !!window._illuShowPixelGrid);
        btn.setAttribute('aria-pressed', window._illuShowPixelGrid ? 'true' : 'false');
    });
    const overlay = document.getElementById('pixel-grid-overlay');
    if (overlay) {
        overlay.style.display = window._illuShowPixelGrid ? 'block' : 'none';
    }
    if (typeof window.illuUpdatePixelGrid === 'function') {
        window.illuUpdatePixelGrid();
    }
};

window.syncIlluRulersUI = function () {
    const checkEl = document.getElementById('menu-win-rulers-check');
    if (checkEl) {
        checkEl.style.visibility = window._illuShowRulers ? 'visible' : 'hidden';
    }
    document.querySelectorAll('.opt-toggle-rulers').forEach(btn => {
        btn.classList.toggle('active', !!window._illuShowRulers);
        btn.classList.toggle('illu-icon-toggle--on', !!window._illuShowRulers);
        btn.setAttribute('aria-pressed', window._illuShowRulers ? 'true' : 'false');
    });
    const rTop = document.getElementById('ruler-top');
    const rLeft = document.getElementById('ruler-left');
    const rCorner = document.getElementById('ruler-corner');
    if (rTop && rLeft && rCorner) {
        const d = window._illuShowRulers ? 'block' : 'none';
        rTop.style.display = d;
        rLeft.style.display = d;
        rCorner.style.display = d;
    }
    if (typeof window.illuUpdateRulers === 'function') {
        window.illuUpdateRulers();
    }
    if (typeof window.illuClampAllFloatingPalettes === 'function') {
        requestAnimationFrame(() => window.illuClampAllFloatingPalettes());
    }
};

/**
 * Cache des motifs de grille (patterns croisés) pour un alignement parfait.
 * Un pattern horizontal pour les lignes verticales, un pattern vertical pour les lignes horizontales.
 * Reconstruit uniquement quand w, h, zoom ou thème changent.
 */
let _illuGridVertPattern = null;   // pattern pour lignes verticales (répété Y)
let _illuGridHorizPattern = null;  // pattern pour lignes horizontales (répété X)
let _illuGridCacheKey = '';

window.illuUpdatePixelGrid = function () {
    const overlay = document.getElementById('pixel-grid-overlay');
    const drawingCanvas = document.getElementById('drawing-canvas');
    const workspace = document.getElementById('workspace');
    if (!overlay || !drawingCanvas || !workspace) return;
    
    if (!window._illuShowPixelGrid) {
        overlay.style.display = 'none';
        _illuGridVertPattern = null;
        _illuGridHorizPattern = null;
        _illuGridCacheKey = '';
        if (typeof window.illuDrawSnapGridPreview === 'function') window.illuDrawSnapGridPreview();
        return;
    }
    
    const p = window.EditorManager && window.EditorManager.activeProject;
    if (!p) {
        overlay.style.display = 'none';
        _illuGridVertPattern = null;
        _illuGridHorizPattern = null;
        _illuGridCacheKey = '';
        if (typeof window.illuDrawSnapGridPreview === 'function') window.illuDrawSnapGridPreview();
        return;
    }
    
    const z = p.zoomLevel || 1.0;
    // La grille de pixels s'affiche uniquement au-delà d'un zoom de 400% (zoomLevel >= 4)
    if (z < 4.0) {
        overlay.style.display = 'none';
        _illuGridVertPattern = null;
        _illuGridHorizPattern = null;
        _illuGridCacheKey = '';
        if (typeof window.illuDrawSnapGridPreview === 'function') window.illuDrawSnapGridPreview();
        return;
    }
    
    overlay.style.display = 'block';
    
    const wsRect = workspace.getBoundingClientRect();
    const canvasRect = drawingCanvas.getBoundingClientRect();
    
    const left = canvasRect.left - wsRect.left;
    const top = canvasRect.top - wsRect.top;
    const width = canvasRect.width;
    const height = canvasRect.height;
    
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    
    const wRound = Math.round(width);
    const hRound = Math.round(height);
    if (overlay.width !== wRound || overlay.height !== hRound) {
        overlay.width = wRound;
        overlay.height = hRound;
    }
    
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    const w = p.width;
    const h = p.height;
    const isDark = document.body.classList.contains('theme-dark');
    const cacheKey = `${w}x${h}x${z}x${isDark}`;
    
    // Reconstruire les patterns seulement si nécessaire
    if (cacheKey !== _illuGridCacheKey) {
        _illuGridVertPattern = null;
        _illuGridHorizPattern = null;
        
        const color = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(128, 128, 128, 0.4)';
        
        // --- Pattern pour les lignes verticales (répété verticalement) ---
        // Canvas horizontal de 1px de haut contenant tous les traits verticaux
        if (w > 1) {
            const vertCanvas = document.createElement('canvas');
            const vertW = Math.ceil(w * z);
            vertCanvas.width = Math.max(1, vertW);
            vertCanvas.height = 1;
            const vCtx = vertCanvas.getContext('2d');
            vCtx.strokeStyle = color;
            vCtx.lineWidth = 1;
            vCtx.beginPath();
            for (let x = 1; x < w; x++) {
                const sx = Math.round(x * z) - 0.5;
                vCtx.moveTo(sx, 0);
                vCtx.lineTo(sx, 1);
            }
            vCtx.stroke();
            _illuGridVertPattern = ctx.createPattern(vertCanvas, 'repeat-y');
        }
        
        // --- Pattern pour les lignes horizontales (répété horizontalement) ---
        // Canvas vertical de 1px de large contenant tous les traits horizontaux
        if (h > 1) {
            const horizCanvas = document.createElement('canvas');
            const horizH = Math.ceil(h * z);
            horizCanvas.width = 1;
            horizCanvas.height = Math.max(1, horizH);
            const hCtx = horizCanvas.getContext('2d');
            hCtx.strokeStyle = color;
            hCtx.lineWidth = 1;
            hCtx.beginPath();
            for (let y = 1; y < h; y++) {
                const sy = Math.round(y * z) - 0.5;
                hCtx.moveTo(0, sy);
                hCtx.lineTo(1, sy);
            }
            hCtx.stroke();
            _illuGridHorizPattern = ctx.createPattern(horizCanvas, 'repeat-x');
        }
        
        _illuGridCacheKey = cacheKey;
    }
    
    // Appliquer les deux patterns croisés (ordre sans importance)
    if (_illuGridVertPattern) {
        ctx.fillStyle = _illuGridVertPattern;
        ctx.fillRect(0, 0, overlay.width, overlay.height);
    }
    if (_illuGridHorizPattern) {
        ctx.fillStyle = _illuGridHorizPattern;
        ctx.fillRect(0, 0, overlay.width, overlay.height);
    }
    
    if (typeof window.illuDrawSnapGridPreview === 'function') window.illuDrawSnapGridPreview();
};

window.illuUpdateRulers = function () {
    const rTop = document.getElementById('ruler-top');
    const rLeft = document.getElementById('ruler-left');
    const drawingCanvas = document.getElementById('drawing-canvas');
    const workspace = document.getElementById('workspace');
    
    if (!rTop || !rLeft || !drawingCanvas || !workspace) return;
    
    if (!window._illuShowRulers) {
        rTop.style.display = 'none';
        rLeft.style.display = 'none';
        const rCorner = document.getElementById('ruler-corner');
        if (rCorner) rCorner.style.display = 'none';
        return;
    }
    
    const p = window.EditorManager && window.EditorManager.activeProject;
    if (!p) return;
    
    const z = p.zoomLevel || 1.0;
    const wsRect = workspace.getBoundingClientRect();
    const canvasRect = drawingCanvas.getBoundingClientRect();
    
    const canvasStartX = canvasRect.left - wsRect.left;
    const canvasStartY = canvasRect.top - wsRect.top;
    
    const w = p.width;
    const h = p.height;
    
    const isDark = document.body.classList.contains('theme-dark');
    const rulerBg = isDark ? '#2b2b2b' : '#f0f0f0';
    const rulerBorder = isDark ? '#555555' : '#808080';
    const tickColor = isDark ? '#888888' : '#808080';
    const minorTickColor = isDark ? '#444444' : '#c0c0c0';
    const textColor = isDark ? '#aaaaaa' : '#000000';
    
    const wsW = workspace.clientWidth;
    const wsH = workspace.clientHeight;
    
    rTop.style.background = rulerBg;
    rTop.style.borderBottom = `1px solid ${rulerBorder}`;

    rTop.width = wsW;
    rTop.height = 18;
    
    rLeft.style.background = rulerBg;
    rLeft.style.borderRight = `1px solid ${rulerBorder}`;

    rLeft.width = 18;
    rLeft.height = wsH;
    
    const rCorner = document.getElementById('ruler-corner');
    if (rCorner) {
        rCorner.style.display = 'block';
        rCorner.style.background = isDark ? '#202020' : '#e0e0e0';
        rCorner.style.borderRight = `1px solid ${rulerBorder}`;
        rCorner.style.borderBottom = `1px solid ${rulerBorder}`;
    }
    
    let step = 100;
    if (z >= 20) step = 1;
    else if (z >= 10) step = 5;
    else if (z >= 5) step = 10;
    else if (z >= 2) step = 20;
    else if (z >= 1) step = 50;
    else if (z >= 0.5) step = 100;
    else if (z >= 0.2) step = 200;
    else step = 500;
    
    // 1. Règle horizontale
    {
        const width = rTop.width;
        const height = rTop.height;
        
        const ctx = rTop.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        
        ctx.strokeStyle = tickColor;
        ctx.fillStyle = textColor;
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        
        const startX = canvasStartX;
        const startCX = Math.max(0, Math.floor(-startX / z));
        const endCX = Math.min(w, Math.ceil((width - startX) / z));
        
        for (let cx = Math.floor(startCX / step) * step; cx <= endCX; cx += step) {
            const sx = startX + cx * z;
            if (sx < 0 || sx > width) continue;
            
            ctx.strokeStyle = tickColor;
            ctx.beginPath();
            ctx.moveTo(Math.round(sx) - 0.5, height - 6);
            ctx.lineTo(Math.round(sx) - 0.5, height);
            ctx.stroke();
            
            ctx.fillText(String(cx), sx, 10);
            
            
            const minorStep = step / 5;
            if (minorStep >= 1) {
                ctx.strokeStyle = minorTickColor;
                for (let m = 1; m < 5; m++) {
                    const msx = sx + m * minorStep * z;
                    if (msx >= 0 && msx <= width) {
                        ctx.beginPath();
                        ctx.moveTo(Math.round(msx) - 0.5, height - 3);
                        ctx.lineTo(Math.round(msx) - 0.5, height);
                        ctx.stroke();
                    }
                }
            }
        }
        
        // Draw Symmetry X marker
        if (typeof window.illuGetSymmetryAxes === 'function') {
            const sym = window.illuGetSymmetryAxes();
            if (sym && sym.x) {
                const sx = startX + sym.cx * z;
                if (sx >= 0 && sx <= width) {
                    ctx.fillStyle = '#00ffff';
                    ctx.beginPath();
                    ctx.moveTo(sx, height);
                    ctx.lineTo(sx - 4, height - 6);
                    ctx.lineTo(sx + 4, height - 6);
                    ctx.fill();
                }
            }
        }
    }
    
    // 2. Règle verticale
    {
        const width = rLeft.width;
        const height = rLeft.height;
        
        const ctx = rLeft.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        
        ctx.strokeStyle = tickColor;
        ctx.fillStyle = textColor;
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        const startY = canvasStartY;
        const startCY = Math.max(0, Math.floor(-startY / z));
        const endCY = Math.min(h, Math.ceil((height - startY) / z));
        
        for (let cy = Math.floor(startCY / step) * step; cy <= endCY; cy += step) {
            const sy = startY + cy * z;
            if (sy < 0 || sy > height) continue;
            
            ctx.strokeStyle = tickColor;
            ctx.beginPath();
            ctx.moveTo(width - 6, Math.round(sy) - 0.5);
            ctx.lineTo(width, Math.round(sy) - 0.5);
            ctx.stroke();
            
            ctx.fillText(String(cy), width - 8, sy);
            
            const minorStep = step / 5;
            if (minorStep >= 1) {
                ctx.strokeStyle = minorTickColor;
                for (let m = 1; m < 5; m++) {
                    const msy = sy + m * minorStep * z;
                    if (msy >= 0 && msy <= height) {
                        ctx.beginPath();
                        ctx.moveTo(width - 3, Math.round(msy) - 0.5);
                        ctx.lineTo(width, Math.round(msy) - 0.5);
                        ctx.stroke();
                    }
                }
            }
        }
        
        if (typeof window.illuGetSymmetryAxes === 'function') {
            const sym = window.illuGetSymmetryAxes();
            if (sym && sym.y) {
                const sy = startY + sym.cy * z;
                if (sy >= 0 && sy <= height) {
                    ctx.fillStyle = '#00ffff';
                    ctx.beginPath();
                    ctx.moveTo(width, sy);
                    ctx.lineTo(width - 6, sy - 4);
                    ctx.lineTo(width - 6, sy + 4);
                    ctx.fill();
                }
            }
        }
    }

    if (
        window._illuShowRulers &&
        typeof window.getUILayoutMode === 'function' &&
        window.getUILayoutMode() === 'floating' &&
        typeof window.illuClampAllFloatingPalettes === 'function'
    ) {
        requestAnimationFrame(() => window.illuClampAllFloatingPalettes());
    }
};

window.illuBindWelcomeWindow = function () {
    const welcome = document.getElementById('welcome-overlay');
    if (!welcome) return;

    if (welcome.dataset.illuWelcomeBound !== '1') {
        welcome.dataset.illuWelcomeBound = '1';
        welcome.addEventListener('click', (e) => {
            if (e.target === welcome && typeof window.closeWelcomeDialog === 'function') {
                window.closeWelcomeDialog();
            }
        });
    }
    
    // Bind scopes manually since we renamed IDs
    welcome.querySelectorAll('.illu-settings-scope-btn-row').forEach((row) => {
        row.addEventListener('click', (e) => {
            const btn = e.target.closest('.illu-scope-btn');
            if (!btn || !row.contains(btn)) return;
            const value = btn.getAttribute('data-value');
            if (value == null || value === '') return;
            illuSettingsScopeSetActive(row, value);
            
            // Sync with actual settings
            if (row.id === 'welcome-lang-scope-row') {
                const sr = document.getElementById('settings-lang-scope-row');
                if (sr) illuSettingsScopeSetActive(sr, value);
                if (window.IlluI18n && typeof window.IlluI18n.setLang === 'function') {
                    window.IlluI18n.setLang(value === 'en' ? 'en' : 'fr');
                    if (typeof window.refreshChromeDocTitle === 'function') window.refreshChromeDocTitle();
                    if (typeof window.EditorManager !== 'undefined' && window.EditorManager) {
                        if (typeof window.EditorManager.updateTabUI === 'function') window.EditorManager.updateTabUI();
                        if (typeof window.EditorManager.updateLayerUI === 'function') window.EditorManager.updateLayerUI();
                    }
                }
            } else if (row.id === 'welcome-layout-scope-row') {
                const sr = document.getElementById('settings-layout-scope-row');
                if (sr) illuSettingsScopeSetActive(sr, value);
                try {
                    localStorage.setItem('illu_ui_layout', value);
                } catch(e){}
            }
        });
    });

    // Theme dark toggle
    const themeRow = welcome.querySelector('[data-illu-toggle-for="welcome-theme-dark"]');
    const themeInput = document.getElementById('welcome-theme-dark');
    if (themeRow && themeInput) {
        themeRow.addEventListener('click', (e) => {
            const btn = e.target.closest('.illu-scope-btn');
            if (!btn || !themeRow.contains(btn)) return;
            const want = (btn.getAttribute('data-value') || '0') === '1';
            themeInput.checked = want;
            illuSettingsToggleSetActive(themeRow, want);
            themeInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        themeInput.addEventListener('change', () => {
            illuSettingsToggleSetActive(themeRow, !!themeInput.checked);
            try {
                localStorage.setItem('illu_theme_dark', themeInput.checked ? '1' : '0');
            } catch (e) { /* ignore */ }
            if (window.IlluTheme && typeof window.IlluTheme.applyFromStorage === 'function') {
                window.IlluTheme.applyFromStorage();
            }
            // Sync settings form checkbox
            const dk = document.getElementById('settings-theme-dark');
            if (dk) {
                dk.checked = themeInput.checked;
                const sr = document.querySelector('[data-illu-toggle-for="settings-theme-dark"]');
                if (sr) illuSettingsToggleSetActive(sr, dk.checked);
            }
        });
    }

    // Accents
    welcome.querySelectorAll('input[name="welcome-accent"]').forEach((r) => {
        r.addEventListener('change', () => {
            if (!r.checked) return;
            const hex = r.value;
            try {
                localStorage.setItem('illu_accent', hex);
            } catch (e) {}
            if (window.IlluTheme && typeof window.IlluTheme.applyFromStorage === 'function') {
                window.IlluTheme.applyFromStorage();
            }
            // Sync settings form
            document.querySelectorAll('input[name="settings-accent"]').forEach((sr) => {
                sr.checked = (sr.value || '').toLowerCase() === hex.toLowerCase();
            });
        });
    });

    // Startup checkbox
    const startupRow = welcome.querySelector('[data-illu-toggle-for="welcome-hide-startup"]');
    const startupInput = document.getElementById('welcome-hide-startup');
    if (startupRow && startupInput) {
        startupRow.addEventListener('click', (e) => {
            const btn = e.target.closest('.illu-scope-btn');
            if (!btn || !startupRow.contains(btn)) return;
            const want = (btn.getAttribute('data-value') || '0') === '1';
            startupInput.checked = want;
            illuSettingsToggleSetActive(startupRow, want);
            try {
                if (want) localStorage.setItem('illu_hide_about', '1');
                else localStorage.removeItem('illu_hide_about');
            } catch (e) {}
        });
    }

    // Commencer a dessiner button
    const startBtn = welcome.querySelector('.welcome-dialog-start-btn');
    if (startBtn) {
        startBtn.onclick = () => {
            if (typeof window.closeWelcomeDialog === 'function') window.closeWelcomeDialog();
            else welcome.style.display = 'none';
            // Save layout on close just in case
            try {
                const row = document.getElementById('welcome-layout-scope-row');
                const layout = window.illuSettingsScopeGetValue ? window.illuSettingsScopeGetValue(row, 'floating') : 'floating';
                if (layout === 'photoshop' || layout === 'floating' || layout === 'phone') {
                    localStorage.setItem('illu_ui_layout', layout);
                    if (window.EditorManager && typeof window.EditorManager.applyProjectToUI === 'function') {
                        window.EditorManager.applyProjectToUI();
                    }
                }
            } catch (e) {}
        };
    }
};

