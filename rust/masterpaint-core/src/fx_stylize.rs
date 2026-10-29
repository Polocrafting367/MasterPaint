//! Styliser (Effets › Styliser) : bords, embosser, relief, contour, morphologie.

use crate::util::*;

/// Détection de contours Sobel (MasterPaint) : p: [sensibilité %]
pub fn edges(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let sens = p.f(0, 50.0) / 100.0;
    let (w, h) = (src.w as isize, src.h as isize);
    let g = |x: isize, y: isize| -> f32 {
        if x < 0 || y < 0 || x >= w || y >= h {
            return 0.0;
        }
        let q = src.px(x as usize, y as usize);
        luma601(q[0] as f32, q[1] as f32, q[2] as f32)
    };
    for y in y0 as isize..y1 as isize {
        for x in 0..w {
            let hz = g(x - 1, y - 1) + 2.0 * g(x - 1, y) + g(x - 1, y + 1) - (g(x + 1, y - 1) + 2.0 * g(x + 1, y) + g(x + 1, y + 1));
            let vt = g(x - 1, y - 1) + 2.0 * g(x, y - 1) + g(x + 1, y - 1) - (g(x - 1, y + 1) + 2.0 * g(x, y + 1) + g(x + 1, y + 1));
            let e = (hz * hz + vt * vt).sqrt() * sens * 4.0;
            let i = src.idx(x as usize, y as usize);
            put(dst, i, e, e, e, src.d[i + 3] as f32);
        }
    }
}

/// Noyau directionnel 3x3 d'OpenPDN (Emboss/Relief/EdgeDetect).
fn directional_weights(angle_deg: f32) -> [[f32; 3]; 3] {
    let r = angle_deg.to_radians();
    let dr = core::f32::consts::FRAC_PI_4;
    [
        [(r + dr).fcos(), (r + 2.0 * dr).fcos(), (r + 3.0 * dr).fcos()],
        [r.fcos(), 0.0, (r + 4.0 * dr).fcos()],
        [(r - dr).fcos(), (r - 2.0 * dr).fcos(), (r - 3.0 * dr).fcos()],
    ]
}

/// Paint.NET « Embosser » (gris) : p: [angle°]
pub fn emboss(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let wt = directional_weights(p.f(0, 0.0));
    for y in y0 as isize..y1 as isize {
        for x in 0..src.w as isize {
            let mut s = 0.0;
            for (j, row) in wt.iter().enumerate() {
                for (k, wv) in row.iter().enumerate() {
                    let q = src.pxc(x + k as isize - 1, y + j as isize - 1);
                    s += wv * luma_pdn(&q) as f32;
                }
            }
            let v = s + 128.0;
            let i = src.idx(x as usize, y as usize);
            put(dst, i, v, v, v, src.d[i + 3] as f32);
        }
    }
}

/// Paint.NET « Mise en relief » (couleur conservée) : p: [angle°]
pub fn relief(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let mut wt = directional_weights(p.f(0, 45.0));
    wt[1][1] = 1.0;
    for y in y0 as isize..y1 as isize {
        for x in 0..src.w as isize {
            let mut s = [0.0f32; 3];
            for (j, row) in wt.iter().enumerate() {
                for (k, wv) in row.iter().enumerate() {
                    let q = src.pxc(x + k as isize - 1, y + j as isize - 1);
                    for c in 0..3 {
                        s[c] += wv * q[c] as f32;
                    }
                }
            }
            let i = src.idx(x as usize, y as usize);
            put(dst, i, s[0], s[1], s[2], src.d[i + 3] as f32);
        }
    }
}

