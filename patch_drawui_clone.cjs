const fs = require('fs');
let code = fs.readFileSync('EditorManager.js', 'utf8');

const drawUILogic = `
        if (window.activeTool === 'clone' && window.cloneAnchor) {
            // If dragging, we draw a crosshair at current source position
            if (typeof isDrawing !== 'undefined' && isDrawing && typeof window.lastKnownMousePos !== 'undefined') {
                const z = EditorManager.activeProject.zoomLevel || 1.0;
                const offset = window.cloneOffset || {x: 0, y: 0};
                
                // Mouse position in document coords
                const docX = window.lastKnownMousePos.x;
                const docY = window.lastKnownMousePos.y;
                
                // Convert back to canvas coords to subtract offset, then back to doc coords?
                // Wait, if offset is in canvas coords, we can just subtract offset * z
                const srcDocX = docX - offset.x * z;
                const srcDocY = docY - offset.y * z;
                
                const crossSize = 10;
                let cX = document.getElementById('clone-src-x');
                let cY = document.getElementById('clone-src-y');
                
                if (!cX) {
                    cX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    cX.id = 'clone-src-x';
                    cX.setAttribute('stroke', '#000000');
                    cX.setAttribute('stroke-width', '1.5');
                    EditorManager.svgUI.appendChild(cX);
                }
                if (!cY) {
                    cY = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    cY.id = 'clone-src-y';
                    cY.setAttribute('stroke', '#000000');
                    cY.setAttribute('stroke-width', '1.5');
                    EditorManager.svgUI.appendChild(cY);
                }
                
                cX.setAttribute('x1', srcDocX - crossSize);
                cX.setAttribute('y1', srcDocY);
                cX.setAttribute('x2', srcDocX + crossSize);
                cX.setAttribute('y2', srcDocY);
                
                cY.setAttribute('x1', srcDocX);
                cY.setAttribute('y1', srcDocY - crossSize);
                cY.setAttribute('x2', srcDocX);
                cY.setAttribute('y2', srcDocY + crossSize);
                
                // Optional white outline for visibility on dark backgrounds
                // ...
            } else {
                const cX = document.getElementById('clone-src-x');
                const cY = document.getElementById('clone-src-y');
                if (cX) cX.remove();
                if (cY) cY.remove();
            }
        } else {
            const cX = document.getElementById('clone-src-x');
            const cY = document.getElementById('clone-src-y');
            if (cX) cX.remove();
            if (cY) cY.remove();
        }
`;

// Insert it somewhere near the brush cursor logic in drawUI
const insertTarget = "if (['brush', 'eraser', 'smudge', 'wand', 'pencil'].includes(t)) {";
const replacement = drawUILogic + "\n        " + insertTarget;

if (code.includes(insertTarget)) {
    code = code.replace(insertTarget, replacement);
    fs.writeFileSync('EditorManager.js', code);
    console.log("drawUI patched for clone crosshair.");
} else {
    console.log("insert target not found.");
}
