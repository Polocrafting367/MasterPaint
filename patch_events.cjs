const fs = require('fs');
let content = fs.readFileSync('DrawingTools.js', 'utf8');

const eventBinding = `
document.addEventListener('DOMContentLoaded', () => {
    ['tool-sym-x', 'tool-sym-y'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (typeof EditorManager !== 'undefined' && typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
            });
        }
    });
});
`;

if (!content.includes('tool-sym-x\'].forEach')) {
    content += "\n" + eventBinding;
    fs.writeFileSync('DrawingTools.js', content);
    console.log("Events patched.");
} else {
    console.log("Already patched.");
}
