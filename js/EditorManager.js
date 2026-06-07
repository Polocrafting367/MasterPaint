/**
 * EditorManager.js
 * Core engine for Dual-Mode (Vector/Pixel) editing.
 */

const EditorManager = {
    projects: [],
    activeProjectIndex: -1,
    activeColor: '#000000',
    snapToEdges: false,
    /** @type {SVGElement[]} */
    activeVectorSelection: [],
    primaryDitherPatternId: 'black',
    secondaryDitherPatternId: 'white',
    activeDitherPatternId: 'black',
    _ditherPatternCanvases: {},
    /** Modes de fusion Canvas autorisés (globalCompositeOperation). */
    _validBlendModes: new Set([
        'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
        'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
        'hue', 'saturation', 'color', 'luminosity',
        'lighter', 'xor'
    ]),
    /** Types de filtre dynamique calque (ƒ) — alignés sur `CanvasRenderingContext2D.filter` / CSS quand possible. */
    _validDynamicFilterTypes: new Set([
        'blur',
        'gaussian',
        'sharpen',
        'pixelate',
        'grayscale',
        'sepia',
        'invert',
        'saturate',
        'brightness',
        'contrast',
        'hue',
        'halftone',
        'shadow'
    ]),
    _dynamicRenderWorker: null,
    _dynamicRenderWorkerBroken: false,
    _dynamicRenderWorkerJobSeq: 0,
    _dynamicRenderWorkerPending: new Map(),
    _cachedPointerRect: null,
    _cachedPointerRectAtMs: 0,
    _lastDrawUiSignature: null,
    _lastLayerUiSignature: null,
    _lastTabUiSignature: null,
    toolProps: {
        size: 2,
        antialias: true,
        lineMode: 'straight',
        fillType: 'solid',
        wandTolerance: 32,
        /** Baguette : `contiguous` = zone connexe (cadre) ; `similar` = couleur + tolérance (masque / contour). */
        wandMode: 'contiguous',
        /**
         * Mode « couleur » uniquement : si true, clic = tous les pixels proches sur le calque ;
         * si false (défaut), zone connexe autour du clic (même tolérance), avec contour réel.
         */
        wandColorFullLayer: false,
        /** Pot de peinture : tolérance sur la couleur de départ (0 = couleur exacte). */
        fillTolerance: 0,
        /** Pot de peinture : `contiguous` = zone connexe ; `layer` = toute la couleur sur le calque. */
        fillMode: 'contiguous',
        brushPattern: 'round',
        /** 0 = bords très doux, 100 = dur (pinceau / gomme pixel, sauf motif « doux » et spray). */
        brushHardness: 100,
        shapeStrokeMode: 'both',
        shapeGradAngle: 0,
        shapeCornerRadius: 12,
        /** Triangle : 3 = triangle ; 4+ = étoile à n branches. */
        triangleBranches: 5,
        /** Polygone régulier (outil reg-poly) : nombre de faces. */
        polygonSides: 6,
        /** Légende / bulle : rect | round | oval | cloud */
        calloutStyle: 'rect',
        /** Position horizontale de la tige (0–1, centre = 0.5). */
        calloutTailX: 0.5,
        calloutTailT: null,
        textSize: 18,
        textFont: 'Arial, sans-serif',
        textBold: false,
        textItalic: false,
        textStroke: false,
        textStrokeWidth: 2,
        textFillType: 'solid',
        textGradType: 'linear',
        textGradAngle: 0,
        /** Prochaine sélection rect. → quadrilatère 4 coins (usage unique ; bouton « 4 coins »). */
        selectionRectFreeCornersArm: false,
        /** Prochain rectangle / rect. arrondi → quadrilatère 4 coins ajustables après le tracé. */
        shapeRectFreeCornersArm: false,
        /** Poignées 4 coins : déplacement en rectangle axis-aligné (pas quad libre). */
        warpQuadRectLock: false,
        pencilAutoClose: false,
        lineCapStart: 'none',
        lineCapEnd: 'none',
        /** Ligne / courbe 3 pts : épaisseur du contour (couleur secondaire), en plus de `size` (trace). */
        lineContourWidth: 0,
        /** Courbe 3 pts : 0 = quasi droite, 100 = selon les clics, 200 = courbure renforcée. */
        quadCurveBulge: 100,
        gradientType: 'linear',
        gradientMethod: 'simple',
        /** Déformation / déplacement / sélection : autoriser contenu hors toile (agrandit le calque). Défaut : false = rogné à la toile. */
        allowOutsideCanvas: false,
        warpResampling: 'smooth'
    },
    _bayer8x8: [
        [ 0, 32,  8, 40,  2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44,  4, 36, 14, 46,  6, 38],
        [60, 28, 68, 20, 62, 30, 70, 22],
        [ 3, 35, 11, 43,  1, 33,  9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47,  7, 39, 13, 45,  5, 37],
        [63, 31, 71, 23, 61, 29, 69, 21]
    ],
    pendingCloseIndex: -1,
    /** Survol d’une ligne dans la liste des calques : index du calque (aperçu du contour sur la toile). */
    _layerListHoverIndex: null,

    /** Miniatures UI (onglets / calques) : désactivables via Paramètres. */
    _uiThumbsVisible() {
        return typeof window.illuUiThumbsEnabled !== 'function' || window.illuUiThumbsEnabled();
    },

    setStrokeLightPixelRender(on) {
        this._strokeLightPixelRender = !!on;
    },

    /** Aperçu léger pendant tracé pinceau/crayon (filtre dynamique + masques α simplifiés). */
    strokeLightPixelRenderWanted() {
        if (!this._strokeLightPixelRender) return false;
        try {
            return localStorage.getItem('illu_stroke_light_render') !== '0';
        } catch (e) {
            return true;
        }
    },


    isColorPickerGridMode() {
        try {
            return localStorage.getItem('illu_color_picker_grid') === '1'
                || localStorage.getItem('illu_color_wheel_black_rim') === '1';
        } catch (e) {
            return false;
        }
    },

    setColorPickerGridMode(on) {
        try {
            localStorage.setItem('illu_color_picker_grid', on ? '1' : '0');
            localStorage.removeItem('illu_color_wheel_black_rim');
        } catch (e) {
            /* ignore */
        }
        this.rebuildColorPickerBase();
        this.syncColorPickerLayoutButton();
    },

    buildColorWheelDiscImageData(width, height) {
        const cx = width / 2;
        const cy = height / 2;
        const r = width / 2;
        const img = new ImageData(width, height);
        const d = img.data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const dx = x + 0.5 - cx;
                const dy = y + 0.5 - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) / r;
                if (dist > 1) {
                    d[i + 3] = 0;
                    continue;
                }
                const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                const sat = Math.min(100, dist * 100);
                const rgb = this.hsvToRgb(hue, sat, 100);
                d[i] = rgb.r;
                d[i + 1] = rgb.g;
                d[i + 2] = rgb.b;
                d[i + 3] = 255;
            }
        }
        return img;
    },

    buildColorGridImageData(width, height) {
        const img = new ImageData(width, height);
        const d = img.data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const hue = ((x + 0.5) / width) * 360;
                const lightness = ((y + 0.5) / height) * 100;
                const rgb = this.hslToRgb(hue, 100, lightness);
                d[i] = rgb.r;
                d[i + 1] = rgb.g;
                d[i + 2] = rgb.b;
                d[i + 3] = 255;
            }
        }
        return img;
    },

    rebuildColorPickerBase() {
        const canvas = document.getElementById('color-wheel');
        if (!canvas) return;
        const grid = this.isColorPickerGridMode();
        this._originalColorWheelImageData = grid
            ? this.buildColorGridImageData(canvas.width, canvas.height)
            : this.buildColorWheelDiscImageData(canvas.width, canvas.height);
        if (this.updateColorWheelForMode) this.updateColorWheelForMode();
    },

    syncColorPickerLayoutButton() {
        const btn = document.getElementById('btn-toggle-color-grid');
        const canvas = document.getElementById('color-wheel');
        const grid = this.isColorPickerGridMode();
        if (btn) {
            btn.setAttribute('aria-pressed', grid ? 'true' : 'false');
            btn.style.backgroundColor = grid ? '#333' : '';
            btn.style.color = grid ? '#fff' : '';
        }
        if (canvas) {
            canvas.style.borderRadius = grid ? '0' : '50%';
        }
    },

    setupColorPickerLayoutToggle() {
        const btn = document.getElementById('btn-toggle-color-grid');
        if (!btn || btn.dataset.illuPickerLayoutWired) return;
        btn.dataset.illuPickerLayoutWired = '1';
        btn.addEventListener('click', () => {
            this.setColorPickerGridMode(!this.isColorPickerGridMode());
        });
        this.syncColorPickerLayoutButton();
    },

    setupDitherPalette() {
        const container = document.getElementById('palette-dither');

        if (!container) return;
        container.innerHTML = '';
        
        // Patterns defined as 8x8 bitmasks
        const patterns = [
            { id: 'black',  data: [1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1] },
            { id: 'd87',    data: [1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,0,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,0, 1,1,1,1,1,1,1,1] },
            { id: 'd75',    data: [1,1,1,0,1,1,1,0, 1,1,1,1,1,1,1,1, 1,0,1,1,1,0,1,1, 1,1,1,1,1,1,1,1, 1,1,1,0,1,1,1,0, 1,1,1,1,1,1,1,1, 1,0,1,1,1,0,1,1, 1,1,1,1,1,1,1,1] },
            { id: 'd50',    data: [1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1] },
            { id: 'd33',    data: [1,0,0,1,0,0,1,0, 0,1,0,0,1,0,0,1, 0,0,1,0,0,1,0,0, 1,0,0,1,0,0,1,0, 0,1,0,0,1,0,0,1, 0,0,1,0,0,1,0,0, 1,0,0,1,0,0,1,0, 0,1,0,0,1,0,0,1] },
            { id: 'd25',    data: [1,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,1,0,0,0,1,0, 0,0,0,0,0,0,0,0, 1,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,1,0,0,0,1,0, 0,0,0,0,0,0,0,0] },
            { id: 'd12',    data: [1,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0] },
            { id: 'white',  data: [0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0] },
            { id: 'vstrip', data: [1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0, 1,0,1,0,1,0,1,0] },
            { id: 'hstrip', data: [1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0, 1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0, 1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0, 1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0] },
            { id: 'diag1',  data: [1,0,0,0,1,0,0,0, 0,1,0,0,0,1,0,0, 0,0,1,0,0,0,1,0, 0,0,0,1,0,0,0,1, 1,0,0,0,1,0,0,0, 0,1,0,0,0,1,0,0, 0,0,1,0,0,0,1,0, 0,0,0,1,0,0,0,1] },
            { id: 'diag2',  data: [0,0,0,1,0,0,0,1, 0,0,1,0,0,1,0,0, 0,1,0,0,0,1,0,0, 1,0,0,0,1,0,0,0, 0,0,0,1,0,0,0,1, 0,0,1,0,0,1,0,0, 0,1,0,0,0,1,0,0, 1,0,0,0,1,0,0,0] },
            { id: 'cross',  data: [1,1,1,1,1,1,1,1, 1,0,0,0,1,0,0,0, 1,0,0,0,1,0,0,0, 1,0,0,0,1,0,0,0, 1,1,1,1,1,1,1,1, 1,0,0,0,1,0,0,0, 1,0,0,0,1,0,0,0, 1,0,0,0,1,0,0,0] },
            { id: 'bricks', data: [1,1,1,1,1,1,1,1, 0,0,0,1,0,0,0,0, 0,0,0,1,0,0,0,0, 0,0,0,1,0,0,0,0, 1,1,1,1,1,1,1,1, 1,0,0,0,0,0,0,0, 1,0,0,0,0,0,0,0, 1,0,0,0,0,0,0,0] },
            { id: 'waves',  data: [0,1,1,0,0,1,1,0, 1,0,0,1,1,0,0,1, 0,1,1,0,0,1,1,0, 1,0,0,1,1,0,0,1, 0,1,1,0,0,1,1,0, 1,0,0,1,1,0,0,1, 0,1,1,0,0,1,1,0, 1,0,0,1,1,0,0,1] },
            { id: 'dots',   data: [1,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 1,0,0,0,1,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0] }
        ];

        this._ditherPatternBitmasks = {};
        patterns.forEach(p => {
            this._ditherPatternBitmasks[p.id] = p.data;
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 8;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0,0,8,8);
            ctx.fillStyle = '#000';
            for (let i=0; i<64; i++) {
                if (p.data[i]) {
                    ctx.fillRect(i % 8, Math.floor(i / 8), 1, 1);
                }
            }
            this._ditherPatternCanvases[p.id] = canvas;
            
            const swatch = document.createElement('div');
            swatch.className = 'dither-pattern-swatch';
            swatch.style.width = '26px';
            swatch.style.height = '26px';
            swatch.style.border = '1px solid #777';
            swatch.style.background = `url(${canvas.toDataURL()})`;
            swatch.style.cursor = 'pointer';
            swatch.title = p.id;

            swatch.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.setDitherPattern(p.id);
            });
            
            container.appendChild(swatch);
        });
        
        this.setDitherPattern('black');
    },

    setupRalPalette() {
        const container = document.getElementById('palette-ral-grid');
        if (!container || container.children.length > 0) return;
        
        if (typeof RAL_COLORS !== 'undefined') {
            RAL_COLORS.forEach(c => {
                const swatch = document.createElement('div');
                swatch.className = 'dither-pattern-swatch';
                swatch.style.width = '20px';
                swatch.style.height = '20px';
                swatch.style.backgroundColor = c.hex;
                swatch.style.border = '1px solid #777';
                swatch.style.cursor = 'pointer';
                swatch.title = `${c.code} - ${c.fr}`;
                
                swatch.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    if (e.button === 2) {
                        window.illuSetSecondaryColor(c.hex);
                    } else {
                        window.illuSetPrimaryColor(c.hex);
                    }
                });
                swatch.addEventListener('contextmenu', e => e.preventDefault());
                
                container.appendChild(swatch);
            });
        }
    },

    setupCmjnPalette() {
        const container = document.getElementById('palette-cmjn-grid');
        if (!container || container.children.length > 0) return;
        
        const colors = [
            { hex: '#ffff00', name: 'Yellow (Jaune)' },
            { hex: '#ff00ff', name: 'Magenta' },
            { hex: '#000080', name: 'Navy (Bleu marine)' },
            { hex: '#000000', name: 'Black (Noir)' },
            { hex: '#ffffff', name: 'White (Blanc)' }
        ];
        
        colors.forEach(c => {
            const swatch = document.createElement('div');
            swatch.className = 'dither-pattern-swatch';
            swatch.style.width = '30px';
            swatch.style.height = '30px';
            swatch.style.backgroundColor = c.hex;
            swatch.style.border = '1px solid #777';
            swatch.style.cursor = 'pointer';
            swatch.title = c.name;
            
            swatch.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (e.button === 2) {
                    window.illuSetSecondaryColor(c.hex);
                } else {
                    window.illuSetPrimaryColor(c.hex);
                }
            });
            swatch.addEventListener('contextmenu', e => e.preventDefault());
            
            container.appendChild(swatch);
        });
    },

    
    
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

    snapColorToPalette(col, mode) {
        if (mode === 'pixel-cmjn') {
            const out = this.applyCmjnFilter(col.r, col.g, col.b);
            col.r = out.r;
            col.g = out.g;
            col.b = out.b;
            return;
        }
        if (!mode || !this.isPaletteRestrictedMode(mode)) return;

        if (mode === 'pixel-dither') {
            const out = this._quantizeOpaquePixelRgb(col.r, col.g, col.b, mode);
            col.r = out.r;
            col.g = out.g;
            col.b = out.b;
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
            const dist = dr * dr + dg * dg + db * db;
            if (dist < bestDist) {
                bestDist = dist;
                best = c;
            }
        }
        col.r = best.r;
        col.g = best.g;
        col.b = best.b;
    },

    /** Encres de référence (UI) — pas une limite du nombre de couleurs en mode CMJN. */
    getCmjnPaletteColors() {
        return [
            { r: 255, g: 255, b: 0 },
            { r: 255, g: 0, b: 255 },
            { r: 0, g: 0, b: 128 },
            { r: 0, g: 0, b: 0 },
            { r: 255, g: 255, b: 255 }
        ];
    },

    /** Modes à nuancier discret (pas le CMJN : simulation continue). */
    isPaletteRestrictedMode(mode) {
        const m = mode || (this.activeProject && this.activeProject.mode);
        return m === 'pixel-dither' || m === 'pixel-ral';
    },

    isCmjnSimulationMode(mode) {
        const m = mode || (this.activeProject && this.activeProject.mode);
        return m === 'pixel-cmjn';
    },

    /** Nuancier discret pour palette-grid (tramé / RAL uniquement). */
    buildModePaletteGridSwatches(mode) {
        mode = mode || (this.activeProject && this.activeProject.mode);
        if (mode === 'pixel-dither') {
            return [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }];
        }
        if (mode === 'pixel-ral' && typeof RAL_COLORS !== 'undefined') {
            const seen = new Set();
            const out = [];
            RAL_COLORS.forEach((c) => {
                const key = `${c.r},${c.g},${c.b}`;
                if (seen.has(key)) return;
                seen.add(key);
                out.push({ r: c.r, g: c.g, b: c.b });
            });
            return out;
        }
        return null;
    },

    _simulateCmjnImageData(imageData) {
        if (!imageData || !imageData.data) return imageData;
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 128) continue;
            const out = this.applyCmjnFilter(d[i], d[i + 1], d[i + 2]);
            d[i] = out.r;
            d[i + 1] = out.g;
            d[i + 2] = out.b;
        }
        return imageData;
    },

    _quantizeOpaquePixelRgb(r, g, b, mode, opts) {
        opts = opts || {};
        if (mode === 'pixel-dither') {
            const inv = opts.invert != null ? opts.invert : !!(this.activeProject && this.activeProject.ditherInvert);
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            let v = luma >= 128 ? 255 : 0;
            if (inv) v = 255 - v;
            return { r: v, g: v, b: v };
        }
        if (mode === 'pixel-ral' && typeof RAL_COLORS !== 'undefined' && RAL_COLORS.length) {
            let bestDist = Infinity;
            let best = RAL_COLORS[0];
            for (let i = 0; i < RAL_COLORS.length; i++) {
                const c = RAL_COLORS[i];
                const dr = r - c.r;
                const dg = g - c.g;
                const db = b - c.b;
                const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = c;
                }
            }
            return { r: best.r, g: best.g, b: best.b };
        }
        return { r, g, b };
    },

    _quantizeImageDataToPalette(imageData, mode, opts) {
        if (!imageData || !imageData.data) return imageData;
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 128) {
                d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
                continue;
            }
            const q = this._quantizeOpaquePixelRgb(d[i], d[i + 1], d[i + 2], mode, opts);
            d[i] = q.r;
            d[i + 1] = q.g;
            d[i + 2] = q.b;
            d[i + 3] = 255;
        }
        return imageData;
    },

    /** Simulation CMJN ou nuancier discret selon le mode (effets, import, post-traitement). */
    constrainImageDataToProjectMode(imageData, mode, opts) {
        mode = mode || (this.activeProject && this.activeProject.mode);
        if (!imageData) return imageData;
        if (mode === 'pixel-cmjn') {
            return this._simulateCmjnImageData(imageData);
        }
        if (!this.isPaletteRestrictedMode(mode)) return imageData;
        opts = opts || {};
        if (mode === 'pixel-dither') {
            const inv = opts.invert != null ? opts.invert : !!(this.activeProject && this.activeProject.ditherInvert);
            const size = opts.size != null ? opts.size : this.ditherEffectSize;
            return this._ditherImageData(imageData, size, { invert: inv });
        }
        return this._quantizeImageDataToPalette(imageData, mode, opts);
    },

    applyProjectColorModeToLayer(layer, mode) {
        if (!layer || !layer.buffer) return;
        mode = mode || (this.activeProject && this.activeProject.mode);
        if (!mode || mode === 'pixel') return;
        const ctx = layer.buffer.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        const idata = ctx.getImageData(0, 0, layer.buffer.width, layer.buffer.height);
        this.constrainImageDataToProjectMode(idata, mode);
        ctx.putImageData(idata, 0, 0);
        layer._thumbDirty = true;
    },

    quantizeLayerBuffer(layer, mode) {
        this.applyProjectColorModeToLayer(layer, mode);
    },

    quantizeActiveLayerBuffer() {
        const l = this.activeLayer;
        if (!l) return;
        this.applyProjectColorModeToLayer(l);
    },

    updateColorWheelForMode() {
        const canvas = document.getElementById('color-wheel');
        if (!canvas || !this._originalColorWheelImageData) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        const p = this.activeProject;
        if (!p) return;
        const img = new ImageData(new Uint8ClampedArray(this._originalColorWheelImageData.data), canvas.width, canvas.height);
        const d_ = img.data;

        if (p.mode === 'pixel-cmjn') {
            for (let i = 0; i < d_.length; i += 4) {
                if (d_[i + 3] > 0) {
                    const out = this.applyCmjnFilter(d_[i], d_[i + 1], d_[i + 2]);
                    d_[i] = out.r;
                    d_[i + 1] = out.g;
                    d_[i + 2] = out.b;
                }
            }
        } else if (p.mode === 'pixel-dither') {
            for (let i = 0; i < d_.length; i += 4) {
                if (d_[i + 3] > 0) {
                    const q = this._quantizeOpaquePixelRgb(d_[i], d_[i + 1], d_[i + 2], 'pixel-dither');
                    d_[i] = q.r;
                    d_[i + 1] = q.g;
                    d_[i + 2] = q.b;
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
        }
        ctx.putImageData(img, 0, 0);

        // Draw selected color marker/indicator
        const activeCol = this.activeColorTarget === 'secondary' ? this.secondaryColor : this.primaryColor;
        const grid = this.isColorPickerGridMode();
        let mx = canvas.width / 2;
        let my = canvas.height / 2;
        if (grid) {
            const hsl = this.rgbToHsl(activeCol.r, activeCol.g, activeCol.b);
            mx = (hsl.h / 360) * canvas.width;
            my = (hsl.l / 100) * canvas.height;
        } else {
            const hsv = this.rgbToHsv(activeCol.r, activeCol.g, activeCol.b);
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const r = canvas.width / 2;
            const theta = ((hsv.h - 180) * Math.PI) / 180; // Wait, let's look at buildColorWheelDiscImageData: const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360; -> so dy, dx has angle theta. Let's make sure it matches atan2 logic: angle in radians is hsv.h * Math.PI / 180
            const thetaRad = (hsv.h * Math.PI) / 180;
            const dist = (hsv.s / 100) * r;
            mx = cx + dist * Math.cos(thetaRad);
            my = cy + dist * Math.sin(thetaRad);
        }

        // Outer black shadow ring
        ctx.beginPath();
        ctx.arc(mx, my, 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Inner white ring
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    },

    setDitherPattern(id) {
        this.activeDitherPatternId = id;
        const canvases = this._ditherPatternCanvases;
        if (!canvases[id]) return;
        
        // Update UI preview
        const primaryUI = document.getElementById('ui-col-primary');
        if (primaryUI) {
            // In dither mode we preview the pattern using an image layer.
            // Keep backgroundColor intact so we can restore it cleanly when leaving dither mode.
            primaryUI.style.backgroundImage = `url(${canvases[id].toDataURL()})`;
            primaryUI.style.backgroundRepeat = 'repeat';
            primaryUI.style.backgroundSize = 'auto';
        }
        
        // Update selection highlights in the palette
        document.querySelectorAll('.dither-pattern-swatch').forEach(s => {
            s.style.outline = s.title === id ? '2px solid #00f' : '';
        });
    },

    /**
     * Définit fillStyle et strokeStyle sur le contexte Canvas donné
     * en tenant compte du mode (couleur standard ou motif de tramage).
     */
    applyActiveStyle(ctx) {
        if (this.activeProject && this.activeProject.mode === 'pixel-dither') {
            const canv = this._ditherPatternCanvases[this.primaryDitherPatternId || 'black'];
            if (canv) {
                const pat = ctx.createPattern(canv, 'repeat');
                ctx.fillStyle = pat;
                ctx.strokeStyle = pat;
                return;
            }
        }
        ctx.fillStyle = this.activeColor;
        ctx.strokeStyle = this.activeColor;
    },
    /** Au moins un calque visible utilise le filtre dynamique sur la pile. */
    projectHasLiveDynamicFilterLayer() {
        if (!Array.isArray(this.layers)) return false;
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (!layer || !layer.visible) continue;
            this._normalizeDynamicFilterProps(layer);
            if (this._isLiveDynamicFilterLayer(layer)) return true;
        }
        return false;
    },

    /** Canvas DOM par calque (#pixel-layer-stack) quand le mode « pile » est actif. */
    _pixelLayerViewEls: null,
    _domPixelStackActive: false,
    /** Ouverture .illu : pas de filtres dynamiques ni worker tant que le chargement n’est pas terminé. */
    _workspaceLoading: false,
    _deferDynamicFilterRender: false,
    /** Phase finale chargement .illu : calcul des filtres dynamiques (worker autorisé). */
    _dynamicFilterWarmupActive: false,
    /** Pinceau / crayon : tracé en cours → rendu pixel allégé si option activée. */
    _strokeLightPixelRender: false,
    /**
     * Tampon tampon (même taille que le calque actif) : tracé pinceau/crayon/gomme avant commit sur le tampon calque.
     * Évite d’écrire le calque à chaque mouvement (sauf masque α / filtre dynamique → repli sur le calque).
     */
    _strokeIntermediateCanvas: null,
    _strokeIntermediateLayerId: null,
    /** @type {'brush'|'pencil'|'eraser'|null} */
    _strokeIntermediateTool: null,
    /** Prévisualisation formes (rect/cercle/ligne/arrondi) sans réécrire le tampon à chaque frame. */
    _shapePreviewCanvas: null,
    _shapePreviewActiveLayerId: null,
    _shapePreviewActive: false,
    _renderEpoch: 0,
    _sampleFlatCanvas: null,
    _sampleFlatEpoch: -1,
    /** Après le dernier `render` : délai avant de lancer une passe miniatures (inactivité). */
    _thumbIdleTimer: null,
    /** Chaînage setTimeout entre chaque miniature (liste puis onglet). */
    _thumbSeqTimer: null,
    /** Incrémenté pour invalider une passe en cours (interaction utilisateur / nouvelle passe). */
    _thumbPassGeneration: 0,
    /** Si non null pendant _runThumbSeqStep (stage layers), ne mettre à jour qu’une ligne de liste. */
    _thumbPassSingleLayerIndex: null,
    /** Miniatures : attente d’inactivité après rendu (aucun tracé / interaction toile). */
    THUMB_IDLE_MS: 520,
    /** Après fin d’action explicite (relâchement souris, etc.) : délai un peu plus court. */
    THUMB_IDLE_AFTER_FLUSH_MS: 280,
    /** Délai entre deux miniatures calque (ms) pour ne pas saturer le thread. */
    THUMB_SEQ_GAP_MS: 20,
    /** Côté max (px) pour miniatures calque (génération + affichage CSS). */
    THUMB_LAYER_MAX_DIM: 40,
    /** Taille de génération interne (plus petit = plus rapide). */
    THUMB_LAYER_INTERNAL_SIZE: 40,
    /** Aplat document pour onglet : côté max réduit. */
    THUMB_TAB_MAX_DIM: 40,

    /** Dimensions miniatures en conservant le ratio w/h (côté le plus long ≤ maxDim). */
    _thumbFitSize(cw, ch, maxDim) {
        const iw = Math.max(1, cw | 0);
        const ih = Math.max(1, ch | 0);
        const ratio = Math.min(maxDim / iw, maxDim / ih, 1);
        return {
            width: Math.max(1, Math.round(iw * ratio)),
            height: Math.max(1, Math.round(ih * ratio))
        };
    },

    getLayerThumbCssSize(layer) {
        if (!layer?.buffer) return { width: this.THUMB_LAYER_MAX_DIM, height: this.THUMB_LAYER_MAX_DIM };
        return this._thumbFitSize(layer.buffer.width, layer.buffer.height, this.THUMB_LAYER_MAX_DIM);
    },

    getProjectTabThumbCssSize(p) {
        if (!p?.width || !p?.height) return { width: 36, height: 28 };
        return this._thumbFitSize(p.width, p.height, this.THUMB_TAB_MAX_DIM);
    },

    /** Défaut si aucune préférence (localStorage `illu_history_max_entries`). */
    HISTORY_MAX_ENTRIES_DEFAULT: 15,
    /** @deprecated Utiliser getHistoryMaxEntries() */
    HISTORY_MAX_ENTRIES: 15,
    _thumbIdlePointerInstalled: false,

    _installThumbnailIdleGuards() {
        if (this._thumbIdlePointerInstalled) return;
        this._thumbIdlePointerInstalled = true;
        const self = this;
        const onCanvasInteract = () => self.cancelDeferredThumbnails();
        document.addEventListener(
            'pointerdown',
            (ev) => {
                const t = ev.target;
                if (t && typeof t.closest === 'function' && t.closest('#main-canvas-container')) {
                    onCanvasInteract();
                }
            },
            true
        );
        const host = document.getElementById('main-canvas-container');
        if (host) {
            host.addEventListener('wheel', onCanvasInteract, { passive: true });
        }
    },

    init() {

        if (typeof window.populateIlluTextFontSelect === 'function') window.populateIlluTextFontSelect();
        if (typeof window.syncIlluTextFontSelectFromToolProps === 'function') window.syncIlluTextFontSelectFromToolProps();
        this.setupColorWheel();
        this.setupPalette();
        this.setupColorPickerLayoutToggle();
        this.setupSliders();
        this.initHistory();
        this.setupShortcuts();
        this._installThumbnailIdleGuards();
        if (this._dynamicRenderWorkerAvailable()) {
            try {
                this._ensureDynamicRenderWorker();
            } catch (e) {
                /* ignore */
            }
        }

        window.illuApplyNewProjectDialogDimensions = function (w, h) {
            const iw = document.getElementById('p-width');
            const ih = document.getElementById('p-height');
            if (!iw || !ih) return false;
            const cw = Math.max(1, Math.min(16384, Math.round(Number(w) || 0)));
            const ch = Math.max(1, Math.min(16384, Math.round(Number(h) || 0)));
            if (cw < 1 || ch < 1) return false;
            iw.value = String(cw);
            ih.value = String(ch);
            return true;
        };

        /** Dimensions suggérées depuis le presse-papiers interne (Ctrl+C). */
        window.illuSuggestedNewProjectDimensionsFromClipboard = function () {
            const clamp = (n) => Math.max(1, Math.min(16384, Math.round(n)));
            if (window.ctxClipboard && window.ctxClipboard.width >= 1 && window.ctxClipboard.height >= 1) {
                if (
                    typeof window.illuImageDataHasVisiblePixels === 'function' &&
                    !window.illuImageDataHasVisiblePixels(window.ctxClipboard)
                ) {
                    /* presse-papiers pixel vide */
                } else {
                    const b = window.ctxClipboardDocBounds;
                    const w =
                        b && Number.isFinite(b.w) && b.w >= 1 ? b.w : window.ctxClipboard.width | 0;
                    const h =
                        b && Number.isFinite(b.h) && b.h >= 1 ? b.h : window.ctxClipboard.height | 0;
                    return { w: clamp(w), h: clamp(h) };
                }
            }
            const vc = window.ctxVectorClipboard;
            if (vc && vc.length) {
                const sb = window.selectionBounds;
                if (
                    sb &&
                    Number.isFinite(sb.w) &&
                    Number.isFinite(sb.h) &&
                    sb.w >= 1 &&
                    sb.h >= 1
                ) {
                    return { w: clamp(sb.w), h: clamp(sb.h) };
                }
                const NS = 'http://www.w3.org/2000/svg';
                const svg = document.createElementNS(NS, 'svg');
                svg.setAttribute('width', '1');
                svg.setAttribute('height', '1');
                svg.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
                const g = document.createElementNS(NS, 'g');
                vc.forEach((el) => {
                    try {
                        g.appendChild(el.cloneNode(true));
                    } catch (e) {
                        /* ignore */
                    }
                });
                svg.appendChild(g);
                document.body.appendChild(svg);
                let bb = null;
                try {
                    bb = g.getBBox();
                } catch (e) {
                    bb = null;
                }
                svg.remove();
                if (bb && bb.width >= 0.5 && bb.height >= 0.5) {
                    return { w: clamp(bb.width), h: clamp(bb.height) };
                }
            }
            return null;
        };

        window.illuFillNewProjectDialogDimensionsFromSelection = function () {
            const sb = window.selectionBounds;
            const iw = document.getElementById('p-width');
            const ih = document.getElementById('p-height');
            if (!iw || !ih) return false;
            const hasSel =
                typeof window.hasActivePixelSelection === 'function' && window.hasActivePixelSelection();
            if (
                sb &&
                hasSel &&
                !window.selectionInverted &&
                Number.isFinite(sb.w) &&
                Number.isFinite(sb.h) &&
                sb.w >= 1 &&
                sb.h >= 1
            ) {
                return window.illuApplyNewProjectDialogDimensions(sb.w, sb.h);
            }
            if (
                sb &&
                EditorManager.mode === 'vector' &&
                !window.selectionInverted &&
                Number.isFinite(sb.w) &&
                Number.isFinite(sb.h) &&
                sb.w >= 1 &&
                sb.h >= 1
            ) {
                return window.illuApplyNewProjectDialogDimensions(sb.w, sb.h);
            }
            return false;
        };
        window.illuPrepareNewProjectDialogInputs = function () {
            const clipDims =
                typeof window.illuSuggestedNewProjectDimensionsFromClipboard === 'function'
                    ? window.illuSuggestedNewProjectDimensionsFromClipboard()
                    : null;
            if (clipDims && window.illuApplyNewProjectDialogDimensions(clipDims.w, clipDims.h)) {
                return;
            }
            if (
                typeof window.illuFillNewProjectDialogDimensionsFromSelection === 'function' &&
                window.illuFillNewProjectDialogDimensionsFromSelection()
            ) {
                return;
            }
            if (typeof window.illuApplySuggestedNewProjectDimensions === 'function') {
                window.illuApplySuggestedNewProjectDimensions();
            }
        };
        window.showNewProjectDialog = () => {
            window.illuPrepareNewProjectDialogInputs();
            const dlg = document.getElementById('dialog-overlay');
            if (dlg) {
                dlg.style.display = 'flex';
                if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
                    window.IlluI18n.apply(dlg);
                }
                requestAnimationFrame(() => {
                    const w = document.getElementById('p-width');
                    if (w && typeof w.focus === 'function') w.focus();
                });
            }
        };
        window.createNewProject = () => this.handleNewProject();

        (function illuSetupNewProjectDialogChrome() {
            const ov = document.getElementById('dialog-overlay');
            if (!ov) return;
            ov.addEventListener(
                'keydown',
                (e) => {
                    if (e.key !== 'Enter') return;
                    const t = e.target;
                    if (t && t.closest && t.closest('textarea')) return;
                    if (t && t.classList && t.classList.contains('illu-new-project-preset-btn')) return;
                    if (t && t.id === 'btn-new-project-cancel') {
                        e.preventDefault();
                        ov.style.display = 'none';
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.createNewProject === 'function') window.createNewProject();
                },
                true
            );
            ov.querySelectorAll('.illu-new-project-preset-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const w = parseInt(btn.getAttribute('data-w'), 10);
                    const h = parseInt(btn.getAttribute('data-h'), 10);
                    const iw = document.getElementById('p-width');
                    const ih = document.getElementById('p-height');
                    if (iw && Number.isFinite(w)) iw.value = String(w);
                    if (ih && Number.isFinite(h)) ih.value = String(h);
                });
            });
        })();
        
        // Toolbar events (éléments optionnels selon l’outil)
        const bind = (id, fn, opts) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', fn);
            if (opts && opts.live) el.addEventListener('input', fn);
        };
        const syncLiveShapeEdit = () => {
            if (this.mode === 'vector') {
                if (this.activeVectorSelection && this.activeVectorSelection.length) {
                    if (typeof window.illuApplyVectorToolPropsToSelection === 'function') {
                        window.illuApplyVectorToolPropsToSelection({ livePreview: true });
                    }
                } else if (window.VectorEngine && typeof window.VectorEngine.applyStyleToSelection === 'function') {
                    window.VectorEngine.applyStyleToSelection();
                }
            }
            if (!window.pixelShapeEdit) {
                if (
                    typeof window.illuRepaintShapeLiveDrawPreview === 'function' &&
                    window.illuRepaintShapeLiveDrawPreview()
                ) {
                    return;
                }
                if (
                    window.activeTool === 'triangle' &&
                    typeof window.syncTriangleBranchesLivePreview === 'function'
                ) {
                    window.syncTriangleBranchesLivePreview();
                }
                return;
            }
            const ed = window.pixelShapeEdit;
            ed.opts = ed.opts || {};
            ed.opts.strokeWidth = this.toolProps.size || 2;
            ed.opts.lineContourWidth = this.toolProps.lineContourWidth ?? 0;
            ed.opts.strokeMode = this.toolProps.shapeStrokeMode;
            ed.opts.fillType = this.toolProps.fillType;
            ed.opts.gradAngle = this.toolProps.shapeGradAngle;
            ed.opts.gradType = document.getElementById('tool-shape-grad-type')?.value || 'linear';
            ed.opts.gradMethod =
                typeof window.illuGetGradientMethod === 'function' ? window.illuGetGradientMethod() : 'simple';
            if (ed.kind === 'roundrect' || (ed.kind === 'quad' && ed.quadBase === 'roundrect')) {
                const want = this.toolProps.shapeCornerRadius ?? 12;
                if (ed.kind === 'quad' && ed.pts && typeof window.illuClampQuadCornerRadius === 'function') {
                    ed.r = window.illuClampQuadCornerRadius(want, ed.pts);
                } else {
                    const cap = Math.min(ed.w / 2, ed.h / 2);
                    ed.r = Math.max(0, Math.min(want, cap));
                }
            }
            if (typeof window.redrawShapeFromEditLive === 'function') window.redrawShapeFromEditLive();
            else if (typeof window.redrawShapeFromEdit === 'function') window.redrawShapeFromEdit();
        };
        bind('tool-size', (e) => {
            this.toolProps.size = parseInt(e.target.value, 10);
            if (typeof window.syncIlluGaugeForRange === 'function') {
                window.syncIlluGaugeForRange(e.target);
            }
            syncLiveShapeEdit();
        }, { live: true });
        const lineContourSl = document.getElementById('tool-line-contour');
        const lineContourVal = document.getElementById('tool-line-contour-val');
        if (lineContourSl) {
            const syncLineContour = () => {
                let v = parseInt(lineContourSl.value, 10);
                if (!Number.isFinite(v)) v = 0;
                this.toolProps.lineContourWidth = Math.max(0, Math.min(128, v));
                if (lineContourVal) lineContourVal.textContent = String(this.toolProps.lineContourWidth);
                if (typeof window.syncIlluGaugeForRange === 'function') {
                    window.syncIlluGaugeForRange(lineContourSl);
                }
                syncLiveShapeEdit();
            };
            lineContourSl.addEventListener('input', syncLineContour);
            lineContourSl.addEventListener('change', syncLineContour);
            if (typeof window.syncIlluGaugeForRange === 'function') {
                window.syncIlluGaugeForRange(lineContourSl);
            }
        }
        bind('tool-fill-type', (e) => {
            let fv = e.target.value || 'solid';
            if (fv !== 'solid' && fv !== 'gradient') fv = 'solid';
            this.toolProps.fillType = fv;
            syncLiveShapeEdit();
            if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        });
        if (typeof window.illuWireSelectRectFreeCornersButtons === 'function') {
            window.illuWireSelectRectFreeCornersButtons();
        }
        if (typeof window.illuWireShapeRectFreeCornersButtons === 'function') {
            window.illuWireShapeRectFreeCornersButtons();
        }
        if (typeof window.syncSelectionRectFreeCornersArmUI === 'function') {
            window.syncSelectionRectFreeCornersArmUI();
        }
        bind('tool-brush-pattern', (e) => {
            this.toolProps.brushPattern = e.target.value;
            if (typeof window.syncIlluBrushPatternIconToggles === 'function') {
                window.syncIlluBrushPatternIconToggles();
            }
            if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        });
        const brushHardSl = document.getElementById('tool-brush-hardness');
        const brushHardV = document.getElementById('tool-brush-hardness-val');
        if (brushHardSl) {
            brushHardSl.addEventListener('input', (e) => {
                this.toolProps.brushHardness = parseInt(e.target.value, 10) || 0;
                if (brushHardV) brushHardV.textContent = String(this.toolProps.brushHardness);
                if (typeof window.syncIlluGaugeForRange === 'function') {
                    window.syncIlluGaugeForRange(brushHardSl);
                }
            });
            if (typeof window.syncIlluGaugeForRange === 'function') {
                window.syncIlluGaugeForRange(brushHardSl);
            }
        }
        const wandSl = document.getElementById('wand-tolerance');
        const wandVal = document.getElementById('wand-tolerance-val');
        if (wandSl) {
            wandSl.addEventListener('input', (e) => {
                this.toolProps.wandTolerance = parseInt(e.target.value, 10);
                if (wandVal) wandVal.textContent = String(this.toolProps.wandTolerance);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(wandSl);
            });
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(wandSl);
        }
        const wandModeEl = document.getElementById('wand-mode');
        if (wandModeEl) {
            wandModeEl.value = this.toolProps.wandMode === 'contiguous' ? 'contiguous' : 'similar';
            wandModeEl.addEventListener('change', (e) => {
                const v = e.target.value;
                this.toolProps.wandMode = v === 'contiguous' ? 'contiguous' : 'similar';
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            });
        }
        const wandFull = document.getElementById('wand-color-full-layer');
        if (wandFull) {
            wandFull.checked = !!this.toolProps.wandColorFullLayer;
            wandFull.addEventListener('change', (e) => {
                this.toolProps.wandColorFullLayer = !!e.target.checked;
            });
        }
        const pencilClose = document.getElementById('pencil-auto-close');
        if (pencilClose) {
            pencilClose.checked = !!this.toolProps.pencilAutoClose;
            pencilClose.addEventListener('change', (e) => {
                this.toolProps.pencilAutoClose = !!e.target.checked;
            });
        }
        const capStart = document.getElementById('tool-line-cap-start');
        const capEnd = document.getElementById('tool-line-cap-end');
        const refreshLineEndpointCaps = () => {
            const processed = new Set();
            const refreshEl = (el) => {
                if (!el || processed.has(el)) return;
                processed.add(el);
                if (typeof window.vectorApplyLineEndpointMarkers === 'function') {
                    const isLine =
                        typeof window.illuVectorPathHasLineEndpoints === 'function' &&
                        window.illuVectorPathHasLineEndpoints(el);
                    if (isLine) {
                        window.vectorApplyLineEndpointMarkers(el);
                    }
                }
            };

            if (EditorManager.activeVectorSelection && EditorManager.activeVectorSelection.length) {
                EditorManager.activeVectorSelection.forEach(refreshEl);
            }
            if (window._activeVectorShapeEl) {
                refreshEl(window._activeVectorShapeEl);
            }
            if (typeof activeVectorShape !== 'undefined' && activeVectorShape) {
                refreshEl(activeVectorShape);
            }

            if (
                window.pixelShapeEdit &&
                (window.pixelShapeEdit.kind === 'line' || window.pixelShapeEdit.kind === 'quadcurve') &&
                typeof window.redrawShapeFromEditLive === 'function'
            ) {
                window.redrawShapeFromEditLive();
            } else if (typeof window.redrawShapeFromEdit === 'function') {
                window.redrawShapeFromEdit();
            } else if (typeof EditorManager !== 'undefined' && EditorManager.render) {
                EditorManager.render();
            }
        };
        window.illuRefreshActiveLineEndpointCaps = refreshLineEndpointCaps;
        if (capStart) {
            capStart.value = this.toolProps.lineCapStart || 'none';
            capStart.addEventListener('change', (e) => {
                this.toolProps.lineCapStart = e.target.value || 'none';
                refreshLineEndpointCaps();
            });
        }
        if (capEnd) {
            capEnd.value = this.toolProps.lineCapEnd || 'none';
            capEnd.addEventListener('change', (e) => {
                this.toolProps.lineCapEnd = e.target.value || 'none';
                refreshLineEndpointCaps();
            });
        }
        const fillTolSl = document.getElementById('fill-tolerance');
        const fillTolVal = document.getElementById('fill-tolerance-val');
        if (fillTolSl) {
            const fv = this.toolProps.fillTolerance ?? 0;
            fillTolSl.value = String(fv);
            if (fillTolVal) fillTolVal.textContent = String(fv);
            fillTolSl.addEventListener('input', (e) => {
                this.toolProps.fillTolerance = parseInt(e.target.value, 10);
                if (fillTolVal) fillTolVal.textContent = String(this.toolProps.fillTolerance);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(fillTolSl);
            });
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(fillTolSl);
        }
        const fillModeEl = document.getElementById('fill-mode');
        if (fillModeEl) {
            fillModeEl.value = this.toolProps.fillMode === 'layer' ? 'layer' : 'contiguous';
            fillModeEl.addEventListener('change', (e) => {
                this.toolProps.fillMode = e.target.value === 'layer' ? 'layer' : 'contiguous';
            });
        }
        const shapeMode = document.getElementById('tool-shape-mode');
        if (shapeMode) {
            shapeMode.addEventListener('change', (e) => {
                this.toolProps.shapeStrokeMode = e.target.value;
                syncLiveShapeEdit();
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            });
        }
        const triBr = document.getElementById('tool-triangle-branches');
        const triBrV = document.getElementById('tool-triangle-branches-val');
        if (triBr) {
            const syncTriBranches = () => {
                let v = parseInt(triBr.value, 10);
                if (!Number.isFinite(v)) v = 5;
                this.toolProps.triangleBranches =
                    typeof window.illuClampTriangleBranches === 'function'
                        ? window.illuClampTriangleBranches(Math.max(4, v))
                        : Math.max(4, Math.min(24, v));
                if (triBrV) triBrV.textContent = String(this.toolProps.triangleBranches);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(triBr);
                if (typeof window.syncTriangleBranchesLivePreview === 'function') {
                    window.syncTriangleBranchesLivePreview();
                }
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            };
            triBr.addEventListener('input', syncTriBranches);
            triBr.addEventListener('change', syncTriBranches);
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(triBr);
        }
        const polySides = document.getElementById('tool-polygon-sides');
        const polySidesV = document.getElementById('tool-polygon-sides-val');
        if (polySides) {
            const syncPolySides = () => {
                let v = parseInt(polySides.value, 10);
                if (!Number.isFinite(v)) v = 6;
                this.toolProps.polygonSides =
                    typeof window.illuClampPolygonSides === 'function'
                        ? window.illuClampPolygonSides(v)
                        : Math.max(3, Math.min(24, v));
                if (polySidesV) polySidesV.textContent = String(this.toolProps.polygonSides);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(polySides);
                if (typeof window.syncPolygonSidesLivePreview === 'function') {
                    window.syncPolygonSidesLivePreview();
                }
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            };
            polySides.addEventListener('input', syncPolySides);
            polySides.addEventListener('change', syncPolySides);
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(polySides);
        }
        document.querySelectorAll('[data-illu-callout-style]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const style = btn.getAttribute('data-illu-callout-style') || 'rect';
                this.toolProps.calloutStyle = style;
                document.querySelectorAll('[data-illu-callout-style]').forEach((b) => {
                    const on = b === btn;
                    b.classList.toggle('active', on);
                    b.setAttribute('aria-pressed', on ? 'true' : 'false');
                });
                const hid = document.getElementById('tool-callout-style');
                if (hid) hid.value = style;
                if (typeof window.syncCalloutStyleLivePreview === 'function') {
                    window.syncCalloutStyleLivePreview();
                }
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            });
        });
        const scr = document.getElementById('tool-shape-corner-radius');
        const scrv = document.getElementById('tool-shape-corner-radius-val');
        if (scr) {
            const syncCorner = () => {
                let v = parseInt(scr.value, 10);
                if (!Number.isFinite(v)) v = 12;
                this.toolProps.shapeCornerRadius =
                    typeof window.illuClampShapeCornerRadius === 'function'
                        ? window.illuClampShapeCornerRadius(v)
                        : Math.max(0, Math.min(256, v));
                if (scrv) scrv.textContent = String(this.toolProps.shapeCornerRadius);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(scr);
                syncLiveShapeEdit();
                if (this.mode === 'vector' && this.activeVectorSelection && this.activeVectorSelection.length) {
                    this.applyVectorProperty('corner-radius', this.toolProps.shapeCornerRadius, {
                        livePreview: true
                    });
                } else if (typeof window.applyVectorRoundRectRadiusFromToolProps === 'function') {
                    window.applyVectorRoundRectRadiusFromToolProps();
                }
            };
            const commitCorner = () => {
                syncCorner();
                if (this.mode === 'vector' && this.activeVectorSelection && this.activeVectorSelection.length) {
                    if (typeof this.saveHistoryVector === 'function') {
                        this.saveHistoryVector('Arrondi forme');
                    }
                }
            };
            scr.addEventListener('input', syncCorner);
            scr.addEventListener('change', commitCorner);
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(scr);
        }
        bind('tool-shape-grad-type', () => syncLiveShapeEdit());
        bind('tool-text-grad-type', () => {
            const el = document.getElementById('tool-text-grad-type');
            if (el) this.toolProps.textGradType = el.value === 'radial' ? 'radial' : 'linear';
            if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
            if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        });
        const tga = document.getElementById('tool-text-grad-angle');
        const tgav = document.getElementById('tool-text-grad-angle-val');
        if (tga) {
            const syncTextGradAngle = () => {
                let v = parseInt(tga.value, 10);
                if (!Number.isFinite(v)) v = 0;
                this.toolProps.textGradAngle = Math.max(0, Math.min(360, v));
                if (tgav) tgav.textContent = String(this.toolProps.textGradAngle);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(tga);
                if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
            };
            tga.addEventListener('input', syncTextGradAngle);
            tga.addEventListener('change', syncTextGradAngle);
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(tga);
        }
        const sga = document.getElementById('tool-shape-grad-angle');
        const sgav = document.getElementById('tool-shape-grad-angle-val');
        if (sga) {
            sga.addEventListener('input', (e) => {
                this.toolProps.shapeGradAngle = parseInt(e.target.value, 10) || 0;
                if (sgav) sgav.textContent = String(this.toolProps.shapeGradAngle);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(sga);
                syncLiveShapeEdit();
                if (typeof window.onEditorColorsChanged === 'function') window.onEditorColorsChanged();
            });
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(sga);
        }
        const qBulge = document.getElementById('tool-quad-curve-bulge');
        const qBulgeV = document.getElementById('tool-quad-curve-bulge-val');
        if (qBulge) {
            const syncQB = () => {
                let v = parseInt(qBulge.value, 10);
                if (!Number.isFinite(v)) v = 100;
                this.toolProps.quadCurveBulge = Math.max(0, Math.min(200, v));
                if (qBulgeV) qBulgeV.textContent = String(this.toolProps.quadCurveBulge);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(qBulge);
                if (
                    window.activeTool === 'cubic-3' &&
                    typeof window.requestQuadBezierDraftRefresh === 'function'
                ) {
                    window.requestQuadBezierDraftRefresh();
                }
            };
            qBulge.addEventListener('input', syncQB);
            qBulge.addEventListener('change', syncQB);
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(qBulge);
        }
        const tsz = document.getElementById('tool-text-size');
        const tszv = document.getElementById('tool-text-size-val');
        if (tsz) {
            tsz.addEventListener('input', (e) => {
                if (typeof window.extendPixelTextEditorIgnoreBlur === 'function') window.extendPixelTextEditorIgnoreBlur(3000);
                this.toolProps.textSize = parseInt(e.target.value, 10) || 18;
                if (tszv) tszv.textContent = String(this.toolProps.textSize);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(tsz);
                if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
                if (this.mode === 'vector' && typeof window.syncVectorTextEditorStyles === 'function') {
                    window.syncVectorTextEditorStyles();
                }
            });
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(tsz);
        }
        const tf = document.getElementById('tool-text-font');
        if (tf) {
            tf.addEventListener('change', (e) => {
                this.toolProps.textFont = e.target.value;
                if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
                if (this.mode === 'vector' && typeof window.syncVectorTextEditorStyles === 'function') {
                    window.syncVectorTextEditorStyles();
                }
            });
        }
        const tfill = document.getElementById('tool-text-fill');
        if (tfill) {
            tfill.addEventListener('change', (e) => {
                this.toolProps.textFillType = e.target.value;
                if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
            });
        }
        const tb = document.getElementById('tool-text-bold');
        const ti = document.getElementById('tool-text-italic');
        const tst = document.getElementById('tool-text-stroke');
        const syncTextStyleUi = () => {
            if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
            if (this.mode === 'vector' && typeof window.syncVectorTextEditorStyles === 'function') {
                window.syncVectorTextEditorStyles();
            }
        };
        if (tb) tb.addEventListener('change', (e) => { this.toolProps.textBold = e.target.checked; syncTextStyleUi(); });
        if (ti) ti.addEventListener('change', (e) => { this.toolProps.textItalic = e.target.checked; syncTextStyleUi(); });
        if (tst) {
            tst.addEventListener('change', (e) => {
                this.toolProps.textStroke = e.target.checked;
                if (typeof window.syncTextStrokeWidthControlState === 'function') {
                    window.syncTextStrokeWidthControlState();
                }
                if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
            });
        }
        const tsw = document.getElementById('tool-text-stroke-w');
        const tswv = document.getElementById('tool-text-stroke-w-val');
        if (tsw) {
            tsw.addEventListener('input', (e) => {
                if (typeof window.extendPixelTextEditorIgnoreBlur === 'function') window.extendPixelTextEditorIgnoreBlur(3000);
                this.toolProps.textStrokeWidth = parseInt(e.target.value, 10) || 2;
                if (tswv) tswv.textContent = String(this.toolProps.textStrokeWidth);
                if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(tsw);
                if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
            });
            if (typeof window.syncIlluGaugeForRange === 'function') window.syncIlluGaugeForRange(tsw);
        }

        const closeOv = document.getElementById('close-tab-overlay');
        const closeSave = document.getElementById('close-tab-save');
        const closeDiscard = document.getElementById('close-tab-discard');
        const closeCancel = document.getElementById('close-tab-cancel');
        if (closeSave) closeSave.onclick = () => this.finishCloseTab(true);
        if (closeDiscard) closeDiscard.onclick = () => this.finishCloseTab(false);
        if (closeCancel) closeCancel.onclick = () => this.cancelCloseTab();

        const ibOv = document.getElementById('image-bounds-overlay');
        const ibOk = document.getElementById('image-bounds-ok');
        const ibCancel = document.getElementById('image-bounds-cancel');
        if (ibOk) ibOk.onclick = () => this.applyActiveLayerBoundsFromDialog();
        if (ibCancel) ibCancel.onclick = () => { if (ibOv) ibOv.style.display = 'none'; };
        if (ibOv) {
            ibOv.addEventListener('click', (e) => {
                if (e.target === ibOv) ibOv.style.display = 'none';
            });
        }

        const settingsOk = document.getElementById('settings-ok-btn');
        const settingsOv = document.getElementById('settings-overlay');
        if (settingsOk && settingsOv) {
            settingsOk.onclick = () => {
                const prevLayout =
                    typeof window.getUILayoutMode === 'function' ? window.getUILayoutMode() : 'floating';
                let nextLayout = prevLayout;
                try {
                    const row = document.getElementById('settings-layout-scope-row');
                    const layout =
                        typeof window.illuSettingsScopeGetValue === 'function'
                            ? window.illuSettingsScopeGetValue(row, 'floating')
                            : 'floating';
                    if (layout === 'photoshop' || layout === 'floating' || layout === 'phone') {
                        nextLayout = layout;
                        localStorage.setItem('illu_ui_layout', layout);
                    }
                } catch (err) { /* ignore */ }
                try {
                    const ar = document.querySelector('input[name="settings-accent"]:checked');
                    const hex = ar && ar.value;
                    if (hex && typeof window.IlluTheme !== 'undefined' && window.IlluTheme.isAllowedAccent(hex)) {
                        localStorage.setItem('illu_accent', hex);
                    }
                } catch (err) { /* ignore */ }
                try {
                    const dk = document.getElementById('settings-theme-dark');
                    localStorage.setItem('illu_theme_dark', dk && dk.checked ? '1' : '0');
                } catch (err) { /* ignore */ }
                try {
                    if (typeof window.illuEnforceLockedAppearanceStorage === 'function') {
                        window.illuEnforceLockedAppearanceStorage();
                    } else {
                        localStorage.setItem('illu_theme_variant', 'classic');
                        localStorage.setItem('illu_beta_skin', 'none');
                        localStorage.setItem('illu_icon_style', 'monochrome');
                    }
                } catch (err) { /* ignore */ }
                try {
                    const row = document.getElementById('settings-lang-scope-row');
                    const lang =
                        typeof window.illuSettingsScopeGetValue === 'function'
                            ? window.illuSettingsScopeGetValue(row, 'fr')
                            : 'fr';
                    if (window.IlluI18n) window.IlluI18n.setLang(lang === 'en' ? 'en' : 'fr');
                } catch (err) { /* ignore */ }
                try {
                    const wasm = document.getElementById('settings-wasm-enabled');
                    localStorage.setItem('settings-wasm-enabled', wasm && wasm.checked ? '1' : '0');
                } catch (err) { /* ignore */ }

                try {
                    const ram = document.getElementById('settings-ram-session');
                    const ramOn = !!(ram && ram.checked);
                    localStorage.setItem('illu_ram_session_mirror', ramOn ? '1' : '0');
                    if (!ramOn && window.WorkspaceIO && window.WorkspaceIO.SESSION_MIRROR_KEY) {
                        try {
                            sessionStorage.removeItem(window.WorkspaceIO.SESSION_MIRROR_KEY);
                        } catch (e2) { /* ignore */ }
                    } else if (
                        ramOn &&
                        window.WorkspaceIO &&
                        typeof window.WorkspaceIO.persistToLocalStorage === 'function' &&
                        typeof window.WorkspaceIO.getAutoSaveMode === 'function' &&
                        window.WorkspaceIO.getAutoSaveMode() !== 'off'
                    ) {
                        window.WorkspaceIO.persistToLocalStorage();
                    }
                } catch (err) { /* ignore */ }
                try {
                    const row = document.getElementById('settings-autosave-scope-row');
                    let mode =
                        typeof window.illuSettingsScopeGetValue === 'function'
                            ? window.illuSettingsScopeGetValue(row, 'continuous')
                            : 'continuous';
                    if (mode !== 'continuous' && mode !== 'interval' && mode !== 'off') mode = 'continuous';
                    if (window.WorkspaceIO && window.WorkspaceIO.AUTO_SAVE_MODE_KEY) {
                        localStorage.setItem(window.WorkspaceIO.AUTO_SAVE_MODE_KEY, mode);
                    }
                    const asMin = document.getElementById('settings-autosave-interval-min');
                    if (asMin && window.WorkspaceIO && window.WorkspaceIO.AUTO_SAVE_INTERVAL_MIN_KEY) {
                        const n = Math.max(1, Math.min(120, parseInt(asMin.value, 10) || 3));
                        localStorage.setItem(window.WorkspaceIO.AUTO_SAVE_INTERVAL_MIN_KEY, String(n));
                    }
                    if (typeof window.WorkspaceIO.setupAutoSaveIntervalTimer === 'function') {
                        window.WorkspaceIO.setupAutoSaveIntervalTimer();
                    }
                } catch (err) { /* ignore */ }
                try {
                    const ut = document.getElementById('settings-ui-thumbs');
                    localStorage.setItem('illu_ui_thumbs', ut && ut.checked ? '1' : '0');
                } catch (err) { /* ignore */ }
                try {
                    const w11 = document.getElementById('settings-win11-enabled');
                    localStorage.setItem('settings-win11-enabled', w11 && w11.checked ? '1' : '0');
                } catch (err) { /* ignore */ }
                try {
                    const tbg = document.getElementById('settings-tab-bg-preview-enabled');
                    localStorage.setItem('settings-tab-bg-preview-enabled', tbg && tbg.checked ? '1' : '0');
                } catch (err) { /* ignore */ }
                try {
                    const sl = document.getElementById('settings-stroke-light-render');
                    localStorage.setItem('illu_stroke_light_render', sl && sl.checked ? '1' : '0');
                } catch (err) { /* ignore */ }
                try {
                    const md = document.getElementById('settings-move-preview-dynamic');
                    localStorage.setItem('illu_move_preview_dynamic', md && md.checked ? '1' : '0');
                } catch (err) { /* ignore */ }
                try {
                    const hm = document.getElementById('settings-history-max');
                    if (hm) {
                        const n = Math.max(5, Math.min(500, parseInt(hm.value, 10) || this.HISTORY_MAX_ENTRIES_DEFAULT));
                        localStorage.setItem('illu_history_max_entries', String(n));
                        hm.value = String(n);
                    }
                    this.trimAllProjectsHistoryToMax();
                } catch (err) { /* ignore */ }
                this.updateTabUI();
                this.updateLayerUI();
                if (typeof window.IlluTheme !== 'undefined' && window.IlluTheme.applyFromStorage) {
                    window.IlluTheme.applyFromStorage();
                }
                const revertLayout = () => {
                    try {
                        localStorage.setItem('illu_ui_layout', prevLayout);
                    } catch (e) { /* ignore */ }
                    if (typeof window.syncSettingsLayoutScopeFromStorage === 'function') {
                        window.syncSettingsLayoutScopeFromStorage();
                    }
                };
                if (
                    typeof window.illuConfirmUILayoutReloadIfNeeded === 'function' &&
                    window.illuConfirmUILayoutReloadIfNeeded(prevLayout, nextLayout, revertLayout)
                ) {
                    return;
                }
                if (typeof window.applyUILayoutFromPreference === 'function') window.applyUILayoutFromPreference();
                if (typeof window.illuInitToolbarRibbon === 'function') window.illuInitToolbarRibbon();
                if (typeof window.applyIlluMobileUiClass === 'function') window.applyIlluMobileUiClass();
                if (window.IlluI18n) window.IlluI18n.apply();
                if (typeof window.refreshChromeDocTitle === 'function') window.refreshChromeDocTitle();
                this.render();
                settingsOv.style.display = 'none';
                document.body.classList.remove('no-scroll');
            };
        }
        if (settingsOv) {
            settingsOv.addEventListener('click', (e) => {
                if (e.target === settingsOv) {
                    settingsOv.style.display = 'none';
                    document.body.classList.remove('no-scroll');
                }
            });
        }
        const settingsClear = document.getElementById('settings-clear-local-btn');
        if (settingsClear) {
            settingsClear.onclick = () => {
                const msg =
                    window.IlluI18n && typeof window.IlluI18n.t === 'function'
                        ? window.IlluI18n.t('settings.clearLocalConfirm')
                        : 'Effacer toutes les données locales et recharger la page ?';
                if (!confirm(msg)) return;
                if (typeof window.clearIlluLocalStorage === 'function') {
                    void window.clearIlluLocalStorage().catch(() => {});
                }
            };
        }

        const btnClearHistCurrent = document.getElementById('settings-clear-history-current-btn');
        if (btnClearHistCurrent) {
            btnClearHistCurrent.onclick = () => {
                const msg = window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t('settings.clearHistoryCurrentConfirm') : "Voulez-vous effacer l'historique de cet onglet ?";
                if (!confirm(msg)) return;
                this.clearCurrentProjectHistory();
            };
        }

        const btnClearHistAll = document.getElementById('settings-clear-history-all-btn');
        if (btnClearHistAll) {
            btnClearHistAll.onclick = () => {
                const msg = window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t('settings.clearHistoryAllConfirm') : "Voulez-vous effacer l'historique de TOUS les onglets ?";
                if (!confirm(msg)) return;
                this.clearAllProjectsHistory();
            };
        }
        const settingsExportBundle = document.getElementById('settings-export-local-bundle-btn');
        if (settingsExportBundle) {
            settingsExportBundle.onclick = () => {
                if (typeof window.exportIlluLocalStorageBundle === 'function') {
                    void window.exportIlluLocalStorageBundle().catch((e) => console.warn(e));
                }
            };
        }
        const settingsImportBundle = document.getElementById('settings-import-local-bundle-btn');
        const settingsImportFile = document.getElementById('settings-import-local-bundle-file');
        if (settingsImportBundle && settingsImportFile) {
            settingsImportBundle.onclick = () => settingsImportFile.click();
            settingsImportFile.onchange = () => {
                const f = settingsImportFile.files && settingsImportFile.files[0];
                settingsImportFile.value = '';
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                    const text = typeof reader.result === 'string' ? reader.result : '';
                    if (typeof window.importIlluLocalStorageBundle === 'function') {
                        void window.importIlluLocalStorageBundle(text).catch((e) => console.warn(e));
                    }
                };
                reader.readAsText(f, 'UTF-8');
            };
        }

        const sm0 = document.getElementById('tool-shape-mode');
        if (sm0 && sm0.value) this.toolProps.shapeStrokeMode = sm0.value;
        const fillMode0 = document.getElementById('fill-mode');
        if (fillMode0) this.toolProps.fillMode = fillMode0.value === 'layer' ? 'layer' : 'contiguous';
        const ft0 = document.getElementById('tool-fill-type');
        if (ft0) {
            let fv = ft0.value || 'solid';
            if (fv === 'none') {
                fv = 'solid';
                ft0.value = 'solid';
            }
            if (fv !== 'solid' && fv !== 'gradient') fv = 'solid';
            this.toolProps.fillType = fv;
            if (ft0.value !== fv) ft0.value = fv;
        }
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        this.initProjectTabDragReorder();
        
        window.addEventListener('hashchange', () => this.handleUrlRouting());
    },

    /**
     * Analyse l'URL (search params ou hash) pour déclencher des actions automatiques au chargement.
     * Exemple : MasterPaint/?mode=Pro ou MasterPaint/#svg ou MasterPaint/?res=1920x1080
     */
    /**
     * Gère le routage via URL (paramètres query ? ou hash #).
     * @returns {boolean} True si une action de routage (nouveau projet ou mode photo) a été effectuée.
     */
    handleUrlRouting() {
        if (this._urlRoutedInProgress) return false;
        
        const urlSearch = new URLSearchParams(window.location.search);
        let hashStr = window.location.hash.substring(1);
        
        // Nettoyage et fusion des paramètres (search et hash)
        let hashParams = new URLSearchParams();
        let hashBase = "";
        
        const qPos = hashStr.indexOf('?');
        const eqPos = hashStr.indexOf('=');
        
        if (qPos !== -1) {
            hashBase = hashStr.substring(0, qPos);
            hashParams = new URLSearchParams(hashStr.substring(qPos + 1));
        } else if (eqPos !== -1) {
            hashParams = new URLSearchParams(hashStr);
            hashBase = "";
        } else {
            hashBase = hashStr;
        }

        const getParam = (key) => {
            const v = urlSearch.get(key);
            if (v !== null && v !== "") return v;
            return hashParams.get(key);
        };

        // Détection du mode (insensible à la casse)
        let mode = getParam('mode') || hashBase;
        if (mode) mode = mode.toLowerCase();
        
        // Détection de la résolution : STRICT regex pour éviter de matcher "pix" ou autre texte contenant "x"
        const resRegex = /^[0-9]+x[0-9]+$/;
        const res = getParam('res') || getParam('pixel') || (resRegex.test(hashBase) ? hashBase : null);
        const w = getParam('w') || getParam('width');
        const h = getParam('h') || getParam('height');

        if (mode === 'pro' || mode === 'photo') {
            this._urlRoutedInProgress = true;
            setTimeout(() => {
                if (typeof PhotoModeManager !== 'undefined' && typeof PhotoModeManager.open === 'function') {
                    PhotoModeManager.open();
                }
                this._urlRoutedInProgress = false;
            }, 600);
            return true;
        } else if (mode === 'pix' || mode === 'pixel' || mode === 'svg' || mode === 'vector' || res || (w && h)) {
            this._urlRoutedInProgress = true;
            // Résolution par défaut (720p)
            let width = 1280, height = 720;
            
            // On écrase si spécifié
            if (res && res.includes('x')) {
                const parts = res.split('x');
                width = parseInt(parts[0], 10) || 1280;
                height = parseInt(parts[1], 10) || 720;
            } else {
                if (w) width = parseInt(w, 10) || width;
                if (h) height = parseInt(h, 10) || height;
            }

            const finalMode = (mode === 'svg' || mode === 'vector') ? 'vector' : 'pixel';
            if (typeof window.illuSplashLog === 'function') {
                window.illuSplashLog(`URL : Création projet ${finalMode} ${width}x${height}`);
            }
            this.createNewProjectWithParams({ mode: finalMode, width, height });
            
            if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
            
            // On garde le flag true un court instant pour ignorer les triggers hashchange successifs
            setTimeout(() => { this._urlRoutedInProgress = false; }, 200);
            return true;
        }
        return false;
    },

    /** Crée un nouveau projet programmatiquement en simulant les inputs du dialogue. */
    createNewProjectWithParams(opts) {
        if (opts.mode) {
             const radio = document.querySelector(`input[name="proj-mode"][value="${opts.mode}"]`);
             if (radio) {
                 radio.checked = true;
                 radio.dispatchEvent(new Event('change'));
             }
        }

        const pw = document.getElementById('p-width');
        const ph = document.getElementById('p-height');
        if (pw && opts.width) pw.value = String(opts.width);
        if (ph && opts.height) ph.value = String(opts.height);
        
        this.handleNewProject();
    },

    get activeProject() {
        return this.projects[this.activeProjectIndex] || null;
    },

    get mode() { return this.activeProject ? this.activeProject.mode : 'pixel'; },
    get isPixelMode() {
        if (!this.activeProject) return true;
        const m = this.activeProject.mode;
        return m === 'pixel' || m === 'pixel-dither' || m === 'pixel-ral' || m === 'pixel-cmjn';
    },

    /** 
     * Taille de l'effet de trame (points). 
     * Utilisé pour la génération des motifs et le tramage automatique à l'import.
     */
    get ditherEffectSize() {
        if (this.activeProject && this.activeProject.ditherEffectSize != null) {
            return this.activeProject.ditherEffectSize;
        }
        return this.toolProps.ditherEffectSize || 1;
    },
    set ditherEffectSize(val) {
        const size = Math.max(1, Math.min(8, val));
        this.toolProps.ditherEffectSize = size;
        if (this.activeProject) {
            this.activeProject.ditherEffectSize = size;
        }
        this.setupDitherPalette();
        this.updateLayerUI(); // Refresh patterns in UI
    },
    get width() {
        return this.activeProject ? this.activeProject.width : window.ILLU_DEFAULT_DOC_WIDTH || 1280;
    },
    get height() {
        return this.activeProject ? this.activeProject.height : window.ILLU_DEFAULT_DOC_HEIGHT || 720;
    },
    get layers() { return this.activeProject ? this.activeProject.layers : []; },
    get activeLayerIndex() { return this.activeProject ? this.activeProject.activeLayerIndex : 0; },
    /** Écrit l’index du calque actif (le getter seul ne permet pas d’assigner this.activeLayerIndex). */
    setActiveLayerIndex(i) {
        if (!this.activeProject || !this.layers.length || window._illuFinishingWarp) return;
        const n = Math.max(0, Math.min(i, this.layers.length - 1));

        // Valider et fusionner de manière synchrone toute interaction pixel (déplacement ou déformation)
        // sur l'ancien calque actif avant d'effectuer le changement de calque.
        if (this.activeProject.activeLayerIndex !== n) {
            if (typeof window.illuCommitAnyActiveInteractionSynchronously === 'function') {
                window.illuCommitAnyActiveInteractionSynchronously();
            }
        }

        this.activeProject.activeLayerIndex = n;
        /*
        const m = typeof window !== 'undefined' ? window.selectionColorMask : null;
        const al = this.activeLayer;
        if (m && m.layerId != null && al && m.layerId !== al.id) {
            this.deselectAll();
        }
        */
    },

    /** Masque baguette « couleur » : ajoute les bandes horizontales au chemin courant (coords calque). */
    appendColorMaskRectsToPath(ctx, m, offX = 0, offY = 0) {
        if (!ctx || !m || !m.data) return;
        const w = m.w | 0;
        const h = m.h | 0;
        if (w < 1 || h < 1) return;
        const d = m.data;
        for (let y = 0; y < h; y++) {
            let rs = -1;
            const py = y + offY;
            for (let x = 0; x <= w; x++) {
                const on = x < w && d[y * w + x];
                if (on && rs < 0) rs = x;
                if ((!on || x === w) && rs >= 0) {
                    ctx.rect(rs + offX, py, x - rs, 1);
                    rs = -1;
                }
            }
        }
    },

    colorMaskMatchesActiveLayer(m) {
        const l = this.activeLayer;
        return !!(
            m &&
            m.data &&
            l &&
            l.buffer &&
            m.layerId === l.id &&
            m.w === l.buffer.width &&
            m.h === l.buffer.height
        );
    },
    get activeLayer() { return this.layers[this.activeLayerIndex] || null; },
    get activeCtx() {
        if (
            this._strokeIntermediateCanvas &&
            this.activeLayer &&
            this._strokeIntermediateLayerId === this.activeLayer.id
        ) {
            return this._strokeIntermediateCanvas.getContext('2d', { willReadFrequently: true });
        }
        if (this.activeLayer && this.activeLayer.buffer) {
            return this.activeLayer.buffer.getContext('2d', { willReadFrequently: true });
        }
        return null;
    },

    /** @returns {boolean} true si le tampon intermédiaire est utilisé pour ce tracé. */
    beginStrokeIntermediate(tool) {
        const l = this.activeLayer;
        if (!l || !l.buffer) return false;
        // When "Hors toile" is enabled, we may need to resize/expand the layer during the stroke.
        // The intermediate stroke canvas would not resize correctly, so we bypass it.
        if (typeof window.illuAllowsOutsideCanvasContent === 'function' && window.illuAllowsOutsideCanvasContent()) {
            this.disposeStrokeIntermediate();
            return false;
        }
        if (l.alphaMaskProjectId) return false;
        if (this._isLiveDynamicFilterLayer(l)) return false;
        const w = l.buffer.width | 0;
        const h = l.buffer.height | 0;
        if (w < 1 || h < 1) return false;
        if (!this._strokeIntermediateCanvas || this._strokeIntermediateCanvas.width !== w || this._strokeIntermediateCanvas.height !== h) {
            this._strokeIntermediateCanvas = document.createElement('canvas');
            this._strokeIntermediateCanvas.width = w;
            this._strokeIntermediateCanvas.height = h;
        }
        const sctx = this._strokeIntermediateCanvas.getContext('2d', { willReadFrequently: true });
        sctx.clearRect(0, 0, w, h);
        if (tool === 'eraser') {
            sctx.drawImage(l.buffer, 0, 0);
        }
        this._strokeIntermediateLayerId = l.id;
        this._strokeIntermediateTool = tool;
        return true;
    },

    commitStrokeIntermediate() {
        const l = this.activeLayer;
        if (!this._strokeIntermediateCanvas || !l || !l.buffer || this._strokeIntermediateLayerId !== l.id) {
            this.disposeStrokeIntermediate();
            return;
        }
        const lctx = l.buffer.getContext('2d', { willReadFrequently: true });
        if (this._strokeIntermediateTool === 'eraser') {
            lctx.clearRect(0, 0, l.buffer.width, l.buffer.height);
            lctx.drawImage(this._strokeIntermediateCanvas, 0, 0);
        } else {
            lctx.drawImage(this._strokeIntermediateCanvas, 0, 0);
        }
        this.disposeStrokeIntermediate();
        if (this.activeProject && this.activeProject.mode !== 'pixel') {
            this.applyProjectColorModeToLayer(l, this.activeProject.mode);
        }
    },

    disposeStrokeIntermediate() {
        this._strokeIntermediateCanvas = null;
        this._strokeIntermediateLayerId = null;
        this._strokeIntermediateTool = null;
    },

    /** Opacité d’affichage des pixels hors rectangle document quand « Hors toile » est actif. */
    _outsideCanvasPreviewOpacity() {
        return 0.45;
    },

    _layerExtendsOutsideDocument(layer) {
        if (!layer || !layer.buffer) return false;
        const W = this.width;
        const H = this.height;
        if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return false;
        const lx = Number(layer.x) || 0;
        const ly = Number(layer.y) || 0;
        const bw = layer.buffer.width | 0;
        const bh = layer.buffer.height | 0;
        // Ne pas arrondir x/y avec |0 : ex. layer.x=-0.2 donne lx=0 alors que des pixels hors document existent déjà.
        return lx < 0 || ly < 0 || lx + bw > W || ly + bh > H;
    },

    _shouldDimOutsideCanvasLayer(layer) {
        const isDrawingGlobal = window.isDrawing || (typeof isDrawing !== 'undefined' && isDrawing);
        if (isDrawingGlobal || window.selectionPixelWarpActive || window.selectionBoundsResizeActive) {
            return false;
        }
        return !!(this.toolProps && this.toolProps.allowOutsideCanvas) && this._layerExtendsOutsideDocument(layer);
    },

    /**
     * Dessine le tampon calque sur un contexte 2D (coords locales 0,0 = coin tampon).
     * Si « Hors toile » : partie hors document en semi-transparence, intérieur à pleine opacité.
     */
    _paintLayerBufferLocalWithOutsideDim(vctx, layer, paintFn) {
        const op = layer.opacity != null ? layer.opacity : 1;
        const dim = this._shouldDimOutsideCanvasLayer(layer);
        if (!dim) {
            vctx.save();
            vctx.globalAlpha = 1;
            vctx.globalCompositeOperation = 'source-over';
            if (typeof paintFn === 'function') paintFn(vctx, 1);
            vctx.restore();
            return;
        }
        const lx = Number(layer.x) || 0;
        const ly = Number(layer.y) || 0;
        const W = this.width;
        const H = this.height;
        const docX0 = -lx;
        const docY0 = -ly;
        const outsideOp = Math.max(0, Math.min(1, op * this._outsideCanvasPreviewOpacity()));
        const innerOp = Math.max(0, Math.min(1, op));
        vctx.save();
        vctx.globalCompositeOperation = 'source-over';
        vctx.globalAlpha = outsideOp;
        if (typeof paintFn === 'function') paintFn(vctx, outsideOp);
        vctx.restore();
        vctx.save();
        vctx.globalCompositeOperation = 'source-over';
        vctx.globalAlpha = innerOp;
        vctx.beginPath();
        vctx.rect(docX0, docY0, W, H);
        vctx.clip();
        if (typeof paintFn === 'function') paintFn(vctx, innerOp);
        vctx.restore();
    },

    _canUseShapePreviewOverlay() {
        const l = this.activeLayer;
        if (!l || !l.buffer || l.alphaMaskProjectId) return false;
        if (this._isLiveDynamicFilterLayer(l)) return false;
        return true;
    },

    beginShapePreviewIfNeeded() {
        if (!this._canUseShapePreviewOverlay() || typeof window === 'undefined' || !window._shapeBackupCanvas) return;
        const l = this.activeLayer;
        const w = l.buffer.width | 0;
        const h = l.buffer.height | 0;
        if (w < 1 || h < 1) return;
        if (!this._shapePreviewCanvas || this._shapePreviewCanvas.width !== w || this._shapePreviewCanvas.height !== h) {
            this._shapePreviewCanvas = document.createElement('canvas');
            this._shapePreviewCanvas.width = w;
            this._shapePreviewCanvas.height = h;
        }
        this._shapePreviewCanvas.getContext('2d', { willReadFrequently: true }).clearRect(0, 0, w, h);
        this._shapePreviewActiveLayerId = l.id;
        this._shapePreviewActive = true;
    },

    clearShapePreviewOverlay() {
        this._shapePreviewCanvas = null;
        this._shapePreviewActiveLayerId = null;
        this._shapePreviewActive = false;
    },

    /**
     * Annule les sessions pixel « live » (forme vectorielle pixel, dégradé, aperçu effet…)
     * qui réécrivent le calque après un undo/redo.
     */
    clearTransientPixelEditState() {
        if (typeof window.clearPixelToolSessions === 'function') {
            window.clearPixelToolSessions();
        } else {
            window.pixelShapeEdit = null;
            window.shapeHandleDrag = null;
            window._pixelGradientState = null;
            window._gradientHandleDrag = null;
            window._gradientNewDrag = false;
            window._gradientBackup = null;
            window._shapeBackupCanvas = null;
            window._shapeBackupOriginX = null;
            window._shapeBackupOriginY = null;
            window._shapeLivePreviewAngleRad = 0;
            window._shapeRotDragActive = false;
            window._shapeRotDragMode = null;
        }
        this.disposeStrokeIntermediate();
        this.clearShapePreviewOverlay();
        if (window.FilterManager && typeof window.FilterManager.dismissEffectDialogWithoutRestore === 'function') {
            if (document.body.classList.contains('effect-dialog-open')) {
                window.FilterManager.dismissEffectDialogWithoutRestore();
            } else {
                window.FilterManager._cancelActiveWorkerPreview?.();
            }
        }
    },

    /** Sauvegarde l’état courant avant une action destructive (remplissage, forme…). */
    pushHistoryCheckpoint(label, opts = {}) {
        if (!this.activeProject || !this.isPixelMode) return;
        const allLayers = opts.allLayers === true;
        if (allLayers) {
            this.saveHistoryAllLayers(label || 'Point de restauration');
        } else {
            this.saveHistory(label || 'Point de restauration', {
                patchActiveLayer: !!this.activeLayer?.buffer
            });
        }
    },

    /** Historique : cliché de tous les calques bitmap (effets « tous les calques », recadrage…). */
    saveHistoryAllLayers(actionName, opts = {}) {
        if (!this.activeProject) return;
        this.saveHistory(actionName, {
            ...opts,
            patchActiveLayer: false,
            documentGeometry: opts.documentGeometry === true
        });
    },

    getLayerBlendMode(layer) {
        if (layer && layer.pdnBlendMode && typeof window.PdnBlendModes !== 'undefined') {
            return window.PdnBlendModes.mapPdnBlendToMasterPaint(layer.pdnBlendMode, layer.blendMode);
        }
        const m = layer && layer.blendMode ? layer.blendMode : 'source-over';
        return this._validBlendModes.has(m) ? m : 'source-over';
    },

    /** Équivalent CSS `mix-blend-mode` pour l’empilement des vues calque. */
    _blendModeToCssMix(layer) {
        const m = this.getLayerBlendMode(layer);
        const map = {
            'source-over': 'normal',
            multiply: 'multiply',
            screen: 'screen',
            overlay: 'overlay',
            darken: 'darken',
            lighten: 'lighten',
            'color-dodge': 'color-dodge',
            'color-burn': 'color-burn',
            'hard-light': 'hard-light',
            'soft-light': 'soft-light',
            difference: 'difference',
            exclusion: 'exclusion',
            hue: 'hue',
            saturation: 'saturation',
            color: 'color',
            luminosity: 'luminosity',
            lighter: 'lighter',
            xor: 'xor'
        };
        return map[m] || 'normal';
    },
    _pixelDomLayerViewsEligible() {
        if (!this.activeProject || !this.isPixelMode) return false;
        if (this.activeProject.role === 'layerAlphaMask') return false;
        for (let i = 0; i < this.layers.length; i++) {
            const l = this.layers[i];
            if (!l) continue;
            this._normalizeDynamicFilterProps(l);
            // Les masques alpha et filtres dynamiques nécessitent le chemin de rendu composite,
            // pas la pile DOM des calques (sinon ces effets sont ignorés).
            if (l.alphaMaskProjectId) return false;
            if (this._isLiveDynamicFilterLayer(l) && !this._dynamicFilterLayerDomCssEligible(l)) return false;
        }
        return true;
    },

    pixelDomLayerViewsActive() {
        return !!this._domPixelStackActive;
    },

    /**
     * Position document du bouton de rotation (cercle) : au-dessus du bord supérieur effectif
     * (rectangle + angle d’aperçu, ou quad 4 points après bake).
     */
    selectionRotationHandleDocXY(sb, previewAngleRad, quadPts) {
        const z = this.getCanvasZoomLevel();
        const pad = 22 / z;
        const ang = previewAngleRad || 0;
        if (quadPts && quadPts.length === 4) {
            const tl = quadPts[0];
            const tr = quadPts[1];
            const mx = (tl.x + tr.x) / 2;
            const my = (tl.y + tr.y) / 2;
            const ex = tr.x - tl.x;
            const ey = tr.y - tl.y;
            const elen = Math.hypot(ex, ey) || 1;
            const nx = ey / elen;
            const ny = -ex / elen;
            return { x: mx + nx * pad, y: my + ny * pad };
        }
        const cx = sb.x + sb.w / 2;
        const cy = sb.y + sb.h / 2;
        const topMidRot = {
            x: cx + (sb.h / 2) * Math.sin(ang),
            y: cy - (sb.h / 2) * Math.cos(ang)
        };
        return {
            x: topMidRot.x + pad * Math.sin(ang),
            y: topMidRot.y - pad * Math.cos(ang)
        };
    },

    /**
     * Prévisualisation (fantôme déplacement, warp…) : calque « volatile » dans #pixel-layer-stack,
     * inséré juste avant le canvas du calque actif (même plan de superposition que ce calque).
     * Utilise _pixelDomLayerViewsEligible() et non seulement pixelDomLayerViewsActive() pour que le
     * premier rendu de la pile existe avant le montage.
     * @returns {boolean} true si monté dans #pixel-layer-stack
     */
    mountMoveGhostInPixelStackIfNeeded(el) {
        if (!el || !this.activeProject || !this.isPixelMode) return false;
        if (!this._pixelDomLayerViewsEligible()) return false;
        const stack = document.getElementById('pixel-layer-stack');
        if (!stack) return false;
        const li = this.activeLayerIndex;
        const L = this.layers[li];
        el.classList.add('illu-stack-preview-overlay');
        el.style.position = 'absolute';
        el.style.pointerEvents = 'none';
        el.style.zIndex = String(li + 1);
        if (L) {
            el.style.opacity = String(L.opacity != null ? L.opacity : 1);
            el.style.mixBlendMode = this._blendModeToCssMix(L);
        } else {
            el.style.opacity = '1';
            el.style.mixBlendMode = 'normal';
        }
        const activeCv =
            L && stack.querySelector
                ? stack.querySelector(`canvas.illu-pixel-layer-view[data-layer-id="${L.id}"]`)
                : null;
        if (activeCv && activeCv.parentNode === stack) {
            // Placer au-dessus du calque courant plutôt qu'en dessous
            if (activeCv.nextSibling) {
                stack.insertBefore(el, activeCv.nextSibling);
            } else {
                stack.appendChild(el);
            }
        } else {
            stack.appendChild(el);
        }
        return true;
    },

    /**
     * Après _syncPixelDomLayerViews : les appendChild réordonnent les vues calque ; on replace les
     * canvas.illu-stack-preview-overlay juste après le calque actif pour que le déplacement reste
     * visuellement au-dessus du rendu courant, tout en restant sous les calques supérieurs.
     */
    _restackStackPreviewOverlays(stackEl) {
        if (!stackEl || !this._pixelDomLayerViewsEligible()) return;
        const L = this.layers[this.activeLayerIndex];
        if (!L) return;
        const activeCv = stackEl.querySelector(`canvas.illu-pixel-layer-view[data-layer-id="${L.id}"]`);
        if (!activeCv || activeCv.parentNode !== stackEl) return;
        const overs = stackEl.querySelectorAll('canvas.illu-stack-preview-overlay');
        const anchor = activeCv.nextSibling;
        for (let i = 0; i < overs.length; i++) {
            try {
                if (anchor) {
                    stackEl.insertBefore(overs[i], anchor);
                } else {
                    stackEl.appendChild(overs[i]);
                }
            } catch (e) {
                /* ignore */
            }
        }
    },

    /**
     * Couleur composite document (pipette, etc.) quand la pile DOM remplace le dessin sur #drawing-canvas.
     */
    sampleDocCompositeRgb(pos) {
        const p = this.activeProject;
        if (!p || !p.mode.startsWith('pixel')) return null;
        const x = Math.min(p.width - 1, Math.max(0, Math.floor(pos.x)));
        const y = Math.min(p.height - 1, Math.max(0, Math.floor(pos.y)));
        if (
            this._renderEpoch !== this._sampleFlatEpoch ||
            !this._sampleFlatCanvas ||
            this._sampleFlatCanvas.width !== p.width ||
            this._sampleFlatCanvas.height !== p.height
        ) {
            this._sampleFlatCanvas = this.flattenPixelProjectToCanvas(p, true);
            this._sampleFlatEpoch = this._renderEpoch;
        }
        const flat = this._sampleFlatCanvas;
        try {
            const d = flat.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
            return { r: d[0], g: d[1], b: d[2], a: d[3] };
        } catch (e) {
            return null;
        }
    },

    _syncPixelDomLayerViews(stackEl) {
        if (!this.activeProject || !stackEl) return;
        if (!this._pixelLayerViewEls) this._pixelLayerViewEls = new Map();
        const map = this._pixelLayerViewEls;
        const seen = new Set();
        const layers = this.layers;
        for (let i = 0; i < layers.length; i++) {
            const l = layers[i];
            seen.add(l.id);
            let cv = map.get(l.id);
            if (!cv) {
                cv = document.createElement('canvas');
                cv.className = 'illu-pixel-layer-view';
                cv.dataset.layerId = String(l.id);
                map.set(l.id, cv);
            }
            if (!l.buffer) {
                cv.style.display = 'none';
                continue;
            }
            if (l._ghostDragHide) {
                cv.style.display = 'none';
                continue;
            }
            const bw = l.buffer.width | 0;
            const bh = l.buffer.height | 0;
            if (bw < 1 || bh < 1) {
                cv.style.display = 'none';
                continue;
            }
            if (cv.width !== bw) cv.width = bw;
            if (cv.height !== bh) cv.height = bh;
            cv.style.display = l.visible ? 'block' : 'none';
            cv.style.left = `${l.x}px`;
            cv.style.top = `${l.y}px`;
            cv.style.opacity = this._shouldDimOutsideCanvasLayer(l)
                ? '1'
                : String(l.opacity != null ? l.opacity : 1);
            cv.style.mixBlendMode = this._blendModeToCssMix(l);
            cv.style.zIndex = String(i + 1);
            if (this._dynamicFilterLayerDomCssEligible(l)) {
                cv.style.filter = this._dynamicFilterCssFilterStringForStack(l);
            } else {
                cv.style.filter = 'none';
            }
            const vctx = cv.getContext('2d', { willReadFrequently: true });
            vctx.clearRect(0, 0, bw, bh);
            const hasStrokeIntermediate =
                this._strokeIntermediateCanvas && this._strokeIntermediateLayerId === l.id;
            this._paintLayerBufferLocalWithOutsideDim(vctx, l, (ctx2d) => {
                if (hasStrokeIntermediate && this._strokeIntermediateTool === 'eraser') {
                    ctx2d.drawImage(this._strokeIntermediateCanvas, 0, 0);
                } else {
                    ctx2d.drawImage(l.buffer, 0, 0);
                    if (hasStrokeIntermediate) {
                        ctx2d.drawImage(this._strokeIntermediateCanvas, 0, 0);
                    }
                }
                if (this._shapePreviewCanvas && this._shapePreviewActiveLayerId === l.id) {
                    ctx2d.drawImage(this._shapePreviewCanvas, 0, 0);
                }
            });
            stackEl.appendChild(cv);
            this._syncImportStagingDomView(stackEl, l, (i + 1) * 10 + 1);
        }
        stackEl.querySelectorAll('canvas.illu-pixel-layer-view[data-layer-id]').forEach((domCv) => {
            const lid = parseInt(domCv.dataset.layerId, 10);
            if (!Number.isFinite(lid)) return;
            if (map.get(lid) !== domCv) domCv.remove();
        });
        for (const [id, el] of [...map.entries()]) {
            if (!seen.has(id)) {
                el.remove();
                map.delete(id);
            }
        }
        if (this._pixelLayerStagingViewEls) {
            for (const [id, el] of [...this._pixelLayerStagingViewEls.entries()]) {
                if (!seen.has(id)) {
                    el.remove();
                    this._pixelLayerStagingViewEls.delete(id);
                }
            }
        }
        this._restackStackPreviewOverlays(stackEl);
    },

    /** Vue DOM du collage volant (tampon séparé, hors dimensions du calque). */
    _syncImportStagingDomView(stackEl, layer, zIndex) {
        if (!stackEl || !layer) return;
        if (!this._pixelLayerStagingViewEls) this._pixelLayerStagingViewEls = new Map();
        const map = this._pixelLayerStagingViewEls;
        const key = layer.id;
        const st = layer.importStagingBuffer;
        const show =
            layer.importPlacementPending && st && !layer._ghostDragHide && layer.visible !== false;
        let cv = map.get(key);
        if (!show) {
            if (cv) {
                cv.remove();
                map.delete(key);
            }
            return;
        }
        if (!cv) {
            cv = document.createElement('canvas');
            cv.className = 'illu-pixel-layer-staging-view';
            cv.dataset.layerId = String(key);
            cv.setAttribute('aria-hidden', 'true');
            map.set(key, cv);
        }
        const iw = st.width | 0;
        const ih = st.height | 0;
        if (iw < 1 || ih < 1) {
            cv.style.display = 'none';
            return;
        }
        if (cv.width !== iw) cv.width = iw;
        if (cv.height !== ih) cv.height = ih;
        cv.style.display = 'block';
        cv.style.left = `${layer.importStagingX | 0}px`;
        cv.style.top = `${layer.importStagingY | 0}px`;
        cv.style.opacity = this._shouldDimOutsideCanvasLayer(Object.assign({}, layer, { buffer: st, x: layer.importStagingX, y: layer.importStagingY }))
            ? '1'
            : String(layer.opacity != null ? layer.opacity : 1);
        cv.style.mixBlendMode = this._blendModeToCssMix(layer);
        cv.style.zIndex = String(zIndex);
        cv.style.imageRendering = 'pixelated';
        cv.style.setProperty('image-rendering', 'crisp-edges');
        const vctx = cv.getContext('2d', { willReadFrequently: true });
        if (vctx) {
            vctx.imageSmoothingEnabled = false;
            vctx.clearRect(0, 0, iw, ih);
            const tempLayer = Object.assign({}, layer, { x: layer.importStagingX, y: layer.importStagingY, buffer: st });
            this._paintLayerBufferLocalWithOutsideDim(vctx, tempLayer, (ctx2d) => {
                ctx2d.drawImage(st, 0, 0);
            });
        }
        stackEl.appendChild(cv);
    },

    /** Met à jour une seule vue calque DOM (perf : édition forme, etc.). */
    _syncSinglePixelDomLayerView(stackEl, layer) {
        if (!stackEl || !layer || !layer.buffer) return;
        if (!this._pixelLayerViewEls) this._pixelLayerViewEls = new Map();
        const map = this._pixelLayerViewEls;
        const layerIndex = this.layers.indexOf(layer);
        const i = layerIndex >= 0 ? layerIndex : this.activeLayerIndex | 0;
        let cv = map.get(layer.id);
        if (!cv) {
            cv = document.createElement('canvas');
            cv.className = 'illu-pixel-layer-view';
            cv.dataset.layerId = String(layer.id);
            map.set(layer.id, cv);
        }
        if (layer._ghostDragHide) {
            cv.style.display = 'none';
            this._syncImportStagingDomView(stackEl, layer, (i + 1) * 10 + 1);
            return;
        }
        const bw = layer.buffer.width | 0;
        const bh = layer.buffer.height | 0;
        if (bw < 1 || bh < 1) {
            cv.style.display = 'none';
            return;
        }
        if (cv.width !== bw) cv.width = bw;
        if (cv.height !== bh) cv.height = bh;
        cv.style.display = layer.visible ? 'block' : 'none';
        cv.style.left = `${layer.x}px`;
        cv.style.top = `${layer.y}px`;
        cv.style.opacity = this._shouldDimOutsideCanvasLayer(layer)
            ? '1'
            : String(layer.opacity != null ? layer.opacity : 1);
        cv.style.mixBlendMode = this._blendModeToCssMix(layer);
        cv.style.zIndex = String(i + 1);
        const vctx = cv.getContext('2d', { willReadFrequently: true });
        vctx.clearRect(0, 0, bw, bh);
        const hasStrokeIntermediate =
            this._strokeIntermediateCanvas && this._strokeIntermediateLayerId === layer.id;
        this._paintLayerBufferLocalWithOutsideDim(vctx, layer, (ctx2d) => {
            if (hasStrokeIntermediate && this._strokeIntermediateTool === 'eraser') {
                ctx2d.drawImage(this._strokeIntermediateCanvas, 0, 0);
            } else {
                ctx2d.drawImage(layer.buffer, 0, 0);
                if (hasStrokeIntermediate) {
                    ctx2d.drawImage(this._strokeIntermediateCanvas, 0, 0);
                }
            }
            if (this._shapePreviewCanvas && this._shapePreviewActiveLayerId === layer.id) {
                ctx2d.drawImage(this._shapePreviewCanvas, 0, 0);
            }
        });
        stackEl.appendChild(cv);
        this._syncImportStagingDomView(stackEl, layer, (i + 1) * 10 + 1);
        this._restackStackPreviewOverlays(stackEl);
    },

    /** Composition pixel : calques du projet `p` sur canevas W×H (masques α intégrés si `withLayerMasks`). */
    flattenPixelProjectToCanvas(p, withLayerMasks = true) {
        const out = document.createElement('canvas');
        if (!p || !p.mode.startsWith('pixel')) return out;
        out.width = Math.max(1, p.width);
        out.height = Math.max(1, p.height);
        const ctx = out.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, out.width, out.height);
        (p.layers || []).forEach((l) => this._normalizeDynamicFilterProps(l));
        this._renderPixelLayersStackToContext(ctx, p.layers || [], withLayerMasks);
        return out;
    },

    _drawLayerWithLuminanceMask(ctx, layer, maskFlat, docW, docH) {
        if (typeof MasterPaintWasm !== 'undefined' && MasterPaintWasm.isLoaded) {
            const lw = layer.buffer.width;
            const lh = layer.buffer.height;
            const mw = maskFlat.width;
            const mh = maskFlat.height;
            
            // Get data from canvases
            let layerIm, maskIm;
            try {
                layerIm = layer.buffer.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, lw, lh);
                maskIm = maskFlat.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, mw, mh);
            } catch (e) {
                ctx.drawImage(layer.buffer, layer.x, layer.y);
                return;
            }

            const outIm = MasterPaintWasm.applyLuminanceMask(layerIm, maskIm, layer.x, layer.y, docW, docH);
            if (outIm) {
                if (!this._maskScratch || this._maskScratch.width !== docW || this._maskScratch.height !== docH) {
                    this._maskScratch = document.createElement('canvas');
                    this._maskScratch.width = docW;
                    this._maskScratch.height = docH;
                }
                this._maskScratch.getContext('2d', { willReadFrequently: true }).putImageData(outIm, 0, 0);
                ctx.drawImage(this._maskScratch, 0, 0);
                return;
            }
        }

        // JS Fallback
        if (!this._maskScratch || this._maskScratch.width !== docW || this._maskScratch.height !== docH) {
            this._maskScratch = document.createElement('canvas');
            this._maskScratch.width = docW;
            this._maskScratch.height = docH;
        }
        const ms = this._maskScratch.getContext('2d', { willReadFrequently: true });
        ms.clearRect(0, 0, docW, docH);
        ms.drawImage(layer.buffer, layer.x, layer.y);
        let idL;
        try {
            idL = ms.getImageData(0, 0, docW, docH);
        } catch (e) {
            ctx.drawImage(layer.buffer, layer.x, layer.y);
            return;
        }
        const a = idL.data;
        const mw = maskFlat.width;
        const mh = maskFlat.height;
        const lw = layer.buffer.width;
        const lh = layer.buffer.height;
        const lx = layer.x;
        const ly = layer.y;
        let b;
        try {
            b = maskFlat.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, mw, mh).data;
        } catch (e) {
            ctx.drawImage(layer.buffer, layer.x, layer.y);
            return;
        }
        for (let py = 0; py < docH; py++) {
            for (let px = 0; px < docW; px++) {
                const lpx = px - lx;
                const lpy = py - ly;
                if (lpx < 0 || lpy < 0 || lpx >= lw || lpy >= lh) continue;
                const i = (py * docW + px) * 4;
                if (lpx >= mw || lpy >= mh) continue;
                const j = (lpy * mw + lpx) * 4;
                const lum = ((0.299 * b[j] + 0.587 * b[j + 1] + 0.114 * b[j + 2]) / 255) * (b[j + 3] / 255);
                a[i + 3] = Math.round(a[i + 3] * lum);
            }
        }
        ms.putImageData(idL, 0, 0);
        ctx.drawImage(this._maskScratch, 0, 0);
    },

    _cloneDynamicFilterStack(stack) {
        const out = [];
        const src = Array.isArray(stack) ? stack : [];
        for (let i = 0; i < src.length; i++) {
            const fx = src[i];
            if (!fx) continue;
            const type = this._validDynamicFilterTypes.has(fx.type) ? fx.type : null;
            if (!type) continue;
            const rawRadius =
                fx.radius != null && Number.isFinite(fx.radius)
                    ? fx.radius
                    : fx.intensity != null && Number.isFinite(fx.intensity)
                      ? fx.intensity
                      : 6;
            out.push({
                type,
                radius: Math.max(1, Math.min(32, Math.round(rawRadius)))
            });
            if (out.length >= 8) break;
        }
        return out;
    },

    _defaultDynamicFilterLayerProps() {
        return {
            dynamicFilterEnabled: false,
            dynamicFilterType: null,
            dynamicFilterRadius: 6,
            dynamicFilterStack: [],
            dynamicFilterAlphaPreview: false,
            dynamicFilterMode: 0
        };
    },

    _getNormalizedDynamicFilterStack(layer) {
        if (!layer) return [];
        const fromStack = this._cloneDynamicFilterStack(layer.dynamicFilterStack);
        if (fromStack.length) return fromStack;
        const legacyType = this._validDynamicFilterTypes.has(layer.dynamicFilterType)
            ? layer.dynamicFilterType
            : null;
        if (!legacyType) return [];
        const legacyRadius =
            layer.dynamicFilterRadius != null && Number.isFinite(layer.dynamicFilterRadius)
                ? layer.dynamicFilterRadius
                : 6;
        return [
            {
                type: legacyType,
                radius: Math.max(1, Math.min(32, Math.round(legacyRadius)))
            }
        ];
    },

    _syncLegacyDynamicFilterPropsFromStack(layer) {
        if (!layer) return;
        const first = Array.isArray(layer.dynamicFilterStack) && layer.dynamicFilterStack.length
            ? layer.dynamicFilterStack[0]
            : null;
        if (first) {
            layer.dynamicFilterType = first.type;
            layer.dynamicFilterRadius = first.radius;
        } else {
            layer.dynamicFilterType = null;
            layer.dynamicFilterRadius = 6;
        }
    },

    _snapshotDynamicFilterProps(layer) {
        const probe = {
            ...this._defaultDynamicFilterLayerProps(),
            ...(layer || {})
        };
        this._normalizeDynamicFilterProps(probe);
        return {
            dynamicFilterEnabled: !!probe.dynamicFilterEnabled,
            dynamicFilterType: probe.dynamicFilterType != null ? probe.dynamicFilterType : null,
            dynamicFilterRadius:
                probe.dynamicFilterRadius != null && Number.isFinite(probe.dynamicFilterRadius)
                    ? probe.dynamicFilterRadius
                    : 6,
            dynamicFilterStack: this._cloneDynamicFilterStack(probe.dynamicFilterStack),
            dynamicFilterAlphaPreview: !!probe.dynamicFilterAlphaPreview,
            dynamicFilterMode: Number.isFinite(probe.dynamicFilterMode) ? (probe.dynamicFilterMode | 0) : 0
        };
    },

    _normalizeDynamicFilterProps(layer) {
        if (!layer) return;
        layer.dynamicFilterEnabled = !!layer.dynamicFilterEnabled;
        layer.dynamicFilterStack = this._getNormalizedDynamicFilterStack(layer);
        if (layer.dynamicFilterEnabled && !layer.dynamicFilterStack.length) {
            layer.dynamicFilterStack = [{ type: 'blur', radius: 6 }];
        }
        this._syncLegacyDynamicFilterPropsFromStack(layer);
        if (layer.alphaMaskProjectId && layer.dynamicFilterEnabled) {
            layer.dynamicFilterEnabled = false;
        }
        if (!this._isLiveDynamicFilterLayer(layer)) {
            layer.dynamicFilterAlphaPreview = false;
        } else {
            layer.dynamicFilterAlphaPreview = !!layer.dynamicFilterAlphaPreview;
        }
        layer.dynamicFilterMode = (layer.dynamicFilterMode | 0) === 1 ? 1 : 0;
    },

    /** Calque « filtre dynamique » actif : effet ƒ + type valide (affichage / masque unifié sur le tampon). */
    _isLiveDynamicFilterLayer(layer) {
        if (!layer || !layer.dynamicFilterEnabled) return false;
        const stack = this._getNormalizedDynamicFilterStack(layer);
        return stack.length > 0;
    },

    /**
     * Filtres dynamiques calque : pas de Wasm en direct (trop lourd, bloque l’aperçu).
     * `localStorage illu_dyn_filter_wasm=1` pour réactiver Wasm sur ce pipeline uniquement.
     */
    _dynamicFilterSkipWasmEngine() {
        if (this._dynamicFilterWarmupActive) return false;
        try {
            return localStorage.getItem('illu_dyn_filter_wasm') !== '1';
        } catch (e) {
            return true;
        }
    },

    /** Chaîne CSS filter() pour toute la pile d’effets (aperçu GPU sur canvas DOM). */
    _dynamicFilterCssFilterStringForStack(layer) {
        const stack = this._getNormalizedDynamicFilterStack(layer);
        const parts = [];
        for (let i = 0; i < stack.length; i++) {
            const css = this._dynamicFilterCssFilterString(stack[i].type, stack[i].radius);
            if (css) parts.push(css);
        }
        return parts.length ? parts.join(' ') : 'none';
    },

    /** Mode 1 + effets compatibles ctx.filter : aperçu via pile DOM + filter CSS (pas de composite Wasm). */
    _dynamicFilterLayerDomCssEligible(layer) {
        if (!this._isLiveDynamicFilterLayer(layer)) return true;
        if ((layer.dynamicFilterMode | 0) !== 1) return false;
        if (layer.dynamicFilterAlphaPreview) return false;
        const stack = this._getNormalizedDynamicFilterStack(layer);
        for (let i = 0; i < stack.length; i++) {
            const fx = stack[i];
            if (fx.type === 'pixelate' || fx.type === 'halftone' || fx.type === 'sharpen') return false;
            if (!this._dynamicFilterCssFilterString(fx.type, fx.radius)) return false;
        }
        return true;
    },

    _pixelRenderSkipDynamicFilters() {
        if (this._dynamicFilterWarmupActive) return false;
        return !!(this._deferDynamicFilterRender || this._workspaceLoading);
    },

    _dynamicRenderWorkerAvailable() {
        return !this._dynamicRenderWorkerBroken && typeof Worker !== 'undefined';
    },

    _ensureDynamicRenderWorker() {
        if (!this._dynamicRenderWorkerAvailable()) return null;
        if (this._dynamicRenderWorker) return this._dynamicRenderWorker;
        try {
            console.log('EditorManager: Initializing dynamic-render worker (js/effects/dynamic-render-worker.js)');
            const wk = new Worker('js/effects/dynamic-render-worker.js');
            wk.onmessage = (ev) => {
                const msg = ev.data || {};
                const pending = this._dynamicRenderWorkerPending.get(msg.jobId | 0);
                if (!pending) return;
                this._dynamicRenderWorkerPending.delete(msg.jobId | 0);
                if (msg.type === 'error') {
                    console.error('EditorManager: Dynamic-render worker job error', msg.message);
                    pending.reject(new Error(msg.message || 'dynamic-render-worker failed'));
                    return;
                }
                pending.resolve(msg);
            };
            wk.onerror = (err) => {
                console.error('EditorManager: Dynamic-render worker error', err);
                this._dynamicRenderWorkerBroken = true;
                this._dynamicRenderWorkerPending.forEach((pending) =>
                    pending.reject(new Error('dynamic-render-worker unavailable'))
                );
                this._dynamicRenderWorkerPending.clear();
                if (this._dynamicRenderWorker) {
                    try {
                        this._dynamicRenderWorker.terminate();
                    } catch (e) {
                        /* ignore */
                    }
                }
                this._dynamicRenderWorker = null;
            };
            this._dynamicRenderWorker = wk;
            return wk;
        } catch (e) {
            this._dynamicRenderWorkerBroken = true;
            return null;
        }
    },

    _requestDynamicRenderWorker(payload, transferList) {
        const wk = this._ensureDynamicRenderWorker();
        if (!wk) return Promise.reject(new Error('worker unavailable'));
        const jobId = ++this._dynamicRenderWorkerJobSeq;
        return new Promise((resolve, reject) => {
            this._dynamicRenderWorkerPending.set(jobId, { resolve, reject });
            try {
                wk.postMessage({ ...payload, jobId }, transferList || []);
            } catch (e) {
                this._dynamicRenderWorkerPending.delete(jobId);
                reject(e);
            }
        });
    },

    _sampleBufferSignature(buf) {
        if (!buf || typeof buf.length !== 'number') return '0';
        const len = buf.length | 0;
        if (len <= 0) return '0';
        let acc = len >>> 0;
        const samples = Math.min(64, len);
        const step = Math.max(1, (len / samples) | 0);
        for (let i = 0; i < len; i += step) {
            acc = (((acc << 5) - acc + buf[i]) ^ (i * 2654435761)) >>> 0;
        }
        acc = (((acc << 5) - acc + buf[len - 1]) ^ len) >>> 0;
        return acc.toString(36);
    },

    _drawAsyncDocCanvasToContext(ctx, canvas) {
        if (!canvas) return false;
        ctx.drawImage(canvas, 0, 0);
        return true;
    },

    _ensureAsyncDocCanvas(layer, prop, w, h) {
        let c = layer[prop];
        if (!c || c.width !== w || c.height !== h) {
            c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            layer[prop] = c;
        }
        return c;
    },

    _storeAsyncDocBufferOnLayer(layer, propPrefix, width, height, buffer, key) {
        const can = this._ensureAsyncDocCanvas(layer, `${propPrefix}Canvas`, width, height);
        const cctx = can.getContext('2d', { willReadFrequently: true });
        cctx.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0);
        layer[`${propPrefix}Key`] = key;
    },

    _getLayersBelowMutationSum(layer) {
        let sum = 0;
        for (let i = 0; i < this.layers.length; i++) {
            const l = this.layers[i];
            if (l === layer) break;
            if (!l.visible) continue;
            sum += (l.buffer ? l.buffer._illuMutationCount || 0 : 0);
            sum += (l.x || 0) + (l.y || 0);
            sum += (l.opacity || 1) * 1000;
            const stack = this._getNormalizedDynamicFilterStack(l);
            if (stack) sum += stack.length;
        }
        return Math.floor(sum);
    },

    _dynamicFilterComputeKey(layer, docW, docH, belowMutationSum) {
        const stack = this._getNormalizedDynamicFilterStack(layer);
        const mode = layer.dynamicFilterMode | 0;
        return [
            docW,
            docH,
            layer.x | 0,
            layer.y | 0,
            layer.buffer ? layer.buffer._illuMutationCount || 0 : 0,
            Number.isFinite(layer.opacity) ? Number(layer.opacity).toFixed(4) : '1',
            layer.dynamicFilterAlphaPreview ? 'ap' : 'fx',
            mode === 1 ? 'self' : belowMutationSum,
            JSON.stringify(stack),
            mode
        ].join('|');
    },

    _beginDynamicFilterWorkerJob(layer, docW, docH, belowMutationSum, extractBaseFn) {
        if (!this._dynamicRenderWorkerAvailable()) return null;
        const key = this._dynamicFilterComputeKey(layer, docW, docH, belowMutationSum);
        if (layer._dynAsyncKey === key) return { cached: true, key };
        if (layer._dynAsyncPendingKey === key && layer._dynAsyncPrefetchPromise) {
            return { promise: layer._dynAsyncPrefetchPromise, key };
        }
        
        let layerData;
        try {
            layerData = layer.buffer
                .getContext('2d', { willReadFrequently: true })
                .getImageData(0, 0, layer.buffer.width, layer.buffer.height);
        } catch (e) {
            return null;
        }
        const stack = this._cloneDynamicFilterStack(this._getNormalizedDynamicFilterStack(layer));
        const mode = layer.dynamicFilterMode | 0;
        layer._dynAsyncPendingKey = key;
        const base = mode === 1 ? null : (extractBaseFn ? extractBaseFn() : null);
        const baseTransfer = mode === 1 || !base ? new Uint8ClampedArray(0) : new Uint8ClampedArray(base.data);
        const layerTransfer = new Uint8ClampedArray(layerData.data);
        const promise = this._requestDynamicRenderWorker(
            {
                type: 'dynamicFilterLayer',
                docWidth: docW,
                docHeight: docH,
                layerWidth: layer.buffer.width,
                layerHeight: layer.buffer.height,
                layerX: layer.x | 0,
                layerY: layer.y | 0,
                opacity: layer.opacity != null ? layer.opacity : 1,
                alphaPreview: !!layer.dynamicFilterAlphaPreview,
                mode,
                stack,
                baseBuffer: baseTransfer.buffer,
                layerBuffer: layerTransfer.buffer
            },
            [baseTransfer.buffer, layerTransfer.buffer]
        )
            .then((msg) => {
                if (layer._dynAsyncPendingKey !== key) return msg;
                layer._dynAsyncPendingKey = null;
                layer._dynAsyncPrefetchPromise = null;
                const buf = msg.buffer || (msg.data && msg.data.buffer);
                if (buf) {
                    this._storeAsyncDocBufferOnLayer(
                        layer,
                        '_dynAsync',
                        msg.width | 0,
                        msg.height | 0,
                        buf,
                        key
                    );
                }
                return msg;
            })
            .catch((err) => {
                if (layer._dynAsyncPendingKey === key) layer._dynAsyncPendingKey = null;
                layer._dynAsyncPrefetchPromise = null;
                throw err;
            });
        layer._dynAsyncPrefetchPromise = promise;
        return { promise, key };
    },

    _scheduleAsyncDynamicFilterRender(layer, docW, docH, belowMutationSum, extractBaseFn) {
        if (
            this._pixelRenderSkipDynamicFilters() ||
            this._dynamicFilterSkipWasmEngine() ||
            this._dynamicFilterLivePreviewActive
        ) {
            return false;
        }
        const req = this._beginDynamicFilterWorkerJob(layer, docW, docH, belowMutationSum, extractBaseFn);
        if (!req) return false;
        if (req.cached) return true;
        if (req.promise) {
            req.promise
                .then(() => {
                    if (!this._dynamicFilterWarmupActive) this.render();
                })
                .catch(() => {
                    /* ignore */
                });
            return true;
        }
        return false;
    },

    _composePixelStackBaseBelowIndex(belowIndex, docW, docH) {
        const can = document.createElement('canvas');
        can.width = docW;
        can.height = docH;
        const ctx = can.getContext('2d', { willReadFrequently: true });
        const below = this.layers.slice(0, Math.max(0, belowIndex | 0));
        this._renderPixelLayersStackToContext(ctx, below, true, undefined);
        return ctx.getImageData(0, 0, docW, docH);
    },

    _storeDynamicFilterSyncResult(layer, key, imageData) {
        const copy = new Uint8ClampedArray(imageData.data);
        this._storeAsyncDocBufferOnLayer(
            layer,
            '_dynAsync',
            imageData.width | 0,
            imageData.height | 0,
            copy.buffer,
            key
        );
    },

    async _prefetchDynamicFilterLayerSync(layer, base, docW, docH, key) {
        const mode = layer.dynamicFilterMode | 0;
        if (mode === 1) {
            const cssF = this._dynamicFilterCssFilterStringForStack(layer);
            if (this._dynamicFilterLayerDomCssEligible(layer) && cssF && cssF !== 'none') {
                const lw = layer.buffer.width;
                const lh = layer.buffer.height;
                let layerIm;
                try {
                    layerIm = layer.buffer
                        .getContext('2d', { willReadFrequently: true })
                        .getImageData(0, 0, lw, lh);
                } catch (e) {
                    return;
                }
                const selfFullCan = document.createElement('canvas');
                selfFullCan.width = docW;
                selfFullCan.height = docH;
                const sctx = selfFullCan.getContext('2d', { willReadFrequently: true });
                sctx.putImageData(layerIm, layer.x | 0, layer.y | 0);
                const fullIm = sctx.getImageData(0, 0, docW, docH);
                const filtered = this._applyDynamicFilterWithCtxFilter(fullIm, cssF, docW, docH);
                this._storeDynamicFilterSyncResult(layer, key, filtered);
                return;
            }
            const lw = layer.buffer.width;
            const lh = layer.buffer.height;
            let layerIm;
            try {
                layerIm = layer.buffer
                    .getContext('2d', { willReadFrequently: true })
                    .getImageData(0, 0, lw, lh);
            } catch (e) {
                return;
            }
            const selfFullCan = document.createElement('canvas');
            selfFullCan.width = docW;
            selfFullCan.height = docH;
            const sctx = selfFullCan.getContext('2d', { willReadFrequently: true });
            sctx.putImageData(layerIm, layer.x | 0, layer.y | 0);
            const fullIm = sctx.getImageData(0, 0, docW, docH);
            const filtered = this._applyDynamicFilterToImageDataCopy(fullIm, layer);
            this._storeDynamicFilterSyncResult(layer, key, filtered);
            return;
        }
        if (!base) return;
        const maskIm = this._buildDynamicFilterMaskImageData(layer, docW, docH);
        if (layer.dynamicFilterAlphaPreview) {
            let out;
            try {
                out = new ImageData(docW, docH);
            } catch (e) {
                return;
            }
            const od = out.data;
            const md = maskIm.data;
            for (let i = 0; i < md.length; i += 4) {
                const m = md[i + 3];
                od[i] = m;
                od[i + 1] = m;
                od[i + 2] = m;
                od[i + 3] = 255;
            }
            this._storeDynamicFilterSyncResult(layer, key, out);
            return;
        }
        const blurred = this._applyDynamicFilterToImageDataCopy(base, layer);
        let out = null;
        if (
            !this._dynamicFilterSkipWasmEngine() &&
            typeof window.IlluWebGLMaskBlend !== 'undefined' &&
            window.IlluWebGLMaskBlend &&
            typeof window.IlluWebGLMaskBlend.blend === 'function'
        ) {
            try {
                out = window.IlluWebGLMaskBlend.blend(base, blurred, maskIm);
            } catch (e) {
                out = null;
            }
        }
        if (!out) out = this._blendRgbByDynamicMask(base, blurred, maskIm);
        this._storeDynamicFilterSyncResult(layer, key, out);
    },

    _startDynamicFilterLoadHeartbeat(report, basePct, span, detail) {
        let step = 0;
        const t0 = Date.now();
        const id = setInterval(() => {
            step++;
            const elapsed = Math.min(1, (Date.now() - t0) / 90000);
            const pulse = ((step % 5) / 5) * 0.04;
            const pct = basePct + Math.min(span * 0.96, elapsed * span * 0.92 + pulse);
            report(pct, `${detail}…`);
        }, 280);
        return {
            stop() {
                clearInterval(id);
            }
        };
    },

    async _prefetchDynamicFilterLayer(layer, layerIndex, docW, docH) {
        if (!layer || !this._isLiveDynamicFilterLayer(layer)) return;
        const mode = layer.dynamicFilterMode | 0;
        let base = null;
        if (mode !== 1) {
            base = this._composePixelStackBaseBelowIndex(layerIndex, docW, docH);
            if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);
        }
        layer._dynAsyncKey = null;
        layer._dynAsyncPendingKey = null;
        layer._dynAsyncCanvas = null;
        layer._dynAsyncPrefetchPromise = null;

        let layerData;
        try {
            layerData = layer.buffer
                .getContext('2d', { willReadFrequently: true })
                .getImageData(0, 0, layer.buffer.width, layer.buffer.height);
        } catch (e) {
            return;
        }
        const key = this._dynamicFilterComputeKey(layer, base, docW, docH, layerData);

        const req = this._beginDynamicFilterWorkerJob(layer, base, docW, docH);
        if (req && req.cached) return;
        if (req && req.promise) {
            try {
                await req.promise;
            } catch (e) {
                await this._prefetchDynamicFilterLayerSync(layer, base, docW, docH, key);
            }
            return;
        }
        await this._prefetchDynamicFilterLayerSync(layer, base, docW, docH, key);
        if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);
    },

    _scheduleAsyncAlphaMaskRender(layer, mp, docW, docH) {
        if (this._pixelRenderSkipDynamicFilters()) return false;
        if (!this._dynamicRenderWorkerAvailable()) return false;
        
        const key = [
            docW,
            docH,
            layer.x | 0,
            layer.y | 0,
            layer.buffer ? layer.buffer._illuMutationCount || 0 : 0,
            mp._illuMutationCount || 0
        ].join('|');
        if (layer._alphaAsyncPendingKey === key || layer._alphaAsyncKey === key) return true;
        layer._alphaAsyncPendingKey = key;
        
        const maskFlat = this.flattenPixelProjectToCanvas(mp, false);
        let layerData;
        let maskData;
        try {
            layerData = layer.buffer
                .getContext('2d', { willReadFrequently: true })
                .getImageData(0, 0, layer.buffer.width, layer.buffer.height);
            maskData = maskFlat
                .getContext('2d', { willReadFrequently: true })
                .getImageData(0, 0, maskFlat.width, maskFlat.height);
        } catch (e) {
            layer._alphaAsyncPendingKey = null;
            return false;
        }
        layer._alphaAsyncPendingKey = key;
        const layerTransfer = new Uint8ClampedArray(layerData.data);
        const maskTransfer = new Uint8ClampedArray(maskData.data);
        this._requestDynamicRenderWorker(
            {
                type: 'alphaMaskLayer',
                docWidth: docW,
                docHeight: docH,
                layerWidth: layer.buffer.width,
                layerHeight: layer.buffer.height,
                layerX: layer.x | 0,
                layerY: layer.y | 0,
                maskWidth: maskFlat.width,
                maskHeight: maskFlat.height,
                layerBuffer: layerTransfer.buffer,
                maskBuffer: maskTransfer.buffer
            },
            [layerTransfer.buffer, maskTransfer.buffer]
        )
            .then((msg) => {
                if (layer._alphaAsyncPendingKey !== key) return;
                layer._alphaAsyncPendingKey = null;
                this._storeAsyncDocBufferOnLayer(layer, '_alphaAsync', msg.width | 0, msg.height | 0, msg.buffer, key);
                this.render();
            })
            .catch(() => {
                if (layer._alphaAsyncPendingKey === key) layer._alphaAsyncPendingKey = null;
            });
        return true;
    },

    /**
     * Masque du filtre dynamique : le tampon du calque sert de « carte d’intensité » (comme un masque α).
     * Luminance (Rec. 601) × alpha du pixel × opacité du calque : blanc opaque → effet maximal en dessous,
     * noir ou transparent → pas d’effet.
     */
    _buildDynamicFilterMaskImageData(layer, docW, docH) {
        const out = new ImageData(docW, docH);
        const buf = layer.buffer;
        const bw = buf.width;
        const bh = buf.height;
        const lx0 = layer.x;
        const ly0 = layer.y;
        const op = layer.opacity != null ? layer.opacity : 1;

        if (typeof MasterPaintWasm !== 'undefined' && MasterPaintWasm.isLoaded) {
            let bIm;
            try {
                bIm = buf.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, bw, bh);
            } catch (e) {
                return out;
            }
            const res = MasterPaintWasm.buildDynamicMask(bIm, lx0, ly0, docW, docH, op);
            if (res) return res;
        }

        // JS Fallback
        const od = out.data;
        let bdata = null;
        try {
            bdata = buf.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, bw, bh).data;
        } catch (e) {
            return out;
        }
        for (let py = 0; py < docH; py++) {
            for (let px = 0; px < docW; px++) {
                const lpx = px - lx0;
                const lpy = py - ly0;
                const i = (py * docW + px) * 4;
                if (lpx < 0 || lpy < 0 || lpx >= bw || lpy >= bh) continue;
                const j = (lpy * bw + lpx) * 4;
                const r = bdata[j] / 255;
                const g = bdata[j + 1] / 255;
                const b = bdata[j + 2] / 255;
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const aBuf = bdata[j + 3] / 255;
                const m = lum * aBuf * op;
                od[i + 3] = Math.min(255, Math.max(0, Math.round(m * 255)));
            }
        }
        return out;
    },

    _boxBlurImageDataPass(srcData, w, h, radius, horizontal) {
        const out = new Uint8ClampedArray(srcData.length);
        const r = Math.max(1, Math.min(32, radius | 0));
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sr = 0;
                let sg = 0;
                let sb = 0;
                let cnt = 0;
                for (let d = -r; d <= r; d++) {
                    const nx = horizontal ? Math.max(0, Math.min(w - 1, x + d)) : x;
                    const ny = horizontal ? y : Math.max(0, Math.min(h - 1, y + d));
                    const j = (ny * w + nx) * 4;
                    sr += srcData[j];
                    sg += srcData[j + 1];
                    sb += srcData[j + 2];
                    cnt++;
                }
                const i = (y * w + x) * 4;
                out[i] = sr / cnt;
                out[i + 1] = sg / cnt;
                out[i + 2] = sb / cnt;
                out[i + 3] = srcData[i + 3];
            }
        }
        return out;
    },

    _boxBlurRgbOnly(baseImageData, radius) {
        const w = baseImageData.width;
        const h = baseImageData.height;
        const d0 = baseImageData.data;
        let d = this._boxBlurImageDataPass(d0, w, h, radius, true);
        d = this._boxBlurImageDataPass(d, w, h, radius, false);
        if (radius > 1) {
            d = this._boxBlurImageDataPass(d, w, h, Math.max(1, Math.round(radius * 0.6)), true);
            d = this._boxBlurImageDataPass(d, w, h, Math.max(1, Math.round(radius * 0.6)), false);
        }
        return new ImageData(d, w, h);
    },

    _unsharpRgbImageData(baseImageData, blurRadius, amount) {
        const w = baseImageData.width;
        const h = baseImageData.height;
        const blurred = this._boxBlurRgbOnly(baseImageData, Math.max(1, blurRadius | 0));
        const src = baseImageData.data;
        const bd = blurred.data;
        const out = new ImageData(w, h);
        const od = out.data;
        const a = Math.max(0, Math.min(2.5, amount));
        for (let i = 0; i < src.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                const v = src[i + c] + (src[i + c] - bd[i + c]) * a;
                od[i + c] = Math.min(255, Math.max(0, Math.round(v)));
            }
            od[i + 3] = src[i + 3];
        }
        return out;
    },

    _ensureDynFilterScratch(w, h) {
        if (!this._dynScratchSrc || this._dynScratchSrc.width !== w || this._dynScratchSrc.height !== h) {
            this._dynScratchSrc = document.createElement('canvas');
            this._dynScratchDst = document.createElement('canvas');
            this._dynScratchSrc.width = this._dynScratchDst.width = w;
            this._dynScratchSrc.height = this._dynScratchDst.height = h;
        }
    },

    _ensureDynFilterMini(nw, nh) {
        if (!this._dynScratchMini || this._dynScratchMini.width < nw || this._dynScratchMini.height < nh) {
            this._dynScratchMini = document.createElement('canvas');
            this._dynScratchMini.width = nw;
            this._dynScratchMini.height = nh;
        }
    },

    /**
     * Chaîne pour ctx.filter (même syntaxe que CSS filter). null = pas de filtre CSS (copie ou chemin spécial).
     */
    _dynamicFilterCssFilterString(typ, rad) {
        const r = Math.max(1, Math.min(32, rad | 0));
        switch (typ) {
            case 'blur':
                return `blur(${Math.min(50, r * 0.9)}px)`;
            case 'gaussian':
                return `blur(${Math.min(64, r * 1.5)}px)`;
            case 'sharpen':
                return `contrast(${Math.min(200, 100 + r * 7)}%) saturate(108%)`;
            case 'grayscale':
                return `grayscale(${Math.min(100, 5 + r * 8)}%)`;
            case 'sepia':
                return `sepia(${Math.min(100, 8 + r * 6)}%)`;
            case 'invert':
                return `invert(${Math.min(100, 12 + r * 7)}%)`;
            case 'saturate':
                return `saturate(${Math.max(0, Math.min(400, 30 + r * 20))}%)`;
            case 'brightness':
                return `brightness(${Math.max(0.4, Math.min(2.2, 0.65 + r * 0.055))})`;
            case 'contrast':
                return `contrast(${Math.max(0.5, Math.min(2.2, 0.55 + r * 0.065))})`;
            case 'hue':
                return `hue-rotate(${r * 14}deg)`;
            case 'shadow':
                return `drop-shadow(0px ${Math.round(r * 0.25)}px ${Math.round(r * 0.2)}px rgba(0,0,0,${Math.min(0.9, 0.4 + r * 0.015)}))`;
            default:
                return null;
        }
    },

    _applyDynamicFilterWithCtxFilter(baseImageData, cssFilter, w, h) {
        this._ensureDynFilterScratch(w, h);
        const srcC = this._dynScratchSrc;
        const dstC = this._dynScratchDst;
        const sctx = srcC.getContext('2d', { willReadFrequently: true });
        const dctx = dstC.getContext('2d', { willReadFrequently: true });
        sctx.putImageData(baseImageData, 0, 0);
        dctx.clearRect(0, 0, w, h);
        dctx.filter = cssFilter;
        dctx.drawImage(srcC, 0, 0);
        dctx.filter = 'none';
        return dctx.getImageData(0, 0, w, h);
    },

    _applyDynamicFilterPixelate(baseImageData, rad, w, h) {
        const bs = Math.max(2, Math.min(48, Math.round(rad * 2)));
        this._ensureDynFilterScratch(w, h);
        const srcC = this._dynScratchSrc;
        const dstC = this._dynScratchDst;
        const sctx = srcC.getContext('2d', { willReadFrequently: true });
        const dctx = dstC.getContext('2d', { willReadFrequently: true });
        sctx.putImageData(baseImageData, 0, 0);
        const nw = Math.max(1, Math.floor(w / bs));
        const nh = Math.max(1, Math.floor(h / bs));
        this._ensureDynFilterMini(nw, nh);
        const mini = this._dynScratchMini;
        const mctx = mini.getContext('2d', { willReadFrequently: true });
        mctx.clearRect(0, 0, nw, nh);
        mctx.imageSmoothingEnabled = true;
        mctx.drawImage(srcC, 0, 0, w, h, 0, 0, nw, nh);
        dctx.clearRect(0, 0, w, h);
        dctx.imageSmoothingEnabled = false;
        dctx.drawImage(mini, 0, 0, nw, nh, 0, 0, w, h);
        dctx.imageSmoothingEnabled = true;
        return dctx.getImageData(0, 0, w, h);
    },
_applyDynamicFilterHalftone(baseImageData, rad, w, h) {
        const out = new ImageData(w, h);
        const d = baseImageData.data;
        const od = out.data;
        
        const dotSize = Math.max(2, rad * 1.5);
        const freq = (2 * Math.PI) / dotSize;
        const angle = Math.PI / 4; 
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const r = d[i];
                const g = d[i + 1];
                const b = d[i + 2];
                const a = d[i + 3];

                const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                const rotX = x * cosA - y * sinA;
                const rotY = x * sinA + y * cosA;
                const pattern = (Math.sin(rotX * freq) + Math.sin(rotY * freq)) / 2;
                const threshold = (pattern + 1) / 2;
                const v = luma >= threshold ? 255 : 0;

                od[i] = v;     
                od[i + 1] = v; 
                od[i + 2] = v; 
                od[i + 3] = a; 
            }
        }
        return out;
        },
        
    _applyDynamicFilterStageToImageDataCopy(baseImageData, typ, rad) {
        const w = baseImageData.width;
        const h = baseImageData.height;
        const copyUnchanged = () =>
            new ImageData(new Uint8ClampedArray(baseImageData.data), w, h);

        if (!this._validDynamicFilterTypes.has(typ)) {
            return copyUnchanged();
        }

        if (
            !this._dynamicFilterSkipWasmEngine() &&
            typeof MasterPaintWasm !== 'undefined' &&
            MasterPaintWasm.isLoaded &&
            MasterPaintWasm.isEffectSupported(typ)
        ) {
            const res = MasterPaintWasm.applyFilter(typ, copyUnchanged(), { radius: rad, size: rad, dotSize: rad });
            if (res) return res;
        }

        if (typ === 'pixelate') {
            try {
                return this._applyDynamicFilterPixelate(baseImageData, rad, w, h);
            } catch (e) {
                return copyUnchanged();
            }
        }

        const css = this._dynamicFilterCssFilterString(typ, rad);
        if (css) {
            try {
                return this._applyDynamicFilterWithCtxFilter(baseImageData, css, w, h);
            } catch (e) {
                /* navigateurs très anciens sans ctx.filter */
            }
        }

        const copy = copyUnchanged();
        if (typ === 'blur') {
            return this._boxBlurRgbOnly(copy, rad);
        }
        if (typ === 'gaussian') {
            let cur = copy;
            cur = this._boxBlurRgbOnly(cur, rad);
            return this._boxBlurRgbOnly(cur, Math.max(1, Math.round(rad * 0.55)));
        }
        if (typ === 'sharpen') {
            return this._unsharpRgbImageData(
                baseImageData,
                Math.max(1, Math.min(3, rad)),
                0.55 + rad * 0.08
            );
        }
        if (typ === 'halftone') {
            try {
                return this._applyDynamicFilterHalftone(baseImageData, rad, w, h);
            } catch (e) {
                return copyUnchanged();
            }
        }
        return copy;
    },

    _applyDynamicFilterToImageDataCopy(baseImageData, layer) {
        const stack = this._getNormalizedDynamicFilterStack(layer);
        if (!stack.length) {
            return new ImageData(
                new Uint8ClampedArray(baseImageData.data),
                baseImageData.width,
                baseImageData.height
            );
        }
        let cur = baseImageData;
        for (let i = 0; i < stack.length; i++) {
            const fx = stack[i];
            cur = this._applyDynamicFilterStageToImageDataCopy(cur, fx.type, fx.radius);
        }
        return cur;
    },

    /**
     * Aperçu du poids du filtre dynamique : image N&B plein document (blanc = effet fort,
     * noir = aucun effet). Données brutes du masque (luminance × alpha × opacité), sans appliquer le filtre ƒ.
     */
    _overlayDynamicFilterAlphaPreview(ctx, maskIm) {
        const docW = maskIm.width;
        const docH = maskIm.height;
        
        let out;
        if (
            !this._dynamicFilterSkipWasmEngine() &&
            typeof MasterPaintWasm !== 'undefined' &&
            MasterPaintWasm.isLoaded
        ) {
            out = MasterPaintWasm.grayscaleAlpha(maskIm);
        }

        if (!out) {
            try {
                out = ctx.createImageData(docW, docH);
            } catch (e) {
                return;
            }
            const od = out.data;
            const md = maskIm.data;
            for (let i = 0; i < md.length; i += 4) {
                const m = md[i + 3];
                od[i] = m;
                od[i + 1] = m;
                od[i + 2] = m;
                od[i + 3] = 255;
            }
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.putImageData(out, 0, 0);
        ctx.restore();
    },

    _blendRgbByDynamicMask(base, blurred, maskIm) {
        const w = base.width;
        const h = base.height;
        if (
            !this._dynamicFilterSkipWasmEngine() &&
            typeof MasterPaintWasm !== 'undefined' &&
            MasterPaintWasm.isLoaded
        ) {
            const res = MasterPaintWasm.blendMask(base, blurred, maskIm);
            if (res) return res;
        }
        if (
            typeof window.IlluWebGLMaskBlend !== 'undefined' &&
            window.IlluWebGLMaskBlend &&
            typeof window.IlluWebGLMaskBlend.blend === 'function'
        ) {
            try {
                const gpu = window.IlluWebGLMaskBlend.blend(base, blurred, maskIm);
                if (gpu) return gpu;
            } catch (e) {
                /* repli CPU */
            }
        }
        const out = new ImageData(w, h);
        const od = out.data;
        const bd = base.data;
        const fd = blurred.data;
        const md = maskIm.data;
        const inv255 = 1 / 255;
        for (let i = 0; i < bd.length; i += 4) {
            const m = md[i + 3] * inv255;
            const om = 1 - m;
            od[i] = (bd[i] * om + fd[i] * m + 0.5) | 0;
            od[i + 1] = (bd[i + 1] * om + fd[i + 1] * m + 0.5) | 0;
            od[i + 2] = (bd[i + 2] * om + fd[i + 2] * m + 0.5) | 0;
            od[i + 3] = bd[i + 3];
        }
        return out;
    },

    _drawImportStagingToContext(ctx, layer) {
        if (!layer || !layer.importPlacementPending || !layer.importStagingBuffer || layer._ghostDragHide) return;
        const st = layer.importStagingBuffer;
        const sx = layer.importStagingX | 0;
        const sy = layer.importStagingY | 0;
        ctx.save();
        ctx.globalAlpha = layer.opacity != null ? layer.opacity : 1;
        ctx.globalCompositeOperation = this.getLayerBlendMode(layer);
        ctx.drawImage(st, sx, sy);
        ctx.restore();
    },

    _drawNormalPixelLayerToContext(ctx, layer, docW, docH, withLayerMasks = true) {
        if (!layer.visible || !layer.buffer || layer._ghostDragHide) return;
        ctx.save();
        ctx.globalAlpha = layer.opacity != null ? layer.opacity : 1;
        ctx.globalCompositeOperation = this.getLayerBlendMode(layer);
        const useEraserIntermediateOnly =
            this._strokeIntermediateCanvas &&
            this._strokeIntermediateLayerId === layer.id &&
            this._strokeIntermediateTool === 'eraser';
        if (withLayerMasks && layer.alphaMaskProjectId) {
            const mp = this.projects.find((pr) => pr.id === layer.alphaMaskProjectId);
            if (mp && mp.mode.startsWith('pixel')) {
                if (!this._scheduleAsyncAlphaMaskRender(layer, mp, docW, docH)) {
                    const maskFlat = this.flattenPixelProjectToCanvas(mp, false);
                    this._drawLayerWithLuminanceMask(ctx, layer, maskFlat, docW, docH);
                } else if (!this._drawAsyncDocCanvasToContext(ctx, layer._alphaAsyncCanvas)) {
                    const maskFlat = this.flattenPixelProjectToCanvas(mp, false);
                    this._drawLayerWithLuminanceMask(ctx, layer, maskFlat, docW, docH);
                }
            } else {
                ctx.drawImage(layer.buffer, layer.x, layer.y);
            }
        } else if (useEraserIntermediateOnly) {
            if (this._shouldDimOutsideCanvasLayer(layer)) {
                const lx = Number(layer.x) || 0;
                const ly = Number(layer.y) || 0;
                const paintEraser = (c2d) => {
                    c2d.save();
                    c2d.translate(lx, ly);
                    c2d.drawImage(this._strokeIntermediateCanvas, 0, 0);
                    c2d.restore();
                };
                const op = Math.max(0, Math.min(1, layer.opacity != null ? layer.opacity : 1));
                const outsideOp = op * this._outsideCanvasPreviewOpacity();
                ctx.globalAlpha = Math.max(0, Math.min(1, outsideOp));
                paintEraser(ctx);
                ctx.save();
                ctx.globalAlpha = op;
                ctx.beginPath();
                ctx.rect(0, 0, docW, docH);
                ctx.clip();
                paintEraser(ctx);
                ctx.restore();
            } else {
                ctx.drawImage(this._strokeIntermediateCanvas, layer.x, layer.y);
            }
        } else if (this._shouldDimOutsideCanvasLayer(layer)) {
            const lx = Number(layer.x) || 0;
            const ly = Number(layer.y) || 0;
            const paintStack = (c2d) => {
                c2d.save();
                c2d.translate(lx, ly);
                c2d.drawImage(layer.buffer, 0, 0);
                if (this._strokeIntermediateCanvas && this._strokeIntermediateLayerId === layer.id) {
                    if (this._strokeIntermediateTool !== 'eraser') {
                        c2d.drawImage(this._strokeIntermediateCanvas, 0, 0);
                    }
                }
                if (this._shapePreviewCanvas && this._shapePreviewActiveLayerId === layer.id) {
                    c2d.drawImage(this._shapePreviewCanvas, 0, 0);
                }
                c2d.restore();
            };
            const op = Math.max(0, Math.min(1, layer.opacity != null ? layer.opacity : 1));
            const outsideOp = op * this._outsideCanvasPreviewOpacity();
            ctx.globalAlpha = Math.max(0, Math.min(1, outsideOp));
            paintStack(ctx);
            ctx.save();
            ctx.globalAlpha = op;
            ctx.beginPath();
            ctx.rect(0, 0, docW, docH);
            ctx.clip();
            paintStack(ctx);
            ctx.restore();
        } else {
            ctx.drawImage(layer.buffer, layer.x, layer.y);
        }
        if (!this._shouldDimOutsideCanvasLayer(layer)) {
            if (this._strokeIntermediateCanvas && this._strokeIntermediateLayerId === layer.id) {
                if (this._strokeIntermediateTool !== 'eraser') {
                    ctx.drawImage(this._strokeIntermediateCanvas, layer.x, layer.y);
                }
            }
            if (this._shapePreviewCanvas && this._shapePreviewActiveLayerId === layer.id) {
                ctx.drawImage(this._shapePreviewCanvas, layer.x, layer.y);
            }
        }
        this._drawImportStagingToContext(ctx, layer);
        ctx.restore();
    },

    /** Mode 1 (effet sur ce calque) : ctx.filter CSS si possible, sinon ImageData + JS. */
    _drawDynamicFilterMode1ToContext(ctx, layer, docW, docH) {
        const cssF = this._dynamicFilterCssFilterStringForStack(layer);
        if (this._dynamicFilterLayerDomCssEligible(layer) && cssF && cssF !== 'none') {
            ctx.save();
            ctx.globalAlpha = layer.opacity != null ? layer.opacity : 1;
            ctx.globalCompositeOperation = this.getLayerBlendMode(layer);
            ctx.filter = cssF;
            ctx.drawImage(layer.buffer, layer.x | 0, layer.y | 0);
            ctx.filter = 'none';
            ctx.restore();
            return;
        }
        const lw = layer.buffer.width;
        const lh = layer.buffer.height;
        let layerIm;
        try {
            layerIm = layer.buffer.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, lw, lh);
        } catch (e) {
            this._drawNormalPixelLayerToContext(ctx, layer, docW, docH, true);
            return;
        }
        const selfFullCan = document.createElement('canvas');
        selfFullCan.width = docW;
        selfFullCan.height = docH;
        const sctx = selfFullCan.getContext('2d', { willReadFrequently: true });
        sctx.putImageData(layerIm, layer.x, layer.y);
        const fullIm = sctx.getImageData(0, 0, docW, docH);
        const filtered = this._applyDynamicFilterToImageDataCopy(fullIm, layer);
        ctx.save();
        ctx.globalAlpha = layer.opacity != null ? layer.opacity : 1;
        ctx.globalCompositeOperation = this.getLayerBlendMode(layer);
        const resCan = document.createElement('canvas');
        resCan.width = docW;
        resCan.height = docH;
        resCan.getContext('2d', { willReadFrequently: true }).putImageData(filtered, 0, 0);
        ctx.drawImage(resCan, 0, 0);
        ctx.restore();
    },

    /**
     * Composition pixel : calques empilés, avec prise en charge des calques « filtre dynamique »
     * (effet sur tout ce qui est sous le calque, masqué par luminance × alpha du tampon + opacité).
     * @param {{ strokeLightRender?: boolean }} [opts] — Si true : pas de filtre dynamique ni masque α (aperçu rapide).
     */
    _renderPixelLayersStackToContext(ctx, layers, withLayerMasks = true, opts) {
        const docW = ctx.canvas.width;
        const docH = ctx.canvas.height;
        const strokeLight = !!(opts && opts.strokeLightRender) || this._pixelRenderSkipDynamicFilters();
        const useMasks = withLayerMasks && !strokeLight;
        for (let li = 0; li < layers.length; li++) {
            const layer = layers[li];
            if (!layer.visible || !layer.buffer) continue;
            if (layer._ghostDragHide) continue;

            this._normalizeDynamicFilterProps(layer);
            const mode = layer.dynamicFilterMode | 0;

            if (this._isLiveDynamicFilterLayer(layer)) {
                if (strokeLight) {
                    this._drawNormalPixelLayerToContext(ctx, layer, docW, docH, false);
                    continue;
                }

                if (mode === 1) {
                    // Mode 1: effet sur ce calque — CSS filter en direct si possible (pas de worker/Wasm)
                    if (!this._scheduleAsyncDynamicFilterRender(layer, null, docW, docH)) {
                        this._drawDynamicFilterMode1ToContext(ctx, layer, docW, docH);
                    } else if (layer._dynAsyncCanvas) {
                        ctx.save();
                        ctx.globalAlpha = layer.opacity != null ? layer.opacity : 1;
                        ctx.globalCompositeOperation = this.getLayerBlendMode(layer);
                        ctx.drawImage(layer._dynAsyncCanvas, 0, 0);
                        ctx.restore();
                    }
                    continue;
                }

                // Mode 0: Effect on Below (Adjustment-like)
                let base = null;
                const extractBaseFn = () => {
                    if (!base) {
                        try {
                            base = ctx.getImageData(0, 0, docW, docH);
                        } catch (e) {
                            base = null;
                        }
                    }
                    return base;
                };
                const belowMutationSum = this._getLayersBelowMutationSum(layer);
                if (!this._scheduleAsyncDynamicFilterRender(layer, docW, docH, belowMutationSum, extractBaseFn)) {
                    extractBaseFn(); // Ensure base is extracted for sync fallback
                    if (!base) continue;
                    const maskIm = this._buildDynamicFilterMaskImageData(layer, docW, docH);
                    if (layer.dynamicFilterAlphaPreview) {
                        this._overlayDynamicFilterAlphaPreview(ctx, maskIm);
                        continue;
                    }
                    const blurred = this._applyDynamicFilterToImageDataCopy(base, layer);
                    let gpuCan = null;
                    if (
                        !this._dynamicFilterSkipWasmEngine() &&
                        typeof window.IlluWebGLMaskBlend !== 'undefined' &&
                        window.IlluWebGLMaskBlend &&
                        typeof window.IlluWebGLMaskBlend.drawBlendedCanvas === 'function'
                    ) {
                        try {
                            gpuCan = window.IlluWebGLMaskBlend.drawBlendedCanvas(base, blurred, maskIm);
                        } catch (e) {
                            gpuCan = null;
                        }
                    }
                    if (gpuCan) ctx.drawImage(gpuCan, 0, 0);
                    else {
                        const out = this._blendRgbByDynamicMask(base, blurred, maskIm);
                        ctx.putImageData(out, 0, 0);
                    }
                } else if (!this._drawAsyncDocCanvasToContext(ctx, layer._dynAsyncCanvas)) {
                    const maskIm = this._buildDynamicFilterMaskImageData(layer, docW, docH);
                    if (layer.dynamicFilterAlphaPreview) {
                        this._overlayDynamicFilterAlphaPreview(ctx, maskIm);
                    } else {
                        const blurred = this._applyDynamicFilterToImageDataCopy(base, layer);
                        const out = this._blendRgbByDynamicMask(base, blurred, maskIm);
                        ctx.putImageData(out, 0, 0);
                    }
                }
                continue;
            }

            this._drawNormalPixelLayerToContext(ctx, layer, docW, docH, useMasks);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    },

    flattenActivePixelDocument() {
        if (!this.activeProject || !this.isPixelMode) {
            const c = document.createElement('canvas');
            c.width = 1;
            c.height = 1;
            return c;
        }
        return this.flattenPixelProjectToCanvas(this.activeProject, true);
    },

    /**
     * Programme une passe miniatures complète après inactivité (tous les calques).
     * @param {number} [delayMs] défaut THUMB_IDLE_MS.
     */
    scheduleUiThumbnailsRefresh(delayMs) {
        if (!this._uiThumbsVisible()) return;
        if (this.mode === 'vector' && window._illuVectorDragActive) return;
        const delay = delayMs != null ? delayMs : this.THUMB_IDLE_MS;
        const now = performance.now();
        if (this._thumbIdleTimer != null) {
            // Si le premier rendez-vous date de plus de 1200 ms, on laisse s'exécuter
            // pour garantir une mise à jour périodique même pendant un dessin continu.
            if (this._thumbFirstScheduledTime != null && (now - this._thumbFirstScheduledTime) > 1200) {
                return;
            }
            clearTimeout(this._thumbIdleTimer);
            this._thumbIdleTimer = null;
        } else {
            this._thumbFirstScheduledTime = now;
        }
        this._thumbIdleTimer = window.setTimeout(() => {
            this._thumbIdleTimer = null;
            this._thumbFirstScheduledTime = null;
            this._startThumbnailIdlePass();
        }, delay);
    },

    /**
     * Invalide timers + passe séquentielle en cours ; à appeler au début d’une interaction sur la toile.
     */
    cancelDeferredThumbnails() {
        this._thumbPassGeneration = (this._thumbPassGeneration | 0) + 1;
        this._thumbPassSingleLayerIndex = null;
        this._thumbFirstScheduledTime = null;
        if (this._thumbIdleTimer != null) {
            clearTimeout(this._thumbIdleTimer);
            this._thumbIdleTimer = null;
        }
        if (this._thumbSeqTimer != null) {
            clearTimeout(this._thumbSeqTimer);
            this._thumbSeqTimer = null;
        }
    },

    /**
     * Après une action (relâchement, fin d’effet…) : miniature du calque concerné uniquement (défaut : actif),
     * plus l’onglet document, pour éviter de régénérer toute la liste à chaque coup.
     * @param {{ uiThumbnailsAllLayers?: boolean, layerIndex?: number }} [opts]
     */
    flushUiThumbnailsRefresh(opts) {
        if (!this._uiThumbsVisible()) return;
        this.cancelDeferredThumbnails();
        const o = opts && typeof opts === 'object' ? opts : {};
        let scope;
        if (o.uiThumbnailsAllLayers === true) {
            scope = 'all';
        } else if (Number.isInteger(o.layerIndex) && o.layerIndex >= 0) {
            scope = o.layerIndex;
        } else {
            scope = this.activeLayerIndex;
        }
        const self = this;
        this._thumbIdleTimer = window.setTimeout(() => {
            self._thumbIdleTimer = null;
            self._runThumbnailFlushPass(scope);
        }, this.THUMB_IDLE_AFTER_FLUSH_MS);
    },

    /** Passe après flush : scope capturé (évite les conflits avec la replanification idle). */
    _runThumbnailFlushPass(scope) {
        if (!this._uiThumbsVisible()) return;
        this._thumbPassGeneration = (this._thumbPassGeneration | 0) + 1;
        const gen = this._thumbPassGeneration;
        if (scope === 'all') {
            this._thumbPassSingleLayerIndex = null;
        } else if (typeof scope === 'number' && scope >= 0) {
            this._thumbPassSingleLayerIndex = scope;
        } else {
            this._thumbPassSingleLayerIndex = this.activeLayerIndex;
        }
        this._queueThumbSeqStep(gen, 'layers', 0, 0);
    },

    /** Inactivité : miniature de chaque calque (synchronisation liste complète). */
    _startThumbnailIdlePass() {
        if (!this._uiThumbsVisible()) return;
        this._thumbPassGeneration = (this._thumbPassGeneration | 0) + 1;
        const gen = this._thumbPassGeneration;
        this._thumbPassSingleLayerIndex = null;
        this._queueThumbSeqStep(gen, 'layers', 0, 0);
    },

    _queueThumbSeqStep(gen, stage, index, delayMs) {
        const self = this;
        if (this._thumbSeqTimer != null) {
            clearTimeout(this._thumbSeqTimer);
            this._thumbSeqTimer = null;
        }
        this._thumbSeqTimer = window.setTimeout(() => {
            this._thumbSeqTimer = null;
            self._runThumbSeqStep(gen, stage, index);
        }, delayMs);
    },

    _runThumbSeqStep(gen, stage, index) {
        if (gen !== this._thumbPassGeneration) return;
        const gap = this.THUMB_SEQ_GAP_MS;
        const lowSize = this.THUMB_LAYER_INTERNAL_SIZE;
        if (stage === 'layers') {
            const list = document.getElementById('layers-list');

            // --- Mode vecteur : miniatures async par blob SVG ---
            if (list && !this.isPixelMode) {
                const items = [...list.children];
                if (index >= items.length) {
                    this._queueThumbSeqStep(gen, 'tab', 0, gap);
                    return;
                }
                const item = items[index];
                const idx = parseInt(item.dataset.layerIndex, 10);
                if (!Number.isNaN(idx)) {
                    const layer = this.layers[idx];
                    const img = item.querySelector('img.layer-thumb');
                    if (img && layer) {
                        this._getVectorLayerThumbnailDataUrl(layer).then((u) => {
                            if (gen === this._thumbPassGeneration && u) {
                                layer._cachedThumbUrl = u;
                                img.src = u;
                            }
                        }).catch(() => {});
                    }
                }
                this._queueThumbSeqStep(gen, 'layers', index + 1, gap * 2);
                return;
            }

            if (!list || !this.isPixelMode) {
                this._thumbPassSingleLayerIndex = null;
                this._queueThumbSeqStep(gen, 'tab', 0, gap);
                return;
            }
            const items = [...list.children];
            const single = this._thumbPassSingleLayerIndex;
            if (single != null) {
                this._thumbPassSingleLayerIndex = null;
                if (single >= 0 && single < items.length) {
                    const item = items[single];
                    const idx = parseInt(item.dataset.layerIndex, 10);
                    if (!Number.isNaN(idx)) {
                        const layer = this.layers[idx];
                        const img = item.querySelector('img.layer-thumb');
                        if (img && layer) {
                            const u = this.getLayerThumbnailDataUrl(layer, lowSize, true);
                            if (u) {
                                layer._cachedThumbUrl = u;
                                img.src = u;
                            }
                        }
                    }
                }
                this._queueThumbSeqStep(gen, 'tab', 0, gap);
                return;
            }
            if (index >= items.length) {
                this._queueThumbSeqStep(gen, 'tab', 0, gap);
                return;
            }
            const item = items[index];
            const idx = parseInt(item.dataset.layerIndex, 10);
            if (!Number.isNaN(idx)) {
                const layer = this.layers[idx];
                const img = item.querySelector('img.layer-thumb');
                if (img && layer) {
                    const u = this.getLayerThumbnailDataUrl(layer, lowSize, true);
                    if (u) {
                        layer._cachedThumbUrl = u;
                        img.src = u;
                    }
                }
            }
            this._queueThumbSeqStep(gen, 'layers', index + 1, gap);
            return;
        }
        if (stage === 'tab') {
            const bar = document.getElementById('tab-bar');
            if (!bar) return;
            const projects = this.projects || [];
            if (index >= projects.length) return;
            const proj = projects[index];
            const tab = bar.querySelector(`[data-project-index="${index}"]`);
            const img = tab && tab.querySelector ? tab.querySelector('img.tab-thumb') : null;
            if (!img || !proj) return;
             if (proj.mode === 'vector') {
                this._getVectorProjectThumbnailDataUrl(proj).then((u) => {
                    if (gen === this._thumbPassGeneration && u) {
                        img.src = u;
                        if (index === this.activeProjectIndex && typeof window.updateBodyBackgroundFromActiveTabThumb === 'function') {
                            window.updateBodyBackgroundFromActiveTabThumb();
                        }
                    }
                }).catch(() => {});
                this._queueThumbSeqStep(gen, 'tab', index + 1, gap);
                return;
            }
            if (proj.mode.startsWith('pixel')) {
                const u = this.getProjectTabThumbnailDataUrl(proj);
                if (u) {
                    img.src = u;
                    if (index === this.activeProjectIndex && typeof window.updateBodyBackgroundFromActiveTabThumb === 'function') {
                        window.updateBodyBackgroundFromActiveTabThumb();
                    }
                }
            }
            this._queueThumbSeqStep(gen, 'tab', index + 1, gap);
        }
    },

    _getLayerCroppedRectFast(srcCanvas, projW, projH) {
        const cw = srcCanvas.width;
        const ch = srcCanvas.height;
        if (cw <= 0 || ch <= 0) return null;

        const maxD = 256;
        let scale = 1;
        let tCan = srcCanvas;
        
        if (cw > maxD || ch > maxD) {
            scale = Math.min(maxD / cw, maxD / ch);
            tCan = document.createElement('canvas');
            tCan.width = Math.max(1, Math.ceil(cw * scale));
            tCan.height = Math.max(1, Math.ceil(ch * scale));
            const tc = tCan.getContext('2d', { willReadFrequently: true });
            tc.imageSmoothingEnabled = true;
            tc.drawImage(srcCanvas, 0, 0, tCan.width, tCan.height);
        }

        const tw = tCan.width;
        const th = tCan.height;
        let imgData;
        try {
            imgData = tCan.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, tw, th);
        } catch(e) {
            return null;
        }
        
        const d32 = new Uint32Array(imgData.data.buffer);
        const bg32 = d32[0];
        const tr32 = d32[tw - 1];
        const bl32 = d32[(th - 1) * tw];
        const br32 = d32[(th - 1) * tw + tw - 1];
        const cornersMatch = (bg32 === tr32) && (bg32 === bl32) && (bg32 === br32);
        
        let minX = tw, minY = th, maxX = -1, maxY = -1;
        let found = false;
        
        for (let y = 0; y < th; y++) {
            const offset = y * tw;
            for (let x = 0; x < tw; x++) {
                const p = d32[offset + x];
                let active = false;
                if (cornersMatch) {
                    if (p !== bg32) {
                        const r1 = p & 0xff, g1 = (p >> 8) & 0xff, b1 = (p >> 16) & 0xff, a1 = (p >>> 24);
                        const r2 = bg32 & 0xff, g2 = (bg32 >> 8) & 0xff, b2 = (bg32 >> 16) & 0xff, a2 = (bg32 >>> 24);
                        if (Math.abs(r1-r2)>3 || Math.abs(g1-g2)>3 || Math.abs(b1-b2)>3 || Math.abs(a1-a2)>3) {
                            active = true;
                        }
                    }
                } else {
                    active = (p >>> 24) > 3; 
                }
                
                if (active) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }

        if (!found) return null;

        const bx = minX / scale;
        const by = minY / scale;
        const bw = (maxX - minX + 1) / scale;
        const bh = (maxY - minY + 1) / scale;

        const R = projW / projH;
        const padding = 1.0;
        let cw2 = bw * padding;
        let ch2 = bh * padding;
        
        // La zone croppée ne doit JAMAIS dépasser la taille du projet.
        // Cela évite de rajouter des marges ou de donner l'impression que le calque a été agrandi.
        if (cw2 > projW) cw2 = projW;
        if (ch2 > projH) ch2 = projH;

        const minW = projW * 0.05;
        const minH = projH * 0.05;
        if (cw2 < minW) cw2 = minW;
        if (ch2 < minH) ch2 = minH;

        if (cw2 / ch2 > R) {
            ch2 = cw2 / R;
        } else {
            cw2 = ch2 * R;
        }

        // Sécurité finale pour être certain que la box ne dépasse pas les dimensions max
        if (cw2 > projW || ch2 > projH) {
            if (cw2 / projW > ch2 / projH) {
                cw2 = projW;
                ch2 = cw2 / R;
            } else {
                ch2 = projH;
                cw2 = ch2 * R;
            }
        }

        const cx = bx + bw / 2;
        const cy = by + bh / 2;

        return {
            sx: Math.floor(cx - cw2 / 2),
            sy: Math.floor(cy - ch2 / 2),
            sw: Math.ceil(cw2),
            sh: Math.ceil(ch2)
        };
    },

    getLayerThumbnailDataUrl(layer, maxDim = 28, useLowQualityJpeg = false) {
        const empty =
            'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        if (!layer || !layer.buffer) return empty;
        const cw = layer.buffer.width;
        const ch = layer.buffer.height;
        if (cw < 1 || ch < 1) return empty;
        let sx = 0, sy = 0, sw = cw, sh = ch;
        const proj = this.activeProject;
        const projW = Math.max(1, proj ? proj.width : cw);
        const projH = Math.max(1, proj ? proj.height : ch);
        const { width: tw, height: th } = this._thumbFitSize(projW, projH, maxDim);

        let src = layer.buffer;
        if (this._isLiveDynamicFilterLayer(layer)) {
            try {
                const tc = document.createElement('canvas');
                tc.width = cw;
                tc.height = ch;
                const tctx = tc.getContext('2d', { willReadFrequently: true });
                const id = tctx.getImageData(0, 0, cw, ch);
                const raw = layer.buffer.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cw, ch);
                id.data.set(raw.data);
                const d = id.data;
                for (let i = 0; i < d.length; i += 4) {
                    const r0 = d[i];
                    const g0 = d[i + 1];
                    const b0 = d[i + 2];
                    const lum = (0.299 * r0 + 0.587 * g0 + 0.114 * b0) / 255;
                    const aBuf = d[i + 3] / 255;
                    const m = Math.min(255, Math.max(0, Math.round(255 * lum * aBuf)));
                    d[i] = m;
                    d[i + 1] = m;
                    d[i + 2] = m;
                    d[i + 3] = 255;
                }
                tctx.putImageData(id, 0, 0);
                src = tc;
            } catch (e) {
                src = layer.buffer;
            }
        }

        const crop = this._getLayerCroppedRectFast(src, projW, projH);
        if (!crop) return empty;

        const sc = document.createElement('canvas');
        sc.width = tw;
        sc.height = th;
        const sctx = sc.getContext('2d', { willReadFrequently: true });
        sctx.imageSmoothingEnabled = true;
        sctx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, tw, th);
        try {
            // For thumbnails with transparency, we MUST use PNG
            return sc.toDataURL('image/png');
        } catch (e) {
            try {
                return sc.toDataURL('image/png');
            } catch (e2) {
                return empty;
            }
        }
    },

    /**
     * Génère une miniature pour un calque vecteur en rendant son groupe SVG dans un canvas.
     * Retourne une Promise<string> (data URL PNG ou gif transparent si vide).
     */
    async _getVectorProjectThumbnailDataUrl(project) {
        const empty = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        const p = project || this.activeProject;
        if (!p || p.mode !== 'vector') return empty;
        let groupContent = '';
        if (p === this.activeProject) {
            const layersRoot = document.getElementById('svg-layers');
            groupContent = layersRoot ? layersRoot.innerHTML : '';
        } else {
            groupContent = p.svgData != null ? String(p.svgData) : '';
        }
        if (!groupContent.trim()) return empty;
        const W = Math.max(1, p.width || 1280);
        const H = Math.max(1, p.height || 720);
        let defsContent = '';
        if (p.illuSpriteDefsData != null && String(p.illuSpriteDefsData).trim()) {
            defsContent = `<defs>${p.illuSpriteDefsData}</defs>`;
        } else if (p === this.activeProject) {
            const defsEl = document.getElementById('vector-doc-defs');
            defsContent = defsEl ? `<defs>${defsEl.innerHTML}</defs>` : '';
        }
        const svgMarkup = [
            `<?xml version="1.0" encoding="UTF-8"?>`,
            `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
            ` width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
            defsContent,
            `<g>`,
            groupContent,
            `</g>`,
            `</svg>`
        ].join('');
        const maxDim = this.THUMB_TAB_MAX_DIM;
        const ratio = Math.min(maxDim / W, maxDim / H, 1);
        const tw = Math.max(1, Math.round(W * ratio));
        const th = Math.max(1, Math.round(H * ratio));
        return new Promise((resolve) => {
            const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                try {
                    const sc = document.createElement('canvas');
                    sc.width = tw;
                    sc.height = th;
                    const sctx = sc.getContext('2d');
                    sctx.imageSmoothingEnabled = true;
                    sctx.drawImage(img, 0, 0, W, H, 0, 0, tw, th);
                    resolve(sc.toDataURL('image/png'));
                } catch (e) {
                    resolve(empty);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(empty);
            };
            img.src = url;
        });
    },

    async _getVectorLayerThumbnailDataUrl(layer) {
        const empty = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        if (!layer) return empty;
        const p = this.activeProject;
        if (!p || p.mode !== 'vector') return empty;

        const W = Math.max(1, p.width || 1280);
        const H = Math.max(1, p.height || 720);
        const maxDim = 36;
        const ratio = Math.min(maxDim / W, maxDim / H, 1);
        const tw = Math.max(1, Math.round(W * ratio));
        const th = Math.max(1, Math.round(H * ratio));

        // Récupère le groupe SVG de ce calque dans le DOM
        const layerGroup = document.getElementById(`layer-${layer.id}`);
        const groupContent = layerGroup ? layerGroup.innerHTML : '';
        if (!groupContent || !groupContent.trim()) return empty;

        if (layerGroup) {
            const embeds = layerGroup.querySelectorAll('image[data-illu-bitmap-embed="1"]');
            const onlyBitmap =
                embeds.length === 1 &&
                layerGroup.querySelectorAll(':scope > *').length === 1;
            if (onlyBitmap) {
                const imgEl = embeds[0];
                const href =
                    imgEl.getAttribute('href') ||
                    imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                if (href) {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            try {
                                const sc = document.createElement('canvas');
                                sc.width = tw;
                                sc.height = th;
                                const sctx = sc.getContext('2d');
                                sctx.fillStyle = '#ffffff';
                                sctx.fillRect(0, 0, tw, th);
                                const scale = Math.min(tw / W, th / H);
                                const ix = (parseFloat(imgEl.getAttribute('x')) || 0) * scale;
                                const iy = (parseFloat(imgEl.getAttribute('y')) || 0) * scale;
                                const iw =
                                    (parseFloat(imgEl.getAttribute('width')) || img.naturalWidth) *
                                    scale;
                                const ih =
                                    (parseFloat(imgEl.getAttribute('height')) || img.naturalHeight) *
                                    scale;
                                sctx.drawImage(img, ix, iy, iw, ih);
                                resolve(sc.toDataURL('image/png'));
                            } catch (e) {
                                resolve(empty);
                            }
                        };
                        img.onerror = () => resolve(empty);
                        img.src = href;
                    });
                }
            }
        }

        // Defs partagées (gradients, filtres, clips…)
        const defsEl = document.getElementById('vector-doc-defs');
        const defsContent = defsEl ? `<defs>${defsEl.innerHTML}</defs>` : '';

        // Construit un SVG minimal contenant uniquement ce calque
        const opacity = layer.opacity != null ? layer.opacity : 1;
        const svgMarkup = [
            `<?xml version="1.0" encoding="UTF-8"?>`,
            `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
            ` width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
            defsContent,
            `<g opacity="${opacity}">`,
            groupContent,
            `</g>`,
            `</svg>`
        ].join('');

        return new Promise((resolve) => {
            const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                try {
                    const tmpMax = 256;
                    const tRatio = Math.min(tmpMax / W, tmpMax / H, 1);
                    const tW = Math.max(1, Math.round(W * tRatio));
                    const tH = Math.max(1, Math.round(H * tRatio));
                    
                    const tmp = document.createElement('canvas');
                    tmp.width = tW; tmp.height = tH;
                    const tctx = tmp.getContext('2d', { willReadFrequently: true });
                    tctx.imageSmoothingEnabled = true;
                    tctx.drawImage(img, 0, 0, W, H, 0, 0, tW, tH);

                    // Crop detection on the temporary canvas
                    const crop = window.EditorManager._getLayerCroppedRectFast(tmp, W, H);
                    if (!crop) {
                        resolve(empty);
                        return;
                    }
                    
                    // crop.sx, sy etc. are relative to `tmp` canvas. We map them back to original W, H
                    const realSx = (crop.sx / tW) * W;
                    const realSy = (crop.sy / tH) * H;
                    const realSw = (crop.sw / tW) * W;
                    const realSh = (crop.sh / tH) * H;

                    const sc = document.createElement('canvas');
                    sc.width = tw; sc.height = th;
                    const sctx = sc.getContext('2d');
                    sctx.imageSmoothingEnabled = true;
                    sctx.drawImage(img, realSx, realSy, realSw, realSh, 0, 0, tw, th);
                    resolve(sc.toDataURL('image/png'));
                } catch (e) {
                    resolve(empty);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(empty);
            };
            img.src = url;
        });
    },

    getProjectTabThumbnailDataUrl(p) {
        const empty =
            'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        if (!p || !p.mode.startsWith('pixel')) return null;
        const active = this.activeProject;
        const editingThisParentMask =
            active &&
            active.role === 'layerAlphaMask' &&
            p.role !== 'layerAlphaMask' &&
            active.parentProjectId === p.id;
        const flat = this.flattenPixelProjectToCanvas(p, !editingThisParentMask);
        const max = this.THUMB_TAB_MAX_DIM;
        const ratio = Math.min(max / p.width, max / p.height, 1);
        const tw = Math.max(1, Math.round(p.width * ratio));
        const th = Math.max(1, Math.round(p.height * ratio));
        const sc = document.createElement('canvas');
        sc.width = tw;
        sc.height = th;
        const x = sc.getContext('2d', { willReadFrequently: true });
        x.imageSmoothingEnabled = true;
        // Removed grey background to support transparency
        x.drawImage(flat, 0, 0, p.width, p.height, 0, 0, tw, th);
        try {
            // For thumbnails with transparency, we MUST use PNG
            return sc.toDataURL('image/png');
        } catch (e) {
            try {
                return sc.toDataURL('image/png');
            } catch (e2) {
                return empty;
            }
        }
    },

    /**
     * Crée un projet masque lié au calque (blanc = opaque). Ne change pas l’onglet actif.
     * @returns {{ maskProject: object, maskLayer: object } | null}
     */
    _addLinkedAlphaMaskProject(layer) {
        const parent = this.activeProject;
        if (!parent || !parent.mode.startsWith('pixel') || parent.role === 'layerAlphaMask' || !layer?.buffer) return null;
        const lw = Math.max(1, layer.buffer.width);
        const lh = Math.max(1, layer.buffer.height);
        const maskId = Date.now() + Math.floor(Math.random() * 1e7);
        const white = document.createElement('canvas');
        white.width = lw;
        white.height = lh;
        const wx = white.getContext('2d', { willReadFrequently: true });
        wx.fillStyle = '#ffffff';
        wx.fillRect(0, 0, lw, lh);

        const maskP = {
            id: maskId,
            name: `α ${layer.name}`,
            mode: 'pixel',
            width: lw,
            height: lh,
            layers: [
                {
                    id: maskId + 1,
                    name: 'Masque',
                    visible: true,
                    x: 0,
                    y: 0,
                    opacity: 1,
                    blendMode: 'source-over',
                    buffer: white,
                    alphaMaskProjectId: null
                }
            ],
            activeLayerIndex: 0,
            history: [],
            historyIndex: -1,
            zoomLevel: parent.zoomLevel || 1,
            canvasPanX: parent.canvasPanX || 0,
            canvasPanY: parent.canvasPanY || 0,
            canvasData: null,
            svgData: '',
            pixelSnapshot: null,
            role: 'layerAlphaMask',
            parentProjectId: parent.id,
            parentLayerId: layer.id,
            alphaMaskUiHidden: false
        };

        layer.alphaMaskProjectId = maskId;
        this.projects.push(maskP);
        return { maskProject: maskP, maskLayer: maskP.layers[0] };
    },

    /**
     * Tampon du calque « Masque » lié (même taille que le calque), créé si besoin. Ne change pas d’onglet.
     * @returns {HTMLCanvasElement | null}
     */
    ensureAlphaMaskBufferForLayer(layer) {
        const parent = this.activeProject;
        if (!parent || !parent.mode.startsWith('pixel') || parent.role === 'layerAlphaMask' || !layer?.buffer) return null;
        const lw = Math.max(1, layer.buffer.width);
        const lh = Math.max(1, layer.buffer.height);
        if (layer.alphaMaskProjectId) {
            const j = this.projects.findIndex((pr) => pr.id === layer.alphaMaskProjectId);
            if (j >= 0) {
                const mp = this.projects[j];
                const ml = mp.layers && mp.layers[0];
                const mb = ml && ml.buffer;
                if (mb && mb.width === lw && mb.height === lh) return mb;
                const victim = this.projects[j];
                if (victim) this.disposeProjectResources(victim);
                this.projects.splice(j, 1);
            }
            layer.alphaMaskProjectId = null;
        }
        const r = this._addLinkedAlphaMaskProject(layer);
        if (r) this.updateTabUI();
        return r ? r.maskLayer.buffer : null;
    },

    openLayerAlphaMask(layerIndex) {
        const parent = this.activeProject;
        if (!parent || !parent.mode.startsWith('pixel') || parent.role === 'layerAlphaMask') return;
        const idx = Math.max(0, Math.min(layerIndex, this.layers.length - 1));
        const layer = this.layers[idx];
        if (!layer) return;
        this._normalizeDynamicFilterProps(layer);
        if (this._isLiveDynamicFilterLayer(layer)) return;

        if (layer.alphaMaskProjectId) {
            const j = this.projects.findIndex((pr) => pr.id === layer.alphaMaskProjectId);
            if (j >= 0) {
                this.projects[j].alphaMaskUiHidden = false;
                this.switchProject(j);
                return;
            }
            layer.alphaMaskProjectId = null;
        }

        const r = this._addLinkedAlphaMaskProject(layer);
        if (!r) return;
        const j = this.projects.indexOf(r.maskProject);
        this.switchProject(j);
        this.updateTabUI();
    },

    removeLayerAlphaMaskAtIndex(layerIndex) {
        const parent = this.activeProject;
        if (!parent || !parent.mode.startsWith('pixel') || parent.role === 'layerAlphaMask') return;
        const idx = Math.max(0, Math.min(layerIndex, this.layers.length - 1));
        const layer = this.layers[idx];
        if (!layer || !layer.alphaMaskProjectId) return;
        const msg =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('layer.clearAlphaConfirm')
                : 'Supprimer le masque alpha lié à ce calque ?';
        if (!confirm(msg)) return;
        const mid = layer.alphaMaskProjectId;
        const maskPi = this.projects.findIndex((pr) => pr.id === mid);
        if (this.activeProjectIndex === maskPi && maskPi >= 0) {
            const pi = this.projects.findIndex((pr) => pr.id === parent.id);
            this.switchProject(pi >= 0 ? pi : 0);
        }
        const maskProj = this.projects.find((pr) => pr.id === mid);
        if (maskProj) this.disposeProjectResources(maskProj);
        this.projects = this.projects.filter((pr) => pr.id !== mid);
        layer.alphaMaskProjectId = null;
        this.updateTabUI();
        const hist =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('layer.clearAlphaHistory')
                : 'Masque α supprimé';
        this.saveHistory(hist);
        this.updateLayerUI();
        this.render();
    },

    get history() { return this.activeProject ? this.activeProject.history : []; },
    set history(v) { if (this.activeProject) this.activeProject.history = v; },
    get historyIndex() { return this.activeProject ? this.activeProject.historyIndex : -1; },
    set historyIndex(v) { if (this.activeProject) this.activeProject.historyIndex = v; },

    setupShortcuts() {
        window.addEventListener('keydown', (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            if (e.ctrlKey && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
                e.preventDefault();
                window.applyEffect('grayscale');
            }
        });
    },

    handleNewProject() {
        const pMode = document.querySelector('input[name="proj-mode"]:checked')?.value || 'pixel';
        const isPixel = pMode.startsWith('pixel');
        const dw = window.ILLU_DEFAULT_DOC_WIDTH || 1280;
        const dh = window.ILLU_DEFAULT_DOC_HEIGHT || 720;
        const pWidth = parseInt(document.getElementById('p-width')?.value || dw, 10);
        const pHeight = parseInt(document.getElementById('p-height')?.value || dh, 10);

        const project = {
            id: Date.now(),
            name: `Sans titre ${this.projects.length + 1}` + (pMode === 'pixel-dither' ? ' (N&B)' : pMode === 'pixel-ral' ? ' (RAL)' : pMode === 'pixel-cmjn' ? ' (CMJN)' : ''),
            mode: pMode,
            width: Math.max(1, Number.isFinite(pWidth) && pWidth > 0 ? pWidth : dw),
            height: Math.max(1, Number.isFinite(pHeight) && pHeight > 0 ? pHeight : dh),
            ditherEffectSize: pMode === 'pixel-dither' ? (this.toolProps.ditherEffectSize || 1) : 1,
            layers: [],
            activeLayerIndex: 0,
            history: [],
            historyIndex: -1,
            zoomLevel: 1.0,
            canvasPanX: 0,
            canvasPanY: 0,
            canvasData: null, // Temporary store for pixel data
            svgData: "", // Store for vector data
            role: 'main',
            parentProjectId: null,
            parentLayerId: null,
            autoSaveLocal: false,
            ditherInvert: false
        };

        this.projects.push(project);
        this.activeProjectIndex = this.projects.length - 1;

        if (project.mode.startsWith('pixel')) {
            this.addLayer('Arrière-plan');
        } else if (project.mode === 'vector') {
            this.addLayer('Arrière-plan');
            const sl = document.getElementById('svg-layers');
            if (sl) project.svgData = sl.innerHTML;
        }
        this.saveHistory('Nouveau Document');

        this.updateTabUI();
        this.applyProjectToUI();
        if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
            window.scheduleFitActiveProjectZoomOnDocumentOpen(this);
        } else if (typeof window.fitActiveProjectZoomToWorkspace === 'function') {
            window.fitActiveProjectZoomToWorkspace(this, { force: true });
        }
        if (typeof window.clearSelectionAfterDocumentOpen === 'function') {
            window.clearSelectionAfterDocumentOpen();
        }
        document.getElementById('dialog-overlay').style.display = 'none';
        return project;
    },

    /** Copie fiable d'une source d'import (Image, canvas…) en tampon canvas. */
    _bitmapFromImportSource(img) {
        if (!img) return null;
        const iw = Math.max(0, (img.naturalWidth || img.width) | 0);
        const ih = Math.max(0, (img.naturalHeight || img.height) | 0);
        if (iw < 1 || ih < 1) return null;
        if (img instanceof HTMLCanvasElement && img.width === iw && img.height === ih) return img;
        const c = document.createElement('canvas');
        c.width = iw;
        c.height = ih;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0);
        }
        return c;
    },

    /**
     * Coin supérieur gauche document pour une image importée : reprise de la copie interne (même projet, mêmes dimensions), sinon centré sur la toile.
     * @param {{ pasteDocBounds?: { x: number; y: number; w: number; h: number }; pasteProjectId?: number | null }} [importOpts]
     */
    _computeImportPasteDocXY(W, H, iw, ih, importOpts) {
        importOpts = importOpts || {};
        if (importOpts.ignorePastePosition) {
            if (iw < 1 || ih < 1) return { docX: 0, docY: 0 };
            return { docX: Math.round((W - iw) / 2), docY: Math.round((H - ih) / 2) };
        }
        const pb = importOpts.pasteDocBounds;
        const ap = this.activeProject;
        const pid = ap && ap.id != null ? ap.id : null;
        const sameProject =
            pb &&
            importOpts.pasteProjectId != null &&
            pid != null &&
            String(importOpts.pasteProjectId) === String(pid);
        if (sameProject) {
            return {
                docX: Math.round(pb.x),
                docY: Math.round(pb.y)
            };
        }
        if (iw < 1 || ih < 1) return { docX: 0, docY: 0 };
        return { docX: Math.round((W - iw) / 2), docY: Math.round((H - ih) / 2) };
    },

    _isSamePasteProject(pasteProjectId) {
        const ap = this.activeProject;
        const pid = ap && ap.id != null ? ap.id : null;
        return pasteProjectId != null && pid != null && String(pasteProjectId) === String(pid);
    },

    _mergeInternalPasteImportOpts(importOpts) {
        importOpts = importOpts || {};
        const isInternalPaste = importOpts.pasteProjectId != null;
        if (!isInternalPaste) return importOpts;
        if (!importOpts.pasteDocBounds && window.ctxClipboardDocBounds) {
            importOpts.pasteDocBounds = window.ctxClipboardDocBounds;
        }
        return importOpts;
    },

    /**
     * Si l'image dépasse la toile : dialogue agrandir / coller tel quel (volant).
     * @param {HTMLImageElement|HTMLCanvasElement} img
     * @param {(placement: 'staging'|'fitCanvas') => void} onReady
     */
    _runImportOversizeGate(img, onReady, importOpts = {}) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const W = Math.max(1, this.width | 0);
        const H = Math.max(1, this.height | 0);
        const finish = (placement) => {
            if (typeof onReady === 'function') onReady(placement || 'commit');
        };
        if ((iw <= W && ih <= H) || importOpts.multiImport) {
            finish('commit');
            return;
        }
        const overlay = document.getElementById('import-choice-overlay');
        const overlayOversize = document.getElementById('import-oversize-overlay');
        if (overlay) overlay.style.display = 'none';
        if (!overlayOversize) {
            finish('commit');
            return;
        }
        overlayOversize.style.display = 'flex';
        const btnExt = document.getElementById('btn-import-oversize-extend');
        const btnKeep = document.getElementById('btn-import-oversize-keep');
        const btnBack = document.getElementById('btn-import-oversize-back');
        if (btnExt) {
            btnExt.onclick = () => {
                overlayOversize.style.display = 'none';
                const mr = Math.max(0, iw - W);
                const mb = Math.max(0, ih - H);
                this.extendDocumentMargins(0, 0, mr, mb, { silent: true });
                finish('commit');
            };
        }
        if (btnKeep) {
            btnKeep.onclick = () => {
                overlayOversize.style.display = 'none';
                finish('staging');
            };
        }
        if (btnBack) {
            btnBack.onclick = () => {
                overlayOversize.style.display = 'none';
                if (overlay && overlay.style.display !== 'none') {
                    overlay.style.display = 'flex';
                }
            };
        }
    },

    /** Import direct : nouveau calque avec pixels posés (sans tampon volant). */
    importImageAsNewLayer(img, name, importOpts) {
        importOpts = importOpts || {};
        if (!this.isPixelMode) {
            if (typeof window.illuPromptVectorBitmapImport === 'function') {
                window.illuPromptVectorBitmapImport(img);
            } else if (typeof this.embedBitmapInVectorProject === 'function') {
                this.embedBitmapInVectorProject(img);
            }
            return;
        }
        this._runImportOversizeGate(img, () => {
            this.addImageLayerFromBitmap(img, name || 'Image importée', {
                ...importOpts,
                placement: 'commit'
            });
            this.saveHistory('Import calque', { patchActiveLayer: true });
            this.render({ flushUiThumbnails: true });
            if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
                window.scheduleFitActiveProjectZoomOnDocumentOpen();
            } else if (typeof window.fitActiveProjectZoomToPageWidth === 'function') {
                window.fitActiveProjectZoomToPageWidth();
            }
            if (typeof window.illuAfterImportActivateDeformTool === 'function') {
                window.illuAfterImportActivateDeformTool({ skipFullLayerSync: true });
            }
        }, importOpts);
    },

    _finishFloatingPaste(img, importOpts, placement, historyLabel) {
        this.addImageLayerFromBitmap(img, 'Collage', {
            ...importOpts,
            placement: 'commit'
        });
        this.saveHistory(historyLabel || 'Coller', { patchActiveLayer: true });
        this.render({ flushUiThumbnails: true });
        if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
            window.scheduleFitActiveProjectZoomOnDocumentOpen();
        } else if (typeof window.fitActiveProjectZoomToPageWidth === 'function') {
            window.fitActiveProjectZoomToPageWidth();
        }
        if (typeof window.illuAfterImportActivateDeformTool === 'function') {
            window.illuAfterImportActivateDeformTool({ skipFullLayerSync: true });
        }
    },

    /** Coller depuis le tampon interne (Ctrl+V) sans passer par le presse-papiers OS. */
    pasteInternalClipboard() {
        if (!window.ctxClipboard || !this.isPixelMode) return false;
        if (
            typeof window.illuImageDataHasVisiblePixels === 'function' &&
            !window.illuImageDataHasVisiblePixels(window.ctxClipboard)
        ) {
            return false;
        }
        const c =
            typeof window.illuCanvasFromImageData === 'function'
                ? window.illuCanvasFromImageData(window.ctxClipboard)
                : null;
        if (!c) return false;
        const importOpts = {
            pasteDocBounds: window.ctxClipboardDocBounds,
            pasteProjectId: window.ctxClipboardProjectId
        };
        if (!this._isSamePasteProject(importOpts.pasteProjectId)) {
            importOpts.ignorePastePosition = true;
            delete importOpts.pasteDocBounds;
        }
        this._runImportOversizeGate(c, () => {
            this._finishFloatingPaste(c, importOpts, 'commit', 'Coller');
        });
        return true;
    },

    promptImport(img, importOpts) {
        importOpts = this._mergeInternalPasteImportOpts(importOpts || {});
        img = this._bitmapFromImportSource(img);
        if (!img) {
            if (window.showIlluAlert) window.showIlluAlert('Image invalide ou vide.');
            return;
        }
        if (!this.isPixelMode) {
            if (typeof window.illuPromptVectorBitmapImport === 'function') {
                window.illuPromptVectorBitmapImport(img);
            } else {
                this.embedBitmapInVectorProject(img);
            }
            return;
        }
        const fromInternalClipboard = importOpts.pasteProjectId != null;

        // Collage presse-papiers interne (même projet ou autre onglet).
        if (fromInternalClipboard) {
            const sameProject = this._isSamePasteProject(importOpts.pasteProjectId);
            if (!sameProject) {
                importOpts = { ...importOpts, ignorePastePosition: true };
                delete importOpts.pasteDocBounds;
            }
            this._runImportOversizeGate(img, () => {
                this._finishFloatingPaste(img, importOpts, 'commit', 'Coller');
            });
            return;
        }

        // Glisser-déposer / import fichier sans dialogue.
        if (importOpts.autoNewLayer) {
            this.importImageAsNewLayer(img, importOpts.layerName || 'Image importée', importOpts);
            return;
        }

        if (importOpts.multiImport) {
            if (window._illuGlobalImportChoice) {
                this._applyImportChoice(img, window._illuGlobalImportChoice, importOpts);
                return;
            }
            if (!this._illuPendingMultiImports) this._illuPendingMultiImports = [];
            this._illuPendingMultiImports.push({ img, importOpts });
            if (this._illuPendingMultiImports.length > 1) {
                return; // Wait for the first image to trigger the prompt
            }
        }

        const overlay = document.getElementById('import-choice-overlay');
        const overlayOversize = document.getElementById('import-oversize-overlay');
        if (!overlay) {
            this.importImageAsNewLayer(img, 'Image importée', importOpts);
            return;
        }
        overlay.style.display = 'flex';

        const afterImport = (opts) => {
            if (typeof window.illuAfterImportActivateDeformTool === 'function') {
                window.illuAfterImportActivateDeformTool(opts);
            }
            if (importOpts.onComplete) importOpts.onComplete();
        };

        const finishNewLayerImport = () => {
            const layerName = fromInternalClipboard ? 'Image collée' : 'Image importée';
            const hist = fromInternalClipboard ? 'Coller (nouveau calque)' : 'Import calque';
            overlay.style.display = 'none';
            if (overlayOversize) overlayOversize.style.display = 'none';
            this._runImportOversizeGate(img, (placement) => {
                const pl = fromInternalClipboard
                    ? 'commit'
                    : placement === 'staging'
                      ? 'staging'
                      : 'commit';
                this.addImageLayerFromBitmap(img, layerName, { ...importOpts, placement: pl });
                this.saveHistory(hist, { patchActiveLayer: true });
                this.render({ flushUiThumbnails: true });
                if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
                    window.scheduleFitActiveProjectZoomOnDocumentOpen();
                } else if (typeof window.fitActiveProjectZoomToPageWidth === 'function') {
                    window.fitActiveProjectZoomToPageWidth();
                }
                afterImport({ skipFullLayerSync: true });
            });
        };

        const resolveBatch = (choice) => {
            window._illuGlobalImportChoice = choice;
            if (this._illuPendingMultiImports && this._illuPendingMultiImports.length > 1) {
                for (let i = 1; i < this._illuPendingMultiImports.length; i++) {
                    const item = this._illuPendingMultiImports[i];
                    this._applyImportChoice(item.img, choice, item.importOpts);
                }
            }
            this._illuPendingMultiImports = [];
        };

        const btnLayer = document.getElementById('btn-import-layer');
        if (btnLayer) {
            btnLayer.onclick = () => {
                window._illuGlobalImportChoice = 'layer';
                finishNewLayerImport();
                resolveBatch('layer');
            };
        }

        const btnCur = document.getElementById('btn-import-current');
        if (btnCur) {
            btnCur.onclick = () => {
                window._illuGlobalImportChoice = 'current';
                overlay.style.display = 'none';
                if (overlayOversize) overlayOversize.style.display = 'none';
                const hist = fromInternalClipboard ? 'Coller (calque actif)' : 'Import sur calque actif';
                this._runImportOversizeGate(img, (placement) => {
                    const pl = fromInternalClipboard
                        ? 'commit'
                        : placement === 'staging'
                          ? 'staging'
                          : 'commit';
                    if (typeof window.clearSelectionContent === 'function') {
                        window.clearSelectionContent();
                    }
                    this.drawImportedImageOnActiveLayer(img, { ...importOpts, placement: pl });
                    this.saveHistory(hist, { patchActiveLayer: true });
                    this.render({ flushUiThumbnails: true });
                    if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
                        window.scheduleFitActiveProjectZoomOnDocumentOpen();
                    } else if (typeof window.fitActiveProjectZoomToPageWidth === 'function') {
                        window.fitActiveProjectZoomToPageWidth();
                    }
                    afterImport({ skipFullLayerSync: true });
                    resolveBatch('current');
                }, importOpts);
            };
        }

        const btnTab = document.getElementById('btn-import-tab');
        if (btnTab) {
            btnTab.onclick = () => {
                window._illuGlobalImportChoice = 'tab';
                overlay.style.display = 'none';
                if (overlayOversize) overlayOversize.style.display = 'none';
                this.handleNewProjectFromImage(img);
                if (importOpts.onComplete) importOpts.onComplete();
                resolveBatch('tab');
            };
        }
    },

    _applyImportChoice(img, choice, importOpts) {
        if (choice === 'layer') {
            this.importImageAsNewLayer(img, importOpts.layerName || 'Image importée', importOpts);
        } else if (choice === 'current') {
            const hist = 'Import sur calque actif';
            this._runImportOversizeGate(img, (placement) => {
                const pl = placement === 'staging' ? 'staging' : 'commit';
                if (typeof window.clearSelectionContent === 'function') window.clearSelectionContent();
                this.drawImportedImageOnActiveLayer(img, { ...importOpts, placement: pl });
                this.saveHistory(hist, { patchActiveLayer: true });
                this.render({ flushUiThumbnails: true });
                if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') window.scheduleFitActiveProjectZoomOnDocumentOpen();
                else if (typeof window.fitActiveProjectZoomToPageWidth === 'function') window.fitActiveProjectZoomToPageWidth();
                if (typeof window.illuAfterImportActivateDeformTool === 'function') window.illuAfterImportActivateDeformTool({ skipFullLayerSync: true });
            }, importOpts);
        } else if (choice === 'tab') {
            this.handleNewProjectFromImage(img);
        }
    },

    /**
     * Agrandit le tampon du calque pour contenir le rectangle donné en coordonnées **locales** (origine tampon).
     */
    _expandLayerBufferToIncludeLocalRect(layer, x, y, w, h) {
        if (!layer || !layer.buffer) return;
        if (typeof window.illuAllowsOutsideCanvasContent === 'function' && !window.illuAllowsOutsideCanvasContent()) {
            return;
        }
        const bw = layer.buffer.width;
        const bh = layer.buffer.height;
        const x1 = x + w;
        const y1 = y + h;
        const needLeft = Math.max(0, Math.ceil(-x));
        const needTop = Math.max(0, Math.ceil(-y));
        const needRight = Math.max(0, Math.ceil(x1 - bw));
        const needBottom = Math.max(0, Math.ceil(y1 - bh));
        if (needLeft === 0 && needTop === 0 && needRight === 0 && needBottom === 0) return;
        const newW = bw + needLeft + needRight;
        const newH = bh + needTop + needBottom;
        const nc = document.createElement('canvas');
        nc.width = newW;
        nc.height = newH;
        const nctx = nc.getContext('2d', { willReadFrequently: true });
        if (nctx) {
            nctx.imageSmoothingEnabled = false;
            nctx.drawImage(layer.buffer, 0, 0, bw, bh, needLeft, needTop, bw, bh);
        }
        layer.buffer = nc;
        layer.x -= needLeft;
        layer.y -= needTop;
    },

    /**
     * Dessine une image sur le calque actif (centrée sur la toile, ou au même coin document qu’une copie interne du même projet).
     * @param {{ pasteDocBounds?: { x: number; y: number; w: number; h: number }; pasteProjectId?: number | null }} [importOpts]
     */
    /**
     * Applique un effet de trame noir et blanc à une ImageData.
     * @param {ImageData} imageData 
     * @param {number} size Taille des blocs de trame (1-8)
     */
    /**
     * Tramage (Dither) haute qualité via Floyd-Steinberg (Diffusion d'erreur).
     * @param {ImageData} imageData 
     * @param {number} size 
     * @param {{ invert?: boolean }} [options]
     */
    _ditherImageData(imageData, size, options = {}) {
        const w = imageData.width;
        const h = imageData.height;
        const s = Math.max(1, Math.min(8, Math.round(size)));
        const invert = !!options.invert;

        // Optimized Wasm path
        if (window.MasterPaintWasm && window.MasterPaintWasm.isLoaded) {
            const res = window.MasterPaintWasm.applyFilter('orderedDither', imageData, {
                size: s,
                invert: invert
            });
            if (res) return res;
        }

        // JS Fallback
        const d = imageData.data;
        const matrix = this._bayer8x8;
        if (!matrix) return imageData;

        for (let y = 0; y < h; y++) {
            const row = y * w * 4;
            const my = (y / s | 0) % 8;
            for (let x = 0; x < w; x++) {
                const i = row + (x << 2);
                if (d[i + 3] < 128) {
                    d[i] = d[i+1] = d[i+2] = d[i+3] = 0;
                    continue;
                }

                const luma = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
                const mx = (x / s | 0) % 8;
                const threshold = (matrix[my][mx] / 64) * 255;

                let v = luma >= threshold ? 255 : 0;
                if (invert) v = 255 - v;

                d[i] = d[i+1] = d[i+2] = v;
                d[i+3] = 255;
            }
        }
        return imageData;
    },


    drawImportedImageOnActiveLayer(img, importOpts) {
        importOpts = importOpts || {};
        const l = this.activeLayer;
        if (!l || !this.isPixelMode) {
            window.showIlluAlert('Calque actif introuvable.');
            return;
        }
        if (l.alphaMaskProjectId) {
            window.showIlluAlert(
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('msg.layerResizeBlockedAlphaMask')
                    : 'Détachez le masque α lié avant d’importer sur ce calque.'
            );
            return;
        }
        if (!l.buffer) {
            const buf = document.createElement('canvas');
            buf.width = this.width;
            buf.height = this.height;
            l.buffer = buf;
        }

        const iw = Math.max(0, (img && (img.naturalWidth || img.width)) | 0);
        const ih = Math.max(0, (img && (img.naturalHeight || img.height)) | 0);
        if (iw < 1 || ih < 1) return;

        const scratch = document.createElement('canvas');
        scratch.width = iw;
        scratch.height = ih;
        const sctx = scratch.getContext('2d', { willReadFrequently: true });
        if (sctx) sctx.drawImage(img, 0, 0);

        if (this.activeProject && this.activeProject.mode !== 'pixel') {
            const idata = sctx.getImageData(0, 0, iw, ih);
            this.constrainImageDataToProjectMode(idata, this.activeProject.mode);
            sctx.putImageData(idata, 0, 0);
        }

        const W = this.width;
        const H = this.height;
        let { docX, docY } = this._computeImportPasteDocXY(W, H, iw, ih, importOpts);
        const useStaging = importOpts.placement === 'staging';

        if (typeof window.illuTightenPasteCanvas === 'function') {
            const tightened = window.illuTightenPasteCanvas(scratch, docX, docY);
            if (tightened && tightened.canvas && tightened.canvas !== scratch) {
                docX = tightened.docX;
                docY = tightened.docY;
                scratch.width = tightened.iw;
                scratch.height = tightened.ih;
                scratch.getContext('2d', { willReadFrequently: true }).drawImage(tightened.canvas, 0, 0);
            } else if (tightened) {
                docX = tightened.docX;
                docY = tightened.docY;
            }
        }

        if (typeof window.clearSelectionAfterDocumentOpen === 'function') {
            window.clearSelectionAfterDocumentOpen();
        }

        if (useStaging && typeof window.illuSetImportStaging === 'function') {
            window.illuSetImportStaging(scratch, { docX, docY });
            return;
        }

        if (typeof this._fitLayerBufferToDocumentSize === 'function') {
            this._fitLayerBufferToDocumentSize(l);
        }
        const bctx = l.buffer.getContext('2d', { willReadFrequently: true });
        if (bctx) {
            bctx.imageSmoothingEnabled = false;
            bctx.drawImage(scratch, docX, docY);
        }
        l.importPlacementPending = false;
        delete l.importStagingBuffer;
        delete l.importStagingX;
        delete l.importStagingY;
        if (typeof illuSetImportPlacementChromeActive === 'function') {
            illuSetImportPlacementChromeActive(false);
        }
    },

    cloneCanvas(source) {
        const c = document.createElement('canvas');
        c.width = source.width;
        c.height = source.height;
        c.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0);
        return c;
    },

    /**
     * @param {HTMLImageElement|HTMLCanvasElement} img
     * @param {string} [name]
     * @param {{ placement?: 'fitCanvas' | 'staging'; pasteDocBounds?: { x: number; y: number; w: number; h: number }; pasteProjectId?: number | null }} [opts]
     * fitCanvas : tampon = toile, image centrée (parties hors toile coupées dans le buffer).
     * staging : tampon calque = dimensions projet ; image dans importStagingBuffer (déplaçable hors cadre) jusqu’à « poser » (Entrée).
     */
    /**
     * Importe un document parsé par PdnFile (calques ImageData, dimensions document).
     * @param {{ width: number, height: number, layers: Array<{name?:string, imageData: ImageData}>, warnings?: string[] }} parsed
     */
    importPdnDocument(parsed, opts) {
        opts = opts || {};
        if (!parsed || !parsed.layers || !parsed.layers.length) {
            if (window.showIlluAlert) window.showIlluAlert('Import .pdn : aucun calque bitmap.');
            return;
        }
        if (!this.isPixelMode) {
            if (window.showIlluAlert) {
                window.showIlluAlert('Import Paint.NET (.pdn) : passez en mode Pixel.');
            }
            return;
        }
        const W = Math.max(1, parsed.width | 0);
        const H = Math.max(1, parsed.height | 0);
        const p = this.activeProject;
        if (!p) return;

        if (opts.fileName) {
            p.name = String(opts.fileName);
            if (typeof this.updateProjectTabsUI === 'function') this.updateProjectTabsUI();
        }

        p.width = W;
        p.height = H;
        p.layers.length = 0;

        parsed.layers.forEach((L, i) => {
            const id = Date.now() + i + Math.floor(Math.random() * 1000);
            const buffer = document.createElement('canvas');
            buffer.width = W;
            buffer.height = H;
            const bctx = buffer.getContext('2d', { willReadFrequently: true });
            if (bctx && L.imageData) {
                bctx.putImageData(L.imageData, 0, 0);
            }
            p.layers.push({
                id,
                name: L.name || 'Calque ' + (i + 1),
                visible: true,
                x: 0,
                y: 0,
                opacity: 1,
                blendMode: 'source-over',
                buffer,
                importPlacementPending: false,
                alphaMaskProjectId: null,
                ...this._defaultDynamicFilterLayerProps()
            });
        });

        this.setActiveLayerIndex(p.layers.length - 1);
        this.saveHistory('Import Paint.NET (.pdn)');
        this.updateLayerUI();
        this.applyProjectToUI();
        this.render();
        if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
            window.scheduleFitActiveProjectZoomOnDocumentOpen();
        } else if (typeof window.fitActiveProjectZoomToPageWidth === 'function') {
            window.fitActiveProjectZoomToPageWidth();
        }
        if (!opts.suppressWarnings && parsed.warnings && parsed.warnings.length && window.showIlluAlert) {
            window.showIlluAlert(parsed.warnings.join('\n'));
        }
    },

    addImageLayerFromBitmap(img, name, opts) {
        opts = opts || {};
        const placement =
            opts.placement === 'staging' ? 'staging' : opts.placement === 'fitCanvas' ? 'fitCanvas' : 'commit';
        const id = Date.now();
        const W = Math.max(1, this.width | 0);
        const H = Math.max(1, this.height | 0);
        const iw = Math.max(0, (img && (img.naturalWidth || img.width)) | 0);
        const ih = Math.max(0, (img && (img.naturalHeight || img.height)) | 0);
        const isInternalPaste = opts.pasteProjectId != null;
        if (isInternalPaste && typeof window.clearSelectionAfterDocumentOpen === 'function') {
            window.clearSelectionAfterDocumentOpen();
        }
        let { docX, docY } = this._computeImportPasteDocXY(W, H, iw, ih, opts);

        const scratch = document.createElement('canvas');
        scratch.width = Math.max(1, iw);
        scratch.height = Math.max(1, ih);
        const sctx = scratch.getContext('2d', { willReadFrequently: true });
        if (sctx && iw >= 1 && ih >= 1) {
            sctx.drawImage(img, 0, 0);
        }

        if (this.activeProject && this.activeProject.mode === 'pixel-dither' && iw >= 1 && ih >= 1) {
            const idata = sctx.getImageData(0, 0, iw, ih);
            const inv = this.activeProject.ditherInvert || false;
            this._ditherImageData(idata, this.ditherEffectSize, { invert: inv });
            sctx.putImageData(idata, 0, 0);
        }

        let pasteIw = iw;
        let pasteIh = ih;
        
        // --- Fix for Oversize Import Cropping ---
        // If the imported image is larger than the document, scale it down to fit.
        // This prevents the image from being permanently cropped to a "small square in the center".
        let scaleDown = 1;
        if (pasteIw > W || pasteIh > H) {
            scaleDown = Math.min(W / pasteIw, H / pasteIh);
            pasteIw = Math.max(1, Math.round(pasteIw * scaleDown));
            pasteIh = Math.max(1, Math.round(pasteIh * scaleDown));
            
            const scaledScratch = document.createElement('canvas');
            scaledScratch.width = pasteIw;
            scaledScratch.height = pasteIh;
            const scaledCtx = scaledScratch.getContext('2d', { willReadFrequently: true });
            if (scaledCtx) {
                scaledCtx.imageSmoothingQuality = 'high';
                scaledCtx.drawImage(scratch, 0, 0, pasteIw, pasteIh);
            }
            // Replace scratch with scaled version
            scratch.width = pasteIw;
            scratch.height = pasteIh;
            const sctxNew = scratch.getContext('2d', { willReadFrequently: true });
            sctxNew.clearRect(0, 0, pasteIw, pasteIh);
            sctxNew.drawImage(scaledScratch, 0, 0);
            
            // Re-center docX and docY
            if (!opts.pasteDocBounds && !opts.pasteProjectId) {
                docX = Math.round((W - pasteIw) / 2);
                docY = Math.round((H - pasteIh) / 2);
            }
        }

        if (typeof window.illuTightenPasteCanvas === 'function') {
            const tightened = window.illuTightenPasteCanvas(scratch, docX, docY);
            if (tightened && tightened.canvas) {
                docX = tightened.docX;
                docY = tightened.docY;
                pasteIw = tightened.iw;
                pasteIh = tightened.ih;
                if (tightened.canvas !== scratch) {
                    scratch.width = pasteIw;
                    scratch.height = pasteIh;
                    scratch.getContext('2d', { willReadFrequently: true }).drawImage(tightened.canvas, 0, 0);
                }
            }
        }

        let importPlacementPending = false;
        let importStagingBuffer = null;
        let importStagingX = 0;
        let importStagingY = 0;
        const useStaging = placement === 'staging' && pasteIw >= 1 && pasteIh >= 1;
        const useTightCommitLayer = placement === 'commit' && pasteIw >= 1 && pasteIh >= 1;
        const buffer = document.createElement('canvas');
        if (useTightCommitLayer) {
            buffer.width = pasteIw;
            buffer.height = pasteIh;
        } else {
            buffer.width = W;
            buffer.height = H;
        }
        if (useStaging) {
            importStagingBuffer = this.cloneCanvas(scratch);
            importStagingX = docX;
            importStagingY = docY;
            importPlacementPending = true;
        } else {
            const bctx = buffer.getContext('2d', { willReadFrequently: true });
            if (bctx) {
                bctx.imageSmoothingEnabled = false;
                if (pasteIw >= 1 && pasteIh >= 1) {
                    if (useTightCommitLayer) {
                        bctx.drawImage(scratch, 0, 0);
                    } else {
                        bctx.drawImage(scratch, docX, docY);
                    }
                }
            }
        }
        const layer = {
            id,
            name: name || 'Image',
            visible: true,
            x: useTightCommitLayer ? docX : 0,
            y: useTightCommitLayer ? docY : 0,
            opacity: 1,
            blendMode: 'source-over',
            buffer,
            importPlacementPending,
            importStagingBuffer,
            importStagingX,
            importStagingY,
            alphaMaskProjectId: null,
            ...this._defaultDynamicFilterLayerProps()
        };
        this.layers.push(layer);
        this.setActiveLayerIndex(this.layers.length - 1);
        this.updateLayerUI();
        if (importPlacementPending) {
            if (typeof illuSetImportPlacementChromeActive === 'function') {
                illuSetImportPlacementChromeActive(true);
            }
            if (typeof window.syncSelectionToImportPlacementLayer === 'function') {
                window.syncSelectionToImportPlacementLayer();
            }
        } else if (
            isInternalPaste &&
            typeof window.syncSelectionToCommittedImportBounds === 'function'
        ) {
            window.syncSelectionToCommittedImportBounds({
                x: docX,
                y: docY,
                w: pasteIw,
                h: pasteIh
            });
        } else if (typeof window.clearSelectionAfterDocumentOpen === 'function') {
            window.clearSelectionAfterDocumentOpen();
        }
        this.render({ flushUiThumbnails: true });
    },

    freezePixelProject(p) {
        if (!p || !p.mode.startsWith('pixel') || !p.layers) return;
        p.pixelSnapshot = {
            activeLayerIndex: p.activeLayerIndex,
            layers: p.layers.map((l) => ({
                id: l.id,
                name: l.name,
                visible: l.visible,
                x: l.x,
                y: l.y,
                opacity: l.opacity,
                blendMode: l.blendMode || 'source-over',
                alphaMaskProjectId: l.alphaMaskProjectId != null ? l.alphaMaskProjectId : null,
                ...this._snapshotDynamicFilterProps(l),
                importPlacementPending: !!l.importPlacementPending,
                importStagingX: l.importStagingX | 0,
                importStagingY: l.importStagingY | 0,
                importStagingCanvas: l.importStagingBuffer ? this.cloneCanvas(l.importStagingBuffer) : null,
                bufferCanvas: l.buffer ? this.cloneCanvas(l.buffer) : null
            }))
        };
    },

    thawPixelProject(p) {
        if (!p || !p.pixelSnapshot) return false;
        const snap = p.pixelSnapshot;
        p.layers = snap.layers
            .filter((s) => s.bufferCanvas)
            .map((s) => ({
                id: s.id,
                name: s.name,
                visible: s.visible,
                x: s.x,
                y: s.y,
                opacity: s.opacity,
                blendMode: s.blendMode || 'source-over',
                alphaMaskProjectId: s.alphaMaskProjectId != null ? s.alphaMaskProjectId : null,
                ...this._snapshotDynamicFilterProps(s),
                importPlacementPending: !!s.importPlacementPending,
                importStagingX: s.importStagingX | 0,
                importStagingY: s.importStagingY | 0,
                importStagingBuffer: s.importStagingCanvas || null,
                buffer: s.bufferCanvas
            }));
        p.activeLayerIndex = Math.min(Math.max(0, snap.activeLayerIndex), Math.max(0, p.layers.length - 1));
        p.pixelSnapshot = null;
        return true;
    },

    handleNewProjectFromImage(img) {
        img = this._bitmapFromImportSource(img);
        if (!img) {
            if (window.showIlluAlert) window.showIlluAlert('Image invalide ou vide.');
            return null;
        }
        const iw = img.width | 0;
        const ih = img.height | 0;
        const project = {
            id: Date.now(),
            name: `Image ${this.projects.length + 1}`,
            mode: 'pixel',
            width: iw,
            height: ih,
            layers: [],
            activeLayerIndex: 0,
            history: [],
            historyIndex: -1,
            zoomLevel: 1,
            canvasPanX: 0,
            canvasPanY: 0,
            canvasData: null,
            svgData: '',
            role: 'main',
            parentProjectId: null,
            parentLayerId: null,
            autoSaveLocal: false
        };

        this.projects.push(project);
        const newIdx = this.projects.length - 1;

        const buffer = document.createElement('canvas');
        buffer.width = iw;
        buffer.height = ih;
        buffer.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
        
        project.layers.push({
            id: Date.now() + 1,
            name: 'Calque 1',
            visible: true,
            x: 0,
            y: 0,
            opacity: 1,
            blendMode: 'source-over',
            buffer: buffer,
            alphaMaskProjectId: null,
            ...this._defaultDynamicFilterLayerProps()
        });
        project.activeLayerIndex = project.layers.length - 1;

        this.switchProject(newIdx);
        this.saveHistory('Nouveau Document (Import)');
        if (typeof window.clearSelectionAfterDocumentOpen === 'function') {
            window.clearSelectionAfterDocumentOpen();
        }
        if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
            window.scheduleFitActiveProjectZoomOnDocumentOpen();
        } else if (typeof window.fitActiveProjectZoomToPageWidth === 'function') {
            window.fitActiveProjectZoomToPageWidth();
        }
        if (typeof window.illuAfterImportActivateDeformTool === 'function') {
            window.illuAfterImportActivateDeformTool({ skipFullLayerSync: true });
        }
        return project;
    },

    /** Intègre un bitmap comme élément SVG `<image>` sur le calque vectoriel actif. */
    embedBitmapInVectorProject(img, opts) {
        opts = opts || {};
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) return;

        if (!this.activeProject || this.isPixelMode) {
            this.handleNewProjectFromImage(img);
            return;
        }

        const NS = 'http://www.w3.org/2000/svg';
        let layer = this.activeLayer;
        if (!layer) {
            const id = Date.now();
            this.activeProject.layers.push({
                id,
                name: 'Image bitmap',
                visible: true,
                x: 0,
                y: 0,
                opacity: 1,
                blendMode: 'source-over',
                buffer: null
            });
            this.activeProject.activeLayerIndex = this.activeProject.layers.length - 1;
            layer = this.activeLayer;
            const layersRoot = document.getElementById('svg-layers');
            const g = document.createElementNS(NS, 'g');
            g.setAttribute('id', `layer-${id}`);
            if (layersRoot) layersRoot.appendChild(g);
        }

        const g = document.getElementById(`layer-${layer.id}`);
        if (!g) return;

        const c = document.createElement('canvas');
        c.width = iw;
        c.height = ih;
        c.getContext('2d').drawImage(img, 0, 0);
        const href = c.toDataURL('image/png');

        const el = document.createElementNS(NS, 'image');
        el.setAttribute('href', href);
        el.setAttribute('xlink:href', href);
        el.setAttribute('x', String(opts.x != null ? opts.x : 0));
        el.setAttribute('y', String(opts.y != null ? opts.y : 0));
        el.setAttribute('width', String(iw));
        el.setAttribute('height', String(ih));
        el.setAttribute('data-illu-bitmap-embed', '1');
        el.setAttribute('pointer-events', 'all');
        g.appendChild(el);

        EditorManager.activeVectorSelection = [el];
        if (typeof window !== 'undefined') {
            window._activeVectorShapeEl = el;
        }
        if (typeof window.illuSyncVectorSelectionUI === 'function') {
            window.illuSyncVectorSelectionUI();
        }

        if (this.expandActiveProjectToVectorContentBounds(24)) {
            this._applyVectorCanvasDimensionsOnly();
        }
        this.syncActiveVectorSvg();
        this.saveHistory(opts.historyLabel || 'Import bitmap SVG');
        this.render();
        if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
            window.scheduleFitActiveProjectZoomOnDocumentOpen();
        }
    },

    /** Injecte le résultat de IlluVectorize dans le projet vectoriel actif. */
    injectVectorizedFragment(result, opts) {
        opts = opts || {};
        if (!result || !result.fragment || !this.activeProject || this.isPixelMode) return;

        const NS = 'http://www.w3.org/2000/svg';
        if (opts.newLayer) {
            this.addLayer(opts.layerName || 'Vectorisé');
        }
        let layer = this.activeLayer;
        if (!layer) {
            const id = Date.now();
            this.activeProject.layers.push({
                id,
                name: opts.layerName || 'Vectorisé',
                visible: true,
                x: 0,
                y: 0,
                opacity: 1,
                blendMode: 'source-over',
                buffer: null
            });
            this.activeProject.activeLayerIndex = this.activeProject.layers.length - 1;
            layer = this.activeLayer;
            const layersRoot = document.getElementById('svg-layers');
            const g = document.createElementNS(NS, 'g');
            g.setAttribute('id', `layer-${id}`);
            if (layersRoot) layersRoot.appendChild(g);
        }

        const g = document.getElementById(`layer-${layer.id}`);
        if (!g) return;

        const wrap = document.createElementNS(NS, 'g');
        wrap.setAttribute('data-illu-vectorize-root', '1');
        wrap.appendChild(result.fragment);
        g.appendChild(wrap);

        const sw = opts.sourceWidth || result.width;
        const sh = opts.sourceHeight || result.height;
        if (sw !== result.width || sh !== result.height) {
            const sx = sw / result.width;
            const sy = sh / result.height;
            wrap.setAttribute('transform', `scale(${sx},${sy})`);
        }

        if (this.expandActiveProjectToVectorContentBounds(24)) {
            this._applyVectorCanvasDimensionsOnly();
        }
        this.syncActiveVectorSvg();
        this.saveHistory(opts.historyLabel || 'Vectoriser bitmap');
        this.render();
        if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
            window.scheduleFitActiveProjectZoomOnDocumentOpen();
        }
    },

    switchProject(index) {
        if (index < 0 || index >= this.projects.length) return;

        // Automatically dock Photo Mode if active
        if (window.PhotoModeManager && typeof window.PhotoModeManager.isOpen === 'function' && window.PhotoModeManager.isOpen()) {
            if (window.PhotoModeManager.close) window.PhotoModeManager.close(true); // Close with dock=true
        }

        const prevProj = this.activeProject;
        const prevWasMask = !!(prevProj && prevProj.role === 'layerAlphaMask');

        if (this.activeProject) {
            if (this.isPixelMode) {
                this.freezePixelProject(this.activeProject);
            } else {
                const sl = document.getElementById('svg-layers');
                if (sl) this.activeProject.svgData = sl.innerHTML;
            }
        }

        this.activeProjectIndex = index;
        const nextProj = this.activeProject;
        const maskToParent =
            prevWasMask &&
            nextProj &&
            nextProj.role !== 'layerAlphaMask' &&
            prevProj.parentProjectId === nextProj.id;
        const px = nextProj && nextProj.mode.startsWith('pixel') ? nextProj.width * nextProj.height : 0;
        const heavyComposite = maskToParent && px >= 800000;

        if (nextProj && nextProj.mode === 'vector') {
            if (typeof window.illuPurgeSelectionOverlayAndGhostDom === 'function') {
                window.illuPurgeSelectionOverlayAndGhostDom();
            }
            if (typeof window.illuVectorEndSelectionPreviews === 'function') {
                window.illuVectorEndSelectionPreviews();
            }
            this.activeVectorSelection = [];
            window._activeVectorShapeEl = null;
        }

        this.applyProjectToUI(heavyComposite ? { compositeProgressRender: true } : undefined);
        this.updateTabUI();
        if (nextProj && nextProj.mode === 'vector' && typeof this.refreshVectorProjectTabThumbnails === 'function') {
            this.refreshVectorProjectTabThumbnails();
        }

        // Save active project ID to reopen it on next session
        if (nextProj && nextProj.id) {
            try {
                localStorage.setItem('illu_last_project_id', String(nextProj.id));
            } catch (e) { /* ignore */ }
        }
        if (typeof window.clearSelectionAfterDocumentOpen === 'function') {
            window.clearSelectionAfterDocumentOpen();
        }
    },

    /**
     * Outils Déplacer / Déformation / Sélection : flèches 1 px, Ctrl + flèche 10 px ;
     * deux flèches en même temps = déplacement diagonal.
     * Avec Déformation + session warp (cadre rect), délègue au déplacement type poignée centre.
     */
    applyMoveToolNudge(dx, dy, opts) {
        opts = opts || {};
        if (!this.activeProject || (dx === 0 && dy === 0)) return;
        const tool = window.activeTool;
        if (tool !== 'move' && tool !== 'deform') return;
        const mc = document.getElementById('main-canvas-container');
        if (mc && mc.querySelector('canvas:not(#drawing-canvas):not(.illu-pixel-layer-view):not(.illu-warp-preview-overlay):not(.illu-warp-base-preview-overlay):not(.illu-stack-preview-overlay):not(.illu-move-layer-whole-ghost)')) return;

        const al = this.activeLayer;
        if (!al) return;

        if (tool === 'deform' && window.selectionPixelWarpActive) {
            if (typeof window.nudgeDeformWarpDelta === 'function' && window.nudgeDeformWarpDelta(dx, dy, opts)) {
                return;
            }
            return;
        }

        if (this.mode === 'vector' && this.activeVectorSelection.length) {
            this.activeVectorSelection.forEach(el => {
                const tag = (el.tagName || '').toLowerCase();
                if (['rect', 'text', 'foreignObject'].includes(tag)) {
                    el.setAttribute('x', String((parseFloat(el.getAttribute('x')) || 0) + dx));
                    el.setAttribute('y', String((parseFloat(el.getAttribute('y')) || 0) + dy));
                } else if (['circle', 'ellipse'].includes(tag)) {
                    el.setAttribute('cx', String((parseFloat(el.getAttribute('cx')) || 0) + dx));
                    el.setAttribute('cy', String((parseFloat(el.getAttribute('cy')) || 0) + dy));
                } else {
                    const tr = el.getAttribute('transform') || '';
                    el.setAttribute('transform', `${tr} translate(${dx},${dy})`.trim());
                }
            });
            if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
            if (opts.deferHistory) {
                window._illuArrowNudgeHistoryPending = true;
            } else {
                this.saveHistory('Déplacement vecteur', { patchActiveLayer: true });
            }
            this.render();
            return;
        }

        if (this.mode === 'vector') {
            al.x = (al.x || 0) + dx;
            al.y = (al.y || 0) + dy;
            if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
            if (opts.deferHistory) {
                window._illuArrowNudgeHistoryPending = true;
            } else {
                this.saveHistory('Déplacement calque', { patchActiveLayer: true });
            }
            this.render();
            return;
        }

        if (!al.buffer) return;

        if (typeof window.illuNudgeSelectionPixelsDelta === 'function') {
            if (window.illuNudgeSelectionPixelsDelta(dx, dy)) {
                if (opts.deferHistory) {
                    window._illuArrowNudgeHistoryPending = true;
                } else {
                    this.saveHistory('Déplacement', { patchActiveLayer: true });
                }
                this.render();
            }
        }
    },

    /**
     * @param {{ compositeProgressRender?: boolean }} [opts] — Après édition masque α : rendu document parent avec barre de statut si lourd.
     */
    applyProjectToUI(opts) {
        opts = opts || {};
        const p = this.activeProject;
        if (!p) return;

        if (typeof window.illuSplashLog === 'function') {
            const count = p.layers ? p.layers.length : 0;
            const name = p.name || 'Sans titre';
            window.illuSplashLog(`Projet "${name}" appliqué (${count} calque(s))`);
        }

        const canvas = document.getElementById('drawing-canvas');
        const svg = document.getElementById('drawing-svg');
        const container = document.getElementById('main-canvas-container');

        // Update container & elements dimensions
        if (container) {
            container.style.width = p.width + 'px';
            container.style.height = p.height + 'px';
            if (typeof window.illuApplyCanvasViewportStyles === 'function') {
                window.illuApplyCanvasViewportStyles(container, p);
            } else {
                const panX = p.canvasPanX != null ? p.canvasPanX : 0;
                const panY = p.canvasPanY != null ? p.canvasPanY : 0;
                const z = p.zoomLevel || 1.0;
                container.style.left = `calc(50% + ${panX}px)`;
                container.style.top = `calc(50% + ${panY}px)`;
                container.style.transform = `translate(-50%, -50%) scale(${z})`;
                container.style.setProperty('--canvas-zoom', String(z));
            }
            this.clampCanvasPanInWorkspace(
                typeof window.illuMobileEffectDialogCanvasLayout === 'function' &&
                    window.illuMobileEffectDialogCanvasLayout()
                    ? 14
                    : 48
            );
        }
        if (canvas) {
            canvas.width = p.width;
            canvas.height = p.height;
            canvas.style.display = this.isPixelMode ? 'block' : 'none';
        }
        if (svg) {
            svg.setAttribute('width', p.width);
            svg.setAttribute('height', p.height);
            svg.setAttribute('viewBox', `0 0 ${p.width} ${p.height}`);
            svg.style.display = 'block'; // Toujours block pour svg-ui
            svg.style.pointerEvents = p.mode === 'vector' ? 'auto' : 'none';
            /*
             * Pixel : garder le SVG au-dessus du canvas (#drawing-canvas z-index 2). Sinon, dès qu’on compose
             * sur le canvas plat (filtre dynamique ƒ, masque α, etc.), le bitmap opaque recouvre svg-ui et les
             * poignées de sélection / outils disparaissent. Les clics passent grâce à pointer-events:none sur le
             * SVG et svg-ui ; seules les poignées (pointer-events:all) interceptent.
             */
            svg.style.zIndex = '3';
        }
        const svgUI = document.getElementById('svg-ui');
        if (svgUI) {
            /* En pixel, laisser passer les clics vers le canvas / le texte sauf sur les poignées (pointer-events: all sur chaque forme). */
            svgUI.style.pointerEvents = p.mode === 'vector' ? 'auto' : 'none';
        }

        // --- Handle Dither Palette Visibility and Grisé UI ---
        const isDither = p.mode === 'pixel-dither';
        
        const ditherContainer = document.getElementById('color-dither-container');
        const wheelContainer = document.getElementById('color-wheel-container');
        const gridBtn = document.getElementById('btn-toggle-color-grid');
        const swatchBox = document.querySelector('.color-swatch-box');
        const sliderPanel = document.getElementById('color-sliders-panel');
        const palGrid = document.getElementById('palette-grid');
        const wheelIco = document.querySelector('.color-top-row');
        const winColors = document.getElementById('win-colors');
        if (winColors) winColors.classList.toggle('color-window--dither', isDither);

        if (isDither) {
            if (ditherContainer) ditherContainer.style.display = 'block';
            [wheelContainer, gridBtn, palGrid].forEach((el) => {
                if (!el) return;
                el.classList.add('illu-palette-disabled');
                el.style.display = 'none';
            });

            this.setupDitherPalette();
            const slider = document.getElementById('dither-size-slider');
            if (slider) {
                slider.value = this.ditherEffectSize;
            }
            if (!this._ditherPaletteInitialized) {
                this._ditherPaletteInitialized = true;
            }
        } else {
            if (ditherContainer) ditherContainer.style.display = 'none';
            if (wheelContainer) {
                wheelContainer.classList.remove('illu-palette-disabled');
                wheelContainer.style.display = 'block';
            }
            if (gridBtn) {
                gridBtn.classList.remove('illu-palette-disabled');
                gridBtn.style.display = '';
            }
            if (palGrid) {
                palGrid.classList.remove('illu-palette-disabled');
                palGrid.style.display = '';
            }
            if (swatchBox) swatchBox.style.display = 'flex';
        }

        if (this.updateColorWheelForMode) this.updateColorWheelForMode();

        if (this.snapColorToPalette && (this.isCmjnSimulationMode(p.mode) || this.isPaletteRestrictedMode(p.mode))) {
            this.snapColorToPalette(this.primaryColor, p.mode);
            this.snapColorToPalette(this.secondaryColor, p.mode);
            this.syncUItoState();
        }

        if (typeof window.refreshPaletteGridLayout === 'function') {
            window.refreshPaletteGridLayout();
        }

        // --- Contextual Conversion Menu ---
        const convPixelBtn = document.getElementById('menu-convert-pixel');
        const convDitherBtn = document.getElementById('menu-convert-dither');
        const convRalBtn = document.getElementById('menu-convert-ral');
        const convCmjnBtn = document.getElementById('menu-convert-cmjn');
        if (convPixelBtn) convPixelBtn.style.display = (p.mode === 'pixel') ? 'none' : 'flex';
        if (convDitherBtn) convDitherBtn.style.display = (p.mode === 'pixel-dither') ? 'none' : 'flex';
        if (convRalBtn) convRalBtn.style.display = (p.mode === 'pixel-ral') ? 'none' : 'flex';
        if (convCmjnBtn) convCmjnBtn.style.display = (p.mode === 'pixel-cmjn') ? 'none' : 'flex';

        if (typeof window.illuSyncVectorizeMenuState === 'function') {
            window.illuSyncVectorizeMenuState();
        }

        // Roue / curseurs / grille : actifs en RAL/CMJN (pas en tramé — palette motifs uniquement).
        [palGrid, sliderPanel, wheelIco].forEach((el) => {
            if (!el || (isDither && el === palGrid)) return;
            if (el) {
                el.classList.remove('illu-palette-disabled');
                el.style.pointerEvents = 'auto';
                el.style.opacity = '1';
                el.style.filter = 'none';
            }
        });

        if (p.mode.startsWith('pixel')) {
            const svgLayersClear = document.getElementById('svg-layers');
            if (svgLayersClear) svgLayersClear.innerHTML = '';
            if (p.pixelSnapshot) {
                this.thawPixelProject(p);
            }
            if (!p.layers) p.layers = [];
            this._normalizeAllPixelLayersToDocumentSize();
        } else {
            if (p.illuSpriteSheet && p.illuSpriteDefsData) {
                const defsHost = document.getElementById('vector-doc-defs');
                if (defsHost) defsHost.innerHTML = p.illuSpriteDefsData;
            }
            const svgLayers = document.getElementById('svg-layers');
            if (svgLayers) svgLayers.innerHTML = p.svgData != null ? p.svgData : '';
            if (typeof window.illuPurgeSelectionOverlayAndGhostDom === 'function') {
                window.illuPurgeSelectionOverlayAndGhostDom();
            } else {
                window.selectionBounds = null;
                if (typeof window.invalidateSelectionOverlayFast === 'function') {
                    window.invalidateSelectionOverlayFast();
                }
                if (window.SelectionChrome && typeof window.SelectionChrome.hideOverlay === 'function') {
                    window.SelectionChrome.hideOverlay();
                } else {
                    const ov = document.getElementById('selection-overlay');
                    if (ov) {
                        ov.style.display = 'none';
                        ov.innerHTML = '';
                    }
                }
            }
        }

        this.updateLayerUI();
        this.updateHistoryUI();
        if (opts.compositeProgressRender) {
            this._renderCompositeWithProgress();
        } else {
            this.render();
        }

        const t = (key, vars) =>
            window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t(key, vars) : null;
        const stProj = document.getElementById('status-project');
        if (stProj) {
            stProj.classList.remove('status-doc-open', 'status-editing-mask');
            if (p.role === 'layerAlphaMask') {
                const parent = this.projects.find((pr) => pr.id === p.parentProjectId);
                const docName = parent && parent.name ? parent.name : '—';
                const s = t('status.editingMask', { doc: docName });
                stProj.textContent = s || `Masque α · ${docName}`;
                stProj.classList.add('status-editing-mask');
            } else {
                stProj.textContent = p.name != null && String(p.name).trim() !== '' ? String(p.name) : '—';
                stProj.classList.add('status-doc-open');
            }
        }
        const stMode = document.getElementById('status-mode');
        if (stMode) {
            let modeName = 'Pixel';
            let i18nKey = 'status.modePixel';
            if (p.mode === 'vector') {
                modeName = 'Vecteur';
                i18nKey = 'status.modeVector';
            } else if (p.mode === 'pixel-dither') {
                modeName = 'Pixel (Tramé)';
                i18nKey = 'status.modeDither';
            } else if (p.mode === 'pixel-cmjn') {
                modeName = 'Pixel (CMJN)';
                i18nKey = 'status.modeCmjn';
            } else if (p.mode === 'pixel-ral') {
                modeName = 'Pixel (RAL)';
                i18nKey = 'status.modeRal';
            }
            const s = t(i18nKey);
            stMode.textContent = s || `Mode : ${modeName}`;
        }
        const stDoc = document.getElementById('status-doc-size');
        if (stDoc) {
            const s = t('status.doc', { w: p.width, h: p.height });
            stDoc.textContent = s || `Document : ${p.width} × ${p.height} px`;
        }
        if (typeof window.syncIlluMenubarZoomControls === 'function') {
            window.syncIlluMenubarZoomControls();
        } else {
            const stZoom = document.getElementById('status-zoom');
            if (stZoom) {
                const z = p.zoomLevel != null ? p.zoomLevel : 1;
                const pct = Math.round(z * 100);
                const s = t('status.zoom', { z: pct });
                stZoom.textContent = s || `Zoom : ${pct} %`;
            }
        }
        if (typeof window.refreshChromeDocTitle === 'function') window.refreshChromeDocTitle();
        if (typeof window.updateToolboxModeState === 'function') window.updateToolboxModeState();
        if (typeof window.updateMainCanvasCursor === 'function') window.updateMainCanvasCursor();
    },

    // --- ZOOM & SELECTION ---
    zoom(delta, optClientX, optClientY) {
        if (!this.activeProject) return;
        const p = this.activeProject;
        const oldZ = p.zoomLevel || 1.0;
        const maxZ =
            typeof window.illuMaxZoomLevelForProject === 'function'
                ? window.illuMaxZoomLevelForProject(p)
                : 10;
        const minZ =
            typeof window.illuMinZoomLevelForProject === 'function'
                ? window.illuMinZoomLevelForProject()
                : 0.1;
        const newZ = Math.max(minZ, Math.min(maxZ, oldZ + delta));
        
        if (optClientX != null && optClientY != null) {
            const ws = document.getElementById('workspace');
            if (ws) {
                const rect = ws.getBoundingClientRect();
                const wsX = rect.left + rect.width / 2;
                const wsY = rect.top + rect.height / 2;
                
                // Vecteur souris -> centre workspace (en pixels écran)
                const dx = optClientX - wsX;
                const dy = optClientY - wsY;
                
                // Formule de décalage du Pan pour garder le point sous la souris fixe
                // Pan2 = Pan1 * (z2/z1) + (SourisRelCentreWS) * (1 - z2/z1)
                const ratio = newZ / oldZ;
                p.canvasPanX = (p.canvasPanX || 0) * ratio + dx * (1 - ratio);
                p.canvasPanY = (p.canvasPanY || 0) * ratio + dy * (1 - ratio);
            }
        }
        
        p.zoomLevel = newZ;
        this.applyCanvasViewportOnly();
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        this.drawUI();
        if (typeof window.syncIlluMenubarZoomControls === 'function') {
            window.syncIlluMenubarZoomControls();
        }
    },

    /** Met à jour uniquement position / zoom du conteneur toile (après pan molette). */
    applyCanvasViewportOnly() {
        const p = this.activeProject;
        const container = document.getElementById('main-canvas-container');
        if (!p || !container) return;
        if (typeof window.illuApplyCanvasViewportStyles === 'function') {
            window.illuApplyCanvasViewportStyles(container, p);
        } else {
            const panX = p.canvasPanX != null ? p.canvasPanX : 0;
            const panY = p.canvasPanY != null ? p.canvasPanY : 0;
            const z = p.zoomLevel || 1.0;
            container.style.left = `calc(50% + ${panX}px)`;
            container.style.top = `calc(50% + ${panY}px)`;
            container.style.transform = `translate(-50%, -50%) scale(${z})`;
            container.style.setProperty('--canvas-zoom', String(z));
        }
        this._cachedPointerRect = null;
        this._cachedPointerRectAtMs = 0;
        this.clampCanvasPanInWorkspace(
            typeof window.illuMobileEffectDialogCanvasLayout === 'function' &&
                window.illuMobileEffectDialogCanvasLayout()
                ? 14
                : 48
        );
    },

    /**
     * Garde une marge visible de la toile dans #workspace quand le zoom est > 100 % (évite tout hors écran).
     */
    /**
     * Agrandit width/height du projet vecteur pour englober tout le dessin (imports hors cadre).
     * @param {number} [pad] marge en px
     */
    expandActiveProjectToVectorContentBounds(pad) {
        const p = this.activeProject;
        if (!p || p.mode !== 'vector') return false;
        const layers = document.getElementById('svg-layers');
        if (!layers) return false;
        let bb;
        try {
            bb = layers.getBBox();
        } catch (e) {
            return false;
        }
        if (!bb || !Number.isFinite(bb.width) || bb.width < 0.5) return false;

        const margin = Math.max(0, pad != null ? pad : 24);
        let shifted = false;
        let dx = 0;
        let dy = 0;
        if (bb.x < -0.5) {
            dx = Math.ceil(-bb.x) + margin;
            shifted = true;
        }
        if (bb.y < -0.5) {
            dy = Math.ceil(-bb.y) + margin;
            shifted = true;
        }
        if (shifted) {
            const NS = 'http://www.w3.org/2000/svg';
            [...layers.children].forEach((g) => {
                const tr = g.getAttribute('transform') || '';
                const lead = `translate(${dx},${dy})`;
                g.setAttribute('transform', tr ? `${lead} ${tr}` : lead);
            });
            try {
                bb = layers.getBBox();
            } catch (e2) {
                return false;
            }
        }

        const needW = Math.max(1, Math.ceil(bb.x + bb.width + margin));
        const needH = Math.max(1, Math.ceil(bb.y + bb.height + margin));
        const curW = Math.max(1, p.width | 0);
        const curH = Math.max(1, p.height | 0);
        if (needW <= curW && needH <= curH) return false;

        p.width = Math.max(curW, needW);
        p.height = Math.max(curH, needH);
        return true;
    },

    /** Met à jour largeur/hauteur du SVG sans recharger svg-layers (évite d’effacer un import non synchronisé). */
    _applyVectorCanvasDimensionsOnly() {
        const p = this.activeProject;
        if (!p || p.mode !== 'vector') return;
        const svg = document.getElementById('drawing-svg');
        const container = document.getElementById('main-canvas-container');
        if (svg) {
            svg.setAttribute('width', String(p.width));
            svg.setAttribute('height', String(p.height));
            svg.setAttribute('viewBox', `0 0 ${p.width} ${p.height}`);
        }
        if (container) {
            container.style.width = p.width + 'px';
            container.style.height = p.height + 'px';
        }
    },

    clampCanvasPanInWorkspace(marginPx) {
        if (typeof window.illuShouldClampCanvasPan === 'function' && !window.illuShouldClampCanvasPan()) {
            return;
        }
        const ws = document.getElementById('workspace');
        const cont = document.getElementById('main-canvas-container');
        const p = this.activeProject;
        if (!ws || !cont || !p) return;
        const m = Math.max(16, marginPx || 40);
        for (let i = 0; i < 8; i++) {
            const wr = ws.getBoundingClientRect();
            const cr = cont.getBoundingClientRect();
            let dx = 0;
            let dy = 0;
            if (cr.right < wr.left + m) dx = wr.left + m - cr.right;
            if (cr.left > wr.right - m) dx = wr.right - m - cr.left;
            if (cr.bottom < wr.top + m) dy = wr.top + m - cr.bottom;
            if (cr.top > wr.bottom - m) dy = wr.bottom - m - cr.top;
            if (dx === 0 && dy === 0) break;
            p.canvasPanX = (p.canvasPanX || 0) + dx;
            p.canvasPanY = (p.canvasPanY || 0) + dy;
            if (typeof window.illuApplyCanvasViewportStyles === 'function') {
                window.illuApplyCanvasViewportStyles(cont, p);
            } else {
                cont.style.left = `calc(50% + ${p.canvasPanX}px)`;
                cont.style.top = `calc(50% + ${p.canvasPanY}px)`;
            }
        }
    },

    /** Zoom CSS actif (transform sur le conteneur). */
    getCanvasZoomLevel() {
        return this.activeProject?.zoomLevel ?? 1;
    },

    /**
     * Coordonnées document (px logiques toile) depuis une position client.
     * Prend en compte le scale CSS du conteneur (#main-canvas-container).
     */
    logicalPointerFromClientXY(clientX, clientY) {
        const container = document.getElementById('main-canvas-container');
        const p = this.activeProject;
        if (!container || !p) return { x: 0, y: 0 };
        const now = performance.now();
        let rect = this._cachedPointerRect;
        // Increase cache duration to 100ms or until explicitly invalidated, 
        // as the workspace container doesn't move often during a single mouse stroke.
        if (!rect || now - this._cachedPointerRectAtMs > 100) {
            rect = container.getBoundingClientRect();
            this._cachedPointerRect = rect;
            this._cachedPointerRectAtMs = now;
        }
        if (rect.width < 1e-6 || rect.height < 1e-6) return { x: 0, y: 0 };
        return {
            x: (clientX - rect.left) * (p.width / rect.width),
            y: (clientY - rect.top) * (p.height / rect.height)
        };
    },

    /** Retourne le rectangle visible (viewport) en coordonnées document logiques. */
    getViewportLogicalRect() {
        const container = document.getElementById('main-canvas-container');
        const workspace = document.getElementById('illu-workspace');
        const p = this.activeProject;
        if (!container || !workspace || !p) return { x: 0, y: 0, w: p?.width || 0, h: p?.height || 0 };

        const wr = workspace.getBoundingClientRect();
        const cr = container.getBoundingClientRect();

        // Calcul des bords visibles
        const left = Math.max(wr.left, cr.left);
        const top = Math.max(wr.top, cr.top);
        const right = Math.min(wr.right, cr.right);
        const bottom = Math.min(wr.bottom, cr.bottom);

        const w_vis = Math.max(0, right - left);
        const h_vis = Math.max(0, bottom - top);

        // Conversion en coordonnées logiques relatives au container (0,0)
        const lx = (left - cr.left) * (p.width / cr.width);
        const ly = (top - cr.top) * (p.height / cr.height);
        const lw = w_vis * (p.width / cr.width);
        const lh = h_vis * (p.height / cr.height);

        return { x: lx, y: ly, w: lw, h: lh };
    },

    _computeDrawUiSignature() {
        const layer = this.activeLayer;
        const sb = window.selectionBounds;
        const ov = document.getElementById('selection-overlay');
        const q = window.selectionWarpQuad;
        const hasOv = !!(ov && ov.style.display !== 'none');
        const rot = window.selectionPreviewAngleRad || 0;
        const parts = [
            this.mode || '',
            this.activeLayerIndex | 0,
            layer ? layer.id : 'none',
            layer && layer.buffer ? `${layer.buffer.width}x${layer.buffer.height}` : '0x0',
            layer ? `${layer.x},${layer.y}` : '0,0',
            this._layerListHoverIndex != null ? this._layerListHoverIndex : 'none',
            window.activeTool || '',
            hasOv ? 1 : 0,
            window.selectionInverted ? 1 : 0,
            window.selectionKind || '',
            Number(rot).toFixed(4),
            window.selectionRotationDragActive ? 1 : 0,
            window.selectionPixelWarpActive ? 1 : 0,
            window.selectionIsWarpQuad ? 1 : 0,
            this.getCanvasZoomLevel().toFixed(4),
            sb ? `${sb.x},${sb.y},${sb.w},${sb.h}` : 'nosb'
        ];
        if (q) {
            parts.push(
                `${q.tl.x},${q.tl.y}`,
                `${q.tr.x},${q.tr.y}`,
                `${q.br.x},${q.br.y}`,
                `${q.bl.x},${q.bl.y}`
            );
        } else {
            parts.push('noq');
        }
        if (
            window.selectionKind === 'lasso' &&
            window.selectionLassoPoints &&
            window.selectionLassoPoints.length === 4
        ) {
            const pts = window.selectionLassoPoints;
            parts.push(
                `${pts[0].x},${pts[0].y}`,
                `${pts[1].x},${pts[1].y}`,
                `${pts[2].x},${pts[2].y}`,
                `${pts[3].x},${pts[3].y}`
            );
        } else {
            parts.push('nolassoquad');
        }
        if (this.mode === 'vector') {
            const el =
                typeof window._activeVectorShapeEl !== 'undefined' && window._activeVectorShapeEl
                    ? window._activeVectorShapeEl
                    : null;
            if (el) {
                parts.push(el.id || 'el');
                // On inclut les attributs géométriques pour détecter les changements de forme par les poignées
                parts.push(el.getAttribute('d') || '');
                parts.push(el.getAttribute('x') || '');
                parts.push(el.getAttribute('y') || '');
                parts.push(el.getAttribute('width') || '');
                parts.push(el.getAttribute('height') || '');
                parts.push(el.getAttribute('cx') || '');
                parts.push(el.getAttribute('cy') || '');
                parts.push(el.getAttribute('rx') || '');
                parts.push(el.getAttribute('ry') || '');
                parts.push(el.getAttribute('points') || '');
            } else {
                parts.push('novector');
            }
        }
        // États d'édition temporaires (formes pixel, courbes en cours, dégradés)
        if (window.pixelShapeEdit) {
            const ed = window.pixelShapeEdit;
            parts.push('psedit' + (ed.kind || ''));
            if (ed.docX != null) parts.push('d' + ed.docX + ',' + ed.docY + ',' + (ed.docW || 0) + ',' + (ed.docH || 0));
            else if (ed.lx != null) parts.push('r' + ed.lx + ',' + ed.ly + ',' + (ed.w || 0) + ',' + (ed.h || 0));
            if (ed.cx != null) parts.push('e' + ed.cx + ',' + ed.cy + ',' + (ed.rx || 0) + ',' + (ed.ry || 0));
            if (ed.x1 != null) parts.push('l' + ed.x1 + ',' + ed.y1 + ',' + ed.x2 + ',' + ed.y2);
            if (ed.r != null) parts.push('cr' + ed.r);
            if (ed.adj != null) parts.push('adj' + ed.adj);
            if (ed.tailT != null) parts.push('tlt' + ed.tailT);
            if (ed.tipOffsetX != null) parts.push('tox' + ed.tipOffsetX + 'toy' + ed.tipOffsetY);
        }
        if (window.vectorQuadBezierClickState) {
            const st = window.vectorQuadBezierClickState;
            parts.push('vqbc' + st.phase);
            if (st.p0) parts.push('p0' + st.p0.x + ',' + st.p0.y);
            if (st.p1) parts.push('p1' + st.p1.x + ',' + st.p1.y);
        }
        if (window._quadBezierPreviewDoc) {
            const pr = window._quadBezierPreviewDoc;
            parts.push('vqpr' + Math.round(pr.x) + ',' + Math.round(pr.y));
        }
        if (window._pixelGradientState) {
            parts.push('pgrad' + window._pixelGradientState.x0 + ',' + window._pixelGradientState.y0);
        }
        return parts.join('|');
    },

    /** Côté d’une poignée carrée affichée ~8px à l’écran (22px en UI mobile), en unités document SVG. */
    svgUiHandleSizeDoc() {
        const base = 8;
        const touch =
            document.body.classList.contains('illu-mobile-ui') ||
            document.body.classList.contains('illu-mobile-shell-active');
        const px = touch ? 22 : base;
        return px / this.getCanvasZoomLevel();
    },

    /** Côté du bouton « déplacer » (poignée centrale) ~22px écran, en unités document SVG. */
    svgUiMoveButtonSizeDoc() {
        const touch =
            document.body.classList.contains('illu-mobile-ui') ||
            document.body.classList.contains('illu-mobile-shell-active');
        const px = touch ? 26 : 22;
        return px / this.getCanvasZoomLevel();
    },

    /** Rayon poignée rotation (px écran) selon mode UI. */
    svgUiRotationHandleRadiusDoc() {
        const touch =
            document.body.classList.contains('illu-mobile-ui') ||
            document.body.classList.contains('illu-mobile-shell-active');
        const px = touch ? 14 : 6;
        return px / this.getCanvasZoomLevel();
    },

    selectAll() {
        if (!this.activeProject) return;
        // Mode vecteur : sélectionner tous les éléments du calque actif
        if (this.mode === 'vector') {
            const g = document.getElementById('svg-layers');
            const l = this.activeLayer;
            const root = (l && document.getElementById('layer-' + l.id)) || g;
            if (root) {
                const sel = 'rect,ellipse,circle,line,path,polygon,polyline,foreignObject,text,g[data-illu-group]';
                this.activeVectorSelection = [...root.querySelectorAll(sel)];
                window._activeVectorShapeEl = this.activeVectorSelection[this.activeVectorSelection.length - 1] || null;
                if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
                this.render();
            }
            return;
        }
        window.selectionInverted = false;
        window.selectionKind = 'rect';
        window.selectionLassoPoints = null;
        window.selectionColorMask = null;
        window.selectionIsWarpQuad = false;
        window.selectionPreviewAngleRad = 0;
        window.selectionBounds = { x: 0, y: 0, w: this.width, h: this.height };
        if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        this.render();
    },

    /** Centre la sélection horizontalement sur la largeur du document (toile). */
    centerSelectionHorizontally() {
        this.centerSelection('h');
    },

    /** État sélection / forme utilisable pour centrage (pixel, vecteur, forme en édition). */
    _illuSelectionLayoutState() {
        const edit = this._illuPixelShapeEditLayoutState();
        if (edit) return { ...edit, mode: 'pixelEdit' };
        const pixel = this._illuRectSelectionLayoutState();
        if (pixel) return { ...pixel, mode: 'pixel' };
        const vector = this._illuVectorSelectionLayoutState();
        if (vector) return { ...vector, mode: 'vector' };
        return null;
    },

    canCenterSelectionLayout() {
        return !!this._illuSelectionLayoutState();
    },

    _illuVectorSelectionLayoutState() {
        if (!this.activeProject || this.mode !== 'vector') return null;
        const sel = this.activeVectorSelection;
        if (!sel || !sel.length) return null;
        const svg = document.getElementById('drawing-svg');
        if (!svg) return null;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const el of sel) {
            if (!el || !el.isConnected) continue;
            try {
                const bb = el.getBBox();
                const corners = [
                    [bb.x, bb.y],
                    [bb.x + bb.width, bb.y],
                    [bb.x + bb.width, bb.y + bb.height],
                    [bb.x, bb.y + bb.height]
                ];
                for (const [lx, ly] of corners) {
                    const pt = svg.createSVGPoint();
                    pt.x = lx;
                    pt.y = ly;
                    const m = el.getCTM();
                    const o = m ? pt.matrixTransform(m) : pt;
                    minX = Math.min(minX, o.x);
                    minY = Math.min(minY, o.y);
                    maxX = Math.max(maxX, o.x);
                    maxY = Math.max(maxY, o.y);
                }
            } catch (err) {
                /* ignore */
            }
        }
        if (!Number.isFinite(minX)) return null;
        const sb = {
            x: minX,
            y: minY,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY)
        };
        return { sb, W: this.width, H: this.height };
    },

    _illuPixelShapeEditLayoutState() {
        const ed = window.pixelShapeEdit;
        const layer = this.activeLayer;
        if (!ed || !layer || ed.layerId !== layer.id || !this.isPixelMode) return null;
        const lx = layer.x;
        const ly = layer.y;
        let x0;
        let y0;
        let x1;
        let y1;
        if (
            ed.kind === 'rect' ||
            ed.kind === 'roundrect' ||
            ed.kind === 'triangle' ||
            ed.kind === 'star' ||
            ed.kind === 'quad'
        ) {
            x0 = ed.lx + lx;
            y0 = ed.ly + ly;
            x1 = x0 + ed.w;
            y1 = y0 + ed.h;
        } else if (ed.kind === 'line') {
            x0 = Math.min(ed.x1, ed.x2) + lx;
            y0 = Math.min(ed.y1, ed.y2) + ly;
            x1 = Math.max(ed.x1, ed.x2) + lx;
            y1 = Math.max(ed.y1, ed.y2) + ly;
        } else if (ed.kind === 'ellipse') {
            x0 = ed.cx - ed.rx + lx;
            y0 = ed.cy - ed.ry + ly;
            x1 = ed.cx + ed.rx + lx;
            y1 = ed.cy + ed.ry + ly;
        } else {
            return null;
        }
        const sb = {
            x: x0,
            y: y0,
            w: Math.max(1, x1 - x0),
            h: Math.max(1, y1 - y0)
        };
        return { sb, W: this.width, H: this.height };
    },

    _illuCenterDeltaForLayout(st, axis) {
        const { sb, W, H } = st;
        let dx = 0;
        let dy = 0;
        if (axis === 'h' || axis === 'both') {
            const nx = Math.max(0, Math.min(Math.round((W - sb.w) / 2), Math.max(0, W - sb.w)));
            dx = nx - sb.x;
        }
        if (axis === 'v' || axis === 'both') {
            const ny = Math.max(0, Math.min(Math.round((H - sb.h) / 2), Math.max(0, H - sb.h)));
            dy = ny - sb.y;
        }
        return { dx, dy };
    },

    /** État sélection utilisable pour centrage (non inversée, bounds valides). */
    _illuRectSelectionLayoutState() {
        if (!this.activeProject || !this.isPixelMode) return null;
        if (window.selectionInverted) return null;
        if (
            typeof window.hasActivePixelSelection === 'function' &&
            !window.hasActivePixelSelection()
        ) {
            return null;
        }
        let sb = window.selectionBounds;
        if (
            (!sb || sb.w < 1 || sb.h < 1) &&
            window.selectionKind === 'color' &&
            typeof window.tightenColorSelectionBoundsFromMask === 'function'
        ) {
            window.tightenColorSelectionBoundsFromMask();
            sb = window.selectionBounds;
        }
        if (
            (!sb || sb.w < 1 || sb.h < 1) &&
            window.selectionKind === 'lasso' &&
            window.selectionLassoPoints &&
            window.selectionLassoPoints.length >= 3
        ) {
            const xs = window.selectionLassoPoints.map((p) => p.x);
            const ys = window.selectionLassoPoints.map((p) => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            sb = {
                x: minX,
                y: minY,
                w: Math.max(...xs) - minX,
                h: Math.max(...ys) - minY
            };
        }
        if (!sb || sb.w < 1 || sb.h < 1) return null;
        return { sb, W: this.width, H: this.height };
    },

    /**
     * Centre la sélection sur la toile (axe h, v ou les deux).
     * @param {'h'|'v'|'both'} axis
     */
    centerSelection(axis) {
        const st = this._illuSelectionLayoutState();
        if (!st) {
            window.showIlluAlert('Aucune sélection active utilisable pour le centrage.');
            return false;
        }
        const { dx, dy } = this._illuCenterDeltaForLayout(st, axis);
        if (dx === 0 && dy === 0) return true;
        if (st.mode === 'pixel') {
            return this.nudgeSelectionZone(dx, dy);
        }
        if (st.mode === 'vector') {
            if (typeof window.illuMoveVectorSelectionByDelta === 'function') {
                return window.illuMoveVectorSelectionByDelta(dx, dy);
            }
            return false;
        }
        if (st.mode === 'pixelEdit') {
            if (typeof window.illuMovePixelShapeEditByDelta === 'function') {
                return window.illuMovePixelShapeEditByDelta(dx, dy);
            }
            return false;
        }
        return false;
    },

    /**
     * Aligne la sélection sur les bords de la toile tout en gardant l'axe orthogonal fixe.
     * @param {'left'|'right'|'top'|'bottom'} edge
     */
    alignSelection(edge) {
        const st = this._illuSelectionLayoutState();
        if (!st) {
            window.showIlluAlert('Aucune sélection active utilisable pour l\'alignement.');
            return false;
        }
        const { sb, W, H } = st;
        let dx = 0;
        let dy = 0;
        if (edge === 'left') {
            dx = 0 - sb.x;
        } else if (edge === 'right') {
            dx = (W - sb.w) - sb.x;
        } else if (edge === 'top') {
            dy = 0 - sb.y;
        } else if (edge === 'bottom') {
            dy = (H - sb.h) - sb.y;
        } else {
            return false;
        }
        if (dx === 0 && dy === 0) return true;
        if (st.mode === 'pixel') {
            return this.nudgeSelectionZone(dx, dy);
        }
        if (st.mode === 'vector') {
            if (typeof window.illuMoveVectorSelectionByDelta === 'function') {
                return window.illuMoveVectorSelectionByDelta(dx, dy);
            }
            return false;
        }
        if (st.mode === 'pixelEdit') {
            if (typeof window.illuMovePixelShapeEditByDelta === 'function') {
                return window.illuMovePixelShapeEditByDelta(dx, dy);
            }
            return false;
        }
        return false;
    },

    /**
     * Ajuste/étire la sélection pour occuper la totalité de la toile.
     */
    fitSelectionToCanvas() {
        if (!this.activeProject) return false;
        const W = this.width;
        const H = this.height;
        const tool = window.activeTool;
        
        if (this.mode === 'vector') {
            const sel = this.activeVectorSelection;
            if (sel && sel.length) {
                for (const el of sel) {
                    if (['rect', 'ellipse', 'image', 'foreignObject'].includes(el.tagName)) {
                        el.setAttribute('x', '0');
                        el.setAttribute('y', '0');
                        el.setAttribute('width', String(W));
                        el.setAttribute('height', String(H));
                    } else if (el.tagName === 'circle') {
                        el.setAttribute('cx', String(W / 2));
                        el.setAttribute('cy', String(H / 2));
                        el.setAttribute('r', String(Math.min(W, H) / 2));
                    }
                }
                if (window.VectorEngine && typeof window.VectorEngine.refreshSelectionUI === 'function') {
                    window.VectorEngine.refreshSelectionUI();
                }
                this.saveHistory('Ajuster à la toile', { patchActiveLayer: true });
                this.render();
                return true;
            } else {
                window.showIlluAlert('Aucun élément vectoriel sélectionné.');
                return false;
            }
        }
        
        if (this.isPixelMode) {
            const hasSel = typeof window.hasActivePixelSelection === 'function' && window.hasActivePixelSelection();
            if (!hasSel) {
                window.showIlluAlert('Aucune sélection active utilisable pour l\'ajustement.');
                return false;
            }
            
            if (tool === 'deform' || tool === 'warp-4') {
                if (window.selectionPixelWarpActive && window.selectionWarpQuad) {
                    const q = window.selectionWarpQuad;
                    q.tl = { x: 0, y: 0 };
                    q.tr = { x: W, y: 0 };
                    q.br = { x: W, y: H };
                    q.bl = { x: 0, y: H };
                    if (window.selectionWarpDeformRect) {
                        window.selectionWarpDeformRect.rx = 0;
                        window.selectionWarpDeformRect.ry = 0;
                        window.selectionWarpDeformRect.rw = W;
                        window.selectionWarpDeformRect.rh = H;
                    }
                    window.selectionBounds = { x: 0, y: 0, w: W, h: H };
                    if (window.selectionLassoPoints && window.selectionLassoPoints.length === 4) {
                        window.selectionLassoPoints = [
                            { x: 0, y: 0 },
                            { x: W, y: 0 },
                            { x: W, y: H },
                            { x: 0, y: H }
                        ];
                    }
                    if (typeof window.runSelectionWarpPreview === 'function') {
                        window.runSelectionWarpPreview({ forceCommit: true });
                    }
                    if (typeof window.refreshSelectionVisual === 'function') {
                        window.refreshSelectionVisual();
                    }
                    this.saveHistory('Ajuster à la toile', { patchActiveLayer: true });
                    this.render();
                    return true;
                }
            }
            
            if (['select', 'wand', 'direct-select'].includes(tool)) {
                window.selectionInverted = false;
                window.selectionKind = 'rect';
                window.selectionLassoPoints = null;
                window.selectionColorMask = null;
                window.selectionIsWarpQuad = false;
                window.selectionPreviewAngleRad = 0;
                window.selectionBounds = { x: 0, y: 0, w: W, h: H };
                if (typeof window.refreshSelectionVisual === 'function') {
                    window.refreshSelectionVisual();
                }
                this.render();
                return true;
            }
        }
        return false;
    },

    /**
     * Déplace la zone sélectionnée selon l’outil actif (marquee, pixels, warp…).
     * @param {number} dx
     * @param {number} dy
     * @param {{ step?: number; deferHistory?: boolean }} [opts] — step : pas en px ; deferHistory : une entrée historique à la fin (flèches clavier)
     */
    nudgeSelectionZone(dx, dy, opts) {
        opts = opts || {};
        if (!this.activeProject || (dx === 0 && dy === 0)) return false;
        const step = opts.step != null && Number.isFinite(opts.step) ? opts.step : 1;
        dx = Math.round(dx * step);
        dy = Math.round(dy * step);
        if (dx === 0 && dy === 0) return false;

        const tool = window.activeTool;

        if (
            (tool === 'deform' || tool === 'warp-4') &&
            window.selectionPixelWarpActive &&
            typeof window.nudgeSelectionWarpSessionDelta === 'function' &&
            window.nudgeSelectionWarpSessionDelta(dx, dy, opts)
        ) {
            return true;
        }
        if (tool === 'move' || tool === 'deform' || tool === 'warp-4') {
            this.applyMoveToolNudge(dx, dy, opts);
            return true;
        }
        if (
            ['select', 'wand', 'direct-select'].includes(tool) &&
            typeof window.illuNudgeSelectionMarquee === 'function'
        ) {
            return window.illuNudgeSelectionMarquee(dx, dy);
        }
        return false;
    },

    deselectAll(opts) {
        opts = opts || {};
        if (
            this.isPixelMode &&
            !opts.skipImportCommit &&
            typeof this.commitImportPlacementIfPending === 'function'
        ) {
            this.commitImportPlacementIfPending();
        }
        // Mode vecteur : vider la sélection SVG + fantôme sélection pixel
        if (this.mode === 'vector') {
            this.activeVectorSelection = [];
            window._activeVectorShapeEl = null;
            if (window.VectorEngine) window.VectorEngine.clearUI();
            if (window.clearAnchors) window.clearAnchors();
            if (window.VectorEngine) window.VectorEngine.cancelAll();
            if (typeof window.illuPurgeSelectionOverlayAndGhostDom === 'function') {
                window.illuPurgeSelectionOverlayAndGhostDom();
            }
            if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            this.render();
            return;
        }
        if (typeof window.illuInvalidatePendingWandWorker === 'function') {
            window.illuInvalidatePendingWandWorker();
        }
        if (typeof window.illuPurgeSelectionOverlayAndGhostDom === 'function') {
            window.illuPurgeSelectionOverlayAndGhostDom();
        } else if (typeof window.cancelSelectionInteractionState === 'function') {
            window.cancelSelectionInteractionState();
        }
        window.selectionInverted = false;
        window.selectionBounds = null;
        window.selectionKind = 'rect';
        window.selectionLassoPoints = null;
        window.selectionColorMask = null;
        window.selectionIsWarpQuad = false;
        window.selectionCombineGhost = null;
        window.selectionPreviewAngleRad = 0;
        window.selectionRotationDragActive = false;
        const overlay = document.getElementById('selection-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.innerHTML = '';
        }
        window.clearAnchors && window.clearAnchors();
        if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        this.render();
    },

    /** Inverse la sélection (rect, masque couleur, lasso). Ctrl+I */
    invertSelection() {
        if (!this.activeProject) return;
        const hasSel =
            typeof window.hasActivePixelSelection === 'function' && window.hasActivePixelSelection();
        if (!hasSel) {
            this.selectAll();
            return;
        }
        const sb = window.selectionBounds;
        if (
            window.selectionKind === 'color' &&
            window.selectionColorMask &&
            this.colorMaskMatchesActiveLayer(window.selectionColorMask)
        ) {
            const m = window.selectionColorMask;
            const d = m.data;
            for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 1;
            if (typeof window.illuInvalidateSelectionMaskCache === 'function') {
                window.illuInvalidateSelectionMaskCache(m);
            } else {
                delete m._cachedPath;
                delete m._cachedKey;
                delete m._cachedStride;
            }
            window.selectionInverted = false;
            if (typeof window.tightenColorSelectionBoundsFromMask === 'function') {
                window.tightenColorSelectionBoundsFromMask();
            }
            if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
            if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
            if (typeof window.illuSyncSelectionAdjustToolbar === 'function') window.illuSyncSelectionAdjustToolbar();
            this.render();
            return;
        }
        if (
            window.selectionKind === 'lasso' &&
            window.selectionLassoPoints &&
            window.selectionLassoPoints.length >= 3
        ) {
            const l = this.activeLayer;
            if (l && l.buffer && typeof window.rasterizeDocLassoPolygonToLayerMask === 'function') {
                const lw = l.buffer.width;
                const lh = l.buffer.height;
                const mask = new Uint8Array(lw * lh);
                window.rasterizeDocLassoPolygonToLayerMask(
                    window.selectionLassoPoints,
                    l.x,
                    l.y,
                    lw,
                    lh,
                    mask
                );
                for (let i = 0; i < mask.length; i++) mask[i] = mask[i] ? 0 : 1;
                if (typeof window.commitLayerMaskAsSelection === 'function') {
                    window.commitLayerMaskAsSelection(mask, lw, lh);
                }
                if (typeof window.illuSyncSelectionAdjustToolbar === 'function') window.illuSyncSelectionAdjustToolbar();
                this.render();
                return;
            }
        }
        if (!sb) {
            this.selectAll();
            return;
        }
        if (sb.x <= 0 && sb.y <= 0 && sb.w >= this.width && sb.h >= this.height) {
            this.deselectAll();
            return;
        }
        window.selectionInverted = !window.selectionInverted;
        if (typeof window.disarmSelectionRectFreeCornersArm === 'function') window.disarmSelectionRectFreeCornersArm();
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        if (typeof window.illuSyncSelectionAdjustToolbar === 'function') window.illuSyncSelectionAdjustToolbar();
        this.render();
    },

    drawUI(force) {
        const svgUI = document.getElementById('svg-ui');
        if (!svgUI) return;
        const signature = this._computeDrawUiSignature();
        if (!force && this._lastDrawUiSignature === signature) return;
        this._lastDrawUiSignature = signature;

        if (this.mode === 'vector') {
            const el = typeof window._activeVectorShapeEl !== 'undefined' ? window._activeVectorShapeEl : null;
            const svgLayersRoot = document.getElementById('svg-layers');
            if (el && el.isConnected && svgLayersRoot && svgLayersRoot.contains(el)) {
                if (typeof window.regenerateVectorAnchorsOnly === 'function') {
                    window.regenerateVectorAnchorsOnly(el);
                }
            } else {
                svgUI.innerHTML = '';
                window._activeVectorShapeEl = null;
            }
            if (typeof window.syncVectorSelectionAfterUiRedraw === 'function') {
                window.syncVectorSelectionAfterUiRedraw();
            }
            if (typeof window.drawQuadBezierDraftInSvgUi === 'function') {
                window.drawQuadBezierDraftInSvgUi(svgUI);
            }
            return;
        }

        svgUI.innerHTML = '';

        const layer = this.activeLayer;
        if (!layer) return;

        const sb = window.selectionBounds;
        const ov = document.getElementById('selection-overlay');
        const Wdoc = this.width;
        const Hdoc = this.height;
        const buf = layer.buffer;
        const layerSmallerThanCanvas =
            buf && (buf.width < Wdoc || buf.height < Hdoc);
        const hideChromeMove =
            window.activeTool === 'move' &&
            !window.illuCropSessionActive &&
            !layerSmallerThanCanvas &&
            typeof window.selectionMatchesActiveLayer === 'function' &&
            window.selectionMatchesActiveLayer();
        const showSelChrome =
            sb &&
            ov &&
            ov.style.display !== 'none' &&
            !window.selectionInverted &&
            sb.w > 2 &&
            sb.h > 2 &&
            !hideChromeMove;

        if (showSelChrome) {
            const hideResizeForRotation =
                Math.abs(window.selectionPreviewAngleRad || 0) > 1e-6 || window.selectionRotationDragActive;
            const strictSubset =
                typeof window.selectionIsStrictSubsetOfActiveLayer === 'function' &&
                window.selectionIsStrictSubsetOfActiveLayer();
            /* Après une déformation, le cadre peut dépasser le calque : strictSubset devient faux.
               Il faut garder les poignées déformation tant qu’on a un quad (tl,tr,br,bl). */
            const warpQuadContinues =
                window.selectionIsWarpQuad &&
                window.selectionKind === 'lasso' &&
                window.selectionLassoPoints &&
                window.selectionLassoPoints.length === 4;
            const matchesActiveLayer =
                typeof window.selectionMatchesActiveLayer === 'function' &&
                window.selectionMatchesActiveLayer();
            const canDeformWarp = true;
            const warp4Tool = this.isPixelMode && window.activeTool === 'warp-4' && canDeformWarp;
            const deformTool = this.isPixelMode && window.activeTool === 'deform' && canDeformWarp;
            const selectFreeQuad =
                this.isPixelMode &&
                window.activeTool === 'select' &&
                window.selectionIsWarpQuad &&
                window.selectionKind === 'lasso' &&
                window.selectionLassoPoints &&
                window.selectionLassoPoints.length === 4;
            const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            const handlesFromRect = (x, y, w, h, withCenter) => {
                const base = [
                    { x, y, cursor: 'nw-resize', id: 'nw' },
                    { x: x + w / 2, y, cursor: 'n-resize', id: 'n' },
                    { x: x + w, y, cursor: 'ne-resize', id: 'ne' },
                    { x, y: y + h / 2, cursor: 'w-resize', id: 'w' },
                    { x: x + w, y: y + h / 2, cursor: 'e-resize', id: 'e' },
                    { x, y: y + h, cursor: 'sw-resize', id: 'sw' },
                    { x: x + w / 2, y: y + h, cursor: 's-resize', id: 's' },
                    { x: x + w, y: y + h, cursor: 'se-resize', id: 'se' }
                ];
                if (withCenter) {
                    base.push({
                        x: x + w / 2,
                        y: y + h / 2,
                        cursor: 'move',
                        id: 'c'
                    });
                }
                return base;
            };
            let handles;
            if (window.selectionPixelWarpActive && window.selectionWarpQuad) {
                const q = window.selectionWarpQuad;
                if (window.activeTool === 'deform') {
                    const n = mid(q.tl, q.tr);
                    const em = mid(q.tr, q.br);
                    const sm = mid(q.br, q.bl);
                    const wm = mid(q.bl, q.tl);
                    const cx = (q.tl.x + q.tr.x + q.br.x + q.bl.x) / 4;
                    const cy = (q.tl.y + q.tr.y + q.br.y + q.bl.y) / 4;
                    handles = [
                        { x: q.tl.x, y: q.tl.y, cursor: 'nw-resize', id: 'nw' },
                        { x: n.x, y: n.y, cursor: 'n-resize', id: 'n' },
                        { x: q.tr.x, y: q.tr.y, cursor: 'ne-resize', id: 'ne' },
                        { x: wm.x, y: wm.y, cursor: 'w-resize', id: 'w' },
                        { x: em.x, y: em.y, cursor: 'e-resize', id: 'e' },
                        { x: q.bl.x, y: q.bl.y, cursor: 'sw-resize', id: 'sw' },
                        { x: sm.x, y: sm.y, cursor: 's-resize', id: 's' },
                        { x: q.br.x, y: q.br.y, cursor: 'se-resize', id: 'se' },
                        { x: cx, y: cy, cursor: 'move', id: 'c' }
                    ];
                } else {
                    handles = [
                        { x: q.tl.x, y: q.tl.y, cursor: 'nw-resize', id: 'nw' },
                        { x: q.tr.x, y: q.tr.y, cursor: 'ne-resize', id: 'ne' },
                        { x: q.br.x, y: q.br.y, cursor: 'se-resize', id: 'se' },
                        { x: q.bl.x, y: q.bl.y, cursor: 'sw-resize', id: 'sw' }
                    ];
                }
            } else if (selectFreeQuad && !hideResizeForRotation) {
                const pts = window.selectionLassoPoints;
                const tl = pts[0];
                const tr = pts[1];
                const br = pts[2];
                const bl = pts[3];
                handles = [
                    { x: tl.x, y: tl.y, cursor: 'nw-resize', id: 'nw' },
                    { x: tr.x, y: tr.y, cursor: 'ne-resize', id: 'ne' },
                    { x: br.x, y: br.y, cursor: 'se-resize', id: 'se' },
                    { x: bl.x, y: bl.y, cursor: 'sw-resize', id: 'sw' }
                ];
            } else if (
                deformTool &&
                !hideResizeForRotation &&
                window.selectionIsWarpQuad &&
                window.selectionKind === 'lasso' &&
                window.selectionLassoPoints &&
                window.selectionLassoPoints.length === 4
            ) {
                const pts = window.selectionLassoPoints;
                const q = { tl: pts[0], tr: pts[1], br: pts[2], bl: pts[3] };
                const n = mid(q.tl, q.tr);
                const em = mid(q.tr, q.br);
                const sm = mid(q.br, q.bl);
                const wm = mid(q.bl, q.tl);
                const cx = (q.tl.x + q.tr.x + q.br.x + q.bl.x) / 4;
                const cy = (q.tl.y + q.tr.y + q.br.y + q.bl.y) / 4;
                handles = [
                    { x: q.tl.x, y: q.tl.y, cursor: 'nw-resize', id: 'nw' },
                    { x: n.x, y: n.y, cursor: 'n-resize', id: 'n' },
                    { x: q.tr.x, y: q.tr.y, cursor: 'ne-resize', id: 'ne' },
                    { x: wm.x, y: wm.y, cursor: 'w-resize', id: 'w' },
                    { x: em.x, y: em.y, cursor: 'e-resize', id: 'e' },
                    { x: q.bl.x, y: q.bl.y, cursor: 'sw-resize', id: 'sw' },
                    { x: sm.x, y: sm.y, cursor: 's-resize', id: 's' },
                    { x: q.br.x, y: q.br.y, cursor: 'se-resize', id: 'se' },
                    { x: cx, y: cy, cursor: 'move', id: 'c' }
                ];
            } else if (deformTool && !hideResizeForRotation) {
                const x = sb.x;
                const y = sb.y;
                const w = sb.w;
                const h = sb.h;
                handles = handlesFromRect(x, y, w, h, true);
            } else if (warp4Tool && !hideResizeForRotation) {
                const pts =
                    window.selectionIsWarpQuad &&
                    window.selectionKind === 'lasso' &&
                    window.selectionLassoPoints &&
                    window.selectionLassoPoints.length === 4
                        ? window.selectionLassoPoints
                        : null;
                if (pts) {
                    const tl = pts[0];
                    const tr = pts[1];
                    const br = pts[2];
                    const bl = pts[3];
                    handles = [
                        { x: tl.x, y: tl.y, cursor: 'nw-resize', id: 'nw' },
                        { x: tr.x, y: tr.y, cursor: 'ne-resize', id: 'ne' },
                        { x: br.x, y: br.y, cursor: 'se-resize', id: 'se' },
                        { x: bl.x, y: bl.y, cursor: 'sw-resize', id: 'sw' }
                    ];
                } else {
                    handles = handlesFromRect(sb.x, sb.y, sb.w, sb.h, false).filter((hnd) =>
                        ['nw', 'ne', 'se', 'sw'].includes(hnd.id)
                    );
                }
            } else if (
                !hideResizeForRotation &&
                window.activeTool === 'move' &&
                window.selectionKind === 'lasso' &&
                window.selectionLassoPoints &&
                window.selectionLassoPoints.length === 4 &&
                window.selectionIsWarpQuad &&
                !window.selectionPixelWarpActive
            ) {
                const pts = window.selectionLassoPoints;
                handles = [
                    { x: pts[0].x, y: pts[0].y, cursor: 'nw-resize', id: 'nw' },
                    { x: pts[1].x, y: pts[1].y, cursor: 'ne-resize', id: 'ne' },
                    { x: pts[2].x, y: pts[2].y, cursor: 'se-resize', id: 'se' },
                    { x: pts[3].x, y: pts[3].y, cursor: 'sw-resize', id: 'sw' }
                ];
            } else if (!hideResizeForRotation) {
                const x = sb.x;
                const y = sb.y;
                const w = sb.w;
                const h = sb.h;
                handles = handlesFromRect(x, y, w, h, !!window.illuCropSessionActive);
            } else {
                handles = [];
            }
            const z = this.getCanvasZoomLevel();
            const hsz = this.svgUiHandleSizeDoc();
            handles.forEach((hnd) => {
                const useMoveIconCenter =
                    hnd.id === 'c' &&
                    (window.activeTool === 'deform' || window.illuCropSessionActive);
                if (useMoveIconCenter) {
                    const size = EditorManager.svgUiMoveButtonSizeDoc();
                    const half = size / 2;
                    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
                    fo.setAttribute('x', String(hnd.x - half));
                    fo.setAttribute('y', String(hnd.y - half));
                    fo.setAttribute('width', String(size));
                    fo.setAttribute('height', String(size));
                    fo.setAttribute('class', 'illu-deform-move-fo');
                    fo.setAttribute('data-selection-handle', 'c');
                    fo.setAttribute('style', 'overflow: visible; pointer-events: all;');
                    const wrap = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                    wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                    wrap.style.cssText =
                        'display:flex;align-items:center;justify-content:center;width:100%;height:100%;margin:0;padding:0;box-sizing:border-box;';
                    const btn = document.createElementNS('http://www.w3.org/1999/xhtml', 'button');
                    btn.setAttribute('type', 'button');
                    btn.setAttribute(
                        'class',
                        'illu-pixel-text-move-btn illu-deform-selection-move-btn'
                    );
                    btn.innerHTML =
                        '<i class="fa-solid fa-arrows-up-down-left-right illu-deform-move-icon" aria-hidden="true"></i>';
                    const moveTitle =
                        window.IlluI18n && typeof window.IlluI18n.t === 'function'
                            ? window.IlluI18n.t('tools.deformMoveHandle')
                            : 'Déplacer';
                    btn.setAttribute('title', moveTitle);
                    btn.setAttribute('aria-label', moveTitle);
                    const runDeformMove = (ev) => {
                        if (ev.button != null && ev.button !== 0) return;
                        ev.preventDefault();
                        ev.stopPropagation();
                        if (window.illuCropSessionActive) {
                            if (typeof window.illuCropSelectionMoveButtonMouseDown === 'function') {
                                window.illuCropSelectionMoveButtonMouseDown(ev);
                            }
                        } else if (typeof window.illuDeformSelectionMoveButtonMouseDown === 'function') {
                            window.illuDeformSelectionMoveButtonMouseDown(ev);
                        }
                        /* Souris incluse : sans capture, les mousemove depuis le foreignObject SVG sont souvent perdus jusqu’au relâchement. */
                        if (ev.pointerId != null) {
                            try {
                                window._illuDeformMoveFromButtonEl = btn;
                                window._illuDeformMoveFromButtonPointerId = ev.pointerId;
                                btn.setPointerCapture(ev.pointerId);
                            } catch (err) {
                                /* ignore */
                            }
                        }
                    };
                    const releaseDeformMoveCapture = (ev) => {
                        if (ev.button != null && ev.button !== 0) return;
                        /* Sans ceci, le relâchement sur le bouton (capture pointeur) ne déclenchait pas toujours handleMouseUp sur window — session bloquée. */
                        if (typeof window.illuHandleMouseUp === 'function') {
                            window.illuHandleMouseUp(ev);
                        }
                        if (typeof window.illuReleaseDeformMoveButtonPointerCapture === 'function') {
                            window.illuReleaseDeformMoveButtonPointerCapture();
                        }
                    };
                    btn.addEventListener('pointerup', releaseDeformMoveCapture, { capture: true });
                    btn.addEventListener('mouseup', releaseDeformMoveCapture, { capture: true });
                    btn.addEventListener('pointercancel', releaseDeformMoveCapture, { capture: true });
                    btn.addEventListener('lostpointercapture', releaseDeformMoveCapture, { capture: true });
                    btn.addEventListener('pointerdown', runDeformMove, { passive: false });
                    wrap.appendChild(btn);
                    fo.appendChild(wrap);
                    svgUI.appendChild(fo);
                    return;
                }
                const hHalf = hsz / 2;
            const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                r.setAttribute('x', hnd.x - hHalf);
                r.setAttribute('y', hnd.y - hHalf);
                r.setAttribute('width', String(hsz));
                r.setAttribute('height', String(hsz));
            r.setAttribute('fill', '#ffffff');
            r.setAttribute('stroke', '#000000');
                r.setAttribute('stroke-width', String(1 / z));
                const handleCursor =
                    typeof window.illuResizeHandleCursor === 'function'
                        ? window.illuResizeHandleCursor(hnd.cursor)
                        : hnd.cursor;
                r.setAttribute('style', `cursor: ${handleCursor}; pointer-events: all; touch-action: none;`);
                r.setAttribute('data-selection-handle', hnd.id);
                const runSelectionHandleDown = (ev) => {
                    if (ev.button != null && ev.button !== 0) return;
                    ev.stopPropagation();
                    if (typeof ev.preventDefault === 'function') ev.preventDefault();
                    if (typeof window.onSelectionHandleMouseDown === 'function') {
                        window.onSelectionHandleMouseDown(ev, hnd.id);
                    }
                    /* ONLY set isDrawing here AFTER initialization attempt */
                    if (window.selectionPixelWarpActive || window.selectionBoundsResizeActive) {
                        window.isDrawing = true;
                    }
                    if (ev.pointerId != null) {
                        try {
                            r.setPointerCapture(ev.pointerId);
                        } catch (err) {
                            /* ignore */
                        }
                    }
                };
                const releaseSelectionHandleCapture = (ev) => {
                    if (ev.button != null && ev.button !== 0) return;
                    if (typeof window.illuHandleMouseUp === 'function') {
                        window.illuHandleMouseUp(ev);
                    }
                    if (ev.pointerId != null) {
                        try {
                            r.releasePointerCapture(ev.pointerId);
                        } catch (err) {
                            /* ignore */
                        }
                    }
                };
                /* onpointerdown déclenche le handler ; onmousedown bloque uniquement la propagation
                   pour éviter que le container n'appelle handleMouseDown une seconde fois. */
                r.onpointerdown = runSelectionHandleDown;
                r.onmousedown = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
                r.addEventListener('pointerup', releaseSelectionHandleCapture, { capture: true });
                r.addEventListener('mouseup', releaseSelectionHandleCapture, { capture: true });
                r.addEventListener('pointercancel', releaseSelectionHandleCapture, { capture: true });
                r.addEventListener('lostpointercapture', releaseSelectionHandleCapture, { capture: true });
            svgUI.appendChild(r);
        });

            const toolsAllowingSelRotation = new Set(['move', 'warp-4', 'deform']);
            const showRot =
                !window.illuCropSessionActive &&
                (window.selectionKind === 'rect' || (window.selectionIsWarpQuad && window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length === 4)) &&
                !window.selectionInverted &&
                toolsAllowingSelRotation.has(window.activeTool || '');
            if (showRot) {
                const rhp = this.selectionRotationHandleDocXY(sb, window.selectionPreviewAngleRad || 0, window.selectionKind === 'lasso' ? window.selectionLassoPoints : null);
                const rx = rhp.x;
                const ry = rhp.y;
                const rotR = this.svgUiRotationHandleRadiusDoc();
                const rh = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                rh.setAttribute('cx', rx);
                rh.setAttribute('cy', ry);
                rh.setAttribute('r', String(rotR));
                rh.setAttribute('fill', '#aecbfa');
                rh.setAttribute('stroke', '#000000');
                rh.setAttribute('stroke-width', String(1 / this.getCanvasZoomLevel()));
                rh.setAttribute('style', `cursor: ${typeof window.illuGrabCursor === 'function' ? window.illuGrabCursor() : 'grab'}; pointer-events: all; touch-action: none;`);
                rh.setAttribute('data-selection-handle', 'rot');
                const runRotationHandleDown = (ev) => {
                    if (ev.button != null && ev.button !== 0) return;
                    ev.stopPropagation();
                    if (typeof ev.preventDefault === 'function') ev.preventDefault();
                    if (typeof window.onSelectionHandleMouseDown === 'function') {
                        window.onSelectionHandleMouseDown(ev, 'rot');
                    }
                    if (window.selectionRotationDragActive) {
                        window.isDrawing = true;
                    }
                    if (ev.pointerId != null) {
                        try {
                            rh.setPointerCapture(ev.pointerId);
                        } catch (err) {
                            /* ignore */
                        }
                    }
                };
                const releaseRotationHandleCapture = (ev) => {
                    if (ev.button != null && ev.button !== 0) return;
                    if (typeof window.illuHandleMouseUp === 'function') {
                        window.illuHandleMouseUp(ev);
                    }
                    if (ev.pointerId != null) {
                        try {
                            rh.releasePointerCapture(ev.pointerId);
                        } catch (err) {
                            /* ignore */
                        }
                    }
                };
                rh.onpointerdown = runRotationHandleDown;
                rh.onmousedown = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
                rh.addEventListener('pointerup', releaseRotationHandleCapture, { capture: true });
                rh.addEventListener('mouseup', releaseRotationHandleCapture, { capture: true });
                rh.addEventListener('pointercancel', releaseRotationHandleCapture, { capture: true });
                rh.addEventListener('lostpointercapture', releaseRotationHandleCapture, { capture: true });
                svgUI.appendChild(rh);
            }
        }

        const hi = this._layerListHoverIndex;
        if (hi != null && hi >= 0 && hi < this.layers.length && this.isPixelMode) {
            const hl = this.layers[hi];
            if (hl && hl.buffer) {
                const z = this.getCanvasZoomLevel();
                const rr = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rr.setAttribute('x', String(hl.x));
                rr.setAttribute('y', String(hl.y));
                rr.setAttribute('width', String(hl.buffer.width));
                rr.setAttribute('height', String(hl.buffer.height));
                rr.setAttribute('fill', 'none');
                rr.setAttribute('stroke', '#0a84ff');
                rr.setAttribute('stroke-width', String(2 / z));
                rr.setAttribute('pointer-events', 'none');
                svgUI.appendChild(rr);
            }
        }

        if (typeof window.illuGetSymmetryAxes === 'function') {
            const sym = window.illuGetSymmetryAxes();
            if (sym && (sym.x || sym.y)) {
                const z = this.getCanvasZoomLevel();
                if (sym.x) {
                    const lX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    lX.setAttribute('x1', String(sym.cx));
                    lX.setAttribute('y1', '0');
                    lX.setAttribute('x2', String(sym.cx));
                    lX.setAttribute('y2', String(this.height));
                    lX.setAttribute('stroke', '#00ffff');
                    lX.setAttribute('stroke-width', String(1 / z));
                    lX.setAttribute('stroke-dasharray', '5,5');
                    lX.setAttribute('pointer-events', 'none');
                    svgUI.appendChild(lX);
                }
                if (sym.y) {
                    const lY = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    lY.setAttribute('x1', '0');
                    lY.setAttribute('y1', String(sym.cy));
                    lY.setAttribute('x2', String(this.width));
                    lY.setAttribute('y2', String(sym.cy));
                    lY.setAttribute('stroke', '#00ffff');
                    lY.setAttribute('stroke-width', String(1 / z));
                    lY.setAttribute('stroke-dasharray', '5,5');
                    lY.setAttribute('pointer-events', 'none');
                    svgUI.appendChild(lY);
                }
            }
        }
        
        if (window.activeTool === 'clone' && !window.cloneAnchor && window.lastKnownMousePos) {
            const z = this.zoomLevel || 1.0;
            const docX = window.lastKnownMousePos.x;
            const docY = window.lastKnownMousePos.y;
            const crossSize = 10 / z;
            const crossG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            crossG.setAttribute('pointer-events', 'none');

            const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            l1.setAttribute('x1', String(docX - crossSize)); l1.setAttribute('y1', String(docY));
            l1.setAttribute('x2', String(docX + crossSize)); l1.setAttribute('y2', String(docY));
            l1.setAttribute('stroke', '#ff0000'); l1.setAttribute('stroke-width', String(2 / z));
            
            const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            l2.setAttribute('x1', String(docX)); l2.setAttribute('y1', String(docY - crossSize));
            l2.setAttribute('x2', String(docX)); l2.setAttribute('y2', String(docY + crossSize));
            l2.setAttribute('stroke', '#ff0000'); l2.setAttribute('stroke-width', String(2 / z));
            
            const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circ.setAttribute('cx', String(docX)); circ.setAttribute('cy', String(docY));
            circ.setAttribute('r', String(5 / z));
            circ.setAttribute('fill', 'none'); circ.setAttribute('stroke', '#ff0000'); circ.setAttribute('stroke-width', String(1 / z));

            crossG.appendChild(l1);
            crossG.appendChild(l2);
            crossG.appendChild(circ);
            svgUI.appendChild(crossG);
        }

        if (window.activeTool === 'clone' && window.cloneAnchor && typeof isDrawing !== 'undefined' && isDrawing && window.lastKnownMousePos) {
            const z = this.zoomLevel || 1.0;
            const offset = window.cloneOffset || {x: 0, y: 0};
            
            // Mouse doc coords
            const docX = window.lastKnownMousePos.x;
            const docY = window.lastKnownMousePos.y;
            
            const srcDocX = docX - offset.x * z;
            const srcDocY = docY - offset.y * z;
            
            const crossSize = 10 / z;
            
            const crossG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            crossG.setAttribute('pointer-events', 'none');
            
            const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            l1.setAttribute('x1', String(srcDocX - crossSize));
            l1.setAttribute('y1', String(srcDocY));
            l1.setAttribute('x2', String(srcDocX + crossSize));
            l1.setAttribute('y2', String(srcDocY));
            l1.setAttribute('stroke', '#000000');
            l1.setAttribute('stroke-width', String(1 / z));
            
            const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            l2.setAttribute('x1', String(srcDocX));
            l2.setAttribute('y1', String(srcDocY - crossSize));
            l2.setAttribute('x2', String(srcDocX));
            l2.setAttribute('y2', String(srcDocY + crossSize));
            l2.setAttribute('stroke', '#000000');
            l2.setAttribute('stroke-width', String(1 / z));
            
            crossG.appendChild(l1);
            crossG.appendChild(l2);
            svgUI.appendChild(crossG);
        }

        if (typeof window.drawQuadBezierDraftInSvgUi === 'function') {
            window.drawQuadBezierDraftInSvgUi(svgUI);
        }
        if (typeof window.drawPixelOverlayHandles === 'function') {
            window.drawPixelOverlayHandles(svgUI);
        }
    },

    /**
     * Fermeture du document principal depuis le menu Fichier : replie les onglets masque α,
     * puis même flux que la croix d’onglet (export / ne pas enregistrer / annuler).
     */
    requestCloseActiveDocumentFromMenu() {
        const p = this.activeProject;
        if (!p) return;
        let mainIdx = this.activeProjectIndex;
        let mainProject = p;
        if (p.role === 'layerAlphaMask') {
            const pi = this.projects.findIndex((pr) => pr.id === p.parentProjectId);
            if (pi >= 0) {
                mainIdx = pi;
                mainProject = this.projects[pi];
            }
        }
        this.projects.forEach((q) => {
            if (q.role === 'layerAlphaMask' && q.parentProjectId === mainProject.id) {
                q.alphaMaskUiHidden = true;
            }
        });
        if (this.activeProjectIndex !== mainIdx) {
            this.switchProject(mainIdx);
        } else {
            this.updateTabUI();
        }
        this.requestCloseProject(mainIdx);
    },

    requestCloseProject(index) {
        if (index < 0 || index >= this.projects.length) return;
        const p = this.projects[index];
        if (p && p.role === 'layerAlphaMask') {
            this.closeLinkedAlphaMaskTab(index);
            return;
        }
        this.pendingCloseIndex = index;
        const ov = document.getElementById('close-tab-overlay');
        if (ov) {
            ov.style.display = 'flex';
            const msg = document.getElementById('close-tab-message');
            if (msg && p) {
                if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
                    msg.textContent = window.IlluI18n.t('dlg.closeTabNamed', { name: p.name });
                } else {
                    msg.textContent = `Exporter « ${p.name} » (projet .illu ou image) avant de fermer cet onglet ?`;
                }
            }
        }
    },

    /**
     * Ferme l’onglet d’édition du masque : le projet masque reste dans le document (lié au calque),
     * seul l’onglet est retiré de la barre jusqu’à la réouverture via le bouton α du calque.
     */
    closeLinkedAlphaMaskTab(index) {
        const p = this.projects[index];
        if (!p || p.role !== 'layerAlphaMask') return;
        p.alphaMaskUiHidden = true;
        const parentIdx = this.projects.findIndex((pr) => pr.id === p.parentProjectId);
        const target = parentIdx >= 0 ? parentIdx : 0;
        this.switchProject(target);
        this.updateTabUI();
    },

    /** Clic droit calque : n’afficher que ce calque (les autres masqués). */
    illuContextLayerSolo(idx) {
        if (!this.activeProject || !Array.isArray(this.layers)) return;
        if (idx < 0 || idx >= this.layers.length) return;
        this.layers.forEach((l, i) => {
            l.visible = i === idx;
        });
        this.setActiveLayerIndex(idx);
        this.render();
        this.saveHistory(
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('ctx.layerSoloHistory')
                : 'Solo : un calque',
            {}
        );
        this.updateLayerUI();
    },

    /** Clic droit calque : tout afficher. */
    illuContextLayerShowAll() {
        if (!this.activeProject || !Array.isArray(this.layers)) return;
        this.layers.forEach((l) => {
            l.visible = true;
        });
        this.render();
        this.saveHistory(
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('ctx.layerShowAllHistory')
                : 'Tous les calques visibles',
            {}
        );
        this.updateLayerUI();
    },

    illuContextLayerActivate(idx) {
        if (!this.activeProject || !Array.isArray(this.layers)) return;
        if (idx < 0 || idx >= this.layers.length) return;
        this.setActiveLayerIndex(idx);
        this.updateLayerUI();
        this.render();
    },

    illuContextLayerToggleVisible(idx) {
        if (!this.activeProject || !Array.isArray(this.layers)) return;
        const l = this.layers[idx];
        if (!l) return;
        l.visible = !l.visible;
        this.render();
        this.saveHistory(
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('ctx.layerToggleVisHistory')
                : 'Visibilité calque',
            {}
        );
        this.updateLayerUI();
    },

    illuContextDuplicatePixelLayer(idx) {
        if (!this.isPixelMode || !this.activeProject || !Array.isArray(this.layers)) return;
        const l = this.layers[idx];
        if (!l || !l.buffer) return;
        const nc = document.createElement('canvas');
        nc.width = l.buffer.width;
        nc.height = l.buffer.height;
        nc.getContext('2d', { willReadFrequently: true }).drawImage(l.buffer, 0, 0);
        const copySuffix =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('ctx.layerDupSuffix')
                : ' (copie)';
        const copy = {
            id: Date.now() + Math.floor(Math.random() * 1e6),
            name: (l.name || 'Calque') + copySuffix,
            visible: true,
            x: l.x,
            y: l.y,
            opacity: l.opacity != null ? l.opacity : 1,
            blendMode: l.blendMode || 'source-over',
            alphaMaskProjectId: null,
            ...this._defaultDynamicFilterLayerProps(),
            buffer: nc
        };
        this.layers.splice(idx + 1, 0, copy);
        this.setActiveLayerIndex(idx + 1);
        this.saveHistory(
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('ctx.layerDupHistory')
                : 'Dupliquer calque',
            {}
        );
        this.updateLayerUI();
        this.render();
    },

    /** Barre calques : dupliquer le calque actif (mode Pixel, tampon présent). */
    duplicateActiveLayer() {
        if (window._illuFinishingWarp) return;
        if (!this.activeProject || !Array.isArray(this.layers)) return;
        if (!this.isPixelMode) {
            window.showIlluAlert(
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('msg.layerDupPixelOnly')
                    : 'La duplication de calque est disponible en mode Pixel.'
            );
            return;
        }
        const l = this.layers[this.activeLayerIndex];
        if (!l || !l.buffer) return;
        this.illuContextDuplicatePixelLayer(this.activeLayerIndex);
    },

    async illuContextDuplicateProject(mainIndex) {
        const p = this.projects[mainIndex];
        if (!p || p.role === 'layerAlphaMask') return;
        const full = this.serializeWorkspacePayload();
        const blocks = this._getProjectBlocksForReorder();
        const block = blocks.find((b) => b[0] === mainIndex);
        if (!block) return;
        const lastIdx = block[block.length - 1];
        const cloneMain = JSON.parse(JSON.stringify(full.projects[mainIndex]));
        const nid = Date.now() + Math.floor(Math.random() * 1e7);
        cloneMain.id = nid;
        const copySuffix =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('ctx.tabDupSuffix')
                : ' (copie)';
        cloneMain.name = (cloneMain.name || 'Sans titre') + copySuffix;
        let lid = nid + 31;
        if (Array.isArray(cloneMain.pixelLayers)) {
            cloneMain.pixelLayers = cloneMain.pixelLayers.map((pl) => {
                lid += 7;
                return { ...pl, id: lid, alphaMaskProjectId: null };
            });
        }
        if (Array.isArray(cloneMain.vectorLayers)) {
            cloneMain.vectorLayers = cloneMain.vectorLayers.map((vl) => {
                lid += 7;
                return { ...vl, id: lid };
            });
        }
        cloneMain.historySerialized = [];
        cloneMain.historyIndex = -1;
        const newProjects = [];
        for (let k = 0; k < full.projects.length; k++) {
            newProjects.push(full.projects[k]);
            if (k === lastIdx) newProjects.push(cloneMain);
        }
        const newPayload = {
            ...full,
            projects: newProjects,
            activeProjectIndex: lastIdx + 1
        };
        try {
            await this.replaceWorkspaceFromPayload(newPayload);
            if (window.WorkspaceIO && typeof window.WorkspaceIO.persistToLocalStorage === 'function') {
                window.WorkspaceIO.persistToLocalStorage({ force: true });
            }
        } catch (e) {
            console.warn(e);
        }
    },

    illuContextTabSaveExport(projectIndex) {
        if (projectIndex < 0 || projectIndex >= this.projects.length) return;
        this.switchProject(projectIndex);
        if (typeof window.saveFile === 'function') window.saveFile();
    },

    illuContextTabCloseNoSave(projectIndex) {
        if (projectIndex < 0 || projectIndex >= this.projects.length) return;
        this.pendingCloseIndex = projectIndex;
        this.finishCloseTab(false);
    },

    cancelCloseTab() {
        this.pendingCloseIndex = -1;
        const ov = document.getElementById('close-tab-overlay');
        if (ov) ov.style.display = 'none';
    },

    finishCloseTab(wantSave) {
        const i = this.pendingCloseIndex;
        this.cancelCloseTab();
        if (i < 0 || i >= this.projects.length) return;
        const prevActive = this.activeProjectIndex;
        const closing = this.projects[i];

        if (wantSave) {
            this.switchProject(i);
            if (typeof window.saveFile === 'function') window.saveFile();
        }

        const idsToRemove = new Set([closing.id]);
        if (closing.role !== 'layerAlphaMask') {
            this.projects.forEach((q) => {
                if (q.role === 'layerAlphaMask' && q.parentProjectId === closing.id) idsToRemove.add(q.id);
            });
        } else {
            const parent = this.projects.find((pr) => pr.id === closing.parentProjectId);
            if (parent && parent.layers) {
                const ly = parent.layers.find((l) => l.id === closing.parentLayerId);
                if (ly) ly.alphaMaskProjectId = null;
            }
        }

        const oldList = this.projects.slice();
        const oldActiveId = oldList[prevActive] ? oldList[prevActive].id : null;

        oldList.forEach((pr) => {
            if (pr && idsToRemove.has(pr.id)) this.disposeProjectResources(pr);
        });

        this.projects = this.projects.filter((pr) => !idsToRemove.has(pr.id));

        if (this.projects.length === 0) {
            this.activeProjectIndex = -1;
            this.handleNewProject();
            return;
        }

        let newActive = 0;
        if (oldActiveId && !idsToRemove.has(oldActiveId)) {
            const ni = this.projects.findIndex((p) => p.id === oldActiveId);
            newActive = ni >= 0 ? ni : 0;
        } else {
            newActive = Math.min(i, this.projects.length - 1);
        }
        this.activeProjectIndex = Math.min(Math.max(0, newActive), this.projects.length - 1);
        this.applyProjectToUI();
        this.updateTabUI();

        // Save new active project ID
        if (this.activeProject && this.activeProject.id) {
            try {
                localStorage.setItem('illu_last_project_id', String(this.activeProject.id));
            } catch (e) { /* ignore */ }
        }

        // Trigger immediate workspace persist to purge closed project data from localStorage/IndexedDB
        if (window.WorkspaceIO && typeof window.WorkspaceIO.persistToLocalStorageAsync === 'function') {
            window.WorkspaceIO.persistToLocalStorageAsync({ immediate: true });
        } else if (this._scheduleWorkspacePersist) {
            this._scheduleWorkspacePersist();
        }
    },

    _makeProjectTab(p, i, opts = {}) {
        const { isAlphaChild = false } = opts;
        const tab = document.createElement('div');
        tab.className = `tab ${i === this.activeProjectIndex ? 'active' : ''}${isAlphaChild ? ' tab--alpha-mask' : ''}`;
        tab.dataset.projectIndex = String(i);
        tab.style.display = 'flex';
        tab.style.alignItems = 'center';
        tab.style.gap = '4px';
        tab.style.cursor = 'pointer';
        tab.addEventListener(
            'click',
            (e) => {
                if (tab.dataset.illuSuppressTabClick === '1') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    delete tab.dataset.illuSuppressTabClick;
                }
            },
            true
        );
        tab.addEventListener('click', () => this.switchProject(i));

        const label = document.createElement('span');
        label.textContent = p.name;
        label.style.flex = '1';
        label.style.textAlign = 'left';
        label.style.pointerEvents = 'none';
        label.style.fontSize = isAlphaChild ? '10px' : '';
        tab.appendChild(label);

        if (
            (p.mode.startsWith('pixel') || p.mode === 'vector') &&
            this._uiThumbsVisible()
        ) {
            const thumb = document.createElement('img');
            thumb.className = 'tab-thumb';
            thumb.alt = '';
            thumb.draggable = false;
            const tabSz = this.getProjectTabThumbCssSize(p);
            thumb.width = tabSz.width;
            thumb.height = tabSz.height;
            if (p.mode === 'vector') {
                const projRef = p;
                const tabIdx = i;
                this._getVectorProjectThumbnailDataUrl(projRef).then((u) => {
                    if (!u) return;
                    const bar = document.getElementById('tab-bar');
                    const t = bar && bar.querySelector(`[data-project-index="${tabIdx}"]`);
                    const im = t && t.querySelector('img.tab-thumb');
                    if (im) im.src = u;
                }).catch(() => {});
            } else {
                const u = this.getProjectTabThumbnailDataUrl(p);
                if (u) thumb.src = u;
            }
            tab.appendChild(thumb);
        }

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', isAlphaChild ? 'Fermer l’éditeur de masque' : 'Fermer l’onglet');
        closeBtn.title = isAlphaChild
            ? 'Fermer l’onglet — le masque reste dans le projet (bouton α du calque pour rouvrir)'
            : 'Fermer l’onglet';
        closeBtn.textContent = '×';
        closeBtn.style.cssText =
            'font-size:14px;line-height:1;padding:0 5px;min-width:20px;cursor:pointer;border:none;background:transparent;';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.requestCloseProject(i);
        };
        tab.appendChild(closeBtn);
        return tab;
    },

    updateTabUI() {
        const bar = document.getElementById('tab-bar');
        if (!bar) return;
        const pmSig = (window.PhotoModeManager && typeof window.PhotoModeManager.hasActiveSession === 'function') 
            ? `|pm:${window.PhotoModeManager.hasActiveSession()}:${window.PhotoModeManager.getPhotoCount()}:${window.PhotoModeManager.isDocked()}` 
            : '';
        const sig = this.projects
            .map((p, i) => [
                i === this.activeProjectIndex ? 1 : 0,
                p.id,
                p.name || '',
                p.role || 'main',
                p.parentProjectId != null ? p.parentProjectId : 'none',
                p.alphaMaskUiHidden === true ? 1 : 0
            ].join(':'))
            .join('|') + pmSig;
        if (this._lastTabUiSignature === sig) return;
        this._lastTabUiSignature = sig;
        bar.innerHTML = '';
        let blockIdx = 0;
        this.projects.forEach((p, i) => {
            if (p.role === 'layerAlphaMask') return;
            const group = document.createElement('div');
            group.className = 'tab-group';
            group.dataset.blockIndex = String(blockIdx);
            blockIdx += 1;
            group.style.display = 'inline-flex';
            group.style.alignItems = 'flex-end';
            group.style.gap = '0';
            group.style.marginRight = '4px';
            group.style.borderRadius = '2px';
            group.style.overflow = 'hidden';
            group.style.border = '1px solid #808080';
            group.style.boxShadow = '1px 1px 0 rgba(0,0,0,0.08)';
            group.appendChild(this._makeProjectTab(p, i, { isAlphaChild: false }));
            this.projects.forEach((c, j) => {
                if (
                    c.role === 'layerAlphaMask' &&
                    c.parentProjectId === p.id &&
                    !c.alphaMaskUiHidden
                ) {
                    group.appendChild(this._makeProjectTab(c, j, { isAlphaChild: true }));
                }
            });
            bar.appendChild(group);
        });

        // Inject Photo Mode Tab if session active
        if (window.PhotoModeManager && window.PhotoModeManager.hasActiveSession()) {
            bar.appendChild(this._makePhotoModeTab());
        }

        this.syncFloatingPalettesPosition();
        try {
            window.dispatchEvent(new CustomEvent('illu-tabs-updated'));
        } catch (e) { /* ignore */ }
        
        setTimeout(() => {
            if (typeof window.centerActiveTabInScroll === 'function') {
                window.centerActiveTabInScroll();
            }
            if (typeof window.updateBodyBackgroundFromActiveTabThumb === 'function') {
                window.updateBodyBackgroundFromActiveTabThumb();
            }
        }, 50);
    },

    _makePhotoModeTab() {
        const pm = window.PhotoModeManager;
        const isOpen = pm.isOpen && pm.isOpen();
        const isDocked = pm.isDocked && pm.isDocked();
        const count = pm.getPhotoCount ? pm.getPhotoCount() : 0;
        
        const tab = document.createElement('div');
        tab.className = `tab ${isOpen ? 'active' : ''}`;
        tab.style.display = 'flex';
        tab.style.alignItems = 'center';
        tab.style.gap = '6px';
        tab.style.cursor = 'pointer';
        tab.style.background = isOpen ? 'var(--mp-accent)' : 'color-mix(in srgb, var(--mp-accent) 70%, black)';
        tab.style.color = 'white';
        tab.style.paddingLeft = '8px';
        tab.style.borderRadius = '2px';
        tab.style.border = '1px solid color-mix(in srgb, var(--mp-accent) 50%, black)';
        
        tab.onclick = () => {
            if (pm.open) pm.open();
        };

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-camera';
        tab.appendChild(icon);

        const label = document.createElement('span');
        label.textContent = `Photo Mode Pro (${count})`;
        label.style.flex = '1';
        label.style.fontWeight = 'bold';
        label.style.fontSize = '11px';
        tab.appendChild(label);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'font-size:14px;line-height:1;padding:0 5px;min-width:20px;cursor:pointer;border:none;background:transparent;color:white;';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            if (pm.close) pm.close();
        };
        tab.appendChild(closeBtn);

        return tab;
    },

    /** Repositionne les palettes flottantes sur les coins workspace si aucune position sauvegardée. */
    syncFloatingPalettesPosition() {
        if (typeof window.getUILayoutMode !== 'function' || window.getUILayoutMode() !== 'floating') return;
        if (document.body.classList.contains('illu-pdn-dock-active')) return;
        if (typeof window.illuPalettePositionsSaved === 'function' && window.illuPalettePositionsSaved()) return;
        if (typeof window.applyFloatingPaletteDefaults === 'function') window.applyFloatingPaletteDefaults();
        queueMicrotask(() => {
            if (typeof window.illuClampAllFloatingPalettes === 'function') window.illuClampAllFloatingPalettes();
        });
    },

    /** Blocs d’indices projet : chaque bloc = document principal + onglets masque α éventuels. */
    _getProjectBlocksForReorder() {
        const projs = this.projects;
        const blocks = [];
        for (let i = 0; i < projs.length; ) {
            const p = projs[i];
            if (p.role === 'layerAlphaMask') {
                i += 1;
                continue;
            }
            const idxs = [i];
            let j = i + 1;
            while (
                j < projs.length &&
                projs[j].role === 'layerAlphaMask' &&
                projs[j].parentProjectId === p.id
            ) {
                idxs.push(j);
                j += 1;
            }
            blocks.push(idxs);
            i = j;
        }
        return blocks;
    },

    /** Réordonne les groupes d’onglets (sans entrée d’historique calque). */
    moveProjectBlockToIndex(fromBlockIdx, insertBeforeBlockIdx) {
        const blocks = this._getProjectBlocksForReorder();
        const n = blocks.length;
        if (fromBlockIdx < 0 || fromBlockIdx >= n) return;
        insertBeforeBlockIdx = Math.max(0, Math.min(n, insertBeforeBlockIdx));
        const moved = blocks.splice(fromBlockIdx, 1)[0];
        let ins = insertBeforeBlockIdx;
        if (fromBlockIdx < insertBeforeBlockIdx) ins -= 1;
        ins = Math.max(0, Math.min(blocks.length, ins));
        blocks.splice(ins, 0, moved);
        const old = this.projects.slice();
        this.projects = blocks.flat().map((pi) => old[pi]);
        const aid = this.activeProject?.id;
        this.activeProjectIndex = Math.max(0, this.projects.findIndex((pr) => pr.id === aid));
        this.updateTabUI();
    },

    initProjectTabDragReorder() {
        const bar = document.getElementById('tab-bar');
        if (!bar || bar.dataset.illuTabReorderInit) return;
        bar.dataset.illuTabReorderInit = '1';
        const LONG_MS = 1000;
        const CANCEL_BEFORE_ARM_PX = 12;
        const DRAG_THRESHOLD_PX = 8;
        let st = null;
        let docMove = null;
        let docEnd = null;

        const detachDoc = () => {
            if (docMove) {
                document.removeEventListener('pointermove', docMove);
                document.removeEventListener('pointerup', docEnd);
                document.removeEventListener('pointercancel', docEnd);
                docMove = null;
                docEnd = null;
            }
        };

        bar.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const tab = e.target.closest('.tab');
            if (!tab) return;
            if (e.target.closest('button')) return;
            const grp = tab.closest('.tab-group');
            if (!grp || !bar.contains(grp)) return;
            const bi = parseInt(grp.dataset.blockIndex, 10);
            if (!Number.isFinite(bi)) return;

            detachDoc();
            st = {
                pid: e.pointerId,
                blockIdx: bi,
                x0: e.clientX,
                y0: e.clientY,
                moved: false,
                armed: false,
                grp,
                tabEl: tab,
                timer: null
            };

            st.timer = window.setTimeout(() => {
                if (!st) return;
                st.armed = true;
                if (st.grp) st.grp.classList.add('tab-group--drag-armed');
            }, LONG_MS);

            docMove = (ev) => {
                if (!st || ev.pointerId !== st.pid) return;
                const dx = Math.abs(ev.clientX - st.x0);
                const dy = Math.abs(ev.clientY - st.y0);
                if (!st.armed && (dx > CANCEL_BEFORE_ARM_PX || dy > CANCEL_BEFORE_ARM_PX)) {
                    if (st.timer) {
                        clearTimeout(st.timer);
                        st.timer = null;
                    }
                    detachDoc();
                    st = null;
                    return;
                }
                if (
                    st.armed &&
                    Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) > DRAG_THRESHOLD_PX
                ) {
                    st.moved = true;
                    if (st.grp) st.grp.style.opacity = '0.88';
                }
            };
            docEnd = (ev) => {
                if (!st || ev.pointerId !== st.pid) return;
                if (st.timer) {
                    clearTimeout(st.timer);
                    st.timer = null;
                }
                if (st.grp) {
                    st.grp.classList.remove('tab-group--drag-armed');
                    st.grp.style.opacity = '';
                }
                if (st.armed && st.moved) {
                    if (st.tabEl) st.tabEl.dataset.illuSuppressTabClick = '1';
                    const el = document.elementFromPoint(ev.clientX, ev.clientY);
                    const tg = el && el.closest && el.closest('.tab-group');
                    if (tg && bar.contains(tg)) {
                        const tbi = parseInt(tg.dataset.blockIndex, 10);
                        if (Number.isFinite(tbi)) {
                            const rect = tg.getBoundingClientRect();
                            const before = ev.clientX < rect.left + rect.width / 2;
                            const insertBefore = before ? tbi : tbi + 1;
                            this.moveProjectBlockToIndex(st.blockIdx, insertBefore);
                        }
                    }
                }
                st = null;
                detachDoc();
            };
            document.addEventListener('pointermove', docMove, { passive: true });
            document.addEventListener('pointerup', docEnd);
            document.addEventListener('pointercancel', docEnd);
        });
    },

    // --- COLOR MANAGER ---
    /** Chaîne CSS `rgba()` pour une couleur `{ r, g, b, a }` (alpha 0–255). */
    cssRgbaFromPart(c) {
        if (!c || c.r == null) return 'rgba(0,0,0,1)';
        const a = c.a != null ? c.a / 255 : 1;
        return `rgba(${c.r},${c.g},${c.b},${a})`;
    },

    setupColorWheel() {
        this.primaryColor = {r:0,g:0,b:0,a:255};
        this.secondaryColor = {r:255,g:255,b:255,a:255};
        this.activeColorTarget = 'primary';
        this.activeColor = '#000000';
        
        const canvas = document.getElementById('color-wheel');
        this.rebuildColorPickerBase();

        if (canvas) {
            canvas.style.touchAction = 'none';
            let wheelPointerId = null;
            const pick = (ev) => this.handleColorPick(ev);
            const endPick = (ev) => {
                if (wheelPointerId == null) return;
                if (ev.pointerId != null && ev.pointerId !== wheelPointerId) return;
                try {
                    if (ev.pointerId != null) canvas.releasePointerCapture(ev.pointerId);
                } catch (err) {
                    /* ignore */
                }
                wheelPointerId = null;
            };
            canvas.addEventListener(
                'pointerdown',
                (e) => {
                    if (e.button != null && e.button !== 0) return;
                    e.preventDefault();
                    wheelPointerId = e.pointerId != null ? e.pointerId : null;
                    try {
                        if (e.pointerId != null) canvas.setPointerCapture(e.pointerId);
                    } catch (err) {
                        /* ignore */
                    }
                    pick(e);
                },
                { passive: false }
            );
            canvas.addEventListener(
                'pointermove',
                (e) => {
                    if (wheelPointerId == null) return;
                    if (e.pointerId != null && e.pointerId !== wheelPointerId) return;
                    e.preventDefault();
                    pick(e);
                },
                { passive: false }
            );
            canvas.addEventListener('pointerup', endPick);
            canvas.addEventListener('pointercancel', endPick);
            canvas.addEventListener('lostpointercapture', endPick);
        }
        
        document.getElementById('color-hex').addEventListener('change', (e) => this.setColorFromHex(e.target.value));
        document.getElementById('color-target-sel').addEventListener('change', (e) => {
            this.activeColorTarget = e.target.value;
            this.syncUItoState();
        });
        document.getElementById('ui-col-primary').addEventListener('click', () => { document.getElementById('color-target-sel').value = 'primary'; this.activeColorTarget = 'primary'; this.syncUItoState(); });
        document.getElementById('ui-col-secondary').addEventListener('click', () => { document.getElementById('color-target-sel').value = 'secondary'; this.activeColorTarget = 'secondary'; this.syncUItoState(); });
        document.getElementById('ui-col-swap').addEventListener('click', () => {
            const temp = {...this.primaryColor};
            this.primaryColor = {...this.secondaryColor};
            this.secondaryColor = temp;
            
            const tempDither = this.primaryDitherPatternId;
            this.primaryDitherPatternId = this.secondaryDitherPatternId;
            this.secondaryDitherPatternId = tempDither;
            
            this.syncUItoState();
        });

        const btnExpand = document.getElementById('btn-col-expand');
        if (window._illuColorSlidersExpanded === undefined) window._illuColorSlidersExpanded = false;
        if (typeof window.syncColorPanelToUILayout === 'function') window.syncColorPanelToUILayout();
        if (btnExpand) {
            btnExpand.addEventListener('click', () => {
                if (
                    typeof window.getUILayoutMode === 'function' &&
                    window.getUILayoutMode() === 'photoshop'
                )
                    return;
                if (
                    typeof window.illuIsPhoneColorSlidersHidden === 'function' &&
                    window.illuIsPhoneColorSlidersHidden()
                )
                    return;
                window._illuColorSlidersExpanded = !window._illuColorSlidersExpanded;
                if (typeof window.syncColorPanelToUILayout === 'function') window.syncColorPanelToUILayout();
            });
            window.addEventListener('illu-i18n-applied', () => {
                if (
                    typeof window.getUILayoutMode === 'function' &&
                    window.getUILayoutMode() !== 'photoshop' &&
                    typeof window.syncColorPanelToUILayout === 'function'
                )
                    window.syncColorPanelToUILayout();
            });
        }
    },

    setupSliders() {
        const bindSlider = (id, type) => {
            const sl = document.getElementById(`col-${id}`);
            const val = document.getElementById(`col-${id}-val`);
            const update = (v, snap) => {
                if(sl && type !== 'alpha') sl.value = v; // don't fight native thumb on input
                if(val) val.value = v;
                this.updateFromSlider(id, v, type, snap);
            };
            if(sl) {
                sl.addEventListener('input', (e) => update(e.target.value, false));
                sl.addEventListener('change', (e) => update(e.target.value, true));
            }
            if(val) val.addEventListener('change', (e) => update(e.target.value, true));
        };
        ['r', 'g', 'b'].forEach(id => bindSlider(id, 'rgb'));
        ['h', 's', 'v'].forEach(id => bindSlider(id, 'hsv'));
        bindSlider('a', 'alpha');
    },

    updateFromSlider(id, value, type, snap = false) {
        value = parseInt(value) || 0;
        const col = this.activeColorTarget === 'primary' ? this.primaryColor : this.secondaryColor;
        let hsv = this.rgbToHsv(col.r, col.g, col.b);
        
        if (type === 'rgb') {
            col[id] = Math.max(0, Math.min(255, value));
        } else if (type === 'hsv') {
            if (id === 'h') hsv.h = Math.max(0, Math.min(360, value));
            if (id === 's') hsv.s = Math.max(0, Math.min(100, value));
            if (id === 'v') hsv.v = Math.max(0, Math.min(100, value));
            const rgb = this.hsvToRgb(hsv.h, hsv.s, hsv.v);
            col.r = rgb.r; col.g = rgb.g; col.b = rgb.b;
        } else if (type === 'alpha') {
            col.a = Math.max(0, Math.min(255, value));
        }
        if (snap && this.activeProject) {
            this.snapColorToPalette(col, this.activeProject.mode);
        }
        this.syncUItoState();
    },

    setupPalette() {
        if (typeof window.refreshPaletteGridLayout === 'function') {
            window.refreshPaletteGridLayout();
        } else if (typeof window.buildIlluCompactPaletteSwatches === 'function') {
            window.fillPaletteGridFromSwatches(window.buildIlluCompactPaletteSwatches());
        }
    },

    handleColorPick(e) {
        const canvas = document.getElementById('color-wheel');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        if (this.isColorPickerGridMode()) {
            // Dans la grille (Grid), on utilise getImageData, mais on clamp les coordonnées
            x = Math.max(0, Math.min(canvas.width - 1, x));
            y = Math.max(0, Math.min(canvas.height - 1, y));
            try {
                const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
                this.setColorFromRGB(data[0], data[1], data[2]);
            } catch(err) {}
        } else {
            // Dans la roue (Wheel), on calcule mathématiquement pour que le glisser hors du cercle accroche le bord
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const r = canvas.width / 2;
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) / r;

            const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            const sat = Math.min(100, dist * 100); // Saturation capée à 100% au bord
            
            const rgb = this.hsvToRgb(hue, sat, 100);
            this.setColorFromRGB(rgb.r, rgb.g, rgb.b);
        }
    },

    setColorFromRGB(r, g, b, a = null) {
        const col = this.activeColorTarget === 'primary' ? this.primaryColor : this.secondaryColor;
        col.r = r; col.g = g; col.b = b;
        if (a !== null) col.a = a;
        if (this.activeProject) this.snapColorToPalette(col, this.activeProject.mode);
        this.syncUItoState();
        if (window.activeTool === 'eyedropper' && typeof window.illuRefreshEyedropperColorPanel === 'function') {
            window.illuRefreshEyedropperColorPanel();
        }

        // Propagation aux formes vectorielles sélectionnées
        if (this.mode === 'vector' && this.activeVectorSelection.length) {
            this.applyVectorColorFromPicker();
        }
    },

    /**
     * Applique la couleur primaire (contour / remplissage seul) ou secondaire (remplissage en mode mixte).
     */
    applyVectorColorFromPicker(opts) {
        opts = opts || {};
        const livePreview = opts.livePreview !== false;
        if (!this.activeVectorSelection || !this.activeVectorSelection.length) return;

        const paintable = this.activeVectorSelection.filter(
            (el) =>
                !(
                    typeof window.illuVectorIsEmbeddedBitmap === 'function' &&
                    window.illuVectorIsEmbeddedBitmap(el)
                )
        );
        if (!paintable.length) return;

        const onlyText = paintable.every((el) => {
            const t = (el.tagName || '').toLowerCase();
            return t === 'foreignobject' || t === 'text';
        });
        if (onlyText && window.VectorEngine && typeof window.VectorEngine.applyStyleToSelection === 'function') {
            window.VectorEngine.applyStyleToSelection();
            return;
        }

        const target = this.activeColorTarget === 'secondary' ? 'secondary' : 'primary';
        const mode = this.toolProps.shapeStrokeMode || 'both';
        const fillType = this.toolProps.fillType || 'solid';

        const primaryCss =
            typeof window.shapePrimaryFillCss === 'function'
                ? window.shapePrimaryFillCss()
                : this.cssRgbaFromPart(this.primaryColor);
        const fillCss =
            typeof window.shapeEffectiveFillCss === 'function'
                ? window.shapeEffectiveFillCss(mode)
                : primaryCss;
        const secondaryCss =
            typeof window.shapeSecondaryStrokeCss === 'function'
                ? window.shapeSecondaryStrokeCss()
                : this.cssRgbaFromPart(this.secondaryColor);

        const propOpts = { livePreview, skipRenderHistory: livePreview };

        if (target === 'secondary') {
            if (mode === 'both' || mode === 'fill') {
                this.applyVectorProperty('fill', secondaryCss, propOpts);
            } else if (mode === 'stroke') {
                this.applyVectorProperty('stroke', secondaryCss, propOpts);
            }
            return;
        }

        if (mode === 'fill') {
            if (fillType === 'gradient') {
                this.applyVectorProperty('fill-model', 'gradient', propOpts);
            } else if (fillType === 'none') {
                this.applyVectorProperty('fill', 'none', propOpts);
            } else {
                this.applyVectorProperty('fill', fillCss, propOpts);
            }
            return;
        }

        if (mode === 'stroke') {
            this.applyVectorProperty('stroke', primaryCss, propOpts);
            return;
        }

        this.applyVectorProperty('stroke', primaryCss, propOpts);
        if (fillType === 'gradient') {
            this.applyVectorProperty('fill-model', 'gradient', propOpts);
        } else if (fillType === 'none') {
            this.applyVectorProperty('fill', 'none', propOpts);
        } else {
            this.applyVectorProperty('fill', fillCss, propOpts);
        }

        if (livePreview && this.mode === 'vector') {
            if (this._illuVectorColorHistoryTimer != null) {
                clearTimeout(this._illuVectorColorHistoryTimer);
            }
            const self = this;
            this._illuVectorColorHistoryTimer = window.setTimeout(() => {
                self._illuVectorColorHistoryTimer = null;
                if (typeof self.saveHistoryVector === 'function') {
                    self.saveHistoryVector('Couleur vecteur');
                }
            }, 500);
        }
    },

    setColorFromHex(hex) {
        if (!hex.startsWith('#')) hex = '#' + hex;
        let h = hex.trim().replace(/^#/, '');
        let a = 255;
        if (h.length === 8) {
            a = parseInt(h.slice(6, 8), 16);
            h = h.slice(0, 6);
            hex = '#' + h;
        }
        const rgb = this.hexToRgb('#' + h);
        this.setColorFromRGB(rgb.r, rgb.g, rgb.b, Number.isFinite(a) ? a : 255);
    },

    syncUItoState() {
        const col = this.activeColorTarget === 'primary' ? this.primaryColor : this.secondaryColor;
        const hsv = this.rgbToHsv(col.r, col.g, col.b);
        const hex = this.rgbToHex(col.r, col.g, col.b);
        this.activeColor = `rgba(${this.primaryColor.r}, ${this.primaryColor.g}, ${this.primaryColor.b}, ${this.primaryColor.a/255})`; // Used in DrawingTools

        // Update inputs
        const update = (id, val) => {
            const s = document.getElementById(`col-${id}`); const i = document.getElementById(`col-${id}-val`);
            if(s) s.value = val; if(i) i.value = val;
        };
        update('r', col.r); update('g', col.g); update('b', col.b);
        update('h', hsv.h); update('s', hsv.s); update('v', hsv.v);
        update('a', col.a);
        
        const hInp = document.getElementById('color-hex');
        if (hInp && document.activeElement !== hInp) hInp.value = hex.replace('#', '').toUpperCase();

        // Update Primary/Secondary UI Boxes
        const uiPri = document.getElementById('ui-col-primary');
        const uiSec = document.getElementById('ui-col-secondary');
        const isDither = this.activeProject && this.activeProject.mode === 'pixel-dither';
        if (uiPri) {
            uiPri.style.backgroundColor = `rgba(${this.primaryColor.r}, ${this.primaryColor.g}, ${this.primaryColor.b}, ${this.primaryColor.a/255})`;
            uiPri.style.zIndex = this.activeColorTarget === 'primary' ? '3' : '1';
            uiPri.classList.toggle('active', this.activeColorTarget === 'primary');
            if (!isDither) {
                uiPri.style.backgroundImage = 'none';
            } else {
                const canv = this._ditherPatternCanvases[this.primaryDitherPatternId || 'black'];
                if (canv) {
                    uiPri.style.backgroundImage = `url(${canv.toDataURL()})`;
                    uiPri.style.backgroundRepeat = 'repeat';
                    uiPri.style.backgroundSize = 'auto';
                }
            }
        }
        if (uiSec) {
            uiSec.style.backgroundColor = `rgba(${this.secondaryColor.r}, ${this.secondaryColor.g}, ${this.secondaryColor.b}, ${this.secondaryColor.a/255})`;
            uiSec.style.zIndex = this.activeColorTarget === 'secondary' ? '3' : '1';
            uiSec.classList.toggle('active', this.activeColorTarget === 'secondary');
            if (!isDither) {
                uiSec.style.backgroundImage = 'none';
            } else {
                const canv = this._ditherPatternCanvases[this.secondaryDitherPatternId || 'white'];
                if (canv) {
                    uiSec.style.backgroundImage = `url(${canv.toDataURL()})`;
                    uiSec.style.backgroundRepeat = 'repeat';
                    uiSec.style.backgroundSize = 'auto';
                }
            }
        }

        // Redraw color wheel selected color marker
        if (this.updateColorWheelForMode) {
            this.updateColorWheelForMode();
        }

        if (isDither) {
            const targetId = this.activeColorTarget === 'secondary' ? this.secondaryDitherPatternId : this.primaryDitherPatternId;
            document.querySelectorAll('.dither-pattern-swatch').forEach(s => {
                s.style.outline = s.title === targetId ? '2px solid #00f' : '';
            });
        }
        
        // Update Gradients of Sliders
        const toCss = (r,g,b) => `rgb(${r},${g},${b})`;
        const sr = document.getElementById('col-r'); if (sr) sr.style.background = `linear-gradient(to right, ${toCss(0,col.g,col.b)}, ${toCss(255,col.g,col.b)})`;
        const sg = document.getElementById('col-g'); if (sg) sg.style.background = `linear-gradient(to right, ${toCss(col.r,0,col.b)}, ${toCss(col.r,255,col.b)})`;
        const sb = document.getElementById('col-b'); if (sb) sb.style.background = `linear-gradient(to right, ${toCss(col.r,col.g,0)}, ${toCss(col.r,col.g,255)})`;
        
        const sh = document.getElementById('col-h'); if (sh) sh.style.background = `linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`;
        const ss = document.getElementById('col-s'); if (ss) ss.style.background = `linear-gradient(to right, ${toCss(...Object.values(this.hsvToRgb(hsv.h,0,hsv.v)))}, ${toCss(...Object.values(this.hsvToRgb(hsv.h,100,hsv.v)))})`;
        const sv = document.getElementById('col-v'); if (sv) sv.style.background = `linear-gradient(to right, #000000, ${toCss(...Object.values(this.hsvToRgb(hsv.h,hsv.s,100)))})`;
        
        const sa = document.getElementById('col-a');
        if (sa && sa.parentElement) sa.parentElement.style.setProperty('--alpha-col', `rgba(${col.r},${col.g},${col.b},1)`);

        if (typeof window.extendPixelTextEditorIgnoreBlur === 'function') window.extendPixelTextEditorIgnoreBlur(3000);
        if (typeof window.onEditorColorsChanged === 'function') window.onEditorColorsChanged();
        if (typeof window.syncVectorTextEditorStyles === 'function') window.syncVectorTextEditorStyles();
    },

    rgbToHex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); },

    hexToRgb(hex) {
        if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
        let h = hex.trim().replace(/^#/, '');
        if (h.length === 8) h = h.slice(0, 6);
        if (h.length === 3) {
            h = h.split('').map((c) => c + c).join('');
        }
        if (h.length !== 6) return { r: 0, g: 0, b: 0 };
        const n = parseInt(h, 16);
        if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },
    
    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    },

    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, v = max, d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max !== min) {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
    },

    hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360;
        s /= 100;
        l /= 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    },

    hsvToRgb(h, s, v) {
        let r, g, b, i, f, p, q, t;
        h /= 360; s /= 100; v /= 100;
        i = Math.floor(h * 6); f = h * 6 - i;
        p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    },

    // --- LAYERS ---
    addLayer(name) {
        if (window._illuFinishingWarp) return;
        const id = Date.now();
        const layer = { 
            id, 
            name: name || `Calque ${this.layers.length + 1}`, 
            visible: true,
            x: 0,
            y: 0,
            opacity: 1,
            blendMode: 'source-over',
            buffer: null, // Canvas for pixels
            alphaMaskProjectId: null,
            ...this._defaultDynamicFilterLayerProps()
        };

        if (this.isPixelMode) {
            const buffer = document.createElement('canvas');
            buffer.width = this.width;
            buffer.height = this.height;
            const bCtx = buffer.getContext('2d', { willReadFrequently: true });
            /* Premier calque du document : fond blanc (nouveau projet). Les calques suivants restent transparents. */
            if (this.layers.length === 0) {
                bCtx.fillStyle = '#ffffff';
                bCtx.fillRect(0, 0, this.width, this.height);
            }
            layer.buffer = buffer;
        } else {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('id', `layer-${id}`);
            const sl = document.getElementById('svg-layers');
            if (sl) sl.appendChild(group);
        }

        this.layers.push(layer);
        this.setActiveLayerIndex(this.layers.length - 1);
        this.updateLayerUI();
        this.render();
    },

    /**
     * Retour document principal après onglet masque α : laisse peindre la barre de statut puis composite (documents ≥ ~0,8 Mpx).
     */
    _renderCompositeWithProgress() {
        const msg =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('progress.renderComposite')
                : 'Rendu du document…';
        if (window.IlluProgress && typeof window.IlluProgress.status === 'function') {
            window.IlluProgress.status(50, msg);
        }
        const finish = () => {
            if (window.IlluProgress && typeof window.IlluProgress.statusDone === 'function') {
                window.IlluProgress.statusDone();
            }
        };
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    this.render({ flushUiThumbnails: true });
                } finally {
                    finish();
                }
            });
        });
    },

    /**
     * @param {{ flushUiThumbnails?: boolean, uiThumbnailsAllLayers?: boolean, layerIndex?: number } | boolean} [opts] — Si flushUiThumbnails / true : miniatures après court délai ; par défaut seul le calque actif (plus l’onglet). uiThumbnailsAllLayers : toute la liste. layerIndex : une ligne précise (ex. patch historique).
     */
    render(opts) {
        let flushUiThumbnails = false;
        let uiThumbnailsAllLayers = false;
        let thumbLayerIndex = null;
        let skipDrawUI = false;
        let skipUiThumbnails = false;
        let skipLayerComposite = false;
        let activeLayerViewOnly = false;
        if (opts === true) flushUiThumbnails = true;
        else if (opts && typeof opts === 'object') {
            if (opts.flushUiThumbnails) flushUiThumbnails = true;
            if (opts.uiThumbnailsAllLayers) uiThumbnailsAllLayers = true;
            if (Number.isInteger(opts.layerIndex) && opts.layerIndex >= 0) thumbLayerIndex = opts.layerIndex;
            if (opts.skipDrawUI) skipDrawUI = true;
            if (opts.skipUiThumbnails) skipUiThumbnails = true;
            if (opts.skipLayerComposite) skipLayerComposite = true;
            if (opts.activeLayerViewOnly) activeLayerViewOnly = true;
        }

        this._renderEpoch = (this._renderEpoch | 0) + 1;
        this._cachedPointerRect = null;
        this._cachedPointerRectAtMs = 0;
        if (!this.activeProject) return;
        if (this.isPixelMode) {
            const mainCanvas = document.getElementById('drawing-canvas');
            const stack = document.getElementById('pixel-layer-stack');
            if (!mainCanvas) return;
            if (!skipLayerComposite) {
                this.layers.forEach((l) => this._normalizeDynamicFilterProps(l));
                const useDomStack = !!(stack && this._pixelDomLayerViewsEligible());
                this._domPixelStackActive = useDomStack;
                const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
                if (useDomStack) {
                    stack.style.display = 'block';
                    if (activeLayerViewOnly && this.activeLayer && this.activeLayer.buffer) {
                        this._syncSinglePixelDomLayerView(stack, this.activeLayer);
                    } else {
                        this._syncPixelDomLayerViews(stack);
                    }
                    mainCanvas.style.opacity = '0';
                    mainCanvas.style.pointerEvents = 'auto';
                    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
                } else {
                    if (stack) {
                        stack.style.display = 'none';
                        stack.innerHTML = '';
                        if (this._pixelLayerViewEls) this._pixelLayerViewEls.clear();
                        if (this._pixelLayerStagingViewEls) this._pixelLayerStagingViewEls.clear();
                    }
                    mainCanvas.style.opacity = '';
                    mainCanvas.style.pointerEvents = '';
                    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
                    const sl = this.strokeLightPixelRenderWanted();
                    this._renderPixelLayersStackToContext(ctx, this.layers, true, sl ? { strokeLightRender: true } : undefined);
                }
            }
        } else {
            this._domPixelStackActive = false;
            const stack = document.getElementById('pixel-layer-stack');
            if (stack) {
                stack.style.display = 'none';
                stack.innerHTML = '';
                if (this._pixelLayerViewEls) this._pixelLayerViewEls.clear();
            }
            const mc = document.getElementById('drawing-canvas');
            if (mc) {
                mc.style.opacity = '';
                mc.style.pointerEvents = '';
            }
            // For vector, we just update transforms
            this.layers.forEach(layer => {
                const g = document.getElementById(`layer-${layer.id}`);
                if (g) {
                    g.setAttribute('transform', `translate(${layer.x}, ${layer.y})`);
                    g.style.display = layer.visible ? 'inline' : 'none';
                    g.style.opacity = layer.opacity;
                }
            });
        }
        if (!skipDrawUI && !(this.mode === 'vector' && window._illuVectorDragActive)) {
            this.drawUI();
        }
        if (skipUiThumbnails) {
            return;
        }
        if (flushUiThumbnails) {
            if (uiThumbnailsAllLayers) {
                this.flushUiThumbnailsRefresh({ uiThumbnailsAllLayers: true });
            } else if (thumbLayerIndex != null) {
                this.flushUiThumbnailsRefresh({ layerIndex: thumbLayerIndex });
            } else {
                this.flushUiThumbnailsRefresh({});
            }
        } else {
            this.scheduleUiThumbnailsRefresh();
        }
    },

    deleteLayer() {
        if (window._illuFinishingWarp) return;
        if (this.layers.length > 1) {
            const victim = this.layers[this.activeLayerIndex];
            const id = victim.id;
            if (this.isPixelMode && victim.alphaMaskProjectId) {
                const mp = this.projects.find((pr) => pr.id === victim.alphaMaskProjectId);
                if (mp) this.disposeProjectResources(mp);
                this.projects = this.projects.filter((pr) => pr.id !== victim.alphaMaskProjectId);
            }
            this.layers.splice(this.activeLayerIndex, 1);
            if (this.activeLayerIndex >= this.layers.length) {
                this.setActiveLayerIndex(this.layers.length - 1);
            }
            if (this.mode === 'vector') {
                const group = document.getElementById(`layer-${id}`);
                if (group) group.remove();
            }
            this.updateLayerUI();
            this.render();
        }
    },

    moveLayer(dir) {
        const newIndex = this.activeLayerIndex + dir;
        if (newIndex >= 0 && newIndex < this.layers.length) {
            const temp = this.layers[this.activeLayerIndex];
            this.layers[this.activeLayerIndex] = this.layers[newIndex];
            this.layers[newIndex] = temp;
            
            if (this.mode === 'vector') {
                const svgLayers = document.getElementById('svg-layers');
                const groups = this.layers.map(l => document.getElementById(`layer-${l.id}`));
                groups.forEach(g => { if (g) svgLayers.appendChild(g); });
            }
            this.setActiveLayerIndex(newIndex);
            this.updateLayerUI();
            this.render();
        }
    },

    reorderLayersAtIndices(fromIdx, toIdx) {
        if (!this.activeProject || !this.layers.length || fromIdx === toIdx) return;
        if (fromIdx < 0 || fromIdx >= this.layers.length) return;
        toIdx = Math.max(0, Math.min(this.layers.length - 1, toIdx));
        const arr = this.layers;
        const activeId = arr[this.activeLayerIndex]?.id;
        const [item] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, item);
        const ni = arr.findIndex((l) => l.id === activeId);
        this.setActiveLayerIndex(ni >= 0 ? ni : 0);
        if (this.mode === 'vector') {
            const svgLayers = document.getElementById('svg-layers');
            if (svgLayers) {
                this.layers.forEach((l) => {
                    const g = document.getElementById(`layer-${l.id}`);
                    if (g) svgLayers.appendChild(g);
                });
            }
        }
        this.saveHistory('Réorganiser calques');
        this.updateLayerUI();
        this.render();
    },

    /**
     * Réordonne `this.layers` selon l’ordre visuel actuel des lignes (data-layer-id, fiable après insertBefore DOM).
     */
    reorderLayersFromDomOrder(listEl) {
        if (!this.activeProject || !this.layers.length || !listEl) return;
        const ids = [...listEl.querySelectorAll('.layer-row')].map((el) => {
            const id = Number(el.dataset.layerId);
            return Number.isFinite(id) ? id : NaN;
        });
        if (ids.length !== this.layers.length || ids.some((x) => !Number.isFinite(x))) return;
        const byId = Object.fromEntries(this.layers.map((l) => [l.id, l]));
        const permuted = ids
            .slice()
            .reverse()
            .map((id) => byId[id])
            .filter(Boolean);
        if (permuted.length !== this.layers.length) return;
        const same =
            permuted.length === this.layers.length && permuted.every((l, j) => l === this.layers[j]);
        if (same) {
            this.updateLayerUI();
            return;
        }
        const activeId = this.activeLayer?.id;
        this.activeProject.layers = permuted;
        const ni = this.layers.findIndex((l) => l.id === activeId);
        this.setActiveLayerIndex(ni >= 0 ? ni : 0);
        if (this.mode === 'vector') {
            const svgLayers = document.getElementById('svg-layers');
            if (svgLayers) {
                this.layers.forEach((l) => {
                    const g = document.getElementById(`layer-${l.id}`);
                    if (g) svgLayers.appendChild(g);
                });
            }
        }
        this.saveHistory('Réorganiser calques');
        this.updateLayerUI();
        this.render();
    },

    /** Agrandit le document pour englober tous les calques (pixels hors toile inclus dans les buffers). */
    expandCanvasToLayers() {
        if (!this.activeProject || !this.isPixelMode || !this.layers.length) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let any = false;
        this.layers.forEach((l) => {
            if (!l.visible || !l.buffer) return;
            any = true;
            minX = Math.min(minX, l.x);
            minY = Math.min(minY, l.y);
            maxX = Math.max(maxX, l.x + l.buffer.width);
            maxY = Math.max(maxY, l.y + l.buffer.height);
        });
        if (!any) return;
        const newW = Math.max(1, Math.ceil(maxX - minX));
        const newH = Math.max(1, Math.ceil(maxY - minY));
        if (newW === this.width && newH === this.height && minX >= 0 && minY >= 0) return;
        this.layers.forEach((l) => {
            l.x -= minX;
            l.y -= minY;
        });
        this.activeProject.width = newW;
        this.activeProject.height = newH;
        this.saveHistory('Ajuster la page au contenu', { documentGeometry: true });
        this.applyProjectToUI();
    },

    /**
     * Ajoute de la marge transparente autour du document (calques agrandis, positions conservées visuellement).
     * @param {number} ml
     * @param {number} mt
     * @param {number} mr
     * @param {number} mb
     */
    extendDocumentMargins(ml, mt, mr, mb, opts) {
        ml = Math.max(0, Math.floor(Number(ml)) || 0);
        mt = Math.max(0, Math.floor(Number(mt)) || 0);
        mr = Math.max(0, Math.floor(Number(mr)) || 0);
        mb = Math.max(0, Math.floor(Number(mb)) || 0);
        if (!this.activeProject) return;
        if (ml + mt + mr + mb === 0) return;
        const p = this.activeProject;
        if (p.role === 'layerAlphaMask') return;
        if (p.mode === 'vector') {
            this._extendVectorDocumentMargins(ml, mt, mr, mb, opts);
            return;
        }
        if (!this.isPixelMode) return;
        const silent = !!(opts && opts.silent);
        const oldW = p.width;
        const oldH = p.height;
        const newW = oldW + ml + mr;
        const newH = oldH + mt + mb;

        const growLayer = (layer) => {
            if (!layer.buffer) return;
            const ow = layer.buffer.width;
            const oh = layer.buffer.height;
            const nc = document.createElement('canvas');
            nc.width = newW;
            nc.height = newH;
            const nctx = nc.getContext('2d', { willReadFrequently: true });
            nctx.drawImage(layer.buffer, ml, mt);
            layer.buffer = nc;
        };

        p.layers.forEach(growLayer);
        p.width = newW;
        p.height = newH;

        const maskIds = new Set();
        p.layers.forEach((l) => {
            if (l.alphaMaskProjectId) maskIds.add(l.alphaMaskProjectId);
        });
        maskIds.forEach((mid) => {
            const mp = this.projects.find((pr) => pr.id === mid);
            if (!mp || !mp.layers) return;
            mp.width = newW;
            mp.height = newH;
            mp.layers.forEach(growLayer);
        });

        if (window.selectionBounds) {
            window.selectionBounds.x += ml;
            window.selectionBounds.y += mt;
        }
        if (window.pixelShapeEdit) window.pixelShapeEdit = null;
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();

        if (!silent) {
            this.saveHistory('Étendre la zone de travail', { documentGeometry: true });
        }
        this.applyProjectToUI();
    },

    /**
     * Mode vecteur : agrandit la page SVG et décale le contenu comme en pixel (marges haut/gauche).
     */
    _extendVectorDocumentMargins(ml, mt, mr, mb, opts) {
        const p = this.activeProject;
        if (!p || p.mode !== 'vector') return;
        const silent = !!(opts && opts.silent);
        const oldW = Math.max(1, p.width | 0);
        const oldH = Math.max(1, p.height | 0);
        p.width = oldW + ml + mr;
        p.height = oldH + mt + mb;

        this.layers.forEach((layer) => {
            layer.x = (layer.x | 0) + ml;
            layer.y = (layer.y | 0) + mt;
            const g = document.getElementById(`layer-${layer.id}`);
            if (g) {
                g.setAttribute('transform', `translate(${layer.x}, ${layer.y})`);
            }
        });

        const layersRoot = document.getElementById('svg-layers');
        if (layersRoot) {
            layersRoot.querySelectorAll('[data-illu-canvas-cover="1"]').forEach((cover) => {
                cover.setAttribute('width', String(p.width));
                cover.setAttribute('height', String(p.height));
            });
        }

        this._applyVectorCanvasDimensionsOnly();
        if (typeof this.syncActiveVectorSvg === 'function') this.syncActiveVectorSvg();
        if (typeof window.illuSyncVectorSelectionUI === 'function') {
            window.illuSyncVectorSelectionUI();
        }
        if (!silent) {
            this.saveHistory('Étendre la zone de travail', { documentGeometry: true });
        }
        this.applyProjectToUI();
    },

    /**
     * Ramène le tampon du calque aux dimensions du document (0,0) sans changer la taille de la toile.
     */
    _fitLayerBufferToDocumentSize(layer) {
        if (!layer || !layer.buffer || !this.isPixelMode || !this.activeProject) return;
        const W = Math.max(1, this.width | 0);
        const H = Math.max(1, this.height | 0);
        const bw = layer.buffer.width | 0;
        const bh = layer.buffer.height | 0;
        const lx = layer.x | 0;
        const ly = layer.y | 0;
        if (bw === W && bh === H && lx === 0 && ly === 0) return;
        const newBuf = document.createElement('canvas');
        newBuf.width = W;
        newBuf.height = H;
        const nctx = newBuf.getContext('2d', { willReadFrequently: true });
        if (nctx) {
            nctx.imageSmoothingEnabled = false;
            nctx.clearRect(0, 0, W, H);
            nctx.drawImage(layer.buffer, 0, 0, bw, bh, lx, ly, bw, bh);
        }
        layer.buffer = newBuf;
        layer.x = 0;
        layer.y = 0;
    },

    /** Calques pixel : tampon = dimensions du document, position (0,0) — le collage volant reste dans importStagingBuffer. */
    _normalizeAllPixelLayersToDocumentSize() {
        if (!this.isPixelMode || !this.activeProject) return;
        for (let i = 0; i < this.layers.length; i++) {
            this._fitLayerBufferToDocumentSize(this.layers[i]);
        }
    },

    _clearImportStagingDomViews() {
        if (!this._pixelLayerStagingViewEls) return;
        for (const el of this._pixelLayerStagingViewEls.values()) {
            if (el && el.parentNode) el.remove();
        }
        this._pixelLayerStagingViewEls.clear();
        if (typeof illuSetImportPlacementChromeActive === 'function') {
            illuSetImportPlacementChromeActive(false);
        } else {
            const mcc = document.getElementById('main-canvas-container');
            if (mcc) mcc.classList.remove('illu-import-placement-active');
        }
    },

    /**
     * Fusionne le collage volant d’un calque dans son tampon (dimensions projet inchangées).
     * @param {object} layer
     * @returns {boolean}
     */
    commitImportPlacementForLayer(layer) {
        if (!layer || !layer.buffer || !layer.importPlacementPending || !this.isPixelMode || !this.activeProject) {
            return false;
        }
        if (this.activeProject.role === 'layerAlphaMask') return false;
        this._fitLayerBufferToDocumentSize(layer);
        const st = layer.importStagingBuffer;
        const sx = layer.importStagingX | 0;
        const sy = layer.importStagingY | 0;
        if (st && (st.width | 0) >= 1 && (st.height | 0) >= 1) {
            const bctx = layer.buffer.getContext('2d', { willReadFrequently: true });
            if (bctx) {
                bctx.imageSmoothingEnabled = false;
                /* Au « poser » : seule la partie dans le rectangle document est inscrite sur le calque. */
                bctx.drawImage(st, sx, sy);
            }
        }
        if (typeof illuSetImportPlacementChromeActive === 'function') {
            illuSetImportPlacementChromeActive(false);
        } else {
            const mcc = document.getElementById('main-canvas-container');
            if (mcc) mcc.classList.remove('illu-import-placement-active');
        }
        layer.importPlacementPending = false;
        delete layer.importStagingBuffer;
        delete layer.importStagingX;
        delete layer.importStagingY;
        if (layer._ghostDragHide) delete layer._ghostDragHide;
        if (this._pixelLayerViewEls) {
            const v = this._pixelLayerViewEls.get(layer.id);
            if (v && v.parentNode) v.remove();
            this._pixelLayerViewEls.delete(layer.id);
        }
        return true;
    },

    /**
     * Après collage volant : pose tous les calques en attente (souvent le calque actif seulement).
     */
    commitImportPlacementIfPending() {
        if (!this.isPixelMode || !this.activeProject) return false;
        if (this.activeProject.role === 'layerAlphaMask') return false;
        const pending = this.layers.filter((l) => l && l.importPlacementPending && l.buffer);
        if (!pending.length) return false;
        const committedBounds = [];
        let any = false;
        pending.forEach((l) => {
            const st = l.importStagingBuffer;
            if (st && (st.width | 0) >= 1 && (st.height | 0) >= 1) {
                committedBounds.push({
                    layerId: l.id,
                    x: l.importStagingX | 0,
                    y: l.importStagingY | 0,
                    w: st.width,
                    h: st.height
                });
            }
            if (this.commitImportPlacementForLayer(l)) any = true;
        });
        if (!any) return false;
        this._clearImportStagingDomViews();
        const hist =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('history.importPlacementCommit')
                : 'Poser le collage';
        this.saveHistory(hist, { patchActiveLayer: true });
        const al = this.activeLayer;
        const bounds =
            (al && committedBounds.find((b) => b.layerId === al.id)) ||
            committedBounds[committedBounds.length - 1];
        if (typeof window.clearSelectionContent === 'function') {
            window.clearSelectionContent();
        } else if (typeof window.refreshSelectionVisual === 'function') {
            window.refreshSelectionVisual();
        }
        this.render({ flushUiThumbnails: true });
        return true;
    },

    /**
     * Dimensions de la toile = tampon du calque actif ; le calque est ramené en (0,0), les autres décalés pareillement.
     */
    fitCanvasToActiveLayerBuffer() {
        const l = this.activeLayer;
        if (!l || !l.buffer || !this.isPixelMode || !this.activeProject) return;
        if (this.activeProject.role === 'layerAlphaMask') return;
        const newW = Math.max(1, l.buffer.width | 0);
        const newH = Math.max(1, l.buffer.height | 0);
        const dx = -l.x;
        const dy = -l.y;
        if (dx === 0 && dy === 0 && newW === this.width && newH === this.height) return;

        this.layers.forEach((l2) => {
            l2.x += dx;
            l2.y += dy;
            if (l2.alphaMaskProjectId) {
                const mp = this.projects.find((pr) => pr.id === l2.alphaMaskProjectId);
                if (mp && mp.layers) {
                    mp.layers.forEach((ml) => {
                        ml.x += dx;
                        ml.y += dy;
                    });
                }
            }
        });
        this.activeProject.width = newW;
        this.activeProject.height = newH;

        if (window.pixelShapeEdit) window.pixelShapeEdit = null;
        if (window.selectionBounds && Number.isFinite(window.selectionBounds.x)) {
            window.selectionBounds.x += dx;
            window.selectionBounds.y += dy;
        }
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();

        const hist =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('layer.fitCanvasHistory')
                : 'Toile = calque actif';
        this.saveHistory(hist, { documentGeometry: true });
        this.applyProjectToUI();
    },

    /**
     * Tampon du calque actif = taille du document ; la toile ne change pas. Le contenu est recopié
     * aux coordonnées document (x, y) puis le calque est ramené en (0,0).
     */
    fitActiveLayerBufferToCanvas() {
        const l = this.activeLayer;
        if (!l || !l.buffer || !this.isPixelMode || !this.activeProject) return;
        if (this.activeProject.role === 'layerAlphaMask') return;
        const W = Math.max(1, this.width | 0);
        const H = Math.max(1, this.height | 0);
        const bw = l.buffer.width | 0;
        const bh = l.buffer.height | 0;
        const lx = l.x;
        const ly = l.y;
        if (bw === W && bh === H && lx === 0 && ly === 0) return;

        this._fitLayerBufferToDocumentSize(l);

        if (l.alphaMaskProjectId) {
            const mp = this.projects.find((pr) => pr.id === l.alphaMaskProjectId);
            const ml = mp && mp.layers && mp.layers[0];
            if (mp && ml && ml.buffer) {
                const mw = ml.buffer.width | 0;
                const mh = ml.buffer.height | 0;
                const mlx = ml.x | 0;
                const mly = ml.y | 0;
                const nmb = document.createElement('canvas');
                nmb.width = W;
                nmb.height = H;
                const nmctx = nmb.getContext('2d', { willReadFrequently: true });
                nmctx.clearRect(0, 0, W, H);
                nmctx.drawImage(ml.buffer, 0, 0, mw, mh, lx + mlx, ly + mly, mw, mh);
                ml.buffer = nmb;
                ml.x = 0;
                ml.y = 0;
                mp.width = W;
                mp.height = H;
            }
        }

        if (window.pixelShapeEdit) window.pixelShapeEdit = null;
        const hist =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('layer.fitLayerHistory')
                : 'Calque = toile';
        this.saveHistory(hist, { patchActiveLayer: true });
        this.applyProjectToUI();
    },

    /**
     * Menu Image : aligne la zone de dessin (tampon) du calque sur les dimensions du document
     * sans rééchantillonner le pixel art (recopie 1:1 comme « Calque = toile »).
     */
    alignActiveLayerWidthToCanvas() {
        const t = (k, fb) =>
            window.IlluI18n && typeof window.IlluI18n.t === 'function' && window.IlluI18n.t(k) !== k
                ? window.IlluI18n.t(k)
                : fb;
        if (!this.activeProject || !this.isPixelMode) {
            window.showIlluAlert(t('msg.pixelOnly', 'Disponible en mode Pixel.'));
            return;
        }
        if (this.activeProject.role === 'layerAlphaMask') return;
        const l = this.activeLayer;
        if (!l || !l.buffer) {
            window.showIlluAlert(t('msg.layerBitmapRequired', 'Disponible avec un calque bitmap.'));
            return;
        }
        const W = Math.max(1, this.width | 0);
        const H = Math.max(1, this.height | 0);
        const bw = l.buffer.width | 0;
        const bh = l.buffer.height | 0;
        const lx = l.x;
        const ly = l.y;
        if (bw < 1 || bh < 1) return;
        if (bw === W && bh === H && lx === 0 && ly === 0) {
            window.showIlluAlert(
                t('msg.layerAlreadyCanvasWidth', 'Le tampon du calque a déjà la taille de la toile.')
            );
            return;
        }
        this.fitActiveLayerBufferToCanvas();
        if (typeof window.syncSelectionToActiveLayer === 'function') {
            window.syncSelectionToActiveLayer();
        }
    },

    openImageLayerBoundsDialog() {
        const ov = document.getElementById('image-bounds-overlay');
        const al = this.activeLayer;
        if (!ov) return;
        if (!this.isPixelMode || !al?.buffer) {
            window.showIlluAlert('Disponible en mode Pixel avec un calque bitmap.');
            return;
        }
        const ix = document.getElementById('dlg-layer-pos-x');
        const iy = document.getElementById('dlg-layer-pos-y');
        const iw = document.getElementById('dlg-layer-buf-w');
        const ih = document.getElementById('dlg-layer-buf-h');
        if (ix) ix.value = String(Math.round(al.x));
        if (iy) iy.value = String(Math.round(al.y));
        if (iw) {
            iw.value = String(this.width);
            iw.readOnly = true;
            iw.title = 'Largeur du document (le tampon du calque suit la résolution de la toile)';
        }
        if (ih) {
            ih.value = String(this.height);
            ih.readOnly = true;
            ih.title = 'Hauteur du document (le tampon du calque suit la résolution de la toile)';
        }
        ov.style.display = 'flex';
    },

    closeDynamicFilterPopover() {
        const p = document.getElementById('illu-dynfilter-pop');
        if (p) p.remove();
        if (this._dynFilterOutHandler) {
            document.removeEventListener('mousedown', this._dynFilterOutHandler, true);
            this._dynFilterOutHandler = null;
        }
    },

    /**
     * Calque « filtre dynamique » : effet (flou / netteté) sur le composite sous le calque,
     * visible selon l’alpha du tampon × masque α lié. Le contenu RVB du calque n’est pas dessiné
     * tant que le mode est actif (le calque sert de masque d’effet).
     */
    openDynamicFilterPopover(anchorEl, layerIndex) {
        if (!this.activeProject || !this.isPixelMode || this.activeProject.role === 'layerAlphaMask') {
            return;
        }
        const layer = this.layers[layerIndex];
        if (!layer || !layer.buffer) return;
        if (layer.alphaMaskProjectId) {
            return;
        }

        this.setActiveLayerIndex(layerIndex);
        this.updateLayerUI();
        this.closeDynamicFilterPopover();
        this._normalizeDynamicFilterProps(layer);

        const t = (k, fb) =>
            window.IlluI18n && typeof window.IlluI18n.t === 'function' && window.IlluI18n.t(k) !== k
                ? window.IlluI18n.t(k)
                : fb;

        const pop = document.createElement('div');
        pop.id = 'illu-dynfilter-pop';
        pop.className = 'window floating-window layer-dynfilter-popwindow';
        pop.innerHTML = `
            <div class="title-bar">
                <div class="title-bar-text">${t('layer.dynFilterTitle', 'Filtre dynamique')}</div>
                <div class="title-bar-controls"><button type="button" class="title-bar-close-btn" aria-label="Close" onclick="EditorManager.closeDynamicFilterPopover()"></button></div>
            </div>
            <div class="window-body" style="padding:8px;font-size:11px;">
                <p style="margin:0 0 8px;line-height:1.35;opacity:0.92;">${t(
                    'layer.dynFilterHint',
                    "L'effet s'applique à tout ce qui est sous ce calque. L'alpha du calque (et le masque α) définissent où l'effet est visible. Vous pouvez cumuler plusieurs effets : ils sont appliqués dans l'ordre de haut en bas."
                )}</p>
                <div style="display:flex;align-items:center;gap:15px;margin-bottom:12px;">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                        <input type="checkbox" id="illu-df-en">
                        <span>${t('layer.dynFilterEnable', 'Activer')}</span>
                    </label>
                    <div class="illu-scope-btn-row" id="illu-df-mode-row" style="flex:1;max-width:200px;height:24px;">
                        <button type="button" class="illu-scope-btn" data-mode="0" title="${t('layer.dynFilterModeBelowTitle', 'Effet sur les calques du dessous')}">${t('layer.dynFilterModeBelow', 'Dessous')}</button>
                        <button type="button" class="illu-scope-btn" data-mode="1" title="${t('layer.dynFilterModeSelfTitle', 'Appliquer l’effet uniquement sur mon calque')}">${t('layer.dynFilterModeSelf', 'Ce calque')}</button>
                    </div>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 6px;">
                    <strong style="font-size:11px;">${t('layer.dynFilterStack', "Chaîne d'effets")}</strong>
                    <button type="button" id="illu-df-add" class="opt-bar-btn" style="min-width:0;padding:2px 8px;">${t('layer.dynFilterAdd', '+ Effet')}</button>
                </div>
                <div style="margin:0 0 6px;opacity:0.82;line-height:1.25;">${t(
                    'layer.dynFilterStackHint',
                    "Astuce : ajoutez 2 effets ou plus pour les cumuler. Maximum 8 effets par calque dynamique."
                )}</div>
                <div id="illu-df-stack" style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow:auto;"></div>
                <div style="margin-top:6px;opacity:0.75;line-height:1.25;">${t(
                    'layer.dynFilterOrderHint',
                    "Ordre d'application : effet 1, puis effet 2, etc."
                )}</div>
                <div style="margin-top:6px;opacity:0.78;line-height:1.25;">${t(
                    'layer.dynFilterLegacyHint',
                    "Compatibilité : les anciens projets avec un seul effet continuent de fonctionner."
                )}</div>
                <div style="margin-top:8px;display:flex;justify-content:flex-end;">
                    <button type="button" id="illu-df-close" class="opt-bar-btn">${t('misc.close', 'Fermer')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(pop);

        const en = pop.querySelector('#illu-df-en');
        const modeRow = pop.querySelector('#illu-df-mode-row');
        const addBtn = pop.querySelector('#illu-df-add');
        const stackHost = pop.querySelector('#illu-df-stack');
        const closeBtn = pop.querySelector('#illu-df-close');

        const updateModeUI = () => {
            const mode = layer.dynamicFilterMode | 0;
            modeRow.querySelectorAll('.illu-scope-btn').forEach((btn) => {
                const bMode = parseInt(btn.getAttribute('data-mode'), 10);
                const isActive = bMode === mode;
                btn.classList.toggle('illu-scope-btn--active', isActive);
                btn.classList.toggle('active', isActive); // keep for legacy theme compatibility
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        };
        updateModeUI();

        modeRow.addEventListener('click', (e) => {
            const btn = e.target.closest('.illu-scope-btn');
            if (!btn) return;
            const newMode = parseInt(btn.getAttribute('data-mode'), 10);
            if (newMode === layer.dynamicFilterMode) return;
            layer.dynamicFilterMode = newMode;
            updateModeUI();
            refreshAll(true);
        });

        const effectDefs = [
            ['blur', t('layer.dynFilterBlur', 'Flou')],
            ['shadow', t('layer.dynFilterShadow', 'Ombre')],
            ['gaussian', t('layer.dynFilterGaussian', 'Flou (large)')],
            ['sharpen', t('layer.dynFilterSharpen', 'Netteté')],
            ['pixelate', t('layer.dynFilterPixelate', 'Pixelisé')],
            ['grayscale', t('layer.dynFilterGrayscale', 'Noir et blanc')],
            ['sepia', t('layer.dynFilterSepia', 'Sépia')],
            ['invert', t('layer.dynFilterInvert', 'Négatif')],
            ['saturate', t('layer.dynFilterSaturate', 'Saturation')],
            ['brightness', t('layer.dynFilterBrightness', 'Luminosité')],
            ['contrast', t('layer.dynFilterContrast', 'Contraste')],
            ['hue', t('layer.dynFilterHue', 'Teinte')],
            ['halftone', t('layer.dynFilterHalftone', 'Trame B&W (Halftone)')] // <-- AJOUT
        ];
        const effectOptionsHtml = effectDefs
            .map(([value, label]) => `<option value="${value}">${label}</option>`)
            .join('');

        const ensureStack = () => {
            const stack = this._cloneDynamicFilterStack(layer.dynamicFilterStack);
            if (!stack.length) {
                stack.push({
                    type: this._validDynamicFilterTypes.has(layer.dynamicFilterType)
                        ? layer.dynamicFilterType
                        : 'blur',
                    radius:
                        layer.dynamicFilterRadius != null && Number.isFinite(layer.dynamicFilterRadius)
                            ? Math.max(1, Math.min(32, Math.round(layer.dynamicFilterRadius)))
                            : 6
                });
            }
            layer.dynamicFilterStack = stack;
            this._syncLegacyDynamicFilterPropsFromStack(layer);
            return stack;
        };

        const pushHistory = () => {
            this.saveHistory(t('layer.dynFilterHistory', 'Filtre dynamique calque'), {
                patchActiveLayer: true
            });
        };

        const refreshAll = (withHistory) => {
            this._normalizeDynamicFilterProps(layer);
            if (withHistory) pushHistory();
            this.updateLayerUI();
            this.render();
        };

        const renderStackRows = () => {
            const stack = ensureStack();
            stackHost.innerHTML = '';
            stack.forEach((fx, index) => {
                const row = document.createElement('div');
                row.style.cssText =
                    'border:1px solid #8a8a8a;padding:6px;background:rgba(255,255,255,0.12);display:flex;flex-direction:column;gap:5px;';
                row.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <strong style="font-size:11px;">${t('layer.dynFilterEffectN', 'Effet {n}').replace('{n}', String(index + 1))}</strong>
                        <button type="button" class="opt-bar-btn illu-df-remove" style="min-width:0;padding:2px 8px;" ${stack.length <= 1 ? 'disabled' : ''}>${t('layer.dynFilterRemove', 'Supprimer')}</button>
                    </div>
                    <div class="field-row" style="align-items:center;margin:0;">
                        <label style="width:72px;flex-shrink:0;">${t('layer.dynFilterType', 'Effet')}</label>
                        <select class="illu-df-type" style="flex:1;min-width:0;font-size:11px;">${effectOptionsHtml}</select>
                    </div>
                    <div class="field-row" style="align-items:center;margin:0;">
                        <label style="width:72px;flex-shrink:0;">${t('layer.dynFilterRadius', 'Intensité')}</label>
                        <input type="range" class="illu-df-rad" min="1" max="32" value="${fx.radius}" style="flex:1;min-width:0;">
                        <span class="illu-df-rad-v" style="width:24px;text-align:right;">${fx.radius}</span>
                    </div>
                `;
                const typEl = row.querySelector('.illu-df-type');
                const radEl = row.querySelector('.illu-df-rad');
                const radValEl = row.querySelector('.illu-df-rad-v');
                const delEl = row.querySelector('.illu-df-remove');
                typEl.value = fx.type;
                typEl.onchange = () => {
                    this._dynamicFilterLivePreviewActive = false;
                    stack[index].type = typEl.value;
                    layer.dynamicFilterStack = this._cloneDynamicFilterStack(stack);
                    refreshAll(true);
                    renderStackRows();
                };
                radEl.oninput = () => {
                    this._dynamicFilterLivePreviewActive = true;
                    const nextRadius = Math.max(1, Math.min(32, parseInt(radEl.value, 10) || 6));
                    radValEl.textContent = String(nextRadius);
                    stack[index].radius = nextRadius;
                    layer.dynamicFilterStack = this._cloneDynamicFilterStack(stack);
                    this._syncLegacyDynamicFilterPropsFromStack(layer);
                    this.render();
                };
                radEl.onchange = () => {
                    this._dynamicFilterLivePreviewActive = false;
                    const nextRadius = Math.max(1, Math.min(32, parseInt(radEl.value, 10) || 6));
                    stack[index].radius = nextRadius;
                    layer.dynamicFilterStack = this._cloneDynamicFilterStack(stack);
                    refreshAll(true);
                };
                delEl.onclick = () => {
                    if (stack.length <= 1) return;
                    stack.splice(index, 1);
                    layer.dynamicFilterStack = this._cloneDynamicFilterStack(stack);
                    refreshAll(true);
                    renderStackRows();
                };
                stackHost.appendChild(row);
            });
            addBtn.disabled = stack.length >= 8;
            addBtn.title =
                stack.length >= 8
                    ? t('layer.dynFilterAddMax', 'Maximum atteint')
                    : t('layer.dynFilterAdd', '+ Effet');
        };

        en.checked = !!layer.dynamicFilterEnabled;
        ensureStack();
        renderStackRows();

        en.onchange = () => {
            layer.dynamicFilterEnabled = en.checked;
            refreshAll(true);
        };
        addBtn.onclick = () => {
            const stack = ensureStack();
            if (stack.length >= 8) return;
            const last = stack[stack.length - 1] || { type: 'blur', radius: 6 };
            stack.push({ type: last.type, radius: last.radius });
            layer.dynamicFilterStack = this._cloneDynamicFilterStack(stack);
            refreshAll(true);
            renderStackRows();
        };
        closeBtn.onclick = () => this.closeDynamicFilterPopover();

        const r = anchorEl.getBoundingClientRect();
        pop.style.position = 'fixed';
        pop.style.width = '340px';
        pop.style.zIndex = '30010';
        pop.style.left = Math.max(8, Math.min(window.innerWidth - 348, r.right + 4)) + 'px';
        pop.style.top = Math.max(8, Math.min(window.innerHeight - 420, r.top)) + 'px';

        if (typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(pop);
        }

        this._dynFilterOutHandler = (e) => {
            if (!pop.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
                this.closeDynamicFilterPopover();
            }
        };
        setTimeout(() => document.addEventListener('mousedown', this._dynFilterOutHandler, true), 0);
    },

    applyActiveLayerBoundsFromDialog() {
        const l = this.activeLayer;
        if (!l || !l.buffer || !this.isPixelMode) return;
        const x = parseInt(document.getElementById('dlg-layer-pos-x')?.value, 10);
        const y = parseInt(document.getElementById('dlg-layer-pos-y')?.value, 10);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        l.x = x;
        l.y = y;
        this.saveHistory('Calque : position');
        const ov = document.getElementById('image-bounds-overlay');
        if (ov) ov.style.display = 'none';
        this.updateLayerUI();
        this.render();
    },

    _syncLayerPaletteToolbar() {
        const n = this.layers ? this.layers.length : 0;
        const singleLayer = n <= 1;
        ['btn-del-layer', 'btn-move-up', 'btn-move-down'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = singleLayer;
            btn.setAttribute('aria-disabled', singleLayer ? 'true' : 'false');
        });
    },

    updateLayerUI() {
        this._syncLayerPaletteToolbar();
        const list = document.getElementById('layers-list');
        if (!list) return;
        const sig = [
            this.mode || '',
            this.activeLayerIndex | 0,
            this._uiThumbsVisible() ? 1 : 0,
            ...(this.layers || []).map((layer) => {
                this._normalizeDynamicFilterProps(layer);
                return [
                    layer.id,
                    layer.name || '',
                    layer.visible ? 1 : 0,
                    layer.opacity != null ? Number(layer.opacity).toFixed(4) : '1',
                    layer.alphaMaskProjectId != null ? layer.alphaMaskProjectId : 'none',
                    this._isLiveDynamicFilterLayer(layer) ? 1 : 0,
                    layer.dynamicFilterAlphaPreview ? 1 : 0,
                    layer.dynamicFilterType || '',
                    layer.dynamicFilterRadius || 0,
                    layer.dynamicFilterEnabled ? 1 : 0,
                    layer.dynamicFilterMode | 0,
                    JSON.stringify(layer.dynamicFilterStack || [])
                ].join(':');
            })
        ].join('|');
        if (this._lastLayerUiSignature === sig) return;
        this._lastLayerUiSignature = sig;
        if (typeof this._layerRowDragDocCleanup === 'function') {
            try {
                this._layerRowDragDocCleanup();
            } catch (e) {
                /* ignore */
            }
            this._layerRowDragDocCleanup = null;
        }
        list.innerHTML = '';
        [...this.layers].reverse().forEach((layer, i) => {
            const idx = this.layers.length - 1 - i;
            const item = document.createElement('div');
            this._normalizeDynamicFilterProps(layer);
            const dynFxRow = this._isLiveDynamicFilterLayer(layer);
            const hasMask = !!layer.alphaMaskProjectId;
            item.className = `list-item layer-row ${idx === this.activeLayerIndex ? 'active' : ''}${
                dynFxRow ? ' layer-row--dyn-filter' : ''
            }${hasMask && !dynFxRow ? ' layer-row--alpha-mask' : ''}`;
            item.dataset.layerIndex = String(idx);
            item.dataset.layerId = String(layer.id);

            const eye = document.createElement('input');
            eye.type = 'checkbox';
            eye.className = 'layer-eye';
            eye.checked = !!layer.visible;
            eye.title = 'Visibilité';
            eye.onclick = (e) => {
                e.stopPropagation();
            };
            eye.onchange = () => {
                layer.visible = eye.checked;
                this.updateLayerUI();
                this.render();
            };
            item.appendChild(eye);

            if ((this.isPixelMode && layer.buffer && this._uiThumbsVisible()) ||
                (!this.isPixelMode && this._uiThumbsVisible())) {
                const thumb = document.createElement('img');
                thumb.className = 'layer-thumb';
                thumb.alt = '';
                const layerSz = this.getLayerThumbCssSize(layer);
                thumb.width = layerSz.width || 28;
                thumb.height = layerSz.height || 28;
                thumb.draggable = false;
                const emptyGif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                
                // Utiliser la miniature cachée pour éviter le clignotement
                const cachedUrl = layer._cachedThumbUrl || emptyGif;
                thumb.src = cachedUrl;
                
                // Mode vecteur : prévisualiser le contenu SVG de ce calque
                if (!this.isPixelMode) {
                    this._getVectorLayerThumbnailDataUrl(layer, idx).then(url => {
                        if (url) {
                            layer._cachedThumbUrl = url;
                            thumb.src = url;
                        }
                    }).catch(() => {});
                }
                item.appendChild(thumb);
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.innerText = layer.name;
            item.appendChild(nameSpan);
            
            if (this.isPixelMode && this.activeProject && this.activeProject.role !== 'layerAlphaMask') {
                if (!dynFxRow) {
                    const ab = document.createElement('button');
                    ab.type = 'button';
                    ab.className = 'layer-alpha-btn';
                    ab.textContent = hasMask ? 'α●' : 'α';
                    ab.title = hasMask
                        ? 'Masque alpha (actif) — éditer'
                        : 'Créer / ouvrir le masque alpha (taille du calque, lié au projet)';
                    ab.style.fontSize = '10px';
                    if (hasMask) {
                        ab.style.color = '#1a3d7a';
                        ab.style.fontWeight = '600';
                    }
                    ab.onclick = (e) => {
                        e.stopPropagation();
                        this.openLayerAlphaMask(idx);
                    };
                    item.appendChild(ab);
                    if (hasMask) {
                        const trash = document.createElement('button');
                        trash.type = 'button';
                        trash.className = 'layer-alpha-clear-btn';
                        trash.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
                        trash.title =
                            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                                ? window.IlluI18n.t('layer.clearAlphaBtnTitle')
                                : 'Supprimer le masque α';
                        trash.onclick = (e) => {
                            e.stopPropagation();
                            this.removeLayerAlphaMaskAtIndex(idx);
                        };
                        item.appendChild(trash);
                    }
                }

                const fxBtn = document.createElement('button');
                fxBtn.type = 'button';
                this._normalizeDynamicFilterProps(layer);
                fxBtn.className =
                    'layer-dynfx-btn' +
                    (this._isLiveDynamicFilterLayer(layer) ? ' layer-dynfx-btn--on' : '');
                fxBtn.textContent = 'ƒ';
                if (hasMask) {
                    fxBtn.disabled = true;
                    fxBtn.classList.add('layer-dynfx-btn--disabled');
                    fxBtn.title =
                        window.IlluI18n && typeof window.IlluI18n.t === 'function'
                            ? window.IlluI18n.t('layer.dynFilterDisabledByAlpha')
                            : 'Masque α actif : retirez-le pour utiliser le filtre dynamique (ƒ).';
                    fxBtn.onclick = (e) => e.stopPropagation();
                } else {
                    fxBtn.title =
                        window.IlluI18n && typeof window.IlluI18n.t === 'function'
                            ? window.IlluI18n.t('layer.dynFilterBtnTitle')
                            : 'Filtre dynamique (effet sous le calque, masqué par alpha / masque α)';
                    fxBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.openDynamicFilterPopover(fxBtn, idx);
                    };
                }
                item.appendChild(fxBtn);

                if (dynFxRow && (layer.dynamicFilterMode | 0) === 0) {
                    const pv = document.createElement('button');
                    pv.type = 'button';
                    pv.className =
                        'layer-dynfilter-alpha-preview-btn' +
                        (layer.dynamicFilterAlphaPreview ? ' layer-dynfilter-alpha-preview-btn--on' : '');
                    pv.innerHTML =
                        '<i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i>';
                    pv.title =
                        window.IlluI18n && typeof window.IlluI18n.t === 'function'
                            ? window.IlluI18n.t('layer.dynAlphaPreviewBtnTitle')
                            : 'Voir la carte d’effet (N&B, plein cadre) — le filtre ƒ est suspendu.';
                    pv.onclick = (e) => {
                        e.stopPropagation();
                        layer.dynamicFilterAlphaPreview = !layer.dynamicFilterAlphaPreview;
                        const ph =
                            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                                ? window.IlluI18n.t('layer.dynMaskPreviewHistory')
                                : 'Aperçu carte filtre dynamique';
                        this.saveHistory(ph, { patchActiveLayer: true });
                        this.updateLayerUI();
                        this.render();
                    };
                    item.appendChild(pv);
                }
            }

            item.addEventListener('click', () => {
                if (item.dataset.illuSuppressLayerClick === '1') {
                    delete item.dataset.illuSuppressLayerClick;
                    return;
                }
                this.setActiveLayerIndex(idx);
                this.updateLayerUI();
                this.render();
            });
            let layerPtr = null;
            item.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const tap = e.target instanceof Element ? e.target : e.target && e.target.parentElement;
                if (!tap || typeof tap.closest !== 'function') return;
                if (
                    tap.closest(
                        '.layer-eye, .layer-alpha-btn, .layer-alpha-clear-btn, .layer-dynfx-btn, .layer-dynfilter-alpha-preview-btn, button'
                    )
                ) {
                    return;
                }
                if (typeof this._layerRowDragDocCleanup === 'function') {
                    try {
                        this._layerRowDragDocCleanup();
                    } catch (err) {
                        /* ignore */
                    }
                    this._layerRowDragDocCleanup = null;
                }
                layerPtr = {
                    pid: e.pointerId,
                    from: idx,
                    x0: e.clientX,
                    y0: e.clientY,
                    moved: false,
                    domReorder: false
                };
                try {
                    item.setPointerCapture(e.pointerId);
                } catch (err) {
                    /* ignore */
                }

                const DRAG_PX = 8;
                const docMove = (ev) => {
                    if (!layerPtr || ev.pointerId !== layerPtr.pid) return;
                    if (Math.hypot(ev.clientX - layerPtr.x0, ev.clientY - layerPtr.y0) <= DRAG_PX) return;
                    ev.preventDefault();
                    layerPtr.moved = true;
                    if (!layerPtr.domReorder) {
                        layerPtr.domReorder = true;
                        item.classList.add('layer-row--dragging');
                    }
                    const y = ev.clientY;
                    const siblings = [...list.children].filter(
                        (c) => c.classList && c.classList.contains('layer-row')
                    );
                    let targetBefore = null;
                    for (const r of siblings) {
                        if (r === item) continue;
                        const br = r.getBoundingClientRect();
                        if (y < br.top + br.height / 2) {
                            targetBefore = r;
                            break;
                        }
                    }
                    if (targetBefore) list.insertBefore(item, targetBefore);
                    else list.appendChild(item);
                };

                const layerPtrEnd = (ev) => {
                    document.removeEventListener('pointermove', docMove);
                    document.removeEventListener('pointerup', docEnd);
                    document.removeEventListener('pointercancel', docEnd);
                    this._layerRowDragDocCleanup = null;
                    try {
                        item.releasePointerCapture(ev.pointerId);
                    } catch (err) {
                        /* ignore */
                    }
                    const lp = layerPtr;
                    layerPtr = null;
                    item.classList.remove('layer-row--dragging');
                    if (!lp) return;
                    if (!lp.moved) return;
                    item.dataset.illuSuppressLayerClick = '1';
                    if (lp.domReorder) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        this.reorderLayersFromDomOrder(list);
                        return;
                    }
                    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
                    const row = hit && hit.closest && hit.closest('.layer-row');
                    if (!row || !list.contains(row)) return;
                    const toIdx = parseInt(row.dataset.layerIndex, 10);
                    if (Number.isFinite(toIdx) && toIdx !== lp.from) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        this.reorderLayersAtIndices(lp.from, toIdx);
                    }
                };

                const docEnd = (ev) => {
                    if (!layerPtr || ev.pointerId !== layerPtr.pid) return;
                    layerPtrEnd(ev);
                };

                this._layerRowDragDocCleanup = () => {
                    document.removeEventListener('pointermove', docMove);
                    document.removeEventListener('pointerup', docEnd);
                    document.removeEventListener('pointercancel', docEnd);
                };

                document.addEventListener('pointermove', docMove, { passive: false });
                document.addEventListener('pointerup', docEnd);
                document.addEventListener('pointercancel', docEnd);
            });
            item.addEventListener('mouseenter', () => {
                this._layerListHoverIndex = idx;
                this.drawUI();
            });
            item.addEventListener('mouseleave', () => {
                if (this._layerListHoverIndex === idx) {
                    this._layerListHoverIndex = null;
                    this.drawUI();
                }
            });
            list.appendChild(item);
        });
        
        const boundsPanel = document.getElementById('layer-bounds-panel');
        const al = this.activeLayer;
        if (boundsPanel) {
            if (this.isPixelMode && al && al.buffer) {
                boundsPanel.style.display = 'block';

                const blendSel = document.getElementById('layer-blend-mode');
                if (blendSel) {
                    const bm = this.getLayerBlendMode(al);
                    blendSel.value = [...blendSel.options].some((o) => o.value === bm) ? bm : 'source-over';
                    blendSel.onchange = () => {
                        al.blendMode = blendSel.value;
                        this.saveHistory('Fusion calque');
                        this.render();
                    };
                }
                const opR = document.getElementById('layer-opacity-range');
                const opV = document.getElementById('layer-opacity-val');
                if (opR && opV) {
                    const pct = Math.round((al.opacity != null ? al.opacity : 1) * 100);
                    opR.value = String(pct);
                    opV.textContent = String(pct);
                    opR.oninput = () => {
                        opV.textContent = opR.value;
                        al.opacity = parseInt(opR.value, 10) / 100;
                        this.render();
                    };
                    opR.onchange = () => this.saveHistory('Opacité calque');
                }
            } else {
                boundsPanel.style.display = 'none';
            }
        }

        const binder = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
        binder('btn-add-layer', () => this.addLayer());
        binder('btn-del-layer', () => this.deleteLayer());
        binder('btn-move-up', () => this.moveLayer(1));
        binder('btn-move-down', () => this.moveLayer(-1));
        binder('btn-dup-layer', () => this.duplicateActiveLayer());

        binder('btn-layer-solo', () => this.illuContextLayerSolo(this.activeLayerIndex));
        binder('btn-layer-show-all', () => this.illuContextLayerShowAll());
        binder('btn-merge-layers', () => this.mergeLayers());
        binder('btn-fit-layer', () => this.alignActiveLayerWidthToCanvas());

        const canPixelBuf = this.isPixelMode && al && al.buffer;
        const dupEl = document.getElementById('btn-dup-layer');
        if (dupEl) dupEl.disabled = !canPixelBuf;
        const fitEl = document.getElementById('btn-fit-layer');
        if (fitEl) fitEl.disabled = !canPixelBuf;
        const mergeEl = document.getElementById('btn-merge-layers');
        if (mergeEl) {
            mergeEl.disabled =
                !Array.isArray(this.layers) || this.layers.length < 2 || this.activeLayerIndex === 0;
        }

        if (this.isPixelMode && this._uiThumbsVisible()) {
            this.scheduleUiThumbnailsRefresh();
        }
    },

    /** Crée 3 calques (R, V, B en niveaux de gris du canal) à partir du calque actif, au même emplacement. */
    splitActiveLayerRgbChannels() {
        if (!this.activeProject || !this.isPixelMode) {
            const msg =
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('msg.rgbSplitPixel')
                    : 'Disponible en mode Pixel.';
            window.showIlluAlert(msg);
            return;
        }
        const src = this.activeLayer;
        if (!src || !src.buffer) {
            const msg =
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('msg.rgbSplitNoBuffer')
                    : 'Le calque actif doit contenir une image bitmap.';
            window.showIlluAlert(msg);
            return;
        }
        const t = (k, fb) =>
            window.IlluI18n && typeof window.IlluI18n.t === 'function' && window.IlluI18n.t(k) !== k
                ? window.IlluI18n.t(k)
                : fb;
        const sw = src.buffer.width;
        const sh = src.buffer.height;
        let idata;
        try {
            idata = src.buffer.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh);
        } catch (e) {
            window.showIlluAlert(t('msg.rgbSplitRead', 'Impossible de lire les pixels du calque.'));
            return;
        }
        const d = idata.data;
        const names = [t('layer.channelR', 'Canal R'), t('layer.channelG', 'Canal V'), t('layer.channelB', 'Canal B')];
        const makeLayerWithChannel = (ch) => {
            const c = document.createElement('canvas');
            c.width = sw;
            c.height = sh;
            const im = new ImageData(sw, sh);
            const od = im.data;
            for (let i = 0; i < d.length; i += 4) {
                const v = d[i + ch];
                od[i] = od[i + 1] = od[i + 2] = v;
                od[i + 3] = d[i + 3];
            }
            c.getContext('2d', { willReadFrequently: true }).putImageData(im, 0, 0);
            return {
                id: 0,
                name: names[ch],
                visible: true,
                x: src.x,
                y: src.y,
                opacity: 1,
                blendMode: 'source-over',
                buffer: c,
                alphaMaskProjectId: null,
                ...this._defaultDynamicFilterLayerProps()
            };
        };
        const insertAt = this.activeLayerIndex + 1;
        const baseId = Date.now() + Math.floor(Math.random() * 100000);
        for (let ch = 0; ch < 3; ch++) {
            const L = makeLayerWithChannel(ch);
            L.id = baseId + ch * 7919;
            this.layers.splice(insertAt + ch, 0, L);
        }
        this.setActiveLayerIndex(insertAt + 2);
        this.saveHistory('Séparer canaux RVB');
        this.updateLayerUI();
        this.render();
    },

    mergeLayers() {
        if (this.layers.length < 2 || this.activeLayerIndex === 0) return;

        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];

        if (this.isPixelMode) {
            this._normalizeDynamicFilterProps(topLayer);
            const docW = this.width;
            const docH = this.height;

            const bBuf = bottomLayer.buffer;
            const bCtx = bBuf.getContext('2d', { willReadFrequently: true });

            // Create a scratch canvas for the top layer's visual result
            const scratch = document.createElement('canvas');
            scratch.width = bBuf.width;
            scratch.height = bBuf.height;
            const sCtx = scratch.getContext('2d', { willReadFrequently: true });

            const isDynFilter = this._isLiveDynamicFilterLayer(topLayer);

            if (isDynFilter) {
                // Apply filter to bottomLayer's content using topLayer as mask
                let base;
                try {
                    base = bCtx.getImageData(0, 0, bBuf.width, bBuf.height);
                } catch (e) {
                    console.error('MergeLayers: Failed to read bottom layer buffer', e);
                    return;
                }

                // Apply filters to a copy of the base
                const filteredImageData = this._applyDynamicFilterToImageDataCopy(base, topLayer);
                
                // Build the mask using relative coordinates
                const proxyLayer = {
                    ...topLayer,
                    x: topLayer.x - bottomLayer.x,
                    y: topLayer.y - bottomLayer.y
                };
                const maskIm = this._buildDynamicFilterMaskImageData(proxyLayer, bBuf.width, bBuf.height);

                // Blend filtered result back into bottom buffer
                const out = this._blendRgbByDynamicMask(base, filteredImageData, maskIm);
                bCtx.putImageData(out, 0, 0);
            } else {
                // Normal layer merge with Mask support
                sCtx.save();
                let useMasks = !!topLayer.alphaMaskProjectId;
                if (useMasks) {
                    const mp = this.projects.find((pr) => pr.id === topLayer.alphaMaskProjectId);
                    if (mp) {
                        const maskFlat = this.flattenPixelProjectToCanvas(mp, false);
                        const proxyLayer = {
                            ...topLayer,
                            x: topLayer.x - bottomLayer.x,
                            y: topLayer.y - bottomLayer.y
                        };
                        this._drawLayerWithLuminanceMask(sCtx, proxyLayer, maskFlat, bBuf.width, bBuf.height);
                    } else {
                        useMasks = false;
                    }
                }
                
                if (!useMasks) {
                    sCtx.drawImage(topLayer.buffer, topLayer.x - bottomLayer.x, topLayer.y - bottomLayer.y);
                }
                sCtx.restore();

                // Draw prepared top layer onto bottom buffer with opacity and blend mode
                bCtx.save();
                bCtx.globalAlpha = topLayer.opacity;
                bCtx.globalCompositeOperation = this.getLayerBlendMode(topLayer);
                bCtx.drawImage(scratch, 0, 0);
                bCtx.restore();
            }

            // Cleanup mask project if needed
            if (topLayer.alphaMaskProjectId) {
                const mp = this.projects.find((pr) => pr.id === topLayer.alphaMaskProjectId);
                if (mp) this.disposeProjectResources(mp);
                this.projects = this.projects.filter((pr) => pr.id !== topLayer.alphaMaskProjectId);
            }
        } else {
            const topG = document.getElementById(`layer-${topLayer.id}`);
            const bottomG = document.getElementById(`layer-${bottomLayer.id}`);
            if (topG && bottomG) {
                // Move children from top to bottom with relative offsets
                const dx = topLayer.x - bottomLayer.x;
                const dy = topLayer.y - bottomLayer.y;
                while (topG.firstChild) {
                    const child = topG.firstChild;
                    // Note: Simplistic, doesn't handle nested transforms well
                    bottomG.appendChild(child);
                }
            }
        }

        this.deleteLayer();
        this.saveHistory('Fusionner calques');
        this.render();
    },

    // --- HISTORY ---
    initHistory() {
        window.undo = () => this.doHistory(-1);
        window.redo = () => this.doHistory(1);
    },

    /** @returns {number} borne 5–500 */
    getHistoryMaxEntries() {
        try {
            const n = parseInt(localStorage.getItem('illu_history_max_entries'), 10);
            if (Number.isFinite(n) && n >= 5 && n <= 500) return n;
        } catch (e) {
            /* ignore */
        }
        return this.HISTORY_MAX_ENTRIES_DEFAULT;
    },

    _disposeCanvasBuffer(c) {
        if (!c || typeof c.width !== 'number') return;
        try {
            c.width = 0;
            c.height = 0;
        } catch (e) {
            /* ignore */
        }
    },

    /**
     * Libère les tampons canvas d’une entrée d’historique (undo/redo).
     * @param {*} data
     */
    disposeHistoryEntryData(data) {
        if (!data || typeof data !== 'object') return;
        if (data.type === 'pixel-patch' && data.patch) {
            if (data.patch.buffer) {
                this._disposeCanvasBuffer(data.patch.buffer);
                data.patch.buffer = null;
            }
            if (data.patch.importStagingCanvas) {
                this._disposeCanvasBuffer(data.patch.importStagingCanvas);
                data.patch.importStagingCanvas = null;
            }
        } else if (
            (data.type === 'pixel-full' || data.type === 'pixel-layers') &&
            Array.isArray(data.layers)
        ) {
            data.layers.forEach((l) => {
                if (l && l.buffer) {
                    this._disposeCanvasBuffer(l.buffer);
                    l.buffer = null;
                }
            });
        } else if (data.type === 'vector-full' && typeof data.svg === 'string') {
            data.svg = '';
        } else if (data.type === 'vector-layer-patch') {
            data.layerHtml = '';
            data.defsHtml = '';
        }
    },

    /** Instantané historique vecteur : calque actif + defs (pas tout svg-layers). */
    _snapshotVectorHistoryData(opts) {
        opts = opts || {};
        const usePatch = !opts.documentGeometry && opts.patchActiveLayer === true;
        const sl = document.getElementById('svg-layers');
        
        const getFallbackSvg = () => sl ? sl.innerHTML : (this.activeProject && this.activeProject.svgData) || '';

        if (!usePatch) {
            return { type: 'vector-full', svg: getFallbackSvg() };
        }
        const al = this.activeLayer;
        const lg = al && document.getElementById(`layer-${al.id}`);
        if (!al || !lg) {
            return { type: 'vector-full', svg: getFallbackSvg() };
        }
        const defs = document.getElementById('vector-doc-defs');
        return {
            type: 'vector-layer-patch',
            layerId: al.id,
            activeLayerIndex: this.activeLayerIndex,
            layerHtml: lg.innerHTML,
            layerMeta: {
                x: al.x,
                y: al.y,
                name: al.name,
                visible: !!al.visible,
                opacity: al.opacity != null ? al.opacity : 1,
                blendMode: al.blendMode || 'source-over'
            },
            defsHtml: defs ? defs.innerHTML : ''
        };
    },

    _vectorHistoryDataEqual(a, b) {
        if (!a || !b || a.type !== b.type) return false;
        if (a.type === 'vector-full') return a.svg === b.svg;
        if (a.type === 'vector-layer-patch') {
            return (
                a.layerId === b.layerId &&
                a.layerHtml === b.layerHtml &&
                a.defsHtml === b.defsHtml
            );
        }
        return false;
    },

    _applyVectorLayerPatchHistory(d) {
        if (!d) return;
        const g = document.getElementById(`layer-${d.layerId}`);
        if (g && d.layerHtml != null) g.innerHTML = d.layerHtml;
        if (d.layerMeta) {
            const li = this.layers.findIndex((l) => l.id === d.layerId);
            if (li >= 0) {
                const m = d.layerMeta;
                const layer = this.layers[li];
                layer.x = m.x;
                layer.y = m.y;
                if (m.name != null) layer.name = m.name;
                layer.visible = m.visible;
                layer.opacity = m.opacity;
                if (m.blendMode) layer.blendMode = m.blendMode;
                const domG = document.getElementById(`layer-${layer.id}`);
                if (domG) {
                    domG.setAttribute('transform', `translate(${layer.x}, ${layer.y})`);
                    domG.style.display = layer.visible ? 'inline' : 'none';
                    domG.style.opacity = layer.opacity;
                }
            }
        }
        if (d.defsHtml != null) {
            const defs = document.getElementById('vector-doc-defs');
            if (defs) defs.innerHTML = d.defsHtml;
        }
        if (d.activeLayerIndex != null && this.layers.length) {
            this.setActiveLayerIndex(
                Math.min(Math.max(0, d.activeLayerIndex | 0), this.layers.length - 1)
            );
        }
        this.activeVectorSelection = [];
        window._activeVectorShapeEl = null;
        if (typeof window.clearAnchors === 'function') window.clearAnchors();
        if (typeof window.illuVectorEndSelectionPreviews === 'function') {
            window.illuVectorEndSelectionPreviews();
        }
    },

    /**
     * Libère l’historique, les calques pixel et les instantanés d’un projet retiré de la session (mémoire).
     * @param {*} p
     */
    disposeProjectResources(p) {
        if (!p) return;
        if (Array.isArray(p.history)) {
            p.history.forEach((he) => {
                if (he && he.data) this.disposeHistoryEntryData(he.data);
            });
            p.history = [];
        }
        p.historyIndex = -1;
        if (p.mode.startsWith('pixel') && Array.isArray(p.layers)) {
            p.layers.forEach((l) => {
                if (l && l.buffer) {
                    this._disposeCanvasBuffer(l.buffer);
                    l.buffer = null;
                }
            });
            p.layers = [];
        }
        if (p.pixelSnapshot && Array.isArray(p.pixelSnapshot.layers)) {
            p.pixelSnapshot.layers.forEach((s) => {
                if (s && s.bufferCanvas) {
                    this._disposeCanvasBuffer(s.bufferCanvas);
                    s.bufferCanvas = null;
                }
            });
        }
        p.pixelSnapshot = null;
        if (p.canvasData && typeof p.canvasData.width === 'number') {
            this._disposeCanvasBuffer(p.canvasData);
        }
        p.canvasData = null;
        p.svgData = '';
    },

    /** Applique la limite courante à tous les onglets ouverts (préférence modifiée). */
    trimAllProjectsHistoryToMax() {
        const maxH = this.getHistoryMaxEntries();
        this.projects.forEach((p) => {
            if (!p || !Array.isArray(p.history)) return;
            while (p.history.length > maxH) {
                const dropped = p.history.shift();
                if (dropped && dropped.data) this.disposeHistoryEntryData(dropped.data);
                p.historyIndex = (p.historyIndex | 0) - 1;
            }
            if (p.history.length === 0) {
                p.historyIndex = -1;
            } else if (p.historyIndex < 0) {
                p.historyIndex = 0;
            } else if (p.historyIndex >= p.history.length) {
                p.historyIndex = p.history.length - 1;
            }
        });
        this.updateHistoryUI();
    },

    /**
     * Vide l'historique d'un projet spécifique en ne gardant que l'état actuel.
     * @param {object} p - Le projet à nettoyer.
     */
    clearProjectHistory(p) {
        if (!p || !Array.isArray(p.history)) return;
        const currentIdx = p.historyIndex != null ? p.historyIndex : p.history.length - 1;
        const currentEntry = p.history[currentIdx];

        // Libérer tous les tampons sauf celui de l'état actuel (si utilisé ailleurs, EditorManager.render s'en chargera)
        p.history.forEach((he, i) => {
            if (i !== currentIdx && he && he.data) {
                this.disposeHistoryEntryData(he.data);
            }
        });

        if (currentEntry) {
            currentEntry.name = window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t('history.initial') : 'État initial';
            p.history = [currentEntry];
            p.historyIndex = 0;
        } else {
            p.history = [];
            p.historyIndex = -1;
        }

        if (p === this.activeProject) {
            this.updateHistoryUI();
        }
    },

    /** Vide l'historique du projet actif. */
    clearCurrentProjectHistory() {
        if (!this.activeProject) return;
        this.clearProjectHistory(this.activeProject);
        this._scheduleWorkspacePersist();
    },

    /** Vide l'historique de tous les projets ouverts. */
    clearAllProjectsHistory() {
        this.projects.forEach((p) => this.clearProjectHistory(p));
        this._scheduleWorkspacePersist();
    },

    normalizeAllLayersToDocument() {
        const p = this.activeProject;
        if (!p || !this.isPixelMode || p.role === 'layerAlphaMask') return;
        const W = this.width;
        const H = this.height;
        p.layers.forEach((layer) => {
            if (!layer || !layer.buffer) return;
            const needs =
                (layer.x | 0) !== 0 ||
                (layer.y | 0) !== 0 ||
                (layer.buffer.width | 0) !== W ||
                (layer.buffer.height | 0) !== H;
            if (!needs) return;
            const nc = document.createElement('canvas');
            nc.width = W;
            nc.height = H;
            const nctx = nc.getContext('2d', { willReadFrequently: true });
            if (nctx) {
                nctx.imageSmoothingEnabled = false;
                nctx.drawImage(layer.buffer, layer.x | 0, layer.y | 0);
            }
            layer.buffer = nc;
            layer.x = 0;
            layer.y = 0;
        });
    },

    /**
     * @param {string} actionName
     * @param {{ patchActiveLayer?: boolean, documentGeometry?: boolean }} [opts]
     *   patchActiveLayer : ne cloner que le calque actif (léger, dessin / retouches).
     *   documentGeometry : recadrage, redimensionnement, extension… — cliché complet + docW/docH.
     */
    saveHistory(actionName, opts = {}) {
        if (!this.activeProject) return;
        if (this.isPixelMode && (!this.toolProps || !this.toolProps.allowOutsideCanvas)) {
            this.normalizeAllLayersToDocument();
        }
        const usePatch =
            !opts.documentGeometry &&
            opts.patchActiveLayer === true &&
            this.isPixelMode &&
            this.activeLayer &&
            this.activeLayer.buffer;

        let data;
        if (this.isPixelMode) {
            if (usePatch) {
                const al = this.activeLayer;
                const ai = this.activeLayerIndex;
                data = {
                    type: 'pixel-patch',
                    layerId: al.id,
                    activeLayerIndex: ai,
                    patch: {
                        buffer: this.cloneCanvas(al.buffer),
                        x: al.x,
                        y: al.y,
                        name: al.name,
                        visible: al.visible,
                        opacity: al.opacity != null ? al.opacity : 1,
                        blendMode: al.blendMode || 'source-over',
                        alphaMaskProjectId: al.alphaMaskProjectId != null ? al.alphaMaskProjectId : null,
                        importPlacementPending: !!al.importPlacementPending,
                        importStagingX: al.importStagingX | 0,
                        importStagingY: al.importStagingY | 0,
                        importStagingCanvas: al.importStagingBuffer
                            ? this.cloneCanvas(al.importStagingBuffer)
                            : null,
                        ...this._snapshotDynamicFilterProps(al)
                    }
                };
        } else {
                data = {
                    type: 'pixel-full',
                    layers: this.layers.map((l) => ({
                        id: l.id,
                        name: l.name,
                        visible: l.visible,
                        x: l.x,
                        y: l.y,
                        opacity: l.opacity,
                        blendMode: l.blendMode || 'source-over',
                        alphaMaskProjectId: l.alphaMaskProjectId != null ? l.alphaMaskProjectId : null,
                        importPlacementPending: !!l.importPlacementPending,
                        importStagingX: l.importStagingX | 0,
                        importStagingY: l.importStagingY | 0,
                        importStagingCanvas: l.importStagingBuffer
                            ? this.cloneCanvas(l.importStagingBuffer)
                            : null,
                        ...this._snapshotDynamicFilterProps(l),
                        buffer: l.buffer ? this.cloneCanvas(l.buffer) : null
                    })),
                    activeLayerIndex: this.activeProject.activeLayerIndex
                };
            }
        } else {
            data = this._snapshotVectorHistoryData(opts);
        }

        if (this.historyIndex >= 0 && data && data.type) {
            const prev = this.history[this.historyIndex];
            if (prev && prev.data && this._vectorHistoryDataEqual(prev.data, data)) {
                prev.name = actionName;
                if (opts.coalesceKey) prev._coalesceKey = opts.coalesceKey;
                this.updateHistoryUI();
                this._scheduleWorkspacePersist();
                return;
            }
        }

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push({
            name: actionName,
            data,
            mode: this.mode,
            docW: this.width,
            docH: this.height,
            _coalesceKey: opts.coalesceKey || null,
            extra: {
                allowOutsideCanvas:
                    this.toolProps && typeof this.toolProps.allowOutsideCanvas === 'boolean'
                        ? !!this.toolProps.allowOutsideCanvas
                        : undefined
            }
        });
        const maxH = this.getHistoryMaxEntries();
        while (this.history.length > maxH) {
            const dropped = this.history.shift();
            if (dropped && dropped.data) this.disposeHistoryEntryData(dropped.data);
        }
        this.historyIndex = this.history.length - 1;
        this.updateHistoryUI();
        this._scheduleWorkspacePersist();
    },

    _workspacePersistTimer: null,
    _scheduleWorkspacePersist() {
        if (
            window.WorkspaceIO &&
            typeof window.WorkspaceIO.shouldScheduleHistoryPersist === 'function' &&
            !window.WorkspaceIO.shouldScheduleHistoryPersist()
        ) {
            return;
        }
        if (this._workspacePersistTimer) clearTimeout(this._workspacePersistTimer);
        this._workspacePersistTimer = setTimeout(() => {
            this._workspacePersistTimer = null;
            if (window.WorkspaceIO && typeof window.WorkspaceIO.persistToLocalStorage === 'function') {
                window.WorkspaceIO.persistToLocalStorage();
            }
        }, 5000);
    },

    _serializeHistoryDataForPayload(data) {
        if (data == null) return null;
        if (typeof data === 'string') return { __hdr: 'str', v: data };
        if (typeof data !== 'object') return null;
        if (data.type === 'vector-full') {
            return { type: 'vector-full', svg: data.svg != null ? data.svg : '' };
        }
        if (data.type === 'vector-layer-patch') {
            return {
                type: 'vector-layer-patch',
                layerId: data.layerId,
                activeLayerIndex: data.activeLayerIndex,
                layerHtml: data.layerHtml != null ? data.layerHtml : '',
                layerMeta: data.layerMeta || null,
                defsHtml: data.defsHtml != null ? data.defsHtml : ''
            };
        }
        if (data.type === 'pixel-patch' && data.patch) {
            const p = data.patch;
            return {
                type: 'pixel-patch',
                layerId: data.layerId,
                activeLayerIndex: data.activeLayerIndex,
                patch: {
                    x: p.x,
                    y: p.y,
                    name: p.name,
                    visible: p.visible,
                    opacity: p.opacity,
                    blendMode: p.blendMode || 'source-over',
                    alphaMaskProjectId: p.alphaMaskProjectId != null ? p.alphaMaskProjectId : null,
                    importPlacementPending: !!p.importPlacementPending,
                    importStagingX: p.importStagingX | 0,
                    importStagingY: p.importStagingY | 0,
                    importStagingDataUrl: p.importStagingCanvas
                        ? p.importStagingCanvas.toDataURL('image/png')
                        : '',
                    ...this._snapshotDynamicFilterProps(p),
                    bufferDataUrl: p.buffer ? p.buffer.toDataURL('image/png') : ''
                }
            };
        }
        if (
            (data.type === 'pixel-full' || data.type === 'pixel-layers') &&
            Array.isArray(data.layers)
        ) {
            return {
                type: data.type === 'pixel-layers' ? 'pixel-layers' : 'pixel-full',
                activeLayerIndex: data.activeLayerIndex,
                layers: data.layers.map((l) => ({
                    id: l.id,
                    name: l.name,
                    visible: l.visible,
                    x: l.x,
                    y: l.y,
                    opacity: l.opacity,
                    blendMode: l.blendMode || 'source-over',
                    alphaMaskProjectId: l.alphaMaskProjectId != null ? l.alphaMaskProjectId : null,
                    ...this._snapshotDynamicFilterProps(l),
                    bufferDataUrl: l.buffer ? l.buffer.toDataURL('image/png') : ''
                }))
            };
        }
        return null;
    },

    async _canvasFromDataUrl(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') {
            throw new Error('dataUrl');
        }
        const heavy = dataUrl.length > 120000;
        if (heavy && typeof window.illuYieldToMain === 'function') {
            await window.illuYieldToMain(2);
        }
        const blob =
            typeof window.illuDataUrlToBlob === 'function'
                ? window.illuDataUrlToBlob(dataUrl)
                : null;
        if (blob && typeof createImageBitmap === 'function') {
            try {
                const bitmap = await createImageBitmap(blob);
                const c = document.createElement('canvas');
                c.width = bitmap.width;
                c.height = bitmap.height;
                c.getContext('2d', { willReadFrequently: true }).drawImage(bitmap, 0, 0);
                if (typeof bitmap.close === 'function') bitmap.close();
                if (heavy && typeof window.illuYieldToMain === 'function') {
                    await window.illuYieldToMain(1);
                }
                return c;
            } catch (e) {
                /* fallback Image */
            }
        }
        if (heavy && typeof window.illuYieldToMain === 'function') {
            await window.illuYieldToMain(1);
        }
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    if (typeof img.decode === 'function') {
                        try {
                            await img.decode();
                        } catch (e2) {
                            /* ignore */
                        }
                    }
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth || img.width;
                    c.height = img.naturalHeight || img.height;
                    c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
                    resolve(c);
                } catch (e3) {
                    reject(e3);
                }
            };
            img.onerror = () => reject(new Error('dataUrl'));
            img.src = dataUrl;
        });
    },

    async _deserializeHistoryDataFromPayload(obj, loadOpts) {
        if (obj == null) return null;
        if (typeof obj === 'object' && obj.__hdr === 'str') return obj.v;
        if (typeof obj !== 'object' || !obj.type) return null;
        if (obj.type === 'vector-full') {
            return { type: 'vector-full', svg: obj.svg != null ? obj.svg : '' };
        }
        if (obj.type === 'vector-layer-patch') {
            return {
                type: 'vector-layer-patch',
                layerId: obj.layerId,
                activeLayerIndex: obj.activeLayerIndex != null ? obj.activeLayerIndex : 0,
                layerHtml: obj.layerHtml != null ? obj.layerHtml : '',
                layerMeta: obj.layerMeta || null,
                defsHtml: obj.defsHtml != null ? obj.defsHtml : ''
            };
        }
        if (obj.type === 'pixel-patch' && obj.patch) {
            const patch = obj.patch;
            let buffer = null;
            if (patch.bufferDataUrl) {
                try {
                    if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);
                    buffer = await this._canvasFromDataUrl(patch.bufferDataUrl);
                } catch (e) {
                    return null;
                }
            }
            let importStagingCanvas = null;
            if (patch.importStagingDataUrl) {
                try {
                    importStagingCanvas = await this._canvasFromDataUrl(patch.importStagingDataUrl);
                } catch (e) {
                    importStagingCanvas = null;
                }
            }
            return {
                type: 'pixel-patch',
                layerId: obj.layerId,
                activeLayerIndex: obj.activeLayerIndex != null ? obj.activeLayerIndex : 0,
                patch: {
                    buffer,
                    x: patch.x,
                    y: patch.y,
                    name: patch.name,
                    visible: patch.visible,
                    opacity: patch.opacity,
                    blendMode: patch.blendMode || 'source-over',
                    alphaMaskProjectId: patch.alphaMaskProjectId != null ? patch.alphaMaskProjectId : null,
                    importPlacementPending: !!patch.importPlacementPending,
                    importStagingX: patch.importStagingX | 0,
                    importStagingY: patch.importStagingY | 0,
                    importStagingCanvas,
                    ...this._snapshotDynamicFilterProps(patch)
                }
            };
        }
        if (obj.type === 'pixel-full' || obj.type === 'pixel-layers') {
            const layers = [];
            const srcLayers = obj.layers || [];
            for (let li = 0; li < srcLayers.length; li++) {
                const s = srcLayers[li];
                if (!s || !s.bufferDataUrl) continue;
                try {
                    if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);
                    const buf = await this._canvasFromDataUrl(s.bufferDataUrl);
                    layers.push({
                        id: s.id,
                        name: s.name,
                        visible: s.visible,
                        x: s.x,
                        y: s.y,
                        opacity: s.opacity,
                        blendMode: s.blendMode || 'source-over',
                        alphaMaskProjectId: s.alphaMaskProjectId != null ? s.alphaMaskProjectId : null,
                        ...this._snapshotDynamicFilterProps(s),
                        buffer: buf
                    });
                } catch (e) {
                    /* skip layer */
                }
            }
            return {
                type: obj.type === 'pixel-layers' ? 'pixel-layers' : 'pixel-full',
                layers,
                activeLayerIndex: obj.activeLayerIndex
            };
        }
        return null;
    },

    async _loadProjectHistoryFromPayload(p, sp, loadOpts) {
        loadOpts = loadOpts || {};
        const entries = sp.historySerialized;
        if (!Array.isArray(entries) || !entries.length) {
            p.history = [];
            p.historyIndex = -1;
            return;
        }
        const out = [];
        const total = entries.length;
        for (let hi = 0; hi < total; hi++) {
            const he = entries[hi];
            if (!he || typeof he.name !== 'string') continue;
            if (loadOpts.loadProgress && total > 2) {
                loadOpts.loadProgress(
                    0.72 + (hi / total) * 0.22,
                    `Historique ${hi + 1}/${total}…`
                );
            }
            if (typeof window.illuYieldToMain === 'function') {
                await window.illuYieldToMain(1);
            }
            const mode = he.mode === 'vector' ? 'vector' : 'pixel';
            const data = await this._deserializeHistoryDataFromPayload(he.data, loadOpts);
            out.push({
                name: he.name,
                mode,
                data,
                docW: he.docW != null ? he.docW : null,
                docH: he.docH != null ? he.docH : null
            });
        }
        p.history = out;
        const hi = sp.historyIndex != null ? sp.historyIndex : out.length - 1;
        p.historyIndex = out.length ? Math.min(Math.max(0, hi), out.length - 1) : -1;
    },

    _syncLinkedAlphaMaskProjectDimensions(docW, docH) {
        const maskIds = new Set();
        this.layers.forEach((l) => {
            if (l.alphaMaskProjectId) maskIds.add(l.alphaMaskProjectId);
        });
        maskIds.forEach((mid) => {
            const mp = this.projects.find((pr) => pr.id === mid);
            if (!mp) return;
            mp.width = docW;
            mp.height = docH;
        });
    },

    _restoreHistoryDocumentDimensions(docW, docH) {
        const p = this.activeProject;
        if (!p || docW == null || docH == null) return false;
        const nw = Math.max(1, docW | 0);
        const nh = Math.max(1, docH | 0);
        if (p.width === nw && p.height === nh) return false;
        p.width = nw;
        p.height = nh;
        this._syncLinkedAlphaMaskProjectDimensions(nw, nh);
        if (typeof this.applyProjectToUI === 'function') this.applyProjectToUI();
        return true;
    },

    /** Fusionne l’image affichée sur le canevas document (après un effet) dans un seul calque pixel. */
    commitMainCanvasToFlatLayers() {
        if (!this.activeProject || !this.isPixelMode) return;
        let w;
        let h;
        let buf;
        if (this._domPixelStackActive) {
            const flat = this.flattenPixelProjectToCanvas(this.activeProject, true);
            w = flat.width;
            h = flat.height;
            buf = document.createElement('canvas');
            buf.width = w;
            buf.height = h;
            buf.getContext('2d', { willReadFrequently: true }).drawImage(flat, 0, 0);
        } else {
            const canvas = document.getElementById('drawing-canvas');
            if (!canvas) return;
            w = canvas.width;
            h = canvas.height;
            buf = document.createElement('canvas');
            buf.width = w;
            buf.height = h;
            buf.getContext('2d', { willReadFrequently: true }).drawImage(canvas, 0, 0);
        }
        const keepName =
            this.layers.length === 1 && this.activeLayer ? this.activeLayer.name : 'Image (effet)';
        const keepId = this.activeLayer ? this.activeLayer.id : Date.now();
        this.activeProject.layers = [
            {
                id: keepId,
                name: keepName,
                visible: true,
                x: 0,
                y: 0,
                opacity: 1,
                blendMode: 'source-over',
                alphaMaskProjectId: null,
                ...this._defaultDynamicFilterLayerProps(),
                buffer: buf
            }
        ];
        this.setActiveLayerIndex(0);
        this.updateLayerUI();
        this.render();
    },

    _inferHistoryDocSizeFromPixelFull(data) {
        if (!data || data.type !== 'pixel-full' || !Array.isArray(data.layers) || !data.layers.length) {
            return null;
        }
        let maxX = 0;
        let maxY = 0;
        data.layers.forEach((s) => {
            if (!s.buffer) return;
            maxX = Math.max(maxX, (s.x | 0) + s.buffer.width);
            maxY = Math.max(maxY, (s.y | 0) + s.buffer.height);
        });
        if (maxX < 1 || maxY < 1) return null;
        return { docW: maxX, docH: maxY };
    },

    applyHistoryEntry() {
        const state = this.history[this.historyIndex];
        if (!state) return;

        this.clearTransientPixelEditState();

        let docW = state.docW;
        let docH = state.docH;
        if (docW == null || docH == null) {
            const inferred = this._inferHistoryDocSizeFromPixelFull(state.data);
            if (inferred) {
                docW = inferred.docW;
                docH = inferred.docH;
            }
        }
        this._restoreHistoryDocumentDimensions(docW, docH);
        
        if (state.mode.startsWith('pixel')) {
            const d = state.data;
            if (d && d.type === 'pixel-patch' && d.patch) {
                let li = this.layers.findIndex((l) => l.id === d.layerId);
                if (li < 0 && d.activeLayerIndex != null && this.layers[d.activeLayerIndex]?.buffer) {
                    li = d.activeLayerIndex;
                }
                if (li >= 0) {
                    const p = d.patch;
                    this.layers[li] = {
                        ...this.layers[li],
                        _dynamicFilterCacheCanvas: null,
                        _dynamicFilterCacheKey: null,
                        _dynAsyncCanvas: null,
                        _dynAsyncKey: null,
                        _dynAsyncPendingKey: null,
                        _alphaAsyncCanvas: null,
                        _alphaAsyncKey: null,
                        _alphaAsyncPendingKey: null,
                        buffer: this.cloneCanvas(p.buffer),
                        x: p.x,
                        y: p.y,
                        name: p.name,
                        visible: p.visible,
                        opacity: p.opacity,
                        blendMode: p.blendMode || 'source-over',
                        alphaMaskProjectId: p.alphaMaskProjectId != null ? p.alphaMaskProjectId : null,
                        importPlacementPending: !!p.importPlacementPending,
                        importStagingX: p.importStagingX | 0,
                        importStagingY: p.importStagingY | 0,
                        importStagingBuffer: p.importStagingCanvas
                            ? this.cloneCanvas(p.importStagingCanvas)
                            : null,
                        ...this._snapshotDynamicFilterProps(p)
                    };
                    this.setActiveLayerIndex(
                        Math.min(Math.max(0, d.activeLayerIndex != null ? d.activeLayerIndex : li), this.layers.length - 1)
                    );
                }
                this.updateLayerUI();
                this.render({ flushUiThumbnails: true, layerIndex: li >= 0 ? li : undefined });
            } else if (
                d &&
                (d.type === 'pixel-full' || d.type === 'pixel-layers') &&
                Array.isArray(d.layers)
            ) {
                const src = d;
                const restored = src.layers
                    .filter((s) => s.buffer)
                    .map((s) => ({
                        id: s.id,
                        name: s.name,
                        visible: s.visible,
                        x: s.x,
                        y: s.y,
                        opacity: s.opacity,
                        blendMode: s.blendMode || 'source-over',
                        alphaMaskProjectId: s.alphaMaskProjectId != null ? s.alphaMaskProjectId : null,
                        importPlacementPending: !!s.importPlacementPending,
                        importStagingX: s.importStagingX | 0,
                        importStagingY: s.importStagingY | 0,
                        importStagingBuffer: s.importStagingCanvas
                            ? this.cloneCanvas(s.importStagingCanvas)
                            : null,
                        ...this._snapshotDynamicFilterProps(s),
                        buffer: this.cloneCanvas(s.buffer)
                    }));
                this.activeProject.layers = restored;
                this.layers.forEach((l) => this._normalizeDynamicFilterProps(l));
                if (this._pixelLayerViewEls) this._pixelLayerViewEls.clear();
                if (this._pixelLayerStagingViewEls) this._pixelLayerStagingViewEls.clear();
                this.setActiveLayerIndex(
                    Math.min(Math.max(0, src.activeLayerIndex || 0), this.layers.length - 1)
                );
                this.updateLayerUI();
                this.render({ flushUiThumbnails: true, uiThumbnailsAllLayers: true });
            } else if (typeof d === 'string') {
            const img = new Image();
            img.onload = () => {
                    const buf = document.createElement('canvas');
                    buf.width = img.width;
                    buf.height = img.height;
                    buf.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
                    this.activeProject.layers = [
                        {
                            id: Date.now(),
                            name: 'Calque',
                            visible: true,
                            x: 0,
                            y: 0,
                            opacity: 1,
                            blendMode: 'source-over',
                            alphaMaskProjectId: null,
                            ...this._defaultDynamicFilterLayerProps(),
                            buffer: buf
                        }
                    ];
                    this.setActiveLayerIndex(0);
                    this.updateLayerUI();
                    this.render({ flushUiThumbnails: true });
                };
                img.src = d;
        } else {
                this.updateLayerUI();
                this.render({ flushUiThumbnails: true, uiThumbnailsAllLayers: true });
            }
        } else {
            const d = state.data;
            if (d && d.type === 'vector-layer-patch') {
                this._applyVectorLayerPatchHistory(d);
            } else {
                let html = '';
                if (typeof d === 'string') html = d;
                else if (d && d.type === 'vector-full') html = d.svg || '';
                const sl = document.getElementById('svg-layers');
                if (html && sl) sl.innerHTML = html;
            }
            if (typeof this.syncActiveVectorSvg === 'function') this.syncActiveVectorSvg();
            this.render({ skipUiThumbnails: true });
        }

        // Restore UI-level options that must be undo/redo aware.
        if (
            state.extra &&
            state.extra.allowOutsideCanvas !== undefined &&
            this.toolProps &&
            typeof state.extra.allowOutsideCanvas === 'boolean'
        ) {
            this.toolProps.allowOutsideCanvas = state.extra.allowOutsideCanvas;
            try {
                localStorage.setItem('illu_allow_outside_canvas', state.extra.allowOutsideCanvas ? '1' : '0');
            } catch (e) {
                /* ignore */
            }
            if (typeof window.syncIlluAllowOutsideCanvasUI === 'function') {
                window.syncIlluAllowOutsideCanvasUI();
            }
        }
        this.updateHistoryUI();
    },

    doHistory(dir) {
        const next = this.historyIndex + dir;
        if (next < 0 || next >= this.history.length) return;
        this.historyIndex = next;
        this.applyHistoryEntry();
    },

    jumpHistoryTo(index) {
        if (index < 0 || index >= this.history.length) return;
        this.historyIndex = index;
        this.applyHistoryEntry();
    },

    updateHistoryUI() {
        const list = document.getElementById('history-list');
        if (!list) return;
        list.innerHTML = '';
        this.history.forEach((h, i) => {
            const item = document.createElement('div');
            item.className = `list-item ${i === this.historyIndex ? 'active' : ''}`;
            item.innerText = h.name;
            item.onclick = () => this.jumpHistoryTo(i);
            list.appendChild(item);
        });
    },

    /** Calques pixel à sérialiser (onglet actif = layers ; autres = snapshot gelé). */
    getPixelLayersForPersist(p) {
        if (!p || !p.mode.startsWith('pixel')) return [];
        if (p.pixelSnapshot && p.pixelSnapshot.layers && p.pixelSnapshot.layers.length) {
            return p.pixelSnapshot.layers
                .filter((s) => s.bufferCanvas)
                .map((s) => ({
                    id: s.id,
                    name: s.name,
                    visible: s.visible,
                    x: s.x,
                    y: s.y,
                    opacity: s.opacity,
                    blendMode: s.blendMode || 'source-over',
                    alphaMaskProjectId: s.alphaMaskProjectId != null ? s.alphaMaskProjectId : null,
                    ...this._snapshotDynamicFilterProps(s),
                    buffer: s.bufferCanvas
                }));
        }
        return (p.layers || [])
            .filter((l) => l.buffer)
            .map((l) => ({
                id: l.id,
                name: l.name,
                visible: l.visible,
                x: l.x,
                y: l.y,
                opacity: l.opacity,
                blendMode: l.blendMode || 'source-over',
                alphaMaskProjectId: l.alphaMaskProjectId != null ? l.alphaMaskProjectId : null,
                ...this._snapshotDynamicFilterProps(l),
                buffer: l.buffer
            }));
    },

    syncActiveVectorSvg() {
        const p = this.activeProject;
        if (p && p.mode === 'vector') {
            const el = document.getElementById('svg-layers');
            if (el) p.svgData = el.innerHTML;
            if (p.illuSpriteSheet) {
                const defsHost = document.getElementById('vector-doc-defs');
                if (defsHost) p.illuSpriteDefsData = defsHost.innerHTML;
            }
        }
    },

    /** Met à jour les miniatures d’onglets SVG à partir de chaque projet.svgData (pas le DOM actif). */
    refreshVectorProjectTabThumbnails() {
        const bar = document.getElementById('tab-bar');
        if (!bar || !this.projects) return;
        this.projects.forEach((proj, i) => {
            if (!proj || proj.mode !== 'vector') return;
            const tab = bar.querySelector(`[data-project-index="${i}"]`);
            const img = tab && tab.querySelector('img.tab-thumb');
            if (!img) return;
            this._getVectorProjectThumbnailDataUrl(proj).then((u) => {
                if (u) img.src = u;
            }).catch(() => {});
        });
    },

    /**
     * SVG autonome pour navigateur / autres outils : en-tête XML, xmlns, sans UI éditeur (#svg-ui).
     */
    getStandaloneSvgMarkup() {
        this.syncActiveVectorSvg();
        if (
            this.activeProject &&
            this.activeProject.illuSpriteSheet &&
            typeof window.illuExportSpriteSheetMarkup === 'function'
        ) {
            return window.illuExportSpriteSheetMarkup();
        }
        const svg = document.getElementById('drawing-svg');
        if (!svg) return '';
        const clone = svg.cloneNode(true);
        clone.removeAttribute('style');
        clone.removeAttribute('id');
        const ui = clone.querySelector('#svg-ui');
        if (ui) ui.remove();
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        const W = Math.max(1, this.width || window.ILLU_DEFAULT_DOC_WIDTH || 1280);
        const H = Math.max(1, this.height || window.ILLU_DEFAULT_DOC_HEIGHT || 720);
        clone.setAttribute('width', String(W));
        clone.setAttribute('height', String(H));
        clone.setAttribute('viewBox', `0 0 ${W} ${H}`);
        const defsEl = clone.querySelector('defs');
        if (defsEl) defsEl.removeAttribute('id');
        try {
            return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
        } catch (e) {
            console.warn('getStandaloneSvgMarkup', e);
            return '';
        }
    },

    /**
     * Rasterise le document vecteur actif en canvas bitmap (export PNG haute résolution).
     * @param {number} scale Facteur d’échelle (1 = taille document, 4 = 4× en pixels).
     * @returns {Promise<HTMLCanvasElement>}
     */
    flattenActiveVectorDocument(scale) {
        this.syncActiveVectorSvg();
        const svgData = this.getStandaloneSvgMarkup();
        const w = Math.max(1, this.width | 0);
        const h = Math.max(1, this.height | 0);
        const s = Math.max(1, Math.min(16, Number(scale) || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * s);
        canvas.height = Math.round(h * s);

        if (!svgData || !svgData.includes('<svg')) {
            return Promise.resolve(canvas);
        }

        return new Promise((resolve) => {
            const img = new Image();
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            img.onload = () => {
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(
                        img,
                        0,
                        0,
                        img.naturalWidth || w,
                        img.naturalHeight || h,
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );
                }
                URL.revokeObjectURL(url);
                resolve(canvas);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(canvas);
            };
            img.src = url;
        });
    },

    importSvgFromFileContent(text, filename, importOpts) {
        importOpts = importOpts || {};
        const layerMode = importOpts.layerMode || 'split';
        const target = importOpts.target === 'current' ? 'current' : 'new';

        if (layerMode === 'sprite') {
            try {
                this._importSvgSpriteLibrary(text, filename);
                return;
            } catch (spriteErr) {
                console.error('importSvgFromFileContent (sprite)', spriteErr);
                if (typeof window.showIlluAlert === 'function') {
                    window.showIlluAlert(
                        spriteErr && spriteErr.message
                            ? `Feuille sprite : ${spriteErr.message}`
                            : 'Impossible d’ouvrir ce fichier en grille sprite.'
                    );
                }
                return;
            }
        }

        const injectOpts = { layerMode: layerMode === 'single' ? 'single' : 'split' };

        if (target === 'current') {
            if (this.isPixelMode || !this.activeProject || this.activeProject.mode !== 'vector') {
                if (typeof window.showIlluAlert === 'function') {
                    window.showIlluAlert(
                        'Import sur le projet en cours : passez en mode vecteur avec un projet actif, ou choisissez « Nouveau projet ».'
                    );
                }
                return;
            }
            this._importSvgIntoActiveVectorProject(text, injectOpts);
            return;
        }

        this._importSvgAsNewVectorProject(text, filename, injectOpts);
    },

    /**
     * Fichier type illu-sprite.svg : feuille vectorielle (grille / cellules), réexportable en symboles.
     */
    _importSvgSpriteLibrary(text, filename) {
        if (typeof window.illuBuildSpriteSheetFromSvgRoot !== 'function') {
            throw new Error('Éditeur sprite indisponible (illu-sprite-editor.js).');
        }
        const parsed = this._parseSvgFileToStructure(text);
        if (typeof window.illuFlattenSpriteSvg === 'function') {
            window.illuFlattenSpriteSvg(parsed.svgRoot);
        }
        const sheet = window.illuBuildSpriteSheetFromSvgRoot(parsed.svgRoot);
        const baseName = String(filename || 'illu-sprite')
            .replace(/\.[^.]+$/i, '')
            .replace(/[/\\?%*:|"<>]/g, '-')
            .trim() || 'illu-sprite';

        const project = {
            id: Date.now(),
            name: baseName,
            mode: 'vector',
            width: sheet.width,
            height: sheet.height,
            layers: [],
            activeLayerIndex: 0,
            history: [],
            historyIndex: -1,
            zoomLevel: 1,
            canvasPanX: 0,
            canvasPanY: 0,
            canvasData: null,
            svgData: '',
            role: 'main',
            parentProjectId: null,
            parentLayerId: null,
            illuSpriteSheet: true,
            illuSpriteSourceName: filename || 'illu-sprite.svg',
            illuSpriteDefsData: ''
        };

        this.projects.push(project);
        this.activeProjectIndex = this.projects.length - 1;

        const defsHost = document.getElementById('vector-doc-defs');
        const layersRoot = document.getElementById('svg-layers');
        if (defsHost) defsHost.innerHTML = '';
        if (layersRoot) layersRoot.innerHTML = '';

        if (defsHost) {
            sheet.defsNodes.forEach((n) => defsHost.appendChild(document.importNode(n, true)));
            project.illuSpriteDefsData = defsHost.innerHTML;
        }

        const layerId = Date.now() + 1;
        project.layers.push({
            id: layerId,
            name: 'Icônes (sprite)',
            visible: true,
            x: 0,
            y: 0,
            opacity: 1,
            blendMode: 'source-over',
            buffer: null
        });

        const NS = 'http://www.w3.org/2000/svg';
        const layerG = document.createElementNS(NS, 'g');
        layerG.setAttribute('id', `layer-${layerId}`);
        layerG.setAttribute('data-illu-sprite-sheet', '1');
        if (sheet.sheetChrome) {
            layerG.appendChild(document.importNode(sheet.sheetChrome, true));
        }
        sheet.cells.forEach((cell) => {
            layerG.appendChild(document.importNode(cell, true));
        });
        if (layersRoot) layersRoot.appendChild(layerG);

        this.syncActiveVectorSvg();
        this.saveHistory('Ouvrir sprite (grille)');
        this.updateTabUI();
        this.applyProjectToUI();

        if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
            window.scheduleFitActiveProjectZoomOnDocumentOpen(this);
        }

        if (typeof window.showIlluAlert === 'function') {
            window.showIlluAlert(
                `Feuille sprite « ${baseName} » : ${sheet.symbolCount} icônes. Modifiez le nom au-dessus de chaque icône (texte), l’icône, puis exportez en SVG.`
            );
        }
    },

    _importSvgAsNewVectorProject(text, filename, importOpts) {
        importOpts = importOpts || {};
        const parsed = this._parseSvgFileToStructure(text);
        const baseName = String(filename || 'import')
            .replace(/\.[^.]+$/i, '')
            .replace(/[/\\?%*:|"<>]/g, '-')
            .trim() || 'SVG importé';
        const project = {
            id: Date.now(),
            name: baseName,
            mode: 'vector',
            width: parsed.w,
            height: parsed.h,
            layers: [],
            activeLayerIndex: 0,
            history: [],
            historyIndex: -1,
            zoomLevel: 1,
            canvasPanX: 0,
            canvasPanY: 0,
            canvasData: null,
            svgData: '',
            role: 'main',
            parentProjectId: null,
            parentLayerId: null
        };
        this.projects.push(project);
        this.activeProjectIndex = this.projects.length - 1;
        const defsHost = document.getElementById('vector-doc-defs');
        const layersRoot = document.getElementById('svg-layers');
        if (defsHost) defsHost.innerHTML = '';
        if (layersRoot) layersRoot.innerHTML = '';
        this._injectParsedSvgIntoWorkspace(parsed, {
            append: false,
            layerMode: importOpts.layerMode === 'single' ? 'single' : 'split'
        });
        this.syncActiveVectorSvg();
        this.saveHistory('Import SVG');
        this.updateTabUI();
        this.applyProjectToUI();
    },

    _importSvgIntoActiveVectorProject(text, importOpts) {
        importOpts = importOpts || {};
        const parsed = this._parseSvgFileToStructure(text);
        this._injectParsedSvgIntoWorkspace(parsed, {
            append: true,
            layerMode: importOpts.layerMode === 'single' ? 'single' : 'split'
        });
        this.syncActiveVectorSvg();
        this.saveHistory('Import SVG');
        this.applyProjectToUI();
    },

    _parseSvgFileToStructure(text) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const pe = doc.querySelector('parsererror');
        if (pe) throw new Error('Fichier SVG / XML invalide (analyse impossible).');
        const svgRoot = doc.querySelector('svg');
        if (!svgRoot) throw new Error('Aucun élément <svg> à la racine.');
        let w = window.ILLU_DEFAULT_DOC_WIDTH || 1280;
        let h = window.ILLU_DEFAULT_DOC_HEIGHT || 720;
        let viewMinX = 0;
        let viewMinY = 0;
        let hadViewBox = false;
        const vb = svgRoot.getAttribute('viewBox');
        if (vb) {
            const p = vb
                .trim()
                .split(/[\s,]+/)
                .map(parseFloat)
                .filter((n) => !Number.isNaN(n));
            if (p.length === 4 && p[2] > 0 && p[3] > 0) {
                hadViewBox = true;
                viewMinX = p[0];
                viewMinY = p[1];
                w = Math.round(p[2]);
                h = Math.round(p[3]);
            }
        }
        if (!hadViewBox) {
            const sw = parseFloat(String(svgRoot.getAttribute('width') || '').replace(/px$/i, ''));
            const sh = parseFloat(String(svgRoot.getAttribute('height') || '').replace(/px$/i, ''));
            if (sw > 0 && sh > 0) {
                w = Math.round(sw);
                h = Math.round(sh);
            }
        }
        const content = this._svgCollectRootContent(svgRoot);
        return {
            svgRoot,
            w: Math.max(1, w),
            h: Math.max(1, h),
            content,
            viewMinX,
            viewMinY
        };
    },

    _svgLocalTag(el) {
        if (!el) return '';
        if (el.localName) return String(el.localName).toLowerCase();
        const t = (el.tagName || '').toLowerCase();
        return t.includes(':') ? t.split(':').pop() : t;
    },

    /**
     * Enfants directs de <svg> exploitables (hors defs/metadata…) ; déroule <a> et <switch>.
     */
    _svgCollectRootContent(svgRoot) {
        const skip = new Set(['defs', 'title', 'desc', 'metadata', 'script', 'namedview', 'filter', 'clippath', 'mask']);
        const unwrap = new Set(['a', 'switch']);
        const out = [];
        const children = svgRoot.children;
        for (let i = 0; i < children.length; i++) {
            const c = children[i];
            const t = this._svgLocalTag(c);
            if (skip.has(t) || t === 'style') continue;
            if (unwrap.has(t)) {
                for (let j = 0; j < c.children.length; j++) out.push(c.children[j]);
            } else {
                out.push(c);
            }
        }
        return out;
    },

    _injectParsedSvgIntoWorkspace(parsed, opts) {
        const append = opts && opts.append;
        const singleLayer = opts && opts.layerMode === 'single';
        const defsTarget = document.getElementById('vector-doc-defs');
        const srcDefs = parsed.svgRoot.querySelector('defs');
        if (srcDefs && defsTarget) {
            [...srcDefs.children].forEach((n) => {
                defsTarget.appendChild(document.importNode(n, true));
            });
        }
        const layersRoot = document.getElementById('svg-layers');
        const NS = 'http://www.w3.org/2000/svg';
        if (!layersRoot) return;

        const buildImportHolder = () => {
            const holder = document.createElementNS(NS, 'g');
            holder.setAttribute('data-illu-svg-import', '1');
            const vmxA = parsed.viewMinX != null ? parsed.viewMinX : 0;
            const vmyA = parsed.viewMinY != null ? parsed.viewMinY : 0;
            if (Math.abs(vmxA) > 1e-9 || Math.abs(vmyA) > 1e-9) {
                holder.setAttribute('transform', `translate(${-vmxA},${-vmyA})`);
            }
            parsed.content.forEach((node) => {
                const tag = this._svgLocalTag(node);
                if (tag === 'g' && parsed.content.length === 1) {
                    [...node.children].forEach((ch) => holder.appendChild(document.importNode(ch, true)));
                } else {
                    holder.appendChild(document.importNode(node, true));
                }
            });
            return holder;
        };

        if (append && !singleLayer) {
            const planned = this._planSvgImportLayers(parsed);
            const vmxA = parsed.viewMinX != null ? parsed.viewMinX : 0;
            const vmyA = parsed.viewMinY != null ? parsed.viewMinY : 0;
            const needVb = Math.abs(vmxA) > 1e-9 || Math.abs(vmyA) > 1e-9;
            planned.forEach((slot, idx) => {
                const id = Date.now() + idx + 1;
                this.activeProject.layers.push({
                    id,
                    name: slot.name,
                    visible: slot.visible,
                    x: slot.x,
                    y: slot.y,
                    opacity: slot.opacity,
                    blendMode: 'source-over',
                    buffer: null
                });
                const ng = document.createElementNS(NS, 'g');
                ng.setAttribute('id', `layer-${id}`);
                if (needVb) {
                    const wrap = document.createElementNS(NS, 'g');
                    wrap.setAttribute('transform', `translate(${-vmxA},${-vmyA})`);
                    slot.fragments.forEach((frag) => wrap.appendChild(frag));
                    ng.appendChild(wrap);
                } else {
                    slot.fragments.forEach((frag) => ng.appendChild(frag));
                }
                layersRoot.appendChild(ng);
            });
            this.setActiveLayerIndex(this.activeProject.layers.length - 1);
            if (this.expandActiveProjectToVectorContentBounds(24)) {
                this._applyVectorCanvasDimensionsOnly();
            }
            return;
        }

        if (append) {
            const al = this.activeLayer;
            if (!al) return;
            const g = document.getElementById(`layer-${al.id}`);
            if (!g) return;
            g.appendChild(buildImportHolder());
            if (this.expandActiveProjectToVectorContentBounds(24)) {
                this._applyVectorCanvasDimensionsOnly();
            }
            return;
        }

        const planned = singleLayer ? this._planSvgImportSingleLayer(parsed) : this._planSvgImportLayers(parsed);
        planned.forEach((slot, idx) => {
            const id = Date.now() + idx;
            this.activeProject.layers.push({
                id,
                name: slot.name,
                visible: slot.visible,
                x: slot.x,
                y: slot.y,
                opacity: slot.opacity,
                blendMode: 'source-over',
                buffer: null
            });
            const ng = document.createElementNS(NS, 'g');
            ng.setAttribute('id', `layer-${id}`);
            slot.fragments.forEach((frag) => ng.appendChild(frag));
            layersRoot.appendChild(ng);
        });
        const vmx = parsed.viewMinX != null ? parsed.viewMinX : 0;
        const vmy = parsed.viewMinY != null ? parsed.viewMinY : 0;
        if (Math.abs(vmx) > 1e-9 || Math.abs(vmy) > 1e-9) {
            const nrm = document.createElementNS(NS, 'g');
            nrm.setAttribute('id', 'illu-import-viewbox-root');
            nrm.setAttribute('transform', `translate(${-vmx},${-vmy})`);
            while (layersRoot.firstChild) {
                nrm.appendChild(layersRoot.firstChild);
            }
            layersRoot.appendChild(nrm);
        }
        this.setActiveLayerIndex(0);
        const layersRootFin = document.getElementById('svg-layers');
        if (layersRootFin) this._enrichSvgImportTree(layersRootFin);
        if (this.expandActiveProjectToVectorContentBounds(24)) {
            this._applyVectorCanvasDimensionsOnly();
        }
    },

    _svgFillIsNone(el) {
        const f = (el.getAttribute && el.getAttribute('fill')) || '';
        const s = String(f).trim().toLowerCase();
        return !s || s === 'none' || s === 'transparent';
    },

    _svgNodeIsStrokeOnly(el) {
        const tag = this._svgLocalTag(el);
        if (!['path', 'line', 'polyline'].includes(tag)) return false;
        if (!this._svgFillIsNone(el)) return false;
        const st = el.getAttribute && el.getAttribute('stroke');
        return !!(st && String(st).trim().toLowerCase() !== 'none');
    },

    _svgPathDKey(d) {
        const seg =
            typeof window.illuParseSimpleLineSegmentD === 'function'
                ? window.illuParseSimpleLineSegmentD(d)
                : null;
        if (seg) return `L|${seg.x1}|${seg.y1}|${seg.x2}|${seg.y2}`;
        return String(d || '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
    },

    _svgPathsSameSegment(a, b) {
        const da = a.getAttribute && a.getAttribute('d');
        const db = b.getAttribute && b.getAttribute('d');
        if (!da || !db) return false;
        return this._svgPathDKey(da) === this._svgPathDKey(db);
    },

    _svgPathSubpathCount(d) {
        const s = String(d || '').trim();
        if (!s) return 0;
        return (s.match(/M/gi) || []).length;
    },

    _svgSplitMultiSubpathPath(pathEl) {
        const d = pathEl.getAttribute('d') || '';
        const chunks = d
            .trim()
            .split(/(?=M)/i)
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
        if (chunks.length <= 1) return pathEl;
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('data-illu-import-compound', String(chunks.length));
        g.setAttribute('data-illu-import-group', 'compound');
        chunks.forEach((part, idx) => {
            const p = document.createElementNS(NS, 'path');
            ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'transform'].forEach(
                (attr) => {
                    const v = pathEl.getAttribute(attr);
                    if (v != null) p.setAttribute(attr, v);
                }
            );
            p.setAttribute('d', part);
            if (!this._svgFillIsNone(pathEl) && idx > 0) {
                /* sous-tracés remplis : conserver le fill du path d’origine */
            }
            this._svgAnnotateImportedNode(p);
            g.appendChild(p);
        });
        return g;
    },

    _svgAnnotateImportedNode(el) {
        if (!el || el.nodeType !== 1) return;
        const tag = this._svgLocalTag(el);
        if (tag === 'path' || tag === 'line' || tag === 'polyline') {
            if (this._svgNodeIsStrokeOnly(el)) {
                el.setAttribute('data-illu-stroke-only', '1');
                const d = el.getAttribute('d') || '';
                const seg =
                    typeof window.illuParseSimpleLineSegmentD === 'function'
                        ? window.illuParseSimpleLineSegmentD(d)
                        : null;
                if (seg && typeof window.formatIlluStraightLinePath === 'function') {
                    el.setAttribute('d', window.formatIlluStraightLinePath(seg.x1, seg.y1, seg.x2, seg.y2));
                    el.setAttribute('data-illu-line-straight', '1');
                }
            } else if (tag === 'path' && !this._svgFillIsNone(el)) {
                const sub = this._svgPathSubpathCount(el.getAttribute('d') || '');
                if (sub > 1) el.setAttribute('data-illu-import-subpaths', String(sub));
            }
        }
    },

    _svgWrapStrokeStacks(parent) {
        if (!parent || !parent.children) return;
        if (parent.getAttribute && parent.getAttribute('data-illu-import-group') === 'stroke-stack') return;
        const NS = 'http://www.w3.org/2000/svg';
        let node = parent.firstElementChild;
        while (node) {
            const next = node.nextElementSibling;
            if (this._svgNodeIsStrokeOnly(node)) {
                const batch = [node];
                let scan = next;
                while (scan && this._svgNodeIsStrokeOnly(scan) && this._svgPathsSameSegment(node, scan)) {
                    batch.push(scan);
                    scan = scan.nextElementSibling;
                }
                if (batch.length >= 2) {
                    const g = document.createElementNS(NS, 'g');
                    g.setAttribute('data-illu-import-group', 'stroke-stack');
                    g.setAttribute('data-illu-stroke-stack', String(batch.length));
                    parent.insertBefore(g, batch[0]);
                    batch.forEach((b) => g.appendChild(b));
                    node = g.nextElementSibling;
                    continue;
                }
            }
            node = next;
        }
    },

    /** Analyse sémantique post-import : traits empilés, formes composées, métadonnées traits. */
    _enrichSvgImportTree(root) {
        if (!root || root.nodeType !== 1) return;
        if (root.getAttribute && root.getAttribute('data-illu-import-enriched') === '1') return;
        root.setAttribute('data-illu-import-enriched', '1');
        [...root.children].forEach((ch) => this._enrichSvgImportTree(ch));
        this._svgWrapStrokeStacks(root);
        const kids = [...root.children];
        kids.forEach((ch) => {
            const tag = this._svgLocalTag(ch);
            if (tag === 'path') {
                const rep = this._svgSplitMultiSubpathPath(ch);
                if (rep !== ch && ch.parentElement) ch.parentElement.replaceChild(rep, ch);
                else this._svgAnnotateImportedNode(ch);
            } else if (tag === 'g' && ch.getAttribute('data-illu-import-compound')) {
                [...ch.children].forEach((p) => this._svgAnnotateImportedNode(p));
            } else {
                this._svgAnnotateImportedNode(ch);
            }
        });
    },

    /** Nom d’affichage pour un nœud SVG importé. */
    _svgImportLabelForNode(node, index) {
        const tid = node.getAttribute && node.getAttribute('id');
        if (tid && tid.trim()) return tid.trim().slice(0, 48);
        const ig = node.getAttribute && node.getAttribute('data-illu-import-group');
        if (ig === 'stroke-stack') {
            const n = node.getAttribute('data-illu-stroke-stack') || '';
            return n ? `Traits empilés (×${n})` : 'Traits empilés';
        }
        if (ig === 'compound') {
            const n = node.getAttribute('data-illu-import-compound') || '';
            return n ? `Formes groupées (×${n})` : 'Formes groupées';
        }
        if (node.getAttribute && node.getAttribute('data-illu-stroke-only') === '1') return `Trait ${index + 1}`;
        const sub = node.getAttribute && node.getAttribute('data-illu-import-subpaths');
        if (sub && parseInt(sub, 10) > 1) return `Forme composite (×${sub})`;
        const tag = this._svgLocalTag(node) || 'el';
        return `${tag} ${index + 1}`;
    },

    /** Un seul calque contenant tout le contenu racine (avec correction viewBox). */
    _planSvgImportSingleLayer(parsed) {
        const NS = 'http://www.w3.org/2000/svg';
        const ngInner = document.createElementNS(NS, 'g');
        ngInner.setAttribute('data-illu-svg-import', '1');
        const vmx = parsed.viewMinX != null ? parsed.viewMinX : 0;
        const vmy = parsed.viewMinY != null ? parsed.viewMinY : 0;
        if (Math.abs(vmx) > 1e-9 || Math.abs(vmy) > 1e-9) {
            ngInner.setAttribute('transform', `translate(${-vmx},${-vmy})`);
        }
        parsed.content.forEach((node) => {
            const tag = this._svgLocalTag(node);
            if (tag === 'g' && parsed.content.length === 1) {
                [...node.children].forEach((ch) => ngInner.appendChild(document.importNode(ch, true)));
            } else {
                ngInner.appendChild(document.importNode(node, true));
            }
        });
        this._enrichSvgImportTree(ngInner);
        return [
            {
                name: 'SVG importé',
                visible: true,
                x: 0,
                y: 0,
                opacity: 1,
                fragments: [ngInner]
            }
        ];
    },

    /**
     * Prépare une liste de calques à partir du contenu racine du SVG.
     * Préserve les defs déjà fusionnées ; couleurs / url(#…) / paths restent dans le DOM cloné.
     */
    _planSvgImportLayers(parsed) {
        const NS = 'http://www.w3.org/2000/svg';
        const content = parsed.content;
        const groups = content.filter((n) => this._svgLocalTag(n) === 'g');
        const maxSplit = 80;

        const layerFromGroup = (gEl, idx, baseName) => {
            const visible = gEl.getAttribute('display') !== 'none';
            let opacity = 1;
            const oa = gEl.getAttribute('opacity');
            if (oa != null && oa !== '') opacity = parseFloat(oa) || 1;
            const frag = document.importNode(gEl, true);
            this._enrichSvgImportTree(frag);
            return {
                name: baseName || `Calque ${idx + 1}`,
                visible,
                x: 0,
                y: 0,
                opacity,
                fragments: [frag]
            };
        };

        const layerFromNodes = (nodes, nameFn) =>
            nodes.map((node, idx) => {
                const visible = node.getAttribute('display') !== 'none';
                let opacity = 1;
                const oa = node.getAttribute('opacity');
                if (oa != null && oa !== '') opacity = parseFloat(oa) || 1;
                const inner = document.importNode(node, true);
                this._enrichSvgImportTree(inner);
                return {
                    name: nameFn(node, idx),
                    visible,
                    x: 0,
                    y: 0,
                    opacity,
                    fragments: [inner]
                };
            });

        const allRootAreGroups = content.length > 0 && content.every((n) => this._svgLocalTag(n) === 'g');

        /* Plusieurs <g> racine (et rien d’autre) : un calque par groupe. */
        if (allRootAreGroups && groups.length > 1) {
            return groups.map((gEl, idx) => layerFromGroup(gEl, idx, `Calque ${idx + 1}`));
        }

        /* Plusieurs nœuds racine hétérogènes (path + g + rect…) : un calque par nœud. */
        if (content.length > 1) {
            return layerFromNodes(content, (node, idx) => this._svgImportLabelForNode(node, idx));
        }

        /* Un seul <g> : optionnellement découper chaque enfant direct en calque (formes complexes conservées telles quelles). */
        if (content.length === 1) {
            const root = content[0];
            const rt = this._svgLocalTag(root);
            if (rt === 'g') {
                const kids = [...root.children];
                if (kids.length > 1 && kids.length <= maxSplit) {
                    const pTr = root.getAttribute('transform') || '';
                    const pOp = root.getAttribute('opacity');
                    const pDisp = root.getAttribute('display');
                    return kids.map((ch, idx) => {
                        const wrap = document.createElementNS(NS, 'g');
                        if (pTr) wrap.setAttribute('transform', pTr);
                        if (pOp != null && pOp !== '') wrap.setAttribute('opacity', pOp);
                        if (pDisp) wrap.setAttribute('display', pDisp);
                        const imported = document.importNode(ch, true);
                        this._enrichSvgImportTree(imported);
                        wrap.appendChild(imported);
                        const visible = ch.getAttribute('display') !== 'none' && pDisp !== 'none';
                        let opacity = 1;
                        const oa = ch.getAttribute('opacity');
                        if (oa != null && oa !== '') opacity = parseFloat(oa) || 1;
                        else if (pOp != null && pOp !== '') opacity = parseFloat(pOp) || 1;
                        return {
                            name: this._svgImportLabelForNode(ch, idx),
                            visible,
                            x: 0,
                            y: 0,
                            opacity,
                            fragments: [wrap]
                        };
                    });
                }
            }
        }

        /* Un seul calque : tout le contenu racine. */
        const ngInner = document.createElementNS(NS, 'g');
        content.forEach((node) => {
            const tag = this._svgLocalTag(node);
            if (tag === 'g' && content.length === 1) {
                [...node.children].forEach((ch) => ngInner.appendChild(document.importNode(ch, true)));
            } else {
                ngInner.appendChild(document.importNode(node, true));
            }
        });
        return [
            {
                name: 'Calque 1',
                visible: true,
                x: 0,
                y: 0,
                opacity: 1,
                fragments: [ngInner]
            }
        ];
    },

    serializeWorkspacePayload(projectsToSerialize = null, options = {}) {
        this.syncActiveVectorSvg();
        const activeIndex = this.activeProjectIndex;
        const includeHistory = options.includeHistory !== false;
        
        // Define which projects to process
        const sourceProjects = projectsToSerialize || this.projects;
        
        const projects = sourceProjects.map((p, idx) => {
            const isVec = p.mode === 'vector';
            let svgData = p.svgData || '';
            
            // If we are mapping from the global list, we check idx === activeIndex.
            // But if we have a subset, we need to know if it's the active one.
            const isCurrentlyActiveInApp = (p === this.activeProject);

            if (isVec && isCurrentlyActiveInApp) {
                const el = document.getElementById('svg-layers');
                if (el) svgData = el.innerHTML;
            }
            const base = {
                id: p.id,
                name: p.name,
                mode: p.mode,
                width: p.width,
                height: p.height,
                ditherEffectSize: p.ditherEffectSize,
                ditherInvert: p.ditherInvert || false,
                zoomLevel: p.zoomLevel ?? 1,
                canvasPanX: p.canvasPanX != null ? p.canvasPanX : 0,
                canvasPanY: p.canvasPanY != null ? p.canvasPanY : 0,
                activeLayerIndex: p.activeLayerIndex ?? 0,
                svgData: isVec ? svgData : '',
                pixelLayers: [],
                vectorLayers: [],
                role: p.role || 'main',
                parentProjectId: p.parentProjectId != null ? p.parentProjectId : null,
                parentLayerId: p.parentLayerId != null ? p.parentLayerId : null,
                autoSaveLocal: p.autoSaveLocal === true,
                illuSpriteSheet: p.illuSpriteSheet === true,
                illuSpriteSourceName: p.illuSpriteSourceName || null,
                illuSpriteDefsData: p.illuSpriteDefsData || ''
            };
            if (p.role === 'layerAlphaMask') {
                base.alphaMaskUiHidden = p.alphaMaskUiHidden === true;
            }
            if (isVec) {
                base.vectorLayers = (p.layers || []).map((l) => ({
                    id: l.id,
                    name: l.name,
                    visible: l.visible,
                    x: l.x,
                    y: l.y,
                    opacity: l.opacity != null ? l.opacity : 1,
                    blendMode: l.blendMode || 'source-over'
                }));
                base.historyIndex = p.historyIndex != null ? p.historyIndex : -1;
                base.historySerialized = (includeHistory && Array.isArray(p.history))
                    ? p.history.map((h) => ({
                          name: h.name,
                          mode: h.mode,
                          data: this._serializeHistoryDataForPayload(h.data),
                          docW: h.docW != null ? h.docW : null,
                          docH: h.docH != null ? h.docH : null
                      }))
                    : [];
            } else {
                const src = this.getPixelLayersForPersist(p);
                base.pixelLayers = src.map((l) => ({
                    id: l.id,
                    name: l.name,
                    visible: l.visible,
                    x: l.x,
                    y: l.y,
                    opacity: l.opacity != null ? l.opacity : 1,
                    blendMode: l.blendMode || 'source-over',
                    alphaMaskProjectId: l.alphaMaskProjectId != null ? l.alphaMaskProjectId : null,
                    ...this._snapshotDynamicFilterProps(l),
                    dataUrl: l.buffer ? l.buffer.toDataURL('image/png') : ''
                }));
                base.historyIndex = p.historyIndex != null ? p.historyIndex : -1;
                base.historySerialized = (includeHistory && Array.isArray(p.history))
                    ? p.history.map((h) => ({
                          name: h.name,
                          mode: h.mode,
                          data: this._serializeHistoryDataForPayload(h.data),
                          docW: h.docW != null ? h.docW : null,
                          docH: h.docH != null ? h.docH : null
                      }))
                    : [];
            }
            return base;
        });

        // Handle active project index in the serialized payload
        let targetActiveIndex = 0;
        if (!projectsToSerialize) {
            targetActiveIndex = activeIndex;
        } else {
            // Find which of the serialized projects is the active one, if any
            const foundIdx = sourceProjects.findIndex(p => p === this.activeProject);
            targetActiveIndex = foundIdx >= 0 ? foundIdx : 0;
        }

        return {
            format: 'illu-workspace',
            version: 3,
            activeProjectIndex: targetActiveIndex,
            projects
        };
    },

    _parseVectorLayersFromSvgContent(html) {
        if (!html || typeof html !== 'string') return [];
        const wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        const groups = wrap.querySelectorAll('g[id^="layer-"]');
        return [...groups].map((g) => {
            const idStr = (g.id || '').replace(/^layer-/, '');
            const id = parseInt(idStr, 10) || Date.now() + Math.floor(Math.random() * 1e6);
            const transform = g.getAttribute('transform') || '';
            let x = 0;
            let y = 0;
            const m = /translate\s*\(\s*([^,\s)]+)\s*,\s*([^)]+)\)/.exec(transform);
            if (m) {
                x = parseFloat(m[1]) || 0;
                y = parseFloat(m[2]) || 0;
            }
            const vis = g.getAttribute('display');
            const visible = vis !== 'none';
            let opacity = 1;
            const oa = g.getAttribute('opacity');
            if (oa != null && oa !== '') opacity = parseFloat(oa) || 1;
            else if (g.style && g.style.opacity) opacity = parseFloat(g.style.opacity) || 1;
            return {
                id,
                name: 'Calque',
                visible,
                x,
                y,
                opacity,
                blendMode: 'source-over',
                buffer: null
            };
        });
    },

    async replaceWorkspaceFromPayload(payload, append = false, loadOpts) {
        loadOpts = loadOpts || {};
        const report = (frac, detail) => {
            if (typeof loadOpts.loadProgress === 'function') {
                loadOpts.loadProgress(Math.max(0, Math.min(1, frac)), detail);
            }
        };
        if (!payload || payload.format !== 'illu-workspace' || !Array.isArray(payload.projects)) {
            throw new Error('Format de projet non reconnu');
        }
        if (typeof window.deselectAll === 'function') window.deselectAll();
        if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);

        const projects = [];
        const totalP = payload.projects.length;
        const P = window.IlluProgress;

        for (let i = 0; i < totalP; i++) {
            const sp = payload.projects[i];
            const pName = sp.name || 'Sans titre';
            const projFrac = totalP ? i / totalP : 0;
            report(projFrac * 0.12, `Projet ${i + 1}/${totalP} : ${pName}`);
            if (P) P.splash(30 + Math.floor(i / totalP * 55), `Restauration : ${pName} (${i + 1}/${totalP})…`);
            if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);

            const p = {
                id: sp.id != null ? sp.id : Date.now() + Math.floor(Math.random() * 1000000),
                name: pName,
                mode: sp.mode === 'vector' ? 'vector' : (sp.mode && sp.mode.startsWith('pixel') ? sp.mode : 'pixel'),
                width: Math.max(1, parseInt(sp.width, 10) || window.ILLU_DEFAULT_DOC_WIDTH || 1280),
                height: Math.max(1, parseInt(sp.height, 10) || window.ILLU_DEFAULT_DOC_HEIGHT || 720),
                ditherEffectSize: sp.ditherEffectSize || 1,
                ditherInvert: sp.ditherInvert === true,
                zoomLevel: sp.zoomLevel != null ? sp.zoomLevel : 1,
                canvasPanX: sp.canvasPanX != null ? sp.canvasPanX : 0,
                canvasPanY: sp.canvasPanY != null ? sp.canvasPanY : 0,
                activeLayerIndex: 0,
                history: [],
                historyIndex: -1,
                canvasData: null,
                svgData: '',
                layers: [],
                pixelSnapshot: null,
                role: sp.role || 'main',
                parentProjectId: sp.parentProjectId != null ? sp.parentProjectId : null,
                parentLayerId: sp.parentLayerId != null ? sp.parentLayerId : null,
                autoSaveLocal: sp.autoSaveLocal === true,
                illuSpriteSheet: sp.illuSpriteSheet === true,
                illuSpriteSourceName: sp.illuSpriteSourceName || null,
                illuSpriteDefsData: sp.illuSpriteDefsData || ''
            };
            if (p.role === 'layerAlphaMask' && sp.alphaMaskUiHidden === true) {
                p.alphaMaskUiHidden = true;
            }

            if (p.mode.startsWith('pixel')) {
                const list = sp.pixelLayers || [];
                const totalL = list.length;
                const loadedLayers = [];
                for (let j = 0; j < totalL; j++) {
                    const pl = list[j];
                    if (!pl || !pl.dataUrl) continue;
                    try {
                        const layerDetail = `Calque ${j + 1}/${totalL} : ${pl.name || '…'}`;
                        report(0.12 + (projFrac + (j + 1) / Math.max(1, totalL) / totalP) * 0.55, layerDetail);
                        if (P && totalL > 1) {
                            P.splash(30 + Math.floor(i / totalP * 55), `Chargement ${layerDetail} (${pName})…`);
                        }
                        if (typeof window.illuYieldToMain === 'function') {
                            await window.illuYieldToMain(pl.dataUrl.length > 120000 ? 2 : 1);
                        }
                        const buf = await this._canvasFromDataUrl(pl.dataUrl);
                        loadedLayers.push({
                            id: pl.id != null ? pl.id : Date.now() + Math.floor(Math.random() * 1000000) + j,
                            name: pl.name || 'Calque',
                            visible: pl.visible !== false,
                            x: pl.x != null ? pl.x : 0,
                            y: pl.y != null ? pl.y : 0,
                            opacity: pl.opacity != null ? pl.opacity : 1,
                            blendMode: pl.blendMode || 'source-over',
                            alphaMaskProjectId:
                                pl.alphaMaskProjectId != null ? pl.alphaMaskProjectId : null,
                            ...this._snapshotDynamicFilterProps(pl),
                            buffer: buf
                        });
                    } catch (e) {
                        console.warn(e);
                    }
                }
                p._pendingLayersLoad = loadedLayers;
                p.layers = [];
                p.activeLayerIndex =
                    loadedLayers.length > 0
                        ? Math.min(
                              Math.max(
                                  0,
                                  sp.activeLayerIndex != null ? sp.activeLayerIndex : loadedLayers.length - 1
                              ),
                              loadedLayers.length - 1
                          )
                        : 0;
                await this._loadProjectHistoryFromPayload(p, sp, loadOpts);
            } else {
                p.svgData = sp.svgData != null ? sp.svgData : '';
                let vLayers = Array.isArray(sp.vectorLayers) ? sp.vectorLayers : [];
                if (!vLayers.length && p.svgData) {
                    vLayers = this._parseVectorLayersFromSvgContent(p.svgData);
                }
                p.layers = vLayers.map((l) => ({
                    id: l.id != null ? l.id : Date.now() + Math.floor(Math.random() * 1000000),
                    name: l.name || 'Calque',
                    visible: l.visible !== false,
                    x: l.x != null ? l.x : 0,
                    y: l.y != null ? l.y : 0,
                    opacity: l.opacity != null ? l.opacity : 1,
                    blendMode: l.blendMode || 'source-over',
                    buffer: null
                }));
                if (!p.layers.length) {
                    p.layers.push({
                        id: Date.now(),
                        name: 'Calque 1',
                        visible: true,
                        x: 0,
                        y: 0,
                        opacity: 1,
                        blendMode: 'source-over',
                        buffer: null
                    });
                    p.svgData = `<g id="layer-${p.layers[0].id}"></g>`;
                }
                p.activeLayerIndex = Math.min(
                    Math.max(0, sp.activeLayerIndex || 0),
                    p.layers.length - 1
                );
                await this._loadProjectHistoryFromPayload(p, sp, loadOpts);
            }
            projects.push(p);
        }

        report(0.96, null);
        if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);

        const oldLen = this.projects.length;
        if (append) {
            this.projects.push(...projects);
            this.activeProjectIndex = oldLen;
        } else {
            this.projects = projects;
            const n = projects.length;
            let targetIdx = payload.activeProjectIndex || 0;
            try {
                const lastId = localStorage.getItem('illu_last_project_id');
                if (lastId) {
                    const found = projects.findIndex((p) => String(p.id) === String(lastId));
                    if (found >= 0) targetIdx = found;
                }
            } catch (e) {
                /* ignore */
            }
            this.activeProjectIndex = n ? Math.min(Math.max(0, targetIdx), n - 1) : -1;
        }

        if (!this.projects.length) {
            this.handleNewProject();
            return;
        }

        this._workspaceLoading = true;
        this._deferDynamicFilterRender = true;
        window._illuWorkspaceLoading = true;

        for (const pr of this.projects) {
            if (pr._pendingLayersLoad && pr !== this.activeProject) {
                pr.layers = pr._pendingLayersLoad;
                delete pr._pendingLayersLoad;
            }
        }

        try {
            await this._mountActiveProjectLayersProgressive(report);
            await this._completeWorkspaceLoad(loadOpts);
        } finally {
            this._workspaceLoading = false;
            this._deferDynamicFilterRender = false;
            window._illuWorkspaceLoading = false;
        }

        if (typeof window.clearSelectionAfterDocumentOpen === 'function') {
            window.clearSelectionAfterDocumentOpen();
        }
        if (typeof window.scheduleFitActiveProjectZoomOnDocumentOpen === 'function') {
            window.scheduleFitActiveProjectZoomOnDocumentOpen(this);
        } else if (typeof window.fitActiveProjectZoomToWorkspace === 'function') {
            window.fitActiveProjectZoomToWorkspace(this, { force: true });
        }
    },

    async _mountActiveProjectLayersProgressive(report) {
        const p = this.activeProject;
        if (!p || !p._pendingLayersLoad || !p._pendingLayersLoad.length) {
            this.applyProjectToUI();
            this.updateTabUI();
            return;
        }
        const pending = p._pendingLayersLoad;
        delete p._pendingLayersLoad;
        p.layers = [];
        p.activeLayerIndex = Math.min(
            Math.max(0, p.activeLayerIndex || 0),
            Math.max(0, pending.length - 1)
        );
        this.applyProjectToUI();
        this.updateTabUI();
        const total = pending.length;
        for (let j = 0; j < total; j++) {
            p.layers.push(pending[j]);
            if (report) {
                report(0.68 + ((j + 1) / total) * 0.18, `Affichage calque ${j + 1}/${total}…`);
            }
            this.updateLayerUI();
            this.render({ skipUiThumbnails: true });
            if (typeof window.illuYieldToMain === 'function') {
                await window.illuYieldToMain(2);
            }
        }
        if (p.layers.length > 0) {
            this.setActiveLayerIndex(p.layers.length - 1);
        }
    },

    _waitDynamicFilterLayerReady(layer, timeoutMs) {
        return new Promise((resolve) => {
            if (!layer || !this._isLiveDynamicFilterLayer(layer)) {
                resolve();
                return;
            }
            const deadline = Date.now() + (Number(timeoutMs) > 0 ? Number(timeoutMs) : 12000);
            const tick = () => {
                if (layer._dynAsyncKey && !layer._dynAsyncPendingKey) {
                    resolve();
                    return;
                }
                if (!this._isLiveDynamicFilterLayer(layer)) {
                    resolve();
                    return;
                }
                if (Date.now() >= deadline) {
                    resolve();
                    return;
                }
                requestAnimationFrame(tick);
            };
            tick();
        });
    },

    async _completeWorkspaceLoad(loadOpts) {
        const report =
            loadOpts && typeof loadOpts.loadProgress === 'function' ? loadOpts.loadProgress : null;
        const dynLayers = [];
        if (this.isPixelMode && Array.isArray(this.layers)) {
            this.layers.forEach((layer, index) => {
                this._normalizeDynamicFilterProps(layer);
                if (this._isLiveDynamicFilterLayer(layer)) {
                    dynLayers.push({ layer, index });
                }
            });
        }

        this.render({ skipUiThumbnails: true });
        if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(2);

        if (!dynLayers.length) {
            this.render({ flushUiThumbnails: true });
            return;
        }

        dynLayers.sort((a, b) => a.index - b.index);
        const p = this.activeProject;
        const docW = Math.max(1, ((p && p.width) | 0) || 1);
        const docH = Math.max(1, ((p && p.height) | 0) || 1);
        const total = dynLayers.length;
        const span = 0.1;

        this._deferDynamicFilterRender = false;
        this._dynamicFilterWarmupActive = true;
        try {
            for (let k = 0; k < total; k++) {
                const { layer, index } = dynLayers[k];
                const label = layer.name || `Calque ${index + 1}`;
                const basePct = 0.88 + (k / total) * span;
                const detail = `Filtre dynamique (${k + 1}/${total}) : ${label}`;
                if (report) report(basePct, `${detail}…`);
                let heartbeat = null;
                if (report) {
                    heartbeat = this._startDynamicFilterLoadHeartbeat(
                        report,
                        basePct,
                        span / total,
                        detail
                    );
                }
                try {
                    if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);
                    await this._prefetchDynamicFilterLayer(layer, index, docW, docH);
                    if (report) {
                        report(
                            basePct + span / total,
                            `${detail} — terminé`
                        );
                    }
                } finally {
                    if (heartbeat) heartbeat.stop();
                }
                if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);
            }
            this.render({ flushUiThumbnails: true });
        } finally {
            this._dynamicFilterWarmupActive = false;
        }
    },

    _applyCtxImageSmoothing(ctx, mode) {
        if (!ctx) return;
        if (mode === 'nearest') {
            ctx.imageSmoothingEnabled = false;
        } else {
            ctx.imageSmoothingEnabled = true;
            if (typeof ctx.imageSmoothingQuality === 'string') {
                ctx.imageSmoothingQuality = mode === 'bicubic' ? 'high' : 'medium';
            }
        }
    },

    /**
     * Redimensionne le document pixel : tous les calques (homothétie) ou seulement le tampon du calque actif.
     * @param {number} newW
     * @param {number} newH
     * @param {{ smoothing: 'nearest'|'bicubic'|'low', scope: 'all'|'active' }} opts
     */
    resizePixelWorkspace(newW, newH, opts) {
        const smoothing = opts && opts.smoothing === 'nearest' ? 'nearest' : opts && opts.smoothing === 'low' ? 'low' : 'bicubic';
        const scope = opts && opts.scope === 'active' ? 'active' : 'all';
        if (!this.activeProject || !this.isPixelMode) return false;
        const p = this.activeProject;
        if (p.role === 'layerAlphaMask') return false;
        newW = Math.max(1, Math.floor(Number(newW)) || 1);
        newH = Math.max(1, Math.floor(Number(newH)) || 1);

        const scaleBuffer = (layer, nw, nh) => {
            if (!layer.buffer) return;
            const ow = layer.buffer.width;
            const oh = layer.buffer.height;
            if (nw < 1 || nh < 1) return;
            const nc = document.createElement('canvas');
            nc.width = nw;
            nc.height = nh;
            const nctx = nc.getContext('2d', { willReadFrequently: true });
            this._applyCtxImageSmoothing(nctx, smoothing);
            nctx.drawImage(layer.buffer, 0, 0, ow, oh, 0, 0, nw, nh);
            layer.buffer = nc;
        };

        if (scope === 'active') {
            const l = this.activeLayer;
            if (!l || !l.buffer) return false;
            scaleBuffer(l, newW, newH);
            const hist =
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('history.resizeActiveLayer')
                    : 'Redimensionnement calque actif';
            this.saveHistory(hist, { patchActiveLayer: true });
            this.applyProjectToUI();
            this.render();
            return true;
        }

        const oldW = p.width;
        const oldH = p.height;
        if (oldW < 1 || oldH < 1) return false;
        const sx = newW / oldW;
        const sy = newH / oldH;

        const transformLayerUniform = (layer) => {
            if (!layer.buffer) return;
            const lw = layer.buffer.width;
            const lh = layer.buffer.height;
            const nw = Math.max(1, Math.round(lw * sx));
            const nh = Math.max(1, Math.round(lh * sy));
            scaleBuffer(layer, nw, nh);
            layer.x = Math.round(layer.x * sx);
            layer.y = Math.round(layer.y * sy);
        };

        p.layers.forEach(transformLayerUniform);
        p.width = newW;
        p.height = newH;

        const maskIds = new Set();
        p.layers.forEach((l) => {
            if (l.alphaMaskProjectId) maskIds.add(l.alphaMaskProjectId);
        });
        maskIds.forEach((mid) => {
            const mp = this.projects.find((pr) => pr.id === mid);
            if (!mp || !mp.layers) return;
            mp.width = newW;
            mp.height = newH;
            mp.layers.forEach(transformLayerUniform);
        });

        if (window.pixelShapeEdit) window.pixelShapeEdit = null;
        if (window.selectionBounds) {
            window.selectionBounds.x = Math.round(window.selectionBounds.x * sx);
            window.selectionBounds.y = Math.round(window.selectionBounds.y * sy);
            window.selectionBounds.w = Math.max(1, Math.round(window.selectionBounds.w * sx));
            window.selectionBounds.h = Math.max(1, Math.round(window.selectionBounds.h * sy));
            if (window.selectionLassoPoints) {
                window.selectionLassoPoints = window.selectionLassoPoints.map((pt) => ({
                    x: Math.round(pt.x * sx),
                    y: Math.round(pt.y * sy)
                }));
            }
        }
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();

        const hist =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t('history.resizeDocument')
                : 'Redimensionnement document';
        this.saveHistory(`${hist} (${oldW}x${oldH} → ${newW}x${newH})`, { documentGeometry: true });
        this.applyProjectToUI();
        this.render();
        return true;
    },

    /**
     * Recadre le document pixel : nouvelle taille = rectangle (rx, ry, rw, rh) en coordonnées document.
     * Tous les calques sont découpés et repositionnés ; masques α liés traités pareil.
     */
    cropPixelWorkspace(rx, ry, rw, rh, opts = {}) {
        if (window.PhotoModeManager && window.PhotoModeManager.isOpen()) {
            window.PhotoModeManager.cropActivePhoto(rx, ry, rw, rh);
            return;
        }
        const p = this.activeProject;
        if (!p || !this.isPixelMode || p.role === 'layerAlphaMask') return false;
        rw = Math.max(1, Math.floor(Number(rw)) || 1);
        rh = Math.max(1, Math.floor(Number(rh)) || 1);
        rx = Math.floor(Number(rx)) || 0;
        ry = Math.floor(Number(ry)) || 0;
        const W = p.width;
        const H = p.height;
        if (W < 1 || H < 1) return false;
        rx = Math.max(0, Math.min(rx, W - 1));
        ry = Math.max(0, Math.min(ry, H - 1));
        rw = Math.max(1, Math.min(rw, W - rx));
        rh = Math.max(1, Math.min(rh, H - ry));

        const cropOneLayer = (layer) => {
            const lx = layer.x | 0;
            const ly = layer.y | 0;
            if (!layer.buffer) {
                layer.x = lx - rx;
                layer.y = ly - ry;
                return;
            }
            const bw = layer.buffer.width;
            const bh = layer.buffer.height;
            const docIx0 = Math.max(rx, lx);
            const docIy0 = Math.max(ry, ly);
            const docIx1 = Math.min(rx + rw, lx + bw);
            const docIy1 = Math.min(ry + rh, ly + bh);
            if (docIx1 <= docIx0 || docIy1 <= docIy0) {
                const emptyC = document.createElement('canvas');
                emptyC.width = 1;
                emptyC.height = 1;
                layer.buffer = emptyC;
                layer.x = lx - rx;
                layer.y = ly - ry;
                return;
            }
            const sw = docIx1 - docIx0;
            const sh = docIy1 - docIy0;
            const srcX = docIx0 - lx;
            const srcY = docIy0 - ly;
            const nc = document.createElement('canvas');
            nc.width = sw;
            nc.height = sh;
            const nctx = nc.getContext('2d', { willReadFrequently: true });
            nctx.imageSmoothingEnabled = false;
            nctx.drawImage(layer.buffer, srcX, srcY, sw, sh, 0, 0, sw, sh);
            layer.buffer = nc;
            layer.x = docIx0 - rx;
            layer.y = docIy0 - ry;
        };

        p.layers.forEach(cropOneLayer);

        p.width = rw;
        p.height = rh;

        // Option : forcer les calques à repasser exactement en taille doc (utile
        // pour « Hors toile » désactivé : on garde le contenu dans le rectangle doc
        // mais on supprime les buffers agrandis au-delà des bords).
        if (opts.normalizeLayersToDocument === true) {
            p.layers.forEach((layer) => {
                if (!layer || !layer.buffer) return;
                const needs =
                    (layer.x | 0) !== 0 ||
                    (layer.y | 0) !== 0 ||
                    (layer.buffer.width | 0) !== rw ||
                    (layer.buffer.height | 0) !== rh;
                if (!needs) return;
                const nc = document.createElement('canvas');
                nc.width = rw;
                nc.height = rh;
                const nctx = nc.getContext('2d', { willReadFrequently: true });
                if (nctx) {
                    nctx.imageSmoothingEnabled = false;
                    nctx.drawImage(layer.buffer, layer.x | 0, layer.y | 0);
                }
                layer.buffer = nc;
                layer.x = 0;
                layer.y = 0;
            });
        }

        const maskIds = new Set();
        p.layers.forEach((l) => {
            if (l.alphaMaskProjectId) maskIds.add(l.alphaMaskProjectId);
        });
        maskIds.forEach((mid) => {
            const mp = this.projects.find((pr) => pr.id === mid);
            if (!mp || !mp.layers) return;
            mp.layers.forEach(cropOneLayer);
            mp.width = rw;
            mp.height = rh;

            if (opts.normalizeLayersToDocument === true) {
                mp.layers.forEach((layer) => {
                    if (!layer || !layer.buffer) return;
                    const needs =
                        (layer.x | 0) !== 0 ||
                        (layer.y | 0) !== 0 ||
                        (layer.buffer.width | 0) !== rw ||
                        (layer.buffer.height | 0) !== rh;
                    if (!needs) return;
                    const nc = document.createElement('canvas');
                    nc.width = rw;
                    nc.height = rh;
                    const nctx = nc.getContext('2d', { willReadFrequently: true });
                    if (nctx) {
                        nctx.imageSmoothingEnabled = false;
                        nctx.drawImage(layer.buffer, layer.x | 0, layer.y | 0);
                    }
                    layer.buffer = nc;
                    layer.x = 0;
                    layer.y = 0;
                });
            }
        });

        if (window.pixelShapeEdit) window.pixelShapeEdit = null;
        if (window.selectionBounds) {
            const sb = window.selectionBounds;
            sb.x -= rx;
            sb.y -= ry;
            sb.w = Math.max(1, Math.min(sb.w, rw - Math.max(0, sb.x)));
            sb.h = Math.max(1, Math.min(sb.h, rh - Math.max(0, sb.y)));
            if (sb.x < 0) {
                sb.w = Math.max(1, sb.w + sb.x);
                sb.x = 0;
            }
            if (sb.y < 0) {
                sb.h = Math.max(1, sb.h + sb.y);
                sb.y = 0;
            }
            if (window.selectionLassoPoints) {
                window.selectionLassoPoints = window.selectionLassoPoints.map((pt) => ({
                    x: pt.x - rx,
                    y: pt.y - ry
                }));
            }
        }

        this.applyProjectToUI();
        this.render();
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();

        const histLabel =
            opts.actionName ||
            (window.IlluI18n &&
            typeof window.IlluI18n.t === 'function' &&
            window.IlluI18n.t('history.crop') !== 'history.crop'
                ? window.IlluI18n.t('history.crop')
                : 'Recadrage');
        this.saveHistory(`${histLabel} (${W}x${H} → ${rw}x${rh})`, {
            documentGeometry: true
        });
        return true;
    },

    /**
     * Recadre l'image (le document entier) selon le rectangle de la sélection active.
     */
    cropToSelection() {
        if (!this.activeProject) return false;
        
        let sb = null;
        if (this.isPixelMode) {
            const state = this._illuRectSelectionLayoutState();
            if (state && state.sb) {
                sb = state.sb;
            }
        } else if (this.mode === 'vector') {
            const state = this._illuSelectionLayoutState();
            if (state && state.sb) {
                sb = state.sb;
            }
        }
        
        if (!sb || sb.w < 1 || sb.h < 1) {
            window.showIlluAlert(
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('msg.noSelectionToCrop')
                    : 'Aucune sélection active pour recadrer l\'image.'
            );
            return false;
        }
        
        if (this.isPixelMode) {
            const success = this.cropPixelWorkspace(sb.x, sb.y, sb.w, sb.h);
            if (success) {
                window.selectionBounds = { x: 0, y: 0, w: this.width, h: this.height };
                if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
            }
            return success;
        } else if (this.mode === 'vector') {
            const p = this.activeProject;
            const rx = Math.floor(sb.x);
            const ry = Math.floor(sb.y);
            const rw = Math.floor(sb.w);
            const rh = Math.floor(sb.h);
            
            const oldW = p.width;
            const oldH = p.height;
            p.width = rw;
            p.height = rh;

            const svg = document.getElementById('drawing-svg');
            if (svg) {
                for (const child of svg.childNodes) {
                    if (child.nodeType !== 1) continue;
                    if (child.id === 'selection-group-ui') continue;
                    if (typeof child.getBBox === 'function') {
                        if (['rect', 'ellipse', 'image', 'text', 'foreignObject'].includes(child.tagName)) {
                            const cx = parseFloat(child.getAttribute('x') || 0);
                            const cy = parseFloat(child.getAttribute('y') || 0);
                            child.setAttribute('x', String(cx - rx));
                            child.setAttribute('y', String(cy - ry));
                        } else if (child.tagName === 'circle') {
                            const cx = parseFloat(child.getAttribute('cx') || 0);
                            const cy = parseFloat(child.getAttribute('cy') || 0);
                            child.setAttribute('cx', String(cx - rx));
                            child.setAttribute('cy', String(cy - ry));
                        } else if (child.tagName === 'path') {
                            if (typeof window.illuTranslateSvgPath === 'function') {
                                window.illuTranslateSvgPath(child, -rx, -ry);
                            } else {
                                const transform = child.getAttribute('transform') || '';
                                child.setAttribute('transform', `${transform} translate(${-rx}, ${-ry})`.trim());
                            }
                        } else if (child.tagName === 'g') {
                            const transform = child.getAttribute('transform') || '';
                            child.setAttribute('transform', `${transform} translate(${-rx}, ${-ry})`.trim());
                        }
                    }
                }
            }
            
            if (window.VectorEngine && typeof window.VectorEngine.refreshSelectionUI === 'function') {
                window.VectorEngine.refreshSelectionUI();
            }
            
            window.selectionBounds = { x: 0, y: 0, w: rw, h: rh };
            if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();

            const histLabel =
                window.IlluI18n && typeof window.IlluI18n.t === 'function' && window.IlluI18n.t('history.crop') !== 'history.crop'
                    ? window.IlluI18n.t('history.crop')
                    : 'Recadrage';
            this.saveHistory(`${histLabel} (${oldW}x${oldH} → ${rw}x${rh})`, { documentGeometry: true });
            this.applyProjectToUI();
            this.render();
            return true;
        }
        return false;
    },

    /**
     * @param {'flipH'|'flipV'|'rot90cw'|'rot90ccw'} action
     * @param {'selection'|'active'|'all'} scope
     */
    applyPixelGeomTransform(action, scope) {
        const pm = window.PhotoModeManager;
        if (pm && pm.isOpen()) {
            this._applyPixelGeomTransformToPhotoMode(action);
            return true;
        }
        if (!this.activeProject || !this.isPixelMode) return false;
        const p = this.activeProject;
        if (p.role === 'layerAlphaMask') return false;
        if (!['flipH', 'flipV', 'rot90cw', 'rot90ccw'].includes(action)) return false;
        if (!['selection', 'active', 'all'].includes(scope)) scope = 'active';

        if (scope === 'selection') {
            const ov = document.getElementById('selection-overlay');
            if (!window.selectionBounds || !ov || ov.style.display === 'none') {
                const msg =
                    window.IlluI18n && typeof window.IlluI18n.t === 'function'
                        ? window.IlluI18n.t('effect.scopeSelectionNeedSel')
                        : 'Sélection requise.';
                window.showIlluAlert(msg);
                return false;
            }
            if (action === 'rot90cw' || action === 'rot90ccw') {
                if (window.selectionKind !== 'rect') {
                    const msg =
                        window.IlluI18n && typeof window.IlluI18n.t === 'function'
                            ? window.IlluI18n.t('msg.transformRotRectOnly')
                            : 'Rotation 90° : utilisez une sélection rectangulaire.';
                    window.showIlluAlert(msg);
                    return false;
                }
            }
            const al = this.activeLayer;
            if (!al || !al.buffer) return false;
            const ok = this._applyPixelGeomTransformToSelection(al, action);
            if (ok) {
                if (
                    (action === 'rot90cw' || action === 'rot90ccw') &&
                    window.selectionBounds
                ) {
                    const sb = window.selectionBounds;
                    const cx = sb.x + sb.w / 2;
                    const cy = sb.y + sb.h / 2;
                    const nw = sb.h;
                    const nh = sb.w;
                    sb.x = Math.round(cx - nw / 2);
                    sb.y = Math.round(cy - nh / 2);
                    sb.w = Math.max(1, Math.round(nw));
                    sb.h = Math.max(1, Math.round(nh));
                }
                const hist =
                    window.IlluI18n && typeof window.IlluI18n.t === 'function'
                        ? window.IlluI18n.t('history.pixelTransformSel')
                        : 'Transformation (sélection)';
                this.saveHistory(hist, { patchActiveLayer: true });
                this.applyProjectToUI();
                this.render();
            }
            return ok;
        }

        const W = p.width;
        const H = p.height;

        const rot90cwLayer = (layer, docW, docH) => {
            const buf = layer.buffer;
            const lw = buf.width;
            const lh = buf.height;
            const lx = layer.x;
            const ly = layer.y;
            const nc = document.createElement('canvas');
            nc.width = lh;
            nc.height = lw;
            const nctx = nc.getContext('2d', { willReadFrequently: true });
            nctx.imageSmoothingEnabled = false;
            nctx.translate(nc.width, 0);
            nctx.rotate(Math.PI / 2);
            nctx.drawImage(buf, 0, 0);
            layer.buffer = nc;

            // Math: x' = oldH - oldY - oldH_item, y' = oldX
            layer.x = docH - ly - lh;
            layer.y = lx;
        };

        const rot90ccwLayer = (layer, docW, docH) => {
            const buf = layer.buffer;
            const lw = buf.width;
            const lh = buf.height;
            const lx = layer.x;
            const ly = layer.y;
            const nc = document.createElement('canvas');
            nc.width = lh;
            nc.height = lw;
            const nctx = nc.getContext('2d', { willReadFrequently: true });
            nctx.imageSmoothingEnabled = false;
            nctx.translate(0, nc.height);
            nctx.rotate(-Math.PI / 2);
            nctx.drawImage(buf, 0, 0);
            layer.buffer = nc;

            // Math: x' = oldY, y' = oldW - oldX - oldW_item
            layer.x = ly;
            layer.y = docW - lx - lw;
        };

        const flipHLayer = (layer, docW) => {
            const buf = layer.buffer;
            const lw = buf.width;
            const lh = buf.height;
            const lx = layer.x;
            const ly = layer.y;
            const nc = document.createElement('canvas');
            nc.width = lw;
            nc.height = lh;
            const nctx = nc.getContext('2d', { willReadFrequently: true });
            nctx.imageSmoothingEnabled = false;
            nctx.scale(-1, 1);
            nctx.drawImage(buf, -lw, 0);
            layer.buffer = nc;
            layer.x = docW - lx - lw;
            layer.y = ly;
        };

        const flipVLayer = (layer, docH) => {
            const buf = layer.buffer;
            const lw = buf.width;
            const lh = buf.height;
            const lx = layer.x;
            const ly = layer.y;
            const nc = document.createElement('canvas');
            nc.width = lw;
            nc.height = lh;
            const nctx = nc.getContext('2d', { willReadFrequently: true });
            nctx.imageSmoothingEnabled = false;
            nctx.scale(1, -1);
            nctx.drawImage(buf, 0, -lh);
            layer.buffer = nc;
            layer.x = lx;
            layer.y = docH - ly - lh;
        };

        const applyGeomToLayer = (layer, docW, docH) => {
            if (!layer?.buffer) return;
            if (action === 'rot90cw') rot90cwLayer(layer, docW, docH);
            else if (action === 'rot90ccw') rot90ccwLayer(layer, docW, docH);
            else if (action === 'flipH') flipHLayer(layer, docW);
            else if (action === 'flipV') flipVLayer(layer, docH);
        };

        const forEachLinkedMaskLayer = (mainLayer, fn) => {
            const mid = mainLayer && mainLayer.alphaMaskProjectId;
            if (!mid) return;
            const mp = this.projects.find((pr) => pr.id === mid);
            if (!mp || !mp.layers) return;
            mp.layers.forEach(fn);
        };

        if (scope === 'active') {
            const al = this.activeLayer;
            if (!al?.buffer) return false;
            // Save before so undo restores original pixels
            const histPre =
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('history.pixelTransform')
                    : 'Transformation image';
            this.saveHistory(histPre, { patchActiveLayer: true });
            applyGeomToLayer(al, W, H);
            forEachLinkedMaskLayer(al, (ml) => applyGeomToLayer(ml, W, H));
        } else if (action === 'rot90cw' || action === 'rot90ccw') {
            const newW = H;
            const newH = W;
            p.layers.forEach((l) => applyGeomToLayer(l, W, H));
            p.width = newW;
            p.height = newH;
            const maskIds = new Set();
            p.layers.forEach((l) => {
                if (l.alphaMaskProjectId) maskIds.add(l.alphaMaskProjectId);
            });
            maskIds.forEach((mid) => {
                const mp = this.projects.find((pr) => pr.id === mid);
                if (!mp || !mp.layers) return;
                mp.width = newW;
                mp.height = newH;
                mp.layers.forEach((ml) => applyGeomToLayer(ml, W, H));
            });
            if (window.selectionBounds) {
                const sb = window.selectionBounds;
                if (action === 'rot90cw') {
                    const nsx = sb.y;
                    const nsy = W - sb.x - sb.w;
                    sb.x = Math.round(nsx);
                    sb.y = Math.round(nsy);
                } else {
                    const nsx = H - sb.y - sb.h;
                    const nsy = sb.x;
                    sb.x = Math.round(nsx);
                    sb.y = Math.round(nsy);
                }
                const tw = sb.w;
                sb.w = Math.max(1, Math.round(sb.h));
                sb.h = Math.max(1, Math.round(tw));
                if (window.selectionLassoPoints && window.selectionLassoPoints.length) {
                    window.selectionLassoPoints = null;
                }
            }
            const histRot =
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('history.pixelTransform')
                    : 'Transformation image';
            this.saveHistory(`${histRot} (${W}x${H} → ${newW}x${newH})`, { documentGeometry: true });
        } else {
            p.layers.forEach((l) => applyGeomToLayer(l, W, H));
            const maskIds = new Set();
            p.layers.forEach((l) => {
                if (l.alphaMaskProjectId) maskIds.add(l.alphaMaskProjectId);
            });
            maskIds.forEach((mid) => {
                const mp = this.projects.find((pr) => pr.id === mid);
                if (!mp || !mp.layers) return;
                mp.layers.forEach((ml) => applyGeomToLayer(ml, W, H));
            });
            if (window.selectionBounds) {
                const sb = window.selectionBounds;
                if (action === 'flipH') {
                    sb.x = Math.round(W - sb.x - sb.w);
                } else if (action === 'flipV') {
                    sb.y = Math.round(H - sb.y - sb.h);
                }
                if (window.selectionLassoPoints && window.selectionLassoPoints.length) {
                    window.selectionLassoPoints = null;
                }
            }
        }

        if (window.pixelShapeEdit) window.pixelShapeEdit = null;
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();

        // Only save here if we haven't already saved above (active-layer OR flip-all cases)
        if (scope !== 'active' && action !== 'rot90cw' && action !== 'rot90ccw') {
            const hist =
                window.IlluI18n && typeof window.IlluI18n.t === 'function'
                    ? window.IlluI18n.t('history.pixelTransform')
                    : 'Transformation image';
            this.saveHistory(hist);
        }
        this.applyProjectToUI();
        this.render();
        return true;
    },

    _applyPixelGeomTransformToPhotoMode(action) {
        if (window.PhotoModeManager && window.PhotoModeManager.isOpen()) {
            window.PhotoModeManager.transformActivePhoto(action);
        }
    },

    _applyPixelGeomTransformToSelection(layer, action) {
        const sb = window.selectionBounds;
        const lx = layer.x;
        const ly = layer.y;
        const bctx = layer.buffer.getContext('2d', { willReadFrequently: true });
        const bw = layer.buffer.width;
        const bh = layer.buffer.height;
        const docIx0 = sb.x - lx;
        const docIy0 = sb.y - ly;
        const ix = Math.max(0, Math.floor(docIx0));
        const iy = Math.max(0, Math.floor(docIy0));
        const iw = Math.min(bw - ix, Math.ceil(sb.w));
        const ih = Math.min(bh - iy, Math.ceil(sb.h));
        if (iw < 1 || ih < 1) return false;

        if (action === 'flipH' || action === 'flipV') {
            const img = bctx.getImageData(ix, iy, iw, ih);
            const d = img.data;
            const w = iw;
            const h = ih;
            if (action === 'flipH') {
                for (let y = 0; y < h; y++) {
                    const row = y * w * 4;
                    for (let x = 0; x < w >> 1; x++) {
                        const a = row + x * 4;
                        const b = row + (w - 1 - x) * 4;
                        for (let c = 0; c < 4; c++) {
                            const t = d[a + c];
                            d[a + c] = d[b + c];
                            d[b + c] = t;
                        }
                    }
                }
            } else {
                for (let y = 0; y < h >> 1; y++) {
                    const r1 = y * w * 4;
                    const r2 = (h - 1 - y) * w * 4;
                    for (let x = 0; x < w * 4; x++) {
                        const t = d[r1 + x];
                        d[r1 + x] = d[r2 + x];
                        d[r2 + x] = t;
                    }
                }
            }
            bctx.putImageData(img, ix, iy);
            return true;
        }

        const patch = document.createElement('canvas');
        patch.width = iw;
        patch.height = ih;
        patch.getContext('2d', { willReadFrequently: true }).drawImage(layer.buffer, ix, iy, iw, ih, 0, 0, iw, ih);
        const out = document.createElement('canvas');
        out.width = ih;
        out.height = iw;
        const ox = out.getContext('2d', { willReadFrequently: true });
        ox.imageSmoothingEnabled = false;
        if (action === 'rot90cw') {
            ox.translate(out.width, 0);
            ox.rotate(Math.PI / 2);
            ox.drawImage(patch, 0, 0);
        } else {
            ox.translate(0, out.height);
            ox.rotate(-Math.PI / 2);
            ox.drawImage(patch, 0, 0);
        }
        const destX = Math.round(ix + iw / 2 - ih / 2);
        const destY = Math.round(iy + ih / 2 - iw / 2);
        const minX = Math.max(0, Math.floor(Math.min(ix, destX, ix + iw, destX + out.width)) - 1);
        const minY = Math.max(0, Math.floor(Math.min(iy, destY, iy + ih, destY + out.height)) - 1);
        const maxX = Math.min(bw, Math.ceil(Math.max(ix, destX, ix + iw, destX + out.width)) + 1);
        const maxY = Math.min(bh, Math.ceil(Math.max(iy, destY, iy + ih, destY + out.height)) + 1);
        bctx.clearRect(minX, minY, maxX - minX, maxY - minY);
        bctx.drawImage(out, destX, destY);

        // Mise à jour de la boîte de sélection après rotation
        if (window.selectionBounds) {
            window.selectionBounds.x = destX + lx;
            window.selectionBounds.y = destY + ly;
            window.selectionBounds.w = ih;
            window.selectionBounds.h = iw;
        }
        if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();

        return true;
    },

    /**
     * À appeler après init() une fois WorkspaceIO chargé : restaure localStorage ou nouveau projet.
     */
    async convertActiveProjectToPixel() {
        const p = this.activeProject;
        if (!p) return;
        if (p.mode === 'vector') {
            // Synchronise svgData depuis le DOM avant de rasteriser
            this.syncActiveVectorSvg();
            // Pour le projet actif, récupère le markup SVG standalone complet
            p.svgData = this.getStandaloneSvgMarkup() || p.svgData || '';
            await this._rasterizeProjectLayers(p);
            p.mode = 'pixel';
        } else if (p.mode === 'pixel-dither' || p.mode === 'pixel-ral' || p.mode === 'pixel-cmjn') {
            p.mode = 'pixel';
        }
        this.saveHistory('Conversion en Bitmap');
        this.applyProjectToUI();
    },

    async convertActiveProjectToDither() {
        const p = this.activeProject;
        if (!p) return;

        const dlg = document.getElementById('dialog-convert-dither');
        if (dlg) {
            dlg.style.display = 'flex';
            const slider = document.getElementById('convert-dither-size-val');
            if (slider) {
                const currentSize = this.ditherEffectSize || 1;
                slider.value = currentSize;
                const valDisp = slider.nextElementSibling;
                if (valDisp && valDisp.classList.contains('illu-range-val')) {
                    valDisp.textContent = currentSize;
                }
            }
        }
    },

    async finalizeDitherConversion() {
        const p = this.activeProject;
        if (!p) return;

        const slider = document.getElementById('convert-dither-size-val');
        const size = parseInt(slider?.value || '1', 10);
        this.ditherEffectSize = size;

        document.getElementById('dialog-convert-dither').style.display = 'none';

        if (p.mode === 'vector') {
            p.svgData = this.getStandaloneSvgMarkup();
            await this._rasterizeProjectLayers(p);
        }
        
        p.mode = 'pixel-dither';
        
        // Apply dither to all layers
        for (const layer of p.layers) {
            if (layer.buffer) {
                const ctx = layer.buffer.getContext('2d', { willReadFrequently: true });
                const idata = ctx.getImageData(0, 0, layer.buffer.width, layer.buffer.height);
                const inv = p.ditherInvert || false;
                this._ditherImageData(idata, this.ditherEffectSize, { invert: inv });
                ctx.putImageData(idata, 0, 0);
                layer._thumbDirty = true;
            }
        }
        
        this.saveHistory('Conversion en Tramé N&B');
        this.applyProjectToUI();
    },

    async convertActiveProjectToRal() {
        const p = this.activeProject;
        if (!p) return;

        if (p.mode === 'vector') {
            p.svgData = this.getStandaloneSvgMarkup();
            await this._rasterizeProjectLayers(p);
        }
        
        p.mode = 'pixel-ral';
        
        if (typeof RAL_COLORS !== 'undefined') {
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
                        let bestColor = RAL_COLORS[0] || { r: 0, g: 0, b: 0 };
                        
                        for (let c = 0; c < RAL_COLORS.length; c++) {
                            const col = RAL_COLORS[c];
                            const dist = 2 * (r - col.r)**2 + 4 * (g - col.g)**2 + 3 * (b - col.b)**2;
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
            }
        }
        
        this.saveHistory('Conversion en Couleurs RAL');
        this.applyProjectToUI();
    },

    async convertActiveProjectToCmjn() {
        const p = this.activeProject;
        if (!p) return;

        if (p.mode === 'vector') {
            p.svgData = this.getStandaloneSvgMarkup();
            await this._rasterizeProjectLayers(p);
        }
        
        p.mode = 'pixel-cmjn';

        for (const layer of p.layers) {
            if (layer.buffer) {
                const ctx = layer.buffer.getContext('2d', { willReadFrequently: true });
                const idata = ctx.getImageData(0, 0, layer.buffer.width, layer.buffer.height);
                this.constrainImageDataToProjectMode(idata, 'pixel-cmjn');
                ctx.putImageData(idata, 0, 0);
                layer._thumbDirty = true;
            }
        }
        
        this.saveHistory('Conversion en CMJN');
        this.applyProjectToUI();
    },

    async openActiveProjectInPhotoModePro() {
        const p = this.activeProject;
        if (!p) return;

        const t = (k, fb) => (window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t(k) : fb);
        let busy = window.IlluProgress ? window.IlluProgress.createDelayedInstantEffect(t('photo.openingProjects', 'Préparation du projet...'), 10) : null;
        
        try {
            // Get flattened render (handles vector and pixel correctly)
            const canvas = await this.flattenProjectToCanvas(p);

            if (window.PhotoModeManager && typeof window.PhotoModeManager.openFromCanvas === 'function') {
                await window.PhotoModeManager.openFromCanvas(canvas, p.name || 'Projet MasterPaint');
            } else if (window.PhotoModeManager && typeof window.PhotoModeManager.open === 'function') {
                window.PhotoModeManager.open();
            }
        } finally {
            if (busy) busy.done();
        }
    },

    /**
     * Produit un canvas bitmap plat du projet entier (vecteurs + pixels).
     * Non-destructif pour le projet source.
     */
    async flattenProjectToCanvas(p) {
        if (!p) return null;
        this.render(); // Ensure editor state is synced

        const canvas = document.createElement('canvas');
        canvas.width = p.width;
        canvas.height = p.height;
        const ctx = canvas.getContext('2d');

        if (p.mode === 'vector') {
            const svgData = this.getStandaloneSvgMarkup();
            if (svgData) {
                await new Promise((resolve) => {
                    const img = new Image();
                    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0);
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    img.onerror = () => {
                        console.error("flattenProjectToCanvas: Error loading SVG image");
                        resolve(); // Continue anyway
                    };
                    img.src = url;
                });
            }
        } else {
            // Pixel Mode: use composition logice
            const source = this.flattenPixelProjectToCanvas(p, true);
            if (source) {
                ctx.drawImage(source, 0, 0);
            }
        }
        return canvas;
    },

    /**
     * Pixélise les calques d'un projet vecteur en créant des buffers bitmap.
     */
    async _rasterizeProjectLayers(p) {
        // Utilise le svgData déjà calculé (standalone markup complet)
        const svgData = p.svgData || '';
        if (!svgData || !svgData.includes('<svg')) {
            console.warn('_rasterizeProjectLayers: aucun contenu SVG valide à rasteriser.');
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = p.width || 1280;
        canvas.height = p.height || 720;
        const ctx = canvas.getContext('2d');

        await new Promise((resolve) => {
            const img = new Image();
            // Important : utiliser svgData (variable locale) et non p.svgData
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            img.onload = () => {
                ctx.drawImage(img, 0, 0, img.naturalWidth || canvas.width, img.naturalHeight || canvas.height, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve();
            };
            img.onerror = (err) => {
                console.error('_rasterizeProjectLayers: erreur de chargement du SVG dans Image()', err);
                URL.revokeObjectURL(url);
                resolve();
            };
            img.src = url;
        });

        // Remplace les calques par ce calque unique rasterisé
        p.layers = [{
            id: Date.now(),
            name: 'Calque rasterisé',
            buffer: canvas,
            x: 0,
            y: 0,
            opacity: 1,
            visible: true,
            blendMode: 'source-over',
            alphaMaskProjectId: null,
            _thumbDirty: true,
            ...this._defaultDynamicFilterLayerProps()
        }];
        p.activeLayerIndex = 0;
        p.svgData = null;
    },

    async startWorkspace() {
        let routed = false;
        if (typeof window.WorkspaceIO !== 'undefined') {
            const ok = await window.WorkspaceIO.tryRestoreOnInit(this);
            if (!ok) {
                // Essayer de router via URL si pas de restauration
                routed = this.handleUrlRouting();
                if (!routed) this.handleNewProject();
            } else {
                // Restauration réussie : on considère que l'initialisation est faite.
                // On marque routed = true pour éviter de redéclencher handleUrlRouting dans le microtask.
                routed = true; 
            }
        } else {
            routed = this.handleUrlRouting();
            if (!routed) this.handleNewProject();
        }

        queueMicrotask(() => {
            if (typeof window.illuApplyPhoneLayoutDefaultIfUnset === 'function') {
                window.illuApplyPhoneLayoutDefaultIfUnset();
            }
            if (typeof window.applyUILayoutFromPreference === 'function') window.applyUILayoutFromPreference();
            if (window.WorkspaceIO && typeof window.WorkspaceIO.wireCanvasInteractionGate === 'function') {
                window.WorkspaceIO.wireCanvasInteractionGate();
            }
            if (window.WorkspaceIO && typeof window.WorkspaceIO.setupAutoSaveIntervalTimer === 'function') {
                window.WorkspaceIO.setupAutoSaveIntervalTimer();
            }
            
            // Routage URL après chargement complet (si pas déjà fait lors de startWorkspace)
            // Note : on ne le fait plus si une restauration a eu lieu ou si déjà routé (routed=true).
            if (!routed) this.handleUrlRouting();
        });
    },

    /**
     * Move selected vector element up or down in the DOM stack.
     * @param {number|string} dir 1 for forward (N+1), -1 for backward (N-1), 'front' for top, 'back' for bottom
     */
    moveSelectedVectorElement(dir) {
        if (!this.activeVectorSelection || !this.activeVectorSelection.length) return;
        
        let moved = false;
        // Sort elements by DOM order so moving doesn't scramble them
        const sel = [...this.activeVectorSelection].sort((a, b) => {
            return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
        });

        if (dir === 'front') {
            for (let i = 0; i < sel.length; i++) {
                const el = sel[i];
                if (el.parentElement) {
                    el.parentElement.appendChild(el);
                    moved = true;
                }
            }
        } else if (dir === 'back') {
            for (let i = sel.length - 1; i >= 0; i--) {
                const el = sel[i];
                if (el.parentElement) {
                    el.parentElement.insertBefore(el, el.parentElement.firstElementChild);
                    moved = true;
                }
            }
        } else if (dir > 0) {
            for (let i = sel.length - 1; i >= 0; i--) {
                const el = sel[i];
                if (!el.parentElement) continue;
                const next = el.nextElementSibling;
                // Don't move past another selected element if possible
                if (next && !sel.includes(next)) {
                    next.insertAdjacentElement('afterend', el);
                    moved = true;
                }
            }
        } else {
            for (let i = 0; i < sel.length; i++) {
                const el = sel[i];
                if (!el.parentElement) continue;
                const prev = el.previousElementSibling;
                if (prev && !sel.includes(prev)) {
                    prev.insertAdjacentElement('beforebegin', el);
                    moved = true;
                }
            }
        }

        if (moved) {
            this.syncActiveVectorSvg();
            this.saveHistory('Arrangement vecteur', { type: 'vector-full', svg: this.activeProject.svgData });
            this.render();
        }
    },

    /** Déplace la sélection vectorielle vers un nouveau calque. */
    createNewLayerFromActiveVectorSelection() {
        if (!this.activeVectorSelection || !this.activeVectorSelection.length) return;
        const sel = [...this.activeVectorSelection];
        const layerName = `Calque ${this.layers.length + 1}`;
        this.addLayer(layerName);
        const g = document.getElementById(`layer-${this.activeLayer.id}`);
        if (!g) return;
        sel.forEach((el) => {
            if (el.parentElement) g.appendChild(el);
        });
        this.activeVectorSelection = sel;
        window._activeVectorShapeEl = sel[sel.length - 1] || null;
        this.syncActiveVectorSvg();
        this.saveHistory('Nouveau calque (sélection)', {
            type: 'vector-full',
            svg: this.activeProject.svgData
        });
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        this.render();
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    },

    /**
     * Apply boolean operation between two vector shapes and replace them with a real <path>.
     * Implementation is self-contained (no external deps): rasterize both shapes to masks,
     * apply boolean on pixels, then vectorize the result via marching squares.
     *
     * @param {'union'|'subtract'|'intersect'} op
     */
    async applyVectorBoolean(op) {
        if (this.mode !== 'vector') return;
        if (!window._activeVectorShapeEl) {
            alert("Veuillez sélectionner une forme.");
            return;
        }

        // Prefer explicit selection order when multi-selected:
        // target = element just below the primary (or second-to-last selection).
        const primary = window._activeVectorShapeEl;
        let acting = primary;
        let target = null;
        if (Array.isArray(this.activeVectorSelection) && this.activeVectorSelection.length >= 2) {
            acting = this.activeVectorSelection[this.activeVectorSelection.length - 1];
            target = this.activeVectorSelection[this.activeVectorSelection.length - 2];
        } else {
            target = acting ? acting.previousElementSibling : null;
        }

        if (!acting || !target) {
            alert("Opération impossible : sélectionnez deux formes (ou une forme avec une autre en dessous).");
            return;
        }

        const parent = target.parentElement;
        if (!parent || acting.parentElement !== parent) {
            alert("Opération impossible : les deux formes doivent être dans le même calque/groupe.");
            return;
        }

        const resultD = await this._vectorBooleanRasterToPathD(op, target, acting);
        if (!resultD) {
            alert("Résultat vide.");
            return;
        }

        const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        newPath.setAttribute('d', resultD);
        newPath.setAttribute('fill-rule', 'evenodd');

        // Copy styles from target
        const attrs = ['fill', 'stroke', 'stroke-width', 'opacity', 'transform'];
        attrs.forEach((a) => {
            const v = target.getAttribute(a);
            if (v) newPath.setAttribute(a, v);
        });

        parent.insertBefore(newPath, target);
        if (target.parentElement) target.parentElement.removeChild(target);
        if (acting.parentElement) acting.parentElement.removeChild(acting);

        window._activeVectorShapeEl = newPath;
        this.activeVectorSelection = [newPath];
        this.syncActiveVectorSvg();
        this.saveHistory('Fusion vecteur', { type: 'vector-full', svg: this.activeProject.svgData });
        this.render();
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    },

    async _vectorBooleanRasterToPathD(op, targetEl, actingEl) {
        const p = this.activeProject;
        if (!p) return '';

        // Quality: 2x doc resolution is a good default without blowing up perf too much.
        const scale = 2;
        const w = Math.max(1, Math.round(p.width * scale));
        const h = Math.max(1, Math.round(p.height * scale));

        const [aMask, bMask] = await Promise.all([
            this._renderVectorElementMask(targetEl, w, h, scale),
            this._renderVectorElementMask(actingEl, w, h, scale)
        ]);
        if (!aMask || !bMask) return '';

        const out = new Uint8Array(w * h);
        for (let i = 0; i < out.length; i++) {
            const A = aMask[i] ? 1 : 0;
            const B = bMask[i] ? 1 : 0;
            let v = 0;
            if (op === 'union') v = A | B;
            else if (op === 'subtract') v = A & (1 - B);
            else if (op === 'intersect') v = A & B;
            else if (op === 'exclude') v = A ^ B;
            else v = 0;
            out[i] = v;
        }

        const mp = this._maskToPathsMarchingSquares(out, w, h);
        if (!mp || !mp.length) return '';

        // Convert pixel-space paths to SVG path data in document coords.
        const inv = 1 / scale;
        const parts = [];
        for (const path of mp) {
            if (!path || path.length < 3) continue;
            // Retro-analysis for complex boolean results:
            // 1) remove collinear
            // 2) RDP simplification (reduces points a lot)
            // 3) output as quadratic spline where useful
            const simplified = this._rdpSimplify(path, 0.85);
            parts.push(this._pointsToSvgPath(simplified, inv));
        }
        return parts.join(' ');
    },

    async _renderVectorElementMask(el, w, h, scale) {
        try {
            const svg = document.getElementById('drawing-svg');
            if (!svg) return null;
            const vb = `0 0 ${this.activeProject.width} ${this.activeProject.height}`;

            const clone = el.cloneNode(true);
            // Force a solid black mask respecting geometry; keep stroke-width if any.
            clone.setAttribute('fill', '#000');
            if (!clone.getAttribute('stroke-width')) clone.setAttribute('stroke-width', '0');
            const sw = parseFloat(clone.getAttribute('stroke-width') || '0') || 0;
            if (sw > 0) clone.setAttribute('stroke', '#000');
            else clone.setAttribute('stroke', 'none');
            clone.setAttribute('opacity', '1');
            clone.removeAttribute('filter');
            clone.removeAttribute('clip-path');
            clone.removeAttribute('mask');

            const svgMarkup =
                `<svg xmlns="http://www.w3.org/2000/svg" width="${this.activeProject.width}" height="${this.activeProject.height}" viewBox="${vb}">` +
                `<g>${clone.outerHTML}</g></svg>`;

            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = w;
            maskCanvas.height = h;
            const ctx = maskCanvas.getContext('2d');
            if (!ctx) return null;
            ctx.clearRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
            ctx.setTransform(scale, 0, 0, scale, 0, 0);

            await new Promise((resolve, reject) => {
                const img = new Image();
                const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                img.onload = () => {
                    try {
                        ctx.drawImage(img, 0, 0);
                        resolve();
                    } catch (e) {
                        reject(e);
                    } finally {
                        URL.revokeObjectURL(url);
                    }
                };
                img.onerror = (e) => {
                    URL.revokeObjectURL(url);
                    reject(e);
                };
                img.src = url;
            });

            const id = ctx.getImageData(0, 0, w, h).data;
            const out = new Uint8Array(w * h);
            for (let i = 0, p = 0; i < id.length; i += 4, p++) {
                // alpha threshold
                out[p] = id[i + 3] >= 16 ? 1 : 0;
            }
            return out;
        } catch (e) {
            return null;
        }
    },

    _maskToPathsMarchingSquares(mask, w, h) {
        // mask is w*h, values 0/1. Marching squares over (w-1)*(h-1) cells.
        const segs = [];
        const mid = (x0, y0, x1, y1) => ({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
        const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : (mask[y * w + x] ? 1 : 0);

        for (let y = 0; y < h - 1; y++) {
            for (let x = 0; x < w - 1; x++) {
                const a = at(x, y);
                const b = at(x + 1, y);
                const c = at(x + 1, y + 1);
                const d = at(x, y + 1);
                const idx = a | (b << 1) | (c << 2) | (d << 3);
                if (idx === 0 || idx === 15) continue;

                const top = mid(x, y, x + 1, y);
                const right = mid(x + 1, y, x + 1, y + 1);
                const bottom = mid(x, y + 1, x + 1, y + 1);
                const left = mid(x, y, x, y + 1);

                // Standard marching squares segments (ambiguous cases resolved consistently)
                switch (idx) {
                    case 1: // a
                    case 14:
                        segs.push([left, top]);
                        break;
                    case 2: // b
                    case 13:
                        segs.push([top, right]);
                        break;
                    case 3:
                    case 12:
                        segs.push([left, right]);
                        break;
                    case 4:
                    case 11:
                        segs.push([right, bottom]);
                        break;
                    case 5: // ambiguous
                        segs.push([left, top]);
                        segs.push([right, bottom]);
                        break;
                    case 6:
                    case 9:
                        segs.push([top, bottom]);
                        break;
                    case 7:
                    case 8:
                        segs.push([left, bottom]);
                        break;
                    case 10: // ambiguous
                        segs.push([top, right]);
                        segs.push([left, bottom]);
                        break;
                    default:
                        break;
                }
            }
        }

        if (!segs.length) return [];

        const key = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
        const nextMap = new Map();
        const addEdge = (p0, p1) => {
            const k0 = key(p0);
            if (!nextMap.has(k0)) nextMap.set(k0, []);
            nextMap.get(k0).push(p1);
        };
        segs.forEach(([p0, p1]) => {
            addEdge(p0, p1);
            addEdge(p1, p0);
        });

        const used = new Set();
        const paths = [];

        const edgeKey = (p0, p1) => `${key(p0)}>${key(p1)}`;

        for (const [p0k, outs] of nextMap.entries()) {
            for (const p1 of outs) {
                const p0 = (() => {
                    const [xs, ys] = p0k.split(',');
                    return { x: parseFloat(xs), y: parseFloat(ys) };
                })();
                const ek = edgeKey(p0, p1);
                if (used.has(ek)) continue;

                const path = [p0];
                let cur = p0;
                let prev = null;
                let guard = 0;
                while (guard++ < 200000) {
                    const outs2 = nextMap.get(key(cur)) || [];
                    if (!outs2.length) break;

                    // choose next that isn't prev when possible
                    let nxt = outs2[0];
                    if (prev && outs2.length > 1) {
                        const kPrev = key(prev);
                        const cand = outs2.find((p) => key(p) !== kPrev);
                        if (cand) nxt = cand;
                    }
                    used.add(edgeKey(cur, nxt));
                    prev = cur;
                    cur = nxt;
                    if (key(cur) === key(path[0])) break;
                    path.push(cur);
                }

                if (path.length >= 4) {
                    paths.push(this._simplifyPolyline(path));
                }
            }
        }

        return paths;
    },

    _simplifyPolyline(pts) {
        if (!pts || pts.length < 3) return pts || [];
        const out = [pts[0]];
        const collinear = (a, b, c) => {
            const abx = b.x - a.x, aby = b.y - a.y;
            const bcx = c.x - b.x, bcy = c.y - b.y;
            return Math.abs(abx * bcy - aby * bcx) < 1e-6;
        };
        for (let i = 1; i < pts.length - 1; i++) {
            const a = out[out.length - 1];
            const b = pts[i];
            const c = pts[i + 1];
            if (!collinear(a, b, c)) out.push(b);
        }
        out.push(pts[pts.length - 1]);
        return out;
    },

    _rdpSimplify(pts, epsilon) {
        if (!pts || pts.length < 4) return pts || [];
        const eps2 = epsilon * epsilon;
        const distToSeg2 = (p, a, b) => {
            const vx = b.x - a.x;
            const vy = b.y - a.y;
            const wx = p.x - a.x;
            const wy = p.y - a.y;
            const c1 = vx * wx + vy * wy;
            if (c1 <= 0) return wx * wx + wy * wy;
            const c2 = vx * vx + vy * vy;
            if (c2 <= c1) {
                const dx = p.x - b.x;
                const dy = p.y - b.y;
                return dx * dx + dy * dy;
            }
            const t = c1 / c2;
            const px = a.x + t * vx;
            const py = a.y + t * vy;
            const dx = p.x - px;
            const dy = p.y - py;
            return dx * dx + dy * dy;
        };

        const keep = new Uint8Array(pts.length);
        keep[0] = 1;
        keep[pts.length - 1] = 1;
        const stack = [[0, pts.length - 1]];
        while (stack.length) {
            const [s, e] = stack.pop();
            let maxD2 = 0;
            let idx = -1;
            const a = pts[s];
            const b = pts[e];
            for (let i = s + 1; i < e; i++) {
                const d2 = distToSeg2(pts[i], a, b);
                if (d2 > maxD2) {
                    maxD2 = d2;
                    idx = i;
                }
            }
            if (idx !== -1 && maxD2 > eps2) {
                keep[idx] = 1;
                stack.push([s, idx], [idx, e]);
            }
        }
        const out = [];
        for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
        return out.length >= 3 ? out : pts;
    },

    _pointsToSvgPath(pts, scale) {
        if (!pts.length) return '';
        const p0 = pts[0];
        // If the contour is complex, output a quadratic spline to reduce points and smooth "rounded" areas.
        // Quadratic (3-point) segments: Q(control = point i) to midpoint(i, i+1).
        if (pts.length >= 10) {
            let d = `M ${p0.x * scale} ${p0.y * scale}`;
            for (let i = 1; i < pts.length - 1; i++) {
                const c = pts[i];
                const n = pts[i + 1];
                const mx = (c.x + n.x) / 2;
                const my = (c.y + n.y) / 2;
                d += ` Q ${c.x * scale} ${c.y * scale} ${mx * scale} ${my * scale}`;
            }
            // Close with last control point to start.
            const cLast = pts[pts.length - 1];
            d += ` Q ${cLast.x * scale} ${cLast.y * scale} ${p0.x * scale} ${p0.y * scale} Z`;
            return d;
        }

        let d = `M ${p0.x * scale} ${p0.y * scale}`;
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i];
            d += ` L ${p.x * scale} ${p.y * scale}`;
        }
        d += ' Z';
        return d;
    },

    /** Converts primitives to SVG Path string. */
    _getDForVectorElement(el) {
        const tag = el.tagName.toLowerCase();
        const get = (a) => parseFloat(el.getAttribute(a)) || 0;

        if (tag === 'path') return el.getAttribute('d') || '';
        if (tag === 'rect') {
            const x = get('x'), y = get('y'), w = get('width'), h = get('height');
            return `M${x},${y} h${w} v${h} h${-w} z`;
        }
        if (tag === 'circle') {
            const cx = get('cx'), cy = get('cy'), r = get('r');
            return `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0 z`;
        }
        if (tag === 'ellipse') {
            const cx = get('cx'), cy = get('cy'), rx = get('rx'), ry = get('ry');
            return `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 z`;
        }
        if (tag === 'polygon' || tag === 'polyline') {
            const pts = el.getAttribute('points') || '';
            return 'M' + pts + (tag === 'polygon' ? ' z' : '');
        }
        return '';
    },

    /**
     * Apply a property (fill, stroke, etc.) to all elements in the active vector selection.
     */
    saveHistoryVector(label, opts) {
        if (this.mode !== 'vector') return;
        opts = opts || {};
        if (this._illuVectorPropHistoryTimer != null) {
            clearTimeout(this._illuVectorPropHistoryTimer);
            this._illuVectorPropHistoryTimer = null;
        }
        const styleLabels = new Set([
            'Style forme',
            'Propriétés vecteur',
            'Couleur vecteur',
            'Arrondi forme'
        ]);
        const lbl = label || 'Vecteur';
        const coalesceKey =
            opts.coalesceKey ||
            (opts.coalesce !== false && styleLabels.has(lbl) ? 'vector-style' : null);
        if (coalesceKey && this.historyIndex >= 0) {
            const last = this.history[this.historyIndex];
            if (last && last.mode === 'vector' && last._coalesceKey === coalesceKey) {
                this.disposeHistoryEntryData(last.data);
                this.history.pop();
                this.historyIndex--;
            }
        }
        this.saveHistory(lbl, { patchActiveLayer: true, coalesceKey });
    },

    applyVectorProperty(prop, value, opts) {
        opts = opts || {};
        const livePreview = !!opts.livePreview;
        if (!this.activeVectorSelection.length) return;
        
        this.activeVectorSelection.forEach(el => {
            if (
                typeof window.illuVectorIsEmbeddedBitmap === 'function' &&
                window.illuVectorIsEmbeddedBitmap(el) &&
                (prop === 'fill-model' || prop === 'fill' || prop === 'stroke' || prop === 'stroke-width')
            ) {
                return;
            }
            if (prop === 'fill-model') {
                const tagFill = (el.tagName || '').toLowerCase();
                if (tagFill === 'foreignobject') {
                    const div = el.querySelector('div[contenteditable]');
                    el.removeAttribute('fill');
                    if (!div) return;
                    if (value === 'none') {
                        div.style.color = 'transparent';
                    } else if (value === 'solid') {
                        const css =
                            typeof window.shapePrimaryFillCss === 'function'
                                ? window.shapePrimaryFillCss()
                                : this.cssRgbaFromPart(this.primaryColor);
                        div.style.color = css;
                    } else if (value === 'gradient') {
                        const css =
                            typeof window.shapePrimaryFillCss === 'function'
                                ? window.shapePrimaryFillCss()
                                : this.cssRgbaFromPart(this.primaryColor);
                        div.style.color = css;
                    }
                    return;
                }
                if (tagFill === 'text') {
                    if (value === 'solid' || value === 'gradient' || value === 'none') {
                        this.toolProps.textFillType = value;
                    }
                    if (typeof window.illuRefreshVectorElementPaint === 'function') {
                        window.illuRefreshVectorElementPaint(el);
                    } else {
                        if (value === 'none') el.setAttribute('fill', 'none');
                        else el.setAttribute('fill', this.activeColor);
                    }
                    return;
                }
                if (value === 'pattern') {
                    const defs = document.getElementById('vector-doc-defs');
                    const patCanv = window._illuFillPattern;
                    if (!defs || !patCanv) {
                        el.setAttribute('fill', this.activeColor);
                        return;
                    }
                    const cw = patCanv.width || 1;
                    const ch = patCanv.height || 1;
                    const patId = 'illu-pat-' + Date.now().toString(36);
                    const patEl = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
                    patEl.setAttribute('id', patId);
                    patEl.setAttribute('patternUnits', 'userSpaceOnUse');
                    patEl.setAttribute('width', String(cw));
                    patEl.setAttribute('height', String(ch));
                    const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                    imgEl.setAttribute('href', patCanv.toDataURL());
                    imgEl.setAttribute('width', String(cw));
                    imgEl.setAttribute('height', String(ch));
                    patEl.appendChild(imgEl);
                    defs.appendChild(patEl);
                    el.setAttribute('fill', `url(#${patId})`);
                } else {
                    if (value === 'solid' || value === 'gradient' || value === 'none') {
                        this.toolProps.fillType = value;
                    }
                    if (typeof window.illuRefreshVectorElementPaint === 'function') {
                        window.illuRefreshVectorElementPaint(el);
                    } else if (value === 'none') {
                        el.setAttribute('fill', 'none');
                    } else {
                        el.setAttribute('fill', this.activeColor);
                    }
                }
            } else if (prop === 'fill') {
                const tagFill = (el.tagName || '').toLowerCase();
                const v = value == null ? 'none' : String(value);
                if (tagFill === 'foreignobject') {
                    const div = el.querySelector('div[contenteditable]');
                    if (div) {
                        div.style.color = !v || v === 'none' ? 'transparent' : v;
                    }
                    return;
                }
                const gid = el.getAttribute('data-vgrad');
                if (gid) {
                    const node = document.getElementById(gid);
                    if (node && node.parentNode) node.remove();
                    el.removeAttribute('data-vgrad');
                }
                el.setAttribute('fill', !v || v === 'none' ? 'none' : v);
            } else if (prop === 'stroke') {
                const strokeVal = value == null ? '' : String(value);
                const tagFill = (el.tagName || '').toLowerCase();
                if (!strokeVal || strokeVal === 'none') {
                    el.setAttribute('stroke', 'none');
                    if (tagFill === 'text') this.toolProps.textStroke = false;
                } else {
                    el.setAttribute('stroke', strokeVal);
                    if (tagFill === 'text') this.toolProps.textStroke = true;
                    const sw0 = parseFloat(el.getAttribute('stroke-width') || '0');
                    if (!(sw0 > 0)) el.setAttribute('stroke-width', '1');
                }
            } else if (prop === 'stroke-width') {
                const w = Math.max(0, parseFloat(value) || 0);
                const tagFill = (el.tagName || '').toLowerCase();
                if (tagFill === 'text') {
                    this.toolProps.textStrokeWidth = Math.max(1, w || 1);
                    this.toolProps.textStroke = w > 0;
                } else {
                    this.toolProps.size = Math.max(1, w || 1);
                }
                if (typeof window.illuRefreshVectorElementPaint === 'function') {
                    window.illuRefreshVectorElementPaint(el);
                } else {
                    el.setAttribute('stroke-width', String(w));
                    if (w <= 0) {
                        el.setAttribute('stroke', 'none');
                    } else {
                        const cur = el.getAttribute('stroke');
                        if (!cur || cur === 'none') {
                            const strokeCss =
                                typeof window.shapePrimaryFillCss === 'function'
                                    ? window.shapePrimaryFillCss()
                                    : this.cssRgbaFromPart(this.primaryColor);
                            el.setAttribute('stroke', strokeCss);
                        }
                    }
                }
            } else if (prop === 'corner-radius') {
                const tag = (el.tagName || '').toLowerCase();
                const want = Math.max(0, parseFloat(value) || 0);
                if (tag === 'rect') {
                    const w = parseFloat(el.getAttribute('width')) || 0;
                    const h = parseFloat(el.getAttribute('height')) || 0;
                    const rr = Math.max(0, Math.min(w / 2, h / 2, want));
                    if (rr > 0.5) {
                        el.setAttribute('rx', String(rr));
                        el.setAttribute('ry', String(rr));
                        el.setAttribute('data-illu-round', '1');
                    } else {
                        el.removeAttribute('rx');
                        el.removeAttribute('ry');
                        el.removeAttribute('data-illu-round');
                    }
                } else if (tag === 'path' && el.getAttribute('data-illu-callout-style') != null) {
                    el.setAttribute('data-illu-callout-round', String(want));
                    if (typeof window.illuCalloutPathOptsFromShape === 'function') {
                        const style = el.getAttribute('data-illu-callout-style') || 'rect';
                        const cOpts = window.illuCalloutPathOptsFromShape(el);
                        if (typeof window.illuCalloutPathD === 'function') {
                            const bb = typeof window.illuGetElementBBox === 'function' 
                                ? window.illuGetElementBBox(el) 
                                : { x: 0, y: 0, width: 100, height: 100 };
                            if (bb && bb.width > 0) {
                                el.setAttribute('d', window.illuCalloutPathD(style, bb.x, bb.y, bb.width, bb.height, cOpts));
                            }
                        }
                    }
                }
            } else if (prop === 'font-family') {
                const tag = (el.tagName || '').toLowerCase();
                if (tag === 'text') {
                    el.setAttribute('font-family', String(value || 'Arial, sans-serif'));
                } else if (tag === 'foreignobject') {
                    try {
                        const div =
                            el.querySelector('div[contenteditable]') || el.querySelector('div');
                        if (div) div.style.fontFamily = String(value || 'Arial, sans-serif');
                    } catch (e) { /* ignore */ }
                }
            } else if (prop === 'font-size') {
                const fs = Math.max(1, parseFloat(value) || 12);
                const tag = (el.tagName || '').toLowerCase();
                if (tag === 'text') {
                    el.setAttribute('font-size', String(fs));
                } else if (tag === 'foreignobject') {
                    try {
                        const div =
                            el.querySelector('div[contenteditable]') || el.querySelector('div');
                        if (div) div.style.fontSize = `${fs}px`;
                    } catch (e) { /* ignore */ }
                }
            } else if (prop === 'opacity') {
                el.setAttribute('opacity', value);
            }
        });

        if (typeof window.syncVectorTextEditorStyles === 'function') window.syncVectorTextEditorStyles();
        const skipSync =
            livePreview ||
            opts.skipSyncSvg ||
            (this.mode === 'vector' && window._illuVectorDragActive);
        if (!skipSync && typeof this.syncActiveVectorSvg === 'function') {
            this.syncActiveVectorSvg();
        }
        if (!opts.skipRenderHistory && !livePreview) {
            if (this.mode === 'vector' && window._illuVectorDragActive) {
                /* sync + historique au mouseup */
            } else if (this.mode === 'vector') {
                if (this._illuVectorPropHistoryTimer != null) {
                    clearTimeout(this._illuVectorPropHistoryTimer);
                }
                const self = this;
                this._illuVectorPropHistoryTimer = window.setTimeout(() => {
                    self._illuVectorPropHistoryTimer = null;
                    self.saveHistoryVector('Propriétés vecteur');
                }, 400);
            } else {
                this.saveHistory('Propriétés vecteur', {
                    type: 'vector-full',
                    svg: this.activeProject ? this.activeProject.svgData : ''
                });
            }
        }
        if (livePreview) {
            if (typeof window.illuScheduleVectorShapeEditVisual === 'function') {
                window.illuScheduleVectorShapeEditVisual();
            } else if (typeof window.illuSyncVectorSelectionUI === 'function') {
                window.illuSyncVectorSelectionUI();
            }
        } else {
            this.render({ skipUiThumbnails: this.mode === 'vector' });
        }
        if (!livePreview && typeof window.updateToolOptionsBar === 'function') {
            window.updateToolOptionsBar();
        }
    },

    /** Apply SVG filter to active vector selection (for vector mode Effects) */
    applyVectorFilter(effectId, params, isPreview = false) {
        if (this.mode !== 'vector' || !this.activeVectorSelection.length) return;
        
        const defs = document.getElementById('vector-doc-defs');
        if (!defs) return;

        // Clean up previous preview filter
        if (this._lastVectorPreviewFilterId) {
            const oldF = document.getElementById(this._lastVectorPreviewFilterId);
            if (oldF) oldF.remove();
            this._lastVectorPreviewFilterId = null;
        }
        
        const fid = `fe-fx-${effectId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (isPreview) {
            this._lastVectorPreviewFilterId = fid;
        }
        const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        f.setAttribute('id', fid);
        f.setAttribute('x', '-50%');
        f.setAttribute('y', '-50%');
        f.setAttribute('width', '200%');
        f.setAttribute('height', '200%');
        
        let hasEffect = true;
        
        if (effectId === 'gaussian' || effectId === 'blur') {
            const rad = params && params['ef-rad'] != null ? params['ef-rad'] : 5;
            const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            fe.setAttribute('stdDeviation', String(rad));
            f.appendChild(fe);
        } else if (effectId === 'dropshadow') {
            const ox = params && params['ef-ds-ox'] != null ? params['ef-ds-ox'] : 4;
            const oy = params && params['ef-ds-oy'] != null ? params['ef-ds-oy'] : 5;
            const blur = params && params['ef-ds-blur'] != null ? params['ef-ds-blur'] : 3;
            const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
            fe.setAttribute('dx', String(ox));
            fe.setAttribute('dy', String(oy));
            fe.setAttribute('stdDeviation', String(blur));
            fe.setAttribute('flood-color', '#000000');
            fe.setAttribute('flood-opacity', '0.45');
            f.appendChild(fe);
        } else if (effectId === 'softglow') {
            const feMorph = document.createElementNS('http://www.w3.org/2000/svg', 'feMorphology');
            feMorph.setAttribute('operator', 'dilate');
            feMorph.setAttribute('radius', '3');
            feMorph.setAttribute('in', 'SourceAlpha');
            feMorph.setAttribute('result', 'thicken');
            
            const feBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            feBlur.setAttribute('in', 'thicken');
            feBlur.setAttribute('stdDeviation', '10');
            feBlur.setAttribute('result', 'blurred');
            
            const feFlood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
            feFlood.setAttribute('flood-color', '#fff');
            feFlood.setAttribute('result', 'glowColor');
            
            const feComp = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
            feComp.setAttribute('in', 'glowColor');
            feComp.setAttribute('in2', 'blurred');
            feComp.setAttribute('operator', 'in');
            feComp.setAttribute('result', 'softGlow_colored');
            
            const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
            const mn1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
            mn1.setAttribute('in', 'softGlow_colored');
            const mn2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
            mn2.setAttribute('in', 'SourceGraphic');
            feMerge.appendChild(mn1);
            feMerge.appendChild(mn2);
            
            f.appendChild(feMorph);
            f.appendChild(feBlur);
            f.appendChild(feFlood);
            f.appendChild(feComp);
            f.appendChild(feMerge);
        } else if (effectId === 'invert') {
            const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
            fe.setAttribute('type', 'matrix');
            fe.setAttribute('values', '-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0');
            f.appendChild(fe);
        } else if (effectId === 'grayscale') {
            const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
            fe.setAttribute('type', 'saturate');
            fe.setAttribute('values', '0');
            f.appendChild(fe);
        } else if (effectId === 'sepia') {
            const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
            fe.setAttribute('type', 'matrix');
            fe.setAttribute('values', '0.393 0.769 0.189 0 0  0.349 0.686 0.168 0 0  0.272 0.534 0.131 0 0  0 0 0 1 0');
            f.appendChild(fe);
        } else if (effectId === 'hue') {
            const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
            fe.setAttribute('type', 'hueRotate');
            fe.setAttribute('values', params && params['ef-h'] != null ? String(params['ef-h']) : '90');
            f.appendChild(fe);
        } else if (effectId === 'saturate') {
            const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
            fe.setAttribute('type', 'saturate');
            fe.setAttribute('values', params && params['ef-s'] != null ? String(params['ef-s']/100 + 1) : '2');
            f.appendChild(fe);
        } else {
            hasEffect = false;
        }

        if (hasEffect) {
            defs.appendChild(f);
            this.activeVectorSelection.forEach(el => {
                el.setAttribute('filter', `url(#${fid})`);
            });
            this.syncActiveVectorSvg();
            if (!isPreview) {
                this.saveHistory(`Effet vecteur (${effectId})`, { type: 'vector-full', svg: this.activeProject.svgData });
            }
            this.render();
        } else {
            // For boolean ops like autolevel that are pixel-only
            console.warn('Effect ' + effectId + ' is not implemented in vector mode.');
        }
    },

    /** Éléments vectoriels groupables (exclut calques, UI, racines d’import). */
    _vectorGroupableSelection() {
        return (this.activeVectorSelection || []).filter((el) => {
            if (!el || !el.isConnected) return false;
            if (el.closest && el.closest('#svg-ui')) return false;
            const id = el.id || '';
            if (/^layer-\d+$/.test(id) || id === 'illu-import-viewbox-root' || id === 'svg-layers') return false;
            const tag = (el.tagName || '').toLowerCase();
            if (tag === 'defs') return false;
            return true;
        });
    },

    /** Parent d’insertion commun pour un groupe (même calque, frères ou ancêtre commun). */
    _vectorGroupInsertParent(items) {
        if (!items.length) return null;
        const layerRoot = items[0].closest ? items[0].closest('[id^="layer-"]') : null;
        if (!layerRoot || !items.every((el) => layerRoot.contains(el))) return null;
        const parentSet = new Set(items.map((el) => el.parentElement));
        if (parentSet.size === 1) return items[0].parentElement;
        let lca = items[0];
        for (let i = 1; i < items.length; i++) {
            while (lca && !lca.contains(items[i])) lca = lca.parentElement;
        }
        if (!lca || lca === layerRoot || lca.id === 'svg-layers') return layerRoot;
        return lca;
    },

    _vectorInsertRefChild(parent, items) {
        const sorted = [...items].sort((a, b) =>
            a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );
        for (const child of parent.children) {
            if (sorted.some((el) => child === el || (child.contains && child.contains(el)))) return child;
        }
        return sorted[0];
    },

    /** Group currently selected vector elements into a <g>. */
    groupActiveVectorSelection() {
        if (this.mode !== 'vector') return;
        const items = this._vectorGroupableSelection();
        if (items.length < 2) return;

        const parent = this._vectorGroupInsertParent(items);
        if (!parent) {
            alert('Groupe impossible : sélectionnez au moins deux formes du même calque.');
            return;
        }

        const sorted = [...items].sort((a, b) =>
            a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('data-illu-group', '1');
        const ref = this._vectorInsertRefChild(parent, sorted);
        parent.insertBefore(g, ref);
        sorted.forEach((el) => g.appendChild(el));

        this.activeVectorSelection = [g];
        window._activeVectorShapeEl = g;
        if (window.VectorEngine && typeof window.VectorEngine.refreshSelectionUI === 'function') {
            window.VectorEngine.refreshSelectionUI();
        }
        this.syncActiveVectorSvg();
        this.saveHistory('Groupe vecteur', { type: 'vector-full', svg: this.activeProject.svgData });
        this.refreshVectorProjectTabThumbnails();
        this.render();
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    },

    /** Ungroup selected <g data-illu-group>. */
    ungroupActiveVectorSelection() {
        if (this.mode !== 'vector' || !this.activeVectorSelection.length) return;
        const groups = this.activeVectorSelection.filter((el) => {
            const tag = (el.tagName || '').toLowerCase();
            return tag === 'g' && el.getAttribute('data-illu-group') === '1';
        });
        if (!groups.length) return;

        const children = [];
        groups.forEach((grp) => {
            const parent = grp.parentElement;
            if (!parent) return;
            [...grp.children].forEach((ch) => {
                if (ch.nodeType !== 1) return;
                parent.insertBefore(ch, grp);
                children.push(ch);
            });
            parent.removeChild(grp);
        });

        this.activeVectorSelection = children;
        window._activeVectorShapeEl = children[children.length - 1] || null;
        if (window.VectorEngine && typeof window.VectorEngine.refreshSelectionUI === 'function') {
            window.VectorEngine.refreshSelectionUI();
        }
        this.syncActiveVectorSvg();
        this.saveHistory('Dégrouper vecteur', { type: 'vector-full', svg: this.activeProject.svgData });
        this.refreshVectorProjectTabThumbnails();
        this.render();
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    },

    deleteActiveVectorSelection() {
        if (!this.activeVectorSelection.length) return;
        this.activeVectorSelection.forEach(el => {
            if (el.parentElement) el.parentElement.removeChild(el);
        });
        this.activeVectorSelection = [];
        this.saveHistory('Suppression vecteur', { type: 'vector-full', svg: this.activeProject.svgData });
        this.render();
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    },

    duplicateActiveVectorSelection() {
        if (!this.activeVectorSelection.length) return;
        const newSelection = [];
        this.activeVectorSelection.forEach(el => {
            const clone = el.cloneNode(true);
            // Offset slightly
            const tag = (clone.tagName || '').toLowerCase();
            if (['rect', 'text', 'foreignObject'].includes(tag)) {
                clone.setAttribute('x', String((parseFloat(clone.getAttribute('x')) || 0) + 10));
                clone.setAttribute('y', String((parseFloat(clone.getAttribute('y')) || 0) + 10));
            } else if (['circle', 'ellipse'].includes(tag)) {
                clone.setAttribute('cx', String((parseFloat(clone.getAttribute('cx')) || 0) + 10));
                clone.setAttribute('cy', String((parseFloat(clone.getAttribute('cy')) || 0) + 10));
            } else {
                const tr = clone.getAttribute('transform') || '';
                clone.setAttribute('transform', `${tr} translate(10,10)`.trim());
            }
            el.parentElement.appendChild(clone);
            newSelection.push(clone);
        });
        this.activeVectorSelection = newSelection;
        this.saveHistory('Duplication vecteur', { type: 'vector-full', svg: this.activeProject.svgData });
        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        this.render();
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    }
};

window.EditorManager = EditorManager;

window.pushHistory = function(label) {
    if (window.EditorManager) {
        window.EditorManager.saveHistory(label, { patchActiveLayer: true });
    }
};

