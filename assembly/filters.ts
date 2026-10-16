
import { clamp255, lerp, sampleBilinear } from "./math";

/**
 * Filter Engine - Performance Algorithms
 */

// ... (existing filters: chromatic, wave, twist, etc.) ...
// I'll rewrite the file to include the new ones efficiently.

@inline
export function chromatic(srcPtr: usize, dstPtr: usize, w: i32, h: i32, shift: i32, startY: i32, endY: i32): void {
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            const rIdx = row + (<usize>Math.max(0, x - shift) << 2);
            const bIdx = row + (<usize>Math.min(w - 1, x + shift) << 2);
            store<u8>(dstPtr + idx, load<u8>(srcPtr + rIdx));
            store<u8>(dstPtr + idx + 1, load<u8>(srcPtr + idx + 1));
            store<u8>(dstPtr + idx + 2, load<u8>(srcPtr + bIdx));
            store<u8>(dstPtr + idx + 3, load<u8>(srcPtr + idx + 3));
        }
    }
}

@inline
export function wave(srcPtr: usize, dstPtr: usize, w: i32, h: i32, amp: f32, freq: f32, startY: i32, endY: i32): void {
    const k = <f32>(<f64>2.0 * Math.PI / <f64>freq);
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const sx = <f32>x + amp * <f32>Math.sin(<f64>y * k);
            const sy = <f32>y + amp * <f32>Math.cos(<f64>x * k);
            store<u32>(dstPtr + row + (<usize>x << 2), sampleBilinear(srcPtr, w, h, sx, sy));
        }
    }
}

@inline
export function twist(srcPtr: usize, dstPtr: usize, w: i32, h: i32, angle: f32, startY: i32, endY: i32): void {
    const cx = <f32>w / 2.0;
    const cy = <f32>h / 2.0;
    const maxR = <f32>Math.sqrt(<f64>(cx * cx + cy * cy));
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        const dy = <f32>y - cy;
        for (let x = 0; x < w; x++) {
            const dx = <f32>x - cx;
            const r = <f32>Math.sqrt(<f64>(dx * dx + dy * dy));
            const a = <f32>Math.atan2(<f64>dy, <f64>dx) + angle * (<f32>1.0 - r / maxR);
            store<u32>(dstPtr + row + (<usize>x << 2), sampleBilinear(srcPtr, w, h, cx + r * <f32>Math.cos(<f64>a), cy + r * <f32>Math.sin(<f64>a)));
        }
    }
}

/** New Effects Requested by User */

@inline
export function pinch(srcPtr: usize, dstPtr: usize, w: i32, h: i32, amount: f32, startY: i32, endY: i32): void {
    const cx = <f32>w / 2.0;
    const cy = <f32>h / 2.0;
    const radius = <f32>Math.min(<f64>w, <f64>h) / 2.0;
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        const dy = <f32>y - cy;
        for (let x = 0; x < w; x++) {
            const dx = <f32>x - cx;
            const d2 = dx * dx + dy * dy;
            const r = <f32>Math.sqrt(<f64>d2);
            if (r < radius) {
                const t = <f32>Math.pow(<f64>(r / radius), <f64>amount);
                store<u32>(dstPtr + row + (<usize>x << 2), sampleBilinear(srcPtr, w, h, cx + dx * t, cy + dy * t));
            } else {
                store<u32>(dstPtr + row + (<usize>x << 2), load<u32>(srcPtr + row + (<usize>x << 2)));
            }
        }
    }
}

