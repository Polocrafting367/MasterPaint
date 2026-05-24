/** Ouvre le sélecteur de fichier image (input #file-import) — utilisé par menu, toolbar, raccourci O. */
window.illuTriggerFileImport = function () {
    const fi = document.getElementById('file-import');
    if (fi) {
        fi.click();
        return true;
    }
    console.warn('[MasterPaint] Élément #file-import introuvable — import impossible.');
    return false;
};

window.ctxMenu = document.getElementById('context-menu');

// Close on outside click (with small delay to let item onclick fire first)
document.addEventListener('click', (e) => {
    if (window.ctxMenu && !window.ctxMenu.contains(e.target)) {
        setTimeout(closeCtxMenu, 50);
    }
});

window.addEventListener('illu-i18n-applied', () => {
    if (typeof rebuildContextMenuMarkup === 'function') rebuildContextMenuMarkup();
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
});

// --- CORRECTIF BAGUETTE : Lier le menu HTML à la logique JavaScript ---
document.getElementById('wand-mode')?.addEventListener('change', (e) => {
    if (window.EditorManager) EditorManager.toolProps.wandMode = e.target.value;
    const wandFullRow = document.getElementById('wand-fullscreen-row');
    if (wandFullRow) wandFullRow.hidden = (e.target.value !== 'similar');
});

document.getElementById('wand-color-full-layer')?.addEventListener('change', (e) => {
    if (window.EditorManager) EditorManager.toolProps.wandColorFullLayer = e.target.checked;
});

document.getElementById('wand-tolerance')?.addEventListener('input', (e) => {
    const valEl = document.getElementById('wand-tolerance-val');
    if (valEl) valEl.textContent = e.target.value;
    if (window.EditorManager) EditorManager.toolProps.wandTolerance = parseInt(e.target.value, 10);
});

/** Molette sur un select : option précédente / suivante (sélecteur d’outil, listes, etc.). */
window.illuStepSelectOnWheel = function (select, deltaY) {
    if (!select || select.tagName !== 'SELECT' || select.disabled || select.multiple) return false;
    const opts = select.options;
    const n = opts.length;
    if (n < 2 || !deltaY) return false;
    const dir = deltaY > 0 ? 1 : -1;
    let idx = select.selectedIndex;
    if (idx < 0) idx = 0;
    for (let step = 0; step < n; step++) {
        idx = (idx + dir + n) % n;
        const opt = opts[idx];
        if (!opt || opt.disabled || opt.hidden) continue;
        if (select.selectedIndex !== idx) {
            select.selectedIndex = idx;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
    }
    return false;
};

document.addEventListener(
    'wheel',
    (e) => {
        const t = e.target;
        if (!t || t.tagName !== 'SELECT' || t.disabled || t.multiple) return;
        if (t.options.length < 2 || !e.deltaY) return;
        e.preventDefault();
        e.stopPropagation();
        window.illuStepSelectOnWheel(t, e.deltaY);
    },
    { passive: false, capture: true }
);





// Advanced Paste for Images (System + Internal + Async Fallback)
document.addEventListener('paste', async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const dt = e.clipboardData || e.originalEvent?.clipboardData;
    if (!dt) return;

    console.log('Paste: Processing event...');
    let blob = null;
    let importOpts = {};

    // 1. Try files collection
    if (dt.files && dt.files.length > 0) {
        for (let i = 0; i < dt.files.length; i++) {
            if (dt.files[i].type.indexOf('image') !== -1) {
                blob = dt.files[i];
                break;
            }
        }
    }

    // 2. Try items collection
    if (!blob) {
        let imageItem = null;
        let textItem = null;
        for (let i = 0; i < dt.items.length; i++) {
            const item = dt.items[i];
            if (item.type.indexOf('image') !== -1) imageItem = item;
            else if (item.type === 'text/plain') textItem = item;
        }
        if (imageItem) blob = imageItem.getAsFile();
        if (textItem) {
            textItem.getAsString((str) => {
                if (str && str.startsWith('ILLU_META:')) {
                    try {
                        const json = JSON.parse(str.substring(10));
                        if (json && json.app === 'illu') {
                            importOpts.pasteProjectId = json.projectId;
                            importOpts.pasteDocBounds = { x: json.x, y: json.y, w: json.w, h: json.h };
                        }
                    } catch (err) { }
                }
            });
        }
    }

    // 3. Robust Check & Async Fallback for 0-byte blobs (Linux/Wayland common issue)
    if (!blob || blob.size === 0) {
        console.log('Paste: Found empty/zero blob, attempting Async Clipboard API fallback...');
        try {
            if (navigator.clipboard && navigator.clipboard.read) {
                const items = await navigator.clipboard.read();
                for (const item of items) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            blob = await item.getType(type);
                            console.log('Paste: Found image via Async API', type, blob.size);
                            break;
                        }
                    }
                    if (blob && blob.size > 0) break;
                }
            }
        } catch (err) {
            console.warn('Paste: Async Clipboard API denied access', err);
        }
    }

    if (!blob || blob.size === 0) {
        if (blob) {
            console.error('Paste: Still 0 bytes. Access denied by OS/Browser.');
            if (window.showIlluAlert) {
                window.showIlluAlert(
                    window.IlluI18n?.t
                        ? "Le navigateur n'a pas pu accéder au contenu de l'image (0 octets). Essayez de glisser l'image directement ou utilisez Fichier > Ouvrir."
                        : "The browser could not access the image data (0 bytes). Try dragging the file directly or use File > Open."
                );
            }
        }
        return;
    }

    e.preventDefault();
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => EditorManager.promptImport(img, importOpts);
        img.src = ev.target.result;
    };
    reader.readAsDataURL(blob);
});

