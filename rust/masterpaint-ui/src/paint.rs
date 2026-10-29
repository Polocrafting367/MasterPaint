//! Rastérisation : tampons de pinceau, traits, formes (champs de distance anticrénelés),
//! dégradés, polygones de lasso.
//!
//! Un trait s'accumule dans un masque de couverture (`Cover`, max par pixel) puis est
//! appliqué en une fois sur l'état du calque au début du trait : l'opacité ne s'additionne
//! donc pas quand le pinceau repasse sur lui-même (comme Paint.NET).

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BrushShape {
    Round,
    Soft,
    Spray,
    Square,
}

/// Masque de couverture 0..255 de la taille du document, avec son rectangle modifié.
pub struct Cover {
    pub w: usize,
    pub h: usize,
    pub m: Vec<u8>,
    pub dirty: Option<(usize, usize, usize, usize)>,
    /// zone modifiée depuis le dernier `take_recent` (un mouvement de pinceau)
    recent: Option<(usize, usize, usize, usize)>,
}

impl Cover {
    pub fn new(w: usize, h: usize) -> Self {
        Cover { w, h, m: vec![0; w * h], dirty: None, recent: None }
    }

    #[inline]
    fn put(&mut self, x: isize, y: isize, v: u8) {
        if x < 0 || y < 0 || x as usize >= self.w || y as usize >= self.h || v == 0 {
            return;
        }
        let i = y as usize * self.w + x as usize;
        if v > self.m[i] {
            self.m[i] = v;
        }
    }

    fn touch(&mut self, x0: isize, y0: isize, x1: isize, y1: isize) {
        let c = |v: isize, hi: usize| v.clamp(0, hi as isize) as usize;
        let (a, b, c2, d) = (c(x0, self.w), c(y0, self.h), c(x1, self.w), c(y1, self.h));
        let grow = |cur: Option<(usize, usize, usize, usize)>| {
            Some(match cur {
                None => (a, b, c2, d),
                Some((p, q, r, s)) => (p.min(a), q.min(b), r.max(c2), s.max(d)),
            })
        };
        self.dirty = grow(self.dirty);
        self.recent = grow(self.recent);
    }

    /// Zone modifiée depuis l'appel précédent (le trait entier reste dans `dirty`).
    pub fn take_recent(&mut self) -> Option<(usize, usize, usize, usize)> {
        self.recent.take()
    }

    /// Couverture d'un pixel (texte) : garde le maximum.
    pub fn put_pub(&mut self, x: isize, y: isize, v: u8) {
        self.put(x, y, v);
    }

    /// Étend le rectangle modifié.
    pub fn touch_pub(&mut self, x0: isize, y0: isize, x1: isize, y1: isize) {
        self.touch(x0, y0, x1, y1);
    }

    /// Tampon de pinceau centré en (cx, cy), rayon r.
    pub fn stamp(&mut self, cx: f32, cy: f32, r: f32, hardness: f32, shape: BrushShape, seed: u32) {
        let r = r.max(0.5);
        let (x0, y0, x1, y1) = ((cx - r - 1.0).floor() as isize, (cy - r - 1.0).floor() as isize, (cx + r + 1.0).ceil() as isize, (cy + r + 1.0).ceil() as isize);
        self.touch(x0, y0, x1 + 1, y1 + 1);
        match shape {
            BrushShape::Square => {
                for y in y0..=y1 {
                    for x in x0..=x1 {
                        let (dx, dy) = ((x as f32 + 0.5 - cx).abs(), (y as f32 + 0.5 - cy).abs());
                        let d = dx.max(dy);
                        let a = (r - d + 0.5).clamp(0.0, 1.0);
                        self.put(x, y, (a * 255.0) as u8);
                    }
                }
            }
            BrushShape::Spray => {
                // nuage de points pseudo-aléatoires dans le disque
                let mut s = seed.wrapping_mul(2654435761).wrapping_add(1);
                let n = (r * r * 0.35) as usize + 2;
                for _ in 0..n {
                    s ^= s << 13;
                    s ^= s >> 17;
                    s ^= s << 5;
                    let a = (s & 0xffff) as f32 / 65535.0 * std::f32::consts::TAU;
                    let d = ((s >> 16) as f32 / 65535.0).sqrt() * r;
                    self.put((cx + a.cos() * d) as isize, (cy + a.sin() * d) as isize, 255);
                }
            }
            BrushShape::Round | BrushShape::Soft => {
                let hard = if shape == BrushShape::Soft { 0.0 } else { hardness.clamp(0.0, 1.0) };
                let inner = r * hard;
                for y in y0..=y1 {
                    for x in x0..=x1 {
                        let (dx, dy) = (x as f32 + 0.5 - cx, y as f32 + 0.5 - cy);
                        let d = (dx * dx + dy * dy).sqrt();
                        let a = if d <= inner {
                            (r - d + 0.5).clamp(0.0, 1.0)
                        } else if r - inner > 0.5 {
                            let t = ((d - inner) / (r - inner)).clamp(0.0, 1.0);
                            (1.0 - t * t * (3.0 - 2.0 * t)) * (r - d + 0.5).clamp(0.0, 1.0)
                        } else {
                            (r - d + 0.5).clamp(0.0, 1.0)
                        };
                        self.put(x, y, (a * 255.0) as u8);
                    }
                }
            }
        }
    }

