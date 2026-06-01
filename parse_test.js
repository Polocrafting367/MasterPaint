const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/<fieldset id="opt-grp-symmetry-params"[\s\S]*?<\/fieldset>/);
if (match) {
    console.log("FOUND:");
    console.log(match[0]);
} else {
    console.log("NOT FOUND");
}
