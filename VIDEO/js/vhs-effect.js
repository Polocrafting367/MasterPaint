/** Traitement image VHS (pixels RGBA). effectTime = temps en secondes pour animations (glitch, jitter). */
function process_hybrid_heisei(buffer, width, height, paramsJsonStr, effectTime = 0) {
    const params = JSON.parse(paramsJsonStr);
    const data = buffer; 
    const out = new Uint8Array(data.length);
    const w = width; const h = height;

    const bleedRaw = params.chroma_bleed !== undefined ? params.chroma_bleed : 12;
    let bleed = 0; if (bleedRaw > 0) bleed = 1.0 - Math.pow(10, -(bleedRaw / 30)); 

    const blurRadius = params.chroma_blur !== undefined ? params.chroma_blur : 25;
    const chromaSatBase = params.chroma_saturation !== undefined ? params.chroma_saturation : 2.4;
    const edgeSat = params.edge_sat !== undefined ? params.edge_sat : 4.8;
    const shadowSat = params.shadow_sat !== undefined ? params.shadow_sat : 0;
    const hsSat = params.hs_sat !== undefined ? params.hs_sat : 0;
    
    const phaseRad = (params.chroma_phase || 0) * (Math.PI / 180);
    const cosP = Math.cos(phaseRad); const sinP = Math.sin(phaseRad);
    
    const shiftY = params.shift_y !== undefined ? params.shift_y : 0;
    const shiftR = params.shift_r !== undefined ? params.shift_r : -13;
    const shiftG = params.shift_g !== undefined ? params.shift_g : 8;
    const shiftB = params.shift_b !== undefined ? params.shift_b : 6;
    
    const crop = params.crop_padding !== undefined ? params.crop_padding : 6;
    const feather = params.crop_feather !== undefined ? params.crop_feather : 4.0; 
    const hsFreq = params.head_switch_freq !== undefined ? params.head_switch_freq : 0.52;

    const pixelSize = params.pixel_size !== undefined ? params.pixel_size : 1;
    const lumaContrast = params.luma_contrast !== undefined ? params.luma_contrast : 1.0;
    const lumaBrightness = params.luma_brightness !== undefined ? params.luma_brightness : 0;
    
    const lumaSmearRaw = params.luma_smear !== undefined ? params.luma_smear : 0;
    const lumaSmear = lumaSmearRaw > 0 ? (lumaSmearRaw / 100.0) : 0;
    const rightPinkRaw = params.right_pink !== undefined ? params.right_pink : 0;
    const rightPink = rightPinkRaw / 100.0;
    const rightPinkWidth = params.right_pink_width !== undefined ? params.right_pink_width : 0.4;

    // Global Glitch Logic
    let isGlitching = false;
    let glitchMultiplier = 0;
    if (params.glitch_intensity > 0) {
        let glitchSeed = Math.floor(timeOffset * 10.0);
        let randVal = Math.abs(Math.sin(glitchSeed * 12.9898) * 43758.5453) % 1;
        if (randVal > (1.0 - (params.glitch_intensity / 15.0))) {
            isGlitching = true;
            glitchMultiplier = params.glitch_intensity / 5.0;
        }
    }

    const hsWave = params.head_switch_wave !== undefined ? params.head_switch_wave : 0.5;
    const hsNoiseAmt = params.head_switch_noise !== undefined ? params.head_switch_noise : 0;
    const hsColorTear = params.hs_color_tear !== undefined ? params.hs_color_tear : 0;
    const tearMaxHeight = params.tear_max_height !== undefined ? params.tear_max_height / 100.0 : 0.2;
    const tearLength = params.tear_length !== undefined ? params.tear_length / 100.0 : 0.8;
    const tearThickness = params.tear_thickness !== undefined ? params.tear_thickness : 2;

    let activeJitterAmp = params.jitter_amp + (isGlitching && params.glitch_jitter ? glitchMultiplier * 3.0 : 0);
    let activeDropoutChance = params.dropout_chance + (isGlitching && params.glitch_dropouts ? glitchMultiplier * 0.1 : 0);
    let activeHsTear = hsColorTear + (isGlitching && params.glitch_tears ? glitchMultiplier * 0.5 : 0);

    const rowY = new Float32Array(w);
    const rowI = new Float32Array(w);
    const rowQ = new Float32Array(w);
    const rowA = new Uint8Array(w);

    let dropActiveRows = 0;
    let dropCenter = 0, dropHalfLen = 0, dropIntensity = 0;
    
    let tearActiveRows = 0;
    let currentTearStartX = 0, currentTearEndX = 0;

    for (let y = 0; y < h; y++) {
        let eff_y = pixelSize > 1 ? Math.floor(y / pixelSize) * pixelSize : y;

        let distFromBottom = h - eff_y;
        let isHeadSwitch = (distFromBottom <= params.head_switch_rows && params.head_switch_rows > 0);
        let pull = 0;
        let hs_curve = 0;
        
        if (isHeadSwitch) {
            let t = 1.0 - (distFromBottom / params.head_switch_rows);
            hs_curve = Math.pow(t, 3); 
            let baseSkew = params.head_switch_pull * hs_curve;
            let headNoise = (Math.random() - 0.5) * hsNoiseAmt * hs_curve;
            let wave = Math.sin(eff_y * hsFreq) * (params.head_switch_pull * hsWave) * hs_curve;
            pull = baseSkew + headNoise + wave;
        }

        // Random Tearing Logic (Color Bands)
        if (tearActiveRows > 0) {
            tearActiveRows--;
            pull += (Math.random() - 0.5) * 30 * activeHsTear;
        } else if (activeHsTear > 0) {
            let tearProb = 0;
            if (isHeadSwitch) tearProb += hs_curve * activeHsTear * 0.5;
            let y_percent = eff_y / h;
            if (y_percent >= (1.0 - tearMaxHeight) && tearMaxHeight > 0) {
                let loc_y = (y_percent - (1.0 - tearMaxHeight)) / tearMaxHeight;
                tearProb += loc_y * loc_y * activeHsTear * 0.1;
            }
            if (isGlitching && params.glitch_tears && y_percent >= (1.0 - tearMaxHeight)) {
                tearProb += glitchMultiplier * 0.2;
            }
            
            if (tearProb > 0 && Math.random() < tearProb) {
                tearActiveRows = Math.floor(Math.random() * tearThickness) + 1;
                let tLen = tearLength * w;
                currentTearStartX = Math.random() * (w - tLen); 
                currentTearEndX = currentTearStartX + tLen;
                pull += (Math.random() - 0.5) * 50; 
            }
        }

        let jitter = 0;
        let isDropout = false;

        jitter = (Math.sin(eff_y * params.jitter_freq + effectTime * 5) + Math.sin(eff_y * params.jitter_freq * 2.1 - effectTime * 2) * 0.4) * activeJitterAmp;
        
        if (dropActiveRows > 0) {
            isDropout = true;
            dropActiveRows--;
        } else if (activeDropoutChance > 0 && Math.random() < (activeDropoutChance / 10)) {
            isDropout = true;
            dropActiveRows = Math.floor(Math.random() * (params.dropout_thickness !== undefined ? params.dropout_thickness : 2));
            dropCenter = Math.random() * w;
            dropHalfLen = (Math.random() * params.dropout_len * w) / 2;
            dropIntensity = 0.5 + Math.random() * 0.5;
        }

        let prevI = 0; let prevQ = 0; let prevY = 0;
        let bottomCrop = Math.min(crop, 5);

        for (let x = 0; x < w; x++) {
            let cx_crop = x + pull;
            let distLeft = cx_crop - crop;
            let distRight = (w - crop) - cx_crop;
            let distBottom = (h - bottomCrop) - eff_y;
            
            let minDistX = Math.min(distLeft, distRight);
            let minDist = Math.min(minDistX, distBottom); 

            let edgeFade = 1.0;
            if (minDist <= 0) edgeFade = 0.0;
            else if (feather > 0 && minDist < feather) edgeFade = minDist / feather;

            let r = 0, g = 0, b = 0;
            rowA[x] = 255;

            if (edgeFade > 0) {
                let srcX = Math.floor(x + pull + jitter);
                if (pixelSize > 1) srcX = Math.floor(srcX / pixelSize) * pixelSize;

                if (srcX < 0) srcX = 0;
                if (srcX >= w) srcX = w - 1;

                let idx = (eff_y * w + srcX) * 4;
                r = data[idx] * edgeFade;
                g = data[idx + 1] * edgeFade;
                b = data[idx + 2] * edgeFade;
                rowA[x] = data[idx + 3];
            }

            if (isDropout) {
                let dist = Math.abs(x - dropCenter);
                if (dist < dropHalfLen) {
                    let env = 1.0 - (dist / dropHalfLen);
                    let noise = Math.random() * 200 * env * dropIntensity;
                    let baseDropout = 150 * env;
                    r = Math.min(255, r + baseDropout + noise); 
                    g = Math.min(255, g + baseDropout + noise); 
                    b = Math.min(255, b + baseDropout + noise);
                }
            }

            let luma = 0.299 * r + 0.587 * g + 0.114 * b; 
            luma = (luma - 128) * lumaContrast + 128 + lumaBrightness;

            let i = 0.596 * r - 0.274 * g - 0.322 * b;    
            let q = 0.211 * r - 0.523 * g + 0.312 * b;    

            let hs_tear_active = tearActiveRows > 0 && (x >= currentTearStartX && x <= currentTearEndX);

            if (hs_tear_active && edgeFade > 0.5) {
                let t_c = params.tear_color;
                if (t_c === 'cyan') { i = -80; q = 80; }
                else if (t_c === 'magenta') { i = 60; q = 40; }
                else if (t_c === 'red') { i = 80; q = 20; }
                else if (t_c === 'green') { i = -40; q = -60; }
                else { i = (Math.random()-0.5)*200; q = (Math.random()-0.5)*200; }
                luma += 40; 
            }

            if (phaseRad !== 0) {
                let newI = i * cosP - q * sinP; let newQ = i * sinP + q * cosP;
                i = newI; q = newQ;
            }

            if (x === 0) { prevI = i; prevQ = q; prevY = luma; } 
            else { 
                prevI = i * (1 - bleed) + prevI * bleed; 
                prevQ = q * (1 - bleed) + prevQ * bleed; 
                
                if (lumaSmear > 0) {
                    if (luma > 180) prevY = luma; 
                    else {
                        prevY = prevY * (1.0 - lumaSmear*0.1); 
                        if (prevY > luma) luma = prevY;
                    }
                }
            }

            rowY[x] = luma; rowI[x] = prevI; rowQ[x] = prevQ;
        }

        if (blurRadius > 0) {
            const tempI = new Float32Array(w); const tempQ = new Float32Array(w);
            for (let x = 0; x < w; x++) {
                let sumI = 0, sumQ = 0, count = 0;
                for(let k = -blurRadius; k <= blurRadius; k++) {
                    let px = x + k;
                    if(px >= 0 && px < w) { sumI += rowI[px]; sumQ += rowQ[px]; count++; }
                }
                tempI[x] = sumI / count; tempQ[x] = sumQ / count;
            }
            for(let x = 0; x < w; x++) { rowI[x] = tempI[x]; rowQ[x] = tempQ[x]; }
        }

        let activeNoiseC = params.noise_intensity_c + (isGlitching && params.glitch_noise ? glitchMultiplier * 30 : 0);

        for (let x = 0; x < w; x++) {
            let cxY = Math.min(Math.max(Math.floor(x - shiftY), 0), w - 1);
            let luma = rowY[cxY]; 
            if (params.enable_y === false) luma = 0;

            let cxR = Math.min(Math.max(Math.floor(x - shiftR), 0), w - 1);
            let cxG = Math.min(Math.max(Math.floor(x - shiftG), 0), w - 1);
            let cxB = Math.min(Math.max(Math.floor(x - shiftB), 0), w - 1);

            let cx_crop = x + pull;
            let distLeftSat = cx_crop - crop;
            let distRightSat = (w - crop) - cx_crop;
            let distBottomSat = (h - bottomCrop) - eff_y;
            let minDistSat = Math.min(Math.min(distLeftSat, distRightSat), distBottomSat); 

            let edgeFadeForSat = 1.0;
            if (minDistSat <= 0) edgeFadeForSat = 0.0;
            else if (feather > 0 && minDistSat < feather) edgeFadeForSat = minDistSat / feather;

            // Ajout propre de la saturation des bordures
            let activeSat = chromaSatBase;
            if (edgeFadeForSat < 1.0) {
                activeSat += (1.0 - edgeFadeForSat) * edgeSat;
            }
            
            let shadow_factor = luma < 128 ? (1.0 - luma/128.0) : 0;
            activeSat += shadow_factor * shadowSat;
            activeSat += hs_curve * hsSat;
            if (activeSat < 0) activeSat = 0;

            let iR = rowI[cxR] * activeSat; let qR = rowQ[cxR] * activeSat;
            let iG = rowI[cxG] * activeSat; let qG = rowQ[cxG] * activeSat;
            let iB = rowI[cxB] * activeSat; let qB = rowQ[cxB] * activeSat;

            let rColor =  0.956 * iR + 0.621 * qR;
            let gColor = -0.272 * iG - 0.647 * qG;
            let bColor = -1.106 * iB + 1.703 * qB;

            let r = luma + rColor; let g = luma + gColor; let b = luma + bColor;

            if (rightPink > 0 && rightPinkWidth > 0) {
                let edgeDist = x / w;
                let washoutStart = 1.0 - rightPinkWidth;
                if (edgeDist > washoutStart) {
                    let fade = Math.pow((edgeDist - washoutStart) / rightPinkWidth, 2) * rightPink;
                    let desat = 0.299 * r + 0.587 * g + 0.114 * b;
                    r = r * (1 - fade) + desat * fade;
                    g = g * (1 - fade) + desat * fade;
                    b = b * (1 - fade) + desat * fade;
                    r = Math.min(255, r + fade * 60);
                    b = Math.min(255, b + fade * 50);
                    g = Math.max(0, g - fade * 20);
                }
            }

            if (params.apply_color_cast) { r += params.cast_r; g += params.cast_g; b += params.cast_b; }

            let noise = (Math.random() - 0.5) * params.noise_intensity_y * 2;
            let cNoise = (Math.random() - 0.5) * activeNoiseC * 2;
            r += noise + cNoise; g += noise; b += noise - cNoise;

            if (params.enable_r === false) r = luma;
            if (params.enable_g === false) g = luma;
            if (params.enable_b === false) b = luma;

            let outIdx = (y * w + x) * 4;
            out[outIdx] = r > 255 ? 255 : (r < 0 ? 0 : r);
            out[outIdx + 1] = g > 255 ? 255 : (g < 0 ? 0 : g);
            out[outIdx + 2] = b > 255 ? 255 : (b < 0 ? 0 : b);
            out[outIdx + 3] = rowA[x];
        }
    }
    return out;
}
