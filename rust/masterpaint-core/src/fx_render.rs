//! Rendu : nuages, fractales de Julia / Mandelbrot, turbulence.

use crate::util::*;

/// Mode de fusion du rendu avec l'image existante (Paint.NET : « Mode de fusion »).
/// 0 = normal (remplace), 1 = produit, 2 = addition, 3 = écran, 4 = incrustation, 5 = différence
fn blend_over(dst: &mut Out, i: usize, base: [u8; 4], top: [f32; 4], mode: i32) {
    if mode == 0 {
        put(dst, i, top[0], top[1], top[2], top[3]);
        return;
    }
    let mut o = [0.0f32; 3];
    for c in 0..3 {
        let b = base[c] as f32 / 255.0;
        let t = top[c] / 255.0;
        o[c] = 255.0
            * match mode {
                1 => b * t,
                2 => (b + t).min(1.0),
                3 => 1.0 - (1.0 - b) * (1.0 - t),
                4 => if b < 0.5 { 2.0 * b * t } else { 1.0 - 2.0 * (1.0 - b) * (1.0 - t) },
                5 => (b - t).abs(),
                _ => t,
            };
    }
    // l'opacité du rendu module la fusion
    let a = top[3] / 255.0;
    let r = |c: usize| lerp(base[c] as f32, o[c], a);
    put(dst, i, r(0), r(1), r(2), base[3] as f32);
}

/// Nuages (OpenPDN CloudsEffect) : p: [échelle, puissance %, graine, couleur1, couleur2, mode de fusion]
pub fn clouds(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let scale = p.f(0, 250.0).max(1.0);
    let power = p.f(1, 50.0) / 100.0;
    let seed = p.i(2, 0) & 255;
    let from = p.rgb(3, 0x000000);
    let to = p.rgb(4, 0xffffff);
    let mode = p.i(5, 0);
    let (w, h) = (src.w as f32, src.h as f32);
    for y in y0..y1 {
        let dy = 2.0 * y as f32 - h;
        for x in 0..src.w {
            let dx = 2.0 * x as f32 - w;
            let (mut v, mut mult, mut div) = (0.0f32, 1.0f32, scale);
            let mut i = 0;
            while i < 12 && mult > 0.03 && div > 0.0 {
                let mut dxr = 65536.0 + dx / div;
                let mut dyr = 65536.0 + dy / div;
                let dxd = dxr as i32;
                let dyd = dyr as i32;
                dxr -= dxd as f32;
                dyr -= dyd as f32;
                v += perlin_raw2(dxd & 255, dyd & 255, dxr, dyr, (seed ^ i) & 255) * mult;
                div = (div / 2.0).floor();
                mult *= power;
                i += 1;
            }
            let t = clampf((v + 1.0) / 2.0, 0.0, 1.0);
            let top = [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t), 255.0];
            blend_over(dst, src.idx(x, y), src.px(x, y), top, mode);
        }
    }
}

/// Paint.NET 5 « Turbulence » : p: [taille, octaves, rugosité %, graine, couleur1, couleur2,
/// mode de fusion, bruit 0=turbulence (|Perlin|, veines) 1=somme fractale (Perlin signé, nuageux)]
pub fn turbulence(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let scale = p.f(0, 200.0).max(1.0);
    let octaves = p.f(1, 6.0).clamp(1.0, 12.0) as i32;
    let rough = clampf(p.f(2, 50.0) / 100.0, 0.05, 1.0);
    let seed = p.i(3, 0) & 255;
    let from = p.rgb(4, 0x000000);
    let to = p.rgb(5, 0xffffff);
    let mode = p.i(6, 0);
    let fractal_sum = p.i(7, 0) == 1;
    for y in y0..y1 {
        for x in 0..src.w {
            let (mut fx, mut fy) = (x as f32 / scale, y as f32 / scale);
            let (mut amp, mut sum, mut norm) = (1.0f32, 0.0f32, 0.0f32);
            for o in 0..octaves {
                let n = perlin_raw(fx + 31.7 * o as f32, fy + 17.3 * o as f32, seed);
                sum += if fractal_sum { n } else { n.abs() } * amp;
                norm += amp;
                amp *= rough;
                fx *= 2.0;
                fy *= 2.0;
            }
            let v = sum / norm.max(1e-6);
            let t = clampf(if fractal_sum { v * 1.4 + 0.5 } else { v * 1.6 }, 0.0, 1.0);
            let top = [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t), 255.0];
            blend_over(dst, src.idx(x, y), src.px(x, y), top, mode);
        }
    }
}

