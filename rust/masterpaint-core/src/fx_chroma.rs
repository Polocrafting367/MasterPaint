//! Incrustation (chroma key CIELAB) — portage de js/effects/ChromaKeyer.js
//! (`computeMatte`, `applyUnmix`, `applyDespill`), mêmes formules en f64.
//!
//! Paramètres (valeurs déjà résolues côté JS, `||` compris) :
//!  0 kr  1 kg  2 kb  3 tolérance  4 drift  5 feather  6 clipBlack  7 clipWhite  8 gamma
//!  9 spill  10 recover  11 lumaProt  12 useKey2  13 kr2  14 kg2  15 kb2  16 mode
//! mode 0 (aperçu du worker) : alpha ← round(alpha × matte), puis anti-déversement si alpha > 0.
//! mode 1 (rendu final)     : RVB ← unmix puis anti-déversement ; alpha ← round(255 × matte)
//!                            (le JS en fait le masque de calque, sélection comprise).

use crate::util::*;

const LAB_K: f64 = 24389.0 / 27.0;
const LAB_E: f64 = 216.0 / 24389.0;

fn lin(c: f64) -> f64 {
    let c = c / 255.0;
    if c > 0.04045 { ((c + 0.055) / 1.055).powf(2.4) } else { c / 12.92 }
}

/// sRGB → linéaire pour les 256 valeurs entières (identique à `lin`, calculé une fois).
fn lin_table() -> [f64; 256] {
    let mut t = [0.0; 256];
    for (i, v) in t.iter_mut().enumerate() {
        *v = lin(i as f64);
    }
    t
}

fn rgb_to_lab(r: f64, g: f64, b: f64) -> [f64; 3] {
    lin3_to_lab(lin(r), lin(g), lin(b))
}

fn lin3_to_lab(rl: f64, gl: f64, bl: f64) -> [f64; 3] {
    let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
    let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
    let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
    let f = |t: f64| if t > LAB_E { t.powf(1.0 / 3.0) } else { (LAB_K * t + 16.0) / 116.0 };
    let (fx, fy, fz) = (f(x), f(y), f(z));
    [116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)]
}

struct Key {
    lab_k: [f64; 3],
    lab_k2: Option<[f64; 3]>,
    w_l: f64,
    w_c: f64,
    tol: f64,
    feather: f64,
    clip_black: f64,
    clip_white: f64,
    gamma: f64,
    luma_prot: f64,
    lut: [f64; 256],
}

impl Key {
    fn matte(&self, r: u8, g: u8, b: u8) -> f64 {
        let lp = lin3_to_lab(self.lut[r as usize], self.lut[g as usize], self.lut[b as usize]);
        let k = self.lab_k;
        let mut kc = k;
        if let Some(k2) = self.lab_k2 {
            let (el, ea, eb) = (k2[0] - k[0], k2[1] - k[1], k2[2] - k[2]);
            let seg = self.w_l * el * el + self.w_c * (ea * ea + eb * eb);
            if seg > 1e-6 {
                let (pl, pa, pb) = (lp[0] - k[0], lp[1] - k[1], lp[2] - k[2]);
                let t = ((self.w_l * pl * el + self.w_c * (pa * ea + pb * eb)) / seg).clamp(0.0, 1.0);
                kc = [k[0] + t * el, k[1] + t * ea, k[2] + t * eb];
            }
        }
        let mut dl = lp[0] - kc[0];
        let (da, db) = (lp[1] - kc[1], lp[2] - kc[2]);
        if self.luma_prot > 0.0 {
            if dl > 0.0 && lp[0] > 60.0 {
                let f = ((lp[0] - 60.0) / 40.0).powf(2.0);
                dl += dl * f * (self.luma_prot / 5.0);
            } else if dl < 0.0 && lp[0] < 40.0 {
                let f = ((40.0 - lp[0]) / 40.0).powf(2.0);
                dl -= dl.abs() * f * (self.luma_prot / 5.0);
            }
        }
        let dist = (dl * dl * self.w_l + (da * da + db * db) * self.w_c).sqrt();
        let mut m = 1.0;
        if dist <= self.tol {
            m = 0.0;
        } else if self.feather > 0.0 && dist < self.tol + self.feather {
            let t = (dist - self.tol) / self.feather;
            m = t * t * (3.0 - 2.0 * t);
        }
        if m < self.clip_black {
            m = 0.0;
        } else if m > self.clip_white {
            m = 1.0;
        } else if self.clip_white > self.clip_black {
            m = (m - self.clip_black) / (self.clip_white - self.clip_black);
        }
        if self.gamma != 1.0 && m > 0.0 && m < 1.0 {
            m = m.powf(1.0 / self.gamma);
        }
        m.clamp(0.0, 1.0)
    }
}

