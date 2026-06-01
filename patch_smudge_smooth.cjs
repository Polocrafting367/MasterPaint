const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

const oldSmudgeLoop = `                                    // Use gaussian weight for smoother push
                                    const weight = Math.exp(-3 * distToSegSq / R2) * pushStrength;
                                    const srcX = px - dx * weight;
                                    const srcY = py - dy * weight;`;
const newSmudgeLoop = `                                    // Smoothstep weight for 0 at edge
                                    let w = Math.max(0, 1 - Math.sqrt(distToSegSq) / Math.sqrt(R2));
                                    w = w * w * (3 - 2 * w);
                                    const weight = w * pushStrength;
                                    const srcX = px - dx * weight;
                                    const srcY = py - dy * weight;`;
code = code.replace(oldSmudgeLoop, newSmudgeLoop);

fs.writeFileSync('DrawingTools.js', code);
console.log("Smoothstep applied");