    /// Segment de pinceau : tampons espacés le long de [a, b].
    pub fn segment(&mut self, a: (f32, f32), b: (f32, f32), r: f32, hardness: f32, shape: BrushShape, seed: &mut u32) {
        let (dx, dy) = (b.0 - a.0, b.1 - a.1);
        let len = (dx * dx + dy * dy).sqrt();
        let step = (r * 0.25).max(0.5);
        let n = (len / step).ceil().max(1.0) as usize;
        for k in 1..=n {
            let t = k as f32 / n as f32;
            *seed = seed.wrapping_add(1);
            self.stamp(a.0 + dx * t, a.1 + dy * t, r, hardness, shape, *seed);
        }
    }

    /// Ligne aliasée de 1 px (crayon), algorithme de Bresenham.
    pub fn pencil(&mut self, a: (isize, isize), b: (isize, isize)) {
        let (mut x, mut y) = a;
        let (dx, dy) = ((b.0 - a.0).abs(), -(b.1 - a.1).abs());
        let (sx, sy) = (if a.0 < b.0 { 1 } else { -1 }, if a.1 < b.1 { 1 } else { -1 });
        let mut err = dx + dy;
        self.touch(a.0.min(b.0), a.1.min(b.1), a.0.max(b.0) + 1, a.1.max(b.1) + 1);
        loop {
            self.put(x, y, 255);
            if x == b.0 && y == b.1 {
                break;
            }
            let e2 = 2 * err;
            if e2 >= dy {
                err += dy;
                x += sx;
            }
            if e2 <= dx {
                err += dx;
                y += sy;
            }
        }
    }

