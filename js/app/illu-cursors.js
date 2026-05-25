/**
 * Curseurs outils — symboles dans icons/illu-sprite.svg (#illu-cursor-*).
 * Poignées sélection : 2 symboles (droite / angle) × 4 rotations = 8 curseurs.
 */
(function () {
    'use strict';

    const SPRITE_ROOT_ID = 'illu-shape-icons-sprite';
    const CURSOR_CENTER = 12;

    const CURSOR_SPECS = {
        crosshair: { symbol: 'illu-cursor-crosshair', hx: 12, hy: 12, fallback: 'crosshair' },
        eyedropper: { symbol: 'illu-cursor-eyedropper', hx: 5, hy: 18, fallback: 'crosshair' },
        move: { symbol: 'illu-cursor-move', hx: 12, hy: 12, fallback: 'move' },
        zoomIn: { symbol: 'illu-cursor-zoom-in', hx: 10, hy: 10, fallback: 'zoom-in' },
        zoomOut: { symbol: 'illu-cursor-zoom-out', hx: 10, hy: 10, fallback: 'zoom-out' },
        pencil: { symbol: 'illu-cursor-pencil', hx: 5, hy: 20, fallback: 'crosshair' },
        pen: { symbol: 'illu-cursor-pen', hx: 6, hy: 19, fallback: 'crosshair' },
        wand: { symbol: 'illu-cursor-wand', hx: 6, hy: 6, fallback: 'crosshair' },
        bucket: { symbol: 'illu-cursor-bucket', hx: 6, hy: 20, fallback: 'cell' },
        eraser: { symbol: 'illu-cursor-eraser', hx: 11, hy: 14, fallback: 'cell' },
        text: { symbol: 'illu-cursor-text', hx: 12, hy: 12, fallback: 'text' },
        pointer: { symbol: 'illu-cursor-pointer', hx: 4, hy: 4, fallback: 'default' },
        copy: { symbol: 'illu-cursor-copy', hx: 7, hy: 7, fallback: 'copy' },
        grab: { symbol: 'illu-cursor-grab', hx: 12, hy: 12, fallback: 'grab' }
    };

    /** n/e/s/w = resize-ns ; nw/ne/se/sw = resize-nwse */
    const RESIZE_HANDLES = [
        { name: 'n-resize', symbol: 'illu-cursor-resize-ns', angle: 0 },
        { name: 'e-resize', symbol: 'illu-cursor-resize-ns', angle: 90 },
        { name: 's-resize', symbol: 'illu-cursor-resize-ns', angle: 180 },
        { name: 'w-resize', symbol: 'illu-cursor-resize-ns', angle: 270 },
        { name: 'nw-resize', symbol: 'illu-cursor-resize-nwse', angle: 0 },
        { name: 'ne-resize', symbol: 'illu-cursor-resize-nwse', angle: 90 },
        { name: 'se-resize', symbol: 'illu-cursor-resize-nwse', angle: 180 },
        { name: 'sw-resize', symbol: 'illu-cursor-resize-nwse', angle: 270 }
    ];

    function svgCursorDataUrl(svg, hotX, hotY, fallback) {
        const enc = encodeURIComponent(svg).replace(/'/g, '%27');
        return `url("data:image/svg+xml,${enc}") ${hotX | 0} ${hotY | 0}, ${fallback || 'default'}`;
    }

    function symbolInnerHtml(symbolEl) {
        if (!symbolEl) return '';
        const parts = symbolEl.querySelectorAll(':scope > *');
        let inner = '';
        parts.forEach((node) => {
            inner += new XMLSerializer().serializeToString(node);
        });
        if (!inner) inner = symbolEl.innerHTML || '';
        return inner;
    }

    function symbolToSvgString(symbolEl) {
        if (!symbolEl) return '';
        const vb = symbolEl.getAttribute('viewBox') || '0 0 24 24';
        return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${vb}">${symbolInnerHtml(symbolEl)}</svg>`;
    }

    function buildRotatedCursor(symbolId, angleDeg, fallback) {
        const root = document.getElementById(SPRITE_ROOT_ID);
        const sym = root && root.querySelector(`#${symbolId}`);
        if (!sym) return fallback;
        const vb = sym.getAttribute('viewBox') || '0 0 24 24';
        const inner = symbolInnerHtml(sym);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${vb}"><g transform="rotate(${angleDeg} ${CURSOR_CENTER} ${CURSOR_CENTER})">${inner}</g></svg>`;
        return svgCursorDataUrl(svg, CURSOR_CENTER, CURSOR_CENTER, fallback);
    }

    function buildCursorsFromSprite() {
        const root = document.getElementById(SPRITE_ROOT_ID);
        const out = {};
        if (!root) return out;
        Object.keys(CURSOR_SPECS).forEach((key) => {
            const spec = CURSOR_SPECS[key];
            const sym = root.querySelector(`#${spec.symbol}`);
            if (!sym) return;
            const svg = symbolToSvgString(sym);
            if (!svg) return;
            out[key] = svgCursorDataUrl(svg, spec.hx, spec.hy, spec.fallback);
        });
        return out;
    }

    function buildResizeCursorsFromSprite() {
        const out = {};
        RESIZE_HANDLES.forEach((h) => {
            out[h.name] = buildRotatedCursor(h.symbol, h.angle, h.name);
        });
        return out;
    }

    function applyIlluCursors() {
        const built = buildCursorsFromSprite();
        const resize = buildResizeCursorsFromSprite();
        window.IlluCursors = Object.assign({}, window.IlluCursors || {}, built);
        window.IlluCursors._resize = resize;
        const tabWrap = document.getElementById('tab-bar-scroll');
        if (tabWrap && tabWrap.dataset.illuTabScrollInit && typeof window.illuGrabCursor === 'function') {
            tabWrap.style.cursor = window.illuGrabCursor();
        }
        if (Object.keys(built).length || Object.keys(resize).length) {
            window.dispatchEvent(new CustomEvent('illuCursorsReady'));
        }
    }

    /** Curseur outil (data URL SVG ou repli CSS). */
    window.illuToolCursor = function (key, fallback) {
        const C = window.IlluCursors;
        if (C && C[key]) return C[key];
        return fallback != null ? fallback : 'default';
    };

    /** Poignée rotation / défilement onglets (main ouverte). */
    window.illuGrabCursor = function () {
        return window.illuToolCursor('grab', 'grab');
    };

    /** Loupe : zoom avant par défaut, zoom arrière si Alt (comme clic outil). */
    window.illuZoomToolCursor = function () {
        return window._illuZoomAltPressed
            ? window.illuToolCursor('zoomOut', 'zoom-out')
            : window.illuToolCursor('zoomIn', 'zoom-in');
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

    /** Curseur poignée sélection (nw-resize, n-resize, move, …). */
    window.illuResizeHandleCursor = function (systemName) {
        if (!systemName) return 'default';
        if (systemName === 'move' && window.IlluCursors && window.IlluCursors.move) {
            return window.IlluCursors.move;
        }
        const r = window.IlluCursors && window.IlluCursors._resize;
        if (r && r[systemName]) return r[systemName];
        return systemName;
    };

    window.IlluCursors = { _resize: {} };
    window.illuRebuildToolCursors = applyIlluCursors;

    document.addEventListener('illuSpriteLoaded', applyIlluCursors);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById(SPRITE_ROOT_ID)) applyIlluCursors();
        });
    } else if (document.getElementById(SPRITE_ROOT_ID)) {
        applyIlluCursors();
    }
})();
