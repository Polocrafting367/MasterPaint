// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Masques du Mode Photo Pro (repris de LightCraft, `crates/pipeline/src/masks.rs`) : chaque
//! masque est un plan alpha (dégradé linéaire ou radial, pinceau, plage de luminance ou de
//! couleur, ciel, sujet, arrière-plan) et porte ses propres réglages ; l'image du masque est
//! le même pipeline Camera Raw avec ces réglages en plus, fondue sur l'image de base selon
//! l'alpha.
//!
//! Les masques voyagent à la fin des réglages du moteur (après la réduction du bruit), pour
//! passer partout où passent les réglages (aperçu, zone agrandie, export, workers du
//! navigateur) :
//!
//! ```text
//! [M, u0, v0, u1, v1, aspect]           nombre de masques, zone rendue (fractions de la photo
//!                                       entière), largeur / hauteur de la photo entière
//! puis pour chaque masque :
//! [genre, inverser, quantité 0..100, n, (indice, écart) × n, m, forme × m]
//! ```
//! Genres : 1 linéaire (x0, y0, x1, y1 : effet entier en 0, nul en 1), 2 radial (cx, cy, rx,
//! ry en grand côté, angle en degrés, contour 0..100), 3 pinceau (traits : taille, contour,
//! flux, gomme, n, points…), 4 luminance (bas, haut, transition, 0..100), 5 couleur (r, v, b
//! 0..1, tolérance 0..100), 6 ciel, 7 sujet, 8 arrière-plan. Coordonnées des points : fractions
//! de la photo entière (0..1), avant recadrage.

/// Un masque décodé.
pub struct Mask {
    kind: u32,
    invert: bool,
    amount: f32,
    adjust: Vec<(usize, f32)>,
    shape: Vec<f32>,
}

/// Zone rendue et géométrie de la photo entière.
pub struct Frame {
    u0: f32,
    v0: f32,
    u1: f32,
    v1: f32,
    aspect: f32,
}

/// Réglages sans masques, masques et zone, si `p` porte des masques après l'indice `at`.
pub fn split(p: &[f32], at: usize) -> Option<(Vec<f32>, Vec<Mask>, Frame)> {
    let m = *p.get(at)? as usize;
    if m == 0 || p.len() < at + 6 {
        return None;
    }
    let frame = Frame { u0: p[at + 1], v0: p[at + 2], u1: p[at + 3].max(p[at + 1] + 1e-6), v1: p[at + 4].max(p[at + 2] + 1e-6), aspect: p[at + 5].max(1e-3) };
    let mut i = at + 6;
    let get = |i: &mut usize| -> Option<f32> {
        let v = *p.get(*i)?;
        *i += 1;
        Some(if v.is_finite() { v } else { 0.0 })
    };
    let mut masks = Vec::with_capacity(m.min(32));
    for _ in 0..m.min(32) {
        let kind = get(&mut i)? as u32;
        let invert = get(&mut i)? > 0.5;
        let amount = get(&mut i)?.clamp(0.0, 100.0) / 100.0;
        let n = get(&mut i)? as usize;
        let mut adjust = Vec::with_capacity(n.min(64));
        for _ in 0..n.min(64) {
            let k = get(&mut i)? as usize;
            let d = get(&mut i)?;
            adjust.push((k, d));
        }
        let ns = get(&mut i)? as usize;
        let end = (i + ns).min(p.len());
        let shape = p[i..end].to_vec();
        i = end;
        masks.push(Mask { kind, invert, amount, adjust, shape });
    }
    Some((p[..at].to_vec(), masks, frame))
}

impl Mask {
    /// Réglages de l'image du masque : ceux de base plus les écarts du masque.
    pub fn local(&self, base: &[f32]) -> Vec<f32> {
        let mut v = base.to_vec();
        for &(k, d) in &self.adjust {
            if k < v.len() {
                v[k] += d;
            }
        }
        v
    }

    /// Le masque ne change rien (aucun écart ou quantité nulle).
    pub fn idle(&self) -> bool {
        self.amount <= 0.0 || self.adjust.iter().all(|a| a.1 == 0.0)
    }
}

