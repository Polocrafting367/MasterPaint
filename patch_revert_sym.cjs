const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const currentCode = `<div id="opt-grp-symmetry-params" class="opt-grp illu-ribbon-param-pack" hidden>
    <span class="field-row illu-size-extra-row">
        <label class="opt-bar-check">
            <input type="checkbox" id="tool-sym-x">
            <span class="illu-opt-lbl">Sym. X</span>
        </label>
    </span>
    <span class="field-row illu-size-extra-row">
        <label class="opt-bar-check">
            <input type="checkbox" id="tool-sym-y">
            <span class="illu-opt-lbl">Sym. Y</span>
        </label>
    </span>
</div>`;

console.log(html.indexOf(currentCode));
