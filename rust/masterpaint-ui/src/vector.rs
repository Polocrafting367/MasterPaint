// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Calques vectoriels (début du mode SVG) : le calque garde la description de ses objets
//! (textes et formes ; les chemins viendront dans `Obj`) et ses pixels n'en sont que le rendu. Les effets du menu posés sur un tel calque ne le modifient pas : ils forment une
//! pile rejouée sur le rendu des objets, comme les filtres dynamiques ƒ (mode « ce calque »).

use crate::paint::{self, ShapeStyle};
use crate::text::{self, Align, Fonts};

/// Texte modifiable : coin haut-gauche (x, y) en pixels du document.
#[derive(Clone, Debug, PartialEq)]
pub struct TextObj {
    pub text: String,
    /// nom de la police (stable d'une version à l'autre ; l'indice est retrouvé au rendu)
    pub font: String,
    pub size: f32,
    pub color: [u8; 4],
    /// 0 gauche, 1 centre, 2 droite
    pub align: i32,
    pub antialias: bool,
    pub x: f32,
    pub y: f32,
    /// transformation appliquée au texte posé (rotation, retournement, échelle non uniforme de
    /// l'image) : [a, b, c, d, e, f], comme le `matrix()` de SVG
    pub m: Option<[f32; 6]>,
}

impl TextObj {
    pub(crate) fn align(&self) -> Align {
        match self.align {
            1 => Align::Center,
            2 => Align::Right,
            _ => Align::Left,
        }
    }

    /// Applique une transformation du document (voir `ShapeObj::transform`).
    pub fn transform(&mut self, m: [f32; 6]) {
        let [a, b, c, d, e, f] = m;
        if self.m.is_none() && b == 0.0 && c == 0.0 && a > 0.0 && (a - d).abs() < 1e-4 {
            // échelle uniforme ou déplacement : le texte reste un texte « simple », à sa vraie taille
            self.x = self.x * a + e;
            self.y = self.y * d + f;
            self.size *= a;
            return;
        }
        let [a2, b2, c2, d2, e2, f2] = self.m.unwrap_or([1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);
        self.m = Some([a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f]);
    }
}

/// Point d'ancrage d'un chemin : position et poignées de ses deux courbes (coordonnées absolues,
/// pixels du document, sans aucune limite de résolution) ; poignée confondue avec le point :
/// segment droit de ce côté. `smooth` : les deux poignées restent alignées.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Node {
    pub p: (f32, f32),
    pub c_in: (f32, f32),
    pub c_out: (f32, f32),
    pub smooth: bool,
}

impl Node {
    pub fn corner(p: (f32, f32)) -> Node {
        Node { p, c_in: p, c_out: p, smooth: false }
    }

    fn curve(p: (f32, f32), c_in: (f32, f32), c_out: (f32, f32)) -> Node {
        Node { p, c_in, c_out, smooth: false }
    }
}

/// Contour d'un chemin : suite de points d'ancrage, ouverte ou fermée.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct SubPath {
    pub nodes: Vec<Node>,
    pub closed: bool,
}

impl SubPath {
    /// Segments du contour : (indice du premier point, p0, c1, c2, p1) ; le contour fermé revient
    /// à son premier point.
    pub fn segments(&self) -> Vec<(usize, (f32, f32), (f32, f32), (f32, f32), (f32, f32))> {
        let n = self.nodes.len();
        if n < 2 {
            return Vec::new();
        }
        let count = if self.closed { n } else { n - 1 };
        (0..count)
            .map(|i| {
                let (a, b) = (&self.nodes[i], &self.nodes[(i + 1) % n]);
                (i, a.p, a.c_out, b.c_in, b.p)
            })
            .collect()
    }

    /// Points du contour, courbes découpées (cadre, détection du clic : jamais pour l'affichage).
    pub fn flatten(&self) -> Vec<(f32, f32)> {
        let mut out = Vec::with_capacity(self.nodes.len() * 4);
        if let Some(f) = self.nodes.first() {
            out.push(f.p);
        }
        for (_, p0, c1, c2, p1) in self.segments() {
            if c1 == p0 && c2 == p1 {
                out.push(p1);
                continue;
            }
            let len = dist(p0, c1) + dist(c1, c2) + dist(c2, p1);
            let steps = ((len / 4.0).ceil() as usize).clamp(6, 64);
            for k in 1..=steps {
                out.push(cubic_at(p0, c1, c2, p1, k as f32 / steps as f32));
            }
        }
        if self.closed && out.len() > 1 && out.last() == out.first() {
            out.pop();
        }
        out
    }
}

pub(crate) fn dist(a: (f32, f32), b: (f32, f32)) -> f32 {
    ((a.0 - b.0).powi(2) + (a.1 - b.1).powi(2)).sqrt()
}

/// Point d'une courbe de Bézier cubique.
pub(crate) fn cubic_at(p0: (f32, f32), c1: (f32, f32), c2: (f32, f32), p1: (f32, f32), t: f32) -> (f32, f32) {
    let u = 1.0 - t;
    let (a, b, c, d) = (u * u * u, 3.0 * u * u * t, 3.0 * u * t * t, t * t * t);
    (a * p0.0 + b * c1.0 + c * c2.0 + d * p1.0, a * p0.1 + b * c1.1 + c * c2.1 + d * p1.1)
}

/// Distance d'un point à un segment.
fn seg_dist(p: (f32, f32), a: (f32, f32), b: (f32, f32)) -> f32 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l2 = dx * dx + dy * dy;
    let t = if l2 > 1e-9 { (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / l2).clamp(0.0, 1.0) } else { 0.0 };
    dist(p, (a.0 + dx * t, a.1 + dy * t))
}

/// Contours bruts (points séparés par NaN) → contours d'un chemin.
fn rings_to_subs(pts: &[(f32, f32)], close: bool) -> Vec<SubPath> {
    pts.split(|p| p.0.is_nan())
        .filter(|r| r.len() >= 2)
        .map(|r| {
            let looped = close || (r.len() >= 3 && r.first() == r.last());
            let r = if r.len() >= 3 && r.first() == r.last() { &r[..r.len() - 1] } else { r };
            SubPath { nodes: r.iter().map(|&p| Node::corner(p)).collect(), closed: looped }
        })
        .collect()
}

/// Forme modifiable (outils Formes, Rectangle arrondi, Ligne) : deux coins du tracé (a, b) en
/// pixels du document. `kind` : rect, roundrect, ellipse, line ou une forme de la famille
/// « Formes multiples » (`paint::shape_points`).
#[derive(Clone, Debug, PartialEq)]
pub struct ShapeObj {
    pub kind: String,
    pub a: (f32, f32),
    pub b: (f32, f32),
    pub style: ShapeStyle,
    pub width: f32,
    /// couleur, opacité de l'outil comprise
    pub color: [u8; 4],
    /// sommets d'un polygone (`kind` « polygon ») ou d'une polyligne (« polyline ») libres, en
    /// pixels du document (import SVG) ; vide pour les autres formes, `a` / `b` gardent le cadre
    pub points: Vec<(f32, f32)>,
    /// rayon des coins (« roundrect », pixels du document) ; négatif : 20 % du petit côté
    /// (calques des versions précédentes, import SVG sans rx)
    pub radius: f32,
    /// couleur de remplissage distincte du trait (pot de peinture cliqué dans la forme) ; None :
    /// remplissage de la couleur du trait (style Plein / Les deux)
    pub fill: Option<[u8; 4]>,
    /// rotation (radians, sens horaire à l'écran) autour du centre du cadre
    pub rot: f32,
    /// bouts d'une ligne / courbe : 0 droit, 1 rond, 2 flèche pleine, 3 flèche vide, 4 losange
    pub cap_start: u8,
    pub cap_end: u8,
    /// trait d'une ligne / courbe : 0 continu, 1 tirets, 2 pointillés
    pub dash: u8,
    /// dégradé du remplissage (import SVG, outil Dégradé), à la place de la couleur de remplissage
    pub grad: Option<Box<Grad>>,
    /// chemin de Bézier (`kind` « path ») : sa vraie géométrie, à toute résolution ; `points`
    /// n'en garde qu'un découpage (cadre, détection du clic). Vide : anciens chemins, en `points`
    pub subs: Vec<SubPath>,
}

/// Dégradé (pixels du document) : linéaire de `p0` à `p1`, ou radial de centre `p0` et de rayon
/// |p1 − p0| ; arrêts (position 0..1, couleur), prolongés aux bouts.
#[derive(Clone, Debug, PartialEq)]
pub struct Grad {
    pub radial: bool,
    pub p0: (f32, f32),
    pub p1: (f32, f32),
    pub stops: Vec<(f32, [u8; 4])>,
}

impl Grad {
}

/// Dégradé du remplissage d'une forme, comme la version HTML : du cadre `b` (x0, y0, x1, y1), de
/// `c0` à `c1`. Linéaire : selon `angle` (degrés), sur toute la forme ; radial : du centre vers le
/// plus grand côté. `smart` : mélange par la teinte, le saturation et la valeur (« Intelligent »,
/// 11 arrêts, le plus court chemin sur la roue des couleurs), sans gris au milieu.
pub fn shape_gradient(b: (f32, f32, f32, f32), radial: bool, angle: f32, smart: bool, c0: [u8; 4], c1: [u8; 4]) -> Grad {
    let (cx, cy) = ((b.0 + b.2) / 2.0, (b.1 + b.3) / 2.0);
    let (w, h) = (b.2 - b.0, b.3 - b.1);
    let (p0, p1) = if radial {
        ((cx, cy), (cx + (w / 2.0).max(h / 2.0).max(2.0), cy))
    } else {
        let l = (w / 2.0).max(h / 2.0).max(w.hypot(h) / 2.0).max(4.0) * 1.6;
        let (s, c) = angle.to_radians().sin_cos();
        ((cx - c * l, cy - s * l), (cx + c * l, cy + s * l))
    };
    let stops = if smart {
        let (a, z) = (rgb_to_hsv(c0), rgb_to_hsv(c1));
        let mut h1 = z.0;
        if h1 - a.0 > 180.0 {
            h1 -= 360.0;
        } else if h1 - a.0 < -180.0 {
            h1 += 360.0;
        }
        (0..=10)
            .map(|i| {
                let t = i as f32 / 10.0;
                let rgb = hsv_to_rgb((a.0 + t * (h1 - a.0)).rem_euclid(360.0), a.1 + t * (z.1 - a.1), a.2 + t * (z.2 - a.2));
                (t, [rgb[0], rgb[1], rgb[2], (c0[3] as f32 + t * (c1[3] as f32 - c0[3] as f32)).round() as u8])
            })
            .collect()
    } else {
        vec![(0.0, c0), (1.0, c1)]
    };
    Grad { radial, p0, p1, stops }
}

