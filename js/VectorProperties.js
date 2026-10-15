// Script pour la gestion du panneau Propriétés vectoriel

/**
 * Résout une propriété de style SVG en consultant, dans l'ordre :
 * l'attribut présentation, le style inline, puis le style calculé.
 * Renvoie la valeur brute (ex. '#ff0000', 'rgb(…)', 'none', 'url(#grad)', 'currentColor').
 */
window.illuResolveStyleProp = function (el, prop) {
    if (!el) return '';
    // 1) style inline (priorité visuelle la plus forte hors !important)
    if (el.style && el.style[prop]) return el.style[prop].trim();
    // 2) attribut de présentation
    const attr = el.getAttribute && el.getAttribute(prop);
    if (attr != null && attr !== '') return attr.trim();
    // 3) style calculé (hérité / feuille de style)
    try {
        const cs = window.getComputedStyle(el);
        const v = cs && cs.getPropertyValue(prop);
        if (v) return v.trim();
    } catch (e) { /* élément hors document */ }
    return '';
};

/** Convertit une couleur CSS (hex court/long, rgb, rgba, nom) en #rrggbb. Renvoie null si non convertible (none, url(), currentColor…). */
window.illuColorToHex = function (color) {
    if (!color) return null;
    const c = String(color).trim().toLowerCase();
    if (c === 'none' || c === 'transparent' || c === 'currentcolor' || c.startsWith('url(')) return null;
    if (c.startsWith('#')) {
        if (c.length === 4) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
        if (c.length >= 7) return c.substring(0, 7);
        return null;
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
        const parts = m[1].split(',').map(s => parseFloat(s));
        if (parts.length >= 3) {
            return '#' + parts.slice(0, 3).map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
        }
    }
    // Couleur nommée : on laisse le navigateur la résoudre.
    try {
        const probe = document.createElement('canvas').getContext('2d');
        probe.fillStyle = '#000';
        probe.fillStyle = c;
        const resolved = probe.fillStyle;
        if (resolved.startsWith('#')) return resolved.substring(0, 7);
        const rm = resolved.match(/rgba?\(([^)]+)\)/);
        if (rm) {
            const parts = rm[1].split(',').map(s => parseFloat(s));
            return '#' + parts.slice(0, 3).map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
        }
    } catch (e) { /* ignore */ }
    return null;
};

/** Vrai si la valeur de remplissage/contour désigne un dégradé ou motif (url(#…)). */
window.illuIsPaintRef = function (v) {
    return typeof v === 'string' && v.trim().toLowerCase().startsWith('url(');
};

