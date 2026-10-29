//! Camera Raw — portage du pipeline photographique de référence
//! (js/effects/photo-pipeline.js, `process`, source 8 bits, sortie 8 bits).
//!
//! Même ordre des opérations et mêmes points de stockage en f32 que le JavaScript
//! (tampons Float32Array, LUT) ; les calculs intermédiaires sont en f64 comme en JS.
//! L'image entière est nécessaire (masques locaux, flous) : effet en un seul morceau.
//!
//! Paramètres :
//!  0 exposure 1 temp 2 tint 3 shadows 4 blacks 5 highlights 6 whites
//!  7 red 8 redHi 9 redSh 10 green 11 greenHi 12 greenSh 13 blue 14 blueHi 15 blueSh
//!  16 clarity 17 dehaze 18 contrast 19 saturation 20 vibrance 21 sharpen 22 vignette
//!  23 grain 24 grainSharpness 25 sourceWhite (0 = aucun) 26 fullWidth 27 fullHeight
//!  28 grainSeed 29 masques locaux désactivés (bits : 1 ombres, 2 noirs, 4 hautes lum., 8 blancs)
//!  30..37 hslHue 38..45 hslSat 46..53 hslLum
//!  54..57 nombre de points des courbes maître, R, V, B, puis les points (x, y) à la suite.

use crate::util::*;
use core::f64::consts::PI;

const EXPOSURE_STOPS_PER_100: f64 = 2.0;
const WB_MIRED_SPAN: f64 = 130.0;
const WB_TEMP_SOFT: f64 = 0.9;
const WB_TINT_SPAN: f64 = 0.22;
const WB_TINT_SOFT: f64 = 0.9;
const WB_REF_KELVIN: f64 = 6500.0;
const MASK_SHADOW_HI: f64 = 0.55;
const MASK_BLACK_HI: f64 = 0.25;
const MASK_HIGHLIGHT_LO: f64 = 0.45;
const MASK_WHITE_LO: f64 = 0.70;
const AMT_SHADOWS: f64 = 2.20;
const AMT_BLACKS: f64 = 2.00;
const AMT_HIGHLIGHTS: f64 = 2.40;
const AMT_WHITES: f64 = 1.80;
const SPLIT_PIVOT: f64 = 0.45;
const AMT_SPLIT_ZONE: f64 = 1.5;
const TONE_SHOULDER_START: f64 = 0.65;
const TONE_SHOULDER_MIN: f64 = 0.45;
const TONE_SHOULDER_MAX: f64 = 0.70;
const TONE_WHITE_MIN: f64 = 1.0;
const TONE_WHITE_MAX: f64 = 64.0;
const TONE_DESAT_START: f64 = 0.72;
const TONE_DESAT_AMOUNT: f64 = 0.55;
const CONTRAST_PIVOT: f64 = 0.5;
const SAT_SOFT_KNEE: f64 = 0.85;
const AMT_VIBRANCE: f64 = 0.60;
const CLARITY_RADIUS_FRAC: f64 = 0.020;
const AMT_CLARITY: f64 = 0.75;
const DEHAZE_RADIUS_FRAC: f64 = 0.060;
const AMT_DEHAZE: f64 = 0.55;
const VIGNETTE_INNER: f64 = 0.35;
const VIGNETTE_OUTER: f64 = 1.05;
const GRAIN_BASE_SCALE: f64 = 1.35;
const AMT_SHARPEN: f64 = 1.20;
const LOCAL_RADIUS_FRAC: f64 = 0.045;
const LOCAL_MIX: f64 = 0.72;
const CLIP_FIX_START: f64 = 0.90;
const CLIP_FIX_AMOUNT: f64 = 1.0;
const LUMA_R: f64 = 0.2126;
const LUMA_G: f64 = 0.7152;
const LUMA_B: f64 = 0.0722;

const BILATERAL_N: usize = 256;
const PERC_MAX: f64 = 4.0;
const PERC_N: usize = 4096;
const CURVE_LUT_SIZE: usize = 1024;
const ZONE_N: usize = 1024;
const ZONE_MAX: f64 = 1.3;
const BAYER4: [f64; 16] = [0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.];

#[inline]
fn clamp01(x: f64) -> f64 {
    if x < 0.0 { 0.0 } else if x > 1.0 { 1.0 } else { x }
}
#[inline]
fn clampv(x: f64, a: f64, b: f64) -> f64 {
    if x < a { a } else if x > b { b } else { x }
}
#[inline]
fn f32r(x: f64) -> f64 {
    x as f32 as f64
}
/// `x | 0` de JS (valeurs positives ici)
#[inline]
fn ti(x: f64) -> usize {
    x as usize
}

