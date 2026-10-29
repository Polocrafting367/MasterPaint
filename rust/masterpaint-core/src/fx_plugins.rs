//! Effets repris de plugins Paint.NET installés (BoltBait, Vandermotten) : algorithmes
//! relus dans les DLL décompilées puis réécrits pour le modèle « bande de lignes » du cœur.
//!
//! | id            | plugin d'origine                 | paramètres                                   |
//! |---------------|----------------------------------|----------------------------------------------|
//! | `dream`       | BoltBait — Dream                 | rayon, vignette (0/1)                        |
//! | `removedust`  | BoltBait — Remove Dust           | mode (0 = taches blanches, 1 = noires)       |
//! | `gridcheck`   | BoltBait — Grid / Checkerboard   | mode, taille, épaisseur, couleur, source, couleur 2, inverser |
//! | `fadeedge`    | Vandermotten — Fade Edge         | forme (0 rect., 1 circ.), largeur, puissance |
//! | `coloraccent` | Vandermotten — Color Accent      | couleur, tolérance                           |
//! | `transparency`| BoltBait — Transparency          | ajustement %, ignorer transparents, remplacer, couleur |
//! | `featherobj`  | BoltBait — Feather Object        | rayon                                        |
//! | `pastel`      | BoltBait — Pastel                | pinceau, grossièreté, crayon %, pointe       |

use crate::util::*;

#[inline]
fn px(src: &Img, i: usize) -> [u8; 4] {
    [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]
}

#[inline]
fn set(dst: &mut Out, i: usize, c: [u8; 4]) {
    dst[i..i + 4].copy_from_slice(&c);
}

// ---------------------------------------------------------------- Dream

/// Flou gaussien (σ = rayon/3) mélangé en « obscurcir » avec l'original, puis vignette douce.
/// p: [rayon 0..200, vignette 0/1]
pub fn dream(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let radius = p.f(0, 10.0).clamp(0.0, 200.0);
    let vignette = p.b(1, true);
    let rb = (radius / 3.0).round() as usize;
    let (blur, ya) = box_blur_for(src, y0, y1, rb, 3);
    let (w, h) = (src.w, src.h);
    let (cx, cy) = ((w as f32 - 1.0) / 2.0, (h as f32 - 1.0) / 2.0);
    let (ix, iy) = (1.0 / cx.max(1.0), 1.0 / cy.max(1.0));
    for y in y0..y1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let b = (y - ya) * w * 4 + x * 4;
            let s = px(src, i);
            let mut c = [s[0].min(blur[b]), s[1].min(blur[b + 1]), s[2].min(blur[b + 2]), s[3]];
            if vignette {
                // vignette Direct2D : intensité 0,3, transition 0,8 (assombrit les bords)
                let (dx, dy) = ((x as f32 - cx) * ix, (y as f32 - cy) * iy);
                let d = (dx * dx + dy * dy).sqrt() / core::f32::consts::SQRT_2;
                let t = ((d - 0.2) / 0.8).clamp(0.0, 1.0);
                let k = 1.0 - 0.3 * t * t * (3.0 - 2.0 * t);
                for v in c.iter_mut().take(3) {
                    *v = c8(*v as f32 * k);
                }
            }
            set(dst, i, c);
        }
    }
}

// ---------------------------------------------------------------- Remove Dust

/// Image décalée d'un pixel mélangée avec l'original : « obscurcir » efface les points
/// blancs, « éclaircir » les points noirs. p: [mode 0/1]
pub fn remove_dust(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let black = p.i(0, 0) == 1;
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let s = px(src, i);
            if x == 0 {
                set(dst, i, s);
                continue;
            }
            let n = px(src, i - 4);
            let f = |a: u8, b: u8| if black { a.max(b) } else { a.min(b) };
            set(dst, i, [f(s[0], n[0]), f(s[1], n[1]), f(s[2], n[2]), s[3]]);
        }
    }
}

// ---------------------------------------------------------------- Grid / Checkerboard

