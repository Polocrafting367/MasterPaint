/**
 * Barre d’outils en groupes ruban (row1 actions + row2 paramètres côte à côte).
 */
(function () {
    'use strict';

    const SELECT_ACTION_TOOLS = new Set(['select', 'move', 'wand', 'direct-select', 'deform', 'warp-4']);
    const SELECTION_TOOLS = new Set(['select', 'wand', 'direct-select']);

    const ACTION_RIBBON_GROUPS = [
        { id: 'tool', labelKey: 'ribbon.groupTool', selectors: ['#tool-main-header'] },
        {
            id: 'selection',
            labelKey: 'ribbon.groupSelection',
            selectors: ['#tool-pinned-select-actions .illu-sel-actions-primary', '#selection-mode-group'],
            stack: true
        },
        {
            id: 'adjustments',
            labelKey: 'ribbon.groupAdjustments',
            selectors: ['#tool-pinned-select-actions .illu-sel-actions-layout']
        },
        {
            id: 'view',
            labelKey: 'ribbon.groupView',
            selectors: ['#tool-pinned-select-actions .illu-sel-actions-view']
        },
        { id: 'brush', labelKey: 'ribbon.groupBrush', selectors: ['#opt-grp-brush-actions'] },
        {
            id: 'shape-mode',
            labelKey: 'ribbon.groupShapeMode',
            selectors: ['#opt-grp-shapes-actions .illu-shape-mode-group']
        },
        {
            id: 'shape-fill',
            labelKey: 'ribbon.groupFill',
            selectors: ['#opt-grp-shapes-actions .illu-shape-fill-group']
        },
        {
            id: 'shape-grad',
            labelKey: 'ribbon.groupGradientType',
            selectors: ['#tool-shape-grad-type-actions']
        },
        {
            id: 'text-style-fill',
            labelKey: 'ribbon.groupTextStyleFill',
            selectors: ['#opt-grp-text-actions .illu-text-style-fill-group']
        },
        {
            id: 'gradient-type',
            labelKey: 'ribbon.groupGradientType',
            selectors: ['#opt-grp-gradient-actions .illu-grad-type-group']
        },
        {
            id: 'gradient-method',
            labelKey: 'ribbon.groupGradientMethod',
            selectors: ['#opt-grp-gradient-actions .illu-grad-method-group']
        },
        {
            id: 'vector-fill',
            labelKey: 'ribbon.groupFill',
            selectors: ['#opt-grp-vector-fill-buttons']
        },
        { id: 'vector', labelKey: 'ribbon.groupVector', selectors: ['#opt-grp-vector-ops'] }
    ];

    const PARAM_RIBBON_GROUPS = [
        { id: 'size', labelKey: 'ribbon.groupSize', selectors: ['#opt-grp-size-params'] },
        { id: 'hardness', labelKey: 'tools.brushHardnessShort', selectors: ['#opt-grp-brush-hardness'] },
        { id: 'wand', labelKey: 'ribbon.groupWand', selectors: ['#opt-grp-wand-params'] },
        { id: 'fill', labelKey: 'ribbon.groupFill', selectors: ['#opt-grp-fill-params'] },
        {
            id: 'shape-corner',
            labelKey: 'tools.shapeCornerRadius',
            selectors: ['#tool-shape-corner-row']
        },
        {
            id: 'shape-angle',
            labelKey: 'tools.shapeGradAngle',
            selectors: ['#tool-shape-grad-angle-row']
        },
        {
            id: 'text-font',
            labelKey: 'ribbon.groupFont',
            selectors: ['#tool-text-font-size-stack']
        },
        {
            id: 'text-stroke',
            labelKey: 'tools.textStrokeW',
            selectors: ['#tool-text-stroke-w-row']
        },
        { id: 'warp', labelKey: 'ribbon.groupWarp', selectors: ['#opt-grp-warp-params'] }
    ];

    function t(key, fallback) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const tr = window.IlluI18n.t(key);
            if (tr && tr !== key) return tr;
        }
        return fallback;
    }

    /** Ruban groupé actif (bureau ; pas téléphone / shell mobile). */
    window.illuIsRibbonToolbarActive = function () {
        if (typeof window.getUILayoutMode === 'function' && window.getUILayoutMode() === 'phone') {
            return false;
        }
        if (document.body.classList.contains('illu-mobile-shell-active')) {
            return false;
        }
        if (document.body.classList.contains('illu-mobile-ui')) {
            return false;
        }
        return true;
    };

    window.illuIsOfficeToolbarActive = window.illuIsRibbonToolbarActive;

    function appendToRibbonTarget(target, el, layout) {
        if (!el || el.parentElement === target) return;
        if (layout === 'grid2') {
            el.classList.add('illu-ribbon-icon-grid2');
        } else {
            el.classList.remove('illu-ribbon-icon-grid2');
        }
        target.appendChild(el);
    }

    function createRibbonGroup(parent, spec) {
        let group = parent.querySelector(`.illu-ribbon-group[data-illu-ribbon-group="${spec.id}"]`);
        if (!group) {
            group = document.createElement('div');
            group.className = 'illu-ribbon-group';
            group.dataset.illuRibbonGroup = spec.id;
            const body = document.createElement('div');
            body.className = 'illu-ribbon-group-body';
            const label = document.createElement('span');
            label.className = 'illu-ribbon-group-label';
            label.setAttribute('data-i18n', spec.labelKey);
            label.textContent = t(spec.labelKey, spec.id);
            group.appendChild(body);
            group.appendChild(label);
            parent.appendChild(group);
        }
        const body = group.querySelector('.illu-ribbon-group-body');
        let target = body;
        if (spec.stack) {
            let stack = body.querySelector('.illu-ribbon-selection-stack');
            if (!stack) {
                stack = document.createElement('div');
                stack.className = 'illu-ribbon-selection-stack';
                body.appendChild(stack);
            }
            target = stack;
        }
        spec.selectors.forEach((sel) => {
            const el = document.querySelector(sel);
            appendToRibbonTarget(target, el, spec.layout);
        });
        return group;
    }

    window.illuEnsureRibbonStructure = function () {
        const pin = document.getElementById('tool-pinned-toggles');
        if (pin) {
            let actionsWrap = pin.querySelector('.illu-ribbon-groups--actions');
            if (!actionsWrap) {
                actionsWrap = document.createElement('div');
                actionsWrap.className = 'illu-ribbon-groups illu-ribbon-groups--actions';
                pin.insertBefore(actionsWrap, pin.firstChild);
            }
            ACTION_RIBBON_GROUPS.forEach((spec) => createRibbonGroup(actionsWrap, spec));
            pin.querySelectorAll(':scope > .illu-ribbon-group').forEach((g) => {
                if (g.parentElement === pin) actionsWrap.appendChild(g);
            });
            const selWrap = document.getElementById('tool-pinned-select-actions');
            if (selWrap && !selWrap.querySelector('.illu-sel-actions-primary, .illu-sel-actions-layout')) {
                selWrap.hidden = true;
            }
        }

        const bar2 = document.getElementById('tool-options-bar-2');
        const container = document.getElementById('tool-options-container');
        if (bar2 && container && bar2.parentNode !== container) {
            container.appendChild(bar2);
        }
        if (bar2) {
            let paramsWrap = bar2.querySelector('.illu-ribbon-groups--params');
            if (!paramsWrap) {
                paramsWrap = document.createElement('div');
                paramsWrap.className = 'illu-ribbon-groups illu-ribbon-groups--params';
                bar2.insertBefore(paramsWrap, bar2.firstChild);
            }
            PARAM_RIBBON_GROUPS.forEach((spec) => createRibbonGroup(paramsWrap, spec));
            bar2.querySelectorAll(':scope > .illu-ribbon-group').forEach((g) => {
                if (g.parentElement === bar2) paramsWrap.appendChild(g);
            });
        }

        if (typeof window.illuUnifyModeToggleItems === 'function') {
            window.illuUnifyModeToggleItems();
        }
    };

    function setGroupHidden(group, hidden) {
        if (!group) return;
        group.hidden = !!hidden;
        group.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    }

    function shapesActionsActive(actionIds) {
        return actionIds.has('opt-grp-shapes-actions');
    }

    window.illuApplyRibbonGroupsForTool = function (toolId, cfg, ctx) {
        if (!window.illuIsRibbonToolbarActive()) return;
        const tool = toolId || 'select';
        const actionIds = new Set((cfg && cfg.actionGroups) || []);
        const paramIds = new Set((cfg && cfg.paramGroups) || []);
        const isVectorSelect = !!(ctx && ctx.isVectorSelect);
        const showHard = !!(ctx && ctx.showHard);
        const warpActive = !!(ctx && ctx.warpActive);
        const gradTypeEl = document.getElementById('tool-shape-grad-type-actions');

        document.querySelectorAll('.illu-ribbon-groups--actions .illu-ribbon-group').forEach((group) => {
            const id = group.dataset.illuRibbonGroup;
            let active = false;
            if (id === 'tool') active = true;
            else if (id === 'selection') {
                active = SELECTION_TOOLS.has(tool) || SELECT_ACTION_TOOLS.has(tool);
            } else if (id === 'adjustments') {
                active = SELECT_ACTION_TOOLS.has(tool);
            } else if (id === 'view') {
                active = SELECT_ACTION_TOOLS.has(tool);
            } else if (id === 'brush') active = actionIds.has('opt-grp-brush-actions');
            else if (id === 'shape-mode' || id === 'shape-fill') {
                active = shapesActionsActive(actionIds);
            } else if (id === 'shape-grad') {
                active = shapesActionsActive(actionIds) && gradTypeEl && !gradTypeEl.hidden;
            } else if (id === 'text-style-fill') {
                active = actionIds.has('opt-grp-text-actions');
            } else if (id === 'gradient-type' || id === 'gradient-method') {
                active = actionIds.has('opt-grp-gradient-actions');
            } else if (id === 'vector-fill' || id === 'vector') {
                active = isVectorSelect;
            }
            setGroupHidden(group, !active);
        });

        document.querySelectorAll('.illu-ribbon-groups--params .illu-ribbon-group').forEach((group) => {
            const id = group.dataset.illuRibbonGroup;
            let active = false;
            const cornerRow = document.getElementById('tool-shape-corner-row');
            const angleRow = document.getElementById('tool-shape-grad-angle-row');
            if (id === 'size') active = paramIds.has('opt-grp-size-params');
            else if (id === 'hardness') {
                active = paramIds.has('opt-grp-brush-hardness') && showHard;
            } else if (id === 'wand') active = paramIds.has('opt-grp-wand-params');
            else if (id === 'fill') active = paramIds.has('opt-grp-fill-params');
            else if (id === 'shape-corner') {
                active = paramIds.has('opt-grp-shapes-params') && cornerRow && !cornerRow.hidden;
            } else if (id === 'shape-angle') {
                active = paramIds.has('opt-grp-shapes-params') && angleRow && !angleRow.hidden;
            } else if (id === 'text-font' || id === 'text-stroke') {
                active = paramIds.has('opt-grp-text-params');
            } else if (id === 'warp') active = paramIds.has('opt-grp-warp-params') || warpActive;
            setGroupHidden(group, !active);
        });
    };

    window.illuIsRibbonCompact = function () {
        if (!window.illuIsRibbonToolbarActive()) return false;
        return window.matchMedia('(max-width: 900px)').matches;
    };

    function syncRibbonCompactClass() {
        document.body.classList.toggle('illu-ribbon-compact', !!window.illuIsRibbonCompact());
    }

    function ensureRibbonCompactListener() {
        if (window._illuRibbonCompactMqBound) return;
        const mq = window.matchMedia('(max-width: 900px)');
        const onChange = () => {
            syncRibbonCompactClass();
            if (typeof window.illuApplyToggleLayouts === 'function') {
                window.illuApplyToggleLayouts();
            }
        };
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', onChange);
        } else if (typeof mq.addListener === 'function') {
            mq.addListener(onChange);
        }
        window._illuRibbonCompactMqBound = true;
    }

    window.illuInitToolbarRibbon = function () {
        const active = window.illuIsRibbonToolbarActive();
        document.body.classList.toggle('illu-toolbar-ribbon', active);
        syncRibbonCompactClass();
        ensureRibbonCompactListener();

        if (active) {
            window.illuEnsureRibbonStructure();
        }

        if (typeof window.illuUnifyModeToggleItems === 'function') {
            window.illuUnifyModeToggleItems();
        }
        if (typeof window.illuApplyToggleLayouts === 'function') {
            window.illuApplyToggleLayouts();
        }
        if (typeof window.illuInitToolPicker === 'function') {
            window.illuInitToolPicker();
        }

        if (typeof window.updateToolOptionsBar === 'function') {
            window.updateToolOptionsBar();
        }

        if (active && window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            const container = document.getElementById('tool-options-container');
            if (container) window.IlluI18n.apply(container);
        }
    };

    window.illuApplyToolbarStyle = window.illuInitToolbarRibbon;

    /** Déplace le libellé dans le bouton pour que toute la cellule soit cliquable. */
    window.illuUnifyModeToggleItems = function () {
        document.querySelectorAll('.illu-mode-toggle-item').forEach((item) => {
            const btn = item.querySelector(
                ':scope > button.illu-icon-toggle, :scope > button[data-illu-brush-sync], :scope > button[data-selection-mode]'
            );
            if (!btn) return;
            const lbl =
                item.querySelector(':scope > .illu-mode-toggle-lbl') ||
                btn.querySelector('.illu-mode-toggle-lbl');
            if (lbl && lbl.parentElement !== btn) {
                btn.appendChild(lbl);
            }
            btn.classList.add('illu-mode-toggle-btn');
            item.classList.add('illu-mode-toggle-item--unified');
        });
        if (typeof window.illuApplyToggleLayouts === 'function') {
            window.illuApplyToggleLayouts();
        }
    };

    /** ≤900px : colonnes de grille selon le nombre de boutons visibles. */
    function applyCompactGridCols(tg, visible) {
        tg.classList.remove(
            'illu-toggle-group--compact-cols-1',
            'illu-toggle-group--compact-cols-2',
            'illu-toggle-group--compact-cols-3'
        );
        const isGrad =
            tg.classList.contains('illu-grad-type-group') ||
            tg.classList.contains('illu-grad-method-group');
        const isShapeFill = tg.classList.contains('illu-shape-fill-group');
        const isView = tg.classList.contains('illu-sel-actions-view');

        let cols = 2;
        if (visible <= 1) {
            cols = 1;
        } else if (visible === 2) {
            /* Affichage : 2×1 ; Dégradé : 2×2 ; Remplissage formes : géré à part (1 ligne) */
            if (isView) cols = 1;
            else if (isGrad) cols = 2;
            else if (isShapeFill) cols = 2;
            else cols = 1;
        } else if (visible === 3 || visible === 4) {
            /* Ajustements (3), Contour (3), Pinceau (4)… : 2 colonnes × 2 lignes */
            cols = 2;
        } else {
            cols = 3;
        }
        tg.classList.add('illu-toggle-group--compact-cols-' + cols);
    }

    /** Stack (icône au-dessus) ou inline (icône à gauche) ; groupes 2×ligne ou 1×ligne. */
    window.illuApplyToggleLayouts = function () {
        const compact =
            typeof window.illuIsRibbonCompact === 'function' && window.illuIsRibbonCompact();

        document.querySelectorAll('.illu-icon-toggle-group, .illu-mode-toggle-group').forEach((tg) => {
            tg.classList.remove(
                'illu-toggle-group--two-rows',
                'illu-toggle-group--one-row',
                'illu-toggle-group--stack-cells',
                'illu-toggle-group--compact-grid',
                'illu-toggle-group--compact-inline-row',
                'illu-toggle-group--compact-cols-1',
                'illu-toggle-group--compact-cols-2',
                'illu-toggle-group--compact-cols-3'
            );
            const visible = tg.querySelectorAll('.illu-mode-toggle-item--unified:not([hidden])').length;

            if (compact) {
                if (tg.closest('.illu-tool-picker, #tool-main-header')) {
                    return;
                }
                if (visible >= 1) {
                    /* Baguette / Remplissage formes : 2 boutons côte à côte (jauge ou alvéole voisine en dessous) */
                    if (
                        (tg.closest('#opt-grp-wand-params') || tg.classList.contains('illu-shape-fill-group')) &&
                        visible === 2
                    ) {
                        tg.classList.add('illu-toggle-group--compact-inline-row');
                    } else {
                        tg.classList.add('illu-toggle-group--compact-grid');
                        applyCompactGridCols(tg, visible);
                    }
                }
                return;
            }

            const inParamPack = !!tg.closest('.illu-ribbon-param-pack');
            const inSelectionStack = !!tg.closest('.illu-ribbon-selection-stack');
            const inBrushActions = !!tg.closest('#opt-grp-brush-actions');
            const inGradGroup =
                tg.classList.contains('illu-grad-type-group') ||
                tg.classList.contains('illu-grad-method-group');
            const inGradientActions =
                !!tg.closest('#opt-grp-gradient-actions') || inGradGroup;
            const inParams =
                !!tg.closest('#tool-options-bar-2, .illu-ribbon-groups--params') &&
                !inSelectionStack;
            const isViewActions = tg.classList.contains('illu-sel-actions-view');

            const isShapeFillGroup = tg.classList.contains('illu-shape-fill-group');
            if (inSelectionStack) {
                return;
            }
            if (isViewActions) {
                tg.classList.add('illu-toggle-group--one-row', 'illu-toggle-group--stack-cells');
            } else if ((inBrushActions || inGradientActions) && visible >= 2 && visible <= 4) {
                tg.classList.add('illu-toggle-group--one-row');
            } else if (isShapeFillGroup && visible === 2) {
                tg.classList.add('illu-toggle-group--one-row', 'illu-toggle-group--stack-cells');
            } else if (inParamPack && visible >= 2 && visible <= 4) {
                tg.classList.add('illu-toggle-group--one-row');
            } else if (visible === 3 && !inParams) {
                tg.classList.add('illu-toggle-group--one-row', 'illu-toggle-group--stack-cells');
            } else if (visible === 2 && !inParamPack && !inParams && !isShapeFillGroup) {
                tg.classList.add('illu-toggle-group--two-rows', 'illu-toggle-group--stack-cells');
            } else if (visible === 2 && inParams && !inParamPack) {
                tg.classList.add('illu-toggle-group--two-rows');
            } else if (visible >= 2 && visible <= 4 && !inParams) {
                tg.classList.add('illu-toggle-group--one-row');
            }
        });

        document.querySelectorAll('.illu-mode-toggle-item--unified').forEach((item) => {
            item.classList.remove('illu-toggle-layout--stack', 'illu-toggle-layout--inline');

            if (compact) {
                if (!item.closest('.illu-tool-picker, #tool-main-header')) {
                    if (item.closest('.illu-shape-fill-group')) {
                        item.classList.add('illu-toggle-layout--stack');
                    } else {
                        item.classList.add('illu-toggle-layout--inline');
                    }
                }
                return;
            }

            const inSelectionStack = !!item.closest('.illu-ribbon-selection-stack');
            const inBrushActions = !!item.closest('#opt-grp-brush-actions');
            const inGradGroup = !!item.closest('.illu-grad-type-group, .illu-grad-method-group');
            const inGradientActions =
                !!item.closest('#opt-grp-gradient-actions') || inGradGroup;
            const groupId = item.closest('.illu-ribbon-group')?.dataset?.illuRibbonGroup;
            const inStackCells = !!item.closest('.illu-toggle-group--stack-cells');

            if (inSelectionStack || inGradientActions || inBrushActions) {
                item.classList.add('illu-toggle-layout--inline');
            } else if (
                groupId === 'tool' ||
                groupId === 'adjustments' ||
                groupId === 'view' ||
                inStackCells ||
                !!item.closest('.illu-shape-fill-group')
            ) {
                item.classList.add('illu-toggle-layout--stack');
            } else {
                item.classList.add('illu-toggle-layout--inline');
            }
        });

        document.querySelectorAll('.tool-options-bar .illu-gauge-field').forEach((field) => {
            field.classList.add('illu-gauge-field--inline');
        });
    };

    window.illuSyncToolPickerLabel = function (toolId, cfg) {
        const lbl = document.getElementById('illu-tool-picker-label');
        if (!lbl) return;
        const t = toolId || window.activeTool || 'select';
        const c = cfg || {};
        let toolLabel = c.label || t;
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const key = 'tool.' + t;
            const tr = window.IlluI18n.t(key);
            if (tr !== key) toolLabel = tr;
        }
        lbl.textContent = toolLabel;
        lbl.title = toolLabel;
        const sel = document.getElementById('illu-tool-list-select');
        if (sel) sel.setAttribute('aria-label', toolLabel);
    };

    /** Clic n’importe où sur le picker → ouverture de la liste (fallback navigateurs). */
    window.illuInitToolPicker = function () {
        const picker = document.querySelector('.illu-tool-picker');
        const sel = document.getElementById('illu-tool-list-select');
        if (!picker || !sel || picker.dataset.illuPickerBound === '1') return;
        picker.dataset.illuPickerBound = '1';
        if (!picker.hasAttribute('tabindex')) {
            picker.setAttribute('tabindex', '0');
        }

        picker.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target === sel) return;
            e.preventDefault();
            if (typeof sel.showPicker === 'function') {
                try {
                    sel.showPicker();
                    return;
                } catch (err) {
                    /* showPicker peut échouer si pas déclenché par un vrai geste utilisateur */
                }
            }
            sel.focus({ preventScroll: true });
            sel.click();
        });

        picker.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (typeof sel.showPicker === 'function') {
                    try {
                        sel.showPicker();
                        return;
                    } catch (err) {
                        /* ignore */
                    }
                }
                sel.focus({ preventScroll: true });
                sel.click();
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.illuInitToolbarRibbon();
        });
    } else {
        queueMicrotask(() => window.illuInitToolbarRibbon());
    }
})();
