const fs = require('fs');
let code = fs.readFileSync('DrawingTools.js', 'utf8');

const oldSmudge = `
            if (window.activeTool === 'smudge' && isSmudgeStroke && smudgeLastCanvas) {
                const intensity = document.getElementById('tool-smudge-intensity') ? parseFloat(document.getElementById('tool-smudge-intensity').value) / 100 : 0.5;
                
                // Create a temporary canvas for the soft brush
                const bCanvas = document.createElement('canvas');
                bCanvas.width = lw;
                bCanvas.height = lw;
                const bCtx = bCanvas.getContext('2d');
                
                // 1. Draw the copied segment from previous position
                bCtx.drawImage(smudgeLastCanvas, sLastX - lw / 2, sLastY - lw / 2, lw, lw, 0, 0, lw, lw);
                
                // 2. Apply a radial gradient to soften the edges (destination-in)
                bCtx.globalCompositeOperation = 'destination-in';
                const grad = bCtx.createRadialGradient(lw / 2, lw / 2, 0, lw / 2, lw / 2, lw / 2);
                grad.addColorStop(0, 'rgba(0,0,0,1)');
                grad.addColorStop(0.8, 'rgba(0,0,0,1)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                bCtx.fillStyle = grad;
                bCtx.fillRect(0, 0, lw, lw);
                
                // 3. Draw the soft brush onto the main canvas with intensity
                ctx.globalAlpha = intensity;
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(bCanvas, slx - lw / 2, sly - lw / 2);
                ctx.globalAlpha = 1.0;
            }`;

const newSmudge = `
            if (window.activeTool === 'smudge' && isSmudgeStroke && smudgeLastCanvas) {
                const intensity = document.getElementById('tool-smudge-intensity') ? parseFloat(document.getElementById('tool-smudge-intensity').value) / 100 : 0.5;
                const dx = slx - sLastX;
                const dy = sly - sLastY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > 0) {
                    const R = lw / 2;
                    const minX = Math.floor(Math.min(sLastX, slx) - R);
                    const minY = Math.floor(Math.min(sLastY, sly) - R);
                    const maxX = Math.ceil(Math.max(sLastX, slx) + R);
                    const maxY = Math.ceil(Math.max(sLastY, sly) + R);
                    const w = maxX - minX;
                    const h = maxY - minY;
                    
                    if (w > 0 && h > 0) {
                        const sCtx = smudgeLastCanvas.getContext('2d');
                        const srcData = sCtx.getImageData(minX, minY, w, h);
                        const dstData = ctx.createImageData(w, h);
                        const sD = srcData.data;
                        const dD = dstData.data;
                        
                        // Limit push strength to avoid total tearing
                        const pushStrength = intensity;
                        const R2 = R * R;
                        
                        for (let y = 0; y < h; y++) {
                            for (let x = 0; x < w; x++) {
                                const px = minX + x;
                                const py = minY + y;
                                
                                const apx = px - sLastX;
                                const apy = py - sLastY;
                                
                                let t = (apx * dx + apy * dy) / (dist * dist);
                                t = Math.max(0, Math.min(1, t));
                                
                                const cx = sLastX + t * dx;
                                const cy = sLastY + t * dy;
                                
                                const distToSegSq = (px - cx)**2 + (py - cy)**2;
                                
                                if (distToSegSq < R2) {
                                    const weight = (1 - distToSegSq / R2) * pushStrength;
                                    const srcX = px - dx * weight;
                                    const srcY = py - dy * weight;
                                    const lx = srcX - minX;
                                    const ly = srcY - minY;
                                    
                                    if (lx >= 0 && lx < w - 1 && ly >= 0 && ly < h - 1) {
                                        const x0 = Math.floor(lx);
                                        const x1 = x0 + 1;
                                        const y0 = Math.floor(ly);
                                        const y1 = y0 + 1;
                                        const wx = lx - x0;
                                        const wy = ly - y0;
                                        
                                        const idx = (y * w + x) * 4;
                                        for (let c = 0; c < 4; c++) {
                                            const p00 = sD[(y0 * w + x0) * 4 + c];
                                            const p10 = sD[(y0 * w + x1) * 4 + c];
                                            const p01 = sD[(y1 * w + x0) * 4 + c];
                                            const p11 = sD[(y1 * w + x1) * 4 + c];
                                            
                                            dD[idx + c] = 
                                                p00 * (1 - wx) * (1 - wy) +
                                                p10 * wx * (1 - wy) +
                                                p01 * (1 - wx) * wy +
                                                p11 * wx * wy;
                                        }
                                    } else {
                                        const idx = (y * w + x) * 4;
                                        dD[idx] = sD[idx]; dD[idx+1] = sD[idx+1]; dD[idx+2] = sD[idx+2]; dD[idx+3] = sD[idx+3];
                                    }
                                } else {
                                    const idx = (y * w + x) * 4;
                                    dD[idx] = sD[idx]; dD[idx+1] = sD[idx+1]; dD[idx+2] = sD[idx+2]; dD[idx+3] = sD[idx+3];
                                }
                            }
                        }
                        
                        // Overwrite canvas with displaced pixels
                        ctx.putImageData(dstData, minX, minY);
                        
                        // Update smudgeLastCanvas snapshot directly from the drawn layer
                        sCtx.clearRect(minX, minY, w, h);
                        sCtx.drawImage(EditorManager.activeLayer.buffer, minX, minY, w, h, minX, minY, w, h);
                    }
                }
            }`;

if (code.includes('if (window.activeTool === \'smudge\' && isSmudgeStroke && smudgeLastCanvas)')) {
    code = code.replace(oldSmudge, newSmudge);
    fs.writeFileSync('DrawingTools.js', code);
    console.log("Liquify smudge tool patched.");
} else {
    console.log("Smudge tool condition not found.");
}
