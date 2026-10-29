//! Effets de calque dynamiques (filtres « live ») — portage des étages de
//! js/effects/dynamic-render-worker.js, mêmes formules en f64.
//!
//! Paramètres : 0 type, 1 rayon.
//! Types : 0 blur, 1 gaussian, 2 sharpen, 3 pixelate, 4 halftone, 5 shadow, 6 grayscale,
//! 7 sepia, 8 invert, 9 brightness, 10 contrast, 11 saturate, 12 hue, 13 trame d'impression
//! CMJN, 14 tramage ordonné (Bayer).
//! Les flous enchaînent des passes sur l'image entière : l'effet calcule tout puis
//! recopie les lignes [y0, y1) (le JS l'appelle en un seul morceau).

use crate::util::*;

/// Écriture dans un Uint8ClampedArray : arrondi au plus proche, demi vers le pair.
#[inline]
fn u8c(v: f64) -> u8 {
    if !(v > 0.0) {
        0
    } else if v >= 255.0 {
        255
    } else {
        let f = v.floor();
        let d = v - f;
        (if d > 0.5 || (d == 0.5 && (f as i64) % 2 == 1) { f + 1.0 } else { f }) as u8
    }
}

/// Math.round (demi vers +∞)
#[inline]
fn jround(v: f64) -> f64 {
    (v + 0.5).floor()
}

#[inline]
fn clamp255(v: f64) -> f64 {
    v.clamp(0.0, 255.0)
}

/// `x | 0` de JS pour des valeurs raisonnables
#[inline]
fn trunc_i(v: f64) -> i64 {
    if v.is_finite() { v.trunc() as i64 } else { 0 }
}

/// sum / cnt écrit dans un Uint8ClampedArray (demi vers le pair), en entiers exacts.
#[inline]
fn div_even(sum: u32, cnt: u32) -> u8 {
    let (q, r) = (sum / cnt, sum % cnt);
    let up = 2 * r > cnt || (2 * r == cnt && q & 1 == 1);
    (q + up as u32).min(255) as u8
}

/// Une passe de moyenne glissante (fenêtre 2r+1). `clamp_edges` : bords répétés et RVB
/// seul (alpha recopié) ; sinon pixels hors image ignorés et alpha moyenné aussi.
fn box_pass(s: &[u8], w: usize, h: usize, r: usize, horizontal: bool, clamp_edges: bool) -> Vec<u8> {
    let mut out = vec![0u8; s.len()];
    let nc = if clamp_edges { 3 } else { 4 };
    let (len, lines, step, stride) = if horizontal { (w, h, 4, w * 4) } else { (h, w, w * 4, 4) };
    let ri = r as isize;
    for l in 0..lines {
        let base = l * stride;
        let at = |k: isize| base + (k.clamp(0, len as isize - 1) as usize) * step;
        let mut acc = [0u32; 4];
        let mut cnt: u32 = 0;
        for k in -ri..=ri {
            if !clamp_edges && (k < 0 || k >= len as isize) {
                continue;
            }
            let j = at(k);
            for c in 0..nc {
                acc[c] += s[j + c] as u32;
            }
            cnt += 1;
        }
        for k in 0..len as isize {
            let i = base + k as usize * step;
            for c in 0..nc {
                out[i + c] = div_even(acc[c], cnt);
            }
            if clamp_edges {
                out[i + 3] = s[i + 3];
            }
            let (add, sub) = (k + ri + 1, k - ri);
            if clamp_edges || add < len as isize {
                let j = at(add);
                for c in 0..nc {
                    acc[c] += s[j + c] as u32;
                }
                if !clamp_edges {
                    cnt += 1;
                }
            }
            if clamp_edges || sub >= 0 {
                let j = at(sub);
                for c in 0..nc {
                    acc[c] -= s[j + c] as u32;
                }
                if !clamp_edges {
                    cnt -= 1;
                }
            }
        }
    }
    out
}

fn box_pass_rgb(s: &[u8], w: usize, h: usize, radius: f64, horizontal: bool) -> Vec<u8> {
    box_pass(s, w, h, trunc_i(radius).clamp(1, 32) as usize, horizontal, true)
}
fn box_blur_rgb(s: &[u8], w: usize, h: usize, radius: f64) -> Vec<u8> {
    let mut d = box_pass_rgb(s, w, h, radius, true);
    d = box_pass_rgb(&d, w, h, radius, false);
    if radius > 1.0 {
        let r2 = jround(radius * 0.6).max(1.0);
        d = box_pass_rgb(&d, w, h, r2, true);
        d = box_pass_rgb(&d, w, h, r2, false);
    }
    d
}

