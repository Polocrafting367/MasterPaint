/**
 * illu-mobile-shell.js — Disposition « Téléphone » v2 : dock scrollable, sheets, ajustements rapides.
 */
(function () {
    'use strict';

    const MOBILE_TOOL_IDS = new Set([
        'tool-select',
        'tool-brush',
        'tool-gradient',
        'tool-eraser',
        'tool-fill',
        'tool-eyedropper',
        'tool-move',
        'tool-deform',
        'tool-wand',
        'tool-text',
        'tool-shapes-family',
        'tool-circle',
        /* 4e rangée : sélection avancée */
        'tool-direct-select',
        'tool-warp-4',
        'tool-pencil',
        'tool-round-3',
        'tool-line'
    ]);

    const SHEET_PANEL_MAP = {
        tools: { id: 'win-tools', bodyId: 'illu-mobile-sheet-tools-body' },
        colors: { id: 'win-colors', bodyId: 'illu-mobile-sheet-colors-body' },
        layers: { id: 'win-layers', bodyId: 'illu-mobile-sheet-layers-body' },
        history: { id: 'win-history', bodyId: 'illu-mobile-sheet-history-body' },
        effects: { bodyId: 'illu-mobile-sheet-effects-body' },
        effects2: { bodyId: 'illu-mobile-sheet-effects2-body' },
        adjust: { bodyId: 'illu-mobile-sheet-adjust-body' }
    };

    const MOBILE_COLOR_QUICK = [
        {
            key: 'filters',
            i18n: 'mobile.colorQuickFilters',
            fallback: 'Galerie',
            icon: 'fa-wand-magic-sparkles',
            run: () => {
                if (window.FilterManager && typeof window.FilterManager.showInstantFilterGallery === 'function') {
                    window.FilterManager.showInstantFilterGallery();
                }
            }
        },
        {
            key: 'brightness',
            i18n: 'mobile.colorQuickBrightness',
            fallback: 'Lum./Cont.',
            icon: 'fa-sun',
            run: () => typeof window.applyEffect === 'function' && window.applyEffect('brightness')
        },
        {
            key: 'hsv',
            i18n: 'mobile.colorQuickHsv',
            fallback: 'Teinte/Sat.',
            icon: 'fa-palette',
            run: () => typeof window.applyEffect === 'function' && window.applyEffect('hsv')
        },
        {
            key: 'invert',
            i18n: 'mobile.colorQuickInvert',
            fallback: 'Inverser',
            icon: 'fa-circle-half-stroke',
            run: () => typeof window.applyEffect === 'function' && window.applyEffect('invert')
        },
        {
            key: 'grayscale',
            i18n: 'mobile.colorQuickGrayscale',
            fallback: 'N&B',
            icon: 'fa-droplet-slash',
            run: () => typeof window.applyEffect === 'function' && window.applyEffect('grayscale')
        }
    ];

    let shellInit = false;
    let openSheetId = null;
    let effectDialogObserver = null;
    let colorQuickBuilt = false;
    let colorsPaletteObserver = null;
    let topBarBound = false;
    let mobileCanvasFitObserver = null;
    const panelHome = new Map();

    function tKey(key, fallback) {
        if (
            window.IlluI18n &&
            typeof window.IlluI18n.hasKey === 'function' &&
            window.IlluI18n.hasKey(key) &&
            typeof window.IlluI18n.t === 'function'
        ) {
            return window.IlluI18n.t(key);
        }
        return fallback != null && fallback !== '' ? fallback : key;
    }

    function isShellMode() {
        return (
            typeof window.isIlluMobileUiActive === 'function' &&
            window.isIlluMobileUiActive() &&
            document.body.classList.contains('illu-mobile-shell-active')
        );
    }

    function syncIlluMobileSelectActionExtras() {
        const t = window.activeTool || 'select';
        const selectTools = new Set(['select', 'move', 'wand', 'direct-select', 'deform', 'warp-4']);
        const grp = document.getElementById('tool-pinned-select-actions');
        const show = isShellMode() && selectTools.has(t) && grp && !grp.hidden;
        const ribbonMobile =
            typeof window.illuIsRibbonMobileLayout === 'function' && window.illuIsRibbonMobileLayout();
        ['illu-mobile-zoom-fit-wrap', 'illu-mobile-deselect-wrap'].forEach((id) => {
            const wrap = document.getElementById(id);
            if (!wrap) return;
            if (ribbonMobile && (id === 'illu-mobile-zoom-fit-wrap' || id === 'illu-mobile-deselect-wrap')) {
                if (id === 'illu-mobile-zoom-fit-wrap' && typeof window.illuSyncMobileViewActions === 'function') {
                    window.illuSyncMobileViewActions();
                } else {
                    wrap.hidden = true;
                    wrap.setAttribute('aria-hidden', 'true');
                }
                return;
            }
            wrap.hidden = !show;
            wrap.setAttribute('aria-hidden', !show ? 'true' : 'false');
        });
        if (typeof window.illuSyncMobileSelectionRibbonActions === 'function') {
            window.illuSyncMobileSelectionRibbonActions();
        }
    }

    window.syncIlluMobileZoomFitButtonVisibility = syncIlluMobileSelectActionExtras;
    window.syncIlluMobileSelectActionExtras = syncIlluMobileSelectActionExtras;

    function unbindMobileCanvasFitObservers() {
        if (mobileCanvasFitObserver) {
            mobileCanvasFitObserver.disconnect();
            mobileCanvasFitObserver = null;
        }
    }

    function runMobileAction(fn) {
        closeMobileSheet();
        if (typeof fn === 'function') fn();
    }

    function findMenuItemByI18n(menubarRoot, i18nKey) {
        if (!menubarRoot || !i18nKey) return null;
        const spans = menubarRoot.querySelectorAll(`span[data-i18n="${i18nKey}"]`);
        for (const span of spans) {
            const li = span.closest('li[role="menuitem"]');
            if (li && menubarRoot.contains(li)) return li;
        }
        return null;
    }

    function isMenuLiVisible(li) {
        if (!li) return false;
        if (li.hidden) return false;
        if (li.classList.contains('divider')) return false;
        if (li.style.display === 'none' || li.style.pointerEvents === 'none') return false;
        return true;
    }

    function resolveMenuI18nLabel(i18nKey, fallbackText) {
        const fb = (fallbackText || '').trim();
        if (!i18nKey || !window.IlluI18n || typeof window.IlluI18n.t !== 'function') return fb || i18nKey || '';
        if (typeof window.IlluI18n.hasKey === 'function' && !window.IlluI18n.hasKey(i18nKey)) {
            return fb || i18nKey;
        }
        const s = window.IlluI18n.t(i18nKey);
        if (!s || s === i18nKey) return fb || i18nKey;
        return String(s).trim();
    }

    function extractMenuLeafMeta(li) {
        const iconEl = li.querySelector('.menu-icon i');
        const iconClass = iconEl
            ? Array.from(iconEl.classList)
                  .filter((c) => c.startsWith('fa-'))
                  .join(' ')
            : 'fa-solid fa-circle';
        const labelSpan = li.querySelector(':scope > span:not(.menu-icon)');
        const i18nKey = labelSpan && labelSpan.getAttribute('data-i18n');
        const raw = (labelSpan && labelSpan.textContent ? labelSpan.textContent : li.textContent || '').trim();
        const label = resolveMenuI18nLabel(i18nKey, raw);
        return { iconClass, i18nKey, label };
    }

    function illuMobileCollectMenuLeaves(menuI18nKey) {
        const menubar = document.querySelector('menu.illu-menubar-root');
        if (!menubar) return [];
        const topLi = findMenuItemByI18n(menubar, menuI18nKey);
        if (!topLi) return [];
        const topUl = topLi.querySelector(':scope > ul[role="menu"]');
        if (!topUl) return [];

        const out = [];

        function walk(ul, section, sectionI18nKey) {
            ul.querySelectorAll(':scope > li').forEach((li) => {
                if (!isMenuLiVisible(li)) return;
                const sub = li.querySelector(':scope > ul[role="menu"]');
                const labelSpan = li.querySelector(':scope > span:not(.menu-icon)');
                const sectionLabel = labelSpan ? labelSpan.textContent.trim() : '';
                const spanI18n = labelSpan ? (labelSpan.dataset.i18n || '') : '';
                if (sub) {
                    walk(sub, sectionLabel || section, spanI18n || sectionI18nKey);
                } else if (li.classList.contains('menu-row-icon')) {
                    const meta = extractMenuLeafMeta(li);
                    out.push({
                        li,
                        section: section || '',
                        sectionI18nKey: sectionI18nKey || '',
                        ...meta
                    });
                }
            });
        }

        walk(topUl, '', '');
        return out;
    }

    function buildMenuSheet(bodyId, menuI18nKey, includeSectionKeys) {
        const body = document.getElementById(bodyId);
        if (!body) return;
        const allLeaves = illuMobileCollectMenuLeaves(menuI18nKey);
        const leaves = includeSectionKeys
            ? allLeaves.filter(l => includeSectionKeys.includes(l.sectionI18nKey))
            : allLeaves;
        body.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'illu-mobile-menu-sheet';

        const bySection = new Map();
        leaves.forEach((item) => {
            const key = item.section || '';
            if (!bySection.has(key)) bySection.set(key, []);
            bySection.get(key).push(item);
        });

        const sectionKeys = [...bySection.keys()].sort((a, b) => {
            if (!a) return 1;
            if (!b) return -1;
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
        });

        sectionKeys.forEach((sectionKey) => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'illu-mobile-effect-section';
            if (sectionKey) {
                const title = document.createElement('h4');
                title.className = 'illu-mobile-effect-section__title';
                title.textContent = sectionKey;
                sectionEl.appendChild(title);
            }
            const list = document.createElement('div');
            list.className = 'illu-mobile-effect-list';
            list.setAttribute('role', 'list');
            bySection.get(sectionKey).forEach((item) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'illu-mobile-effect-list__item';
                btn.setAttribute('role', 'listitem');
                const i18nAttr = item.i18nKey ? ` data-i18n="${item.i18nKey}"` : '';
                btn.innerHTML = `<i class="${item.iconClass}" aria-hidden="true"></i><span${i18nAttr}>${item.label}</span>`;
                btn.addEventListener('click', () => {
                    runMobileAction(() => item.li.click());
                });
                list.appendChild(btn);
            });
            sectionEl.appendChild(list);
            wrap.appendChild(sectionEl);
        });

        if (!leaves.length) {
            const empty = document.createElement('p');
            empty.style.padding = '12px';
            empty.textContent = tKey('mobile.menuSheetEmpty', 'Aucune entrée disponible.');
            wrap.appendChild(empty);
        }

        body.appendChild(wrap);
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(wrap);
        }
    }

    function hookEffectDialogCloseSheet() {
        if (effectDialogObserver) return;
        let effectDialogWasOpen = document.body.classList.contains('effect-dialog-open');
        effectDialogObserver = new MutationObserver(() => {
            if (!isShellMode()) return;
            const open = document.body.classList.contains('effect-dialog-open');
            if (open && !effectDialogWasOpen) {
                if (openSheetId) closeMobileSheet();
                requestAnimationFrame(() => {
                    if (!document.body.classList.contains('effect-dialog-open')) return;
                    if (typeof window.fitActiveProjectZoomToWorkspaceForEffect === 'function') {
                        window.fitActiveProjectZoomToWorkspaceForEffect();
                    }
                });
            } else if (!open && effectDialogWasOpen) {
                const em = window.EditorManager;
                if (em && typeof em.applyCanvasViewportOnly === 'function') {
                    em.applyCanvasViewportOnly();
                }
            }
            effectDialogWasOpen = open;
        });
        effectDialogObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    function mountChromeDomOrder() {
        const container = document.getElementById('tool-options-container');
        const strip = document.getElementById('illu-mobile-opt-strip');
        if (container && strip && strip.parentNode && container.parentNode === strip.parentNode) {
            if (strip.compareDocumentPosition(container) & Node.DOCUMENT_POSITION_FOLLOWING) {
                strip.parentNode.insertBefore(container, strip);
            }
        }
    }

    function getPool() {
        return document.getElementById('illu-mobile-palette-pool');
    }

    function rememberPanelHome(el) {
        if (!el || panelHome.has(el.id)) return;
        panelHome.set(el.id, {
            parent: el.parentNode,
            next: el.nextSibling
        });
    }

    function restorePanelToHome(id) {
        if (!id) return;
        const el = document.getElementById(id);
        const home = panelHome.get(id);
        if (!el || !home || !home.parent) return;
        if (home.next && home.next.parentNode === home.parent) {
            home.parent.insertBefore(el, home.next);
        } else {
            home.parent.appendChild(el);
        }
    }

    function stashPanelsInPool() {
        const pool = getPool();
        if (!pool) return;
        Object.values(SHEET_PANEL_MAP).forEach((cfg) => {
            if (!cfg.id) return;
            const el = document.getElementById(cfg.id);
            if (!el) return;
            rememberPanelHome(el);
            if (el.parentNode !== pool) pool.appendChild(el);
        });
    }

    function setDockPressed(sheetKey) {
        document.querySelectorAll('[data-illu-mobile-dock]').forEach((btn) => {
            const key = btn.getAttribute('data-illu-mobile-dock');
            btn.setAttribute('aria-pressed', key === sheetKey ? 'true' : 'false');
        });
    }

    function closeMobileSheet() {
        const toolLbl = document.getElementById('illu-mobile-active-tool-lbl');
        if (toolLbl) toolLbl.hidden = true;
        const root = document.getElementById('illu-mobile-sheet-root');
        if (!root) return;
        Object.keys(SHEET_PANEL_MAP).forEach((key) => {
            const cfg = SHEET_PANEL_MAP[key];
            if (cfg.id) restorePanelToHome(cfg.id);
        });
        document.querySelectorAll('.illu-mobile-sheet').forEach((s) => {
            s.hidden = true;
        });
        root.classList.remove('illu-mobile-sheet-root--open');
        root.setAttribute('aria-hidden', 'true');
        openSheetId = null;
        setDockPressed(null);
        disconnectColorsPaletteObserver();
        if (typeof window.applyFloatingPaletteVisibility === 'function') {
            window.applyFloatingPaletteVisibility();
        }
    }

    function disconnectColorsPaletteObserver() {
        if (colorsPaletteObserver) {
            colorsPaletteObserver.disconnect();
            colorsPaletteObserver = null;
        }
    }

    function connectColorsPaletteObserver() {
        disconnectColorsPaletteObserver();
        const body = document.getElementById('illu-mobile-sheet-colors-body');
        if (!body || typeof ResizeObserver === 'undefined') return;
        colorsPaletteObserver = new ResizeObserver(() => {
            if (openSheetId === 'colors' && typeof window.refreshPaletteGridLayout === 'function') {
                window.refreshPaletteGridLayout();
            }
        });
        colorsPaletteObserver.observe(body);
    }

    function ensureColorQuickActions() {
        if (colorQuickBuilt) return;
        const body = document.getElementById('illu-mobile-sheet-colors-body');
        if (!body) return;
        let quick = document.getElementById('illu-mobile-color-quick-actions');
        if (!quick) {
            quick = document.createElement('div');
            quick.id = 'illu-mobile-color-quick-actions';
            quick.className = 'illu-mobile-color-quick';
            quick.setAttribute('role', 'toolbar');
            quick.setAttribute('aria-label', tKey('menu.adjust', 'Ajustements'));
            body.insertBefore(quick, body.firstChild);
        }
        quick.innerHTML = '';
        MOBILE_COLOR_QUICK.forEach((item) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'illu-mobile-color-quick__btn';
            btn.dataset.mobileColorQuick = item.key;
            btn.innerHTML = `<i class="fa-solid ${item.icon}" aria-hidden="true"></i><span data-i18n="${item.i18n}">${tKey(item.i18n, item.fallback)}</span>`;
            btn.addEventListener('click', () => {
                runMobileAction(item.run);
            });
            quick.appendChild(btn);
        });
        colorQuickBuilt = true;
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(quick);
        }
    }

    function buildEffectsSheet() {
        buildMenuSheet('illu-mobile-sheet-effects-body', 'menu.effects',
            ['menu.imageCutout', 'menu.fxArtistic', 'menu.fxNoise', 'menu.fxDistort']);
    }

    function buildEffects2Sheet() {
        buildMenuSheet('illu-mobile-sheet-effects2-body', 'menu.effects',
            ['menu.fxBlur', 'menu.fxPhoto', 'menu.fxRender', 'menu.fxStylize']);
    }

    function buildAdjustSheet() {
        buildMenuSheet('illu-mobile-sheet-adjust-body', 'menu.adjust');
    }

    function layoutColorsSheetMobile() {
        const winColors = document.getElementById('win-colors');
        if (!winColors) return;
        winColors.classList.add('color-window-expanded');
        const expandBtn = document.getElementById('btn-col-expand');
        if (expandBtn) expandBtn.style.display = 'none';
        const sliders = document.getElementById('color-sliders-panel');
        if (sliders) {
            sliders.style.display = 'none';
            sliders.setAttribute('aria-hidden', 'true');
        }
    }

    function openMobileSheet(sheetKey) {
        if (!isShellMode()) return;
        const cfg = SHEET_PANEL_MAP[sheetKey];
        if (!cfg) return;
        if (openSheetId === sheetKey) {
            closeMobileSheet();
            return;
        }
        closeMobileSheet();
        const root = document.getElementById('illu-mobile-sheet-root');
        const sheet = document.getElementById(`illu-mobile-sheet-${sheetKey}`);
        const body = document.getElementById(cfg.bodyId);
        if (!root || !sheet || !body) return;

        if (cfg.id) {
            const panel = document.getElementById(cfg.id);
            if (!panel) return;
            rememberPanelHome(panel);
            body.appendChild(panel);
            panel.classList.remove('illu-floating-window-hidden');
        }

        if (sheetKey === 'colors') {
            ensureColorQuickActions();
            layoutColorsSheetMobile();
        }
        if (sheetKey === 'effects') buildEffectsSheet();
        if (sheetKey === 'effects2') buildEffects2Sheet();
        if (sheetKey === 'adjust') buildAdjustSheet();

        sheet.hidden = false;
        root.classList.add('illu-mobile-sheet-root--open');
        root.setAttribute('aria-hidden', 'false');
        openSheetId = sheetKey;
        setDockPressed(sheetKey);

        if (typeof window.applyFloatingPaletteVisibility === 'function') {
            window.applyFloatingPaletteVisibility();
        }
        if (sheetKey === 'tools') {
            applyMobileToolVisibility();
            syncMobileActiveToolLabel();
        }
        if (sheetKey === 'colors') {
            connectColorsPaletteObserver();
            queueMicrotask(() => {
                if (typeof window.refreshPaletteGridLayout === 'function') {
                    window.refreshPaletteGridLayout();
                }
            });
        }
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(sheet);
        }
    }

    function mobileActiveToolLabel() {
        const t = window.activeTool || 'select';
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const key = 'tool.' + t;
            const tr = window.IlluI18n.t(key);
            if (tr && tr !== key) return tr;
        }
        if (window.TOOL_OPTIONS_UI && window.TOOL_OPTIONS_UI[t] && window.TOOL_OPTIONS_UI[t].label) {
            return window.TOOL_OPTIONS_UI[t].label;
        }
        return t;
    }

    function syncMobileActiveToolLabel() {
        const lbl = document.getElementById('illu-mobile-active-tool-lbl');
        if (!lbl) return;
        lbl.textContent = mobileActiveToolLabel();
        lbl.hidden = !(isShellMode() && openSheetId === 'tools');
    }

    window.syncIlluMobileActiveToolLabel = syncMobileActiveToolLabel;

    function applyMobileToolVisibility() {
        const toolbox = document.getElementById('main-toolbox');
        if (!toolbox) return;
        toolbox.querySelectorAll('.tool-btn').forEach((btn) => {
            const show = MOBILE_TOOL_IDS.has(btn.id);
            btn.hidden = !show;
            btn.style.display = show ? '' : 'none';
        });
        const toolsPanel = document.getElementById('win-tools');
        if (toolsPanel) {
            const tb = toolsPanel.querySelector('.title-bar');
            if (tb) tb.style.display = 'none';
        }
        syncMobileActiveToolLabel();
    }

    function restoreAllMobileToolVisibility() {
        const toolbox = document.getElementById('main-toolbox');
        if (!toolbox) return;
        toolbox.querySelectorAll('.tool-btn').forEach((btn) => {
            btn.hidden = false;
            btn.style.display = '';
        });
        const toolsPanel = document.getElementById('win-tools');
        if (toolsPanel) {
            const tb = toolsPanel.querySelector('.title-bar');
            if (tb) tb.style.display = '';
        }
        if (typeof window.syncColorPanelToUILayout === 'function') {
            window.syncColorPanelToUILayout();
        } else {
            const expandBtn = document.getElementById('btn-col-expand');
            if (expandBtn) expandBtn.style.display = '';
            const sliders = document.getElementById('color-sliders-panel');
            if (sliders) sliders.style.display = '';
        }
    }

    function mountOptStrip() {
        const strip = document.getElementById('illu-mobile-opt-strip');
        const bar2 = document.getElementById('tool-options-bar-2');
        const container = document.getElementById('tool-options-container');
        const ribbonActive =
            typeof window.illuIsRibbonToolbarActive === 'function' && window.illuIsRibbonToolbarActive();

        if (ribbonActive) {
            if (bar2 && container && bar2.parentNode !== container) {
                rememberPanelHome(bar2);
                container.appendChild(bar2);
            }
            if (strip) {
                strip.hidden = true;
                strip.setAttribute('aria-hidden', 'true');
            }
            if (typeof window.illuEnsureRibbonStructure === 'function') {
                window.illuEnsureRibbonStructure();
            }
            return;
        }

        if (!strip || !bar2) return;
        if (bar2.parentNode !== strip) {
            rememberPanelHome(bar2);
            strip.appendChild(bar2);
        }
        strip.hidden = false;
        strip.setAttribute('aria-hidden', 'false');
    }

    function restoreOptStrip() {
        const strip = document.getElementById('illu-mobile-opt-strip');
        const bar2 = document.getElementById('tool-options-bar-2');
        const container = document.getElementById('tool-options-container');
        if (bar2 && container && bar2.parentNode === strip) {
            container.appendChild(bar2);
        }
        if (strip) {
            strip.hidden = true;
            strip.setAttribute('aria-hidden', 'true');
        }
    }

    function syncMobileDocTitle() {
        const p = window.EditorManager && window.EditorManager.activeProject;
        const untitled =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('app.untitled')
                : 'Sans titre';
        const name = (p && p.name) || untitled;
        document.querySelectorAll('#illu-mobile-doc-title, .illu-mobile-menubar-doc-title-text').forEach((el) => {
            el.textContent = name;
        });
        const resEl = document.getElementById('illu-mobile-doc-res');
        if (resEl) {
            resEl.textContent = (p && p.width && p.height) ? `${p.width}×${p.height}` : '';
        }
    }

    function bindMobileTopBarOnce() {
        if (topBarBound) return;
        topBarBound = true;
        const undoBtn = document.getElementById('illu-mobile-undo');
        const redoBtn = document.getElementById('illu-mobile-redo');
        if (undoBtn) {
            undoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.undo === 'function') window.undo();
            });
        }
        if (redoBtn) {
            redoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.redo === 'function') window.redo();
            });
        }
    }

    function showShellChrome(show) {
        const dock = document.getElementById('illu-mobile-bottom-dock');
        const topBar = document.getElementById('illu-mobile-top-bar');
        if (dock) {
            dock.hidden = !show;
            dock.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
        if (topBar) {
            topBar.hidden = !show;
            topBar.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
    }

    window.illuMobileRebuildDrawerTabs = function () {
        const host = document.getElementById('illu-mobile-drawer-tabs');
        const em = window.EditorManager;
        if (!host || !em || !em.projects) return;
        host.innerHTML = '';
        em.projects.forEach((p, i) => {
            if (p.role === 'layerAlphaMask') return;
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'illu-mobile-drawer__tab-row';
            row.setAttribute('role', 'tab');
            row.setAttribute('aria-selected', i === em.activeProjectIndex ? 'true' : 'false');
            if (i === em.activeProjectIndex) row.classList.add('illu-mobile-drawer__tab-row--active');

            if ((p.mode.startsWith('pixel')) && typeof em._uiThumbsVisible === 'function' && em._uiThumbsVisible()) {
                const thumb = document.createElement('img');
                thumb.className = 'illu-mobile-drawer__tab-thumb';
                thumb.alt = '';
                thumb.draggable = false;
                if (typeof em.getProjectTabThumbCssSize === 'function') {
                    const tabSz = em.getProjectTabThumbCssSize(p);
                    thumb.width = tabSz.width;
                    thumb.height = tabSz.height;
                }
                const u = em.getProjectTabThumbnailDataUrl(p);
                if (u) thumb.src = u;
                row.appendChild(thumb);
            }

            const label = document.createElement('span');
            label.className = 'illu-mobile-drawer__tab-label';
            label.textContent = p.name || 'Sans titre';
            row.appendChild(label);

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'illu-mobile-drawer__tab-close';
            closeBtn.setAttribute('aria-label', 'Fermer');
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof em.requestCloseProject === 'function') em.requestCloseProject(i);
            });
            row.appendChild(closeBtn);

            row.addEventListener('click', () => {
                if (typeof em.switchProject === 'function') em.switchProject(i);
                if (typeof window.illuCloseMobileDrawer === 'function') window.illuCloseMobileDrawer();
            });
            host.appendChild(row);
        });
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(host);
        }
    };

    function bindShellUiOnce() {
        if (shellInit) return;
        shellInit = true;

        document.getElementById('illu-mobile-sheet-backdrop')?.addEventListener('click', closeMobileSheet);
        document.querySelectorAll('[data-illu-mobile-sheet-close]').forEach((btn) => {
            btn.addEventListener('click', closeMobileSheet);
        });

        document.querySelectorAll('[data-illu-mobile-dock], [data-illu-mobile-dock-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-illu-mobile-dock-action');
                if (action === 'new') {
                    closeMobileSheet();
                    if (typeof window.showNewProjectDialog === 'function') window.showNewProjectDialog();
                    return;
                }
                if (action === 'open') {
                    closeMobileSheet();
                    if (typeof window.illuTriggerFileImport === 'function') window.illuTriggerFileImport();
                    return;
                }
                if (action === 'export') {
                    closeMobileSheet();
                    if (window.WorkspaceIO && typeof window.WorkspaceIO.showExportDialog === 'function') {
                        window.WorkspaceIO.showExportDialog();
                    }
                    return;
                }
                if (action === 'zoomfit') {
                    closeMobileSheet();
                    if (typeof fitActiveProjectZoomToWorkspace === 'function') {
                        fitActiveProjectZoomToWorkspace();
                    }
                    return;
                }
                if (action === 'crop') {
                    closeMobileSheet();
                    if (typeof window.startIlluInteractiveCrop === 'function') window.startIlluInteractiveCrop();
                    return;
                }
                if (action === 'filters') {
                    closeMobileSheet();
                    if (
                        window.FilterManager &&
                        typeof window.FilterManager.showInstantFilterGallery === 'function'
                    ) {
                        window.FilterManager.showInstantFilterGallery();
                    }
                    return;
                }
                const key = btn.getAttribute('data-illu-mobile-dock');
                if (key === 'menu') {
                    closeMobileSheet();
                    if (typeof window.illuOpenMobileDrawer === 'function') window.illuOpenMobileDrawer();
                    return;
                }
                openMobileSheet(key);
            });
        });

        document.querySelectorAll('#illu-mobile-doc-title-btn').forEach((docTitleBtn) => {
            if (docTitleBtn.dataset.illuDocTitleBound === '1') return;
            docTitleBtn.dataset.illuDocTitleBound = '1';
            docTitleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeMobileSheet();
                if (typeof window.illuOpenMobileDrawer === 'function') window.illuOpenMobileDrawer();
            });
        });

        document.getElementById('illu-mobile-drawer-history-open')?.addEventListener('click', () => {
            if (typeof window.illuCloseMobileDrawer === 'function') window.illuCloseMobileDrawer();
            openMobileSheet('history');
        });

        window.addEventListener('illu-tabs-updated', () => {
            if (!isShellMode()) return;
            syncMobileDocTitle();
            window.illuMobileRebuildDrawerTabs();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && openSheetId) closeMobileSheet();
        });

        window.addEventListener('illu-i18n-applied', (e) => {
            if (!isShellMode()) return;
            if (e && e.detail && e.detail.scoped) return;
            buildEffectsSheet();
            buildEffects2Sheet();
            buildAdjustSheet();
            if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
                const dock = document.getElementById('illu-mobile-bottom-dock');
                if (dock) window.IlluI18n.apply(dock);
            }
        });

        hookEffectDialogCloseSheet();
        syncIlluMobileSelectActionExtras();
    }

    window.initIlluMobileShell = function () {
        if (!window.isIlluMobileUiActive || !window.isIlluMobileUiActive()) {
            window.teardownIlluMobileShell();
            return;
        }
        bindShellUiOnce();
        closeMobileSheet();
        document.body.classList.add('illu-mobile-shell-active');
        stashPanelsInPool();
        closeMobileSheet();
        bindMobileTopBarOnce();
        mountChromeDomOrder();
        mountOptStrip();
        showShellChrome(true);
        syncMobileDocTitle();
        window.illuMobileRebuildDrawerTabs();
        applyMobileToolVisibility();
        syncIlluMobileSelectActionExtras();
        if (typeof window.syncColorPanelToUILayout === 'function') window.syncColorPanelToUILayout();
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(document.getElementById('illu-mobile-bottom-dock'));
        }
        if (typeof window.illuEnsurePinnedToggleBarOrder === 'function') {
            window.illuEnsurePinnedToggleBarOrder();
        }
        if (typeof window.illuInitToolbarRibbon === 'function') {
            window.illuInitToolbarRibbon();
        } else if (typeof window.updateToolOptionsBar === 'function') {
            window.updateToolOptionsBar();
        }
        if (typeof window.illuSyncMobileSelectionRibbonActions === 'function') {
            window.illuSyncMobileSelectionRibbonActions();
        }
    };

    window.teardownIlluMobileShell = function () {
        // No-op si le shell n'est pas actif : sans ce garde-fou, un second appel
        // (ex. applyIlluMobileUiClass après mountPalettesFloating) re-déplacerait
        // les palettes hors de #floating-palette-host vers les docks/pool, les
        // rendant invisibles en disposition flottante jusqu'au rechargement.
        if (!document.body.classList.contains('illu-mobile-shell-active')) return;
        closeMobileSheet();
        unbindMobileCanvasFitObservers();
        document.body.classList.remove('illu-mobile-shell-active');
        syncIlluMobileSelectActionExtras();
        showShellChrome(false);
        restoreOptStrip();
        restoreAllMobileToolVisibility();
        Object.values(SHEET_PANEL_MAP).forEach((cfg) => restorePanelToHome(cfg.id));
        const tools = document.getElementById('win-tools');
        const left = document.getElementById('palette-dock-left');
        if (tools && left && tools.parentNode === getPool()) {
            left.insertBefore(tools, left.firstChild);
        }
        const colors = document.getElementById('win-colors');
        const layers = document.getElementById('win-layers');
        const hist = document.getElementById('win-history');
        const right = document.getElementById('palette-dock-right');
        if (colors && right && colors.parentNode === getPool()) {
            if (layers && layers.parentNode === right) right.insertBefore(colors, layers);
            else right.insertBefore(colors, right.firstChild);
        }
        if (hist && right && hist.parentNode === getPool()) {
            right.appendChild(hist);
        }
    };

    window.illuMobileOpenSheet = openMobileSheet;
    window.illuMobileCloseSheet = closeMobileSheet;
    window.illuMobileSyncDocTitle = syncMobileDocTitle;
    window.illuMobileGetOpenSheetId = function () {
        return openSheetId;
    };
})();
