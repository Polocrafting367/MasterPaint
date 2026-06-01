const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

// clone
code = code.replace(
    "paramGroups: ['opt-grp-size-params', 'opt-grp-symmetry-params']\n    },\n    gradient",
    "paramGroups: ['opt-grp-size-params', 'opt-grp-clone-params', 'opt-grp-symmetry-params']\n    },\n    gradient"
);

// shapes
const shapes = ['rect', 'circle', 'line', 'text', 'cubic-3', 'pen', 'polygon', 'round-3', 'triangle', 'star', 'reg-poly', 'diamond', 'trapezoid', 'parallelogram', 'triangle-right', 'callout', 'eraser'];

shapes.forEach(shape => {
    // Regex to add 'opt-grp-symmetry-params' if it's not already there
    const regex = new RegExp(`('${shape}'|${shape}):\\s*{([^}]*)paramGroups:\\s*\\[([^\\]]*)\\]`, 'g');
    code = code.replace(regex, (match, g1, g2, g3) => {
        if (!g3.includes('opt-grp-symmetry-params')) {
            const newGroups = g3.trim().length > 0 ? g3 + ", 'opt-grp-symmetry-params'" : "'opt-grp-symmetry-params'";
            return `${g1}: {${g2}paramGroups: [${newGroups}]`;
        }
        return match;
    });
});

fs.writeFileSync('DrawingTools.js', code);
console.log("Patched TOOL_OPTIONS_UI");