window.illuInitVectorProperties = function() {
    const ids = [
        'prop-fill-color', 'prop-fill-opacity', 'prop-fill-none', 'prop-fill-gradient',
        'prop-stroke-color', 'prop-stroke-opacity', 'prop-stroke-width', 'prop-stroke-none',
        'prop-shadow-enable', 'prop-shadow-color', 'prop-shadow-blur', 'prop-shadow-x', 'prop-shadow-y'
    ];
    
    // Attacher les events
    document.getElementById('prop-fill-color').addEventListener('input', applyVectorProperties);
    document.getElementById('prop-fill-opacity').addEventListener('input', (e) => {
        document.getElementById('prop-fill-opacity-val').textContent = e.target.value + '%';
        applyVectorProperties();
    });
    document.getElementById('prop-fill-gradient').addEventListener('click', () => {
        const btn = document.getElementById('tool-gradient');
        if (btn) btn.click();
    });
    document.getElementById('prop-fill-none').addEventListener('click', () => {
        window._vectorFillNone = true;
        applyVectorProperties();
    });
    
    document.getElementById('prop-stroke-color').addEventListener('input', applyVectorProperties);
    document.getElementById('prop-stroke-opacity').addEventListener('input', (e) => {
        document.getElementById('prop-stroke-opacity-val').textContent = e.target.value + '%';
        applyVectorProperties();
    });
    document.getElementById('prop-stroke-width').addEventListener('input', (e) => {
        document.getElementById('prop-stroke-width-val').value = e.target.value;
        applyVectorProperties();
    });
    document.getElementById('prop-stroke-width-val').addEventListener('input', (e) => {
        document.getElementById('prop-stroke-width').value = e.target.value;
        applyVectorProperties();
    });
    document.getElementById('prop-stroke-none').addEventListener('click', () => {
        window._vectorStrokeNone = true;
        applyVectorProperties();
    });

    // Style de trait (tirets) + extrémité — boutons image OpenPDN
    const dashGroup = document.getElementById('prop-dash-style');
    if (dashGroup) {
        dashGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.openpdn-imgbtn');
            if (!btn) return;
            dashGroup.querySelectorAll('.openpdn-imgbtn').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            window._vectorDashStyle = btn.getAttribute('data-dash') || '';
            applyVectorProperties();
        });
    }
    const capGroup = document.getElementById('prop-line-cap');
    if (capGroup) {
        capGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.openpdn-imgbtn');
            if (!btn) return;
            capGroup.querySelectorAll('.openpdn-imgbtn').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            window._vectorLineCap = btn.getAttribute('data-cap') || 'butt';
            applyVectorProperties();
        });
    }
    
    document.getElementById('prop-shadow-enable').addEventListener('change', (e) => {
        document.getElementById('prop-shadow-controls').style.opacity = e.target.checked ? '1' : '0.5';
        document.getElementById('prop-shadow-controls').style.pointerEvents = e.target.checked ? 'auto' : 'none';
        applyVectorProperties();
    });
    document.getElementById('prop-shadow-color').addEventListener('input', applyVectorProperties);
    document.getElementById('prop-shadow-blur').addEventListener('input', (e) => {
        document.getElementById('prop-shadow-blur-val').textContent = e.target.value;
        applyVectorProperties();
    });
    document.getElementById('prop-shadow-x').addEventListener('input', applyVectorProperties);
    document.getElementById('prop-shadow-y').addEventListener('input', applyVectorProperties);
};

