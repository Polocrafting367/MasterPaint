/**
 * VectorEngine.js — Moteur vectoriel centralisé MasterPaint
 * Gère : sélection rubber-band, pen/polygon click-to-place,
 *        multi-sélection drag, visuels de sélection cohérents,
 *        édition live couleur/style sur forme sélectionnée.
 */
'use strict';

window.VectorEngine = (() => {
    const NS = 'http://www.w3.org/2000/svg';

    // ─── État interne ───────────────────────────────────────────────────────
    let _rubberBand = null;   // { x0,y0, el }
    let _penState   = null;   // { points:[], previewEl, layer, type: 'quad'|'cubic' }
    let _polyState  = null;   // { points:[], previewEl, layer }
    let _snapshots  = [];     // [{ el, base, origBBox }] pour multi-drag
    let _snapshotOrigBBox = null; // combined original bbox for snapping
    let _dragStart  = null;   // {x,y}
    let _dragging   = false;
    let _activeEl   = null;
    let _transformMode = null; // 'deform' | 'warp-4'
    let _transformData = null; // { boxStart: {x,y,w,h}, pivot:{x,y} }

    // Node editing
    let _nodeSelection = [];  // [{ el, index, type: 'node'|'cp1'|'cp2' }]
    let _nodeSnapshots = [];  // [{ el, points:[] }]
    let _uiRefreshRaf = 0;
    let _uiBuiltForDrag = false;

    function _setVectorDragActive(on) {
        window._illuVectorDragActive = !!on;
    }

    function _veKey(el, idx) {
        if (el.id) return el.id;
        const sid = el.getAttribute && el.getAttribute('data-illu-sprite-id');
        if (sid) return sid;
        return `ve-el-${idx}`;
    }

    function _elementScreenBounds(el) {
        try {
            if (
                el.tagName &&
                el.tagName.toLowerCase() === 'path' &&
                typeof window.illuGetElementBBox === 'function'
            ) {
                const bb = window.illuGetElementBBox(el);
                if (bb) {
                    const ctm = el.getCTM();
                    if (!ctm) return null;
                    const pts = [
                        { x: bb.x, y: bb.y },
                        { x: bb.x + bb.width, y: bb.y },
                        { x: bb.x + bb.width, y: bb.y + bb.height },
                        { x: bb.x, y: bb.y + bb.height }
                    ].map((p) => ({
                        x: p.x * ctm.a + p.y * ctm.c + ctm.e,
                        y: p.x * ctm.b + p.y * ctm.d + ctm.f
                    }));
                    const minX = Math.min(...pts.map((p) => p.x));
                    const minY = Math.min(...pts.map((p) => p.y));
                    const maxX = Math.max(...pts.map((p) => p.x));
                    const maxY = Math.max(...pts.map((p) => p.y));
                    return { minX, minY, rw: maxX - minX, rh: maxY - minY };
                }
            }
            const bb = el.getBBox();
            const ctm = el.getCTM();
            if (!bb || !ctm) return null;
            const pts = [
                { x: bb.x, y: bb.y },
                { x: bb.x + bb.width, y: bb.y },
                { x: bb.x + bb.width, y: bb.y + bb.height },
                { x: bb.x, y: bb.y + bb.height }
            ].map((p) => ({
                x: p.x * ctm.a + p.y * ctm.c + ctm.e,
                y: p.x * ctm.b + p.y * ctm.d + ctm.f
            }));
            const minX = Math.min(...pts.map((p) => p.x));
            const minY = Math.min(...pts.map((p) => p.y));
            const maxX = Math.max(...pts.map((p) => p.x));
            const maxY = Math.max(...pts.map((p) => p.y));
            return { minX, minY, rw: maxX - minX, rh: maxY - minY };
        } catch (e) {
            return null;
        }
    }

    function _clearNodeSelection() {
        _nodeSelection = [];
        _nodeSnapshots = [];
    }

    // ─── Helpers ────────────────────────────────────────────────────────────
    function getUI()    { return document.getElementById('svg-ui'); }
    function getLayer() {
        const l = EditorManager.activeLayer;
        const root = document.getElementById('svg-layers');
        if (!root) return null;
        return (l && document.getElementById('layer-' + l.id)) || root;
    }
    function zoom() { return EditorManager.getCanvasZoomLevel() || 1; }
    function isNodeMode() {
        const t = window.activeTool;
        return t === 'node-select' || t === 'direct-select';
    }

    // ─── Visuel de sélection ────────────────────────────────────────────────
    const SEL_PRIMARY   = '#0a84ff';
    const SEL_SECONDARY = '#5ab0ff';
    const HANDLE_PX = 8;

    function _hz() { return HANDLE_PX / zoom() / 2; }

    function _clearUI() {
        const ui = getUI();
        if (ui) ui.innerHTML = '';
    }

    function _updateSelectionUIPositions(sel) {
        const ui = getUI();
        if (!ui || !sel.length) return false;
        const z = zoom();
        const hz = _hz();
        const nodeMode = isNodeMode();
        let ok = true;

        sel.forEach((el, idx) => {
            const b = _elementScreenBounds(el);
            if (!b || b.rw < 0.1 || b.rh < 0.1) return;
            const key = _veKey(el, idx);
            const rect = ui.querySelector(`[data-ve-sel-box="${key}"]`);
            if (!rect) {
                ok = false;
                return;
            }
            rect.setAttribute('x', String(b.minX));
            rect.setAttribute('y', String(b.minY));
            rect.setAttribute('width', String(b.rw));
            rect.setAttribute('height', String(b.rh));
            if (idx === sel.length - 1 && !nodeMode && sel.length === 1) {
                _positionResizeHandles(ui, key, b, hz, z);
            }
        });

        if (sel.length > 1 && !nodeMode) {
            const gb = ui.querySelector('[data-ve-group-box="1"]');
            if (!gb) ok = false;
            else {
                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;
                sel.forEach((el) => {
                    const b = _elementScreenBounds(el);
                    if (!b) return;
                    minX = Math.min(minX, b.minX);
                    minY = Math.min(minY, b.minY);
                    maxX = Math.max(maxX, b.minX + b.rw);
                    maxY = Math.max(maxY, b.minY + b.rh);
                });
                if (isFinite(minX)) {
                    gb.setAttribute('x', String(minX - 2 / z));
                    gb.setAttribute('y', String(minY - 2 / z));
                    gb.setAttribute('width', String(maxX - minX + 4 / z));
                    gb.setAttribute('height', String(maxY - minY + 4 / z));
                    _positionResizeHandles(ui, 'group', { minX, minY, rw: maxX - minX, rh: maxY - minY }, hz, z);
                }
            }
        }
        return ok;
    }

    function _positionResizeHandles(ui, parentKey, b, hz, z) {
        const { minX: x, minY: y, rw: w, rh: h } = b;
        const coords = [
            { cx: x, cy: y },
            { cx: x + w / 2, cy: y },
            { cx: x + w, cy: y },
            { cx: x, cy: y + h / 2 },
            { cx: x + w, cy: y + h / 2 },
            { cx: x, cy: y + h },
            { cx: x + w / 2, cy: y + h },
            { cx: x + w, cy: y + h }
        ];
        const handles = ui.querySelectorAll(`[data-ve-handle-parent="${parentKey}"]`);
        if (handles.length !== 8) return false;
        handles.forEach((r, idx) => {
            const { cx, cy } = coords[idx];
            r.setAttribute('x', String(cx - hz));
            r.setAttribute('y', String(cy - hz));
            r.setAttribute('width', String(hz * 2));
            r.setAttribute('height', String(hz * 2));
            r.setAttribute('rx', String(hz * 0.35));
            r.setAttribute('stroke-width', String(1.2 / z));
        });
        return true;
    }

    function refreshSelectionUIImpl() {
        const ui = getUI();
        if (!ui) return;

        if (
            EditorManager.mode === 'vector' &&
            typeof window.illuVectorPreferBitmapSelectionUI === 'function' &&
            window.illuVectorPreferBitmapSelectionUI()
        ) {
            const penDots = [...ui.querySelectorAll('.ve-pen-dot')];
            const polyDots = [...ui.querySelectorAll('.ve-poly-dot')];
            ui.innerHTML = '';
            penDots.forEach((n) => ui.appendChild(n));
            polyDots.forEach((n) => ui.appendChild(n));
            if (typeof window.illuSyncVectorSelectionAnchors === 'function') {
                window.illuSyncVectorSelectionAnchors();
            }
            return;
        }

        const penDots = [...ui.querySelectorAll('.ve-pen-dot')];
        const polyDots = [...ui.querySelectorAll('.ve-poly-dot')];

        ui.innerHTML = '';

        penDots.forEach((n) => ui.appendChild(n));
        polyDots.forEach((n) => ui.appendChild(n));

        const sel = EditorManager.activeVectorSelection;
        if (!sel || !sel.length) {
            _uiBuiltForDrag = false;
            return;
        }
        
        if (typeof window.illuSyncVectorPropertiesBar === 'function') {
            window.illuSyncVectorPropertiesBar();
        }

        const z = zoom();
        const hz = _hz();
        const nodeMode = isNodeMode();
        
        const MAX_INDIVIDUAL_BOXES = 150;
        const skipIndividualBoxes = sel.length > MAX_INDIVIDUAL_BOXES && !nodeMode;
        const cachedBounds = new Map();

        sel.forEach((el, idx) => {
            try {
                const tag = el.tagName.toLowerCase();
                const isPrimary = idx === sel.length - 1;
                const key = _veKey(el, idx);

                if (nodeMode && (tag === 'path' || tag === 'polygon' || tag === 'polyline')) {
                    _drawPathNodes(ui, el, z, hz);
                }

                const b = _elementScreenBounds(el);
                if (b) cachedBounds.set(el, b);
                if (!b) return;
                if (b.rw < 0.1 && b.rh < 0.1) return;
                // Garantir des dimensions minimales (ligne parfaitement horizontale/verticale a rh=0 ou rw=0)
                b.rw = Math.max(b.rw, 1);
                b.rh = Math.max(b.rh, 1);

                if (!skipIndividualBoxes) {
                    const rect = document.createElementNS(NS, 'rect');
                    rect.setAttribute('data-ve-sel-box', key);
                    rect.setAttribute('x', String(b.minX));
                    rect.setAttribute('y', String(b.minY));
                    rect.setAttribute('width', String(b.rw));
                    rect.setAttribute('height', String(b.rh));
                    rect.setAttribute('fill', 'none');
                    rect.setAttribute('stroke', isPrimary ? SEL_PRIMARY : SEL_SECONDARY);
                    rect.setAttribute('stroke-width', String(1.5 / z));
                    if (!isPrimary) rect.setAttribute('stroke-dasharray', `${4 / z},${2 / z}`);
                    rect.setAttribute('pointer-events', 'none');
                    ui.appendChild(rect);
                }

                if (isPrimary && !nodeMode && sel.length === 1) {
                    _drawHandles(ui, { x: b.minX, y: b.minY, width: b.rw, height: b.rh }, hz, z, key);
                }
            } catch (e) {
                console.error('refreshSelectionUI error:', e);
            }
        });

        if (sel.length > 1 && !nodeMode) {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            sel.forEach((el) => {
                let b = cachedBounds.get(el);
                if (!b) {
                    b = _elementScreenBounds(el);
                    if (b) cachedBounds.set(el, b);
                }
                if (!b) return;
                minX = Math.min(minX, b.minX);
                minY = Math.min(minY, b.minY);
                maxX = Math.max(maxX, b.minX + b.rw);
                maxY = Math.max(maxY, b.minY + b.rh);
            });
            if (isFinite(minX)) {
                const r = document.createElementNS(NS, 'rect');
                r.setAttribute('data-ve-group-box', '1');
                r.setAttribute('x', String(minX - 2 / z));
                r.setAttribute('y', String(minY - 2 / z));
                r.setAttribute('width', String(maxX - minX + 4 / z));
                r.setAttribute('height', String(maxY - minY + 4 / z));
                r.setAttribute('fill', 'none');
                r.setAttribute('stroke', SEL_PRIMARY);
                r.setAttribute('stroke-width', String(1 / z));
                r.setAttribute('stroke-dasharray', String(4 / z));
                r.setAttribute('pointer-events', 'none');
                ui.appendChild(r);
                _drawHandles(ui, { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, hz, z, 'group');
            }
        }
        _uiBuiltForDrag = true;
    }

    function _scheduleRefreshSelectionUI() {
        if (_uiRefreshRaf) return;
        _uiRefreshRaf = requestAnimationFrame(() => {
            _uiRefreshRaf = 0;
            if (
                typeof window.illuVectorPreferBitmapSelectionUI === 'function' &&
                window.illuVectorPreferBitmapSelectionUI()
            ) {
                if (typeof window.illuSyncVectorSelectionAnchors === 'function') {
                    window.illuSyncVectorSelectionAnchors();
                }
                return;
            }
            const sel = EditorManager.activeVectorSelection;
            if (_dragging && _uiBuiltForDrag && sel && sel.length && _updateSelectionUIPositions(sel)) {
                return;
            }
            refreshSelectionUIImpl();
        });
    }

    /**
     * Redessine les poignées / cadres de sélection (throttlé pendant un glisser).
     */
    function refreshSelectionUI() {
        if (_dragging || window._illuVectorDragActive) {
            _scheduleRefreshSelectionUI();
            return;
        }
        refreshSelectionUIImpl();
    }

    function _drawPathNodes(ui, el, z, hz) {
        let points = _getPathPoints(el);
        const maxNodes = 48;
        if (points.length > maxNodes) {
            const step = Math.ceil(points.length / maxNodes);
            points = points.filter((_, i) => i % step === 0 || i === points.length - 1);
        }
        points.forEach((p, i) => {
            const isSelected = _nodeSelection.some(n => n.el === el && n.index === i);
            const r = document.createElementNS(NS, 'rect');
            r.setAttribute('x', String(p.x - hz));
            r.setAttribute('y', String(p.y - hz));
            r.setAttribute('width', String(hz * 2));
            r.setAttribute('height', String(hz * 2));
            r.setAttribute('fill', isSelected ? SEL_PRIMARY : '#fff');
            r.setAttribute('stroke', SEL_PRIMARY);
            r.setAttribute('stroke-width', String(1 / z));
            r.setAttribute('vector-effect', 'non-scaling-stroke');
            r.setAttribute('class', 've-node-handle');
            r.dataset.nodeIdx = String(i);
            r.style.cursor = 'move';
            r.setAttribute('pointer-events', 'auto');
            ui.appendChild(r);
            
            // Draw control points if selected and cubic
            if (isSelected && p.type === 'C') {
                if (p.cp1) _drawControlPoint(ui, p.x, p.y, p.cp1.x, p.cp1.y, z, hz, el, i, 'cp1');
                if (p.cp2) _drawControlPoint(ui, p.x, p.y, p.cp2.x, p.cp2.y, z, hz, el, i, 'cp2');
            }
        });
    }

    function _drawControlPoint(ui, nx, ny, cpx, cpy, z, hz, el, idx, type) {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', String(nx)); line.setAttribute('y1', String(ny));
        line.setAttribute('x2', String(cpx)); line.setAttribute('y2', String(cpy));
        line.setAttribute('stroke', SEL_PRIMARY);
        line.setAttribute('stroke-width', String(0.5 / z));
        line.setAttribute('opacity', '0.6');
        ui.appendChild(line);

        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(cpx)); c.setAttribute('cy', String(cpy));
        c.setAttribute('r', String(hz * 0.8));
        c.setAttribute('fill', '#fff');
        c.setAttribute('stroke', SEL_PRIMARY);
        c.setAttribute('stroke-width', String(1 / z));
        c.setAttribute('class', 've-cp-handle');
        c.setAttribute('pointer-events', 'auto');
        c.dataset.nodeIdx = String(idx);
        c.dataset.cpType = type;
        ui.appendChild(c);
    }

    function _drawHandles(ui, bb, hz, z, parentKey) {
        const { x, y, width: w, height: h } = bb;
        const pk = parentKey || 'primary';
        
        // Ligne et poignée de rotation
        const rotY = y - 24 / z;
        const rotLine = document.createElementNS(NS, 'line');
        rotLine.setAttribute('x1', String(x + w / 2));
        rotLine.setAttribute('y1', String(y));
        rotLine.setAttribute('x2', String(x + w / 2));
        rotLine.setAttribute('y2', String(rotY));
        rotLine.setAttribute('stroke', SEL_PRIMARY);
        rotLine.setAttribute('stroke-width', String(1 / z));
        rotLine.setAttribute('vector-effect', 'non-scaling-stroke');
        ui.appendChild(rotLine);

        const rotHandle = document.createElementNS(NS, 'circle');
        rotHandle.setAttribute('cx', String(x + w / 2));
        rotHandle.setAttribute('cy', String(rotY));
        rotHandle.setAttribute('r', String(hz * 1.2));
        rotHandle.setAttribute('fill', '#ffffff');
        rotHandle.setAttribute('stroke', SEL_PRIMARY);
        rotHandle.setAttribute('stroke-width', String(1.2 / z));
        rotHandle.setAttribute('vector-effect', 'non-scaling-stroke');
        rotHandle.setAttribute('class', 'svg-rotation-handle');
        rotHandle.setAttribute('pointer-events', 'auto');
        rotHandle.style.cursor = 'crosshair';
        ui.appendChild(rotHandle);

        [
            { cx: x, cy: y, cur: 'nw-resize' },
            { cx: x + w / 2, cy: y, cur: 'n-resize' },
            { cx: x + w, cy: y, cur: 'ne-resize' },
            { cx: x, cy: y + h / 2, cur: 'w-resize' },
            { cx: x + w, cy: y + h / 2, cur: 'e-resize' },
            { cx: x, cy: y + h, cur: 'sw-resize' },
            { cx: x + w / 2, cy: y + h, cur: 's-resize' },
            { cx: x + w, cy: y + h, cur: 'se-resize' }
        ].forEach(({ cx, cy, cur }, idx) => {
            const r = document.createElementNS(NS, 'rect');
            r.setAttribute('x', String(cx - hz));
            r.setAttribute('y', String(cy - hz));
            r.setAttribute('width', String(hz * 2));
            r.setAttribute('height', String(hz * 2));
            r.setAttribute('rx', String(hz * 0.35));
            r.setAttribute('fill', '#ffffff');
            r.setAttribute('stroke', SEL_PRIMARY);
            r.setAttribute('stroke-width', String(1.2 / z));
            r.setAttribute('vector-effect', 'non-scaling-stroke');
            r.setAttribute('class', 'svg-resize-handle');
            r.setAttribute('pointer-events', 'auto');
            r.setAttribute('data-ve-handle-parent', pk);
            r.dataset.handleIdx = String(idx);
            if (typeof window.illuResizeHandleCursor === 'function') {
                r.style.cursor = window.illuResizeHandleCursor(cur);
            } else {
                r.style.cursor = cur;
            }
            ui.appendChild(r);
        });
    }

    // ─── Rubber-band ────────────────────────────────────────────────────────
    function _startRubberBand(pos) {
        const ui = getUI();
        if (!ui) return;
        const el = document.createElementNS(NS, 'rect');
        el.setAttribute('fill',   'rgba(10,132,255,0.08)');
        el.setAttribute('stroke', SEL_PRIMARY);
        el.setAttribute('stroke-width', String(1 / zoom()));
        el.setAttribute('stroke-dasharray', `${4/zoom()} ${3/zoom()}`);
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        el.setAttribute('pointer-events', 'none');
        ui.appendChild(el);
        _rubberBand = { x0: pos.x, y0: pos.y, el };
    }

    function _updateRubberBand(pos) {
        if (!_rubberBand) return;
        const { x0, y0, el } = _rubberBand;
        const x = Math.min(x0, pos.x), y = Math.min(y0, pos.y);
        el.setAttribute('x', String(x));
        el.setAttribute('y', String(y));
        el.setAttribute('width',  String(Math.abs(pos.x - x0)));
        el.setAttribute('height', String(Math.abs(pos.y - y0)));
    }

    function _commitRubberBand(pos, additive) {
        if (!_rubberBand) return;
        const { x0, y0, el } = _rubberBand;
        el.remove();
        const rx = Math.min(x0, pos.x), ry = Math.min(y0, pos.y);
        const rw = Math.abs(pos.x - x0), rh = Math.abs(pos.y - y0);
        _rubberBand = null;
        if (rw < 3 && rh < 3) return;

        const tool = window.activeTool;
        const layer =
            tool === 'select'
                ? document.getElementById('svg-layers')
                : getLayer();
        if (!layer) return;
        const hits = [];
        const SEL =
            'rect,ellipse,circle,line,path,polygon,polyline,image,foreignObject,text,g[data-illu-group],g[data-illu-import-group]';
        const skipLayerIds = /^layer-\d+$/;
        layer.querySelectorAll(SEL).forEach(el => {
            if (tool === 'select' && el.id && skipLayerIds.test(el.id)) return;
            if (tool === 'select' && el.id === 'illu-import-viewbox-root') return;
            try {
                const bb = el.getBBox();
                if (bb.x < rx + rw && bb.x + bb.width > rx &&
                    bb.y < ry + rh && bb.y + bb.height > ry) hits.push(el);
            } catch(e) {}
        });
        if (additive === 'subtract') {
            hits.forEach(h => {
                const idx = EditorManager.activeVectorSelection.indexOf(h);
                if (idx !== -1) EditorManager.activeVectorSelection.splice(idx, 1);
            });
        } else if (additive) {
            hits.forEach(h => { if (!EditorManager.activeVectorSelection.includes(h)) EditorManager.activeVectorSelection.push(h); });
        } else {
            EditorManager.activeVectorSelection = hits;
            _clearNodeSelection();
        }
        window._activeVectorShapeEl = EditorManager.activeVectorSelection[EditorManager.activeVectorSelection.length - 1] || null;
        refreshSelectionUI();
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    }

    // ─── Hit-test ───────────────────────────────────────────────────────────
    function hitTest(pos, evt) {
        const layer = getLayer();
        if (evt && evt.target && layer) {
            const t = evt.target;
            const fo =
                (t.closest && t.closest('foreignObject')) ||
                (t.closest && t.closest('foreignobject'));
            if (fo && layer.contains(fo)) return fo;
        }

        const ui = getUI();
        if (ui) {
            if (isNodeMode()) {
                const node = evt?.target?.closest('.ve-node-handle, .ve-cp-handle');
                if (node) return node;
                // On autorise aussi les handles de redimensionnement en mode noeud (ex: direct-select)
                const handle = evt?.target?.closest('.svg-resize-handle');
                if (handle) return handle;
            } else {
                const handle = evt?.target?.closest('.svg-resize-handle');
                if (handle) return handle;
            }
        }

        if (!layer) return null;
        const canvasEl = document.getElementById('main-canvas-container');
        if (!canvasEl) return null;
        const cr = canvasEl.getBoundingClientRect();
        const z = zoom();
        const clientX = evt ? evt.clientX : cr.left + pos.x * z;
        const clientY = evt ? evt.clientY : cr.top  + pos.y * z;
        const SEL =
            'rect,ellipse,circle,line,path,polygon,polyline,image,foreignObject,text,g[data-illu-group],g[data-illu-import-group]';
        const nodes = [...layer.querySelectorAll(SEL)].reverse();
        
        for (const el of nodes) {
            try {
                const r = el.getBoundingClientRect();
                const pad = 3; // 3px tolerance
                if (clientX >= r.left - pad && clientX <= r.right + pad && clientY >= r.top - pad && clientY <= r.bottom + pad) {
                    // Wasm-powered precise hit test for paths if needed
                    if (el.tagName.toLowerCase() === 'path' && window.VectorWasm) {
                        // For now we trust BBox, but we could add more precision here.
                    }
                    return el;
                }
            } catch(e) {}
        }
        return null;
    }

    // ─── Path Point Helpers ──────────────────────────────────────────────────
    function _getPathPoints(el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'polygon' || tag === 'polyline') {
            const pts = el.getAttribute('points').trim().split(/\s+/);
            return pts.map(p => {
                const [x, y] = p.split(',').map(Number);
                return { x, y, type: 'L' };
            });
        }
        if (tag === 'path') {
            const d = el.getAttribute('d') || '';
            // Simplified parser for M, L, Q, C
            const commands = d.match(/[MLQCZ][^MLQCZ]*/g) || [];
            const result = [];
            let lastX = 0, lastY = 0;
            commands.forEach(cmd => {
                const type = cmd[0];
                const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
                if (type === 'M' || type === 'L') {
                    lastX = args[0]; lastY = args[1];
                    result.push({ x: lastX, y: lastY, type });
                } else if (type === 'Q') {
                    // args: cp1x cp1y x y
                    result.push({ x: args[2], y: args[3], type, cp1: { x: args[0], y: args[1] } });
                    lastX = args[2]; lastY = args[3];
                } else if (type === 'C') {
                    // args: cp1x cp1y cp2x cp2y x y
                    result.push({ x: args[4], y: args[5], type, cp1: { x: args[0], y: args[1] }, cp2: { x: args[2], y: args[3] } });
                    lastX = args[4]; lastY = args[5];
                }
            });
            return result;
        }
        return [];
    }

    function _setPathPoints(el, points) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'polygon' || tag === 'polyline') {
            el.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
        } else if (tag === 'path') {
            let d = '';
            points.forEach((p, i) => {
                if (p.type === 'M') d += `M ${p.x} ${p.y} `;
                else if (p.type === 'L') d += `L ${p.x} ${p.y} `;
                else if (p.type === 'Q') d += `Q ${p.cp1.x} ${p.cp1.y} ${p.x} ${p.y} `;
                else if (p.type === 'C') d += `C ${p.cp1.x} ${p.cp1.y} ${p.cp2.x} ${p.cp2.y} ${p.x} ${p.y} `;
                else if (p.type === 'Z') d += 'Z ';
            });
            el.setAttribute('d', d.trim());
        }
    }

    // ─── Multi-drag (snapshots) ──────────────────────────────────────────────
    function _cleanTransformStr(tr) {
        if (tr == null || tr === 'undefined' || tr === 'null') return '';
        return String(tr).replace(/\bundefined\b/g, '').replace(/\bnull\b/g, '').replace(/\s+/g, ' ').trim();
    }

    function _snapshot(el) {
        if (typeof window.illuVectorSnapshotForDrag === 'function') {
            const geo = window.illuVectorSnapshotForDrag(el);
            if (geo) {
                // S'assurer que geo.transform est toujours une string propre sans "undefined"
                geo.transform = _cleanTransformStr(geo.transform);
                // Fallback si transform reste vide après nettoyage
                if (!geo.transform) {
                    geo.transform = _cleanTransformStr(el.getAttribute('transform'));
                }
                return geo;
            }
        }
        return { tag: 'transform', transform: _cleanTransformStr(el.getAttribute('transform')) };
    }

    function _applyDrag(el, base, dx, dy) {
        if (
            base &&
            base.tag &&
            base.tag !== 'transform' &&
            typeof window.illuVectorApplyDragFromSnapshot === 'function'
        ) {
            window.illuVectorApplyDragFromSnapshot(el, base, dx, dy);
            return;
        }
        let ldx = dx, ldy = dy;
        try {
            const p = el.parentElement;
            const ctm = p ? p.getScreenCTM() : el.ownerSVGElement.getScreenCTM();
            if (ctm) {
                const inv = ctm.inverse();
                ldx = dx * inv.a + dy * inv.c;
                ldy = dx * inv.b + dy * inv.d;
            }
        } catch (e) {
            /* ignore */
        }
        let baseTr = _cleanTransformStr((base && base.transform != null) ? String(base.transform) : '');
        const newTr = [`translate(${ldx},${ldy})`, baseTr].filter(Boolean).join(' ').trim();
        el.setAttribute('transform', newTr);
    }

    function beginDrag(sel, pos, evt) {
        const nodeMode = isNodeMode();
        _setVectorDragActive(true);
        _transformMode = null;
        if (nodeMode) {
            const target = evt?.target;
            const handle = target?.closest('.ve-node-handle, .ve-cp-handle');
            if (handle) {
                const el = EditorManager.activeVectorSelection[EditorManager.activeVectorSelection.length - 1];
                const idx = parseInt(handle.dataset.nodeIdx);
                const type = handle.classList.contains('ve-cp-handle') ? handle.dataset.cpType : 'node';
                
                if (!evt.shiftKey && !_nodeSelection.some(n => n.el === el && n.index === idx && n.type === type)) {
                    _nodeSelection = [{ el, index: idx, type }];
                } else if (evt.shiftKey) {
                    _nodeSelection.push({ el, index: idx, type });
                }
                
                const affectedElements = [...new Set(_nodeSelection.map(n => n.el))];
                _nodeSnapshots = affectedElements.map(el => ({ el, points: _getPathPoints(el) }));
            }
        } else {
            const target = evt?.target;
            const rotationHandle = target?.closest('.svg-rotation-handle');
            if (rotationHandle) {
                beginTransform(sel, pos, 'rotate');
                return;
            }
            const resizeHandle = target?.closest('.svg-resize-handle');
            if (resizeHandle) {
                const cursors = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
                const idx = parseInt(resizeHandle.dataset.handleIdx);
                beginTransform(sel, pos, cursors[idx]);
                return;
            }
            _snapshots = sel.map(el => {
                let origBBox = null;
                try { origBBox = el.getBBox(); } catch(e) {}
                return { el, base: _snapshot(el), origBBox };
            });
            // Also store the combined original bbox for snapping
            let oMinX = Infinity, oMinY = Infinity, oMaxX = -Infinity, oMaxY = -Infinity;
            _snapshots.forEach(s => {
                if (!s.origBBox) return;
                if (s.origBBox.x < oMinX) oMinX = s.origBBox.x;
                if (s.origBBox.y < oMinY) oMinY = s.origBBox.y;
                if (s.origBBox.x + s.origBBox.width > oMaxX) oMaxX = s.origBBox.x + s.origBBox.width;
                if (s.origBBox.y + s.origBBox.height > oMaxY) oMaxY = s.origBBox.y + s.origBBox.height;
            });
            _snapshotOrigBBox = (oMinX !== Infinity)
                ? { x: oMinX, y: oMinY, width: oMaxX - oMinX, height: oMaxY - oMinY }
                : null;
        }
        _dragStart = { x: pos.x, y: pos.y };
        _dragging  = false;
    }

    function beginTransform(sel, pos, mode) {
        beginDrag(sel, pos);
        _transformMode = mode;
        if (sel.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            sel.forEach(el => {
                try {
                    const b = el.getBBox();
                    if (b.x < minX) minX = b.x;
                    if (b.y < minY) minY = b.y;
                    if (b.x + b.width > maxX) maxX = b.x + b.width;
                    if (b.y + b.height > maxY) maxY = b.y + b.height;
                } catch(e) {}
            });
            if (minX === Infinity) { minX=0; minY=0; maxX=100; maxY=100; }
            
            const pivotX = (minX + maxX) / 2;
            const pivotY = (minY + maxY) / 2;
            let startAngle = 0;
            if (mode === 'rotate') {
                startAngle = Math.atan2(pos.y - pivotY, pos.x - pivotX);
            }
            
            _transformData = {
                boxStart: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
                pivot: { x: pivotX, y: pivotY },
                startAngle: startAngle
            };
        }
    }

    function updateDrag(pos) {
        if (!_dragStart) return false;
        const dx = pos.x - _dragStart.x, dy = pos.y - _dragStart.y;
        if (!_dragging && Math.hypot(dx, dy) < 2) return false;
        _dragging = true;

        if (_transformMode) {
            _updateTransform(pos, dx, dy);
            return true;
        }

        if (isNodeMode() && _nodeSnapshots.length) {
            _nodeSelection.forEach(sel => {
                const targetEl = sel.el;
                const snap = _nodeSnapshots.find(s => s.el === targetEl);
                if (!snap) return;
                const p = snap.points[sel.index];
                const currentPoints = _getPathPoints(targetEl);
                
                let ldx = dx, ldy = dy;
                try {
                    const ctm = targetEl.parentElement ? targetEl.parentElement.getScreenCTM() : targetEl.ownerSVGElement.getScreenCTM();
                    if (ctm) {
                        const inv = ctm.inverse();
                        ldx = dx * inv.a + dy * inv.c;
                        ldy = dx * inv.b + dy * inv.d;
                    }
                } catch(e) {}

                if (sel.type === 'node') {
                    currentPoints[sel.index].x = p.x + ldx;
                    currentPoints[sel.index].y = p.y + ldy;
                    if (p.cp1) { currentPoints[sel.index].cp1.x = p.cp1.x + ldx; currentPoints[sel.index].cp1.y = p.cp1.y + ldy; }
                    if (p.cp2) { currentPoints[sel.index].cp2.x = p.cp2.x + ldx; currentPoints[sel.index].cp2.y = p.cp2.y + ldy; }
                } else if (sel.type === 'cp1') {
                    currentPoints[sel.index].cp1.x = p.cp1.x + ldx;
                    currentPoints[sel.index].cp1.y = p.cp1.y + ldy;
                } else if (sel.type === 'cp2') {
                    currentPoints[sel.index].cp2.x = p.cp2.x + ldx;
                    currentPoints[sel.index].cp2.y = p.cp2.y + ldy;
                }
                _setPathPoints(targetEl, currentPoints);
            });
        } else if (_snapshots.length) {
            let snapDx = dx;
            let snapDy = dy;
            // Use original bbox + mouse delta so snap never oscillates
            if (typeof window.illuCalculateEdgeSnap === 'function' && _snapshotOrigBBox) {
                const snapped = window.illuCalculateEdgeSnap(_snapshotOrigBBox, dx, dy, _snapshots.map(s => s.el));
                snapDx = snapped.dx;
                snapDy = snapped.dy;
            }
            _snapshots.forEach((s) => _applyDrag(s.el, s.base, snapDx, snapDy));
        }

        if (
            typeof window.illuVectorPreferBitmapSelectionUI === 'function' &&
            window.illuVectorPreferBitmapSelectionUI()
        ) {
            if (typeof window.illuScheduleVectorShapeEditVisual === 'function') {
                window.illuScheduleVectorShapeEditVisual();
            } else if (typeof window.illuSyncVectorSelectionAnchors === 'function') {
                window.illuSyncVectorSelectionAnchors();
            }
        } else {
            refreshSelectionUI();
        }
        return true;
    }

    function _updateTransform(pos, dx, dy) {
        if (!_transformData || _snapshots.length === 0) return;
        const { boxStart } = _transformData;
        const mode = _transformMode;

        if (mode === 'rotate') {
            const pivot = _transformData.pivot;
            let currentAngle = Math.atan2(pos.y - pivot.y, pos.x - pivot.x);
            let angleDiff = currentAngle - _transformData.startAngle;
            let deg = angleDiff * 180 / Math.PI;

            if (window._shiftConstraintProportions) {
                const snap = 15;
                deg = Math.round(deg / snap) * snap;
            }

            _snapshots.forEach(snap => {
                const el = snap.el;
                const baseTr = (snap.base && snap.base.transform) || '';
                const m = `rotate(${deg} ${pivot.x} ${pivot.y})`;
                el.setAttribute('transform', [m, baseTr].filter(Boolean).join(' '));
            });
            refreshSelectionUI();
            return;
        }

        if (!['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].includes(mode)) return;

        let scaleX = 1;
        let scaleY = 1;
        let pivot = { x: boxStart.x + boxStart.w / 2, y: boxStart.y + boxStart.h / 2 };
        
        if (mode.includes('n')) pivot.y = boxStart.y + boxStart.h;
        if (mode.includes('s')) pivot.y = boxStart.y;
        if (mode.includes('w')) pivot.x = boxStart.x + boxStart.w;
        if (mode.includes('e')) pivot.x = boxStart.x;
        
        let dw = 0, dh = 0;
        if (mode.includes('e')) dw = dx;
        if (mode.includes('w')) dw = -dx;
        if (mode.includes('s')) dh = dy;
        if (mode.includes('n')) dh = -dy;
        
        scaleX = (boxStart.w + dw) / (boxStart.w || 1);
        scaleY = (boxStart.h + dh) / (boxStart.h || 1);
        
        if (mode === 'n' || mode === 's') scaleX = 1;
        if (mode === 'e' || mode === 'w') scaleY = 1;

        if (window._shiftConstraintProportions && mode.length === 2) {
            const aspect = boxStart.w / boxStart.h;
            if (Math.abs(dx) > Math.abs(dy)) {
                scaleY = scaleX;
            } else {
                scaleX = scaleY;
            }
        }
        
        _snapshots.forEach(snap => {
            const el = snap.el;
            const baseTr = _cleanTransformStr(snap.base && snap.base.transform);
            const tx = pivot.x - pivot.x * scaleX;
            const ty = pivot.y - pivot.y * scaleY;
            const m = `matrix(${scaleX} 0 0 ${scaleY} ${tx} ${ty})`;
            el.setAttribute('transform', [m, baseTr].filter(Boolean).join(' ').trim());
        });
        refreshSelectionUI();
    }

    function endDrag() {
        if (typeof window.illuClearSnapGuides === 'function') window.illuClearSnapGuides();
        const moved = _dragging;
        const draggedEls = _snapshots.map((s) => s.el).filter((el) => el && el.isConnected);
        _snapshots = [];
        _snapshotOrigBBox = null;
        _nodeSnapshots = [];
        _dragStart = null;
        _dragging = false;
        _setVectorDragActive(false);
        _uiBuiltForDrag = false;
        if (_uiRefreshRaf) {
            cancelAnimationFrame(_uiRefreshRaf);
            _uiRefreshRaf = 0;
        }
        if (
            moved &&
            draggedEls.length &&
            typeof window.illuVectorBakeSelectionTransforms === 'function'
        ) {
            window.illuVectorBakeSelectionTransforms(draggedEls);
            if (typeof window.illuSyncVectorSelectionUI === 'function') {
                window.illuSyncVectorSelectionUI();
            }
        }
        return moved;
    }

    function refreshLiveVectorShapeStyle(el, kind) {
        if (!el || typeof window.applyVectorShapePaint !== 'function') return;
        window.applyVectorShapePaint(el, kind);
        if (el.getAttribute('data-vgrad') && typeof window.syncVectorGradientBoundsForEl === 'function') {
            window.syncVectorGradientBoundsForEl(el);
        }
    }

    // ─── Outil Pen (click-to-place) ──────────────────────────────────────────
    function penStart(pos, layer, color, strokeW, type = 'quad') {
        if (_penState) { penCommit(); return; }
        const el = document.createElementNS(NS, 'path');
        el.setAttribute('d', `M ${pos.x} ${pos.y}`);
        el.setAttribute('stroke', color);
        el.setAttribute('fill', 'none');
        el.setAttribute('stroke-width', String(strokeW));
        el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('stroke-linejoin', 'round');
        el.setAttribute('data-illu-pen', type === 'cubic' ? '2' : '1');
        layer.appendChild(el);
        _penState = { points: [pos], previewEl: el, layer, type };
        refreshLiveVectorShapeStyle(el, 'line');
        _drawPenHints();
    }

    function penAddPoint(pos) {
        if (!_penState) return;
        _penState.points.push(pos);
        _rebuildPenPath();
        _drawPenHints();
    }

    function penPreview(pos) {
        if (!_penState || !_penState.points.length) return;
        _rebuildPenPath(pos);
    }

    function _rebuildPenPath(cursorPos) {
        if (!_penState) return;
        const pts = _penState.points;
        if (!pts.length) return;
        
        let d = `M ${pts[0].x} ${pts[0].y}`;
        const isCubic = _penState.type === 'cubic';

        if (isCubic) {
            for (let i = 1; i < pts.length; i++) {
                const p0 = pts[i-1], p1 = pts[i];
                // Smooth cubic interpolation
                const cp1x = p0.x + (p1.x - p0.x) * 0.3;
                const cp1y = p0.y + (p1.y - p0.y) * 0.3;
                const cp2x = p0.x + (p1.x - p0.x) * 0.7;
                const cp2y = p0.y + (p1.y - p0.y) * 0.7;
                d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p1.x} ${p1.y}`;
            }
            if (cursorPos) {
                const last = pts[pts.length - 1];
                const cp1x = last.x + (cursorPos.x - last.x) * 0.3;
                const cp1y = last.y + (cursorPos.y - last.y) * 0.3;
                d += ` Q ${last.x} ${last.y} ${cursorPos.x} ${cursorPos.y}`; // Preview as Quad for speed
            }
        } else {
            for (let i = 1; i < pts.length; i++) {
                const p0 = pts[i-1], p1 = pts[i];
                const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
                d += ` Q ${p0.x} ${p0.y} ${mx} ${my}`;
            }
            if (cursorPos) {
                const last = pts[pts.length - 1];
                const mx = (last.x + cursorPos.x) / 2, my = (last.y + cursorPos.y) / 2;
                d += ` Q ${last.x} ${last.y} ${mx} ${my}`;
            }
        }
        _penState.previewEl.setAttribute('d', d);
        refreshLiveVectorShapeStyle(_penState.previewEl, 'line');
    }

    function penClose() {
        if (!_penState || _penState.points.length < 2) { penCancel(); return; }
        const pts = _penState.points;
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
        d += ' Z';
        _penState.previewEl.setAttribute('d', d);
        _penState.previewEl.removeAttribute('data-illu-pen');
        const el = _penState.previewEl;
        if (typeof window.applyVectorShapePaint === 'function') {
            window.applyVectorShapePaint(el, 'shape');
            if (el.getAttribute('data-vgrad')) window.syncVectorGradientBoundsForEl(el);
        }
        _commitEl(el, 'Tracé plume fermé');
        _penState = null; _clearPenHints();
    }

    function penCommit() {
        if (!_penState || _penState.points.length < 2) { penCancel(); return; }
        const el = _penState.previewEl;
        const pts = _penState.points.slice();
        const lineEnd = pts.length ? pts[pts.length - 1] : null;
        if (EditorManager.isPixelMode) {
            penCommitToCanvas(el, lineEnd);
            if (el.parentElement) el.parentElement.removeChild(el);
            _penState = null;
            _clearPenHints();
        } else {
            if (typeof window.applyVectorShapePaint === 'function') {
                window.applyVectorShapePaint(el, 'line');
                if (el.getAttribute('data-vgrad')) window.syncVectorGradientBoundsForEl(el);
            }
            _commitEl(el, 'Tracé plume');
            _penState = null;
            _clearPenHints();
        }
    }

    function penCancel() {
        if (_penState?.previewEl?.parentElement) _penState.previewEl.parentElement.removeChild(_penState.previewEl);
        _penState = null; _clearPenHints();
    }

    function _drawPenHints() {
        const ui = getUI();
        if (!ui || !_penState) return;
        ui.querySelectorAll('.ve-pen-dot').forEach(n => n.remove());
        const z = zoom();
        _penState.points.forEach((p, i) => {
            if (p.cp1 || p.cp2) {
                const cp1 = p.cp1 || p;
                const cp2 = p.cp2 || p;
                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', String(cp1.x)); line.setAttribute('y1', String(cp1.y));
                line.setAttribute('x2', String(cp2.x)); line.setAttribute('y2', String(cp2.y));
                line.setAttribute('stroke', '#a0a0a0'); line.setAttribute('stroke-width', String(1/z));
                line.setAttribute('pointer-events', 'none');
                line.classList.add('ve-pen-dot');
                ui.appendChild(line);
                
                [p.cp1, p.cp2].forEach(cp => {
                    if (!cp) return;
                    const c = document.createElementNS(NS, 'circle');
                    c.setAttribute('cx', String(cp.x)); c.setAttribute('cy', String(cp.y));
                    c.setAttribute('r', String(3 / z));
                    c.setAttribute('fill', '#ffffff');
                    c.setAttribute('stroke', '#a0a0a0'); c.setAttribute('stroke-width', String(1/z));
                    c.setAttribute('pointer-events', 'none');
                    c.classList.add('ve-pen-dot');
                    ui.appendChild(c);
                });
            }
            
            const c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', String(p.x)); c.setAttribute('cy', String(p.y));
            c.setAttribute('r', String(4 / z));
            c.setAttribute('fill', i === 0 ? '#ff6b00' : SEL_PRIMARY);
            c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', String(1/z));
            c.setAttribute('vector-effect', 'non-scaling-stroke');
            c.setAttribute('pointer-events', 'none');
            c.classList.add('ve-pen-dot');
            ui.appendChild(c);
        });
    }

    function _clearPenHints() {
        const ui = getUI();
        if (ui) ui.querySelectorAll('.ve-pen-dot').forEach(n => n.remove());
    }

    function isPenActive() { return !!_penState; }

    // ─── Outil Polygon (click-to-place) ──────────────────────────────────────
    function polygonStart(pos, layer, color) {
        if (_polyState) { polygonCommit(); return; }
        const el = document.createElementNS(NS, 'polygon');
        el.setAttribute('points', `${pos.x},${pos.y}`);
        el.setAttribute('fill', color || 'none');
        el.setAttribute('data-illu-polygon-live', '1');
        layer.appendChild(el);
        _polyState = { points: [pos], previewEl: el, layer };
        refreshLiveVectorShapeStyle(el, 'shape');
        _drawPolyHints();
    }

    function polygonAddPoint(pos) {
        if (!_polyState) return;
        _polyState.points.push(pos);
        _rebuildPolyPoints();
        _drawPolyHints();
    }

    function polygonPreview(pos) {
        if (!_polyState) return;
        const pts = [..._polyState.points, pos];
        _polyState.previewEl.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
        refreshLiveVectorShapeStyle(_polyState.previewEl, 'shape');
    }

    function _rebuildPolyPoints() {
        if (!_polyState) return;
        _polyState.previewEl.setAttribute('points', _polyState.points.map(p => `${p.x},${p.y}`).join(' '));
        refreshLiveVectorShapeStyle(_polyState.previewEl, 'shape');
    }

    function polygonCommit() {
        if (!_polyState || _polyState.points.length < 3) { polygonCancel(); return; }
        const el = _polyState.previewEl;
        el.removeAttribute('data-illu-polygon-live');
        if (EditorManager.isPixelMode) {
            polygonCommitToCanvas(el);
            if (el.parentElement) el.parentElement.removeChild(el);
        } else {
            if (typeof window.applyVectorShapePaint === 'function') {
                window.applyVectorShapePaint(el, 'shape');
                if (el.getAttribute('data-vgrad')) window.syncVectorGradientBoundsForEl(el);
            }
            _commitEl(el, 'Polygone');
        }
        _polyState = null;
        _clearPolyHints();
    }

    function polygonCancel() {
        if (_polyState?.previewEl?.parentElement) _polyState.previewEl.parentElement.removeChild(_polyState.previewEl);
        _polyState = null; _clearPolyHints();
    }

    function _drawPolyHints() {
        const ui = getUI();
        if (!ui || !_polyState) return;
        ui.querySelectorAll('.ve-poly-dot').forEach(n => n.remove());
        const z = zoom();
        _polyState.points.forEach((p, i) => {
            const c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', String(p.x)); c.setAttribute('cy', String(p.y));
            c.setAttribute('r', String(i === 0 ? 5/z : 3.5/z));
            c.setAttribute('fill', i === 0 ? '#ff6b00' : '#fff');
            c.setAttribute('stroke', SEL_PRIMARY); c.setAttribute('stroke-width', String(1.5/z));
            c.setAttribute('vector-effect', 'non-scaling-stroke');
            c.setAttribute('pointer-events', 'none');
            c.classList.add('ve-poly-dot');
            ui.appendChild(c);
        });
    }

    function _clearPolyHints() {
        const ui = getUI();
        if (ui) ui.querySelectorAll('.ve-poly-dot').forEach(n => n.remove());
    }

    function isPolygonActive() { return !!_polyState; }

    // ─── Commit générique (après création pen/polygon) ───────────────────────
    function _commitEl(el, label) {
        EditorManager.activeVectorSelection = [el];
        window._activeVectorShapeEl = el;
        refreshSelectionUI();
        EditorManager.saveHistory(label || 'Vecteur', { patchActiveLayer: true });
        if (typeof illuScheduleInteractiveVisualRefresh === 'function') {
            illuScheduleInteractiveVisualRefresh({ render: true });
        } else {
            EditorManager.render();
        }
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    }

    // ─── Annulation globale ──────────────────────────────────────────────────
    function cancelAll() {
        penCancel(); polygonCancel();
        _rubberBand = null;
        _snapshots = []; _dragStart = null; _dragging = false;
    }

    // ─── Fill vectoriel ──────────────────────────────────────────────────────
    function fillShape(el, color) {
        if (!el) return;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'line' || (tag === 'path' && el.getAttribute('fill') === 'none'))
            el.setAttribute('stroke', color);
        else
            el.setAttribute('fill', color);
        
        EditorManager.saveHistory('Remplissage vecteur', { patchActiveLayer: true });
        if (typeof illuScheduleInteractiveVisualRefresh === 'function') {
            illuScheduleInteractiveVisualRefresh({ render: true });
        } else {
            EditorManager.render();
        }
    }

    /**
     * Applique couleur/style aux formes sélectionnées sans réinitialiser la sélection.
     * Appelé quand l'utilisateur change la couleur ou les options d'outil APRÈS avoir dessiné.
     */
    function applyStyleToSelection() {
        if (EditorManager.mode !== 'vector') return;
        const targets = EditorManager.activeVectorSelection;
        if (!targets || !targets.length) return;

        const primary = (typeof window.shapePrimaryFillCss === 'function')
            ? window.shapePrimaryFillCss()
            : (EditorManager.activeColor || '#000000');
        targets.forEach(el => {
            if (!el || !el.isConnected) return;
            const tag = (el.tagName || '').toLowerCase();

            if (tag === 'foreignobject') {
                // Texte : couleur du div éditeur
                const div = el.querySelector('div[contenteditable]');
                if (div) {
                    div.style.color = typeof primary === 'string' ? primary : `rgb(${primary.r},${primary.g},${primary.b})`;
                    const tp = EditorManager.toolProps;
                    if (tp.textSize) div.style.fontSize = tp.textSize + 'px';
                    if (tp.textFont) div.style.fontFamily = tp.textFont;
                    if (tp.textBold != null) div.style.fontWeight = tp.textBold ? 'bold' : 'normal';
                    if (tp.textItalic != null) div.style.fontStyle = tp.textItalic ? 'italic' : 'normal';
                }
                return;
            }

            if (typeof window.applyVectorShapePaint !== 'function') return;
            const isLineEl =
                tag === 'line' ||
                (tag === 'path' &&
                    (el.getAttribute('data-illu-line-cubic') === '1' ||
                        el.getAttribute('data-illu-line-straight') === '1' ||
                        el.getAttribute('data-illu-stroke-only') === '1' ||
                        el.getAttribute('data-illu-quad-3') === '1' ||
                        el.getAttribute('data-illu-pen')));
            const closedPath = tag === 'path' && !isLineEl && (el.getAttribute('d') || '').trim().endsWith('Z');
            const kind = isLineEl ? 'line' : 'shape';
            window.applyVectorShapePaint(el, closedPath ? 'shape' : kind);
            if (el.getAttribute('data-vgrad') && typeof window.syncVectorGradientBoundsForEl === 'function') {
                window.syncVectorGradientBoundsForEl(el);
            }
        });

        if (typeof illuScheduleInteractiveVisualRefresh === 'function') {
            illuScheduleInteractiveVisualRefresh({ render: true });
        } else {
            EditorManager.render();
        }
    }

    function penCommitToCanvas(el, lineEnd) {
        if (!el || !EditorManager || !EditorManager.isPixelMode) return;
        if (typeof window.rasterizePixelSvgShapeWithToolProps === 'function') {
            window.rasterizePixelSvgShapeWithToolProps(el, {
                closed: !el.getAttribute('data-illu-pen'),
                lineEnd: lineEnd || null
            });
        }
        EditorManager.saveHistory('Plume (pixel)', { patchActiveLayer: true });
        if (typeof illuScheduleInteractiveVisualRefresh === 'function') {
            illuScheduleInteractiveVisualRefresh({ render: true, renderOpts: { flushUiThumbnails: true } });
        } else {
            EditorManager.render({ flushUiThumbnails: true });
        }
    }

    function polygonCommitToCanvas(el) {
        if (!el || !EditorManager || !EditorManager.isPixelMode) return;
        if (typeof window.rasterizePixelSvgShapeWithToolProps === 'function') {
            window.rasterizePixelSvgShapeWithToolProps(el, { closed: true });
        }
        EditorManager.saveHistory('Polygone (pixel)', { patchActiveLayer: true });
        if (typeof illuScheduleInteractiveVisualRefresh === 'function') {
            illuScheduleInteractiveVisualRefresh({ render: true, renderOpts: { flushUiThumbnails: true } });
        } else {
            EditorManager.render({ flushUiThumbnails: true });
        }
    }

    function refreshLiveDrawPreview() {
        if (_penState?.previewEl) refreshLiveVectorShapeStyle(_penState.previewEl, 'line');
        if (_polyState?.previewEl) refreshLiveVectorShapeStyle(_polyState.previewEl, 'shape');
    }

    // ─── API publique ────────────────────────────────────────────────────────
    return {
        refreshSelectionUI,
        refreshLiveDrawPreview,
        clearUI: _clearUI,
        hitTest,
        startRubberBand:  _startRubberBand,
        updateRubberBand: _updateRubberBand,
        commitRubberBand: _commitRubberBand,
        beginDrag, updateDrag, endDrag,
        penStart, penAddPoint, penPreview, penClose, penCommit, penCancel,
        isPenActive,
        polygonStart, polygonAddPoint, polygonPreview, polygonCommit, polygonCancel,
        isPolygonActive,
        cancelAll,
        fillShape,
        applyStyleToSelection,
        clearNodeSelection: _clearNodeSelection,
        beginTransform,
        penCommitToCanvas,
        polygonCommitToCanvas,
    };
})();

// -- Vector Properties Bar --
window.illuSyncVectorPropertiesBar = function() {
    const pX = document.getElementById('vec-prop-x');
    if (!pX) return;
    const sel = EditorManager.activeVectorSelection;
    if (!sel || sel.length === 0) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    sel.forEach(el => {
        try {
            const b = el.getBBox();
            if (b.x < minX) minX = b.x;
            if (b.y < minY) minY = b.y;
            if (b.x + b.width > maxX) maxX = b.x + b.width;
            if (b.y + b.height > maxY) maxY = b.y + b.height;
        } catch(e) {}
    });
    
    if (minX === Infinity) return;
    
    let angle = 0;
    const primary = sel[sel.length - 1];
    if (primary && primary.transform && primary.transform.baseVal) {
        for (let i = 0; i < primary.transform.baseVal.numberOfItems; i++) {
            const tr = primary.transform.baseVal.getItem(i);
            if (tr.type === SVGTransform.SVG_TRANSFORM_ROTATE) {
                angle += tr.angle;
            }
        }
    }
    angle = angle % 360;

    pX.value = Math.round(minX);
    document.getElementById('vec-prop-y').value = Math.round(minY);
    document.getElementById('vec-prop-w').value = Math.round(maxX - minX);
    document.getElementById('vec-prop-h').value = Math.round(maxY - minY);
    document.getElementById('vec-prop-angle').value = Math.round(angle);
};

document.addEventListener('DOMContentLoaded', () => {
    ['x', 'y', 'w', 'h', 'angle'].forEach(prop => {
        const input = document.getElementById('vec-prop-' + prop);
        if (input) {
            input.addEventListener('change', (e) => {
                const sel = EditorManager.activeVectorSelection;
                if (!sel || !sel.length) return;
                const val = parseFloat(e.target.value);
                if (isNaN(val)) return;
                
                const primary = sel[sel.length - 1];
                if (prop === 'x') primary.setAttribute('x', val);
                if (prop === 'y') primary.setAttribute('y', val);
                if (prop === 'w') primary.setAttribute('width', val);
                if (prop === 'h') primary.setAttribute('height', val);
                if (prop === 'angle') {
                    let cx = parseFloat(primary.getAttribute('x')) || 0;
                    let cy = parseFloat(primary.getAttribute('y')) || 0;
                    let cw = parseFloat(primary.getAttribute('width')) || 0;
                    let ch = parseFloat(primary.getAttribute('height')) || 0;
                    cx += cw/2;
                    cy += ch/2;
                    const baseTr = (primary.getAttribute('transform') || '').replace(/rotate\([^)]+\)/g, '').trim();
                    primary.setAttribute('transform', `rotate(${val} ${cx} ${cy}) ${baseTr}`.trim());
                }
                if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
                EditorManager.render();
            });
        }
    });
});
