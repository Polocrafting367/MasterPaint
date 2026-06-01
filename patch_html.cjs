const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const oldCode = `<span class="field-row">
            <input type="checkbox" id="tool-sym-x">
            <label for="tool-sym-x" class="illu-opt-lbl">Sym. X</label>
        </span>
        <span class="field-row">
            <input type="checkbox" id="tool-sym-y">
            <label for="tool-sym-y" class="illu-opt-lbl">Sym. Y</label>
        </span>`;

const newCode = `<span class="field-row" style="display:flex; align-items:center; gap:4px; margin:0 4px;">
            <label class="opt-bar-check" style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                <input type="checkbox" id="tool-sym-x" style="appearance:auto; width:16px; height:16px; margin:0;">
                <span class="illu-opt-lbl">Sym. X</span>
            </label>
        </span>
        <span class="field-row" style="display:flex; align-items:center; gap:4px; margin:0 4px;">
            <label class="opt-bar-check" style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                <input type="checkbox" id="tool-sym-y" style="appearance:auto; width:16px; height:16px; margin:0;">
                <span class="illu-opt-lbl">Sym. Y</span>
            </label>
        </span>`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('index.html', code);
console.log("Patched index.html");
