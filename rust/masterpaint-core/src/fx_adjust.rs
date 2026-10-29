//! Ajustements (menu « Ajustements » de Paint.NET) et effets couleur ponctuels.

use crate::util::*;

/// Applique `f` à chaque pixel des lignes [y0,y1).
#[inline]
fn per_pixel<F: Fn([u8; 4]) -> [f32; 4]>(src: &Img, dst: &mut Out, y0: usize, y1: usize, f: F) {
    let a = y0 * src.w * 4;
    let b = y1 * src.w * 4;
    let mut i = a;
    while i < b {
        let p = [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]];
        let o = f(p);
        put(dst, i, o[0], o[1], o[2], o[3]);
        i += 4;
    }
}

/// p: [luminosité, contraste, température, teinte]
pub fn brightness(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let br = p.f(0, 0.0);
    let co = p.f(1, 0.0);
    let temp = p.f(2, 0.0) * 0.5;
    let tint = p.f(3, 0.0) * 0.5;
    let f = (259.0 * (co + 255.0)) / (255.0 * (259.0 - co));
    per_pixel(src, dst, y0, y1, |q| {
        let r = f * (q[0] as f32 + br - 128.0) + 128.0 + temp;
        let g = f * (q[1] as f32 + br - 128.0) + 128.0 - tint;
        let b = f * (q[2] as f32 + br - 128.0) + 128.0 - temp;
        [r, g, b, q[3] as f32]
    });
}

/// Noir et blanc (Rec.601, comme le worker).
pub fn grayscale(src: &Img, dst: &mut Out, y0: usize, y1: usize, _p: &P) {
    per_pixel(src, dst, y0, y1, |q| {
        let l = luma601(q[0] as f32, q[1] as f32, q[2] as f32);
        [l, l, l, q[3] as f32]
    });
}

pub fn invert(src: &Img, dst: &mut Out, y0: usize, y1: usize, _p: &P) {
    per_pixel(src, dst, y0, y1, |q| [255.0 - q[0] as f32, 255.0 - q[1] as f32, 255.0 - q[2] as f32, q[3] as f32]);
}

/// Paint.NET « Inverser l'alpha ».
pub fn invert_alpha(src: &Img, dst: &mut Out, y0: usize, y1: usize, _p: &P) {
    per_pixel(src, dst, y0, y1, |q| [q[0] as f32, q[1] as f32, q[2] as f32, 255.0 - q[3] as f32]);
}

pub fn sepia(src: &Img, dst: &mut Out, y0: usize, y1: usize, _p: &P) {
    per_pixel(src, dst, y0, y1, |q| {
        let (r, g, b) = (q[0] as f32, q[1] as f32, q[2] as f32);
        [r * 0.393 + g * 0.769 + b * 0.189, r * 0.349 + g * 0.686 + b * 0.168, r * 0.272 + g * 0.534 + b * 0.131, q[3] as f32]
    });
}

/// p: [exposition %, gamma %]
pub fn exposure(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let e = p.f(0, 100.0) / 100.0;
    let g = p.f(1, 100.0) / 100.0;
    let inv = if g > 0.05 { 1.0 / g } else { 1.0 };
    let mut lut = [0u8; 256];
    for (i, v) in lut.iter_mut().enumerate() {
        let x = clampf(i as f32 * e, 0.0, 255.0);
        *v = c8((x / 255.0).fpow(inv) * 255.0);
    }
    per_pixel(src, dst, y0, y1, |q| [lut[q[0] as usize] as f32, lut[q[1] as usize] as f32, lut[q[2] as usize] as f32, q[3] as f32]);
}

/// p: [niveaux]
pub fn posterize(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let levels = p.f(0, 4.0).max(2.0);
    let step = 255.0 / (levels - 1.0);
    per_pixel(src, dst, y0, y1, |q| {
        let f = |v: u8| (v as f32 / step + 0.5).floor() * step;
        [f(q[0]), f(q[1]), f(q[2]), q[3] as f32]
    });
}

/// p: [seuil]
pub fn threshold(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let th = p.f(0, 128.0);
    per_pixel(src, dst, y0, y1, |q| {
        let v = if luma601(q[0] as f32, q[1] as f32, q[2] as f32) >= th { 255.0 } else { 0.0 };
        [v, v, v, q[3] as f32]
    });
}

/// p: [seuil]
pub fn solarize(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let th = p.f(0, 128.0);
    per_pixel(src, dst, y0, y1, |q| {
        let (r, g, b) = (q[0] as f32, q[1] as f32, q[2] as f32);
        if luma601(r, g, b) > th { [255.0 - r, 255.0 - g, 255.0 - b, q[3] as f32] } else { [r, g, b, q[3] as f32] }
    });
}