fn rgb_to_hsv(c: [u8; 4]) -> (f32, f32, f32) {
    let (r, g, b) = (c[0] as f32 / 255.0, c[1] as f32 / 255.0, c[2] as f32 / 255.0);
    let (mx, mn) = (r.max(g).max(b), r.min(g).min(b));
    let d = mx - mn;
    let h = if d <= 0.0 {
        0.0
    } else if mx == r {
        60.0 * ((g - b) / d).rem_euclid(6.0)
    } else if mx == g {
        60.0 * ((b - r) / d + 2.0)
    } else {
        60.0 * ((r - g) / d + 4.0)
    };
    (h, if mx > 0.0 { d / mx } else { 0.0 }, mx)
}

fn hsv_to_rgb(h: f32, s: f32, v: f32) -> [u8; 3] {
    let c = v * s;
    let x = c * (1.0 - ((h / 60.0).rem_euclid(2.0) - 1.0).abs());
    let (r, g, b) = match (h / 60.0) as i32 {
        0 => (c, x, 0.0),
        1 => (x, c, 0.0),
        2 => (0.0, c, x),
        3 => (0.0, x, c),
        4 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };
    let m = v - c;
    [r, g, b].map(|u| ((u + m) * 255.0).round() as u8)
}

/// Courbe (Catmull-Rom) qui passe par les points donnés, échantillonnée.
fn through_points(p: &[(f32, f32)]) -> Vec<(f32, f32)> {
    let n = p.len();
    if n < 3 {
        return p.to_vec();
    }
    let mut out = vec![p[0]];
    for i in 0..n - 1 {
        let (p0, p1, p2, p3) = (p[i.saturating_sub(1)], p[i], p[i + 1], p[(i + 2).min(n - 1)]);
        // échantillons selon la longueur de la portion (un tous les ~5 px, 6 à 48)
        let span = ((p2.0 - p1.0).powi(2) + (p2.1 - p1.1).powi(2)).sqrt();
        let steps = ((span / 5.0).ceil() as usize).clamp(6, 48);
        for k in 1..=steps {
            let t = k as f32 / steps as f32;
            let (t2, t3) = (t * t, t * t * t);
            let f = |a: f32, b: f32, c: f32, d: f32| 0.5 * (2.0 * b + (c - a) * t + (2.0 * a - 5.0 * b + 4.0 * c - d) * t2 + (3.0 * b - a - 3.0 * c + d) * t3);
            out.push((f(p0.0, p1.0, p2.0, p3.0), f(p0.1, p1.1, p2.1, p3.1)));
        }
    }
    out
}

/// Bout décoré d'un trait : sommets, contour seul (flèche vide), recul du trait sous le bout.
fn cap_shape(tip: (f32, f32), dir: (f32, f32), lw: f32, kind: u8) -> Option<(Vec<(f32, f32)>, bool, f32)> {
    let n = (-dir.1, dir.0);
    let at = |along: f32, side: f32| (tip.0 + dir.0 * along + n.0 * side, tip.1 + dir.1 * along + n.1 * side);
    let (len, half) = ((lw * 3.5).max(8.0), (lw * 2.2).max(5.0));
    match kind {
        2 => Some((vec![tip, at(-len, half), at(-len, -half)], false, len * 0.9)),
        3 => Some((vec![tip, at(-len, half), at(-len, -half)], true, len)),
        4 => {
            let (d, w) = ((lw * 2.4).max(6.0), (lw * 1.8).max(4.0));
            Some((vec![at(d, 0.0), at(0.0, w), at(-d, 0.0), at(0.0, -w)], false, 0.0))
        }
        _ => None,
    }
}

fn unit(v: (f32, f32)) -> (f32, f32) {
    let l = (v.0 * v.0 + v.1 * v.1).sqrt();
    if l < 1e-6 { (1.0, 0.0) } else { (v.0 / l, v.1 / l) }
}

impl ShapeObj {
    pub fn center(&self) -> (f32, f32) {
        let (x0, y0, x1, y1) = self.bbox();
        ((x0 + x1) / 2.0, (y0 + y1) / 2.0)
    }

    /// Point du cadre (repère de la forme, non tourné) amené dans le document (rotation).
    pub fn to_world(&self, p: (f32, f32)) -> (f32, f32) {
        let (cx, cy) = self.center();
        let (s, c) = self.rot.sin_cos();
        let (dx, dy) = (p.0 - cx, p.1 - cy);
        (cx + dx * c - dy * s, cy + dx * s + dy * c)
    }

    /// Point du document ramené dans le repère de la forme (rotation inverse).
    pub fn to_local(&self, p: (f32, f32)) -> (f32, f32) {
        let (cx, cy) = self.center();
        let (s, c) = (-self.rot).sin_cos();
        let (dx, dy) = (p.0 - cx, p.1 - cy);
        (cx + dx * c - dy * s, cy + dx * s + dy * c)
    }

    /// Coins du cadre dans le document (haut-gauche, haut-droit, bas-droit, bas-gauche).
    pub fn corners_world(&self) -> [(f32, f32); 4] {
        let (x0, y0, x1, y1) = self.bbox();
        [(x0, y0), (x1, y0), (x1, y1), (x0, y1)].map(|p| self.to_world(p))
    }

    /// Rectangle (aligné sur l'image) qui contient la forme tournée.
    pub fn world_bbox(&self) -> (f32, f32, f32, f32) {
        if self.rot == 0.0 {
            return self.bbox();
        }
        let q = self.corners_world();
        q.iter().fold((f32::MAX, f32::MAX, f32::MIN, f32::MIN), |b, p| (b.0.min(p.0), b.1.min(p.1), b.2.max(p.0), b.3.max(p.1)))
    }

    /// Trait seul par nature (ligne, courbe, polyligne) : pas de remplissage possible.
    pub fn is_stroke_only(&self) -> bool {
        matches!(self.kind.as_str(), "line" | "curve" | "polyline")
    }

    /// Tracé d'une ligne (deux bouts) ou d'une courbe (passe par ses points), échantillonné.
    pub fn stroke_path(&self) -> Vec<(f32, f32)> {
        match self.kind.as_str() {
            "curve" if self.points.len() >= 2 => through_points(&self.points),
            "polyline" if self.points.len() >= 2 => self.points.clone(),
            _ => vec![self.a, self.b],
        }
    }

    /// Bouts décorés (début, fin) : sommets, contour seul, recul du trait.
    pub(crate) fn caps(&self, path: &[(f32, f32)]) -> [Option<(Vec<(f32, f32)>, bool, f32)>; 2] {
        let lw = self.width.max(1.0);
        let n = path.len();
        let d0 = unit((path[0].0 - path[1].0, path[0].1 - path[1].1));
        let d1 = unit((path[n - 1].0 - path[n - 2].0, path[n - 1].1 - path[n - 2].1));
        [cap_shape(path[0], d0, lw, self.cap_start), cap_shape(path[n - 1], d1, lw, self.cap_end)]
    }

