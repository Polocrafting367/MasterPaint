/**
 * pdn-chrome.js — éléments d'interface repris de Paint.NET 5 :
 *  - bascules Outils / Historique / Calques / Couleurs en haut à droite (#illu-pdn-win-toggles),
 *  - état enfoncé des boutons Grille / Règles de la barre standard,
 *  - raccourcis Paint.NET : F5 Outils, F6 Historique, F7 Calques, F8 Couleurs, Alt+X Paramètres.
 * Aucune logique dupliquée : tout passe par les fonctions existantes
 * (toggleFloatingPaletteVisibility, toggleIlluPixelGrid, toggleIlluRulers, showSettingsDialog).
 */
(function () {
    'use strict';

    const WIN_KEYS = { F5: 'win-tools', F6: 'win-history', F7: 'win-layers', F8: 'win-colors' };

    /**
     * Paint.NET est une MISE EN PAGE (disposition « floating » des Paramètres), pas un thème :
     *  - illu-layout-pdn : structure Paint.NET, uniquement en disposition Paint.NET hors téléphone ;
     *  - illu-pdn-look   : couleurs Paint.NET, en plus seulement si le thème est Flat Design.
     * Les dispositions Photoshop et Téléphone ne reçoivent jamais ces classes.
     */
    function syncLayoutClass() {
        const b = document.body;
        if (!b) return;
        const mode = typeof window.getUILayoutMode === 'function' ? window.getUILayoutMode() : 'floating';
        const pdn = mode === 'floating' && !b.classList.contains('illu-mobile-ui') && !b.classList.contains('illu-mobile-shell-active');
        b.classList.toggle('illu-layout-pdn', pdn);
        // illu-pdn-look (couleurs) est posée par illuApplyToolbarStyleMode d'après cette classe et le
        // thème ; le choix ruban / barre Paint.NET n'y joue pas.
        if (!pdn) b.classList.remove('illu-pdn-look');
    }
    window.illuSyncPdnLayoutClass = syncLayoutClass;

    /**
     * Application en arrière-plan (autre fenêtre au premier plan) : comme Paint.NET, les
     * fenêtres flottantes passent en gris (titre atténué, case de fermeture grise).
     * Vérifié après un tour de boucle : le focus qui passe dans une iframe de la page ne compte pas.
     */
    function syncAppActive() {
        setTimeout(() => {
            if (document.body) document.body.classList.toggle('illu-app-inactive', !document.hasFocus());
        }, 0);
    }
    window.addEventListener('blur', syncAppActive);
    window.addEventListener('focus', syncAppActive);

    /**
     * Barre d'options « Style Paint.NET » : une seule rangée, comme Paint.NET.
     * Le ruban empile ses contrôles (grilles 2×n, piles « Police / Taille / Épaisseur »…) avec des
     * classes très variées ; plutôt que de courir après chaque règle CSS, on aplatit ici tout bloc
     * en grille ou en flex qui passe à la ligne, par un style en ligne prioritaire. Les jauges
     * (− [piste] +) gardent leur propre disposition. Tout est défait en revenant au ruban.
     */
    const FLAT_PROPS = ['grid-template-rows', 'grid-template-columns', 'grid-template-areas', 'grid-auto-flow',
        'grid-auto-columns', 'grid-auto-rows', 'flex-wrap', 'flex-direction', 'height', 'max-height', 'min-height',
        'width', 'max-width'];
    let flatObserver = null;
    let flatBusy = false;
    let flatRaf = 0;

    function flattenPdnBar() {
        flatRaf = 0;
        const toc = document.getElementById('tool-options-container');
        const b = document.body;
        if (!toc || !b) return;
        flatBusy = true;
        try {
            toc.querySelectorAll('[data-pdn-hide]').forEach((el) => {
                el.style.removeProperty('display');
                el.removeAttribute('data-pdn-hide');
            });
            toc.querySelectorAll('[data-pdn-flat]').forEach((el) => {
                FLAT_PROPS.forEach((p) => el.style.removeProperty(p));
                el.removeAttribute('data-pdn-flat');
            });
            if (!b.classList.contains('illu-toolbar-pdn') || b.classList.contains('illu-mobile-ui')) return;
            toc.querySelectorAll('.illu-ribbon-group-body, .illu-ribbon-group-body *').forEach((el) => {
                if (el.closest('.illu-gauge-wrap') || el.closest('.illu-font-combo-wrap')) return;
                if (el.matches('button, button *, svg, svg *, i, select, input, option')) return;
                const cs = getComputedStyle(el);
                if (cs.display === 'none') return;
                if (cs.display === 'grid' || cs.display === 'inline-grid') {
                    el.style.setProperty('grid-template-rows', 'none', 'important');
                    el.style.setProperty('grid-template-columns', 'none', 'important');
                    el.style.setProperty('grid-template-areas', 'none', 'important');
                    el.style.setProperty('grid-auto-flow', 'column', 'important');
                    el.style.setProperty('grid-auto-columns', 'max-content', 'important');
                    el.style.setProperty('grid-auto-rows', 'auto', 'important');
                    el.style.setProperty('height', 'auto', 'important');
                    el.style.setProperty('max-height', '30px', 'important');
                    el.style.setProperty('min-height', '0', 'important');
                    el.style.setProperty('width', 'auto', 'important');
                    el.style.setProperty('max-width', 'none', 'important');
                    el.setAttribute('data-pdn-flat', '1');
                    /* rangées invisibles (visibility: hidden) : ne pas garder leur place sur la ligne */
                    for (const c of el.children) {
                        if (getComputedStyle(c).visibility === 'hidden') {
                            c.style.setProperty('display', 'none', 'important');
                            c.setAttribute('data-pdn-hide', '1');
                        }
                    }
                } else if ((cs.display === 'flex' || cs.display === 'inline-flex') &&
                    (cs.flexWrap === 'wrap' || cs.flexDirection === 'column')) {
                    el.style.setProperty('flex-wrap', 'nowrap', 'important');
                    el.style.setProperty('flex-direction', 'row', 'important');
                    el.style.setProperty('height', 'auto', 'important');
                    el.style.setProperty('max-height', '30px', 'important');
                    el.style.setProperty('width', 'auto', 'important');
                    el.style.setProperty('max-width', 'none', 'important');
                    el.setAttribute('data-pdn-flat', '1');
                }
            });
        } finally {
            /* nos propres changements de style ne doivent pas relancer l'observateur */
            setTimeout(() => { flatBusy = false; }, 0);
        }
    }

    function scheduleFlatten() {
        if (flatBusy || flatRaf) return;
        flatRaf = requestAnimationFrame(flattenPdnBar);
    }

    function initFlatten() {
        const toc = document.getElementById('tool-options-container');
        if (!toc || flatObserver) return;
        flatObserver = new MutationObserver(scheduleFlatten);
        flatObserver.observe(toc, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
        new MutationObserver(scheduleFlatten).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        scheduleFlatten();
    }
    window.illuFlattenPdnBar = scheduleFlatten;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFlatten);
    else setTimeout(initFlatten, 0);

    function paletteVisible(id) {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.classList.contains('illu-floating-window-hidden')) return false;
        return getComputedStyle(el).display !== 'none';
    }

    function sync() {
        document.querySelectorAll('#illu-pdn-win-toggles [data-illu-win]').forEach((b) => {
            b.setAttribute('aria-pressed', paletteVisible(b.dataset.illuWin) ? 'true' : 'false');
        });
        const grid = document.getElementById('illu-tb-grid');
        if (grid) grid.setAttribute('aria-pressed', window._illuShowPixelGrid ? 'true' : 'false');
        const rulers = document.getElementById('illu-tb-rulers');
        if (rulers) rulers.setAttribute('aria-pressed', window._illuShowRulers ? 'true' : 'false');
    }

    /** Ré-synchronise après chaque appel des fonctions existantes (sans les modifier). */
    function wrapAfter(name) {
        const fn = window[name];
        if (typeof fn !== 'function' || fn.__illuPdnWrapped) return;
        const wrapped = function () {
            const r = fn.apply(this, arguments);
            requestAnimationFrame(sync);
            return r;
        };
        wrapped.__illuPdnWrapped = true;
        window[name] = wrapped;
    }

    function isTyping(t) {
        return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
    }

    function onKey(e) {
        // F5–F8 / Alt+X seulement si l'utilisateur a choisi le style Paint.NET (F5 = recharger sinon)
        if (!document.body.classList.contains('illu-toolbar-pdn')) return;
        if (isTyping(e.target)) return;
        if (WIN_KEYS[e.key] && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
            if (typeof window.toggleFloatingPaletteVisibility === 'function') {
                e.preventDefault();
                window.toggleFloatingPaletteVisibility(WIN_KEYS[e.key]);
            }
            return;
        }
        if (e.altKey && !e.ctrlKey && (e.key === 'x' || e.key === 'X') && typeof window.showSettingsDialog === 'function') {
            e.preventDefault();
            window.showSettingsDialog(true);
        }
    }

    function init() {
        ['toggleFloatingPaletteVisibility', 'applyFloatingPaletteVisibility', 'toggleIlluPixelGrid', 'toggleIlluRulers', 'resetWorkspace'].forEach(wrapAfter);
        // toute reconfiguration de disposition repasse par applyUILayoutFromPreference
        const origLayout = window.applyUILayoutFromPreference;
        if (typeof origLayout === 'function' && !origLayout.__illuPdnWrapped) {
            window.applyUILayoutFromPreference = function () {
                const r = origLayout.apply(this, arguments);
                syncLayoutClass();
                if (typeof window.illuApplyToolbarStyleMode === 'function') window.illuApplyToolbarStyleMode();
                return r;
            };
            window.applyUILayoutFromPreference.__illuPdnWrapped = true;
        }
        window.addEventListener('illu-mobile-ui-changed', syncLayoutClass);
        syncLayoutClass();
        if (typeof window.illuApplyToolbarStyleMode === 'function') window.illuApplyToolbarStyleMode();
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', () => requestAnimationFrame(sync));
        sync();
        setTimeout(sync, 1500);
    }

    window.illuPdnChromeSync = sync;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
