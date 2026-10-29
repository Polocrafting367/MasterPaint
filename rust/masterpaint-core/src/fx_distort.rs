//! Déformations (Effets › Déformer) et transformations géométriques.

use crate::util::*;

/// Applique une fonction de correspondance inverse (x,y)->(sx,sy) avec échantillonnage bilinéaire.
fn geometric<F: Fn(f32, f32) -> (f32, f32)>(src: &Img, dst: &mut Out, y0: usize, y1: usize, map: F) {
    for y in y0..y1 {
        for x in 0..src.w {
            let (sx, sy) = map(x as f32, y as f32);
            let o = src.bilinear(sx, sy);
            put(dst, src.idx(x, y), o[0], o[1], o[2], o[3]);
        }
    }
}

/// Idem mais transparent hors de l'image (rotations, zooms arrière, projection).
fn geometric_clip<F: Fn(f32, f32) -> Option<(f32, f32)>>(src: &Img, dst: &mut Out, y0: usize, y1: usize, map: F) {
    for y in y0..y1 {
        for x in 0..src.w {
            let i = src.idx(x, y);
            match map(x as f32, y as f32) {
                Some((sx, sy)) => {
                    let o = src.bilinear_transparent(sx, sy);
                    put(dst, i, o[0], o[1], o[2], o[3]);
                }
                None => put(dst, i, 0.0, 0.0, 0.0, 0.0),
            }
        }
    }
}

fn center(src: &Img) -> (f32, f32, f32) {
    let cx = src.w as f32 / 2.0;
    let cy = src.h as f32 / 2.0;
    (cx, cy, cx.fhypot(cy).max(1.0))
}

/// Bosse : p: [intensité -100..100]
pub fn bulge(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let k = p.f(0, 50.0) / 100.0 * 1.5;
    let (cx, cy, mr) = center(src);
    geometric(src, dst, y0, y1, |x, y| {
        let (dx, dy) = (x - cx, y - cy);
        let r = dx.fhypot(dy);
        if r < 0.5 {
            return (cx, cy);
        }
        let t = r / mr;
        let rs = r / (1.0 + k * (1.0 - t * t));
        (cx + dx / r * rs, cy + dy / r * rs)
    });
}

/// Pincement : p: [intensité]
pub fn pinch(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let mut q = p.0.to_vec();
    if q.is_empty() {
        q.push(50.0);
    }
    q[0] = -q[0];
    bulge(src, dst, y0, y1, &P(&q));
}

/// Torsion : p: [angle°]
pub fn twist(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let a = p.f(0, 45.0).to_radians();
    let (cx, cy, mr) = center(src);
    geometric(src, dst, y0, y1, |x, y| {
        let (dx, dy) = (x - cx, y - cy);
        let r = dx.fhypot(dy);
        let th = dy.fatan2(dx) + a * (1.0 - r / mr);
        (cx + r * th.fcos(), cy + r * th.fsin())
    });
}

/// Inversion polaire : p: [intensité %]
pub fn polar_invert(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let amt = p.f(0, 50.0) / 100.0;
    let (cx, cy, mr) = center(src);
    geometric(src, dst, y0, y1, |x, y| {
        let (dx, dy) = (x - cx, y - cy);
        let r = dx.fhypot(dy);
        let th = dy.fatan2(dx);
        let rs = r * (1.0 - amt) + (mr - r) * amt;
        (cx + rs * th.fcos(), cy + rs * th.fsin())
    });
}

/// Réflexion mosaïque : p: [taille de tuile]
pub fn tile_reflect(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let t = p.f(0, 40.0).max(4.0).fround();
    geometric(src, dst, y0, y1, |x, y| {
        let qx = (x / t).floor();
        let qy = (y / t).floor();
        let tx = x - qx * t;
        let ty = y - qy * t;
        let mx = if tx < t / 2.0 { tx } else { t - 1.0 - tx };
        let my = if ty < t / 2.0 { ty } else { t - 1.0 - ty };
        (qx * t + mx, qy * t + my)
    });
}

/// Onde : p: [amplitude, période]
pub fn wave(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let amp = p.f(0, 12.0);
    let k = core::f32::consts::TAU / p.f(1, 14.0).max(1.0);
    geometric(src, dst, y0, y1, |x, y| (x + amp * (y * k).fsin(), y + amp * (x * k).fcos()));
}

