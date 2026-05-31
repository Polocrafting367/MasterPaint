const fs = require('fs');
let code = fs.readFileSync('EditorManager.js', 'utf8');

const filterLogic = `
    applyCmjnFilter(r, g, b) {
        const r_prime = r / 255;
        const g_prime = g / 255;
        const b_prime = b / 255;
        
        let k = 1 - Math.max(r_prime, g_prime, b_prime);
        let c = 0, m = 0, y = 0;
        if (k < 1) {
            c = (1 - r_prime - k) / (1 - k);
            m = (1 - g_prime - k) / (1 - k);
            y = (1 - b_prime - k) / (1 - k);
        }
        
        const ic = { r: 0.0, g: 0.6, b: 0.86 };
        const im = { r: 0.88, g: 0.0, b: 0.47 };
        const iy = { r: 1.0, g: 0.94, b: 0.0 };
        const ik = { r: 0.1, g: 0.1, b: 0.1 };
        
        const rf = (1 - c * (1 - ic.r)) * (1 - m * (1 - im.r)) * (1 - y * (1 - iy.r)) * (1 - k * (1 - ik.r));
        const gf = (1 - c * (1 - ic.g)) * (1 - m * (1 - im.g)) * (1 - y * (1 - iy.g)) * (1 - k * (1 - ik.g));
        const bf = (1 - c * (1 - ic.b)) * (1 - m * (1 - im.b)) * (1 - y * (1 - iy.b)) * (1 - k * (1 - ik.b));
        
        return {
            r: Math.max(0, Math.min(255, Math.round(rf * 255))),
            g: Math.max(0, Math.min(255, Math.round(gf * 255))),
            b: Math.max(0, Math.min(255, Math.round(bf * 255)))
        };
    },
`;