    /// Distance signée d'un trait (ligne, courbe) : bouts droits ou ronds, tirets / pointillés,
    /// flèches et losanges aux bouts.
    fn stroke_sdf(&self) -> Box<dyn Fn(f32, f32) -> f32> {
        let lw = self.width.max(1.0);
        let mut path = self.stroke_path();
        if path.len() < 2 {
            path = vec![self.a, self.b];
        }
        let caps = self.caps(&path);
        // le trait s'arrête sous une flèche (sinon il dépasse de la pointe)
        let n = path.len();
        for (end, cap) in caps.iter().enumerate() {
            if let Some((_, _, inset)) = cap {
                let (i, j) = if end == 0 { (0, 1) } else { (n - 1, n - 2) };
                let (dx, dy) = (path[j].0 - path[i].0, path[j].1 - path[i].1);
                let l = (dx * dx + dy * dy).sqrt();
                if *inset > 0.0 && l > 1e-3 {
                    let k = (inset / l).min(0.95);
                    path[i] = (path[i].0 + dx * k, path[i].1 + dy * k);
                }
            }
        }
        let mut segs = Vec::new();
        let mut cum = 0.0f32;
        for w in path.windows(2) {
            let (a, b) = (w[0], w[1]);
            let len = ((b.0 - a.0).powi(2) + (b.1 - a.1).powi(2)).sqrt();
            if len > 1e-4 {
                segs.push((a, b, len, cum));
                cum += len;
            }
        }
        let last = segs.len().saturating_sub(1);
        let (flat0, flat1) = (self.cap_start == 0, self.cap_end == 0);
        let dash = match self.dash {
            1 => Some((lw * 3.0, lw * 2.0, false)),
            2 => Some((0.0, lw * 2.0, true)),
            _ => None,
        };
        // grille de cases de 24 px : chaque pixel n'examine que les segments qui passent près de
        // lui (une courbe compte des dizaines de segments ; tous les parcourir pour chaque pixel
        // du cadre rendait le tracé et l'édition très lents)
        const CELL: f32 = 24.0;
        let reach = lw / 2.0 + 2.0;
        let (mut gx0, mut gy0, mut gx1, mut gy1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        for &(a, b, _, _) in &segs {
            (gx0, gy0) = (gx0.min(a.0.min(b.0)), gy0.min(a.1.min(b.1)));
            (gx1, gy1) = (gx1.max(a.0.max(b.0)), gy1.max(a.1.max(b.1)));
        }
        let (gx0, gy0) = (gx0 - reach, gy0 - reach);
        let cols = (((gx1 + reach - gx0) / CELL).ceil() as usize).clamp(1, 4096);
        let rows = (((gy1 + reach - gy0) / CELL).ceil() as usize).clamp(1, 4096);
        let mut grid: Vec<Vec<u32>> = vec![Vec::new(); if segs.is_empty() { 0 } else { cols * rows }];
        for (k, &(a, b, _, _)) in segs.iter().enumerate() {
            let cx0 = (((a.0.min(b.0) - reach - gx0) / CELL).floor().max(0.0) as usize).min(cols - 1);
            let cx1 = (((a.0.max(b.0) + reach - gx0) / CELL).floor().max(0.0) as usize).min(cols - 1);
            let cy0 = (((a.1.min(b.1) - reach - gy0) / CELL).floor().max(0.0) as usize).min(rows - 1);
            let cy1 = (((a.1.max(b.1) + reach - gy0) / CELL).floor().max(0.0) as usize).min(rows - 1);
            for cy in cy0..=cy1 {
                for cx in cx0..=cx1 {
                    grid[cy * cols + cx].push(k as u32);
                }
            }
        }
        let shapes: Vec<(Box<dyn Fn(f32, f32) -> f32>, bool)> = caps
            .into_iter()
            .flatten()
            .map(|(pts, hollow, _)| (Box::new(paint::sdf_polygon(pts)) as Box<dyn Fn(f32, f32) -> f32>, hollow))
            .collect();
        Box::new(move |x, y| {
            let mut d = f32::MAX;
            let (cx, cy) = (((x - gx0) / CELL).floor(), ((y - gy0) / CELL).floor());
            let near: &[u32] = if grid.is_empty() || cx < 0.0 || cy < 0.0 || cx as usize >= cols || cy as usize >= rows {
                &[]
            } else {
                &grid[cy as usize * cols + cx as usize]
            };
            if !near.is_empty() {
                // segment le plus proche : distance, abscisse le long du trait, projection
                let (mut best, mut along, mut t_raw, mut seg) = (f32::MAX, 0.0, 0.0, 0);
                for &k in near {
                    let k = k as usize;
                    let (a, b, len, c0) = segs[k];
                    let t = ((x - a.0) * (b.0 - a.0) + (y - a.1) * (b.1 - a.1)) / (len * len);
                    let tc = t.clamp(0.0, 1.0);
                    let dist = ((a.0 + (b.0 - a.0) * tc - x).powi(2) + (a.1 + (b.1 - a.1) * tc - y).powi(2)).sqrt();
                    if dist < best {
                        (best, along, t_raw, seg) = (dist, c0 + tc * len, t, k);
                    }
                }
                d = best - lw / 2.0;
                // bouts droits : coupés net à l'extrémité
                let (a, b, len, _) = segs[seg];
                let perp = ((x - a.0) * (b.1 - a.1) - (y - a.1) * (b.0 - a.0)).abs() / len;
                if seg == 0 && t_raw < 0.0 && flat0 {
                    d = (perp - lw / 2.0).max(-t_raw * len);
                }
                if seg == last && t_raw > 1.0 && flat1 {
                    d = (perp - lw / 2.0).max((t_raw - 1.0) * len);
                }
                if let Some((on, off, round)) = dash {
                    let period = on + off;
                    let u = along.rem_euclid(period);
                    if u > on {
                        let g = (u - on).min(period - u);
                        d = d.max(if round { (g * g + perp * perp).sqrt() - lw / 2.0 } else { g });
                    }
                }
            }
            for (f, hollow) in &shapes {
                let v = f(x, y);
                d = d.min(if *hollow { v.abs() - lw / 2.0 } else { v });
            }
            d
        })
    }

    /// Distance signée au contour (négative dedans) ; traits : distance au tracé moins la
    /// demi-épaisseur.
    pub fn sdf(&self) -> Box<dyn Fn(f32, f32) -> f32> {
        let base = self.sdf_local();
        if self.rot == 0.0 {
            return base;
        }
        let (cx, cy) = self.center();
        let (s, c) = (-self.rot).sin_cos();
        Box::new(move |x, y| {
            let (dx, dy) = (x - cx, y - cy);
            base(cx + dx * c - dy * s, cy + dx * s + dy * c)
        })
    }

    /// Distance signée dans le repère de la forme (sans rotation).
    fn sdf_local(&self) -> Box<dyn Fn(f32, f32) -> f32> {
        let (a, b) = (self.a, self.b);
        let lw = self.width.max(1.0);
        match self.kind.as_str() {
            "polyline" if self.points.len() >= 2 => {
                let segs: Vec<_> = self.points.windows(2).map(|p| paint::sdf_line(p[0], p[1], lw)).collect();
                Box::new(move |x, y| segs.iter().map(|f| f(x, y)).fold(f32::MAX, f32::min))
            }
            "polygon" | "polyline" if !self.points.is_empty() => Box::new(paint::sdf_polygon(self.points.clone())),
            "line" | "curve" => self.stroke_sdf(),
            // chemin SVG : contours séparés par (NaN, NaN), trous pair-impair
            "path" => Box::new(paint::sdf_rings(self.points.clone())),
            "roundrect" => Box::new(paint::sdf_rect(a.0, a.1, b.0, b.1, self.corner())),
            "rect" => Box::new(paint::sdf_rect(a.0, a.1, b.0, b.1, 0.0)),
            "ellipse" => Box::new(paint::sdf_ellipse(a.0, a.1, b.0, b.1)),
            k => Box::new(paint::sdf_polygon(paint::shape_points(k, a.0, a.1, b.0, b.1))),
        }
    }

    /// Rayon des coins effectif d'un rectangle arrondi.
    pub fn corner(&self) -> f32 {
        let (x0, y0, x1, y1) = self.bbox();
        if self.radius >= 0.0 { self.radius } else { (x1 - x0).min(y1 - y0) * 0.2 }.min((x1 - x0).min(y1 - y0) / 2.0).max(0.0)
    }

    pub fn bbox(&self) -> (f32, f32, f32, f32) {
        if !self.points.is_empty() {
            let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
            for &(x, y) in &self.points {
                (x0, y0, x1, y1) = (x0.min(x), y0.min(y), x1.max(x), y1.max(y));
            }
            return (x0, y0, x1, y1);
        }
        (self.a.0.min(self.b.0), self.a.1.min(self.b.1), self.a.0.max(self.b.0), self.a.1.max(self.b.1))
    }

    /// Contours exacts de la forme (repère de la forme, sans sa rotation), quelle que soit sa
    /// nature : c'est ce que trace le moteur vectoriel et ce que modifie l'outil Sélection directe.
    pub fn to_subs(&self) -> Vec<SubPath> {
        let (x0, y0, x1, y1) = self.bbox();
        match self.kind.as_str() {
            "path" if !self.subs.is_empty() => self.subs.clone(),
            "path" => rings_to_subs(&self.points, true),
            "polyline" if self.points.len() >= 2 => rings_to_subs(&self.points, false),
            "polygon" if !self.points.is_empty() => rings_to_subs(&self.points, true),
            "curve" if self.points.len() >= 2 => {
                // Catmull-Rom exacte en Bézier : tangente (p[i+1] − p[i−1]) / 2, poignées au tiers
                let p = &self.points;
                let n = p.len();
                let nodes = (0..n)
                    .map(|i| {
                        let (a, b) = (p[i.saturating_sub(1)], p[(i + 1).min(n - 1)]);
                        let t = ((b.0 - a.0) / 6.0, (b.1 - a.1) / 6.0);
                        Node { p: p[i], c_in: (p[i].0 - t.0, p[i].1 - t.1), c_out: (p[i].0 + t.0, p[i].1 + t.1), smooth: i > 0 && i + 1 < n }
                    })
                    .collect();
                vec![SubPath { nodes, closed: false }]
            }
            "line" | "curve" | "polyline" => vec![SubPath { nodes: vec![Node::corner(self.a), Node::corner(self.b)], closed: false }],
            "rect" => vec![SubPath { nodes: [(x0, y0), (x1, y0), (x1, y1), (x0, y1)].map(Node::corner).to_vec(), closed: true }],
            "roundrect" if self.corner() > 0.0 => {
                let r = self.corner();
                let k = r * 0.447_715; // 1 − 0,5523 : poignée d'un quart de cercle
                vec![SubPath {
                    nodes: vec![
                        Node::curve((x0 + r, y0), (x0 + k, y0), (x0 + r, y0)),
                        Node::curve((x1 - r, y0), (x1 - r, y0), (x1 - k, y0)),
                        Node::curve((x1, y0 + r), (x1, y0 + k), (x1, y0 + r)),
                        Node::curve((x1, y1 - r), (x1, y1 - r), (x1, y1 - k)),
                        Node::curve((x1 - r, y1), (x1 - k, y1), (x1 - r, y1)),
                        Node::curve((x0 + r, y1), (x0 + r, y1), (x0 + k, y1)),
                        Node::curve((x0, y1 - r), (x0, y1 - k), (x0, y1 - r)),
                        Node::curve((x0, y0 + r), (x0, y0 + r), (x0, y0 + k)),
                    ],
                    closed: true,
                }]
            }
            "roundrect" => vec![SubPath { nodes: [(x0, y0), (x1, y0), (x1, y1), (x0, y1)].map(Node::corner).to_vec(), closed: true }],
            "ellipse" => {
                let (cx, cy, rx, ry) = ((x0 + x1) / 2.0, (y0 + y1) / 2.0, (x1 - x0) / 2.0, (y1 - y0) / 2.0);
                let (kx, ky) = (rx * 0.552_285, ry * 0.552_285);
                let smooth = |p: (f32, f32), c_in: (f32, f32), c_out: (f32, f32)| Node { p, c_in, c_out, smooth: true };
                vec![SubPath {
                    nodes: vec![
                        smooth((cx, y0), (cx - kx, y0), (cx + kx, y0)),
                        smooth((x1, cy), (x1, cy - ky), (x1, cy + ky)),
                        smooth((cx, y1), (cx + kx, y1), (cx - kx, y1)),
                        smooth((x0, cy), (x0, cy + ky), (x0, cy - ky)),
                    ],
                    closed: true,
                }]
            }
            // cœur : courbe qui passe par ses points (polygone de 72 côtés sinon, visible de près)
            "heart" => {
                let p = paint::shape_points("heart", self.a.0, self.a.1, self.b.0, self.b.1);
                let n = p.len();
                let nodes = (0..n)
                    .map(|i| {
                        let (a, b) = (p[(i + n - 1) % n], p[(i + 1) % n]);
                        let t = ((b.0 - a.0) / 6.0, (b.1 - a.1) / 6.0);
                        Node { p: p[i], c_in: (p[i].0 - t.0, p[i].1 - t.1), c_out: (p[i].0 + t.0, p[i].1 + t.1), smooth: true }
                    })
                    .collect();
                vec![SubPath { nodes, closed: true }]
            }
            k => vec![SubPath { nodes: paint::shape_points(k, self.a.0, self.a.1, self.b.0, self.b.1).into_iter().map(Node::corner).collect(), closed: true }],
        }
    }

    /// Remet `points` et le cadre d'accord avec les contours après une modification.
    pub fn sync_geom(&mut self) {
        let mut pts = Vec::new();
        for s in &self.subs {
            if !pts.is_empty() {
                pts.push((f32::NAN, f32::NAN));
            }
            pts.extend(s.flatten());
        }
        self.points = pts;
        let (x0, y0, x1, y1) = self.bbox();
        self.a = (x0, y0);
        self.b = (x1, y1);
    }

    /// La forme devient un chemin de Bézier, sa rotation intégrée à ses points : même dessin,
    /// mais chaque point d'ancrage est modifiable.
    pub fn bake_to_path(&mut self) {
        let mut subs = self.to_subs();
        if self.rot != 0.0 {
            for s in &mut subs {
                for n in &mut s.nodes {
                    n.p = self.to_world(n.p);
                    n.c_in = self.to_world(n.c_in);
                    n.c_out = self.to_world(n.c_out);
                }
            }
            let (s, c) = self.rot.sin_cos();
            let (cx, cy) = self.center();
            if let Some(g) = self.grad.as_mut() {
                let turn = |p: (f32, f32)| (cx + (p.0 - cx) * c - (p.1 - cy) * s, cy + (p.0 - cx) * s + (p.1 - cy) * c);
                g.p0 = turn(g.p0);
                g.p1 = turn(g.p1);
            }
        }
        self.kind = "path".into();
        self.subs = subs;
        self.rot = 0.0;
        self.sync_geom();
    }

    /// Applique `f` à toute la géométrie (coins, sommets, points d'ancrage, dégradé).
    pub fn map_points(&mut self, f: &dyn Fn((f32, f32)) -> (f32, f32)) {
        self.a = f(self.a);
        self.b = f(self.b);
        for p in &mut self.points {
            if !p.0.is_nan() {
                *p = f(*p);
            }
        }
        for s in &mut self.subs {
            for n in &mut s.nodes {
                n.p = f(n.p);
                n.c_in = f(n.c_in);
                n.c_out = f(n.c_out);
            }
        }
        if let Some(g) = self.grad.as_mut() {
            g.p0 = f(g.p0);
            g.p1 = f(g.p1);
        }
    }

    /// Transformation du document [a, b, c, d, e, f] (redimensionner, tourner, retourner,
    /// recadrer) : la géométrie est recalculée, jamais rééchantillonnée. Une forme que ses seuls
    /// coins ne décrivent plus (flèche tournée, rectangle penché) devient un chemin.
    pub fn transform(&mut self, m: [f32; 6]) {
        let [a, b, c, d, e, f] = m;
        let axis = b == 0.0 && c == 0.0;
        let quarter = a == 0.0 && d == 0.0;
        let uniform = (axis && (a.abs() - d.abs()).abs() < 1e-4) || (quarter && (b.abs() - c.abs()).abs() < 1e-4);
        let shaped_by_corners = matches!(self.kind.as_str(), "rect" | "roundrect" | "ellipse" | "line" | "curve" | "polyline" | "polygon" | "path");
        if !shaped_by_corners || !(axis || quarter) || (self.rot != 0.0 && !uniform) {
            self.bake_to_path();
        }
        let flip = a * d - b * c < 0.0;
        self.map_points(&move |p| (a * p.0 + c * p.1 + e, b * p.0 + d * p.1 + f));
        let scale = (a * d - b * c).abs().sqrt();
        self.width *= scale;
        if self.radius > 0.0 {
            self.radius *= scale;
        }
        if flip {
            self.rot = -self.rot;
        }
    }

    /// Point (x, y, document) dans le remplissage, et à `tol` près du trait (demi-épaisseur en
    /// plus) ; calculé sur les contours eux-mêmes, quelle que soit la nature de la forme.
    pub fn hit_parts(&self, x: f32, y: f32, tol: f32) -> (bool, bool) {
        let q = self.to_local((x, y));
        let lw = self.width.max(0.5) / 2.0 + tol;
        let (mut inside, mut on_edge) = (false, false);
        for s in self.to_subs() {
            let pts = s.flatten();
            if pts.len() < 2 {
                continue;
            }
            let count = pts.len();
            for i in 0..count {
                let (a, b) = (pts[i], pts[(i + 1) % count]);
                // parité pair-impair : fermeture implicite pour le remplissage
                if (a.1 > q.1) != (b.1 > q.1) && q.0 < a.0 + (q.1 - a.1) / (b.1 - a.1) * (b.0 - a.0) {
                    inside = !inside;
                }
                if (i + 1 < count || s.closed) && seg_dist(q, a, b) <= lw {
                    on_edge = true;
                }
            }
        }
        (inside, on_edge)
    }

    /// Le dessin visible de la forme passe par ce point : une forme sans remplissage ne se
    /// prend que par son trait.
    pub fn hit(&self, x: f32, y: f32, tol: f32) -> bool {
        let (inside, on_edge) = self.hit_parts(x, y, tol);
        let filled = !self.is_stroke_only() && (self.fill.is_some() || self.style != ShapeStyle::Outline);
        on_edge || (filled && inside)
    }

    /// Cadre dessiné (document) : contours tournés, épaisseur du trait et bouts décorés compris.
    pub fn paint_bounds(&self) -> (f32, f32, f32, f32) {
        let (x0, y0, x1, y1) = self.world_bbox();
        let lw = self.width.max(1.0);
        // onglets des angles vifs (limite 4) ; bouts décorés d'un trait
        let m = lw * 2.0 + if self.cap_start > 1 || self.cap_end > 1 { (lw * 3.5).max(10.0) } else { 0.0 } + 2.0;
        (x0 - m, y0 - m, x1 + m, y1 + m)
    }

    /// Pose la forme sur `out` (pixels w × h), dans son seul cadre ; `base` : image de départ
    /// (None : `out`). Retourne le rectangle touché. Même moteur que l'affichage du mode SVG.
    pub fn paint(&self, base: Option<&[u8]>, out: &mut [u8], w: usize, h: usize) -> Option<(usize, usize, usize, usize)> {
        let (x0, y0, x1, y1) = self.paint_bounds();
        let c = |v: f32, hi: usize| (v.max(0.0) as usize).min(hi);
        let r = (c(x0.floor(), w), c(y0.floor(), h), c(x1.ceil() + 1.0, w), c(y1.ceil() + 1.0, h));
        if r.2 <= r.0 || r.3 <= r.1 {
            return None;
        }
        let mut pm = tiny_skia::Pixmap::new((r.2 - r.0) as u32, (r.3 - r.1) as u32)?;
        crate::vecrender::draw_shape(&mut pm.as_mut(), self, tiny_skia::Transform::from_translate(-(r.0 as f32), -(r.1 as f32)));
        crate::vecrender::blit(&pm, r, base, out, w);
        Some(r)
    }
}

/// Objet d'un calque vectoriel.
#[derive(Clone, Debug, PartialEq)]
pub enum Obj {
    Text(TextObj),
    Shape(ShapeObj),
}

/// Effet du menu posé sur un calque vectoriel (mêmes valeurs que « Répéter »).
#[derive(Clone, Debug, PartialEq)]
pub struct Fx {
    /// nom de l'effet dans le moteur (masterpaint-core)
    pub name: String,
    /// titre affiché (liste des effets du calque)
    pub label: String,
    pub p: Vec<f32>,
    /// aberration chromatique ajoutée par la fenêtre de l'effet
    pub post: Option<Vec<f32>>,
    pub on: bool,
}

/// Contenu d'un calque vectoriel.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct VectorLayer {
    pub objects: Vec<Obj>,
    pub effects: Vec<Fx>,
    /// numéro du dernier rendu demandé (un résultat d'effets plus ancien est ignoré)
    pub serial: u64,
}