fn srgb_to_linear(c: f64) -> f64 {
    if c <= 0.0 {
        0.0
    } else if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn linear_to_srgb(c: f64) -> f64 {
    if c <= 0.0 {
        0.0
    } else if c <= 0.0031308 {
        12.92 * c
    } else if c <= 1.0 {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    } else {
        1.0 + (c - 1.0) * (1.055 / 2.4)
    }
}

#[inline]
fn luma_linear(r: f64, g: f64, b: f64) -> f64 {
    LUMA_R * r + LUMA_G * g + LUMA_B * b
}

#[inline]
fn smoothstep(e0: f64, e1: f64, x: f64) -> f64 {
    let t = clamp01((x - e0) / (e1 - e0));
    t * t * (3.0 - 2.0 * t)
}

#[inline]
fn tone_gain(u: f64, amt: f64) -> f64 {
    if u == 0.0 { 1.0 } else { (amt * u.tanh()).exp() }
}

struct Tables {
    lin8: [f64; 256],
    to_srgb: Vec<f64>,
    perc: Vec<f64>,
    bil: [f64; BILATERAL_N + 1],
}

impl Tables {
    fn new() -> Self {
        let mut lin8 = [0.0; 256];
        for (i, v) in lin8.iter_mut().enumerate() {
            *v = f32r(srgb_to_linear(i as f64 / 255.0));
        }
        let to_srgb = (0..=4096).map(|i| f32r(linear_to_srgb(i as f64 / 4096.0))).collect();
        let perc = (0..=PERC_N).map(|i| f32r(((i as f64 / PERC_N as f64) * PERC_MAX).powf(1.0 / 2.2))).collect();
        let mut bil = [0.0; BILATERAL_N + 1];
        for (i, v) in bil.iter_mut().enumerate() {
            let d = i as f64 / BILATERAL_N as f64;
            *v = f32r((-(d * d) / (2.0 * 0.22 * 0.22)).exp());
        }
        Tables { lin8, to_srgb, perc, bil }
    }

    #[inline]
    fn fast_lin_to_srgb(&self, c: f64) -> f64 {
        if c <= 0.0 {
            return 0.0;
        }
        if c >= 1.0 {
            return linear_to_srgb(c);
        }
        let t = c * 4096.0;
        let i = ti(t);
        let f = t - i as f64;
        self.to_srgb[i] * (1.0 - f) + self.to_srgb[i + 1] * f
    }

    #[inline]
    fn perceptual(&self, y: f64) -> f64 {
        if y <= 0.0 {
            return 0.0;
        }
        if y >= PERC_MAX {
            return y.powf(1.0 / 2.2);
        }
        let t = (y / PERC_MAX) * PERC_N as f64;
        let i = ti(t);
        let f = t - i as f64;
        self.perc[i] + (self.perc[i + 1] - self.perc[i]) * f
    }

    #[inline]
    fn bilateral(&self, delta: f64) -> f64 {
        let d = if delta < 0.0 { -delta } else { delta };
        if d >= 1.0 {
            return self.bil[BILATERAL_N];
        }
        self.bil[ti(d * BILATERAL_N as f64)]
    }
}

fn rgb_to_hsl_f(r: f64, g: f64, b: f64) -> (f64, f64, f64) {
    let max = if r > g { if r > b { r } else { b } } else if g > b { g } else { b };
    let min = if r < g { if r < b { r } else { b } } else if g < b { g } else { b };
    let l = (max + min) * 0.5;
    let (mut h, mut s) = (0.0, 0.0);
    let d = max - min;
    if d > 1e-9 {
        s = if l > 0.5 { d / (2.0 - max - min).max(1e-9) } else { d / (max + min).max(1e-9) };
        h = if max == r {
            (g - b) / d + if g < b { 6.0 } else { 0.0 }
        } else if max == g {
            (b - r) / d + 2.0
        } else {
            (r - g) / d + 4.0
        };
        h *= 60.0;
    }
    (h, s, l)
}

#[inline]
fn hue2rgb(p: f64, q: f64, mut t: f64) -> f64 {
    if t < 0.0 {
        t += 1.0;
    }
    if t > 1.0 {
        t -= 1.0;
    }
    if t < 1.0 / 6.0 {
        return p + (q - p) * 6.0 * t;
    }
    if t < 1.0 / 2.0 {
        return q;
    }
    if t < 2.0 / 3.0 {
        return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    }
    p
}

fn hsl_to_rgb_f(h: f64, s: f64, l: f64) -> (f64, f64, f64) {
    if s <= 1e-9 {
        return (l, l, l);
    }
    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;
    let hn = (h / 360.0) % 1.0;
    (hue2rgb(p, q, hn + 1.0 / 3.0), hue2rgb(p, q, hn), hue2rgb(p, q, hn - 1.0 / 3.0))
}

fn hsl_band_weights(h: f64) -> (usize, usize, f64, f64) {
    let (i1, i2, w2) = if h < 30.0 {
        (0, 1, h / 30.0)
    } else if h < 60.0 {
        (1, 2, (h - 30.0) / 30.0)
    } else if h < 120.0 {
        (2, 3, (h - 60.0) / 60.0)
    } else if h < 180.0 {
        (3, 4, (h - 120.0) / 60.0)
    } else if h < 240.0 {
        (4, 5, (h - 180.0) / 60.0)
    } else if h < 280.0 {
        (5, 6, (h - 240.0) / 40.0)
    } else if h < 320.0 {
        (6, 7, (h - 280.0) / 40.0)
    } else {
        (7, 0, (h - 320.0) / 40.0)
    };
    (i1, i2, 1.0 - w2, w2)
}

fn planckian_xy(kelvin: f64) -> (f64, f64) {
    let t_k = clampv(kelvin, 1667.0, 25000.0);
    let t = 1000.0 / t_k;
    let x = if t_k <= 4000.0 {
        -0.2661239 * t * t * t - 0.2343589 * t * t + 0.8776956 * t + 0.179910
    } else {
        -3.0258469 * t * t * t + 2.1070379 * t * t + 0.2226347 * t + 0.240390
    };
    let y = if t_k <= 2222.0 {
        -1.1063814 * x * x * x - 1.34811020 * x * x + 2.18555832 * x - 0.20219683
    } else if t_k <= 4000.0 {
        -0.9549476 * x * x * x - 1.37418593 * x * x + 2.09137015 * x - 0.16748867
    } else {
        3.0817580 * x * x * x - 5.87338670 * x * x + 3.75112997 * x - 0.37001483
    };
    (x, y)
}

fn xy_to_linear_rgb(x: f64, y: f64) -> [f64; 3] {
    let yy = 1.0;
    let xx = (x / y.max(1e-6)) * yy;
    let zz = ((1.0 - x - y) / y.max(1e-6)) * yy;
    [
        3.2404542 * xx - 1.5371385 * yy - 0.4985314 * zz,
        -0.9692660 * xx + 1.8760108 * yy + 0.0415560 * zz,
        0.0556434 * xx - 0.2040259 * yy + 1.0572252 * zz,
    ]
}

fn white_balance_gains(temp: f64, tint: f64) -> [f64; 3] {
    let mut g = [1.0, 1.0, 1.0];
    let tu = temp / 100.0;
    let nu = tint / 100.0;
    if tu == 0.0 && nu == 0.0 {
        return g;
    }
    if tu != 0.0 {
        let d_mired = -WB_MIRED_SPAN * (tu / WB_TEMP_SOFT).tanh();
        let ref_mired = 1e6 / WB_REF_KELVIN;
        let target_k = 1e6 / (ref_mired + d_mired).max(20.0);
        let (x, y) = planckian_xy(target_k);
        let w = xy_to_linear_rgb(x, y);
        let rf = xy_to_linear_rgb(0.31271, 0.32902);
        for c in 0..3 {
            g[c] = rf[c] / w[c].max(1e-4);
        }
    }
    if nu != 0.0 {
        let t = WB_TINT_SPAN * (nu / WB_TINT_SOFT).tanh();
        g[1] *= (1.0 - t).max(0.05);
        g[0] *= (1.0 + t * 0.5).max(0.05);
        g[2] *= (1.0 + t * 0.5).max(0.05);
    }
    let y = luma_linear(g[0], g[1], g[2]);
    if y > 1e-6 {
        for c in &mut g {
            *c /= y;
        }
    }
    g
}

fn shoulder_start(w: f64) -> f64 {
    if !(w > 1.0) {
        return TONE_SHOULDER_START;
    }
    clampv(0.75 - 0.08 * w.log2(), TONE_SHOULDER_MIN, TONE_SHOULDER_MAX)
}

/// Constantes de l'épaulement pour un point blanc donné (calculées une fois par image).
struct ToneMap {
    w: f64,
    t: f64,
    k: f64,
    denom: f64,
}

impl ToneMap {
    fn new(w: f64) -> Self {
        let t = shoulder_start(w);
        let k = 1.0 / (1.0 - t);
        ToneMap { w, t, k, denom: 1.0 - (-k * (w - t)).exp() }
    }

    #[inline]
    fn scalar(&self, x: f64) -> f64 {
        if x <= 0.0 {
            return 0.0;
        }
        if self.w <= 1.0000001 {
            return x;
        }
        let t = self.t;
        if x <= t || self.w <= t {
            return x;
        }
        if self.denom <= 1e-6 {
            return x;
        }
        t + (1.0 - t) * (1.0 - (-self.k * (x - t)).exp()) / self.denom
    }
}

fn tone_map_rgb(c: &mut [f64; 3], tm: &ToneMap) {
    let w = tm.w;
    let max_c = c[0].max(c[1].max(c[2]));
    if max_c <= 0.0 {
        *c = [0.0; 3];
        return;
    }
    if w <= 1.0000001 {
        return;
    }
    let ratio = tm.scalar(max_c) / max_c;
    for v in c.iter_mut() {
        *v *= ratio;
    }
    let m = c[0].max(c[1].max(c[2]));
    if m > TONE_DESAT_START {
        let t = smoothstep(TONE_DESAT_START, 1.0, m) * TONE_DESAT_AMOUNT;
        let y = luma_linear(c[0], c[1], c[2]);
        for v in c.iter_mut() {
            *v += (y - *v) * t;
        }
    }
}

/// Interpolation cubique monotone (Fritsch-Carlson) → LUT f32 de 1024 points.
fn curve_lut(pts_in: &[(f64, f64)]) -> Vec<f64> {
    let mut pts = pts_in.to_vec();
    pts.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(core::cmp::Ordering::Equal));
    if pts[0].0 > 0.0 {
        pts.insert(0, (0.0, pts[0].1));
    }
    if pts[pts.len() - 1].0 < 255.0 {
        let y = pts[pts.len() - 1].1;
        pts.push((255.0, y));
    }
    let n = pts.len();
    let mut delta = vec![0.0f64; (n - 1).max(1)];
    for i in 0..n - 1 {
        let dx = pts[i + 1].0 - pts[i].0;
        delta[i] = f32r(if dx != 0.0 { (pts[i + 1].1 - pts[i].1) / dx } else { 0.0 });
    }
    let mut m = vec![0.0f64; n];
    m[0] = delta[0];
    m[n - 1] = delta[n - 2];
    for i in 1..n - 1 {
        m[i] = if delta[i - 1] * delta[i] <= 0.0 { 0.0 } else { f32r(2.0 / (1.0 / delta[i - 1] + 1.0 / delta[i])) };
    }
    let mut lut = vec![0.0f64; CURVE_LUT_SIZE];
    let mut pi = 0usize;
    for (i, out) in lut.iter_mut().enumerate() {
        let xv = (i as f64 / (CURVE_LUT_SIZE - 1) as f64) * 255.0;
        while pi < n - 2 && xv >= pts[pi + 1].0 {
            pi += 1;
        }
        let (p0, p1) = (pts[pi], pts[pi + 1]);
        let h = p1.0 - p0.0;
        if h == 0.0 {
            *out = f32r(clamp01(p0.1 / 255.0));
            continue;
        }
        let t = (xv - p0.0) / h;
        let t2 = t * t;
        let t3 = t2 * t;
        let v = (2.0 * t3 - 3.0 * t2 + 1.0) * p0.1 + (t3 - 2.0 * t2 + t) * h * m[pi] + (-2.0 * t3 + 3.0 * t2) * p1.1
            + (t3 - t2) * h * m[pi + 1];
        *out = f32r(clamp01(v / 255.0));
    }
    lut
}

