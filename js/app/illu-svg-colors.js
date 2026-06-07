/**
 * illu-svg-colors.js — Pipette vectorielle & Nuancier global (Phase 8)
 *
 * - Pipette : prélever fill/stroke d'un objet SVG et les appliquer à un autre
 * - Nuancier global (swatches) partagé entre les objets
 * - Harmonies de couleurs (complémentaires, triades, analogues)
 */
'use strict';
(function (global) {

    let _eyedropperActive = false;
    const _swatches = [];
    const MAX_SWATCHES = 20;

    // ─── Utilitaires couleur ──────────────────────────────────────────────────

    function _hexToHsl(hex) {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1]+hex[1], 16);
            g = parseInt(hex[2]+hex[2], 16);
            b = parseInt(hex[3]+hex[3], 16);
        } else if (hex.length >= 7) {
            r = parseInt(hex.slice(1,3), 16);
            g = parseInt(hex.slice(3,5), 16);
            b = parseInt(hex.slice(5,7), 16);
        }
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        let h, s, l = (max+min)/2;
        if (max === min) { h = s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d/(2-max-min) : d/(max+min);
            switch(max) {
                case r: h = ((g-b)/d + (g<b?6:0))/6; break;
                case g: h = ((b-r)/d + 2)/6; break;
                case b: h = ((r-g)/d + 4)/6; break;
            }
        }
        return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
    }

    function _hslToHex(h, s, l) {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1-l);
        const f = n => {
            const k = (n + h/30) % 12;
            const color = l - a * Math.max(Math.min(k-3, 9-k, 1), -1);
            return Math.round(255*color).toString(16).padStart(2,'0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    // ─── Pipette vectorielle ──────────────────────────────────────────────────

    function startEyedropper() {
        _eyedropperActive = true;
        document.body.style.cursor = 'crosshair';
        const indicator = document.getElementById('svg-eyedropper-indicator');
        if (indicator) indicator.style.display = 'block';

        const onMove = e => {
            const indicator = document.getElementById('svg-eyedropper-indicator');
            if (indicator) { indicator.style.left = e.clientX + 'px'; indicator.style.top = e.clientY + 'px'; }
        };

        const onMouseDown = e => {
            if (!_eyedropperActive) return;
            e.preventDefault(); e.stopPropagation();

            // Chercher l'élément SVG sous la souris
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (!el) { stopEyedropper(); return; }

            const svgEl = el.closest('rect, circle, ellipse, path, polygon, polyline, line');
            if (svgEl) {
                const fill = svgEl.getAttribute('fill');
                const stroke = svgEl.getAttribute('stroke');
                const sw = svgEl.getAttribute('stroke-width');
                _applySampledStyle(fill, stroke, sw);
            }
            stopEyedropper();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mousedown', onMouseDown, { capture: true, once: true });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') stopEyedropper(); }, { once: true });

        function stopEyedropper() {
            _eyedropperActive = false;
            document.body.style.cursor = '';
            const indicator = document.getElementById('svg-eyedropper-indicator');
            if (indicator) indicator.style.display = 'none';
            document.removeEventListener('mousemove', onMove);
        }
    }

    function _applySampledStyle(fill, stroke, strokeWidth) {
        const em = global.EditorManager;
        const sel = em && em.activeVectorSelection;
        if (!sel || !sel.length) return;

        sel.forEach(el => {
            if (fill && fill !== 'none') el.setAttribute('fill', fill);
            if (stroke && stroke !== 'none') el.setAttribute('stroke', stroke);
            if (strokeWidth) el.setAttribute('stroke-width', strokeWidth);
        });

        if (fill && fill.startsWith('#')) _addSwatch(fill);
        if (stroke && stroke.startsWith('#') && stroke !== fill) _addSwatch(stroke);

        if (em && em.saveHistory) em.saveHistory('Pipette vectorielle');
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
    }

    // ─── Nuancier global ──────────────────────────────────────────────────────

    function _addSwatch(color) {
        if (_swatches.includes(color)) return;
        _swatches.unshift(color);
        if (_swatches.length > MAX_SWATCHES) _swatches.pop();
        _renderSwatches();
    }

    function _renderSwatches() {
        const container = document.getElementById('svg-swatches-container');
        if (!container) return;
        container.innerHTML = '';
        _swatches.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'svg-swatch';
            swatch.style.cssText = `
                width: 16px; height: 16px;
                background: ${color};
                border: 1px solid rgba(0,0,0,0.3);
                cursor: pointer;
                border-radius: 2px;
                display: inline-block;
                margin: 1px;
                flex-shrink: 0;
            `;
            swatch.title = color;
            swatch.addEventListener('click', e => {
                const em = global.EditorManager;
                const sel = em && em.activeVectorSelection;
                if (!sel || !sel.length) return;
                const applyTo = e.shiftKey ? 'stroke' : 'fill';
                sel.forEach(el => el.setAttribute(applyTo, color));
                if (em && em.saveHistory) em.saveHistory('Appliquer nuance');
                if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
            });
            container.appendChild(swatch);
        });
    }

    // ─── Harmonies de couleurs ────────────────────────────────────────────────

    /**
     * Générer des couleurs harmonieuses depuis une couleur de base
     * @param {string} baseHex - Couleur de base en hex
     * @param {'complementary'|'triadic'|'analogous'|'split-complementary'} type
     * @returns {string[]} - Tableau de couleurs hex
     */
    function generateHarmony(baseHex, type) {
        const { h, s, l } = _hexToHsl(baseHex);
        const colors = [baseHex];

        switch (type) {
            case 'complementary':
                colors.push(_hslToHex((h + 180) % 360, s, l));
                break;
            case 'triadic':
                colors.push(_hslToHex((h + 120) % 360, s, l));
                colors.push(_hslToHex((h + 240) % 360, s, l));
                break;
            case 'analogous':
                colors.push(_hslToHex((h + 30) % 360, s, l));
                colors.push(_hslToHex((h - 30 + 360) % 360, s, l));
                break;
            case 'split-complementary':
                colors.push(_hslToHex((h + 150) % 360, s, l));
                colors.push(_hslToHex((h + 210) % 360, s, l));
                break;
        }
        // Ajouter toutes les couleurs au nuancier
        colors.forEach(_addSwatch);
        return colors;
    }

    // ─── VectorProperties avancées ────────────────────────────────────────────
    // Extensions de VectorProperties.js pour les dégradés, stroke-dasharray, flèches

    /**
     * Appliquer un dégradé linéaire à l'élément sélectionné
     * @param {Object} opts - {color1, color2, angle}
     */
    function applyLinearGradient(opts) {
        const { color1 = '#000', color2 = '#fff', angle = 0 } = opts;
        const em = global.EditorManager;
        const sel = em && em.activeVectorSelection;
        if (!sel || !sel.length) return;

        const svgEl = sel[sel.length - 1];
        const svgDoc = svgEl.ownerSVGElement;
        if (!svgDoc) return;

        const NS = 'http://www.w3.org/2000/svg';
        let defs = svgDoc.querySelector('defs');
        if (!defs) { defs = document.createElementNS(NS, 'defs'); svgDoc.insertBefore(defs, svgDoc.firstChild); }

        const gradId = 'illu-grad-' + Date.now();
        const grad = document.createElementNS(NS, 'linearGradient');
        grad.setAttribute('id', gradId);

        // Calculer x1/y1/x2/y2 depuis l'angle
        const rad = (angle * Math.PI) / 180;
        grad.setAttribute('x1', (0.5 - 0.5 * Math.cos(rad)).toFixed(3));
        grad.setAttribute('y1', (0.5 - 0.5 * Math.sin(rad)).toFixed(3));
        grad.setAttribute('x2', (0.5 + 0.5 * Math.cos(rad)).toFixed(3));
        grad.setAttribute('y2', (0.5 + 0.5 * Math.sin(rad)).toFixed(3));

        const stop1 = document.createElementNS(NS, 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', color1);
        const stop2 = document.createElementNS(NS, 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', color2);

        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);

        svgEl.setAttribute('fill', `url(#${gradId})`);
        if (em && em.saveHistory) em.saveHistory('Dégradé linéaire');
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
    }

    /**
     * Appliquer un dégradé radial
     */
    function applyRadialGradient(opts) {
        const { color1 = '#000', color2 = 'transparent', cx = '50%', cy = '50%', r = '50%' } = opts;
        const em = global.EditorManager;
        const sel = em && em.activeVectorSelection;
        if (!sel || !sel.length) return;

        const svgEl = sel[sel.length - 1];
        const svgDoc = svgEl.ownerSVGElement;
        if (!svgDoc) return;

        const NS = 'http://www.w3.org/2000/svg';
        let defs = svgDoc.querySelector('defs');
        if (!defs) { defs = document.createElementNS(NS, 'defs'); svgDoc.insertBefore(defs, svgDoc.firstChild); }

        const gradId = 'illu-rgrad-' + Date.now();
        const grad = document.createElementNS(NS, 'radialGradient');
        grad.setAttribute('id', gradId);
        grad.setAttribute('cx', cx); grad.setAttribute('cy', cy); grad.setAttribute('r', r);

        const stop1 = document.createElementNS(NS, 'stop');
        stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', color1);
        const stop2 = document.createElementNS(NS, 'stop');
        stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', color2);

        grad.appendChild(stop1); grad.appendChild(stop2);
        defs.appendChild(grad);

        svgEl.setAttribute('fill', `url(#${gradId})`);
        if (em && em.saveHistory) em.saveHistory('Dégradé radial');
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
    }

    /**
     * Appliquer un stroke-dasharray prédéfini
     */
    function applyStrokeDash(style) {
        const em = global.EditorManager;
        const sel = em && em.activeVectorSelection;
        if (!sel || !sel.length) return;

        const dashMap = {
            solid: '',
            dashed: '8,4',
            dotted: '2,4',
            'dash-dot': '8,4,2,4',
            'long-dash': '16,6',
        };
        const dash = dashMap[style] !== undefined ? dashMap[style] : style;
        sel.forEach(el => {
            if (dash) el.setAttribute('stroke-dasharray', dash);
            else el.removeAttribute('stroke-dasharray');
        });
        if (em && em.saveHistory) em.saveHistory('Style contour');
    }

    /**
     * Appliquer des flèches (markers) sur un path/line
     */
    function applyArrowMarker(opts) {
        const { el, position = 'end', color = '#000', size = 6 } = opts;
        if (!el) return;
        const svgDoc = el.ownerSVGElement;
        if (!svgDoc) return;

        const NS = 'http://www.w3.org/2000/svg';
        let defs = svgDoc.querySelector('defs');
        if (!defs) { defs = document.createElementNS(NS, 'defs'); svgDoc.insertBefore(defs, svgDoc.firstChild); }

        const markerId = `illu-arrow-${position}-${Date.now()}`;
        const marker = document.createElementNS(NS, 'marker');
        marker.setAttribute('id', markerId);
        marker.setAttribute('markerWidth', String(size));
        marker.setAttribute('markerHeight', String(size));
        marker.setAttribute('refX', position === 'end' ? String(size - 1) : '1');
        marker.setAttribute('refY', String(size / 2));
        marker.setAttribute('orient', 'auto');

        const path = document.createElementNS(NS, 'path');
        if (position === 'end') {
            path.setAttribute('d', `M 0 0 L ${size} ${size/2} L 0 ${size} Z`);
        } else {
            path.setAttribute('d', `M ${size} 0 L 0 ${size/2} L ${size} ${size} Z`);
        }
        path.setAttribute('fill', color);
        marker.appendChild(path);
        defs.appendChild(marker);

        if (position === 'end') el.setAttribute('marker-end', `url(#${markerId})`);
        else el.setAttribute('marker-start', `url(#${markerId})`);

        const em = global.EditorManager;
        if (em && em.saveHistory) em.saveHistory('Flèche');
    }

    // ─── Exposition publique ──────────────────────────────────────────────────

    global.illuSvgColors = {
        startEyedropper,
        addSwatch: _addSwatch,
        renderSwatches: _renderSwatches,
        generateHarmony,
        applyLinearGradient,
        applyRadialGradient,
        applyStrokeDash,
        applyArrowMarker,
        getSwatches: () => [..._swatches],
    };

})(window);