document.addEventListener('copy', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (typeof window.ctxCopy === 'function') {
        window.ctxCopy();
    }
});

document.addEventListener('cut', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (typeof window.ctxCut === 'function') {
        window.ctxCut();
    }
});

// Drag and Drop (Global)
window.addEventListener('dragenter', (e) => e.preventDefault());
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
    if (e.target.closest('#workspace') || e.target.closest('#main-canvas-container')) {
        e.preventDefault();
        const files = e.dataTransfer.files;
        const uriList = e.dataTransfer.getData('text/uri-list');

        if (files.length === 0) {
            console.log('Drop: No files. URI-list Content:', uriList);
            return;
        }

        const f0 = files[0];
        console.log('Drop: File info:', f0.name, f0.type, f0.size);

        if (f0.size === 0) {
            console.error('Drop: 0-byte file detected. URI-list:', uriList);
            if (window.showIlluAlert) {
                window.showIlluAlert(
                    "Fichier inaccessible (0 octets). Il s'agit peut-être d'un lien système que le navigateur ne peut pas lire directement. Utilisez le bouton d'importation (O).");
            }
            return;
        }

        if (typeof window.illuProcessFileImport === 'function') {
            window.illuProcessFileImport(f0);
        } else {
            // Fallback legacy (should not happen since it's defined in DrawingTools.js)
            if (f0.type.indexOf('image') !== -1) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => EditorManager.promptImport(img);
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(f0);
            }
        }
    }
});