#[inline]
fn sample_lut(lut: &[f64], x: f64) -> f64 {
    if x <= 0.0 {
        return lut[0];
    }
    if x >= 1.0 {
        return lut[CURVE_LUT_SIZE - 1];
    }
    let t = x * (CURVE_LUT_SIZE - 1) as f64;
    let i = ti(t);
    let a = lut[i];
    a + (lut[i + 1] - a) * (t - i as f64)
}

fn hash_noise(x: i64, y: i64, seed: i64) -> f64 {
    let n = x.wrapping_mul(374761393).wrapping_add(y.wrapping_mul(668265263)).wrapping_add(seed.wrapping_mul(1274126177));
    let u = n as u32;
    let n = (u ^ (u >> 13)) as i32;
    let n = n.wrapping_mul(1274126177i32) as u32;
    let n = n ^ (n >> 16);
    n as f64 / 4294967296.0
}

fn blur_h(src: &[f32], dst: &mut [f32], w: usize, h: usize, r: usize) {
    let norm = 1.0 / (2 * r + 1) as f64;
    for y in 0..h {
        let row = y * w;
        let mut acc = src[row] as f64 * (r + 1) as f64;
        for i in 1..=r {
            acc += src[row + i.min(w - 1)] as f64;
        }
        for x in 0..w {
            dst[row + x] = (acc * norm) as f32;
            let add = src[row + (x + r + 1).min(w - 1)] as f64;
            let sub = src[row + x.saturating_sub(r)] as f64;
            acc += add - sub;
        }
    }
}