impl VectorLayer {
    pub fn with_text(t: TextObj) -> Self {
        VectorLayer { objects: vec![Obj::Text(t)], effects: Vec::new(), serial: 0 }
    }

    /// Texte de l'objet `i` (un calque texte peut en porter plusieurs ; forme : `None`).
    pub fn text_at(&self, i: usize) -> Option<&TextObj> {
        match self.objects.get(i)? {
            Obj::Text(t) => Some(t),
            Obj::Shape(_) => None,
        }
    }

    pub fn text_at_mut(&mut self, i: usize) -> Option<&mut TextObj> {
        match self.objects.get_mut(i)? {
            Obj::Text(t) => Some(t),
            Obj::Shape(_) => None,
        }
    }

    /// Déplace le seul objet `i`.
    pub fn translate_obj(&mut self, i: usize, dx: f32, dy: f32) {
        match self.objects.get_mut(i) {
            Some(Obj::Text(t)) => match t.m.as_mut() {
                Some(m) => {
                    m[4] += dx;
                    m[5] += dy;
                }
                None => {
                    t.x += dx;
                    t.y += dy;
                }
            },
            Some(Obj::Shape(s)) => s.map_points(&move |p| (p.0 + dx, p.1 + dy)),
            None => {}
        }
    }

    /// Transformation du document appliquée à tous les objets (voir `ShapeObj::transform`).
    pub fn transform(&mut self, m: [f32; 6]) {
        for o in &mut self.objects {
            match o {
                Obj::Text(t) => t.transform(m),
                Obj::Shape(s) => s.transform(m),
            }
        }
    }