// Global Middle-Click Canvas Panning (Bulletproof implementation via capture-phase on window)
window.addEventListener('pointerdown', (e) => {
    if (e.button === 1) { // Middle mouse button
        const p = window.EditorManager && EditorManager.activeProject;
        if (!p) return;
        window.isPanning = true;
        window.panStart = { x: e.clientX, y: e.clientY };
        window.panDragOrigin = { x: p.canvasPanX || 0, y: p.canvasPanY || 0 };
        document.body.style.cursor = 'grabbing';
        const ws = document.getElementById('workspace');
        if (ws) ws.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

window.addEventListener('pointermove', (e) => {
    if (!window.isPanning) return;
    window._illuLastClientX = e.clientX;
    window._illuLastClientY = e.clientY;
    const p = window.EditorManager && EditorManager.activeProject;
    if (!p) return;
    p.canvasPanX = window.panDragOrigin.x + (e.clientX - window.panStart.x);
    p.canvasPanY = window.panDragOrigin.y + (e.clientY - window.panStart.y);
    EditorManager.applyCanvasViewportOnly();
    e.preventDefault();
    e.stopPropagation();
}, true);

window.addEventListener('pointerup', (e) => {
    if (window.isPanning && e.button === 1) {
        window.isPanning = false;
        document.body.style.cursor = '';
        const ws = document.getElementById('workspace');
        if (ws) ws.style.cursor = '';
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

window.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

const workspaceEl = document.getElementById('workspace');

if (workspaceEl) {
    workspaceEl.addEventListener('wheel', (e) => {
        const t = window.activeTool || 'select';

        // Si Ctrl est enfoncé, on zoome toujours et on bloque le scroll
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.08 : -0.08;
            EditorManager.zoom(delta, e.clientX, e.clientY);
            return;
        }

        // Si on est précisément sur le canevas, on peut capturer le wheel pour les outils
        const onCanvas = e.target.closest('#main-canvas-container');

        // Sinon, comportement contextuel
        const isSizeTool = ['brush', 'pencil', 'eraser'].includes(t);
        const isTextTool = (t === 'text');

        if (onCanvas && isSizeTool) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 5 : -5;
            window.adjustToolSizeStep(delta);
        } else if (onCanvas && isTextTool) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 2 : -2;
            window.adjustTextSizeStep(delta);
        } else if (onCanvas) {
            // Zoom direct sur canevas sans Ctrl
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.08 : -0.08;
            EditorManager.zoom(delta, e.clientX, e.clientY);
        }
        // Si on n'est pas sur le canevas, on laisse le wheel buller pour scroller la page
    }, { passive: false });
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Annuler pen/polygon en cours
        if (window.VectorEngine) {
            if (window.VectorEngine.isPenActive()) {
                window.VectorEngine.penCommit();
                e.preventDefault(); return;
            }
            if (window.VectorEngine.isPolygonActive()) {
                window.VectorEngine.polygonCommit();
                e.preventDefault(); return;
            }
        }
        if (window._illuDeformMoveFromButtonActive && typeof window.illuHandleMouseUp === 'function') {
            const sx = window._illuLastClientX != null ? window._illuLastClientX : 0;
            const sy = window._illuLastClientY != null ? window._illuLastClientY : 0;
            window.illuHandleMouseUp({
                button: 0, clientX: sx, clientY: sy,
                shiftKey: !!e.shiftKey, altKey: !!e.altKey, ctrlKey: !!e.ctrlKey,
                preventDefault() { }, stopPropagation() { }
            });
            e.preventDefault();
            return;
        }
        if (typeof window.finalizePendingPixelLiveEdits === 'function' && window.finalizePendingPixelLiveEdits()) {
            e.preventDefault();
            return;
        }
        if (typeof window.setVectorQuadBezierClickState === 'function') {
            window.setVectorQuadBezierClickState(null);
        } else {
            window.vectorQuadBezierClickState = null;
        }
        if (typeof window._quadBezierPreviewDoc !== 'undefined') window._quadBezierPreviewDoc = null;
        EditorManager.deselectAll();
        return;
    }
    if (
        e.key === 'Enter' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isFormFieldTarget(e.target) &&
        EditorManager &&
        typeof EditorManager.commitImportPlacementIfPending === 'function' &&
        EditorManager.commitImportPlacementIfPending()
    ) {
        e.preventDefault();
        return;
    }
    if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
    ) {
        if (isFormFieldTarget(e.target)) return;
        if (typeof window.deleteActiveVectorOrPixelSelection === 'function' && window.deleteActiveVectorOrPixelSelection()) {
            e.preventDefault();
        }
        return;
    }

    /* Ctrl+A : tout sélectionner sur la toile (tout outil), sauf édition texte pixel inline dans le canevas */
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !e.shiftKey) {
        const ae = document.activeElement;
        if (
            ae &&
            ae.isContentEditable === true &&
            ae.closest &&
            ae.closest('#main-canvas-container')
        ) {
            /* laisser le navigateur sélectionner le texte dans l’éditeur */
        } else if (EditorManager.activeProject) {
            e.preventDefault();
            EditorManager.selectAll();
            return;
        }
    }

    if (isFormFieldTarget(e.target)) return;

    if (
        (window.activeTool === 'move' || window.activeTool === 'deform') &&
        EditorManager.activeProject
    ) {
        const ak = e.key;
        if (ak === 'ArrowUp' || ak === 'ArrowDown' || ak === 'ArrowLeft' || ak === 'ArrowRight') {
            e.preventDefault();
            const step = e.ctrlKey || e.metaKey ? 10 : 1;
            let dx = 0;
            let dy = 0;
            if (ak === 'ArrowLeft') dx = -step;
            else if (ak === 'ArrowRight') dx = step;
            else if (ak === 'ArrowUp') dy = -step;
            else if (ak === 'ArrowDown') dy = step;
            EditorManager.applyMoveToolNudge(dx, dy);
            return;
        }
    }

    if (!e.ctrlKey && !e.metaKey) {
        if (
            typeof window.activateIlluToolByShortcut === 'function' &&
            window.activateIlluToolByShortcut(e)
        ) {
            e.preventDefault();
            return;
        }
        const dec = e.key === '[' || e.code === 'BracketLeft';
        const inc = e.key === ']' || e.code === 'BracketRight';
        if ((dec || inc) && ['brush', 'pencil', 'eraser'].includes(window.activeTool)) {
            e.preventDefault();
            window.adjustToolSizeStep(dec ? -1 : 1);
        }
        return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    const k = e.key.toLowerCase();

    if (e.shiftKey && (k === 'h' || k === 'v' || k === 'c')) {
        e.preventDefault();
        if (k === 'h') EditorManager.centerSelection('h');
        else if (k === 'v') EditorManager.centerSelection('v');
        else EditorManager.centerSelection('both');
        return;
    }

    if (k === 'z' && e.shiftKey) {
        e.preventDefault();
        EditorManager.doHistory(1);
        return;
    }
    if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        EditorManager.doHistory(-1);
        return;
    }
    if (k === 'y' && !e.shiftKey) {
        e.preventDefault();
        EditorManager.doHistory(1);
        return;
    }

    if (k === 'd' && !e.shiftKey) {
        e.preventDefault();
        if (typeof window.finalizePendingPixelLiveEdits === 'function' && window.finalizePendingPixelLiveEdits()) {
            return;
        }
        EditorManager.deselectAll();
        return;
    }

    if (k === 'n' && !e.shiftKey) {
        e.preventDefault();
        if (typeof window.showNewProjectDialog === 'function') window.showNewProjectDialog();
        return;
    }
    if (k === 'o' && !e.shiftKey) {
        e.preventDefault();
        if (typeof window.illuTriggerFileImport === 'function') window.illuTriggerFileImport();
        return;
    }
    if (k === 's') {
        e.preventDefault();
        if (e.shiftKey) {
            // Force export dialog (Save As)
            if (typeof window.WorkspaceIO?.showExportDialog === 'function') window.WorkspaceIO.showExportDialog();
        } else {
            // Smart save (silent if auto-save is on)
            if (typeof window.saveFile === 'function') window.saveFile();
        }
        return;
    }

    if (k === 'i') {
        e.preventDefault();
        if (e.shiftKey) {
            if (typeof window.applyEffect === 'function') window.applyEffect('invert');
        } else {
            EditorManager.invertSelection();
        }
        return;
    }

    // v, c, x are now handled by global copy/cut/paste event listeners to support OS integration
    if (k === 'v' && !e.shiftKey) return;
    if (k === 'c' && !e.shiftKey) return;
    if (k === 'x' && !e.shiftKey) return;

    if (k === '+' || k === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        EditorManager.zoom(0.1);
        return;
    }
    if (k === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        EditorManager.zoom(-0.1);
        return;
    }
});

