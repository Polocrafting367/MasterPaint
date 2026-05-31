const fs = require('fs');
let code = fs.readFileSync('EditorManager.js', 'utf8');

// 1. Remove setupRalPalette and setupCmjnPalette
code = code.replace(/setupRalPalette\(\) \{[\s\S]*?setupCmjnPalette\(\) \{[\s\S]*?container\.appendChild\(swatch\);\n        \}\);\n    \},/m, '');

// 2. Add color wheel modification logic and snapColorToPalette
const colorLogic = `
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
    },

    updateColorWheelForMode() {
        const canvas = document.getElementById('color-wheel');
        if (!canvas || !this._originalColorWheelImageData) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        const p = this.activeProject;
        if (!p || (p.mode !== 'pixel-ral' && p.mode !== 'pixel-cmjn')) {
            ctx.putImageData(this._originalColorWheelImageData, 0, 0);
            return;
        }
        
        const img = new ImageData(new Uint8ClampedArray(this._originalColorWheelImageData.data), canvas.width, canvas.height);
        const d_ = img.data;
        
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
        }
        ctx.putImageData(img, 0, 0);
    },
`;
code = code.replace(/saveHistory\(actionName, options = \{\}\) \{/, colorLogic + '\n    saveHistory(actionName, options = {}) {');

// 3. Fix applyProjectToUI block
const uiBlockOld = `        // --- Handle Dither/RAL/CMJN Palette Visibility and Grisé UI ---
        const isDither = p.mode === 'pixel-dither';
        const isRal = p.mode === 'pixel-ral';
        const isCmjn = p.mode === 'pixel-cmjn';
        
        const bitBtn = document.getElementById('btn-toggle-8bit');
        const ditherContainer = document.getElementById('color-dither-container');
        const ralContainer = document.getElementById('color-ral-container');
        const cmjnContainer = document.getElementById('color-cmjn-container');
        const wheelContainer = document.getElementById('color-wheel-container');
        const bitContainer = document.getElementById('color-8bit-container');
        const sliderPanel = document.getElementById('color-sliders-panel');
        const palGrid = document.getElementById('palette-grid');
        const wheelIco = bitBtn ? bitBtn.parentElement : null; // color-top-row
        const swatchBox = document.querySelector('.color-swatch-box');

        if (isDither || isRal || isCmjn) {
            if (bitBtn) bitBtn.style.display = 'none';
            if (ditherContainer) ditherContainer.style.display = isDither ? 'block' : 'none';
            if (ralContainer) ralContainer.style.display = isRal ? 'block' : 'none';
            if (cmjnContainer) cmjnContainer.style.display = isCmjn ? 'block' : 'none';
            if (wheelContainer) wheelContainer.style.display = 'none';
            if (bitContainer) bitContainer.style.display = 'none';
            
            if (isDither) {
                this.setupDitherPalette();
                // Sync current dither size slider
                const slider = document.getElementById('dither-size-slider');
                if (slider) {
                    slider.value = this.ditherEffectSize;
                    const gaugeWrap = slider.closest('.illu-gauge-wrap');
                }
            } else if (isRal) {
                this.setupRalPalette();
            } else if (isCmjn) {
                this.setupCmjnPalette();
            }
        } else {
            if (bitBtn) bitBtn.style.display = 'block';
            if (ditherContainer) ditherContainer.style.display = 'none';
            if (ralContainer) ralContainer.style.display = 'none';
            if (cmjnContainer) cmjnContainer.style.display = 'none';
        }`;

const uiBlockNew = `        // --- Handle Dither Palette Visibility and Grisé UI ---
        const isDither = p.mode === 'pixel-dither';
        const isRalOrCmjn = (p.mode === 'pixel-ral' || p.mode === 'pixel-cmjn');
        const bitBtn = document.getElementById('btn-toggle-8bit');
        const ditherContainer = document.getElementById('color-dither-container');
        const wheelContainer = document.getElementById('color-wheel-container');
        const bitContainer = document.getElementById('color-8bit-container');
        const sliderPanel = document.getElementById('color-sliders-panel');
        const palGrid = document.getElementById('palette-grid');
        const wheelIco = bitBtn ? bitBtn.parentElement : null; // color-top-row
        const swatchBox = document.querySelector('.color-swatch-box');

        if (isDither) {
            if (bitBtn) bitBtn.style.display = 'none';
            if (ditherContainer) ditherContainer.style.display = 'block';
            if (wheelContainer) wheelContainer.style.display = 'none';
            if (bitContainer) bitContainer.style.display = 'none';
            
            this.setupDitherPalette();
            // Sync current dither size slider
            const slider = document.getElementById('dither-size-slider');
            if (slider) {
                slider.value = this.ditherEffectSize;
            }
        } else {
            if (bitBtn) bitBtn.style.display = 'block';
            if (ditherContainer) ditherContainer.style.display = 'none';
            // Show wheel container if not in 8bit mode (handled elsewhere, but wheel default is block)
            if (wheelContainer && bitContainer && bitContainer.style.display !== 'block') {
                wheelContainer.style.display = 'block';
            }
        }

        // Update wheel visually for RAL/CMJN
        this.updateColorWheelForMode();
        
        // Also snap current primary/secondary colors
        if (isRalOrCmjn) {
            this.snapColorToPalette(this.primaryColor, p.mode);
            this.snapColorToPalette(this.secondaryColor, p.mode);
            this.syncUItoState();
        }`;
code = code.replace(uiBlockOld, uiBlockNew);

// 4. Also replace the old disabled array logic
code = code.replace(/\[palGrid, sliderPanel, wheelContainer, wheelIco\]\.forEach\(el => \{\n            if \(el\) \{\n                if \(isDither \|\| isRal \|\| isCmjn\) \{/g,
    "[palGrid, sliderPanel, wheelContainer, wheelIco].forEach(el => {\n            if (el) {\n                if (isDither) {");

// 5. In setupColorWheel, store the image data
code = code.replace(/ctx\.fill\(\);\n\n        if \(canvas\)/, `ctx.fill();\n\n        this._originalColorWheelImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);\n\n        if (canvas)`);

// 6. Hook into setColorFromRGB
code = code.replace(/setColorFromRGB\(r, g, b, a = null\) \{[\s\S]*?this\.syncUItoState\(\);/m, 
`setColorFromRGB(r, g, b, a = null) {
        const col = this.activeColorTarget === 'primary' ? this.primaryColor : this.secondaryColor;
        col.r = r; col.g = g; col.b = b;
        if (a !== null) col.a = a;
        if (this.activeProject) this.snapColorToPalette(col, this.activeProject.mode);
        this.syncUItoState();`);

// 7. Hook into updateFromSlider
code = code.replace(/col\.a = Math\.max\(0, Math\.min\(255, value\)\);\n        \}\n        this\.syncUItoState\(\);/m,
`col.a = Math.max(0, Math.min(255, value));
        }
        if (this.activeProject) this.snapColorToPalette(col, this.activeProject.mode);
        this.syncUItoState();`);

fs.writeFileSync('EditorManager.js', code);
