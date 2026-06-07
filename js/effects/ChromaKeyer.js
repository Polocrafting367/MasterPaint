/**
 * ChromaKeyer.js
 * Includes CIELAB perceptual color selection, spill suppression, and matte refinement.
 */

(function (scope) {
    const ChromaKeyer = {
        /** CIELAB / XYZ constants */
        LAB_K: 24389 / 27,
        LAB_E: 216 / 24389,

        /** Converts RGB to CIELAB for perceptual distance calculation */
        rgbToLab: function (r, g, b) {
            let rL = r / 255, gL = g / 255, bL = b / 255;
            rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
            gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
            bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;

            let x = rL * 0.4124 + gL * 0.3576 + bL * 0.1805;
            let y = rL * 0.2126 + gL * 0.7152 + bL * 0.0722;
            let z = rL * 0.0193 + gL * 0.1192 + bL * 0.9505;

            x /= 0.95047; // Observer= 2°, Illuminant= D65
            y /= 1.00000;
            z /= 1.08883;

            const f = (t) => t > this.LAB_E ? Math.pow(t, 1 / 3) : (this.LAB_K * t + 16) / 116;
            const fx = f(x), fy = f(y), fz = f(z);

            return [
                116 * fy - 16,        // L
                500 * (fx - fy),      // a
                200 * (fy - fz)       // b
            ];
        },

        /** Core calculation of the matte (transparency factor 0-1) */
        computeMatte: function (pr, pg, pb, kr, kg, kb, params) {
            const labP = this.rgbToLab(pr, pg, pb);
            const labK = this.rgbToLab(kr, kg, kb);

            // Perceptual distance
            let dL = labP[0] - labK[0];
            const da = labP[1] - labK[1];
            const db = labP[2] - labK[2];
            
            const lumaProt = params.lumaProt || 0;
            if (lumaProt > 0) {
                if (dL > 0 && labP[0] > 60) {
                     // Pixel est plus clair que la clé, et approche du blanc absolu
                     const f = Math.pow((labP[0] - 60) / 40, 2); // 0 to 1 non-linéaire
                     dL += dL * f * (lumaProt / 5); // Augmente virtuellement la distance pour excéder la tolérance
                } else if (dL < 0 && labP[0] < 40) {
                     // Pixel est plus sombre que la clé, et approche du noir absolu
                     const f = Math.pow((40 - labP[0]) / 40, 2);
                     dL -= Math.abs(dL) * f * (lumaProt / 5);
                }
            }

            const chromaWeight = (params.drift || 50) / 100;
            const dist = Math.sqrt(dL * dL * (1 - chromaWeight) + (da * da + db * db) * (1 + chromaWeight));

            const totalTol = params.tolerance || 30;
            const feather = params.feather || 15;

            let matte = 1.0;
            if (dist <= totalTol) {
                matte = 0.0;
            } else if (feather > 0 && dist < totalTol + feather) {
                // Lissage (smoothstep) pour une transition plus douce au lieu d'une courbe linéaire
                let t = (dist - totalTol) / feather;
                matte = t * t * (3 - 2 * t); 
            }

            // Matte Refinement (Clip Black / White)
            const clipBlack = Math.max(0, (params.clipBlack || 0) / 100);
            const clipWhite = Math.min(1, (params.clipWhite || 100) / 100);
            const gamma = Math.max(0.1, params.gamma || 1.0); // Sécurise la division par zéro

            if (matte < clipBlack) matte = 0;
            else if (matte > clipWhite) matte = 1;
            else if (clipWhite > clipBlack) {
                matte = (matte - clipBlack) / (clipWhite - clipBlack);
            }

            if (gamma !== 1.0 && matte > 0 && matte < 1) {
                matte = Math.pow(matte, 1 / gamma);
            }

            return Math.max(0, Math.min(1, matte)); // Clamp strict final
        },

        /** Neutralizes the color spill (green/blue bounce) on subject edges */
        applyDespill: function (r, g, b, kr, kg, kb, intensity) {
            if (intensity <= 0) return [r, g, b];
            const factor = intensity / 100;

            if (kg > kr && kg > kb) { 
                const maxRB = Math.max(r, b);
                if (g > maxRB) {
                    return [r, maxRB + (g - maxRB) * (1 - factor), b];
                }
            } else if (kb > kr && kb > kg) { 
                const maxRG = Math.max(r, g);
                if (b > maxRG) {
                    return [r, g, maxRG + (b - maxRG) * (1 - factor)];
                }
            }
            return [r, g, b];
        },

        /** Un-mix the background color from semi-transparent foreground pixels (Color Recovery/Decontamination) */
        applyUnmix: function (r, g, b, kr, kg, kb, matte, intensity) {
            if (intensity <= 0 || matte >= 1.0 || matte <= 0.0) return [r, g, b];
            const factor = intensity / 100;
            const m = Math.max(0.05, matte); // avoid division by near-zero causing extreme noise
            const ur = Math.min(255, Math.max(0, (r - kr * (1 - matte)) / m));
            const ug = Math.min(255, Math.max(0, (g - kg * (1 - matte)) / m));
            const ub = Math.min(255, Math.max(0, (b - kb * (1 - matte)) / m));
            
            return [
                r * (1 - factor) + ur * factor,
                g * (1 - factor) + ug * factor,
                b * (1 - factor) + ub * factor
            ];
        },

        /** Applique un groupe de réglages prédéfinis de manière dynamique via la couleur et l'image */
        applyPreset: function (name) {
            let kr = 0, kg = 255, kb = 0;
            const er = document.getElementById('ef-ch-r');
            if (er) {
                kr = parseInt(er.value || 0, 10);
                kg = parseInt(document.getElementById('ef-ch-g').value || 0, 10);
                kb = parseInt(document.getElementById('ef-ch-b').value || 0, 10);
            }

            // --- 1. Analyse de la couleur ciblée ---
            const labK = this.rgbToLab(kr, kg, kb);
            const cL = labK[0], ca = labK[1], cb = labK[2];
            const chromaSat = Math.sqrt(ca * ca + cb * cb);
            
            // Si la couleur est achromatique (blanc, gris, noir), la suppression de déversement (spill) perd son sens
            const cSpill = (chromaSat > 15 && cL > 15) ? 100 : 0;
            const cDrift = (chromaSat > 30) ? 60 : 100; // tolérer plus la dérive chroma si la couleur est saturée
            
            // --- 2. Analyse basique de l'image (Background cluster variance) ---
            let bgMaxDist = 20; // fallback standard
            if (window.FilterManager && window.FilterManager.originalImageData) {
                try {
                    const data = window.FilterManager.originalImageData.data;
                    const len = data.length;
                    const step = Math.max(4, Math.floor(len / 8000) * 4);
                    const distances = [];
                    for (let i = 0; i < len; i += step) {
                        const l = this.rgbToLab(data[i], data[i+1], data[i+2]);
                        const d = Math.sqrt(Math.pow(l[0]-cL, 2) + Math.pow(l[1]-ca, 2) + Math.pow(l[2]-cb, 2));
                        distances.push(d);
                    }
                    distances.sort((a, b) => a - b);
                    // On estime que la clé (le fond) couvre au moins 10% des pixels
                    bgMaxDist = distances[Math.floor(distances.length * 0.10)];
                } catch(e) {}
            }

            let baseTol = 30;
            let baseFeather = 15;
            
            if (bgMaxDist < 5) {
                // Fond très uni (infographie)
                baseTol = Math.max(2, Math.round(bgMaxDist) + 2);
                baseFeather = 15;
            } else if (bgMaxDist < 25) {
                // Fond modérément bruité (studio propre)
                baseTol = Math.max(10, Math.round(bgMaxDist));
                baseFeather = 40;
            } else {
                // Fond complexe, dégradé fort, nuances
                baseTol = 5;
                baseFeather = Math.min(100, Math.round(bgMaxDist) + 30);
            }

            // --- 3. Définition adaptative ---
            let p = {};
            switch (name) {
                case 'default':
                    p = { tol: baseTol, feather: baseFeather, drift: cDrift, black: 10, white: 95, spill: cSpill, recover: 0, luma: 0, gamma: 1.0 };
                    break;
                case 'soft':
                    p = { tol: Math.max(1, baseTol - 10), feather: Math.min(100, baseFeather * 1.8), drift: cDrift, black: 5, white: 90, spill: cSpill, recover: 80, luma: 40, gamma: 1.3 };
                    break;
                case 'hard':
                    p = { tol: baseTol + Math.round(baseFeather/2), feather: 5, drift: cDrift, black: 30, white: 70, spill: Math.round(cSpill/2), recover: 0, luma: 0, gamma: 1.0 };
                    break;
                case 'shadow':
                    // Le favori absolu : pure incrustation de type gradient intégral
                    p = { tol: 1, feather: 100, drift: 100, black: 0, white: 85, spill: cSpill, recover: 100, luma: 80, gamma: 1.9 };
                    break;
                case 'glass':
                    // Récupération parfaite des reflets (plastique, verre) et ombres via l'unmix mathématique
                    p = { tol: 1, feather: 100, drift: 100, black: 0, white: 100, spill: 0, recover: 100, luma: 0, gamma: 1.0 };
                    break;
                case 'despill':
                    // Nettoyage extrême du pourtour, tolérance brute
                    p = { tol: baseTol, feather: 15, drift: 50, black: 5, white: 95, spill: 100, recover: 0, luma: 0, gamma: 1.0 };
                    break;
            }
            if (!p.tol && p.tol !== 0) return;

            const setVal = (id, val) => {
                const el = document.getElementById('ef-ch-' + id);
                if (el) el.value = val;
            };

            setVal('tol', p.tol);
            setVal('feather', p.feather);
            setVal('drift', p.drift);
            setVal('black', p.black);
            setVal('white', p.white);
            setVal('spill', p.spill);
            setVal('recover', p.recover);
            setVal('luma', p.luma);
            setVal('gamma', p.gamma);

            // Force la mise à jour de l'UI et déclenche le rendu en Live Preview
            this.syncUI(false); 
        },

        /** Returns the HTML template for the redesigned Incrustation dialog */
        getUI: function (i18n, currentValues = {}) {
            const t = (k, fb) => i18n ? (i18n.t ? i18n.t(k) : i18n(k)) : fb;

            return `
            <div class="chromakey-pro-dialog" style="font-size:11px; line-height:1.4;">
                <p style="margin:0 0 8px; color:#444;">${t('chroma.desc', 'Module d\'incrustation haute précision avec moteur CIELAB.')}</p>
                
                <!-- BOUTONS DE PRÉRÉGLAGES -->
                <div style="display:flex; gap:4px; margin-bottom:10px; flex-wrap:wrap;">
                    <button type="button" class="tool-btn" style="flex:1; padding:4px 0; min-width:40px; font-size:10px;" onclick="ChromaKeyer.applyPreset('default')">${t('chroma.presetDefault', 'Défaut')}</button>
                    <button type="button" class="tool-btn" style="flex:1; padding:4px 0; min-width:40px; font-size:10px;" onclick="ChromaKeyer.applyPreset('soft')">${t('chroma.presetSoft', 'Doux')}</button>
                    <button type="button" class="tool-btn" style="flex:1; padding:4px 0; min-width:40px; font-size:10px;" onclick="ChromaKeyer.applyPreset('hard')">${t('chroma.presetHard', 'Fort')}</button>
                    <button type="button" class="tool-btn" style="flex:1; padding:4px 0; min-width:40px; font-size:10px;" onclick="ChromaKeyer.applyPreset('shadow')">${t('chroma.presetShadow', 'Ombres')}</button>
                    <button type="button" class="tool-btn" style="flex:1; padding:4px 0; min-width:40px; font-size:10px;" onclick="ChromaKeyer.applyPreset('glass')">${t('chroma.presetGlass', 'Verre')}</button>
                    <button type="button" class="tool-btn" style="flex:1; padding:4px 0; min-width:40px; font-size:10px;" onclick="ChromaKeyer.applyPreset('despill')">${t('chroma.presetDespill', 'Spill')}</button>
                </div>

                <fieldset style="margin-bottom:10px; padding:8px; border:1px solid #ccc; border-radius:2px;">
                    <legend style="font-weight:bold; padding:0 4px;">${t('chroma.groupSelection', '1. Sélection de la cible')}</legend>
                    <div class="field-row" style="align-items:center; gap:8px;">
                        <span id="ef-ch-swatch" style="width:32px; height:24px; border:1px solid #666; background:rgb(0,255,0); display:inline-block;"></span>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <label>R</label><input type="number" id="ef-ch-r" min="0" max="255" value="${currentValues.r || 0}" style="width:40px;" oninput="ChromaKeyer.syncUI()">
                            <label>V</label><input type="number" id="ef-ch-g" min="0" max="255" value="${currentValues.g || 255}" style="width:40px;" oninput="ChromaKeyer.syncUI()">
                            <label>B</label><input type="number" id="ef-ch-b" min="0" max="255" value="${currentValues.b || 0}" style="width:40px;" oninput="ChromaKeyer.syncUI()">
                        </div>
                        <button type="button" id="ef-ch-pick-btn" class="tool-btn" style="padding:2px 8px;">${t('chroma.pipette', 'Pipette')}</button>
                    </div>
                </fieldset>

                <fieldset style="margin-bottom:10px; padding:8px; border:1px solid #ccc; border-radius:2px;">
                    <legend style="font-weight:bold; padding:0 4px;">${t('chroma.groupMatte', '2. Affinage du masque')}</legend>
                    <div class="field-row">
                        <label style="width:80px;">${t('chroma.tolerance', 'Tolérance')}</label>
                        <input type="range" id="ef-ch-tol" min="0" max="200" value="30" style="flex:1;" oninput="ChromaKeyer.syncUI()">
                        <span id="ef-ch-tol-val" style="width:30px; text-align:right;">30</span>
                    </div>
                    <div class="field-row">
                        <label style="width:80px;">${t('chroma.feather', 'Transition')}</label>
                        <input type="range" id="ef-ch-feather" min="0" max="100" value="15" style="flex:1;" oninput="ChromaKeyer.syncUI()">
                        <span id="ef-ch-feather-val" style="width:30px; text-align:right;">15</span>
                    </div>
                    <div class="field-row">
                        <label style="width:80px;">${t('chroma.drift', 'Précision')}</label>
                        <input type="range" id="ef-ch-drift" min="0" max="100" value="50" style="flex:1;" oninput="ChromaKeyer.syncUI()">
                        <span id="ef-ch-drift-val" style="width:30px; text-align:right;">50</span>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; padding-top:8px; border-top:1px dashed #ccc;">
                        <div>
                            <label style="display:block; font-size:9px;">${t('chroma.clipBlack', 'Clip Noir')}</label>
                            <input type="range" id="ef-ch-black" min="0" max="100" value="0" style="width:100%;" oninput="ChromaKeyer.syncUI()">
                        </div>
                        <div>
                            <label style="display:block; font-size:9px;">${t('chroma.clipWhite', 'Clip Blanc')}</label>
                            <input type="range" id="ef-ch-white" min="0" max="100" value="100" style="width:100%;" oninput="ChromaKeyer.syncUI()">
                        </div>
                    </div>
                </fieldset>

                <fieldset style="margin-bottom:10px; padding:8px; border:1px solid #ccc; border-radius:2px;">
                    <legend style="font-weight:bold; padding:0 4px;">${t('chroma.groupEdge', '3. Bords, Luma et Spill')}</legend>
                    <div class="field-row">
                        <label style="width:80px;">${t('chroma.lumaProt', 'Protég. Luma')}</label>
                        <input type="range" id="ef-ch-luma" min="0" max="100" value="0" style="flex:1;" oninput="ChromaKeyer.syncUI()">
                        <span id="ef-ch-luma-val" style="width:30px; text-align:right;">0%</span>
                    </div>
                    <div class="field-row" style="margin-top:4px;">
                        <label style="width:80px;">${t('chroma.recover', 'Récupérer Coul.')}</label>
                        <input type="range" id="ef-ch-recover" min="0" max="100" value="0" style="flex:1;" oninput="ChromaKeyer.syncUI()">
                        <span id="ef-ch-recover-val" style="width:30px; text-align:right;">0%</span>
                    </div>
                    <div class="field-row" style="margin-top:4px;">
                        <label style="width:80px;">${t('chroma.spill', 'Despill')}</label>
                        <input type="range" id="ef-ch-spill" min="0" max="100" value="0" style="flex:1;" oninput="ChromaKeyer.syncUI()">
                        <span id="ef-ch-spill-val" style="width:30px; text-align:right;">0%</span>
                    </div>
                    <div class="field-row" style="margin-top:4px;">
                        <label style="width:80px;">${t('chroma.gamma', 'Contraste α')}</label>
                        <input type="range" id="ef-ch-gamma" min="0.1" max="3" step="0.1" value="1.0" style="flex:1;" oninput="ChromaKeyer.syncUI()">
                        <span id="ef-ch-gamma-val" style="width:30px; text-align:right;">1.0</span>
                    </div>
                </fieldset>

                <div style="margin-top:10px; display:flex; gap:8px;">
                    <button type="button" id="ef-ch-apply-mask-btn" style="flex:1; height:28px; font-weight:bold;">${t('chroma.applyAsMask', 'Appliquer en masque alpha lié')}</button>
                </div>
            </div>
            `;
        },

        _previewTimeout: null,

        /** Helper to sync UI sliders to their labels and trigger preview */
        syncUI: function (skipPreview = false) {
            const ids = ['tol', 'feather', 'drift', 'black', 'white', 'spill', 'recover', 'luma', 'gamma'];
            ids.forEach(id => {
                const el = document.getElementById('ef-ch-' + id);
                const val = document.getElementById('ef-ch-' + id + '-val');
                if (el && val) {
                    val.innerText = (id === 'spill' || id === 'recover' || id === 'luma') ? el.value + '%' : el.value;
                }
            });
            
            const r = document.getElementById('ef-ch-r')?.value || 0;
            const g = document.getElementById('ef-ch-g')?.value || 0;
            const b = document.getElementById('ef-ch-b')?.value || 0;
            const swatch = document.getElementById('ef-ch-swatch');
            if (swatch) swatch.style.background = `rgb(${r},${g},${b})`;

            // On empêche le rendu si la pipette est active ou si on force le saut
            if (skipPreview || window._chromaKeyPickActive) return;

            // Debounce : on attend 30ms pour éviter de faire ramer l'ordinateur pendant qu'on glisse le slider
            if (this._previewTimeout) clearTimeout(this._previewTimeout);
            this._previewTimeout = setTimeout(() => {
                if (window.FilterManager && window.FilterManager.preview) {
                    window.FilterManager.preview();
                }
            }, 30);
        }
    };

    // Export to global scope
    scope.ChromaKeyer = ChromaKeyer;
})(typeof self !== 'undefined' ? self : window);