document.addEventListener('contextmenu', (e) => {
    const em = window.EditorManager;
    const layerRow = e.target.closest('#layers-list .layer-row');
    if (layerRow) {
        if (e.target.closest('.layer-row button') || e.target.closest('.layer-eye')) {
            closeCtxMenu();
            return;
        }
        if (em && em.activeProject) {
            const idx = parseInt(layerRow.dataset.layerIndex, 10);
            if (Number.isFinite(idx)) {
                e.preventDefault();
                window.ctxMenu.innerHTML = buildLayerContextMenuInnerHtml(idx);
                window.ctxMenu.style.display = 'block';
                queueMicrotask(() => positionContextMenuNearEvent(e));
                return;
            }
        }
    }

    const tabBar = document.getElementById('tab-bar');
    const tab = tabBar && e.target.closest('.tab');
    if (tab && tabBar.contains(tab)) {
        if (e.target.closest('.tab button')) {
            closeCtxMenu();
            return;
        }
        if (em && em.projects) {
            const pi = parseInt(tab.dataset.projectIndex, 10);
            if (Number.isFinite(pi) && em.projects[pi]) {
                e.preventDefault();
                window.ctxMenu.innerHTML = buildTabContextMenuInnerHtml(pi, em.projects[pi]);
                window.ctxMenu.style.display = 'block';
                queueMicrotask(() => positionContextMenuNearEvent(e));
                return;
            }
        }
    }

    if (e.target.closest('#main-canvas-container') || e.target.closest('#workspace')) {
        e.preventDefault();
        rebuildContextMenuMarkup();
        window.ctxMenu.style.display = 'block';
        queueMicrotask(() => positionContextMenuNearEvent(e));
    } else {
        closeCtxMenu();
    }
});


