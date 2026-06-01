const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

const oldSmudgeLoop = `                                    // Smoothstep weight for 0 at edge
                                    let w = Math.max(0, 1 - Math.sqrt(distToSegSq) / Math.sqrt(R2));
                                    w = w * w * (3 - 2 * w);
                                    const weight = w * pushStrength;`;
const newSmudgeLoop = `                                    // Smoothstep weight for 0 at edge
                                    let weightFactor = Math.max(0, 1 - Math.sqrt(distToSegSq) / Math.sqrt(R2));
                                    weightFactor = weightFactor * weightFactor * (3 - 2 * weightFactor);
                                    const weight = weightFactor * pushStrength;`;
code = code.replace(oldSmudgeLoop, newSmudgeLoop);

fs.writeFileSync('DrawingTools.js', code);
console.log("Shadowing fixed");