/// Paint.NET « Contour » (Styliser, OutlineEffect) : p: [épaisseur, intensité]
pub fn outline(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let thickness = p.f(0, 3.0).clamp(1.0, 200.0);
    let intensity = p.f(1, 50.0).clamp(0.0, 100.0) as u32;
    local_histogram(src, y0, y1, thickness, |x, y, hr, hg, hb, ha, area| {
        let min1 = area * (100 - intensity) / 200;
        let min2 = area * (100 + intensity) / 200;
        let span = |h: &[u32; 256]| -> (u32, u32) {
            let mut cnt = 0u32;
            let mut a = 0usize;
            while a < 255 && h[a] == 0 {
                a += 1;
            }
            while a < 255 && cnt < min1 {
                cnt += h[a];
                a += 1;
            }
            let mut b = a;
            while b < 255 && cnt < min2 {
                cnt += h[b];
                b += 1;
            }
            (a as u32, b as u32)
        };
        let (r1, r2) = span(hr);
        let (g1, g2) = span(hg);
        let (b1, b2) = span(hb);
        let (_a1, a2) = span(ha);
        let i = src.idx(x, y);
        dst[i] = (255 - (r2 - r1).min(255)) as u8;
        dst[i + 1] = (255 - (g2 - g1).min(255)) as u8;
        dst[i + 2] = (255 - (b2 - b1).min(255)) as u8;
        dst[i + 3] = a2.min(255) as u8;
    });
}

/// Paint.NET 5.1 « Morphologie » : p: [mode 0=dilater 1=éroder, rayon, forme 0=disque 1=carré]
pub fn morphology(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let erode = p.i(0, 0) == 1;
    let radius = p.f(1, 3.0).clamp(1.0, 200.0);
    let square = p.i(2, 0) == 1;
    if square {
        let r = radius as isize;
        let (w, h) = (src.w as isize, src.h as isize);
        // séparable : passe horizontale sur la bande élargie, puis verticale
        let (ya, yb) = band(src.h, y0, y1, r as usize);
        let bw = src.w;
        let mut tmp = vec![0u8; bw * (yb - ya) * 4];
        for y in ya..yb {
            for x in 0..w {
                let mut acc = if erode { [255u8; 4] } else { [0u8; 4] };
                for dx in -r..=r {
                    let xx = x + dx;
                    if xx < 0 || xx >= w {
                        continue;
                    }
                    let q = src.px(xx as usize, y);
                    for c in 0..4 {
                        acc[c] = if erode { acc[c].min(q[c]) } else { acc[c].max(q[c]) };
                    }
                }
                let o = ((y - ya) * bw + x as usize) * 4;
                tmp[o..o + 4].copy_from_slice(&acc);
            }
        }
        for y in y0 as isize..y1 as isize {
            for x in 0..w as usize {
                let mut acc = if erode { [255u8; 4] } else { [0u8; 4] };
                for dy in -r..=r {
                    let yy = y + dy;
                    if yy < ya as isize || yy >= yb as isize || yy >= h {
                        continue;
                    }
                    let o = ((yy as usize - ya) * bw + x) * 4;
                    for c in 0..4 {
                        acc[c] = if erode { acc[c].min(tmp[o + c]) } else { acc[c].max(tmp[o + c]) };
                    }
                }
                let i = src.idx(x, y as usize);
                dst[i..i + 4].copy_from_slice(&acc);
            }
        }
        return;
    }
    let pct = if erode { 0.0 } else { 100.0 };
    local_histogram(src, y0, y1, radius, |x, y, hr, hg, hb, ha, area| {
        let i = src.idx(x, y);
        let pick = |h: &[u32; 256]| -> u8 {
            if pct > 50.0 {
                (0..256).rev().find(|&k| h[k] > 0).unwrap_or(0) as u8
            } else {
                (0..256).find(|&k| h[k] > 0).unwrap_or(0) as u8
            }
        };
        if area == 0 {
            dst[i..i + 4].copy_from_slice(&src.d[i..i + 4]);
            return;
        }
        dst[i] = pick(hr);
        dst[i + 1] = pick(hg);
        dst[i + 2] = pick(hb);
        dst[i + 3] = pick(ha);
    });
}
