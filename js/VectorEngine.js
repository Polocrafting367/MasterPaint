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
    let _snapshots  = [];     // [{ el, base }] pour multi-drag
    let _dragStart  = null;   // {x,y}
    let _dragging   = false;
    let _activeEl   = null;
    let _transformMode = null; // 'deform' | 'warp-4'
    let _transformData = null; // { boxStart: {x,y,w,h}, pivot:{x,y} }

    // Node editing
    let _nodeSelection = [];  // [{ el, index, type: 'node'|'cp1'|'cp2' }]
    let _nodeSnapshots = [];  // [{ el, points:[] }]

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

    /**
     * Redessine tous les handles + boîtes pour activeVectorSelection.
     * Les handles suivent toujours la position réelle de la forme (getBBox).
     */
    function refreshSelectionUI() {
        const ui = getUI();
        if (!ui) return;

        // Préserver les hints pen/polygon
        const penDots  = [...ui.querySelectorAll('.ve-pen-dot')];
        const polyDots = [...ui.querySelectorAll('.ve-poly-dot')];

        ui.innerHTML = '';

        // Remettre les hints
        penDots.forEach(n => ui.appendChild(n));
        polyDots.forEach(n => ui.appendChild(n));

        const sel = EditorManager.activeVectorSelection;
        if (!sel || !sel.length) return;

        const z = zoom();
        const hz = _hz();

        const nodeMode = isNodeMode();

        sel.forEach((el, idx) => {
            try {
                const tag = el.tagName.toLowerCase();
                const isPrimary = idx === sel.length - 1;

                if (nodeMode && (tag === 'path' || tag === 'polygon' || tag === 'polyline')) {
                    _drawPathNodes(ui, el, z, hz);
                }

                // Utiliser le CTM pour avoir la position réelle dans le repère du SVG UI
                const bb = el.getBBox();
                const ctm = el.getCTM();
                if (!bb || !ctm) return;

                // Transformer les 4 coins de la BBox
                const pts = [
                    {x: bb.x, y: bb.y},
                    {x: bb.x + bb.width, y: bb.y},
                    {x: bb.x + bb.width, y: bb.y + bb.height},
                    {x: bb.x, y: bb.y + bb.height}
                ].map(p => {
                    return {
                        x: p.x * ctm.a + p.y * ctm.c + ctm.e,
                        y: p.x * ctm.b + p.y * ctm.d + ctm.f
                    };
                });

                const minX = Math.min(...pts.map(p => p.x));
                const minY = Math.min(...pts.map(p => p.y));
                const maxX = Math.max(...pts.map(p => p.x));
                const maxY = Math.max(...pts.map(p => p.y));
                const rw = maxX - minX;
                const rh = maxY - minY;

                if (rw < 0.1 && rh < 0.1) return;

                // Contour de sélection
                const rect = document.createElementNS(NS, 'rect');
                rect.setAttribute('x',      String(minX));
                rect.setAttribute('y',      String(minY));
                rect.setAttribute('width',  String(rw));
                rect.setAttribute('height', String(rh));
                rect.setAttribute('fill',   'none');
                rect.setAttribute('stroke', isPrimary ? SEL_PRIMARY : SEL_SECONDARY);
                rect.setAttribute('stroke-width', String(1.5 / z));
                if (!isPrimary) rect.setAttribute('stroke-dasharray', String(4/z) + ',' + String(2/z));
                rect.setAttribute('pointer-events', 'none');
                ui.appendChild(rect);

                if (isPrimary && !nodeMode) {
                    _drawHandles(ui, {x: minX, y: minY, width: rw, height: rh}, hz, z);
                }
            } catch(e) { console.error("refreshSelectionUI error:", e); }
        });

        if (sel.length > 1 && !nodeMode) _drawGroupBBox(ui, sel, z, hz);
    }

    function _drawPathNodes(ui, el, z, hz) {
        const points = _getPathPoints(el);
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

    function _drawHandles(ui, bb, hz, z) {
        const { x, y, width: w, height: h } = bb;
        [
            { cx: x,     cy: y,     cur: 'nw-resize' },
            { cx: x+w/2, cy: y,     cur: 'n-resize'  },
            { cx: x+w,   cy: y,     cur: 'ne-resize'  },
            { cx: x,     cy: y+h/2, cur: 'w-resize'  },
            { cx: x+w,   cy: y+h/2, cur: 'e-resize'  },
            { cx: x,     cy: y+h,   cur: 'sw-resize' },
            { cx: x+w/2, cy: y+h,   cur: 's-resize'  },
            { cx: x+w,   cy: y+h,   cur: 'se-resize' },
        ].forEach(({ cx, cy, cur }, idx) => {
            const r = document.createElementNS(NS, 'rect');
            r.setAttribute('x',      String(cx - hz));
            r.setAttribute('y',      String(cy - hz));
            r.setAttribute('width',  String(hz * 2));
            r.setAttribute('height', String(hz * 2));
            r.setAttribute('rx',     String(hz * 0.35));
            r.setAttribute('fill',   '#ffffff');
            r.setAttribute('stroke', SEL_PRIMARY);
            r.setAttribute('stroke-width', String(1.2 / z));
            r.setAttribute('vector-effect', 'non-scaling-stroke');
            r.setAttribute('class', 'svg-resize-handle');
            r.setAttribute('pointer-events', 'auto');
            r.dataset.handleIdx = String(idx);
            r.style.cursor = cur;
            ui.appendChild(r);
        });
    }

    function _drawGroupBBox(ui, sel, z, hz) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        sel.forEach(el => {
            try {
                const bb = getPreciseBBox(el);
                minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
                maxX = Math.max(maxX, bb.x + bb.width);
                maxY = Math.max(maxY, bb.y + bb.height);
            } catch(e) {}
        });
        if (!isFinite(minX)) return;
        const bb = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x',      String(bb.x - 2/z));
        r.setAttribute('y',      String(bb.y - 2/z));
        r.setAttribute('width',  String(bb.width + 4/z));
        r.setAttribute('height', String(bb.height + 4/z));
        r.setAttribute('fill',   'none');
        r.setAttribute('stroke', SEL_PRIMARY);
        r.setAttribute('stroke-width', String(1/z));
        r.setAttribute('stroke-dasharray', String(4/z));
        r.setAttribute('pointer-events', 'none');
        ui.appendChild(r);

        _drawHandles(ui, bb, hz, z);
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

        const layer = getLayer();
        if (!layer) return;
        const hits = [];
        const SEL = 'rect,ellipse,circle,line,path,polygon,polyline,foreignObject,text,g[data-illu-group]';
        layer.querySelectorAll(SEL).forEach(el => {
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

        const layer = getLayer();
        if (!layer) return null;
        const canvasEl = document.getElementById('main-canvas-container');
        if (!canvasEl) return null;
        const cr = canvasEl.getBoundingClientRect();
        const z = zoom();
        const clientX = evt ? evt.clientX : cr.left + pos.x * z;
        const clientY = evt ? evt.clientY : cr.top  + pos.y * z;
        const SEL = 'rect,ellipse,circle,line,path,polygon,polyline,foreignObject,text,g[data-illu-group]';
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
    function _snapshot(el) {
        return { transform: el.getAttribute('transform') || '' };
    }

    function _applyDrag(el, base, dx, dy) {
        let ldx = dx, ldy = dy;
        try {
            const p = el.parentElement;
            // On veut le CTM du parent par rapport au SVG racine pour transformer le delta canvas -> local parent
            const ctm = p ? p.getScreenCTM() : el.ownerSVGElement.getScreenCTM();
            if (ctm) {
                const inv = ctm.inverse();
                // On transforme le vecteur delta (dx, dy)
                ldx = dx * inv.a + dy * inv.c;
                ldy = dx * inv.b + dy * inv.d;
            }
        } catch(e) {}
        
        // Appliquer la translation AU DÉBUT pour qu'elle soit dans le repère du parent
        const newTr = `translate(${ldx},${ldy}) ${base.transform}`.trim();
        el.setAttribute('transform', newTr);
    }

    function beginDrag(sel, pos, evt) {
        console.log("VectorEngine.beginDrag", { selCount: sel.length, pos, tool: window.activeTool });
        const nodeMode = isNodeMode();
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
            const resizeHandle = target?.closest('.svg-resize-handle');
            if (resizeHandle) {
                const cursors = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
                const idx = parseInt(resizeHandle.dataset.handleIdx);
                beginTransform(sel, pos, cursors[idx]);
                return;
            }
            _snapshots = sel.map(el => ({ el, base: _snapshot(el) }));
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
            _transformData = {
                boxStart: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
                pivot: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
            };
        }
    }

    function updateDrag(pos) {
        if (!_dragStart) return false;
        const dx = pos.x - _dragStart.x, dy = pos.y - _dragStart.y;
        if (!_dragging && Math.hypot(dx, dy) < 2) return false;
        if (!_dragging) console.log("VectorEngine drag actually started moving", { dx, dy, snapshots: _snapshots.length });
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
            _snapshots.forEach(s => _applyDrag(s.el, s.base, dx, dy));
        }

        refreshSelectionUI();
        return true;
    }

    function _updateTransform(pos, dx, dy) {
        if (!_transformData || _snapshots.length === 0) return;
        const { boxStart } = _transformData;
        const mode = _transformMode;

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
            const baseTr = snap.base.transform;
            const tx = pivot.x - pivot.x * scaleX;
            const ty = pivot.y - pivot.y * scaleY;
            const m = `matrix(${scaleX} 0 0 ${scaleY} ${tx} ${ty})`;
            el.setAttribute('transform', `${m} ${baseTr}`.trim());
        });
        refreshSelectionUI();
    }

    function endDrag() {
        const moved = _dragging;
        _snapshots = []; _nodeSnapshots = []; _dragStart = null; _dragging = false;
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
        if (EditorManager.isPixelMode || EditorManager.mode === 'pixel') {
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
        if (EditorManager.isPixelMode || EditorManager.mode === 'pixel') {
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
        if (typeof EditorManager.syncActiveVectorSvg === 'function') EditorManager.syncActiveVectorSvg();
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
        if (typeof EditorManager.syncActiveVectorSvg === 'function') EditorManager.syncActiveVectorSvg();
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