fn hsl_weights(h: f32) -> (usize, usize, f32, f32) {
    let seg = |i1, i2, a: f32, span: f32| (i1, i2, 1.0 - (h - a) / span, (h - a) / span);
    if h < 30.0 { seg(0, 1, 0.0, 30.0) }
    else if h < 60.0 { seg(1, 2, 30.0, 30.0) }
    else if h < 120.0 { seg(2, 3, 60.0, 60.0) }
    else if h < 180.0 { seg(3, 4, 120.0, 60.0) }
    else if h < 240.0 { seg(4, 5, 180.0, 60.0) }
    else if h < 280.0 { seg(5, 6, 240.0, 40.0) }
    else if h < 320.0 { seg(6, 7, 280.0, 40.0) }
    else { seg(7, 0, 320.0, 40.0) }
}

/// p: [teinte, saturation, luminosité, mix(0/1), hue×8, sat×8, lum×8]
pub fn hsv(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let dh = p.f(0, 0.0);
    let ds = p.f(1, 0.0);
    let dl = p.f(2, 0.0);
    let mix = p.b(3, false);
    let m = p.tail(4);
    let band = |o: usize, i: usize| m.get(o * 8 + i).copied().unwrap_or(0.0);
    per_pixel(src, dst, y0, y1, |q| {
        let (r, g, b) = (q[0] as f32, q[1] as f32, q[2] as f32);
        let (nr, ng, nb) = if mix {
            let (h, s, l) = rgb_to_hsl(r, g, b);
            let (i1, i2, w1, w2) = hsl_weights(h);
            let hs = band(0, i1) * w1 + band(0, i2) * w2;
            let ss = band(1, i1) * w1 + band(1, i2) * w2;
            let ls = band(2, i1) * w1 + band(2, i2) * w2;
            hsl_to_rgb((h + hs + dh + 720.0) % 360.0, clampf(s + ss + ds, 0.0, 100.0), clampf(l + ls + dl, 0.0, 100.0))
        } else {
            let (h, s, v) = rgb_to_hsv(r, g, b);
            hsv_to_rgb((h + dh + 720.0) % 360.0, clampf(s + ds, 0.0, 100.0), clampf(v + dl, 0.0, 100.0))
        };
        [nr, ng, nb, q[3] as f32]
    });
}

/// p: [éclat %]
pub fn vibrance(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let amount = p.f(0, 50.0) / 100.0;
    per_pixel(src, dst, y0, y1, |q| {
        let (r, g, b) = (q[0] as f32, q[1] as f32, q[2] as f32);
        let mx = r.max(g).max(b);
        let avg = (r + g + b) / 3.0;
        let k = 1.0 + amount * (1.0 - (mx - avg) / 255.0);
        [avg + (r - avg) * k, avg + (g - avg) * k, avg + (b - avg) * k, q[3] as f32]
    });
}

/// p: [température, teinte] (port 'temptint')
pub fn temp_tint(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let t = p.f(0, 0.0) * 0.6;
    let ti = p.f(1, 0.0) * 0.6;
    per_pixel(src, dst, y0, y1, |q| [q[0] as f32 + t - ti * 0.5, q[1] as f32 + ti, q[2] as f32 - t - ti * 0.5, q[3] as f32]);
}

/// p: [chaleur] (ancien effet 'temperature')
pub fn temperature(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let t = p.f(0, 0.0) / 100.0;
    per_pixel(src, dst, y0, y1, |q| [q[0] as f32 + t * 40.0, q[1] as f32 + t * 8.0, q[2] as f32 - t * 40.0, q[3] as f32]);
}

/// p: [dr, dg, db, hasLut(0/1), lutMaster×256, lutR×256, lutG×256, lutB×256]
pub fn color_balance(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let (dr, dg, db) = (p.f(0, 0.0), p.f(1, 0.0), p.f(2, 0.0));
    let has = p.b(3, false);
    let l = p.tail(4);
    let lut = |k: usize, v: u8| -> u8 {
        if !has || l.len() < (k + 1) * 256 { v } else { c8(l[k * 256 + v as usize]) }
    };
    per_pixel(src, dst, y0, y1, |q| {
        let r = lut(0, c8(q[0] as f32 + dr));
        let g = lut(0, c8(q[1] as f32 + dg));
        let b = lut(0, c8(q[2] as f32 + db));
        [lut(1, r) as f32, lut(2, g) as f32, lut(3, b) as f32, q[3] as f32]
    });
}