/// p: [mode 0 grille / 1 damier, taille, épaisseur, couleur 0xRRGGBB,
///     fond 0 = image source / 1 = couleur, couleur de fond, inverser 0/1]
pub fn grid_checker(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let checker = p.i(0, 0) == 1;
    let size = p.f(1, 33.0).clamp(1.0, 1000.0) as usize;
    let width = p.f(2, 1.0).clamp(1.0, 100.0) as usize;
    let c1 = p.rgb(3, 0x000000);
    let custom_bg = p.i(4, 0) == 1;
    let c2 = p.rgb(5, 0xffffff);
    let swap = p.b(6, false);
    let line = [c1[0] as u8, c1[1] as u8, c1[2] as u8, 255];
    let bgc = [c2[0] as u8, c2[1] as u8, c2[2] as u8, 255];
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let mut bg = if custom_bg { bgc } else { px(src, i) };
            let mut fg = line;
            if swap {
                core::mem::swap(&mut bg, &mut fg);
            }
            let on = if checker {
                ((x / size) % 2 == 0) != ((y / size) % 2 == 0)
            } else {
                // une ligne tous les `size` pixels, épaisse de `width` (comme le plugin)
                (0..width as i64).any(|k| (x as i64 - k) % size as i64 == 0 || (y as i64 - k) % size as i64 == 0)
            };
            set(dst, i, if on { fg } else { bg });
        }
    }
}

// ---------------------------------------------------------------- Fade Edge

/// Fondu de l'alpha vers les bords. p: [forme 0 rect / 1 cercle, largeur 0..200, puissance 0..10]
pub fn fade_edge(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let circular = p.i(0, 0) == 1;
    let width = p.f(1, 20.0).clamp(0.0, 200.0) as usize;
    let power = p.f(2, 1.0).clamp(0.0, 10.0) as f64;
    let (w, h) = (src.w, src.h);
    if width == 0 {
        copy_rows(src, dst, y0, y1);
        return;
    }
    if !circular {
        let factors: Vec<f32> = (0..width).map(|i| (((i + 1) as f64 / (width + 1) as f64).powf(power)) as f32).collect();
        for y in y0..y1 {
            let dy = y.min(h - 1 - y);
            for x in 0..w {
                let i = (y * w + x) * 4;
                let mut c = px(src, i);
                let d = x.min(w - 1 - x).min(dy);
                if d < width {
                    c[3] = (c[3] as f32 * factors[d]) as u8;
                }
                set(dst, i, c);
            }
        }
        return;
    }
    // cercle inscrit : calcul en coordonnées doublées comme le plugin (centre au demi-pixel)
    let (cx2, cy2) = (w as i64 - 1, h as i64 - 1);
    let outer = w.min(h) as i64;
    let inner = (outer - width as i64 * 2).max(0);
    let (outer_sq, inner_sq) = (outer * outer, inner * inner);
    let n6 = (outer + 2) as f64;
    let n8 = 1.0 / (width as f64 * 2.0 + 2.0);
    for y in y0..y1 {
        let dy2 = (y as i64 * 2 - cy2).pow(2);
        for x in 0..w {
            let i = (y * w + x) * 4;
            let mut c = px(src, i);
            let d2 = (x as i64 * 2 - cx2).pow(2) + dy2;
            if d2 >= outer_sq {
                c = [0, 0, 0, 0];
            } else if d2 > inner_sq {
                let k = ((n6 - (d2 as f64).sqrt()) * n8).max(0.0).powf(power);
                c[3] = (c[3] as f64 * k).min(255.0) as u8;
            }
            set(dst, i, c);
        }
    }
}

// ---------------------------------------------------------------- Color Accent

/// Teinte « sextant » de Vandermotten : [-1, 5).
fn accent_hue(r: u8, g: u8, b: u8) -> f32 {
    let (hi, lo0) = if b > g { (b, g) } else { (g, b) };
    if r > hi {
        return (g as f32 - b as f32) / (r as f32 - lo0 as f32);
    }
    let lo = if r < lo0 { r } else { lo0 };
    if r >= lo0 && hi == lo0 {
        return 0.0;
    }
    if hi == g {
        (b as f32 - r as f32) / (hi as f32 - lo as f32) + 2.0
    } else {
        (r as f32 - g as f32) / (hi as f32 - lo as f32) - 2.0
    }
}

