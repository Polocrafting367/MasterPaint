//! Outils partagés : accès pixels, échantillonnage, couleurs, bruit, flous de base.

// ---------------------------------------------------------------- maths rapides
//
// En WASM, f32::sin / powf / exp / atan2 / hypot / round ne sont pas des instructions :
// ce sont des appels à libm, qui ici deviennent des imports JS (Math.*) — un aller-retour
// JS par pixel. `Fm` fournit des versions Rust pures (erreur relative ~1e-7, largement
// suffisante pour de l'image 8 bits). En natif on garde la libm du système.

#[cfg(target_arch = "wasm32")]
mod fastmath {
    use core::f64::consts::{FRAC_PI_2, LN_2, PI, TAU};

    #[inline]
    fn round_half_away(x: f64) -> f64 {
        let r = (x.abs() + 0.5).floor();
        if x < 0.0 { -r } else { r }
    }

    pub fn sin(x: f64) -> f64 {
        // réduction à [-π, π] puis à [-π/2, π/2]
        let mut r = x - TAU * round_half_away(x / TAU);
        if r > FRAC_PI_2 {
            r = PI - r;
        } else if r < -FRAC_PI_2 {
            r = -PI - r;
        }
        let r2 = r * r;
        r * (1.0 + r2 * (-1.0 / 6.0 + r2 * (1.0 / 120.0 + r2 * (-1.0 / 5040.0 + r2 * (1.0 / 362_880.0 + r2 * (-1.0 / 39_916_800.0 + r2 / 6_227_020_800.0))))))
    }

    #[inline]
    pub fn cos(x: f64) -> f64 {
        sin(x + FRAC_PI_2)
    }

    fn atan_unit(x: f64) -> f64 {
        // |x| <= 1 : réduction supplémentaire autour de tan(π/8) pour un polynôme court
        const T8: f64 = 0.414_213_562_373_095_1;
        let (base, y) = if x > T8 { (core::f64::consts::FRAC_PI_4, (x - 1.0) / (x + 1.0)) } else if x < -T8 { (-core::f64::consts::FRAC_PI_4, (x + 1.0) / (1.0 - x)) } else { (0.0, x) };
        let y2 = y * y;
        base + y * (1.0 + y2 * (-1.0 / 3.0 + y2 * (1.0 / 5.0 + y2 * (-1.0 / 7.0 + y2 * (1.0 / 9.0 + y2 * (-1.0 / 11.0 + y2 * (1.0 / 13.0 - y2 / 15.0)))))))
    }

    pub fn atan2(y: f64, x: f64) -> f64 {
        if x == 0.0 && y == 0.0 {
            return 0.0;
        }
        let (ax, ay) = (x.abs(), y.abs());
        let a = if ay <= ax { atan_unit(ay / ax) } else { FRAC_PI_2 - atan_unit(ax / ay) };
        let a = if x < 0.0 { PI - a } else { a };
        if y < 0.0 { -a } else { a }
    }

    pub fn exp(x: f64) -> f64 {
        if x > 709.0 {
            return f64::INFINITY;
        }
        if x < -745.0 {
            return 0.0;
        }
        let k = round_half_away(x / LN_2);
        let r = x - k * LN_2;
        let p = 1.0 + r * (1.0 + r * (0.5 + r * (1.0 / 6.0 + r * (1.0 / 24.0 + r * (1.0 / 120.0 + r * (1.0 / 720.0 + r * (1.0 / 5040.0 + r * (1.0 / 40320.0 + r / 362_880.0))))))));
        let ki = k as i64;
        if ki < -1022 {
            return p * f64::from_bits(((ki + 1022 + 1023) as u64) << 52) * f64::from_bits(1u64 << 52);
        }
        p * f64::from_bits(((ki + 1023) as u64) << 52)
    }

    pub fn ln(x: f64) -> f64 {
        if x <= 0.0 {
            return if x == 0.0 { f64::NEG_INFINITY } else { f64::NAN };
        }
        if !x.is_finite() {
            return x;
        }
        let mut bits = x.to_bits();
        let mut e = ((bits >> 52) & 0x7ff) as i64;
        if e == 0 {
            // sous-normal
            let y = x * f64::from_bits(((54 + 1023) as u64) << 52);
            bits = y.to_bits();
            e = ((bits >> 52) & 0x7ff) as i64 - 54;
        }
        let mut m = f64::from_bits((bits & 0x000f_ffff_ffff_ffff) | 0x3ff0_0000_0000_0000);
        let mut ex = e - 1023;
        if m > core::f64::consts::SQRT_2 {
            m *= 0.5;
            ex += 1;
        }
        let s = (m - 1.0) / (m + 1.0);
        let s2 = s * s;
        let l = 2.0 * s * (1.0 + s2 * (1.0 / 3.0 + s2 * (1.0 / 5.0 + s2 * (1.0 / 7.0 + s2 * (1.0 / 9.0 + s2 * (1.0 / 11.0 + s2 * (1.0 / 13.0 + s2 / 15.0)))))));
        l + ex as f64 * LN_2
    }

