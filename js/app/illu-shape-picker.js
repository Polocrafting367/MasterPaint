/**
 * Catalogue formes → active un vrai outil (voir illu-shape-tools.js).
 * Icônes : Font Awesome quand disponible ; sinon contour SVG minimal ; famille = sprite dédié.
 */
(function () {
    'use strict';

    window.illuShapesFamilyMode = false;
    window.illuLastShapeTool = window.illuLastShapeTool || 'rect';
    window.illuLastShapeFamilyTool = window.illuLastShapeFamilyTool || 'rect';
    window.illuActiveShapeVariant = window.illuActiveShapeVariant || 'rect';

    const PICKER_ENTRIES = {
        rect: { tool: 'rect', fa: 'fa-regular fa-square', labelKey: 'shape.rect', fallback: 'Rectangle' },
        'round-3': {
            tool: 'round-3',
            sprite: 'illu-icon-shape-round',
            labelKey: 'shape.round',
            fallback: 'Rectangle arrondi'
        },
        circle: { tool: 'circle', fa: 'fa-regular fa-circle', labelKey: 'shape.circle', fallback: 'Ellipse' },
        triangle: {
            tool: 'triangle',
            sprite: 'illu-icon-shape-triangle',
            labelKey: 'shape.triangle',
            fallback: 'Triangle'
        },
        diamond: {
            tool: 'diamond',
            sprite: 'illu-icon-shape-diamond',
            labelKey: 'shape.diamond',
            fallback: 'Losange'
        },
        trapezoid: {
            tool: 'trapezoid',
            sprite: 'illu-icon-shape-trapezoid',
            labelKey: 'shape.trapezoid',
            fallback: 'Trapèze'
        },
        parallelogram: {
            tool: 'parallelogram',
            sprite: 'illu-icon-shape-parallelogram',
            labelKey: 'shape.parallelogram',
            fallback: 'Parallélogramme'
        },
        'triangle-right': {
            tool: 'triangle-right',
            sprite: 'illu-icon-shape-triangle-right',
            labelKey: 'shape.triangleRight',
            fallback: 'Triangle rectangle'
        },
        pentagon: {
            tool: 'reg-poly',
            sides: 5,
            sprite: 'illu-icon-shape-pentagon',
            labelKey: 'shape.pentagon',
            fallback: 'Pentagone'
        },
        hexagon: {
            tool: 'reg-poly',
            sides: 6,
            sprite: 'illu-icon-shape-hexagon',
            labelKey: 'shape.hexagon',
            fallback: 'Hexagone'
        },
        heptagon: {
            tool: 'reg-poly',
            sides: 7,
            sprite: 'illu-icon-shape-heptagon',
            labelKey: 'shape.heptagon',
            fallback: 'Heptagone'
        },
        octagon: {
            tool: 'reg-poly',
            sides: 8,
            sprite: 'illu-icon-shape-octagon',
            labelKey: 'shape.octagon',
            fallback: 'Octogone'
        },
        'star-4': {
            tool: 'star',
            branches: 4,
            fa: 'fa-regular fa-star',
            labelKey: 'shape.star4',
            fallback: 'Étoile 4 branches'
        },
        'star-5': {
            tool: 'star',
            branches: 5,
            fa: 'fa-regular fa-star',
            labelKey: 'shape.star5',
            fallback: 'Étoile 5 branches'
        },
        'star-6': {
            tool: 'star',
            branches: 6,
            fa: 'fa-regular fa-star',
            labelKey: 'shape.star6',
            fallback: 'Étoile 6 branches'
        },
        'star-thin': {
            tool: 'star',
            branches: 4,
            fa: 'fa-regular fa-star',
            labelKey: 'shape.starThin',
            fallback: 'Étoile fine'
        },
        'callout-rect': {
            tool: 'callout',
            calloutStyle: 'rect',
            fa: 'fa-regular fa-comment',
            labelKey: 'shape.calloutRect',
            fallback: 'Bulle rectangulaire'
        },
        'callout-round': {
            tool: 'callout',
            calloutStyle: 'round',
            fa: 'fa-regular fa-comment-dots',
            labelKey: 'shape.calloutRound',
            fallback: 'Bulle arrondie'
        },
        'callout-oval': {
            tool: 'callout',
            calloutStyle: 'oval',
            fa: 'fa-regular fa-comment',
            labelKey: 'shape.calloutOval',
            fallback: 'Bulle ovale'
        },
        'callout-cloud': {
            tool: 'callout',
            calloutStyle: 'cloud',
            fa: 'fa-regular fa-cloud',
            labelKey: 'shape.calloutCloud',
            fallback: 'Bulle nuage'
        },
        line: { tool: 'line', toolIcon: true, labelKey: 'tool.line', fallback: 'Ligne' },
        'cubic-3': { tool: 'cubic-3', toolIcon: true, labelKey: 'tool.cubic-3', fallback: 'Courbe' },
        pen: { tool: 'pen', toolIcon: true, labelKey: 'tool.pen', fallback: 'Plume' },
        polygon: { tool: 'polygon', toolIcon: true, labelKey: 'tool.polygon', fallback: 'Polygone (clics)' }
    };

    const CATEGORIES = [
        {
            id: 'base',
            labelKey: 'shapePicker.categoryBase',
            fallback: 'Base',
            variants: [
                'rect',
                'round-3',
                'circle',
                'triangle',
                'diamond',
                'trapezoid',
                'parallelogram',
                'triangle-right'
            ]
        },
        {
            id: 'polygons',
            labelKey: 'shapePicker.categoryPolygons',
            fallback: 'Polygones et étoiles',
            variants: ['pentagon', 'hexagon', 'heptagon', 'octagon', 'star-4', 'star-5', 'star-6', 'star-thin']
        },
        {
            id: 'lines',
            labelKey: 'shapePicker.categoryLines',
            fallback: 'Lignes et courbes',
            variants: ['line', 'cubic-3', 'pen', 'polygon']
        },
        {
            id: 'callouts',
            labelKey: 'shapePicker.categoryCallouts',
            fallback: 'Légendes',
            variants: ['callout-rect', 'callout-round', 'callout-oval', 'callout-cloud']
        }
    ];

    function t(key, fallback) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const tr = window.IlluI18n.t(key);
            if (tr && tr !== key) return tr;
        }
        return fallback;
    }

    function entryFor(id) {
        return PICKER_ENTRIES[id] || null;
    }

    function variantLabel(variantId) {
        const e = entryFor(variantId);
        if (!e) return variantId;
        return t(e.labelKey, e.fallback);
    }

    function iconFromToolButton(toolId) {
        const btn = document.getElementById('tool-' + toolId);
        if (!btn) return '';
        const icon = btn.querySelector('i, svg.tool-icon, svg.tool-icon-roundrect, svg');
        return icon ? icon.cloneNode(true).outerHTML : '';
    }

    function variantIconHtml(variantId) {
        const e = entryFor(variantId);
        if (!e) return '';
        if (e.fa) {
            return `<i class="${e.fa} illu-shape-picker-fa" aria-hidden="true"></i>`;
        }
        if (e.toolIcon && e.tool) {
            const html = iconFromToolButton(e.tool);
            if (html) return html;
        }
        if (e.sprite) {
            return (
                '<svg class="illu-shape-ico illu-shape-ico--outline" width="22" height="22" viewBox="0 0 16 16" aria-hidden="true">' +
                '<use href="#' +
                e.sprite +
                '"/></svg>'
            );
        }
        return '';
    }

    window.illuIsShapeDrawingTool = function (toolId) {
        return (
            window.ILLU_SHAPE_DRAWING_TOOLS &&
            window.ILLU_SHAPE_DRAWING_TOOLS.has(toolId || window.activeTool)
        );
    };

    window.illuIsShapeFamilyTool = function (toolId) {
        return (
            window.ILLU_SHAPE_FAMILY_TOOLS &&
            window.ILLU_SHAPE_FAMILY_TOOLS.has(toolId || window.activeTool)
        );
    };

    window.illuShouldShowShapePickerRibbon = function () {
        return (
            !!window.illuShapesFamilyMode &&
            window.illuIsShapeFamilyTool(window.activeTool)
        );
    };

    window.illuActivateShapeTool = function (variantOrToolId, opts) {
        opts = opts || {};
        const entry = entryFor(variantOrToolId);
        const toolId =
            entry?.tool ||
            (window.ILLU_SHAPE_FAMILY_TOOLS && window.ILLU_SHAPE_FAMILY_TOOLS.has(variantOrToolId)
                ? variantOrToolId
                : null);
        if (!toolId) return false;

        if (typeof window.illuPrepareShapeToolActivation === 'function') {
            window.illuPrepareShapeToolActivation(toolId, {
                sides: entry?.sides,
                branches: entry?.branches,
                calloutStyle: entry?.calloutStyle
            });
        }

        window.illuActiveShapeVariant = entry ? variantOrToolId : toolId;
        window.illuLastShapeTool = toolId;
        if (window.ILLU_SHAPE_FAMILY_TOOLS.has(toolId)) {
            window.illuLastShapeFamilyTool = toolId;
        }
        if (window.ILLU_SHAPE_FAMILY_TOOLS.has(toolId)) {
            if (opts.familyMode !== false) window.illuShapesFamilyMode = true;
        } else {
            window.illuShapesFamilyMode = false;
        }

        window._illuActivatingFromShapePicker = true;
        const ok =
            typeof window.activateIlluToolButtonById === 'function' &&
            window.activateIlluToolButtonById('tool-' + toolId);
        window._illuActivatingFromShapePicker = false;

        if (ok && !opts.keepPopupOpen && typeof window.illuCloseShapePickerPopup === 'function') {
            window.illuCloseShapePickerPopup();
        }
        if (typeof window.illuSyncShapeFamilyToolboxBtn === 'function') {
            window.illuSyncShapeFamilyToolboxBtn();
        }
        if (typeof window.illuSyncShapePickerUI === 'function') {
            window.illuSyncShapePickerUI(window.illuActiveShapeVariant);
        }
        if (typeof window.updateToolOptionsBar === 'function') {
            window.updateToolOptionsBar();
        }
        return ok;
    };

    function buildShapeListSelect() {
        const sel = document.getElementById('illu-shape-list-select');
        if (!sel || sel.dataset.built === '1') return;
        sel.dataset.built = '1';
        sel.innerHTML = '';
        CATEGORIES.forEach((cat) => {
            const og = document.createElement('optgroup');
            og.label = t(cat.labelKey, cat.fallback);
            cat.variants.forEach((variantId) => {
                const opt = document.createElement('option');
                opt.value = variantId;
                opt.textContent = variantLabel(variantId);
                og.appendChild(opt);
            });
            sel.appendChild(og);
        });
    }

    function illuOpenShapeListSelect(sel) {
        if (!sel) return;
        if (typeof sel.showPicker === 'function') {
            try {
                sel.showPicker();
                return;
            } catch (err) {
                /* showPicker peut échouer hors geste utilisateur */
            }
        }
        sel.focus({ preventScroll: true });
        sel.click();
    }

    window.illuSyncShapePickerUI = function (variantId) {
        variantId = variantId || window.illuActiveShapeVariant || window.activeTool;
        if (!window.illuShouldShowShapePickerRibbon()) return;
        buildShapeListSelect();
        const iconEl = document.getElementById('illu-shape-picker-icon');
        const lblEl = document.getElementById('illu-shape-picker-label');
        const label = variantLabel(variantId);
        if (iconEl) iconEl.innerHTML = variantIconHtml(variantId);
        if (lblEl) {
            lblEl.textContent = label;
            lblEl.title = label;
        }
        const header = document.getElementById('illu-shape-picker-header');
        if (header) {
            header.setAttribute('aria-label', label);
            header.title = label;
        }
        const sel = document.getElementById('illu-shape-list-select');
        if (sel && PICKER_ENTRIES[variantId]) {
            sel.value = variantId;
            sel.setAttribute('aria-label', label);
        }
        document.querySelectorAll('#illu-shape-picker-popup .illu-shape-picker-item').forEach((item) => {
            const id = item.getAttribute('data-shape-variant');
            item.classList.toggle('active', id === variantId);
            item.setAttribute('aria-pressed', id === variantId ? 'true' : 'false');
        });
    };

    window.illuSyncShapeFamilyToolboxBtn = function () {
        const family = document.getElementById('tool-shapes-family');
        if (!family) return;
        const t = window.activeTool || '';
        family.classList.toggle('active', window.illuShapesFamilyMode && window.ILLU_SHAPE_FAMILY_TOOLS.has(t));
    };

    window.illuCloseShapePickerPopup = function () {
        const pop = document.getElementById('illu-shape-picker-popup');
        if (pop) pop.hidden = true;
        const header = document.getElementById('illu-shape-picker-header');
        if (header) header.setAttribute('aria-expanded', 'false');
    };

    window.illuOpenShapePickerPopup = function () {
        const pop = document.getElementById('illu-shape-picker-popup');
        if (!pop) return;
        pop.hidden = false;
        const header = document.getElementById('illu-shape-picker-header');
        if (header) header.setAttribute('aria-expanded', 'true');
        if (typeof window.illuSyncShapePickerUI === 'function') window.illuSyncShapePickerUI();
    };

    function buildShapePickerPopup() {
        const pop = document.getElementById('illu-shape-picker-popup');
        if (!pop || pop.dataset.built === '1') return;
        pop.dataset.built = '1';
        pop.innerHTML = '';
        CATEGORIES.forEach((cat) => {
            const section = document.createElement('div');
            section.className = 'illu-shape-picker-section';
            const title = document.createElement('div');
            title.className = 'illu-shape-picker-section-title';
            title.textContent = t(cat.labelKey, cat.fallback);
            section.appendChild(title);
            const grid = document.createElement('div');
            grid.className = 'illu-shape-picker-grid';
            cat.variants.forEach((variantId) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'illu-shape-picker-item';
                btn.dataset.shapeVariant = variantId;
                btn.setAttribute('aria-pressed', 'false');
                btn.title = variantLabel(variantId);
                btn.innerHTML = variantIconHtml(variantId);
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isLineTool = ['line', 'cubic-3', 'pen', 'polygon'].includes(
                        PICKER_ENTRIES[variantId]?.tool
                    );
                    window.illuActivateShapeTool(variantId, { familyMode: !isLineTool });
                });
                grid.appendChild(btn);
            });
            section.appendChild(grid);
            pop.appendChild(section);
        });
    }

    window.illuInitShapePicker = function () {
        buildShapePickerPopup();
        buildShapeListSelect();
        const wrap = document.getElementById('illu-shape-picker-wrap');
        const header = document.getElementById('illu-shape-picker-header');
        const sel = document.getElementById('illu-shape-list-select');
        if (!wrap || !header || wrap.dataset.bound === '1') return;
        wrap.dataset.bound = '1';
        header.addEventListener('click', (e) => {
            e.preventDefault();
            const pop = document.getElementById('illu-shape-picker-popup');
            if (pop && !pop.hidden) {
                window.illuCloseShapePickerPopup();
            } else {
                window.illuOpenShapePickerPopup();
            }
        });
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                const pop = document.getElementById('illu-shape-picker-popup');
                if (pop && !pop.hidden) {
                    window.illuCloseShapePickerPopup();
                } else {
                    window.illuOpenShapePickerPopup();
                }
            }
        });
        if (sel && sel.dataset.changeBound !== '1') {
            sel.dataset.changeBound = '1';
            sel.addEventListener('change', () => {
                const variantId = sel.value;
                if (!variantId || !PICKER_ENTRIES[variantId]) return;
                const isLineTool = ['line', 'cubic-3', 'pen', 'polygon'].includes(
                    PICKER_ENTRIES[variantId].tool
                );
                window.illuActivateShapeTool(variantId, { familyMode: !isLineTool });
            });
        }
        document.addEventListener('mousedown', (e) => {
            const pop = document.getElementById('illu-shape-picker-popup');
            if (!pop || pop.hidden) return;
            if (e.target.closest('#illu-shape-picker-wrap')) return;
            window.illuCloseShapePickerPopup();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') window.illuCloseShapePickerPopup();
        });
        const family = document.getElementById('tool-shapes-family');
        if (family && family.dataset.ctxBound !== '1') {
            family.dataset.ctxBound = '1';
            family.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                window.illuShapesFamilyMode = true;
                if (typeof window.illuOpenShapePickerPopup === 'function') window.illuOpenShapePickerPopup();
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.illuInitShapePicker());
    } else {
        queueMicrotask(() => window.illuInitShapePicker());
    }
})();
