/**
 * illu-compact-mode.js — Mode compact (Paramètres › Apparence).
 *
 * Rend à la toile la hauteur que prennent l'en-tête et la barre d'état :
 *
 *   1. #app-status-bar masquée (css/compact-mode.css) ;
 *   2. #tool-options-container déplacé DANS .illu-sub-menubar → le ruban
 *      d'options et la barre d'outils rapide partagent une seule ligne ;
 *   3. « Signaler un bug » masqué : c'est la place que prend le ruban ;
 *   4. #tab-bar-outer / #tab-bar-scroll ramenés à la hauteur de la barre de
 *      menus, mesurée ici dans --illu-compact-menubar-h ;
 *   5. illu-tool-ribbon.js ne laisse par ailleurs que les alvéoles utiles à
 *      l'outil actif (cf. COMPACT_HIDDEN_RIBBON_GROUPS).
 *
 * Le déplacement du ruban ne concerne que la disposition Paint.NET (flottante)
 * sur client bureau : en mode Photoshop les options vivent déjà dans une
 * colonne (#dock-tool-options-host) et le shell téléphone a sa propre mise en
 * page. Les points 1, 3 et 4 s'appliquent partout.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'illu_compact_mode';
    const BODY_CLASS = 'illu-compact-mode';
    const PLACEHOLDER_ID = 'illu-tool-options-origin';

    let _menubarRO = null;

    /* ── Préférence ──────────────────────────────────────────────────────── */

    window.illuIsCompactMode = function () {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch (e) {
            return false;
        }
    };

    /** Vrai quand le ruban doit réellement être collé au sous-menu. */
    function compactRibbonLayoutActive() {
        if (!window.illuIsCompactMode()) return false;
        if (document.body.classList.contains('illu-mobile-ui')) return false;
        const mode = typeof window.getUILayoutMode === 'function' ? window.getUILayoutMode() : 'floating';
        return mode === 'floating';
    }
    window.illuIsCompactRibbonLayout = compactRibbonLayoutActive;

    /* ── Déplacement du ruban ────────────────────────────────────────────── */

    /* Même repère que le mode Photoshop (app.js) : un seul placeholder, posé à
       la position d'origine, sert aux deux relogements. */
    function ensurePlaceholder() {
        const cont = document.getElementById('tool-options-container');
        if (!cont || !cont.parentNode) return null;
        let ph = document.getElementById(PLACEHOLDER_ID);
        if (!ph) {
            ph = document.createElement('div');
            ph.id = PLACEHOLDER_ID;
            ph.hidden = true;
            cont.parentNode.insertBefore(ph, cont);
        }
        return ph;
    }

    function moveRibbonIntoSubMenubar() {
        const cont = document.getElementById('tool-options-container');
        const sub = document.querySelector('.illu-menu-and-sub-wrapper > .illu-sub-menubar');
        if (!cont || !sub) return;
        /* Le placeholder doit être posé AVANT le déplacement, sinon on perd la
           position d'origine. */
        ensurePlaceholder();
        if (cont.parentNode === sub) return;
        sub.appendChild(cont);
    }

    function restoreRibbonPlacement() {
        const cont = document.getElementById('tool-options-container');
        if (!cont) return;
        const sub = document.querySelector('.illu-menu-and-sub-wrapper > .illu-sub-menubar');
        if (!sub || cont.parentNode !== sub) return;
        const ph = document.getElementById(PLACEHOLDER_ID);
        if (ph && ph.parentNode) ph.parentNode.insertBefore(cont, ph);
    }

    /* ── Hauteur de la barre de menus ────────────────────────────────────── */

    /* Elle vaut 30 px (Windows 98) ou 32 px (Flat / macOS) selon le thème : on
       mesure plutôt que de dupliquer ces valeurs ici. */
    function syncMenubarHeightVar() {
        const menuRoot = document.querySelector('.illu-menu-and-sub-wrapper > .illu-menubar-root');
        if (!menuRoot) return;
        const h = Math.round(menuRoot.getBoundingClientRect().height);
        if (h < 16 || h > 80) return;
        document.documentElement.style.setProperty('--illu-compact-menubar-h', h + 'px');
    }
    window.illuSyncCompactMenubarHeight = syncMenubarHeightVar;

    function observeMenubarHeight() {
        if (_menubarRO || typeof ResizeObserver !== 'function') return;
        const menuRoot = document.querySelector('.illu-menu-and-sub-wrapper > .illu-menubar-root');
        if (!menuRoot) return;
        _menubarRO = new ResizeObserver(() => syncMenubarHeightVar());
        _menubarRO.observe(menuRoot);
    }

    /* ── Largeur de la barre d'onglets ───────────────────────────────────── */

    /* En compact le wrapper occupe toute la largeur : illuRecalculateTabBarWidth
       (Listener.js) le mesure et ne laisse que 76 px aux onglets. On mesure donc
       la barre de menus elle-même, qui reste à la largeur de ses entrées. */
    function patchTabBarWidth() {
        const orig = window.illuRecalculateTabBarWidth;
        if (typeof orig !== 'function' || orig.__illuCompactPatched) return;

        const patched = function () {
            const tabBarOuter = document.getElementById('tab-bar-outer');
            const menuRoot = document.querySelector('.illu-menu-and-sub-wrapper > .illu-menubar-root');
            if (!compactRibbonLayoutActive() || !tabBarOuter || !menuRoot) {
                return orig.apply(this, arguments);
            }
            if (window.innerWidth <= 590) {
                tabBarOuter.style.removeProperty('width');
                tabBarOuter.style.removeProperty('max-width');
            } else {
                const avail = Math.max(76, window.innerWidth - menuRoot.getBoundingClientRect().right - 25);
                tabBarOuter.style.setProperty('width', avail + 'px', 'important');
                tabBarOuter.style.setProperty('max-width', avail + 'px', 'important');
            }
            requestAnimationFrame(() => {
                const scrollBox = document.getElementById('tab-bar-scroll');
                if (scrollBox) {
                    tabBarOuter.classList.toggle(
                        'tab-bar-has-overflow',
                        scrollBox.scrollWidth > scrollBox.clientWidth
                    );
                }
            });
        };
        patched.__illuCompactPatched = true;
        window.illuRecalculateTabBarWidth = patched;
    }

    /* ── Application ─────────────────────────────────────────────────────── */

    window.illuApplyCompactMode = function () {
        const on = window.illuIsCompactMode();
        document.body.classList.toggle(BODY_CLASS, on);

        if (compactRibbonLayoutActive()) moveRibbonIntoSubMenubar();
        else restoreRibbonPlacement();

        syncMenubarHeightVar();
        observeMenubarHeight();
        patchTabBarWidth();

        /* Le ruban change de largeur disponible ET de jeu d'alvéoles : on
           repart d'un état neutre avant de laisser l'overflow recalculer. */
        if (window.illuRibbonOverflow) {
            if (typeof window.illuRibbonOverflow.reset === 'function') window.illuRibbonOverflow.reset();
            if (typeof window.illuRibbonOverflow.update === 'function') window.illuRibbonOverflow.update();
        }
        if (typeof window.illuApplyRibbonGroupsForTool === 'function' && window.illuActiveToolId) {
            window.illuApplyRibbonGroupsForTool(
                window.illuActiveToolId,
                window.illuActiveToolCfg,
                window.illuActiveToolCtx
            );
        }
        if (typeof window.illuRecalculateTabBarWidth === 'function') {
            window.illuRecalculateTabBarWidth();
        }
        if (window.EditorManager && typeof window.EditorManager.syncFloatingPalettesPosition === 'function') {
            window.EditorManager.syncFloatingPalettesPosition();
        }
        window.dispatchEvent(new CustomEvent('illu-compact-mode-changed', { detail: { enabled: on } }));
    };

    window.illuSetCompactMode = function (on) {
        try {
            localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
        } catch (e) {
            /* ignore */
        }
        window.illuApplyCompactMode();
    };

    /* Toute bascule de disposition (Paint.NET ↔ Photoshop ↔ téléphone) remet le
       ruban à sa place d'origine : il faut le recoller après coup. */
    function hookLayoutSwitch() {
        const orig = window.applyUILayoutFromPreference;
        if (typeof orig !== 'function' || orig.__illuCompactHooked) return;
        const wrapped = function () {
            const r = orig.apply(this, arguments);
            window.illuApplyCompactMode();
            return r;
        };
        wrapped.__illuCompactHooked = true;
        window.applyUILayoutFromPreference = wrapped;
    }

    function init() {
        hookLayoutSwitch();
        window.illuApplyCompactMode();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('illu-mobile-ui-changed', () => window.illuApplyCompactMode());
})();