    pub fn pow(x: f64, y: f64) -> f64 {
        if y == 0.0 {
            return 1.0;
        }
        if x == 0.0 {
            return if y > 0.0 { 0.0 } else { f64::INFINITY };
        }
        if x < 0.0 {
            // exposant entier seulement
            if y.floor() == y {
                let r = exp(y * ln(-x));
                return if (y as i64) & 1 == 1 { -r } else { r };
            }
            return f64::NAN;
        }
        exp(y * ln(x))
    }

    #[inline]
    pub fn round(x: f64) -> f64 {
        round_half_away(x)
    }
}

/// Fonctions mathématiques utilisées par les effets (rapides en WASM, libm en natif).
pub trait Fm: Sized + Copy {
    fn fsin(self) -> Self;
    fn fcos(self) -> Self;
    fn fatan2(self, x: Self) -> Self;
    fn fexp(self) -> Self;
    fn fln(self) -> Self;
    fn fpow(self, e: Self) -> Self;
    fn fhypot(self, o: Self) -> Self;
    fn fround(self) -> Self;
}

macro_rules! impl_fm {
    ($t:ty) => {
        impl Fm for $t {
            #[cfg(target_arch = "wasm32")]
            #[inline] fn fsin(self) -> Self { fastmath::sin(self as f64) as $t }
            #[cfg(target_arch = "wasm32")]
            #[inline] fn fcos(self) -> Self { fastmath::cos(self as f64) as $t }
            #[cfg(target_arch = "wasm32")]
            #[inline] fn fatan2(self, x: Self) -> Self { fastmath::atan2(self as f64, x as f64) as $t }
            #[cfg(target_arch = "wasm32")]
            #[inline] fn fexp(self) -> Self { fastmath::exp(self as f64) as $t }
            #[cfg(target_arch = "wasm32")]
            #[inline] fn fln(self) -> Self { fastmath::ln(self as f64) as $t }
            #[cfg(target_arch = "wasm32")]
            #[inline] fn fpow(self, e: Self) -> Self { fastmath::pow(self as f64, e as f64) as $t }
            #[cfg(target_arch = "wasm32")]
            #[inline] fn fround(self) -> Self { fastmath::round(self as f64) as $t }
            #[cfg(not(target_arch = "wasm32"))]
            #[inline] fn fsin(self) -> Self { self.sin() }
            #[cfg(not(target_arch = "wasm32"))]
            #[inline] fn fcos(self) -> Self { self.cos() }
            #[cfg(not(target_arch = "wasm32"))]
            #[inline] fn fatan2(self, x: Self) -> Self { self.atan2(x) }
            #[cfg(not(target_arch = "wasm32"))]
            #[inline] fn fexp(self) -> Self { self.exp() }
            #[cfg(not(target_arch = "wasm32"))]
            #[inline] fn fln(self) -> Self { self.ln() }
            #[cfg(not(target_arch = "wasm32"))]
            #[inline] fn fpow(self, e: Self) -> Self { self.powf(e) }
            #[cfg(not(target_arch = "wasm32"))]
            #[inline] fn fround(self) -> Self { self.round() }
            #[inline] fn fhypot(self, o: Self) -> Self { (self * self + o * o).sqrt() }
        }
    };
}
impl_fm!(f32);
impl_fm!(f64);

/// log2 approché (erreur ~1e-5) par décomposition mantisse/exposant.
#[inline]
pub fn log2_fast(x: f32) -> f32 {
    if x <= 0.0 {
        return -126.0;
    }
    let b = x.to_bits();
    let mut e = ((b >> 23) & 0xff) as i32 - 127;
    let mut m = f32::from_bits((b & 0x007f_ffff) | 0x3f80_0000); // [1,2)
    if m > core::f32::consts::SQRT_2 {
        m *= 0.5;
        e += 1;
    }
    // log2(m) = 2/ln2 · atanh(s), s = (m−1)/(m+1) ∈ [−0.172, 0.172]
    let s = (m - 1.0) / (m + 1.0);
    let s2 = s * s;
    let p = 2.885_390_1 * s * (1.0 + s2 * (1.0 / 3.0 + s2 * (0.2 + s2 * (1.0 / 7.0 + s2 / 9.0))));
    e as f32 + p
}

/// 2^x approché (erreur relative < 2e-6).
#[inline]
pub fn exp2_fast(x: f32) -> f32 {
    let x = x.clamp(-126.0, 126.0);
    let i = x.floor();
    let f = x - i;
    let p = 1.0 + f * (0.693_147_2 + f * (0.240_226_5 + f * (0.055_504_1 + f * (0.009_618_1 + f * (0.001_333_4 + f * (0.000_154_0 + f * 0.000_015_25))))));
    p * f32::from_bits(((i as i32 + 127) as u32) << 23)
}

