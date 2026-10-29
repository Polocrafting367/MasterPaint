//! Outils de dessin et de sélection : comportement au clic, au glisser et au relâcher.
//! Mêmes identifiants que les boutons de la fenêtre Outils de la version web.

use crate::editor::{Doc, SelMode};
use crate::paint::{self, BrushShape, Cover, GradientKind, ShapeStyle};
use masterpaint_core::region::{self, RegionArgs, RULE_BUCKET, RULE_WAND};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tool {
    RectSelect,
    Lasso,
    PolyLasso,
    MagneticLasso,
    Wand,
    Move,
    Eyedropper,
    Zoom,
    Brush,
    Pencil,
    Eraser,
    Fill,
    Gradient,
    Text,
    Shape,
    RoundRect,
    Line,
    Deform,
    Warp,
    Unsupported,
}

impl Tool {
    pub fn from_id(id: &str) -> Tool {
        match id {
            "tool-select" => Tool::RectSelect,
            "tool-direct-select" => Tool::Lasso,
            "tool-poly-lasso" => Tool::PolyLasso,
            "tool-magnetic-lasso" => Tool::MagneticLasso,
            "tool-wand" => Tool::Wand,
            "tool-move" => Tool::Move,
            "tool-eyedropper" => Tool::Eyedropper,
            "tool-zoom" => Tool::Zoom,
            "tool-brush" => Tool::Brush,
            "tool-pencil" => Tool::Pencil,
            "tool-eraser" => Tool::Eraser,
            "tool-fill" => Tool::Fill,
            "tool-gradient" => Tool::Gradient,
            "tool-text" => Tool::Text,
            "tool-shapes-family" => Tool::Shape,
            "tool-round-3" => Tool::RoundRect,
            "tool-line" => Tool::Line,
            "tool-deform" => Tool::Deform,
            "tool-warp-4" => Tool::Warp,
            _ => Tool::Unsupported,
        }
    }
}

/// Réglages des outils (ruban / barre classique).
#[derive(Clone)]
pub struct Opts {
    pub size: f32,
    pub hardness: f32,
    pub opacity: f32,
    pub brush: BrushShape,
    pub tolerance: f32,
    pub contiguous: bool,
    pub sel_mode: SelMode,
    pub style: ShapeStyle,
    pub line_width: f32,
    pub gradient: GradientKind,
    pub shape_kind: String,
    pub sym_x: bool,
    pub sym_y: bool,
    pub primary: [u8; 4],
    pub secondary: [u8; 4],
    /// lasso magnétique : force d'attraction aux bords (0 = lasso libre, 1 = colle fort)
    pub magnet: f32,
    /// lasso magnétique : longueur (pixels du document) entre deux ancres automatiques
    pub magnet_freq: f32,
}

impl Default for Opts {
    fn default() -> Self {
        Opts {
            size: 2.0,
            hardness: 1.0,
            opacity: 1.0,
            brush: BrushShape::Round,
            tolerance: 32.0,
            contiguous: true,
            sel_mode: SelMode::Replace,
            style: ShapeStyle::Outline,
            line_width: 2.0,
            gradient: GradientKind::Linear,
            shape_kind: "rect".into(),
            sym_x: false,
            sym_y: false,
            primary: [0, 0, 0, 255],
            secondary: [255, 255, 255, 255],
            magnet: 0.6,
            magnet_freq: MAG_FREQ,
        }
    }
}

