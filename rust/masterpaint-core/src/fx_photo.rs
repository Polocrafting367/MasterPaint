//! Photo : netteté, masque flou, éclat, portrait adouci, vignette, yeux rouges.

use crate::util::*;

/// Netteté (original + (original − flou) × force) : p: [force %, rayon]
pub fn sharpen(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let amt = p.f(0, 45.0) / 100.0;
    let r = p.f(1, 1.0).max(1.0) as usize;
    let (blur, ya) = box_blur_for(src, y0, y1, r, 1);
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = src.idx(x, y);
            let o = ((y - ya) * w + x) * 4;
            let f = |c: usize| src.d[i + c] as f32 + (src.d[i + c] as f32 - blur[o + c] as f32) * amt;
            put(dst, i, f(0), f(1), f(2), src.d[i + 3] as f32);
        }
    }
}

/// Masque flou : p: [intensité %, rayon, seuil]
pub fn unsharp(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let amt = p.f(0, 80.0) / 100.0;
    let r = p.f(1, 3.0).max(1.0) as usize;
    let thr = p.f(2, 0.0);
    let (blur, ya) = box_blur_for(src, y0, y1, r, 1);
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = src.idx(x, y);
            let o = ((y - ya) * w + x) * 4;
            let f = |c: usize| {
                let v = src.d[i + c] as f32;
                let d = v - blur[o + c] as f32;
                if d > thr || d < -thr { v + amt * d } else { v }
            };
            put(dst, i, f(0), f(1), f(2), src.d[i + 3] as f32);
        }
    }
}

/// Éclat / lueur douce (additif, comme le worker) : p: [rayon, intensité %]
pub fn glow(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let r = p.f(0, 6.0).max(1.0) as usize;
    let am = p.f(1, 40.0) / 100.0;
    let (blur, ya) = box_blur_for(src, y0, y1, r, 1);
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = src.idx(x, y);
            let o = ((y - ya) * w + x) * 4;
            let f = |c: usize| src.d[i + c] as f32 + blur[o + c] as f32 * am;
            put(dst, i, f(0), f(1), f(2), src.d[i + 3] as f32);
        }
    }
}

/// Portrait adouci (OpenPDN SoftenPortrait) : p: [douceur, éclairage, chaleur]
pub fn soften_portrait(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let softness = p.f(0, 5.0);
    let lighting = p.f(1, 0.0);
    let warmth = p.f(2, 10.0);
    let r = (softness * 3.0).max(0.0) as usize;
    let (blur, ya) = box_blur_for(src, y0, y1, r, 1);
    let cf = (259.0 * (-(lighting / 2.0) + 255.0)) / (255.0 * (259.0 - (-(lighting / 2.0))));
    let (red_adj, blue_adj) = (1.0 + warmth / 100.0, 1.0 - warmth / 100.0);
    let ov = |base: f32, top: f32| if base < 128.0 { 2.0 * base * top / 255.0 } else { 255.0 - 2.0 * (255.0 - base) * (255.0 - top) / 255.0 };
    let bc = |c: f32| clampf(cf * (c - 127.0) + 127.0 + lighting, 0.0, 255.0);
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = src.idx(x, y);
            let o = ((y - ya) * w + x) * 4;
            let g = luma_pdn(&src.px(x, y)) as f32;
            let gr = clampf(g * red_adj, 0.0, 255.0);
            let gb = clampf(g * blue_adj, 0.0, 255.0);
            put(dst, i, ov(bc(blur[o] as f32), gr), ov(bc(blur[o + 1] as f32), g), ov(bc(blur[o + 2] as f32), gb), src.d[i + 3] as f32);
        }
    }
}

/// Vignette : p: [intensité %, couleur 0xRRGGBB, mode 0=normal 1=produit 2=écran 3=incrustation, centre x %, centre y %]
pub fn vignette(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let vig = p.f(0, 50.0) / 100.0;
    let vc = p.rgb(1, 0);
    let blend = p.i(2, 0);
    let cx = src.w as f32 / 2.0 * (1.0 + p.f(3, 0.0) / 100.0);
    let cy = src.h as f32 / 2.0 * (1.0 + p.f(4, 0.0) / 100.0);
    let mr = (src.w as f32 / 2.0).fhypot(src.h as f32 / 2.0).max(1.0);
    let m = [vc[0] / 255.0, vc[1] / 255.0, vc[2] / 255.0];
    for y in y0..y1 {
        for x in 0..src.w {
            let d = (x as f32 - cx).fhypot(y as f32 - cy) / mr * vig * 2.0;
            let mask = if d <= 0.2 {
                1.0
            } else if d >= 0.8 {
                0.0
            } else {
                let t = (d - 0.2) / 0.6;
                1.0 - t * t * (3.0 - 2.0 * t)
            };
            let i = src.idx(x, y);
            let mut out = [0.0f32; 3];
            for c in 0..3 {
                let o = src.d[i + c] as f32 / 255.0;
                let f = match blend {
                    1 => o * m[c],
                    2 => 1.0 - (1.0 - o) * (1.0 - m[c]),
                    3 => if o < 0.5 { 2.0 * o * m[c] } else { 1.0 - 2.0 * (1.0 - o) * (1.0 - m[c]) },
                    _ => m[c],
                };
                out[c] = (o * mask + f * (1.0 - mask)) * 255.0;
            }
            put(dst, i, out[0], out[1], out[2], src.d[i + 3] as f32);
        }
    }
}

/// Suppression des yeux rouges (OpenPDN UnaryPixelOps.RedEyeRemove) : p: [tolérance, saturation %]
pub fn red_eye(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let tol = p.f(0, 70.0);
    let set_sat = p.f(1, 90.0) / 100.0;
    for y in y0..y1 {
        for x in 0..src.w {
            let i = src.idx(x, y);
            let q = src.px(x, y);
            let (r, g, b) = (q[0] as f32, q[1] as f32, q[2] as f32);
            let mx = r.max(g).max(b);
            let mn = r.min(g).min(b);
            let sat = if mx > 0.0 { 255.0 * (mx - mn) / mx } else { 0.0 };
            let diff = r - g.max(b);
            if diff > tol && sat > 100.0 {
                let inten = luma_pdn(&q) as f32;
                put(dst, i, inten * set_sat, g, b, q[3] as f32);
            } else {
                dst[i..i + 4].copy_from_slice(&q);
            }
        }
    }
}
