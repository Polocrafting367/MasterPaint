/**
 * Loupe tactile live sous les poignées de sélection (resize, déformation, warp-4).
 */
(function () {
    const LOUPE_PX = 96;
    const SAMPLE_DOC = 28;
    /** Poignées affichées autour de la sélection (sélection + déformation). */
    const LOUPE_HANDLES = new Set(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'c']);

    window.illuSelectionLoupeActive = false;
    let _handleId = '';

    function isTouchLikePointer(e) {
        if (!e) return false;
        if (e.pointerType === 'touch' || e.pointerType === 'pen') return true;
        if (
            document.body.classList.contains('illu-mobile-shell-active') &&
            e.pointerType &&
            e.pointerType !== 'mouse'
        ) {
            return true;
        }
        return false;
    }

    function mid(a, b) {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function anchorFromWarpQuad(q, hid) {
        if (!q || !hid) return null;
        const n = mid(q.tl, q.tr);
        const em = mid(q.tr, q.br);
        const sm = mid(q.br, q.bl);
        const wm = mid(q.bl, q.tl);
        const cx = (q.tl.x + q.tr.x + q.br.x + q.bl.x) / 4;
        const cy = (q.tl.y + q.tr.y + q.br.y + q.bl.y) / 4;
        const map = {
            nw: q.tl,
            ne: q.tr,
            se: q.br,
            sw: q.bl,
            n,
            e: em,
            s: sm,
            w: wm,
            c: { x: cx, y: cy }
        };
        const p = map[hid];
        return p ? { x: p.x, y: p.y } : null;
    }

    function drawLoupeCenterCross(ctx) {
        const cx = LOUPE_PX / 2;
        const cy = LOUPE_PX / 2;
        const arm = 6;
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur = 2;
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy);
        ctx.lineTo(cx + arm, cy);
        ctx.moveTo(cx, cy - arm);
        ctx.lineTo(cx, cy + arm);
        ctx.stroke();
        ctx.restore();
    }

    function ensureLoupeEl() {
        let root = document.getElementById('illu-selection-touch-loupe');
        if (root) {
            let cross = root.querySelector('.illu-selection-touch-loupe__cross');
            if (!cross) {
                cross = document.createElement('span');
                cross.className = 'illu-selection-touch-loupe__cross';
                cross.setAttribute('aria-hidden', 'true');
                root.appendChild(cross);
            } else {
                const ring = root.querySelector('.illu-selection-touch-loupe__ring');
                if (ring && ring.contains(cross)) {
                    root.appendChild(cross);
                }
            }
            return root;
        }
        root = document.createElement('div');
        root.id = 'illu-selection-touch-loupe';
        root.className = 'illu-selection-touch-loupe';
        root.setAttribute('aria-hidden', 'true');
        root.hidden = true;
        const ring = document.createElement('div');
        ring.className = 'illu-selection-touch-loupe__ring';
        const canvas = document.createElement('canvas');
        canvas.className = 'illu-selection-touch-loupe__canvas';
        canvas.width = LOUPE_PX;
        canvas.height = LOUPE_PX;
        ring.appendChild(canvas);
        root.appendChild(ring);
        const cross = document.createElement('span');
        cross.className = 'illu-selection-touch-loupe__cross';
        cross.setAttribute('aria-hidden', 'true');
        root.appendChild(cross);
        document.body.appendChild(root);
        return root;
    }

    function handlesFromRect(sb, includeSides) {
        const x = sb.x;
        const y = sb.y;
        const w = sb.w;
        const h = sb.h;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const out = {
            nw: { x, y },
            ne: { x: x + w, y },
            se: { x: x + w, y: y + h },
            sw: { x, y: y + h }
        };
        if (includeSides) {
            out.n = { x: cx, y };
            out.s = { x: cx, y: y + h };
            out.e = { x: x + w, y: cy };
            out.w = { x, y: cy };
            out.c = { x: cx, y: cy };
        }
        return out;
    }

    window.illuSelectionHandleDocAnchor = function (handleId) {
        const hid = handleId || _handleId || '';
        if (window.selectionPixelWarpActive && window.selectionWarpQuad) {
            const w = anchorFromWarpQuad(window.selectionWarpQuad, hid);
            if (w) return w;
        }
        if (
            window.selectionKind === 'lasso' &&
            window.selectionLassoPoints &&
            window.selectionLassoPoints.length === 4
        ) {
            const map = { nw: 0, ne: 1, se: 2, sw: 3 };
            const ix = map[hid];
            if (ix != null) return { ...window.selectionLassoPoints[ix] };
            const pts = window.selectionLassoPoints;
            const q = { tl: pts[0], tr: pts[1], br: pts[2], bl: pts[3] };
            const w = anchorFromWarpQuad(q, hid);
            if (w) return w;
        }
        const sb = window.selectionBounds;
        if (!sb) return null;
        const includeSides =
            !window.illuCropSessionActive ||
            window.activeTool === 'deform' ||
            window.activeTool === 'warp-4';
        const pts = handlesFromRect(sb, includeSides);
        return pts[hid] ? { ...pts[hid] } : null;
    };

    function sampleLoupePixels(anchorDoc, targetCtx) {
        if (!anchorDoc || !targetCtx) return;
        const em = window.EditorManager;
        const docW = em.width | 0;
        const docH = em.height | 0;
        const half = SAMPLE_DOC / 2;
        let sx = anchorDoc.x - half;
        let sy = anchorDoc.y - half;
        sx = Math.max(0, Math.min(sx, Math.max(0, docW - SAMPLE_DOC)));
        sy = Math.max(0, Math.min(sy, Math.max(0, docH - SAMPLE_DOC)));
        const sw = Math.min(SAMPLE_DOC, docW - sx);
        const sh = Math.min(SAMPLE_DOC, docH - sy);
        targetCtx.clearRect(0, 0, LOUPE_PX, LOUPE_PX);
        targetCtx.fillStyle = 'rgba(40,40,40,0.9)';
        targetCtx.fillRect(0, 0, LOUPE_PX, LOUPE_PX);

        const layer = em.activeLayer;
        if (layer && layer.buffer && layer.visible !== false) {
            const lx = Math.round(sx - (layer.x || 0));
            const ly = Math.round(sy - (layer.y || 0));
            const lw = layer.buffer.width;
            const lh = layer.buffer.height;
            const cx = Math.max(0, Math.min(lx, lw));
            const cy = Math.max(0, Math.min(ly, lh));
            const cw = Math.max(1, Math.min(sw, lw - cx));
            const ch = Math.max(1, Math.min(sh, lh - cy));
            try {
                targetCtx.imageSmoothingEnabled = false;
                targetCtx.drawImage(layer.buffer, cx, cy, cw, ch, 0, 0, LOUPE_PX, LOUPE_PX);
                drawLoupeCenterCross(targetCtx);
                return;
            } catch (e) {
                /* fallback composite */
            }
        }

        const composite = document.getElementById('drawing-canvas');
        if (composite && composite.width > 0 && composite.height > 0) {
            try {
                targetCtx.imageSmoothingEnabled = false;
                targetCtx.drawImage(composite, sx, sy, sw, sh, 0, 0, LOUPE_PX, LOUPE_PX);
            } catch (e2) {
                /* ignore */
            }
        }
        drawLoupeCenterCross(targetCtx);
    }

    function positionLoupe(clientX, clientY) {
        const root = document.getElementById('illu-selection-touch-loupe');
        if (!root) return;
        const offsetY = 56;
        const margin = 8;
        let left = clientX - LOUPE_PX / 2;
        let top = clientY - LOUPE_PX - offsetY;
        left = Math.max(margin, Math.min(left, window.innerWidth - LOUPE_PX - margin));
        top = Math.max(margin, Math.min(top, window.innerHeight - LOUPE_PX - margin));
        root.style.left = left + 'px';
        root.style.top = top + 'px';
    }

    window.illuSelectionLoupeTryShow = function (e, handleId) {
        if (!isTouchLikePointer(e)) return;
        const hid = handleId || '';
        if (!LOUPE_HANDLES.has(hid)) return;
        const anchor = window.illuSelectionHandleDocAnchor(hid);
        if (!anchor) return;
        _handleId = hid;
        window.illuSelectionLoupeActive = true;
        const root = ensureLoupeEl();
        root.hidden = false;
        const canvas = root.querySelector('canvas');
        const ctx = canvas && canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) sampleLoupePixels(anchor, ctx);
        positionLoupe(e.clientX, e.clientY);
    };

    window.illuSelectionLoupeMove = function (e, anchorDoc) {
        if (!window.illuSelectionLoupeActive) return;
        const anchor =
            anchorDoc ||
            window.illuSelectionHandleDocAnchor(_handleId) ||
            (e && typeof window.EditorManager !== 'undefined'
                ? window.EditorManager.logicalPointerFromClientXY(e.clientX, e.clientY)
                : null);
        const root = document.getElementById('illu-selection-touch-loupe');
        if (!root || root.hidden) return;
        const canvas = root.querySelector('canvas');
        const ctx = canvas && canvas.getContext('2d', { willReadFrequently: true });
        if (ctx && anchor) sampleLoupePixels(anchor, ctx);
        if (e && Number.isFinite(e.clientX)) {
            positionLoupe(e.clientX, e.clientY);
        } else if (anchor && window.EditorManager) {
            const container = document.getElementById('main-canvas-container');
            const p = window.EditorManager.activeProject;
            if (container && p && p.width > 0 && p.height > 0) {
                const rect = container.getBoundingClientRect();
                const cx = rect.left + (anchor.x / p.width) * rect.width;
                const cy = rect.top + (anchor.y / p.height) * rect.height;
                positionLoupe(cx, cy);
            }
        }
    };

    window.illuSelectionLoupeHide = function () {
        window.illuSelectionLoupeActive = false;
        _handleId = '';
        const root = document.getElementById('illu-selection-touch-loupe');
        if (root) root.hidden = true;
    };
})();