@inline
export function vignette(srcPtr: usize, w: i32, h: i32, amount: f32, r: u8, g: u8, b: u8, blend: i32, startY: i32, endY: i32): void {
    const cx = <f32>w / 2.0;
    const cy = <f32>h / 2.0;
    const maxD = <f32>Math.sqrt(<f64>(cx * cx + cy * cy));
    
    const mR = <f32>r / 255.0;
    const mG = <f32>g / 255.0;
    const mB = <f32>b / 255.0;
    
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        const dy2 = (<f32>y - cy) * (<f32>y - cy);
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            const dx2 = (<f32>x - cx) * (<f32>x - cx);
            const dist = <f32>Math.sqrt(<f64>(dx2 + dy2)) / maxD;
            
            let d = dist * amount * 2.0;
            let mask: f32 = 0.0;
            if (d <= 0.2) mask = 1.0;
            else if (d >= 0.8) mask = 0.0;
            else {
                let t = (d - 0.8) / (0.2 - 0.8);
                mask = t * t * (3.0 - 2.0 * t);
            }
            
            const oR = <f32>load<u8>(srcPtr + idx) / 255.0;
            const oG = <f32>load<u8>(srcPtr + idx + 1) / 255.0;
            const oB = <f32>load<u8>(srcPtr + idx + 2) / 255.0;
            
            let fR = oR, fG = oG, fB = oB;
            if (blend == 1) { // Multiply
                fR = oR * mR; fG = oG * mG; fB = oB * mB;
            } else if (blend == 2) { // Screen
                fR = 1.0 - (1.0 - oR) * (1.0 - mR);
                fG = 1.0 - (1.0 - oG) * (1.0 - mG);
                fB = 1.0 - (1.0 - oB) * (1.0 - mB);
            } else if (blend == 3) { // Overlay
                fR = (oR < 0.5) ? (2.0 * oR * mR) : (1.0 - 2.0 * (1.0 - oR) * (1.0 - mR));
                fG = (oG < 0.5) ? (2.0 * oG * mG) : (1.0 - 2.0 * (1.0 - oG) * (1.0 - mG));
                fB = (oB < 0.5) ? (2.0 * oB * mB) : (1.0 - 2.0 * (1.0 - oB) * (1.0 - mB));
            } else { // Normal
                fR = mR; fG = mG; fB = mB;
            }
            
            store<u8>(srcPtr + idx, clamp255((oR * mask + fR * (1.0 - mask)) * 255.0));
            store<u8>(srcPtr + idx + 1, clamp255((oG * mask + fG * (1.0 - mask)) * 255.0));
            store<u8>(srcPtr + idx + 2, clamp255((oB * mask + fB * (1.0 - mask)) * 255.0));
        }
    }
}

// ... rest of the standard filters ...

export function adjustBCS(srcPtr: usize, w: i32, h: i32, brightness: f32, contrast: f32, startY: i32, endY: i32): void {
    const b = brightness / 100.0;
    const c = (contrast + 100.0) / 100.0;
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            for (let i: usize = 0; i < 3; i++) {
                let v = <f32>load<u8>(srcPtr + idx + i) / 255.0;
                v = (v - 0.5) * c + 0.5 + b;
                store<u8>(srcPtr + idx + i, clamp255(v * 255.0));
            }
        }
    }
}

export function invert(srcPtr: usize, w: i32, h: i32, startY: i32, endY: i32): void {
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            store<u8>(srcPtr + idx, 255 - load<u8>(srcPtr + idx));
            store<u8>(srcPtr + idx + 1, 255 - load<u8>(srcPtr + idx + 1));
            store<u8>(srcPtr + idx + 2, 255 - load<u8>(srcPtr + idx + 2));
        }
    }
}

export function grayscale(srcPtr: usize, w: i32, h: i32, startY: i32, endY: i32): void {
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            const r = load<u8>(srcPtr + idx);
            const g = load<u8>(srcPtr + idx + 1);
            const b = load<u8>(srcPtr + idx + 2);
            const gray = <u8>(0.299 * <f32>r + 0.587 * <f32>g + 0.114 * <f32>b);
            store<u8>(srcPtr + idx, gray);
            store<u8>(srcPtr + idx + 1, gray);
            store<u8>(srcPtr + idx + 2, gray);
        }
    }
}

export function posterize(srcPtr: usize, w: i32, h: i32, levels: f32, startY: i32, endY: i32): void {
    const step = 255.0 / (levels - 1.0);
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            store<u8>(srcPtr + idx, <u8>(Math.floor(<f64>load<u8>(srcPtr + idx) / <f64>step) * step));
            store<u8>(srcPtr + idx + 1, <u8>(Math.floor(<f64>load<u8>(srcPtr + idx + 1) / <f64>step) * step));
            store<u8>(srcPtr + idx + 2, <u8>(Math.floor(<f64>load<u8>(srcPtr + idx + 2) / <f64>step) * step));
        }
    }
}