    /// Objet dont le dessin passe par le point (x, y), le plus haut d'abord ; `tol` : marge du
    /// clic, en pixels du document.
    pub fn pick(&self, fonts: &mut Fonts, x: f32, y: f32, tol: f32) -> Option<usize> {
        (0..self.objects.len()).rev().find(|&i| match &self.objects[i] {
            Obj::Shape(s) => s.hit(x, y, tol),
            Obj::Text(_) => self.obj_frame(fonts, i).is_some_and(|(x0, y0, x1, y1)| x >= x0 - tol && y >= y0 - tol && x <= x1 + tol && y <= y1 + tol),
        })
    }

    /// Cadre de l'objet `i` (x0, y0, x1, y1) en pixels du document.
    pub fn obj_frame(&self, fonts: &mut Fonts, i: usize) -> Option<(f32, f32, f32, f32)> {
        match self.objects.get(i)? {
            Obj::Text(t) => {
                let font = font_for(fonts, &t.font)?;
                let f = text::raster(&font, &t.text, t.size, t.x, t.y, t.align(), t.antialias).frame;
                let Some([a, b, c, d, e, g]) = t.m else { return Some(f) };
                let q = [(f.0, f.1), (f.2, f.1), (f.2, f.3), (f.0, f.3)].map(|p| (a * p.0 + c * p.1 + e, b * p.0 + d * p.1 + g));
                Some(q.iter().fold((f32::MAX, f32::MAX, f32::MIN, f32::MIN), |r, p| (r.0.min(p.0), r.1.min(p.1), r.2.max(p.0), r.3.max(p.1))))
            }
            Obj::Shape(s) => {
                let (x0, y0, x1, y1) = s.world_bbox();
                let m = s.width / 2.0 + 1.0;
                Some((x0 - m, y0 - m, x1 + m, y1 + m))
            }
        }
    }

    /// Objet sous le point (x, y), le plus haut d'abord (le dernier posé est dessiné par-dessus).
    pub fn hit_index(&self, fonts: &mut Fonts, x: f32, y: f32) -> Option<usize> {
        (0..self.objects.len())
            .rev()
            .find(|&i| self.obj_frame(fonts, i).is_some_and(|(x0, y0, x1, y1)| x >= x0 - 4.0 && y >= y0 - 4.0 && x <= x1 + 4.0 && y <= y1 + 4.0))
    }

    /// Texte sous le point (x, y) (outil Texte : les formes sont ignorées).
    pub fn hit_text(&self, fonts: &mut Fonts, x: f32, y: f32) -> Option<usize> {
        (0..self.objects.len()).rev().find(|&i| {
            self.text_at(i).is_some() && self.obj_frame(fonts, i).is_some_and(|(x0, y0, x1, y1)| x >= x0 - 4.0 && y >= y0 - 4.0 && x <= x1 + 4.0 && y <= y1 + 4.0)
        })
    }

    /// Dessine l'objet `i` dans `out` depuis `base` (rendu sans cet objet), dans son seul cadre.
    /// Retourne le rectangle touché (pixels du document).
    pub fn draw_obj(&self, fonts: &mut Fonts, i: usize, base: &[u8], out: &mut [u8], w: usize, h: usize) -> Option<(usize, usize, usize, usize)> {
        match self.objects.get(i)? {
            Obj::Text(t) if t.m.is_some() => {
                out[..].copy_from_slice(base);
                Self::paint_over_slice(fonts, self.objects.get(i)?, out, w, h);
                Some((0, 0, w, h))
            }
            Obj::Text(t) => {
                let font = font_for(fonts, &t.font)?;
                let r = text::raster(&font, &t.text, t.size, t.x, t.y, t.align(), t.antialias);
                text::apply_raster(Some(base), out, w, h, &r, t.color, None)
            }
            Obj::Shape(s) => s.paint(Some(base), out, w, h),
        }
    }

    /// Pose l'objet `o` par-dessus `px` (rendu des objets).
    fn paint_over(fonts: &mut Fonts, o: &Obj, px: &mut Vec<u8>, w: usize, h: usize) {
        Self::paint_over_slice(fonts, o, px, w, h)
    }

    fn paint_over_slice(fonts: &mut Fonts, o: &Obj, px: &mut [u8], w: usize, h: usize) {
        match o {
            // texte transformé : tracé par ses contours (un glyphe en cache ne se tourne pas)
            Obj::Text(t) if t.m.is_some() => {
                let Some(mut pm) = tiny_skia::Pixmap::new(w as u32, h as u32) else { return };
                crate::vecrender::draw_text(&mut pm.as_mut(), fonts, t, tiny_skia::Transform::identity());
                crate::vecrender::blit(&pm, (0, 0, w, h), None, px, w);
            }
            Obj::Text(t) => {
                let Some(font) = font_for(fonts, &t.font) else { return };
                let r = text::raster(&font, &t.text, t.size, t.x, t.y, t.align(), t.antialias);
                text::apply_raster_over(px, w, h, &r, t.color);
            }
            Obj::Shape(s) => {
                s.paint(None, px, w, h);
            }
        }
    }

    /// Rendu des objets sans effets, l'objet `skip` excepté (fond de la saisie de cet objet).
    pub fn render_others(&self, fonts: &mut Fonts, w: usize, h: usize, skip: usize) -> Vec<u8> {
        let mut px = vec![0u8; w * h * 4];
        for (i, o) in self.objects.iter().enumerate() {
            if i != skip {
                Self::paint_over(fonts, o, &mut px, w, h);
            }
        }
        px
    }

    pub fn has_effects(&self) -> bool {
        self.effects.iter().any(|f| f.on)
    }

    /// Rendu des objets seuls (sans les effets) sur une toile transparente w × h.
    pub fn render_objects(&self, fonts: &mut Fonts, w: usize, h: usize) -> Vec<u8> {
        let mut px = vec![0u8; w * h * 4];
        for o in &self.objects {
            Self::paint_over(fonts, o, &mut px, w, h);
        }
        px
    }
}

/// Police d'un objet (police de secours : la première de la liste).
pub(crate) fn font_for(fonts: &mut Fonts, name: &str) -> Option<std::rc::Rc<ab_glyph::FontVec>> {
    fonts.index_of(name).and_then(|i| fonts.get(i)).or_else(|| fonts.get(0))
}

/// Effets que la pile d'un calque vectoriel n'accepte pas : ils ont besoin de pixels peints
/// (détourage, remplissage de contenu, retouches) ou changent la taille de l'image.
pub fn effect_allowed(name: &str) -> bool {
    !matches!(
        name,
        "contentfill" | "content_fill" | "removebg" | "cutout" | "cutoutsel" | "selection_cutout" | "splitrgb"
            // incrustation (couleur → transparence), retouches ponctuelles, rendus qui remplacent
            // le contenu du calque, conversions de palette
            | "chroma" | "redeyeremove" | "clouds" | "julia" | "mandelbrot" | "cameraraw" | "ascii"
    )
}

/// Entrée de menu (action « fx:<effet> » ou appel de la version web) indisponible sur un calque
/// texte : grisée dans les menus avec « Pixelliser le calque pour utiliser cet effet ».
/// Les effets du menu passent par leur nom de moteur (`effect_allowed`), ombre, VHS, flous,
/// déformations, aberration et réglages de couleur restent autorisés.
pub fn action_allowed(action: &str) -> bool {
    if let Some(fx) = action.strip_prefix("fx:") {
        let v = crate::effects::dialog(fx).map(|(_, f)| crate::effects::Vals::defaults(f)).unwrap_or_default();
        let name = crate::effects::params(fx, &v, 0xffffff, 1).map(|(n, _)| n).unwrap_or(fx);
        return effect_allowed(fx) && effect_allowed(name);
    }
    ![
        "splitActiveLayerRgbChannels", "illuGuidedCutoutToolStart", "illuRemoveBackgroundIntelligent",
        "showContentAwareFillDialog", "openCameraRawForActiveLayer", "illuMenuVectorizeBitmap",
        "clearSelectionContent", "ctxCut", "openLevelsForActiveLayer", "openCurvesForActiveLayer",
        "cutoutsel", "contentfill", "splitrgb",
    ]
    .iter()
    .any(|k| action.contains(k))
}

// ------------------------------------------------------------------ export SVG