/// Ce que l'interface doit faire après un événement d'outil.
pub enum Outcome {
    Nothing,
    /// redessiner ce rectangle du document (ou tout si None)
    Redraw(Option<(usize, usize, usize, usize)>),
    /// fin d'une action : redessiner tout et enregistrer l'étape d'historique
    Commit(&'static str),
    /// la sélection a changé : redessiner tout, sans étape d'historique
    Selection,
    PickColor([u8; 4], bool),
    /// contour à afficher pendant le geste (coordonnées document), sans toucher aux pixels
    Outline(Vec<(f32, f32)>),
    Zoom(f32, f32, bool),
    Message(&'static str),
}

struct Drag {
    start: (f32, f32),
    last: (f32, f32),
    base: crate::editor::Px,
    base_sel: Option<Vec<u8>>,
    cover: Cover,
    seed: u32,
    points: Vec<(f32, f32)>,
    secondary: bool,
    mode: SelMode,
}

/// Carte des contours du lasso magnétique : 0 = aplat (ou bruit courant), 1 = bord franc.
/// Réduite d'un pas `ds` pour les très grandes images (2 Mpx au plus), gardée tant que le
/// document ne change pas.
struct EdgeMap {
    key: (u64, usize, usize, usize, usize),
    w: usize,
    h: usize,
    ds: usize,
    v: Vec<f32>,
}

/// Lasso magnétique en cours : tracé figé (ancres comprises) et chemin vers le pointeur.
struct Magnetic {
    pts: Vec<(f32, f32)>,
    /// indices des ancres dans `pts` (la dernière est le départ du chemin courant)
    anchors: Vec<usize>,
    segment: Vec<(f32, f32)>,
    /// tracé bouton enfoncé ; sinon clic à clic (un clic sans bouger au départ)
    drag_trace: bool,
    pressed: bool,
    moved: bool,
    mode: SelMode,
}

/// Longueur (pixels du document) au-delà de laquelle le début du chemin est figé en ancre :
/// sans cela, un long chemin serait recalculé en entier à chaque mouvement et « glisserait ».
/// Valeur par défaut de `Opts::magnet_freq` (réglage « Ancres » du ruban).
pub const MAG_FREQ: f32 = 32.0;
/// Marge (pixels du document) de la fenêtre de recherche autour du segment ancre → pointeur,
/// à la force 60 % ; elle va de 8 px (force faible) à 56 px (force 100 %).
const MAG_MARGIN: f32 = 24.0;

/// Contours (Sobel sur la luminance floutée) normalisés par centiles comme select-core.js :
/// 0 au niveau médian (le grain d'une photo n'attire plus le tracé), 1 au 98e centile.
fn edge_map(doc: &Doc) -> EdgeMap {
    let ds = ((doc.w * doc.h) as f64 / 2_000_000.0).sqrt().ceil().max(1.0) as usize;
    let (w, h) = (doc.w.div_ceil(ds), doc.h.div_ceil(ds));
    let mut flat = vec![0u8; w * h * 4];
    doc.composite_scaled(&mut flat, ds, (0, 0, w, h), false);
    // luminance prémultipliée : le bord d'une zone transparente compte aussi
    let lum: Vec<f32> = flat
        .chunks_exact(4)
        .map(|p| (0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32) * p[3] as f32 / 255.0)
        .collect();
    // flou 3×3 (séparable)
    let mut tmp = vec![0f32; w * h];
    for y in 0..h {
        for x in 0..w {
            let (a, b) = (x.saturating_sub(1), (x + 1).min(w - 1));
            tmp[y * w + x] = (lum[y * w + a] + lum[y * w + x] + lum[y * w + b]) / 3.0;
        }
    }
    let mut bl = vec![0f32; w * h];
    for y in 0..h {
        let (a, b) = (y.saturating_sub(1), (y + 1).min(h - 1));
        for x in 0..w {
            bl[y * w + x] = (tmp[a * w + x] + tmp[y * w + x] + tmp[b * w + x]) / 3.0;
        }
    }
    let mut g = vec![0f32; w * h];
    let mut max = 1e-6f32;
    for y in 1..h.saturating_sub(1) {
        for x in 1..w.saturating_sub(1) {
            let i = y * w + x;
            let (tl, t, tr) = (bl[i - w - 1], bl[i - w], bl[i - w + 1]);
            let (ml, mr) = (bl[i - 1], bl[i + 1]);
            let (bo_l, bo, bo_r) = (bl[i + w - 1], bl[i + w], bl[i + w + 1]);
            let gx = (tr + 2.0 * mr + bo_r) - (tl + 2.0 * ml + bo_l);
            let gy = (bo_l + 2.0 * bo + bo_r) - (tl + 2.0 * t + tr);
            let m = (gx * gx + gy * gy).sqrt();
            g[i] = m;
            max = max.max(m);
        }
    }
    let mut hist = [0usize; 256];
    for v in &g {
        hist[((v / max) * 255.0).clamp(0.0, 255.0) as usize] += 1;
    }
    let pct = |frac: f32| {
        let target = (g.len() as f32 * frac) as usize;
        let mut acc = 0;
        for (b, n) in hist.iter().enumerate() {
            acc += n;
            if acc >= target {
                return b as f32 / 255.0 * max;
            }
        }
        max
    };
    let lo = pct(0.5);
    let span = pct(0.98).max(lo + 1e-6) - lo;
    for v in g.iter_mut() {
        *v = ((*v - lo) / span).clamp(0.0, 1.0);
    }
    EdgeMap { key: (doc.uid, doc.hindex, doc.history.len(), doc.w, doc.h), w, h, ds, v: g }
}

/// Chemin de moindre coût de `from` à `to` (coordonnées de la carte) dans le cadre des deux
/// points élargi de `margin` (Dijkstra, 8 voisins) : traverser un bord franc ne coûte presque
/// rien, le tracé colle donc aux contours (comme livewire de select-core.js). `pull` (0..0,98)
/// est le poids du bord dans le coût : 0 = plus court chemin (ligne droite).
fn livewire(e: &EdgeMap, from: (usize, usize), to: (usize, usize), margin: usize, pull: f32) -> Vec<(usize, usize)> {
    use std::cmp::Reverse;
    use std::collections::BinaryHeap;
    if from == to {
        return vec![from];
    }
    let (x0, x1) = (from.0.min(to.0).saturating_sub(margin), (from.0.max(to.0) + margin).min(e.w - 1));
    let (y0, y1) = (from.1.min(to.1).saturating_sub(margin), (from.1.max(to.1) + margin).min(e.h - 1));
    let (bw, bh) = (x1 - x0 + 1, y1 - y0 + 1);
    let n = bw * bh;
    if n > 400_000 {
        // pointeur très loin de l'ancre : segment droit (la recherche serait trop longue)
        let steps = from.0.abs_diff(to.0).max(from.1.abs_diff(to.1)).max(1);
        return (0..=steps)
            .map(|k| {
                let t = k as f32 / steps as f32;
                ((from.0 as f32 + (to.0 as f32 - from.0 as f32) * t).round() as usize, (from.1 as f32 + (to.1 as f32 - from.1 as f32) * t).round() as usize)
            })
            .collect();
    }
    const DX: [isize; 8] = [-1, 0, 1, -1, 1, -1, 0, 1];
    const DY: [isize; 8] = [-1, -1, -1, 0, 0, 1, 1, 1];
    const LEN: [f32; 8] = [std::f32::consts::SQRT_2, 1.0, std::f32::consts::SQRT_2, 1.0, 1.0, std::f32::consts::SQRT_2, 1.0, std::f32::consts::SQRT_2];
    let mut dist = vec![f32::INFINITY; n];
    let mut prev = vec![u32::MAX; n];
    let mut done = vec![false; n];
    let start = (from.1 - y0) * bw + (from.0 - x0);
    let end = (to.1 - y0) * bw + (to.0 - x0);
    let mut heap = BinaryHeap::new();
    dist[start] = 0.0;
    // distances positives : l'ordre des bits de f32 est celui des valeurs
    heap.push(Reverse((0f32.to_bits(), start as u32)));
    while let Some(Reverse((_, cur))) = heap.pop() {
        let cur = cur as usize;
        if done[cur] {
            continue;
        }
        done[cur] = true;
        if cur == end {
            break;
        }
        let (cx, cy) = ((cur % bw) as isize, (cur / bw) as isize);
        for k in 0..8 {
            let (nx, ny) = (cx + DX[k], cy + DY[k]);
            if nx < 0 || ny < 0 || nx >= bw as isize || ny >= bh as isize {
                continue;
            }
            let nl = ny as usize * bw + nx as usize;
            if done[nl] {
                continue;
            }
            let edge = e.v[(y0 + ny as usize) * e.w + x0 + nx as usize];
            let nd = dist[cur] + LEN[k] * (1.0 - pull * edge);
            if nd < dist[nl] {
                dist[nl] = nd;
                prev[nl] = cur as u32;
                heap.push(Reverse((nd.to_bits(), nl as u32)));
            }
        }
    }
    if !done[end] {
        return vec![from, to];
    }
    let mut path = Vec::new();
    let mut c = end;
    loop {
        path.push((x0 + c % bw, y0 + c / bw));
        if c == start || prev[c] == u32::MAX {
            break;
        }
        c = prev[c] as usize;
    }
    path.reverse();
    path
}

#[derive(Default)]
pub struct Session {
    drag: Option<Drag>,
    /// lasso polygonal en cours (points cliqués)
    pub poly: Vec<(f32, f32)>,
    poly_base: Option<Option<Vec<u8>>>,
    poly_mode: Option<SelMode>,
    mag: Option<Magnetic>,
    edges: Option<EdgeMap>,
    /// horloge (ms) et tolérance de proximité (pixels du document, 12 px écran) : données par
    /// l'interface à chaque évènement
    pub now: f64,
    pub near_tol: f32,
    /// dernier appui (temps, x, y) : double-clic mesuré ici (celui de Slint manque les appuis lents)
    last_press: (f64, f32, f32),
}

impl Session {
    pub fn busy(&self) -> bool {
        self.drag.is_some() || self.tracing()
    }

    /// Lasso polygonal ou magnétique en cours (tracé point par point, sans bouton enfoncé).
    pub fn tracing(&self) -> bool {
        !self.poly.is_empty() || self.mag.is_some()
    }

    pub fn cancel(&mut self, doc: &mut Doc) {
        if let Some(d) = self.drag.take() {
            doc.layer_mut().px = d.base;
            doc.sel = d.base_sel;
        }
        if let Some(s) = self.poly_base.take() {
            doc.sel = s;
        }
        self.poly.clear();
        self.poly_mode = None;
        self.mag = None;
    }

    /// Termine le lasso en cours (Entrée, Échap, double-clic, clic droit) : sélection affichée.
    pub fn finish_trace(&mut self, doc: &mut Doc, o: &Opts) -> Outcome {
        if self.mag.is_some() {
            return self.finish_magnetic(doc);
        }
        if !self.poly.is_empty() {
            return self.finish_poly(doc, o);
        }
        Outcome::Nothing
    }

    /// Retour arrière pendant un lasso : retire le dernier point (ou la dernière ancre).
    pub fn undo_point(&mut self) -> Outcome {
        if let Some(m) = self.mag.as_mut() {
            if m.anchors.len() > 1 {
                m.anchors.pop();
                let keep = *m.anchors.last().unwrap() + 1;
                m.pts.truncate(keep);
            }
            m.segment.clear();
            return Outcome::Outline(m.pts.clone());
        }
        if self.poly.len() > 1 {
            self.poly.pop();
        }
        Outcome::Nothing
    }

    /// Clic double : deux appuis à moins de 450 ms et à quelques pixels l'un de l'autre.
    fn double_press(&mut self, x: f32, y: f32) -> bool {
        let (t, px, py) = self.last_press;
        self.last_press = (self.now, x, y);
        self.now - t < 450.0 && (x - px).hypot(y - py) <= self.near_tol.max(1.0) * 0.6
    }

    /// Recalcule le chemin magnétique de la dernière ancre au pointeur ; fige le début du
    /// chemin en ancres quand il devient long.
    fn mag_update(&mut self, x: f32, y: f32, o: &Opts) -> Outcome {
        let (Some(e), Some(m)) = (self.edges.as_ref(), self.mag.as_mut()) else { return Outcome::Nothing };
        let ds = e.ds as f32;
        let to_map = |p: (f32, f32)| (((p.0 / ds) as isize).clamp(0, e.w as isize - 1) as usize, ((p.1 / ds) as isize).clamp(0, e.h as isize - 1) as usize);
        let a = *m.pts.last().unwrap();
        let force = o.magnet.clamp(0.0, 1.0);
        let freq = o.magnet_freq.clamp(8.0, 200.0);
        let mut seg: Vec<(f32, f32)> = if force <= 0.01 {
            // force nulle : lasso libre, segment droit vers le pointeur
            vec![a, (x, y)]
        } else {
            // force : largeur de la fenêtre de recherche et poids des bords dans le coût
            let margin_px = MAG_MARGIN * (0.33 + 1.67 * force * force);
            let margin = ((margin_px / ds).ceil() as usize).max(4);
            livewire(e, to_map(a), to_map((x, y)), margin, 0.98 * force.sqrt())
                .into_iter()
                .map(|(px, py)| ((px as f32 + 0.5) * ds, (py as f32 + 0.5) * ds))
                .collect()
        };
        if let Some(f) = seg.first_mut() {
            *f = a;
        }
        loop {
            let mut acc = 0.0;
            let mut cut = None;
            for i in 1..seg.len() {
                acc += (seg[i].0 - seg[i - 1].0).hypot(seg[i].1 - seg[i - 1].1);
                if acc >= freq && i + 1 < seg.len() {
                    cut = Some(i);
                    break;
                }
            }
            let Some(i) = cut else { break };
            m.pts.extend_from_slice(&seg[1..=i]);
            m.anchors.push(m.pts.len() - 1);
            seg.drain(..i);
        }
        m.segment = seg;
        let mut all = m.pts.clone();
        all.extend(m.segment.iter().skip(1));
        Outcome::Outline(all)
    }

    fn finish_magnetic(&mut self, doc: &mut Doc) -> Outcome {
        let Some(m) = self.mag.take() else { return Outcome::Nothing };
        let mut pts = m.pts;
        pts.extend(m.segment.into_iter().skip(1));
        if pts.len() > 2 {
            doc.apply_selection(paint::polygon_mask(doc.w, doc.h, &pts), m.mode);
        }
        Outcome::Selection
    }

    fn mode(opts: &Opts, ctrl: bool, alt: bool) -> SelMode {
        if ctrl {
            SelMode::Add
        } else if alt {
            SelMode::Subtract
        } else {
            opts.sel_mode
        }
    }

    pub fn press(&mut self, tool: Tool, doc: &mut Doc, o: &Opts, x: f32, y: f32, secondary: bool, ctrl: bool, alt: bool) -> Outcome {
        let (w, h) = (doc.w, doc.h);
        let inside = x >= 0.0 && y >= 0.0 && (x as usize) < w && (y as usize) < h;
        let color = if secondary { o.secondary } else { o.primary };
        match tool {
            Tool::Eyedropper => {
                if !inside {
                    return Outcome::Nothing;
                }
                Outcome::PickColor(doc.pixel_color(x as usize, y as usize), secondary)
            }
            Tool::Zoom => Outcome::Zoom(x, y, !(secondary || alt)),
            Tool::Text => Outcome::Message("Texte : l'outil arrive dans une prochaine étape du portage Rust."),
            Tool::Unsupported => Outcome::Message("Cet outil n'est pas encore porté dans la version Rust."),
            Tool::Fill => {
                if !inside {
                    return Outcome::Nothing;
                }
                let src = doc.layer().px.clone();
                let mut mask = vec![0u8; w * h];
                let clip: Option<Vec<u8>> = doc.sel.as_ref().map(|m| m.iter().map(|v| (*v > 0) as u8).collect());
                let args = RegionArgs {
                    src: &src,
                    w,
                    h,
                    sx: x as usize,
                    sy: y as usize,
                    contiguous: o.contiguous,
                    rule: RULE_BUCKET,
                    tol: o.tolerance,
                    clip: clip.as_deref(),
                    bounds: [0, 0, w - 1, h - 1],
                };
                if region::region(&args, &mut mask) == 0 {
                    return Outcome::Nothing;
                }
                let mut cov = Cover::new(w, h);
                for (c, m) in cov.m.iter_mut().zip(&mask) {
                    *c = if *m > 0 { 255 } else { 0 };
                }
                cov.dirty = Some((0, 0, w, h));
                let mut out = src.clone();
                paint::apply_cover(&src, &mut out, &cov, color, o.opacity, false, doc.sel.as_deref());
                doc.layer_mut().px = out;
                Outcome::Commit("Remplissage")
            }
            Tool::Wand => {
                if !inside {
                    return Outcome::Nothing;
                }
                let src = doc.layer().px.clone();
                let mut mask = vec![0u8; w * h];
                let args = RegionArgs {
                    src: &src,
                    w,
                    h,
                    sx: x as usize,
                    sy: y as usize,
                    contiguous: o.contiguous,
                    rule: RULE_WAND,
                    tol: o.tolerance * 2.55,
                    clip: None,
                    bounds: [0, 0, w - 1, h - 1],
                };
                region::region(&args, &mut mask);
                for v in mask.iter_mut() {
                    *v = if *v > 0 { 255 } else { 0 };
                }
                doc.apply_selection(mask, Self::mode(o, ctrl, alt));
                Outcome::Selection
            }
            Tool::PolyLasso => {
                let dbl = self.double_press(x, y);
                if self.poly.is_empty() {
                    if secondary {
                        return Outcome::Nothing;
                    }
                    self.poly_base = Some(doc.sel.clone());
                    self.poly_mode = Some(Self::mode(o, ctrl, alt));
                } else {
                    // fin : clic droit, clic près du premier point, double-clic
                    let first = self.poly[0];
                    let near_first = self.poly.len() >= 3 && (x - first.0).hypot(y - first.1) <= self.near_tol.max(1.0);
                    if secondary || near_first || dbl {
                        return self.finish_poly(doc, o);
                    }
                }
                self.poly.push((x, y));
                // contour seul (l'interface le dessine) : rien à recomposer
                Outcome::Nothing
            }
            Tool::MagneticLasso => {
                let dbl = self.double_press(x, y);
                if let Some(m) = self.mag.as_mut() {
                    // clic à clic : fin par clic droit, double-clic ou clic près du départ
                    let first = m.pts[0];
                    let near_first = m.pts.len() + m.segment.len() > 3 && (x - first.0).hypot(y - first.1) <= self.near_tol.max(1.0);
                    if secondary || near_first || dbl {
                        return self.finish_magnetic(doc);
                    }
                    let seg = std::mem::take(&mut m.segment);
                    if seg.len() > 1 {
                        m.pts.extend(seg.into_iter().skip(1));
                    } else {
                        m.pts.push((x, y));
                    }
                    m.anchors.push(m.pts.len() - 1);
                    m.pressed = true;
                    return Outcome::Outline(m.pts.clone());
                }
                if secondary {
                    return Outcome::Nothing;
                }
                let key = (doc.uid, doc.hindex, doc.history.len(), doc.w, doc.h);
                if self.edges.as_ref().map_or(true, |e| e.key != key) {
                    self.edges = Some(edge_map(doc));
                }
                let p = (x.clamp(0.0, w as f32), y.clamp(0.0, h as f32));
                self.mag = Some(Magnetic { pts: vec![p], anchors: vec![0], segment: Vec::new(), drag_trace: true, pressed: true, moved: false, mode: Self::mode(o, ctrl, alt) });
                Outcome::Outline(vec![p])
            }
            _ => {
                let base = doc.layer().px.clone();
                self.drag = Some(Drag {
                    start: (x, y),
                    last: (x, y),
                    base,
                    base_sel: doc.sel.clone(),
                    cover: Cover::new(w, h),
                    seed: (x as u32).wrapping_mul(31).wrapping_add(y as u32),
                    points: vec![(x, y)],
                    secondary,
                    mode: Self::mode(o, ctrl, alt),
                });
                self.moved(tool, doc, o, x, y, true)
            }
        }
    }

    /// Glisser (ou premier point quand `first`).
    pub fn moved(&mut self, tool: Tool, doc: &mut Doc, o: &Opts, x: f32, y: f32, first: bool) -> Outcome {
        let (w, h) = (doc.w, doc.h);
        // lasso magnétique : le chemin suit le pointeur, bouton enfoncé ou non (clic à clic)
        if tool == Tool::MagneticLasso {
            if let Some(m) = self.mag.as_mut() {
                if m.pressed && (x - m.pts[0].0).hypot(y - m.pts[0].1) > 3.0 {
                    m.moved = true;
                }
                return self.mag_update(x.clamp(0.0, w as f32), y.clamp(0.0, h as f32), o);
            }
            return Outcome::Nothing;
        }
        let Some(d) = self.drag.as_mut() else { return Outcome::Nothing };
        let color = if d.secondary { o.secondary } else { o.primary };
        let prev = d.last;
        d.last = (x, y);
        match tool {
            Tool::Brush | Tool::Eraser => {
                let r = (o.size / 2.0).max(0.5);
                for (p0, p1) in mirrored(prev, (x, y), o, sym_center(doc)) {
                    if first {
                        d.seed = d.seed.wrapping_add(1);
                        d.cover.stamp(p1.0, p1.1, r, o.hardness, o.brush, d.seed);
                    } else {
                        d.cover.segment(p0, p1, r, o.hardness, o.brush, &mut d.seed);
                    }
                }
                let recent = d.cover.take_recent();
                let a = doc.active;
                paint::apply_cover_in(&d.base, &mut doc.layers[a].px, &d.cover, recent, color, o.opacity, tool == Tool::Eraser, doc.sel.as_deref());
                Outcome::Redraw(recent)
            }
            Tool::Pencil => {
                for (p0, p1) in mirrored(prev, (x, y), o, sym_center(doc)) {
                    d.cover.pencil((p0.0.floor() as isize, p0.1.floor() as isize), (p1.0.floor() as isize, p1.1.floor() as isize));
                }
                let recent = d.cover.take_recent();
                let a = doc.active;
                paint::apply_cover_in(&d.base, &mut doc.layers[a].px, &d.cover, recent, color, 1.0, false, doc.sel.as_deref());
                Outcome::Redraw(recent)
            }
            Tool::Line | Tool::Shape | Tool::RoundRect => {
                if first {
                    return Outcome::Nothing;
                }
                let (a, b) = (d.start, (x, y));
                let mut cov = Cover::new(w, h);
                let bbox = (a.0.min(b.0), a.1.min(b.1), a.0.max(b.0), a.1.max(b.1));
                let lw = o.line_width.max(1.0);
                match tool {
                    Tool::Line => cov.shape(bbox, ShapeStyle::Fill, 0.0, paint::sdf_line(a, b, lw)),
                    Tool::RoundRect => cov.shape(bbox, o.style, lw, paint::sdf_rect(a.0, a.1, b.0, b.1, (bbox.2 - bbox.0).min(bbox.3 - bbox.1) * 0.2)),
                    _ => match o.shape_kind.as_str() {
                        "rect" => cov.shape(bbox, o.style, lw, paint::sdf_rect(a.0, a.1, b.0, b.1, 0.0)),
                        "ellipse" => cov.shape(bbox, o.style, lw, paint::sdf_ellipse(a.0, a.1, b.0, b.1)),
                        k => cov.shape(bbox, o.style, lw, paint::sdf_polygon(paint::shape_points(k, a.0, a.1, b.0, b.1))),
                    },
                }
                // efface l'aperçu précédent (rectangle du trait d'avant) puis applique le nouveau
                let old = d.cover.dirty;
                let lay = &mut doc.layers[doc.active].px;
                if let Some((x0, y0, x1, y1)) = old {
                    for yy in y0..y1 {
                        let (s, e) = ((yy * w + x0) * 4, (yy * w + x1) * 4);
                        lay[s..e].copy_from_slice(&d.base[s..e]);
                    }
                }
                let a = doc.active;
                paint::apply_cover(&d.base, &mut doc.layers[a].px, &cov, color, o.opacity, false, doc.sel.as_deref());
                let dirty = union(old, cov.dirty);
                d.cover = cov;
                Outcome::Redraw(dirty)
            }
            Tool::Gradient => {
                if first {
                    return Outcome::Nothing;
                }
                let (c0, c1) = if d.secondary { (o.secondary, o.primary) } else { (o.primary, o.secondary) };
                let sel = doc.sel.clone();
                paint::gradient(&d.base, &mut doc.layers[doc.active].px, w, h, d.start, (x, y), c0, c1, o.gradient, sel.as_deref());
                Outcome::Redraw(None)
            }
            // sélections : seul le contour est affiché pendant le geste ; le masque est calculé
            // au relâchement (recalculer le masque et toute l'image à chaque mouvement figeait l'interface)
            Tool::RectSelect => {
                let (x0, y0, x1, y1) = rect_px(d.start, (x, y), w, h);
                let (x0, y0, x1, y1) = (x0 as f32, y0 as f32, x1 as f32, y1 as f32);
                Outcome::Outline(vec![(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
            }
            Tool::Lasso => {
                // un point par demi-pixel parcouru suffit (le masque est calculé au relâchement)
                if d.points.last().map_or(true, |p| (p.0 - x).hypot(p.1 - y) >= 0.5) {
                    d.points.push((x, y));
                }
                Outcome::Outline(d.points.clone())
            }
            Tool::Move => {
                let (dx, dy) = ((x - d.start.0).round() as isize, (y - d.start.1).round() as isize);
                let lay = &mut doc.layers[doc.active].px;
                match &d.base_sel {
                    None => {
                        lay.fill(0);
                        shift_into(&d.base, lay, w, h, dx, dy, None);
                    }
                    Some(m) => {
                        // trou transparent là où était la sélection, puis le contenu déplacé
                        lay.copy_from_slice(&d.base);
                        for i in 0..w * h {
                            let s = m[i] as u32;
                            if s > 0 {
                                lay[i * 4 + 3] = (lay[i * 4 + 3] as u32 * (255 - s) / 255) as u8;
                            }
                        }
                        shift_into(&d.base, lay, w, h, dx, dy, Some(m));
                        let mut nm = vec![0u8; w * h];
                        for yy in 0..h as isize {
                            for xx in 0..w as isize {
                                let (sx, sy) = (xx - dx, yy - dy);
                                if sx >= 0 && sy >= 0 && (sx as usize) < w && (sy as usize) < h {
                                    nm[yy as usize * w + xx as usize] = m[sy as usize * w + sx as usize];
                                }
                            }
                        }
                        doc.sel = Some(nm);
                    }
                }
                Outcome::Redraw(None)
            }
            _ => Outcome::Nothing,
        }
    }

    pub fn release(&mut self, tool: Tool, doc: &mut Doc) -> Outcome {
        if tool == Tool::MagneticLasso {
            let Some(m) = self.mag.as_mut() else { return Outcome::Nothing };
            m.pressed = false;
            if m.drag_trace {
                if m.moved {
                    // tracé bouton enfoncé : refermé au relâchement
                    return self.finish_magnetic(doc);
                }
                // simple clic sans bouger : mode clic à clic (ancres posées une à une)
                m.drag_trace = false;
            }
            return Outcome::Nothing;
        }
        let Some(d) = self.drag.take() else { return Outcome::Nothing };
        let moved = (d.last.0 - d.start.0).abs() + (d.last.1 - d.start.1).abs() > 0.5;
        match tool {
            Tool::Brush => Outcome::Commit("Pinceau"),
            Tool::Eraser => Outcome::Commit("Gomme"),
            Tool::Pencil => Outcome::Commit("Crayon"),
            Tool::Line if moved => Outcome::Commit("Ligne"),
            Tool::Shape | Tool::RoundRect if moved => Outcome::Commit("Forme"),
            Tool::Gradient if moved => Outcome::Commit("Dégradé"),
            Tool::Move if moved => Outcome::Commit("Déplacer"),
            Tool::RectSelect => {
                let (x0, y0, x1, y1) = rect_px(d.start, d.last, doc.w, doc.h);
                if !moved || x1 <= x0 || y1 <= y0 {
                    // simple clic : désélectionne (comme Paint.NET)
                    let next = if d.mode == SelMode::Replace { None } else { d.base_sel };
                    doc.sel = next;
                } else {
                    let w = doc.w;
                    let mut m = vec![0u8; w * doc.h];
                    for yy in y0..y1 {
                        m[yy * w + x0..yy * w + x1].fill(255);
                    }
                    doc.apply_selection(m, d.mode);
                }
                Outcome::Selection
            }
            Tool::Lasso => {
                if d.points.len() > 2 {
                    doc.apply_selection(paint::polygon_mask(doc.w, doc.h, &d.points), d.mode);
                } else if d.mode == SelMode::Replace {
                    // simple clic : désélectionne
                    doc.sel = None;
                }
                Outcome::Selection
            }
            _ => Outcome::Redraw(None),
        }
    }

    /// Ferme le lasso polygonal (double-clic ou Entrée).
    pub fn finish_poly(&mut self, doc: &mut Doc, o: &Opts) -> Outcome {
        if self.poly.len() < 3 {
            self.cancel(doc);
            return Outcome::Redraw(None);
        }
        let pts = std::mem::take(&mut self.poly);
        let base = self.poly_base.take().unwrap_or(None);
        doc.sel = base;
        let mode = self.poly_mode.take().unwrap_or(o.sel_mode);
        doc.apply_selection(paint::polygon_mask(doc.w, doc.h, &pts), mode);
        Outcome::Selection
    }
}

/// Rectangle de sélection en pixels entiers, limité à l'image (x0, y0, x1, y1 exclus).
fn rect_px(a: (f32, f32), b: (f32, f32), w: usize, h: usize) -> (usize, usize, usize, usize) {
    let (x0, y0) = (a.0.min(b.0).max(0.0) as usize, a.1.min(b.1).max(0.0) as usize);
    let (x1, y1) = ((a.0.max(b.0).max(0.0).ceil() as usize).min(w), (a.1.max(b.1).max(0.0).ceil() as usize).min(h));
    (x0.min(w), y0.min(h), x1, y1)
}

/// Segment et ses reflets selon la symétrie X / Y, autour du centre des axes (`Doc::sym`,
/// centre de l'image par défaut).
fn mirrored(a: (f32, f32), b: (f32, f32), o: &Opts, c: (f32, f32)) -> Vec<((f32, f32), (f32, f32))> {
    let (w, h) = (2.0 * c.0, 2.0 * c.1);
    let mut v = vec![(a, b)];
    if o.sym_x {
        v.push(((w - a.0, a.1), (w - b.0, b.1)));
    }
    if o.sym_y {
        v.push(((a.0, h - a.1), (b.0, h - b.1)));
    }
    if o.sym_x && o.sym_y {
        v.push(((w - a.0, h - a.1), (w - b.0, h - b.1)));
    }
    v
}

/// Centre des axes de symétrie du document (pixels).
pub fn sym_center(doc: &Doc) -> (f32, f32) {
    doc.sym.unwrap_or((doc.w as f32 / 2.0, doc.h as f32 / 2.0))
}

fn union(a: Option<(usize, usize, usize, usize)>, b: Option<(usize, usize, usize, usize)>) -> Option<(usize, usize, usize, usize)> {
    match (a, b) {
        (Some(p), Some(q)) => Some((p.0.min(q.0), p.1.min(q.1), p.2.max(q.2), p.3.max(q.3))),
        (p, None) => p,
        (None, q) => q,
    }
}

/// Copie `src` décalé de (dx, dy) sur `dst` (fusion « over »), limité au masque s'il y en a un.
fn shift_into(src: &[u8], dst: &mut [u8], w: usize, h: usize, dx: isize, dy: isize, mask: Option<&Vec<u8>>) {
    for y in 0..h as isize {
        for x in 0..w as isize {
            let (sx, sy) = (x - dx, y - dy);
            if sx < 0 || sy < 0 || sx as usize >= w || sy as usize >= h {
                continue;
            }
            let si = sy as usize * w + sx as usize;
            let s = mask.map_or(255, |m| m[si]) as f32 / 255.0;
            if s <= 0.0 {
                continue;
            }
            let o = (y as usize * w + x as usize) * 4;
            let sa = src[si * 4 + 3] as f32 / 255.0 * s;
            let da = dst[o + 3] as f32 / 255.0;
            let ao = sa + da * (1.0 - sa);
            if ao <= 0.0 {
                continue;
            }
            for k in 0..3 {
                dst[o + k] = ((src[si * 4 + k] as f32 * sa + dst[o + k] as f32 * da * (1.0 - sa)) / ao + 0.5) as u8;
            }
            dst[o + 3] = (ao * 255.0 + 0.5) as u8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Masque α : la luminance du masque règle la visibilité du calque ; il suit les rotations.
    #[test]
    fn alpha_mask_hides_layer() {
        let mut d = Doc::new(4, 2, [0, 0, 255, 255], "m");
        d.add_layer();
        for p in d.layer_mut().px.chunks_exact_mut(4) {
            p.copy_from_slice(&[255, 0, 0, 255]);
        }
        d.layer_mut().mask = Some(vec![255, 0, 128, 255, 255, 255, 255, 255].into());
        let f = d.flatten();
        assert_eq!(&f[0..3], &[255, 0, 0], "masque blanc : calque visible");
        assert_eq!(&f[4..7], &[0, 0, 255], "masque noir : dessous visible");
        assert!(f[8] > 100 && f[8] < 160 && f[10] > 100, "masque gris : mélange");
        d.rotate90(true);
        assert_eq!(d.layers[1].mask.as_ref().unwrap().len(), 8);
    }

    /// Banc d'essai (cargo test --release -p masterpaint-ui bench_stroke -- --ignored --nocapture) :
    /// trait de pinceau sur 4000×3000 à 3 calques, coût par mouvement et par validation.
    #[test]
    #[ignore]
    fn bench_stroke() {
        let (w, h) = (4000, 3000);
        let mut d = Doc::new(w, h, [255, 255, 255, 255], "bench");
        d.add_layer();
        d.add_layer();
        let mut display = vec![0u8; w * h * 4];
        let o = Opts { size: 30.0, ..Default::default() };
        let mut s = Session::default();
        let t = std::time::Instant::now();
        let mut work = 0usize;
        s.press(Tool::Brush, &mut d, &o, 100.0, 100.0, false, false, false);
        for k in 0..200 {
            let (x, y) = (100.0 + k as f32 * 15.0, 100.0 + k as f32 * 10.0);
            if let Outcome::Redraw(Some((x0, y0, x1, y1))) = s.moved(Tool::Brush, &mut d, &o, x, y, false) {
                d.composite_rect(&mut display, x0, y0, x1, y1, true);
                work += (x1 - x0) * (y1 - y0);
            }
        }
        let per_move = t.elapsed().as_secs_f64() * 1000.0 / 200.0;
        s.release(Tool::Brush, &mut d);
        let t = std::time::Instant::now();
        for _ in 0..10 {
            d.layer_mut().px[0] ^= 1;
            d.commit("bench");
        }
        let per_commit = t.elapsed().as_secs_f64() * 1000.0 / 10.0;
        let t = std::time::Instant::now();
        d.composite_rect(&mut display, 0, 0, w, h, true);
        let full = t.elapsed().as_secs_f64() * 1000.0;
        println!("mouvement : {per_move:.2} ms ({} px recomposés en moyenne) | validation : {per_commit:.2} ms | composition entière : {full:.1} ms", work / 200);
    }
    use crate::editor::{Blend, Doc, SelMode};

    fn white(w: usize, h: usize) -> Doc {
        Doc::new(w, h, [255, 255, 255, 255], "test")
    }

    fn px(d: &Doc, x: usize, y: usize) -> [u8; 4] {
        let i = (y * d.w + x) * 4;
        let p = &d.layer().px;
        [p[i], p[i + 1], p[i + 2], p[i + 3]]
    }

    fn drag(s: &mut Session, t: Tool, d: &mut Doc, o: &Opts, pts: &[(f32, f32)]) -> Outcome {
        s.press(t, d, o, pts[0].0, pts[0].1, false, false, false);
        for p in &pts[1..] {
            s.moved(t, d, o, p.0, p.1, false);
        }
        s.release(t, d)
    }

    #[test]
    fn brush_stroke_paints_and_commits() {
        let mut d = white(64, 64);
        let mut o = Opts::default();
        o.size = 6.0;
        o.primary = [255, 0, 0, 255];
        let mut s = Session::default();
        let out = drag(&mut s, Tool::Brush, &mut d, &o, &[(10.0, 10.0), (50.0, 10.0)]);
        assert!(matches!(out, Outcome::Commit("Pinceau")));
        assert_eq!(px(&d, 30, 10), [255, 0, 0, 255]);
        assert_eq!(px(&d, 30, 30), [255, 255, 255, 255]);
    }

    #[test]
    fn symmetry_mirrors_the_stroke() {
        let mut d = white(64, 64);
        let mut o = Opts::default();
        o.size = 4.0;
        o.sym_x = true;
        o.primary = [0, 0, 255, 255];
        let mut s = Session::default();
        drag(&mut s, Tool::Brush, &mut d, &o, &[(10.0, 20.0), (12.0, 20.0)]);
        assert_eq!(px(&d, 11, 20), [0, 0, 255, 255]);
        assert_eq!(px(&d, 53, 20), [0, 0, 255, 255]);
    }

    #[test]
    fn eraser_and_selection_clip() {
        let mut d = white(32, 32);
        let mut m = vec![0u8; 32 * 32];
        for y in 0..32 {
            for x in 0..16 {
                m[y * 32 + x] = 255;
            }
        }
        d.sel = Some(m);
        let mut o = Opts::default();
        o.size = 10.0;
        let mut s = Session::default();
        drag(&mut s, Tool::Eraser, &mut d, &o, &[(5.0, 16.0), (28.0, 16.0)]);
        assert_eq!(px(&d, 8, 16)[3], 0, "gommé dans la sélection");
        assert_eq!(px(&d, 24, 16)[3], 255, "intact hors sélection");
    }

    #[test]
    fn fill_and_wand() {
        let mut d = white(40, 40);
        for y in 0..40 {
            let i = (y * 40 + 20) * 4;
            d.layer_mut().px[i..i + 4].copy_from_slice(&[0, 0, 0, 255]);
        }
        let mut o = Opts::default();
        o.primary = [0, 200, 0, 255];
        o.tolerance = 0.0;
        let mut s = Session::default();
        let out = s.press(Tool::Fill, &mut d, &o, 5.0, 5.0, false, false, false);
        assert!(matches!(out, Outcome::Commit(_)));
        assert_eq!(px(&d, 10, 30), [0, 200, 0, 255]);
        assert_eq!(px(&d, 30, 30), [255, 255, 255, 255], "le trait noir bloque le remplissage contigu");
        s.press(Tool::Wand, &mut d, &o, 30.0, 5.0, false, false, false);
        let (x0, _, x1, _) = d.selection_bounds().unwrap();
        assert_eq!((x0, x1), (21, 40));
    }

    #[test]
    fn shapes_gradient_and_rect_selection() {
        let mut d = white(60, 60);
        let mut o = Opts::default();
        o.style = crate::paint::ShapeStyle::Fill;
        o.shape_kind = "ellipse".into();
        o.primary = [10, 20, 30, 255];
        let mut s = Session::default();
        drag(&mut s, Tool::Shape, &mut d, &o, &[(10.0, 10.0), (30.0, 30.0), (50.0, 50.0)]);
        assert_eq!(px(&d, 30, 30), [10, 20, 30, 255]);
        assert_eq!(px(&d, 11, 11), [255, 255, 255, 255], "coin hors de l'ellipse");
        drag(&mut s, Tool::RectSelect, &mut d, &o, &[(0.0, 0.0), (20.0, 20.0)]);
        assert_eq!(d.selection_bounds(), Some((0, 0, 20, 20)));
        o.secondary = [255, 255, 255, 255];
        o.primary = [0, 0, 0, 255];
        drag(&mut s, Tool::Gradient, &mut d, &o, &[(0.0, 0.0), (20.0, 0.0)]);
        assert!(px(&d, 1, 5)[0] < 30 && px(&d, 18, 5)[0] > 220, "dégradé noir → blanc");
        assert_eq!(px(&d, 30, 30), [10, 20, 30, 255], "hors sélection : inchangé");
    }

    #[test]
    fn move_selection_and_history() {
        let mut d = white(30, 30);
        let i = (5 * 30 + 5) * 4;
        d.layer_mut().px[i..i + 4].copy_from_slice(&[255, 0, 0, 255]);
        d.commit("point");
        let mut m = vec![0u8; 900];
        m[5 * 30 + 5] = 255;
        d.apply_selection(m, SelMode::Replace);
        let o = Opts::default();
        let mut s = Session::default();
        drag(&mut s, Tool::Move, &mut d, &o, &[(5.0, 5.0), (15.0, 5.0)]);
        d.commit("déplacer");
        assert_eq!(px(&d, 15, 5), [255, 0, 0, 255]);
        assert_eq!(px(&d, 5, 5)[3], 0);
        d.undo();
        assert_eq!(px(&d, 5, 5), [255, 0, 0, 255]);
        d.redo();
        assert_eq!(px(&d, 15, 5), [255, 0, 0, 255]);
    }

    #[test]
    fn layers_blend_and_merge() {
        let mut d = Doc::new(4, 4, [200, 100, 50, 255], "t");
        d.add_layer();
        for p in d.layer_mut().px.chunks_exact_mut(4) {
            p.copy_from_slice(&[128, 128, 128, 255]);
        }
        d.layer_mut().blend = Blend::Multiply;
        let f = d.flatten();
        assert_eq!(&f[0..4], &[100, 50, 25, 255]);
        d.merge_down();
        assert_eq!(d.layers.len(), 1);
        assert_eq!(&d.layer().px[0..4], &[100, 50, 25, 255]);
    }

    #[test]
    fn content_fill_cutout_and_layer_bounds() {
        let mut d = Doc::new(30, 30, [200, 50, 50, 255], "t");
        let mut m = vec![0u8; 900];
        for y in 10..20 {
            for x in 10..20 {
                m[y * 30 + x] = 255;
                d.layer_mut().px[(y * 30 + x) * 4..(y * 30 + x) * 4 + 4].copy_from_slice(&[0, 0, 255, 255]);
            }
        }
        // remplissage : le trou bleu est reconstitué à partir du rouge qui l'entoure
        d.sel = Some(m.clone());
        assert!(d.content_aware_fill());
        let c = &d.layer().px[(15 * 30 + 15) * 4..(15 * 30 + 15) * 4 + 4];
        assert!(c[0] > 150 && c[2] < 100 && c[3] == 255, "trou rempli : {c:?}");
        // détourage : hors sélection transparent, dedans intact
        d.sel = Some(m);
        assert!(d.cutout_outside_selection());
        assert_eq!(d.layer().px[3], 0);
        assert_eq!(d.layer().px[(15 * 30 + 15) * 4 + 3], 255);
        // emprise, puis contenu reposé à moitié hors de la toile (Hors toile)
        assert_eq!(d.layer_content_bounds(0), Some((10, 10, 10, 10)));
        d.place_layer_content(0, 25, 25, 10, 10, &vec![255u8; 400], true);
        assert!(d.layer().off.is_some());
        assert_eq!(d.layer_content_bounds(0), Some((25, 25, 10, 10)));
    }
}