fn blur_v(src: &[f32], dst: &mut [f32], w: usize, h: usize, r: usize) {
    let norm = 1.0 / (2 * r + 1) as f64;
    for x in 0..w {
        let mut acc = src[x] as f64 * (r + 1) as f64;
        for i in 1..=r {
            acc += src[i.min(h - 1) * w + x] as f64;
        }
        for y in 0..h {
            dst[y * w + x] = (acc * norm) as f32;
            let add = src[(y + r + 1).min(h - 1) * w + x] as f64;
            let sub = src[y.saturating_sub(r) * w + x] as f64;
            acc += add - sub;
        }
    }
}

fn box_blur_channel(src: &[f32], dst: &mut [f32], w: usize, h: usize, r: usize) {
    if r < 1 {
        dst.copy_from_slice(src);
        return;
    }
    let mut tmp = vec![0f32; src.len()];
    blur_h(src, &mut tmp, w, h, r);
    blur_v(&tmp, dst, w, h, r);
    for _ in 0..2 {
        blur_h(dst, &mut tmp, w, h, r);
        blur_v(&tmp, dst, w, h, r);
    }
}

fn soft_knee01(x: f64, knee: f64) -> f64 {
    if x <= knee {
        return if x < 0.0 { 0.0 } else { x };
    }
    1.0 - (1.0 - knee) * (-(x - knee) / (1.0 - knee)).exp()
}

fn contrast_s(x: f64, f: f64) -> f64 {
    if f == 1.0 {
        return x;
    }
    if f < 1.0 {
        return CONTRAST_PIVOT + (x - CONTRAST_PIVOT) * f;
    }
    let u = 2.0 * x - 1.0;
    if u <= -0.9999999 {
        return 0.0;
    }
    if u >= 0.9999999 {
        return 1.0;
    }
    let a = 0.5 * ((1.0 + u) / (1.0 - u)).ln();
    0.5 + 0.5 * (f * a).tanh()
}