fn box_pass_full(s: &[u8], w: usize, h: usize, radius: f64, horizontal: bool) -> Vec<u8> {
    box_pass(s, w, h, trunc_i(radius).clamp(1, 64) as usize, horizontal, false)
}
fn box_blur_full(s: &[u8], w: usize, h: usize, radius: f64) -> Vec<u8> {
    let mut d = box_pass_full(s, w, h, radius, true);
    d = box_pass_full(&d, w, h, radius, false);
    if radius > 2.0 {
        let r2 = jround(radius * 0.6).max(1.0);
        d = box_pass_full(&d, w, h, r2, true);
        d = box_pass_full(&d, w, h, r2, false);
    }
    d
}

fn rgb_to_hsv255(r: f64, g: f64, b: f64) -> (f64, f64, f64) {
    let (rn, gn, bn) = (r / 255.0, g / 255.0, b / 255.0);
    let max = rn.max(gn).max(bn);
    let min = rn.min(gn).min(bn);
    let d = max - min;
    let mut h = 0.0;
    if d > 1e-6 {
        h = if max == rn {
            ((gn - bn) / d) % 6.0
        } else if max == gn {
            (bn - rn) / d + 2.0
        } else {
            (rn - gn) / d + 4.0
        };
        h *= 60.0;
        if h < 0.0 {
            h += 360.0;
        }
    }
    let s = if max <= 1e-6 { 0.0 } else { d / max };
    (h, s * 255.0, max * 255.0)
}

fn hsv_to_rgb255(h: f64, s: f64, v: f64) -> (f64, f64, f64) {
    let hn = (((h % 360.0) + 360.0) % 360.0) / 60.0;
    let sn = (s / 255.0).clamp(0.0, 1.0);
    let vn = (v / 255.0).clamp(0.0, 1.0);
    let c = vn * sn;
    let x = c * (1.0 - ((hn % 2.0) - 1.0).abs());
    let m = vn - c;
    let (r1, g1, b1) = if hn < 1.0 {
        (c, x, 0.0)
    } else if hn < 2.0 {
        (x, c, 0.0)
    } else if hn < 3.0 {
        (0.0, c, x)
    } else if hn < 4.0 {
        (0.0, x, c)
    } else if hn < 5.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };
    (jround((r1 + m) * 255.0), jround((g1 + m) * 255.0), jround((b1 + m) * 255.0))
}

fn per_pixel(s: &[u8], typ: i32, rad: f64) -> Vec<u8> {
    let mut out = vec![0u8; s.len()];
    let r = trunc_i(rad).clamp(1, 32) as f64;
    let sat_mul = ((30.0 + r * 20.0) / 100.0).clamp(0.0, 4.0);
    let bright_mul = (0.65 + r * 0.055).clamp(0.4, 2.2);
    let contrast_mul = (0.55 + r * 0.065).clamp(0.5, 2.2);
    let hue_rot = r * 14.0;
    let gray = ((5.0 + r * 8.0) / 100.0).min(1.0);
    let sepia = ((8.0 + r * 6.0) / 100.0).min(1.0);
    let inv = ((12.0 + r * 7.0) / 100.0).min(1.0);
    for i in (0..s.len()).step_by(4) {
        let (mut rr, mut gg, mut bb) = (s[i] as f64, s[i + 1] as f64, s[i + 2] as f64);
        match typ {
            6 => {
                let l = rr * 0.299 + gg * 0.587 + bb * 0.114;
                rr = rr * (1.0 - gray) + l * gray;
                gg = gg * (1.0 - gray) + l * gray;
                bb = bb * (1.0 - gray) + l * gray;
            }
            7 => {
                let sr = rr * 0.393 + gg * 0.769 + bb * 0.189;
                let sg = rr * 0.349 + gg * 0.686 + bb * 0.168;
                let sb = rr * 0.272 + gg * 0.534 + bb * 0.131;
                rr = rr * (1.0 - sepia) + sr * sepia;
                gg = gg * (1.0 - sepia) + sg * sepia;
                bb = bb * (1.0 - sepia) + sb * sepia;
            }
            8 => {
                rr = rr * (1.0 - inv) + (255.0 - rr) * inv;
                gg = gg * (1.0 - inv) + (255.0 - gg) * inv;
                bb = bb * (1.0 - inv) + (255.0 - bb) * inv;
            }
            9 => {
                rr *= bright_mul;
                gg *= bright_mul;
                bb *= bright_mul;
            }
            10 => {
                rr = (rr - 127.5) * contrast_mul + 127.5;
                gg = (gg - 127.5) * contrast_mul + 127.5;
                bb = (bb - 127.5) * contrast_mul + 127.5;
            }
            11 | 12 => {
                let (mut h, mut sv, v) = rgb_to_hsv255(rr, gg, bb);
                if typ == 11 {
                    sv = (sv * sat_mul).clamp(0.0, 255.0);
                } else {
                    h = (h + hue_rot) % 360.0;
                }
                (rr, gg, bb) = hsv_to_rgb255(h, sv, v);
            }
            _ => {}
        }
        out[i] = clamp255(jround(rr)) as u8;
        out[i + 1] = clamp255(jround(gg)) as u8;
        out[i + 2] = clamp255(jround(bb)) as u8;
        out[i + 3] = s[i + 3];
    }
    out
}

