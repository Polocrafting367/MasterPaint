const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

const oldCloneStart = `    if (window.activeTool === 'clone') {
        if (e.altKey || !window.cloneAnchor) {
            window.cloneAnchor = { x: pos.x, y: pos.y };
            if (typeof window.showIlluAlert === 'function') window.showIlluAlert('Point source du tampon défini.');
            isDrawing = false;
            return;
        }`;

const newCloneStart = `    if (window.activeTool === 'clone') {
        if (e.altKey || !window.cloneAnchor) {
            window.cloneAnchor = { x: pos.x, y: pos.y };
            const cloneTxt = document.getElementById('clone-tool-state-text');
            if (cloneTxt) cloneTxt.textContent = 'Zone définie. Prêt (dessinez).';
            if (typeof window.showIlluAlert === 'function') window.showIlluAlert('Point source du tampon défini.');
            isDrawing = false;
            return;
        }`;

code = code.replace(oldCloneStart, newCloneStart);

const oldToolChange = `    if (cfg.actionGroups) {`;
const newToolChange = `    const cloneTxt = document.getElementById('clone-tool-state-text');
    if (cloneTxt) {
        if (!window.cloneAnchor) cloneTxt.textContent = 'Cliquez pour définir la zone source.';
        else cloneTxt.textContent = 'Zone définie. Prêt (dessinez).';
    }

    if (cfg.actionGroups) {`;

code = code.replace(oldToolChange, newToolChange);

fs.writeFileSync('DrawingTools.js', code);
console.log("Patched clone ui logic");