export function boxBlur(srcPtr: usize, dstPtr: usize, w: i32, h: i32, radius: i32, startY: i32, endY: i32): void {
    // Simplified box blur for performance in Wasm
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            let r: u32 = 0, g: u32 = 0, b: u32 = 0, count: u32 = 0;
            for (let ky = -radius; ky <= radius; ky++) {
                const py = y + ky;
                if (py < 0 || py >= h) continue;
                for (let kx = -radius; kx <= radius; kx++) {
                    const px = x + kx;
                    if (px < 0 || px >= w) continue;
                    const kidx = (<usize>py * <usize>w + <usize>px) << 2;
                    r += load<u8>(srcPtr + kidx);
                    g += load<u8>(srcPtr + kidx + 1);
                    b += load<u8>(srcPtr + kidx + 2);
                    count++;
                }
            }
            store<u8>(dstPtr + row + (<usize>x << 2), <u8>(r / count));
            store<u8>(dstPtr + row + (<usize>x << 2) + 1, <u8>(g / count));
            store<u8>(dstPtr + row + (<usize>x << 2) + 2, <u8>(b / count));
            store<u8>(dstPtr + row + (<usize>x << 2) + 3, load<u8>(srcPtr + row + (<usize>x << 2) + 3));
        }
    }
}

@inline
export function crystallize(srcPtr: usize, dstPtr: usize, w: i32, h: i32, size: f32, startY: i32, endY: i32): void {
    if (size < 1.0) size = 1.0;
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        const cy = <i32>(Math.floor(<f64>y / <f64>size) * <f64>size + <f64>size / 2.0);
        const cyClamped = <usize>Math.min(<f64>h - 1, <f64>cy);
        for (let x = 0; x < w; x++) {
            const cx = <i32>(Math.floor(<f64>x / <f64>size) * <f64>size + <f64>size / 2.0);
            const cxClamped = <usize>Math.min(<f64>w - 1, <f64>cx);
            const srcIdx = (cyClamped * <usize>w + cxClamped) << 2;
            store<u32>(dstPtr + row + (<usize>x << 2), load<u32>(srcPtr + srcIdx));
        }
    }
}

export function softglow(srcPtr: usize, w: i32, h: i32, amount: f32, startY: i32, endY: i32): void {
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            let r = <f32>load<u8>(srcPtr + idx);
            let g = <f32>load<u8>(srcPtr + idx + 1);
            let b = <f32>load<u8>(srcPtr + idx + 2);
            const luma = <f32>0.299 * r + <f32>0.587 * g + <f32>0.114 * b;
            if (luma > <f32>128.0) {
                const factor = <f32>((luma - <f32>128.0) / <f32>127.0 * amount);
                r += r * factor;
                g += g * factor;
                b += b * factor;
            }
            store<u8>(srcPtr + idx, clamp255(r));
            store<u8>(srcPtr + idx + 1, clamp255(g));
            store<u8>(srcPtr + idx + 2, clamp255(b));
        }
    }
}

export function resize(srcPtr: usize, dstPtr: usize, sw: i32, sh: i32, dw: i32, dh: i32): void {
    const xRatio: f32 = <f32>sw / <f32>dw;
    const yRatio: f32 = <f32>sh / <f32>dh;
    for (let y: i32 = 0; y < dh; y++) {
        const dRow: usize = <usize>y * <usize>dw << 2;
        const py: f32 = <f32>y * yRatio;
        for (let x: i32 = 0; x < dw; x++) {
            const px: f32 = <f32>x * xRatio;
            store<u32>(dstPtr + dRow + (<usize>x << 2), sampleBilinear(srcPtr, sw, sh, px, py));
        }
    }
}

/** Pixel Mode Optimizations */

const BAYER_MATRIX = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
];

export function orderedDither(srcPtr: usize, w: i32, h: i32, size: i32, invert: bool, startY: i32, endY: i32): void {
    const s = size > 0 ? size : 1;
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        const my = (y / s) % 8;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            const a = load<u8>(srcPtr + idx + 3);
            if (a < 128) {
                store<u32>(srcPtr + idx, 0);
                continue;
            }
            
            const r = load<u8>(srcPtr + idx);
            const g = load<u8>(srcPtr + idx + 1);
            const b = load<u8>(srcPtr + idx + 2);
            
            const luma = <f32>(0.299 * <f32>r + 0.587 * <f32>g + 0.114 * <f32>b);
            const mx = (x / s) % 8;
            
            // Accessing matrix. AssemblyScript handles static arrays well if typed.
            // For simplicity and speed, we can use unchecked or inline values.
            const threshold = <f32>unchecked(BAYER_MATRIX[my][mx]) * 4.0; // 256 / 64 = 4
            
            let v: u8 = luma >= threshold ? 255 : 0;
            if (invert) v = 255 - v;
            
            const color = (<u32>v) | (<u32>v << 8) | (<u32>v << 16) | (255 << 24);
            store<u32>(srcPtr + idx, color);
        }
    }
}

