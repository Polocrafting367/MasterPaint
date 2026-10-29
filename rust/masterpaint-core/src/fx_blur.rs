//! Flous (Effets › Flous) et réduction du bruit.

use crate::util::*;

/// Recopie les lignes [y0,y1) d'un buffer de bande (commençant à `ya`) dans dst.
fn emit_band(buf: &[u8], ya: usize, w: usize, dst: &mut Out, y0: usize, y1: usize, keep_alpha_from: Option<&Img>) {
    for y in y0..y1 {
        let so = (y - ya) * w * 4;
        let dof = y * w * 4;
        dst[dof..dof + w * 4].copy_from_slice(&buf[so..so + w * 4]);
        if let Some(src) = keep_alpha_from {
            for x in 0..w {
                dst[dof + x * 4 + 3] = src.d[dof + x * 4 + 3];
            }
        }
    }
}

/// Flou carré (« Flou simple ») : p: [rayon]
pub fn square(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let r = p.f(0, 2.0).max(0.0) as usize;
    let (buf, ya) = box_blur_for(src, y0, y1, r, 1);
    emit_band(&buf, ya, src.w, dst, y0, y1, None);
}

/// Flou gaussien (3 boîtes ≈ gaussienne, comme le worker) : p: [rayon]
pub fn gaussian(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let r = p.f(0, 2.0).max(0.0) as usize;
    let (buf, ya) = box_blur_for(src, y0, y1, r, 3);
    emit_band(&buf, ya, src.w, dst, y0, y1, None);
}

/// Paint.NET « Médiane » / « Flou médian » : p: [rayon, percentile]
pub fn median(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let radius = p.f(0, 10.0).clamp(1.0, 200.0);
    let pct = clampf(p.f(1, 50.0), 0.0, 100.0);
    local_histogram(src, y0, y1, radius, |x, y, hr, hg, hb, ha, area| {
        let i = src.idx(x, y);
        if area == 0 {
            dst[i..i + 4].copy_from_slice(&src.d[i..i + 4]);
            return;
        }
        dst[i] = hist_percentile(hr, area, pct);
        dst[i + 1] = hist_percentile(hg, area, pct);
        dst[i + 2] = hist_percentile(hb, area, pct);
        dst[i + 3] = hist_percentile(ha, area, pct);
    });
}

/// Paint.NET « Réduire le bruit » (percentile local + interpolation) : p: [rayon, force %]
pub fn reduce_noise(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let radius = p.f(0, 10.0).clamp(1.0, 100.0);
    let strength = 0.2 * (p.f(1, 40.0) / 100.0);
    local_histogram(src, y0, y1, radius, |x, y, hr, hg, hb, _ha, area| {
        let i = src.idx(x, y);
        let q = src.px(x, y);
        if area == 0 {
            dst[i..i + 4].copy_from_slice(&q);
            return;
        }
        let cum = |h: &[u32; 256], v: u8| -> f32 {
            let mut s = 0u32;
            for k in 0..v as usize {
                s += h[k];
            }
            s as f32 * 255.0 / area as f32
        };
        let (cr, cg, cb) = (q[0] as f32, q[1] as f32, q[2] as f32);
        let intensity = luma_pdn(&q) as f32 / 255.0;
        let t = clampf(strength * (1.0 - 0.75 * intensity), 0.0, 1.0);
        put(dst, i, cr + (cum(hr, q[0]) - cr) * t, cg + (cum(hg, q[1]) - cg) * t, cb + (cum(hb, q[2]) - cb) * t, q[3] as f32);
    });
}