/// Courbes / niveaux génériques : p: [lutR×256, lutG×256, lutB×256, lutA×256 (optionnel)]
pub fn apply_luts(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let l = p.0;
    let get = |k: usize, v: u8| -> f32 {
        if l.len() >= (k + 1) * 256 { l[k * 256 + v as usize] } else { v as f32 }
    };
    per_pixel(src, dst, y0, y1, |q| [get(0, q[0]), get(1, q[1]), get(2, q[2]), get(3, q[3])]);
}

/// Niveaux Paint.NET : p: [inBlack, inWhite, gamma, outBlack, outWhite]
pub fn levels(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let ib = p.f(0, 0.0);
    let iw = p.f(1, 255.0).max(ib + 1.0);
    let g = p.f(2, 1.0).max(0.01);
    let ob = p.f(3, 0.0);
    let ow = p.f(4, 255.0);
    let mut lut = [0u8; 256];
    for (i, v) in lut.iter_mut().enumerate() {
        let t = clampf((i as f32 - ib) / (iw - ib), 0.0, 1.0).fpow(1.0 / g);
        *v = c8(ob + (ow - ob) * t);
    }
    per_pixel(src, dst, y0, y1, |q| [lut[q[0] as usize] as f32, lut[q[1] as usize] as f32, lut[q[2] as usize] as f32, q[3] as f32]);
}

/// Auto-niveau (étirement min/max par canal sur l'image entière).
pub fn auto_level(src: &Img, dst: &mut Out, y0: usize, y1: usize, _p: &P) {
    let mut mn = [255u8; 3];
    let mut mx = [0u8; 3];
    for px in src.d.chunks_exact(4) {
        if px[3] == 0 {
            continue;
        }
        for c in 0..3 {
            mn[c] = mn[c].min(px[c]);
            mx[c] = mx[c].max(px[c]);
        }
    }
    let k: [f32; 3] = core::array::from_fn(|c| 255.0 / ((mx[c] as f32 - mn[c] as f32).max(1.0)));
    per_pixel(src, dst, y0, y1, |q| {
        [(q[0] as f32 - mn[0] as f32) * k[0], (q[1] as f32 - mn[1] as f32) * k[1], (q[2] as f32 - mn[2] as f32) * k[2], q[3] as f32]
    });
}

/// p: [couleur1 0xRRGGBB, couleur2, pivot 0..255]
pub fn duotone(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let c1 = p.rgb(0, 0x1a0533);
    let c2 = p.rgb(1, 0xfff5e0);
    let piv = clampf(p.f(2, 128.0) / 255.0, 0.02, 0.98);
    per_pixel(src, dst, y0, y1, |q| {
        let l = luma601(q[0] as f32, q[1] as f32, q[2] as f32) / 255.0;
        let t = clampf(if l <= piv { l / piv * 0.5 } else { 0.5 + (l - piv) / (1.0 - piv) * 0.5 }, 0.0, 1.0);
        [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t), q[3] as f32]
    });
}

/// Simulation d'encres CMJN (port 'cmjn').
pub fn cmyk(src: &Img, dst: &mut Out, y0: usize, y1: usize, _p: &P) {
    const IC: [f32; 3] = [0.0, 0.6, 0.86];
    const IM: [f32; 3] = [0.88, 0.0, 0.47];
    const IY: [f32; 3] = [1.0, 0.94, 0.0];
    const IK: [f32; 3] = [0.1, 0.1, 0.1];
    per_pixel(src, dst, y0, y1, |q| {
        if q[3] < 128 {
            return [q[0] as f32, q[1] as f32, q[2] as f32, q[3] as f32];
        }
        let (r, g, b) = (q[0] as f32 / 255.0, q[1] as f32 / 255.0, q[2] as f32 / 255.0);
        let k = 1.0 - r.max(g).max(b);
        let (c, m, y) = if k < 1.0 { ((1.0 - r - k) / (1.0 - k), (1.0 - g - k) / (1.0 - k), (1.0 - b - k) / (1.0 - k)) } else { (0.0, 0.0, 0.0) };
        let ch = |i: usize| (1.0 - c * (1.0 - IC[i])) * (1.0 - m * (1.0 - IM[i])) * (1.0 - y * (1.0 - IY[i])) * (1.0 - k * (1.0 - IK[i])) * 255.0;
        [ch(0), ch(1), ch(2), q[3] as f32]
    });
}

