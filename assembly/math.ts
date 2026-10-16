
/** Optimized Math Utilities for MasterPaint Wasm Engine */

export class HSV {
    h: f32;
    s: f32;
    v: f32;
}

export class RGB {
    r: f32;
    g: f32;
    b: f32;
}

@inline
export function isNaN(val: f32): bool {
     return val != val;
}

@inline
export function clamp255(val: f32): u8 {
    if (isNaN(val)) return 0;
    if (val < <f32>0) return 0;
    if (val > <f32>255) return 255;
    return <u8>val;
}

@inline
export function clamp01(val: f32): f32 {
    if (isNaN(val)) return 0;
    if (val < <f32>0) return 0;
    if (val > <f32>1) return 1;
    return val;
}

@inline
export function lerp(a: f32, b: f32, t: f32): f32 {
    return <f32>(a + <f32>((b - a) * t));
}

const _hsv = new HSV();
@inline
export function rgbToHsv(r: f32, g: f32, b: f32): HSV {
    let rf: f32 = r / <f32>255;
    let gf: f32 = g / <f32>255;
    let bf: f32 = b / <f32>255;

    let max: f32 = <f32>Math.max(rf, <f32>Math.max(gf, bf));
    let min: f32 = <f32>Math.min(rf, <f32>Math.min(gf, bf));
    let d: f32 = <f32>(max - min);
    let h: f32 = 0, s: f32 = 0, v: f32 = max;

    s = max == <f32>0 ? <f32>0 : <f32>(d / max);

    if (max == min || d < 0.00001) {
        h = 0;
    } else {
        if (max == rf) {
            h = <f32>(<f32>(gf - bf) / d + (gf < bf ? <f32>6.0 : <f32>0));
        } else if (max == gf) {
            h = <f32>(<f32>(bf - rf) / d + <f32>2.0);
        } else {
            h = <f32>(<f32>(rf - gf) / d + <f32>4.0);
        }
        h /= <f32>6.0;
    }
    _hsv.h = <f32>(h * <f32>360.0);
    _hsv.s = <f32>(s * <f32>100.0);
    _hsv.v = <f32>(v * <f32>100.0);
    return _hsv;
}

const _rgb = new RGB();
@inline
export function hsvToRgb(h: f32, s: f32, v: f32): RGB {
    let hf: f32 = h / <f32>360.0;
    let sf: f32 = s / <f32>100.0;
    let vf: f32 = v / <f32>100.0;

    if (hf < 0) hf = 0; if (hf > 1) hf = 1;
    if (sf < 0) sf = 0; if (sf > 1) sf = 1;
    if (vf < 0) vf = 0; if (vf > 1) vf = 1;

    let i: i32 = <i32>Math.floor(<f64>(hf * <f32>6));
    let f: f32 = <f32>(hf * <f32>6 - <f32>i);
    let p: f32 = <f32>(vf * (<f32>1.0 - sf));
    let q: f32 = <f32>(vf * (<f32>1.0 - <f32>(f * sf)));
    let t: f32 = <f32>(vf * (<f32>1.0 - <f32>(<f32>(<f32>1.0 - f) * sf)));
    
    let r: f32 = 0, g: f32 = 0, b: f32 = 0;
    switch (i % 6) {
        case 0: r = vf; g = t; b = p; break;
        case 1: r = q; g = vf; b = p; break;
        case 2: r = p; g = vf; b = t; break;
        case 3: r = p; g = q; b = vf; break;
        case 4: r = t; g = p; b = vf; break;
        default: r = vf; g = p; b = q; break;
    }
    _rgb.r = <f32>(r * <f32>255);
    _rgb.g = <f32>(g * <f32>255);
    _rgb.b = <f32>(b * <f32>255);
    return _rgb;
}

@inline
export function sampleBilinear(ptr: usize, w: i32, h: i32, x: f32, y: f32): u32 {
    if (isNaN(x) || isNaN(y)) {
        return 0;
    }
    if (x < <f32>0) x = 0;
    if (y < <f32>0) y = 0;
    if (x >= <f32>w - <f32>1) x = <f32>(<f64>w - 1.000001);
    if (y >= <f32>h - <f32>1) y = <f32>(<f64>h - 1.000001);

    const x0: i32 = <i32>Math.floor(<f64>x);
    const y0: i32 = <i32>Math.floor(<f64>y);
    const x1: i32 = x0 + 1;
    const y1: i32 = y0 + 1;

    const tx: f32 = <f32>(x - <f32>x0);
    const ty: f32 = <f32>(y - <f32>y0);

    const i00: usize = (<usize>y0 * <usize>w + <usize>x0) << 2;
    const i10: usize = (<usize>y0 * <usize>w + <usize>x1) << 2;
    const i01: usize = (<usize>y1 * <usize>w + <usize>x0) << 2;
    const i11: usize = (<usize>y1 * <usize>w + <usize>x1) << 2;

    const r: f32 = <f32>lerp(<f32>lerp(<f32>load<u8>(ptr + i00), <f32>load<u8>(ptr + i10), tx), <f32>lerp(<f32>load<u8>(ptr + i01), <f32>load<u8>(ptr + i11), tx), ty);
    const g: f32 = <f32>lerp(<f32>lerp(<f32>load<u8>(ptr + i00 + 1), <f32>load<u8>(ptr + i10 + 1), tx), <f32>lerp(<f32>load<u8>(ptr + i01 + 1), <f32>load<u8>(ptr + i11 + 1), tx), ty);
    const b: f32 = <f32>lerp(<f32>lerp(<f32>load<u8>(ptr + i00 + 2), <f32>load<u8>(ptr + i10 + 2), tx), <f32>lerp(<f32>load<u8>(ptr + i01 + 2), <f32>load<u8>(ptr + i11 + 2), tx), ty);
    const a: f32 = <f32>lerp(<f32>lerp(<f32>load<u8>(ptr + i00 + 3), <f32>load<u8>(ptr + i10 + 3), tx), <f32>lerp(<f32>load<u8>(ptr + i01 + 3), <f32>load<u8>(ptr + i11 + 3), tx), ty);

    return (<u32>clamp255(r)) | (<u32>clamp255(g) << 8) | (<u32>clamp255(b) << 16) | (<u32>clamp255(a) << 24);
}
