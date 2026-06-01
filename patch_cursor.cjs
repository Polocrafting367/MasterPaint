const fs = require('fs');
let code = fs.readFileSync('EditorManager.js', 'utf8');

const oldCursor = `        if (window.activeTool === 'clone' && window.cloneAnchor && typeof isDrawing !== 'undefined' && isDrawing && window.lastKnownMousePos) {`;

const newCursor = `        if (window.activeTool === 'clone' && !window.cloneAnchor && window.lastKnownMousePos) {
            const z = this.zoomLevel || 1.0;
            const docX = window.lastKnownMousePos.x;
            const docY = window.lastKnownMousePos.y;
            const crossSize = 10 / z;
            const crossG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            crossG.setAttribute('pointer-events', 'none');

            const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            l1.setAttribute('x1', String(docX - crossSize)); l1.setAttribute('y1', String(docY));
            l1.setAttribute('x2', String(docX + crossSize)); l1.setAttribute('y2', String(docY));
            l1.setAttribute('stroke', '#ff0000'); l1.setAttribute('stroke-width', String(2 / z));
            
            const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            l2.setAttribute('x1', String(docX)); l2.setAttribute('y1', String(docY - crossSize));
            l2.setAttribute('x2', String(docX)); l2.setAttribute('y2', String(docY + crossSize));
            l2.setAttribute('stroke', '#ff0000'); l2.setAttribute('stroke-width', String(2 / z));
            
            const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circ.setAttribute('cx', String(docX)); circ.setAttribute('cy', String(docY));
            circ.setAttribute('r', String(5 / z));
            circ.setAttribute('fill', 'none'); circ.setAttribute('stroke', '#ff0000'); circ.setAttribute('stroke-width', String(1 / z));

            crossG.appendChild(l1);
            crossG.appendChild(l2);
            crossG.appendChild(circ);
            svgUI.appendChild(crossG);
        }

        if (window.activeTool === 'clone' && window.cloneAnchor && typeof isDrawing !== 'undefined' && isDrawing && window.lastKnownMousePos) {`;

code = code.replace(oldCursor, newCursor);

fs.writeFileSync('EditorManager.js', code);
console.log("Patched EditorManager cursor");