fn stage(s: &[u8], w: usize, h: usize, typ: i32, rad: f64) -> Vec<u8> {
    match typ {
        0 => box_blur_rgb(s, w, h, rad),
        1 => {
            let cur = box_blur_rgb(s, w, h, rad);
            box_blur_rgb(&cur, w, h, jround(rad * 0.55).max(1.0))
        }
        2 => {
            let blur_r = rad.clamp(1.0, 3.0);
            let blurred = box_blur_rgb(s, w, h, (trunc_i(blur_r) as f64).max(1.0));
            let a = (0.55 + rad * 0.08).clamp(0.0, 2.5);
            let mut out = vec![0u8; s.len()];
            for i in (0..s.len()).step_by(4) {
                for c in 0..3 {
                    let v = s[i + c] as f64;
                    out[i + c] = clamp255(jround(v + (v - blurred[i + c] as f64) * a)) as u8;
                }
                out[i + 3] = s[i + 3];
            }
            out
        }
        3 => {
            let bs = jround(rad * 2.0).clamp(2.0, 48.0) as usize;
            let mut out = vec![0u8; s.len()];
            for by in (0..h).step_by(bs) {
                for bx in (0..w).step_by(bs) {
                    let sx = (w - 1).min(bx + bs / 2);
                    let sy = (h - 1).min(by + bs / 2);
                    let si = (sy * w + sx) * 4;
                    let px = [s[si], s[si + 1], s[si + 2], s[si + 3]];
                    for y in by..h.min(by + bs) {
                        for x in bx..w.min(bx + bs) {
                            let i = (y * w + x) * 4;
                            out[i..i + 4].copy_from_slice(&px);
                        }
                    }
                }
            }
            out
        }
        4 => {
            let mut out = vec![0u8; s.len()];
            let dot = (rad * 1.5).max(2.0);
            let freq = (2.0 * core::f64::consts::PI) / dot;
            let ang = core::f64::consts::PI / 4.0;
            let (ca, sa) = (ang.cos(), ang.sin());
            for y in 0..h {
                for x in 0..w {
                    let i = (y * w + x) * 4;
                    let luma = (0.299 * s[i] as f64 + 0.587 * s[i + 1] as f64 + 0.114 * s[i + 2] as f64) / 255.0;
                    let (xf, yf) = (x as f64, y as f64);
                    let rx = xf * ca - yf * sa;
                    let ry = xf * sa + yf * ca;
                    let pat = ((rx * freq).sin() + (ry * freq).sin()) / 2.0;
                    let v = if luma >= (pat + 1.0) / 2.0 { 255 } else { 0 };
                    out[i] = v;
                    out[i + 1] = v;
                    out[i + 2] = v;
                    out[i + 3] = s[i + 3];
                }
            }
            out
        }
        5 => {
            let r = (trunc_i(rad) as f64).max(1.0);
            let mut black = vec![0u8; s.len()];
            for i in (3..s.len()).step_by(4) {
                black[i] = s[i];
            }
            let mut f = box_blur_full(&black, w, h, r);
            for i in (0..s.len()).step_by(4) {
                let a_s = s[i + 3] as f64 / 255.0;
                if a_s >= 1.0 {
                    f[i..i + 3].copy_from_slice(&s[i..i + 3]);
                    f[i + 3] = 255;
                } else if a_s > 0.0 {
                    let a_d = f[i + 3] as f64 / 255.0;
                    let m = 1.0 - a_s;
                    let ao = a_s + a_d * m;
                    if ao > 0.0 {
                        let inv = 1.0 / ao;
                        for c in 0..3 {
                            f[i + c] = u8c((s[i + c] as f64 * a_s + f[i + c] as f64 * a_d * m) * inv);
                        }
                        f[i + 3] = u8c(jround(ao * 255.0));
                    }
                }
            }
            f
        }
        13 => print_screen(s, w, h, rad),
        14 => ordered_dither(s, w, h, rad),
        _ => per_pixel(s, typ, rad),
    }
}

/// Angles des trames d'imprimerie : cyan 15°, magenta 75°, jaune 0°, noir 45°.
pub const SCREEN_ANGLES: [f64; 4] = [15.0, 75.0, 0.0, 45.0];

