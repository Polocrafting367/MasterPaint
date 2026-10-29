//! Transformation des pixels sélectionnés, comme les outils Déplacer de Paint.NET
//! (MoveToolBase : poignées, rotation, mise à l'échelle) — plus Déformation et 4 coins.
//!
//! Le contenu est « soulevé » une fois (pixels + masque de la sélection) puis redessiné à
//! chaque mouvement depuis l'original : aucune perte de qualité d'un déplacement à l'autre.
//! Toutes les transformations sont décrites par le quadrilatère d'arrivée des quatre coins
//! du cadre soulevé (homographie) : déplacement, échelle, rotation, déformation, 4 coins.

use crate::editor::Doc;
use masterpaint_core::util::{homography, invert3x3};

pub type Pt = (f32, f32);

/// Poignée saisie au clic.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Grab {
    Translate,
    Rotate,
    /// côté ou coin (0 haut-gauche, 1 haut, 2 haut-droite, 3 droite, 4 bas-droite, 5 bas, 6 bas-gauche, 7 gauche)
    Edge(u8),
    /// coin libre (4 coins) : 0 HG, 1 HD, 2 BD, 3 BG
    Corner(u8),
}

/// Variante d'outil.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
    /// Déplacer les pixels sélectionnés (Paint.NET) : déplacement, échelle, rotation
    MovePixels,
    /// Déplacer la sélection seule (contour)
    MoveSelection,
    /// Déformation : 8 poignées + centre, sans rotation
    Deform,
    /// 4 coins libres (homographie)
    Warp,
}

/// Contenu soulevé et son placement courant.
pub struct Floating {
    pub kind: Kind,
    /// pixels soulevés (cadre de la sélection), masqués par la sélection
    src: Vec<u8>,
    mask: Vec<u8>,
    pub sw: usize,
    pub sh: usize,
    /// calque sans le contenu soulevé (trou transparent)
    base: crate::editor::Px,
    /// angle (radians) et facteurs d'échelle pour Déplacer / Déformation
    pub angle: f32,
    pub sx: f32,
    pub sy: f32,
    /// centre du contenu dans le document
    pub cx: f32,
    pub cy: f32,
    /// coins libres (4 coins) ; sinon calculés depuis angle/échelle/centre
    pub quad: Option<[Pt; 4]>,
    /// zone dessinée au rendu précédent (au départ : le cadre de la sélection soulevée) :
    /// seule elle et la nouvelle sont recalculées à chaque mouvement
    last: std::sync::Mutex<Option<(usize, usize, usize, usize)>>,
    /// « Hors toile » : contenu du dehors resté en place (non soulevé), auquel s'ajoute ce qui
    /// dépasse de la toile au relâchement (voir `write_outside`)
    off_base: Option<crate::editor::Off>,
}

impl Floating {
    /// Soulève la sélection du calque actif (tout le calque s'il n'y a pas de sélection).
    /// `outside` (option « Hors toile ») : le calque entier est soulevé avec son contenu hors de
    /// la toile, qui revient quand on le ramène.
    pub fn lift(doc: &mut Doc, kind: Kind, outside: bool) -> Option<Floating> {
        let whole = doc.sel.as_ref().map_or(true, |m| m.iter().all(|v| *v == 255));
        if outside && whole && kind != Kind::MoveSelection && doc.layer().off.is_some() {
            return Some(Floating::lift_with_outside(doc, kind));
        }
        if doc.sel.is_none() {
            doc.select_all();
        }
        let (x0, y0, x1, y1) = doc.selection_bounds()?;
        let (w, sw, sh) = (doc.w, x1 - x0, y1 - y0);
        let m = doc.sel.clone()?;
        let lay = &doc.layer().px;
        let mut src = vec![0u8; sw * sh * 4];
        let mut mask = vec![0u8; sw * sh];
        // lignes recopiées d'un bloc (grandes images : des dizaines de Mo)
        for y in 0..sh {
            let di = (y0 + y) * w + x0;
            let o = y * sw;
            mask[o..o + sw].copy_from_slice(&m[di..di + sw]);
            if kind != Kind::MoveSelection {
                src[o * 4..(o + sw) * 4].copy_from_slice(&lay[di * 4..(di + sw) * 4]);
            }
        }
        let mut base = lay.clone();
        if kind != Kind::MoveSelection {
            for (px, s) in base.chunks_exact_mut(4).zip(m.iter()) {
                match *s {
                    0 => {}
                    255 => px[3] = 0,
                    s => px[3] = (px[3] as u32 * (255 - s as u32) / 255) as u8,
                }
            }
        }
        Some(Floating {
            kind,
            src,
            mask,
            sw,
            sh,
            base,
            angle: 0.0,
            sx: 1.0,
            sy: 1.0,
            cx: x0 as f32 + sw as f32 / 2.0,
            cy: y0 as f32 + sh as f32 / 2.0,
            last: std::sync::Mutex::new(Some((x0, y0, x1, y1))),
            quad: None,
            off_base: doc.layer().off.clone(),
        })
    }

