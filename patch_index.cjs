const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const smudgeStr = `<div id="opt-grp-smudge-params" class="opt-grp illu-ribbon-param-pack" hidden>
                        <span class="field-row illu-gauge-field">
                            <label for="tool-smudge-intensity" class="illu-opt-lbl">Intensité</label>
                            <span class="illu-gauge-wrap">
                                <span class="illu-gauge-fill" aria-hidden="true"></span>
                                <span class="illu-gauge-val" id="tool-smudge-intensity-val">50</span>
                                <input type="range" id="tool-smudge-intensity" class="illu-gauge-input" min="1" max="100" value="50">
                            </span>
                        </span>
                    </div>`;

const symStr = `<div id="opt-grp-symmetry-params" class="opt-grp illu-ribbon-param-pack" hidden>
                        <span class="field-row">
                            <input type="checkbox" id="tool-sym-x">
                            <label for="tool-sym-x" class="illu-opt-lbl">Sym. X</label>
                        </span>
                        <span class="field-row">
                            <input type="checkbox" id="tool-sym-y">
                            <label for="tool-sym-y" class="illu-opt-lbl">Sym. Y</label>
                        </span>
                    </div>`;

const smudgeReplacement = `<fieldset class="illu-ribbon-group" data-illu-ribbon-group="smudge">
                        <legend class="illu-ribbon-group-label">Doigt</legend>
                        <div class="illu-ribbon-group-body">
                            ${smudgeStr.replace(/hidden/g, '')}
                        </div>
                    </fieldset>`;

const symReplacement = `<fieldset class="illu-ribbon-group" data-illu-ribbon-group="symmetry">
                        <legend class="illu-ribbon-group-label">Symétrie</legend>
                        <div class="illu-ribbon-group-body">
                            ${symStr.replace(/hidden/g, '')}
                        </div>
                    </fieldset>`;

if (html.includes(smudgeStr)) {
    html = html.replace(smudgeStr, smudgeReplacement);
}
if (html.includes(symStr)) {
    html = html.replace(symStr, symReplacement);
}

// But wait, the JS looks for #opt-grp-smudge-params and sets its hidden property.
// However, illu-tool-ribbon.js might hide the parent fieldset automatically if it doesn't match the tool's paramGroups!
// Let's modify EditorManager.js to handle the fieldset visibility instead.

fs.writeFileSync('index.html', html);
console.log("HTML patched.");