fn zone_lut<F: Fn(f64) -> f64>(f: F) -> Vec<f64> {
    (0..=ZONE_N).map(|i| f32r(f((i as f64 / ZONE_N as f64) * ZONE_MAX))).collect()
}

fn tone_curve(u_sh: f64, u_bl: f64, u_hi: f64, u_wh: f64) -> Vec<f64> {
    zone_lut(|pl| {
        let mut g = 1.0;
        if u_sh != 0.0 {
            g *= tone_gain(u_sh * smoothstep(MASK_SHADOW_HI, 0.0, pl), AMT_SHADOWS);
        }
        if u_bl != 0.0 {
            g *= tone_gain(u_bl * smoothstep(MASK_BLACK_HI, 0.0, pl), AMT_BLACKS);
        }
        if u_hi != 0.0 {
            g *= tone_gain(u_hi * smoothstep(MASK_HIGHLIGHT_LO, 1.0, pl), AMT_HIGHLIGHTS);
        }
        if u_wh != 0.0 {
            g *= tone_gain(u_wh * smoothstep(MASK_WHITE_LO, 1.15, pl), AMT_WHITES);
        }
        g
    })
}

fn split_curve(u_flat: f64, u_hi: f64, u_sh: f64) -> Vec<f64> {
    let flat = if u_flat != 0.0 { tone_gain(u_flat, 1.0) } else { 1.0 };
    zone_lut(|pl| {
        let mut g = flat;
        if u_hi != 0.0 {
            g *= tone_gain(u_hi * smoothstep(SPLIT_PIVOT, 1.0, pl), AMT_SPLIT_ZONE);
        }
        if u_sh != 0.0 {
            g *= tone_gain(u_sh * smoothstep(SPLIT_PIVOT, 0.0, pl), AMT_SPLIT_ZONE);
        }
        g
    })
}

#[inline]
fn sample_zone01(lut: &[f64], x: f64) -> f64 {
    if x <= 0.0 {
        return lut[0];
    }
    if x >= 1.0 {
        return lut[ZONE_N];
    }
    let t = x * ZONE_N as f64;
    let i = ti(t);
    lut[i] + (lut[i + 1] - lut[i]) * (t - i as f64)
}

#[inline]
fn sample_zone(lut: &[f64], pl: f64) -> f64 {
    if pl <= 0.0 {
        return lut[0];
    }
    if pl >= ZONE_MAX {
        return lut[ZONE_N];
    }
    let t = (pl / ZONE_MAX) * ZONE_N as f64;
    let i = ti(t);
    lut[i] + (lut[i + 1] - lut[i]) * (t - i as f64)
}

fn local_contrast(buf: &mut [f32], w: usize, h: usize, u_dehaze: f64, u_clarity: f64, tb: &Tables) {
    let n = w * h;
    let lum_of = |buf: &[f32], lum: &mut [f32]| {
        for i in 0..n {
            let o = i * 4;
            lum[i] = tb.perceptual(luma_linear(buf[o] as f64, buf[o + 1] as f64, buf[o + 2] as f64).max(0.0)) as f32;
        }
    };
    let mut lum = vec![0f32; n];
    lum_of(buf, &mut lum);
    let mut blur = vec![0f32; n];
    let min_dim = w.min(h) as f64;
    let apply_gain = |buf: &mut [f32], o: usize, k: f64| {
        if k != 1.0 {
            let g = k.powf(2.2);
            for c in 0..3 {
                buf[o + c] = (buf[o + c] as f64 * g) as f32;
            }
        }
    };
    if u_dehaze != 0.0 {
        let rad = ((min_dim * DEHAZE_RADIUS_FRAC + 0.5).floor() as usize).max(1);
        box_blur_channel(&lum, &mut blur, w, h, rad);
        let amt = u_dehaze.tanh() * AMT_DEHAZE;
        for i in 0..n {
            let veil = blur[i] as f64 * amt;
            let l = lum[i] as f64;
            let l_new = ((l - veil) / (1.0 - veil).max(0.05)).max(0.0);
            let k = if l > 1e-5 { l_new / l } else { 1.0 };
            apply_gain(buf, i * 4, k);
        }
        if u_clarity != 0.0 {
            lum_of(buf, &mut lum);
        }
    }
    if u_clarity != 0.0 {
        let rad = ((min_dim * CLARITY_RADIUS_FRAC + 0.5).floor() as usize).max(1);
        box_blur_channel(&lum, &mut blur, w, h, rad);
        let amt = u_clarity.tanh() * AMT_CLARITY;
        for i in 0..n {
            let l = lum[i] as f64;
            let prot = 4.0 * l * (1.0 - clamp01(l));
            let l_new = (l + (l - blur[i] as f64) * amt * prot).max(0.0);
            let k = if l > 1e-5 { l_new / l } else { 1.0 };
            apply_gain(buf, i * 4, k);
        }
    }
}

