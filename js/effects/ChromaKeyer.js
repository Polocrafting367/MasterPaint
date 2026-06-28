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

            // Cache des Lab des couleurs-clés sur l'objet params : évite de recalculer
            // rgbToLab(clé) à chaque pixel (gros gain de perf sur une image entière).
            if (!params._labK) params._labK = this.rgbToLab(kr, kg, kb);
            const labK = params._labK;

            const chromaWeight = (params.drift || 50) / 100;
            const wL = 1 - chromaWeight;   // poids de la composante luminance
            const wC = 1 + chromaWeight;   // poids des composantes chroma (a,b)

            // --- Point-clé de référence ---
            // Mode 2 couleurs : on mesure la distance au SEGMENT [A → B] dans l'espace Lab
            // (pondéré par drift). On capture ainsi tout un dégradé de fond sans gonfler
            // le rayon de tolérance, ce qui affine fortement le détourage.
            let Kc = labK;
            const useKey2 = params.useKey2 && params.kr2 !== undefined && params.kr2 !== null;
            if (useKey2) {
                if (!params._labK2) params._labK2 = this.rgbToLab(params.kr2, params.kg2, params.kb2);
                const labK2 = params._labK2;
                // Vecteur du segment et projection pondérée de P sur [A,B]
                const eL = labK2[0] - labK[0];
                const ea = labK2[1] - labK[1];
                const eb = labK2[2] - labK[2];
                const segLen = wL * eL * eL + wC * (ea * ea + eb * eb);
                if (segLen > 1e-6) {
                    const pL = labP[0] - labK[0];
                    const pa = labP[1] - labK[1];
                    const pb2 = labP[2] - labK[2];
                    let t = (wL * pL * eL + wC * (pa * ea + pb2 * eb)) / segLen;
                    if (t < 0) t = 0; else if (t > 1) t = 1;
                    Kc = [labK[0] + t * eL, labK[1] + t * ea, labK[2] + t * eb];
                }
            }

            // Perceptual distance vers le point-clé le plus proche
            let dL = labP[0] - Kc[0];
            const da = labP[1] - Kc[1];
            const db = labP[2] - Kc[2];

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

            const dist = Math.sqrt(dL * dL * wL + (da * da + db * db) * wC);

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

            // Génère une ligne « slider + boîte éditable » (les deux restent synchronisés).
            // L'id de la boîte reste `${id}-val` pour rester compatible avec la persistance/restauration.
            const row = (id, label, min, max, value, step, unit) => `
                <div class="field-row" style="align-items:center; gap:6px;">
                    <label style="width:92px;">${label}</label>
                    <input type="range" id="ef-ch-${id}" min="${min}" max="${max}" step="${step || 1}" value="${value}" style="flex:1;" oninput="ChromaKeyer.syncUI()">
                    <input type="number" id="ef-ch-${id}-val" min="${min}" max="${max}" step="${step || 1}" value="${value}" style="width:48px; text-align:right;" oninput="ChromaKeyer.fromBox('${id}')">
                    ${unit ? `<span style="width:10px; color:#777;">${unit}</span>` : '<span style="width:10px;"></span>'}
                </div>`;

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
                    <legend style="font-weight:bold; padding:0 4px;">${t('chroma.groupSelection', '1. Couleurs cibles')}</legend>
                    <!-- Couleur A -->
                    <div class="field-row" style="align-items:center; gap:8px;">
                        <span id="ef-ch-swatch" style="width:30px; height:24px; border:1px solid #666; background:rgb(0,255,0); display:inline-block;"></span>
                        <label style="width:14px; font-weight:bold;">A</label>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <label>R</label><input type="number" id="ef-ch-r" min="0" max="255" value="${currentValues.r || 0}" style="width:40px;" oninput="ChromaKeyer.syncUI()">
                            <label>V</label><input type="number" id="ef-ch-g" min="0" max="255" value="${currentValues.g || 255}" style="width:40px;" oninput="ChromaKeyer.syncUI()">
                            <label>B</label><input type="number" id="ef-ch-b" min="0" max="255" value="${currentValues.b || 0}" style="width:40px;" oninput="ChromaKeyer.syncUI()">
                        </div>
                        <button type="button" id="ef-ch-pick-btn" class="tool-btn" style="padding:2px 8px;">${t('chroma.pipette', 'Pipette')}</button>
                    </div>
                    <!-- Activation 2ᵉ couleur -->
                    <div class="field-row" style="align-items:center; gap:6px; margin-top:6px; padding-top:6px; border-top:1px dashed #ccc;">
                        <input type="checkbox" id="ef-ch-use2" style="margin:0;" onchange="ChromaKeyer.syncUI()">
                        <label for="ef-ch-use2" style="cursor:pointer; color:#333;">${t('chroma.useKey2', '2ᵉ couleur (affine le dégradé de fond)')}</label>
                    </div>
                    <!-- Couleur B -->
                    <div class="field-row" id="ef-ch-rowB" style="align-items:center; gap:8px; margin-top:4px;">
                        <span id="ef-ch-swatch2" style="width:30px; height:24px; border:1px solid #666; background:rgb(0,180,0); display:inline-block;"></span>
                        <label style="width:14px; font-weight:bold;">B</label>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <label>R</label><input type="number" id="ef-ch-r2" min="0" max="255" value="0" style="width:40px;" oninput="ChromaKeyer.syncUI()">
                            <label>V</label><input type="number" id="ef-ch-g2" min="0" max="255" value="180" style="width:40px;" oninput="ChromaKeyer.syncUI()">
                            <label>B</label><input type="number" id="ef-ch-b2" min="0" max="255" value="0" style="width:40px;" oninput="ChromaKeyer.syncUI()">
                        </div>
                        <button type="button" id="ef-ch-pick-btn2" class="tool-btn" style="padding:2px 8px;">${t('chroma.pipette', 'Pipette')}</button>
                    </div>
                </fieldset>

                <fieldset style="margin-bottom:10px; padding:8px; border:1px solid #ccc; border-radius:2px;">
                    <legend style="font-weight:bold; padding:0 4px;">${t('chroma.groupMatte', '2. Masque (sélection)')}</legend>
                    ${row('tol', t('chroma.tolerance', 'Tolérance'), 0, 200, 30, 0.5)}
                    ${row('feather', t('chroma.feather', 'Transition'), 0, 100, 15, 0.5)}
                    ${row('drift', t('chroma.drift', 'Chroma / Luma'), 0, 100, 50, 1)}
                </fieldset>

                <fieldset style="margin-bottom:10px; padding:8px; border:1px solid #ccc; border-radius:2px;">
                    <legend style="font-weight:bold; padding:0 4px;">${t('chroma.groupDensity', '3. Densité du masque')}</legend>
                    ${row('black', t('chroma.clipBlack', 'Clip Noir'), 0, 100, 0, 1, '%')}
                    ${row('white', t('chroma.clipWhite', 'Clip Blanc'), 0, 100, 100, 1, '%')}
                    ${row('gamma', t('chroma.gamma', 'Contraste α'), 0.1, 3, 1.0, 0.05)}
                </fieldset>

                <fieldset style="margin-bottom:10px; padding:8px; border:1px solid #ccc; border-radius:2px;">
                    <legend style="font-weight:bold; padding:0 4px;">${t('chroma.groupEdge', '4. Bords & couleur')}</legend>
                    ${row('luma', t('chroma.lumaProt', 'Protég. Luma'), 0, 100, 0, 1, '%')}
                    ${row('recover', t('chroma.recover', 'Récup. Coul.'), 0, 100, 0, 1, '%')}
                    ${row('spill', t('chroma.spill', 'Despill'), 0, 100, 0, 1, '%')}
                </fieldset>

                <div style="margin-top:10px; display:flex; gap:8px;">
                    <button type="button" id="ef-ch-apply-mask-btn" style="flex:1; height:28px; font-weight:bold;">${t('chroma.applyAsMask', 'Appliquer en masque alpha lié')}</button>
                </div>
            </div>
            `;
        },

        _previewTimeout: null,

        /** Sliders réglables : recopie la valeur du slider dans sa boîte éditable */
        SLIDER_IDS: ['tol', 'feather', 'drift', 'black', 'white', 'spill', 'recover', 'luma', 'gamma'],

        /** Saisie manuelle dans une boîte numérique : recopie (en bornant) vers le slider */
        fromBox: function (id) {
            const slider = document.getElementById('ef-ch-' + id);
            const box = document.getElementById('ef-ch-' + id + '-val');
            if (!slider || !box) return;
            let v = parseFloat(box.value);
            if (!isFinite(v)) return; // laisse l'utilisateur finir de taper (champ vide / « - »)
            const min = parseFloat(slider.min), max = parseFloat(slider.max);
            if (v < min) v = min; else if (v > max) v = max;
            slider.value = v;
            this.syncUI();
        },

        /** Helper to sync UI sliders to their boxes/swatches and trigger preview */
        syncUI: function (skipPreview = false) {
            this.SLIDER_IDS.forEach(id => {
                const el = document.getElementById('ef-ch-' + id);
                const box = document.getElementById('ef-ch-' + id + '-val');
                // On ne réécrit pas la boîte qui a le focus (sinon on perturbe la frappe)
                if (el && box && document.activeElement !== box) box.value = el.value;
            });

            const r = document.getElementById('ef-ch-r')?.value || 0;
            const g = document.getElementById('ef-ch-g')?.value || 0;
            const b = document.getElementById('ef-ch-b')?.value || 0;
            const swatch = document.getElementById('ef-ch-swatch');
            if (swatch) swatch.style.background = `rgb(${r},${g},${b})`;

            // Couleur B : pastille + griser la ligne quand la 2ᵉ couleur est désactivée
            const use2 = document.getElementById('ef-ch-use2')?.checked;
            const r2 = document.getElementById('ef-ch-r2')?.value || 0;
            const g2 = document.getElementById('ef-ch-g2')?.value || 0;
            const b2 = document.getElementById('ef-ch-b2')?.value || 0;
            const swatch2 = document.getElementById('ef-ch-swatch2');
            if (swatch2) swatch2.style.background = `rgb(${r2},${g2},${b2})`;
            const rowB = document.getElementById('ef-ch-rowB');
            if (rowB) {
                rowB.style.opacity = use2 ? '1' : '0.4';
                rowB.style.pointerEvents = use2 ? 'auto' : 'none';
            }

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