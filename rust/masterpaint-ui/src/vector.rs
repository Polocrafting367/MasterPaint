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
}

impl TextObj {
    fn align(&self) -> Align {
        match self.align {
            1 => Align::Center,
            2 => Align::Right,
            _ => Align::Left,
        }
    }
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
    fn caps(&self, path: &[(f32, f32)]) -> [Option<(Vec<(f32, f32)>, bool, f32)>; 2] {
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

    /// Cadre d'un trait (bouts décorés compris), aligné sur l'image.
    fn stroke_bounds(&self) -> (f32, f32, f32, f32) {
        let lw = self.width.max(1.0);
        let m = lw / 2.0 + if self.cap_start > 1 || self.cap_end > 1 { (lw * 3.5).max(10.0) } else { 1.0 };
        let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        for (x, y) in self.stroke_path() {
            (x0, y0, x1, y1) = (x0.min(x), y0.min(y), x1.max(x), y1.max(y));
        }
        (x0 - m, y0 - m, x1 + m, y1 + m)
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

    /// Pose la forme sur `out` (même tracé que l'outil), dans son seul cadre ; `base` : image
    /// de départ (None : `out`). Retourne le rectangle touché. Avec un remplissage à part : le
    /// fond d'abord, puis le trait par-dessus (sauf style Plein).
    pub fn paint(&self, base: Option<&[u8]>, out: &mut [u8], w: usize, h: usize) -> Option<(usize, usize, usize, usize)> {
        let bbox = self.world_bbox();
        let lw = self.width.max(1.0);
        // traits (ligne, polyligne) : posés en « plein », leur cadre doit couvrir la demi-épaisseur
        if self.is_stroke_only() {
            let stroked = if self.kind == "polyline" { (bbox.0 - lw / 2.0, bbox.1 - lw / 2.0, bbox.2 + lw / 2.0, bbox.3 + lw / 2.0) } else { self.stroke_bounds() };
            return paint::shape_onto(base, out, w, h, stroked, ShapeStyle::Fill, 0.0, self.sdf(), self.color);
        }
        match self.fill {
            Some(f) => {
                let r1 = paint::shape_onto(base, out, w, h, bbox, ShapeStyle::Fill, lw, self.sdf(), f);
                if self.style == ShapeStyle::Fill {
                    return r1;
                }
                let r2 = paint::shape_onto(None, out, w, h, bbox, ShapeStyle::Outline, lw, self.sdf(), self.color);
                match (r1, r2) {
                    (Some(p), Some(q)) => Some((p.0.min(q.0), p.1.min(q.1), p.2.max(q.2), p.3.max(q.3))),
                    (p, q) => p.or(q),
                }
            }
            None => paint::shape_onto(base, out, w, h, bbox, self.style, lw, self.sdf(), self.color),
        }
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
            Some(Obj::Text(t)) => {
                t.x += dx;
                t.y += dy;
            }
            Some(Obj::Shape(s)) => {
                s.a = (s.a.0 + dx, s.a.1 + dy);
                s.b = (s.b.0 + dx, s.b.1 + dy);
                for p in &mut s.points {
                    *p = (p.0 + dx, p.1 + dy);
                }
            }
            None => {}
        }
    }

    /// Cadre de l'objet `i` (x0, y0, x1, y1) en pixels du document.
    pub fn obj_frame(&self, fonts: &mut Fonts, i: usize) -> Option<(f32, f32, f32, f32)> {
        match self.objects.get(i)? {
            Obj::Text(t) => {
                let font = font_for(fonts, &t.font)?;
                Some(text::raster(&font, &t.text, t.size, t.x, t.y, t.align(), t.antialias).frame)
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
        match o {
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
fn font_for(fonts: &mut Fonts, name: &str) -> Option<std::rc::Rc<ab_glyph::FontVec>> {
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

/// Élément SVG d'un objet (formes : mêmes tracés que le rendu ; texte : lignes en `tspan`,
/// première ligne posée sur l'ascendante de la police).
fn obj_svg(o: &Obj, fonts: &mut Fonts) -> String {
    match o {
        Obj::Shape(s) => {
            let (x0, y0, x1, y1) = s.bbox();
            let col = svg_color(s.color);
            let op = if s.color[3] < 255 { format!(" opacity=\"{:.3}\"", s.color[3] as f32 / 255.0) } else { String::new() };
            let (fill, stroke) = match (s.kind.as_str(), s.style) {
                ("line", _) | ("polyline", _) => ("none".to_string(), format!(" stroke=\"{col}\" stroke-width=\"{}\" stroke-linecap=\"round\"", s.width.max(1.0))),
                // remplissage à part (pot de peinture) : fond de sa couleur, trait sauf style Plein
                (_, st) if s.fill.is_some() => {
                    let f = s.fill.unwrap_or(s.color);
                    let fop = if f[3] < 255 { format!("\" fill-opacity=\"{:.3}", f[3] as f32 / 255.0) } else { String::new() };
                    let stroke = if st == ShapeStyle::Fill { String::new() } else { format!(" stroke=\"{col}\" stroke-width=\"{}\"", s.width.max(1.0)) };
                    (format!("{}{fop}", svg_color(f)), stroke)
                }
                (_, ShapeStyle::Fill) => (col.clone(), String::new()),
                (_, ShapeStyle::Outline) => ("none".to_string(), format!(" stroke=\"{col}\" stroke-width=\"{}\"", s.width.max(1.0))),
                (_, ShapeStyle::Both) => (col.clone(), format!(" stroke=\"{col}\" stroke-width=\"{}\"", s.width.max(1.0))),
            };
            let rot = if s.rot != 0.0 {
                let (cx, cy) = s.center();
                format!(" transform=\"rotate({:.3} {cx} {cy})\"", s.rot.to_degrees())
            } else {
                String::new()
            };
            let paint = format!(" fill=\"{fill}\"{stroke}{op}{rot}");
            match s.kind.as_str() {
                "line" | "curve" => {
                    let lw = s.width.max(1.0);
                    let path = s.stroke_path();
                    let d: Vec<String> = path.iter().enumerate().map(|(i, p)| format!("{}{:.2} {:.2}", if i == 0 { "M" } else { "L" }, p.0, p.1)).collect();
                    let cap = if s.cap_start == 0 && s.cap_end == 0 { "butt" } else { "round" };
                    let dash = match s.dash {
                        1 => format!(" stroke-dasharray=\"{} {}\"", lw * 3.0, lw * 2.0),
                        2 => format!(" stroke-dasharray=\"0 {}\"", lw * 2.0),
                        _ => String::new(),
                    };
                    let mut out = format!("<g{op}><path d=\"{}\" fill=\"none\" stroke=\"{col}\" stroke-width=\"{lw}\" stroke-linecap=\"{cap}\" stroke-linejoin=\"round\"{dash}/>", d.join(" "));
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
                "polygon" | "polyline" if !s.points.is_empty() => {
                    let pts: Vec<String> = s.points.iter().map(|(x, y)| format!("{x:.2},{y:.2}")).collect();
                    format!("<{} points=\"{}\"{paint}/>", s.kind, pts.join(" "))
                }
                k => {
                    let pts: Vec<String> = paint::shape_points(k, s.a.0, s.a.1, s.b.0, s.b.1).iter().map(|(x, y)| format!("{x:.2},{y:.2}")).collect();
                    format!("<polygon points=\"{}\"{paint}/>", pts.join(" "))
                }
            }
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
            format!(
                "<text font-family=\"{}\" font-size=\"{}\" fill=\"{}\"{op} text-anchor=\"{anchor}\" xml:space=\"preserve\">{}</text>",
                xml_esc(&t.font),
                t.size,
                svg_color(t.color),
                lines.join("")
            )
        }
    }
}

/// Image en SVG (Fichier › Exporter › SVG) : les calques vectoriels sans effets restent des
/// objets SVG (formes, textes modifiables dans un éditeur vectoriel) ; les autres calques sont
/// des images PNG intégrées (masque α appliqué). Ce qui ne s'exprime pas en SVG est aplati en
/// une image : dossiers (tout le document), filtres dynamiques (le dessous du plus haut).
pub fn to_svg(doc: &crate::editor::Doc, fonts: &mut Fonts) -> String {
    let (w, h) = (doc.w, doc.h);
    let mut body = Vec::new();
    let image = |px: &[u8], extra: &str| format!("<image x=\"0\" y=\"0\" width=\"{w}\" height=\"{h}\"{extra} href=\"{}\"/>", crate::illu::png_data_url(w, h, px));
    let mut start = 0;
    if doc.has_groups() {
        body.push(image(&doc.flatten(), ""));
        start = doc.layers.len();
    } else if let Some(k) = doc.layers.iter().rposition(|l| l.dynamic.is_some() && l.visible) {
        body.push(image(&crate::editor::Doc::scratch(w, h, doc.layers[..=k].to_vec()).flatten(), ""));
        start = k + 1;
    }
    for l in doc.layers.iter().skip(start).filter(|l| l.visible && l.opacity > 0.0 && !l.group) {
        let mut style = String::new();
        if l.opacity < 1.0 {
            style += &format!(" opacity=\"{:.3}\"", l.opacity);
        }
        if l.blend != crate::editor::Blend::Normal {
            style += &format!(" style=\"mix-blend-mode:{}\"", l.blend.css());
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
            }),
            Obj::Shape(s) => serde_json::json!({
                "type": "shape",
                "kind": s.kind,
                "a": [s.a.0, s.a.1],
                "b": [s.b.0, s.b.1],
                "style": match s.style { ShapeStyle::Outline => "stroke", ShapeStyle::Fill => "fill", ShapeStyle::Both => "both" },
                "width": s.width,
                "color": [s.color[0], s.color[1], s.color[2], s.color[3]],
                "points": s.points.iter().map(|p| [p.0, p.1]).collect::<Vec<_>>(),
                "radius": s.radius,
                "fill": s.fill.map(|f| vec![f[0], f[1], f[2], f[3]]),
                "rot": s.rot,
                "capStart": s.cap_start,
                "capEnd": s.cap_end,
                "dash": s.dash,
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
                        points: o["points"].as_array().map(|a| a.iter().map(&f32s).filter(|v| v.len() == 2).map(|v| (v[0], v[1])).collect()).unwrap_or_default(),
                        radius: o["radius"].as_f64().map_or(-1.0, |r| r as f32),
                        fill: Some(f32s(&o["fill"])).filter(|f| f.len() == 4).map(|f| [f[0] as u8, f[1] as u8, f[2] as u8, f[3] as u8]),
                        rot: o["rot"].as_f64().unwrap_or(0.0) as f32,
                        // lignes d'avant les bouts réglables : bouts ronds
                        cap_start: o["capStart"].as_u64().unwrap_or(1) as u8,
                        cap_end: o["capEnd"].as_u64().unwrap_or(1) as u8,
                        dash: o["dash"].as_u64().unwrap_or(0) as u8,
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
        let s = ShapeObj { kind: "ellipse".into(), a: (4.0, 4.0), b: (20.0, 14.0), style: ShapeStyle::Fill, width: 2.0, color: [200, 10, 10, 255], points: Vec::new(), radius: -1.0, fill: None, rot: 0.0, cap_start: 1, cap_end: 1, dash: 0 };
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
        let s = ShapeObj { kind: "rect".into(), a: (2.0, 3.0), b: (12.0, 9.0), style: ShapeStyle::Outline, width: 2.0, color: [0, 128, 255, 255], points: Vec::new(), radius: -1.0, fill: None, rot: 0.0, cap_start: 1, cap_end: 1, dash: 0 };
        d.layer_mut().vector = Some(Box::new(VectorLayer { objects: vec![Obj::Shape(s)], effects: Vec::new(), serial: 0 }));
        let svg = to_svg(&d, &mut Fonts::default());
        assert!(svg.contains("<rect x=\"2\" y=\"3\" width=\"10\" height=\"6\" fill=\"none\" stroke=\"#0080ff\""), "{svg}");
        assert!(svg.contains("data:image/png;base64,"));
        assert!(svg.starts_with("<?xml"));
    }
}
