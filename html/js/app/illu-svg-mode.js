/**
 * illu-svg-mode.js — Gestionnaire du mode SVG Pro
 * Pattern identique à PhotoModeManager :
 *  - body.illu-svg-mode-active activé/désactivé selon le projet actif
 *  - Réversible : passage bitmap → SVG → bitmap restaure tout
 */
'use strict';

(function (global) {

    const SVG_CLASS = 'illu-svg-mode-active';

    /* ─── Activation / Désactivation ──────────────────────────────────────── */

    function _isSvgProject() {
        const em = global.EditorManager;
        return !!(em && em.activeProject && em.activeProject.mode === 'vector');
    }

    function activate() {
        if (document.body.classList.contains(SVG_CLASS)) return;
        document.body.classList.add(SVG_CLASS);
        _onActivate();
    }

    function deactivate() {
        if (!document.body.classList.contains(SVG_CLASS)) return;
        document.body.classList.remove(SVG_CLASS);
        _onDeactivate();
    }

    function sync() {
        if (_isSvgProject()) {
            activate();
        } else {
            deactivate();
        }
    }

    /* ─── Callbacks activation/désactivation ─────────────────────────────── */

    function _onActivate() {
        // Menubar SVG
        if (global.illuSvgMenubar && global.illuSvgMenubar.inject) {
            global.illuSvgMenubar.inject();
        }
        // Marquer les menus bitmap pour les masquer
        if (global.illuSvgMenubar && global.illuSvgMenubar.markBitmapMenus) {
            global.illuSvgMenubar.markBitmapMenus();
        }
        // Menu Effets SVG (placeholder)
        if (global.illuSvgMenubar && global.illuSvgMenubar.injectSvgEffectsMenu) {
            global.illuSvgMenubar.injectSvgEffectsMenu();
        }
        // Panneau Objets — show géré par l'événement illu:svg-mode-enter
        document.dispatchEvent(new CustomEvent('illu:svg-mode-enter'));
    }

    function _onDeactivate() {
        // Menubar SVG — retrait
        if (global.illuSvgMenubar && global.illuSvgMenubar.eject) {
            global.illuSvgMenubar.eject();
        }
        // Panneau Objets — masquer géré par l'événement illu:svg-mode-leave
        document.dispatchEvent(new CustomEvent('illu:svg-mode-leave'));
    }

    /* ─── Hook dans EditorManager.applyProjectToUI ───────────────────────── */

    function _hookEditorManager() {
        const em = global.EditorManager;
        if (!em || typeof em.applyProjectToUI !== 'function') return false;

        const _orig = em.applyProjectToUI.bind(em);
        em.applyProjectToUI = function (opts) {
            const result = _orig(opts);
            sync();
            return result;
        };
        return true;
    }

    /* ─── Init ───────────────────────────────────────────────────────────── */

    function init() {
        if (_hookEditorManager()) {
            sync(); // état initial
            return;
        }
        // EditorManager pas encore dispo — attendre
        let tries = 0;
        const iv = setInterval(() => {
            tries++;
            if (_hookEditorManager()) {
                clearInterval(iv);
                sync();
            } else if (tries > 100) {
                clearInterval(iv);
            }
        }, 100);
    }

    // Exposer l'API publique
    global.illuSvgMode = { activate, deactivate, sync, isSvgProject: _isSvgProject };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);