export function pixelate(srcPtr: usize, dstPtr: usize, w: i32, h: i32, size: i32, startY: i32, endY: i32): void {
    const s = size > 0 ? size : 1;
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        const py = (y / s) * s;
        const pyClamped = <usize>Math.min(<f64>h - 1, <f64>py);
        for (let x = 0; x < w; x++) {
            const px = (x / s) * s;
            const pxClamped = <usize>Math.min(<f64>w - 1, <f64>px);
            const srcIdx = (pyClamped * <usize>w + pxClamped) << 2;
            store<u32>(dstPtr + row + (<usize>x << 2), load<u32>(srcPtr + srcIdx));
        }
    }
}

export function sepia(srcPtr: usize, w: i32, h: i32, startY: i32, endY: i32): void {
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            const r = <f32>load<u8>(srcPtr + idx);
            const g = <f32>load<u8>(srcPtr + idx + 1);
            const b = <f32>load<u8>(srcPtr + idx + 2);
            
            store<u8>(srcPtr + idx,     clamp255(r * 0.393 + g * 0.769 + b * 0.189));
            store<u8>(srcPtr + idx + 1, clamp255(r * 0.349 + g * 0.686 + b * 0.168));
            store<u8>(srcPtr + idx + 2, clamp255(r * 0.272 + g * 0.534 + b * 0.131));
        }
    }
}

export function exposure(srcPtr: usize, w: i32, h: i32, exp: f32, gamma: f32, startY: i32, endY: i32): void {
    const invG = gamma > 0.05 ? 1.0 / gamma : 1.0;
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            for (let c: usize = 0; c < 3; c++) {
                let v = <f32>load<u8>(srcPtr + idx + c) * exp;
                let res = <f32>(Math.pow(<f64>v / 255.0, <f64>invG) * 255.0);
                store<u8>(srcPtr + idx + c, clamp255(res));
            }
        }
    }
}

export function halftone(srcPtr: usize, w: i32, h: i32, dotSize: f32, startY: i32, endY: i32): void {
    const freq = <f32>(<f64>2.0 * Math.PI / <f64>dotSize);
    const angle = <f32>(Math.PI / 4.0);
    const cosA = <f32>Math.cos(<f64>angle);
    const sinA = <f32>Math.sin(<f64>angle);
    
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            const r = load<u8>(srcPtr + idx);
            const g = load<u8>(srcPtr + idx + 1);
            const b = load<u8>(srcPtr + idx + 2);
            const luma = (0.299 * <f32>r + 0.587 * <f32>g + 0.114 * <f32>b) / 255.0;
            
            const rotX = <f32>x * cosA - <f32>y * sinA;
            const rotY = <f32>x * sinA + <f32>y * cosA;
            const pattern = <f32>((Math.sin(<f64>(rotX * freq)) + Math.sin(<f64>(rotY * freq))) / 2.0);
            const thresh = (pattern + 1.0) / 2.0;
            const v: u8 = luma >= thresh ? 255 : 0;
            
            store<u8>(srcPtr + idx, v);
            store<u8>(srcPtr + idx + 1, v);
            store<u8>(srcPtr + idx + 2, v);
        }
    }
}

@inline
function getGray(ptr: usize, w: i32, px: i32, py: i32): f32 {
    const idx = (<usize>py * <usize>w + <usize>px) << 2;
    return 0.299 * <f32>load<u8>(ptr + idx) + 0.587 * <f32>load<u8>(ptr + idx + 1) + 0.114 * <f32>load<u8>(ptr + idx + 2);
}

