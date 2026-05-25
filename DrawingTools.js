// Initialisation différée dans initTools()
let container = null;
const workspaceDock = null;

var isDrawing = false;
/** True pendant un glisser « déplacer » lancé depuis sle bouton central Déformation (pas un clic sur la toile). */
window._illuDeformMoveFromButtonActive = false;
/** Bouton DOM utilisé pour setPointerCapture (relâchement = fin du glisser uniquement tant que le pointeur est capturé). */
window._illuDeformMoveFromButtonEl = null;
window._illuDeformMoveFromButtonPointerId = null;
/** Presse-papier local (ImageData du rectangle copié en pixel). */
let ctxClipboard = null;
window.ctxClipboard = null;

function illuReleaseDeformMoveButtonPointerCapture() {
    const el = window._illuDeformMoveFromButtonEl;
    const pid = window._illuDeformMoveFromButtonPointerId;
    if (el && pid != null) {
        try {
            el.releasePointerCapture(pid);
        } catch (err) {
            /* ignore */
        }
    }
    window._illuDeformMoveFromButtonEl = null;
    window._illuDeformMoveFromButtonPointerId = null;
}
window.illuReleaseDeformMoveButtonPointerCapture = illuReleaseDeformMoveButtonPointerCapture;
let isSprayStroke = false;
/** Pinceau / gomme : tracé par tampons (bords adoucis) au lieu d’un seul trait. */
let isStampBrushStroke = false;
let lastStampX = 0;
let lastStampY = 0;
/** Crayon : remplissage pixel (pas de trait vectoriel lissé). */
let isPencilPixelStroke = false;
let lastPencilX = 0;
let lastPencilY = 0;
/** Pinceau / gomme en mode trait : un segment par pas (évite de re-stroker tout le tracé). */
let lastBrushLineX = 0;
let lastBrushLineY = 0;
let startX, startY;

/** Points du dernier coup de crayon (fermeture de polygone). */
let pencilStrokePoints = null;
let illuInteractiveVisualNeedRender = false;
let illuInteractiveVisualNeedSelection = false;
let illuInteractiveVisualRenderOpts = {};
let illuInteractiveVisualRaf = 0;

function illuFlushInteractiveVisualRefresh() {
    if (illuInteractiveVisualNeedRender) {
        if (typeof EditorManager !== 'undefined' && EditorManager.render) {
            EditorManager.render(illuInteractiveVisualRenderOpts);
        }
        illuInteractiveVisualNeedRender = false;
        illuInteractiveVisualRenderOpts = {};
    }
    if (illuInteractiveVisualNeedSelection && typeof window.refreshSelectionVisual === 'function') {
        window.refreshSelectionVisual();
        illuInteractiveVisualNeedSelection = false;
    }
}

/** Poignées / cadre : délégué à SelectionChrome (overlay ≠ composite calques). */
function scheduleSelectionChromeRefresh(extra) {
    if (window.SelectionChrome && typeof window.SelectionChrome.scheduleInteractive === 'function') {
        const o = extra || {};
        window.SelectionChrome.scheduleInteractive({
            forceFullOverlay: !!o.forceFullSelectionOverlay,
            forceDrawUI: !!o.forceDrawUI,
            loupeEvent: o.loupeEvent,
            loupeAnchorDoc: o.loupeAnchorDoc,
            lassoPoints: o.lassoPoints
        });
    }
}

function canUseSelectionOverlayFast() {
    return window.SelectionChrome ? window.SelectionChrome.canUseRectFast() : false;
}


let illuInteractiveVisualLastTime = 0;
function illuScheduleInteractiveVisualRefresh(opts) {
    const o = opts || {};
    if (o.render) illuInteractiveVisualNeedRender = true;
    if (o.selection) illuInteractiveVisualNeedSelection = true;
    if (o.renderOpts) Object.assign(illuInteractiveVisualRenderOpts, o.renderOpts);
    
    if (illuInteractiveVisualRaf) return;

    const now = performance.now();
    const floatImport =
        typeof EditorManager !== 'undefined' &&
        EditorManager.activeLayer &&
        EditorManager.activeLayer.importPlacementPending;
    const threshold = floatImport ? 200 : 16; 
    if (now - illuInteractiveVisualLastTime < threshold) {
        illuInteractiveVisualRaf = setTimeout(() => {
            illuInteractiveVisualRaf = 0;
            illuScheduleInteractiveVisualRefresh(opts);
        }, threshold - (now - illuInteractiveVisualLastTime));
        return;
    }
    illuInteractiveVisualLastTime = now;

    illuInteractiveVisualRaf = requestAnimationFrame(() => {
        illuInteractiveVisualRaf = 0;
        illuFlushInteractiveVisualRefresh();
    });
}
window.illuScheduleInteractiveVisualRefresh = illuScheduleInteractiveVisualRefresh;

function clampRoundRectCornerRadius(userPx, w, h) {
    const u = userPx != null && Number.isFinite(Number(userPx)) ? Number(userPx) : 12;
    const cap =
        typeof window.illuShapeCornerRadiusMax === 'function' ? window.illuShapeCornerRadiusMax() : 256;
    const r = Math.max(0, Math.min(cap, u));
    return Math.min(r, w / 2, h / 2);
}

function illuClamp01(v) {
    return Math.max(0, Math.min(1, v));
}

/** Triangle : sommet réglable (adj = X, vf = Y dans la bbox) ; deux poignées sur les côtés gauche/droit. */
function illuTriangleReadState(shape) {
    let x = parseFloat(shape.getAttribute('data-illu-bbox-x'));
    let y = parseFloat(shape.getAttribute('data-illu-bbox-y'));
    let w = parseFloat(shape.getAttribute('data-illu-bbox-w'));
    let h = parseFloat(shape.getAttribute('data-illu-bbox-h'));
    let adj = parseFloat(shape.getAttribute('data-illu-triangle-adj'));
    let vf = parseFloat(shape.getAttribute('data-illu-triangle-vf'));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
        const pp = parseIlluPolygonPoints(shape.getAttribute('points') || '');
        if (pp.length >= 3) {
            const xs = pp.map((p) => p[0]);
            const ys = pp.map((p) => p[1]);
            x = Math.min(...xs);
            y = Math.min(...ys);
            w = Math.max(...xs) - x;
            h = Math.max(...ys) - y;
            const apex = pp.reduce((best, p) => (p[1] < best[1] ? p : best), pp[0]);
            adj = w > 0 ? (apex[0] - x) / w : 0.5;
            vf = h > 0 ? (apex[1] - y) / h : 0;
        } else {
            x = 0;
            y = 0;
            w = 10;
            h = 10;
            adj = 0.5;
            vf = 0;
        }
    }
    if (!Number.isFinite(adj)) adj = 0.5;
    if (!Number.isFinite(vf)) vf = 0;
    return {
        x,
        y,
        w: Math.max(2, w),
        h: Math.max(2, h),
        adj: illuClamp01(adj),
        vf: illuClamp01(Math.min(vf, 0.92))
    };
}

function illuTriangleWritePoints(shape, x, y, w, h, adj, vf) {
    w = Math.max(2, w);
    h = Math.max(2, h);
    adj = illuClamp01(adj);
    vf = illuClamp01(vf != null && Number.isFinite(vf) ? Math.min(vf, 0.92) : 0);
    const ax = x + w * adj;
    const ay = y + h * vf;
    shape.setAttribute('points', `${ax},${ay} ${x},${y + h} ${x + w},${y + h}`);
    shape.setAttribute('data-illu-triangle', '1');
    shape.setAttribute('data-illu-bbox-x', String(x));
    shape.setAttribute('data-illu-bbox-y', String(y));
    shape.setAttribute('data-illu-bbox-w', String(w));
    shape.setAttribute('data-illu-bbox-h', String(h));
    shape.setAttribute('data-illu-triangle-adj', String(adj));
    shape.setAttribute('data-illu-triangle-vf', String(vf));
}

/** Poignée jaune sur un côté du triangle (l = angle gauche / adj, r = angle droit / vf). */
function illuTriangleAdjustHandleLocal(st, side) {
    const vf = st.vf != null ? st.vf : 0;
    const ax = st.x + st.w * st.adj;
    const apex = { x: ax, y: st.y + st.h * vf };
    const t = 0.28;
    if (side === 'r') {
        const baseRight = { x: st.x + st.w, y: st.y + st.h };
        return {
            x: apex.x + (baseRight.x - apex.x) * t,
            y: apex.y + (baseRight.y - apex.y) * t
        };
    }
    const baseLeft = { x: st.x, y: st.y + st.h };
    return {
        x: apex.x + (baseLeft.x - apex.x) * t,
        y: apex.y + (baseLeft.y - apex.y) * t
    };
}

function illuRoundRectAdjustHandleLocal(x, y, w, h, rx) {
    let r = rx != null && Number.isFinite(rx) ? rx : 0;
    if (r < 0.5) r = Math.min(12, w / 4, h / 4);
    return { x: x + r, y: y + r * 0.35 };
}

function illuRoundRectRadiusFromLocalDrag(x, y, w, h, lx, ly) {
    return Math.max(0, Math.round(Math.min(Math.max(0, lx - x), Math.max(0, ly - y), w / 2, h / 2)));
}

function illuUpdateVectorAdjustFromPointer(shape, adjustType, docPos) {
    if (!shape) return;
    const lp = vectorDocToShapeAttrPoint(shape, docPos.x, docPos.y);
    if (adjustType === 'triangle-adj' || adjustType === 'triangle-adj-l') {
        const st = illuTriangleReadState(shape);
        const adj = st.w > 0 ? illuClamp01((lp.x - st.x) / st.w) : 0.5;
        illuTriangleWritePoints(shape, st.x, st.y, st.w, st.h, adj, st.vf);
        if (shape.getAttribute('data-vgrad')) {
            syncVectorGradientOnShape(shape, 'rect', st.x, st.y, st.x + st.w, st.y + st.h);
        }
        return;
    }
    if (adjustType === 'triangle-adj-r') {
        const st = illuTriangleReadState(shape);
        const vf = st.h > 0 ? illuClamp01(Math.min(0.92, (lp.y - st.y) / st.h)) : 0;
        illuTriangleWritePoints(shape, st.x, st.y, st.w, st.h, st.adj, vf);
        if (shape.getAttribute('data-vgrad')) {
            syncVectorGradientOnShape(shape, 'rect', st.x, st.y, st.x + st.w, st.y + st.h);
        }
        return;
    }
    if (adjustType === 'round-adj') {
        const x = parseFloat(shape.getAttribute('x')) || 0;
        const y = parseFloat(shape.getAttribute('y')) || 0;
        const w = parseFloat(shape.getAttribute('width')) || 0;
        const h = parseFloat(shape.getAttribute('height')) || 0;
        const r = illuRoundRectRadiusFromLocalDrag(x, y, w, h, lp.x, lp.y);
        if (r > 0.5) {
            shape.setAttribute('rx', String(r));
            shape.setAttribute('ry', String(r));
        } else {
            shape.removeAttribute('rx');
            shape.removeAttribute('ry');
        }
        EditorManager.toolProps.shapeCornerRadius = r;
        const sc = document.getElementById('tool-shape-corner-radius');
        const scv = document.getElementById('tool-shape-corner-radius-val');
        const crCap =
            typeof window.illuClampShapeCornerRadius === 'function'
                ? window.illuClampShapeCornerRadius(r)
                : Math.max(0, Math.min(256, r));
        if (sc) sc.value = String(crCap);
        if (scv) scv.textContent = String(crCap);
        if (shape.getAttribute('data-vgrad')) {
            syncVectorGradientOnShape(shape, 'rect', x, y, x + w, y + h);
        }
    }
}

window.illuTriangleWritePoints = illuTriangleWritePoints;
window.illuTriangleReadState = illuTriangleReadState;
window.illuTriangleAdjustHandleLocal = illuTriangleAdjustHandleLocal;
window.illuRoundRectAdjustHandleLocal = illuRoundRectAdjustHandleLocal;
window.illuRoundRectRadiusFromLocalDrag = illuRoundRectRadiusFromLocalDrag;
window.clampRoundRectCornerRadius = clampRoundRectCornerRadius;

function illuVectorShapeSupportsRotation(shape) {
    if (!shape) return false;
    const tag = (shape.tagName || '').toLowerCase();
    if (tag === 'rect') return true;
    if (tag === 'polygon' && shape.getAttribute('data-illu-triangle') === '1') return true;
    return false;
}

function illuVectorToolsAllowShapeRotation() {
    const t = window.activeTool || '';
    return t === 'select' || t === 'move' || t === 'direct-select';
}

function illuVectorShapeLocalBbox(shape) {
    const tag = (shape.tagName || '').toLowerCase();
    if (tag === 'rect') {
        return {
            x: parseFloat(shape.getAttribute('x')) || 0,
            y: parseFloat(shape.getAttribute('y')) || 0,
            w: parseFloat(shape.getAttribute('width')) || 0,
            h: parseFloat(shape.getAttribute('height')) || 0
        };
    }
    if (tag === 'polygon' && shape.getAttribute('data-illu-triangle') === '1') {
        const st = illuTriangleReadState(shape);
        return { x: st.x, y: st.y, w: st.w, h: st.h };
    }
    return null;
}

function illuVectorShapePivotLocal(shape) {
    const b = illuVectorShapeLocalBbox(shape);
    if (!b) return null;
    return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, w: b.w, h: b.h };
}

function illuVectorRotationHandleLocal(shape) {
    const sb = illuVectorShapeLocalBbox(shape);
    if (!sb) return null;
    const ang = parseFloat(shape.getAttribute('data-illu-rotation-rad')) || 0;
    const z = EditorManager.getCanvasZoomLevel() || 1;
    const pad = 22 / z;
    const cx = sb.x + sb.w / 2;
    const cy = sb.y + sb.h / 2;
    const topMidRot = {
        x: cx + (sb.h / 2) * Math.sin(ang),
        y: cy - (sb.h / 2) * Math.cos(ang)
    };
    return {
        x: topMidRot.x + pad * Math.sin(ang),
        y: topMidRot.y - pad * Math.cos(ang)
    };
}

function illuWriteVectorShapeRotation(shape, angleRad) {
    const pivot = illuVectorShapePivotLocal(shape);
    if (!pivot) return;
    const deg = (angleRad * 180) / Math.PI;
    shape.setAttribute('data-illu-rotation-rad', String(angleRad));
    shape.setAttribute('transform', `rotate(${deg} ${pivot.cx} ${pivot.cy})`);
}

function createSvgRotationHandle(rootX, rootY) {
    const z = EditorManager.getCanvasZoomLevel() || 1;
    const rotR = EditorManager.svgUiRotationHandleRadiusDoc();
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', String(rootX));
    c.setAttribute('cy', String(rootY));
    c.setAttribute('r', String(rotR));
    c.setAttribute('fill', '#aecbfa');
    c.setAttribute('stroke', '#000000');
    c.setAttribute('stroke-width', String(1 / z));
    c.setAttribute('class', 'svg-rotation-handle');
    c.setAttribute('pointer-events', 'all');
    c.style.cursor = typeof window.illuGrabCursor === 'function' ? window.illuGrabCursor() : 'grab';
    c.dataset.vectorRotHandle = '1';
    return c;
}

function appendVectorRotationHandle(svgUI, shape) {
    if (!illuVectorShapeSupportsRotation(shape) || !illuVectorToolsAllowShapeRotation()) return;
    const local = illuVectorRotationHandleLocal(shape);
    if (!local) return;
    const r = vectorShapeAttrPointToRoot(shape, local.x, local.y);
    svgUI.appendChild(createSvgRotationHandle(r.x, r.y));
}

function syncVectorRotationHandlePosition(anchorsG, shape) {
    if (!anchorsG || !shape) return;
    const el = anchorsG.querySelector('.svg-rotation-handle');
    if (!el) return;
    const local = illuVectorRotationHandleLocal(shape);
    if (!local) return;
    const r = vectorShapeAttrPointToRoot(shape, local.x, local.y);
    const rotR = EditorManager.svgUiRotationHandleRadiusDoc();
    el.setAttribute('cx', String(r.x));
    el.setAttribute('cy', String(r.y));
    el.setAttribute('r', String(rotR));
}

/** Brouillon vecteur : applique le rayon des coins de la barre d’options au <rect data-illu-round> en cours. */
window.applyVectorRoundRectRadiusFromToolProps = function () {
    if (EditorManager.mode !== 'vector' || !currentElement) return;
    const el = currentElement;
    if ((el.tagName || '').toLowerCase() !== 'rect' || el.getAttribute('data-illu-round') !== '1') return;
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    if (w < 1e-6 || h < 1e-6) return;
    const want = EditorManager.toolProps.shapeCornerRadius ?? 12;
    const rr = clampRoundRectCornerRadius(want, w, h);
    if (rr > 0.5) {
        const rInt = Math.max(1, Math.round(rr));
        el.setAttribute('rx', String(rInt));
        el.setAttribute('ry', String(rInt));
    } else {
        el.removeAttribute('rx');
        el.removeAttribute('ry');
    }
    EditorManager.render();
};
let currentElement = null; // For vector mode

/** Désactivés en mode vecteur (réservés au bitmap / sélection pixel). */
const TOOL_PIXEL_ONLY = new Set(['wand', 'warp-4', 'deform', 'pencil', 'eraser']);

function isPixelWarpOrDeformTool() {
    const t = window.activeTool;
    return t === 'warp-4' || t === 'deform';
}
/** Désactivés en mode pixel (réservés au dessin / effets SVG). */
const TOOL_VECTOR_ONLY = new Set(['shadow']);
/** Boutons placeholder (aucun pour l’instant). */
const TOOL_PLANNED_IDS = new Set([]);

const TOOL_OPTIONS_UI = {
    select: { label: 'Sélection', actionGroups: [], paramGroups: [] },
    move: { label: 'Déplacer', actionGroups: [], paramGroups: [] },
    wand: { label: 'Baguette', actionGroups: [], paramGroups: ['opt-grp-wand-params'] },
    eyedropper: { label: 'Pipette', actionGroups: [], paramGroups: ['opt-grp-eyedropper-params'] },
    brush: {
        label: 'Pinceau',
        actionGroups: ['opt-grp-brush-actions'],
        paramGroups: ['opt-grp-size-params', 'opt-grp-brush-hardness']
    },
    pencil: { label: 'Crayon', actionGroups: [], paramGroups: ['opt-grp-size-params'] },
    eraser: {
        label: 'Gomme',
        actionGroups: ['opt-grp-brush-actions'],
        paramGroups: ['opt-grp-size-params', 'opt-grp-brush-hardness']
    },
    gradient: { label: 'Dégradé', actionGroups: ['opt-grp-gradient-actions'], paramGroups: [] },
    rect: { label: 'Rectangle', actionGroups: ['opt-grp-shapes-actions'], paramGroups: ['opt-grp-size-params', 'opt-grp-shapes-params'] },
    circle: { label: 'Ellipse', actionGroups: ['opt-grp-shapes-actions'], paramGroups: ['opt-grp-size-params', 'opt-grp-shapes-params'] },
    line: { label: 'Ligne', actionGroups: ['opt-grp-line-endpoints'], paramGroups: ['opt-grp-size-params'] },
    fill: { label: 'Pot de peinture', actionGroups: [], paramGroups: ['opt-grp-fill-params'] },
    zoom: { label: 'Loupe', actionGroups: [], paramGroups: [] },
    text: { label: 'Texte', actionGroups: ['opt-grp-text-actions'], paramGroups: ['opt-grp-text-params'] },
    'direct-select': { label: 'Sélection à la volée', actionGroups: [], paramGroups: [] },
    deform: { label: 'Déformation', actionGroups: [], paramGroups: ['opt-grp-warp-params'] },
    'warp-4': { label: 'Déformation 4 coins', actionGroups: [], paramGroups: ['opt-grp-warp-params'] },
    'cubic-3': { label: 'Courbe (3 clics, Q)', actionGroups: ['opt-grp-line-endpoints'], paramGroups: ['opt-grp-size-params'] },
    'pen': { label: 'Plume', actionGroups: ['opt-grp-shapes-actions'], paramGroups: ['opt-grp-size-params'] },
    'polygon': { label: 'Polygone', actionGroups: ['opt-grp-shapes-actions'], paramGroups: ['opt-grp-size-params'] },
    'round-3': { label: 'Rectangle à coins arrondis', actionGroups: ['opt-grp-shapes-actions'], paramGroups: ['opt-grp-size-params', 'opt-grp-shapes-params'] },
    triangle: { label: 'Triangle', actionGroups: ['opt-grp-shapes-actions'], paramGroups: ['opt-grp-size-params', 'opt-grp-shapes-params'] },
    shadow: { label: 'Ombre portée', actionGroups: [], paramGroups: [] }
};

window.TOOL_OPTIONS_UI = TOOL_OPTIONS_UI;

/** RAL Classic (approx. sRGB) : [numéro, r, g, b] — voisin le plus proche pour la pipette. */
const ILLU_RAL_CLASSIC = [
    [1000, 205, 186, 136], [1001, 208, 176, 132], [1002, 210, 170, 109], [1003, 249, 218, 108],
    [1004, 228, 183, 72], [1005, 228, 183, 23], [1006, 237, 185, 11], [1007, 221, 175, 39],
    [1011, 232, 227, 201], [1012, 221, 210, 152], [1013, 227, 218, 197], [1014, 221, 196, 154],
    [1015, 230, 210, 181], [1016, 237, 222, 139], [1017, 247, 173, 99], [1018, 250, 202, 48],
    [1019, 164, 143, 122], [1020, 160, 143, 101], [1021, 246, 182, 0], [1023, 247, 181, 0],
    [1024, 186, 143, 76], [1027, 145, 95, 49], [1028, 128, 100, 31], [1032, 226, 163, 0],
    [1033, 250, 163, 26], [1034, 225, 144, 49], [1035, 143, 131, 112], [1036, 128, 107, 42],
    [1037, 246, 120, 40], [2000, 218, 110, 41], [2001, 186, 72, 27], [2002, 191, 64, 29],
    [2003, 250, 121, 33], [2004, 226, 97, 65], [2005, 255, 83, 0], [2007, 255, 117, 20],
    [2008, 237, 95, 28], [2009, 208, 84, 40], [2010, 209, 92, 49], [2011, 226, 110, 14],
    [2012, 213, 101, 77], [2013, 146, 62, 37], [3000, 167, 41, 32], [3001, 155, 36, 35],
    [3002, 155, 35, 33], [3003, 134, 26, 34], [3004, 107, 28, 35], [3005, 89, 25, 31],
    [3007, 62, 32, 30], [3009, 89, 37, 30], [3011, 120, 31, 25], [3012, 196, 159, 152],
    [3013, 151, 85, 84], [3014, 203, 115, 117], [3015, 216, 160, 166], [3016, 166, 61, 47],
    [3017, 203, 85, 93], [3018, 199, 63, 74], [3020, 187, 30, 16], [3022, 207, 105, 110],
    [3024, 255, 45, 33], [3026, 255, 42, 27], [3027, 171, 39, 79], [3028, 204, 44, 43],
    [3031, 166, 52, 55], [4001, 129, 97, 131], [4002, 141, 60, 75], [4003, 196, 98, 140],
    [4004, 101, 73, 122], [4005, 118, 106, 154], [4006, 144, 108, 152], [4007, 71, 36, 96],
    [4008, 132, 76, 130], [4009, 157, 134, 146], [4010, 203, 115, 172], [4011, 140, 133, 153],
    [4012, 176, 165, 177], [5000, 49, 79, 111], [5001, 15, 76, 129], [5002, 0, 56, 123],
    [5003, 31, 56, 85], [5004, 25, 30, 40], [5005, 16, 44, 84], [5007, 61, 85, 104],
    [5008, 38, 58, 91], [5009, 36, 93, 110], [5010, 0, 79, 124], [5011, 26, 43, 60],
    [5012, 0, 137, 182], [5013, 25, 77, 121], [5014, 18, 104, 179], [5015, 0, 94, 131],
    [5017, 0, 91, 140], [5018, 0, 131, 136], [5019, 0, 65, 75], [5020, 0, 117, 114],
    [5021, 0, 111, 122], [5022, 34, 45, 90], [5023, 78, 100, 114], [5024, 47, 79, 94],
    [6000, 60, 116, 96], [6001, 54, 103, 53], [6002, 50, 89, 40], [6003, 80, 83, 60],
    [6004, 3, 85, 48], [6005, 17, 66, 50], [6006, 52, 95, 70], [6007, 57, 99, 53],
    [6008, 54, 103, 45], [6009, 48, 89, 42], [6010, 56, 116, 43], [6011, 108, 124, 89],
    [6012, 70, 88, 88], [6013, 73, 92, 55], [6014, 70, 76, 53], [6015, 61, 61, 54],
    [6016, 47, 140, 51], [6017, 0, 132, 94], [6018, 87, 166, 57], [6019, 189, 236, 79],
    [6020, 47, 76, 38], [6021, 137, 172, 118], [6022, 55, 66, 47], [6024, 0, 131, 81],
    [6025, 88, 110, 62], [6026, 1, 93, 82], [6027, 49, 84, 66], [6028, 40, 114, 84],
    [6029, 0, 117, 94], [6032, 7, 139, 41], [6033, 73, 135, 115], [6034, 64, 160, 112],
    [6035, 7, 139, 48], [6036, 0, 89, 79], [6037, 0, 139, 41], [6038, 0, 181, 26],
    [7000, 122, 136, 142], [7001, 140, 151, 156], [7002, 129, 137, 127], [7003, 122, 123, 122],
    [7004, 155, 155, 155], [7005, 108, 110, 107], [7006, 118, 117, 112], [7008, 116, 108, 79],
    [7009, 93, 96, 88], [7010, 88, 92, 86], [7011, 82, 89, 93], [7012, 87, 93, 94],
    [7013, 87, 90, 91], [7015, 79, 83, 88], [7016, 82, 89, 93], [7021, 47, 50, 52],
    [7022, 76, 81, 86], [7023, 128, 128, 118], [7024, 105, 102, 100], [7026, 55, 67, 69],
    [7030, 152, 147, 132], [7031, 91, 104, 105], [7032, 181, 176, 156], [7033, 125, 132, 113],
    [7034, 143, 135, 124], [7035, 215, 215, 191], [7036, 151, 147, 146], [7037, 125, 127, 120],
    [7038, 195, 195, 180], [7039, 108, 105, 96], [7040, 152, 158, 161], [7042, 143, 148, 150],
    [7043, 79, 82, 80], [7044, 202, 196, 176], [7045, 132, 135, 137], [7046, 100, 102, 103],
    [7047, 129, 133, 133], [7048, 144, 144, 144], [8000, 130, 108, 71], [8001, 149, 95, 53],
    [8002, 108, 59, 36], [8003, 94, 58, 34], [8004, 141, 73, 49], [8007, 112, 69, 42],
    [8008, 114, 74, 37], [8011, 90, 56, 38], [8012, 102, 51, 43], [8014, 74, 53, 38],
    [8015, 94, 47, 43], [8016, 76, 43, 32], [8017, 68, 47, 41], [8019, 61, 54, 53],
    [8022, 26, 23, 24], [8023, 164, 87, 41], [8024, 121, 80, 56], [8025, 117, 88, 71],
    [8028, 41, 27, 20], [8029, 255, 111, 0], [9001, 233, 224, 210], [9002, 215, 213, 203],
    [9003, 236, 236, 231], [9004, 43, 43, 44], [9005, 14, 14, 16], [9006, 241, 236, 225],
    [9007, 56, 62, 66], [9010, 241, 236, 225], [9011, 39, 41, 43], [9016, 241, 242, 236],
    [9017, 42, 41, 42], [9018, 215, 215, 192]
];

function illuRgbToNearestRal(r, g, b) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < ILLU_RAL_CLASSIC.length; i++) {
        const e = ILLU_RAL_CLASSIC[i];
        const dr = r - e[1];
        const dg = g - e[2];
        const db = b - e[3];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
            bestD = d;
            best = e;
        }
    }
    return best ? { code: best[0], r: best[1], g: best[2], b: best[3] } : null;
}

/** Met à jour le panneau couleur de la pipette (barre d’options). */
window.illuRefreshEyedropperColorPanel = function () {
    const grp = document.getElementById('opt-grp-eyedropper-params');
    if (!grp || grp.hidden || typeof EditorManager === 'undefined') return;
    const col =
        EditorManager.activeColorTarget === 'primary' ? EditorManager.primaryColor : EditorManager.secondaryColor;
    const r = col.r | 0;
    const g = col.g | 0;
    const b = col.b | 0;
    const a = col.a != null ? col.a : 255;
    const hex =
        typeof EditorManager.rgbToHex === 'function'
            ? EditorManager.rgbToHex(r, g, b).toUpperCase()
            : '#' +
              [r, g, b]
                  .map((v) => v.toString(16).padStart(2, '0'))
                  .join('')
                  .toUpperCase();
    const swatch = document.getElementById('eyedropper-swatch');
    const hexEl = document.getElementById('eyedropper-hex');
    const rgbEl = document.getElementById('eyedropper-rgb');
    const ralEl = document.getElementById('eyedropper-ral');
    if (swatch) {
        swatch.style.backgroundColor = `rgba(${r},${g},${b},${a / 255})`;
    }
    if (hexEl) hexEl.textContent = hex;
    if (rgbEl) rgbEl.textContent = `${r} · ${g} · ${b}`;
    if (ralEl) {
        const ral = illuRgbToNearestRal(r, g, b);
        ralEl.textContent = ral ? `RAL ${ral.code}` : '—';
        ralEl.title = ral
            ? `RAL ${ral.code} (approx., RGB ${ral.r}, ${ral.g}, ${ral.b})`
            : '';
    }
};

/** Clic sur chrome UI : ne pas démarrer tracé / texte / courbe sur le canevas. */
function shouldIgnoreMouseDownOnChrome(ev) {
    const t = ev.target;
    if (!t || !t.closest) return false;
    if (t.closest('#tool-options-container') || t.closest('.tool-options-bar')) return true;
    if (t.closest('#tool-context-bar')) return true;
    if (t.closest('#win-colors') && t.closest('.window-body')) return true;
    if (t.closest('#palette-dock-rail')) return true;
    return false;
}

/** Relâcher sur la barre d’options ou le corps de la palette couleurs ne termine pas le tracé / la forme en cours. */
function shouldIgnoreMouseUpOnChrome(ev) {
    const t = ev.target;
    if (!t || !t.closest) return false;
    if (t.closest('.palette-panel .title-bar') || t.closest('.window .title-bar-controls')) return false;
    if (t.closest('.tool-options-bar')) return true;
    if (t.closest('#win-colors') && t.closest('.window-body')) return true;
    return false;
}

function isRectSelectionTool() {
    return window.activeTool === 'select';
}

function isLassoSelectionTool() {
    return EditorManager.isPixelMode && window.activeTool === 'direct-select';
}

function readPixelHandleAttr(e) {
    let el = e && e.target;
    while (el && el !== document) {
        if (typeof el.getAttribute === 'function') {
            const a = el.getAttribute('data-pixel-handle');
            if (a) return a;
        }
        el = el.parentElement;
    }
    return null;
}

/** Résolution locale — ne pas nommer illuToolCursor (conflit avec window.illuToolCursor). */
function illuResolveToolCursor(key, fallback) {
    const C = window.IlluCursors;
    if (C && C[key]) return C[key];
    return fallback != null ? fallback : 'default';
}

window.updateMainCanvasCursor = function () {
    const el = document.getElementById('main-canvas-container');
    if (!el) return;
    if (typeof EditorManager === 'undefined' || !EditorManager.activeProject) {
        el.style.cursor = '';
        return;
    }
    const cross = illuResolveToolCursor('crosshair', 'crosshair');
    const ptr = illuResolveToolCursor('pointer', 'default');
    if (!EditorManager.isPixelMode) {
        const vt = window.activeTool || 'select';
        if (vt === 'eyedropper') el.style.cursor = illuResolveToolCursor('eyedropper', 'crosshair');
        else if (vt === 'fill') el.style.cursor = illuResolveToolCursor('bucket', 'cell');
        else if (vt === 'shadow') el.style.cursor = illuResolveToolCursor('copy', 'copy');
        else if (vt === 'pen' || vt === 'polygon') el.style.cursor = illuResolveToolCursor('pen', 'crosshair');
        else if (vt === 'cubic-3') el.style.cursor = cross;
        else if (vt === 'direct-select') el.style.cursor = ptr;
        else if (vt === 'pencil' || vt === 'brush') el.style.cursor = illuResolveToolCursor('pencil', 'crosshair');
        else if (vt === 'text') el.style.cursor = illuResolveToolCursor('text', 'text');
        else if (['rect', 'circle', 'line', 'round-3', 'triangle'].includes(vt)) {
            el.style.cursor = cross;
        } else el.style.cursor = ptr;
        return;
    }
    const t = window.activeTool || 'select';
    if (t !== 'zoom') window._illuZoomAltPressed = false;
    const map = {
        eyedropper: illuResolveToolCursor('eyedropper', 'crosshair'),
        move:
            illuToolCanCreateSelectionByRectDrag() && illuNoUsableSelectionForDeformNewRect()
                ? cross
                : illuResolveToolCursor('move', 'move'),
        zoom: typeof window.illuZoomToolCursor === 'function' ? window.illuZoomToolCursor() : illuResolveToolCursor('zoomIn', 'zoom-in'),
        brush: illuResolveToolCursor('pencil', 'crosshair'),
        pencil: illuResolveToolCursor('pencil', 'crosshair'),
        eraser: illuResolveToolCursor('eraser', 'cell'),
        fill: illuResolveToolCursor('bucket', 'cell'),
        wand: illuResolveToolCursor('wand', 'crosshair'),
        text: illuResolveToolCursor('text', 'text'),
        gradient: cross,
        select: cross,
        'direct-select': cross,
        deform: cross,
        'warp-4': cross,
        rect: cross,
        circle: cross,
        line: cross,
        'cubic-3': cross,
        pen: illuResolveToolCursor('pen', 'crosshair'),
        polygon: illuResolveToolCursor('pen', 'crosshair'),
        'round-3': cross,
        triangle: cross
    };
    el.style.cursor = map[t] || ptr;
};

document.addEventListener('illuCursorsReady', () => {
    if (typeof window.updateMainCanvasCursor === 'function') window.updateMainCanvasCursor();
});

let selectionWarpLastThrottledTime = 0;
let selectionWarpThrottleTimeout = null;



window.updateToolOptionsBar = function () {
    const t = window.activeTool || 'select';
    const cfg = TOOL_OPTIONS_UI[t] || { label: t, actionGroups: [], paramGroups: [] };
    const isOffice =
        typeof window.illuIsRibbonToolbarActive === 'function' && window.illuIsRibbonToolbarActive();
    const nameEl = document.getElementById('opt-tool-name');
    const iconEl = document.getElementById('tool-icon-preview');

    if (nameEl) {
        let toolLabel = cfg.label;
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const key = 'tool.' + t;
            const tr = window.IlluI18n.t(key);
            if (tr !== key) toolLabel = tr;
        }
        nameEl.textContent = toolLabel;
    }

    if (iconEl) {
        const btn = document.getElementById('tool-' + t);
        const icon = btn && btn.querySelector('i, svg.tool-icon, svg.illu-shape-ico, svg');
        if (icon) {
            iconEl.innerHTML = icon.cloneNode(true).outerHTML;
            iconEl.removeAttribute('aria-hidden');
        } else {
            iconEl.innerHTML = '';
            iconEl.setAttribute('aria-hidden', 'true');
        }
    }

    // Hide all option groups in both bars
    document.querySelectorAll('.tool-options-bar .opt-grp').forEach((el) => {
        el.hidden = true;
    });

    const mobileShell =
        typeof window.illuIsMobileShellLayout === 'function' && window.illuIsMobileShellLayout();

    // Show action groups (Bar 1)
    if (cfg.actionGroups) {
        cfg.actionGroups.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.hidden = false;
        });
    }

    const SELECT_ACTION_TOOLS = new Set(['select', 'move', 'wand', 'direct-select', 'deform', 'warp-4']);
    const selActsPin = document.getElementById('tool-pinned-select-actions');
    if (selActsPin) selActsPin.hidden = !SELECT_ACTION_TOOLS.has(t);

    const hasSel =
        typeof window.hasActivePixelSelection === 'function' && window.hasActivePixelSelection();
    const canCenter =
        typeof EditorManager.canCenterSelectionLayout === 'function' &&
        EditorManager.canCenterSelectionLayout();
    document.querySelectorAll('.illu-sel-center-item').forEach((el) => {
        el.hidden = !canCenter;
        el.setAttribute('aria-hidden', canCenter ? 'false' : 'true');
    });
    document.querySelectorAll('.illu-sel-layout-item:not(.illu-sel-center-item) .illu-icon-toggle').forEach((btn) => {
        btn.disabled = !hasSel;
        btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false');
    });
    document.querySelectorAll('.illu-sel-nudge-item').forEach((el) => {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.illu-sel-nudge-item .illu-icon-toggle').forEach((btn) => {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.tabIndex = -1;
    });

    // Show param groups (Bar 2)
    let hasParams = false;
    if (cfg.paramGroups) {
        cfg.paramGroups.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.hidden = false;
                hasParams = true;
            }
        });
    }

    const bar2 = document.getElementById('tool-options-bar-2');

    const pinnedToggles = document.getElementById('tool-pinned-toggles');
    if (pinnedToggles) pinnedToggles.hidden = false;
    const modeGroup = document.getElementById('selection-mode-group');
    if (modeGroup) {
        modeGroup.hidden = !SELECT_ACTION_TOOLS.has(t);
        const activeMode = window.selectionMode || 'new';
        modeGroup.querySelectorAll('.illu-icon-toggle').forEach((btn) => {
            const on = btn.getAttribute('data-selection-mode') === activeMode;
            btn.classList.toggle('active', on);
            btn.classList.toggle('illu-icon-toggle--on', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    // Handle tool-specific visibility tweaks
    const pencilRow = document.getElementById('pencil-close-row');
    if (pencilRow) pencilRow.hidden = (t !== 'pencil' && t !== 'brush');

    const wandFullLayer = document.getElementById('wand-fullscreen-row');
    if (wandFullLayer) wandFullLayer.hidden = (t !== 'wand' && t !== 'fill');

    const shapeCornerRow = document.getElementById('tool-shape-corner-row');
    if (shapeCornerRow) shapeCornerRow.hidden = (t !== 'round-3' && t !== 'rect');

    // Vector Context Management
    const vActions = document.getElementById('opt-grp-vector-context-actions');
    const vParams = document.getElementById('opt-grp-vector-params');
    const isVectorSelect = EditorManager.mode === 'vector' && EditorManager.activeVectorSelection.length > 0;

    if (vActions) vActions.hidden = !isVectorSelect;
    if (vParams) vParams.hidden = !isVectorSelect;

    if (isVectorSelect) {
        const cnt = EditorManager.activeVectorSelection.length;
        const chip = document.getElementById('vector-selection-count');
        if (chip) chip.textContent = cnt === 1 ? '1 sélection' : `${cnt} sélections`;

        const primary = EditorManager.activeVectorSelection[EditorManager.activeVectorSelection.length - 1];
        const pTag = primary ? (primary.tagName || '').toLowerCase() : '';

        // Show/hide boolean actions only for multi-selection
        const boolWrap = document.getElementById('vector-bool-actions');
        if (boolWrap) boolWrap.style.display = cnt >= 2 ? 'flex' : 'none';

        // Corner radius only for rect
        const crWrap = document.getElementById('vector-prop-corner-radius-wrap');
        const cr = document.getElementById('vector-prop-corner-radius');
        const showCorner = cnt === 1 && pTag === 'rect';
        if (crWrap) crWrap.style.display = showCorner ? 'flex' : 'none';
        if (showCorner && cr && primary) {
            const rx = parseFloat(primary.getAttribute('rx')) || 0;
            cr.value = String(Math.round(rx));
        }

        // Font controls for text (ruban : tool-text-* ; panneau vecteur optionnel)
        const ffWrap = document.getElementById('vector-prop-font-wrap');
        const ff = document.getElementById('tool-text-font') || document.getElementById('vector-prop-font-family');
        const fs = document.getElementById('tool-text-size') || document.getElementById('vector-prop-font-size');
        const fsVal = document.getElementById('tool-text-size-val');
        const showFont = cnt === 1 && (pTag === 'text' || pTag === 'foreignobject');
        if (ffWrap) ffWrap.style.display = showFont ? 'flex' : 'none';
        if (showFont && primary) {
            if (pTag === 'text') {
                if (ff) ff.value = primary.getAttribute('font-family') || 'Arial, sans-serif';
                const fsNum = Math.round(parseFloat(primary.getAttribute('font-size')) || 18);
                if (fs) fs.value = String(fsNum);
                if (fsVal) fsVal.textContent = String(fsNum);
            } else {
                const div = illuGetVectorTextEditableDiv(primary);
                if (div) {
                    const st = window.getComputedStyle(div);
                    if (ff) ff.value = st.fontFamily || 'Arial, sans-serif';
                    const fsNum = Math.round(parseFloat(st.fontSize) || 18);
                    if (fs) fs.value = String(fsNum);
                    if (fsVal) fsVal.textContent = String(fsNum);
                    if (typeof window.syncIlluGaugeForRange === 'function' && fs) {
                        window.syncIlluGaugeForRange(fs);
                    }
                }
            }
        }

        // Sync stroke width (attribut SVG, pas tool-size)
        const sw = document.getElementById('vector-prop-stroke-width');
        const swVal = document.getElementById('vector-prop-stroke-width-val');
        if (sw && primary) {
            let swNum = parseFloat(primary.getAttribute('stroke-width'));
            if (!Number.isFinite(swNum) || swNum < 0) swNum = 0;
            if (swNum <= 0 && primary.getAttribute('stroke') && primary.getAttribute('stroke') !== 'none') {
                swNum = 1;
            }
            sw.value = String(Math.round(swNum));
            if (swVal) swVal.textContent = sw.value;
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(sw);
        }

        // Sync fill model buttons
        const fm = primary ? primary.getAttribute('fill') : 'none';
        let fillModel = 'solid';
        if (fm === 'none' || !fm) fillModel = 'none';
        else if (fm.startsWith('url(#')) {
            fillModel = fm.includes('grad-') ? 'gradient' : 'pattern';
        }
        document.querySelectorAll('#opt-grp-vector-fill-buttons .illu-icon-toggle').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-illu-value') === fillModel);
        });
    }

    // Refresh all gauges (to update the fill percentage)
    document.querySelectorAll('.tool-options-bar .illu-gauge-input').forEach(input => {
        if (window.syncIlluGaugeForRange) window.syncIlluGaugeForRange(input);
    });

    // Sync the tool switcher dropdown
    const toolSelect = document.getElementById('illu-tool-list-select');
    if (toolSelect) {
        toolSelect.value = t;
    }
    if (typeof window.illuSyncToolPickerLabel === 'function') {
        window.illuSyncToolPickerLabel(t, cfg);
    }

    if (typeof window.illuUnifyModeToggleItems === 'function') {
        window.illuUnifyModeToggleItems();
    }
    if (typeof window.illuApplyToggleLayouts === 'function') {
        window.illuApplyToggleLayouts();
    }
    const sz = document.getElementById('tool-size');
    if (sz && EditorManager.toolProps.size != null) {
        sz.value = String(EditorManager.toolProps.size);
        if (typeof window.syncIlluGaugeForRange === 'function') {
            window.syncIlluGaugeForRange(sz);
        }
    }
    const pat = document.getElementById('tool-brush-pattern');
    if (pat) pat.value = EditorManager.toolProps.brushPattern || 'round';
    const brushPat = EditorManager.toolProps.brushPattern || 'round';
    const hardnessGrp = document.getElementById('opt-grp-brush-hardness');
    const hardnessRow = document.getElementById('tool-brush-hardness-row');
    const showHard =
        t !== 'pencil' &&
        ((t === 'brush' && brushPat !== 'soft' && brushPat !== 'spray') ||
            (t === 'eraser' && brushPat !== 'spray'));
    if (hardnessGrp && cfg.paramGroups && cfg.paramGroups.includes('opt-grp-brush-hardness')) {
        hardnessGrp.hidden = !showHard;
    }
    if (hardnessRow) hardnessRow.hidden = !showHard;
    const bhSl = document.getElementById('tool-brush-hardness');
    const bhV = document.getElementById('tool-brush-hardness-val');
    if (bhSl) {
        bhSl.disabled = !showHard;
        const hb = EditorManager.toolProps.brushHardness != null ? EditorManager.toolProps.brushHardness : 100;
        bhSl.value = String(Math.max(0, Math.min(100, hb)));
        if (bhV) bhV.textContent = bhSl.value;
        if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(bhSl);
    }
    const wand = document.getElementById('wand-tolerance');
    const wandV = document.getElementById('wand-tolerance-val');
    if (wand) {
        const v = EditorManager.toolProps.wandTolerance ?? 32;
        wand.value = String(v);
        if (wandV) wandV.textContent = String(v);
        if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(wand);
    }
    const wandMode = document.getElementById('wand-mode');
    if (wandMode) {
        wandMode.value = EditorManager.toolProps.wandMode === 'contiguous' ? 'contiguous' : 'similar';
    }
    const wandFullRow = document.getElementById('wand-fullscreen-row');
    if (wandFullRow) {
        wandFullRow.hidden = EditorManager.toolProps.wandMode !== 'similar';
    }
    const wandFullCb = document.getElementById('wand-color-full-layer');
    if (wandFullCb) {
        wandFullCb.checked = !!EditorManager.toolProps.wandColorFullLayer;
    }
    const freeCornersRow =
        document.getElementById('select-rect-free-corners-wrap') ||
        document.getElementById('select-free-corners-row');
    const showFreeCornersBtn = ['select', 'wand', 'direct-select', 'deform', 'warp-4'].includes(t);
    if (freeCornersRow) freeCornersRow.hidden = !showFreeCornersBtn;
    if (typeof window.syncSelectionRectFreeCornersArmUI === 'function') {
        window.syncSelectionRectFreeCornersArmUI();
    }
    if (pencilRow) pencilRow.hidden = (t !== 'pencil' && t !== 'brush' && t !== 'line' && t !== 'cubic-3' && t !== 'pen');
    const pencilCloseCb = document.getElementById('tool-pencil-close');
    if (pencilCloseCb) pencilCloseCb.checked = !!EditorManager.toolProps.pencilAutoClose;

    const gradTypeHidden = document.getElementById('tool-gradient-type');
    if (gradTypeHidden) gradTypeHidden.value = EditorManager.toolProps.gradientType || 'linear';

    const gradMethodHidden = document.getElementById('tool-gradient-method');
    if (gradMethodHidden) gradMethodHidden.value = EditorManager.toolProps.gradientMethod || 'simple';
    const cornerRow = document.getElementById('tool-shape-corner-row');
    if (cornerRow) cornerRow.hidden = t !== 'round-3';
    const cornerSl = document.getElementById('tool-shape-corner-radius');
    const cornerV = document.getElementById('tool-shape-corner-radius-val');
    if (cornerSl) {
        const cr = EditorManager.toolProps.shapeCornerRadius ?? 12;
        const crCap =
            typeof window.illuClampShapeCornerRadius === 'function'
                ? window.illuClampShapeCornerRadius(cr)
                : Math.max(0, Math.min(256, cr));
        cornerSl.value = String(crCap);
        if (cornerV) cornerV.textContent = cornerSl.value;
        if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(cornerSl);
    }
    const shapeModeRow = document.getElementById('tool-shape-mode-row');
    const shapeFillTypeRow = document.getElementById('tool-shape-fill-type-row');
    const shapeGradAngleRow = document.getElementById('tool-shape-grad-angle-row');
    const shapeGradTypeActions = document.getElementById('tool-shape-grad-type-actions');
    const quadBulgeRow = document.getElementById('tool-quad-curve-bulge-row');
    const isLineOrCubic = t === 'line' || t === 'cubic-3';
    const isLineLike = isLineOrCubic || t === 'pen';
    const isShapeRectLike = t === 'rect' || t === 'circle' || t === 'round-3' || t === 'triangle' || t === 'polygon';

    const shapeModeSel = document.getElementById('tool-shape-mode');
    if (shapeModeSel) {
        const mv = EditorManager.toolProps.shapeStrokeMode || 'both';
        if (shapeModeSel.value !== mv) shapeModeSel.value = mv;
    }
    const fillTypeSel = document.getElementById('tool-fill-type');
    if (fillTypeSel) {
        let fv = EditorManager.toolProps.fillType || 'solid';
        if (fv === 'none') {
            fv = 'solid';
            EditorManager.toolProps.fillType = 'solid';
        }
        if (fv !== 'solid' && fv !== 'gradient') {
            fv = 'solid';
            EditorManager.toolProps.fillType = 'solid';
        }
        if (fillTypeSel.value !== fv) fillTypeSel.value = fv;
    }

    const mode = EditorManager.toolProps.shapeStrokeMode || 'both';
    const fillType = EditorManager.toolProps.fillType || 'solid';
    const gradTypeSel = document.getElementById('tool-shape-grad-type');
    const gradType = gradTypeSel ? gradTypeSel.value || 'linear' : 'linear';
    if (gradTypeSel && gradTypeSel.value !== gradType) gradTypeSel.value = gradType;

    if (shapeModeRow) shapeModeRow.hidden = !isShapeRectLike;
    if (shapeFillTypeRow) {
        if (isLineOrCubic) shapeFillTypeRow.hidden = true;
        else if (isLineLike) shapeFillTypeRow.hidden = false;
        else shapeFillTypeRow.hidden = mode === 'stroke';
    }
    const showGradTypeRow = isShapeRectLike && fillType === 'gradient' && mode !== 'stroke';
    if (shapeGradTypeActions) shapeGradTypeActions.hidden = !showGradTypeRow;
    const showGradMethodRow =
        (isShapeRectLike && fillType === 'gradient' && mode !== 'stroke') ||
        (t === 'pen' && fillType === 'gradient');
    const shapeGradMethodActions = document.getElementById('tool-shape-grad-method-actions');
    if (shapeGradMethodActions) shapeGradMethodActions.hidden = !showGradMethodRow;
    const showGradAngleRect = isShapeRectLike && fillType === 'gradient' && mode !== 'stroke' && gradType !== 'radial';
    const showGradAngleLineLike = t === 'pen' && fillType === 'gradient';
    if (shapeGradAngleRow) shapeGradAngleRow.hidden = !showGradAngleRect && !showGradAngleLineLike;

    if (quadBulgeRow) quadBulgeRow.hidden = t !== 'cubic-3';
    const qBulgeSl = document.getElementById('tool-quad-curve-bulge');
    const qBulgeV = document.getElementById('tool-quad-curve-bulge-val');
    if (qBulgeSl) {
        const qb = EditorManager.toolProps.quadCurveBulge ?? 100;
        qBulgeSl.value = String(Math.max(0, Math.min(200, qb)));
        if (qBulgeV) qBulgeV.textContent = qBulgeSl.value;
        if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(qBulgeSl);
    }
    const shapeGradAngleSl = document.getElementById('tool-shape-grad-angle');
    const shapeGradAngleV = document.getElementById('tool-shape-grad-angle-val');
    if (shapeGradAngleSl) {
        const ga = EditorManager.toolProps.shapeGradAngle ?? 0;
        shapeGradAngleSl.value = String(Math.max(0, Math.min(360, ga)));
        if (shapeGradAngleV) shapeGradAngleV.textContent = shapeGradAngleSl.value;
        if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(shapeGradAngleSl);
    }
    const hasSelectFreeQuad =
        typeof window.illuSelectionIsSelectFreeQuad === 'function' && window.illuSelectionIsSelectFreeQuad();
    const hasFreeWarpQuad =
        typeof window.illuSelectionHasFreeWarpQuad === 'function' && window.illuSelectionHasFreeWarpQuad();
    const quadIsAxisRect =
        typeof window.illuSelectionWarpDestIsAxisRect === 'function' &&
        window.illuSelectionWarpDestIsAxisRect();
    const showWarpDeformOpts = t === 'warp-4' || t === 'deform';
    const warpRow = document.getElementById('opt-grp-warp-params');
    if (warpRow) {
        warpRow.hidden = !showWarpDeformOpts && !(t === 'select' && hasSelectFreeQuad);
    }
    const resampleWrap = document.getElementById('opt-warp-resample-wrap');
    const resampleSep = document.getElementById('opt-warp-resample-sep');
    const warpToggles = document.querySelector('#opt-grp-warp-params .illu-warp-bar-toggles');
    const rectLockWrap = document.getElementById('opt-warp-quad-rect-lock-wrap');
    const snapWrap = document.getElementById('opt-warp-quad-snap-wrap');
    const toWarpWrap = document.getElementById('opt-select-quad-to-warp-wrap');
    if (resampleWrap) resampleWrap.hidden = !showWarpDeformOpts;
    if (resampleSep) resampleSep.hidden = !showWarpDeformOpts;
    if (rectLockWrap) rectLockWrap.hidden = !(showWarpDeformOpts && hasFreeWarpQuad);
    if (snapWrap) {
        snapWrap.hidden = !(showWarpDeformOpts && hasFreeWarpQuad && !quadIsAxisRect);
    }
    if (toWarpWrap) toWarpWrap.hidden = !(t === 'select' && hasSelectFreeQuad);
    if (warpToggles) {
        const anyToggle = warpToggles.querySelector('.illu-mode-toggle-item:not([hidden])');
        warpToggles.hidden = !anyToggle;
    }
    if (typeof window.syncWarpQuadRectLockUI === 'function') window.syncWarpQuadRectLockUI();
    if (t === 'select' && hasSelectFreeQuad && warpRow) {
        warpRow.hidden = false;
        hasParams = true;
    }
    if (bar2) {
        bar2.hidden = !hasParams;
    }
    const warpSel = document.getElementById('tool-warp-resampling');
    if (warpSel) {
        const mode =
            window.illuInterpolationMode === 'nearest' || EditorManager.toolProps.warpResampling === 'nearest'
                ? 'nearest'
                : 'smooth';
        warpSel.value = mode;
        if (!warpSel.dataset.illuResampleWired) {
            warpSel.dataset.illuResampleWired = '1';
            warpSel.addEventListener('change', () => {
                const v = warpSel.value === 'nearest' ? 'nearest' : 'smooth';
                EditorManager.toolProps.warpResampling = v;
                window.illuInterpolationMode = v;
                try {
                    localStorage.setItem('illu_resample', v);
                } catch (e) {
                    /* ignore */
                }
                if (typeof window.illuSettingsScopeSetActive === 'function') {
                    const row = document.getElementById('settings-resample-scope-row');
                    if (row) window.illuSettingsScopeSetActive(row, v);
                }
                if (window.selectionPixelWarpActive && typeof window.runSelectionWarpPreview === 'function') {
                    illuScheduleSelectionWarpPreview({ preview: true });
                }
            });
        }
    }

    const textSizeSl = document.getElementById('tool-text-size');
    const textSizeV = document.getElementById('tool-text-size-val');
    if (textSizeSl) {
        const tpx = EditorManager.toolProps.textSize ?? 18;
        textSizeSl.value = String(Math.max(8, Math.min(500, tpx)));
        if (textSizeV) textSizeV.textContent = textSizeSl.value;
        if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(textSizeSl);
    }
    if (
        document.getElementById('tool-text-font') &&
        typeof window.syncIlluTextFontSelectFromToolProps === 'function'
    ) {
        try {
            window.syncIlluTextFontSelectFromToolProps();
        } catch (err) {
            console.warn('[MasterPaint] syncIlluTextFontSelectFromToolProps:', err);
        }
    }
    const textStrokeWSl = document.getElementById('tool-text-stroke-w');
    const textStrokeWV = document.getElementById('tool-text-stroke-w-val');
    if (textStrokeWSl) {
        const tw = EditorManager.toolProps.textStrokeWidth ?? 2;
        textStrokeWSl.value = String(Math.max(1, Math.min(150, tw)));
        if (textStrokeWV) textStrokeWV.textContent = textStrokeWSl.value;
        if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(textStrokeWSl);
    }
    const textBoldCb = document.getElementById('tool-text-bold');
    if (textBoldCb) textBoldCb.checked = !!EditorManager.toolProps.textBold;
    const textItalicCb = document.getElementById('tool-text-italic');
    if (textItalicCb) textItalicCb.checked = !!EditorManager.toolProps.textItalic;
    const textStrokeCb = document.getElementById('tool-text-stroke');
    if (textStrokeCb) textStrokeCb.checked = !!EditorManager.toolProps.textStroke;
    const textFillSel = document.getElementById('tool-text-fill');
    const textFillType = EditorManager.toolProps.textFillType || 'solid';
    if (textFillSel) textFillSel.value = textFillType;
    const textGradTypeSel = document.getElementById('tool-text-grad-type');
    const textGradType = EditorManager.toolProps.textGradType === 'radial' ? 'radial' : 'linear';
    if (textGradTypeSel && textGradTypeSel.value !== textGradType) textGradTypeSel.value = textGradType;
    const textGradTypeActions = document.getElementById('tool-text-grad-type-actions');
    if (textGradTypeActions) textGradTypeActions.hidden = textFillType !== 'gradient';
    const textGradMethodActions = document.getElementById('tool-text-grad-method-actions');
    if (textGradMethodActions) textGradMethodActions.hidden = textFillType !== 'gradient';
    const textGradAngleRow = document.getElementById('tool-text-grad-angle-row');
    const textGradAngleSep = document.getElementById('tool-text-grad-angle-sep');
    const showTextGradAngle = textFillType === 'gradient' && textGradType !== 'radial';
    if (textGradAngleRow) textGradAngleRow.hidden = !showTextGradAngle;
    if (textGradAngleSep) textGradAngleSep.hidden = !showTextGradAngle;
    const textGradAngleSl = document.getElementById('tool-text-grad-angle');
    const textGradAngleV = document.getElementById('tool-text-grad-angle-val');
    if (textGradAngleSl) {
        const tga = EditorManager.toolProps.textGradAngle ?? 0;
        textGradAngleSl.value = String(Math.max(0, Math.min(360, tga)));
        if (textGradAngleV) textGradAngleV.textContent = textGradAngleSl.value;
        if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(textGradAngleSl);
    }
    const pencilCb = document.getElementById('pencil-auto-close');
    if (pencilCb) pencilCb.checked = !!EditorManager.toolProps.pencilAutoClose;
    const capStartEl = document.getElementById('tool-line-cap-start');
    const capEndEl = document.getElementById('tool-line-cap-end');
    if (capStartEl) capStartEl.value = EditorManager.toolProps.lineCapStart || 'none';
    if (capEndEl) capEndEl.value = EditorManager.toolProps.lineCapEnd || 'none';
    const fillModeSel = document.getElementById('fill-mode');
    if (fillModeSel) {
        const fm = EditorManager.toolProps.fillMode === 'layer' ? 'layer' : 'contiguous';
        if (fillModeSel.value !== fm) fillModeSel.value = fm;
    }
    const fillTol = document.getElementById('fill-tolerance');
    const fillTolV = document.getElementById('fill-tolerance-val');
    if (fillTol) {
        const fv = EditorManager.toolProps.fillTolerance ?? 0;
        fillTol.value = String(fv);
        if (fillTolV) fillTolV.textContent = String(fv);
        if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(fillTol);
    }
    if (typeof window.updateMainCanvasCursor === 'function') window.updateMainCanvasCursor();
    if (typeof window.syncAllToolbarToggles === 'function') window.syncAllToolbarToggles();
    if (typeof window.setupIlluGaugeSteppers === 'function') window.setupIlluGaugeSteppers();
    if (typeof window.syncIlluMobileZoomFitButtonVisibility === 'function') {
        window.syncIlluMobileZoomFitButtonVisibility();
    }
    if (typeof window.syncIlluMobileActiveToolLabel === 'function') {
        window.syncIlluMobileActiveToolLabel();
    }
    if (t === 'eyedropper' && typeof window.illuRefreshEyedropperColorPanel === 'function') {
        window.illuRefreshEyedropperColorPanel();
    }
    if (isOffice && typeof window.illuApplyRibbonGroupsForTool === 'function') {
        window.illuApplyRibbonGroupsForTool(t, cfg, {
            isVectorSelect,
            showHard,
            warpActive: showWarpDeformOpts || (t === 'select' && hasSelectFreeQuad)
        });
    }
    if (typeof window.illuSyncMobileSelectionRibbonActions === 'function') {
        window.illuSyncMobileSelectionRibbonActions();
    }
};

/** Désactive les outils incompatibles avec le mode (pixel / vecteur) et rétablit la sélection si besoin. */
window.updateToolboxModeState = function () {
    const box = document.getElementById('main-toolbox');
    if (!box || typeof EditorManager === 'undefined') return;
    const isPixel = EditorManager.isPixelMode;
    box.querySelectorAll('.tool-btn').forEach((btn) => {
        if (btn.id === 'btn-deselect') {
            btn.disabled = false;
            btn.classList.remove('tool-btn--mode-lock', 'tool-btn--planned');
            return;
        }
        if (TOOL_PLANNED_IDS.has(btn.id)) {
            btn.disabled = true;
            btn.classList.add('tool-btn--planned');
            btn.classList.remove('tool-btn--mode-lock');
            return;
        }
        const tool = btn.id.startsWith('tool-') ? btn.id.replace('tool-', '') : btn.id;
        const badVector = !isPixel && TOOL_PIXEL_ONLY.has(tool);
        const badPixel = isPixel && TOOL_VECTOR_ONLY.has(tool);
        const locked = badVector || badPixel;
        btn.disabled = locked;
        btn.classList.toggle('tool-btn--mode-lock', locked);
        btn.classList.remove('tool-btn--planned');
    });
    let t = window.activeTool || 'select';
    if (isPixel && TOOL_VECTOR_ONLY.has(t)) {
        t = 'select';
        window.activeTool = 'select';
        box.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
        const sel = document.getElementById('tool-select');
        if (sel) sel.classList.add('active');
    } else if (!isPixel && TOOL_PIXEL_ONLY.has(t)) {
        t = 'select';
        window.activeTool = 'select';
        box.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
        const sel = document.getElementById('tool-select');
        if (sel) sel.classList.add('active');
    }
    if (window.activeTool !== 'cubic-3') {
        setVectorQuadBezierClickState(null);
        window._quadBezierPreviewDoc = null;
    }
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
};

/**
 * Active un bouton d’outil par id DOM (réutilise le même flux que le clic).
 * @param {string} id ex. "tool-move"
 * @returns {boolean}
 */
window.activateIlluToolButtonById = function (id) {
    const b = document.getElementById(id);
    if (!b || b.disabled) return false;
    b.click();
    return true;
};

/**
 * Sélection rectangulaire en coordonnées document (sans couvrir tout le tampon).
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
window.illuSetRectSelectionDocBounds = function (x, y, w, h) {
    if (typeof EditorManager === 'undefined' || !EditorManager.isPixelMode) return;
    window.selectionInverted = false;
    window.selectionKind = 'rect';
    window.selectionColorMask = null;
    window.selectionLassoPoints = null;
    window.selectionIsWarpQuad = false;
    window.selectionPreviewAngleRad = 0;
    window.selectionBounds = { x, y, w, h };
    if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
};

/** Après import / nouveau calque / onglet : sélection, puis outil Déformation. @param {{ skipFullLayerSync?: boolean }} [opts] */
window.illuAfterImportActivateDeformTool = function (opts) {
    opts = opts || {};
    if (typeof EditorManager === 'undefined' || !EditorManager.isPixelMode) return;
    const l = EditorManager.activeLayer;
    if (l && l.importPlacementPending && typeof window.syncSelectionToImportPlacementLayer === 'function') {
        window.syncSelectionToImportPlacementLayer();
    } else if (opts.skipFullLayerSync) {
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
    } else if (typeof window.syncSelectionToActiveLayer === 'function') {
        window.syncSelectionToActiveLayer();
    }
    window.activateIlluToolButtonById('tool-deform');
    EditorManager.render();
};

/** Après collage / import volant : sélection du calque flottant, puis outil Déplacer. */
window.illuAfterImportActivateMoveTool = function (opts) {
    opts = opts || {};
    if (typeof EditorManager === 'undefined' || !EditorManager.isPixelMode) return;
    const l = EditorManager.activeLayer;
    if (l && l.importPlacementPending && typeof window.syncSelectionToImportPlacementLayer === 'function') {
        window.syncSelectionToImportPlacementLayer();
    } else if (opts.skipFullLayerSync) {
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
    } else if (typeof window.syncSelectionToActiveLayer === 'function') {
        window.syncSelectionToActiveLayer();
    }
    window.activateIlluToolButtonById('tool-move');
    EditorManager.render();
};

/**
 * Collage volant sur le calque actif : le tampon du calque reste aux dimensions du projet ;
 * l’image collée vit dans importStagingBuffer jusqu’à validation (Entrée).
 * @param {HTMLCanvasElement} scratch
 */
window.illuSetImportStaging = function (scratch) {
    const l = EditorManager.activeLayer;
    if (!l || !scratch || !EditorManager.isPixelMode) return;
    if (l.alphaMaskProjectId) {
        window.showIlluAlert(
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('msg.layerResizeBlockedAlphaMask')
                : 'Détachez le masque α lié avant de coller sur ce calque.'
        );
        return;
    }
    const iw = scratch.width | 0;
    const ih = scratch.height | 0;
    if (iw < 1 || ih < 1) return;
    let docX = 0;
    let docY = 0;
    if (window.selectionBounds) {
        docX = Math.round(window.selectionBounds.x);
        docY = Math.round(window.selectionBounds.y);
    }
    if (!l.buffer) {
        const W = Math.max(1, EditorManager.width | 0);
        const H = Math.max(1, EditorManager.height | 0);
        const buf = document.createElement('canvas');
        buf.width = W;
        buf.height = H;
        l.buffer = buf;
    }
    if (typeof EditorManager._fitLayerBufferToDocumentSize === 'function') {
        EditorManager._fitLayerBufferToDocumentSize(l);
    }
    l.importStagingBuffer = EditorManager.cloneCanvas(scratch);
    l.importStagingX = docX | 0;
    l.importStagingY = docY | 0;
    l.importPlacementPending = true;
    if (typeof illuSetImportPlacementChromeActive === 'function') {
        illuSetImportPlacementChromeActive(true);
    }
    if (typeof window.syncSelectionToImportPlacementLayer === 'function') {
        window.syncSelectionToImportPlacementLayer();
    }
    EditorManager.render();
};

/** Passe à l’outil Déformation sans modifier la sélection (ex. après Copier). */
window.illuActivateDeformToolOnly = function () {
    if (typeof EditorManager === 'undefined' || !EditorManager.isPixelMode) return;
    window.activateIlluToolButtonById('tool-deform');
    EditorManager.render();
};

/**
 * Raccourcis outils type Paint.NET / Photoshop (touche seule, sans Ctrl/Meta/Alt).
 * @returns {boolean} true si un outil a été activé
 */
window.activateIlluToolByShortcut = function (e) {
    if (!e || e.ctrlKey || e.metaKey || e.altKey) return false;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    if (e.shiftKey) {
        if (k === 'b') return window.activateIlluToolButtonById('tool-brush');
        return false;
    }
    const map = {
        s: 'tool-select',
        m: 'tool-move',
        v: 'tool-move',
        a: 'tool-direct-select',
        d: 'tool-direct-select',
        b: 'tool-wand',
        w: 'tool-wand',
        p: 'tool-pencil',
        e: 'tool-eraser',
        f: 'tool-fill',
        g: 'tool-gradient',
        i: 'tool-eyedropper',
        z: 'tool-zoom',
        t: 'tool-text',
        r: 'tool-rect',
        o: 'tool-circle',
        l: 'tool-line',
        u: 'tool-round-3',
        c: 'tool-cubic-3',
        p: 'tool-pen',
        y: 'tool-polygon',
        y: 'tool-deform',
        q: 'tool-warp-4',
        h: 'tool-shadow'
    };
    const id = map[k];
    if (!id) return false;
    return window.activateIlluToolButtonById(id);
};

/**
 * Teste si le pixel à l’index i (RGBA) est « proche » de la couleur à idx0 (baguette, pot, etc.).
 * @param {Uint8ClampedArray} d
 */
function buildPixelColorMatchFn(d, idx0, tolUi) {
    const r0 = d[idx0],
        g0 = d[idx0 + 1],
        b0 = d[idx0 + 2],
        a0 = d[idx0 + 3];
    const t = tolUi ?? 0;
    if (t <= 0) {
        return (i) =>
            d[i] === r0 && d[i + 1] === g0 && d[i + 2] === b0 && d[i + 3] === a0;
    }
    const rgbMax = Math.max(24, t * 1.75);
    const alphaOkMax = Math.max(40, t * 1.2);
    return (i) => {
        const dr = d[i] - r0,
            dg = d[i + 1] - g0,
            db = d[i + 2] - b0;
        const distRgb = Math.sqrt(dr * dr + dg * dg + db * db);
        const da = Math.abs(d[i + 3] - a0);
        return distRgb <= rgbMax && da <= alphaOkMax;
    };
}

function illuMaskDataFingerprint(data) {
    if (!data || !data.length) return '0';
    const n = data.length;
    const step = Math.max(1, Math.floor(n / 512));
    let ones = 0;
    let mix = 0;
    for (let i = 0; i < n; i += step) {
        if (data[i]) ones++;
        mix = (mix + data[i] * ((i % 997) + 1)) | 0;
    }
    return `${ones}_${mix}`;
}

/** Contour orthogonal du masque (1 = sélectionné), coords document. boundsDoc = cadre doc optionnel (fantôme combine). */
function appendBinaryMaskOutlineSvg(parent, maskData, w, h, docLx, docLy, boundsDoc) {
    const W = EditorManager.width;
    const H = EditorManager.height;
    const mObj = window.selectionColorMask;
    const fp = illuMaskDataFingerprint(maskData);
    const cacheKey = `m_${w}_${h}_${docLx}_${docLy}_${fp}`;
    const ep = window.selectionExpansionPreviewPx || 0;

    const z = EditorManager.getCanvasZoomLevel() || 1;
    const stride = 1;

    let dPath = (mObj && mObj._cachedPath && mObj._cachedKey === cacheKey && mObj._cachedStride === stride) ? mObj._cachedPath : null;

    if (!dPath) {
        const parts = [];
        const sb = boundsDoc || window.selectionBounds;
        let startX = 0;
        let startY = 0;
        let endX = w;
        let endY = h;
        if (sb && sb.w > 0 && sb.h > 0) {
            startX = Math.max(0, Math.floor(sb.x - docLx));
            startY = Math.max(0, Math.floor(sb.y - docLy));
            endX = Math.min(w, Math.ceil(sb.x - docLx + sb.w));
            endY = Math.min(h, Math.ceil(sb.y - docLy + sb.h));
        }

        if (typeof MasterPaintWasm !== 'undefined' && MasterPaintWasm.isLoaded) {
            const segs = MasterPaintWasm.getMaskOutlineSegments(maskData, w, h, startX, startY, endX, endY, stride);
            if (segs) {
                for (let i = 0; i < segs.length; i += 4) {
                    const x = segs[i];
                    const y = segs[i + 1];
                    const dx = segs[i + 2];
                    const dy = segs[i + 3];
                    parts.push(`M${docLx + x} ${docLy + y}l${dx} ${dy}`);
                }
            }
        } else {
            // JS Fallback
            // -- Vertical edges --
            for (let y = startY; y < endY; y += stride) {
                const rowOffset = y * w;
                if (stride === 1) {
                    for (let x = startX; x <= endX; x++) {
                        const a = x > 0 ? maskData[rowOffset + x - 1] : 0;
                        const b = x < w ? maskData[rowOffset + x] : 0;
                        if (a !== b) parts.push(`M${docLx + x} ${docLy + y}l0 1`);
                    }
                } else {
                    for (let x = startX; x <= endX; x += stride) {
                        const valCurrent = (x < w) ? maskData[rowOffset + x] : 0;
                        const valPrev = (x >= stride) ? maskData[rowOffset + x - stride] : 0;
                        if (valCurrent !== valPrev) {
                            parts.push(`M${docLx + x} ${docLy + y}l0 ${stride}`);
                        }
                    }
                }
            }

            // -- Horizontal edges --
            for (let y = startY; y <= endY; y += stride) {
                const rowOffset = (y < h) ? y * w : -1;
                const prevRowOffset = (y >= stride) ? (y - stride) * w : -1;
                
                if (stride === 1) {
                    for (let x = startX; x < endX; x++) {
                        const a = prevRowOffset >= 0 ? maskData[prevRowOffset + x] : 0;
                        const b = rowOffset >= 0 ? maskData[rowOffset + x] : 0;
                        if (a !== b) parts.push(`M${docLx + x} ${docLy + y}l1 0`);
                    }
                } else {
                    for (let x = startX; x < endX; x += stride) {
                        const valCurrent = (rowOffset >= 0) ? maskData[rowOffset + x] : 0;
                        const valPrev = (prevRowOffset >= 0) ? maskData[prevRowOffset + x] : 0;
                        if (valCurrent !== valPrev) {
                            parts.push(`M${docLx + x} ${docLy + y}l${stride} 0`);
                        }
                    }
                }
            }
        }
        dPath = parts.join('');
        if (mObj && dPath) {
            mObj._cachedStride = stride;
            mObj._cachedPath = dPath;
            mObj._cachedKey = cacheKey;
        }
    }

    if (!dPath) {
        if (
            window.selectionBounds &&
            window.selectionKind === 'color' &&
            maskData &&
            maskData.length
        ) {
            const sb = window.selectionBounds;
            const mkSvg = (x, y, w, h) => {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.style.cssText =
                    'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
                svg.setAttribute('width', String(W));
                svg.setAttribute('height', String(H));
                const strokeW = 1.25 / z;
                const outlineW = strokeW * 2;
                const pOutline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                pOutline.setAttribute('x', String(x));
                pOutline.setAttribute('y', String(y));
                pOutline.setAttribute('width', String(Math.max(0, w)));
                pOutline.setAttribute('height', String(Math.max(0, h)));
                pOutline.setAttribute('fill', 'none');
                pOutline.setAttribute('stroke', '#000');
                pOutline.setAttribute('stroke-width', String(outlineW));
                
                const pDash = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                pDash.setAttribute('x', String(x));
                pDash.setAttribute('y', String(y));
                pDash.setAttribute('width', String(Math.max(0, w)));
                pDash.setAttribute('height', String(Math.max(0, h)));
                pDash.setAttribute('fill', 'none');
                pDash.setAttribute('stroke', '#fff');
                pDash.setAttribute('stroke-width', String(strokeW));
                pDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
                
                svg.appendChild(pOutline);
                svg.appendChild(pDash);
                parent.appendChild(svg);
            };
            mkSvg(sb.x, sb.y, sb.w, sb.h);
        }
        return;
    }

    const mkSvg = (pathData, isExp = false) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:0;';
        if (isExp) svg.style.opacity = '0.6';
        svg.setAttribute('width', String(W));
        svg.setAttribute('height', String(H));
        const z = EditorManager.getCanvasZoomLevel();
        const strokeW = 1.25 / z;
        const outlineW = strokeW * 2;
        const pOutline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pOutline.setAttribute('d', pathData);
        pOutline.setAttribute('stroke', isExp ? '#0000ff' : '#000000');
        pOutline.setAttribute('stroke-width', String(isExp ? 1 / z : outlineW));
        pOutline.setAttribute('fill', 'none');
        pOutline.setAttribute('stroke-linejoin', 'round');
        pOutline.setAttribute('stroke-linecap', 'round');

        const pDash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pDash.setAttribute('d', pathData);
        pDash.setAttribute('stroke', '#ffffff');
        pDash.setAttribute('stroke-width', String(isExp ? 1 / z : strokeW));
        pDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
        if (isExp) pDash.setAttribute('stroke-dasharray', `${2 / z} ${2 / z}`);
        pDash.setAttribute('fill', 'none');
        pDash.setAttribute('stroke-linejoin', 'round');
        pDash.setAttribute('stroke-linecap', 'round');

        svg.appendChild(pOutline);
        svg.appendChild(pDash);
        return svg;
    };

    parent.appendChild(mkSvg(dPath, false));

    if (ep > 0) {
        const svgExp = mkSvg(dPath, true);
        const z = EditorManager.getCanvasZoomLevel();
        // Agrandissement visuel via stroke-width (hack rapide et efficace)
        const p1 = svgExp.querySelector('path');
        const p2 = svgExp.querySelectorAll('path')[1];
        const newW = (ep * 2) * z; // Conversion pixels doc vers épaisseur de trait visuelle
        p1.setAttribute('stroke-width', String(newW / z));
        p2.setAttribute('stroke-width', String(newW / z));
        parent.appendChild(svgExp);
    }
}

/** Réduit le cadre document au plus petit rectangle contenant encore des pixels du masque couleur. */
window.tightenColorSelectionBoundsFromMask = function () {
    const m = window.selectionColorMask;
    const l = EditorManager.activeLayer;
    if (!m || !m.data || !l || !l.buffer || !EditorManager.colorMaskMatchesActiveLayer(m)) return;
    const w = m.w | 0;
    const h = m.h | 0;
    const d = m.data;
    
    let minX = w, minY = h, maxX = -1, maxY = -1;

    // Fast scan
    for (let y = 0; y < h; y++) {
        const row = y * w;
        let rowHasAny = false;
        for (let x = 0; x < w; x++) {
            if (d[row + x]) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                rowHasAny = true;
            }
        }
        if (rowHasAny) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    if (maxX < 0) {
        EditorManager.deselectAll();
        return;
    }
    window.selectionBounds = {
        x: minX + l.x,
        y: minY + l.y,
        w: maxX - minX + 1,
        h: maxY - minY + 1
    };
};

/** Après redimensionnement du cadre : retire du masque tout pixel hors du rectangle courant, puis resserre le cadre. */
window.intersectColorMaskWithSelectionBounds = function () {
    const m = window.selectionColorMask;
    const sb = window.selectionBounds;
    const l = EditorManager.activeLayer;
    if (!m || !m.data || !sb || !l || !EditorManager.colorMaskMatchesActiveLayer(m)) return;
    const ox = Math.floor(sb.x - l.x);
    const oy = Math.floor(sb.y - l.y);
    const x2 = ox + Math.ceil(sb.w);
    const y2 = oy + Math.ceil(sb.h);
    const w = m.w;
    const h = m.h;
    const d = m.data;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!d[y * w + x]) continue;
            if (x < ox || x >= x2 || y < oy || y >= y2) d[y * w + x] = 0;
        }
    }
    window.tightenColorSelectionBoundsFromMask();
};

function translateSelectionColorMask(src, w, h, dx, dy) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!src[y * w + x]) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = 1;
        }
    }
    return out;
}

/** Met à jour cadre / lasso / masque / quad après un déplacement en coords document. */
function illuTranslateSelectionGeometry(dx, dy) {
    if (dx === 0 && dy === 0) return;
    const sb = window.selectionBounds;
    if (sb) {
        window.selectionBounds = { x: sb.x + dx, y: sb.y + dy, w: sb.w, h: sb.h };
    }
    if (
        window.selectionKind === 'color' &&
        window.selectionColorMask &&
        EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
    ) {
        const m = window.selectionColorMask;
        m.data = translateSelectionColorMask(m.data, m.w, m.h, dx, dy);
        if (typeof window.illuInvalidateSelectionMaskCache === 'function') {
            window.illuInvalidateSelectionMaskCache(m);
        }
    } else if (window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
        window.selectionLassoPoints = window.selectionLassoPoints.map((p) => ({
            x: p.x + dx,
            y: p.y + dy
        }));
    }
    if (window.selectionWarpQuad && !window.selectionPixelWarpActive) {
        const q = window.selectionWarpQuad;
        (['tl', 'tr', 'br', 'bl']).forEach((key) => {
            q[key].x += dx;
            q[key].y += dy;
        });
    }
    if (selectionWarpDeformRect && !window.selectionPixelWarpActive) {
        selectionWarpDeformRect.rx += dx;
        selectionWarpDeformRect.ry += dy;
    }
}

/**
 * Déplace les pixels sélectionnés (ou le calque entier) — outils Déplacer / Déformation / warp-4.
 * @returns {boolean}
 */
window.illuNudgeSelectionPixelsDelta = function (dx, dy) {
    if (dx === 0 && dy === 0) return false;
    if (!EditorManager.activeProject || !EditorManager.isPixelMode) return false;
    const al = EditorManager.activeLayer;
    if (!al || !al.buffer) return false;

    if (illuIsFloatingImportPending()) {
        al.importStagingX = (al.importStagingX | 0) + dx;
        al.importStagingY = (al.importStagingY | 0) + dy;
        if (window.selectionPixelWarpActive && selectionWarpDeformRect && window.selectionWarpQuad) {
            selectionWarpDeformRect.rx += dx;
            selectionWarpDeformRect.ry += dy;
            const R = selectionWarpDeformRect;
            const q = window.selectionWarpQuad;
            q.tl.x = R.rx;
            q.tl.y = R.ry;
            q.tr.x = R.rx + R.rw;
            q.tr.y = R.ry;
            q.br.x = R.rx + R.rw;
            q.br.y = R.ry + R.rh;
            q.bl.x = R.rx;
            q.bl.y = R.ry + R.rh;
        } else if (typeof window.illuTranslateSelectionGeometry === 'function') {
            window.illuTranslateSelectionGeometry(dx, dy);
        }
        if (typeof window.syncSelectionToImportPlacementLayer === 'function') {
            window.syncSelectionToImportPlacementLayer();
        }
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        EditorManager.render({ skipUiThumbnails: true });
        return true;
    }

    const hasSel =
        typeof window.hasActivePixelSelection === 'function' && window.hasActivePixelSelection();
    const sb = window.selectionBounds;
    const layerMatched =
        hasSel &&
        typeof window.selectionMatchesActiveLayer === 'function' &&
        window.selectionMatchesActiveLayer();

    if (!hasSel || !sb || layerMatched) {
        al.x = (al.x || 0) + dx;
        al.y = (al.y || 0) + dy;
        if (hasSel && sb) {
            illuTranslateSelectionGeometry(dx, dy);
        }
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        return true;
    }

    if (sb.w < 1 || sb.h < 1) return false;

    const ctx = al.buffer.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    const lx = al.x;
    const ly = al.y;
    const ox = Math.floor(sb.x - lx);
    const oy = Math.floor(sb.y - ly);
    const sw = Math.max(1, Math.ceil(sb.x - lx + sb.w) - ox);
    const sh = Math.max(1, Math.ceil(sb.y - ly + sb.h) - oy);
    const nx = ox + Math.round(dx);
    const ny = oy + Math.round(dy);
    if (nx < 0 || ny < 0 || nx + sw > al.buffer.width || ny + sh > al.buffer.height) {
        return false;
    }

    const chunk = ctx.getImageData(ox, oy, sw, sh);
    if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
        const d = chunk.data;
        for (let yy = 0; yy < sh; yy++) {
            for (let xx = 0; xx < sw; xx++) {
                if (!pointInPolygon(xx + ox + lx + 0.5, yy + oy + ly + 0.5, window.selectionLassoPoints)) {
                    const idx = (yy * sw + xx) * 4;
                    d[idx + 3] = 0;
                }
            }
        }
    } else if (
        window.selectionKind === 'color' &&
        window.selectionColorMask &&
        EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
    ) {
        const m = window.selectionColorMask;
        const d = chunk.data;
        for (let yy = 0; yy < sh; yy++) {
            for (let xx = 0; xx < sw; xx++) {
                const lpx = ox + xx;
                const lpy = oy + yy;
                if (lpx < 0 || lpx >= m.w || lpy < 0 || lpy >= m.h || !m.data[lpy * m.w + lpx]) {
                    const idx = (yy * sw + xx) * 4;
                    d[idx + 3] = 0;
                }
            }
        }
    }

    const tmp = document.createElement('canvas');
    tmp.width = sw;
    tmp.height = sh;
    tmp.getContext('2d', { willReadFrequently: true }).putImageData(chunk, 0, 0);

    const prevBuf = moveBufferCanvas;
    const prevStart = moveDragBoundsStart;
    const prevLasso = moveDragLassoBaseline;
    moveBufferCanvas = tmp;
    moveDragBoundsStart = { x: sb.x, y: sb.y, w: sw, h: sh };
    moveDragLassoBaseline =
        window.selectionKind === 'lasso' && window.selectionLassoPoints
            ? window.selectionLassoPoints.map((p) => ({ x: p.x, y: p.y }))
            : null;
    illuClearMoveSelectionSourceRegion(ctx, lx, ly);
    moveBufferCanvas = prevBuf;
    moveDragBoundsStart = prevStart;
    moveDragLassoBaseline = prevLasso;

    ctx.save();
    ctx.beginPath();
    if (
        window.selectionKind === 'color' &&
        window.selectionColorMask &&
        EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
    ) {
        EditorManager.appendColorMaskRectsToPath(ctx, window.selectionColorMask);
    } else if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
        window.selectionLassoPoints.forEach((p, i) => {
            const px = p.x - lx;
            const py = p.y - ly;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.closePath();
    } else {
        ctx.rect(ox, oy, sw, sh);
    }
    ctx.clip();
    const useSmooth = document.getElementById('tool-warp-resampling')?.value !== 'nearest';
    ctx.imageSmoothingEnabled = useSmooth;
    ctx.drawImage(tmp, nx, ny);
    ctx.restore();

    illuTranslateSelectionGeometry(dx, dy);
    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
    return true;
};

/** Déplace le cadre / masque de sélection sans déplacer les pixels (outils Sélection, Baguette…). */
window.illuNudgeSelectionMarquee = function (dx, dy) {
    if (dx === 0 && dy === 0) return false;
    if (!EditorManager.activeProject || !EditorManager.isPixelMode) return false;
    const sb = window.selectionBounds;
    const ov = document.getElementById('selection-overlay');
    if (!sb || !ov || ov.style.display === 'none' || window.selectionInverted) return false;

    if (
        window.selectionKind === 'color' &&
        window.selectionColorMask &&
        EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
    ) {
        const m = window.selectionColorMask;
        m.data = translateSelectionColorMask(m.data, m.w, m.h, dx, dy);
        if (typeof window.illuInvalidateSelectionMaskCache === 'function') {
            window.illuInvalidateSelectionMaskCache(m);
        }
        if (typeof window.tightenColorSelectionBoundsFromMask === 'function') {
            window.tightenColorSelectionBoundsFromMask();
        }
    } else if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
        window.selectionLassoPoints = window.selectionLassoPoints.map((p) => ({
            x: p.x + dx,
            y: p.y + dy
        }));
        const xs = window.selectionLassoPoints.map((p) => p.x);
        const ys = window.selectionLassoPoints.map((p) => p.y);
        window.selectionBounds = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys)
        };
    } else {
        window.selectionBounds = { ...sb, x: sb.x + dx, y: sb.y + dy };
    }
    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
    EditorManager.render();
    return true;
};

function illuSyncSelectionBoundsFromWarpQuad(q) {
    if (!q) return;
    const xs = [q.tl.x, q.tr.x, q.br.x, q.bl.x];
    const ys = [q.tl.y, q.tr.y, q.br.y, q.bl.y];
    window.selectionBounds = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys)
    };
    if (window.selectionLassoPoints && window.selectionLassoPoints.length === 4) {
        window.selectionLassoPoints = [
            { x: q.tl.x, y: q.tl.y },
            { x: q.tr.x, y: q.tr.y },
            { x: q.br.x, y: q.br.y },
            { x: q.bl.x, y: q.bl.y }
        ];
    }
}

/**
 * Flèches / boutons (Déformation, warp-4 + session warp) : déplacement type poignée centre.
 * @returns {boolean}
 */
window.nudgeSelectionWarpSessionDelta = function (dx, dy) {
    if (dx === 0 && dy === 0) return false;
    if (!window.selectionPixelWarpActive || !window.selectionWarpQuad) return false;
    const tool = window.activeTool;
    if (tool !== 'deform' && tool !== 'warp-4') return false;

    if (tool === 'deform' && selectionWarpDeformRect) {
        const R = selectionWarpDeformRect;
        const q = window.selectionWarpQuad;
        R.rx += dx;
        R.ry += dy;
        if (!illuIsFloatingImportPending()) {
            const Wd = EditorManager.width;
            const Hd = EditorManager.height;
            const maxX = Math.max(0, Wd - R.rw);
            const maxY = Math.max(0, Hd - R.rh);
            R.rx = Math.max(0, Math.min(R.rx, maxX));
            R.ry = Math.max(0, Math.min(R.ry, maxY));
        }
        q.tl.x = R.rx;
        q.tl.y = R.ry;
        q.tr.x = R.rx + R.rw;
        q.tr.y = R.ry;
        q.br.x = R.rx + R.rw;
        q.br.y = R.ry + R.rh;
        q.bl.x = R.rx;
        q.bl.y = R.ry + R.rh;
        window.selectionBounds = { x: R.rx, y: R.ry, w: R.rw, h: R.rh };
        if (window.selectionLassoPoints && window.selectionLassoPoints.length === 4) {
            window.selectionLassoPoints = [
                { x: R.rx, y: R.ry },
                { x: R.rx + R.rw, y: R.ry },
                { x: R.rx + R.rw, y: R.ry + R.rh },
                { x: R.rx, y: R.ry + R.rh }
            ];
        }
    } else {
        const q = window.selectionWarpQuad;
        (['tl', 'tr', 'br', 'bl']).forEach((key) => {
            q[key].x += dx;
            q[key].y += dy;
        });
        if (selectionWarpDeformRect) {
            selectionWarpDeformRect.rx += dx;
            selectionWarpDeformRect.ry += dy;
        }
        illuSyncSelectionBoundsFromWarpQuad(q);
    }

    if (illuIsFloatingImportPending()) {
        illuSyncFloatingImportStagingFromDeformRect();
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        EditorManager.render({ skipUiThumbnails: true });
        return true;
    }

    const prevH = selectionWarpHandleId;
    selectionWarpHandleId = 'c';
    try {
        window.runSelectionWarpPreview({ forceCommit: true });
    } finally {
        selectionWarpHandleId = prevH;
    }
    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
    EditorManager.saveHistory('Déplacement', { patchActiveLayer: true });
    EditorManager.render();
    return true;
};

/** @deprecated alias */
window.nudgeDeformWarpDelta = window.nudgeSelectionWarpSessionDelta;

window.illuWireSelectionLayoutToolbarButtons = function () {
    const root = document.getElementById('tool-pinned-select-actions');
    if (!root || root.dataset.illuSelLayoutWired === '1') return;
    root.dataset.illuSelLayoutWired = '1';

    const centerH = document.getElementById('opt-sel-center-h');
    if (centerH) {
        centerH.onclick = () => EditorManager.centerSelection('h');
    }
    const centerV = document.getElementById('opt-sel-center-v');
    if (centerV) {
        centerV.onclick = () => EditorManager.centerSelection('v');
    }
    const centerBoth = document.getElementById('opt-sel-center-both');
    if (centerBoth) {
        centerBoth.onclick = () => EditorManager.centerSelection('both');
    }

    const alignLeft = document.getElementById('opt-sel-align-left');
    if (alignLeft) {
        alignLeft.onclick = () => EditorManager.alignSelection('left');
    }
    const alignRight = document.getElementById('opt-sel-align-right');
    if (alignRight) {
        alignRight.onclick = () => EditorManager.alignSelection('right');
    }
    const alignTop = document.getElementById('opt-sel-align-top');
    if (alignTop) {
        alignTop.onclick = () => EditorManager.alignSelection('top');
    }
    const alignBottom = document.getElementById('opt-sel-align-bottom');
    if (alignBottom) {
        alignBottom.onclick = () => EditorManager.alignSelection('bottom');
    }
    const fitCanvas = document.getElementById('opt-sel-fit-canvas');
    if (fitCanvas) {
        fitCanvas.onclick = () => EditorManager.fitSelectionToCanvas();
    }

    root.querySelectorAll('button[data-illu-nudge-dx]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const dx = parseInt(btn.getAttribute('data-illu-nudge-dx'), 10) || 0;
            const dy = parseInt(btn.getAttribute('data-illu-nudge-dy'), 10) || 0;
            const step = e.shiftKey ? 10 : 1;
            EditorManager.nudgeSelectionZone(dx, dy, { step });
        });
    });
};

function magicWandAt(pos, ev) {
    const ctx = EditorManager.activeCtx;
    if (!ctx || !EditorManager.isPixelMode) return;
    const al = EditorManager.activeLayer;
    const lx = al.x;
    const ly = al.y;
    const px = Math.floor(pos.x - lx);
    const py = Math.floor(pos.y - ly);
    const buf = al.buffer;
    const w = buf.width;
    const h = buf.height;
    if (px < 0 || py < 0 || px >= w || py >= h) return;

    const resolved =
        typeof window.illuResolveSelectionCombineOp === 'function'
            ? window.illuResolveSelectionCombineOp(ev)
            : 'new';
    const combineOp = resolved === 'subtract' ? 'subtract' : resolved === 'add' ? 'add' : null;

    const imageData = ctx.getImageData(0, 0, w, h);
    const tolUi = EditorManager.toolProps.wandTolerance ?? 32;
    const mode = EditorManager.toolProps.wandMode === 'contiguous' ? 'contiguous' : 'similar';

    const pName =
        window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t('tool.wand')
            : 'Baguette magique';
    const busy =
        window.IlluProgress && typeof window.IlluProgress.createDelayedInstantEffect === 'function'
            ? window.IlluProgress.createDelayedInstantEffect(pName, 260)
            : null;

    if (busy) busy.progress(10);

    console.log('DrawingTools: Initializing Magic Wand worker (js/tools/wand-worker.js)');
    const worker = new Worker('js/tools/wand-worker.js');
    worker.onerror = (e) => console.error('Magic Wand worker error:', e);
    worker.postMessage({
        data: imageData.data,
        width: w,
        height: h,
        startX: px,
        startY: py,
        tolerance: tolUi,
        mode: mode,
        requestId: Date.now(),
        wasmEnabled: (typeof localStorage !== 'undefined' && localStorage.getItem('settings-wasm-enabled') !== '0')
    }, [imageData.data.buffer]);

    worker.onmessage = (e) => {
        if (busy) busy.done();
        const { mask, error } = e.data;
        worker.terminate();

        if (error || !mask) return;

        if (combineOp) {
            window.combineSelectionWithNewLayerMask(mask, combineOp);
            // Removed saveHistory for selection action
        } else {
            window.selectionColorMask = {
                w,
                h,
                data: mask,
                layerId: al.id,
                origX: lx,
                origY: ly
            };
            window.selectionKind = 'color';
            if (typeof window.tightenColorSelectionBoundsFromMask === 'function') {
                window.tightenColorSelectionBoundsFromMask();
            }
        }

        window.refreshSelectionVisual({ forceFull: true });
        EditorManager.render({ skipLayerComposite: true, skipUiThumbnails: true });
        if (typeof window.disarmSelectionRectFreeCornersArm === 'function') {
            window.disarmSelectionRectFreeCornersArm();
        }
    };

    worker.onerror = (err) => {
        if (busy) busy.done();
        worker.terminate();
        console.error('Wand worker error:', err);
    };
}

/* Original blocking magicWandAt removed for performance */
function old_magicWandAt_placeholder() {
}

function applyBrushPatternStyle(ctx, pat) {
    if (pat === 'square') {
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
    } else {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }
    if (pat === 'soft') {
        const s = EditorManager.toolProps.size || 5;
        ctx.shadowBlur = Math.max(1, s * 0.85);
        ctx.shadowColor = EditorManager.activeColor;
    } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
}

function sprayDots(ctx, cx, cy, radius, color) {
    const r = Math.max(3, radius);
    const n = Math.max(6, Math.floor(r * 2.2));
    ctx.fillStyle = color;
    for (let k = 0; k < n; k++) {
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * r;
        const x = Math.floor(cx + Math.cos(ang) * rr);
        const y = Math.floor(cy + Math.sin(ang) * rr);
        ctx.fillRect(x, y, 1, 1);
    }
}

function sprayDotsErase(ctx, cx, cy, radius) {
    const r = Math.max(3, radius);
    const n = Math.max(6, Math.floor(r * 2.2));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    for (let k = 0; k < n; k++) {
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * r;
        const x = Math.floor(cx + Math.cos(ang) * rr);
        const y = Math.floor(cy + Math.sin(ang) * rr);
        ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
}

function illuRgbFromCssColor(color) {
    if (!color || typeof color !== 'string') return { r: 0, g: 0, b: 0 };
    const s = color.trim();
    const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        let h = hex[1];
        if (h.length === 3) {
            h = h
                .split('')
                .map((c) => c + c)
                .join('');
        }
        const n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return { r: 0, g: 0, b: 0 };
}

function illuBrushUsesStampMode(tool) {
    const pat = EditorManager.toolProps.brushPattern || 'round';
    if (pat === 'spray') return false;
    if (pat === 'soft') return tool === 'brush' || tool === 'eraser';
    const h = EditorManager.toolProps.brushHardness != null ? EditorManager.toolProps.brushHardness : 100;
    if (tool === 'brush' || tool === 'eraser') return h < 100;
    return false;
}

/** Crayon : bloc carré aligné sur la grille pixel, sans anticrénelage ni dureté. */
function illuPencilFillPixel(ctx, lx, ly, size, color) {
    const s = Math.max(1, Math.round(size));
    const half = Math.floor(s / 2);
    const x0 = Math.floor(lx) - half;
    const y0 = Math.floor(ly) - half;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, s, s);
    ctx.restore();
}

function illuPencilSegment(ctx, x0, y0, x1, y1, size, color) {
    const xi0 = Math.floor(x0);
    const yi0 = Math.floor(y0);
    const xi1 = Math.floor(x1);
    const yi1 = Math.floor(y1);
    const steps = Math.max(Math.abs(xi1 - xi0), Math.abs(yi1 - yi0), 1);
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        illuPencilFillPixel(
            ctx,
            Math.floor(x0 + (x1 - x0) * t),
            Math.floor(y0 + (y1 - y0) * t),
            size,
            color
        );
    }
}

function illuBrushStampSpacing(lw) {
    const s = Math.max(1, lw * 0.22);
    return Math.min(s, lw * 0.5);
}

function stampBrushDisc(ctx, cx, cy, diameter, hardnessPct, rgb, isEraser) {
    const R = Math.max(0.5, diameter / 2);
    const hf = Math.max(0, Math.min(100, hardnessPct)) / 100;
    const innerR = R * hf;
    const ir = R > 1e-6 ? innerR / R : 0;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    if (isEraser) {
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        if (innerR >= R - 0.05) {
            grad.addColorStop(1, 'rgba(0,0,0,1)');
        } else {
            grad.addColorStop(Math.min(0.999, Math.max(0.001, ir)), 'rgba(0,0,0,1)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
        }
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    } else {
        const { r, g, b } = rgb;
        grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
        if (innerR >= R - 0.05) {
            grad.addColorStop(1, `rgba(${r},${g},${b},1)`);
        } else {
            grad.addColorStop(Math.min(0.999, Math.max(0.001, ir)), `rgba(${r},${g},${b},1)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        }
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function stampBrushSquare(ctx, cx, cy, side, hardnessPct, rgb, isEraser) {
    const half = side / 2;
    const x0 = cx - half;
    const y0 = cy - half;
    const R = Math.hypot(half, half);
    const hf = Math.max(0, Math.min(100, hardnessPct)) / 100;
    const innerR = R * hf;
    const ir = R > 1e-6 ? innerR / R : 0;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    if (isEraser) {
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        if (innerR >= R - 0.05) {
            grad.addColorStop(1, 'rgba(0,0,0,1)');
        } else {
            grad.addColorStop(Math.min(0.999, Math.max(0.001, ir)), 'rgba(0,0,0,1)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, side, side);
        ctx.clip();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = grad;
        ctx.fillRect(x0, y0, side, side);
        ctx.restore();
    } else {
        const { r, g, b } = rgb;
        grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
        if (innerR >= R - 0.05) {
            grad.addColorStop(1, `rgba(${r},${g},${b},1)`);
        } else {
            grad.addColorStop(Math.min(0.999, Math.max(0.001, ir)), `rgba(${r},${g},${b},1)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, side, side);
        ctx.clip();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = grad;
        ctx.fillRect(x0, y0, side, side);
        ctx.restore();
    }
}

function stampBrushAt(ctx, tool, lx, ly) {
    const lw = Math.max(1, EditorManager.toolProps.size || 5);
    const pat = EditorManager.toolProps.brushPattern || 'round';
    
    // CUSTOM BRUSH TIP SUPPORT
    if (tool !== 'eraser' && window._illuCustomBrushTip && pat === 'custom') {
        stampBrushCustom(ctx, lx, ly, lw, window._illuCustomBrushTip);
        return;
    }

    let h = EditorManager.toolProps.brushHardness != null ? EditorManager.toolProps.brushHardness : 100;
    if (pat === 'soft') {
        h = Math.min(h, tool === 'eraser' ? 48 : 42);
    }
    const rgb = illuRgbFromCssColor(EditorManager.activeColor);
    const isEr = tool === 'eraser';
    if (pat === 'square') {
        stampBrushSquare(ctx, lx, ly, lw, h, rgb, isEr);
    } else {
        stampBrushDisc(ctx, lx, ly, lw, h, rgb, isEr);
    }
}

/** Draws the custom brush tip scaled and tinted with active color. */
function stampBrushCustom(ctx, x, y, size, tipCanvas) {
    if (!tipCanvas) return;
    const s = size;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / tipCanvas.width, s / tipCanvas.height);
    
    // TINTING logic: draw the cached tip.
    // The tip is stored pre-tinted or as alpha. 
    // For simplicity, we draw the tip as is if it's already generated for the active color,
    // or we use a temporary staging canvas to tint it.
    
    // Check if we need to rotate? Patterns usually rotate with direction in pro apps.
    // For now, fixed orientation like basic Illu brushes.
    
    ctx.globalCompositeOperation = 'source-over';
    
    // If we want to tint it dynamically to active color:
    // 1. Draw tip to temp canvas
    // 2. destination-in with original tip alpha
    // 3. source-atop with active color
    
    // PERFORMANCE optimization: reuse tinted version if color hasn't changed.
    if (!window._illuCustomBrushTinted || window._illuCustomBrushTintedColor !== EditorManager.activeColor) {
        const tinted = document.createElement('canvas');
        tinted.width = tipCanvas.width;
        tinted.height = tipCanvas.height;
        const tctx = tinted.getContext('2d');
        tctx.drawImage(tipCanvas, 0, 0);
        tctx.globalCompositeOperation = 'source-atop';
        tctx.fillStyle = EditorManager.activeColor;
        tctx.fillRect(0, 0, tinted.width, tinted.height);
        window._illuCustomBrushTinted = tinted;
        window._illuCustomBrushTintedColor = EditorManager.activeColor;
    }
    
    ctx.drawImage(window._illuCustomBrushTinted, -tipCanvas.width/2, -tipCanvas.height/2);
    ctx.restore();
}

/** Capture the current selection (pixels) into a custom brush tip. */
window.captureSelectionAsBrushTip = function() {
    if (!window.selectionBounds || typeof EditorManager === 'undefined' || !EditorManager.activeLayer) {
        alert("Veuillez d'abord faire une sélection dans un calque pixel.");
        return;
    }
    const sb = window.selectionBounds;
    const l = EditorManager.activeLayer;
    const sCanvas = l.buffer;
    
    const cw = Math.min(256, Math.ceil(sb.w));
    const ch = Math.min(256, Math.ceil(sb.h));
    
    const tip = document.createElement('canvas');
    tip.width = cw;
    tip.height = ch;
    const tctx = tip.getContext('2d');
    
    // Draw the selection onto the tip canvas
    // Needs to handle coordinate conversion (doc to layer)
    const lx = Math.floor(sb.x - l.x);
    const ly = Math.floor(sb.y - l.y);
    
    tctx.drawImage(sCanvas, lx, ly, Math.ceil(sb.w), Math.ceil(sb.h), 0, 0, cw, ch);
    
    // Convert to "Alpha Tip" (PS style: darker = more opaque, or just use original alpha)
    // We'll keep original alpha but make everything "Solid" so tinting works best.
    const idat = tctx.getImageData(0, 0, cw, ch);
    const d = idat.data;
    for (let i = 0; i < d.length; i += 4) {
        // Simple heuristic: the luminance becomes the alpha (inverse) OR just keep alpha.
        // If the selection has alpha, use it. If not (fully opaque), use lightness as alpha.
        const avg = (d[i] + d[i+1] + d[i+2]) / 3;
        const alpha = d[i+3];
        if (alpha > 5) {
            // Keep alpha, but make RGB black for tinting
            d[i] = 0; d[i+1] = 0; d[i+2] = 0;
        } else {
            // Use luminosity as alpha mask
            d[i+3] = 255 - avg;
            d[i] = 0; d[i+1] = 0; d[i+2] = 0;
        }
    }
    tctx.putImageData(idat, 0, 0);
    
    window._illuCustomBrushTip = tip;
    window._illuCustomBrushTinted = null; // reset cache
    
    // Update preview in panel
    const pPrev = document.getElementById('props-brush-preview');
    if (pPrev) {
        pPrev.width = cw;
        pPrev.height = ch;
        pPrev.getContext('2d').drawImage(tip, 0, 0);
        document.getElementById('props-brush-preview-row').hidden = false;
    }
    
    // Auto-switch brush pattern to 'custom'
    EditorManager.toolProps.brushPattern = 'custom';
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
};

window.clearCustomBrushTip = function() {
    window._illuCustomBrushTip = null;
    window._illuCustomBrushTinted = null;
    document.getElementById('props-brush-preview-row').hidden = true;
    EditorManager.toolProps.brushPattern = 'round';
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
};

/** Capture selection as a pattern for fill tool. */
window.captureSelectionAsFillPattern = function() {
    if (!window.selectionBounds || !EditorManager.activeLayer) {
        alert("Veuillez d'abord faire une sélection dans un calque pixel.");
        return;
    }
    const l = EditorManager.activeLayer;
    const sb = window.selectionBounds;
    const cw = Math.ceil(sb.w);
    const ch = Math.ceil(sb.h);
    
    if (cw > 256 || ch > 256) {
        if (!confirm("Le motif est très grand. Voulez-vous continuer ?")) return;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const tctx = canvas.getContext('2d');
    
    const lx = Math.floor(sb.x - l.x);
    const ly = Math.floor(sb.y - l.y);
    tctx.drawImage(l.buffer, lx, ly, cw, ch, 0, 0, cw, ch);
    
    window._illuFillPattern = canvas;
    window._illuFillPatternData = tctx.getImageData(0, 0, cw, ch).data;
    
    // VECTOR PATTERN SUPPORT
    if (EditorManager.mode === 'vector' && window._activeVectorShapeEl) {
        const defs = document.getElementById('vector-doc-defs');
        if (defs) {
            const patId = 'illu-pat-' + Date.now().toString(36);
            const patEl = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            patEl.setAttribute('id', patId);
            patEl.setAttribute('patternUnits', 'userSpaceOnUse');
            patEl.setAttribute('width', String(cw));
            patEl.setAttribute('height', String(ch));
            
            const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgEl.setAttribute('href', canvas.toDataURL());
            imgEl.setAttribute('width', String(cw));
            imgEl.setAttribute('height', String(ch));
            patEl.appendChild(imgEl);
            defs.appendChild(patEl);
            
            window._activeVectorShapeEl.setAttribute('fill', `url(#${patId})`);
            EditorManager.saveHistory('Motif vecteur', { type: 'vector-full', svg: EditorManager.activeProject.svgData });
            EditorManager.render();
        }
    }

    // Update preview in panel
    const pPrev = document.getElementById('props-fill-pattern-preview');
    if (pPrev) {
        pPrev.width = Math.min(cw, 128);
        pPrev.height = Math.min(ch, 128);
        pPrev.getContext('2d').drawImage(canvas, 0, 0, cw, ch, 0, 0, pPrev.width, pPrev.height);
        document.getElementById('props-fill-pattern-preview-row').hidden = false;
    }
    
    EditorManager.toolProps.fillType = 'pattern';
    if (typeof window.activeTool !== 'fill') {
        window.activateIlluToolButtonById('tool-fill');
    }
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
};

function stampBrushSegment(ctx, tool, x0, y0, x1, y1) {
    const lw = Math.max(1, EditorManager.toolProps.size || 5);
    const step = illuBrushStampSpacing(lw);
    const dist = Math.hypot(x1 - x0, y1 - y0);
    if (dist < step * 0.35) {
        stampBrushAt(ctx, tool, x1, y1);
        return;
    }
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
        const t = i / n;
        stampBrushAt(ctx, tool, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
}

function applyEraserPatternStyle(ctx, pat) {
    if (pat === 'square') {
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
    } else {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }
}

// Selection UI (window.selectionBounds = source unique pour EditorManager + outils)
/** Mode recadrage interactif : poignées visibles même avec l’outil déplacement, assombrissement hors zone. */
window.illuCropSessionActive = false;
let illuCropBoundsDrag = false;
window.illuClearCropBoundsDrag = function () {
    illuCropBoundsDrag = false;
    moveDragBoundsStart = null;
};
window.selectionBounds = null;
window.selectionInverted = false;
/** @type {'rect'|'lasso'|'color'} */
window.selectionKind = 'rect';
/** Masque 1 bit (w×h) pour sélection baguette « couleur similaire » ; coords = tampon calque. */
window.selectionColorMask = null;
/** Polygone fermé en coordonnées document (toile), relatif au projet — pour kind === 'lasso' */
window.selectionLassoPoints = null;
/** Aperçu rotation (radians) pour sélection rect — remis à 0 après bake. */
window.selectionPreviewAngleRad = 0;
window.selectionRotationDragActive = false;

let lassoDrawingPoints = null;
window.selectionPixelWarpActive = false;
window.selectionWarpQuad = null;
let selectionWarpBackupCanvas = null;
let selectionWarpFullLayerCanvas = null;
let selectionWarpOx = 0;
let selectionWarpOy = 0;
let selectionWarpSw = 0;
let selectionWarpSh = 0;
let selectionWarpHandleId = null;
/** Quad source en coords patch (0…sw/sh) pour l’homographie ; défini au début du drag. */
let selectionWarpSrcQuad = null;
/** Quad issu d’une déformation 4 coins (ordre tl,tr,br,bl dans selectionLassoPoints). */
window.selectionIsWarpQuad = false;
let selectionWarpQuadAtStart = null;
/** Glisser un rectangle de sélection avec Déformation / warp-4 sans sélection préalable. */
let deformWarpNewRectDrag = false;
/** Rectangle doc pour l’outil Déformation (symétrique) ; null si warp-4. */
let selectionWarpDeformRect = null;
let selectionWarpDeformRectAtStart = null;
/** Poignée centre (Déformation) : même offset que Déplacer — `pos - coin du cadre` au pointerdown. */
let selectionWarpDeformMoveOffset = null;
let selectionWarpSourceClearBounds = null;
let selectionWarpSourceClearLocalPoints = null;
/** Pendant le glisser d’une poignée warp : le tampon calque reste figé ; l’aperçu va sur un overlay. */
let selectionWarpHandlePointerDown = false;
/** Déformation sur collage volant (importStagingBuffer, pas le tampon calque). */
let selectionWarpImportStagingMode = false;
let selectionWarpDragLayerSnapshot = null;
let selectionWarpPreviewOverlayEl = null;
let selectionWarpBasePreviewOverlayEl = null;
let selectionWarpPatchScratchCanvas = null;
let selectionWarpChromeRaf = 0;
let selectionWarpPreviewRaf = 0;
let selectionWarpPreviewPendingOpts = null;
let selectionWarpWorkersPool = [];
let warpJobState = null;
let selectionWarpWorkerBroken = false;
let selectionWarpWorkerSessionSeq = 0;
let selectionWarpWorkerSessionId = 0;
let selectionWarpWorkerJobSeq = 0;
let selectionWarpWorkerLatestJobId = 0;
let selectionWarpWorkerBusy = false;
let selectionWarpWorkerCurrentJob = null;
let selectionWarpWorkerQueuedJob = null;
/** Fantôme pour déplacement calque entier (outil Déplacer). */
let moveLayerWholeGhostEl = null;
/** Tampon calque figé pendant le drag « pixels sélectionnés » (restore à chaque frame). */
let moveSelectionLayerSnapshot = null;
/** Propriétaire session interactive : évite courses warp / deformMove / move. */
let illuSelectionInteractionOwner = null;

const selectionOverlay = document.createElement('div');

/** Outils pixel : cadre rect. pour créer une sélection si aucune n’est active (Déplacer, Déformation…). */
function illuToolCanCreateSelectionByRectDrag() {
    if (typeof EditorManager === 'undefined' || !EditorManager.isPixelMode) return false;
    const t = window.activeTool;
    return t === 'move' || t === 'deform' || t === 'warp-4';
}

/** True si aucune sélection exploitable (création d’un nouveau cadre au glisser). */
function illuNoUsableSelectionForDeformNewRect() {
    if (typeof window.hasActivePixelSelection === 'function' && !window.hasActivePixelSelection()) return true;
    const sb = window.selectionBounds;
    if (!sb) return true;
    if (window.selectionInverted) return true;
    if (sb.w <= 2 || sb.h <= 2) return true;
    return false;
}

/** Démarre un tracé rectangulaire de sélection (combine add/sub si Maj/Ctrl). */
function illuBeginNewSelectionRectDrag(e) {
    const combineOp =
        typeof window.illuLockSelectionCombineOp === 'function'
            ? window.illuLockSelectionCombineOp(e)
            : 'new';
    const combineDown = combineOp === 'add' || combineOp === 'subtract';
    selectionCombineBackup =
        combineDown && typeof window.rasterizeCurrentSelectionToLayerMask === 'function'
            ? window.rasterizeCurrentSelectionToLayerMask()
            : null;
    window.selectionInverted = false;
    window.selectionCombineGhost = combineDown ? captureSelectionCombineGhost() : null;
    window.selectionKind = 'rect';
    window.selectionColorMask = null;
    window.selectionLassoPoints = null;
    window.selectionIsWarpQuad = false;
    window.selectionPreviewAngleRad = 0;
    window.selectionBounds = { x: startX, y: startY, w: 0, h: 0 };
    deformWarpNewRectDrag = true;
    isDrawing = true;
    if (typeof window.scheduleSelectionOverlayOnly === 'function') {
        window.scheduleSelectionOverlayOnly();
    } else if (typeof window.refreshSelectionVisual === 'function') {
        window.refreshSelectionVisual();
    }
}

selectionOverlay.id = 'selection-overlay';
selectionOverlay.style.position = 'absolute';
selectionOverlay.style.border = 'none';
selectionOverlay.style.pointerEvents = 'none';
selectionOverlay.style.display = 'none';
selectionOverlay.style.overflow = 'visible';
selectionOverlay.style.zIndex = '2';

function pointInPolygon(x, y, pts) {
    if (!pts || pts.length < 3) return true;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x;
        const yi = pts[i].y;
        const xj = pts[j].x;
        const yj = pts[j].y;
        const den = yj - yi;
        const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (Math.abs(den) < 1e-10 ? 1e-10 : den) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

/** Masque un ImageData (bbox sélection) selon lasso ou baguette — pas le rectangle englobant seul. */
window.illuMaskImageDataToActiveSelection = function (imageData, ox, oy, sw, sh) {
    if (!imageData || !imageData.data || sw < 1 || sh < 1) return imageData;
    const l = EditorManager.activeLayer;
    if (!l) return imageData;
    const lx = l.x;
    const ly = l.y;
    const d = imageData.data;
    if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
        for (let yy = 0; yy < sh; yy++) {
            for (let xx = 0; xx < sw; xx++) {
                if (!pointInPolygon(xx + ox + lx + 0.5, yy + oy + ly + 0.5, window.selectionLassoPoints)) {
                    const idx = (yy * sw + xx) * 4;
                    d[idx + 3] = 0;
                }
            }
        }
    } else if (
        window.selectionKind === 'color' &&
        window.selectionColorMask &&
        EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
    ) {
        const m = window.selectionColorMask;
        for (let yy = 0; yy < sh; yy++) {
            for (let xx = 0; xx < sw; xx++) {
                const lpx = ox + xx;
                const lpy = oy + yy;
                if (lpx < 0 || lpx >= m.w || lpy < 0 || lpy >= m.h || !m.data[lpy * m.w + lpx]) {
                    const idx = (yy * sw + xx) * 4;
                    d[idx + 3] = 0;
                }
            }
        }
    }
    return imageData;
};

/** Efface la zone sélectionnée sur le calque actif (lasso, couleur ou rect). */
function clearActiveSelectionPixelsOnLayer(ctx) {
    if (!ctx || !EditorManager.activeLayer || !EditorManager.activeLayer.buffer) return;
    const lx = EditorManager.activeLayer.x;
    const ly = EditorManager.activeLayer.y;
    const cw = EditorManager.activeLayer.buffer.width;
    const ch = EditorManager.activeLayer.buffer.height;
    const sb = window.selectionBounds;
    if (!sb) return;

    // Masque couleur (baguette) : fonctionne meme si on est sur un calque different
    // en recalculant l'offset via les coordonnees document (origX/origY du masque).
    const hasColorMask = window.selectionKind === 'color' && window.selectionColorMask;
    const colorMaskOnThisLayer =
        hasColorMask && EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask);
    const colorMaskCrossLayer =
        hasColorMask && !colorMaskOnThisLayer && window.selectionColorMask.origX != null;

    ctx.save();
    ctx.beginPath();
    if (!window.selectionInverted) {
        if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
            window.selectionLassoPoints.forEach((p, i) => {
                const px = p.x - lx;
                const py = p.y - ly;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.closePath();
            ctx.clip();
            ctx.clearRect(0, 0, cw, ch);
        } else if (colorMaskOnThisLayer) {
            const ox = sb.x - lx;
            const oy = sb.y - ly;
            ctx.rect(ox, oy, sb.w, sb.h);
            ctx.clip();
            ctx.beginPath();
            EditorManager.appendColorMaskRectsToPath(ctx, window.selectionColorMask);
            ctx.clip();
            ctx.clearRect(0, 0, cw, ch);
        } else if (colorMaskCrossLayer) {
            // Masque cree sur un autre calque : repositionner en coords document -> calque cible
            const m = window.selectionColorMask;
            const tlx = m.origX - lx;  // offset dans le tampon du calque cible
            const tly = m.origY - ly;
            const ox = sb.x - lx;
            const oy = sb.y - ly;
            ctx.rect(ox, oy, sb.w, sb.h);
            ctx.clip();
            ctx.beginPath();
            EditorManager.appendColorMaskRectsToPath(ctx, m, tlx, tly);
            ctx.clip();
            ctx.clearRect(0, 0, cw, ch);
        } else {
            ctx.rect(sb.x - lx, sb.y - ly, sb.w, sb.h);
            ctx.clip();
            ctx.clearRect(0, 0, cw, ch);
        }
    } else {
        if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
            ctx.rect(0, 0, cw, ch);
            window.selectionLassoPoints.forEach((p, i) => {
                const px = p.x - lx;
                const py = p.y - ly;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.closePath();
        } else if (colorMaskOnThisLayer) {
            ctx.rect(0, 0, cw, ch);
            EditorManager.appendColorMaskRectsToPath(ctx, window.selectionColorMask);
        } else if (colorMaskCrossLayer) {
            const m = window.selectionColorMask;
            const tlx = m.origX - lx;
            const tly = m.origY - ly;
            ctx.rect(0, 0, cw, ch);
            EditorManager.appendColorMaskRectsToPath(ctx, m, tlx, tly);
        } else {
            ctx.rect(0, 0, cw, ch);
            ctx.rect(sb.x - lx, sb.y - ly, sb.w, sb.h);
        }
        ctx.clip('evenodd');
        ctx.clearRect(0, 0, cw, ch);
    }
    ctx.restore();
}

/** Points lasso en coordonnées locales au tampon (origine = coin haut-gauche du calque). */
function selectionLassoLayerPoints() {
    const sb = window.selectionBounds;
    const pts = window.selectionLassoPoints;
    if (!sb || !pts || pts.length < 3) return null;
    const lx = EditorManager.activeLayer.x;
    const ly = EditorManager.activeLayer.y;
    return pts.map((p) => ({ x: p.x - lx, y: p.y - ly }));
}

function selectionLassoLocalFromDoc() {
    const sb = window.selectionBounds;
    const pts = window.selectionLassoPoints;
    if (!sb || !pts) return null;
    return pts.map((p) => ({ x: p.x - sb.x, y: p.y - sb.y }));
}

function applySelectionClip(ctx, layerX, layerY) {
    const sb = window.selectionBounds;
    if (typeof window.hasActivePixelSelection === 'function' && !window.hasActivePixelSelection()) return;
    if (!sb) return;
    const cw = EditorManager.activeLayer.buffer.width;
    const ch = EditorManager.activeLayer.buffer.height;
    ctx.beginPath();
    if (!window.selectionInverted) {
        if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
            const lp = selectionLassoLayerPoints();
            if (lp) {
                ctx.moveTo(lp[0].x, lp[0].y);
                for (let i = 1; i < lp.length; i++) ctx.lineTo(lp[i].x, lp[i].y);
                ctx.closePath();
                ctx.clip();
            }
        } else if (
            window.selectionKind === 'color' &&
            window.selectionColorMask
        ) {
            const m = window.selectionColorMask;
            const offX = (m.origX || 0) - layerX;
            const offY = (m.origY || 0) - layerY;
            EditorManager.appendColorMaskRectsToPath(ctx, m, offX, offY);
            ctx.clip();
        } else {
            ctx.rect(sb.x - layerX, sb.y - layerY, sb.w, sb.h);
            ctx.clip();
        }
    } else {
        // Inverted selection: paint OUTSIDE the shape
        if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
            ctx.rect(0, 0, cw, ch);
            const lp = selectionLassoLayerPoints();
            if (lp) {
                ctx.moveTo(lp[0].x, lp[0].y);
                for (let i = 1; i < lp.length; i++) ctx.lineTo(lp[i].x, lp[i].y);
                ctx.closePath();
                ctx.clip('evenodd');
            }
        } else if (window.selectionKind === 'color' && window.selectionColorMask) {
            ctx.rect(0, 0, cw, ch);
            const m = window.selectionColorMask;
            const offX = (m.origX || 0) - layerX;
            const offY = (m.origY || 0) - layerY;
            EditorManager.appendColorMaskRectsToPath(ctx, m, offX, offY);
            ctx.clip('evenodd');
        } else {
            ctx.rect(0, 0, cw, ch);
            if (sb) ctx.rect(sb.x - layerX, sb.y - layerY, sb.w, sb.h);
            ctx.clip('evenodd');
        }
    }
}

/** Contour sélection lisible : trait noir large + tirets blancs par-dessus (sans mix-blend). */
function appendPolygonOutlineSvg(parent, points, closed, isExp = false, expandPx = 0) {
    if (!points || points.length < 2) return;
    const W = EditorManager.width;
    const H = EditorManager.height;
    const z = EditorManager.getCanvasZoomLevel();
    const strokeW = 1.25 / z;
    const outlineW = strokeW * 2;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    if (closed) d += ' Z';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:0;';
    if (isExp) svg.style.opacity = '0.6';
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));

    const pOutline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pOutline.setAttribute('d', d);
    pOutline.setAttribute('stroke', isExp ? '#0000ff' : '#000000');
    pOutline.setAttribute('stroke-width', String(isExp ? (expandPx * 2) : outlineW));
    pOutline.setAttribute('fill', 'none');
    pOutline.setAttribute('stroke-linejoin', 'round');
    pOutline.setAttribute('stroke-linecap', 'round');

    const pDash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pDash.setAttribute('d', d);
    pDash.setAttribute('stroke', '#ffffff');
    pDash.setAttribute('stroke-width', String(isExp ? (expandPx * 2) : strokeW));
    pDash.setAttribute('stroke-dasharray', isExp ? `${2 / z} ${2 / z}` : `${5 / z} ${4 / z}`);
    pDash.setAttribute('fill', 'none');
    pDash.setAttribute('stroke-linejoin', 'round');
    pDash.setAttribute('stroke-linecap', 'round');

    svg.appendChild(pOutline);
    svg.appendChild(pDash);
    parent.appendChild(svg);
}

function appendLassoSvgPath(parent, points, closed) {
    appendPolygonOutlineSvg(parent, points, closed);
    const ep = window.selectionExpansionPreviewPx || 0;
    if (ep > 0 && closed) {
        // Version dilatée (visuelle)
        const z = EditorManager.getCanvasZoomLevel();
        appendPolygonOutlineSvg(parent, points, closed, true, ep);
    }
}

/** Sélection rect inversée : contour de la toile + contour intérieur du trou (coords document, fiable en hauteur/largeur). */
function appendInvertedRectMarqueeDoc(parent, sb, Wdoc, Hdoc, skipOuter = false) {
    const x = Math.max(0, Math.min(sb.x, Wdoc));
    const y = Math.max(0, Math.min(sb.y, Hdoc));
    const x2 = Math.max(x, Math.min(sb.x + sb.w, Wdoc));
    const y2 = Math.max(y, Math.min(sb.y + sb.h, Hdoc));
    const w = x2 - x;
    const h = y2 - y;
    if (!skipOuter) {
        const outer = [
            { x: 0, y: 0 },
            { x: Wdoc, y: 0 },
            { x: Wdoc, y: Hdoc },
            { x: 0, y: Hdoc }
        ];
        appendPolygonOutlineSvg(parent, outer, true);
    }
    if (w > 0.5 && h > 0.5) {
        const inner = [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h }
        ];
        appendPolygonOutlineSvg(parent, inner, true);
    }
}

window.refreshSelectionVisual = function (opts) {
    opts = opts || {};
    if (typeof EditorManager !== 'undefined' && EditorManager.mode === 'vector') {
        if (window.selectionBounds) window.selectionBounds = null;
        if (typeof window.invalidateSelectionOverlayFast === 'function') {
            window.invalidateSelectionOverlayFast();
        }
        if (window.SelectionChrome && typeof window.SelectionChrome.hideOverlay === 'function') {
            window.SelectionChrome.hideOverlay();
        } else {
            const ov0 = document.getElementById('selection-overlay');
            if (ov0) {
                ov0.style.display = 'none';
                ov0.innerHTML = '';
            }
        }
        return;
    }
    const hasDraw = lassoDrawingPoints && lassoDrawingPoints.length > 0;

    if (!opts.forceFull) {
        if (
            window.pixelShapeEdit &&
            typeof window.updatePixelShapeEditOverlayFast === 'function' &&
            window.updatePixelShapeEditOverlayFast()
        ) {
            return;
        }
        if (hasDraw && typeof window.updateLassoDrawingOverlayFast === 'function') {
            if (window.updateLassoDrawingOverlayFast(lassoDrawingPoints)) return;
        }
        if (
            window.selectionPixelWarpActive &&
            window.selectionWarpQuad &&
            !window.selectionInverted &&
            typeof window.updateWarpSelectionOverlayFast === 'function' &&
            window.updateWarpSelectionOverlayFast(window.selectionWarpQuad)
        ) {
            return;
        }
        if (
            typeof window.updateSelectionOverlayFast === 'function' &&
            window.updateSelectionOverlayFast(window.selectionBounds)
        ) {
            return;
        }
    }

    if (typeof window.invalidateSelectionOverlayFast === 'function') {
        window.invalidateSelectionOverlayFast();
    }
    let sb = window.selectionBounds;
    const W = EditorManager.width;
    const H = EditorManager.height;
    let hasMask =
        window.selectionColorMask &&
        window.selectionKind === 'color' &&
        EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask);
    if (hasMask && (!sb || sb.w < 1 || sb.h < 1) && typeof window.tightenColorSelectionBoundsFromMask === 'function') {
        window.tightenColorSelectionBoundsFromMask();
        sb = window.selectionBounds;
    }
    if (!sb && !hasDraw && !hasMask) {
        if (window.SelectionChrome && typeof window.SelectionChrome.hideOverlay === 'function') {
            window.SelectionChrome.hideOverlay();
        } else {
            selectionOverlay.style.display = 'none';
            selectionOverlay.innerHTML = '';
        }
        return;
    }
    selectionOverlay.style.display = 'block';
    selectionOverlay.innerHTML = '';
    selectionOverlay.style.left = '0';
    selectionOverlay.style.top = '0';
    selectionOverlay.style.width = W + 'px';
    selectionOverlay.style.height = H + 'px';
    selectionOverlay.style.overflow = 'visible';

    if (window.selectionCombineGhost) {
        appendSelectionCombineGhostToOverlay(selectionOverlay);
    }

    if (hasDraw) {
        appendLassoSvgPath(selectionOverlay, lassoDrawingPoints, false);
    }

    if (
        hasMask &&
        window.selectionColorMask &&
        EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
    ) {
        const m = window.selectionColorMask;
        appendBinaryMaskOutlineSvg(selectionOverlay, m.data, m.w, m.h, EditorManager.activeLayer.x, EditorManager.activeLayer.y);
        return;
    }

    if (!sb) return;

    if (
        window.selectionPixelWarpActive &&
        window.selectionWarpQuad &&
        !window.selectionInverted
    ) {
        const q = window.selectionWarpQuad;
        appendPolygonOutlineSvg(selectionOverlay, [q.tl, q.tr, q.br, q.bl], true);
        return;
    }

    if (window.selectionInverted && sb) {
        // Pour les formes complexes, on dessine d'abord la bordure du document
        appendPolygonOutlineSvg(selectionOverlay, [
            { x: 0, y: 0 },
            { x: W, y: 0 },
            { x: W, y: H },
            { x: 0, y: H }
        ], true);
        // Si c'est un rectangle simple, on utilise le helper optimisé
        if (window.selectionKind === 'rect') {
            appendInvertedRectMarqueeDoc(selectionOverlay, sb, W, H, true); // true = skip outer
            return;
        }
    }

    if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
        appendLassoSvgPath(selectionOverlay, window.selectionLassoPoints, true);
        return;
    }

    const z = EditorManager.getCanvasZoomLevel();
    const borderW = Math.max(1, 1.25 / z);
    const mkBox = (x, y, w, h, isExpansion = false) => {
        const d = document.createElement('div');
        const isCrop = window.illuCropSessionActive;
        const mainCol = isCrop ? '#ff0000' : (isExpansion ? '#0000ff' : '#000000');
        const dashCol = isCrop ? '#ffffff' : (isExpansion ? '#ffffff' : '#ffffff');
        d.style.cssText = [
            'position:absolute',
            `left:${x}px`,
            `top:${y}px`,
            `width:${Math.max(0, w)}px`,
            `height:${Math.max(0, h)}px`,
            'box-sizing:border-box',
            'pointer-events:none',
            'background:transparent',
            `outline:${Math.max(1, borderW)}px solid ${mainCol}`,
            `outline-offset:0`,
            `border:${borderW}px dashed ${dashCol}`,
            (isExpansion || isCrop) ? 'opacity:0.9' : 'box-shadow:0 0 0 1px rgba(0,0,0,0.85)'
        ].join(';');
        if (isExpansion) d.style.borderStyle = 'dotted';
        if (isCrop) {
            d.style.boxShadow = '0 0 0 1px rgba(255,0,0,0.6), 0 0 4px rgba(0,0,0,0.5)';
        }
        return d;
    };

    if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
        appendLassoSvgPath(selectionOverlay, window.selectionLassoPoints, true);
    } else {
        const ang = window.selectionPreviewAngleRad || 0;
        if (!window.selectionInverted) {
            // Expanded preview line
            if (window.selectionExpansionPreviewPx && window.selectionExpansionPreviewPx > 0) {
                const ep = window.selectionExpansionPreviewPx;
                appendPolygonOutlineSvg(selectionOverlay, [
                    { x: sb.x - ep, y: sb.y - ep },
                    { x: sb.x + sb.w + ep, y: sb.y - ep },
                    { x: sb.x + sb.w + ep, y: sb.y + sb.h + ep },
                    { x: sb.x - ep, y: sb.y + sb.h + ep }
                ], true, true, ep);
            }

            if (window.illuCropSessionActive && Math.abs(ang) < 1e-6) {
                const x0 = sb.x;
                const y0 = sb.y;
                const ww = sb.w;
                const hh = sb.h;
                const mkShade = (left, top, width, height) => {
                    if (width <= 0 || height <= 0) return;
                    const d = document.createElement('div');
                    d.className = 'illu-crop-shade';
                    d.setAttribute('aria-hidden', 'true');
                    d.style.cssText = [
                        'position:absolute',
                        `left:${left}px`,
                        `top:${top}px`,
                        `width:${width}px`,
                        `height:${height}px`,
                        'background:rgba(0,0,0,0.52)',
                        'pointer-events:none',
                        'box-sizing:border-box'
                    ].join(';');
                    selectionOverlay.appendChild(d);
                };
                mkShade(0, 0, W, y0);
                mkShade(0, y0, x0, hh);
                mkShade(x0 + ww, y0, Math.max(0, W - x0 - ww), hh);
                mkShade(0, y0 + hh, W, Math.max(0, H - y0 - hh));
            }

            if (window.illuCropSessionActive) {
                if (Math.abs(ang) < 1e-6) {
                    selectionOverlay.appendChild(mkBox(sb.x, sb.y, sb.w, sb.h));
                } else {
                    const wrap = document.createElement('div');
                    wrap.style.cssText = [
                        'position:absolute',
                        `left:${sb.x}px`,
                        `top:${sb.y}px`,
                        `width:${Math.max(0, sb.w)}px`,
                        `height:${Math.max(0, sb.h)}px`,
                        'pointer-events:none',
                        'transform-origin:center center',
                        `transform:rotate(${ang}rad)`
                    ].join(';');
                    wrap.appendChild(mkBox(0, 0, sb.w, sb.h));
                    selectionOverlay.appendChild(wrap);
                }
            } else {
                if (Math.abs(ang) < 1e-6) {
                    appendPolygonOutlineSvg(selectionOverlay, [
                        { x: sb.x, y: sb.y },
                        { x: sb.x + sb.w, y: sb.y },
                        { x: sb.x + sb.w, y: sb.y + sb.h },
                        { x: sb.x, y: sb.y + sb.h }
                    ], true);
                } else {
                    const cx = sb.x + sb.w / 2;
                    const cy = sb.y + sb.h / 2;
                    const cos = Math.cos(ang);
                    const sin = Math.sin(ang);
                    const rotatePoint = (px, py) => {
                        const dx = px - cx;
                        const dy = py - cy;
                        return {
                            x: cx + dx * cos - dy * sin,
                            y: cy + dx * sin + dy * cos
                        };
                    };
                    const pts = [
                        rotatePoint(sb.x, sb.y),
                        rotatePoint(sb.x + sb.w, sb.y),
                        rotatePoint(sb.x + sb.w, sb.y + sb.h),
                        rotatePoint(sb.x, sb.y + sb.h)
                    ];
                    appendPolygonOutlineSvg(selectionOverlay, pts, true);
                }
            }
        } else {
            appendInvertedRectMarqueeDoc(selectionOverlay, sb, W, H);
        }
    }
};

function isPixelInActiveSelection(px, py, layerX, layerY) {
    if (typeof window.hasActivePixelSelection === 'function' && !window.hasActivePixelSelection()) return true;
    if (!window.selectionBounds) return true;
    const sb = window.selectionBounds;
    const wx = px + layerX;
    const wy = py + layerY;
    let inside;
    if (window.selectionKind === 'color' && window.selectionColorMask) {
        const m = window.selectionColorMask;
        // Global document coordinates for the pixel being checked
        const docX = px + layerX;
        const docY = py + layerY;
        
        // Translate document coordinates back to the mask's local coordinates
        // using its original creation position (origX, origY)
        const mx = Math.round(docX - (m.origX || 0));
        const my = Math.round(docY - (m.origY || 0));
        
        if (mx >= 0 && mx < m.w && my >= 0 && my < m.h) {
            inside = m.data[my * m.w + mx] === 1;
        } else {
            inside = false;
        }
    } else if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
        inside = pointInPolygon(wx, wy, window.selectionLassoPoints);
    } else {
        const ang = window.selectionPreviewAngleRad || 0;
        if (Math.abs(ang) > 1e-6) {
            const cx = sb.x + sb.w / 2;
            const cy = sb.y + sb.h / 2;
            const wx = px + layerX;
            const wy = py + layerY;
            const cos = Math.cos(-ang);
            const sin = Math.sin(-ang);
            const dx = wx - cx;
            const dy = wy - cy;
            const rx = dx * cos - dy * sin;
            const ry = dx * sin + dy * cos;
            inside = (rx >= -sb.w / 2 && rx < sb.w / 2 && ry >= -sb.h / 2 && ry < sb.h / 2);
        } else {
            const rx = sb.x - layerX;
            const ry = sb.y - layerY;
            inside = px >= rx && px < rx + sb.w && py >= ry && py < ry + sb.h;
        }
    }
    return window.selectionInverted ? !inside : inside;
}

/** Exposé pour FilterManager : teste si un pixel du tampon calque (px,py) est dans la sélection courante. */
window.isPixelInActiveLayerSelection = isPixelInActiveSelection;

/** Sauvegarde masque calque avant cadre / lasso combiné (Ctrl / Alt). */
let selectionCombineBackup = null;
/** Pendant un nouveau cadre avec Ctrl : affiche l’ancienne sélection en plus du tracé courant. */
window.selectionCombineGhost = null;

function captureSelectionCombineGhost() {
    const sb = window.selectionBounds;
    const ov = document.getElementById('selection-overlay');
    if (!sb || !ov || ov.style.display === 'none' || window.selectionInverted) return null;
    return {
        kind: window.selectionKind,
        sb: { x: sb.x, y: sb.y, w: sb.w, h: sb.h },
        previewAngle: window.selectionPreviewAngleRad || 0,
        lassoPoints:
            window.selectionLassoPoints && window.selectionLassoPoints.length
                ? window.selectionLassoPoints.map((p) => ({ x: p.x, y: p.y }))
                : null,
        colorMask:
            window.selectionColorMask && EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
                ? {
                    w: window.selectionColorMask.w,
                    h: window.selectionColorMask.h,
                    data: new Uint8Array(window.selectionColorMask.data),
                    layerId: window.selectionColorMask.layerId,
                    origX: window.selectionColorMask.origX,
                    origY: window.selectionColorMask.origY
                }
                : null
    };
}

function appendSelectionCombineGhostToOverlay(parent) {
    const g = window.selectionCombineGhost;
    if (!g || !parent) return;
    const lx = EditorManager.activeLayer ? EditorManager.activeLayer.x : 0;
    const ly = EditorManager.activeLayer ? EditorManager.activeLayer.y : 0;
    if (g.kind === 'color' && g.colorMask) {
        const gx = g.colorMask.origX != null ? g.colorMask.origX : lx;
        const gy = g.colorMask.origY != null ? g.colorMask.origY : ly;
        appendBinaryMaskOutlineSvg(parent, g.colorMask.data, g.colorMask.w, g.colorMask.h, gx, gy, g.sb);
        return;
    }
    if (g.kind === 'lasso' && g.lassoPoints && g.lassoPoints.length >= 3) {
        appendLassoSvgPath(parent, g.lassoPoints, true);
        return;
    }
    const sb = g.sb;
    if (!sb) return;
    const z = EditorManager.getCanvasZoomLevel();
    const borderW = Math.max(1, 1.25 / z);
    const mkBox = (x, y, w, h) => {
        const d = document.createElement('div');
        d.style.cssText = [
            'position:absolute',
            `left:${x}px`,
            `top:${y}px`,
            `width:${Math.max(0, w)}px`,
            `height:${Math.max(0, h)}px`,
            'box-sizing:border-box',
            'pointer-events:none',
            'background:transparent',
            `outline:${Math.max(1, borderW)}px solid rgba(80,80,80,0.85)`,
            `outline-offset:0`,
            `border:${borderW}px dashed rgba(200,200,200,0.9)`,
            'box-shadow:0 0 0 1px rgba(0,0,0,0.35)'
        ].join(';');
        return d;
    };
    const ang = g.previewAngle || 0;
    if (Math.abs(ang) < 1e-6) {
        parent.appendChild(mkBox(sb.x, sb.y, sb.w, sb.h));
    } else {
        const wrap = document.createElement('div');
        wrap.style.cssText = [
            'position:absolute',
            `left:${sb.x}px`,
            `top:${sb.y}px`,
            `width:${Math.max(0, sb.w)}px`,
            `height:${Math.max(0, sb.h)}px`,
            'pointer-events:none',
            'transform-origin:center center',
            `transform:rotate(${ang}rad)`,
            'opacity:0.72'
        ].join(';');
        wrap.appendChild(mkBox(0, 0, sb.w, sb.h));
        parent.appendChild(wrap);
    }
}

function rasterizeDocAlignedRectToLayerMask(sb, layerX, layerY, lw, lh, out) {
    const x0 = sb.x;
    const y0 = sb.y;
    const x1 = sb.x + sb.w;
    const y1 = sb.y + sb.h;
    for (let ly = 0; ly < lh; ly++) {
        const wy = ly + layerY;
        for (let lx = 0; lx < lw; lx++) {
            const wx = lx + layerX;
            if (wx >= x0 && wx < x1 && wy >= y0 && wy < y1) out[ly * lw + lx] = 1;
        }
    }
}

function rasterizeDocLassoPolygonToLayerMask(pts, layerX, layerY, lw, lh, out) {
    for (let ly = 0; ly < lh; ly++) {
        const wy = ly + layerY;
        for (let lx = 0; lx < lw; lx++) {
            const wx = lx + layerX;
            if (pointInPolygon(wx, wy, pts)) out[ly * lw + lx] = 1;
        }
    }
}
window.rasterizeDocLassoPolygonToLayerMask = rasterizeDocLassoPolygonToLayerMask;

function maskOpUnion(oldD, newD, w, h) {
    const o = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) o[i] = oldD[i] | newD[i];
    return o;
}

function maskOpSubtract(oldD, newD, w, h) {
    const o = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) o[i] = oldD[i] & (newD[i] ? 0 : 1);
    return o;
}

function illuInvalidateSelectionMaskCache(m) {
    if (!m) return;
    delete m._cachedPath;
    delete m._cachedKey;
    delete m._cachedStride;
}
window.illuInvalidateSelectionMaskCache = illuInvalidateSelectionMaskCache;

function illuLayerRectFromDocBounds(sb, layerX, layerY, lw, lh) {
    if (!sb) return { x0: 0, y0: 0, x1: lw, y1: lh };
    return {
        x0: Math.max(0, Math.floor(sb.x - layerX)),
        y0: Math.max(0, Math.floor(sb.y - layerY)),
        x1: Math.min(lw, Math.ceil(sb.x - layerX + sb.w)),
        y1: Math.min(lh, Math.ceil(sb.y - layerY + sb.h))
    };
}

function illuMergeMaskOpRegion(oldD, newD, w, h, r, op) {
    const o = new Uint8Array(oldD);
    const x0 = Math.max(0, r.x0 | 0);
    const y0 = Math.max(0, r.y0 | 0);
    const x1 = Math.min(w, r.x1 | 0);
    const y1 = Math.min(h, r.y1 | 0);
    for (let y = y0; y < y1; y++) {
        const row = y * w;
        for (let x = x0; x < x1; x++) {
            const i = row + x;
            if (op === 'subtract') o[i] = oldD[i] & (newD[i] ? 0 : 1);
            else o[i] = oldD[i] | newD[i];
        }
    }
    return o;
}

/** Lissage warp : barre d’outils + réglages globaux. */
window.illuWarpUseSmoothResample = function () {
    const bar = document.getElementById('tool-warp-resampling');
    if (bar && bar.value === 'nearest') return false;
    if (bar && bar.value === 'smooth') return true;
    if (window.illuInterpolationMode === 'nearest') return false;
    if (EditorManager.toolProps && EditorManager.toolProps.warpResampling === 'nearest') return false;
    return true;
};

let selectionCombineVisualLast = 0;

window.rasterizeCurrentSelectionToLayerMask = function () {
    const l = EditorManager.activeLayer;
    if (!l || !l.buffer || !EditorManager.isPixelMode) return null;
    const lw = l.buffer.width;
    const lh = l.buffer.height;
    const out = new Uint8Array(lw * lh);
    const sb = window.selectionBounds;
    if (typeof window.hasActivePixelSelection === 'function' && !window.hasActivePixelSelection()) return out;
    if (!sb) return out;

    const layerX = l.x;
    const layerY = l.y;

    // OPTIMISATION : Ne parcourir que le cadre englobant (bounding box) de la sélection
    // On convertit les coordonnées document en coordonnées locales au calque.
    const x0 = Math.max(0, Math.floor(sb.x - layerX));
    const y0 = Math.max(0, Math.floor(sb.y - layerY));
    const x1 = Math.min(lw, Math.ceil(sb.x - layerX + sb.w));
    const y1 = Math.min(lh, Math.ceil(sb.y - layerY + sb.h));

    if (x1 <= x0 || y1 <= y0) return out;

    for (let py = y0; py < y1; py++) {
        const row = py * lw;
        for (let px = x0; px < x1; px++) {
            if (isPixelInActiveSelection(px, py, layerX, layerY)) {
                out[row + px] = 1;
            }
        }
    }
    return out;
};

window.commitLayerMaskAsSelection = function (data, w, h, opts) {
    opts = opts || {};
    const l = EditorManager.activeLayer;
    if (!l || !l.buffer || w !== l.buffer.width || h !== l.buffer.height) return false;
    const copy = new Uint8Array(data);
    let any = false;
    for (let i = 0; i < copy.length; i++) {
        if (copy[i]) {
            any = true;
            break;
        }
    }
    if (!any) {
        window.selectionBounds = null;
        window.selectionColorMask = null;
        window.selectionLassoPoints = null;
        window.selectionKind = 'rect';
        window.selectionIsWarpQuad = false;
        window.selectionInverted = false;
        window.selectionPreviewAngleRad = 0;
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
        return true;
    }
    window.selectionColorMask = { w, h, data: copy, layerId: l.id, origX: l.x, origY: l.y };
    illuInvalidateSelectionMaskCache(window.selectionColorMask);
    window.selectionKind = 'color';
    window.selectionLassoPoints = null;
    window.selectionIsWarpQuad = false;
    if (!opts.fromCombine && window.selectionMode === 'new') {
        window.selectionInverted = false;
    }
    window.selectionPreviewAngleRad = 0;
    if (typeof window.tightenColorSelectionBoundsFromMask === 'function') {
        window.tightenColorSelectionBoundsFromMask();
    }
    if (typeof window.refreshSelectionVisual === 'function') {
        window.refreshSelectionVisual();
        requestAnimationFrame(() => {
            if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        });
    }
    if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
    return true;
};

window.combineSelectionWithNewLayerMask = function (newMask, op, oldMaskOpt) {
    const l = EditorManager.activeLayer;
    if (!l || !l.buffer || !EditorManager.isPixelMode) return;
    const lw = l.buffer.width;
    const lh = l.buffer.height;
    if (newMask.length !== lw * lh) return;
    const old =
        oldMaskOpt != null && oldMaskOpt.length === lw * lh
            ? oldMaskOpt
            : window.rasterizeCurrentSelectionToLayerMask() || new Uint8Array(lw * lh);
    const nm = newMask instanceof Uint8Array ? newMask : new Uint8Array(newMask);
    let combined;
    if (op === 'subtract') combined = maskOpSubtract(old, nm, lw, lh);
    else combined = maskOpUnion(old, nm, lw, lh);
    window.commitLayerMaskAsSelection(combined, lw, lh, { fromCombine: true });
};

function initTools() {
    if (typeof window.illuSplashLog === 'function') window.illuSplashLog('Initialisation des outils de dessin...');
    const canvasHost = document.getElementById('main-canvas-container');
    container = canvasHost; // Mise à jour de la variable de module
    const svgEl = document.getElementById('drawing-svg');
    if (canvasHost && svgEl) {
        canvasHost.insertBefore(selectionOverlay, svgEl);
    } else if (canvasHost) {
        canvasHost.appendChild(selectionOverlay);
    }

    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach((btn) => {
        btn.onclick = () => {
            if (btn.disabled) return;
            if (btn.id === 'btn-deselect' || btn.id === 'illu-tb-zoom-fit') {
                if (btn.id === 'btn-deselect') {
                    if (typeof window.finalizePendingPixelLiveEdits === 'function') {
                        window.finalizePendingPixelLiveEdits();
                    }
                    EditorManager.deselectAll();
                }
                if (btn.id === 'illu-tb-zoom-fit' && typeof window.fitActiveProjectZoomToWorkspace === 'function') {
                    window.fitActiveProjectZoomToWorkspace();
                }
                // S'assurer qu'il ne reste pas actif par inadvertance
                btn.classList.remove('active');
                // L'onclick défini en HTML pour zoom-fit s'exécutera également (si non écrasé)
                return;
            }
            const prev = window.activeTool;
            if (
                typeof EditorManager.commitImportPlacementIfPending === 'function' &&
                EditorManager.commitImportPlacementIfPending()
            ) {
                /* collage volant posé avant changement d’outil */
            }
            toolBtns.forEach((b) => {
                if (b.id !== 'illu-tb-zoom-fit' && b.id !== 'btn-deselect') {
                    b.classList.remove('active');
                }
            });
            if (btn.id !== 'illu-tb-zoom-fit' && btn.id !== 'btn-deselect') {
                btn.classList.add('active');
            }
            window.activeTool = btn.id.startsWith('tool-') ? btn.id.replace('tool-', '') : btn.id;
            
            // Reset selection mode if switching away from selection tools
            if (!['select', 'wand', 'direct-select'].includes(window.activeTool)) {
                window.selectionMode = 'new';
            }

            if (
                !['select', 'warp-4'].includes(window.activeTool) &&
                typeof window.disarmSelectionRectFreeCornersArm === 'function'
            ) {
                window.disarmSelectionRectFreeCornersArm();
            }
            if (
                (window.activeTool === 'line' || window.activeTool === 'cubic-3') &&
                EditorManager.toolProps.shapeStrokeMode === 'fill'
            ) {
                EditorManager.toolProps.shapeStrokeMode = 'both';
                const sm = document.getElementById('tool-shape-mode');
                if (sm) sm.value = 'both';
            }
            if (window.activeTool !== 'cubic-3') {
                setVectorQuadBezierClickState(null);
                window._quadBezierPreviewDoc = null;
            }
            if (EditorManager.isPixelMode && prev !== window.activeTool) {
                if (typeof window.commitPixelTextSession === 'function') window.commitPixelTextSession(true);
                isDrawing = false;
                if (prev === 'move' || prev === 'deform') {
                    illuResetMoveSelectionDragArtifacts();
                    moveLayerStartPos = null;
                    moveLayerStartLassoPoints = null;
                    window._illuDeformMoveFromButtonActive = false;
                }
                if (typeof window.clearPixelToolSessions === 'function') window.clearPixelToolSessions();
            }
            window.updateToolOptionsBar();
            EditorManager.render();
            if (
                (window.activeTool === 'move' ||
                    window.activeTool === 'deform' ||
                    window.activeTool === 'warp-4') &&
                EditorManager.isPixelMode &&
                EditorManager.activeLayer
            ) {
                /* Paint.NET : l’activation de Déplacer/Déformation ne force plus une sélection plein calque. */
            }
        };
    });
    window.activeTool = 'select';

    // Tool switcher dropdown binding
    const toolSelect = document.getElementById('illu-tool-list-select');
    if (toolSelect) {
        toolSelect.addEventListener('change', () => {
            const val = toolSelect.value;
            const btnId = 'tool-' + val;
            const btn = document.getElementById(btnId);
            if (btn) btn.click();
        });
    }

    const inv = document.getElementById('opt-invert-selection');
    if (inv) inv.onclick = () => EditorManager.invertSelection();
    const all = document.getElementById('opt-select-all');
    if (all) all.onclick = () => EditorManager.selectAll();
    const optDeselect = document.getElementById('opt-deselect-selection');
    const runDeselectAll = () => {
        if (typeof window.finalizePendingPixelLiveEdits === 'function') {
            window.finalizePendingPixelLiveEdits();
        }
        if (typeof EditorManager.deselectAll === 'function') EditorManager.deselectAll();
    };
    if (optDeselect) {
        optDeselect.onclick = runDeselectAll;
    }
    const optRibbonDeselect = document.getElementById('opt-ribbon-deselect');
    if (optRibbonDeselect) {
        optRibbonDeselect.onclick = runDeselectAll;
    }
    const wireSelClipboardBtn = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    };
    const runSelClear = () => {
        if (typeof window.clearSelectionContent === 'function') window.clearSelectionContent();
    };
    const runSelCopy = () => {
        if (typeof window.ctxCopy === 'function') window.ctxCopy();
    };
    const runSelPaste = () => {
        if (typeof window.ctxPaste === 'function') window.ctxPaste();
    };
    wireSelClipboardBtn('opt-sel-clear-content', runSelClear);
    wireSelClipboardBtn('opt-sel-clear-ribbon', runSelClear);
    wireSelClipboardBtn('opt-sel-copy', runSelCopy);
    wireSelClipboardBtn('opt-sel-copy-ribbon', runSelCopy);
    wireSelClipboardBtn('opt-sel-paste', runSelPaste);
    wireSelClipboardBtn('opt-sel-paste-ribbon', runSelPaste);

    if (typeof window.setupIlluShapeToolIconToggles === 'function') window.setupIlluShapeToolIconToggles();
    if (typeof window.setupIlluBrushPatternIconToggles === 'function') window.setupIlluBrushPatternIconToggles();
    if (typeof window.illuWireSelectRectFreeCornersButtons === 'function') {
        window.illuWireSelectRectFreeCornersButtons();
    }
    if (typeof window.illuWireSelectionLayoutToolbarButtons === 'function') {
        window.illuWireSelectionLayoutToolbarButtons();
    }
    if (typeof window.illuWireWarpBarButtons === 'function') window.illuWireWarpBarButtons();

    window.updateToolOptionsBar();
    window.updateToolboxModeState();


    // Mouse Events (ignorer mousedown/mouseup « compatibilité » après un touch : sinon double handleMouseDown = tracé en points)

  

    /* Touch / stylet : Pointer Events (évite le double tir avec souris) */
    const trackClient = (e) => {
        window._illuLastClientX = e.clientX;
        window._illuLastClientY = e.clientY;
    };
    const onPointerDown = (e) => {
        // If it's a middle click (button=1) or right click (button=2), let standard mouse handlers handle it
        if (e.button != null && e.button !== 0) {
            return;
        }
        const ae = document.activeElement;
        if (ae && ae.tagName === 'INPUT' && (ae.type || '').toLowerCase() === 'range') {
            ae.blur();
        }
        // We now handle mouse via PointerEvents for better performance (coalesced events)
        if (e.isPrimary === false) {
            try {
                e.preventDefault();
            } catch (err) {
                /* ignore */
            }
            return;
        }
        /* Safari / anciens UA : bloquer le cycle mousedown/mouseup de compatibilité jusqu’au relâchement */
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
            window._illuSuppressCanvasMouseUntil = Number.POSITIVE_INFINITY;
        }
        try {
            e.preventDefault();
            container.setPointerCapture(e.pointerId);
        } catch (err) {
            /* ignore */
        }
        handleMouseDown(e);
    };

    const onPointerMoveWin = (e) => {
        /* Souris : pointermove nécessaire pour le bouton Déplacer (capture) et pour la session warp (même souci). */
        if (e.isPrimary === false) return;
        window._illuLastPointerEvent = e;
        const list = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : [e];
        if (list.length === 0) return;
        const latest = list[list.length - 1];
        window._shiftConstraintProportions = latest.shiftKey;
        trackClient(latest);
        if (!window._illuPointerMoveThrottled) {
            window._illuPointerMoveThrottled = true;
            requestAnimationFrame(() => {
                window._illuPointerMoveThrottled = false;
                const evt = window._illuLastPointerEvent;
                if (!evt) return;
                const batch =
                    typeof evt.getCoalescedEvents === 'function' ? evt.getCoalescedEvents() : [evt];
                for (const ce of batch) {
                    onGlobalMouseMove(ce);
                }
            });
        }
    };
    const syncShiftConstraintFromKey = (e) => {
        if (e && 'shiftKey' in e) window._shiftConstraintProportions = e.shiftKey;
    };
    window.addEventListener('keydown', syncShiftConstraintFromKey);
    window.addEventListener('keyup', syncShiftConstraintFromKey);
    const onPointerUpWin = (e) => {
        if (e.isPrimary === false) return;
        try {
            container.releasePointerCapture(e.pointerId);
        } catch (err) {
            /* ignore */
        }
        if (workspaceDock) {
            try {
                workspaceDock.releasePointerCapture(e.pointerId);
            } catch (err) {
                /* ignore */
            }
        }
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
            window._illuSuppressCanvasMouseUntil = performance.now() + 120;
        }
        handleMouseUp(e);
    };

        if (canvasHost) {
            canvasHost.addEventListener('pointerdown', onPointerDown, { passive: false });
        }
    window.addEventListener('pointermove', onPointerMoveWin, { passive: false });
    window.addEventListener('pointerup', onPointerUpWin);
    window.addEventListener('pointercancel', onPointerUpWin);
    window.illuCancelStrokeForGesture = function () {
        if (!isDrawing) return;
        const sx = window._illuLastClientX != null ? window._illuLastClientX : 0;
        const sy = window._illuLastClientY != null ? window._illuLastClientY : 0;
        handleMouseUp({
            button: 0,
            clientX: sx,
            clientY: sy,
            shiftKey: false,
            preventDefault() { },
            stopPropagation() { }
        });
    };

    // Status update
    let lastStatusCoordsText = '';
    container.addEventListener('mousemove', (e) => {
        trackClient(e);
        const pos = getPos(e);
        const sc = document.getElementById('status-coords');
        if (sc) {
            const rx = Math.round(pos.x);
            const ry = Math.round(pos.y);
            let nextText;
            if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
                nextText = window.IlluI18n.t('status.coords', {
                    x: rx,
                    y: ry
                });
            } else {
                nextText = `${rx}, ${ry} px`;
            }
            if (nextText !== lastStatusCoordsText) {
                sc.textContent = nextText;
                lastStatusCoordsText = nextText;
            }
        }
    });
    // Double-clic : valider pen/polygon
    container.addEventListener('dblclick', (e) => {
        const VE = window.VectorEngine;
        if (!VE) return;
        if (window.activeTool === 'pen' && VE.isPenActive()) {
            VE.penCommit();
            e.preventDefault();
            return;
        }
        if (window.activeTool === 'polygon' && VE.isPolygonActive()) {
            VE.polygonCommit();
            e.preventDefault();
            return;
        }
        if (EditorManager.mode !== 'vector') return;
        if (VE.isPenActive()) {
            VE.penClose();
            e.preventDefault();
        }
    });

    if (typeof window.illuEnsurePinnedToggleBarOrder === 'function') {
        window.illuEnsurePinnedToggleBarOrder();
    }
    if (typeof window.illuEnsureRibbonStructure === 'function') {
        window.illuEnsureRibbonStructure();
    }
    if (typeof window.illuSplashLog === 'function') window.illuSplashLog('Outils de dessin prêts.');
}

/** Barre rapide + sélecteur + toggles dans #tool-pinned-toggles (flux flex unifié). */
window.illuEnsurePinnedToggleBarOrder = function () {
    const row1 = document.getElementById('tool-options-bar-row1');
    const header = document.getElementById('tool-main-header');
    if (!row1 || !header) return;
    let pin = document.getElementById('tool-pinned-toggles');
    if (!pin) {
        pin = document.createElement('div');
        pin.id = 'tool-pinned-toggles';
        pin.className = 'tool-pinned-toggles';
        pin.setAttribute('role', 'group');
        pin.setAttribute('aria-label', 'Modes et actions sélection');
        row1.appendChild(pin);
    }
    if (header.parentElement !== pin) {
        pin.insertBefore(header, pin.firstChild);
    }
    if (pin.parentElement !== row1) {
        const stash = document.getElementById('tool-row1-hidden-sync');
        if (stash && stash.parentElement === row1) {
            row1.insertBefore(pin, stash);
        } else {
            row1.insertBefore(pin, row1.firstChild);
        }
    }
    const global = document.getElementById('tool-global-modes');
    if (global) {
        while (global.firstChild) pin.appendChild(global.firstChild);
        global.remove();
    }
    const pinChildSel =
        '#tool-main-header,#tool-pinned-select-actions,#selection-mode-group,.opt-grp';
    row1.querySelectorAll(`:scope > ${pinChildSel}`).forEach((el) => {
        if (el.parentElement !== pin) pin.appendChild(el);
    });
    const selMode = document.getElementById('selection-mode-group');
    const selActs = document.getElementById('tool-pinned-select-actions');
    if (selMode && header && selMode.parentElement === pin) {
        const before = selActs && selActs.parentElement === pin ? selActs : null;
        if (before) pin.insertBefore(selMode, before);
        else if (header.nextElementSibling !== selMode) pin.insertBefore(selMode, header.nextSibling);
    }
    if (selActs && selActs.parentElement !== pin) {
        pin.appendChild(selActs);
    }
};


function getPos(e) {
    return EditorManager.logicalPointerFromClientXY(e.clientX, e.clientY);
}

const ILLU_MIN_SELECTION_SPAN = 1;

function illuMinSelectionSpan() {
    return ILLU_MIN_SELECTION_SPAN;
}

function illuSelectionBigEnough(sb) {
    if (!sb) return false;
    return sb.w >= illuMinSelectionSpan() && sb.h >= illuMinSelectionSpan();
}

/** Aligne une sélection rectangulaire sur la grille pixel (toiles pixel / très petites). */
function illuSnapSelectionBounds(sb) {
    if (!sb) return sb;
    const w = Math.max(illuMinSelectionSpan(), Math.round(sb.w));
    const h = Math.max(illuMinSelectionSpan(), Math.round(sb.h));
    return { x: Math.floor(sb.x), y: Math.floor(sb.y), w, h };
}

/** Clic sans glisser ou micro-glisser → sélection 1×1 au pixel visé. */
function illuFinalizeRectSelectionBounds(sb, startXp, startYp) {
    if (illuSelectionBigEnough(sb)) return illuSnapSelectionBounds(sb);
    const W = EditorManager.width;
    const H = EditorManager.height;
    const x = Math.max(0, Math.min(W - 1, Math.floor(startXp)));
    const y = Math.max(0, Math.min(H - 1, Math.floor(startYp)));
    return { x, y, w: 1, h: 1 };
}

/** Maj : sélection rectangulaire = carré depuis le point de départ. */
function constrainRectSelectionDraw(startXp, startYp, posX, posY, shift) {
    let b;
    if (!shift) {
        const w = Math.abs(posX - startXp);
        const h = Math.abs(posY - startYp);
        b = { x: Math.min(posX, startXp), y: Math.min(posY, startYp), w, h };
    } else {
        const dx = posX - startXp;
        const dy = posY - startYp;
        const s = Math.max(Math.abs(dx), Math.abs(dy));
        const x = dx >= 0 ? startXp : startXp - s;
        const y = dy >= 0 ? startYp : startYp - s;
        b = { x, y, w: s, h: s };
    }
    if (EditorManager.isPixelMode) return illuSnapSelectionBounds(b);
    return b;
}

/** Maj : ligne / dégradé linéaire à angles 0°, 45°, 90°, … depuis le point de départ. */
function constrainLineEndpoint(startXp, startYp, posX, posY, shift) {
    if (!shift) return { x: posX, y: posY };
    const dx = posX - startXp;
    const dy = posY - startYp;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return { x: posX, y: posY };
    const snap = Math.PI / 4;
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / snap) * snap;
    return {
        x: startXp + Math.cos(snapped) * dist,
        y: startYp + Math.sin(snapped) * dist
    };
}
window.constrainLineEndpoint = constrainLineEndpoint;

/** Maj : rotation par pas de 45° (0°, 45°, 90°, …), comme les traits / lignes. */
function constrainRotationAngleRad(angleRad, shift) {
    if (!shift) return angleRad;
    const snap = Math.PI / 4;
    return Math.round(angleRad / snap) * snap;
}
window.constrainRotationAngleRad = constrainRotationAngleRad;

/**
 * Maj : redimensionnement de sélection en conservant le rapport largeur/hauteur d’origine.
 * `handle` : n, s, e, w, nw, ne, sw, se (comme les poignées).
 */
function constrainSelectionResizeBounds(s, handle, dx, dy, shift) {
    const minS = illuMinSelectionSpan();
    let x = s.x;
    let y = s.y;
    let w = s.w;
    let h = s.h;
    const hstr = handle || '';
    if (hstr.includes('e')) w = Math.max(minS, s.w + dx);
    if (hstr.includes('s')) h = Math.max(minS, s.h + dy);
    if (hstr.includes('w')) {
        x = s.x + dx;
        w = Math.max(minS, s.w - dx);
    }
    if (hstr.includes('n')) {
        y = s.y + dy;
        h = Math.max(minS, s.h - dy);
    }
    if (!shift) return { x, y, w, h };

    const ratio = s.w / Math.max(1e-6, s.h);
    const corner = hstr.length >= 2;

    if (corner) {
        const k = Math.max(w / Math.max(1e-6, s.w), h / Math.max(1e-6, s.h));
        w = Math.max(minS, s.w * k);
        h = Math.max(minS, s.h * k);
        if (hstr === 'se') {
            x = s.x;
            y = s.y;
        } else if (hstr === 'nw') {
            x = s.x + s.w - w;
            y = s.y + s.h - h;
        } else if (hstr === 'ne') {
            x = s.x;
            y = s.y + s.h - h;
        } else if (hstr === 'sw') {
            x = s.x + s.w - w;
            y = s.y;
        }
        return { x, y, w, h };
    }
    if (hstr === 'e') {
        w = Math.max(minS, s.w + dx);
        h = Math.max(minS, w / ratio);
        x = s.x;
        y = s.y + (s.h - h) / 2;
        return { x, y, w, h };
    }
    if (hstr === 'w') {
        w = Math.max(minS, s.w - dx);
        h = Math.max(minS, w / ratio);
        x = s.x + s.w - w;
        y = s.y + (s.h - h) / 2;
        return { x, y, w, h };
    }
    if (hstr === 's') {
        h = Math.max(minS, s.h + dy);
        w = Math.max(minS, h * ratio);
        x = s.x + (s.w - w) / 2;
        y = s.y;
        return { x, y, w, h };
    }
    if (hstr === 'n') {
        h = Math.max(minS, s.h - dy);
        w = Math.max(minS, h * ratio);
        x = s.x + (s.w - w) / 2;
        y = s.y + s.h - h;
        return { x, y, w, h };
    }
    return { x, y, w, h };
}

/** Curseur projeté sur le rectangle document (coordonnées monde). */
function illuClampPointToDocument(px, py) {
    const W = EditorManager.width;
    const H = EditorManager.height;
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) {
        return { x: px, y: py };
    }
    return {
        x: Math.max(0, Math.min(W, px)),
        y: Math.max(0, Math.min(H, py))
    };
}

function illuPointInsideDocument(px, py) {
    const W = EditorManager.width;
    const H = EditorManager.height;
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return false;
    return px >= 0 && px <= W && py >= 0 && py <= H;
}

/**
 * Clic / stylet dans la marge du workspace (hors #main-canvas-container) : démarrer une sélection
 * rect, lasso ou nouveau cadre déform ; le point document est projeté sur le bord le plus proche (voir illuClampPointToDocument).
 */
function illuWorkspaceCanStartSelectionOutsideCanvas(e) {
    if (e.button != null && e.button !== 0) return false;
    if (typeof EditorManager === 'undefined' || !EditorManager.activeProject) return false;
    if (!EditorManager.isPixelMode) return false;
    const t = e.target;
    if (!t || typeof t.closest !== 'function') return false;
    if (t.closest('#main-canvas-container')) return false;
    if (t.closest('#palette-dock-rail')) return false;
    if (t.closest('button, a, input, select, textarea, [contenteditable="true"]')) return false;
    if (t.closest('.palette-panel')) return false;
    return (
        isRectSelectionTool() ||
        isLassoSelectionTool() ||
        (illuToolCanCreateSelectionByRectDrag() && illuNoUsableSelectionForDeformNewRect())
    );
}

function clampSelectionBoundsToDocument(sb) {
    if (!sb || !EditorManager.activeProject) return sb;
    const W = EditorManager.width;
    const H = EditorManager.height;
    const minS = illuMinSelectionSpan();
    let x = sb.x;
    let y = sb.y;
    let w = Math.max(minS, sb.w | 0);
    let h = Math.max(minS, sb.h | 0);
    x = Math.max(0, Math.min(x, W - minS));
    y = Math.max(0, Math.min(y, H - minS));
    w = Math.max(minS, Math.min(w, W - x));
    h = Math.max(minS, Math.min(h, H - y));
    return illuSnapSelectionBounds({ x, y, w, h });
}

/** Collage / import en attente de validation (tampon volant). */
function illuIsFloatingImportPending() {
    const l = EditorManager.activeLayer;
    return !!(EditorManager.isPixelMode && l && l.importPlacementPending && l.importStagingBuffer);
}

function illuSetImportPlacementChromeActive(active) {
    const mcc = document.getElementById('main-canvas-container');
    if (!mcc) return;
    if (active) mcc.classList.add('illu-import-placement-active');
    else mcc.classList.remove('illu-import-placement-active');
}
window.illuSetImportPlacementChromeActive = illuSetImportPlacementChromeActive;

/** Aligne tampon volant + sélection sur le cadre Déformation (coords document). */
function illuSyncFloatingImportStagingFromDeformRect() {
    const l = EditorManager.activeLayer;
    const R = selectionWarpDeformRect;
    const st = l && l.importStagingBuffer;
    if (!illuIsFloatingImportPending() || !R || !st) return;
    l.importStagingX = Math.round(R.rx);
    l.importStagingY = Math.round(R.ry);
    if (typeof window.syncSelectionToImportPlacementLayer === 'function') {
        window.syncSelectionToImportPlacementLayer();
    }
    if (typeof EditorManager._syncImportStagingDomView === 'function') {
        const stack = document.getElementById('pixel-layer-stack');
        if (stack && EditorManager.activeLayer) {
            const li = EditorManager.layers.indexOf(EditorManager.activeLayer);
            EditorManager._syncImportStagingDomView(stack, EditorManager.activeLayer, (li + 1) * 10 + 1);
        }
    }
}

function illuPointInSelectionBoundsDoc(px, py, pad) {
    const sb = window.selectionBounds;
    if (!sb) return false;
    const z = EditorManager.getCanvasZoomLevel() || 1;
    const p = pad != null ? pad : 6 / z;
    return px >= sb.x - p && px <= sb.x + sb.w + p && py >= sb.y - p && py <= sb.y + sb.h + p;
}

/** Hors recadrage : Déplacer / Déformation / warp-4 autorisent un cadre (et calque) hors toile. */
function illuClampSelectionBoundsToDocumentForActiveTool() {
    if (illuIsFloatingImportPending()) return false;
    if (window.illuCropSessionActive) return true;
    const t = window.activeTool;
    if (t === 'move' || t === 'deform' || t === 'warp-4') return false;
    return true;
}

function onGlobalMouseMove(e) {
    window._illuLastClientX = e.clientX;
    window._illuLastClientY = e.clientY;
    window._shiftConstraintProportions = e.shiftKey;
    if (typeof window.syncQuadBezierDraftPointer === 'function') {
        window.syncQuadBezierDraftPointer(e.clientX, e.clientY);
    }
    if (window.isPanning && window.EditorManager && EditorManager.activeProject) {
        const p = EditorManager.activeProject;
        p.canvasPanX = window.panDragOrigin.x + (e.clientX - window.panStart.x);
        p.canvasPanY = window.panDragOrigin.y + (e.clientY - window.panStart.y);
        EditorManager.applyCanvasViewportOnly();
    }
    /* Glisser depuis le bouton central Déformation : pointermove porte le tracé ; mousemove seul est peu fiable (foreignObject SVG). Sans PointerEvent, on garde mousemove. Idem session warp (poignée centre / capture). */
    if (
        (window._illuDeformMoveFromButtonActive || window.selectionPixelWarpActive) &&
        e.type === 'mousemove' &&
        typeof window.PointerEvent !== 'undefined'
    ) {
        return;
    }
    handleMouseMove(e);
}

/** RVB+A du pixel composite à la position (coordonnées document / px logiques). */
function sampleImageRgbAtMainCanvasPos(pos) {
    if (!EditorManager.isPixelMode) return null;
    if (
        EditorManager.pixelDomLayerViewsActive &&
        EditorManager.pixelDomLayerViewsActive() &&
        typeof EditorManager.sampleDocCompositeRgb === 'function'
    ) {
        return EditorManager.sampleDocCompositeRgb(pos);
    }
    const c = document.getElementById('drawing-canvas');
    if (!c) return null;
    const x = Math.min(c.width - 1, Math.max(0, Math.floor(pos.x)));
    const y = Math.min(c.height - 1, Math.max(0, Math.floor(pos.y)));
    try {
        const d = c.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2], a: d[3] };
    } catch (err) {
        return null;
    }
}

/**
 * Échantillonne la scène vecteur (SVG sans l’UI) au point document ; async car rendu image.
 * @param {{x:number,y:number}} pos
 * @param {(rgb: {r:number,g:number,b:number,a:number}|null) => void} cb
 */
function sampleVectorCompositeAtPos(pos, cb) {
    const svg = document.getElementById('drawing-svg');
    if (!svg || EditorManager.mode !== 'vector') {
        cb(null);
        return;
    }
    const w = EditorManager.width;
    const h = EditorManager.height;
    const clone = svg.cloneNode(true);
    const ui = clone.querySelector('#svg-ui');
    if (ui) ui.remove();
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    let svgText;
    try {
        svgText = new XMLSerializer().serializeToString(clone);
    } catch (err) {
        cb(null);
        return;
    }
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    const img = new Image();
    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, w);
        c.height = Math.max(1, h);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        const x = Math.min(c.width - 1, Math.max(0, Math.floor(pos.x)));
        const y = Math.min(c.height - 1, Math.max(0, Math.floor(pos.y)));
        try {
            ctx.drawImage(img, 0, 0, c.width, c.height);
            const d = ctx.getImageData(x, y, 1, 1).data;
            cb({ r: d[0], g: d[1], b: d[2], a: d[3] });
        } catch (err) {
            cb(null);
        }
    };
    img.onerror = () => cb(null);
    img.src = url;
}

function removeVectorElementGradientIfAny(el) {
    const gid = el.getAttribute('data-vgrad');
    if (!gid) return;
    const node = document.getElementById(gid);
    if (node && node.parentNode) node.remove();
    el.removeAttribute('data-vgrad');
}

/** Coordonnées attribut (repère parent de la forme) → repère racine du <svg> (aligné sur logicalPointer / viewBox). */
function vectorShapeAttrPointToRoot(shape, lx, ly) {
    const svg = shape.ownerSVGElement;
    if (!svg) return { x: lx, y: ly };
    try {
        const pt = svg.createSVGPoint();
        pt.x = lx;
        pt.y = ly;
        const tag = (shape.tagName || '').toLowerCase();
        const useOwn = tag === 'polygon' || tag === 'polyline' || tag === 'path';
        const m = useOwn ? shape.getCTM() : shape.parentElement && shape.parentElement.getCTM();
        if (!m) return { x: lx, y: ly };
        const o = pt.matrixTransform(m);
        return { x: o.x, y: o.y };
    } catch (e) {
        return { x: lx, y: ly };
    }
}

/** Coordonnées document / pointeur → repère parent pour écrire x, y, d, etc. */
function vectorDocToShapeAttrPoint(shape, rx, ry) {
    const svg = shape.ownerSVGElement;
    if (!svg) return { x: rx, y: ry };
    try {
        const pt = svg.createSVGPoint();
        pt.x = rx;
        pt.y = ry;
        const tag = (shape.tagName || '').toLowerCase();
        const useOwn = tag === 'polygon' || tag === 'polyline' || tag === 'path';
        const m = useOwn ? shape.getCTM() : shape.parentElement && shape.parentElement.getCTM();
        if (!m) return { x: rx, y: ry };
        const o = pt.matrixTransform(m.inverse());
        return { x: o.x, y: o.y };
    } catch (e) {
        return { x: rx, y: ry };
    }
}

function vectorPlaceAnchorRoot(shape, anchorEl, lx, ly, hz) {
    const r = vectorShapeAttrPointToRoot(shape, lx, ly);
    anchorEl.setAttribute('x', String(r.x - hz));
    anchorEl.setAttribute('y', String(r.y - hz));
}

const VECTOR_PATH_ANCHOR_CAP = 200;
const VECTOR_POLY_ANCHOR_CAP = 120;

function parseIlluPolygonPoints(pointsStr) {
    if (!pointsStr || typeof pointsStr !== 'string') return [];
    const nums = pointsStr.trim().match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    const out = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
        out.push([parseFloat(nums[i]), parseFloat(nums[i + 1])]);
    }
    return out;
}

function collectSvgPathAnchorPoints(d) {
    if (!d || typeof d !== 'string') return [];
    const pts = [];
    const re =
        /[MmLl]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(?:,\s*|\s+)\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/g;
    let m;
    while ((m = re.exec(d)) !== null) {
        pts.push([parseFloat(m[1]), parseFloat(m[2])]);
        if (pts.length >= VECTOR_PATH_ANCHOR_CAP) break;
    }
    return pts;
}

function clearAnchors() {
    const svgUI = document.getElementById('svg-ui');
    if (svgUI) {
        const boxesG = svgUI.querySelector('#svg-ui-boxes');
        const anchorsG = svgUI.querySelector('#svg-ui-anchors');
        if (boxesG) boxesG.innerHTML = '';
        if (anchorsG) anchorsG.innerHTML = '';
    }
    window._activeVectorShapeEl = null;
}

function createSvgAnchor(x, y, index, cursor) {
    const sz = EditorManager.svgUiHandleSizeDoc();
    const h = sz / 2;
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', String(x - h));
    r.setAttribute('y', String(y - h));
    r.setAttribute('width', String(sz));
    r.setAttribute('height', String(sz));
    r.setAttribute('fill', '#ffffff');
    r.setAttribute('stroke', '#0066cc');
    r.setAttribute('stroke-width', '1');
    r.setAttribute('vector-effect', 'non-scaling-stroke');
    r.setAttribute('class', 'svg-anchor');
    r.setAttribute('pointer-events', 'all');
    r.dataset.index = String(index);
    r.style.cursor =
        typeof window.illuResizeHandleCursor === 'function'
            ? window.illuResizeHandleCursor(cursor || 'pointer')
            : cursor || 'pointer';
    return r;
}

function illuSetSvgAdjustAnchorPoints(adjEl, rootX, rootY) {
    if (!adjEl) return;
    const s = Math.max(4, EditorManager.svgUiHandleSizeDoc() * 0.55);
    adjEl.setAttribute(
        'points',
        [
            [rootX, rootY - s],
            [rootX + s, rootY],
            [rootX, rootY + s],
            [rootX - s, rootY]
        ]
            .map(([a, b]) => `${a},${b}`)
            .join(' ')
    );
}

function syncShapeAdjustAnchorPosition(anchorsG, shape) {
    if (!anchorsG || !shape) return;
    const adjEls = anchorsG.querySelectorAll('.svg-adjust-anchor');
    if (!adjEls.length) return;
    const tag = (shape.tagName || '').toLowerCase();
    if (tag === 'polygon' && shape.getAttribute('data-illu-triangle') === '1') {
        const st = illuTriangleReadState(shape);
        adjEls.forEach((adjEl) => {
            const t = adjEl.dataset.adjustType || '';
            let local = null;
            if (t === 'triangle-adj-r') local = illuTriangleAdjustHandleLocal(st, 'r');
            else if (t === 'triangle-adj-l' || t === 'triangle-adj') local = illuTriangleAdjustHandleLocal(st, 'l');
            if (!local) return;
            const r = vectorShapeAttrPointToRoot(shape, local.x, local.y);
            illuSetSvgAdjustAnchorPoints(adjEl, r.x, r.y);
        });
        return;
    }
    const adjEl = adjEls[0];
    let local = null;
    if (tag === 'rect' && shape.getAttribute('data-illu-round') === '1') {
        const x = parseFloat(shape.getAttribute('x')) || 0;
        const y = parseFloat(shape.getAttribute('y')) || 0;
        const w = parseFloat(shape.getAttribute('width')) || 0;
        const h = parseFloat(shape.getAttribute('height')) || 0;
        const rx = parseFloat(shape.getAttribute('rx')) || 0;
        local = illuRoundRectAdjustHandleLocal(x, y, w, h, rx);
    }
    if (!local) return;
    const r = vectorShapeAttrPointToRoot(shape, local.x, local.y);
    illuSetSvgAdjustAnchorPoints(adjEl, r.x, r.y);
}

function createSvgAdjustAnchor(rootX, rootY, adjustType) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    illuSetSvgAdjustAnchorPoints(p, rootX, rootY);
    p.setAttribute('class', 'svg-adjust-anchor');
    p.setAttribute('pointer-events', 'all');
    p.dataset.adjustType = adjustType;
    p.style.cursor = 'move';
    return p;
}

function appendShapeAdjustAnchors(svgUI, shape) {
    const tag = (shape.tagName || '').toLowerCase();
    if (tag === 'rect' && shape.getAttribute('data-illu-round') === '1') {
        const x = parseFloat(shape.getAttribute('x')) || 0;
        const y = parseFloat(shape.getAttribute('y')) || 0;
        const w = parseFloat(shape.getAttribute('width')) || 0;
        const h = parseFloat(shape.getAttribute('height')) || 0;
        const rx = parseFloat(shape.getAttribute('rx')) || 0;
        const local = illuRoundRectAdjustHandleLocal(x, y, w, h, rx);
        const r = vectorShapeAttrPointToRoot(shape, local.x, local.y);
        svgUI.appendChild(createSvgAdjustAnchor(r.x, r.y, 'round-adj'));
        return;
    }
    if (tag === 'polygon' && shape.getAttribute('data-illu-triangle') === '1') {
        const st = illuTriangleReadState(shape);
        const localL = illuTriangleAdjustHandleLocal(st, 'l');
        const localR = illuTriangleAdjustHandleLocal(st, 'r');
        const rL = vectorShapeAttrPointToRoot(shape, localL.x, localL.y);
        const rR = vectorShapeAttrPointToRoot(shape, localR.x, localR.y);
        svgUI.appendChild(createSvgAdjustAnchor(rL.x, rL.y, 'triangle-adj-l'));
        svgUI.appendChild(createSvgAdjustAnchor(rR.x, rR.y, 'triangle-adj-r'));
    }
}

function appendAnchorsForShape(svgUI, shape) {
    const tag = shape.tagName.toLowerCase();
    const rootAnchor = (lx, ly, index, cursor) => {
        const r = vectorShapeAttrPointToRoot(shape, lx, ly);
        svgUI.appendChild(createSvgAnchor(r.x, r.y, index, cursor));
    };
    if (tag === 'foreignobject') {
        const x = parseFloat(shape.getAttribute('x')) || 0;
        const y = parseFloat(shape.getAttribute('y')) || 0;
        const w = parseFloat(shape.getAttribute('width')) || 0;
        const h = parseFloat(shape.getAttribute('height')) || 0;
        const corners = [
            [x, y, 0],
            [x + w, y, 1],
            [x, y + h, 2],
            [x + w, y + h, 3]
        ];
        corners.forEach(([cx, cy, i]) => rootAnchor(cx, cy, i));
    } else if (tag === 'rect') {
        const x = parseFloat(shape.getAttribute('x')) || 0;
        const y = parseFloat(shape.getAttribute('y')) || 0;
        const w = parseFloat(shape.getAttribute('width')) || 0;
        const h = parseFloat(shape.getAttribute('height')) || 0;
        const cursors = ['nw-resize', 'n-resize', 'ne-resize', 'w-resize', 'e-resize', 'sw-resize', 's-resize', 'se-resize'];
        const pts = [
            [x, y, 0],
            [x + w / 2, y, 1],
            [x + w, y, 2],
            [x, y + h / 2, 3],
            [x + w, y + h / 2, 4],
            [x, y + h, 5],
            [x + w / 2, y + h, 6],
            [x + w, y + h, 7]
        ];
        pts.forEach(([cx, cy, i]) => rootAnchor(cx, cy, i, cursors[i] || 'pointer'));
        appendShapeAdjustAnchors(svgUI, shape);
    } else if (tag === 'line') {
        const x1 = parseFloat(shape.getAttribute('x1')) || 0;
        const y1 = parseFloat(shape.getAttribute('y1')) || 0;
        const x2 = parseFloat(shape.getAttribute('x2')) || 0;
        const y2 = parseFloat(shape.getAttribute('y2')) || 0;
        rootAnchor(x1, y1, 0);
        rootAnchor(x2, y2, 1);
    } else if (tag === 'ellipse' || tag === 'circle') {
        const cx = parseFloat(shape.getAttribute('cx')) || 0;
        const cy = parseFloat(shape.getAttribute('cy')) || 0;
        const rx = tag === 'circle' ? parseFloat(shape.getAttribute('r')) || 0 : parseFloat(shape.getAttribute('rx')) || 0;
        const ry = tag === 'circle' ? rx : parseFloat(shape.getAttribute('ry')) || 0;
        const x = cx - rx;
        const y = cy - ry;
        const w = rx * 2;
        const h = ry * 2;
        const cursors = ['nw-resize', 'n-resize', 'ne-resize', 'w-resize', 'e-resize', 'sw-resize', 's-resize', 'se-resize'];
        const pts = [
            [x, y, 0],
            [x + w / 2, y, 1],
            [x + w, y, 2],
            [x, y + h / 2, 3],
            [x + w, y + h / 2, 4],
            [x, y + h, 5],
            [x + w / 2, y + h, 6],
            [x + w, y + h, 7]
        ];
        pts.forEach(([px, py, i]) => rootAnchor(px, py, i, cursors[i] || 'pointer'));
    } else if (tag === 'polygon' && shape.getAttribute('data-illu-triangle') === '1') {
        const st = illuTriangleReadState(shape);
        const { x, y, w, h } = st;
        const cursors = ['nw-resize', 'n-resize', 'ne-resize', 'w-resize', 'e-resize', 'sw-resize', 's-resize', 'se-resize'];
        const pts = [
            [x, y, 0],
            [x + w / 2, y, 1],
            [x + w, y, 2],
            [x, y + h / 2, 3],
            [x + w, y + h / 2, 4],
            [x, y + h, 5],
            [x + w / 2, y + h, 6],
            [x + w, y + h, 7]
        ];
        pts.forEach(([cx, cy, i]) => rootAnchor(cx, cy, i, cursors[i] || 'pointer'));
        appendShapeAdjustAnchors(svgUI, shape);
    } else if (tag === 'polygon' || tag === 'polyline') {
        const pp = parseIlluPolygonPoints(shape.getAttribute('points') || '').slice(0, VECTOR_POLY_ANCHOR_CAP);
        pp.forEach(([cx, cy], i) => rootAnchor(cx, cy, i));
    } else if (tag === 'path') {
        const d = shape.getAttribute('d') || '';
        if (shape.getAttribute('data-illu-quad-3') === '1') {
            const pq = parseIlluQuadPath(d);
            if (pq) {
                [
                    [pq.x0, pq.y0],
                    [pq.qx, pq.qy],
                    [pq.x1, pq.y1]
                ].forEach(([cx, cy], i) => rootAnchor(cx, cy, i));
                return;
            }
        }
        if (shape.getAttribute('data-illu-line-straight') === '1') {
            const p = parseIlluStraightLinePath(d);
            if (p) {
                [[p.x1, p.y1], [p.x2, p.y2]].forEach(([cx, cy], i) => rootAnchor(cx, cy, i));
                return;
            }
        }
        if (shape.getAttribute('data-illu-stroke-only') === '1') {
            illuNormalizeImportedStrokePath(shape);
            const d2 = shape.getAttribute('d') || '';
            if (shape.getAttribute('data-illu-line-straight') === '1') {
                const p = parseIlluStraightLinePath(d2);
                if (p) {
                    [[p.x1, p.y1], [p.x2, p.y2]].forEach(([cx, cy], i) => rootAnchor(cx, cy, i));
                    return;
                }
            }
        }
        if (shape.getAttribute('data-illu-line-cubic') === '1') {
            const p = parseIlluLinePath(d);
            if (p) {
                [
                    [p.x1, p.y1],
                    [p.c1x, p.c1y],
                    [p.c2x, p.c2y],
                    [p.x2, p.y2]
                ].forEach(([cx, cy], i) => rootAnchor(cx, cy, i));
                return;
            }
        }
        collectSvgPathAnchorPoints(d).forEach(([px, py], idx) => rootAnchor(px, py, idx));
    } else if (tag === 'text') {
        const x = parseFloat(shape.getAttribute('x')) || 0;
        const y = parseFloat(shape.getAttribute('y')) || 0;
        rootAnchor(x, y, 0);
    }
    appendVectorRotationHandle(svgUI, shape);
}

function generateAnchors(shape) {
    const svgUI = document.getElementById('svg-ui');
    if (!svgUI || !shape) return;
    // Keep boxes and anchors separate so multi-selection visuals persist.
    let boxesG = svgUI.querySelector('#svg-ui-boxes');
    let anchorsG = svgUI.querySelector('#svg-ui-anchors');
    if (!boxesG) {
        boxesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        boxesG.setAttribute('id', 'svg-ui-boxes');
        svgUI.appendChild(boxesG);
    }
    if (!anchorsG) {
        anchorsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        anchorsG.setAttribute('id', 'svg-ui-anchors');
        svgUI.appendChild(anchorsG);
    }
    anchorsG.innerHTML = '';
    appendAnchorsForShape(anchorsG, shape);
    window._activeVectorShapeEl = shape;
}

window.regenerateVectorAnchorsOnly = function (shape) {
    const svgUI = document.getElementById('svg-ui');
    if (!svgUI || !shape) return;
    let anchorsG = svgUI.querySelector('#svg-ui-anchors');
    if (!anchorsG) {
        anchorsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        anchorsG.setAttribute('id', 'svg-ui-anchors');
        svgUI.appendChild(anchorsG);
    }
    anchorsG.innerHTML = '';
    appendAnchorsForShape(anchorsG, shape);
    window._activeVectorShapeEl = shape;
};

window.syncVectorSelectionAfterUiRedraw = function () {
    if (activeVectorShape && !activeVectorShape.isConnected) {
        activeVectorShape = null;
        activeAnchor = null;
        activeAnchorIndex = -1;
    }
};

function syncAnchors() {
    if (!EditorManager.activeVectorSelection.length) return;
    const svgUI = document.getElementById('svg-ui');
    if (!svgUI) return;
    let boxesG = svgUI.querySelector('#svg-ui-boxes');
    let anchorsG = svgUI.querySelector('#svg-ui-anchors');
    if (!boxesG) {
        boxesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        boxesG.setAttribute('id', 'svg-ui-boxes');
        svgUI.appendChild(boxesG);
    }
    if (!anchorsG) {
        anchorsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        anchorsG.setAttribute('id', 'svg-ui-anchors');
        svgUI.appendChild(anchorsG);
    }
    
    // We only show interactive handles for the "primary" active shape (the last one selected)
    // for deep editing, but we should highlight all selected shapes.
    const primary = EditorManager.activeVectorSelection[EditorManager.activeVectorSelection.length - 1];
    const sh = primary; 
    
    // Draw dashed boxes for all selected elements (clear previous first)
    boxesG.innerHTML = '';
    const z = EditorManager.activeProject.zoom || 1;
    EditorManager.activeVectorSelection.forEach(el => {
        try {
            const r = el.getBBox();
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', String(r.x));
            rect.setAttribute('y', String(r.y));
            rect.setAttribute('width', String(r.width));
            rect.setAttribute('height', String(r.height));
            rect.setAttribute('fill', 'none');
            rect.setAttribute('stroke', '#0a5ebd');
            rect.setAttribute('stroke-width', String(1 / z));
            rect.setAttribute('stroke-dasharray', '4 4');
            rect.setAttribute('vector-effect', 'non-scaling-stroke');
            rect.setAttribute('pointer-events', 'none');
            rect.classList.add('svg-selection-box');
            boxesG.appendChild(rect);
        } catch(e) {}
    });

    const hz = EditorManager.svgUiHandleSizeDoc() / 2;
    const tag = primary.tagName.toLowerCase();
    const anchors = [...anchorsG.querySelectorAll('.svg-anchor')];
    if (tag === 'rect' || tag === 'foreignobject') {
        const x = parseFloat(sh.getAttribute('x')) || 0;
        const y = parseFloat(sh.getAttribute('y')) || 0;
        const w = parseFloat(sh.getAttribute('width')) || 0;
        const h = parseFloat(sh.getAttribute('height')) || 0;
        const pts =
            tag === 'foreignobject'
                ? [
                    [x, y],
                    [x + w, y],
                    [x, y + h],
                    [x + w, y + h]
                ]
                : [
                    [x, y],
                    [x + w / 2, y],
                    [x + w, y],
                    [x, y + h / 2],
                    [x + w, y + h / 2],
                    [x, y + h],
                    [x + w / 2, y + h],
                    [x + w, y + h]
                ];
        pts.forEach((pt, i) => {
            if (anchors[i]) vectorPlaceAnchorRoot(sh, anchors[i], pt[0], pt[1], hz);
        });
        if (tag === 'rect') syncShapeAdjustAnchorPosition(anchorsG, sh);
    } else if (tag === 'line') {
        const x1 = parseFloat(activeVectorShape.getAttribute('x1')) || 0;
        const y1 = parseFloat(activeVectorShape.getAttribute('y1')) || 0;
        const x2 = parseFloat(activeVectorShape.getAttribute('x2')) || 0;
        const y2 = parseFloat(activeVectorShape.getAttribute('y2')) || 0;
        if (anchors[0]) vectorPlaceAnchorRoot(sh, anchors[0], x1, y1, hz);
        if (anchors[1]) vectorPlaceAnchorRoot(sh, anchors[1], x2, y2, hz);
    } else if (tag === 'ellipse' || tag === 'circle') {
        const cx = parseFloat(activeVectorShape.getAttribute('cx')) || 0;
        const cy = parseFloat(activeVectorShape.getAttribute('cy')) || 0;
        const rx = tag === 'circle' ? parseFloat(activeVectorShape.getAttribute('r')) || 0 : parseFloat(activeVectorShape.getAttribute('rx')) || 0;
        const ry = tag === 'circle' ? rx : parseFloat(activeVectorShape.getAttribute('ry')) || 0;
        const x = cx - rx;
        const y = cy - ry;
        const w = rx * 2;
        const h = ry * 2;
        const pts = [
            [x, y],
            [x + w / 2, y],
            [x + w, y],
            [x, y + h / 2],
            [x + w, y + h / 2],
            [x, y + h],
            [x + w / 2, y + h],
            [x + w, y + h]
        ];
        pts.forEach((pt, i) => {
            if (anchors[i]) vectorPlaceAnchorRoot(sh, anchors[i], pt[0], pt[1], hz);
        });
        syncShapeAdjustAnchorPosition(anchorsG, sh);
    } else if (tag === 'polygon' && sh.getAttribute('data-illu-triangle') === '1') {
        const st = illuTriangleReadState(sh);
        const { x, y, w, h } = st;
        const pts = [
            [x, y],
            [x + w / 2, y],
            [x + w, y],
            [x, y + h / 2],
            [x + w, y + h / 2],
            [x, y + h],
            [x + w / 2, y + h],
            [x + w, y + h]
        ];
        pts.forEach((pt, i) => {
            if (anchors[i]) vectorPlaceAnchorRoot(sh, anchors[i], pt[0], pt[1], hz);
        });
        syncShapeAdjustAnchorPosition(anchorsG, sh);
    } else if (tag === 'polygon' || tag === 'polyline') {
        const pp = parseIlluPolygonPoints(sh.getAttribute('points') || '').slice(0, VECTOR_POLY_ANCHOR_CAP);
        pp.forEach((pt, i) => {
            if (anchors[i]) vectorPlaceAnchorRoot(sh, anchors[i], pt[0], pt[1], hz);
        });
    } else if (tag === 'path') {
        if (activeVectorShape.getAttribute('data-illu-quad-3') === '1') {
            const pq = parseIlluQuadPath(activeVectorShape.getAttribute('d') || '');
            if (pq && anchors.length >= 3) {
                const pts = [
                    [pq.x0, pq.y0],
                    [pq.qx, pq.qy],
                    [pq.x1, pq.y1]
                ];
                pts.forEach((pt, i) => {
                    if (anchors[i]) vectorPlaceAnchorRoot(sh, anchors[i], pt[0], pt[1], hz);
                });
            }
        } else if (activeVectorShape.getAttribute('data-illu-line-cubic') === '1') {
            const p = parseIlluLinePath(activeVectorShape.getAttribute('d') || '');
            if (p && anchors.length >= 4) {
                const pts = [
                    [p.x1, p.y1],
                    [p.c1x, p.c1y],
                    [p.c2x, p.c2y],
                    [p.x2, p.y2]
                ];
                pts.forEach((pt, i) => {
                    if (anchors[i]) vectorPlaceAnchorRoot(sh, anchors[i], pt[0], pt[1], hz);
                });
            }
        } else {
            const pathPts = collectSvgPathAnchorPoints(activeVectorShape.getAttribute('d') || '');
            pathPts.forEach((pt, i) => {
                if (anchors[i]) vectorPlaceAnchorRoot(sh, anchors[i], pt[0], pt[1], hz);
            });
        }
    } else if (tag === 'text') {
        const x = parseFloat(sh.getAttribute('x')) || 0;
        const y = parseFloat(sh.getAttribute('y')) || 0;
        if (anchors[0]) vectorPlaceAnchorRoot(sh, anchors[0], x, y, hz);
    }
    syncVectorRotationHandlePosition(anchorsG, sh);
}

window.clearAnchors = clearAnchors;

const SVG_NS = 'http://www.w3.org/2000/svg';

let vectorMoveTarget = null;
let vectorMoveWholeLayer = false;
let vectorMoveStartPointer = null;
let vectorMoveInitial = null;
let vectorDidMove = false;
/** Clic déplacer sur une forme : sélection d’abord, glisser au-delà du seuil pour déplacer */
let vectorMovePendingHit = null;
let vectorMovePointerDown = null;
/** { el, sx, sy, kind: 'line' | 'shape' } pendant un glissé avec l'outil dégradé */
let vectorGradientDrag = null;
/** Courbe Q à 3 clics : { phase: 1 | 2, p0, p1? } — miroir sur window pour la signature drawUI. */
let vectorQuadBezierClickState = null;
function setVectorQuadBezierClickState(st) {
    vectorQuadBezierClickState = st;
    window.vectorQuadBezierClickState = st;
}
window.setVectorQuadBezierClickState = setVectorQuadBezierClickState;

/** Couleur primaire (fenêtre couleurs) → remplissage des formes. */
function shapePrimaryFillCss() {
    const p = EditorManager.primaryColor;
    if (p && typeof EditorManager.cssRgbaFromPart === 'function') {
        return EditorManager.cssRgbaFromPart(p);
    }
    if (p) {
        return `rgba(${p.r},${p.g},${p.b},${(p.a != null ? p.a : 255) / 255})`;
    }
    return typeof EditorManager.activeColor === 'string' ? EditorManager.activeColor : '#000000';
}

/** Couleur secondaire → contour / bordure des formes. */
function shapeSecondaryStrokeCss() {
    return makeShapeSecondaryColor();
}

/** Trait des outils ligne, courbe et plume → couleur primaire. */
function shapeLineStrokeCss() {
    return shapePrimaryFillCss();
}

function vectorSecondaryStrokeCss() {
    return shapeSecondaryStrokeCss();
}

window.shapePrimaryFillCss = shapePrimaryFillCss;
window.shapeSecondaryStrokeCss = shapeSecondaryStrokeCss;
window.shapeLineStrokeCss = shapeLineStrokeCss;

function setVectorGradientColorStops(gradEl, c1, c2, method) {
    if (!gradEl) return;
    while (gradEl.firstChild) gradEl.removeChild(gradEl.firstChild);
    const m =
        method ||
        (typeof window.illuGetGradientMethod === 'function' ? window.illuGetGradientMethod() : 'simple');
    if (
        m === 'smart' &&
        typeof EditorManager !== 'undefined' &&
        typeof EditorManager.rgbToHsv === 'function' &&
        typeof EditorManager.hsvToRgb === 'function' &&
        typeof window.illuParseColorToRgb === 'function'
    ) {
        const rgb0 = window.illuParseColorToRgb(c1);
        const rgb1 = window.illuParseColorToRgb(c2);
        const hsv0 = EditorManager.rgbToHsv(rgb0.r, rgb0.g, rgb0.b);
        const hsv1 = EditorManager.rgbToHsv(rgb1.r, rgb1.g, rgb1.b);
        let h0 = hsv0.h;
        let h1 = hsv1.h;
        const dh = h1 - h0;
        if (dh > 180) h1 -= 360;
        else if (dh < -180) h1 += 360;
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const h = (h0 + t * (h1 - h0) + 360) % 360;
            const s = hsv0.s + t * (hsv1.s - hsv0.s);
            const v = hsv0.v + t * (hsv1.v - hsv0.v);
            const rgb = EditorManager.hsvToRgb(h, s, v);
            const a = rgb0.a * (1 - t) + rgb1.a * t;
            const stop = document.createElementNS(SVG_NS, 'stop');
            stop.setAttribute('offset', `${Math.round(t * 100)}%`);
            stop.setAttribute('stop-color', `rgba(${rgb.r},${rgb.g},${rgb.b},${a / 255})`);
            gradEl.appendChild(stop);
        }
        return;
    }
    const s0 = document.createElementNS(SVG_NS, 'stop');
    s0.setAttribute('offset', '0%');
    s0.setAttribute('stop-color', c1);
    const s1 = document.createElementNS(SVG_NS, 'stop');
    s1.setAttribute('offset', '100%');
    s1.setAttribute('stop-color', c2);
    gradEl.appendChild(s0);
    gradEl.appendChild(s1);
}

function ensureVectorLinearGradient(defs, id, x1, y1, x2, y2, c1, c2) {
    let lg = document.getElementById(id);
    if (!lg || lg.tagName.toLowerCase() !== 'lineargradient') {
        if (lg) lg.remove();
        lg = document.createElementNS(SVG_NS, 'linearGradient');
        lg.setAttribute('id', id);
        lg.setAttribute('gradientUnits', 'userSpaceOnUse');
        defs.appendChild(lg);
    }
    lg.setAttribute('x1', String(x1));
    lg.setAttribute('y1', String(y1));
    lg.setAttribute('x2', String(x2));
    lg.setAttribute('y2', String(y2));
    setVectorGradientColorStops(lg, c1, c2);
}

function ensureVectorRadialGradient(defs, id, cx, cy, r, c1, c2) {
    let rg = document.getElementById(id);
    if (!rg || rg.tagName.toLowerCase() !== 'radialgradient') {
        if (rg) rg.remove();
        rg = document.createElementNS(SVG_NS, 'radialGradient');
        rg.setAttribute('id', id);
        rg.setAttribute('gradientUnits', 'userSpaceOnUse');
        defs.appendChild(rg);
    }
    rg.setAttribute('cx', String(cx));
    rg.setAttribute('cy', String(cy));
    rg.setAttribute('r', String(Math.max(1, r)));
    setVectorGradientColorStops(rg, c1, c2);
}

function parseIlluLinePath(d) {
    const m = String(d || '')
        .trim()
        .match(
            /^M\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s+C\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s*$/i
        );
    if (!m) return null;
    return {
        x1: parseFloat(m[1]),
        y1: parseFloat(m[2]),
        c1x: parseFloat(m[3]),
        c1y: parseFloat(m[4]),
        c2x: parseFloat(m[5]),
        c2y: parseFloat(m[6]),
        x2: parseFloat(m[7]),
        y2: parseFloat(m[8])
    };
}

function formatIlluLinePath(p) {
    return `M ${p.x1} ${p.y1} C ${p.c1x} ${p.c1y} ${p.c2x} ${p.c2y} ${p.x2} ${p.y2}`;
}

/** Segment droit M…L… (outil trait + Shift, imports SVG). */
function parseIlluStraightLinePath(d) {
    return illuParseSimpleLineSegmentD(d);
}

function illuParseSimpleLineSegmentD(d) {
    const s = String(d || '')
        .trim()
        .replace(/,/g, ' ');
    let m = s.match(/^M\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s+L\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s*$/i);
    if (m) {
        return { x1: parseFloat(m[1]), y1: parseFloat(m[2]), x2: parseFloat(m[3]), y2: parseFloat(m[4]) };
    }
    m = s.match(/^M\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s+l\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s*$/i);
    if (m) {
        const x1 = parseFloat(m[1]);
        const y1 = parseFloat(m[2]);
        return { x1, y1, x2: x1 + parseFloat(m[3]), y2: y1 + parseFloat(m[4]) };
    }
    return null;
}

function formatIlluStraightLinePath(x1, y1, x2, y2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
}

window.illuParseSimpleLineSegmentD = illuParseSimpleLineSegmentD;
window.formatIlluStraightLinePath = formatIlluStraightLinePath;
window.parseIlluStraightLinePath = parseIlluStraightLinePath;

function illuNormalizeImportedStrokePath(el) {
    if (!el || (el.tagName || '').toLowerCase() !== 'path') return;
    const d = el.getAttribute('d') || '';
    const seg = illuParseSimpleLineSegmentD(d);
    if (seg) {
        el.setAttribute('d', formatIlluStraightLinePath(seg.x1, seg.y1, seg.x2, seg.y2));
        el.setAttribute('data-illu-line-straight', '1');
        el.setAttribute('data-illu-stroke-only', '1');
    }
}

window.illuNormalizeImportedStrokePath = illuNormalizeImportedStrokePath;

function illuVectorIsEditableStrokeElement(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'line') return true;
    if (tag !== 'path') return false;
    return (
        el.getAttribute('data-illu-stroke-only') === '1' ||
        el.getAttribute('data-illu-line-straight') === '1' ||
        el.getAttribute('data-illu-line-cubic') === '1'
    );
}

window.illuVectorIsEditableStrokeElement = illuVectorIsEditableStrokeElement;

/** Courbe quadratique SVG (outil 3 clics) : M + Q */
function parseIlluQuadPath(d) {
    const m = String(d || '')
        .trim()
        .match(/^M\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s+Q\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s*$/i);
    if (!m) return null;
    return {
        x0: parseFloat(m[1]),
        y0: parseFloat(m[2]),
        qx: parseFloat(m[3]),
        qy: parseFloat(m[4]),
        x1: parseFloat(m[5]),
        y1: parseFloat(m[6])
    };
}

function formatIlluQuadPath(p) {
    return `M ${p.x0} ${p.y0} Q ${p.qx} ${p.qy} ${p.x1} ${p.y1}`;
}

/**
 * Ajuste le point de contrôle Q d’une quadratique P0–P2 : 0 % = sur la corde (droite),
 * 100 % = position choisie, 200 % = écart doublé (plus arrondi).
 */
function adjustQuadControlForBulge(x0, y0, qx, qy, x1, y1, bulgePct) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-10) return { qx, qy };
    const t = ((qx - x0) * dx + (qy - y0) * dy) / len2;
    const projx = x0 + t * dx;
    const projy = y0 + t * dy;
    const k = Math.max(0, (bulgePct != null ? Number(bulgePct) : 100) / 100);
    return { qx: projx + (qx - projx) * k, qy: projy + (qy - projy) * k };
}

function getToolQuadCurveBulgePct() {
    return EditorManager.toolProps && EditorManager.toolProps.quadCurveBulge != null
        ? EditorManager.toolProps.quadCurveBulge
        : 100;
}

window.requestQuadBezierDraftRefresh = function () {
    if (window.activeTool !== 'cubic-3' || !vectorQuadBezierClickState) return;
    if (_quadDraftRaf) return;
    _quadDraftRaf = requestAnimationFrame(() => {
        _quadDraftRaf = 0;
        if (typeof EditorManager !== 'undefined' && EditorManager.render) EditorManager.render();
    });
};

function lineCapInsetPx(cap, strokeW) {
    const W = Math.max(4, strokeW * 2.5);
    const r = Math.max(1.2, strokeW * 0.55);
    if (cap === 'arrow' || cap === 'diamond') return W;
    if (cap === 'round') return r;
    return 0;
}

function quadBezierPointAt(x0, y0, qx, qy, x1, y1, t) {
    const u = 1 - t;
    return {
        x: u * u * x0 + 2 * u * t * qx + t * t * x1,
        y: u * u * y0 + 2 * u * t * qy + t * t * y1
    };
}

function splitQuadBezierAt(x0, y0, qx, qy, x1, y1, t) {
    const l1x = x0 + (qx - x0) * t;
    const l1y = y0 + (qy - y0) * t;
    const l2x = qx + (x1 - qx) * t;
    const l2y = qy + (y1 - qy) * t;
    const mx = l1x + (l2x - l1x) * t;
    const my = l1y + (l2y - l1y) * t;
    return {
        left: { x0, y0, qx: l1x, qy: l1y, x1: mx, y1: my },
        right: { x0: mx, y0: my, qx: l2x, qy: l2y, x1, y1 }
    };
}

function findQuadTForChordInsetFromEnd(x0, y0, qx, qy, x1, y1, inset) {
    if (inset <= 0) return 1;
    const end = quadBezierPointAt(x0, y0, qx, qy, x1, y1, 1);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) * 0.5;
        const p = quadBezierPointAt(x0, y0, qx, qy, x1, y1, mid);
        const d = Math.hypot(p.x - end.x, p.y - end.y);
        if (d >= inset) lo = mid;
        else hi = mid;
    }
    return lo;
}

function findQuadTForChordInsetFromStart(x0, y0, qx, qy, x1, y1, inset) {
    if (inset <= 0) return 0;
    const start = quadBezierPointAt(x0, y0, qx, qy, x1, y1, 0);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) * 0.5;
        const p = quadBezierPointAt(x0, y0, qx, qy, x1, y1, mid);
        const d = Math.hypot(p.x - start.x, p.y - start.y);
        if (d >= inset) hi = mid;
        else lo = mid;
    }
    return hi;
}

function trimQuadBezierForLineCaps(x0, y0, qx, qy, x1, y1, strokeW, startCap, endCap) {
    let c = { x0, y0, qx, qy, x1, y1 };
    const inset0 = lineCapInsetPx(startCap, strokeW);
    const inset1 = lineCapInsetPx(endCap, strokeW);
    if (inset0 > 0) {
        const t0 = findQuadTForChordInsetFromStart(c.x0, c.y0, c.qx, c.qy, c.x1, c.y1, inset0);
        if (t0 > 1e-5 && t0 < 1 - 1e-5) c = splitQuadBezierAt(c.x0, c.y0, c.qx, c.qy, c.x1, c.y1, t0).right;
    }
    if (inset1 > 0) {
        const t1 = findQuadTForChordInsetFromEnd(c.x0, c.y0, c.qx, c.qy, c.x1, c.y1, inset1);
        if (t1 > 1e-5 && t1 < 1 - 1e-5) c = splitQuadBezierAt(c.x0, c.y0, c.qx, c.qy, c.x1, c.y1, t1).left;
    }
    return c;
}

function quadBezierTangentUnitAt(x0, y0, qx, qy, x1, y1, t) {
    const u = 1 - t;
    const dx = 2 * u * (qx - x0) + 2 * t * (x1 - qx);
    const dy = 2 * u * (qy - y0) + 2 * t * (y1 - qy);
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return { x: 1, y: 0 };
    return { x: dx / L, y: dy / L };
}

function drawPixelQuadCurveEndpointDecor(ctx, x0, y0, qx, qy, x1, y1, strokeW, color, startCap, endCap) {
    if (typeof window.illuDrawPixelLineEndpointDecor !== 'function') return;
    const cap0 = startCap || 'none';
    const cap1 = endCap || 'none';
    const d = 1;
    const ts = quadBezierTangentUnitAt(x0, y0, qx, qy, x1, y1, 0);
    const te = quadBezierTangentUnitAt(x0, y0, qx, qy, x1, y1, 1);
    if (cap0 !== 'none') {
        window.illuDrawPixelLineEndpointDecor(
            ctx,
            x0,
            y0,
            x0 + ts.x * d,
            y0 + ts.y * d,
            strokeW,
            color,
            cap0,
            'none'
        );
    }
    if (cap1 !== 'none') {
        window.illuDrawPixelLineEndpointDecor(
            ctx,
            x1 - te.x * d,
            y1 - te.y * d,
            x1,
            y1,
            strokeW,
            color,
            'none',
            cap1
        );
    }
}

window.illuDrawPixelQuadCurveEndpointDecor = drawPixelQuadCurveEndpointDecor;

window.illuStrokeQuadraticWithLineCaps = function (
    ctx,
    x0,
    y0,
    qx,
    qy,
    x1,
    y1,
    strokeW,
    strokeStyle,
    cap0,
    cap1
) {
    const c0 = cap0 || 'none';
    const c1 = cap1 || 'none';
    const bothRound = c0 === 'round' && c1 === 'round';
    const trimmed = trimQuadBezierForLineCaps(x0, y0, qx, qy, x1, y1, strokeW, c0, c1);
    ctx.beginPath();
    ctx.moveTo(trimmed.x0, trimmed.y0);
    ctx.quadraticCurveTo(trimmed.qx, trimmed.qy, trimmed.x1, trimmed.y1);
    ctx.lineWidth = strokeW;
    ctx.lineCap = bothRound ? 'round' : 'butt';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
    drawPixelQuadCurveEndpointDecor(ctx, x0, y0, qx, qy, x1, y1, strokeW, strokeStyle, c0, c1);
};

function strokePixelQuadCurve(ctx, x0, y0, qx, qy, x1, y1, strokeW) {
    const mode = EditorManager.toolProps.shapeStrokeMode || 'both';
    const fillType = EditorManager.toolProps.fillType || 'solid';
    if (mode === 'fill') return;
    const cap0 = EditorManager.toolProps.lineCapStart || 'none';
    const cap1 = EditorManager.toolProps.lineCapEnd || 'none';
    const strokeCss =
        fillType === 'gradient'
            ? createShapeFillGradient(ctx, 'line', 0, 0, 0, 0, x0, y0, 0, 0, x1, y1)
            : shapeLineStrokeCss();
    window.illuStrokeQuadraticWithLineCaps(ctx, x0, y0, qx, qy, x1, y1, strokeW, strokeCss, cap0, cap1);
}

let _quadDraftRaf = 0;
window.syncQuadBezierDraftPointer = function (clientX, clientY) {
    if (window.activeTool !== 'cubic-3' || !vectorQuadBezierClickState) {
        window._quadBezierPreviewDoc = null;
        return;
    }
    window._quadBezierPreviewDoc = EditorManager.logicalPointerFromClientXY(clientX, clientY);
    if (_quadDraftRaf) return;
    _quadDraftRaf = requestAnimationFrame(() => {
        _quadDraftRaf = 0;
        if (typeof EditorManager !== 'undefined' && EditorManager.render) EditorManager.render();
    });
};

window.drawQuadBezierDraftInSvgUi = function (svgUI) {
    if (!svgUI || window.activeTool !== 'cubic-3' || !vectorQuadBezierClickState) return;
    const pr = window._quadBezierPreviewDoc;
    const st = vectorQuadBezierClickState;
    const NS = 'http://www.w3.org/2000/svg';
    const z = EditorManager.getCanvasZoomLevel() || 1;
    const mkDot = (x, y, fill) => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(x));
        c.setAttribute('cy', String(y));
        c.setAttribute('r', String(5 / z));
        c.setAttribute('fill', fill);
        c.setAttribute('stroke', '#003d7a');
        c.setAttribute('stroke-width', String(1 / z));
        c.setAttribute('vector-effect', 'non-scaling-stroke');
        c.setAttribute('pointer-events', 'none');
        return c;
    };
    if (st.phase === 1 && st.p0) {
        svgUI.appendChild(mkDot(st.p0.x, st.p0.y, '#ffe08a'));
        if (pr) {
            const line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', String(st.p0.x));
            line.setAttribute('y1', String(st.p0.y));
            line.setAttribute('x2', String(pr.x));
            line.setAttribute('y2', String(pr.y));
            line.setAttribute('stroke', '#0a5ebd');
            line.setAttribute('stroke-width', String(1.25 / z));
            line.setAttribute('stroke-dasharray', '4 3');
            line.setAttribute('vector-effect', 'non-scaling-stroke');
            line.setAttribute('pointer-events', 'none');
            svgUI.appendChild(line);
        }
    } else if (st.phase === 2 && st.p0 && st.p1) {
        svgUI.appendChild(mkDot(st.p0.x, st.p0.y, '#ffe08a'));
        svgUI.appendChild(mkDot(st.p1.x, st.p1.y, '#ffb84d'));
        const end = pr || st.p1;
        const adj = adjustQuadControlForBulge(
            st.p0.x,
            st.p0.y,
            st.p1.x,
            st.p1.y,
            end.x,
            end.y,
            getToolQuadCurveBulgePct()
        );
        const d = `M ${st.p0.x} ${st.p0.y} Q ${adj.qx} ${adj.qy} ${end.x} ${end.y}`;
        const path = document.createElementNS(NS, 'path');
        const draftSw = Math.max(1, EditorManager.toolProps.size || 2);
        const draftStroke = shapeLineStrokeCss();
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', draftStroke);
        path.setAttribute('stroke-width', String(draftSw));
        path.setAttribute('stroke-linecap', 'butt');
        path.setAttribute('data-illu-quad-3', '1');
        path.setAttribute('stroke-dasharray', '5 4');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        path.setAttribute('pointer-events', 'none');
        svgUI.appendChild(path);
        if (typeof window.vectorApplyLineEndpointMarkers === 'function') {
            window.vectorApplyLineEndpointMarkers(path);
        }
    }
};

function cubicLineDefaults(x1, y1, x2, y2) {
    const dx = (x2 - x1) / 3;
    const dy = (y2 - y1) / 3;
    return { x1, y1, c1x: x1 + dx, c1y: y1 + dy, c2x: x1 + 2 * dx, c2y: y1 + 2 * dy, x2, y2 };
}

function vectorStrokeColorForMarkers(el) {
    const s = el.getAttribute('stroke');
    if (!s || String(s).trim().startsWith('url(')) return null;
    return s;
}

function ensureLineArrowMarker(defs, id, color, sw, forEnd) {
    let m = document.getElementById(id);
    const W = Math.max(8, sw * 3.5);
    const H = Math.max(6, sw * 2.5);
    const refX = forEnd ? String(W) : '0';
    if (!m) {
        m = document.createElementNS(SVG_NS, 'marker');
        m.setAttribute('id', id);
        m.setAttribute('markerUnits', 'userSpaceOnUse');
        const p = document.createElementNS(SVG_NS, 'path');
        if (forEnd) {
            m.setAttribute('markerWidth', String(W));
            m.setAttribute('markerHeight', String(H));
            m.setAttribute('refX', refX);
            m.setAttribute('refY', String(H / 2));
            m.setAttribute('orient', 'auto');
            p.setAttribute('d', `M0,0 L${W},${H / 2} L0,${H} z`);
        } else {
            m.setAttribute('markerWidth', String(W));
            m.setAttribute('markerHeight', String(H));
            m.setAttribute('refX', refX);
            m.setAttribute('refY', String(H / 2));
            m.setAttribute('orient', 'auto-start-reverse');
            p.setAttribute('d', `M${W},0 L0,${H / 2} L${W},${H} z`);
        }
        p.setAttribute('fill', color);
        m.appendChild(p);
        defs.appendChild(m);
    } else {
        m.setAttribute('refX', refX);
        m.setAttribute('refY', String(H / 2));
        const p = m.querySelector('path');
        if (p) p.setAttribute('fill', color);
    }
    return id;
}

function ensureLineDiamondMarker(defs, id, color, sw, forEnd) {
    const S = Math.max(6, sw * 2.2);
    const refX = forEnd ? String(S) : '0';
    let m = document.getElementById(id);
    if (!m) {
        m = document.createElementNS(SVG_NS, 'marker');
        m.setAttribute('id', id);
        m.setAttribute('markerUnits', 'userSpaceOnUse');
        m.setAttribute('markerWidth', String(S));
        m.setAttribute('markerHeight', String(S));
        m.setAttribute('refX', refX);
        m.setAttribute('refY', String(S / 2));
        m.setAttribute('orient', forEnd ? 'auto' : 'auto-start-reverse');
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute(
            'points',
            forEnd
                ? `0,${S / 2} ${S / 2},0 ${S},${S / 2} ${S / 2},${S}`
                : `${S},${S / 2} ${S / 2},0 0,${S / 2} ${S / 2},${S}`
        );
        poly.setAttribute('fill', color);
        m.appendChild(poly);
        defs.appendChild(m);
    } else {
        m.setAttribute('refX', refX);
        m.setAttribute('refY', String(S / 2));
        const poly = m.querySelector('polygon');
        if (poly) poly.setAttribute('fill', color);
    }
    return id;
}

function ensureLineRoundMarker(defs, id, color, sw, forEnd) {
    const r = Math.max(2, sw / 2);
    const span = r * 2;
    const box = span * 1.1;
    const refX = forEnd ? String(span) : '0';
    let m = document.getElementById(id);
    if (!m) {
        m = document.createElementNS(SVG_NS, 'marker');
        m.setAttribute('id', id);
        m.setAttribute('markerUnits', 'userSpaceOnUse');
        m.setAttribute('markerWidth', String(box));
        m.setAttribute('markerHeight', String(box));
        m.setAttribute('refX', refX);
        m.setAttribute('refY', String(box / 2));
        m.setAttribute('orient', forEnd ? 'auto' : 'auto-start-reverse');
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', String(r));
        c.setAttribute('cy', String(box / 2));
        c.setAttribute('r', String(r));
        c.setAttribute('fill', color);
        m.appendChild(c);
        defs.appendChild(m);
    } else {
        m.setAttribute('refX', refX);
        m.setAttribute('refY', String(box / 2));
        m.setAttribute('orient', forEnd ? 'auto' : 'auto-start-reverse');
        const c = m.querySelector('circle');
        if (c) {
            c.setAttribute('fill', color);
            c.setAttribute('cx', String(r));
            c.setAttribute('cy', String(box / 2));
            c.setAttribute('r', String(r));
        }
    }
    return id;
}

function illuVectorPathHasLineEndpoints(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'line') return true;
    if (tag !== 'path') return false;
    return (
        el.getAttribute('data-illu-line-cubic') === '1' || el.getAttribute('data-illu-quad-3') === '1'
    );
}

window.illuVectorPathHasLineEndpoints = illuVectorPathHasLineEndpoints;

window.vectorApplyLineEndpointMarkers = function (el) {
    if (!illuVectorPathHasLineEndpoints(el)) return;
    const tag = (el.tagName || '').toLowerCase();
    el.removeAttribute('marker-start');
    el.removeAttribute('marker-end');
    const tp = EditorManager.toolProps;
    const startCap = tp.lineCapStart || 'none';
    const endCap = tp.lineCapEnd || 'none';
    const sw = Math.max(1, parseFloat(el.getAttribute('stroke-width') || '2'));
    const bothRound = startCap === 'round' && endCap === 'round';
    el.setAttribute('stroke-linecap', bothRound ? 'round' : 'butt');
    const color = vectorStrokeColorForMarkers(el);
    if (!color) return;
    const defs = document.getElementById('vector-doc-defs');
    if (!defs) return;
    const safeCol = color.replace(/[^#a-z0-9]/gi, '');
    const mk = (kind, pos) => {
        const id = `illu-cap-${kind}-${pos}-${safeCol}-${Math.round(sw * 10)}`;
        if (kind === 'arrow') return ensureLineArrowMarker(defs, id, color, sw, pos === 'e');
        if (kind === 'diamond') return ensureLineDiamondMarker(defs, id, color, sw, pos === 'e');
        return ensureLineRoundMarker(defs, id, color, sw, pos === 'e');
    };
    if (startCap === 'arrow') el.setAttribute('marker-start', `url(#${mk('arrow', 's')})`);
    else if (startCap === 'diamond') el.setAttribute('marker-start', `url(#${mk('diamond', 's')})`);
    else if (startCap === 'round' && !bothRound) el.setAttribute('marker-start', `url(#${mk('round', 's')})`);

    if (endCap === 'arrow') el.setAttribute('marker-end', `url(#${mk('arrow', 'e')})`);
    else if (endCap === 'diamond') el.setAttribute('marker-end', `url(#${mk('diamond', 'e')})`);
    else if (endCap === 'round' && !bothRound) el.setAttribute('marker-end', `url(#${mk('round', 'e')})`);
};

function vectorEnsureGradientForHit(el) {
    const mode = EditorManager.toolProps.shapeStrokeMode || 'both';
    const fillType = EditorManager.toolProps.fillType || 'solid';
    if (fillType !== 'gradient') return;
    const tag = (el.tagName || '').toLowerCase();
    const isLine =
        tag === 'line' ||
        (tag === 'path' && el.getAttribute('data-illu-line-cubic') === '1') ||
        (tag === 'path' && el.getAttribute('data-illu-quad-3') === '1');
    const doFill = mode !== 'stroke' && fillType !== 'none';
    const doStroke = mode !== 'fill';

    if (isLine) {
        if (!doStroke) return;
        if (!el.getAttribute('data-vgrad')) {
            const gid = `vgrad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            el.setAttribute('data-vgrad', gid);
            el.setAttribute('stroke', `url(#${gid})`);
        }
        return;
    }
    if (!doFill) return;
    if (!el.getAttribute('data-vgrad')) {
        const gid = `vgrad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        el.setAttribute('data-vgrad', gid);
        el.setAttribute('fill', `url(#${gid})`);
    }
}

function syncVectorGradientOnShape(el, kind, sx, sy, px, py) {
    const gid = el.getAttribute('data-vgrad');
    if (!gid) return;
    const defs = document.getElementById('vector-doc-defs');
    if (!defs) return;
    const c1 = shapePrimaryFillCss();
    const c2 = shapeSecondaryStrokeCss();
    const gradType = document.getElementById('tool-shape-grad-type')?.value || 'linear';
    const angleRad = ((EditorManager.toolProps.shapeGradAngle || 0) * Math.PI) / 180;

    if (kind === 'line') {
        const lc = shapeLineStrokeCss();
        ensureVectorLinearGradient(defs, gid, sx, sy, px, py, lc, lc);
        return;
    }

    const x = Math.min(sx, px);
    const y = Math.min(sy, py);
    const w = Math.abs(px - sx);
    const h = Math.abs(py - sy);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const L = Math.max(w, h, 8) * 0.9;

    if (gradType === 'radial') {
        const old = document.getElementById(gid);
        if (old) old.remove();
        const r = Math.max(w, h) / 2 || L / 2;
        ensureVectorRadialGradient(defs, gid, cx, cy, r, c1, c2);
        el.setAttribute('fill', `url(#${gid})`);
    } else {
        const gx1 = cx - Math.cos(angleRad) * L;
        const gy1 = cy - Math.sin(angleRad) * L;
        const gx2 = cx + Math.cos(angleRad) * L;
        const gy2 = cy + Math.sin(angleRad) * L;
        ensureVectorLinearGradient(defs, gid, gx1, gy1, gx2, gy2, c1, c2);
    }
}

function applyVectorShapePaint(el, kind) {
    const mode = EditorManager.toolProps.shapeStrokeMode || 'both';
    const fillType = EditorManager.toolProps.fillType || 'solid';
    const sw = Math.max(1, EditorManager.toolProps.size || 2);
    const primary = shapePrimaryFillCss();
    const strokeCol = kind === 'line' ? shapeLineStrokeCss() : shapeSecondaryStrokeCss();
    const doFill = mode !== 'stroke' && fillType !== 'none';
    const doStroke = mode !== 'fill';

    el.removeAttribute('data-vgrad');

    if (kind === 'line') {
        el.setAttribute('fill', 'none');
        if (doStroke) {
            el.setAttribute('stroke-width', String(sw));
            if (fillType === 'gradient') {
                const gid = `vgrad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                el.setAttribute('data-vgrad', gid);
                el.setAttribute('stroke', `url(#${gid})`);
            } else {
                el.setAttribute('stroke', strokeCol);
            }
        } else {
            el.removeAttribute('stroke');
            el.removeAttribute('stroke-width');
        }
        const tln = (el.tagName || '').toLowerCase();
        if (tln === 'line' || (tln === 'path' && el.getAttribute('data-illu-line-cubic') === '1')) {
            window.vectorApplyLineEndpointMarkers(el);
        }
        return;
    }

    if (doFill) {
        if (fillType === 'gradient') {
            const gid = `vgrad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            el.setAttribute('data-vgrad', gid);
            el.setAttribute('fill', `url(#${gid})`);
        } else {
            el.setAttribute('fill', primary);
        }
    } else {
        el.setAttribute('fill', 'none');
    }

    if (doStroke) {
        el.setAttribute('stroke', strokeCol);
        el.setAttribute('stroke-width', String(sw));
    } else {
        el.removeAttribute('stroke');
        el.removeAttribute('stroke-width');
    }
}
window.applyVectorShapePaint = applyVectorShapePaint;

window.syncVectorGradientBoundsForEl = function(el) {
    if (!el) return;
    const defs = document.getElementById('vector-doc-defs');
    if (!defs) return;
    
    let gid = el.getAttribute('data-vgrad');
    if (!gid) return;

    let gradEl = document.getElementById(gid);
    if (!gradEl) {
        const gradType = EditorManager.toolProps.gradientType || 'linear';
        gradEl = document.createElementNS('http://www.w3.org/2000/svg', gradType === 'radial' ? 'radialGradient' : 'linearGradient');
        gradEl.setAttribute('id', gid);
        
        const angleEl = document.getElementById('vector-prop-grad-angle');
        const angle = angleEl ? parseFloat(angleEl.value || '0') : 0;
        
        if (gradType === 'linear') {
            const rad = (angle) * Math.PI / 180;
            const r = 50; 
            const cx = 50, cy = 50;
            const x1 = cx - r * Math.cos(rad), y1 = cy - r * Math.sin(rad);
            const x2 = cx + r * Math.cos(rad), y2 = cy + r * Math.sin(rad);
            gradEl.setAttribute('x1', `$${x1}%`);
            gradEl.setAttribute('y1', `$${y1}%`);
            gradEl.setAttribute('x2', `$${x2}%`);
            gradEl.setAttribute('y2', `$${y2}%`);
        }
        
        const c1 = shapePrimaryFillCss() || '#000000';
        const c2 = typeof EditorManager !== 'undefined' ? (EditorManager.secondaryColor || '#ffffff') : '#ffffff';
        
        const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s1.setAttribute('offset', '0%');
        s1.setAttribute('stop-color', c1);
        const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s2.setAttribute('offset', '100%');
        s2.setAttribute('stop-color', c2);
        
        gradEl.appendChild(s1);
        gradEl.appendChild(s2);
        defs.appendChild(gradEl);
    } else {
        // If it exists, update it if needed? (We'll leave it as is for bounds, 
        // since we use default objectBoundingBox it auto-stretches)
    }
};


/** Recalcule le dégradé SVG après redimensionnement ou édition de la forme. */
window.syncVectorGradientBoundsForEl = function (el) {
    if (!el || !el.getAttribute('data-vgrad')) return;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'line') {
        syncVectorGradientOnShape(
            el,
            'line',
            parseFloat(el.getAttribute('x1')) || 0,
            parseFloat(el.getAttribute('y1')) || 0,
            parseFloat(el.getAttribute('x2')) || 0,
            parseFloat(el.getAttribute('y2')) || 0
        );
        return;
    }
    if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        const m = d.match(/M\s*([-\d.]+)\s+([-\d.]+)/i);
        const ends = d.match(/([-\d.]+)\s+([-\d.]+)\s*$/);
        if (m && ends) {
            const isLine =
                el.getAttribute('data-illu-line-cubic') === '1' ||
                el.getAttribute('data-illu-quad-3') === '1' ||
                el.getAttribute('data-illu-pen');
            if (isLine) {
                syncVectorGradientOnShape(el, 'line', parseFloat(m[1]), parseFloat(m[2]), parseFloat(ends[1]), parseFloat(ends[2]));
                return;
            }
        }
    }
    if (tag === 'polygon' || tag === 'polyline' || tag === 'rect') {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        if (tag === 'rect') {
            const x = parseFloat(el.getAttribute('x')) || 0;
            const y = parseFloat(el.getAttribute('y')) || 0;
            const w = parseFloat(el.getAttribute('width')) || 0;
            const h = parseFloat(el.getAttribute('height')) || 0;
            minX = x;
            minY = y;
            maxX = x + w;
            maxY = y + h;
        } else if (tag === 'polygon' || tag === 'polyline') {
            const raw = (el.getAttribute('points') || '').trim().split(/\s+/);
            raw.forEach((pair) => {
                const [px, py] = pair.split(',').map(Number);
                if (!Number.isFinite(px) || !Number.isFinite(py)) return;
                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            });
        }
        if (minX < Infinity) {
            syncVectorGradientOnShape(el, 'rect', minX, minY, maxX, maxY);
        }
    }
};

/**
 * Rasterise un path ou polygone SVG (coords document) sur le calque pixel actif.
 * @param {SVGElement} el
 * @param {{ closed?: boolean, lineEnd?: {x:number,y:number} }} opts
 */
window.rasterizePixelSvgShapeWithToolProps = function (el, opts) {
    if (!el || !EditorManager || !EditorManager.isPixelMode) return;
    const ctx = EditorManager.activeCtx;
    const layer = EditorManager.activeLayer;
    if (!ctx || !layer) return;
    opts = opts || {};
    const lx = layer.x;
    const ly = layer.y;
    const tag = (el.tagName || '').toLowerCase();
    const mode = EditorManager.toolProps.shapeStrokeMode || 'both';
    const fillType = EditorManager.toolProps.fillType || 'solid';
    const strokeW = Math.max(1, EditorManager.toolProps.size || 2);
    const isClosed = !!opts.closed || tag === 'polygon';
    const isLinePath = tag === 'path' && !isClosed;
    const doFill = isClosed && mode !== 'stroke' && fillType !== 'none';
    const doStroke = mode !== 'fill' || isLinePath;

    ctx.save();
    if (typeof window.applySelectionClip === 'function') {
        window.applySelectionClip(ctx, lx, ly);
    }
    ctx.translate(-lx, -ly);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const notePt = (x, y) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    };

    if (tag === 'polygon') {
        const raw = (el.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean);
        ctx.beginPath();
        raw.forEach((pair, i) => {
            const [px, py] = pair.split(',').map(Number);
            if (!Number.isFinite(px) || !Number.isFinite(py)) return;
            notePt(px, py);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.closePath();
    } else if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        const path = new Path2D(d);
        const m = d.match(/M\s*([-\d.]+)\s+([-\d.]+)/i);
        const ends = d.match(/([-\d.]+)\s+([-\d.]+)\s*$/);
        if (m) notePt(parseFloat(m[1]), parseFloat(m[2]));
        if (ends) notePt(parseFloat(ends[1]), parseFloat(ends[2]));
        if (opts.lineEnd) notePt(opts.lineEnd.x, opts.lineEnd.y);
        if (doFill) {
            if (fillType === 'gradient' && minX < Infinity) {
                const w = Math.max(maxX - minX, 1);
                const h = Math.max(maxY - minY, 1);
                ctx.fillStyle = createShapeFillGradient(
                    ctx,
                    'rect',
                    minX,
                    minY,
                    w,
                    h,
                    minX + w / 2,
                    minY + h / 2,
                    w / 2,
                    h / 2,
                    maxX,
                    maxY
                );
            } else {
                ctx.fillStyle = shapePrimaryFillCss();
            }
            ctx.fill(path);
        }
        if (doStroke) {
            ctx.lineWidth = strokeW;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (fillType === 'gradient' && isLinePath && m && (opts.lineEnd || ends)) {
                const x0 = parseFloat(m[1]);
                const y0 = parseFloat(m[2]);
                const le = opts.lineEnd || { x: parseFloat(ends[1]), y: parseFloat(ends[2]) };
                ctx.strokeStyle = createShapeFillGradient(ctx, 'line', 0, 0, 0, 0, x0, y0, 0, 0, le.x, le.y);
            } else {
                ctx.strokeStyle = isLinePath ? shapeLineStrokeCss() : shapeSecondaryStrokeCss();
            }
            ctx.stroke(path);
        }
        ctx.restore();
        return;
    }

    if (doFill) {
        if (fillType === 'gradient' && minX < Infinity) {
            const w = Math.max(maxX - minX, 1);
            const h = Math.max(maxY - minY, 1);
            ctx.fillStyle = createShapeFillGradient(
                ctx,
                'rect',
                minX,
                minY,
                w,
                h,
                minX + w / 2,
                minY + h / 2,
                w / 2,
                h / 2,
                maxX,
                maxY
            );
        } else {
            ctx.fillStyle = shapePrimaryFillCss();
        }
        ctx.fill();
    }
    if (doStroke) {
        ctx.lineWidth = strokeW;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = isLinePath ? shapeLineStrokeCss() : shapeSecondaryStrokeCss();
        ctx.stroke();
    }
    ctx.restore();
};

function refreshVectorDraftFromEditor() {
    if (EditorManager.mode !== 'vector' || !currentElement) return;
    const el = currentElement;
    const t = (el.tagName || '').toLowerCase();
    if (t === 'foreignobject') {
        const div = el.querySelector('div[contenteditable]');
        if (!div) return;
        const tp = EditorManager.toolProps;
        const fs = tp.textSize || 18;
        const ff = tp.textFont || 'Arial, sans-serif';
        const primary = EditorManager.activeColor || '#000000';
        div.style.fontFamily = ff;
        div.style.fontSize = fs + 'px';
        div.style.fontWeight = tp.textBold ? 'bold' : 'normal';
        div.style.fontStyle = tp.textItalic ? 'italic' : 'normal';
        div.style.color = typeof primary === 'string' ? primary : `rgb(${primary.r},${primary.g},${primary.b})`;
        return;
    }
    if (t === 'path') {
        const sw = Math.max(1, EditorManager.toolProps.size || 5);
        el.setAttribute('stroke-width', String(sw));
        const ft = EditorManager.toolProps.fillType || 'solid';
        const primary = EditorManager.activeColor || '#000000';
        const strokeStr = typeof primary === 'string' ? primary : `rgb(${primary.r},${primary.g},${primary.b})`;
        if (ft === 'gradient') {
            if (!el.getAttribute('data-vgrad')) {
                const gid = `vgrad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                el.setAttribute('data-vgrad', gid);
                el.setAttribute('stroke', `url(#${gid})`);
            }
            const d = el.getAttribute('d') || '';
            const cubic = parseIlluLinePath(d);
            const quad = parseIlluQuadPath(d);
            let x1 = 0;
            let y1 = 0;
            let x2 = 0;
            let y2 = 0;
            if (cubic) {
                x1 = cubic.x1;
                y1 = cubic.y1;
                x2 = cubic.x2;
                y2 = cubic.y2;
            } else if (quad) {
                x1 = quad.x0;
                y1 = quad.y0;
                x2 = quad.x1;
                y2 = quad.y1;
            } else {
                const first = d.match(/M\s*([\d.-]+)\s*([\d.-]+)/);
                const last = [...d.matchAll(/\bL\s*([\d.-]+)\s*([\d.-]+)/g)];
                if (first) {
                    x1 = parseFloat(first[1]);
                    y1 = parseFloat(first[2]);
                }
                if (last.length) {
                    x2 = parseFloat(last[last.length - 1][1]);
                    y2 = parseFloat(last[last.length - 1][2]);
                } else if (first) {
                    x2 = x1;
                    y2 = y1;
                }
            }
            syncVectorGradientOnShape(el, 'line', x1, y1, x2, y2);
        } else {
            el.removeAttribute('data-vgrad');
            el.setAttribute('stroke', strokeStr);
        }
        if (illuVectorPathHasLineEndpoints(el)) window.vectorApplyLineEndpointMarkers(el);
        return;
    }
    const kind =
        t === 'line' ? 'line' : t === 'ellipse' || t === 'circle' ? 'ellipse' : t === 'rect' ? 'rect' : null;
    if (!kind) return;
    applyVectorShapePaint(el, kind);
    if (!el.getAttribute('data-vgrad')) return;
    if (kind === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') || '0');
        const y1 = parseFloat(el.getAttribute('y1') || '0');
        const x2 = parseFloat(el.getAttribute('x2') || '0');
        const y2 = parseFloat(el.getAttribute('y2') || '0');
        syncVectorGradientOnShape(el, 'line', x1, y1, x2, y2);
        return;
    }
    if (kind === 'rect') {
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const w = parseFloat(el.getAttribute('width') || '0');
        const h = parseFloat(el.getAttribute('height') || '0');
        syncVectorGradientOnShape(el, 'rect', x, y, x + w, y + h);
        return;
    }
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const rx = parseFloat(el.getAttribute('rx') || '0');
    const ry = parseFloat(el.getAttribute('ry') || '0');
    syncVectorGradientOnShape(el, 'rect', cx - rx, cy - ry, cx + rx, cy + ry);
}

window.refreshVectorDraftFromEditor = refreshVectorDraftFromEditor;

function illuGetVectorTextEditableDiv(el) {
    if (!el) return null;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'foreignobject') return el.querySelector('div[contenteditable]');
    return null;
}

function illuVectorTextPrimaryCss() {
    if (typeof window.shapePrimaryFillCss === 'function') return window.shapePrimaryFillCss();
    const p = EditorManager.activeColor;
    return typeof p === 'string' ? p : '#000000';
}

function illuVectorTextDivIsEmpty(div) {
    if (!div) return true;
    const t = String(div.innerText || div.textContent || '')
        .replace(/\u200b/g, '')
        .trim();
    return !t;
}

function illuFitForeignObjectToText(fo) {
    const div = illuGetVectorTextEditableDiv(fo);
    if (!div || !fo) return;
    const fs = parseFloat(window.getComputedStyle(div).fontSize) || EditorManager.toolProps.textSize || 18;
    const lh = Math.round(fs * 1.25);
    const w = Math.max(8, Math.ceil(div.scrollWidth) + 4);
    const h = Math.max(lh, Math.ceil(div.scrollHeight) + 2);
    fo.setAttribute('width', String(w));
    fo.setAttribute('height', String(h));
    fo.removeAttribute('fill');
}

function illuRemoveVectorTextIfEmpty(fo) {
    if (!fo) return false;
    const div = illuGetVectorTextEditableDiv(fo);
    if (!illuVectorTextDivIsEmpty(div)) return false;
    if (fo.parentNode) fo.parentNode.removeChild(fo);
    if (currentElement === fo) currentElement = null;
    const idx = EditorManager.activeVectorSelection.indexOf(fo);
    if (idx > -1) EditorManager.activeVectorSelection.splice(idx, 1);
    return true;
}

function illuCreateVectorTextForeignObject(layer, pos) {
    const ns = 'http://www.w3.org/2000/svg';
    const fo = document.createElementNS(ns, 'foreignObject');
    const fs = EditorManager.toolProps.textSize || 18;
    const lh = Math.round(fs * 1.25);
    const ff = EditorManager.toolProps.textFont || 'Arial, sans-serif';
    const col = illuVectorTextPrimaryCss();
    fo.setAttribute('x', String(pos.x));
    fo.setAttribute('y', String(pos.y));
    fo.setAttribute('width', '4');
    fo.setAttribute('height', String(lh));
    fo.removeAttribute('fill');

    const htmlDoc = document.implementation.createHTMLDocument('illu-vector-text');
    const body = htmlDoc.createElement('body');
    body.setAttribute('style', 'margin:0;padding:0;background:transparent');
    const div = htmlDoc.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.setAttribute('spellcheck', 'false');
    div.setAttribute(
        'style',
        `outline:none;min-height:1em;margin:0;padding:0;cursor:text;font-family:${ff};font-size:${fs}px;line-height:${lh}px;color:${col};font-weight:${EditorManager.toolProps.textBold ? 'bold' : 'normal'};font-style:${EditorManager.toolProps.textItalic ? 'italic' : 'normal'};background:transparent;white-space:pre-wrap;overflow:hidden;`
    );
    div.textContent = '\u200b';
    body.appendChild(div);
    fo.appendChild(document.importNode(body, true));
    layer.appendChild(fo);
    return fo;
}

window.syncVectorTextEditorStyles = function () {
    if (EditorManager.mode !== 'vector') return;
    const tp = EditorManager.toolProps;
    const targets = EditorManager.activeVectorSelection.length
        ? EditorManager.activeVectorSelection
        : currentElement
          ? [currentElement]
          : [];
    const primary = illuVectorTextPrimaryCss();
    targets.forEach((el) => {
        const tag = (el.tagName || '').toLowerCase();
        if (tag !== 'foreignobject') return;
        el.removeAttribute('fill');
        const div = illuGetVectorTextEditableDiv(el);
        if (!div) return;
        const fs = tp.textSize || 18;
        const lh = Math.round(fs * 1.25);
        div.style.fontFamily = tp.textFont || 'Arial, sans-serif';
        div.style.fontSize = fs + 'px';
        div.style.lineHeight = lh + 'px';
        div.style.fontWeight = tp.textBold ? 'bold' : 'normal';
        div.style.fontStyle = tp.textItalic ? 'italic' : 'normal';
        div.style.color = primary;
        div.style.background = 'transparent';
        illuFitForeignObjectToText(el);
    });
    if (typeof syncAnchors === 'function' && EditorManager.activeVectorSelection.length) {
        syncAnchors();
    }
};

window.illuCancelActiveVectorTextDraft = function () {
    const VE = window.VectorEngine;
    if (currentElement) {
        const t = (currentElement.tagName || '').toLowerCase();
        if (t === 'foreignobject') {
            illuRemoveVectorTextIfEmpty(currentElement);
        }
        currentElement = null;
    }
    EditorManager.activeVectorSelection = [];
    window._activeVectorShapeEl = null;
    activeVectorShape = null;
    clearAnchors();
    if (VE && typeof VE.clearUI === 'function') VE.clearUI();
    if (typeof EditorManager.syncActiveVectorSvg === 'function') EditorManager.syncActiveVectorSvg();
    if (typeof EditorManager.render === 'function') EditorManager.render();
    return true;
};

function illuWireVectorTextEditor(div) {
    if (!div || div.dataset.illuTextWired === '1') return;
    div.dataset.illuTextWired = '1';
    div.addEventListener('input', () => {
        const fo =
            div.closest('foreignObject') ||
            div.closest('foreignobject') ||
            (currentElement && (currentElement.tagName || '').toLowerCase() === 'foreignobject'
                ? currentElement
                : null);
        if (fo) illuFitForeignObjectToText(fo);
    });
    div.addEventListener('blur', () => {
        if (EditorManager.mode !== 'vector') return;
        const fo = div.closest('foreignObject') || div.closest('foreignobject');
        if (fo && illuRemoveVectorTextIfEmpty(fo)) {
            clearAnchors();
            if (window.VectorEngine && typeof window.VectorEngine.clearUI === 'function') {
                window.VectorEngine.clearUI();
            }
        } else if (fo) {
            illuFitForeignObjectToText(fo);
        }
        if (typeof EditorManager.syncActiveVectorSvg === 'function') EditorManager.syncActiveVectorSvg();
        if (typeof EditorManager.saveHistory === 'function') {
            EditorManager.saveHistory('Texte vecteur', { patchActiveLayer: true });
        }
    });
}

function illuSyncToolPropsFromVectorTextEl(el) {
    const div = illuGetVectorTextEditableDiv(el);
    if (!div || !EditorManager.toolProps) return;
    const st = window.getComputedStyle(div);
    const tp = EditorManager.toolProps;
    const fs = parseFloat(st.fontSize);
    if (fs > 0) tp.textSize = Math.round(fs);
    if (st.fontFamily) tp.textFont = st.fontFamily;
    tp.textBold = st.fontWeight === 'bold' || parseInt(st.fontWeight, 10) >= 600;
    tp.textItalic = st.fontStyle === 'italic';
    const col = st.color;
    if (col && typeof EditorManager.setColorFromRGB === 'function') {
        const m = col.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) EditorManager.setColorFromRGB(+m[1], +m[2], +m[3], 255);
        else if (col.startsWith('#') && typeof EditorManager.setColorFromHex === 'function') {
            EditorManager.setColorFromHex(col);
        }
    }
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
}

window.illuFocusVectorTextEditor = function (el) {
    if (el) el.removeAttribute('fill');
    const div = illuGetVectorTextEditableDiv(el);
    if (!div) return false;
    illuWireVectorTextEditor(div);
    div.focus();
    if (window.getSelection && document.createRange) {
        const r = document.createRange();
        r.selectNodeContents(div);
        r.collapse(false);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
    }
    return true;
};

function illuVectorResumeExistingShape(hit, pos, e, opts) {
    const VE = window.VectorEngine;
    if (!hit) return false;
    const tag = (hit.tagName || '').toLowerCase();
    if (tag === 'foreignobject') hit.removeAttribute('fill');
    EditorManager.activeVectorSelection = [hit];
    window._activeVectorShapeEl = hit;
    activeVectorShape = hit;
    clearAnchors();
    generateAnchors(hit);
    if (VE && typeof VE.refreshSelectionUI === 'function') VE.refreshSelectionUI();
    if (opts && opts.beginDrag && VE && typeof VE.beginDrag === 'function') {
        VE.beginDrag([hit], pos, e);
    }
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    return true;
}

function illuVectorDrawToolResumeHit(hit, tool) {
    if (!hit) return false;
    const tag = (hit.tagName || '').toLowerCase();
    if (tool === 'text') return tag === 'foreignobject' || tag === 'text';
    if (tool === 'line') return illuVectorIsEditableStrokeElement(hit);
    if (tag === 'g' && hit.getAttribute('data-illu-group')) return tool === 'select' || tool === 'move' || tool === 'direct-select';
    const shapeDrawOnly = new Set(['rect', 'circle', 'round-3', 'triangle', 'cubic-3', 'shadow', 'brush']);
    if (shapeDrawOnly.has(tool)) return false;
    return false;
}

function hitTestVectorShapeInActiveLayer(pos, evt) {
    const g = getVectorActiveLayerContainer();
    if (!g) return null;
    const canvasR = document.getElementById('main-canvas-container').getBoundingClientRect();
    const clientX = evt && evt.clientX != null ? evt.clientX : 0;
    const clientY = evt && evt.clientY != null ? evt.clientY : 0;
    const px = clientX - canvasR.left;
    const py = clientY - canvasR.top;
    const sel =
        'rect, ellipse, circle, line, path, polygon, polyline, foreignObject, text, g[data-illu-group]';
    const nodes = [...g.querySelectorAll(sel)].reverse();
    for (const el of nodes) {
        try {
            const r = el.getBoundingClientRect();
            const left = r.left - canvasR.left;
            const right = r.right - canvasR.left;
            const top = r.top - canvasR.top;
            const bottom = r.bottom - canvasR.top;
            if (px >= left && px <= right && py >= top && py <= bottom) return el;
        } catch (err) {
            /* ignore */
        }
    }
    return null;
}

function snapshotVectorElementGeometry(el) {
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'rect') {
        return {
            tag,
            x: parseFloat(el.getAttribute('x')) || 0,
            y: parseFloat(el.getAttribute('y')) || 0
        };
    }
    if (tag === 'foreignobject' || tag === 'text') {
        return {
            tag,
            x: parseFloat(el.getAttribute('x')) || 0,
            y: parseFloat(el.getAttribute('y')) || 0
        };
    }
    if (tag === 'ellipse' || tag === 'circle') {
        return {
            tag,
            cx: parseFloat(el.getAttribute('cx')) || 0,
            cy: parseFloat(el.getAttribute('cy')) || 0
        };
    }
    if (tag === 'line') {
        return {
            tag,
            x1: parseFloat(el.getAttribute('x1')) || 0,
            y1: parseFloat(el.getAttribute('y1')) || 0,
            x2: parseFloat(el.getAttribute('x2')) || 0,
            y2: parseFloat(el.getAttribute('y2')) || 0
        };
    }
    if (tag === 'path' || tag === 'polygon' || tag === 'polyline') {
        return { tag: 'pathish', transform: el.getAttribute('transform') || '' };
    }
    return { tag: 'other', transform: el.getAttribute('transform') || '' };
}

function applyVectorDragFromSnapshot(el, base, tdx, tdy) {
    const tag = base.tag;
    if (tag === 'rect' || tag === 'foreignobject' || tag === 'text') {
        el.setAttribute('x', String(base.x + tdx));
        el.setAttribute('y', String(base.y + tdy));
        return;
    }
    if (tag === 'ellipse' || tag === 'circle') {
        el.setAttribute('cx', String(base.cx + tdx));
        el.setAttribute('cy', String(base.cy + tdy));
        return;
    }
    if (tag === 'line') {
        el.setAttribute('x1', String(base.x1 + tdx));
        el.setAttribute('y1', String(base.y1 + tdy));
        el.setAttribute('x2', String(base.x2 + tdx));
        el.setAttribute('y2', String(base.y2 + tdy));
        return;
    }
    if (tag === 'pathish' || tag === 'other') {
        const bt = base.transform || '';
        el.setAttribute('transform', `translate(${tdx},${tdy}) ${bt}`.trim());
    }
}

window.illuMoveVectorSelectionByDelta = function (dx, dy) {
    if (!EditorManager.activeProject || EditorManager.mode !== 'vector') return false;
    const sel = EditorManager.activeVectorSelection;
    if (!sel || !sel.length || (dx === 0 && dy === 0)) return false;
    for (const el of sel) {
        if (!el || !el.isConnected) continue;
        const base = snapshotVectorElementGeometry(el);
        applyVectorDragFromSnapshot(el, base, dx, dy);
    }
    if (typeof syncAnchors === 'function' && window._activeVectorShapeEl) {
        syncAnchors();
    }
    EditorManager.syncActiveVectorSvg();
    EditorManager.saveHistory('Centrage forme (vecteur)', { patchActiveLayer: true });
    EditorManager.render({ flushUiThumbnails: true });
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    return true;
};

function handleMouseDown(e) {
    /* Touch : e.button peut être undefined selon l’UA ; ne pas bloquer le tracé. */
    if (e.button != null && e.button !== 0) {
        isDrawing = false;
        return;
    }
    if (shouldIgnoreMouseDownOnChrome(e)) {
        isDrawing = false;
        return;
    }
    window._shiftConstraintProportions = e.shiftKey;
    const pos = getPos(e);

    if (EditorManager.isPixelMode && illuTryCommitImportPlacementOnOutsideClick(e, pos)) {
        isDrawing = false;
        return;
    }

    if (EditorManager.mode === 'vector') {
        try {
            const clientX = e.clientX != null ? e.clientX : 0;
            const clientY = e.clientY != null ? e.clientY : 0;
            const t = document.elementFromPoint(clientX, clientY);
            if (t && t.classList && t.classList.contains('svg-adjust-anchor')) {
                activeAdjustDrag = t.dataset.adjustType || null;
                activeVectorShape = window._activeVectorShapeEl || activeVectorShape;
                if (activeVectorShape) {
                    isDrawing = true;
                    e.preventDefault();
                    return;
                }
            }
            if (t && t.classList && t.classList.contains('svg-rotation-handle')) {
                activeVectorRotationDrag = true;
                activeVectorShape = window._activeVectorShapeEl || activeVectorShape;
                if (activeVectorShape) {
                    const pivot = illuVectorShapePivotLocal(activeVectorShape);
                    if (pivot) {
                        const rootPivot = vectorShapeAttrPointToRoot(activeVectorShape, pivot.cx, pivot.cy);
                        vectorRotationStartPointerAngle = Math.atan2(pos.y - rootPivot.y, pos.x - rootPivot.x);
                        vectorRotationStartAngle =
                            parseFloat(activeVectorShape.getAttribute('data-illu-rotation-rad')) || 0;
                    }
                    isDrawing = true;
                    e.preventDefault();
                    return;
                }
            }
            if (t && t.classList && t.classList.contains('svg-anchor')) {
                activeAnchor = t;
                activeAnchorIndex = parseInt(t.dataset.index, 10);
                activeVectorShape = window._activeVectorShapeEl || activeVectorShape;
                if (activeVectorShape) {
                    isDrawing = true;
                    e.preventDefault();
                    return;
                }
            }
        } catch (err) {
            /* ignore */
        }
    }

    if (EditorManager.isPixelMode && typeof window.preparePixelTextForMouseDown === 'function') {
        window.preparePixelTextForMouseDown(e);
    }
    if (
        EditorManager.isPixelMode &&
        typeof window.pixelTextEditorHandlesMouseDown === 'function' &&
        window.pixelTextEditorHandlesMouseDown(e)
    ) {
        isDrawing = false;
        return;
    }

    if (window._chromaKeyPickActive) {
        window._chromaKeyPickActive = false;
        document.body.style.cursor = '';
        const rgb = sampleImageRgbAtMainCanvasPos(pos);
        if (rgb && typeof FilterManager !== 'undefined' && FilterManager.applyPickedChromaColor) {
            FilterManager.applyPickedChromaColor(rgb.r, rgb.g, rgb.b);
        }
        e.preventDefault();
        e.stopPropagation();
        isDrawing = false;
        return;
    }

    if (EditorManager.isPixelMode && window.activeTool === 'wand') {
        magicWandAt(pos, e);
        isDrawing = false;
        isSprayStroke = false;
        isStampBrushStroke = false;
        isPencilPixelStroke = false;
        return;
    }

    if (window.activeTool === 'eyedropper') {
        if (EditorManager.isPixelMode) {
            const rgb = sampleImageRgbAtMainCanvasPos(pos);
            if (rgb) EditorManager.setColorFromRGB(rgb.r, rgb.g, rgb.b, rgb.a);
        } else if (EditorManager.mode === 'vector') {
            sampleVectorCompositeAtPos(pos, (rgb) => {
                if (rgb) EditorManager.setColorFromRGB(rgb.r, rgb.g, rgb.b, rgb.a);
            });
        }
        isDrawing = true;
        isSprayStroke = false;
        isStampBrushStroke = false;
        isPencilPixelStroke = false;
        return;
    }

    if (window.activeTool === 'zoom') {
        EditorManager.zoom(e.altKey ? -0.25 : 0.25);
        isDrawing = false;
        return;
    }

    if (EditorManager.mode === 'vector' && window.activeTool === 'fill') {
        e.preventDefault();
        const hit = hitTestVectorShapeInActiveLayer(pos, e);
        if (hit) {
            const tag = (hit.tagName || '').toLowerCase();
            const primary = EditorManager.activeColor || '#000000';
            const fillStr = typeof primary === 'string' ? primary : `rgb(${primary.r},${primary.g},${primary.b})`;
            if (tag === 'line') {
                removeVectorElementGradientIfAny(hit);
                hit.setAttribute('stroke', fillStr);
            } else if (['rect', 'ellipse', 'circle', 'path', 'polygon', 'polyline'].includes(tag)) {
                removeVectorElementGradientIfAny(hit);
                hit.setAttribute('fill', fillStr);
            }
            EditorManager.syncActiveVectorSvg();
            EditorManager.saveHistory('Pot de peinture (vecteur)', { patchActiveLayer: true });
            EditorManager.render();
        }
        isDrawing = false;
        return;
    }

    if (EditorManager.mode === 'vector' && window.activeTool === 'shadow') {
        e.preventDefault();
        const hit = hitTestVectorShapeInActiveLayer(pos, e);
        if (hit) {
            const defs = document.getElementById('vector-doc-defs');
            if (defs) {
                const fid = `fe-shadow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const f = document.createElementNS(SVG_NS, 'filter');
                f.setAttribute('id', fid);
                f.setAttribute('x', '-50%');
                f.setAttribute('y', '-50%');
                f.setAttribute('width', '200%');
                f.setAttribute('height', '200%');
                const fe = document.createElementNS(SVG_NS, 'feDropShadow');
                fe.setAttribute('dx', '4');
                fe.setAttribute('dy', '5');
                fe.setAttribute('stdDeviation', '3');
                fe.setAttribute('flood-color', '#000000');
                fe.setAttribute('flood-opacity', '0.45');
                f.appendChild(fe);
                defs.appendChild(f);
                hit.setAttribute('filter', `url(#${fid})`);
                EditorManager.syncActiveVectorSvg();
                EditorManager.saveHistory('Ombre portée (vecteur)', { patchActiveLayer: true });
                EditorManager.render();
            }
        }
        isDrawing = false;
        return;
    }

    if (
        (EditorManager.mode === 'vector' || EditorManager.isPixelMode) &&
        window.activeTool === 'cubic-3'
    ) {
        e.preventDefault();
        const sw = Math.max(1, EditorManager.toolProps.size || 2);
        if (EditorManager.isPixelMode && !vectorQuadBezierClickState) {
            const ph = readPixelHandleAttr(e);
            if (ph && ph.startsWith('s')) {
                window.shapeHandleDrag = parseInt(ph.slice(1), 10);
                isDrawing = true;
                return;
            }
            if (typeof window.hitShapeEditHandle === 'function') {
                const hi = window.hitShapeEditHandle(pos.x, pos.y);
                if (hi !== null) {
                    window.shapeHandleDrag = hi;
                    isDrawing = true;
                    return;
                }
            }
        }
        if (!vectorQuadBezierClickState) {
            if (EditorManager.isPixelMode) window.pixelShapeEdit = null;
            setVectorQuadBezierClickState({ phase: 1, p0: { x: pos.x, y: pos.y } });
            isDrawing = false;
            EditorManager.render();
            if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
            return;
        }
        if (vectorQuadBezierClickState.phase === 1) {
            const st = vectorQuadBezierClickState;
            st.p1 = { x: pos.x, y: pos.y };
            st.phase = 2;
            setVectorQuadBezierClickState(st);
            isDrawing = false;
            EditorManager.render();
            if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
            return;
        }
        const p0 = vectorQuadBezierClickState.p0;
        const p1 = vectorQuadBezierClickState.p1;
        setVectorQuadBezierClickState(null);
        window._quadBezierPreviewDoc = null;
        const p2 = { x: pos.x, y: pos.y };
        const bulge = getToolQuadCurveBulgePct();
        const qAdj = adjustQuadControlForBulge(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, bulge);

        if (EditorManager.mode === 'vector') {
            const layer = getVectorActiveLayerContainer();
            if (!layer) {
                isDrawing = false;
                return;
            }
            const pathEl = createSVG('path', {
                d: formatIlluQuadPath({
                    x0: p0.x,
                    y0: p0.y,
                    qx: qAdj.qx,
                    qy: qAdj.qy,
                    x1: p2.x,
                    y1: p2.y
                }),
                fill: 'none',
                'stroke-width': String(sw),
                'stroke-linecap': 'butt',
                'data-illu-quad-3': '1'
            });
            layer.appendChild(pathEl);
            applyVectorShapePaint(pathEl, 'line');
            if (pathEl.getAttribute('data-vgrad')) {
                syncVectorGradientOnShape(pathEl, 'line', p0.x, p0.y, p2.x, p2.y);
            }
            if (typeof window.vectorApplyLineEndpointMarkers === 'function') {
                window.vectorApplyLineEndpointMarkers(pathEl);
            }
            clearAnchors();
            activeVectorShape = pathEl;
            generateAnchors(pathEl);
            EditorManager.syncActiveVectorSvg();
            EditorManager.saveHistory('Courbe quadratique (3 pts)', { patchActiveLayer: true });
        } else if (EditorManager.isPixelMode && EditorManager.activeLayer) {
            if (typeof window.cloneLayerBuffer === 'function') {
                window._shapeBackupCanvas = window.cloneLayerBuffer(EditorManager.activeLayer.buffer);
            }
            const lx = EditorManager.activeLayer.x;
            const ly = EditorManager.activeLayer.y;
            const x0 = p0.x - lx;
            const y0 = p0.y - ly;
            const x1 = p2.x - lx;
            const y1 = p2.y - ly;
            const qAdjL = adjustQuadControlForBulge(
                p0.x,
                p0.y,
                p1.x,
                p1.y,
                p2.x,
                p2.y,
                bulge
            );
            const qx = qAdjL.qx - lx;
            const qy = qAdjL.qy - ly;
            const ctx = EditorManager.activeCtx;
            if (ctx) {
                ctx.save();
                if (
                    window.selectionBounds &&
                    selectionOverlay &&
                    (typeof window.hasActivePixelSelection !== 'function' || window.hasActivePixelSelection()) &&
                    window.activeTool !== 'select' &&
                    window.activeTool !== 'direct-select' &&
                    !isPixelWarpOrDeformTool()
                ) {
                    applySelectionClip(ctx, lx, ly);
                }
                strokePixelQuadCurve(ctx, x0, y0, qx, qy, x1, y1, sw);
                ctx.restore();
            }
            const opts = {
                strokeMode: EditorManager.toolProps.shapeStrokeMode || 'both',
                fillType: EditorManager.toolProps.fillType || 'solid',
                gradType: document.getElementById('tool-shape-grad-type')?.value || 'linear',
                gradMethod: typeof window.illuGetGradientMethod === 'function' ? window.illuGetGradientMethod() : 'simple',
                gradAngle: EditorManager.toolProps.shapeGradAngle ?? 0,
                strokeWidth: sw
            };
            if (typeof window.captureShapeEditAfterDraw === 'function') {
                window.captureShapeEditAfterDraw(
                    'quadcurve',
                    { x0, y0, qx, qy, x1, y1 },
                    opts
                );
            }
            EditorManager.saveHistory('Courbe quadratique (3 pts)', { patchActiveLayer: true });
        }
        EditorManager.render();
        isDrawing = false;
        return;
    }

    if (EditorManager.isPixelMode && window.activeTool === 'text') {
        e.preventDefault();
        if (typeof window.beginPixelTextSession === 'function') {
            window.beginPixelTextSession(pos.x, pos.y);
        }
        isDrawing = false;
        return;
    }

    if (EditorManager.mode === 'vector' && window.activeTool === 'text') {
        e.preventDefault();
        const layer = getVectorActiveLayerContainer();
        const foHit =
            (e.target &&
                e.target.closest &&
                (e.target.closest('foreignObject') || e.target.closest('foreignobject'))) ||
            null;
        if (foHit && layer && layer.contains(foHit)) {
            foHit.removeAttribute('fill');
            illuVectorResumeExistingShape(foHit, pos, e, { beginDrag: false });
            illuSyncToolPropsFromVectorTextEl(foHit);
            window.illuFocusVectorTextEditor(foHit);
            isDrawing = false;
            return;
        }
        EditorManager.deselectAll();
        clearAnchors();
        if (window.VectorEngine) window.VectorEngine.clearUI();
        const fo = illuCreateVectorTextForeignObject(layer, pos);
        currentElement = fo;
        illuWireVectorTextEditor(illuGetVectorTextEditableDiv(fo));
        EditorManager.activeVectorSelection = [fo];
        window._activeVectorShapeEl = fo;
        requestAnimationFrame(() => window.illuFocusVectorTextEditor(fo));
        isDrawing = false;
        return;
    }

    if (EditorManager.mode === 'vector' && window.activeTool === 'gradient') {
        vectorGradientDrag = null;
        const hit = hitTestVectorShapeInActiveLayer(pos, e);
        if (hit) {
            vectorEnsureGradientForHit(hit);
            const tag = (hit.tagName || '').toLowerCase();
            const kind =
                tag === 'line' ||
                    (tag === 'path' && hit.getAttribute('data-illu-line-cubic') === '1') ||
                    (tag === 'path' && hit.getAttribute('data-illu-quad-3') === '1')
                    ? 'line'
                    : 'shape';
            vectorGradientDrag = { el: hit, sx: pos.x, sy: pos.y, kind };
            syncVectorGradientOnShape(hit, kind === 'line' ? 'line' : 'rect', pos.x, pos.y, pos.x, pos.y);
            isDrawing = true;
            startX = pos.x;
            startY = pos.y;
        } else {
            isDrawing = false;
        }
        e.preventDefault();
        return;
    }


    if (EditorManager.isPixelMode && window.activeTool === 'gradient') {
        const ph = readPixelHandleAttr(e);
        if (ph === 'g0' || ph === 'g1') {
            window._gradientHandleDrag = ph === 'g0' ? 0 : 1;
            isDrawing = true;
            return;
        }
        if (typeof window.hitGradientHandle === 'function') {
            const h = window.hitGradientHandle(pos.x, pos.y);
            if (h !== null) {
                window._gradientHandleDrag = h;
                isDrawing = true;
                return;
            }
        }
        window._pixelGradientState = null;
        if (typeof window.beginNewGradientDrag === 'function') window.beginNewGradientDrag(pos.x, pos.y);
        window._gradientNewDrag = true;
        isDrawing = true;
        startX = pos.x;
        startY = pos.y;
        EditorManager.render();
        return;
    }

    if (EditorManager.isPixelMode && window.pixelShapeEdit) {
        if (tryStartShapePreviewRotationFromPointer(e, pos)) return;
        const ph = readPixelHandleAttr(e);
        if (ph && (ph.startsWith('s') || ph.startsWith('adj-'))) {
            window.shapeHandleDrag = ph.startsWith('adj-') ? ph : parseInt(ph.slice(1), 10);
            isDrawing = true;
            return;
        }
        if (typeof window.hitShapeAdjustHandle === 'function') {
            const adj = window.hitShapeAdjustHandle(pos.x, pos.y);
            if (adj) {
                window.shapeHandleDrag = adj;
                isDrawing = true;
                return;
            }
        }
        if (typeof window.hitShapeEditHandle === 'function') {
            const hi = window.hitShapeEditHandle(pos.x, pos.y);
            if (hi !== null) {
                window.shapeHandleDrag = hi;
                isDrawing = true;
                return;
            }
        }
    }

    if (
        EditorManager.isPixelMode &&
        window._shapeBackupCanvas &&
        SHAPE_LIVE_DRAW_TOOLS.includes(window.activeTool || '')
    ) {
        if (tryStartShapePreviewRotationFromPointer(e, pos)) return;
    }

    if (
        EditorManager.isPixelMode &&
        ['rect', 'circle', 'line', 'round-3', 'triangle', 'cubic-3', 'pen', 'polygon'].includes(window.activeTool)
    ) {
        if (typeof window.hidePixelShapeEditOverlay === 'function') window.hidePixelShapeEditOverlay();
        window.pixelShapeEdit = null;
    }

    isDrawing = true;
    startX = pos.x;
    startY = pos.y;
    if (['rect', 'circle', 'line', 'round-3', 'triangle'].includes(window.activeTool || '')) {
        window._shapeLiveStartX = startX;
        window._shapeLiveStartY = startY;
    }

    if (EditorManager.mode === 'vector') {
        startVector(pos, e);
        if (window.activeTool === 'direct-select' && !activeAnchor) {
            // On s'assure que isDrawing reste true si on a touché une forme (pour resize/move) ou pour le rubber-band
        }
    } else {
        startPixel(pos, e);
    }
}

function handleMouseMove(e) {
    if (!isDrawing) return;
    if (e && 'shiftKey' in e) window._shiftConstraintProportions = e.shiftKey;
    window._illuLastPointerEvent = e;
    const pos = getPos(e);
    if (EditorManager.isPixelMode) {
        window._illuLastPointerDoc = { x: pos.x, y: pos.y };
    }

    if (EditorManager.mode === 'vector') {
        const VE = window.VectorEngine;
        const tool = window.activeTool;

        // ► PRIORITÉ : Poignée d’ajustement (triangle / coins arrondis)
        if (activeAdjustDrag) {
            updateVector(pos);
            return;
        }

        // ► PRIORITÉ : Rotation forme vecteur (rect / triangle)
        if (activeVectorRotationDrag) {
            updateVector(pos);
            return;
        }

        // ► PRIORITÉ : Déplacement d'un point (ancre)
        if (activeAnchor) {
            updateVector(pos);
            return;
        }

        const resumeDragOnly =
            !currentElement &&
            EditorManager.activeVectorSelection &&
            EditorManager.activeVectorSelection.length > 0 &&
            ['rect', 'circle', 'line', 'brush', 'round-3', 'triangle', 'cubic-3', 'shadow'].includes(tool);

        if (tool === 'select' || tool === 'move' || tool === 'direct-select' || tool === 'deform' || tool === 'warp-4') {
            VE.updateRubberBand(pos);
            VE.updateDrag(pos);
            return;
        }

        if (resumeDragOnly) {
            VE.updateDrag(pos);
            return;
        }

        updateVector(pos);
    } else {
        updatePixel(pos, e);
    }
}

let activeVectorShape = null;
let activeAnchor = null;
let activeAdjustDrag = null;
let activeVectorRotationDrag = false;
let vectorRotationStartPointerAngle = 0;
let vectorRotationStartAngle = 0;
let anchorOffset = { x: 0, y: 0 };
let activeAnchorIndex = -1;

function getVectorActiveLayerContainer() {
    const root = document.getElementById('svg-layers');
    if (!root) return null;
    const l = EditorManager.activeLayer;
    if (!l) return root;
    const g = document.getElementById(`layer-${l.id}`);
    return g || root;
}

function startVector(pos, e) {
    const layer = getVectorActiveLayerContainer();
    if (!layer) return;

    // ► PRIORITÉ : Clic sur un anchor existant (point blanc de tracé)
    // Permet de bouger les points peu importe l'outil sélectionné tant qu'ils sont visibles.
    try {
        const clientX = e && e.clientX != null ? e.clientX : 0;
        const clientY = e && e.clientY != null ? e.clientY : 0;
        const t = document.elementFromPoint(clientX, clientY);
        if (t && t.classList && (t.classList.contains('svg-anchor') || t.classList.contains('svg-resize-handle') || t.classList.contains('svg-adjust-anchor') || t.classList.contains('svg-rotation-handle'))) {
            if (t.classList.contains('svg-adjust-anchor')) {
                activeAdjustDrag = t.dataset.adjustType || null;
                activeVectorShape = window._activeVectorShapeEl || activeVectorShape;
                window._illuVectorDragActive = true;
                isDrawing = !!activeVectorShape;
                return;
            }
            if (t.classList.contains('svg-rotation-handle')) {
                activeVectorRotationDrag = true;
                window._illuVectorDragActive = true;
                activeVectorShape = window._activeVectorShapeEl || activeVectorShape;
                if (activeVectorShape) {
                    const pivot = illuVectorShapePivotLocal(activeVectorShape);
                    if (pivot) {
                        const rootPivot = vectorShapeAttrPointToRoot(activeVectorShape, pivot.cx, pivot.cy);
                        vectorRotationStartPointerAngle = Math.atan2(pos.y - rootPivot.y, pos.x - rootPivot.x);
                        vectorRotationStartAngle =
                            parseFloat(activeVectorShape.getAttribute('data-illu-rotation-rad')) || 0;
                    }
                    isDrawing = true;
                }
                return;
            }
            if (t.classList.contains('svg-anchor')) {
                activeAnchor = t;
                activeAnchorIndex = parseInt(t.dataset.index, 10);
                activeVectorShape = window._activeVectorShapeEl || activeVectorShape;
                window._illuVectorDragActive = true;
                isDrawing = !!activeVectorShape;
                return;
            }
            // Si c'est un resize handle, laisser VE gérer dans la suite ?
            // En fait non, VE attend beginDrag. Mais les resize handles sont sur l'UI overlay.
            // On va laisser VE gérer les resize handles plus tard si nécessaire, 
            // mais les ancres de TRACÉ (svg-anchor) sont prioritaires ici.
        }
    } catch(err) {}

    const color = typeof EditorManager.activeColor === 'string' ? EditorManager.activeColor
        : `rgb(${EditorManager.activeColor.r},${EditorManager.activeColor.g},${EditorManager.activeColor.b})`;
    const VE = window.VectorEngine;
    if (!VE) {
        console.error('[MasterPaint] VectorEngine.js non chargé (erreur de syntaxe ou script absent).');
        isDrawing = false;
        return;
    }

    // ── Outil plume (pen) ──
    if (window.activeTool === 'pen') {
        if (VE.isPenActive()) {
            VE.penAddPoint(pos);
        } else {
            VE.penStart(pos, layer, color, Math.max(1, EditorManager.toolProps.size || 2), 'cubic');
        }
        isDrawing = false; // pas de mouseMove continu
        return;
    }

    // ── Outil polygone (click-to-place) ──
    if (window.activeTool === 'polygon') {
        if (VE.isPolygonActive()) {
            VE.polygonAddPoint(pos);
        } else {
            VE.polygonStart(pos, layer, color, Math.max(1, EditorManager.toolProps.size || 2));
        }
        isDrawing = false;
        return;
    }

    // ── Outil remplissage vectoriel ──
    if (window.activeTool === 'fill') {
        const hit = VE.hitTest(pos, e);
        if (hit) VE.fillShape(hit, color);
        isDrawing = false;
        return;
    }

    // ── Sélection / déplacement ──
    if (window.activeTool === 'select' || window.activeTool === 'move' || window.activeTool === 'direct-select' || window.activeTool === 'deform' || window.activeTool === 'warp-4') {
        vectorGradientDrag = null;
        vectorMoveWholeLayer = false;
        vectorMoveTarget = null;
        vectorMovePendingHit = null;
        vectorMovePointerDown = null;

        let hit = VE.hitTest(pos, e);

        // Comportement outil Déplacement (Move) : si rien n'est hit mais qu'on a déjà une sélection, 
        // on déplace la sélection existante au lieu de faire un rubber-band.
        if (!hit && window.activeTool === 'move' && EditorManager.activeVectorSelection.length > 0) {
            hit = EditorManager.activeVectorSelection[0];
        }

        if (hit) {
            isDrawing = true;
            const additive = e && (e.shiftKey || e.ctrlKey || e.metaKey);
            if (additive) {
                const idx = EditorManager.activeVectorSelection.indexOf(hit);
                if (idx > -1) EditorManager.activeVectorSelection.splice(idx, 1);
                else EditorManager.activeVectorSelection.push(hit);
            } else {
                if (!EditorManager.activeVectorSelection.includes(hit)) {
                    // Do not overwrite selection if we clicked a UI handle
                    const isNodeHandle = (window.activeTool === 'direct-select') && (hit.classList && (hit.classList.contains('ve-node-handle') || hit.classList.contains('ve-cp-handle')));
                    const isResizeHandle = hit.classList && hit.classList.contains('svg-resize-handle');
                    if (!isNodeHandle && !isResizeHandle) {
                        EditorManager.activeVectorSelection = [hit];
                    }
                }
            }
            window._activeVectorShapeEl = EditorManager.activeVectorSelection[EditorManager.activeVectorSelection.length - 1] || null;
            activeVectorShape = window._activeVectorShapeEl;
            
            // Si outil de déformation, on active un mode spécial dans VE
            if (window.activeTool === 'deform' || window.activeTool === 'warp-4') {
                VE.beginTransform(EditorManager.activeVectorSelection, pos, window.activeTool);
            } else {
                VE.beginDrag(EditorManager.activeVectorSelection, pos, e);
            }
            
            // Anchors de forme pour l'élément primaire
            clearAnchors();
            if (window._activeVectorShapeEl) generateAnchors(window._activeVectorShapeEl);
            VE.refreshSelectionUI();
        } else {
            // Aucune forme touchée => rubber-band sauf si additive
            const additive = e && (e.shiftKey || e.ctrlKey || e.metaKey);
            if (!additive) {
                EditorManager.activeVectorSelection = [];
                window._activeVectorShapeEl = null;
                activeVectorShape = null;
                clearAnchors();
            }
            VE.startRubberBand(pos);
        }
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        EditorManager.render();
        return;
    }

    // ── Dégradé vecteur ──
    if (window.activeTool === 'gradient') {
        vectorGradientDrag = null;
        const hit = VE.hitTest(pos, e);
        if (hit) {
            vectorEnsureGradientForHit(hit);
            const tag = (hit.tagName || '').toLowerCase();
            const kind = tag === 'line' || (tag === 'path' && hit.getAttribute('data-illu-line-cubic') === '1') ? 'line' : 'shape';
            vectorGradientDrag = { el: hit, sx: pos.x, sy: pos.y, kind };
            syncVectorGradientOnShape(hit, kind === 'line' ? 'line' : 'rect', pos.x, pos.y, pos.x, pos.y);
        } else { isDrawing = false; }
        if (e) e.preventDefault();
        return;
    }

    if (window.activeTool === 'line') {
        const hit = VE.hitTest(pos, e);
        if (hit && illuVectorIsEditableStrokeElement(hit)) {
            const isUiHandle =
                hit.classList &&
                (hit.classList.contains('svg-resize-handle') ||
                    hit.classList.contains('svg-anchor') ||
                    hit.classList.contains('ve-node-handle'));
            if (!isUiHandle) {
                illuNormalizeImportedStrokePath(hit);
                illuVectorResumeExistingShape(hit, pos, e, { beginDrag: false });
                isDrawing = false;
                return;
            }
        }
    }

    // ── Outils de dessin standards (rect, circle, line, brush, round-3, cubic-3, text, shadow) ──
    // Avant de créer une nouvelle forme, on désélectionne l'ancienne
    if (!(e && (e.shiftKey || e.ctrlKey || e.metaKey))) {
        EditorManager.deselectAll();
    }
    clearAnchors();
    activeVectorShape = null;
    VE.clearUI();

    switch (window.activeTool) {
        case 'rect':
            currentElement = createSVG('rect', { x: pos.x, y: pos.y, width: 0, height: 0, fill: color });
            layer.appendChild(currentElement);
            applyVectorShapePaint(currentElement, 'rect');
            break;
        case 'circle':
            currentElement = createSVG('ellipse', { cx: pos.x, cy: pos.y, rx: 0, ry: 0, fill: color });
            layer.appendChild(currentElement);
            applyVectorShapePaint(currentElement, 'ellipse');
            break;
        case 'line': {
            const swLine = String(Math.max(1, EditorManager.toolProps.size || 2));
            const straight = !!(e && e.shiftKey);
            if (straight) {
                currentElement = createSVG('path', {
                    d: formatIlluStraightLinePath(pos.x, pos.y, pos.x, pos.y),
                    stroke: color,
                    fill: 'none',
                    'stroke-width': swLine,
                    'stroke-linecap': 'butt',
                    'data-illu-line-straight': '1',
                    'data-illu-stroke-only': '1'
                });
            } else {
                const cd = cubicLineDefaults(pos.x, pos.y, pos.x, pos.y);
                currentElement = createSVG('path', {
                    d: formatIlluLinePath(cd),
                    stroke: color,
                    fill: 'none',
                    'stroke-width': swLine,
                    'stroke-linecap': 'butt',
                    'data-illu-line-cubic': '1'
                });
            }
            layer.appendChild(currentElement);
            applyVectorShapePaint(currentElement, 'line');
            break;
        }
        case 'brush': {
            const sw = Math.max(1, EditorManager.toolProps.size || 5);
            currentElement = createSVG('path', {
                d: `M ${pos.x} ${pos.y}`, stroke: color, fill: 'none',
                'stroke-width': String(sw), 'stroke-linecap': 'round'
            });
            layer.appendChild(currentElement);
            applyVectorShapePaint(currentElement, 'line');
            break;
        }
        case 'round-3':
            currentElement = createSVG('rect', {
                x: pos.x, y: pos.y, width: 0, height: 0, fill: color, 'data-illu-round': '1'
            });
            layer.appendChild(currentElement);
            applyVectorShapePaint(currentElement, 'rect');
            break;
        case 'triangle':
            currentElement = createSVG('polygon', {
                points: `${pos.x},${pos.y} ${pos.x},${pos.y} ${pos.x},${pos.y}`,
                fill: color,
                'data-illu-triangle': '1',
                'data-illu-triangle-adj': '0.5',
                'data-illu-triangle-vf': '0'
            });
            layer.appendChild(currentElement);
            applyVectorShapePaint(currentElement, 'polygon');
            break;
        case 'text': {
            /* Création gérée dans handleMouseDown (zone compacte, pas de drag 280×140). */
            break;
        }
    }
}








function updateVector(pos) {
    if (window.activeTool === 'eyedropper') {
        sampleVectorCompositeAtPos(pos, (rgb) => {
            if (rgb) EditorManager.setColorFromRGB(rgb.r, rgb.g, rgb.b, rgb.a);
        });
        return;
    }
    if (activeAdjustDrag && activeVectorShape) {
        illuUpdateVectorAdjustFromPointer(activeVectorShape, activeAdjustDrag, pos);
        if (!window._illuVectorDragActive && typeof syncAnchors === 'function') syncAnchors();
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        return;
    }
    if (activeVectorRotationDrag && activeVectorShape) {
        const pivot = illuVectorShapePivotLocal(activeVectorShape);
        if (pivot) {
            const rootPivot = vectorShapeAttrPointToRoot(activeVectorShape, pivot.cx, pivot.cy);
            const a = Math.atan2(pos.y - rootPivot.y, pos.x - rootPivot.x);
            const da = a - vectorRotationStartPointerAngle;
            let ang = vectorRotationStartAngle + da;
            ang = constrainRotationAngleRad(ang, window._shiftConstraintProportions);
            illuWriteVectorShapeRotation(activeVectorShape, ang);
            if (!window._illuVectorDragActive && typeof syncAnchors === 'function') syncAnchors();
            if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        }
        return;
    }
    if (activeAnchor && activeVectorShape) {
        const lp = vectorDocToShapeAttrPoint(activeVectorShape, pos.x, pos.y);
        const type = (activeVectorShape.tagName || '').toLowerCase();

        if (type === 'foreignobject') {
            let x = parseFloat(activeVectorShape.getAttribute('x'));
            let y = parseFloat(activeVectorShape.getAttribute('y'));
            let w = parseFloat(activeVectorShape.getAttribute('width'));
            let h = parseFloat(activeVectorShape.getAttribute('height'));
            if (Number.isNaN(x)) x = 0;
            if (Number.isNaN(y)) y = 0;
            if (Number.isNaN(w)) w = 0;
            if (Number.isNaN(h)) h = 0;
            if (activeAnchorIndex === 0) { w += (x - lp.x); h += (y - lp.y); x = lp.x; y = lp.y; }
            if (activeAnchorIndex === 1) { w = lp.x - x; h += (y - lp.y); y = lp.y; }
            if (activeAnchorIndex === 2) { w += (x - lp.x); h = lp.y - y; x = lp.x; }
            if (activeAnchorIndex === 3) { w = lp.x - x; h = lp.y - y; }
            if (w > 0) { activeVectorShape.setAttribute('x', String(x)); activeVectorShape.setAttribute('width', String(w)); }
            if (h > 0) { activeVectorShape.setAttribute('y', String(y)); activeVectorShape.setAttribute('height', String(h)); }
        } else if (type === 'rect') {
            let x = parseFloat(activeVectorShape.getAttribute('x')) || 0;
            let y = parseFloat(activeVectorShape.getAttribute('y')) || 0;
            let w = parseFloat(activeVectorShape.getAttribute('width')) || 0;
            let h = parseFloat(activeVectorShape.getAttribute('height')) || 0;
            const wx = lp.x;
            const wy = lp.y;
            const hi = activeAnchorIndex;
            switch (hi) {
                case 0:
                    w += x - wx;
                    h += y - wy;
                    x = wx;
                    y = wy;
                    break;
                case 1:
                    h += y - wy;
                    y = wy;
                    break;
                case 2:
                    w = wx - x;
                    h += y - wy;
                    y = wy;
                    break;
                case 3:
                    w += x - wx;
                    x = wx;
                    break;
                case 4:
                    w = wx - x;
                    break;
                case 5:
                    w += x - wx;
                    x = wx;
                    h = wy - y;
                    break;
                case 6:
                    h = wy - y;
                    break;
                case 7:
                    w = wx - x;
                    h = wy - y;
                    break;
                default:
                    break;
            }
            if (w < 2) w = 2;
            if (h < 2) h = 2;
            if (window._shiftConstraintProportions && [0, 2, 5, 7].includes(hi)) {
                const uw = w;
                const uh = h;
                const m = Math.max(Math.max(2, uw), Math.max(2, uh));
                if (hi === 0) {
                    const fx = x + uw;
                    const fy = y + uh;
                    w = h = m;
                    x = fx - m;
                    y = fy - m;
                } else if (hi === 2) {
                    const fx = x;
                    const fy = y + uh;
                    w = h = m;
                    x = fx;
                    y = fy - m;
                } else if (hi === 5) {
                    const fx = x + uw;
                    const fy = y;
                    w = h = m;
                    x = fx - m;
                    y = fy;
                } else {
                    w = h = m;
                }
            }
            activeVectorShape.setAttribute('x', String(x));
            activeVectorShape.setAttribute('y', String(y));
            activeVectorShape.setAttribute('width', String(w));
            activeVectorShape.setAttribute('height', String(h));
            if (activeVectorShape.getAttribute('data-illu-round') === '1') {
                const want = EditorManager.toolProps.shapeCornerRadius ?? 12;
                const rInt = Math.max(1, Math.round(clampRoundRectCornerRadius(want, w, h)));
                activeVectorShape.setAttribute('rx', String(rInt));
                activeVectorShape.setAttribute('ry', String(rInt));
            }
            if (activeVectorShape.getAttribute('data-vgrad')) {
                syncVectorGradientOnShape(activeVectorShape, 'rect', x, y, x + w, y + h);
            }
        } else if (type === 'polygon' && activeVectorShape.getAttribute('data-illu-triangle') === '1') {
            const st0 = illuTriangleReadState(activeVectorShape);
            let x = st0.x;
            let y = st0.y;
            let w = st0.w;
            let h = st0.h;
            const adj = st0.adj;
            const vf = st0.vf;
            const wx = lp.x;
            const wy = lp.y;
            const hi = activeAnchorIndex;
            switch (hi) {
                case 0:
                    w += x - wx;
                    h += y - wy;
                    x = wx;
                    y = wy;
                    break;
                case 1:
                    h += y - wy;
                    y = wy;
                    break;
                case 2:
                    w = wx - x;
                    h += y - wy;
                    y = wy;
                    break;
                case 3:
                    w += x - wx;
                    x = wx;
                    break;
                case 4:
                    w = wx - x;
                    break;
                case 5:
                    w += x - wx;
                    x = wx;
                    h = wy - y;
                    break;
                case 6:
                    h = wy - y;
                    break;
                case 7:
                    w = wx - x;
                    h = wy - y;
                    break;
                default:
                    break;
            }
            if (w < 2) w = 2;
            if (h < 2) h = 2;
            if (window._shiftConstraintProportions && [0, 2, 5, 7].includes(hi)) {
                const uw = w;
                const uh = h;
                const m = Math.max(Math.max(2, uw), Math.max(2, uh));
                if (hi === 0) {
                    const fx = x + uw;
                    const fy = y + uh;
                    w = h = m;
                    x = fx - m;
                    y = fy - m;
                } else if (hi === 2) {
                    const fx = x;
                    const fy = y + uh;
                    w = h = m;
                    x = fx;
                    y = fy - m;
                } else if (hi === 5) {
                    const fx = x + uw;
                    const fy = y;
                    w = h = m;
                    x = fx - m;
                    y = fy;
                } else {
                    w = h = m;
                }
            }
            illuTriangleWritePoints(activeVectorShape, x, y, w, h, adj, vf);
            if (activeVectorShape.getAttribute('data-vgrad')) {
                syncVectorGradientOnShape(activeVectorShape, 'rect', x, y, x + w, y + h);
            }
        } else if (type === 'path' && activeVectorShape.getAttribute('data-illu-quad-3') === '1') {
            const pq = parseIlluQuadPath(activeVectorShape.getAttribute('d') || '');
            if (pq) {
                const keys = [
                    ['x0', 'y0'],
                    ['qx', 'qy'],
                    ['x1', 'y1']
                ];
                const pair = keys[activeAnchorIndex];
                if (pair) {
                    pq[pair[0]] = lp.x;
                    pq[pair[1]] = lp.y;
                    activeVectorShape.setAttribute('d', formatIlluQuadPath(pq));
                }
                if (activeVectorShape.getAttribute('data-vgrad')) {
                    syncVectorGradientOnShape(activeVectorShape, 'line', pq.x0, pq.y0, pq.x1, pq.y1);
                }
                if (typeof window.vectorApplyLineEndpointMarkers === 'function') {
                    window.vectorApplyLineEndpointMarkers(activeVectorShape);
                }
            }
        } else if (type === 'path' && activeVectorShape.getAttribute('data-illu-line-straight') === '1') {
            const p = parseIlluStraightLinePath(activeVectorShape.getAttribute('d') || '');
            if (p) {
                if (activeAnchorIndex === 0) {
                    p.x1 = lp.x;
                    p.y1 = lp.y;
                } else if (activeAnchorIndex === 1) {
                    p.x2 = lp.x;
                    p.y2 = lp.y;
                }
                activeVectorShape.setAttribute('d', formatIlluStraightLinePath(p.x1, p.y1, p.x2, p.y2));
                if (activeVectorShape.getAttribute('data-vgrad')) {
                    syncVectorGradientOnShape(activeVectorShape, 'line', p.x1, p.y1, p.x2, p.y2);
                }
                window.vectorApplyLineEndpointMarkers(activeVectorShape);
            }
        } else if (type === 'path' && activeVectorShape.getAttribute('data-illu-line-cubic') === '1') {
            const p = parseIlluLinePath(activeVectorShape.getAttribute('d'));
            if (p) {
                const keys = [
                    ['x1', 'y1'],
                    ['c1x', 'c1y'],
                    ['c2x', 'c2y'],
                    ['x2', 'y2']
                ];
                const pair = keys[activeAnchorIndex];
                if (pair) {
                    p[pair[0]] = lp.x;
                    p[pair[1]] = lp.y;
                    activeVectorShape.setAttribute('d', formatIlluLinePath(p));
                }
                if (activeVectorShape.getAttribute('data-vgrad')) {
                    syncVectorGradientOnShape(activeVectorShape, 'line', p.x1, p.y1, p.x2, p.y2);
                }
                window.vectorApplyLineEndpointMarkers(activeVectorShape);
            }
        } else if (type === 'line') {
            if (activeAnchorIndex === 0) { activeVectorShape.setAttribute('x1', String(lp.x)); activeVectorShape.setAttribute('y1', String(lp.y)); }
            if (activeAnchorIndex === 1) { activeVectorShape.setAttribute('x2', String(lp.x)); activeVectorShape.setAttribute('y2', String(lp.y)); }
        } else if (type === 'ellipse' || type === 'circle') {
            let cx = parseFloat(activeVectorShape.getAttribute('cx')) || 0;
            let cy = parseFloat(activeVectorShape.getAttribute('cy')) || 0;
            let rx = type === 'circle' ? parseFloat(activeVectorShape.getAttribute('r')) || 0 : parseFloat(activeVectorShape.getAttribute('rx')) || 0;
            let ry = type === 'circle' ? rx : parseFloat(activeVectorShape.getAttribute('ry')) || 0;
            let rx0 = cx - rx;
            let ry0 = cy - ry;
            let w = rx * 2;
            let h = ry * 2;
            const wx = lp.x;
            const wy = lp.y;
            const hi = activeAnchorIndex;
            switch (hi) {
                case 0:
                    w += rx0 - wx;
                    h += ry0 - wy;
                    rx0 = wx;
                    ry0 = wy;
                    break;
                case 1:
                    h += ry0 - wy;
                    ry0 = wy;
                    break;
                case 2:
                    w = wx - rx0;
                    h += ry0 - wy;
                    ry0 = wy;
                    break;
                case 3:
                    w += rx0 - wx;
                    rx0 = wx;
                    break;
                case 4:
                    w = wx - rx0;
                    break;
                case 5:
                    w += rx0 - wx;
                    rx0 = wx;
                    h = wy - ry0;
                    break;
                case 6:
                    h = wy - ry0;
                    break;
                case 7:
                    w = wx - rx0;
                    h = wy - ry0;
                    break;
                default:
                    break;
            }
            if (w < 4) w = 4;
            if (h < 4) h = 4;
            if (window._shiftConstraintProportions && [0, 2, 5, 7].includes(hi)) {
                const uw = w;
                const uh = h;
                const m = Math.max(Math.max(4, uw), Math.max(4, uh));
                if (hi === 0) {
                    const fx = rx0 + uw;
                    const fy = ry0 + uh;
                    w = h = m;
                    rx0 = fx - m;
                    ry0 = fy - m;
                } else if (hi === 2) {
                    const fx = rx0;
                    const fy = ry0 + uh;
                    w = h = m;
                    rx0 = fx;
                    ry0 = fy - m;
                } else if (hi === 5) {
                    const fx = rx0 + uw;
                    const fy = ry0;
                    w = h = m;
                    rx0 = fx - m;
                    ry0 = fy;
                } else {
                    w = h = m;
                }
            }
            cx = rx0 + w / 2;
            cy = ry0 + h / 2;
            rx = w / 2;
            ry = h / 2;
            activeVectorShape.setAttribute('cx', String(cx));
            activeVectorShape.setAttribute('cy', String(cy));
            if (type === 'circle') {
                activeVectorShape.setAttribute('r', String(rx));
                activeVectorShape.removeAttribute('rx');
                activeVectorShape.removeAttribute('ry');
            } else {
                activeVectorShape.setAttribute('rx', String(rx));
                activeVectorShape.setAttribute('ry', String(ry));
            }
            if (activeVectorShape.getAttribute('data-vgrad')) {
                syncVectorGradientOnShape(activeVectorShape, 'rect', cx - rx, cy - ry, cx + rx, cy + ry);
            }
        } else if (type === 'path') {
            // Simplified : un point d’ancrage par commande M/L (même ordre que collectSvgPathAnchorPoints).
            const d0 = activeVectorShape.getAttribute('d') || '';
            const segs = d0.split(/(?=[MmLl])/).filter((s) => s.trim());
            if (segs[activeAnchorIndex]) {
                const cmd = segs[activeAnchorIndex].trim()[0];
                segs[activeAnchorIndex] = `${cmd} ${lp.x} ${lp.y}`;
                activeVectorShape.setAttribute('d', segs.join(' '));
            }
        } else if (type === 'polygon' || type === 'polyline') {
            const pts = parseIlluPolygonPoints(activeVectorShape.getAttribute('points') || '');
            if (pts[activeAnchorIndex]) {
                pts[activeAnchorIndex] = [lp.x, lp.y];
                activeVectorShape.setAttribute(
                    'points',
                    pts.map((p) => `${p[0]},${p[1]}`).join(' ')
                );
            }
        } else if (type === 'text') {
            activeVectorShape.setAttribute('x', String(lp.x));
            activeVectorShape.setAttribute('y', String(lp.y));
        }

        const ahz = EditorManager.svgUiHandleSizeDoc() / 2;
        activeAnchor.setAttribute('x', pos.x - ahz);
        activeAnchor.setAttribute('y', pos.y - ahz);
        if (!window._illuVectorDragActive && typeof syncAnchors === 'function') syncAnchors();
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        return;
    }

    if (vectorGradientDrag) {
        const { el, sx, sy, kind } = vectorGradientDrag;
        const ep = constrainLineEndpoint(sx, sy, pos.x, pos.y, window._shiftConstraintProportions);
        syncVectorGradientOnShape(el, kind === 'line' ? 'line' : 'rect', sx, sy, ep.x, ep.y);
        return;
    }

    if (
        EditorManager.mode === 'vector' &&
        window.activeTool === 'move' &&
        vectorMovePendingHit &&
        !vectorMoveTarget &&
        vectorMovePointerDown
    ) {
        const d = Math.hypot(pos.x - vectorMovePointerDown.x, pos.y - vectorMovePointerDown.y);
        if (d > 4) {
            vectorMoveTarget = vectorMovePendingHit;
            vectorMoveStartPointer = { x: vectorMovePointerDown.x, y: vectorMovePointerDown.y };
            vectorMoveInitial = snapshotVectorElementGeometry(vectorMoveTarget);
            vectorMovePendingHit = null;
            vectorMovePointerDown = null;
            vectorDidMove = false;
        } else {
            return;
        }
    }

    if (vectorMoveWholeLayer && vectorMoveTarget && vectorMoveStartPointer) {
        const tdx = pos.x - vectorMoveStartPointer.x;
        const tdy = pos.y - vectorMoveStartPointer.y;
        const bt = (vectorMoveInitial && vectorMoveInitial.transform) || '';
        vectorMoveTarget.setAttribute('transform', `translate(${tdx},${tdy}) ${bt}`.trim());
        vectorDidMove = true;
        return;
    }

    if (vectorMoveTarget && vectorMoveStartPointer && vectorMoveInitial) {
        const tdx = pos.x - vectorMoveStartPointer.x;
        const tdy = pos.y - vectorMoveStartPointer.y;
        
        // If the dragged target is part of a multi-selection, drag all of them
        if (window._activeVectorSelectionSnapshots && window._activeVectorSelectionSnapshots.some(s => s.el === vectorMoveTarget)) {
            window._activeVectorSelectionSnapshots.forEach(snap => {
                applyVectorDragFromSnapshot(snap.el, snap.base, tdx, tdy);
            });
        } else {
            applyVectorDragFromSnapshot(vectorMoveTarget, vectorMoveInitial, tdx, tdy);
        }
        
        vectorDidMove = true;
        if (!window._illuVectorDragActive && typeof syncAnchors === 'function') syncAnchors();
        return;
    }

    if (!currentElement) return;
    const sh = window._shiftConstraintProportions;
    switch (window.activeTool) {
        case 'rect':
        case 'round-3': {
            let x;
            let y;
            let w;
            let h;
            if (sh) {
                const b = constrainRectSelectionDraw(startX, startY, pos.x, pos.y, true);
                x = b.x;
                y = b.y;
                w = b.w;
                h = b.h;
            } else {
                x = Math.min(pos.x, startX);
                y = Math.min(pos.y, startY);
                w = Math.abs(pos.x - startX);
                h = Math.abs(pos.y - startY);
            }
            currentElement.setAttribute('x', String(x));
            currentElement.setAttribute('y', String(y));
            currentElement.setAttribute('width', String(w));
            currentElement.setAttribute('height', String(h));
            if (window.activeTool === 'round-3' || currentElement.getAttribute('data-illu-round') === '1') {
                const want = EditorManager.toolProps.shapeCornerRadius ?? 12;
                const rr = clampRoundRectCornerRadius(want, w, h);
                if (rr > 0.5) {
                    const rInt = Math.max(1, Math.round(rr));
                    currentElement.setAttribute('rx', String(rInt));
                    currentElement.setAttribute('ry', String(rInt));
                } else {
                    currentElement.removeAttribute('rx');
                    currentElement.removeAttribute('ry');
                }
            } else {
                currentElement.removeAttribute('rx');
                currentElement.removeAttribute('ry');
            }
            if (currentElement.getAttribute('data-vgrad')) {
                syncVectorGradientOnShape(currentElement, 'rect', x, y, x + w, y + h);
            }
            break;
        }
        case 'triangle': {
            let x;
            let y;
            let w;
            let h;
            if (sh) {
                const b = constrainRectSelectionDraw(startX, startY, pos.x, pos.y, true);
                x = b.x;
                y = b.y;
                w = b.w;
                h = b.h;
            } else {
                x = Math.min(pos.x, startX);
                y = Math.min(pos.y, startY);
                w = Math.abs(pos.x - startX);
                h = Math.abs(pos.y - startY);
            }
            const stTri = illuTriangleReadState(currentElement);
            illuTriangleWritePoints(currentElement, x, y, w, h, stTri.adj, stTri.vf);
            if (currentElement.getAttribute('data-vgrad')) {
                syncVectorGradientOnShape(currentElement, 'rect', x, y, x + w, y + h);
            }
            break;
        }
        case 'circle': {
            let x0 = Math.min(startX, pos.x);
            let y0 = Math.min(startY, pos.y);
            let x1 = Math.max(startX, pos.x);
            let y1 = Math.max(startY, pos.y);
            if (sh) {
                const b = constrainRectSelectionDraw(startX, startY, pos.x, pos.y, true);
                x0 = b.x;
                y0 = b.y;
                x1 = b.x + b.w;
                y1 = b.y + b.h;
            }
            const rw = (x1 - x0) / 2;
            const rh = (y1 - y0) / 2;
            const cx = x0 + rw;
            const cy = y0 + rh;
            currentElement.setAttribute('cx', String(cx));
            currentElement.setAttribute('cy', String(cy));
            currentElement.setAttribute('rx', String(Math.max(0, rw)));
            currentElement.setAttribute('ry', String(Math.max(0, rh)));
            if (currentElement.getAttribute('data-vgrad')) {
                syncVectorGradientOnShape(currentElement, 'rect', x0, y0, x1, y1);
            }
            break;
        }
        case 'line': {
            const ep = constrainLineEndpoint(startX, startY, pos.x, pos.y, sh);
            if (sh || currentElement.getAttribute('data-illu-line-straight') === '1') {
                currentElement.setAttribute('d', formatIlluStraightLinePath(startX, startY, ep.x, ep.y));
                currentElement.setAttribute('data-illu-line-straight', '1');
                currentElement.removeAttribute('data-illu-line-cubic');
            } else {
                const cd = cubicLineDefaults(startX, startY, ep.x, ep.y);
                currentElement.setAttribute('d', formatIlluLinePath(cd));
                currentElement.setAttribute('data-illu-line-cubic', '1');
                currentElement.removeAttribute('data-illu-line-straight');
            }
            if (currentElement.getAttribute('data-vgrad')) {
                syncVectorGradientOnShape(currentElement, 'line', startX, startY, ep.x, ep.y);
            }
            window.vectorApplyLineEndpointMarkers(currentElement);
            break;
        }
        case 'brush':
        case 'pen':
            const d = currentElement.getAttribute('d');
            currentElement.setAttribute('d', d + ` L ${pos.x} ${pos.y}`);
            break;
        case 'polygon': {
            const dx = pos.x - startX;
            const dy = pos.y - startY;
            const r = Math.sqrt(dx * dx + dy * dy);
            const sides = sh ? 6 : 5; // 6 sides if shift, else 5
            const points = [];
            let angle = Math.atan2(dy, dx);
            for (let i = 0; i < sides; i++) {
                points.push(`${startX + r * Math.cos(angle)},${startY + r * Math.sin(angle)}`);
                angle += (Math.PI * 2) / sides;
            }
            currentElement.setAttribute('points', points.join(' '));
            if (currentElement.getAttribute('data-vgrad')) {
                syncVectorGradientOnShape(currentElement, 'rect', startX - r, startY - r, startX + r, startY + r);
            }
            break;
        }
    }
    if (['rect', 'circle', 'line', 'round-3', 'triangle', 'pen', 'polygon'].includes(window.activeTool)) {
        EditorManager.render();
    }
}

let moveBufferCanvas = null;
let moveOffset = { x: 0, y: 0 };
/** Fantôme pixels lors du déplacement d’une sélection (pas du calque entier). */
let moveGhostLayer = null;
/** True si le glisser courant déplace les pixels de la sélection ; false = déplacement du calque actif. */
let isMovingSelection = false;
/** Position calque au début d’un glisser (outil Déplacer, sans déplacement de sélection). */
let moveLayerStartPos = null;
/** Copie des points lasso au début du glisser (déplacement calque entier) pour suivre le mouvement. */
var moveLayerStartLassoPoints = null;
var selectionRotateStartPointerAngle = 0;
var selectionRotateStartPreview = 0;
var shapeLiveRotateStartPointerAngle = 0;
var shapeLiveRotateStartPreview = 0;
window._shapeLivePreviewAngleRad = 0;
window._shapeRotDragActive = false;
window._shapeRotDragMode = null;

const SHAPE_LIVE_DRAW_TOOLS = ['rect', 'circle', 'round-3', 'triangle'];
var moveDragBoundsStart = null;
var moveDragLassoBaseline = null;

var selectionBoundsResizeActive = false;
var selectionResizeHandle = null;
var originalSelectionBounds = null;
var originalSelectionLassoPoints = null;

/**
 * Calque d’affichage des pixels (fantôme) : en mode pile DOM, dans #pixel-layer-stack au même plan que le calque actif
 * (pour ne pas masquer les calques au-dessus) ; sinon au-dessus du composite #drawing-canvas, sous le cadre de sélection et le SVG.
 */
function illuMountPreviewCanvasBeforeSelectionOverlay(el) {
    if (!el) return;
    const em = window.EditorManager;
    if (
        em &&
        typeof em.mountMoveGhostInPixelStackIfNeeded === 'function' &&
        em.mountMoveGhostInPixelStackIfNeeded(el)
    ) {
        const stack = document.getElementById('pixel-layer-stack');
        if (stack && typeof em._restackStackPreviewOverlays === 'function') {
            em._restackStackPreviewOverlays(stack);
        }
        return;
    }
    const mc = document.getElementById('main-canvas-container');
    const svg = document.getElementById('drawing-svg');
    if (!mc) return;
    el.classList.remove('illu-stack-preview-overlay');
    if (!el.style.position) el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '2';
    el.style.opacity = '';
    el.style.mixBlendMode = '';
    const anchor = selectionOverlay.parentNode === mc ? selectionOverlay : svg;
    if (anchor && anchor.parentNode === mc) {
        mc.insertBefore(el, anchor);
    } else if (svg && svg.parentNode === mc) {
        mc.insertBefore(el, svg);
    } else {
        mc.appendChild(el);
    }
}

function illuMountMoveLayerWholeGhostInStack() {
    if (!moveLayerWholeGhostEl) return;
    illuMountPreviewCanvasBeforeSelectionOverlay(moveLayerWholeGhostEl);
}

/** Pendant le fantôme « type Déplacer » avec session warp Déformation : garde le quad aligné sur le cadre. */
function illuSyncDeformWarpQuadToGhostBounds(nx, ny, w, h) {
    if (!window.selectionPixelWarpActive || !window.selectionWarpQuad || !selectionWarpDeformRect) return;
    const R = selectionWarpDeformRect;
    const q = window.selectionWarpQuad;
    R.rx = nx;
    R.ry = ny;
    R.rw = w;
    R.rh = h;
    q.tl.x = R.rx;
    q.tl.y = R.ry;
    q.tr.x = R.rx + R.rw;
    q.tr.y = R.ry;
    q.br.x = R.rx + R.rw;
    q.br.y = R.ry + R.rh;
    q.bl.x = R.rx;
    q.bl.y = R.ry + R.rh;
}

/** Outils pixel avec déplacement calque / sélection (même logique). Déformation : seulement via le bouton central, pas le clic toile. */
function illuPixelMoveOrDeformTool() {
    if (window.activeTool === 'move') return true;
    return window.activeTool === 'deform' && !!window._illuDeformMoveFromButtonActive;
}

/** Réinitialise l’état « déplacement sélection » pour éviter qu’un ancien glisser ne bloque le déplacement du calque. */
function illuResetMoveSelectionDragArtifacts() {
    illuRestoreMoveSelectionLayerSnapshot();
    isMovingSelection = false;
    if (moveGhostLayer && moveGhostLayer.parentNode) {
        try {
            moveGhostLayer.remove();
        } catch (e) {
            /* ignore */
        }
    }
    moveGhostLayer = null;
    if (moveLayerWholeGhostEl && moveLayerWholeGhostEl.parentNode) {
        try {
            moveLayerWholeGhostEl.remove();
        } catch (e) {
            /* ignore */
        }
    }
    moveLayerWholeGhostEl = null;
    const al = EditorManager.activeLayer;
    if (al && al._ghostDragHide) delete al._ghostDragHide;
    moveDragBoundsStart = null;
    moveDragLassoBaseline = null;
    moveBufferCanvas = null;
    moveSelectionLayerSnapshot = null;
    if (illuSelectionInteractionOwner === 'movePixels' || illuSelectionInteractionOwner === 'moveLayer') {
        illuSelectionInteractionOwner = null;
    }
}

window.selectionMatchesActiveLayer = function () {
    const l = EditorManager.activeLayer;
    const sb = window.selectionBounds;
    if (!l || !l.buffer || !sb) return false;
    const tol = 2.5;
    if (l.importPlacementPending && l.importStagingBuffer) {
        return (
            Math.abs(sb.x - (l.importStagingX | 0)) < tol &&
            Math.abs(sb.y - (l.importStagingY | 0)) < tol &&
            Math.abs(sb.w - l.importStagingBuffer.width) < tol &&
            Math.abs(sb.h - l.importStagingBuffer.height) < tol
        );
    }
    return (
        Math.abs(sb.x - l.x) < tol &&
        Math.abs(sb.y - l.y) < tol &&
        Math.abs(sb.w - l.buffer.width) < tol &&
        Math.abs(sb.h - l.buffer.height) < tol
    );
};

/** Vrai si la sélection est incluse dans le calque actif mais plus petite (déplacement des pixels). */
window.selectionIsStrictSubsetOfActiveLayer = function () {
    const l = EditorManager.activeLayer;
    const sb = window.selectionBounds;
    if (!l || !l.buffer || !sb || sb.w <= 2 || sb.h <= 2) return false;
    if (window.selectionMatchesActiveLayer()) return false;
    const lx = l.x;
    const ly = l.y;
    const lw = l.buffer.width;
    const lh = l.buffer.height;
    return (
        sb.x >= lx - 1 &&
        sb.y >= ly - 1 &&
        sb.x + sb.w <= lx + lw + 1 &&
        sb.y + sb.h <= ly + lh + 1
    );
};

window.syncSelectionToActiveLayer = function () {
    const l = EditorManager.activeLayer;
    if (!l || !l.buffer || !EditorManager.isPixelMode) return;
    window.selectionInverted = false;
    window.selectionKind = 'rect';
    window.selectionColorMask = null;
    window.selectionLassoPoints = null;
    window.selectionIsWarpQuad = false;
    window.selectionPreviewAngleRad = 0;
    window.selectionBounds = {
        x: l.x,
        y: l.y,
        w: l.buffer.width,
        h: l.buffer.height
    };
    if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
    window.refreshSelectionVisual();
    EditorManager.render();
};

/** Sélection = rectangle de l’image posée après validation du collage volant. */
window.syncSelectionToCommittedImportBounds = function (bounds) {
    if (!bounds || !EditorManager.isPixelMode) return;
    window.selectionInverted = false;
    window.selectionKind = 'rect';
    window.selectionColorMask = null;
    window.selectionLassoPoints = null;
    window.selectionIsWarpQuad = false;
    window.selectionPreviewAngleRad = 0;
    window.selectionBounds = {
        x: bounds.x | 0,
        y: bounds.y | 0,
        w: Math.max(1, bounds.w | 0),
        h: Math.max(1, bounds.h | 0)
    };
    if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
    window.refreshSelectionVisual();
    EditorManager.render();
};

/** Sélection = rectangle du tampon du calque (collage « placement » avant validation). */
window.syncSelectionToImportPlacementLayer = function () {
    const l = EditorManager.activeLayer;
    if (!l || !l.buffer || !EditorManager.isPixelMode || !l.importPlacementPending) return;
    const st = l.importStagingBuffer;
    if (!st) return;
    window.selectionInverted = false;
    window.selectionKind = 'rect';
    window.selectionColorMask = null;
    window.selectionLassoPoints = null;
    window.selectionIsWarpQuad = false;
    window.selectionPreviewAngleRad = 0;
    window.selectionBounds = {
        x: l.importStagingX | 0,
        y: l.importStagingY | 0,
        w: st.width,
        h: st.height
    };
    if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
    window.refreshSelectionVisual();
    EditorManager.render();
};

/**
 * Anciennement : l’outil Déplacer pouvait étirer le tampon du calque pour suivre le cadre.
 * L’agrandissement / réduction du tampon est réservé à l’outil Déformation (ou warp-4) ;
 * Déplacer ne fait que déplacer la sélection / les pixels sans changer la taille du buffer.
 * @returns {boolean} toujours false (conservé pour les appels existants)
 */
window.applyMoveToolLayerResizeIfNeeded = function (originalBounds, finalBounds) {
    return false;
};

window.startSelectionResize = function (e, handleId) {
    if (!window.selectionBounds || !EditorManager.isPixelMode) return;
    selectionBoundsResizeActive = true;
    selectionResizeHandle = handleId;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    originalSelectionBounds = { ...window.selectionBounds };
    if (window.selectionKind === 'lasso' && window.selectionLassoPoints) {
        originalSelectionLassoPoints = window.selectionLassoPoints.map((p) => ({ x: p.x, y: p.y }));
    } else {
        originalSelectionLassoPoints = null;
    }
    if (typeof window.illuSelectionLoupeTryShow === 'function') {
        window.illuSelectionLoupeTryShow(e, handleId);
    }
};

function cloneCanvasForWarp(c) {
    const n = document.createElement('canvas');
    n.width = c.width;
    n.height = c.height;
    n.getContext('2d', { willReadFrequently: true }).drawImage(c, 0, 0);
    return n;
}

function illuRemoveWarpPatchPreviewOverlay() {
    if (selectionWarpPreviewOverlayEl) {
        try {
            selectionWarpPreviewOverlayEl.remove();
        } catch (e) {
            /* ignore */
        }
        selectionWarpPreviewOverlayEl = null;
    }
    document.querySelectorAll('.illu-warp-preview-overlay').forEach((el) => {
        if (el !== selectionWarpPreviewOverlayEl) {
            try {
                el.remove();
            } catch (e) {
                /* ignore */
            }
        }
    });
}

function illuEnsureWarpPatchScratchCanvas(w, h) {
    if (!selectionWarpPatchScratchCanvas) {
        selectionWarpPatchScratchCanvas = document.createElement('canvas');
    }
    if (selectionWarpPatchScratchCanvas.width !== w) selectionWarpPatchScratchCanvas.width = w;
    if (selectionWarpPatchScratchCanvas.height !== h) selectionWarpPatchScratchCanvas.height = h;
    return selectionWarpPatchScratchCanvas;
}

/** Masque la vue DOM du calque actif sans recompositer toute la pile. */
function illuHideActiveLayerForWarpPreview() {
    const l = EditorManager.activeLayer;
    if (!l) return;
    l._ghostDragHide = true;
    const map = EditorManager._pixelLayerViewEls;
    const cv = map && map.get(l.id);
    if (cv) {
        cv.style.display = 'none';
    }
    if (selectionWarpImportStagingMode && EditorManager._pixelLayerStagingViewEls) {
        const stv = EditorManager._pixelLayerStagingViewEls.get(l.id);
        if (stv) stv.style.display = 'none';
    }
    if (!cv) {
        EditorManager.render({ skipUiThumbnails: true, skipDrawUI: true });
    }
}

function illuWarpPixelOrigin(layer) {
    if (selectionWarpImportStagingMode && layer && layer.importStagingBuffer) {
        return {
            x: layer.importStagingX | 0,
            y: layer.importStagingY | 0,
            buffer: layer.importStagingBuffer
        };
    }
    if (!layer) return { x: 0, y: 0, buffer: null };
    return { x: layer.x, y: layer.y, buffer: layer.buffer };
}

/** Clic hors du cadre du collage volant → poser sur le calque. */
function illuTryCommitImportPlacementOnOutsideClick(e, pos) {
    const l = EditorManager.activeLayer;
    if (!EditorManager.isPixelMode || !l || !l.importPlacementPending) return false;
    if (e.target && e.target.closest) {
        if (
            e.target.closest(
                '#svg-ui, .illu-deform-move-fo, .tool-btn, #win-tools, #tool-options-container, #layer-panel, .ctx-menu'
            )
        ) {
            return false;
        }
    }
    const sb = window.selectionBounds;
    if (sb) {
        const z = EditorManager.getCanvasZoomLevel() || 1;
        const pad = 6 / z;
        const inside =
            pos.x >= sb.x - pad &&
            pos.x <= sb.x + sb.w + pad &&
            pos.y >= sb.y - pad &&
            pos.y <= sb.y + sb.h + pad;
        if (inside) return false;
    }
    if (
        typeof EditorManager.commitImportPlacementIfPending === 'function' &&
        EditorManager.commitImportPlacementIfPending()
    ) {
        return true;
    }
    return false;
}

function illuComputeWarpSelectionHandles() {
    const q = window.selectionWarpQuad;
    if (!q) return [];
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    if (window.activeTool === 'deform') {
        const n = mid(q.tl, q.tr);
        const em = mid(q.tr, q.br);
        const sm = mid(q.br, q.bl);
        const wm = mid(q.bl, q.tl);
        const cx = (q.tl.x + q.tr.x + q.br.x + q.bl.x) / 4;
        const cy = (q.tl.y + q.tr.y + q.br.y + q.bl.y) / 4;
        return [
            { x: q.tl.x, y: q.tl.y, id: 'nw' },
            { x: n.x, y: n.y, id: 'n' },
            { x: q.tr.x, y: q.tr.y, id: 'ne' },
            { x: wm.x, y: wm.y, id: 'w' },
            { x: em.x, y: em.y, id: 'e' },
            { x: q.bl.x, y: q.bl.y, id: 'sw' },
            { x: sm.x, y: sm.y, id: 's' },
            { x: q.br.x, y: q.br.y, id: 'se' },
            { x: cx, y: cy, id: 'c' }
        ];
    }
    return [
        { x: q.tl.x, y: q.tl.y, id: 'nw' },
        { x: q.tr.x, y: q.tr.y, id: 'ne' },
        { x: q.br.x, y: q.br.y, id: 'se' },
        { x: q.bl.x, y: q.bl.y, id: 'sw' }
    ];
}

/** Déplace les poignées SVG existantes sans vider #svg-ui (évite scintillement). */
function illuUpdateWarpHandlePositionsOnly() {
    if (!window.selectionPixelWarpActive || !window.selectionWarpQuad) return false;
    const svgUI = document.getElementById('svg-ui');
    if (!svgUI || typeof EditorManager === 'undefined') return false;
    const handles = illuComputeWarpSelectionHandles();
    if (!handles.length) return false;
    const z = EditorManager.getCanvasZoomLevel() || 1;
    const hsz = EditorManager.svgUiHandleSizeDoc();
    const hHalf = hsz / 2;
    let matched = 0;
    for (let i = 0; i < handles.length; i++) {
        const hnd = handles[i];
        const el = svgUI.querySelector('[data-selection-handle="' + hnd.id + '"]');
        if (!el) return false;
        if (el.tagName === 'rect') {
            el.setAttribute('x', String(hnd.x - hHalf));
            el.setAttribute('y', String(hnd.y - hHalf));
            matched++;
        } else if (el.tagName === 'foreignObject' && hnd.id === 'c') {
            const size = EditorManager.svgUiMoveButtonSizeDoc();
            const half = size / 2;
            el.setAttribute('x', String(hnd.x - half));
            el.setAttribute('y', String(hnd.y - half));
            el.setAttribute('width', String(size));
            el.setAttribute('height', String(size));
            matched++;
        } else {
            return false;
        }
    }
    return matched === handles.length;
}

function illuRefreshWarpInteractiveChrome() {
    if (!window.selectionPixelWarpActive || !window.selectionWarpQuad) return;
    if (typeof window.updateWarpSelectionOverlayFast === 'function') {
        window.updateWarpSelectionOverlayFast(window.selectionWarpQuad);
    } else if (typeof window.refreshSelectionVisual === 'function') {
        window.refreshSelectionVisual();
    }
    if (!illuUpdateWarpHandlePositionsOnly()) {
        if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(false);
    }
}

function illuScheduleWarpChromeRefresh() {
    if (selectionWarpChromeRaf) return;
    selectionWarpChromeRaf = requestAnimationFrame(() => {
        selectionWarpChromeRaf = 0;
        illuRefreshWarpInteractiveChrome();
    });
}

function illuRemoveWarpBasePreviewOverlay() {
    document.querySelectorAll('.illu-warp-base-preview-overlay').forEach((el) => {
        try {
            el.remove();
        } catch (e) {
            /* ignore */
        }
    });
    selectionWarpBasePreviewOverlayEl = null;
}

/** Calque statique (reste du calque avec trou source) — créé une fois au début du warp. */
function illuEnsureWarpBasePreviewOverlay(layerX, layerY) {
    if (selectionWarpBasePreviewOverlayEl || !selectionWarpFullLayerCanvas) {
        return selectionWarpBasePreviewOverlayEl;
    }
    const canvas = cloneCanvasForWarp(selectionWarpFullLayerCanvas);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) illuClearSelectionWarpSourceRegion(ctx);
    canvas.className = 'illu-warp-base-preview-overlay';
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.left = `${Math.round(layerX)}px`;
    canvas.style.top = `${Math.round(layerY)}px`;
    illuMountPreviewCanvasBeforeSelectionOverlay(canvas);
    selectionWarpBasePreviewOverlayEl = canvas;
    return canvas;
}

function illuScheduleSelectionWarpPreview(opts) {
    selectionWarpPreviewPendingOpts = opts || { preview: true };
    if (selectionWarpPreviewRaf) return;
    selectionWarpPreviewRaf = requestAnimationFrame(() => {
        selectionWarpPreviewRaf = 0;
        const pending = selectionWarpPreviewPendingOpts;
        selectionWarpPreviewPendingOpts = null;
        if (
            window.selectionPixelWarpActive &&
            typeof window.runSelectionWarpPreview === 'function'
        ) {
            window.runSelectionWarpPreview(pending);
        }
    });
}
window.illuScheduleSelectionWarpPreview = illuScheduleSelectionWarpPreview;

function illuRemoveWarpPreviewOverlay() {
    if (selectionWarpChromeRaf) {
        cancelAnimationFrame(selectionWarpChromeRaf);
        selectionWarpChromeRaf = 0;
    }
    illuRemoveWarpPatchPreviewOverlay();
    illuRemoveWarpBasePreviewOverlay();

    const l = EditorManager.activeLayer;
    if (l) {
        if (l._ghostDragHide) delete l._ghostDragHide;
        if (l._warpSrcHoleCleared && selectionWarpFullLayerCanvas) {
            if (selectionWarpImportStagingMode && l.importStagingBuffer) {
                const sctx = l.importStagingBuffer.getContext('2d', { willReadFrequently: true });
                if (sctx) sctx.drawImage(selectionWarpFullLayerCanvas, 0, 0);
            } else if (l.buffer) {
                const ctx = l.buffer.getContext('2d', { willReadFrequently: true });
                if (ctx) ctx.drawImage(selectionWarpFullLayerCanvas, 0, 0);
            }
            delete l._warpSrcHoleCleared;
        }
        if (selectionWarpImportStagingMode && EditorManager._pixelLayerStagingViewEls) {
            const stv = EditorManager._pixelLayerStagingViewEls.get(l.id);
            if (stv) stv.style.display = '';
            EditorManager.render({ skipUiThumbnails: true, skipDrawUI: true });
        }
    }
}

function illuSetWarpPreviewOverlay(sourceCanvas, docX, docY, skipHideLayer, upscaleW, upscaleH) {
    const l = EditorManager.activeLayer;
    if (l && !skipHideLayer) l._ghostDragHide = true;

    let canvas = selectionWarpPreviewOverlayEl;
    const sw = sourceCanvas.width | 0;
    const sh = sourceCanvas.height | 0;
    if (!canvas || !canvas.isConnected) {
        canvas = document.createElement('canvas');
        canvas.className = 'illu-warp-preview-overlay';
        canvas.style.position = 'absolute';
        canvas.style.pointerEvents = 'none';
        illuMountPreviewCanvasBeforeSelectionOverlay(canvas);
        selectionWarpPreviewOverlayEl = canvas;
    } else if (!canvas.classList.contains('illu-warp-preview-overlay')) {
        canvas.classList.add('illu-warp-preview-overlay');
    }

    if (canvas.width !== sw) canvas.width = sw;
    if (canvas.height !== sh) canvas.height = sh;
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(sourceCanvas, 0, 0);

    canvas.style.left = `${Math.round(docX)}px`;
    canvas.style.top = `${Math.round(docY)}px`;

    if (upscaleW && upscaleH) {
        canvas.style.width = `${Math.round(upscaleW)}px`;
        canvas.style.height = `${Math.round(upscaleH)}px`;
    } else {
        canvas.style.width = '';
        canvas.style.height = '';
    }

    const isNearest =
        typeof window.illuWarpUseSmoothResample === 'function'
            ? !window.illuWarpUseSmoothResample()
            : window.illuInterpolationMode === 'nearest';
    canvas.style.imageRendering = isNearest ? 'pixelated' : 'auto';
    if (isNearest) {
        canvas.style.setProperty('image-rendering', 'crisp-edges');
    } else {
        canvas.style.removeProperty('image-rendering');
    }
}

function sampleBilinearRGBA(data, w, h, x, y) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= w - 1) x = w - 1 - 1e-6;
    if (y >= h - 1) y = h - 1 - 1e-6;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const tx = x - x0;
    const ty = y - y0;
    const idx = (yy, xx) => (yy * w + xx) * 4;
    const lerp = (a, b, t) => a + (b - a) * t;
    const i00 = idx(y0, x0);
    const i10 = idx(y0, x1);
    const i01 = idx(y1, x0);
    const i11 = idx(y1, x1);
    const ch = (o) => lerp(lerp(data[i00 + o], data[i10 + o], tx), lerp(data[i01 + o], data[i11 + o], tx), ty);
    return [ch(0), ch(1), ch(2), ch(3)];
}

function illuGetWarpCore() {
    return typeof globalThis !== 'undefined' && globalThis.IlluWarpCore ? globalThis.IlluWarpCore : null;
}

function illuWarpWorkerSupported() {
    return !selectionWarpWorkerBroken && typeof Worker !== 'undefined' && !!illuGetWarpCore();
}

function illuTerminateWarpWorker(markBroken) {
    if (selectionWarpWorkersPool.length > 0) {
        selectionWarpWorkersPool.forEach((worker) => {
            try { worker.terminate(); } catch (e) { /* ignore */ }
        });
    }
    selectionWarpWorkersPool = [];
    selectionWarpWorkerBusy = false;
    selectionWarpWorkerCurrentJob = null;
    selectionWarpWorkerQueuedJob = null;
    warpJobState = null;
    if (markBroken) selectionWarpWorkerBroken = true;
}

function illuHandleWarpWorkerResult(ev) {
    const msg = ev.data || {};
    if (msg.type === 'error') {
        if (warpJobState && warpJobState.jobId === msg.jobId) warpJobState.hasError = true;
        illuTerminateWarpWorker(true);
        return;
    }
    if (msg.type !== 'renderPatchResult' && msg.type !== 'nullResult') return;
    if (!warpJobState || warpJobState.jobId !== msg.jobId || warpJobState.sessionId !== msg.sessionId) return;

    if (msg.type === 'renderPatchResult') {
        const patchData = new Uint8ClampedArray(msg.patchBuffer);
        warpJobState.resultBuffer.set(patchData, msg.chunkOffset);
    }

    warpJobState.partsDone++;

    if (warpJobState.partsDone === warpJobState.partsTotal) {
        const finishedJob = selectionWarpWorkerCurrentJob;
        selectionWarpWorkerBusy = false;
        selectionWarpWorkerCurrentJob = null;

        if (finishedJob.onComplete) {
            finishedJob.onComplete(warpJobState.hasError, warpJobState.hasError ? null : warpJobState.resultBuffer);
        } else if (!warpJobState.hasError && window.selectionPixelWarpActive && selectionWarpHandlePointerDown && selectionWarpDragLayerSnapshot && selectionWarpFullLayerCanvas && EditorManager.activeLayer) {
            const previewCanvas = cloneCanvasForWarp(selectionWarpFullLayerCanvas);
            const pctx = previewCanvas.getContext('2d', { willReadFrequently: true });
            if (pctx) {
                const stride = warpJobState.stride || 1;
                const rw = stride <= 1 ? warpJobState.patchWidth : Math.ceil(warpJobState.patchWidth / stride);
                const rh = stride <= 1 ? warpJobState.patchHeight : Math.ceil(warpJobState.patchHeight / stride);

                if (stride <= 1) {
                    pctx.putImageData(new ImageData(warpJobState.resultBuffer, rw, rh), warpJobState.patchX, warpJobState.patchY);
                } else {
                    const tmp = document.createElement('canvas');
                    tmp.width = rw;
                    tmp.height = rh;
                    tmp.getContext('2d', { willReadFrequently: true }).putImageData(new ImageData(warpJobState.resultBuffer, rw, rh), 0, 0);
                    pctx.save();
                    pctx.imageSmoothingEnabled = false;
                    pctx.drawImage(tmp, warpJobState.patchX, warpJobState.patchY, warpJobState.patchWidth, warpJobState.patchHeight);
                    pctx.restore();
                }
                illuClearSelectionWarpSourceRegion(pctx);
                illuSetWarpPreviewOverlay(previewCanvas, finishedJob.previewLayerX, finishedJob.previewLayerY, true);
                illuScheduleWarpChromeRefresh();
            }
        }

        if (selectionWarpWorkerQueuedJob) {
            const next = selectionWarpWorkerQueuedJob;
            selectionWarpWorkerQueuedJob = null;
            illuDispatchWarpWorkerJob(next);
        }
    }
}

function illuEnsureWarpWorker() {
    if (!illuWarpWorkerSupported()) return null;
    if (selectionWarpWorkersPool.length > 0) return selectionWarpWorkersPool;
    try {
        let maxWorkers = navigator.hardwareConcurrency || 4;
        if (maxWorkers > 8) maxWorkers = 8;
        for (let i = 0; i < maxWorkers; i++) {
            console.log('DrawingTools: Initializing Warp worker', i, '(js/tools/warp-worker.js)');
            const worker = new Worker('js/tools/warp-worker.js');
            worker.onmessage = illuHandleWarpWorkerResult;
            worker.onerror = function (err) {
                console.error('DrawingTools: Warp worker error', err);
                illuTerminateWarpWorker(true);
            };
            selectionWarpWorkersPool.push(worker);
        }
        return selectionWarpWorkersPool;
    } catch (e) {
        illuTerminateWarpWorker(true);
        return null;
    }
}

function illuCloseWarpWorkerSession() {
    if (selectionWarpWorkersPool.length > 0 && selectionWarpWorkerSessionId) {
        selectionWarpWorkersPool.forEach((worker) => {
            try { worker.postMessage({ type: 'dropSession', sessionId: selectionWarpWorkerSessionId }); } catch (e) { /* ignore */ }
        });
    }
    selectionWarpWorkerSessionId = 0;
    selectionWarpWorkerLatestJobId = 0;
    selectionWarpWorkerBusy = false;
    selectionWarpWorkerCurrentJob = null;
    selectionWarpWorkerQueuedJob = null;
    warpJobState = null;
}

function illuInitWarpWorkerSession() {
    const pool = illuEnsureWarpWorker();
    if (!pool || pool.length === 0 || !window.selectionWarpBackupImageData || !window.selectionWarpBackupImageData.data) {
        illuCloseWarpWorkerSession();
        return;
    }
    illuCloseWarpWorkerSession();
    selectionWarpWorkerSessionId = ++selectionWarpWorkerSessionSeq;

    pool.forEach((worker) => {
        const sourceCopy = new Uint8ClampedArray(window.selectionWarpBackupImageData.data);
        try {
            worker.postMessage(
                {
                    type: 'initSession',
                    sessionId: selectionWarpWorkerSessionId,
                    sourceWidth: selectionWarpSw,
                    sourceHeight: selectionWarpSh,
                    sourceBuffer: sourceCopy.buffer
                },
                [sourceCopy.buffer]
            );
        } catch (e) {
            illuTerminateWarpWorker(true);
            illuCloseWarpWorkerSession();
        }
    });
}

function illuDispatchWarpWorkerJob(job) {
    const pool = illuEnsureWarpWorker();
    if (!pool || pool.length === 0 || !job) return false;
    const stride = Math.max(1, job.stride || 1);
    const usePartitions = (stride === 1) ? Math.min(pool.length, 8) : 1;

    selectionWarpWorkerBusy = true;
    selectionWarpWorkerCurrentJob = job;

    const rw = stride === 1 ? job.patchWidth : Math.ceil(job.patchWidth / stride);
    const rh = stride === 1 ? job.patchHeight : Math.ceil(job.patchHeight / stride);

    warpJobState = {
        jobId: job.jobId,
        sessionId: job.sessionId,
        partsTotal: usePartitions,
        partsDone: 0,
        resultBuffer: new Uint8ClampedArray(rw * rh * 4),
        patchX: job.patchX,
        patchY: job.patchY,
        patchWidth: job.patchWidth,
        patchHeight: job.patchHeight,
        stride: stride,
        hasError: false
    };

    const baseU8 = new Uint8ClampedArray(job.baseBuffer);
    let startY = 0;

    for (let i = 0; i < usePartitions; i++) {
        const remainingH = job.patchHeight - startY;
        const h = (i === usePartitions - 1) ? remainingH : Math.floor(job.patchHeight / usePartitions);
        if (h <= 0) {
            warpJobState.partsTotal--;
            continue;
        }

        const chunkOffset = (startY * job.patchWidth * 4);
        const chunkLen = (h * job.patchWidth * 4);
        let chunkBase = null;
        if (chunkOffset + chunkLen <= baseU8.length) {
            chunkBase = baseU8.slice(chunkOffset, chunkOffset + chunkLen);
        } else {
            chunkBase = new Uint8ClampedArray(chunkLen); // Fallback
        }

        const resultChunkOffset = (stride === 1) ? chunkOffset : 0;

        try {
            pool[i].postMessage(
                {
                    type: 'renderPatch',
                    sessionId: job.sessionId,
                    jobId: job.jobId,
                    patchX: job.patchX,
                    patchY: job.patchY + startY,
                    patchWidth: job.patchWidth,
                    patchHeight: h,
                    srcQuad: job.srcQuad,
                    dstQuad: job.dstQuad,
                    polyLocal: job.polyLocal,
                    stride: stride,
                    smooth: job.smooth,
                    chunkOffset: resultChunkOffset,
                    baseBuffer: chunkBase.buffer
                },
                [chunkBase.buffer]
            );
        } catch (e) {
            illuTerminateWarpWorker(true);
            return false;
        }
        startY += h;
    }
    return true;
}

function illuQueueWarpWorkerJob(job) {
    selectionWarpWorkerLatestJobId = job.jobId;
    if (selectionWarpWorkerBusy) {
        selectionWarpWorkerQueuedJob = job;
        return true;
    }
    return illuDispatchWarpWorkerJob(job);
}

function illuRestoreWarpDragSnapshotLayer() {
    if (!selectionWarpDragLayerSnapshot || !EditorManager.activeLayer) return;
    const l = EditorManager.activeLayer;
    if (selectionWarpDragLayerSnapshot.importStaging) {
        l.importStagingBuffer = EditorManager.cloneCanvas(selectionWarpDragLayerSnapshot.buffer);
        l.importStagingX = selectionWarpDragLayerSnapshot.x | 0;
        l.importStagingY = selectionWarpDragLayerSnapshot.y | 0;
    } else {
        l.buffer = EditorManager.cloneCanvas(selectionWarpDragLayerSnapshot.buffer);
        l.x = selectionWarpDragLayerSnapshot.x;
        l.y = selectionWarpDragLayerSnapshot.y;
    }
}

/** Perce le trou source sur le tampon calque (aperçu déformation / déplacement). */
function illuApplyWarpSourceHoleToActiveLayer() {
    const l = EditorManager.activeLayer;
    if (!l || !l.buffer || !selectionWarpSourceClearBounds) return false;
    const ctx = l.buffer.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.save();
    illuClearSelectionWarpSourceRegion(ctx);
    ctx.restore();
    l._warpSrcHoleCleared = true;
    return true;
}

/** Retire les pixels à la position d’origine pendant un déplacement de sélection. */
function illuClearMoveSelectionSourceRegion(lctx, lx, ly) {
    if (!lctx || !moveDragBoundsStart || !moveBufferCanvas) return;
    const ox = Math.floor(moveDragBoundsStart.x - lx);
    const oy = Math.floor(moveDragBoundsStart.y - ly);
    const sw = moveBufferCanvas.width;
    const sh = moveBufferCanvas.height;
    if (sw < 1 || sh < 1) return;
    lctx.save();
    if (
        moveDragLassoBaseline &&
        moveDragLassoBaseline.length >= 3 &&
        window.selectionKind === 'lasso'
    ) {
        lctx.beginPath();
        moveDragLassoBaseline.forEach((p, i) => {
            const px = p.x - lx;
            const py = p.y - ly;
            if (i === 0) lctx.moveTo(px, py);
            else lctx.lineTo(px, py);
        });
        lctx.closePath();
        lctx.clip();
        lctx.clearRect(ox, oy, sw, sh);
    } else if (
        window.selectionKind === 'color' &&
        window.selectionColorMask &&
        typeof EditorManager !== 'undefined' &&
        EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask) &&
        typeof EditorManager.appendColorMaskRectsToPath === 'function'
    ) {
        const m = window.selectionColorMask;
        const bx = Math.max(0, ox);
        const by = Math.max(0, oy);
        const bw = Math.min(lctx.canvas.width - bx, sw);
        const bh = Math.min(lctx.canvas.height - by, sh);
        lctx.beginPath();
        lctx.rect(bx, by, bw, bh);
        lctx.clip();
        lctx.beginPath();
        EditorManager.appendColorMaskRectsToPath(lctx, m);
        lctx.clip();
        lctx.clearRect(bx, by, bw, bh);
    } else {
        lctx.clearRect(ox, oy, sw, sh);
    }
    lctx.restore();
}

function illuRestoreMoveSelectionLayerSnapshot() {
    const l = EditorManager.activeLayer;
    if (!l || !l.buffer || !moveSelectionLayerSnapshot || !l._movePixelsHoleCleared) return;
    const lctx = l.buffer.getContext('2d', { willReadFrequently: true });
    if (!lctx) return;
    lctx.clearRect(0, 0, l.buffer.width, l.buffer.height);
    lctx.drawImage(moveSelectionLayerSnapshot, 0, 0);
    delete l._movePixelsHoleCleared;
}

function illuClearSelectionWarpSourceRegion(ctx) {
    if (!ctx || !selectionWarpSourceClearBounds) return;
    const b = selectionWarpSourceClearBounds;

    // --- CORRECTIF TROU DÉFORMATION : Creuser le trou selon le masque ---
    if (window._warpSourceClearColorMask && typeof EditorManager !== 'undefined' && EditorManager.appendColorMaskRectsToPath) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(b.x, b.y, b.w, b.h);
        ctx.clip();
        ctx.beginPath();
        EditorManager.appendColorMaskRectsToPath(ctx, window._warpSourceClearColorMask);
        ctx.clip();
        ctx.clearRect(b.x, b.y, b.w, b.h);
        ctx.restore();
        return;
    }

    if (
        selectionWarpSourceClearLocalPoints &&
        selectionWarpSourceClearLocalPoints.length >= 3 &&
        window.selectionKind === 'lasso'
    ) {
        ctx.save();
        ctx.beginPath();
        selectionWarpSourceClearLocalPoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.clip();
        ctx.clearRect(b.x, b.y, b.w, b.h);
        ctx.restore();
        return;
    }
    ctx.clearRect(b.x, b.y, b.w, b.h);
}
window.cancelSelectionInteractionState = function () {
    illuRemoveWarpPreviewOverlay();
    illuRestoreWarpDragSnapshotLayer();
    selectionWarpDragLayerSnapshot = null;
    illuSelectionInteractionOwner = null;
    selectionWarpHandlePointerDown = false;
    selectionWarpImportStagingMode = false;
    if (selectionWarpPreviewRaf) {
        cancelAnimationFrame(selectionWarpPreviewRaf);
        selectionWarpPreviewRaf = 0;
    }
    selectionWarpPreviewPendingOpts = null;
    if (selectionWarpThrottleTimeout) {
        clearTimeout(selectionWarpThrottleTimeout);
        selectionWarpThrottleTimeout = null;
    }
    illuCloseWarpWorkerSession();
    selectionCombineBackup = null;
    lassoDrawingPoints = null;
    window.selectionPixelWarpActive = false;
    window.selectionWarpQuad = null;
    selectionWarpBackupCanvas = null;
    selectionWarpFullLayerCanvas = null;
    selectionWarpHandleId = null;
    selectionWarpQuadAtStart = null;
    selectionWarpSrcQuad = null;
    selectionWarpSourceClearBounds = null;
    selectionWarpSourceClearLocalPoints = null;
    selectionWarpDeformRect = null;
    selectionWarpDeformRectAtStart = null;
    selectionWarpDeformMoveOffset = null;
    window.selectionRotationDragActive = false;
    window.selectionPreviewAngleRad = 0;
    window._selectionWarpInitialPolyLocal = null;
    if (typeof EditorManager !== 'undefined' && typeof EditorManager.render === 'function') {
        EditorManager.render({ skipUiThumbnails: true });
    }
};

/**
 * Nettoie tout l’état DOM / calques lié aux fantômes de déplacement, overlays de pile et warp.
 * Appelé depuis deselectAll (Échap, Ctrl+D) pour éviter éléments orphelins et états bloqués.
 */
window.illuPurgeSelectionOverlayAndGhostDom = function () {
    window.selectionBounds = null;
    window.selectionInverted = false;
    window.selectionKind = 'rect';
    window.selectionLassoPoints = null;
    window.selectionColorMask = null;
    window.selectionIsWarpQuad = false;
    window.selectionCombineGhost = null;
    window.selectionPreviewAngleRad = 0;
    window.selectionRotationDragActive = false;
    window.selectionPixelWarpActive = false;
    window.selectionWarpQuad = null;
    if (typeof window.invalidateSelectionOverlayFast === 'function') window.invalidateSelectionOverlayFast();
    if (window.SelectionChrome && typeof window.SelectionChrome.hideOverlay === 'function') {
        window.SelectionChrome.hideOverlay();
    } else {
        const ov = document.getElementById('selection-overlay');
        if (ov) {
            ov.style.display = 'none';
            ov.innerHTML = '';
        }
    }
    if (typeof window.illuSelectionLoupeHide === 'function') window.illuSelectionLoupeHide();
    if (typeof window.cancelSelectionInteractionState === 'function') window.cancelSelectionInteractionState();
    illuResetMoveSelectionDragArtifacts();
    moveLayerStartPos = null;
    moveLayerStartLassoPoints = null;
    deformWarpNewRectDrag = false;
    illuCropBoundsDrag = false;
    moveDragBoundsStart = null;
    selectionBoundsResizeActive = false;
    selectionResizeHandle = null;
    originalSelectionBounds = null;
    originalSelectionLassoPoints = null;
    window._illuDeformMoveFromButtonActive = false;
    illuSelectionInteractionOwner = null;
    if (typeof window.illuReleaseDeformMoveButtonPointerCapture === 'function') {
        window.illuReleaseDeformMoveButtonPointerCapture();
    }
    if (typeof EditorManager !== 'undefined' && EditorManager.layers) {
        for (let i = 0; i < EditorManager.layers.length; i++) {
            const ly = EditorManager.layers[i];
            if (ly && ly._ghostDragHide) delete ly._ghostDragHide;
        }
    }
    illuRemoveWarpPreviewOverlay();
    selectionWarpPreviewOverlayEl = null;
    const sel = 'canvas.illu-stack-preview-overlay, canvas.illu-warp-preview-overlay, canvas.illu-move-layer-whole-ghost';
    const stack = document.getElementById('pixel-layer-stack');
    if (stack) {
        stack.querySelectorAll(sel).forEach((el) => {
            try {
                el.remove();
            } catch (e) {
                /* ignore */
            }
        });
    }
    const mc = document.getElementById('main-canvas-container');
    if (mc) {
        mc.querySelectorAll(sel).forEach((el) => {
            try {
                el.remove();
            } catch (e) {
                /* ignore */
            }
        });
    }
    if (typeof EditorManager !== 'undefined') {
        if (typeof EditorManager.disposeStrokeIntermediate === 'function') {
            EditorManager.disposeStrokeIntermediate();
        }
        if (typeof EditorManager.clearShapePreviewOverlay === 'function') {
            EditorManager.clearShapePreviewOverlay();
        }
        if (typeof EditorManager.cancelDeferredThumbnails === 'function') {
            EditorManager.cancelDeferredThumbnails();
        }
    }
};

function illuForEachFreeCornersBtn(fn) {
    const btn = document.getElementById('select-rect-free-corners');
    if (btn) fn(btn);
}

window.syncSelectionRectFreeCornersArmUI = function () {
    if (typeof EditorManager === 'undefined') return;
    const on = !!EditorManager.toolProps.selectionRectFreeCornersArm;
    illuForEachFreeCornersBtn((btn) => {
        btn.classList.toggle('opt-bar-btn--on', on);
        btn.classList.toggle('illu-icon-toggle--on', on);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
};

window.syncWarpQuadRectLockUI = function () {
    if (typeof EditorManager === 'undefined') return;
    const on = !!EditorManager.toolProps.warpQuadRectLock;
    const btn = document.getElementById('warp-quad-rect-lock');
    if (btn) {
        btn.classList.toggle('illu-icon-toggle--on', on);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
};

/** Met les 4 points du quad sur les coins du rectangle axis-aligné. */
window.illuSyncWarpQuadPointsFromBounds = function (sb) {
    sb = sb || window.selectionBounds;
    if (!sb || sb.w < 1 || sb.h < 1) return;
    window.selectionLassoPoints = [
        { x: sb.x, y: sb.y },
        { x: sb.x + sb.w, y: sb.y },
        { x: sb.x + sb.w, y: sb.y + sb.h },
        { x: sb.x, y: sb.y + sb.h }
    ];
    window.selectionKind = 'lasso';
    window.selectionIsWarpQuad = true;
    window.selectionPreviewAngleRad = 0;
};

/** Quad {tl,tr,br,bl} déjà axis-aligné ? */
function illuQuadObjectIsAxisRect(q, eps) {
    if (!q) return false;
    eps = eps != null ? eps : 0.5;
    const topHoriz = Math.abs(q.tl.y - q.tr.y) < eps;
    const botHoriz = Math.abs(q.bl.y - q.br.y) < eps;
    const leftVert = Math.abs(q.tl.x - q.bl.x) < eps;
    const rightVert = Math.abs(q.tr.x - q.br.x) < eps;
    return topHoriz && botHoriz && leftVert && rightVert;
}

function illuAxisRectFromQuadObject(q) {
    const xs = [q.tl.x, q.tr.x, q.br.x, q.bl.x];
    const ys = [q.tl.y, q.tr.y, q.br.y, q.bl.y];
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    return {
        tl: { x: minX, y: minY },
        tr: { x: minX + w, y: minY },
        br: { x: minX + w, y: minY + h },
        bl: { x: minX, y: minY + h },
        bounds: { x: minX, y: minY, w, h }
    };
}

function illuGetWarpDestQuadFromSelection() {
    if (window.selectionWarpQuad) {
        return window.selectionWarpQuad;
    }
    const pts = window.selectionLassoPoints;
    if (!pts || pts.length !== 4) return null;
    return {
        tl: { x: pts[0].x, y: pts[0].y },
        tr: { x: pts[1].x, y: pts[1].y },
        br: { x: pts[2].x, y: pts[2].y },
        bl: { x: pts[3].x, y: pts[3].y }
    };
}

function illuSyncWarpDeformRectFromQuad(q) {
    const r = illuAxisRectFromQuadObject(q);
    selectionWarpDeformRect = { rx: r.bounds.x, ry: r.bounds.y, rw: r.bounds.w, rh: r.bounds.h };
    selectionWarpDeformRectAtStart = {
        rx: selectionWarpDeformRect.rx,
        ry: selectionWarpDeformRect.ry,
        rw: selectionWarpDeformRect.rw,
        rh: selectionWarpDeformRect.rh
    };
    return r;
}

function illuCloneWarpQuadObject(q) {
    return {
        tl: { x: q.tl.x, y: q.tl.y },
        tr: { x: q.tr.x, y: q.tr.y },
        br: { x: q.br.x, y: q.br.y },
        bl: { x: q.bl.x, y: q.bl.y }
    };
}

/** Applique sur le calque un warp srcQuad → dstQuad axis-aligné (hors session ou après snap). */
function illuBakeWarpQuadToAxisRect(qSrc, qDst) {
    if (!qSrc || !qDst || typeof EditorManager === 'undefined') return false;
    const l = EditorManager.activeLayer;
    if (!EditorManager.isPixelMode || !l || !l.buffer || window.selectionInverted || window._illuFinishingWarp) {
        return false;
    }
    window.startSelectionPixelWarp(null, 'rot');
    if (!window.selectionPixelWarpActive || !selectionWarpBackupCanvas) return false;
    const lx = l.x;
    const ly = l.y;
    selectionWarpSrcQuad = [
        [qSrc.tl.x - lx - selectionWarpOx, qSrc.tl.y - ly - selectionWarpOy],
        [qSrc.tr.x - lx - selectionWarpOx, qSrc.tr.y - ly - selectionWarpOy],
        [qSrc.br.x - lx - selectionWarpOx, qSrc.br.y - ly - selectionWarpOy],
        [qSrc.bl.x - lx - selectionWarpOx, qSrc.bl.y - ly - selectionWarpOy]
    ];
    window.selectionWarpQuad = illuCloneWarpQuadObject(qDst);
    selectionWarpQuadAtStart = illuCloneWarpQuadObject(qDst);
    if (
        window.activeTool === 'deform' ||
        (window.activeTool === 'warp-4' &&
            typeof window.illuIsWarpQuadRectLockActive === 'function' &&
            window.illuIsWarpQuadRectLockActive())
    ) {
        illuSyncWarpDeformRectFromQuad(window.selectionWarpQuad);
    }
    if (typeof window.finishSelectionPixelWarp === 'function') {
        window.finishSelectionPixelWarp();
    }
    return true;
}

function illuCanBakeWarpQuadToLayer() {
    return !!(
        typeof EditorManager !== 'undefined' &&
        EditorManager.isPixelMode &&
        EditorManager.activeLayer &&
        EditorManager.activeLayer.buffer &&
        window.selectionBounds &&
        !window.selectionInverted
    );
}

/**
 * Quad de destination de la déformation → rectangle : met à jour les pixels déformés
 * (selectionWarpQuad), pas seulement le contour de sélection.
 */
window.illuApplyWarpDestQuadRectangular = function () {
    const qIn = illuGetWarpDestQuadFromSelection();
    if (!qIn) return false;
    const r = illuAxisRectFromQuadObject(qIn);
    const qDst = {
        tl: { x: r.tl.x, y: r.tl.y },
        tr: { x: r.tr.x, y: r.tr.y },
        br: { x: r.br.x, y: r.br.y },
        bl: { x: r.bl.x, y: r.bl.y }
    };
    const needsPixelBake = !illuQuadObjectIsAxisRect(qIn) && illuCanBakeWarpQuadToLayer();

    if (needsPixelBake) {
        if (window.selectionPixelWarpActive) {
            const l = EditorManager.activeLayer;
            const lx = l.x;
            const ly = l.y;
            selectionWarpSrcQuad = [
                [qIn.tl.x - lx - selectionWarpOx, qIn.tl.y - ly - selectionWarpOy],
                [qIn.tr.x - lx - selectionWarpOx, qIn.tr.y - ly - selectionWarpOy],
                [qIn.br.x - lx - selectionWarpOx, qIn.br.y - ly - selectionWarpOy],
                [qIn.bl.x - lx - selectionWarpOx, qIn.bl.y - ly - selectionWarpOy]
            ];
            window.selectionWarpQuad = illuCloneWarpQuadObject(qDst);
            illuSyncWarpDeformRectFromQuad(window.selectionWarpQuad);
            if (typeof window.finishSelectionPixelWarp === 'function') {
                window.finishSelectionPixelWarp();
            }
            return true;
        }
        if (illuBakeWarpQuadToAxisRect(qIn, qDst)) return true;
    }

    window.selectionWarpQuad = illuCloneWarpQuadObject(qDst);
    window.selectionBounds = { ...r.bounds };
    window.illuSyncWarpQuadPointsFromBounds(r.bounds);
    selectionWarpQuadAtStart = illuCloneWarpQuadObject(qDst);
    if (window.selectionPixelWarpActive) {
        illuSyncWarpDeformRectFromQuad(window.selectionWarpQuad);
        if (typeof window.illuScheduleSelectionWarpPreview === 'function') {
            window.illuScheduleSelectionWarpPreview({ preview: true, immediate: true });
        } else if (typeof window.runSelectionWarpPreview === 'function') {
            window.runSelectionWarpPreview({ preview: true, immediate: true });
        }
    }
    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
    if (
        !window.selectionPixelWarpActive &&
        typeof EditorManager !== 'undefined' &&
        typeof EditorManager.render === 'function'
    ) {
        EditorManager.render();
    }
    return true;
};

/** @deprecated alias — aligne la déformation pixel, pas seulement la sélection. */
window.illuSnapSelectionQuadToNearestRect = function () {
    return window.illuApplyWarpDestQuadRectangular();
};

/** Rectangle axis-aligné pour le quad de déformation (aperçu warp) ou la sélection. */
window.illuSelectionWarpDestIsAxisRect = function () {
    if (window.selectionPixelWarpActive && window.selectionWarpQuad) {
        return illuQuadObjectIsAxisRect(window.selectionWarpQuad);
    }
    return window.illuSelectionQuadIsAxisRect();
};

window.illuIsWarpQuadRectLockActive = function () {
    return !!(typeof EditorManager !== 'undefined' && EditorManager.toolProps && EditorManager.toolProps.warpQuadRectLock);
};

window.disarmSelectionRectFreeCornersArm = function () {
    if (typeof EditorManager === 'undefined') return;
    if (!EditorManager.toolProps.selectionRectFreeCornersArm) return;
    EditorManager.toolProps.selectionRectFreeCornersArm = false;
    window.syncSelectionRectFreeCornersArmUI();
};

/** Active un outil via son bouton palette (#tool-*). */
window.illuActivateToolById = function (btnId) {
    const btn = document.getElementById(btnId);
    if (btn && !btn.disabled) btn.click();
};

/** Quad 4 points (sélection ou déformation). */
window.illuSelectionHasFreeWarpQuad = function () {
    return !!(
        window.selectionIsWarpQuad &&
        window.selectionKind === 'lasso' &&
        window.selectionLassoPoints &&
        window.selectionLassoPoints.length === 4 &&
        !window.selectionInverted
    );
};

/** True si les 4 points de sélection forment déjà un rectangle axis-aligné. */
window.illuSelectionQuadIsAxisRect = function () {
    const pts = window.selectionLassoPoints;
    if (!pts || pts.length !== 4) return false;
    return illuQuadObjectIsAxisRect({
        tl: pts[0],
        tr: pts[1],
        br: pts[2],
        bl: pts[3]
    });
};

/** Sélection rect. en mode 4 coins libres (sans déformation pixel). */
window.illuSelectionIsSelectFreeQuad = function () {
    return !!(
        window.activeTool === 'select' &&
        window.selectionIsWarpQuad &&
        window.selectionKind === 'lasso' &&
        window.selectionLassoPoints &&
        window.selectionLassoPoints.length === 4 &&
        !window.selectionInverted &&
        window.selectionBounds &&
        window.selectionBounds.w > 2 &&
        window.selectionBounds.h > 2
    );
};

/** Passer de la sélection 4 coins à l’outil déformation warp-4. */
window.illuSwitchSelectFreeQuadToWarp4 = function () {
    if (!window.illuSelectionIsSelectFreeQuad()) return;
    if (typeof EditorManager === 'undefined') return;
    EditorManager.toolProps.selectionRectFreeCornersArm = false;
    if (typeof window.syncSelectionRectFreeCornersArmUI === 'function') {
        window.syncSelectionRectFreeCornersArmUI();
    }
    window.illuActivateToolById('tool-warp-4');
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
    EditorManager.render();
};

/** Outils sélection : quad libre sans déformation ; déformation → warp-4. */
window.illuFreeCornersFromDeformTool = function () {
    const t = window.activeTool;
    return t === 'deform' || t === 'warp-4';
};

/** Bouton « 4 coins » : cadre quadrilatère (outil Sélection) ; déformation pixels → warp-4 via opt-select-quad-to-warp. */
window.illuHandleSelectRectFreeCornersClick = function () {
    if (typeof EditorManager === 'undefined') return;
    const sb = window.selectionBounds;
    const hasQuad =
        typeof window.illuSelectionHasFreeWarpQuad === 'function' &&
        window.illuSelectionHasFreeWarpQuad();
    const canQuad =
        EditorManager.isPixelMode &&
        sb &&
        !window.selectionInverted &&
        sb.w > 2 &&
        sb.h > 2;

    if (canQuad) {
        if (window.selectionKind === 'rect' || !hasQuad) {
            window.illuSyncWarpQuadPointsFromBounds(sb);
        }
        EditorManager.toolProps.selectionRectFreeCornersArm = false;
    } else {
        EditorManager.toolProps.selectionRectFreeCornersArm = true;
    }
    if (typeof window.syncSelectionRectFreeCornersArmUI === 'function') {
        window.syncSelectionRectFreeCornersArmUI();
    }
    window.illuActivateToolById('tool-select');
    if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual({ forceFull: true });
    if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
    EditorManager.render();
};

window.illuWireSelectRectFreeCornersButtons = function () {
    const handler = (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        window.illuHandleSelectRectFreeCornersClick();
    };
    const btn = document.getElementById('select-rect-free-corners');
    if (!btn || btn.dataset.illuFreeCornersWired === '1') return;
    btn.dataset.illuFreeCornersWired = '1';
    btn.addEventListener('click', handler);
};

window.illuWireWarpBarButtons = function () {
    const snapBtn = document.getElementById('warp-quad-snap-rect-btn');
    if (snapBtn && snapBtn.dataset.illuWired !== '1') {
        snapBtn.dataset.illuWired = '1';
        snapBtn.addEventListener('click', () => {
            if (typeof window.illuApplyWarpDestQuadRectangular === 'function') {
                window.illuApplyWarpDestQuadRectangular();
            }
            if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        });
    }
    const lockBtn = document.getElementById('warp-quad-rect-lock');
    if (lockBtn && lockBtn.dataset.illuWired !== '1') {
        lockBtn.dataset.illuWired = '1';
        lockBtn.addEventListener('click', () => {
            if (typeof EditorManager === 'undefined') return;
            const turningOn = !EditorManager.toolProps.warpQuadRectLock;
            EditorManager.toolProps.warpQuadRectLock = turningOn;
            if (turningOn && typeof window.illuApplyWarpDestQuadRectangular === 'function') {
                window.illuApplyWarpDestQuadRectangular();
            }
            if (typeof window.syncWarpQuadRectLockUI === 'function') window.syncWarpQuadRectLockUI();
            if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        });
    }
    const toWarpBtn = document.getElementById('opt-select-quad-to-warp-btn');
    if (toWarpBtn && toWarpBtn.dataset.illuWired !== '1') {
        toWarpBtn.dataset.illuWired = '1';
        toWarpBtn.addEventListener('click', () => {
            if (typeof window.illuSwitchSelectFreeQuadToWarp4 === 'function') {
                window.illuSwitchSelectFreeQuadToWarp4();
            }
        });
    }
};

/** Conservé pour compat. : ne fait plus qu’aligner le bouton sur l’état armé. */
window.applySelectionRectFreeCornersPreference = function () {
    if (typeof window.syncSelectionRectFreeCornersArmUI === 'function') window.syncSelectionRectFreeCornersArmUI();
};

window.startSelectionPixelWarp = function (e, handleId) {
    const l = EditorManager.activeLayer;
    const sb = window.selectionBounds;
    if (!l || !l.buffer || !sb) return;
    selectionWarpImportStagingMode = !!(l.importPlacementPending && l.importStagingBuffer);
    const warpOrigin = illuWarpPixelOrigin(l);
    const buf = warpOrigin.buffer;
    if (!buf) return;
    const qStart = (window.selectionIsWarpQuad && window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length === 4)
        ? { tl: window.selectionLassoPoints[0], tr: window.selectionLassoPoints[1], br: window.selectionLassoPoints[2], bl: window.selectionLassoPoints[3] }
        : { tl: { x: sb.x, y: sb.y }, tr: { x: sb.x + sb.w, y: sb.y }, br: { x: sb.x + sb.w, y: sb.y + sb.h }, bl: { x: sb.x, y: sb.y + sb.h } };
    illuCloseWarpWorkerSession();
    selectionWarpDeformMoveOffset = null;
    illuRemoveWarpPreviewOverlay();
    const lx = warpOrigin.x;
    const ly = warpOrigin.y;
    selectionWarpDragLayerSnapshot = selectionWarpImportStagingMode
        ? {
            importStaging: true,
            buffer: cloneCanvasForWarp(buf),
            x: lx,
            y: ly
        }
        : {
            buffer: cloneCanvasForWarp(l.buffer),
            x: l.x,
            y: l.y
        };
    illuSelectionInteractionOwner = 'warp';
    selectionWarpHandlePointerDown = true;
    selectionWarpFullLayerCanvas = cloneCanvasForWarp(buf);
    selectionWarpBackupCanvas = document.createElement('canvas');
    const pts =
        window.selectionIsWarpQuad &&
            window.selectionKind === 'lasso' &&
            window.selectionLassoPoints &&
            window.selectionLassoPoints.length === 4
            ? window.selectionLassoPoints
            : null;
    let minX;
    let minY;
    let maxX;
    let maxY;
    if (pts) {
        minX = Math.min(pts[0].x, pts[1].x, pts[2].x, pts[3].x);
        minY = Math.min(pts[0].y, pts[1].y, pts[2].y, pts[3].y);
        maxX = Math.max(pts[0].x, pts[1].x, pts[2].x, pts[3].x);
        maxY = Math.max(pts[0].y, pts[1].y, pts[2].y, pts[3].y);
    }
    let x0;
    let y0;
    let x1;
    let y1;
    if (pts) {
        const minXL = minX - lx;
        const minYL = minY - ly;
        const maxXL = maxX - lx;
        const maxYL = maxY - ly;
        x0 = Math.max(0, Math.floor(minXL));
        y0 = Math.max(0, Math.floor(minYL));
        x1 = Math.min(buf.width, Math.ceil(maxXL));
        y1 = Math.min(buf.height, Math.ceil(maxYL));
    } else {
        const x0f = sb.x - lx;
        const y0f = sb.y - ly;
        const x1f = sb.x + sb.w - lx;
        const y1f = sb.y + sb.h - ly;
        x0 = Math.max(0, Math.floor(x0f));
        y0 = Math.max(0, Math.floor(y0f));
        x1 = Math.min(buf.width, Math.ceil(x1f));
        y1 = Math.min(buf.height, Math.ceil(y1f));
    }
    if (x1 <= x0 || y1 <= y0) {
        selectionWarpFullLayerCanvas = null;
        selectionWarpBackupCanvas = null;
        return;
    }
    selectionWarpOx = x0;
    selectionWarpOy = y0;
    selectionWarpSw = Math.max(1, x1 - x0);
    selectionWarpSh = Math.max(1, y1 - y0);
    selectionWarpSourceClearBounds = {
        x: selectionWarpOx,
        y: selectionWarpOy,
        w: selectionWarpSw,
        h: selectionWarpSh
    };
selectionWarpSourceClearLocalPoints =
        window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3
            ? window.selectionLassoPoints.map((p) => ({ x: p.x - lx, y: p.y - ly }))
            : null;
            
    selectionWarpBackupCanvas.width = selectionWarpSw;
    selectionWarpBackupCanvas.height = selectionWarpSh;
    const bctx = selectionWarpBackupCanvas.getContext('2d', { willReadFrequently: true });
    bctx.drawImage(buf, selectionWarpOx, selectionWarpOy, selectionWarpSw, selectionWarpSh, 0, 0, selectionWarpSw, selectionWarpSh);

    // --- CORRECTIF DÉFORMATION : Appliquer le masque de la baguette sur le tampon ---
    if (window.selectionKind === 'color' && window.selectionColorMask) {
        const imgData = bctx.getImageData(0, 0, selectionWarpSw, selectionWarpSh);
        const d = imgData.data;
        const m = window.selectionColorMask;
        for (let yy = 0; yy < selectionWarpSh; yy++) {
            for (let xx = 0; xx < selectionWarpSw; xx++) {
                const lpx = selectionWarpOx + xx;
                const lpy = selectionWarpOy + yy;
                // Si on est hors du masque, on rend le pixel transparent
                if (lpx < 0 || lpx >= m.w || lpy < 0 || lpy >= m.h || m.data[lpy * m.w + lpx] === 0) {
                    d[(yy * selectionWarpSw + xx) * 4 + 3] = 0; 
                }
            }
        }
        bctx.putImageData(imgData, 0, 0);
        window._warpSourceClearColorMask = m; // On sauvegarde le masque pour le trou
    } else {
        window._warpSourceClearColorMask = null;
    }

    /* Performance: On cache les données de pixel initiales pour éviter getImageData à chaque mousemove. */
    window.selectionWarpBackupImageData = bctx.getImageData(0, 0, selectionWarpSw, selectionWarpSh);
    
    illuInitWarpWorkerSession();
    selectionWarpDeformRect = null;
    selectionWarpDeformRectAtStart = null;
    if (window.activeTool === 'deform') {
        let rx;
        let ry;
        let rw;
        let rh;
        if (pts) {
            rx = minX;
            ry = minY;
            rw = maxX - minX;
            rh = maxY - minY;
        } else {
            rx = sb.x;
            ry = sb.y;
            rw = sb.w;
            rh = sb.h;
        }
        if (pts && handleId === 'rot') {
            window.selectionWarpQuad = {
                tl: { x: pts[0].x, y: pts[0].y },
                tr: { x: pts[1].x, y: pts[1].y },
                br: { x: pts[2].x, y: pts[2].y },
                bl: { x: pts[3].x, y: pts[3].y }
            };
            illuSyncWarpDeformRectFromQuad(window.selectionWarpQuad);
        } else {
            selectionWarpDeformRect = { rx, ry, rw, rh };
            selectionWarpDeformRectAtStart = { rx, ry, rw, rh };
            window.selectionWarpQuad = {
                tl: { x: rx, y: ry },
                tr: { x: rx + rw, y: ry },
                br: { x: rx + rw, y: ry + rh },
                bl: { x: rx, y: ry + rh }
            };
            if (pts) {
                window.selectionLassoPoints = [
                    { x: rx, y: ry },
                    { x: rx + rw, y: ry },
                    { x: rx + rw, y: ry + rh },
                    { x: rx, y: ry + rh }
                ];
                window.selectionIsWarpQuad = true;
                window.selectionBounds = { x: rx, y: ry, w: rw, h: rh };
            }
        }
    } else if (pts) {
        window.selectionWarpQuad = {
            tl: { x: pts[0].x, y: pts[0].y },
            tr: { x: pts[1].x, y: pts[1].y },
            br: { x: pts[2].x, y: pts[2].y },
            bl: { x: pts[3].x, y: pts[3].y }
        };
    } else {
        window.selectionWarpQuad = {
            tl: { x: sb.x, y: sb.y },
            tr: { x: sb.x + sb.w, y: sb.y },
            br: { x: sb.x + sb.w, y: sb.y + sb.h },
            bl: { x: sb.x, y: sb.y + sb.h }
        };
    }
    selectionWarpQuadAtStart = {
        tl: { x: window.selectionWarpQuad.tl.x, y: window.selectionWarpQuad.tl.y },
        tr: { x: window.selectionWarpQuad.tr.x, y: window.selectionWarpQuad.tr.y },
        br: { x: window.selectionWarpQuad.br.x, y: window.selectionWarpQuad.br.y },
        bl: { x: window.selectionWarpQuad.bl.x, y: window.selectionWarpQuad.bl.y }
    };
    if (
        window.activeTool === 'warp-4' &&
        typeof window.illuIsWarpQuadRectLockActive === 'function' &&
        window.illuIsWarpQuadRectLockActive()
    ) {
        illuSyncWarpDeformRectFromQuad(window.selectionWarpQuad);
    }
    const q0 = window.selectionWarpQuad;
    selectionWarpSrcQuad = [
        [q0.tl.x - lx - selectionWarpOx, q0.tl.y - ly - selectionWarpOy],
        [q0.tr.x - lx - selectionWarpOx, q0.tr.y - ly - selectionWarpOy],
        [q0.br.x - lx - selectionWarpOx, q0.br.y - ly - selectionWarpOy],
        [q0.bl.x - lx - selectionWarpOx, q0.bl.y - ly - selectionWarpOy]
    ];
    window.selectionPixelWarpActive = true;
    selectionWarpHandleId = handleId;
    if (window.activeTool === 'deform' && handleId === 'c' && selectionWarpDeformRect && e) {
        const R = selectionWarpDeformRect;
        const p = getPos(e);
        selectionWarpDeformMoveOffset = { x: p.x - R.rx, y: p.y - R.ry };
    }
    window._selectionWarpInitialPolyLocal = selectionLassoLocalFromDoc();

    if (l) l._ghostDragHide = true;
    illuHideActiveLayerForWarpPreview();
    illuEnsureWarpBasePreviewOverlay(lx, ly);
    if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(false);

    window.runSelectionWarpPreview({ preview: true, immediate: true });
    if (typeof window.illuSelectionLoupeTryShow === 'function') {
        window.illuSelectionLoupeTryShow(e, handleId);
    }
};

window.updateSelectionWarpFromPointer = function (worldX, worldY) {
    if (!window.selectionWarpQuad) return;
    const h = selectionWarpHandleId;
    const q = window.selectionWarpQuad;

    if (
        selectionWarpDeformRect &&
        selectionWarpDeformRectAtStart &&
        (window.activeTool === 'deform' ||
            (window.activeTool === 'warp-4' && typeof window.illuIsWarpQuadRectLockActive === 'function' && window.illuIsWarpQuadRectLockActive()))
    ) {
        const R = selectionWarpDeformRect;
        const r0 = selectionWarpDeformRectAtStart;
        const syncRectToQuad = () => {
            q.tl.x = R.rx;
            q.tl.y = R.ry;
            q.tr.x = R.rx + R.rw;
            q.tr.y = R.ry;
            q.br.x = R.rx + R.rw;
            q.br.y = R.ry + R.rh;
            q.bl.x = R.rx;
            q.bl.y = R.ry + R.rh;
            window.selectionBounds = { x: R.rx, y: R.ry, w: R.rw, h: R.rh };
            if (window.selectionLassoPoints && window.selectionLassoPoints.length === 4) {
                window.selectionLassoPoints = [
                    { x: R.rx, y: R.ry },
                    { x: R.rx + R.rw, y: R.ry },
                    { x: R.rx + R.rw, y: R.ry + R.rh },
                    { x: R.rx, y: R.ry + R.rh }
                ];
            }
        };
        if (h === 'c') {
            /* Même logique que l’outil Déplacer : position absolue (pointeur − offset), pas delta frame-à-frame. */
            const off = selectionWarpDeformMoveOffset;
            if (off) {
                const nx = Math.round(worldX - off.x);
                const ny = Math.round(worldY - off.y);
                if (illuIsFloatingImportPending()) {
                    R.rx = nx;
                    R.ry = ny;
                    syncRectToQuad();
                    illuSyncFloatingImportStagingFromDeformRect();
                } else {
                    const Wd = EditorManager.width;
                    const Hd = EditorManager.height;
                    const maxX = Math.max(0, Wd - R.rw);
                    const maxY = Math.max(0, Hd - R.rh);
                    R.rx = Math.max(0, Math.min(nx, maxX));
                    R.ry = Math.max(0, Math.min(ny, maxY));
                    syncRectToQuad();
                }
            }
            return;
        }
        const minW = 4;
        const minH = 4;
        const right0 = r0.rx + r0.rw;
        const bottom0 = r0.ry + r0.rh;
        const ar0 = r0.rw / Math.max(1e-6, r0.rh);
        const sh = !!window._shiftConstraintProportions;

        /* Shift : homothétie depuis le coin opposé (rapport largeur/hauteur du cadre initial). */
        if (sh && (h === 'nw' || h === 'ne' || h === 'se' || h === 'sw')) {
            if (h === 'se') {
                const s = Math.min((worldX - r0.rx) / r0.rw, (worldY - r0.ry) / r0.rh);
                const sc = Math.max(minW / r0.rw, minH / r0.rh, s);
                R.rx = r0.rx;
                R.ry = r0.ry;
                R.rw = Math.max(minW, sc * r0.rw);
                R.rh = Math.max(minH, sc * r0.rh);
            } else if (h === 'nw') {
                const s = Math.min((right0 - worldX) / r0.rw, (bottom0 - worldY) / r0.rh);
                const sc = Math.max(minW / r0.rw, minH / r0.rh, s);
                R.rw = Math.max(minW, sc * r0.rw);
                R.rh = Math.max(minH, sc * r0.rh);
                R.rx = right0 - R.rw;
                R.ry = bottom0 - R.rh;
            } else if (h === 'ne') {
                const s = Math.min((worldX - r0.rx) / r0.rw, (bottom0 - worldY) / r0.rh);
                const sc = Math.max(minW / r0.rw, minH / r0.rh, s);
                R.rx = r0.rx;
                R.rw = Math.max(minW, sc * r0.rw);
                R.rh = Math.max(minH, sc * r0.rh);
                R.ry = bottom0 - R.rh;
            } else if (h === 'sw') {
                const s = Math.min((right0 - worldX) / r0.rw, (worldY - r0.ry) / r0.rh);
                const sc = Math.max(minW / r0.rw, minH / r0.rh, s);
                R.ry = r0.ry;
                R.rw = Math.max(minW, sc * r0.rw);
                R.rh = Math.max(minH, sc * r0.rh);
                R.rx = right0 - R.rw;
            }
            syncRectToQuad();
            return;
        }
        if (sh && (h === 'e' || h === 'w' || h === 'n' || h === 's')) {
            if (h === 'e') {
                R.rx = r0.rx;
                R.ry = r0.ry;
                R.rw = Math.max(minW, worldX - r0.rx);
                R.rh = Math.max(minH, R.rw / ar0);
            } else if (h === 'w') {
                R.rw = Math.max(minW, right0 - worldX);
                R.rh = Math.max(minH, R.rw / ar0);
                R.rx = right0 - R.rw;
                R.ry = r0.ry;
            } else if (h === 's') {
                R.rx = r0.rx;
                R.ry = r0.ry;
                R.rh = Math.max(minH, worldY - r0.ry);
                R.rw = Math.max(minW, R.rh * ar0);
            } else if (h === 'n') {
                R.rh = Math.max(minH, bottom0 - worldY);
                R.rw = Math.max(minW, R.rh * ar0);
                R.rx = r0.rx;
                R.ry = bottom0 - R.rh;
            }
            syncRectToQuad();
            return;
        }

        /* Sans Shift : coin opposé fixe (rétrécissement correct). */
        if (h === 'se') {
            R.rx = r0.rx;
            R.ry = r0.ry;
            R.rw = Math.max(minW, worldX - r0.rx);
            R.rh = Math.max(minH, worldY - r0.ry);
        } else if (h === 'nw') {
            R.rw = Math.max(minW, right0 - worldX);
            R.rh = Math.max(minH, bottom0 - worldY);
            R.rx = right0 - R.rw;
            R.ry = bottom0 - R.rh;
        } else if (h === 'ne') {
            /* Coin NE : bord gauche et bas fixes (SW opposé). */
            R.rx = r0.rx;
            R.ry = Math.min(worldY, bottom0 - minH);
            R.rw = Math.max(minW, worldX - r0.rx);
            R.rh = bottom0 - R.ry;
        } else if (h === 'sw') {
            /* Coin SW : bord droit et haut fixes (NE opposé). */
            R.rx = Math.min(worldX, right0 - minW);
            R.ry = r0.ry;
            R.rw = right0 - R.rx;
            R.rh = Math.max(minH, worldY - r0.ry);
        } else if (h === 'e') {
            R.rx = r0.rx;
            R.ry = r0.ry;
            R.rw = Math.max(minW, worldX - r0.rx);
            R.rh = r0.rh;
        } else if (h === 'w') {
            R.rw = Math.max(minW, right0 - worldX);
            R.rx = right0 - R.rw;
            R.ry = r0.ry;
            R.rh = r0.rh;
        } else if (h === 's') {
            R.rx = r0.rx;
            R.ry = r0.ry;
            R.rw = r0.rw;
            R.rh = Math.max(minH, worldY - r0.ry);
        } else if (h === 'n') {
            R.rh = Math.max(minH, bottom0 - worldY);
            R.ry = bottom0 - R.rh;
            R.rx = r0.rx;
            R.rw = r0.rw;
        }
        syncRectToQuad();
        if (illuIsFloatingImportPending()) {
            illuSyncFloatingImportStagingFromDeformRect();
        }
        return;
    }

    if (
        window._shiftConstraintProportions &&
        window.activeTool === 'warp-4' &&
        selectionWarpQuadAtStart &&
        (h === 'nw' || h === 'ne' || h === 'se' || h === 'sw')
    ) {
        const q0 = selectionWarpQuadAtStart;
        const cx = (q0.tl.x + q0.tr.x + q0.br.x + q0.bl.x) / 4;
        const cy = (q0.tl.y + q0.tr.y + q0.br.y + q0.bl.y) / 4;
        const cornerKey = h === 'nw' ? 'tl' : h === 'ne' ? 'tr' : h === 'se' ? 'br' : 'bl';
        const p0 = q0[cornerKey];
        const d0 = Math.hypot(p0.x - cx, p0.y - cy);
        const d1 = Math.hypot(worldX - cx, worldY - cy);
        const scale = d1 / Math.max(1e-6, d0);
        (['tl', 'tr', 'br', 'bl']).forEach((key) => {
            const o = q0[key];
            q[key].x = cx + (o.x - cx) * scale;
            q[key].y = cy + (o.y - cy) * scale;
        });
        return;
    }
    if (h === 'nw') {
        q.tl.x = worldX;
        q.tl.y = worldY;
    } else if (h === 'ne') {
        q.tr.x = worldX;
        q.tr.y = worldY;
    } else if (h === 'se') {
        q.br.x = worldX;
        q.br.y = worldY;
    } else if (h === 'sw') {
        q.bl.x = worldX;
        q.bl.y = worldY;
    } else if (h === 'n') {
        q.tl.y = worldY;
        q.tr.y = worldY;
    } else if (h === 's') {
        q.bl.y = worldY;
        q.br.y = worldY;
    } else if (h === 'w') {
        q.tl.x = worldX;
        q.bl.x = worldX;
    } else if (h === 'e') {
        q.tr.x = worldX;
        q.br.x = worldX;
    }
    if (illuIsFloatingImportPending() && selectionWarpDeformRect) {
        illuSyncFloatingImportStagingFromDeformRect();
    }
};

/**
 * Si le quad de destination dépasse le tampon du calque, agrandit le canvas (padding) et recale lx/ly, ox/oy, clone plein cadre et srcQuad.
 */
function illuExpandActiveLayerBufferForWarpDestQuad(l, q, opts) {
    opts = opts || {};
    if (!l || !l.buffer || !q) return;
    /* Aperçu / interaction : tampon calque fixe (Paint.NET). Expansion uniquement au commit final explicite. */
    if (!opts.allowExpand) return;
    /* Poignée centre (déform) : déplacement borné au tampon — ne pas étendre le buffer. */
    if (window.activeTool === 'deform' && selectionWarpHandleId === 'c') {
        return;
    }
    const lx0 = l.x;
    const ly0 = l.y;
    const dstQuad = [
        [q.tl.x - lx0, q.tl.y - ly0],
        [q.tr.x - lx0, q.tr.y - ly0],
        [q.br.x - lx0, q.br.y - ly0],
        [q.bl.x - lx0, q.bl.y - ly0]
    ];
    const xs = dstQuad.map((p) => p[0]);
    const ys = dstQuad.map((p) => p[1]);
    const bw = l.buffer.width;
    const bh = l.buffer.height;
    const minXQ = Math.min(...xs);
    const maxXQ = Math.max(...xs);
    const minYQ = Math.min(...ys);
    const maxYQ = Math.max(...ys);
    const margin = 10;
    const needLeft = Math.max(0, Math.ceil(-minXQ) + margin);
    const needRight = Math.max(0, Math.ceil(maxXQ - (bw - 1)) + margin);
    const needTop = Math.max(0, Math.ceil(-minYQ) + margin);
    const needBottom = Math.max(0, Math.ceil(maxYQ - (bh - 1)) + margin);
    if (needLeft === 0 && needRight === 0 && needTop === 0 && needBottom === 0) return;

    const newW = bw + needLeft + needRight;
    const newH = bh + needTop + needBottom;
    const nc = document.createElement('canvas');
    nc.width = newW;
    nc.height = newH;
    const nctx = nc.getContext('2d', { willReadFrequently: true });
    if (nctx) {
        nctx.imageSmoothingEnabled = false;
        /* Use selectionWarpFullLayerCanvas (has all original pixels) as source
           instead of l.buffer which may have a punched hole from drag preview. */
        const expandSrc = selectionWarpFullLayerCanvas || l.buffer;
        nctx.drawImage(expandSrc, 0, 0, bw, bh, needLeft, needTop, bw, bh);
    }
    l.buffer = nc;
    l.x = lx0 - needLeft;
    l.y = ly0 - needTop;
    selectionWarpOx += needLeft;
    selectionWarpOy += needTop;

    if (selectionWarpSourceClearBounds) {
        selectionWarpSourceClearBounds.x += needLeft;
        selectionWarpSourceClearBounds.y += needTop;
    }
    if (selectionWarpSourceClearLocalPoints) {
        selectionWarpSourceClearLocalPoints.forEach((p) => {
            p.x += needLeft;
            p.y += needTop;
        });
    }

    selectionWarpFullLayerCanvas = cloneCanvasForWarp(nc);

    // Si on a déplacé l'origine du calque, on doit en informer l'UI si nécessaire
    // ou s'assurer que les futurs calculs sont cohérents.
}

function illuPrepareSelectionWarpPreviewState(opts) {
    opts = opts || {};
    if (
        !window.selectionPixelWarpActive ||
        !window.selectionWarpQuad ||
        !selectionWarpBackupCanvas ||
        !selectionWarpFullLayerCanvas ||
        !EditorManager.activeLayer
    ) {
        return null;
    }
    // Explicitly check for preview vs final. Relying on window.selectionWarpHandlePointerDown 
    // can cause race conditions during throttled frames if mouse was released.
    const isFinal = !!(opts.isFinal || opts.forceCommit);
    const defer = !isFinal;
    const l = EditorManager.activeLayer;
    const warpOrigin = illuWarpPixelOrigin(l);
    const warpBuf = warpOrigin.buffer;
    if (!warpBuf) return null;
    if (isFinal && !selectionWarpImportStagingMode) {
        illuExpandActiveLayerBufferForWarpDestQuad(l, window.selectionWarpQuad, { allowExpand: true });
    }
    const ctx = isFinal ? warpBuf.getContext('2d', { willReadFrequently: true }) : null;
    if (isFinal && !ctx) return null;

    const sw = selectionWarpSw;
    const sh = selectionWarpSh;
    const ox = selectionWarpOx;
    const oy = selectionWarpOy;
    const q = window.selectionWarpQuad;

    const lx = warpOrigin.x;
    const ly = warpOrigin.y;
    const dstQuad = [
        [q.tl.x - lx, q.tl.y - ly],
        [q.tr.x - lx, q.tr.y - ly],
        [q.br.x - lx, q.br.y - ly],
        [q.bl.x - lx, q.bl.y - ly]
    ];
    const srcQuad =
        selectionWarpSrcQuad && selectionWarpSrcQuad.length === 4
            ? selectionWarpSrcQuad
            : [
                [0, 0],
                [sw, 0],
                [sw, sh],
                [0, sh]
            ];
    const backupData = window.selectionWarpBackupImageData;
    if (!backupData) {
        const bctx = selectionWarpBackupCanvas.getContext('2d', { willReadFrequently: true });
        window.selectionWarpBackupImageData = bctx.getImageData(0, 0, sw, sh);
    }
    const sourceData = (window.selectionWarpBackupImageData || backupData).data;
    const polyLocal = window._selectionWarpInitialPolyLocal || selectionLassoLocalFromDoc(); const xs = dstQuad.map((p) => p[0]);
    const ys = dstQuad.map((p) => p[1]);
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(warpBuf.width - 1, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(warpBuf.height - 1, Math.ceil(Math.max(...ys)));
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (!sourceData || bw < 1 || bh < 1) {
        return {
            defer: defer,
            invalid: true,
            ctx: ctx,
            l: l,
            snap: selectionWarpDragLayerSnapshot
        };
    }

    // We stop passing background data to the worker. This ensures:
    // 1. Inward deformations (contraction) correctly leave a hole (transparency).
    // 2. We avoid "black border" artifacts caused by sampling from a dirty background.
    // The worker renders a transparent patch that we composite over the punched hole.
    const layerData = null;

    return {
        defer: defer,
        invalid: false,
        ctx: ctx,
        l: l,
        previewLayerX: lx,
        previewLayerY: ly,
        srcQuad: srcQuad,
        dstQuad: dstQuad,
        polyLocal: polyLocal,
        sourceData: sourceData,
        sourceWidth: sw,
        sourceHeight: sh,
        patchX: minX,
        patchY: minY,
        patchWidth: bw,
        patchHeight: bh,
        baseData: layerData ? layerData.data : null,
        smooth: typeof window.illuWarpUseSmoothResample === 'function' ? window.illuWarpUseSmoothResample() : window.illuInterpolationMode !== 'nearest'
    };
}
function illuPaintWarpResultToContext(ctx, result, patchX, patchY, patchWidth, patchHeight) {
    if (!result || !result.data) return;
    const stride = result.stride || 1;
    const sw = result.width;
    const sh = result.height;
    // Always use a temp canvas + drawImage (source-over) so that transparent
    // pixels in the warp output do NOT destroy existing layer content.
    const tmp = document.createElement('canvas');
    tmp.width = sw;
    tmp.height = sh;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.putImageData(new ImageData(new Uint8ClampedArray(result.data), sw, sh), 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (stride <= 1) {
        ctx.drawImage(tmp, result.x, result.y);
    } else {
        ctx.drawImage(tmp, 0, 0, sw, sh, result.x, result.y, patchWidth, patchHeight);
    }
    ctx.restore();
}

function illuRunSelectionWarpPreviewSync(state) {
    const core = illuGetWarpCore();
    if (!state || !core) return;

    if (state.defer) {
        if (state.invalid) {
            illuScheduleWarpChromeRefresh();
            return;
        }
        const result = core.renderWarpPatch({
            sourceData: state.sourceData,
            sourceWidth: state.sourceWidth,
            sourceHeight: state.sourceHeight,
            srcQuad: state.srcQuad,
            dstQuad: state.dstQuad,
            patchWidth: state.patchWidth,
            patchHeight: state.patchHeight,
            patchX: state.patchX,
            patchY: state.patchY,
            polyLocal: state.polyLocal,
            smooth: state.smooth,
            stride: state.stride || 4
        });

        if (result && result.data) {
            const rw = result.width;
            const rh = result.height;
            const scratch = illuEnsureWarpPatchScratchCanvas(rw, rh);
            scratch.getContext('2d', { willReadFrequently: true }).putImageData(
                new ImageData(new Uint8ClampedArray(result.data), rw, rh),
                0,
                0
            );
            illuEnsureWarpBasePreviewOverlay(state.previewLayerX, state.previewLayerY);
            illuSetWarpPreviewOverlay(
                scratch,
                state.previewLayerX + state.patchX,
                state.previewLayerY + state.patchY,
                true,
                state.patchWidth,
                state.patchHeight
            );
        }
        illuScheduleWarpChromeRefresh();
        return;
    }

    if (selectionWarpDragLayerSnapshot) {
        illuRestoreWarpDragSnapshotLayer();
    }
    if (!state.ctx) return;

    if (!state.invalid) {
        const result = core.renderWarpPatch({
            baseData: state.baseData,
            sourceData: state.sourceData,
            sourceWidth: state.sourceWidth,
            sourceHeight: state.sourceHeight,
            srcQuad: state.srcQuad,
            dstQuad: state.dstQuad,
            patchWidth: state.patchWidth,
            patchHeight: state.patchHeight,
            patchX: state.patchX,
            patchY: state.patchY,
            polyLocal: state.polyLocal,
            smooth: state.smooth,
            stride: 1
        });
        if (result) {
            illuPaintWarpResultToContext(state.ctx, result, state.patchX, state.patchY, state.patchWidth, state.patchHeight);
        }
    }

    if (!state.defer) {
        if (selectionWarpImportStagingMode && state.l && state.l.importStagingBuffer) {
            selectionWarpFullLayerCanvas = cloneCanvasForWarp(state.l.importStagingBuffer);
        }
        EditorManager.render();
    }
    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
}

window.runSelectionWarpPreview = function (opts) {
    opts = opts || {};
    const isFinal = !!(opts.isFinal || opts.forceCommit);
    const isPreview = !!opts.preview;

    if (!isFinal && !opts.immediate) {
        if (selectionWarpThrottleTimeout) {
            clearTimeout(selectionWarpThrottleTimeout);
            selectionWarpThrottleTimeout = null;
        }
        const now = performance.now();
        const throttleMs = isPreview ? 50 : 85;
        const diff = now - selectionWarpLastThrottledTime;
        if (diff < throttleMs) {
            selectionWarpThrottleTimeout = setTimeout(() => {
                window.runSelectionWarpPreview(opts);
            }, throttleMs - diff + 5);
            return Promise.resolve();
        }
        selectionWarpLastThrottledTime = now;
    }

    const state = illuPrepareSelectionWarpPreviewState(opts || {});
    if (!state) return Promise.resolve();

    if (!isFinal) {
        const area = state.patchWidth * state.patchHeight;
        const maxDim = Math.max(state.patchWidth, state.patchHeight, state.sourceWidth, state.sourceHeight);
        let stride = 2;
        if (area > 8000000 || maxDim > 2000) stride = 8;
        else if (area > 2000000 || maxDim > 1200) stride = 6;
        else if (area > 800000 || maxDim > 800) stride = 4;
        else if (area > 200000 || maxDim > 500) stride = 3;
        state.stride = stride;
    } else {
        state.stride = 1;
    }
    const canUseWorkerPreview =
        isFinal && !state.invalid && selectionWarpWorkerSessionId && illuWarpWorkerSupported() && !!illuEnsureWarpWorker();

    if (!canUseWorkerPreview) {
        illuRunSelectionWarpPreviewSync(state);
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const job = {
            sessionId: selectionWarpWorkerSessionId,
            jobId: ++selectionWarpWorkerJobSeq,
            patchX: state.patchX,
            patchY: state.patchY,
            patchWidth: state.patchWidth,
            patchHeight: state.patchHeight,
            srcQuad: state.srcQuad,
            dstQuad: state.dstQuad,
            polyLocal: state.polyLocal,
            stride: state.stride,
            smooth: state.smooth,
            previewLayerX: state.previewLayerX,
            previewLayerY: state.previewLayerY,
            baseBuffer: state.baseData ? state.baseData.buffer : null,
            onComplete: (err, resultData) => {
                if (!state.defer) {
                    if (!err && resultData && !state.invalid) {
                        const resObj = {
                            data: resultData,
                            width: state.stride <= 1 ? state.patchWidth : Math.ceil(state.patchWidth / state.stride),
                            height: state.stride <= 1 ? state.patchHeight : Math.ceil(state.patchHeight / state.stride),
                            x: state.patchX,
                            y: state.patchY,
                            stride: state.stride
                        };
                        illuPaintWarpResultToContext(state.ctx, resObj, state.patchX, state.patchY, state.patchWidth, state.patchHeight);
                    }
                    EditorManager.render();
                    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
                }
                resolve();
            }
        };
        if (illuQueueWarpWorkerJob(job)) {
            if (state.defer) illuRestoreWarpDragSnapshotLayer();
        } else {
            illuRunSelectionWarpPreviewSync(state);
            resolve();
        }
    });
};

window.finishSelectionPixelWarp = async function () {
    if (!window.selectionPixelWarpActive || window._illuFinishingWarp) return;
    if (illuSelectionInteractionOwner === 'deformMove') return;
    window._illuFinishingWarp = true;
    isDrawing = false;
    selectionWarpDeformMoveOffset = null;

    illuRemoveWarpPreviewOverlay();
    illuRestoreWarpDragSnapshotLayer();
    selectionWarpHandlePointerDown = false;

    const l = EditorManager.activeLayer;
    const wasImportFloating = !!(l && l.importPlacementPending);
    if (l && !selectionWarpImportStagingMode && l.buffer) {
        const ctx = l.buffer.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            ctx.save();
            illuClearSelectionWarpSourceRegion(ctx);
            ctx.restore();
        }
    }


    const P = window.IlluProgress;
    const busy = P && typeof P.createDelayedInstantEffect === 'function'
        ? P.createDelayedInstantEffect('Application de la déformation', 350)
        : null;

    let warpFailed = false;
    try {
        await window.runSelectionWarpPreview({ isFinal: true });
    } catch (err) {
        warpFailed = true;
        console.error('finishSelectionPixelWarp:', err);
    } finally {
        if (busy) busy.done();
        if (P && typeof P.statusDone === 'function') {
            P.statusDone();
        }
    }

    if (!warpFailed) {
        const stillFloating = l && l.importPlacementPending;
        if (!stillFloating) {
            const hist =
                window.activeTool === 'warp-4'
                    ? 'Déformation 4 coins'
                    : window.activeTool === 'deform'
                        ? 'Déformation'
                        : 'Déformation pixels (sélection)';

            if (EditorManager.mode === 'pixel-dither' && l && l.buffer) {
                const lctx = l.buffer.getContext('2d', { willReadFrequently: true });
                const idata = lctx.getImageData(0, 0, l.buffer.width, l.buffer.height);
                const inv = EditorManager.activeProject?.ditherInvert || false;
                EditorManager._ditherImageData(idata, EditorManager.ditherEffectSize, { invert: inv });
                lctx.putImageData(idata, 0, 0);
            }

            EditorManager.saveHistory(hist, { patchActiveLayer: true });
        } else if (l && l.importStagingBuffer) {
            if (typeof window.syncSelectionToImportPlacementLayer === 'function') {
                window.syncSelectionToImportPlacementLayer();
            }
            EditorManager.render({ skipUiThumbnails: true, flushUiThumbnails: true });
        }
    }

    const finalQuad = window.selectionWarpQuad;
    if (finalQuad) {
        const pts = [
            { x: finalQuad.tl.x, y: finalQuad.tl.y },
            { x: finalQuad.tr.x, y: finalQuad.tr.y },
            { x: finalQuad.br.x, y: finalQuad.br.y },
            { x: finalQuad.bl.x, y: finalQuad.bl.y }
        ];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        pts.forEach((p) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        window.selectionBounds = {
            x: minX,
            y: minY,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY)
        };
        window.selectionKind = 'lasso';
        window.selectionLassoPoints = pts;
        window.selectionInverted = false;
        window.selectionPreviewAngleRad = 0;
        window.selectionIsWarpQuad = true;

        const l = EditorManager.activeLayer;
        if (l && l.buffer && !selectionWarpImportStagingMode) {
            if (typeof illuExpandActiveLayerBufferForWarpDestQuad === 'function') {
                illuExpandActiveLayerBufferForWarpDestQuad(l, finalQuad, { allowExpand: true });
            }
        }

        selectionWarpImportStagingMode = false;
        selectionWarpDragLayerSnapshot = null;
        illuSelectionInteractionOwner = null;

        if (typeof EditorManager.applyProjectToUI === 'function') {
            EditorManager.applyProjectToUI();
        }
    }

    // Réinitialisation complète des états internes de déformation (Purge TOTALE immédiate)
    const activeToolBtn = document.querySelector('#win-tools .tool-btn.active');
    const activeToolId = activeToolBtn ? activeToolBtn.id : null;
    const finalBounds = window.selectionBounds ? { ...window.selectionBounds } : null;
    const finalPts = window.selectionLassoPoints ? [...window.selectionLassoPoints] : null;
    const wasIsWarpQuad = window.selectionIsWarpQuad;

    const purgeState = () => {
        window.selectionPixelWarpActive = false;
        window.selectionWarpQuad = null;
        window.selectionWarpBackupImageData = null;
        selectionWarpBackupCanvas = null;
        selectionWarpFullLayerCanvas = null;
        selectionWarpHandleId = null;
        selectionWarpQuadAtStart = null;
        selectionWarpSrcQuad = null;
        selectionWarpSourceClearBounds = null;
        selectionWarpSourceClearLocalPoints = null;
        selectionWarpDeformRect = null;
        selectionWarpDeformRectAtStart = null;
        selectionWarpDeformMoveOffset = null;
        illuCloseWarpWorkerSession();
        lassoDrawingPoints = null;
        window._selectionWarpInitialPolyLocal = null;
        selectionWarpDragLayerSnapshot = null;
        illuSelectionInteractionOwner = null;
    };

    purgeState();

    // --- ÉTAPE 1 : EFFACEMENT COMPLET (Désélection pour forcer le flush du DOM) ---
    if (typeof EditorManager.deselectAll === 'function') {
        EditorManager.deselectAll(wasImportFloating ? { skipImportCommit: true } : undefined);
    }
    EditorManager.render();

    // --- ÉTAPE 2 : RECONSTRUCTION (après 150ms pour laisser le navigateur souffler) ---
    setTimeout(() => {
        if (finalBounds) {
            const rx = Math.round(finalBounds.x);
            const ry = Math.round(finalBounds.y);
            const rw = Math.round(finalBounds.w);
            const rh = Math.round(finalBounds.h);

            const l = EditorManager.activeLayer;

            // Restauration de la sélection
            if (typeof window.illuSetRectSelectionDocBounds === 'function') {
                window.illuSetRectSelectionDocBounds(rx, ry, rw, rh);
            } else {
                window.selectionBounds = { x: rx, y: ry, w: rw, h: rh };
            }
            if (finalPts) {
                window.selectionKind = 'lasso';
                window.selectionLassoPoints = finalPts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
            }
            window.selectionIsWarpQuad = wasIsWarpQuad;

            if (typeof EditorManager.applyProjectToUI === 'function') {
                EditorManager.applyProjectToUI();
            }
            if (typeof window.refreshSelectionVisual === 'function') {
                window.refreshSelectionVisual();
            }
            EditorManager.render();

            // --- ÉTAPE 3 : RELANCE DE L'OUTIL (après encore 150ms) ---
            setTimeout(() => {
                // On s'assure que rien n'est resté pollué
                purgeState();

                if (activeToolId) {
                    const btn = document.getElementById(activeToolId);
                    if (btn && typeof btn.click === 'function') {
                        btn.click();
                    }
                }
                window._illuFinishingWarp = false;
                EditorManager.render();
            }, 150);
        } else {
            window._illuFinishingWarp = false;
        }
    }, 150);

    EditorManager.render();
    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
};

/** Coins document d’un rectangle aligné après rotation autour de son centre (y vers le bas). */
function illuRotatedRectCornersDoc(sb, angleRad) {
    const cx = sb.x + sb.w / 2;
    const cy = sb.y + sb.h / 2;
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    const corners = [
        { x: sb.x, y: sb.y },
        { x: sb.x + sb.w, y: sb.y },
        { x: sb.x + sb.w, y: sb.y + sb.h },
        { x: sb.x, y: sb.y + sb.h }
    ];
    return corners.map((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
    });
}

window.bakeSelectionRotation = function (angleRad) {
    const sb = window.selectionBounds;
    const l = EditorManager.activeLayer;
    const isWarp4 = window.selectionIsWarpQuad && window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length === 4;
    if (!l || !l.buffer || !sb || sb.w < 2 || sb.h < 2 || (window.selectionKind !== 'rect' && !isWarp4)) return;

    if (Math.abs(angleRad) < 1e-8) {
        window.selectionPreviewAngleRad = 0;
        return;
    }

    if (isWarp4) {
        /* Rotation d’un quad (lasso 4 pts) : on utilise la logique du warp tool. */
        const pts = window.selectionLassoPoints;
        const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
        const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const rotatePoint = (p) => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            return {
                x: cx + dx * cos - dy * sin,
                y: cy + dx * sin + dy * cos
            };
        };
        const nq = {
            tl: rotatePoint(pts[0]),
            tr: rotatePoint(pts[1]),
            br: rotatePoint(pts[2]),
            bl: rotatePoint(pts[3])
        };
        /* Reset de l’angle preview avant de finaliser pour ne pas doubler le rendu. */
        window.selectionPreviewAngleRad = 0;
        window.startSelectionPixelWarp(null, 'c');
        window.selectionWarpQuad = nq;
        window.finishSelectionPixelWarp();
        return;
    }

    const lx = l.x;
    const ly = l.y;
    const ox = Math.floor(sb.x - lx);
    const oy = Math.floor(sb.y - ly);
    const w = Math.ceil(sb.w);
    const h = Math.ceil(sb.h);
    const buf = l.buffer;
    if (ox < 0 || oy < 0 || ox + w > buf.width || oy + h > buf.height) return;

    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const sctx = src.getContext('2d', { willReadFrequently: true });
    const smooth = EditorManager.toolProps.warpResampling === 'smooth';
    sctx.imageSmoothingEnabled = smooth;
    sctx.drawImage(buf, ox, oy, w, h, 0, 0, w, h);

    const cos = Math.abs(Math.cos(angleRad));
    const sin = Math.abs(Math.sin(angleRad));
    const nw = Math.max(1, Math.ceil(w * cos + h * sin));
    const nh = Math.max(1, Math.ceil(w * sin + h * cos));
    const out = document.createElement('canvas');
    out.width = nw;
    out.height = nh;
    const octx = out.getContext('2d', { willReadFrequently: true });
    octx.imageSmoothingEnabled = smooth;
    octx.clearRect(0, 0, nw, nh);
    octx.translate(nw / 2, nh / 2);
    octx.rotate(angleRad);
    octx.drawImage(src, -w / 2, -h / 2);

    const cx = sb.x + sb.w / 2;
    const cy = sb.y + sb.h / 2;
    const pasteX = Math.round(cx - nw / 2 - lx);
    const pasteY = Math.round(cy - nh / 2 - ly);

    const ctx = buf.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(ox, oy, w, h);
    ctx.drawImage(out, pasteX, pasteY);

    // Re-dither rotation result if in dither mode
    if (EditorManager.mode === 'pixel-dither') {
        const idata = ctx.getImageData(0, 0, buf.width, buf.height);
        const inv = EditorManager.activeProject?.ditherInvert || false;
        EditorManager._ditherImageData(idata, EditorManager.ditherEffectSize, { invert: inv });
        ctx.putImageData(idata, 0, 0);
    }

    const corners = illuRotatedRectCornersDoc(sb, angleRad);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    corners.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    window.selectionBounds = {
        x: Math.floor(minX),
        y: Math.floor(minY),
        w: Math.max(1, Math.ceil(maxX - minX)),
        h: Math.max(1, Math.ceil(maxY - minY))
    };
    window.selectionKind = 'lasso';
    window.selectionLassoPoints = [corners[0], corners[1], corners[2], corners[3]];
    window.selectionIsWarpQuad = true;
    window.selectionColorMask = null;
    window.selectionPreviewAngleRad = 0;
};

window.startSelectionRotationDrag = function (e) {
    const sb = window.selectionBounds;
    const isWarp4 = window.selectionIsWarpQuad && window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length === 4;
    if (!sb || (window.selectionKind !== 'rect' && !isWarp4) || window._illuFinishingWarp) return;

    /* warp-4 : aperçu warp temps réel ; déform → aperçu angle + bake (comme Déplacer). */
    if (
        window.activeTool === 'warp-4' &&
        !window.selectionPixelWarpActive &&
        !window._illuFinishingWarp
    ) {
        window.startSelectionPixelWarp(e, 'rot');
    }

    let cx, cy;
    if (isWarp4) {
        const pts = window.selectionLassoPoints;
        cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
        cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
    } else {
        cx = sb.x + sb.w / 2;
        cy = sb.y + sb.h / 2;
    }
    const pos = getPos(e);
    window.selectionRotationDragActive = true;
    selectionRotateStartPointerAngle = Math.atan2(pos.y - cy, pos.x - cx);
    selectionRotateStartPreview = window.selectionPreviewAngleRad || 0;
    isDrawing = true;
};

window.onSelectionHandleMouseDown = function (e, handleId) {
    e.preventDefault();
    e.stopPropagation();
    if (!EditorManager.isPixelMode) return;
    if (handleId === 'rot') {
        const isWarp4 = window.selectionIsWarpQuad && window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length === 4;
        if ((window.selectionKind !== 'rect' && !isWarp4) || window.selectionInverted) return;
        window.startSelectionRotationDrag(e);
        return;
    }
    const sb = window.selectionBounds;
    const ov = document.getElementById('selection-overlay');
    if (!sb || !ov || ov.style.display === 'none' || window.selectionInverted || sb.w <= 2 || sb.h <= 2) {
        return;
    }
    const strictSubset =
        typeof window.selectionIsStrictSubsetOfActiveLayer === 'function' &&
        window.selectionIsStrictSubsetOfActiveLayer();
    const warpQuadContinues =
        window.selectionIsWarpQuad &&
        window.selectionKind === 'lasso' &&
        window.selectionLassoPoints &&
        window.selectionLassoPoints.length === 4;
    const freeQuadOutline =
        typeof window.illuSelectionHasFreeWarpQuad === 'function' &&
        window.illuSelectionHasFreeWarpQuad() &&
        window.activeTool === 'select';
    const usePixelWarp =
        (strictSubset || warpQuadContinues) &&
        EditorManager.isPixelMode &&
        isPixelWarpOrDeformTool();
    if (freeQuadOutline) {
        window.startSelectionResize(e, handleId);
        isDrawing = true;
        return;
    }
    if (window.selectionMatchesActiveLayer()) {
        if (isPixelWarpOrDeformTool()) {
            window.startSelectionPixelWarp(e, handleId);
        } else {
            /* Ne jamais redimensionner le tampon du calque : seule la sélection évolue (pixels du doc = taille canvas). */
            window.startSelectionResize(e, handleId);
        }
    } else if (usePixelWarp) {
        window.startSelectionPixelWarp(e, handleId);
    } else {
        window.startSelectionResize(e, handleId);
    }
    if (window.selectionPixelWarpActive || window.selectionBoundsResizeActive) {
        isDrawing = true;
    }
};

/**
 * Déplacement calque / sélection (outil Déplacer, ou Déformation uniquement via le bouton central).
 * @param {{x:number,y:number}} pos
 * @param {MouseEvent|PointerEvent} e
 */
function illuPixelMoveToolStartDrag(pos, e) {
    const ctx = EditorManager.activeCtx;
    if (!ctx) return;
    const hasSel =
        typeof window.hasActivePixelSelection === 'function' && window.hasActivePixelSelection();
    if (
        window.illuCropSessionActive &&
        hasSel &&
        window.selectionKind === 'rect' &&
        window.selectionBounds
    ) {
        const sb = window.selectionBounds;
        const px = pos.x;
        const py = pos.y;
        if (px >= sb.x && px < sb.x + sb.w && py >= sb.y && py < sb.y + sb.h) {
            illuCropBoundsDrag = true;
            moveDragBoundsStart = { x: sb.x, y: sb.y, w: sb.w, h: sb.h };
            moveOffset = { x: px - sb.x, y: py - sb.y };
            isDrawing = true;
            return;
        }
    }
    /* Collage volant : déplacer le tampon staging (hors toile jusqu’à validation). */
    if (
        hasSel &&
        EditorManager.activeLayer &&
        EditorManager.activeLayer.importPlacementPending &&
        EditorManager.activeLayer.importStagingBuffer &&
        illuPointInSelectionBoundsDoc(pos.x, pos.y, 0)
    ) {
        const keepDeformMoveBtn = window._illuDeformMoveFromButtonActive;
        illuResetMoveSelectionDragArtifacts();
        window._illuDeformMoveFromButtonActive = keepDeformMoveBtn;
        const ml = EditorManager.activeLayer;
        const st = ml.importStagingBuffer;
        const sx = ml.importStagingX | 0;
        const sy = ml.importStagingY | 0;
        moveLayerStartPos = { x: sx, y: sy };
        moveLayerStartLassoPoints = null;
        moveOffset = { x: pos.x - sx, y: pos.y - sy };
        illuSelectionInteractionOwner = 'moveLayer';
        if (st) {
            ml._ghostDragHide = true;
            moveLayerWholeGhostEl = document.createElement('canvas');
            moveLayerWholeGhostEl.setAttribute('aria-hidden', 'true');
            moveLayerWholeGhostEl.className = 'illu-move-layer-whole-ghost';
            moveLayerWholeGhostEl.width = st.width;
            moveLayerWholeGhostEl.height = st.height;
            moveLayerWholeGhostEl.style.left = `${sx}px`;
            moveLayerWholeGhostEl.style.top = `${sy}px`;
            moveLayerWholeGhostEl.style.imageRendering = 'pixelated';
            moveLayerWholeGhostEl.style.setProperty('image-rendering', 'crisp-edges');
            const gctx = moveLayerWholeGhostEl.getContext('2d', { willReadFrequently: true });
            if (gctx) {
                gctx.imageSmoothingEnabled = false;
                gctx.drawImage(st, 0, 0);
            }
            EditorManager.render();
            illuMountMoveLayerWholeGhostInStack();
        }
        isDrawing = true;
        return;
    }

    /* Avec une sélection active : toujours déplacer les pixels (même si le cadre couvre tout le calque), pas layer.x/y ni le cadre seul. */
    if (hasSel && illuIsFloatingImportPending()) {
        isDrawing = false;
        return;
    }
    if (hasSel) {
        moveLayerStartPos = null;
        moveLayerStartLassoPoints = null;
        const sb = window.selectionBounds;
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        // Use pixel-aligned coordinates to avoid "half-pixel" residue (small lines)
        const ox = Math.floor(sb.x - lx);
        const oy = Math.floor(sb.y - ly);
        const sw = Math.ceil(sb.x - lx + sb.w) - ox;
        const sh = Math.ceil(sb.y - ly + sb.h) - oy;
        const chunk = ctx.getImageData(ox, oy, sw, sh);
        if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
            const d = chunk.data;
            for (let yy = 0; yy < sh; yy++) {
                for (let xx = 0; xx < sw; xx++) {
                    if (!pointInPolygon(xx + ox + lx + 0.5, yy + oy + ly + 0.5, window.selectionLassoPoints)) {
                        const idx = (yy * sw + xx) * 4;
                        d[idx + 3] = 0;
                    }
                }
            }
        } else if (
            window.selectionKind === 'color' &&
            window.selectionColorMask &&
            EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
        ) {
            const m = window.selectionColorMask;
            const d = chunk.data;
            for (let yy = 0; yy < sh; yy++) {
                for (let xx = 0; xx < sw; xx++) {
                    const lpx = ox + xx;
                    const lpy = oy + yy;
                    if (lpx < 0 || lpx >= m.w || lpy < 0 || lpy >= m.h || !m.data[lpy * m.w + lpx]) {
                        const idx = (yy * sw + xx) * 4;
                        d[idx + 3] = 0;
                    }
                }
            }
        }
        moveBufferCanvas = document.createElement('canvas');
        moveBufferCanvas.width = sw;
        moveBufferCanvas.height = sh;
        const mbctx = moveBufferCanvas.getContext('2d', { willReadFrequently: true });
        if (mbctx) {
            mbctx.imageSmoothingEnabled = false;
            mbctx.putImageData(chunk, 0, 0);
        }

        moveSelectionLayerSnapshot = cloneCanvasForWarp(EditorManager.activeLayer.buffer);
        illuSelectionInteractionOwner = 'movePixels';
        if (selectionOverlay) selectionOverlay.style.display = 'none';

        isMovingSelection = true;
        moveOffset = { x: pos.x - sb.x, y: pos.y - sb.y };

        moveGhostLayer = document.createElement('canvas');
        moveGhostLayer.className = 'illu-stack-preview-overlay';
        moveGhostLayer.width = sw;
        moveGhostLayer.height = sh;
        moveGhostLayer.style.position = 'absolute';
        moveGhostLayer.style.pointerEvents = 'none';
        moveGhostLayer.style.left = `${ox + lx}px`;
        moveGhostLayer.style.top = `${oy + ly}px`;
        moveGhostLayer.style.imageRendering = 'pixelated';
        moveGhostLayer.style.setProperty('image-rendering', 'crisp-edges');
        const gh = moveGhostLayer.getContext('2d', { willReadFrequently: true });
        if (gh) {
            gh.imageSmoothingEnabled = false;
            gh.drawImage(moveBufferCanvas, 0, 0);
        }
        moveDragBoundsStart = { x: ox + lx, y: oy + ly, w: sw, h: sh };
        moveDragLassoBaseline =
            window.selectionKind === 'lasso' && window.selectionLassoPoints
                ? window.selectionLassoPoints.map((p) => ({ x: p.x, y: p.y }))
                : null;
        const cutCtx = EditorManager.activeLayer.buffer.getContext('2d', { willReadFrequently: true });
        if (cutCtx) {
            illuClearMoveSelectionSourceRegion(cutCtx, lx, ly);
            EditorManager.activeLayer._movePixelsHoleCleared = true;
        }
        /* Rendu d’abord : vues calque dans la pile, puis fantôme inséré « entre » les calques au bon plan. */
        EditorManager.render();
        illuMountPreviewCanvasBeforeSelectionOverlay(moveGhostLayer);
    }
    /* Sans sélection : pas de déplacement du calque entier (uniquement une sélection de pixels ou collage volant). */
}

/**
 * Bouton central Déformation : même déplacement que l’outil Déplacer (fantôme + commit au relâchement),
 * y compris pendant une session warp (le suivi souris n’utilise plus la poignée warp « c »).
 */
/** Bouton central pendant le recadrage : déplace la zone de recadrage (sélection rect). */
window.illuCropSelectionMoveButtonMouseDown = function (e) {
    if (!window.illuCropSessionActive || !EditorManager.isPixelMode) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sb = window.selectionBounds;
    if (!sb || window.selectionKind !== 'rect' || window.selectionInverted || sb.w <= 2 || sb.h <= 2) {
        return;
    }
    const pos = getPos(e);
    illuCropBoundsDrag = true;
    moveDragBoundsStart = { x: sb.x, y: sb.y, w: sb.w, h: sb.h };
    moveOffset = { x: pos.x - sb.x, y: pos.y - sb.y };
    isDrawing = true;
    window._illuDeformMoveFromButtonActive = true;
};

window.illuDeformSelectionMoveButtonMouseDown = function (e) {
    if (!EditorManager.isPixelMode || window.activeTool !== 'deform') return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    /* Même comportement que l’outil Déplacer : fantôme + suivi jusqu’au relâchement (pas la poignée warp « c »). */
    const ctx = EditorManager.activeCtx;
    if (!ctx) return;
    let pos = getPos(e);
    window._illuDeformMoveFromButtonActive = true;
    illuSelectionInteractionOwner = 'deformMove';
    window._shiftConstraintProportions = e.shiftKey;
    isDrawing = true;
    startX = pos.x;
    startY = pos.y;
    illuPixelMoveToolStartDrag(pos, e);
};

window.illuShapeEditMoveButtonMouseDown = function (e) {
    if (!EditorManager.isPixelMode || !window.pixelShapeEdit || !EditorManager.activeLayer) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getPos(e);
    window._illuShapeEditMoveActive = true;
    window._illuShapeEditMoveStartDoc = { x: pos.x, y: pos.y };
    window._illuShapeEditMoveSnapshot =
        typeof window.illuSnapshotShapeEditGeom === 'function'
            ? window.illuSnapshotShapeEditGeom(window.pixelShapeEdit)
            : null;
    isDrawing = true;
};

function startPixel(pos, e) {
    let ctx = EditorManager.activeCtx;
    if (!ctx) return;

    /* Déplacer : sans sélection → tracer un cadre ; avec sélection → déplacer les pixels. */
    if (EditorManager.isPixelMode && window.activeTool === 'move') {
        if (illuNoUsableSelectionForDeformNewRect()) {
            illuBeginNewSelectionRectDrag(e);
        } else {
            illuPixelMoveToolStartDrag(pos, e);
        }
        return;
    }

    if (EditorManager.isPixelMode && isPixelWarpOrDeformTool()) {
        if (illuNoUsableSelectionForDeformNewRect()) {
            illuBeginNewSelectionRectDrag(e);
        } else {
            /* Déformation : pas de drag « déplacer » sur la toile (uniquement bouton central). */
            isDrawing = false;
        }
        return;
    }

    if (EditorManager.isPixelMode && (window.activeTool === 'pen' || window.activeTool === 'polygon')) {
        startVector(pos, e);
        return;
    }

    if (['rect', 'circle', 'line', 'round-3', 'triangle'].includes(window.activeTool) && typeof window.cloneLayerBuffer === 'function') {
        if (typeof EditorManager.pushHistoryCheckpoint === 'function') {
            EditorManager.pushHistoryCheckpoint('Avant forme');
        }
        window._shapeBackupCanvas = window.cloneLayerBuffer(EditorManager.activeLayer.buffer);
        window._shapeLivePreviewAngleRad = 0;
        window._shapeRotDragActive = false;
        window._shapeRotDragMode = null;
    }

    if (isLassoSelectionTool()) {
        const combineOp =
            typeof window.illuLockSelectionCombineOp === 'function'
                ? window.illuLockSelectionCombineOp(e)
                : 'new';
        const combineDown = combineOp === 'add' || combineOp === 'subtract';
        selectionCombineBackup =
            combineDown && typeof window.rasterizeCurrentSelectionToLayerMask === 'function'
                ? window.rasterizeCurrentSelectionToLayerMask()
                : null;
        window.selectionInverted = false;
        window.selectionCombineGhost = combineDown ? captureSelectionCombineGhost() : null;
        if (!combineDown) {
            window.selectionBounds = null;
            window.selectionLassoPoints = null;
            window.selectionColorMask = null;
            window.selectionKind = 'lasso';
            window.selectionIsWarpQuad = false;
            window.selectionPreviewAngleRad = 0;
            if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
        } else {
            window.selectionPreviewAngleRad = 0;
        }
        if (!combineDown) window.selectionKind = 'lasso';
        lassoDrawingPoints = [{ x: startX, y: startY }];
        if (typeof window.scheduleSelectionOverlayOnly === 'function') {
            window.scheduleSelectionOverlayOnly({ lassoPoints: lassoDrawingPoints });
        } else {
            window.refreshSelectionVisual();
        }
        return;
    }

    if (['brush', 'pencil', 'eraser'].includes(window.activeTool)) {
        if (typeof EditorManager.beginStrokeIntermediate === 'function') {
            EditorManager.beginStrokeIntermediate(window.activeTool);
        }
        ctx = EditorManager.activeCtx;
        if (!ctx) return;
    }

    EditorManager.applyActiveStyle(ctx);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;

    // Apply Clipping mask
    ctx.save();
    if (
        window.selectionBounds &&
        (typeof window.hasActivePixelSelection !== 'function' || window.hasActivePixelSelection()) &&
        window.activeTool !== 'select' &&
        window.activeTool !== 'direct-select' &&
        !isPixelWarpOrDeformTool()
    ) {
        applySelectionClip(ctx, EditorManager.activeLayer.x, EditorManager.activeLayer.y);
    }

    if (window.activeTool === 'fill') {
        if (typeof EditorManager.pushHistoryCheckpoint === 'function') {
            EditorManager.pushHistoryCheckpoint('Avant remplissage');
        }
        floodFill(Math.round(pos.x - EditorManager.activeLayer.x), Math.round(pos.y - EditorManager.activeLayer.y));
        ctx.restore();
        EditorManager.saveHistory('Remplissage', { patchActiveLayer: true });
        EditorManager.render({ flushUiThumbnails: true });
    } else if (isRectSelectionTool()) {
        const combineOp =
            typeof window.illuLockSelectionCombineOp === 'function'
                ? window.illuLockSelectionCombineOp(e)
                : 'new';
        const combineDown = combineOp === 'add' || combineOp === 'subtract';
        selectionCombineBackup =
            combineDown && typeof window.rasterizeCurrentSelectionToLayerMask === 'function'
                ? window.rasterizeCurrentSelectionToLayerMask()
                : null;
        window.selectionInverted = false;
        window.selectionCombineGhost = combineDown ? captureSelectionCombineGhost() : null;
        window.selectionKind = 'rect';
        window.selectionColorMask = null;
        window.selectionLassoPoints = null;
        window.selectionIsWarpQuad = false;
        window.selectionPreviewAngleRad = 0;
        window.selectionBounds = { x: startX, y: startY, w: 0, h: 0 };
        if (typeof window.scheduleSelectionOverlayOnly === 'function') {
            window.scheduleSelectionOverlayOnly();
        } else {
            window.refreshSelectionVisual();
        }
    } else if (window.activeTool === 'brush') {
        if (typeof EditorManager.setStrokeLightPixelRender === 'function') {
            EditorManager.setStrokeLightPixelRender(true);
        }
        const pat = EditorManager.toolProps.brushPattern || 'round';
        const lw = EditorManager.toolProps.size || 5;
        ctx.lineWidth = lw;
        const lx = pos.x - EditorManager.activeLayer.x;
        const ly = pos.y - EditorManager.activeLayer.y;
        if (pat === 'spray') {
            isSprayStroke = true;
            isStampBrushStroke = false;
            isPencilPixelStroke = false;
            pencilStrokePoints = null;
            const sprayCol = (EditorManager.activeProject && EditorManager.activeProject.mode === 'pixel-dither') ? '#000' : EditorManager.activeColor;
            sprayDots(ctx, lx, ly, lw, sprayCol);
            EditorManager.render();
        } else if (illuBrushUsesStampMode('brush')) {
            isSprayStroke = false;
            isStampBrushStroke = true;
            isPencilPixelStroke = false;
            lastStampX = lx;
            lastStampY = ly;
            stampBrushAt(ctx, 'brush', lx, ly);
            pencilStrokePoints =
                EditorManager.toolProps.pencilAutoClose ? [{ x: lx, y: ly }] : null;
            EditorManager.render();
        } else {
            isSprayStroke = false;
            isStampBrushStroke = false;
            isPencilPixelStroke = false;
            applyBrushPatternStyle(ctx, pat);
            lastBrushLineX = lx;
            lastBrushLineY = ly;
            pencilStrokePoints =
                EditorManager.toolProps.pencilAutoClose ? [{ x: lx, y: ly }] : null;
        }
    } else if (window.activeTool === 'pencil') {
        if (typeof EditorManager.setStrokeLightPixelRender === 'function') {
            EditorManager.setStrokeLightPixelRender(true);
        }
        isSprayStroke = false;
        isStampBrushStroke = false;
        isPencilPixelStroke = true;
        const plx = pos.x - EditorManager.activeLayer.x;
        const ply = pos.y - EditorManager.activeLayer.y;
        lastPencilX = plx;
        lastPencilY = ply;
        ctx.imageSmoothingEnabled = false;
        illuPencilFillPixel(ctx, plx, ply, EditorManager.toolProps.size || 1, EditorManager.activeColor);
        pencilStrokePoints =
            EditorManager.toolProps.pencilAutoClose ? [{ x: plx, y: ply }] : null;
        EditorManager.render();
    } else if (window.activeTool === 'eraser') {
        if (typeof EditorManager.setStrokeLightPixelRender === 'function') {
            EditorManager.setStrokeLightPixelRender(true);
        }
        const pat = EditorManager.toolProps.brushPattern || 'round';
        const lw = EditorManager.toolProps.size || 5;
        ctx.lineWidth = lw;
        const lx = pos.x - EditorManager.activeLayer.x;
        const ly = pos.y - EditorManager.activeLayer.y;
        if (pat === 'spray') {
            isSprayStroke = true;
            isStampBrushStroke = false;
            isPencilPixelStroke = false;
            pencilStrokePoints = null;
            sprayDotsErase(ctx, lx, ly, lw);
            EditorManager.render();
        } else if (illuBrushUsesStampMode('eraser')) {
            isSprayStroke = false;
            isStampBrushStroke = true;
            isPencilPixelStroke = false;
            lastStampX = lx;
            lastStampY = ly;
            stampBrushAt(ctx, 'eraser', lx, ly);
            pencilStrokePoints = null;
            EditorManager.render();
        } else {
            isSprayStroke = false;
            isStampBrushStroke = false;
            isPencilPixelStroke = false;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.fillStyle = 'rgba(0,0,0,1)';
            applyEraserPatternStyle(ctx, pat);
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            lastBrushLineX = lx;
            lastBrushLineY = ly;
            pencilStrokePoints = null;
        }
    }
}

function updatePixel(pos, pointerEv) {
    const e = pointerEv || window._illuLastPointerEvent;
    if (window.activeTool === 'eyedropper') {
        const rgb = sampleImageRgbAtMainCanvasPos(pos);
        if (rgb) EditorManager.setColorFromRGB(rgb.r, rgb.g, rgb.b, rgb.a);
        return;
    }
    const ctx = EditorManager.activeCtx;
    const VE = window.VectorEngine;

    if (EditorManager.isPixelMode && window.activeTool === 'pen' && VE.isPenActive()) {
        VE.penPreview(pos);
        return;
    }

    if (EditorManager.isPixelMode && (window._gradientHandleDrag !== null || window._gradientNewDrag) && window._pixelGradientState) {
        const st = window._pixelGradientState;
        let gx = pos.x;
        let gy = pos.y;
        if (window._shiftConstraintProportions) {
            if (window._gradientNewDrag) {
                const ep = constrainLineEndpoint(startX, startY, pos.x, pos.y, true);
                gx = ep.x;
                gy = ep.y;
            } else if (window._gradientHandleDrag === 0) {
                const ep = constrainLineEndpoint(st.x1, st.y1, pos.x, pos.y, true);
                gx = ep.x;
                gy = ep.y;
            } else if (window._gradientHandleDrag === 1) {
                const ep = constrainLineEndpoint(st.x0, st.y0, pos.x, pos.y, true);
                gx = ep.x;
                gy = ep.y;
            }
        }
        if (window._gradientNewDrag) {
            st.x1 = gx;
            st.y1 = gy;
        } else if (window._gradientHandleDrag === 0) {
            st.x0 = gx;
            st.y0 = gy;
        } else {
            st.x1 = gx;
            st.y1 = gy;
        }
        const gt = document.getElementById('tool-grad-type');
        if (gt) st.gradType = gt.value;

        // Force l'affichage des points/poignées immédiatement avant le rendu du dégradé
        if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);

        // On repousse le rendu lourd du dégradé à la frame suivante pour que les points
        // s'affichent instantanément sans attendre le calcul des pixels
        if (window._gradientRenderRequest) cancelAnimationFrame(window._gradientRenderRequest);
        window._gradientRenderRequest = requestAnimationFrame(() => {
            window.paintGradientFromState();
            window._gradientRenderRequest = null;
        });
        return;
    }

    if (EditorManager.isPixelMode && window.shapeHandleDrag !== null && window.pixelShapeEdit) {
        if (typeof window.shapeHandleDrag === 'string' && window.shapeHandleDrag.indexOf('adj-') === 0) {
            if (typeof window.updateShapeAdjustFromPointer === 'function') {
                window.updateShapeAdjustFromPointer(window.shapeHandleDrag, pos.x, pos.y);
            }
        } else {
            window.updateShapeEditFromHandle(window.shapeHandleDrag, pos.x, pos.y);
        }
        return;
    }

    /* Déplacer / Déformation (bouton) : même fantôme que l’outil Déplacer — priorité sur warp pour le suivi souris. */
    if (illuPixelMoveOrDeformTool()) {
        if (isMovingSelection && !moveDragBoundsStart) {
            illuResetMoveSelectionDragArtifacts();
            window._illuDeformMoveFromButtonActive = false;
        }
        if (isMovingSelection && moveDragBoundsStart) {
            const Wd = EditorManager.width;
            const Hd = EditorManager.height;
            let nx = Math.round(pos.x - moveOffset.x);
            let ny = Math.round(pos.y - moveOffset.y);
            // On autorise la sortie des limites du canvas pour tool-move
            // nx = Math.max(0, Math.min(nx, maxX));
            // ny = Math.max(0, Math.min(ny, maxY));
            const dx = nx - moveDragBoundsStart.x;
            const dy = ny - moveDragBoundsStart.y;
            window.selectionBounds = {
                x: nx,
                y: ny,
                w: moveDragBoundsStart.w,
                h: moveDragBoundsStart.h
            };
            if (moveDragLassoBaseline) {
                window.selectionLassoPoints = moveDragLassoBaseline.map((p) => ({
                    x: Math.round(p.x + dx),
                    y: Math.round(p.y + dy)
                }));
            }
            illuSyncDeformWarpQuadToGhostBounds(nx, ny, moveDragBoundsStart.w, moveDragBoundsStart.h);
            moveGhostLayer.style.left = `${nx}px`;
            moveGhostLayer.style.top = `${ny}px`;
            illuMountPreviewCanvasBeforeSelectionOverlay(moveGhostLayer);
            illuScheduleInteractiveVisualRefresh({ render: true, selection: true });
            return;
        } else if (EditorManager.activeLayer && moveLayerStartPos) {
            const l = EditorManager.activeLayer;
            const nx = Math.round(pos.x - moveOffset.x);
            const ny = Math.round(pos.y - moveOffset.y);
            if (moveLayerWholeGhostEl) {
                moveLayerWholeGhostEl.style.left = `${nx}px`;
                moveLayerWholeGhostEl.style.top = `${ny}px`;
                illuMountMoveLayerWholeGhostInStack();
            }
            if (l.importPlacementPending && l.importStagingBuffer) {
                l.importStagingX = nx;
                l.importStagingY = ny;
                if (window.selectionPixelWarpActive && selectionWarpDeformRect) {
                    selectionWarpDeformRect.rx = nx;
                    selectionWarpDeformRect.ry = ny;
                    illuSyncDeformWarpQuadToGhostBounds(nx, ny, selectionWarpDeformRect.rw, selectionWarpDeformRect.rh);
                }
                if (typeof window.syncSelectionToImportPlacementLayer === 'function') {
                    window.syncSelectionToImportPlacementLayer();
                } else {
                    window.selectionBounds = {
                        x: nx,
                        y: ny,
                        w: l.importStagingBuffer.width,
                        h: l.importStagingBuffer.height
                    };
                    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
                }
                illuScheduleInteractiveVisualRefresh({ render: true, selection: true });
            } else {
                /* Sélection en coords document : ne pas la translater avec le calque (style Paint.NET). */
                illuScheduleInteractiveVisualRefresh({ render: false, selection: true });
            }
            return;
        }
    }

    if (window.selectionPixelWarpActive && window.selectionWarpQuad && !window._illuFinishingWarp) {
        window.updateSelectionWarpFromPointer(pos.x, pos.y);
        if (window.illuSelectionLoupeActive && pointerEv) {
            const anchor =
                typeof window.illuSelectionHandleDocAnchor === 'function'
                    ? window.illuSelectionHandleDocAnchor(selectionWarpHandleId || '')
                    : null;
            if (typeof window.illuSelectionLoupeMove === 'function') {
                window.illuSelectionLoupeMove(pointerEv, anchor);
            }
        }
        if (window.activeTool === 'deform' && selectionWarpHandleId === 'c') {
            illuScheduleWarpChromeRefresh();
            illuScheduleSelectionWarpPreview({ preview: true });
            return;
        }
        illuScheduleWarpChromeRefresh();
        illuScheduleSelectionWarpPreview({ preview: true });
        return;
    }

    if (isLassoSelectionTool() && lassoDrawingPoints) {
        const c = illuClampPointToDocument(pos.x, pos.y);
        const last = lassoDrawingPoints[lassoDrawingPoints.length - 1];
        if (Math.hypot(c.x - last.x, c.y - last.y) >= 2) {
            lassoDrawingPoints.push({ x: c.x, y: c.y });
            if (selectionCombineBackup) {
                const now = performance.now();
                if (now - selectionCombineVisualLast >= 48) {
                    selectionCombineVisualLast = now;
                    window.refreshSelectionVisual({ forceFull: true });
                }
            } else if (typeof window.scheduleSelectionOverlayOnly === 'function') {
                window.scheduleSelectionOverlayOnly({ lassoPoints: lassoDrawingPoints });
            } else {
                window.refreshSelectionVisual();
            }
        }
        return;
    }

    if (
        selectionBoundsResizeActive &&
        originalSelectionBounds &&
        window.selectionBounds &&
        window.selectionIsWarpQuad &&
        !window.selectionPixelWarpActive &&
        window.activeTool === 'select' &&
        window.selectionKind === 'lasso' &&
        window.selectionLassoPoints &&
        window.selectionLassoPoints.length === 4 &&
        originalSelectionLassoPoints
    ) {
        const dx = pos.x - startX;
        const dy = pos.y - startY;
        const h = selectionResizeHandle || '';
        const o = originalSelectionLassoPoints;
        const map = { nw: 0, ne: 1, se: 2, sw: 3 };
        const ix = map[h];
        if (ix !== undefined) {
            const pts = o.map((p) => ({ x: p.x, y: p.y }));
            const cp = illuClampPointToDocument(o[ix].x + dx, o[ix].y + dy);
            pts[ix] = { x: cp.x, y: cp.y };
            const xs = pts.map((p) => p.x);
            const ys = pts.map((p) => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            window.selectionBounds = {
                x: minX,
                y: minY,
                w: Math.max(1, maxX - minX),
                h: Math.max(1, maxY - minY)
            };
            window.selectionLassoPoints = pts;
            const anchor =
                typeof window.illuSelectionHandleDocAnchor === 'function'
                    ? window.illuSelectionHandleDocAnchor(selectionResizeHandle || '')
                    : null;
            scheduleSelectionChromeRefresh({
                forceFullSelectionOverlay: true,
                loupeEvent: e,
                loupeAnchorDoc: anchor
            });
        }
        return;
    }

    if (selectionBoundsResizeActive && originalSelectionBounds && window.selectionBounds) {
        const dx = pos.x - startX;
        const dy = pos.y - startY;
        const s = originalSelectionBounds;
        const handle = selectionResizeHandle || '';
        const o = constrainSelectionResizeBounds(s, handle, dx, dy, window._shiftConstraintProportions);
        const x = o.x;
        const y = o.y;
        const w = o.w;
        const h = o.h;
        let nb = { x, y, w, h };
        if (illuClampSelectionBoundsToDocumentForActiveTool()) {
            nb = clampSelectionBoundsToDocument(nb);
        } else {
            nb = {
                x: nb.x,
                y: nb.y,
                w: Math.max(illuMinSelectionSpan(), Math.round(nb.w)),
                h: Math.max(illuMinSelectionSpan(), Math.round(nb.h))
            };
        }
        window.selectionBounds = nb;
        if (originalSelectionLassoPoints && window.selectionKind === 'lasso') {
            const s = originalSelectionBounds;
            window.selectionLassoPoints = originalSelectionLassoPoints.map((p) => ({
                x: nb.x + ((p.x - s.x) / Math.max(1e-6, s.w)) * nb.w,
                y: nb.y + ((p.y - s.y) / Math.max(1e-6, s.h)) * nb.h
            }));
        }
        const anchor =
            typeof window.illuSelectionHandleDocAnchor === 'function'
                ? window.illuSelectionHandleDocAnchor(selectionResizeHandle || '')
                : null;
        scheduleSelectionChromeRefresh({
            forceFullSelectionOverlay: window.selectionKind === 'lasso',
            forceDrawUI: true,
            loupeEvent: e,
            loupeAnchorDoc: anchor
        });
        if (window.illuCropSessionActive && typeof window.illuCropPanelSync === 'function') {
            window.illuCropPanelSync();
        }
        return;
    }

    if (illuCropBoundsDrag && moveDragBoundsStart) {
        const Wd = EditorManager.width;
        const Hd = EditorManager.height;
        let nx = Math.round(pos.x - moveOffset.x);
        let ny = Math.round(pos.y - moveOffset.y);
        const maxX = Math.max(0, Wd - moveDragBoundsStart.w);
        const maxY = Math.max(0, Hd - moveDragBoundsStart.h);
        nx = Math.max(0, Math.min(nx, maxX));
        ny = Math.max(0, Math.min(ny, maxY));
        window.selectionBounds = {
            x: nx,
            y: ny,
            w: moveDragBoundsStart.w,
            h: moveDragBoundsStart.h
        };
        scheduleSelectionChromeRefresh({ forceFullSelectionOverlay: true });
        if (typeof window.illuCropPanelSync === 'function') window.illuCropPanelSync();
        return;
    }

    if (window._illuShapeEditMoveActive && window.pixelShapeEdit && window._illuShapeEditMoveStartDoc && window._illuShapeEditMoveSnapshot) {
        const ed = window.pixelShapeEdit;
        const snap = window._illuShapeEditMoveSnapshot;
        const start = window._illuShapeEditMoveStartDoc;
        const dx = pos.x - start.x;
        const dy = pos.y - start.y;
        if (typeof window.illuApplyShapeEditGeomFromSnapshot === 'function') {
            window.illuApplyShapeEditGeomFromSnapshot(ed, snap, dx, dy);
        }
        if (typeof window.redrawShapeFromEditLive === 'function') {
            window.redrawShapeFromEditLive();
        } else if (typeof EditorManager.drawUI === 'function') {
            EditorManager.drawUI(true);
        }
        return;
    }

    if (window._shapeRotDragActive) {
        const pivot = getShapePreviewRotationPivotDoc(window._shapeRotDragMode);
        if (pivot) {
            const a = Math.atan2(pos.y - pivot.cy, pos.x - pivot.cx);
            let ang = shapeLiveRotateStartPreview + (a - shapeLiveRotateStartPointerAngle);
            ang = constrainRotationAngleRad(ang, window._shiftConstraintProportions);
            if (window._shapeRotDragMode === 'edit' && window.pixelShapeEdit) {
                window.pixelShapeEdit.angleRad = ang;
                if (typeof window.redrawShapeFromEditLive === 'function') {
                    window.redrawShapeFromEditLive();
                }
                if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
                return;
            }
            window._shapeLivePreviewAngleRad = ang;
        }
    }

    if (window.selectionRotationDragActive) {
        const isWarp4 = window.selectionIsWarpQuad && window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length === 4;
        let cx, cy;
        if (isWarp4) {
            const pts = window.selectionLassoPoints;
            cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
            cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
        } else if (window.selectionBounds) {
            cx = window.selectionBounds.x + window.selectionBounds.w / 2;
            cy = window.selectionBounds.y + window.selectionBounds.h / 2;
        } else {
            return;
        }
        const a = Math.atan2(pos.y - cy, pos.x - cx);
        let da = a - selectionRotateStartPointerAngle;
        let ang = selectionRotateStartPreview + da;
        ang = constrainRotationAngleRad(ang, window._shiftConstraintProportions);
        da = ang - selectionRotateStartPreview;
        window.selectionPreviewAngleRad = ang;

        if (window.selectionPixelWarpActive && window.selectionWarpQuad && window.selectionWarpQuadAtStart) {
            const q0 = window.selectionWarpQuadAtStart;
            const cos = Math.cos(da);
            const sin = Math.sin(da);
            const rotatePoint = (p) => {
                const dx = p.x - cx;
                const dy = p.y - cy;
                return {
                    x: cx + dx * cos - dy * sin,
                    y: cy + dx * sin + dy * cos
                };
            };
            window.selectionWarpQuad = {
                tl: rotatePoint(q0.tl),
                tr: rotatePoint(q0.tr),
                br: rotatePoint(q0.br),
                bl: rotatePoint(q0.bl)
            };
            illuScheduleSelectionWarpPreview({ preview: true });
        }

        scheduleSelectionChromeRefresh({ forceFullSelectionOverlay: true, forceDrawUI: true });
        return;
    }

    if (
        EditorManager.isPixelMode &&
        isDrawing &&
        ['rect', 'circle', 'line', 'round-3', 'triangle'].includes(window.activeTool) &&
        window._shapeBackupCanvas &&
        EditorManager.activeLayer &&
        EditorManager.activeLayer.buffer
    ) {
        const buf = EditorManager.activeLayer.buffer;
        const useShapePreview =
            typeof EditorManager._canUseShapePreviewOverlay === 'function' &&
            EditorManager._canUseShapePreviewOverlay();
        if (useShapePreview) {
            if (!EditorManager._shapePreviewActive && typeof EditorManager.beginShapePreviewIfNeeded === 'function') {
                EditorManager.beginShapePreviewIfNeeded();
            }
            const pc = EditorManager._shapePreviewCanvas;
            if (pc) {
                const pctx = pc.getContext('2d', { willReadFrequently: true });
                pctx.clearRect(0, 0, buf.width, buf.height);
                pctx.save();
                if (
                    window.selectionBounds &&
                    (typeof window.hasActivePixelSelection !== 'function' || window.hasActivePixelSelection()) &&
                    window.activeTool !== 'select' &&
                    window.activeTool !== 'direct-select' &&
                    !isPixelWarpOrDeformTool()
                ) {
                    applySelectionClip(pctx, EditorManager.activeLayer.x, EditorManager.activeLayer.y);
                }
                paintPixelShapeAt(pctx, pos, startX, startY, window._shiftConstraintProportions, window._shapeLivePreviewAngleRad || 0);
                pctx.restore();
            }
        } else {
            ctx.clearRect(0, 0, buf.width, buf.height);
            ctx.drawImage(window._shapeBackupCanvas, 0, 0);
            paintPixelShapeAt(ctx, pos, startX, startY, window._shiftConstraintProportions, window._shapeLivePreviewAngleRad || 0);
        }
        illuScheduleInteractiveVisualRefresh({ render: true });
        if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
        return;
    }

    if (!ctx) return;

    if (isRectSelectionTool() || deformWarpNewRectDrag) {
        const c = illuClampPointToDocument(pos.x, pos.y);
        const b = constrainRectSelectionDraw(startX, startY, c.x, c.y, window._shiftConstraintProportions);
        let nb = { x: b.x, y: b.y, w: b.w, h: b.h };
        nb = clampSelectionBoundsToDocument(nb);
        window.selectionBounds = nb;
        if (selectionCombineBackup) {
            const now = performance.now();
            if (now - selectionCombineVisualLast >= 48) {
                selectionCombineVisualLast = now;
                window.refreshSelectionVisual({ forceFull: true });
            }
        } else if (typeof window.scheduleSelectionOverlayOnly === 'function') {
            window.scheduleSelectionOverlayOnly();
        } else {
            window.refreshSelectionVisual();
        }
        if (window.illuCropSessionActive && typeof window.illuCropPanelSync === 'function') {
            window.illuCropPanelSync();
        }
    } else if (['brush', 'pencil', 'eraser'].includes(window.activeTool)) {
        const lx = pos.x - EditorManager.activeLayer.x;
        const ly = pos.y - EditorManager.activeLayer.y;
        const lw = window.EditorManager.toolProps.size || 5;
        if (window.activeTool === 'pencil' && isPencilPixelStroke) {
            const psz = EditorManager.toolProps.size || 1;
            illuPencilSegment(ctx, lastPencilX, lastPencilY, lx, ly, psz, EditorManager.activeColor);
            lastPencilX = lx;
            lastPencilY = ly;
            if (pencilStrokePoints && EditorManager.toolProps.pencilAutoClose) {
                const last = pencilStrokePoints[pencilStrokePoints.length - 1];
                if (!last || Math.hypot(lx - last.x, ly - last.y) >= 0.5) {
                    pencilStrokePoints.push({ x: lx, y: ly });
                }
            }
            illuScheduleInteractiveVisualRefresh({ render: true });
            return;
        }
        if (window.activeTool === 'brush' && isSprayStroke) {
            const sprayCol = (EditorManager.activeProject && EditorManager.activeProject.mode === 'pixel-dither') ? '#000' : EditorManager.activeColor;
            sprayDots(ctx, lx, ly, lw, sprayCol);
            illuScheduleInteractiveVisualRefresh({ render: true });
            return;
        }
        if (window.activeTool === 'eraser' && isSprayStroke) {
            sprayDotsErase(ctx, lx, ly, lw);
            illuScheduleInteractiveVisualRefresh({ render: true });
            return;
        }
        if (
            (window.activeTool === 'brush' || window.activeTool === 'eraser') &&
            isStampBrushStroke
        ) {
            stampBrushSegment(ctx, window.activeTool, lastStampX, lastStampY, lx, ly);
            lastStampX = lx;
            lastStampY = ly;
            if (
                (window.activeTool === 'brush') &&
                pencilStrokePoints &&
                EditorManager.toolProps.pencilAutoClose
            ) {
                const last = pencilStrokePoints[pencilStrokePoints.length - 1];
                if (!last || Math.hypot(lx - last.x, ly - last.y) >= 0.5) {
                    pencilStrokePoints.push({ x: lx, y: ly });
                }
            }
            illuScheduleInteractiveVisualRefresh({ render: true });
            return;
        }
        if (window.activeTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = lw;
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            applyEraserPatternStyle(ctx, EditorManager.toolProps.brushPattern || 'round');
        } else {
            ctx.globalCompositeOperation = 'source-over';
            EditorManager.applyActiveStyle(ctx);
            ctx.lineWidth = lw;
            applyBrushPatternStyle(ctx, EditorManager.toolProps.brushPattern || 'round');
        }
        ctx.beginPath();
        ctx.moveTo(lastBrushLineX, lastBrushLineY);
        ctx.lineTo(lx, ly);
        ctx.stroke();
        lastBrushLineX = lx;
        lastBrushLineY = ly;
        if (
            window.activeTool === 'brush' &&
            pencilStrokePoints &&
            !isSprayStroke
        ) {
            const last = pencilStrokePoints[pencilStrokePoints.length - 1];
            if (!last || Math.hypot(lx - last.x, ly - last.y) >= 0.5) {
                pencilStrokePoints.push({ x: lx, y: ly });
            }
        }
        illuScheduleInteractiveVisualRefresh({ render: true });
    }
}

function handleMouseUp(e) {
    illuFlushInteractiveVisualRefresh();
    if (typeof EditorManager.setStrokeLightPixelRender === 'function') {
        EditorManager.setStrokeLightPixelRender(false);
    }
    if (illuCropBoundsDrag) {
        illuCropBoundsDrag = false;
        moveDragBoundsStart = null;
        isDrawing = false;
        window._illuDeformMoveFromButtonActive = false;
        if (typeof window.illuCropPanelSync === 'function') window.illuCropPanelSync();
        EditorManager.render();
        return;
    }
    if (activeVectorRotationDrag) {
        activeVectorRotationDrag = false;
        window._illuVectorDragActive = false;
        if (activeVectorShape) {
            EditorManager.syncActiveVectorSvg();
            EditorManager.saveHistory('Rotation forme (vecteur)', { patchActiveLayer: true });
            if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
            EditorManager.render({ flushUiThumbnails: true });
        }
        activeVectorShape = null;
        isDrawing = false;
        return;
    }
    if (window._shapeRotDragActive) {
        const wasEdit = window._shapeRotDragMode === 'edit';
        window._shapeRotDragActive = false;
        window._shapeRotDragMode = null;
        isDrawing = true;
        if (wasEdit) {
            EditorManager.saveHistory('Rotation forme', { patchActiveLayer: true });
        }
        if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
        illuScheduleInteractiveVisualRefresh({ render: true });
        return;
    }
    if (window.selectionRotationDragActive) {
        window.selectionRotationDragActive = false;
        const ang = window.selectionPreviewAngleRad || 0;
        window.selectionPreviewAngleRad = 0;
        if (window.selectionPixelWarpActive) {
            window.finishSelectionPixelWarp();
        } else if (Math.abs(ang) > 1e-3) {
            window.bakeSelectionRotation(ang);
            EditorManager.saveHistory('Rotation sélection', { patchActiveLayer: true });
        }
        window.refreshSelectionVisual();
        EditorManager.render();
        isDrawing = false;
        return;
    }
    /* Filet de sécurité : si une session warp est active avec un handle enfoncé, toujours finaliser
       au relâchement de la souris — même si isDrawing a été corrompu par un re-render SVG ou un
       double-tir pointerdown/mousedown. */
    if (
        window.selectionPixelWarpActive &&
        selectionWarpHandlePointerDown &&
        !window._illuFinishingWarp &&
        illuSelectionInteractionOwner === 'warp' &&
        !(
            window._illuDeformMoveFromButtonActive &&
            (isMovingSelection ||
                (EditorManager.activeLayer && moveLayerStartPos != null))
        )
    ) {
        isDrawing = false;
        window.finishSelectionPixelWarp();
        return;
    }
    /* Relâchement depuis le bouton Déformation (pointer capture) : un second événement peut arriver avec isDrawing déjà false ; on termine quand même le déplacement. */
    if (!isDrawing) {
        if (
            window._illuDeformMoveFromButtonActive &&
            (isMovingSelection ||
                (EditorManager.activeLayer && moveLayerStartPos != null))
        ) {
            isDrawing = true;
        } else if (window._illuShapeEditMoveActive) {
            isDrawing = true;
        } else {
            if (window._illuDeformMoveFromButtonActive) {
                window._illuDeformMoveFromButtonActive = false;
                illuReleaseDeformMoveButtonPointerCapture();
            }
            if (window._illuShapeEditMoveActive) {
                window._illuShapeEditMoveActive = false;
                window._illuShapeEditMoveStartDoc = null;
                window._illuShapeEditMoveSnapshot = null;
                if (typeof window.illuReleaseShapeEditMoveButtonPointerCapture === 'function') {
                    window.illuReleaseShapeEditMoveButtonPointerCapture();
                }
            }
            return;
        }
    }
    const vectorChromeMustEnd =
        vectorGradientDrag ||
        (vectorMoveTarget !== null && vectorMoveStartPointer !== null);
    if (shouldIgnoreMouseUpOnChrome(e) && !vectorChromeMustEnd) return;
    isDrawing = false;
    const hadVectorAnchorDrag = activeAnchor !== null || activeAdjustDrag !== null;
    activeAnchor = null;
    activeAnchorIndex = -1;
    activeAdjustDrag = null;
    const pos = getPos(e);
    const ctx = EditorManager.activeCtx;

    if (EditorManager.mode === 'vector') {
        const VE = window.VectorEngine;
        const tool = window.activeTool;

        if (vectorGradientDrag) {
            vectorGradientDrag = null;
            EditorManager.saveHistory('Dégradé vecteur', { patchActiveLayer: true });
            EditorManager.render();
            return;
        }

        const RESUME_DRAW_TOOLS_UP = new Set([
            'rect',
            'circle',
            'line',
            'brush',
            'round-3',
            'triangle',
            'cubic-3',
            'shadow'
        ]);
        if (
            RESUME_DRAW_TOOLS_UP.has(tool) &&
            !currentElement &&
            EditorManager.activeVectorSelection &&
            EditorManager.activeVectorSelection.length
        ) {
            const moved = VE.endDrag();
            window._illuVectorDragActive = false;
            if (moved) {
                if (typeof EditorManager.syncActiveVectorSvg === 'function') EditorManager.syncActiveVectorSvg();
                EditorManager.saveHistory('Déplacement vecteur', { patchActiveLayer: true });
                VE.refreshSelectionUI();
                EditorManager.render();
            }
            isDrawing = false;
            return;
        }

        // Commit rubber-band ou multi-drag pour select/move
        if (tool === 'select' || tool === 'move') {
            const additive = (e && e.altKey && !e.ctrlKey) ? 'subtract' : (e && (e.shiftKey || e.ctrlKey || e.metaKey)) ? true : (window.selectionMode === 'add' ? true : (window.selectionMode === 'subtract' ? 'subtract' : false));
            const moved = VE.endDrag();
            if (moved) {
                if (typeof EditorManager.syncActiveVectorSvg === 'function') EditorManager.syncActiveVectorSvg();
                EditorManager.saveHistory('Déplacement vecteur', { patchActiveLayer: true });
                VE.refreshSelectionUI();
                EditorManager.render();
                return;
            }
            // Pas de drag => c'est un rubber-band
            VE.commitRubberBand(pos, additive);
            VE.refreshSelectionUI();
            if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            EditorManager.render();
            return;
        }

        // Legacy vectorMoveTarget (calque entier)
        vectorMovePendingHit = null;
        vectorMovePointerDown = null;
        if (vectorMoveTarget !== null && vectorMoveStartPointer !== null) {
            const moved = vectorDidMove;
            vectorMoveTarget = null;
            vectorMoveWholeLayer = false;
            vectorMoveStartPointer = null;
            vectorMoveInitial = null;
            vectorDidMove = false;
            if (moved) EditorManager.saveHistory('Déplacement vecteur', { patchActiveLayer: true });
            EditorManager.render();
            return;
        }

        const hadNewShape = currentElement !== null;
        if (
            hadNewShape &&
            currentElement &&
            ['rect', 'circle', 'line', 'round-3', 'triangle', 'text'].includes(tool)
        ) {
            activeVectorShape = currentElement;
            EditorManager.activeVectorSelection = [currentElement];
            window._activeVectorShapeEl = currentElement;
            generateAnchors(currentElement);
            VE.refreshSelectionUI();
            if (
                typeof window.vectorApplyLineEndpointMarkers === 'function' &&
                typeof window.illuVectorPathHasLineEndpoints === 'function' &&
                window.illuVectorPathHasLineEndpoints(currentElement)
            ) {
                window.vectorApplyLineEndpointMarkers(currentElement);
            }
        }
        if (hadNewShape || hadVectorAnchorDrag) {
            currentElement = null;
            window._illuVectorDragActive = false;
            if (typeof EditorManager.syncActiveVectorSvg === 'function') EditorManager.syncActiveVectorSvg();
            EditorManager.saveHistory('Dessin vecteur', { patchActiveLayer: true });
            if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        }
        EditorManager.render();
    } else {
        /* Ne pas confondre avec le déplacement « type Déplacer » depuis le bouton (fantôme) : au relâchement on valide le déplacement, pas finishSelectionPixelWarp. */
        if (
            window.selectionPixelWarpActive &&
            !(
                window._illuDeformMoveFromButtonActive &&
                (isMovingSelection ||
                    (EditorManager.activeLayer && moveLayerStartPos != null))
            )
        ) {
            window.finishSelectionPixelWarp();
            return;
        }

        if (isLassoSelectionTool() && lassoDrawingPoints) {
            if (lassoDrawingPoints.length < 3) {
                lassoDrawingPoints = null;
                selectionCombineBackup = null;
                window.selectionCombineGhost = null;
                if (typeof window.illuClearSelectionCombineOp === 'function') window.illuClearSelectionCombineOp();
                window.refreshSelectionVisual();
            } else {
                const pts = lassoDrawingPoints.slice();
                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;
                pts.forEach((p) => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
                const opOnUp =
                    typeof window.illuConsumeSelectionCombineOp === 'function'
                        ? window.illuConsumeSelectionCombineOp()
                        : 'new';
                const l = EditorManager.activeLayer;
                if ((opOnUp === 'add' || opOnUp === 'subtract') && l && l.buffer) {
                    const lw = l.buffer.width;
                    const lh = l.buffer.height;
                    const newM = new Uint8Array(lw * lh);
                    rasterizeDocLassoPolygonToLayerMask(pts, l.x, l.y, lw, lh, newM);
                    const oldM =
                        selectionCombineBackup != null && selectionCombineBackup.length === lw * lh
                            ? selectionCombineBackup
                            : new Uint8Array(lw * lh);
                    let minX = lw;
                    let minY = lh;
                    let maxX = 0;
                    let maxY = 0;
                    pts.forEach((p) => {
                        const lx = p.x - l.x;
                        const ly = p.y - l.y;
                        minX = Math.min(minX, lx);
                        minY = Math.min(minY, ly);
                        maxX = Math.max(maxX, lx);
                        maxY = Math.max(maxY, ly);
                    });
                    const region = {
                        x0: Math.max(0, Math.floor(minX)),
                        y0: Math.max(0, Math.floor(minY)),
                        x1: Math.min(lw, Math.ceil(maxX + 1)),
                        y1: Math.min(lh, Math.ceil(maxY + 1))
                    };
                    const combined = illuMergeMaskOpRegion(oldM, newM, lw, lh, region, opOnUp);
                    window.commitLayerMaskAsSelection(combined, lw, lh, { fromCombine: true });
                    lassoDrawingPoints = null;
                    selectionCombineBackup = null;
                    window.selectionCombineGhost = null;
                    if (typeof window.illuClearSelectionCombineOp === 'function') window.illuClearSelectionCombineOp();
                    window.refreshSelectionVisual();
                    EditorManager.render();
                } else {
                    if (typeof window.illuClearSelectionCombineOp === 'function') window.illuClearSelectionCombineOp();
                    window.selectionBounds = {
                        x: minX,
                        y: minY,
                        w: Math.max(1, Math.ceil(maxX - minX)),
                        h: Math.max(1, Math.ceil(maxY - minY))
                    };
                    window.selectionKind = 'lasso';
                    window.selectionColorMask = null;
                    window.selectionLassoPoints = pts;
                    window.selectionInverted = false;
                    window.selectionPreviewAngleRad = 0;
                    window.selectionIsWarpQuad = false;
                    lassoDrawingPoints = null;
                    selectionCombineBackup = null;
                    window.selectionCombineGhost = null;
                    window.refreshSelectionVisual();
                    // Removed saveHistory for selection action
                    EditorManager.render();
                }
            }
            if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
            return;
        }

        if (selectionBoundsResizeActive) {
            const obResize = originalSelectionBounds;
            const sbResize = window.selectionBounds;
            selectionBoundsResizeActive = false;
            selectionResizeHandle = null;
            originalSelectionBounds = null;
            originalSelectionLassoPoints = null;
            if (typeof window.illuSelectionLoupeHide === 'function') {
                window.illuSelectionLoupeHide();
            }
            if (
                window.selectionKind === 'color' &&
                typeof window.intersectColorMaskWithSelectionBounds === 'function'
            ) {
                window.intersectColorMaskWithSelectionBounds();
            }
            if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
            const appliedLayerResize =
                typeof window.applyMoveToolLayerResizeIfNeeded === 'function' &&
                window.applyMoveToolLayerResizeIfNeeded(obResize, sbResize);
            if (!appliedLayerResize && !window.illuCropSessionActive) {
                // Removed saveHistory for selection action
            } else if (window.illuCropSessionActive && typeof window.illuCropPanelSync === 'function') {
                window.illuCropPanelSync();
            }
            EditorManager.render();
            return;
        }

        if (EditorManager.isPixelMode && window.activeTool === 'gradient') {
            if (window._gradientNewDrag && typeof window.finishNewGradientDrag === 'function') {
                const ep = constrainLineEndpoint(startX, startY, pos.x, pos.y, window._shiftConstraintProportions);
                window.finishNewGradientDrag(startX, startY, ep.x, ep.y);
                window._gradientNewDrag = false;
                window._gradientHandleDrag = null;
                currentElement = null;
                return;
            }
            if (window._gradientHandleDrag !== null) {
                window._gradientHandleDrag = null;
                EditorManager.saveHistory('Dégradé ajusté', { patchActiveLayer: true });
                EditorManager.render({ flushUiThumbnails: true });
                currentElement = null;
                return;
            }
        }

        if (window._illuShapeEditMoveActive) {
            window._illuShapeEditMoveActive = false;
            window._illuShapeEditMoveStartDoc = null;
            window._illuShapeEditMoveSnapshot = null;
            if (typeof window.illuReleaseShapeEditMoveButtonPointerCapture === 'function') {
                window.illuReleaseShapeEditMoveButtonPointerCapture();
            }
            if (typeof window.flushShapeEditPreview === 'function') window.flushShapeEditPreview();
            if (typeof window.refreshPixelShapeEditOverlay === 'function') {
                window.refreshPixelShapeEditOverlay({ forceFull: true });
            }
            EditorManager.saveHistory('Déplacement forme', { patchActiveLayer: true });
            EditorManager.render({ flushUiThumbnails: true });
            isDrawing = false;
            currentElement = null;
            return;
        }

        if (EditorManager.isPixelMode && window.shapeHandleDrag !== null) {
            window.shapeHandleDrag = null;
            if (typeof window.flushShapeEditPreview === 'function') window.flushShapeEditPreview();
            if (typeof window.refreshPixelShapeEditOverlay === 'function') {
                window.refreshPixelShapeEditOverlay({ forceFull: true });
            }
            EditorManager.saveHistory('Forme ajustée', { patchActiveLayer: true });
            EditorManager.render({ flushUiThumbnails: true });
            currentElement = null;
            return;
        }

        if (illuPixelMoveOrDeformTool() && !isMovingSelection && EditorManager.activeLayer && moveLayerStartPos) {
            const l = EditorManager.activeLayer;
            const p0 = moveLayerStartPos;
            moveLayerStartPos = null;
            moveLayerStartLassoPoints = null;
            let ghostEl = moveLayerWholeGhostEl;
            if (ghostEl) {
                const nx = parseFloat(ghostEl.style.left) || (l.importPlacementPending ? l.importStagingX : l.x);
                const ny = parseFloat(ghostEl.style.top) || (l.importPlacementPending ? l.importStagingY : l.y);
                if (l.importPlacementPending && l.importStagingBuffer) {
                    l.importStagingX = Math.round(nx);
                    l.importStagingY = Math.round(ny);
                } else {
                    l.x = Math.round(nx);
                    l.y = Math.round(ny);
                }
            }
            if (l._ghostDragHide) delete l._ghostDragHide;
            /* Invalide le cache du filtre dynamique asynchrone pour que le render final
               recalcule le filtre à la position définitive du calque. */
            if (l._dynAsyncKey != null) l._dynAsyncKey = null;
            if (l._dynAsyncPendingKey != null) l._dynAsyncPendingKey = null;
            if (window.selectionPixelWarpActive && typeof window.runSelectionWarpPreview === 'function') {
                window.runSelectionWarpPreview({ forceCommit: true });
            }
            if (l.importPlacementPending && l.importStagingBuffer) {
                if (typeof window.syncSelectionToImportPlacementLayer === 'function') {
                    window.syncSelectionToImportPlacementLayer();
                }
            } else if (l.x !== p0.x || l.y !== p0.y) {
                EditorManager.saveHistory('Déplacement calque', { patchActiveLayer: true });
            }
            window._illuDeformMoveFromButtonActive = false;
            illuSelectionInteractionOwner = null;
            EditorManager.render({ flushUiThumbnails: true });
            if (ghostEl && ghostEl.parentNode) ghostEl.remove();
            moveLayerWholeGhostEl = null;
            return;
        }

        if (!ctx) {
            if (deformWarpNewRectDrag) {
                deformWarpNewRectDrag = false;
            }
            if (illuPixelMoveOrDeformTool()) {
                illuResetMoveSelectionDragArtifacts();
                moveLayerStartPos = null;
                moveLayerStartLassoPoints = null;
                window._illuDeformMoveFromButtonActive = false;
            }
            return;
        }

        if (illuPixelMoveOrDeformTool() && isMovingSelection) {
            const sb = window.selectionBounds;
            const lx = EditorManager.activeLayer.x;
            const ly = EditorManager.activeLayer.y;
            if (
                window.selectionKind === 'color' &&
                moveDragBoundsStart &&
                window.selectionColorMask &&
                EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
            ) {
                const dx = Math.round(sb.x - moveDragBoundsStart.x);
                const dy = Math.round(sb.y - moveDragBoundsStart.y);
                const m = window.selectionColorMask;
                m.data = translateSelectionColorMask(m.data, m.w, m.h, dx, dy);
            }
            ctx.save();
            ctx.beginPath();
            if (
                window.selectionKind === 'color' &&
                window.selectionColorMask &&
                EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
            ) {
                EditorManager.appendColorMaskRectsToPath(ctx, window.selectionColorMask);
            } else if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
                window.selectionLassoPoints.forEach((p, i) => {
                    const px = p.x - lx;
                    const py = p.y - ly;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.closePath();
            } else {
                ctx.rect(sb.x - lx, sb.y - ly, sb.w, sb.h);
            }
            ctx.clip();
            const placeX = Math.round(sb.x - lx);
            const placeY = Math.round(sb.y - ly);
            const useSmooth = document.getElementById('tool-warp-resampling')?.value !== 'nearest';
            ctx.imageSmoothingEnabled = useSmooth;
            ctx.drawImage(moveBufferCanvas, placeX, placeY);
            ctx.restore();
            if (window.selectionPixelWarpActive && typeof window.runSelectionWarpPreview === 'function') {
                window.runSelectionWarpPreview({ forceCommit: true });
            }
            moveSelectionLayerSnapshot = null;
            if (EditorManager.activeLayer && EditorManager.activeLayer._movePixelsHoleCleared) {
                delete EditorManager.activeLayer._movePixelsHoleCleared;
            }
            illuSelectionInteractionOwner = null;
            isMovingSelection = false;
            moveDragBoundsStart = null;
            moveDragLassoBaseline = null;
            window._illuDeformMoveFromButtonActive = false;
            if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
            EditorManager.saveHistory('Déplacement pixel', { patchActiveLayer: true });
            EditorManager.render({ flushUiThumbnails: true });
            if (moveGhostLayer) moveGhostLayer.remove();
            moveGhostLayer = null;
        } else if (deformWarpNewRectDrag || isRectSelectionTool()) {
            const wasDeformWarpNewRectDrag = deformWarpNewRectDrag;
            if (isRectSelectionTool()) {
                ctx.restore();
            }
            let sbr = window.selectionBounds;
            const opOnUp =
                typeof window.illuConsumeSelectionCombineOp === 'function'
                    ? window.illuConsumeSelectionCombineOp()
                    : 'new';
            sbr = illuFinalizeRectSelectionBounds(sbr, startX, startY);
            window.selectionBounds = sbr;
            if (!illuSelectionBigEnough(sbr)) {
                window.selectionBounds = null;
                window.selectionLassoPoints = null;
                window.selectionKind = 'rect';
                window.selectionColorMask = null;
                window.selectionInverted = false;
                window.selectionPreviewAngleRad = 0;
                selectionCombineBackup = null;
                window.selectionCombineGhost = null;
                if (typeof window.illuClearSelectionCombineOp === 'function') window.illuClearSelectionCombineOp();
                if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
            } else if (opOnUp === 'add' || opOnUp === 'subtract') {
                const l = EditorManager.activeLayer;
                if (l && l.buffer) {
                    const lw = l.buffer.width;
                    const lh = l.buffer.height;
                    const newM = new Uint8Array(lw * lh);
                    rasterizeDocAlignedRectToLayerMask(sbr, l.x, l.y, lw, lh, newM);
                    const oldM =
                        selectionCombineBackup != null && selectionCombineBackup.length === lw * lh
                            ? selectionCombineBackup
                            : new Uint8Array(lw * lh);
                    const rNew = illuLayerRectFromDocBounds(sbr, l.x, l.y, lw, lh);
                    const rOld = window.selectionCombineGhost && window.selectionCombineGhost.sb
                        ? illuLayerRectFromDocBounds(window.selectionCombineGhost.sb, l.x, l.y, lw, lh)
                        : rNew;
                    const region = {
                        x0: Math.min(rNew.x0, rOld.x0),
                        y0: Math.min(rNew.y0, rOld.y0),
                        x1: Math.max(rNew.x1, rOld.x1),
                        y1: Math.max(rNew.y1, rOld.y1)
                    };
                    const combined = illuMergeMaskOpRegion(oldM, newM, lw, lh, region, opOnUp);
                    window.commitLayerMaskAsSelection(combined, lw, lh, { fromCombine: true });
                }
            } else {
                if (typeof window.illuClearSelectionCombineOp === 'function') window.illuClearSelectionCombineOp();
            }
            selectionCombineBackup = null;
            window.selectionCombineGhost = null;
            
            // Quad 4 coins : mode armé (sélection rect.) ou nouveau cadre avec l’outil warp-4
            if (opOnUp === 'new' && illuSelectionBigEnough(sbr)) {
                const toQuadFromArm =
                    EditorManager.toolProps.selectionRectFreeCornersArm && window.selectionKind === 'rect';
                const toQuadFromWarp4 =
                    (window.activeTool === 'warp-4' || window.activeTool === 'deform') &&
                    (wasDeformWarpNewRectDrag || window.selectionKind === 'rect');
                if (toQuadFromArm || toQuadFromWarp4) {
                    window.illuSyncWarpQuadPointsFromBounds(sbr);
                    EditorManager.toolProps.selectionRectFreeCornersArm = false;
                    if (typeof window.syncSelectionRectFreeCornersArmUI === 'function') {
                        window.syncSelectionRectFreeCornersArmUI();
                    }
                }
            }

            deformWarpNewRectDrag = false;
            if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
            if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            EditorManager.render();
        } else if (['rect', 'circle', 'line', 'round-3', 'triangle'].includes(window.activeTool)) {
            drawFinalShapeOnCanvas(pos, e.shiftKey);
            ctx.restore();
            EditorManager.saveHistory('Dessin pixel', { patchActiveLayer: true });
            EditorManager.render({ flushUiThumbnails: true });
        } else if (['brush', 'pencil', 'eraser'].includes(window.activeTool)) {
            if (ctx) {
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            }
            if (
                window.activeTool === 'brush' &&
                isStampBrushStroke &&
                EditorManager.toolProps.pencilAutoClose &&
                pencilStrokePoints &&
                pencilStrokePoints.length >= 2 &&
                !isSprayStroke
            ) {
                const fp = pencilStrokePoints[0];
                const lp = pencilStrokePoints[pencilStrokePoints.length - 1];
                stampBrushSegment(ctx, 'brush', lp.x, lp.y, fp.x, fp.y);
            } else if (
                window.activeTool === 'pencil' &&
                isPencilPixelStroke &&
                EditorManager.toolProps.pencilAutoClose &&
                pencilStrokePoints &&
                pencilStrokePoints.length >= 2
            ) {
                const fp = pencilStrokePoints[0];
                const lp = pencilStrokePoints[pencilStrokePoints.length - 1];
                illuPencilSegment(
                    ctx,
                    lp.x,
                    lp.y,
                    fp.x,
                    fp.y,
                    EditorManager.toolProps.size || 1,
                    EditorManager.activeColor
                );
            } else if (
                window.activeTool === 'brush' &&
                !isStampBrushStroke &&
                EditorManager.toolProps.pencilAutoClose &&
                pencilStrokePoints &&
                pencilStrokePoints.length >= 2 &&
                !isSprayStroke
            ) {
                const fp = pencilStrokePoints[0];
                ctx.beginPath();
                ctx.moveTo(pencilStrokePoints[pencilStrokePoints.length - 1].x, pencilStrokePoints[pencilStrokePoints.length - 1].y);
                ctx.lineTo(fp.x, fp.y);
                ctx.stroke();
            }
            pencilStrokePoints = null;
            isSprayStroke = false;
            isStampBrushStroke = false;
            isPencilPixelStroke = false;
            ctx.restore();
            if (typeof EditorManager.commitStrokeIntermediate === 'function') {
                EditorManager.commitStrokeIntermediate();
            }
            EditorManager.saveHistory('Dessin pixel', { patchActiveLayer: true });
            EditorManager.render({ flushUiThumbnails: true });
        } else if (
            window.activeTool !== 'select' &&
            window.activeTool !== 'direct-select' &&
            window.activeTool !== 'move' &&
            !isPixelWarpOrDeformTool() &&
            window.activeTool !== 'fill'
        ) {
            ctx.restore();
            EditorManager.render();
        }
    }
    currentElement = null;
    if (ctx) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
}

window.illuHandleMouseUp = handleMouseUp;

window.clearSelectionContent = function () {
    const canErase =
        typeof window.hasActivePixelSelection === 'function' && window.hasActivePixelSelection();
    const hasOutline =
        typeof window.illuPixelSelectionPresent === 'function' && window.illuPixelSelectionPresent();
    if (!canErase && !hasOutline) return false;

    if (canErase && EditorManager.isPixelMode) {
        const actx = EditorManager.activeCtx;
        if (actx && (window.selectionBounds || window.selectionColorMask || window.selectionLassoPoints)) {
            clearActiveSelectionPixelsOnLayer(actx);
            EditorManager.saveHistory('Effacer sélection', { patchActiveLayer: true });
            EditorManager.render();
        }
    }
    if (typeof EditorManager.deselectAll === 'function') {
        EditorManager.deselectAll();
    } else if (selectionOverlay) {
        selectionOverlay.style.display = 'none';
        window.selectionBounds = null;
        window.selectionInverted = false;
        window.selectionKind = 'rect';
        window.selectionColorMask = null;
        window.selectionLassoPoints = null;
        window.selectionIsWarpQuad = false;
        window.selectionPreviewAngleRad = 0;
    }
    return true;
};

/** Suppr / Retour arrière : objet vecteur sélectionné ou contenu de la sélection pixel. */
window.deleteActiveVectorOrPixelSelection = function () {
    if (EditorManager.mode === 'vector' && activeVectorShape) {
        const el = activeVectorShape;
        if (el.parentNode) el.parentNode.removeChild(el);
        clearAnchors();
        activeVectorShape = null;
        window._activeVectorShapeEl = null;
        EditorManager.syncActiveVectorSvg();
        EditorManager.saveHistory('Suppression vecteur', { patchActiveLayer: true });
        EditorManager.render();
        return true;
    }
    if (!EditorManager.isPixelMode) return false;

    const hasOutline =
        typeof window.illuPixelSelectionPresent === 'function' && window.illuPixelSelectionPresent();

    if (!hasOutline) return false;

    // S'il y a un contour de sélection en mode pixel, la touche Suppr/Retour arrière efface toujours son contenu !
    return !!window.clearSelectionContent();
};

/**
 * Raccourcit le segment de trait pour laisser la place aux flèches / losanges
 * (même échelle W que drawPixelLineEndpointDecor).
 */
function trimLineSegmentForPixelCaps(x1, y1, x2, y2, strokeW, startCap, endCap) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return { x1, y1, x2, y2 };
    const ux = dx / L;
    const uy = dy / L;
    const W = Math.max(4, strokeW * 2.5);
    let inset1 = startCap === 'arrow' || startCap === 'diamond' ? W : 0;
    let inset2 = endCap === 'arrow' || endCap === 'diamond' ? W : 0;
    const maxTrim = L * 0.48;
    if (inset1 + inset2 > maxTrim) {
        const s = maxTrim / (inset1 + inset2);
        inset1 *= s;
        inset2 *= s;
    }
    return {
        x1: x1 + ux * inset1,
        y1: y1 + uy * inset1,
        x2: x2 - ux * inset2,
        y2: y2 - uy * inset2
    };
}

window.illuTrimLineSegmentForPixelCaps = trimLineSegmentForPixelCaps;

function drawPixelLineEndpointDecor(ctx, x1, y1, x2, y2, strokeW, color, startCap, endCap) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const W = Math.max(4, strokeW * 2.5);
    const drawPoly = (x, y, rot, cap) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.translate(x, y);
        ctx.rotate(rot);
        if (cap === 'arrow') {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-W, -W * 0.42);
            ctx.lineTo(-W, W * 0.42);
            ctx.closePath();
            ctx.fill();
        } else if (cap === 'diamond') {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-W * 0.5, -W * 0.38);
            ctx.lineTo(-W, 0);
            ctx.lineTo(-W * 0.5, W * 0.38);
            ctx.closePath();
            ctx.fill();
        } else if (cap === 'round') {
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1.2, strokeW * 0.55), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    };
    const s0 = startCap || 'none';
    const s1 = endCap || 'none';
    const bothRound = s0 === 'round' && s1 === 'round';
    if (s0 === 'arrow' || s0 === 'diamond' || (!bothRound && s0 === 'round')) drawPoly(x1, y1, ang + Math.PI, s0);
    if (s1 === 'arrow' || s1 === 'diamond' || (!bothRound && s1 === 'round')) drawPoly(x2, y2, ang, s1);
}

window.illuDrawPixelLineEndpointDecor = drawPixelLineEndpointDecor;

function makeShapeSecondaryColor() {
    return EditorManager.secondaryColor
        ? typeof EditorManager.cssRgbaFromPart === 'function'
            ? EditorManager.cssRgbaFromPart(EditorManager.secondaryColor)
            : `rgba(${EditorManager.secondaryColor.r},${EditorManager.secondaryColor.g},${EditorManager.secondaryColor.b},${(EditorManager.secondaryColor.a != null ? EditorManager.secondaryColor.a : 255) / 255
            })`
        : '#ffffff';
}

window.makeShapeSecondaryColor = makeShapeSecondaryColor;
window.shapeSecondaryFillCss = makeShapeSecondaryColor;

window.illuGetGradientMethod = function () {
    const el = document.getElementById('tool-gradient-method');
    if (el && el.value) return el.value;
    if (typeof EditorManager !== 'undefined' && EditorManager.toolProps && EditorManager.toolProps.gradientMethod) {
        return EditorManager.toolProps.gradientMethod;
    }
    return 'simple';
};

window.illuParseColorToRgb = function (c) {
    if (!c) return { r: 255, g: 255, b: 255, a: 255 };
    if (typeof c === 'object') {
        return {
            r: c.r ?? 255,
            g: c.g ?? 255,
            b: c.b ?? 255,
            a: c.a != null ? c.a : 255
        };
    }
    if (typeof c === 'string') {
        const trimmed = c.trim().toLowerCase();
        if (trimmed.startsWith('#')) {
            let h = trimmed.replace(/^#/, '');
            if (h.length === 3) h = h.split('').map((x) => x + x).join('');
            const n = parseInt(h, 16);
            if (!Number.isNaN(n)) {
                return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
            }
        }
        if (trimmed.startsWith('rgb')) {
            const parts = trimmed.match(/[\d.]+/g);
            if (parts && parts.length >= 3) {
                return {
                    r: parseInt(parts[0], 10),
                    g: parseInt(parts[1], 10),
                    b: parseInt(parts[2], 10),
                    a: parts[3] != null ? Math.round(parseFloat(parts[3]) * 255) : 255
                };
            }
        }
    }
    return { r: 255, g: 255, b: 255, a: 255 };
};

window.illuApplyGradientColorStops = function (grad, c0, c1, method) {
    const m = method || window.illuGetGradientMethod();
    if (
        m === 'smart' &&
        typeof EditorManager !== 'undefined' &&
        typeof EditorManager.rgbToHsv === 'function' &&
        typeof EditorManager.hsvToRgb === 'function'
    ) {
        const rgb0 = window.illuParseColorToRgb(c0);
        const rgb1 = window.illuParseColorToRgb(c1);
        const hsv0 = EditorManager.rgbToHsv(rgb0.r, rgb0.g, rgb0.b);
        const hsv1 = EditorManager.rgbToHsv(rgb1.r, rgb1.g, rgb1.b);
        let h0 = hsv0.h;
        let h1 = hsv1.h;
        let dh = h1 - h0;
        if (dh > 180) h1 -= 360;
        else if (dh < -180) h1 += 360;
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const h = (h0 + t * (h1 - h0) + 360) % 360;
            const s = hsv0.s + t * (hsv1.s - hsv0.s);
            const v = hsv0.v + t * (hsv1.v - hsv0.v);
            const rgb = EditorManager.hsvToRgb(h, s, v);
            const a = rgb0.a * (1 - t) + rgb1.a * t;
            grad.addColorStop(t, `rgba(${rgb.r},${rgb.g},${rgb.b},${a / 255})`);
        }
    } else {
        grad.addColorStop(0, c0);
        grad.addColorStop(1, c1);
    }
    return grad;
};

window.illuCssLinearGradientImage = function (c0, c1, angleDeg, method) {
    const m = method || window.illuGetGradientMethod();
    const ang = angleDeg != null ? angleDeg : 0;
    if (m === 'smart' && typeof EditorManager !== 'undefined' && EditorManager.rgbToHsv) {
        const rgb0 = window.illuParseColorToRgb(c0);
        const rgb1 = window.illuParseColorToRgb(c1);
        const hsv0 = EditorManager.rgbToHsv(rgb0.r, rgb0.g, rgb0.b);
        const hsv1 = EditorManager.rgbToHsv(rgb1.r, rgb1.g, rgb1.b);
        let h0 = hsv0.h;
        let h1 = hsv1.h;
        let dh = h1 - h0;
        if (dh > 180) h1 -= 360;
        else if (dh < -180) h1 += 360;
        const stops = [];
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const h = (h0 + t * (h1 - h0) + 360) % 360;
            const s = hsv0.s + t * (hsv1.s - hsv0.s);
            const v = hsv0.v + t * (hsv1.v - hsv0.v);
            const rgb = EditorManager.hsvToRgb(h, s, v);
            const a = rgb0.a * (1 - t) + rgb1.a * t;
            stops.push(`rgba(${rgb.r},${rgb.g},${rgb.b},${a / 255}) ${Math.round(t * 100)}%`);
        }
        return `linear-gradient(${ang}deg, ${stops.join(', ')})`;
    }
    return `linear-gradient(${ang}deg, ${c0}, ${c1})`;
};

window.illuGetTextGradType = function () {
    const el = document.getElementById('tool-text-grad-type');
    if (el && el.value) return el.value === 'radial' ? 'radial' : 'linear';
    if (typeof EditorManager !== 'undefined' && EditorManager.toolProps) {
        return EditorManager.toolProps.textGradType === 'radial' ? 'radial' : 'linear';
    }
    return 'linear';
};

window.illuGetTextGradAngle = function () {
    if (typeof EditorManager !== 'undefined' && EditorManager.toolProps) {
        return EditorManager.toolProps.textGradAngle ?? 0;
    }
    const el = document.getElementById('tool-text-grad-angle');
    return el ? parseInt(el.value, 10) || 0 : 0;
};

window.illuCreateTextFillGradient = function (ctx, x0, y0, w, h, c0, c1) {
    const gradType = window.illuGetTextGradType();
    const cx = x0 + w / 2;
    const cy = y0 + h / 2;
    const rw = Math.max(w / 2, 4);
    const rh = Math.max(h / 2, 4);
    let grad;
    if (gradType === 'radial') {
        grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rw, rh));
    } else {
        const angleDeg = window.illuGetTextGradAngle();
        const rad = (angleDeg * Math.PI) / 180;
        const L = Math.max(rw, rh) * 1.6;
        grad = ctx.createLinearGradient(
            cx - Math.cos(rad) * L,
            cy - Math.sin(rad) * L,
            cx + Math.cos(rad) * L,
            cy + Math.sin(rad) * L
        );
    }
    if (typeof window.illuApplyGradientColorStops === 'function') {
        window.illuApplyGradientColorStops(grad, c0, c1);
    } else {
        grad.addColorStop(0, c0);
        grad.addColorStop(1, c1);
    }
    return grad;
};

window.illuCssTextGradientImage = function (c0, c1) {
    const gradType = window.illuGetTextGradType();
    const method = window.illuGetGradientMethod();
    if (gradType === 'radial') {
        if (
            method === 'smart' &&
            typeof EditorManager !== 'undefined' &&
            EditorManager.rgbToHsv &&
            typeof window.illuParseColorToRgb === 'function'
        ) {
            const rgb0 = window.illuParseColorToRgb(c0);
            const rgb1 = window.illuParseColorToRgb(c1);
            const hsv0 = EditorManager.rgbToHsv(rgb0.r, rgb0.g, rgb0.b);
            const hsv1 = EditorManager.rgbToHsv(rgb1.r, rgb1.g, rgb1.b);
            let h0 = hsv0.h;
            let h1 = hsv1.h;
            const dh = h1 - h0;
            if (dh > 180) h1 -= 360;
            else if (dh < -180) h1 += 360;
            const stops = [];
            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                const h = (h0 + t * (h1 - h0) + 360) % 360;
                const s = hsv0.s + t * (hsv1.s - hsv0.s);
                const v = hsv0.v + t * (hsv1.v - hsv0.v);
                const rgb = EditorManager.hsvToRgb(h, s, v);
                const a = rgb0.a * (1 - t) + rgb1.a * t;
                stops.push(`rgba(${rgb.r},${rgb.g},${rgb.b},${a / 255}) ${Math.round(t * 100)}%`);
            }
            return `radial-gradient(ellipse at center, ${stops.join(', ')})`;
        }
        return `radial-gradient(ellipse at center, ${c0}, ${c1})`;
    }
    const angleDeg = window.illuGetTextGradAngle();
    if (typeof window.illuCssLinearGradientImage === 'function') {
        return window.illuCssLinearGradientImage(c0, c1, angleDeg, method);
    }
    return `linear-gradient(${angleDeg}deg, ${c0}, ${c1})`;
};

function createShapeFillGradient(ctx, kind, lx, ly, w, h, lsx, lsy, rx, ry, lpx, lpy) {
    const gradShapeType = document.getElementById('tool-shape-grad-type')?.value || 'linear';
    const angleDeg = EditorManager.toolProps.shapeGradAngle ?? 0;
    const rad = (angleDeg * Math.PI) / 180;
    const sec = shapeSecondaryStrokeCss();
    const c1 = shapePrimaryFillCss();

    if (kind === 'line') {
        const lc = shapeLineStrokeCss();
        const g = ctx.createLinearGradient(lsx, lsy, lpx, lpy);
        g.addColorStop(0, lc);
        g.addColorStop(1, lc);
        return g;
    }

    const cx = kind === 'rect' ? lx + w / 2 : lsx;
    const cy = kind === 'rect' ? ly + h / 2 : lsy;
    const rrx = kind === 'rect' ? w / 2 : rx;
    const rry = kind === 'rect' ? h / 2 : ry;

    if (gradShapeType === 'linear') {
        const L = Math.max(rrx, rry, Math.hypot(w || rx * 2, h || ry * 2) / 2, 4) * 1.6;
        const g = ctx.createLinearGradient(
            cx - Math.cos(rad) * L,
            cy - Math.sin(rad) * L,
            cx + Math.cos(rad) * L,
            cy + Math.sin(rad) * L
        );
        window.illuApplyGradientColorStops(g, c1, sec);
        return g;
    }
    const rmax = Math.max(rrx, rry, 2);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rmax);
    window.illuApplyGradientColorStops(g, c1, sec);
    return g;
}

function computeLiveShapeDocBounds(pos, startXp, startYp, shiftKey) {
    const tool = window.activeTool;
    let x0 = Math.min(pos.x, startXp);
    let y0 = Math.min(pos.y, startYp);
    let w = Math.abs(pos.x - startXp);
    let h = Math.abs(pos.y - startYp);
    if ((tool === 'rect' || tool === 'round-3' || tool === 'triangle' || tool === 'circle') && shiftKey) {
        const b = constrainRectSelectionDraw(startXp, startYp, pos.x, pos.y, true);
        x0 = b.x;
        y0 = b.y;
        w = b.w;
        h = b.h;
    }
    return { x: x0, y: y0, w, h };
}

window.getLiveShapeDocBounds = computeLiveShapeDocBounds;

window.illuIsShapeLiveDrawSession = function () {
    return !!(
        isDrawing &&
        window._shapeBackupCanvas &&
        SHAPE_LIVE_DRAW_TOOLS.includes(window.activeTool || '')
    );
};

function getShapePreviewRotationPivotDoc(mode) {
    if (!EditorManager.activeLayer) return null;
    const lx = EditorManager.activeLayer.x;
    const ly = EditorManager.activeLayer.y;
    if (mode === 'edit' && window.pixelShapeEdit) {
        const ed = window.pixelShapeEdit;
        if (ed.kind === 'ellipse') {
            return { cx: ed.cx + lx, cy: ed.cy + ly };
        }
        if (ed.lx != null && ed.w != null && ed.h != null) {
            return { cx: ed.lx + ed.w / 2 + lx, cy: ed.ly + ed.h / 2 + ly };
        }
        return null;
    }
    if (mode === 'live' && window._shapeBackupCanvas) {
        const pos = window._illuLastPointerDoc || { x: startX, y: startY };
        const b = computeLiveShapeDocBounds(pos, startX, startY, !!window._shiftConstraintProportions);
        if (b.w < 2 || b.h < 2) return null;
        return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
    }
    return null;
}

function startShapePreviewRotationDrag(pos, mode) {
    const pivot = getShapePreviewRotationPivotDoc(mode);
    if (!pivot) return false;
    window._shapeRotDragMode = mode;
    window._shapeRotDragActive = true;
    shapeLiveRotateStartPointerAngle = Math.atan2(pos.y - pivot.cy, pos.x - pivot.cx);
    shapeLiveRotateStartPreview =
        mode === 'edit'
            ? window.pixelShapeEdit.angleRad || 0
            : window._shapeLivePreviewAngleRad || 0;
    isDrawing = true;
    return true;
}

function tryStartShapePreviewRotationFromPointer(e, pos) {
    const ph = readPixelHandleAttr(e);
    if (ph === 'shape-rot') {
        if (window.pixelShapeEdit && ['rect', 'roundrect', 'triangle', 'ellipse'].includes(window.pixelShapeEdit.kind)) {
            e.preventDefault();
            e.stopPropagation();
            return startShapePreviewRotationDrag(pos, 'edit');
        }
        if (window._shapeBackupCanvas && SHAPE_LIVE_DRAW_TOOLS.includes(window.activeTool || '')) {
            e.preventDefault();
            e.stopPropagation();
            return startShapePreviewRotationDrag(pos, 'live');
        }
    }
    if (
        typeof window.hitShapeLiveRotationHandle === 'function' &&
        window.hitShapeLiveRotationHandle(pos.x, pos.y)
    ) {
        e.preventDefault();
        e.stopPropagation();
        if (window.pixelShapeEdit) {
            return startShapePreviewRotationDrag(pos, 'edit');
        }
        return startShapePreviewRotationDrag(pos, 'live');
    }
    return false;
}

/**
 * Dessine la forme pixel courante (rect / cercle / ligne / coins arrondis) sur le contexte calque.
 * @returns {{ kind: string, params: object, opts: object } | null} métadonnées pour captureShapeEditAfterDraw
 */
function paintPixelShapeAt(ctx, pos, startXp, startYp, shiftKey, angleRad) {
    if (!ctx || !EditorManager.activeLayer) return null;
    const shift = !!shiftKey;
    const mode = EditorManager.toolProps.shapeStrokeMode || 'both';
    const fillType = EditorManager.toolProps.fillType || 'solid';
    const strokeW = Math.max(1, EditorManager.toolProps.size || 2);
    const fillCss = shapePrimaryFillCss();
    const strokeCss =
        window.activeTool === 'line' ? shapeLineStrokeCss() : shapeSecondaryStrokeCss();
    ctx.lineWidth = strokeW;
    ctx.save();

    const ang = angleRad || 0;
    if (Math.abs(ang) > 1e-8) {
        const b = computeLiveShapeDocBounds(pos, startXp, startYp, shift);
        const cx = b.x + b.w / 2 - EditorManager.activeLayer.x;
        const cy = b.y + b.h / 2 - EditorManager.activeLayer.y;
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.translate(-cx, -cy);
    }

    const applyShapeFillStyle = () => {
        if (EditorManager.activeProject && EditorManager.activeProject.mode === 'pixel-dither') {
            const canv = EditorManager._ditherPatternCanvases[EditorManager.activeDitherPatternId];
            if (canv) {
                const pat = ctx.createPattern(canv, 'repeat');
                ctx.fillStyle = pat;
                return;
            }
        }
        ctx.fillStyle = fillCss;
    };
    const applyShapeStrokeStyle = () => {
        ctx.strokeStyle = strokeCss;
    };

    let w = Math.abs(pos.x - startXp);
    let h = Math.abs(pos.y - startYp);
    let lx = Math.min(pos.x, startXp) - EditorManager.activeLayer.x;
    let ly = Math.min(pos.y, startYp) - EditorManager.activeLayer.y;
    if ((window.activeTool === 'rect' || window.activeTool === 'round-3' || window.activeTool === 'triangle') && shift) {
        const b = constrainRectSelectionDraw(startXp, startYp, pos.x, pos.y, true);
        w = b.w;
        h = b.h;
        lx = b.x - EditorManager.activeLayer.x;
        ly = b.y - EditorManager.activeLayer.y;
    }
    const lsx = startXp - EditorManager.activeLayer.x;
    const lsy = startYp - EditorManager.activeLayer.y;
    let endDocX = pos.x;
    let endDocY = pos.y;
    if (window.activeTool === 'line' && shift) {
        const ep = constrainLineEndpoint(startXp, startYp, pos.x, pos.y, true);
        endDocX = ep.x;
        endDocY = ep.y;
    }
    const lpx = endDocX - EditorManager.activeLayer.x;
    const lpy = endDocY - EditorManager.activeLayer.y;

    const doFill = mode !== 'stroke' && fillType !== 'none';
    const doStroke = mode !== 'fill';

    const opts = {
        strokeMode: mode,
        fillType,
        gradType: document.getElementById('tool-shape-grad-type')?.value || 'linear',
        gradMethod: typeof window.illuGetGradientMethod === 'function' ? window.illuGetGradientMethod() : 'simple',
        gradAngle: EditorManager.toolProps.shapeGradAngle ?? 0,
        strokeWidth: strokeW
    };

    if (window.activeTool === 'rect') {
        if (doFill) {
            if (fillType === 'gradient') {
                ctx.fillStyle = createShapeFillGradient(ctx, 'rect', lx, ly, w, h, lsx, lsy, 0, 0, lpx, lpy);
            } else {
                applyShapeFillStyle();
            }
            ctx.fillRect(lx, ly, w, h);
        }
        if (doStroke) {
            applyShapeStrokeStyle();
            ctx.strokeRect(lx, ly, w, h);
        }
        return { kind: 'rect', params: { lx, ly, w, h }, opts };
    }
    if (window.activeTool === 'circle') {
        let x0 = Math.min(pos.x, startXp);
        let y0 = Math.min(pos.y, startYp);
        let x1 = Math.max(pos.x, startXp);
        let y1 = Math.max(pos.y, startYp);
        if (shift) {
            const b = constrainRectSelectionDraw(startXp, startYp, pos.x, pos.y, true);
            x0 = b.x;
            y0 = b.y;
            x1 = b.x + b.w;
            y1 = b.y + b.h;
        }
        const rw = (x1 - x0) / 2;
        const rh = (y1 - y0) / 2;
        const ecxDoc = x0 + rw;
        const ecyDoc = y0 + rh;
        const ecx = ecxDoc - EditorManager.activeLayer.x;
        const ecy = ecyDoc - EditorManager.activeLayer.y;
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, Math.max(0, rw), Math.max(0, rh), 0, 0, Math.PI * 2);
        if (doFill) {
            if (fillType === 'gradient') {
                ctx.fillStyle = createShapeFillGradient(ctx, 'ellipse', ecx - rw, ecy - rh, rw * 2, rh * 2, ecx, ecy, rw, rh, lpx, lpy);
            } else {
                applyShapeFillStyle();
            }
            ctx.fill();
        }
        if (doStroke) {
            applyShapeStrokeStyle();
            ctx.stroke();
        }
        return { kind: 'ellipse', params: { cx: ecx, cy: ecy, rx: rw, ry: rh }, opts };
    }
    if (window.activeTool === 'line') {
        const cap0 = EditorManager.toolProps.lineCapStart || 'none';
        const cap1 = EditorManager.toolProps.lineCapEnd || 'none';
        const bothRound = cap0 === 'round' && cap1 === 'round';
        ctx.lineCap = bothRound ? 'round' : 'butt';
        const tr = trimLineSegmentForPixelCaps(lsx, lsy, lpx, lpy, strokeW, cap0, cap1);
        ctx.beginPath();
        ctx.moveTo(tr.x1, tr.y1);
        ctx.lineTo(tr.x2, tr.y2);
        if (doStroke) {
            ctx.strokeStyle = fillType === 'gradient'
                ? createShapeFillGradient(ctx, 'line', 0, 0, 0, 0, lsx, lsy, 0, 0, lpx, lpy)
                : strokeCss;
            if (fillType !== 'gradient') applyShapeStrokeStyle();
            ctx.stroke();
            drawPixelLineEndpointDecor(ctx, lsx, lsy, lpx, lpy, strokeW, strokeCss, cap0, cap1);
        }
        return { kind: 'line', params: { x1: lsx, y1: lsy, x2: lpx, y2: lpy }, opts };
    }
    if (window.activeTool === 'round-3') {
        const want = EditorManager.toolProps.shapeCornerRadius ?? 12;
        const rInt = Math.round(clampRoundRectCornerRadius(want, w, h));
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(lx, ly, w, h, rInt);
        } else {
            ctx.rect(lx, ly, w, h);
        }
        if (doFill) {
            if (fillType === 'gradient') {
                ctx.fillStyle = createShapeFillGradient(ctx, 'rect', lx, ly, w, h, lsx, lsy, 0, 0, lpx, lpy);
            } else {
                applyShapeFillStyle();
            }
            ctx.fill();
        }
        if (doStroke) {
            applyShapeStrokeStyle();
            ctx.stroke();
        }
        return { kind: 'roundrect', params: { lx, ly, w, h, r: rInt }, opts };
    }
    if (window.activeTool === 'triangle') {
        const adj = 0.5;
        const vf = 0;
        const ax = lx + w * adj;
        const ay = ly + h * vf;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(lx, ly + h);
        ctx.lineTo(lx + w, ly + h);
        ctx.closePath();
        if (doFill) {
            if (fillType === 'gradient') {
                ctx.fillStyle = createShapeFillGradient(ctx, 'rect', lx, ly, w, h, lsx, lsy, 0, 0, lpx, lpy);
            } else {
                applyShapeFillStyle();
            }
            ctx.fill();
        }
        if (doStroke) {
            applyShapeStrokeStyle();
            ctx.stroke();
        }
        return { kind: 'triangle', params: { lx, ly, w, h, adj, vf: 0 }, opts };
    }
    return null;
}

function drawFinalShapeOnCanvas(pos, shiftKey) {
    const ctx = EditorManager.activeCtx;
    if (!ctx || !EditorManager.activeLayer) return;
    const buf = EditorManager.activeLayer.buffer;
    if (window._shapeBackupCanvas) {
        ctx.clearRect(0, 0, buf.width, buf.height);
        ctx.drawImage(window._shapeBackupCanvas, 0, 0);
    }
    const meta = paintPixelShapeAt(ctx, pos, startX, startY, shiftKey, window._shapeLivePreviewAngleRad || 0);
    if (meta && typeof window.captureShapeEditAfterDraw === 'function') {
        window.captureShapeEditAfterDraw(meta.kind, meta.params, meta.opts, window._shapeLivePreviewAngleRad || 0);
    }
    window._shapeLivePreviewAngleRad = 0;
    window._shapeRotDragActive = false;
    window._shapeRotDragMode = null;
    if (typeof EditorManager.clearShapePreviewOverlay === 'function') {
        EditorManager.clearShapePreviewOverlay();
    }
}

/**
 * Clôture les interactions pixel en cours (dégradé, formes avec poignées, texte, tracé de sélection, courbe 3 pts).
 * @returns {boolean} true si une action a terminé une session (Échap / Ctrl+D peuvent éviter la désélection globale).
 */
window.finalizePendingPixelLiveEdits = function () {
    if (typeof EditorManager === 'undefined' || !EditorManager.activeProject) return false;
    if (
        typeof EditorManager.commitImportPlacementIfPending === 'function' &&
        EditorManager.commitImportPlacementIfPending()
    ) {
        return true;
    }
    let done = false;

    if (
        isDrawing &&
        EditorManager._strokeIntermediateCanvas &&
        ['brush', 'pencil', 'eraser'].includes(window.activeTool)
    ) {
        if (typeof EditorManager.disposeStrokeIntermediate === 'function') {
            EditorManager.disposeStrokeIntermediate();
        }
        isDrawing = false;
        if (typeof EditorManager.setStrokeLightPixelRender === 'function') {
            EditorManager.setStrokeLightPixelRender(false);
        }
        currentElement = null;
        EditorManager.render();
        return true;
    }

    if (typeof window.hasActivePixelTextSession === 'function' && window.hasActivePixelTextSession()) {
        window.commitPixelTextSession(true);
        done = true;
    }

    if (vectorQuadBezierClickState) {
        setVectorQuadBezierClickState(null);
        if (typeof window._quadBezierPreviewDoc !== 'undefined') window._quadBezierPreviewDoc = null;
        done = true;
    }

    if (window._shapeRotDragActive) {
        window._shapeRotDragActive = false;
        window._shapeRotDragMode = null;
        window._shapeLivePreviewAngleRad = 0;
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        isDrawing = false;
        done = true;
    }

    if (window.selectionRotationDragActive) {
        window.selectionRotationDragActive = false;
        window.selectionPreviewAngleRad = 0;
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        isDrawing = false;
        done = true;
    }

    if (selectionBoundsResizeActive) {
        const obResize = originalSelectionBounds;
        const sbResize = window.selectionBounds;
        selectionBoundsResizeActive = false;
        selectionResizeHandle = null;
        originalSelectionBounds = null;
        originalSelectionLassoPoints = null;
        if (typeof window.illuSelectionLoupeHide === 'function') {
            window.illuSelectionLoupeHide();
        }
        if (
            window.selectionKind === 'color' &&
            typeof window.intersectColorMaskWithSelectionBounds === 'function'
        ) {
            window.intersectColorMaskWithSelectionBounds();
        }
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        const appliedLayerResize =
            typeof window.applyMoveToolLayerResizeIfNeeded === 'function' &&
            window.applyMoveToolLayerResizeIfNeeded(obResize, sbResize);
        if (!appliedLayerResize && !window.illuCropSessionActive) {
            // Removed saveHistory for selection action
        }
        EditorManager.render();
        isDrawing = false;
        done = true;
    }

    if (EditorManager.isPixelMode) {
        if (window.activeTool === 'gradient') {
            if (window._gradientHandleDrag != null) {
                window._gradientHandleDrag = null;
                EditorManager.saveHistory('Dégradé ajusté', { patchActiveLayer: true });
                done = true;
            } else if (window._gradientNewDrag && typeof window.finishNewGradientDrag === 'function') {
                const st = window._pixelGradientState;
                const lx = startX;
                const ly = startY;
                let ex;
                let ey;
                if (st) {
                    ex = st.x1;
                    ey = st.y1;
                } else {
                    const fallback = {
                        x: lx + Math.min(120, Math.max(32, EditorManager.width * 0.2)),
                        y: ly + Math.min(120, Math.max(32, EditorManager.height * 0.2))
                    };
                    const end = window._illuLastPointerDoc || fallback;
                    const ep = constrainLineEndpoint(lx, ly, end.x, end.y, window._shiftConstraintProportions);
                    ex = ep.x;
                    ey = ep.y;
                }
                window.finishNewGradientDrag(lx, ly, ex, ey);
                window._gradientNewDrag = false;
                window._gradientHandleDrag = null;
                isDrawing = false;
                done = true;
            } else if (window._pixelGradientState) {
                window._pixelGradientState = null;
                window._gradientHandleDrag = null;
                done = true;
            }
        }

        if (window.shapeHandleDrag != null) {
            window.shapeHandleDrag = null;
            EditorManager.saveHistory('Forme ajustée', { patchActiveLayer: true });
            isDrawing = false;
            done = true;
        }

        if (
            window.pixelShapeEdit &&
            ['rect', 'circle', 'line', 'round-3', 'triangle', 'cubic-3', 'pen', 'polygon'].includes(window.activeTool)
        ) {
            if (typeof window.hidePixelShapeEditOverlay === 'function') window.hidePixelShapeEditOverlay();
            window.pixelShapeEdit = null;
            window._shapeBackupCanvas = null;
            if (typeof EditorManager.clearShapePreviewOverlay === 'function') {
                EditorManager.clearShapePreviewOverlay();
            }
            done = true;
        }

        if (isDrawing) {
            if (isRectSelectionTool()) {
                let sbr = window.selectionBounds;
                sbr = illuFinalizeRectSelectionBounds(sbr, startX, startY);
                window.selectionBounds = sbr;
                if (!illuSelectionBigEnough(sbr)) {
                    window.selectionBounds = null;
                    window.selectionLassoPoints = null;
                    window.selectionKind = 'rect';
                    window.selectionColorMask = null;
                    window.selectionInverted = false;
                    window.selectionPreviewAngleRad = 0;
                    selectionCombineBackup = null;
                    window.selectionCombineGhost = null;
                    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
                } else {
                    selectionCombineBackup = null;
                    window.selectionCombineGhost = null;
                    // Removed saveHistory for selection action
                    if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
                }
                isDrawing = false;
                done = true;
            } else if (isLassoSelectionTool() && lassoDrawingPoints) {
                lassoDrawingPoints = null;
                selectionCombineBackup = null;
                window.selectionCombineGhost = null;
                if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
                isDrawing = false;
                done = true;
            } else if (
                ['rect', 'circle', 'line', 'round-3', 'triangle'].includes(window.activeTool) &&
                window._shapeBackupCanvas &&
                EditorManager.activeCtx
            ) {
                const pos = window._illuLastPointerDoc || { x: startX, y: startY };
                drawFinalShapeOnCanvas(pos, !!window._shiftConstraintProportions);
                EditorManager.saveHistory('Dessin pixel', { patchActiveLayer: true });
                isDrawing = false;
                done = true;
            }
        }
    }

    if (done) {
        currentElement = null;
        EditorManager.render();
    }
    return done;
};

function createSVG(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (let k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

function floodFill(startX, startY) {
    const ctx = EditorManager.activeCtx;
    if (!ctx) return;

    const canvas = EditorManager.activeLayer.buffer;
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const startIdx = (startY * w + startX) * 4;

    const pc = EditorManager.primaryColor;
    const fillRGBA = pc ? { r: pc.r, g: pc.g, b: pc.b, a: pc.a != null ? pc.a : 255 } : { r: 0, g: 0, b: 0, a: 255 };
    const targetA = fillRGBA.a;
    const fillTol = EditorManager.toolProps.fillTolerance ?? 0;
    const fillMode = EditorManager.toolProps.fillMode === 'layer' ? 'layer' : 'contiguous';

    // Preparation des donnees de trame si besoin
    const isDither = EditorManager.activeProject && EditorManager.activeProject.mode === 'pixel-dither';
    const ditherPattern = isDither ? (EditorManager._ditherPatternBitmasks && EditorManager._ditherPatternBitmasks[EditorManager.activeDitherPatternId]) : null;

    const matchSample = buildPixelColorMatchFn(data, startIdx, fillTol);
    if (!matchSample(startIdx)) return;

    const applyFillAt = (px, py) => {
        const didx = (py * w + px) * 4;
        if (isDither) {
            const bit = ditherPattern ? ditherPattern[(py % 8) * 8 + (px % 8)] : 1;
            const v = bit ? 0 : 255;
            data[didx] = data[didx + 1] = data[didx + 2] = v;
            data[didx + 3] = 255;
        } else if (window._illuFillPattern && EditorManager.toolProps.fillType === 'pattern') {
            const pat = window._illuFillPattern;
            const pidx = ((py % pat.height) * pat.width + (px % pat.width)) * 4;
            const pData = window._illuFillPatternData;
            data[didx] = pData[pidx];
            data[didx + 1] = pData[pidx + 1];
            data[didx + 2] = pData[pidx + 2];
            data[didx + 3] = pData[pidx + 3];
        } else {
            data[didx] = fillRGBA.r;
            data[didx + 1] = fillRGBA.g;
            data[didx + 2] = fillRGBA.b;
            data[didx + 3] = targetA;
        }
    };

    // Bornes de selection
    let minX = 0, minY = 0, maxX = w - 1, maxY = h - 1;
    const layerX = EditorManager.activeLayer.x;
    const layerY = EditorManager.activeLayer.y;
    const selectionActive =
        typeof window.hasActivePixelSelection === 'function' && window.hasActivePixelSelection();
    const useColorMaskClip = selectionActive && window.selectionKind === 'color' && window.selectionColorMask && EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask);

    if (selectionActive) {
        if (!window.selectionInverted && !useColorMaskClip) {
            minX = Math.max(0, window.selectionBounds.x - layerX);
            minY = Math.max(0, window.selectionBounds.y - layerY);
            maxX = Math.min(w - 1, window.selectionBounds.x + window.selectionBounds.w - layerX);
            maxY = Math.min(h - 1, window.selectionBounds.y + window.selectionBounds.h - layerY);
            if (startX < minX || startX > maxX || startY < minY || startY > maxY) return;
        }
        if ((window.selectionInverted || useColorMaskClip) && !isPixelInActiveSelection(startX, startY, layerX, layerY)) return;
    }

    if (fillMode === 'layer') {
        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const didx = (py * w + px) * 4;
                if (!matchSample(didx)) continue;
                if (selectionActive && !isPixelInActiveSelection(px, py, layerX, layerY)) continue;
                applyFillAt(px, py);
            }
        }
        ctx.putImageData(imageData, 0, 0);
        EditorManager.render();
        return;
    }

    // --- OPTIMIZED SCANLINE FLOOD FILL WITH REUSABLE VISITED MAP ---
    if (!window._floodFillVisited || window._floodFillVisited.length < w * h) {
        window._floodFillVisited = new Uint8Array(w * h);
    } else {
        window._floodFillVisited.fill(0);
    }
    const visited = window._floodFillVisited;
    const stack = [[startX, startY]];
    
    const isMatch = (px, py) => {
        if (px < minX || px > maxX || py < minY || py > maxY) return false;
        const vidx = py * w + px;
        if (visited[vidx]) return false;
        
        const didx = vidx * 4;
        if (!matchSample(didx)) return false;
        
        if (selectionActive) {
            // Check the selection mask regardless of kind (Magic Wand, Rect, Lasso, etc.)
            if (!isPixelInActiveSelection(px, py, layerX, layerY)) return false;
        }
        return true;
    };

    while (stack.length > 0) {
        const [currX, currY] = stack.pop();
        
        // Find left limit
        let lx = currX;
        while (lx > minX && isMatch(lx - 1, currY)) {
            lx--;
        }
        
        // Find right limit
        let rx = currX;
        while (rx < maxX && isMatch(rx + 1, currY)) {
            rx++;
        }

        // Fill line and mark visited
        for (let x = lx; x <= rx; x++) {
            const vidx = currY * w + x;
            visited[vidx] = 1;
            applyFillAt(x, currY);
        }

        // Search for seeds in rows above and below
        const scanSeeds = (y) => {
            if (y < minY || y > maxY) return;
            let spanAdded = false;
            for (let x = lx; x <= rx; x++) {
                if (isMatch(x, y)) {
                    if (!spanAdded) {
                        stack.push([x, y]);
                        spanAdded = true;
                    }
                } else {
                    spanAdded = false;
                }
            }
        };

        scanSeeds(currY - 1);
        scanSeeds(currY + 1);
    }
    
    ctx.putImageData(imageData, 0, 0);
    EditorManager.render();
}

window.illuProcessFileImport = function (file, opts) {
    if (!file) return;
    const options = opts || {};
    const inputEl = options.inputElement;

    const lower = (file.name || '').toLowerCase();
    if (lower.endsWith('.pdn') && typeof window.PdnFile !== 'undefined') {
        (async () => {
            const P = window.IlluProgress;
            const baseName = (file.name || 'projet').replace(/\.pdn$/i, '');
            try {
                if (P && P.status) P.status('Conversion Paint.NET (.pdn)…');
                const buf = await file.arrayBuffer();
                const result = await window.PdnFile.loadFromArrayBuffer(buf);
                if (!result.ok) {
                    if (window.showIlluAlert) {
                        window.showIlluAlert(result.error || 'Impossible de convertir ce fichier .pdn.');
                    }
                    if (inputEl) inputEl.value = '';
                    if (P && P.statusDone) P.statusDone();
                    return;
                }
                if (typeof EditorManager.importPdnDocument === 'function') {
                    EditorManager.importPdnDocument(result, {
                        fileName: baseName,
                        suppressWarnings: !!result.convertedFromPaintDotNet
                    });
                }
                if (result.convertedFromPaintDotNet && typeof window.PdnFile.convertToMasterPaintBlob === 'function') {
                    try {
                        const mpdn = await window.PdnFile.convertToMasterPaintBlob(buf);
                        const blob = new Blob([mpdn], { type: 'application/octet-stream' });
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = baseName + '-illu.pdn';
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => {
                            URL.revokeObjectURL(a.href);
                            a.remove();
                        }, 4000);
                        if (window.showIlluAlert) {
                            const wtxt =
                                result.warnings && result.warnings.length
                                    ? '\n\n' + result.warnings.join('\n')
                                    : '';
                            window.showIlluAlert(
                                'Projet Paint.NET converti et ouvert.' +
                                    wtxt +
                                    '\n\nUne copie « ' +
                                    baseName +
                                    '-illu.pdn » a été téléchargée pour une réouverture plus fiable dans Illu.'
                            );
                        }
                    } catch (convErr) {
                        console.warn(convErr);
                        if (window.showIlluAlert && result.warnings && result.warnings.length) {
                            window.showIlluAlert(result.warnings.join('\n'));
                        }
                    }
                } else if (window.showIlluAlert && result.warnings && result.warnings.length) {
                    window.showIlluAlert(result.warnings.join('\n'));
                }
            } catch (err) {
                console.warn(err);
                if (window.showIlluAlert) {
                    window.showIlluAlert(
                        err && err.message ? `Import .pdn : ${err.message}` : 'Erreur lors de la conversion .pdn.'
                    );
                }
            }
            if (inputEl) inputEl.value = '';
            if (P && P.statusDone) P.statusDone();
        })();
        return;
    }

    const maybeProject =
        lower.endsWith('.illu') ||
        (lower.endsWith('.json') && (file.type === 'application/json' || file.type === ''));
    
    if (maybeProject && typeof window.WorkspaceIO !== 'undefined') {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target.result;
                const data = JSON.parse(text);
                if (data.format === 'illu-workspace') {
                    await WorkspaceIO.applyWorkspaceFromJsonText(text);
                    if (inputEl) inputEl.value = '';
                    return;
                }
            } catch (err) {
                console.warn(err);
                if (window.showIlluAlert) {
                    window.showIlluAlert(
                        err && err.message
                            ? `Impossible d’ouvrir le projet : ${err.message}`
                            : 'Ce fichier n’est pas un projet Illu valide (.illu).'
                    );
                }
                if (inputEl) inputEl.value = '';
                return;
            }
            if (window.showIlluAlert) {
                window.showIlluAlert('Ce fichier n’est pas un projet Illu valide (.illu).');
            }
            if (inputEl) inputEl.value = '';
        };
        reader.readAsText(file);
        return;
    }

    if (file.type === 'image/svg+xml' || lower.endsWith('.svg')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const runImport = (opts) => {
                    if (typeof EditorManager.importSvgFromFileContent === 'function') {
                        EditorManager.importSvgFromFileContent(ev.target.result, file.name, opts);
                    } else {
                        throw new Error('importSvgFromFileContent indisponible');
                    }
                };
                if (typeof window.illuPromptSvgImport === 'function') {
                    window.illuPromptSvgImport(ev.target.result, file.name, runImport);
                } else {
                    runImport({ target: 'new', layerMode: 'split' });
                }
            } catch (err) {
                console.warn(err);
                if (window.showIlluAlert) {
                    window.showIlluAlert(
                        err && err.message
                            ? `Import SVG : ${err.message}`
                            : 'Impossible d’importer ce fichier SVG.'
                    );
                }
            }
        };
        reader.readAsText(file);
        if (inputEl) inputEl.value = '';
        return;
    }

    if (typeof window.illuIsRawFileName === 'function' && window.illuIsRawFileName(file.name || lower)) {
        if (typeof window.openCameraRawAfterRawImport === 'function') {
            window.openCameraRawAfterRawImport(file, inputEl || null);
        } else {
            if (window.showIlluAlert) {
                window.showIlluAlert(
                    'Import RAW : chargez CameraRawPanel.js ou vérifiez raw-convert.php sur le serveur.'
                );
            }
            if (inputEl) inputEl.value = '';
        }
        return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            if (EditorManager.isPixelMode) {
                EditorManager.promptImport(img);
            } else {
                const ctx = EditorManager.activeCtx;
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    EditorManager.saveHistory('Import Image');
                    EditorManager.render();
                }
            }
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    if (inputEl) inputEl.value = '';
};

window.importFile = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    window.illuProcessFileImport(file, { inputElement: e.target });
};

// --- CONTEXT MENU ---
window.ctxMenu = document.createElement('div');
window.ctxMenu.id = 'context-menu';
window.ctxMenu.className = 'ctx-menu-panel';
window.ctxMenu.style.cssText = 'display: none; position: fixed; z-index: 2000001; min-width: 168px;';
const CTX_LABEL_FB = {
    'ctx.undo': 'Annuler',
    'ctx.redo': 'Rétablir',
    'ctx.copy': 'Copier',
    'ctx.paste': 'Coller',
    'ctx.cut': 'Couper',
    'ctx.invert': 'Inverser couleurs',
    'ctx.grayscale': 'Niveaux de gris',
    'ctx.transformGeom': 'Rotation / retournement…',
    'ctx.resize': 'Redimensionner…',
    'ctx.clearSel': 'Effacer sélection',
    'ctx.layerActivate': 'Activer ce calque',
    'ctx.layerSolo': 'Afficher uniquement ce calque',
    'ctx.layerShowAll': 'Afficher tous les calques',
    'ctx.layerToggleVis': 'Masquer / afficher ce calque',
    'ctx.layerDuplicate': 'Dupliquer le calque',
    'ctx.tabDuplicate': 'Dupliquer le projet (nouvel onglet)',
    'ctx.tabSave': 'Exporter / enregistrer ce projet…',
    'ctx.tabClose': 'Fermer l’onglet…',
    'ctx.tabCloseNoSave': 'Fermer sans enregistrer',
    'ctx.tabCloseMask': 'Fermer l’éditeur de masque α'
};
function ctxMenuLabel(key) {
    if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
        const s = window.IlluI18n.t(key);
        if (s !== key) return s;
    }
    return CTX_LABEL_FB[key] || key;
}
function buildCanvasContextMenuInnerHtml() {
    const L = ctxMenuLabel;
    return `
<ul style="list-style:none;margin:0;padding:2px 0;">
    <li class="ctx-item" onclick="window.undo && window.undo(); closeCtxMenu();">
        <i class="fa-solid fa-rotate-left" style="width:16px;"></i> ${L('ctx.undo')}
        <span class="ctx-shortcut">Ctrl+Z</span>
    </li>
    <li class="ctx-item" onclick="window.redo && window.redo(); closeCtxMenu();">
        <i class="fa-solid fa-rotate-right" style="width:16px;"></i> ${L('ctx.redo')}
        <span class="ctx-shortcut">Ctrl+Y</span>
    </li>
    <li class="ctx-sep"></li>
    <li class="ctx-item" onclick="ctxCopy(); closeCtxMenu();">
        <i class="fa-solid fa-copy" style="width:16px;"></i> ${L('ctx.copy')}
        <span class="ctx-shortcut">Ctrl+C</span>
    </li>
    <li class="ctx-item" onclick="ctxPaste(); closeCtxMenu();">
        <i class="fa-solid fa-paste" style="width:16px;"></i> ${L('ctx.paste')}
        <span class="ctx-shortcut">Ctrl+V</span>
    </li>
    <li class="ctx-item" onclick="ctxCut(); closeCtxMenu();">
        <i class="fa-solid fa-scissors" style="width:16px;"></i> ${L('ctx.cut')}
        <span class="ctx-shortcut">Ctrl+X</span>
    </li>
    <li class="ctx-sep"></li>
    <li class="ctx-item" onclick="applyEffect('invert'); closeCtxMenu();">
        <i class="fa-solid fa-circle-half-stroke" style="width:16px;"></i> ${L('ctx.invert')}
    </li>
    <li class="ctx-item" onclick="applyEffect('grayscale'); closeCtxMenu();">
        <i class="fa-solid fa-droplet-slash" style="width:16px;"></i> ${L('ctx.grayscale')}
    </li>
    <li class="ctx-item" onclick="showPixelTransformDialog(); closeCtxMenu();">
        <i class="fa-solid fa-rotate" style="width:16px;"></i> ${L('ctx.transformGeom')}
    </li>
    <li class="ctx-sep"></li>
    <li class="ctx-item" onclick="resizeCanvas(); closeCtxMenu();">
        <i class="fa-solid fa-expand" style="width:16px;"></i> ${L('ctx.resize')}
    </li>
    <li class="ctx-item" onclick="clearSelectionContent(); closeCtxMenu();">
        <i class="fa-solid fa-trash" style="width:16px;"></i> ${L('ctx.clearSel')}
    </li>
</ul>`;
}

function buildLayerContextMenuInnerHtml(idx) {
    const L = ctxMenuLabel;
    const em = window.EditorManager;
    const canDup =
        em &&
        em.isPixelMode &&
        em.layers &&
        em.layers[idx] &&
        em.layers[idx].buffer;
    const dupLine = canDup
        ? `<li class="ctx-item" onclick="EditorManager.illuContextDuplicatePixelLayer(${idx}); closeCtxMenu();">
        <i class="fa-solid fa-clone" style="width:16px;"></i> ${L('ctx.layerDuplicate')}
    </li>`
        : '';
    return `
<ul style="list-style:none;margin:0;padding:2px 0;">
    <li class="ctx-item" onclick="EditorManager.illuContextLayerActivate(${idx}); closeCtxMenu();">
        <i class="fa-solid fa-bullseye" style="width:16px;"></i> ${L('ctx.layerActivate')}
    </li>
    <li class="ctx-item" onclick="EditorManager.illuContextLayerSolo(${idx}); closeCtxMenu();">
        <i class="fa-solid fa-eye" style="width:16px;"></i> ${L('ctx.layerSolo')}
    </li>
    <li class="ctx-item" onclick="EditorManager.illuContextLayerShowAll(); closeCtxMenu();">
        <i class="fa-solid fa-layer-group" style="width:16px;"></i> ${L('ctx.layerShowAll')}
    </li>
    <li class="ctx-item" onclick="EditorManager.illuContextLayerToggleVisible(${idx}); closeCtxMenu();">
        <i class="fa-solid fa-eye-slash" style="width:16px;"></i> ${L('ctx.layerToggleVis')}
    </li>
    ${dupLine}
</ul>`;
}

function buildTabContextMenuInnerHtml(pi, proj) {
    const L = ctxMenuLabel;
    if (!proj) {
        return '<ul style="list-style:none;margin:0;padding:2px 0;"></ul>';
    }
    if (proj.role === 'layerAlphaMask') {
        return `
<ul style="list-style:none;margin:0;padding:2px 0;">
    <li class="ctx-item" onclick="EditorManager.closeLinkedAlphaMaskTab(${pi}); closeCtxMenu();">
        <i class="fa-solid fa-xmark" style="width:16px;"></i> ${L('ctx.tabCloseMask')}
    </li>
</ul>`;
    }
    return `
<ul style="list-style:none;margin:0;padding:2px 0;">
    <li class="ctx-item" onclick="void EditorManager.illuContextDuplicateProject(${pi}).catch(function(){}); closeCtxMenu();">
        <i class="fa-solid fa-clone" style="width:16px;"></i> ${L('ctx.tabDuplicate')}
    </li>
    <li class="ctx-item" onclick="EditorManager.illuContextTabSaveExport(${pi}); closeCtxMenu();">
        <i class="fa-solid fa-floppy-disk" style="width:16px;"></i> ${L('ctx.tabSave')}
    </li>
    <li class="ctx-sep"></li>
    <li class="ctx-item" onclick="EditorManager.switchProject(${pi}); EditorManager.requestCloseProject(${pi}); closeCtxMenu();">
        <i class="fa-solid fa-door-open" style="width:16px;"></i> ${L('ctx.tabClose')}
    </li>
    <li class="ctx-item" onclick="EditorManager.illuContextTabCloseNoSave(${pi}); closeCtxMenu();">
        <i class="fa-solid fa-trash" style="width:16px;"></i> ${L('ctx.tabCloseNoSave')}
    </li>
</ul>`;
}

function positionContextMenuNearEvent(e) {
    if (!window.ctxMenu) return;
    const menuW = 260;
    const menuH = window.ctxMenu.scrollHeight || 360;
    const x = Math.min(e.clientX, window.innerWidth - menuW);
    const y = Math.min(e.clientY, window.innerHeight - menuH);
    window.ctxMenu.style.left = `${Math.max(0, x)}px`;
    window.ctxMenu.style.top = `${Math.max(0, y)}px`;
}

function rebuildContextMenuMarkup() {
    if (window.ctxMenu) window.ctxMenu.innerHTML = buildCanvasContextMenuInnerHtml();
}
rebuildContextMenuMarkup();
if (window.ctxMenu) document.body.appendChild(window.ctxMenu);

window.closeCtxMenu = function () {
    if (window.ctxMenu) window.ctxMenu.style.display = 'none';
};

// Copy / Paste / Cut — presse-papiers interne = source de vérité ; sync OS avec numéro de génération.
window.ctxClipboardGeneration = window.ctxClipboardGeneration || 0;

function illuCloneImageData(src) {
    if (!src || !src.data) return src;
    if (
        typeof MasterPaintWasm !== 'undefined' &&
        MasterPaintWasm.isLoaded &&
        src.data.buffer instanceof ArrayBuffer
    ) {
        try {
            return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
        } catch (e) {
            /* fall through */
        }
    }
    return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

function illuSyncSystemClipboardFromInternal(gen, copyBounds, projectId) {
    if (!window.ctxClipboard || !navigator.clipboard || typeof ClipboardItem === 'undefined') return;
    const scratch = document.createElement('canvas');
    scratch.width = window.ctxClipboard.width;
    scratch.height = window.ctxClipboard.height;
    scratch.getContext('2d', { willReadFrequently: true }).putImageData(window.ctxClipboard, 0, 0);
    scratch.toBlob((blob) => {
        if (!blob || gen !== window.ctxClipboardGeneration) return;
        const meta = {
            app: 'illu',
            generation: gen,
            projectId,
            x: copyBounds.x,
            y: copyBounds.y,
            w: copyBounds.w,
            h: copyBounds.h,
            cw: window.ctxClipboard.width,
            ch: window.ctxClipboard.height
        };
        const metaBlob = new Blob(['ILLU_META:' + JSON.stringify(meta)], { type: 'text/plain' });
        const item = new ClipboardItem({
            [blob.type]: blob,
            'text/plain': metaBlob
        });
        navigator.clipboard.write([item]).catch((err) => {
            console.warn('System clipboard sync failed:', err);
        });
    }, 'image/png');
}

/** Coller depuis le tampon interne plutôt que l’OS (évite copier/coller rapide → ancienne image). */
window.illuPreferInternalPaste = function (dt) {
    if (!window.ctxClipboard || !EditorManager?.isPixelMode || EditorManager.mode === 'vector') return false;
    const gen = window.ctxClipboardGeneration || 0;
    const metaText = dt && dt.getData ? dt.getData('text/plain') : '';
    if (metaText && metaText.startsWith('ILLU_META:')) {
        try {
            const json = JSON.parse(metaText.substring(10));
            if (json && json.app === 'illu') {
                if (json.generation == null || json.generation < gen) return true;
                if (json.generation === gen) return true;
            }
        } catch (e) {
            return true;
        }
    }
    const age = Date.now() - (window.ctxClipboardTimestamp || 0);
    if (age < 2500) return true;
    const hasImage =
        dt &&
        dt.files &&
        dt.files.length > 0 &&
        Array.from(dt.files).some((f) => f.type && f.type.indexOf('image') !== -1);
    if (!hasImage) return true;
    return false;
};

window.ctxCopy = function () {
    const ap = EditorManager.activeProject;
    const l = EditorManager.activeLayer;
    if (!ap || !l) return;

    if (EditorManager.mode === 'vector') {
        const sel = EditorManager.activeVectorSelection;
        if (!sel || !sel.length) return;
        window.ctxVectorClipboard = sel.map(el => el.cloneNode(true));
        return;
    }

    let sb = window.selectionBounds;
    // If selection is hidden or empty, copy the entire layer
    const useSelection =
        sb &&
        (typeof window.hasActivePixelSelection !== 'function' || window.hasActivePixelSelection()) &&
        !window.selectionInverted;

    let copyData;
    let copyBounds;

    if (useSelection) {
        const lx = l.x;
        const ly = l.y;
        const ox = Math.floor(sb.x - lx);
        const oy = Math.floor(sb.y - ly);
        const sw = Math.max(1, Math.ceil(sb.x - lx + sb.w) - ox);
        const sh = Math.max(1, Math.ceil(sb.y - ly + sb.h) - oy);
        if (l.importPlacementPending && l.importStagingBuffer) {
            const st = l.importStagingBuffer;
            const sx = l.importStagingX | 0;
            const sy = l.importStagingY | 0;
            const sox = Math.floor(sb.x - sx);
            const soy = Math.floor(sb.y - sy);
            const sctx = st.getContext('2d', { willReadFrequently: true });
            if (!sctx) return;
            copyData = sctx.getImageData(sox, soy, sw, sh);
            copyBounds = { x: sb.x, y: sb.y, w: sw, h: sh };
        } else {
            const ctx = EditorManager.activeCtx;
            if (!ctx) return;
            copyData = ctx.getImageData(ox, oy, sw, sh);
            copyBounds = { x: sb.x, y: sb.y, w: sw, h: sh };
        }
        if (typeof window.illuMaskImageDataToActiveSelection === 'function') {
            window.illuMaskImageDataToActiveSelection(copyData, ox, oy, sw, sh);
        }
    } else {
        // Copy whole layer
        if (!l.buffer) return;
        const bctx = l.buffer.getContext('2d', { willReadFrequently: true });
        copyData = bctx.getImageData(0, 0, l.buffer.width, l.buffer.height);
        copyBounds = { x: l.x, y: l.y, w: l.buffer.width, h: l.buffer.height };
    }

    window.ctxClipboard = illuCloneImageData(copyData);
    window.ctxClipboardDocBounds = copyBounds;
    window.ctxClipboardProjectId = ap.id != null ? ap.id : null;
    window.ctxClipboardTimestamp = Date.now();
    window.ctxClipboardGeneration = (window.ctxClipboardGeneration || 0) + 1;
    const copyGen = window.ctxClipboardGeneration;

    if (typeof window.illuActivateDeformToolOnly === 'function') {
        window.illuActivateDeformToolOnly();
    }

    illuSyncSystemClipboardFromInternal(copyGen, copyBounds, ap.id);
};
window.ctxCut = function () {
    if (EditorManager.mode === 'vector') {
        const sel = EditorManager.activeVectorSelection;
        if (!sel || !sel.length) return;
        window.ctxVectorClipboard = sel.map(el => el.cloneNode(true));
        sel.forEach(el => el.remove());
        EditorManager.activeVectorSelection = [];
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        EditorManager.saveHistory('Couper vecteur', { patchActiveLayer: true });
        EditorManager.render();
        return;
    }
    if (
        (typeof window.hasActivePixelSelection === 'function' && !window.hasActivePixelSelection()) ||
        window.selectionInverted
    ) {
        return;
    }
    ctxCopy();
    const ctx = EditorManager.activeCtx;
    if (ctx) {
        clearActiveSelectionPixelsOnLayer(ctx);
        EditorManager.saveHistory('Couper', { patchActiveLayer: true });
        EditorManager.render();
    }
};
window.ctxPaste = function () {
    if (EditorManager.mode === 'vector') {
        if (!window.ctxVectorClipboard || !window.ctxVectorClipboard.length) return;
        const layer = getVectorActiveLayerContainer();
        if (!layer) return;
        const newSel = [];
        window.ctxVectorClipboard.forEach(el => {
            const clone = el.cloneNode(true);
            const tag = (clone.tagName || '').toLowerCase();
            if (['rect', 'text', 'foreignObject'].includes(tag)) {
                clone.setAttribute('x', String((parseFloat(clone.getAttribute('x')) || 0) + 10));
                clone.setAttribute('y', String((parseFloat(clone.getAttribute('y')) || 0) + 10));
            } else if (['circle', 'ellipse'].includes(tag)) {
                clone.setAttribute('cx', String((parseFloat(clone.getAttribute('cx')) || 0) + 10));
                clone.setAttribute('cy', String((parseFloat(clone.getAttribute('cy')) || 0) + 10));
            } else {
                const tr = clone.getAttribute('transform') || '';
                clone.setAttribute('transform', `${tr} translate(10,10)`.trim());
            }
            layer.appendChild(clone);
            newSel.push(clone);
        });
        EditorManager.activeVectorSelection = newSel;
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        EditorManager.saveHistory('Coller vecteur', { patchActiveLayer: true });
        EditorManager.render();
        return;
    }
    if (typeof window.ctxClipboard === 'undefined' || !window.ctxClipboard) return;
    const c = document.createElement('canvas');
    c.width = window.ctxClipboard.width;
    c.height = window.ctxClipboard.height;
    c.getContext('2d', { willReadFrequently: true }).putImageData(window.ctxClipboard, 0, 0);
    const pasteOpts = {
        pasteDocBounds: window.ctxClipboardDocBounds,
        pasteProjectId: window.ctxClipboardProjectId
    };
    EditorManager.promptImport(c, pasteOpts);
};


// --- INPUT HANDLERS (Keyboard & Navigation) ---
window.isPanning = false;
window.panStart = { x: 0, y: 0 };
window.panDragOrigin = { x: 0, y: 0 };

function isFormFieldTarget(el) {
    if (!el || !el.tagName) return false;
    const t = el.tagName.toLowerCase();
    if (t === 'textarea' || t === 'select') return true;
    if (t === 'input') {
        const type = (el.type || '').toLowerCase();
        if (['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range'].includes(type)) return false;
        return true;
    }
    return el.isContentEditable === true;
}


/** Taille d’outil (slider #tool-size) : pas ±1 px. */
window.adjustToolSizeStep = function (delta) {
    const sel = document.getElementById('tool-size');
    if (!sel) return;
    const min = parseInt(sel.min, 10) || 1;
    const max = parseInt(sel.max, 10) || 600;
    const cur = parseInt(sel.value, 10);
    const base = Number.isNaN(cur) ? min : cur;
    const v = Math.max(min, Math.min(max, base + delta));
    if (v === base) return;
    sel.value = String(v);
    if (typeof window.syncIlluGaugeForRange === 'function') {
        window.syncIlluGaugeForRange(sel);
    }
    if (window.EditorManager) {
        window.EditorManager.toolProps.size = v;
    }
    sel.dispatchEvent(new Event('change', { bubbles: true }));
};

/** Taille du texte (slider #tool-text-size) */
window.adjustTextSizeStep = function (delta) {
    const sel = document.getElementById('tool-text-size');
    if (!sel) return;
    const min = parseInt(sel.min, 10) || 8;
    const max = parseInt(sel.max, 10) || 500;
    const cur = parseInt(sel.value, 10);
    const base = Number.isNaN(cur) ? min : cur;
    const v = Math.max(min, Math.min(max, base + delta));
    if (v === base) return;
    sel.value = String(v);
    if (typeof window.syncIlluGaugeForRange === 'function') {
        window.syncIlluGaugeForRange(sel);
    }
    if (window.EditorManager) {
        window.EditorManager.toolProps.textSize = v;
    }
    sel.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * Raccourcis globaux : base Paint.NET, plus raccourcis utiles type Photoshop / Illustrator.
 * (L’historique Ctrl+Z / Ctrl+Y / Ctrl+Maj+Z est ici pour éviter les conflits avec Ctrl+Maj+Z = rétablir.)
 */