fn despill(r: f64, g: f64, b: f64, k: [f64; 3], intensity: f64) -> [f64; 3] {
    if intensity <= 0.0 {
        return [r, g, b];
    }
    let f = intensity / 100.0;
    let [kr, kg, kb] = k;
    if kg > kr && kg > kb {
        let m = r.max(b);
        if g > m {
            return [r, m + (g - m) * (1.0 - f), b];
        }
    } else if kb > kr && kb > kg {
        let m = r.max(g);
        if b > m {
            return [r, g, m + (b - m) * (1.0 - f)];
        }
    }
    [r, g, b]
}

fn unmix(r: f64, g: f64, b: f64, k: [f64; 3], matte: f64, intensity: f64) -> [f64; 3] {
    if intensity <= 0.0 || matte >= 1.0 || matte <= 0.0 {
        return [r, g, b];
    }
    let f = intensity / 100.0;
    let m = matte.max(0.05);
    let u = |c: f64, kc: f64| ((c - kc * (1.0 - matte)) / m).clamp(0.0, 255.0);
    [r * (1.0 - f) + u(r, k[0]) * f, g * (1.0 - f) + u(g, k[1]) * f, b * (1.0 - f) + u(b, k[2]) * f]
}

/// Uint8ClampedArray : arrondi au plus proche (demi vers le pair), borné.
#[inline]
fn clamped(v: f64) -> u8 {
    if v.is_nan() || v <= 0.0 {
        0
    } else if v >= 255.0 {
        255
    } else {
        let f = v.floor();
        let d = v - f;
        let r = if d > 0.5 || (d == 0.5 && (f as i64) % 2 == 1) { f + 1.0 } else { f };
        r as u8
    }
}

/// Math.round de JS (demi vers +∞)
#[inline]
fn js_round(v: f64) -> f64 {
    (v + 0.5).floor()
}

pub fn chroma(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let g = |i: usize, d: f32| p.f(i, d) as f64;
    let k = [g(0, 0.0), g(1, 255.0), g(2, 0.0)];
    let drift = g(4, 50.0) / 100.0;
    let key = Key {
        lab_k: rgb_to_lab(k[0], k[1], k[2]),
        lab_k2: if p.b(12, false) { Some(rgb_to_lab(g(13, 0.0), g(14, 0.0), g(15, 0.0))) } else { None },
        w_l: 1.0 - drift,
        w_c: 1.0 + drift,
        tol: g(3, 30.0),
        feather: g(5, 15.0),
        clip_black: (g(6, 0.0) / 100.0).max(0.0),
        clip_white: (g(7, 100.0) / 100.0).min(1.0),
        gamma: g(8, 1.0).max(0.1),
        luma_prot: g(11, 0.0),
        lut: lin_table(),
    };
    // Cache à correspondance directe couleur → matte : les fonds unis se répètent beaucoup.
    const CB: u32 = 15;
    let mut ckey = vec![u32::MAX; 1 << CB];
    let mut cval = vec![0f64; 1 << CB];
    let (spill, recover) = (g(9, 0.0), g(10, 0.0));
    let final_mode = p.i(16, 0) == 1;
    let w = src.w;
    for y in y0..y1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let (r, gg, b, a) = (src.d[i] as f64, src.d[i + 1] as f64, src.d[i + 2] as f64, src.d[i + 3] as f64);
            let rgb = (src.d[i] as u32) << 16 | (src.d[i + 1] as u32) << 8 | src.d[i + 2] as u32;
            let slot = ((rgb.wrapping_mul(0x9E37_79B1)) >> (32 - CB)) as usize;
            let m = if ckey[slot] == rgb {
                cval[slot]
            } else {
                let m = key.matte(src.d[i], src.d[i + 1], src.d[i + 2]);
                ckey[slot] = rgb;
                cval[slot] = m;
                m
            };
            if final_mode {
                let mut fg = [r, gg, b];
                if recover > 0.0 {
                    fg = unmix(fg[0], fg[1], fg[2], k, m, recover);
                }
                if spill > 0.0 {
                    fg = despill(fg[0], fg[1], fg[2], k, spill);
                }
                dst[i] = clamped(fg[0]);
                dst[i + 1] = clamped(fg[1]);
                dst[i + 2] = clamped(fg[2]);
                dst[i + 3] = js_round(255.0 * m) as u8;
            } else {
                let na = js_round(a * m);
                let mut fg = [r, gg, b];
                if spill > 0.0 && na > 0.0 {
                    fg = despill(r, gg, b, k, spill);
                }
                dst[i] = clamped(fg[0]);
                dst[i + 1] = clamped(fg[1]);
                dst[i + 2] = clamped(fg[2]);
                dst[i + 3] = na as u8;
            }
        }
    }
}