export function edgeDetect(srcPtr: usize, dstPtr: usize, w: i32, h: i32, sensitivity: f32, startY: i32, endY: i32): void {
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            if (x == 0 || x == w - 1 || y == 0 || y == h - 1) {
                store<u32>(dstPtr + row + (<usize>x << 2), 0);
                continue;
            }
            
            const h_ = getGray(srcPtr, w, x - 1, y - 1) + 2.0 * getGray(srcPtr, w, x - 1, y) + getGray(srcPtr, w, x - 1, y + 1) 
                     - (getGray(srcPtr, w, x + 1, y - 1) + 2.0 * getGray(srcPtr, w, x + 1, y) + getGray(srcPtr, w, x + 1, y + 1));
            const v_ = getGray(srcPtr, w, x - 1, y - 1) + 2.0 * getGray(srcPtr, w, x, y - 1) + getGray(srcPtr, w, x + 1, y - 1) 
                     - (getGray(srcPtr, w, x - 1, y + 1) + 2.0 * getGray(srcPtr, w, x, y + 1) + getGray(srcPtr, w, x + 1, y + 1));
            
            const edge = <f32>Math.sqrt(<f64>(h_ * h_ + v_ * v_));
            const v = clamp255(edge * sensitivity * 4.0);
            const idx = row + (<usize>x << 2);
            store<u8>(dstPtr + idx, v);
            store<u8>(dstPtr + idx + 1, v);
            store<u8>(dstPtr + idx + 2, v);
            store<u8>(dstPtr + idx + 3, load<u8>(srcPtr + idx + 3));
        }
    }
}

export function scanlines(srcPtr: usize, w: i32, h: i32, density: f32, opacity: f32, startY: i32, endY: i32): void {
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        const line = <f32>Math.sin(<f64>y * <f64>density);
        const factor = <f32>(1.0 - (line < 0 ? -line : line) * opacity);
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            store<u8>(srcPtr + idx,     clamp255(<f32>load<u8>(srcPtr + idx) * factor));
            store<u8>(srcPtr + idx + 1, clamp255(<f32>load<u8>(srcPtr + idx + 1) * factor));
            store<u8>(srcPtr + idx + 2, clamp255(<f32>load<u8>(srcPtr + idx + 2) * factor));
        }
    }
}

/** Layer Blending & Masking Optimizations */

export function blendMask(basePtr: usize, filteredPtr: usize, maskPtr: usize, outPtr: usize, w: i32, h: i32, startY: i32, endY: i32): void {
    const inv255: f32 = 1.0 / 255.0;
    for (let y = startY; y < endY; y++) {
        const row = <usize>y * <usize>w * 4;
        for (let x = 0; x < w; x++) {
            const idx = row + (<usize>x << 2);
            const m: f32 = <f32>load<u8>(maskPtr + idx + 3) * inv255;
            const om: f32 = 1.0 - m;
            
            store<u8>(outPtr + idx,     <u8>(<f32>load<u8>(basePtr + idx) * om + <f32>load<u8>(filteredPtr + idx) * m + 0.5));
            store<u8>(outPtr + idx + 1, <u8>(<f32>load<u8>(basePtr + idx + 1) * om + <f32>load<u8>(filteredPtr + idx + 1) * m + 0.5));
            store<u8>(outPtr + idx + 2, <u8>(<f32>load<u8>(basePtr + idx + 2) * om + <f32>load<u8>(filteredPtr + idx + 2) * m + 0.5));
            store<u8>(outPtr + idx + 3, load<u8>(basePtr + idx + 3));
        }
    }
}

export function buildDynamicMask(layerPtr: usize, maskPtr: usize, lw: i32, lh: i32, lx: i32, ly: i32, dw: i32, dh: i32, opacity: f32): void {
    for (let py = 0; py < dh; py++) {
        const row = <usize>py * <usize>dw * 4;
        const lpy = py - ly;
        for (let px = 0; px < dw; px++) {
            const lpx = px - lx;
            const idx = row + (<usize>px << 2);
            if (lpx < 0 || lpy < 0 || lpx >= lw || lpy >= lh) {
                store<u32>(maskPtr + idx, 0);
                continue;
            }
            const lIdx = (<usize>lpy * <usize>lw + <usize>lpx) << 2;
            const r = <f32>load<u8>(layerPtr + lIdx);
            const g = <f32>load<u8>(layerPtr + lIdx + 1);
            const b = <f32>load<u8>(layerPtr + lIdx + 2);
            const a = <f32>load<u8>(layerPtr + lIdx + 3) / 255.0;
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
            const val = <u8>(clamp255(<f32>(lum * a * opacity * 255.0)));
            store<u8>(maskPtr + idx, 0);
            store<u8>(maskPtr + idx + 1, 0);
            store<u8>(maskPtr + idx + 2, 0);
            store<u8>(maskPtr + idx + 3, val);
        }
    }
}