/// Paint.NET 5 « Mises en lumière / Ombres » :
/// p: [ombres -100..100, hautes lumières -100..100, rayon, clarté -100..100]
pub fn highlights_shadows(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let sh = p.f(0, 0.0) / 100.0;
    let hi = p.f(1, 0.0) / 100.0;
    let radius = p.f(2, 25.0).max(1.0);
    let clarity = p.f(3, 0.0) / 100.0;
    let w = src.w;
    let (ya, yb) = if y0 == 0 && y1 == src.h { (0, src.h) } else { band(src.h, y0, y1, (radius * 3.0) as usize + 2) };
    let bh = yb - ya;
    let mut lum = vec![0.0f32; w * bh];
    for y in 0..bh {
        for x in 0..w {
            let q = src.px(x, ya + y);
            lum[y * w + x] = luma601(q[0] as f32, q[1] as f32, q[2] as f32) / 255.0;
        }
    }
    gauss_blur_f32(&mut lum, w, bh, radius / 2.0);
    for y in y0..y1 {
        for x in 0..w {
            let l = lum[(y - ya) * w + x];
            let q = src.px(x, y);
            // gain multiplicatif : ombres relevées là où le voisinage est sombre,
            // hautes lumières abaissées là où il est clair (courbes douces, sans halo dur)
            let ws = (1.0 - l) * (1.0 - l);
            let wh = l * l;
            let gain = (1.0 + sh * ws * 1.6) * (1.0 - hi * wh * 0.6);
            let i = src.idx(x, y);
            let lum_px = luma601(q[0] as f32, q[1] as f32, q[2] as f32) / 255.0;
            // clarté : contraste local (écart du pixel à la luminance de son voisinage)
            let local = (lum_px - l) * clarity * 1.5;
            let f = |v: u8| {
                let n = v as f32 / 255.0;
                // relever les ombres sans brûler les blancs : compression douce
                let o = if gain >= 1.0 { 1.0 - (1.0 - n).fpow(gain) } else { n * gain };
                (o + local) * 255.0
            };
            put(dst, i, f(q[0]), f(q[1]), f(q[2]), q[3] as f32);
        }
    }
}

// ---------------------------------------------------------------- quantification (Paint.NET 5.1)

struct BoxQ {
    lo: [u8; 3],
    hi: [u8; 3],
    idx: Vec<u32>,
}

/// Palette par coupe médiane (déterministe) sur un sous-échantillon de l'image.
pub fn median_cut_palette(src: &Img, n: usize) -> Vec<[u8; 3]> {
    let total = src.w * src.h;
    let step = (total / 65536).max(1);
    let mut colors: Vec<[u8; 3]> = Vec::with_capacity(total / step + 1);
    let mut i = 0;
    while i < total {
        let o = i * 4;
        if src.d[o + 3] >= 16 {
            colors.push([src.d[o], src.d[o + 1], src.d[o + 2]]);
        }
        i += step;
    }
    if colors.is_empty() {
        return vec![[0, 0, 0]];
    }
    let bounds = |idx: &Vec<u32>, cols: &Vec<[u8; 3]>| {
        let mut lo = [255u8; 3];
        let mut hi = [0u8; 3];
        for &k in idx {
            let c = cols[k as usize];
            for j in 0..3 {
                lo[j] = lo[j].min(c[j]);
                hi[j] = hi[j].max(c[j]);
            }
        }
        (lo, hi)
    };
    let all: Vec<u32> = (0..colors.len() as u32).collect();
    let (lo, hi) = bounds(&all, &colors);
    let mut boxes = vec![BoxQ { lo, hi, idx: all }];
    while boxes.len() < n {
        // boîte au plus grand (étendue × population)
        let mut best = usize::MAX;
        let mut score = 0u64;
        for (bi, b) in boxes.iter().enumerate() {
            if b.idx.len() < 2 {
                continue;
            }
            let ext = (0..3).map(|j| (b.hi[j] - b.lo[j]) as u64).max().unwrap_or(0);
            let s = ext * (b.idx.len() as u64).max(1);
            if ext > 0 && s > score {
                score = s;
                best = bi;
            }
        }
        if best == usize::MAX {
            break;
        }
        let b = boxes.swap_remove(best);
        let axis = (0..3).max_by_key(|&j| b.hi[j] - b.lo[j]).unwrap_or(0);
        let mut idx = b.idx;
        idx.sort_unstable_by_key(|&k| colors[k as usize][axis]);
        let right = idx.split_off(idx.len() / 2);
        let (l1, h1) = bounds(&idx, &colors);
        let (l2, h2) = bounds(&right, &colors);
        boxes.push(BoxQ { lo: l1, hi: h1, idx });
        boxes.push(BoxQ { lo: l2, hi: h2, idx: right });
    }
    boxes
        .iter()
        .map(|b| {
            let mut s = [0u64; 3];
            for &k in &b.idx {
                for j in 0..3 {
                    s[j] += colors[k as usize][j] as u64;
                }
            }
            let n = b.idx.len().max(1) as u64;
            [(s[0] / n) as u8, (s[1] / n) as u8, (s[2] / n) as u8]
        })
        .collect()
}

