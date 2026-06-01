const fs = require('fs');
let code = fs.readFileSync('js/app/app.js', 'utf8');

const topInjection = `
            const minorStep = step / 5;
            if (minorStep >= 1) {
                ctx.strokeStyle = minorTickColor;
                for (let m = 1; m < 5; m++) {
                    const msx = sx + m * minorStep * z;
                    if (msx >= 0 && msx <= width) {
                        ctx.beginPath();
                        ctx.moveTo(Math.round(msx) - 0.5, height - 3);
                        ctx.lineTo(Math.round(msx) - 0.5, height);
                        ctx.stroke();
                    }
                }
            }
        }
        
        // Draw Symmetry X marker
        if (typeof window.illuGetSymmetryAxes === 'function') {
            const sym = window.illuGetSymmetryAxes();
            if (sym && sym.x) {
                const sx = startX + sym.cx * z;
                if (sx >= 0 && sx <= width) {
                    ctx.fillStyle = '#00ffff';
                    ctx.beginPath();
                    ctx.moveTo(sx, height);
                    ctx.lineTo(sx - 4, height - 6);
                    ctx.lineTo(sx + 4, height - 6);
                    ctx.fill();
                }
            }
        }
    }`;

const leftInjection = `
            const minorStep = step / 5;
            if (minorStep >= 1) {
                ctx.strokeStyle = minorTickColor;
                for (let m = 1; m < 5; m++) {
                    const msy = sy + m * minorStep * z;
                    if (msy >= 0 && msy <= height) {
                        ctx.beginPath();
                        ctx.moveTo(width - 3, Math.round(msy) - 0.5);
                        ctx.lineTo(width, Math.round(msy) - 0.5);
                        ctx.stroke();
                    }
                }
            }
        }
        
        // Draw Symmetry Y marker
        if (typeof window.illuGetSymmetryAxes === 'function') {
            const sym = window.illuGetSymmetryAxes();
            if (sym && sym.y) {
                const sy = startY + sym.cy * z;
                if (sy >= 0 && sy <= height) {
                    ctx.fillStyle = '#00ffff';
                    ctx.beginPath();
                    ctx.moveTo(width, sy);
                    ctx.lineTo(width - 6, sy - 4);
                    ctx.lineTo(width - 6, sy + 4);
                    ctx.fill();
                }
            }
        }
    }`;

code = code.replace(/const minorStep = step \/ 5;[\s\S]*?\}\s*\}\s*\}/, topInjection);
// Since there are two occurrences of this block, the first replace takes care of top. 
// I will just use string replace on the full function or search for specific text.

fs.writeFileSync('js/app/app.js', code);