    /// Calque entier soulevé avec son contenu hors toile (cadre = toile ∪ dehors).
    fn lift_with_outside(doc: &mut Doc, kind: Kind) -> Floating {
        let (ux, uy, uw, uh, src) = doc.layer_full(doc.active);
        let (w, h) = (doc.w, doc.h);
        doc.select_all();
        let a = doc.active;
        doc.layers[a].off = None;
        Floating {
            kind,
            src,
            mask: vec![255; uw * uh],
            sw: uw,
            sh: uh,
            base: vec![0u8; w * h * 4].into(),
            angle: 0.0,
            sx: 1.0,
            sy: 1.0,
            cx: ux as f32 + uw as f32 / 2.0,
            cy: uy as f32 + uh as f32 / 2.0,
            last: std::sync::Mutex::new(None),
            quad: None,
            off_base: None,
        }
    }

    /// « Hors toile » : ce qui dépasse de la toile après transformation est gardé dans le
    /// calque (au lieu d'être perdu), avec le contenu du dehors resté en place.
    pub fn write_outside(&self, doc: &mut Doc) {
        if self.kind == Kind::MoveSelection {
            return;
        }
        let (w, h) = (doc.w as isize, doc.h as isize);
        let q = self.corners();
        let (mut bx0, mut by0, mut bx1, mut by1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        for p in q {
            bx0 = bx0.min(p.0);
            by0 = by0.min(p.1);
            bx1 = bx1.max(p.0);
            by1 = by1.max(p.1);
        }
        let (qx0, qy0, qx1, qy1) = (bx0.floor() as isize - 1, by0.floor() as isize - 1, bx1.ceil() as isize + 1, by1.ceil() as isize + 1);
        let a = doc.active;
        if qx0 >= 0 && qy0 >= 0 && qx1 <= w && qy1 <= h {
            doc.layers[a].off = self.off_base.clone();
            return;
        }
        let src_pts = [[0.0, 0.0], [self.sw as f64, 0.0], [self.sw as f64, self.sh as f64], [0.0, self.sh as f64]];
        let dst_pts = q.map(|p| [p.0 as f64, p.1 as f64]);
        let Some(inv) = homography(&src_pts, &dst_pts).and_then(|hm| invert3x3(&hm)) else { return };
        // cadre du résultat : dehors existant ∪ cadre transformé
        let (mut x0, mut y0, mut x1, mut y1) = (qx0, qy0, qx1, qy1);
        if let Some(o) = &self.off_base {
            x0 = x0.min(o.x);
            y0 = y0.min(o.y);
            x1 = x1.max(o.x + o.w as isize);
            y1 = y1.max(o.y + o.h as isize);
        }
        let (ow, oh) = ((x1 - x0) as usize, (y1 - y0) as usize);
        let mut px = vec![0u8; ow * oh * 4];
        if let Some(o) = &self.off_base {
            for y in 0..o.h {
                let d = ((o.y - y0) as usize + y) * ow + (o.x - x0) as usize;
                px[d * 4..(d + o.w) * 4].copy_from_slice(&o.px[y * o.w * 4..(y + 1) * o.w * 4]);
            }
        }
        let (sw, sh) = (self.sw as f64, self.sh as f64);
        let mut any = self.off_base.is_some();
        for y in qy0..qy1 {
            for x in qx0..qx1 {
                if x >= 0 && y >= 0 && x < w && y < h {
                    continue; // sur la toile : déjà dans le calque
                }
                let (fx, fy) = (x as f64 + 0.5, y as f64 + 0.5);
                let d = inv[6] * fx + inv[7] * fy + inv[8];
                if d.abs() < 1e-12 {
                    continue;
                }
                let u = (inv[0] * fx + inv[1] * fy + inv[2]) / d;
                let v = (inv[3] * fx + inv[4] * fy + inv[5]) / d;
                if u < -0.5 || v < -0.5 || u > sw + 0.5 || v > sh + 0.5 {
                    continue;
                }
                let (m, c) = self.sample(u - 0.5, v - 0.5);
                if m <= 0.0 || c[3] <= 0.0 {
                    continue;
                }
                let o = (((y - y0) as usize) * ow + (x - x0) as usize) * 4;
                let sa = c[3] / 255.0;
                let da = px[o + 3] as f32 / 255.0;
                let ao = sa + da * (1.0 - sa);
                for k in 0..3 {
                    px[o + k] = ((c[k] * sa + px[o + k] as f32 * da * (1.0 - sa)) / ao + 0.5) as u8;
                }
                px[o + 3] = (ao * 255.0 + 0.5) as u8;
                any = true;
            }
        }
        doc.layers[a].off = if any { Some(crate::editor::Off { x: x0, y: y0, w: ow, h: oh, px: px.into() }) } else { None };
    }

    /// Pixels collés dans le calque actif (Paint.NET) : flottants au-dessus du calque, en
    /// (x, y) ; le calque dessous reste intact tant qu'ils ne sont pas reposés.
    pub fn pasted(doc: &Doc, x: isize, y: isize, cw: usize, ch: usize, px: &[u8]) -> Floating {
        Floating {
            kind: Kind::MovePixels,
            src: px.to_vec(),
            mask: vec![255; cw * ch],
            sw: cw,
            sh: ch,
            base: doc.layer().px.clone(),
            angle: 0.0,
            sx: 1.0,
            sy: 1.0,
            cx: x as f32 + cw as f32 / 2.0,
            cy: y as f32 + ch as f32 / 2.0,
            last: std::sync::Mutex::new(None),
            quad: None,
            off_base: doc.layer().off.clone(),
        }
    }

    /// Quatre coins d'arrivée : haut-gauche, haut-droite, bas-droite, bas-gauche.
    pub fn corners(&self) -> [Pt; 4] {
        if let Some(q) = self.quad {
            return q;
        }
        let (hw, hh) = (self.sw as f32 * self.sx / 2.0, self.sh as f32 * self.sy / 2.0);
        let (c, s) = (self.angle.cos(), self.angle.sin());
        let p = |lx: f32, ly: f32| (self.cx + lx * c - ly * s, self.cy + lx * s + ly * c);
        [p(-hw, -hh), p(hw, -hh), p(hw, hh), p(-hw, hh)]
    }

    /// Poignées affichées : (position, rond ?). Déplacer : 8 poignées (coins ronds) ;
    /// Déformation : 8 + centre ; 4 coins : 4.
    pub fn handles(&self) -> Vec<(Pt, bool)> {
        let q = self.corners();
        let mid = |a: Pt, b: Pt| ((a.0 + b.0) / 2.0, (a.1 + b.1) / 2.0);
        match self.kind {
            Kind::Warp => q.iter().map(|p| (*p, false)).collect(),
            _ => {
                let mut v = vec![
                    (q[0], true),
                    (mid(q[0], q[1]), false),
                    (q[1], true),
                    (mid(q[1], q[2]), false),
                    (q[2], true),
                    (mid(q[2], q[3]), false),
                    (q[3], true),
                    (mid(q[3], q[0]), false),
                ];
                if self.kind == Kind::Deform {
                    v.push(((self.cx, self.cy), false));
                }
                v
            }
        }
    }

    /// Ce que saisit un clic en (x, y) ; `tol` = tolérance en pixels du document
    /// (poignées), `rot` = largeur de la zone de rotation autour du cadre.
    pub fn hit(&self, x: f32, y: f32, tol: f32, rot: f32, right_button: bool) -> Grab {
        if right_button && self.kind == Kind::MovePixels {
            return Grab::Rotate;
        }
        let d = |p: Pt| ((p.0 - x).powi(2) + (p.1 - y).powi(2)).sqrt();
        if self.kind == Kind::Warp {
            if let Some((i, _)) = self.corners().iter().enumerate().map(|(i, p)| (i, d(*p))).filter(|(_, dd)| *dd <= tol).min_by(|a, b| a.1.total_cmp(&b.1)) {
                return Grab::Corner(i as u8);
            }
            return Grab::Translate;
        }
        let hs = self.handles();
        if let Some((i, _)) = hs.iter().take(8).enumerate().map(|(i, h)| (i, d(h.0))).filter(|(_, dd)| *dd <= tol).min_by(|a, b| a.1.total_cmp(&b.1)) {
            return Grab::Edge(i as u8);
        }
        if self.kind == Kind::MovePixels || self.kind == Kind::MoveSelection {
            let q = self.corners();
            if !inside(&q, (x, y)) {
                let e = (0..4).map(|i| seg_dist((x, y), q[i], q[(i + 1) % 4])).fold(f32::MAX, f32::min);
                if e <= rot {
                    return Grab::Rotate;
                }
            }
        }
        Grab::Translate
    }

    /// Applique un glisser depuis l'état `start` (copie prise au clic).
    pub fn drag(&mut self, start: &Floating, grab: Grab, from: Pt, to: Pt, shift: bool, alt: bool) {
        let (dx, dy) = (to.0 - from.0, to.1 - from.1);
        match grab {
            Grab::Translate => {
                let (dx, dy) = (dx.round(), dy.round());
                self.cx = start.cx + dx;
                self.cy = start.cy + dy;
                self.quad = start.quad.map(|q| q.map(|p| (p.0 + dx, p.1 + dy)));
            }
            Grab::Rotate => {
                let a0 = (from.1 - start.cy).atan2(from.0 - start.cx);
                let a1 = (to.1 - start.cy).atan2(to.0 - start.cx);
                let mut a = start.angle + (a1 - a0);
                if shift {
                    // paliers de 15° (Maj), comme Paint.NET
                    let st = 15f32.to_radians();
                    a = (a / st).round() * st;
                }
                self.angle = a;
            }
            Grab::Edge(e) => {
                // axes locaux (le contenu peut être tourné)
                let (c, s) = (start.angle.cos(), start.angle.sin());
                let lx = dx * c + dy * s;
                let ly = -dx * s + dy * c;
                let (ex, ey): (f32, f32) = match e {
                    0 => (-1.0, -1.0),
                    1 => (0.0, -1.0),
                    2 => (1.0, -1.0),
                    3 => (1.0, 0.0),
                    4 => (1.0, 1.0),
                    5 => (0.0, 1.0),
                    6 => (-1.0, 1.0),
                    _ => (-1.0, 0.0),
                };
                let w0 = start.sw as f32 * start.sx;
                let h0 = start.sh as f32 * start.sy;
                let k = if alt { 2.0 } else { 1.0 };
                let mut nw = (w0 + ex * lx.round() * k).max(1.0);
                let mut nh = (h0 + ey * ly.round() * k).max(1.0);
                if shift {
                    // proportions conservées (Maj)
                    let r = if ex == 0.0 {
                        nh / h0
                    } else if ey == 0.0 {
                        nw / w0
                    } else {
                        (nw / w0).min(nh / h0)
                    };
                    nw = w0 * r;
                    nh = h0 * r;
                }
                self.sx = nw / start.sw as f32;
                self.sy = nh / start.sh as f32;
                if alt {
                    self.cx = start.cx;
                    self.cy = start.cy;
                } else {
                    // le bord opposé reste fixe : le centre se déplace de la moitié du changement
                    let (mx, my) = (ex * (nw - w0) / 2.0, ey * (nh - h0) / 2.0);
                    self.cx = start.cx + mx * c - my * s;
                    self.cy = start.cy + mx * s + my * c;
                }
            }
            Grab::Corner(i) => {
                let mut q = start.corners();
                if shift {
                    // homothétie depuis le centre (Maj)
                    let c = ((q[0].0 + q[2].0) / 2.0, (q[0].1 + q[2].1) / 2.0);
                    let d0 = ((q[i as usize].0 - c.0).powi(2) + (q[i as usize].1 - c.1).powi(2)).sqrt().max(1.0);
                    let d1 = ((to.0 - c.0).powi(2) + (to.1 - c.1).powi(2)).sqrt();
                    let r = d1 / d0;
                    for p in q.iter_mut() {
                        *p = (c.0 + (p.0 - c.0) * r, c.1 + (p.1 - c.1) * r);
                    }
                } else {
                    q[i as usize] = (start.corners()[i as usize].0 + dx, start.corners()[i as usize].1 + dy);
                }
                self.quad = Some(q);
            }
        }
    }

    /// Copie de l'état (au clic) pour calculer les glisser.
    pub fn snapshot(&self) -> Floating {
        Floating {
            kind: self.kind,
            src: Vec::new(),
            mask: Vec::new(),
            sw: self.sw,
            sh: self.sh,
            base: Default::default(),
            angle: self.angle,
            sx: self.sx,
            sy: self.sy,
            cx: self.cx,
            cy: self.cy,
            quad: self.quad,
            last: std::sync::Mutex::new(None),
            off_base: None,
        }
    }

    /// Dessine le contenu transformé sur le calque actif et transforme la sélection.
    /// Retourne le rectangle modifié.
    pub fn render(&self, doc: &mut Doc) -> Option<(usize, usize, usize, usize)> {
        let (w, h) = (doc.w, doc.h);
        let q = self.corners();
        let src_pts = [[0.0, 0.0], [self.sw as f64, 0.0], [self.sw as f64, self.sh as f64], [0.0, self.sh as f64]];
        let dst_pts = q.map(|p| [p.0 as f64, p.1 as f64]);
        let hm = homography(&src_pts, &dst_pts)?;
        let inv = invert3x3(&hm)?;
        let (mut bx0, mut by0, mut bx1, mut by1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        for p in q {
            bx0 = bx0.min(p.0);
            by0 = by0.min(p.1);
            bx1 = bx1.max(p.0);
            by1 = by1.max(p.1);
        }
        let x0 = (bx0.floor() as isize - 1).clamp(0, w as isize) as usize;
        let y0 = (by0.floor() as isize - 1).clamp(0, h as isize) as usize;
        let x1 = (bx1.ceil() as isize + 1).clamp(0, w as isize) as usize;
        let y1 = (by1.ceil() as isize + 1).clamp(0, h as isize) as usize;

        // zone à refaire : l'ancien cadre (à effacer) et le nouveau
        let prev = self.last.lock().ok().and_then(|g| *g);
        let (dx0, dy0, dx1, dy1) = match prev {
            Some((a, b, c, d)) => (a.min(x0), b.min(y0), c.max(x1), d.max(y1)),
            None => (0, 0, w, h),
        };
        let mut sel = match doc.sel.take() {
            Some(m) if m.len() == w * h => m,
            _ => vec![0u8; w * h],
        };
        let a = doc.active;
        let lay: &mut [u8] = &mut doc.layers[a].px;
        for y in dy0..dy1 {
            let (r0, r1) = (y * w + dx0, y * w + dx1);
            sel[r0..r1].fill(0);
            if self.kind != Kind::MoveSelection {
                lay[r0 * 4..r1 * 4].copy_from_slice(&self.base[r0 * 4..r1 * 4]);
            }
        }
        // nouveau contenu, ligne par ligne (bandes réparties sur les cœurs sur le bureau)
        let (sw, sh) = (self.sw as f64, self.sh as f64);
        let move_sel = self.kind == Kind::MoveSelection;
        let row = |y: usize, lrow: &mut [u8], srow: &mut [u8]| {
            for x in x0..x1 {
                let (px, py) = (x as f64 + 0.5, y as f64 + 0.5);
                let d = inv[6] * px + inv[7] * py + inv[8];
                if d.abs() < 1e-12 {
                    continue;
                }
                let u = (inv[0] * px + inv[1] * py + inv[2]) / d;
                let v = (inv[3] * px + inv[4] * py + inv[5]) / d;
                if u < -0.5 || v < -0.5 || u > sw + 0.5 || v > sh + 0.5 {
                    continue;
                }
                let (m, c) = self.sample(u - 0.5, v - 0.5);
                if m <= 0.0 {
                    continue;
                }
                srow[x] = (m * 255.0 + 0.5) as u8;
                if move_sel {
                    continue;
                }
                // contenu « par-dessus » le calque troué
                let o = x * 4;
                let sa = c[3] / 255.0;
                let da = lrow[o + 3] as f32 / 255.0;
                let ao = sa + da * (1.0 - sa);
                if ao <= 0.0 {
                    continue;
                }
                for k in 0..3 {
                    lrow[o + k] = ((c[k] * sa + lrow[o + k] as f32 * da * (1.0 - sa)) / ao + 0.5) as u8;
                }
                lrow[o + 3] = (ao * 255.0 + 0.5) as u8;
            }
        };
        if y1 > y0 && x1 > x0 {
            let lrows = &mut lay[y0 * w * 4..y1 * w * 4];
            let srows = &mut sel[y0 * w..y1 * w];
            #[cfg(not(target_arch = "wasm32"))]
            {
                let n = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
                let band = (y1 - y0).div_ceil(n.max(1)).max(16);
                std::thread::scope(|sc| {
                    for (k, (lb, sb)) in lrows.chunks_mut(band * w * 4).zip(srows.chunks_mut(band * w)).enumerate() {
                        let row = &row;
                        sc.spawn(move || {
                            for (j, (lr, sr)) in lb.chunks_mut(w * 4).zip(sb.chunks_mut(w)).enumerate() {
                                row(y0 + k * band + j, lr, sr);
                            }
                        });
                    }
                });
            }
            #[cfg(target_arch = "wasm32")]
            for (j, (lr, sr)) in lrows.chunks_mut(w * 4).zip(srows.chunks_mut(w)).enumerate() {
                row(y0 + j, lr, sr);
            }
        }
        doc.sel = Some(sel);
        if let Ok(mut g) = self.last.lock() {
            *g = Some((x0, y0, x1, y1));
        }
        Some((dx0, dy0, dx1, dy1))
    }

    /// Échantillon bilinéaire : (couverture du masque 0..1, couleur RGBA prémultipliée par le masque).
    fn sample(&self, u: f64, v: f64) -> (f32, [f32; 4]) {
        let (sw, sh) = (self.sw as isize, self.sh as isize);
        let (x0, y0) = (u.floor() as isize, v.floor() as isize);
        let (fx, fy) = ((u - x0 as f64) as f32, (v - y0 as f64) as f32);
        let mut m = 0.0f32;
        let mut acc = [0f32; 4];
        let mut wa = 0.0f32;
        for (dx, dy, wt) in [(0, 0, (1.0 - fx) * (1.0 - fy)), (1, 0, fx * (1.0 - fy)), (0, 1, (1.0 - fx) * fy), (1, 1, fx * fy)] {
            let (xx, yy) = (x0 + dx, y0 + dy);
            if xx < 0 || yy < 0 || xx >= sw || yy >= sh || wt <= 0.0 {
                continue;
            }
            let o = yy as usize * self.sw + xx as usize;
            let mv = self.mask[o] as f32 / 255.0;
            m += mv * wt;
            if self.kind != Kind::MoveSelection {
                let a = self.src[o * 4 + 3] as f32 / 255.0 * mv * wt;
                for k in 0..3 {
                    acc[k] += self.src[o * 4 + k] as f32 * a;
                }
                wa += a;
            }
        }
        let mut c = [0f32; 4];
        if wa > 0.0 {
            for k in 0..3 {
                c[k] = acc[k] / wa;
            }
            c[3] = wa * 255.0;
        }
        (m, c)
    }

    /// Le point est-il dans le cadre transformé ?
    pub fn contains(&self, x: f32, y: f32) -> bool {
        inside(&self.corners(), (x, y))
    }

    /// Contour du cadre transformé (chemin SVG en coordonnées document).
    pub fn outline_path(&self) -> String {
        let q = self.corners();
        format!("M {} {} L {} {} L {} {} L {} {} Z", q[0].0, q[0].1, q[1].0, q[1].1, q[2].0, q[2].1, q[3].0, q[3].1)
    }
}

fn seg_dist(p: Pt, a: Pt, b: Pt) -> f32 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l2 = dx * dx + dy * dy;
    let t = if l2 > 0.0 { (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / l2).clamp(0.0, 1.0) } else { 0.0 };
    ((a.0 + dx * t - p.0).powi(2) + (a.1 + dy * t - p.1).powi(2)).sqrt()
}

fn inside(q: &[Pt; 4], p: Pt) -> bool {
    let mut sign = 0.0f32;
    for i in 0..4 {
        let (a, b) = (q[i], q[(i + 1) % 4]);
        let cross = (b.0 - a.0) * (p.1 - a.1) - (b.1 - a.1) * (p.0 - a.0);
        if cross.abs() < 1e-6 {
            continue;
        }
        if sign != 0.0 && cross.signum() != sign {
            return false;
        }
        sign = cross.signum();
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::editor::Doc;

    fn red_square() -> Doc {
        let mut d = Doc::new(40, 40, [0, 0, 0, 0], "t");
        let mut m = vec![0u8; 1600];
        for y in 10..20 {
            for x in 10..20 {
                let i = (y * 40 + x) * 4;
                d.layer_mut().px[i..i + 4].copy_from_slice(&[255, 0, 0, 255]);
                m[y * 40 + x] = 255;
            }
        }
        d.sel = Some(m);
        d
    }

    #[test]
    fn outside_canvas_round_trip() {
        // calque entier (sans sélection) poussé à moitié hors de la toile puis ramené
        let mut d = red_square();
        d.sel = None;
        let mut f = Floating::lift(&mut d, Kind::MovePixels, true).unwrap();
        let s = f.snapshot();
        f.drag(&s, Grab::Translate, (0.0, 0.0), (30.0, 0.0), false, false);
        f.render(&mut d);
        f.write_outside(&mut d);
        let o = d.layer().off.clone().expect("contenu hors toile gardé");
        assert!(o.x + o.w as isize > 40, "le dehors déborde à droite");
        // soulevé de nouveau avec son dehors, puis ramené : le carré revient sur la toile
        d.sel = None;
        let mut f = Floating::lift(&mut d, Kind::MovePixels, true).unwrap();
        assert!(d.layer().off.is_none(), "dehors soulevé avec le calque");
        let s = f.snapshot();
        f.drag(&s, Grab::Translate, (0.0, 0.0), (-30.0, 0.0), false, false);
        f.render(&mut d);
        f.write_outside(&mut d);
        assert_eq!(d.layer().px[(15 * 40 + 15) * 4], 255, "carré revenu à sa place");
        assert_eq!(d.layer().px[(15 * 40 + 15) * 4 + 3], 255);
        // sans l'option, ce qui sort est perdu (comportement Paint.NET)
        let mut d = red_square();
        d.sel = None;
        let mut f = Floating::lift(&mut d, Kind::MovePixels, false).unwrap();
        let s = f.snapshot();
        f.drag(&s, Grab::Translate, (0.0, 0.0), (30.0, 0.0), false, false);
        f.render(&mut d);
        assert!(d.layer().off.is_none());
    }

    #[test]
    fn translate_scale_rotate_keep_content() {
        let mut d = red_square();
        let mut f = Floating::lift(&mut d, Kind::MovePixels, false).unwrap();
        assert_eq!((f.sw, f.sh), (10, 10));
        let s = f.snapshot();
        f.drag(&s, Grab::Translate, (15.0, 15.0), (25.0, 20.0), false, false);
        f.render(&mut d);
        assert_eq!(d.layer().px[(20 * 40 + 25) * 4], 255, "carré déplacé (x 20..30, y 15..25)");
        assert_eq!(d.layer().px[(15 * 40 + 15) * 4 + 3], 0, "ancien emplacement vidé");
        // poignée bas-droite : agrandit, le coin haut-gauche reste fixe
        let s = f.snapshot();
        let tl = f.corners()[0];
        f.drag(&s, Grab::Edge(4), (30.0, 30.0), (35.0, 35.0), false, false);
        assert!((f.corners()[0].0 - tl.0).abs() < 0.01 && (f.corners()[0].1 - tl.1).abs() < 0.01);
        assert!((f.sx - 1.5).abs() < 0.01);
        // rotation 90° autour du centre
        let s = f.snapshot();
        f.drag(&s, Grab::Rotate, (f.cx + 10.0, f.cy), (f.cx, f.cy + 10.0), false, false);
        assert!((f.angle - std::f32::consts::FRAC_PI_2).abs() < 0.01);
        f.render(&mut d);
        let (x0, y0, x1, y1) = d.selection_bounds().unwrap();
        assert!(x1 - x0 >= 14 && y1 - y0 >= 14, "sélection suivie : {x0},{y0},{x1},{y1}");
    }

    #[test]
    fn hit_testing_like_paint_net() {
        let mut d = red_square();
        let f = Floating::lift(&mut d, Kind::MovePixels, false).unwrap();
        assert_eq!(f.hit(10.0, 10.0, 2.0, 6.0, false), Grab::Edge(0));
        assert_eq!(f.hit(15.0, 15.0, 2.0, 6.0, false), Grab::Translate);
        assert_eq!(f.hit(25.0, 15.0, 2.0, 6.0, false), Grab::Rotate, "zone de rotation hors du cadre");
        assert_eq!(f.hit(15.0, 15.0, 2.0, 6.0, true), Grab::Rotate, "clic droit = rotation");
    }

    #[test]
    fn warp_moves_one_corner() {
        let mut d = red_square();
        let mut f = Floating::lift(&mut d, Kind::Warp, false).unwrap();
        let s = f.snapshot();
        f.drag(&s, Grab::Corner(2), (20.0, 20.0), (30.0, 25.0), false, false);
        let q = f.corners();
        assert_eq!(q[2], (30.0, 25.0));
        assert_eq!(q[0], (10.0, 10.0));
        f.render(&mut d);
        assert!(d.layer().px[(22 * 40 + 26) * 4 + 3] > 0, "coin étiré");
    }

    /// Vitesse : déplacement d'une sélection de 1500×1000 dans une image de 4000×3000
    /// (cargo test --release -p masterpaint-ui bench_move -- --ignored --nocapture).
    #[test]
    #[ignore]
    fn bench_move() {
        let (w, h) = (4000, 3000);
        let mut d = Doc::new(w, h, [200, 100, 50, 255], "b");
        let mut m = vec![0u8; w * h];
        for y in 1000..2000 {
            m[y * w + 1000..y * w + 2500].fill(255);
        }
        d.sel = Some(m);
        let mut f = Floating::lift(&mut d, Kind::MovePixels, false).unwrap();
        let start = f.snapshot();
        let t = std::time::Instant::now();
        let mut area = 0usize;
        for k in 1..=30 {
            f.drag(&start, Grab::Translate, (0.0, 0.0), (k as f32 * 7.0, k as f32 * 3.0), false, false);
            let (x0, y0, x1, y1) = f.render(&mut d).unwrap();
            area += (x1 - x0) * (y1 - y0);
        }
        println!("déplacement : {:.1} ms par mouvement, {} px recalculés en moyenne", t.elapsed().as_secs_f64() * 1000.0 / 30.0, area / 30);
    }
}