/// Miroir 4 secteurs.
pub fn mirror_quad(src: &Img, dst: &mut Out, y0: usize, y1: usize, _p: &P) {
    let (w, h) = (src.w as f32, src.h as f32);
    geometric(src, dst, y0, y1, |x, y| (if x < w / 2.0 { x } else { w - 1.0 - x }, if y < h / 2.0 { y } else { h - 1.0 - y }));
}

/// Sens du décalage de chaque canal (R, V, B) selon le couple choisi : rouge / bleu (objectif),
/// rouge / vert, vert / bleu, vert / magenta, bleu / jaune.
const ABERR_PAIRS: [[f32; 3]; 5] = [[-1.0, 0.0, 1.0], [-1.0, 1.0, 0.0], [0.0, -1.0, 1.0], [1.0, -1.0, 1.0], [1.0, 1.0, -1.0]];

/// Réglages communs de l'aberration chromatique (effet autonome et option des autres effets).
struct Aberr {
    amt: f32,
    /// 0 horizontale, 1 verticale, 2 selon `dir`, 3 radiale (depuis le centre)
    shape: i32,
    dir: (f32, f32),
    cx: f32,
    cy: f32,
    inner_r: f32,
    max_r: f32,
    k: [f32; 3],
    /// 0 uniforme, 1 linéaire, 2 quadratique (selon la distance au centre, après la zone nette)
    falloff: i32,
    /// part du canal d'origine gardée sous la frange (0..0.5)
    keep: f32,
}

impl Aberr {
    #[allow(clippy::too_many_arguments)]
    fn new(w: usize, h: usize, amt: f32, shape: i32, angle: f32, ox: f32, oy: f32, inner: f32, pair: i32, invert: bool, falloff: i32, overlap: f32) -> Aberr {
        let (w, h) = (w as f32, h as f32);
        let cx = w / 2.0 * (1.0 + clampf(ox, -100.0, 100.0) / 100.0);
        let cy = h / 2.0 * (1.0 + clampf(oy, -100.0, 100.0) / 100.0);
        let max_r = cx.max(w - cx).fhypot(cy.max(h - cy)).max(1.0);
        let a = angle.to_radians();
        let mut k = ABERR_PAIRS[pair.clamp(0, 4) as usize];
        if invert {
            k = k.map(|v| -v);
        }
        Aberr {
            amt: amt.max(0.0),
            shape,
            dir: (a.fcos(), a.fsin()),
            cx,
            cy,
            inner_r: clampf(inner / 100.0, 0.0, 1.0) * max_r,
            max_r,
            k,
            falloff,
            keep: clampf(overlap / 100.0, 0.0, 1.0) * 0.5,
        }
    }

    /// Progression 0..1 depuis le centre : nulle dans la zone nette, 1 au coin le plus éloigné.
    fn ramp(&self, d: f32) -> f32 {
        if self.max_r <= self.inner_r {
            return if d > self.inner_r { 1.0 } else { 0.0 };
        }
        clampf((d - self.inner_r) / (self.max_r - self.inner_r), 0.0, 1.0)
    }

    /// Direction (unitaire) du décalage au pixel et force de la progression.
    fn at(&self, x: f32, y: f32) -> (f32, f32, f32) {
        let (dx, dy) = (x - self.cx, y - self.cy);
        let d = dx.fhypot(dy);
        let s = match self.falloff {
            1 => self.ramp(d),
            2 => {
                let t = self.ramp(d);
                t * t
            }
            _ => 1.0,
        };
        let (ux, uy) = match self.shape {
            1 => (0.0, 1.0),
            2 => self.dir,
            3 if d > 0.5 => (dx / d, dy / d),
            3 => (0.0, 0.0),
            _ => (1.0, 0.0),
        };
        (ux, uy, s)
    }

