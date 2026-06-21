/**
 * illu-ribbon-overflow.js
 * Système de réduction automatique des alvéoles (illu-ribbon-group)
 * quand l'espace disponible dans #tool-options-container est réduit.
 *
 * Niveaux :
 *   normal     → icône + texte
 *   compact    → icône seule, bien centrée (label de groupe encore visible)
 *   compressed → palier intermédiaire : hérite du compact MAIS retire le label
 *                de groupe + resserre (jauges 40px, grilles repliées 2 colonnes).
 *                Exception cutout : mode « texte seul » dédié (voir style.css).
 *   collapsed  → bouton trigger (style illu-tool-header) → popup liste
 *
 * Anti-boucle : _updating flag + comparaison lastContainerWidth
 */
(function () {
    'use strict';

    /* ── Config des groupes compressibles ────────────────────────────────────── */
    const OVERFLOW_GROUPS = [
        /* Groupe Détourage guidé : compact = icône seule → compressed = texte seul → collapsed (popup) */
        { id: 'cutout',          order: 0,  levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-scissors' },
        /* Gros groupes : compact (icône seule) → compressed (sans label, replié) → collapsed (popup) */
        { id: 'selection',       order: 1,  levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-object-group' },
        { id: 'clipboard',       order: 2,  levels: ['hidden'],               icon: 'fa-solid fa-clipboard' },
        { id: 'adjustments',     order: 3,  levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-arrows-up-down-left-right' },
        { id: 'brush',           order: 4,  levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-paintbrush' },
        { id: 'symmetry',        order: 16, levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-arrows-left-right' },
        { id: 'shape-style-fill',order: 5,  levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-shapes' },
        /* text-style-fill gardé large — pas dans la liste d'overflow */
        { id: 'vector',          order: 6,  levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-bezier-curve' },
        { id: 'vector-fill',     order: 7,  levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-fill' },
        { id: 'shape-grad',      order: 8,  levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-circle-half-stroke' },
        { id: 'shape-grad-method',  order: 9, levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-sliders' },
        { id: 'gradient-type',   order: 10, levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-circle-half-stroke' },
        { id: 'gradient-method', order: 11, levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-sliders' },
        { id: 'view',            order: 12, levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-eye' },
        /* Groupes mixtes (boutons + jauges) : compact = boutons icône seule + piste 60px */
        { id: 'fill',            order: 13, levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-fill-drip' },
        { id: 'wand',            order: 14, levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-wand-magic-sparkles' },
        { id: 'warp',            order: 15, levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-up-down-left-right' },
        /* Groupes jauges pures : compact = réduit la piste à 60px min */
        { id: 'size',            order: 20, levels: ['compact', 'compressed', 'collapsed'], icon: 'fa-solid fa-ruler-horizontal' },
        { id: 'text-params',     order: 21, levels: ['compact', 'compressed'], icon: 'fa-solid fa-text-height' },
        /* line-cap / line-dash : déjà des dropdowns → pas dans l'overflow */
    ];

    const CONFIG_BY_ID = {};
    OVERFLOW_GROUPS.forEach(c => { CONFIG_BY_ID[c.id] = c; });

    /* ── Anti-boucle ───────────────────────────────────────────────────────────
     * _updatingCount : compteur (>0 = nos propres modifications en cours)
     *   → MO callbacks sont des microtasks ; ils s'exécutent AVANT setTimeout.
     *   → On décrémente dans setTimeout(0) pour que les MO voient encore >0.
     * _lastWidth : dernière largeur container traitée → skip si inchangée
     * ────────────────────────────────────────────────────────────────────────── */
    let _updatingCount = 0;
    let _lastWidth = -1;

    /* ── Popup partagé ─────────────────────────────────────────────────────── */
    let _sharedPopup = null;
    let _popupCloseHandler = null;

    function getOrCreateSharedPopup() {
        if (_sharedPopup) return _sharedPopup;
        const pop = document.createElement('div');
        pop.id = 'illu-ribbon-overflow-popup';
        pop.className = 'illu-ribbon-overflow-popup';
        pop.setAttribute('role', 'listbox');
        pop.hidden = true;
        document.body.appendChild(pop);
        return (_sharedPopup = pop);
    }

    function closeSharedPopup() {
        if (!_sharedPopup) return;
        _sharedPopup.hidden = true;
        _sharedPopup._triggerGroup = null;
        if (_popupCloseHandler) {
            document.removeEventListener('pointerdown', _popupCloseHandler);
            _popupCloseHandler = null;
        }
    }

    function openCollapsedGroupPopup(group, trigger) {
        const pop = getOrCreateSharedPopup();
        if (!pop.hidden && pop._triggerGroup === group) {
            closeSharedPopup();
            return;
        }
        closeSharedPopup();

        pop.innerHTML = '';
        const body = group.querySelector('.illu-ribbon-group-body');
        if (!body) return;

        /* Cloner les boutons visibles avec icône + texte côte à côte */
        const items = body.querySelectorAll('.illu-mode-toggle-item--unified:not([hidden])');
        if (!items.length) {
            const clone = body.cloneNode(true);
            clone.className = 'illu-ribbon-overflow-body-clone';
            pop.appendChild(clone);
        } else {
            items.forEach(item => {
                const btn = item.querySelector('button.illu-icon-toggle, button.illu-mode-toggle-btn');
                if (!btn) return;
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'illu-ribbon-overflow-row';
                row.setAttribute('role', 'option');

                /* Icône */
                const iconEl = btn.querySelector('.illu-shape-ico, i.fa-solid, i.fa-regular, svg');
                if (iconEl) row.appendChild(iconEl.cloneNode(true));

                /* Label */
                const lbl = btn.querySelector('.illu-mode-toggle-lbl');
                const span = document.createElement('span');
                span.className = 'illu-ribbon-overflow-lbl';
                span.textContent = lbl ? lbl.textContent : (btn.title || '');
                row.appendChild(span);

                /* État actif */
                if (btn.classList.contains('illu-icon-toggle--on') || btn.classList.contains('active') || btn.getAttribute('aria-pressed') === 'true') {
                    row.classList.add('illu-ribbon-overflow-row--active');
                }

                row.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeSharedPopup();
                    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                });
                pop.appendChild(row);
            });
        }

        /* Positionnement sous le trigger */
        pop.hidden = false;
        pop._triggerGroup = group;
        const rect = trigger.getBoundingClientRect();
        pop.style.position = 'fixed';
        pop.style.top = rect.bottom + 2 + 'px';
        pop.style.left = rect.left + 'px';
        pop.style.minWidth = Math.max(rect.width, 130) + 'px';

        requestAnimationFrame(() => {
            const pr = pop.getBoundingClientRect();
            if (pr.right > window.innerWidth - 4) {
                pop.style.left = Math.max(4, window.innerWidth - pr.width - 4) + 'px';
            }
            if (pr.bottom > window.innerHeight - 4) {
                pop.style.top = Math.max(4, rect.top - pr.height - 2) + 'px';
            }
        });

        setTimeout(() => {
            _popupCloseHandler = (e) => {
                if (!pop.contains(e.target) && !group.contains(e.target)) closeSharedPopup();
            };
            document.addEventListener('pointerdown', _popupCloseHandler);
        }, 0);
    }

    /* ── Trigger button — visuel identique à illu-tool-header ──────────────── */
    function ensureCollapseTrigger(group, cfg) {
        let trigger = group.querySelector(':scope > .illu-ribbon-group-collapse-trigger');
        if (trigger) return trigger;

        /* Même structure que line-cap-end-header :
         * div.illu-tool-header.illu-shape-picker-header.illu-generic-dropdown-header
         *   > span.illu-tool-header-icon + i.illu-generic-dropdown-arrow             */
        trigger = document.createElement('div');
        /* NE PAS inclure illu-shape-picker-header : il force display:block + position:relative
         * qui casse le centrage vertical des enfants directs.
         * illu-generic-dropdown-header fournit le visuel complet (flex, border, bg).       */
        trigger.className = 'illu-ribbon-group-collapse-trigger illu-generic-dropdown-header';
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const label = _i18n(cfg.labelKey, cfg.id);
        trigger.title = label;
        trigger.setAttribute('aria-label', label);

        const iconWrap = document.createElement('span');
        iconWrap.className = 'illu-tool-header-icon illu-ribbon-group-collapse-icon';
        const ico = document.createElement('i');
        ico.className = cfg.icon || 'fa-solid fa-ellipsis';
        iconWrap.appendChild(ico);
        trigger.appendChild(iconWrap);

        /* Label (groupe name) — identique à illu-tool-picker-label */
        const labelEl = document.createElement('span');
        labelEl.className = 'illu-tool-picker-label illu-ribbon-group-collapse-label';
        labelEl.textContent = label;
        trigger.appendChild(labelEl);

        const chevron = document.createElement('i');
        chevron.className = 'fa-solid fa-chevron-down illu-generic-dropdown-arrow illu-tool-picker-chevron';
        trigger.appendChild(chevron);

        /* Clic / touche */
        function handleOpen(e) {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = !_sharedPopup?.hidden && _sharedPopup?._triggerGroup === group;
            trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            openCollapsedGroupPopup(group, trigger);
        }
        trigger.addEventListener('click', handleOpen);
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') handleOpen(e);
        });

        /* Insérer avant le body */
        const body = group.querySelector('.illu-ribbon-group-body');
        if (body) group.insertBefore(trigger, body);
        else group.prepend(trigger);

        return trigger;
    }

    function _i18n(key, fallback) {
        if (key && window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const v = window.IlluI18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback || key || '';
    }

    /* ── Appliquer un niveau sur un groupe ─────────────────────────────────── */
    function setGroupLevel(group, level) {
        const current = group.dataset.illuRibbonOverflow || 'normal';
        if (current === level) return;

        group.dataset.illuRibbonOverflow = level;
        group.classList.remove(
            'illu-ribbon-group--compact',
            'illu-ribbon-group--compressed',
            'illu-ribbon-group--collapsed',
            'illu-ribbon-group--hidden'
        );

        if (level === 'compact') {
            group.classList.add('illu-ribbon-group--compact');
            const t = group.querySelector(':scope > .illu-ribbon-group-collapse-trigger');
            if (t) t.hidden = true;
        } else if (level === 'compressed') {
            group.classList.add('illu-ribbon-group--compressed');
            /* Sauf cutout (qui a un mode « texte seul » dédié), compressed hérite
             * du visuel compact (icône seule) PUIS retire le label de groupe et
             * resserre encore → vrai palier intermédiaire entre compact et collapsed. */
            if (group.dataset.illuRibbonGroup !== 'cutout') {
                group.classList.add('illu-ribbon-group--compact');
            }
            const t = group.querySelector(':scope > .illu-ribbon-group-collapse-trigger');
            if (t) t.hidden = true;
        } else if (level === 'collapsed') {
            group.classList.add('illu-ribbon-group--collapsed');
            const id = group.dataset.illuRibbonGroup;
            const cfg = CONFIG_BY_ID[id] || { icon: 'fa-solid fa-ellipsis', id };
            const t = ensureCollapseTrigger(group, cfg);
            t.hidden = false;
        } else if (level === 'hidden') {
            group.classList.add('illu-ribbon-group--hidden');
            const t = group.querySelector(':scope > .illu-ribbon-group-collapse-trigger');
            if (t) t.hidden = true;
        } else {
            /* normal */
            const t = group.querySelector(':scope > .illu-ribbon-group-collapse-trigger');
            if (t) t.hidden = true;
        }
    }

    /* ── Déballer tous les stacks de collapsed (anywhere dans le container) ── */
    function _unwrapCollapsedStacks(container) {
        /* Pas de ':scope >' : le stack peut être dans un sous-wrapper (.illu-ribbon-groups…) */
        container.querySelectorAll('.illu-ribbon-collapsed-stack').forEach(stack => {
            const parent = stack.parentNode;
            while (stack.firstChild) parent.insertBefore(stack.firstChild, stack);
            stack.remove();
        });
    }

    /* ── Algorithme principal ──────────────────────────────────────────────── */
    function computeOverflow(container) {
        if (_updatingCount > 0) return;
        if (!document.body.classList.contains('illu-toolbar-ribbon')) return;

        /* Marge préventive : on soustrait 6px pour éviter le train de retard
         * (le layout reflow est légèrement en avance sur la mesure RO).          */
        const containerWidth = container.getBoundingClientRect().width - 6;
        if (containerWidth <= 0) return;

        /* Skip si largeur identique */
        if (Math.abs(containerWidth - _lastWidth) < 1) return;
        _lastWidth = containerWidth;

        _updatingCount++;
        try {
            /* Nettoyer les stacks de la passe précédente avant reset */
            _unwrapCollapsedStacks(container);

            const allGroups = [...container.querySelectorAll(':scope .illu-ribbon-group:not([hidden])')];
            if (!allGroups.length) return;

            const overflowGroups = allGroups
                .filter(g => CONFIG_BY_ID[g.dataset.illuRibbonGroup])
                .sort((a, b) => CONFIG_BY_ID[a.dataset.illuRibbonGroup].order - CONFIG_BY_ID[b.dataset.illuRibbonGroup].order);

            /* Ordre de DÉGRADATION : on dégrade d'abord les groupes les moins
             * prioritaires (paramètres / jauges = order élevé, à droite) et on
             * garde les groupes d'action (cutout, selection, clipboard… = order
             * bas) visibles le plus longtemps possible.
             * → Sans ça, selection (order 1) collapsait AVANT d'avoir un état
             *   compact stable sur téléphone (saut icône+texte → popup).        */
            const degradeOrder = [...overflowGroups].reverse();

            /* Reset tous → normal pour mesurer depuis zéro */
            overflowGroups.forEach(g => setGroupLevel(g, 'normal'));

            /* Mesure totale (groupes visibles incluant les non-overflow) */
            const visibleAll = [...container.querySelectorAll(':scope .illu-ribbon-group:not([hidden])')];
            let total = visibleAll.reduce((s, g) => s + g.getBoundingClientRect().width, 0);

            /* Passe 1 — compact */
            for (const g of degradeOrder) {
                if (total <= containerWidth + 2) break;
                const cfg = CONFIG_BY_ID[g.dataset.illuRibbonGroup];
                if (!cfg.levels.includes('compact')) continue;
                const before = g.getBoundingClientRect().width;
                setGroupLevel(g, 'compact');
                const after = g.getBoundingClientRect().width;
                total -= (before - after);
            }

            /* Passe 1.5 — compressed (texte seul, sans icône)
             * Après le compact : on réduit encore en supprimant les icônes.
             * Intermédiaire entre compact (icône seule) et collapsed (popup).   */
            for (const g of degradeOrder) {
                if (total <= containerWidth + 2) break;
                const cfg = CONFIG_BY_ID[g.dataset.illuRibbonGroup];
                if (!cfg.levels.includes('compressed')) continue;
                if (g.dataset.illuRibbonOverflow === 'compressed') continue;
                const before = g.getBoundingClientRect().width;
                setGroupLevel(g, 'compressed');
                const after = g.getBoundingClientRect().width;
                total -= (before - after);
            }

            /* Passe 2a — hidden (ex: clipboard) */
            for (const g of degradeOrder) {
                if (total <= containerWidth + 2) break;
                const cfg = CONFIG_BY_ID[g.dataset.illuRibbonGroup];
                if (!cfg.levels.includes('hidden')) continue;
                const before = g.getBoundingClientRect().width;
                setGroupLevel(g, 'hidden');
                total -= before; /* groupe masqué = largeur 0 */
            }

            /* Passe 2b — collapsed */
            for (const g of degradeOrder) {
                if (total <= containerWidth + 2) break;
                const cfg = CONFIG_BY_ID[g.dataset.illuRibbonGroup];
                if (!cfg.levels.includes('collapsed')) continue;
                if (g.dataset.illuRibbonOverflow === 'collapsed') continue;
                const before = g.getBoundingClientRect().width;
                setGroupLevel(g, 'collapsed');
                const after = g.getBoundingClientRect().width;
                total -= (before - after);
            }

            /* Passe 3 — stack : regrouper les collapsed en colonne quand encore trop large.
             * Guard : si le stack existe déjà et contient exactement les mêmes groupes,
             * on ne le recrée pas (évite la boucle RO → unwrap → recréer → RO…).     */
            const collapsedGroups = overflowGroups.filter(
                g => g.dataset.illuRibbonOverflow === 'collapsed'
            );
            /* Idem : chercher le stack n'importe où dans le container */
            const existingStack = container.querySelector('.illu-ribbon-collapsed-stack');

            if (total > containerWidth + 2 && collapsedGroups.length >= 2) {
                if (!existingStack) {
                    const stackWrap = document.createElement('div');
                    stackWrap.className = 'illu-ribbon-collapsed-stack';
                    collapsedGroups[0].parentNode.insertBefore(stackWrap, collapsedGroups[0]);
                    collapsedGroups.forEach(g => stackWrap.appendChild(g));
                }
                /* Après création/existence du stack, mettre à jour _lastWidth
                 * avec la largeur effective → évite que le RO ne redéclenche un cycle. */
                _lastWidth = container.getBoundingClientRect().width;
            } else if (existingStack && (total <= containerWidth + 2 || collapsedGroups.length < 2)) {
                /* Plus besoin du stack : déballer (déjà fait en tête, mais au cas où) */
                const parent = existingStack.parentNode;
                while (existingStack.firstChild) parent.insertBefore(existingStack.firstChild, existingStack);
                existingStack.remove();
                _lastWidth = container.getBoundingClientRect().width;
            }
        } finally {
            /* MO callbacks sont des microtasks : ils s'exécutent avant setTimeout.
             * On décrémente dans un macrotask pour qu'ils voient encore count > 0.  */
            setTimeout(() => { _updatingCount--; }, 0);
        }
    }

    /* ── Scheduler (debounce via rAF) ─────────────────────────────────────── */
    let _rafId = null;
    function scheduleOverflowUpdate() {
        if (_rafId) return;
        _rafId = requestAnimationFrame(() => {
            _rafId = null;
            const container = document.getElementById('tool-options-container');
            if (container) computeOverflow(container);
        });
    }

    /* ── Init ─────────────────────────────────────────────────────────────── */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSharedPopup();
    });

    function initResizeObserver() {
        const container = document.getElementById('tool-options-container');
        if (!container) return;

        /* ResizeObserver : déclenche seulement si la largeur change et pas pendant nos mises à jour */
        const ro = new ResizeObserver((entries) => {
            if (_updatingCount > 0) return;
            for (const entry of entries) {
                const newW = entry.contentRect.width;
                if (Math.abs(newW - _lastWidth) >= 1) scheduleOverflowUpdate();
            }
        });
        ro.observe(container);

        /* MutationObserver : childList + hidden → recalcul si changement externe.
         * Les MO callbacks sont des microtasks, ils s'exécutent avant setTimeout.
         * _updatingCount est donc encore > 0 pendant NOS propres mutations.       */
        const mo = new MutationObserver(() => {
            if (_updatingCount > 0) return;
            _lastWidth = -1;
            scheduleOverflowUpdate();
        });
        mo.observe(container, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['hidden']
        });

        scheduleOverflowUpdate();
    }

    /* API publique */
    window.illuRibbonOverflow = {
        update: () => { _lastWidth = -1; scheduleOverflowUpdate(); },
        reset: function () {
            _updatingCount++;
            try {
                const container = document.getElementById('tool-options-container');
                if (container) _unwrapCollapsedStacks(container);
                document.querySelectorAll('.illu-ribbon-group[data-illu-ribbon-overflow]').forEach(g => {
                    setGroupLevel(g, 'normal');
                    delete g.dataset.illuRibbonOverflow;
                });
                _lastWidth = -1;
            } finally {
                setTimeout(() => { _updatingCount--; }, 0);
            }
        }
    };

    /* Hook illuApplyRibbonGroupsForTool */
    const _origApply = window.illuApplyRibbonGroupsForTool;
    if (typeof _origApply === 'function') {
        window.illuApplyRibbonGroupsForTool = function () {
            _origApply.apply(this, arguments);
            _lastWidth = -1;
            scheduleOverflowUpdate();
        };
    } else {
        Object.defineProperty(window, 'illuApplyRibbonGroupsForTool', {
            set: function (fn) {
                const wrapped = function () {
                    fn.apply(this, arguments);
                    _lastWidth = -1;
                    scheduleOverflowUpdate();
                };
                Object.defineProperty(window, 'illuApplyRibbonGroupsForTool', {
                    value: wrapped, writable: true, configurable: true
                });
            },
            configurable: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initResizeObserver);
    } else {
        setTimeout(initResizeObserver, 200);
    }

    window.addEventListener('illu-mobile-ui-changed', () => { _lastWidth = -1; scheduleOverflowUpdate(); });
    window.addEventListener('resize', scheduleOverflowUpdate);
})();
