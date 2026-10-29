//! Bruit : ajout de bruit Paint.NET, grain argentique, tramage numérique.

use crate::util::*;

/// Paint.NET « Ajouter du bruit » : p: [intensité 0..100, saturation couleur 0..400, couverture %, graine]
pub fn add_noise(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let intensity = p.f(0, 64.0);
    let sat = p.f(1, 100.0) / 100.0;
    let coverage = clampf(p.f(2, 100.0) / 100.0, 0.0, 1.0);
    let seed = p.f(3, 1.0) as u32;
    // écart-type ≈ intensité/100 × 64 niveaux (Paint.NET : 100 % ≈ bruit très fort)
    let dev = intensity * 0.64;
    for y in y0..y1 {
        for x in 0..src.w {
            let i = src.idx(x, y);
            let q = src.px(x, y);
            if coverage < 1.0 && rand01(x as i32, y as i32, seed ^ 0xC0FE) >= coverage {
                dst[i..i + 4].copy_from_slice(&q);
                continue;
            }
            let l = gauss(x as i32, y as i32, seed) * dev;
            let cr = gauss(x as i32, y as i32, seed ^ 0x1111) * dev * sat;
            let cg = gauss(x as i32, y as i32, seed ^ 0x2222) * dev * sat;
            let cb = gauss(x as i32, y as i32, seed ^ 0x3333) * dev * sat;
            put(dst, i, q[0] as f32 + l + cr, q[1] as f32 + l + cg, q[2] as f32 + l + cb, q[3] as f32);
        }
    }
}

/// Bruit uniforme monochrome (ancien « Ajouter du bruit » MasterPaint / grain) : p: [amplitude, graine]
pub fn uniform_noise(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let amp = p.f(0, 20.0);
    let seed = p.f(1, 1.0) as u32;
    for y in y0..y1 {
        for x in 0..src.w {
            let i = src.idx(x, y);
            let n = (rand01(x as i32, y as i32, seed) - 0.5) * amp;
            put(dst, i, src.d[i] as f32 + n, src.d[i + 1] as f32 + n, src.d[i + 2] as f32 + n, src.d[i + 3] as f32);
        }
    }
}

/// Tramage numérique (bruit par cellules) : p: [intensité %, cellule, graine]
pub fn digital_pattern(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let st = p.f(0, 40.0) / 100.0;
    let cell = p.f(1, 15.0).max(2.0);
    let seed = p.f(2, 0x2b7e_1516u32 as f32) as u32;
    for y in y0..y1 {
        for x in 0..src.w {
            let i = src.idx(x, y);
            let gx = (x as f32 / cell) as i32;
            let gy = (y as f32 / cell) as i32;
            let n = (rand01(gx, gy, seed) * 2.0 - 1.0) * st * 64.0;
            put(dst, i, src.d[i] as f32 + n, src.d[i + 1] as f32 + n, src.d[i + 2] as f32 + n, src.d[i + 3] as f32);
        }
    }
}
