
import { clamp255, clamp01, lerp, rgbToHsv, hsvToRgb } from "./math";

/**
 * Camera RAW Adjustment Engine (Professional Grade)
 * Synchronized with the photo-mode-core photographic pipeline.
 */

@inline
function srgbToLinear(c: f32): f32 {
    let cf: f32 = c / <f32>255.0;
    if (cf <= <f32>0) return 0;
    if (cf >= <f32>1) return 1;
    return <f32>(cf <= <f32>0.04045 ? <f32>(cf / <f32>12.92) : <f32>Math.pow(<f64>(cf + <f32>0.055) / <f64>1.055, <f64>2.4));
}

@inline
function linearToSrgb(c: f32): f32 {
    if (c <= <f32>0) return 0;
    if (c >= <f32>1) return 255.0;
    let cf: f32 = <f32>(c <= <f32>0.0031308 ? <f32>(<f32>12.92 * c) : <f32>(<f32>1.055 * <f32>Math.pow(<f64>c, <f64>(1.0 / <f64>2.4)) - <f32>0.055));
    return <f32>(cf * <f32>255.0);
}

export function applyCameraRaw(
    dataPtr: usize, 
    width: i32, 
    height: i32,
    exposure: f32, 
    contrast: f32, 
    highlights: f32, 
    shadows: f32, 
    whites: f32,
    blacks: f32,
    temperature: f32, 
    tint: f32,
    vibrance: f32,
    saturation: f32,
    red: f32, redHi: f32, redSh: f32,
    green: f32, greenHi: f32, greenSh: f32,
    blue: f32, blueHi: f32, blueSh: f32,
    hslPtr: usize,
    lutPtr: usize,
    startY: i32,
    endY: i32
): void {
    if (endY < 0) endY = height;
    if (startY < 0) startY = 0;
    if (endY > height) endY = height;
    
    const expStops: f32 = <f32>((exposure / <f32>100.0) * <f32>2.0);
    const mult: f32 = <f32>Math.pow(<f64>2.0, <f64>expStops);
    const contrastF: f32 = <f32>((<f32>100.0 + contrast) / <f32>100.0);
    const t: f32 = <f32>(temperature / <f32>100.0);
    const tn: f32 = <f32>(tint / <f32>100.0);
    const saturationF: f32 = <f32>((<f32>100.0 + saturation) / <f32>100.0);
    const vibranceF: f32 = <f32>(vibrance / <f32>100.0);

    const lutRGB = lutPtr;
    const lutR = lutPtr + 256;
    const lutG = lutPtr + 512;
    const lutB = lutPtr + 768;

    for (let y = startY; y < endY; y++) {
        const rowOffset: usize = <usize>y * <usize>width * 4;
        for (let x = 0; x < width; x++) {
            const idx: usize = rowOffset + (<usize>x << 2);
            
            let rRaw: f32 = <f32>load<u8>(dataPtr + idx);
            let gRaw: f32 = <f32>load<u8>(dataPtr + idx + 1);
            let bRaw: f32 = <f32>load<u8>(dataPtr + idx + 2);
            const a: u8 = load<u8>(dataPtr + idx + 3);

            if (a == 0) continue;

            // 1. To Linear
            let r: f32 = srgbToLinear(rRaw);
            let g: f32 = srgbToLinear(gRaw);
            let b: f32 = srgbToLinear(bRaw);

            // 2. Exposure
            r *= mult; g *= mult; b *= mult;

            // 3. Temp & Tint based on luminance zones (preserving pure black and pure white highlights)
            const Y_orig: f32 = <f32>(<f32>0.2126 * r + <f32>0.7152 * g + <f32>0.0722 * b);
            const Y_clamp: f32 = <f32>Math.max(0.0, Math.min(1.0, Y_orig));
            const wZone: f32 = Y_clamp * (<f32>1.0 - Y_clamp) * <f32>4.0;
            if (t != <f32>0) {
                const tAdj = t * wZone;
                r *= <f32>Math.max(0.0, <f32>(<f32>1.0 + <f32>(tAdj * <f32>0.12)));
                b *= <f32>Math.max(0.0, <f32>(<f32>1.0 - <f32>(tAdj * <f32>0.12)));
                g *= <f32>Math.max(0.0, <f32>(<f32>1.0 + <f32>(tAdj * <f32>0.02)));
            }
            if (tn != <f32>0) {
                const tnAdj = tn * wZone;
                r *= <f32>Math.max(0.0, <f32>(<f32>1.0 + <f32>(tnAdj * <f32>0.06)));
                b *= <f32>Math.max(0.0, <f32>(<f32>1.0 + <f32>(tnAdj * <f32>0.06)));
                g *= <f32>Math.max(0.0, <f32>(<f32>1.0 - <f32>(tnAdj * <f32>0.08)));
            }

            // 4. HDR Luma Mapping
            let Y: f32 = <f32>(<f32>0.2126 * r + <f32>0.7152 * g + <f32>0.0722 * b);
            if (Y > <f32>0.001) {
                let yNew: f32 = Y;

                // Highlights
                if (highlights != <f32>0) {
                    const hi: f32 = highlights / <f32>100.0;
                    let w: f32 = <f32>Math.max(0.0, <f64>((yNew - <f32>0.5) / <f32>0.5));
                    w = w * w;
                    if (hi < <f32>0 && yNew > <f32>0.5) {
                        const over: f32 = yNew - <f32>0.5;
                        yNew = <f32>0.5 + over * <f32>Math.pow(<f64>(over + <f32>1.0), <f64>(hi * <f32>0.5));
                    } else {
                        yNew += hi * w * <f32>1.5;
                    }
                }

                // Whites
                if (whites != <f32>0) {
                    const wh: f32 = whites / <f32>100.0;
                    let w: f32 = <f32>Math.max(0.0, <f64>((yNew - <f32>0.7) / <f32>0.3));
                    if (wh < <f32>0 && yNew > <f32>0.7) {
                        const over: f32 = yNew - <f32>0.7;
                        yNew = <f32>0.7 + over * <f32>Math.pow(<f64>(over + <f32>1.0), <f64>(wh * <f32>0.6));
                    } else {
                        yNew += wh * w * <f32>2.0;
                    }
                }

                yNew = <f32>Math.max(<f32>0.0, yNew);
                const multLuma: f32 = <f32>(yNew / Y);
                r *= multLuma; g *= multLuma; b *= multLuma;

                Y = yNew;
            }

            // Shadows — multiplicative tone adjustment, preserves blacks and avoids division explosions
            if (shadows != <f32>0) {
                const sh: f32 = shadows / <f32>100.0;
                const w: f32 = <f32>Math.max(0.0, <f64>(<f32>1.0 - (Y / <f32>0.5)));
                const factor: f32 = <f32>Math.max(0.0, <f32>1.0 + sh * w * w * <f32>1.2);
                r *= factor; g *= factor; b *= factor;
            }

            // Blacks — multiplicative tone adjustment, preserves blacks and avoids division explosions
            if (blacks != <f32>0) {
                const bl: f32 = blacks / <f32>100.0;
                const w: f32 = <f32>Math.max(0.0, <f64>(<f32>1.0 - (Y / <f32>0.3)));
                const factor: f32 = <f32>Math.max(0.0, <f32>1.0 + bl * w * w * <f32>1.5);
                r *= factor; g *= factor; b *= factor;
            }

            // 5. RGB Split Toning
            if (red != 0 || redHi != 0 || redSh != 0 || green != 0 || greenHi != 0 || greenSh != 0 || blue != 0 || blueHi != 0 || blueSh != 0) {
                const wHi: f32 = <f32>Math.max(<f32>0.0, <f32>(Y - <f32>0.5)) / <f32>0.5;
                const wSh: f32 = <f32>Math.max(<f32>0.0, <f32>(<f32>0.5 - Y)) / <f32>0.5;
                if (red != 0) r *= <f32>(<f32>1.0 + <f32>(red / <f32>100.0));
                if (redHi != 0) r *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(redHi / <f32>100.0) * wHi) * <f32>1.5));
                if (redSh != 0) r *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(redSh / <f32>100.0) * wSh) * <f32>1.5));
                if (green != 0) g *= <f32>(<f32>1.0 + <f32>(green / <f32>100.0));
                if (greenHi != 0) g *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(greenHi / <f32>100.0) * wHi) * <f32>1.5));
                if (greenSh != 0) g *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(greenSh / <f32>100.0) * wSh) * <f32>1.5));
                if (blue != 0) b *= <f32>(<f32>1.0 + <f32>(blue / <f32>100.0));
                if (blueHi != 0) b *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(blueHi / <f32>100.0) * wHi) * <f32>1.5));
                if (blueSh != 0) b *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(blueSh / <f32>100.0) * wSh) * <f32>1.5));
            }

            // 6. Back to sRGB
            let r8: f32 = linearToSrgb(r);
            let g8: f32 = linearToSrgb(g);
            let b8: f32 = linearToSrgb(b);

            // 7. Global Contrast
            let lr: f32 = r8 / <f32>255.0; let lg: f32 = g8 / <f32>255.0; let lb: f32 = b8 / <f32>255.0;
            lr = clamp01(<f32>(<f32>0.5 + <f32>(<f32>(lr - <f32>0.5) * contrastF)));
            lg = clamp01(<f32>(<f32>0.5 + <f32>(<f32>(lg - <f32>0.5) * contrastF)));
            lb = clamp01(<f32>(<f32>0.5 + <f32>(<f32>(lb - <f32>0.5) * contrastF)));
            r8 = <f32>(lr * <f32>255.0); g8 = <f32>(lg * <f32>255.0); b8 = <f32>(lb * <f32>255.0);

            // 8. Curves
            if (lutPtr != 0) {
                r8 = <f32>load<u8>(lutR + <usize>clamp255(r8));
                g8 = <f32>load<u8>(lutG + <usize>clamp255(g8));
                b8 = <f32>load<u8>(lutB + <usize>clamp255(b8));
                r8 = <f32>load<u8>(lutRGB + <usize>clamp255(r8));
                g8 = <f32>load<u8>(lutRGB + <usize>clamp255(g8));
                b8 = <f32>load<u8>(lutRGB + <usize>clamp255(b8));
            }

            // 9. HSL Mixer
            if (hslPtr != 0) {
                const hsv = rgbToHsv(r8, g8, b8);
                let h: f32 = hsv.h;
                let i1: i32 = 0, i2: i32 = 0, w1: f32 = 0, w2: f32 = 0;
                if (h < <f32>30) { i1=0; i2=1; w1=<f32>1-h/<f32>30; w2=h/<f32>30; }
                else if (h < <f32>60) { i1=1; i2=2; w1=<f32>1-(h-<f32>30)/<f32>30; w2=(h-<f32>30)/<f32>30; }
                else if (h < <f32>120) { i1=2; i2=3; w1=<f32>1-(h-<f32>60)/<f32>60; w2=(h-<f32>60)/<f32>60; }
                else if (h < <f32>180) { i1=3; i2=4; w1=<f32>1-(h-<f32>120)/<f32>60; w2=(h-<f32>120)/<f32>60; }
                else if (h < <f32>240) { i1=4; i2=5; w1=<f32>1-(h-<f32>180)/<f32>60; w2=(h-<f32>180)/<f32>60; }
                else if (h < <f32>280) { i1=5; i2=6; w1=<f32>1-(h-<f32>240)/<f32>40; w2=(h-<f32>240)/<f32>40; }
                else if (h < <f32>320) { i1=6; i2=7; w1=<f32>1-(h-<f32>280)/<f32>40; w2=(h-<f32>280)/<f32>40; }
                else { i1=7; i2=0; w1=<f32>1-(h-<f32>320)/<f32>40; w2=(h-<f32>320)/<f32>40; }
                const h1: f32 = load<f32>(hslPtr + (<usize>i1 * 12));
                const s1: f32 = load<f32>(hslPtr + (<usize>i1 * 12) + 4);
                const l1: f32 = load<f32>(hslPtr + (<usize>i1 * 12) + 8);
                const h2: f32 = load<f32>(hslPtr + (<usize>i2 * 12));
                const s2: f32 = load<f32>(hslPtr + (<usize>i2 * 12) + 4);
                const l2: f32 = load<f32>(hslPtr + (<usize>i2 * 12) + 8);
                const mixH = <f32>(h1 * w1 + h2 * w2);
                const mixS = <f32>(s1 * w1 + s2 * w2);
                const mixV = <f32>(l1 * w1 + l2 * w2);

                hsv.h = <f32>((hsv.h + mixH + <f32>3600.0) % <f32>360.0);
                hsv.s = <f32>Math.max(0.0, Math.min(100.0, hsv.s + mixS));
                hsv.v = <f32>Math.max(0.0, Math.min(100.0, hsv.v + mixV));
                
                const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
                r8 = rgb.r; g8 = rgb.g; b8 = rgb.b;
            }

            // 10. Vibrance & Saturation
            if (vibranceF != <f32>0 || saturationF != <f32>1.0) {
                const avg: f32 = <f32>((r8 + g8 + b8) / <f32>3.0);
                const max_val: f32 = <f32>Math.max(r8, <f32>Math.max(g8, b8));
                const amt: f32 = <f32>(<f32>(<f32>(max_val - avg) / <f32>255.0) * vibranceF);
                r8 += <f32>((max_val - r8) * amt);
                g8 += <f32>((max_val - g8) * amt);
                b8 += <f32>((max_val - b8) * amt);
                const gray: f32 = <f32>(<f32>0.299 * r8 + <f32>0.587 * g8 + <f32>0.114 * b8);
                r8 = <f32>(gray + <f32>(<f32>(r8 - gray) * saturationF));
                g8 = <f32>(gray + <f32>(<f32>(g8 - gray) * saturationF));
                b8 = <f32>(gray + <f32>(<f32>(b8 - gray) * saturationF));
            }
            store<u8>(dataPtr + idx, clamp255(r8));
            store<u8>(dataPtr + idx + 1, clamp255(g8));
            store<u8>(dataPtr + idx + 2, clamp255(b8));
        }
    }
}