/// x^y rapide pour x ≥ 0.
#[inline]
pub fn pow_fast(x: f32, y: f32) -> f32 {
    if x <= 0.0 {
        return if y == 0.0 { 1.0 } else { 0.0 };
    }
    exp2_fast(y * log2_fast(x))
}

/// Paramètres numériques d'un effet (tableau de f32 transmis par le JS).
pub struct P<'a>(pub &'a [f32]);

impl<'a> P<'a> {
    #[inline]
    pub fn f(&self, i: usize, def: f32) -> f32 {
        match self.0.get(i) {
            Some(v) if v.is_finite() => *v,
            _ => def,
        }
    }
    #[inline]
    pub fn i(&self, i: usize, def: i32) -> i32 {
        self.f(i, def as f32) as i32
    }
    #[inline]
    pub fn b(&self, i: usize, def: bool) -> bool {
        self.f(i, if def { 1.0 } else { 0.0 }) != 0.0
    }
    /// Couleur RVB encodée 0xRRGGBB.
    #[inline]
    pub fn rgb(&self, i: usize, def: u32) -> [f32; 3] {
        let v = self.f(i, def as f32) as u32;
        [((v >> 16) & 255) as f32, ((v >> 8) & 255) as f32, (v & 255) as f32]
    }
    /// Sous-tableau à partir de l'indice `i` (LUT, palettes…).
    pub fn tail(&self, i: usize) -> &'a [f32] {
        if i < self.0.len() { &self.0[i..] } else { &[] }
    }
}

/// Image RGBA 8 bits non prémultipliée (ordre canvas).
#[derive(Clone, Copy)]
pub struct Img<'a> {
    pub d: &'a [u8],
    pub w: usize,
    pub h: usize,
}

impl<'a> Img<'a> {
    #[inline]
    pub fn idx(&self, x: usize, y: usize) -> usize {
        (y * self.w + x) * 4
    }
    #[inline]
    pub fn px(&self, x: usize, y: usize) -> [u8; 4] {
        let i = self.idx(x, y);
        [self.d[i], self.d[i + 1], self.d[i + 2], self.d[i + 3]]
    }
    /// Pixel avec coordonnées bornées aux bords.
    #[inline]
    pub fn pxc(&self, x: isize, y: isize) -> [u8; 4] {
        let xx = x.clamp(0, self.w as isize - 1) as usize;
        let yy = y.clamp(0, self.h as isize - 1) as usize;
        self.px(xx, yy)
    }
    /// Échantillonnage bilinéaire (coordonnées bornées comme `_sampleBilinear` du worker).
    #[inline]
    pub fn bilinear(&self, mut x: f32, mut y: f32) -> [f32; 4] {
        let w = self.w as f32;
        let h = self.h as f32;
        if self.w < 2 || self.h < 2 {
            let p = self.pxc(x as isize, y as isize);
            return [p[0] as f32, p[1] as f32, p[2] as f32, p[3] as f32];
        }
        if !(x >= 0.0) { x = 0.0; }
        if !(y >= 0.0) { y = 0.0; }
        if x > w - 1.0 { x = w - 1.0; }
        if y > h - 1.0 { y = h - 1.0; }
        // indice borné en entier : en f32, « w - 1 - 1e-4 » vaut w - 1 dès w ≈ 4000 px
        // (lecture hors image sur la dernière ligne / colonne)
        let x0 = (x as usize).min(self.w - 2);
        let y0 = (y as usize).min(self.h - 2);
        let tx = x - x0 as f32;
        let ty = y - y0 as f32;
        let i00 = self.idx(x0, y0);
        let i10 = i00 + 4;
        let i01 = i00 + self.w * 4;
        let i11 = i01 + 4;
        let d = self.d;
        let mut o = [0.0f32; 4];
        for c in 0..4 {
            let a = d[i00 + c] as f32 + (d[i10 + c] as f32 - d[i00 + c] as f32) * tx;
            let b = d[i01 + c] as f32 + (d[i11 + c] as f32 - d[i01 + c] as f32) * tx;
            o[c] = a + (b - a) * ty;
        }
        o
    }
    /// Bilinéaire en alpha prémultiplié, transparent hors image (pour rotations / zooms).
    #[inline]
    pub fn bilinear_transparent(&self, x: f32, y: f32) -> [f32; 4] {
        let fx = x.floor();
        let fy = y.floor();
        let tx = x - fx;
        let ty = y - fy;
        let x0 = fx as isize;
        let y0 = fy as isize;
        let mut acc = [0.0f32; 4];
        let taps = [(0isize, 0isize, (1.0 - tx) * (1.0 - ty)), (1, 0, tx * (1.0 - ty)), (0, 1, (1.0 - tx) * ty), (1, 1, tx * ty)];
        for (dx, dy, wgt) in taps {
            let xx = x0 + dx;
            let yy = y0 + dy;
            if wgt <= 0.0 || xx < 0 || yy < 0 || xx >= self.w as isize || yy >= self.h as isize {
                continue;
            }
            let p = self.px(xx as usize, yy as usize);
            let a = p[3] as f32 * wgt;
            acc[0] += p[0] as f32 * a;
            acc[1] += p[1] as f32 * a;
            acc[2] += p[2] as f32 * a;
            acc[3] += a;
        }
        if acc[3] > 1e-6 {
            [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], acc[3]]
        } else {
            [0.0; 4]
        }
    }
}