fn xml_esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn svg_color(c: [u8; 4]) -> String {
    format!("#{:02x}{:02x}{:02x}", c[0], c[1], c[2])
}

thread_local! {
    /// numéro des dégradés exportés (identifiants uniques dans le fichier)
    static GRAD_ID: std::cell::Cell<u32> = const { std::cell::Cell::new(0) };
}

/// Contours en commandes SVG : segments droits en L, courbes en C, jamais découpées.
fn path_d(subs: &[SubPath]) -> String {
    let mut d = String::new();
    let n = |v: f32| ((v * 1000.0).round() / 1000.0).to_string();
    for s in subs {
        let Some(first) = s.nodes.first() else { continue };
        d += &format!("M{} {} ", n(first.p.0), n(first.p.1));
        for (_, p0, c1, c2, p1) in s.segments() {
            if c1 == p0 && c2 == p1 {
                d += &format!("L{} {} ", n(p1.0), n(p1.1));
            } else {
                d += &format!("C{} {} {} {} {} {} ", n(c1.0), n(c1.1), n(c2.0), n(c2.1), n(p1.0), n(p1.1));
            }
        }
        if s.closed {
            d += "Z ";
        }
    }
    d.trim_end().to_string()
}

/// Élément SVG d'un objet (formes : mêmes tracés que le rendu ; texte : lignes en `tspan`,
/// première ligne posée sur l'ascendante de la police).
fn obj_svg(o: &Obj, fonts: &mut Fonts) -> String {
    match o {
        Obj::Shape(s) => {
            let (x0, y0, x1, y1) = s.bbox();
            let col = svg_color(s.color);
            let op = if s.color[3] < 255 { format!(" opacity=\"{:.3}\"", s.color[3] as f32 / 255.0) } else { String::new() };
            let (fill, stroke) = match (s.kind.as_str(), s.style) {
                ("line", _) | ("polyline", _) => ("none".to_string(), format!(" stroke=\"{col}\" stroke-width=\"{}\" stroke-linecap=\"round\"", s.width)),
                // remplissage à part (pot de peinture) : fond de sa couleur, trait sauf style Plein
                (_, st) if s.fill.is_some() => {
                    let f = s.fill.unwrap_or(s.color);
                    let fop = if f[3] < 255 { format!("\" fill-opacity=\"{:.3}", f[3] as f32 / 255.0) } else { String::new() };
                    let stroke = if st == ShapeStyle::Fill { String::new() } else { format!(" stroke=\"{col}\" stroke-width=\"{}\"", s.width) };
                    (format!("{}{fop}", svg_color(f)), stroke)
                }
                (_, ShapeStyle::Fill) => (col.clone(), String::new()),
                (_, ShapeStyle::Outline) => ("none".to_string(), format!(" stroke=\"{col}\" stroke-width=\"{}\"", s.width)),
                (_, ShapeStyle::Both) => (col.clone(), format!(" stroke=\"{col}\" stroke-width=\"{}\"", s.width)),
            };
            let rot = if s.rot != 0.0 {
                let (cx, cy) = s.center();
                format!(" transform=\"rotate({:.3} {cx} {cy})\"", s.rot.to_degrees())
            } else {
                String::new()
            };
            // dégradé : défini juste avant l'objet, remplissage « url(#…) »
            let (defs, fill) = match &s.grad {
                Some(g) => {
                    let id = GRAD_ID.with(|n| {
                        n.set(n.get() + 1);
                        n.get()
                    });
                    let stops: String = g
                        .stops
                        .iter()
                        .map(|(t, c)| format!("<stop offset=\"{t}\" stop-color=\"{}\" stop-opacity=\"{:.3}\"/>", svg_color(*c), c[3] as f32 / 255.0))
                        .collect();
                    let el = if g.radial {
                        let r = ((g.p1.0 - g.p0.0).powi(2) + (g.p1.1 - g.p0.1).powi(2)).sqrt();
                        format!("<radialGradient id=\"mpg{id}\" gradientUnits=\"userSpaceOnUse\" cx=\"{}\" cy=\"{}\" r=\"{r}\">{stops}</radialGradient>", g.p0.0, g.p0.1)
                    } else {
                        format!("<linearGradient id=\"mpg{id}\" gradientUnits=\"userSpaceOnUse\" x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\">{stops}</linearGradient>", g.p0.0, g.p0.1, g.p1.0, g.p1.1)
                    };
                    (format!("<defs>{el}</defs>"), format!("url(#mpg{id})"))
                }
                None => (String::new(), fill),
            };
            let round = if s.kind == "path" && s.cap_start == 1 && !stroke.is_empty() { " stroke-linecap=\"round\" stroke-linejoin=\"round\"" } else { "" };
            let paint = format!(" fill=\"{fill}\"{stroke}{round}{op}{rot}");
            let el = match s.kind.as_str() {
                "line" | "curve" => {
                    let lw = s.width;
                    let path = s.stroke_path();
                    let cap = if s.cap_start == 0 && s.cap_end == 0 { "butt" } else { "round" };
                    let dash = match s.dash {
                        1 => format!(" stroke-dasharray=\"{} {}\"", lw * 3.0, lw * 2.0),
                        2 => format!(" stroke-dasharray=\"0 {}\"", lw * 2.0),
                        _ => String::new(),
                    };
                    let mut out = format!("<g{op}><path d=\"{}\" fill=\"none\" stroke=\"{col}\" stroke-width=\"{lw}\" stroke-linecap=\"{cap}\" stroke-linejoin=\"round\"{dash}/>", path_d(&s.to_subs()));
                    for (pts, hollow, _) in s.caps(&path).into_iter().flatten() {
                        let p: Vec<String> = pts.iter().map(|(x, y)| format!("{x:.2},{y:.2}")).collect();
                        let fill = if hollow { format!("none\" stroke=\"{col}\" stroke-width=\"{lw}") } else { col.clone() };
                        out.push_str(&format!("<polygon points=\"{}\" fill=\"{fill}\"/>", p.join(" ")));
                    }
                    out + "</g>"
                }
                "rect" | "roundrect" => {
                    let rx = if s.kind == "roundrect" { format!(" rx=\"{}\"", s.corner()) } else { String::new() };
                    format!("<rect x=\"{x0}\" y=\"{y0}\" width=\"{}\" height=\"{}\"{rx}{paint}/>", x1 - x0, y1 - y0)
                }
                "ellipse" => format!("<ellipse cx=\"{}\" cy=\"{}\" rx=\"{}\" ry=\"{}\"{paint}/>", (x0 + x1) / 2.0, (y0 + y1) / 2.0, (x1 - x0) / 2.0, (y1 - y0) / 2.0),
                // chemin de Bézier : ses vraies courbes
                "path" if !s.subs.is_empty() => format!("<path d=\"{}\" fill-rule=\"evenodd\"{paint}/>", path_d(&s.subs)),
                // chemin (plusieurs contours) ou polyligne coupée : un <path>, contours séparés
                "path" | "polyline" if s.points.iter().any(|p| p.0.is_nan()) || s.kind == "path" => {
                    let mut d = String::new();
                    for ring in s.points.split(|p| p.0.is_nan()).filter(|r| !r.is_empty()) {
                        for (i, (x, y)) in ring.iter().enumerate() {
                            d.push_str(&format!("{}{x:.2} {y:.2} ", if i == 0 { "M" } else { "L" }));
                        }
                        if s.kind == "path" {
                            d.push_str("Z ");
                        }
                    }
                    let rule = if s.kind == "path" { " fill-rule=\"evenodd\"" } else { "" };
                    format!("<path d=\"{}\"{rule}{paint}/>", d.trim_end())
                }
                "polygon" | "polyline" if !s.points.is_empty() => {
                    let pts: Vec<String> = s.points.iter().map(|(x, y)| format!("{x:.2},{y:.2}")).collect();
                    format!("<{} points=\"{}\"{paint}/>", s.kind, pts.join(" "))
                }
                k => {
                    let pts: Vec<String> = paint::shape_points(k, s.a.0, s.a.1, s.b.0, s.b.1).iter().map(|(x, y)| format!("{x:.2},{y:.2}")).collect();
                    format!("<polygon points=\"{}\"{paint}/>", pts.join(" "))
                }
            };
            format!("{defs}{el}")
        }
        Obj::Text(t) => {
            use ab_glyph::{Font, ScaleFont};
            let (ascent, line_h) = font_for(fonts, &t.font)
                .map(|f| {
                    let sc = f.as_scaled(ab_glyph::PxScale::from(t.size.max(1.0)));
                    (sc.ascent(), sc.height() + sc.line_gap())
                })
                .unwrap_or((t.size * 0.8, t.size * 1.2));
            // x : bord gauche du cadre (aligné à gauche), son centre ou son bord droit
            let frame = font_for(fonts, &t.font).map(|f| text::raster(&f, &t.text, t.size, t.x, t.y, t.align(), t.antialias).frame);
            let (anchor, ax) = match (t.align, frame) {
                (1, Some(f)) => ("middle", (f.0 + f.2) / 2.0),
                (2, Some(f)) => ("end", f.2),
                _ => ("start", t.x),
            };
            let lines: Vec<String> = t
                .text
                .split('\n')
                .enumerate()
                .map(|(i, l)| format!("<tspan x=\"{ax}\" y=\"{}\">{}</tspan>", t.y + ascent + i as f32 * line_h, xml_esc(l)))
                .collect();
            let op = if t.color[3] < 255 { format!(" fill-opacity=\"{:.3}\"", t.color[3] as f32 / 255.0) } else { String::new() };
            let xf = t.m.map_or(String::new(), |m| format!(" transform=\"matrix({} {} {} {} {} {})\"", m[0], m[1], m[2], m[3], m[4], m[5]));
            format!(
                "<text font-family=\"{}\" font-size=\"{}\" fill=\"{}\"{op}{xf} text-anchor=\"{anchor}\" xml:space=\"preserve\">{}</text>",
                xml_esc(&t.font),
                t.size,
                svg_color(t.color),
                lines.join("")
            )
        }
    }
}

