import { clamp255, sampleBilinear } from "./math";

@inline
function getIntensity(r: u8, g: u8, b: u8, maxIntensity: i32): i32 {
    return <i32>( (<f32>(r * 77 + g * 150 + b * 29) / 256.0) * (<f32>maxIntensity / 255.0) );
}

export function oilPainting(srcPtr: usize, dstPtr: usize, w: i32, h: i32, brushSize: i32, coarseness: i32, startY: i32, endY: i32): void {
    const arrayLen = coarseness + 1;
    const intensityCount = new Int32Array(arrayLen);
    const avgR = new Uint32Array(arrayLen);
    const avgG = new Uint32Array(arrayLen);
    const avgB = new Uint32Array(arrayLen);
    const avgA = new Uint32Array(arrayLen);

    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        const top = Math.max(0, y - brushSize);
        const bottom = Math.min(h, y + brushSize + 1);

        for (let x = 0; x < w; x++) {
            const left = Math.max(0, x - brushSize);
            const right = Math.min(w, x + brushSize + 1);

            // clear arrays
            for (let i = 0; i < arrayLen; i++) {
                intensityCount[i] = 0;
                avgR[i] = 0;
                avgG[i] = 0;
                avgB[i] = 0;
                avgA[i] = 0;
            }

            for (let j = top; j < bottom; j++) {
                const jRow = <usize>j * <usize>w * 4;
                for (let i = left; i < right; i++) {
                    const idx = jRow + (<usize>i << 2);
                    const r = load<u8>(srcPtr + idx);
                    const g = load<u8>(srcPtr + idx + 1);
                    const b = load<u8>(srcPtr + idx + 2);
                    const a = load<u8>(srcPtr + idx + 3);

                    const intensity = getIntensity(r, g, b, coarseness);
                    intensityCount[intensity]++;
                    avgR[intensity] += r;
                    avgG[intensity] += g;
                    avgB[intensity] += b;
                    avgA[intensity] += a;
                }
            }

            let chosenIntensity = 0;
            let maxInstance = 0;
            for (let i = 0; i <= coarseness; i++) {
                if (intensityCount[i] > maxInstance) {
                    chosenIntensity = i;
                    maxInstance = intensityCount[i];
                }
            }

            const outIdx = row + (<usize>x << 2);
            if (maxInstance > 0) {
                store<u8>(dstPtr + outIdx,     <u8>(avgR[chosenIntensity] / maxInstance));
                store<u8>(dstPtr + outIdx + 1, <u8>(avgG[chosenIntensity] / maxInstance));
                store<u8>(dstPtr + outIdx + 2, <u8>(avgB[chosenIntensity] / maxInstance));
                store<u8>(dstPtr + outIdx + 3, <u8>(avgA[chosenIntensity] / maxInstance));
            } else {
                store<u8>(dstPtr + outIdx,     load<u8>(srcPtr + outIdx));
                store<u8>(dstPtr + outIdx + 1, load<u8>(srcPtr + outIdx + 1));
                store<u8>(dstPtr + outIdx + 2, load<u8>(srcPtr + outIdx + 2));
                store<u8>(dstPtr + outIdx + 3, load<u8>(srcPtr + outIdx + 3));
            }
        }
    }
}

export function relief(srcPtr: usize, dstPtr: usize, w: i32, h: i32, angle: f32, startY: i32, endY: i32): void {
    const r = angle;
    const dr = Math.PI / 4.0;
    
    const w00 = Math.cos(r + dr);
    const w01 = Math.cos(r + 2.0 * dr);
    const w02 = Math.cos(r + 3.0 * dr);
    const w10 = Math.cos(r);
    const w11 = 1.0;
    const w12 = Math.cos(r + 4.0 * dr);
    const w20 = Math.cos(r - dr);
    const w21 = Math.cos(r - 2.0 * dr);
    const w22 = Math.cos(r - 3.0 * dr);

    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            let sumR: f64 = 0.0;
            let sumG: f64 = 0.0;
            let sumB: f64 = 0.0;

            for (let dy = -1; dy <= 1; dy++) {
                const py = y + dy;
                if (py < 0 || py >= h) continue;
                const pRow = <usize>py * <usize>w * 4;
                for (let dx = -1; dx <= 1; dx++) {
                    const px = x + dx;
                    if (px < 0 || px >= w) continue;
                    
                    let weight: f64 = 0.0;
                    if (dy == -1 && dx == -1) weight = w00;
                    else if (dy == -1 && dx == 0) weight = w01;
                    else if (dy == -1 && dx == 1) weight = w02;
                    else if (dy == 0 && dx == -1) weight = w10;
                    else if (dy == 0 && dx == 0) weight = w11;
                    else if (dy == 0 && dx == 1) weight = w12;
                    else if (dy == 1 && dx == -1) weight = w20;
                    else if (dy == 1 && dx == 0) weight = w21;
                    else if (dy == 1 && dx == 1) weight = w22;

                    const idx = pRow + (<usize>px << 2);
                    sumR += <f64>load<u8>(srcPtr + idx) * weight;
                    sumG += <f64>load<u8>(srcPtr + idx + 1) * weight;
                    sumB += <f64>load<u8>(srcPtr + idx + 2) * weight;
                }
            }
            
            const outIdx = row + (<usize>x << 2);
            store<u8>(dstPtr + outIdx,     clamp255(<f32>(sumR + 128.0)));
            store<u8>(dstPtr + outIdx + 1, clamp255(<f32>(sumG + 128.0)));
            store<u8>(dstPtr + outIdx + 2, clamp255(<f32>(sumB + 128.0)));
            store<u8>(dstPtr + outIdx + 3, load<u8>(srcPtr + outIdx + 3));
        }
    }
}