/// Flou bokeh / Défocaliser : disque circulaire en espace « lumière ».
/// p: [rayon, hautes lumières %(0 = Défocaliser Paint.NET, >0 = Bokeh)]
pub fn bokeh(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let radius = p.f(0, 8.0).max(1.0) as usize;
    let hl = clampf(p.f(1, 55.0) / 100.0, 0.0, 1.0);
    let gamma = 1.0 + hl * 3.0;
    let inv_g = 1.0 / gamma;
    let w = src.w;
    let h = src.h;
    let (ya, yb) = band(h, y0, y1, radius + 1);
    let bh = yb - ya;
    let w1 = w + 1;
    // sommes-préfixes horizontales (f64 pour la précision) des valeurs élevées à gamma
    let mut pre = vec![[0.0f64; 4]; w1 * bh];
    // (v·a/255)^γ = v^γ · (a/255)^γ : deux tables de 256 entrées au lieu de pow par pixel
    let lv: Vec<f32> = (0..256).map(|v| (v as f32).fpow(gamma)).collect();
    let la: Vec<f32> = (0..256).map(|a| (a as f32 / 255.0).fpow(gamma)).collect();
    for y in 0..bh {
        let ro = y * w1;
        for x in 0..w {
            let q = src.px(x, ya + y);
            let ka = la[q[3] as usize];
            let v = [
                (lv[q[0] as usize] * ka) as f64,
                (lv[q[1] as usize] * ka) as f64,
                (lv[q[2] as usize] * ka) as f64,
                lv[q[3] as usize] as f64,
            ];
            for c in 0..4 {
                pre[ro + x + 1][c] = pre[ro + x][c] + v[c];
            }
        }
    }
    let half: Vec<usize> = (0..=radius).map(|dy| (((radius * radius - dy * dy) as f32).sqrt()) as usize).collect();
    for y in y0..y1 {
        for x in 0..w {
            let mut acc = [0.0f64; 4];
            let mut cnt = 0usize;
            for dy in -(radius as isize)..=(radius as isize) {
                let yy = y as isize + dy;
                if yy < ya as isize || yy >= yb as isize {
                    continue;
                }
                let hw = half[dy.unsigned_abs()];
                let x0 = x.saturating_sub(hw);
                let x1 = (x + hw).min(w - 1);
                let ro = (yy as usize - ya) * w1;
                for c in 0..4 {
                    acc[c] += pre[ro + x1 + 1][c] - pre[ro + x0][c];
                }
                cnt += x1 - x0 + 1;
            }
            let n = cnt.max(1) as f64;
            let a = pow_fast((acc[3] / n) as f32, inv_g);
            let inv = if a > 0.0 { 255.0 / a } else { 0.0 };
            let i = src.idx(x, y);
            put(
                dst,
                i,
                pow_fast((acc[0] / n) as f32, inv_g) * inv,
                pow_fast((acc[1] / n) as f32, inv_g) * inv,
                pow_fast((acc[2] / n) as f32, inv_g) * inv,
                a,
            );
        }
    }
}

/// Moyenne pondérée par l'alpha d'échantillons bilinéaires (motion / fragment).
#[inline]
fn blend_acc(acc: &mut [f32; 5], s: [f32; 4]) {
    if s[3] < 1.0 {
        acc[4] += 1.0;
        return;
    }
    let wv = s[3] / 255.0;
    acc[0] += s[0] * wv;
    acc[1] += s[1] * wv;
    acc[2] += s[2] * wv;
    acc[3] += wv;
    acc[4] += 1.0;
}

/// Flou de déplacement (OpenPDN MotionBlurEffect) : p: [angle°, distance, centré(0/1)]
pub fn motion(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let angle = p.f(0, 25.0);
    let dist = p.f(1, 10.0).max(1.0) as i32;
    let centered = p.b(2, true);
    let theta = (angle + 180.0).to_radians();
    let alpha = dist as f32;
    // OpenPDN : départ (0,0), arrivée (α·cosθ, −α·sinθ) ; centré → segment symétrique.
    let (mut sx, mut sy) = (0.0f32, 0.0f32);
    let (mut ex, mut ey) = (alpha * theta.fcos(), -alpha * theta.fsin());
    if centered {
        sx = -ex / 2.0;
        sy = -ey / 2.0;
        ex /= 2.0;
        ey /= 2.0;
    }
    let n = (((1 + dist) * 3) / 2).max(1) as usize;
    let pts: Vec<(f32, f32)> = (0..n)
        .map(|i| {
            let t = if n == 1 { 0.0 } else { i as f32 / (n - 1) as f32 };
            (sx + (ex - sx) * t, sy + (ey - sy) * t)
        })
        .collect();
    let (wf, hf) = (src.w as f32, src.h as f32);
    for y in y0..y1 {
        for x in 0..src.w {
            let mut acc = [0.0f32; 5];
            for &(dx, dy) in &pts {
                let px = x as f32 + dx;
                let py = y as f32 + dy;
                if px >= 0.0 && py >= 0.0 && px <= wf - 1.0 && py <= hf - 1.0 {
                    blend_acc(&mut acc, src.bilinear(px, py));
                }
            }
            let i = src.idx(x, y);
            if acc[3] < 1e-6 {
                put(dst, i, 0.0, 0.0, 0.0, 0.0);
            } else {
                // alpha = somme(a)/nombre d'échantillons (comme pdn-effects.js)
                put(dst, i, acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], acc[3] * 255.0 / acc[4].max(1.0));
            }
        }
    }
}

