// Script pour la gestion du panneau Propriétés vectoriel

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
    
    // Lire le premier élément sélectionné
    const el = sel[sel.length - 1];
    
    // Fill
    const fill = el.getAttribute('fill') || '';
    if (fill === 'none' || !fill) {
        document.getElementById('prop-fill-color').value = '#000000';
    } else if (fill.startsWith('#')) {
        document.getElementById('prop-fill-color').value = fill.substring(0, 7);
    } else if (fill.startsWith('rgba')) {
        // rgba to hex approximation for input type color
        const parts = fill.match(/[\d.]+/g);
        if (parts && parts.length >= 3) {
            const hex = '#' + parts.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
            document.getElementById('prop-fill-color').value = hex;
        }
    }
    const fillOp = el.getAttribute('fill-opacity') || '1';
    document.getElementById('prop-fill-opacity').value = Math.round(parseFloat(fillOp) * 100);
    document.getElementById('prop-fill-opacity-val').textContent = Math.round(parseFloat(fillOp) * 100) + '%';
    
    // Stroke
    const stroke = el.getAttribute('stroke') || '';
    if (stroke === 'none' || !stroke) {
        document.getElementById('prop-stroke-color').value = '#000000';
    } else if (stroke.startsWith('#')) {
        document.getElementById('prop-stroke-color').value = stroke.substring(0, 7);
    }
    const strokeOp = el.getAttribute('stroke-opacity') || '1';
    document.getElementById('prop-stroke-opacity').value = Math.round(parseFloat(strokeOp) * 100);
    document.getElementById('prop-stroke-opacity-val').textContent = Math.round(parseFloat(strokeOp) * 100) + '%';
    
    const strokeW = el.getAttribute('stroke-width') || '0';
    document.getElementById('prop-stroke-width').value = strokeW;
    document.getElementById('prop-stroke-width-val').value = strokeW;
    
    // Filter (Shadow)
    const filter = el.getAttribute('filter') || '';
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
    window._vectorStrokeNone = stroke === 'none' || strokeW === '0';
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
    
    sel.forEach(el => {
        if (window._vectorFillNone) {
            el.setAttribute('fill', 'none');
            window._vectorFillNone = false; // reset flag
        } else {
            el.setAttribute('fill', fc);
        }
        el.setAttribute('fill-opacity', fo);
        
        if (window._vectorStrokeNone) {
            el.setAttribute('stroke', 'none');
            el.setAttribute('stroke-width', '0');
            window._vectorStrokeNone = false;
        } else {
            el.setAttribute('stroke', sc);
            el.setAttribute('stroke-width', sw);
        }
        el.setAttribute('stroke-opacity', so);
        
        if (shadowEnabled) {
            el.setAttribute('filter', `drop-shadow(${shX}px ${shY}px ${shB}px ${shC})`);
        } else {
            el.removeAttribute('filter');
        }
    });
    
    if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
}