export function applyCameraRawFloat(
    inputPtr: usize,
    outputPtr: usize,
    width: i32,
    height: i32,
    exposure: f32, 
    contrast: f32, 
    highlights: f32, 
    shadows: f32, 
    whites: f32,
    blacks: f32,
    temperature: f32, 
    tint: f32,
    vibrance: f32,
    saturation: f32,
    red: f32, redHi: f32, redSh: f32,
    green: f32, greenHi: f32, greenSh: f32,
    blue: f32, blueHi: f32, blueSh: f32,
    hslPtr: usize,
    lutPtr: usize,
    startY: i32,
    endY: i32
): void {
    if (endY < 0) endY = height;
    if (startY < 0) startY = 0;
    if (endY > height) endY = height;
    
    const expStops: f32 = <f32>((exposure / <f32>100.0) * <f32>2.0);
    const mult: f32 = <f32>Math.pow(<f64>2.0, <f64>expStops);
    const contrastF: f32 = <f32>((<f32>100.0 + contrast) / <f32>100.0);
    const t: f32 = <f32>(temperature / <f32>1000.0);
    const tn: f32 = <f32>(tint / <f32>1000.0);
    const saturationF: f32 = <f32>((<f32>100.0 + saturation) / <f32>100.0);
    const vibranceF: f32 = <f32>(vibrance / <f32>100.0);

    const lutRGB = lutPtr;
    const lutR = lutPtr + 256;
    const lutG = lutPtr + 512;
    const lutB = lutPtr + 768;

    for (let y = startY; y < endY; y++) {
        const rowOffset: usize = <usize>y * <usize>width * 4;
        for (let x = 0; x < width; x++) {
            const idx: usize = rowOffset + (<usize>x << 2);
            const idxFloat: usize = idx << 2; // Each float is 4 bytes
            
            let r: f32 = load<f32>(inputPtr + idxFloat);
            let g: f32 = load<f32>(inputPtr + idxFloat + 4);
            let b: f32 = load<f32>(inputPtr + idxFloat + 8);
            const aVal: f32 = load<f32>(inputPtr + idxFloat + 12);

            // Exposure
            r *= mult; g *= mult; b *= mult;

            // Temp & Tint based on luminance zones (preserving pure black and pure white highlights)
            const Y_orig: f32 = <f32>(<f32>0.2126 * r + <f32>0.7152 * g + <f32>0.0722 * b);
            const Y_clamp: f32 = <f32>Math.max(0.0, Math.min(1.0, Y_orig));
            const wZone: f32 = Y_clamp * (<f32>1.0 - Y_clamp) * <f32>4.0;
            if (t != <f32>0) {
                const tAdj = t * wZone;
                r *= <f32>Math.max(0.0, <f32>(<f32>1.0 + <f32>(tAdj * <f32>0.12)));
                b *= <f32>Math.max(0.0, <f32>(<f32>1.0 - <f32>(tAdj * <f32>0.12)));
                g *= <f32>Math.max(0.0, <f32>(<f32>1.0 + <f32>(tAdj * <f32>0.02)));
            }
            if (tn != <f32>0) {
                const tnAdj = tn * wZone;
                r *= <f32>Math.max(0.0, <f32>(<f32>1.0 + <f32>(tnAdj * <f32>0.06)));
                b *= <f32>Math.max(0.0, <f32>(<f32>1.0 + <f32>(tnAdj * <f32>0.06)));
                g *= <f32>Math.max(0.0, <f32>(<f32>1.0 - <f32>(tnAdj * <f32>0.08)));
            }

            // HDR Luma Mapping
            let Y: f32 = <f32>(<f32>0.2126 * r + <f32>0.7152 * g + <f32>0.0722 * b);
            if (Y > <f32>0.001) {
                let yNew: f32 = Y;

                // Highlights
                if (highlights != <f32>0) {
                    const hi: f32 = highlights / <f32>100.0;
                    let w: f32 = <f32>Math.max(0.0, <f64>((yNew - <f32>0.5) / <f32>0.5));
                    w = w * w;
                    if (hi < <f32>0 && yNew > <f32>0.5) {
                        const over: f32 = yNew - <f32>0.5;
                        yNew = <f32>0.5 + over * <f32>Math.pow(<f64>(over + <f32>1.0), <f64>(hi * <f32>0.5));
                    } else {
                        yNew += hi * w * <f32>1.5;
                    }
                }

                // Whites
                if (whites != <f32>0) {
                    const wh: f32 = whites / <f32>100.0;
                    let w: f32 = <f32>Math.max(0.0, <f64>((yNew - <f32>0.7) / <f32>0.3));
                    if (wh < <f32>0 && yNew > <f32>0.7) {
                        const over: f32 = yNew - <f32>0.7;
                        yNew = <f32>0.7 + over * <f32>Math.pow(<f64>(over + <f32>1.0), <f64>(wh * <f32>0.6));
                    } else {
                        yNew += wh * w * <f32>2.0;
                    }
                }

                yNew = <f32>Math.max(<f32>0.0, yNew);
                const multLuma: f32 = <f32>(yNew / Y);
                r *= multLuma; g *= multLuma; b *= multLuma;

                Y = yNew;
            }

            // Shadows — multiplicative tone adjustment, preserves blacks and avoids division explosions
            if (shadows != <f32>0) {
                const sh: f32 = shadows / <f32>100.0;
                const w: f32 = <f32>Math.max(0.0, <f64>(<f32>1.0 - (Y / <f32>0.5)));
                const factor: f32 = <f32>Math.max(0.0, <f32>1.0 + sh * w * w * <f32>1.2);
                r *= factor; g *= factor; b *= factor;
            }

            // Blacks — multiplicative tone adjustment, preserves blacks and avoids division explosions
            if (blacks != <f32>0) {
                const bl: f32 = blacks / <f32>100.0;
                const w: f32 = <f32>Math.max(0.0, <f64>(<f32>1.0 - (Y / <f32>0.3)));
                const factor: f32 = <f32>Math.max(0.0, <f32>1.0 + bl * w * w * <f32>1.5);
                r *= factor; g *= factor; b *= factor;
            }

            // Extended Reinhard tonemapping — preserves HDR range with smooth shoulder
            // Uses luminance-based mapping to maintain color ratios
            const maxC: f32 = <f32>Math.max(r, Math.max(g, b));
            if (maxC > <f32>0.0) {
                // Reinhard with white point at 4.0 (preserves detail up to ~4 stops over mid-gray)
                const Lw: f32 = <f32>4.0;
                const mappedMax: f32 = maxC * (<f32>1.0 + maxC / (Lw * Lw)) / (<f32>1.0 + maxC);
                const ratio: f32 = mappedMax / maxC;
                r *= ratio;
                g *= ratio;
                b *= ratio;
            }

            // RGB Split Toning
            if (red != 0 || redHi != 0 || redSh != 0 || green != 0 || greenHi != 0 || greenSh != 0 || blue != 0 || blueHi != 0 || blueSh != 0) {
                const wHi: f32 = <f32>Math.max(<f32>0.0, <f32>(Y - <f32>0.5)) / <f32>0.5;
                const wSh: f32 = <f32>Math.max(<f32>0.0, <f32>(<f32>0.5 - Y)) / <f32>0.5;
                if (red != 0) r *= <f32>(<f32>1.0 + <f32>(red / <f32>100.0));
                if (redHi != 0) r *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(redHi / <f32>100.0) * wHi) * <f32>1.5));
                if (redSh != 0) r *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(redSh / <f32>100.0) * wSh) * <f32>1.5));
                if (green != 0) g *= <f32>(<f32>1.0 + <f32>(green / <f32>100.0));
                if (greenHi != 0) g *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(greenHi / <f32>100.0) * wHi) * <f32>1.5));
                if (greenSh != 0) g *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(greenSh / <f32>100.0) * wSh) * <f32>1.5));
                if (blue != 0) b *= <f32>(<f32>1.0 + <f32>(blue / <f32>100.0));
                if (blueHi != 0) b *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(blueHi / <f32>100.0) * wHi) * <f32>1.5));
                if (blueSh != 0) b *= <f32>(<f32>1.0 + <f32>(<f32>(<f32>(blueSh / <f32>100.0) * wSh) * <f32>1.5));
            }

            // Back to sRGB
            let r8: f32 = linearToSrgb(r);
            let g8: f32 = linearToSrgb(g);
            let b8: f32 = linearToSrgb(b);

            // Global Contrast
            let lr: f32 = r8 / <f32>255.0; let lg: f32 = g8 / <f32>255.0; let lb: f32 = b8 / <f32>255.0;
            lr = clamp01(<f32>(<f32>0.5 + <f32>(<f32>(lr - <f32>0.5) * contrastF)));
            lg = clamp01(<f32>(<f32>0.5 + <f32>(<f32>(lg - <f32>0.5) * contrastF)));
            lb = clamp01(<f32>(<f32>0.5 + <f32>(<f32>(lb - <f32>0.5) * contrastF)));
            r8 = <f32>(lr * <f32>255.0); g8 = <f32>(lg * <f32>255.0); b8 = <f32>(lb * <f32>255.0);

            // Curves
            if (lutPtr != 0) {
                r8 = <f32>load<u8>(lutR + <usize>clamp255(r8));
                g8 = <f32>load<u8>(lutG + <usize>clamp255(g8));
                b8 = <f32>load<u8>(lutB + <usize>clamp255(b8));
                r8 = <f32>load<u8>(lutRGB + <usize>clamp255(r8));
                g8 = <f32>load<u8>(lutRGB + <usize>clamp255(g8));
                b8 = <f32>load<u8>(lutRGB + <usize>clamp255(b8));
            }

            // HSL Mixer
            if (hslPtr != 0) {
                const hsv = rgbToHsv(r8, g8, b8);
                let h: f32 = hsv.h;
                let i1: i32 = 0, i2: i32 = 0, w1: f32 = 0, w2: f32 = 0;
                if (h < <f32>30) { i1=0; i2=1; w1=<f32>1-h/<f32>30; w2=h/<f32>30; }
                else if (h < <f32>60) { i1=1; i2=2; w1=<f32>1-(h-<f32>30)/<f32>30; w2=(h-<f32>30)/<f32>30; }
                else if (h < <f32>120) { i1=2; i2=3; w1=<f32>1-(h-<f32>60)/<f32>60; w2=(h-<f32>60)/<f32>60; }
                else if (h < <f32>180) { i1=3; i2=4; w1=<f32>1-(h-<f32>120)/<f32>60; w2=(h-<f32>120)/<f32>60; }
                else if (h < <f32>240) { i1=4; i2=5; w1=<f32>1-(h-<f32>180)/<f32>60; w2=(h-<f32>180)/<f32>60; }
                else if (h < <f32>280) { i1=5; i2=6; w1=<f32>1-(h-<f32>240)/<f32>40; w2=(h-<f32>240)/<f32>40; }
                else if (h < <f32>320) { i1=6; i2=7; w1=<f32>1-(h-<f32>280)/<f32>40; w2=(h-<f32>280)/<f32>40; }
                else { i1=7; i2=0; w1=<f32>1-(h-<f32>320)/<f32>40; w2=(h-<f32>320)/<f32>40; }
                const h1: f32 = load<f32>(hslPtr + (<usize>i1 * 12));
                const s1: f32 = load<f32>(hslPtr + (<usize>i1 * 12) + 4);
                const l1: f32 = load<f32>(hslPtr + (<usize>i1 * 12) + 8);
                const h2: f32 = load<f32>(hslPtr + (<usize>i2 * 12));
                const s2: f32 = load<f32>(hslPtr + (<usize>i2 * 12) + 4);
                const l2: f32 = load<f32>(hslPtr + (<usize>i2 * 12) + 8);
                const mixH = <f32>(h1 * w1 + h2 * w2);
                const mixS = <f32>(s1 * w1 + s2 * w2);
                const mixV = <f32>(l1 * w1 + l2 * w2);

                hsv.h = <f32>((hsv.h + mixH + <f32>3600.0) % <f32>360.0);
                hsv.s = <f32>Math.max(0.0, Math.min(100.0, hsv.s + mixS));
                hsv.v = <f32>Math.max(0.0, Math.min(100.0, hsv.v + mixV));
                
                const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
                r8 = rgb.r; g8 = rgb.g; b8 = rgb.b;
            }

            // Vibrance & Saturation
            if (vibranceF != <f32>0 || saturationF != <f32>1.0) {
                const avg: f32 = <f32>((r8 + g8 + b8) / <f32>3.0);
                const max_val: f32 = <f32>Math.max(r8, <f32>Math.max(g8, b8));
                const amt: f32 = <f32>(<f32>(<f32>(max_val - avg) / <f32>255.0) * vibranceF);
                r8 += <f32>((max_val - r8) * amt);
                g8 += <f32>((max_val - g8) * amt);
                b8 += <f32>((max_val - b8) * amt);
                const gray: f32 = <f32>(<f32>0.299 * r8 + <f32>0.587 * g8 + <f32>0.114 * b8);
                r8 = <f32>(gray + <f32>(<f32>(r8 - gray) * saturationF));
                g8 = <f32>(gray + <f32>(<f32>(g8 - gray) * saturationF));
                b8 = <f32>(gray + <f32>(<f32>(b8 - gray) * saturationF));
            }

            // Store u8 to outputPtr
            store<u8>(outputPtr + idx, clamp255(r8));
            store<u8>(outputPtr + idx + 1, clamp255(g8));
            store<u8>(outputPtr + idx + 2, clamp255(b8));
            store<u8>(outputPtr + idx + 3, <u8>clamp255(aVal * <f32>255.0));
        }
    }
}

export function generateThumbnail(srcPtr: usize, dstPtr: usize, srcW: i32, srcH: i32, dstW: i32, dstH: i32): void {
    const xRatio: f32 = <f32>srcW / <f32>dstW;
    const yRatio: f32 = <f32>srcH / <f32>dstH;
    for (let y = 0; y < dstH; y++) {
        const rowOffset: usize = <usize>y * <usize>dstW * 4;
        const srcY: i32 = <i32>(<f32>y * yRatio);
        for (let x = 0; x < dstW; x++) {
            const srcX: i32 = <i32>(<f32>x * xRatio);
            const srcIdx: usize = (<usize>srcY * <usize>srcW + <usize>srcX) << 2;
            store<u32>(dstPtr + rowOffset + (<usize>x << 2), load<u32>(srcPtr + srcIdx));
        }
    }
}
