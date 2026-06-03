(function (global) {
    'use strict';

    // UI and State Management for Photo Mode Pro (Lightroom-like interface)

    // Inject the specific CSS for Photo Mode so it's fully isolated / "slideloaded"


    let METADATA = { DEFAULT_PARAMS: {}, RANGES: {}, PRESETS: {} };
    let PARAMS_RANGES = METADATA.RANGES;
    let DEFAULT_PARAMS = METADATA.DEFAULT_PARAMS;
    let PRESETS = METADATA.PRESETS;

    function refreshMetadata() {
        if (window.IlluImageAdjustCore) {
            METADATA = window.IlluImageAdjustCore.METADATA;
            PARAMS_RANGES = METADATA.RANGES;
            DEFAULT_PARAMS = METADATA.DEFAULT_PARAMS;
            PRESETS = METADATA.PRESETS;
        }
    }

    // Deep clone params so each photo gets its own independent arrays (curves, HSL)
    function deepCloneParams(source) {
        const out = {};
        Object.keys(source).forEach(k => {
            out[k] = Array.isArray(source[k]) ? source[k].map(v => (typeof v === 'object' ? Object.assign({}, v) : v)) : source[k];
        });
        return out;
    }

    const state = {
        isOpen: false,
        photos: [],
        activeId: null,
        rafPending: null,
        zoom: 1.0,
        panX: 0,
        panY: 0,
        isDragging: false,
        startDragX: 0,
        startDragY: 0,
        currentCanvasWidth: 0,
        currentCanvasHeight: 0,
        scratchCanvas: null,
        isCropMode: false,
        cropRect: { x1: 0, y1: 0, x2: 1, y2: 1 },
        activeHandle: null,
        // Photo History Stack (undo/redo)
        history: [],         // Array of { imageData: ImageData, previewImageData, params }
        historyMaxLen: 30,   // Limit memory usage
        // Global overrides storage
        originalUndo: null,
        originalRedo: null,
        isDocked: false,
        selectedIds: [],       // Array of IDs for multi-selection
        lastSelectedId: null,  // For Shift+Click range
        showEffects: true,     // Toggle for viewing original image
        useRawMode: true       // true = 14-bit float rendering if available
    };

    let tKey = (k, fb) => (window.IlluI18n && window.IlluI18n.t ? window.IlluI18n.t(k) : fb);

    function buildUI() {
        refreshMetadata();
        if (document.getElementById('illu-photo-mode-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'illu-photo-mode-overlay';
        overlay.className = 'illu-photo-mode-overlay';

        overlay.innerHTML = `
            <div class="illu-pm-header">
                <h2><i class="fa-solid fa-camera"></i> <span class="illu-pm-header-text">${tKey('menu.photoModePro', 'Mode Photo Pro')}</span></h2>
                <div class="illu-pm-header-btns">
                    <button class="illu-pm-btn" id="pm-btn-import" title="${tKey('photo.importTitle', 'Importer des photos')}"><i class="fa-solid fa-plus"></i> <span class="illu-pm-btn-text--mobile-short">${tKey('photo.importShort', 'Importer')}</span><span class="illu-pm-btn-text">${tKey('photo.importTitle', 'Importer Photos')}</span></button>
                    <input type="file" id="pm-file-input" multiple accept="image/*,.raw,.cr2,.nef,.arw,.dng">
                    <button class="illu-pm-btn illu-pm-btn-secondary" id="pm-btn-open-editor" title="${tKey('photo.openInEditor', 'Ouvrir dans l\'éditeur MasterPaint')}"><i class="fa-solid fa-up-right-from-square"></i> <span class="illu-pm-btn-text">${tKey('photo.openInEditor', 'Ouvrir')}</span></button>
                    <button class="illu-pm-btn illu-pm-btn-accent" id="pm-btn-export-all" title="${tKey('photo.exportOptions', 'Options d\'exportation')}"><i class="fa-solid fa-file-export"></i> <span class="illu-pm-btn-text--mobile-short">${tKey('photo.exportShort', 'Exporter')}</span><span class="illu-pm-btn-text">${tKey('photo.exportBtn', 'Exporter...')}</span></button>
                    <button class="illu-pm-btn illu-pm-btn-secondary" id="pm-btn-apply-all" title="${tKey('photo.applyAllTitle', 'Appliquer à toute la sélection / pellicule')}"><i class="fa-solid fa-copy"></i> <span class="illu-pm-btn-text">${tKey('photo.applyAll', 'Appliquer à toutes')}</span></button>
                    <button class="illu-pm-btn illu-pm-btn-danger" id="pm-btn-close" title="${tKey('photo.closeTitle', 'Fermer le mode Photo Pro')}"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div class="illu-pm-body">
                <div class="illu-pm-empty-state" id="pm-empty-state">
                    <i class="fa-solid fa-images"></i>
                    <p>${tKey('photo.emptyMsg', 'Aucune photo chargée. Importez vos fichiers JPG, PNG ou RAW.')}</p>
                </div>
                <div class="illu-pm-main">
                    <div class="illu-pm-canvas-wrap" id="pm-canvas-area">
                        <div id="pm-canvas-viewport" style="display:flex; align-items:center; justify-content:center; width:100%; height:100%;">
                            <canvas id="pm-main-canvas"></canvas>
                        </div>
                        <div class="illu-pm-zoom-badge" id="pm-zoom-badge">
                            <span id="pm-zoom-text"><span class="illu-pm-hide-mobile">Zoom:</span> 100%</span>
                            <button id="pm-btn-zoom-fit" title="${tKey('photo.zoomFitTitle', 'Ajuster l\'image')}"><i class="fa-solid fa-expand"></i></button>
                            <button class="illu-pm-zoom-btn-toggle" id="pm-btn-toggle-effects" title="${tKey('photo.toggleEffects', 'Activer/Désactiver les effets')}">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> <span>ON</span>
                            </button>
                        </div>
                        <!-- Interactive Crop Overlay -->
                        <div class="illu-pm-crop-overlay" id="pm-crop-overlay">
                            <svg class="illu-pm-crop-svg" id="pm-crop-svg"><path class="illu-pm-crop-mask" id="pm-crop-mask"></path><rect id="pm-crop-border" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-dasharray="6 3"></rect></svg>
                            <div class="illu-pm-crop-handle" id="pm-crop-h-tl" data-handle="tl"></div>
                            <div class="illu-pm-crop-handle" id="pm-crop-h-tr" data-handle="tr"></div>
                            <div class="illu-pm-crop-handle" id="pm-crop-h-bl" data-handle="bl"></div>
                            <div class="illu-pm-crop-handle" id="pm-crop-h-br" data-handle="br"></div>
                            <div class="illu-pm-crop-actions" id="pm-crop-actions">
                                <button class="illu-pm-btn" id="pm-crop-apply"><i class="fa-solid fa-check"></i> ${tKey('dlg.apply', 'Appliquer')}</button>
                                <button class="illu-pm-btn illu-pm-btn-secondary" id="pm-crop-cancel"><i class="fa-solid fa-xmark"></i> ${tKey('menu.cancel', 'Annuler')}</button>
                            </div>
                        </div>
                    </div>
                    <div class="illu-pm-filmstrip" id="pm-filmstrip"></div>
                </div>
                <div class="illu-pm-sidebar" id="pm-sidebar">
                    <div class="illu-pm-sec">
                        <div class="illu-pm-sec-h"><span><i class="fa-solid fa-chevron-down"></i> ${tKey('photo.presets', 'Filtres & Reset')}</span></div>
                        <div class="illu-pm-sec-body">
                           <div class="illu-pm-row">
                                <label>${tKey('photo.presets', 'Presets Créatifs')}</label>
                                <select id="illu-cr-preset">
                                    <option value="none">${tKey('photo.presetNone', 'Aucun (Manuel)')}</option>
                                    ${IlluImageAdjustCore.METADATA.UI_PRESETS_LAYOUT.map(group => `
                                        <optgroup label="${tKey(group.label, group.fallback)}">
                                            ${group.items.map(item => `
                                                <option value="${item.id}">${tKey(item.label, item.fallback)}</option>
                                            `).join('')}
                                        </optgroup>
                                    `).join('')}
                                </select>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-top:5px;">
                                <button class="illu-pm-btn illu-pm-btn-secondary" style="width: 100%;" id="pm-btn-reset"><i class="fa-solid fa-undo"></i> <span class="illu-pm-btn-text">${tKey('photo.resetAll', 'Réinitialiser')}</span></button>
                                <div style="display: flex; gap: 8px;">
                                    <button class="illu-pm-btn" style="flex: 1; justify-content:center;" id="pm-btn-crop-mode"><i class="fa-solid fa-crop-simple"></i> <span class="illu-pm-btn-text">${tKey('photo.cropLive', 'Recadrer')}</span></button>
                                    <button class="illu-pm-btn" style="flex: 1; justify-content:center;" id="pm-btn-rotate-90"><i class="fa-solid fa-rotate-right"></i> <span class="illu-pm-btn-text">${tKey('photo.rotate', 'Rotation')}</span></button>
                                </div>
                            </div>
                            <div class="illu-pm-row" style="margin-top:10px; background: rgba(255,255,255,0.05); padding: 5px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
                                <label style="color: #4facfe; font-weight: bold; font-size: 11px; margin-bottom: 5px; display: block;"><i class="fa-solid fa-microchip"></i> Moteur WebGL</label>
                                <div class="illu-scope-btn-row illu-settings-scope-btn-row" id="pm-mode-btn-row" role="group" style="width: 100%;">
                                    <button type="button" class="illu-scope-btn illu-settings-scope-btn" data-value="raw" id="pm-mode-raw-btn" aria-pressed="false" style="flex: 1; padding: 4px 8px; font-size: 11px;">RAW Profond (14-bit)</button>
                                    <button type="button" class="illu-scope-btn illu-settings-scope-btn" data-value="normal" id="pm-mode-normal-btn" aria-pressed="false" style="flex: 1; padding: 4px 8px; font-size: 11px;">Normal (8-bit)</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    ${IlluImageAdjustCore.METADATA.UI_LAYOUT.map(sec => {
                        const title = tKey(sec.title, sec.fallback);
                        let content = '';

                        if (sec.hasAuto) {
                            content += `
                                <div style="display:flex; justify-content:flex-end; margin-bottom: 10px;">
                                    <button class="illu-pm-btn illu-pm-btn-secondary illu-pm-btn-mini" id="pm-btn-auto-adjust"><i class="fa-solid fa-wand-magic-sparkles"></i> ${tKey('photo.autoAdjust', 'Auto')}</button>
                                </div>
                            `;
                        }

                        if (sec.isRGB) {
                            const rgbGroups = [
                                { id: 'red', label: tKey('photo.red', 'Rouge'), color: 'rgba(255,0,0,0.05)' },
                                { id: 'green', label: tKey('photo.green', 'Vert'), color: 'rgba(0,255,0,0.05)' },
                                { id: 'blue', label: tKey('photo.blue', 'Bleu'), color: 'rgba(0,0,255,0.05)' }
                            ];
                            content = rgbGroups.map(g => `
                                <div class="illu-pm-rgb-group" style="background: ${g.color}; padding: 5px; border-radius: 4px; margin-bottom: 10px;">
                                    ${IlluImageAdjustCore.Slider.createHtml(`pm-slider-${g.id}`, g.label, g.id)}
                                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                        ${IlluImageAdjustCore.Slider.createHtml(`pm-slider-${g.id}Hi`, 'High', `${g.id}Hi`, { isMini: true })}
                                        ${IlluImageAdjustCore.Slider.createHtml(`pm-slider-${g.id}Sh`, 'Shad', `${g.id}Sh`, { isMini: true })}
                                    </div>
                                </div>
                            `).join('');
                        } else if (sec.isCurve) {
                            content = IlluImageAdjustCore.CurveEditor.createHtml('pm-editor');
                        } else if (sec.isHSL) {
                            content = IlluImageAdjustCore.HSLManager.createHtml('pm-editor');
                        } else if (sec.sliders) {
                            content += sec.sliders.map(sl => {
                                if (sl.type === 'separator') {
                                    return '<hr style="border:0;border-top:1px solid #333;margin:15px 0 10px 0;">';
                                }
                                return IlluImageAdjustCore.Slider.createHtml(`pm-slider-${sl.id}`, tKey(sl.label, sl.fallback), sl.id, sl.options || {});
                            }).join('');
                        }

                        return buildSection(title, content, sec.id, sec.isCollapsed);
                    }).join('')}

                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Bind events
        document.getElementById('pm-btn-close').addEventListener('click', closeMode);
        document.getElementById('pm-btn-import').addEventListener('click', () => document.getElementById('pm-file-input').click());
        document.getElementById('pm-file-input').addEventListener('change', handleImport);
        document.getElementById('pm-btn-open-editor').addEventListener('click', () => openActiveInEditor());
        document.getElementById('pm-btn-apply-all').addEventListener('click', applyToAll);
        document.getElementById('pm-btn-export-all').addEventListener('click', showExportOptionsDialog);
        document.getElementById('pm-btn-reset').addEventListener('click', resetActiveParams);
        document.getElementById('pm-btn-auto-adjust').addEventListener('click', autoAdjust);
        document.getElementById('pm-btn-zoom-fit').addEventListener('click', zoomToFit);
        document.getElementById('pm-btn-toggle-effects').addEventListener('click', toggleEffects);

        // RAW Mode
        const modeBtns = document.querySelectorAll('#pm-mode-btn-row .illu-scope-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const photo = state.photos.find(p => p.id === state.activeId);
                if (photo) {
                    photo.useRawMode = (btn.dataset.value === 'raw');
                    
                    // Update classes visually
                    modeBtns.forEach(b => {
                        b.classList.remove('illu-scope-btn--active');
                        b.setAttribute('aria-pressed', 'false');
                    });
                    btn.classList.add('illu-scope-btn--active');
                    btn.setAttribute('aria-pressed', 'true');
                    
                    if (window.IlluImageAdjustCore && window.IlluImageAdjustCore.Slider) {
                        IlluImageAdjustCore.Slider.updateRanges(document.getElementById('pm-panel-edit'), 'pm-slider-', photo.useRawMode);
                    }
                    
                    renderActivePhoto();
                }
            });
        });

        // Crop mode button (in presets panel)
        const cropBtn = document.getElementById('pm-btn-crop-mode');
        if (cropBtn) cropBtn.addEventListener('click', startCropMode);
        
        const rotBtn = document.getElementById('pm-btn-rotate-90');
        if (rotBtn) rotBtn.addEventListener('click', rotateActivePhoto90);

        // Crop overlay buttons
        document.getElementById('pm-crop-apply').addEventListener('click', applyCrop);
        document.getElementById('pm-crop-cancel').addEventListener('click', cancelCropMode);

        // Crop handle drag
        document.querySelectorAll('.illu-pm-crop-handle').forEach(h => {
            h.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                state.activeHandle = h.dataset.handle;
                e.preventDefault();
            });
        });

        // Section Toggles & RAZ
        document.querySelectorAll('.illu-pm-sec-h').forEach(h => {
            h.onclick = (e) => {
                // If clicked the RAZ button, don't toggle section
                if (e.target.classList.contains('pm-raz-btn')) {
                    e.stopPropagation();
                    const sec = h.parentElement;
                    const inputs = sec.querySelectorAll('input[type="range"]');
                    inputs.forEach(input => {
                        let key = input.id.replace('pm-slider-', '');
                        if (key.startsWith('pm-editor-')) {
                            input.value = 0;
                            input.dispatchEvent(new Event('input'));
                        } else {
                            if (DEFAULT_PARAMS[key] != null) {
                                input.value = DEFAULT_PARAMS[key] || 0;
                                const valDisplay = sec.querySelector('#pm-slider-' + key + '-val');
                                if (valDisplay) valDisplay.innerText = input.value;
                                updateActiveParams(key, parseInt(input.value, 10));
                            }
                        }
                    });
                    if (sec.id === 'sec-curves' && state.activeId) {
                        const photo = state.photos.find(p => p.id === state.activeId);
                        if (photo) {
                            photo.params.curveMaster = [];
                            photo.params.curveR = [];
                            photo.params.curveG = [];
                            photo.params.curveB = [];
                            const wrap = sec.querySelector('.illu-curve-editor');
                            if (wrap && wrap._forceDrawCurve) wrap._forceDrawCurve();
                            photo.isModified = true;
                            renderActivePhoto();
                        }
                    }
                    pushPhotoHistory();
                    return;
                }
                h.parentElement.classList.toggle('illu-pm-sec--collapsed');
            }
        });

        // Preset logic
        const presetSel = document.getElementById('illu-cr-preset');
        if (presetSel) {
            presetSel.addEventListener('change', (e) => {
                const presetKey = e.target.value;
                if (!state.activeId) return;
                const photo = state.photos.find(x => x.id === state.activeId);
                if (!photo) return;

                if (presetKey === 'none') {
                    photo.params = deepCloneParams(DEFAULT_PARAMS);
                } else {
                    // Refresh presets from metadata if available
                    refreshMetadata();

                    let p = PRESETS[presetKey];
                    // Special cases not in Camera Raw presets (Flash corrections)
                    if (!p) {
                        if (presetKey === 'autolevel' && window.IlluImageAdjustCore?.suggestAutoParams) {
                            p = window.IlluImageAdjustCore.suggestAutoParams(photo.previewImageData);
                        } else if (presetKey === 'sepia') {
                            p = { saturation: -50, temp: 40, tint: 10 };
                        } else if (presetKey === 'grayscale') {
                            p = { saturation: -100 };
                        }
                    }

                    if (p) {
                        photo.params = Object.assign({}, DEFAULT_PARAMS, p);
                        photo.isModified = true;
                        // Important: explicitly update UI sliders and preview
                        selectPhoto(state.activeId);
                    }
                }
            });
        }

        // Ensure reset button also triggers UI sync
        const resetBtn = document.getElementById('pm-btn-reset');
        if (resetBtn) {
            resetBtn.onclick = () => {
                resetActiveParams();
                if (state.activeId) selectPhoto(state.activeId);
            };
        }

        // Drag and drop logic
        const pmMain = document.querySelector('.illu-pm-body');
        pmMain.addEventListener('dragover', (e) => { e.preventDefault(); pmMain.style.background = '#1a1a1a'; });
        pmMain.addEventListener('dragleave', (e) => { e.preventDefault(); pmMain.style.background = 'transparent'; });
        pmMain.addEventListener('drop', async (e) => {
            e.preventDefault();
            pmMain.style.background = 'transparent';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                handleFileList(files);
            }
        });

        // Bind sliders
        Object.keys(DEFAULT_PARAMS).forEach(key => {
            const id = `pm-slider-${key}`;
            const isMini = key.endsWith('Hi') || key.endsWith('Sh'); 
            IlluImageAdjustCore.Slider.bind(overlay, id, key, { isMini: isMini }, {
                onInput: (val) => {
                    updateActiveParams(key, val);
                },
                onChange: () => {
                    pushPhotoHistory();
                }
            });
        });

        // Zoom & Pan Events
        const area = document.getElementById('pm-canvas-area');
        area.addEventListener('wheel', handleWheel, { passive: true });
        area.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        // Keyboard shortcuts
        window.addEventListener('keydown', handleGlobalKeyDown);

        // Initial sync
        updateZoomBadge();
    }

    function buildSection(title, content, id = '', isCollapsed = false) {
        return `
            <div class="illu-pm-sec ${isCollapsed ? 'illu-pm-sec--collapsed' : ''}" id="${id}">
                <div class="illu-pm-sec-h">
                    <span><i class="fa-solid fa-chevron-down"></i> ${title}</span>
                    <button class="pm-raz-btn">RAZ</button>
                </div>
                <div class="illu-pm-sec-body">${content}</div>
            </div>
        `;
    }

    // --- Interaction Logic ---

    function handleWheel(e) {
        if (!state.activeId) return;
        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.1, Math.min(10, state.zoom * factor));

        // Try to zoom towards cursor
        const area = document.getElementById('pm-canvas-area');
        const rect = area.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        // Simple offset adjust
        if (newZoom !== state.zoom) {
            state.panX -= mouseX * (factor - 1);
            state.panY -= mouseY * (factor - 1);
            state.zoom = newZoom;
            renderActivePhoto('highres');
            updateZoomBadge();
        }
    }

    function handleMouseDown(e) {
        if (!state.activeId) return;
        if (e.button !== 0) return;
        // Only allow pan when NOT clicking a crop handle
        if (state.isCropMode && e.target.classList.contains('illu-pm-crop-handle')) return;
        state.isDragging = true;
        state.startDragX = e.clientX;
        state.startDragY = e.clientY;
        document.body.style.cursor = 'grabbing';
    }

    function handleMouseMove(e) {
        // Crop handle dragging
        if (state.isCropMode && state.activeHandle) {
            const area = document.getElementById('pm-canvas-area');
            if (!area) return;
            const rect = area.getBoundingClientRect();
            const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            const cr = state.cropRect;
            const MINSIZE = 0.05;
            switch (state.activeHandle) {
                case 'tl': cr.x1 = Math.min(nx, cr.x2 - MINSIZE); cr.y1 = Math.min(ny, cr.y2 - MINSIZE); break;
                case 'tr': cr.x2 = Math.max(nx, cr.x1 + MINSIZE); cr.y1 = Math.min(ny, cr.y2 - MINSIZE); break;
                case 'bl': cr.x1 = Math.min(nx, cr.x2 - MINSIZE); cr.y2 = Math.max(ny, cr.y1 + MINSIZE); break;
                case 'br': cr.x2 = Math.max(nx, cr.x1 + MINSIZE); cr.y2 = Math.max(ny, cr.y1 + MINSIZE); break;
            }
            updateCropOverlay();
            return;
        }

        if (!state.isDragging) {
            if (state.isOpen && state.activeId) updateStatusBarCoords(e);
            return;
        }
        const dx = e.clientX - state.startDragX;
        const dy = e.clientY - state.startDragY;
        state.panX += dx;
        state.panY += dy;
        state.startDragX = e.clientX;
        state.startDragY = e.clientY;
        renderActivePhoto('highres');
    }

    function handleMouseUp() {
        state.isDragging = false;
        state.activeHandle = null;
        document.body.style.cursor = '';
    }


    function handleGlobalKeyDown(e) {
        if (!state.isOpen) return;
        const k = e.key.toLowerCase();

        // Escape exits crop mode
        if (k === 'escape' && state.isCropMode) { cancelCropMode(); return; }

        // Zoom shortcuts
        if (e.ctrlKey || e.metaKey) {
            if (k === '+' || k === '=') { e.preventDefault(); updateZoom(1.2); }
            if (k === '-') { e.preventDefault(); updateZoom(0.8); }
            if (k === '0') { e.preventDefault(); resetView(); }
            // Undo / Redo
            if (k === 'z') { e.preventDefault(); if (e.shiftKey) redoPhotoHistory(); else undoPhotoHistory(); }
            if (k === 'y') { e.preventDefault(); redoPhotoHistory(); }
        }
    }

    function updateZoom(factor) {
        state.zoom = Math.max(0.1, Math.min(10, state.zoom * factor));
        renderActivePhoto('highres');
        updateZoomBadge();
    }

    function resetView() {
        zoomToFit();
        state.panX = 0;
        state.panY = 0;
        renderActivePhoto('highres');
        updateZoomBadge();
    }

    function zoomToFit() {
        if (!state.activeId) return;
        const photo = state.photos.find(p => p.id === state.activeId);
        if (!photo || !photo.previewImageData) return;
        const area = document.getElementById('pm-canvas-area');
        if (!area || area.offsetWidth === 0) return;
        const wr = area.offsetWidth;
        const hr = area.offsetHeight;
        const margin = 40;
        const availW = Math.max(100, wr - margin);
        const availH = Math.max(100, hr - margin);
        const z = Math.min(availW / photo.imageData.width, availH / photo.imageData.height);
        state.zoom = z; // Remove the 1.0 cap as requested to allow small images to fit the area
        state.panX = 0;
        state.panY = 0;
        renderActivePhoto('highres');
        updateZoomBadge();
    }

    function updateZoomBadge() {
        const badge = document.getElementById('pm-zoom-badge');
        if (badge) {
            badge.style.display = state.photos.length > 0 ? 'flex' : 'none';
        }
        const b = document.getElementById('pm-zoom-text');
        if (b) {
            const zPct = Math.round(state.zoom * 100);
            b.innerHTML = `<span class="illu-pm-hide-mobile">Zoom:</span> ${zPct}%`;
        }

        // Also update standard status bar if present
        const sZoom = document.getElementById('status-zoom');
        if (sZoom) {
            if (state.photos.length > 0) {
                sZoom.innerText = `${Math.round(state.zoom * 100)}%`;
            } else {
                sZoom.innerText = '—';
            }
        }
    }

    function toggleEffects() {
        state.showEffects = !state.showEffects;
        const btn = document.getElementById('pm-btn-toggle-effects');
        if (btn) {
            btn.classList.toggle('is-off', !state.showEffects);
            btn.innerHTML = state.showEffects 
                ? `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>ON</span>`
                : `<i class="fa-solid fa-image"></i> <span>OFF</span>`;
        }
        renderActivePhoto();
    }

    function updateStatusBarCoords(e) {
        const sCoords = document.getElementById('status-coords');
        if (!sCoords) return;

        const photo = state.photos.find(p => p.id === state.activeId);
        if (!photo) return;

        const area = document.getElementById('pm-canvas-area');
        const rect = area.getBoundingClientRect();

        // Calculate image relative coordinates
        const x = (e.clientX - rect.left - rect.width / 2 - state.panX) / state.zoom;
        const y = (e.clientY - rect.top - rect.height / 2 - state.panY) / state.zoom;

        const imgX = Math.round(x + photo.previewImageData.width / 2);
        const imgY = Math.round(y + photo.previewImageData.height / 2);

        if (imgX >= 0 && imgX < photo.previewImageData.width && imgY >= 0 && imgY < photo.previewImageData.height) {
            sCoords.innerText = `${imgX}, ${imgY} px`;
        } else {
            sCoords.innerText = '';
        }
    }

    function autoAdjust() {
        if (!state.activeId) return;
        const photo = state.photos.find(p => p.id === state.activeId);
        if (!photo || !window.IlluImageAdjustCore || !window.IlluImageAdjustCore.suggestAutoParams) return;

        const suggested = window.IlluImageAdjustCore.suggestAutoParams(photo.previewImageData);
        photo.params = Object.assign({}, photo.params, suggested);
        photo.isModified = true;
        selectPhoto(photo.id);
    }

    // --- Interactive Crop Mode ---

    function rotateActivePhoto90() {
        if (!state.activeId) return;
        const p = state.photos.find(x => x.id === state.activeId);
        if (!p) return;

        const rotateImgData = (id) => {
            const w = id.width;
            const h = id.height;
            const out = new ImageData(h, w);
            const s = id.data;
            const d = out.data;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const si = (y * w + x) * 4;
                    const di = (x * h + (h - 1 - y)) * 4;
                    d[di] = s[si];
                    d[di + 1] = s[si + 1];
                    d[di + 2] = s[si + 2];
                    d[di + 3] = s[si + 3];
                }
            }
            return out;
        };

        p.imageData = rotateImgData(p.imageData);
        p.previewImageData = rotateImgData(p.previewImageData);
        p.isModified = true;
        
        renderActivePhoto();
        renderFilmstrip();
    }

    function startCropMode() {
        if (!state.activeId) return;
        state.isCropMode = true;
        // Default crop rect: 10% inset from edges
        state.cropRect = { x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9 };
        const overlay = document.getElementById('pm-crop-overlay');
        if (overlay) overlay.classList.add('is-active');
        updateCropOverlay();
    }

    function cancelCropMode() {
        state.isCropMode = false;
        state.activeHandle = null;
        const overlay = document.getElementById('pm-crop-overlay');
        if (overlay) overlay.classList.remove('is-active');
    }

    function updateCropOverlay() {
        const area = document.getElementById('pm-canvas-area');
        const svg = document.getElementById('pm-crop-svg');
        const mask = document.getElementById('pm-crop-mask');
        const border = document.getElementById('pm-crop-border');
        if (!area || !svg || !mask) return;

        const W = area.offsetWidth;
        const H = area.offsetHeight;
        const cr = state.cropRect;
        const cx1 = cr.x1 * W, cy1 = cr.y1 * H;
        const cx2 = cr.x2 * W, cy2 = cr.y2 * H;
        const cw = cx2 - cx1, ch = cy2 - cy1;

        // SVG dark mask with a hole for the crop area
        mask.setAttribute('d', `M0 0 H${W} V${H} H0 Z M${cx1} ${cy1} H${cx2} V${cy2} H${cx1} Z`);

        // Rule-of-thirds border
        if (border) {
            border.setAttribute('x', cx1); border.setAttribute('y', cy1);
            border.setAttribute('width', cw); border.setAttribute('height', ch);
        }

        // Position the 4 handles
        const handles = {
            'pm-crop-h-tl': { left: cx1, top: cy1 },
            'pm-crop-h-tr': { left: cx2, top: cy1 },
            'pm-crop-h-bl': { left: cx1, top: cy2 },
            'pm-crop-h-br': { left: cx2, top: cy2 },
        };
        Object.entries(handles).forEach(([id, pos]) => {
            const h = document.getElementById(id);
            if (h) { h.style.left = pos.left + 'px'; h.style.top = pos.top + 'px'; }
        });
    }

    function applyCrop() {
        if (!state.activeId) return;
        const photo = state.photos.find(p => p.id === state.activeId);
        if (!photo || !photo.imageData) return;
        pushPhotoHistory(); // Snapshot before crop

        const cr = state.cropRect;
        // Apply crop using the AREA proportions relative to the preview, mapped back to full-res
        const prevW = photo.previewImageData.width;
        const prevH = photo.previewImageData.height;
        const fullW = photo.imageData.width;
        const fullH = photo.imageData.height;

        // Map screen coordinates (cr) back to image coordinates using the current zoom and pan
        const area = document.getElementById('pm-canvas-area');
        const W = area ? area.offsetWidth : window.innerWidth;
        const H = area ? area.offsetHeight : window.innerHeight;

        const dispW = prevW * state.zoom;
        const dispH = prevH * state.zoom;

        // Calculate the fractional position relative to the image
        const fCol1 = 0.5 + ((cr.x1 * W - W / 2) - state.panX) / dispW;
        const fCol2 = 0.5 + ((cr.x2 * W - W / 2) - state.panX) / dispW;
        const fRow1 = 0.5 + ((cr.y1 * H - H / 2) - state.panY) / dispH;
        const fRow2 = 0.5 + ((cr.y2 * H - H / 2) - state.panY) / dispH;

        let fx1 = Math.round(fCol1 * fullW);
        let fx2 = Math.round(fCol2 * fullW);
        let fy1 = Math.round(fRow1 * fullH);
        let fy2 = Math.round(fRow2 * fullH);

        // Ensure values are within bounds and properly ordered
        fx1 = Math.max(0, Math.min(fullW, fx1));
        fx2 = Math.max(0, Math.min(fullW, fx2));
        fy1 = Math.max(0, Math.min(fullH, fy1));
        fy2 = Math.max(0, Math.min(fullH, fy2));

        if (fx1 > fx2) { const t = fx1; fx1 = fx2; fx2 = t; }
        if (fy1 > fy2) { const t = fy1; fy1 = fy2; fy2 = t; }

        const fw = Math.max(2, fx2 - fx1);
        const fh = Math.max(2, fy2 - fy1);

        // Crop full-res ImageData
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = fw; cropCanvas.height = fh;
        const ctx = cropCanvas.getContext('2d');
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = fullW; srcCanvas.height = fullH;
        srcCanvas.getContext('2d').putImageData(photo.imageData, 0, 0);
        ctx.drawImage(srcCanvas, fx1, fy1, fw, fh, 0, 0, fw, fh);
        const newImageData = ctx.getImageData(0, 0, fw, fh);

        // Update photo object
        photo.imageData = newImageData;
        photo.previewImageData = downscaleForPreview(newImageData);
        photo.isModified = true;

        cancelCropMode();
        // Reset state canvas tracking
        state.currentCanvasWidth = 0;
        state.currentCanvasHeight = 0;
        state.scratchCanvas = null;
        selectPhoto(photo.id);
        zoomToFit();
    }


    async function openFromProject(project) {
        if (!project) return;
        await openFromCanvas(project.composite || window.EditorManager.mainCanvas, project.name || 'Projet');
    }

    async function openFromCanvas(canvas, fileName = 'image.png', options = {}) {
        if (!canvas) return;
        openMode();

        return new Promise((resolve) => {
            setTimeout(async () => {
                try {
                    const ctx = canvas.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    if (options.rawFloatData) {
                        imageData.rawFloatData = options.rawFloatData;
                        imageData.rawFloatWidth = options.rawFloatWidth;
                        imageData.rawFloatHeight = options.rawFloatHeight;
                        imageData.rawMetadata = options.rawMetadata;
                    }

                    const photoObj = {
                        id: generateId(),
                        fileName: fileName,
                        imageData: imageData,
                        previewImageData: downscaleForPreview(imageData),
                        params: deepCloneParams(DEFAULT_PARAMS),
                        isModified: false,
                        useRawMode: !!imageData.rawFloatData,
                        metadata: imageData.rawMetadata
                    };

                    if (photoObj.metadata) {
                        applyMetadataPresets(photoObj);
                    }

                    state.photos.push(photoObj);
                    renderFilmstrip();
                    selectPhoto(photoObj.id);
                    updateEmptyState();
                } catch (err) {
                    console.error("openFromCanvas error", err);
                } finally {
                    resolve();
                }
            }, 50);
        });
    }

    function applyMetadataPresets(photo) {
        if (!photo || !photo.metadata) return;
        const meta = photo.metadata;
        if (typeof meta.exposure_bias === 'number' && meta.exposure_bias !== 0) {
            // Our Exposure parameter maps exposure_bias * 50
            photo.params.exposure = Math.max(-350, Math.min(350, Math.round(meta.exposure_bias * 50)));
        }
    }

    // --- Standard logic ---

    function generateId() { return Math.random().toString(36).substr(2, 9); }

    function downscaleForPreview(id) {
        const w = id.width;
        const h = id.height;
        const PREVIEW_MAX = 1200;
        
        let outId;
        if (Math.max(w, h) <= PREVIEW_MAX) {
            outId = new ImageData(new Uint8ClampedArray(id.data), w, h);
            if (id.rawFloatData) {
                outId.rawFloatData = id.rawFloatData;
                outId.rawFloatWidth = w;
                outId.rawFloatHeight = h;
            }
            return outId;
        }

        const s = PREVIEW_MAX / Math.max(w, h);
        const nw = Math.round(w * s);
        const nh = Math.round(h * s);
        
        const c = document.createElement('canvas');
        c.width = nw; c.height = nh;
        const x = c.getContext('2d');
        const c0 = document.createElement('canvas');
        c0.width = w; c0.height = h;
        c0.getContext('2d').putImageData(id, 0, 0);
        x.drawImage(c0, 0, 0, nw, nh);
        
        outId = x.getImageData(0, 0, nw, nh);

        // Downscale float data via Nearest Neighbor if present
        if (id.rawFloatData) {
            const outFloat = new Float32Array(nw * nh * 4);
            const inFloat = id.rawFloatData;
            for (let y = 0; y < nh; y++) {
                const srcY = Math.floor(y / s);
                for (let x = 0; x < nw; x++) {
                    const srcX = Math.floor(x / s);
                    const si = (srcY * w + srcX) * 4;
                    const di = (y * nw + x) * 4;
                    outFloat[di] = inFloat[si];
                    outFloat[di+1] = inFloat[si+1];
                    outFloat[di+2] = inFloat[si+2];
                    outFloat[di+3] = inFloat[si+3];
                }
            }
            outId.rawFloatData = outFloat;
            outId.rawFloatWidth = nw;
            outId.rawFloatHeight = nh;
        }

        return outId;
    }

    function generateThumbUrl(previewId) {
        if (!previewId || !previewId.width) return '';
        const m = Math.max(previewId.width, previewId.height);
        const s = 120 / m;
        const nw = Math.max(1, Math.round(previewId.width * s));
        const nh = Math.max(1, Math.round(previewId.height * s));
        
        // --- High Performance Wasm Resize ---
        const useWasm = localStorage.getItem('settings-wasm-enabled') !== '0';
        const wasmReady = typeof MasterPaintWasm !== 'undefined' && MasterPaintWasm.isLoaded;
        const wasmThumbFn =
            typeof MasterPaintWasm.generateThumbnail === 'function'
                ? MasterPaintWasm.generateThumbnail.bind(MasterPaintWasm)
                : typeof MasterPaintWasm.resize === 'function'
                  ? MasterPaintWasm.resize.bind(MasterPaintWasm)
                  : null;

        let thumbImageData = null;
        if (useWasm && wasmReady && wasmThumbFn) {
            try {
                thumbImageData = wasmThumbFn(previewId, nw, nh);
            } catch (e) {
                if (!window._illuPhotoThumbWasmWarned) {
                    console.warn('[PhotoMode] Miniature Wasm indisponible, repli canvas', e);
                    window._illuPhotoThumbWasmWarned = true;
                }
            }
        }

        const c = document.createElement('canvas');
        c.width = nw; c.height = nh;
        
        if (thumbImageData) {
            c.getContext('2d').putImageData(thumbImageData, 0, 0);
        } else {
            const c0 = document.createElement('canvas');
            c0.width = previewId.width; c0.height = previewId.height;
            c0.getContext('2d').putImageData(previewId, 0, 0);
            c.getContext('2d', { willReadFrequently: true }).drawImage(c0, 0, 0, nw, nh);
        }
        return c.toDataURL('image/jpeg', 0.8);
    }

    async function processFile(file) {
        try {
            let imageData;
            const isRaw = window.illuIsRawFileName && window.illuIsRawFileName(file.name);
            const isImg = file.type.startsWith('image/');

            if (!isRaw && !isImg) {
                throw new Error(tKey('photo.importError', 'Format non supporté'));
            }

            if (isRaw && window.illuConvertRawFileToImageData) {
                imageData = await window.illuConvertRawFileToImageData(file);
            } else {
                const url = URL.createObjectURL(file);
                const img = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = (e) => reject(e);
                    img.src = url;
                });
                const c = document.createElement('canvas');
                c.width = img.width; c.height = img.height;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                imageData = ctx.getImageData(0, 0, img.width, img.height);
                URL.revokeObjectURL(url);
            }

            const previewImageData = downscaleForPreview(imageData);
            const thumbUrl = generateThumbUrl(previewImageData);

            const photoObj = {
                id: generateId(),
                file: file,
                fileName: file.name,
                imageData: imageData,
                previewImageData: previewImageData,
                thumbUrl: thumbUrl,
                params: deepCloneParams(DEFAULT_PARAMS),
                isModified: false,
                useRawMode: !!imageData.rawFloatData
            };

            state.photos.push(photoObj);
            renderFilmstrip();
            if (state.photos.length === 1) selectPhoto(photoObj.id);
            updateEmptyState();
        } catch (err) {
            console.error("Photo Mode Import Error:", err);
            if (window.showIlluAlert) window.showIlluAlert(tKey('photo.importError', "Erreur d'importation") + ": " + file.name);
        }
    }

    async function handleFileList(files) {
        if (!files.length) return;
        let busy = window.IlluProgress ? window.IlluProgress.createDelayedInstantEffect('Importation...', 50) : null;
        for (let i = 0; i < files.length; i++) {
            if (busy) busy.progress(Math.round((i / files.length) * 100));
            try { await processFile(files[i]); } catch (err) { console.error("Import error", err); }
        }
        if (busy) busy.done();
    }

    async function handleImport(e) {
        await handleFileList(Array.from(e.target.files));
        e.target.value = '';
    }

    function updateEmptyState() {
        const es = document.getElementById('pm-empty-state');
        if (es) es.style.display = state.photos.length === 0 ? 'flex' : 'none';
    }

    function renderFilmstrip() {
        const fs = document.getElementById('pm-filmstrip');
        if (!fs) return;
        fs.innerHTML = '';
        state.photos.forEach(photo => {
            const isActive = photo.id === state.activeId;
            const isSelected = state.selectedIds.includes(photo.id);

            const t = document.createElement('div');
            t.className = 'illu-pm-thumb' + (isActive ? ' is-active' : '') + (isSelected ? ' is-selected' : '');
            t.onclick = (e) => handleThumbClick(e, photo.id);
            t.dataset.photoId = photo.id;

            const i = document.createElement('img');
            i.src = photo.thumbUrl || generateThumbUrl(photo.previewImageData);
            t.appendChild(i);

            // Close button
            const close = document.createElement('div');
            close.className = 'illu-pm-thumb-close';
            close.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            close.onclick = (e) => {
                e.stopPropagation();
                removePhoto(photo.id);
            };
            t.appendChild(close);

            // Selection Checkbox
            const check = document.createElement('div');
            check.className = 'illu-pm-thumb-check';
            check.innerHTML = '<i class="fa-solid fa-check"></i>';
            check.onclick = (e) => {
                e.stopPropagation();
                togglePhotoSelection(photo.id);
            };
            t.appendChild(check);

            if (photo.isModified) {
                const dot = document.createElement('div');
                dot.style = 'position:absolute;top:5px;right:5px;width:6px;height:6px;background:var(--mp-accent);border-radius:50%';
                t.appendChild(dot);
            }
            fs.appendChild(t);
        });
    }

    function handleThumbClick(e, id) {
        const photos = state.photos;
        const currentIdx = photos.findIndex(p => p.id === id);

        if (e.ctrlKey || e.metaKey) {
            togglePhotoSelection(id);
        } else if (e.shiftKey && state.lastSelectedId) {
            // Range selection
            const lastIdx = photos.findIndex(p => p.id === state.lastSelectedId);
            if (lastIdx !== -1) {
                const start = Math.min(lastIdx, currentIdx);
                const end = Math.max(lastIdx, currentIdx);
                const rangeIds = photos.slice(start, end + 1).map(p => p.id);
                // Merge without duplicates
                state.selectedIds = Array.from(new Set([...state.selectedIds, ...rangeIds]));
            }
        } else {
            // Single select
            state.selectedIds = [];
            state.activeId = id;
            state.lastSelectedId = id;
        }

        selectPhoto(id);
    }

    function togglePhotoSelection(id) {
        if (state.selectedIds.includes(id)) {
            state.selectedIds = state.selectedIds.filter(sid => sid !== id);
        } else {
            state.selectedIds.push(id);
        }
        state.lastSelectedId = id;
        renderFilmstrip();
    }

    function removePhoto(id) {
        const photo = state.photos.find(p => p.id === id);
        if (!photo) return;

        if (photo.isModified) {
            if (!confirm(tKey('photo.confirmRemoveModified', 'Retirer cette image modifiée de la session ?'))) return;
        }

        const idx = state.photos.indexOf(photo);
        state.photos.splice(idx, 1);

        if (state.photos.length === 0) {
            finishClose();
        } else {
            if (state.activeId === id) {
                const nextIdx = Math.min(idx, state.photos.length - 1);
                selectPhoto(state.photos[nextIdx].id);
            } else {
                renderFilmstrip();
            }
        }

        if (window.EditorManager && window.EditorManager.updateTabUI) window.EditorManager.updateTabUI();
    }

    function movePhoto(id, direction) {
        const idx = state.photos.findIndex(p => p.id === id);
        if (idx === -1) return;
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= state.photos.length) return;
        const temp = state.photos[idx];
        state.photos[idx] = state.photos[nextIdx];
        state.photos[nextIdx] = temp;
        renderFilmstrip();
    }

    function onCanvasContextMenu(e) {
        e.preventDefault();
        const ctxMenu = window.ctxMenu;
        if (!ctxMenu) return;

        let html = '';
        html += `<div class="ctx-item" onclick="window.PhotoModeManager.close(true)"><i class="fa-solid fa-window-minimize"></i> ${tKey('photo.closeDock', 'Réduire en onglet')}</div>`;
        html += `<div class="ctx-item" onclick="window.PhotoModeManager.resetParams()"><i class="fa-solid fa-undo"></i> ${tKey('photo.resetAll', 'Réinitialiser tout')}</div>`;
        html += `<hr>`;
        html += `<div class="ctx-item" onclick="window.PhotoModeManager.openActiveInEditor()"><i class="fa-solid fa-up-right-from-square"></i> ${tKey('photo.openInEditor', 'Ouvrir dans MasterPaint')}</div>`;

        ctxMenu.innerHTML = html;
        ctxMenu.style.display = 'block';
        if (window.positionContextMenuNearEvent) window.positionContextMenuNearEvent(e);
    }

    function onFilmstripContextMenu(e) {
        const thumb = e.target.closest('.illu-pm-thumb');
        if (!thumb) return;
        e.preventDefault();
        e.stopPropagation();

        const photoId = thumb.dataset.photoId;
        const idx = state.photos.findIndex(p => p.id === photoId);
        const ctxMenu = window.ctxMenu;
        if (!ctxMenu) return;

        let html = '';
        if (idx > 0) {
            html += `<div class="ctx-item" onclick="window.PhotoModeManager.movePhoto('${photoId}', -1)"><i class="fa-solid fa-arrow-left"></i> ${tKey('photo.moveLeft', 'Déplacer à gauche')}</div>`;
        }
        if (idx < state.photos.length - 1) {
            html += `<div class="ctx-item" onclick="window.PhotoModeManager.movePhoto('${photoId}', 1)"><i class="fa-solid fa-arrow-right"></i> ${tKey('photo.moveRight', 'Déplacer à droite')}</div>`;
        }
        html += `<hr>`;
        html += `<div class="ctx-item" style="color:#ff4d4d" onclick="window.PhotoModeManager.removePhoto('${photoId}')"><i class="fa-solid fa-trash-can"></i> ${tKey('photo.removePhoto', 'Retirer de la session')}</div>`;

        ctxMenu.innerHTML = html;
        ctxMenu.style.display = 'block';
        if (window.positionContextMenuNearEvent) window.positionContextMenuNearEvent(e);
    }

    function selectPhoto(id) {
        const isInitial = state.activeId === null;
        state.activeId = id;
        renderFilmstrip();
        const photo = state.photos.find(p => p.id === id);
        if (!photo) return;

        // Push initial state to history if empty
        if (state.history.length === 0) {
            pushPhotoHistory();
        }

        Object.keys(DEFAULT_PARAMS).forEach(key => {
            const input = document.getElementById(`pm-slider-${key}`);
            const valSpan =
                document.getElementById(`pm-slider-${key}-val`) ||
                document.getElementById(`pm-val-${key}`);
            if (input) input.value = photo.params[key];
            if (valSpan) valSpan.innerText = photo.params[key];
        });

        // Courbes et TSL
        IlluImageAdjustCore.CurveEditor.bind(document, 'pm-editor', photo.params, () => renderActivePhoto());
        IlluImageAdjustCore.HSLManager.bind(document, 'pm-editor', photo.params, () => renderActivePhoto());

        const sDoc = document.getElementById('status-doc-size');
        if (sDoc) {
            let info = `${photo.imageData.width} x ${photo.imageData.height} px`;
            if (photo.metadata) {
                const meta = photo.metadata;
                const details = [];
                if (meta.camera_make || meta.camera_model) {
                    details.push(`${meta.camera_make || ''} ${meta.camera_model || ''}`.trim());
                }
                if (meta.iso_speed) details.push(`ISO ${meta.iso_speed}`);
                if (meta.shutter) {
                    const sh = meta.shutter < 0.99 ? `1/${Math.round(1 / meta.shutter)}s` : `${meta.shutter}s`;
                    details.push(sh);
                }
                if (meta.aperture) details.push(`f/${meta.aperture}`);
                if (details.length > 0) {
                    info += ` | ${details.join(' | ')}`;
                }
            }
            sDoc.innerText = info;
        }

        const modeBtnRow = document.getElementById('pm-mode-btn-row');
        if (modeBtnRow) {
            const rawBtn = document.getElementById('pm-mode-raw-btn');
            const normalBtn = document.getElementById('pm-mode-normal-btn');
            
            modeBtnRow.style.opacity = '1';
            modeBtnRow.style.pointerEvents = 'auto';
            modeBtnRow.title = "Mode de rendu du moteur d'ajustement";
            
            if (photo.useRawMode) {
                rawBtn.classList.add('illu-scope-btn--active');
                rawBtn.setAttribute('aria-pressed', 'true');
                normalBtn.classList.remove('illu-scope-btn--active');
                normalBtn.setAttribute('aria-pressed', 'false');
            } else {
                rawBtn.classList.remove('illu-scope-btn--active');
                rawBtn.setAttribute('aria-pressed', 'false');
                normalBtn.classList.add('illu-scope-btn--active');
                normalBtn.setAttribute('aria-pressed', 'true');
            }
        }
        
        if (window.IlluImageAdjustCore && window.IlluImageAdjustCore.Slider) {
            IlluImageAdjustCore.Slider.updateRanges(document.getElementById('pm-panel-edit'), 'pm-slider-', photo.useRawMode);
        }

        if (isInitial) {
            zoomToFit();
        } else {
            renderActivePhoto();
        }
    }

    function updateActiveParams(key, val) {
        if (!state.activeId) return;
        const photo = state.photos.find(p => p.id === state.activeId);
        if (!photo) return;
        photo.params[key] = val;
        photo.isModified = true;
        renderActivePhoto();
        renderFilmstrip();
    }

    function resetActiveParams() {
        if (!state.activeId) return;
        const photo = state.photos.find(p => p.id === state.activeId);
        if (!photo) return;
        photo.params = deepCloneParams(DEFAULT_PARAMS);
        if (photo.metadata) {
            applyMetadataPresets(photo);
        }
        photo.isModified = false;
        selectPhoto(photo.id);
    }

    function applyToAll() {
        if (!state.activeId) return;
        const photo = state.photos.find(p => p.id === state.activeId);
        if (!photo) return;

        const paramsStr = JSON.stringify(photo.params);

        // Decide targets: if selection exists, apply only to them. Else, all.
        const targetIds = state.selectedIds.length > 0 ? state.selectedIds : state.photos.map(p => p.id);

        state.photos.forEach(p => {
            if (targetIds.includes(p.id)) {
                p.params = JSON.parse(paramsStr);
                p.isModified = true;
            }
        });

        renderFilmstrip();
    }

    function scheduleRender(callback) {
        if (state.rafPending) cancelAnimationFrame(state.rafPending);
        state.rafPending = requestAnimationFrame(() => { state.rafPending = null; callback(); });
    }

    function renderActivePhoto(mode = 'proxy') {
        if (!state.activeId) return;
        const photo = state.photos.find(p => p.id === state.activeId);
        if (!photo) return;

        // Schedule High-Res rendering after inactivity (debounce)
        if (mode === 'proxy') {
            if (state.highResTimeout) clearTimeout(state.highResTimeout);
            state.highResTimeout = setTimeout(() => {
                state.highResTimeout = null;
                renderActivePhoto('highres');
            }, 800);
        }

        scheduleRender(() => {
            const c = document.getElementById('pm-main-canvas');
            const centerEl = document.getElementById('pm-canvas-viewport');
            if (!c || !centerEl) return;
            const ctx = c.getContext('2d');

            const W = photo.imageData.width;
            const H = photo.imageData.height;
            
            // Ensure c has the correct full resolution
            if (c.width !== W || c.height !== H) {
                c.width = W;
                c.height = H;
            }

            const targetW = (W * state.zoom) + 'px';
            const targetH = (H * state.zoom) + 'px';
            const targetTr = `translate(${state.panX}px, ${state.panY}px)`;

            if (c.style.width !== targetW) c.style.width = targetW;
            if (c.style.height !== targetH) c.style.height = targetH;
            if (c.style.transform !== targetTr) c.style.transform = targetTr;

            // PERFORMANCE: Calculate visible viewport in unscaled image coordinates
            const vpW = centerEl.clientWidth || (window.innerWidth * 0.8);
            const vpH = centerEl.clientHeight || (window.innerHeight * 0.8);
            const z = state.zoom || 1;
            
            // The center of the viewport corresponds to this local unscaled coordinate:
            const cx = W / 2 - (state.panX || 0) / z;
            const cy = H / 2 - (state.panY || 0) / z;
            let sw = vpW / z;
            let sh = vpH / z;
            
            // Add a margin to avoid popping during fast panning
            const pad = 64 / z;
            let sx = Math.floor(cx - sw / 2 - pad);
            let sy = Math.floor(cy - sh / 2 - pad);
            
            // Clamp to image bounds
            sx = Math.max(0, sx);
            sy = Math.max(0, sy);
            sw = Math.ceil(Math.min(W - sx, sw + pad * 2));
            sh = Math.ceil(Math.min(H - sy, sh + pad * 2));

            if (sw <= 0 || sh <= 0) {
                sx = 0; sy = 0; sw = W; sh = H;
            }

            // Cache the original image as a canvas for fast cropping
            if (!photo.previewCanvas || photo.previewCanvas.width !== W || photo.previewCanvas.height !== H) {
                photo.previewCanvas = document.createElement('canvas');
                photo.previewCanvas.width = W;
                photo.previewCanvas.height = H;
                photo.previewCanvas.getContext('2d').putImageData(photo.imageData, 0, 0);
            }

            // Proxy mode uses a low LOD for fast dragging. High-res uses screen-accurate LOD.
            let MAX_PROCESS_DIM = 320; 
            if (mode === 'highres') {
                const screenMax = Math.max(window.innerWidth, window.innerHeight);
                // Si l'écran est 1080p ou moins, le rendu au repos (dézoomé) se limite à 720p pour la vitesse.
                // Si c'est un écran 1440p ou 4K, on monte à 1080p pour le rendu global au repos.
                MAX_PROCESS_DIM = (screenMax > 1920) ? 1080 : 720;
            }

            let scale = 1.0;
            if (sw > MAX_PROCESS_DIM || sh > MAX_PROCESS_DIM) {
                scale = MAX_PROCESS_DIM / Math.max(sw, sh);
            }
            
            const procW = Math.max(1, Math.floor(sw * scale));
            const procH = Math.max(1, Math.floor(sh * scale));

            if (!state.cropScratch) state.cropScratch = document.createElement('canvas');
            const cropScratch = state.cropScratch;
            if (cropScratch.width !== procW || cropScratch.height !== procH) {
                cropScratch.width = procW;
                cropScratch.height = procH;
            }
            const cropCtx = cropScratch.getContext('2d', { willReadFrequently: true });
            cropCtx.clearRect(0, 0, procW, procH);
            
            // Draw the required region, downscaling it natively via canvas for the LOD
            cropCtx.drawImage(photo.previewCanvas, sx, sy, sw, sh, 0, 0, procW, procH);
            
            // We need ImageData to pass to the filter engine
            let visibleImageData = cropCtx.getImageData(0, 0, procW, procH);

            // --- RAW MODE 14-BIT LOGIC (bilinear interpolation) ---
            if (photo.useRawMode && photo.imageData.rawFloatData) {
                const floatView = new Float32Array(procW * procH * 4);
                const fullFloat = photo.imageData.rawFloatData;
                const fullW = photo.imageData.rawFloatWidth;
                const fullH = photo.imageData.rawFloatHeight;
                const invScale = 1.0 / scale;

                for (let y = 0; y < procH; y++) {
                    const srcYf = sy + y * invScale;
                    const y0 = Math.floor(srcYf);
                    const y1 = Math.min(y0 + 1, fullH - 1);
                    const fy = srcYf - y0;
                    if (y0 >= fullH) continue;

                    for (let x = 0; x < procW; x++) {
                        const srcXf = sx + x * invScale;
                        const x0 = Math.floor(srcXf);
                        const x1 = Math.min(x0 + 1, fullW - 1);
                        const fx = srcXf - x0;
                        if (x0 >= fullW) continue;

                        const dstIdx = (y * procW + x) * 4;
                        const i00 = (y0 * fullW + x0) * 4;
                        const i10 = (y0 * fullW + x1) * 4;
                        const i01 = (y1 * fullW + x0) * 4;
                        const i11 = (y1 * fullW + x1) * 4;

                        const w00 = (1 - fx) * (1 - fy);
                        const w10 = fx * (1 - fy);
                        const w01 = (1 - fx) * fy;
                        const w11 = fx * fy;

                        floatView[dstIdx]   = fullFloat[i00]   * w00 + fullFloat[i10]   * w10 + fullFloat[i01]   * w01 + fullFloat[i11]   * w11;
                        floatView[dstIdx+1] = fullFloat[i00+1] * w00 + fullFloat[i10+1] * w10 + fullFloat[i01+1] * w01 + fullFloat[i11+1] * w11;
                        floatView[dstIdx+2] = fullFloat[i00+2] * w00 + fullFloat[i10+2] * w10 + fullFloat[i01+2] * w01 + fullFloat[i11+2] * w11;
                        floatView[dstIdx+3] = fullFloat[i00+3] * w00 + fullFloat[i10+3] * w10 + fullFloat[i01+3] * w01 + fullFloat[i11+3] * w11;
                    }
                }
                // Wrap in object mimicking ImageData but containing Float32Array
                visibleImageData = { width: procW, height: procH, data: floatView };
            } else if (photo.useRawMode) {
                console.warn('[RAW DEBUG] useRawMode=true but NO rawFloatData on imageData!');
            }

            if (state.showEffects && window.illuApplyCameraRawParams) {
                const p = Object.assign({}, photo.params, {
                    isLivePreview: true,
                    u_res: [procW, procH], // Use processed resolution for shaders
                    isRawMode: photo.useRawMode // Tell shader to act on full dynamic range
                });
                
                // Process ONLY the visible portion at LOD resolution
                const out = window.illuApplyCameraRawParams(visibleImageData, p);

                ctx.clearRect(0, 0, W, H);
                if (out instanceof HTMLCanvasElement) {
                    ctx.drawImage(out, 0, 0, procW, procH, sx, sy, sw, sh);
                } else if (out && out.width) {
                    if (!state.scratchCanvas) state.scratchCanvas = document.createElement('canvas');
                    const tempC = state.scratchCanvas;
                    if (tempC.width !== out.width || tempC.height !== out.height) {
                        tempC.width = out.width;
                        tempC.height = out.height;
                    }
                    if (out instanceof ImageData) {
                        tempC.getContext('2d').putImageData(out, 0, 0);
                    } else {
                        tempC.getContext('2d').drawImage(out, 0, 0);
                    }
                    ctx.drawImage(tempC, 0, 0, procW, procH, sx, sy, sw, sh);
                }
            } else {
                ctx.clearRect(0, 0, W, H);
                ctx.drawImage(cropScratch, 0, 0, procW, procH, sx, sy, sw, sh);
            }
        });
    }



    async function exportAll(targetIds = null) {
        // targets: if IDs provided, use those. Otherwise, use all photos.
        const targets = targetIds
            ? state.photos.filter(p => targetIds.includes(p.id))
            : state.photos;

        if (targets.length === 0) {
            alert(tKey('photo.exportEmpty', 'Aucune photo à exporter !'));
            return;
        }

        const P = window.IlluProgress;
        const busy = P ? P.createDelayedInstantEffect(tKey('photo.exportingLot', 'Exportation du lot...'), 5) : null;

        try {
            for (let i = 0; i < targets.length; i++) {
                if (busy) busy.progress(Math.round((i / targets.length) * 100));
                const p = targets[i];
                const extendedParams = Object.assign({}, p.params, {
                    u_res: [p.imageData.width, p.imageData.height],
                    isLivePreview: false,
                    isRawMode: p.useRawMode
                });
                const outId = window.illuApplyCameraRawParams ? window.illuApplyCameraRawParams(p.imageData, extendedParams) : p.imageData;

                // Render to temporary canvas for export
                const c = document.createElement('canvas');
                c.width = outId.width; c.height = outId.height;
                c.getContext('2d').putImageData(outId, 0, 0);

                const fmt = 'png';
                const blob = await new Promise(r => c.toBlob(r, `image/${fmt}`));
                if (blob) {
                    const baseName = (p.name || p.fileName || 'photo').split('.')[0];
                    const name = `${baseName}_pm.${fmt}`;
                    if (window.illuFileSaver) {
                        window.illuFileSaver(blob, name);
                    } else {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = name; a.click();
                        URL.revokeObjectURL(url);
                    }
                }
                // Small yield to keep UI responsive
                await new Promise(r => setTimeout(r, 50));
            }
        } finally {
            if (busy) busy.done();
        }
    }

    function showExportOptionsDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'illu-pm-dlg-overlay';
        overlay.id = 'pm-export-dlg';

        const selCount = state.selectedIds.length;
        const totalCount = state.photos.length;

        overlay.innerHTML = `
            <div class="illu-pm-dlg">
                <div class="illu-pm-dlg-h">
                    <i class="fa-solid fa-file-export"></i>
                    <span>${tKey('photo.exportTitle', 'Gestion de l\'exportation')}</span>
                </div>
                <div class="illu-pm-dlg-sub">${tKey('dlg.format', 'Format')} : PNG</div>
                <div class="illu-pm-dlg-b">
                     ${tKey('dlg.exportDesc', 'Choisissez les images que vous souhaitez exporter.')}
                </div>
                <div class="illu-pm-dlg-f">
                    <button class="illu-pm-btn" id="pm-exp-current"><i class="fa-solid fa-image"></i> ${tKey('photo.exportCurrent', 'Image actuelle uniquement')}</button>
                    ${selCount > 0 ? `<button class="illu-pm-btn" id="pm-exp-selection"><i class="fa-solid fa-check-double"></i> ${tKey('photo.exportSelection', 'La sélection')} (${selCount})</button>` : ''}
                    <button class="illu-pm-btn illu-pm-btn-secondary" id="pm-exp-all"><i class="fa-solid fa-layer-group"></i> ${tKey('photo.exportAll', 'Tout le lot')} (${totalCount})</button>
                    <div class="illu-pm-dlg-f-row" style="margin-top:10px">
                        <button class="illu-pm-btn illu-pm-btn-secondary" id="pm-exp-cancel">${tKey('menu.cancel', 'Annuler')}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('pm-exp-current').onclick = async () => {
            overlay.remove();
            if (state.activeId) await exportAll([state.activeId]);
        };
        if (selCount > 0) {
            document.getElementById('pm-exp-selection').onclick = async () => {
                overlay.remove();
                await exportAll(state.selectedIds);
            };
        }
        document.getElementById('pm-exp-all').onclick = async () => {
            overlay.remove();
            await exportAll();
        };
        document.getElementById('pm-exp-cancel').onclick = () => overlay.remove();
    }

    async function openActiveInEditor() {
        if (!state.activeId) return;
        const photo = state.photos.find(p => p.id === state.activeId);
        if (!photo || !window.EditorManager || !window.EditorManager.handleNewProjectFromImage) return;

        if (window.IlluProgress && window.IlluProgress.instantEffectStart) {
            window.IlluProgress.instantEffectStart('Export en cours');
            window.IlluProgress.instantEffectProgress(0, 'Transfert de la haute définition vers le canevas...');
        }

        // Yield to browser to render the loader
        await new Promise(r => setTimeout(r, 50));

        try {
            const p = Object.assign({}, photo.params, {
                isLivePreview: false,
                isRawMode: photo.useRawMode
            });
            const outId = window.illuApplyCameraRawParams ? window.illuApplyCameraRawParams(photo.imageData, p) : photo.imageData;
            const c = document.createElement('canvas');
            c.width = outId.width; c.height = outId.height;
            c.getContext('2d').putImageData(outId, 0, 0);

            window.EditorManager.handleNewProjectFromImage(c);

            if (window.showIlluAlert) window.showIlluAlert(tKey('photo.openedInEditor', 'Image ouverte dans MasterPaint !'));

            // Policy: if only 1 image, close PM Pro. If more, dock it.
            if (state.photos.length === 1) {
                finishClose();
            } else {
                finishClose(true); // Dock the rest
            }
        } finally {
            if (window.IlluProgress && window.IlluProgress.instantEffectDone) {
                window.IlluProgress.instantEffectDone();
            }
        }
    }

    async function openAllInEditor() {
        const modifiedPhotos = state.photos.filter(p => p.isModified);
        const targets = modifiedPhotos.length > 0 ? modifiedPhotos : state.photos;

        if (targets.length === 0) return;

        const P = window.IlluProgress;
        const busy = P ? P.createDelayedInstantEffect(tKey('photo.openingProjects', 'Ouverture des projets...'), 5) : null;

        try {
            for (let i = 0; i < targets.length; i++) {
                if (busy) busy.progress(Math.round((i / targets.length) * 100));
                const p = targets[i];
                const extendedParams = Object.assign({}, p.params, { isLivePreview: false, isRawMode: p.useRawMode });
                const outId = window.illuApplyCameraRawParams ? window.illuApplyCameraRawParams(p.imageData, extendedParams) : p.imageData;
                const c = document.createElement('canvas');
                c.width = outId.width; c.height = outId.height;
                c.getContext('2d').putImageData(outId, 0, 0);
                if (window.EditorManager && window.EditorManager.handleNewProjectFromImage) {
                    window.EditorManager.handleNewProjectFromImage(c);
                }
                // Small yield
                await new Promise(r => setTimeout(r, 50));
            }
        } finally {
            if (busy) busy.done();
            finishClose();
        }
    }

    function showExitConfirmationDialog() {
        if (state.photos.length === 0) {
            closeMode(true);
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'illu-pm-dlg-overlay';
        overlay.id = 'pm-exit-dlg';

        overlay.innerHTML = `
            <div class="illu-pm-dlg">
                <div class="illu-pm-dlg-h">
                    <i class="fa-solid fa-circle-question"></i>
                    <span>${tKey('photo.closeConfirmTitle', 'Quitter Photo Mode Pro ?')}</span>
                </div>
                <div class="illu-pm-dlg-b">
                    ${tKey('photo.closeConfirmText', 'Voulez-vous ouvrir vos photos modifiées dans MasterPaint avant de quitter ?')}
                </div>
                <div class="illu-pm-dlg-f">
                    <button class="illu-pm-btn" id="pm-dlg-open-all"><i class="fa-solid fa-up-right-from-square"></i> ${tKey('photo.closeOpenProjects', 'Ouvrir en projets & Quitter')}</button>
                    <button class="illu-pm-btn illu-pm-btn-secondary" id="pm-dlg-dock"><i class="fa-solid fa-window-minimize"></i> ${tKey('photo.closeDock', 'Réduire en onglet')}</button>
                    <button class="illu-pm-btn illu-pm-btn-secondary" id="pm-dlg-batch-export"><i class="fa-solid fa-file-export"></i> ${tKey('photo.closeBatchExport', 'Tout exporter & Quitter')}</button>
                    <div class="illu-pm-dlg-f-row">
                        <button class="illu-pm-btn illu-pm-btn-secondary" id="pm-dlg-discard" style="color:#ff4d4d">${tKey('photo.closeDiscard', 'Quitter sans enregistrer')}</button>
                        <button class="illu-pm-btn illu-pm-btn-secondary" id="pm-dlg-cancel">${tKey('menu.cancel', 'Annuler')}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('pm-dlg-open-all').onclick = () => {
            overlay.remove();
            openAllInEditor();
        };
        document.getElementById('pm-dlg-dock').onclick = () => {
            overlay.remove();
            finishClose(true);
        };
        document.getElementById('pm-dlg-batch-export').onclick = async () => {
            overlay.remove();
            await exportAll();
            closeMode(true);
        };
        document.getElementById('pm-dlg-discard').onclick = () => {
            overlay.remove();
            finishClose();
        };
        document.getElementById('pm-dlg-cancel').onclick = () => {
            overlay.remove();
        };
    }

    function openMode() {
        refreshMetadata();
        if (state.isOpen) return;

        // If docked, just unhide and restore focus
        if (state.isDocked) {
            state.isOpen = true;
            state.isDocked = false;
            const overlay = document.getElementById('illu-photo-mode-overlay');
            if (overlay) {
                overlay.style.display = '';
                overlay.classList.add('is-open');
            }
            document.body.classList.add('illu-photo-mode-active');
            if (window.IlluTheme && window.IlluTheme.applyFromStorage) window.IlluTheme.applyFromStorage();
            hijackApplicationUI();
            if (window.EditorManager && window.EditorManager.updateTabUI) window.EditorManager.updateTabUI();
            return;
        }

        state.isOpen = true;
        buildUI();
        const overlay = document.getElementById('illu-photo-mode-overlay');
        if (overlay) {
            overlay.classList.add('is-open');
        }
        document.body.classList.add('illu-photo-mode-active');
        if (window.IlluTheme && window.IlluTheme.applyFromStorage) window.IlluTheme.applyFromStorage();
        hijackApplicationUI();

        // Refresh mobile drawer menus if open or active
        if (typeof window.illuRebuildMobileDrawerMenus === 'function') {
            window.illuRebuildMobileDrawerMenus();
        }
    }

    function hijackApplicationUI() {
        // Hijack Undo/Redo
        state.originalUndo = window.undo;
        state.originalRedo = window.redo;
        window.undo = undoPhotoHistory;
        window.redo = redoPhotoHistory;

        // Locking UI parts
        const helpTab = document.querySelector('[data-illu-pdn-tab="win-help"]');
        if (helpTab) helpTab.style.display = 'none';

        // --- Menu Policy for Photo Mode Pro ---
        const findMenuItem = (key) => {
            const span = document.querySelector(`span[data-i18n="${key}"]`);
            return span ? span.closest('li[role="menuitem"]') : null;
        };

        const mStd = document.getElementById('menu-file-standard');
        const mPro = document.getElementById('menu-file-photopro');
        if (mStd) mStd.style.display = 'none';
        if (mPro) mPro.style.display = '';

        ['menu.image', 'menu.layers', 'menu.window', 'menu.effects'].forEach(key => {
            const m = findMenuItem(key);
            if (m) m.style.display = 'none';
        });

        ['menu.edit', 'menu.adjust'].forEach(key => {
            const m = findMenuItem(key);
            if (m) m.style.display = '';
        });

        const menuAdjust = findMenuItem('menu.adjust');
        if (menuAdjust) {
            menuAdjust.style.display = '';
            const supported = ['menu.adjAutolevel', 'menu.adjInvert', 'menu.adjGrayscale', 'menu.adjSepia'];
            const unsupported = ['menu.adjBrightness', 'menu.adjHsv', 'menu.adjExposure', 'menu.adjSharpen', 'menu.adjPosterize', 'menu.adjLevels', 'menu.adjColorBal', 'menu.adjCameraRaw', 'menu.instFiltersGallery'];
            unsupported.forEach(key => {
                const item = findMenuItem(key);
                if (item) {
                    item.style.opacity = '0.4';
                    item.style.pointerEvents = 'none';
                    item.style.display = ''; // Assurer la visibilité même si masqué par défaut dans le HTML
                }
            });
            supported.forEach(key => {
                const item = findMenuItem(key);
                if (item) { item.style.opacity = ''; item.style.pointerEvents = ''; }
            });
        }

        if (window.IlluImageAdjustCore) {
            const cfMenu = document.querySelector('[data-i18n="menu.editContentAwareFill"]');
            if (cfMenu && cfMenu.closest('li')) { cfMenu.closest('li').style.pointerEvents = 'none'; cfMenu.closest('li').style.opacity = '0.5'; }
        }

        window.removeEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keydown', handleGlobalKeyDown);

        // Context menus
        const area = document.getElementById('pm-canvas-area');
        if (area) {
            area.removeEventListener('contextmenu', onCanvasContextMenu);
            area.addEventListener('contextmenu', onCanvasContextMenu);
        }
        const fs = document.getElementById('pm-filmstrip');
        if (fs) {
            fs.removeEventListener('contextmenu', onFilmstripContextMenu);
            fs.addEventListener('contextmenu', onFilmstripContextMenu);
        }
    }

    function closeMode(dock = false) {
        if (!state.isOpen) return;

        if (dock) {
            finishClose(true);
            return;
        }

        // --- Exit Confirmation if modified ---
        const modifiedCount = state.photos.filter(p => p.isModified).length;
        if (modifiedCount > 0) {
            showExitConfirmationDialog();
        } else {
            finishClose();
        }
    }

    function finishClose(dock = false) {
        state.isOpen = false;
        state.isDocked = dock;

        const overlay = document.getElementById('illu-photo-mode-overlay');
        if (overlay) {
            overlay.classList.remove('is-open');
            if (dock) overlay.style.display = 'none';
        }
        document.body.classList.remove('illu-photo-mode-active');
        if (window.IlluTheme && window.IlluTheme.applyFromStorage) window.IlluTheme.applyFromStorage();

        // Unlocking UI parts
        const helpTab = document.querySelector('[data-illu-pdn-tab="win-help"]');
        if (helpTab) helpTab.style.display = '';

        // Restore handlers
        if (state.originalUndo) window.undo = state.originalUndo;
        if (state.originalRedo) window.redo = state.originalRedo;
        state.originalUndo = null;
        state.originalRedo = null;

        // Restore ALL menus to full display
        const findMenuItemR = (key) => {
            const span = document.querySelector(`span[data-i18n="${key}"]`);
            return span ? span.closest('li[role="menuitem"]') : null;
        };

        const mStd = document.getElementById('menu-file-standard');
        const mPro = document.getElementById('menu-file-photopro');
        if (mStd) mStd.style.display = '';
        if (mPro) mPro.style.display = 'none';

        ['menu.image', 'menu.layers', 'menu.window', 'menu.effects'].forEach(key => {
            const m = findMenuItemR(key);
            if (m) m.style.display = '';
        });
        // Restore Image sub-items
        const menuImageR = findMenuItemR('menu.image');
        if (menuImageR) {
            menuImageR.style.display = '';
            menuImageR.querySelectorAll('li[role="menuitem"]').forEach(li => li.style.display = '');
        }
        // Restore Adjust sub-items
        const menuAdjustR = findMenuItemR('menu.adjust');
        if (menuAdjustR) {
            menuAdjustR.style.display = '';
            menuAdjustR.querySelectorAll('li[role="menuitem"]').forEach(li => {
                li.style.opacity = '';
                li.style.pointerEvents = '';
                li.style.display = '';
            });
        }

        if (window.EditorManager && window.EditorManager.render) {
            const cfMenu = document.querySelector('[data-i18n="menu.editContentAwareFill"]');
            if (cfMenu && cfMenu.closest('li')) cfMenu.closest('li').style.pointerEvents = '', cfMenu.closest('li').style.opacity = '';
        }

        window.removeEventListener('keydown', handleGlobalKeyDown);

        if (!dock) {
            setTimeout(() => { if (overlay) overlay.remove(); state.photos = []; state.activeId = null; }, 300);
        }

        // Notify tab bar
        if (window.EditorManager && window.EditorManager.updateTabUI) window.EditorManager.updateTabUI();

        // Refresh mobile drawer menus to restore standard layout
        if (typeof window.illuRebuildMobileDrawerMenus === 'function') {
            window.illuRebuildMobileDrawerMenus();
        }
    }

    function getActivePhoto() {
        if (!state.isOpen || !state.activeId) return null;
        return state.photos.find(p => p.id === state.activeId);
    }

    function getActiveImageData() {
        const photo = getActivePhoto();
        return photo ? photo.imageData : null;
    }

    // --- Photo Mode Undo/Redo History ---

    function pushPhotoHistory() {
        const photo = getActivePhoto();
        if (!photo) return;
        // Clone the current ImageData (cheap: just copy the buffer)
        const copy = new ImageData(
            new Uint8ClampedArray(photo.imageData.data),
            photo.imageData.width,
            photo.imageData.height
        );
        const entry = {
            photoId: photo.id,
            imageData: copy,
            params: Object.assign({}, photo.params)
        };
        // Trim redo future if we branched
        if (state.historyIndex < state.history.length - 1) {
            state.history.splice(state.historyIndex + 1);
        }
        state.history.push(entry);
        if (state.history.length > state.historyMaxLen) state.history.shift();
        else state.historyIndex++;
    }

    function undoPhotoHistory() {
        if (state.historyIndex <= 0) return;
        state.historyIndex--;
        _applyHistoryAt(state.historyIndex);
    }

    function redoPhotoHistory() {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex++;
        _applyHistoryAt(state.historyIndex);
    }

    function _applyHistoryAt(idx) {
        const entry = state.history[idx];
        if (!entry) return;
        const photo = state.photos.find(p => p.id === entry.photoId);
        if (!photo) return;
        photo.imageData = new ImageData(
            new Uint8ClampedArray(entry.imageData.data),
            entry.imageData.width,
            entry.imageData.height
        );
        photo.previewImageData = downscaleForPreview(photo.imageData);
        photo.thumbUrl = generateThumbUrl(photo.previewImageData);
        photo.params = Object.assign({}, entry.params);
        photo.isModified = true;
        state.currentCanvasWidth = 0; // Force canvas resize
        state.scratchCanvas = null;
        // Sync sliders
        Object.keys(photo.params).forEach(key => {
            const input = document.getElementById(`pm-slider-${key}`);
            const valSpan =
                document.getElementById(`pm-slider-${key}-val`) ||
                document.getElementById(`pm-val-${key}`);
            if (input) input.value = photo.params[key];
            if (valSpan) valSpan.innerText = photo.params[key];
        });
        renderActivePhoto();
        renderFilmstrip();
    }

    function updateActivePhotoData(newImageData) {
        const photo = getActivePhoto();
        if (!photo || !newImageData) return;
        pushPhotoHistory(); // Snapshot before overwriting
        photo.imageData = newImageData;
        photo.previewImageData = downscaleForPreview(newImageData);
        photo.thumbUrl = generateThumbUrl(photo.previewImageData);
        photo.isModified = true;
        renderActivePhoto();
        renderFilmstrip();
    }

    function transformActivePhoto(action) {
        pushPhotoHistory();
        const photo = getActivePhoto();
        if (!photo || !photo.imageData) return;

        const src = photo.imageData;
        const sw = src.width;
        const sh = src.height;

        const temp = document.createElement('canvas');
        const tctx = temp.getContext('2d');

        if (action === 'rot90cw' || action === 'rot90ccw') {
            temp.width = sh;
            temp.height = sw;
            tctx.translate(temp.width / 2, temp.height / 2);
            tctx.rotate((action === 'rot90cw' ? 90 : -90) * Math.PI / 180);

            // Put source data in a helper canvas to rotate
            const helper = document.createElement('canvas');
            helper.width = sw; helper.height = sh;
            helper.getContext('2d').putImageData(src, 0, 0);
            tctx.drawImage(helper, -sw / 2, -sh / 2);
        } else if (action === 'flipH' || action === 'flipV') {
            temp.width = sw;
            temp.height = sh;
            if (action === 'flipH') {
                tctx.translate(sw, 0);
                tctx.scale(-1, 1);
            } else {
                tctx.translate(0, sh);
                tctx.scale(1, -1);
            }
            const helper = document.createElement('canvas');
            helper.width = sw; helper.height = sh;
            helper.getContext('2d').putImageData(src, 0, 0);
            tctx.drawImage(helper, 0, 0);
        } else {
            return;
        }

        updateActivePhotoData(tctx.getImageData(0, 0, temp.width, temp.height));
    }

    function cropActivePhoto(x, y, w, h) {
        pushPhotoHistory();
        const photo = getActivePhoto();
        if (!photo || !photo.imageData) return;

        const temp = document.createElement('canvas');
        temp.width = w;
        temp.height = h;
        const tctx = temp.getContext('2d');

        const helper = document.createElement('canvas');
        helper.width = photo.imageData.width;
        helper.height = photo.imageData.height;
        helper.getContext('2d').putImageData(photo.imageData, 0, 0);

        tctx.drawImage(helper, x, y, w, h, 0, 0, w, h);
        updateActivePhotoData(tctx.getImageData(0, 0, w, h));
    }

    function showFilterGallery() {
        if (!state.activeId) return;

        const overlay = document.createElement('div');
        overlay.className = 'illu-pm-dlg-overlay';
        overlay.id = 'pm-filter-gallery-overlay';

        const presetsList = [
            { id: 'teal_and_orange', icon: 'fa-film', label: 'Cinéma' },
            { id: 'neon_city', icon: 'fa-city', label: 'Néon Urbain' },
            { id: 'cyber_green', icon: 'fa-microchip', label: 'Cyber' },
            { id: 'retro_instant', icon: 'fa-camera-retro', label: 'Rétro 90s' },
            { id: 'faded_70s', icon: 'fa-clapperboard', label: 'Pellicule 70s' },
            { id: 'bw_hard', icon: 'fa-circle-half-stroke', label: 'N&B Intense' },
            { id: 'sepia_classic', icon: 'fa-scroll', label: 'Sépia Noir' },
            { id: 'arctic_chill', icon: 'fa-snowflake', label: 'Arctique' },
            { id: 'desert_sun', icon: 'fa-sun', label: 'Désert' },
            { id: 'cotton_candy', icon: 'fa-candy-cane', label: 'Pastel' },
            { id: 'high_key', icon: 'fa-lightbulb', label: 'Lumière Pro' },
            { id: 'matte_finish', icon: 'fa-border-none', label: 'Fini Mat' }
        ];

        let cardsHtml = '';
        presetsList.forEach(p => {
            cardsHtml += `
                <div class="illu-pm-filter-card" onclick="PhotoModeManager.applyFilterFromGallery('${p.id}')">
                    <i class="fa-solid ${p.icon}"></i>
                    <span>${p.label}</span>
                </div>
            `;
        });

        overlay.innerHTML = `
            <div class="illu-pm-dlg" style="width: 500px;">
                <div class="illu-pm-dlg-h">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <span>${tKey('photo.filtersGallery', 'Galerie de Filtres')}</span>
                </div>
                <div class="illu-pm-dlg-b">
                    <div class="illu-pm-filter-grid">
                        ${cardsHtml}
                    </div>
                </div>
                <div class="illu-pm-dlg-f">
                    <div class="illu-pm-dlg-f-row">
                        <button class="pm-btn-cancel" onclick="document.getElementById('pm-filter-gallery-overlay').remove()">${tKey('dlg.cancel', 'Fermer')}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }

    function applyFilterFromGallery(presetId) {
        const p = PRESETS[presetId];
        if (p && state.activeId) {
            const photo = state.photos.find(x => x.id === state.activeId);
            if (photo) {
                photo.params = Object.assign({}, DEFAULT_PARAMS, p);
                photo.isModified = true;
                selectPhoto(state.activeId);
            }
        }
    }

    global.PhotoModeManager = {
        open: openMode,
        close: closeMode,
        isOpen: () => state.isOpen,
        importPhotos: (files) => handleImport({ target: { files } }),
        openFromProject: openFromProject,
        openFromCanvas: openFromCanvas,
        getActiveImageData: getActiveImageData,
        updateActivePhotoData: updateActivePhotoData,
        transformActivePhoto: transformActivePhoto,
        cropActivePhoto: cropActivePhoto,
        hasActiveSession: () => state.photos.length > 0,
        isDocked: () => state.isDocked,
        getPhotoCount: () => state.photos.length,
        removePhoto: removePhoto,
        movePhoto: movePhoto,
        openActiveInEditor: openActiveInEditor,
        applyToAll: applyToAll,
        showExportOptions: showExportOptionsDialog,
        resetParams: resetActiveParams,
        close: closeMode
    };

})(typeof self !== 'undefined' ? self : window);