fn smooth(e0: f32, e1: f32, x: f32) -> f32 {
    if e1 <= e0 {
        return if x >= e1 { 1.0 } else { 0.0 };
    }
    let t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn to_lin(v: f32) -> f32 {
    if v <= 0.04045 { v / 12.92 } else { ((v + 0.055) / 1.055).powf(2.4) }
}

/// Flou en boîte (3 passes ≈ gaussien) d'un plan, rayon `r` pixels.
fn blur_plane(a: &mut [f32], w: usize, h: usize, r: usize) {
    if r == 0 || w == 0 || h == 0 {
        return;
    }
    let mut tmp = vec![0f32; a.len()];
    for _ in 0..3 {
        for y in 0..h {
            let row = &a[y * w..(y + 1) * w];
            let mut s = 0f32;
            for x in 0..=r.min(w - 1) {
                s += row[x];
            }
            for x in 0..w {
                let (lo, hi) = (x.saturating_sub(r), (x + r).min(w - 1));
                tmp[y * w + x] = s / (hi - lo + 1) as f32;
                if x + r + 1 < w {
                    s += row[x + r + 1];
                }
                if x >= r {
                    s -= row[x - r];
                }
            }
        }
        for x in 0..w {
            let mut s = 0f32;
            for y in 0..=r.min(h - 1) {
                s += tmp[y * w + x];
            }
            for y in 0..h {
                let (lo, hi) = (y.saturating_sub(r), (y + r).min(h - 1));
                a[y * w + x] = s / (hi - lo + 1) as f32;
                if y + r + 1 < h {
                    s += tmp[(y + r + 1) * w + x];
                }
                if y >= r {
                    s -= tmp[(y - r) * w + x];
                }
            }
        }
    }
}

/// OkLab d'une couleur d'affichage sRGB 0..1.
fn oklab(c: [f32; 3]) -> [f32; 3] {
    let (r, g, b) = (to_lin(c[0]), to_lin(c[1]), to_lin(c[2]));
    let l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b).cbrt();
    let m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b).cbrt();
    let s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b).cbrt();
    [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
}

impl Frame {
    /// Fractions de la photo entière du centre du pixel (x, y) d'une image `w` × `h`.
    fn uv(&self, x: usize, y: usize, w: usize, h: usize) -> (f32, f32) {
        (self.u0 + (x as f32 + 0.5) / w as f32 * (self.u1 - self.u0), self.v0 + (y as f32 + 0.5) / h as f32 * (self.v1 - self.v0))
    }

    /// Fractions → unités du grand côté (distances égales dans les deux sens).
    fn long(&self, u: f32, v: f32) -> (f32, f32) {
        if self.aspect >= 1.0 { (u, v / self.aspect) } else { (u * self.aspect, v) }
    }

    /// Grand côté de la photo entière, en pixels de l'image rendue.
    fn long_px(&self, w: usize, h: usize) -> f32 {
        let fw = w as f32 / (self.u1 - self.u0);
        let fh = h as f32 / (self.v1 - self.v0);
        fw.max(fh)
    }
}