/// Flou de surface : p: [rayon, seuil]
pub fn surface(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let r = p.f(0, 6.0).clamp(1.0, 100.0) as isize;
    let th = p.f(1, 15.0).clamp(1.0, 100.0);
    let slope = 96.0 / th;
    let mut fac = [0.0f32; 256];
    for (i, f) in fac.iter_mut().enumerate() {
        *f = (255.0 - i as f32 * slope).fround().max(0.0) / 255.0;
    }
    let (w, h) = (src.w as isize, src.h as isize);
    for y in y0 as isize..y1 as isize {
        for x in 0..w {
            let c = src.px(x as usize, y as usize);
            let mut s = [0.0f32; 5];
            for dy in -r..=r {
                let yy = y + dy;
                if yy < 0 || yy >= h {
                    continue;
                }
                for dx in -r..=r {
                    let xx = x + dx;
                    if xx < 0 || xx >= w {
                        continue;
                    }
                    let q = src.px(xx as usize, yy as usize);
                    let diff = ((q[0] as i32 - c[0] as i32).abs() + (q[1] as i32 - c[1] as i32).abs() + (q[2] as i32 - c[2] as i32).abs()) / 3;
                    let wf = fac[diff as usize];
                    if wf < 0.01 {
                        continue;
                    }
                    s[0] += q[0] as f32 * wf;
                    s[1] += q[1] as f32 * wf;
                    s[2] += q[2] as f32 * wf;
                    s[3] += q[3] as f32 * wf;
                    s[4] += wf;
                }
            }
            let i = src.idx(x as usize, y as usize);
            if s[4] > 0.0 {
                put(dst, i, s[0] / s[4], s[1] / s[4], s[2] / s[4], s[3] / s[4]);
            } else {
                dst[i..i + 4].copy_from_slice(&c);
            }
        }
    }
}

/// Fragment (OpenPDN FragmentEffect) : p: [fragments, distance, rotation°]
pub fn fragment(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let n = p.f(0, 4.0).clamp(2.0, 50.0) as usize;
    let dist = p.f(1, 8.0).max(0.0);
    let rot = (p.f(2, 0.0) - 90.0).to_radians();
    let step = core::f32::consts::TAU / n as f32;
    let offs: Vec<(isize, isize)> = (0..n)
        .map(|i| {
            let a = rot + step * i as f32;
            ((-dist * a.fsin()).fround() as isize, (-dist * a.fcos()).fround() as isize)
        })
        .collect();
    let (w, h) = (src.w as isize, src.h as isize);
    for y in y0 as isize..y1 as isize {
        for x in 0..w {
            let mut s = [0.0f32; 4];
            let mut cnt = 0.0;
            for &(ox, oy) in &offs {
                let u = x - ox;
                let v = y - oy;
                if u < 0 || v < 0 || u >= w || v >= h {
                    continue;
                }
                let q = src.px(u as usize, v as usize);
                let a = q[3] as f32 / 255.0;
                if a < 0.01 {
                    continue;
                }
                s[0] += q[0] as f32 * a;
                s[1] += q[1] as f32 * a;
                s[2] += q[2] as f32 * a;
                s[3] += a;
                cnt += 1.0;
            }
            let i = src.idx(x as usize, y as usize);
            if cnt > 0.0 && s[3] > 0.0 {
                put(dst, i, s[0] / s[3], s[1] / s[3], s[2] / s[3], (s[3] / cnt) * 255.0);
            } else {
                dst[i..i + 4].copy_from_slice(&src.d[i..i + 4]);
            }
        }
    }
}