/// Garde une teinte en couleur, le reste en niveaux de gris. p: [couleur 0xRRGGBB, tolérance 0..100]
pub fn color_accent(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let c = p.rgb(0, 0xff0000);
    let h0 = accent_hue(c[0] as u8, c[1] as u8, c[2] as u8);
    let max_dist = p.f(1, 10.0).clamp(0.0, 100.0) * 0.03;
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let s = px(src, i);
            let gray = ((7471 * s[2] as u32 + 38470 * s[1] as u32 + 19595 * s[0] as u32) >> 16) as u8;
            let h = accent_hue(s[0], s[1], s[2]);
            let mut d = (h0 - h).abs();
            if d > 3.0 {
                d = 6.0 - d;
            }
            let out = if max_dist <= 0.0 {
                if h == h0 { s } else { [gray, gray, gray, s[3]] }
            } else if d >= max_dist {
                [gray, gray, gray, s[3]]
            } else {
                let t = (d / max_dist) * (d / max_dist);
                let g = gray as f32;
                [c8(lerp(s[0] as f32, g, t)), c8(lerp(s[1] as f32, g, t)), c8(lerp(s[2] as f32, g, t)), s[3]]
            };
            set(dst, i, out);
        }
    }
}

// ---------------------------------------------------------------- Transparency

/// p: [ajustement -100..100 %, ignorer les pixels transparents 0/1, remplacer la transparence 0/1,
///     couleur de remplacement 0xRRGGBB (couleur secondaire)]
pub fn transparency(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let adj = p.f(0, 0.0).clamp(-100.0, 100.0) / 100.0;
    let ignore = p.b(1, false);
    let replace = p.b(2, false) && !ignore;
    let rc = p.rgb(3, 0xffffff);
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let mut c = px(src, i);
            if !(ignore && c[3] == 0) {
                if replace && c[3] == 0 {
                    c = [rc[0] as u8, rc[1] as u8, rc[2] as u8, 0];
                }
                let a = c[3] as f32;
                let na = if adj > 0.0 { a + (255.0 - a) * adj } else { a + a * adj };
                c[3] = c8(na);
            }
            set(dst, i, c);
        }
    }
}

// ---------------------------------------------------------------- Feather Object

/// Adoucit le bord des objets (pixels non transparents) : masque érodé puis flouté ;
/// alpha = min(alpha, masque). Les couleurs ne changent pas. p: [rayon 0..20]
pub fn feather_object(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let r = p.f(0, 1.0).clamp(0.0, 20.0) as usize;
    let (w, h) = (src.w, src.h);
    if r == 0 {
        copy_rows(src, dst, y0, y1);
        return;
    }
    let sigma = if r > 1 { (r.saturating_sub(2).max(1) * 2) as f32 / 3.0 } else { 0.6 };
    let margin = r + (sigma * 3.0).ceil() as usize + 2;
    let (ya, yb) = band(h, y0, y1, margin);
    let bh = yb - ya;
    // masque binaire des objets
    let mut m = vec![0f32; w * bh];
    for y in ya..yb {
        for x in 0..w {
            if src.d[(y * w + x) * 4 + 3] > 0 {
                m[(y - ya) * w + x] = 1.0;
            }
        }
    }
    // érosion carrée (2r+1) séparable : min horizontal puis vertical ; hors image = vide
    let mut t = vec![0f32; w * bh];
    for y in 0..bh {
        for x in 0..w {
            let (a, b) = (x as isize - r as isize, x + r);
            t[y * w + x] = if a < 0 || b >= w { 0.0 } else { m[y * w + a as usize..=y * w + b].iter().cloned().fold(1.0, f32::min) };
        }
    }
    for y in 0..bh {
        let gy = ya + y;
        for x in 0..w {
            let (a, b) = (gy as isize - r as isize, gy + r);
            m[y * w + x] = if a < 0 || b >= h {
                0.0
            } else {
                // lignes de la fenêtre ramenées dans la bande (la marge couvre les lignes utiles)
                let lo = (a as usize).saturating_sub(ya).min(bh - 1);
                let hi = (b - ya.min(b)).min(bh - 1);
                (lo..=hi).map(|yy| t[yy * w + x]).fold(1.0, f32::min)
            };
        }
    }
    gauss_blur_f32(&mut m, w, bh, sigma);
    for y in y0..y1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let mut c = px(src, i);
            let k = m[(y - ya) * w + x].clamp(0.0, 1.0);
            c[3] = c[3].min(c8(k * 255.0));
            set(dst, i, c);
        }
    }
}

// ---------------------------------------------------------------- Pastel

