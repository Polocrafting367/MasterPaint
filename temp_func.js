    }
})(typeof self !== 'undefined' ? self : window);    function applyPostCameraRaw(src, width, height, p) {
        if (!p.vignette && !p.grain && !p.sharpen && !p.clarity && !p.dehaze) return src;
        const isFloat = src instanceof Float32Array;
        const out = new (isFloat ? Float32Array : Uint8ClampedArray)(src.length);
        out.set(src);
        
        const hasVignette = p.vignette && p.vignette !== 0;
        const vAmt = p.vignette ? p.vignette / 100 : 0;
        
        const hasGrain = p.grain && p.grain > 0;
        const grainAmt = p.grain ? p.grain / 100 : 0;
        const gs = (p.grainSharpness != null ? p.grainSharpness : 50) / 100;
        
        const hasDehaze = p.dehaze && p.dehaze !== 0;
        const dehazeAmt = p.dehaze ? p.dehaze / 100 : 0;
        
        const hasClarity = p.clarity && p.clarity !== 0;
        const clarityAmt = p.clarity ? p.clarity / 100 : 0;
        
        if (hasVignette || hasGrain || hasDehaze || hasClarity) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    let r = out[i], g = out[i+1], b = out[i+2];
                    
                    if (hasDehaze || hasClarity) {
                        // Very simple clarity/dehaze approximation (global midtone contrast)
                        let luma = 0.299 * r + 0.587 * g + 0.114 * b;
                        let maxVal = isFloat ? 1.0 : 255.0;
                        let lumaNorm = luma / maxVal;
                        
                        if (hasDehaze) {
                            // Dehaze: subtract light from shadows, boost saturation
                            let sub = dehazeAmt * maxVal * 0.2 * (1.0 - lumaNorm);
                            r = Math.max(0, r - sub);
                            g = Math.max(0, g - sub);
                            b = Math.max(0, b - sub);
                            // saturation boost
                            let satBoost = 1.0 + (dehazeAmt * 0.5);
                            luma = 0.299 * r + 0.587 * g + 0.114 * b;
                            r = luma + (r - luma) * satBoost;
                            g = luma + (g - luma) * satBoost;
                            b = luma + (b - luma) * satBoost;
                        }
                        
                        if (hasClarity) {
                            // Clarity: midtone contrast
                            let midCurve = Math.sin(lumaNorm * Math.PI); // 1.0 at midtones, 0 at shadows/highlights
                            let contrast = 1.0 + (clarityAmt * midCurve * 0.5);
                            luma = 0.299 * r + 0.587 * g + 0.114 * b;
                            r = luma + (r - luma) * contrast;
                            g = luma + (g - luma) * contrast;
                            b = luma + (b - luma) * contrast;
                        }
                    }
                    
                    if (hasVignette) {
                        const cx = (x / width) - 0.5;
                        const cy = (y / height) - 0.5;
                        const dist = Math.sqrt(cx * cx + cy * cy) * 2.0;
                        const falloff = Math.pow(Math.min(1, Math.max(0, dist)), 2.5);
                        const factor = 1 - (vAmt * falloff);
                        r *= factor; g *= factor; b *= factor;
                    }
                    
                    if (hasGrain) {
                        let maxVal = isFloat ? 1.0 : 255.0;
                        const gn = (Math.random() - 0.5) * grainAmt * maxVal * (0.2 + 0.4 * gs);
                        r += gn; g += gn; b += gn;
                    }
                    
                    if (isFloat) {
                        out[i] = r; out[i+1] = g; out[i+2] = b;
                    } else {
                        out[i] = r < 0 ? 0 : (r > 255 ? 255 : r);
                        out[i+1] = g < 0 ? 0 : (g > 255 ? 255 : g);
                        out[i+2] = b < 0 ? 0 : (b > 255 ? 255 : b);
                    }
                }
            }
        }
        
        if (p.sharpen && p.sharpen > 0) {
            return applySharpen(out, width, height, p.sharpen, isFloat);
        }
        return out;
    }