export function applyLuminanceMask(layerPtr: usize, maskPtr: usize, outPtr: usize, lw: i32, lh: i32, lx: i32, ly: i32, mw: i32, mh: i32, dw: i32, dh: i32): void {
    for (let py = 0; py < dh; py++) {
        const row = <usize>py * <usize>dw * 4;
        const lpy = py - ly;
        for (let px = 0; px < dw; px++) {
            const lpx = px - lx;
            const idx = row + (<usize>px << 2);
            if (lpx < 0 || lpy < 0 || lpx >= lw || lpy >= lh) {
                store<u32>(outPtr + idx, 0);
                continue;
            }
            const lIdx = (<usize>lpy * <usize>lw + <usize>lpx) << 2;
            let alpha = <f32>load<u8>(layerPtr + lIdx + 3);
            if (lpx < mw && lpy < mh) {
                const k = (<usize>lpy * <usize>mw + <usize>lpx) << 2;
                const r = <f32>load<u8>(maskPtr + k);
                const g = <f32>load<u8>(maskPtr + k + 1);
                const b = <f32>load<u8>(maskPtr + k + 2);
                const a = <f32>load<u8>(maskPtr + k + 3) / 255.0;
                const lum = ((0.299 * r + 0.587 * g + 0.114 * b) / 255.0) * a;
                alpha *= <f32>lum;
            }
            store<u8>(outPtr + idx, load<u8>(layerPtr + lIdx));
            store<u8>(outPtr + idx + 1, load<u8>(layerPtr + lIdx + 1));
            store<u8>(outPtr + idx + 2, load<u8>(layerPtr + lIdx + 2));
            store<u8>(outPtr + idx + 3, <u8>(alpha + 0.5));
        }
    }
}

export function similarColor(dataPtr: usize, maskPtr: usize, w: i32, h: i32, sr: u8, sg: u8, sb: u8, sa: u8, tol: f32): void {
    const tolSq = tol * tol;
    for (let i = 0; i < w * h; i++) {
        const idx = i << 2;
        const dr = <f32>load<u8>(dataPtr + idx) - <f32>sr;
        const dg = <f32>load<u8>(dataPtr + idx + 1) - <f32>sg;
        const db = <f32>load<u8>(dataPtr + idx + 2) - <f32>sb;
        const da = <f32>load<u8>(dataPtr + idx + 3) - <f32>sa;
        if ((dr * dr + dg * dg + db * db + da * da) <= tolSq) {
            store<u8>(maskPtr + i, 1);
        } else {
            store<u8>(maskPtr + i, 0);
        }
    }
}

/**
 * Enhanced Color Match for Wand/Fill tools (Photoshop-like)
 */
export function colorMatch(dataPtr: usize, maskPtr: usize, w: i32, h: i32, r0: u8, g0: u8, b0: u8, a0: u8, rgbMax: f32, alphaMax: f32): void {
    const rgbMaxSq = rgbMax * rgbMax;
    for (let i = 0; i < w * h; i++) {
        const idx = i << 2;
        const dr = <f32>load<u8>(dataPtr + idx) - <f32>r0;
        const dg = <f32>load<u8>(dataPtr + idx + 1) - <f32>g0;
        const db = <f32>load<u8>(dataPtr + idx + 2) - <f32>b0;
        const da = <f32>Math.abs(<f64>load<u8>(dataPtr + idx + 3) - <f64>a0);
        
        const distRgbSq = dr * dr + dg * dg + db * db;
        if (distRgbSq <= rgbMaxSq && da <= alphaMax) {
            store<u8>(maskPtr + i, 1);
        } else {
            store<u8>(maskPtr + i, 0);
        }
    }
}

/**
 * Converts alpha channel to grayscale (for filter preview)
 */