    /// Couleur du pixel (x, y) avec chaque canal pris à `k × (dx, dy)` (alpha prémultiplié :
    /// les franges débordent proprement sur le transparent).
    fn sample(&self, src: &Img, x: f32, y: f32, dx: f32, dy: f32) -> [f32; 4] {
        let c = src.bilinear(x, y);
        if dx.abs() < 1e-3 && dy.abs() < 1e-3 {
            return c;
        }
        let mut pm = [0.0f32; 3];
        let mut alpha = 0.0f32;
        for ch in 0..3 {
            let k = self.k[ch];
            let q = if k == 0.0 { c } else { src.bilinear(x + k * dx, y + k * dy) };
            let v = q[ch] * q[3] * (1.0 - self.keep) + c[ch] * c[3] * self.keep;
            let a = q[3] * (1.0 - self.keep) + c[3] * self.keep;
            pm[ch] = v;
            alpha = alpha.max(a);
        }
        if alpha <= 1e-3 {
            return [0.0; 4];
        }
        [pm[0] / alpha, pm[1] / alpha, pm[2] / alpha, alpha]
    }
}

/// Aberration chromatique : p: [décalage px, forme (0 horizontale, 1 verticale, 2 angle,
/// 3 radiale), angle °, centre x %, centre y %, zone nette %, canaux (0 R/B, 1 R/V, 2 V/B,
/// 3 V/M, 4 B/J), sens inversé, progression (0 uniforme, 1 linéaire, 2 quadratique),
/// chevauchement %]. Un seul réglage (anciens projets) : décalage horizontal rouge / bleu.
pub fn chromatic(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let a = Aberr::new(src.w, src.h, p.f(0, 6.0), p.i(1, 0), p.f(2, 0.0), p.f(3, 0.0), p.f(4, 0.0), p.f(5, 0.0), p.i(6, 0), p.b(7, false), p.i(8, 0), p.f(9, 0.0));
    for y in y0..y1 {
        for x in 0..src.w {
            let (xf, yf) = (x as f32, y as f32);
            let (ux, uy, s) = a.at(xf, yf);
            let m = a.amt * s;
            let o = a.sample(src, xf, yf, ux * m, uy * m);
            put(dst, src.idx(x, y), o[0], o[1], o[2], o[3]);
        }
    }
}

/// Moyenne glissante (fenêtre 2r+1, bords répétés) d'un champ flottant, horizontale puis verticale.
fn box_f32(f: &mut [f32], w: usize, h: usize, r: usize) {
    if r == 0 || w == 0 || h == 0 {
        return;
    }
    let n = (2 * r + 1) as f32;
    let mut tmp = vec![0.0f32; f.len()];
    for y in 0..h {
        let row = &f[y * w..(y + 1) * w];
        let mut s: f32 = (0..=2 * r).map(|k| row[(k as isize - r as isize).clamp(0, w as isize - 1) as usize]).sum();
        for x in 0..w {
            tmp[y * w + x] = s / n;
            s += row[(x + r + 1).min(w - 1)] - row[x.saturating_sub(r)];
        }
    }
    for x in 0..w {
        let mut s: f32 = (0..=2 * r).map(|k| tmp[(k as isize - r as isize).clamp(0, h as isize - 1) as usize * w + x]).sum();
        for y in 0..h {
            f[y * w + x] = s / n;
            s += tmp[(y + r + 1).min(h - 1) * w + x] - tmp[y.saturating_sub(r) * w + x];
        }
    }
}

/// Force locale d'un effet (0..1) : écart entre l'original et le résultat, lissé puis ramené
/// au 98e centile (là où l'effet agit le plus : 1 ; là où il ne change rien : 0).
fn effect_strength(orig: &[u8], fx: &[u8], w: usize, h: usize, r: usize) -> Vec<f32> {
    let mut f: Vec<f32> = orig
        .chunks_exact(4)
        .zip(fx.chunks_exact(4))
        .map(|(a, b)| {
            let pa = |p: &[u8], c: usize| p[c] as f32 * p[3] as f32 / 255.0;
            let d = (0..3).map(|c| (pa(a, c) - pa(b, c)).abs()).fold((a[3] as f32 - b[3] as f32).abs(), f32::max);
            d / 255.0
        })
        .collect();
    box_f32(&mut f, w, h, r);
    box_f32(&mut f, w, h, r);
    let mut hist = [0u32; 1024];
    for v in &f {
        hist[((v * 1023.0) as usize).min(1023)] += 1;
    }
    let target = (f.len() as f64 * 0.98) as u64;
    let (mut acc, mut q) = (0u64, 1023usize);
    for (i, c) in hist.iter().enumerate() {
        acc += *c as u64;
        if acc >= target {
            q = i;
            break;
        }
    }
    let norm = (q as f32 / 1023.0).max(0.04);
    for v in f.iter_mut() {
        *v = (*v / norm).min(1.0);
    }
    f
}

