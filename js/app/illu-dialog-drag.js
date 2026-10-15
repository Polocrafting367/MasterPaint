/**
 * Déplacement des fenêtres de dialogue.
 *
 * Les boîtes Paramètres, Bienvenue, Nouveau projet, Exporter, Vectoriser,
 * Visionneuse d'icônes… ont l'apparence d'une fenêtre (barre de titre comprise)
 * mais restaient centrées et figées : seules les palettes `.floating-window`
 * étaient déplaçables (js/app/WindowManager.js). Ce module leur donne le même
 * comportement, par délégation — donc y compris pour les dialogues créés plus
 * tard dans la session.
 *
 * Deux détails qui comptent :
 *
 *  • le centrage vient d'un `display:flex` sur la surcouche ; on passe donc la
 *    fenêtre en `position: fixed` avec des coordonnées écran, ce qui la sort du
 *    flux et neutralise le centrage sans toucher à la surcouche ;
 *
 *  • un `position: fixed` se cale sur le premier ancêtre transformé/filtré s'il
 *    en existe un (certains thèmes posent un `backdrop-filter`). Plutôt que de
 *    parier, on écrit les coordonnées puis on mesure et on corrige l'écart :
 *    la fenêtre atterrit au bon endroit quel que soit le bloc conteneur.
 */
(function () {
    'use strict';

    const PAD = 4;
    /* Fenêtres pilotées par d'autres modules : on ne s'en mêle pas. */
    const SKIP_SELECTOR = '.floating-window, .illu-pdn-slot, .illu-crop-panel';

    function draggableWindowFrom(target) {
        if (!target || !target.closest) return null;
        const tb = target.closest('.title-bar');
        if (!tb) return null;
        if (target.closest('button, input, select, textarea, a')) return null;
        const win = tb.closest('.window');
        if (!win || !win.contains(tb)) return null;
        if (win.closest(SKIP_SELECTOR)) return null;
        return win;
    }

    /** Place la fenêtre à (x, y) écran, en corrigeant le bloc conteneur réel. */
    function placeAt(win, x, y) {
        win.style.left = x + 'px';
        win.style.top = y + 'px';
        const r = win.getBoundingClientRect();
        const dx = x - r.left;
        const dy = y - r.top;
        if (dx || dy) {
            win.style.left = x + dx + 'px';
            win.style.top = y + dy + 'px';
        }
    }

    function clampIntoViewport(win) {
        const r = win.getBoundingClientRect();
        let x = r.left;
        let y = r.top;
        const maxX = window.innerWidth - r.width - PAD;
        const maxY = window.innerHeight - r.height - PAD;
        x = Math.min(Math.max(PAD, x), Math.max(PAD, maxX));
        /* Jamais sous la barre de titre : elle doit rester attrapable. */
        y = Math.min(Math.max(PAD, y), Math.max(PAD, maxY));
        if (x !== r.left || y !== r.top) placeAt(win, x, y);
    }

    /** Sort la fenêtre du centrage flex et fige sa position écran actuelle. */
    function detachFromCentering(win) {
        if (win.dataset.illuDialogFree === '1') return;
        const r = win.getBoundingClientRect();
        win.dataset.illuDialogFree = '1';
        win.classList.add('illu-dialog-free');
        win.style.position = 'fixed';
        win.style.margin = '0';
        win.style.inset = 'auto';
        win.style.right = 'auto';
        win.style.bottom = 'auto';
        placeAt(win, r.left, r.top);
    }

    /** Rend la fenêtre à son centrage d'origine (double-clic sur la barre). */
    function recenter(win) {
        delete win.dataset.illuDialogFree;
        win.classList.remove('illu-dialog-free');
        win.style.position = '';
        win.style.margin = '';
        win.style.inset = '';
        win.style.left = '';
        win.style.top = '';
        win.style.right = '';
        win.style.bottom = '';
    }

    function onPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.isPrimary === false) return;
        const win = draggableWindowFrom(e.target);
        if (!win) return;

        detachFromCentering(win);

        const r = win.getBoundingClientRect();
        const grabX = e.clientX - r.left;
        const grabY = e.clientY - r.top;
        const pointerId = e.pointerId;
        const prevTouchAction = win.style.touchAction;
        win.style.touchAction = 'none';
        win.classList.add('dragging');
        try { e.preventDefault(); } catch (err) { /* ignore */ }

        const move = (ev) => {
            if (ev.pointerId != null && ev.pointerId !== pointerId) return;
            placeAt(win, ev.clientX - grabX, ev.clientY - grabY);
            clampIntoViewport(win);
        };
        const end = (ev) => {
            if (ev && ev.pointerId != null && ev.pointerId !== pointerId) return;
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', end);
            document.removeEventListener('pointercancel', end);
            win.style.touchAction = prevTouchAction;
            win.classList.remove('dragging');
            clampIntoViewport(win);
        };
        document.addEventListener('pointermove', move, { passive: false });
        document.addEventListener('pointerup', end);
        document.addEventListener('pointercancel', end);
    }

    function onDoubleClick(e) {
        const win = draggableWindowFrom(e.target);
        if (win && win.dataset.illuDialogFree === '1') recenter(win);
    }

    /* Fenêtre du navigateur redimensionnée : une boîte déplacée peut se
       retrouver hors écran, donc inatteignable. */
    function clampAll() {
        document.querySelectorAll('.window.illu-dialog-free').forEach((win) => {
            if (win.getClientRects().length) clampIntoViewport(win);
        });
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('dblclick', onDoubleClick, true);
    window.addEventListener('resize', clampAll);

    window.IlluDialogDrag = {
        recenter: recenter,
        recenterAll: function () {
            document.querySelectorAll('.window.illu-dialog-free').forEach(recenter);
        },
        clampAll: clampAll
    };
})();