window.illuUpdateVectorPropertiesUI = function() {
    if (!window.EditorManager || EditorManager.mode !== 'vector') {
        document.getElementById('props-vector-section').style.display = 'none';
        return;
    }
    
    const sel = EditorManager.activeVectorSelection;
    if (!sel || !sel.length) {
        document.getElementById('props-vector-section').style.display = 'none';
        return;
    }
    
    document.getElementById('props-vector-section').style.display = 'block';
    
    // Lire le premier élément sélectionné (objet primaire)
    const el = sel[sel.length - 1];

    // ── Fill (résolution attribut → style inline → calculé) ──
    const fill = window.illuResolveStyleProp(el, 'fill') || 'rgb(0,0,0)';
    const fillColorInput = document.getElementById('prop-fill-color');
    const fillIsRef = window.illuIsPaintRef(fill);
    const fillHex = window.illuColorToHex(fill);
    if (fillHex) fillColorInput.value = fillHex;
    // Indiquer visuellement un dégradé/motif ou un remplissage « none ».
    fillColorInput.dataset.paint = fillIsRef ? 'gradient' : (fill === 'none' ? 'none' : 'solid');
    fillColorInput.title = fillIsRef ? 'Dégradé / motif (' + fill + ')' : (fill === 'none' ? 'Aucun remplissage' : fill);

    const fillOp = window.illuResolveStyleProp(el, 'fill-opacity') || '1';
    document.getElementById('prop-fill-opacity').value = Math.round(parseFloat(fillOp) * 100);
    document.getElementById('prop-fill-opacity-val').textContent = Math.round(parseFloat(fillOp) * 100) + '%';

    // ── Stroke ──
    const stroke = window.illuResolveStyleProp(el, 'stroke') || 'none';
    const strokeColorInput = document.getElementById('prop-stroke-color');
    const strokeHex = window.illuColorToHex(stroke);
    if (strokeHex) strokeColorInput.value = strokeHex;
    strokeColorInput.dataset.paint = window.illuIsPaintRef(stroke) ? 'gradient' : (stroke === 'none' ? 'none' : 'solid');
    strokeColorInput.title = stroke === 'none' ? 'Aucun contour' : stroke;
    const strokeOp = window.illuResolveStyleProp(el, 'stroke-opacity') || '1';
    document.getElementById('prop-stroke-opacity').value = Math.round(parseFloat(strokeOp) * 100);
    document.getElementById('prop-stroke-opacity-val').textContent = Math.round(parseFloat(strokeOp) * 100) + '%';
    
    const strokeW = window.illuResolveStyleProp(el, 'stroke-width') || '0';
    document.getElementById('prop-stroke-width').value = parseFloat(strokeW) || 0;
    document.getElementById('prop-stroke-width-val').value = parseFloat(strokeW) || 0;

    // Filter (Shadow)
    const filter = window.illuResolveStyleProp(el, 'filter') || '';
    if (filter.includes('drop-shadow')) {
        document.getElementById('prop-shadow-enable').checked = true;
        document.getElementById('prop-shadow-controls').style.opacity = '1';
        document.getElementById('prop-shadow-controls').style.pointerEvents = 'auto';
        
        const m = filter.match(/drop-shadow\(([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s+(#?[a-zA-Z0-9]+|rgba\([^)]+\))\)/);
        if (m) {
            document.getElementById('prop-shadow-x').value = m[1];
            document.getElementById('prop-shadow-y').value = m[2];
            document.getElementById('prop-shadow-blur').value = m[3];
            document.getElementById('prop-shadow-blur-val').textContent = m[3];
            if (m[4].startsWith('#')) {
                document.getElementById('prop-shadow-color').value = m[4].substring(0, 7);
            }
        }
    } else {
        document.getElementById('prop-shadow-enable').checked = false;
        document.getElementById('prop-shadow-controls').style.opacity = '0.5';
        document.getElementById('prop-shadow-controls').style.pointerEvents = 'none';
    }
    
    window._vectorFillNone = fill === 'none';
    window._vectorStrokeNone = stroke === 'none' || (parseFloat(strokeW) || 0) === 0;

    // Style de trait + extrémité (lecture inverse)
    const dasharray = (window.illuResolveStyleProp(el, 'stroke-dasharray') || '').trim();
    const nDash = dasharray ? dasharray.split(/[\s,]+/).filter(Boolean).length : 0;
    let dashStyle = '';
    if (nDash >= 6) dashStyle = 'dashdotdot';
    else if (nDash === 4) dashStyle = 'dashdot';
    else if (nDash === 2) {
        const parts = dasharray.split(/[\s,]+/).map(parseFloat);
        dashStyle = parts[0] <= (parseFloat(strokeW) || 1) * 1.5 ? 'dot' : 'dash';
    }
    window._vectorDashStyle = dashStyle;
    const dashGroup = document.getElementById('prop-dash-style');
    if (dashGroup) {
        dashGroup.querySelectorAll('.openpdn-imgbtn').forEach(b =>
            b.classList.toggle('is-active', (b.getAttribute('data-dash') || '') === dashStyle));
    }
    const cap = window.illuResolveStyleProp(el, 'stroke-linecap') || 'butt';
    window._vectorLineCap = cap;
    const capGroup = document.getElementById('prop-line-cap');
    if (capGroup) {
        capGroup.querySelectorAll('.openpdn-imgbtn').forEach(b =>
            b.classList.toggle('is-active', (b.getAttribute('data-cap') || 'butt') === cap));
    }
};

function applyVectorProperties() {
    if (!window.EditorManager || EditorManager.mode !== 'vector') return;
    const sel = EditorManager.activeVectorSelection;
    if (!sel || !sel.length) return;
    
    // Get values
    const fc = document.getElementById('prop-fill-color').value;
    const fo = document.getElementById('prop-fill-opacity').value / 100;
    
    const sc = document.getElementById('prop-stroke-color').value;
    const so = document.getElementById('prop-stroke-opacity').value / 100;
    const sw = document.getElementById('prop-stroke-width').value;
    
    const shadowEnabled = document.getElementById('prop-shadow-enable').checked;
    const shC = document.getElementById('prop-shadow-color').value;
    const shB = document.getElementById('prop-shadow-blur').value;
    const shX = document.getElementById('prop-shadow-x').value;
    const shY = document.getElementById('prop-shadow-y').value;
    
    // Écrit une propriété de présentation là où elle vit (style inline prioritaire, sinon attribut),
    // pour que la valeur s'applique même quand l'élément est stylé via style="…".
    const setProp = (el, prop, value, removeWhenEmpty) => {
        const inInline = el.style && el.style[prop];
        if (value == null || value === '') {
            if (inInline) el.style.removeProperty(prop);
            if (removeWhenEmpty) el.removeAttribute(prop);
            return;
        }
        if (inInline) el.style.setProperty(prop, String(value));
        else el.setAttribute(prop, String(value));
    };

    const dashCleared = !window._vectorDashStyle;

    sel.forEach(el => {
        if (window._vectorFillNone) {
            setProp(el, 'fill', 'none');
        } else {
            setProp(el, 'fill', fc);
        }
        setProp(el, 'fill-opacity', fo);

        if (window._vectorStrokeNone) {
            setProp(el, 'stroke', 'none');
            setProp(el, 'stroke-width', '0');
        } else {
            setProp(el, 'stroke', sc);
            setProp(el, 'stroke-width', sw);
        }
        setProp(el, 'stroke-opacity', so);

        // Style de trait (tirets) — motif proportionnel à l'épaisseur (mapping OpenPDN DashStyle)
        const dashPattern = illuDashArray(window._vectorDashStyle || '', parseFloat(sw) || 1);
        setProp(el, 'stroke-dasharray', dashPattern || null, true);

        // Extrémité (OpenPDN LineCap → SVG stroke-linecap)
        const cap = window._vectorLineCap || 'butt';
        setProp(el, 'stroke-linecap', (cap && cap !== 'butt') ? cap : null, true);

        if (shadowEnabled) {
            setProp(el, 'filter', `drop-shadow(${shX}px ${shY}px ${shB}px ${shC})`);
        } else {
            setProp(el, 'filter', null, true);
        }
    });
    // Réinitialiser les drapeaux une fois appliqués à toute la sélection.
    window._vectorFillNone = false;
    window._vectorStrokeNone = false;
    void dashCleared;
    
    if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();

    // Historique (annulable) — débounce léger pour ne pas saturer pendant un drag de curseur.
    if (EditorManager.saveHistory) {
        clearTimeout(window._illuVectorPropsHistoryTimer);
        window._illuVectorPropsHistoryTimer = setTimeout(() => {
            EditorManager.saveHistory('Propriétés vectorielles', { patchActiveLayer: true });
        }, 250);
    }
    document.dispatchEvent(new CustomEvent('illu:svg-objects-changed'));
}

/** Convertit un style OpenPDN (Solid/Dash/Dot/DashDot/DashDotDot) en stroke-dasharray SVG, à l'échelle de l'épaisseur. */
function illuDashArray(style, width) {
    const w = Math.max(0.5, width || 1);
    switch (style) {
        case 'dash': return `${(3 * w).toFixed(2)},${(2 * w).toFixed(2)}`;
        case 'dot': return `${(1 * w).toFixed(2)},${(2 * w).toFixed(2)}`;
        case 'dashdot': return `${(3 * w).toFixed(2)},${(2 * w).toFixed(2)},${(1 * w).toFixed(2)},${(2 * w).toFixed(2)}`;
        case 'dashdotdot': return `${(3 * w).toFixed(2)},${(2 * w).toFixed(2)},${(1 * w).toFixed(2)},${(2 * w).toFixed(2)},${(1 * w).toFixed(2)},${(2 * w).toFixed(2)}`;
        default: return '';
    }
}
window.illuDashArray = illuDashArray;
