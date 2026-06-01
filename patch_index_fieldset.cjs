const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// I will look for the old fieldset I inserted.
html = html.replace(/<fieldset class="illu-ribbon-group" data-illu-ribbon-group="smudge">[\s\S]*?<\/fieldset>/, 
`<fieldset id="opt-grp-smudge-params" class="opt-grp illu-ribbon-group" data-illu-ribbon-group="smudge" hidden>
    <legend class="illu-ribbon-group-label" data-i18n="tools.smudge">Doigt</legend>
    <div class="illu-ribbon-group-body">
        <span class="field-row illu-gauge-field">
            <label for="tool-smudge-intensity" class="illu-opt-lbl">Intensité</label>
            <span class="illu-gauge-wrap">
                <span class="illu-gauge-fill" aria-hidden="true"></span>
                <span class="illu-gauge-val" id="tool-smudge-intensity-val">50</span>
                <input type="range" id="tool-smudge-intensity" class="illu-gauge-input" min="1" max="100" value="50">
            </span>
        </span>
    </div>
</fieldset>`);

html = html.replace(/<fieldset class="illu-ribbon-group" data-illu-ribbon-group="symmetry">[\s\S]*?<\/fieldset>/, 
`<fieldset id="opt-grp-symmetry-params" class="opt-grp illu-ribbon-group" data-illu-ribbon-group="symmetry" hidden>
    <legend class="illu-ribbon-group-label" data-i18n="tools.symmetry">Symétrie</legend>
    <div class="illu-ribbon-group-body">
        <span class="field-row">
            <input type="checkbox" id="tool-sym-x">
            <label for="tool-sym-x" class="illu-opt-lbl">Sym. X</label>
        </span>
        <span class="field-row">
            <input type="checkbox" id="tool-sym-y">
            <label for="tool-sym-y" class="illu-opt-lbl">Sym. Y</label>
        </span>
    </div>
</fieldset>`);

fs.writeFileSync('index.html', html);
console.log("HTML fieldsets patched.");
