/**
 * illu-mob-tool-switch.js — Sélecteur d'outil mobile rétractable.
 *
 * Sur téléphone, le groupe ruban « Outil » et le bouton dock « Outils » sont masqués
 * (CSS) pour gagner de la place. À la place, une pastille flottante dans la rangée
 * d'options affiche l'icône de l'outil courant + un chevron ; un appui déploie vers
 * la gauche une liste glissable d'outils. Un nouvel appui (chevron « < ») ou un clic
 * à l'extérieur la rétracte, le tout avec une petite animation.
 */
(function () {
    'use strict';

    let root = null;
    let listEl = null;
    let toggleEl = null;
    let iconEl = null;

    function isShellActive() {
        return document.body.classList.contains('illu-mobile-shell-active');
    }

    /** Clone l'icône du bouton boîte à outils correspondant à un outil. */
    function cloneToolIcon(toolId) {
        const btn = document.getElementById('tool-' + toolId);
        const icon = btn && btn.querySelector('i, svg.tool-icon, svg.illu-shape-ico, svg');
        return icon ? icon.cloneNode(true) : null;
    }

    function toolLabel(toolId) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const key = 'tool.' + toolId;
            const tr = window.IlluI18n.t(key);
            if (tr && tr !== key) return tr;
        }
        if (window.TOOL_OPTIONS_UI && window.TOOL_OPTIONS_UI[toolId] && window.TOOL_OPTIONS_UI[toolId].label) {
            return window.TOOL_OPTIONS_UI[toolId].label;
        }
        return toolId;
    }

    /** Active un outil en déléguant au bouton existant de la boîte à outils. */
    function activateTool(toolId) {
        const btn = document.getElementById('tool-' + toolId);
        if (btn && typeof btn.click === 'function') {
            btn.click();
        }
    }

    /* Liste des outils = ceux disponibles dans la palette #win-tools (#main-toolbox).
       On reprend les boutons .tool-btn des groupes visibles (hors étagère cachée,
       hors boutons d'action comme Désélectionner / Zoom auto), dans l'ordre du DOM. */
    function getToolIds() {
        const toolbox = document.getElementById('main-toolbox');
        if (!toolbox) return [];
        const ids = [];
        toolbox.querySelectorAll('.tool-group .tool-btn').forEach((btn) => {
            if (!btn.id || btn.id.indexOf('tool-') !== 0) return; // garde uniquement #tool-<outil>
            if (btn.hidden || btn.style.display === 'none') return;
            const toolId = btn.id.replace('tool-', '');
            if (ids.indexOf(toolId) === -1) ids.push(toolId);
        });
        return ids;
    }

    function buildList() {
        if (!listEl) return;
        listEl.innerHTML = '';
        getToolIds().forEach((toolId) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'illu-mob-tool-switch__item';
            item.dataset.tool = toolId;
            item.setAttribute('role', 'option');
            const lbl = toolLabel(toolId);
            item.setAttribute('aria-label', lbl);
            item.title = lbl;
            const ic = cloneToolIcon(toolId);
            if (ic) {
                ic.removeAttribute('id');
                item.appendChild(ic);
            }
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                activateTool(toolId);
                collapse();
                syncCurrent();
            });
            listEl.appendChild(item);
        });
    }

    function syncCurrent() {
        if (!iconEl) return;
        const t = window.activeTool || 'select';
        const ic = cloneToolIcon(t);
        iconEl.innerHTML = '';
        if (ic) {
            ic.removeAttribute('id');
            iconEl.appendChild(ic);
        }
        if (toggleEl) {
            const lbl = toolLabel(t);
            toggleEl.setAttribute('aria-label', lbl);
            toggleEl.title = lbl;
        }
        /* Marque l'item actif dans la liste */
        if (listEl) {
            listEl.querySelectorAll('.illu-mob-tool-switch__item').forEach((it) => {
                it.classList.toggle('is-active', it.dataset.tool === t);
                it.setAttribute('aria-selected', it.dataset.tool === t ? 'true' : 'false');
            });
        }
    }

    function isExpanded() {
        return root && root.dataset.expanded === 'true';
    }

    function expand() {
        if (!root || isExpanded()) return;
        buildList(); // reflète l'état courant de la palette #win-tools
        syncCurrent();
        root.dataset.expanded = 'true';
        toggleEl.setAttribute('aria-expanded', 'true');
        listEl.setAttribute('aria-hidden', 'false');
        /* Place l'item actif en vue. */
        const active = listEl.querySelector('.illu-mob-tool-switch__item.is-active');
        if (active && typeof active.scrollIntoView === 'function') {
            active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
        }
        document.addEventListener('pointerdown', onOutsidePointer, true);
    }

    function collapse() {
        if (!root || !isExpanded()) return;
        root.dataset.expanded = 'false';
        toggleEl.setAttribute('aria-expanded', 'false');
        listEl.setAttribute('aria-hidden', 'true');
        document.removeEventListener('pointerdown', onOutsidePointer, true);
    }

    function toggle() {
        if (isExpanded()) collapse();
        else expand();
    }

    function onOutsidePointer(e) {
        if (root && !root.contains(e.target)) {
            collapse();
        }
    }

    function applyVisibility() {
        if (!root) return;
        const show = isShellActive();
        root.hidden = !show;
        if (!show) collapse();
        else {
            syncCurrent();
            maybeHint();
        }
    }

    /* Exécute cb une fois le splash masqué (#illu-splash.illu-splash--gone),
       ou tout de suite s'il n'y a pas/plus de splash. */
    function whenSplashGone(cb) {
        const sp = document.getElementById('illu-splash');
        if (!sp || sp.classList.contains('illu-splash--gone')) {
            cb();
            return;
        }
        const mo = new MutationObserver(() => {
            if (sp.classList.contains('illu-splash--gone')) {
                mo.disconnect();
                cb();
            }
        });
        mo.observe(sp, { attributes: true, attributeFilter: ['class'] });
    }

    /* Aperçu de découverte : au premier affichage sur téléphone, une fois le
       splash masqué puis 800 ms plus tard, on déploie la liste pour signaler
       que les outils sont disponibles ici. Elle reste ouverte tant que
       l'utilisateur ne fait pas autre chose (clic à côté, changement d'outil,
       fermeture via le chevron). */
    let hintDone = false;
    function maybeHint() {
        if (hintDone || !root || root.hidden) return;
        hintDone = true;
        whenSplashGone(() => {
            window.setTimeout(() => {
                if (!isShellActive() || root.hidden || isExpanded()) return;
                expand();
            }, 800);
        });
    }

    function init() {
        root = document.getElementById('illu-mob-tool-switch');
        listEl = document.getElementById('illu-mob-tool-switch-list');
        toggleEl = document.getElementById('illu-mob-tool-switch-toggle');
        iconEl = document.getElementById('illu-mob-tool-switch-icon');
        if (!root || !listEl || !toggleEl || !iconEl) return;

        toggleEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        });

        /* Garde la pastille synchronisée avec l'outil actif : updateToolOptionsBar()
           est appelée à chaque changement d'outil. */
        if (typeof window.updateToolOptionsBar === 'function' && !window.updateToolOptionsBar.__illuToolSwitchWrapped) {
            const orig = window.updateToolOptionsBar;
            const wrapped = function () {
                const r = orig.apply(this, arguments);
                try { syncCurrent(); } catch (err) { /* no-op */ }
                return r;
            };
            wrapped.__illuToolSwitchWrapped = true;
            window.updateToolOptionsBar = wrapped;
        }

        /* Réagit à l'activation/désactivation du shell mobile. */
        const mo = new MutationObserver(applyVisibility);
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        applyVisibility();
        syncCurrent();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* Expose un point de synchro manuel si besoin ailleurs. */
    window.illuSyncMobToolSwitch = syncCurrent;
})();