// Very simple random number generator for AssemblyScript
let seed: u32 = 12345;
function randomFloat(): f64 {
    seed = (seed * 1664525) + 1013904223;
    return <f64>seed / 4294967296.0;
}

export function frostedGlass(srcPtr: usize, dstPtr: usize, w: i32, h: i32, minRadius: f32, maxRadius: f32, samples: i32, startY: i32, endY: i32): void {
    const effectiveRadiusDelta = maxRadius - minRadius;

    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            let r: u32 = 0;
            let g: u32 = 0;
            let b: u32 = 0;
            let a: u32 = 0;

            for (let s = 0; s < samples; s++) {
                let srcX: f32 = 0;
                let srcY: f32 = 0;
                let valid = false;
                
                // Try up to 10 times to find a sample inside the image
                for (let tries = 0; tries < 10; tries++) {
                    const angle = randomFloat() * Math.PI * 2.0;
                    const distance = (randomFloat() * effectiveRadiusDelta) + minRadius;
                    srcX = <f32>x + <f32>(Math.cos(angle) * distance);
                    srcY = <f32>y + <f32>(Math.sin(angle) * distance);
                    if (srcX >= 0 && srcX < <f32>w && srcY >= 0 && srcY < <f32>h) {
                        valid = true;
                        break;
                    }
                }

                if (!valid) {
                    srcX = <f32>x;
                    srcY = <f32>y;
                }

                const px = <i32>Math.min(<f32>(w - 1), Math.max(0.0, srcX));
                const py = <i32>Math.min(<f32>(h - 1), Math.max(0.0, srcY));
                const idx = (<usize>py * <usize>w + <usize>px) << 2;

                r += load<u8>(srcPtr + idx);
                g += load<u8>(srcPtr + idx + 1);
                b += load<u8>(srcPtr + idx + 2);
                a += load<u8>(srcPtr + idx + 3);
            }

            const outIdx = row + (<usize>x << 2);
            store<u8>(dstPtr + outIdx,     <u8>(r / samples));
            store<u8>(dstPtr + outIdx + 1, <u8>(g / samples));
            store<u8>(dstPtr + outIdx + 2, <u8>(b / samples));
            store<u8>(dstPtr + outIdx + 3, <u8>(a / samples));
        }
    }
}

// Red Eye Remove
export function redEyeRemove(srcPtr: usize, dstPtr: usize, w: i32, h: i32, tolerance: i32, saturation: f32, startY: i32, endY: i32): void {
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            const r = load<u8>(srcPtr + idx);
            const g = load<u8>(srcPtr + idx + 1);
            const b = load<u8>(srcPtr + idx + 2);
            const a = load<u8>(srcPtr + idx + 3);

            let s: f32 = 0;
            const minColor = Math.min(Math.min(r, g), b);
            const maxColor = Math.max(Math.max(r, g), b);
            const delta = maxColor - minColor;

            if (maxColor != 0 && delta != 0) {
                s = <f32>delta / <f32>maxColor;
            }
            const saturationVal = <i32>(s * 255.0);
            const difference = r - Math.max(b, g);

            if (difference > tolerance && saturationVal > 100) {
                const intensity = (<f32>r * 0.30 + <f32>g * 0.59 + <f32>b * 0.11);
                const newR = clamp255(intensity * saturation);
                store<u8>(dstPtr + idx,     <u8>newR);
                store<u8>(dstPtr + idx + 1, g);
                store<u8>(dstPtr + idx + 2, b);
                store<u8>(dstPtr + idx + 3, a);
            } else {
                store<u8>(dstPtr + idx,     r);
                store<u8>(dstPtr + idx + 1, g);
                store<u8>(dstPtr + idx + 2, b);
                store<u8>(dstPtr + idx + 3, a);
            }
        }
    }
}