#[inline]
pub fn c8(v: f32) -> u8 {
    if v.is_nan() { 0 } else if v <= 0.0 { 0 } else if v >= 255.0 { 255 } else { (v + 0.5) as u8 }
}

/// Troncature (équivalent `v | 0` JS borné).
#[inline]
pub fn t8(v: f32) -> u8 {
    if v.is_nan() || v <= 0.0 { 0 } else if v >= 255.0 { 255 } else { v as u8 }
}

#[inline]
pub fn clampf(v: f32, lo: f32, hi: f32) -> f32 {
    if v < lo { lo } else if v > hi { hi } else { v }
}

#[inline]
pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

#[inline]
pub fn luma601(r: f32, g: f32, b: f32) -> f32 {
    0.299 * r + 0.587 * g + 0.114 * b
}

/// Luminance entière Paint.NET : (r*77 + g*151 + b*28) >> 8.
#[inline]
pub fn luma_pdn(p: &[u8]) -> u32 {
    (p[0] as u32 * 77 + p[1] as u32 * 151 + p[2] as u32 * 28) >> 8
}

/// Sortie d'un effet : bande de lignes [y0,y1) indexée en coordonnées ABSOLUES de l'image
/// (index = (y*w + x)*4). `base` = y0*w*4. Permet à plusieurs threads d'écrire chacun
/// dans sa propre bande sans partager de tampon mutable.
pub struct Out<'a> {
    pub d: &'a mut [u8],
    pub base: usize,
}

impl<'a> core::ops::Index<usize> for Out<'a> {
    type Output = u8;
    #[inline]
    fn index(&self, i: usize) -> &u8 {
        &self.d[i - self.base]
    }
}
impl<'a> core::ops::IndexMut<usize> for Out<'a> {
    #[inline]
    fn index_mut(&mut self, i: usize) -> &mut u8 {
        &mut self.d[i - self.base]
    }
}
impl<'a> core::ops::Index<core::ops::Range<usize>> for Out<'a> {
    type Output = [u8];
    #[inline]
    fn index(&self, r: core::ops::Range<usize>) -> &[u8] {
        &self.d[r.start - self.base..r.end - self.base]
    }
}
impl<'a> core::ops::IndexMut<core::ops::Range<usize>> for Out<'a> {
    #[inline]
    fn index_mut(&mut self, r: core::ops::Range<usize>) -> &mut [u8] {
        &mut self.d[r.start - self.base..r.end - self.base]
    }
}

#[inline]
pub fn put(dst: &mut Out, i: usize, r: f32, g: f32, b: f32, a: f32) {
    let j = i - dst.base;
    let d = &mut dst.d[j..j + 4];
    d[0] = c8(r);
    d[1] = c8(g);
    d[2] = c8(b);
    d[3] = c8(a);
}

/// Copie des lignes [y0,y1) de src vers dst.
pub fn copy_rows(src: &Img, dst: &mut Out, y0: usize, y1: usize) {
    let a = y0 * src.w * 4;
    let b = y1 * src.w * 4;
    dst[a..b].copy_from_slice(&src.d[a..b]);
}

// ---------------------------------------------------------------- hachage / bruit

#[inline]
pub fn hash_u32(mut x: u32) -> u32 {
    x ^= x >> 16;
    x = x.wrapping_mul(0x7feb_352d);
    x ^= x >> 15;
    x = x.wrapping_mul(0x846c_a68b);
    x ^= x >> 16;
    x
}

#[inline]
pub fn hash2(x: i32, y: i32, seed: u32) -> u32 {
    hash_u32((x as u32).wrapping_mul(0x9E37_79B1) ^ hash_u32((y as u32).wrapping_add(seed.wrapping_mul(0x85EB_CA77))))
}

/// Bruit uniforme [0,1) déterministe par pixel.
#[inline]
pub fn rand01(x: i32, y: i32, seed: u32) -> f32 {
    (hash2(x, y, seed) >> 8) as f32 * (1.0 / 16_777_216.0)
}