#[inline]
pub fn nearest(pal: &[[u8; 3]], r: f32, g: f32, b: f32, weighted: bool) -> usize {
    let mut best = 0;
    let mut bd = f32::MAX;
    for (i, c) in pal.iter().enumerate() {
        let dr = r - c[0] as f32;
        let dg = g - c[1] as f32;
        let db = b - c[2] as f32;
        let d = if weighted { 2.0 * dr * dr + 4.0 * dg * dg + 3.0 * db * db } else { dr * dr + dg * dg + db * db };
        if d < bd {
            bd = d;
            best = i;
        }
    }
    best
}

/// Réduit l'image à la palette donnée, avec tramage Floyd-Steinberg optionnel (0..1).
/// `alpha_min` : en dessous, le pixel est laissé tel quel.
pub fn palette_map(src: &Img, dst: &mut Out, y0: usize, y1: usize, pal: &[[u8; 3]], dither: f32, weighted: bool, alpha_min: u8) {
    let w = src.w;
    if dither <= 0.0 {
        for y in y0..y1 {
            for x in 0..w {
                let i = src.idx(x, y);
                let q = src.px(x, y);
                if q[3] < alpha_min {
                    dst[i..i + 4].copy_from_slice(&q);
                    continue;
                }
                let c = pal[nearest(pal, q[0] as f32, q[1] as f32, q[2] as f32, weighted)];
                dst[i] = c[0];
                dst[i + 1] = c[1];
                dst[i + 2] = c[2];
                dst[i + 3] = q[3];
            }
        }
        return;
    }
    // erreurs diffusées sur deux lignes glissantes
    let mut cur = vec![[0.0f32; 3]; w + 2];
    let mut next = vec![[0.0f32; 3]; w + 2];
    for y in y0..y1 {
        for x in 0..w {
            let i = src.idx(x, y);
            let q = src.px(x, y);
            if q[3] < alpha_min {
                dst[i..i + 4].copy_from_slice(&q);
                continue;
            }
            let e = cur[x + 1];
            let r = clampf(q[0] as f32 + e[0], 0.0, 255.0);
            let g = clampf(q[1] as f32 + e[1], 0.0, 255.0);
            let b = clampf(q[2] as f32 + e[2], 0.0, 255.0);
            let c = pal[nearest(pal, r, g, b, weighted)];
            dst[i] = c[0];
            dst[i + 1] = c[1];
            dst[i + 2] = c[2];
            dst[i + 3] = q[3];
            let er = [(r - c[0] as f32) * dither, (g - c[1] as f32) * dither, (b - c[2] as f32) * dither];
            for k in 0..3 {
                cur[x + 2][k] += er[k] * 7.0 / 16.0;
                next[x][k] += er[k] * 3.0 / 16.0;
                next[x + 1][k] += er[k] * 5.0 / 16.0;
                next[x + 2][k] += er[k] / 16.0;
            }
        }
        core::mem::swap(&mut cur, &mut next);
        for v in next.iter_mut() {
            *v = [0.0; 3];
        }
    }
}

/// Paint.NET 5.1 « Quantifier » : p: [nombre de couleurs, tramage %]
pub fn quantize(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let n = p.f(0, 16.0).clamp(2.0, 256.0) as usize;
    let dither = clampf(p.f(1, 50.0) / 100.0, 0.0, 1.0);
    let pal = median_cut_palette(src, n);
    palette_map(src, dst, y0, y1, &pal, dither, false, 1);
}

/// Conversion vers une palette fournie (RAL…) : p: [tramage %, n, (r,g,b)×n]
pub fn palette_convert(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let dither = clampf(p.f(0, 0.0) / 100.0, 0.0, 1.0);
    let n = p.f(1, 0.0) as usize;
    let t = p.tail(2);
    let mut pal = Vec::with_capacity(n);
    for k in 0..n {
        if t.len() >= k * 3 + 3 {
            pal.push([c8(t[k * 3]), c8(t[k * 3 + 1]), c8(t[k * 3 + 2])]);
        }
    }
    if pal.is_empty() {
        copy_rows(src, dst, y0, y1);
        return;
    }
    palette_map(src, dst, y0, y1, &pal, dither, true, 128);
}
