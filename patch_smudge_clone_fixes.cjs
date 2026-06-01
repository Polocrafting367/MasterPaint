const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

// Fix willReadFrequently and smudge logic
const oldSmudgeCanvas = `smudgeLastCanvas.getContext('2d').drawImage(EditorManager.activeLayer.buffer, 0, 0);`;
const newSmudgeCanvas = `smudgeLastCanvas.getContext('2d', { willReadFrequently: true }).drawImage(EditorManager.activeLayer.buffer, 0, 0);`;
code = code.replace(oldSmudgeCanvas, newSmudgeCanvas);

const oldSmudgeLoop = `                                if (distToSegSq < R2) {
                                    const weight = (1 - distToSegSq / R2) * pushStrength;
                                    const srcX = px - dx * weight;
                                    const srcY = py - dy * weight;`;
const newSmudgeLoop = `                                if (distToSegSq < R2) {
                                    // Use gaussian weight for smoother push
                                    const weight = Math.exp(-3 * distToSegSq / R2) * pushStrength;
                                    const srcX = px - dx * weight;
                                    const srcY = py - dy * weight;`;
code = code.replace(oldSmudgeLoop, newSmudgeLoop);

// Fix lx not defined in clone
const oldCloneLogic = `    if (window.activeTool === 'clone') {
        if (e.altKey || !window.cloneAnchor) {
            window.cloneAnchor = { x: lx, y: ly };`;
const newCloneLogic = `    if (window.activeTool === 'clone') {
        if (e.altKey || !window.cloneAnchor) {
            window.cloneAnchor = { x: pos.x, y: pos.y };`;
code = code.replace(oldCloneLogic, newCloneLogic);

// Fix clone offset
const oldCloneOffset = `window.cloneOffset = { x: lx - window.cloneAnchor.x, y: ly - window.cloneAnchor.y };`;
const newCloneOffset = `window.cloneOffset = { x: pos.x - window.cloneAnchor.x, y: pos.y - window.cloneAnchor.y };`;
code = code.replace(oldCloneOffset, newCloneOffset);

fs.writeFileSync('DrawingTools.js', code);
console.log("Fixes applied to DrawingTools.js");
