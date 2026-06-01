const fs = require('fs');
let code = fs.readFileSync('EditorManager.js', 'utf8');

code = code.replace(/lX.setAttribute\('stroke', '#ff00ff'\);/g, "lX.setAttribute('stroke', '#00ffff');");
code = code.replace(/lY.setAttribute\('stroke', '#ff00ff'\);/g, "lY.setAttribute('stroke', '#00ffff');");

fs.writeFileSync('EditorManager.js', code);
console.log("EditorManager patched.");
