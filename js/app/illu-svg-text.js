/**
 * illu-svg-text.js — Éditeur Texte SVG enrichi (Phase 1 + Module 4)
 * - Outil Texte : clic pour placer <text> natif SVG
 * - Double-clic : overlay contenteditable synchronisé
 * - Panneau typographie : famille, taille, gras, italique, alignement, interlignage
 * - Support textPath : attacher un <text> à un <path>
 */
'use strict';
(function (global) {
    let _overlay = null;
    let _target = null;
    let _typoPanelActive = false;

    const NS = 'http://www.w3.org/2000/svg';

    // ─── Overlay contenteditable ─────────────────────────────────────────────

    function _getOverlay() {
        if (_overlay) return _overlay;
        _overlay = document.createElement('div');
        _overlay.id = 'svg-text-overlay';
        _overlay.contentEditable = 'true';
        _overlay.setAttribute('autocomplete', 'off');
        _overlay.setAttribute('spellcheck', 'false');
        _overlay.setAttribute('role', 'textbox');
        _overlay.setAttribute('aria-label', 'Éditeur texte SVG');

        const container = document.getElementById('main-canvas-container') || document.body;
        container.appendChild(_overlay);

        _overlay.addEventListener('input', _onInput);
        _overlay.addEventListener('blur', (e) => {
            // Délai pour éviter le blur sur le panneau typo
            setTimeout(() => _commit(), 150);
        });
        _overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); _cancel(); }
            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); _commit(); }
        });
        return _overlay;
    }

    function _onInput() {
        if (!_target) return;
        const text = _overlay.innerText || _overlay.textContent || '';
        // Mettre à jour tspan ou textContent directement
        const tspan = _target.querySelector('tspan');
        if (tspan) { tspan.textContent = text; }
        else { _target.textContent = text; }
    }

    function _commit() {
        if (!_target) return;
        const em = global.EditorManager;
        if (em && em.saveHistory) em.saveHistory('Texte SVG');
        _close();
        // Désactiver la barre typo active
        _typoPanelActive = false;
        _syncTypoBar();
    }

    function _cancel() {
        _close();
    }

    function _close() {
        const ov = _getOverlay();
        ov.classList.remove('editing');
        ov.contentEditable = 'false';
        _target = null;
    }

    /** Éditer un élément <text> SVG existant */
    function edit(svgTextEl, canvasRect) {
        if (!svgTextEl) return;
        _target = svgTextEl;
        const ov = _getOverlay();
        ov.contentEditable = 'true';

        // Copier le texte actuel
        const tspan = svgTextEl.querySelector('tspan');
        const currentText = tspan ? tspan.textContent : (svgTextEl.textContent || '');
        ov.innerText = currentText;

        // Synchroniser la typographie de l'overlay avec l'élément SVG
        const fs = parseFloat(svgTextEl.getAttribute('font-size') || '18');
        const ff = svgTextEl.getAttribute('font-family') || 'inherit';
        const fw = svgTextEl.getAttribute('font-weight') || 'normal';
        const fi = svgTextEl.getAttribute('font-style') || 'normal';
        const fa = svgTextEl.getAttribute('text-anchor') || 'start';

        ov.style.fontFamily = ff;
        ov.style.fontSize = fs + 'px';
        ov.style.fontWeight = fw;
        ov.style.fontStyle = fi;
        ov.style.textAlign = fa === 'middle' ? 'center' : (fa === 'end' ? 'right' : 'left');

        // Positionner l'overlay
        try {
            const bb = svgTextEl.getBBox();
            const em = global.EditorManager;
            const zoom = (em && em.activeProject && em.activeProject.zoomLevel) || 1;
            const cr = canvasRect || { left: 0, top: 0 };
            ov.style.left = (cr.left + bb.x * zoom) + 'px';
            ov.style.top  = (cr.top  + bb.y * zoom) + 'px';
            ov.style.minWidth = Math.max(bb.width * zoom, 80) + 'px';
            ov.style.minHeight = Math.max(bb.height * zoom, 24) + 'px';
        } catch (e) {
            ov.style.left = '100px'; ov.style.top = '100px';
            ov.style.minWidth = '200px'; ov.style.minHeight = '32px';
        }

        ov.classList.add('editing');
        _typoPanelActive = true;
        _syncTypoBar(svgTextEl);
        requestAnimationFrame(() => {
            ov.focus();
            const range = document.createRange();
            range.selectNodeContents(ov);
            const sel = window.getSelection();
            if (sel) { sel.removeAllRanges(); sel.addRange(range); }
        });
    }

    // ─── Placement d'un nouveau <text> ───────────────────────────────────────

    function placeText(svgPos, layer) {
        if (!layer) return null;
        const em = global.EditorManager;

        const el = document.createElementNS(NS, 'text');
        el.setAttribute('x', String(svgPos.x));
        el.setAttribute('y', String(svgPos.y));
        el.setAttribute('font-size', '18');
        el.setAttribute('font-family', 'Arial, sans-serif');
        el.setAttribute('fill', em ? (em.activeColor || '#000000') : '#000000');
        el.setAttribute('font-weight', 'normal');
        el.setAttribute('font-style', 'normal');
        el.setAttribute('text-anchor', 'start');
        el.setAttribute('dominant-baseline', 'hanging');

        const tspan = document.createElementNS(NS, 'tspan');
        tspan.textContent = 'Texte';
        el.appendChild(tspan);

        layer.appendChild(el);

        if (em) {
            em.activeVectorSelection = [el];
            window._activeVectorShapeEl = el;
            if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
            if (em.saveHistory) em.saveHistory('Texte SVG', { patchActiveLayer: true });
            if (typeof illuScheduleInteractiveVisualRefresh === 'function') {
                illuScheduleInteractiveVisualRefresh({ render: true });
            } else if (em.render) em.render();
        }

        return el;
    }

    // ─── Texte sur chemin (textPath) ─────────────────────────────────────────

    function attachTextToPath(textEl, pathEl) {
        if (!textEl || !pathEl) return;
        const svgDoc = textEl.ownerSVGElement;
        if (!svgDoc) return;

        // S'assurer que le path a un ID
        if (!pathEl.id) pathEl.id = 'illu-path-' + Date.now();

        // Créer <defs> si nécessaire
        let defs = svgDoc.querySelector('defs');
        if (!defs) { defs = document.createElementNS(NS, 'defs'); svgDoc.insertBefore(defs, svgDoc.firstChild); }

        // Déplacer le path dans les defs (ou y mettre une copie)
        const pathClone = pathEl.cloneNode(true);
        pathClone.id = pathEl.id + '-tp-ref';
        defs.appendChild(pathClone);

        // Modifier le textEl pour utiliser textPath
        textEl.innerHTML = '';
        const tp = document.createElementNS(NS, 'textPath');
        tp.setAttribute('href', '#' + pathClone.id);
        tp.setAttribute('startOffset', '5%');
        tp.textContent = 'Texte sur chemin';
        textEl.appendChild(tp);

        const em = global.EditorManager;
        if (em && em.saveHistory) em.saveHistory('Texte sur chemin');
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
    }

    // ─── Panneau typographie ──────────────────────────────────────────────────

    function _syncTypoBar(el) {
        const bar = document.getElementById('opt-grp-svg-text');
        if (!bar) return;
        bar.classList.toggle('svg-text-active', !!el);

        if (!el) return;
        const ffSel = document.getElementById('svg-text-font-family');
        const fsSel = document.getElementById('svg-text-font-size');
        const boldBtn = document.getElementById('svg-text-bold');
        const italicBtn = document.getElementById('svg-text-italic');
        const alignSel = document.getElementById('svg-text-align');

        if (ffSel) ffSel.value = el.getAttribute('font-family') || 'Arial, sans-serif';
        if (fsSel) fsSel.value = parseFloat(el.getAttribute('font-size') || '18');
        if (boldBtn) boldBtn.classList.toggle('active', el.getAttribute('font-weight') === 'bold');
        if (italicBtn) italicBtn.classList.toggle('active', el.getAttribute('font-style') === 'italic');
        if (alignSel) alignSel.value = el.getAttribute('text-anchor') || 'start';
    }

    /** Appliquer une propriété typo à l'élément texte actif */
    function applyTypo(prop, value) {
        const el = _target || (
            global.EditorManager &&
            global.EditorManager.activeVectorSelection &&
            global.EditorManager.activeVectorSelection[global.EditorManager.activeVectorSelection.length - 1]
        );
        if (!el || (el.tagName || '').toLowerCase() !== 'text') return;

        const attrMap = {
            fontFamily: 'font-family',
            fontSize:   'font-size',
            fontWeight: 'font-weight',
            fontStyle:  'font-style',
            textAnchor: 'text-anchor',
            lineHeight: 'line-height',
        };
        const attr = attrMap[prop] || prop;
        el.setAttribute(attr, String(value));

        // Synchroniser l'overlay si actif
        if (_overlay && _overlay.classList.contains('editing')) {
            if (prop === 'fontFamily') _overlay.style.fontFamily = value;
            if (prop === 'fontSize') _overlay.style.fontSize = value + 'px';
            if (prop === 'fontWeight') _overlay.style.fontWeight = value;
            if (prop === 'fontStyle') _overlay.style.fontStyle = value;
            if (prop === 'textAnchor') {
                _overlay.style.textAlign = value === 'middle' ? 'center' : (value === 'end' ? 'right' : 'left');
            }
        }

        const em = global.EditorManager;
        if (em && em.saveHistory) em.saveHistory('Typographie SVG');
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
    }

    // ─── Init événements panneau typo ─────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        // Famille de police
        const ffSel = document.getElementById('svg-text-font-family');
        if (ffSel) ffSel.addEventListener('change', e => applyTypo('fontFamily', e.target.value));

        // Taille de police
        const fsSel = document.getElementById('svg-text-font-size');
        if (fsSel) fsSel.addEventListener('change', e => applyTypo('fontSize', parseFloat(e.target.value)));

        // Gras
        const boldBtn = document.getElementById('svg-text-bold');
        if (boldBtn) boldBtn.addEventListener('click', () => {
            const el = _target || (global.EditorManager?.activeVectorSelection?.slice(-1)[0]);
            const isBold = el && el.getAttribute('font-weight') === 'bold';
            applyTypo('fontWeight', isBold ? 'normal' : 'bold');
            boldBtn.classList.toggle('active', !isBold);
        });

        // Italique
        const italicBtn = document.getElementById('svg-text-italic');
        if (italicBtn) italicBtn.addEventListener('click', () => {
            const el = _target || (global.EditorManager?.activeVectorSelection?.slice(-1)[0]);
            const isItalic = el && el.getAttribute('font-style') === 'italic';
            applyTypo('fontStyle', isItalic ? 'normal' : 'italic');
            italicBtn.classList.toggle('active', !isItalic);
        });

        // Alignement
        const alignSel = document.getElementById('svg-text-align');
        if (alignSel) alignSel.addEventListener('change', e => applyTypo('textAnchor', e.target.value));

        // Texte sur chemin
        const tpBtn = document.getElementById('svg-text-on-path');
        if (tpBtn) tpBtn.addEventListener('click', () => {
            const em = global.EditorManager;
            const sel = em && em.activeVectorSelection;
            if (!sel || sel.length < 2) { alert('Sélectionnez un texte et un chemin.'); return; }
            const textEl = sel.find(e => (e.tagName || '').toLowerCase() === 'text');
            const pathEl = sel.find(e => (e.tagName || '').toLowerCase() === 'path' && e !== textEl);
            if (textEl && pathEl) attachTextToPath(textEl, pathEl);
            else alert('Sélectionnez un élément <text> et un <path>.');
        });
    });

    // Écouter la sélection d'un texte pour activer la barre typo
    document.addEventListener('illu:vector-selection-changed', () => {
        const em = global.EditorManager;
        const sel = em && em.activeVectorSelection;
        const last = sel && sel[sel.length - 1];
        const isText = last && (last.tagName || '').toLowerCase() === 'text';
        if (isText) _syncTypoBar(last);
        else _syncTypoBar(null);
    });

    global.illuSvgText = { edit, placeText, attachTextToPath, applyTypo };

})(window);
