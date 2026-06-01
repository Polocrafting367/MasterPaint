const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

const oldCode = `function illuGetSymmetryAxes(layer) {
    const symX = document.getElementById('tool-sym-x') && document.getElementById('tool-sym-x').checked;`;
const newCode = `window.illuGetSymmetryAxes = function illuGetSymmetryAxes(layer) {
    const symX = document.getElementById('tool-sym-x') && document.getElementById('tool-sym-x').checked;`;
code = code.replace(oldCode, newCode);

fs.writeFileSync('DrawingTools.js', code);
console.log("Exported illuGetSymmetryAxes");