/// Flou radial (OpenPDN, arithmétique en virgule fixe) : p: [angle, qualité, centre x %, centre y %, zone nette %]
pub fn radial(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let angle = clampf(p.f(0, 2.0), 0.0, 360.0) as f64;
    let quality = p.f(1, 2.0).clamp(1.0, 5.0) as i64;
    let ox = p.f(2, 0.0) as f64 / 100.0;
    let oy = p.f(3, 0.0) as f64 / 100.0;
    let inner = clampf(p.f(4, 0.0) / 100.0, 0.0, 1.0) as f64;
    let (w, h) = (src.w as i64, src.h as i64);
    let fcx = ((w << 15) as f64 + ox * (w << 15) as f64).fround() as i64;
    let fcy = ((h << 15) as f64 + oy * (h << 15) as f64).fround() as i64;
    let cx = fcx as f64 / 65536.0;
    let cy = fcy as f64 / 65536.0;
    let max_r = (cx.max(w as f64 - cx)).fhypot(cy.max(h as f64 - cy)).max(1.0);
    let safe_r = inner * max_r;
    let n = quality * quality * (30 + quality * quality);
    let fr = (angle * core::f64::consts::PI * 65536.0 / 181.0).fround();
    let base_fsr = fr / n as f64;
    for y in y0 as i64..y1 as i64 {
        for x in 0..w {
            let i = src.idx(x as usize, y as usize);
            let dist = (x as f64 - cx).fhypot(y as f64 - cy);
            if dist <= safe_r {
                dst[i..i + 4].copy_from_slice(&src.d[i..i + 4]);
                continue;
            }
            let t = if max_r > safe_r { (dist - safe_r) / (max_r - safe_r) } else { 1.0 };
            // force fractionnaire, comme radial-zoom-blur.js (tronquée, elle ne prenait que
            // quelques valeurs : anneaux visibles)
            let fsr = base_fsr * t;
            let (mut ox1, mut oy1) = ((x << 16) - fcx, (y << 16) - fcy);
            let (mut ox2, mut oy2) = (ox1, oy1);
            let a0 = src.d[i + 3] as i64;
            let mut s = [src.d[i] as i64 * a0, src.d[i + 1] as i64 * a0, src.d[i + 2] as i64 * a0, a0];
            let mut cnt = 1i64;
            let f2 = ((fsr * fsr) as i64) >> 11;
            let mul = |v: i64, f: f64| ((v >> 8) as f64 * f) as i64 >> 8;
            for _ in 0..n {
                let (cx_, cy_) = (ox1, oy1);
                ox1 = cx_ - mul(cy_, fsr) - (((cx_ >> 14) * f2) >> 8);
                oy1 = cy_ + mul(cx_, fsr) - (((cy_ >> 14) * f2) >> 8);
                let (cx_, cy_) = (ox2, oy2);
                ox2 = cx_ - mul(cy_, -fsr) - (((cx_ >> 14) * f2) >> 8);
                oy2 = cy_ + mul(cx_, -fsr) - (((cy_ >> 14) * f2) >> 8);
                for (u, v) in [((ox1 + fcx + 32768) >> 16, (oy1 + fcy + 32768) >> 16), ((ox2 + fcx + 32768) >> 16, (oy2 + fcy + 32768) >> 16)] {
                    if u > 0 && v > 0 && u < w && v < h {
                        let q = src.px(u as usize, v as usize);
                        let a = q[3] as i64;
                        s[0] += q[0] as i64 * a;
                        s[1] += q[1] as i64 * a;
                        s[2] += q[2] as i64 * a;
                        s[3] += a;
                        cnt += 1;
                    }
                }
            }
            if s[3] > 0 {
                put(dst, i, (s[0] / s[3]) as f32, (s[1] / s[3]) as f32, (s[2] / s[3]) as f32, (s[3] / cnt) as f32);
            } else {
                put(dst, i, 0.0, 0.0, 0.0, 0.0);
            }
        }
    }
}