/// Option « Aberration chromatique » des autres effets, appliquée à leur résultat `fx` :
/// pas d'aberration là où l'effet n'agit pas (centre net d'un flou radial…), d'autant plus
/// qu'il agit fort. p: [intensité px, mode (0 force locale + direction, 1 progression depuis le
/// centre comme les flous radial / zoom, 2 force locale + direction radiale), angle °,
/// centre x %, centre y %, zone nette %, canaux, sens inversé]
pub fn chromatic_post(orig: &[u8], fx: &[u8], w: usize, h: usize, p: &[f32]) -> Vec<u8> {
    let p = P(p);
    let n = w * h * 4;
    if orig.len() < n || fx.len() < n || w == 0 || h == 0 {
        return fx.to_vec();
    }
    let mode = p.i(1, 0);
    let shape = match mode {
        1 | 2 => 3,
        _ => 2,
    };
    let a = Aberr::new(w, h, p.f(0, 8.0), shape, p.f(2, 0.0), p.f(3, 0.0), p.f(4, 0.0), p.f(5, 0.0), p.i(6, 0), p.b(7, false), 1, 0.0);
    let strength = (mode != 1).then(|| effect_strength(&orig[..n], &fx[..n], w, h, (a.amt.round() as usize).clamp(2, 64)));
    let img = Img { d: &fx[..n], w, h };
    let mut out = fx[..n].to_vec();
    let rows = |y0: usize, chunk: &mut [u8]| {
        for (j, line) in chunk.chunks_mut(w * 4).enumerate() {
            let y = y0 + j;
            for x in 0..w {
                let (xf, yf) = (x as f32, y as f32);
                let (ux, uy, t) = a.at(xf, yf);
                let s = match &strength {
                    Some(f) => f[y * w + x],
                    None => t,
                };
                let m = a.amt * s;
                if m < 0.01 {
                    continue;
                }
                let o = a.sample(&img, xf, yf, ux * m, uy * m);
                for c in 0..4 {
                    line[x * 4 + c] = c8(o[c]);
                }
            }
        }
    };
    #[cfg(not(target_arch = "wasm32"))]
    {
        let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).clamp(1, 32);
        let band = h.div_ceil(threads).max(1);
        std::thread::scope(|sc| {
            for (k, chunk) in out.chunks_mut(band * w * 4).enumerate() {
                let rows = &rows;
                sc.spawn(move || rows(k * band, chunk));
            }
        });
    }
    #[cfg(target_arch = "wasm32")]
    rows(0, &mut out);
    out
}

/// Cristallisation (diagramme de Voronoï sur grille perturbée) : p: [taille de cellule, graine]
pub fn crystallize(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let cell = p.f(0, 12.0).max(2.0);
    let seed = p.f(1, 0.0) as u32;
    let site = |gx: i32, gy: i32| -> (f32, f32) {
        let jx = rand01(gx, gy, seed);
        let jy = rand01(gx, gy, seed ^ 0x5bd1_e995);
        ((gx as f32 + jx) * cell, (gy as f32 + jy) * cell)
    };
    for y in y0..y1 {
        for x in 0..src.w {
            let (xf, yf) = (x as f32 + 0.5, y as f32 + 0.5);
            let gx = (xf / cell).floor() as i32;
            let gy = (yf / cell).floor() as i32;
            let mut best = (0.0, 0.0);
            let mut bd = f32::MAX;
            for oy in -1..=1 {
                for ox in -1..=1 {
                    let s = site(gx + ox, gy + oy);
                    let d = (s.0 - xf) * (s.0 - xf) + (s.1 - yf) * (s.1 - yf);
                    if d < bd {
                        bd = d;
                        best = s;
                    }
                }
            }
            let q = src.pxc(best.0 as isize, best.1 as isize);
            let i = src.idx(x, y);
            dst[i..i + 4].copy_from_slice(&q);
        }
    }
}

