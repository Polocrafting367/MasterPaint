const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

const oldSmudge = `                                const distToSegSq = (px - cx)**2 + (py - cy)**2;

                                if (distToSegSq < R2) {
                                    // Smoothstep weight for 0 at edge
                                    let weightFactor = Math.max(0, 1 - Math.sqrt(distToSegSq) / Math.sqrt(R2));
                                    weightFactor = weightFactor * weightFactor * (3 - 2 * weightFactor);
                                    const weight = weightFactor * pushStrength;
                                    const srcX = px - dx * weight;
                                    const srcY = py - dy * weight;`;

const newSmudge = `                                const distToSegSq = (px - cx)**2 + (py - cy)**2;

                                if (distToSegSq < R2) {
                                    // Smooth quadratic falloff (bell curve)
                                    let weightFactor = 1 - (distToSegSq / R2);
                                    weightFactor = weightFactor * weightFactor;
                                    
                                    // Limit displacement to avoid tearing
                                    const maxDisp = R * 0.8;
                                    const moveDist = dist * weightFactor * pushStrength;
                                    let finalWeight = weightFactor * pushStrength;
                                    if (moveDist > maxDisp) {
                                        finalWeight = finalWeight * (maxDisp / moveDist);
                                    }
                                    
                                    const srcX = px - dx * finalWeight;
                                    const srcY = py - dy * finalWeight;`;

code = code.replace(oldSmudge, newSmudge);
fs.writeFileSync('DrawingTools.js', code);
console.log("Patched smudge math");