/// Croquis au crayon + peinture à l'huile + couleurs pastel (teinte par pas de 10°,
/// valeur relevée vers le clair). p: [pinceau 1..8, grossièreté 3..255, crayon 0..100 %, pointe 1..20]
pub fn pastel(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let brush = p.f(0, 3.0).clamp(1.0, 8.0);
    let coarse = p.f(1, 50.0).clamp(3.0, 255.0);
    let pencil = p.f(2, 50.0).clamp(0.0, 100.0) / 100.0;
    let tip = p.f(3, 2.0).clamp(1.0, 20.0);
    let w = src.w;
    let n = (y1 - y0) * w * 4;
    let mut oil_buf = vec![0u8; n];
    {
        let mut o = Out { d: &mut oil_buf, base: y0 * w * 4 };
        crate::fx_artistic::oil(src, &mut o, y0, y1, &P(&[brush, coarse]));
    }
    let mut sk_buf = vec![0u8; n];
    if pencil > 0.0 {
        let mut o = Out { d: &mut sk_buf, base: y0 * w * 4 };
        crate::fx_artistic::pencil_sketch(src, &mut o, y0, y1, &P(&[tip, 0.0]));
    }
    let step = 10.0f32; // 360 / 36 teintes
    for k in 0..(y1 - y0) * w {
        let j = k * 4;
        let (h, s, v) = rgb_to_hsv(oil_buf[j] as f32, oil_buf[j + 1] as f32, oil_buf[j + 2] as f32);
        let h = (h / step).round() * step;
        let v = (v / 300.0 + 0.8).min(1.0) * 100.0;
        let (r, g, b) = hsv_to_rgb(h, s, v);
        let mut c = [r, g, b];
        if pencil > 0.0 {
            // trait de crayon noir, opacité = (255 - croquis) × crayon
            let ink = (255.0 - sk_buf[j] as f32) * pencil / 255.0;
            for v in c.iter_mut() {
                *v *= 1.0 - ink;
            }
        }
        let i = y0 * w * 4 + j;
        set(dst, i, [c8(c[0]), c8(c[1]), c8(c[2]), src.d[i + 3]]);
    }
}

#[cfg(test)]
mod tests {
    use crate::{apply, effect_id, Img, Out, P};

    /// Image de test 61×47 : dégradé coloré, un disque opaque sur fond transparent, points blancs.
    fn image() -> (Vec<u8>, usize, usize) {
        let (w, h) = (61usize, 47usize);
        let mut d = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                let i = (y * w + x) * 4;
                let inside = (x as i32 - 30).pow(2) + (y as i32 - 23).pow(2) < 18 * 18;
                d[i] = (x * 4) as u8;
                d[i + 1] = (y * 5) as u8;
                d[i + 2] = 200;
                d[i + 3] = if inside { 255 } else { 0 };
                if (x + y) % 13 == 0 {
                    d[i..i + 3].copy_from_slice(&[255, 255, 255]);
                }
            }
        }
        (d, w, h)
    }

    fn run(name: &str, params: &[f32], bands: usize) -> Vec<u8> {
        let (d, w, h) = image();
        let img = Img { d: &d, w, h };
        let mut out = d.clone();
        let id = effect_id(name).expect(name);
        let step = h.div_ceil(bands);
        for y0 in (0..h).step_by(step) {
            let y1 = (y0 + step).min(h);
            let mut o = Out { d: &mut out[y0 * w * 4..y1 * w * 4], base: y0 * w * 4 };
            assert!(apply(id, &img, &mut o, y0, y1, &P(params)));
        }
        out
    }

    #[test]
    fn plugins_run_and_bands_match() {
        let cases: &[(&str, &[f32])] = &[
            ("dream", &[12.0, 1.0]),
            ("removedust", &[0.0]),
            ("gridcheck", &[0.0, 10.0, 2.0, 0.0, 0.0, 16777215.0, 0.0]),
            ("gridcheck", &[1.0, 8.0, 1.0, 0.0, 1.0, 16777215.0, 1.0]),
            ("fadeedge", &[0.0, 10.0, 1.0]),
            ("fadeedge", &[1.0, 10.0, 2.0]),
            ("coloraccent", &[255.0, 30.0]),
            ("transparency", &[-50.0, 0.0, 0.0, 0.0]),
            ("transparency", &[40.0, 0.0, 1.0, 16711680.0]),
            ("featherobj", &[1.0]),
            ("featherobj", &[6.0]),
            ("pastel", &[3.0, 50.0, 50.0, 2.0]),
        ];
        let (src, _, _) = image();
        for (name, p) in cases {
            let whole = run(name, p, 1);
            let banded = run(name, p, 5);
            assert_ne!(whole, src, "{name} {p:?} ne change rien");
            assert_eq!(whole, banded, "{name} {p:?} : le découpage en bandes change le résultat");
        }
    }
}