/// Plan alpha (0..1, `w` × `h`) du masque ; `base` : image de base (RVBA 16 bits, couleurs
/// d'affichage) pour les plages de luminance, de couleur et les sélections automatiques.
pub fn alpha(m: &Mask, f: &Frame, w: usize, h: usize, base: &[u16]) -> Vec<f32> {
    let n = w * h;
    let mut out = vec![0f32; n];
    let s = |i: usize| m.shape.get(i).copied().unwrap_or(0.0);
    let px = |i: usize| [base[i * 4] as f32 / 65535.0, base[i * 4 + 1] as f32 / 65535.0, base[i * 4 + 2] as f32 / 65535.0];
    let lum = |c: [f32; 3]| 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    match m.kind {
        // dégradé linéaire : effet entier au départ, nul à l'arrivée
        1 => {
            let (ax, ay) = f.long(s(0), s(1));
            let (bx, by) = f.long(s(2), s(3));
            let (dx, dy) = (bx - ax, by - ay);
            let len2 = (dx * dx + dy * dy).max(1e-12);
            for y in 0..h {
                for x in 0..w {
                    let (u, v) = f.uv(x, y, w, h);
                    let (px_, py_) = f.long(u, v);
                    let t = ((px_ - ax) * dx + (py_ - ay) * dy) / len2;
                    out[y * w + x] = 1.0 - smooth(0.0, 1.0, t);
                }
            }
        }
        // radial : ellipse, contour progressif
        2 => {
            let (cx, cy) = f.long(s(0), s(1));
            let (rx, ry) = (s(2).max(1e-4), s(3).max(1e-4));
            let (sn, co) = (-s(4).to_radians()).sin_cos();
            let fe = (s(5) / 100.0).clamp(0.0, 1.0);
            for y in 0..h {
                for x in 0..w {
                    let (u, v) = f.uv(x, y, w, h);
                    let (qx, qy) = f.long(u, v);
                    let (dx, dy) = (qx - cx, qy - cy);
                    let (lx, ly) = (dx * co - dy * sn, dx * sn + dy * co);
                    let r = ((lx / rx).powi(2) + (ly / ry).powi(2)).sqrt();
                    out[y * w + x] = 1.0 - smooth(1.0 - fe.max(0.01), 1.0, r);
                }
            }
        }
        // pinceau : touches le long de chaque trait, contour progressif, gomme
        3 => {
            let lp = f.long_px(w, h);
            let ns = s(0) as usize;
            let mut i = 1;
            for _ in 0..ns.min(4096) {
                let (size, feather, flow, erase, np) = (s(i), s(i + 1), s(i + 2), s(i + 3) > 0.5, s(i + 4) as usize);
                i += 5;
                let pts: Vec<(f32, f32)> = (0..np).map(|k| (s(i + 2 * k), s(i + 2 * k + 1))).collect();
                i += 2 * np;
                let r = (size * lp).max(0.75);
                let hard = r * (1.0 - (feather / 100.0).clamp(0.0, 1.0));
                let flow = (flow / 100.0).clamp(0.0, 1.0);
                // centres des touches en pixels de l'image rendue, tous les r / 4
                let to_px = |(u, v): (f32, f32)| (((u - f.u0) / (f.u1 - f.u0)) * w as f32 - 0.5, ((v - f.v0) / (f.v1 - f.v0)) * h as f32 - 0.5);
                let mut dabs: Vec<(f32, f32)> = Vec::new();
                for k in 0..pts.len() {
                    let b = to_px(pts[k]);
                    if k == 0 {
                        dabs.push(b);
                        continue;
                    }
                    let a = to_px(pts[k - 1]);
                    let d = ((b.0 - a.0).powi(2) + (b.1 - a.1).powi(2)).sqrt();
                    let steps = (d / (r / 4.0).max(0.5)).ceil().min(100_000.0) as usize;
                    for t in 1..=steps {
                        let q = t as f32 / steps as f32;
                        dabs.push((a.0 + (b.0 - a.0) * q, a.1 + (b.1 - a.1) * q));
                    }
                }
                for (cx, cy) in dabs {
                    let (x0, x1) = (((cx - r).floor().max(0.0)) as usize, ((cx + r).ceil().max(0.0) as usize).min(w));
                    let (y0, y1) = (((cy - r).floor().max(0.0)) as usize, ((cy + r).ceil().max(0.0) as usize).min(h));
                    for y in y0..y1 {
                        for x in x0..x1 {
                            let d = ((x as f32 - cx).powi(2) + (y as f32 - cy).powi(2)).sqrt();
                            if d >= r {
                                continue;
                            }
                            let c = flow * (1.0 - smooth(hard, r, d));
                            let o = &mut out[y * w + x];
                            *o = if erase { *o * (1.0 - c) } else { (*o).max(c) };
                        }
                    }
                }
            }
        }
        // plage de luminance (0..100 de la luminance affichée)
        4 => {
            let (lo, hi, tr) = (s(0) / 100.0, s(1) / 100.0, (s(2) / 100.0).max(1e-3));
            for i in 0..n {
                let l = lum(px(i));
                out[i] = smooth(lo - tr, lo, l) * (1.0 - smooth(hi, hi + tr, l));
            }
        }
        // plage de couleur : distance OkLab (a, b pleins, L au quart) à l'échantillon
        5 => {
            let sample = oklab([s(0), s(1), s(2)]);
            let tol = 0.015 + 0.06 * (s(3) / 100.0).clamp(0.0, 1.0);
            for i in 0..n {
                let c = oklab(px(i));
                let d = ((c[1] - sample[1]).powi(2) + (c[2] - sample[2]).powi(2) + 0.25 * (c[0] - sample[0]).powi(2)).sqrt();
                out[i] = 1.0 - smooth(tol * 0.5, tol, d);
            }
        }
        // ciel : clair, bleuté ou peu saturé, vers le haut de l'image (heuristique de LightCraft)
        6 => {
            for y in 0..h {
                for x in 0..w {
                    let i = y * w + x;
                    let c = px(i);
                    let l = to_lin(lum(c)).max(1e-5).log2();
                    let blue = (c[2] - c[0]).max(0.0) / (c[2] + 1e-4);
                    let (_, v) = f.uv(x, y, w, h);
                    let top = 1.0 - smooth(0.25, 0.7, v);
                    out[i] = top * smooth(-3.5, -1.0, l) * (0.4 + 0.6 * smooth(0.0, 0.3, blue).max(smooth(0.0, 1.5, l)));
                }
            }
            blur_plane(&mut out, w, h, (0.01 * f.long_px(w, h)) as usize);
        }
        // sujet (et arrière-plan, son inverse) : contraste local pondéré vers le centre
        7 | 8 => {
            let mut ll: Vec<f32> = (0..n).map(|i| to_lin(lum(px(i))).max(1e-5).log2()).collect();
            let raw = ll.clone();
            blur_plane(&mut ll, w, h, (0.03 * f.long_px(w, h)) as usize);
            for y in 0..h {
                for x in 0..w {
                    let i = y * w + x;
                    let (u, v) = f.uv(x, y, w, h);
                    let d = (((u - 0.5) / 0.35).powi(2) + ((v - 0.55) / 0.4).powi(2)).sqrt();
                    let contrast = (raw[i] - ll[i]).abs();
                    out[i] = (1.0 - smooth(0.6, 1.0, d)) * (0.5 + 0.5 * smooth(0.05, 0.6, contrast));
                }
            }
            blur_plane(&mut out, w, h, (0.015 * f.long_px(w, h)) as usize);
            if m.kind == 8 {
                out.iter_mut().for_each(|v| *v = 1.0 - *v);
            }
        }
        _ => {}
    }
    for v in out.iter_mut() {
        let a = if m.invert { 1.0 - *v } else { *v };
        *v = (a * m.amount).clamp(0.0, 1.0);
    }
    out
}
