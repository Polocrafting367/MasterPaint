//! Artistique : peinture à l'huile, croquis à l'encre, croquis au crayon.

use crate::util::*;

/// Paint.NET « Peinture à l'huile » : p: [taille du pinceau, grossièreté]
pub fn oil(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let r = p.f(0, 4.0).clamp(1.0, 16.0) as isize;
    let levels = p.f(1, 50.0).clamp(3.0, 255.0) as usize;
    let (w, h) = (src.w as isize, src.h as isize);
    // niveau d'intensité de chaque pixel de la bande élargie, calculé une seule fois
    let (ya, yb) = band(src.h, y0, y1, r as usize);
    let mut lvl = vec![0u8; src.w * (yb - ya)];
    for y in ya..yb {
        for x in 0..src.w {
            lvl[(y - ya) * src.w + x] = ((luma_pdn(&src.px(x, y)) as usize * (levels - 1)) / 255) as u8;
        }
    }
    // histogramme glissant : [compte, Σr, Σg, Σb, Σa] par niveau
    let mut hist = vec![[0u32; 5]; levels];
    let column = |hist: &mut Vec<[u32; 5]>, x: isize, y: isize, sign: i32| {
        if x < 0 || x >= w {
            return;
        }
        for dy in -r..=r {
            let yy = y + dy;
            if yy < 0 || yy >= h {
                continue;
            }
            let q = src.px(x as usize, yy as usize);
            let e = &mut hist[lvl[(yy as usize - ya) * src.w + x as usize] as usize];
            if sign > 0 {
                e[0] += 1;
                e[1] += q[0] as u32;
                e[2] += q[1] as u32;
                e[3] += q[2] as u32;
                e[4] += q[3] as u32;
            } else {
                e[0] -= 1;
                e[1] -= q[0] as u32;
                e[2] -= q[1] as u32;
                e[3] -= q[2] as u32;
                e[4] -= q[3] as u32;
            }
        }
    };
    for y in y0 as isize..y1 as isize {
        for e in hist.iter_mut() {
            *e = [0; 5];
        }
        for dx in -r..=r {
            column(&mut hist, dx, y, 1);
        }
        for x in 0..w {
            let mut best = 0;
            for k in 1..levels {
                if hist[k][0] > hist[best][0] {
                    best = k;
                }
            }
            let e = hist[best];
            let n = e[0].max(1) as f32;
            put(dst, src.idx(x as usize, y as usize), e[1] as f32 / n, e[2] as f32 / n, e[3] as f32 / n, e[4] as f32 / n);
            column(&mut hist, x - r, y, -1);
            column(&mut hist, x + r + 1, y, 1);
        }
    }
}

/// Paint.NET « Croquis à l'encre » : p: [contour d'encre 0..99, coloriage 0..100]
pub fn ink_sketch(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let ink = clampf(p.f(0, 50.0), 0.0, 99.0);
    let coloring = clampf(p.f(1, 50.0), 0.0, 100.0) / 100.0;
    // base colorée : flou léger puis désaturation partielle (comme le « glow » interne de PDN)
    let (blur, ya) = box_blur_for(src, y0, y1, 3, 2);
    let w = src.w;
    let (wi, hi) = (src.w as isize, src.h as isize);
    for y in y0 as isize..y1 as isize {
        for x in 0..wi {
            // noyau 5x5 : centre +24, voisins −1 → détecteur de bords isotrope
            let mut s = 0.0f32;
            for dy in -2..=2isize {
                for dx in -2..=2isize {
                    let q = src.pxc((x + dx).clamp(0, wi - 1), (y + dy).clamp(0, hi - 1));
                    let l = luma_pdn(&q) as f32;
                    s += if dx == 0 && dy == 0 { 24.0 * l } else { -l };
                }
            }
            let edge = s.abs() * (ink / 99.0) * 0.25;
            let shade = clampf(255.0 - edge, 0.0, 255.0) / 255.0;
            let o = ((y as usize - ya) * w + x as usize) * 4;
            let (br, bg, bb) = (blur[o] as f32, blur[o + 1] as f32, blur[o + 2] as f32);
            let gray = luma601(br, bg, bb);
            // coloriage : 0 = gris clair, 1 = couleurs d'origine
            let base = |c: f32| {
                let v = lerp(gray, c, coloring);
                // éclaircir pour l'aspect papier
                v + (255.0 - v) * 0.25 * (1.0 - coloring)
            };
            let i = src.idx(x as usize, y as usize);
            put(dst, i, base(br) * shade, base(bg) * shade, base(bb) * shade, src.d[i + 3] as f32);
        }
    }
}

/// Paint.NET « Croquis au crayon » (port fidèle du worker) : p: [pointe, plage]
pub fn pencil_sketch(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let tip = p.f(0, 2.0).max(1.0) as usize;
    let range = p.f(1, 0.0);
    let w = src.w;
    let (ya, yb) = band(src.h, y0, y1, tip + 2);
    let mut grey = vec![0u8; w * (yb - ya) * 4];
    for y in ya..yb {
        for x in 0..w {
            let g = luma_pdn(&src.px(x, y)) as u8;
            let o = ((y - ya) * w + x) * 4;
            grey[o] = g;
            grey[o + 1] = g;
            grey[o + 2] = g;
            grey[o + 3] = 255;
        }
    }
    let gimg = Img { d: &grey, w, h: yb - ya };
    let blur = box_blur_band(&gimg, 0, yb - ya, tip, 1);
    let cf = (259.0 * (-range + 255.0)) / (255.0 * (259.0 - (-range)));
    for y in y0..y1 {
        for x in 0..w {
            let i = src.idx(x, y);
            let g = luma_pdn(&src.px(x, y)) as f32;
            let o = ((y - ya) * w + x) * 4;
            let bg = clampf(cf * (blur[o] as f32 - 127.0) + 127.0 + range, 0.0, 255.0);
            let res = if bg < 1.0 { 255.0 } else { (g * 255.0 / bg).min(255.0) };
            put(dst, i, res, res, res, src.d[i + 3] as f32);
        }
    }
}