/// Générateur xorshift (séquentiel).
pub struct Rng(pub u32);
impl Rng {
    #[inline]
    pub fn next(&mut self) -> u32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = if x == 0 { 0x1234_5678 } else { x };
        self.0
    }
    #[inline]
    pub fn f01(&mut self) -> f32 {
        (self.next() >> 8) as f32 * (1.0 / 16_777_216.0)
    }
}

/// Bruit gaussien approx. (somme de 4 uniformes, centré réduit).
#[inline]
pub fn gauss(x: i32, y: i32, seed: u32) -> f32 {
    let h0 = hash2(x, y, seed);
    let h1 = hash_u32(h0 ^ 0xA511_E9B3);
    let s = (h0 & 0xFFFF) as f32 + (h0 >> 16) as f32 + (h1 & 0xFFFF) as f32 + (h1 >> 16) as f32;
    (s / 65535.0 - 2.0) * 1.732_050_8
}

// ---------------------------------------------------------------- Perlin (port OpenPDN PerlinNoise2D)

pub const PERM: [u8; 256] = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6,
    148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171,
    168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245,
    40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86,
    164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47,
    16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39,
    253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162,
    241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150,
    254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];

#[inline]
fn lut(i: i32) -> i32 {
    PERM[(i & 255) as usize] as i32
}
#[inline]
fn fade(t: f32) -> f32 {
    t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
}
#[inline]
fn grad(hash: i32, x: f32, y: f32) -> f32 {
    let h = hash & 15;
    let u = if h < 8 { x } else { y };
    let v = if h < 4 { y } else if h == 12 || h == 14 { x } else { 0.0 };
    (if h & 1 == 0 { u } else { -u }) + (if h & 2 == 0 { v } else { -v })
}

/// Perlin brut, indices entiers et fractions séparés (variante CloudsEffect).
#[inline]
pub fn perlin_raw2(ix: i32, iy: i32, x: f32, y: f32, seed: i32) -> f32 {
    let u = fade(x);
    let v = fade(y);
    let a = lut(ix + seed) + iy;
    let aa = lut(a);
    let ab = lut(a + 1);
    let b = lut(ix + 1 + seed) + iy;
    let ba = lut(b);
    let bb = lut(b + 1);
    let e1 = lerp(grad(lut(aa), x, y), grad(lut(ba), x - 1.0, y), u);
    let e2 = lerp(grad(lut(ab), x, y - 1.0), grad(lut(bb), x - 1.0, y - 1.0), u);
    lerp(e1, e2, v)
}

#[inline]
pub fn perlin_raw(x: f32, y: f32, seed: i32) -> f32 {
    let xf = x.floor();
    let yf = y.floor();
    perlin_raw2((xf as i32) & 255, (yf as i32) & 255, x - xf, y - yf, seed)
}

/// Perlin multi-octaves (PerlinNoise2D.Noise).
pub fn perlin_noise(mut x: f32, mut y: f32, detail: f32, roughness: f32, seed: i32) -> f32 {
    let ang = 137.2f32 / 180.0 * core::f32::consts::PI;
    let (s, c) = (ang.fsin(), ang.fcos());
    let mut total = 0.0;
    let mut freq = 1.0f32;
    let mut amp = 1.0f32;
    let mut partial = detail;
    let oct = detail.ceil() as i32;
    for _ in 0..oct {
        let xr = x * c - y * s;
        let yr = x * s + y * c;
        let mut n = perlin_raw(xr * freq, yr * freq, seed) * amp;
        if partial < 1.0 {
            n *= partial;
        }
        total += n;
        amp *= roughness;
        if amp < 0.001 {
            break;
        }
        freq += freq;
        partial -= 1.0;
        x = xr + 499.0;
        y = yr + 506.0;
    }
    total
}

// ---------------------------------------------------------------- couleurs

pub fn rgb_to_hsv(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let (r, g, b) = (r / 255.0, g / 255.0, b / 255.0);
    let mx = r.max(g).max(b);
    let mn = r.min(g).min(b);
    let d = mx - mn;
    let s = if mx == 0.0 { 0.0 } else { d / mx };
    let mut h = 0.0;
    if d > 0.0 {
        h = if mx == r {
            (g - b) / d + if g < b { 6.0 } else { 0.0 }
        } else if mx == g {
            (b - r) / d + 2.0
        } else {
            (r - g) / d + 4.0
        };
        h /= 6.0;
    }
    (h * 360.0, s * 100.0, mx * 100.0)
}

