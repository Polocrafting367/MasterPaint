//! Trame (demi-teinte AM) — portage de js/effects/halftone-core.js (`illuApplyHalftone`).
//!
//! Paramètres : 0 mode (0 noir, 1 couleur, 2 CMJN)  1 pas de cellule  2 angle (°)
//! 3 papier blanc (1) / transparent (0)  4 encre noire  5 négatif
//! 6..9 densités C, M, J, N  10 engraissement  11..22 couleurs d'encre C, M, J, N (RVB).
//! Coordonnées absolues : le résultat ne dépend pas du découpage en bandes.

use crate::util::*;

const INK_ANGLES: [f64; 4] = [15.0, 75.0, 0.0, 45.0];
const INK_COLORS: [[f64; 3]; 4] = [[0.0, 158.0, 224.0], [233.0, 0.0, 124.0], [255.0, 237.0, 0.0], [26.0, 23.0, 27.0]];

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

#[inline]
fn coverage(cov: f64, density: f64, gain: f64) -> f64 {
    let mut v = (cov * density).clamp(0.0, 1.0);
    if gain > 0.0 && v > 0.0 && v < 1.0 {
        v = v.powf(1.0 / (1.0 + gain));
    }
    v
}

#[inline]
fn ink_dot(x: f64, y: f64, cos: f64, sin: f64, cell: f64, cov: f64) -> bool {
    if cov <= 0.001 {
        return false;
    }
    if cov >= 0.999 {
        return true;
    }
    let u = x * cos + y * sin;
    let v = -x * sin + y * cos;
    let du = u - (u / cell + 0.5).floor() * cell;
    let dv = v - (v / cell + 0.5).floor() * cell;
    let r = cell * 0.7071067811865476 * cov.sqrt();
    du * du + dv * dv <= r * r
}

pub fn halftone(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let g = |i: usize, d: f32| p.f(i, d) as f64;
    let mode = p.i(0, 0);
    let cell = g(1, 6.0).max(2.0);
    let keep_paper = p.b(3, true);
    let use_black = p.b(4, true);
    let inv = p.b(5, false);
    let density = [g(6, 1.0), g(7, 1.0), g(8, 1.0), g(9, 1.0)];
    let gain = g(10, 0.0).max(0.0);
    let mut inks = INK_COLORS;
    if p.0.len() >= 23 {
        for (k, ink) in inks.iter_mut().enumerate() {
            for c in 0..3 {
                ink[c] = g(11 + k * 3 + c, 0.0);
            }
        }
    }
    let base = g(2, 45.0) * core::f64::consts::PI / 180.0;
    // trames : (encre, cos, sin)
    let mut screens: Vec<(usize, f64, f64)> = Vec::new();
    if mode == 2 {
        for ink in 0..if use_black { 4 } else { 3 } {
            let a = base + INK_ANGLES[ink] * core::f64::consts::PI / 180.0;
            screens.push((ink, a.cos(), a.sin()));
        }
    } else {
        screens.push((3, base.cos(), base.sin()));
    }
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let a = src.d[i + 3] as f64 / 255.0;
            if a <= 0.0 {
                dst[i] = 0;
                dst[i + 1] = 0;
                dst[i + 2] = 0;
                dst[i + 3] = 0;
                continue;
            }
            let r = src.d[i] as f64 * a + 255.0 * (1.0 - a);
            let gg = src.d[i + 1] as f64 * a + 255.0 * (1.0 - a);
            let b = src.d[i + 2] as f64 * a + 255.0 * (1.0 - a);
            let (mut out, mut inked) = ([255.0f64; 3], false);
            let (xf, yf) = (x as f64, y as f64);
            if mode == 2 {
                let (rn, gn, bn) = (r / 255.0, gg / 255.0, b / 255.0);
                let mut k = 1.0 - rn.max(gn).max(bn);
                let (mut c, mut m, mut yy) = (0.0, 0.0, 0.0);
                if k < 0.999 {
                    c = (1.0 - rn - k) / (1.0 - k);
                    m = (1.0 - gn - k) / (1.0 - k);
                    yy = (1.0 - bn - k) / (1.0 - k);
                }
                if !use_black {
                    c = (c * (1.0 - k) + k).min(1.0);
                    m = (m * (1.0 - k) + k).min(1.0);
                    yy = (yy * (1.0 - k) + k).min(1.0);
                    k = 0.0;
                }
                let cov = [c, m, yy, k];
                let mut t = [1.0f64; 3];
                for &(ink, cs, sn) in &screens {
                    let mut cv = coverage(cov[ink], density[ink], gain);
                    if inv {
                        cv = 1.0 - cv;
                    }
                    if !ink_dot(xf, yf, cs, sn, cell, cv) {
                        continue;
                    }
                    inked = true;
                    for ch in 0..3 {
                        t[ch] *= inks[ink][ch] / 255.0;
                    }
                }
                if inked {
                    out = [255.0 * t[0], 255.0 * t[1], 255.0 * t[2]];
                }
            } else {
                let luma = (0.299 * r + 0.587 * gg + 0.114 * b) / 255.0;
                let mut cov = coverage(1.0 - luma, density[3], gain);
                if inv {
                    cov = 1.0 - cov;
                }
                let (_, cs, sn) = screens[0];
                if ink_dot(xf, yf, cs, sn, cell, cov) {
                    inked = true;
                    out = if mode == 1 {
                        [src.d[i] as f64, src.d[i + 1] as f64, src.d[i + 2] as f64]
                    } else {
                        [0.0; 3]
                    };
                }
            }
            if inked || keep_paper {
                dst[i] = u8c(out[0]);
                dst[i + 1] = u8c(out[1]);
                dst[i + 2] = u8c(out[2]);
                dst[i + 3] = 255;
            } else {
                dst[i] = 0;
                dst[i + 1] = 0;
                dst[i + 2] = 0;
                dst[i + 3] = 0;
            }
        }
    }
}