/// Encres CMJN (0..1) d'une couleur RVB.
#[inline]
fn cmyk(r: f64, g: f64, b: f64) -> [f64; 4] {
    let (r, g, b) = (r / 255.0, g / 255.0, b / 255.0);
    let k = 1.0 - r.max(g).max(b);
    if k >= 0.999 {
        return [0.0, 0.0, 0.0, 1.0];
    }
    let d = 1.0 - k;
    [(1.0 - r - k) / d, (1.0 - g - k) / d, (1.0 - b - k) / d, k]
}

/// Trame d'impression : quatre trames de points ronds tournées (cyan, magenta, jaune, noir),
/// la taille d'un point suit l'encre au centre de sa cellule ; encres soustraites d'un papier
/// blanc, bords des points adoucis sur un pixel. Pas de la trame = force × 1,5 (min. 3 px).
fn print_screen(s: &[u8], w: usize, h: usize, rad: f64) -> Vec<u8> {
    let cell = (rad * 1.5).max(3.0);
    let mut out = vec![0u8; s.len()];
    let rot: Vec<(f64, f64)> = SCREEN_ANGLES.iter().map(|a| (a.to_radians().cos(), a.to_radians().sin())).collect();
    let at = |x: f64, y: f64| {
        let xi = (x.floor().max(0.0) as usize).min(w - 1);
        let yi = (y.floor().max(0.0) as usize).min(h - 1);
        let i = (yi * w + xi) * 4;
        cmyk(s[i] as f64, s[i + 1] as f64, s[i + 2] as f64)
    };
    for y in 0..h {
        for x in 0..w {
            let (xf, yf) = (x as f64 + 0.5, y as f64 + 0.5);
            let mut ink = [0.0f64; 4];
            for (k, (ca, sa)) in rot.iter().enumerate() {
                // coordonnées dans la trame, centre de la cellule ramené dans l'image
                let u = xf * ca + yf * sa;
                let v = -xf * sa + yf * ca;
                let (cu, cv) = (((u / cell).floor() + 0.5) * cell, ((v / cell).floor() + 0.5) * cell);
                let cov = at(cu * ca - cv * sa, cu * sa + cv * ca)[k];
                // surface du point = encre : rayon = pas × √(encre / π)
                let r = cell * (cov / core::f64::consts::PI).sqrt();
                let d = ((u - cu) * (u - cu) + (v - cv) * (v - cv)).sqrt();
                ink[k] = (r - d + 0.5).clamp(0.0, 1.0);
            }
            let i = (y * w + x) * 4;
            let paper = 1.0 - ink[3];
            out[i] = jround(255.0 * (1.0 - ink[0]) * paper).clamp(0.0, 255.0) as u8;
            out[i + 1] = jround(255.0 * (1.0 - ink[1]) * paper).clamp(0.0, 255.0) as u8;
            out[i + 2] = jround(255.0 * (1.0 - ink[2]) * paper).clamp(0.0, 255.0) as u8;
            out[i + 3] = s[i + 3];
        }
    }
    out
}

/// Matrice de Bayer 8 × 8 (seuils 0..63).
pub const BAYER8: [u8; 64] = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33,
    9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

/// Niveaux par canal et taille d'un pixel de matrice du tramage ordonné selon la force (1..32) :
/// faible force = trame fine à 8 niveaux, forte = gros points à 2 niveaux (8 couleurs).
pub fn dither_params(rad: f64) -> (f64, usize) {
    let levels = (8.0 - (rad / 4.0).floor()).clamp(2.0, 8.0);
    let scale = (1.0 + (rad / 8.0).floor()).clamp(1.0, 5.0) as usize;
    (levels, scale)
}

/// Tramage ordonné (Bayer 8 × 8) : chaque canal ramené à quelques niveaux, seuil de la matrice.
fn ordered_dither(s: &[u8], w: usize, h: usize, rad: f64) -> Vec<u8> {
    let (levels, scale) = dither_params(rad);
    let steps = levels - 1.0;
    let mut out = vec![0u8; s.len()];
    for y in 0..h {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let t = (BAYER8[((y / scale) & 7) * 8 + ((x / scale) & 7)] as f64 + 0.5) / 64.0;
            for c in 0..3 {
                let v = s[i + c] as f64 / 255.0 * steps;
                let q = if v - v.floor() > t { v.floor() + 1.0 } else { v.floor() };
                out[i + c] = jround(q / steps * 255.0).clamp(0.0, 255.0) as u8;
            }
            out[i + 3] = s[i + 3];
        }
    }
    out
}

pub fn dynamic(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let (w, h) = (src.w, src.h);
    let out = stage(&src.d[..w * h * 4], w, h, p.i(0, 0), p.f(1, 1.0) as f64);
    let (a, b) = (y0 * w * 4, y1 * w * 4);
    dst[a..b].copy_from_slice(&out[a..b]);
}