/// Fractales (OpenPDN) : p: [facteur, angle°, qualité, zoom, inverser(0/1)]
pub fn fractal(julia: bool, src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let factor = p.f(0, if julia { 4.0 } else { 1.0 }).max(1.0) as f64;
    let angle = p.f(1, 0.0) as f64;
    let quality = p.f(2, 2.0).clamp(1.0, 5.0) as usize;
    let invert = !julia && p.b(4, false);
    let (w, h) = (src.w as f64, src.h as f64);
    let theta0 = angle.to_radians();
    let count = quality * quality + 1;
    let inv_q = 1.0 / quality as f64;
    let aspect = h / w;
    let cb = |v: f64| v.clamp(0.0, 255.0).trunc();
    let max_m = 100_000.0f64;
    let inv_log_max = 1.0 / max_m.fln();
    let log_10000 = 10_000.0f64.fln();
    let (zoom, xo, yo) = if julia { (p.f(3, 4.0).max(0.1) as f64, 0.0, 0.0) } else { (1.0 + 20.0 * p.f(3, 10.0) as f64, -0.7, -0.29) };
    let inv_zoom = 1.0 / zoom;
    for y in y0..y1 {
        for x in 0..src.w {
            let (mut r, mut g, mut b, mut a) = (0.0f64, 0.0, 0.0, 0.0);
            for i in 0..count {
                let u = (2.0 * x as f64 - w + i as f64 / count as f64) / h;
                let v = (2.0 * y as f64 - h + ((i as f64 * inv_q) % 1.0)) / h;
                let rad = (u * u + v * v).sqrt();
                let th = v.fatan2(u) + theta0;
                let (up, vp) = (rad * th.fcos(), rad * th.fsin());
                if julia {
                    let (mut jx, mut jy) = ((up - vp * aspect) * inv_zoom, (vp + up * aspect) * inv_zoom);
                    let mut c = 0.0f64;
                    while c < 256.0 && jx * jx + jy * jy < 10_000.0 {
                        let t = jx;
                        jx = jx * jx - jy * jy + 0.3125;
                        jy = 2.0 * t * jy + 0.03;
                        c += 1.0;
                    }
                    c -= 2.0 - 2.0 * log_10000 / (jx * jx + jy * jy).fln();
                    let c = factor * c;
                    b += cb(c - 768.0);
                    g += cb(c - 512.0);
                    r += cb(c - 256.0);
                    a += cb(c);
                } else {
                    let (mr, mi) = (up * inv_zoom + xo, vp * inv_zoom + yo);
                    let (mut c, mut mx, mut my) = (0.0f64, 0.0f64, 0.0f64);
                    while c * factor < 1024.0 && mx * mx + my * my < max_m {
                        let t = mx;
                        mx = mx * mx - my * my + mr;
                        my = 2.0 * t * my + mi;
                        c += 1.0;
                    }
                    let m = c - (my * my + mx * mx).fln() * inv_log_max;
                    let c = 64.0 + factor * m;
                    r += cb(c - 768.0);
                    g += cb(c - 512.0);
                    b += cb(c - 256.0);
                    a += cb(c);
                }
            }
            let n = count as f64;
            let (mut rr, mut gg, mut bb) = (cb(r / n), cb(g / n), cb(b / n));
            if invert {
                rr = 255.0 - rr;
                gg = 255.0 - gg;
                bb = 255.0 - bb;
            }
            put(dst, src.idx(x, y), rr as f32, gg as f32, bb as f32, cb(a / n) as f32);
        }
    }
}
