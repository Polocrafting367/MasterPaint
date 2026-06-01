const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const oldSymmetry = `<div id="opt-grp-symmetry-params" class="opt-grp illu-ribbon-param-pack" hidden>
    <span class="field-row" style="display:flex; align-items:center; gap:4px; margin:0 4px;">
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
    </span>
</div>`;

const newCode = `<fieldset id="opt-grp-clone-params" class="opt-grp illu-ribbon-group" data-illu-ribbon-group="clone" hidden>
    <legend class="illu-ribbon-group-label" data-i18n="tools.clone">Tampon</legend>
    <div class="illu-ribbon-group-body">
        <span class="field-row" style="font-size: 11px; white-space: normal; line-height: 1.2; text-align: center; max-width: 140px;" id="clone-tool-state-text">
            Cliquez pour définir la zone source.
        </span>
    </div>
</fieldset>
<fieldset id="opt-grp-symmetry-params" class="opt-grp illu-ribbon-group" data-illu-ribbon-group="symmetry" hidden>
    <legend class="illu-ribbon-group-label" data-i18n="tools.symmetry">Symétrie</legend>
    <div class="illu-ribbon-group-body">
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
    </div>
</fieldset>`;

if (code.includes(oldSymmetry)) {
    code = code.replace(oldSymmetry, newCode);
    fs.writeFileSync('index.html', code);
    console.log("Successfully replaced oldSymmetry with clone and symmetry groups.");
} else {
    console.log("oldSymmetry not found in index.html");
}