pub fn hsv_to_rgb(h: f32, s: f32, v: f32) -> (f32, f32, f32) {
    let h = h / 360.0;
    let s = s / 100.0;
    let v = v / 100.0;
    let i = (h * 6.0).floor();
    let f = h * 6.0 - i;
    let p = v * (1.0 - s);
    let q = v * (1.0 - f * s);
    let t = v * (1.0 - (1.0 - f) * s);
    let (r, g, b) = match (i as i32).rem_euclid(6) {
        0 => (v, t, p),
        1 => (q, v, p),
        2 => (p, v, t),
        3 => (p, q, v),
        4 => (t, p, v),
        _ => (v, p, q),
    };
    (r * 255.0, g * 255.0, b * 255.0)
}

pub fn rgb_to_hsl(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let (r, g, b) = (r / 255.0, g / 255.0, b / 255.0);
    let mx = r.max(g).max(b);
    let mn = r.min(g).min(b);
    let l = (mx + mn) / 2.0;
    if mx == mn {
        return (0.0, 0.0, l * 100.0);
    }
    let d = mx - mn;
    let s = if l > 0.5 { d / (2.0 - mx - mn) } else { d / (mx + mn) };
    let h = if mx == r {
        (g - b) / d + if g < b { 6.0 } else { 0.0 }
    } else if mx == g {
        (b - r) / d + 2.0
    } else {
        (r - g) / d + 4.0
    } / 6.0;
    (h * 360.0, s * 100.0, l * 100.0)
}