/// Pixéliser (moyenne de chaque cellule, alpha pondéré) : p: [taille]
pub fn pixelate(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let size = p.f(0, 10.0).max(1.0) as usize;
    let w = src.w;
    let cy0 = y0 / size;
    let cy1 = (y1 + size - 1) / size;
    for cy in cy0..cy1 {
        let ya = cy * size;
        let yb = ((cy + 1) * size).min(src.h);
        let mut cx = 0;
        while cx < w {
            let xb = (cx + size).min(w);
            let mut s = [0.0f64; 4];
            let mut n = 0.0f64;
            for yy in ya..yb {
                for xx in cx..xb {
                    let q = src.px(xx, yy);
                    let a = q[3] as f64;
                    s[0] += q[0] as f64 * a;
                    s[1] += q[1] as f64 * a;
                    s[2] += q[2] as f64 * a;
                    s[3] += a;
                    n += 1.0;
                }
            }
            let col = if s[3] > 0.0 { [s[0] / s[3], s[1] / s[3], s[2] / s[3], s[3] / n] } else { [0.0; 4] };
            for yy in ya.max(y0)..yb.min(y1) {
                for xx in cx..xb {
                    put(dst, src.idx(xx, yy), col[0] as f32, col[1] as f32, col[2] as f32, col[3] as f32);
                }
            }
            cx = xb;
        }
    }
}

/// Verre dépoli : p: [diffusion px, échantillons, graine]
pub fn frosted(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let spread = p.f(0, 6.0).max(0.0);
    let samples = p.f(1, 1.0).clamp(1.0, 16.0) as u32;
    let seed = p.f(2, 1.0) as u32;
    for y in y0..y1 {
        for x in 0..src.w {
            let mut acc = [0.0f32; 4];
            for k in 0..samples {
                let s2 = seed.wrapping_add(k.wrapping_mul(0x9E37_79B9));
                let dx = (rand01(x as i32, y as i32, s2) - 0.5) * 2.0 * spread;
                let dy = (rand01(x as i32, y as i32, s2 ^ 0x68E3_1DA4) - 0.5) * 2.0 * spread;
                let o = src.bilinear(x as f32 + dx, y as f32 + dy);
                for c in 0..4 {
                    acc[c] += o[c];
                }
            }
            let n = samples as f32;
            put(dst, src.idx(x, y), acc[0] / n, acc[1] / n, acc[2] / n, acc[3] / n);
        }
    }
}

/// Bosselage Paint.NET (Dents, bruit de Perlin) : p: [échelle, réfraction, rugosité, tension, graine]
pub fn dents(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let scale = p.f(0, 25.0).max(1.0);
    let refraction = p.f(1, 50.0);
    let rough_ui = p.f(2, 10.0);
    let tension = p.f(3, 10.0);
    let seed = p.f(4, 0.0) as i32 & 255;
    let (w, h) = (src.w as f32, src.h as f32);
    let def_r = (w * w + h * h).sqrt() / 2.0;
    let scale_r = (400.0 / def_r) / scale;
    let refr = (refraction / 100.0) / scale_r;
    let theta = core::f32::consts::TAU * tension / 10.0;
    let roughness = rough_ui / 100.0;
    let mut detail = 1.0 + rough_ui / 10.0;
    let max_detail = (scale_r.fln() / 0.5f32.fln()).floor();
    if detail > max_detail && max_detail >= 1.0 {
        detail = max_detail;
    }
    let (cx, cy) = (w / 2.0, h / 2.0);
    geometric(src, dst, y0, y1, |x, y| {
        let (rx, ry) = (x - cx, y - cy);
        let ba = theta * perlin_noise(rx * scale_r, ry * scale_r, detail, roughness, seed);
        (cx + rx + refr * (-ba).fsin(), cy + ry + refr * ba.fcos())
    });
}