/// Flou de zoom (OpenPDN) : p: [intensité, centre x %, centre y %, zone nette %]
pub fn zoom(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let amount = clampf(p.f(0, 10.0), 0.0, 100.0) as f64;
    let ox = p.f(1, 0.0) as f64 / 100.0;
    let oy = p.f(2, 0.0) as f64 / 100.0;
    let inner = clampf(p.f(3, 0.0) / 100.0, 0.0, 1.0) as f64;
    let (w, h) = (src.w as i64, src.h as i64);
    let fcx = (w as f64 * ox * 32768.0).fround() as i64 + (w << 15);
    let fcy = (h as f64 * oy * 32768.0).fround() as i64 + (h << 15);
    let pcx = fcx as f64 / 65536.0;
    let pcy = fcy as f64 / 65536.0;
    let max_r = (pcx.max(w as f64 - pcx)).fhypot(pcy.max(h as f64 - pcy)).max(1.0);
    let safe_r = inner * max_r;
    for y in y0 as i64..y1 as i64 {
        for x in 0..w {
            let i = src.idx(x as usize, y as usize);
            let dist = (x as f64 - pcx).fhypot(y as f64 - pcy);
            if dist <= safe_r {
                dst[i..i + 4].copy_from_slice(&src.d[i..i + 4]);
                continue;
            }
            let t = if max_r > safe_r { (dist - safe_r) / (max_r - safe_r) } else { 1.0 };
            let fz = amount * t;
            let (mut fx, mut fy) = ((x << 16) - fcx, (y << 16) - fcy);
            let a0 = src.d[i + 3] as i64;
            let mut s = [src.d[i] as i64 * a0, src.d[i + 1] as i64 * a0, src.d[i + 2] as i64 * a0, a0];
            let mut cnt = 1i64;
            for _ in 0..64 {
                fx -= (((fx >> 4) as f64 * fz) as i64) >> 10;
                fy -= (((fy >> 4) as f64 * fz) as i64) >> 10;
                let u = (fx + fcx + 32768) >> 16;
                let v = (fy + fcy + 32768) >> 16;
                if u >= 0 && v >= 0 && u < w && v < h {
                    let q = src.px(u as usize, v as usize);
                    let a = q[3] as i64;
                    s[0] += q[0] as i64 * a;
                    s[1] += q[1] as i64 * a;
                    s[2] += q[2] as i64 * a;
                    s[3] += a;
                    cnt += 1;
                }
            }
            if s[3] > 0 {
                put(dst, i, (s[0] / s[3]) as f32, (s[1] / s[3]) as f32, (s[2] / s[3]) as f32, (s[3] / cnt) as f32);
            } else {
                put(dst, i, 0.0, 0.0, 0.0, 0.0);
            }
        }
    }
}

/// Paint.NET 5 « Flou d'esquisse » : traits courts orientés par un champ de bruit.
/// p: [rayon (longueur des traits), variation d'angle %, graine]
pub fn sketch_blur(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let radius = p.f(0, 10.0).max(1.0);
    let var = clampf(p.f(1, 50.0) / 100.0, 0.0, 1.0);
    let seed = p.f(2, 0.0) as i32 & 255;
    let base = 0.785_398_2f32; // 45° : hachures de croquis
    let steps = (radius * 1.5).ceil().max(2.0) as i32;
    let scale = 1.0 / (radius * 4.0).max(8.0);
    for y in y0..y1 {
        for x in 0..src.w {
            let n = perlin_noise(x as f32 * scale, y as f32 * scale, 2.0, 0.5, seed);
            let a = base + n * var * core::f32::consts::PI;
            let (dx, dy) = (a.fcos(), a.fsin());
            let mut acc = [0.0f32; 5];
            for k in -steps..=steps {
                let t = k as f32 / steps as f32 * radius;
                blend_acc(&mut acc, src.bilinear(x as f32 + dx * t, y as f32 + dy * t));
            }
            let i = src.idx(x, y);
            if acc[3] < 1e-6 {
                put(dst, i, 0.0, 0.0, 0.0, 0.0);
            } else {
                put(dst, i, acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], acc[3] * 255.0 / acc[4].max(1.0));
            }
        }
    }
}