/// Calques du dossier `parent` (à partir du calque `start`), en éléments SVG : un dossier devient
/// un groupe `<g>`.
fn export_layers(doc: &crate::editor::Doc, fonts: &mut Fonts, parent: u64, start: usize, image: &dyn Fn(&[u8], &str) -> String, body: &mut Vec<String>) {
    let (w, h) = (doc.w, doc.h);
    for l in doc.layers.iter().skip(start).filter(|l| l.parent == parent && l.visible && l.opacity > 0.0) {
        let mut style = String::new();
        if l.opacity < 1.0 {
            style += &format!(" opacity=\"{:.3}\"", l.opacity);
        }
        if l.blend != crate::editor::Blend::Normal {
            style += &format!(" style=\"mix-blend-mode:{}\"", l.blend.css());
        }
        if l.group {
            let mut inner = Vec::new();
            export_layers(doc, fonts, l.uid, start, image, &mut inner);
            body.push(format!("<g id=\"{}\"{style}>{}</g>", xml_esc(&l.name), inner.join("")));
            continue;
        }
        match l.vector.as_deref() {
            Some(v) if !v.has_effects() && l.mask.is_none() => {
                let objs: Vec<String> = v.objects.iter().map(|o| obj_svg(o, fonts)).collect();
                body.push(format!("<g id=\"{}\"{style}>{}</g>", xml_esc(&l.name), objs.join("")));
            }
            _ => {
                let mut px = l.px.to_vec();
                if let Some(m) = l.mask.as_ref().filter(|m| m.len() == w * h) {
                    for (p, a) in px.chunks_exact_mut(4).zip(m.iter()) {
                        p[3] = (p[3] as u16 * *a as u16 / 255) as u8;
                    }
                }
                body.push(format!("<g id=\"{}\"{style}>{}</g>", xml_esc(&l.name), image(&px, "")));
            }
        }
    }
}

/// Image en SVG (Fichier › Exporter › SVG) : les calques vectoriels sans effets restent des
/// objets SVG (formes, chemins de Bézier, textes modifiables dans un éditeur vectoriel), les
/// dossiers des groupes ; les autres calques sont des images PNG intégrées (masque α appliqué).
/// Un filtre dynamique ne s'exprime pas en SVG : le dessous du plus haut est aplati en une image.
pub fn to_svg(doc: &crate::editor::Doc, fonts: &mut Fonts) -> String {
    let (w, h) = (doc.w, doc.h);
    let mut body = Vec::new();
    let image = |px: &[u8], extra: &str| format!("<image x=\"0\" y=\"0\" width=\"{w}\" height=\"{h}\"{extra} href=\"{}\"/>", crate::illu::png_data_url(w, h, px));
    let mut start = 0;
    if let Some(k) = doc.layers.iter().rposition(|l| l.dynamic.is_some() && l.visible) {
        body.push(image(&crate::editor::Doc::scratch(w, h, doc.layers[..=k].to_vec()).flatten_final(), ""));
        start = k + 1;
    }
    export_layers(doc, fonts, 0, start, &image, &mut body);
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\">\n<title>{}</title>\n{}\n</svg>\n",
        xml_esc(&doc.title),
        body.join("\n")
    )
}

// ------------------------------------------------------------------ fichiers .illu

/// Objets (textes, formes) en JSON (clé `textObject` d'un calque du .illu, ignorée par les
/// anciennes versions qui lisent les pixels rendus de `dataUrl`).
pub fn to_json(v: &VectorLayer) -> serde_json::Value {
    let objects: Vec<serde_json::Value> = v
        .objects
        .iter()
        .map(|o| match o {
            Obj::Text(t) => serde_json::json!({
                "type": "text",
                "text": t.text,
                "font": t.font,
                "size": t.size,
                "color": [t.color[0], t.color[1], t.color[2], t.color[3]],
                "align": t.align,
                "antialias": t.antialias,
                "x": t.x,
                "y": t.y,
                "matrix": t.m,
            }),
            Obj::Shape(s) => serde_json::json!({
                "type": "shape",
                "kind": s.kind,
                "a": [s.a.0, s.a.1],
                "b": [s.b.0, s.b.1],
                "style": match s.style { ShapeStyle::Outline => "stroke", ShapeStyle::Fill => "fill", ShapeStyle::Both => "both" },
                "width": s.width,
                "color": [s.color[0], s.color[1], s.color[2], s.color[3]],
                // NaN (séparateur de contours) : écrit null par JSON, relu comme séparateur
                "points": s.points.iter().map(|p| if p.0.is_nan() { serde_json::Value::Null } else { serde_json::json!([p.0, p.1]) }).collect::<Vec<_>>(),
                "subs": s.subs.iter().map(|c| serde_json::json!({
                    "closed": c.closed,
                    "nodes": c.nodes.iter().map(|n| [n.p.0, n.p.1, n.c_in.0, n.c_in.1, n.c_out.0, n.c_out.1, n.smooth as u8 as f32]).collect::<Vec<_>>(),
                })).collect::<Vec<_>>(),
                "radius": s.radius,
                "fill": s.fill.map(|f| vec![f[0], f[1], f[2], f[3]]),
                "rot": s.rot,
                "capStart": s.cap_start,
                "capEnd": s.cap_end,
                "dash": s.dash,
                "grad": s.grad.as_ref().map(|g| serde_json::json!({
                    "radial": g.radial, "p0": [g.p0.0, g.p0.1], "p1": [g.p1.0, g.p1.1],
                    "stops": g.stops.iter().map(|(t, c)| vec![*t, c[0] as f32, c[1] as f32, c[2] as f32, c[3] as f32]).collect::<Vec<_>>(),
                })),
            }),
        })
        .collect();
    let effects: Vec<serde_json::Value> = v
        .effects
        .iter()
        .map(|f| serde_json::json!({ "name": f.name, "label": f.label, "params": f.p, "post": f.post, "on": f.on }))
        .collect();
    serde_json::json!({ "objects": objects, "effects": effects })
}