fn hue2rgb(p: f32, q: f32, mut t: f32) -> f32 {
    if t < 0.0 { t += 1.0; }
    if t > 1.0 { t -= 1.0; }
    if t < 1.0 / 6.0 { return p + (q - p) * 6.0 * t; }
    if t < 0.5 { return q; }
    if t < 2.0 / 3.0 { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
    p
}

pub fn hsl_to_rgb(h: f32, s: f32, l: f32) -> (f32, f32, f32) {
    let h = h / 360.0;
    let s = s / 100.0;
    let l = l / 100.0;
    if s == 0.0 {
        return (l * 255.0, l * 255.0, l * 255.0);
    }
    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;
    (hue2rgb(p, q, h + 1.0 / 3.0) * 255.0, hue2rgb(p, q, h) * 255.0, hue2rgb(p, q, h - 1.0 / 3.0) * 255.0)
}

// ---------------------------------------------------------------- flous de base

/// Plage de lignes à calculer pour obtenir un résultat exact sur [y0,y1) après un
/// filtre de rayon vertical `m` (marge).
#[inline]
pub fn band(h: usize, y0: usize, y1: usize, m: usize) -> (usize, usize) {
    (y0.saturating_sub(m), (y1 + m).min(h))
}

/// Flou boîte RGBA (bords répétés) appliqué `passes` fois sur les lignes [ya,yb)
/// traitées comme une image autonome. Retourne un buffer w*(yb-ya)*4.
pub fn box_blur_band(src: &Img, ya: usize, yb: usize, r: usize, passes: usize) -> Vec<u8> {
    let w = src.w;
    let bh = yb - ya;
    let mut cur: Vec<u8> = src.d[ya * w * 4..yb * w * 4].to_vec();
    if r == 0 || w == 0 || bh == 0 {
        return cur;
    }
    let mut tmp = vec![0u8; cur.len()];
    let div = (2 * r + 1) as u32;
    let half = div / 2;
    // division entière exacte par `div` via multiplication (évite une division par octet)
    let inv = ((1u64 << 32) + div as u64 - 1) / div as u64;
    let q = |v: u32| (((v + half) as u64 * inv) >> 32) as u8;
    let row = w * 4;
    let mut acc = vec![0u32; row];
    for _ in 0..passes {
        // passe horizontale (fenêtre glissante par ligne)
        for y in 0..bh {
            let line = &cur[y * row..(y + 1) * row];
            let out = &mut tmp[y * row..(y + 1) * row];
            let mut s = [0u32; 4];
            for k in 0..=(2 * r) {
                let xx = (k as isize - r as isize).clamp(0, w as isize - 1) as usize * 4;
                for c in 0..4 {
                    s[c] += line[xx + c] as u32;
                }
            }
            for x in 0..w {
                let i = x * 4;
                let xn = (x + r + 1).min(w - 1) * 4;
                let xp = x.saturating_sub(r) * 4;
                for c in 0..4 {
                    out[i + c] = q(s[c]);
                    s[c] = s[c] + line[xn + c] as u32 - line[xp + c] as u32;
                }
            }
        }
        // passe verticale : accumulateurs par colonne, parcours ligne par ligne (cache)
        acc.fill(0);
        for k in 0..=(2 * r) {
            let yy = (k as isize - r as isize).clamp(0, bh as isize - 1) as usize;
            for (a, v) in acc.iter_mut().zip(&tmp[yy * row..(yy + 1) * row]) {
                *a += *v as u32;
            }
        }
        for y in 0..bh {
            let yn = (y + r + 1).min(bh - 1) * row;
            let yp = y.saturating_sub(r) * row;
            let out = &mut cur[y * row..(y + 1) * row];
            for i in 0..row {
                out[i] = q(acc[i]);
                acc[i] = acc[i] + tmp[yn + i] as u32 - tmp[yp + i] as u32;
            }
        }
    }
    cur
}

/// Flou boîte des lignes [y0,y1) avec la marge nécessaire ; renvoie (buffer, ya).
pub fn box_blur_for(src: &Img, y0: usize, y1: usize, r: usize, passes: usize) -> (Vec<u8>, usize) {
    let (ya, yb) = if y0 == 0 && y1 == src.h { (0, src.h) } else { band(src.h, y0, y1, (r + 1) * passes.max(1) + 1) };
    (box_blur_band(src, ya, yb, r, passes), ya)
}

/// Flou gaussien flottant d'un champ scalaire (séparable, bords répétés).
pub fn gauss_blur_f32(field: &mut [f32], w: usize, h: usize, sigma: f32) {
    if sigma < 0.3 || w == 0 || h == 0 {
        return;
    }
    let r = (sigma * 3.0).ceil() as isize;
    let mut k = Vec::with_capacity((2 * r + 1) as usize);
    let mut sum = 0.0;
    for i in -r..=r {
        let v = (-(i * i) as f32 / (2.0 * sigma * sigma)).exp();
        k.push(v);
        sum += v;
    }
    for v in k.iter_mut() {
        *v /= sum;
    }
    let mut tmp = vec![0.0f32; w * h];
    for y in 0..h {
        for x in 0..w {
            let mut s = 0.0;
            for (j, kv) in k.iter().enumerate() {
                let xx = (x as isize + j as isize - r).clamp(0, w as isize - 1) as usize;
                s += field[y * w + xx] * kv;
            }
            tmp[y * w + x] = s;
        }
    }
    for y in 0..h {
        for x in 0..w {
            let mut s = 0.0;
            for (j, kv) in k.iter().enumerate() {
                let yy = (y as isize + j as isize - r).clamp(0, h as isize - 1) as usize;
                s += tmp[yy * w + x] * kv;
            }
            field[y * w + x] = s;
        }
    }
}

/// Histogrammes locaux sur un disque (base des effets « LocalHistogram » de Paint.NET).
/// Appelle `f(x, y, hr, hg, hb, ha, area)` pour chaque pixel des lignes [y0,y1).
/// Fenêtre glissante horizontale : O(r) par pixel au lieu de O(r²).
pub fn local_histogram<F: FnMut(usize, usize, &[u32; 256], &[u32; 256], &[u32; 256], &[u32; 256], u32)>(
    src: &Img,
    y0: usize,
    y1: usize,
    radius: f32,
    mut f: F,
) {
    let w = src.w as isize;
    let h = src.h as isize;
    let r = radius.max(0.0).ceil() as isize;
    let rr = radius * radius;
    // demi-largeur de la ligne du disque pour chaque dy
    let mut half = vec![0isize; (2 * r + 1) as usize];
    for dy in -r..=r {
        let s = rr - (dy * dy) as f32;
        half[(dy + r) as usize] = if s < 0.0 { -1 } else { s.sqrt() as isize };
    }
    let mut hr = [0u32; 256];
    let mut hg = [0u32; 256];
    let mut hb = [0u32; 256];
    let mut ha = [0u32; 256];
    for y in y0 as isize..y1 as isize {
        hr.fill(0);
        hg.fill(0);
        hb.fill(0);
        ha.fill(0);
        let mut area = 0u32;
        // initialisation pour x = 0
        for dy in -r..=r {
            let yy = y + dy;
            let hw = half[(dy + r) as usize];
            if yy < 0 || yy >= h || hw < 0 {
                continue;
            }
            for dx in -hw..=hw {
                if dx < 0 || dx >= w {
                    continue;
                }
                let p = src.px(dx as usize, yy as usize);
                hr[p[0] as usize] += 1;
                hg[p[1] as usize] += 1;
                hb[p[2] as usize] += 1;
                ha[p[3] as usize] += 1;
                area += 1;
            }
        }
        for x in 0..w {
            f(x as usize, y as usize, &hr, &hg, &hb, &ha, area);
            // glissement : retirer le bord gauche (x - hw), ajouter le bord droit (x + 1 + hw)
            for dy in -r..=r {
                let yy = y + dy;
                let hw = half[(dy + r) as usize];
                if yy < 0 || yy >= h || hw < 0 {
                    continue;
                }
                let xo = x - hw;
                if xo >= 0 && xo < w {
                    let p = src.px(xo as usize, yy as usize);
                    hr[p[0] as usize] -= 1;
                    hg[p[1] as usize] -= 1;
                    hb[p[2] as usize] -= 1;
                    ha[p[3] as usize] -= 1;
                    area -= 1;
                }
                let xi = x + 1 + hw;
                if xi >= 0 && xi < w {
                    let p = src.px(xi as usize, yy as usize);
                    hr[p[0] as usize] += 1;
                    hg[p[1] as usize] += 1;
                    hb[p[2] as usize] += 1;
                    ha[p[3] as usize] += 1;
                    area += 1;
                }
            }
        }
    }
}

/// Valeur au percentile `pct` (0..100) d'un histogramme.
#[inline]
pub fn hist_percentile(hist: &[u32; 256], area: u32, pct: f32) -> u8 {
    let target = ((area as f32) * pct / 100.0) as u32;
    let mut acc = 0u32;
    for (i, &c) in hist.iter().enumerate() {
        acc += c;
        if acc > target {
            return i as u8;
        }
    }
    255
}

/// Matrice 3x3 inverse (homographies).
pub fn invert3x3(m: &[f64; 9]) -> Option<[f64; 9]> {
    let [a, b, c, d, e, f, g, h, i] = *m;
    let aa = e * i - f * h;
    let bb = -(d * i - f * g);
    let cc = d * h - e * g;
    let dd = -(b * i - c * h);
    let ee = a * i - c * g;
    let ff = -(a * h - b * g);
    let gg = b * f - c * e;
    let hh = -(a * f - c * d);
    let ii = a * e - b * d;
    let det = a * aa + b * bb + c * cc;
    if det.abs() < 1e-14 {
        return None;
    }
    let k = 1.0 / det;
    Some([aa * k, dd * k, gg * k, bb * k, ee * k, hh * k, cc * k, ff * k, ii * k])
}

/// Homographie 4 points (élimination de Gauss avec pivot partiel).
pub fn homography(src: &[[f64; 2]; 4], dst: &[[f64; 2]; 4]) -> Option<[f64; 9]> {
    let mut m = [[0.0f64; 9]; 8];
    for i in 0..4 {
        let [x, y] = src[i];
        let [xp, yp] = dst[i];
        m[2 * i] = [x, y, 1.0, 0.0, 0.0, 0.0, -x * xp, -y * xp, xp];
        m[2 * i + 1] = [0.0, 0.0, 0.0, x, y, 1.0, -x * yp, -y * yp, yp];
    }
    for col in 0..8 {
        let mut piv = col;
        for r in col + 1..8 {
            if m[r][col].abs() > m[piv][col].abs() {
                piv = r;
            }
        }
        m.swap(col, piv);
        let v = m[col][col];
        if v.abs() < 1e-12 {
            return None;
        }
        for c in col..9 {
            m[col][c] /= v;
        }
        for r in 0..8 {
            if r == col {
                continue;
            }
            let f = m[r][col];
            if f == 0.0 {
                continue;
            }
            for c in col..9 {
                m[r][c] -= f * m[col][c];
            }
        }
    }
    Some([m[0][8], m[1][8], m[2][8], m[3][8], m[4][8], m[5][8], m[6][8], m[7][8], 1.0])
}

// ---------------------------------------------------------------- annulation

/// Test d'annulation partageable entre fils (voir `with_cancel`).
pub type CancelToken = std::sync::Arc<dyn Fn() -> bool + Send + Sync>;

std::thread_local! {
    /// test d'annulation du calcul en cours dans ce fil (voir `with_cancel`)
    static CANCEL: core::cell::RefCell<Option<CancelToken>> = const { core::cell::RefCell::new(None) };
}

/// Exécute `run` avec un test d'annulation : les longues boucles du moteur (Camera Raw…)
/// appellent `cancelled()` et s'arrêtent tôt quand il répond vrai. Le résultat d'un calcul
/// annulé est incomplet : l'appelant, qui connaît son test, l'ignore.
pub fn with_cancel<R>(test: impl Fn() -> bool + Send + Sync + 'static, run: impl FnOnce() -> R) -> R {
    with_token(Some(std::sync::Arc::new(test)), run)
}

/// Test d'annulation du fil courant, à transmettre aux fils de calcul qu'il lance.
pub fn cancel_token() -> Option<CancelToken> {
    CANCEL.with(|c| c.borrow().clone())
}

/// Exécute `run` avec le test d'annulation `tok` (repris d'un autre fil par `cancel_token`).
pub fn with_token<R>(tok: Option<CancelToken>, run: impl FnOnce() -> R) -> R {
    let prev = CANCEL.with(|c| core::mem::replace(&mut *c.borrow_mut(), tok));
    let out = run();
    CANCEL.with(|c| *c.borrow_mut() = prev);
    out
}

/// Le calcul en cours dans ce fil a-t-il été annulé ?
pub fn cancelled() -> bool {
    CANCEL.with(|c| c.borrow().as_ref().is_some_and(|f| f()))
}
