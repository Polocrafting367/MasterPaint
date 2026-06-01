const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

// Replace the event listener for symmetry checkboxes to also enable rulers
const oldEventBinding = `document.addEventListener('DOMContentLoaded', () => {
    ['tool-sym-x', 'tool-sym-y'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (typeof EditorManager !== 'undefined' && typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
            });
        }
    });
});`;

const newEventBinding = `document.addEventListener('DOMContentLoaded', () => {
    ['tool-sym-x', 'tool-sym-y'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (el.checked && typeof window._illuShowRulers !== 'undefined' && !window._illuShowRulers) {
                    if (typeof window.toggleIlluRulers === 'function') window.toggleIlluRulers();
                }
                if (typeof EditorManager !== 'undefined' && typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
                if (typeof window.illuUpdateRulers === 'function') window.illuUpdateRulers();
            });
        }
    });
    
    // Add drag handlers for symmetry on rulers
    let dragSymAxis = null; // 'x' or 'y'
    
    const rulerTop = document.getElementById('ruler-top');
    const rulerLeft = document.getElementById('ruler-left');
    
    if (rulerTop) {
        rulerTop.style.pointerEvents = 'auto';
        rulerTop.style.cursor = 'crosshair';
        rulerTop.addEventListener('pointerdown', (e) => {
            const symX = document.getElementById('tool-sym-x');
            if (symX && symX.checked) {
                dragSymAxis = 'x';
                rulerTop.setPointerCapture(e.pointerId);
                updateSymFromRuler(e, 'x');
            }
        });
    }
    
    if (rulerLeft) {
        rulerLeft.style.pointerEvents = 'auto';
        rulerLeft.style.cursor = 'crosshair';
        rulerLeft.addEventListener('pointerdown', (e) => {
            const symY = document.getElementById('tool-sym-y');
            if (symY && symY.checked) {
                dragSymAxis = 'y';
                rulerLeft.setPointerCapture(e.pointerId);
                updateSymFromRuler(e, 'y');
            }
        });
    }
    
    const updateSymFromRuler = (e, axis) => {
        const p = window.EditorManager && window.EditorManager.activeProject;
        if (!p) return;
        
        const z = p.zoomLevel || 1.0;
        const wsRect = document.getElementById('workspace').getBoundingClientRect();
        const canvasRect = document.getElementById('drawing-canvas').getBoundingClientRect();
        
        if (axis === 'x') {
            const startX = canvasRect.left - wsRect.left;
            const pxX = (e.clientX - wsRect.left - startX) / z;
            window.illuSetSymmetryCenter(Math.round(pxX), null);
        } else if (axis === 'y') {
            const startY = canvasRect.top - wsRect.top;
            const pxY = (e.clientY - wsRect.top - startY) / z;
            window.illuSetSymmetryCenter(null, Math.round(pxY));
        }
    };
    
    const handleMove = (e) => {
        if (!dragSymAxis) return;
        updateSymFromRuler(e, dragSymAxis);
    };
    
    const handleUp = (e) => {
        if (!dragSymAxis) return;
        if (dragSymAxis === 'x' && rulerTop) rulerTop.releasePointerCapture(e.pointerId);
        if (dragSymAxis === 'y' && rulerLeft) rulerLeft.releasePointerCapture(e.pointerId);
        dragSymAxis = null;
    };
    
    if (rulerTop) {
        rulerTop.addEventListener('pointermove', handleMove);
        rulerTop.addEventListener('pointerup', handleUp);
        rulerTop.addEventListener('pointercancel', handleUp);
    }
    
    if (rulerLeft) {
        rulerLeft.addEventListener('pointermove', handleMove);
        rulerLeft.addEventListener('pointerup', handleUp);
        rulerLeft.addEventListener('pointercancel', handleUp);
    }
});`;

if (code.includes('tool-sym-x\'].forEach')) {
    code = code.replace(oldEventBinding, newEventBinding);
    fs.writeFileSync('DrawingTools.js', code);
    console.log("DrawingTools patched for ruler dragging.");
} else {
    console.log("oldEventBinding not found.");
}