export function grayscaleAlpha(srcPtr: usize, dstPtr: usize, w: i32, h: i32): void {
    for (let i: usize = 0; i < <usize>w * <usize>h; i++) {
        const idx = i << 2;
        const a = load<u8>(srcPtr + idx + 3);
        store<u8>(dstPtr + idx, a);
        store<u8>(dstPtr + idx + 1, a);
        store<u8>(dstPtr + idx + 2, a);
        store<u8>(dstPtr + idx + 3, 255);
    }
}

/**
 * Finds edges in a binary mask and returns them as segments (x, y, dx, dy).
 * outPtr must point to a Float32Array of sufficient size.
 */
export function getMaskOutlineSegments(maskPtr: usize, w: i32, h: i32, startX: i32, startY: i32, endX: i32, endY: i32, stride: i32, outPtr: usize, maxSegments: i32): i32 {
    let count: i32 = 0;
    
    // Vertical edges
    for (let y = startY; y < endY; y += stride) {
        const rowOffset = <usize>y * <usize>w;
        for (let x = startX; x <= endX; x += stride) {
            const valCurrent = (x < w) ? load<u8>(maskPtr + rowOffset + <usize>x) : 0;
            const valPrev = (x >= stride) ? load<u8>(maskPtr + rowOffset + <usize>(x - stride)) : 0;
            if (valCurrent != valPrev) {
                if (count >= maxSegments) return count;
                const offset = <usize>count << 4; // count * 16
                store<f32>(outPtr + offset, <f32>x);
                store<f32>(outPtr + offset + 4, <f32>y);
                store<f32>(outPtr + offset + 8, 0);
                store<f32>(outPtr + offset + 12, <f32>stride);
                count++;
            }
        }
    }
    
    // Horizontal edges
    for (let y = startY; y <= endY; y += stride) {
        const rowOffset = (y < h) ? <usize>y * <usize>w : <usize>-1;
        const prevRowOffset = (y >= stride) ? <usize>(y - stride) * <usize>w : <usize>-1;
        for (let x = startX; x < endX; x += stride) {
            const valCurrent = (rowOffset != <usize>-1) ? load<u8>(maskPtr + rowOffset + <usize>x) : 0;
            const valPrev = (prevRowOffset != <usize>-1) ? load<u8>(maskPtr + prevRowOffset + <usize>x) : 0;
            if (valCurrent != valPrev) {
                if (count >= maxSegments) return count;
                const offset = <usize>count << 4; // count * 16
                store<f32>(outPtr + offset, <f32>x);
                store<f32>(outPtr + offset + 4, <f32>y);
                store<f32>(outPtr + offset + 8, <f32>stride);
                store<f32>(outPtr + offset + 12, 0);
                count++;
            }
        }
    }
    
    return count;
}

// Magic Wand Flood Fill
export function magicWand(dataPtr: usize, maskPtr: usize, w: i32, h: i32, startX: i32, startY: i32, sr: u8, sg: u8, sb: u8, sa: u8, tol: f32): void {
    const tolSq = tol * tol;
    const size = w * h;
    const visited = new Uint8Array(size);
    const stack = new Int32Array(size * 2); // Max possible points
    let stackPtr = 0;

    stack[stackPtr++] = startX;
    stack[stackPtr++] = startY;
    visited[startY * w + startX] = 1;
    store<u8>(maskPtr + startY * w + startX, 1);

    while (stackPtr > 0) {
        const y = stack[--stackPtr];
        const x = stack[--stackPtr];

        // 4-way neighbors
        const dx = [1, -1, 0, 0];
        const dy = [0, 0, 1, -1];

        for (let i = 0; i < 4; i++) {
            const nx = x + dx[i];
            const ny = y + dy[i];

            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const vi = ny * w + nx;
                if (!visited[vi]) {
                    visited[vi] = 1;
                    const idx = vi << 2;
                    const dr = <f32>load<u8>(dataPtr + idx) - <f32>sr;
                    const dg = <f32>load<u8>(dataPtr + idx + 1) - <f32>sg;
                    const db = <f32>load<u8>(dataPtr + idx + 2) - <f32>sb;
                    const da = <f32>load<u8>(dataPtr + idx + 3) - <f32>sa;
                    if ((dr * dr + dg * dg + db * db + da * da) <= tolSq) {
                        store<u8>(maskPtr + vi, 1);
                        stack[stackPtr++] = nx;
                        stack[stackPtr++] = ny;
                    }
                }
            }
        }
    }
}