code = code.replace(/snapColorToPalette\(col, mode\) \{/, filterLogic + '\n    snapColorToPalette(col, mode) {');

const snapLogicOld = `
    snapColorToPalette(col, mode) {
        if (!mode || (!mode.startsWith('pixel-ral') && !mode.startsWith('pixel-cmjn'))) return;
        
        let colors = [];
        if (mode === 'pixel-ral') {
            colors = typeof RAL_COLORS !== 'undefined' ? RAL_COLORS : [];
        } else if (mode === 'pixel-cmjn') {
            colors = [
                { r: 255, g: 255, b: 0 },
                { r: 255, g: 0, b: 255 },
                { r: 0, g: 255, b: 255 },
                { r: 0, g: 0, b: 0 },
                { r: 255, g: 255, b: 255 }
            ];
        }
        if (colors.length === 0) return;
        
        let bestDist = Infinity;
        let best = colors[0];
        for (let c of colors) {
            const dr = col.r - c.r;
            const dg = col.g - c.g;
            const db = col.b - c.b;
            const dist = dr*dr + dg*dg + db*db;
            if (dist < bestDist) {
                bestDist = dist;
                best = c;
            }
        }
        col.r = best.r;
        col.g = best.g;
        col.b = best.b;
    },`;

const snapLogicNew = `
    snapColorToPalette(col, mode) {
        if (!mode || (!mode.startsWith('pixel-ral') && !mode.startsWith('pixel-cmjn'))) return;
        
        if (mode === 'pixel-cmjn') {
            const out = this.applyCmjnFilter(col.r, col.g, col.b);
            col.r = out.r; col.g = out.g; col.b = out.b;
            return;
        }

        let colors = [];
        if (mode === 'pixel-ral') {
            colors = typeof RAL_COLORS !== 'undefined' ? RAL_COLORS : [];
        }
        if (colors.length === 0) return;
        
        let bestDist = Infinity;
        let best = colors[0];
        for (let c of colors) {
            const dr = col.r - c.r;
            const dg = col.g - c.g;
            const db = col.b - c.b;
            const dist = dr*dr + dg*dg + db*db;
            if (dist < bestDist) {
                bestDist = dist;
                best = c;
            }
        }
        col.r = best.r;
        col.g = best.g;
        col.b = best.b;
    },`;

code = code.replace(snapLogicOld, snapLogicNew);

const wheelLogicOld = `
        let colors = [];
        if (p.mode === 'pixel-ral') {
            colors = typeof RAL_COLORS !== 'undefined' ? RAL_COLORS : [];
        } else if (p.mode === 'pixel-cmjn') {
            colors = [
                { r: 255, g: 255, b: 0 },
                { r: 255, g: 0, b: 255 },
                { r: 0, g: 255, b: 255 },
                { r: 0, g: 0, b: 0 },
                { r: 255, g: 255, b: 255 }
            ];
        }
        
        if (colors.length > 0) {
            for (let i = 0; i < d_.length; i += 4) {
                if (d_[i+3] > 0) {
                    let bestDist = Infinity;
                    let best = colors[0];
                    for (let c of colors) {
                        const dr = d_[i] - c.r;
                        const dg = d_[i+1] - c.g;
                        const db = d_[i+2] - c.b;
                        const dist = dr*dr + dg*dg + db*db;
                        if (dist < bestDist) {
                            bestDist = dist;
                            best = c;
                        }
                    }
                    d_[i] = best.r;
                    d_[i+1] = best.g;
                    d_[i+2] = best.b;
                }
            }
        }`;

const wheelLogicNew = `
        if (p.mode === 'pixel-cmjn') {
            for (let i = 0; i < d_.length; i += 4) {
                if (d_[i+3] > 0) {
                    const out = this.applyCmjnFilter(d_[i], d_[i+1], d_[i+2]);
                    d_[i] = out.r;
                    d_[i+1] = out.g;
                    d_[i+2] = out.b;
                }
            }
        } else if (p.mode === 'pixel-ral') {
            const colors = typeof RAL_COLORS !== 'undefined' ? RAL_COLORS : [];
            if (colors.length > 0) {
                for (let i = 0; i < d_.length; i += 4) {
                    if (d_[i+3] > 0) {
                        let bestDist = Infinity;
                        let best = colors[0];
                        for (let c of colors) {
                            const dr = d_[i] - c.r;
                            const dg = d_[i+1] - c.g;
                            const db = d_[i+2] - c.b;
                            const dist = dr*dr + dg*dg + db*db;
                            if (dist < bestDist) {
                                bestDist = dist;
                                best = c;
                            }
                        }
                        d_[i] = best.r;
                        d_[i+1] = best.g;
                        d_[i+2] = best.b;
                    }
                }
            }
        }`;

code = code.replace(wheelLogicOld, wheelLogicNew);

const convCmjnOld = `
        const cmjnColors = [
            { r: 255, g: 255, b: 0 },
            { r: 255, g: 0, b: 255 },
            { r: 0, g: 255, b: 255 },
            { r: 0, g: 0, b: 0 },
            { r: 255, g: 255, b: 255 }
        ];

        for (const layer of p.layers) {
            if (layer.buffer) {
                const ctx = layer.buffer.getContext('2d', { willReadFrequently: true });
                const idata = ctx.getImageData(0, 0, layer.buffer.width, layer.buffer.height);
                const d_ = idata.data;
                
                for (let i = 0; i < d_.length; i += 4) {
                    const a = d_[i + 3];
                    if (a < 128) continue;
                    
                    const r = d_[i], g = d_[i + 1], b = d_[i + 2];
                    let bestDist = Infinity;
                    let bestColor = cmjnColors[0] || { r: 0, g: 0, b: 0 };
                    
                    for (let c = 0; c < cmjnColors.length; c++) {
                        const col = cmjnColors[c];
                        const dist = (r - col.r)**2 + (g - col.g)**2 + (b - col.b)**2;
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestColor = col;
                        }
                    }
                    
                    d_[i] = bestColor.r; 
                    d_[i + 1] = bestColor.g; 
                    d_[i + 2] = bestColor.b;
                }
                
                ctx.putImageData(idata, 0, 0);
                layer._thumbDirty = true;
            }
        }`;

const convCmjnNew = `
        for (const layer of p.layers) {
            if (layer.buffer) {
                const ctx = layer.buffer.getContext('2d', { willReadFrequently: true });
                const idata = ctx.getImageData(0, 0, layer.buffer.width, layer.buffer.height);
                const d_ = idata.data;
                
                for (let i = 0; i < d_.length; i += 4) {
                    const a = d_[i + 3];
                    if (a < 128) continue;
                    
                    const out = this.applyCmjnFilter(d_[i], d_[i + 1], d_[i + 2]);
                    
                    d_[i] = out.r; 
                    d_[i + 1] = out.g; 
                    d_[i + 2] = out.b;
                }
                
                ctx.putImageData(idata, 0, 0);
                layer._thumbDirty = true;
            }
        }`;

code = code.replace(convCmjnOld, convCmjnNew);

fs.writeFileSync('EditorManager.js', code);
