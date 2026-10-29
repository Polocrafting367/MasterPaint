/**
 * Sélecteur d'outils de sélection — même mécanique que le catalogue de formes
 * (illu-shape-picker.js) : un en-tête déroulant dans #tool-options-container.
 *
 * La boîte à outils ne garde que la baguette et le lasso magnétique ; la
 * sélection rapide, la sélection d'objet et le lasso polygonal vivent dans
 * l'étagère masquée et s'activent depuis ce menu (clic sur leur bouton, donc
 * exactement le même flux qu'un clic dans la boîte à outils).
 */
(function () {
    'use strict';

    const ENTRIES = {
        wand: { sprite: 'illu-icon-tool-wand', labelKey: 'tool.wand', fallback: 'Baguette' },
        'quick-select': {
            sprite: 'illu-icon-tool-quick-select',
            labelKey: 'tool.quick-select',
            fallback: 'Sélection rapide'
        },
        'object-select': {
            sprite: 'illu-icon-tool-object-select',
            labelKey: 'tool.object-select',
            fallback: "Sélection d'objet"
        },
        'magnetic-lasso': {
            sprite: 'illu-icon-tool-magnetic-lasso',
            labelKey: 'tool.magnetic-lasso',
            fallback: 'Lasso magnétique'
        },
        'poly-lasso': {
            sprite: 'illu-icon-tool-poly-lasso',
            labelKey: 'tool.poly-lasso',
            fallback: 'Lasso polygonal'
        }
    };

    const CATEGORIES = [
        {
            labelKey: 'selectPicker.catAuto',
            fallback: 'Sélection assistée',
            tools: ['wand', 'quick-select', 'object-select']
        },
        {
            labelKey: 'selectPicker.catLasso',
            fallback: 'Lassos',
            tools: ['magnetic-lasso', 'poly-lasso']
        }
    ];

    /** Outils couverts par le sélecteur (l'alvéole n'apparaît que pour eux). */
    window.ILLU_SELECT_PICKER_TOOLS = new Set(Object.keys(ENTRIES));

    function t(key, fallback) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const tr = window.IlluI18n.t(key);
            if (tr && tr !== key) return tr;
        }
        return fallback;
    }

    function toolLabel(toolId) {
        const e = ENTRIES[toolId];
        return e ? t(e.labelKey, e.fallback) : toolId;
    }

    function toolIconHtml(toolId) {
        const e = ENTRIES[toolId];
        if (!e) return '';
        return (
            '<svg class="illu-shape-ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" ' +
            'focusable="false"><use href="#' + e.sprite + '" /></svg>'
        );
    }

    window.illuShouldShowSelectPickerRibbon = function () {
        return window.ILLU_SELECT_PICKER_TOOLS.has(window.activeTool);
    };

    window.illuActivateSelectTool = function (toolId) {
        if (!ENTRIES[toolId]) return false;
        const ok =
            typeof window.activateIlluToolButtonById === 'function' &&
            window.activateIlluToolButtonById('tool-' + toolId);
        window.illuCloseSelectPickerPopup();
        if (ok) window.illuSyncSelectPickerUI(toolId);
        return ok;
    };

    window.illuSyncSelectPickerUI = function (toolId) {
        toolId = toolId || window.activeTool;
        const iconEl = document.getElementById('illu-select-picker-icon');
        const lblEl = document.getElementById('illu-select-picker-label');
        const header = document.getElementById('illu-select-picker-header');
        if (ENTRIES[toolId]) {
            const label = toolLabel(toolId);
            if (iconEl) iconEl.innerHTML = toolIconHtml(toolId);
            if (lblEl) {
                lblEl.textContent = label;
                lblEl.title = label;
            }
            if (header) {
                header.setAttribute('aria-label', label);
                header.title = label;
            }
        }
        document.querySelectorAll('#illu-select-picker-popup .illu-shape-picker-item').forEach((item) => {
            const id = item.getAttribute('data-select-tool');
            item.classList.toggle('active', id === toolId);
            item.setAttribute('aria-pressed', id === toolId ? 'true' : 'false');
        });
    };

    window.illuCloseSelectPickerPopup = function () {
        const pop = document.getElementById('illu-select-picker-popup');
        if (pop) pop.hidden = true;
        const header = document.getElementById('illu-select-picker-header');
        if (header) header.setAttribute('aria-expanded', 'false');
    };

    window.illuOpenSelectPickerPopup = function () {
        const pop = document.getElementById('illu-select-picker-popup');
        if (!pop) return;
        pop.hidden = false;
        const header = document.getElementById('illu-select-picker-header');
        if (header) header.setAttribute('aria-expanded', 'true');
        window.illuSyncSelectPickerUI();
    };

    function buildPopup() {
        const pop = document.getElementById('illu-select-picker-popup');
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
            cat.tools.forEach((toolId) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'illu-shape-picker-item';
                btn.dataset.selectTool = toolId;
                btn.setAttribute('aria-pressed', 'false');
                btn.title = toolLabel(toolId);
                btn.innerHTML = toolIconHtml(toolId);
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.illuActivateSelectTool(toolId);
                });
                grid.appendChild(btn);
            });
            section.appendChild(grid);
            pop.appendChild(section);
        });
    }

    /** Les libellés du popup sont posés en JS : on les régénère au changement de langue. */
    function refreshLabels() {
        const pop = document.getElementById('illu-select-picker-popup');
        if (!pop) return;
        pop.dataset.built = '';
        buildPopup();
        window.illuSyncSelectPickerUI();
    }

    window.illuInitSelectPicker = function () {
        buildPopup();
        const wrap = document.getElementById('illu-select-picker-wrap');
        const header = document.getElementById('illu-select-picker-header');
        if (!wrap || !header || wrap.dataset.bound === '1') return;
        wrap.dataset.bound = '1';

        function toggle() {
            const pop = document.getElementById('illu-select-picker-popup');
            if (pop && !pop.hidden) window.illuCloseSelectPickerPopup();
            else window.illuOpenSelectPickerPopup();
        }

        header.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        });
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                toggle();
            }
        });
        document.addEventListener('mousedown', (e) => {
            const pop = document.getElementById('illu-select-picker-popup');
            if (!pop || pop.hidden) return;
            if (e.target.closest('#illu-select-picker-wrap')) return;
            /* Popup portalisé dans <body> (anti-clip) → ses items sortent du wrap. */
            if (pop.contains(e.target)) return;
            window.illuCloseSelectPickerPopup();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') window.illuCloseSelectPickerPopup();
        });
        window.addEventListener('illu-i18n-applied', (e) => {
            /* Seul un ré-application global (changement de langue) doit reconstruire. */
            if (e && e.detail && e.detail.scoped) return;
            refreshLabels();
        });
        window.illuSyncSelectPickerUI();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.illuInitSelectPicker());
    } else {
        queueMicrotask(() => window.illuInitSelectPicker());
    }
})();