pub fn from_json(j: &serde_json::Value) -> Option<VectorLayer> {
    let f32s = |v: &serde_json::Value| -> Vec<f32> { v.as_array().map(|a| a.iter().filter_map(|x| x.as_f64()).map(|x| x as f32).collect()).unwrap_or_default() };
    let mut out = VectorLayer::default();
    for o in j.get("objects")?.as_array()? {
        let c = f32s(&o["color"]);
        let color = if c.len() == 4 { [c[0] as u8, c[1] as u8, c[2] as u8, c[3] as u8] } else { [0, 0, 0, 255] };
        match o.get("type").and_then(|t| t.as_str()) {
            Some("text") => {}
            Some("shape") => {
                let (a, b) = (f32s(&o["a"]), f32s(&o["b"]));
                if a.len() == 2 && b.len() == 2 {
                    out.objects.push(Obj::Shape(ShapeObj {
                        kind: o["kind"].as_str().unwrap_or("rect").to_string(),
                        a: (a[0], a[1]),
                        b: (b[0], b[1]),
                        style: match o["style"].as_str() {
                            Some("fill") => ShapeStyle::Fill,
                            Some("both") => ShapeStyle::Both,
                            _ => ShapeStyle::Outline,
                        },
                        width: o["width"].as_f64().unwrap_or(2.0) as f32,
                        color,
                        points: o["points"].as_array().map(|a| a.iter().map(&f32s).filter_map(|v| if v.len() == 2 { Some((v[0], v[1])) } else if v.is_empty() { Some((f32::NAN, f32::NAN)) } else { None }).collect()).unwrap_or_default(),
                        subs: o["subs"].as_array().map(|list| list.iter().map(|c| SubPath {
                            closed: c["closed"].as_bool().unwrap_or(false),
                            nodes: c["nodes"].as_array().map(|ns| ns.iter().map(&f32s).filter(|v| v.len() == 7).map(|v| Node { p: (v[0], v[1]), c_in: (v[2], v[3]), c_out: (v[4], v[5]), smooth: v[6] != 0.0 }).collect()).unwrap_or_default(),
                        }).collect()).unwrap_or_default(),
                        radius: o["radius"].as_f64().map_or(-1.0, |r| r as f32),
                        fill: Some(f32s(&o["fill"])).filter(|f| f.len() == 4).map(|f| [f[0] as u8, f[1] as u8, f[2] as u8, f[3] as u8]),
                        rot: o["rot"].as_f64().unwrap_or(0.0) as f32,
                        // lignes d'avant les bouts réglables : bouts ronds
                        cap_start: o["capStart"].as_u64().unwrap_or(1) as u8,
                        cap_end: o["capEnd"].as_u64().unwrap_or(1) as u8,
                        dash: o["dash"].as_u64().unwrap_or(0) as u8,
                        grad: o.get("grad").filter(|g| !g.is_null()).and_then(|g| {
                            let p0 = f32s(&g["p0"]);
                            let p1 = f32s(&g["p1"]);
                            let stops: Vec<(f32, [u8; 4])> = g["stops"].as_array()?.iter().map(&f32s).filter(|v| v.len() == 5).map(|v| (v[0], [v[1] as u8, v[2] as u8, v[3] as u8, v[4] as u8])).collect();
                            (p0.len() == 2 && p1.len() == 2 && !stops.is_empty()).then(|| Box::new(Grad { radial: g["radial"].as_bool().unwrap_or(false), p0: (p0[0], p0[1]), p1: (p1[0], p1[1]), stops }))
                        }),
                    }));
                }
                continue;
            }
            _ => continue,
        }
        out.objects.push(Obj::Text(TextObj {
            text: o["text"].as_str().unwrap_or_default().to_string(),
            font: o["font"].as_str().unwrap_or_default().to_string(),
            size: o["size"].as_f64().unwrap_or(32.0) as f32,
            color,
            align: o["align"].as_i64().unwrap_or(0) as i32,
            antialias: o["antialias"].as_bool().unwrap_or(true),
            x: o["x"].as_f64().unwrap_or(0.0) as f32,
            y: o["y"].as_f64().unwrap_or(0.0) as f32,
            m: Some(f32s(&o["matrix"])).filter(|v| v.len() == 6).map(|v| [v[0], v[1], v[2], v[3], v[4], v[5]]),
        }));
    }
    if let Some(list) = j.get("effects").and_then(|e| e.as_array()) {
        for f in list {
            let Some(name) = f["name"].as_str() else { continue };
            out.effects.push(Fx {
                name: name.to_string(),
                label: f["label"].as_str().unwrap_or(name).to_string(),
                p: f32s(&f["params"]),
                post: f.get("post").filter(|p| p.is_array()).map(f32s),
                on: f["on"].as_bool().unwrap_or(true),
            });
        }
    }
    // calque vectoriel vide (Calques › Nouveau calque vectoriel) : gardé tel quel
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Forme : rendue, déplaçable, gardée telle quelle dans le .illu.
    #[test]
    fn shape_object_roundtrip() {
        let s = ShapeObj { kind: "ellipse".into(), a: (4.0, 4.0), b: (20.0, 14.0), style: ShapeStyle::Fill, width: 2.0, color: [200, 10, 10, 255], points: Vec::new(), radius: -1.0, fill: None, rot: 0.0, cap_start: 1, cap_end: 1, dash: 0, grad: None, subs: Vec::new() };
        let mut v = VectorLayer { objects: vec![Obj::Shape(s)], effects: Vec::new(), serial: 0 };
        let mut fonts = Fonts::default();
        let px = v.render_objects(&mut fonts, 32, 24);
        assert!(px[(9 * 32 + 12) * 4 + 3] > 200, "centre de l'ellipse peint");
        assert_eq!(px[3], 0, "coin vide");
        assert_eq!(v.hit_index(&mut fonts, 12.0, 9.0), Some(0));
        assert_eq!(v.hit_text(&mut fonts, 12.0, 9.0), None);
        v.translate_obj(0, 5.0, 1.0);
        let back = from_json(&to_json(&v)).unwrap();
        assert_eq!(back.objects, v.objects);
    }

    /// Export SVG : une forme d'un calque vectoriel reste un élément SVG, le fond une image.
    #[test]
    fn svg_export_keeps_vectors() {
        let mut d = crate::editor::Doc::new(40, 30, [255, 255, 255, 255], "essai");
        d.add_layer_in();
        let s = ShapeObj { kind: "rect".into(), a: (2.0, 3.0), b: (12.0, 9.0), style: ShapeStyle::Outline, width: 2.0, color: [0, 128, 255, 255], points: Vec::new(), radius: -1.0, fill: None, rot: 0.0, cap_start: 1, cap_end: 1, dash: 0, grad: None, subs: Vec::new() };
        d.layer_mut().vector = Some(Box::new(VectorLayer { objects: vec![Obj::Shape(s)], effects: Vec::new(), serial: 0 }));
        let svg = to_svg(&d, &mut Fonts::default());
        assert!(svg.contains("<rect x=\"2\" y=\"3\" width=\"10\" height=\"6\" fill=\"none\" stroke=\"#0080ff\""), "{svg}");
        assert!(svg.contains("data:image/png;base64,"));
        assert!(svg.starts_with("<?xml"));
    }

    fn path_shape() -> ShapeObj {
        let nodes = vec![Node { p: (10.0, 40.0), c_in: (10.0, 40.0), c_out: (10.0, 10.0), smooth: false }, Node { p: (50.0, 40.0), c_in: (50.0, 10.0), c_out: (50.0, 40.0), smooth: false }];
        let mut s = ShapeObj { kind: "path".into(), a: (0.0, 0.0), b: (0.0, 0.0), style: ShapeStyle::Fill, width: 2.0, color: [10, 20, 200, 255], points: Vec::new(), radius: -1.0, fill: None, rot: 0.0, cap_start: 0, cap_end: 0, dash: 0, grad: None, subs: vec![SubPath { nodes, closed: true }] };
        s.sync_geom();
        s
    }

    /// Le bord d'une courbe reste net à tout zoom : au zoom × 16, la transition tient sur un ou
    /// deux pixels de l'écran (image agrandie : 16 pixels).
    #[test]
    fn edges_stay_sharp_when_zoomed() {
        let s = path_shape();
        let z = 16.0;
        let (w, h) = (64.0 * z, 48.0 * z);
        let mut pm = tiny_skia::Pixmap::new(w as u32, h as u32).unwrap();
        crate::vecrender::draw_shape(&mut pm.as_mut(), &s, tiny_skia::Transform::from_scale(z, z));
        let (stride, col) = (w as usize, (30.0 * z) as usize);
        let alpha: Vec<u8> = (0..h as usize).map(|y| pm.data()[(y * stride + col) * 4 + 3]).collect();
        let partial = alpha.iter().filter(|a| **a > 0 && **a < 255).count();
        assert!(alpha.iter().any(|a| *a == 255), "forme tracée");
        assert!(partial <= 2, "{partial} pixels de transition sur le bord haut");
    }

    /// Les courbes sont gardées : .illu (points d'ancrage identiques) et export SVG (commande C).
    #[test]
    fn bezier_paths_survive_save_and_export() {
        let s = path_shape();
        let v = VectorLayer { objects: vec![Obj::Shape(s)], effects: Vec::new(), serial: 0 };
        assert_eq!(from_json(&to_json(&v)).unwrap().objects, v.objects);
        let mut d = crate::editor::Doc::new(64, 48, [0, 0, 0, 0], "essai");
        d.vector_mode = true;
        d.layer_mut().vector = Some(Box::new(v));
        let svg = to_svg(&d, &mut Fonts::default());
        assert!(svg.contains("d=\"M10 40 C10 10 50 10 50 40 "), "{svg}");
        assert!(!svg.contains("data:image/png"), "aucun pixel dans l'export : {svg}");
    }

    /// Tourner / redimensionner l'image recalcule les objets au lieu de les rééchantillonner.
    #[test]
    fn document_transforms_keep_geometry() {
        let mut d = crate::editor::Doc::new(64, 48, [0, 0, 0, 0], "essai");
        d.layer_mut().vector = Some(Box::new(VectorLayer { objects: vec![Obj::Shape(path_shape())], effects: Vec::new(), serial: 0 }));
        d.resize(128, 96);
        let shape = |d: &crate::editor::Doc| match &d.layers[0].vector.as_ref().unwrap().objects[0] {
            Obj::Shape(s) => s.clone(),
            _ => panic!(),
        };
        let s = shape(&d);
        assert_eq!(s.subs[0].nodes[0].p, (20.0, 80.0));
        assert_eq!(s.subs[0].nodes[0].c_out, (20.0, 20.0));
        assert_eq!(s.width, 4.0);
        d.rotate90(true);
        assert_eq!(shape(&d).subs[0].nodes[0].p, (96.0 - 80.0, 20.0));
    }

    /// Une forme de la famille devient un chemin sans bouger (Sélection directe).
    #[test]
    fn shape_bakes_to_same_path() {
        let mut s = path_shape();
        s.kind = "rect".into();
        s.subs.clear();
        s.points.clear();
        s.a = (10.0, 10.0);
        s.b = (30.0, 20.0);
        s.rot = std::f32::consts::FRAC_PI_2;
        let before = s.corners_world();
        s.bake_to_path();
        assert_eq!(s.rot, 0.0);
        assert_eq!(s.subs[0].nodes.len(), 4);
        for (n, q) in s.subs[0].nodes.iter().zip(before) {
            assert!(dist(n.p, q) < 1e-3, "{:?} / {q:?}", n.p);
        }
        assert!(s.hit(20.0, 15.0, 0.0));
        assert!(!s.hit(12.0, 11.0, 0.0), "coin du rectangle d'avant la rotation");
    }

    /// Dégradé d'une forme : linéaire selon l'angle, radial depuis le centre, tracé en dégradé.
    #[test]
    fn shape_gradients_paint() {
        let b = (0.0, 0.0, 40.0, 20.0);
        let (red, blue) = ([255, 0, 0, 255], [0, 0, 255, 255]);
        let lin = shape_gradient(b, false, 0.0, false, red, blue);
        assert!(lin.p0.0 < 0.0 && lin.p1.0 > 40.0 && lin.p0.1 == 10.0, "{lin:?}");
        let rad = shape_gradient(b, true, 0.0, false, red, blue);
        assert_eq!((rad.p0, rad.p1), ((20.0, 10.0), (40.0, 10.0)));
        let smart = shape_gradient(b, false, 0.0, true, red, blue);
        assert_eq!(smart.stops.len(), 11);
        // rouge → bleu par la teinte : le milieu est saturé (magenta), pas un mélange terne
        assert_eq!(smart.stops[5].1, [255, 0, 255, 255]);
        let mut s = path_shape();
        s.kind = "rect".into();
        s.subs.clear();
        s.points.clear();
        s.a = (0.0, 0.0);
        s.b = (40.0, 20.0);
        s.grad = Some(Box::new(lin));
        let v = VectorLayer { objects: vec![Obj::Shape(s)], effects: Vec::new(), serial: 0 };
        let px = v.render_objects(&mut Fonts::default(), 40, 20);
        let at = |x: usize| &px[(10 * 40 + x) * 4..(10 * 40 + x) * 4 + 4];
        assert!(at(2)[0] > at(37)[0] && at(2)[2] < at(37)[2], "rouge à gauche, bleu à droite");
    }
}