(function () {
    if (!window._illuSelectionModeWired) {
        window._illuSelectionModeWired = true;
        window.selectionMode = 'new';
        const grp = document.getElementById('selection-mode-group');
        if (grp) {
            grp.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-selection-mode]');
                if (!btn) return;
                window.selectionMode = btn.getAttribute('data-selection-mode');
                btn.classList.add('active');
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
                if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
            });
        }

        // Hidden sync controls listeners
        ['tool-brush-pattern', 'tool-gradient-type', 'tool-gradient-method'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    if (id === 'tool-brush-pattern') EditorManager.toolProps.brushPattern = el.value;
                    if (id === 'tool-gradient-type') EditorManager.toolProps.gradientType = el.value;
                    if (id === 'tool-gradient-method') EditorManager.toolProps.gradientMethod = el.value;
                    window.syncAllToolbarToggles();
                    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
                });
            }
        });
        const pClose = document.getElementById('tool-pencil-close');
        if (pClose) {
            pClose.addEventListener('change', () => {
                EditorManager.toolProps.pencilAutoClose = pClose.checked;
                window.syncAllToolbarToggles();
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            });
        }
    }

    function refreshShapeToolLivePreview() {
        if (window.VectorEngine && typeof window.VectorEngine.refreshLiveDrawPreview === 'function') {
            window.VectorEngine.refreshLiveDrawPreview();
        }
        if (typeof window.redrawShapeFromEdit === 'function') window.redrawShapeFromEdit();
        if (typeof EditorManager !== 'undefined' && EditorManager.render) EditorManager.render();
    }

    const ILLU_ICON_SYNC_TOOL_PROPS = {
        'tool-shape-mode': (val) => {
            if (typeof EditorManager !== 'undefined') EditorManager.toolProps.shapeStrokeMode = val;
            refreshShapeToolLivePreview();
        },
        'tool-fill-type': (val) => {
            if (typeof EditorManager !== 'undefined') {
                let fv = val || 'solid';
                if (fv !== 'solid' && fv !== 'gradient') fv = 'solid';
                EditorManager.toolProps.fillType = fv;
            }
            refreshShapeToolLivePreview();
        },
        'tool-shape-grad-type': () => {
            refreshShapeToolLivePreview();
        },
        'tool-text-fill': (val) => {
            if (typeof EditorManager !== 'undefined') {
                const v = val === 'gradient' || val === 'none' ? val : 'solid';
                EditorManager.toolProps.textFillType = v;
            }
            if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
        },
        'wand-mode': (val) => {
            if (typeof EditorManager !== 'undefined') {
                EditorManager.toolProps.wandMode = val === 'contiguous' ? 'contiguous' : 'similar';
            }
            const wandFullRow = document.getElementById('wand-fullscreen-row');
            if (wandFullRow) wandFullRow.hidden = val !== 'similar';
        },
        'fill-mode': (val) => {
            if (typeof EditorManager !== 'undefined') {
                EditorManager.toolProps.fillMode = val === 'layer' ? 'layer' : 'contiguous';
            }
        }
    };

    function resolveToolbarToggleButton(target) {
        if (!target || typeof target.closest !== 'function') return null;
        if (!target.closest('#tool-options-container')) return null;

        const direct = target.closest(
            'button.illu-icon-toggle, button[data-illu-brush-sync], button[data-selection-mode]'
        );
        if (direct) return direct;

        const item = target.closest('.illu-mode-toggle-item--unified, .illu-mode-toggle-item');
        if (!item) return null;
        return item.querySelector(
            'button.illu-icon-toggle, button[data-illu-brush-sync], button[data-selection-mode]'
        );
    }

    function setupIlluGenericIconToggles() {
        if (document.body.dataset.illuGenericIconToggles === '1') return;
        document.body.dataset.illuGenericIconToggles = '1';

        document.body.addEventListener('click', (e) => {
            const btn = resolveToolbarToggleButton(e.target);
            if (!btn) return;
            e.preventDefault();
            const sid = btn.getAttribute('data-illu-sync') || btn.getAttribute('data-illu-brush-sync');
            const chkid = btn.getAttribute('data-illu-toggle-check');
            if (sid) {
                const val = btn.getAttribute('data-illu-value');
                const sel = document.getElementById(sid);
                if (sel) {
                    sel.value = val;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (ILLU_ICON_SYNC_TOOL_PROPS[sid]) ILLU_ICON_SYNC_TOOL_PROPS[sid](val);
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
                window.syncAllToolbarToggles();
            } else if (chkid) {
                const chk = document.getElementById(chkid);
                if (chk) {
                    chk.checked = !chk.checked;
                    chk.dispatchEvent(new Event('change', { bubbles: true }));
                    if (
                        (chkid === 'tool-text-bold' ||
                            chkid === 'tool-text-italic' ||
                            chkid === 'tool-text-stroke') &&
                        typeof window.syncPixelTextEditorStyles === 'function'
                    ) {
                        window.syncPixelTextEditorStyles();
                    }
                    window.syncAllToolbarToggles();
                }
            }
        });

        document.body.addEventListener('change', (e) => {
            const ctrl = e.target;
            if (!ctrl || !ctrl.closest('#tool-options-container')) return;
            if (ctrl.tagName === 'SELECT' || (ctrl.tagName === 'INPUT' && ctrl.type === 'checkbox')) {
                window.syncAllToolbarToggles();
                if (typeof window.updateToolOptionsBar === 'function') {
                    window.updateToolOptionsBar();
                }
            }
        });
    }

    window.syncAllToolbarToggles = function () {
        document
            .querySelectorAll(
                '#tool-options-container button.illu-icon-toggle, #tool-options-container button[data-illu-brush-sync], #tool-options-container button[data-selection-mode]'
            )
            .forEach((btn) => {
                const sid = btn.getAttribute('data-illu-sync') || btn.getAttribute('data-illu-brush-sync');
                const chkid = btn.getAttribute('data-illu-toggle-check');
                const selMode = btn.getAttribute('data-selection-mode');

                let on = false;
                if (sid) {
                    const val = btn.getAttribute('data-illu-value');
                    const sel = document.getElementById(sid);
                    on = sel && sel.value === val;
                } else if (chkid) {
                    const chk = document.getElementById(chkid);
                    on = chk && chk.checked;
                } else if (selMode) {
                    on = window.selectionMode === selMode;
                }

                btn.classList.toggle('illu-icon-toggle--on', on);
                btn.classList.toggle('active', on);
                btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
    };

    window.syncIlluShapeToolIconToggles = window.syncAllToolbarToggles;
    window.syncIlluBrushPatternIconToggles = window.syncAllToolbarToggles;
    window.setupIlluShapeToolIconToggles = setupIlluGenericIconToggles;
    window.setupIlluTextToolIconToggles = setupIlluGenericIconToggles;
    window.setupIlluBrushPatternIconToggles = setupIlluGenericIconToggles;

    // Initial setup
    setupIlluGenericIconToggles();
    window.syncAllToolbarToggles();

    // Re-sync when sprite is fully fetched and injected asynchronously
    window.addEventListener('illuSpriteLoaded', () => {
        window.syncAllToolbarToggles();
    });
})();

if (workspaceEl) {
    workspaceEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        // Skip if PointerEvents are handled by DrawingTools.js
        if (typeof window.PointerEvent !== 'undefined' && e.type === 'mousedown') return;

        // Autoriser le clic sur le canevas OU le clic dans la zone de bordure (outside canvas) pour les outils de sélection
        const isOnCanvas = e.target.closest('#main-canvas-container');
        if (!isOnCanvas && !illuWorkspaceCanStartSelectionOutsideCanvas(e)) return;

        try {
            if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        } catch (err) { /* ignore */ }

        if (window._illuSuppressCanvasMouseUntil && performance.now() < window._illuSuppressCanvasMouseUntil) {
            return;
        }
        e.preventDefault();
        handleMouseDown(e);
    });

    window.addEventListener('mousemove', (e) => {
        // Preview pen/polygon path sans throttle (elles gèrent le RAF elles-mêmes)
        if (window.VectorEngine && EditorManager.mode === 'vector') {
            const tool = window.activeTool;
            if (tool === 'pen' && window.VectorEngine.isPenActive()) {
                const pos = typeof getPos === 'function' ? getPos(e) : null;
                if (pos) { window.VectorEngine.penPreview(pos); EditorManager.render(); }
            } else if (tool === 'polygon' && window.VectorEngine.isPolygonActive()) {
                const pos = typeof getPos === 'function' ? getPos(e) : null;
                if (pos) { window.VectorEngine.polygonPreview(pos); EditorManager.render(); }
            }
        }
        // Skip mousemove if PointerEvents are handled by DrawingTools.js (prevents double-firing)
        if (typeof window.PointerEvent !== 'undefined') return;

        if (!window._illuMouseMoveThrottled) {
            window._illuMouseMoveThrottled = true;
            requestAnimationFrame(() => {
                onGlobalMouseMove(e);
                window._illuMouseMoveThrottled = false;
            });
        }
    });

    window.addEventListener('mouseup', (e) => {
        try {
            if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        } catch (err) {
            /* ignore */
        }
        // Skip if PointerEvents are handled by DrawingTools.js
        if (typeof window.PointerEvent !== 'undefined' && e.type === 'mouseup') return;
        if (window._illuSuppressCanvasMouseUntil && performance.now() < window._illuSuppressCanvasMouseUntil) {
            return;
        }
        handleMouseUp(e);
    });

    const onWorkspacePointerDown = (e) => {
        if (e.pointerType === 'mouse') return;

        const isOnCanvas = e.target.closest('#main-canvas-container');
        if (!isOnCanvas && !illuWorkspaceCanStartSelectionOutsideCanvas(e)) return;

        if (e.isPrimary === false) {
            try {
                e.preventDefault();
            } catch (err) {
                /* ignore */
            }
            return;
        }
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
            window._illuSuppressCanvasMouseUntil = Number.POSITIVE_INFINITY;
        }
        try {
            e.preventDefault();
            workspaceEl.setPointerCapture(e.pointerId);
        } catch (err) {
            /* ignore */
        }
        handleMouseDown(e);
    };
    workspaceEl.addEventListener('pointerdown', onWorkspacePointerDown, { passive: false });
}