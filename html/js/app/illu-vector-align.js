/**
 * illu-vector-align.js — Alignement, Distribution et Guides SVG (Phase 2 + Module 6)
 *
 * Alignement : gauche, centre H, droite, haut, centre V, bas
 * Distribution : espacer horizontalement / verticalement
 * Flip H/V
 * Guides : lignes glissables sur le canvas SVG avec snap
 */
'use strict';
(function (global) {

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _getSel() {
        const em = global.EditorManager;
        return em && em.activeVectorSelection && em.activeVectorSelection.length
            ? em.activeVectorSelection
            : null;
    }

    function _getBBox(el) {
        try { return el.getBBox(); } catch (e) { return null; }
    }

    function _getDocSize() {
        const em = global.EditorManager;
        const p = em && em.activeProject;
        return p ? { w: p.width || p.canvasWidth || 1280, h: p.height || p.canvasHeight || 720 } : { w: 1280, h: 720 };
    }

    function _save(label) {
        const em = global.EditorManager;
        if (em && em.saveHistory) em.saveHistory(label, { patchActiveLayer: true });
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        if (typeof illuScheduleInteractiveVisualRefresh === 'function') {
            illuScheduleInteractiveVisualRefresh({ render: true });
        } else if (em && em.render) em.render();
    }

    // ─── Translation propre (via transform) ───────────────────────────────────

    function _translate(el, dx, dy) {
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
        // Essayer de déplacer les attributs de position directement
        const tag = (el.tagName || '').toLowerCase();
        const moved = _tryMoveByAttrib(el, tag, dx, dy);
        if (!moved) {
            // Fallback : ajout d'un translate dans la transform
            const cur = el.getAttribute('transform') || '';
            // Extraire le translate existant pour le cumuler
            const m = cur.match(/translate\(\s*([-\d.]+)\s*,?\s*([-\d.]+)?\s*\)/);
            if (m) {
                const ox = parseFloat(m[1]) || 0;
                const oy = parseFloat(m[2]) || 0;
                const rest = cur.replace(m[0], '').trim();
                el.setAttribute('transform', `translate(${_r(ox+dx)},${_r(oy+dy)})${rest ? ' ' + rest : ''}`);
            } else {
                el.setAttribute('transform', `translate(${_r(dx)},${_r(dy)}) ${cur}`.trim());
            }
        }
    }

    function _r(v) { return Math.round(v * 100) / 100; }

    function _tryMoveByAttrib(el, tag, dx, dy) {
        if (tag === 'rect' || tag === 'image' || tag === 'foreignobject') {
            const x = parseFloat(el.getAttribute('x') || 0) + dx;
            const y = parseFloat(el.getAttribute('y') || 0) + dy;
            el.setAttribute('x', _r(x));
            el.setAttribute('y', _r(y));
            return true;
        }
        if (tag === 'circle' || tag === 'ellipse') {
            el.setAttribute('cx', _r(parseFloat(el.getAttribute('cx') || 0) + dx));
            el.setAttribute('cy', _r(parseFloat(el.getAttribute('cy') || 0) + dy));
            return true;
        }
        if (tag === 'line') {
            el.setAttribute('x1', _r(parseFloat(el.getAttribute('x1') || 0) + dx));
            el.setAttribute('y1', _r(parseFloat(el.getAttribute('y1') || 0) + dy));
            el.setAttribute('x2', _r(parseFloat(el.getAttribute('x2') || 0) + dx));
            el.setAttribute('y2', _r(parseFloat(el.getAttribute('y2') || 0) + dy));
            return true;
        }
        if (tag === 'text') {
            el.setAttribute('x', _r(parseFloat(el.getAttribute('x') || 0) + dx));
            el.setAttribute('y', _r(parseFloat(el.getAttribute('y') || 0) + dy));
            return true;
        }
        return false;
    }

    // ─── Boîte englobante commune ─────────────────────────────────────────────

    function _getUnionBBox(sel) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        sel.forEach(el => {
            const bb = _getBBox(el);
            if (!bb) return;
            minX = Math.min(minX, bb.x);
            minY = Math.min(minY, bb.y);
            maxX = Math.max(maxX, bb.x + bb.width);
            maxY = Math.max(maxY, bb.y + bb.height);
        });
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    // ─── Alignement ───────────────────────────────────────────────────────────

    function _alignElements(mode, refMode) {
        const sel = _getSel();
        if (!sel || sel.length < 1) return;

        let refBox;
        if (refMode === 'canvas' || sel.length === 1) {
            const doc = _getDocSize();
            refBox = { x: 0, y: 0, w: doc.w, h: doc.h };
        } else {
            refBox = _getUnionBBox(sel);
        }

        sel.forEach(el => {
            const bb = _getBBox(el);
            if (!bb) return;
            let dx = 0, dy = 0;
            switch (mode) {
                case 'left':    dx = refBox.x - bb.x; break;
                case 'centerH': dx = (refBox.x + refBox.w / 2) - (bb.x + bb.width / 2); break;
                case 'right':   dx = (refBox.x + refBox.w) - (bb.x + bb.width); break;
                case 'top':     dy = refBox.y - bb.y; break;
                case 'centerV': dy = (refBox.y + refBox.h / 2) - (bb.y + bb.height / 2); break;
                case 'bottom':  dy = (refBox.y + refBox.h) - (bb.y + bb.height); break;
            }
            _translate(el, dx, dy);
        });
        _save('Aligner ' + mode);
    }

    // ─── Distribution ─────────────────────────────────────────────────────────

    function _distribute(axis) {
        const sel = _getSel();
        if (!sel || sel.length < 3) {
            console.warn('[Align] Distribution nécessite au moins 3 éléments.');
            return;
        }
        const bbs = sel.map(el => ({ el, bb: _getBBox(el) })).filter(x => x.bb);
        if (bbs.length < 3) return;

        if (axis === 'h') {
            bbs.sort((a, b) => a.bb.x - b.bb.x);
            const first = bbs[0].bb.x;
            const last = bbs[bbs.length - 1].bb.x + bbs[bbs.length - 1].bb.width;
            const totalW = bbs.reduce((s, x) => s + x.bb.width, 0);
            const gap = (last - first - totalW) / (bbs.length - 1);
            let cursor = bbs[0].bb.x + bbs[0].bb.width + gap;
            for (let i = 1; i < bbs.length - 1; i++) {
                _translate(bbs[i].el, cursor - bbs[i].bb.x, 0);
                cursor += bbs[i].bb.width + gap;
            }
        } else {
            bbs.sort((a, b) => a.bb.y - b.bb.y);
            const first = bbs[0].bb.y;
            const last = bbs[bbs.length - 1].bb.y + bbs[bbs.length - 1].bb.height;
            const totalH = bbs.reduce((s, x) => s + x.bb.height, 0);
            const gap = (last - first - totalH) / (bbs.length - 1);
            let cursor = bbs[0].bb.y + bbs[0].bb.height + gap;
            for (let i = 1; i < bbs.length - 1; i++) {
                _translate(bbs[i].el, 0, cursor - bbs[i].bb.y);
                cursor += bbs[i].bb.height + gap;
            }
        }
        _save('Distribuer ' + (axis === 'h' ? 'horizontalement' : 'verticalement'));
    }

    // ─── Flip ─────────────────────────────────────────────────────────────────

    function _applyFlip(axis) {
        const sel = _getSel();
        if (!sel) return;
        sel.forEach(el => {
            const bb = _getBBox(el);
            if (!bb) return;
            const cx = _r(bb.x + bb.width / 2);
            const cy = _r(bb.y + bb.height / 2);
            const cur = (el.getAttribute('transform') || '').trim();
            const scaleStr = axis === 'h'
                ? `translate(${cx * 2},0) scale(-1,1)`
                : `translate(0,${cy * 2}) scale(1,-1)`;
            el.setAttribute('transform', `${scaleStr} ${cur}`.trim());
        });
        _save('Réflexion');
    }

    // ─── Guides SVG glissables ────────────────────────────────────────────────

    const _guides = [];

    function _getCanvas() {
        return document.getElementById('main-canvas-container') || document.getElementById('workspace');
    }

    function addGuide(axis, pos) {
        const container = _getCanvas();
        if (!container) return;

        const guide = document.createElement('div');
        guide.className = `illu-svg-guide illu-svg-guide--${axis}`;
        guide.setAttribute('data-guide-axis', axis);
        guide.setAttribute('title', `Guide ${axis === 'h' ? 'horizontal' : 'vertical'} — glisser pour déplacer`);

        if (axis === 'h') guide.style.top = pos + 'px';
        else guide.style.left = pos + 'px';

        // Drag du guide
        let startPos, startMouse;
        guide.addEventListener('mousedown', e => {
            e.preventDefault(); e.stopPropagation();
            startPos = pos;
            startMouse = axis === 'h' ? e.clientY : e.clientX;
            const move = ev => {
                const delta = (axis === 'h' ? ev.clientY : ev.clientX) - startMouse;
                pos = startPos + delta;
                if (axis === 'h') guide.style.top = pos + 'px';
                else guide.style.left = pos + 'px';
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
        guide.addEventListener('dblclick', e => {
            e.stopPropagation();
            guide.remove();
            const idx = _guides.indexOf(guide);
            if (idx !== -1) _guides.splice(idx, 1);
        });

        container.appendChild(guide);
        _guides.push(guide);
        return guide;
    }

    function clearGuides() {
        _guides.forEach(g => { if (g.parentElement) g.remove(); });
        _guides.length = 0;
    }

    // ─── Raccourcis clavier ───────────────────────────────────────────────────

    document.addEventListener('keydown', e => {
        if (!document.body.classList.contains('illu-svg-mode-active')) return;
        const sel = _getSel();
        if (!sel) return;
        // Flèches = déplacer de 1px (ou 10px avec Shift)
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft')  { e.preventDefault(); sel.forEach(el => _translate(el, -step, 0)); _save('Déplacer'); }
        if (e.key === 'ArrowRight') { e.preventDefault(); sel.forEach(el => _translate(el, step, 0));  _save('Déplacer'); }
        if (e.key === 'ArrowUp')    { e.preventDefault(); sel.forEach(el => _translate(el, 0, -step)); _save('Déplacer'); }
        if (e.key === 'ArrowDown')  { e.preventDefault(); sel.forEach(el => _translate(el, 0, step));  _save('Déplacer'); }
    });

    // ─── API publique ─────────────────────────────────────────────────────────

    global.illuSvgAlign = {
        flipH: () => _applyFlip('h'),
        flipV: () => _applyFlip('v'),
        alignLeft:    (ref) => _alignElements('left', ref),
        alignCenterH: (ref) => _alignElements('centerH', ref),
        alignRight:   (ref) => _alignElements('right', ref),
        alignTop:     (ref) => _alignElements('top', ref),
        alignCenterV: (ref) => _alignElements('centerV', ref),
        alignBottom:  (ref) => _alignElements('bottom', ref),
        distributeH:  () => _distribute('h'),
        distributeV:  () => _distribute('v'),
        addGuide,
        clearGuides,
    };

})(window);
