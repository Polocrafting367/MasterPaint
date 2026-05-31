const fs = require('fs');
let code = fs.readFileSync('js/effects/filter-worker.js', 'utf8');

const filterCmjnOld = `
                const dither = (val('ef-cmjn-dither') || 0) / 100;
                
                const cmjnColors = [
                    { r: 255, g: 255, b: 0 },
                    { r: 255, g: 0, b: 255 },
                    { r: 0, g: 255, b: 255 },
                    { r: 0, g: 0, b: 0 },
                    { r: 255, g: 255, b: 255 }
                ];
                
                const findNearest = (r, g, b) => {
                    let bestDist = Infinity;
                    let bestColor = cmjnColors[0];
                    for (let c = 0; c < cmjnColors.length; c++) {
                        const col = cmjnColors[c];
                        const dist = (r - col.r)**2 + (g - col.g)**2 + (b - col.b)**2;
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestColor = col;
                        }
                    }
                    return bestColor;
                };

                for (let y = safeSy; y < safeEy; y++) {
                    const rowOff = y * w * 4;
                    for (let x = 0; x < w; x++) {
                        const i = rowOff + x * 4;
                        if (d_[i + 3] === 0) continue;
                        
                        let r = d_[i], g = d_[i + 1], b = d_[i + 2];
                        let error = [0, 0, 0];
                        if (dither > 0) {
                            error = getError(x, y);
                            r += error[0] * dither;
                            g += error[1] * dither;
                            b += error[2] * dither;
                        }
                        
                        const col = findNearest(r, g, b);
                        d_[i] = col.r;
                        d_[i + 1] = col.g;
                        d_[i + 2] = col.b;
                        
                        if (dither > 0) {
                            addError(x, y, r - col.r, g - col.g, b - col.b);
                        }
                    }
                }`;

const filterCmjnNew = `
                for (let y = safeSy; y < safeEy; y++) {
                    const rowOff = y * w * 4;
                    for (let x = 0; x < w; x++) {
                        const i = rowOff + x * 4;
                        if (d_[i + 3] === 0) continue;
                        
                        const r = d_[i], g = d_[i + 1], b = d_[i + 2];
                        
                        const r_prime = r / 255;
                        const g_prime = g / 255;
                        const b_prime = b / 255;
                        
                        let k = 1 - Math.max(r_prime, g_prime, b_prime);
                        let c = 0, m = 0, y_val = 0;
                        if (k < 1) {
                            c = (1 - r_prime - k) / (1 - k);
                            m = (1 - g_prime - k) / (1 - k);
                            y_val = (1 - b_prime - k) / (1 - k);
                        }
                        
                        const ic = { r: 0.0, g: 0.6, b: 0.86 };
                        const im = { r: 0.88, g: 0.0, b: 0.47 };
                        const iy = { r: 1.0, g: 0.94, b: 0.0 };
                        const ik = { r: 0.1, g: 0.1, b: 0.1 };
                        
                        const rf = (1 - c * (1 - ic.r)) * (1 - m * (1 - im.r)) * (1 - y_val * (1 - iy.r)) * (1 - k * (1 - ik.r));
                        const gf = (1 - c * (1 - ic.g)) * (1 - m * (1 - im.g)) * (1 - y_val * (1 - iy.g)) * (1 - k * (1 - ik.g));
                        const bf = (1 - c * (1 - ic.b)) * (1 - m * (1 - im.b)) * (1 - y_val * (1 - iy.b)) * (1 - k * (1 - ik.b));
                        
                        d_[i] = Math.max(0, Math.min(255, Math.round(rf * 255)));
                        d_[i + 1] = Math.max(0, Math.min(255, Math.round(gf * 255)));
                        d_[i + 2] = Math.max(0, Math.min(255, Math.round(bf * 255)));
                    }
                }`;

code = code.replace(filterCmjnOld, filterCmjnNew);
fs.writeFileSync('js/effects/filter-worker.js', code);