    /// Remplit la couverture avec une forme décrite par sa distance signée (négatif = dedans).
    pub fn shape<F: Fn(f32, f32) -> f32>(&mut self, bbox: (f32, f32, f32, f32), style: ShapeStyle, width: f32, sdf: F) {
        let pad = width + 2.0;
        let (x0, y0, x1, y1) = ((bbox.0 - pad).floor() as isize, (bbox.1 - pad).floor() as isize, (bbox.2 + pad).ceil() as isize, (bbox.3 + pad).ceil() as isize);
        self.touch(x0, y0, x1 + 1, y1 + 1);
        let hw = width / 2.0;
        for y in y0.max(0)..=y1.min(self.h as isize - 1) {
            for x in x0.max(0)..=x1.min(self.w as isize - 1) {
                let d = sdf(x as f32 + 0.5, y as f32 + 0.5);
                let fill = (0.5 - d).clamp(0.0, 1.0);
                let line = (hw + 0.5 - d.abs()).clamp(0.0, 1.0);
                let a = match style {
                    ShapeStyle::Outline => line,
                    ShapeStyle::Fill => fill,
                    ShapeStyle::Both => fill.max(line),
                };
                self.put(x, y, (a * 255.0) as u8);
            }
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ShapeStyle {
    Outline,
    Fill,
    Both,
}

// ---------------------------------------------------------------- distances signées

pub fn sdf_rect(x0: f32, y0: f32, x1: f32, y1: f32, radius: f32) -> impl Fn(f32, f32) -> f32 {
    let (cx, cy) = ((x0 + x1) / 2.0, (y0 + y1) / 2.0);
    let (hx, hy) = ((x1 - x0).abs() / 2.0, (y1 - y0).abs() / 2.0);
    let r = radius.min(hx).min(hy).max(0.0);
    move |px, py| {
        let (qx, qy) = ((px - cx).abs() - hx + r, (py - cy).abs() - hy + r);
        let outside = (qx.max(0.0).powi(2) + qy.max(0.0).powi(2)).sqrt();
        outside + qx.max(qy).min(0.0) - r
    }
}

pub fn sdf_ellipse(x0: f32, y0: f32, x1: f32, y1: f32) -> impl Fn(f32, f32) -> f32 {
    let (cx, cy) = ((x0 + x1) / 2.0, (y0 + y1) / 2.0);
    let (rx, ry) = (((x1 - x0) / 2.0).abs().max(0.5), ((y1 - y0) / 2.0).abs().max(0.5));
    move |px, py| {
        let (nx, ny) = ((px - cx) / rx, (py - cy) / ry);
        let k = (nx * nx + ny * ny).sqrt();
        // approximation au premier ordre : distance ≈ (k - 1) / |∇k|
        let gx = nx / rx;
        let gy = ny / ry;
        let g = (gx * gx + gy * gy).sqrt().max(1e-6) * k.max(1e-6);
        (k * k - 1.0) / (2.0 * g)
    }
}

/// Distance d'un point à un segment.
fn seg_dist(px: f32, py: f32, a: (f32, f32), b: (f32, f32)) -> f32 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l2 = dx * dx + dy * dy;
    let t = if l2 > 0.0 { (((px - a.0) * dx + (py - a.1) * dy) / l2).clamp(0.0, 1.0) } else { 0.0 };
    let (qx, qy) = (a.0 + dx * t - px, a.1 + dy * t - py);
    (qx * qx + qy * qy).sqrt()
}

/// Polygone fermé (règle pair-impair).
pub fn sdf_polygon(pts: Vec<(f32, f32)>) -> impl Fn(f32, f32) -> f32 {
    move |px, py| {
        let n = pts.len();
        if n < 2 {
            return 1e9;
        }
        let mut d = f32::MAX;
        let mut inside = false;
        let mut j = n - 1;
        for i in 0..n {
            let (a, b) = (pts[i], pts[j]);
            d = d.min(seg_dist(px, py, a, b));
            if (a.1 > py) != (b.1 > py) && px < (b.0 - a.0) * (py - a.1) / (b.1 - a.1) + a.0 {
                inside = !inside;
            }
            j = i;
        }
        if inside { -d } else { d }
    }
}

/// Segment épais (ligne) : distance au segment moins la demi-épaisseur.
pub fn sdf_line(a: (f32, f32), b: (f32, f32), width: f32) -> impl Fn(f32, f32) -> f32 {
    move |px, py| seg_dist(px, py, a, b) - width / 2.0
}

/// Sommets des formes de la famille « Formes multiples », inscrites dans le cadre.
pub fn shape_points(kind: &str, x0: f32, y0: f32, x1: f32, y1: f32) -> Vec<(f32, f32)> {
    let (l, t, r, b) = (x0.min(x1), y0.min(y1), x0.max(x1), y0.max(y1));
    let (cx, cy, w, h) = ((l + r) / 2.0, (t + b) / 2.0, r - l, b - t);
    let regular = |n: usize, rot: f32| -> Vec<(f32, f32)> {
        (0..n)
            .map(|k| {
                let a = rot + k as f32 * std::f32::consts::TAU / n as f32;
                (cx + a.cos() * w / 2.0, cy + a.sin() * h / 2.0)
            })
            .collect()
    };
    let star = |n: usize, inner: f32| -> Vec<(f32, f32)> {
        (0..2 * n)
            .map(|k| {
                let a = -std::f32::consts::FRAC_PI_2 + k as f32 * std::f32::consts::PI / n as f32;
                let f = if k % 2 == 0 { 1.0 } else { inner };
                (cx + a.cos() * w / 2.0 * f, cy + a.sin() * h / 2.0 * f)
            })
            .collect()
    };
    match kind {
        "triangle" => vec![(cx, t), (r, b), (l, b)],
        "triangle-right" => vec![(l, t), (l, b), (r, b)],
        "diamond" => vec![(cx, t), (r, cy), (cx, b), (l, cy)],
        "trapezoid" => vec![(l + w * 0.2, t), (r - w * 0.2, t), (r, b), (l, b)],
        "parallelogram" => vec![(l + w * 0.25, t), (r, t), (r - w * 0.25, b), (l, b)],
        "pentagon" => regular(5, -std::f32::consts::FRAC_PI_2),
        "hexagon" => regular(6, 0.0),
        "heptagon" => regular(7, -std::f32::consts::FRAC_PI_2),
        "octagon" => regular(8, std::f32::consts::PI / 8.0),
        // étoiles : (branches, rayon intérieur)
        "star" | "star-5" => star(5, 0.42),
        "star-4" => star(4, 0.4),
        "star-6" => star(6, 0.5),
        "star-thin" => star(5, 0.25),
        _ => vec![(l, t), (r, t), (r, b), (l, b)],
    }
}

// ---------------------------------------------------------------- application

/// Applique une couverture de peinture (`erase` = gomme) sur `base` → `out`, en tenant compte
/// de l'opacité et du masque de sélection. Seul le rectangle modifié est recalculé.
pub fn apply_cover(base: &[u8], out: &mut [u8], cov: &Cover, color: [u8; 4], opacity: f32, erase: bool, sel: Option<&[u8]>) {
    apply_cover_in(base, out, cov, cov.dirty, color, opacity, erase, sel);
}

/// Comme `apply_cover`, limité au rectangle `r` : pendant un trait, seule la zone touchée par
/// le dernier mouvement change (la couverture ne fait que croître ailleurs).
pub fn apply_cover_in(base: &[u8], out: &mut [u8], cov: &Cover, r: Option<(usize, usize, usize, usize)>, color: [u8; 4], opacity: f32, erase: bool, sel: Option<&[u8]>) {
    let Some((x0, y0, x1, y1)) = r else { return };
    let w = cov.w;
    for y in y0..y1 {
        for x in x0..x1 {
            let i = y * w + x;
            let o = i * 4;
            let c = cov.m[i];
            if c == 0 {
                out[o..o + 4].copy_from_slice(&base[o..o + 4]);
                continue;
            }
            let s = sel.map_or(255, |m| m[i]) as f32 / 255.0;
            let a = c as f32 / 255.0 * opacity * s;
            if erase {
                out[o..o + 3].copy_from_slice(&base[o..o + 3]);
                out[o + 3] = (base[o + 3] as f32 * (1.0 - a) + 0.5) as u8;
            } else {
                let sa = a * color[3] as f32 / 255.0;
                let da = base[o + 3] as f32 / 255.0;
                let ao = sa + da * (1.0 - sa);
                if ao <= 0.0 {
                    out[o..o + 4].copy_from_slice(&[0, 0, 0, 0]);
                    continue;
                }
                for k in 0..3 {
                    let v = (color[k] as f32 * sa + base[o + k] as f32 * da * (1.0 - sa)) / ao;
                    out[o + k] = (v + 0.5) as u8;
                }
                out[o + 3] = (ao * 255.0 + 0.5) as u8;
            }
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GradientKind {
    Linear,
    Radial,
    Diamond,
    Conical,
}

/// Dégradé de `c0` (en a) vers `c1` (en b), fondu dans la sélection.
pub fn gradient(base: &[u8], out: &mut [u8], w: usize, h: usize, a: (f32, f32), b: (f32, f32), c0: [u8; 4], c1: [u8; 4], kind: GradientKind, sel: Option<&[u8]>) {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l2 = (dx * dx + dy * dy).max(1e-6);
    let len = l2.sqrt();
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let o = i * 4;
            let (px, py) = (x as f32 + 0.5 - a.0, y as f32 + 0.5 - a.1);
            let t = match kind {
                GradientKind::Linear => (px * dx + py * dy) / l2,
                GradientKind::Radial => (px * px + py * py).sqrt() / len,
                GradientKind::Diamond => {
                    let (ux, uy) = (dx / len, dy / len);
                    ((px * ux + py * uy).abs() + (-px * uy + py * ux).abs()) / len
                }
                GradientKind::Conical => {
                    let ang = py.atan2(px) - dy.atan2(dx);
                    (ang / std::f32::consts::TAU).rem_euclid(1.0)
                }
            }
            .clamp(0.0, 1.0);
            let s = sel.map_or(255, |m| m[i]) as f32 / 255.0;
            for k in 0..4 {
                let g = c0[k] as f32 + (c1[k] as f32 - c0[k] as f32) * t;
                out[o + k] = (base[o + k] as f32 * (1.0 - s) + g * s + 0.5) as u8;
            }
        }
    }
}

/// Masque anticrénelé d'un polygone (lasso, sélections de forme), règle pair-impair.
/// Remplissage par balayage : 4 sous-lignes par rangée de pixels, couverture horizontale exacte
/// aux extrémités de chaque segment. Avant : distance à toutes les arêtes pour chaque pixel du
/// cadre, ce qui figeait l'interface au relâchement d'un long lasso.
pub fn polygon_mask(w: usize, h: usize, pts: &[(f32, f32)]) -> Vec<u8> {
    const SUB: usize = 4;
    let mut m = vec![0u8; w * h];
    let n = pts.len();
    if n < 3 || w == 0 || h == 0 {
        return m;
    }
    // arêtes non horizontales : (y haut, y bas, x en haut, dx/dy), triées par y haut
    let mut edges: Vec<(f32, f32, f32, f32)> = Vec::with_capacity(n);
    let (mut l, mut r) = (f32::MAX, f32::MIN);
    for i in 0..n {
        let (a, b) = (pts[i], pts[(i + 1) % n]);
        l = l.min(a.0);
        r = r.max(a.0);
        if a.1 == b.1 || !(a.0.is_finite() && a.1.is_finite() && b.0.is_finite() && b.1.is_finite()) {
            continue;
        }
        let (p, q) = if a.1 < b.1 { (a, b) } else { (b, a) };
        edges.push((p.1, q.1, p.0, (q.0 - p.0) / (q.1 - p.1)));
    }
    if edges.is_empty() {
        return m;
    }
    edges.sort_by(|a, b| a.0.total_cmp(&b.0));
    let top = edges[0].0;
    let bottom = edges.iter().map(|e| e.1).fold(f32::MIN, f32::max);
    let (ry0, ry1) = (top.floor().max(0.0) as usize, (bottom.ceil().max(0.0) as usize).min(h));
    let (bx0, bx1) = (l.floor().max(0.0) as usize, ((r.ceil().max(0.0) as usize) + 1).min(w));
    if bx1 <= bx0 {
        return m;
    }
    let wgt = 1.0 / SUB as f32;
    // part : couverture partielle des pixels d'extrémité ; run : pixels entiers (différences)
    let mut part = vec![0f32; w + 1];
    let mut run = vec![0f32; w + 1];
    let mut active: Vec<usize> = Vec::new();
    let mut xs: Vec<f32> = Vec::new();
    let mut next = 0;
    for y in ry0..ry1 {
        part[bx0..=bx1].fill(0.0);
        run[bx0..=bx1].fill(0.0);
        for s in 0..SUB {
            let sy = y as f32 + (s as f32 + 0.5) * wgt;
            while next < edges.len() && edges[next].0 <= sy {
                active.push(next);
                next += 1;
            }
            active.retain(|&e| edges[e].1 > sy);
            xs.clear();
            xs.extend(active.iter().map(|&e| edges[e].2 + (sy - edges[e].0) * edges[e].3));
            xs.sort_by(f32::total_cmp);
            for pair in xs.chunks_exact(2) {
                let (xa, xb) = (pair[0].max(0.0), pair[1].min(w as f32));
                if xb <= xa {
                    continue;
                }
                let (ia, ib) = (xa.floor() as usize, xb.floor() as usize);
                if ia == ib {
                    part[ia] += (xb - xa) * wgt;
                    continue;
                }
                part[ia] += (ia as f32 + 1.0 - xa) * wgt;
                run[ia + 1] += wgt;
                run[ib] -= wgt;
                if ib < w {
                    part[ib] += (xb - ib as f32) * wgt;
                }
            }
        }
        let row = &mut m[y * w..(y + 1) * w];
        let mut acc = 0f32;
        for x in bx0..bx1 {
            acc += run[x];
            let c = (acc + part[x]).clamp(0.0, 1.0);
            row[x] = (c * 255.0 + 0.5) as u8;
        }
    }
    m
}