/// Cabossage MasterPaint (carte de hauteur + réfraction) :
/// p: [échelle, réfraction, rugosité, tension, qualité, graine]
pub fn cabossage(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let (w, h) = (src.w, src.h);
    let scale = p.f(0, 25.0).clamp(1.0, 100.0);
    let refr = p.f(1, 50.0);
    let rough = clampf(p.f(2, 10.0), 0.0, 100.0) / 100.0;
    let tension = clampf(p.f(3, 10.0), 0.0, 100.0);
    let q = p.f(4, 2.0).fround().clamp(1.0, 4.0) as usize;
    let seed = p.f(5, 2_654_435_769.0) as u32;
    let min_d = w.min(h) as f32;
    let cell = (min_d * (0.08 + (100.0 - scale) / 100.0 * 0.35)).floor().max(2.0);
    let cell_fine = (cell * 0.22).max(1.5);
    let hash = |ix: i32, iy: i32, s: u32| -> f32 {
        let n = (ix.wrapping_mul(374_761_393)).wrapping_add(iy.wrapping_mul(668_265_263)).wrapping_add((s as i32).wrapping_mul(1_442_695_041)) as u32;
        let n = n ^ (n >> 13);
        n as f32 / 4_294_967_296.0 * 2.0 - 1.0
    };
    let smooth = |x: f32, y: f32, c: f32, s: u32| -> f32 {
        let c = c.max(1.5);
        let x0 = (x / c).floor();
        let y0_ = (y / c).floor();
        let fx = x / c - x0;
        let fy = y / c - y0_;
        let u = fx * fx * (3.0 - 2.0 * fx);
        let v = fy * fy * (3.0 - 2.0 * fy);
        let (xi, yi) = (x0 as i32, y0_ as i32);
        let a = hash(xi, yi, s);
        let b = hash(xi + 1, yi, s);
        let cc = hash(xi, yi + 1, s);
        let d = hash(xi + 1, yi + 1, s);
        a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v
    };
    let mut hf = vec![0.0f32; w * h];
    let (mut mn, mut mx) = (f32::MAX, f32::MIN);
    for y in 0..h {
        for x in 0..w {
            let v = smooth(x as f32, y as f32, cell, seed) + rough * smooth(x as f32 + 17.3, y as f32 + 91.1, cell_fine, seed.wrapping_add(1_103_515_245));
            hf[y * w + x] = v;
            mn = mn.min(v);
            mx = mx.max(v);
        }
    }
    if mx > mn {
        for v in hf.iter_mut() {
            *v = (*v - mn) / (mx - mn);
        }
    }
    let passes = (tension / 4.0).fround() as usize + (q - 1);
    let mut tmp = vec![0.0f32; w * h];
    for _ in 0..passes {
        for y in 0..h {
            for x in 0..w {
                let l = hf[y * w + x.saturating_sub(1)];
                let r = hf[y * w + (x + 1).min(w - 1)];
                tmp[y * w + x] = (l + hf[y * w + x] + r) / 3.0;
            }
        }
        for y in 0..h {
            for x in 0..w {
                let u = tmp[y.saturating_sub(1) * w + x];
                let d = tmp[(y + 1).min(h - 1) * w + x];
                hf[y * w + x] = (u + tmp[y * w + x] + d) / 3.0;
            }
        }
    }
    let strength = refr / 100.0 * min_d * 0.1;
    for y in y0..y1 {
        for x in 0..w {
            let i = y * w + x;
            let hx = if x > 0 && x < w - 1 { (hf[i + 1] - hf[i - 1]) * 0.5 } else if x > 0 { hf[i] - hf[i - 1] } else if x + 1 < w { hf[i + 1] - hf[i] } else { 0.0 };
            let hy = if y > 0 && y < h - 1 { (hf[i + w] - hf[i - w]) * 0.5 } else if y > 0 { hf[i] - hf[i - w] } else if y + 1 < h { hf[i + w] - hf[i] } else { 0.0 };
            let o = src.bilinear(x as f32 + hx * strength, y as f32 + hy * strength);
            put(dst, i * 4, o[0], o[1], o[2], o[3]);
        }
    }
}

