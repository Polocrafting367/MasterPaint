/**
 * Curseurs outils — mots-clés CSS standard uniquement.
 *
 * Les curseurs étaient auparavant fabriqués à partir des symboles `#illu-cursor-*` du
 * sprite, sérialisés en `url("data:image/svg+xml,…")`. C'est ce qui les rendait
 * capricieux : le sprite est chargé par `fetch` après le premier rendu, donc tant qu'il
 * n'était pas arrivé (ou s'il échouait) chaque outil retombait silencieusement sur un
 * curseur différent, et l'apparence changeait en cours de session. On s'en tient
 * désormais aux curseurs du système — disponibles immédiatement et identiques partout.
 *
 * Les valeurs ci-dessous sont exactement les replis qui étaient déjà déclarés pour
 * chaque outil : le comportement attendu ne change pas, il devient seulement constant.
 */
(function () {
    'use strict';

    /** Curseur système par rôle d'outil. */
    const TOOL_CURSORS = {
        crosshair: 'crosshair',
        eyedropper: 'crosshair',
        move: 'move',
        zoomIn: 'zoom-in',
        zoomOut: 'zoom-out',
        pencil: 'crosshair',
        pen: 'crosshair',
        wand: 'crosshair',
        bucket: 'cell',
        eraser: 'cell',
        text: 'text',
        pointer: 'default',
        copy: 'copy',
        grab: 'grab'
    };

    /** Poignées de sélection : les noms système sont déjà les bons curseurs. */
    const RESIZE_CURSORS = {
        'n-resize': 'n-resize',
        'e-resize': 'e-resize',
        's-resize': 's-resize',
        'w-resize': 'w-resize',
        'nw-resize': 'nw-resize',
        'ne-resize': 'ne-resize',
        'se-resize': 'se-resize',
        'sw-resize': 'sw-resize'
    };

    window.IlluCursors = Object.assign({}, TOOL_CURSORS, { _resize: RESIZE_CURSORS });

    /** Curseur outil. `fallback` ne sert plus qu'aux clés inconnues. */
    window.illuToolCursor = function (key, fallback) {
        const v = TOOL_CURSORS[key];
        if (v) return v;
        return fallback != null ? fallback : 'default';
    };

    /** Poignée rotation / défilement onglets (main ouverte). */
    window.illuGrabCursor = function () {
        return 'grab';
    };

    /** Loupe : zoom avant par défaut, zoom arrière si Alt (comme clic outil). */
    window.illuZoomToolCursor = function () {
        return window._illuZoomAltPressed ? 'zoom-out' : 'zoom-in';
    };

    /** Curseur poignée sélection (nw-resize, n-resize, move, …). */
    window.illuResizeHandleCursor = function (systemName) {
        if (!systemName) return 'default';
        if (systemName === 'move') return 'move';
        return RESIZE_CURSORS[systemName] || systemName;
    };

    /* ---- Curseur forcé (pipette d'effet, pioche de couleur SVG, panoramique) -------
     *
     * Ces modes posaient `document.body.style.cursor`, ce qui ne se voyait jamais
     * au-dessus de la toile : `#main-canvas-container` porte son propre curseur en
     * style en ligne, et il l'emporte sur celui hérité de <body>. On passe donc par un
     * attribut sur <html> qu'une règle CSS applique à toute la pile de la toile.
     */
    const FORCED_ATTR = 'data-illu-forced-cursor';

    /** @param {string|null} value curseur CSS à imposer, ou null/'' pour rendre la main. */
    window.illuSetForcedCursor = function (value) {
        const root = document.documentElement;
        if (!root) return;
        if (value) {
            root.setAttribute(FORCED_ATTR, String(value));
            if (document.body) document.body.style.cursor = String(value);
        } else {
            root.removeAttribute(FORCED_ATTR);
            if (document.body) document.body.style.cursor = '';
        }
    };

    window.illuClearForcedCursor = function () {
        window.illuSetForcedCursor(null);
    };

    /** Le curseur imposé est-il actif ? (lu par updateMainCanvasCursor) */
    window.illuForcedCursor = function () {
        const root = document.documentElement;
        return (root && root.getAttribute(FORCED_ATTR)) || '';
    };

    window._illuZoomAltPressed = false;

    function syncZoomAltFromEvent(e) {
        if ((window.activeTool || '') !== 'zoom') {
            if (window._illuZoomAltPressed) {
                window._illuZoomAltPressed = false;
                if (typeof window.updateMainCanvasCursor === 'function') window.updateMainCanvasCursor();
            }
            return;
        }
        const alt = !!(e && e.altKey);
        if (window._illuZoomAltPressed === alt) return;
        window._illuZoomAltPressed = alt;
        if (typeof window.updateMainCanvasCursor === 'function') window.updateMainCanvasCursor();
    }

    document.addEventListener('keydown', syncZoomAltFromEvent);
    document.addEventListener('keyup', syncZoomAltFromEvent);
    document.addEventListener('pointermove', syncZoomAltFromEvent, { passive: true });

    /** Conservé : plus rien à reconstruire, mais des appelants existants s'y réfèrent. */
    window.illuRebuildToolCursors = function () {
        if (typeof window.updateMainCanvasCursor === 'function') window.updateMainCanvasCursor();
    };

    // Les curseurs sont disponibles dès l'exécution de ce fichier : on prévient tout de
    // suite. L'évènement est écouté sur `document` (DrawingTools) ; `window` est gardé
    // pour d'éventuels appelants historiques.
    function announce() {
        document.dispatchEvent(new CustomEvent('illuCursorsReady'));
        window.dispatchEvent(new CustomEvent('illuCursorsReady'));
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', announce);
    } else {
        announce();
    }
})();