fn sharpen_f(buf: &mut [f32], w: usize, h: usize, amount: f64) {
    let n = w * h;
    let mut lum = vec![0f32; n];
    for i in 0..n {
        let o = i * 4;
        lum[i] = (0.299 * buf[o] as f64 + 0.587 * buf[o + 1] as f64 + 0.114 * buf[o + 2] as f64) as f32;
    }
    let k = amount * AMT_SHARPEN;
    for y in 0..h {
        let y_up = y.saturating_sub(1) * w;
        let y_dn = (y + 1).min(h - 1) * w;
        let yc = y * w;
        for x in 0..w {
            let xl = x.saturating_sub(1);
            let xr = (x + 1).min(w - 1);
            let c0 = lum[yc + x] as f64;
            let avg = (lum[y_up + x] as f64 + lum[y_dn + x] as f64 + lum[yc + xl] as f64 + lum[yc + xr] as f64) * 0.25;
            let d = (c0 - avg) * k;
            if d != 0.0 {
                let o = (yc + x) * 4;
                for c in 0..3 {
                    buf[o + c] = clamp01(buf[o + c] as f64 + d) as f32;
                }
            }
        }
    }
}

/// Source du pipeline : image 8 bits sRGB, ou RAW développé en flottant linéaire (RVB, sans
/// limite haute : toute la dynamique du capteur, comme `rawFloatData` de la version web).
pub enum Src<'a> {
    U8(&'a [u8]),
    Linear(&'a [f32]),
}

pub fn camera_raw(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    camera_raw_src(src.w, src.h, &Src::U8(src.d), dst, y0, y1, p);
}

pub fn camera_raw_src(w: usize, h: usize, src: &Src, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let n = w * h;
    let g = |i: usize| p.f(i, 0.0) as f64;
    let tb = Tables::new();
    let mut buf = vec![0f32; n * 4];

    // ---- paramètres dérivés ----
    let exp_mult = 2f64.powf((g(0) / 100.0) * EXPOSURE_STOPS_PER_100);
    let wb = white_balance_gains(g(1), g(2));
    let (gr, gg, gb) = (wb[0] * exp_mult, wb[1] * exp_mult, wb[2] * exp_mult);
    let (u_sh, u_bl, u_hi, u_wh) = (g(3) / 100.0, g(4) / 100.0, g(5) / 100.0, g(6) / 100.0);
    let has_tone = u_sh != 0.0 || u_bl != 0.0 || u_hi != 0.0 || u_wh != 0.0;
    let sp: Vec<f64> = (7..16).map(|i| g(i) / 100.0).collect();
    let has_split = sp.iter().any(|v| *v != 0.0);
    let (u_clarity, u_dehaze) = (g(16) / 100.0, g(17) / 100.0);
    let source_white = g(25);
    let sw = if source_white.is_finite() && source_white > 0.0 { source_white } else { 1.0 };
    let top_gain = tone_gain((g(5) / 100.0).max(0.0), AMT_HIGHLIGHTS) * tone_gain((g(6) / 100.0).max(0.0), AMT_WHITES);
    let scene_w = clampv(sw * exp_mult * wb[0].max(wb[1]).max(wb[2]) * top_gain, TONE_WHITE_MIN, TONE_WHITE_MAX);
    let contrast = g(18);
    let contrast_lut = if contrast != 0.0 {
        let f = ((contrast / 100.0) * 0.9).exp();
        Some((0..=ZONE_N).map(|i| f32r(contrast_s(i as f64 / ZONE_N as f64, f))).collect::<Vec<f64>>())
    } else {
        None
    };
    let mask_off = p.i(29, 0);
    let masked = |bit: i32| mask_off & bit == 0;
    let pick = |v: f64, bit: i32, want: bool| if masked(bit) == want { v } else { 0.0 };
    let tone_local = if has_tone {
        Some(tone_curve(pick(u_sh, 1, true), pick(u_bl, 2, true), pick(u_hi, 4, true), pick(u_wh, 8, true)))
    } else {
        None
    };
    let any_pixel = (u_sh != 0.0 && !masked(1)) || (u_bl != 0.0 && !masked(2)) || (u_hi != 0.0 && !masked(4)) || (u_wh != 0.0 && !masked(8));
    let tone_pixel = if any_pixel {
        Some(tone_curve(pick(u_sh, 1, false), pick(u_bl, 2, false), pick(u_hi, 4, false), pick(u_wh, 8, false)))
    } else {
        None
    };
    let splits = if has_split {
        Some([split_curve(sp[0], sp[1], sp[2]), split_curve(sp[3], sp[4], sp[5]), split_curve(sp[6], sp[7], sp[8])])
    } else {
        None
    };
    // courbes
    let mut curves: [Option<Vec<f64>>; 4] = [None, None, None, None];
    let mut at = 58usize;
    for (k, slot) in curves.iter_mut().enumerate() {
        let cnt = p.i(54 + k, 0).max(0) as usize;
        if cnt > 0 {
            let pts: Vec<(f64, f64)> = (0..cnt).map(|j| (g(at + 2 * j), g(at + 2 * j + 1))).collect();
            *slot = Some(curve_lut(&pts));
        }
        at += 2 * cnt;
    }
    let [lut_m, lut_r, lut_g, lut_b] = curves;
    let has_curves = lut_m.is_some() || lut_r.is_some() || lut_g.is_some() || lut_b.is_some();
    let hsl_hue: Vec<f64> = (30..38).map(g).collect();
    let hsl_sat: Vec<f64> = (38..46).map(g).collect();
    let hsl_lum: Vec<f64> = (46..54).map(g).collect();
    let has_hsl = hsl_hue.iter().chain(&hsl_sat).chain(&hsl_lum).any(|v| *v != 0.0);
    let (saturation, vibrance) = (g(19), g(20));
    let sat_m = ((saturation / 100.0) * 0.9).exp();
    let vib_f = (vibrance / 100.0).tanh();
    let has_sat = saturation != 0.0 || vibrance != 0.0;

    // ---- passe 1a : reconstruction des hautes lumières, balance des blancs, exposition ----
    let ceiling = sw;
    for i in 0..n {
        let o = i * 4;
        let mut c = match src {
            Src::U8(d) => [tb.lin8[d[o] as usize], tb.lin8[d[o + 1] as usize], tb.lin8[d[o + 2] as usize]],
            Src::Linear(l) => [l[i * 3] as f64, l[i * 3 + 1] as f64, l[i * 3 + 2] as f64],
        };
        let mx = if c[0] > c[1] { if c[0] > c[2] { c[0] } else { c[2] } } else if c[1] > c[2] { c[1] } else { c[2] };
        let start = ceiling * CLIP_FIX_START;
        if mx > start {
            let t = ((mx - start) / (ceiling - start).max(1e-6)).min(1.0) * CLIP_FIX_AMOUNT;
            if t > 0.0 {
                for v in c.iter_mut() {
                    *v += (mx - *v) * t;
                }
            }
        }
        buf[o] = (c[0] * gr) as f32;
        buf[o + 1] = (c[1] * gg) as f32;
        buf[o + 2] = (c[2] * gb) as f32;
        buf[o + 3] = match src {
            Src::U8(d) => (d[o + 3] as f64 / 255.0) as f32,
            Src::Linear(_) => 1.0,
        };
    }

    // ---- passe 1b : masques tonaux locaux, tonalité, étalonnage ----
    if has_tone || has_split {
        let pl: Vec<f32> = (0..n)
            .map(|i| tb.perceptual(luma_linear(buf[i * 4] as f64, buf[i * 4 + 1] as f64, buf[i * 4 + 2] as f64)) as f32)
            .collect();
        let radius = ((w.min(h) as f64 * LOCAL_RADIUS_FRAC + 0.5).floor()).max(1.0);
        let mut taps: Vec<(isize, isize)> = vec![(0, 0)];
        for i in 0..6 {
            let a = (i as f64 / 6.0) * PI * 2.0;
            taps.push(((a.cos() * 0.5 * radius + 0.5).floor() as isize, (a.sin() * 0.5 * radius + 0.5).floor() as isize));
        }
        for i in 0..6 {
            let a = ((i as f64 + 0.5) / 6.0) * PI * 2.0;
            taps.push(((a.cos() * radius + 0.5).floor() as isize, (a.sin() * radius + 0.5).floor() as isize));
        }
        for y in 0..h {
            if y % 32 == 0 && crate::util::cancelled() {
                return;
            }
            for x in 0..w {
                let i = y * w + x;
                let o = i * 4;
                let pl_c = pl[i] as f64;
                let (mut acc, mut wsum) = (0.0f64, 0.0f64);
                for &(dx, dy) in &taps {
                    let sx = (x as isize + dx).clamp(0, w as isize - 1) as usize;
                    let sy = (y as isize + dy).clamp(0, h as isize - 1) as usize;
                    let v = pl[sy * w + sx] as f64;
                    let wt = tb.bilateral(v - pl_c);
                    acc += v * wt;
                    wsum += wt;
                }
                let pl_local = pl_c * (1.0 - LOCAL_MIX) + (acc / if wsum > 1e-6 { wsum } else { 1.0 }) * LOCAL_MIX;
                let (mut r, mut gv, mut b) = (buf[o] as f64, buf[o + 1] as f64, buf[o + 2] as f64);
                if let Some(l) = &tone_local {
                    let k = sample_zone(l, pl_local);
                    r *= k;
                    gv *= k;
                    b *= k;
                }
                if let Some(l) = &tone_pixel {
                    let k = sample_zone(l, pl_c);
                    r *= k;
                    gv *= k;
                    b *= k;
                }
                if let Some(s) = &splits {
                    r *= sample_zone(&s[0], pl_local);
                    gv *= sample_zone(&s[1], pl_local);
                    b *= sample_zone(&s[2], pl_local);
                }
                buf[o] = r as f32;
                buf[o + 1] = gv as f32;
                buf[o + 2] = b as f32;
            }
        }
    }

    if crate::util::cancelled() {
        return;
    }
    // ---- passe 2 : voile puis clarté ----
    if u_clarity != 0.0 || u_dehaze != 0.0 {
        local_contrast(&mut buf, w, h, u_dehaze, u_clarity, &tb);
    }

    // ---- passe 3 : tone mapping, sRGB, outils display ----
    let tm = ToneMap::new(scene_w);
    for i in 0..n {
        let o = i * 4;
        let mut c = [buf[o] as f64, buf[o + 1] as f64, buf[o + 2] as f64];
        tone_map_rgb(&mut c, &tm);
        let mut r = clamp01(tb.fast_lin_to_srgb(c[0]));
        let mut gv = clamp01(tb.fast_lin_to_srgb(c[1]));
        let mut b = clamp01(tb.fast_lin_to_srgb(c[2]));
        if let Some(l) = &contrast_lut {
            r = sample_zone01(l, r);
            gv = sample_zone01(l, gv);
            b = sample_zone01(l, b);
        }
        if has_curves {
            if let Some(l) = &lut_r {
                r = sample_lut(l, r);
            }
            if let Some(l) = &lut_g {
                gv = sample_lut(l, gv);
            }
            if let Some(l) = &lut_b {
                b = sample_lut(l, b);
            }
            if let Some(l) = &lut_m {
                r = sample_lut(l, r);
                gv = sample_lut(l, gv);
                b = sample_lut(l, b);
            }
        }
        if has_hsl || has_sat {
            let (mut hh, mut s, mut l) = rgb_to_hsl_f(r, gv, b);
            if has_hsl {
                let (i1, i2, w1, w2) = hsl_band_weights(hh);
                let d = hsl_hue[i1] * w1 + hsl_hue[i2] * w2;
                if d != 0.0 {
                    hh = (hh + d + 360.0) % 360.0;
                }
                let d = hsl_sat[i1] * w1 + hsl_sat[i2] * w2;
                if d != 0.0 {
                    s = (s * ((d / 100.0) * 0.9).exp()).max(0.0);
                }
                let d = hsl_lum[i1] * w1 + hsl_lum[i2] * w2;
                if d != 0.0 {
                    l = clamp01(l + (d / 100.0) * 0.5 * (if d > 0.0 { 1.0 - l } else { l }) * 2.0);
                }
            }
            if has_sat {
                let mut sv = s * sat_m;
                if vib_f != 0.0 {
                    sv *= 1.0 + (1.0 - clamp01(sv)) * vib_f * AMT_VIBRANCE;
                }
                s = if sv <= 0.0 { 0.0 } else { soft_knee01(sv, SAT_SOFT_KNEE) };
            }
            let (rr, g2, bb) = hsl_to_rgb_f(hh, s, l);
            r = clamp01(rr);
            gv = clamp01(g2);
            b = clamp01(bb);
        }
        buf[o] = r as f32;
        buf[o + 1] = gv as f32;
        buf[o + 2] = b as f32;
    }

    if crate::util::cancelled() {
        return;
    }
    // ---- passe 4 : netteté ----
    if g(21) > 0.0 {
        sharpen_f(&mut buf, w, h, g(21) / 100.0);
    }

    if crate::util::cancelled() {
        return;
    }
    // ---- passe 5 : vignettage, grain, quantification tramée ----
    let vignette = g(22);
    let v_amt = (vignette / 100.0).tanh();
    let grain = g(23);
    let grain_amt = grain / 100.0;
    let gs = clampv(g(24) / 100.0, 0.0, 1.4);
    let ref_w = if g(26) > 0.0 { g(26) } else { w as f64 };
    let ref_h = if g(27) > 0.0 { g(27) } else { h as f64 };
    let grain_scale = GRAIN_BASE_SCALE * (1.6 - gs);
    let seed = if g(28) != 0.0 { g(28) as i64 } else { 1 };
    let aspect = w as f64 / (h.max(1)) as f64;
    let vnorm = (0.25 * aspect * aspect + 0.25).sqrt();
    for y in y0..y1 {
        if (y - y0) % 32 == 0 && crate::util::cancelled() {
            return;
        }
        let vy = (y as f64 + 0.5) / h as f64 - 0.5;
        for x in 0..w {
            let o = (y * w + x) * 4;
            let (mut r, mut gv, mut b) = (buf[o] as f64, buf[o + 1] as f64, buf[o + 2] as f64);
            if vignette != 0.0 {
                let vx = ((x as f64 + 0.5) / w as f64 - 0.5) * aspect;
                let dist = (vx * vx + vy * vy).sqrt() / vnorm;
                let f = (1.0 - v_amt * smoothstep(VIGNETTE_INNER, VIGNETTE_OUTER, dist)).max(0.0);
                r *= f;
                gv *= f;
                b *= f;
            }
            if grain > 0.0 {
                let gx = ((x as f64 + 0.5) / w as f64) * ref_w / grain_scale;
                let gy = ((y as f64 + 0.5) / h as f64) * ref_h / grain_scale;
                let nz = (hash_noise(gx as i64, gy as i64, seed) - 0.5) * grain_amt * (0.25 + 0.35 * gs);
                let wgt = 4.0 * r * (1.0 - clamp01(r)) + 0.25;
                r += nz * wgt;
                gv += nz * wgt;
                b += nz * wgt;
            }
            let d = (BAYER4[(y & 3) * 4 + (x & 3)] / 16.0 - 0.5) / 255.0;
            dst[o] = (clamp01(r + d) * 255.0 + 0.5) as u8;
            dst[o + 1] = (clamp01(gv + d) * 255.0 + 0.5) as u8;
            dst[o + 2] = (clamp01(b + d) * 255.0 + 0.5) as u8;
            dst[o + 3] = (clamp01(buf[o + 3] as f64) * 255.0 + 0.5) as u8;
        }
    }
}