/// Projection 3D : p: [rotX°, rotY°, focale, zoom %, tl, tr, br, bl]
pub fn projection3d(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let (w, h) = (src.w as f64, src.h as f64);
    let rx = (p.f(0, 0.0) as f64).to_radians();
    let ry = (p.f(1, 0.0) as f64).to_radians();
    let f = (p.f(2, 400.0) as f64).clamp(80.0, 800.0).max(40.0);
    let zoom = p.f(3, 100.0) as f64 / 100.0;
    let pulls = [p.f(4, 0.0) as f64, p.f(5, 0.0) as f64, p.f(6, 0.0) as f64, p.f(7, 0.0) as f64];
    let (cx, cy) = (w / 2.0, h / 2.0);
    let d = f * 0.55;
    let proj = |sx: f64, sy: f64| -> [f64; 2] {
        let (mut x, mut y, mut z) = (sx - cx, sy - cy, d);
        let x1 = x * ry.fcos() + z * ry.fsin();
        let z1 = -x * ry.fsin() + z * ry.fcos();
        x = x1;
        z = z1;
        let y2 = y * rx.fcos() - z * rx.fsin();
        let z2 = y * rx.fsin() + z * rx.fcos();
        y = y2;
        z = z2;
        let zz = z.max(f * 0.04);
        [f * (x / zz) * zoom + cx, f * (y / zz) * zoom + cy]
    };
    let corners = [[0.0, 0.0], [w, 0.0], [w, h], [0.0, h]];
    let mut dq = [[0.0f64; 2]; 4];
    for k in 0..4 {
        let pt = proj(corners[k][0], corners[k][1]);
        let kk = pulls[k] / 100.0 * 0.5;
        dq[k] = [pt[0] + (cx - pt[0]) * kk, pt[1] + (cy - pt[1]) * kk];
    }
    let hm = match homography(&corners, &dq).and_then(|m| invert3x3(&m)) {
        Some(m) => m,
        None => {
            copy_rows(src, dst, y0, y1);
            return;
        }
    };
    geometric_clip(src, dst, y0, y1, |x, y| {
        let (x, y) = (x as f64, y as f64);
        let q2 = hm[6] * x + hm[7] * y + hm[8];
        if q2.abs() < 1e-9 {
            return None;
        }
        let sx = (hm[0] * x + hm[1] * y + hm[2]) / q2;
        let sy = (hm[3] * x + hm[4] * y + hm[5]) / q2;
        if sx < -0.5 || sy < -0.5 || sx >= w - 0.5 || sy >= h - 0.5 {
            None
        } else {
            Some((sx as f32, sy as f32))
        }
    });
}

/// Paint.NET « Faire pivoter / Zoomer » : p: [angle°, décalage x, décalage y, zoom, mosaïque(0/1)]
pub fn rotate_zoom(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let a = p.f(0, 0.0).to_radians();
    let pan_x = p.f(1, 0.0);
    let pan_y = p.f(2, 0.0);
    let zoom = p.f(3, 1.0).max(0.01);
    let tile = p.b(4, false);
    let (w, h) = (src.w as f32, src.h as f32);
    let (cx, cy) = (w / 2.0, h / 2.0);
    let (s, c) = (a.fsin(), a.fcos());
    // décalage exprimé en fraction de la demi-taille (comme le panneau « Décalage » de Paint.NET)
    let (px, py) = (pan_x * cx, pan_y * cy);
    let inv = |x: f32, y: f32| {
        let (dx, dy) = ((x - cx - px) / zoom, (y - cy - py) / zoom);
        (dx * c + dy * s + cx, -dx * s + dy * c + cy)
    };
    if tile {
        geometric(src, dst, y0, y1, |x, y| {
            let (sx, sy) = inv(x, y);
            (sx.rem_euclid(w), sy.rem_euclid(h))
        });
    } else {
        geometric_clip(src, dst, y0, y1, |x, y| Some(inv(x, y)));
    }
}

/// Paint.NET « Redresser » : rotation + zoom pour remplir sans coins vides. p: [angle°]
pub fn straighten(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let a = p.f(0, 0.0).to_radians();
    let (w, h) = (src.w as f32, src.h as f32);
    let (s, c) = (a.fsin().abs(), a.fcos().abs());
    let zoom = ((w * c + h * s) / w).max((w * s + h * c) / h);
    let q = [p.f(0, 0.0), 0.0, 0.0, zoom, 0.0];
    rotate_zoom(src, dst, y0, y1, &P(&q));
}
