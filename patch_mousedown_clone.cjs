const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

const oldToolCheck = `['brush', 'pencil', 'eraser', 'smudge', 'fill'].includes(window.activeTool)`;
const newToolCheck = `['brush', 'pencil', 'eraser', 'smudge', 'clone', 'fill'].includes(window.activeTool)`;

code = code.replace(oldToolCheck, newToolCheck);

const oldBrushCheck = `if (['brush', 'pencil', 'eraser', 'smudge'].includes(window.activeTool)) {`;
const newBrushCheck = `if (window.activeTool === 'clone') {
        if (e.altKey || !window.cloneAnchor) {
            window.cloneAnchor = { x: lx, y: ly };
            if (typeof window.showIlluAlert === 'function') window.showIlluAlert('Point source du tampon défini.');
            isDrawing = false;
            return;
        }
        window.cloneOffset = { x: lx - window.cloneAnchor.x, y: ly - window.cloneAnchor.y };
        if (EditorManager.activeLayer && EditorManager.activeLayer.buffer) {
            window.cloneSourceCanvas = document.createElement('canvas');
            window.cloneSourceCanvas.width = EditorManager.activeLayer.buffer.width;
            window.cloneSourceCanvas.height = EditorManager.activeLayer.buffer.height;
            window.cloneSourceCanvas.getContext('2d').drawImage(EditorManager.activeLayer.buffer, 0, 0);
        }
    }

    if (['brush', 'pencil', 'eraser', 'smudge', 'clone'].includes(window.activeTool)) {`;

code = code.replace(oldBrushCheck, newBrushCheck);

fs.writeFileSync('DrawingTools.js', code);
console.log("handleMouseDown patched for clone tool.");
